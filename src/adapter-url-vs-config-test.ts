/**
 * Adapter URL vs Config Test
 *
 * Tests whether the PrismaMssql adapter can use DATABASE_URL strings directly,
 * and whether CLI-specific escaping breaks the adapter's URL parsing.
 *
 * This addresses the theory: "CLI escaping isn't suitable for the adapter"
 */

import { PrismaMssql } from "@prisma/adapter-mssql";
import { PrismaClient } from "@prisma/client";
import {
  createMssqlConfig,
  escapeSqlServerPassword,
  createCliDatabaseUrl,
} from "./adapter-utils.js";

interface TestScenario {
  name: string;
  rawPassword: string;
  host: string;
  port: number;
}

const testScenarios: TestScenario[] = [
  {
    name: "Basic with @",
    rawPassword: "YourStrong@Passw0rd",
    host: "localhost",
    port: 1433,
  },
  {
    name: "Curly Braces",
    rawPassword: "Strong{Pass}2024!",
    host: "localhost",
    port: 1434,
  },
  {
    name: "Complex Special Characters",
    rawPassword: "P{a}s@s#w%o&r*d!2024",
    host: "localhost",
    port: 1437,
  },
];

interface TestResult {
  approach: string;
  success: boolean;
  error?: string;
}

async function testAdapterWithConfig(
  scenario: TestScenario
): Promise<TestResult> {
  console.log(`\n🔧 Testing Adapter with Individual Config`);
  console.log(`   Password: ${scenario.rawPassword}`);

  try {
    // Create config object directly
    const config = createMssqlConfig(
      scenario.host,
      scenario.port,
      "sa",
      scenario.rawPassword, // Raw password - no escaping
      "master"
    );

    console.log(`   Config approach: Direct object with raw password`);

    const adapter = new PrismaMssql(config);
    const prisma = new PrismaClient({
      adapter,
      log: ["error"],
    });

    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1 as test`;
    await prisma.$disconnect();

    console.log(`   ✅ Individual config: SUCCESS`);
    return { approach: "Individual Config", success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.log(`   ❌ Individual config: FAILED - ${errorMessage}`);
    return {
      approach: "Individual Config",
      success: false,
      error: errorMessage,
    };
  }
}

async function testAdapterWithRawDatabaseUrl(
  scenario: TestScenario
): Promise<TestResult> {
  console.log(`\n🌐 Testing Adapter with Raw DATABASE_URL (No Escaping)`);

  try {
    // Create URL without CLI escaping - what we'd use for adapter-only
    const rawDatabaseUrl = `sqlserver://${scenario.host}:${scenario.port};initial catalog=master;user=sa;password=${scenario.rawPassword};encrypt=true;trustServerCertificate=true;`;

    console.log(
      `   Raw URL: ${rawDatabaseUrl.replace(
        scenario.rawPassword,
        "[PASSWORD]"
      )}`
    );
    console.log(`   Approach: Raw password in URL (no escaping)`);

    // Test if adapter constructor accepts string directly
    let adapter: PrismaMssql;

    try {
      // This is the key test - can PrismaMssql accept a connection string directly?
      adapter = new PrismaMssql(rawDatabaseUrl as any);
    } catch (constructorError) {
      // If PrismaMssql doesn't accept strings directly, try parsing it
      const config = createMssqlConfigFromRawUrl(rawDatabaseUrl);
      adapter = new PrismaMssql(config);
      console.log(`   Note: Had to parse URL to config object`);
    }

    const prisma = new PrismaClient({
      adapter,
      log: ["error"],
    });

    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1 as test`;
    await prisma.$disconnect();

    console.log(`   ✅ Raw DATABASE_URL: SUCCESS`);
    return { approach: "Raw DATABASE_URL", success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.log(`   ❌ Raw DATABASE_URL: FAILED - ${errorMessage}`);
    return {
      approach: "Raw DATABASE_URL",
      success: false,
      error: errorMessage,
    };
  }
}

async function testAdapterWithCliEscapedUrl(
  scenario: TestScenario
): Promise<TestResult> {
  console.log(`\n🔧 Testing Adapter with CLI-Escaped DATABASE_URL`);

  try {
    // Create URL with CLI escaping - what CLI requires
    const cliEscapedUrl = createCliDatabaseUrl(
      scenario.host,
      scenario.port,
      "sa",
      scenario.rawPassword, // This will be escaped internally
      "master"
    );

    const escapedPassword = escapeSqlServerPassword(scenario.rawPassword);
    console.log(
      `   CLI Escaped URL: ${cliEscapedUrl.replace(
        escapedPassword,
        "[ESCAPED_PASSWORD]"
      )}`
    );
    console.log(
      `   Escaped password: ${scenario.rawPassword} → ${escapedPassword}`
    );
    console.log(`   Approach: CLI-escaped password in URL`);

    // Test if adapter can handle CLI-escaped URLs
    let adapter: PrismaMssql;

    try {
      // Try direct string first
      adapter = new PrismaMssql(cliEscapedUrl as any);
    } catch (constructorError) {
      // If direct string fails, try parsing it
      const config = createMssqlConfigFromRawUrl(cliEscapedUrl);
      adapter = new PrismaMssql(config);
      console.log(`   Note: Had to parse URL to config object`);
    }

    const prisma = new PrismaClient({
      adapter,
      log: ["error"],
    });

    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1 as test`;
    await prisma.$disconnect();

    console.log(`   ✅ CLI-Escaped DATABASE_URL: SUCCESS`);
    return { approach: "CLI-Escaped DATABASE_URL", success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.log(`   ❌ CLI-Escaped DATABASE_URL: FAILED - ${errorMessage}`);
    return {
      approach: "CLI-Escaped DATABASE_URL",
      success: false,
      error: errorMessage,
    };
  }
}

// Simple URL parser for raw SQL Server URLs
function createMssqlConfigFromRawUrl(url: string): any {
  const [hostPart, ...paramParts] = url.split(";");
  const hostMatch = hostPart.match(/sqlserver:\/\/([^:]+):?(\d+)?/);

  if (!hostMatch) {
    throw new Error("Invalid SQL Server URL format");
  }

  const host = hostMatch[1];
  const port = parseInt(hostMatch[2]) || 1433;

  const params: Record<string, string> = {};
  paramParts.forEach((param) => {
    const [key, value] = param.split("=");
    if (key && value) {
      params[key.toLowerCase().trim()] = value.trim();
    }
  });

  return {
    server: host,
    port,
    user: params.user || "sa",
    password: params.password || "",
    database: params["initial catalog"] || params.database || "master",
    options: {
      encrypt: params.encrypt === "true",
      trustServerCertificate: params.trustservercertificate === "true",
    },
  };
}

export async function runAdapterUrlVsConfigTest(): Promise<void> {
  console.log("🎯 Adapter URL vs Config Compatibility Test");
  console.log("==========================================\n");

  console.log('Theory: "CLI escaping isn\'t suitable for the adapter"');
  console.log("Testing: Whether adapter can use DATABASE_URL strings directly");
  console.log("Comparing: Individual config vs Raw URL vs CLI-escaped URL\n");

  const allResults: Array<{
    scenario: string;
    results: TestResult[];
  }> = [];

  for (const scenario of testScenarios) {
    console.log(`${"=".repeat(70)}`);
    console.log(
      `🧪 Testing Scenario: ${scenario.name} (${scenario.rawPassword})`
    );
    console.log(`${"=".repeat(70)}`);

    const results: TestResult[] = [];

    // Test 1: Individual Config (baseline)
    const configResult = await testAdapterWithConfig(scenario);
    results.push(configResult);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Test 2: Raw DATABASE_URL (no escaping)
    const rawUrlResult = await testAdapterWithRawDatabaseUrl(scenario);
    results.push(rawUrlResult);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    // Test 3: CLI-Escaped DATABASE_URL
    const cliUrlResult = await testAdapterWithCliEscapedUrl(scenario);
    results.push(cliUrlResult);

    allResults.push({
      scenario: scenario.name,
      results,
    });

    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  console.log("\n📊 Final Compatibility Results");
  console.log("==============================");

  let configSuccessCount = 0;
  let rawUrlSuccessCount = 0;
  let cliUrlSuccessCount = 0;
  const totalTests = allResults.length;

  allResults.forEach((scenarioResult) => {
    console.log(`\n${scenarioResult.scenario}:`);

    scenarioResult.results.forEach((result) => {
      const status = result.success ? "✅ SUCCESS" : "❌ FAILED";
      console.log(`  ${result.approach}: ${status}`);
      if (result.error) {
        console.log(`    Error: ${result.error}`);
      }

      // Count successes
      if (result.success) {
        if (result.approach === "Individual Config") configSuccessCount++;
        else if (result.approach === "Raw DATABASE_URL") rawUrlSuccessCount++;
        else if (result.approach === "CLI-Escaped DATABASE_URL")
          cliUrlSuccessCount++;
      }
    });
  });

  console.log(`\n🎯 Success Rates:`);
  console.log(
    `   Individual Config:        ${configSuccessCount}/${totalTests} (${Math.round(
      (configSuccessCount / totalTests) * 100
    )}%)`
  );
  console.log(
    `   Raw DATABASE_URL:         ${rawUrlSuccessCount}/${totalTests} (${Math.round(
      (rawUrlSuccessCount / totalTests) * 100
    )}%)`
  );
  console.log(
    `   CLI-Escaped DATABASE_URL: ${cliUrlSuccessCount}/${totalTests} (${Math.round(
      (cliUrlSuccessCount / totalTests) * 100
    )}%)`
  );

  console.log("\n💡 Conclusions:");

  if (
    configSuccessCount === totalTests &&
    rawUrlSuccessCount === totalTests &&
    cliUrlSuccessCount === totalTests
  ) {
    console.log(
      "   🎉 All approaches work equally well - no compatibility issues!"
    );
  } else if (cliUrlSuccessCount < rawUrlSuccessCount) {
    console.log(
      "   ⚠️  Theory CONFIRMED: CLI escaping breaks adapter URL parsing"
    );
    console.log(
      "   📈 Raw DATABASE_URL works better with adapter than CLI-escaped"
    );
  } else if (rawUrlSuccessCount < configSuccessCount) {
    console.log("   ⚠️  DATABASE_URL approach has issues with adapter");
    console.log("   📈 Individual config is more reliable than URL strings");
  } else {
    console.log(
      "   🤔 Mixed results - need to investigate specific failure patterns"
    );
  }

  console.log("\n🔍 Key Insights for Standardisation:");
  console.log("   - Individual config: Always works (baseline)");
  console.log("   - Raw URL: Shows if adapter can handle unescaped URLs");
  console.log(
    "   - CLI-escaped URL: Shows if same URL works for both CLI and adapter"
  );
  console.log(
    "   - This determines whether you can truly standardise on one DATABASE_URL format"
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runAdapterUrlVsConfigTest().catch(console.error);
}
