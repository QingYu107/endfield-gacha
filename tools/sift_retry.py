# -*- coding: utf-8 -*-
"""SIFT retry for the portraits ORB could not anchor."""
import os
import numpy as np
import cv2

ROOT = r"E:\dsh-workspace\endfield-gacha"
SRC = os.path.join(ROOT, "assets", "stage")
ICON = os.path.join(ROOT, "assets", "icon")

FAIL = ["chr_0011_seraph", "chr_0018_dapan", "chr_0024_deepfin", "chr_0029_pograni",
        "chr_0030_zhuangfy", "chr_0032_lizhiyan", "chr_0033_camille", "chr_0034_typhoea",
        "chr_0037_minghe", "chr_0038_purrche", "chr_0028_wulfa", "chr_0002_endminm",
        "chr_0003_endminf", "chr_0016_laevat"]


def load(p):
    im = cv2.imread(p, cv2.IMREAD_UNCHANGED)
    if im is None:
        return None
    if im.shape[2] == 4:
        a = im[:, :, 3:4].astype(np.float32) / 255.0
        im = (im[:, :, :3] * a + 235 * (1 - a)).astype(np.uint8)
    return im


sift = cv2.SIFT_create(nfeatures=6000, contrastThreshold=0.008, edgeThreshold=12)
bf = cv2.BFMatcher(cv2.NORM_L2)

for cid in FAIL:
    p = load(os.path.join(SRC, cid + ".webp"))
    ic = load(os.path.join(ICON, cid + ".webp"))
    if p is None or ic is None:
        print(cid, "missing"); continue
    for up in (1.0, 2.0, 3.0):
        icx = cv2.resize(ic, None, fx=up, fy=up, interpolation=cv2.INTER_CUBIC)
        k1, d1 = sift.detectAndCompute(p, None)
        k2, d2 = sift.detectAndCompute(icx, None)
        if d1 is None or d2 is None:
            continue
        ms = bf.knnMatch(d2, d1, k=2)
        good = [m for m, n in ms if m.distance < 0.72 * n.distance]
        if len(good) < 6:
            print("%-20s up=%.1f good=%d" % (cid, up, len(good)))
            continue
        src = np.float32([k2[m.queryIdx].pt for m in good])
        dst = np.float32([k1[m.trainIdx].pt for m in good])
        M, mask = cv2.estimateAffinePartial2D(src, dst, method=cv2.RANSAC, ransacReprojThreshold=4.0)
        if M is None:
            print("%-20s up=%.1f good=%d no-hom" % (cid, up, len(good))); continue
        inl = int(mask.sum())
        h, w = icx.shape[:2]
        q = cv2.transform(np.float32([[[0, 0], [w, 0], [w, h], [0, h]]]), M)[0]
        ih = float(np.linalg.norm(q[3] - q[0]))
        iw = float(np.linalg.norm(q[1] - q[0]))
        c = cv2.transform(np.float32([[[w / 2, h * 0.42]]]), M)[0][0]
        print("%-20s up=%.1f good=%3d inl=%3d head=(%.3f,%.3f) size=(%.0f,%.0f) img=%s" %
              (cid, up, len(good), inl, c[0] / p.shape[1], c[1] / p.shape[0], iw, ih, p.shape[:2]))
