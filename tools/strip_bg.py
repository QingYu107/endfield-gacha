# -*- coding: utf-8 -*-
"""Strip: blurred colour bed behind the bust plate."""
UI = r"E:\dsh-workspace\endfield-gacha\js\ui.js"
s = open(UI, encoding="utf-8").read()

old = '''    return `<div class="pstrip ${cls}" style="--dy:${dy}" data-id="${rec.id}">
      <div class="ps-img"><img src="${src}" alt="${esc(rec.name)}" loading="eager"></div>'''
new = '''    return `<div class="pstrip ${cls}" style="--dy:${dy}" data-id="${rec.id}">
      <div class="ps-bg" style="background-image:url('${src}')"></div>
      <div class="ps-img"><img src="${src}" alt="${esc(rec.name)}" loading="eager"></div>'''
assert old in s
s = s.replace(old, new)
open(UI, "w", encoding="utf-8").write(s)
print("bg layer added")

CSS = r"E:\dsh-workspace\endfield-gacha\css\app.css"
block = """

/* blurred colour bed behind the bust plate */
.pstrip .ps-bg {
  position: absolute; inset: -6%; z-index: 0; pointer-events: none;
  background-size: cover; background-position: 50% 18%;
  filter: blur(26px) saturate(1.35) brightness(.42);
  transform: scale(1.08);
  opacity: .85;
}
.pstrip .ps-img { z-index: 1; }
"""
with open(CSS, "a", encoding="utf-8") as f:
    f.write(block)
print("css appended")
