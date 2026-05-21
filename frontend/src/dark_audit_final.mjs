import fs from 'fs';

const css = fs.readFileSync('index.css', 'utf8');
const BACK = String.fromCharCode(92); // a single backslash

function makeSelector(prop, hex, opacity) {
  // Escape colons in prop to \:
  const escapedProp = prop.replace(/:/g, BACK + ':');
  let sel = '.dark .' + escapedProp + '-' + BACK + '[' + hex + BACK + ']';
  if (opacity) sel += BACK + '/' + opacity;
  return sel;
}

// Extract tokens
const used = new Map();
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
          const base = m[2];
          const hex = m[3];
          const op = m[4] ? m[4].slice(1) : '';
          const prop = prefix ? prefix.slice(0, -1) + ':' + base : base;
          const key = prop + ':' + hex + ':' + op;
          if (!used.has(key)) used.set(key, []);
          used.get(key).push({ file: f, line: i + 1 });
        }
        re.lastIndex = 0;
      }
    }
  }
}
walk('.');

let missingCount = 0;
console.log('TOTAL_USED_TOKENS=', used.size);
for (const [key, locs] of used) {
  const [prop, hex, opacity] = key.split(':');
  const selector = makeSelector(prop, hex, opacity);
  if (!css.includes(selector)) {
    missingCount++;
    // Report
    const opDisp = opacity ? '/' + opacity : '';
    console.log(`MISSING: ${prop} ${hex}${opDisp}`);
    console.log(`  Selector: ${selector} {`);
    // Suggest value based on heuristics
    const h = hex.toLowerCase();
    let cssProp, val, comment;
    if (prop.startsWith('bg') || prop.includes(':bg')) {
      cssProp = 'background-color';
      if (['#f8f6f0','#fbfaf7','#fff8e1'].includes(h)) { val='var(--paper)'; comment='light bg -> paper'; }
      else if (h==='#ffffff') { val='hsl(var(--card))'; }
      else if (['#1d2d50','#15223e'].includes(h)) { val='var(--brand-primary)'; }
      else if (h==='#243b63') { val='var(--brand-primary-hover)'; }
      else if (['#b83a4b','#9c2f3d'].includes(h)) { val='var(--brand-secondary)'; }
      else if (h==='#e5a93c') { val='var(--brand-tertiary)'; }
      else if (h==='#2d6a4f') { val='var(--success)'; }
      else if (h==='#1a1b26') { val='hsl(var(--card))'; }
      else if (h==='#e2e0d8') { val='#374151'; }
      else if (['#a0a2b1','#646675'].includes(h)) { val='var(--ink-disabled)'; }
      else { val='rgba(0,0,0,0.1)'; }
      if (opacity) {
        const alpha = parseInt(opacity)/100;
        if (val.startsWith('#')) {
          const r=parseInt(val.slice(1,3),16), g=parseInt(val.slice(3,5),16), b=parseInt(val.slice(5,7),16);
          val = `rgba(${r},${g},${b},${alpha})`;
        } else if (val.startsWith('hsl(')) {
          val = val.replace('hsl(', 'hsla(').replace(')', ', '+alpha+')');
        }
      }
    } else if (prop.startsWith('text') || prop.includes(':text')) {
      cssProp = 'color';
      if (['#f8f6f0','#fff'].includes(h)) { val='var(--ink)'; }
      else if (h==='#1a1b26') { val='var(--ink)'; }
      else if (['#646675','#a0a2b1'].includes(h)) { val='var(--ink-secondary)'; }
      else if (['#1d2d50','#15223e'].includes(h)) { val='var(--brand-primary)'; }
      else if (h==='#b83a4b') { val='var(--brand-secondary)'; }
      else if (h==='#e5a93c') { val='var(--brand-tertiary)'; }
      else if (h==='#2d6a4f') { val='var(--success)'; }
      else { val='currentColor'; }
    } else if (prop.startsWith('border') || prop.includes(':border')) {
      cssProp = 'border-color';
      if (h==='#e2e0d8') { val='#374151'; }
      else if (h==='#1d2d50') { val='var(--brand-primary)'; }
      else if (h==='#e5a93c') {
        if (opacity==='20') { val='rgba(250,204,21,0.2)'; }
        else if (opacity==='30') { val='rgba(250,204,21,0.3)'; }
        else { val='var(--brand-tertiary)'; }
      } else if (h==='#b83a4b') { val='var(--brand-secondary)'; }
      else if (h==='#f8f6f0') { val='hsl(var(--border))'; }
      else if (h==='#1a1b26') { val='var(--ink)'; }
      else if (h==='#15223e') { val='var(--brand-primary)'; }
      else { val='currentColor'; }
    } else if (prop.startsWith('placeholder') || prop.includes(':text')) {
      cssProp = 'color';
      val = 'var(--muted-foreground)';
    } else {
      cssProp = 'color';
      val = 'currentColor';
    }
    console.log(`  ${cssProp}: ${val};`);
    console.log('}');
    const files = [...new Set(locs.map(l => l.file))];
    console.log(`Used in: ${files.join(', ')}\n`);
  }
}
console.log('\nMISSING_COUNT=', missingCount);
