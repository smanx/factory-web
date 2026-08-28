'use strict';

// ===== Aquilo 聚变发电链（fusion-reactor / fusion-generator / fusion-power-cell）=====
// 官方 Space Age 聚变体系：聚变反应堆燃烧聚变燃料棒产生超高温等离子热量，
// 经导热管传导至聚变发电机，发电机把热量直接转化为电能（单台满功率 50MW）。
// 数据全部来自 GAME_DATA（data.generated.js 官方 factorio-data）：
//   - fusion-reactor：6×6（selection_box ±3）、max_health 1000、power_input 10MW
//   - fusion-generator：3×5（selection_box ±1.5×±2.5）、max_health 1000、output_flow_limit 50MW
// 反应堆比核反应堆热功率更高（终极发电），发电机为热量→电力的直接转换器。

// ===== 聚变反应堆（6×6，吃聚变燃料棒）=====
// 复用供热塔/核反应堆的 heat buffer 模型：燃烧聚变燃料棒把内部热量升到超高温，
// 经四边热量接口向导热管传导。热功率远超核反应堆（40MW）与供热塔（100MW）。
class FusionReactor extends Entity {
  constructor(type, x, y) {
    super(type || 'fusion-reactor', x, y);
    this.fuel = 0;          // 聚变燃料棒数量
    this.burnLeft = 0;      // 当前燃料剩余燃烧秒数
    this.heatEnergy = 0;    // 内部热量能量(MJ)，温度 = heatEnergy / specificHeat
    this.plasmaBuf = 0;     // 聚变等离子体缓冲（官方 Plasma 工作介质，输出到相邻管道）
    this.coolantBuf = 0;    // 氟酮冷液缓冲（官方 fusion-reactor 冷却剂 input_fluid_box 输入 fluoroketone-cold）
    this.burning = false;
    this.lit = false;
  }
  // ===== Heat buffer 接口（对齐官方 heat_buffer）=====
  specificHeat() { return FUSION_REACTOR_SPECIFIC_HEAT; }   // 10MJ/°C
  maxTransfer() { return FUSION_REACTOR_MAX_TRANSFER; }     // 10GW
  maxEnergy() { return HEAT_MAX_TEMP * this.specificHeat(); }
  temperature() { return this.heatEnergy / this.specificHeat(); }
  heatCap() { return this.maxEnergy(); }
  update(dt) {
    this.burning = false;
    this.coolantFlow(dt);  // 先吸取氟酮冷液冷却剂（官方 fusion-reactor 输入 fluoroketone-cold）
    this.portFlow();  // 先输出等离子体到相邻管道
    // 向相邻导热管/热交换器/聚变发电机传导热量
    this.heatFlow(dt);
    // 消耗燃料：只要还有燃料就一直燃烧，无视热量是否存满（官方：达到最高温仍持续燃烧）
    if (this.burnLeft <= 0 && this.fuel > 0) {
      this.fuel--;
      if (typeof trackProd === 'function') trackProd('fusion-power-cell', -1);
      this.burnLeft += FUSION_FUEL_ENERGY;
    }
    if (this.burnLeft <= 0) { this.lit = false; return; }
    this.lit = true;
    this.burning = true;
    // 产热（MJ/s）：聚变热功率，终极发电，高于核反应堆
    const rate = FUSION_REACTOR_HEAT_RATE;
    this.heatEnergy = Math.min(this.maxEnergy(), this.heatEnergy + rate * dt);
    // 产等离子体（官方 Plasma 工作介质）：聚变核心把热功率的一部分转为等离子流体，
    // 经四边流体接口输出到相邻管道，供聚变发电机经管道吸取发电（对齐官方 Aquilo 聚变链）。
    // 官方 fusion-reactor 需氟酮冷液冷却剂（max_fluid_usage 4/s，GAME_DATA 单源）才产等离子体；
    // 冷却剂不足时按可用比例节流等离子体产出（热量仍持续产出，与官方“无冷却剂停机”对齐但保持可用）。
    const coolantFactor = this.coolantBuf >= 0.01 ? Math.min(1, this.coolantBuf / (FUSION_REACTOR_FLUID_USAGE * Math.max(dt, 0.01))) : 0;
    if (coolantFactor > 0) {
      this.coolantBuf = Math.max(0, this.coolantBuf - FUSION_REACTOR_FLUID_USAGE * dt);
      this.plasmaBuf = Math.min(FUSION_PLASMA_BUF, this.plasmaBuf + FUSION_PLASMA_RATE * dt * coolantFactor);
    }
    this.burnLeft -= dt;
  }
  // 从相邻管道吸取氟酮冷液冷却剂（对齐官方 fusion-reactor input_fluid_box filter=fluoroketone-cold）
  coolantFlow(dt) {
    if (this.coolantBuf >= FUSION_REACTOR_FLUID_USAGE * 2 + 1) return;  // 冷却剂已足，稍后再取
    forEachNeighborEnt(this, n => {
      if (this.coolantBuf >= FUSION_REACTOR_FLUID_USAGE * 2 + 1) return;
      if (!(n instanceof Pipe)) return;
      if ((n.fluid['fluoroketone-cold'] || 0) >= 1) n.takeItemOf('fluoroketone-cold'), this.coolantBuf++;
    });
  }
  // 把等离子体输出到相邻管道（对齐官方：聚变反应堆产生 Plasma，经管道输送到发电机）
  portFlow() {
    if (this.plasmaBuf < 1) return;
    forEachNeighborEnt(this, n => {
      if (this.plasmaBuf < 1) return;
      if (!(n instanceof Pipe)) return;
      if (n.total() < PIPE_CAP && n.giveItem('fusion-plasma')) this.plasmaBuf--;
    });
  }
  // 热量传导：把热量输送给相邻的导热管/热交换器/聚变发电机
  heatFlow(dt) {
    if (this.temperature() <= 0) return;
    forEachNeighborEnt(this, n => {
      if (n._dead) return;
      const isHeatSink = (n instanceof HeatPipe) || (n instanceof HeatExchanger) || (n instanceof FusionGenerator);
      if (!isHeatSink) return;
      if (this.temperature() <= n.temperature()) return;
      heatTransfer(this, n, dt);
    });
  }
  giveItem(item) {
    if (item === 'fusion-power-cell' && this.fuel < 10) { this.fuel++; return true; }
    return false;
  }
  peekItem() { return null; }
  takeItem() { return null; }
  countOf(item) { return item === 'fusion-power-cell' ? this.fuel : 0; }
  takeItemOf(item) { return null; }
  takeAll() {
    const rows = [];
    if (this.fuel > 0) { rows.push(['fusion-power-cell', this.fuel]); this.fuel = 0; }
    return rows;
  }
  contents() {
    const list = [[this.type, 1]];
    if (this.fuel > 0) list.push(['fusion-power-cell', this.fuel]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.fuel = this.fuel; s.burnLeft = this.burnLeft; s.heatEnergy = this.heatEnergy; s.plasmaBuf = this.plasmaBuf; s.coolantBuf = this.coolantBuf || 0;
    return s;
  }
  static restore(s) {
    const r = super.restore(s);
    r.fuel = s.fuel || 0; r.burnLeft = s.burnLeft || 0; r.heatEnergy = s.heatEnergy || 0; r.plasmaBuf = s.plasmaBuf || 0; r.coolantBuf = s.coolantBuf || 0;
    return r;
  }
}

// ===== 聚变发电机（3×5，热量→电力）=====
// 官方 fusion-generator：消耗等离子热量（此处简化为直接消耗相邻导热管传来的热量），
// 把热量转化为电力输出到电网，单台满功率 50MW（官方 output_flow_limit=50MW）。
class FusionGenerator extends Entity {
  constructor(type, x, y) {
    super(type || 'fusion-generator', x, y);
    this.heatEnergy = 0;    // 内部热量能量(MJ)
    this.outMult = 0;       // 输出比例 0~1
    this.powerOut = 0;      // 当前发电功率(kW)
    this.on = false;
  }
  applyDir() { if (this.dir % 2 === 1) { this.w = this.def.h; this.h = this.def.w; } }
  // ===== Heat buffer 接口（作为热量接收端）=====
  specificHeat() { return FUSION_GENERATOR_SPECIFIC_HEAT; }  // 1MJ/°C
  maxTransfer() { return FUSION_GENERATOR_MAX_TRANSFER; }    // 2GW
  maxEnergy() { return HEAT_MAX_TEMP * this.specificHeat(); }
  temperature() { return this.heatEnergy / this.specificHeat(); }
  heatCap() { return this.maxEnergy(); }
  // 从相邻管道吸取聚变等离子体并转化为内部热量（官方：发电机消耗 Plasma 工作介质）
  // 等离子体作为聚变发电的流体介质来源，与相邻导热管热源并列；任一路径供热均可发电。
  portFlow() {
    if (this.temperature() >= HEAT_MAX_TEMP) return;  // 热量已满，不再吸热
    forEachNeighborEnt(this, n => {
      if (n._dead || this.temperature() >= HEAT_MAX_TEMP) return;
      if (!(n instanceof Pipe)) return;
      if ((n.fluid['fusion-plasma'] || 0) >= 1) {
        n.takeItemOf('fusion-plasma');
        // 每 1 单位等离子体折算 1MJ 热量（相对刻度，对齐聚变热功率 200MW→2000 单位/s 的换算）
        this.heatEnergy = Math.min(this.maxEnergy(), this.heatEnergy + FUSION_HEAT_PER_PLASMA);
      }
    });
  }
  update(dt) {
    this.portFlow();       // 先吸取等离子体供热
    this.heatFlow(dt);
    // 把热量转化为电力：满功率耗热率 = 满功率(kW) / (发电机容量比例)
    // 简化：每 MJ 热量 → 对应发电量，满功率 50MW 时每秒消耗的热量由发电量折算
    const wantKw = FUSION_GENERATOR_MAX_POWER;        // 满功率 50000kW
    const heatPerKwSecond = FUSION_HEAT_PER_KW;       // 每 kW·s 需消耗的热量(MJ)
    const wantHeat = wantKw * heatPerKwSecond * dt;   // 满负荷每秒需热量(MJ)
    const use = Math.min(wantHeat, this.heatEnergy);
    if (use > 0) {
      this.heatEnergy -= use;
      const inst = wantHeat > 1e-9 ? Math.min(1, use / wantHeat) : 0;
      this.outMult += (inst - this.outMult) * Math.min(1, dt * 4);
      this.powerOut = wantKw * this.outMult;
    } else {
      this.outMult *= Math.max(0, 1 - dt * 4);
      this.powerOut = wantKw * this.outMult;
    }
    this.on = this.powerOut > 0.05;
    if (typeof regPowerEnt === 'function') regPowerEnt(this);
  }
  // 从相邻导热管/反应堆吸热
  heatFlow(dt) {
    forEachNeighborEnt(this, n => {
      if (n._dead) return;
      const isSrc = (n instanceof HeatPipe) || (n instanceof NuclearReactor) || (n instanceof FusionReactor) || (n instanceof HeatingTower);
      if (!isSrc) return;
      if (n.temperature() <= this.temperature()) return;
      heatTransfer(n, this, dt);
    });
  }
  contents() { return [[this.type, 1]]; }
  serialize() {
    const s = super.serialize();
    s.heatEnergy = this.heatEnergy;
    return s;
  }
  static restore(s) {
    const r = super.restore(s);
    r.heatEnergy = s.heatEnergy || 0;
    return r;
  }
}

// ===== 渲染：6×6 聚变反应堆 =====
function drawFusionReactor(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const w = TILE * e.w, h = TILE * e.h;
  const temp = e.temperature();
  const heatPct = Math.max(0, Math.min(1, temp / HEAT_MAX_TEMP));
  ctx.globalAlpha = alpha;
  // 底座
  ctx.fillStyle = '#3a4a56';
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 10); ctx.fill();
  ctx.strokeStyle = '#1c2830';
  ctx.lineWidth = 4;
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 10); ctx.stroke();
  // 中央聚变核心（越热越亮，蓝紫等离子色）
  const cx = px + w / 2, cy = py + h / 2;
  const coreR = Math.min(w, h) * 0.16;
  const glow = e.lit || temp > 100;
  if (glow) {
    ctx.save();
    ctx.shadowBlur = 40; ctx.shadowColor = 'rgba(140,160,255,.8)';
    ctx.fillStyle = `rgba(${120 + heatPct * 90},${140 + heatPct * 60},255,${0.5 + heatPct * 0.5})`;
    ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, 7); ctx.fill();
    ctx.restore();
  } else {
    ctx.fillStyle = '#5a6a7a';
    ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, 7); ctx.fill();
  }
  // 外围等离子环
  ctx.strokeStyle = glow ? 'rgba(160,180,255,.6)' : '#4a5a6a';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(cx, cy, coreR * 1.7, 0, 7); ctx.stroke();
  // 燃料状态文字
  ctx.fillStyle = '#cfe0f0';
  ctx.font = 'bold 10px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('聚变', cx, cy);
}

// ===== 渲染：3×5 聚变发电机 =====
function drawFusionGenerator(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const w = TILE * e.w, h = TILE * e.h;
  const om = Math.max(0, Math.min(1, e.outMult || 0));
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#4a5a6a';
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 8); ctx.fill();
  ctx.strokeStyle = '#2c3a46';
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 8); ctx.stroke();
  // 涡轮叶片（旋转）
  const cx = px + w / 2, cy = py + h * 0.45;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((e.outMult || 0) * G.time * 3);
  ctx.fillStyle = om > 0 ? '#a0c8e8' : '#5a6a7a';
  gearShape(ctx, 0, 0, TILE * 1.2, TILE * 0.5, 12);
  ctx.fill();
  ctx.restore();
  // 发电指示
  ctx.fillStyle = om > 0.02 ? '#bff0bf' : '#8a93a0';
  ctx.font = 'bold 10px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(Math.round(e.powerOut || 0) + 'kW', cx, py + h * 0.8);
}

// ===== 面板 =====
function fusionReactorPanelHtml(e) {
  const _temp = Math.round(e.temperature());
  const fuel = e.fuel;
  return row('聚变核心', e.burning ? '<span class="ok">运行中（产热 ' + FUSION_REACTOR_HEAT_RATE + 'MW）</span>' : '<span class="dim">待机</span>', 'status') +
    row('核心温度', _temp + '°C', 'heat') +
    row('等离子体', chip('fusion-plasma', '×' + Math.round(e.plasmaBuf || 0)), 'item') +
    row('冷却剂', chip('fluoroketone-cold', '×' + Math.round(e.coolantBuf || 0)), 'item') +
    row('燃料', chip('fusion-power-cell', '×' + fuel), 'item') +
    '<div class="dim">聚变反应堆：燃烧聚变燃料棒 + 消耗氟酮冷液冷却剂（官方 max_fluid_usage 4/s）产生超高温等离子体（Plasma），经四边接口输出到相邻管道，或经导热管传导热量至聚变发电机发电（6×6，功率远超核反应堆，对齐《异星工厂》Space Age 聚变反应堆，数据来自 GAME_DATA）。</div>';
}
function fusionReactorPanelLive(e, api) {
  api.set('heat', e.temperature() >= 1 ? chip('heat-pipe', Math.round(e.temperature()) + '°C') : dimSpan('待机'));
  api.set('status', e.burning ? '运行中' : (e.fuel > 0 ? '点火中' : '缺燃料'));
  api.set('item', (e.coolantBuf || 0) > 0 ? chip('fluoroketone-cold', '×' + Math.round(e.coolantBuf || 0)) + ' ' + (e.fuel > 0 ? chip('fusion-power-cell', '×' + e.fuel) : dimSpan('空')) : (e.fuel > 0 ? chip('fusion-power-cell', '×' + e.fuel) : dimSpan('空')));
}
function fusionReactorTip(e) {
  return '聚变反应堆（6×6）：吃聚变燃料棒，产热 ' + FUSION_REACTOR_HEAT_RATE + 'MW 并产生等离子体（Plasma）。热量经导热管或 Plasma 经管道→聚变发电机→电力。';
}
function fusionReactorOnAction(e, action, data) {
  if (action === 'fuel') {
    const id = 'fusion-power-cell';
    if (!id) return;
    if (e.giveItem(id)) { if (typeof invRemove === 'function') invRemove(id, 1); }
  }
}

function fusionGeneratorPanelHtml(e) {
  return row('发电', (e.powerOut || 0) + 'kW / ' + FUSION_GENERATOR_MAX_POWER + 'kW', 'power') +
    row('核心温度', Math.round(e.temperature()) + '°C', 'heat') +
    '<div class="dim">聚变发电机：消耗相邻管道输入的聚变等离子体（Plasma）或导热管传来的热量，直接转化为电能（3×5，单台满功率 50MW，对齐《异星工厂》Space Age 聚变发电机，数据来自 GAME_DATA）。</div>';
}
function fusionGeneratorPanelLive(e, api) {
  api.set('power', (e.powerOut || 0) + 'kW');
  api.set('heat', e.temperature() >= 1 ? chip('heat-pipe', Math.round(e.temperature()) + '°C') : dimSpan('待机'));
}
function fusionGeneratorTip(e) {
  return '聚变发电机（3×5）：消耗相邻管道输入的等离子体或导热管热量转为电力，满功率 ' + (FUSION_GENERATOR_MAX_POWER / 1000) + 'MW。';
}

// ===== 注册 =====
ENT_CLASSES['fusion-reactor'] = FusionReactor;
DEVICE_RENDER['fusion-reactor'] = drawFusionReactor;
DEVICE_STATUS['fusion-reactor'] = e => e.burning ? 'g' : (e.heatEnergy > 0 ? 'y' : 'r');
DEVICE_PANEL['fusion-reactor'] = { html: fusionReactorPanelHtml, live: fusionReactorPanelLive, tip: fusionReactorTip, onAction: fusionReactorOnAction };
DEVICE_DIR_ROTATE['fusion-reactor'] = true;

ENT_CLASSES['fusion-generator'] = FusionGenerator;
DEVICE_RENDER['fusion-generator'] = drawFusionGenerator;
DEVICE_STATUS['fusion-generator'] = e => e.on ? 'g' : 'r';
DEVICE_PANEL['fusion-generator'] = { html: fusionGeneratorPanelHtml, live: fusionGeneratorPanelLive, tip: fusionGeneratorTip };
DEVICE_DIR_ROTATE['fusion-generator'] = true;
