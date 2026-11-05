# -*- coding: utf-8 -*-
"""Detect the face using skin-tone clustering (anime-friendly), fall back to a manual anchor."""
import os, json
import numpy as np
import cv2

ROOT = r"E:\dsh-workspace\endfield-gacha"
SRC = os.path.join(ROOT, "assets", "stage")
OUT = r"E:\dsh-workspace\_shots\skin_sheet.png"

MANUAL = {
    "chr_0037_minghe.webp": (0.470, 0.135),
}


def detect_skin(im):
    """im: BGRA uint8. Returns (cx, cy, area_ratio) or None."""
    bgr = im[:, :, :3].astype(np.float32)
    a = im[:, :, 3:4].astype(np.float32) / 255.0
    bgr = bgr * a + 255.0 * (1 - a)
    bgr = bgr.astype(np.uint8)
    hsv = cv2.cvtColor(bgr, cv2.COLOR_BGR2HSV)
    h, s, v = hsv[:, :, 0], hsv[:, :, 1], hsv[:, :, 2]
    mask = (((h <= 22) | (h >= 170)) & (s >= 25) & (s <= 120) & (v >= 120)).astype(np.uint8) * 255
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, np.ones((5, 5), np.uint8))
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, np.ones((7, 7), np.uint8))
    n, labels, stats, cents = cv2.connectedComponentsWithStats(mask, 8)
    H, W = mask.shape
    best = None
    for i in range(1, n):
        x, y, w, hgt, area = stats[i]
        if area < W * H * 0.0015:
            continue
        if w > W * 0.5 or hgt > H * 0.5:
            continue  # too big -> likely clothing
        cx, cy = cents[i]
        # prefer high & compact blobs
        score = area / (w * hgt + 1e-6) * (1.0 - cy / H)
        if best is None or score > best[0]:
            best = (score, cx, cy, area / (W * H))
    if not best:
        return None
    return best[1], best[2], best[3]


rows = []
for f in sorted(os.listdir(SRC)):
    if not f.endswith(".webp"):
        continue
    im = cv2.imread(os.path.join(SRC, f), cv2.IMREAD_UNCHANGED)
    if im is None or im.shape[2] != 4:
        continue
    H, W = im.shape[:2]
    res = detect_skin(im)
    if f in MANUAL:
        ax, ay = MANUAL[f][0] * W, MANUAL[f][1] * H
        src = "manual"
    elif res:
        ax, ay = res[0], res[1]
        src = "skin"
    else:
        ax, ay = W * 0.5, H * 0.12
        src = "fallback"
    rows.append((f, ax / W, ay / H, src, res[2] if res else 0))

print("skin-detected:", sum(1 for r in rows if r[3] == "skin"),
      "manual:", sum(1 for r in rows if r[3] == "manual"),
      "fallback:", sum(1 for r in rows if r[3] == "fallback"))

# view
COLS, ROWS = 8, 4
CW, CH = 118, 300
sheet = cv2.UMat if False else None
from PIL import Image, ImageDraw
S = Image.new("RGB", (COLS * (CW + 6) + 6, ROWS * (CH + 24) + 6), (10, 12, 14))
d = ImageDraw.Draw(S)
for i, (f, rx, ry, src, ar) in enumerate(rows):
    im = Image.open(os.path.join(SRC, f)).convert("RGBA")
    bg = Image.new("RGBA", im.size, (24, 26, 30, 255))
    bg.alpha_composite(im)
    im = bg.convert("RGB")
    im.thumbnail((CW, CH), Image.LANCZOS)
    x = 6 + (i % COLS) * (CW + 6)
    y = 6 + (i // COLS) * (CH + 24)
    S.paste(im, (x, y))
    px, py = x + im.width * rx, y + im.height * ry
    col = (80, 255, 140) if src == "skin" else (255, 200, 80) if src == "manual" else (255, 90, 80)
    d.ellipse([px - 6, py - 6, px + 6, py + 6], outline=col, width=2)
    d.line([px - 10, py, px + 10, py], fill=col)
    d.line([px, py - 10, px, py + 10], fill=col)
    d.text((x + 2, y + CH + 2), f.replace("chr_", "")[:20], fill=(150, 158, 166))
S.save(OUT)
print("saved", OUT)
json.dump({f: [round(rx, 4), round(ry, 4)] for f, rx, ry, s, _ in rows},
          open(os.path.join(ROOT, "tools", "anchors.json"), "w", encoding="utf-8"), indent=1)
