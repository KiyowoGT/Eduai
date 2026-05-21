import fs from 'fs';
const usedArr = JSON.parse(fs.readFileSync('used_colors.json','utf8'));
const usedMap = new Map(usedArr.map(o => [o.key, o.locations]));
const darkArr = JSON.parse(fs.readFileSync('dark_rules.json','utf8'));
const darkMap = new Map(darkArr.map(o => [o.key, o.selector]));

console.log('USED_COUNT=' + usedMap.size);
console.log('DARK_COVERED_COUNT=' + darkMap.size);

// Compute missing
const missing = [];
for (const key of usedMap.keys()) {
  if (!darkMap.has(key)) missing.push(key);
}
console.log('MISSING_COUNT=' + missing.length);
console.log('\n=== MISSING KEYS ===');
missing.forEach(k => console.log(k));

// Also list duplicates in darkMap? not needed
