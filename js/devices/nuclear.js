'use strict';

// ===== 核反应堆粒子（画面优化）：运行时光晕与蒸汽 =====
function reactorEmit(e, dt) {
  if (typeof spawnSteam !== 'function' || typeof spawnSpark !== 'function') return;
  const key = 'r' + e.x + ',' + e.y;
  if (!G.entFxTimer) G.entFxTimer = {};
  G.entFxTimer[key] = (G.entFxTimer[key] || 0) + dt;
  if (G.entFxTimer[key] < 0.3) return;
  G.entFxTimer[key] = 0;
  const cx = (e.x + 0.5) * TILE;
  const cy = (e.y + 0.25) * TILE;
  spawnSteam(cx + (Math.random() - 0.5) * e.w * TILE * 0.5, cy, { size: 5, color: '#b8e8d8' });
  if (Math.random() < 0.4) spawnSpark(cx + (Math.random() - 0.5) * e.w * TILE * 0.5, cy + 6, { speed: 1, color: '#9affa0' });
}

// ===== 核能发电体系（对齐《异星工厂》核动力）=====
// 完整链路：铀矿（远处生成）→ 电采矿机开采 → 离心机处理成铀-235/238
//   → 铀-235 组装成铀燃料棒 → 核反应堆（耗铀燃料棒）产出热量
//   → 汽轮机（远高于蒸汽机的功率）发电。
// 反应堆复用锅炉的“水 → 蒸汽”管道模型（底边出汽口接管道/汽轮机），
// 汽轮机复用蒸汽机的“蒸汽 → 电力”模型，但功率与耗汽量远高。

// ===================== 离心机（2×2，吃电力）=====================
// 铀浓缩处理：10 铀矿 → 概率 0.7% 铀-235 / 99.3% 铀-238；或执行 Kovarex 铀增殖循环。
class Centrifuge extends Entity {
  constructor(type, x, y) {
    super(type || 'centrifuge', x, y);
    this.recipe = null;      // 当前配方 id：'uranium-processing' 或 'kovarex'
    this.inp = {};           // 已投入的原料
    this.outp = {};          // 已产出待取
    this.crafting = false;
    this.prog = 0;
    this.spin = 0;
    this.modules = {};       // 离心机可装 2 个模块（对齐《异星工厂》Centrifuge）
    this.prodBuf = 0;        // 产能模块累积进度
    // 电路控制（对齐《异星工厂》：生产建筑可接入电路网络，按信号条件启用/禁用配方）
    this.circuitCond = { enabled: false, channel: 'red', sig: 'iron-plate', op: '>', count: 1 };
  }
  // 电路启停：未启用条件时恒工作；启用后仅当附近电路信号满足条件才生产
  circuitEnabled() {
    if (!this.circuitCond || !this.circuitCond.enabled) return true;
    const sig = circuitSignalNear(this);
    return circuitCondOk(sig, this.circuitCond);
  }
  moduleSlotCount() { return GAME_DATA.deviceStats?.[this.type]?.moduleSlots ?? 2; } // 对齐《异星工厂》官方 module_slots：离心机 2 槽
  moduleSpeedMult() {
    const mc = moduleCounts(this.modules);
    const bb = (typeof beaconBonus === 'function') ? beaconBonus(this.x, this.y) : null;
    if (bb) { mc.speed += bb.speed; mc.prod += bb.prod; mc.eff += bb.eff; }
    return 1 + 0.4 * mc.speed - 0.1 * mc.prod - 0.03 * mc.eff - mc.qualityPenalty;
  }
  applyProductivity(rec) {
    const mc = moduleCounts(this.modules);
    const bb = (typeof beaconBonus === 'function') ? beaconBonus(this.x, this.y) : null;
    let nProd = mc.prod;
    if (bb) nProd += bb.prod;
    if (nProd <= 0) return 0;
    const thr = moduleProdThreshold(this.modules);
    this.prodBuf = (this.prodBuf || 0) + nProd;
    if (this.prodBuf >= thr) {
      this.prodBuf -= thr;
      // 主产出：普通配方取 out 首项；概率配方（铀浓缩）取概率最高的产物（铀-238）
      const mainOut = rec ? (rec.prob ? Object.keys(rec.prob).sort((a, b) => rec.prob[b] - rec.prob[a])[0] : Object.keys(rec.out)[0]) : null;
      if (mainOut) { this.outp[mainOut] = (this.outp[mainOut] || 0) + 1; if (typeof trackProd === 'function') trackProd(mainOut, 1); }
      return 1;
    }
    return 0;
  }
  modulePowerFactor() {
    const mc = moduleCounts(this.modules);
    const bb = (typeof beaconBonus === 'function') ? beaconBonus(this.x, this.y) : null;
    if (bb) { mc.speed += bb.speed; mc.prod += bb.prod; mc.eff += bb.eff; }
    const effMult = Math.max(0.2, 1 - 0.15 * mc.eff);
    const powMult = 1 + (mc.speed * 0.25 + mc.prod * 0.25);
    return powMult * effMult;
  }
  recipeObj() {
    if (!this.recipe) return null;
    if (this.recipe === 'kovarex') return RECIPES['kovarex'];
    return CENTRIFUGE_RECIPES[this.recipe];
  }
  update(dt) {
    if (!this.recipe) { this.crafting = false; return; }
    if (G.power.sat <= 0) { this.crafting = false; return; }
    // 电路条件不满足时暂停生产（对齐《异星工厂》：电路控制配方启停）
    if (!this.circuitEnabled()) { this.crafting = false; return; }
    const rec = this.recipeObj();
    if (!rec) { this.crafting = false; return; }
    if (this.crafting) {
      this.prog += dt * 1 * this.moduleSpeedMult() * powerFactor();
      this.spin += dt * 10;
      if (this.prog >= rec.time) {
        if (rec.prob) {
          // 概率产出（铀浓缩）：按概率随机产出 1 件铀（0.7% 铀-235，99.3% 铀-238）
          let r = Math.random();
          let chosen = null;
          for (const k in rec.prob) {
            r -= rec.prob[k];
            if (r < 0) { chosen = k; break; }
          }
          if (!chosen) chosen = Object.keys(rec.prob)[0];
          this.outp[chosen] = (this.outp[chosen] || 0) + 1;
          if (typeof trackProd === 'function') trackProd(chosen, 1);
        } else {
          for (const k in rec.out) {
            this.outp[k] = (this.outp[k] || 0) + rec.out[k];
            if (typeof trackProd === 'function') trackProd(k, rec.out[k]);
          }
        }
        this.applyProductivity(rec);
        this.crafting = false;
        this.prog = 0;
      }
      return;
    }
    // 原料不足则等
    for (const k in rec.inp) if ((this.inp[k] || 0) < rec.inp[k]) return;
    // 产出容量检查：普通配方按各项独立容量；概率配方（每周期只产 1 件）按总容量
    if (rec.prob) {
      let total = 0;
      for (const k in this.outp) total += this.outp[k];
      if (total >= 50) return;
    } else {
      for (const k in rec.out) if ((this.outp[k] || 0) + rec.out[k] > 50) return;
    }
    for (const k in rec.inp) {
      this.inp[k] -= rec.inp[k];
      if (typeof trackProd === 'function') trackProd(k, -rec.inp[k]);
      if (this.inp[k] <= 0) delete this.inp[k];
    }
    this.crafting = true;
    this.prog = 0;
  }
  powerDemand() {
    return this.recipe ? POWER_USE['centrifuge'] * this.modulePowerFactor() : 0;
  }
  setRecipe(id) {
    if (this.recipe === id) return;
    // 切换配方前返还已投入/已产出物料（对齐《异星工厂》：切换配方返还残留）
    if (this.inp || this.outp) returnMachineContents(this);
    this.recipe = id;
    this.inp = {}; this.outp = {};
    this.crafting = false; this.prog = 0;
  }
  giveItem(item) {
    if (isModule(item)) {
      // 模块槽位限制（对齐《异星工厂》：离心机 2 槽）
      if ((this.modules[item] || 0) >= this.moduleSlotCount()) return false;
      this.modules[item] = (this.modules[item] || 0) + 1;
      if (typeof playSfx === 'function') playSfx('module');
      return true;
    }
    if (!this.recipe) return false;
    const rec = this.recipeObj();
    if (!rec || !rec.inp[item]) return false;
    if ((this.inp[item] || 0) >= rec.inp[item] * 2) return false;
    this.inp[item] = (this.inp[item] || 0) + 1;
    return true;
  }
  peekItem() { for (const k in this.outp) if (this.outp[k] > 0) return k; return null; }
  takeItem() { for (const k in this.outp) if (this.outp[k] > 0) { this.outp[k]--; if (this.outp[k] <= 0) delete this.outp[k]; return k; } return null; }
  countOf(item) { return this.outp[item] || 0; }
  takeItemOf(item) { if (this.outp[item] > 0) { this.outp[item]--; if (this.outp[item] <= 0) delete this.outp[item]; return item; } return null; }
  takeInputItemOf(item) {
    if ((this.inp[item] || 0) > 0) { this.inp[item]--; if (this.inp[item] <= 0) delete this.inp[item]; return item; }
    return null;
  }
  contents() {
    const list = [[this.type, 1]];
    for (const k in this.outp) if (this.outp[k] > 0) list.push([k, this.outp[k]]);
    for (const k in this.modules) if (this.modules[k] > 0) list.push([k, this.modules[k]]);
    return list;
  }
  takeAll() {
    const rows = [];
    for (const k in this.outp) if (this.outp[k] > 0) { rows.push([k, this.outp[k]]); delete this.outp[k]; }
    return rows;
  }
  serialize() {
    const s = super.serialize();
    s.recipe = this.recipe; s.inp = this.inp; s.outp = this.outp; s.prog = this.prog;
    s.modules = this.modules; s.prodBuf = this.prodBuf;
    if (this.circuitCond) s.circuitCond = this.circuitCond;
    return s;
  }
  blueprint() {
    const s = super.blueprint();
    s.recipe = this.recipe; s.modules = this.modules;
    if (this.circuitCond) s.circuitCond = this.circuitCond;
    return s;
  }
  static restore(s) {
    const c = super.restore(s);
    c.recipe = s.recipe || null; c.inp = s.inp || {}; c.outp = s.outp || {}; c.prog = s.prog || 0;
    c.modules = s.modules || {}; c.prodBuf = s.prodBuf || 0;
    c.circuitCond = s.circuitCond || { enabled: false, channel: 'red', sig: 'iron-plate', op: '>', count: 1 };
    return c;
  }
}
function drawCentrifuge(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w, sh = TILE * e.h;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#5c6a7a';
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 8); ctx.fill();
  ctx.strokeStyle = '#37414e';
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 8); ctx.stroke();
  ctx.fillStyle = '#3f4a58';
  rr(ctx, px + 12, py + 12, s - 24, sh - 24, 6); ctx.fill();
  const cx = px + s / 2, cy = py + sh / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((e.spin || 0) + (e.crafting ? G.time * 3 : 0));
  ctx.fillStyle = e.crafting ? '#bfe8ff' : '#7d8894';
  gearShape(ctx, 0, 0, s * 0.22, s * 0.14, 9);
  ctx.fill();
  ctx.restore();
  // 中央显示当前配方图标；未选配方时不再显示占位图标
  if (portDetailsVisible() && e.recipe && e.recipeObj) {
    const rec = e.recipeObj();
    if (rec) {
      const outId = rec.prob ? Object.keys(rec.prob).sort((a, b) => rec.prob[b] - rec.prob[a])[0] : Object.keys(rec.out)[0];
      if (outId) drawRecipeIconCell(ctx, cx, cy, outId);
    }
  }
  ctx.globalAlpha = 1;
}
function centrifugePanelHtml(e) {
  let h = '';
  const cur = e.recipe;
  for (const rid in CENTRIFUGE_RECIPES) {
    const r = CENTRIFUGE_RECIPES[rid];
    h += '<button data-action="rec" data-id="' + rid + '" class="' + (cur === rid ? 'on' : '') + '">' + r.name + '</button>';
  }
  // 铀增殖处理(Kovarex)：需「铀富集」科技解锁（对齐《异星工厂》Kovarex enrichment process）
  const kovUnlocked = recipeUnlocked('kovarex');
  const kovLock = recipeLockingTech('kovarex');
  h += '<button data-action="rec" data-id="kovarex" class="' + (cur === 'kovarex' ? 'on' : '') + (kovUnlocked ? '' : ' locked-recipe') + '" ' + (kovUnlocked ? '' : 'disabled') + ' title="' + (kovUnlocked ? '铀增殖：持续增产铀-235' : ('🔒 需先研究「' + (kovLock ? TECHS[kovLock].name : '研究') + '」')) + '">铀增殖处理' + (kovUnlocked ? '' : ' 🔒') + '</button>';
  // 当前配方内容：随配方切换同步展示该配方的原料需求与产出（含概率配方）。
  // 用 data-live 容器承载，由 centrifugePanelLive 动态填充，确保切换配方后面板同步刷新。
  h += '<div data-live="rec-info"></div>';
  // 模块槽位（对齐《异星工厂》：离心机可装 2 模块）
  h += modulePanelSection(e);
  h += row('原料', '<span class="dim"></span>', 'inp');
  h += row('产出', '<span class="dim"></span>', 'out');
  h += row('电力', powerStatusLiveHtml(e), 'power');
  h += barHtml(0);
  h += '<div class="status"></div>';
  h += '<div class="dim">离心机：铀浓缩把铀矿分离成铀-235（0.7%）/铀-238（99.3%）。铀-235 在组装机制成核燃料；也可用铀增殖循环持续增产铀-235。原料由机械臂/传送带放入，产出由机械臂取出。可装 2 个模块（速度/产能/效率）并受信号塔加成。</div>';
  h += circuitPanelHtml(e, 'cen');
  return h;
}
function centrifugePanelLive(e, api) {
  if (e.circuitCond && e.circuitCond.enabled && !e.circuitEnabled()) { api.status('已暂停：电路条件不满足', 'warn'); return; }
  // 当前配方信息（耗时/原料/产出，含概率配方）：动态填充，随配方切换实时刷新
  const curRec = e.recipeObj && e.recipeObj();
  if (curRec) {
    const curNm = CENTRIFUGE_RECIPES[e.recipe] ? localizedName(e.recipe, CENTRIFUGE_RECIPES[e.recipe].name) : (e.recipe === 'kovarex' ? localizedName('kovarex', '铀增殖处理') : '');
    let info = '<div class="sec">当前配方 · ' + curNm + '</div>';
    info += '<div class="dim">每周期耗时 ' + curRec.time + ' 秒</div>';
    info += '<div class="dim">所需原料：</div>';
    for (const k in curRec.inp) info += '<div class="mach-rate">' + chip(k, curRec.inp[k]) + '</div>';
    info += '<div class="dim">' + (curRec.prob ? '概率产出（每周期随机 1 件）：' : '产出：') + '</div>';
    if (curRec.prob) {
      for (const k in curRec.prob) info += '<div class="mach-rate">' + chip(k) + '（' + (curRec.prob[k] * 100).toFixed(2) + '%）</div>';
    } else {
      for (const k in curRec.out) info += '<div class="mach-rate">' + chip(k, curRec.out[k]) + '</div>';
    }
    api.set('rec-info', info);
  } else {
    api.set('rec-info', '');
  }
  api.set('power', powerStatusLiveHtml(e));
  let inp = '';
  for (const k in e.inp) if (e.inp[k] > 0) inp += chip(k, e.inp[k]);
  api.set('inp', inp || dimSpan('空'));
  let out = '';
  for (const k in e.outp) if (e.outp[k] > 0) out += chip(k, e.outp[k]);
  api.set('out', out || dimSpan('空'));
  const rec = e.recipeObj();
  if (!rec) api.status('未选择配方', 'warn');
  else if (e.crafting) api.status('处理中', 'ok');
  else {
    let missing = null;
    for (const k in rec.inp) if ((e.inp[k] || 0) < rec.inp[k]) { missing = ITEMS[k].name; break; }
    api.status(missing ? ('原料不足：' + missing) : '已就绪', missing ? 'warn' : 'ok');
  }
  if (rec && e.crafting) api.prog(e.prog / rec.time * 100, rec.time);
  else api.prog(0);
}
function centrifugeTip(e) {
  if (!e.recipe) return '未选择配方';
  if (e.crafting) return '处理中 ' + Math.round((e.prog / e.recipeObj().time) * 100) + '%';
  const nm = e.recipe === 'kovarex' ? localizedName('kovarex', '铀增殖处理') : (CENTRIFUGE_RECIPES[e.recipe] ? localizedName(e.recipe, CENTRIFUGE_RECIPES[e.recipe].name) : '');
  return (nm || '配方') + '（等待原料）';
}

// ===== 官方 Heat buffer 传导算法（对齐 factorio-data）=====
// 两个相邻 heat 设备之间按温度差传导：从高温流向低温，传递能量使双方温度趋于平衡，
// 每 tick 传递量受双方较小 max_transfer 限制，且不超过热源可用能量与目标剩余容量。
// 单位：能量 MJ、比热 MJ/°C、最大传热 MW、温度 °C。
function heatTransfer(from, to, dt) {
  const fT = from.temperature();
  const tT = to.temperature();
  if (fT <= tT) return;
  const dT = fT - tT;
  const fSH = from.specificHeat();
  const tSH = to.specificHeat();
  // 使双方温度恰好平衡所需传递的能量：dT = e/fSH + e/tSH → e = dT / (1/fSH + 1/tSH)
  const toBalance = dT / (1 / fSH + 1 / tSH);
  const maxXfer = Math.min(from.maxTransfer(), to.maxTransfer());
  const want = Math.min(maxXfer * dt, toBalance, from.heatEnergy, to.maxEnergy() - to.heatEnergy);
  if (want <= 0) return;
  from.heatEnergy -= want;
  to.heatEnergy += want;
}

// ===================== 核反应堆（5×5，吃铀燃料棒）=====================
// 复用锅炉的“水→蒸汽”模型：铀燃料棒燃烧把水加热成高温蒸汽，经底边出汽口排出。
// 产汽能力远超锅炉：同耗水量下产出更多蒸汽，供多台汽轮机满载。
class NuclearReactor extends Entity {
  constructor(type, x, y) {
    super('nuclear-reactor', x, y);
    this.fuel = 0;          // 铀燃料棒组数（燃料槽）
    this.burnLeft = 0;      // 当前燃料剩余燃烧秒数
    this.heatEnergy = 0;    // 内部热量能量(MJ)，温度 = heatEnergy / specificHeat（对齐官方 heat_buffer 存能量）
    this.burning = false;
    this.lit = false;
    this.spent = 0;         // 已燃尽的贫化铀燃料棒（可被机械臂取走再生成铀-238）
  }
  // ===== 官方 Heat buffer 接口 =====
  specificHeat() { return REACTOR_SPECIFIC_HEAT; }   // 10MJ/°C（官方）
  maxTransfer() { return REACTOR_MAX_TRANSFER; }     // 10GW（官方）
  maxEnergy() { return HEAT_MAX_TEMP * this.specificHeat(); }
  temperature() { return this.heatEnergy / this.specificHeat(); }
  heatCap() { return this.maxEnergy(); }
  // 两侧水口（保留兼容旧布局：热交换器独立进水，反应堆本身不再耗水）
  isWaterPortCell(cx, cy) {
    const r = this.y + this.h - 1;
    return cy === r && (cx === this.x - 1 || cx === this.x + this.w);
  }
  acceptsPumpFeed(cx, cy, fromDir) {
    const r = this.y + this.h - 1;
    if (cy !== r) return false;
    if (cx === this.x) return fromDir === 0;
    if (cx === this.x + this.w - 1) return fromDir === 2;
    return false;
  }
  update(dt) {
    this.burning = false;
    // 向相邻导热管/热交换器传导热量
    this.heatFlow(dt);
    // 消耗燃料：只要还有燃料棒，反应堆就一直以固定速率燃烧，无视热量是否存满
    // （对齐《异星工厂》：核反应堆无视电网负载与温度，每个燃料棒总会在 200 秒内燃尽，不会因热量满而暂停）
    if (this.burnLeft <= 0 && this.fuel > 0) {
      this.fuel--;
      if (typeof trackProd === 'function') trackProd('uranium-fuel-cell', -1);
      // 燃尽一根铀燃料棒 → 产生一根贫化铀燃料棒（核燃料循环闭环）
      this.spent++;
      if (typeof trackProd === 'function') trackProd('depleted-uranium-fuel-cell', 1);
      this.burnLeft += REACTOR_FUEL_ENERGY;
    }
    if (this.burnLeft <= 0) { this.lit = false; return; }
    this.lit = true;
    this.burning = true;
    reactorEmit(this, dt);
    this.burnLeft -= dt;
    // 核反应堆相邻加成（对齐《异星工厂》：每个相邻反应堆使输出 +100%，鼓励多堆并排布局）
    const neighbors = this.neighborCount();
    const rate = REACTOR_HEAT_RATE * (1 + neighbors); // 热功率(MW)，官方每堆 40MW，相邻 +100%
    // 产热存进 heat buffer：达到最高温度(1000°C)后能量存满、多余白白流失（对齐官方热容上限）
    this.heatEnergy = Math.min(this.maxEnergy(), this.heatEnergy + rate * dt);
  }
  // 热量传导：把热量输送给相邻的导热管/热交换器（官方算法：按温度差，从高温流向低温，受双方 max_transfer 限制）
  heatFlow(dt) {
    if (this.temperature() <= 0) return;
    forEachNeighborEnt(this, n => {
      if (n._dead) return;
      const isHeatSink = (n instanceof HeatPipe) || (n instanceof HeatExchanger);
      if (!isHeatSink) return;
      if (this.temperature() <= n.temperature()) return;
      heatTransfer(this, n, dt);
    });
  }
  // 统计正交相邻（含自身周边）的核反应堆数量（用于相邻加成）
  neighborCount() {
    let n = 0;
    const seen = new Set();
    // 反应堆周围一圈的相邻格
    for (let dy = -1; dy <= this.h; dy++) {
      for (let dx = -1; dx <= this.w; dx++) {
        const inX = dx >= 0 && dx < this.w, inY = dy >= 0 && dy < this.h;
        if (inX && inY) continue;         // 自身内部
        if (!inX && !inY) continue;       // 斜角不算
        const t = entAt(this.x + dx, this.y + dy);
        if (t && !t._dead && t.type === 'nuclear-reactor' && !seen.has(t)) { seen.add(t); n++; }
      }
    }
    return n;
  }
  giveItem(item) {
    // 反应堆仅接受铀燃料棒（对齐《异星工厂》：反应堆消耗 Uranium fuel cell 而非 Nuclear fuel）
    if (item === 'uranium-fuel-cell' && this.fuel < 5) { this.fuel++; return true; }
    return false;
  }
  peekItem() {
    if (this.spent > 0) return 'depleted-uranium-fuel-cell';
    return null;
  }
  takeItem() {
    if (this.spent > 0) { this.spent--; return 'depleted-uranium-fuel-cell'; }
    return null;
  }
  countOf(item) { return item === 'depleted-uranium-fuel-cell' ? this.spent : 0; }
  takeItemOf(item) {
    if (item === 'depleted-uranium-fuel-cell' && this.spent > 0) { this.spent--; return item; }
    return null;
  }
  // 面板“取回全部”：退回贫化铀燃料棒（核燃料不参与）
  takeAll() {
    const rows = [];
    if (this.spent > 0) { rows.push(['depleted-uranium-fuel-cell', this.spent]); this.spent = 0; }
    return rows;
  }
  contents() {
    const list = [[this.type, 1]];
    if (this.fuel > 0) list.push(['uranium-fuel-cell', this.fuel]);
    if (this.spent > 0) list.push(['depleted-uranium-fuel-cell', this.spent]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.fuel = this.fuel; s.burnLeft = this.burnLeft; s.heatEnergy = this.heatEnergy;
    s.spent = this.spent;
    return s;
  }
  static restore(s) {
    const r = super.restore(s);
    r.fuel = s.fuel || 0; r.burnLeft = s.burnLeft || 0; r.heatEnergy = s.heatEnergy || 0;
    r.spent = s.spent || 0;
    return r;
  }
}
function drawNuclearReactor(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const w = TILE * e.w, h = TILE * e.h;
  ctx.globalAlpha = alpha;
  // 底座
  ctx.fillStyle = '#2e3a2e';
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 10); ctx.fill();
  ctx.strokeStyle = '#18211a';
  ctx.lineWidth = 4;
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 10); ctx.stroke();
  // 反应堆穹顶
  ctx.fillStyle = e.burning ? '#3f7a4a' : '#4a5a4a';
  ctx.beginPath();
  ctx.arc(px + w / 2, py + h * 0.5, w * 0.28, 0, 7);
  ctx.fill();
  ctx.strokeStyle = '#1c2a1c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(px + w / 2, py + h * 0.5, w * 0.28, 0, 7);
  ctx.stroke();
  // 芯部辉光（运行中）
  if (e.burning) {
    const gl = 0.5 + Math.sin(G.time * 6) * 0.25;
    ctx.fillStyle = 'rgba(143,224,143,' + (0.3 + gl * 0.3).toFixed(2) + ')';
    ctx.beginPath();
    ctx.arc(px + w / 2, py + h * 0.5, w * 0.14, 0, 7);
    ctx.fill();
  }
  // 辐射标记
  ctx.strokeStyle = e.burning ? '#bff0bf' : '#8a9a8a';
  ctx.lineWidth = 3;
  const cxp = px + w / 2, cyp = py + h * 0.5;
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + i * Math.PI * 2 / 3;
    ctx.beginPath();
    ctx.moveTo(cxp, cyp);
    ctx.lineTo(cxp + Math.cos(a) * w * 0.18, cyp + Math.sin(a) * w * 0.18);
    ctx.stroke();
  }
  // 燃料槽
  const fp = Math.min(1, e.burnLeft / REACTOR_FUEL_ENERGY);
  ctx.fillStyle = '#20242b';
  rr(ctx, px + 12, py + h - 14, w - 24, 6, 3); ctx.fill();
  ctx.fillStyle = fp > 0 ? '#9ae06a' : '#5a6a5a';
  rr(ctx, px + 12, py + h - 14, (w - 24) * fp, 6, 3); ctx.fill();
  // 热量条（替代原水位条，按温度 / 最高温度 1000°C）
  const wPct = Math.max(0, Math.min(1, e.temperature() / HEAT_MAX_TEMP));
  ctx.fillStyle = '#20242b';
  rr(ctx, px + 12, py + h - 22, w - 24, 6, 3); ctx.fill();
  ctx.fillStyle = wPct > 0 ? '#d98a3a' : '#6a5a3a';
  rr(ctx, px + 12, py + h - 22, (w - 24) * wPct, 6, 3); ctx.fill();
  // 热量出口（黄色线标注，与热交换器热交换接口同款样式）
  // 对齐官方 heat_buffer.connections：核反应堆四边（北/东/南/西）各 3 个热交换接口，
  // 5 格边中仅第 1/3/5 格（相对中心 -2/0/+2）有接口，而非整条边均布。
  ctx.strokeStyle = '#ffd23a';
  ctx.lineWidth = 3;
  const cRx = px + w / 2, cRy = py + h / 2;   // 反应堆中心
  const hC = [ -2 * TILE, 0, 2 * TILE ];      // 每条边 3 个连接点（相对中心）
  // 上边（北）
  for (const dx of hC) {
    ctx.beginPath();
    ctx.moveTo(cRx + dx - TILE * 0.22, py + 3);
    ctx.lineTo(cRx + dx + TILE * 0.22, py + 3);
    ctx.stroke();
  }
  // 下边（南）
  for (const dx of hC) {
    ctx.beginPath();
    ctx.moveTo(cRx + dx - TILE * 0.22, py + h - 3);
    ctx.lineTo(cRx + dx + TILE * 0.22, py + h - 3);
    ctx.stroke();
  }
  // 左边（西）
  for (const dy of hC) {
    ctx.beginPath();
    ctx.moveTo(px + 3, cRy + dy - TILE * 0.22);
    ctx.lineTo(px + 3, cRy + dy + TILE * 0.22);
    ctx.stroke();
  }
  // 右边（东）
  for (const dy of hC) {
    ctx.beginPath();
    ctx.moveTo(px + w - 3, cRy + dy - TILE * 0.22);
    ctx.lineTo(px + w - 3, cRy + dy + TILE * 0.22);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function reactorPanelHtml(e) {
  let h = row('铀燃料棒', e.fuel > 0 ? chip('uranium-fuel-cell', e.fuel) : '<span class="dim">无</span>', 'fuel');
  if (invCount('uranium-fuel-cell') > 0)
    h += '<button data-action="fuel" data-id="uranium-fuel-cell">装入铀燃料棒 (' + invCount('uranium-fuel-cell') + ')</button>';
  h += row('贫化铀燃料棒', '<span class="dim"></span>', 'spent');
  h += '<button data-action="takeout" id="btn-spent-takeout" style="display:none"></button>';
  h += row('堆芯温度', '', 'heat');
  h += row('堆芯温度上限', '', 'temp');
  h += barHtml(0);
  h += '<div class="status"></div>';
  h += '<div class="dim">核反应堆：消耗铀燃料棒产生巨量热量，经四边（北/东/南/西）黄色热量接口传给导热管（对齐官方 heat_buffer.connections，每条 5 格边仅中间 3 格有热交换接口，非整条边均布，可向导热管/热交换器传热），再由导热管把热量送到热交换器，由热交换器把水烧成高温蒸汽供汽轮机发电（对齐《异星工厂》核能标准链路，反应堆仅消耗铀燃料棒而非核燃料）。燃尽的燃料会留下贫化铀燃料棒，可在离心机再生为铀-238，闭合核燃料循环。核能技术解锁。</div>';
  h += '<div class="dim">💡 相邻加成：并排摆放多座反应堆，每座相邻反应堆使输出 +100%（对齐《异星工厂》）。</div>';
  h += '<div class="dim">🔗 标准接法：反应堆→(导热管)→热交换器（接水管）→(蒸汽管)→汽轮机</div>';
  return h;
}
function reactorPanelLive(e, api) {
  api.set('fuel', e.fuel > 0 ? chip('uranium-fuel-cell', e.fuel) : dimSpan('无'));
  api.set('spent', e.spent > 0 ? chip('depleted-uranium-fuel-cell', e.spent) : dimSpan('无'));
  api.toggle('#btn-spent-takeout', e.spent > 0, '取回贫化铀燃料棒 (' + e.spent + ')');
  const _temp = e.temperature();
  api.set('heat', _temp >= 1 ? chip('heat-pipe', Math.round(_temp) + '°C') : dimSpan('空'));
  api.set('temp', Math.round(_temp) + ' / 1000 °C');
  api.prog(Math.min(100, _temp / HEAT_MAX_TEMP * 100));
  if (e.burning) api.status('运行中：产热 ' + REACTOR_HEAT_RATE + 'MW' + (_temp >= HEAT_MAX_TEMP - 1 ? '（已达最高温，多余热量流失）' : ''), 'ok');
  else if (e.fuel <= 0 && e.burnLeft <= 0) api.status('已暂停：无铀燃料棒', 'bad');
  else api.status('已暂停：待机', 'warn');
}
function reactorTip(e) {
  if (e.burning) return '运行中 ' + Math.round(e.temperature()) + '°C';
  return (e.fuel <= 0 && e.burnLeft <= 0) ? '无铀燃料棒' : '待机';
}

// ===================== 汽轮机（5×3，耗蒸汽→发电）=====================
// 复用蒸汽机的“蒸汽→电力”模型，但功率与耗汽量远高（对齐《异星工厂》5.8MW）。
// 窄边(3)中部设管道出口：接蒸汽（来自热交换器/蒸汽管道），与热交换器上边(北)出汽口用蒸汽管对接。
class SteamTurbine extends Entity {
  constructor(type, x, y) {
    super('steam-turbine', x, y);
    this.spin = 0;
    this.on = false;
    this.outMult = 0;
    this.powerOut = 0;
    this.steamBuf = 0;
  }
  applyDir() { if (this.dir % 2 === 1) { this.w = this.def.h; this.h = this.def.w; } }
  update(dt) {
    this.portFlow();
    const want = TURBINE_STEAM_RATE * dt;
    const took = Math.min(want, this.steamBuf);
    this.steamBuf -= took;
    const inst = want > 1e-9 ? Math.min(1, took / want) : 0;
    this.outMult += (inst - this.outMult) * Math.min(1, dt * 6);
    if (this.outMult < 0.005) this.outMult = 0;
    this.powerOut = POWER_PER_TURBINE * this.outMult;
    this.on = this.powerOut > 0.05;
    if (this.on) this.spin += dt * 10 * (0.35 + 0.65 * this.outMult);
    if (typeof regPowerEnt === 'function') regPowerEnt(this);
  }
  // 窄边(3)中部汽口：上/下两端中部各一只通用汽口，蒸汽可从任一端进入发电（对齐官方：蒸汽入口在南北两侧，随 dir 旋转）
  portFlow() {
    const covers = (n, cx, cy) => cx >= n.x && cx < n.x + n.w && cy >= n.y && cy < n.y + n.h;
    // 默认朝向(0，宽3×高5)下上/下两端中部汽口，随 dir 旋转
    const pN = rotCell(this, this.def.w >> 1, -1);
    const pS = rotCell(this, this.def.w >> 1, this.def.h);
    forEachNeighborEnt(this, n => {
      const topPort = covers(n, pN.x, pN.y);
      const bottomPort = covers(n, pS.x, pS.y);
      const port = topPort || bottomPort;
      if (n instanceof Pipe) {
        if (!port) return;
        if (this.steamBuf < TURBINE_STEAM_CAP - 0.01 && (n.fluid['steam'] || 0) >= 1) {
          n.takeItemOf('steam'); this.steamBuf++;
        }
      } else if (n instanceof SteamTurbine) {
        if (!port) return;
        if (this.steamBuf >= n.steamBuf + 1 && n.steamBuf < TURBINE_STEAM_CAP - 0.01) { this.steamBuf--; n.steamBuf++; }
        else if (n.steamBuf >= this.steamBuf + 1 && this.steamBuf < TURBINE_STEAM_CAP - 0.01) { n.steamBuf--; this.steamBuf++; }
      } else if (n instanceof HeatExchanger) {
        // 热交换器上边(北)出汽口正对汽轮机窄边(3)中部汽口：可直接受汽（对齐官方：标准用蒸汽管，相邻亦可直连）
        if (port && this.steamBuf < TURBINE_STEAM_CAP - 0.01 && n.steamBuf >= 1) { n.steamBuf--; this.steamBuf++; }
      }
    });
  }
  giveItem(item) {
    if (item === 'steam' && this.steamBuf < TURBINE_STEAM_CAP - 0.01) { this.steamBuf = Math.min(TURBINE_STEAM_CAP, this.steamBuf + 1); return true; }
    return false;
  }
  peekItem() { return this.steamBuf >= 1 ? 'steam' : null; }
  takeItem() { if (this.steamBuf >= 1) { this.steamBuf--; return 'steam'; } return null; }
  countOf(item) { return item === 'steam' ? Math.floor(this.steamBuf) : 0; }
  takeItemOf(item) { if (item === 'steam' && this.steamBuf >= 1) { this.steamBuf--; return 'steam'; } return null; }
  contents() {
    const list = [[this.type, 1]];
    if (this.steamBuf >= 1) list.push(['steam', Math.floor(this.steamBuf)]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.steamBuf = this.steamBuf;
    return s;
  }
  static restore(s) {
    const t = super.restore(s);
    t.steamBuf = s.steamBuf || 0;
    return t;
  }
}
function drawSteamTurbine(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const w = TILE * e.w, h = TILE * e.h;
  const om = Math.max(0, Math.min(1, e.outMult || 0));
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#6a7a8a';
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 8); ctx.fill();
  ctx.strokeStyle = '#3c4a58';
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 8); ctx.stroke();
  // 旋转叶片（居中）
  const cx = px + w / 2, cy = py + h * 0.42;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(e.spin || 0);
  ctx.fillStyle = om > 0 ? '#cfe0f0' : '#7d8894';
  gearShape(ctx, 0, 0, TILE * 1.1, TILE * 0.5, 12);
  ctx.fill();
  ctx.restore();
  // 叶片转速示意
  if (om > 0.02) {
    ctx.strokeStyle = 'rgba(200,225,255,.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const t = ((G.time * 4 * om) + i / 4) % 1;
      ctx.beginPath();
      ctx.arc(cx, cy, TILE * 1.6, t * Math.PI * 2 - 0.2, t * Math.PI * 2 + 0.2);
      ctx.stroke();
    }
  }
  // 功率输出
  ctx.fillStyle = om > 0.02 ? '#bff0bf' : '#8a93a0';
  ctx.font = 'bold 10px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText((e.powerOut || 0).toFixed(0) + ' kW', cx, py + h * 0.8);
  // 窄边(3)中部汽口：上/下两端中部各一只通用汽口，蒸汽可进可出，支持多台汽轮机串接（对齐官方：蒸汽入口在南北两侧，随 dir 旋转，画在设备内部边缘）
  const pN = rotCell(e, e.def.w >> 1, 0);
  const pS = rotCell(e, e.def.w >> 1, e.def.h - 1);
  const _d = e.dir | 0;
  const cD = TILE / 2 - 1; // 端口凸缘贴合设备内部边缘
  drawPort(ctx, pN.x * TILE + TILE / 2, pN.y * TILE + TILE / 2, rotSide(3, _d), ITEMS['steam'].color, true, 0, cD, 'steam', 'both');
  drawPort(ctx, pS.x * TILE + TILE / 2, pS.y * TILE + TILE / 2, rotSide(1, _d), ITEMS['steam'].color, true, 0, cD, 'steam', 'both');
  ctx.globalAlpha = 1;
}
function turbinePanelHtml(e) {
  return row('功率输出', '<span class="dim"></span>', 'power') +
    row('蒸汽缓存', '<span class="dim"></span>', 'steam') +
    '<div class="status"></div>' +
    '<div class="dim">汽轮机：上/下两端中部汽口接入高温蒸汽（来自热交换器上边(北)出汽口/蒸汽管道），以远高于蒸汽机的功率发电。核能技术解锁。</div>';
}
function turbinePanelLive(e, api) {
  api.set('power', '+' + (e.powerOut || 0).toFixed(0) + ' kW');
  api.set('steam', e.steamBuf >= 1 ? chip('steam', Math.floor(e.steamBuf)) : dimSpan('空'));
  if (e.on) api.status('发电中：' + (e.powerOut || 0).toFixed(0) + ' kW', 'ok');
  else if (e.steamBuf < 0.5) api.status('已暂停：无高温蒸汽', 'warn');
  else api.status('待机', 'ok');
}
function turbineTip(e) {
  return e.on ? '发电中 ' + (e.powerOut || 0).toFixed(0) + ' kW'
    : e.steamBuf < 0.5 ? '无高温蒸汽（检查上/下两端中部汽口/管道）' : '待机';
}

// ===================== 导热管 Heat Pipe（1×1）=====================
// 对齐《异星工厂》Heat pipe：把核反应堆产生的热量沿路传导到热交换器。
// 相邻导热管会按热差互相传导，可多根串联成导热线路。
class HeatPipe extends Entity {
  constructor(type, x, y) {
    super('heat-pipe', x, y);
    this.heatEnergy = 0;   // 内部热量能量(MJ)，温度 = heatEnergy / specificHeat（对齐官方 heat_buffer）
  }
  // ===== 官方 Heat buffer 接口 =====
  specificHeat() { return HEAT_PIPE_SPECIFIC_HEAT; }   // 1MJ/°C（官方）
  maxTransfer() { return HEAT_PIPE_MAX_TRANSFER; }     // 1GW（官方）
  maxEnergy() { return HEAT_MAX_TEMP * this.specificHeat(); }
  temperature() { return this.heatEnergy / this.specificHeat(); }
  heatCap() { return this.maxEnergy(); }
  update(dt) {
    // 与相邻导热管/热交换器/反应堆按温度差传导（官方算法：高温流向低温）
    this.flow(dt);
  }
  flow(dt) {
    forEachNeighborEnt(this, n => {
      if (n._dead) return;
      const isHeatDev = (n instanceof HeatPipe) || (n instanceof HeatExchanger);
      if (!isHeatDev) return;
      if (this.temperature() <= n.temperature()) return;
      heatTransfer(this, n, dt);
    });
  }
  // 端口：相邻设备显示橙色热量口（用于逻辑判定：可传热）
  isHeatPortCell(cx, cy) {
    return cx === this.x && cy === this.y;
  }
  contents() {
    const list = [[this.type, 1]];
    if (this.temperature() >= 1) list.push(['heat-pipe', Math.round(this.temperature())]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.heatEnergy = this.heatEnergy;
    return s;
  }
  static restore(s) {
    const p = super.restore(s);
    p.heatEnergy = s.heatEnergy || 0;
    return p;
  }
}
function heatPipeConnect(e, dx, dy) {
  // 相邻格是否有可连接的导热设备：导热管全向连接，热源(反应堆/供热塔)连接，热交换器仅其热交换接口格连接
  const nx = e.x + dx, ny = e.y + dy;
  const nb = entAt(nx, ny);
  if (!nb || nb._dead) return false;
  if (nb instanceof HeatPipe) return true;
  if (nb instanceof HeatExchanger) {
    const p = rotCell(nb, nb.def.w >> 1, nb.def.h);   // 热交换接口：默认下边(南)中间
    return p.x === nx && p.y === ny;
  }
  if (nb instanceof NuclearReactor || nb instanceof HeatingTower) return true;
  return false;
}
// 渲染：把方块优化成"管道"效果——相邻导热设备自动连接，L/T/直通路口自动转弯并连通。
function drawHeatPipe(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  // 四向连接检测
  const cn = heatPipeConnect(e, 0, -1);   // 北
  const cs = heatPipeConnect(e, 0, 1);    // 南
  const cw = heatPipeConnect(e, -1, 0);   // 西
  const ce = heatPipeConnect(e, 1, 0);    // 东
  // 温度占比 + 是否达到最低发光温度 350°C（官方 minimum_glow_temperature）
  const temp = e.temperature();
  const hp = Math.max(0, Math.min(1, temp / HEAT_MAX_TEMP));
  const glow = temp >= HEAT_PIPE_MIN_GLOW_TEMP;

  // 管道尺寸：比原实现更细，观感更接近细管道
  const R = 7;      // 管体外半径（原 11，调细）
  const rIn = 3.5;  // 导热芯半径（原 6.5，调细）
  const BORDER_W = 0.75; // 外圈边框线宽（原 1.5，改为 1/2）

  // 连线端点取相邻格中心，让相邻格的管段在连接处完全重合、无缝衔接
  const cnP = [cx, cy - TILE];
  const csP = [cx, cy + TILE];
  const cwP = [cx - TILE, cy];
  const ceP = [cx + TILE, cy];

  // 组装连续管段：对向直通合并为一条，避免在格中心产生截断与凸点，连接更平滑
  const segs = [];
  if (cw && ce) {
    segs.push([cwP[0], cwP[1], ceP[0], ceP[1]]);          // 西—东直通
  } else {
    if (cw) segs.push([cwP[0], cwP[1], cx, cy]);
    if (ce) segs.push([cx, cy, ceP[0], ceP[1]]);
  }
  if (cn && cs) {
    segs.push([cnP[0], cnP[1], csP[0], csP[1]]);          // 北—南直通
  } else {
    if (cn) segs.push([cnP[0], cnP[1], cx, cy]);
    if (cs) segs.push([cx, cy, csP[0], csP[1]]);
  }

  // 是否存在转弯/路口（同时有横、纵连接）→ 需画中心节点把交点填满
  const isJunction = (cn || cs) && (cw || ce);

  // 孤立导热管（四向均无连接）：画成一截细长管道（而非圆点），
  // 让 Q 复制/单根导热管的光标与地图上的管道观感一致（黄色细长管道）。
  if (segs.length === 0) {
    const stubLen = TILE * 0.6;
    segs.push([cx - stubLen, cy, cx + stubLen, cy]);
  }

  ctx.globalAlpha = alpha;
  // ---- 管体外壳（金属）：按连续路径整段描边，连接处不再出现分界环 ----
  ctx.strokeStyle = '#3a3428';
  ctx.lineWidth = R * 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of segs) {
    ctx.beginPath();
    ctx.moveTo(s[0], s[1]);
    ctx.lineTo(s[2], s[3]);
    ctx.stroke();
  }
  // 转弯/路口中心节点
  if (isJunction) {
    ctx.fillStyle = '#3a3428';
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, 7);
    ctx.fill();
  }
  // ---- 外壳描边（外圈边框）：只在导热管自由端绘制，连接处不显示外圈边框，
  //      使相邻导热管在连接处融为一体、不再被边框切割；线宽已按需求减半（原 1.5 → 0.75）----
  ctx.strokeStyle = '#1c1710';
  ctx.lineWidth = BORDER_W;
  // 单方向连接时，导热管中心即自由终端端（对侧为开放端），需画边框
  const connCount = (cn?1:0) + (cs?1:0) + (cw?1:0) + (ce?1:0);
  const centerIsTerminal = connCount === 1;
  for (const s of segs) {
    for (const end of [[s[0], s[1]], [s[2], s[3]]]) {
      const ex = end[0], ey = end[1];
      // 判断该端点是否为"自由端"（未连接方向），连接处/路口不画外圈边框
      let freeEnd;
      if (ex === cx && ey === cy) {
        freeEnd = centerIsTerminal;           // 本格中心：仅单方向连接时才是自由终端端
      } else if (ex < cx) {
        freeEnd = !cw;                        // 西向
      } else if (ex > cx) {
        freeEnd = !ce;                        // 东向
      } else if (ey < cy) {
        freeEnd = !cn;                        // 北向
      } else {
        freeEnd = !cs;                        // 南向
      }
      if (freeEnd) {
        // 单方向连接的自由端在管中心：只描对侧（开放端）半圆，避免在连接侧画圈
        let a0 = 0, a1 = Math.PI * 2;
        if (ex === cx && ey === cy) {
          if (cw)      { a0 = -Math.PI / 2; a1 =  Math.PI / 2;     }  // 西连 → 东侧开放
          else if (ce) { a0 =  Math.PI / 2; a1 =  Math.PI * 3 / 2; }  // 东连 → 西侧开放
          else if (cn) { a0 =  0;           a1 =  Math.PI;         }  // 北连 → 南侧开放
          else if (cs) { a0 =  Math.PI;     a1 =  Math.PI * 2;     }  // 南连 → 北侧开放
        }
        ctx.beginPath();
        ctx.arc(ex, ey, R, a0, a1);
        ctx.stroke();
      }
    }
  }
  // ---- 内芯导热管（达到发光温度才发热变亮）----
  ctx.strokeStyle = glow ? '#e8a14a' : '#5a5245';
  ctx.lineWidth = rIn * 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of segs) {
    ctx.beginPath();
    ctx.moveTo(s[0], s[1]);
    ctx.lineTo(s[2], s[3]);
    ctx.stroke();
  }
  if (isJunction) {
    ctx.fillStyle = glow ? '#e8a14a' : '#5a5245';
    ctx.beginPath();
    ctx.arc(cx, cy, rIn, 0, 7);
    ctx.fill();
  }
  // ---- 发光光晕（达到发光温度时）----
  if (glow) {
    ctx.strokeStyle = 'rgba(255,170,80,' + (0.3 + hp * 0.5).toFixed(2) + ')';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const s of segs) {
      ctx.beginPath();
      ctx.moveTo(s[0], s[1]);
      ctx.lineTo(s[2], s[3]);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}
function heatPipeTip(e) {
  const t = e.temperature();
  return t > 0 ? '导热管 ' + Math.round(t) + '°C' : '导热管（待机）';
}

// ===================== 热交换器 Heat Exchanger（3×2）=====================
// 对齐《异星工厂》Heat exchanger 真实结构（factorio-data：collision_box ±1.29×±0.79）：
//   占地 3×2；左右两侧（西/东）各一只双向水口进水（同一水管网互通），
//   上边（北）中间一只出汽口送出高温蒸汽（独立蒸汽管），下边（南）中间一只热交换接口接收导热管热量。
// mode = "output-to-separate-pipe"：水管网与蒸汽管网相互独立。
class HeatExchanger extends Entity {
  constructor(type, x, y) {
    super('heat-exchanger', x, y);
    this.heatEnergy = 0;  // 内部热量能量(MJ)，温度 = heatEnergy / specificHeat（对齐官方 heat_buffer）
    this.water = 0;       // 内部水箱（左右两侧进水口，互通）
    this.steamBuf = 0;    // 高温蒸汽缓冲（上边中间出汽口）
    this.active = false;
  }
  applyDir() { if (this.dir % 2 === 1) { this.w = this.def.h; this.h = this.def.w; } }
  // ===== 官方 Heat buffer 接口 =====
  specificHeat() { return HEAT_EXCHANGER_SPECIFIC_HEAT; }   // 1MJ/°C（官方）
  maxTransfer() { return HEAT_EXCHANGER_MAX_TRANSFER; }     // 2GW（官方）
  maxEnergy() { return HEAT_MAX_TEMP * this.specificHeat(); }
  temperature() { return this.heatEnergy / this.specificHeat(); }
  heatCap() { return this.maxEnergy(); }
  // 进水口：左右两个短边中部各接一个水口，水流可进可出（互通的，同锅炉布局），随 dir 旋转
  acceptsPumpFeed(cx, cy, fromDir) {
    const pL = rotCell(this, -1, 1);
    const pR = rotCell(this, this.def.w, 1);
    const okL = (cx === pL.x && cy === pL.y) && fromDir === rotSide(2, this.dir);
    const okR = (cx === pR.x && cy === pR.y) && fromDir === rotSide(0, this.dir);
    return okL || okR;
  }
  isWaterPortCell(cx, cy) {
    const pL = rotCell(this, -1, 1);
    const pR = rotCell(this, this.def.w, 1);
    return (cx === pL.x && cy === pL.y) || (cx === pR.x && cy === pR.y);
  }
  update(dt) {
    this.active = false;
    this.heatFlow(dt);
    this.portFlow(dt);
  }
  // 从相邻导热管/反应堆吸热（导热管/反应堆会主动送热，这里也做被动吸收兜底）
  heatFlow(dt) {
    const pHT = rotCell(this, this.def.w >> 1, this.def.h); // 热交换接口外侧：默认下边(南)中间
    forEachNeighborEnt(this, n => {
      if (n._dead) return;
      const isSrc = (n instanceof HeatPipe) || (n instanceof NuclearReactor);
      if (!isSrc) return;
      // 热交换接口在下边中间：只接收下侧相邻导热管/反应堆传来的热量
      const covers = (a, cx, cy) => cx >= a.x && cx < a.x + a.w && cy >= a.y && cy < a.y + a.h;
      if (!covers(n, pHT.x, pHT.y)) return;
      if (n.temperature() <= this.temperature()) return;
      heatTransfer(n, this, dt);
    });
  }
  // 端口物流：左右两侧进水（双水口互通）、上边中间出汽（独立蒸汽管），随 dir 旋转
  portFlow(dt) {
    const covers = (n, cx, cy) => cx >= n.x && cx < n.x + n.w && cy >= n.y && cy < n.y + n.h;
    const pWL = rotCell(this, -1, 1);          // 进水口：默认左侧短边中部
    const pWR = rotCell(this, this.def.w, 1);  // 进水口：默认右侧短边中部
    const pS = rotCell(this, this.def.w >> 1, -1); // 出汽口：默认上边(北)中间
    forEachNeighborEnt(this, n => {
      const wPort = covers(n, pWL.x, pWL.y) || covers(n, pWR.x, pWR.y);
      // 出汽口：上边中间（接蒸汽管道，送汽轮机/其他热交换器）
      const sPort = covers(n, pS.x, pS.y);
      if (n instanceof Pipe) {
        if (wPort) {
          const pw = n.fluid['water'] || 0;
          if (pw >= 1 && this.water < WATER_CAP - 0.01) { n.takeItemOf('water'); this.water++; }
          else if (this.water >= 1 && pw < PIPE_CAP && this.water > 0) { n.giveItem('water'); this.water--; }
        }
        if (sPort && this.steamBuf >= 1 && n.total() < PIPE_CAP && n.giveItem('steam')) this.steamBuf--;
      } else if (n instanceof HeatExchanger) {
        // 两台热交换器水口直接对接：互通水位（同排对口串接，无需中间管道）
        if (wPort) {
          if (this.water >= n.water + 1 && n.water < WATER_CAP - 0.01) {
            this.water--; n.water = Math.min(WATER_CAP, n.water + 1);
          } else if (n.water >= this.water + 1 && this.water < WATER_CAP - 0.01) {
            n.water--; this.water = Math.min(WATER_CAP, this.water + 1);
          }
        }
      } else if (n instanceof SteamTurbine) {
        if (sPort && this.steamBuf >= 1 && n.steamBuf < TURBINE_STEAM_CAP - 0.01) { this.steamBuf--; n.steamBuf++; }
      }
    });
    // 产汽：温度 >= 500°C（官方 min_working_temperature）才开始工作，耗热 + 耗水 → 蒸汽
    if (this.temperature() >= HEAT_EXCHANGER_MIN_WORK_TEMP && this.water >= 0.5) {
      // 满功率产汽速率(单位/s)，对应消耗热量 = 速率 × 每单位蒸汽热值(MJ)
      const rate = HEAT_EXCHANGER_STEAM_RATE;
      const maxHeat = HEAT_EXCHANGER_ENERGY_PER_STEAM * rate * dt; // 满负荷每秒消耗热量(MJ)
      const heatUse = Math.min(maxHeat, this.heatEnergy);
      const steamProduced = heatUse / HEAT_EXCHANGER_ENERGY_PER_STEAM;
      const waterUse = Math.min(steamProduced, this.water);
      if (waterUse > 0) {
        this.heatEnergy -= waterUse * HEAT_EXCHANGER_ENERGY_PER_STEAM;
        this.water -= waterUse;
        this.steamBuf = Math.min(TURBINE_STEAM_CAP, this.steamBuf + waterUse);
        this.active = true;
      }
    }
  }
  giveItem(item) {
    if (item === 'water' && this.water < WATER_CAP - 0.01) { this.water = Math.min(WATER_CAP, this.water + 1); return true; }
    return false;
  }
  peekItem() { return this.steamBuf >= 1 ? 'steam' : null; }
  takeItem() { if (this.steamBuf >= 1) { this.steamBuf--; return 'steam'; } return null; }
  countOf(item) { return item === 'steam' ? Math.floor(this.steamBuf) : 0; }
  takeItemOf(item) { if (item === 'steam' && this.steamBuf >= 1) { this.steamBuf--; return 'steam'; } return null; }
  contents() {
    const list = [[this.type, 1]];
    if (this.water >= 1) list.push(['water', Math.floor(this.water)]);
    if (this.steamBuf >= 1) list.push(['steam', Math.floor(this.steamBuf)]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.heatEnergy = this.heatEnergy; s.water = this.water; s.steamBuf = this.steamBuf;
    return s;
  }
  static restore(s) {
    const h = super.restore(s);
    h.heatEnergy = s.heatEnergy || 0; h.water = s.water || 0; h.steamBuf = s.steamBuf || 0;
    return h;
  }
}
function drawHeatExchanger(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const w = TILE * e.w, h = TILE * e.h;
  const hp = Math.max(0, Math.min(1, e.temperature() / HEAT_MAX_TEMP));
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#5a4436';
  rr(ctx, px + 2, py + 2, w - 4, h - 4, 6); ctx.fill();
  ctx.strokeStyle = '#33261c';
  ctx.lineWidth = 3;
  rr(ctx, px + 2, py + 2, w - 4, h - 4, 6); ctx.stroke();
  // 换热芯（温度越高越亮，横向 3×2 布局）
  ctx.fillStyle = hp > 0.05 ? '#e8a14a' : '#7a6a58';
  rr(ctx, px + 6, py + TILE * 0.5, w - 12, TILE * 0.8, 3); ctx.fill();
  // 端口（内部边缘）：左右两侧两个水口（互通）+ 上边中间出汽口 + 下边中间热交换接口，随 dir 旋转
  const pWL = rotCell(e, 0, 1);              // 左水口（内部格）
  const pWR = rotCell(e, e.def.w - 1, 1);    // 右水口（内部格）
  const pS = rotCell(e, e.def.w >> 1, 0);    // 上边中间蒸汽口（内部格）
  const pHt = rotCell(e, e.def.w >> 1, e.def.h - 1); // 下边中间热交换接口（内部格）
  const cD = TILE / 2 - 1; // 端口凸缘贴合设备内部边缘
  // 热交换接口（下边中间靠边画一条黄色线）——接收导热管热量
  const ht = rotSide(1, e.dir); // 下边(南)方向
  ctx.strokeStyle = '#ffd23a';
  ctx.lineWidth = 3;
  ctx.beginPath();
  if (ht === 3 || ht === 1) {
    // 横向（北/南边）：沿 x 方向画线
    ctx.moveTo(pHt.x * TILE + TILE * 0.3, pHt.y * TILE + (ht === 3 ? 3 : TILE - 3));
    ctx.lineTo(pHt.x * TILE + TILE * 0.7, pHt.y * TILE + (ht === 3 ? 3 : TILE - 3));
  } else {
    // 纵向（西/东边）：沿 y 方向画线
    ctx.moveTo(pHt.x * TILE + (ht === 2 ? 3 : TILE - 3), pHt.y * TILE + TILE * 0.3);
    ctx.lineTo(pHt.x * TILE + (ht === 2 ? 3 : TILE - 3), pHt.y * TILE + TILE * 0.7);
  }
  ctx.stroke();
  // 蒸汽输出波纹（运行中，画在出汽口外）
  if (e.active) {
    ctx.fillStyle = 'rgba(210,235,255,.8)';
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const _s0 = rotSide(3, e.dir); // 上边(北)方向
    ctx.fillText('☁', pS.x * TILE + TILE / 2 + (_s0 === 0 ? TILE / 2 : _s0 === 2 ? -TILE / 2 : 0), pS.y * TILE + TILE / 2 + (_s0 === 1 ? TILE / 2 : _s0 === 3 ? -TILE / 2 : 0));
  }
  // 进水口（左右两侧中部，水色，互通）与出汽口（上边中间，蒸汽色），画在设备内部边缘
  drawPort(ctx, pWL.x * TILE + TILE / 2, pWL.y * TILE + TILE / 2, rotSide(2, e.dir), ITEMS['water'].color, false, 0, cD, 'water', 'both');
  drawPort(ctx, pWR.x * TILE + TILE / 2, pWR.y * TILE + TILE / 2, rotSide(0, e.dir), ITEMS['water'].color, false, 0, cD, 'water', 'both');
  drawPort(ctx, pS.x * TILE + TILE / 2, pS.y * TILE + TILE / 2, rotSide(3, e.dir), ITEMS['steam'].color, true, 0, cD, 'steam', 'out');
  ctx.globalAlpha = 1;
}
function heatExchangerPanelHtml(e) {
  return row('温度', '<span class="dim"></span>', 'heat') +
    row('水', '<span class="dim"></span>', 'water') +
    row('蒸汽缓存', '<span class="dim"></span>', 'steam') +
    '<div class="status"></div>' +
    '<div class="dim">热交换器：下边(南)黄色接口接收导热管热量，左右两侧两个蓝口接水管进水（互通，多台水口可直接对口串接），上边(北)中间白口送出高温蒸汽到汽轮机。核能技术解锁。</div>' +
    '<div class="dim">🔗 标准接法：反应堆→(导热管)→热交换器（接水管）→(蒸汽管)→汽轮机</div>';
}
function heatExchangerPanelLive(e, api) {
  const t = e.temperature();
  api.set('heat', t >= 1 ? chip('heat-pipe', Math.round(t) + '°C') : dimSpan('空'));
  api.set('water', e.water >= 1 ? chip('water', Math.floor(e.water)) : dimSpan('空'));
  api.set('steam', e.steamBuf >= 1 ? chip('steam', Math.floor(e.steamBuf)) : dimSpan('空'));
  if (e.active) api.status('运行中：产汽（' + Math.round(t) + '°C）', 'ok');
  else if (t < HEAT_EXCHANGER_MIN_WORK_TEMP) api.status('升温中 ' + Math.round(t) + '°C（需≥500°C，检查导热管/反应堆）', 'warn');
  else if (e.water < 0.5) api.status('缺水（检查左右蓝口水口）', 'bad');
  else api.status('待机', 'ok');
}
function heatExchangerTip(e) {
  const t = e.temperature();
  if (e.active) return '运行中：产汽 ' + Math.round(t) + '°C';
  if (t < HEAT_EXCHANGER_MIN_WORK_TEMP) return Math.round(t) + '°C（需≥500°C，检查导热管/反应堆）';
  if (e.water < 0.5) return '缺水（检查左右蓝口水口）';
  return '待机';
}

// ===== 注册 =====
ENT_CLASSES['centrifuge'] = Centrifuge;
DEVICE_RENDER['centrifuge'] = drawCentrifuge;
DEVICE_STATUS['centrifuge'] = e => e.crafting ? 'g' : 'r';
DEVICE_PANEL['centrifuge'] = { html: centrifugePanelHtml, live: centrifugePanelLive, tip: centrifugeTip, onAction: (a) => circuitPanelAction('cen', a) };
DEVICE_DIR_ROTATE['centrifuge'] = true; // 离心机支持旋转

ENT_CLASSES['nuclear-reactor'] = NuclearReactor;
DEVICE_RENDER['nuclear-reactor'] = drawNuclearReactor;
DEVICE_STATUS['nuclear-reactor'] = e => e.burning ? 'g' : 'r';
DEVICE_PANEL['nuclear-reactor'] = { html: reactorPanelHtml, live: reactorPanelLive, tip: reactorTip };
DEVICE_DIR_ROTATE['nuclear-reactor'] = true; // 核反应堆支持旋转

ENT_CLASSES['steam-turbine'] = SteamTurbine;
DEVICE_RENDER['steam-turbine'] = drawSteamTurbine;
DEVICE_STATUS['steam-turbine'] = e => e.on ? 'g' : 'r';
DEVICE_PANEL['steam-turbine'] = { html: turbinePanelHtml, live: turbinePanelLive, tip: turbineTip };
// 显示详情时，各接口图标所在世界格 + 对应流体名（用于鼠标悬停显示流体名称）
DEVICE_FLUID_ICONS['steam-turbine'] = e => {
  const pN = rotCell(e, e.def.w >> 1, 0);
  const pS = rotCell(e, e.def.w >> 1, e.def.h - 1);
  return [
    { x: pN.x, y: pN.y, fluid: 'steam' },
    { x: pS.x, y: pS.y, fluid: 'steam' }
  ];
};

ENT_CLASSES['heat-pipe'] = HeatPipe;
DEVICE_RENDER['heat-pipe'] = drawHeatPipe;
DEVICE_STATUS['heat-pipe'] = e => (e.temperature() || 0) > 0 ? 'g' : 'r';
DEVICE_PANEL['heat-pipe'] = { html: () => row('温度', '<span class="dim"></span>', 'heat') + '<div class="status"></div>' + '<div class="dim">导热管：把核反应堆产生的热量传导到热交换器，可多根串联成导热线路（对齐官方：按温度差传导）。核能技术解锁。</div>', live: (e, api) => api.set('heat', e.temperature() >= 1 ? chip('heat-pipe', Math.round(e.temperature()) + '°C') : dimSpan('待机')), tip: heatPipeTip };
DEVICE_DIR_ROTATE['heat-pipe'] = true; // 导热管支持旋转

ENT_CLASSES['heat-exchanger'] = HeatExchanger;
DEVICE_RENDER['heat-exchanger'] = drawHeatExchanger;
DEVICE_STATUS['heat-exchanger'] = e => e.active ? 'g' : (e.temperature() >= HEAT_EXCHANGER_MIN_WORK_TEMP ? 'y' : 'r');
DEVICE_PANEL['heat-exchanger'] = { html: heatExchangerPanelHtml, live: heatExchangerPanelLive, tip: heatExchangerTip };
// 显示详情时，各接口图标所在世界格 + 对应流体名（用于鼠标悬停显示流体名称）
DEVICE_FLUID_ICONS['heat-exchanger'] = e => {
  const pWL = rotCell(e, 0, 1);
  const pWR = rotCell(e, e.def.w - 1, 1);
  const pS = rotCell(e, e.def.w >> 1, 0);
  return [
    { x: pWL.x, y: pWL.y, fluid: 'water' },
    { x: pWR.x, y: pWR.y, fluid: 'water' },
    { x: pS.x, y: pS.y, fluid: 'steam' }
  ];
};
