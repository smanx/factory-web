'use strict';

// ===== 电力增量注册表（P1 优化）=====
// 维护“可能发电”与“可能耗电”的设备子集，由 addEnt/removeEnt 同步增删。
// updatePower/powerSummary 只扫这两个子集，而不是全量 G.ents。
// 设备是否真正发电/耗电仍由各自的 powerOut()/powerDemand() 实时判定。
function ensurePowerReg() {
  if (!G.powerReg) G.powerReg = { producers: new Set(), consumers: new Set() };
  return G.powerReg;
}
function regPowerEnt(e) {
  if (!e) return;
  const r = ensurePowerReg();
  // 有 powerOut 属性即视为“潜在发电设备”（蒸汽机 / 太阳能板 / 蓄电器等）。
  // 注意：不能以 powerOut!==0 作为入集合条件——发电设备放置/读档时 powerOut
  // 初值都为 0（蒸汽机供汽后、太阳能板天亮后、蓄电器放电时才 >0），若此处排除，
  // 它们就永远不会被注册进 producers，导致 updatePower/powerSummary 扫不到
  // 发电设备：统计面板发电设备为空、G.power.prod 恒为 0、全网误判停电。
  // 实际是否发电由 updatePower/powerSummary 按 powerOut 实时判定（powerOut>0 才算产）。
  if (e.powerOut !== undefined) r.producers.add(e);
  else r.producers.delete(e);
  if (typeof e.powerDemand === 'function') r.consumers.add(e);
  else r.consumers.delete(e);
}
function unregPowerEnt(e) {
  if (!e || !G.powerReg) return;
  G.powerReg.producers.delete(e);
  G.powerReg.consumers.delete(e);
}
function resetPowerReg() {
  G.powerReg = { producers: new Set(), consumers: new Set() };
}

// ===== 异星工厂式“低效率运转”降速模型 =====
// 对齐《异星工厂》：电网供电不足（生产<需求）时，设备不是按比例一直降到趋近于 0、
// 更不是直接停摆，而是有一个最低运转下限（约 20%）。只要电网还有一点电力（sat>0），
// 各用电设备就始终以至少 MIN_POWER_SAT 的比例低效率运转，不会停下来；
// 只有电网完全无电（prod=0，sat=0）时设备才真正停摆。
const MIN_POWER_SAT = 0.2;   // 供电不足时的最低运转比例（对齐异星工厂 20% 下限）

// 返回设备实际应采用的速度倍率：
//   - sat>=1 ：满速 1
//   - 0<sat<1：max(sat, MIN_POWER_SAT)，保证至少以 20% 低效率运转、不会直接停
//   - sat<=0 ：0（完全断电才停摆）
function powerFactor() {
  const sat = G.power ? G.power.sat : 1;
  if (sat >= 1) return 1;
  if (sat > 0) return Math.max(sat, MIN_POWER_SAT);
  return 0;
}

// 全局共享电力模型：每 0.25s 复算。产出 = 运行中蒸汽机的 powerOut 之和，
// 需求 = 各用电设备 powerDemand()（在各自设备文件里定义，闲置时返回 0）之和，
// sat = min(1, prod/demand)，各机器按 powerFactor()（有 20% 下限）比例降速；
// sat=0（完全断电）才全图"缺电"停摆。
function updatePower() {
  let prod = 0, demand = 0;
  const r = ensurePowerReg();
  // 只扫注册过的发电/耗电子集，不再全量遍历 G.ents（P1 优化）
  for (const e of r.producers) { if (!e._dead) prod += e.powerOut || 0; }
  for (const e of r.consumers) { if (!e._dead && e.powerDemand) demand += e.powerDemand(); }
  G.power.prod = prod;
  G.power.demand = demand;
  G.power.sat = demand <= 0 ? 1 : Math.min(1, prod / demand);
}

// ===== 耗电设备状态辅助 =====
// 供各耗电设备的面板“电力”行、状态灯与鼠标悬停提示统一使用，保证“当前耗电状态
// + 是否电量不足”在所有耗电设备上口径一致。
// 电量不足判定：该设备正在耗电（powerDemand>0）且电网饱和度 sat<1。
//   - sat>=1 ：供电正常，满速运行；
//   - 0<sat<1：电量不足，按 powerFactor()（有 20% 下限）低效率运转（黄灯提示）；
//   - sat<=0 ：完全断电才停摆（红灯提示）。
function powerStatusOf(e) {
  const d = (typeof e.powerDemand === 'function') ? (e.powerDemand() || 0) : 0;
  const sat = G.power.sat || 0;
  let text;
  if (d <= 0) text = '未耗电';
  else if (sat >= 1) text = '耗电 ' + d.toFixed(1) + ' · 供电正常';
  else if (sat > 0) text = '耗电 ' + d.toFixed(1) + ' · 电量不足 ' + Math.round(sat * 100) + '%（低效率运转 ≥' + Math.round(MIN_POWER_SAT * 100) + '%）';
  else text = '耗电 ' + d.toFixed(1) + ' · 已缺电停摆';
  // 状态灯颜色：未耗电绿、供电正常绿、电量不足黄、缺电停摆红
  const color = d <= 0 ? 'g' : (sat >= 1 ? 'g' : (sat > 0 ? 'y' : 'r'));
  return { d, sat, text, color, consuming: d > 0 };
}

// 面板“电力”行的 live 值（供各设备 panel 的 api.set('power', ...) 复用）
function powerStatusLiveHtml(e) {
  const s = powerStatusOf(e);
  if (s.d <= 0) return dimSpan('未耗电');
  if (s.sat >= 1) return '耗电 ' + s.d.toFixed(1) + ' · 供电正常';
  if (s.sat > 0) return '耗电 ' + s.d.toFixed(1) + ' · <span style="color:#ffd23c">电量不足 ' +
    Math.round(s.sat * 100) + '%</span>';
  return '耗电 ' + s.d.toFixed(1) + ' · <span style="color:#ff5b5b">已缺电停摆</span>';
}
