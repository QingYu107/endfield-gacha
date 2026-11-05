# -*- coding: utf-8 -*-
"""Fetch art for newly added operators and extend the anchor table."""
import json, os, sys
sys.path.insert(0, r"E:\dsh-workspace\endfield-gacha\tools")
import build_assets as BA

ROOT = BA.ROOT
RAW = json.load(open(os.path.join(ROOT, "data", "_raw.json"), encoding="utf-8"))
OPS = RAW["ops"]

NEW = ["噗切娜", "管理员·男", "管理员·女"]
jobs = []
for name in NEW:
    o = OPS.get(name)
    if not o:
        print("missing", name)
        continue
    cid = o.get("charId") or name
    if o.get("portrait"):
        jobs.append((o["portrait"], "assets/portrait/%s.webp" % cid, 900, 86, False))
    if o.get("icon"):
        jobs.append((o["icon"], "assets/icon/%s.webp" % cid, 320, 88, True))

for j in jobs:
    ok, size = BA.save_webp(*j)
    print("saved" if ok else "FAIL", j[1], size // 1024, "KB")

# extend anchors
p = os.path.join(ROOT, "tools", "build_bust.py")
s = open(p, encoding="utf-8").read()
add = {
    "噗切娜": (0.500, 0.200),
    "管理员·男": (0.500, 0.180),
    "管理员·女": (0.500, 0.180),
}
entries = []
for name, (x, y) in add.items():
    cid = (OPS.get(name) or {}).get("charId")
    if cid:
        entries.append('    "%s.webp": (%.3f, %.3f),' % (cid, x, y))
if entries:
    marker = "ANCHOR = {\n"
    s = s.replace(marker, marker + "\n".join(entries) + "\n", 1)
    open(p, "w", encoding="utf-8").write(s)
    print("anchors added:", len(entries))
