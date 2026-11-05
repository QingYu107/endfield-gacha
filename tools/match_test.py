# -*- coding: utf-8 -*-
"""Test: locate the head in a full portrait by matching the square character icon."""
import os, numpy as np
from PIL import Image, ImageDraw

ROOT = r"E:\dsh-workspace\endfield-gacha"
PORT = os.path.join(ROOT, "assets", "portrait")
ICON = os.path.join(ROOT, "assets", "icon")
OUT = r"E:\dsh-workspace\_shots\match_test.png"

SAMPLE = ["chr_0022_bounda", "chr_0023_antal", "chr_0019_karin", "chr_0037_minghe",
          "chr_0004_pelica", "chr_0029_pograni"]


def to_gray(im, w):
    h = max(1, int(round(im.height * w / im.width)))
    g = im.convert("RGBA").resize((w, h), Image.LANCZOS)
    a = np.asarray(g.getchannel("A"), dtype=np.float32) / 255.0
    rgb = np.asarray(g.convert("RGB"), dtype=np.float32) / 255.0
    lum = rgb.mean(axis=2)
    # composite on mid grey so transparency does not dominate
    return lum * a + 0.18 * (1 - a), a


def ncc_map(img, tpl):
    """normalised cross-correlation of tpl over img (both float 2D)."""
    ih, iw = img.shape
    th, tw = tpl.shape
    if th > ih or tw > iw:
        return None, -2
    win = np.lib.stride_tricks.sliding_window_view(img, (th, tw))  # (H,W,th,tw)
    win = win.reshape(ih - th + 1, iw - tw + 1, -1)
    t = tpl.reshape(-1)
    t = t - t.mean()
    tn = np.linalg.norm(t)
    if tn < 1e-6:
        return None, -2
    wm = win.mean(axis=2, keepdims=True)
    wc = win - wm
    den = np.linalg.norm(wc, axis=2) * tn
    num = (wc * t).sum(axis=2)
    with np.errstate(divide="ignore", invalid="ignore"):
        score = np.where(den > 1e-6, num / den, -1)
    idx = int(np.argmax(score))
    h, w = score.shape
    y, x = divmod(idx, w)
    return (x, y), float(score[y, x])


rows = []
for cid in SAMPLE:
    p = os.path.join(PORT, cid + ".webp")
    ic = os.path.join(ICON, cid + ".webp")
    if not (os.path.exists(p) and os.path.exists(ic)):
        continue
    port = Image.open(p)
    icon = Image.open(ic)
    PW = 160
    img, alpha = to_gray(port, PW)
    best = (-2, None, None)
    for frac in (0.26, 0.32, 0.38, 0.44, 0.5, 0.56):
        tw = max(12, int(round(PW * frac)))
        tpl, ta = to_gray(icon, tw)
        loc, sc = ncc_map(img, tpl)
        if loc and sc > best[0]:
            best = (sc, loc, (tw, tpl.shape[0]))
    sc, loc, size = best
    print(cid, "score=%.3f" % sc, "loc=", loc, "size=", size, "portrait=", port.size)
    rows.append((cid, sc, loc, size, port.size, icon.size))

# visualise
CELL_H, CELL_W = 260, 160
sheet = Image.new("RGB", (CELL_W * len(rows) + 10, CELL_H + 24), (12, 14, 16))
d = ImageDraw.Draw(sheet)
for i, (cid, sc, loc, size, psize, isize) in enumerate(rows):
    im = Image.open(os.path.join(PORT, cid + ".webp")).convert("RGBA")
    bg = Image.new("RGBA", im.size, (20, 22, 26, 255))
    bg.alpha_composite(im)
    im = bg.convert("RGB")
    im.thumbnail((CELL_W, CELL_H), Image.LANCZOS)
    x = 5 + i * CELL_W
    sheet.paste(im, (x, 4))
    if loc:
        sx = im.width / (psize[0] / 160.0 * 160)  # scale from analysis px to preview px
        # analysis was width 160 -> preview width im.width
        k = im.width / 160.0
        bx, by = loc[0] * k, loc[1] * k
        bw, bh = size[0] * k, size[1] * k
        d.rectangle([x + bx, 4 + by, x + bx + bw, 4 + by + bh], outline=(255, 210, 90), width=2)
    d.text((x + 2, CELL_H + 8), "%s %.2f" % (cid.replace("chr_", ""), sc), fill=(160, 168, 176))
sheet.save(OUT)
print("saved", OUT)
