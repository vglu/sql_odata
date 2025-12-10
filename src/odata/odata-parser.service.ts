import { Injectable } from '@nestjs/common';

export interface ODataQueryParams {
  filter?: string;
  orderby?: string;
  top?: number;
  skip?: number;
  select?: string[];
  count?: boolean;
}

export interface ParsedFilter {
  sql: string;
  parameters: Record<string, any>;
}

@Injectable()
export class ODataParserService {
  /**
   * Парсит параметр $filter в SQL WHERE условие
   */
  parseFilter(filter: string, parameterPrefix = 'param'): ParsedFilter {
    if (!filter) {
      return { sql: '1=1', parameters: {} };
    }

    let sqlCondition = filter;
    const parameters: Record<string, any> = {};
    let paramIndex = 0;

    // Обработка функций ПЕРЕД заменой операторов
    sqlCondition = this.processFunctions(sqlCondition, parameters, paramIndex, parameterPrefix);
    paramIndex = Object.keys(parameters).length;

    // Обработка строковых значений в кавычках
    const stringRegex = /'(.*?)'/g;
    let match;
    const stringMatches: Array<{ match: string; value: string; index: number }> = [];
    while ((match = stringRegex.exec(sqlCondition)) !== null) {
      stringMatches.push({
        match: match[0],
        value: match[1],
        index: match.index,
      });
    }
    // Заменяем с конца, чтобы индексы не сбивались
    for (let i = stringMatches.length - 1; i >= 0; i--) {
      const item = stringMatches[i];
      const paramName = `${parameterPrefix}_${paramIndex++}`;
      parameters[paramName] = item.value;
      sqlCondition = sqlCondition.substring(0, item.index) + 
                     `@${paramName}` + 
                     sqlCondition.substring(item.index + item.match.length);
    }

    // Заменяем операторы OData на SQL
    sqlCondition = sqlCondition
      .replace(/\beq\b/gi, '=')
      .replace(/\bne\b/gi, '!=')
      .replace(/\bgt\b/gi, '>')
      .replace(/\bge\b/gi, '>=')
      .replace(/\blt\b/gi, '<')
      .replace(/\ble\b/gi, '<=')
      .replace(/\band\b/gi, 'AND')
      .replace(/\bor\b/gi, 'OR')
      .replace(/\bnot\b/gi, 'NOT');

    // Обработка числовых значений (только те, что не параметры и не в строках)
    const processedNumbers = new Set<string>();
    const numberMatches: Array<{ match: string; value: string; index: number }> = [];
    
    // Ищем числа, которые не являются частью параметров
    for (let i = 0; i < sqlCondition.length; i++) {
      const char = sqlCondition[i];
      if (char === '@' || char === "'") continue; // Пропускаем параметры и строки
      
      if (/\d/.test(char)) {
        const match = sqlCondition.substring(i).match(/^\d+\.?\d*/);
        if (match) {
          const value = match[0];
          if (!processedNumbers.has(value)) {
            processedNumbers.add(value);
            numberMatches.push({
              match: value,
              value: value,
              index: i,
            });
            i += value.length - 1;
          }
        }
      }
    }
    
    // Заменяем с конца, чтобы индексы не сбивались
    for (let i = numberMatches.length - 1; i >= 0; i--) {
      const item = numberMatches[i];
      const paramName = `${parameterPrefix}_${paramIndex++}`;
      parameters[paramName] = parseFloat(item.value);
      sqlCondition = sqlCondition.substring(0, item.index) + 
                     `@${paramName}` + 
                     sqlCondition.substring(item.index + item.match.length);
    }

    // Обработка имен полей - добавляем квадратные скобки
    // Ищем имена полей, которые еще не в квадратных скобках
    sqlCondition = sqlCondition.replace(/(^|[^\[\w@])([a-zA-Z_][a-zA-Z0-9_]*)(\s*[=><!]|$)/g, (match, prefix, field, suffix) => {
      // Проверяем, что это не ключевое слово SQL
      const sqlKeywords = ['AND', 'OR', 'NOT', 'LIKE', 'IN', 'IS', 'NULL', 'TRUE', 'FALSE'];
      if (sqlKeywords.includes(field.toUpperCase())) {
        return match;
      }
      return prefix + `[${field}]` + suffix;
    });

    return { sql: sqlCondition, parameters };
  }

  /**
   * Парсит параметр $orderby в SQL ORDER BY
   */
  parseOrderBy(orderby: string): string {
    if (!orderby) {
      return '';
    }

    // Разделяем по запятым
    const parts = orderby.split(',').map((part) => part.trim());

    return parts
      .map((part) => {
        // Проверяем наличие desc/asc
        const lowerPart = part.toLowerCase();
        if (lowerPart.endsWith(' desc')) {
          const field = part.slice(0, -5).trim();
          return `[${field}] DESC`;
        } else if (lowerPart.endsWith(' asc')) {
          const field = part.slice(0, -4).trim();
          return `[${field}] ASC`;
        } else {
          // По умолчанию ASC
          return `[${part}] ASC`;
        }
      })
      .join(', ');
  }

  /**
   * Обработка OData функций
   */
  private processFunctions(
    condition: string,
    parameters: Record<string, any>,
    startIndex: number,
    parameterPrefix: string = 'param',
  ): string {
    let result = condition;
    let paramIndex = startIndex;

    // contains(field, 'value')
    const containsRegex = /contains\(([^,]+),\s*'([^']+)'\)/gi;
    result = result.replace(containsRegex, (match, field, value) => {
      const paramName = `${parameterPrefix}_${paramIndex++}`;
      parameters[paramName] = `%${value}%`;
      const fieldName = field.trim();
      return `[${fieldName}] LIKE @${paramName}`;
    });

    // startswith(field, 'value')
    const startsWithRegex = /startswith\(([^,]+),\s*'([^']+)'\)/gi;
    result = result.replace(startsWithRegex, (match, field, value) => {
      const paramName = `${parameterPrefix}_${paramIndex++}`;
      parameters[paramName] = `${value}%`;
      const fieldName = field.trim();
      return `[${fieldName}] LIKE @${paramName}`;
    });

    // endswith(field, 'value')
    const endsWithRegex = /endswith\(([^,]+),\s*'([^']+)'\)/gi;
    result = result.replace(endsWithRegex, (match, field, value) => {
      const paramName = `${parameterPrefix}_${paramIndex++}`;
      parameters[paramName] = `%${value}`;
      const fieldName = field.trim();
      return `[${fieldName}] LIKE @${paramName}`;
    });

    // tolower/toupper - сохраняем квадратные скобки для полей
    result = result.replace(/tolower\(\[?([^\])]+)\]?\)/gi, 'LOWER([$1])');
    result = result.replace(/toupper\(\[?([^\])]+)\]?\)/gi, 'UPPER([$1])');

    // length
    result = result.replace(/length\(\[?([^\])]+)\]?\)/gi, 'LEN([$1])');

    return result;
  }

  /**
   * Парсит параметр $select в список полей
   */
  parseSelect(select: string): string[] {
    if (!select) {
      return [];
    }
    return select.split(',').map((field) => field.trim());
  }

  /**
   * Формирует список полей для SELECT
   */
  formatSelectFields(selectFields: string[], allFields: string[]): string {
    if (selectFields.length === 0) {
      return allFields.map((field) => `[${field}]`).join(', ');
    }

    // Фильтруем только существующие поля
    const validFields = selectFields.filter((field) =>
      allFields.includes(field),
    );
    
    if (validFields.length === 0) {
      return allFields.map((field) => `[${field}]`).join(', ');
    }

    return validFields.map((field) => `[${field}]`).join(', ');
  }
}

