import { defineConfig, env } from "prisma/config";

// Test scenario URLs for different password patterns
const testScenarios = {
  basic: "sqlserver://localhost:1433;database=master;user=sa;password=YourStrong@Passw0rd;encrypt=true;trustServerCertificate=true",
  curly: "sqlserver://localhost:1434;database=master;user=sa;password=Strong{Pass}2024!;encrypt=true;trustServerCertificate=true", 
  urlChars: "sqlserver://localhost:1435;database=master;user=sa;password=Pass@#%&2024;encrypt=true;trustServerCertificate=true",
  sqlChars: "sqlserver://localhost:1436;database=master;user=sa;password=Pass'Word\"2024;encrypt=true;trustServerCertificate=true",
  complex: "sqlserver://localhost:1437;database=master;user=sa;password=P{a}s@s#w%o&r*d!2024;encrypt=true;trustServerCertificate=true"
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
  if (testScenario && testScenarios[testScenario as keyof typeof testScenarios]) {
    return testScenarios[testScenario as keyof typeof testScenarios];
  }
  
  // Default to basic scenario
  console.log("⚠️  No DATABASE_URL or PRISMA_TEST_SCENARIO set, using basic scenario");
  console.log("   Available scenarios: basic, curly, urlChars, sqlChars, complex");
  console.log("   Set PRISMA_TEST_SCENARIO=<scenario> to use a specific one");
  
  return testScenarios.basic;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: getDatabaseUrl(),
  },
});
