/* =============================================================================
   fx.js — Arknights: Endfield · pull-overlay backdrop renderer
   Canvas only. No deps, no network, no assets. Exposes window.FX.
   Layers: focal glow · 96px / 192px diamond lattices · rotating triangle wires ·
           scan bars + data-rain ticks · spark bursts on demand.
   Transparent canvas; the host's #050607 shows through.
   ============================================================================= */
(function (root) {
  'use strict';
  var TAU = Math.PI * 2, CELL = 96, FAR_CELL = 192, FALLBACK_TONE = '#ffef5a';
  var RARITY_TONE = { 4: '#5b9bff', 5: '#f0b73f', 6: '#ff5a4e' };
  var S = {
    canvas: null, ctx: null, ro: null, raf: 0, running: false, destroyed: false,
    userPaused: false, hidden: false, dpr: 1, w: 0, h: 0, t: 0, last: 0, density: 1,
    intensity: 1, intensityTo: 1, explicitTone: false, flash: 0, nextBar: 2.4, nextFlick: 0.9,
    tone: { r: 255, g: 239, b: 90 }, toneTo: { r: 255, g: 239, b: 90 },
    focus: { x: 0.5, y: 0.44 }, tris: [], flickers: [], bars: [], rain: [], sparks: [], rings: []
  };
  function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
  function rand(lo, hi) { return lo + Math.random() * (hi - lo); }
  function hash(i, j) { var x = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return x - Math.floor(x); }
  function parseColor(input) {
    if (!input) return null;
    var s = String(input).trim(), m = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s), h, m2;
    if (m) {
      h = m[1];
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
    }
    m2 = /^rgba?\(\s*([0-9.]+)[,\s]+([0-9.]+)[,\s]+([0-9.]+)/i.exec(s);
    if (!m2) return null;
    return { r: clamp(parseFloat(m2[1]), 0, 255) | 0, g: clamp(parseFloat(m2[2]), 0, 255) | 0,
      b: clamp(parseFloat(m2[3]), 0, 255) | 0 };
  }
  function toneCss(a) {
    var c = S.tone;
    return 'rgba(' + (c.r | 0) + ',' + (c.g | 0) + ',' + (c.b | 0) + ',' + clamp(a, 0, 1).toFixed(3) + ')';
  }
  function readAccent(el) {
    if (typeof document === 'undefined' || typeof root.getComputedStyle !== 'function') return parseColor(FALLBACK_TONE);
    var nodes = [], i, c;
    try {
      if (el && el.parentElement) nodes.push(el.parentElement);
      if (document.documentElement) nodes.push(document.documentElement);
    } catch (e) {}
    for (i = 0; i < nodes.length; i++) {
      try { c = parseColor(root.getComputedStyle(nodes[i]).getPropertyValue('--acc')); if (c) return c; } catch (e2) {}
    }
    return parseColor(FALLBACK_TONE);
  }
  var raf = typeof root.requestAnimationFrame === 'function' ? root.requestAnimationFrame.bind(root)
    : function (cb) { return root.setTimeout(function () { cb(Date.now()); }, 16); };
  var caf = typeof root.cancelAnimationFrame === 'function' ? root.cancelAnimationFrame.bind(root)
    : function (id) { root.clearTimeout(id); };
  function resize() {
    var el = S.canvas, ctx = S.ctx, rect = null, cw, ch, dpr, nw, nh;
    if (!el || !ctx || S.destroyed) return;
    try { rect = el.getBoundingClientRect(); } catch (e) {}
    cw = (rect && rect.width) || el.clientWidth || root.innerWidth || 1;
    ch = (rect && rect.height) || el.clientHeight || root.innerHeight || 1;
    dpr = clamp(root.devicePixelRatio || 1, 1, 2);
    nw = Math.max(1, Math.round(cw * dpr)); nh = Math.max(1, Math.round(ch * dpr));
    S.dpr = dpr; S.w = Math.max(1, Math.round(cw)); S.h = Math.max(1, Math.round(ch));
    if (el.width !== nw) el.width = nw;
    if (el.height !== nh) el.height = nh;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); layout();
  }
  function layout() {
    var w = S.w, h = S.h, d = S.density, i, sd, c, min = Math.min(w, h), gap, cols;
    S.tris.length = 0;
    var n = Math.min(12, Math.round(clamp(w * h / 190000, 3, 8) * d) + 2);
    for (i = 0; i < n; i++) {
      sd = i + 2.3;
      S.tris.push({ x: 0.08 + hash(sd, 1) * 0.84, y: 0.10 + hash(sd, 2) * 0.80,
        s: (0.10 + hash(sd, 3) * 0.14) * min, rot: hash(sd, 4) * TAU,
        rs: (hash(sd, 5) - 0.5) * 0.10, ph: hash(sd, 6) * TAU, ps: 0.22 + hash(sd, 7) * 0.5,
        a0: 0.020 + hash(sd, 8) * 0.020, a1: 0.042 + hash(sd, 9) * 0.038,
        ds: 0.12 + hash(sd, 10) * 0.30, dx: hash(sd, 11) * TAU,
        drift: 5 + hash(sd, 12) * 16, inner: hash(sd, 13) > 0.42 });
    }
    S.rain.length = 0;
    gap = clamp(64 / d, 34, 140); cols = Math.min(90, Math.ceil(w / gap) + 1);
    for (i = 0; i < cols; i++) {
      c = { x: i * gap + hash(i, 21) * gap * 0.55, y: hash(i, 22) * (h + 160) - 160,
        v: 10 + hash(i, 23) * 26, a: 0.036 + hash(i, 24) * 0.032,
        n: 2 + Math.floor(hash(i, 25) * 3), gap: 26 + hash(i, 26) * 34, len: 8 };
      c.span = c.gap * (c.n - 1) + c.len; S.rain.push(c);
    }
    S.bars.length = 0; S.flickers.length = 0; S.sparks.length = 0; S.rings.length = 0;
    S.nextBar = rand(1.2, 3.0); S.nextFlick = rand(0.4, 1.1);
  }
  function drawGlow(ctx) {
    var cx = S.focus.x * S.w, cy = S.focus.y * S.h, g;
    var a = (0.028 + S.flash * 0.04) * S.intensity;
    g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(S.w, S.h) * 0.62);
    g.addColorStop(0, toneCss(a)); g.addColorStop(0.45, toneCss(a * 0.34)); g.addColorStop(1, toneCss(0));
    ctx.fillStyle = g; ctx.fillRect(0, 0, S.w, S.h);
    if (S.flash > 0.01) {
      g = ctx.createRadialGradient(cx, cy, 0, cx, cy, Math.max(S.w, S.h) * 0.4 * (0.7 + S.flash * 0.5));
      g.addColorStop(0, toneCss(Math.min(0.42, S.flash * 0.14)));
      g.addColorStop(0.45, toneCss(Math.min(0.16, S.flash * 0.045))); g.addColorStop(1, toneCss(0));
      ctx.fillStyle = g; ctx.fillRect(0, 0, S.w, S.h);
    }
  }
  function diamonds(ctx, cell, r, ox, oy, alpha, buckets) {
    var cols = Math.ceil(S.w / cell) + 2, rows = Math.ceil(S.h / cell) + 2;
    var b, i, j, x, y, m, rr, passes = buckets ? 3 : 1;
    ctx.lineWidth = 1;
    for (b = 0; b < passes; b++) {
      ctx.beginPath();
      for (j = 0; j < rows; j++) {
        y = oy + j * cell - cell;
        for (i = 0; i < cols; i++) {
          if (buckets && (i * 5 + j * 7) % 3 !== b) continue;
          x = ox + i * cell - cell; m = hash(i, j); rr = m < 0.26 ? r * 0.46 : r;
          ctx.moveTo(x, y - rr); ctx.lineTo(x + rr, y); ctx.lineTo(x, y + rr); ctx.lineTo(x - rr, y); ctx.closePath();
        }
      }
      ctx.strokeStyle = toneCss(buckets ? alpha[b] : alpha); ctx.stroke();
    }
  }
  function drawNear(ctx) {
    var ox = (S.t * 2.6) % CELL, oy = (S.t * 1.1) % CELL, r = CELL * 0.355;
    var base = 0.052 * S.intensity * (1 + S.flash * 0.5);
    var cols = Math.ceil(S.w / CELL) + 2, rows = Math.ceil(S.h / CELL) + 2;
    var i, j, x, y, f, p, a;
    diamonds(ctx, CELL, r, ox, oy, [base * 0.72, base, base * 1.32], true);
    ctx.beginPath();
    for (j = 0; j < rows; j += 2) for (i = 0; i < cols; i += 2) {
      x = ox + i * CELL - CELL; y = oy + j * CELL - CELL; ctx.rect(x - 0.5, y - 0.5, 1, 1);
    }
    ctx.fillStyle = toneCss(base * 0.85); ctx.fill();
    for (i = S.flickers.length - 1; i >= 0; i--) {
      f = S.flickers[i]; p = (S.t - f.t0) / f.dur;
      if (p >= 1) { S.flickers.splice(i, 1); continue; }
      x = ox + f.i * CELL - CELL; y = oy + f.j * CELL - CELL;
      a = (0.045 + 0.13 * f.peak) * Math.sin(Math.PI * p) * S.intensity;
      ctx.beginPath(); ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath();
      ctx.fillStyle = toneCss(a * 0.32); ctx.fill();
      ctx.strokeStyle = toneCss(a * 1.55); ctx.stroke();
      ctx.fillStyle = toneCss(Math.min(0.4, a * 2.1));
      ctx.fillRect(x - 0.5, y - 3, 1, 6); ctx.fillRect(x - 3, y - 0.5, 6, 1);
    }
  }
  function drawTris(ctx) {
    var t = S.t, i, k, q, tr, a, ang, s, cx, cy, sc, rot, px, py;
    ctx.lineWidth = 1;
    for (i = 0; i < S.tris.length; i++) {
      tr = S.tris[i];
      var pulse = 0.5 + 0.5 * Math.sin(t * tr.ps + tr.ph);
      a = (tr.a0 + tr.a1 * pulse) * S.intensity;
      ang = tr.rot + t * tr.rs; s = tr.s * (0.96 + 0.06 * pulse);
      cx = tr.x * S.w + Math.cos(t * tr.ds + tr.dx) * tr.drift;
      cy = tr.y * S.h + Math.sin(t * tr.ds * 0.83 + tr.dx) * tr.drift * 0.7;
      for (k = 0; k < (tr.inner ? 2 : 1); k++) {
        sc = k ? 0.23 : 0.58; rot = k ? -ang + tr.ph : ang;
        ctx.beginPath();
        for (q = 0; q < 3; q++) {
          px = cx + Math.cos(rot + q * (TAU / 3)) * s * sc;
          py = cy + Math.sin(rot + q * (TAU / 3)) * s * sc;
          if (q === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.strokeStyle = toneCss(k ? a * 0.5 : a); ctx.stroke();
      }
      ctx.fillStyle = toneCss(Math.min(0.4, a * 2.2)); ctx.fillRect(cx + Math.cos(ang) * s * 0.58 - 0.5, cy + Math.sin(ang) * s * 0.58 - 0.5, 1, 1);
    }
  }
  function drawRain(ctx) {
    var i, k, c, y;
    for (i = 0; i < S.rain.length; i++) {
      c = S.rain[i];
      for (k = 0; k < c.n; k++) {
        y = c.y + k * c.gap;
        if (y < -12 || y > S.h + 12) continue;
        ctx.fillStyle = toneCss(c.a * (1 - k / (c.n + 0.5)) * S.intensity);
        ctx.fillRect(c.x, y, 1, c.len);
      }
    }
  }
  function drawBars(ctx) {
    var i, b, x0, x1, g;
    for (i = 0; i < S.bars.length; i++) {
      b = S.bars[i];
      x0 = clamp((b.cx - b.w2) * S.w, 0, S.w); x1 = clamp((b.cx + b.w2) * S.w, 0, S.w);
      g = ctx.createLinearGradient(x0, 0, x1, 0);
      g.addColorStop(0, toneCss(0)); g.addColorStop(0.18, toneCss(b.a * 0.35));
      g.addColorStop(0.5, toneCss(b.a)); g.addColorStop(0.82, toneCss(b.a * 0.35)); g.addColorStop(1, toneCss(0));
      ctx.fillStyle = g; ctx.fillRect(x0, b.y, x1 - x0, 1);
      ctx.fillStyle = toneCss(b.a * 0.18); ctx.fillRect(x0, b.y + 1, x1 - x0, 3);
      ctx.fillStyle = toneCss(Math.min(0.42, b.a * 2.4)); ctx.fillRect(x0, b.y - 2, 1, 5); ctx.fillRect(x1 - 1, b.y - 2, 1, 5);
    }
  }
  function drawBurst(ctx) {
    var i, p, k, a, m, len, ring, sp;
    for (i = 0; i < S.rings.length; i++) {
      ring = S.rings[i]; p = ring.life / ring.max;
      ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(ring.x, ring.y, ring.r, 0, TAU);
      ctx.strokeStyle = toneCss(Math.pow(1 - p, 1.6) * 0.32); ctx.stroke();
    }
    for (i = 0; i < S.sparks.length; i++) {
      sp = S.sparks[i]; k = 1 - sp.life / sp.max; a = k * k * 0.55;
      m = Math.sqrt(sp.vx * sp.vx + sp.vy * sp.vy) || 1; len = sp.len * (0.35 + 0.65 * k);
      ctx.beginPath(); ctx.moveTo(sp.x, sp.y);
      ctx.lineTo(sp.x - (sp.vx / m) * len, sp.y - (sp.vy / m) * len);
      ctx.lineWidth = sp.w; ctx.strokeStyle = toneCss(a); ctx.stroke();
    }
  }
  function update(dt) {
    var i, c, b, p, r, e = 1 - Math.exp(-7 * dt);
    S.tone.r += (S.toneTo.r - S.tone.r) * e; S.tone.g += (S.toneTo.g - S.tone.g) * e;
    S.tone.b += (S.toneTo.b - S.tone.b) * e;
    S.intensity += (S.intensityTo - S.intensity) * (1 - Math.exp(-4 * dt));
    if (S.flash > 0) S.flash = Math.max(0, S.flash - dt * 3.2);
    for (i = 0; i < S.rain.length; i++) {
      c = S.rain[i]; c.y += c.v * dt; if (c.y - c.span > S.h) c.y = -rand(0, 140);
    }
    if ((S.nextBar -= dt) <= 0) {
      if (S.bars.length < 3) S.bars.push({ y: rand(-160, -20), v: rand(26, 64), a: rand(0.14, 0.20), w2: rand(0.34, 0.52), cx: rand(0.44, 0.56) });
      S.nextBar = rand(3.2, 7.4) / S.density;
    }
    if ((S.nextFlick -= dt) <= 0) {
      if (S.flickers.length < 7) S.flickers.push({ i: Math.floor(Math.random() * (Math.ceil(S.w / CELL) + 1)),
        j: Math.floor(Math.random() * (Math.ceil(S.h / CELL) + 1)), t0: S.t, dur: rand(0.45, 1.25), peak: rand(0.25, 1) });
      S.nextFlick = rand(0.45, 1.5) / S.density;
    }
    for (i = S.bars.length - 1; i >= 0; i--) { b = S.bars[i]; b.y += b.v * dt; if (b.y > S.h + 8) S.bars.splice(i, 1); }
    e = Math.pow(0.35, dt);
    for (i = S.sparks.length - 1; i >= 0; i--) {
      p = S.sparks[i]; if ((p.life += dt) >= p.max) { S.sparks.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= e; p.vy *= e; p.vy += 20 * dt;
    }
    for (i = S.rings.length - 1; i >= 0; i--) {
      r = S.rings[i]; if ((r.life += dt) >= r.max) { S.rings.splice(i, 1); continue; }
      r.r += r.v * dt; r.v *= Math.pow(0.12, dt);
    }
  }
  function render() {
    var ctx = S.ctx;
    if (!ctx) return;
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    ctx.clearRect(0, 0, S.w, S.h);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    drawGlow(ctx);
    diamonds(ctx, FAR_CELL, FAR_CELL * 0.33, (((S.t * -1.4) % FAR_CELL) + FAR_CELL) % FAR_CELL,
      (S.t * 0.8) % FAR_CELL, 0.024 * S.intensity * (1 + S.flash * 0.4), false);
    drawNear(ctx); drawTris(ctx); drawRain(ctx); drawBars(ctx);
    ctx.globalCompositeOperation = 'lighter'; drawBurst(ctx);
    ctx.globalCompositeOperation = 'source-over';
  }
  function frame(now) {
    if (!S.running) return;
    var dt = S.last ? (now - S.last) / 1000 : 0.016;
    S.last = now; dt = clamp(dt, 0, 0.05); S.t += dt;
    try { update(dt); render(); } catch (err) { stop(); return; }
    if (S.running) S.raf = raf(frame);
  }
  function start() {
    if (S.running || !S.ctx || S.destroyed || S.userPaused || S.hidden) return;
    S.running = true; S.last = 0; S.raf = raf(frame);
  }
  function stop() { S.running = false; if (S.raf) { caf(S.raf); S.raf = 0; } }
  function onResize() { if (S.canvas) resize(); }
  function onVisibility() {
    S.hidden = !!(typeof document !== 'undefined' && document.hidden);
    if (S.hidden) stop(); else if (!S.userPaused) start();
  }
  function mount(el, opts) {
    var ctx = null, initial;
    if (!el || typeof el.getContext !== 'function') return false;
    try { ctx = el.getContext('2d'); } catch (e) {}
    if (!ctx) return false;
    destroy();
    S.destroyed = false; S.canvas = el; S.ctx = ctx; S.userPaused = false; S.hidden = false;
    opts = opts || {}; S.density = clamp(parseFloat(opts.density) || 1, 0.4, 3);
    if (opts.focus) setFocus(opts.focus.x, opts.focus.y); else S.focus = { x: 0.5, y: 0.44 };
    initial = parseColor(opts.tone);
    if (initial) S.explicitTone = true; else if (!S.explicitTone) initial = readAccent(el);
    if (!initial) initial = S.explicitTone ? S.toneTo : parseColor(FALLBACK_TONE);
    S.tone = { r: initial.r, g: initial.g, b: initial.b };
    S.toneTo = { r: initial.r, g: initial.g, b: initial.b };
    S.intensity = 1; S.intensityTo = 1; S.t = 0; S.last = 0; S.flash = 0;
    try { resize(); } catch (e2) { S.w = root.innerWidth || 1; S.h = root.innerHeight || 1; }
    try {
      if (typeof root.ResizeObserver === 'function') { S.ro = new root.ResizeObserver(onResize); S.ro.observe(el); }
    } catch (e3) { S.ro = null; }
    try { root.addEventListener('resize', onResize, false); } catch (e4) {}
    if (typeof document !== 'undefined') {
      try { document.addEventListener('visibilitychange', onVisibility, false); } catch (e5) {}
      S.hidden = !!document.hidden;
    }
    start(); return true;
  }
  function destroy() {
    stop();
    try { if (S.ro) S.ro.disconnect(); } catch (e) {}
    S.ro = null;
    try { root.removeEventListener('resize', onResize, false); } catch (e2) {}
    if (typeof document !== 'undefined') { try { document.removeEventListener('visibilitychange', onVisibility, false); } catch (e3) {} }
    try {
      if (S.ctx && S.canvas) { S.ctx.setTransform(1, 0, 0, 1, 0, 0); S.ctx.clearRect(0, 0, S.canvas.width, S.canvas.height); }
    } catch (e4) {}
    S.canvas = null; S.ctx = null;
    S.tris.length = 0; S.flickers.length = 0; S.bars.length = 0; S.rain.length = 0;
    S.sparks.length = 0; S.rings.length = 0; S.flash = 0; S.t = 0; S.last = 0;
    S.hidden = false; S.userPaused = false; S.running = false; S.destroyed = true;
  }
  function setTone(hex) {
    var c = parseColor(hex);
    if (!c) return;
    S.toneTo = c; S.explicitTone = true;
  }
  function setRarity(n) {
    var r = Math.round(Number(n) || 0), c;
    if (RARITY_TONE[r]) setTone(RARITY_TONE[r]);
    else {
      c = readAccent(S.canvas) || parseColor(FALLBACK_TONE);
      if (c) { S.toneTo = c; S.explicitTone = false; }
    }
    S.intensityTo = r === 6 ? 1.34 : r === 5 ? 1.16 : r === 4 ? 1.06 : 1;
  }
  function setFocus(x, y) {
    var nx = parseFloat(x), ny = parseFloat(y);
    if (!isFinite(nx) || !isFinite(ny)) return;
    S.focus.x = clamp(nx, 0, 1); S.focus.y = clamp(ny, 0, 1);
  }
  function burst(strength) {
    if (!S.ctx || S.destroyed) return;
    var s = parseFloat(strength);
    if (!isFinite(s)) s = 0.6;
    s = clamp(s, 0, 1);
    var n = Math.round(20 + 60 * s), cx = S.focus.x * S.w, cy = S.focus.y * S.h, i, ang, sp;
    for (i = 0; i < n; i++) {
      ang = Math.random() * TAU; sp = (50 + Math.random() * 260) * (0.42 + 0.58 * s);
      S.sparks.push({ x: cx + Math.cos(ang) * rand(0, 8), y: cy + Math.sin(ang) * rand(0, 8),
        vx: Math.cos(ang) * sp * (0.7 + Math.random() * 0.6),
        vy: Math.sin(ang) * sp * (0.7 + Math.random() * 0.6) - 12,
        life: 0, max: rand(0.45, 1.25), len: rand(5, 20), w: Math.random() < 0.2 ? 2 : 1 });
    }
    S.rings.push({ x: cx, y: cy, r: 8, v: 260 + 220 * s, life: 0, max: 0.55 + 0.25 * s });
    if (S.rings.length > 4) S.rings.splice(0, S.rings.length - 4);
    if (S.sparks.length > 420) S.sparks.splice(0, S.sparks.length - 420);
    S.flash = Math.min(1.4, S.flash + 0.55 + 0.55 * s);
  }
  function pause() { S.userPaused = true; stop(); }
  function resume() { S.userPaused = false; if (!S.hidden) start(); }
  root.FX = {
    mount: mount, setTone: setTone, setRarity: setRarity, burst: burst,
    setFocus: setFocus, pause: pause, resume: resume, destroy: destroy
  };
})(typeof window !== 'undefined' ? window : this);
