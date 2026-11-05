# -*- coding: utf-8 -*-
"""Replace the potential block in the operator modal + randomise strip offsets."""
import re

UI = r"E:\dsh-workspace\endfield-gacha\js\ui.js"
s = open(UI, encoding="utf-8").read()

# 1) random vertical offset, same amplitude as before (±26px)
old_dy = "    const dy = ((i % 2 ? 1 : -1) * (8 + (i % 3) * 9)) + 'px';"
new_dy = "    const dy = ((Math.random() * 1.7 + 0.3) * (Math.random() < 0.5 ? 1 : -1) * 26).toFixed(1) + 'px';"
assert old_dy in s
s = s.replace(old_dy, new_dy)

# 2) potential block
start = s.index('          <div class="pot-wrap">')
end = s.index('          <div class="md-bio">')
new_block = '''          <div class="pot-wrap">
            <div class="pot-head"><b>潜能 / POTENTIAL</b><span>${pot} / 5 · 信物 ${bag ? Math.max(0, bag.n - 1) : 0}</span></div>
            <div class="pot-steps">
              ${[1, 2, 3, 4, 5].map(i => {
                const d = (o.potDetail || []).find(x => x.lvl === i);
                return `<div class="pot-step ${i <= pot ? 'on' : ''}">
                  <b>0${i}</b><span>${esc(d ? d.name : '—')}</span></div>`;
              }).join('')}
            </div>
            <div class="pot-list">
              ${(o.potDetail || []).map(d => `
                <div class="pot-row ${pot >= d.lvl ? 'on' : ''}">
                  <div class="pr-lv">潜能 ${d.lvl}</div>
                  <div class="pr-body">
                    <b>${esc(d.name)}</b>
                    <p>${esc(d.desc)}</p>
                  </div>
                  <div class="pr-state">${pot >= d.lvl ? '已激活' : '未激活'}</div>
                </div>`).join('')}
            </div>
            <div class="pot-cards">
              ${cards.map(c => `<div class="pot-card ${pot >= c.lvl ? 'on' : ''}">
                <img src="${c.img}" alt="${esc(c.name)}" loading="lazy">
                <div><b>${esc(c.name)}</b><span>潜能 ${c.lvl} 解锁</span></div>
                ${pot >= c.lvl ? '' : '<div class="lock">LOCKED</div>'}
              </div>`).join('')}
            </div>
          </div>

'''
s = s[:start] + new_block + s[end:]

# 3) administrators default to 4 potentials
s = s.replace("""  function potOf(id) {
    const b = G.state.bag[id];
    return b ? Math.min(6, b.pot) : 0;
  }""", """  function potOf(id) {
    if (id === 'chr_0002_endminm' || id === 'chr_0003_endminf') return 4;
    const b = G.state.bag[id];
    return b ? Math.min(5, b.pot) : 0;
  }""")

open(UI, "w", encoding="utf-8").write(s)
print("patched potential UI; pot steps:", "pot-row" in s)
