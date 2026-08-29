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
// 1×1 流体泵：青绿方底 + 中央电机圆盘 + 旋转叶轮 + 背/前两侧连接管 + 流向箭头
// 视觉分区：
//   ① 阴影  ② 青绿方底（深色描边）  ③ 背/前两侧连接管段（黄铜，方向 = dir）
//   ④ 中央电机外壳（径向渐变 + 顶面高光）  ⑤ 旋转叶轮（3 叶片）
//   ⑥ 流体圆点（按缓冲比例）  ⑦ 流向箭头（沿用旧 notch）
function drawFluidPump(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';
  const dx = DX[dir], dy = DY[dir];

  // ① 罐底阴影
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath();
  ctx.ellipse(cx, py + TILE - 2, TILE * 0.40, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // ② 青绿方底（外壳）
  const bodyGrad = ctx.createLinearGradient(0, py + 3, 0, py + TILE - 3);
  bodyGrad.addColorStop(0,   '#5a8a92');
  bodyGrad.addColorStop(0.5, '#3d6a72');
  bodyGrad.addColorStop(1,   '#1f4250');
  ctx.fillStyle = bodyGrad;
  rr(ctx, px + 3, py + 3, TILE - 6, TILE - 6, 6); ctx.fill();
  ctx.strokeStyle = '#0e2630';
  ctx.lineWidth = 1.2;
  rr(ctx, px + 3, py + 3, TILE - 6, TILE - 6, 6); ctx.stroke();
  // 顶面高光
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  ctx.fillRect(px + 5, py + 5, TILE - 10, 0.8);

  // ③ 背/前两侧连接管段（黄铜 — 与普通管道同色，与泵体青绿形成对比）
  //    方向 = (dx, dy) — 前侧（出口）
  for (const sign of [1, -1]) {
    const sx = sign * dx, sy = sign * dy;
    if (sx === 0 && sy === 0) continue;
    // 外层管壁
    ctx.strokeStyle = '#4a4234';
    ctx.lineWidth = 8;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + sx * (TILE / 2 - 1), cy + sy * (TILE / 2 - 1));
    ctx.stroke();
    // 内层黄铜
    ctx.strokeStyle = '#8d8272';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + sx * (TILE / 2 - 1), cy + sy * (TILE / 2 - 1));
    ctx.stroke();
    // 管段高光
    ctx.strokeStyle = 'rgba(255, 235, 200, 0.30)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const ox = sx === 0 ? 0 : (sx > 0 ? 0.5 : -0.5);
    const oy = sy === 0 ? 0 : (sy > 0 ? 0.5 : -0.5);
    ctx.moveTo(cx + ox, cy + oy);
    ctx.lineTo(cx + sx * (TILE / 2 - 1) + ox, cy + sy * (TILE / 2 - 1) + oy);
    ctx.stroke();
  }

  // ④ 中央电机外壳（径向渐变金属圆盘 + 顶面高光）
  const motorGrad = ctx.createRadialGradient(cx - 1.5, cy - 1.5, 1, cx, cy, 9);
  motorGrad.addColorStop(0,   '#9ce0e8');
  motorGrad.addColorStop(0.5, '#5aa0a8');
  motorGrad.addColorStop(1,   '#1f4250');
  ctx.fillStyle = motorGrad;
  ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.fill();
  // 外圈描边
  ctx.strokeStyle = '#0e2630';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(cx, cy, 9, 0, Math.PI * 2); ctx.stroke();
  // 顶面高光
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath();
  ctx.arc(cx - 2.5, cy - 2.5, 2.5, 0, Math.PI * 2);
  ctx.fill();

  // ⑤ 旋转叶轮（3 叶片，绕中心旋转 — 速度叠加 dir 偏移让方向感更明确）
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(dir * Math.PI / 2 + (G.time || 0) * 3);
  // 叶片
  ctx.fillStyle = '#d8f0f4';
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.rotate(i * Math.PI * 2 / 3);
    ctx.beginPath();
    ctx.moveTo(0, -1.5);
    ctx.lineTo(7, -3);
    ctx.lineTo(7, 3);
    ctx.lineTo(0, 1.5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // 中心轴
  ctx.fillStyle = '#5a8a92';
  ctx.beginPath(); ctx.arc(0, 0, 1.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#0e2630';
  ctx.beginPath(); ctx.arc(0, 0, 0.9, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // ⑥ 流体圆点（按缓冲比例 + 工作中脉动）
  const total = e.total ? e.total() : 0;
  if (total > 0) {
    const first = Object.keys(e.fluid).find(k => e.fluid[k] > 0);
    if (first && ITEMS[first]) {
      const baseR = Math.max(2, 4.5 * Math.min(1, total / PUMP_BUF_CAP));
      const fl = (G.time || 0) * 3;
      const r = e.total && e.total() > 0 && e.circuitEnabled && e.circuitEnabled() ? baseR + Math.sin(fl) * 0.4 : baseR;
      // 深色边
      ctx.fillStyle = _pumpDarken(ITEMS[first].color, 0.35);
      ctx.beginPath();
      ctx.arc(cx, cy, r + 0.6, 0, Math.PI * 2);
      ctx.fill();
      // 本色
      ctx.fillStyle = ITEMS[first].color;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      // 高光
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath();
      ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ⑦ 流向箭头（沿用旧 notch，dir=0 在前侧标识流向；R 旋转时跟着转）
  ctx.fillStyle = dirColorNotch(dir);
  notch(ctx, px, py, dir);

  ctx.globalAlpha = 1;
}
function _pumpDarken(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.floor(((n >> 16) & 255) * (1 - t)));
  const g = Math.max(0, Math.floor(((n >> 8) & 255) * (1 - t)));
  const b = Math.max(0, Math.floor((n & 255) * (1 - t)));
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

// ===== 面板 =====
function fluidPumpPanelHtml(e) {
  const agg = {};
  for (const k in e.fluid) if (e.fluid[k] > 0) agg[k] = e.fluid[k];
  let h = row('流体', Object.keys(agg).length ? '<div class="asm3-inp-row">' + itemSlotsHtml(agg, { action: 'display' }) + '</div>' : '<span class="dim">空</span>', 'contents');
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
  api.set('contents', Object.keys(agg).length ? '<div class="asm3-inp-row">' + itemSlotsHtml(agg, { action: 'display' }) + '</div>' : dimSpan('空'));
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
