import { Controller, Get, Req, Res, Logger, Header } from '@nestjs/common';
import { Request, Response } from 'express';
import { ODataService } from '../odata/odata.service';

@Controller()
export class RootController {
  private readonly logger = new Logger(RootController.name);

  constructor(private readonly odataService: ODataService) {}

  /**
   * Корневой endpoint для OData сервиса
   * GET /
   */
  @Get()
  async getRoot(@Req() req: Request) {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
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
   * Обработка $metadata на корневом уровне
   * GET /$metadata
   */
  @Get('$metadata')
  @Header('Content-Type', 'application/xml; charset=utf-8')
  async getMetadata(@Req() req: Request, @Res() res: Response) {
    this.logger.debug('Получен запрос метаданных на корневом уровне (XML)');
    try {
      const applicationName = 'Default';
      const xmlMetadata = await this.odataService.getMetadataXml(applicationName);
      res.setHeader('Content-Type', 'application/xml; charset=utf-8');
      return res.send(xmlMetadata);
    } catch (error) {
      this.logger.error(`Ошибка при генерации XML метаданных: ${error.message}`, error.stack);
      throw error;
    }
  }
}

