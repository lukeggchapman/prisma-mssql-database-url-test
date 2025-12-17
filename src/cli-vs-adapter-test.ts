/**
 * CLI vs Adapter Password Handling Comparison Test
 * 
 * This test compares how the same passwords are handled by:
 * 1. Prisma CLI operations (using escaped connection strings)
 * 2. Prisma Client with MSSQL adapter (using raw passwords)
 */

import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import { 
  createMssqlAdapterFromConfig,
  createMssqlConfig,
  escapeSqlServerPassword,
  createCliDatabaseUrl
} from './adapter-utils.js';

const execAsync = promisify(exec);

interface TestPassword {
  name: string;
  raw: string;
  port: number;
  expectedEscaping: string;
}

// Use the ACTUAL passwords from docker-compose.yml to get valid authentication
const testPasswords: TestPassword[] = [
  {
    name: 'Basic with @',
    raw: 'YourStrong@Passw0rd',
    port: 1433,
    expectedEscaping: 'YourStrong@Passw0rd' // @ doesn't get escaped
  },
  {
    name: 'Curly Braces',
    raw: 'Strong{Pass}2024!',
    port: 1434,
    expectedEscaping: 'Strong{{}Pass{}}2024!' // { and } get escaped
  },
  {
    name: 'URL Problematic Characters',
    raw: 'Pass@#%&2024',
    port: 1435,
    expectedEscaping: 'Pass@#%&2024' // These chars don't get escaped by our pattern
  },
  {
    name: 'SQL Escape Characters',
    raw: 'Pass\'Word"2024',
    port: 1436,
    expectedEscaping: 'Pass\'Word"2024' // These chars don't get escaped by our pattern
  },
  {
    name: 'Complex Special Characters',
    raw: 'P{a}s@s#w%o&r*d!2024',
    port: 1437,
    expectedEscaping: 'P{{}a{}}s@s#w%o&r*d!2024' // Only { and } get escaped
  }
];

async function testCliOperation(password: TestPassword): Promise<{
  success: boolean;
  error?: string;
  escapedPassword: string;
  connectionString: string;
}> {
  console.log(`\n🔧 Testing CLI with: ${password.name}`);
  console.log(`   Raw password: ${password.raw}`);
  
  const escapedPassword = escapeSqlServerPassword(password.raw);
  const connectionString = createCliDatabaseUrl('localhost', password.port, 'sa', password.raw, 'master');
  
  console.log(`   Escaped password: ${escapedPassword}`);
  console.log(`   Expected escaping: ${password.expectedEscaping}`);
  console.log(`   Connection string: ${connectionString}`);
  
  // Verify our escaping matches expected
  const escapingMatches = escapedPassword === password.expectedEscaping;
  console.log(`   ✅ Escaping ${escapingMatches ? 'matches' : 'DIFFERS FROM'} expected`);
  
  try {
    const env = {
      ...process.env,
      DATABASE_URL: connectionString,
    };

    console.log(`   🔄 Running: npx prisma db push --accept-data-loss`);
    
    const { stdout, stderr } = await execAsync('npx prisma db push --accept-data-loss', {
      timeout: 30000,
      env,
    });

    console.log(`   ✅ CLI operation successful`);
    if (stdout) console.log(`      stdout: ${stdout.trim()}`);
    
    return {
      success: true,
      escapedPassword,
      connectionString
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`   ❌ CLI operation failed: ${errorMessage}`);
    
    return {
      success: false,
      error: errorMessage,
      escapedPassword,
      connectionString
    };
  }
}

async function testAdapterOperation(password: TestPassword): Promise<{
  success: boolean;
  error?: string;
}> {
  console.log(`\n🔌 Testing Adapter with: ${password.name}`);
  console.log(`   Raw password: ${password.raw}`);
  
  try {
    const config = createMssqlConfig('localhost', password.port, 'sa', password.raw, 'master');
    console.log(`   Config created (password not logged for security)`);
    
    const adapter = await createMssqlAdapterFromConfig(config);
    const prisma = new PrismaClient({
      adapter,
      log: ['error'],
    });

    // Test connection
    await prisma.$connect();
    console.log(`   ✅ Adapter connection successful`);

    // Test query
    await prisma.$queryRaw`SELECT 1 as test`;
    console.log(`   ✅ Adapter query successful`);

    await prisma.$disconnect();
    
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.log(`   ❌ Adapter operation failed: ${errorMessage}`);
    
    return {
      success: false,
      error: errorMessage
    };
  }
}

export async function runCliVsAdapterComparison(): Promise<void> {
  console.log('🎯 CLI vs Adapter Password Handling Comparison');
  console.log('=============================================\n');
  
  console.log('📋 Testing Password Escaping Logic');
  console.log('==================================');
  
  testPasswords.forEach(password => {
    const escaped = escapeSqlServerPassword(password.raw);
    const matches = escaped === password.expectedEscaping;
    console.log(`${password.name}:`);
    console.log(`  Raw: ${password.raw}`);
    console.log(`  Escaped: ${escaped}`);
    console.log(`  Expected: ${password.expectedEscaping}`);
    console.log(`  ✅ ${matches ? 'CORRECT' : '❌ MISMATCH'}\n`);
  });

  const results: Array<{
    password: string;
    cliSuccess: boolean;
    adapterSuccess: boolean;
    cliError?: string;
    adapterError?: string;
  }> = [];

  for (const password of testPasswords) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🧪 Testing: ${password.name} (${password.raw})`);
    console.log(`${'='.repeat(60)}`);

    // Test CLI operation
    const cliResult = await testCliOperation(password);
    
    // Small delay between tests
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Test Adapter operation
    const adapterResult = await testAdapterOperation(password);

    results.push({
      password: password.name,
      cliSuccess: cliResult.success,
      adapterSuccess: adapterResult.success,
      cliError: cliResult.error,
      adapterError: adapterResult.error,
    });

    // Delay between password tests
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  console.log('\n📊 Final Comparison Results');
  console.log('============================');
  
  let cliSuccessCount = 0;
  let adapterSuccessCount = 0;
  let bothSuccessCount = 0;

  results.forEach(result => {
    const cliStatus = result.cliSuccess ? '✅' : '❌';
    const adapterStatus = result.adapterSuccess ? '✅' : '❌';
    const comparison = result.cliSuccess === result.adapterSuccess ? 
      (result.cliSuccess ? '🎉 Both Work' : '⚠️ Both Fail') : 
      '🔄 Different Results';

    console.log(`\n${result.password}:`);
    console.log(`  CLI:     ${cliStatus} ${result.cliSuccess ? 'SUCCESS' : 'FAILED'}`);
    console.log(`  Adapter: ${adapterStatus} ${result.adapterSuccess ? 'SUCCESS' : 'FAILED'}`);
    console.log(`  Result:  ${comparison}`);
    
    if (result.cliError) console.log(`  CLI Error: ${result.cliError}`);
    if (result.adapterError) console.log(`  Adapter Error: ${result.adapterError}`);

    if (result.cliSuccess) cliSuccessCount++;
    if (result.adapterSuccess) adapterSuccessCount++;
    if (result.cliSuccess && result.adapterSuccess) bothSuccessCount++;
  });

  console.log(`\n🎯 Summary:`);
  console.log(`   CLI Success Rate:     ${cliSuccessCount}/${results.length} (${Math.round(cliSuccessCount / results.length * 100)}%)`);
  console.log(`   Adapter Success Rate: ${adapterSuccessCount}/${results.length} (${Math.round(adapterSuccessCount / results.length * 100)}%)`);
  console.log(`   Both Working:         ${bothSuccessCount}/${results.length} (${Math.round(bothSuccessCount / results.length * 100)}%)`);

  console.log('\n💡 Key Insights:');
  console.log('   - CLI uses escaped passwords with {char} format');
  console.log('   - Adapter uses raw passwords directly');
  console.log('   - This test validates which approach is more reliable');
  
  if (cliSuccessCount === adapterSuccessCount && cliSuccessCount === results.length) {
    console.log('   🎉 Both approaches work equally well with proper escaping!');
  } else if (adapterSuccessCount > cliSuccessCount) {
    console.log('   📈 Adapter approach is more reliable than CLI with escaping');
  } else if (cliSuccessCount > adapterSuccessCount) {
    console.log('   📈 CLI approach with escaping is more reliable than adapter');
  } else {
    console.log('   🤔 Mixed results - some passwords work better with different approaches');
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runCliVsAdapterComparison().catch(console.error);
}