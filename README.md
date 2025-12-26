# SQL OData REST API

REST API для доступа к MS SQL Server с поддержкой OData операций. Реализовано на Nest.js.

## Возможности

- ✅ **GET** - получение данных с поддержкой фильтрации, сортировки, пагинации
- ✅ **POST** - создание новых записей
- ✅ **PUT** - полное обновление записей
- ✅ **PATCH** - частичное обновление записей
- ✅ **DELETE** - удаление записей
- ✅ **OPTIONS** - поддержка CORS
- ✅ **$filter** - фильтрация данных (eq, ne, gt, ge, lt, le, and, or, not, contains, startswith, endswith)
- ✅ **$orderby** - сортировка данных
- ✅ **$top** - ограничение количества записей
- ✅ **$skip** - пропуск записей (пагинация)
- ✅ **$select** - выбор конкретных полей
- ✅ **$count** - получение общего количества записей
- ✅ **Whitelist/Blacklist таблиц** - контроль доступа к таблицам
- ✅ **Поддержка Views** - опциональное включение views в метаданные
- ✅ **Валидация данных** - проверка данных перед вставкой/обновлением
- ✅ **Swagger UI** - интерактивная документация API
- ✅ **Структурированное логирование** - JSON формат логов для интеграции с системами мониторинга
- ✅ **Оптимизация метаданных** - один запрос вместо N+1 для получения структуры таблиц

## Установка

1. Установите зависимости:
```bash
npm install
```

2. Создайте файл `.env` на основе `.env.example` и настройте подключение к базе данных:
```
DB_SERVER=localhost
DB_PORT=1433
DB_NAME=your_database
DB_USER=sa
DB_PASSWORD=your_password
DB_ENCRYPT=false
PORT=3000

# OData настройки (опционально)
# ODATA_TABLES_WHITELIST=Users,Products,Orders  # Только указанные таблицы
# ODATA_TABLES_BLACKLIST=SensitiveData          # Исключить указанные таблицы
ODATA_INCLUDE_VIEWS=false                        # Включить Views в метаданные
LOG_FORMAT=text                                  # Формат логов: text или json
ENABLE_SWAGGER=true                              # Включить Swagger UI
```

3. Запустите приложение:
```bash
# Режим разработки
npm run start:dev

# Продакшн режим
npm run build
npm run start:prod
```

## Использование API

### Базовый URL
```
http://localhost:3000/api
```

### Примеры запросов

#### 1. Получить список всех доступных таблиц (метаданные)
```http
GET /api/$metadata
```

Ответ:
```json
{
  "value": [
    {
      "name": "users",
      "schema": "dbo"
    },
    {
      "name": "products",
      "schema": "dbo"
    }
  ]
}
```

#### 2. Получить все записи из таблицы
```http
GET /api/users
```

#### 3. Фильтрация данных
```http
GET /api/users?$filter=age gt 18 and name eq 'John'
GET /api/users?$filter=contains(email, '@gmail.com')
GET /api/users?$filter=startswith(name, 'A')
```

#### 4. Сортировка
```http
GET /api/users?$orderby=name asc, age desc
```

#### 5. Пагинация
```http
GET /api/users?$top=10&$skip=20
```

#### 6. Выбор полей
```http
GET /api/users?$select=id,name,email
```

#### 7. Подсчет записей
```http
GET /api/users?$filter=age gt 18&$count=true
```

#### 8. Комбинация параметров
```http
GET /api/users?$filter=age gt 18&$orderby=name asc&$top=10&$skip=0&$count=true
```

#### 9. Получить одну запись по ключу
```http
GET /api/users/123
```

#### 10. Создать новую запись
```http
POST /api/users
Content-Type: application/json

{
  "name": "John Doe",
  "email": "john@example.com",
  "age": 30
}
```

#### 11. Полное обновление записи
```http
PUT /api/users/123
Content-Type: application/json

{
  "name": "John Updated",
  "email": "john.updated@example.com",
  "age": 31
}
```

#### 12. Частичное обновление записи
```http
PATCH /api/users/123
Content-Type: application/json

{
  "age": 32
}
```

#### 13. Удаление записи
```http
DELETE /api/users/123
```

## Поддерживаемые операторы фильтрации

- `eq` - равно (=)
- `ne` - не равно (!=)
- `gt` - больше (>)
- `ge` - больше или равно (>=)
- `lt` - меньше (<)
- `le` - меньше или равно (<=)
- `and` - логическое И
- `or` - логическое ИЛИ
- `not` - логическое НЕТ

### Функции фильтрации

- `contains(field, 'value')` - содержит подстроку
- `startswith(field, 'value')` - начинается с
- `endswith(field, 'value')` - заканчивается на
- `tolower(field)` - преобразование в нижний регистр
- `toupper(field)` - преобразование в верхний регистр
- `length(field)` - длина строки

## Примеры фильтров

```
# Простые сравнения
$filter=age gt 25
$filter=name eq 'John'
$filter=status ne 'inactive'

# Комбинации
$filter=age gt 18 and age lt 65
$filter=status eq 'active' or status eq 'pending'

# Строковые функции
$filter=contains(email, '@gmail')
$filter=startswith(name, 'A')
$filter=length(name) gt 5

# Сложные условия
$filter=(age gt 18 and age lt 65) and (status eq 'active' or role eq 'admin')
```

## Дополнительные функции

### Whitelist/Blacklist таблиц

Вы можете ограничить доступ к таблицам через переменные окружения:

```env
# Разрешить только указанные таблицы
ODATA_TABLES_WHITELIST=Users,Products,Orders

# Или исключить определенные таблицы
ODATA_TABLES_BLACKLIST=SensitiveData,Passwords
```

### Swagger UI

Интерактивная документация API доступна по адресу: `http://localhost:3000/api-docs`

Отключить можно через переменную окружения:
```env
ENABLE_SWAGGER=false
```

### Структурированное логирование

Для интеграции с системами мониторинга (ELK, Loki, etc.) включите JSON формат логов:

```env
LOG_FORMAT=json
```

### Поддержка Views

Включите Views в метаданные OData:

```env
ODATA_INCLUDE_VIEWS=true
```

## Безопасность

- Имена таблиц валидируются для защиты от SQL инъекций
- Параметризованные запросы для всех значений
- Валидация входных данных перед вставкой/обновлением
- Whitelist/Blacklist для контроля доступа к таблицам
- Проверка nullable полей при создании записей

## Структура проекта

```
src/
├── database/          # Модуль работы с БД
│   ├── database.module.ts
│   └── database.service.ts
├── odata/            # OData API
│   ├── odata.module.ts
│   ├── odata.controller.ts
│   ├── odata.service.ts
│   └── odata-parser.service.ts
├── app.module.ts     # Корневой модуль
└── main.ts           # Точка входа
```

## Лицензия

MIT

