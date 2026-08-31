'use strict';

// ===== 电灯 Lamp（对齐《异星工厂》Lamp，1×1）=====
// 耗电照明设备：夜间通电时点亮，在昼夜黑暗遮罩上凿出光圈照亮周围，
// 让基地在黑暗中清晰可见；白天不耗电不点亮。断电时熄灭。
// 支持电路网络控制：可设置"启用条件"，仅当电路信号满足条件时才点亮（对齐《异星工厂》灯接入电路网络）。
const LAMP_POWER = 5;        // 电灯夜间功耗 5kW（对齐《异星工厂》约 5kW）
const LAMP_RADIUS = 5;       // 照亮半径（格）
class Lamp extends Entity {
  constructor(type, x, y) { super('small-lamp', x, y); }
  // 电路条件是否满足（未启用条件则恒满足）
  circuitOk() {
    if (!this.circuitCond || !this.circuitCond.enabled) return true;
    const sig = (typeof circuitSignalNear === 'function') ? circuitSignalNear(this) : null;
    return (typeof circuitCondOk === 'function') ? circuitCondOk(sig, this.circuitCond) : true;
  }
  // 是否应点亮：夜间且电网供电充足，且（未设置电路条件 || 电路条件满足）
  shouldLight() {
    return nightPhase() && G.power && powerSatOf(this) > 0 && this.circuitOk();
  }
  powerDemand() { return this.shouldLight() ? LAMP_POWER : 0; }
  serialize() {
    const s = super.serialize();
    if (this.circuitCond) s.circuitCond = this.circuitCond;
    return s;
  }
  blueprint() {
    const s = super.blueprint();
    if (this.circuitCond) s.circuitCond = this.circuitCond;
    return s;
  }
  static restore(s) {
    const e = super.restore(s);
    e.circuitCond = s.circuitCond || { enabled: false, channel: 'red', sig: 'iron-plate', op: '>', count: 1 };
    return e;
  }
}

// 昼夜相位：返回当前是否处于"需要点灯"的暗时（黄昏/黎明过渡 + 深夜）
function nightPhase() {
  if (typeof solarFactor !== 'function') return false;
  const ph = ((G.time / DAY_CYCLE) % 1 + 1) % 1;
  if (ph < 0.25 || ph >= 0.75) return true;      // 深夜
  if (ph < 0.32) return (0.32 - ph) / 0.07 > 0.3; // 黄昏渐暗
  if (ph >= 0.68) return (ph - 0.68) / 0.07 > 0.3; // 黎明渐亮
  return false;
}

// ===== 渲染：灯座（夜间通电时叠加发光光晕）=====
function drawLamp(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  const lit = e.shouldLight();
  ctx.globalAlpha = alpha;
  // 灯杆
  ctx.strokeStyle = '#3a3a42';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx, cy + 12); ctx.lineTo(cx, cy - 6); ctx.stroke();
  // 灯头
  ctx.fillStyle = lit ? '#fff6b0' : '#6a6a72';
  rr(ctx, cx - 7, cy - 10, 14, 8, 2); ctx.fill();
  ctx.strokeStyle = '#4a4a52';
  ctx.lineWidth = 2;
  rr(ctx, cx - 7, cy - 10, 14, 8, 2); ctx.stroke();
  if (lit) {
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(cx, cy - 6, 2.5, 0, 7); ctx.fill();
  }
  // 底座
  ctx.fillStyle = '#3a3a42';
  rr(ctx, cx - 4, cy + 11, 8, 3, 1); ctx.fill();
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function lampPanelHtml(e) {
  return row('状态', '<span class="dim"></span>', 'st') +
    (typeof circuitPanelHtml === 'function' ? circuitPanelHtml(e || { circuitCond: null }, 'small-lamp') : '') +
    '<div class="dim">电灯：夜间通电时点亮，照亮周围 ' + LAMP_RADIUS + ' 格，让基地在黑暗中清晰可见。白天不耗电。断电或供电不足时熄灭。可在电路控制中设置启用条件，仅当电路信号满足时才点亮（1×1，需电力工程科技）。</div>';
}
function lampPanelLive(e, api) {
  if (!e.circuitOk()) { api.set('st', '电路关断'); api.status('已熄灭：电路条件不满足', 'warn'); return; }
  if (nightPhase()) {
    if (G.power && powerSatOf(e) > 0) { api.set('st', '点亮（夜间）'); api.status('点亮：夜间供电正常', 'ok'); }
    else { api.set('st', '断电熄灭'); api.status('已熄灭：电网断电，等待供电', 'warn'); }
  } else {
    api.set('st', '待机（白天）');
    api.status('待机：白天无需照明', 'ok');
  }
}
function lampTip(e) {
  if (e.circuitCond && e.circuitCond.enabled && !e.circuitOk()) return '电灯：电路关断';
  if (!nightPhase()) return '电灯：待机（白天）';
  return e.shouldLight() ? '电灯：点亮' : '电灯：断电熄灭';
}

// ===== 注册 =====
const lampPanel = { html: lampPanelHtml, live: lampPanelLive, tip: lampTip, onAction: (a) => (typeof circuitPanelAction === 'function' ? circuitPanelAction('small-lamp', a) : false) };
ENT_CLASSES['small-lamp'] = Lamp;
DEVICE_RENDER['small-lamp'] = drawLamp;
DEVICE_DIR_ROTATE['small-lamp'] = true; // 支持旋转
DEVICE_STATUS['small-lamp'] = e => e.circuitOk() ? (e.shouldLight() ? 'g' : (nightPhase() ? 'y' : 'r')) : 'r';
DEVICE_PANEL['small-lamp'] = lampPanel;
