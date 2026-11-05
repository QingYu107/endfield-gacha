# -*- coding: utf-8 -*-
"""Anchor the head in each portrait by homography-matching the official icon
(ORB, then SIFT), then cut a half-body strip: head near the top, chest in frame."""
import os, json, shutil
import numpy as np
import cv2
from PIL import Image, ImageDraw

ROOT = r"E:\dsh-workspace\endfield-gacha"
SRC = os.path.join(ROOT, "assets", "stage")
ICON = os.path.join(ROOT, "assets", "icon")
DST = os.path.join(ROOT, "assets", "bust")
SHEET = r"E:\dsh-workspace\_shots\bust_sheet3.png"

ASPECT = 3.25
HEAD_AT = 0.255
OUT_W = 320
MANUAL = {"chr_0002_endminm.webp": (0.365, 0.297), "chr_0003_endminf.webp": (0.598, 0.330)}
# hand-set head centres (icon matched the wrong figure in these arts)
OVERRIDE = {
    "chr_0038_purrche.webp": (0.400, 0.268, 0.58),
    "chr_0029_pograni.webp": (0.5465, 0.312, 0.31),
}


def load_rgb(p):
    im = cv2.imread(p, cv2.IMREAD_UNCHANGED)
    if im is None:
        return None
    if im.shape[2] == 4:
        a = im[:, :, 3:4].astype(np.float32) / 255.0
        im = (im[:, :, :3] * a + 235 * (1 - a)).astype(np.uint8)
    return im


orb = cv2.ORB_create(nfeatures=5000, scaleFactor=1.15, nlevels=12, fastThreshold=10)
sift = cv2.SIFT_create(nfeatures=6000, contrastThreshold=0.008, edgeThreshold=12)


def _solve(port, ic, k1, d1, k2, d2, norm, ratio, min_inl, thr):
    if d1 is None or d2 is None or d1 is None:
        return None
    ms = cv2.BFMatcher(norm).knnMatch(d2, d1, k=2)
    good = [m for m, n in ms if m.distance < ratio * n.distance]
    if len(good) < 8:
        return None
    src = np.float32([k2[m.queryIdx].pt for m in good])
    dst = np.float32([k1[m.trainIdx].pt for m in good])
    M, mask = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=thr)
    if M is None:
        return None
    inl = int(mask.sum())
    if inl < min_inl:
        return None
    h, w = ic.shape[:2]
    q = cv2.transform(np.float32([[[0, 0], [w, 0], [w, h], [0, h]]]), M)[0]
    ih = float(np.linalg.norm(q[3] - q[0]))
    iw = float(np.linalg.norm(q[1] - q[0]))
    if ih < 24 or ih > 2.0 * port.shape[0]:
        return None
    c = cv2.transform(np.float32([[[w / 2, h * 0.42]]]), M)[0][0]
    if not (-0.15 * port.shape[1] < c[0] < 1.15 * port.shape[1]):
        return None
    return dict(head=(float(c[0]), float(c[1])), ih=ih, inl=inl)


def solve(port, icon):
    for tag, fn, norm, ratio, min_inl, thr in (
        ("orb", orb, cv2.NORM_HAMMING, 0.78, 20, 4.0),
        ("sift", sift, cv2.NORM_L2, 0.72, 15, 4.0),
    ):
        for up in (1.0, 2.0):
            ic = cv2.resize(icon, None, fx=up, fy=up, interpolation=cv2.INTER_CUBIC)
            k1, d1 = fn.detectAndCompute(port, None)
            k2, d2 = fn.detectAndCompute(ic, None)
            sol = _solve(port, ic, k1, d1, k2, d2, norm, ratio, min_inl, thr)
            if sol:
                sol["ih"] /= up
                sol["tag"] = "%s:%d x%.0f" % (tag, sol["inl"], up)
                return sol
    return None


rows, report = [], {}
if os.path.isdir(DST):
    shutil.rmtree(DST)
os.makedirs(DST, exist_ok=True)

for f in sorted(os.listdir(SRC)):
    if not f.endswith(".webp"):
        continue
    pim = Image.open(os.path.join(SRC, f)).convert("RGBA")
    W, H = pim.size
    port = load_rgb(os.path.join(SRC, f))
    icon = load_rgb(os.path.join(ICON, f))
    sol = solve(port, icon) if icon is not None else None

    if f in OVERRIDE:
        ov = OVERRIDE[f]
        rx, ry = ov[0], ov[1]
        hx, hy = rx * W, ry * H
        crop_h = (ov[2] if len(ov) > 2 else 0.58) * H
        tag = "hand"
    elif sol:
        hx, hy = sol["head"]
        crop_h = min(max(1.92 * sol["ih"], 0.36 * H), 0.86 * H)
        tag = sol["tag"]
    else:
        rx, ry = MANUAL.get(f, (0.5, 0.2))
        hx, hy = rx * W, ry * H
        crop_h = 0.62 * H
        tag = "manual"

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

    nh = int(round(canvas.height * OUT_W / canvas.width))
    canvas.resize((OUT_W, nh), Image.LANCZOS).save(os.path.join(DST, f), "WEBP", quality=88, method=5)
    report[f] = dict(hx=round(hx / W, 3), hy=round(hy / H, 3), crop_h=round(crop_h, 1), src=tag)
    rows.append((f, tag))

json.dump(report, open(os.path.join(ROOT, "data", "bust_anchors.json"), "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)

CW, CH = 150, 500
cols = 7
r = (len(rows) + cols - 1) // cols
sheet = Image.new("RGB", (CW * cols, (CH + 22) * r), (8, 10, 12))
d = ImageDraw.Draw(sheet)
for i, (f, tag) in enumerate(rows):
    im = Image.open(os.path.join(DST, f)).convert("RGBA")
    bg = Image.new("RGBA", im.size, (14, 16, 20, 255))
    bg.alpha_composite(im)
    im = bg.convert("RGB")
    im.thumbnail((CW - 6, CH - 6), Image.LANCZOS)
    x = (i % cols) * CW + 3
    y = (i // cols) * (CH + 22) + 3
    sheet.paste(im, (x, y))
    d.text((x, y + CH - 14), f.replace("chr_", "").replace(".webp", "")[:18], fill=(140, 148, 156))
    d.text((x, y + CH - 2), tag, fill=(90, 170, 120) if not tag.startswith("manual") else (200, 130, 90))
sheet.save(SHEET)

bad = [f for f, t in rows if t.startswith("manual")]
print("busts:", len(rows), "matched:", len(rows) - len(bad), "manual:", bad)
