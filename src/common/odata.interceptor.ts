import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Response } from 'express';

@Injectable()
export class ODataInterceptor implements NestInterceptor {
  private readonly logger = new Logger('ODataInterceptor');

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const response = context.switchToHttp().getResponse<Response>();
    const request = context.switchToHttp().getRequest();

    // Добавляем OData заголовки
    response.setHeader('OData-Version', '4.0');
    response.setHeader('Content-Type', 'application/json; odata.metadata=minimal');
    
    // Добавляем CORS заголовки
    response.setHeader('Access-Control-Expose-Headers', 'OData-Version, OData-EntityId');

    return next.handle().pipe(
      tap((data) => {
        // Логируем успешный ответ (безопасная сериализация)
        if (process.env.NODE_ENV !== 'production') {
          try {
            const dataStr = this.safeStringify(data);
            this.logger.debug(`Response data: ${dataStr.substring(0, 500)}`);
          } catch (error) {
            this.logger.debug(`Response data: [Unable to stringify: ${typeof data}]`);
          }
        }

        // Добавляем @odata.context только если его еще нет и это коллекция
        // НЕ добавляем для строк (XML ответы)
        if (data && typeof data === 'object' && !Array.isArray(data) && 'value' in data) {
          const baseUrl = `${request.protocol}://${request.get('host')}${request.baseUrl}`;
          const table = request.params.table || '';
          
          if (!data['@odata.context']) {
            if (table && table !== '$metadata') {
              // Для коллекций - указываем EntitySet
              data['@odata.context'] = `${baseUrl}/$metadata#${table}`;
            } else if (table === '$metadata') {
              data['@odata.context'] = `${baseUrl}/$metadata`;
            }
          }
          
          // Убеждаемся, что value всегда является массивом
          if (!Array.isArray(data.value)) {
            data.value = [];
          }
        }
      }),
      catchError((error) => {
        // Логируем ошибки детально
        this.logger.error(
          `Error in ${request.method} ${request.url}: ${error.message}`,
          error.stack,
        );
        throw error;
      }),
    );
  }

  /**
   * Безопасная сериализация объектов с обработкой циклических ссылок
   */
  private safeStringify(obj: any, space?: number): string {
    const seen = new WeakSet();
    return JSON.stringify(
      obj,
      (key, value) => {
        // Пропускаем циклические ссылки
        if (typeof value === 'object' && value !== null) {
          if (seen.has(value)) {
            return '[Circular]';
          }
          seen.add(value);
        }
        // Пропускаем специальные объекты
        if (value instanceof Error) {
          return {
            name: value.name,
            message: value.message,
            stack: value.stack,
          };
        }
        return value;
      },
      space,
    );
  }
}

