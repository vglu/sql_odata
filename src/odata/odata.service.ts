import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import { ODataParserService, ODataQueryParams } from './odata-parser.service';

@Injectable()
export class ODataService {
  private readonly logger = new Logger(ODataService.name);

  constructor(
    private readonly databaseService: DatabaseService,
    private readonly parserService: ODataParserService,
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
   * Создает новую запись (PUT для создания)
   */
  async createEntity(tableName: string, data: any): Promise<any> {
    this.validateTableName(tableName);

    const columns = await this.getTableColumns(tableName);
    if (columns.length === 0) {
      throw new NotFoundException(`Таблица ${tableName} не найдена`);
    }

    const validColumns = columns.filter((col) => data.hasOwnProperty(col.name));
    const columnNames = validColumns.map((col) => `[${col.name}]`);
    const parameterNames = validColumns.map((col) => `@${col.name}`);

    const sql = `INSERT INTO [${tableName}] (${columnNames.join(', ')}) OUTPUT INSERTED.* VALUES (${parameterNames.join(', ')})`;

    const parameters: Record<string, any> = {};
    validColumns.forEach((col) => {
      parameters[col.name] = data[col.name];
    });

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
    const sql = `
      SELECT 
        TABLE_SCHEMA as [schema],
        TABLE_NAME as name
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_TYPE = 'BASE TABLE'
        AND TABLE_SCHEMA NOT IN ('sys', 'information_schema', 'guest')
      ORDER BY TABLE_SCHEMA, TABLE_NAME
    `;

    const tables = await this.databaseService.executeQuery<{
      schema: string;
      name: string;
    }>(sql);

    // Получаем колонки для каждой таблицы
    const entities = await Promise.all(
      tables.map(async (table) => {
        const columns = await this.getTableColumns(table.name);
        return {
          name: table.name,
          schema: table.schema,
          properties: columns.map((col) => ({
            name: col.name,
            type: this.mapSqlTypeToODataType(col.type),
            nullable: col.nullable === 'YES',
            isKey: columns.indexOf(col) === 0, // Первая колонка - ключ
          })),
        };
      }),
    );

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
   * Получает список колонок таблицы
   */
  private async getTableColumns(tableName: string): Promise<any[]> {
    const sql = `
      SELECT 
        COLUMN_NAME as name,
        DATA_TYPE as type,
        IS_NULLABLE as nullable
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_NAME = @tableName
      ORDER BY ORDINAL_POSITION
    `;

    return this.databaseService.executeQuery(sql, { tableName });
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

