const fs = require('fs');

const usedMap = new Map();
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = dir + '/' + f;
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (f !== 'node_modules' && f !== '.git') walk(p);
    } else if (/\.(jsx|tsx)$/.test(f)) {
      const content = fs.readFileSync(p, 'utf8');
      const lines = content.split('\n');
      const re = /((?:[a-z][a-z0-9-]*:)?)(bg|text|border)-\[(#[0-9A-Fa-f]{3,6})\](\/[0-9]+)?/g;
      for (let i = 0; i < lines.length; i++) {
        let m;
        while ((m = re.exec(lines[i])) !== null) {
          const prefix = m[1];
          const prop = m[2];
          const hex = m[3];
          const opacity = m[4] || '';
          let propKey = prop;
          if (prefix) propKey = prefix.slice(0, -1) + ':' + prop;
          let opKey = opacity.replace(/^\//, '');
          const key = propKey + ':' + hex + ':' + opKey;
          if (!usedMap.has(key)) usedMap.set(key, []);
          usedMap.get(key).push(p + ':' + (i + 1));
        }
        re.lastIndex = 0;
      }
    }
  }
}
walk('.');

const css = fs.readFileSync('index.css', 'utf8');
const darkMap = new Map();
const cssLines = css.split('\n');
const BACKSLASH = String.fromCharCode(92);
for (const line of cssLines) {
  if (!line.includes('.dark .') || !line.includes('{')) continue;
  const selStart = line.indexOf('.dark .');
  const openBraceIdx = line.indexOf('{');
  const selectorPart = line.substring(selStart, openBraceIdx).trim();
  const closeBraceIdx = line.indexOf('}', openBraceIdx);
  if (closeBraceIdx === -1) continue;
  const inner = selectorPart.substring(7);
  const isHover = inner.startsWith('hover:');
  let rest = isHover ? inner.substring(6) : inner;
  const bracketIdx = rest.indexOf('[');
  if (bracketIdx === -1) continue;
  const dashIdx = rest.lastIndexOf('-', bracketIdx);
  if (dashIdx === -1) continue;
  const propName = rest.substring(0, dashIdx);
  const closeBracketIdx = rest.indexOf(']');
  if (closeBracketIdx === -1) continue;
  let hex = rest.substring(bracketIdx + 1, closeBracketIdx);
  if (hex.length > 0 && hex[hex.length - 1] === BACKSLASH) hex = hex.slice(0, -1);
  let opacity = '';
  const after = rest.substring(closeBracketIdx + 1);
  const slashMatch = after.match(/\\/([0-9]+)/);
  if (slashMatch) opacity = slashMatch[1];
  const prop = isHover ? 'hover:' + propName : propName;
  const key = prop + ':' + hex + ':' + opacity;
  darkMap.set(key, selectorPart);
}

const missing = [];
for (const [key, locs] of usedMap) {
  if (!darkMap.has(key)) missing.push({ key, locs });
}

console.log('TOTAL_USED=' + usedMap.size);
console.log('TOTAL_COVERED=' + darkMap.size);
console.log('MISSING_COUNT=' + missing.length);
console.log('\n=== MISSING ===');
missing.forEach(m => {
  const [prop, hex, op] = m.key.split(':');
  const opDisplay = op ? '/' + op : '';
  console.log('  ' + prop + ' ' + hex + opDisplay);
  m.locs.slice(0, 5).forEach(loc => console.log('    ' + loc));
  if (m.locs.length > 5) console.log('    ...+' + (m.locs.length - 5));
});
