#!/usr/bin/env python3
"""Generate SigMap icon.png (128x128) and docs/sigmap-banner.png"""
from PIL import Image, ImageDraw
import math, os

def make_rounded_rect(draw, xy, radius, fill):
    x0, y0, x1, y1 = xy
    draw.rectangle([x0+radius, y0, x1-radius, y1], fill=fill)
    draw.rectangle([x0, y0+radius, x1, y1-radius], fill=fill)
    draw.ellipse([x0, y0, x0+2*radius, y0+2*radius], fill=fill)
    draw.ellipse([x1-2*radius, y0, x1, y0+2*radius], fill=fill)
    draw.ellipse([x0, y1-2*radius, x0+2*radius, y1], fill=fill)
    draw.ellipse([x1-2*radius, y1-2*radius, x1, y1], fill=fill)

def thick_line(draw, x0, y0, x1, y1, w, fill):
    dx, dy = x1-x0, y1-y0
    length = math.hypot(dx, dy)
    if length == 0:
        return
    nx, ny = -dy/length*w/2, dx/length*w/2
    pts = [(x0+nx, y0+ny), (x1+nx, y1+ny), (x1-nx, y1-ny), (x0-nx, y0-ny)]
    draw.polygon(pts, fill=fill)

def render_icon(size):
    """Render the SigMap icon at `size`x`size` pixels (render 4x, downscale)."""
    SCALE = 4
    S = size * SCALE

    img = Image.new('RGBA', (S, S), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)

    # Dark rounded background
    make_rounded_rect(d, [0, 0, S-1, S-1], int(22*SCALE), '#0f0f23')

    # Purple glow (top-centre bloom)
    for i in range(20, 0, -1):
        alpha = int(35 * (i/20))
        r = int(S * 0.55 * (i/20))
        cx_g, cy_g = int(0.44*S), int(0.38*S)
        glow = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        gd = ImageDraw.Draw(glow)
        gd.ellipse([cx_g-r, cy_g-r, cx_g+r, cy_g+r], fill=(124, 106, 247, alpha))
        img = Image.alpha_composite(img, glow)
    d = ImageDraw.Draw(img)

    # Sigma (Σ) shape centred on icon
    cx, cy = S * 0.46, S * 0.50
    W  = S * 0.46    # total width
    H  = S * 0.48    # total height
    t  = S * 0.052   # stroke thickness

    x0 = cx - W/2
    x1 = cx + W/2
    y0 = cy - H/2
    y1 = cy + H/2

    WHITE  = '#ffffff'
    PURPLE = '#7c6af7'

    # Top bar
    thick_line(d, x0, y0, x1, y0, t, WHITE)
    # Bottom bar
    thick_line(d, x0, y1, x1, y1, t, WHITE)
    # Left vertical spine (short cap)
    thick_line(d, x0, y0, x0, y1, t * 0.55, WHITE)
    # Top diagonal  \  (top-left → middle-right)
    thick_line(d, x0 + t*0.4, y0 + t*0.4, cx + t*0.3, cy, t, PURPLE)
    # Bottom diagonal / (middle-right → bottom-left)
    thick_line(d, cx + t*0.3, cy, x0 + t*0.4, y1 - t*0.4, t, PURPLE)

    # Three signature scan lines on the right
    line_x0 = cx + S*0.04
    line_x1 = cx + W/2 - S*0.03
    line_ys  = [cy - S*0.10, cy, cy + S*0.10]
    line_len = [0.65, 0.50, 0.80]   # relative lengths
    line_th  = int(t * 0.38)

    for ly, lw in zip(line_ys, line_len):
        bar = Image.new('RGBA', (S, S), (0, 0, 0, 0))
        bd  = ImageDraw.Draw(bar)
        end_x = line_x0 + (line_x1 - line_x0) * lw
        thick_line(bd, int(line_x0), int(ly), int(end_x), int(ly),
                   line_th, (124, 106, 247, 200))
        img = Image.alpha_composite(img, bar)
    d = ImageDraw.Draw(img)

    # Downscale with Lanczos for clean antialiasing
    return img.resize((size, size), Image.LANCZOS)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # repo root

# ── 128×128 extension icon ────────────────────────────────────────────────────
icon = render_icon(128)
icon_path = os.path.join(ROOT, 'vscode-extension', 'icon.png')
icon.save(icon_path)
print(f'icon:   {icon_path}  ({os.path.getsize(icon_path):,} bytes)')

# ── 512×128 npm / docs banner ────────────────────────────────────────────────
icon_512 = render_icon(512)
BANNER_W, BANNER_H = 1280, 320
banner = Image.new('RGBA', (BANNER_W, BANNER_H), '#0f0f23')

# Place the large icon on the left with some padding
pad = 30
banner.paste(icon_512, (pad, (BANNER_H - 512) // 2 + 10), icon_512)

# Right side: try to add text, fall back silently if font unavailable
try:
    from PIL import ImageFont
    try:
        font_big  = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 96)
        font_sub  = ImageFont.truetype('/System/Library/Fonts/Helvetica.ttc', 38)
    except Exception:
        font_big  = ImageFont.load_default()
        font_sub  = font_big

    bd = ImageDraw.Draw(banner)
    tx = pad + 512 + 60
    ty = BANNER_H // 2 - 80
    bd.text((tx, ty),        'SigMap',   fill='#ffffff',  font=font_big)
    bd.text((tx, ty + 110),  'Zero-dependency AI context engine',
            fill='#7c6af7', font=font_sub)
    bd.text((tx, ty + 160),  '97% token reduction · 21 languages · Node 18+',
            fill='#888888', font=font_sub)
except Exception as e:
    print(f'  (text layer skipped: {e})')

# Crop to a nice 16:4 ratio
banner_final = banner.resize((1280, 320), Image.LANCZOS)
banner_path  = os.path.join(ROOT, 'docs', 'sigmap-banner.png')
banner_final.save(banner_path)
print(f'banner: {banner_path}  ({os.path.getsize(banner_path):,} bytes)')
