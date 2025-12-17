/**
 * Comprehensive Database URL Test
 * 
 * For each password with special characters, tests:
 * 1. DATABASE_URL without escaping: Works for adapter? Works for CLI?
 * 2. DATABASE_URL with escaping: Works for adapter? Works for CLI?
 * 
 * This definitively answers whether you can standardise on one DATABASE_URL format.
 */

import { PrismaMssql } from '@prisma/adapter-mssql';
import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import { 
  createMssqlConfig,
  escapeSqlServerPassword,
  createCliDatabaseUrl
} from './adapter-utils.js';

const execAsync = promisify(exec);

interface TestScenario {
  name: string;
  rawPassword: string;
  port: number;
}

// Use actual Docker container passwords
const testScenarios: TestScenario[] = [
  {
    name: 'Basic with @',
    rawPassword: 'YourStrong@Passw0rd',
    port: 1433
  },
  {
    name: 'Curly Braces',
    rawPassword: 'Strong{Pass}2024!',
    port: 1434
  },
  {
    name: 'URL Problematic Characters',
    rawPassword: 'Pass@#%&2024',
    port: 1435
  },
  {
    name: 'SQL Escape Characters',
    rawPassword: 'Pass\'Word"2024',
    port: 1436
  },
  {
    name: 'Complex Special Characters',
    rawPassword: 'P{a}s@s#w%o&r*d!2024',
    port: 1437
  }
];

interface TestResult {
  success: boolean;
  error?: string;
}

// Simple URL parser for SQL Server URLs
function createMssqlConfigFromUrl(url: string): any {
  const [hostPart, ...paramParts] = url.split(';');
  const hostMatch = hostPart.match(/sqlserver:\/\/([^:]+):?(\d+)?/);
  
  if (!hostMatch) {
    throw new Error('Invalid SQL Server URL format');
  }
  
  const host = hostMatch[1];
  const port = parseInt(hostMatch[2]) || 1433;
  
  const params: Record<string, string> = {};
  paramParts.forEach(param => {
    const [key, value] = param.split('=');
    if (key && value) {
      params[key.toLowerCase().trim()] = value.trim();
    }
  });
  
  return {
    server: host,
    port,
    user: params.user || 'sa',
    password: params.password || '',
    database: params['initial catalog'] || params.database || 'master',
    options: {
      encrypt: params.encrypt === 'true',
      trustServerCertificate: params.trustservercertificate === 'true',
    },
  };
}

async function testAdapterWithUrl(databaseUrl: string, description: string): Promise<TestResult> {
  console.log(`\n🔌 Testing Adapter with ${description}`);
  console.log(`   URL: ${databaseUrl.replace(/password=[^;]+/, 'password=[HIDDEN]')}`);
  
  try {
    // Parse URL to config (since PrismaMssql doesn't accept strings directly)
    const config = createMssqlConfigFromUrl(databaseUrl);
    const adapter = new PrismaMssql(config);
    
    const prisma = new PrismaClient({
      adapter,
      log: ['error']
    });

    await prisma.$connect();
    await prisma.$queryRaw`SELECT 1 as test`;
    await prisma.$disconnect();
    
    console.log(`   ✅ Adapter: SUCCESS`);
    return { success: true };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`   ❌ Adapter: FAILED - ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

async function testCliWithUrl(databaseUrl: string, description: string): Promise<TestResult> {
  console.log(`\n🔧 Testing CLI with ${description}`);
  console.log(`   URL: ${databaseUrl.replace(/password=[^;]+/, 'password=[HIDDEN]')}`);
  
  try {
    const env = {
      ...process.env,
      DATABASE_URL: databaseUrl,
    };

    console.log(`   🔄 Running: npx prisma db push --accept-data-loss`);
    
    const { stdout, stderr } = await execAsync('npx prisma db push --accept-data-loss', {
      timeout: 30000,
      env,
    });

    console.log(`   ✅ CLI: SUCCESS`);
    return { success: true };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`   ❌ CLI: FAILED - ${errorMessage}`);
    return { success: false, error: errorMessage };
  }
}

export async function runComprehensiveDatabaseUrlTest(): Promise<void> {
  console.log('🎯 Comprehensive DATABASE_URL Test');
  console.log('==================================\n');
  
  console.log('Testing for each password:');
  console.log('1. DATABASE_URL without escaping: Works for adapter? Works for CLI?');
  console.log('2. DATABASE_URL with escaping: Works for adapter? Works for CLI?\n');

  interface ScenarioResults {
    scenario: string;
    rawPassword: string;
    rawUrlAdapter: TestResult;
    rawUrlCli: TestResult;
    escapedUrlAdapter: TestResult;
    escapedUrlCli: TestResult;
  }

  const allResults: ScenarioResults[] = [];

  for (const scenario of testScenarios) {
    console.log(`${'='.repeat(80)}`);
    console.log(`🧪 Testing: ${scenario.name} (${scenario.rawPassword})`);
    console.log(`${'='.repeat(80)}`);

    // Create both URL formats
    const rawDatabaseUrl = `sqlserver://localhost:${scenario.port};initial catalog=master;user=sa;password=${scenario.rawPassword};encrypt=true;trustServerCertificate=true;`;
    const escapedDatabaseUrl = createCliDatabaseUrl('localhost', scenario.port, 'sa', scenario.rawPassword, 'master');

    console.log(`\n📝 Password Analysis:`);
    console.log(`   Raw password: ${scenario.rawPassword}`);
    console.log(`   Escaped password: ${escapeSqlServerPassword(scenario.rawPassword)}`);
    console.log(`   Needs escaping: ${scenario.rawPassword !== escapeSqlServerPassword(scenario.rawPassword) ? 'YES' : 'NO'}`);

    // Test 1: Raw URL with Adapter
    const rawUrlAdapter = await testAdapterWithUrl(rawDatabaseUrl, 'Raw DATABASE_URL (No Escaping)');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 2: Raw URL with CLI  
    const rawUrlCli = await testCliWithUrl(rawDatabaseUrl, 'Raw DATABASE_URL (No Escaping)');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 3: Escaped URL with Adapter
    const escapedUrlAdapter = await testAdapterWithUrl(escapedDatabaseUrl, 'Escaped DATABASE_URL (CLI Format)');
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Test 4: Escaped URL with CLI
    const escapedUrlCli = await testCliWithUrl(escapedDatabaseUrl, 'Escaped DATABASE_URL (CLI Format)');

    allResults.push({
      scenario: scenario.name,
      rawPassword: scenario.rawPassword,
      rawUrlAdapter,
      rawUrlCli,
      escapedUrlAdapter,
      escapedUrlCli
    });

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Generate comprehensive summary
  console.log('\n📊 Comprehensive Results Summary');
  console.log('================================');

  console.log('\n📋 Format: [Adapter Result] / [CLI Result]');
  console.log('Legend: ✅ = Success, ❌ = Failed\n');

  let rawUrlSuccess = 0;
  let escapedUrlSuccess = 0;
  let totalScenarios = allResults.length;

  allResults.forEach(result => {
    console.log(`${result.scenario} (${result.rawPassword}):`);
    
    const rawAdapterIcon = result.rawUrlAdapter.success ? '✅' : '❌';
    const rawCliIcon = result.rawUrlCli.success ? '✅' : '❌';
    const escapedAdapterIcon = result.escapedUrlAdapter.success ? '✅' : '❌';
    const escapedCliIcon = result.escapedUrlCli.success ? '✅' : '❌';
    
    console.log(`  Raw DATABASE_URL:     ${rawAdapterIcon} Adapter / ${rawCliIcon} CLI`);
    console.log(`  Escaped DATABASE_URL: ${escapedAdapterIcon} Adapter / ${escapedCliIcon} CLI`);
    
    // Count scenarios where both adapter AND CLI work for each format
    if (result.rawUrlAdapter.success && result.rawUrlCli.success) {
      rawUrlSuccess++;
    }
    if (result.escapedUrlAdapter.success && result.escapedUrlCli.success) {
      escapedUrlSuccess++;
    }
    
    // Show errors if any
    if (result.rawUrlAdapter.error) console.log(`    Raw Adapter Error: ${result.rawUrlAdapter.error}`);
    if (result.rawUrlCli.error) console.log(`    Raw CLI Error: ${result.rawUrlCli.error}`);
    if (result.escapedUrlAdapter.error) console.log(`    Escaped Adapter Error: ${result.escapedUrlAdapter.error}`);
    if (result.escapedUrlCli.error) console.log(`    Escaped CLI Error: ${result.escapedUrlCli.error}`);
    
    console.log('');
  });

  console.log('🎯 Standardisation Viability:');
  console.log(`   Raw DATABASE_URL (both adapter & CLI work):     ${rawUrlSuccess}/${totalScenarios} (${Math.round(rawUrlSuccess/totalScenarios*100)}%)`);
  console.log(`   Escaped DATABASE_URL (both adapter & CLI work): ${escapedUrlSuccess}/${totalScenarios} (${Math.round(escapedUrlSuccess/totalScenarios*100)}%)`);

  console.log('\n💡 Conclusions:');
  
  if (rawUrlSuccess === totalScenarios) {
    console.log('   🎉 You CAN standardise on Raw DATABASE_URL format!');
    console.log('   ✅ Both adapter and CLI work with all special character passwords');
  } else if (escapedUrlSuccess === totalScenarios) {
    console.log('   🎉 You CAN standardise on Escaped DATABASE_URL format!');
    console.log('   ✅ Both adapter and CLI work with escaped passwords');
  } else if (rawUrlSuccess > escapedUrlSuccess) {
    console.log('   ⚠️  Raw DATABASE_URL format is MORE reliable than escaped');
    console.log(`   📈 Raw: ${rawUrlSuccess}/${totalScenarios} vs Escaped: ${escapedUrlSuccess}/${totalScenarios}`);
  } else if (escapedUrlSuccess > rawUrlSuccess) {
    console.log('   ⚠️  Escaped DATABASE_URL format is MORE reliable than raw');
    console.log(`   📈 Escaped: ${escapedUrlSuccess}/${totalScenarios} vs Raw: ${rawUrlSuccess}/${totalScenarios}`);
  } else {
    console.log('   ❌ NEITHER format works reliably for standardisation');
    console.log('   🏗️  You need separate approaches for CLI vs Adapter');
  }

  console.log('\n🔍 Key Insights:');
  console.log('   - If Raw URL works 100%: Use raw passwords in DATABASE_URL');
  console.log('   - If Escaped URL works 100%: Use CLI escaping in DATABASE_URL');
  console.log('   - If neither works 100%: Use individual config for adapter, env vars for CLI');
  console.log('   - This test provides definitive guidance for your standardisation decision');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runComprehensiveDatabaseUrlTest().catch(console.error);
}