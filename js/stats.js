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
// 记录每个物品的增减事件，按“统计间隔”计算速率；同时累计总量。
// 统计间隔可切换：秒 / 10秒 / 分钟 / 小时 / 1天，数据不足时按已有记录时长预估。
// 事件队列需要保留最久（1天）间隔的数据，故不再在写入时按 2 秒剪除，而保留到 1 天。
const PROD_KEEP = 86400;              // 事件队列保留时长（秒）= 最长统计间隔 1 天
const PROD_EVENT_MAX = 200000;        // 事件队列硬上限（防止高吞吐下无限膨胀，P2 优化）
const PROD = {
  total: {},                          // item -> 累计净增减
  gained: {},                         // item -> 累计生成量
  lost: {},                           // item -> 累计消耗量
  events: []                          // [{t, item, delta}]（按时间递增）
};

// ------------------------------------------------------------------
// 历史记录（分桶统计）：把物品的生成/消耗按固定时间窗分桶累加，形成一条
// 时间序列，用于“统计面板 → 物品速率 → 历史”页的折线图展示，并随存档持久化。
//
// 设计要点（兼顾“保留 24 小时”与“存档不膨胀”）：
//   * 内存中保留 1 分钟粒度、最长 24 小时（1440 桶/方向/物品）的环形缓冲，
//     供实时折线图在 10分钟/1小时/6小时/24小时 等多档缩放下查看细节；
//   * 存档时把 1 分钟桶聚合为 1 小时粒度（24 点/方向/物品）再写入，体积极小；
//     读档后再把小时数据填充回环形缓冲，旧时段呈小时均值，新时段继续累计细粒度。
//   * 只记录有过活动的物品，且每个物品只有两个等长数组（生成/消耗），无稀疏空洞。
// ------------------------------------------------------------------
const PROD_HIST_BUCKET = 60;         // 每个历史桶的时长（秒）= 1 分钟
const PROD_HIST_KEEP = 86400;        // 历史保留时长（秒）= 24 小时
const PROD_HIST_COUNT = PROD_HIST_KEEP / PROD_HIST_BUCKET;   // 1440 桶
const PROD_HIST_SAVE_BUCKET = 3600;  // 存档粒度：1 小时（聚合为 24 点/方向/物品）
const PROD_HIST_SAVE_COUNT = PROD_HIST_KEEP / PROD_HIST_SAVE_BUCKET; // 24 点

// 历史数据：
//   data: Map<item, { gain: Float32Array(COUNT), loss: Float32Array(COUNT) }>（环形缓冲）
//   head: 当前最新桶在环形数组中的下标
//   curBucketId: 当前正在累加的桶序号（floor(G.time/BUCKET)），用于判断是否换桶
//   loadedAt: 最近一次读档注入小时数据的时刻，用于标记旧段为小时均值（见 histFill 注释）
const PROD_HIST = {
  data: new Map(),
  head: 0,
  curBucketId: -1,
  loadedAt: 0
};

// 历史折线图视图档位：{ label, sec }——每档对应折线图横轴跨度。
const HIST_ZOOMS = [
  { label: '10分钟', sec: 600 },
  { label: '1小时', sec: 3600 },
  { label: '6小时', sec: 21600 },
  { label: '24小时', sec: 86400 }
];
// 折线图最多画多少个点（数据点更多时按比例抽稀，控制渲染开销）。
const HIST_MAX_POINTS = 180;

// 历史页当前选中物品（在 htmlStatsItems 里渲染时默认取最近活动物品）
// 存在 G.statsHistItem；不存在时动态选择。
function histSelectedItem() {
  if (G.statsHistItem && PROD_HIST.data.has(G.statsHistItem)) return G.statsHistItem;
  // 选最近一次有活动（按总生成+消耗之和）的物品
  let best = null, bestScore = -1;
  for (const [id, h] of PROD_HIST.data) {
    const score = (PROD.gained[id] || 0) + (PROD.lost[id] || 0);
    if (score > bestScore) { bestScore = score; best = id; }
  }
  return best;
}

// 把某物品某方向的一个增量累加进“当前桶”。direction：+1 生成 / -1 消耗。
// gain 与 loss 均以正数存储（loss 为消耗量绝对值），便于折线图与存档。
function histAccum(item, delta, direction) {
  let h = PROD_HIST.data.get(item);
  if (!h) {
    h = { gain: new Float32Array(PROD_HIST_COUNT), loss: new Float32Array(PROD_HIST_COUNT) };
    PROD_HIST.data.set(item, h);
  }
  const arr = direction > 0 ? h.gain : h.loss;
  arr[PROD_HIST.head] += Math.abs(delta);
}

// 确保环形缓冲已推进到“当前桶”。每次调用把游标推进到 G.time 对应的桶，
// 并为跨过的空桶清零（过期桶直接丢弃，实现“最多保留 24 小时”）。
function histTick(now) {
  const bucketId = Math.floor(now / PROD_HIST_BUCKET);
  if (bucketId === PROD_HIST.curBucketId) return;
  if (PROD_HIST.curBucketId < 0) {
    // 首次：初始化当前桶，其余桶为空
    PROD_HIST.curBucketId = bucketId;
    PROD_HIST.head = bucketId % PROD_HIST_COUNT;
    return;
  }
  // 推进若干桶（正常推进 1 桶；长时间暂停/大 dt 可能一次跨多桶）
  let step = bucketId - PROD_HIST.curBucketId;
  if (step > PROD_HIST_COUNT) step = PROD_HIST_COUNT;   // 超过环形长度则整环丢弃
  for (let k = 0; k < step; k++) {
    PROD_HIST.head = (PROD_HIST.head + 1) % PROD_HIST_COUNT;
    // 清空新到桶（丢弃最旧数据）
    for (const h of PROD_HIST.data.values()) {
      h.gain[PROD_HIST.head] = 0;
      h.loss[PROD_HIST.head] = 0;
    }
  }
  // 整环跳过（游戏暂停很久）时直接把所有桶清零，从头累计
  if (step >= PROD_HIST_COUNT) {
    for (const h of PROD_HIST.data.values()) { h.gain.fill(0); h.loss.fill(0); }
  }
  PROD_HIST.curBucketId = bucketId;
}

// 取某物品在 [now-zoomSec, now] 区间内的历史序列（环形缓冲 → 时间升序数组）。
// 返回 { ids, gain, loss, t0, t1 }，ids 为每个点的实际桶序号（绝对），
// gain/loss 为对应的生成/消耗累计（消耗为正值）。
function histSeries(item, zoomSec) {
  const h = PROD_HIST.data.get(item);
  if (!h) return null;
  const now = G.time;
  histTick(now);
  const win = Math.min(zoomSec, PROD_HIST_KEEP);
  const nBuckets = Math.max(1, Math.min(Math.ceil(win / PROD_HIST_BUCKET), PROD_HIST_COUNT));
  // 覆盖的桶序号范围（绝对）：[startId, endId]
  const endId = PROD_HIST.curBucketId;
  const startId = endId - nBuckets + 1;
  const ids = [], gain = [], loss = [];
  for (let id = startId; id <= endId; id++) {
    const idx = ((id % PROD_HIST_COUNT) + PROD_HIST_COUNT) % PROD_HIST_COUNT;
    ids.push(id);
    gain.push(h.gain[idx]);
    loss.push(h.loss[idx]);
  }
  return { ids, gain, loss };
}

// 把一串原始桶序列抽稀为至多 maxPts 个点（按跨度均值聚合），供折线图绘制。
function histDownsample(ids, gain, loss, maxPts) {
  if (ids.length <= maxPts) return { ids, gain, loss };
  const step = Math.ceil(ids.length / maxPts);
  const outIds = [], outGain = [], outLoss = [];
  for (let s = 0; s < ids.length; s += step) {
    const e = Math.min(s + step, ids.length);
    let g = 0, l = 0, c = 0;
    for (let i = s; i < e; i++) { g += gain[i]; l += loss[i]; c++; }
    outIds.push(ids[(s + e - 1) >> 1]);
    outGain.push(g / c);
    outLoss.push(l / c);
  }
  return { ids: outIds, gain: outGain, loss: outLoss };
}

// ---- 历史持久化 ----
// 把内存中 1 分钟环形缓冲聚合成“小时序列”，供存档写入（体积极小）。
// 返回 { t0: 最早小时序号, data: { item: [gain0, loss0, gain1, loss1, ...] } }
function histSerialize() {
  const now = G.time;
  histTick(now);
  const data = {};
  let hasData = false;
  const curHourId = Math.floor(now / PROD_HIST_SAVE_BUCKET);
  const startHour = curHourId - PROD_HIST_SAVE_COUNT + 1;
  for (const [item, h] of PROD_HIST.data) {
    // 24 个小时点 × (gain,loss)
    const arr = new Array(PROD_HIST_SAVE_COUNT * 2);
    let any = false;
    for (let s = 0; s < PROD_HIST_SAVE_COUNT; s++) {
      const hourId = startHour + s;
      let g = 0, l = 0;
      // 该小时内的分钟桶（环形下标）；用绝对分钟序号 nowMin 封顶，避免读到“未来”桶
      const nowMin = Math.floor(now / PROD_HIST_BUCKET);
      const firstMin = Math.max(hourId * 60, nowMin - PROD_HIST_COUNT + 1);
      const lastMin = Math.min(hourId * 60 + 59, nowMin);
      for (let m = firstMin; m <= lastMin; m++) {
        const idx = ((m % PROD_HIST_COUNT) + PROD_HIST_COUNT) % PROD_HIST_COUNT;
        g += h.gain[idx]; l += h.loss[idx];
      }
      arr[s * 2] = Math.round(g);
      arr[s * 2 + 1] = Math.round(l);
      if (g || l) any = true;
    }
    if (any) {
      data[item] = arr;
      hasData = true;
    }
  }
  if (!hasData) return null;
  return { t0: startHour, t1: curHourId, data };
}

// 从存档恢复历史：把小时序列展开回 1 分钟环形缓冲（旧段为小时均值），
// 并推进到当前桶，后续实时累计继续细粒度。
function histDeserialize(saved) {
  if (!saved || !saved.data) return;
  const now = G.time;
  const curHourId = Math.floor(now / PROD_HIST_SAVE_BUCKET);
  const startHour = curHourId - PROD_HIST_SAVE_COUNT + 1;
  // 记录读档时刻，用于图表区分“小时均值”旧段与实时细粒度段
  PROD_HIST.loadedAt = now;
  for (const item of Object.keys(saved.data)) {
    const arr = saved.data[item];
    let h = PROD_HIST.data.get(item);
    if (!h) {
      h = { gain: new Float32Array(PROD_HIST_COUNT), loss: new Float32Array(PROD_HIST_COUNT) };
      PROD_HIST.data.set(item, h);
    }
    for (let s = 0; s < PROD_HIST_SAVE_COUNT; s++) {
      const hourId = startHour + s;
      const g = arr[s * 2] || 0, l = arr[s * 2 + 1] || 0;
      if (!g && !l) continue;
      // 把该小时的均值均匀填入该小时内每一分钟桶（只填到当前分钟，不填未来桶）
      const nowMin = Math.floor(now / PROD_HIST_BUCKET);
      const firstMin = Math.max(hourId * 60, nowMin - PROD_HIST_COUNT + 1);
      const lastMin = Math.min(hourId * 60 + 59, nowMin);
      const cnt = Math.max(1, lastMin - firstMin + 1);
      const perG = g / cnt, perL = l / cnt;
      for (let m = firstMin; m <= lastMin; m++) {
        const idx = ((m % PROD_HIST_COUNT) + PROD_HIST_COUNT) % PROD_HIST_COUNT;
        h.gain[idx] = perG;
        h.loss[idx] = perL;
      }
    }
  }
  // 推进到当前桶（把游标与当前分钟桶对齐）
  histTick(now);
}

// 重置历史（新游戏时清空）
function histReset() {
  PROD_HIST.data = new Map();
  PROD_HIST.head = 0;
  PROD_HIST.curBucketId = -1;
  PROD_HIST.loadedAt = 0;
}

// 任意物品增减的入口：实时速率 + 历史分桶一并记录。
function trackProd(item, delta) {
  if (!item || !delta) return;
  const now = G.time;
  // 历史分桶累计（实时）
  histTick(now);
  histAccum(item, delta, delta > 0 ? 1 : -1);
  // 事件队列：按 1 天窗口剪除过期头部 + 硬上限防无限膨胀（用于“当前速率”窗口计算）
  while (PROD.events.length && now - PROD.events[0].t > PROD_KEEP) PROD.events.shift();
  if (PROD.events.length > PROD_EVENT_MAX) PROD.events.splice(0, PROD.events.length - PROD_EVENT_MAX);
  if (delta > 0) PROD.gained[item] = (PROD.gained[item] || 0) + delta;
  else PROD.lost[item] = (PROD.lost[item] || 0) - delta;
  PROD.total[item] = (PROD.total[item] || 0) + delta;
  PROD.events.push({ t: now, item, delta });
  // 成就：累计正向产出（对齐《异星工厂》生产成就），并触发成就判定
  if (typeof achTrackProduced === 'function' && delta > 0) achTrackProduced(item, delta);
}

// 统计间隔选项：label 显示名，unit 速率单位，sec 窗口秒数。
const STAT_INTERVALS = [
  { label: '秒', unit: '/秒', sec: 1 },
  { label: '10秒', unit: '/10秒', sec: 10 },
  { label: '分钟', unit: '/分钟', sec: 60 },
  { label: '小时', unit: '/小时', sec: 3600 },
  { label: '1天', unit: '/1天', sec: 86400 }
];

// 当前选中的统计间隔（秒），默认“秒”。
function statIntervalSec() { return STAT_INTERVALS[G.statsInterval] ? STAT_INTERVALS[G.statsInterval].sec : 1; }
function statIntervalLabel() { return STAT_INTERVALS[G.statsInterval] ? STAT_INTERVALS[G.statsInterval].label : '秒'; }
// 当前选中的统计间隔对应的速率单位（如 /秒、/10秒、/分钟……）。
function statIntervalUnit() { return STAT_INTERVALS[G.statsInterval] ? STAT_INTERVALS[G.statsInterval].unit : '/秒'; }

// 取某物品最近 intervalSec 秒内事件的总和（可限定方向）。
// dir：1=仅生成(+)、-1=仅消耗(-)、0=全部；返回 { sum, span }：
//   sum 为筛选后增量总和（消耗方向取正值），span 为速率分母（秒）。
// 若窗口内无符合方向的事件，span 取 0，由调用方判定数据不足；
// 若统计至今的总时长不足所选间隔（数据不够），则以总时长作为分母“预估”速率。
function prodWindow(item, intervalSec, dir) {
  const now = G.time;
  const cutoff = now - intervalSec;
  let sum = 0;
  for (const ev of PROD.events) {
    if (ev.item !== item) continue;
    if (ev.t <= cutoff) continue;      // 窗口 (cutoff, now]，排除边界
    if (dir > 0 && ev.delta <= 0) continue;
    if (dir < 0 && ev.delta >= 0) continue;
    sum += dir < 0 ? -ev.delta : ev.delta;
  }
  if (!sum) return { sum: 0, span: 0 };
  // 速率分母：数据充足时用完整间隔 intervalSec。
  // 若统计至今总时长（整个事件队列最早 → now）不足所选间隔，则以该总时长“预估”；
  // 总时长过小（≈0，如统计刚开始第一条事件）时回退用 intervalSec，避免除零导致速率虚高。
  const globalFirst = PROD.events.length ? PROD.events[0].t : now;
  const histLen = now - globalFirst;
  const span = (histLen >= 0.01 && histLen < intervalSec) ? histLen : intervalSec;
  return { sum, span };
}

// 计算某物品最近 intervalSec 秒内净速率（生成+，消耗-，单位/秒）。
function prodNetRate(item) {
  const w = prodWindow(item, statIntervalSec(), 0);
  return w.span ? w.sum / w.span : 0;
}

// 某物品最近 intervalSec 秒内的生成速率（单位/秒，仅计生成事件）。
function prodGainRate(item) {
  const w = prodWindow(item, statIntervalSec(), 1);
  return w.span ? w.sum / w.span : 0;
}

// 某物品最近 intervalSec 秒内的消耗速率（单位/秒，取正值，仅计消耗事件）。
function prodLossRate(item) {
  const w = prodWindow(item, statIntervalSec(), -1);
  return w.span ? w.sum / w.span : 0;
}

// 将每秒速率折算为当前统计间隔单位下的速率（如 /秒、/10秒、/分钟……）。
function prodGainRatePerInterval(item) { return prodGainRate(item) * statIntervalSec(); }
function prodLossRatePerInterval(item) { return prodLossRate(item) * statIntervalSec(); }

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
  // 只扫电力增量注册子集（P1 优化），避免全量遍历 G.ents
  const reg = (typeof ensurePowerReg === 'function') ? ensurePowerReg() : null;
  const iter = reg ? [...reg.producers, ...reg.consumers] : G.ents;
  const seen = new Set();
  for (const e of iter) {
    if (e._dead || seen.has(e)) continue;
    seen.add(e);
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
  activeEnts: 0,
  staticEnts: 0,
  updateMs: 0,          // 每帧所有活跃实体 update 的总耗时（逻辑帧开销），由 main loop 写入
  logicTickMs: 0,       // 逻辑帧单帧耗时估算（update 耗时 + 调度/电力/物流等系统耗时）
  tiles: 0,
  cacheState: '—',
  cacheRebuildMs: 0,
  zoom: 1,
  lodState: '—',
  devices: []           // 按类型统计的设备，[ { type, name, n, active } ]，按数量降序
};

// 按设备类型统计实体数量，用于判断哪类设备对帧数/逻辑帧影响最大。
// 活跃实体（有自定义 update，每帧执行逻辑）直接影响逻辑帧开销；
// 静态实体（继承基类空 update）不逐帧跑逻辑，只影响渲染/内存。
// 返回按数量降序的数组，只在每次统计时生成一次，供渲染层复用。
function countDevices() {
  const map = {};
  let active = 0, staticN = 0;
  for (const e of G.ents) {
    if (e._dead) continue;
    const activeN = (typeof e.update === 'function' && e.update !== Entity.prototype.update);
    if (activeN) active++; else staticN++;
    const k = e.type;
    const rec = map[k];
    if (rec) { rec.n++; if (activeN) rec.active++; }
    else map[k] = { type: k, name: (ITEMS[k] && ITEMS[k].name) ? ITEMS[k].name : k, n: 1, active: activeN ? 1 : 0 };
  }
  const arr = Object.keys(map).map(k => map[k]);
  arr.sort((a, b) => (b.n - a.n) || (a.name < b.name ? -1 : 1));
  return { arr, active, staticN };
}

// 读取/刷新性能指标（每次渲染面板时调用）
function refreshPerf() {
  PERF.fps = Math.round(fpsSmooth || 60);
  PERF.frameMs = fpsSmooth > 0 ? (1000 / fpsSmooth) : 0;
  // 只统计存活实体（墓碑惰性清理期间不计入已拆除的）
  PERF.ents = G.ents.filter(e => !e._dead).length;
  PERF.zoom = G.cam.z;
  const dev = countDevices();
  PERF.devices = dev.arr;
  PERF.activeEnts = dev.active;
  PERF.staticEnts = dev.staticN;
  PERF.lodState = (typeof LOD === 'object' && LOD) ? (LOD.simple ? '简化（瓦片 ' + LOD.tilePx.toFixed(1) + 'px < ' + LOD_SIMPLE_PX + 'px）' : '完整') : '—';
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

// 展示的是物品自身的产生/消耗速率，而非设备的产能。
function itemName(id) { return (ITEMS[id] && ITEMS[id].name) ? ITEMS[id].name : id; }

// 历史页 zoom 档位索引：避免 0（10分钟）被 `||` 误判为空而回退到 24 小时（P0 bug）。
function histZoomIdx() {
  const i = G.statsHistZoom;
  return (i === undefined || i === null) ? 3 : i;
}

// 历史页：下面再分 生产 / 消耗 两个子 tab，分别展示对应方向的折线；
// 物品选择为同一输入框（可输入筛选，也可从 datalist 下拉直接选择）；
// 折线图下方有列表，列出各物品在所选档位内的数据。
function htmlStatsHist(all) {
  const items = all.filter(id => PROD_HIST.data.has(id));
  if (!items.length) {
    return '<div class="dim">暂无历史记录。生产/消耗活动会以 1 分钟粒度保留最近 24 小时，并随存档保存。生成 / 消耗的物品增减即在此累计。</div>';
  }
  const sub = (G.statsHistSub === 'cons') ? 'cons' : 'prod';
  const isProd = sub === 'prod';

  // 默认选中物品
  let sel = histSelectedItem();
  if (!sel || !items.includes(sel)) sel = items[0];
  const zoomIdx = histZoomIdx();
  const zoom = HIST_ZOOMS[zoomIdx] || HIST_ZOOMS[HIST_ZOOMS.length - 1];

  // 快速筛选关键字：若已设置，则把默认选中项收敛到匹配关键字的第一项（避免下拉为空）
  const kw = (G.statsHistFilter || '').trim().toLowerCase();
  if (kw) {
    const match = id => (itemName(id).toLowerCase().indexOf(kw) >= 0 || id.toLowerCase().indexOf(kw) >= 0);
    if (!match(sel)) {
      const first = items.find(match);
      if (first) sel = first;
    }
  }

  let h = '';
  // 历史子 tab：生产 / 消耗
  h += '<div class="stat-subtabs">';
  h += '<button class="stat-subtab' + (isProd ? ' active' : '') + '" data-stat-hist-sub="prod">生产</button>';
  h += '<button class="stat-subtab' + (!isProd ? ' active' : '') + '" data-stat-hist-sub="cons">消耗</button>';
  h += '</div>';

  // 物品选择：同一输入框，可输入名称筛选，也可从下拉直接选择
  h += '<div class="dim" style="margin-bottom:4px">选择物品（最近 24 小时，1 分钟粒度）：</div>';
  h += '<input class="stat-hist-filter" data-stat-hist-filter list="stat-hist-dl" type="text" placeholder="输入名称筛选，或从下拉选择物品" autocomplete="off" value="' + ((G.statsHistFilter && G.statsHistFilter.trim()) ? G.statsHistFilter : itemName(sel)) + '">';
  h += '<datalist id="stat-hist-dl">';
  for (const id of items) {
    const nm = itemName(id);
    if (kw && nm.toLowerCase().indexOf(kw) < 0 && id.toLowerCase().indexOf(kw) < 0) continue;
    h += '<option value="' + nm + '"></option>';
  }
  h += '</datalist>';

  // 时间档位切换
  h += '<div class="stat-intervals stat-hist-zooms">';
  for (let i = 0; i < HIST_ZOOMS.length; i++) {
    h += '<button class="stat-interval' + (zoomIdx === i ? ' active' : '') + '" data-stat-hist-zoom="' + i + '">' + HIST_ZOOMS[i].label + '</button>';
  }
  h += '</div>';

  h += '<canvas class="stat-hist-canvas" data-stat-hist-canvas width="480" height="180"></canvas>';
  h += '<div class="stat-hist-legend">';
  if (isProd) h += '<span class="legend-gain">▬ 生产</span>';
  else h += '<span class="legend-loss">▬ 消耗</span>';
  h += '<span class="dim" data-stat-hist-sum"></span>';
  h += '</div>';
  h += '<div class="dim">折线为所选时间档位内每分钟（超出时按均值抽稀）的' + (isProd ? '生产' : '消耗') + '量。历史保留最近 24 小时并随存档保存；读档后旧时段为小时均值，此后实时累计。</div>';

  // 渲染图表（内联脚本在面板 DOM 就绪后调用）
  setTimeout(function () {
    const cv = document.querySelector('[data-stat-hist-canvas]');
    if (cv && typeof renderHistChart === 'function') renderHistChart(cv, sel, zoom.sec, sub);
  }, 0);

  // 折线图下方：各物品数据列表
  h += histDataList(items, zoom.sec, isProd);

  // 让 updateStatsLive 能刷新数值汇总（无则忽略）
  if (!window.__histLast) window.__histLast = {};
  window.__histLast.item = sel;
  window.__histLast.zoom = zoom.sec;
  window.__histLast.dir = sub;
  return h;
}

// 历史页折线图下方的列表：列出各物品在所选档位内的累计生产 / 消耗数据。
// 生产子 tab 按生产量降序，消耗子 tab 按消耗量降序；并高亮当前选中物品。
function histDataList(items, zoomSec, isProd) {
  const rows = [];
  for (const id of items) {
    const t = histItemTotals(id, zoomSec);
    if (!t) continue;
    if ((isProd && t.gain <= 0) || (!isProd && t.loss <= 0)) continue;
    rows.push({ id, gain: t.gain, loss: t.loss });
  }
  if (!rows.length) {
    return '<div class="sec" style="margin-top:8px">物品明细</div>' +
      '<div class="dim">该档位内暂无' + (isProd ? '生产' : '消耗') + '记录。</div>';
  }
  rows.sort((a, b) => (isProd ? b.gain - a.gain : b.loss - a.loss));
  const selId = histSelectedItem();
  let h = '<div class="sec" style="margin-top:8px">物品明细（' + (isProd ? '生产' : '消耗') + '）</div>';
  h += '<div class="stat-table">';
  h += '<div class="stat-head"><span>物品</span><span>生产</span><span>消耗</span></div>';
  for (const r of rows) {
    const hl = r.id === selId ? ' style="background:rgba(87,227,137,.08)"' : '';
    h += '<div class="stat-row"' + hl + '>';
    h += '<span>' + chip(r.id) + '</span>';
    h += '<span style="color:#8fe08f">+' + fmtNum(r.gain) + '</span>';
    h += '<span style="color:#ff8a7a">−' + fmtNum(r.loss) + '</span>';
    h += '</div>';
  }
  h += '</div>';
  h += '<div class="dim">列表为各物品在所选时间档位内的累计生产 / 消耗量（分钟粒度）。</div>';
  return h;
}

// 计算某物品在 [now-zoomSec, now] 区间内的累计生产/消耗量。
function histItemTotals(id, zoomSec) {
  const s = histSeries(id, zoomSec);
  if (!s) return null;
  let g = 0, l = 0;
  for (let i = 0; i < s.gain.length; i++) { g += s.gain[i]; l += s.loss[i]; }
  return { gain: g, loss: l };
}

// 历史页：在“名称筛选”输入框打字时，记录筛选关键字（datalist 会自动过滤下拉项）。
// 不重建面板、不抢焦点；当输入内容精确匹配某个物品名时立即选中并重绘图表。
function applyStatsHistFilter(filter) {
  G.statsHistFilter = filter;
  // 输入内容精确匹配某物品名 → 视为“直接选择”
  const name = (filter || '').trim();
  if (!name) return;
  for (const [id] of PROD_HIST.data) {
    if (itemName(id) === name) {
      if (G.statsHistItem !== id) {
        G.statsHistItem = id;
        G.statsHistFilter = '';
        renderPanel(false);
      }
      return;
    }
  }
}

// 历史页：从 datalist 下拉选中物品（change 事件）——按输入值匹配物品并重绘图表。
function statsHistPickFiltered() {
  const body = document.getElementById('panel-body');
  if (!body) return;
  const inp = body.querySelector('[data-stat-hist-filter]');
  if (!inp) return;
  const name = (inp.value || '').trim();
  if (!name) return;
  for (const [id] of PROD_HIST.data) {
    if (itemName(id) === name) {
      G.statsHistItem = id;
      G.statsHistFilter = '';
      renderPanel(false);
      return;
    }
  }
}

// 在 Canvas 上绘制历史折线图。
// dir：'both'（默认，生产+消耗两条线）/ 'prod'（仅生产）/ 'cons'（仅消耗）。
function renderHistChart(cv, item, zoomSec, dir) {
  const s = histSeries(item, zoomSec);
  if (!s) return;
  dir = dir || 'both';
  const showGain = dir !== 'cons';
  const showLoss = dir !== 'prod';
  // 抽稀到至多 HIST_MAX_POINTS 个点
  const d = histDownsample(s.ids, s.gain, s.loss, HIST_MAX_POINTS);
  const W = cv.width, H = cv.height;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const padL = 34, padR = 10, padT = 8, padB = 18;
  const pw = W - padL - padR, ph = H - padT - padB;
  // 计算 Y 轴最大值（只取需要绘制的方向）
  let max = 0;
  for (let i = 0; i < d.gain.length; i++) {
    if (showGain) max = Math.max(max, d.gain[i]);
    if (showLoss) max = Math.max(max, d.loss[i]);
  }
  // 顶部留 10% 空间
  const yMax = max > 0 ? max * 1.1 : 1;

  // 背景网格
  ctx.strokeStyle = 'rgba(255,255,255,.08)';
  ctx.fillStyle = '#8fa0b5';
  ctx.font = '10px sans-serif';
  ctx.lineWidth = 1;
  const gridLines = 4;
  for (let g = 0; g <= gridLines; g++) {
    const y = padT + (ph * g / gridLines);
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke();
    const val = yMax * (1 - g / gridLines);
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    ctx.fillText(fmtNum(val), padL - 4, y);
  }
  // 时间轴标注（首/中/末）
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  const zoomLabel = HIST_ZOOMS.find(z => z.sec === zoomSec) || { label: '' };
  ctx.fillText('← ' + zoomLabel.label + '前', padL, H - padB + 2);
  ctx.fillText('现在', W - padR, H - padB + 2);

  // 折线
  function line(pts, color) {
    if (!pts.length) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const x = padL + (pts[i].x * pw);
      const y = padT + ph - (pts[i].v / yMax) * ph;
      if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
    // 端点小圆点
    ctx.fillStyle = color;
    for (let i = 0; i < pts.length; i += Math.max(1, (pts.length / 40) | 0)) {
      const x = padL + (pts[i].x * pw);
      const y = padT + ph - (pts[i].v / yMax) * ph;
      ctx.beginPath(); ctx.arc(x, y, 1.4, 0, Math.PI * 2); ctx.fill();
    }
  }
  const n = d.gain.length;
  const gainPts = [], lossPts = [];
  for (let i = 0; i < n; i++) {
    gainPts.push({ x: n > 1 ? i / (n - 1) : 0, v: d.gain[i] });
    lossPts.push({ x: n > 1 ? i / (n - 1) : 0, v: d.loss[i] });
  }
  if (showGain) line(gainPts, '#8fe08f');
  if (showLoss) line(lossPts, '#ff8a7a');

  // 图例数值汇总：显示该档位内累计生产/消耗
  let tg = 0, tl = 0;
  for (let i = 0; i < d.gain.length; i++) { tg += d.gain[i]; tl += d.loss[i]; }
  const sumEl = cv.parentElement ? cv.parentElement.querySelector('[data-stat-hist-sum]') : null;
  if (sumEl) {
    if (dir === 'prod') sumEl.textContent = '　档内累计：生产 +' + fmtNum(tg);
    else if (dir === 'cons') sumEl.textContent = '　档内累计：消耗 −' + fmtNum(tl);
    else sumEl.textContent = '　档内累计：生产 +' + fmtNum(tg) + ' / 消耗 −' + fmtNum(tl);
  }
}

// 数字紧凑格式化：>=1000 显示为 1.2k 等。
function fmtNum(v) {
  if (Math.abs(v) >= 1000000) return (v / 1000000).toFixed(1) + 'M';
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(1) + 'k';
  return (Math.round(v * 10) / 10).toString();
}

// 物品速率页：最外层分两个 tab——历史（带图表，在前）与 实时（在后）。
// 历史页与实时页下又各分 生产 / 消耗 两个子 tab，分别展示对应方向的数据。
function htmlStatsItems() {
  const all = prodActiveItems().sort((a, b) => (itemName(a) < itemName(b) ? -1 : 1));
  // 第一层：历史（默认，在前）/ 实时
  const topTab = (G.statsItemTab === 'live') ? 'live' : 'hist';
  const isHist = topTab === 'hist';

  let h = '<div class="sec">物品统计</div>';
  // 第一层 tab：历史在前，实时在后
  h += '<div class="stat-subtabs">';
  h += '<button class="stat-subtab' + (isHist ? ' active' : '') + '" data-stat-item-tab="hist">历史</button>';
  h += '<button class="stat-subtab' + (!isHist ? ' active' : '') + '" data-stat-item-tab="live">实时</button>';
  h += '</div>';

  if (isHist) return h + htmlStatsHist(all);
  return h + htmlStatsLive(all);
}

// 实时页：下方再分 生产 / 消耗 两个子 tab，展示实时的速率表格。
function htmlStatsLive(all) {
  const sub = (G.statsLiveSub === 'cons') ? 'cons' : 'prod';
  const isProd = sub === 'prod';

  let h = '<div class="stat-subtabs">';
  h += '<button class="stat-subtab' + (isProd ? ' active' : '') + '" data-stat-live-sub="prod">生产</button>';
  h += '<button class="stat-subtab' + (!isProd ? ' active' : '') + '" data-stat-live-sub="cons">消耗</button>';
  h += '</div>';

  // 统计间隔切换按钮（秒 / 10秒 / 分钟 / 小时 / 1天）
  h += '<div class="dim" style="margin-bottom:6px">统计间隔：</div>';
  h += '<div class="stat-intervals">';
  for (let i = 0; i < STAT_INTERVALS.length; i++) {
    const it = STAT_INTERVALS[i];
    h += '<button class="stat-interval' + (G.statsInterval === i ? ' active' : '') + '" data-stat-interval="' + i + '">' + it.label + '</button>';
  }
  h += '</div>';

  // 只列出本子 tab 有活动的物品
  const items = all.filter(id =>
    isProd ? ((PROD.gained[id] || 0) > 0) : ((PROD.lost[id] || 0) > 0));

  if (!items.length) {
    h += '<div class="dim">暂无' + (isProd ? '生产' : '消耗') + '活动记录。挖矿、合成、建造/拆除等产生的物品增减会在此实时统计。</div>';
    return h;
  }

  const unit = statIntervalUnit();
  if (isProd) {
    h += '<div class="stat-table"><div class="stat-head"><span>物品</span><span>生产速率' + unit + '</span><span>累计产出</span></div>';
    for (const id of items) {
      const rate = prodGainRatePerInterval(id);
      h += '<div class="stat-row">';
      h += '<span>' + chip(id) + '</span>';
      h += '<span data-live="p-' + id + '" style="color:#8fe08f;font-weight:bold">+' + rate.toFixed(2) + '</span>';
      h += '<span data-live="t-' + id + '" class="dim">+' + (PROD.gained[id] || 0).toFixed(0) + '</span>';
      h += '</div>';
    }
    h += '</div>';
  } else {
    h += '<div class="stat-table"><div class="stat-head"><span>物品</span><span>消耗速率' + unit + '</span><span>累计消耗</span></div>';
    for (const id of items) {
      const rate = prodLossRatePerInterval(id);
      h += '<div class="stat-row">';
      h += '<span>' + chip(id) + '</span>';
      h += '<span data-live="p-' + id + '" style="color:#ff8a7a;font-weight:bold">−' + rate.toFixed(2) + '</span>';
      h += '<span data-live="t-' + id + '" class="dim">−' + (PROD.lost[id] || 0).toFixed(0) + '</span>';
      h += '</div>';
    }
    h += '</div>';
  }
  h += '<div class="dim">生产速率为物品被产出的速率，消耗速率为物品被消耗的速率（均按所选统计间隔[' + statIntervalLabel() + ']折算，即每' + statIntervalLabel() + '多少单位，非设备产能）。数据不足所选间隔时按已有记录时长预估。累计为最近游戏进行中的总量。</div>';
  return h;
}

// 电量页
// 下方分两个子 tab：发电设备（producers）与耗电设备（consumers）。
// 设备列表按类型聚合，显示该类型设备数量、总功率与每个实例坐标明细。
function htmlStatsPower() {
  const s = powerSummary();
  const satPct = Math.round((s.sat || 0) * 100);
  const isProd = G.statsPowerTab !== 'cons';
  let h = '<div class="sec">电网概览</div>';
  h += '<div class="stat-table">';
  h += row2('产生', '<span data-live="pprod" style="color:#8fe08f;font-weight:bold">+' + s.prod.toFixed(1) + '</span>');
  h += row2('消耗', '<span data-live="pdem" style="color:#ff8a7a;font-weight:bold">−' + s.demand.toFixed(1) + '</span>');
  h += row2('净额', '<span data-live="pnet">' + (s.net >= 0 ? '+' : '') + s.net.toFixed(1) + '</span>');
  h += row2('供电饱和度', '<span data-live="psat"><span class="satbar"><i style="width:' + satPct + '%"></i></span> <b>' + satPct + '%</b></span>');
  h += '</div>';

  h += '<div class="sec">设备明细</div>';
  h += '<div class="stat-subtabs">';
  h += '<button class="stat-subtab' + (isProd ? ' active' : '') + '" data-stat-power-tab="prod">发电设备</button>';
  h += '<button class="stat-subtab' + (!isProd ? ' active' : '') + '" data-stat-power-tab="cons">耗电设备</button>';
  h += '</div>';

  const list = isProd ? s.producers : s.consumers;
  if (!list.length) {
    h += '<div class="dim">没有' + (isProd ? '正在发电' : '正在耗电') + '的设备' +
      (isProd ? '（蒸汽机 / 太阳能板 / 蓄电器放电）' : '（电采矿机 / 电炉 / 组装机 / 抽油机 / 炼油厂 / 化工厂）') + '。</div>';
    return h;
  }

  // 按设备类型聚合：type -> { count, total, instances: [{e,v}] }
  const groups = {};
  for (const { e, v } of list) {
    const t = e.type;
    if (!groups[t]) groups[t] = { count: 0, total: 0, instances: [] };
    const g = groups[t];
    g.count++;
    g.total += v;
    g.instances.push({ e, v });
  }
  // 按类型名排序
  const types = Object.keys(groups).sort((a, b) => (itemName(a) < itemName(b) ? -1 : 1));

  h += '<div class="stat-table">';
  for (const t of types) {
    const g = groups[t];
    const color = isProd ? '#8fe08f' : '#ffd23c';
    h += '<div class="stat-row"><span>' + chip(t, g.count) +
      '</span><span style="color:' + color + '">' + (isProd ? '+' : '') + g.total.toFixed(1) + '</span></div>';
    // 每个实例坐标明细（折叠为次要小字行）
    const coords = g.instances.map(i => i.e.x + ',' + i.e.y).join('　');
    h += '<div class="stat-row dim2" style="font-size:11px;padding-left:22px">' +
      '坐标：' + coords + '</div>';
  }
  h += '</div>';
  h += '<div class="dim">各设备功率：发电为正 (+)，耗电为原值；设备数按类型汇总。净额 = 产生 − 消耗。供电饱和度 <100% 时用电设备按比例降速。</div>';
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
  h += row2('帧率 (FPS)', '<b data-live="pfps">' + PERF.fps + '</b>');
  h += row2('单帧耗时', '<span data-live="pframems">' + PERF.frameMs.toFixed(2) + ' ms</span>');
  h += row2('逻辑帧耗时', '<span data-live="pupdate">' + (PERF.updateMs || 0).toFixed(2) + ' ms</span>');
  h += row2('实体数量', '<span data-live="pents">' + PERF.ents + '</span>');
  h += row2('活跃实体', '<b data-live="pactive">' + PERF.activeEnts + '</b>');
  h += row2('静态实体', '<span data-live="pstatic">' + PERF.staticEnts + '</span>');
  h += row2('地形格子数（已加载块）', '<span data-live="ptiles">' + PERF.tiles + ' 格（' + (G.world.chunks ? G.world.chunks.size : 0) + ' 块）</span>');
  h += row2('地形离屏缓存状态', '<span data-live="pcache">' + PERF.cacheState + '</span>');
  h += row2('地形缓存最近重建耗时', '<span data-live="pcachem">' + (PERF.cacheRebuildMs || 0).toFixed(1) + ' ms</span>');
  h += row2('缩放级别', '<span data-live="pzoom">×' + PERF.zoom.toFixed(2) + '</span>');
  h += row2('LOD 分级', '<span data-live="plod">' + PERF.lodState + '</span>');
  h += '</div>';
  // 设备分布：按数量降序列出各类设备，判断哪类对帧数/逻辑帧影响最大
  const devs = PERF.devices || [];
  h += '<div class="sec">设备分布</div>';
  h += '<div class="dim">活跃实体（每帧执行逻辑）直接决定逻辑帧开销；静态实体不逐帧跑逻辑，主要影响渲染与内存。以下按数量降序：</div>';
  h += '<div class="stat-table" id="perf-devices">';
  if (!devs.length) {
    h += '<div class="dim">暂无设备。</div>';
  } else {
    for (const d of devs) {
      const flag = d.active > 0 ? ' <span class="perf-act">活跃</span>' : '';
      h += row2(d.name + flag, '<span data-live="pd-' + d.type + '">' + d.n + '</span>');
    }
  }
  h += '</div>';
  h += '<div class="dim">地形离屏缓存：地形绘到离屏画布，相机未大幅移动时直接整块贴图，避免逐格重算；缓存失效时会重建并记录耗时。逻辑帧耗时=每帧所有活跃实体 update 的总耗时（不含渲染）。</div>';
  return h;
}

// 计算统计面板各页的“结构签名”：仅在列表成员（物品 / 发电·耗电设备）集合变化时
// 才触发整体 DOM 重建；否则只增量更新数值节点，避免每 0.25s 重建整个面板（P2 优化）。
function statsListSig(tab) {
  if (tab === 'items') {
    // 历史页：结构随选中物品 + 时间档位 + 历史子 tab 变化；并纳入当前桶序号，使图表随新桶推进而重绘
    if (G.statsItemTab === 'hist') {
      return 'ih:' + (G.statsHistItem || '') + ':s' + (G.statsHistSub || 'prod') + ':z' + histZoomIdx() + ':b' + PROD_HIST.curBucketId;
    }
    // 实时页：结构随实时子 tab（生产/消耗）+ 统计间隔 + 物品列表变化
    const isProd = (G.statsLiveSub !== 'cons');
    const items = prodActiveItems()
      .filter(id => isProd ? ((PROD.gained[id] || 0) > 0) : ((PROD.lost[id] || 0) > 0))
      .sort((a, b) => (itemName(a) < itemName(b) ? -1 : 1));
    return 'i:live:' + (isProd ? 'prod' : 'cons') + ':iv' + (G.statsInterval || 0) + ':' + items.join(',');
  }
  if (tab === 'power') {
    const s = powerSummary();
    const sig = s.producers.map(p => p.e.type + '@' + p.e.x + ',' + p.e.y).join('|') + '#' +
      s.consumers.map(c => c.e.type + '@' + c.e.x + ',' + c.e.y).join('|');
    return 'p:' + (G.statsPowerTab || 'prod') + ':' + sig;
  }
  // 性能页：结构随设备类型集合变化（新增/移除某类设备时重建列表），否则仅增量更新数值
  const devs = PERF.devices || [];
  const devSig = devs.map(d => d.type + (d.active > 0 ? '*' : '')).join(',');
  return 'f:' + devSig;
}

// 统计面板实时刷新：由 main loop 每 0.25s 调用一次。
// 结构（成员列表）未变时只更新带 data-live 的数值节点，避免整段 innerHTML 重建。
function updateStatsLive() {
  if (G.panelMode !== 'stats') return;
  const body = document.getElementById('panel-body');
  if (!body) return;
  const sig = statsListSig(G.statsTab);
  if (body._statsSig !== sig) {
    body._statsSig = sig;
    if (typeof renderPanel === 'function') renderPanel(false);
    return;   // 刚重建过，本帧无需再增量更新
  }
  // 结构未变：增量更新变化数值
  const set = (k, v) => {
    const el = body.querySelector('[data-live="' + k + '"]');
    if (el && el.innerHTML !== v) el.innerHTML = v;
  };
  if (G.statsTab === 'items') {
    // 历史页：若结构未变（同一物品/档位/子 tab/桶），仅重绘图表以反映当前桶内的实时累计
    if (G.statsItemTab === 'hist') {
      const cv = body.querySelector('[data-stat-hist-canvas]');
      if (cv && typeof renderHistChart === 'function') {
        const item = window.__histLast ? window.__histLast.item : histSelectedItem();
        const zoom = window.__histLast ? window.__histLast.zoom : 86400;
        const dir = window.__histLast ? window.__histLast.dir : 'both';
        if (item) renderHistChart(cv, item, zoom, dir);
      }
      return;
    }
    // 实时页：按实时子 tab（生产/消耗）增量更新速率数值
    const isProd = (G.statsLiveSub !== 'cons');
    for (const id of prodActiveItems()) {
      if (isProd) {
        if ((PROD.gained[id] || 0) > 0) {
          set('p-' + id, '+' + prodGainRatePerInterval(id).toFixed(2));
          set('t-' + id, '+' + (PROD.gained[id] || 0).toFixed(0));
        }
      } else if ((PROD.lost[id] || 0) > 0) {
        set('p-' + id, '−' + prodLossRatePerInterval(id).toFixed(2));
        set('t-' + id, '−' + (PROD.lost[id] || 0).toFixed(0));
      }
    }
  } else if (G.statsTab === 'power') {
    const s = powerSummary();
    const satPct = Math.round((s.sat || 0) * 100);
    set('pprod', '+' + s.prod.toFixed(1));
    set('pdem', '−' + s.demand.toFixed(1));
    set('pnet', (s.net >= 0 ? '+' : '') + s.net.toFixed(1));
    set('psat', '<span class="satbar"><i style="width:' + satPct + '%"></i></span> <b>' + satPct + '%</b>');
  } else {
    refreshPerf();
    set('pfps', PERF.fps);
    set('pframems', PERF.frameMs.toFixed(2) + ' ms');
    set('pupdate', (PERF.updateMs || 0).toFixed(2) + ' ms');
    set('pents', PERF.ents);
    set('pactive', PERF.activeEnts);
    set('pstatic', PERF.staticEnts);
    set('ptiles', PERF.tiles + ' 格（' + (G.world.chunks ? G.world.chunks.size : 0) + ' 块）');
    set('pcache', PERF.cacheState);
    set('pcachem', (PERF.cacheRebuildMs || 0).toFixed(1) + ' ms');
    set('pzoom', '×' + PERF.zoom.toFixed(2));
    set('plod', PERF.lodState);
    for (const d of PERF.devices || []) set('pd-' + d.type, d.n);
  }
}
