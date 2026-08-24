'use strict';

// ===== 传送带 =====
class Belt extends Entity {
  constructor(type, x, y) {
    super(type || 'transport-belt', x, y);
    this.items = [];
  }
  speedMult() { return this.type === 'fast-transport-belt' ? FAST_BELT_MULT : 1; }
  update(dt) {
    // 惰性调度（P0 优化）：空带没有任何可移动物品，跳过真实更新
    // （排序/邻居扫描/转移判定），空传送带完全无需每帧运行。
    if (!this.items || this.items.length === 0) return;
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
    let side = -1;
    if (fromDir !== undefined && fromDir !== null) {
      const rel = ((fromDir - this.dir) % 4 + 4) % 4;
      if (rel === 1 || rel === 3) { candidates.push(0.45); side = beltSideIndex(this, fromDir); }
    }
    candidates.push(0);
    for (const p of candidates) {
      let ok = true;
      for (const o of this.items)
        if (Math.abs(o.pos - p) < BELT_SPACING) { ok = false; break; }
      if (ok) { this.items.push({ item, pos: p, side }); return true; }
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
    s.items = this.items.map(o => [o.item, +o.pos.toFixed(3), o.side === undefined ? -1 : o.side]);
    return s;
  }
  static restore(s) {
    const b = super.restore(s);
    b.items = (s.items || []).map(a => ({ item: a[0], pos: a[1], side: a.length > 2 ? a[2] : -1 }));
    return b;
  }
}

// ===== 渲染 =====
function dirIndexOf(dx, dy) {
  for (let i = 0; i < 4; i++) if (DX[i] === dx && DY[i] === dy) return i;
  return -1;
}

// beltInputSide 结果缓存在实体上：邻居增删时由 addEnt/removeEnt 统一失效，
// 避免每帧为每条传送带反复遍历邻居实体（P0 优化）。
// 返回一个数组：横向传送带的左右两侧都可各接一条传送带（对齐《异星工厂》），
// 因此这里返回 0~2 个侧面输入源，而不再只取第一个。
function beltInputSide(e) {
  if (e.__inpCached) return e.__inp;
  const fdx = DX[e.dir], fdy = DY[e.dir];
  const sides = [[fdy, -fdx], [-fdy, fdx]];
  const inps = [];
  for (const [sx, sy] of sides) {
    const nb = entAt(e.x + sx, e.y + sy);
    if (!nb) continue;
    const want = dirIndexOf(-sx, -sy);
    // 地下带只有“出口”（前方无同向mate）才会把货投向地面带，入口会把货钻入地下、
    // 不会向旁边传送带输出，因此入口不搭在侧面传送带上（对齐《异星工厂》）。
    if (nb instanceof Underground && nb.dir === want && !nb.findMate()) { inps.push([sx, sy]); continue; }
    if (nb instanceof Belt && nb.dir === want) { inps.push([sx, sy]); continue; }
  }
  e.__inp = inps;
  e.__inpCached = true;
  return inps;
}

// 返回 fromDir 对应的侧面输入索引（0/1），若 not 侧面输入返回 -1。
// 用于 acceptItem 记录物品来自哪个侧面，从而在渲染时让物品从对应侧面“搭上去”。
function beltSideIndex(e, fromDir) {
  const fdx = DX[e.dir], fdy = DY[e.dir];
  const sides = [[fdy, -fdx], [-fdy, fdx]];
  const sx = -DX[fromDir], sy = -DY[fromDir];
  for (let i = 0; i < 2; i++) if (sides[i][0] === sx && sides[i][1] === sy) return i;
  return -1;
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
  for (const s of inp) strip(Math.atan2(s[1], s[0]), 0, step);

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

  // 每个侧面输入各画一条接入带，两侧可同时“搭上去”
  for (const s of inp) {
    const sa = Math.atan2(s[1], s[0]);
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
  // 根据物品来源侧面计算进入起点；无侧面输入时沿主行进方向
  const sideIn = function (o) {
    if (inp.length === 0) return null;
    if (o.side !== undefined && o.side >= 0 && o.side < inp.length) return inp[o.side];
    return inp[0];
  };
  // 低 LOD：物品用色块直填，省去 clip+glyph 的昂贵路径绘制
  const itemFn = (LOD && LOD.simple) ? drawItemDotLOD : drawItemDot;
  for (const o of e.items) {
    let ix, iy;
    if (inp.length && o.pos < 0.5) {
      const s = sideIn(o);
      const inX = cx + s[0] * step, inY = cy + s[1] * step;
      const t = o.pos / 0.5;
      ix = inX + (cx - inX) * t;
      iy = inY + (cy - inY) * t;
    } else if (inp.length) {
      const t = (o.pos - 0.5) / 0.5;
      ix = cx + exitX * t;
      iy = cy + exitY * t;
    } else {
      ix = cx + DX[dir] * (o.pos - 0.5) * TILE;
      iy = cy + DY[dir] * (o.pos - 0.5) * TILE;
    }
    itemFn(ctx, ix, iy, o.item);
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
