'use strict';

// ===== 极速物流三件套：极速传送带 / 极速地下带 / 极速分流器 =====
// 速度约为普通带的 3.75 倍（EXPRESS_BELT_MULT），为物流终极档。

// ===== 极速传送带 =====
class ExpressBelt extends Belt {
  constructor(type, x, y) { super(type || 'express-transport-belt', x, y); }
  speedMult() { return EXPRESS_BELT_MULT; }
}

// ===== 极速地下传送带 =====
class ExpressUnderground extends Underground {
  constructor(type, x, y) { super(type || 'express-underground-belt', x, y); }
  maxDist() { return EXPRESS_UNDERGROUND_MAX; }
  speedMult() { return EXPRESS_BELT_MULT; }
}

// ===== 极速分流器 =====
class ExpressSplitter extends Splitter {
  constructor(type, x, y) { super(type || 'express-splitter', x, y); }
  speedMult() { return EXPRESS_BELT_MULT; }
}

// ===== 渲染（各复用同档绘制，仅换红色系配色）=====
function drawExpressBelt(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  const inp = beltInputSide(e);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#4a2a28';
  ctx.strokeStyle = '#2a1816';
  ctx.lineWidth = 2;
  function strip(angle, x0, len) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    rr(ctx, x0, -9, len, 18, 4);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  const step = TILE / 2;
  const off = ((G.time * beltSpeed() * e.speedMult() * TILE) % step + step) % step;
  strip(dir * Math.PI / 2, -TILE / 2 + 2, TILE - 4);
  if (inp) strip(Math.atan2(inp[1], inp[0]), 0, step);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(dir * Math.PI / 2);
  ctx.beginPath();
  ctx.rect(-TILE / 2 + 3, -TILE / 2 + 3, TILE - 6, TILE - 6);
  ctx.clip();
  ctx.fillStyle = 'rgba(224,90,78,.9)';
  for (let k = -1; k <= 2; k++) {
    const xx = -step + k * step + off;
    tri(ctx, xx - 3, -5, xx - 3, 5, xx + 3, 0);
    ctx.fill();
  }
  ctx.restore();
  if (inp) {
    const sa = Math.atan2(inp[1], inp[0]);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(sa);
    ctx.beginPath();
    ctx.rect(0, -TILE / 2 + 3, step, TILE - 6);
    ctx.clip();
    ctx.fillStyle = 'rgba(224,90,78,.9)';
    for (let k = 0; k <= 2; k++) {
      const xx = k * step - off;
      if (xx < -3 || xx > step + 3) continue;
      tri(ctx, xx + 3, -5, xx + 3, 5, xx - 3, 0);
      ctx.fill();
    }
    ctx.restore();
  }
  const exitX = DX[dir] * step, exitY = DY[dir] * step;
  let inX = cx, inY = cy;
  if (inp) { inX = cx + inp[0] * step; inY = cy + inp[1] * step; }
  const itemFn = (LOD && LOD.simple) ? drawItemDotLOD : drawItemDot;
  for (const o of e.items) {
    let ix, iy;
    if (inp && o.pos < 0.5) { const t = o.pos / 0.5; ix = inX + (cx - inX) * t; iy = inY + (cy - inY) * t; }
    else if (inp) { const t = (o.pos - 0.5) / 0.5; ix = cx + exitX * t; iy = cy + exitY * t; }
    else { ix = cx + DX[dir] * (o.pos - 0.5) * TILE; iy = cy + DY[dir] * (o.pos - 0.5) * TILE; }
    itemFn(ctx, ix, iy, o.item);
  }
  ctx.globalAlpha = 1;
}

function drawExpressUnderground(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  const mateA = !!e.findMate();
  const st = mateA ? 'in' : (!!e.findBackMate() ? 'out' : 'idle');
  const bodyCol = st === 'in' ? '#5a2a26' : st === 'out' ? '#4a302a' : '#4a3030';
  const accCol = st === 'in' ? '#e07a6a' : st === 'out' ? '#e08a7a' : '#b07068';
  ctx.globalAlpha = alpha;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(dir * Math.PI / 2);
  ctx.fillStyle = bodyCol;
  rr(ctx, -14, -11, 28, 22, 5);
  ctx.fill();
  if (st === 'idle') ctx.setLineDash([4, 3]);
  ctx.strokeStyle = accCol;
  ctx.lineWidth = 2;
  rr(ctx, -14, -11, 28, 22, 5);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = accCol;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-9, 0);
  ctx.lineTo(2, 0);
  ctx.stroke();
  ctx.fillStyle = accCol;
  tri(ctx, 0, -5, 0, 5, 9, 0);
  ctx.fill();
  if (st !== 'idle') {
    ctx.fillStyle = accCol;
    for (let k = 0; k < 3; k++) {
      const t = ((G.time * 0.9) + k / 3) % 1;
      let dx2, a;
      if (st === 'in') { dx2 = -11 + t * 10; a = t < 0.7 ? 0.95 : Math.max(0, (1 - t) * 3.3); }
      else { dx2 = -1 + t * 10; a = t < 0.3 ? t * 3.3 : 0.95; }
      ctx.globalAlpha = alpha * a;
      ctx.beginPath();
      ctx.arc(dx2, 0, 2.4, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = alpha;
  }
  const n = Math.min(e.items.length + e.outItems.length, 6);
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  for (let i = 0; i < n; i++) ctx.fillRect(-9 + i * 3.4, 8, 2.4, 2.4);
  ctx.restore();
  const badge = st === 'in' ? '入' : st === 'out' ? '出' : '—';
  const bcol = st === 'in' ? '#a04030' : st === 'out' ? '#8a4030' : '#6a5048';
  ctx.fillStyle = bcol;
  rr(ctx, px + 2, py + 2, 15, 13, 3);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 9px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(badge, px + 9.5, py + 9);
  ctx.globalAlpha = 1;
}

function drawExpressSplitter(ctx, e, gx, gy, dir, alpha) {
  ctx.globalAlpha = alpha;
  const cx = (gx + e.w / 2) * TILE, cy = (gy + e.h / 2) * TILE;
  const across = (dir % 2 === 1 ? e.w : e.h) * TILE;
  const running = e.items.length > 0;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(dir * Math.PI / 2);
  ctx.fillStyle = '#5a3028';
  rr(ctx, -TILE / 2 + 2, -across / 2 + 2, TILE - 4, across - 4, 6);
  ctx.fill();
  ctx.strokeStyle = '#2e1815';
  ctx.lineWidth = 2;
  rr(ctx, -TILE / 2 + 2, -across / 2 + 2, TILE - 4, across - 4, 6);
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.rect(-TILE / 2 + 4, -across / 2 + 4, TILE - 8, across - 8);
  ctx.clip();
  ctx.strokeStyle = 'rgba(224,90,78,.16)';
  ctx.lineWidth = 3.5;
  for (const [x1, y1, x2, y2] of [[-14, -13, 0, 0], [-14, 13, 0, 0], [0, 0, 14, -13], [0, 0, 14, 13]]) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  rr(ctx, -TILE * 0.2, -across / 2 + 3, TILE * 0.4, across - 6, 4);
  ctx.fill();
  ctx.fillStyle = dirColorNotch(dir);
  ctx.strokeStyle = 'rgba(0,0,0,.45)';
  ctx.lineWidth = 1;
  for (const ax of [-TILE * 0.26, TILE * 0.04]) {
    ctx.beginPath();
    ctx.moveTo(ax - 5, -7);
    ctx.lineTo(ax - 5, 7);
    ctx.lineTo(ax + 6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  if (running) {
    ctx.strokeStyle = 'rgba(224,120,100,' + (0.45 + 0.25 * Math.sin(G.time * 6)).toFixed(2) + ')';
    ctx.lineWidth = 2;
    rr(ctx, -TILE / 2 + 2, -across / 2 + 2, TILE - 4, across - 4, 6);
    ctx.stroke();
  }
  ctx.restore();
  if (e.outPref !== undefined && e.outPref >= 0) {
    const [lx, ly] = e.laneCenter(e.outPref);
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(dir * Math.PI / 2);
    ctx.fillStyle = '#ffd23c';
    tri(ctx, TILE * 0.14, -5, TILE * 0.14, 5, TILE * 0.3, 0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
  const p = e.laneVec();
  for (const o of e.items) {
    const outL = o.outLane !== undefined ? o.outLane : o.lane;
    let ix, iy;
    if (o.pos <= 0.5) {
      const [lx, ly] = e.laneCenter(o.lane);
      const inX = lx - DX[e.dir] * TILE / 2, inY = ly - DY[e.dir] * TILE / 2;
      const t = o.pos / 0.5;
      ix = inX + (cx - inX) * t;
      iy = inY + (cy - inY) * t;
    } else {
      const [lx, ly] = e.laneCenter(outL);
      const ox2 = lx + DX[e.dir] * TILE / 2, oy2 = ly + DY[e.dir] * TILE / 2;
      const t = (o.pos - 0.5) / 0.5;
      ix = cx + (ox2 - cx) * t;
      iy = cy + (oy2 - cy) * t;
    }
    ((LOD && LOD.simple) ? drawItemDotLOD : drawItemDot)(ctx, ix, iy, o.item);
  }
  ctx.globalAlpha = 1;
}

// ===== 面板（复用传送带/地下带/分流器面板）=====
const expressBeltPanel = { html: beltPanelHtml, live: beltPanelLive, tip: beltTip };
const expressUndergroundPanel = { html: undergroundPanelHtml, live: undergroundPanelLive };
const expressSplitterPanel = { html: splitterPanelHtml, onAction: splitterOnAction, live: splitterPanelLive };

// ===== 注册 =====
ENT_CLASSES['express-transport-belt'] = ExpressBelt;
ENT_CLASSES['express-underground-belt'] = ExpressUnderground;
ENT_CLASSES['express-splitter'] = ExpressSplitter;
DEVICE_RENDER['express-transport-belt'] = drawExpressBelt;
DEVICE_RENDER['express-underground-belt'] = drawExpressUnderground;
DEVICE_RENDER['express-splitter'] = drawExpressSplitter;
DEVICE_STATUS['express-transport-belt'] = e => e.items.length ? 'g' : 'r';
DEVICE_STATUS['express-underground-belt'] = undergroundStatusFn;
DEVICE_STATUS['express-splitter'] = splitterStatusFn;
DEVICE_PANEL['express-transport-belt'] = expressBeltPanel;
DEVICE_PANEL['express-underground-belt'] = expressUndergroundPanel;
DEVICE_PANEL['express-splitter'] = expressSplitterPanel;
DEVICE_DIR_ROTATE['express-underground-belt'] = true;
DEVICE_DIR_ROTATE['express-transport-belt'] = true;
