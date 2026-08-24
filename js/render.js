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
}

function updateCamera(dt) {
  const cam = G.cam;
  const pan = cam.pan || { x: 0, y: 0 };
  // 触屏拖动平移时：相机跟随玩家，但在玩家基础上附加 pan 偏移；
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
  // 空间分区（桶）索引：只遍历视口覆盖到的桶，避免对全量 G.ents 线性扫描（P0 优化）
  // 机械臂（Inserter 族）最后单独绘制在最上层，避免被传送带/其他设备遮挡。
  const keys = (G.buckets && G.buckets.size)
    ? bucketKeysIn(
        Math.floor(FRAME_BOUNDS.x1 / TILE) - BUCK, Math.floor(FRAME_BOUNDS.y1 / TILE) - BUCK,
        Math.ceil(FRAME_BOUNDS.x0 / TILE) + BUCK, Math.ceil(FRAME_BOUNDS.y0 / TILE) + BUCK)
    : null;
  const drawPass = (e, drawInserter) => {
    if (e._dead || !onScreen(e)) return;
    if (drawInserter !== !!IS_INSERTER[e.type]) return;
    drawEntity(ctx, e, e.x, e.y, e.dir, 1);
  };
  if (keys) {
    forEachEntInBuckets(keys, e => drawPass(e, false));   // 普通设备（含传送带等）
    forEachEntInBuckets(keys, e => drawPass(e, true));    // 机械臂置顶
  } else {
    for (const e of G.ents) drawPass(e, false);
    for (const e of G.ents) drawPass(e, true);
  }
  drawGhost(ctx);
  drawBlueprintOverlay(ctx);
  drawHoverAndMining(ctx);
  drawPlayer(ctx);
  drawEnemies(ctx);
  drawBullets(ctx);
  drawCombatRobots(ctx);
  drawLootDrops(ctx);
  drawLogisticsRobots(ctx);
  if (typeof drawConstruction === 'function') drawConstruction(ctx);
  ctx.restore();

  // 昼夜黑暗遮罩：夜晚整个世界变暗（由 solarFactor 推算），夜视仪可抵消
  if (typeof solarFactor === 'function' && typeof hasNightVision === 'function') {
    const ph = ((G.time / DAY_CYCLE) % 1 + 1) % 1;
    let dark = 0;
    if (ph < 0.25 || ph >= 0.75) dark = 0.4;        // 深夜
    else if (ph < 0.32) dark = (0.32 - ph) / 0.07 * 0.4;  // 黄昏过渡
    else if (ph >= 0.68) dark = (ph - 0.68) / 0.07 * 0.4; // 黎明过渡
    if (hasNightVision()) dark *= 0.12;              // 夜视仪：大幅削弱黑暗
    if (dark > 0.01) {
      ctx.fillStyle = 'rgba(6,10,18,' + dark.toFixed(3) + ')';
      ctx.fillRect(0, 0, W, H);
      // 电灯：在黑暗遮罩上凿出光圈并叠加暖色光晕（需夜间有点灯设备时）
      if (typeof drawLampLights === 'function' && !hasNightVision()) drawLampLights(ctx, dark);
    }
  }

  // 小地图（位于画布右下角）
  if (G.settings && G.settings.minimap !== false) drawMinimap(ctx);
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
        Math.ceil(FRAME_BOUNDS.x0 / TILE) + 6, Math.ceil(FRAME_BOUNDS.y0 / TILE) + 6)
    : null;
  const sx = (wx) => (wx - cam.px) * z + W / 2;
  const sy = (wy) => (wy - cam.py) * z + H / 2;
  let first = true;
  const punch = (e) => {
    if (!e._dead && e.type === 'lamp' && e.shouldLight && e.shouldLight()) {
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
  if (keys) forEachEntInBuckets(keys, punch);
  else for (const e of G.ents) punch(e);
  if (!first) ctx.restore();
  // 叠加暖色光晕（半透明黄色辉光，重新正常混合）
  let drewGlow = false;
  const glow = (e) => {
    if (!e._dead && e.type === 'lamp' && e.shouldLight && e.shouldLight()) {
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
  if (keys) forEachEntInBuckets(keys, glow);
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
// 把 8000 次逐格 fillRect 降为几次 blit。矿点随开采变化，仍每帧实时绘制在缓存之上。
const terrainCacheStats = { state: '未启用', rebuildMs: 0, lastRebuild: 0, hits: 0, misses: 0, cached: 0 };
const TERRAIN_CHUNK_LRU_MAX = 16;   // 分块离屏缓存上限（张）
const TERRAIN_CHUNK_PX = CHUNK * TILE;   // 1024
const terrainChunkCache = new Map();   // 'cx,cy' -> { canvas, last }
terrainChunkCache._seq = 0;   // LRU 时钟序号

// 仅绘制单个 chunk 的地形底色（草地/水域），不含矿点
function drawChunkTerrainInto(ctx, cx, cy) {
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
      const v = hash2(tx, ty);
      ctx.fillStyle = v > 0.62 ? '#4f7c3b' : v > 0.3 ? '#4a7538' : '#456f35';
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
  // 矿点每帧实时绘制（随开采实时减少）
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const ti = getOreType(tx, ty);
      if (ti >= 0 && getOreAmt(tx, ty) > 0)
        drawOreDots(ctx, tx * TILE, ty * TILE, oreItemId(ti), getOreAmt(tx, ty), tx, ty);
    }
  }
  terrainCacheStats.state = '分块缓存（' + terrainChunkCache.size + '/' + TERRAIN_CHUNK_LRU_MAX + ' 张，命中 ' + terrainCacheStats.hits + ' / 未命中 ' + terrainCacheStats.misses + '）';
}

function drawOreDots(ctx, px, py, itemId, amt, tx, ty) {
  const n = itemId === 'crude-oil'
    ? Math.max(1, Math.min(3, Math.round(Math.sqrt(Math.max(amt, 0)) / 40)))
    : Math.max(2, Math.min(7, Math.round(Math.sqrt(Math.max(amt, 0)) / 9)));
  ctx.fillStyle = ITEMS[itemId].color;
  ctx.strokeStyle = 'rgba(0,0,0,.25)';
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
      continue;
    }
    const r = 2 + hash2(tx + i, ty + i) * 1.4;
    ctx.beginPath();
    ctx.arc(px + 5 + ox * (TILE - 10), py + 5 + oy * (TILE - 10), r, 0, 7);
    ctx.fill();
    ctx.stroke();
  }
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

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + d * t;
}

// ===== 实体绘制分发 =====
// 各设备的绘制函数与状态灯颜色在 js/devices/*.js 里注册到 DEVICE_RENDER/DEVICE_STATUS。
function drawStatusDot(ctx, x, y, c) {
  const col = { g: '#57e389', y: '#ffd23c', r: '#ff5b5b' }[c] || '#888';
  ctx.fillStyle = '#14161a';
  ctx.beginPath();
  ctx.arc(x, y, 5.4, 0, 7);
  ctx.fill();
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(x, y, 3.9, 0, 7);
  ctx.fill();
}

function drawEntity(ctx, e, gx, gy, dir, alpha) {
  const fn = DEVICE_RENDER[e.type];
  if (fn) fn(ctx, e, gx, gy, dir, alpha);
  // 建筑受损：绘制耐久条与裂纹（对齐《异星工厂》建筑受击表现）
  if (alpha === 1 && e.maxhp > 0 && e.hp !== undefined && e.hp < e.maxhp) {
    const px = gx * TILE, py = gy * TILE, w = e.w * TILE, h = e.h * TILE;
    // 裂纹随受损程度加深
    const ratio = e.hp / e.maxhp;
    if (ratio < 0.5) {
      ctx.strokeStyle = 'rgba(20,20,20,.55)';
      ctx.lineWidth = Math.max(1, 12 * (1 - ratio));
      ctx.beginPath();
      ctx.moveTo(px + w * 0.25, py + h * 0.2); ctx.lineTo(px + w * 0.5, py + h * 0.5);
      ctx.lineTo(px + w * 0.35, py + h * 0.85);
      ctx.stroke();
    }
    // 顶部耐久条（HP 低时更醒目）
    if (ratio < 0.75) {
      const barW = Math.min(w, TILE * 2.4), barH = 3;
      const bx = gx * TILE + (w - barW) / 2, by = py - 4;
      ctx.fillStyle = 'rgba(10,10,12,.6)';
      ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
      ctx.fillStyle = ratio > 0.5 ? '#7ec850' : (ratio > 0.25 ? '#e0b23c' : '#e04a3a');
      ctx.fillRect(bx, by, barW * ratio, barH);
    }
  }
  // 低 LOD 时跳过状态灯（像素太小看不清，省一次 path+fill）
  if (alpha === 1 && !LOD.simple) {
    const sf = DEVICE_STATUS[e.type];
    const c = sf ? sf(e) : null;
    if (c) drawStatusDot(ctx, (gx + e.w) * TILE - 8, gy + 8, c);
  }
}

// 机械臂类型集合：绘制时置顶，永远显示在传送带/其他设备之上，不被遮挡。
const IS_INSERTER = { inserter: true, 'long-inserter': true, 'filter-inserter': true, 'stack-inserter': true };

const ghostCache = { type: null, ent: null };

function getGhostEnt(type) {
  if (ghostCache.type !== type) {
    ghostCache.type = type;
    ghostCache.ent = new (ENT_CLASSES[type])(type, 0, 0);
  }
  return ghostCache.ent;
}

function drawGhost(ctx) {
  if (!buildActive() || !G.cursorTile || !G.canvasActive) return;
  const type = selItem();
  if (!type) return;
  const def = BUILD_DEFS[type];
  let ew = def.w, eh = def.h;
  if (def.rotSwap && (G.ghostDir % 2 === 1)) { ew = def.h; eh = def.w; }
  // 不允许覆盖建造：目标格已有实体时判定为红色不可放置，与建造行为一致。
  const chk = canPlaceAt(type, G.cursorTile.tx, G.cursorTile.ty, G.ghostDir);
  const tmp = getGhostEnt(type);
  tmp.dir = G.ghostDir;
  tmp.w = ew; tmp.h = eh;
  drawEntity(ctx, tmp, G.cursorTile.tx, G.cursorTile.ty, G.ghostDir, 0.55);
  ctx.fillStyle = chk.ok ? 'rgba(120,220,120,.18)' : 'rgba(230,80,80,.22)';
  ctx.fillRect(G.cursorTile.tx * TILE, G.cursorTile.ty * TILE, ew * TILE, eh * TILE);
  ctx.strokeStyle = chk.ok ? 'rgba(140,255,140,.9)' : 'rgba(255,110,110,.9)';
  ctx.lineWidth = 2 / G.cam.z;
  ctx.strokeRect(G.cursorTile.tx * TILE, G.cursorTile.ty * TILE, ew * TILE, eh * TILE);
}

// 放置校验：默认规则（不能压水/已有实体/超出触及范围）+ 设备自定义规则
// （DEVICE_PLACE[type] 返回 {ok} 则短路，返回 null 则继续默认校验）
// 不允许覆盖建造：目标格已有实体时返回 {ok:false}，由调用方提示。
function canPlaceAt(type, tx, ty, dir) {
  const def = BUILD_DEFS[type];
  let ew = def.w, eh = def.h;
  if (def.rotSwap && (dir % 2 === 1)) { ew = def.h; eh = def.w; }
  const rule = DEVICE_PLACE[type];
  if (rule) {
    const r = rule(type, tx, ty, dir, ew, eh);
    if (r) return r;
  }
  for (let dy = 0; dy < eh; dy++)
    for (let dx = 0; dx < ew; dx++) {
      if (isWater(tx + dx, ty + dy)) return { ok: false };
      // 树木阻挡建造（对齐《异星工厂》：需先砍树清空场地）
      if (getTerrain(tx + dx, ty + dy) === T_TREE) return { ok: false };
      if (entAt(tx + dx, ty + dy)) {
        // 传送带升级/降级覆盖：用带系/地下带/分流器的同类覆盖现有同族带（对齐《异星工厂》覆盖升级）
        // 但反向传送带视为障碍（不参与覆盖），交由自动地下带逻辑跨越处理
        const e = entAt(tx + dx, ty + dy);
        const reversed = e instanceof Belt && Math.abs(((e.dir - dir) % 4 + 4) % 4) === 2;
        if (!reversed && canOverwriteWithBelt(type, e)) continue;
        return { ok: false };
      }
      if (!withinReach(tx + dx, ty + dy)) return { ok: false };
    }
  return { ok: true };
}

// 判断能否用 type 覆盖现有实体 e（仅限同族物流链：传送带/地下带/分流器按各自链条覆盖）
function canOverwriteWithBelt(type, e) {
  if (!e) return false;
  // 1×1 且属于同一条升级链（传送带覆盖传送带、地下带覆盖地下带、分流器覆盖分流器）
  if (!sameTierFamily(type, e.type)) return false;
  return true;
}

function drawHoverAndMining(ctx) {
  if (!G.cursorTile) return;
  const { tx, ty } = G.cursorTile;
  const e = entAt(tx, ty);
  // 拆除模式：红色高亮光标所在建筑，提示将被拆除（替代手机端无法使用的右键）
  if (G.deconstructMode) {
    if (e && withinReach(tx, ty)) {
      ctx.fillStyle = 'rgba(230,60,60,.22)';
      ctx.fillRect(e.x * TILE, e.y * TILE, e.w * TILE, e.h * TILE);
      ctx.strokeStyle = 'rgba(255,90,90,.95)';
      ctx.lineWidth = 2.5 / G.cam.z;
      ctx.strokeRect(e.x * TILE + 1, e.y * TILE + 1, e.w * TILE - 2, e.h * TILE - 2);
      // 画红色叉
      const cx = e.x * TILE + e.w * TILE / 2, cy = e.y * TILE + e.h * TILE / 2;
      const r = Math.min(e.w * TILE, e.h * TILE) * 0.28;
      ctx.beginPath();
      ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r);
      ctx.moveTo(cx + r, cy - r); ctx.lineTo(cx - r, cy + r);
      ctx.stroke();
    } else if (withinReach(tx, ty)) {
      // 空白格：淡红提示拆除模式已开启
      ctx.fillStyle = 'rgba(230,60,60,.12)';
      ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      ctx.strokeStyle = 'rgba(255,90,90,.7)';
      ctx.lineWidth = 1.5 / G.cam.z;
      ctx.strokeRect(tx * TILE + 1, ty * TILE + 1, TILE - 2, TILE - 2);
    }
    return;
  }
  if (e && withinReach(tx, ty)) {
    ctx.strokeStyle = 'rgba(255,255,255,.8)';
    ctx.lineWidth = 2 / G.cam.z;
    ctx.strokeRect(e.x * TILE + 1, e.y * TILE + 1, e.w * TILE - 2, e.h * TILE - 2);
  }
  const p = G.player;
  if (p.mining) {
    const [mx, my] = p.mining.split(',').map(Number);
    const ti = getOreType(mx, my);
    if ((ti >= 0 && ti < ORES.length) || ti === ORE_URANIUM) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(mx * TILE + TILE / 2, my * TILE + TILE / 2, 12, -Math.PI / 2, -Math.PI / 2 + p.mineProg * Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawEnemies(ctx) {
  if (!G.enemies) return;
  for (const en of G.enemies) {
    if (en.dead) continue;
    const bob = Math.sin(G.time * 8 + en.x) * 1.2;
    const size = en.size || 8;
    const maxhp = en.maxhp || 40;
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath();
    ctx.ellipse(en.x, en.y + 10, size * 1.2, size * 0.5, 0, 0, 7);
    ctx.fill();
    // 不同敌人不同形状：蠕虫为细长条形，其余为圆
    const color = en.color || enemyColor(en.hp, 40);
    ctx.fillStyle = color;
    ctx.strokeStyle = '#7c1a12';
    ctx.lineWidth = 2;
    if (en.kind === 'spawner') {
      // 巢穴：带呼吸的肉质圆形虫巢
      const pulse = 1 + Math.sin(G.time * 2 + en.x) * 0.06;
      ctx.fillStyle = '#5a3a8a';
      ctx.beginPath(); ctx.arc(en.x, en.y, size * pulse, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3a225a';
      ctx.beginPath(); ctx.arc(en.x, en.y, size * 0.5, 0, 7); ctx.fill();
      ctx.fillStyle = '#8a5ac0';
      ctx.beginPath(); ctx.arc(en.x, en.y, size * 0.3, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffd0a0';
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + G.time * 0.5;
        ctx.beginPath(); ctx.arc(en.x + Math.cos(a) * size * 0.7, en.y + Math.sin(a) * size * 0.7, 2, 0, 7); ctx.fill();
      }
    } else if (en.type === 'worm' || en.type === 'big-worm') {
      ctx.beginPath();
      ctx.ellipse(en.x, en.y + bob, size, size * 0.5, 0, 0, 7);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3a2a22';
      ctx.beginPath(); ctx.arc(en.x, en.y + bob - 4, 3, 0, 7); ctx.fill();
    } else if (en.kind === 'ranged') {
      ctx.beginPath();
      ctx.arc(en.x, en.y + bob, size, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffe0a0';
      ctx.beginPath(); ctx.arc(en.x, en.y + bob - 3, 2, 0, 7); ctx.fill();
    } else {
      ctx.beginPath();
      ctx.arc(en.x, en.y + bob, size, 0, 7); ctx.fill(); ctx.stroke();
      // 眼睛朝玩家
      const a = Math.atan2(G.player.y - en.y, G.player.x - en.x);
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(en.x + Math.cos(a) * size * 0.4, en.y + bob + Math.sin(a) * size * 0.4, 2.5, 0, 7);
      ctx.fill();
    }
    // 血条
    const w = 16;
    ctx.fillStyle = '#20242b';
    ctx.fillRect(en.x - w / 2, en.y - 16, w, 3);
    ctx.fillStyle = Math.max(0, Math.min(1, en.hp / maxhp)) > 0.5 ? '#57e389' : '#ff5b5b';
    ctx.fillRect(en.x - w / 2, en.y - 16, w * Math.max(0, en.hp / maxhp), 3);
  }
  // 远程投射物（吐痰/火球）
  if (G.enemyProjectiles) {
    for (const pr of G.enemyProjectiles) {
      if (pr.fire) {
        ctx.fillStyle = 'rgba(255,140,40,.85)';
        ctx.beginPath(); ctx.arc(pr.x, pr.y, 4, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,200,120,.7)';
        ctx.beginPath(); ctx.arc(pr.x, pr.y, 2.2, 0, 7); ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(150,180,60,.8)';
        ctx.beginPath(); ctx.arc(pr.x, pr.y, 3, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(200,220,120,.6)';
        ctx.beginPath(); ctx.arc(pr.x, pr.y, 2, 0, 7); ctx.fill();
      }
    }
  }
}

function drawBullets(ctx) {
  if (!G.bullets) return;
  for (const b of G.bullets) {
    const t = b.t / b.life;
    const cx = b.x + (b.tx - b.x) * t, cy = b.y + (b.ty - b.y) * t;
    if (b.kind === 'laser') {
      ctx.strokeStyle = 'rgba(255,60,80,' + (1 - t).toFixed(2) + ')';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(cx, cy); ctx.stroke();
    } else if (b.kind === 'flame') {
      ctx.fillStyle = 'rgba(255,' + (120 + Math.random() * 60 | 0) + ',40,' + (1 - t).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(cx, cy, 6 + Math.random() * 5, 0, 7); ctx.fill();
    } else if (b.splash || b.art) {
      // 火箭/手雷/炮兵炮弹：轨迹 + 命中爆炸圈
      ctx.strokeStyle = b.art ? 'rgba(255,140,90,' + (1 - t).toFixed(2) + ')' : 'rgba(255,200,120,' + (1 - t).toFixed(2) + ')';
      ctx.lineWidth = b.art ? 3.5 : 2.5;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(cx, cy); ctx.stroke();
      if (t >= 1) {
        const rad = (b.splash || 0) * TILE * (b.art ? 0.8 : 0.6);
        ctx.strokeStyle = b.art ? 'rgba(255,120,50,.9)' : 'rgba(255,160,60,.8)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(b.tx, b.ty, rad, 0, 7); ctx.stroke();
        ctx.fillStyle = b.art ? 'rgba(255,150,70,.3)' : 'rgba(255,180,80,.25)';
        ctx.beginPath(); ctx.arc(b.tx, b.ty, rad, 0, 7); ctx.fill();
      }
    } else if (b.boom) {
      // 地雷爆炸：短促闪光
      ctx.fillStyle = 'rgba(255,190,90,' + (1 - t).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(b.x, b.y, 10 + (1 - t) * 20, 0, 7); ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(255,220,120,' + (1 - t).toFixed(2) + ')';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(cx, cy); ctx.stroke();
    }
  }
}

// 战斗机器人（胶囊投掷物）：悬浮小无人机，附电池条/血条
function drawCombatRobots(ctx) {
  if (!G.combatRobots) return;
  for (const r of G.combatRobots) {
    if (r.dead) continue;
    const bob = Math.sin(G.time * 6 + r.x) * 2;
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath();
    ctx.ellipse(r.x, r.y + 8, r.size * 1.2, r.size * 0.5, 0, 0, 7);
    ctx.fill();
    // 机身
    ctx.fillStyle = r.color;
    ctx.strokeStyle = '#1a2028';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(r.x, r.y + bob, r.size, 0, 7);
    ctx.fill(); ctx.stroke();
    // 小翅膀
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.fillRect(r.x - r.size - 3, r.y + bob - 1, 3, 4);
    ctx.fillRect(r.x + r.size, r.y + bob - 1, 3, 4);
    // 状态灯
    ctx.fillStyle = r.kind === 'destroyer' ? '#ff5b5b' : (r.kind === 'distractor' ? '#ffd23c' : '#7ff0ff');
    ctx.beginPath(); ctx.arc(r.x, r.y + bob - r.size * 0.5, 2, 0, 7); ctx.fill();
    // 血条 / 续航条
    const w = 14;
    ctx.fillStyle = '#20242b';
    ctx.fillRect(r.x - w / 2, r.y + bob - r.size - 7, w, 2.5);
    ctx.fillStyle = r.hp > 0 ? '#57e389' : '#ff5b5b';
    ctx.fillRect(r.x - w / 2, r.y + bob - r.size - 7, w * Math.max(0, r.hp / r.maxhp), 2.5);
  }
}

// 击杀敌人掉落的地面矿石（见 combat2.js dropEnemyLoot）：小矿石图标带轻微上下浮动
function drawLootDrops(ctx) {
  if (!G.lootDrops || G.lootDrops.length === 0) return;
  for (const d of G.lootDrops) {
    const bob = Math.sin(G.time * 3 + d.x) * 1.5;
    // 地面阴影
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath(); ctx.ellipse(d.x, d.y + 6, 5, 2.5, 0, 0, 7); ctx.fill();
    // 矿石图标
    const it = ITEMS[d.id];
    if (it) {
      ctx.fillStyle = it.color;
      ctx.beginPath(); ctx.arc(d.x, d.y + bob, 5, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(20,26,34,.6)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(d.x, d.y + bob, 5, 0, 7); ctx.stroke();
    }
  }
}

function drawPlayer(ctx) {
  const p = G.player;
  // 载具驾驶中：不绘制玩家角色本体（载具已绘制），仅显示头顶驾驶员轮廓提示
  if (p.inVehicle && G.driving && G.driving.ent) {
    const bob = Math.sin(G.time * 4) * 1;
    ctx.fillStyle = '#2a2620';
    ctx.beginPath();
    ctx.arc(p.x, p.y + 6 + bob, 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffe0b0';
    ctx.beginPath();
    ctx.arc(p.x, p.y + 4 + bob, 2.4, 0, 7); ctx.fill();
    return;
  }
  // 地面阴影
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 10, 9, 4, 0, 0, 7);
  ctx.fill();

  const bob = Math.sin(p.walkT) * 1.5;
  const step = Math.sin(p.walkT);                     // 行走步态相位
  const a = p.dir * Math.PI / 2;
  const cx = Math.cos(a), cy = Math.sin(a);           // 朝向单位向量
  const moving = Math.abs(step) > 0.05;
  const facingUp = p.dir === 3;                        // 朝上 = 背面视角（后脑勺+后背）
  ctx.lineCap = 'round';

  // ---- 双腿：行走时交替前后摆动 ----
  ctx.lineWidth = 3.2;
  for (const s of [-1, 1]) {
    const sw = moving ? step * s * 2.6 : 0;
    ctx.strokeStyle = '#4d3318';
    ctx.beginPath();
    ctx.moveTo(p.x + s * 2.3, p.y + 3);
    ctx.lineTo(p.x + s * 2.3 + cx * sw, p.y + 8 + Math.abs(sw) * 0.35);
    ctx.stroke();
  }

  // ---- 身体：橙色工装上衣（圆角躯干 + 腰带）----
  const bx = p.x, by = p.y + bob - 2;
  ctx.fillStyle = '#d97b2f';
  ctx.strokeStyle = '#7c431a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(bx, by, 6.8, 7.2, 0, 0, 7);
  ctx.fill(); ctx.stroke();
  // 腰带
  ctx.strokeStyle = '#5a3515';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(bx, by + 4, 5.8, 2.2, 0, 0, 7);
  ctx.stroke();
  if (facingUp) {
    // 后背：背部中缝线（替代胸前扣子）
    ctx.strokeStyle = '#5a3515';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(bx, by - 4.5);
    ctx.lineTo(bx, by + 2.5);
    ctx.stroke();
  } else {
    // 胸前扣子
    ctx.fillStyle = '#5a3515';
    ctx.beginPath();
    ctx.arc(bx, by - 1, 0.9, 0, 7);
    ctx.fill();
  }

  // ---- 双臂：两侧自然垂放，行走/采矿时摆动 ----
  const mining = p.mining && p.mineProg > 0;
  const t = G.time * 12;
  ctx.lineWidth = 3;
  for (const s of [-1, 1]) {
    const armSwing = mining ? Math.sin(t + s * 0.7) * 2 : (moving ? step * s * 1.8 : 0);
    ctx.strokeStyle = '#d97b2f';
    ctx.beginPath();
    ctx.moveTo(bx + s * 3.8, by - 1);
    ctx.lineTo(bx + s * 4.2 + cx * armSwing * 0.6, by + 5 + armSwing * 0.8);
    ctx.stroke();
  }

  // ---- 头部：肤色圆，朝移动方向偏移 ----
  const hx = p.x, hy = p.y + bob - 9;
  ctx.fillStyle = '#ffe0b0';   // 更显年轻的亮肤色
  ctx.strokeStyle = '#7c431a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(hx, hy, 5.6, 0, 7);
  ctx.fill(); ctx.stroke();

  if (facingUp) {
    // ---- 背面视角：显示完整后脑勺（头发覆盖整个头部，不画眼睛和嘴）----
    ctx.fillStyle = '#5a3a22';   // 深棕发色
    ctx.strokeStyle = '#3c2413';
    ctx.lineWidth = 0.8;
    // 后脑勺：整圆头发覆盖头部后面
    ctx.beginPath();
    ctx.arc(hx, hy, 5.7, 0, 7);
    ctx.fill(); ctx.stroke();
    // 后脑勺发旋/发丝质感
    ctx.strokeStyle = '#3c2413';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(hx, hy - 2);
    ctx.lineTo(hx, hy + 2);
    ctx.stroke();
  } else {
    // 头发：深棕短发（年轻人发型，取代安全帽）
    ctx.fillStyle = '#5a3a22';   // 深棕发色
    ctx.strokeStyle = '#3c2413';
    ctx.lineWidth = 0.8;
    // 头顶短发（后脑勺弧线 + 头顶略蓬松）
    ctx.beginPath();
    ctx.arc(hx, hy - 1.8, 5.0, Math.PI, 0);   // 头顶发际线（上半圆）
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // ---- 眼睛：朝向移动方向，始终水平排列（正面分开、侧面靠拢）带高光显精神 ----
    ctx.fillStyle = '#2b2b2b';
    const eyeSpread = Math.abs(cy) < 0.5 ? 1.5 : 2.4;   // 侧面时靠拢、正面时分开
    for (const s of [-1, 1]) {
      const ex = hx + cx * 1.6 + s * eyeSpread;
      const ey = hy + cy * 1.8;
      ctx.beginPath();
      ctx.arc(ex, ey, 1.2, 0, 7);
      ctx.fill();
      // 眼睛高光
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex - 0.4, ey - 0.4, 0.4, 0, 7);
      ctx.fill();
      ctx.fillStyle = '#2b2b2b';
    }

    // ---- 嘴：年轻微笑 ----
    ctx.strokeStyle = '#c96a4a';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    const mx = hx + cx * 3.2, my = hy + cy * 3.2;
    ctx.arc(mx, my, 1.3, 0.3, Math.PI - 0.3);
    ctx.stroke();
  }
}

// ===== 小地图（Minimap） =====
// 位于画布右下角的缩略地图：只绘制已探索区块的地形与矿脉，玩家位置用亮点标出。
// 数据来源于 G.world.explored（区块级），瓦片级颜色直接查询确定性地形生成，避免额外存储。
const MINIMAP_SIZE = 168;           // 小地图边长（px）
const MINIMAP_ZOOM = 2.2;           // 每瓦片像素（越大多看得越细，但覆盖范围变小）
const MINIMAP_VIEW = Math.ceil(MINIMAP_SIZE / MINIMAP_ZOOM / 2); // 半边长覆盖瓦片数
function drawMinimap(ctx) {
  const size = MINIMAP_SIZE;
  const pad = 10;
  const x0 = W - size - pad, y0 = H - size - pad;
  const pcx = G.player.x / TILE, pcy = G.player.y / TILE;
  // 背景框
  ctx.fillStyle = 'rgba(8,12,10,0.78)';
  ctx.strokeStyle = 'rgba(140,200,160,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x0, y0, size, size, 6) : ctx.rect(x0, y0, size, size);
  ctx.fill(); ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  const z = MINIMAP_ZOOM;
  // 覆盖范围内的瓦片：遍历世界坐标瓦片，按探索状态绘制
  const cx = x0 + size / 2, cy = y0 + size / 2;
  for (let dy = -MINIMAP_VIEW; dy <= MINIMAP_VIEW; dy++) {
    for (let dx = -MINIMAP_VIEW; dx <= MINIMAP_VIEW; dx++) {
      const tx = Math.floor(pcx) + dx, ty = Math.floor(pcy) + dy;
      if (!tileExplored(tx, ty)) continue;
      const px = cx + (tx - pcx) * z, py = cy + (ty - pcy) * z;
      if (px < x0 - z || py < y0 - z || px > x0 + size || py > y0 + size) continue;
      const t = getTerrain(tx, ty);
      ctx.fillStyle = (t === T_WATER) ? 'rgba(40,90,140,0.9)'
        : (t === T_CONCRETE) ? 'rgba(120,120,126,0.85)'
        : (t === T_PATH) ? 'rgba(150,140,130,0.85)'
        : 'rgba(52,78,50,0.9)';
      ctx.fillRect(px, py, z + 0.4, z + 0.4);
      // 矿脉标记
      const oi = getOreType(tx, ty);
      if (oi >= 0) {
        const oid = oreItemId(oi);
        const oc = ITEMS[oid] ? ITEMS[oid].color : '#aaa';
        ctx.fillStyle = oc;
        ctx.fillRect(px + z * 0.25, py + z * 0.25, z * 0.5, z * 0.5);
      }
    }
  }
  ctx.restore();
  // 边框（覆盖 clip 外缘）
  ctx.strokeStyle = 'rgba(140,200,160,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y0, size, size);
  // 玩家位置亮点
  const ppx = x0 + size / 2, ppy = y0 + size / 2;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(ppx, ppy, 2.6, 0, 7);
  ctx.fill();
  ctx.strokeStyle = '#ffd23c';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // 标题
  ctx.fillStyle = 'rgba(200,230,210,0.8)';
  ctx.font = '10px system-ui';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('🗺 ' + Math.round(pcx) + ',' + Math.round(pcy), x0 + 6, y0 + 5);
}
