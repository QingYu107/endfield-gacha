# -*- coding: utf-8 -*-
"""Contact sheet of bust crops for visual QA of head/body alignment."""
import os
from PIL import Image, ImageDraw

ROOT = r"E:\dsh-workspace\endfield-gacha"
SRC = os.path.join(ROOT, "assets", "bust")
OUT = r"E:\dsh-workspace\_shots\bust_sheet.png"

files = sorted(f for f in os.listdir(SRC) if f.endswith(".webp"))
COLS, ROWS = 8, 4
CW, CH = 118, 300
PAD = 6
sheet = Image.new("RGB", (COLS * (CW + PAD) + PAD, ROWS * (CH + 26 + PAD) + PAD), (10, 12, 14))
d = ImageDraw.Draw(sheet)

for i, f in enumerate(files):
    im = Image.open(os.path.join(SRC, f)).convert("RGBA")
    bg = Image.new("RGBA", im.size, (18, 20, 24, 255))
    bg.alpha_composite(im)
    im = bg.convert("RGB")
    im.thumbnail((CW, CH), Image.LANCZOS)
    x = PAD + (i % COLS) * (CW + PAD)
    y = PAD + (i // COLS) * (CH + 26 + PAD)
    sheet.paste(im, (x + (CW - im.width) // 2, y))
    d.rectangle([x, y, x + CW - 1, y + CH - 1], outline=(60, 66, 74))
    # mark expected head line at 8.5% and 15.5%
    for frac, col in ((0.085, (255, 200, 80)), (0.155, (255, 90, 80))):
        yy = y + int(CH * frac)
        d.line([x, yy, x + CW, yy], fill=col, width=1)
    d.text((x + 2, y + CH + 4), f.replace("chr_", "")[:22], fill=(150, 158, 166))

os.makedirs(os.path.dirname(OUT), exist_ok=True)
sheet.save(OUT)
print(OUT, sheet.size)
