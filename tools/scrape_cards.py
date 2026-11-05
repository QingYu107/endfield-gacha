# -*- coding: utf-8 -*-
"""Extract 潜能留影 (potential postcards) for every operator from cached article JSON."""
import json, os, sys, urllib.parse
sys.path.insert(0, r"E:\dsh-workspace\endfield-gacha")
import build_assets as BA
from concurrent.futures import ThreadPoolExecutor

ROOT = BA.ROOT
RAW = json.load(open(os.path.join(ROOT, "data", "_raw.json"), encoding="utf-8"))


def any_article(title):
    url = "https://api.fz.wiki/api/v1/articles/by-title?ns=0&title=%s&withRevision=1" % urllib.parse.quote(title)
    return json.loads(BA.fetch_bytes(url).decode("utf-8", "replace"))


def walk(n, out):
    if not isinstance(n, dict):
        return
    if n.get("type") == "endfieldCardCharacterPotentials":
        out.append(n.get("attrs") or {})
    for c in (n.get("content") or []):
        walk(c, out)


cards, jobs = {}, []
for nm, o in RAW["ops"].items():
    cid = o.get("charId") or nm
    try:
        d = any_article("干员/" + nm)
    except Exception as e:
        print("fail", nm, e)
        continue
    blocks = []
    walk(d["revision"]["contentJson"], blocks)
    if not blocks:
        print("no block", nm)
        continue
    recs = []
    for pc in blocks[0].get("postcards") or []:
        lvl = pc.get("unlockLevel") or 0
        name = ((pc.get("nameRef") or {}).get("text") or "").strip()
        desc = ((pc.get("decoDescRef") or {}).get("text") or "").strip()
        img = pc.get("imageUrl") or ""
        if not name:
            continue
        rel = "assets/cards/%s_%d.webp" % (cid, lvl)
        recs.append({"lvl": lvl, "name": name, "desc": desc, "img": rel})
        if img:
            jobs.append((img, rel))
    recs.sort(key=lambda r: r["lvl"])
    cards[cid] = recs
    print(nm, [r["lvl"] for r in recs])

print("ops with cards:", len(cards), "images:", len(jobs))


def one(j):
    return BA.save_webp(j[0], j[1], 420, 84, False)


with ThreadPoolExecutor(max_workers=8) as ex:
    res = list(ex.map(one, jobs))
print("downloaded", sum(1 for r in res if r and r[0]), "/", len(res))

json.dump(cards, open(os.path.join(ROOT, "data", "_cards.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("saved")
