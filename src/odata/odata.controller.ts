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
import { Request, Response } from 'express';
import { ODataService } from './odata.service';
import { ODataParserService, ODataQueryParams } from './odata-parser.service';

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

