# -*- coding: utf-8 -*-
"""Download profession icons and patch data.js with a profession map."""
import json, os, sys, urllib.parse, re
sys.path.insert(0, r"E:\dsh-workspace\endfield-gacha")
import build_assets as BA

ROOT = BA.ROOT
url = "https://api.fz.wiki/api/v1/articles/by-title?ns=0&title=%s&withRevision=1" % urllib.parse.quote("干员")
d = json.loads(BA.fetch_bytes(url).decode("utf-8", "replace"))

entries = []


def walk(n):
    if not isinstance(n, dict):
        return
    if n.get("type") == "wikiIndexTable":
        entries.extend(n.get("attrs", {}).get("entries") or [])
    for c in (n.get("content") or []):
        walk(c)


walk(d["revision"]["contentJson"])
prof = {}
for e in entries:
    p = e.get("profession")
    u = e.get("professionIconUrl")
    if p and u and p not in prof:
        prof[p] = u
print("professions:", list(prof))

out = {}
for p, u in prof.items():
    rel = "assets/prof/%s.webp" % p
    ok, size = BA.save_webp(u, rel, 96, 90, True)
    if ok:
        out[p] = rel
print(out)

# patch data.js
path = os.path.join(ROOT, "data", "data.js")
src = open(path, encoding="utf-8").read()
prefix = "window.GACHA_DATA = "
assert src.startswith("/*")
body = src.split(prefix, 1)[1].rstrip().rstrip(";")
data = json.loads(body)
data["professions"] = out
with open(path, "w", encoding="utf-8") as f:
    f.write("/* generated from fz.wiki — do not edit by hand */\n")
    f.write(prefix)
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")
print("patched data.js with", len(out), "professions")
