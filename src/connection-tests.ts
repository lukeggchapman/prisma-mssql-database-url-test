import { PrismaClient } from "@prisma/client";
import * as dotenv from "dotenv";
import { 
  createMssqlAdapterFromUrl, 
  createMssqlAdapterFromConfig, 
  createMssqlConfig,
  createDatabaseUrl,
  urlEncodePassword 
} from './adapter-utils.js';

dotenv.config();

interface TestScenario {
  name: string;
  password: string;
  port: number;
  databaseUrl: string;
  individualConfig?: {
    host: string;
    port: number;
    username: string;
    password: string;
    database: string;
    engine: string;
    encrypt: boolean;
    trustServerCertificate: boolean;
  };
}


export const testScenarios: TestScenario[] = [
  {
    name: "Basic Password",
    password: "YourStrong@Passw0rd",
    port: 1433,
    databaseUrl: createDatabaseUrl(
      "localhost",
      1433,
      "sa",
      "YourStrong@Passw0rd"
    ),
  },
  {
    name: "Curly Braces Password",
    password: "Strong{Pass}2024!",
    port: 1434,
    databaseUrl: createDatabaseUrl(
      "localhost",
      1434,
      "sa",
      "Strong{Pass}2024!"
    ),
  },
  {
    name: "URL Problematic Characters",
    password: "Pass@#%&2024",
    port: 1435,
    databaseUrl: createDatabaseUrl("localhost", 1435, "sa", "Pass@#%&2024"),
  },
  {
    name: "SQL Escape Characters",
    password: "Pass'Word\"2024",
    port: 1436,
    databaseUrl: createDatabaseUrl("localhost", 1436, "sa", "Pass'Word\"2024"),
  },
  {
    name: "Complex Special Characters",
    password: "P{a}s@s#w%o&r*d!2024",
    port: 1437,
    databaseUrl: createDatabaseUrl(
      "localhost",
      1437,
      "sa",
      "P{a}s@s#w%o&r*d!2024"
    ),
  },
];

export async function testDatabaseConnection(scenario: TestScenario): Promise<{
  success: boolean;
  error?: string;
  method: "database_url" | "individual_config";
}> {
  console.log(`\n🔍 Testing: ${scenario.name}`);
  console.log(`   Password: ${scenario.password}`);
  console.log(`   Port: ${scenario.port}`);

  // Test 1: DATABASE_URL approach with adapter
  console.log(`\n📝 Testing DATABASE_URL approach`);
  console.log(`   Database URL: ${scenario.databaseUrl}`);

  try {
    const adapter = await createMssqlAdapterFromUrl(scenario.databaseUrl);
    const prisma = new PrismaClient({
      adapter,
      log: ["error"],
    });

    // Test connection
    await prisma.$connect();

    // Test query
    await prisma.$queryRaw`SELECT 1 as test`;

    // Test table creation (if it doesn't exist)
    try {
      await prisma.connectionTest.findFirst();
    } catch (error) {
      // Table might not exist yet, that's ok for connection testing
      console.log(
        `   ℹ️  Tables not found (expected for fresh DB): ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }

    await prisma.$disconnect();

    console.log(`   ✅ DATABASE_URL approach successful`);
    return { success: true, method: "database_url" };
  } catch (error) {
    console.log(
      `   ❌ DATABASE_URL approach failed: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );

    // Test 2: Individual config approach
    console.log(`\n🔧 Testing individual config approach`);
    
    try {
      const config = createMssqlConfig(
        'localhost',
        scenario.port,
        'sa',
        scenario.password
      );
      
      console.log(`   Config: ${JSON.stringify({
        ...config,
        password: '[REDACTED]'
      }, null, 2)}`);
      
      const adapter = await createMssqlAdapterFromConfig(config);
      const prisma = new PrismaClient({
        adapter,
        log: ["error"],
      });

      // Test connection
      await prisma.$connect();

      // Test query
      await prisma.$queryRaw`SELECT 1 as test`;

      // Test table creation (if it doesn't exist)
      try {
        await prisma.connectionTest.findFirst();
      } catch (error) {
        // Table might not exist yet, that's ok for connection testing
        console.log(
          `   ℹ️  Tables not found (expected for fresh DB): ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }

      await prisma.$disconnect();

      console.log(`   ✅ Individual config approach successful`);
      return { success: true, method: "individual_config" };
    } catch (configError) {
      console.log(
        `   ❌ Individual config approach also failed: ${
          configError instanceof Error ? configError.message : "Unknown error"
        }`
      );
      
      return {
        success: false,
        error: `DATABASE_URL: ${error instanceof Error ? error.message : "Unknown error"}; Config: ${configError instanceof Error ? configError.message : "Unknown error"}`,
        method: "database_url",
      };
    }
  }
}

export async function runConnectionTests(): Promise<void> {
  console.log("🚀 Starting Database Connection Tests");
  console.log("=====================================\n");

  const results: Array<{
    scenario: string;
    success: boolean;
    error?: string;
    method: string;
  }> = [];

  for (const scenario of testScenarios) {
    const result = await testDatabaseConnection(scenario);

    results.push({
      scenario: scenario.name,
      success: result.success,
      error: result.error,
      method: result.method,
    });

    // Add delay between tests
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  console.log("\n📊 Test Results Summary");
  console.log("=======================");

  let successCount = 0;

  results.forEach((result) => {
    const status = result.success ? "✅" : "❌";
    console.log(`${status} ${result.scenario} (${result.method})`);
    if (result.error) {
      console.log(`     Error: ${result.error}`);
    }
    if (result.success) successCount++;
  });

  console.log(
    `\n🎯 Success Rate: ${successCount}/${results.length} (${Math.round(
      (successCount / results.length) * 100
    )}%)`
  );

  if (successCount === results.length) {
    console.log("🎉 All connection tests passed!");
  } else {
    console.log(
      "⚠️  Some connection tests failed. Check the Docker containers and password encoding."
    );
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runConnectionTests().catch(console.error);
}
