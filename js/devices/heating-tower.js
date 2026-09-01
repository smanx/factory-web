'use strict';

// ===== 太空时代供热塔（heating-tower，Aquilo）=====
// 官方 reactor 原型：燃烧化学燃料（煤/固体燃料/火箭燃料/木头）产生巨量热量，
// 热量经导热管传导至热交换器 → 高温蒸汽 → 汽轮机发电。
// 数据全部来自 GAME_DATA.heat（data.generated.js 官方）：
//   产热 = 燃料消耗率 × 效比（官方 consumption=40MW、effectivity=2.5 → 100MW，高于核反应堆 40MW）
//   heat_buffer: specific_heat=5MJ/°C、max_transfer=10GW、max_temperature=1000°C
// 达到最高温度仍持续燃烧（官方特性，不会因热满而熄火）。
// 四边（北/东/南/西）各 1 个热量接口（官方 heat_buffer.connections）。

class HeatingTower extends Entity {
  constructor(type, x, y) {
    super(type || 'heating-tower', x, y);
    this.fuelCoal = 0;      // 燃料库存（煤/固体/火箭/木头，对齐锅炉燃料体系）
    this.fuelSolid = 0;
    this.fuelRocket = 0;
    this.fuelWood = 0;
    this.burnLeft = 0;      // 当前燃料剩余燃烧秒数
    this.heatEnergy = 0;    // 内部热量能量(MJ)，温度 = heatEnergy / specificHeat（官方 heat_buffer）
    this.burning = false;
    this.lit = false;
  }
  // ===== 官方 Heat buffer 接口（对齐 heating-tower heat_buffer）=====
  specificHeat() { return HEATING_TOWER_SPECIFIC_HEAT; }       // 5MJ/°C（官方）
  maxTransfer() { return HEATING_TOWER_MAX_TRANSFER; }         // 10GW（官方）
  maxEnergy() { return HEAT_MAX_TEMP * this.specificHeat(); }  // 1000°C × 5MJ = 5000MJ
  temperature() { return this.heatEnergy / this.specificHeat(); }
  heatCap() { return this.maxEnergy(); }
  // 热量接口：四边（北/东/南/西）各 1 个（官方 heat_buffer.connections）
  isHeatPortCell(cx, cy) {
    const n = { x: this.x, y: this.y - 1 };
    const e = { x: this.x + this.w, y: this.y };
    const s = { x: this.x, y: this.y + this.h };
    const w = { x: this.x - 1, y: this.y };
    return (cx === n.x && cy === n.y) || (cx === e.x && cy === e.y) ||
           (cx === s.x && cy === s.y) || (cx === w.x && cy === w.y);
  }
  update(dt) {
    this.burning = false;
    // 向相邻导热管/热交换器传导热量（官方算法：按温度差，从高温流向低温）
    this.heatFlow(dt);
    // 消耗燃料：只要还有燃料就一直烧，无视热量是否存满（官方：达到最高温仍持续燃烧）
    if (this.burnLeft <= 0 && (this.fuelRocket > 0 || this.fuelSolid > 0 || this.fuelCoal > 0 || this.fuelWood > 0)) {
      // 优先烧最高能量的火箭燃料，其次固体燃料，再次煤，最后木材（对齐锅炉）
      if (this.fuelRocket > 0) { this.fuelRocket--; if (typeof trackProd === 'function') trackProd('rocket-fuel', -1); this.burnLeft += ROCKET_FUEL_ENERGY; }
      else if (this.fuelSolid > 0) { this.fuelSolid--; if (typeof trackProd === 'function') trackProd('solid-fuel', -1); this.burnLeft += SOLID_FUEL_ENERGY; }
      else if (this.fuelCoal > 0) { this.fuelCoal--; if (typeof trackProd === 'function') trackProd('coal', -1); this.burnLeft += COAL_ENERGY; }
      else { this.fuelWood--; if (typeof trackProd === 'function') trackProd('wood', -1); this.burnLeft += WOOD_FUEL_ENERGY; }
    }
    if (this.burnLeft <= 0) { this.lit = false; return; }
    this.lit = true;
    this.burning = true;
    // 产热 = 燃料消耗率 × 效比（官方 40MW × 2.5 = 100MW），存入 heat buffer（最高温后多余热量流失）
    const rate = HEATING_TOWER_RATE * HEATING_TOWER_EFFECTIVITY;
    this.heatEnergy = Math.min(this.maxEnergy(), this.heatEnergy + rate * dt);
    // 燃烧速率 = 供热塔官方功率 40MW，使一块燃料燃烧时长 = 热值÷功率，对齐官方
    this.burnLeft -= dt * fuelConsumptionMult() * burnPowerMW('heating-tower');
    // 燃烧粒子（可选：供热塔燃烧火光/热浪）
    if (typeof heatingTowerEmit === 'function') heatingTowerEmit(this, dt);
  }
  // 热量传导：把热量输送给相邻的导热管/热交换器（仅经四边热量接口，接口未对上不传热）
  heatFlow(dt) {
    if (this.temperature() <= 0) return;
    forEachNeighborEnt(this, n => {
      if (n._dead) return;
      const isHeatSink = (n instanceof HeatPipe) || (n instanceof HeatExchanger);
      if (!isHeatSink) return;
      if (!heatDevicesConnectedViaPort(this, n)) return;
      if (this.temperature() <= n.temperature()) return;
      heatTransfer(this, n, dt);
    });
  }
  // 燃料装卸（对齐锅炉：煤/固体/火箭/木头各 20 格）
  giveItem(item) {
    if (item === 'rocket-fuel' && this.fuelRocket < 20) { this.fuelRocket++; return true; }
    if (item === 'coal' && this.fuelCoal < 20) { this.fuelCoal++; return true; }
    if (item === 'wood' && this.fuelWood < 20) { this.fuelWood++; return true; }
    if (item === 'solid-fuel' && this.fuelSolid < 20) { this.fuelSolid++; return true; }
    return false;
  }
  peekItem() { return null; }
  takeItem() { return null; }
  countOf(item) { return 0; }
  contents() {
    const list = [[this.type, 1]];
    if (this.fuelRocket > 0) list.push(['rocket-fuel', this.fuelRocket]);
    if (this.fuelSolid > 0) list.push(['solid-fuel', this.fuelSolid]);
    if (this.fuelCoal > 0) list.push(['coal', this.fuelCoal]);
    if (this.fuelWood > 0) list.push(['wood', this.fuelWood]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.fuelCoal = this.fuelCoal; s.fuelSolid = this.fuelSolid; s.fuelRocket = this.fuelRocket; s.fuelWood = this.fuelWood;
    s.burnLeft = this.burnLeft; s.heatEnergy = this.heatEnergy;
    return s;
  }
  static restore(s) {
    const r = super.restore(s);
    r.fuelCoal = s.fuelCoal || 0; r.fuelSolid = s.fuelSolid || 0; r.fuelRocket = s.fuelRocket || 0; r.fuelWood = s.fuelWood || 0;
    r.burnLeft = s.burnLeft || 0; r.heatEnergy = s.heatEnergy || 0;
    return r;
  }
}

// 供热塔燃烧粒子：上升热浪/火星
function heatingTowerEmit(e, dt) {
  if (typeof spawnSteam !== 'function') return;
  const key = 'ht' + e.x + ',' + e.y;
  if (!G.entFxTimer) G.entFxTimer = {};
  G.entFxTimer[key] = (G.entFxTimer[key] || 0) + dt;
  if (G.entFxTimer[key] < 0.3) return;
  G.entFxTimer[key] = 0;
  const cx = (e.x + 0.5) * TILE;
  const cy = (e.y + 0.3) * TILE;
  spawnSteam(cx + (Math.random() - 0.5) * e.w * TILE * 0.4, cy, { size: 5, color: e.temperature() > 350 ? '#f0a060' : '#c06030' });
}

// ===== 渲染：3×3 供热塔（温度越高越红亮）=====
function drawHeatingTower(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const w = TILE * e.w, h = TILE * e.h;
  const temp = e.temperature();
  const heatPct = Math.max(0, Math.min(1, temp / HEAT_MAX_TEMP));
  const glow = temp >= HEAT_PIPE_MIN_GLOW_TEMP;
  ctx.globalAlpha = alpha;
  // 底座
  ctx.fillStyle = '#3a3428';
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 9); ctx.fill();
  ctx.strokeStyle = '#1c1710';
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 9); ctx.stroke();
  // 塔身（中部圆形炉膛）
  ctx.fillStyle = '#2a2520';
  rr(ctx, px + 14, py + 14, w - 28, h - 28, 7); ctx.fill();
  // 炉膛发光（温度越高越亮）
  const fire = e.burning || glow;
  ctx.fillStyle = fire ? `rgb(${Math.round(200 + heatPct * 55)},${Math.round(120 - heatPct * 40)},${Math.round(40 + heatPct * 20)})` : '#5a4a35';
  ctx.beginPath();
  ctx.arc(px + w / 2, py + h / 2, Math.min(w, h) * 0.24, 0, 7);
  ctx.fill();
  if (fire) {
    // 四边热量接口（北/东/南/西）高亮
    ctx.fillStyle = 'rgba(255,180,80,0.7)';
    const r = 5;
    ctx.fillRect(px + w / 2 - r / 2, py + 3, r, 4);
    ctx.fillRect(px + w / 2 - r / 2, py + h - 7, r, 4);
    ctx.fillRect(px + 3, py + h / 2 - r / 2, 4, r);
    ctx.fillRect(px + w - 7, py + h / 2 - r / 2, 4, r);
  }
  ctx.globalAlpha = 1;
}
function heatingTowerTip(e) {
  const t = Math.round(e.temperature());
  return '供热塔 ' + (e.burning ? (t + '°C · 产热 ' + (HEATING_TOWER_RATE * HEATING_TOWER_EFFECTIVITY) + 'MW') : '待机');
}

// ===== 面板 =====
function heatingTowerPanelHtml(e) {
  const temp = Math.round(e.temperature());
  let h = '';
  h += row('燃料', (e.fuelRocket > 0 || e.fuelSolid > 0 || e.fuelCoal > 0 || e.fuelWood > 0) ? '<div class="asm3-inp-row">' + itemSlotsHtml({ 'rocket-fuel': e.fuelRocket, 'solid-fuel': e.fuelSolid, 'coal': e.fuelCoal, 'wood': e.fuelWood }, { action: 'display' }) + '</div>' : '<span class="dim">无</span>', 'fuel');
  if (e.fuelCoal < 20) h += '<button data-action="fuel" data-id="coal">加 5 煤 (' + invCount('coal') + ')</button>';
  if (e.fuelSolid < 20) h += '<button data-action="fuel" data-id="solid">加 5 固 (' + invCount('solid-fuel') + ')</button>';
  h += row('炉温', temp >= 1 ? chip('heat-pipe', temp + '°C') : dimSpan('空'), 'heat');
  h += row('产热', (e.burning ? (HEATING_TOWER_RATE * HEATING_TOWER_EFFECTIVITY) + 'MW' : '<span class="dim">0</span>'), 'power');
  h += row('状态', e.burning ? '<span class="ok">燃烧中（已达最高温仍持续燃烧）</span>' : (e.lit ? '<span class="ok">点火中</span>' : '<span class="dim">缺燃料</span>'), 'status');
  h += '<div class="dim">供热塔：燃烧化学燃料（煤/固体/火箭/木头）产热，经四边热量接口向导热管传导（导热管/热交换器须对准四边接口格才传热），再经热交换器热交换口产高温蒸汽供汽轮机发电（对齐《异星工厂》Space Age 供热塔，数据来自 GAME_DATA）。</div>';
  return h;
}
function heatingTowerOnAction(e, action, data) {
  if (action === 'fuel') {
    const map = { 'coal': 'coal', 'solid': 'solid-fuel' };
    const id = map[data];
    if (!id) return;
    if (e.giveItem(id)) { invRemove(id, 1); }
  }
}

// ===== 注册 =====
ENT_CLASSES['heating-tower'] = HeatingTower;
DEVICE_RENDER['heating-tower'] = drawHeatingTower;
DEVICE_DIR_ROTATE['heating-tower'] = true; // 支持旋转
DEVICE_STATUS['heating-tower'] = e => (e.burning || e.lit) ? 'g' : (e.heatEnergy > 0 ? 'y' : 'r');
DEVICE_PANEL['heating-tower'] = { html: heatingTowerPanelHtml, onAction: heatingTowerOnAction, tip: heatingTowerTip };
