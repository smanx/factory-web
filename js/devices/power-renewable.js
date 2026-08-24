'use strict';

// ===== 太阳能板：白天无燃料发电（对齐《异星工厂》Solar panel，占地 2×2）=====
// 加入白天/黑夜时间周期，白天满发、夜晚零发，并入全图电网（作为 powerOut 正项）。
const SOLAR_POWER = 60;             // 满日照功率（对齐《异星工厂》太阳能板 60kW）
const DAY_CYCLE = 60;               // 一昼夜时长（秒）
function solarFactor() {
  // 用 G.time 模拟昼夜：0.25（黎明）→0.5（正午）→0.75（黄昏）→1（深夜）
  const ph = ((G.time / DAY_CYCLE) % 1 + 1) % 1;
  if (ph < 0.25 || ph >= 0.75) return 0;              // 夜晚
  if (ph < 0.5) return (ph - 0.25) / 0.25;            // 黎明→正午 上升
  return (0.75 - ph) / 0.25;                          // 正午→黄昏 下降
}
class SolarPanel extends Entity {
  constructor(type, x, y) { super('solar-panel', x, y); this.powerOut = 0; }
  update(dt) {
    this.powerOut = SOLAR_POWER * solarFactor();
  }
}

// ===== 蓄电器：储存电力，白天充电、夜间放电（对齐《异星工厂》Accumulator，占地 2×2）=====
// 作为电网的“缓冲电池”：白天电网有盈余时充电，夜间/不足时放电补充。
const ACCUM_CAP = 5000;            // 储电上限 5MJ（对齐《异星工厂》蓄电器，单位 kJ）
const ACCUM_CHARGE_RATE = 300;     // 每秒充/放电速率上限（对齐《异星工厂》蓄电器 300kW）
class Accumulator extends Entity {
  constructor(type, x, y) {
    super('accumulator', x, y);
    this.stored = 0;               // 当前储电量
    this.powerOut = 0;             // 电网注入功率（放电时 >0），注册用
  }
  update(dt) {
    // 电网盈余时充电；电网缺口时放电（受速率限制）
    if (G.power.prod > G.power.demand && this.stored < ACCUM_CAP) {
      const gain = Math.min(ACCUM_CHARGE_RATE * dt, G.power.prod - G.power.demand, ACCUM_CAP - this.stored);
      this.stored += gain;
    } else if (G.power.prod < G.power.demand && this.stored > 0) {
      const loss = Math.min(ACCUM_CHARGE_RATE * dt, G.power.demand - G.power.prod, this.stored);
      this.stored -= loss;
    }
    // 蓄电器放电时以 powerOut 形式向电网注入
    this.powerOut = 0;
    if (G.power.prod < G.power.demand && this.stored > 0) {
      this.powerOut = Math.min(ACCUM_CHARGE_RATE, this.stored * 20);
    }
  }
  serialize() { const s = super.serialize(); s.stored = this.stored; return s; }
  static restore(s) { const a = super.restore(s); a.stored = s.stored || 0; return a; }
}

// ===== 渲染 =====
function drawSolarPanel(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w, sh = TILE * e.h;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#2a3a55';
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 7); ctx.fill();
  ctx.strokeStyle = '#18263a';
  ctx.lineWidth = 2;
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 7); ctx.stroke();
  ctx.fillStyle = '#3f6fc0';
  rr(ctx, px + 8, py + 8, s - 16, sh - 16, 4); ctx.fill();
  ctx.strokeStyle = '#2a4a8a';
  ctx.lineWidth = 2;
  rr(ctx, px + 8, py + 8, s - 16, sh - 16, 4); ctx.stroke();
  // 网格
  ctx.strokeStyle = 'rgba(140,180,255,.6)';
  ctx.lineWidth = 1.5;
  for (let i = 1; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(px + 8 + (s - 16) * i / 3, py + 8);
    ctx.lineTo(px + 8 + (s - 16) * i / 3, py + sh - 8);
    ctx.stroke();
    ctx.moveTo(px + 8, py + 8 + (sh - 16) * i / 3);
    ctx.lineTo(px + s - 8, py + 8 + (sh - 16) * i / 3);
    ctx.stroke();
  }
  const f = solarFactor();
  if (f > 0.02) {
    ctx.fillStyle = 'rgba(255,235,120,' + (0.25 + 0.5 * f).toFixed(2) + ')';
    ctx.beginPath();
    ctx.arc(px + s / 2, py + 12, 6, 0, 7);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}
function drawAccumulator(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w, sh = TILE * e.h;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#3a3a2a';
  rr(ctx, px + 4, py + 4, s - 8, sh - 8, 8); ctx.fill();
  ctx.strokeStyle = '#2a2a1a';
  ctx.lineWidth = 2;
  rr(ctx, px + 4, py + 4, s - 8, sh - 8, 8); ctx.stroke();
  // 电量柱
  const pct = Math.max(0, Math.min(1, (e.stored || 0) / ACCUM_CAP));
  ctx.fillStyle = '#202018';
  rr(ctx, px + 10, py + 10, s - 20, sh - 20, 4); ctx.fill();
  ctx.fillStyle = pct > 0 ? '#c9a84a' : '#4a4a30';
  rr(ctx, px + 12, py + sh - 12 - (sh - 24) * pct, s - 24, (sh - 24) * pct, 3); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 9px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(Math.round(pct * 100) + '%', px + s / 2, py + 12);
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function solarPanelPanelHtml() {
  return row('当前输出', '<span class="dim"></span>', 'power') +
    '<div class="status"></div>' +
    '<div class="dim">太阳能板：白天无燃料发电，夜晚停发。并入全图电网，可为用电设备供能（2×2）。</div>';
}
function solarPanelPanelLive(e, api) {
  api.set('power', '+' + (e.powerOut || 0).toFixed(1));
  if (solarFactor() > 0.02) api.status('发电中：白天 ' + (e.powerOut || 0).toFixed(1), 'ok');
  else api.status('已暂停：夜晚，等待天亮', 'warn');
}
function solarPanelTip(e) {
  return solarFactor() > 0.02 ? ('发电中 +' + (e.powerOut || 0).toFixed(1)) : '夜晚停发';
}
function accumulatorPanelHtml() {
  return row('储电量', '<span class="dim"></span>', 'stored') +
    '<div class="status"></div>' +
    '<div class="dim">蓄电器：储存电力，白天电网有盈余时充电，夜间/缺口时放电补充，平滑电网波动（2×2）。</div>';
}
function accumulatorPanelLive(e, api) {
  api.set('stored', Math.round(e.stored || 0) + ' / ' + ACCUM_CAP);
  const pct = (e.stored || 0) / ACCUM_CAP;
  if (G.power.prod > G.power.demand && pct < 1) api.status('充电中：白天电网盈余', 'ok');
  else if (G.power.prod < G.power.demand && (e.stored || 0) > 0) api.status('放电中：补充电网缺口', 'ok');
  else api.status('待机', 'ok');
}
function accumulatorTip(e) {
  return '储能 ' + Math.round(e.stored || 0) + '/' + ACCUM_CAP;
}

// ===== 注册 =====
ENT_CLASSES['solar-panel'] = SolarPanel;
ENT_CLASSES['accumulator'] = Accumulator;
DEVICE_RENDER['solar-panel'] = drawSolarPanel;
DEVICE_RENDER['accumulator'] = drawAccumulator;
DEVICE_STATUS['solar-panel'] = e => solarFactor() > 0.02 ? 'g' : 'r';
DEVICE_STATUS['accumulator'] = e => (e.stored || 0) > 0 ? 'g' : 'r';
DEVICE_PANEL['solar-panel'] = { html: solarPanelPanelHtml, live: solarPanelPanelLive, tip: solarPanelTip };
DEVICE_PANEL['accumulator'] = { html: accumulatorPanelHtml, live: accumulatorPanelLive, tip: accumulatorTip };
