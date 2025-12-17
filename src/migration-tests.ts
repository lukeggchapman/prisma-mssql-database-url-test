import { exec } from 'child_process';
import { promisify } from 'util';
import * as dotenv from 'dotenv';
import { testScenarios } from './connection-tests.js';
import { createDatabaseUrl } from './adapter-utils.js';

dotenv.config();

const execAsync = promisify(exec);

interface MigrationResult {
  scenario: string;
  success: boolean;
  error?: string;
  output?: string;
  command: string;
}

export async function runPrismaCommand(
  command: string,
  testScenario: string,
  timeoutMs: number = 30000
): Promise<{ success: boolean; output: string; error?: string }> {
  try {
    const env = {
      ...process.env,
      PRISMA_TEST_SCENARIO: testScenario,
    };

    console.log(`   🔄 Running: ${command}`);
    console.log(`   📋 Test Scenario: ${testScenario}`);
    
    const { stdout, stderr } = await execAsync(command, {
      timeout: timeoutMs,
      env,
    });

    const output = stdout + (stderr ? `\nSTDERR: ${stderr}` : '');
    
    if (stderr && stderr.includes('Error')) {
      return {
        success: false,
        output,
        error: stderr,
      };
    }

    return {
      success: true,
      output,
    };
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

// Map scenario names to environment variable values
const scenarioMap: Record<string, string> = {
  'Basic Password': 'basic',
  'Curly Braces Password': 'curly',
  'URL Problematic Characters': 'urlChars',
  'SQL Escape Characters': 'sqlChars',
  'Complex Special Characters': 'complex',
};

export async function testPrismaMigration(scenario: typeof testScenarios[0]): Promise<MigrationResult> {
  console.log(`\n🔧 Testing Prisma Migration: ${scenario.name}`);
  console.log(`   Database URL: ${scenario.databaseUrl}`);
  
  const envScenario = scenarioMap[scenario.name];
  if (!envScenario) {
    return {
      scenario: scenario.name,
      success: false,
      error: `Unknown scenario mapping for: ${scenario.name}`,
      command: 'mapping',
    };
  }

  // Test: prisma db push (simpler than full migration for testing)
  const pushResult = await runPrismaCommand(
    'npx prisma db push --force-reset --accept-data-loss',
    envScenario
  );

  if (!pushResult.success) {
    console.log(`   ❌ db push failed: ${pushResult.error}`);
    return {
      scenario: scenario.name,
      success: false,
      error: pushResult.error,
      output: pushResult.output,
      command: 'db push',
    };
  }

  console.log(`   ✅ db push successful`);

  // Test: prisma generate
  const generateResult = await runPrismaCommand(
    'npx prisma generate',
    envScenario
  );

  if (!generateResult.success) {
    console.log(`   ❌ generate failed: ${generateResult.error}`);
    return {
      scenario: scenario.name,
      success: false,
      error: generateResult.error,
      output: generateResult.output,
      command: 'generate',
    };
  }

  console.log(`   ✅ generate successful`);

  return {
    scenario: scenario.name,
    success: true,
    output: pushResult.output + '\n' + generateResult.output,
    command: 'db push + generate',
  };
}

export async function testPrismaIntrospect(scenario: typeof testScenarios[0]): Promise<MigrationResult> {
  console.log(`\n🔍 Testing Prisma Introspection: ${scenario.name}`);
  
  const envScenario = scenarioMap[scenario.name];
  if (!envScenario) {
    return {
      scenario: scenario.name,
      success: false,
      error: `Unknown scenario mapping for: ${scenario.name}`,
      command: 'mapping',
    };
  }

  const introspectResult = await runPrismaCommand(
    'npx prisma db pull',
    envScenario
  );

  if (!introspectResult.success) {
    console.log(`   ❌ introspection failed: ${introspectResult.error}`);
    return {
      scenario: scenario.name,
      success: false,
      error: introspectResult.error,
      output: introspectResult.output,
      command: 'db pull',
    };
  }

  console.log(`   ✅ introspection successful`);

  return {
    scenario: scenario.name,
    success: true,
    output: introspectResult.output,
    command: 'db pull',
  };
}

export async function runMigrationTests(): Promise<void> {
  console.log('🚀 Starting Prisma Migration Tests');
  console.log('===================================\n');

  const results: MigrationResult[] = [];

  for (const scenario of testScenarios) {
    console.log(`\n--- Testing Scenario: ${scenario.name} ---`);
    
    // Test migration/db push
    const migrationResult = await testPrismaMigration(scenario);
    results.push(migrationResult);

    // If migration succeeded, test introspection
    if (migrationResult.success) {
      const introspectResult = await testPrismaIntrospect(scenario);
      results.push({
        ...introspectResult,
        scenario: `${scenario.name} (Introspect)`,
      });
    }

    // Add delay between scenarios
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n📊 Migration Test Results Summary');
  console.log('==================================');
  
  let successCount = 0;
  
  results.forEach(result => {
    const status = result.success ? '✅' : '❌';
    console.log(`${status} ${result.scenario} - ${result.command}`);
    if (result.error) {
      console.log(`     Error: ${result.error.substring(0, 200)}${result.error.length > 200 ? '...' : ''}`);
    }
    if (result.success) successCount++;
  });

  console.log(`\n🎯 Success Rate: ${successCount}/${results.length} (${Math.round((successCount / results.length) * 100)}%)`);
  
  if (successCount === results.length) {
    console.log('🎉 All migration tests passed!');
  } else {
    console.log('⚠️  Some migration tests failed. Check the logs above for details.');
  }

  // Save detailed results
  console.log('\n💾 Detailed results available in migration test output above.');
}

if (require.main === module) {
  runMigrationTests().catch(console.error);
}