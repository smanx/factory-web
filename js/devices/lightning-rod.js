'use strict';

// ===== Fulgora 避雷系统（太空时代 Space Age，对齐《异星工厂》lightning-rod / lightning-collector）=====
// 避雷针 / 避雷收集器：雷电季节会随机落雷，避雷设备保护其周围区域免受雷击，
// 并把雷电能量转化为电网电力（官方 lightning-attractor 原型）。
//
// 数据全部来自 data.generated.js 的 GAME_DATA.lightning（factorio-data 官方单源）：
//   - 避雷针：efficiency 0.2、range_elongation 15、buffer 500MJ、占地 1×1、血量 100
//   - 避雷收集器：efficiency 0.4、range_elongation 25、buffer 1000MJ、占地 2×2、血量 200
// 未为设备单独维护数值表。

// ---- 避雷系统全局状态（挂在 G.weather.lightning）----
// storm：当前是否处于雷暴；nextStrike：距下次落雷秒数；strikes：活动落雷特效数组。
// 雷电以"雷暴期"触发：每隔一段随机时间进入雷暴（持续若干秒，期间周期性落雷）。
function lightningEnabled() {
  // 设置了避雷科技后才出现雷电系统（否则纯天气，不落雷）
  return !!(G.techDone && G.techDone['lightning']);
}

// ---- 官方避雷数据（单源来自 GAME_DATA.lightning，兜底官方值）----
const LIGHTNING_STRIKE_ENERGY_MJ = 500;      // 每次落雷的雷电能量（MJ，对齐官方避雷针 buffer 500MJ 一次充满）
const LIGHTNING_STRIKE_DMG = 20;             // 未被避雷设备接住的落雷对附近建筑/玩家的伤害
const ROD_EFF = GAME_DATA.lightning?.rodEfficiency ?? 0.2;           // 避雷针效率（官方 0.2）
const COLLECTOR_EFF = GAME_DATA.lightning?.collectorEfficiency ?? 0.4; // 避雷收集器效率（官方 0.4）
const ROD_RANGE = GAME_DATA.lightning?.rodRange ?? 15;                 // 避雷针保护半径（格，官方 15）
const COLLECTOR_RANGE = GAME_DATA.lightning?.collectorRange ?? 25;     // 避雷收集器保护半径（格，官方 25）
const ROD_BUFFER = (GAME_DATA.lightning?.rodBufferMJ ?? 500) * 1000;       // 避雷针储能上限（kJ）
const COLLECTOR_BUFFER = (GAME_DATA.lightning?.collectorBufferMJ ?? 1000) * 1000; // 避雷收集器储能上限（kJ）

function rodBufferFor(type) { return type === 'lightning-collector' ? COLLECTOR_BUFFER : ROD_BUFFER; }
function rodEffFor(type) { return type === 'lightning-collector' ? COLLECTOR_EFF : ROD_EFF; }
function rodRangeFor(type) { return type === 'lightning-collector' ? COLLECTOR_RANGE : ROD_RANGE; }

// 初始化避雷系统（雷电季节时间线确定性依赖世界种子）
function initLightning() {
  if (!G.weather) initWeather();
  if (!G.weather.lightning) {
    G.weather.lightning = {
      storm: false,
      nextStorm: 40 + Math.random() * 60,   // 距下次雷暴期（秒）
      stormDur: 0,
      nextStrike: 0,
      strikes: [],                          // 活动落雷特效 [{x,y,t}]
    };
  }
  return G.weather.lightning;
}

// 更新避雷系统：雷暴期推进 + 周期性落雷（dt 秒）
function updateLightning(dt) {
  if (!lightningEnabled()) return;
  const L = initLightning();
  L.strikes = L.strikes.filter(s => s.t > 0);   // 清理已消失的落雷特效

  // 不在雷暴期：倒计时进入下一次雷暴
  if (!L.storm) {
    L.nextStorm -= dt;
    if (L.nextStorm <= 0) {
      L.storm = true;
      L.stormDur = 8 + Math.random() * 10;       // 雷暴持续 8~18 秒
      L.nextStrike = 0.4 + Math.random() * 0.8;  // 雷暴开始后很快落第一道雷
    }
    return;
  }
  // 雷暴期：周期性落雷
  L.stormDur -= dt;
  L.nextStrike -= dt;
  if (L.nextStrike <= 0) {
    lightningStrike();
    L.nextStrike = 0.7 + Math.random() * 1.3;    // 雷暴期内约 0.7~2 秒一道雷
  }
  if (L.stormDur <= 0) { L.storm = false; L.nextStorm = 50 + Math.random() * 70; }
}

// 一次落雷：在玩家附近随机位置落雷，寻找最近避雷设备接住
function lightningStrike() {
  const px = G.player ? G.player.x / TILE : 0;
  const py = G.player ? G.player.y / TILE : 0;
  const fx = Math.round(px + (Math.random() * 40 - 20));  // 玩家周围 ±20 格随机落雷
  const fy = Math.round(py + (Math.random() * 40 - 20));
  // 在避雷设备保护范围内寻找最近的避雷针/收集器
  const rod = findLightningRodInRange(fx, fy);
  const L = initLightning();
  if (rod) {
    // 避雷设备接住落雷：按其效率充能，然后放电给电网
    rod.onStrike(LIGHTNING_STRIKE_ENERGY_MJ);
    L.strikes.push({ x: rod.x * TILE + rod.w * TILE / 2, y: rod.y * TILE, t: 0.35, color: '#e8e020' });
    // 接雷闪光粒子
    if (typeof spawnSpark === 'function') {
      for (let i = 0; i < 10; i++) spawnSpark(rod.x * TILE + rod.w * TILE / 2, rod.y * TILE, { color: '#f0e84a', life: 0.4, size: 2 });
    }
  } else {
    // 无避雷设备：落雷击地（视觉特效 + 伤害）
    L.strikes.push({ x: fx * TILE + TILE / 2, y: fy * TILE, t: 0.3, color: '#e8e020' });
    if (typeof damageNearEntities === 'function') damageNearEntities(fx * TILE, fy * TILE, 6, LIGHTNING_STRIKE_DMG);
    if (typeof spawnParticle === 'function') spawnParticle('spark', fx * TILE + TILE / 2, fy * TILE, { color: '#fff4a0', life: 0.5, size: 3 });
  }
}

// 落雷未被避雷设备接住时：对附近玩家/建筑造成伤害（增强雷电威胁感）
function damageNearEntities(wx, wy, radiusPx, dmg) {
  // 伤害玩家：若玩家离落雷点过近
  if (G.player) {
    const dx = G.player.x - wx, dy = G.player.y - wy;
    if (Math.hypot(dx, dy) < radiusPx * 3 && typeof damagePlayer === 'function') {
      damagePlayer(dmg);
      if (typeof spawnSmoke === 'function') spawnSmoke(wx, wy, { color: '#ffa040', life: 0.6, size: 4 });
    }
  }
  // 伤害附近建筑（HP 较高的建筑减半伤害，避免瞬间拆家）
  if (typeof G !== 'undefined') {
    for (const e of G.ents) {
      if (e._dead || e === G.player || !e.hp) continue;
      const ex = e.x * TILE + e.w * TILE / 2, ey = e.y * TILE + e.h * TILE / 2;
      if (Math.hypot(ex - wx, ey - wy) < radiusPx * 1.5) {
        const hit = e.hp > 300 ? Math.round(dmg / 2) : dmg;
        e.hp = Math.max(0, (e.hp || 0) - hit);
        if (e.hp <= 0) e.hp = 0;
      }
    }
  }
}

// 在 (tx,ty) 落雷点周围寻找最近的避雷设备（优先收集器=效率更高）
function findLightningRodInRange(tx, ty) {
  let best = null, bestD = Infinity;
  for (const e of G.ents) {
    if (e._dead) continue;
    if (e.type !== 'lightning-rod' && e.type !== 'lightning-collector') continue;
    const range = rodRangeFor(e.type);
    const cx = e.x + e.w / 2, cy = e.y + e.h / 2;
    const d = Math.hypot(cx - tx, cy - ty);
    if (d <= range && d < bestD) { bestD = d; best = e; }
  }
  return best;
}

// ===== 避雷设备实体 =====
// 每道雷落点被避雷设备接住后，按其效率把雷电能量存入内置储能，再随时间放电给电网。
class LightningRod extends Entity {
  constructor(type, x, y) {
    super(type, x, y);
    this.stored = 0;        // 当前储能（kJ）
    this.powerOut = 0;      // 放电注入电网功率（kW）
    this._flash = 0;        // 接雷闪光计时
  }
  // 接雷：按效率把雷电能量存入储能
  onStrike(mj) {
    const cap = rodBufferFor(this.type);
    const gain = Math.min(cap - this.stored, mj * rodEffFor(this.type) * 1000); // MJ→kJ
    this.stored += gain;
    this._flash = 0.3;      // 接雷闪光
  }
  update(dt) {
    this._flash = Math.max(0, this._flash - dt);
    // 把储能缓慢放电给电网（储能有电时持续供出，作为正 powerOut）
    this.powerOut = 0;
    if (this.stored > 0) {
      // 官方 buffer 在接雷后快速放出：按 1 秒放完折算（放电速率 = 储能/kW）
      const rate = this.stored / 1.0;   // 1 秒内放完（kW）
      this.powerOut = Math.min(rate, this.stored / Math.max(dt, 0.001));
      this.stored = Math.max(0, this.stored - this.powerOut * dt);
    }
    if (typeof regPowerEnt === 'function') regPowerEnt(this);
  }
  serialize() { const s = super.serialize(); s.stored = this.stored; return s; }
  static restore(s) { const a = super.restore(s); a.stored = s.stored || 0; a._flash = 0; return a; }
}

// ===== 渲染 =====
function drawLightningRod(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w, sh = TILE * e.h;
  ctx.globalAlpha = alpha;
  const isCollector = e.type === 'lightning-collector';
  // 底座
  ctx.fillStyle = isCollector ? '#5a5a2a' : '#4a4a1a';
  rr(ctx, px + s * 0.2, py + sh * 0.6, s * 0.6, sh * 0.4, 3); ctx.fill();
  ctx.strokeStyle = '#2a2a10'; ctx.lineWidth = 2;
  rr(ctx, px + s * 0.2, py + sh * 0.6, s * 0.6, sh * 0.4, 3); ctx.stroke();
  // 杆体
  ctx.strokeStyle = isCollector ? '#e0e060' : '#c8c840';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(px + s / 2, py + sh * 0.6);
  ctx.lineTo(px + s / 2, py + sh * 0.1);
  ctx.stroke();
  // 尖端小球
  ctx.fillStyle = isCollector ? '#f0f080' : '#d8d850';
  ctx.beginPath();
  ctx.arc(px + s / 2, py + sh * 0.08, isCollector ? 5 : 4, 0, 7);
  ctx.fill();
  // 收集器更大，画收集环
  if (isCollector) {
    ctx.strokeStyle = '#d0d050'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px + s / 2, py + sh * 0.5, s * 0.35, 0, 7); ctx.stroke();
  }
  // 接雷闪光
  if (e._flash > 0) {
    ctx.fillStyle = 'rgba(240,240,120,' + (e._flash / 0.3 * 0.8).toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(px + s / 2, py + sh * 0.1, 8 + (0.3 - e._flash) * 30, 0, 7); ctx.fill();
  }
  // 储能提示（小字）
  if (e.stored > 0) {
    ctx.fillStyle = '#ffe9a0';
    ctx.font = 'bold 8px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(Math.round(e.stored / 1000) + 'MJ', px + s / 2, py + sh + 8);
  }
  ctx.globalAlpha = 1;
}

// 绘制落雷特效（屏幕覆盖层）
function drawLightningStrikes(ctx, cam) {
  const L = G.weather && G.weather.lightning;
  if (!L || !L.strikes || !L.strikes.length) return;
  for (const s of L.strikes) {
    if (s.t <= 0) continue;
    const sx = (s.x - cam.px) + ctx.canvas.width / 2;
    const sy = (s.y - cam.py) + ctx.canvas.height / 2;
    const a = Math.min(1, s.t / 0.3);
    ctx.save();
    ctx.strokeStyle = 'rgba(255,240,120,' + a.toFixed(2) + ')';
    ctx.lineWidth = 3;
    ctx.globalCompositeOperation = 'lighter';
    // 锯齿闪电竖线
    const seg = 5, h = 26;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    for (let i = 0; i < seg; i++) {
      ctx.lineTo(sx + (Math.random() - 0.5) * 8, sy - h * (i + 1) / seg);
    }
    ctx.stroke();
    ctx.restore();
  }
}

// ===== 面板 =====
function lightningRodPanelHtml() {
  return row('储能', '<span class="dim"></span>', 'stored') +
    '<div class="status"></div>' +
    '<div class="dim">避雷针：保护小片区域免受雷击，接雷后把雷电能量转化为电网电力（1×1，官方 efficiency 0.2）。雷暴期会自动接雷充能并放电。</div>';
}
function lightningRodPanelLive(e, api) {
  const cap = rodBufferFor(e.type);
  api.set('stored', Math.round(e.stored / 1000) + 'MJ / ' + Math.round(cap / 1000) + 'MJ');
  const storm = G.weather && G.weather.lightning && G.weather.lightning.storm;
  if (e.stored > 0) api.status('放电中：接雷储能 ' + Math.round(e.stored / 1000) + 'MJ 正在并入电网', 'ok');
  else if (storm) api.status('雷暴中：等待接雷充能', 'ok');
  else api.status('待机：等待雷暴期接雷', 'ok');
}
function lightningRodTip(e) {
  const cap = rodBufferFor(e.type);
  return '储能 ' + Math.round(e.stored / 1000) + '/' + Math.round(cap / 1000) + 'MJ';
}

// 收集器面板（效率更高、范围更大）
function lightningCollectorPanelHtml() {
  return row('储能', '<span class="dim"></span>', 'stored') +
    '<div class="status"></div>' +
    '<div class="dim">避雷收集器：保护大片区域免受雷击，接雷效率更高（官方 efficiency 0.4），把雷电能量更高效地转化为电网电力（2×2）。</div>';
}
function lightningCollectorPanelLive(e, api) { lightningRodPanelLive(e, api); }
function lightningCollectorTip(e) { return lightningRodTip(e); }

// ===== 注册 =====
ENT_CLASSES['lightning-rod'] = LightningRod;
ENT_CLASSES['lightning-collector'] = LightningRod;
DEVICE_RENDER['lightning-rod'] = drawLightningRod;
DEVICE_RENDER['lightning-collector'] = drawLightningRod;
DEVICE_DIR_ROTATE['lightning-rod'] = true;
DEVICE_DIR_ROTATE['lightning-collector'] = true;
DEVICE_STATUS['lightning-rod'] = e => (e.stored || 0) > 0 ? 'g' : 'y';
DEVICE_STATUS['lightning-collector'] = e => (e.stored || 0) > 0 ? 'g' : 'y';
DEVICE_PANEL['lightning-rod'] = { html: lightningRodPanelHtml, live: lightningRodPanelLive, tip: lightningRodTip };
DEVICE_PANEL['lightning-collector'] = { html: lightningCollectorPanelHtml, live: lightningCollectorPanelLive, tip: lightningCollectorTip };
