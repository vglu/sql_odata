import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, query, body, headers, ip, params } = req;
    const startTime = Date.now();
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Логируем входящий запрос с деталями
    this.logger.log(
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
    );
    this.logger.log(`[${requestId}] → INCOMING REQUEST`);
    this.logger.log(`[${requestId}] Method: ${method}`);
    this.logger.log(`[${requestId}] URL: ${originalUrl}`);
    this.logger.log(`[${requestId}] IP: ${ip || req.socket.remoteAddress || 'unknown'}`);
    
    // Логируем параметры маршрута
    if (Object.keys(params).length > 0) {
      this.logger.log(`[${requestId}] Route Params: ${JSON.stringify(params, null, 2)}`);
    }
    
    // Логируем query параметры
    if (Object.keys(query).length > 0) {
      this.logger.log(`[${requestId}] Query Params: ${JSON.stringify(query, null, 2)}`);
    }

    // Логируем важные заголовки
    const importantHeaders = {
      'user-agent': headers['user-agent'],
      'accept': headers.accept,
      'content-type': headers['content-type'],
      'authorization': headers.authorization ? '[REDACTED]' : undefined,
      'odata-version': headers['odata-version'],
      'odata-maxversion': headers['odata-maxversion'],
      'origin': headers.origin,
      'referer': headers.referer,
    };
    
    const filteredHeaders = Object.fromEntries(
      Object.entries(importantHeaders).filter(([_, v]) => v !== undefined),
    );
    
    if (Object.keys(filteredHeaders).length > 0) {
      this.logger.log(`[${requestId}] Headers: ${JSON.stringify(filteredHeaders, null, 2)}`);
    }

    // Логируем тело запроса для POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(method) && body) {
      const bodyStr = JSON.stringify(body, null, 2);
      const maxBodyLength = 1000;
      if (bodyStr.length > maxBodyLength) {
        this.logger.log(`[${requestId}] Request Body (truncated): ${bodyStr.substring(0, maxBodyLength)}...`);
      } else {
        this.logger.log(`[${requestId}] Request Body: ${bodyStr}`);
      }
    }

    // Перехватываем ответ
    const originalSend = res.send;
    const logger = this.logger; // Сохраняем ссылку на logger
    const getStatusText = this.getStatusText.bind(this);
    const formatBytes = this.formatBytes.bind(this);

    res.send = function (data: any) {
      const duration = Date.now() - startTime;
      const statusCode = res.statusCode;

      // Определяем размер ответа
      let responseSize = 0;
      let responsePreview = '';

      if (typeof data === 'string') {
        responseSize = Buffer.byteLength(data, 'utf8');
        responsePreview = data.length > 500 ? data.substring(0, 500) + '...' : data;
      } else if (data) {
        const dataStr = JSON.stringify(data);
        responseSize = Buffer.byteLength(dataStr, 'utf8');
        responsePreview = dataStr.length > 500 ? dataStr.substring(0, 500) + '...' : dataStr;
      }

      // Логируем ответ
      logger.log(`[${requestId}] ← OUTGOING RESPONSE`);
      logger.log(`[${requestId}] Status: ${statusCode} ${getStatusText(statusCode)}`);
      logger.log(`[${requestId}] Duration: ${duration}ms`);
      logger.log(`[${requestId}] Response Size: ${formatBytes(responseSize)}`);

      // Логируем заголовки ответа
      const responseHeaders: Record<string, string> = {};
      res.getHeaderNames().forEach((name) => {
        const value = res.getHeader(name);
        if (value) {
          responseHeaders[name] = Array.isArray(value) ? value.join(', ') : String(value);
        }
      });

      if (Object.keys(responseHeaders).length > 0) {
        logger.debug(`[${requestId}] Response Headers: ${JSON.stringify(responseHeaders, null, 2)}`);
      }

      // Логируем preview ответа
      if (responsePreview) {
        if (statusCode >= 400) {
          logger.error(`[${requestId}] Error Response: ${responsePreview}`);
        } else {
          logger.log(`[${requestId}] Response Preview: ${responsePreview}`);
        }
      }

      logger.log(
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      );

      return originalSend.call(this, data);
    };

    next();
  }

  private getStatusText(statusCode: number): string {
    const statusTexts: Record<number, string> = {
      200: 'OK',
      201: 'Created',
      204: 'No Content',
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      500: 'Internal Server Error',
    };
    return statusTexts[statusCode] || '';
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  }
}

