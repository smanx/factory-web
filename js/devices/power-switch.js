'use strict';

// ===== 功率开关 Power Switch（对齐《异星工厂》Power switch，1×1）=====
// 电路网络设备：作为电路节点接入网络，读取网络信号，按面板设定的"断电条件"
// 判断是否切断电网供电。当条件满足且启用时，强制整个电网进入断电状态
// （sat=0，所有用电设备停摆），用于甩负荷保护、按信号自动断电等自动化调度。
// 不满足条件时电网正常供电。默认关闭（不影响电网）。
class PowerSwitch extends CircuitNode {
  constructor(type, x, y) {
    super(type || 'power-switch', x, y);
    this.cond = { channel: 'red', sig: 'iron-plate', op: '>', count: 0, enabled: false };
  }
  // 读取本节点所属网络聚合信号
  signal() {
    return { red: this.netRed || {}, green: this.netGreen || {} };
  }
  // 当前是否触发"断开电网"（条件满足且启用）
  isTripped() {
    if (!this.cond || !this.cond.enabled) return false;
    const c = this.cond;
    const net = this.signal()[c.channel === 'green' ? 'green' : 'red'];
    const val = net ? (net[c.sig] || 0) : 0;
    const b = c.count || 0;
    switch (c.op) {
      case '>': return val > b;
      case '<': return val < b;
      case '=': return val === b;
      case '>=': return val >= b;
      case '<=': return val <= b;
      case '!=': return val !== b;
      default: return false;
    }
  }
  contents() { return [[this.type, 1]]; }
  serialize() {
    const s = super.serialize();
    s.cond = this.cond;
    return s;
  }
  static restore(s) {
    const e = super.restore(s);
    e.cond = s.cond || { channel: 'red', sig: 'iron-plate', op: '>', count: 0, enabled: false };
    return e;
  }
}

// 全网是否存在任一功率开关处于"断开"状态（供 updatePower 强制断电）
function anyPowerSwitchTripped() {
  if (!G.ents) return false;
  for (const e of G.ents) {
    if (e._dead || !(e instanceof PowerSwitch)) continue;
    if (e.isTripped()) return true;
  }
  return false;
}

// ===== 渲染：开关（触发断电时亮红灯 + 断开把手）=====
function drawPowerSwitch(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  const trip = e.isTripped();
  ctx.globalAlpha = alpha;
  // 机箱底座
  ctx.fillStyle = trip ? '#8a4a3a' : '#4a5a6a';
  rr(ctx, px + 3, py + 3, TILE - 6, TILE - 6, 4); ctx.fill();
  ctx.strokeStyle = '#2a3442';
  ctx.lineWidth = 2;
  rr(ctx, px + 3, py + 3, TILE - 6, TILE - 6, 4); ctx.stroke();
  // 接线端子（两侧）
  ctx.fillStyle = '#e0c040';
  ctx.fillRect(px + 5, py + TILE / 2 - 2, 3, 4);
  ctx.fillRect(px + TILE - 8, py + TILE / 2 - 2, 3, 4);
  // 状态灯（绿=供电正常 / 红=已断开）
  ctx.fillStyle = trip ? '#ff5b5b' : '#5ae06a';
  ctx.beginPath(); ctx.arc(cx, py + 7, 2.4, 0, 7); ctx.fill();
  // 断路器把手：扳下=断开，扳上=闭合
  const handX = cx, handY = trip ? py + TILE / 2 + 6 : py + TILE / 2 - 8;
  ctx.strokeStyle = '#e8e8ee';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(cx, py + TILE / 2);
  ctx.lineTo(handX, handY);
  ctx.stroke();
  ctx.fillStyle = '#e8e8ee';
  ctx.beginPath(); ctx.arc(handX, handY, 2.6, 0, 7); ctx.fill();
  // 中央标志
  ctx.fillStyle = trip ? '#ff5b5b' : '#5ae06a';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(trip ? 'OFF' : 'ON', cx, py + 15);
  ctx.globalAlpha = 1;
  drawCircuitWires(ctx, e);
}

// ===== 面板 =====
function powerSwitchPanelHtml(e) {
  const c = e.cond;
  let h = row('断电条件', '<span class="dim"></span>', 'cond') +
    '<button data-action="toggle">' + (c.enabled ? '🔴 已启用（满足即断电）' : '⚪ 未启用') + '</button>' +
    '<div class="sec">监控通道</div><div class="recgrid">' +
    '<button class="rcbtn ' + (c.channel === 'red' ? 'sel' : '') + '" data-action="chan" data-id="red">红线</button>' +
    '<button class="rcbtn ' + (c.channel === 'green' ? 'sel' : '') + '" data-action="chan" data-id="green">绿线</button>' +
    '</div>' +
    '<div class="sec">选择信号</div><div class="recgrid">';
  const choices = FILTER_CHOICES.slice(0, 20).concat(['coal', 'crude-oil']);
  for (const id of choices) {
    h += '<button class="rcbtn ' + (c.sig === id ? 'sel' : '') + '" data-action="sig" data-id="' + id + '" data-itemid="' + id + '">' +
      '<img src="' + iconDataURL(id) + '">' + ITEMS[id].name + '</button>';
  }
  h += '</div>';
  h += '<div class="sec">比较</div><div class="recgrid">';
  for (const op of ['>', '<', '=', '>=', '<=', '!=']) {
    h += '<button class="rcbtn ' + (c.op === op ? 'sel' : '') + '" data-action="op" data-id="' + op + '">' + op + '</button>';
  }
  h += '</div>';
  h += row('阈值', '<input type="number" data-input="cnt" min="0" value="' + (c.count || 0) + '">', 'cnt') +
    '<div class="dim">功率开关：接入电路网络，读取信号并按条件判断。条件满足时强制全图断电（甩负荷保护），不满足时正常供电。可用于按燃料/电量等信号自动调度电力（1×1，需电路网络科技）。</div>';
  return h;
}
function powerSwitchOnAction(act, btn) {
  const e = G.panelEnt;
  if (!(e instanceof PowerSwitch)) return false;
  if (act === 'toggle') { e.cond.enabled = !e.cond.enabled; if (typeof playSfx === 'function') playSfx('power-switch'); return true; }
  if (act === 'chan') { e.cond.channel = btn.dataset.id; return true; }
  if (act === 'sig') { e.cond.sig = btn.dataset.id; return true; }
  if (act === 'op') { e.cond.op = btn.dataset.id; return true; }
  return false;
}
function powerSwitchOnChange(ev) {
  const e = G.panelEnt;
  if (!(e instanceof PowerSwitch)) return false;
  const inp = ev.target.closest ? ev.target.closest('[data-input]') : null;
  if (!inp) return false;
  e.cond.count = Math.max(0, parseInt(inp.value, 10) || 0);
  return true;
}
function powerSwitchPanelLive(e, api) {
  const c = e.cond;
  const net = e.signal()[c.channel === 'green' ? 'green' : 'red'];
  const cur = net ? (net[c.sig] || 0) : 0;
  api.set('cond', '信号「' + ITEMS[c.sig].name + '」' + c.op + ' ' + c.count + '，当前 ' + cur);
  if (!c.enabled) { api.status('未启用：不影响电网供电', 'ok'); return; }
  api.status(e.isTripped() ? '⚡ 已断开电网供电' : '电网供电正常', e.isTripped() ? 'r' : 'ok');
}
function powerSwitchTip(e) {
  if (!e.cond || !e.cond.enabled) return '功率开关：未启用（电网供电正常）';
  return e.isTripped() ? '功率开关：⚡ 已断开电网供电' : '功率开关：电网供电正常';
}

// ===== 注册 =====
const powerSwitchPanel = { html: powerSwitchPanelHtml, onAction: powerSwitchOnAction, onChange: powerSwitchOnChange, live: powerSwitchPanelLive, tip: powerSwitchTip };
ENT_CLASSES['power-switch'] = PowerSwitch;
DEVICE_RENDER['power-switch'] = drawPowerSwitch;
DEVICE_DIR_ROTATE['power-switch'] = true; // 支持旋转
DEVICE_STATUS['power-switch'] = e => e.isTripped() ? 'r' : 'g';
DEVICE_PANEL['power-switch'] = powerSwitchPanel;
