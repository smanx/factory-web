'use strict';

// ===== 可编程音箱 Programmable Speaker（对齐《异星工厂》Programmable speaker，1×1）=====
// 电路网络设备：作为电路节点接入网络，读取网络信号，按面板设定的条件
// 判断是否"触发"。条件满足时点亮警报灯并叠加高亮光晕，用于信号监控/告警。
// 可指定监控通道（红/绿线）、信号与阈值、比较运算符。
class ProgrammableSpeaker extends CircuitNode {
  constructor(type, x, y) {
    super(type || 'programmable-speaker', x, y);
    this.cond = { channel: 'red', sig: 'iron-plate', op: '>', count: 0, enabled: false };
  }
  // 读取本节点所属网络聚合信号（作为网络节点自带 netRed/netGreen）
  signal() {
    return { red: this.netRed || {}, green: this.netGreen || {} };
  }
  // 当前是否触发（条件满足且启用）
  isActive() {
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

// ===== 渲染：音箱（触发时点亮红色警报灯 + 光晕）=====
function drawSpeaker(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  const on = e.isActive();
  ctx.globalAlpha = alpha;
  // 机箱
  ctx.fillStyle = on ? '#7a4a8a' : '#5a3a6a';
  rr(ctx, px + 3, py + 3, TILE - 6, TILE - 6, 5); ctx.fill();
  ctx.strokeStyle = '#3a224a';
  ctx.lineWidth = 2;
  rr(ctx, px + 3, py + 3, TILE - 6, TILE - 6, 5); ctx.stroke();
  // 喇叭孔
  ctx.fillStyle = '#3a224a';
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.arc(px + TILE / 2 - 6 + i * 6, py + TILE / 2, 2, 0, 7);
    ctx.fill();
  }
  // 状态灯（红/绿通道指示灯 + 触发警报灯）
  ctx.fillStyle = '#e05a4a'; ctx.beginPath(); ctx.arc(cx - 7, py + 8, 2.2, 0, 7); ctx.fill();
  ctx.fillStyle = '#5ae06a'; ctx.beginPath(); ctx.arc(cx + 7, py + 8, 2.2, 0, 7); ctx.fill();
  if (on) {
    ctx.fillStyle = '#ff5b5b';
    ctx.beginPath(); ctx.arc(cx, cy - 4, 3.5, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
  drawCircuitWires(ctx, e);
}

// ===== 面板 =====
function speakerPanelHtml(e) {
  const c = e.cond;
  let h = row('触发条件', '<span class="dim"></span>', 'cond') +
    '<button data-action="toggle">' + (c.enabled ? '🔴 启用告警' : '⚪ 停用告警') + '</button>' +
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
    '<div class="dim">可编程音箱：接入电路网络，读取信号并按条件判断。满足条件时点亮警报灯，用于信号监控与告警（1×1，需电路网络科技）。</div>';
  return h;
}
function speakerOnAction(act, btn) {
  const e = G.panelEnt;
  if (!(e instanceof ProgrammableSpeaker)) return false;
  if (act === 'toggle') { e.cond.enabled = !e.cond.enabled; return true; }
  if (act === 'chan') { e.cond.channel = btn.dataset.id; return true; }
  if (act === 'sig') { e.cond.sig = btn.dataset.id; return true; }
  if (act === 'op') { e.cond.op = btn.dataset.id; return true; }
  return false;
}
function speakerOnChange(ev) {
  const e = G.panelEnt;
  if (!(e instanceof ProgrammableSpeaker)) return false;
  const inp = ev.target.closest ? ev.target.closest('[data-input]') : null;
  if (!inp) return false;
  e.cond.count = Math.max(0, parseInt(inp.value, 10) || 0);
  return true;
}
function speakerPanelLive(e, api) {
  const c = e.cond;
  const net = e.signal()[c.channel === 'green' ? 'green' : 'red'];
  const cur = net ? (net[c.sig] || 0) : 0;
  api.set('cond', '信号「' + ITEMS[c.sig].name + '」' + c.op + ' ' + c.count + '，当前 ' + cur);
  if (!c.enabled) { api.status('告警已停用', 'warn'); return; }
  api.status(e.isActive() ? '🔔 已触发：条件满足' : '待命：条件未满足', e.isActive() ? 'y' : 'ok');
}
function speakerTip(e) {
  return e.isActive() ? '可编程音箱：🔔 已触发' : '可编程音箱：待命';
}

// ===== 注册 =====
const speakerPanel = { html: speakerPanelHtml, onAction: speakerOnAction, onChange: speakerOnChange, live: speakerPanelLive, tip: speakerTip };
ENT_CLASSES['programmable-speaker'] = ProgrammableSpeaker;
DEVICE_RENDER['programmable-speaker'] = drawSpeaker;
DEVICE_DIR_ROTATE['programmable-speaker'] = true; // 支持旋转
DEVICE_STATUS['programmable-speaker'] = e => e.isActive() ? 'y' : 'g';
DEVICE_PANEL['programmable-speaker'] = speakerPanel;
