# -*- coding: utf-8 -*-
"""Scrape fz.wiki (Endfield wiki) gacha pools + operator art into a static web app dataset."""
import json, os, re, sys, time, urllib.request, urllib.parse, hashlib
from concurrent.futures import ThreadPoolExecutor

ROOT = r"E:\dsh-workspace\endfield-gacha"
ASSETS = os.path.join(ROOT, "assets")
DATA = os.path.join(ROOT, "data")
os.makedirs(ASSETS, exist_ok=True)
os.makedirs(DATA, exist_ok=True)

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
      "Accept": "application/json,image/avif,image/webp,image/png,*/*"}
CACHE = os.path.join(ROOT, "_cache")
os.makedirs(CACHE, exist_ok=True)


def fetch(url, binary=False, tries=3):
    key = hashlib.md5(url.encode()).hexdigest()
    cp = os.path.join(CACHE, key)
    if os.path.exists(cp) and os.path.getsize(cp) > 0:
        with open(cp, "rb") as f:
            raw = f.read()
        return raw if binary else raw.decode("utf-8", "replace")
    last = None
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=45) as r:
                raw = r.read()
            with open(cp, "wb") as f:
                f.write(raw)
            return raw if binary else raw.decode("utf-8", "replace")
        except Exception as e:
            last = e
            time.sleep(1.2 * (i + 1))
    raise last


def article(title):
    u = "https://api.fz.wiki/api/v1/articles/by-title?ns=0&title=%s&withRevision=1" % urllib.parse.quote(title)
    return json.loads(fetch(u))


def walk_nodes(node, out):
    if not isinstance(node, dict):
        return
    t = node.get("type")
    if t:
        out.append((t, node.get("attrs") or {}))
    for c in (node.get("content") or []):
        walk_nodes(c, out)


def blocks(title):
    d = article(title)
    out = []
    walk_nodes(d["revision"]["contentJson"], out)
    return d, out


# ---------------------------------------------------------------- pool index
_, idx_nodes = blocks("卡池")
pool_index = []
for t, a in idx_nodes:
    if t == "wikiIndexTable":
        pool_index.extend(a.get("entries") or [])
char_pools = [p for p in pool_index if p.get("kindLabel") == "角色"]
print("char pools:", len(char_pools))

POOL_ORDER = {"Special": 0, "Joint": 1, "Rerun": 2, "Standard": 3, "Beginner": 4}
MARKET_ORDER = {"特许寻访": 0, "「辉光庆典」特殊寻访": 1, "重构寻访": 2, "基础寻访": 3, "启程寻访": 4}


def get_pool(name):
    d, nodes = blocks("卡池/" + name)
    sim = None
    hero = None
    for t, a in nodes:
        if t == "endfieldCardGachaSimulator" and not sim:
            sim = a
        if t == "endfieldCardGachaHero" and not hero:
            hero = a
    return d, sim, hero


pools = []
for p in char_pools:
    try:
        d, sim, hero = get_pool(p["name"])
    except Exception as e:
        print("POOL FAIL", p["name"], e)
        continue
    if not sim or not sim.get("pools"):
        print("no sim:", p["name"])
        continue
    raw = sim["pools"][0]
    raw["_bannerIcon"] = p.get("iconUrl")
    raw["_typeGroup"] = p.get("typeLabel")
    raw["_hero"] = {k: hero.get(k) for k in ("colors", "tagLabel", "openTimeText", "closeTimeText", "poolType", "typeLabel", "maxPullCount", "permitSinglePull")} if hero else {}
    raw["_categories"] = d["article"].get("categories") or []
    pools.append(raw)
    print("ok", p["name"], len(raw.get("items") or []), raw.get("poolType"))

# union of operator targets
op_names = []
for p in pools:
    for it in p.get("items") or []:
        tgt = it.get("target") or ""
        nm = tgt.split("/", 1)[1] if "/" in tgt else it.get("name")
        if nm and nm not in op_names:
            op_names.append(nm)
print("operators:", len(op_names))

# index metadata
_, op_nodes = blocks("干员")
op_index = []
for t, a in op_nodes:
    if t == "wikiIndexTable":
        op_index.extend(a.get("entries") or [])
OPIDX = {o["name"]: o for o in op_index}

ops = {}
for nm in op_names:
    if nm in ops:
        continue
    rec = {"name": nm}
    try:
        d, nodes = blocks("干员/" + nm)
        hero = next((a for t, a in nodes if t == "endfieldCardCharacterHero"), None)
        if hero:
            rec.update({
                "name": hero.get("name") or nm,
                "nameEn": hero.get("nameEn") or "",
                "rarity": hero.get("rarity"),
                "profession": hero.get("profession") or "",
                "element": hero.get("element") or "",
                "elementColor": hero.get("elementColor") or "",
                "faction": hero.get("faction") or "",
                "tags": hero.get("tags") or [],
                "bio": hero.get("bio") or "",
                "portrait": hero.get("portraitFile") or "",
                "icon": hero.get("iconUrl") or "",
                "charId": hero.get("charId") or "",
                "weaponType": hero.get("weaponType") or "",
                "meta": hero.get("meta") or [],
                "starIcon": hero.get("starIconUrl") or "",
            })
    except Exception as e:
        print("OP FAIL", nm, e)
    if "rarity" not in rec:
        o = OPIDX.get(nm) or {}
        rec.update({
            "name": nm, "nameEn": o.get("nameEn") or "", "rarity": o.get("rarity"),
            "profession": o.get("profession") or "", "element": o.get("element") or "",
            "elementColor": o.get("elementColor") or "", "faction": o.get("faction") or "",
            "tags": o.get("tags") or [], "bio": "", "portrait": "",
            "icon": o.get("iconUrl") or "", "charId": o.get("charId") or "",
            "weaponType": o.get("weaponType") or "", "meta": [],
        })
    ops[nm] = rec
    print("op", nm, rec.get("rarity"), bool(rec.get("portrait")))

json.dump({"pools": pools, "ops": ops}, open(os.path.join(DATA, "_raw.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("saved raw")
