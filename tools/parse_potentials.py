# -*- coding: utf-8 -*-
"""Parse 潜能.txt (operator blocks, 潜能 1-5 with title + description)."""
import json, re

SRC = r"C:\Users\青雨\Desktop\潜能.txt"
OUT = r"E:\dsh-workspace\endfield-gacha\data\potentials.json"

tokens = [t.strip() for t in open(SRC, encoding="utf-8").read().replace("\r\n", "\n").split("\n") if t.strip()]
POT = re.compile(r"^潜能\s*([1-6])$")


def is_boundary(i):
    """True if tokens[i] is an operator name (immediately followed by 潜能 1)."""
    return i + 1 < len(tokens) and bool(POT.match(tokens[i + 1])) and POT.match(tokens[i + 1]).group(1) == "1"


data = {}
cur = None
i = 0
while i < len(tokens):
    t = tokens[i]
    m = POT.match(t)
    if m:
        lvl = int(m.group(1))
        title = tokens[i + 1] if i + 1 < len(tokens) and not POT.match(tokens[i + 1]) else ""
        j = i + 2
        desc = []
        while j < len(tokens):
            if POT.match(tokens[j]) or is_boundary(j):
                break
            desc.append(tokens[j])
            j += 1
        if cur is not None:
            data[cur].append({"lvl": lvl, "name": title, "desc": "\n".join(desc).strip()})
        i = j
        continue
    if is_boundary(i):
        cur = t
        data.setdefault(cur, [])
        i += 1
        continue
    i += 1

print("operators:", len(data))
for k, v in data.items():
    print("%-6s %d 潜 %s" % (k, len(v), " / ".join(x["name"] for x in v)))
json.dump(data, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("wrote", OUT)
