# Модель данных

## Обзор

Приложение использует динамическую модель данных, основанную на структуре базы данных MS SQL Server. Схема данных определяется автоматически при запуске приложения путем запроса к `INFORMATION_SCHEMA`.

## Структура базы данных

### Таблицы (Entity Types)

Приложение автоматически обнаруживает все таблицы типа `BASE TABLE` из всех схем базы данных, исключая системные схемы:
- `sys`
- `information_schema`
- `guest`

### Колонки (Properties)

Для каждой таблицы автоматически определяются:
- **Имя колонки** (Property Name)
- **Тип данных SQL** (исходный тип из базы данных)
- **OData тип** (преобразованный тип Edm)
- **Nullable** (может ли быть NULL)

### Преобразование типов данных

| SQL Server Type | OData Edm Type |
|----------------|----------------|
| int | Edm.Int32 |
| bigint | Edm.Int64 |
| smallint | Edm.Int16 |
| tinyint | Edm.Byte |
| bit | Edm.Boolean |
| decimal, numeric | Edm.Decimal |
| float | Edm.Double |
| real | Edm.Single |
| money, smallmoney | Edm.Decimal |
| date | Edm.Date |
| time | Edm.TimeOfDay |
| datetime, datetime2, datetimeoffset, smalldatetime | Edm.DateTimeOffset |
| char, varchar, nchar, nvarchar, text, ntext | Edm.String |
| uniqueidentifier | Edm.Guid |
| binary, varbinary, image, timestamp | Edm.Binary |
| (default) | Edm.String |

### Первичные ключи

Первая колонка в таблице (по порядку `ORDINAL_POSITION`) автоматически используется как первичный ключ для операций получения, обновления и удаления записей.

## Схема OData

### EntityContainer

Все таблицы экспонируются как EntitySet в EntityContainer с именем "Container".

### EntityType

Каждая таблица представляется как EntityType с:
- Именем, соответствующим имени таблицы
- Key элементом, указывающим на первую колонку
- Property элементами для всех колонок таблицы

### Namespace

По умолчанию используется namespace "Default" для всех EntityTypes.

## Пример структуры метаданных

```xml
<Schema Namespace="Default" xmlns="http://docs.oasis-open.org/odata/ns/edm">
  <EntityType Name="CustTable">
    <Key>
      <PropertyRef Name="RecId" />
    </Key>
    <Property Name="RecId" Type="Edm.Int64" Nullable="false" />
    <Property Name="AccountNum" Type="Edm.String" />
    <Property Name="Name" Type="Edm.String" />
  </EntityType>
  <EntityContainer Name="Container">
    <EntitySet Name="CustTable" EntityType="Default.CustTable" />
  </EntityContainer>
</Schema>
```

## Динамическое обнаружение

При каждом запросе метаданных приложение:
1. Запрашивает список всех таблиц из `INFORMATION_SCHEMA.TABLES`
2. Для каждой таблицы запрашивает колонки из `INFORMATION_SCHEMA.COLUMNS`
3. Преобразует SQL типы в OData Edm типы
4. Генерирует XML метаданные в формате EDMX

Это позволяет автоматически отражать изменения в схеме базы данных без изменения кода приложения.



