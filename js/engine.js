/* ==========================================================================
   终末地 · 寻访模拟器 — engine.js
   纯逻辑层：卡池状态、概率、保底、掉落、存档。
   规则依据 fz.wiki 抓取的卡池配置（star6BaseRate=8000/1e6 等）。
   ========================================================================== */
(function (global) {
  'use strict';

  const D = global.GACHA_DATA;
  const SAVE_KEY = 'endfield.headhunt.v1';
  const MAX_HIST = 600;

  /* ---------------------------------------------------------------- utils */
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rnd = () => Math.random();

  /* ------------------------------------------------------------- indexes */
  const OP = D.ops;
  const WPN = D.weapons;
  const ALL_POOLS = D.pools.concat(D.wpools || []);
  const POOL = {};
  ALL_POOLS.forEach(p => { POOL[p.id] = p; });

  const TYPES = [
    { key: 'Special', label: '特许寻访', en: 'SPECIAL', icon: 'special' },
    { key: 'Joint', label: '特殊寻访', en: 'JOINT', icon: 'joint' },
    { key: 'Rerun', label: '重构寻访', en: 'RERUN', icon: 'rerun' },
    { key: 'Standard', label: '基础寻访', en: 'STANDARD', icon: 'standard' },
    { key: 'Beginner', label: '启程寻访', en: 'BEGINNER', icon: 'beginner' },
    { key: 'Normal', label: '武库申领', en: 'ARSENAL', icon: 'weapon', weapon: true }
  ];

  const poolsOf = type => ALL_POOLS.filter(p => p.type === type);
  const itemOf = (pool, id) => pool.kind === 'weapon' ? WPN[id] : OP[id];

  /* --------------------------------------------------------------- state  */
  function freshState() {
    return {
      v: 1,
      dia: 30000,
      quota: 12000,
      bag: {},          // id -> {n, pot}
      hist: [],         // newest first
      pools: {},        // poolId -> {pulls, gotUp, upCount, tokens, free:[], ms:[]}
      scope: {},        // 'char:special' -> {six, five}
      stat: { pulls: 0, r6: 0, r5: 0, r4: 0, pity: [], spent: 0, spentQ: 0, best: 0, streak: 0 },
      cfg: { anim: true, sfx: true }
    };
  }

  let state = freshState();

  function migrate(obj) {
    const base = freshState();
    if (!obj || typeof obj !== 'object') return base;
    return Object.assign(base, obj, {
      cfg: Object.assign(base.cfg, obj.cfg || {}),
      stat: Object.assign(base.stat, obj.stat || {}),
      bag: obj.bag || {},
      hist: obj.hist || [],
      pools: obj.pools || {},
      scope: obj.scope || {}
    });
  }

  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) state = migrate(JSON.parse(raw));
    } catch (e) { state = freshState(); }
    return state;
  }
  function save() {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {}
  }
  function reset() {
    state = freshState();
    save();
  }

  /* ------------------------------------------------------------ progress  */
  function poolState(id) {
    if (!state.pools[id]) {
      state.pools[id] = { pulls: 0, gotUp: false, upCount: 0, tokens: 0, free: [], freeDue: false, freeDone: [], ms: [] };
    }
    const ps = state.pools[id];
    if (!Array.isArray(ps.freeDone)) ps.freeDone = [];
    if (ps.freeDue === undefined) ps.freeDue = !!(ps.free && ps.free.length);
    if (Array.isArray(ps.free) && ps.free.length) {
      ps.free.forEach(at => { if (ps.freeDone.indexOf(at) < 0) ps.freeDone.push(at); });
      ps.free = [];
    }
    return ps;
  }
  function scopeKey(pool) {
    return pool.type === 'Special' ? 'char:special' : 'pool:' + pool.id;
  }
  function scopeState(pool) {
    const k = scopeKey(pool);
    if (!state.scope[k]) state.scope[k] = { six: 0, five: 0 };
    return state.scope[k];
  }

  /** 当前这一抽的六星率（含软保底） */
  function sixRate(pool, sixPity) {
    const p = pool.pity;
    if (p.soft > 0 && sixPity >= p.soft) return 1;
    if (p.step > 0 && p.start > 0 && sixPity >= p.start - 1) {
      return clamp(pool.rates.r6 + p.step * (sixPity - (p.start - 1) + 1), 0, 1);
    }
    return pool.rates.r6;
  }

  function rates(pool) {
    const sc = scopeState(pool);
    const cur = sixRate(pool, sc.six + 1);
    return {
      r6: pool.rates.r6,
      r5: pool.rates.r5,
      r4: pool.rates.r4,
      cur6: cur,
      sixPity: sc.six,
      fivePity: sc.five
    };
  }

  /* ------------------------------------------------------------- picking  */
  function pickRarity(pool, ctx, force5) {
    const p = pool.pity;
    const sixNext = ctx.six + 1;
    const fiveNext = ctx.five + 1;
    const forceUp = p.hard > 0 && !ctx.gotUp && (ctx.pulls + 1) >= p.hard;
    if (forceUp) return 6;
    if (p.soft > 0 && sixNext >= p.soft) return 6;
    const r = rnd();
    const pr6 = sixRate(pool, sixNext);
    if (r < pr6) return 6;
    if (force5) return 5;
    if (p.five > 0 && fiveNext >= p.five) return 5;
    if (r < pr6 + pool.rates.r5) return 5;
    return 4;
  }

  function pickItem(pool, rarity, forceUp) {
    const list = pool.items.filter(i => i.rarity === rarity);
    if (!list.length) return null;
    const ups = list.filter(i => i.up);
    if (rarity === 6) {
      if (forceUp && ups.length) return ups[Math.floor(rnd() * ups.length)];
      if (pool.kind === 'weapon') {
        const total = list.reduce((s, i) => s + (i.w || 1), 0);
        let v = rnd() * total;
        for (const i of list) { v -= (i.w || 1); if (v <= 0) return i; }
        return list[0];
      }
      if (pool.fifty && ups.length) {
        if (rnd() < 0.5) return ups[Math.floor(rnd() * ups.length)];
        const rest = list.filter(i => !i.up);
        return rest.length ? rest[Math.floor(rnd() * rest.length)] : ups[0];
      }
      return list[Math.floor(rnd() * list.length)];
    }
    return list[Math.floor(rnd() * list.length)];
  }

  /* ---------------------------------------------------------------- pull   */
  /**
   * @param {object} pool
   * @param {number} n 次数
   * @param {{free?:boolean, kind?:'single'|'ten'}} opt
   */
  function pull(pool, n, opt) {
    opt = opt || {};
    const free = !!opt.free;
    const ps = poolState(pool.id);
    const sc = scopeState(pool);
    const results = [];
    const before = Object.assign({}, ...Object.keys(state.bag).map(k => ({ [k]: state.bag[k].n })));

    if (!free) {
      const cost = opt.kind === 'single' ? pool.cost.single : pool.cost.ten;
      if (pool.kind === 'weapon') {
        if (state.quota < cost) return { error: '武库配额不足', results: [] };
        state.quota -= cost;
        state.stat.spentQ += cost;
      } else {
        if (state.dia < cost) return { error: '嵌晶玉不足', results: [] };
        state.dia -= cost;
        state.stat.spent += cost;
      }
    }

    for (let i = 0; i < n; i++) {
      let ctx;
      if (free) {
        // 加急寻访：不计保底计数，使用临时计数
        ctx = { six: 0, five: 0, pulls: 0, gotUp: ps.gotUp };
      } else {
        ctx = { six: sc.six, five: sc.five, pulls: ps.pulls, gotUp: ps.gotUp };
      }
      const force5 = free && i === n - 1 && !results.some(r => r.rarity >= 5);
      const rarity = pickRarity(pool, ctx, force5);
      const forceUp = pool.pity.hard > 0 && !ps.gotUp && !free && (ps.pulls + 1) >= pool.pity.hard;
      const item = pickItem(pool, rarity, forceUp && rarity === 6);
      if (!item) continue;

      if (!free) {
        ps.pulls++;
        sc.six = rarity === 6 ? 0 : sc.six + 1;
        sc.five = rarity >= 5 ? 0 : sc.five + 1;
        state.stat.pulls++;
      }

      const isUp = !!item.up;
      if (isUp) { ps.gotUp = true; ps.upCount++; }

      const wasOwned = !!(before[item.id] || (state.bag[item.id] && state.bag[item.id].n > 0));
      const bag = state.bag[item.id] || (state.bag[item.id] = { n: 0, pot: 1 });
      const potBefore = bag.pot;
      bag.n++;
      if (bag.n <= 5) bag.pot = bag.n;
      const potAfter = bag.pot;

      // 配额
      state.quota += rarity === 6 ? 2000 : rarity === 5 ? 200 : 20;

      // 统计
      if (free) state.stat.freePulls = (state.stat.freePulls || 0) + 1;
      else if (rarity === 6) { state.stat.r6++; state.stat.pity.push(ps.pulls); }
      else if (rarity === 5) state.stat.r5++;
      else state.stat.r4++;

      const rec = {
        id: item.id, name: item.name, rarity, up: isUp,
        pool: pool.id, poolName: pool.name, t: Date.now(),
        pity: rarity === 6 ? ps.pulls : 0,
        fresh: !wasOwned, pot: bag.pot, potBefore, potAfter, kind: pool.kind
      };
      results.push(rec);
      state.hist.unshift(rec);
      if (state.hist.length > MAX_HIST) state.hist.length = MAX_HIST;
    }

    // 奖励计数
    if (!free) {
      (pool.freeAt || []).forEach(at => {
        if (ps.pulls >= at && ps.freeDone.indexOf(at) < 0) {
          ps.freeDone.push(at);
          if (!ps.freeDue) ps.freeDue = true;
        }
      });
      (pool.milestones || []).forEach(m => {
        if (ps.pulls >= m.pull && ps.ms.indexOf(m.pull) < 0) ps.ms.push(m.pull);
      });
      if (pool.intervalPer > 0 && ps.gotUp && ps.pulls >= (ps.tokens + 1) * pool.intervalPer) {
        ps.tokens = Math.floor(ps.pulls / pool.intervalPer);
      }
      // 60 抽：赠送下期卡池专用十连券
      (pool.milestones || []).forEach(m => {
        if (ps.pulls >= m.pull && ps.ms.indexOf(m.pull) >= 0 && m.pull === 60 && !ps.ticket60) {
          ps.ticket60 = true;
          state.tickets = (state.tickets || 0) + 1;
        }
      });
    }

    save();
    return { results, pool };
  }

  /** 重置单个卡池的进度：累计抽数、120 井、240 信物、加急、里程碑 */
  function resetPool(pool) {
    const ps = poolState(pool.id);
    ps.pulls = 0; ps.gotUp = false; ps.upCount = 0; ps.tokens = 0;
    ps.free = []; ps.freeDue = false; ps.freeDone = []; ps.ms = []; ps.ticket60 = false;
    if (pool.kind !== 'weapon') {
      const sc = scopeState(pool);
      sc.six = 0; sc.five = 0;
    }
    save();
    return ps;
  }

  function consumeFree(pool) {
    const ps = poolState(pool.id);
    if (!ps.freeDue) return false;
    ps.freeDue = false;
    save();
    return true;
  }

  /* --------------------------------------------------------------- wallet */
  function grant(dia, quota) {
    if (dia) state.dia += dia;
    if (quota) state.quota += quota;
    save();
  }

  /* ----------------------------------------------------------- statistics */
  function overall() {
    const s = state.stat;
    const total = s.pulls || 0;
    return {
      total,
      r6: s.r6, r5: s.r5, r4: s.r4,
      rate6: total ? s.r6 / total : 0,
      rate5: total ? s.r5 / total : 0,
      rate4: total ? s.r4 / total : 0,
      avgPity: s.r6 ? total / s.r6 : 0,
      up: Object.keys(state.pools).reduce((n, k) => n + (state.pools[k].upCount || 0), 0),
      spent: s.spent, spentQ: s.spentQ,
      pity: s.pity.slice(-120),
      owned: Object.keys(state.bag).length,
      pullsToDia: s.spent
    };
  }

  function histogram(bin) {
    bin = bin || 10;
    const arr = new Array(Math.ceil(80 / bin)).fill(0);
    state.stat.pity.forEach(v => {
      const i = clamp(Math.floor((v - 1) / bin), 0, arr.length - 1);
      arr[i]++;
    });
    return arr;
  }

  /* --------------------------------------------------------------- export */
  global.Gacha = {
    D, TYPES, POOL: ALL_POOLS, OPS: OP, WEAPONS: WPN,
    get state() { return state; },
    load, save, reset, poolState, scopeState, scopeKey, rates, sixRate,
    pull, consumeFree, resetPool, freeReady: pool => !!poolState(pool.id).freeDue, grant, overall, histogram,
    poolsOf, itemOf, poolById: id => POOL[id],
    getAllPools: () => ALL_POOLS,
    cfg: () => state.cfg,
    saveCfg: patch => { Object.assign(state.cfg, patch); save(); }
  };
})(window);
