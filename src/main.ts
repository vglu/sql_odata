import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';
import { ODataInterceptor } from './common/odata.interceptor';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  
  const configService = app.get(ConfigService);
  
  // Включаем CORS для поддержки OPTIONS запросов
  app.enableCors({
    origin: '*',
    methods: 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    allowedHeaders: 'Content-Type, Authorization, Accept, OData-Version, OData-MaxVersion',
    exposedHeaders: 'OData-Version, OData-EntityId',
  });
  
  // Включаем валидацию
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // Добавляем глобальный OData interceptor
  app.useGlobalInterceptors(new ODataInterceptor());

  // Swagger UI
  const enableSwagger = configService.get<boolean>('ENABLE_SWAGGER', true);
  if (enableSwagger) {
    const config = new DocumentBuilder()
      .setTitle('SQL OData REST API')
      .setDescription('REST API для доступа к MS SQL Server с поддержкой OData 4.0 операций')
      .setVersion('1.0.0')
      .addTag('OData', 'OData endpoints')
      .addTag('Metadata', 'Метаданные')
      .build();
    
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api-docs', app, document);
  }

  const port = configService.get<number>('PORT') || 3000;
  await app.listen(port);
  const logger = new Logger('Bootstrap');
  logger.log(`🚀 Приложение запущено на http://localhost:${port}`);
  logger.log(`📊 API доступно по адресу http://localhost:${port}/api`);
  logger.log(`📋 OData метаданные: http://localhost:${port}/api/$metadata`);
  if (enableSwagger) {
    logger.log(`📖 Swagger UI: http://localhost:${port}/api-docs`);
  }
}

bootstrap();

