import fs from 'fs';

const css = fs.readFileSync('index.css', 'utf8');
const darkRules = new Map();

const lines = css.split('\n');
for (const line of lines) {
  if (!line.includes('.dark .')) continue;
  const openBraceIdx = line.indexOf('{');
  if (openBraceIdx === -1) continue;
  const inner = line.substring(line.indexOf('.dark .') + 7, openBraceIdx).trim();
  const closeBraceIdx = line.indexOf('}', openBraceIdx);
  const isHover = inner.startsWith('hover:');
  let rest = isHover ? inner.substring(6) : inner;
  // Extract property name (letters only) before the dash and escaped bracket
  const propMatch = rest.match(/^[a-z]+/i);
  if (!propMatch) continue;
  let propName = propMatch[0];
  const prop = isHover ? 'hover:' + propName : propName;
  const bracketIdx = rest.indexOf('[');
  const closeBracketIdx = rest.indexOf(']');
  if (closeBracketIdx === -1) continue;
  let hex = rest.substring(bracketIdx + 1, closeBracketIdx);
  // Strip trailing backslash from hex (from \] escape)
  if (hex.length && hex.charCodeAt(hex.length - 1) === 92) hex = hex.slice(0, -1);
  let opacity = '';
  const after = rest.substring(closeBracketIdx + 1);
  const slashRegex = new RegExp('\\\/([0-9]+)');
  const slashMatch = after.match(slashRegex);
  if (slashMatch) opacity = slashMatch[1];
  const key = prop + ':' + hex + ':' + opacity;
  const sel = '.dark .' + (isHover ? 'hover:' : '') + propName + '-\[' + hex + '\]' + (opacity ? '\/' + opacity : '');
  const declaration = line.substring(openBraceIdx + 1, closeBraceIdx).trim();
  darkRules.set(key, { selector: sel, declaration });
}

const ruleArray = Array.from(darkRules.entries()).map(([key, val]) => ({ key, ...val }));
fs.writeFileSync('dark_rules.json', JSON.stringify(ruleArray, null, 2));
console.log('DARK_RULES_COUNT=' + darkRules.size);
