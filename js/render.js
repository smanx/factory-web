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
// 复用的机械臂置顶绘制列表：渲染单遍扫描时暂存视口内机械臂，避免每帧分配数组。
const _inserterDrawList = [];

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
  // 单遍扫描完成视口剔除与绘制；机械臂（Inserter 族）暂存到复用列表，
  // 最后统一绘制在最上层，避免被传送带/其他设备遮挡（省去第二遍全量遍历）。
  const keys = (G.buckets && G.buckets.size)
    ? bucketKeysIn(
        Math.floor(FRAME_BOUNDS.x1 / TILE) - BUCK, Math.floor(FRAME_BOUNDS.y1 / TILE) - BUCK,
        Math.ceil(FRAME_BOUNDS.x0 / TILE) + BUCK, Math.ceil(FRAME_BOUNDS.y0 / TILE) + BUCK)
    : null;
  const inserters = _inserterDrawList;
  inserters.length = 0;
  const visit = e => {
    if (e._dead || !onScreen(e)) return;
    if (IS_INSERTER[e.type]) inserters.push(e);
    else drawEntity(ctx, e, e.x, e.y, e.dir, 1);
  };
  if (keys) forEachEntInBuckets(keys, visit);
  else for (const e of G.ents) { if (!e._dead) visit(e); }
  for (const e of inserters) drawEntity(ctx, e, e.x, e.y, e.dir, 1);   // 机械臂置顶
  inserters.length = 0;
  drawGhost(ctx);
  drawBlueprintOverlay(ctx);
  drawHoverAndMining(ctx);
  drawPlayer(ctx);
  drawEnemies(ctx);
  drawBullets(ctx);
  ctx.restore();
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
// 把 8000 次逐格 fillRect 降为几次 blit。矿点同样烘焙进缓存：
// 此前每帧对视口内所有矿格重绘 2~7 个圆弧/椭圆路径（满屏数千次路径操作），
// 现仅在矿量变化时由 consumeOre 触发 invalidateOreTile 重绘该格（P1 优化）。
const terrainCacheStats = { state: '未启用', rebuildMs: 0, lastRebuild: 0, hits: 0, misses: 0, cached: 0 };
const TERRAIN_CHUNK_LRU_MAX = 16;   // 分块离屏缓存上限（张）
const TERRAIN_CHUNK_PX = CHUNK * TILE;   // 1024
const terrainChunkCache = new Map();   // 'cx,cy' -> { canvas, last }
terrainChunkCache._seq = 0;   // LRU 时钟序号

// 绘制单格地形底色（草地/水域），px/py 为相对画布原点的像素坐标
function drawTerrainTile(ctx, tx, ty, px, py) {
  if (getTerrain(tx, ty) === T_WATER) {
    ctx.fillStyle = hash2(tx, ty) > 0.5 ? '#265d8a' : '#28618f';
    ctx.fillRect(px, py, TILE, TILE);
    return;
  }
  const v = hash2(tx, ty);
  ctx.fillStyle = v > 0.62 ? '#4f7c3b' : v > 0.3 ? '#4a7538' : '#456f35';
  ctx.fillRect(px, py, TILE, TILE);
}

// 仅绘制单个 chunk 的地形底色（草地/水域），不含矿点
function drawChunkTerrainInto(ctx, cx, cy) {
  const ox = cx * CHUNK, oy = cy * CHUNK;
  for (let dy = 0; dy < CHUNK; dy++) {
    for (let dx = 0; dx < CHUNK; dx++) {
      drawTerrainTile(ctx, ox + dx, oy + dy, dx * TILE, dy * TILE);
    }
  }
}

// 绘制单个 chunk 内所有可见矿点（烘焙进离屏缓存用）
function drawChunkOresInto(ctx, cx, cy) {
  const ox = cx * CHUNK, oy = cy * CHUNK;
  for (let dy = 0; dy < CHUNK; dy++) {
    for (let dx = 0; dx < CHUNK; dx++) {
      const tx = ox + dx, ty = oy + dy;
      const ti = getOreType(tx, ty);
      if (ti >= 0 && getOreAmt(tx, ty) > 0)
        drawOreDots(ctx, dx * TILE, dy * TILE, oreItemId(ti), getOreAmt(tx, ty), tx, ty);
    }
  }
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
  drawChunkOresInto(cctx, cx, cy);   // 矿点一并烘焙，避免每帧重绘
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

// 新游戏/新种子/读档时清空分块离屏缓存，避免残留旧世界地形。
function clearTerrainCache() {
  terrainChunkCache.clear();
  terrainCacheStats.hits = 0;
  terrainCacheStats.misses = 0;
  terrainCacheStats.cached = 0;
}

// 矿点已烘焙进 chunk 缓存：某格矿量变化时只需重绘该格及其 3×3 邻域地形，
// 并把矿点重画到 5×5 范围（油点椭圆带描边最多可溢出自身格边 ~1.65px，
// 距变化格切比雪夫距离为 2 的油格也可能在该次擦除区域内留下笔触，
// 因此矿点重绘半径取 2 才能与整块重新烘焙的结果完全一致）。
// 由 world.consumeOre 在矿量减少时调用；未缓存的 chunk 无需处理
// （下次生成时自然带最新矿量）。每张分块画布只包含本 chunk 格子的绘制
// （越界部分被画布裁掉），故无需通知相邻 chunk 的缓存。
function invalidateOreTile(tx, ty) {
  const cx = Math.floor(tx / CHUNK), cy = Math.floor(ty / CHUNK);
  const entry = terrainChunkCache.get(cx + ',' + cy);
  if (!entry) return;
  const cctx = entry.canvas.getContext('2d');
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = tx + dx, ny = ty + dy;
      // 只重绘仍属本 chunk 的格子；跨 chunk 边缘的邻格由各自缓存负责
      if (Math.floor(nx / CHUNK) !== cx || Math.floor(ny / CHUNK) !== cy) continue;
      const px = (nx - cx * CHUNK) * TILE, py = (ny - cy * CHUNK) * TILE;
      drawTerrainTile(cctx, nx, ny, px, py);
    }
  }
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const nx = tx + dx, ny = ty + dy;
      if (Math.floor(nx / CHUNK) !== cx || Math.floor(ny / CHUNK) !== cy) continue;
      const ti = getOreType(nx, ny);
      const amt = getOreAmt(nx, ny);
      if (ti >= 0 && amt > 0)
        drawOreDots(cctx, (nx - cx * CHUNK) * TILE, (ny - cy * CHUNK) * TILE, oreItemId(ti), amt, nx, ny);
    }
  }
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
  // 矿点已烘焙进 chunk 缓存，矿量变化时由 consumeOre → invalidateOreTile 局部重绘
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
    if (ti >= 0 && ti < ORES.length) {
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
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath();
    ctx.ellipse(en.x, en.y + 10, 8, 3.5, 0, 0, 7);
    ctx.fill();
    ctx.fillStyle = enemyColor(en.hp, 40);
    ctx.strokeStyle = '#7c1a12';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(en.x, en.y + bob, 8, 0, 7);
    ctx.fill();
    ctx.stroke();
    // 眼睛朝玩家
    const a = Math.atan2(G.player.y - en.y, G.player.x - en.x);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(en.x + Math.cos(a) * 3, en.y + bob + Math.sin(a) * 3, 2.5, 0, 7);
    ctx.fill();
    // 血条
    const w = 16;
    ctx.fillStyle = '#20242b';
    ctx.fillRect(en.x - w / 2, en.y - 16, w, 3);
    ctx.fillStyle = Math.max(0, Math.min(1, en.hp / 40)) > 0.5 ? '#57e389' : '#ff5b5b';
    ctx.fillRect(en.x - w / 2, en.y - 16, w * Math.max(0, en.hp / 40), 3);
  }
}

function drawBullets(ctx) {
  if (!G.bullets) return;
  for (const b of G.bullets) {
    const t = b.t / b.life;
    ctx.strokeStyle = 'rgba(255,220,120,' + (1 - t).toFixed(2) + ')';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x + (b.tx - b.x) * t, b.y + (b.ty - b.y) * t);
    ctx.stroke();
  }
}

function drawPlayer(ctx) {
  const p = G.player;
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
