/* 引擎概率自检：在 Node 里直接跑 js/engine.js，统计真实分布 */
const fs = require('fs');
const path = require('path');

const base = path.join(__dirname, '..');
global.window = global;
global.localStorage = {
  _d: {},
  getItem(k) { return this._d[k] || null; },
  setItem(k, v) { this._d[k] = v; },
  removeItem(k) { delete this._d[k]; }
};

eval(fs.readFileSync(path.join(base, 'data/data.js'), 'utf8'));
eval(fs.readFileSync(path.join(base, 'js/engine.js'), 'utf8'));

const G = global.Gacha;
const D = global.GACHA_DATA;

// 存档写盘改成无操作，纯算概率
let saved = null;
global.localStorage.setItem = () => { };

function fresh(id) {
  G.reset();
  G.state.dia = 1e12;
  G.state.quota = 1e12;
  return G.poolById(id);
}

function pct(v) { return (v * 100).toFixed(4) + '%'; }

/* ---------------------------------------------------------------- 1. 单抽分布 */
const N = 150000;
let pool = fresh('special_1_6_2');
const cnt = { 4: 0, 5: 0, 6: 0 };
let gap = 0;
const gaps = [];
const hist = {};
let sixes = 0, ups = 0, lastSixAt = 0;

for (let i = 0; i < N; i++) {
  const r = G.pull(pool, 1, { kind: 'single' });
  const rec = r.results[0];
  if (!rec) { console.log('!! no result', r.error); break; }
  cnt[rec.rarity]++;
  gap++;
  if (rec.rarity === 6) {
    gaps.push(gap);
    hist[gap] = (hist[gap] || 0) + 1;
    sixes++;
    if (rec.up) ups++;
    gap = 0;
  }
}

console.log('=== 单抽 ' + N + ' 次 · special_1_6_2（含软保底） ===');
console.log('6★', cnt[6], pct(cnt[6] / N), ' 5★', cnt[5], pct(cnt[5] / N), ' 4★', pct(cnt[4] / N));
console.log('平均每个 6★ 需要', (N / sixes).toFixed(2), '抽');
console.log('6★ 中 UP 占比', pct(ups / sixes), '（理论 50%，120 井后 100%）');
const bands = [[1, 50], [51, 65], [66, 70], [71, 75], [76, 79], [80, 200]];
console.log('出 6★ 前的间隔分布：');
bands.forEach(([a, b]) => {
  const c = gaps.filter(g => g >= a && g <= b).length;
  if (c) console.log('  ' + a + '-' + b + ' 抽：' + pct(c / sixes) + ' (' + c + ')');
});
console.log('最长间隔', Math.max.apply(null, gaps), '抽');

/* ---------------------------------------------------------------- 2. 十连 5★ 保底 */
pool = fresh('special_1_6_2');
let bad = 0;
for (let t = 0; t < 4000; t++) {
  const r = G.pull(pool, 10, { kind: 'ten' });
  if (!r.results.some(x => x.rarity >= 5)) bad++;
}
console.log('\n=== 十连 5★+ 保底 ===');
console.log('4000 次十连中无 5★+ 的次数：', bad, '（应为 0）');

/* ---------------------------------------------------------------- 3. 加急替换 */
pool = fresh('special_1_6_2');
for (let i = 0; i < 3; i++) G.pull(pool, 10, { kind: 'ten' }); // 30 抽
const ps = G.poolState(pool.id);
console.log('\n=== 加急招募 ===');
console.log('30 抽后 freeReady =', G.freeReady(pool), '（应为 true）', 'pulls =', ps.pulls);
const okConsume = G.consumeFree(pool);
console.log('消耗一次 =', okConsume, ' 之后 freeReady =', G.freeReady(pool), '（应为 false）');
for (let i = 0; i < 5; i++) G.pull(pool, 1, { kind: 'single' });
console.log('再抽 5 次后 freeReady =', G.freeReady(pool), '（必须在 60 抽前保持 false）', 'pulls =', ps.pulls);
const beforePulls = ps.pulls;
const fr = G.pull(pool, 10, { free: true, kind: 'ten' });
console.log('加急十连结果数 =', fr.results.length, ' 含 5★+ =', fr.results.some(x => x.rarity >= 5),
  ' 抽数是否不变 =', ps.pulls === beforePulls, '（应为 true）');
console.log('加急十连的稀有度：', fr.results.map(x => x.rarity).join(','));

/* ---------------------------------------------------------------- 4. 120 井 */
let miss = 0;
for (let t = 0; t < 300; t++) {
  pool = fresh('special_1_6_2');
  for (let i = 0; i < 120; i++) G.pull(pool, 1, { kind: 'single' });
  if (!G.poolState(pool.id).gotUp) miss++;
}
console.log('\n=== 120 抽必得 UP ===');
console.log('300 次 120 抽中未拿到 UP 的次数：', miss, '（应为 0）');

/* ---------------------------------------------------------------- 5. 武器池 */
pool = fresh('weaponbox_1_6_2');
let w6 = 0, w5 = 0, w4 = 0, wsum = 0, noFive = 0;
const w6gap = [];
let g = 0;
for (let t = 0; t < 2000; t++) {
  const r = G.pull(pool, 10, { kind: 'ten' });
  if (!r.results.some(x => x.rarity >= 5)) noFive++;
  r.results.forEach(x => {
    wsum++;
    if (x.rarity === 6) { w6++; g = 0; } else if (x.rarity === 5) w5++; else w4++;
    g++;
    if (g && x.rarity === 6) w6gap.push(g);
  });
}
console.log('\n=== 武器池 2000 次申领（20000 件） ===');
console.log('6★', pct(w6 / wsum), ' 5★', pct(w5 / wsum), ' 4★', pct(w4 / wsum), ' 无 5★+ 次数', noFive);

/* ---------------------------------------------------------------- 6. 期望抽数 */
let sum = 0;
for (let i = 1; i <= 200; i++) {
  const p = i <= 65 ? 0.008 : i >= 80 ? 1 : Math.min(1, 0.008 + 0.05 * (i - 65));
  sum += i * p;
}
console.log('\n（参考）单抽 6★ 的数学期望间隔约', sum.toFixed(2), '抽 → 综合概率约', pct(1 / sum));
