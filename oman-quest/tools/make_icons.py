"""Build the app icons (home-screen icon) from the hero art.
Usage: python3 -I tools/make_icons.py src/assets/hero-full.png public/icons"""
import sys
from PIL import Image, ImageDraw, ImageFilter
src, out = sys.argv[1], sys.argv[2]
hero = Image.open(src).convert('RGBA')
# head-and-shoulders crop
w, h = hero.size
bust = hero.crop((0, 0, w, int(h * 0.52)))

def icon(size, maskable=False):
    S = 1024
    im = Image.new('RGBA', (S, S))
    # purple → turquoise diagonal gradient
    g = Image.new('RGBA', (S, S))
    px = g.load()
    for y in range(S):
        for x in range(S):
            t = (x + y) / (2 * S)
            px[x, y] = (int(75 + (24 - 75) * t), int(31 + (198 - 31) * t), int(158 + (180 - 158) * t), 255)
    im.alpha_composite(g)
    d = ImageDraw.Draw(im)
    pad = 120 if maskable else 40
    # gold ring + soft glow
    glow = Image.new('RGBA', (S, S)); gd = ImageDraw.Draw(glow)
    gd.ellipse((pad + 30, pad + 30, S - pad - 30, S - pad - 30), fill=(255, 230, 160, 70))
    im.alpha_composite(glow.filter(ImageFilter.GaussianBlur(40)))
    d.ellipse((pad + 40, pad + 40, S - pad - 40, S - pad - 40), outline=(255, 211, 77, 255), width=28)
    # 8-point star sparkles
    for (cx, cy, r) in [(pad + 150, pad + 170, 34), (S - pad - 150, pad + 200, 26), (S - pad - 170, S - pad - 230, 30)]:
        for rot in (0, 45):
            sq = Image.new('RGBA', (r * 3, r * 3)); sd = ImageDraw.Draw(sq)
            sd.rectangle((r * 0.8, r * 0.8, r * 2.2, r * 2.2), fill=(255, 230, 120, 255))
            sq = sq.rotate(rot)
            im.alpha_composite(sq, (int(cx - r * 1.5), int(cy - r * 1.5)))
    # hero bust, clipped to the circle
    inner = S - 2 * (pad + 68)
    sc = inner * 1.0 / bust.width
    b = bust.resize((int(bust.width * sc), int(bust.height * sc)), Image.LANCZOS)
    layer = Image.new('RGBA', (S, S))
    layer.alpha_composite(b, ((S - b.width) // 2, S - pad - 68 - b.height))
    mask = Image.new('L', (S, S)); ImageDraw.Draw(mask).ellipse((pad + 68, pad + 68, S - pad - 68, S - pad - 68), fill=255)
    clipped = Image.new('RGBA', (S, S)); clipped.paste(layer, (0, 0), Image.composite(layer.split()[3], Image.new('L', (S, S)), mask))
    im.alpha_composite(clipped)
    return im.resize((size, size), Image.LANCZOS)

for s in (192, 512):
    icon(s).save(f'{out}/icon-{s}.png', optimize=True)
icon(512, maskable=True).save(f'{out}/icon-maskable-512.png', optimize=True)
icon(180).convert('RGB').save(f'{out}/apple-touch-icon.png', optimize=True)
icon(64).save(f'{out}/favicon.png', optimize=True)
