import { validatePhoneNumber, normalizePhoneNumber } from './services/csv-validator.js';

const testCases = [
  { input: '9.19398E+11', expected: '+919398000000' },
  { input: '919398+11', expected: '+919398000000' },
  { input: '9,19398E+11', expected: '+919398000000' }, // European comma decimal format
  { input: '919398765432.0', expected: '+919398765432' }, // Trailing float decimal .0
  { input: '9398765432', expected: '+919398765432' }, // 10-digit Indian number auto +91
  { input: '9.19398765432E+11', expected: '+919398765432' },
  { input: '+919876543210', expected: '+919876543210' },
  { input: '919876543210', expected: '+919876543210' },
  { input: '  +91 (987) 654-3210  ', expected: '+919876543210' },
];

let allPassed = true;

for (const { input, expected } of testCases) {
  const result = validatePhoneNumber(input);
  console.log(`Input: "${input}" -> isValid: ${result.isValid}, cleanPhone: "${result.cleanPhone}" (Expected: "${expected}")`);
  if (!result.isValid || result.cleanPhone !== expected) {
    console.error(`❌ FAILED for input "${input}": Expected "${expected}", got "${result.cleanPhone}"`);
    allPassed = false;
  }
}

if (allPassed) {
  console.log('\nALL 9 EXTENDED TEST CASES PASSED PERFECTLY! ✅');
} else {
  process.exit(1);
}
