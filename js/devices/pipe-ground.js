'use strict';

// ===== 地下管道：背向摆两座（朝向相反，最远 PIPE_GROUND_MAX 格）自动配对，从地下穿行流体 =====
// 管道口背向相对的两座自动配对；一条线上有多个管道时只与最近的背向管道配对（同向的不配对）。
// 可跨过传送带/管道等障碍，容量与普通管道一致（PIPE_CAP）。
// 地下管道与普通管道一样是“互通”的：不分入口/出口，正前方、背侧的地面管道以及配对的
// 另一端地下管道之间按压差双向均压流动，流体可从任一端进入、从任一端流出。
const PIPE_GROUND_MAX = 10;

// 双向均压：将流体 k 从 a/b 中较多的一侧匀到较少的一侧（至少 1 单位），并遵守容量与防混合。
function pipeToGroundSwap(a, b, k) {
  const aF = a.fluid[k] || 0;
  const bF = b.fluid[k] || 0;
  // 防混合：任一端含有其它流体则不交换
  if (a.total() - aF > 0 || b.total() - bF > 0) return;
  if (aF === bF) return;
  let from, to, avail, cap;
  if (aF > bF) { from = a; to = b; avail = aF; cap = PIPE_CAP - b.total(); }
  else { from = b; to = a; avail = bF; cap = PIPE_CAP - a.total(); }
  let move = Math.max(1, Math.floor(Math.abs(aF - bF) / 2));
  move = Math.min(move, avail, cap);
  if (move <= 0) return;
  from.fluid[k] -= move;
  if (from.fluid[k] <= 0) delete from.fluid[k];
  to.fluid[k] = (to.fluid[k] || 0) + move;
}
class PipeToGround extends Entity {
  constructor(type, x, y) {
    super('pipe-to-ground', x, y);
    this.fluid = {};   // 当前格内缓冲流体（用于配对面判断与地面交互）
  }
  total() { let s = 0; for (const k in this.fluid) s += this.fluid[k]; return s; }
  maxDist() { return PIPE_GROUND_MAX; }
  // 沿自身朝向的 sign 方向（+1 前方 / -1 背侧）扫描最近的背向管道；同向的跳过继续，固体阻挡返回 null。
  _findAlong(sign) {
    for (let k = 1; k <= this.maxDist(); k++) {
      const nx = this.x + DX[this.dir] * sign * k, ny = this.y + DY[this.dir] * sign * k;
      const t = entAt(nx, ny);
      if (!t) continue;
      if (t instanceof PipeToGround) {
        if (PipeToGround._parallel(t.dir, this.dir)) return t;
        continue;   // 同向的管道不配对，继续找最近的背向管道
      }
      // 中间不可隔普通管道？不：地下管道本身就是用于穿越管道。但不可隔其它固体设备
      if (t instanceof Pipe) continue;
      if (t.solid) return null;
    }
    return null;
  }
  findMate() {
    // 口对口或背对背、同轴反向的两座都能配对：前方与背侧各找一个最近的背向管道，取更近者。
    const front = this._findAlong(1);
    const back = this._findAlong(-1);
    if (front && back) {
      const df = Math.abs(front.x - this.x) + Math.abs(front.y - this.y);
      const db = Math.abs(back.x - this.x) + Math.abs(back.y - this.y);
      return (df <= db) ? front : back;
    }
    return front || back;
  }
  // 是否已配对：同轴反向（朝向相反）的另一端有配对的地下管道
  isPaired() { return !!this.findMate(); }
  // 两条地下管道只有“背向”（朝向相反，同在一条直线上）才配对。
  // 管道口背靠背相对，地下运行段在两座之间相接；同向的面向同一方、不会在地下相接，因此不配对。
  static _parallel(d1, d2) { return ((d1 - d2 + 4) % 4) === 2; }
  update(dt) {
    // 惰性调度（同普通管道）：流体扩散是抽象均衡，按帧节流避免每帧四向扫描
    this._balT = (this._balT || 0) - dt;
    if (this._balT > 0) return;
    this._balT = 0.05;
    // 双向互通：正前方、背侧的地面管道，以及与它配对的另一端地下管道，
    // 都作为“邻居”按压差互相匀液——流体可从任一端进入、从任一端流出。
    const back = entAt(this.x - DX[this.dir], this.y - DY[this.dir]);
    const front = entAt(this.x + DX[this.dir], this.y + DY[this.dir]);
    const mate = this.findMate();
    const conns = [];
    if (back instanceof Pipe) conns.push(back);
    if (front instanceof Pipe) conns.push(front);
    if (mate) conns.push(mate);
    // 收集所有可能出现的流体种类（本方 + 各邻居），避免只扫本方导致“只进不出”
    const fluids = new Set(Object.keys(this.fluid));
    for (const t of conns) for (const k of Object.keys(t.fluid)) fluids.add(k);
    for (const k of fluids) {
      for (const t of conns) {
        if ((this.fluid[k] > 0) || ((t.fluid[k] || 0) > 0)) pipeToGroundSwap(this, t, k);
      }
    }
    for (const k of Object.keys(this.fluid)) if (!(this.fluid[k] > 0)) delete this.fluid[k];
  }
  giveItem(item) {
    if (FLUIDS.indexOf(item) < 0) return false;
    if (this.total() >= PIPE_CAP) return false;
    for (const k in this.fluid) if (this.fluid[k] > 0 && k !== item) return false;
    this.fluid[item] = (this.fluid[item] || 0) + 1;
    return true;
  }
  peekItem() { for (const k in this.fluid) if (this.fluid[k] > 0) return k; return null; }
  takeItem() { for (const k in this.fluid) if (this.fluid[k] > 0) return this.takeItemOf(k); return null; }
  countOf(item) { return this.fluid[item] || 0; }
  takeItemOf(item) {
    if ((this.fluid[item] || 0) > 0) { this.fluid[item]--; if (this.fluid[item] <= 0) delete this.fluid[item]; return item; }
    return null;
  }
  contents() {
    const list = [[this.type, 1]];
    for (const k in this.fluid) if (this.fluid[k] > 0) list.push([k, this.fluid[k]]);
    return list;
  }
  takeAll() {
    const rows = [];
    for (const k of Object.keys(this.fluid)) { rows.push([k, this.fluid[k]]); delete this.fluid[k]; }
    return rows;
  }
  serialize() { const s = super.serialize(); s.fluid = this.fluid; return s; }
  static restore(s) { const p = super.restore(s); p.fluid = s.fluid || {}; return p; }
}

// ===== 渲染 =====
function drawPipeGround(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  const paired = !!e.isPaired();
  const dx = DX[dir], dy = DY[dir];
  ctx.globalAlpha = alpha;
  // 底层：圆形土坑（区别于普通管道的圆形节点，用泥土色 + 更大半径 + 内缘凹陷）
  ctx.fillStyle = paired ? '#5b543f' : '#4c4c46';
  ctx.beginPath(); ctx.arc(cx, cy, 10.5, 0, 7); ctx.fill();
  ctx.strokeStyle = paired ? '#39342a' : '#3a3a3a';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, 10.5, 0, 7); ctx.stroke();
  // 指向方向（背侧）的管道：粗细/颜色与普通管道一致，指到瓦片边缘，与相邻普通管道无缝衔接
  ctx.strokeStyle = '#7d7264';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  if (!paired) ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(cx - dx * 3, cy - dy * 3);
  ctx.lineTo(cx - dx * (TILE / 2 - 1), cy - dy * (TILE / 2 - 1));
  ctx.stroke();
  ctx.setLineDash([]);
  // 管口亮环（呼应普通管道管口）：位于指向端（背侧）
  ctx.fillStyle = '#8d8272';
  ctx.beginPath(); ctx.arc(cx - dx * 5, cy - dy * 5, 4.5, 0, 7); ctx.fill();
  ctx.strokeStyle = '#55503f';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx - dx * 5, cy - dy * 5, 4.5, 0, 7); ctx.stroke();
  // 流体圆点：位于指向端管口（背侧）
  const total = e.total ? e.total() : 0;
  if (total > 0) {
    const first = Object.keys(e.fluid).find(k => e.fluid[k] > 0);
    if (first && ITEMS[first]) {
      ctx.fillStyle = ITEMS[first].color;
      ctx.beginPath();
      ctx.arc(cx - dx * 5, cy - dy * 5, 3, 0, 7);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function pipeGroundPanelHtml(e) {
  const agg = {};
  for (const k in e.fluid) if (e.fluid[k] > 0) agg[k] = e.fluid[k];
  let h = row('流体', Object.keys(agg).length ? countStr(agg) : '<span class="dim">空</span>', 'contents');
  h += row('容量', e.total() + ' / ' + PIPE_CAP, 'cap');
  if (Object.keys(agg).length) h += '<button data-action="drain" id="btn-pgt-takeout">直接清空</button>';
  h += '<div class="status"></div>';
  h += '<div class="dim">地下管道：背向摆两座（朝向相反，最远 ' + PIPE_GROUND_MAX + ' 格）自动配对，从地下穿行流体，可跨过传送带/管道。与普通管道一样互通，不分入口/出口，正前方与背侧管道及配对端均按压差双向输送。一条线上多个管道时只与最近的背向管道配对。R 旋转方向。</div>';
  return h;
}
function pipeGroundPanelLive(e, api) {
  const agg = {};
  for (const k in e.fluid) if (e.fluid[k] > 0) agg[k] = e.fluid[k];
  api.set('contents', Object.keys(agg).length ? countStr(agg) : dimSpan('空'));
  api.set('cap', e.total() + ' / ' + PIPE_CAP);
  api.toggle('#btn-pgt-takeout', e.total() > 0, '直接清空');
  if (!e.isPaired()) api.status('已暂停：未配对（背向 ' + PIPE_GROUND_MAX + ' 格内无朝向相反的另一座地下管道）', 'warn');
  else if (e.total() > 0) api.status('输送中：与前后管道双向均压流动', 'ok');
  else api.status('地下互通：等待流体进入', 'ok');
}
function pipeGroundTip(e) {
  const agg = {};
  for (const k in e.fluid) if (e.fluid[k] > 0) agg[k] = e.fluid[k];
  if (e.isPaired()) return '地下管道：互通双向输送' + (Object.keys(agg).length ? '（缓冲 ' + Object.keys(agg).map(k => ITEMS[k].name + '×' + agg[k]).join('、') + '）' : '') + '，R 旋转方向';
  return '未配对（背向 ' + PIPE_GROUND_MAX + ' 格内无朝向相反的另一座）';
}

// ===== 注册 =====
ENT_CLASSES['pipe-to-ground'] = PipeToGround;
DEVICE_RENDER['pipe-to-ground'] = drawPipeGround;
DEVICE_STATUS['pipe-to-ground'] = e => e.findMate() ? (e.total() > 0 ? 'g' : 'r') : 'y';
DEVICE_PANEL['pipe-to-ground'] = { html: pipeGroundPanelHtml, live: pipeGroundPanelLive, tip: pipeGroundTip };
DEVICE_DIR_ROTATE['pipe-to-ground'] = true;
