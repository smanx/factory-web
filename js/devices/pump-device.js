'use strict';

// ===== 流体泵：从背侧吸入流体、向前侧加压泵出（对齐《异星工厂》Pump，占地 1×1）=====
// 单向输送、吞吐更高（每帧可推多单位），用于给管道网络提速或跨过障碍抽送。
const PUMP_BUF_CAP = 40;
const PUMP_FLOW_PER_TICK = 6;
class FluidPump extends Entity {
  constructor(type, x, y) {
    super('pump', x, y);
    this.fluid = {};
    this.circuitCond = { enabled: false, channel: 'red', sig: 'iron-plate', op: '>', count: 1 };
  }
  total() { let s = 0; for (const k in this.fluid) s += this.fluid[k]; return s; }
  // 电路控制：若启用了条件，读取附近电路网络信号，不满足则停泵
  circuitEnabled() {
    if (!this.circuitCond || !this.circuitCond.enabled) return true;
    const sig = circuitSignalNear(this);
    return circuitCondOk(sig, this.circuitCond);
  }
  update(dt) {
    if (!this.circuitEnabled()) return;
    const back = entAt(this.x - DX[this.dir], this.y - DY[this.dir]);
    const front = entAt(this.x + DX[this.dir], this.y + DY[this.dir]);
    // 吸入：从背侧管道
    if (back instanceof Pipe && this.total() < PUMP_BUF_CAP) {
      for (const k of Object.keys(back.fluid)) {
        if (!(back.fluid[k] > 0)) continue;
        if (this.total() >= PUMP_BUF_CAP) break;
        if (!this.giveItem(k)) continue;
        back.takeItemOf(k);
      }
    }
    // 泵出：向前侧管道/储液罐/设备
    let transferred = 0;
    if (this.total() > 0 && front) {
      let n = PUMP_FLOW_PER_TICK;
      for (const k of Object.keys(this.fluid)) {
        if (!(this.fluid[k] > 0) || n <= 0) break;
        if (front instanceof Pipe) {
          while (n > 0 && this.fluid[k] > 0 && front.total() < PIPE_CAP && front.giveItem(k)) {
            this.fluid[k]--; n--; transferred++;
          }
        } else if (front instanceof StorageTank || front instanceof Boiler) {
          // 泵向储液罐灌入：仅允许在对角接口格接入（另一对对角为空不可接管）
          if (front instanceof StorageTank && front.isPortCell && !front.isPortCell(this.x, this.y)) break;
          while (n > 0 && this.fluid[k] > 0 && front.giveItem(k)) { this.fluid[k]--; n--; transferred++; }
        } else if (front instanceof Refinery || front instanceof ChemicalPlant ||
                   (front instanceof Assembler && front.acceptsFluid(k)) ||
                   front instanceof ElectricDrill) {
          if (front.isFluidInlet && !front.isFluidInlet(this.x, this.y)) break;
          while (n > 0 && this.fluid[k] > 0 && front.giveItem(k)) { this.fluid[k]--; n--; transferred++; }
        }
      }
      if (transferred > 0 && typeof onScreen === 'function' && onScreen(this) && typeof playSfx === 'function') playSfx('pump');
    }
    for (const k of Object.keys(this.fluid)) if (!(this.fluid[k] > 0)) delete this.fluid[k];
  }
  giveItem(item) {
    if (FLUIDS.indexOf(item) < 0) return false;
    if (this.total() >= PUMP_BUF_CAP) return false;
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
  serialize() { const s = super.serialize(); s.fluid = this.fluid; s.circuitCond = this.circuitCond; return s; }
  static restore(s) { const p = super.restore(s); p.fluid = s.fluid || {}; p.circuitCond = s.circuitCond || { enabled: false, channel: 'red', sig: 'iron-plate', op: '>', count: 1 }; return p; }
}

// ===== 渲染 =====
function drawFluidPump(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#3d6a72';
  rr(ctx, px + 3, py + 3, TILE - 6, TILE - 6, 6); ctx.fill();
  ctx.strokeStyle = '#25454d';
  ctx.lineWidth = 2;
  rr(ctx, px + 3, py + 3, TILE - 6, TILE - 6, 6); ctx.stroke();
  // 泵体圆盘
  ctx.fillStyle = '#5aa0a8';
  ctx.beginPath(); ctx.arc(cx, cy, 8.5, 0, 7); ctx.fill();
  ctx.strokeStyle = '#2f5a62';
  ctx.lineWidth = 2;
  ctx.stroke();
  // 旋转叶片
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(dir * Math.PI / 2 + (G.time * 3));
  ctx.fillStyle = '#cfe8ec';
  for (const a of [0, Math.PI / 3, Math.PI * 2 / 3]) {
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(Math.cos(a) * 7, Math.sin(a) * 7);
    ctx.lineTo(Math.cos(a + 0.6) * 7, Math.sin(a + 0.6) * 7);
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
  // 流体显示
  const total = e.total ? e.total() : 0;
  if (total > 0) {
    const first = Object.keys(e.fluid).find(k => e.fluid[k] > 0);
    if (first && ITEMS[first]) {
      ctx.fillStyle = ITEMS[first].color;
      ctx.beginPath();
      ctx.arc(cx, cy, 3.5, 0, 7);
      ctx.fill();
    }
  }
  ctx.fillStyle = dirColorNotch(dir);
  notch(ctx, px, py, dir);
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function fluidPumpPanelHtml(e) {
  const agg = {};
  for (const k in e.fluid) if (e.fluid[k] > 0) agg[k] = e.fluid[k];
  let h = row('流体', Object.keys(agg).length ? countStr(agg) : '<span class="dim">空</span>', 'contents');
  h += row('缓冲', e.total() + ' / ' + PUMP_BUF_CAP, 'cap');
  if (Object.keys(agg).length) h += '<button data-action="takeout" id="btn-pump-takeout">取出全部 (' + e.total() + ')</button>';
  h += '<div class="sec">电路控制</div>';
  h += '<div class="circ-add">' +
    '<select id="p-en" class="circ-btype">' +
      '<option value="off"' + (!e.circuitCond.enabled ? ' selected' : '') + '>关闭（常开）</option>' +
      '<option value="on"' + (e.circuitCond.enabled ? ' selected' : '') + '>启用条件</option>' +
    '</select>' +
    '<select id="p-ch" class="circ-op">' + channelSelect(e.circuitCond.channel) + '</select>' +
    '<input type="text" id="p-sig" class="circ-siginv" value="' + (typeof signalDisplayName === 'function' ? signalDisplayName(e.circuitCond.sig) : (ITEMS[e.circuitCond.sig]?.name || e.circuitCond.sig)) + '" placeholder="信号" autocomplete="off">' +
    '<select id="p-op" class="circ-op">' + ['>', '<', '=', '!=', '>=', '<='].map(o => '<option value="' + o + '"' + (e.circuitCond.op === o ? ' selected' : '') + '>' + o + '</option>').join('') + '</select>' +
    '<input type="number" id="p-cnt" class="circ-cnt" value="' + e.circuitCond.count + '" min="-99999" max="99999">' +
    '<button data-action="p-cond">应用</button></div>';
  h += '<div class="dim">启用后，仅当所选电路信号满足条件时泵才工作（如储液罐满时停泵）。</div>';
  h += '<div class="dim">流体泵：背侧吸入流体，向前侧加压泵出，单向输送、吞吐更高，可为长管道提速。R 旋转方向。</div>';
  return h;
}
function fluidPumpPanelLive(e, api) {
  const agg = {};
  for (const k in e.fluid) if (e.fluid[k] > 0) agg[k] = e.fluid[k];
  api.set('contents', Object.keys(agg).length ? countStr(agg) : dimSpan('空'));
  api.set('cap', e.total() + ' / ' + PUMP_BUF_CAP);
  api.toggle('#btn-pump-takeout', e.total() > 0, '取出全部 (' + e.total() + ')');
  const back = entAt(e.x - DX[e.dir], e.y - DY[e.dir]);
  const front = entAt(e.x + DX[e.dir], e.y + DY[e.dir]);
  if (!e.circuitEnabled()) { api.status('已停止：电路条件不满足', 'warn'); return; }
  if (e.total() > 0 && front) api.status('泵送中：背侧→前侧', 'ok');
  else if (back instanceof Pipe && back.total() > 0) api.status('待泵：背侧有流体可吸入', 'ok');
  else api.status('待机：背侧无流体', 'ok');
}
function fluidPumpPanelAction(action, el) {
  const e = G.panelEnt;
  if (action === 'p-cond') {
    e.circuitCond.enabled = document.getElementById('p-en').value === 'on';
    e.circuitCond.channel = document.getElementById('p-ch').value;
    e.circuitCond.sig = resolveSignalName(document.getElementById('p-sig').value) || e.circuitCond.sig;
    e.circuitCond.op = document.getElementById('p-op').value;
    e.circuitCond.count = Math.floor(Number(document.getElementById('p-cnt').value)) || 0;
    uiDirty = true;
    return true;
  }
  return false;
}
function fluidPumpTip(e) {
  const agg = {};
  for (const k in e.fluid) if (e.fluid[k] > 0) agg[k] = e.fluid[k];
  return Object.keys(agg).length
    ? ('泵送 ' + Object.keys(agg).map(k => ITEMS[k].name + '×' + agg[k]).join('、'))
    : '背侧吸入·前侧泵出（R 旋转）';
}

// ===== 注册 =====
ENT_CLASSES['pump'] = FluidPump;
DEVICE_RENDER['pump'] = drawFluidPump;
DEVICE_STATUS['pump'] = e => e.total() > 0 ? 'g' : (e.circuitEnabled ? (e.circuitEnabled() ? 'y' : 'r') : 'r');
DEVICE_PANEL['pump'] = { html: fluidPumpPanelHtml, live: fluidPumpPanelLive, tip: fluidPumpTip, onAction: fluidPumpPanelAction };
DEVICE_DIR_ROTATE['pump'] = true;
