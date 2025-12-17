# Database Connection Tester

A comprehensive testing environment for resolving Prisma 7 MSSQL adapter configuration issues with `DATABASE_URL` and special character passwords.

## Problem Statement

When using Prisma 7 with the MSSQL adapter, there are challenges with:
- Using `DATABASE_URL` for both CLI operations (migrations, introspections) and client connections
- Handling passwords with special characters (especially `{` and `}`)
- Choosing between `DATABASE_URL` vs individual configuration parameters

## Test Scenarios

This project tests various password patterns:

1. **Basic Password**: `YourStrong@Passw0rd`
2. **Curly Braces**: `Strong{Pass}2024!` 
3. **URL Problematic**: `Pass@#%&2024`
4. **SQL Escape Chars**: `Pass'Word"2024`
5. **Complex Mixed**: `P{a}s@s#w%o&r*d!2024`

## Quick Start

```bash
# 1. Install dependencies
pnpm install

# 2. Copy environment file
cp .env.example .env

# 3. Start databases and run all tests
pnpm test
```

## Manual Setup

```bash
# Start Docker containers
docker-compose up -d

# Wait for containers to be healthy (check with)
docker-compose ps

# Run specific tests
pnpm test:connection    # Test database connections only  
pnpm test:migration     # Test Prisma migrations only

# Individual container testing
docker-compose logs mssql-curly  # Check specific container
```

## Project Structure

```
├── docker-compose.yml          # MSSQL containers with different passwords
├── .env.example               # Environment variables and test scenarios
├── prisma/
│   └── schema.prisma          # Test database schema
├── src/
│   ├── connection-tests.ts    # Database connection testing
│   ├── migration-tests.ts     # Prisma CLI operations testing
│   └── index.ts              # Interactive mode
└── scripts/
    └── run-all-tests.ts       # Main test orchestrator
```

## Docker Services

The setup creates 5 MSSQL containers on different ports:

- `mssql-basic` (1433): Basic password testing
- `mssql-curly` (1434): Curly brace password `{}`  
- `mssql-url-chars` (1435): URL problematic characters `@#%&`
- `mssql-sql-chars` (1436): SQL escape characters `'"`
- `mssql-complex` (1437): Complex mixed characters

## URL Encoding Reference

The tester automatically handles URL encoding for `DATABASE_URL`:

| Character | Encoded |
|-----------|---------|
| `{`       | `%7B`   |
| `}`       | `%7D`   |
| `@`       | `%40`   |
| `#`       | `%23`   |
| `%`       | `%25`   |
| `&`       | `%26`   |
| `'`       | `%27`   |
| `"`       | `%22`   |

## Expected Outcomes

- Identify which special characters work reliably with `DATABASE_URL` encoding
- Document the most reliable configuration approach for your main project
- Provide utility functions for proper URL encoding
- Test both Prisma Client connections and CLI operations

## Troubleshooting

```bash
# Check container health
docker-compose ps

# View container logs
docker-compose logs mssql-curly

# Reset containers
docker-compose down -v
docker-compose up -d

# Clean restart
pnpm test
```

## Key Files

- `src/connection-tests.ts` - Database connection testing with various password encodings
- `src/migration-tests.ts` - Prisma CLI operations (`db push`, `generate`, `db pull`)
- `scripts/run-all-tests.ts` - Orchestrates all testing scenarios
- `docker-compose.yml` - Multi-container setup with different password scenarios