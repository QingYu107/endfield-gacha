# -*- coding: utf-8 -*-
"""Fast re-crop of busts from saved anchors (no feature matching)."""
import os, json, sys
from PIL import Image, ImageDraw

ROOT = r"E:\dsh-workspace\endfield-gacha"
SRC = os.path.join(ROOT, "assets", "stage")
DST = os.path.join(ROOT, "assets", "bust")
ANCH = json.load(open(os.path.join(ROOT, "data", "bust_anchors.json"), encoding="utf-8"))
ASPECT = 3.25
OUT_W = 320

HEAD_AT = float(sys.argv[1]) if len(sys.argv) > 1 else 0.205
SCALE = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
TAG = sys.argv[3] if len(sys.argv) > 3 else "a"
DRY = "--dry" in sys.argv

rows = []
for f, rec in sorted(ANCH.items()):
    p = os.path.join(SRC, f)
    if not os.path.exists(p):
        continue
    pim = Image.open(p).convert("RGBA")
    W, H = pim.size
    hx, hy = rec["hx"] * W, rec["hy"] * H
    crop_h = rec["crop_h"] * SCALE
    crop_h = min(max(crop_h, 0.36 * H), 0.90 * H)
    cw = max(24, int(round(crop_h / ASPECT)))
    ch = max(24, int(round(crop_h)))
    x0 = int(round(hx - cw / 2))
    y0 = int(round(hy - HEAD_AT * ch))
    canvas = Image.new("RGBA", (cw, ch), (0, 0, 0, 0))
    sx0, sy0, sx1, sy1 = x0, y0, x0 + cw, y0 + ch
    px = py = 0
    if sx0 < 0:
        px, sx0 = -sx0, 0
    if sy0 < 0:
        py, sy0 = -sy0, 0
    sx1, sy1 = min(W, sx1), min(H, sy1)
    if sx1 > sx0 and sy1 > sy0:
        piece = pim.crop((sx0, sy0, sx1, sy1))
        canvas.paste(piece, (px, py), piece)
    if not DRY:
        nh = int(round(canvas.height * OUT_W / canvas.width))
        canvas.resize((OUT_W, nh), Image.LANCZOS).save(os.path.join(DST, f), "WEBP", quality=88, method=5)
    rows.append((f, canvas))

CW, CH = 150, 500
cols = 7
r = (len(rows) + cols - 1) // cols
sheet = Image.new("RGB", (CW * cols, (CH + 20) * r), (8, 10, 12))
d = ImageDraw.Draw(sheet)
for i, (f, im) in enumerate(rows):
    bg = Image.new("RGBA", im.size, (14, 16, 20, 255))
    bg.alpha_composite(im)
    im2 = bg.convert("RGB")
    im2.thumbnail((CW - 6, CH - 6), Image.LANCZOS)
    x = (i % cols) * CW + 3
    y = (i // cols) * (CH + 20) + 3
    sheet.paste(im2, (x, y))
    d.text((x, y + CH - 12), f.replace("chr_", "").replace(".webp", "")[:18], fill=(150, 158, 166))
sheet.save(rf"E:\dsh-workspace\_shots\recrop_{TAG}.png")
print("done", len(rows), "head_at", HEAD_AT, "scale", SCALE, "dry", DRY)