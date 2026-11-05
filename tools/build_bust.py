# -*- coding: utf-8 -*-
"""Final manual head anchors (fractions of the stage image) -> bust crops."""
import os
import numpy as np
from PIL import Image

ROOT = r"E:\dsh-workspace\endfield-gacha"
SRC = os.path.join(ROOT, "assets", "stage")
DST = os.path.join(ROOT, "assets", "bust")
os.makedirs(DST, exist_ok=True)

ASPECT = 3.25          # wider than the strip frame -> horizontal tolerance
HEAD_AT = 0.165        # head centre at 16.5% of the crop height
OUT_W = 320

ANCHOR = {
    "chr_0038_purrche.webp": (0.500, 0.200),
    "chr_0002_endminm.webp": (0.500, 0.180),
    "chr_0003_endminf.webp": (0.500, 0.180),
    "chr_0004_pelica.webp": (0.580, 0.220),
    "chr_0005_chen.webp": (0.520, 0.170),
    "chr_0006_wolfgd.webp": (0.460, 0.280),
    "chr_0007_ikut.webp": (0.500, 0.330),
    "chr_0009_azrila.webp": (0.380, 0.300),
    "chr_0011_seraph.webp": (0.500, 0.300),
    "chr_0012_avywen.webp": (0.470, 0.200),
    "chr_0013_aglina.webp": (0.500, 0.220),
    "chr_0014_aurora.webp": (0.540, 0.280),
    "chr_0015_lifeng.webp": (0.500, 0.280),
    "chr_0016_laevat.webp": (0.480, 0.220),
    "chr_0017_yvonne.webp": (0.420, 0.280),
    "chr_0018_dapan.webp": (0.530, 0.300),
    "chr_0019_karin.webp": (0.470, 0.200),
    "chr_0020_meurs.webp": (0.590, 0.300),
    "chr_0021_whiten.webp": (0.400, 0.220),
    "chr_0022_bounda.webp": (0.320, 0.150),
    "chr_0023_antal.webp": (0.430, 0.230),
    "chr_0024_deepfin.webp": (0.470, 0.220),
    "chr_0025_ardelia.webp": (0.530, 0.220),
    "chr_0026_lastrite.webp": (0.520, 0.280),
    "chr_0027_tangtang.webp": (0.580, 0.280),
    "chr_0028_wulfa.webp": (0.560, 0.360),
    "chr_0029_pograni.webp": (0.480, 0.320),
    "chr_0030_zhuangfy.webp": (0.400, 0.310),
    "chr_0031_mifu.webp": (0.400, 0.220),
    "chr_0032_lizhiyan.webp": (0.500, 0.220),
    "chr_0033_camille.webp": (0.530, 0.370),
    "chr_0034_typhoea.webp": (0.330, 0.210),
    "chr_0035_liino.webp": (0.430, 0.300),
    "chr_0036_jsspsi.webp": (0.430, 0.370),
    "chr_0037_minghe.webp": (0.470, 0.135),
}

for f in sorted(os.listdir(SRC)):
    if not f.endswith(".webp"):
        continue
    im = Image.open(os.path.join(SRC, f)).convert("RGBA")
    W, H = im.size
    rx, ry = ANCHOR.get(f, (0.5, 0.12))
    hx, hy = rx * W, ry * H

    cw = max(24, int(round(H / ASPECT)))
    x0 = int(round(hx - cw / 2))
    y0 = int(round(hy - HEAD_AT * H))

    canvas = Image.new("RGBA", (cw, H), (0, 0, 0, 0))
    sx0, sy0 = x0, y0
    sx1, sy1 = x0 + cw, y0 + H
    px0 = py0 = 0
    if sx0 < 0:
        px0, sx0 = -sx0, 0
    if sy0 < 0:
        py0, sy0 = -sy0, 0
    sx1, sy1 = min(W, sx1), min(H, sy1)
    if sx1 > sx0 and sy1 > sy0:
        piece = im.crop((sx0, sy0, sx1, sy1))
        canvas.paste(piece, (px0, py0), piece)

    nh = int(round(canvas.height * OUT_W / canvas.width))
    canvas.resize((OUT_W, nh), Image.LANCZOS).save(os.path.join(DST, f), "WEBP", quality=86, method=5)

print("busts rebuilt:", len(os.listdir(DST)))



