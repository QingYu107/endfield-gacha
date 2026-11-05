# -*- coding: utf-8 -*-
"""Apply per-operator anchor nudges to tools/build_bust.py."""
import json, re, os

ROOT = r"E:\dsh-workspace\endfield-gacha"
DATA = os.path.join(ROOT, "data", "data.js")
BUILD = os.path.join(ROOT, "tools", "build_bust.py")

NUDGE = {
    "佩丽卡": (0.03, 0.0),
    "陈千语": (0.0, -0.03),
    "狼卫": (0.0, 0.03),
    "弧光": (-0.03, 0.03),
    "余烬": (0.03, 0.0),
    "赛希": (0.0, 0.0),
    "艾维文娜": (0.03, 0.0),
    "洁尔佩塔": (-0.02, 0.0),
    "昼雪": (0.02, 0.0),
    "黎风": (0.0, 0.0),
    "莱万汀": (0.03, 0.0),
    "伊冯": (-0.03, 0.0),
    "大潘": (-0.02, 0.0),
    "秋栗": (0.02, 0.0),
    "卡契尔": (-0.03, 0.0),
    "埃特拉": (-0.02, 0.0),
    "萤石": (0.02, 0.0),
    "安塔尔": (0.03, 0.0),
    "阿列什": (-0.03, 0.0),
    "艾尔黛拉": (-0.02, 0.0),
    "别礼": (0.02, 0.0),
    "汤汤": (0.0, 0.0),
    "洛茜": (-0.02, -0.02),
    "骏卫": (0.03, 0.0),
    "庄方宜": (0.07, 0.0),
    "弭弗": (0.0, 0.0),
    "诀": (0.0, 0.0),
    "决": (0.0, 0.0),
    "卡缪": (0.03, -0.03),
    "提弗洛斯": (0.0, 0.0),
    "梨诺": (0.03, 0.0),
    "祀": (0.03, -0.03),
    "明河": (0.0, 0.0),
}

src = open(DATA, encoding="utf-8").read()
data = json.loads(src.split("=", 1)[1].strip().rstrip(";"))
name2id = {v["name"]: k for k, v in data["ops"].items()}
print("ops in data:", len(name2id))

build = open(BUILD, encoding="utf-8").read()
m = re.search(r"ANCHOR = \{(.*?)\n\}", build, re.S)
body = m.group(1)
pairs = re.findall(r'"([^"]+)":\s*\(([0-9.]+),\s*([0-9.]+)\)', body)
entries = {k: (x, y) for k, x, y in pairs}

applied, missing = 0, []
for name, (dx, dy) in NUDGE.items():
    cid = name2id.get(name)
    if not cid:
        missing.append(name)
        continue
    f = cid + ".webp"
    if f not in entries:
        missing.append(name + "(no anchor)")
        continue
    x, y = float(entries[f][0]), float(entries[f][1])
    entries[f] = ("%.3f" % max(0.02, min(0.98, x + dx)), "%.3f" % max(0.02, min(0.98, y + dy)))
    applied += 1

new_body = "\n" + "\n".join('    "%s": (%s, %s),' % (k, v[0], v[1]) for k, v in sorted(entries.items())) + "\n"
build = build[:m.start()] + "ANCHOR = {" + new_body + "}" + build[m.end():]
open(BUILD, "w", encoding="utf-8").write(build)
print("applied", applied, "nudges; missing:", missing)
