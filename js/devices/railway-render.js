'use strict';

// ===== 铁轨渲染 =====
DEVICE_RENDER['rail'] = function (ctx, e, gx, gy, dir, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#4a4a52';
  ctx.fillRect(gx, gy, TILE, TILE);
  const c = railConnAt(e.x, e.y);
  ctx.strokeStyle = '#8a8a92';
  ctx.lineWidth = TILE * 0.22;
  ctx.lineCap = 'round';
  ctx.beginPath();
  // 水平方向连接
  if (c.E || c.W) {
    const x1 = c.E ? gx + TILE : gx + TILE / 2;
    const x2 = c.W ? gx : gx + TILE / 2;
    ctx.moveTo(x2, gy + TILE / 2); ctx.lineTo(x1, gy + TILE / 2);
  }
  // 垂直方向连接
  if (c.N || c.S) {
    const y1 = c.S ? gy + TILE : gy + TILE / 2;
    const y2 = c.N ? gy : gy + TILE / 2;
    ctx.moveTo(gx + TILE / 2, y2); ctx.lineTo(gx + TILE / 2, y1);
  }
  ctx.stroke();
  // 枕木
  ctx.fillStyle = '#5a5a64';
  if (c.E || c.W) { ctx.fillRect(gx + TILE * 0.42, gy + TILE * 0.18, TILE * 0.16, TILE * 0.64); }
  if (c.N || c.S) { ctx.fillRect(gx + TILE * 0.18, gy + TILE * 0.42, TILE * 0.64, TILE * 0.16); }
  ctx.restore();
};

// ===== 车头渲染 =====
DEVICE_RENDER['locomotive'] = function (ctx, e, gx, gy, dir, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(gx + TILE / 2, gy + TILE / 2);
  ctx.rotate(dir * Math.PI / 2);
  ctx.fillStyle = '#d04a3a';
  rrPath(ctx, -TILE * 0.42, -TILE * 0.32, TILE * 0.84, TILE * 0.64, TILE * 0.12);
  ctx.fill();
  ctx.strokeStyle = '#7a2018'; ctx.lineWidth = 2; ctx.stroke();
  // 车灯朝前
  ctx.fillStyle = '#ffe08a';
  ctx.fillRect(TILE * 0.2, -TILE * 0.06, TILE * 0.1, TILE * 0.12);
  // 燃料状态灯
  ctx.fillStyle = (e.fuel || 0) > 0 ? '#6fd06f' : '#b04040';
  ctx.fillRect(-TILE * 0.2, -TILE * 0.38, TILE * 0.12, TILE * 0.12);
  ctx.restore();
};

// ===== 内燃机车渲染（蓝灰进阶车头，带速度标识） =====
DEVICE_RENDER['diesel-locomotive'] = function (ctx, e, gx, gy, dir, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(gx + TILE / 2, gy + TILE / 2);
  ctx.rotate(dir * Math.PI / 2);
  // 车体（蓝灰）
  ctx.fillStyle = '#3f6fa8';
  rrPath(ctx, -TILE * 0.42, -TILE * 0.32, TILE * 0.84, TILE * 0.64, TILE * 0.12);
  ctx.fill();
  ctx.strokeStyle = '#1f3f68'; ctx.lineWidth = 2; ctx.stroke();
  // 车头驾驶舱窗（体现内燃机车更流线）
  ctx.fillStyle = '#9fc8ef';
  rrPath(ctx, TILE * 0.02, -TILE * 0.18, TILE * 0.22, TILE * 0.36, TILE * 0.06);
  ctx.fill();
  // 车灯朝前
  ctx.fillStyle = '#ffe08a';
  ctx.fillRect(TILE * 0.2, -TILE * 0.06, TILE * 0.1, TILE * 0.12);
  // 速度标识（两道速度线，标志更快）
  ctx.strokeStyle = '#c8e0ff'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-TILE * 0.3, -TILE * 0.1); ctx.lineTo(-TILE * 0.3, -TILE * 0.24); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-TILE * 0.18, -TILE * 0.1); ctx.lineTo(-TILE * 0.18, -TILE * 0.24); ctx.stroke();
  ctx.lineCap = 'butt';
  // 燃料状态灯
  ctx.fillStyle = (e.fuel || 0) > 0 ? '#6fd06f' : '#b04040';
  ctx.fillRect(-TILE * 0.34, -TILE * 0.38, TILE * 0.12, TILE * 0.12);
  ctx.restore();
};

// ===== 车厢渲染 =====
DEVICE_RENDER['cargo-wagon'] = function (ctx, e, gx, gy, dir, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(gx + TILE / 2, gy + TILE / 2);
  ctx.rotate(dir * Math.PI / 2);
  ctx.fillStyle = '#8a6a4a';
  rrPath(ctx, -TILE * 0.42, -TILE * 0.3, TILE * 0.84, TILE * 0.6, TILE * 0.08);
  ctx.fill();
  ctx.strokeStyle = '#4a3222'; ctx.lineWidth = 2; ctx.stroke();
  // 货物指示灯
  ctx.fillStyle = (e.slots && e.slots.length) ? '#e0b23c' : '#555';
  ctx.fillRect(-TILE * 0.2, -TILE * 0.38, TILE * 0.12, TILE * 0.12);
  ctx.restore();
};

// ===== 车站渲染 =====
DEVICE_RENDER['fluid-wagon'] = function (ctx, e, gx, gy, dir, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(gx + TILE / 2, gy + TILE / 2);
  ctx.rotate(dir * Math.PI / 2);
  // 罐体
  ctx.fillStyle = '#3a6a8a';
  rrPath(ctx, -TILE * 0.4, -TILE * 0.3, TILE * 0.8, TILE * 0.6, TILE * 0.22);
  ctx.fill();
  ctx.strokeStyle = '#1a3a52'; ctx.lineWidth = 2; ctx.stroke();
  // 装载液位
  const fc = (typeof e.fluidContents === 'function') ? e.fluidContents() : null;
  if (fc && fc.count > 0) {
    const fcol = ITEMS[fc.item] ? ITEMS[fc.item].color : '#4a90c0';
    ctx.fillStyle = fcol;
    const lvl = Math.max(0.1, fc.count / FLUID_WAGON_CAP);
    rrPath(ctx, -TILE * 0.32, TILE * 0.3 - TILE * 0.6 * lvl, TILE * 0.64, TILE * 0.6 * lvl, TILE * 0.12);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold ' + Math.round(TILE * 0.32) + 'px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(fc.item === 'water' ? 'H2O' : fc.item === 'crude-oil' ? 'OIL' : fc.item === 'steam' ? 'ST' : fc.item, 0, 0);
  }
  // 液位状态灯
  ctx.fillStyle = fc && fc.count > 0 ? '#7fd0ff' : '#555';
  ctx.fillRect(-TILE * 0.2, -TILE * 0.38, TILE * 0.12, TILE * 0.12);
  ctx.restore();
};

// ===== 炮兵车厢渲染 =====
DEVICE_RENDER['artillery-wagon'] = function (ctx, e, gx, gy, dir, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(gx + TILE / 2, gy + TILE / 2);
  ctx.rotate(dir * Math.PI / 2);
  // 车体
  ctx.fillStyle = '#5a4a42';
  rrPath(ctx, -TILE * 0.44, -TILE * 0.3, TILE * 0.88, TILE * 0.6, TILE * 0.08);
  ctx.fill();
  ctx.strokeStyle = '#3a2f2a'; ctx.lineWidth = 2; ctx.stroke();
  // 转盘炮座
  ctx.fillStyle = '#4a3d35';
  ctx.beginPath(); ctx.arc(0, 0, TILE * 0.22, 0, 7); ctx.fill();
  ctx.strokeStyle = '#2e2620'; ctx.lineWidth = 1.5; ctx.stroke();
  // 炮管（朝向目标或车厢朝向）
  const ang = e.facing !== undefined ? e.facing : (dir * Math.PI) / 2;
  ctx.strokeStyle = '#2e2620';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(Math.cos(ang) * 6, Math.sin(ang) * 6);
  ctx.lineTo(Math.cos(ang) * TILE * 0.5, Math.sin(ang) * TILE * 0.5);
  ctx.stroke();
  ctx.lineCap = 'butt';
  // 炮弹余量指示灯
  ctx.fillStyle = e.shells > 0 ? '#ff5a3a' : '#555';
  ctx.fillRect(-TILE * 0.2, -TILE * 0.38, TILE * 0.12, TILE * 0.12);
  ctx.restore();
};

DEVICE_RENDER['train-stop'] = function (ctx, e, gx, gy, dir, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#3a4a6a';
  rrPath(ctx, gx + 4, gy + 4, TILE - 8, TILE - 8, 6); ctx.fill();
  ctx.strokeStyle = '#5a8ac0'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#9ac0e8';
  ctx.font = 'bold ' + Math.round(TILE * 0.4) + 'px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('S', gx + TILE / 2, gy + TILE / 2);
  // 若该车站被列车自动调度路线引用：叠加呼吸的蓝色调度光环，直观标记调度网络节点
  if (stationInSchedule(e)) {
    const t = (performance.now() || Date.now()) / 1000;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
    ctx.globalAlpha = alpha * (0.35 + 0.35 * pulse);
    ctx.strokeStyle = '#4ab8ff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(gx + TILE / 2, gy + TILE / 2, TILE * (0.62 + 0.06 * pulse), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
};

// ===== 信号灯渲染 =====
DEVICE_RENDER['rail-signal'] = function (ctx, e, gx, gy, dir, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#3a3a44';
  ctx.fillRect(gx + TILE * 0.3, gy + TILE * 0.3, TILE * 0.4, TILE * 0.4);
  // 电路闭合（条件不满足）时强制红灯；否则按前方占用状态显示
  const closed = e.circuitCond && e.circuitCond.enabled && !e.circuitEnabled();
  const blocked = closed || railSignalBlocked({ x: e.x, y: e.y, type: 'rail-signal' });
  ctx.fillStyle = blocked ? '#e04a4a' : '#4ae04a';
  ctx.beginPath(); ctx.arc(gx + TILE / 2, gy + TILE / 2, TILE * 0.14, 0, 7); ctx.fill();
  ctx.restore();
};

// ===== 链式信号灯渲染（橙黄灯身，双色指示灯）=====
DEVICE_RENDER['rail-chain-signal'] = function (ctx, e, gx, gy, dir, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#3a3a44';
  ctx.fillRect(gx + TILE * 0.3, gy + TILE * 0.3, TILE * 0.4, TILE * 0.4);
  // 电路闭合（条件不满足）时强制红灯；否则按前方占用状态显示
  const closed = e.circuitCond && e.circuitCond.enabled && !e.circuitEnabled();
  const blocked = closed || railSignalBlocked({ x: e.x, y: e.y, type: 'rail-chain-signal' });
  ctx.fillStyle = blocked ? '#e0a04a' : '#4ae04a';
  ctx.beginPath(); ctx.arc(gx + TILE / 2, gy + TILE / 2, TILE * 0.14, 0, 7); ctx.fill();
  // 双灯：上方小圆点表示连锁（黄/绿）
  ctx.fillStyle = blocked ? '#e04a4a' : '#4ae04a';
  ctx.beginPath(); ctx.arc(gx + TILE / 2, gy + TILE * 0.32, TILE * 0.08, 0, 7); ctx.fill();
  ctx.restore();
};

// ===== 信号灯电路控制面板（对齐《异星工厂》：信号灯接入电路网络） =====
function railSignalPanelLive(e, api) {
  if (e.circuitCond && e.circuitCond.enabled && !e.circuitEnabled()) {
    api.status('强制闭合：电路条件不满足（禁止列车通过）', 'warn');
  } else {
    api.status(railSignalBlocked({ x: e.x, y: e.y, type: e.type }) ? '前方区段被占用（红灯）' : '允许通过（绿灯）', 'ok');
  }
}
DEVICE_PANEL['rail-signal'] = {
  html(e) {
    return '<div class="dim">铁路信号灯：防止列车追尾。接入电路网络后，可设置电路条件——条件不满足时强制红灯闭合、禁止列车通过（对齐《异星工厂》信号灯电路控制）。</div>' +
      circuitPanelHtml(e, 'rs');
  },
  live(e) { return railSignalPanelLive(e); },
  onAction(act) { return circuitPanelAction('rs', act); }
};
DEVICE_PANEL['rail-chain-signal'] = {
  html(e) {
    return '<div class="dim">铁路链式信号灯：在复杂交叉口强制更大的跟车距离。接入电路网络后，条件不满足时强制红灯闭合、禁止列车通过。</div>' +
      circuitPanelHtml(e, 'rc');
  },
  live(e) { return railSignalPanelLive(e); },
  onAction(act) { return circuitPanelAction('rc', act); }
};
// 信号灯状态灯：电路闭合（条件不满足）显示红灯，正常信号灯按阻断状态显示
function railSignalStatus(e) {
  if (e.circuitCond && e.circuitCond.enabled && !e.circuitEnabled()) return 'r';
  return railSignalBlocked({ x: e.x, y: e.y, type: e.type }) ? 'r' : 'g';
}
DEVICE_STATUS['rail-signal'] = railSignalStatus;
DEVICE_STATUS['rail-chain-signal'] = railSignalStatus;

// ===== 面板 =====
