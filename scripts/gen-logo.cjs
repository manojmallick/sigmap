#!/usr/bin/env node
/**
 * gen-logo.cjs — generate SigMap logo PNGs for VS Code + JetBrains
 *
 * Usage:
 *   NODE_PATH=$(npm root -g) node scripts/gen-logo.cjs
 *
 * Requires: sharp  (npm install -g sharp)
 *
 * Outputs:
 *   vscode-extension/icon.png                              128×128
 *   jetbrains-plugin/src/main/resources/META-INF/pluginIcon.png  40×40
 *   assets/sigmap-logo.svg                                 512×512 source
 */
'use strict';
const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');

const ROOT = path.join(__dirname, '..');

// ─── SVG design ──────────────────────────────────────────────────────────────
// Visual concept:
//   • Deep indigo → violet gradient background (rounded square)
//   • S-curve waveform path  (sig = signature / signal)
//   • Three map-pin dots along the path  (map = graph of files)
//   • "sm" monogram bottom-right at ≥ 80 px for legibility
// ─────────────────────────────────────────────────────────────────────────────
function makeSvg(size) {
  const s  = size;
  const r  = Math.round(size * 0.19);
  const sc = (v) => Number(((v / 128) * s).toFixed(2));

  const waveD = [
    `M ${sc(18)} ${sc(68)}`,
    `C ${sc(30)} ${sc(34)}, ${sc(54)} ${sc(34)}, ${sc(64)} ${sc(64)}`,
    `C ${sc(74)} ${sc(94)}, ${sc(98)} ${sc(94)}, ${sc(110)} ${sc(60)}`,
  ].join(' ');

  const dots = [
    { x: sc(18),  y: sc(68), r: sc(5.5), fill: '#818cf8' },
    { x: sc(64),  y: sc(64), r: sc(7),   fill: '#a78bfa' },
    { x: sc(110), y: sc(60), r: sc(5.5), fill: '#c084fc' },
  ];

  const dotsSvg = dots
    .map(d => `<circle cx="${d.x}" cy="${d.y}" r="${d.r}" fill="${d.fill}" opacity="0.92"/>`)
    .join('\n    ');

  const monoSvg = size >= 80
    ? `<text x="${sc(102)}" y="${sc(114)}"
         font-family="'SF Mono','JetBrains Mono','Fira Code',monospace"
         font-size="${sc(19)}" font-weight="700" fill="#c4b5fd" opacity="0.75"
         text-anchor="middle" letter-spacing="-0.5">sm</text>`
    : '';

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="${s}" y2="${s}" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="#1a1740"/>
      <stop offset="100%" stop-color="#2e2070"/>
    </linearGradient>
    <linearGradient id="wave" x1="${sc(18)}" y1="${sc(64)}" x2="${sc(110)}" y2="${sc(64)}" gradientUnits="userSpaceOnUse">
      <stop offset="0%"   stop-color="#818cf8"/>
      <stop offset="100%" stop-color="#c084fc"/>
    </linearGradient>
    <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="${sc(2.5)}" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>
  <rect width="${s}" height="${s}" rx="${r}" fill="url(#bg)"/>
  <line x1="0" y1="${sc(42)}" x2="${s}" y2="${sc(42)}" stroke="#ffffff" stroke-width="0.6" opacity="0.05"/>
  <line x1="0" y1="${sc(86)}" x2="${s}" y2="${sc(86)}" stroke="#ffffff" stroke-width="0.6" opacity="0.05"/>
  <path d="${waveD}" stroke="url(#wave)" stroke-width="${sc(9)}" fill="none"
        stroke-linecap="round" opacity="0.25" filter="url(#glow)"/>
  <path d="${waveD}" stroke="url(#wave)" stroke-width="${sc(5.5)}" fill="none"
        stroke-linecap="round"/>
  ${dotsSvg}
  ${monoSvg}
</svg>`;
}

const targets = [
  {
    svg:    makeSvg(128),
    out:    path.join(ROOT, 'vscode-extension', 'icon.png'),
    size:   128,
    label:  'VS Code icon     (128×128)',
  },
  {
    svg:    makeSvg(40),
    out:    path.join(ROOT, 'jetbrains-plugin', 'src', 'main', 'resources', 'META-INF', 'pluginIcon.png'),
    size:   40,
    label:  'JetBrains icon   (40×40)',
  },
  {
    svg:    makeSvg(512),
    svgOut: path.join(ROOT, 'assets', 'sigmap-logo.svg'),
    label:  'Master SVG       (512×512)',
  },
];

(async () => {
  console.log('Generating SigMap logos...\n');
  for (const t of targets) {
    if (t.svgOut) {
      fs.mkdirSync(path.dirname(t.svgOut), { recursive: true });
      fs.writeFileSync(t.svgOut, t.svg, 'utf8');
      console.log(`  SVG  ${t.label} → ${path.relative(ROOT, t.svgOut)}`);
      continue;
    }
    fs.mkdirSync(path.dirname(t.out), { recursive: true });
    await sharp(Buffer.from(t.svg))
      .resize(t.size, t.size)
      .png({ compressionLevel: 9 })
      .toFile(t.out);
    console.log(`  PNG  ${t.label} → ${path.relative(ROOT, t.out)}`);
  }
  console.log('\nDone. To regenerate: NODE_PATH=$(npm root -g) node scripts/gen-logo.cjs');
})();
