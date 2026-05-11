'use strict';

/**
 * Extract signatures from Godot GDScript source code.
 * @param {string} src - Raw file content
 * @returns {string[]} Array of signature strings
 */

function extract(src) {
  if (!src || typeof src !== 'string') return [];
  const sigs = [];

  const stripped = src.replace(/#.*$/gm, '');

  let className = null;
  let baseName = null;
  const addedClasses = new Set();

  const cm = stripped.match(/^class_name\s+(\w+)(?:\s+extends\s+([\w.]+))?/m);
  if (cm) {
    className = cm[1];
    if (cm[2]) baseName = cm[2];
  }
  if (!baseName) {
    const em = stripped.match(/^extends\s+([\w."/]+)/m);
    if (em) baseName = em[1];
  }

  if (className) {
    sigs.push(baseName ? `class ${className}(${baseName})` : `class ${className}`);
    addedClasses.add(className);
  } else if (baseName) {
    sigs.push(`extends ${baseName}`);
  }

  const indent = (className || baseName) ? '  ' : '';

  for (const m of stripped.matchAll(/^signal\s+(\w+)(?:\s*\(([^)]*)\))?/gm)) {
    sigs.push(`${indent}signal ${m[1]}(${normalizeParams(m[2] || '')})`);
  }

  for (const m of stripped.matchAll(/^enum\s+(\w+)\s*\{([^}]*)\}/gm)) {
    const members = m[2]
      .split(',')
      .map((s) => s.trim().split(/\s*=/)[0].trim())
      .filter(Boolean);
    sigs.push(`${indent}enum ${m[1]} { ${members.slice(0, 6).join(', ')} }`);
  }

  let constCount = 0;
  for (const m of stripped.matchAll(/^const\s+(\w+)(?:\s*:\s*[^=\n]+)?\s*:?=\s*([^\n]+)$/gm)) {
    let val = m[2].trim();
    const preloadMatch = val.match(/^preload\s*\(([^)]+)\)/);
    if (preloadMatch) {
      val = `preload(${preloadMatch[1]})`;
    } else if (val.length > 40) {
      val = val.slice(0, 37) + '...';
    }
    sigs.push(`${indent}const ${m[1]} = ${val}`);
    if (++constCount >= 5) break;
  }

  for (const m of stripped.matchAll(/^((?:@\w+(?:\([^)]*\))?\s+)*)var\s+(\w+)(?:\s*:\s*([^=\n]+?))?(?:\s*:?=\s*[^\n]+)?$/gm)) {
    const decorators = m[1] || '';
    const name = m[2];
    const hasDecorator = /@\w+/.test(decorators);
    if (!hasDecorator && name.startsWith('_')) continue;
    
    let prefix = decorators.replace(/\([^)]*\)/g, '').trim().split(/\s+/).join(' ');
    if (prefix) prefix += ' ';
    
    const type = (m[3] || '').trim();
    const typeStr = type ? `: ${type}` : '';
    sigs.push(`${indent}${prefix}var ${name}${typeStr}`);
  }

  for (const m of stripped.matchAll(/^(static\s+)?func\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:\n]+))?\s*:/gm)) {
    const params = normalizeParams(m[3]);
    const ret = (m[4] || '').trim();
    const retStr = ret ? ` → ${ret.slice(0, 30)}` : '';
    const staticKw = m[1] ? 'static ' : '';
    sigs.push(`${indent}${staticKw}func ${m[2]}(${params})${retStr}`);
  }

  for (const m of stripped.matchAll(/^class\s+(\w+)(?:\s+extends\s+(\w+))?\s*:/gm)) {
    if (addedClasses.has(m[1])) continue;
    addedClasses.add(m[1]);
    sigs.push(m[2] ? `class ${m[1]}(${m[2]})` : `class ${m[1]}`);
    const startIdx = m.index + m[0].length;
    for (const meth of extractInnerMembers(stripped, startIdx)) {
      sigs.push(`  ${meth}`);
    }
  }

  return sigs.slice(0, 25);
}

function extractInnerMembers(stripped, startIndex) {
  const members = [];
  const lines = stripped.slice(startIndex).split('\n');
  for (const line of lines) {
    if (line.trim() === '') continue;
    if (!/^\s+/.test(line)) break;
    const fm = line.match(/^\s+(static\s+)?func\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:\n]+))?\s*:/);
    if (fm) {
      const params = normalizeParams(fm[3]);
      const ret = (fm[4] || '').trim();
      const retStr = ret ? ` → ${ret.slice(0, 30)}` : '';
      const staticKw = fm[1] ? 'static ' : '';
      members.push(`${staticKw}func ${fm[2]}(${params})${retStr}`);
    }
  }
  return members.slice(0, 6);
}

function normalizeParams(params) {
  if (!params) return '';
  return params.trim()
    .split(',')
    .map((p) => {
      const part = p.trim();
      if (!part) return '';
      const eqIdx = part.indexOf('=');
      const noDefault = eqIdx !== -1 ? part.slice(0, eqIdx).trim() : part;
      return noDefault.split(':')[0].trim();
    })
    .filter(Boolean)
    .join(', ');
}

module.exports = { extract };
