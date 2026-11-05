# -*- coding: utf-8 -*-
"""Emit the static dataset (data/data.js) + weapon icons."""
import json, os, re, io, hashlib
from concurrent.futures import ThreadPoolExecutor
from PIL import Image
import build_assets as BA

ROOT = BA.ROOT
RAW = json.load(open(os.path.join(ROOT, "data", "_raw.json"), encoding="utf-8"))
OPS = RAW["ops"]

TYPE_LABEL = {"Special": "特许寻访", "Joint": "特殊寻访", "Rerun": "重构寻访",
              "Standard": "基础寻访", "Beginner": "启程寻访", "Normal": "武库申领"}
TYPE_ORDER = ["Special", "Joint", "Rerun", "Standard", "Beginner"]


def hexcolor(s, fallback="#FFF719"):
    s = (s or "").strip().lstrip("#")
    if len(s) == 6 and re.fullmatch(r"[0-9a-fA-F]{6}", s):
        return "#" + s.upper()
    return fallback


def op_ref(it):
    nm = (it.get("target") or "").split("/")[-1] or it.get("name")
    return OPS.get(nm, {}).get("charId") or it.get("id")


pools = []
for p in RAW["pools"]:
    hero = p.get("_hero") or {}
    colors = hero.get("colors") or {}
    items = []
    for it in p["items"]:
        nm = (it.get("target") or "").split("/")[-1] or it.get("name")
        o = OPS.get(nm) or {}
        items.append({
            "id": o.get("charId") or it.get("id"),
            "name": it["name"],
            "rarity": it["rarity"],
            "up": bool(it.get("up") or it.get("isUp")),
            "hard": bool(it.get("isHardPity")),
            "w": it.get("weight") or 1,
        })
    pools.append({
        "id": p["poolId"],
        "name": p["poolName"],
        "type": p["poolType"],
        "typeLabel": p.get("_typeGroup") or TYPE_LABEL.get(p["poolType"], ""),
        "kind": "char",
        "accent": hexcolor(colors.get("textColor")),
        "tag": hero.get("tagLabel") or "",
        "open": hero.get("openTimeText") or "",
        "up": [i["id"] for i in items if i["up"]],
        "items": items,
        "rates": {"r6": p["star6BaseRate"] / 1e6, "r5": p["star5BaseRate"] / 1e6, "r4": p["star4BaseRate"] / 1e6},
        "pity": {"start": p["promoteStartPull"], "step": p["promoteStepValue"] / 1e6,
                 "soft": p["softGuarantee"], "hard": p["hardGuarantee"], "five": p["star5Pity"]},
        "freeAt": p.get("freeTenPullsAt") or [],
        "intervalPer": p.get("intervalRewardPer") or 0,
        "maxPulls": p.get("maxPullCount") or 0,
        "milestones": p.get("milestones") or [],
        "rules": p.get("rules") or [],
        "fifty": bool(p.get("fiftyFifty")),
        "single": bool(p.get("permitSinglePull")),
        "cost": {"single": 500, "ten": 5000},
    })

pools = [p for _, p in sorted(enumerate(pools),
                              key=lambda kv: (TYPE_ORDER.index(kv[1]["type"]) if kv[1]["type"] in TYPE_ORDER else 9, kv[0]))]

# weapons
weapons = {}
wpools = []
if RAW.get("weapon_pools"):
    for p in RAW["weapon_pools"]:
        hero = p.get("_hero") or {}
        colors = hero.get("colors") or {}
        items = []
        for it in p["items"]:
            wid = it.get("id")
            weapons.setdefault(wid, {
                "id": wid, "name": it["name"], "nameEn": it.get("nameEn") or "",
                "rarity": it["rarity"], "icon": "assets/wicon/%s.webp" % wid,
            })
            items.append({"id": wid, "name": it["name"], "rarity": it["rarity"],
                          "up": bool(it.get("up") or it.get("isUp")),
                          "hard": bool(it.get("isHardPity")), "w": it.get("weight") or 1})
        wpools.append({
            "id": p["poolId"], "name": p["poolName"], "type": "Normal", "typeLabel": "武库申领",
            "kind": "weapon", "accent": hexcolor(colors.get("textColor"), "#8FE3FF"),
            "tag": hero.get("tagLabel") or "", "open": hero.get("openTimeText") or "",
            "up": [i["id"] for i in items if i["up"]],
            "items": items,
            "rates": {"r6": p["star6BaseRate"] / 1e6, "r5": p["star5BaseRate"] / 1e6, "r4": p["star4BaseRate"] / 1e6},
            "pity": {"start": p["promoteStartPull"], "step": p["promoteStepValue"] / 1e6,
                     "soft": p["softGuarantee"], "hard": p["hardGuarantee"], "five": p["star5Pity"]},
            "freeAt": p.get("freeTenPullsAt") or [], "intervalPer": p.get("intervalRewardPer") or 0,
            "maxPulls": p.get("maxPullCount") or 0, "milestones": p.get("milestones") or [],
            "rules": p.get("rules") or [], "fifty": bool(p.get("fiftyFifty")),
            "single": False, "cost": {"single": 0, "ten": 1980}, "currency": "quota",
        })

print("char pools", len(pools), "weapon pools", len(wpools), "weapons", len(weapons))

# ---- weapon icons
jobs = [(w["icon"].split("assets/")[1], w) for w in weapons.values()]
urls = {}
for p in RAW["weapon_pools"]:
    for it in p["items"]:
        u = it.get("iconUrl") or it.get("iconContentUrl")
        if u and it.get("id") not in urls:
            urls[it["id"]] = u


def one(w):
    u = urls.get(w["id"])
    if not u:
        return None
    return BA.save_webp(u, w["icon"], 180, 88, True)


with ThreadPoolExecutor(max_workers=8) as ex:
    res = list(ex.map(one, list(weapons.values())))
print("weapon icons:", sum(1 for r in res if r and r[0]), "/", len(res))

# ---- hud icons
hud = {
    "diamond": ("https://assets.fz.wiki/c3338b6b5f3d4283/677e2cc10c1e5280.png", "assets/ui/diamond.webp"),
    "ticketSpecial": ("https://assets.fz.wiki/c3338b6b5f3d4283/e39ddd60bb198981.png", "assets/ui/ticket-special.webp"),
    "ticketStandard": ("https://assets.fz.wiki/c3338b6b5f3d4283/a063a4c889bd2c00.png", "assets/ui/ticket-standard.webp"),
    "ticketTen": ("https://assets.fz.wiki/c3338b6b5f3d4283/118207d030d765b1.png", "assets/ui/ticket-ten.webp"),
    "quota": ("https://assets.fz.wiki/c3338b6b5f3d4283/edeac0fbe8df0e1c.png", "assets/ui/quota.webp"),
}
for k, (u, rel) in hud.items():
    BA.save_webp(u, rel, 96, 90, True)

# ---- ops payload
CARDS = {}
_cp = os.path.join(ROOT, "data", "_cards.json")
if os.path.exists(_cp):
    CARDS = json.load(open(_cp, encoding="utf-8"))

POTDETAIL = {}
_pd = os.path.join(ROOT, "data", "potentials.json")
if os.path.exists(_pd):
    POTDETAIL = json.load(open(_pd, encoding="utf-8"))

ops_payload = {}
for nm, o in OPS.items():
    cid = o.get("charId") or nm
    meta = {m.get("label"): m.get("value") for m in (o.get("meta") or [])}
    ops_payload[cid] = {
        "id": cid, "name": o.get("name") or nm, "nameEn": o.get("nameEn") or "",
        "rarity": o.get("rarity"), "profession": o.get("profession") or "",
        "element": o.get("element") or "", "elementColor": o.get("elementColor") or "#8A8F98",
        "faction": o.get("faction") or "", "tags": o.get("tags") or [],
        "bio": o.get("bio") or "", "weapon": o.get("weaponType") or "",
        "cv": meta.get("CV · 中", ""), "race": meta.get("种族", ""),
        "birth": meta.get("生日", ""),
        "portrait": "assets/portrait/%s.webp" % cid,
        "icon": "assets/icon/%s.webp" % cid,
        "potentials": CARDS.get(cid, []),
        "potDetail": POTDETAIL.get(o.get("name") or nm, []),
    }

PROF = {}
_pd = os.path.join(ROOT, "assets", "prof")
if os.path.isdir(_pd):
    for f in os.listdir(_pd):
        if f.lower().endswith(".webp"):
            PROF[f[:-5]] = "assets/prof/" + f

data = {
    "meta": {"source": "https://www.fz.wiki/", "title": "明日方舟：终末地 · 寻访模拟器",
             "note": "卡池与干员数据来自终末地 Wiki（fz.wiki），概率与保底规则依照游戏内说明。"},
    "ops": ops_payload,
    "weapons": weapons,
    "pools": pools,
    "wpools": wpools,
    "professions": PROF,
}

out = os.path.join(ROOT, "data", "data.js")
with open(out, "w", encoding="utf-8") as f:
    f.write("/* generated from fz.wiki — do not edit by hand */\n")
    f.write("window.GACHA_DATA = ")
    json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    f.write(";\n")
print("wrote", out, round(os.path.getsize(out) / 1024), "KB")
