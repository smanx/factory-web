'use strict';

// ===== 电力电网（电线杆供电模型，对齐《异星工厂》Electric network）=====
// 电网由「电线杆」构成：
//   1. 杆与杆按官方 maximum_wire_distance（GAME_DATA.pole[type].wire）自动连线，形成连通分量；
//   2. 发电/耗电设备进入任一带电杆的 supply_area_distance（GAME_DATA.pole[type].supply，正方形覆盖）
//      即接入该杆所在电网；设备同时被多个电网的杆覆盖时，经该设备把电网合并为一个；
//   3. 每个电网独立做供需平衡（prod/demand/sat），电网之间互不影响；
//   4. 未被任何电线杆覆盖的电力设备 _grid=null → 缺电停摆（发电设备不发电、耗电设备不耗电）。
// 未被官方收录的杆类型回退到小型杆参数（兜底，非新数据源）。

// ===== 电力增量注册表（P1 优化）=====
// 维护“可能发电”“可能耗电”“电线杆”“功率开关”四个子集，由 addEnt/removeEnt 同步增删。
// updatePower 只扫这些子集，而不是全量 G.ents。
function ensurePowerReg() {
  if (!G.powerReg) G.powerReg = { producers: new Set(), consumers: new Set(), poles: new Set(), switches: new Set() };
  return G.powerReg;
}
function isPowerPole(e) { return !!(e && GAME_DATA.pole && GAME_DATA.pole[e.type] !== undefined); }
function regPowerEnt(e) {
  if (!e) return;
  const r = ensurePowerReg();
  // 有 powerOut 属性即视为“潜在发电设备”（蒸汽机 / 太阳能板 / 蓄电器等）。
  // 注意：不能以 powerOut!==0 作为入集合条件——发电设备放置/读档时 powerOut
  // 初值都为 0（蒸汽机供汽后、太阳能板天亮后、蓄电器放电时才 >0），若此处排除，
  // 它们就永远不会被注册进 producers，导致 updatePower 扫不到发电设备。
  if (e.powerOut !== undefined && !e.noGridPower) r.producers.add(e);
  else r.producers.delete(e);
  if (typeof e.powerDemand === 'function' && !e.noGridPower) r.consumers.add(e);
  else r.consumers.delete(e);
  if (isPowerPole(e)) r.poles.add(e);
  else r.poles.delete(e);
  if (e.type === 'power-switch') r.switches.add(e);
  else r.switches.delete(e);
}
function unregPowerEnt(e) {
  if (!e || !G.powerReg) return;
  G.powerReg.producers.delete(e);
  G.powerReg.consumers.delete(e);
  G.powerReg.poles.delete(e);
  G.powerReg.switches.delete(e);
}
function resetPowerReg() {
  G.powerReg = { producers: new Set(), consumers: new Set(), poles: new Set(), switches: new Set() };
  G.grids = [];
}

// ===== 电线杆官方参数读取（GAME_DATA.pole 单源，兜底小型杆）=====
function poleWireOf(e) { const p = GAME_DATA.pole && GAME_DATA.pole[e.type]; return p && p.wire !== undefined ? p.wire : 7.5; }
function poleSupplyOf(e) { const p = GAME_DATA.pole && GAME_DATA.pole[e.type]; return p && p.supply !== undefined ? p.supply : 2.5; }
function pcx(e) { return e.x + (e.w || 1) / 2; }
function pcy(e) { return e.y + (e.h || 1) / 2; }
// 电线杆供电覆盖判定：杆中心正方形覆盖区（半边 = supply）与设备矩形是否相交
function poleCovers(p, e) {
  const s = poleSupplyOf(p);
  const cx = pcx(p), cy = pcy(p);
  const ex0 = e.x, ey0 = e.y, ex1 = e.x + (e.w || 1), ey1 = e.y + (e.h || 1);
  return ex0 <= cx + s && ex1 >= cx - s && ey0 <= cy + s && ey1 >= cy - s;
}

// ===== 异星工厂式“低效率运转”降速模型 =====
// 对齐《异星工厂》：电网供电不足（生产<需求）时，设备不是按比例一直降到趋近于 0、
// 更不是直接停摆，而是有一个最低运转下限（约 20%）。只要电网还有一点电力（sat>0），
// 各用电设备就始终以至少 MIN_POWER_SAT 的比例低效率运转，不会停下来；
// 只有电网完全无电（prod=0，sat=0）时设备才真正停摆。
const MIN_POWER_SAT = 0.2;   // 供电不足时的最低运转比例（对齐异星工厂 20% 下限）

// 返回设备实际应采用的速度倍率（按设备所属电网的饱和度）：
//   - sat>=1 ：满速 1
//   - 0<sat<1：max(sat, MIN_POWER_SAT)，保证至少以 20% 低效率运转、不会直接停
//   - sat<=0 ：0（完全断电 / 未接入电网才停摆）
function powerFactor(e) {
  const sat = powerSatOf(e);
  if (sat >= 1) return 1;
  if (sat > 0) return Math.max(sat, MIN_POWER_SAT);
  return 0;
}

// 设备所属电网（null=未接入；undefined=尚未计算，回退全局）
function powerGridOf(e) { return e ? e._grid : null; }

// 是否为「电网电力设备」：发电或耗电设备（电线杆本身是电网骨干、载具靠燃料/装备电网，均排除）。
// 供缺电警告图标与电线杆覆盖高亮共用，保证发电/耗电设备走同一套判定逻辑。
function isGridPowerDevice(e) {
  if (!e || e._dead || e.noGridPower) return false;
  if (isPowerPole(e)) return false;
  return e.powerOut !== undefined || typeof e.powerDemand === 'function';
}

// 电线杆供电覆盖矩形（世界格坐标，正方形，半边 = supply_area_distance）。
function poleSupplyRect(type, x, y, w, h) {
  const s = (GAME_DATA.pole && GAME_DATA.pole[type] && GAME_DATA.pole[type].supply !== undefined)
    ? GAME_DATA.pole[type].supply : 2.5;
  const cx = x + (w || 1) / 2, cy = y + (h || 1) / 2;
  return { x0: cx - s, y0: cy - s, x1: cx + s, y1: cy + s, s };
}

// 设备缺电警告状态：'plug'=未接入任何电网（黄插头）/ 'bolt'=已接入但电网无电（红闪电）/ null=正常。
// 发电与耗电设备共用此逻辑。_grid 尚未计算（undefined）时不显示，避免放置/读档瞬间闪烁。
function powerWarnState(e) {
  if (!isGridPowerDevice(e)) return null;
  if (e._grid === undefined) return null;
  if (e._grid === null) return 'plug';
  if ((e._grid.sat || 0) <= 0) return 'bolt';
  return null;
}

// 设备应采用的电网饱和度：
//   - 已接入电网：该电网 sat（各电网独立）
//   - _grid===null（已计算但未接入）且为电力设备：0（缺电停摆）
//   - 尚未计算（_grid undefined）或非电力设备：回退全局 sat，避免启动瞬间误判
function powerSatOf(e) {
  const gsat = (G.power && G.power.sat != null) ? G.power.sat : 1;
  if (!e) return gsat;
  if (e._grid) return e._grid.sat;
  if (e._grid === null && (typeof e.powerDemand === 'function' || e.powerOut !== undefined)) return 0;
  return gsat;
}

// ===== 电网重建：并查集分组（杆按连线距离互联 + 设备按供电覆盖并入所在电网）=====
// 每 0.25s 由 updatePower 调用一次。空间哈希把杆按格分桶，查询近邻杆，避免 O(n²)。
function rebuildPowerGrids() {
  const r = ensurePowerReg();
  const poles = [];
  for (const p of r.poles) { if (!p._dead) poles.push(p); }
  const devs = [];
  const seen = new Set();
  const addDev = (e) => { if (e && !e._dead && !seen.has(e)) { seen.add(e); devs.push(e); } };
  for (const e of r.producers) addDev(e);
  for (const e of r.consumers) addDev(e);
  for (const e of r.switches) addDev(e);

  const NP = poles.length;
  const N = NP + devs.length;
  const parent = new Int32Array(N);
  for (let i = 0; i < N; i++) parent[i] = i;
  const rank = new Uint8Array(N);
  function find(i) { while (parent[i] !== i) { parent[i] = parent[parent[i]]; i = parent[i]; } return i; }
  function uni(a, b) { a = find(a); b = find(b); if (a === b) return; if (rank[a] < rank[b]) { const t = a; a = b; b = t; } parent[b] = a; if (rank[a] === rank[b]) rank[a]++; }

  // 杆空间哈希（CELL 取供电覆盖与连线距离之间的折中，近邻查询只扫少数格）
  const CELL = 16;
  const hmap = new Map();
  for (let i = 0; i < NP; i++) {
    const p = poles[i];
    const k = Math.floor(p.x / CELL) + ',' + Math.floor(p.y / CELL);
    let a = hmap.get(k); if (!a) { a = []; hmap.set(k, a); }
    a.push(i);
  }
  const buf = [];
  function nearPoles(x, y, reach) {
    buf.length = 0;
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), rad = Math.ceil(reach / CELL);
    for (let gx = cx - rad; gx <= cx + rad; gx++)
      for (let gy = cy - rad; gy <= cy + rad; gy++) {
        const a = hmap.get(gx + ',' + gy);
        if (a) for (let t = 0; t < a.length; t++) buf.push(a[t]);
      }
    return buf;
  }

  // 1) 杆-杆：双方连线距离都覆盖中心切比雪夫距离才互联（与电路网络“双向互连”约定一致）
  for (let i = 0; i < NP; i++) { poles[i]._pwires = []; }
  for (let i = 0; i < NP; i++) {
    const p = poles[i]; const w = poleWireOf(p);
    const cand = nearPoles(p.x, p.y, w);
    for (let t = 0; t < cand.length; t++) {
      const j = cand[t]; if (j <= i) continue;
      const q = poles[j];
      const d = Math.max(Math.abs(pcx(p) - pcx(q)), Math.abs(pcy(p) - pcy(q)));
      if (d <= Math.min(w, poleWireOf(q))) { uni(i, j); p._pwires.push(q); q._pwires.push(p); }
    }
  }

  // 2) 设备-杆：设备进入某杆供电覆盖即并入该杆电网（同时覆盖多电网时经设备合并）
  let maxSupply = 0;
  for (let i = 0; i < NP; i++) { const s = poleSupplyOf(poles[i]); if (s > maxSupply) maxSupply = s; }
  if (NP > 0) {
    for (let di = 0; di < devs.length; di++) {
      const e = devs[di]; const idx = NP + di;
      const cand = nearPoles(e.x, e.y, maxSupply + (e.w || 1) + (e.h || 1));
      for (let t = 0; t < cand.length; t++) {
        const p = poles[cand[t]];
        if (poleCovers(p, e)) uni(idx, cand[t]);
      }
    }
  }

  // 3) 汇总各连通分量的电网（仅含 ≥1 杆的分量才是电网）
  const gridByRoot = new Map();
  const grids = [];
  for (let i = 0; i < NP; i++) {
    const root = find(i);
    let g = gridByRoot.get(root);
    if (!g) { g = { prod: 0, capacity: 0, throttle: 1, demand: 0, sat: 1, poles: 0, switches: 0, tripped: false, stored: 0, storedCap: 0 }; gridByRoot.set(root, g); grids.push(g); }
    g.poles++;
    poles[i]._grid = g;
  }
  for (let di = 0; di < devs.length; di++) {
    const e = devs[di];
    const g = gridByRoot.get(find(NP + di));
    if (!g) { e._grid = null; continue; }   // 未接入任何电网（附近无电线杆覆盖）
    e._grid = g;
    if (e.powerOut !== undefined) g.capacity += e.powerOut || 0;   // 产能（发电机当前可发上限）
    if (typeof e.powerDemand === 'function') g.demand += e.powerDemand() || 0;
    if (e.type === 'power-switch') { g.switches++; if (typeof e.isTripped === 'function' && e.isTripped()) g.tripped = true; }
    // 蓄电器：统计本电网储能与上限（供电线杆悬停详情展示）
    if (e.type === 'accumulator') {
      g.stored += e.stored || 0;
      g.storedCap += (typeof ACCUM_CAP !== 'undefined' ? ACCUM_CAP : 5000);
    }
  }
  for (const g of grids) {
    // 发电机不满功率运行：实际出力按当前耗电量动态调整（delivered = min(产能, 需求)），
    // 多余产能不发电（发电设备据此 throttle 降低燃料消耗，对齐《异星工厂》发电机随负载调节）。
    g.throttle = g.capacity > 0 ? Math.min(1, g.demand / g.capacity) : 1;
    g.prod = g.capacity * g.throttle;
    g.sat = g.tripped ? 0 : (g.demand <= 0 ? 1 : Math.min(1, g.capacity / g.demand));
  }
  G.grids = grids;
}

// ===== 全局电力汇总 =====
// 每 0.25s 复算：先重建电网（各电网独立平衡），再把所有电网汇总成全局 prod/demand/sat
// 供 HUD/统计面板展示。各设备实际运转倍率走 powerFactor(e)（按所属电网，含 20% 下限）。
function updatePower() {
  rebuildPowerGrids();
  let prod = 0, demand = 0;
  const grids = G.grids || [];
  for (const g of grids) { prod += g.prod; demand += g.demand; }
  G.power.prod = prod;
  G.power.demand = demand;
  G.power.sat = demand <= 0 ? 1 : Math.min(1, prod / demand);
}

// ===== 耗电设备状态辅助 =====
// 供各耗电设备的面板“电力”行、状态灯与鼠标悬停提示统一使用，保证“当前耗电状态
// + 是否电量不足 + 是否接入电网”在所有耗电设备上口径一致。
// 判定优先级：未接入电网（缺杆）> 未耗电 > 供电正常 > 电量不足（低效运转）> 缺电停摆。
function powerStatusOf(e) {
  const d = (typeof e.powerDemand === 'function') ? (e.powerDemand() || 0) : 0;
  const sat = powerSatOf(e);
  const unconnected = (e._grid === null);
  let text, color;
  if (unconnected) { text = '未接入电网：需位于电线杆供电范围内'; color = 'r'; }
  else if (d <= 0) { text = '未耗电'; color = 'g'; }
  else if (sat >= 1) { text = '耗电 ' + d.toFixed(1) + ' · 供电正常'; color = 'g'; }
  else if (sat > 0) { text = '耗电 ' + d.toFixed(1) + ' · 电量不足 ' + Math.round(sat * 100) + '%（低效率运转 ≥' + Math.round(MIN_POWER_SAT * 100) + '%）'; color = 'y'; }
  else { text = '耗电 ' + d.toFixed(1) + ' · 已缺电停摆'; color = 'r'; }
  return { d, sat, text, color, consuming: d > 0, unconnected };
}

// 面板“电力”行的 live 值（供各设备 panel 的 api.set('power', ...) 复用）
function powerStatusLiveHtml(e) {
  const s = powerStatusOf(e);
  if (s.unconnected) return '<span style="color:#ff5b5b">未接入电网（需电线杆覆盖）</span>';
  if (s.d <= 0) return dimSpan('未耗电');
  if (s.sat >= 1) return '耗电 ' + s.d.toFixed(1) + ' · 供电正常';
  if (s.sat > 0) return '耗电 ' + s.d.toFixed(1) + ' · <span style="color:#ffd23c">电量不足 ' +
    Math.round(s.sat * 100) + '%</span>';
  return '耗电 ' + s.d.toFixed(1) + ' · <span style="color:#ff5b5b">已缺电停摆</span>';
}

// ===== 渲染：电网电力线（杆与杆之间的黄色输电线，区别于红/绿电路信号线）=====
// 由 rebuildPowerGrids 记录的 _pwires 邻接绘制；只向“坐标更大”的邻居画，避免重复。
function drawPowerWires(ctx, e) {
  if (!e._pwires || !e._pwires.length) return;
  const selfKey = entKey(e.x, e.y);
  const cx = pcx(e) * TILE, cy = pcy(e) * TILE;
  const lw = 2 / Math.max(0.5, G.cam.z);
  for (const o of e._pwires) {
    if (entKey(o.x, o.y) <= selfKey) continue;
    const ox = pcx(o) * TILE, oy = pcy(o) * TILE;
    ctx.strokeStyle = '#d8c24a';
    ctx.lineWidth = lw;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.quadraticCurveTo((cx + ox) / 2, (cy + oy) / 2 + Math.abs(ox - cx) * 0.08, ox, oy);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
