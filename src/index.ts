import { runConnectionTests } from './connection-tests';
import { runMigrationTests } from './migration-tests';

console.log('🎯 Database Connection Tester - Interactive Mode');
console.log('================================================\n');

console.log('Available commands:');
console.log('  pnpm test           - Run all tests');
console.log('  pnpm test:connection - Run connection tests only');
console.log('  pnpm test:migration  - Run migration tests only');
console.log('  pnpm dev            - Run this interactive mode');
console.log('\nTo start testing, run: pnpm test');