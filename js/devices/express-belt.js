'use strict';

// ===== 极速物流三件套：极速传送带 / 极速地下带 / 极速分流器 =====
// 速度约为普通带的 3 倍（EXPRESS_BELT_MULT），为物流终极档（对齐《异星工厂》）。

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

// ===== 快速分流器（对齐《异星工厂》Fast splitter：物流链中间档，速度=快带×2） =====
class FastSplitter extends Splitter {
  constructor(type, x, y) { super(type || 'fast-splitter', x, y); }
  speedMult() { return FAST_BELT_MULT; }
  // 分流成功时低频播放轻柔机械声（节流，避免噪杂）
  pushOut(item, port, lane) {
    const ok = super.pushOut(item, port, lane);
    if (ok && typeof onScreen === 'function' && onScreen(this) && typeof playSfx === 'function') {
      const now = G.time || 0;
      if (!this._sfxT || now - this._sfxT > 0.5) { this._sfxT = now; playSfx('splitter'); }
    }
    return ok;
  }
}

// ===== 渲染（各复用同档绘制，仅换红色系配色）=====
function drawExpressBelt(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  const inp = beltInputSide(e);
  // 纯 90° 转角：以弯曲圆弧绘制，区分于 T 型转角（复用 belt.js 中的通用转角绘制）。
  // 梯形交汇的转角例外——直接连到直线带，不单独画圆弧。
  if (!beltCornerTrapezoid(e) && drawBeltCorner(ctx, e, gx, gy, dir, alpha,
    { belt: '#2e3a52', chev: 'rgba(90,150,230,.9)' })) return;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#2e3a52';
  ctx.strokeStyle = '#1a2434';
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
  const off = ((G.time * beltSpeed() * e.speedMult() * TILE / 2) % step + step) % step;
  strip(dir * Math.PI / 2, -TILE / 2 + 2, TILE - 4);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(dir * Math.PI / 2);
  ctx.beginPath();
  ctx.rect(-TILE / 2 + 3, -TILE / 2 + 3, TILE - 6, TILE - 6);
  ctx.clip();
  ctx.fillStyle = 'rgba(90,150,230,.9)';
  for (let k = -1; k <= 2; k++) {
    const xx = -step + k * step + off;
    tri(ctx, xx - 3, -5, xx - 3, 5, xx + 3, 0);
    ctx.fill();
  }
  ctx.restore();
  // 侧面接入带：用一段圆弧自然汇入主带（而非直矩形"搭"在主带之上），
  // 与主带同色、同轮廓，平滑衔接且 clip 到本格不覆盖相邻带。
  const bx = e.x - DX[dir], by = e.y - DY[dir];
  const backBelt = entAt(bx, by);
  const hasBackInput = backBelt instanceof Belt && backBelt.dir === dir;
  const sideArc = (inp.length === 1 && !hasBackInput) ? [drawBeltSideMerge(ctx, e, cx, cy, dir, inp[0], step, alpha, { belt: '#2e3a52', chev: 'rgba(90,150,230,.9)' })] : [];

  const exitX = DX[dir] * step, exitY = DY[dir] * step;
  // 双列错位：物品沿各自车道流动（与普通带一致）
  const LANE_OFF = 7;
  const laneOffset = e.items.length ? beltLaneOffset(e, 1) : null;
  const itemFn = (LOD && LOD.simple) ? drawItemDotLOD : drawItemDot;
  for (const o of e.items) {
    let ix, iy;
    const lo = (o.lane === 1 ? 1 : -1);
    const perpX = laneOffset ? laneOffset[0] * lo * LANE_OFF : 0;
    const perpY = laneOffset ? laneOffset[1] * lo * LANE_OFF : 0;
    // 与普通带一致：仅确实来自侧面的物品走侧面接入线；直通物品（side<0）无需向中间靠拢，
    // 首尾相接方向一致时全程保持车道偏移直接平移过去。
    const fromSide = inp.length > 0 && o.side !== undefined && o.side >= 0 && o.side < inp.length;
    const a = fromSide && sideArc.length > 0 ? sideArc[o.side] : null;
    if (a) {
      // 侧面进入的物品沿接入圆弧走完整段，与弧形轨道一致；内/外弧决定车道位置
      const s = inp[o.side];
      const srcDir = dirIndexOf(-s[0], -s[1]);
      const turnZ = DX[srcDir] * DY[dir] - DY[srcDir] * DX[dir];
      const rightTurn = turnZ > 0;
      const innerLane = rightTurn ? 0 : 1;
      const laneR = a.rC + ((o.lane === innerLane ? -1 : 1) * 5);
      const ang = a.aE + a.d * o.pos;
      ix = cx + a.CCx + Math.cos(ang) * laneR;
      iy = cy + a.CCy + Math.sin(ang) * laneR;
    } else if (o.pos < 0.5) {
      if (fromSide) {
        const s = inp[o.side];
        const inX = cx + s[0] * step, inY = cy + s[1] * step;
        const t = o.pos / 0.5;
        ix = inX + (cx - inX) * t + perpX * t; iy = inY + (cy - inY) * t + perpY * t;
      } else {
        // 直通物品（首尾相接方向一致）：全程保持车道偏移直接平移，不向中间收拢
        const inX = cx - DX[dir] * step, inY = cy - DY[dir] * step;
        const t = o.pos / 0.5;
        ix = inX + (cx - inX) * t + perpX; iy = inY + (cy - inY) * t + perpY;
      }
    } else {
      const t = (o.pos - 0.5) / 0.5;
      ix = cx + exitX * t + perpX; iy = cy + exitY * t + perpY;
    }
    itemFn(ctx, ix, iy, o.item);
  }
  ctx.globalAlpha = 1;
}

function drawExpressUnderground(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  const st = e.isEntrance() ? 'in' : (e.isExit() ? 'out' : 'idle');
  const bodyCol = st === 'in' ? '#2e3a52' : st === 'out' ? '#26344a' : '#2c3544';
  const accCol = st === 'in' ? '#5a9ae0' : st === 'out' ? '#6aa5e8' : '#4a6a92';
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
  const bcol = st === 'in' ? '#3f78c8' : st === 'out' ? '#3568b0' : '#4a5a78';
  ctx.fillStyle = bcol;
  rr(ctx, px + 2, py + 2, 15, 13, 3);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 9px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(badge, px + 9.5, py + 9);
  ctx.globalAlpha = 1;
}

// ===== 分流器渲染（统一调用 drawSplitterBase，仅换配色）=====
function drawExpressSplitter(ctx, e, gx, gy, dir, alpha) {
  drawSplitterBase(ctx, e, gx, gy, dir, alpha, SPLITTER_COLORS.express, null);
}

// ===== 快速分流器渲染（对齐《异星工厂》Fast splitter：橙色系，介于普通黄与极速红之间） =====
function drawFastSplitter(ctx, e, gx, gy, dir, alpha) {
  drawSplitterBase(ctx, e, gx, gy, dir, alpha, SPLITTER_COLORS.fast, { glow: true });
}

// ===== 面板（复用传送带/地下带/分流器面板）=====
const expressBeltPanel = { html: beltPanelHtml, live: beltPanelLive, tip: beltTip, onAction: (a) => (typeof circuitPanelAction === 'function' ? circuitPanelAction('belt', a) : false) };
const expressUndergroundPanel = { html: undergroundPanelHtml, live: undergroundPanelLive };
const expressSplitterPanel = { html: splitterPanelHtml, onAction: splitterOnAction, live: splitterPanelLive };

// ===== 注册 =====
ENT_CLASSES['express-transport-belt'] = ExpressBelt;
ENT_CLASSES['express-underground-belt'] = ExpressUnderground;
ENT_CLASSES['express-splitter'] = ExpressSplitter;
ENT_CLASSES['fast-splitter'] = FastSplitter;
DEVICE_RENDER['express-transport-belt'] = drawExpressBelt;
DEVICE_RENDER['express-underground-belt'] = drawExpressUnderground;
DEVICE_RENDER['express-splitter'] = drawExpressSplitter;
DEVICE_RENDER['fast-splitter'] = drawFastSplitter;
DEVICE_STATUS['express-transport-belt'] = e => e.items.length ? 'g' : 'r';
DEVICE_STATUS['express-underground-belt'] = undergroundStatusFn;
DEVICE_STATUS['express-splitter'] = splitterStatusFn;
DEVICE_STATUS['fast-splitter'] = splitterStatusFn;
DEVICE_PANEL['express-transport-belt'] = expressBeltPanel;
DEVICE_PANEL['express-underground-belt'] = expressUndergroundPanel;
DEVICE_PANEL['express-splitter'] = expressSplitterPanel;
DEVICE_PANEL['fast-splitter'] = expressSplitterPanel;
DEVICE_DIR_ROTATE['express-underground-belt'] = true;
DEVICE_DIR_ROTATE['express-transport-belt'] = true;
