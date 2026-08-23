'use strict';

// ===== 分流器（含优先级分流器）=====
class Splitter extends Belt {
  constructor(type, x, y) {
    super(type || 'splitter', x, y);
    this.items = [];
    this.inPref = 0;
    this.outToggle = false;
    this.outPref = type === 'priority-splitter' ? 1 : -1; // -1=均衡轮发，0/1=优先某侧
    this.applyDir();
  }
  applyDir() {
    if (this.dir % 2 === 1) { this.w = this.def.h; this.h = this.def.w; }
    else { this.w = this.def.w; this.h = this.def.h; }
  }
  laneVec() { return [-DY[this.dir], DX[this.dir]]; }
  laneCenter(l) {
    const cx = (this.x + this.w / 2) * TILE, cy = (this.y + this.h / 2) * TILE;
    const p = this.laneVec();
    const off = (l - 0.5) * TILE;
    return [cx + p[0] * off, cy + p[1] * off];
  }
  update(dt) {
    const sp = beltSpeed() * dt;
    this.items.sort((a, b) => b.pos - a.pos);
    for (let i = 0; i < this.items.length; i++) {
      const o = this.items[i];
      const lim = i === 0 ? 0.999 : Math.max(0, this.items[i - 1].pos - BELT_SPACING);
      if (o.pos < lim) o.pos = Math.min(o.pos + sp, lim);
      if (o.pos >= 0.5 && o.outLane === undefined) {
        if (this.outPref >= 0) {
          o.outLane = this.outPref;
        } else {
          o.outLane = this.outToggle ? 1 : 0;
          this.outToggle = !this.outToggle;
        }
      }
      if (o.pos >= 0.999 && o.outLane !== undefined) {
        let ok = this.pushOut(o.item, o.outLane);
        if (!ok) {
          const alt = 1 - o.outLane;
          if (this.pushOut(o.item, alt)) { o.outLane = alt; ok = true; }
        }
        if (ok) { this.items.splice(i, 1); i--; }
        else o.pos = 0.999;
      }
    }
  }
  pushOut(item, lane) {
    const [ex, ey] = this.laneCenter(lane);
    const tx = Math.floor((ex + DX[this.dir] * TILE) / TILE);
    const ty = Math.floor((ey + DY[this.dir] * TILE) / TILE);
    const t = entAt(tx, ty);
    if (!t) return false;
    if (t instanceof Belt && !(t instanceof Splitter)) {
      if (t.dir === ((this.dir + 2) % 4)) return false;
      return t.acceptItem(item, this.dir);
    }
    if (!(t instanceof Underground)) return t.giveItem(item);
    return false;
  }
  acceptItem(item, fromDir, sx, sy) {
    let pref = this.inPref;
    const rel = ((fromDir - this.dir) % 4 + 4) % 4;
    if (sx !== undefined && sx !== null && rel === 0) {
      const pv = this.laneVec();
      const ccx = (this.x + this.w / 2) * TILE, ccy = (this.y + this.h / 2) * TILE;
      const scx = (sx + 0.5) * TILE, scy = (sy + 0.5) * TILE;
      const d = (scx - ccx) * pv[0] + (scy - ccy) * pv[1];
      pref = d > 0 ? 1 : 0;
    } else if (sx !== undefined && sx !== null && rel !== 0 && rel !== 2) {
      const fv = [DX[this.dir], DY[this.dir]];
      const ccx = (this.x + this.w / 2) * TILE, ccy = (this.y + this.h / 2) * TILE;
      const scx = (sx + 0.5) * TILE, scy = (sy + 0.5) * TILE;
      const d = (scx - ccx) * fv[0] + (scy - ccy) * fv[1];
      pref = d > 0 ? 1 : 0;
    }
    for (let n = 0; n < 2; n++) {
      const l = (pref + n) % 2;
      const blocked = this.items.some(o => o.lane === l && o.pos < BELT_SPACING);
      if (!blocked) {
        this.items.push({ item, pos: 0, lane: l });
        if (rel !== 0 && rel !== 2) this.inPref = 1 - this.inPref;
        return true;
      }
    }
    return false;
  }
  takeItem() {
    if (!this.items.length) return null;
    let best = this.items[0];
    for (const o of this.items) if (o.pos > best.pos) best = o;
    this.items.splice(this.items.indexOf(best), 1);
    return best.item;
  }
  giveItem(item) { return this.acceptItem(item); }
  serialize() {
    return {
      type: this.type, x: this.x, y: this.y, dir: this.dir,
      outPref: this.outPref,
      items: this.items.map(o => [o.item, +o.pos.toFixed(3), o.lane, o.outLane === undefined ? -1 : o.outLane])
    };
  }
  static restore(s) {
    const e = new this(s.type, s.x, s.y);
    e.dir = s.dir | 0;
    e.applyDir();
    e.outPref = typeof s.outPref === 'number' ? s.outPref : (e.constructor === PrioritySplitter ? 1 : -1);
    e.items = (s.items || []).map(a => ({ item: a[0], pos: a[1], lane: a[2] || 0, outLane: a[3] >= 0 ? a[3] : undefined }));
    return e;
  }
}

class PrioritySplitter extends Splitter {
  constructor(type, x, y) {
    super(type || 'priority-splitter', x, y);
    this.outPref = 1;
  }
}

// ===== 渲染 =====
function drawSplitter(ctx, e, gx, gy, dir, alpha) {
  ctx.globalAlpha = alpha;
  const cx = (gx + e.w / 2) * TILE, cy = (gy + e.h / 2) * TILE;
  const across = (dir % 2 === 1 ? e.w : e.h) * TILE;
  const running = e.items.length > 0;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(dir * Math.PI / 2);
  ctx.fillStyle = '#4a4436';
  rr(ctx, -TILE / 2 + 2, -across / 2 + 2, TILE - 4, across - 4, 6);
  ctx.fill();
  ctx.strokeStyle = '#26221d';
  ctx.lineWidth = 2;
  rr(ctx, -TILE / 2 + 2, -across / 2 + 2, TILE - 4, across - 4, 6);
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.rect(-TILE / 2 + 4, -across / 2 + 4, TILE - 8, across - 8);
  ctx.clip();
  ctx.strokeStyle = 'rgba(224,178,60,.16)';
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
  // 流向指示：亮色箭头指向输出方向（放置时即可辨认物流方向）
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
    ctx.strokeStyle = 'rgba(143,224,143,' + (0.45 + 0.25 * Math.sin(G.time * 6)).toFixed(2) + ')';
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
    drawItemDot(ctx, ix, iy, o.item);
  }
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function splitterPanelHtml(e) {
  const prefNames = { '-1': '均衡轮发', '0': '优先一侧', '1': '优先另一侧' };
  let h = '<div class="dim">分流器：货物分向前方两侧；一边堵了自动走另一边。R 旋转方向。</div>';
  h += '<div class="mrow"><span class="mlabel">输出模式</span><span class="mval">';
  for (const v of [-1, 0, 1]) {
    h += '<button data-action="spref" data-v="' + v + '"' + (e.outPref === v ? ' style="border-color:#ffd23c;color:#ffd23c"' : '') + '>' + prefNames[v] + '</button> ';
  }
  h += '</span></div>';
  if (e.outPref >= 0) h += '<div class="dim">带黄色箭头的一侧为优先输出道；堵住时自动溢出到另一侧。</div>';
  return h;
}

// ===== 注册 =====
function splitterStatusFn(e) {
  if (!e.items.length) return 'r';
  return e.items.some(o => o.pos >= 0.499) ? 'y' : 'g';
}
function splitterOnAction(act, btn) {
  if (act === 'spref') {
    if (G.panelEnt instanceof Splitter) G.panelEnt.outPref = parseInt(btn.dataset.v, 10);
    return true;
  }
  return false;
}
const splitterPanel = { html: splitterPanelHtml, onAction: splitterOnAction };
ENT_CLASSES['splitter'] = Splitter;
ENT_CLASSES['priority-splitter'] = PrioritySplitter;
DEVICE_RENDER['splitter'] = drawSplitter;
DEVICE_RENDER['priority-splitter'] = drawSplitter;
DEVICE_STATUS['splitter'] = splitterStatusFn;
DEVICE_STATUS['priority-splitter'] = splitterStatusFn;
DEVICE_PANEL['splitter'] = splitterPanel;
DEVICE_PANEL['priority-splitter'] = splitterPanel;
