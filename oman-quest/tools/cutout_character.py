"""Cut the hero out of her white-background portrait and split her into
puppet parts (body, left leg, right leg) so the game can animate her
without redrawing her face or clothing.  Usage:
    python3 -I tools/cutout_character.py <source.png> src/assets
"""
import sys
from collections import deque
from PIL import Image, ImageFilter
import numpy as np

src, out = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
a = np.asarray(im).astype(int)
h, w, _ = a.shape
near_white = (a.min(axis=2) > 236) & ((a.max(axis=2) - a.min(axis=2)) < 22)

# Flood fill background from the borders so enclosed whites (pearls) survive.
bg = np.zeros((h, w), bool)
q = deque()
for x in range(w):
    for y in (0, h - 1):
        if near_white[y, x]: bg[y, x] = True; q.append((y, x))
for y in range(h):
    for x in (0, w - 1):
        if near_white[y, x] and not bg[y, x]: bg[y, x] = True; q.append((y, x))
while q:
    y, x = q.popleft()
    for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
        ny, nx = y + dy, x + dx
        if 0 <= ny < h and 0 <= nx < w and near_white[ny, nx] and not bg[ny, nx]:
            bg[ny, nx] = True; q.append((ny, nx))

alpha = Image.fromarray(np.where(bg, 0, 255).astype('uint8'))
alpha = alpha.filter(ImageFilter.MinFilter(3)).filter(ImageFilter.GaussianBlur(1.2))
# Keep only the largest opaque blob (drops stray shadow specks by the shoes).
m = np.asarray(alpha) > 20
lab = np.zeros(m.shape, int); cur = 0; sizes = {}
for sy, sx in zip(*np.nonzero(m)):
    if lab[sy, sx]: continue
    cur += 1; lab[sy, sx] = cur; dq = deque([(sy, sx)]); n = 0
    while dq:
        y, x = dq.popleft(); n += 1
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and m[ny, nx] and not lab[ny, nx]:
                lab[ny, nx] = cur; dq.append((ny, nx))
    sizes[cur] = n
keep = max(sizes, key=sizes.get)
alpha = Image.fromarray(np.where(lab == keep, np.asarray(alpha), 0).astype('uint8'))
rgba = im.copy(); rgba.putalpha(alpha)
bbox = alpha.point(lambda v: 255 if v > 20 else 0).getbbox()
rgba = rgba.crop(bbox)
A = np.asarray(rgba)[:, :, 3]
H, W = A.shape
print('cropped', W, H, 'bbox', bbox)

# Find the hip line: first row (from 60% height) where opaque runs split in two
# with a clear gap near the middle → that's where the legs separate.
def runs(row):
    r, on, s = [], False, 0
    for i, v in enumerate(row > 128):
        if v and not on: on, s = True, i
        if not v and on: on = False; r.append((s, i))
    if on: r.append((s, len(row)))
    return r

split_y = None
for y in range(int(H * 0.66), int(H * 0.9)):
    rr = [r for r in runs(A[y]) if r[1] - r[0] > 25]
    if len(rr) == 2 and rr[1][0] - rr[0][1] > 4:
        split_y = y; gap_x = (rr[0][1] + rr[1][0]) // 2; break
print('split_y', split_y, 'gap_x', gap_x)
# The robe hem (purple band) ends at ~71% of her height; legs start just above
# it and are drawn behind the body, so the hem hides the joint while they swing.
hem_y = int(H * 0.713)
hip = hem_y - 50

full = rgba
full.resize((W // 2, H // 2), Image.LANCZOS).save(f'{out}/hero-full.png', optimize=True)
body = full.crop((0, 0, W, hem_y))
def leg(x0, x1):
    # Start at the hem and stretch the top trouser rows upward so the leg can
    # rotate under the robe without showing a hole at the hip.
    part = full.crop((x0, hem_y, x1, H))
    top = part.crop((0, 2, part.width, 10)).resize((part.width, hem_y - hip))
    out_img = Image.new('RGBA', (part.width, part.height + top.height))
    out_img.paste(top, (0, 0)); out_img.paste(part, (0, top.height))
    return out_img
legL = leg(0, gap_x)
legR = leg(gap_x, W)
s = 0.5
for name, part in (('hero-body', body), ('hero-leg-l', legL), ('hero-leg-r', legR)):
    part.resize((max(1, int(part.width * s)), max(1, int(part.height * s))), Image.LANCZOS).save(f'{out}/{name}.png', optimize=True)
import json
json.dump({'width': W, 'height': H, 'splitY': hem_y, 'hipY': hip, 'gapX': gap_x}, open(f'{out}/hero-rig.json', 'w'))
