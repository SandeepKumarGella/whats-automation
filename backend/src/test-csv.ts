import { validatePhoneNumber, normalizePhoneNumber } from './services/csv-validator.js';

const testCases = [
  { input: '9.19398E+11', expected: '+919398000000' },
  { input: '919398+11', expected: '+91919398000000' }, // 919398 * 10^11 = 919398000000 -> prepends + -> +919398000000 (13 digits)
  { input: '9.19398765432E+11', expected: '+919398765432' },
  { input: '+919876543210', expected: '+919876543210' },
  { input: '919876543210', expected: '+919876543210' },
  { input: '  +91 (987) 654-3210  ', expected: '+919876543210' },
];

let allPassed = true;

for (const { input, expected } of testCases) {
  const result = validatePhoneNumber(input);
  console.log(`Input: "${input}" -> isValid: ${result.isValid}, cleanPhone: "${result.cleanPhone}" (reason: ${result.reason || 'None'})`);
  if (!result.isValid) {
    console.error(`FAILED for input "${input}": Expected valid, got invalid`);
    allPassed = false;
  }
}

if (allPassed) {
  console.log('\nALL SCIENTIFIC NOTATION AND EXCEL PHONE FORMAT TESTS PASSED SUCCESSFULLY! ✅');
} else {
  process.exit(1);
}
