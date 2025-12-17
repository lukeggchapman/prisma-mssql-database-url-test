import { defineConfig, env } from "prisma/config";

// Password escaping function for CLI (same as in adapter-utils.ts)
function escapeSqlServerPassword(password: string): string {
  // CLI-specific escaping: wrap problematic characters in curly braces
  return password.replace(/[;=[\]{}]/g, (char: string) => `{${char}}`);
}

function createCliDatabaseUrl(
  host: string,
  port: number,
  username: string,
  password: string,
  database: string = "master",
  engine: string = "sqlserver"
): string {
  const escapedPassword = escapeSqlServerPassword(password);
  return `${engine}://${host}:${String(
    port
  )};initial catalog=${database};user=${username};password=${escapedPassword};encrypt=true;trustServerCertificate=true;`;
}

// Test scenario URLs using CLI-specific escaping
const testScenarios = {
  basic: createCliDatabaseUrl("localhost", 1433, "sa", "YourStrong@Passw0rd"),
  curly: createCliDatabaseUrl("localhost", 1434, "sa", "Strong{Pass}2024!"),
  urlChars: createCliDatabaseUrl("localhost", 1435, "sa", "Pass@#%&(Test)2024"),
  sqlChars: createCliDatabaseUrl("localhost", 1436, "sa", "Pass'Word\"2024"),
  complex: createCliDatabaseUrl(
    "localhost",
    1437,
    "sa",
    "P{a}s@s#w%o&r*d!2024"
  ),
};

// Function to get the appropriate database URL
function getDatabaseUrl(): string {
  // If DATABASE_URL is set, use it
  const envUrl = process.env.DATABASE_URL;
  if (envUrl) {
    return envUrl;
  }

  // Check for test scenario selector
  const testScenario = process.env.PRISMA_TEST_SCENARIO;
  if (
    testScenario &&
    testScenarios[testScenario as keyof typeof testScenarios]
  ) {
    return testScenarios[testScenario as keyof typeof testScenarios];
  }

  // Default to basic scenario
  console.log(
    "⚠️  No DATABASE_URL or PRISMA_TEST_SCENARIO set, using basic scenario"
  );
  console.log(
    "   Available scenarios: basic, curly, urlChars, sqlChars, complex"
  );
  console.log("   Set PRISMA_TEST_SCENARIO=<scenario> to use a specific one");

  return testScenarios.basic;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: getDatabaseUrl(),
  },
});
