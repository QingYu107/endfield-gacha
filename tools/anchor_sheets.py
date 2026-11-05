# -*- coding: utf-8 -*-
"""Grid sheets for manual head-anchor reading."""
import os, sys
from PIL import Image, ImageDraw, ImageFont

ROOT = r"E:\dsh-workspace\endfield-gacha"
SRC = os.path.join(ROOT, "assets", "stage")
OUT = r"E:\dsh-workspace\_shots"
os.makedirs(OUT, exist_ok=True)

files = sorted(f for f in os.listdir(SRC) if f.endswith(".webp"))
per = 8
try:
    font = ImageFont.truetype("C:/Windows/Fonts/consola.ttf", 11)
except Exception:
    font = ImageFont.load_default()

for s in range(0, len(files), per):
    batch = files[s:s + per]
    CW, CH = 210, 300
    cols = 4
    rows = (len(batch) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (CW + 10) + 10, rows * (CH + 34) + 10), (8, 10, 12))
    d = ImageDraw.Draw(sheet)
    for i, f in enumerate(batch):
        im = Image.open(os.path.join(SRC, f)).convert("RGBA")
        bg = Image.new("RGBA", im.size, (26, 28, 32, 255))
        bg.alpha_composite(im)
        im = bg.convert("RGB")
        im.thumbnail((CW, CH), Image.LANCZOS)
        x = 10 + (i % cols) * (CW + 10)
        y = 26 + (i // cols) * (CH + 34)
        sheet.paste(im, (x, y))
        d.rectangle([x, y, x + im.width, y + im.height], outline=(70, 78, 86))
        # 10% grid
        for k in range(1, 10):
            gx = x + im.width * k / 10
            gy = y + im.height * k / 10
            d.line([gx, y, gx, y + im.height], fill=(60, 66, 74))
            d.line([x, gy, x + im.width, gy], fill=(60, 66, 74))
        # axis labels
        for k in range(10):
            d.text((x + im.width * (k + 0.5) / 10 - 2, y - 12), str(k), fill=(120, 128, 136), font=font)
            d.text((x - 8, y + im.height * (k + 0.5) / 10 - 4), str(k), fill=(120, 128, 136), font=font)
        d.text((x, y + im.height + 6), f.replace("chr_", ""), fill=(200, 208, 216), font=font)
    path = os.path.join(OUT, "grid_%d.png" % (s // per + 1))
    sheet.save(path)
    print(path, [f.replace("chr_", "").replace(".webp", "") for f in batch])
