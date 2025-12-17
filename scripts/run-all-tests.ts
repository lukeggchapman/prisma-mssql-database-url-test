import { runConnectionTests } from "../src/connection-tests";
import { runMigrationTests } from "../src/migration-tests";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

interface DockerService {
  name: string;
  container: string;
  port: number;
  password: string;
}

const services: DockerService[] = [
  {
    name: "mssql-basic",
    container: "mssql-basic-test",
    port: 1433,
    password: "YourStrong@Passw0rd",
  },
  {
    name: "mssql-curly",
    container: "mssql-curly-test",
    port: 1434,
    password: "Strong{Pass}2024!",
  },
  {
    name: "mssql-url-chars",
    container: "mssql-url-chars-test",
    port: 1435,
    password: "Pass@#%&2024",
  },
  {
    name: "mssql-sql-chars",
    container: "mssql-sql-chars-test",
    port: 1436,
    password: "Pass'Word\"2024",
  },
  {
    name: "mssql-complex",
    container: "mssql-complex-test",
    port: 1437,
    password: "P{a}s@s#w%o&r*d!2024",
  },
];

async function checkDockerService(service: DockerService): Promise<boolean> {
  try {
    console.log(`   🔍 Checking ${service.name} (${service.container})...`);

    const { stdout } = await execAsync(
      `docker ps --filter "name=${service.container}" --format "table {{.Names}}\\t{{.Status}}"`
    );

    if (!stdout.includes(service.container)) {
      console.log(`   ❌ ${service.name} is not running`);
      return false;
    }

    if (!stdout.includes("healthy")) {
      console.log(`   ⏳ ${service.name} is starting (not healthy yet)`);
      return false;
    }

    console.log(`   ✅ ${service.name} is running and healthy`);
    return true;
  } catch (error) {
    console.log(
      `   ❌ Failed to check ${service.name}: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    return false;
  }
}

async function waitForServices(timeoutMinutes: number = 5): Promise<boolean> {
  console.log("🐳 Checking Docker Services");
  console.log("===========================");

  const startTime = Date.now();
  const timeoutMs = timeoutMinutes * 60 * 1000;

  while (Date.now() - startTime < timeoutMs) {
    const serviceStatuses = await Promise.all(
      services.map((service) => checkDockerService(service))
    );

    const allHealthy = serviceStatuses.every((status) => status);

    if (allHealthy) {
      console.log("\n✅ All services are healthy and ready for testing!\n");
      return true;
    }

    console.log(
      `\n⏳ Waiting for services to be ready... (${Math.round(
        (Date.now() - startTime) / 1000
      )}s elapsed)`
    );
    await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds
  }

  console.log(
    `\n❌ Timeout: Services not ready after ${timeoutMinutes} minutes`
  );
  return false;
}

async function startDockerServices(): Promise<boolean> {
  try {
    console.log("🚀 Starting Docker Compose services...");
    await execAsync("docker-compose up -d");
    console.log("✅ Docker Compose services started");
    return true;
  } catch (error) {
    console.log(
      `❌ Failed to start Docker services: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
    return false;
  }
}

async function generateUrlEncodingReference(): Promise<void> {
  console.log("\n📚 Password URL Encoding Reference");
  console.log("==================================");

  services.forEach((service) => {
    const encoded = encodeURIComponent(service.password)
      .replace(/'/g, "%27")
      .replace(/"/g, "%22")
      .replace(/{/g, "%7B")
      .replace(/}/g, "%7D");

    console.log(`${service.name}:`);
    console.log(`  Original:    ${service.password}`);
    console.log(`  URL Encoded: ${encoded}`);
    console.log("");
  });
}

async function main(): Promise<void> {
  console.log("🎯 Database Connection Tester");
  console.log("==============================\n");

  // Start Docker services
  const servicesStarted = await startDockerServices();
  if (!servicesStarted) {
    console.log("❌ Failed to start Docker services. Exiting.");
    process.exit(1);
  }

  // Wait for services to be healthy
  const servicesReady = await waitForServices(5);
  if (!servicesReady) {
    console.log(
      "❌ Services not ready. You may need to wait longer or check Docker logs."
    );
    console.log("   Try: docker-compose logs");
    process.exit(1);
  }

  // Show password encoding reference
  generateUrlEncodingReference();

  try {
    // Run connection tests
    console.log("\n" + "=".repeat(50));
    await runConnectionTests();

    // Run migration tests
    console.log("\n" + "=".repeat(50));
    await runMigrationTests();

    console.log("\n🏁 All tests completed!");
    console.log("\n💡 Tips:");
    console.log("   - Check individual test logs above for detailed results");
    console.log(
      "   - Use docker-compose logs <service-name> to debug container issues"
    );
    console.log(
      "   - Try running individual test files: pnpm test:connection or pnpm test:migration"
    );
  } catch (error) {
    console.error("❌ Test execution failed:", error);
    process.exit(1);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
