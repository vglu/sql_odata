import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggingMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');
  private readonly logFormat: 'text' | 'json';

  constructor(private readonly configService: ConfigService) {
    this.logFormat = (this.configService.get<string>('LOG_FORMAT') || 'text') as 'text' | 'json';
  }

  use(req: Request, res: Response, next: NextFunction) {
    const { method, originalUrl, query, body, headers, ip, params } = req;
    const startTime = Date.now();
    const requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Логируем входящий запрос
    if (this.logFormat === 'json') {
      const logEntry = {
        timestamp: new Date().toISOString(),
        level: 'info',
        requestId,
        type: 'incoming',
        method,
        url: originalUrl,
        ip: ip || req.socket.remoteAddress || 'unknown',
        ...(Object.keys(params).length > 0 && { routeParams: params }),
        ...(Object.keys(query).length > 0 && { queryParams: query }),
        headers: {
          'user-agent': headers['user-agent'],
          accept: headers.accept,
          'content-type': headers['content-type'],
          ...(headers.authorization && { authorization: '[REDACTED]' }),
          'odata-version': headers['odata-version'],
          'odata-maxversion': headers['odata-maxversion'],
        },
        ...(['POST', 'PUT', 'PATCH'].includes(method) && body && {
          body: typeof body === 'string' && body.length > 1000
            ? body.substring(0, 1000) + '...'
            : body,
        }),
      };
      this.logger.log(JSON.stringify(logEntry));
    } else {
      // Текстовый формат (старый)
      this.logger.log(
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      );
      this.logger.log(`[${requestId}] → INCOMING REQUEST`);
      this.logger.log(`[${requestId}] Method: ${method}`);
      this.logger.log(`[${requestId}] URL: ${originalUrl}`);
      this.logger.log(`[${requestId}] IP: ${ip || req.socket.remoteAddress || 'unknown'}`);
      
      if (Object.keys(params).length > 0) {
        this.logger.log(`[${requestId}] Route Params: ${JSON.stringify(params, null, 2)}`);
      }
      
      if (Object.keys(query).length > 0) {
        this.logger.log(`[${requestId}] Query Params: ${JSON.stringify(query, null, 2)}`);
      }

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

      if (['POST', 'PUT', 'PATCH'].includes(method) && body) {
        const bodyStr = JSON.stringify(body, null, 2);
        const maxBodyLength = 1000;
        if (bodyStr.length > maxBodyLength) {
          this.logger.log(`[${requestId}] Request Body (truncated): ${bodyStr.substring(0, maxBodyLength)}...`);
        } else {
          this.logger.log(`[${requestId}] Request Body: ${bodyStr}`);
        }
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
      const logFormat = this.logFormat; // Получаем из замыкания
      
      if (logFormat === 'json') {
        const responseHeaders: Record<string, string> = {};
        res.getHeaderNames().forEach((name) => {
          const value = res.getHeader(name);
          if (value) {
            responseHeaders[name] = Array.isArray(value) ? value.join(', ') : String(value);
          }
        });

        const logEntry = {
          timestamp: new Date().toISOString(),
          level: statusCode >= 400 ? 'error' : 'info',
          requestId,
          type: 'outgoing',
          method,
          url: originalUrl,
          statusCode,
          statusText: getStatusText(statusCode),
          duration,
          responseSize: formatBytes(responseSize),
          responseSizeBytes: responseSize,
          ...(Object.keys(responseHeaders).length > 0 && { responseHeaders }),
          ...(responsePreview && {
            responsePreview: statusCode >= 400 ? responsePreview : responsePreview.substring(0, 500),
          }),
        };
        logger.log(JSON.stringify(logEntry));
      } else {
        // Текстовый формат
        logger.log(`[${requestId}] ← OUTGOING RESPONSE`);
        logger.log(`[${requestId}] Status: ${statusCode} ${getStatusText(statusCode)}`);
        logger.log(`[${requestId}] Duration: ${duration}ms`);
        logger.log(`[${requestId}] Response Size: ${formatBytes(responseSize)}`);

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
      }

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

