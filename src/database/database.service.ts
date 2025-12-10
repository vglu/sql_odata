import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as sql from 'mssql';

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy {
  private pool: sql.ConnectionPool;

  constructor(private configService: ConfigService) {}

  async onModuleInit() {
    // Правильно обрабатываем параметр encrypt (должен быть boolean или "strict")
    const encryptValue = this.configService.get<string>('DB_ENCRYPT');
    let encrypt: boolean | 'strict' = false;
    if (encryptValue === 'true') {
      encrypt = true;
    } else if (encryptValue === 'strict') {
      encrypt = 'strict';
    }

    const config: sql.config = {
      user: this.configService.get<string>('DB_USER') || 'sa',
      password: this.configService.get<string>('DB_PASSWORD') || '',
      server: this.configService.get<string>('DB_SERVER') || 'localhost',
      database: this.configService.get<string>('DB_NAME') || 'master',
      port: parseInt(this.configService.get<string>('DB_PORT') || '1433'),
      options: {
        encrypt: encrypt,
        trustServerCertificate: true,
        enableArithAbort: true,
      },
      pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000,
      },
    };

    try {
      this.pool = new sql.ConnectionPool(config);
      await this.pool.connect();
      console.log('✅ Подключение к MS SQL Server установлено');
    } catch (error) {
      console.error('❌ Ошибка подключения к базе данных:', error);
      throw error;
    }
  }

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.close();
      console.log('🔌 Подключение к базе данных закрыто');
    }
  }

  getPool(): sql.ConnectionPool {
    if (!this.pool) {
      throw new Error('База данных не инициализирована');
    }
    return this.pool;
  }

  async executeQuery<T = any>(query: string, parameters?: any): Promise<T[]> {
    const request = this.pool.request();
    
    if (parameters) {
      Object.keys(parameters).forEach((key) => {
        request.input(key, parameters[key]);
      });
    }

    const result = await request.query(query);
    return result.recordset as T[];
  }

  async executeNonQuery(query: string, parameters?: any): Promise<number> {
    const request = this.pool.request();
    
    if (parameters) {
      Object.keys(parameters).forEach((key) => {
        request.input(key, parameters[key]);
      });
    }

    const result = await request.query(query);
    return result.rowsAffected[0];
  }

  async executeScalar<T = any>(query: string, parameters?: any): Promise<T> {
    const request = this.pool.request();
    
    if (parameters) {
      Object.keys(parameters).forEach((key) => {
        request.input(key, parameters[key]);
      });
    }

    const result = await request.query(query);
    return result.recordset[0]?.[Object.keys(result.recordset[0] || {})[0]] as T;
  }
}

