# Production Database Configuration Guide

Based on testing with Prisma 7 MSSQL adapter and various deployment environments.

## 🎯 Recommended Approach: Environment-Based Configuration

### 1. Application Code Pattern

```typescript
// src/database.ts
import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '@prisma/client';

interface DatabaseConfig {
  server: string;
  port: number;
  user: string;
  password: string;
  database: string;
  options: {
    encrypt: boolean;
    trustServerCertificate: boolean;
    connectionTimeout?: number;
    requestTimeout?: number;
  };
}

function getDatabaseConfig(): DatabaseConfig {
  // Use individual config parameters - most reliable across all environments
  return {
    server: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '1433'),
    user: process.env.DB_USER || 'sa',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_DATABASE || 'myapp',
    options: {
      encrypt: process.env.DB_ENCRYPT !== 'false', // Default true for production
      trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
      connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '30000'),
      requestTimeout: parseInt(process.env.DB_REQUEST_TIMEOUT || '30000'),
    },
  };
}

export async function createPrismaClient(): Promise<PrismaClient> {
  const config = getDatabaseConfig();
  
  // Individual config approach - handles special characters reliably
  const adapter = new PrismaMssql(config);
  
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'error'] : ['error'],
  });
}
```

### 2. CLI Operations Configuration

```typescript
// prisma.config.ts
import { defineConfig } from 'prisma/config';

function buildDatabaseUrl(): string {
  const host = process.env.DB_HOST || 'localhost';
  const port = process.env.DB_PORT || '1433';
  const user = process.env.DB_USER || 'sa';
  const password = process.env.DB_PASSWORD || '';
  const database = process.env.DB_DATABASE || 'myapp';
  const encrypt = process.env.DB_ENCRYPT !== 'false' ? 'true' : 'false';
  const trustCert = process.env.DB_TRUST_SERVER_CERTIFICATE === 'true' ? 'true' : 'false';
  
  // Use semicolon format for Prisma CLI compatibility
  return `sqlserver://${host}:${port};database=${database};user=${user};password=${password};encrypt=${encrypt};trustServerCertificate=${trustCert}`;
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: buildDatabaseUrl(),
  },
});
```

## 🚀 Environment-Specific Configurations

### Local Development (.env.local)
```env
DB_HOST=localhost
DB_PORT=1433
DB_USER=sa
DB_PASSWORD=DevPassword123!
DB_DATABASE=myapp_dev
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true
DB_CONNECTION_TIMEOUT=5000
```

### Docker Compose (docker-compose.yml)
```yaml
version: '3.8'
services:
  app:
    environment:
      - DB_HOST=mssql
      - DB_PORT=1433
      - DB_USER=sa
      - DB_PASSWORD=${MSSQL_SA_PASSWORD}
      - DB_DATABASE=myapp
      - DB_ENCRYPT=false
      - DB_TRUST_SERVER_CERTIFICATE=true
  
  mssql:
    image: mcr.microsoft.com/mssql/server:2019-latest
    environment:
      - SA_PASSWORD=${MSSQL_SA_PASSWORD}
      - ACCEPT_EULA=Y
```

### ECS/Fargate (Task Definition)
```json
{
  "environment": [
    {
      "name": "DB_HOST",
      "value": "myapp-db.cluster-xyz.us-east-1.rds.amazonaws.com"
    },
    {
      "name": "DB_PORT", 
      "value": "1433"
    },
    {
      "name": "DB_USER",
      "value": "myapp_user"
    },
    {
      "name": "DB_DATABASE",
      "value": "myapp_prod"
    },
    {
      "name": "DB_ENCRYPT",
      "value": "true"
    },
    {
      "name": "DB_TRUST_SERVER_CERTIFICATE",
      "value": "false"
    }
  ],
  "secrets": [
    {
      "name": "DB_PASSWORD",
      "valueFrom": "arn:aws:ssm:us-east-1:123456789:parameter/myapp/db/password"
    }
  ]
}
```

### GitHub Actions CI/CD
```yaml
# .github/workflows/test.yml
name: Test
on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    
    services:
      mssql:
        image: mcr.microsoft.com/mssql/server:2019-latest
        env:
          SA_PASSWORD: TestPassword123!
          ACCEPT_EULA: Y
        ports:
          - 1433:1433
        options: >-
          --health-cmd "/opt/mssql-tools/bin/sqlcmd -S localhost -U sa -P TestPassword123! -Q 'SELECT 1'"
          --health-interval 10s
          --health-timeout 3s
          --health-retries 3
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run database migrations
        env:
          DB_HOST: localhost
          DB_PORT: 1433
          DB_USER: sa
          DB_PASSWORD: TestPassword123!
          DB_DATABASE: tempdb
          DB_ENCRYPT: false
          DB_TRUST_SERVER_CERTIFICATE: true
        run: npx prisma db push
        
      - name: Run tests
        env:
          DB_HOST: localhost
          DB_PORT: 1433
          DB_USER: sa
          DB_PASSWORD: TestPassword123!
          DB_DATABASE: tempdb
          DB_ENCRYPT: false
          DB_TRUST_SERVER_CERTIFICATE: true
        run: npm test
```

### Kubernetes Deployment
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: myapp
spec:
  template:
    spec:
      containers:
      - name: myapp
        env:
        - name: DB_HOST
          value: "mssql-service"
        - name: DB_PORT
          value: "1433"
        - name: DB_USER
          value: "myapp_user"
        - name: DB_DATABASE
          value: "myapp"
        - name: DB_ENCRYPT
          value: "true"
        - name: DB_TRUST_SERVER_CERTIFICATE
          value: "false"
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: password
```

## 🔐 Security Best Practices

### 1. Password Management
- **Never** commit passwords to version control
- Use different passwords per environment
- Rotate passwords regularly
- Use strong passwords (avoid simple special characters if CLI compatibility needed)

### 2. Secret Management by Environment

| Environment | Secret Management | Example |
|-------------|------------------|---------|
| **Local Dev** | `.env.local` files (gitignored) | `DB_PASSWORD=DevPass123` |
| **Docker** | Docker secrets or env files | `docker-compose --env-file .env.prod` |
| **ECS/Fargate** | AWS Systems Manager Parameter Store | `valueFrom: /myapp/db/password` |
| **Kubernetes** | Kubernetes Secrets | `secretKeyRef: db-credentials` |
| **CI/CD** | GitHub/GitLab Secrets | `secrets.DB_PASSWORD` |

### 3. Connection Security
```typescript
// Production-ready connection config
const productionConfig = {
  server: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '1433'),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
  options: {
    encrypt: true, // Always encrypt in production
    trustServerCertificate: false, // Validate certificates in production
    connectionTimeout: 30000,
    requestTimeout: 30000,
    pool: {
      max: 10,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  },
};
```

## 🧪 Testing Strategy

### 1. Unit Tests
```typescript
// Mock the database config for unit tests
jest.mock('./database', () => ({
  createPrismaClient: jest.fn().mockResolvedValue({
    // Mock Prisma client
  }),
}));
```

### 2. Integration Tests
```typescript
// Use test database with simple credentials
const testConfig = {
  server: 'localhost',
  port: 1433,
  user: 'sa',
  password: 'SimpleTestPass123', // Avoid complex chars in test environments
  database: 'test_db',
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};
```

## ⚠️ Common Pitfalls to Avoid

1. **Don't use DATABASE_URL with complex passwords** - CLI compatibility issues
2. **Don't hardcode connection strings** - Security and flexibility issues  
3. **Don't use the same password across environments** - Security risk
4. **Don't forget connection pooling** - Performance issues in production
5. **Don't skip encryption in production** - Security risk

## 🎯 Summary

**✅ Recommended:** Individual config parameters with environment variables
**❌ Avoid:** Complex passwords in DATABASE_URL for CLI operations
**🔐 Security:** Use proper secret management for each environment
**🧪 Testing:** Keep test passwords simple for CI/CD compatibility