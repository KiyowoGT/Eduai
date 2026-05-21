import fs from 'fs';

const css = fs.readFileSync('index.css', 'utf8');

function buildDarkSelector(prop, hex, opacity) {
  // prop can be 'bg', 'text', 'border', or 'hover:bg', 'focus:text', etc.
  const parts = prop.split(':');
  let base = parts[parts.length - 1]; // bg/text/border
  let prefix = parts.slice(0, -1).join(':'); // e.g., 'hover' or 'hover:focus'? but we only have single
  let selector = '.dark .';
  if (prefix) {
    selector += prefix + ':'; // e.g., 'hover:'
  }
  selector += base + '-\[' + hex + '\]';
  if (opacity) selector += '\/' + opacity;
  return selector;
}

// 1. Extract all used tokens from JSX/TSX
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
          const prefix = m[1]; // includes trailing colon, e.g., "hover:" or ""
          const baseProp = m[2];
          const hex = m[3];
          const opacity = m[4] ? m[4].slice(1) : '';
          const prop = prefix ? prefix.slice(0, -1) + ':' + baseProp : baseProp;
          const key = prop + ':' + hex + ':' + opacity;
          if (!usedMap.has(key)) usedMap.set(key, []);
          usedMap.get(key).push({ file: f, line: i + 1 });
        }
        re.lastIndex = 0;
      }
    }
  }
}
walk('.');

// 2. For each used token, generate selector and check presence in CSS
const missing = [];
for (const [key, locs] of usedMap) {
  const [prop, hex, opacity] = key.split(':');
  const selector = buildDarkSelector(prop, hex, opacity);
  // Also try with :hover trailing? Actually CSS selectors include :hover for hover states, but our selector up to the class should match
  // E.g., CSS: ".dark .hover:bg-\[#F8F6F0\]:hover {"; substring we search is ".dark .hover:bg-\[#F8F6F0\]"
  if (!css.includes(selector)) {
    missing.push({ prop, hex, opacity, selector, locations: locs });
  }
}

console.log('TOTAL_UNIQUE_USED_TOKENS=', usedMap.size);
console.log('MISSING_COUNT=', missing.length);
console.log('\n=== USED_BUT_NOT_OVERRIDDEN ===\n');
missing.forEach(m => {
  const opDisp = m.opacity ? '/' + m.opacity : '';
  console.log(`${m.prop} ${m.hex}${opDisp}`);
  console.log(`  Selector: ${m.selector} {`);
  // Determine suggested property and value
  const hexLower = m.hex.toLowerCase();
  let cssProp, val, comment;
  if (m.prop.startsWith('bg') || (m.prop.includes(':bg'))) {
    cssProp = 'background-color';
    if (['#f8f6f0','#fbfaf7','#fff8e1'].includes(hexLower)) { val='var(--paper)'; comment='light bg -> paper'; }
    else if (hexLower==='#ffffff') { val='hsl(var(--card))'; comment='white -> card'; }
    else if (['#1d2d50','#15223e'].includes(hexLower)) { val='var(--brand-primary)'; comment='primary blue'; }
    else if (hexLower==='#243b63') { val='var(--brand-primary-hover)'; comment='primary hover'; }
    else if (['#b83a4b','#9c2f3d'].includes(hexLower)) { val='var(--brand-secondary)'; comment='danger red'; }
    else if (hexLower==='#e5a93c') { val='var(--brand-tertiary)'; comment='accent gold'; }
    else if (hexLower==='#2d6a4f') { val='var(--success)'; comment='success green'; }
    else if (hexLower==='#1a1b26') { val='hsl(var(--card))'; comment='dark -> card'; }
    else if (hexLower==='#e2e0d8') { val='#374151'; comment='border gray -> gray-600'; }
    else if (['#a0a2b1','#646675'].includes(hexLower)) { val='var(--ink-disabled)'; comment='muted color'; }
    else { val='rgba(0,0,0,0.1)'; comment='fallback - tune'; }
    if (m.opacity) {
      const alpha = parseInt(m.opacity)/100;
      if (val.startsWith('#')) {
        const r=parseInt(val.slice(1,3),16), g=parseInt(val.slice(3,5),16), b=parseInt(val.slice(5,7),16);
        val = `rgba(${r},${g},${b},${alpha})`;
      } else if (val.startsWith('hsl(')) {
        val = val.replace('hsl(', 'hsla(').replace(')', ', '+alpha+')');
      }
      // For var(--xxx) we cannot adjust inline; would need separate CSS var
    }
  } else if (m.prop.startsWith('text') || m.prop.includes(':text')) {
    cssProp = 'color';
    if (['#f8f6f0','#fff'].includes(hexLower)) { val='var(--ink)'; comment='light on dark'; }
    else if (hexLower==='#1a1b26') { val='var(--ink)'; comment='dark text'; }
    else if (['#646675','#a0a2b1'].includes(hexLower)) { val='var(--ink-secondary)'; comment='muted'; }
    else if (['#1d2d50','#15223e'].includes(hexLower)) { val='var(--brand-primary)'; }
    else if (hexLower==='#b83a4b') { val='var(--brand-secondary)'; }
    else if (hexLower==='#e5a93c') { val='var(--brand-tertiary)'; }
    else if (hexLower==='#2d6a4f') { val='var(--success)'; }
    else { val='currentColor'; comment='inherit'; }
  } else if (m.prop.startsWith('border') || m.prop.includes(':border')) {
    cssProp = 'border-color';
    if (hexLower==='#e2e0d8') { val='#374151'; comment='border gray -> gray-600'; }
    else if (hexLower==='#1d2d50') { val='var(--brand-primary)'; }
    else if (hexLower==='#e5a93c') {
      if (m.opacity==='20') { val='rgba(250,204,21,0.2)'; comment='amber/20'; }
      else if (m.opacity==='30') { val='rgba(250,204,21,0.3)'; comment='amber/30'; }
      else { val='var(--brand-tertiary)'; }
    } else if (hexLower==='#b83a4b') { val='var(--brand-secondary)'; }
    else if (hexLower==='#f8f6f0') { val='hsl(var(--border))'; }
    else if (hexLower==='#1a1b26') { val='var(--ink)'; }
    else if (hexLower==='#15223e') { val='var(--brand-primary)'; }
    else { val='currentColor'; }
  } else if (m.prop.startsWith('placeholder') || m.prop.includes(':text')) { // placeholder:text
    cssProp = 'color';
    val = 'var(--muted-foreground)';
    comment = 'placeholder text';
  } else {
    cssProp = 'color';
    val = 'currentColor';
  }
  console.log(`  ${cssProp}: ${val};  /* ${comment} */`);
  console.log('}');
  const files = [...new Set(m.locations.map(l => l.file))];
  console.log(`Used in: ${files.join(', ')}\n`);
});
