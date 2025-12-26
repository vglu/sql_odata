import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Options,
  Param,
  Query,
  Body,
  Res,
  Req,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiParam, ApiQuery } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { ODataService } from './odata.service';
import { ODataParserService, ODataQueryParams } from './odata-parser.service';

@ApiTags('OData')
@Controller('api')
export class ODataController {
  private readonly logger = new Logger(ODataController.name);

  constructor(
    private readonly odataService: ODataService,
    private readonly parserService: ODataParserService,
  ) {}

  /**
   * OPTIONS запрос для CORS
   */
  @Options('*')
  optionsHandler(@Res() res: Response) {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, Accept, OData-Version, OData-MaxVersion');
    res.header('Access-Control-Max-Age', '86400');
    return res.status(HttpStatus.NO_CONTENT).send();
  }

  /**
   * Корневой endpoint для проверки сервиса
   * GET /api
   */
  @ApiOperation({ summary: 'Корневой endpoint API' })
  @ApiResponse({ status: 200, description: 'Информация о доступных ресурсах' })
  @Get()
  async getServiceRoot(@Req() req: Request) {
    const baseUrl = `${req.protocol}://${req.get('host')}${req.baseUrl}`;
    this.logger.debug('Получен запрос к корневому endpoint');
    return {
      '@odata.context': `${baseUrl}/$metadata`,
      value: [
        {
          name: 'Tables',
          url: `${baseUrl}/$metadata`,
        },
      ],
    };
  }

  /**
   * Получение метаданных или списка записей с поддержкой OData параметров
   * GET /api/$metadata - для метаданных
   * GET /api/{table} - для получения записей из таблицы
   */
  @ApiOperation({ summary: 'Получить метаданные или коллекцию записей' })
  @ApiParam({ name: 'table', description: 'Имя таблицы или $metadata' })
  @ApiQuery({ name: '$filter', required: false, description: 'OData фильтр' })
  @ApiQuery({ name: '$orderby', required: false, description: 'Сортировка' })
  @ApiQuery({ name: '$top', required: false, description: 'Максимальное количество записей' })
  @ApiQuery({ name: '$skip', required: false, description: 'Пропуск записей' })
  @ApiQuery({ name: '$select', required: false, description: 'Выбор полей' })
  @ApiQuery({ name: '$count', required: false, description: 'Включить счетчик' })
  @ApiResponse({ status: 200, description: 'Коллекция записей или метаданные' })
  @Get(':table')
  async getEntities(
    @Param('table') table: string,
    @Query('$filter') filter?: string,
    @Query('$orderby') orderby?: string,
    @Query('$top') top?: string,
    @Query('$skip') skip?: string,
    @Query('$select') select?: string,
    @Query('$count') count?: string,
    @Req() req?: Request,
    @Res() res?: Response,
  ): Promise<any> {
    // Проверяем специальный маршрут $metadata
    if (table === '$metadata') {
      this.logger.debug('Получен запрос метаданных (XML)');
      const applicationName = 'Default';
      const xmlMetadata = await this.odataService.getMetadataXml(applicationName);
      
      // Устанавливаем Content-Type для XML и отправляем ответ
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      return res.send(xmlMetadata);
    }

    this.logger.log(
      `GET ${table} | Filter: ${filter || 'none'} | OrderBy: ${orderby || 'none'} | Top: ${top || 'none'} | Skip: ${skip || 'none'}`,
    );

    try {
      const queryParams: ODataQueryParams = {
        filter,
        orderby,
        top: top ? parseInt(top, 10) : undefined,
        skip: skip ? parseInt(skip, 10) : undefined,
        select: select ? this.parserService.parseSelect(select) : undefined,
        count: count === 'true',
      };

      const result = await this.odataService.getEntities(table, queryParams);
      
      // @odata.context добавляется автоматически через ODataInterceptor
      return result;
    } catch (error) {
      this.logger.error(`Ошибка при получении данных из таблицы ${table}:`, error.stack);
      throw error;
    }
  }

  /**
   * Получение одной записи по ключу
   * GET /api/{table}({key})
   */
  @ApiOperation({ summary: 'Получить одну запись по ключу' })
  @ApiParam({ name: 'table', description: 'Имя таблицы' })
  @ApiParam({ name: 'key', description: 'Значение первичного ключа' })
  @ApiResponse({ status: 200, description: 'Запись найдена' })
  @ApiResponse({ status: 404, description: 'Запись не найдена' })
  @Get(':table/:key')
  async getEntity(
    @Param('table') table: string,
    @Param('key') key: string,
  ) {
    // Пытаемся преобразовать ключ в число, если возможно
    const numericKey = !isNaN(Number(key)) ? Number(key) : key;
    return this.odataService.getEntity(table, numericKey);
  }

  /**
   * Создание новой записи
   * POST /api/{table}
   */
  @ApiOperation({ summary: 'Создать новую запись' })
  @ApiParam({ name: 'table', description: 'Имя таблицы' })
  @ApiResponse({ status: 201, description: 'Запись создана' })
  @ApiResponse({ status: 400, description: 'Ошибка валидации' })
  @Post(':table')
  async createEntity(
    @Param('table') table: string,
    @Body() data: any,
  ) {
    return this.odataService.createEntity(table, data);
  }

  /**
   * Полное обновление записи
   * PUT /api/{table}({key})
   */
  @ApiOperation({ summary: 'Полное обновление записи' })
  @ApiParam({ name: 'table', description: 'Имя таблицы' })
  @ApiParam({ name: 'key', description: 'Значение первичного ключа' })
  @ApiResponse({ status: 200, description: 'Запись обновлена' })
  @ApiResponse({ status: 404, description: 'Запись не найдена' })
  @Put(':table/:key')
  async updateEntity(
    @Param('table') table: string,
    @Param('key') key: string,
    @Body() data: any,
  ) {
    const numericKey = !isNaN(Number(key)) ? Number(key) : key;
    return this.odataService.updateEntity(table, numericKey, data);
  }

  /**
   * Частичное обновление записи
   * PATCH /api/{table}({key})
   */
  @ApiOperation({ summary: 'Частичное обновление записи' })
  @ApiParam({ name: 'table', description: 'Имя таблицы' })
  @ApiParam({ name: 'key', description: 'Значение первичного ключа' })
  @ApiResponse({ status: 200, description: 'Запись обновлена' })
  @ApiResponse({ status: 404, description: 'Запись не найдена' })
  @Patch(':table/:key')
  async patchEntity(
    @Param('table') table: string,
    @Param('key') key: string,
    @Body() data: any,
  ) {
    const numericKey = !isNaN(Number(key)) ? Number(key) : key;
    return this.odataService.patchEntity(table, numericKey, data);
  }

  /**
   * Удаление записи
   * DELETE /api/{table}({key})
   */
  @ApiOperation({ summary: 'Удалить запись' })
  @ApiParam({ name: 'table', description: 'Имя таблицы' })
  @ApiParam({ name: 'key', description: 'Значение первичного ключа' })
  @ApiResponse({ status: 200, description: 'Запись удалена' })
  @ApiResponse({ status: 404, description: 'Запись не найдена' })
  @Delete(':table/:key')
  async deleteEntity(
    @Param('table') table: string,
    @Param('key') key: string,
  ) {
    const numericKey = !isNaN(Number(key)) ? Number(key) : key;
    await this.odataService.deleteEntity(table, numericKey);
    return { message: 'Запись успешно удалена' };
  }
}

