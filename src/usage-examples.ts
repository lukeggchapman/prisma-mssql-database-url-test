/**
 * Usage Examples for Prisma 7 MSSQL Adapter with Special Character Passwords
 *
 * This file demonstrates both approaches:
 * 1. DATABASE_URL approach (using URL encoding)
 * 2. Individual config approach (direct password handling)
 */

import { PrismaClient } from "@prisma/client";
import {
  createMssqlAdapterFromUrl,
  createMssqlAdapterFromConfig,
  createMssqlConfig,
  createDatabaseUrl,
} from "./adapter-utils.js";

// Example 1: Using DATABASE_URL with special characters (curly braces)
async function exampleDatabaseUrl() {
  console.log("🔗 Example: DATABASE_URL Approach");
  console.log("================================\n");

  const password = "Strong{Pass}2024!";
  const databaseUrl = createDatabaseUrl("localhost", 1434, "sa", password);

  console.log(`Original Password: ${password}`);
  console.log(`Database URL: ${databaseUrl}`);

  try {
    const adapter = await createMssqlAdapterFromUrl(databaseUrl);
    const prisma = new PrismaClient({ adapter });

    await prisma.$connect();
    const result =
      await prisma.$queryRaw`SELECT 'DATABASE_URL approach works!' as message`;
    console.log("✅ Success:", result);

    await prisma.$disconnect();
  } catch (error) {
    console.log(
      "❌ Error:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

// Example 2: Using individual config with special characters
async function exampleIndividualConfig() {
  console.log("\n🔧 Example: Individual Config Approach");
  console.log("=====================================\n");

  const password = "Strong{Pass}2024!";
  const config = createMssqlConfig("localhost", 1434, "sa", password);

  console.log(`Original Password: ${password}`);
  console.log("Config:", {
    ...config,
    password: "[REDACTED]", // Don't log the actual password
  });

  try {
    const adapter = await createMssqlAdapterFromConfig(config);
    const prisma = new PrismaClient({ adapter });

    await prisma.$connect();
    const result =
      await prisma.$queryRaw`SELECT 'Individual config approach works!' as message`;
    console.log("✅ Success:", result);

    await prisma.$disconnect();
  } catch (error) {
    console.log(
      "❌ Error:",
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

// Example 3: Testing multiple special character scenarios
async function exampleMultipleScenarios() {
  console.log("\n🧪 Example: Multiple Special Character Scenarios");
  console.log("===============================================\n");

  const testPasswords = [
    { name: "Curly Braces", password: "Strong{Pass}2024!", port: 1434 },
    { name: "URL Characters", password: "Pass@#%&(Test)2024", port: 1435 },
    { name: "SQL Characters", password: "Pass'Word\"2024", port: 1436 },
    { name: "Complex Mixed", password: "P{a}s@s#w%o&r*d!2024", port: 1437 },
  ];

  for (const test of testPasswords) {
    console.log(`\n--- Testing: ${test.name} ---`);
    console.log(`Password: ${test.password}`);

    // Try individual config approach
    try {
      const config = createMssqlConfig(
        "localhost",
        test.port,
        "sa",
        test.password
      );
      const adapter = await createMssqlAdapterFromConfig(config);
      const prisma = new PrismaClient({ adapter });

      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1 as test`;
      await prisma.$disconnect();

      console.log("✅ Individual config: SUCCESS");
    } catch (error) {
      console.log(
        "❌ Individual config: FAILED -",
        error instanceof Error ? error.message : "Unknown error"
      );
    }

    // Try DATABASE_URL approach
    try {
      const databaseUrl = createDatabaseUrl(
        "localhost",
        test.port,
        "sa",
        test.password
      );
      const adapter = await createMssqlAdapterFromUrl(databaseUrl);
      const prisma = new PrismaClient({ adapter });

      await prisma.$connect();
      await prisma.$queryRaw`SELECT 1 as test`;
      await prisma.$disconnect();

      console.log("✅ DATABASE_URL: SUCCESS");
    } catch (error) {
      console.log(
        "❌ DATABASE_URL: FAILED -",
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }
}

// Example 4: Using with Prisma CLI and prisma.config.ts
function examplePrismaCli() {
  console.log("\n🛠️  Example: Prisma CLI Usage with prisma.config.ts");
  console.log("=================================================\n");

  console.log(
    "The prisma.config.ts file now supports environment-based configuration:"
  );
  console.log("");
  console.log("# Use a specific test scenario:");
  console.log("PRISMA_TEST_SCENARIO=curly npx prisma db push");
  console.log("PRISMA_TEST_SCENARIO=complex npx prisma generate");
  console.log("PRISMA_TEST_SCENARIO=sqlChars npx prisma db pull");
  console.log("");
  console.log("# Or use a custom DATABASE_URL:");
  console.log(
    'DATABASE_URL="sqlserver://sa:MyPass%7B123%7D@localhost:1433;database=test" npx prisma db push'
  );
  console.log("");
  console.log("Available scenarios: basic, curly, urlChars, sqlChars, complex");
}

async function runAllExamples() {
  console.log("🎯 Prisma 7 MSSQL Adapter Usage Examples");
  console.log("========================================\n");

  // Note: These examples require Docker containers to be running
  console.log("📋 Prerequisites:");
  console.log("- Docker containers must be running (docker-compose up -d)");
  console.log("- Wait for containers to be healthy before running examples\n");

  try {
    await exampleDatabaseUrl();
    await exampleIndividualConfig();
    await exampleMultipleScenarios();
    examplePrismaCli();

    console.log("\n🎉 All examples completed!");
  } catch (error) {
    console.error("❌ Example execution failed:", error);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runAllExamples();
}
