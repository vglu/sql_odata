import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import { ODataInterceptor } from './common/odata.interceptor';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });
  
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

  const port = process.env.PORT || 3000;
  await app.listen(port);
  const logger = new Logger('Bootstrap');
  logger.log(`🚀 Приложение запущено на http://localhost:${port}`);
  logger.log(`📊 API доступно по адресу http://localhost:${port}/api`);
  logger.log(`📋 OData метаданные: http://localhost:${port}/api/$metadata`);
}

bootstrap();

