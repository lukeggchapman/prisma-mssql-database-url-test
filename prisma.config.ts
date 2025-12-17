import { defineConfig, env } from "prisma/config";

// Test scenario URLs for different password patterns
const testScenarios = {
  basic: "sqlserver://sa:YourStrong%40Passw0rd@localhost:1433?database=master&encrypt=true&trustServerCertificate=true",
  curly: "sqlserver://sa:Strong%7BPass%7D2024!@localhost:1434?database=master&encrypt=true&trustServerCertificate=true", 
  urlChars: "sqlserver://sa:Pass%40%23%25%262024@localhost:1435?database=master&encrypt=true&trustServerCertificate=true",
  sqlChars: "sqlserver://sa:Pass%27Word%222024@localhost:1436?database=master&encrypt=true&trustServerCertificate=true",
  complex: "sqlserver://sa:P%7Ba%7Ds%40s%23w%25o%26r*d!2024@localhost:1437?database=master&encrypt=true&trustServerCertificate=true"
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
