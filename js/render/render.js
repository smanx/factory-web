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
const LOD_SIMPLE_PX = 14;

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
  const drawPass = (e, drawInserter) => {
    if (e._dead || !onScreen(e)) return;
    if (drawInserter !== !!IS_INSERTER[e.type]) return;
    drawEntity(ctx, e, e.x, e.y, e.dir, 1);
  };
  if (keys) {
    forEachEntInBuckets(keys, e => drawPass(e, false), _bucketSeenBuf);   // 普通设备（含传送带等）
    forEachEntInBuckets(keys, e => drawPass(e, true), _bucketSeenBuf);    // 机械臂置顶
  } else {
    for (const e of G.ents) drawPass(e, false);
    for (const e of G.ents) drawPass(e, true);
  }
  // ALT 模式（对齐《异星工厂》）：在建筑上叠加显示当前配方/内容标签
  if (G.settings.altMode) drawAltMode(ctx, keys, _bucketSeenBuf);
  drawGhost(ctx);
  drawBlueprintOverlay(ctx);
  drawHoverAndMining(ctx);
  drawPlayer(ctx);
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

// 仅绘制单个 chunk 的地形底色（草地/水域），不含矿点
function drawChunkTerrainInto(ctx, cx, cy) {
  // 行星地表主色调：不同星球草地颜色不同（祝融赭石 / 句芒深绿 / 雷神灰 / 玄冥冰蓝）
  const pgrass = (typeof planetGrassColors === 'function') ? planetGrassColors() : ['#4f7c3b', '#4a7538', '#456f35'];
  const ox = cx * CHUNK, oy = cy * CHUNK;
  for (let dy = 0; dy < CHUNK; dy++) {
    for (let dx = 0; dx < CHUNK; dx++) {
      const tx = ox + dx, ty = oy + dy;
      const px = dx * TILE, py = dy * TILE;
      const t = getTerrain(tx, ty);
      if (t === T_WATER) {
        ctx.fillStyle = hash2(tx, ty) > 0.5 ? '#265d8a' : '#28618f';
        ctx.fillRect(px, py, TILE, TILE);
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
        // 峭壁（对齐《异星工厂》Cliff）：灰褐色岩体 + 岩缝，比周围地面略高
        const v = hash2(tx, ty);
        ctx.fillStyle = v > 0.5 ? '#6d6a63' : '#65625c';
        ctx.fillRect(px, py, TILE, TILE);
        // 岩体立体边缘（左上受光，右下背光）
        ctx.fillStyle = 'rgba(255,255,255,.16)';
        ctx.beginPath();
        ctx.moveTo(px, py); ctx.lineTo(px + TILE, py); ctx.lineTo(px, py + TILE);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,.28)';
        ctx.beginPath();
        ctx.moveTo(px + TILE, py); ctx.lineTo(px + TILE, py + TILE); ctx.lineTo(px, py + TILE);
        ctx.closePath(); ctx.fill();
        // 岩缝与碎石
        ctx.strokeStyle = 'rgba(30,28,24,.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(px + TILE * 0.3, py + TILE * 0.15); ctx.lineTo(px + TILE * 0.45, py + TILE * 0.5);
        ctx.lineTo(px + TILE * 0.3, py + TILE * 0.85);
        ctx.stroke();
        ctx.fillStyle = 'rgba(140,136,126,.7)';
        ctx.fillRect(px + TILE * 0.6, py + TILE * 0.35, 4, 4);
        ctx.fillRect(px + TILE * 0.7, py + TILE * 0.65, 3, 3);
        continue;
      }
      const v = hash2(tx, ty);
      ctx.fillStyle = v > 0.62 ? pgrass[0] : v > 0.3 ? pgrass[1] : pgrass[2];
      ctx.fillRect(px, py, TILE, TILE);
      if (t === T_TREE) drawTreeInto(ctx, px, py, tx, ty);
    }
  }
}

// 绘制单棵树木（用 hash 决定树形与枝叶细节，保证确定性）
function drawTreeInto(ctx, px, py, tx, ty) {
  const h = hash2(tx * 3.7, ty * 7.1);
  const cx = px + TILE / 2;
  const baseY = py + TILE;
  // 树干
  ctx.fillStyle = '#5c4630';
  ctx.fillRect(cx - 2.5, baseY - 13, 5, 13);
  // 树冠：三层圆形/多边形枝叶
  ctx.fillStyle = h > 0.5 ? '#2e5d22' : '#376b2a';
  ctx.beginPath();
  ctx.arc(cx, baseY - 18, 7 + h * 2, 0, 7); ctx.fill();
  ctx.beginPath();
  ctx.arc(cx - 4, baseY - 13, 5, 0, 7); ctx.fill();
  ctx.beginPath();
  ctx.arc(cx + 4, baseY - 13, 5, 0, 7); ctx.fill();
  // 顶部高光
  ctx.fillStyle = 'rgba(140,220,120,.35)';
  ctx.beginPath();
  ctx.arc(cx - 1, baseY - 20, 3, 0, 7); ctx.fill();
}
// 地形被修改（铺混凝土/石砖路/填海）后清除对应 chunk 的地形缓存
function invalidateTerrainChunk(tx, ty) {
  terrainChunkCache.delete(Math.floor(tx / CHUNK) + ',' + Math.floor(ty / CHUNK));
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
  // 动态水面波浪（画面优化）：在水域瓦片叠加缓缓流动的高光波纹
  drawWaterAnimation(ctx, tx0, ty0, tx1, ty1);
  terrainCacheStats.state = '分块缓存（' + terrainChunkCache.size + '/' + TERRAIN_CHUNK_LRU_MAX + ' 张，命中 ' + terrainCacheStats.hits + ' / 未命中 ' + terrainCacheStats.misses + '）';
}

// 动态水面：对可见范围内的水域瓦片绘制缓慢漂移的高光波纹，营造“水面流动”感。
// 只在主渲染层叠加（不写入离屏缓存），避免破坏缓存复用；波纹基于时间与瓦片坐标做确定性错相。
function drawWaterAnimation(ctx, tx0, ty0, tx1, ty1) {
  if (!G || !G.time) return;
  const t = G.time;
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (getTerrain(tx, ty) !== T_WATER) continue;
      const px = tx * TILE, py = ty * TILE;
      // 缓慢漂移的高光波纹：位置随世界坐标与时间缓慢移动，随机错相避免整齐划一
      const phase = hash2(tx, ty) * 6.2832;
      const driftX = Math.sin(t * 0.4 + phase) * 5;
      const driftY = Math.cos(t * 0.32 + phase * 1.3) * 4;
      // 主高光弧线（半透明白色，随波漂移）
      const a = 0.12 + 0.08 * Math.sin(t * 1.2 + phase);
      ctx.strokeStyle = 'rgba(190,220,245,' + a.toFixed(3) + ')';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(px + TILE / 2 + driftX, py + TILE / 2 + driftY, TILE * 0.32, Math.PI * 0.2, Math.PI * 1.6);
      ctx.stroke();
      // 更浅的第二道副波纹
      ctx.strokeStyle = 'rgba(200,225,250,' + (a * 0.7).toFixed(3) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px + TILE / 2 - driftX * 0.6, py + TILE / 2 - driftY * 0.6, TILE * 0.2, Math.PI * 0.4, Math.PI * 1.8);
      ctx.stroke();
    }
  }
}

function drawOreDots(ctx, px, py, itemId, amt, tx, ty) {
  const n = itemId === 'crude-oil'
    ? Math.max(1, Math.min(3, Math.round(Math.sqrt(Math.max(amt, 0)) / 40)))
    : Math.max(2, Math.min(7, Math.round(Math.sqrt(Math.max(amt, 0)) / 9)));
  const col = ITEMS[itemId].color;
  // 在矿格上铺一层淡淡的底色，让矿脉更醒目、更具“富矿感”（画面优化）
  ctx.fillStyle = 'rgba(' + hexToRgb(col) + ',0.18)';
  ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
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

