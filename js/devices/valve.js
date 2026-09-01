'use strict';

// ===== 流体阀门（Factorio 2.0，官方 valve 原型）=====
// 1×1 管道设备，置于两段管道之间，按阀门模式约束流体流动方向/压力：
//   - one-way-valve  单向阀：只允许流体沿箭头方向（背侧→前侧）单向流动，反向截止。
//   - overflow-valve 溢出阀：仅当入口侧压力超过阈值（官方 threshold=0.8，即缓冲 80%）时，
//                     才把流体送向前侧，实现「优先自用、满则外溢」。
//   - top-up-valve   补给阀：仅当出口侧压力低于阈值（官方 threshold=0.5）时，
//                     才从入口侧补给流体，用于维持下游储液罐/管道液位。
// 数据（占地/血量/堆叠/命名/模式阈值/流速）全部来自 data.generated.js（factorio-data 官方单源）。

const VALVE_VOLUME = 100;                 // 官方 valve fluid_box.volume=100，与管道容量一致
const VALVE_FLOW_RATE = 20;               // 官方 flow_rate=20（单位/秒）
const VALVE_MODES = { 'one-way-valve': 'one-way', 'overflow-valve': 'overflow', 'top-up-valve': 'top-up' };
const VALVE_THRESHOLD = { 'overflow-valve': 0.8, 'top-up-valve': 0.5 };  // 官方 threshold

class FluidValve extends Entity {
  constructor(type, x, y) {
    super(type, x, y);
    this.fluid = {};
  }
  total() { let s = 0; for (const k in this.fluid) s += this.fluid[k]; return s; }
  mode() { return VALVE_MODES[this.type] || 'one-way'; }
  threshold() { return VALVE_THRESHOLD[this.type] || 0.8; }

  // 是否允许流体从「背侧 → 前侧」通过
  shouldPass() {
    const back = entAt(this.x - DX[this.dir], this.y - DY[this.dir]);
    const front = entAt(this.x + DX[this.dir], this.y + DY[this.dir]);
    if (this.mode() === 'one-way') return true;  // 单向阀始终放行（方向由进出位置保证）
    if (this.mode() === 'overflow') {
      // 溢出阀：入口侧压力（含本缓冲）超过阈值才外溢
      const inPress = (back && pipeConnAt(back.x, back.y, (this.dir + 2) % 4) ? back.total() : 0) + this.total();
      return inPress >= VALVE_VOLUME * this.threshold();
    }
    if (this.mode() === 'top-up') {
      // 补给阀：出口侧压力低于阈值才补给
      const outPress = front && pipeConnAt(front.x, front.y, this.dir) ? front.total() : 0;
      return outPress < VALVE_VOLUME * this.threshold();
    }
    return true;
  }

  update(dt) {
    // 从背侧管道吸入
    const back = entAt(this.x - DX[this.dir], this.y - DY[this.dir]);
    const front = entAt(this.x + DX[this.dir], this.y + DY[this.dir]);
    if (back && pipeConnAt(back.x, back.y, (this.dir + 2) % 4) && this.total() < VALVE_VOLUME) {
      for (const k of Object.keys(back.fluid)) {
        if (!(back.fluid[k] > 0)) continue;
        if (this.total() >= VALVE_VOLUME) break;
        if (!this.giveItem(k)) continue;
        back.takeItemOf(k);
      }
    }
    // 阀门模式决定是否向前侧输出
    if (this.mode() === 'one-way' || this.shouldPass()) {
      if (this.total() > 0 && front) {
        let n = VALVE_FLOW_RATE * dt;
        for (const k of Object.keys(this.fluid)) {
          if (!(this.fluid[k] > 0) || n <= 0) break;
          if (pipeConnAt(front.x, front.y, this.dir)) {
            while (n > 0 && this.fluid[k] > 0 && front.total() < PIPE_CAP && front.giveItem(k)) {
              this.fluid[k]--; n--;
            }
          } else if (front instanceof StorageTank) {
            if (front.isPortCell && !front.isPortCell(this.x, this.y)) break;
            while (n > 0 && this.fluid[k] > 0 && front.giveItem(k)) { this.fluid[k]--; n--; }
          } else if (front instanceof Refinery || front instanceof ChemicalPlant ||
                     (front instanceof Assembler && front.acceptsFluid(k)) ||
                     front instanceof ElectricDrill) {
            if (front.isFluidInlet && !front.isFluidInlet(this.x, this.y)) break;
            while (n > 0 && this.fluid[k] > 0 && front.giveItem(k)) { this.fluid[k]--; n--; }
          }
        }
      }
    }
    for (const k of Object.keys(this.fluid)) if (!(this.fluid[k] > 0)) delete this.fluid[k];
  }
  giveItem(item) {
    if (FLUIDS.indexOf(item) < 0) return false;
    if (this.total() >= VALVE_VOLUME) return false;
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
function drawValve(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  ctx.globalAlpha = alpha;
  // 阀体外壳（管道同色）
  ctx.fillStyle = '#7d7264';
  ctx.beginPath(); ctx.arc(cx, cy, 9, 0, 7); ctx.fill();
  ctx.strokeStyle = '#55503f';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, 9, 0, 7); ctx.stroke();
  // 阀芯：单向阀=三角箭头，溢出阀/补给阀=圆盘+阈值缺口
  const mode = e.mode();
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(dir * Math.PI / 2);
  if (mode === 'one-way') {
    ctx.fillStyle = '#4a8a6a';
    ctx.beginPath();
    ctx.moveTo(6, 0); ctx.lineTo(-4, -5); ctx.lineTo(-4, 5); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#2c5a44';
    ctx.fillRect(-4, -7, 2, 14);
  } else {
    ctx.fillStyle = mode === 'overflow' ? '#b0802a' : '#4a90b0';
    ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, 7); ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, 7); ctx.stroke();
    // 阈值刻度
    ctx.fillStyle = '#fff';
    const th = e.threshold();
    const ang = th * 2 * Math.PI;
    ctx.beginPath(); ctx.moveTo(0, 0);
    ctx.arc(0, 0, 3.5, 0, ang);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  // 流体显示
  const total = e.total ? e.total() : 0;
  if (total > 0) {
    const first = Object.keys(e.fluid).find(k => e.fluid[k] > 0);
    if (first && ITEMS[first]) {
      ctx.fillStyle = ITEMS[first].color;
      ctx.globalAlpha = alpha * 0.7;
      ctx.beginPath(); ctx.arc(cx, cy, 2.5, 0, 7); ctx.fill();
      ctx.globalAlpha = alpha;
    }
  }
  ctx.fillStyle = dirColorNotch(dir);
  notch(ctx, px, py, dir);
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function valvePanelHtml(e) {
  const agg = {};
  for (const k in e.fluid) if (e.fluid[k] > 0) agg[k] = e.fluid[k];
  const modeName = { 'one-way-valve': '单向阀（One-way）', 'overflow-valve': '溢出阀（Overflow）', 'top-up-valve': '补给阀（Top-up）' }[e.type] || e.type;
  let h = row('类型', modeName, 'type');
  h += row('流体', Object.keys(agg).length ? '<div class="asm3-inp-row">' + itemSlotsHtml(agg, { action: 'display' }) + '</div>' : '<span class="dim">空</span>', 'contents');
  h += row('缓冲', e.total() + ' / ' + VALVE_VOLUME, 'cap');
  if (Object.keys(agg).length) h += '<button data-action="drain" id="btn-valve-takeout">直接清空</button>';
  h += '<div class="dim">阀门按模式约束管道流体：单向阀只放行箭头方向；溢出阀在入口压力超过阈值时外溢；补给阀在出口压力低于阈值时补给。R 旋转方向。</div>';
  return h;
}
function valvePanelLive(e, api) {
  const agg = {};
  for (const k in e.fluid) if (e.fluid[k] > 0) agg[k] = e.fluid[k];
  api.set('contents', Object.keys(agg).length ? '<div class="asm3-inp-row">' + itemSlotsHtml(agg, { action: 'display' }) + '</div>' : dimSpan('空'));
  api.set('cap', e.total() + ' / ' + VALVE_VOLUME);
  api.toggle('#btn-valve-takeout', e.total() > 0, '直接清空');
  const back = entAt(e.x - DX[e.dir], e.y - DY[e.dir]);
  const front = entAt(e.x + DX[e.dir], e.y + DY[e.dir]);
  const inPress = (back && pipeConnAt(back.x, back.y, (e.dir + 2) % 4) ? back.total() : 0) + e.total();
  const outPress = front && pipeConnAt(front.x, front.y, e.dir) ? front.total() : 0;
  if (e.mode() === 'overflow') {
    if (inPress >= VALVE_VOLUME * e.threshold()) api.status('开阀：入口压力达阈值，流体外溢', 'ok');
    else api.status('闭阀：入口压力未达阈值（' + inPress.toFixed(0) + ' / ' + (VALVE_VOLUME * e.threshold()) + '）', 'warn');
  } else if (e.mode() === 'top-up') {
    if (outPress < VALVE_VOLUME * e.threshold()) api.status('开阀：出口压力低，正在补给', 'ok');
    else api.status('闭阀：出口压力充足，停止补给', 'warn');
  } else {
    api.status(back && pipeConnAt(back.x, back.y, (e.dir + 2) % 4) && back.total() > 0 ? '单向流通：背侧→前侧' : '待机', 'ok');
  }
}
function valveTip(e) {
  const agg = {};
  for (const k in e.fluid) if (e.fluid[k] > 0) agg[k] = e.fluid[k];
  const mode = { 'one-way-valve': '单向阀', 'overflow-valve': '溢出阀', 'top-up-valve': '补给阀' }[e.type] || '';
  return Object.keys(agg).length
    ? (mode + '·' + Object.keys(agg).map(k => ITEMS[k].name + '×' + agg[k]).join('、'))
    : (mode + '（R 旋转方向）');
}

// ===== 注册 =====
for (const vt of ['one-way-valve', 'overflow-valve', 'top-up-valve']) {
  ENT_CLASSES[vt] = FluidValve;
  DEVICE_RENDER[vt] = drawValve;
  DEVICE_STATUS[vt] = e => e.total() > 0 ? 'g' : 'r';
  DEVICE_PANEL[vt] = { html: valvePanelHtml, live: valvePanelLive, tip: valveTip };
  DEVICE_DIR_ROTATE[vt] = true;
}
