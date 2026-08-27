'use strict';

// ===== 太空时代 空间平台系统（Space Platform）=====
// 数据（占地/血量/堆叠/命名）全部来自 GAME_DATA（由 factorio-data 现场生成），
// 未单独维护数值表，保持与《异星工厂》官方一致。
// 本文件实现三类空间平台设备：
//   1. 空间平台中枢 space-platform-hub：8×8 组装机变体，专用于生产平台地基/起始包/中枢本体
//   2. 推进器 thruster：4×8 发电设备，燃烧推进器燃料+推进器氧化剂（官方双流体输入）产生电能
//   3. 小行星收集器 asteroid-collector：3×3 设备，在轨道上持续收集小行星碎块（适配为地面缓慢产出）

// ===== 推进器：燃烧推进器燃料 + 推进器氧化剂 发电 =====
// 官方 thruster：fuel_fluid_box 输入 thruster-fuel、oxidizer_fluid_box 输入 thruster-oxidizer，
// max_performance = { fluid_volume 0.8, fluid_usage 2, effectivity 0.51 }。
// 此处适配为地面发电机：同时消耗两种推进流体，按消耗比例发电。
const THRUSTER_FUEL_BUF = 1000;      // 推进器燃料缓冲（单位）
const THRUSTER_OXID_BUF = 1000;      // 推进器氧化剂缓冲（单位）
const THRUSTER_FUEL_RATE = 2.0;      // 每秒消耗推进器燃料（官方 fluid_usage=2）
const THRUSTER_OXID_RATE = 2.0;      // 每秒消耗推进器氧化剂（官方同速）
const THRUSTER_POWER = 8000;         // 满功率发电 8MW（空间平台推进动力，适配简化模型）
class Thruster extends Entity {
  constructor(type, x, y) {
    super('thruster', x, y);
    this.fuelBuf = 0;      // 推进器燃料缓冲
    this.oxidBuf = 0;      // 推进器氧化剂缓冲
    this.on = false;
    this.powerOut = 0;
    this.flameT = 0;       // 火焰动画时间
  }
  applyDir() { if (this.dir % 2 === 1) { this.w = this.def.h; this.h = this.def.w; } }
  portFlow() {
    // 两个流体输入口：燃料（北侧）与氧化剂（南侧），从相邻管道吸取
    const covers = (n, cx, cy) => cx >= n.x && cx < n.x + n.w && cy >= n.y && cy < n.y + n.h;
    const pN = rotCell(this, this.def.w >> 1, -1);
    const pS = rotCell(this, this.def.w >> 1, this.def.h);
    forEachNeighborEnt(this, n => {
      if (!(n instanceof Pipe)) return;
      if (this.fuelBuf < THRUSTER_FUEL_BUF && (n.fluid['thruster-fuel'] || 0) >= 1 && covers(n, pN.x, pN.y)) {
        n.takeItemOf('thruster-fuel'); this.fuelBuf++;
      }
      if (this.oxidBuf < THRUSTER_OXID_BUF && (n.fluid['thruster-oxidizer'] || 0) >= 1 && covers(n, pS.x, pS.y)) {
        n.takeItemOf('thruster-oxidizer'); this.oxidBuf++;
      }
    });
  }
  update(dt) {
    this.portFlow();
    const fuelAvail = Math.min(this.fuelBuf, THRUSTER_FUEL_RATE * dt);
    const oxidAvail = Math.min(this.oxidBuf, THRUSTER_OXID_RATE * dt);
    // 需同时有燃料与氧化剂才发电（对齐官方：燃料与氧化剂双输入）
    if (fuelAvail > 0.1 && oxidAvail > 0.1) {
      this.fuelBuf -= fuelAvail;
      this.oxidBuf -= oxidAvail;
      const ratio = Math.min(fuelAvail / (THRUSTER_FUEL_RATE * dt), oxidAvail / (THRUSTER_OXID_RATE * dt));
      this.powerOut = THRUSTER_POWER * ratio;
      this.on = true;
      this.flameT += dt;
    } else {
      this.powerOut = 0;
      this.on = false;
      this.flameT = 0;
    }
    if (typeof regPowerEnt === 'function') regPowerEnt(this);
  }
  giveItem(item) {
    if (item === 'thruster-fuel' && this.fuelBuf < THRUSTER_FUEL_BUF - 0.01) { this.fuelBuf++; return true; }
    if (item === 'thruster-oxidizer' && this.oxidBuf < THRUSTER_OXID_BUF - 0.01) { this.oxidBuf++; return true; }
    return false;
  }
  peekItem() { return this.fuelBuf >= 1 ? 'thruster-fuel' : (this.oxidBuf >= 1 ? 'thruster-oxidizer' : null); }
  countOf(item) { return item === 'thruster-fuel' ? Math.floor(this.fuelBuf) : (item === 'thruster-oxidizer' ? Math.floor(this.oxidBuf) : 0); }
  takeItem() { if (this.fuelBuf >= 1) { this.fuelBuf--; return 'thruster-fuel'; } if (this.oxidBuf >= 1) { this.oxidBuf--; return 'thruster-oxidizer'; } return null; }
  takeItemOf(item) { if (item === 'thruster-fuel' && this.fuelBuf >= 1) { this.fuelBuf--; return 'thruster-fuel'; } if (item === 'thruster-oxidizer' && this.oxidBuf >= 1) { this.oxidBuf--; return 'thruster-oxidizer'; } return null; }
  contents() {
    const list = [[this.type, 1]];
    if (this.fuelBuf >= 1) list.push(['thruster-fuel', Math.floor(this.fuelBuf)]);
    if (this.oxidBuf >= 1) list.push(['thruster-oxidizer', Math.floor(this.oxidBuf)]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.fuelBuf = this.fuelBuf;
    s.oxidBuf = this.oxidBuf;
    return s;
  }
  static restore(s) {
    const e = super.restore(s);
    e.fuelBuf = s.fuelBuf || 0;
    e.oxidBuf = s.oxidBuf || 0;
    return e;
  }
}

// ===== 小行星收集器：在轨道上持续收集小行星碎块（适配为地面缓慢产出）=====
// 官方 asteroid-collector：在空间平台上从轨道自动收集小行星碎块。
// 此处适配为地面设备：每 15s 产出 1 个随机星块（金属/碳质/氧化，官方小行星随机分布），
// 产满 10 个后停止，供破碎机粉碎加工。
const ASTEROID_COLLECT_TIME = 15;   // 每次收集间隔（秒）
const ASTEROID_COLLECT_CAP = 10;    // 内置星块缓冲上限
function randomAsteroidChunk() {
  const r = Math.random();
  if (r < 0.4) return 'metallic-asteroid-chunk';
  if (r < 0.7) return 'carbonic-asteroid-chunk';
  if (r < 0.95) return 'oxide-asteroid-chunk';
  return 'promethium-asteroid-chunk';   // 钷素星块：官方钷素小行星在远太空稀有分布，低概率收集（5%）
}
class AsteroidCollector extends Entity {
  constructor(type, x, y) {
    super('asteroid-collector', x, y);
    this.buf = {};        // 收集到的星块
    this.timer = 0;       // 收集计时
  }
  update(dt) {
    let total = 0;
    for (const k in this.buf) total += this.buf[k];
    if (total >= ASTEROID_COLLECT_CAP) return;   // 已满，停止收集
    this.timer += dt;
    if (this.timer >= ASTEROID_COLLECT_TIME) {
      this.timer = 0;
      const chunk = randomAsteroidChunk();
      this.buf[chunk] = (this.buf[chunk] || 0) + 1;
    }
  }
  giveItem(item) { if (this.buf[item]) { this.buf[item]++; if (this.buf[item] <= 0) delete this.buf[item]; return true; } return false; }
  takeAll() { const rows = []; for (const k in this.buf) { rows.push([k, this.buf[k]]); } this.buf = {}; return rows; }
  takeItem() { for (const k in this.buf) { const v = this.buf[k]; if (v > 0) { this.buf[k]--; if (this.buf[k] <= 0) delete this.buf[k]; return k; } } return null; }
  takeItemOf(item) { if (this.buf[item] > 0) { this.buf[item]--; if (this.buf[item] <= 0) delete this.buf[item]; return item; } return null; }
  countOf(item) { return this.buf[item] || 0; }
  contents() {
    const list = [[this.type, 1]];
    for (const k in this.buf) list.push([k, this.buf[k]]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.buf = this.buf || {};
    s.timer = this.timer || 0;
    return s;
  }
  static restore(s) {
    const e = super.restore(s);
    e.buf = s.buf || {};
    e.timer = s.timer || 0;
    return e;
  }
}

// ===== 空间平台中枢：组装机变体，专用于生产平台地基/起始包/中枢 =====
class SpacePlatformHub extends Assembler {
  constructor(type, x, y) {
    super('space-platform-hub', x, y);
    this.cargo = {};        // 平台货舱：物品 → 数量（轨道货运）
    this.cargoTarget = null; // 货运目标星球（dispatch 后清空）
  }
  update(dt) {
    this.portFlow();
    if (!this.recipe) { this.crafting = false; return; }
    if (G.power.sat <= 0) { this.crafting = false; return; }
    if (!this.circuitEnabled()) { this.crafting = false; return; }
    const rec = RECIPES[this.recipe];
    if (this.crafting) {
      // 中枢制造速度 1.0（官方 space-platform-hub 无 crafting_speed，默认 1）
      this.prog += dt * asmMult() * (GAME_DATA.deviceStats?.[this.type]?.craftingSpeed ?? 1.0) * this.moduleSpeedMult() * powerFactor() * (this.quality ? qualityMult(this.quality) : 1);
      this.spin += dt * 4;
      if (typeof onScreen === 'function' && onScreen(this) && typeof playSfx === 'function' && G.settings.sound) {
        this._runSfxT = (this._runSfxT || 0) - dt;
        if (this._runSfxT <= 0) { this._runSfxT = 1.4; playSfx('machine-run'); }
      }
      if (this.prog >= rec.time) {
        for (const k in rec.out) {
          emitQuality(this, this.outp, k, rec.out[k]);
          if (typeof trackProd === 'function') trackProd(k, rec.out[k]);
        }
        this.applyProductivity(rec);
        this.crafting = false;
        this.prog = 0;
      }
      return;
    }
    for (const k in rec.inp) if ((this.inp[k] || 0) < rec.inp[k]) return;
    for (const k in rec.out) if ((this.outp[k] || 0) + rec.out[k] > 50) return;
    for (const k in rec.inp) {
      this.inp[k] -= rec.inp[k];
      if (typeof trackProd === 'function') trackProd(k, -rec.inp[k]);
      if (this.inp[k] <= 0) delete this.inp[k];
    }
    this.crafting = true;
    this.prog = 0;
  }
  moduleSlotCount() { return GAME_DATA.deviceStats?.[this.type]?.moduleSlots ?? 5; }
  powerDemand() { return this.recipe ? POWER_USE['space-platform-hub'] || 0 : 0; }
  // 平台货舱（轨道货运）：物品 → 数量，最大容量对齐官方 Cargo 语义（此处适配 50 槽）
  hubCargoCap() { return 50; }
  // 往平台货舱装货（物品若非当前配方原料/模块，则入货舱；机械臂/传送带可自动送入）
  giveItem(item) {
    if (isModule(item)) {
      if ((this.modules[item] || 0) >= this.moduleSlotCount()) return false;
      this.modules[item] = (this.modules[item] || 0) + 1;
      if (typeof playSfx === 'function') playSfx('module');
      return true;
    }
    // 当前配方所需原料优先进入输入缓存
    if (this.recipe && RECIPES[this.recipe] && RECIPES[this.recipe].inp[item]) {
      const rec = RECIPES[this.recipe];
      if ((this.inp[item] || 0) >= rec.inp[item] * 2) return false;
      this.inp[item] = (this.inp[item] || 0) + 1;
      return true;
    }
    // 否则进入平台货舱（轨道货运）
    const total = Object.values(this.cargo).reduce((a, b) => a + b, 0);
    if (total >= this.hubCargoCap()) return false;
    this.cargo[item] = (this.cargo[item] || 0) + 1;
    return true;
  }
  peekItem() {
    // 优先取配方输出
    for (const k in this.outp) if (this.outp[k] > 0) return k;
    return null;
  }
  takeItem() {
    for (const k in this.outp) {
      if (this.outp[k] > 0) { this.outp[k]--; if (this.outp[k] <= 0) delete this.outp[k]; return k; }
    }
    return null;
  }
  countOf(item) { return this.outp[item] || 0; }
  takeItemOf(item) {
    if ((this.outp[item] || 0) > 0) { this.outp[item]--; if (this.outp[item] <= 0) delete this.outp[item]; return item; }
    return null;
  }
  takeCargoItemOf(item) {
    if ((this.cargo[item] || 0) > 0) { this.cargo[item]--; if (this.cargo[item] <= 0) delete this.cargo[item]; return item; }
    return null;
  }
  cargoTotal() { return Object.values(this.cargo).reduce((a, b) => a + b, 0); }
  serialize() {
    const s = super.serialize();
    s.cargo = this.cargo || {};
    s.cargoTarget = this.cargoTarget || null;
    return s;
  }
  blueprint() {
    const s = super.blueprint();
    return s;
  }
  static restore(s) {
    const e = super.restore(s);
    e.cargo = s.cargo || {};
    e.cargoTarget = s.cargoTarget || null;
    return e;
  }
}


// ===== 空间平台枢纽轨道货运（Space Age 平台货运）=====
// 平台中枢可作为轨道货运枢纽：把平台货舱内的货物派发到目标星球轨道，
// 复用火箭发射的行星间货运队列 G.orbitalCargo[planet]，玩家抵达该星球后自动交付。
function hubDispatchCargo(e, target) {
  if (!e || typeof e.cargo !== 'object') return 0;
  const keys = Object.keys(e.cargo).filter(k => (e.cargo[k] || 0) > 0);
  if (!keys.length) { if (typeof toast === 'function') toast('平台货舱为空，无可派发货物'); return 0; }
  if (!target || target === (typeof planetId === 'function' ? planetId() : 'nauvis')) {
    if (typeof toast === 'function') toast('请选择目标星球（不能派发到当前星球）');
    return 0;
  }
  if (!G.orbitalCargo) G.orbitalCargo = {};
  if (!G.orbitalCargo[target]) G.orbitalCargo[target] = {};
  let dispatched = 0;
  for (const k of keys) {
    const n = e.cargo[k] || 0;
    G.orbitalCargo[target][k] = (G.orbitalCargo[target][k] || 0) + n;
    dispatched += n;
    delete e.cargo[k];
  }
  if (typeof toast === 'function') {
    const nm = (typeof planetOption === 'function' && planetOption(target)) ? planetOption(target).name : target;
    toast('🚀 平台货物已派发到' + nm + '轨道：' + dispatched + ' 件（抵达后自动交付）');
  }
  return dispatched;
}

// ===== 渲染：空间平台中枢（蓝灰平台风格）=====
function drawSpacePlatformHub(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w, sh = TILE * e.h;
  ctx.globalAlpha = alpha;
  // 平台基座
  ctx.fillStyle = '#3a3a46';
  rr(ctx, px + 4, py + 4, s - 8, sh - 8, 8); ctx.fill();
  ctx.strokeStyle = '#2a2a34';
  ctx.lineWidth = 3;
  rr(ctx, px + 4, py + 4, s - 8, sh - 8, 8); ctx.stroke();
  ctx.fillStyle = '#4a5a9a';
  rr(ctx, px + s * 0.2, py + s * 0.2, s * 0.6, sh * 0.6, 6); ctx.fill();
  ctx.strokeStyle = '#3a4a80';
  ctx.lineWidth = 2;
  rr(ctx, px + s * 0.2, py + s * 0.2, s * 0.6, sh * 0.6, 6); ctx.stroke();
  ctx.save();
  ctx.translate(px + s / 2, py + s / 2);
  ctx.rotate(e.crafting ? e.spin : 0);
  ctx.fillStyle = e.crafting ? '#a0b8f0' : '#6a80c8';
  gearShape(ctx, 0, 0, Math.min(s, sh) * 0.3, Math.min(s, sh) * 0.18, 8);
  ctx.fill();
  ctx.restore();
  if (portDetailsVisible() && e.recipe) {
    const outId = Object.keys(RECIPES[e.recipe].out)[0];
    drawRecipeIconCell(ctx, px + s / 2, py + s / 2, outId);
  }
  ctx.globalAlpha = 1;
}

// ===== 渲染：推进器（燃烧火焰）=====
function drawThruster(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const w = TILE * e.w, h = TILE * e.h;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#6a5a4a';
  rr(ctx, px + 4, py + 4, w - 8, h - 8, 10); ctx.fill();
  ctx.strokeStyle = '#4a3a2a';
  ctx.lineWidth = 3;
  rr(ctx, px + 4, py + 4, w - 8, h - 8, 10); ctx.stroke();
  // 喷嘴
  ctx.fillStyle = '#2a2a2a';
  rr(ctx, px + w * 0.3, py + h - 16, w * 0.4, 12, 3); ctx.fill();
  // 火焰（当 on 时）
  if (e.on) {
    const flick = 0.8 + 0.2 * Math.sin(e.flameT * 20);
    ctx.fillStyle = 'rgba(255,' + Math.floor(120 + 80 * flick) + ',50,' + (0.8 * flick) + ')';
    ctx.beginPath();
    ctx.moveTo(px + w * 0.35, py + h - 10);
    ctx.lineTo(px + w * 0.5, py + h - 10 - 26 * flick);
    ctx.lineTo(px + w * 0.65, py + h - 10);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ===== 渲染：小行星收集器（抓臂+星块）=====
function drawAsteroidCollector(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w, sh = TILE * e.h;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#4a5a6a';
  rr(ctx, px + 4, py + 4, s - 8, sh - 8, 6); ctx.fill();
  ctx.strokeStyle = '#3a4a5a';
  ctx.lineWidth = 3;
  rr(ctx, px + 4, py + 4, s - 8, sh - 8, 6); ctx.stroke();
  // 抓臂
  ctx.strokeStyle = '#8a9aa8';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(px + s / 2, py + sh / 2);
  ctx.lineTo(px + s * 0.8, py + sh * 0.2);
  ctx.stroke();
  // 已收集星块
  let i = 0;
  for (const k in e.buf) {
    const c = ITEMS[k] ? ITEMS[k].color : '#8a7a6a';
    ctx.fillStyle = c;
    ctx.beginPath();
    ctx.arc(px + s * 0.25 + (i % 3) * s * 0.25, py + sh * 0.65 + Math.floor(i / 3) * 10, 5, 0, Math.PI * 2);
    ctx.fill();
    i++;
  }
  ctx.globalAlpha = 1;
}

// ===== 面板：空间平台中枢（复用组装机面板）=====
function hubPanelHtml(e) {
  let h = row('当前配方', e.recipe ? ITEMS[Object.keys(RECIPES[e.recipe].out)[0]].name : '<span class="dim">未设置</span>');
  h += row('电力', powerStatusLiveHtml(e), 'power');
  h += row('输入', Object.keys(e.inp).length ? countStr(e.inp) : '<span class="dim">空</span>', 'input');
  if (e.recipe)
    for (const k in RECIPES[e.recipe].inp) {
      const n = Math.min(invCount(k), 50 - (e.inp[k] || 0));
      if (n > 0 && FLUIDS.indexOf(k) < 0) h += '<button data-action="feed" data-id="' + k + '">放入' + ITEMS[k].name + ' ×' + n + '</button>';
    }
  if (Object.keys(e.inp).length) h += '<button data-action="takein">取回全部输入</button>';
  {
    const mc = moduleCounts(e.modules);
    const hasMod = (Object.keys(e.modules).length > 0);
    h += row('模块', hasMod ?
      '速度+' + mc.speed.toFixed(1) + ' 产能+' + mc.prod.toFixed(1) + ' 效率-' + mc.eff.toFixed(1) : '<span class="dim">无</span>', 'mod');
    const order = ['speed-module', 'speed-module-2', 'speed-module-3', 'productivity-module', 'productivity-module-2', 'productivity-module-3', 'efficiency-module', 'efficiency-module-2', 'efficiency-module-3'];
    for (const mid of order) {
      if (!itemUnlocked(mid)) continue;
      const n = Math.min(invCount(mid), e.moduleSlotCount() - (e.modules[mid] || 0));
      if (n > 0) h += '<button data-action="feed" data-id="' + mid + '">装入' + ITEMS[mid].name + ' ×' + n + '</button>';
    }
    if (hasMod) h += '<button data-action="takein" data-modules="1">取出全部模块</button>';
  }
  h += row('输出', Object.keys(e.outp).length ? countStr(e.outp) : '<span class="dim">空</span>', 'output');
  h += '<button data-action="takeout" id="btn-takeout" style="display:none"></button>';
  h += barHtml(0);
  h += '<div class="status"></div>';
  h += '<div class="sec">选择配方（空间平台产品）</div>';
  h += '<div class="recgrid">';
  for (const rid of HUB_RECIPES) {
    const rcp = RECIPES[rid];
    if (!rcp || !rcp.out) continue;
    const outId = Object.keys(rcp.out)[0];
    if (!ITEMS[outId]) continue;
    const selCls = e.recipe === rid ? 'sel' : '';
    const inpStr = Object.keys(rcp.inp).map(k => ITEMS[k].name + '×' + rcp.inp[k]).join('、');
    const searchKey = (ITEMS[outId].name + ' ' + outId + ' ' +
      Object.keys(rcp.inp).map(k => ITEMS[k].name).join(' ')).toLowerCase();
    const tipMain = ITEMS[outId].name + '|' + rcp.out[outId] + '个/次，耗时' + rcp.time + '秒';
    const tipRecipe = '所需原料：' + inpStr;
    h += '<button class="rcbtn ' + selCls + '" data-action="recipe" data-id="' + rid + '" data-itemid="' + outId + '" data-rsearch="' + searchKey.replace(/"/g, '') + '" data-tip="' + tipMain + '||' + tipRecipe + '">' +
      '<img src="' + iconDataURL(outId) + '">' + ITEMS[outId].name + '</button>';
  }
  h += '</div>';
  if (e.recipe) h += '<button data-action="recipe-clear">清除配方</button>';
  h += '<div class="dim">空间平台中枢：太空时代空间平台核心（8×8），专用于生产平台地基与起始包，是轨道物流的中枢。选中后按 R 旋转朝向。</div>';

  // ===== 平台货舱 / 轨道货运 =====
  {
    const cargoTotal = e.cargoTotal ? e.cargoTotal() : 0;
    h += '<div class="sec">平台货舱（轨道货运）</div>';
    h += row('货舱', cargoTotal + ' / ' + (e.hubCargoCap ? e.hubCargoCap() : 50), 'output');
    const ckeys = Object.keys(e.cargo || {}).filter(k => (e.cargo[k] || 0) > 0);
    if (ckeys.length) {
      for (const k of ckeys) {
        h += '<div class="row">' + (ITEMS[k] ? ITEMS[k].name : k) + ' ×' + e.cargo[k] +
          ' <button data-action="hub-cargo-take" data-id="' + k + '">取出</button></div>';
      }
    } else {
      h += '<div class="dim">货舱为空：可把平台产物或任意物品装入，派发到其它星球轨道。</div>';
    }
    // 装载当前选中物品（点击左栏背包物品后）
    h += '<div class="dim">先点击左栏背包物品，再点「装入货舱」。</div>';
    h += '<button data-action="hub-cargo-load" data-id="__held__">装入货舱（选中物品 ×1）</button>';
    // 目标星球
    const curPlanet = (typeof planetId === 'function') ? planetId() : 'nauvis';
    h += '<div class="row">目标星球 <select data-action="hub-cargo-target" style="margin:2px 0 6px;max-width:100%">';
    for (const po of (typeof PLANET_OPTIONS !== 'undefined' ? PLANET_OPTIONS : [])) {
      if (po.v === curPlanet) continue;
      const sel = e.cargoTarget === po.v ? ' selected' : '';
      h += '<option value="' + po.v + '"' + sel + '>' + po.name + '</option>';
    }
    h += '</select></div>';
    h += '<button data-action="hub-cargo-dispatch">🚀 派发货物到目标星球</button>';
  }
  h += circuitPanelHtml(e, 'hub');
  return h;
}

function hubPanelLive(e, api) {
  if (e.circuitCond && e.circuitCond.enabled && !e.circuitEnabled()) { api.status('已暂停：电路条件不满足', 'warn'); return; }
  api.set('power', powerStatusLiveHtml(e));
  api.set('input', Object.keys(e.inp).length ? countStr(e.inp) : dimSpan('空'));
  api.set('output', Object.keys(e.outp).length ? countStr(e.outp) : dimSpan('空'));
  const n = Object.values(e.outp).reduce((a, b) => a + b, 0);
  api.toggle('#btn-takeout', n > 0, '取回全部输出 (' + n + ')');
  api.prog(e.recipe && e.crafting ? e.prog / RECIPES[e.recipe].time * 100 : 0, e.recipe ? RECIPES[e.recipe].time : 0);
  if (!e.recipe) { api.status('未设置配方，点击下方选择', 'warn'); return; }
  if (e.crafting) { api.status('生产中：' + ITEMS[Object.keys(RECIPES[e.recipe].out)[0]].name, 'ok'); return; }
  if (G.power.sat <= 0) { api.status('已暂停：缺电', 'bad'); return; }
  for (const k in RECIPES[e.recipe].out)
    if ((e.outp[k] || 0) + RECIPES[e.recipe].out[k] > 50) { api.status('已暂停：输出已满（' + ITEMS[k].name + '）', 'warn'); return; }
  const missing = Object.keys(RECIPES[e.recipe].inp).filter(k => (e.inp[k] || 0) < RECIPES[e.recipe].inp[k]);
  if (missing.length) { api.status('已暂停：缺少原料 ' + missing.map(k => ITEMS[k].name).join('、'), 'warn'); return; }
  api.status('已暂停：等待材料就绪', 'warn');
}
function hubTip(e) {
  const base = e.recipe ? ('生产 ' + ITEMS[Object.keys(RECIPES[e.recipe].out)[0]].name) : '未设置配方，点击打开面板';
  const s = powerStatusOf(e);
  if (s.consuming && s.sat < 1) return base + '；' + (s.sat > 0 ? '电量不足' + Math.round(s.sat * 100) + '%' : '缺电停摆');
  return base;
}

// ===== 面板：推进器 =====
function thrusterPanelHtml(e) {
  let h = row('推进器燃料', e.fuelBuf.toFixed(0) + ' / ' + THRUSTER_FUEL_BUF, 'input');
  h += row('推进器氧化剂', e.oxidBuf.toFixed(0) + ' / ' + THRUSTER_OXID_BUF, 'input');
  h += row('当前发电', (e.powerOut || 0).toFixed(0) + ' kW', 'power');
  h += row('状态', e.on ? '<span class="ok">推进中</span>' : (e.fuelBuf < 1 ? '<span class="dim">缺少推进器燃料</span>' : (e.oxidBuf < 1 ? '<span class="dim">缺少推进器氧化剂</span>' : '<span class="dim">待机</span>')));
  h += '<div class="dim">推进器：燃烧推进器燃料与推进器氧化剂产生推力/电能（4×8），满功率发电 ' + THRUSTER_POWER + ' kW。需通过管道同时输入两种推进流体，选中后按 R 旋转朝向。</div>';
  return h;
}
function thrusterPanelLive(e, api) {
  api.set('input', e.fuelBuf.toFixed(0) + ' / ' + THRUSTER_FUEL_BUF);
  api.set('output', e.oxidBuf.toFixed(0) + ' / ' + THRUSTER_OXID_BUF);
  api.set('power', (e.powerOut || 0).toFixed(0) + ' kW');
}
function thrusterTip(e) {
  if (!e.on) return e.fuelBuf < 1 ? '缺少推进器燃料' : (e.oxidBuf < 1 ? '缺少推进器氧化剂' : '待机');
  return '推进中：发电 ' + (e.powerOut || 0).toFixed(0) + ' kW';
}

// ===== 面板：小行星收集器 =====
function collectorPanelHtml(e) {
  let total = 0;
  for (const k in e.buf) total += e.buf[k];
  let h = row('已收集星块', total + ' / ' + ASTEROID_COLLECT_CAP, 'output');
  for (const k in e.buf) h += '<span class="dim">' + ITEMS[k].name + ' ×' + e.buf[k] + '</span> ';
  h += row('下次收集', total >= ASTEROID_COLLECT_CAP ? '已满' : Math.ceil(ASTEROID_COLLECT_TIME - e.timer) + ' 秒', 'info');
  h += '<div class="dim">小行星收集器：在轨道上持续收集小行星碎块（金属/碳质/氧化），供破碎机粉碎加工。收集满后需取出星块。</div>';
  return h;
}
function collectorPanelLive(e, api) {
  let total = 0;
  for (const k in e.buf) total += e.buf[k];
  api.set('output', total + ' / ' + ASTEROID_COLLECT_CAP);
  api.set('info', total >= ASTEROID_COLLECT_CAP ? '已满' : Math.ceil(ASTEROID_COLLECT_TIME - e.timer) + ' 秒');
}
function collectorTip(e) {
  let total = 0;
  for (const k in e.buf) total += e.buf[k];
  if (total >= ASTEROID_COLLECT_CAP) return '收集已满：取出星块';
  return '收集中：' + total + '/' + ASTEROID_COLLECT_CAP;
}

// ===== 注册 =====
ENT_CLASSES['space-platform-hub'] = SpacePlatformHub;
DEVICE_RENDER['space-platform-hub'] = drawSpacePlatformHub;
DEVICE_STATUS['space-platform-hub'] = e => {
  const s = powerStatusOf(e);
  if (s.consuming) return s.color;
  return e.recipe ? (e.crafting || e.prog > 0 ? 'g' : 'y') : 'r';
};
DEVICE_PANEL['space-platform-hub'] = { html: hubPanelHtml, live: hubPanelLive, tip: hubTip, onAction: (a) => circuitPanelAction('hub', a) };
DEVICE_DIR_ROTATE['space-platform-hub'] = true;

ENT_CLASSES['thruster'] = Thruster;
DEVICE_RENDER['thruster'] = drawThruster;
DEVICE_STATUS['thruster'] = e => e.on ? 'g' : 'y';
DEVICE_PANEL['thruster'] = { html: thrusterPanelHtml, live: thrusterPanelLive, tip: thrusterTip };
DEVICE_DIR_ROTATE['thruster'] = true;

ENT_CLASSES['asteroid-collector'] = AsteroidCollector;
DEVICE_RENDER['asteroid-collector'] = drawAsteroidCollector;
DEVICE_STATUS['asteroid-collector'] = e => {
  let total = 0; for (const k in e.buf) total += e.buf[k];
  return total >= ASTEROID_COLLECT_CAP ? 'y' : 'g';
};
DEVICE_PANEL['asteroid-collector'] = { html: collectorPanelHtml, live: collectorPanelLive, tip: collectorTip };
