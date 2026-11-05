# -*- coding: utf-8 -*-
"""Scrape weapon pools (武库申领) and merge into _raw.json."""
import json, os, sys
sys.path.insert(0, r"E:\dsh-workspace\endfield-gacha")
import scrape as S

RAW_PATH = os.path.join(S.DATA, "_raw.json")
raw = json.load(open(RAW_PATH, encoding="utf-8"))

pool_index = S.pool_index
weapon_pools = [p for p in pool_index if p.get("kindLabel") == "武器"]
print("weapon pools:", len(weapon_pools))

out = []
for p in weapon_pools:
    try:
        d, sim, hero = S.get_pool(p["name"])
    except Exception as e:
        print("FAIL", p["name"], e)
        continue
    if not sim or not sim.get("pools"):
        print("no sim", p["name"])
        continue
    wp = sim["pools"][0]
    wp["_bannerIcon"] = p.get("iconUrl")
    wp["_typeGroup"] = p.get("typeLabel")
    wp["_hero"] = {k: hero.get(k) for k in ("colors", "tagLabel", "openTimeText", "closeTimeText")} if hero else {}
    wp["_categories"] = d["article"].get("categories") or []
    out.append(wp)
    print("ok", p["name"], len(wp.get("items") or []), wp.get("star6BaseRate"))

raw["weapon_pools"] = out
json.dump(raw, open(RAW_PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("weapon pools saved:", len(out))
