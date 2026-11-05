# -*- coding: utf-8 -*-
"""Stage portraits v2: trim alpha, centre on the HEAD band, keep full body."""
import os
import numpy as np
from PIL import Image

ROOT = r"E:\dsh-workspace\endfield-gacha"
SRC = os.path.join(ROOT, "assets", "portrait")
DST = os.path.join(ROOT, "assets", "stage")
os.makedirs(DST, exist_ok=True)

TARGET_H = 1100
MIN_ASPECT = 0.82


def head_center(sub):
    """sub: alpha array (H,W) of the trimmed art. Returns (x_center, top_row)."""
    h, w = sub.shape
    rows = sub.sum(axis=1).astype(np.float64)
    mx = rows.max() or 1.0
    # ignore ultra-thin decorative rows at the very top
    thresh = max(mx * 0.035, 255 * 3)
    top = 0
    run = 0
    for y in range(h):
        if rows[y] >= thresh:
            run += 1
            if run >= 3:
                top = max(0, y - 2)
                break
        else:
            run = 0
    # head band: first 22% of height below `top`
    y0 = top
    y1 = min(h, top + max(int(h * 0.22), 12))
    band = sub[y0:y1]
    col = band.sum(axis=0).astype(np.float64)
    if col.sum() <= 0:
        return w / 2.0, top
    xs = np.arange(w)
    return float((xs * col).sum() / col.sum()), y0


rows_out = []
for f in sorted(os.listdir(SRC)):
    if not f.endswith(".webp"):
        continue
    im = Image.open(os.path.join(SRC, f)).convert("RGBA")
    a = np.array(im.getchannel("A"), dtype=np.uint8)
    mask = a > 12
    if not mask.any():
        continue
    ys, xs = np.nonzero(mask)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    crop = im.crop((x0, y0, x1, y1))
    cw, ch = crop.size
    sub = a[y0:y1, x0:x1]
    hx, htop = head_center(sub)

    scale = min(1.0, TARGET_H / ch)
    nw, nh = max(1, round(cw * scale)), max(1, round(ch * scale))
    crop = crop.resize((nw, nh), Image.LANCZOS)
    hx_s, htop_s = hx * scale, htop * scale

    W = max(nw, int(round(nh * MIN_ASPECT)))
    canvas = Image.new("RGBA", (W, nh), (0, 0, 0, 0))
    px = int(round(W / 2 - hx_s))
    canvas.paste(crop, (px, 0), crop)
    out = os.path.join(DST, f)
    canvas.save(out, "WEBP", quality=86, method=5)
    rows_out.append((f, cw, ch, W, nh, round(hx / max(1, cw), 3), round(htop / max(1, ch), 3)))

print("built", len(rows_out))
for r in rows_out[:8]:
    print("  %-28s src=%dx%d out=%dx%d headX=%.2f headTop=%.2f" % r)
print("total", round(sum(os.path.getsize(os.path.join(DST, f)) for f in os.listdir(DST)) / 1048576, 2), "MB")
