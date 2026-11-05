# -*- coding: utf-8 -*-
import io

CSS = r"E:\dsh-workspace\endfield-gacha\css\app.css"
block = """

/* ==========================================================================
   weapon rack + four-star blue edition
   ========================================================================== */
.ps-cards.weapon {
  display: grid; grid-template-columns: repeat(5, minmax(0, 1fr));
  gap: 16px 18px; padding: 108px 7vw 116px; place-content: center; align-items: start;
}
.wtile { position: relative; opacity: 0; transform: translateY(26px) scale(.96); transition: opacity .5s var(--ease-out), transform .5s var(--ease-out); }
.wtile.in { opacity: 1; transform: none; }
.wt-frame {
  position: relative; aspect-ratio: 1 / 1; overflow: hidden;
  background: linear-gradient(160deg, #121a22, #080c10 70%);
  border: 1px solid var(--line-2);
}
.wt-frame img { width: 100%; height: 100%; object-fit: contain; padding: 9%; }
.wtile.r6 .wt-frame { border-color: var(--six); box-shadow: 0 0 34px -10px var(--six), inset 0 0 40px -22px var(--six); }
.wtile.r5 .wt-frame { border-color: color-mix(in srgb, var(--five) 70%, transparent); }
.wtile.r4 .wt-frame { border-color: color-mix(in srgb, var(--four) 55%, transparent); }
.wt-scan {
  position: absolute; inset: 0; pointer-events: none;
  background: linear-gradient(180deg, transparent, rgba(120,180,255,.22), transparent);
  transform: translateY(-100%);
}
.wtile.in .wt-scan { animation: wtScan .85s ease-out; }
@keyframes wtScan { to { transform: translateY(100%); } }
.wt-meta { margin-top: 7px; display: flex; flex-direction: column; gap: 2px; }
.wt-meta b { font-size: 11px; color: #fff; letter-spacing: .03em; }
.wt-meta span { font: 400 8px/1 var(--f-mono); letter-spacing: .1em; color: var(--dim-2); }
.wtile.hot { z-index: 2; }
.wtile.hot .wt-frame { animation: wtPulse 2.2s ease-in-out infinite; }
@keyframes wtPulse { 50% { box-shadow: 0 0 56px -6px var(--six), inset 0 0 50px -18px var(--six); } }

.pullstage.weapon-mode { background: radial-gradient(ellipse at 50% 42%, #0a1724 0%, #03070b 72%); }
.pullstage.weapon-mode .ps-reticle { opacity: .16; }

.pullstage.four-mode { background: radial-gradient(ellipse at 50% 45%, #0a1a2e 0%, #030609 74%); }
.pullstage.four-mode .solo-rarity { -webkit-text-stroke: 1px rgba(91,155,255,.5); }
.pullstage.four-mode .ps-heat i { background: linear-gradient(90deg, #1b3f7a, var(--four), #d5e6ff); box-shadow: 0 0 14px rgba(91,155,255,.7); }

@media (max-width: 760px) {
  .ps-cards.weapon { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px 12px; padding: 96px 20px 110px; }
  .wt-meta b { font-size: 10px; }
}
"""
with io.open(CSS, "a", encoding="utf-8") as f:
    f.write(block)
print("css appended", len(block))
