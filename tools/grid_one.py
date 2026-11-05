# -*- coding: utf-8 -*-
"""Coordinate grid over a stage image, for hand-reading an anchor."""
import sys, os
from PIL import Image, ImageDraw

ROOT = r"E:\dsh-workspace\endfield-gacha"
OUT = r"E:\dsh-workspace\_shots"
ids = sys.argv[1:] or ["chr_0038_purrche", "chr_0029_pograni", "chr_0016_laevat"]
tiles = []
for cid in ids:
    im = Image.open(os.path.join(ROOT, "assets", "stage", cid + ".webp")).convert("RGBA")
    bg = Image.new("RGBA", im.size, (22, 24, 28, 255))
    bg.alpha_composite(im)
    im = bg.convert("RGB")
    im.thumbnail((520, 640), Image.LANCZOS)
    d = ImageDraw.Draw(im)
    W, H = im.size
    for k in range(1, 10):
        x = W * k / 10
        y = H * k / 10
        d.line([(x, 0), (x, H)], fill=(255, 60, 60, 90), width=1)
        d.line([(0, y), (W, y)], fill=(255, 60, 60, 90), width=1)
        d.text((x + 2, 2), "%.1f" % (k / 10), fill=(255, 120, 120))
        d.text((2, y + 1), "%.1f" % (k / 10), fill=(120, 200, 255))
    d.text((4, H - 14), cid, fill=(230, 230, 230))
    tiles.append(im)

w = sum(t.width for t in tiles) + 8 * len(tiles)
h = max(t.height for t in tiles) + 8
sheet = Image.new("RGB", (w, h), (10, 12, 14))
x = 4
for t in tiles:
    sheet.paste(t, (x, 4))
    x += t.width + 8
p = os.path.join(OUT, "grid_" + ids[0][4:] + ".png")
sheet.save(p)
print(p)
