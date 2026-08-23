'use strict';

// =====================================================================
// 统计模块：为“统计面板”提供数据源与渲染。
// 包含三个可切换页面：
//   1) 物品生成与消耗速率（最近 2 秒滑动平均 + 累计量）
//   2) 电量：产生/消耗/净额/饱和度 + 各发电与耗电设备功率明细
//   3) 性能分析：帧率/单帧耗时/实体数/格子数/地形离屏缓存/缩放级别
// 统计面板在打开期间由 main loop 实时刷新。
// =====================================================================

// ---- 物品生成/消耗速率追踪 ----
// 记录每个物品的增减事件，用最近 2 秒滑动窗口计算速率；同时累计总量。
const PROD_WINDOW = 2.0;              // 滑动平均窗口（秒）
const PROD = {
  total: {},                          // item -> 累计净增减
  gained: {},                         // item -> 累计生成量
  lost: {},                           // item -> 累计消耗量
  events: []                          // [{t, item, delta}]（按时间递增）
};

// 任意物品增减均在此记录：delta>0 表示生成，delta<0 表示消耗。
function trackProd(item, delta) {
  if (!item || !delta) return;
  const now = G.time;
  while (PROD.events.length && now - PROD.events[0].t > PROD_WINDOW) PROD.events.shift();
  if (delta > 0) PROD.gained[item] = (PROD.gained[item] || 0) + delta;
  else PROD.lost[item] = (PROD.lost[item] || 0) - delta;
  PROD.total[item] = (PROD.total[item] || 0) + delta;
  PROD.events.push({ t: now, item, delta });
}

// 计算某物品最近 2 秒内净速率（生成+，消耗-，单位/秒）。
function prodNetRate(item) {
  let sum = 0;
  for (const ev of PROD.events) if (ev.item === item) sum += ev.delta;
  return sum / PROD_WINDOW;
}

// 某物品最近 2 秒内的生成速率（单位/秒，仅计生成事件）。
function prodGainRate(item) {
  let sum = 0;
  for (const ev of PROD.events) if (ev.item === item && ev.delta > 0) sum += ev.delta;
  return sum / PROD_WINDOW;
}

// 某物品最近 2 秒内的消耗速率（单位/秒，取正值，仅计消耗事件）。
function prodLossRate(item) {
  let sum = 0;
  for (const ev of PROD.events) if (ev.item === item && ev.delta < 0) sum += -ev.delta;
  return sum / PROD_WINDOW;
}

// 所有有活动记录的物品 id（按名称排序）
function prodActiveItems() {
  const ids = Object.keys(PROD.total || {});
  return ids;
}

// ---- 电力统计 ----
// 汇总发电设备（powerOut>0）与耗电设备（powerDemand()>0）明细。
function powerSummary() {
  const producers = [];
  const consumers = [];
  let prod = 0, demand = 0;
  for (const e of G.ents) {
    const po = e.powerOut || 0;
    if (po > 0) { producers.push({ e, v: po }); prod += po; }
    if (typeof e.powerDemand === 'function') {
      const d = e.powerDemand();
      if (d > 0) { consumers.push({ e, v: d }); demand += d; }
    }
  }
  return { prod, demand, net: prod - demand, sat: G.power.sat, producers, consumers };
}

// ---- 性能数据 ----
// 帧率 / 单帧耗时由 main loop 每帧更新到 G.stats。
// 地形离屏缓存状态由 render.js 维护到 terrainCacheStats。
const PERF = {
  fps: 60,
  frameMs: 0,
  ents: 0,
  tiles: 0,
  cacheState: '—',
  cacheRebuildMs: 0,
  zoom: 1
};

// 读取/刷新性能指标（每次渲染面板时调用）
function refreshPerf() {
  PERF.fps = Math.round(fpsSmooth || 60);
  PERF.frameMs = fpsSmooth > 0 ? (1000 / fpsSmooth) : 0;
  PERF.ents = G.ents.length;
  PERF.zoom = G.cam.z;
  if (typeof terrainCacheStats === 'object') {
    PERF.cacheState = terrainCacheStats.state || '—';
    PERF.cacheRebuildMs = terrainCacheStats.rebuildMs || 0;
  }
  // 已加载地形格子数（世界缓存中的 chunk 数量换算）
  PERF.tiles = (G.world && G.world.chunks) ? (G.world.chunks.size || 0) * (CHUNK * CHUNK) : 0;
}

// ---- 统计面板 HTML ----
const STAT_TABS = [['items', '物品速率'], ['power', '电量'], ['perf', '性能']];

function htmlStats() {
  let h = '<div class="stat-tabs">';
  for (const [k, label] of STAT_TABS) {
    h += '<button class="stat-tab' + (G.statsTab === k ? ' active' : '') + '" data-stat-tab="' + k + '">' + label + '</button>';
  }
  h += '</div>';
  if (G.statsTab === 'items') h += htmlStatsItems();
  else if (G.statsTab === 'power') h += htmlStatsPower();
  else h += htmlStatsPerf();
  return h;
}

// 物品速率页：下方再分两个 tab——生产速率（物品被产出）与消耗（物品被消耗）。
// 展示的是物品自身的产生/消耗速率，而非设备的产能。
function htmlStatsItems() {
  const all = prodActiveItems().sort((a, b) => (ITEMS[a].name < ITEMS[b].name ? -1 : 1));
  const tab = G.statsItemTab === 'cons' ? 'cons' : 'prod';
  const isProd = tab === 'prod';

  let h = '<div class="sec">物品速率 <span class="dim">（最近 ' + PROD_WINDOW + ' 秒滑动平均）</span></div>';
  h += '<div class="stat-subtabs">';
  h += '<button class="stat-subtab' + (isProd ? ' active' : '') + '" data-stat-item-tab="prod">生产速率</button>';
  h += '<button class="stat-subtab' + (!isProd ? ' active' : '') + '" data-stat-item-tab="cons">消耗</button>';
  h += '</div>';

  // 只列出本 tab 有活动的物品
  const items = all.filter(id =>
    isProd ? ((PROD.gained[id] || 0) > 0) : ((PROD.lost[id] || 0) > 0));

  if (!items.length) {
    h += '<div class="dim">暂无' + (isProd ? '生产' : '消耗') + '活动记录。挖矿、合成、建造/拆除等产生的物品增减会在此实时统计。</div>';
    return h;
  }

  if (isProd) {
    h += '<div class="stat-table"><div class="stat-head"><span>物品</span><span>生产速率/秒</span><span>累计产出</span></div>';
    for (const id of items) {
      const rate = prodGainRate(id);
      h += '<div class="stat-row">';
      h += '<span>' + chip(id) + '</span>';
      h += '<span style="color:#8fe08f;font-weight:bold">+' + rate.toFixed(2) + '</span>';
      h += '<span class="dim">+' + (PROD.gained[id] || 0).toFixed(0) + '</span>';
      h += '</div>';
    }
    h += '</div>';
  } else {
    h += '<div class="stat-table"><div class="stat-head"><span>物品</span><span>消耗速率/秒</span><span>累计消耗</span></div>';
    for (const id of items) {
      const rate = prodLossRate(id);
      h += '<div class="stat-row">';
      h += '<span>' + chip(id) + '</span>';
      h += '<span style="color:#ff8a7a;font-weight:bold">−' + rate.toFixed(2) + '</span>';
      h += '<span class="dim">−' + (PROD.lost[id] || 0).toFixed(0) + '</span>';
      h += '</div>';
    }
    h += '</div>';
  }
  h += '<div class="dim">生产速率为物品被产出的速率，消耗速率为物品被消耗的速率（均按最近 2 秒滑动平均，非设备产能）。累计为最近游戏进行中的总量。</div>';
  return h;
}

// 电量页
function htmlStatsPower() {
  const s = powerSummary();
  const satPct = Math.round((s.sat || 0) * 100);
  let h = '<div class="sec">电网概览</div>';
  h += '<div class="stat-table">';
  h += row2('产生', '<span style="color:#8fe08f;font-weight:bold">+' + s.prod.toFixed(1) + '</span>');
  h += row2('消耗', '<span style="color:#ff8a7a;font-weight:bold">−' + s.demand.toFixed(1) + '</span>');
  h += row2('净额', (s.net >= 0 ? '+' : '') + s.net.toFixed(1));
  h += row2('供电饱和度', '<span class="satbar"><i style="width:' + satPct + '%"></i></span> <b>' + satPct + '%</b>');
  h += '</div>';

  h += '<div class="sec">发电设备</div>';
  if (!s.producers.length) h += '<div class="dim">没有正在发电的设备（蒸汽机 / 太阳能板 / 蓄电器放电）。</div>';
  else {
    h += '<div class="stat-table">';
    for (const { e, v } of s.producers) {
      h += '<div class="stat-row"><span>' + chip(e.type) + '<span class="dim2"> @' + e.x + ',' + e.y + '</span></span><span style="color:#8fe08f">+' + v.toFixed(1) + '</span></div>';
    }
    h += '</div>';
  }

  h += '<div class="sec">耗电设备</div>';
  if (!s.consumers.length) h += '<div class="dim">没有正在耗电的设备（电采矿机 / 电炉 / 组装机 II/III / 抽油机 / 炼油厂 / 化工厂）。</div>';
  else {
    h += '<div class="stat-table">';
    for (const { e, v } of s.consumers) {
      h += '<div class="stat-row"><span>' + chip(e.type) + '<span class="dim2"> @' + e.x + ',' + e.y + '</span></span><span style="color:#ffd23c">' + v.toFixed(1) + '</span></div>';
    }
    h += '</div>';
  }
  h += '<div class="dim">各设备功率：发电为正 (+)，耗电为原值；净额 = 产生 − 消耗。供电饱和度 <100% 时用电设备按比例降速。</div>';
  return h;
}

function row2(label, val) {
  return '<div class="stat-row"><span>' + label + '</span><span>' + val + '</span></div>';
}

// 性能页
function htmlStatsPerf() {
  refreshPerf();
  let h = '<div class="sec">性能分析</div>';
  h += '<div class="stat-table">';
  h += row2('帧率 (FPS)', '<b>' + PERF.fps + '</b>');
  h += row2('单帧耗时', PERF.frameMs.toFixed(2) + ' ms');
  h += row2('实体数量', PERF.ents);
  h += row2('地形格子数（已加载块）', PERF.tiles + ' 格（' + (G.world.chunks ? G.world.chunks.size : 0) + ' 块）');
  h += row2('地形离屏缓存状态', PERF.cacheState);
  h += row2('地形缓存最近重建耗时', (PERF.cacheRebuildMs || 0).toFixed(1) + ' ms');
  h += row2('缩放级别', '×' + PERF.zoom.toFixed(2));
  h += '</div>';
  h += '<div class="dim">地形离屏缓存：地形绘到离屏画布，相机未大幅移动时直接整块贴图，避免逐格重算；缓存失效时会重建并记录耗时。</div>';
  return h;
}

// 统计面板实时刷新：由 main loop 每 0.25s 调用一次，重绘当前页面以反映最新数据。
function updateStatsLive() {
  if (G.panelMode !== 'stats') return;
  const body = document.getElementById('panel-body');
  if (!body) return;
  // 仅当当前 tab 渲染内容确实变化时才重绘，避免不必要的 DOM 重建
  if (typeof renderPanel === 'function') renderPanel(false);
}
