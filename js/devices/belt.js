'use strict';

// ===== 传送带 =====
class Belt extends Entity {
  constructor(type, x, y) {
    super(type || 'transport-belt', x, y);
    this.items = [];
  }
  speedMult() { return this.type === 'fast-transport-belt' ? FAST_BELT_MULT : 1; }
  update(dt) {
    const sp = beltSpeed() * this.speedMult() * dt;
    this.items.sort((a, b) => b.pos - a.pos);
    if (this.items.length && this.items[0].pos + sp >= 1) this.transferFront();
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i];
      let lim = 1;
      if (i > 0) lim = Math.max(0, this.items[i - 1].pos - BELT_SPACING);
      it.pos = Math.min(it.pos + sp, lim);
      if (it.pos < 0) it.pos = 0;
    }
  }
  transferFront() {
    const f = this.items[0];
    const nx = this.x + DX[this.dir], ny = this.y + DY[this.dir];
    const nb = entAt(nx, ny);
    if (!nb) return false;
    if (nb instanceof Belt) {
      if (!(nb instanceof Splitter)) {
        if (nb.dir === ((this.dir + 2) % 4)) return false;
        let back = Infinity;
        for (const o of nb.items) back = Math.min(back, o.pos);
        if (back < BELT_SPACING) return false;
      }
      if (!nb.acceptItem(f.item, this.dir, this.x, this.y)) return false;
      this.items.shift();
      return true;
    }
    if ((nb instanceof Underground || nb instanceof Splitter) && nb.giveItem(f.item)) {
      this.items.shift();
      return true;
    }
    return false;
  }
  acceptItem(item, fromDir) {
    const candidates = [];
    if (fromDir !== undefined && fromDir !== null) {
      const rel = ((fromDir - this.dir) % 4 + 4) % 4;
      if (rel === 1 || rel === 3) candidates.push(0.45);
    }
    candidates.push(0);
    for (const p of candidates) {
      let ok = true;
      for (const o of this.items)
        if (Math.abs(o.pos - p) < BELT_SPACING) { ok = false; break; }
      if (ok) { this.items.push({ item, pos: p }); return true; }
    }
    return false;
  }
  grabZone(item) {
    let best = null;
    for (const o of this.items)
      if (o.pos >= 0.2 && (!item || o.item === item) && (!best || o.pos > best.pos)) best = o;
    return best;
  }
  countOf(item) {
    let n = 0;
    for (const o of this.items) if (o.pos >= 0.2 && o.item === item) n++;
    return n;
  }
  peekItem() {
    const z = this.grabZone();
    return z ? z.item : null;
  }
  takeOutput() {
    const z = this.grabZone();
    if (!z) return null;
    this.items.splice(this.items.indexOf(z), 1);
    return z.item;
  }
  // 手动拿取（F 键）：取带上最前端的物品
  takeItem() {
    if (!this.items.length) return null;
    let best = this.items[0];
    for (const o of this.items) if (o.pos > best.pos) best = o;
    this.items.splice(this.items.indexOf(best), 1);
    return best.item;
  }
  contents() {
    const list = [[this.type, 1]];
    for (const o of this.items) list.push([o.item, 1]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.items = this.items.map(o => [o.item, +o.pos.toFixed(3)]);
    return s;
  }
  static restore(s) {
    const b = super.restore(s);
    b.items = (s.items || []).map(a => ({ item: a[0], pos: a[1] }));
    return b;
  }
}

// ===== 渲染 =====
function dirIndexOf(dx, dy) {
  for (let i = 0; i < 4; i++) if (DX[i] === dx && DY[i] === dy) return i;
  return -1;
}

function beltInputSide(e) {
  const fdx = DX[e.dir], fdy = DY[e.dir];
  const sides = [[fdy, -fdx], [-fdy, fdx]];
  for (const [sx, sy] of sides) {
    const nb = entAt(e.x + sx, e.y + sy);
    if (!nb) continue;
    const want = dirIndexOf(-sx, -sy);
    if (nb instanceof Underground && nb.dir === want) return [sx, sy];
    if (nb instanceof Belt && nb.dir === want) return [sx, sy];
  }
  return null;
}

function drawBelt(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  const inp = beltInputSide(e);
  const fast = e.type === 'fast-transport-belt';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fast ? '#4a3a34' : '#3a3f47';
  ctx.strokeStyle = '#22252a';
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
  const off = ((G.time * beltSpeed() * (e.speedMult ? e.speedMult() : 1) * TILE) % step + step) % step;

  strip(dir * Math.PI / 2, -TILE / 2 + 2, TILE - 4);
  if (inp) strip(Math.atan2(inp[1], inp[0]), 0, step);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(dir * Math.PI / 2);
  ctx.beginPath();
  ctx.rect(-TILE / 2 + 3, -TILE / 2 + 3, TILE - 6, TILE - 6);
  ctx.clip();
  ctx.fillStyle = fast ? 'rgba(226,102,54,.9)' : 'rgba(224,178,60,.85)';
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
    ctx.fillStyle = fast ? 'rgba(226,102,54,.9)' : 'rgba(224,178,60,.85)';
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
  for (const o of e.items) {
    let ix, iy;
    if (inp && o.pos < 0.5) {
      const t = o.pos / 0.5;
      ix = inX + (cx - inX) * t;
      iy = inY + (cy - inY) * t;
    } else if (inp) {
      const t = (o.pos - 0.5) / 0.5;
      ix = cx + exitX * t;
      iy = cy + exitY * t;
    } else {
      ix = cx + DX[dir] * (o.pos - 0.5) * TILE;
      iy = cy + DY[dir] * (o.pos - 0.5) * TILE;
    }
    drawItemDot(ctx, ix, iy, o.item);
  }
  ctx.globalAlpha = 1;
}

// ===== 注册 =====
function beltPanelHtml() {
  return '<div class="dim">传送带：物品沿箭头方向流动。R 旋转方向。靠近后按 F 拿取带上物品。</div><div class="status"></div>';
}
function beltPanelLive(e, api) {
  const agg = {};
  for (const o of e.items) agg[o.item] = (agg[o.item] || 0) + 1;
  if (e.items.length) api.status('输送中：' + Object.keys(agg).map(k => ITEMS[k].name + '×' + agg[k]).join('、'), 'ok');
  else api.status('空闲（无物品）', 'ok');
}
function beltTip(e) {
  if (e.items.length) {
    const agg = {};
    for (const o of e.items) agg[o.item] = (agg[o.item] || 0) + 1;
    return '载物 ' + Object.keys(agg).map(k => ITEMS[k].name + '×' + agg[k]).join('、') + '，按F拿取';
  }
  return '空闲';
}
ENT_CLASSES['transport-belt'] = Belt;
ENT_CLASSES['fast-transport-belt'] = Belt;
DEVICE_RENDER['transport-belt'] = drawBelt;
DEVICE_RENDER['fast-transport-belt'] = drawBelt;
DEVICE_STATUS['transport-belt'] = e => e.items.length ? 'g' : 'r';
DEVICE_STATUS['fast-transport-belt'] = e => e.items.length ? 'g' : 'r';
const beltPanel = { html: beltPanelHtml, live: beltPanelLive, tip: beltTip };
DEVICE_PANEL['transport-belt'] = beltPanel;
DEVICE_PANEL['fast-transport-belt'] = beltPanel;
// 已铺设的传送带可用 R 键直接旋转方向（对齐《异星工厂》）
DEVICE_DIR_ROTATE['transport-belt'] = true;
DEVICE_DIR_ROTATE['fast-transport-belt'] = true;
