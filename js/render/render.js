'use strict';

let W = 0, H = 0;

function resize() {
  let dpr = window.devicePixelRatio || 1;
  // 性能设置：可限制高分屏 DPR≤1.5，或进一步降至半分辨率（省电模式）
  const st = (G && G.settings) || {};
  if (st.capDPR) dpr = Math.min(dpr, 1.5);
  if (st.lowRes) dpr = Math.max(0.5, dpr * 0.5);
  W = window.innerWidth; H = window.innerHeight;
  G.canvas.width = W * dpr;
  G.canvas.height = H * dpr;
  G.canvas.style.width = W + 'px';
  G.canvas.style.height = H + 'px';
  G.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // 放置幽灵顶层画布：与主画布同尺寸同步缩放，保证幽灵可绘制在所有界面上方
  if (G.ghostCv) {
    G.ghostCv.width = W * dpr;
    G.ghostCv.height = H * dpr;
    G.ghostCv.style.width = W + 'px';
    G.ghostCv.style.height = H + 'px';
    G.ghostCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  // 画布尺寸变化后，背包格子像素尺寸需重新测量
  if (typeof _ghostSlotSize !== 'undefined') _ghostSlotSize = 0;
}

function updateCamera(dt) {
  const cam = G.cam;
  const pan = cam.pan || { x: 0, y: 0 };
  // 相机跟随玩家，但在玩家基础上附加 pan 偏移；
  // 玩家移动后偏移仍保持（视角相对玩家位置固定）。
  const txp = G.player.x - TILE / 2 + pan.x;
  const typ = G.player.y - TILE / 2 + pan.y;
  cam.px += (txp - cam.px) * Math.min(1, dt * 8);
  cam.py += (typ - cam.py) * Math.min(1, dt * 8);
}

function screenToWorld(sx, sy) {
  return [(sx - W / 2) / G.cam.z + G.cam.px, (sy - H / 2) / G.cam.z + G.cam.py];
}

// 当前帧的视口世界包围盒（由 render 一次性计算，传给各 onScreen 判断，
// 避免每个实体各自 new 一个对象）。
let FRAME_BOUNDS = null;
// 复用的包围盒缓冲：地形/网格等每帧只算一次，避免重复分配。
let _B = {};
// 渲染热路径复用缓冲区：桶 keys 数组与去重 Set，避免每帧多次分配（GC 压力）。
// render() 与 drawLampLights() 内的 bucketKeysIn/forEachEntInBuckets 均为顺序非嵌套调用，
// 可安全复用同一对缓冲区（每次调用前会自动 clear）。
let _bucketKeysBuf = [];
let _bucketSeenBuf = new Set();

// ===== LOD 分级绘制 =====
// 依据瓦片在屏幕上的像素尺寸（TILE * cam.z）决定绘制细节等级，
// 缩放很小时跳过昂贵细节（物品 dot 的 clip/glyph、状态灯、流体标注、动画三角等）。
const LOD = { level: 2, simple: false, tilePx: TILE };
// 屏幕尺寸低于该阈值时启用简化绘制（仅底色+箭头，物品改色块）。
// 20 = 缩放 0.63 以下进入简化。实测 0.5 时 tilePx≈16，若用 14 会落在完整绘制区间，
// 导致大基地缩放看全局一览时仍逐格渲染带内物品/动画三角等昂贵细节，是渲染卡顿主因之一。
const LOD_SIMPLE_PX = 20;

function updateLOD() {
  LOD.tilePx = TILE * G.cam.z;
  LOD.simple = LOD.tilePx < LOD_SIMPLE_PX;
  LOD.level = LOD.simple ? 0 : 2;
}

// 低 LOD 时物品 dot 的简化画法：色块替代 clip+glyph，省去大量路径/裁剪。
function drawItemDotLOD(ctx, x, y, item) {
  const it = ITEMS[item];
  ctx.fillStyle = '#20242b';
  ctx.fillRect(x - 3.5, y - 3.5, 7, 7);
  ctx.fillStyle = it.color;
  ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
}

function render() {
  const ctx = G.ctx;
  ctx.fillStyle = '#151a14';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(G.cam.z, G.cam.z);
  ctx.translate(-G.cam.px, -G.cam.py);
  // 视口包围盒只算一次，供本帧所有实体剔除复用
  FRAME_BOUNDS = viewBounds();
  // LOD 分级：缩放小时简化绘制细节
  updateLOD();
  drawTerrain(ctx);
  drawGridIfBuilding(ctx);
  // 污染系统可视化：污染范围只显示在小地图上，不在主地图本体上绘制（见 drawPollutionMinimap）
  // if (typeof drawPollution === 'function') drawPollution(ctx);
  // 空间分区（桶）索引：只遍历视口覆盖到的桶，避免对全量 G.ents 线性扫描（P0 优化）
  // 机械臂（Inserter 族）最后单独绘制在最上层，避免被传送带/其他设备遮挡。
  const keys = (G.buckets && G.buckets.size)
    ? bucketKeysIn(
        Math.floor(FRAME_BOUNDS.x1 / TILE) - BUCK, Math.floor(FRAME_BOUNDS.y1 / TILE) - BUCK,
        Math.ceil(FRAME_BOUNDS.x0 / TILE) + BUCK, Math.ceil(FRAME_BOUNDS.y0 / TILE) + BUCK,
        _bucketKeysBuf)
    : null;
  // 渲染分类型耗时采样（分段法，与逻辑侧 main-input.js 的 update 采样一致）：
  // 仅性能页开启时采样，按设备类型累计本帧绘制耗时，用于定位「哪类设备在渲染上拖累帧率」
  // （缩小画面、视口满载时尤其关键）。只在不同类型切换时取 performance.now()，避免逐实体取证开销。
  let _rtri = null, _rLast = null, _rSegStart = 0, _rStart = 0;
  if (G.statsTab === 'perf' && typeof PERF === 'object' && PERF) {
    if (!PERF._rtri) PERF._rtri = { t0: 0, renderMs: 0, type: {} };
    _rtri = PERF._rtri;
    if (!_rtri.t0) _rtri.t0 = performance.now();
    _rStart = performance.now();
  }
  const _rSegFlush = (type, endT) => {
    if (type != null && !isNaN(_rSegStart)) {
      _rtri.renderMs += endT - _rSegStart;
      _rtri.type[type] = (_rtri.type[type] || 0) + (endT - _rSegStart);
    }
  };
  const drawPass = (e, drawInserter) => {
    if (e._dead || !onScreen(e)) return;
    if (drawInserter !== !!IS_INSERTER[e.type]) return;
    if (_rtri) {
      if (e.type !== _rLast) {
        if (_rLast !== null) _rSegFlush(_rLast, performance.now());
        _rLast = e.type;
        _rSegStart = performance.now();
      }
    }
    drawEntity(ctx, e, e.x, e.y, e.dir, 1);
  };
  // 每帧先清空管道口箭头队列，再让各设备在 drawPort 里重新排队（丢弃幽灵等后置绘制的残留）
  if (typeof clearPortArrowQueue === 'function') clearPortArrowQueue();
  if (keys) {
    forEachEntInBuckets(keys, e => drawPass(e, false), _bucketSeenBuf);   // 普通设备（含传送带等）
    if (typeof drawBeltItemsAll === 'function') drawBeltItemsAll(ctx);    // 传送带物品第二遍：盖在所有带面之上
    forEachEntInBuckets(keys, e => drawPass(e, true), _bucketSeenBuf);    // 机械臂置顶
  } else {
    for (const e of G.ents) drawPass(e, false);
    if (typeof drawBeltItemsAll === 'function') drawBeltItemsAll(ctx);    // 传送带物品第二遍
    for (const e of G.ents) drawPass(e, true);
  }
  if (_rtri) {
    if (_rLast !== null) _rSegFlush(_rLast, performance.now());
    if (typeof PERF === 'object' && PERF) PERF.renderMs = performance.now() - _rStart;
  }
  // ALT 模式（对齐《异星工厂》）：在建筑上叠加显示当前配方/内容标签
  if (G.settings.altMode) drawAltMode(ctx, keys, _bucketSeenBuf);
  // 管道口流向箭头置顶：在实体/管道绘制之后统一画出，保证不被相邻管道遮挡
  if (typeof flushPortArrowOverlay === 'function') flushPortArrowOverlay(ctx);
  // 兜底清空放置幽灵顶层画布：确保每帧 ghost-layer 都被清空，
  // 避免任何路径下遗留上一帧的半透明阴影/数量角标（防残留叠加）。
  // 先重置为与主画布一致的 dpr 变换再清除，保证 clearRect 覆盖整块画布，
  // 即便上一帧在某些分支把幽灵画布残留了平移/缩放变换也仍能完整清空。
  if (G.ghostCtx) {
    const _dpr = window.devicePixelRatio || 1;
    G.ghostCtx.setTransform(_dpr, 0, 0, _dpr, 0, 0);
    G.ghostCtx.clearRect(0, 0, W, H);
  }
  drawGhost(ctx);
  drawBlueprintOverlay(ctx);
  drawHoverAndMining(ctx);
  drawPlayer(ctx);
  drawReachCircle(ctx);
  drawEnemies(ctx);
  drawBullets(ctx);
  drawCombatRobots(ctx);
  drawAoeZones(ctx);
  drawGroundFires(ctx);
  drawAcidPools(ctx);
  drawLootDrops(ctx);
  if (typeof drawGroundItems === 'function') drawGroundItems(ctx);
  drawLogisticsRobots(ctx);
  if (typeof drawConstruction === 'function') drawConstruction(ctx);
  if (typeof drawParticles === 'function') drawParticles(ctx);
  // 避雷系统：雷暴落雷特效（世界坐标，位于粒子之上）
  if (typeof drawLightningStrikes === 'function') drawLightningStrikes(ctx, G.cam);
  ctx.restore();

  // 昼夜黑暗遮罩：夜晚整个世界变暗（由 solarFactor 推算），夜视仪可抵消；设置中"日照光照"可整体开关
  if (typeof solarFactor === 'function' && typeof hasNightVision === 'function' && (G.settings.daylight !== false)) {
    const ph = ((G.time / DAY_CYCLE) % 1 + 1) % 1;
    let dark = 0;
    let ambientTint = null;
    if (ph < 0.25 || ph >= 0.75) { dark = 0.4; ambientTint = 'rgba(10,16,34,'; }   // 深夜：偏冷蓝
    else if (ph < 0.32) { dark = (0.32 - ph) / 0.07 * 0.4; ambientTint = 'rgba(255,120,60,'; } // 黄昏：偏暖橙
    else if (ph >= 0.68) { dark = (ph - 0.68) / 0.07 * 0.4; ambientTint = 'rgba(255,140,80,'; } // 黎明：偏暖橙
    if (hasNightVision()) dark *= 0.12;              // 夜视仪：大幅削弱黑暗
    if (dark > 0.01) {
      // 主暗色遮罩
      ctx.fillStyle = 'rgba(6,10,18,' + dark.toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
      // 环境色温（暖橙黄昏/黎明、冷蓝深夜）：叠加极淡的全局色调，增强昼夜氛围
      if (ambientTint) {
        ctx.fillStyle = ambientTint + (dark * 0.18).toFixed(3) + ')';
        ctx.fillRect(0, 0, W, H);
      }
      // 电灯：在黑暗遮罩上凿出光圈并叠加暖色光晕（需夜间有点灯设备时）
      if (typeof drawLampLights === 'function' && !hasNightVision()) drawLampLights(ctx, dark);
    }
  }

  // 全屏强光闪光（原子弹核爆触发）：叠加整屏白/橙光，随 G.screenFlash 强度衰减（屏幕坐标）
  if (G.screenFlash > 0.01) {
    const fs = Math.min(1, G.screenFlash);
    // 白热核心
    ctx.fillStyle = 'rgba(255,250,240,' + (fs * 0.85).toFixed(3) + ')';
    ctx.fillRect(0, 0, W, H);
    // 暖橙火光照亮
    ctx.fillStyle = 'rgba(255,160,60,' + (fs * 0.4).toFixed(3) + ')';
    ctx.fillRect(0, 0, W, H);
  }

  // 地图标记：在昼夜遮罩之上绘制世界中的标记（对齐《异星工厂》地图标签，夜间亦可见）
  if (typeof drawMapTagsWorld === 'function') drawMapTagsWorld(ctx);

  // 天气系统：动态云影覆盖层（低开销，不影响分块缓存）
  if (typeof drawWeatherOverlay === 'function') drawWeatherOverlay(ctx, W, H);

  // 小地图（位于画布右下角）
  if (G.settings && G.settings.minimap !== false) drawMinimap(ctx);
  // 设备信息面板：鼠标悬停设备时在小地图下方显示长条详情
  if (typeof drawDeviceInfoBar === 'function') drawDeviceInfoBar(ctx);
}

// ===== 显示角色建造范围圆圈（设置「显示建造范围」开启时绘制）=====
// 以角色中心为圆心、半径为 REACH_PX（10 格，对齐原版）的圆，恰好覆盖 withinReach 判定边界
// （角色中心到瓦片中心的距离 ≤ REACH_PX 即视为可建造/交互）。
function drawReachCircle(ctx) {
  if (!G.settings || !G.settings.showReach) return;
  // 调试「无限交互距离」开启时范围无穷大，不画圈
  if (G.dbg && G.dbg.farReach) return;
  const p = G.player;
  if (!p) return;
  const r = REACH_PX;
  // 视口剔除：圆圈完全不在屏幕内时跳过，避免无效绘制
  const cam = G.cam, z = cam.z;
  const sx = (p.x - cam.px) * z + W / 2;
  const sy = (p.y - cam.py) * z + H / 2;
  const sr = r * z;
  if (sx + sr < -20 || sx - sr > W + 20 || sy + sr < -20 || sy - sr > H + 20) return;
  // 半透明填充（范围内的地面轻微高亮）
  ctx.fillStyle = 'rgba(120,200,255,.06)';
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.fill();
  // 虚线描边（随缩放保持粗细一致）
  ctx.strokeStyle = 'rgba(160,220,255,.55)';
  ctx.lineWidth = 1.5 / z;
  ctx.setLineDash([8 / z, 6 / z]);
  ctx.beginPath();
  ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
}

// ===== 电灯照明：在黑暗遮罩上凿出光圈并叠加暖光 =====
// 遍历视口内通电点亮的电灯，用 destination-out 把对应区域的黑暗削掉，
// 再叠加一圈暖色光晕，使夜间基地可见。所有坐标转换为屏幕像素。
function drawLampLights(ctx, dark) {
  const cam = G.cam, z = cam.z;
  const rPx = 5 * TILE * z;            // 照亮半径转像素
  const keys = (G.buckets && G.buckets.size)
    ? bucketKeysIn(
        Math.floor(FRAME_BOUNDS.x1 / TILE) - 6, Math.floor(FRAME_BOUNDS.y1 / TILE) - 6,
        Math.ceil(FRAME_BOUNDS.x0 / TILE) + 6, Math.ceil(FRAME_BOUNDS.y0 / TILE) + 6,
        _bucketKeysBuf)
    : null;
  const sx = (wx) => (wx - cam.px) * z + W / 2;
  const sy = (wy) => (wy - cam.py) * z + H / 2;
  let first = true;
  const punch = (e) => {
    if (!e._dead && e.type === 'small-lamp' && e.shouldLight && e.shouldLight()) {
      const cx = sx((e.x + 0.5) * TILE);
      const cy = sy((e.y + 0.5) * TILE);
      if (cx < -rPx || cx > W + rPx || cy < -rPx || cy > H + rPx) return;
      if (first) {
        // 切换到“挖空”模式：把暗罩下方内容显露出来（即减去黑暗）
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        first = false;
      }
      const g = ctx.createRadialGradient(cx, cy, rPx * 0.12, cx, cy, rPx);
      g.addColorStop(0, 'rgba(0,0,0,' + Math.min(1, dark * 2.4) + ')');
      g.addColorStop(0.5, 'rgba(0,0,0,' + (dark * 0.85).toFixed(3) + ')');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, rPx, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  if (keys) forEachEntInBuckets(keys, punch, _bucketSeenBuf);
  else for (const e of G.ents) punch(e);
  if (!first) ctx.restore();
  // 叠加暖色光晕（半透明黄色辉光，重新正常混合）
  let drewGlow = false;
  const glow = (e) => {
    if (!e._dead && e.type === 'small-lamp' && e.shouldLight && e.shouldLight()) {
      const cx = sx((e.x + 0.5) * TILE);
      const cy = sy((e.y + 0.5) * TILE);
      if (cx < -rPx || cx > W + rPx || cy < -rPx || cy > H + rPx) return;
      if (!drewGlow) { ctx.save(); drewGlow = true; }
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rPx);
      g.addColorStop(0, 'rgba(255,246,178,' + (0.5).toFixed(2) + ')');
      g.addColorStop(0.4, 'rgba(255,220,120,' + (0.22).toFixed(2) + ')');
      g.addColorStop(1, 'rgba(255,200,90,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx, cy, rPx, 0, Math.PI * 2);
      ctx.fill();
    }
  };
  if (keys) forEachEntInBuckets(keys, glow, _bucketSeenBuf);
  else for (const e of G.ents) glow(e);
  if (drewGlow) ctx.restore();
}

// 视口世界包围盒：写入传入对象以复用，避免每帧/每实体分配新对象。
// 未传 out 时返回新建对象（仅给少数一次调用处用）。
function viewBounds(out) {
  const hw = (W / 2) / G.cam.z, hh = (H / 2) / G.cam.z;
  out = out || {};
  out.x0 = G.cam.px + hw;
  out.y0 = G.cam.py + hh;
  out.x1 = G.cam.px - hw;
  out.y1 = G.cam.py - hh;
  return out;
}

// 复用当前帧的视口包围盒做剔除，避免每次调用都新建对象。
function onScreen(e) {
  const b = FRAME_BOUNDS;
  if (!b) return true;
  return e.x * TILE < b.x0 + TILE && (e.x + e.w) * TILE > b.x1 &&
         e.y * TILE < b.y0 + TILE && (e.y + e.h) * TILE > b.y1;
}

// ===== 地形分块离屏缓存（P1 优化）=====
// 每个 32×32 chunk 渲到一张 1024×1024 离屏 canvas，按 LRU 缓存（上限 ~16 张）。
// 相机平移只额外补渲染新出现的 chunk，可见 chunk 直接整张 drawImage blit，
// 把 8000 次逐格 fillRect 降为几次 blit。矿点另行使用独立的每-chunk 离屏缓存（见下方 oreChunkCache），
// 仅当矿量变化（consumeOre）时重绘，避免每帧全量重绘矿点。
const terrainCacheStats = { state: '未启用', rebuildMs: 0, lastRebuild: 0, hits: 0, misses: 0, cached: 0 };
const TERRAIN_CHUNK_LRU_MAX = 16;   // 分块离屏缓存上限（张）
const ORE_CHUNK_LRU_MAX = 64;        // 矿点离屏缓存上限（张）：矿点重建较贵，留更大缓存降低平移时重建频率
const TERRAIN_CHUNK_PX = CHUNK * TILE;   // 1024
const terrainChunkCache = new Map();   // 'cx,cy' -> { canvas, last }
terrainChunkCache._seq = 0;   // LRU 时钟序号

// ===== 地形颜色工具（地图画面重设计） =====
// '#rrggbb' → [r,g,b]（解析缓存，地形为一次性离屏构建，开销可忽略）
const _hexParseCache = {};
function _hexRGBOf(hex) {
  let c = _hexParseCache[hex];
  if (c) return c;
  let h = hex.charAt(0) === '#' ? hex.slice(1) : hex;
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  c = isNaN(n) ? [128, 128, 128] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  _hexParseCache[hex] = c;
  return c;
}
function _rgbHexOf(r, g, b) {
  const cl = (v) => v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
  return '#' + ((1 << 24) + (cl(r) << 16) + (cl(g) << 8) + cl(b)).toString(16).slice(1);
}
// 两个 #rrggbb 之间线性插值（t=0 取 a，t=1 取 b）
function _mixHex(a, b, t) {
  const A = _hexRGBOf(a), B = _hexRGBOf(b);
  return _rgbHexOf(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t);
}
// 变亮（amt>0）/变暗（amt<0），幅度 0~1
function _shadeHex(hex, amt) { return amt >= 0 ? _mixHex(hex, '#ffffff', amt) : _mixHex(hex, '#101010', -amt); }

// 水体配色（hi=近岸浅水，lo=湖心深水）：按行星取色，缺省 nauvis
const WATER_COLORS = {
  nauvis:   { hi: '#4f8cbb', lo: '#1e5180' },
  vulcanus: { hi: '#4a8492', lo: '#1f4a56' },
  gleba:    { hi: '#4d8069', lo: '#204735' },
  fulgora:  { hi: '#4d5773', lo: '#222a42' },
  aquilo:   { hi: '#93c3da', lo: '#3f6f92' }
};
// 岸滩配色（水陆交界的滩涂带）
const SAND_COLORS = {
  nauvis:   '#c8b184',
  vulcanus: '#6b5342',
  gleba:    '#8a7a55',
  fulgora:  '#6e687e',
  aquilo:   '#aec6d2'
};
// 泥土配色（草稀处露出的地表底土，偏淡的浅色泥土）：覆盖度噪声低于阈值时显露
const DIRT_COLORS = {
  nauvis:   '#c0a064',   // 淡黄褐泥土
  vulcanus: '#a97e50',   // 浅火山灰褐
  gleba:    '#8a7450',   // 浅沼泽泥褐
  fulgora:  '#9e95a2',   // 浅干裂紫灰
  aquilo:   '#ab9a84'    // 浅冻土灰褐
};

// 仅绘制单个 chunk 的地形底色（草地/水域），不含矿点
function drawChunkTerrainInto(ctx, cx, cy) {
  // 行星地表主色调：不同星球草地颜色不同（祝融赭石 / 句芒深绿 / 雷神灰 / 玄冥冰蓝）
  const pgrass = (typeof planetGrassColors === 'function') ? planetGrassColors() : ['#4f7c3b', '#4a7538', '#456f35'];
  const pid = (typeof planetId === 'function') ? planetId() : 'nauvis';
  const wcol = WATER_COLORS[pid] || WATER_COLORS.nauvis;
  const sand = SAND_COLORS[pid] || SAND_COLORS.nauvis;
  const ox = cx * CHUNK, oy = cy * CHUNK;
  // 预取 3×3 邻域地形（含 chunk 外一圈）：岸线/滩涂/峭壁投影需要读取相邻格地形，
  // 保证跨 chunk 边界的过渡自然连续（读取会按需生成相邻 chunk，结果确定且被缓存）。
  const EW = CHUNK + 2;
  const ext = new Uint8Array(EW * EW);
  for (let y = -1; y <= CHUNK; y++)
    for (let x = -1; x <= CHUNK; x++)
      ext[(y + 1) * EW + (x + 1)] = getTerrain(ox + x, oy + y);
  // 峭壁格收集：主循环画完后统一向南侧地面补投影（投影落在南侧邻格上，须等邻格画完再叠加）
  const cliffTiles = [];
  for (let dy = 0; dy < CHUNK; dy++) {
    for (let dx = 0; dx < CHUNK; dx++) {
      const tx = ox + dx, ty = oy + dy;
      const px = dx * TILE, py = dy * TILE;
      const t = ext[(dy + 1) * EW + (dx + 1)];
      if (t === T_WATER) {
        drawWaterTile(ctx, px, py, tx, ty, ext, dy, dx, wcol, sand);
        continue;
      }
      if (t === T_CONCRETE) {
        const v = hash2(tx, ty);
        ctx.fillStyle = v > 0.5 ? '#9a9a9e' : '#929298';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = 'rgba(70,70,76,.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        continue;
      }
      if (t === T_REF_CONCRETE) {
        // 精炼混凝土：更亮的浅灰，带更细的石板缝，略有高光（对齐《异星工厂》Refined concrete）
        const v = hash2(tx, ty);
        ctx.fillStyle = v > 0.5 ? '#b4b6bc' : '#abadb3';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = 'rgba(120,122,130,.6)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        // 十字石板缝
        ctx.strokeStyle = 'rgba(70,72,80,.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(px + TILE / 2, py); ctx.lineTo(px + TILE / 2, py + TILE);
        ctx.moveTo(px, py + TILE / 2); ctx.lineTo(px + TILE, py + TILE / 2);
        ctx.stroke();
        // 高光
        ctx.fillStyle = 'rgba(255,255,255,.08)';
        ctx.fillRect(px + 1, py + 1, TILE / 2 - 1, TILE / 2 - 1);
        continue;
      }
      if (t === T_HAZARD) {
        // 警示混凝土：黑黄条纹装饰地砖（对齐《异星工厂》Hazard concrete）
        ctx.fillStyle = '#c8c016';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = 'rgba(70,70,76,.5)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        // 黑黄斜向条纹
        ctx.fillStyle = 'rgba(30,30,34,.85)';
        const bw = TILE / 2.4;
        ctx.beginPath();
        ctx.moveTo(px, py + bw); ctx.lineTo(px + bw, py); ctx.lineTo(px, py);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(px + TILE, py + bw); ctx.lineTo(px + TILE - bw, py); ctx.lineTo(px + TILE, py);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(px, py + TILE - bw); ctx.lineTo(px + bw, py + TILE); ctx.lineTo(px, py + TILE);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(px + TILE, py + TILE - bw); ctx.lineTo(px + TILE - bw, py + TILE); ctx.lineTo(px + TILE, py + TILE);
        ctx.closePath(); ctx.fill();
        continue;
      }
      if (t === T_REF_HAZARD) {
        // 精炼警示混凝土：精炼混凝土底（更亮）+黑黄警示条纹，行走加速更快
        const v = hash2(tx, ty);
        ctx.fillStyle = v > 0.5 ? '#b8b020' : '#b0aa1e';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = 'rgba(70,72,80,.55)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        // 十字石板缝
        ctx.strokeStyle = 'rgba(60,62,70,.4)';
        ctx.beginPath();
        ctx.moveTo(px + TILE / 2, py); ctx.lineTo(px + TILE / 2, py + TILE);
        ctx.moveTo(px, py + TILE / 2); ctx.lineTo(px + TILE, py + TILE / 2);
        ctx.stroke();
        // 黑黄斜向条纹
        ctx.fillStyle = 'rgba(30,30,34,.8)';
        const bw = TILE / 2.4;
        ctx.beginPath();
        ctx.moveTo(px, py + bw); ctx.lineTo(px + bw, py); ctx.lineTo(px, py);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(px + TILE, py + bw); ctx.lineTo(px + TILE - bw, py); ctx.lineTo(px + TILE, py);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(px, py + TILE - bw); ctx.lineTo(px + bw, py + TILE); ctx.lineTo(px, py + TILE);
        ctx.closePath(); ctx.fill();
        ctx.beginPath();
        ctx.moveTo(px + TILE, py + TILE - bw); ctx.lineTo(px + TILE - bw, py + TILE); ctx.lineTo(px + TILE, py + TILE);
        ctx.closePath(); ctx.fill();
        continue;
      }
      if (t === T_PATH) {
        const v = hash2(tx, ty);
        ctx.fillStyle = v > 0.5 ? '#a49c94' : '#9c948c';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = 'rgba(120,110,100,.3)';
        for (const [bx, by] of [[8, 8], [20, 14], [14, 24]]) {
          ctx.fillRect(px + bx, py + by, 4, 4);
          ctx.fillRect(px + bx + 2, py + by + 2, 2, 2);
        }
        continue;
      }

      if (t === T_FOUNDATION) {
        // 地基（官方 Foundation）：灰白合金板，带板缝与铆钉高光，行走加速
        const v = hash2(tx, ty);
        ctx.fillStyle = v > 0.5 ? '#7a7a86' : '#74747e';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = 'rgba(60,60,70,.6)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        // 十字合金板缝
        ctx.strokeStyle = 'rgba(50,50,60,.5)';
        ctx.beginPath();
        ctx.moveTo(px + TILE / 2, py); ctx.lineTo(px + TILE / 2, py + TILE);
        ctx.moveTo(px, py + TILE / 2); ctx.lineTo(px + TILE, py + TILE / 2);
        ctx.stroke();
        // 四角铆钉
        ctx.fillStyle = 'rgba(200,205,215,.5)';
        ctx.fillRect(px + 4, py + 4, 2, 2); ctx.fillRect(px + TILE - 6, py + 4, 2, 2);
        ctx.fillRect(px + 4, py + TILE - 6, 2, 2); ctx.fillRect(px + TILE - 6, py + TILE - 6, 2, 2);
        continue;
      }
      if (t === T_ICE_PLATFORM) {
        // 冰面平台（官方 Ice platform）：冰蓝亮面，带冰裂纹与高光
        const v = hash2(tx, ty);
        ctx.fillStyle = v > 0.5 ? '#9ad4e8' : '#92cce0';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = 'rgba(90,160,190,.55)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        // 冰裂纹
        ctx.strokeStyle = 'rgba(120,190,220,.4)';
        ctx.beginPath();
        ctx.moveTo(px + TILE / 2, py + 2); ctx.lineTo(px + TILE / 2 + 3, py + TILE / 2); ctx.lineTo(px + TILE / 2 - 2, py + TILE - 2);
        ctx.stroke();
        // 高光
        ctx.fillStyle = 'rgba(255,255,255,.22)';
        ctx.fillRect(px + 3, py + 3, TILE / 2 - 2, TILE / 3);
        continue;
      }
      if (t === T_SPACE_PLATFORM) {
        // 太空平台地基（官方 Space platform foundation）：灰色栅格合金地板，十字梁+中点铆钉，行走加速
        const v = hash2(tx, ty);
        ctx.fillStyle = v > 0.5 ? '#6e7078' : '#686a72';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.strokeStyle = 'rgba(50,52,60,.7)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        // 十字合金梁
        ctx.strokeStyle = 'rgba(44,46,54,.6)';
        ctx.beginPath();
        ctx.moveTo(px + TILE / 2, py); ctx.lineTo(px + TILE / 2, py + TILE);
        ctx.moveTo(px, py + TILE / 2); ctx.lineTo(px + TILE, py + TILE / 2);
        ctx.stroke();
        // 中点铆钉
        ctx.fillStyle = 'rgba(150,152,160,.55)';
        ctx.fillRect(px + TILE / 2 - 1, py + TILE / 2 - 1, 2, 2);
        // 栅格点阵（边缘小孔）
        ctx.fillStyle = 'rgba(120,122,132,.5)';
        ctx.fillRect(px + 6, py + 6, 1, 1); ctx.fillRect(px + TILE - 7, py + 6, 1, 1);
        ctx.fillRect(px + 6, py + TILE - 7, 1, 1); ctx.fillRect(px + TILE - 7, py + TILE - 7, 1, 1);
        continue;
      }

      if (t === T_YUMAKO_SOIL) {
        // 人工雅玛果土壤（太空时代 Gleba 农业）：深褐松软壤土，点缀碎草与土粒
        const v = hash2(tx, ty);
        ctx.fillStyle = v > 0.5 ? '#7a5a34' : '#735531';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = 'rgba(40,24,10,.4)';
        for (const [bx, by] of [[7, 9], [20, 22], [12, 25], [24, 8]]) { ctx.fillRect(px + bx, py + by, 3, 3); }
        ctx.fillStyle = 'rgba(150,120,70,.5)';
        for (const [bx, by] of [[17, 6], [9, 18], [23, 17]]) { ctx.fillRect(px + bx, py + by, 2, 2); }
        ctx.strokeStyle = 'rgba(60,38,16,.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        continue;
      }
      if (t === T_OVERGROWTH_YUMAKO_SOIL) {
        // 茂盛雅玛果土壤：更肥沃的黑褐壤土，带更多翠绿植被与嫩芽
        const v = hash2(tx, ty);
        ctx.fillStyle = v > 0.5 ? '#6a4a28' : '#634524';  
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = 'rgba(60,140,50,.55)';
        ctx.fillRect(px + 5, py + 6, 6, 6);
        ctx.fillRect(px + 20, py + 20, 5, 5);
        ctx.fillStyle = 'rgba(90,170,60,.45)';
        ctx.fillRect(px + 12, py + 12, 4, 4);
        ctx.fillRect(px + 24, py + 5, 3, 3);
        ctx.strokeStyle = 'rgba(30,20,8,.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        continue;
      }
      if (t === T_JELLYNUT_SOIL) {
        // 人工果仁土壤（太空时代 Gleba 农业）：粉褐壤土，带果仁颗粒与土粒
        const v = hash2(tx, ty);
        ctx.fillStyle = v > 0.5 ? '#7a4458' : '#734052';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = 'rgba(50,20,40,.4)';
        for (const [bx, by] of [[7, 9], [20, 22], [12, 25], [24, 8]]) { ctx.fillRect(px + bx, py + by, 3, 3); }
        ctx.fillStyle = 'rgba(190,100,150,.5)';
        for (const [bx, by] of [[17, 6], [9, 18], [23, 17]]) { ctx.fillRect(px + bx, py + by, 2, 2); }
        ctx.strokeStyle = 'rgba(50,20,35,.35)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        continue;
      }
      if (t === T_OVERGROWTH_JELLYNUT_SOIL) {
        // 茂盛果仁土壤：更肥沃的深粉褐壤土，带更多果仁作物与嫩芽
        const v = hash2(tx, ty);
        ctx.fillStyle = v > 0.5 ? '#6a3a4e' : '#643547';
        ctx.fillRect(px, py, TILE, TILE);
        ctx.fillStyle = 'rgba(200,90,160,.55)';
        ctx.fillRect(px + 5, py + 6, 6, 6);
        ctx.fillRect(px + 20, py + 20, 5, 5);
        ctx.fillStyle = 'rgba(220,110,180,.45)';
        ctx.fillRect(px + 12, py + 12, 4, 4);
        ctx.fillRect(px + 24, py + 5, 3, 3);
        ctx.strokeStyle = 'rgba(40,15,30,.4)';
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 0.5, py + 0.5, TILE - 1, TILE - 1);
        continue;
      }
      if (t === T_CLIFF) {
        // 峭壁（对齐《异星工厂》Cliff）：灰褐色岩体 + 层理 + 受光/背光缘，比周围地面略高
        drawCliffTile(ctx, px, py, tx, ty, ext, dy, dx);
        cliffTiles.push(dy * CHUNK + dx);
        continue;
      }
      drawGrassTile(ctx, px, py, tx, ty, ext, dy, dx, pgrass, sand, pid);
      if (t === T_TREE) drawTreeInto(ctx, px, py, tx, ty);
    }
  }
  // 峭壁投影：崖脚向南侧地面投出接触阴影（在全部地表画完后叠加，避免被行序覆盖）
  for (const c of cliffTiles) {
    const dx = c % CHUNK, dy = (c / CHUNK) | 0;
    if (ext[(dy + 2) * EW + (dx + 1)] === T_CLIFF) continue;   // 南侧同为峭壁：崖体内部，不投影
    const px = dx * TILE, py = (dy + 1) * TILE;                // 投影带画在崖体南缘下方
    const g = ctx.createLinearGradient(0, py, 0, py + 6);
    g.addColorStop(0, 'rgba(15,14,10,.32)');
    g.addColorStop(1, 'rgba(15,14,10,0)');
    ctx.fillStyle = g;
    ctx.fillRect(px, py, TILE, 6);
  }
}

// ===== 水面瓦片：按深度着色 + 岸线浅滩 + 白色水线 =====
// 深度由 8 邻域水域占比估算（岸浅湖心深），叠加低频噪声让水体成片渐变；
// 邻格为陆地的方向画浅色渐变浅滩带与泡沫水线，斜角邻陆处用圆角光斑补齐岸线。
function drawWaterTile(ctx, px, py, tx, ty, ext, dy, dx, wcol, sand) {
  const EW = CHUNK + 2;
  const r0 = (dy + 1) * EW + (dx + 1);
  const nN = ext[r0 - EW], nS = ext[r0 + EW], nW = ext[r0 - 1], nE = ext[r0 + 1];
  const nNW = ext[r0 - EW - 1], nNE = ext[r0 - EW + 1], nSW = ext[r0 + EW - 1], nSE = ext[r0 + EW + 1];
  // 深度：邻域水域占比 + 低频噪声（湖内成片微渐变）
  let cnt = 0;
  if (nN === T_WATER) cnt++; if (nS === T_WATER) cnt++;
  if (nW === T_WATER) cnt++; if (nE === T_WATER) cnt++;
  if (nNW === T_WATER) cnt++; if (nNE === T_WATER) cnt++;
  if (nSW === T_WATER) cnt++; if (nSE === T_WATER) cnt++;
  const wn = valueNoise(tx * 0.15 + 13.7, ty * 0.15 + 31.3);
  let d = cnt / 8 * 0.82 + wn * 0.18;
  if (d < 0) d = 0; else if (d > 1) d = 1;
  ctx.fillStyle = _mixHex(wcol.hi, wcol.lo, d * d);
  ctx.fillRect(px, py, TILE, TILE);
  // 岸线：邻陆方向的浅滩渐变带（沙色混入水中，越靠岸越浅）
  const SH = 7;
  const sd = _hexRGBOf(sand);
  const sand0 = 'rgba(' + sd[0] + ',' + sd[1] + ',' + sd[2] + ',0)';
  const shallow = 'rgba(' + sd[0] + ',' + sd[1] + ',' + sd[2] + ',.34)';
  const band = (land, gx0, gy0, gx1, gy1, bx, by, bw, bh) => {
    if (!land) return;
    const g = ctx.createLinearGradient(gx0, gy0, gx1, gy1);
    g.addColorStop(0, shallow);
    g.addColorStop(1, sand0);
    ctx.fillStyle = g;
    ctx.fillRect(px + bx, py + by, bw, bh);
  };
  band(nN !== T_WATER, px, py, px, py + SH, 0, 0, TILE, SH);
  band(nS !== T_WATER, px, py + TILE, px, py + TILE - SH, 0, TILE - SH, TILE, SH);
  band(nW !== T_WATER, px, py, px + SH, py, 0, 0, SH, TILE);
  band(nE !== T_WATER, px + TILE, py, px + TILE - SH, py, TILE - SH, 0, SH, TILE);
  // 泡沫水线：贴陆岸的细亮线
  ctx.fillStyle = 'rgba(232,246,255,.35)';
  if (nN !== T_WATER) ctx.fillRect(px, py, TILE, 1.5);
  if (nS !== T_WATER) ctx.fillRect(px, py + TILE - 1.5, TILE, 1.5);
  if (nW !== T_WATER) ctx.fillRect(px, py, 1.5, TILE);
  if (nE !== T_WATER) ctx.fillRect(px + TILE - 1.5, py, 1.5, TILE);
  // 斜角邻陆（两侧为水）：圆角浅滩光斑，让岸线转角圆润自然
  const corner = (diag, a, b, cxx, cyy) => {
    if (diag === T_WATER || a !== T_WATER || b !== T_WATER) return;
    const g = ctx.createRadialGradient(cxx, cyy, 0.5, cxx, cyy, 6);
    g.addColorStop(0, shallow);
    g.addColorStop(1, sand0);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cxx, cyy, 6, 0, 7);
    ctx.fill();
  };
  corner(nNW, nN, nW, px, py);
  corner(nNE, nN, nE, px + TILE, py);
  corner(nSW, nS, nW, px, py + TILE);
  corner(nSE, nS, nE, px + TILE, py + TILE);
}

// ===== 草地瓦片：草覆盖度分带（草稀露土/草密成片）+ 细节 + 岸滩 =====
// 覆盖度用双频值噪声在「泥土 ↔ 草色」间插值：贫瘠处露黄褐泥土、
// 肥沃处草色浓密，草稀/草密成片交错（而非满屏纯绿）；细节按覆盖度
// 分层点缀——密草区画草丛/野花，稀草区画枯黄短草，露土区画土粒/干裂纹。
function drawGrassTile(ctx, px, py, tx, ty, ext, dy, dx, pgrass, sand, pid) {
  const EW = CHUNK + 2;
  const r0 = (dy + 1) * EW + (dx + 1);
  const nN = ext[r0 - EW], nS = ext[r0 + EW], nW = ext[r0 - 1], nE = ext[r0 + 1];
  const dirt = DIRT_COLORS[pid] || DIRT_COLORS.nauvis;
  // 草覆盖度：大尺度斑块（哪片草稀/密）+ 中尺度纹理 + 微抖动，略偏草（+0.08）
  const n1 = valueNoise(tx * 0.062, ty * 0.062);
  const n2 = valueNoise(tx * 0.21 + 53.1, ty * 0.21 + 97.7);
  let cov = n1 * 0.7 + n2 * 0.3 + 0.08 + (hash2(tx * 1.31, ty * 2.17) - 0.5) * 0.1;
  if (cov < 0) cov = 0; else if (cov > 1) cov = 1;
  // 草色自身深浅（中尺度噪声，保持草场斑驳）
  const grassTone = _mixHex(pgrass[2], pgrass[0], n2);
  // smoothstep 拉开“露土/覆草”过渡：稀草带与密草带对比更清晰
  const cs = cov * cov * (3 - 2 * cov);
  const base = _mixHex(dirt, grassTone, cs);
  ctx.fillStyle = base;
  ctx.fillRect(px, py, TILE, TILE);
  // 岸滩：邻水的边铺一条沙带（水陆之间的海滩过渡）
  const SB = 8;
  let banded = false;
  if (nN === T_WATER) { ctx.fillStyle = sand; ctx.fillRect(px, py, TILE, SB); banded = true; }
  if (nS === T_WATER) { ctx.fillStyle = sand; ctx.fillRect(px, py + TILE - SB, TILE, SB); banded = true; }
  if (nW === T_WATER) { ctx.fillStyle = sand; ctx.fillRect(px, py, SB, TILE); banded = true; }
  if (nE === T_WATER) { ctx.fillStyle = sand; ctx.fillRect(px + TILE - SB, py, SB, TILE); banded = true; }
  if (banded) {
    // 沙粒（深色小点）+ 沙带内缘的过渡暗线，让滩涂有颗粒质感
    ctx.fillStyle = 'rgba(70,56,32,.3)';
    if (nN === T_WATER) { ctx.fillRect(px + 6, py + 2, 2, 1.5); ctx.fillRect(px + 15, py + 4, 2, 1.5); ctx.fillRect(px + 24, py + 3, 2, 1.5); }
    if (nS === T_WATER) { ctx.fillRect(px + 9, py + TILE - 4, 2, 1.5); ctx.fillRect(px + 20, py + TILE - 3, 2, 1.5); }
    if (nW === T_WATER) { ctx.fillRect(px + 2, py + 8, 2, 1.5); ctx.fillRect(px + 4, py + 18, 2, 1.5); ctx.fillRect(px + 3, py + 26, 2, 1.5); }
    if (nE === T_WATER) { ctx.fillRect(px + TILE - 4, py + 10, 2, 1.5); ctx.fillRect(px + TILE - 3, py + 22, 2, 1.5); }
    ctx.strokeStyle = 'rgba(60,48,28,.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    if (nN === T_WATER) { ctx.moveTo(px, py + SB - .5); ctx.lineTo(px + TILE, py + SB - .5); }
    if (nS === T_WATER) { ctx.moveTo(px, py + TILE - SB + .5); ctx.lineTo(px + TILE, py + TILE - SB + .5); }
    if (nW === T_WATER) { ctx.moveTo(px + SB - .5, py); ctx.lineTo(px + SB - .5, py + TILE); }
    if (nE === T_WATER) { ctx.moveTo(px + TILE - SB + .5, py); ctx.lineTo(px + TILE - SB + .5, py + TILE); }
    ctx.stroke();
  } else {
    // 斜角邻水：补一小块沙角，避免岸线出现“漏角”
    if (ext[r0 - EW - 1] === T_WATER) { ctx.fillStyle = sand; ctx.fillRect(px, py, 4, 4); }
    if (ext[r0 - EW + 1] === T_WATER) { ctx.fillStyle = sand; ctx.fillRect(px + TILE - 4, py, 4, 4); }
    if (ext[r0 + EW - 1] === T_WATER) { ctx.fillStyle = sand; ctx.fillRect(px, py + TILE - 4, 4, 4); }
    if (ext[r0 + EW + 1] === T_WATER) { ctx.fillStyle = sand; ctx.fillRect(px + TILE - 4, py + TILE - 4, 4, 4); }
    // 细节按覆盖度分层（滩涂上不画），同一 hash 分段互斥
    const hv = hash2(tx * 5.13, ty * 3.71);
    if (cov >= 0.55) {
      // ---- 密草区：草丛 / 碎石 / 野花 / 泥斑 ----
      if (hv < 0.5) {
        // 草丛：2~3 笔小 “V” 形草叶（草色的明/暗变体）
        ctx.strokeStyle = hv < 0.25 ? _shadeHex(grassTone, -0.22) : _shadeHex(grassTone, 0.26);
        ctx.lineWidth = 1;
        ctx.beginPath();
        const nT = 2 + (((hv * 100) | 0) & 1);
        for (let i = 0; i < nT; i++) {
          const gx = px + 5 + hash2(tx * 7 + i, ty * 3 - i) * (TILE - 10);
          const gy = py + 7 + hash2(tx * 2 - i, ty * 9 + i) * (TILE - 12);
          ctx.moveTo(gx - 1.6, gy + 3.2);
          ctx.lineTo(gx, gy - 1);
          ctx.lineTo(gx + 1.6, gy + 3.2);
        }
        ctx.stroke();
      } else if (hv < 0.62) {
        // 碎石：一颗带高光的小灰石
        const gx = px + 4 + hash2(tx * 9, ty * 5) * (TILE - 9);
        const gy = py + 4 + hash2(tx * 4, ty * 8) * (TILE - 9);
        ctx.fillStyle = 'rgba(120,118,110,.6)';
        ctx.beginPath();
        ctx.ellipse(gx, gy, 2.2, 1.7, hash2(tx, ty) * 3, 0, 7);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.18)';
        ctx.beginPath();
        ctx.ellipse(gx - 0.6, gy - 0.5, 0.9, 0.7, 0, 0, 7);
        ctx.fill();
      } else if (hv < 0.66 && (pid === 'nauvis' || pid === 'gleba')) {
        // 野花：两朵小白/小黄点（仅温带与沼泽行星，只长在草密处）
        const fx = px + 6 + hash2(tx * 6, ty * 4) * (TILE - 12);
        const fy = py + 6 + hash2(tx * 3, ty * 7) * (TILE - 12);
        ctx.fillStyle = hash2(tx, ty * 2) > 0.5 ? 'rgba(238,236,210,.85)' : 'rgba(224,196,106,.85)';
        ctx.beginPath();
        ctx.arc(fx, fy, 1.4, 0, 7);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(fx + 3, fy + 2.5, 1.1, 0, 7);
        ctx.fill();
      } else if (hv < 0.72) {
        // 泥斑：半透明土色小椭圆
        const mx = px + 5 + hash2(tx * 8, ty * 2) * (TILE - 12);
        const my = py + 5 + hash2(tx * 5, ty * 6) * (TILE - 12);
        ctx.fillStyle = 'rgba(105,84,58,.16)';
        ctx.beginPath();
        ctx.ellipse(mx, my, 3.5, 2.4, hash2(tx, ty * 3) * 3, 0, 7);
        ctx.fill();
      }
    } else if (cov >= 0.28) {
      // ---- 稀草区：枯黄短草 / 土粒 / 碎石 ----
      if (hv < 0.42) {
        // 短草：1~2 笔偏枯黄的细草（草色混土 → 干草色）
        const dryTone = _mixHex(grassTone, dirt, 0.45);
        ctx.strokeStyle = hv < 0.21 ? _shadeHex(dryTone, 0.12) : _shadeHex(dryTone, -0.12);
        ctx.lineWidth = 1;
        ctx.beginPath();
        const nT = 1 + (((hv * 100) | 0) & 1);
        for (let i = 0; i < nT; i++) {
          const gx = px + 5 + hash2(tx * 6 + i, ty * 4 - i) * (TILE - 10);
          const gy = py + 8 + hash2(tx * 3 - i, ty * 7 + i) * (TILE - 14);
          ctx.moveTo(gx - 1.2, gy + 2.4);
          ctx.lineTo(gx, gy - 0.6);
          ctx.lineTo(gx + 1.2, gy + 2.4);
        }
        ctx.stroke();
      } else if (hv < 0.58) {
        // 土粒：深浅两色土屑
        ctx.fillStyle = 'rgba(96,74,44,.34)';
        const gx1 = px + 5 + hash2(tx * 8, ty * 2) * (TILE - 12);
        const gy1 = py + 5 + hash2(tx * 5, ty * 6) * (TILE - 12);
        ctx.fillRect(gx1, gy1, 2, 1.5);
        ctx.fillRect(gx1 + 5, gy1 + 4, 2, 1.5);
        ctx.fillStyle = 'rgba(214,192,150,.3)';
        ctx.fillRect(gx1 + 2, gy1 + 7, 2, 1.5);
      } else if (hv < 0.66) {
        // 碎石：一颗带高光的小灰石
        const gx = px + 4 + hash2(tx * 9, ty * 5) * (TILE - 9);
        const gy = py + 4 + hash2(tx * 4, ty * 8) * (TILE - 9);
        ctx.fillStyle = 'rgba(120,118,110,.55)';
        ctx.beginPath();
        ctx.ellipse(gx, gy, 2.2, 1.7, hash2(tx, ty) * 3, 0, 7);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.16)';
        ctx.beginPath();
        ctx.ellipse(gx - 0.6, gy - 0.5, 0.9, 0.7, 0, 0, 7);
        ctx.fill();
      }
    } else {
      // ---- 露土区：土粒 / 干裂纹 / 碎石 ----
      if (hv < 0.45) {
        // 土粒：深浅两色土屑散布
        ctx.fillStyle = 'rgba(96,74,44,.32)';
        for (const [bx, by] of [[7, 9], [19, 21], [12, 25], [24, 8]]) ctx.fillRect(px + bx, py + by, 2, 1.5);
        ctx.fillStyle = 'rgba(214,192,150,.28)';
        for (const [bx, by] of [[15, 6], [9, 18], [23, 15]]) ctx.fillRect(px + bx, py + by, 2, 1.5);
      } else if (hv < 0.6) {
        // 干裂纹：浅色短折线（干土开裂）
        const cx0 = px + 4 + hash2(tx * 3, ty * 8) * (TILE - 12);
        const cy0 = py + 4 + hash2(tx * 7, ty * 2) * (TILE - 12);
        ctx.strokeStyle = 'rgba(230,212,176,.3)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(cx0, cy0);
        ctx.lineTo(cx0 + 4 + hash2(tx, ty) * 3, cy0 + 2 + hash2(ty, tx) * 3);
        ctx.lineTo(cx0 + 7 + hash2(tx * 2, ty * 3) * 3, cy0 + 5 + hash2(ty * 3, tx * 2) * 3);
        ctx.stroke();
      } else if (hv < 0.68) {
        // 碎石：一颗带高光的小灰石
        const gx = px + 4 + hash2(tx * 9, ty * 5) * (TILE - 9);
        const gy = py + 4 + hash2(tx * 4, ty * 8) * (TILE - 9);
        ctx.fillStyle = 'rgba(120,118,110,.55)';
        ctx.beginPath();
        ctx.ellipse(gx, gy, 2.2, 1.7, hash2(tx, ty) * 3, 0, 7);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.16)';
        ctx.beginPath();
        ctx.ellipse(gx - 0.6, gy - 0.5, 0.9, 0.7, 0, 0, 7);
        ctx.fill();
      }
    }
  }
}

// ===== 峭壁瓦片：岩体 + 横向层理 + 崖顶受光/崖脚背光 =====
// 北缘亮带 + 南缘暗带让成片峭壁呈现连续的“崖顶-崖面-崖脚”结构；
// 崖脚对南侧地面的投影由 drawChunkTerrainInto 末尾统一补画。
function drawCliffTile(ctx, px, py, tx, ty, ext, dy, dx) {
  const EW = CHUNK + 2;
  const r0 = (dy + 1) * EW + (dx + 1);
  const nN = ext[r0 - EW], nS = ext[r0 + EW], nW = ext[r0 - 1], nE = ext[r0 + 1];
  const v = hash2(tx, ty);
  ctx.fillStyle = v > 0.5 ? '#6d6a63' : '#65625c';
  ctx.fillRect(px, py, TILE, TILE);
  // 崖顶受光（北缘非峭壁时是崖顶）与左右侧缘的立体分隔
  if (nN !== T_CLIFF) {
    ctx.fillStyle = 'rgba(255,255,255,.18)';
    ctx.fillRect(px, py, TILE, 4);
    ctx.fillStyle = 'rgba(255,255,255,.09)';
    ctx.fillRect(px, py, TILE, 7);
  }
  if (nW !== T_CLIFF) { ctx.fillStyle = 'rgba(255,255,255,.07)'; ctx.fillRect(px, py, 2, TILE); }
  if (nE !== T_CLIFF) { ctx.fillStyle = 'rgba(0,0,0,.13)'; ctx.fillRect(px + TILE - 2, py, 2, TILE); }
  // 崖脚背光
  if (nS !== T_CLIFF) { ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(px, py + TILE - 4, TILE, 4); }
  // 横向岩层理（轻微起伏的沉积层）
  ctx.strokeStyle = 'rgba(35,33,29,.38)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const y1 = py + 9 + hash2(tx, ty * 3) * 3;
  ctx.moveTo(px, y1);
  ctx.lineTo(px + TILE, y1 + (hash2(tx * 2, ty) - 0.5) * 4);
  const y2 = py + 19 + hash2(tx * 3, ty * 5) * 3;
  ctx.moveTo(px, y2);
  ctx.lineTo(px + TILE, y2 + (hash2(tx, ty * 7) - 0.5) * 4);
  ctx.stroke();
  // 岩缝与碎石
  ctx.strokeStyle = 'rgba(30,28,24,.55)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(px + TILE * 0.3, py + TILE * 0.15); ctx.lineTo(px + TILE * 0.45, py + TILE * 0.5);
  ctx.lineTo(px + TILE * 0.3, py + TILE * 0.85);
  ctx.stroke();
  ctx.fillStyle = 'rgba(140,136,126,.6)';
  ctx.fillRect(px + TILE * 0.6, py + TILE * 0.35, 4, 4);
  ctx.fillRect(px + TILE * 0.7, py + TILE * 0.65, 3, 3);
}

// 绘制单棵树木（用 hash 决定树形/尺寸/色相，保证确定性）
// 结构：地面投影 → 树干 → 深色树冠底盘 → 中层受光 → 高光叶簇 → 叶间碎影
function drawTreeInto(ctx, px, py, tx, ty) {
  const h = hash2(tx * 3.7, ty * 7.1);
  const h2 = hash2(tx * 11.9, ty * 5.3);
  const s = 0.85 + h2 * 0.3;                    // 尺寸
  const cx = px + TILE / 2 + (h - 0.5) * 6;     // 树心水平偏移，打破网格感
  const baseY = py + TILE - 4 - h2 * 3;
  // 色相二选一（冷绿/暖绿）
  const leafD = h > 0.5 ? '#2b5620' : '#33602a';
  const leafM = h > 0.5 ? '#3b6e2e' : '#437836';
  const leafL = h > 0.5 ? '#549042' : '#5c9a4a';
  // 地面投影（椭圆阴影）
  ctx.fillStyle = 'rgba(18,28,14,.3)';
  ctx.beginPath();
  ctx.ellipse(cx + 2.2, baseY + 1, 8.5 * s, 3.1 * s, 0, 0, 7);
  ctx.fill();
  // 树干（下宽上窄梯形 + 左缘高光）
  ctx.fillStyle = '#5a4433';
  ctx.beginPath();
  ctx.moveTo(cx - 2.3 * s, baseY);
  ctx.lineTo(cx - 1.3 * s, baseY - 13 * s);
  ctx.lineTo(cx + 1.3 * s, baseY - 13 * s);
  ctx.lineTo(cx + 2.3 * s, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.14)';
  ctx.fillRect(cx - 2.0 * s, baseY - 12 * s, 1.0 * s, 11 * s);
  // 树冠：多球拼接
  const c = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); };
  ctx.fillStyle = leafD;   // 深色底盘（蓬松外轮廓）
  c(cx, baseY - 17 * s, 8.6 * s);
  c(cx - 6.2 * s, baseY - 12 * s, 5.8 * s);
  c(cx + 6.2 * s, baseY - 12 * s, 5.8 * s);
  c(cx - 2.8 * s, baseY - 23 * s, 5.6 * s);
  c(cx + 3.2 * s, baseY - 22 * s, 5.4 * s);
  ctx.fillStyle = leafM;   // 中层（主色，略小偏上 → 受光体积）
  c(cx - 1.5, baseY - 18.5 * s, 7.4 * s);
  c(cx - 6.4 * s, baseY - 13.5 * s, 4.6 * s);
  c(cx + 3.6 * s, baseY - 14.5 * s, 4.8 * s);
  c(cx + 0.6 * s, baseY - 24 * s, 4.4 * s);
  ctx.fillStyle = leafL;   // 高光叶簇（左上受光）
  c(cx - 2.6 * s, baseY - 24 * s, 3.6 * s);
  c(cx - 5.4 * s, baseY - 16 * s, 2.6 * s);
  ctx.fillStyle = leafD;   // 叶间碎影
  c(cx + 4.4 * s, baseY - 19 * s, 1.4 * s);
  c(cx - 1.2 * s, baseY - 13.5 * s, 1.2 * s);
  c(cx + 6.4 * s, baseY - 12.5 * s, 1.1 * s);
}
// 地形被修改（铺混凝土/石砖路/填海）后清除对应 chunk 的地形缓存。
// 新版地形会读取相邻格（岸线/滩涂/峭壁投影跨界过渡），所以位于 chunk 边缘的
// 格子被修改时，相邻 chunk 的缓存也要一并失效，避免跨界岸线残留旧画面。
function invalidateTerrainChunk(tx, ty) {
  const cx = Math.floor(tx / CHUNK), cy = Math.floor(ty / CHUNK);
  terrainChunkCache.delete(cx + ',' + cy);
  const lx = ((tx % CHUNK) + CHUNK) % CHUNK;
  const ly = ((ty % CHUNK) + CHUNK) % CHUNK;
  if (lx === 0) terrainChunkCache.delete((cx - 1) + ',' + cy);
  if (lx === CHUNK - 1) terrainChunkCache.delete((cx + 1) + ',' + cy);
  if (ly === 0) terrainChunkCache.delete(cx + ',' + (cy - 1));
  if (ly === CHUNK - 1) terrainChunkCache.delete(cx + ',' + (cy + 1));
}

// 获取指定 chunk 的离屏缓存画布；未命中时生成并写回 LRU。
function terrainChunkCanvas(cx, cy) {
  const key = cx + ',' + cy;
  let entry = terrainChunkCache.get(key);
  if (entry) {
    entry.last = ++terrainChunkCache._seq;
    terrainCacheStats.hits++;
    return entry.canvas;
  }
  const c = document.createElement('canvas');
  c.width = c.height = TERRAIN_CHUNK_PX;
  const cctx = c.getContext('2d');
  const start = performance.now();
  drawChunkTerrainInto(cctx, cx, cy);
  terrainCacheStats.rebuildMs = performance.now() - start;
  terrainChunkCache.set(key, { canvas: c, last: ++terrainChunkCache._seq });
  terrainCacheStats.misses++;
  terrainCacheStats.cached = terrainChunkCache.size;
  // LRU 淘汰：超出上限时移除最久未用的 chunk
  if (terrainChunkCache.size > TERRAIN_CHUNK_LRU_MAX) {
    let oldestKey = null, oldest = Infinity;
    for (const [k, v] of terrainChunkCache) {
      if (v.last < oldest) { oldest = v.last; oldestKey = k; }
    }
    if (oldestKey) terrainChunkCache.delete(oldestKey);
  }
  terrainCacheStats.cached = terrainChunkCache.size;
  return c;
}

// 新游戏/新种子时清空分块离屏缓存，避免残留旧世界地形。
function clearTerrainCache() {
  terrainChunkCache.clear();
  terrainCacheStats.hits = 0;
  terrainCacheStats.misses = 0;
  terrainCacheStats.cached = 0;
  if (oreChunkCache) oreChunkCache.clear();
}

// ===== 矿点离屏缓存（性能优化）=====
// 矿点渲染（底色 + 高光圆点，每个矿格多次 canvas 绘制）是随基地规模增长的主要每帧开销。
// 把每个 chunk 的矿点预渲染到离屏画布，仅当矿量变化（consumeOre）时将该 chunk 标记为脏并重绘，
// 未被开采的 chunk 直接复用缓存画布，大幅减少每帧 canvas 操作与字符串键分配。
const oreChunkCache = new Map();   // 'cx,cy' -> { canvas, dirty, last }
oreChunkCache._seq = 0;   // LRU 时钟序号
// 矿量变化后标记所在 chunk 的矿点缓存为脏（下一帧重绘）。
function markOreChunkDirty(tx, ty) {
  if (!oreChunkCache) return;
  const key = Math.floor(tx / CHUNK) + ',' + Math.floor(ty / CHUNK);
  const e = oreChunkCache.get(key);
  if (e) e.dirty = true;   // 未缓存则无需标记（首次获取时按未缓存处理）
}
// 构建某 chunk 的矿点缓存：把该 chunk 内所有矿点预渲染进离屏画布。
function buildOreChunk(cx, cy) {
  const c = getChunk(cx, cy);
  const cv = document.createElement('canvas');
  cv.width = cv.height = TERRAIN_CHUNK_PX;
  const cctx = cv.getContext('2d');
  const ox = cx * CHUNK, oy = cy * CHUNK;
  for (let dy = 0; dy < CHUNK; dy++) {
    for (let dx = 0; dx < CHUNK; dx++) {
      const idx = dy * CHUNK + dx;
      const ti = c.oreType[idx];
      if (ti < 0) continue;
      const tx = ox + dx, ty = oy + dy;
      const rem = G.world.remaining.get(tx + ',' + ty);
      const amt = rem !== undefined ? rem : c.oreAmt[idx];
      if (amt > 0) drawOreDots(cctx, dx * TILE, dy * TILE, oreItemId(ti), amt, tx, ty);
    }
  }
  return cv;
}
// 获取某 chunk 的矿点缓存画布；脏或未缓存时重建。
function oreChunkCanvas(cx, cy) {
  const key = cx + ',' + cy;
  let e = oreChunkCache.get(key);
  if (e && e.canvas && !e.dirty) { e.last = ++oreChunkCache._seq; return e.canvas; }
  const cv = buildOreChunk(cx, cy);
  oreChunkCache.set(key, { canvas: cv, dirty: false, last: ++oreChunkCache._seq });
  // LRU 淘汰：与地形缓存同理，避免探索地图增大时缓存无限膨胀（上限可配，默认同地形缓存上限）
  if (oreChunkCache.size > ORE_CHUNK_LRU_MAX) {
    let oldestKey = null, oldest = Infinity;
    for (const [k, v] of oreChunkCache) {
      if (v.last < oldest) { oldest = v.last; oldestKey = k; }
    }
    if (oldestKey) oreChunkCache.delete(oldestKey);
  }
  return cv;
}

function drawTerrain(ctx) {
  const b = viewBounds(_B);
  const tx0 = Math.floor(b.x1 / TILE);
  const ty0 = Math.floor(b.y1 / TILE);
  const tx1 = Math.ceil(b.x0 / TILE);
  const ty1 = Math.ceil(b.y0 / TILE);
  // 覆盖视口的 chunk 范围
  const cX0 = Math.floor(tx0 / CHUNK), cY0 = Math.floor(ty0 / CHUNK);
  const cX1 = Math.floor(tx1 / CHUNK), cY1 = Math.floor(ty1 / CHUNK);
  for (let cy = cY0; cy <= cY1; cy++) {
    for (let cx = cX0; cx <= cX1; cx++) {
      const c = terrainChunkCanvas(cx, cy);
      const sx = Math.max(cx * CHUNK, tx0) * TILE - cx * TERRAIN_CHUNK_PX;
      const sy = Math.max(cy * CHUNK, ty0) * TILE - cy * TERRAIN_CHUNK_PX;
      const dx = Math.max(cx * CHUNK, tx0) * TILE;
      const dy = Math.max(cy * CHUNK, ty0) * TILE;
      const ex = Math.min((cx + 1) * CHUNK - 1, tx1) * TILE + TILE;
      const ey = Math.min((cy + 1) * CHUNK - 1, ty1) * TILE + TILE;
      ctx.drawImage(c, sx, sy, ex - dx, ey - dy, dx, dy, ex - dx, ey - dy);
    }
  }
  // 矿点渲染（性能优化）：改为每 chunk 一张离屏缓存画布，仅矿量变化（consumeOre）时重绘该 chunk。
  // 未开采的 chunk 直接复用缓存，避免每帧对每个矿格执行多次 canvas 绘制与字符串键分配。
  // 与原地实时绘制语义完全一致（数据源同为 getOreAmt / remaining 与 oreAmt，仅绘制时机改为“脏时重建”）。
  for (let cy = cY0; cy <= cY1; cy++) {
    for (let cx = cX0; cx <= cX1; cx++) {
      const oc = oreChunkCanvas(cx, cy);
      const sx = Math.max(cx * CHUNK, tx0) * TILE - cx * TERRAIN_CHUNK_PX;
      const sy = Math.max(cy * CHUNK, ty0) * TILE - cy * TERRAIN_CHUNK_PX;
      const dx = Math.max(cx * CHUNK, tx0) * TILE;
      const dy = Math.max(cy * CHUNK, ty0) * TILE;
      const ex = Math.min((cx + 1) * CHUNK - 1, tx1) * TILE + TILE;
      const ey = Math.min((cy + 1) * CHUNK - 1, ty1) * TILE + TILE;
      ctx.drawImage(oc, sx, sy, ex - dx, ey - dy, dx, dy, ex - dx, ey - dy);
    }
  }
  // 动态水面波浪（画面优化）：在水域瓦片叠加缓缓流动的高光波纹。
  // 缩放很小时（瓦片 <20px）弧线在屏幕上已不可辨，而每水域瓦片要做两次 beginPath/arc/stroke，
  // 视野内通常有成片水域，全景缩放下是 render() 的显著开销 → 直接跳过（渲染卡顿优化）。
  if (!LOD.simple) drawWaterAnimation(ctx, tx0, ty0, tx1, ty1);
  terrainCacheStats.state = '分块缓存（' + terrainChunkCache.size + '/' + TERRAIN_CHUNK_LRU_MAX + ' 张，命中 ' + terrainCacheStats.hits + ' / 未命中 ' + terrainCacheStats.misses + '）';
}

// 动态水面：对可见范围内的水域瓦片绘制缓慢漂移的波光，营造“水面流动”感。
// 只在主渲染层叠加（不写入离屏缓存），避免破坏缓存复用；波光基于时间与瓦片坐标做确定性错相。
function drawWaterAnimation(ctx, tx0, ty0, tx1, ty1) {
  if (!G || !G.time) return;
  const t = G.time;
  ctx.lineCap = 'round';
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (getTerrain(tx, ty) !== T_WATER) continue;
      const px = tx * TILE, py = ty * TILE;
      const phase = hash2(tx, ty) * 6.2832;
      // 波光：随波漂移的短弧线高光，随时间闪烁（负相位直接跳过，约一半时间可见）
      const a = 0.1 + 0.09 * Math.sin(t * 1.1 + phase);
      if (a <= 0.02) continue;
      const driftX = Math.sin(t * 0.35 + phase) * 6;
      const driftY = Math.cos(t * 0.3 + phase * 1.3) * 3;
      const wx = px + TILE / 2 + driftX, wy = py + TILE / 2 + driftY;
      ctx.strokeStyle = 'rgba(205,232,250,' + a.toFixed(3) + ')';
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(wx - 4.5, wy);
      ctx.quadraticCurveTo(wx, wy - 1.8, wx + 4.5, wy);
      ctx.stroke();
      // 偶发星光点（约 1/3 水格出现，频率更高、更亮，模拟阳光碎金）
      if (hash2(tx * 1.7, ty * 2.3) > 0.62) {
        const sp = 0.5 + 0.5 * Math.sin(t * 2.2 + phase * 2);
        if (sp > 0.35) {
          ctx.fillStyle = 'rgba(235,248,255,' + (sp * 0.35).toFixed(3) + ')';
          ctx.beginPath();
          ctx.arc(px + 8 + hash2(tx * 3, ty) * (TILE - 16), py + 8 + hash2(tx, ty * 3) * (TILE - 16), 1.3, 0, 7);
          ctx.fill();
        }
      }
    }
  }
}

function drawOreDots(ctx, px, py, itemId, amt, tx, ty) {
  const n = itemId === 'crude-oil'
    ? Math.max(1, Math.min(3, Math.round(Math.sqrt(Math.max(amt, 0)) / 40)))
    : Math.max(2, Math.min(7, Math.round(Math.sqrt(Math.max(amt, 0)) / 9)));
  const col = ITEMS[itemId].color;
  // 矿脉底色：柔和的有机圆斑（略压扁+旋转，形状随格子确定性变化），
  // 替代旧版方框，让矿团边缘自然融入草地（画面优化）
  ctx.fillStyle = 'rgba(' + hexToRgb(col) + ',0.16)';
  ctx.beginPath();
  ctx.ellipse(px + TILE / 2, py + TILE / 2, TILE * 0.46, TILE * 0.4, hash2(tx * 0.7, ty * 1.9) * 3, 0, 7);
  ctx.fill();
  ctx.fillStyle = col;
  ctx.strokeStyle = 'rgba(0,0,0,.3)';
  ctx.lineWidth = 1;
  const rad = itemId === 'crude-oil' ? 5.5 : null;
  for (let i = 0; i < n; i++) {
    const ox = hash2(tx * 13 + i, ty * 71 - i);
    const oy = hash2(tx * 29 - i, ty * 17 + i);
    if (rad) { // 原油：油池样式
      ctx.beginPath();
      ctx.ellipse(px + 6 + ox * (TILE - 12), py + 6 + oy * (TILE - 12), rad * (0.8 + ox * 0.5), rad * (0.6 + oy * 0.4), ox * 3, 0, 7);
      ctx.fill();
      ctx.stroke();
      // 原油反光高光
      ctx.fillStyle = 'rgba(255,255,255,.22)';
      ctx.beginPath();
      ctx.ellipse(px + 6 + ox * (TILE - 12) - rad * 0.3, py + 6 + oy * (TILE - 12) - rad * 0.25, rad * 0.28, rad * 0.18, ox * 3, 0, 7);
      ctx.fill();
      ctx.fillStyle = col;
      continue;
    }
    const r = 2 + hash2(tx + i, ty + i) * 1.4;
    const cx = px + 5 + ox * (TILE - 10), cy = py + 5 + oy * (TILE - 10);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, 7);
    ctx.fill();
    ctx.stroke();
    // 矿物顶部高光，增加立体感（画面优化）
    ctx.fillStyle = 'rgba(255,255,255,.28)';
    ctx.beginPath();
    ctx.arc(cx - r * 0.3, cy - r * 0.35, r * 0.35, 0, 7);
    ctx.fill();
    ctx.fillStyle = col;
  }
}

// 辅助：把 #rrggbb 颜色转成 'r,g,b' 字符串（用于矿格底色半透明填充）
// 性能优化：颜色值在运行期基本不变（ITEM 色表恒定），用缓存避免每帧对每个可见矿格重复 slice/parseInt。
// 纯函数确定性缓存，不影响任何返回结果（仅加速）。
const _hexRgbCache = {};
function hexToRgb(hex) {
  const c = _hexRgbCache[hex];
  if (c !== undefined) return c;
  let h = hex;
  if (h.charAt(0) === '#') h = h.slice(1);
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  let out;
  if (isNaN(n)) out = '128,128,128';
  else out = ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
  _hexRgbCache[hex] = out;
  return out;
}

function drawGridIfBuilding(ctx) {
  if (!buildActive() && !G.panelEnt) return;
  const b = viewBounds(_B);
  const tx0 = Math.floor(b.x1 / TILE);
  const ty0 = Math.floor(b.y1 / TILE);
  const tx1 = Math.ceil(b.x0 / TILE);
  const ty1 = Math.ceil(b.y0 / TILE);
  ctx.strokeStyle = 'rgba(255,255,255,.07)';
  ctx.lineWidth = 1 / G.cam.z;
  ctx.beginPath();
  for (let tx = tx0; tx <= tx1 + 1; tx++) { ctx.moveTo(tx * TILE, ty0 * TILE); ctx.lineTo(tx * TILE, (ty1 + 1) * TILE); }
  for (let ty = ty0; ty <= ty1 + 1; ty++) { ctx.moveTo(tx0 * TILE, ty * TILE); ctx.lineTo((tx1 + 1) * TILE, ty * TILE); }
  ctx.stroke();
}

function tileCenterPx(tx, ty) { return [tx * TILE + TILE / 2, ty * TILE + TILE / 2]; }

// ===== 蓝图/红图叠加层 =====
function drawBlueprintOverlay(ctx) {
  if (!G.blueMode) return;
  // 红图 / 蓝图 / 绿图框选区域（拖拽中）
  if ((G.blueMode === 'blue' || G.blueMode === 'red' || G.blueMode === 'green') && G.blueStart && G.blueEnd) {
    const x0 = Math.min(G.blueStart.tx, G.blueEnd.tx);
    const y0 = Math.min(G.blueStart.ty, G.blueEnd.ty);
    const x1 = Math.max(G.blueStart.tx, G.blueEnd.tx);
    const y1 = Math.max(G.blueStart.ty, G.blueEnd.ty);
    const mode = G.blueMode;
    const col = mode === 'red' ? [230, 70, 70] : mode === 'green' ? [80, 200, 110] : [90, 160, 255];
    ctx.fillStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',.16)';
    ctx.fillRect(x0 * TILE, y0 * TILE, (x1 - x0 + 1) * TILE, (y1 - y0 + 1) * TILE);
    ctx.strokeStyle = 'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',.95)';
    ctx.lineWidth = 2 / G.cam.z;
    ctx.setLineDash([6 / G.cam.z, 4 / G.cam.z]);
    ctx.strokeRect(x0 * TILE, y0 * TILE, (x1 - x0 + 1) * TILE, (y1 - y0 + 1) * TILE);
    ctx.setLineDash([]);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText((mode === 'red' ? '红图：删除整块' : mode === 'green' ? '绿图：升级/降级整块' : '蓝图：复制整块') + ' ' +
      (x1 - x0 + 1) + '×' + (y1 - y0 + 1), x0 * TILE + 4, y0 * TILE - 14);
    return;
  }
  // 蓝图粘贴预览
  if (G.blueMode === 'paste' && G.blueprint && G.cursorTile) {
    const bp = applyBlueprintTransform();
    const ox = G.cursorTile.tx - bp.minX;
    const oy = G.cursorTile.ty - bp.minY;
    for (const s of bp.ents) {
      const cls = ENT_CLASSES[s.type];
      if (!cls) continue;
      const nx = s.x + ox, ny = s.y + oy;
      const tmp = cls.restore(Object.assign({}, s, { x: nx, y: ny }));
      tmp.dir = s.dir | 0; tmp.applyDir();
      const ok = canPlaceAt(s.type, nx, ny, tmp.dir).ok;
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = ok ? 'rgba(120,220,120,.18)' : 'rgba(230,80,80,.22)';
      ctx.fillRect(nx * TILE, ny * TILE, tmp.w * TILE, tmp.h * TILE);
      ctx.strokeStyle = ok ? 'rgba(140,255,140,.9)' : 'rgba(255,110,110,.9)';
      ctx.lineWidth = 1.5 / G.cam.z;
      ctx.strokeRect(nx * TILE + 1, ny * TILE + 1, tmp.w * TILE - 2, tmp.h * TILE - 2);
      ctx.globalAlpha = 1;
    }
    ctx.fillStyle = '#8fd0ff';
    ctx.font = 'bold 13px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('点击放置蓝图 · 右键取消（R 旋转，V/H 翻转）', G.cursorTile.tx * TILE + TILE / 2, G.cursorTile.ty * TILE - 14);
  }
}

