# -*- coding: utf-8 -*-
"""Switch ten-pull strips to the official bust icons (always correctly framed)."""
UI = r"E:\dsh-workspace\endfield-gacha\js\ui.js"
s = open(UI, encoding="utf-8").read()

old = "    const src = pool.kind === 'weapon' ? (info.icon || '') : ('assets/bust/' + rec.id + '.webp');"
new = "    const src = pool.kind === 'weapon' ? (info.icon || '') : ('assets/icon/' + rec.id + '.webp');"
assert old in s
s = s.replace(old, new)
open(UI, "w", encoding="utf-8").write(s)
print("strips now use icons")

CSS = r"E:\dsh-workspace\endfield-gacha\css\app.css"
block = """

/* strip portrait: official bust icon, bottom fade into the plate */
.pstrip .ps-img { background: radial-gradient(70% 45% at 50% 30%, rgba(255,255,255,.06), transparent 70%); }
.pstrip img {
  object-fit: cover; object-position: 50% 12%;
  -webkit-mask-image: linear-gradient(180deg, #000 0%, #000 62%, rgba(0,0,0,.55) 80%, transparent 97%);
  mask-image: linear-gradient(180deg, #000 0%, #000 62%, rgba(0,0,0,.55) 80%, transparent 97%);
}
.pstrip .ps-meta { background: linear-gradient(180deg, transparent, rgba(4,5,7,.92) 42%); }
"""
with open(CSS, "a", encoding="utf-8") as f:
    f.write(block)
print("css appended")
