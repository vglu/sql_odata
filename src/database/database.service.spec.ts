import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DatabaseService } from './database.service';
import * as sql from 'mssql';

// Mock mssql module
jest.mock('mssql');

describe('DatabaseService', () => {
  let service: DatabaseService;
  let mockPool: any;

  beforeEach(async () => {
    mockPool = {
      connect: jest.fn().mockResolvedValue(undefined),
      close: jest.fn().mockResolvedValue(undefined),
      request: jest.fn().mockReturnValue({
        input: jest.fn().mockReturnThis(),
        query: jest.fn().mockResolvedValue({
          recordset: [{ id: 1, name: 'test' }],
          rowsAffected: [1],
        }),
      }),
    };

    (sql.ConnectionPool as jest.Mock).mockImplementation(() => mockPool);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DatabaseService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
              const config: Record<string, any> = {
                DB_USER: 'test',
                DB_PASSWORD: 'test',
                DB_SERVER: 'localhost',
                DB_NAME: 'test',
                DB_PORT: '1433',
                DB_ENCRYPT: 'false',
              };
              return config[key] || defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<DatabaseService>(DatabaseService);
    await service.onModuleInit();
  });

  afterEach(async () => {
    if (service) {
      await service.onModuleDestroy();
    }
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('executeQuery', () => {
    it('should execute query and return results', async () => {
      const result = await service.executeQuery('SELECT * FROM test');
      expect(result).toEqual([{ id: 1, name: 'test' }]);
      expect(mockPool.request().query).toHaveBeenCalledWith('SELECT * FROM test');
    });

    it('should execute query with parameters', async () => {
      const result = await service.executeQuery('SELECT * FROM test WHERE id = @id', { id: 1 });
      expect(mockPool.request().input).toHaveBeenCalledWith('id', 1);
      expect(result).toEqual([{ id: 1, name: 'test' }]);
    });
  });

  describe('executeNonQuery', () => {
    it('should execute non-query and return rows affected', async () => {
      const result = await service.executeNonQuery('UPDATE test SET name = @name', { name: 'new' });
      expect(result).toBe(1);
    });
  });
});


