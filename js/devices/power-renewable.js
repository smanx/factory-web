'use strict';

// ===== 太阳能板：白天无燃料发电（对齐《异星工厂》Solar panel，占地 2×2）=====
// 加入白天/黑夜时间周期，白天满发、夜晚零发，并入全图电网（作为 powerOut 正项）。
const SOLAR_POWER = GAME_DATA.renewable?.solarPower ?? 60;   // 满日照功率（官方太阳能板 60kW）
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
    // 天气（动态云层/阴云）会轻微遮蔽日照，降低太阳能出力
    const wm = (typeof weatherSolarMult === 'function') ? weatherSolarMult() : 1;
    this.powerOut = SOLAR_POWER * solarFactor() * wm;
    // 电力增量注册表同步：powerOut 变化后重新注册，确保被 updatePower 扫描到
    if (typeof regPowerEnt === 'function') regPowerEnt(this);
  }
}

// ===== 蓄电器：储存电力，白天充电、夜间放电（对齐《异星工厂》Accumulator，占地 2×2）=====
// 作为电网的“缓冲电池”：白天电网有盈余时充电，夜间/不足时放电补充。
// 蓄电器也是电路节点：其储电量（0~100）以 signal-charge 信号输出到所连电路网络，
// 可被功率开关/组合器/告警音箱读取，用于按电量自动化调度（对齐《异星工厂》蓄电器电路信号）。
const ACCUM_CAP = GAME_DATA.renewable?.accumCap ?? 5000;            // 储电上限 5MJ（官方蓄电器，单位 kJ）
const ACCUM_CHARGE_RATE = GAME_DATA.renewable?.accumChargeRate ?? 300; // 每秒充/放电速率上限（官方 300kW）
const ACCUM_CIRCUIT_RANGE = 7;     // 蓄电器电路连接范围（格，同小型电线杆），供组合器/功率开关读取其电量信号
class Accumulator extends CircuitNode {
  constructor(type, x, y) {
    super('accumulator', x, y);
    this.stored = 0;               // 当前储电量
    this.powerOut = 0;             // 电网注入功率（放电时 >0），注册用
  }
  // 蓄电器作为电路节点：连接范围取蓄电器自身范围（与附近的电线杆/组合器互联）
  get range() { return ACCUM_CIRCUIT_RANGE; }
  update(dt) {
    // 蓄电器按「所属电网」充放电：电网有闲置产能（capacity>需求）时充电，产能不足时放电补差。
    // 未接入电网（附近无电线杆覆盖）时既不充也不放。
    const g = this._grid;
    this.powerOut = 0;
    if (g) {
      const spare = g.capacity - g.demand;   // 闲置产能（正=可充电，负=缺口需放电）
      if (spare > 0 && this.stored < ACCUM_CAP) {
        const gain = Math.min(ACCUM_CHARGE_RATE * dt, spare, ACCUM_CAP - this.stored);
        this.stored += gain;
      } else if (spare < 0 && this.stored > 0) {
        const loss = Math.min(ACCUM_CHARGE_RATE * dt, -spare, this.stored);
        this.stored -= loss;
      }
      // 电网缺口时以 powerOut 形式向本电网注入放电功率（计入电网产能）
      if (spare < 0 && this.stored > 0) {
        this.powerOut = Math.min(ACCUM_CHARGE_RATE, this.stored * 20);
      }
    }
    // 电力增量注册表同步：powerOut 变化后重新注册，确保被 updatePower 扫描到
    if (typeof regPowerEnt === 'function') regPowerEnt(this);
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
    '<div class="dim">太阳能板：白天无燃料发电，夜晚停发。并入全图电网，可为用电设备供能（2×2）。</div>';
}
function solarPanelPanelLive(e, api) {
  api.set('power', '+' + (e.powerOut || 0).toFixed(1));
  if (e._grid === null) api.status('未接入电网：需位于电线杆供电范围内', 'bad');
  else if (solarFactor() > 0.02) api.status('发电中：白天 ' + (e.powerOut || 0).toFixed(1), 'ok');
  else api.status('已暂停：夜晚，等待天亮', 'warn');
}
function solarPanelTip(e) {
  if (e._grid === null) return '未接入电网（需电线杆）';
  return solarFactor() > 0.02 ? ('发电中 +' + (e.powerOut || 0).toFixed(1)) : '夜晚停发';
}
function accumulatorPanelHtml() {
  return row('储电量', '<span class="dim"></span>', 'stored') +
    '<div class="dim">蓄电器：储存电力，所在电网有盈余时充电，夜间/缺口时放电补充，平滑本电网波动（2×2，需电线杆覆盖接入电网）。</div>';
}
function accumulatorPanelLive(e, api) {
  api.set('stored', Math.round(e.stored || 0) + ' / ' + ACCUM_CAP);
  const pct = (e.stored || 0) / ACCUM_CAP;
  const g = e._grid;
  if (g === null) api.status('未接入电网：需位于电线杆供电范围内', 'bad');
  else if (g && g.capacity > g.demand && pct < 1) api.status('充电中：本电网有闲置产能', 'ok');
  else if (g && g.capacity < g.demand && (e.stored || 0) > 0) api.status('放电中：补充本电网缺口', 'ok');
  else api.status('待机', 'ok');
}
function accumulatorTip(e) {
  if (e._grid === null) return '储能 ' + Math.round(e.stored || 0) + '/' + ACCUM_CAP + '（未接入电网）';
  return '储能 ' + Math.round(e.stored || 0) + '/' + ACCUM_CAP;
}

// ===== 注册 =====
ENT_CLASSES['solar-panel'] = SolarPanel;
ENT_CLASSES['accumulator'] = Accumulator;
DEVICE_RENDER['solar-panel'] = drawSolarPanel;
DEVICE_DIR_ROTATE['solar-panel'] = true; // 支持旋转
DEVICE_RENDER['accumulator'] = drawAccumulator;
DEVICE_DIR_ROTATE['accumulator'] = true; // 支持旋转
DEVICE_STATUS['solar-panel'] = e => e._grid === null ? 'r' : (solarFactor() > 0.02 ? 'g' : 'r');
DEVICE_STATUS['accumulator'] = e => e._grid === null ? 'r' : ((e.stored || 0) > 0 ? 'g' : 'y');
DEVICE_PANEL['solar-panel'] = { html: solarPanelPanelHtml, live: solarPanelPanelLive, tip: solarPanelTip };
DEVICE_PANEL['accumulator'] = { html: accumulatorPanelHtml, live: accumulatorPanelLive, tip: accumulatorTip };
