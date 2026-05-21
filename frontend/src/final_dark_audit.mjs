import fs from 'fs';

const css = fs.readFileSync('index.css', 'utf8');

function makeSelector(prop, hex, opacity) {
  // Escape colons in prop (e.g., hover:bg => hover\:bg) for CSS class escaping
  const escapedProp = prop.replace(/:/g, '\:');
  return '.dark .' + escapedProp + '-\[' + hex + '\]' + (opacity ? '\/' + opacity : '');
}

// Extract used tokens
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

// Compute missing
const missing = [];
for (const [key, locs] of usedMap) {
  const [prop, hex, opacity] = key.split(':');
  const selector = makeSelector(prop, hex, opacity);
  if (!css.includes(selector)) {
    missing.push({ prop, hex, opacity, selector, locations: locs });
  }
}

console.log('TOTAL_USED_TOKENS=', usedMap.size);
console.log('MISSING_COUNT=', missing.length);
console.log('\n=== USED_BUT_NOT_OVERRIDDEN ===\n');
missing.forEach(m => {
  const opDisp = m.opacity ? '/' + m.opacity : '';
  console.log(`${m.prop} ${m.hex}${opDisp}`);
  console.log(`  Selector: ${m.selector} {`);
  // Suggest
  const h = m.hex.toLowerCase();
  let cssProp, val, comment;
  if (m.prop.startsWith('bg') || m.prop.includes(':bg')) {
    cssProp = 'background-color';
    if (['#f8f6f0','#fbfaf7','#fff8e1'].includes(h)) { val='var(--paper)'; comment='light bg -> paper (dark)'; }
    else if (h==='#ffffff') { val='hsl(var(--card))'; comment='white -> card surface'; }
    else if (['#1d2d50','#15223e'].includes(h)) { val='var(--brand-primary)'; comment='primary brand color'; }
    else if (h==='#243b63') { val='var(--brand-primary-hover)'; comment='primary hover'; }
    else if (['#b83a4b','#9c2f3d'].includes(h)) { val='var(--brand-secondary)'; comment='danger/secondary'; }
    else if (h==='#e5a93c') { val='var(--brand-tertiary)'; comment='accent gold'; }
    else if (h==='#2d6a4f') { val='var(--success)'; comment='success green'; }
    else if (h==='#1a1b26') { val='hsl(var(--card))'; comment='almost black -> card'; }
    else if (h==='#e2e0d8') { val='#374151'; comment='border light gray -> gray-600'; }
    else if (['#a0a2b1','#646675'].includes(h)) { val='var(--ink-disabled)'; comment='muted disabled'; }
    else { val='rgba(0,0,0,0.1)'; comment='fallback - adjust'; }
    if (m.opacity) {
      const alpha = parseInt(m.opacity)/100;
      if (val.startsWith('#')) {
        const r=parseInt(val.slice(1,3),16), g=parseInt(val.slice(3,5),16), b=parseInt(val.slice(5,7),16);
        val = `rgba(${r},${g},${b},${alpha})`;
      } else if (val.startsWith('hsl(')) {
        val = val.replace('hsl(', 'hsla(').replace(')', ', '+alpha+')');
      }
      // var() can't have alpha inline; keep as-is (semantic variable ideally supports opacity via rgba(var(--color), alpha))
    }
  } else if (m.prop.startsWith('text') || m.prop.includes(':text')) {
    cssProp = 'color';
    if (['#f8f6f0','#fff'].includes(h)) { val='var(--ink)'; comment='light text on dark'; }
    else if (h==='#1a1b26') { val='var(--ink)'; comment='dark text'; }
    else if (['#646675','#a0a2b1'].includes(h)) { val='var(--ink-secondary)'; comment='muted'; }
    else if (['#1d2d50','#15223e'].includes(h)) { val='var(--brand-primary)'; }
    else if (h==='#b83a4b') { val='var(--brand-secondary)'; }
    else if (h==='#e5a93c') { val='var(--brand-tertiary)'; }
    else if (h==='#2d6a4f') { val='var(--success)'; }
    else { val='currentColor'; comment='inherit'; }
  } else if (m.prop.startsWith('border') || m.prop.includes(':border')) {
    cssProp = 'border-color';
    if (h==='#e2e0d8') { val='#374151'; comment='border gray -> gray-600'; }
    else if (h==='#1d2d50') { val='var(--brand-primary)'; }
    else if (h==='#e5a93c') {
      if (m.opacity==='20') { val='rgba(250,204,21,0.2)'; comment='amber 20%'; }
      else if (m.opacity==='30') { val='rgba(250,204,21,0.3)'; comment='amber 30%'; }
      else { val='var(--brand-tertiary)'; }
    } else if (h==='#b83a4b') { val='var(--brand-secondary)'; }
    else if (h==='#f8f6f0') { val='hsl(var(--border))'; comment='border color'; }
    else if (h==='#1a1b26') { val='var(--ink)'; }
    else if (h==='#15223e') { val='var(--brand-primary)'; }
    else { val='currentColor'; }
  } else if (m.prop.startsWith('placeholder') || m.prop.includes(':text')) {
    cssProp = 'color';
    val = 'var(--muted-foreground)';
    comment = 'placeholder';
  } else {
    cssProp = 'color';
    val = 'currentColor';
    comment = 'fallback';
  }
  console.log(`  ${cssProp}: ${val};  /* ${comment} */`);
  console.log('}');
  const files = [...new Set(m.locations.map(l => l.file))];
  console.log(`Used in: ${files.join(', ')}\n`);
});
