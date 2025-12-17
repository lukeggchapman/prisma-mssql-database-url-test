/**
 * Runtime Escaping Test
 *
 * Tests two approaches for having ONE DATABASE_URL with runtime processing:
 *
 * Approach 1: Store raw DATABASE_URL, escape for CLI at runtime
 * Approach 2: Store escaped DATABASE_URL, unescape for adapter at runtime
 *
 * This tests whether we can truly standardise on one DATABASE_URL format.
 */

import { PrismaMssql } from "@prisma/adapter-mssql";
import { PrismaClient } from "@prisma/client";
import { exec } from "child_process";
import { promisify } from "util";
import { escapeSqlServerPassword } from "./adapter-utils.js";

const execAsync = promisify(exec);

interface TestScenario {
  name: string;
  rawPassword: string;
  port: number;
}

const testScenarios: TestScenario[] = [
  {
    name: "Basic with @",
    rawPassword: "YourStrong@Passw0rd",
    port: 1433,
  },
  {
    name: "Curly Braces",
    rawPassword: "Strong{Pass}2024!",
    port: 1434,
  },
  {
    name: "Complex Special Characters",
    rawPassword: "P{a}s@s#w%o&r*d!2024",
    port: 1437,
  },
];

// Utility functions for runtime escaping/unescaping
function createRawDatabaseUrl(
  host: string,
  port: number,
  user: string,
  password: string,
  database: string = "master"
): string {
  return `sqlserver://${host}:${port};initial catalog=${database};user=${user};password=${password};encrypt=true;trustServerCertificate=true;`;
}

function createEscapedDatabaseUrl(
  host: string,
  port: number,
  user: string,
  password: string,
  database: string = "master"
): string {
  const escapedPassword = escapeSqlServerPassword(password);
  return `sqlserver://${host}:${port};initial catalog=${database};user=${user};password=${escapedPassword};encrypt=true;trustServerCertificate=true;`;
}

function escapePasswordInUrl(databaseUrl: string): string {
  // Extract password from URL and escape it
  const match = databaseUrl.match(/password=([^;]+)/);
  if (!match) return databaseUrl;

  const rawPassword = match[1];
  const escapedPassword = escapeSqlServerPassword(rawPassword);

  return databaseUrl.replace(
    `password=${rawPassword}`,
    `password=${escapedPassword}`
  );
}

function unescapePasswordInUrl(databaseUrl: string): string {
  // Extract escaped password from URL and unescape it
  const match = databaseUrl.match(/password=([^;]+)/);
  if (!match) return databaseUrl;

  const escapedPassword = match[1];
  const rawPassword = unescapeSqlServerPassword(escapedPassword);

  return databaseUrl.replace(
    `password=${escapedPassword}`,
    `password=${rawPassword}`
  );
}

function unescapeSqlServerPassword(escapedPassword: string): string {
  // Reverse the escaping: {char} -> char
  return escapedPassword
    .replace(/{;}/g, ";")
    .replace(/{=}/g, "=")
    .replace(/{\[}/g, "[")
    .replace(/{\]}/g, "]")
    .replace(/{{}}/g, "{")
    .replace(/{}}/g, "}");
}

async function testApproach1(scenario: TestScenario): Promise<{
  success: boolean;
  adapterSuccess: boolean;
  cliSuccess: boolean;
  errors: string[];
}> {
  console.log(`\n🎯 APPROACH 1: Raw DATABASE_URL + Runtime Escaping for CLI`);
  console.log(`   Strategy: Store raw password, escape when needed for CLI`);

  const errors: string[] = [];

  // Step 1: Create raw DATABASE_URL (what we'd store in environment)
  const rawDatabaseUrl = createRawDatabaseUrl(
    "localhost",
    scenario.port,
    "sa",
    scenario.rawPassword
  );
  console.log(
    `   Raw URL: ${rawDatabaseUrl.replace(
      scenario.rawPassword,
      "[RAW_PASSWORD]"
    )}`
  );

  // Step 2: Test adapter with raw URL directly (no parsing)
  console.log(`\n   🔌 Testing adapter with raw URL string directly...`);
  let adapterSuccess = false;
  try {
    // Pass the URL string directly to PrismaMssql
    const adapter = new PrismaMssql(rawDatabaseUrl);
    const prisma = new PrismaClient({ adapter, log: ["error"] });

    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1 as test`;
    await prisma.$disconnect();

    console.log(`      ✅ Adapter with raw URL string: SUCCESS`);
    adapterSuccess = true;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.log(
      `      ❌ Adapter with raw URL string: FAILED - ${errorMessage}`
    );
    errors.push(`Adapter: ${errorMessage}`);
  }

  // Step 3: Test CLI with escaped URL (escape at runtime)
  console.log(`\n   🔧 Testing CLI with runtime-escaped URL...`);
  let cliSuccess = false;
  try {
    const escapedUrlForCli = escapePasswordInUrl(rawDatabaseUrl);
    console.log(
      `      Escaped for CLI: ${escapedUrlForCli.replace(
        escapeSqlServerPassword(scenario.rawPassword),
        "[ESCAPED_PASSWORD]"
      )}`
    );

    const env = {
      ...process.env,
      DATABASE_URL: escapedUrlForCli,
    };

    const { stdout } = await execAsync(
      "npx prisma db push --accept-data-loss",
      {
        timeout: 30000,
        env,
      }
    );

    console.log(`      ✅ CLI with escaped URL: SUCCESS`);
    cliSuccess = true;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.log(`      ❌ CLI with escaped URL: FAILED - ${errorMessage}`);
    errors.push(`CLI: ${errorMessage}`);
  }

  const success = adapterSuccess && cliSuccess;
  console.log(
    `\n   🎯 Approach 1 Result: ${
      success ? "✅ SUCCESS" : "❌ FAILED"
    } (Adapter: ${adapterSuccess ? "✅" : "❌"}, CLI: ${
      cliSuccess ? "✅" : "❌"
    })`
  );

  return { success, adapterSuccess, cliSuccess, errors };
}

async function testApproach2(scenario: TestScenario): Promise<{
  success: boolean;
  adapterSuccess: boolean;
  cliSuccess: boolean;
  errors: string[];
}> {
  console.log(
    `\n🎯 APPROACH 2: Escaped DATABASE_URL + Runtime Unescaping for Adapter`
  );
  console.log(
    `   Strategy: Store escaped password, unescape when needed for adapter`
  );

  const errors: string[] = [];

  // Step 1: Create escaped DATABASE_URL (what we'd store in environment)
  const escapedDatabaseUrl = createEscapedDatabaseUrl(
    "localhost",
    scenario.port,
    "sa",
    scenario.rawPassword
  );
  console.log(
    `   Escaped URL: ${escapedDatabaseUrl.replace(
      escapeSqlServerPassword(scenario.rawPassword),
      "[ESCAPED_PASSWORD]"
    )}`
  );

  // Step 2: Test CLI with escaped URL (should work)
  console.log(`\n   🔧 Testing CLI with escaped URL...`);
  let cliSuccess = false;
  try {
    const env = {
      ...process.env,
      DATABASE_URL: escapedDatabaseUrl,
    };

    const { stdout } = await execAsync(
      "npx prisma db push --accept-data-loss",
      {
        timeout: 30000,
        env,
      }
    );

    console.log(`      ✅ CLI with escaped URL: SUCCESS`);
    cliSuccess = true;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.log(`      ❌ CLI with escaped URL: FAILED - ${errorMessage}`);
    errors.push(`CLI: ${errorMessage}`);
  }

  // Step 3: Test adapter with unescaped URL string directly (unescape at runtime)
  console.log(
    `\n   🔌 Testing adapter with runtime-unescaped URL string directly...`
  );
  let adapterSuccess = false;
  try {
    const unescapedUrlForAdapter = unescapePasswordInUrl(escapedDatabaseUrl);
    console.log(
      `      Unescaped for adapter: ${unescapedUrlForAdapter.replace(
        scenario.rawPassword,
        "[RAW_PASSWORD]"
      )}`
    );

    // Pass the unescaped URL string directly to PrismaMssql
    const adapter = new PrismaMssql(unescapedUrlForAdapter);
    const prisma = new PrismaClient({ adapter, log: ["error"] });

    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1 as test`;
    await prisma.$disconnect();

    console.log(`      ✅ Adapter with unescaped URL string: SUCCESS`);
    adapterSuccess = true;
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    console.log(
      `      ❌ Adapter with unescaped URL string: FAILED - ${errorMessage}`
    );
    errors.push(`Adapter: ${errorMessage}`);
  }

  const success = adapterSuccess && cliSuccess;
  console.log(
    `\n   🎯 Approach 2 Result: ${
      success ? "✅ SUCCESS" : "❌ FAILED"
    } (Adapter: ${adapterSuccess ? "✅" : "❌"}, CLI: ${
      cliSuccess ? "✅" : "❌"
    })`
  );

  return { success, adapterSuccess, cliSuccess, errors };
}

export async function runRuntimeEscapingTest(): Promise<void> {
  console.log("🚀 Runtime Escaping Approaches Test");
  console.log("===================================\n");

  console.log("Testing two standardisation approaches:");
  console.log("1. Store raw DATABASE_URL → escape for CLI at runtime");
  console.log(
    "2. Store escaped DATABASE_URL → unescape for adapter at runtime\n"
  );

  interface ApproachResults {
    scenario: string;
    approach1: {
      success: boolean;
      adapterSuccess: boolean;
      cliSuccess: boolean;
      errors: string[];
    };
    approach2: {
      success: boolean;
      adapterSuccess: boolean;
      cliSuccess: boolean;
      errors: string[];
    };
  }

  const allResults: ApproachResults[] = [];

  for (const scenario of testScenarios) {
    console.log(`${"=".repeat(80)}`);
    console.log(`🧪 Testing: ${scenario.name} (${scenario.rawPassword})`);
    console.log(`${"=".repeat(80)}`);

    // Test Approach 1
    const approach1Result = await testApproach1(scenario);
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Test Approach 2
    const approach2Result = await testApproach2(scenario);

    allResults.push({
      scenario: scenario.name,
      approach1: approach1Result,
      approach2: approach2Result,
    });

    await new Promise((resolve) => setTimeout(resolve, 3000));
  }

  // Generate comprehensive summary
  console.log("\n📊 Runtime Escaping Results Summary");
  console.log("===================================");

  let approach1SuccessCount = 0;
  let approach2SuccessCount = 0;
  const totalTests = allResults.length;

  allResults.forEach((result) => {
    console.log(`\n${result.scenario}:`);

    const app1Icon = result.approach1.success ? "✅" : "❌";
    const app2Icon = result.approach2.success ? "✅" : "❌";

    console.log(
      `  Approach 1 (Raw → Escape):     ${app1Icon} (Adapter: ${
        result.approach1.adapterSuccess ? "✅" : "❌"
      }, CLI: ${result.approach1.cliSuccess ? "✅" : "❌"})`
    );
    console.log(
      `  Approach 2 (Escaped → Unescape): ${app2Icon} (Adapter: ${
        result.approach2.adapterSuccess ? "✅" : "❌"
      }, CLI: ${result.approach2.cliSuccess ? "✅" : "❌"})`
    );

    if (result.approach1.errors.length > 0) {
      console.log(
        `    Approach 1 errors: ${result.approach1.errors.join(", ")}`
      );
    }
    if (result.approach2.errors.length > 0) {
      console.log(
        `    Approach 2 errors: ${result.approach2.errors.join(", ")}`
      );
    }

    if (result.approach1.success) approach1SuccessCount++;
    if (result.approach2.success) approach2SuccessCount++;
  });

  console.log("\n🎯 Final Standardisation Results:");
  console.log(
    `   Approach 1 (Raw → Escape):       ${approach1SuccessCount}/${totalTests} (${Math.round(
      (approach1SuccessCount / totalTests) * 100
    )}%)`
  );
  console.log(
    `   Approach 2 (Escaped → Unescape): ${approach2SuccessCount}/${totalTests} (${Math.round(
      (approach2SuccessCount / totalTests) * 100
    )}%)`
  );

  console.log("\n💡 Conclusions:");

  if (approach1SuccessCount === totalTests) {
    console.log(
      "   🎉 APPROACH 1 WORKS: You CAN standardise using raw DATABASE_URL!"
    );
    console.log(
      "   ✅ Store raw passwords, escape at runtime for CLI operations"
    );
    console.log(
      "   📝 Implementation: Raw DATABASE_URL → escape when calling Prisma CLI"
    );
  } else if (approach2SuccessCount === totalTests) {
    console.log(
      "   🎉 APPROACH 2 WORKS: You CAN standardise using escaped DATABASE_URL!"
    );
    console.log(
      "   ✅ Store escaped passwords, unescape at runtime for adapter"
    );
    console.log(
      "   📝 Implementation: Escaped DATABASE_URL → unescape when creating adapter"
    );
  } else if (approach1SuccessCount > approach2SuccessCount) {
    console.log("   📈 Approach 1 (Raw → Escape) is MORE reliable");
    console.log(
      "   💡 Consider using raw DATABASE_URL with runtime escaping for CLI"
    );
  } else if (approach2SuccessCount > approach1SuccessCount) {
    console.log("   📈 Approach 2 (Escaped → Unescape) is MORE reliable");
    console.log(
      "   💡 Consider using escaped DATABASE_URL with runtime unescaping for adapter"
    );
  } else {
    console.log("   ❌ Both approaches have issues with special characters");
    console.log("   🏗️  Stick with separate configuration approaches");
  }

  console.log("\n🔍 Implementation Guidance:");
  console.log("   - If one approach works 100%: Use that for standardisation");
  console.log(
    "   - Runtime processing allows ONE DATABASE_URL to work for both CLI and adapter"
  );
  console.log(
    "   - This solves the standardisation challenge with minimal complexity"
  );
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runRuntimeEscapingTest().catch(console.error);
}
