# Quick Start Guide

## Быстрый старт

### Предварительные требования

- Node.js 20.x или выше
- Microsoft SQL Server (любая версия)
- npm или yarn

### Установка

1. **Клонируйте репозиторий и установите зависимости:**

```bash
npm install
```

2. **Настройте переменные окружения:**

Создайте файл `.env` в корне проекта на основе `env.example`:

```env
DB_SERVER=localhost
DB_PORT=1433
DB_NAME=your_database
DB_USER=sa
DB_PASSWORD=your_password
DB_ENCRYPT=false
PORT=3000
```

3. **Запустите приложение:**

```bash
# Режим разработки (с hot reload)
npm run start:dev

# Продакшн режим
npm run build
npm run start:prod
```

Приложение будет доступно по адресу: `http://localhost:3000`

## Тестирование API

### 1. Проверка сервиса

```bash
curl http://localhost:3000/
```

### 2. Получение метаданных

```bash
curl http://localhost:3000/$metadata
```

Или через браузер: `http://localhost:3000/$metadata`

### 3. Получение данных из таблицы

```bash
# Все записи
curl http://localhost:3000/api/YourTable

# С фильтрацией
curl "http://localhost:3000/api/YourTable?\$filter=age gt 18"

# С пагинацией
curl "http://localhost:3000/api/YourTable?\$top=10&\$skip=20"

# С сортировкой
curl "http://localhost:3000/api/YourTable?\$orderby=name asc"
```

### 4. Получение одной записи

```bash
curl http://localhost:3000/api/YourTable/123
```

### 5. Создание записи

```bash
curl -X POST http://localhost:3000/api/YourTable \
  -H "Content-Type: application/json" \
  -d '{"field1": "value1", "field2": "value2"}'
```

### 6. Обновление записи

```bash
# Полное обновление (PUT)
curl -X PUT http://localhost:3000/api/YourTable/123 \
  -H "Content-Type: application/json" \
  -d '{"field1": "new_value1", "field2": "new_value2"}'

# Частичное обновление (PATCH)
curl -X PATCH http://localhost:3000/api/YourTable/123 \
  -H "Content-Type: application/json" \
  -d '{"field1": "updated_value"}'
```

### 7. Удаление записи

```bash
curl -X DELETE http://localhost:3000/api/YourTable/123
```

## Интеграция с Excel

1. Откройте Excel
2. Перейдите на вкладку **Data** → **Get Data** → **From Other Sources** → **From OData Feed**
3. Введите URL: `http://localhost:3000`
4. Excel автоматически загрузит метаданные и покажет доступные таблицы
5. Выберите нужную таблицу и нажмите **Load**

## Примеры OData фильтров

### Простые условия

```
$filter=age gt 18
$filter=name eq 'John'
$filter=status ne 'inactive'
```

### Комбинированные условия

```
$filter=age gt 18 and age lt 65
$filter=status eq 'active' or role eq 'admin'
$filter=(age gt 18 and age lt 65) and (status eq 'active' or role eq 'admin')
```

### Строковые функции

```
$filter=contains(email, '@gmail.com')
$filter=startswith(name, 'A')
$filter=endswith(name, 'son')
$filter=length(name) gt 5
```

### Комбинации параметров

```
$filter=age gt 18&$orderby=name asc&$top=10&$skip=0&$count=true
```

## Логирование

Все запросы логируются с детальной информацией:
- Метод, URL, IP адрес
- Параметры запроса
- SQL запросы
- Время выполнения
- Размер ответа

Логи выводятся в консоль в формате:
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[1704901234567-abc123] → INCOMING REQUEST
[1704901234567-abc123] Method: GET
[1704901234567-abc123] URL: /api/YourTable?$top=10
...
```

## Troubleshooting

### Ошибка подключения к БД

- Проверьте, что SQL Server запущен
- Убедитесь, что порт 1433 доступен
- Проверьте учетные данные в `.env`

### Таблица не найдена

- Убедитесь, что таблица существует в указанной базе данных
- Проверьте, что имя таблицы написано правильно (регистр может иметь значение)
- Убедитесь, что таблица не в системной схеме (sys, information_schema)

### Ошибка "Недопустимое имя таблицы"

- Имя таблицы должно начинаться с буквы или подчеркивания
- Может содержать только буквы, цифры и подчеркивания
- Не должно содержать специальных символов

### Excel не может подключиться

- Убедитесь, что сервер доступен по сети
- Проверьте, что CORS настроен правильно
- Попробуйте использовать `http://localhost:3000/$metadata` напрямую в браузере


