'use strict';

// ===== 分流器（含优先级分流器）=====
class Splitter extends Belt {
  constructor(type, x, y) {
    super(type || 'splitter', x, y);
    this.items = [];
    this.inPref = 0;
    this.outToggle = false;
    this.filter = null; // 可编程分离器过滤：仅放行该物品，其余物品被挡在入口（对齐《异星工厂》Programmable splitter）
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
    // 惰性调度（P0 优化）：空分流器无需每帧处理
    if (!this.items || this.items.length === 0) return;
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
    // 可编程分离器过滤：设置了过滤物且物品不匹配时，拒绝放行（物品停留在上游传送带）
    if (this.filter && item !== this.filter) return false;
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
      filter: this.filter,
      items: this.items.map(o => [o.item, +o.pos.toFixed(3), o.lane, o.outLane === undefined ? -1 : o.outLane])
    };
  }
  // 蓝图保留优先输出配置，不复制传送带上的物品
  blueprint() {
    const s = super.blueprint();
    s.outPref = this.outPref;
    s.filter = this.filter;
    return s;
  }
  static restore(s) {
    const e = new this(s.type, s.x, s.y);
    e.dir = s.dir | 0;
    e.applyDir();
    e.outPref = typeof s.outPref === 'number' ? s.outPref : (e.constructor === PrioritySplitter ? 1 : -1);
    e.filter = s.filter || null;
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
// 判断某格实体是否可作为“入口连接”：普通传送带（朝向一致）、地下带出口（朝向一致），
// 或另一个分流器（视为连接的传送带）。
// 注：分流器之间无论朝向如何都应视为已连接——因为分流器的 pushOut 会把物品
// 无条件交给相邻的下游分流器（giveItem 不检查方向），物品确实能流过去，
// 因此即使下游分流器朝向不同，也照样显示“入口流入 / 出口流出”动画。
function isInletConnected(ent, dir) {
  if (!ent) return false;
  if (ent instanceof Belt && !(ent instanceof Splitter) && ent.dir === dir) return true;
  if (ent instanceof Underground && ent.dir === dir && ent.findBackMate()) return true;
  // 上游分流器的出口朝向我们时，视为连接的传送带，一样处理。
  if (ent instanceof Splitter) return true;
  return false;
}
// 判断某格实体是否可作为“出口连接”：普通传送带（朝向一致）、地下带出口（朝向一致），
// 或另一个分流器（视为连接的传送带）。
function isOutletConnected(ent, dir) {
  if (!ent) return false;
  if (ent instanceof Belt && !(ent instanceof Splitter) && ent.dir === dir) return true;
  if (ent instanceof Underground && ent.dir === dir && ent.findBackMate()) return true;
  // 下游分流器的入口朝向我们时，视为连接的传送带，一样处理。
  if (ent instanceof Splitter) return true;
  return false;
}
// 检测分流器每条 lane 的输入/输出是否接有传送带（或地下带出口 / 相连的分流器）。
// 返回 { inp:[bool,bool], out:[bool,bool] }，inp[l]/out[l] 表示 lane l 是否接了带。
// ox/oy 为实体左上角绘制坐标（正常= e.x/e.y；蓝图/鬼影=光标格），用于在预览时也能正确计算。
function splitterLinks(e, ox, oy) {
  const inp = [false, false], out = [false, false];
  for (let l = 0; l < 2; l++) {
    const [lx, ly] = laneCenterAt(e, ox, oy, l);
    // 入口传送带位于分流器后方一整个 tile：从 lane 中心沿流向反方向退一整格，
    // 否则只退半格会落在分流器自身格子上（导致入口连接永远判为 false）。
    const inTx = Math.floor((lx - DX[e.dir] * TILE) / TILE);
    const inTy = Math.floor((ly - DY[e.dir] * TILE) / TILE);
    inp[l] = isInletConnected(entAt(inTx, inTy), e.dir);
    const outTx = Math.floor((lx + DX[e.dir] * TILE) / TILE);
    const outTy = Math.floor((ly + DY[e.dir] * TILE) / TILE);
    out[l] = isOutletConnected(entAt(outTx, outTy), e.dir);
  }
  return { inp, out };
}

// 沿分流器内部路径绘制流动箭头动画：
//  - 双入双出（两入口+两出口都接带）：两条 lane 各自流入、各自流出，交叉分流；
//  - 单入单出（仅一入口+一出口）：沿该 lane 直线直通，像普通传送带一样流动。
// 在恢复世界坐标系后调用（箭头路径用世界坐标），alpha 用于蓝图/鬼影半透明。
function laneCenterAt(e, ox, oy, l) {
  const cx = (ox + e.w / 2) * TILE, cy = (oy + e.h / 2) * TILE;
  const p = [-DY[e.dir], DX[e.dir]];
  const off = (l - 0.5) * TILE;
  return [cx + p[0] * off, cy + p[1] * off];
}

// 检查分流器某条 lane 的入口传送带上是否有物品（有货要流进来），从而驱动流入动画。
// 入口传送带位于分流器后方沿 dir 反方向；只要带上有物品且方向朝向分流器，即视为“有货流入”。
function splitterInputHasItem(e, l, gx, gy) {
  const [lx, ly] = laneCenterAt(e, gx, gy, l);
  const inTx = Math.floor((lx - DX[e.dir] * TILE) / TILE);
  const inTy = Math.floor((ly - DY[e.dir] * TILE) / TILE);
  const inEnt = entAt(inTx, inTy);
  if (!inEnt || !inEnt.items || !inEnt.items.length) return false;
  // 传送带上确有物品（物品最终会流向分流器）
  return true;
}

// 重新设计的分流器流动动画：
//  - 流入动画（入口→中心）：某 lane 入口接了传送带，且（入口传送带上有货 或 分流器内部确有物品正在从该入口流入）；
//  - 流出动画（中心→出口）：某 lane 出口接了传送带，且分流器内部确有物品正在从该出口流出。
// 这样既能避免“出口没接带却凭空消失 / 入口没货却凭空产生”，又能在物品即将进入/正在离开时保持动画连贯。
function drawSplitterFlow(ctx, e, gx, gy, color, alpha) {
  const links = splitterLinks(e, gx, gy);
  const inFlow = [false, false], outFlow = [false, false];
  for (let l = 0; l < 2; l++) {
    // 流入：入口接带 &&（入口传送带上有货 或 分流器内部有物品正从该入口流向中心）
    inFlow[l] = links.inp[l] && (splitterInputHasItem(e, l, gx, gy) ||
      e.items.some(o => o.lane === l && o.pos < 0.5));
    // 流出：出口接带 && 分流器内部确有物品正在从该出口流向出口
    outFlow[l] = links.out[l] && e.items.some(o => (o.outLane !== undefined ? o.outLane : o.lane) === l && o.pos >= 0.5);
  }
  if (!inFlow[0] && !inFlow[1] && !outFlow[0] && !outFlow[1]) return;
  const cx = (gx + e.w / 2) * TILE, cy = (gy + e.h / 2) * TILE;
  const dx = DX[e.dir], dy = DY[e.dir];
  const ang = Math.atan2(dy, dx);
  const step = TILE / 2;
  const offset = (G.time * beltSpeed() * (e.speedMult ? e.speedMult() : 1) * TILE) % step;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(0,0,0,.4)';
  ctx.lineWidth = 1;
  const drawArrow = (ax, ay) => {
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(ang);
    tri(ctx, -3, -5, -3, 5, 3, 0);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };
  // 输出侧：从中心流向各出口 lane（仅对出口接带且确有物品流出的 lane 绘制）
  for (let l = 0; l < 2; l++) {
    if (!outFlow[l]) continue;
    const [lx, ly] = laneCenterAt(e, gx, gy, l);
    const ox = lx + dx * TILE / 2, oy = ly + dy * TILE / 2;
    for (let k = 0; k <= 2; k++) {
      const t = (k * step + offset) / step;
      if (t > 1) continue;
      drawArrow(cx + (ox - cx) * t, cy + (oy - cy) * t);
    }
  }
  // 输入侧：从各入口 lane 流向中心（仅对入口接带且确有物品流入的 lane 绘制）
  for (let l = 0; l < 2; l++) {
    if (!inFlow[l]) continue;
    const [lx, ly] = laneCenterAt(e, gx, gy, l);
    const ix = lx - dx * TILE / 2, iy = ly - dy * TILE / 2;
    for (let k = 0; k <= 2; k++) {
      const t = (k * step + offset) / step;
      if (t > 1) continue;
      drawArrow(ix + (cx - ix) * t, iy + (cy - iy) * t);
    }
  }
  ctx.restore();
}

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
  // 根据输入/输出传送带连接情况绘制流动箭头动画（双入双出交叉分流；单入单出直通）
  drawSplitterFlow(ctx, e, gx, gy, 'rgba(224,178,60,.8)', alpha);
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
  // 可编程分离器：叠加过滤物品小图标（对齐《异星工厂》Programmable splitter 视觉提示）
  if (e.filter && ITEMS[e.filter]) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha *= 0.9;
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.beginPath();
    ctx.arc(0, 0, TILE * 0.24, 0, 7);
    ctx.fill();
    ctx.strokeStyle = '#ffd23c';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
    drawItemDot(ctx, cx, cy, e.filter);
  }
  const p = e.laneVec();
  const links = splitterLinks(e, gx, gy);
  for (const o of e.items) {
    const outL = o.outLane !== undefined ? o.outLane : o.lane;
    // 入口未接传送带：不绘制该入口的物品移动动画（物品不会凭空从无带入口出现）；
    // 出口未接传送带：不绘制该出口的物品移动动画（物品不会凭空流向无带出口）。
    if (o.pos <= 0.5 ? !links.inp[o.lane] : !links.out[outL]) continue;
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
  // 可编程分离器：物品过滤（对齐《异星工厂》Programmable splitter）
  h += '<div class="sec">过滤（可编程分离器）</div>';
  h += '<div class="mrow"><span class="mlabel">仅放行</span><span class="mval">' +
    (e.filter ? chip(e.filter) : '<span class="dim">全部放行</span>') + '</span></div>';
  h += '<div class="recgrid">';
  for (const id of (typeof filterChoices === 'function' ? filterChoices() : FILTER_CHOICES)) {
    h += '<button class="rcbtn ' + (e.filter === id ? 'sel' : '') + '" data-action="sflt" data-id="' + id + '" data-itemid="' + id + '">' +
      '<img src="' + iconDataURL(id) + '">' + ITEMS[id].name + '</button>';
  }
  h += '</div>';
  if (e.filter) h += '<button data-action="sflt-clear">清除过滤（放行所有物品）</button>';
  h += '<div class="status"></div>';
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
  if (act === 'sflt') {
    if (G.panelEnt instanceof Splitter) G.panelEnt.filter = btn.dataset.id || null;
    return true;
  }
  if (act === 'sflt-clear') {
    if (G.panelEnt instanceof Splitter) G.panelEnt.filter = null;
    return true;
  }
  return false;
}
function splitterPanelLive(e, api) {
  if (e.filter) {
    api.status('过滤中：仅放行「' + ITEMS[e.filter].name + '」', 'ok');
    return;
  }
  if (!e.items.length) { api.status('空闲（无物品）', 'ok'); return; }
  // 出口拥堵：任一物品到达输出端却无法送出（停住）
  const stuck = e.items.some(o => o.pos >= 0.999);
  api.status(stuck ? '已暂停：输出端拥堵，等待疏通' : '分选中：' + e.items.length + ' 件在途', stuck ? 'warn' : 'ok');
}
const splitterPanel = { html: splitterPanelHtml, onAction: splitterOnAction, live: splitterPanelLive, tip: splitterTip };
function splitterTip(e) {
  if (e.filter) return '分流器：仅放行「' + ITEMS[e.filter].name + '」' + (e.outPref >= 0 ? '，优先一侧' : '');
  return '分流器：分向前方两侧（R 旋转；点开面板可设过滤/优先级）';
}
ENT_CLASSES['splitter'] = Splitter;
ENT_CLASSES['priority-splitter'] = PrioritySplitter;
DEVICE_RENDER['splitter'] = drawSplitter;
DEVICE_RENDER['priority-splitter'] = drawSplitter;
DEVICE_STATUS['splitter'] = splitterStatusFn;
DEVICE_STATUS['priority-splitter'] = splitterStatusFn;
DEVICE_PANEL['splitter'] = splitterPanel;
DEVICE_PANEL['priority-splitter'] = splitterPanel;
