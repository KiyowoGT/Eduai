import fs from 'fs';
import { fileURLToPath } from 'url';

// 1. Extract all arbitrary color classes from JSX/TSX files
const usedMap = new Map(); // key: "prop:hex:opacity" -> array of "file:line"
function walk(dir) {
  for (const f of fs.readdirSync(dir)) {
    const p = fileURLToPath(dir + '/' + f);
    const st = fs.statSync(p);
    if (st.isDirectory()) {
      if (f !== 'node_modules' && f !== '.git') walk(p);
    } else if (/\.(jsx|tsx)$/.test(f)) {
      const content = fs.readFileSync(p, 'utf8');
      const lines = content.split('\n');
      // Match: optional prefix (hover:, focus:, active:, etc.), then bg|text|border, then [#hex], then optional /N
      const re = /((?:[a-z][a-z0-9-]*:)?)(bg|text|border)-\[(#[0-9A-Fa-f]{3,6})\](\/[0-9]+)?/g;
      for (let i = 0; i < lines.length; i++) {
        let m;
        while ((m = re.exec(lines[i])) !== null) {
          const prefix = m[1];
          const prop = m[2];
          const hex = m[3];
          const opacity = m[4] || '';
          // Normalize key: include prefix name (without colon) as part of prop if present
          let propKey = prop;
          if (prefix) propKey = prefix.slice(0, -1) + ':' + prop; // e.g., "hover:bg"
          let opKey = opacity;
          if (opKey.startsWith('/')) opKey = opKey.slice(1);
          const key = propKey + ':' + hex + ':' + opKey;
          if (!usedMap.has(key)) usedMap.set(key, []);
          usedMap.get(key).push({ file: p.replace(/^.*[\\/](?!.*[\\/])/, ''), line: i + 1, full: m[0] });
        }
        re.lastIndex = 0;
      }
    }
  }
}
walk('.');

// 2. Parse .dark selectors from index.css
const css = fs.readFileSync('index.css', 'utf8');
const darkMap = new Map(); // key -> {selector, declaration}

const lines = css.split('\n');
for (const line of lines) {
  if (!line.includes('.dark .') || !line.includes('{')) continue;
  
  const selStart = line.indexOf('.dark .');
  const openBraceIdx = line.indexOf('{');
  const selectorPart = line.substring(selStart, openBraceIdx).trim(); // e.g., ".dark .bg-\[#F8F6F0\]"
  const closeBraceIdx = line.indexOf('}', openBraceIdx);
  if (closeBraceIdx === -1) continue;
  const declaration = line.substring(openBraceIdx + 1, closeBraceIdx).trim();

  // Parse selectorPart: .dark .[hover:]prop-[#hex][/opacity]
  // Remove ".dark ." prefix
  const inner = selectorPart.substring(7);
  
  const isHover = inner.startsWith('hover:');
  let rest = isHover ? inner.substring(6) : inner; // remove "hover:"
  
  // Extract property name up to the opening bracket
  const bracketIdx = rest.indexOf('[');
  if (bracketIdx === -1) continue;
  const propEnd = bracketIdx;
  // propName is up to but not including the dash before bracket
  // The string looks like "bg-\[" so propEnd points to '[', and we need "bg" from before the preceding dash
  // Actually rest format: "bg-\[#xxxxx\]" so bracketIdx is at '[', and dash is right before it
  const propName = rest.substring(0, bracketIdx - 1); // "bg"
  
  // Extract hex between [ and ]
  const closeBracketIdx = rest.indexOf(']', bracketIdx);
  if (closeBracketIdx === -1) continue;
  let hex = rest.substring(bracketIdx + 1, closeBracketIdx).trim();
  // Hex may have trailing backslash from \] escape — it will show as "\" in the string
  if (hex.endsWith('\')) hex = hex.slice(0, -1);
  
  // Extract optional /opacity after the ]
  let opacity = '';
  const after = rest.substring(closeBracketIdx + 1);
  const slashMatch = after.match(/\\/([0-9]+)/);
  if (slashMatch) opacity = slashMatch[1];
  
  const prop = isHover ? 'hover:' + propName : propName;
  const key = prop + ':' + hex + ':' + opacity;
  
  darkMap.set(key, { selector: selectorPart, declaration });
}

// 3. Compute missing
const missing = [];
for (const [key, locations] of usedMap) {
  if (!darkMap.has(key)) {
    missing.push({ key, locations });
  }
}

// 4. Generate suggestions for each missing class
function suggestCSS(prop, hex, opacity) {
  // Determine appropriate dark-mode value based on semantic mapping
  const lowHex = hex.toLowerCase();
  // Helper: get rgba from hex with alpha
  const hexToRgba = (h, a) => {
    const r = parseInt(h.slice(1,3), 16);
    const g = parseInt(h.slice(3,5), 16);
    const b = parseInt(h.slice(5,7), 16);
    return `rgba(${r}, ${g}, ${b}, ${a})`;
  };

  let value;
  let comment = '';

  if (prop.startsWith('bg')) {
    if (['#f8f6f0', '#fbfaf7', '#fff8e1'].includes(lowHex)) {
      value = 'var(--paper)';
      comment = 'light card/background -> dark paper';
    } else if (lowHex === '#ffffff') {
      value = 'hsl(var(--card))';
      comment = 'white -> card surface';
    } else if (['#1d2d50', '#15223e'].includes(lowHex)) {
      value = 'var(--brand-primary)';
      comment = 'primary brand -> brand-primary';
    } else if (lowHex === '#243b63') {
      value = 'var(--brand-primary-hover)';
      comment = 'primary hover variant';
    } else if (['#b83a4b', '#9c2f3d'].includes(lowHex)) {
      value = 'var(--brand-secondary)';
      comment = 'secondary/danger brand';
    } else if (lowHex === '#e5a93c') {
      value = 'var(--brand-tertiary)';
      comment = 'accent/amber brand';
    } else if (lowHex === '#2d6a4f') {
      value = 'var(--success)';
      comment = 'success green';
    } else if (lowHex === '#1a1b26') {
      value = 'hsl(var(--card))';
      comment = 'almost-black -> card bg';
    } else if (lowHex === '#e2e0d8') {
      value = '#374151';
      comment = 'border light gray -> gray-600';
    } else if (lowHex === '#a0a2b1' || lowHex === '#646675') {
      value = 'var(--ink-disabled)';
      comment = 'disabled/muted text color';
    } else if (lowHex === '#f8f6f0') { // light bg
      value = 'var(--paper)';
      comment = 'paper bg';
    } else {
      value = 'rgba(0,0,0,0.1)';
      comment = 'fallback (tune as needed)';
    }
    // Handle opacity
    if (opacity) {
      const alpha = parseInt(opacity) / 100;
      if (value.startsWith('var(--')) {
        // Can't directly adjust alpha of CSS var; need to create rgba from var's base color
        // We'll use known base colors to compute rgba
        if (value.includes('--brand-primary')) { /* blue #3b82f6 */ }
        // For now, keep var and document issue; or compute manually for known ones
        value = value; // FIXME
      } else if (value.startsWith('#')) {
        value = hexToRgba(value, alpha);
      } else if (value.startsWith('hsl(')) {
        value = value.replace('hsl(', 'hsla(').replace(')', ', ' + alpha + ')');
      }
    }
  } else if (prop.startsWith('text')) {
    if (['#f8f6f0', '#fff'].includes(lowHex)) {
      value = 'var(--ink)'; // light on dark bg
    } else if (lowHex === '#1a1b26') {
      value = 'var(--ink)';
    } else if (['#646675', '#a0a2b1'].includes(lowHex)) {
      value = 'var(--ink-secondary)';
    } else if (lowHex === '#1d2d50' || lowHex === '#15223e') {
      value = 'var(--brand-primary)';
    } else if (lowHex === '#b83a4b') {
      value = 'var(--brand-secondary)';
    } else if (lowHex === '#e5a93c') {
      value = 'var(--brand-tertiary)';
    } else if (lowHex === '#2d6a4f') {
      value = 'var(--success)';
    } else if (lowHex === '#f8f6f0') {
      value = 'var(--ink)';
    } else {
      value = 'currentColor';
    }
  } else if (prop.startsWith('border')) {
    if (lowHex === '#e2e0d8') {
      value = '#374151';
    } else if (lowHex === '#1d2d50') {
      value = 'var(--brand-primary)';
    } else if (lowHex === '#e5a93c') {
      if (opacity === '20') value = 'rgba(250, 204, 21, 0.2)';
      else if (opacity === '30') value = 'rgba(250, 204, 21, 0.3)';
      else value = 'var(--brand-tertiary)';
    } else if (lowHex === '#b83a4b') {
      value = 'var(--brand-secondary)';
    } else if (lowHex === '#f8f6f0') {
      value = 'hsl(var(--border))';
    } else if (lowHex === '#1a1b26') {
      value = 'var(--ink)';
    } else if (lowHex === '#15223e') {
      value = 'var(--brand-primary)';
    } else {
      value = 'currentColor';
    }
  }
  
  return { value, comment };
}

// Generate output report
console.
