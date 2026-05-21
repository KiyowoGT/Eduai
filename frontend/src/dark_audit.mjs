import fs from 'fs';
import { fileURLToPath } from 'url';

const usedMap = new Map();
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = fileURLToPath(dir + '/' + f);
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
          let opKey = opacity;
          if (opKey.startsWith('/')) opKey = opKey.slice(1);
          const key = propKey + ':' + hex + ':' + opKey;
          if (!usedMap.has(key)) usedMap.set(key, []);
          usedMap.get(key).push({ file: p.replace(/^.*[\\/](?!.*[\\/])/, ''), line: i + 1 });
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
  let propName = rest.substring(0, bracketIdx - 1);
  const closeBracketIdx = rest.indexOf(']');
  if (closeBracketIdx === -1) continue;
  let hex = rest.substring(bracketIdx + 1, closeBracketIdx);
  if (hex.endsWith('\')) hex = hex.slice(0, -1);
  let opacity = '';
  const after = rest.substring(closeBracketIdx + 1);
  const slashMatch = after.match(/\\/([0-9]+)/);
  if (slashMatch) opacity = slashMatch[1];
  const prop = isHover ? 'hover:' + propName : propName;
  const key = prop + ':' + hex + ':' + opacity;
  darkMap.set(key, { selector: selectorPart, declaration: line.substring(openBraceIdx+1, closeBraceIdx).trim() });
}

const missing = [];
for (const [key, locs] of usedMap) {
  if (!darkMap.has(key)) missing.push({ key, locs });
}

console.log('USED_COUNT=' + usedMap.size);
console.log('DARK_COVERED_COUNT=' + darkMap.size);
console.log('MISSING_COUNT=' + missing.length);
console.log('\n=== MISSING_ENTRIES ===');
missing.forEach(m => {
  const [prop, hex, opacity] = m.key.split(':');
  const locList = m.locs.slice(0, 3).map(l => l.file + ':' + l.line).join(', ');
  console.log('  ' + prop + ' ' + hex + (opacity ? '/' + opacity : '') + ' => ' + locList);
});
