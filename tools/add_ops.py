# -*- coding: utf-8 -*-
"""Add 噗切娜 / 管理员 to the dataset, merge 潜能 details, wire both into pools."""
import json, os, sys
sys.path.insert(0, r"E:\dsh-workspace\endfield-gacha\tools")
import build_assets as BA

ROOT = BA.ROOT
RAW_PATH = os.path.join(ROOT, "data", "_raw.json")
raw = json.load(open(RAW_PATH, encoding="utf-8"))
OPS = raw["ops"]


def article(title):
    import urllib.parse
    url = "https://api.fz.wiki/api/v1/articles/by-title?ns=0&title=%s&withRevision=1" % urllib.parse.quote(title)
    return json.loads(BA.fetch_bytes(url).decode("utf-8", "replace"))


def hero_of(title):
    d = article(title)
    out = []

    def walk(n):
        if not isinstance(n, dict):
            return
        if n.get("type") == "endfieldCardCharacterHero":
            out.append(n.get("attrs") or {})
        for c in (n.get("content") or []):
            walk(c)

    walk(d["revision"]["contentJson"])
    return out[0] if out else None


def add(name):
    if name in OPS:
        return OPS[name]
    h = hero_of("干员/" + name)
    if not h:
        print("no hero", name)
        return None
    meta = {m.get("label"): m.get("value") for m in (h.get("meta") or [])}
    rec = {
        "name": h.get("name") or name, "nameEn": h.get("nameEn") or "",
        "rarity": h.get("rarity"), "profession": h.get("profession") or "",
        "element": h.get("element") or "", "elementColor": h.get("elementColor") or "#8A8F98",
        "faction": h.get("faction") or "", "tags": h.get("tags") or [],
        "bio": h.get("bio") or "", "portrait": h.get("portraitFile") or "",
        "icon": h.get("iconUrl") or "", "charId": h.get("charId") or "",
        "weaponType": h.get("weaponType") or "", "meta": h.get("meta") or [],
        "starIcon": h.get("starIconUrl") or "",
    }
    OPS[name] = rec
    print("added", name, rec["rarity"], rec["profession"])
    return rec


puchena = add("噗切娜")
admin_m = add("管理员·男")
admin_f = add("管理员·女")

# --- add 噗切娜 to every character pool's 5★ roster
if puchena:
    added = 0
    for p in raw["pools"]:
        if not any(i.get("id") == puchena["charId"] for i in p["items"]):
            p["items"].append({
                "id": puchena["charId"], "name": puchena["name"], "nameEn": puchena["nameEn"],
                "rarity": puchena["rarity"], "iconUrl": puchena["icon"],
                "target": "干员/" + puchena["name"], "isUp": False, "isHardPity": False, "weight": 1,
            })
            added += 1
    print("噗切娜 added to", added, "pools")

json.dump(raw, open(RAW_PATH, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("ops total:", len(OPS))
