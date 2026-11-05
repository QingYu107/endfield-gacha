# -*- coding: utf-8 -*-
"""Locate the head in each full portrait by matching the official square icon (ORB + homography)."""
import os, json
import numpy as np
import cv2

ROOT = r"E:\dsh-workspace\endfield-gacha"
PORT = os.path.join(ROOT, "assets", "portrait")
ICON = os.path.join(ROOT, "assets", "icon")
OUT = r"E:\dsh-workspace\_shots\orb_sheet.png"

SAMPLE = ["chr_0037_minghe", "chr_0020_meurs", "chr_0022_bounda", "chr_0023_antal",
          "chr_0026_lastrite", "chr_0038_purrche"]


def load(p):
    im = cv2.imread(p, cv2.IMREAD_UNCHANGED)
    if im is None:
        return None
    if im.shape[2] == 4:
        a = im[:, :, 3:4].astype(np.float32) / 255.0
        im = (im[:, :, :3] * a + 235 * (1 - a)).astype(np.uint8)
    return im


orb = cv2.ORB_create(nfeatures=4000, scaleFactor=1.2, nlevels=10, fastThreshold=12)
bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=False)

rows = []
for cid in SAMPLE:
    p = load(os.path.join(PORT, cid + ".webp"))
    ic = load(os.path.join(ICON, cid + ".webp"))
    if p is None or ic is None:
        continue
    # upscale the icon a bit so it has enough keypoints
    ic = cv2.resize(ic, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
    k1, d1 = orb.detectAndCompute(p, None)
    k2, d2 = orb.detectAndCompute(ic, None)
    if d1 is None or d2 is None or len(k1) < 10 or len(k2) < 10:
        print(cid, "no descriptors")
        continue
    matches = bf.knnMatch(d2, d1, k=2)
    good = [m for m, n in matches if m.distance < 0.75 * n.distance]
    ok = False
    if len(good) >= 8:
        src = np.float32([k2[m.queryIdx].pt for m in good]).reshape(-1, 1, 2)
        dst = np.float32([k1[m.trainIdx].pt for m in good]).reshape(-1, 1, 2)
        H, mask = cv2.findHomography(src, dst, cv2.RANSAC, 5.0)
        if H is not None:
            inl = int(mask.sum())
            c = np.float32([[[ic.shape[1] / 2, ic.shape[0] * 0.35]]])  # icon centre (head-ish)
            pt = cv2.perspectiveTransform(c, H)[0][0]
            ok = inl >= 10
            print("%-22s matches=%3d inliers=%3d head=(%.2f, %.2f) %s" %
                  (cid, len(good), inl, pt[0] / p.shape[1], pt[1] / p.shape[0], "OK" if ok else "weak"))
            rows.append((cid, ok, pt[0] / p.shape[1], pt[1] / p.shape[0], inl))
    if not ok:
        print("%-22s FAILED good=%d" % (cid, len(good)))
        rows.append((cid, False, 0.5, 0.2, len(good)))

# visual check
from PIL import Image, ImageDraw
CW, CH = 200, 280
sheet = Image.new("RGB", (CW * len(rows) + 10, CH + 30), (10, 12, 14))
d = ImageDraw.Draw(sheet)
for i, (cid, ok, rx, ry, inl) in enumerate(rows):
    im = Image.open(os.path.join(PORT, cid + ".webp")).convert("RGBA")
    bg = Image.new("RGBA", im.size, (24, 26, 30, 255))
    bg.alpha_composite(im)
    im = bg.convert("RGB")
    im.thumbnail((CW, CH), Image.LANCZOS)
    x = 5 + i * CW
    sheet.paste(im, (x, 4))
    px, py = x + im.width * rx, 4 + im.height * ry
    col = (90, 255, 140) if ok else (255, 90, 80)
    d.ellipse([px - 7, py - 7, px + 7, py + 7], outline=col, width=2)
    d.line([px - 12, py, px + 12, py], fill=col)
    d.text((x + 2, CH + 10), "%s %d" % (cid.replace("chr_", "")[:14], inl), fill=(150, 158, 166))
sheet.save(OUT)
print("saved", OUT)
