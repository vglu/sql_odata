import { Injectable, NotFoundException, BadRequestException, Logger, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from '../database/database.service';
import { ODataParserService, ODataQueryParams } from './odata-parser.service';

@Injectable()
export class ODataService {
  private readonly logger = new Logger(ODataService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly parserService: ODataParserService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Получает список записей из таблицы с поддержкой OData параметров
   */
  async getEntities(
    tableName: string,
    queryParams: ODataQueryParams,
  ): Promise<{ value: any[]; count?: number }> {
    // Валидация имени таблицы
    this.validateTableName(tableName);

    // Проверка whitelist/blacklist
    if (!this.isTableAllowed(tableName)) {
      throw new ForbiddenException(`Доступ к таблице ${tableName} запрещен`);
    }

    // Получаем список колонок таблицы
    const columns = await this.getTableColumns(tableName);
    if (columns.length === 0) {
      throw new NotFoundException(`Таблица ${tableName} не найдена`);
    }

    const columnNames = columns.map((col) => col.name);

    // Формируем SELECT часть
    const selectFields = this.parserService.formatSelectFields(
      queryParams.select || [],
      columnNames,
    );

    // Формируем WHERE условие
    const parsedFilter = this.parserService.parseFilter(
      queryParams.filter || '',
      `filter_${tableName}`,
    );

    // Формируем ORDER BY
    const orderBy = this.parserService.parseOrderBy(queryParams.orderby || '');

    // Формируем SQL запрос
    let sql = `SELECT ${selectFields} FROM [${tableName}] WHERE ${parsedFilter.sql}`;

    if (orderBy) {
      sql += ` ORDER BY ${orderBy}`;
    }

    // Применяем TOP и SKIP (OFFSET/FETCH)
    if (queryParams.top !== undefined || queryParams.skip !== undefined) {
      const top = queryParams.top || 1000;
      const skip = queryParams.skip || 0;

      if (orderBy) {
        sql += ` OFFSET @skip ROWS FETCH NEXT @top ROWS ONLY`;
      } else {
        // Если нет ORDER BY, добавляем ORDER BY по первой колонке
        sql += ` ORDER BY [${columnNames[0]}] OFFSET @skip ROWS FETCH NEXT @top ROWS ONLY`;
      }

      parsedFilter.parameters.skip = skip;
      parsedFilter.parameters.top = top;
    }

    // Логируем SQL запрос и параметры
    this.logger.debug(`Executing SQL for table "${tableName}":`);
    this.logger.debug(`SQL: ${sql}`);
    this.logger.debug(`Parameters: ${JSON.stringify(parsedFilter.parameters, null, 2)}`);

    // Выполняем запрос
    const queryStartTime = Date.now();
    const results = await this.databaseService.executeQuery(
      sql,
      parsedFilter.parameters,
    );
    const queryDuration = Date.now() - queryStartTime;
    this.logger.log(`Query executed in ${queryDuration}ms, returned ${results.length} rows`);

    let count: number | undefined;
    if (queryParams.count) {
      const countSql = `SELECT COUNT(*) as count FROM [${tableName}] WHERE ${parsedFilter.sql}`;
      const countResult = await this.databaseService.executeScalar<number>(
        countSql,
        parsedFilter.parameters,
      );
      count = countResult;
    }

    // Формируем правильный OData ответ
    const response: any = {
      '@odata.context': '', // Будет добавлено в interceptor
      value: results,
    };

    if (count !== undefined) {
      response['@odata.count'] = count;
    }

    return response;
  }

  /**
   * Получает одну запись по ключу
   */
  async getEntity(tableName: string, key: string | number): Promise<any> {
    this.validateTableName(tableName);

    // Проверка whitelist/blacklist
    if (!this.isTableAllowed(tableName)) {
      throw new ForbiddenException(`Доступ к таблице ${tableName} запрещен`);
    }

    const columns = await this.getTableColumns(tableName);
    if (columns.length === 0) {
      throw new NotFoundException(`Таблица ${tableName} не найдена`);
    }

    // Предполагаем, что первая колонка - это ключ (можно улучшить)
    const keyColumn = columns[0].name;
    const selectFields = columns.map((col) => `[${col.name}]`).join(', ');

    const sql = `SELECT ${selectFields} FROM [${tableName}] WHERE [${keyColumn}] = @key`;
    const results = await this.databaseService.executeQuery(sql, {
      key: key,
    });

    if (results.length === 0) {
      throw new NotFoundException(
        `Запись с ключом ${key} не найдена в таблице ${tableName}`,
      );
    }

    return results[0];
  }

  /**
   * Валидирует данные перед вставкой/обновлением
   */
  private async validateEntityData(tableName: string, data: any, isUpdate: boolean = false): Promise<void> {
    const columns = await this.getTableColumns(tableName);
    const columnMap = new Map(columns.map((col) => [col.name.toLowerCase(), col]));

    for (const [key, value] of Object.entries(data)) {
      const column = columnMap.get(key.toLowerCase());
      
      if (!column) {
        throw new BadRequestException(`Неизвестное поле: ${key}`);
      }

      // Проверка NULL для NOT NULL полей
      if (value === null && column.nullable === 'NO' && !isUpdate) {
        throw new BadRequestException(`Поле ${key} не может быть NULL`);
      }
    }
  }

  /**
   * Создает новую запись (PUT для создания)
   */
  async createEntity(tableName: string, data: any): Promise<any> {
    this.validateTableName(tableName);

    // Проверка whitelist/blacklist
    if (!this.isTableAllowed(tableName)) {
      throw new ForbiddenException(`Доступ к таблице ${tableName} запрещен`);
    }

    // Валидация данных
    await this.validateEntityData(tableName, data, false);

    const columns = await this.getTableColumns(tableName);
    if (columns.length === 0) {
      throw new NotFoundException(`Таблица ${tableName} не найдена`);
    }

    // Фильтруем только существующие колонки и те, что указаны в data
    const validColumns = columns.filter((col) => data.hasOwnProperty(col.name));
    
    if (validColumns.length === 0) {
      throw new BadRequestException('Нет данных для создания записи или все поля неизвестны');
    }

    const columnNames = validColumns.map((col) => `[${col.name}]`);
    const parameterNames = validColumns.map((col) => `@${col.name}`);

    const sql = `INSERT INTO [${tableName}] (${columnNames.join(', ')}) OUTPUT INSERTED.* VALUES (${parameterNames.join(', ')})`;

    const parameters: Record<string, any> = {};
    validColumns.forEach((col) => {
      parameters[col.name] = data[col.name];
    });

    this.logger.debug(`Creating entity in table "${tableName}": ${JSON.stringify(parameters)}`);

    const results = await this.databaseService.executeQuery(sql, parameters);

    if (results.length === 0) {
      throw new BadRequestException('Не удалось создать запись');
    }

    return results[0];
  }

  /**
   * Обновляет запись (PUT - полное обновление)
   */
  async updateEntity(
    tableName: string,
    key: string | number,
    data: any,
  ): Promise<any> {
    this.validateTableName(tableName);

    // Проверка whitelist/blacklist
    if (!this.isTableAllowed(tableName)) {
      throw new ForbiddenException(`Доступ к таблице ${tableName} запрещен`);
    }

    // Валидация данных
    await this.validateEntityData(tableName, data, true);

    const columns = await this.getTableColumns(tableName);
    if (columns.length === 0) {
      throw new NotFoundException(`Таблица ${tableName} не найдена`);
    }

    const keyColumn = columns[0].name;
    const validColumns = columns.filter(
      (col) => col.name !== keyColumn && data.hasOwnProperty(col.name),
    );

    if (validColumns.length === 0) {
      throw new BadRequestException('Нет данных для обновления');
    }

    const setClause = validColumns
      .map((col) => `[${col.name}] = @${col.name}`)
      .join(', ');

    const sql = `UPDATE [${tableName}] SET ${setClause} OUTPUT INSERTED.* WHERE [${keyColumn}] = @key`;

    const parameters: Record<string, any> = { key };
    validColumns.forEach((col) => {
      parameters[col.name] = data[col.name];
    });

    const results = await this.databaseService.executeQuery(sql, parameters);

    if (results.length === 0) {
      throw new NotFoundException(
        `Запись с ключом ${key} не найдена в таблице ${tableName}`,
      );
    }

    return results[0];
  }

  /**
   * Частично обновляет запись (PATCH)
   */
  async patchEntity(
    tableName: string,
    key: string | number,
    data: any,
  ): Promise<any> {
    // PATCH работает так же, как PUT, но только для указанных полей
    return this.updateEntity(tableName, key, data);
  }

  /**
   * Удаляет запись
   */
  async deleteEntity(tableName: string, key: string | number): Promise<void> {
    this.validateTableName(tableName);

    // Проверка whitelist/blacklist
    if (!this.isTableAllowed(tableName)) {
      throw new ForbiddenException(`Доступ к таблице ${tableName} запрещен`);
    }

    const columns = await this.getTableColumns(tableName);
    if (columns.length === 0) {
      throw new NotFoundException(`Таблица ${tableName} не найдена`);
    }

    const keyColumn = columns[0].name;
    const sql = `DELETE FROM [${tableName}] WHERE [${keyColumn}] = @key`;

    const affectedRows = await this.databaseService.executeNonQuery(sql, {
      key,
    });

    if (affectedRows === 0) {
      throw new NotFoundException(
        `Запись с ключом ${key} не найдена в таблице ${tableName}`,
      );
    }
  }

  /**
   * Получает XML метаданные в формате OData EDMX
   */
  async getMetadataXml(applicationName: string = 'Default'): Promise<string> {
    // Получаем все таблицы и колонки одним запросом
    const tablesColumnsMap = await this.getAllTablesColumns();

    // Фильтруем по whitelist/blacklist
    const allowedTables = Array.from(tablesColumnsMap.keys()).filter((tableName) =>
      this.isTableAllowed(tableName),
    );

    // Формируем entities
    const entities = allowedTables.map((tableName) => {
      const columns = tablesColumnsMap.get(tableName)!;
      return {
        name: tableName,
        schema: columns[0]?.schema || 'dbo',
        properties: columns.map((col) => ({
          name: col.name,
          type: this.mapSqlTypeToODataType(col.type),
          nullable: col.nullable === 'YES',
          isKey: col.ordinalPosition === 1, // Первая колонка - ключ
        })),
      };
    });

    // Генерируем XML
    let xml = '<?xml version="1.0" encoding="utf-8"?>\n';
    xml += '<edmx:Edmx Version="4.0" xmlns:edmx="http://docs.oasis-open.org/odata/ns/edmx">\n';
    xml += '  <edmx:DataServices>\n';
    xml += `    <Schema Namespace="${applicationName}" xmlns="http://docs.oasis-open.org/odata/ns/edm">\n`;

    // Добавляем EntityType для каждой таблицы
    entities.forEach((entity) => {
      xml += `      <EntityType Name="${this.escapeXml(entity.name)}">\n`;
      
      // Добавляем Key
      const keyProperty = entity.properties.find((p) => p.isKey);
      if (keyProperty) {
        xml += `        <Key>\n`;
        xml += `          <PropertyRef Name="${this.escapeXml(keyProperty.name)}" />\n`;
        xml += `        </Key>\n`;
      }

      // Добавляем Properties
      entity.properties.forEach((prop) => {
        xml += `        <Property Name="${this.escapeXml(prop.name)}" Type="${prop.type}"`;
        if (!prop.nullable) {
          xml += ' Nullable="false"';
        }
        xml += ' />\n';
      });

      xml += `      </EntityType>\n`;
    });

    // Добавляем EntityContainer
    xml += `      <EntityContainer Name="Container">\n`;
    entities.forEach((entity) => {
      xml += `        <EntitySet Name="${this.escapeXml(entity.name)}" EntityType="${applicationName}.${this.escapeXml(entity.name)}" />\n`;
    });
    xml += `      </EntityContainer>\n`;

    xml += `    </Schema>\n`;
    xml += `  </edmx:DataServices>\n`;
    xml += `</edmx:Edmx>`;

    return xml;
  }

  /**
   * Экранирует XML спецсимволы
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  /**
   * Преобразует SQL тип в OData тип
   */
  private mapSqlTypeToODataType(sqlType: string): string {
    const typeMap: Record<string, string> = {
      int: 'Edm.Int32',
      bigint: 'Edm.Int64',
      smallint: 'Edm.Int16',
      tinyint: 'Edm.Byte',
      bit: 'Edm.Boolean',
      decimal: 'Edm.Decimal',
      numeric: 'Edm.Decimal',
      float: 'Edm.Double',
      real: 'Edm.Single',
      money: 'Edm.Decimal',
      smallmoney: 'Edm.Decimal',
      date: 'Edm.Date',
      time: 'Edm.TimeOfDay',
      datetime: 'Edm.DateTimeOffset',
      datetime2: 'Edm.DateTimeOffset',
      datetimeoffset: 'Edm.DateTimeOffset',
      smalldatetime: 'Edm.DateTimeOffset',
      char: 'Edm.String',
      varchar: 'Edm.String',
      nchar: 'Edm.String',
      nvarchar: 'Edm.String',
      text: 'Edm.String',
      ntext: 'Edm.String',
      uniqueidentifier: 'Edm.Guid',
      binary: 'Edm.Binary',
      varbinary: 'Edm.Binary',
      image: 'Edm.Binary',
      timestamp: 'Edm.Binary',
    };

    const normalizedType = sqlType.toLowerCase().split('(')[0].trim();
    return typeMap[normalizedType] || 'Edm.String';
  }

  /**
   * Кэш для колонок таблиц
   */
  private tableColumnsCache: Map<string, any[]> = new Map();

  /**
   * Получает список колонок таблицы
   * Использует кэш если доступен, иначе делает запрос к БД
   */
  private async getTableColumns(tableName: string, useCache: boolean = true): Promise<any[]> {
    // Проверяем кэш
    if (useCache && this.tableColumnsCache.has(tableName)) {
      return this.tableColumnsCache.get(tableName)!;
    }

    const sql = `
      SELECT 
        COLUMN_NAME as name,
        DATA_TYPE as type,
        IS_NULLABLE as nullable,
        ORDINAL_POSITION as ordinalPosition
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = @tableName
      ORDER BY ORDINAL_POSITION
    `;

    const columns = await this.databaseService.executeQuery(sql, { tableName });
    
    // Кэшируем результат
    if (useCache) {
      this.tableColumnsCache.set(tableName, columns);
    }

    return columns;
  }

  /**
   * Очищает кэш колонок таблиц
   */
  clearTableColumnsCache(): void {
    this.tableColumnsCache.clear();
  }

  /**
   * Валидация имени таблицы (защита от SQL инъекций)
   */
  private validateTableName(tableName: string): void {
    if (!tableName || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableName)) {
      throw new BadRequestException('Недопустимое имя таблицы');
    }
  }
}

