#!/usr/bin/env node
/**
 * gen-logo.cjs — generate ALL SigMap brand assets from one source of truth
 *
 * Usage:
 *   NODE_PATH=$(npm root -g) node scripts/gen-logo.cjs
 *
 * Requires: sharp  (npm install -g sharp)
 *
 * Outputs (all auto-generated — do not hand-edit):
 *   assets/sigmap-logo.svg                                    512×512 master SVG
 *   assets/logo.png                                           128×128 README logo
 *   vscode-extension/icon.png                                 128×128 VS Code Marketplace
 *   jetbrains-plugin/.../META-INF/pluginIcon.png               40×40  JetBrains Plugin Repo
 *   docs-vp/.vitepress/public/favicon.png                     128×128 site favicon
 *   docs/sigmap-banner.png                                    1200×630 OG / Twitter card
 */
'use strict';
const sharp = require('sharp');
const fs    = require('fs');
const path  = require('path');

const ROOT = path.join(__dirname, '..');

// ─── Icon SVG (square, gradient bg + waveform) ───────────────────────────────
function makeIconSvg(size) {
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

// ─── Social banner SVG 1200×630 ──────────────────────────────────────────────
const bannerSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1200" y2="630" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#0f0d20"/>
      <stop offset="100%" stop-color="#1a1450"/>
    </linearGradient>
    <linearGradient id="wave" x1="60" y1="315" x2="540" y2="315" gradientUnits="userSpaceOnUse">
      <stop offset="0%" stop-color="#818cf8"/>
      <stop offset="100%" stop-color="#c084fc"/>
    </linearGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <line x1="0" y1="210" x2="1200" y2="210" stroke="#ffffff" stroke-width="1" opacity="0.04"/>
  <line x1="0" y1="420" x2="1200" y2="420" stroke="#ffffff" stroke-width="1" opacity="0.04"/>
  <line x1="400" y1="0" x2="400" y2="630" stroke="#ffffff" stroke-width="1" opacity="0.04"/>
  <line x1="800" y1="0" x2="800" y2="630" stroke="#ffffff" stroke-width="1" opacity="0.04"/>
  <!-- Waveform mark -->
  <path d="M 60 340 C 120 180, 240 180, 300 315 C 360 450, 480 450, 540 295"
        stroke="url(#wave)" stroke-width="28" fill="none"
        stroke-linecap="round" opacity="0.18" filter="url(#glow)"/>
  <path d="M 60 340 C 120 180, 240 180, 300 315 C 360 450, 480 450, 540 295"
        stroke="url(#wave)" stroke-width="14" fill="none" stroke-linecap="round"/>
  <circle cx="60"  cy="340" r="18" fill="#818cf8" opacity="0.9"/>
  <circle cx="300" cy="315" r="22" fill="#a78bfa" opacity="0.9"/>
  <circle cx="540" cy="295" r="18" fill="#c084fc" opacity="0.9"/>
  <!-- Wordmark -->
  <text x="610" y="290"
        font-family="'SF Pro Display','Helvetica Neue',Arial,sans-serif"
        font-size="120" font-weight="800" fill="#ffffff" opacity="0.97"
        letter-spacing="-3">SigMap</text>
  <text x="613" y="356"
        font-family="'SF Pro Display','Helvetica Neue',Arial,sans-serif"
        font-size="36" font-weight="400" fill="#a5b4fc" opacity="0.88">Zero-dependency AI context engine</text>
  <text x="613" y="430"
        font-family="'SF Mono','JetBrains Mono','Fira Code',monospace"
        font-size="28" font-weight="500" fill="#818cf8" opacity="0.75"
        letter-spacing="0.5">97% token reduction · 29 languages · 6× lift</text>
  <line x1="610" y1="470" x2="1140" y2="470" stroke="#818cf8" stroke-width="1.5" opacity="0.25"/>
  <text x="613" y="510"
        font-family="'SF Mono','JetBrains Mono',monospace"
        font-size="22" fill="#6366f1" opacity="0.6">sigmap.dev</text>
</svg>`;

// ─── Output targets ───────────────────────────────────────────────────────────
const targets = [
  // Master SVG source
  { svg: makeIconSvg(512), svgOut: 'assets/sigmap-logo.svg',        label: 'Master SVG        (512×512)' },
  // Plugin icons
  { svg: makeIconSvg(128), out: 'vscode-extension/icon.png',        size: 128, label: 'VS Code icon      (128×128)' },
  { svg: makeIconSvg(40),  out: 'jetbrains-plugin/src/main/resources/META-INF/pluginIcon.png', size: 40, label: 'JetBrains icon    (40×40)' },
  // Site assets
  { svg: makeIconSvg(128), out: 'docs-vp/.vitepress/public/favicon.png', size: 128, label: 'Favicon           (128×128)' },
  // README logo (PNG so GitHub renders gradient correctly)
  { svg: makeIconSvg(128), out: 'assets/logo.png',                  size: 128, label: 'README logo       (128×128)' },
  // Social / OG banner
  { svg: bannerSvg,        out: 'docs/sigmap-banner.png',           size: [1200, 630], label: 'OG banner         (1200×630)' },
];

(async () => {
  console.log('Generating SigMap brand assets...\n');
  for (const t of targets) {
    if (t.svgOut) {
      const abs = path.join(ROOT, t.svgOut);
      fs.mkdirSync(path.dirname(abs), { recursive: true });
      fs.writeFileSync(abs, t.svg, 'utf8');
      console.log(`  SVG  ${t.label} → ${t.svgOut}`);
      continue;
    }
    const abs = path.join(ROOT, t.out);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    const [w, h] = Array.isArray(t.size) ? t.size : [t.size, t.size];
    await sharp(Buffer.from(t.svg))
      .resize(w, h)
      .png({ compressionLevel: 9 })
      .toFile(abs);
    console.log(`  PNG  ${t.label} → ${t.out}`);
  }
  console.log('\nDone. To regenerate: NODE_PATH=$(npm root -g) node scripts/gen-logo.cjs');
})();
