/* ==========================================================================
   终末地 · 寻访模拟器 — ui.js
   ========================================================================== */
(function () {
  'use strict';

  const G = window.Gacha;
  const A = window.Audio2;
  const D = G.D;
  const $ = s => document.querySelector(s);
  const $$ = s => Array.from(document.querySelectorAll(s));
  const fmt = n => (n || 0).toLocaleString('en-US');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ------------------------------------------------------------------ sfx */
  const Sfx = {
    get on() { return A.on; },
    set on(v) { A.on = v; },
    click() { A.play('tick'); },
    deal(rate) { A.play('deal', { rate }); },
    flip() { A.play('flip'); },
    five() { A.play('rare5'); },
    six() { A.play('rare6'); },
    preroll() { A.play('preroll'); },
    confirm() { A.play('confirm'); },
    potential() { A.play('potential'); },
    error() { A.play('error'); }
  };

  /* ---------------------------------------------------------------- state */
  const ui = {
    type: 'Special',
    pool: null,
    tab: 'result',
    last: [],
    busy: false,
    skipped: false,
    fast: false,
    codexFilter: 'all',
    seq: 0,
    voiceIdx: 0
  };

  /* ------------------------------------------------------------- helpers  */
  function accentOf(p) {
    let c = (p.accent || '#FFEF5A').replace('#', '');
    if (c.length !== 6) return '#FFEF5A';
    const r = parseInt(c.slice(0, 2), 16), g = parseInt(c.slice(2, 4), 16), b = parseInt(c.slice(4, 6), 16);
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    if (lum < 0.3 || lum > 0.97) return '#FFEF5A';
    return '#' + c;
  }
  function applyAccent(p) {
    document.documentElement.style.setProperty('--acc', accentOf(p));
  }
  function thumbOf(p) {
    if (p.kind === 'weapon') {
      const w = p.up[0] || (p.items.find(i => i.rarity === 6) || p.items[0] || {}).id;
      return 'assets/wicon/' + w + '.webp';
    }
    return 'assets/banner/' + p.id + '.webp';
  }
  function artOf(p) {
    if (p.kind === 'weapon') {
      const w = p.up[0] || (p.items.find(i => i.rarity === 6) || p.items[0] || {}).id;
      return { src: 'assets/wicon/' + w + '.webp', name: (G.WEAPONS[w] || {}).name || p.name, sub: 'ARSENAL / 6★' };
    }
    const upId = p.up[0] || (p.items.find(i => i.rarity === 6) || p.items[0] || {}).id;
    const o = G.OPS[upId] || {};
    return { src: o.portrait || '', name: o.name || p.name, sub: (o.nameEn || 'ENDFIELD').toUpperCase() };
  }
  function itemInfo(pool, id) {
    return pool.kind === 'weapon' ? (G.WEAPONS[id] || {}) : (G.OPS[id] || {});
  }
  function quoteOf(o) {
    if (!o || !o.bio) return '';
    const m = o.bio.match(/[「“]([^」”]{4,60})[」”]/);
    return m ? m[1] : o.bio.split('\n')[0].slice(0, 46);
  }
  function potLabel(lv) {
    return ['留影', '强化', '留影', '强化', '留影', '终解'][lv - 1] || '';
  }

  /* --------------------------------------------------------------- toasts */
  function toast(msg, ms) {
    const box = $('#toasts');
    const t = document.createElement('div');
    t.className = 'toast';
    t.innerHTML = msg;
    box.appendChild(t);
    setTimeout(() => { t.classList.add('out'); setTimeout(() => t.remove(), 320); }, ms || 2400);
  }

  /* --------------------------------------------------------- number roll  */
  function rollTo(el, to, ms) {
    const from = parseInt(String(el.dataset.v || el.textContent).replace(/[^\d-]/g, ''), 10) || 0;
    el.dataset.v = to;
    if (from === to) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    const dur = ms || 420;
    const step = now => {
      const k = Math.min(1, (now - t0) / dur);
      const e = 1 - Math.pow(1 - k, 3);
      el.textContent = fmt(Math.round(from + (to - from) * e));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------------------------------------------------------------- boot  */
  function preload(list, onProgress) {
    let done = 0;
    return Promise.all(list.map(src => new Promise(res => {
      if (!src) { done++; onProgress && onProgress(done / list.length); return res(); }
      const im = new Image();
      im.onload = im.onerror = () => { done++; onProgress && onProgress(done / list.length); res(); };
      im.src = src;
    })));
  }

  async function bootFlow() {
    const urls = new Set();
    G.getAllPools().forEach(p => urls.add(thumbOf(p)));
    const first = G.getAllPools().find(p => p.type === 'Special') || G.getAllPools()[0];
    first.items.forEach(i => { const o = G.OPS[i.id]; if (o) { urls.add(o.icon); urls.add(o.portrait); } });
    const art = artOf(first);
    if (art.src) urls.add(art.src);

    const bar = $('.boot-line i'), pctEl = $('#bootPct');
    await preload(Array.from(urls), r => {
      bar.style.width = Math.round(r * 100) + '%';
      pctEl.textContent = Math.round(r * 100) + '%';
    });
    await sleep(240);
    $('#boot').classList.add('gone');
    setTimeout(() => { const b = $('#boot'); if (b) b.remove(); }, 900);
  }

  /* ---------------------------------------------------------------- rail  */
  const ICONS = {
    special: '<path d="M12 2l2.4 6.6L21 11l-6.6 2.4L12 20l-2.4-6.6L3 11l6.6-2.4z"/>',
    joint: '<path d="M7 4h10v4h4v10h-4v2H7v-2H3V8h4z"/><path d="M9 9h6v6H9z"/>',
    rerun: '<path d="M4 12a8 8 0 1 1 3 6.2"/><path d="M4 20v-5h5"/><path d="M12 8v4l3 2"/>',
    standard: '<rect x="3" y="3" width="18" height="18"/><path d="M3 9h18M9 9v12"/>',
    beginner: '<path d="M12 3l2.5 5.5L20 10l-5.5 1.5L12 17l-2.5-5.5L4 10l5.5-1.5z"/><path d="M5 19l4-4"/>',
    weapon: '<path d="M14 3l7 7-4 1-6 6 1 4-3-3-4-4 1-3 6-6z"/><path d="M4 20l4-4"/>'
  };

  function renderRail() {
    const rail = $('#rail');
    rail.innerHTML = G.TYPES.map(t => {
      const n = G.poolsOf(t.key).length;
      return `<button class="rail-item ${ui.type === t.key ? 'active' : ''}" data-type="${t.key}" title="${t.label} · ${n}">
        <svg viewBox="0 0 24 24" fill="none" stroke-width="1.3">${ICONS[t.icon]}</svg>
        <b>${t.label.slice(0, 2)}</b><i>${t.en}</i>
      </button>`;
    }).join('') + `<div class="rail-bottom"><div class="rail-dot"></div><div class="rail-ver">SIM · 01</div></div>`;

    rail.querySelectorAll('.rail-item').forEach(b => b.addEventListener('click', () => {
      Sfx.click();
      ui.type = b.dataset.type;
      const list = G.poolsOf(ui.type);
      if (list[0]) selectPool(list[0].id);
      renderRail();
    }));
  }

  /* ------------------------------------------------------------ pool list */
  function renderPoolList() {
    const list = G.poolsOf(ui.type);
    $('#poolCount').textContent = list.length;
    $('#poolList').innerHTML = list.map(p => {
      const ps = G.poolState(p.id);
      const up = p.up.map(id => itemInfo(p, id).name).filter(Boolean).join('、');
      return `<button class="pool-item ${ui.pool && ui.pool.id === p.id ? 'active' : ''}" data-id="${p.id}">
        <img src="${thumbOf(p)}" alt="" loading="lazy" onerror="this.style.opacity=.15">
        <div class="pi-txt">
          <b>${esc(p.name)}</b>
          <small>${esc(p.typeLabel)}${up ? ' · ' + esc(up) : ''}</small>
        </div>
        <em>${ps.pulls || ''}</em>
        ${p.up.length ? '<span class="badge-up">UP</span>' : ''}
      </button>`;
    }).join('');
    $$('#poolList .pool-item').forEach(b => b.addEventListener('click', () => {
      Sfx.click(); selectPool(b.dataset.id);
    }));
  }

  /* -------------------------------------------------------------- banner  */
  function renderBanner() {
    const p = ui.pool; if (!p) return;
    applyAccent(p);
    const art = artOf(p);
    const artEl = $('#upArt');
    artEl.classList.add('swap');
    setTimeout(() => {
      artEl.src = art.src;
      artEl.alt = art.name;
      artEl.classList.remove('swap');
    }, 150);

    $('#crType').textContent = p.typeLabel;
    $('#crId').textContent = p.id.toUpperCase();
    $('#poolName').textContent = p.name;
    $('#sideNo').textContent = String(G.poolsOf(ui.type).indexOf(p) + 1).padStart(2, '0');
    $('#tagOpen').textContent = p.open || '长期开放';

    const upNames = p.up.map(id => {
      const o = itemInfo(p, id);
      return `<span class="nm">${esc(o.name || id)}</span><span class="en">${esc((o.nameEn || '').toUpperCase())}</span>`;
    });
    $('#upLine').innerHTML = p.up.length
      ? `<span class="rar">6★</span>${upNames.join('<span class="flag">概率提升</span>')}`
      : `<span class="rar">6★</span><span class="nm">${p.kind === 'weapon' ? '本期六星武器' : '常驻六星'}</span><span class="en">${p.items.filter(i => i.rarity === 6).length} 名</span>`;

    const sixRate = (p.rates.r6 * 100).toFixed(2);
    $('#poolDesc').textContent = p.kind === 'weapon'
      ? '武库申领 · 使用「武库配额」开启武器补给。六星武器基础概率 4%，40 次内必定获取六星武器，80 次内必定获得本期概率提升武器。'
      : `「${p.typeLabel}」干员寻访。六星基础概率 ${sixRate}%，连续 65 次未获得六星后每次提升 5%，最多 ${p.pity.soft} 次必定获得六星。`;

    $('#rateStrip').innerHTML = `
      <div class="c6"><b>${sixRate}%</b><span>六星基础</span></div>
      <div class="c5"><b>${(p.rates.r5 * 100).toFixed(2)}%</b><span>五星</span></div>
      <div class="c4"><b>${(p.rates.r4 * 100).toFixed(1)}%</b><span>四星</span></div>
      <div><b>${p.pity.soft}<i style="font-style:normal;font-size:10px">抽</i></b><span>六星保底</span></div>
      <div><b>${p.pity.hard || '—'}${p.pity.hard ? '<i style="font-style:normal;font-size:10px">抽</i>' : ''}</b><span>${p.kind === 'weapon' ? 'UP 武器' : '当期 UP'}</span></div>`;

    $('#artName').textContent = art.name;
    $('#artSub').textContent = art.sub;

    const upOp = p.up.length ? G.OPS[p.up[0]] : null;
    const quote = quoteOf(upOp);
    $('#poolQuote').innerHTML = quote
      ? `「${esc(quote)}」`
      : `「${p.typeLabel}」${p.kind === 'weapon' ? '武器补给' : '干员寻访'} — 第 ${G.poolsOf(ui.type).indexOf(p) + 1} 期。`;

    const ps = G.poolState(p.id);
    const sc = G.scopeState(p);
    const counters = [
      { k: '本池累计', v: ps.pulls, s: 'PULLS' },
      { k: '六星保底', v: `${sc.six}<i>/${p.pity.soft}</i>`, s: 'PITY', warn: sc.six >= p.pity.soft - 15 },
      { k: '当期获取', v: `${ps.upCount}`, s: 'RATE UP' }
    ];
    if (p.pity.hard) counters.push({ k: 'UP 累计', v: `${Math.min(ps.pulls, p.pity.hard)}<i>/${p.pity.hard}</i>`, s: 'SPARK' });
    $('#pullCounters').innerHTML = counters.map(c =>
      `<div class="pc ${c.warn ? 'warn' : ''}"><b>${c.v}</b><span>${c.k} · ${c.s}</span></div>`).join('');

    const single = $('#btnSingle'), ten = $('#btnTen'), free = $('#btnFree');
    const isWeapon = p.kind === 'weapon';
    single.hidden = isWeapon || !p.single;
    single.querySelector('.b-s').textContent = isWeapon ? '' : fmt(p.cost.single) + ' 嵌晶玉';
    ten.querySelector('.b-k').textContent = isWeapon ? '十连申领' : '十连寻访';
    ten.querySelector('.b-s').textContent = isWeapon ? fmt(p.cost.ten) + ' 配额' : fmt(p.cost.ten) + ' 嵌晶玉';
    const freeReady = G.freeReady(p);
    free.hidden = !freeReady;
    free.querySelector('.b-s').textContent = '免费 · 本池替换下一次寻访';

    const money = isWeapon ? G.state.quota : G.state.dia;
    ten.disabled = money < p.cost.ten;
    single.disabled = money < p.cost.single;
    if (p.maxPulls) {
      const left = p.maxPulls - ps.pulls;
      ten.disabled = ten.disabled || left <= 0;
      single.disabled = true;
    }
  }

  /* ------------------------------------------------------------ progress  */
  function meter(label, val, max, cls, sub) {
    const w = max > 0 ? clamp((val / max) * 100, 0, 100) : 0;
    return `<div class="meter ${cls}">
      <div class="meter-top"><span>${label}</span><b>${val}<em> / ${max}</em></b></div>
      <div class="meter-bar"><i style="width:${w}%"></i></div>
      ${sub ? `<div class="meter-sub">${sub}</div>` : ''}
    </div>`;
  }

  function renderProgress() {
    const p = ui.pool; if (!p) return;
    const ps = G.poolState(p.id), sc = G.scopeState(p);
    const r = G.rates(p);
    const left6 = Math.max(0, p.pity.soft - sc.six);
    let html = '';
    html += meter('六星保底 / 6★ PITY', sc.six, p.pity.soft, 'p6',
      `下一抽六星率 <b style="color:var(--six)">${(r.cur6 * 100).toFixed(2)}%</b> · 剩余 ${left6} 抽`);
    html += meter('五星保底 / 5★ PITY', sc.five, p.pity.five, 'p5', '十连内必定获得 5★ 或以上');
    if (p.pity.hard) html += meter('当期 UP / RATE UP', Math.min(ps.pulls, p.pity.hard), p.pity.hard, 'pup',
      ps.gotUp ? '已获得本期概率提升对象' : `${p.pity.hard} 抽内必定获得`);
    if (p.intervalPer) html += meter('信物赠礼 / TOKEN', ps.pulls % p.intervalPer || (ps.pulls ? p.intervalPer : 0), p.intervalPer, 'plt',
      `每 ${p.intervalPer} 抽赠送信物 · 已获 ${ps.tokens}`);

    const nextFree = (p.freeAt || []).find(at => ps.pulls < at);
    html += `<div class="prog-note">
      <div class="pn-row"><span>加急十连</span><b class="${G.freeReady(p) ? 'hot' : ''}">${G.freeReady(p) ? '待触发' : '无'}</b></div>
      <div class="pn-row"><span>下一档加急</span><b>${nextFree ? ps.pulls + ' / ' + nextFree : '已全部解锁'}</b></div>
      <div class="pn-row"><span>本池累计</span><b>${ps.pulls} 抽</b></div>
      <div class="pn-row"><span>获取 UP</span><b>${ps.upCount} 次</b></div>
      ${p.maxPulls ? `<div class="pn-row"><span>剩余次数</span><b>${Math.max(0, p.maxPulls - ps.pulls)} / ${p.maxPulls}</b></div>` : ''}
      <button class="prog-reset" id="btnPoolReset" type="button">重置本池进度</button>
    </div>`;

    if ((p.milestones || []).length) {
      html += `<div class="prog-note">
        <div class="pn-row" style="color:var(--dim-2)"><span>里程碑</span><b></b></div>
        ${p.milestones.map(m => `<div class="pn-row"><span>${m.pull} 抽</span><b class="${ps.pulls >= m.pull ? '' : 'dim'}">${esc(m.label)}</b></div>`).join('')}
      </div>`;
    }
    $('#progBody').innerHTML = html;

    const rb = $('#btnPoolReset');
    if (rb) rb.addEventListener('click', () => {
      if (!rb.classList.contains('arm')) {
        rb.classList.add('arm');
        rb.textContent = '再点一次 · 确认重置';
        Sfx.click();
        setTimeout(() => {
          if (rb.isConnected) { rb.classList.remove('arm'); rb.textContent = '重置本池进度'; }
        }, 3200);
        return;
      }
      G.resetPool(p);
      ui.last = [];
      Sfx.confirm();
      toast(`「${esc(p.name)}」进度已重置`);
      syncAll();
    });
  }

  /* ------------------------------------------------------------ selection */
  function selectPool(id) {
    const p = G.poolById(id); if (!p) return;
    ui.pool = p;
    ui.type = p.type;
    applyAccent(p);
    renderRail();
    renderPoolList();
    renderBanner();
    renderProgress();
    renderRules();
    if (window.FX) { try { window.FX.setTone(accentOf(p)); } catch (e) {} }
    p.items.forEach(i => { const o = G.OPS[i.id]; if (o) { const im = new Image(); im.src = o.portrait; } });
  }

  /* ------------------------------------------------------- pull stage v3  */
  const NOOP = function () {};
  const FX_PROXY = { mount: NOOP, setTone: NOOP, setRarity: NOOP, setFocus: NOOP, burst: NOOP, pause: NOOP, resume: NOOP, destroy: NOOP };
  const FX = () => (window.FX || FX_PROXY);
  const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789/#%·—';

  function profIcon(prof) {
    const p = (D.professions || {})[prof];
    return p ? encodeURI(p) : '';
  }
  function rarityColor(r) {
    return r === 6 ? '#ff5a4e' : r === 5 ? '#f0b73f' : '#5b9bff';
  }

  function markupWTile(rec, pool, i) {
    const info = itemInfo(pool, rec.id);
    const cls = rec.rarity === 6 ? 'r6' : rec.rarity === 5 ? 'r5' : 'r4';
    return `<div class="wtile ${cls}" style="--i:${i}" data-id="${rec.id}">
      <div class="wt-frame">
        <img src="${info.icon || ''}" alt="${esc(rec.name)}" loading="eager">
        <div class="wt-scan"></div>
      </div>
      <div class="wt-meta"><b>${esc(rec.name)}</b><span>${rec.rarity}★${rec.up ? ' · UP' : ''}</span></div>
    </div>`;
  }

  /* phone: flex board, fixed-width strips so 5 land per row */
  function fitCards() {
    const el = document.getElementById("psCards");
    if (!el) return;
    el.removeAttribute("style");
    const strips = el.querySelectorAll(".pstrip");
    strips.forEach(function (p) {
      p.style.width = ""; p.style.height = ""; p.style.maxWidth = ""; p.style.flex = "";
    });
    const vw = Math.floor(Math.min(window.visualViewport ? window.visualViewport.width : 1e9, document.documentElement.clientWidth || window.innerWidth));
    if (vw > 760 || !el.classList.contains("ten")) return;
    const gap = 4;
    const wcss = "calc((100vw - 86px) / 5)";
    const hcss = "calc((100vw - 86px) / 5 * 3.05)";
    el.style.setProperty("display", "flex", "important");
    el.style.setProperty("flex-wrap", "wrap", "important");
    el.style.setProperty("justify-content", "center", "important");
    el.style.setProperty("align-content", "center", "important");
    el.style.setProperty("column-gap", "10px", "important");
    el.style.setProperty("row-gap", "10px", "important");
    el.style.setProperty("width", "100vw", "important");
    el.style.margin = "0 auto";
    el.style.setProperty("padding", "64px 0 96px", "important");
    el.style.height = "auto";
    el.style.overflow = "hidden";
    el.style.boxSizing = "border-box";
    strips.forEach(function (p) {
      p.style.setProperty("width", wcss, "important");
      p.style.setProperty("min-width", wcss, "important");
      p.style.setProperty("max-width", wcss, "important");
      p.style.setProperty("height", hcss, "important");
      p.style.setProperty("flex", "0 0 " + wcss, "important");
      p.style.setProperty("margin", "0", "important");
      p.style.setProperty("padding", "0", "important");
      p.style.margin = "0";
    });
  }

  function markupStrip(rec, pool, i) {
    const info = itemInfo(pool, rec.id);
    const src = pool.kind === 'weapon' ? (info.icon || '') : ('assets/bust/' + rec.id + '.webp');
    const cls = rec.rarity === 6 ? 'r6' : rec.rarity === 5 ? 'r5' : 'r4';
    const amp = (document.documentElement.clientWidth || window.innerWidth) <= 760 ? 9 : 26;
    const dy = ((Math.random() * 1.7 + 0.3) * (Math.random() < 0.5 ? 1 : -1) * amp).toFixed(1) + 'px';
    const prof = pool.kind === 'weapon' ? '' : (info.profession || '');
    const pi = profIcon(prof);
    return `<div class="pstrip ${cls}" style="--dy:${dy}" data-id="${rec.id}">
      <div class="ps-bg" style="background-image:url('${src}')"></div>
      <div class="ps-img"><img src="${src}" alt="${esc(rec.name)}" loading="eager"></div>
      <div class="ps-tone"></div>
      <div class="ps-edge"></div>
      <div class="ps-rar">${rec.rarity}★</div>
      ${rec.rarity === 6 ? '<div class="ps-glow"></div><div class="ps-sweep"></div>' : ''}
      <div class="ps-meta">
        ${prof ? `<div class="ps-prof">${pi ? `<img src="${pi}" alt="">` : ''}<span>${esc(prof)}</span></div>` : ''}
        <b>${esc(rec.name)}</b>
        <small>${esc(pool.name)}${rec.up ? ' · 概率提升' : ''}</small>
      </div>
      ${rec.fresh ? '' : `<div class="ps-new">潜能 ${rec.potBefore}→${rec.potAfter}</div>`}
    </div>`;
  }

  /* ---- scramble / decode text ---- */
  function scramble(el, text, dur) {
    return new Promise(resolve => {
      if (ui.skipped || ui.noType) { el.textContent = text; return resolve(); }
      const t0 = performance.now();
      const tick = () => {
        if (ui.skipped) { el.textContent = text; return resolve(); }
        const k = Math.min(1, (performance.now() - t0) / dur);
        const keep = Math.floor(text.length * (k * k));
        let out = '';
        for (let i = 0; i < text.length; i++) {
          if (text[i] === ' ') { out += ' '; continue; }
          out += i < keep ? text[i] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        el.textContent = out;
        if (k < 1) requestAnimationFrame(tick);
        else { el.textContent = text; resolve(); }
      };
      requestAnimationFrame(tick);
    });
  }

  async function decodeIntro(pool, n, results) {
    const box = $('#psDecode');
    const top = $('#dcTop'), main = $('#dcMain'), sub = $('#dcSub'), bar = $('#dcBar');
    const rs = results || [];
    const tier = rs.some(r => r.rarity === 6) ? 6 : rs.some(r => r.rarity === 5) ? 5 : 4;
    const q = ui.qs || new URLSearchParams(location.search);
    const forcedTier = q.get('tier') ? +q.get('tier') : 0;
    const tierX = forcedTier || tier;
    const egg = q.get('egg') === '1' ? true : q.get('egg') === '0' ? false : (tierX === 6 && Math.random() < 0.42);   // 彩蛋：先黄后红
    box.classList.remove('tier4', 'tier5', 'tier6', 'on', 'out');
    box.classList.add(egg ? 'tier5' : 'tier' + tierX);
    if (bar) bar.style.width = '0%';
    top.textContent = '';
    main.textContent = '';
    sub.textContent = '';

    const title = n > 1 ? 'TEN-FOLD HEADHUNT' : 'LONE HEADHUNT';
    const code = 'SIGNAL ACQUIRING · ' + pool.id.toUpperCase().replace(/_/g, ' ') +
      ' · ' + Math.floor(Math.random() * 900 + 100) + ' ' + Math.floor(Math.random() * 90 + 10);

    box.classList.add('on');
    if (ui.skipped || ui.holdIntro) {
      top.textContent = 'ENDFIELD';
      main.textContent = title;
      sub.textContent = code;
      if (bar) bar.style.width = '100%';
      await sleep(50);
    } else {
      Sfx.preroll();
      await scramble(top, 'ENDFIELD', 440);
      if (bar) bar.style.width = '30%';
      await sleep(80);
      await scramble(main, title, 600);
      if (bar) bar.style.width = '72%';
      if (egg) {
        await sleep(330);
        box.classList.remove('tier5');
        box.classList.add('tier6');
        main.classList.add('dc-flicker');
        if (FX()) FX().setRarity(6);
        Sfx.six();
        setTimeout(() => main.classList.remove('dc-flicker'), 760);
        await sleep(760);
      }
      await scramble(sub, code, 280);
      if (bar) bar.style.width = '100%';
      await sleep(240);
    }
    if (ui.holdIntro) { await new Promise(() => {}); }
    box.classList.add('out');
    await sleep(ui.skipped ? 40 : 300);
    box.classList.remove('on', 'out', 'tier4', 'tier5', 'tier6');
  }

  async function armoryIntro(pool) {
    const box = $('#psArmory');
    if (!box) return;
    const bar = $('#arBar');
    $('#arName').textContent = pool.name;
    $('#arSub').textContent = 'WEAPON SUPPLY // ' + (pool.up && pool.up.length ? 'RATE UP TARGET LOCKED' : 'REQUESTING 10 UNITS');
    const upItem = (pool.items || []).find(i => i.up) || null;
    const upImg = $('#arUpImg');
    if (upImg) {
      const upWeapon = upItem ? itemInfo(pool, upItem.id) : null;
      upImg.src = (upWeapon && upWeapon.icon) || (upItem && upItem.icon) || '';
      upImg.style.display = upItem ? '' : 'none';
    }
    if ($('#arUpName')) $('#arUpName').textContent = upItem ? upItem.name : '—';
    if (bar) bar.style.width = '0%';
    box.classList.add('on');
    box.style.opacity = '1';
    box.style.visibility = 'visible';
    await sleep(40);
    if (!ui.skipped) {
      Sfx.preroll();
      if (bar) bar.style.width = '42%';
      await sleep(420);
      if (bar) bar.style.width = '86%';
      await sleep(300);
    }
    if (bar) bar.style.width = '100%';
    await sleep(ui.skipped ? 40 : 200);
    if (ui.holdIntro) { await new Promise(() => {}); }
    box.classList.remove('on');
    box.style.opacity = '0';
    box.style.visibility = 'hidden';
    await sleep(ui.skipped ? 30 : 240);
  }

  /* ---- solo showcase ---- */
  function renderSolo(rec, pool, kicker) {
    const info = itemInfo(pool, rec.id);
    const solo = $('#psSolo');
    $('#soloImg').src = pool.kind === 'weapon' ? info.icon : ('assets/stage/' + rec.id + '.webp');
    $('#soloRarity').textContent = rec.rarity;
    $('#soloKicker').textContent = kicker;
    $('#soloName').textContent = rec.name;
    $('#soloEn').textContent = (info.nameEn || (pool.kind === 'weapon' ? 'ARSENAL' : 'OPERATOR')).toUpperCase();
    $('#soloStars').innerHTML = Array.from({ length: rec.rarity }, (_, i) => `<i style="--n:${i}"></i>`).join('');
    const prof = pool.kind === 'weapon' ? '' : (info.profession || '');
    const pi = profIcon(prof);
    $('#soloProf').innerHTML = `${pi ? `<img src="${pi}" alt="">` : ''}<span>${esc(prof || rec.rarity + '★')}</span>`;
    $('#soloTags').innerHTML = [rec.up ? '概率提升' : '', rec.fresh ? '首次获得' : `潜能 ${rec.potBefore} → ${rec.potAfter}`, pool.typeLabel]
      .filter(Boolean).map(t => `<span>${esc(t)}</span>`).join('');
    solo.style.setProperty('--rc', rarityColor(rec.rarity));
    if (FX()) { FX().setRarity(rec.rarity); FX().setFocus(0.32, 0.55); }
  }

  /** 展示停留：用户点一下立刻走，否则等 ms 毫秒自动收起 */
  function holdSolo(ms) {
    return new Promise(resolve => {
      let done = false;
      const fin = () => {
        if (done) return;
        done = true;
        clearTimeout(timer);
        document.removeEventListener('pointerdown', onTap, true);
        document.removeEventListener('keydown', onKey, true);
        resolve();
      };
      const onTap = () => setTimeout(fin, 0);
      const onKey = () => setTimeout(fin, 0);
      const timer = setTimeout(fin, ui.skipped ? 40 : ms);
      document.addEventListener('pointerdown', onTap, true);
      document.addEventListener('keydown', onKey, true);
    });
  }

  function soloKick(rec) {
    const r = (rec && rec.rarity) || 4;
    if (r >= 6) return 'SIGNAL OVERRIDE · 单次寻访';
    if (r === 5) return 'SIGNAL LOCKED · 单次寻访';
    return 'SIGNAL TRACE · 单次寻访';
  }

  async function showSolo(rec, pool, kicker) {
    const solo = $('#psSolo');
    renderSolo(rec, pool, kicker);
    // 先让新立绘解码完成，否则会短暂显示上一张（余烬/明河串图）
    const art = $('#soloImg');
    if (art && art.decode) {
      try {
        await Promise.race([
          art.decode().catch(() => {}),
          new Promise(r => setTimeout(r, ui.skipped ? 120 : 320))
        ]);
      } catch (e) {}
    }
    solo.classList.remove('out');
    solo.classList.add('on');
    solo.style.opacity = '1';
    solo.style.visibility = 'visible';
    await sleep(30);
    solo.classList.add('reveal');
    const lineEl = $('#soloLine');
    const vrec = window.VOICES ? window.VOICES[rec.id] : null;
    if (lineEl) {
      lineEl.textContent = vrec ? '「' + vrec.text + '」' : '';
      lineEl.classList.toggle('on', !!vrec);
    }
    if (rec.rarity === 6) {
      if (!A.playVoice(rec.id)) A.stopSpeak(); // 无官方配音时保持安静，不用合成音
    }
    Sfx.six();
    if (FX()) FX().burst(1);
    spawnSparks();
    $('.ps-flash').classList.add('fire');
    setTimeout(() => $('.ps-flash').classList.remove('fire'), 620);
    await sleep(ui.skipped ? 120 : 1150);
  }

  async function hideSolo() {
    const solo = $('#psSolo');
    solo.classList.add('out');
    solo.classList.remove('on', 'reveal');
    solo.style.opacity = '0';
    solo.style.visibility = 'hidden';
    await sleep(ui.skipped ? 60 : 420);
    solo.classList.remove('out');
  }

  function spawnSparks() {
    const box = $('#psSparks');
    box.innerHTML = '';
    for (let i = 0; i < 18; i++) {
      const s = document.createElement('i');
      s.style.setProperty('--a', (i * 20 + Math.random() * 14) + 'deg');
      s.style.setProperty('--d', (Math.random() * 0.2).toFixed(2) + 's');
      box.appendChild(s);
    }
  }

  async function typeLine(el, text, speed) {
    speed = speed || 24;
    if (ui.skipped) { el.textContent = text; return; }
    el.textContent = '';
    for (let i = 0; i < text.length; i++) {
      if (ui.skipped) { el.textContent = text; return; }
      el.textContent += text[i];
      await sleep(speed);
    }
  }

  function revealAgain(pool, n) {
    const b = $('#psAgain');
    if (!b) return;
    const isW = pool.kind === 'weapon' || !pool.single;
    const free = G.freeReady(pool);
    // 加急是替换机制：一旦有加急，下一次无论点哪个按钮都走免费十连
    const kind = free ? 'ten' : (n === 1 && !isW ? 'single' : 'ten');
    const cost = kind === 'single' ? pool.cost.single : pool.cost.ten;
    const money = isW ? G.state.quota : G.state.dia;
    ui.againKind = kind;
    b.hidden = false;
    b.querySelector('.b-k').textContent = kind === 'single' ? '再来一抽' : '再来十连';
    b.querySelector('.b-s').textContent = free ? '加急 · 免费'
      : (isW ? fmt(cost) + ' 配额' : fmt(cost) + ' 嵌晶玉');
    b.disabled = !free && money < cost;
    b.classList.toggle('free', !!free);
  }

  function drawVwLog() {
    const de = document.documentElement;
    const rows = ['vw', 'inner=' + window.innerWidth + ' client=' + de.clientWidth + ' scroll=' + de.scrollWidth,
      'dpr=' + window.devicePixelRatio + ' ua=mobile:' + /Mobi|Android/i.test(navigator.userAgent)];
    rows.push('body.scroll=' + document.body.scrollWidth + ' body.client=' + document.body.clientWidth);
    const all = [...document.querySelectorAll('body *')];
    const wide = all.map(el => ({ el, r: el.getBoundingClientRect(), cs: getComputedStyle(el) }))
      .filter(x => (x.r.right > de.clientWidth + 1 || x.r.width > de.clientWidth + 1) && x.cs.position !== 'fixed' && x.cs.display !== 'none')
      .sort((a, b) => b.r.right - a.r.right).slice(0, 7);
    wide.forEach(x => {
      const cls = (x.el.className || '').toString().trim().split(/\s+/).slice(0, 2).join('.');
      const par = x.el.parentElement;
      const pcls = par ? (par.className || '').toString().trim().split(/\s+/)[0] : '';
      rows.push(x.el.tagName.toLowerCase() + '.' + cls + ' <' + pcls + '> r=' + Math.round(x.r.right) + ' w=' + Math.round(x.r.width) + ' ovf=' + x.cs.overflowX);
    });
    let el = document.getElementById('vwLog');
    if (!el) {
      el = document.createElement('div');
      el.id = 'vwLog';
      el.style.cssText = 'position:fixed;left:0;top:0;z-index:999999;font:11px/1.4 ui-monospace,monospace;color:#0f0;background:rgba(0,0,0,.85);padding:6px 8px;white-space:pre-wrap;max-width:100vw';
      document.body.appendChild(el);
    }
    el.textContent = rows.join('\n');
  }

  function drawProbe() {
    let el = document.getElementById('probeLog');
    if (!el) {
      el = document.createElement('div');
      el.id = 'probeLog';
      el.style.cssText = 'position:fixed;left:8px;top:8px;z-index:99999;font:12px/1.45 ui-monospace,monospace;color:#9fe6ff;background:rgba(0,0,0,.82);border:1px solid #2a6;padding:8px 10px;max-width:560px;white-space:pre-wrap';
      document.body.appendChild(el);
    }
    const m = document.getElementById('modal');
    const card = m && m.querySelector('.modal-card, .md, .modal-inner');
    const v = m && m.querySelector('.md-voice');
    const lines = [
      'modal.on=' + (m ? m.classList.contains('on') : '-'),
      'card.op=' + (card ? getComputedStyle(card).opacity : '-'),
      'voice=' + (v ? 'yes' : 'no') + (v ? ' dur=' + (v.querySelector('.mv-head') || {}).textContent : ''),
      v ? 'text=' + v.innerText.replace(/\s+/g, ' ').slice(0, 120) : ''
    ];
    el.textContent = lines.join('\n');
  }

  function drawSeqLog() {
    let el = document.getElementById('seqLog');
    if (!el) {
      el = document.createElement('div');
      el.id = 'seqLog';
      el.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:99999;font:11px/1.4 ui-monospace,monospace;color:#9fe6ff;background:rgba(0,0,0,.78);border:1px solid #2a6;padding:6px 8px;max-width:460px;white-space:pre-wrap';
      document.body.appendChild(el);
    }
    const arr = window.__seq || [];
    el.textContent = '__seq ' + arr.length + '\n' + arr.join('\n');
  }

  async function playResults(results, pool) {
    const token = ++ui.seq;
    ui.skipped = !!ui.fast;
    ui.busy = true;
    const n = results.length;

    const stage = $('#pullStage');
    const cardsEl = $('#psCards');
    const ribbon = $('#psRibbon');
    const sum = $('#psSum');
    const solo = $('#psSolo');

    stage.classList.add('on');
    stage.setAttribute('aria-hidden', 'false');
    stage.classList.toggle('solo-mode', n === 1);
    stage.classList.toggle('weapon-mode', pool.kind === 'weapon');
    stage.classList.toggle('four-mode', n === 1 && results[0] && results[0].rarity === 4);
    cardsEl.className = 'ps-cards ' + (n > 1 ? 'ten' : 'single');
    cardsEl.innerHTML = '';
    sum.innerHTML = '';
    $('#psHint').textContent = '';
    $('#psOk').hidden = true;
    $('#psAgain').hidden = true;
    $('#psSkip').hidden = false;
    $('#psTitle').textContent = n > 1 ? '十连寻访 · 解析中' : '单次寻访 · 解析中';
    $('#psId').textContent = 'SIGNAL // ' + pool.name;
    ribbon.classList.remove('on');
    solo.classList.remove('on', 'reveal', 'out');
    solo.style.opacity = '0';
    solo.style.visibility = 'hidden';
    const soloLineEl = $('#soloLine');
    if (soloLineEl) { soloLineEl.textContent = ''; soloLineEl.classList.remove('on'); }
    const heat = $('#psHeat');
    if (heat) { heat.classList.remove('six', 'flicker'); heat.querySelector('i').style.width = '0%'; }
    $('.ps-beams').classList.remove('on');

    if (FX()) {
      FX().resume();
      FX().setRarity(results.some(r => r.rarity === 6) ? 6 : results[0].rarity);
    }

    if (heat) heat.querySelector('i').style.width = '18%';
    if (pool.kind === 'weapon') await armoryIntro(pool);
    else await decodeIntro(pool, n, results);
    if (heat) heat.querySelector('i').style.width = '46%';

    if (pool.kind === 'weapon') {
      cardsEl.className = 'ps-cards weapon';
      cardsEl.innerHTML = results.map((r, i) => markupWTile(r, pool, i)).join('');
      decorateStars(cardsEl);
      fitCards();
      const tiles = $$('#psCards .wtile');
      tiles.forEach((el, i) => setTimeout(() => {
        el.classList.add('in');
        Sfx.flip();
        if (el.classList.contains('r6')) { Sfx.six(); el.classList.add('hot'); if (window.FX) FX().burst(0.7); }
      }, ui.skipped ? 0 : i * 55));
      await sleep(ui.skipped ? 60 : 700);
      const w6 = results.find(r => r.rarity === 6);
      if (w6) {
        $('#psRibbonName').textContent = w6.name;
        $('#psRibbonTag').textContent = w6.up ? 'RATE UP' : 'SIX STAR';
        ribbon.classList.add('on');
        $('.ps-flash').classList.add('fire');
        setTimeout(() => $('.ps-flash').classList.remove('fire'), 600);
        A.playVoice('weapon_' + w6.id); // 无官方音频时静默
      }
      if (heat) { heat.querySelector('i').style.width = '100%'; if (w6) heat.classList.add('six', 'flicker'); }
      $('#psTitle').textContent = w6 ? '六星武器确认' : '武库申领完成';
      $('#psSkip').hidden = true;
      $('#psOk').hidden = false; revealAgain(pool, n);
      $('#psHint').textContent = '点击「确认」收取本次申领结果';
      Sfx.confirm();
      ui.busy = false;
      return;
    }

    const sixes = results.filter(r => r.rarity === 6);
    const six = sixes[0] || null;
    if (sixes.length) {
      for (let k = 0; k < sixes.length; k++) {
        const rec = sixes[k];
        const kick = n === 1
          ? soloKick(rec)
          : (sixes.length > 1
            ? 'SIGNAL OVERRIDE · 十连寻访 ' + (k + 1) + ' / ' + sixes.length
            : 'SIGNAL OVERRIDE · 十连寻访');
        if (heat) heat.querySelector('i').style.width = (52 + 38 * ((k + 1) / sixes.length)) + '%';
        (window.__seq = window.__seq || []).push(kick + ' :: ' + rec.name);
        if (ui.debugSeq) drawSeqLog();
        await showSolo(rec, pool, kick);
        if (n === 1) {
          if (heat) { heat.querySelector('i').style.width = '100%'; heat.classList.add('six', 'flicker'); }
          // single pull stays on the showcase
          $('#psTitle').textContent = '六星信号确认';
          $('#psSkip').hidden = true;
          $('#psOk').hidden = false; revealAgain(pool, n);
          $('#psHint').textContent = '点击「确认」收取，或 7 秒后自动收起';
          Sfx.confirm();
          ui.busy = false;
          await holdSolo(7000);
          if ($('#pullStage').classList.contains('on')) closeStage();
          return;
        }
        await holdSolo(7000);
        await hideSolo();
        await sleep(ui.skipped ? 0 : (k < sixes.length - 1 ? 300 : 200));
      }
    }

    if (n > 1) {
      cardsEl.innerHTML = results.map((r, i) => markupStrip(r, pool, i)).join('');
      decorateStars(cardsEl);
      fitCards();
      const strips = $$('#psCards .pstrip');
      strips.forEach((el, i) => {
        const fromTop = i % 2 === 0;
        el.style.animationDelay = (ui.skipped ? 0 : i * 46) + 'ms';
        el.classList.add(fromTop ? 'enter-top' : 'enter-bottom');
      });
      if (!ui.skipped) Sfx.deal(0.95);
      await sleep(ui.skipped ? 40 : 420 + strips.length * 46 + 240);

      if (heat) heat.querySelector('i').style.width = '72%';
      strips.forEach((el, i) => {
        setTimeout(() => {
          el.classList.add('reveal');
          Sfx.flip();
          setTimeout(() => el.classList.add('name-in'), 120);
          if (el.classList.contains('r6')) {
            el.classList.add('sweep');
            Sfx.six();
            if (FX()) FX().burst(0.8);
          }
        }, ui.skipped ? 0 : i * 48);
      });
      await sleep(ui.skipped ? 60 : 700);

      if (six) {
        $('#psRibbonName').textContent = six.name;
        $('#psRibbonTag').textContent = six.up ? 'RATE UP' : (six.fresh ? 'NEW OPERATOR' : 'POTENTIAL +1');
        ribbon.classList.add('on');
        $('.ps-beams').classList.add('on');
        $('.ps-flash').classList.add('fire');
        setTimeout(() => $('.ps-flash').classList.remove('fire'), 600);
        if (FX()) { FX().setRarity(6); FX().burst(1); }
        await sleep(ui.skipped ? 40 : 420);
      }
    } else {
      // non-6★ single pull showcase
      const rec = results[0];
      await showSolo(rec, pool, soloKick(rec));
      $('#psTitle').textContent = rec.rarity >= 5 ? '寻访完成' : '寻访信号解析完成';
      $('#psSkip').hidden = true;
      $('#psOk').hidden = false; revealAgain(pool, n);
      $('#psHint').textContent = '点击「确认」收取，或 7 秒后自动收起';
      Sfx.confirm();
      ui.busy = false;
      await holdSolo(7000);
      if ($('#pullStage').classList.contains('on')) closeStage();
      return;
    }

    const count = r => results.filter(x => x.rarity === r).length;
    const ups = results.filter(x => x.up).length;
    const pots = results.filter(x => !x.fresh && x.potAfter > x.potBefore);
    sum.innerHTML = [
      count(6) ? `<span class="s6">6★ ×${count(6)}</span>` : '',
      count(5) ? `<span class="s5">5★ ×${count(5)}</span>` : '',
      count(4) ? `<span class="s4">4★ ×${count(4)}</span>` : '',
      ups ? `<span class="s6">概率提升 ×${ups}</span>` : '',
      pots.length ? `<span class="s6">潜能提升 ×${pots.length}</span>` : ''
    ].filter(Boolean).join('');
    decorateStars(sum);
    decorateStars(ribbon);

    if (heat) {
      heat.querySelector('i').style.width = '100%';
      if (six) heat.classList.add('six', 'flicker');
    }
    $('#psTitle').textContent = six ? '六星确认 · 十连结果' : '寻访完成';
    $('#psSkip').hidden = true;
    $('#psOk').hidden = false; revealAgain(pool, n);
    $('#psHint').textContent = '点击「确认」收取本次寻访结果';
    Sfx.confirm();
    ui.busy = false;
  }

  function closeStage() {
    const stage = $('#pullStage');
    stage.classList.remove('on');
    stage.setAttribute('aria-hidden', 'true');
    ui.seq++;
    A.stopSpeak();
    if (window.FX) { try { window.FX.pause(); } catch (e) {} }
  }

  async function doPull(kind) {
    if (ui.busy) return;
    const p = ui.pool;
    const ps = G.poolState(p.id);
    let res;

    // 加急十连：本池达到阈值后，下一次寻访自动替换为免费十连
    if (G.freeReady(p) && kind !== 'free') kind = 'free';

    if (kind === 'free') {
      if (!G.freeReady(p)) return;
      if (!G.consumeFree(p)) return;
      res = G.pull(p, 10, { free: true, kind: 'ten' });
    } else {
      if (p.maxPulls && ps.pulls >= p.maxPulls) { toast('本卡池寻访次数已达上限'); Sfx.error(); return; }
      const n = kind === 'single' ? 1 : 10;
      res = G.pull(p, n, { kind });
    }
    if (res.error) {
      Sfx.error();
      toast(res.error + ' — 可在「补给」中获取');
      openSupply();
      return;
    }
    ui.last = res.results;
    renderBanner(); renderProgress(); renderPoolList(); renderWallet();
    if (ui.tab === 'result') renderResult();
    if (ui.tab === 'stats') renderStats();

    await playResults(res.results, p);

    const got6 = res.results.filter(r => r.rarity === 6);
    if (got6.length) toast(`<b style="color:var(--six)">六星 ${got6.length}</b> · ${got6.map(r => esc(r.name)).join('、')}`, 3200);
    const pots = res.results.filter(r => !r.fresh && r.potAfter > r.potBefore);
    if (pots.length) {
      const uniq = [...new Set(pots.map(r => r.id))];
      toast(uniq.map(id => {
        const r = pots.find(x => x.id === id);
        return `${esc(r.name)} 潜能 ${r.potBefore} → ${r.potAfter}`;
      }).join(' · '), 2800);
    }
  }

  /* --------------------------------------------------------------- panels */
  async function doBurst(times) {
    if (ui.busy) return;
    const p = ui.pool;
    const ps = G.poolState(p.id);
    const prevFast = ui.fast;
    ui.fast = true;
    ui.busy = true;
    let all = [];
    for (let k = 0; k < times; k++) {
      if (p.maxPulls && ps.pulls >= p.maxPulls) break;
      if (G.freeReady(p)) { G.consumeFree(p); G.pull(p, 10, { free: true, kind: 'ten' }); continue; }
      const money = p.kind === 'weapon' ? G.state.quota : G.state.dia;
      if (money < p.cost.ten) break;
      const r = G.pull(p, 10, { kind: 'ten' });
      if (r.error) break;
      all = all.concat(r.results);
    }
    ui.fast = prevFast;
    ui.busy = false;
    if (all.length) {
      ui.last = all.slice(-10);
      renderBanner(); renderProgress(); renderPoolList(); renderWallet();
      if (ui.tab === 'result') renderResult();
      if (ui.tab === 'stats') renderStats();
      if (ui.tab === 'codex') renderCodex();
      const six = all.filter(r => r.rarity === 6);
      toast('连续寻访完成 · ' + all.length + ' 抽 · 六星 ' + six.length +
        (six.length ? '（' + six.map(x => esc(x.name)).join('、') + '）' : ''), 3600);
      Sfx.confirm();
    } else {
      Sfx.error(); toast('资源不足或已达上限');
    }
  }

  function renderWallet() {
    rollTo($('#walDia'), G.state.dia);
    rollTo($('#walQuota'), G.state.quota);
  }

  function renderResult() {
    const box = $('#panel-result');
    if (!ui.last.length) {
      box.innerHTML = `<div class="empty"><b>NO SIGNAL</b>尚未进行寻访 — 点击右侧「十连寻访」开始接通信号。</div>`;
      return;
    }
    const p = G.poolById(ui.last[0].pool);
    const six = ui.last.filter(r => r.rarity === 6).length;
    const five = ui.last.filter(r => r.rarity === 5).length;
    box.innerHTML = `
      <div class="res-head">
        <h3>本次寻访 / LAST RESULT</h3>
        <div class="meta">${esc(p ? p.name : '')} · ${ui.last.length} 抽 · 六星 ${six} · 五星 ${five}</div>
      </div>
      <div class="res-grid">${ui.last.map(r => {
        const info = itemInfo(p, r.id);
        const src = p.kind === 'weapon' ? info.icon : (info.portrait || info.icon);
        return `<div class="rcard r${r.rarity}" data-op="${r.id}">
          <img src="${src}" alt="${esc(r.name)}" loading="lazy">
          <div class="rc-grad"></div>
          <div class="rc-rar">${r.rarity}★</div>
          ${r.fresh ? '<div class="rc-new">NEW</div>' : `<div class="rc-new" style="background:transparent;color:var(--acc);border:1px solid color-mix(in srgb,var(--acc) 45%,transparent)">潜能 ↑</div>`}
          <div class="rc-pot">${r.pot >= 6 ? '满潜' : '潜 ' + r.pot}</div>
          <div class="rc-info"><b>${esc(r.name)}</b><small>${r.up ? 'RATE UP' : (p.kind === 'weapon' ? 'WEAPON' : (info.profession || ''))}</small></div>
        </div>`;
      }).join('')}</div>`;
    box.querySelectorAll('.rcard').forEach(c => c.addEventListener('click', () => {
      Sfx.click();
      if (p.kind === 'weapon') openWeapon(c.dataset.op);
      else openOp(c.dataset.op);
    }));
  }

  function renderStats() {
    const o = G.overall();
    const box = $('#panel-stats');
    if (!o.total) {
      box.innerHTML = `<div class="empty"><b>NO DATA</b>完成一次寻访后，这里会显示概率实测、出金分布与消费统计。</div>`;
      return;
    }
    const hist = G.histogram(10);
    const max = Math.max(1, ...hist);
    box.innerHTML = `
      <div class="stat-grid">
        <div class="stat"><b>${fmt(o.total)}</b><span>累计寻访 · PULLS</span><em>${fmt(o.spent)} 嵌晶玉</em></div>
        <div class="stat gold"><b>${fmt(o.r6)}</b><span>六星总数 · 6★</span><em>实测 ${(o.rate6 * 100).toFixed(3)}%</em></div>
        <div class="stat"><b>${o.avgPity ? o.avgPity.toFixed(1) : '—'}</b><span>平均出金 · AVG PITY</span><em>理论期望 62.3 抽</em></div>
        <div class="stat"><b>${fmt(o.r5)}</b><span>五星总数 · 5★</span><em>实测 ${(o.rate5 * 100).toFixed(2)}%</em></div>
        <div class="stat"><b>${fmt(o.up)}</b><span>UP 获取 · RATE UP</span><em>跨池累计</em></div>
        <div class="stat"><b>${o.owned}<i style="font-size:12px;font-style:normal;color:var(--dim-2)">/${Object.keys(G.OPS).length}</i></b><span>图鉴收集 · ARCHIVE</span><em>存档：本地浏览器</em></div>
      </div>

      <div class="chart-wrap">
        <div class="chart-head"><h4>出金位置分布 / PITY DISTRIBUTION</h4><span>横轴：距上次六星的抽数</span></div>
        <div class="hist">${hist.map((v, i) => `<i style="height:${Math.max(2, (v / max) * 100)}%" title="${i * 10 + 1}-${(i + 1) * 10} 抽：${v} 次"></i>`).join('')}</div>
        <div style="display:flex;justify-content:space-between;margin-top:6px;font:400 8px/1 var(--f-mono);color:var(--dim-2);letter-spacing:.1em">
          ${hist.map((_, i) => `<span>${i * 10 + 1}</span>`).join('')}<span>80</span>
        </div>
      </div>

      <div class="chart-wrap">
        <div class="chart-head"><h4>六星获取序列 / SIX-STAR TIMELINE</h4><span>最近 ${Math.min(80, o.pity.length)} 次</span></div>
        <canvas id="pityCanvas" height="150"></canvas>
      </div>

      <div class="chart-wrap">
        <div class="chart-head"><h4>最近记录 / RECENT</h4><span>${G.state.hist.length} 条</span></div>
        <table class="log-table">
          <thead><tr><th>#</th><th>名称</th><th>卡池</th><th>稀有度</th><th>保底</th></tr></thead>
          <tbody>${G.state.hist.slice(0, 12).map((r, i) => `<tr>
            <td class="num">${i + 1}</td>
            <td>${esc(r.name)}</td>
            <td style="color:var(--dim-2)">${esc(r.poolName)}</td>
            <td class="rar r${r.rarity}">${r.rarity}★</td>
            <td class="num">${r.pity || '—'}</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>`;
    drawPity(o.pity);
  }

  function drawPity(list) {
    const cv = $('#pityCanvas'); if (!cv) return;
    const dpr = window.devicePixelRatio || 1;
    const w = cv.clientWidth || 600, h = 150;
    cv.width = w * dpr; cv.height = h * dpr;
    const c = cv.getContext('2d');
    c.scale(dpr, dpr);
    c.clearRect(0, 0, w, h);
    const pad = 18;
    const data = list.slice(-80);
    const maxY = 80;
    c.strokeStyle = 'rgba(255,255,255,.06)'; c.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const y = pad + (h - pad * 2) * (i / 4);
      c.beginPath(); c.moveTo(pad, y); c.lineTo(w - pad, y); c.stroke();
    }
    if (!data.length) return;
    const xOf = i => pad + (w - pad * 2) * (i / Math.max(1, data.length - 1));
    const yOf = v => h - pad - (h - pad * 2) * (Math.min(v, maxY) / maxY);
    const grad = c.createLinearGradient(0, pad, 0, h - pad);
    grad.addColorStop(0, 'rgba(255,194,75,.28)');
    grad.addColorStop(1, 'rgba(255,194,75,0)');
    c.beginPath();
    data.forEach((v, i) => { const x = xOf(i), y = yOf(v); i ? c.lineTo(x, y) : c.moveTo(x, y); });
    c.lineTo(xOf(data.length - 1), h - pad); c.lineTo(xOf(0), h - pad); c.closePath();
    c.fillStyle = grad; c.fill();
    c.beginPath();
    data.forEach((v, i) => { const x = xOf(i), y = yOf(v); i ? c.lineTo(x, y) : c.moveTo(x, y); });
    c.strokeStyle = '#ffc24b'; c.lineWidth = 1.4; c.stroke();
    data.forEach((v, i) => {
      const x = xOf(i), y = yOf(v);
      c.beginPath(); c.arc(x, y, v >= 79 ? 3 : 2, 0, Math.PI * 2);
      c.fillStyle = v >= 79 ? '#fff' : '#ffc24b'; c.fill();
    });
    c.fillStyle = 'rgba(255,255,255,.28)';
    c.font = '9px monospace';
    c.fillText('80', 2, pad + 4);
    c.fillText('1', 6, h - pad + 2);
  }

  function potOf(id) {
    if (id === 'chr_0002_endminm' || id === 'chr_0003_endminf') return 4;
    const b = G.state.bag[id];
    return b ? Math.min(5, b.pot) : 0;
  }

  function renderCodex() {
    const ops = Object.values(G.OPS).sort((a, b) => b.rarity - a.rarity || a.name.localeCompare(b.name, 'zh'));
    const f = ui.codexFilter;
    const list = ops.filter(o => {
      const bag = G.state.bag[o.id];
      if (f === 'all') return true;
      if (f === 'own') return !!bag;
      if (f === 'miss') return !bag;
      return String(o.rarity) === f;
    });
    const owned = ops.filter(o => G.state.bag[o.id]).length;
    $('#panel-codex').innerHTML = `
      <div class="codex-bar">
        ${[['all', '全部'], ['6', '六星'], ['5', '五星'], ['4', '四星'], ['own', '已获得'], ['miss', '未获得']]
        .map(([k, l]) => `<button class="chip ${f === k ? 'on' : ''}" data-f="${k}">${l}</button>`).join('')}
        <span class="codex-sum">COLLECTION ${owned} / ${ops.length} · 潜能总览</span>
      </div>
      <div class="codex-grid">${list.map(o => {
        const bag = G.state.bag[o.id];
        const pot = potOf(o.id);
        return `<div class="cx r${o.rarity} ${bag ? 'own' : ''}" data-op="${o.id}">
          <img src="${o.portrait || o.icon}" alt="${esc(o.name)}" loading="lazy">
          <div class="cx-g"></div>
          <div class="cx-r">${o.rarity}★</div>
          <div class="cx-pot">${[1, 2, 3, 4, 5, 6].map(i => `<i class="${i <= pot ? 'on' : ''}"></i>`).join('')}</div>
          ${bag ? '' : '<div class="cx-lock">UNKNOWN</div>'}
          <div class="cx-i"><b>${esc(o.name)}</b><small>${esc(o.profession)}${bag ? ' · 潜 ' + pot : ''}</small></div>
        </div>`;
      }).join('')}</div>`;
    $$('#panel-codex .chip').forEach(b => b.addEventListener('click', () => {
      ui.codexFilter = b.dataset.f; Sfx.click(); renderCodex();
    }));
    $$('#panel-codex .cx').forEach(c => c.addEventListener('click', () => { Sfx.click(); openOp(c.dataset.op); }));
  }

  function renderRules() {
    const p = ui.pool; if (!p) return;
    const six = (p.rates.r6 * 100).toFixed(2);
    const rules = p.rules || [];
    $('#panel-rules').innerHTML = `
      <div class="rules-nav">
        <span class="chip on">${esc(p.name)}</span>
        <span class="chip">${esc(p.typeLabel)}</span>
        <a class="chip" href="https://www.fz.wiki/wiki/%E5%AF%BB%E8%AE%BF" target="_blank" rel="noreferrer">fz.wiki 原始规则 ↗</a>
      </div>
      <div class="chart-wrap" style="margin-bottom:12px">
        <div class="chart-head"><h4>概率一览 / DROP RATES</h4><span>本模拟器实时生效</span></div>
        <table class="rate-table">
          <thead><tr><th>品质</th><th>基础概率</th><th>保底</th><th>说明</th></tr></thead>
          <tbody>
            <tr><td style="color:var(--six)">6★</td><td class="num">${six}%</td><td class="num">${p.pity.soft} 抽</td><td>连续 ${p.pity.start - 1} 抽未出后每抽 +${(p.pity.step * 100).toFixed(0)}%</td></tr>
            <tr><td style="color:var(--five)">5★</td><td class="num">${(p.rates.r5 * 100).toFixed(2)}%</td><td class="num">${p.pity.five} 抽</td><td>每 10 抽必定获得 5★ 或以上</td></tr>
            <tr><td style="color:var(--four)">4★</td><td class="num">${(p.rates.r4 * 100).toFixed(1)}%</td><td class="num">—</td><td>其余情况</td></tr>
            ${p.pity.hard ? `<tr><td style="color:var(--acc)">UP</td><td class="num">${p.fifty ? '50% of 6★' : 'weighted'}</td><td class="num">${p.pity.hard} 抽</td><td>本池累计 ${p.pity.hard} 抽必定获得概率提升对象</td></tr>` : ''}
          </tbody>
        </table>
      </div>
      ${rules.map((r, i) => `
        <details class="rule-block" ${i === 1 ? 'open' : ''}>
          <summary>${esc(r.title)}</summary>
          <div class="rule-body">${(r.blocks || []).map(b => b.type === 'h2' ? `<h2>${esc(b.text)}</h2>` : `<p>${esc(b.text)}</p>`).join('')}</div>
        </details>`).join('')}
      <div class="rule-body" style="border:1px solid var(--line);margin-top:10px">
        <p style="color:var(--dim-2)">本页面为同人模拟器：卡池、概率、保底参数与立绘取自终末地 Wiki（fz.wiki）；音效与背景氛围音由本地合成；六星干员语音为 Wiki 收录的官方中文配音，未收录者保持静默，不做合成配音。干员与美术版权归上海鹰角网络科技有限公司所有，仅作学习与娱乐用途。</p>
      </div>`;
  }

  /* ---------------------------------------------------------------- modal */
  function openModal(html) {
    $('#modalBody').innerHTML = html;
    $('#modal').classList.add('on');
    $('#modal').setAttribute('aria-hidden', 'false');
    $('#modalBody').scrollTop = 0;
  }
  function closeModal() {
    $('#modal').classList.remove('on');
    $('#modal').setAttribute('aria-hidden', 'true');
    A.stopSpeak();
  }

  function openOp(id) {
    const o = G.OPS[id]; if (!o) return;
    const bag = G.state.bag[id];
    const pot = potOf(id);
    const pulls = G.state.hist.filter(h => h.id === id);
    const quote = quoteOf(o);
    const cards = (o.potentials || []);
    const vr = (window.VOICES || {})[id] || null;

    openModal(`
      <div class="md-op">
        <div class="md-art">
          <div class="halo"></div>
          <img src="${o.portrait || o.icon}" alt="${esc(o.name)}">
        </div>
        <div>
          <div class="md-name">${esc(o.name)}</div>
          <div class="md-en">${esc(o.nameEn)}</div>
          <div class="md-tags">
            <span class="md-tag" style="color:var(--six);border-color:var(--six)">${o.rarity}★</span>
            <span class="md-tag">${esc(o.profession)}</span>
            ${o.element ? `<span class="md-tag" style="color:${esc(o.elementColor)}">${esc(o.element)}</span>` : ''}
            ${(o.tags || []).map(t => `<span class="md-tag">${esc(t)}</span>`).join('')}
          </div>
          <dl class="md-kv">
            <dt>阵营</dt><dd>${esc(o.faction || '—')}</dd>
            <dt>种族</dt><dd>${esc(o.race || '—')}</dd>
            <dt>生日</dt><dd>${esc(o.birth || '—')}</dd>
            <dt>武器</dt><dd>${esc(o.weapon || '—')}</dd>
            <dt>CV</dt><dd>${esc(o.cv || '—')}</dd>
            <dt>持有</dt><dd>${bag ? '×' + bag.n : '未获得'}</dd>
            <dt>记录</dt><dd>${pulls.length} 次</dd>
          </dl>

          ${vr ? `<div class="md-voice">
            <div class="mv-head"><b>语音</b><span>${esc(vr.scene || '台词')} · ${vr.dur}s</span></div>
            <div class="mv-line">「${esc(vr.text)}」</div>
            <div style="display:flex;gap:8px;align-items:center">
              <button class="chip" data-voice-id="${esc(o.id)}">▶ 播放</button>
              <span style="font:400 9px/1 var(--f-mono);color:var(--dim-2);letter-spacing:.1em">官方配音 · 来自终末地 Wiki</span>
            </div>
          </div>` : `<div style="display:flex;gap:8px;align-items:center">
            <span class="chip chip-off" style="opacity:.45;cursor:default">该干员暂无收录语音</span>
            <span style="font:400 9px/1 var(--f-mono);color:var(--dim-2);letter-spacing:.1em">暂无官方语音 · 本地合成</span>
          </div>`}

          <div class="pot-wrap">
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

          <div class="md-bio">${esc(o.bio || '暂无档案资料。')}</div>
        </div>
      </div>`);

    const vbtn = $('#modalBody [data-voice]');
    if (vbtn) vbtn.addEventListener('click', () => {
      Sfx.potential();
      A.playVoice(vbtn.dataset.voice);
      toast('语音试听 · 浏览器本地合成', 1800);
    });
    const rbtn = $('#modalBody [data-voice-id]');
    if (rbtn) rbtn.addEventListener('click', () => {
      Sfx.potential();
      const ok = A.playVoice(rbtn.dataset.voiceId);
      toast(ok ? '语音 · 官方配音' : '语音加载失败', 1600);
    });
  }

  function openWeapon(id) {
    const w = G.WEAPONS[id]; if (!w) return;
    const bag = G.state.bag[id];
    openModal(`
      <div class="md-op">
        <div class="md-art"><div class="halo"></div><img src="${w.icon}" alt="${esc(w.name)}" style="object-fit:contain;padding:18%"></div>
        <div>
          <div class="md-name">${esc(w.name)}</div>
          <div class="md-en">${esc(w.nameEn || 'WEAPON')}</div>
          <div class="md-tags"><span class="md-tag" style="color:var(--six);border-color:var(--six)">${w.rarity}★</span><span class="md-tag">武库申领</span></div>
          <dl class="md-kv"><dt>持有</dt><dd>${bag ? '×' + bag.n : '未获得'}</dd><dt>稀有度</dt><dd>${w.rarity}★</dd></dl>
          <div class="md-bio">武器数据来自终末地 Wiki，详情请查阅对应武器条目。</div>
        </div>
      </div>`);
  }

  function openLog() {
    const rows = G.state.hist.slice(0, 300);
    openModal(`
      <h3 style="font-size:14px;letter-spacing:.16em;margin-bottom:14px">寻访记录 / HISTORY <span style="color:var(--dim-2);font:400 9px/1 var(--f-mono)">${G.state.hist.length} 条</span></h3>
      <div class="log-rows">
        ${rows.length ? rows.map((r, i) => `<div class="log-row r${r.rarity}">
          <span class="lr-i">${String(i + 1).padStart(3, '0')}</span>
          <span class="lr-n">${esc(r.name)}</span>
          <span class="lr-p">${esc(r.poolName)}</span>
          <span class="lr-r">${r.rarity}★</span>
        </div>`).join('') : '<div class="empty">暂无记录</div>'}
      </div>`);
  }

  function openSupply() {
    const on = G.state.cfg;
    openModal(`
      <h3 style="font-size:14px;letter-spacing:.16em;margin-bottom:6px">补给与设置 / SUPPLY</h3>
      <p style="font-size:11px;color:var(--dim-2);margin-bottom:14px">模拟器不涉及任何真实消费，资源可自由补充。</p>
      <div class="sup-grid">
        <div class="sup-card"><b>嵌晶玉 ×30,000</b><span>500/抽 · 十连 5,000</span><button data-act="dia">补充</button></div>
        <div class="sup-card"><b>武库配额 ×20,000</b><span>武库申领 1,980/十连</span><button data-act="quota">补充</button></div>
        <div class="sup-card"><b>音效 ${on.sfx ? '开启' : '关闭'}</b><span>本地合成音 · 点击切换</span><button data-act="sfx">切换</button></div>
        <div class="sup-card"><b>背景氛围音 ${on.bgm ? '开启' : '关闭'}</b><span>24 秒循环 · 音量 24%</span><button data-act="bgm">切换</button></div>
        <div class="sup-card"><b>语音 ${A.voiceOn ? '开启' : '关闭'}</b><span>六星官方中文配音</span><button data-act="voice">切换</button></div>
        <div class="sup-card danger"><b>清空存档</b><span>删除全部进度与记录</span><button data-act="reset">重置</button></div>
      </div>`);
    $$('#modalBody .sup-card button').forEach(b => b.addEventListener('click', () => {
      const a = b.dataset.act;
      if (a === 'dia') { G.grant(30000, 0); Sfx.confirm(); toast('嵌晶玉 +30,000'); }
      if (a === 'quota') { G.grant(0, 20000); Sfx.confirm(); toast('武库配额 +20,000'); }
      if (a === 'sfx') { G.saveCfg({ sfx: !G.state.cfg.sfx }); syncSound(); Sfx.click(); openSupply(); }
      if (a === 'bgm') { G.saveCfg({ bgm: !G.state.cfg.bgm }); A.setBgm(G.state.cfg.bgm); Sfx.click(); openSupply(); }
      if (a === 'voice') { A.voiceOn = !A.voiceOn; G.saveCfg({ voice: A.voiceOn }); Sfx.click(); openSupply(); }
      if (a === 'reset') {
        if (confirm('确定清空全部寻访记录与持有干员？')) {
          G.reset(); ui.last = []; closeModal(); syncAll();
          toast('存档已重置');
        }
        return;
      }
      renderWallet(); renderBanner(); renderProgress(); renderPoolList();
      if (ui.tab === 'stats') renderStats();
      if (ui.tab === 'codex') renderCodex();
    }));
  }

  function syncSound() {
    const on = G.state.cfg.sfx !== false;
    A.on = on;
    $('#soundTxt').textContent = '音效 ' + (on ? '开' : '关');
    $('#btnSound').classList.toggle('on', on);
  }

  /* ------------------------------------------------------------- tabs etc */
  function bindTabs() {
    $$('#tabs .tab').forEach(t => t.addEventListener('click', () => {
      Sfx.click();
      $$('#tabs .tab').forEach(x => x.classList.toggle('active', x === t));
      $$('.panel').forEach(p => p.classList.toggle('active', p.id === 'panel-' + t.dataset.tab));
      ui.tab = t.dataset.tab;
      if (ui.tab === 'result') renderResult();
      if (ui.tab === 'stats') renderStats();
      if (ui.tab === 'codex') renderCodex();
      if (ui.tab === 'rules') renderRules();
    }));
  }

  /* --------------------------------------------------- rarity star glyph */
  const RAR_TXT = /^(\d)\u2605$/;
  function decorateStars(root) {
    if (!root) return;
    const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
    const jobs = [];
    let n;
    while ((n = walk.nextNode())) {
      if (n.nodeValue.indexOf('\u2605') >= 0 && /\d\u2605/.test(n.nodeValue)) jobs.push(n);
    }
    for (const t of jobs) {
      const parts = t.nodeValue.split(/(\d\u2605)/);
      const frag = document.createDocumentFragment();
      let touched = false;
      for (const p2 of parts) {
        const m = p2.match(RAR_TXT);
        if (m) {
          const sp = document.createElement('span');
          sp.className = 'rar-star r' + m[1];
          sp.innerHTML = '<i class="star-ico"></i>' + m[1];
          frag.appendChild(sp);
          touched = true;
        } else if (p2) {
          frag.appendChild(document.createTextNode(p2));
        }
      }
      if (touched && t.parentNode) t.parentNode.replaceChild(frag, t);
    }
  }

  function syncAll() {
    renderWallet();
    renderRail();
    renderPoolList();
    if (ui.pool) { renderBanner(); renderProgress(); }
    renderRules();
    if (ui.tab === 'result') renderResult();
    if (ui.tab === 'stats') renderStats();
    if (ui.tab === 'codex') renderCodex();
    syncSound();
    decorateStars(document.body);
  }

  /* ------------------------------------------------------------- parallax */
  function bindParallax() {
    const banner = $('#banner');
    if (!banner) return;
    banner.addEventListener('pointermove', e => {
      const r = banner.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      banner.style.setProperty('--px', x.toFixed(3));
      banner.style.setProperty('--py', y.toFixed(3));
    });
    banner.addEventListener('pointerleave', () => {
      banner.style.setProperty('--px', 0);
      banner.style.setProperty('--py', 0);
    });
  }

  /* ----------------------------------------------------------------- init */
  function init() {
    G.load();
    A.on = G.state.cfg.sfx !== false;
    A.voiceOn = G.state.cfg.voice !== false;
    A.bgmOn = G.state.cfg.bgm !== false;
    A.init();

    const first = G.poolsOf('Special')[0] || G.getAllPools()[0];
    ui.pool = first;
    ui.type = first.type;

    const qs = new URLSearchParams(location.search);
    ui.qs = qs;
    if (qs.get('mute') === '1') { A.on = false; A.voiceOn = false; A.bgmOn = false; }
    if (qs.get('lite') === '1') document.body.classList.add('lite');
    if (qs.get('static') === '1' || qs.get('still') === '1') {
      const st = document.createElement('style');
      const kill = qs.get('still') === '1';
      st.textContent = '*,*::before,*::after{animation-duration:.001s!important;animation-delay:0s!important;transition:none!important}'
        + (kill ? '*,*::before,*::after{animation:none!important}' : '')
        + '.ps-solo .solo-art img{clip-path:inset(0)!important;transform:none!important;filter:none!important}'
        + '.solo-name,.solo-kicker,.solo-stars,.solo-prof,.solo-tags,.solo-data,.pstrip .ps-meta,.ps-new{opacity:1!important;transform:none!important}';
      document.head.appendChild(st);
    }

    window.addEventListener('error', e => {
      document.body.setAttribute('data-err', (e.message || '') + ' @' + (e.lineno || ''));
    });

    bindTabs();
    if (qs.get('lucky') === '1') { const rnd = Math.random; Math.random = () => rnd() * 0.002; }
    if (qs.get('op')) setTimeout(() => openOp(qs.get('op')), 700);
    // 深链：index.html?op=<干员 id> 直接打开详情
    if (qs.get('op') && G.OPS[qs.get('op')]) setTimeout(() => openOp(qs.get('op')), 260);
    if (qs.get('dia')) G.state.dia = +qs.get('dia');
    if (qs.get('quota')) G.state.quota = +qs.get('quota');
    if (qs.get('probe')) setTimeout(drawProbe, 1500);
    if (qs.get('sim')) {
      const n = clamp(parseInt(qs.get('sim'), 10) || 1, 1, 300);
      for (let i = 0; i < n; i++) G.pull(ui.pool, 10, { kind: 'ten' });
    }
    syncAll();
    bindParallax();

    if (window.FX) {
      try {
        window.FX.mount($('#fxCanvas'), { density: 1, tone: accentOf(ui.pool) });
        window.FX.pause();
      } catch (e) {}
    }

    $('#btnTen').addEventListener('click', () => doPull('ten'));
    $('#btnSingle').addEventListener('click', () => doPull('single'));
    $('#btnFree').addEventListener('click', () => doPull('free'));
    $('#btnBurst').addEventListener('click', () => doBurst(10));
    $('#btnLog').addEventListener('click', () => { Sfx.click(); openLog(); });
    $('#btnSupply').addEventListener('click', () => { Sfx.click(); openSupply(); });
    $('#btnSound').addEventListener('click', () => {
      G.saveCfg({ sfx: !G.state.cfg.sfx }); syncSound(); Sfx.click();
    });
    $('#btnRulesTop').addEventListener('click', () => {
      const t = $$('#tabs .tab').find(x => x.dataset.tab === 'rules');
      if (t) t.click();
      document.querySelector('.lower').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    $('#psSkip').addEventListener('click', e => { e.stopPropagation(); ui.skipped = true; });
    $('#psOk').addEventListener('click', e => { e.stopPropagation(); closeStage(); });
    $('#psAgain').addEventListener('click', async e => {
      e.stopPropagation();
      if (ui.busy) return;
      const p = ui.pool;
      if (!G.freeReady(p) && (p.maxPulls && G.poolState(p.id).pulls >= p.maxPulls)) {
        toast('本卡池寻访次数已达上限'); Sfx.error(); return;
      }
      const nextKind = ui.againKind || 'ten';
      closeStage();
      await sleep(60);
      doPull(nextKind);
    });
    $('#pullStage').addEventListener('click', e => {
      if (e.target.closest('.ps-head') || e.target.closest('.ps-ok')) return;
      if (!$('#psOk').hidden) closeStage();
      else ui.skipped = true;
    });
    $('#modalX').addEventListener('click', closeModal);
    $('.modal-scrim').addEventListener('click', closeModal);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        if ($('#modal').classList.contains('on')) return closeModal();
        if ($('#pullStage').classList.contains('on')) {
          if (!$('#psOk').hidden) closeStage(); else ui.skipped = true;
        }
        return;
      }
      if ($('#modal').classList.contains('on')) return;
      if ($('#pullStage').classList.contains('on')) {
        if (e.code === 'Space') { e.preventDefault(); if (!$('#psOk').hidden) closeStage(); }
        return;
      }
      if (e.target.tagName === 'INPUT') return;
      if (e.code === 'Space') { e.preventDefault(); doPull('ten'); }
      if (e.key === 's' || e.key === 'S') doPull('single');
    });

    window.addEventListener('resize', () => { if (ui.tab === 'stats') drawPity(G.overall().pity); });

    // QA hooks (only when explicitly requested via URL)
    ui.fast = qs.get('fast') === '1';
    ui.noType = qs.get('notype') === '1';
    ui.debugSeq = qs.get('seq') === '1';
    if (qs.get('vw') === '1') setTimeout(drawVwLog, 1200);
    if (qs.get('tab')) {
      const t = $$('#tabs .tab').find(x => x.dataset.tab === qs.get('tab'));
      if (t) setTimeout(() => t.click(), 400);
    }
    if (qs.get('pool')) {
      const target = G.poolById(qs.get('pool'));
      if (target) { selectPool(target.id); syncAll(); }
    }
    ui.holdIntro = qs.get('hold') || null;
    if (ui.holdIntro) {
      const h = ui.holdIntro;
      setTimeout(() => {
        const st = $('#pullStage');
        st.classList.add('on');
        st.setAttribute('aria-hidden', 'false');
        st.classList.toggle('weapon-mode', h === 'armory');
        $('#psHeat').querySelector('i').style.width = '58%';
        if (h === 'armory') armoryIntro(ui.pool);
        else decodeIntro(ui.pool, 10, [{ rarity: parseInt(h.replace('intro', ''), 10) || 6 }]);
      }, 600);
    }
    if (qs.get('pull')) {
      const kind = qs.get('pull') === 'single' ? 'single' : 'ten';
      if (qs.get('now') === '1') doPull(kind);
      else setTimeout(() => doPull(kind), 900);
    }

    bootFlow();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
