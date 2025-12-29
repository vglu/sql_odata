import { Test, TestingModule } from '@nestjs/testing';
import { ODataParserService } from './odata-parser.service';

describe('ODataParserService', () => {
  let service: ODataParserService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ODataParserService],
    }).compile();

    service = module.get<ODataParserService>(ODataParserService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('parseFilter', () => {
    it('should parse simple equality filter', () => {
      const result = service.parseFilter('name eq "test"');
      expect(result).toContain('name = @filter_param_0');
    });

    it('should parse comparison operators', () => {
      expect(service.parseFilter('age gt 18')).toContain('age > @filter_param_0');
      expect(service.parseFilter('price lt 100')).toContain('price < @filter_param_0');
      expect(service.parseFilter('count ge 5')).toContain('count >= @filter_param_0');
      expect(service.parseFilter('score le 10')).toContain('score <= @filter_param_0');
    });

    it('should parse logical operators', () => {
      const result = service.parseFilter('name eq "test" and age gt 18');
      expect(result).toContain('AND');
    });

    it('should parse parentheses', () => {
      const result = service.parseFilter('(name eq "test" or name eq "other") and age gt 18');
      expect(result).toContain('(');
    });
  });

  describe('parseOrderBy', () => {
    it('should parse simple order by', () => {
      const result = service.parseOrderBy('name');
      expect(result).toBe('name ASC');
    });

    it('should parse order by with direction', () => {
      expect(service.parseOrderBy('name asc')).toBe('name ASC');
      expect(service.parseOrderBy('name desc')).toBe('name DESC');
    });

    it('should parse multiple order by clauses', () => {
      const result = service.parseOrderBy('name desc, age asc');
      expect(result).toContain('name DESC');
      expect(result).toContain('age ASC');
    });
  });

  describe('parseSelect', () => {
    it('should parse single field', () => {
      const result = service.parseSelect('name');
      expect(result).toEqual(['name']);
    });

    it('should parse multiple fields', () => {
      const result = service.parseSelect('name,age,email');
      expect(result).toEqual(['name', 'age', 'email']);
    });

    it('should trim whitespace', () => {
      const result = service.parseSelect('name , age , email');
      expect(result).toEqual(['name', 'age', 'email']);
    });
  });
});


