'use strict';

let W = 0, H = 0;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  W = window.innerWidth; H = window.innerHeight;
  G.canvas.width = W * dpr;
  G.canvas.height = H * dpr;
  G.canvas.style.width = W + 'px';
  G.canvas.style.height = H + 'px';
  G.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function updateCamera(dt) {
  const cam = G.cam;
  const txp = G.player.x - TILE / 2;
  const typ = G.player.y - TILE / 2;
  cam.px += (txp - cam.px) * Math.min(1, dt * 8);
  cam.py += (typ - cam.py) * Math.min(1, dt * 8);
}

function screenToWorld(sx, sy) {
  return [(sx - W / 2) / G.cam.z + G.cam.px, (sy - H / 2) / G.cam.z + G.cam.py];
}

function render() {
  const ctx = G.ctx;
  ctx.fillStyle = '#151a14';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(G.cam.z, G.cam.z);
  ctx.translate(-G.cam.px, -G.cam.py);
  drawTerrain(ctx);
  drawGridIfBuilding(ctx);
  for (const e of G.ents) {
    if (!onScreen(e)) continue;
    drawEntity(ctx, e, e.x, e.y, e.dir, 1);
  }
  drawGhost(ctx);
  drawBlueprintOverlay(ctx);
  drawHoverAndMining(ctx);
  drawPlayer(ctx);
  drawEnemies(ctx);
  drawBullets(ctx);
  ctx.restore();
}

function viewBounds() {
  const hw = (W / 2) / G.cam.z, hh = (H / 2) / G.cam.z;
  return {
    x0: G.cam.px + hw, y0: G.cam.py + hh,
    x1: G.cam.px - hw, y1: G.cam.py - hh
  };
}

function onScreen(e) {
  const b = viewBounds();
  return e.x * TILE < b.x0 + TILE && (e.x + e.w) * TILE > b.x1 &&
         e.y * TILE < b.y0 + TILE && (e.y + e.h) * TILE > b.y1;
}

// ===== 地形离屏缓存 =====
// 把视口附近的地形底色绘到离屏画布，相机未大幅移动时直接整块贴图，
// 避免每帧逐格重算；矿点因会随开采变化，仍每帧实时绘制在缓存之上。
const terrainCache = { canvas: null, cx: 0, cy: 0, w: 0, h: 0, z: 1, rebuildMs: 0 };
const terrainCacheStats = { state: '未启用', rebuildMs: 0, lastRebuild: 0 };
const TERRAIN_CACHE_MARGIN = 5;   // 缓存向外扩的瓦片数（减少重建频率）

// 仅绘制地形底色（草地/水域），不含矿点
function drawTerrainInto(ctx, ox, oy, w, h) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const tx = ox + dx, ty = oy + dy;
      const px = dx * TILE, py = dy * TILE;
      if (getTerrain(tx, ty) === T_WATER) {
        ctx.fillStyle = hash2(tx, ty) > 0.5 ? '#265d8a' : '#28618f';
        ctx.fillRect(px, py, TILE, TILE);
        continue;
      }
      const v = hash2(tx, ty);
      ctx.fillStyle = v > 0.62 ? '#4f7c3b' : v > 0.3 ? '#4a7538' : '#456f35';
      ctx.fillRect(px, py, TILE, TILE);
    }
  }
}

function drawTerrain(ctx) {
  const b = viewBounds();
  const tx0 = Math.floor(b.x1 / TILE);
  const ty0 = Math.floor(b.y1 / TILE);
  const tx1 = Math.ceil(b.x0 / TILE);
  const ty1 = Math.ceil(b.y0 / TILE);
  const tw = tx1 - tx0 + 1, th = ty1 - ty0 + 1;
  const m = TERRAIN_CACHE_MARGIN;
  // 缓存失效：无缓存、缩放变化、或当前视口超出缓存覆盖范围
  const need = !terrainCache.canvas || terrainCache.z !== G.cam.z ||
    tx0 < terrainCache.cx || ty0 < terrainCache.cy ||
    tx1 > terrainCache.cx + terrainCache.w - 1 || ty1 > terrainCache.cy + terrainCache.h - 1;
  if (need) {
    const cw = tw + m * 2, chh = th + m * 2;
    if (!terrainCache.canvas) terrainCache.canvas = document.createElement('canvas');
    terrainCache.canvas.width = cw * TILE;
    terrainCache.canvas.height = chh * TILE;
    const cctx = terrainCache.canvas.getContext('2d');
    const start = performance.now();
    drawTerrainInto(cctx, tx0 - m, ty0 - m, cw, chh);
    terrainCache.rebuildMs = performance.now() - start;
    terrainCache.cx = tx0 - m; terrainCache.cy = ty0 - m;
    terrainCache.w = cw; terrainCache.h = chh; terrainCache.z = G.cam.z;
    terrainCacheStats.rebuildMs = terrainCache.rebuildMs;
    terrainCacheStats.lastRebuild = G.time;
  }
  // 整块贴图缓存
  const sx = (tx0 - terrainCache.cx) * TILE;
  const sy = (ty0 - terrainCache.cy) * TILE;
  ctx.drawImage(terrainCache.canvas, sx, sy, tw * TILE, th * TILE,
    tx0 * TILE, ty0 * TILE, tw * TILE, th * TILE);
  // 矿点每帧实时绘制（随开采实时减少）
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const ti = getOreType(tx, ty);
      if (ti >= 0 && getOreAmt(tx, ty) > 0)
        drawOreDots(ctx, tx * TILE, ty * TILE, oreItemId(ti), getOreAmt(tx, ty), tx, ty);
    }
  }
  terrainCacheStats.state = '已启用（缓存 ' + terrainCache.w + '×' + terrainCache.h + ' 瓦片）';
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
  const b = viewBounds();
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
    const bp = G.blueprint;
    const ox = G.cursorTile.tx - bp.minX;
    const oy = G.cursorTile.ty - bp.minY;
    for (const s of bp.ents) {
      const cls = ENT_CLASSES[s.type];
      if (!cls) continue;
      const nx = s.x + ox, ny = s.y + oy;
      const tmp = cls.restore(Object.assign({}, s, { x: nx, y: ny }));
      tmp.dir = s.dir | 0; tmp.applyDir();
      const ok = canPlaceAt(s.type, nx, ny, tmp.dir);
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
    ctx.fillText('点击放置蓝图 · 右键取消', G.cursorTile.tx * TILE + TILE / 2, G.cursorTile.ty * TILE - 14);
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
  if (alpha === 1) {
    const sf = DEVICE_STATUS[e.type];
    const c = sf ? sf(e) : null;
    if (c) drawStatusDot(ctx, (gx + e.w) * TILE - 8, gy + 8, c);
  }
}

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
        if (canOverwriteWithBelt(type, entAt(tx + dx, ty + dy))) continue;
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
  ctx.strokeStyle = 'rgba(255,255,255,.12)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(p.x, p.y, REACH_PX, 0, 7);
  ctx.stroke();
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
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 9, 9, 4, 0, 0, 7);
  ctx.fill();
  const bob = Math.sin(p.walkT) * 1.5;
  ctx.fillStyle = '#d97b2f';
  ctx.strokeStyle = '#7c431a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y + bob, 10, 0, 7);
  ctx.fill(); ctx.stroke();
  const a = p.dir * Math.PI / 2;
  ctx.fillStyle = '#ffd9a0';
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(a) * 4, p.y + bob + Math.sin(a) * 4, 4.5, 0, 7);
  ctx.fill();
  if (p.mining && p.mineProg > 0) {
    const t = G.time * 14;
    ctx.fillStyle = '#e8e0c8';
    for (const side of [-1, 1]) {
      const ha = a + side * 0.9 + Math.sin(t) * 0.25 * side;
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(ha) * 11, p.y + bob + Math.sin(ha) * 11, 3, 0, 7);
      ctx.fill();
    }
  }
}
