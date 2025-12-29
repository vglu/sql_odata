# SQL OData REST API - Product Page

## Transform Your SQL Server Database into a Modern REST API

**SQL OData REST API** is a powerful, production-ready solution that exposes your Microsoft SQL Server databases as fully compliant OData 4.0 REST APIs. Built with Nest.js, it enables seamless integration with modern applications, Excel, Power BI, and any OData-compatible client.

---

## 🚀 Key Features

### **Full OData 4.0 Compliance**
- Complete support for OData 4.0 specification
- Excel and Power BI compatible out of the box
- EDMX metadata generation for automatic schema discovery
- Standard OData query parameters: `$filter`, `$orderby`, `$top`, `$skip`, `$select`, `$count`

### **Comprehensive CRUD Operations**
- **GET** - Retrieve data with advanced filtering and pagination
- **POST** - Create new records
- **PUT** - Full record updates
- **PATCH** - Partial record updates
- **DELETE** - Remove records
- **OPTIONS** - Full CORS support

### **Advanced Query Capabilities**
- **Filtering**: Complex queries with operators (eq, ne, gt, ge, lt, le, and, or, not, contains, startswith, endswith)
- **Sorting**: Multi-field ordering with ascending/descending
- **Pagination**: Efficient handling of large datasets with `$top` and `$skip`
- **Field Selection**: Return only required fields with `$select`
- **Count Queries**: Get total record counts for pagination

### **Security & Access Control**
- **Whitelist/Blacklist Tables**: Granular control over which tables are exposed
- **SQL Injection Protection**: Parameterized queries and table name validation
- **Data Validation**: Automatic validation of data before insert/update operations
- **Nullable Field Checks**: Prevents invalid NULL values in required fields

### **Developer Experience**
- **Swagger UI**: Interactive API documentation with automatic endpoint discovery
- **Structured Logging**: JSON-formatted logs for integration with monitoring systems (ELK, Loki, Grafana)
- **Metadata Caching**: Optimized performance with intelligent caching of table schemas
- **Views Support**: Optional inclusion of database views in API metadata

### **Performance Optimized**
- Single-query metadata generation (no N+1 problems)
- Connection pooling for efficient database usage
- In-memory caching of table structures
- Optimized SQL queries for better response times

---

## 💼 Use Cases

### **Business Intelligence & Analytics**
Connect Excel, Power BI, Tableau, and other BI tools directly to your SQL Server without complex setup. Your analysts can work with live data through familiar OData interfaces.

### **Microservices Integration**
Expose your database as a standardized REST API for integration with modern microservices architectures. Consistent OData interface across all services.

### **Mobile & Web Applications**
Build mobile and web applications that consume your database through a clean, standardized API. No need for custom backend development.

### **Data Federation**
Combine data from multiple SQL Server instances into a unified OData endpoint for centralized access and reporting.

### **API Gateway Pattern**
Use as a lightweight API gateway for legacy SQL Server databases, enabling modern API-first architectures without database migration.

---

## 🛠️ Technical Highlights

### **Built with Modern Stack**
- **Framework**: Nest.js (TypeScript-first Node.js framework)
- **Database**: Microsoft SQL Server (via `mssql` package)
- **Protocol**: OData 4.0 (OASIS standard)
- **Documentation**: Swagger/OpenAPI 3.0

### **Architecture**
- Modular, scalable architecture
- Dependency injection for easy testing and maintenance
- Middleware-based request/response handling
- Interceptor pattern for cross-cutting concerns
- Service layer for business logic separation

### **Easy Configuration**
Simple environment-based configuration:
```env
DB_SERVER=localhost
DB_NAME=your_database
DB_USER=sa
DB_PASSWORD=your_password
ODATA_TABLES_WHITELIST=Users,Products,Orders
LOG_FORMAT=json
ENABLE_SWAGGER=true
```

---

## 📊 Quick Start

### **1. Installation**
```bash
npm install
```

### **2. Configuration**
Create `.env` file with your database connection settings.

### **3. Run**
```bash
npm run start:dev
```

### **4. Access**
- **API**: `http://localhost:3000/api`
- **Metadata**: `http://localhost:3000/api/$metadata`
- **Swagger UI**: `http://localhost:3000/api-docs`

---

## 📈 Example Usage

### **Query Data**
```
GET /api/Products?$filter=Price gt 100&$orderby=Name asc&$top=10
```

### **Create Record**
```
POST /api/Products
{
  "Name": "New Product",
  "Price": 99.99,
  "CategoryId": 1
}
```

### **Update Record**
```
PATCH /api/Products(1)
{
  "Price": 89.99
}
```

---

## 🔒 Security Features

- ✅ SQL injection prevention through parameterized queries
- ✅ Table name validation to prevent unauthorized access
- ✅ Whitelist/blacklist support for table-level access control
- ✅ Input validation for data integrity
- ✅ CORS configuration for cross-origin requests
- ✅ Error handling that doesn't expose sensitive information

---

## 📚 Documentation

- **Quick Start Guide**: Get up and running in minutes
- **API Reference**: Complete endpoint documentation
- **OData Guide**: Learn how to use OData query parameters
- **Excel Integration**: Step-by-step Excel connection guide
- **Configuration Options**: All available settings explained

---

## 🎯 Benefits

### **For Developers**
- **Rapid Integration**: Connect any OData-compatible client in minutes
- **Type Safety**: Built with TypeScript for better development experience
- **Testable**: Modular architecture enables easy unit and integration testing
- **Documentation**: Auto-generated API docs with Swagger

### **For Business**
- **No Database Changes**: Works with existing SQL Server databases
- **Excel Ready**: Direct connection from Excel without additional tools
- **Cost Effective**: Open-source solution, no licensing fees
- **Fast Deployment**: Deploy in minutes, not weeks

### **For IT Operations**
- **Production Ready**: Built with enterprise-grade patterns
- **Monitoring Friendly**: Structured JSON logs for log aggregation
- **Scalable**: Designed to handle high-traffic scenarios
- **Maintainable**: Clean codebase following best practices

---

## 🌟 Why Choose SQL OData REST API?

1. **Standards Compliant**: Full OData 4.0 implementation ensures compatibility with any OData client
2. **Zero Configuration**: Works out of the box with your existing SQL Server databases
3. **Production Ready**: Built with security and performance in mind from day one
4. **Developer Friendly**: Comprehensive documentation, Swagger UI, and TypeScript support
5. **Flexible**: Whitelist/blacklist, views support, and extensive configuration options
6. **Open Source**: Free to use, modify, and distribute under MIT license

---

## 📞 Getting Started

Ready to transform your SQL Server into a modern REST API?

1. **Clone the repository**
2. **Install dependencies**: `npm install`
3. **Configure your database**: Set up `.env` file
4. **Run the server**: `npm run start:dev`
5. **Explore the API**: Visit `http://localhost:3000/api-docs`

**Start building modern integrations today!**

---

## 📄 License

MIT License - Use freely in commercial and non-commercial projects.

---

*Built with ❤️ using Nest.js and TypeScript*

