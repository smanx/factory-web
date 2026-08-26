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
//   → 铀-235 组装成核燃料 → 核反应堆（耗核燃料+水）产出高温蒸汽
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
  moduleSlotCount() { return 2; } // 对齐《异星工厂》：离心机 2 槽
  moduleSpeedMult() {
    const mc = moduleCounts(this.modules);
    const bb = (typeof beaconBonus === 'function') ? beaconBonus(this.x, this.y) : null;
    if (bb) { mc.speed += bb.speed; mc.prod += bb.prod; mc.eff += bb.eff; }
    return 1 + 0.4 * mc.speed - 0.1 * mc.prod - 0.03 * mc.eff;
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
    if ((this.inp[item] || 0) >= 50) return false;
    this.inp[item] = (this.inp[item] || 0) + 1;
    return true;
  }
  peekItem() { for (const k in this.outp) if (this.outp[k] > 0) return k; return null; }
  takeItem() { for (const k in this.outp) if (this.outp[k] > 0) { this.outp[k]--; if (this.outp[k] <= 0) delete this.outp[k]; return k; } return null; }
  countOf(item) { return this.outp[item] || 0; }
  takeItemOf(item) { if (this.outp[item] > 0) { this.outp[item]--; if (this.outp[item] <= 0) delete this.outp[item]; return item; } return null; }
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
  if (e.crafting) {
    const pct = e.recipeObj() ? Math.min(1, (e.prog || 0) / e.recipeObj().time) : 0;
    ctx.strokeStyle = 'rgba(143,224,255,.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.3, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#dff0ff';
  ctx.font = 'bold ' + Math.max(9, Math.round(s * 0.12)) + 'px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('离心', cx, py + 12);
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
  h += '<button data-action="rec" data-id="kovarex" class="' + (cur === 'kovarex' ? 'on' : '') + (kovUnlocked ? '' : ' locked-recipe') + '" ' + (kovUnlocked ? '' : 'disabled') + ' title="' + (kovUnlocked ? '铀增殖：持续增产铀-235' : ('🔒 需先研究「' + (kovLock ? TECHS[kovLock].name : '研究') + '」')) + '">铀增殖(Kovarex)' + (kovUnlocked ? '' : ' 🔒') + '</button>';
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
  if (rec && e.crafting) api.prog(e.prog / rec.time * 100);
  else api.prog(0);
}
function centrifugeTip(e) {
  if (!e.recipe) return '未选择配方';
  if (e.crafting) return '处理中 ' + Math.round((e.prog / e.recipeObj().time) * 100) + '%';
  return e.recipe === 'kovarex' ? '铀增殖循环（等待原料）' : '铀浓缩处理（等待原料）';
}

// ===================== 核反应堆（5×5，吃核燃料+水）=====================
// 复用锅炉的“水→蒸汽”模型：核燃料燃烧把水加热成高温蒸汽，经底边出汽口排出。
// 产汽能力远超锅炉：同耗水量下产出更多蒸汽，供多台汽轮机满载。
class NuclearReactor extends Entity {
  constructor(type, x, y) {
    super('nuclear-reactor', x, y);
    this.fuel = 0;          // 核燃料组数（燃料槽）
    this.burnLeft = 0;      // 当前燃料剩余燃烧秒数
    this.heatBuf = 0;       // 内部热量缓冲（对齐《异星工厂》：反应堆产生热量，经导热管传导）
    this.temp = 0;          // 堆芯温度（显示用）
    this.burning = false;
    this.lit = false;
    this.spent = 0;         // 已燃尽的废燃料棒（可被机械臂取走再生成铀-238）
  }
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
    this.temp = Math.max(0, this.temp - 1 * dt);
    // 向相邻导热管/热交换器传导热量
    this.heatFlow(dt);
    // 热量憋满则暂停；被导热管消耗后自动恢复
    if (this.heatBuf >= REACTOR_HEAT_CAP - 0.01) { this.lit = false; return; }
    if (this.burnLeft <= 0 && this.fuel > 0) {
      this.fuel--;
      if (typeof trackProd === 'function') trackProd('nuclear-fuel', -1);
      // 燃尽一根核燃料 → 产生一根废燃料棒（核燃料循环闭环）
      this.spent++;
      if (typeof trackProd === 'function') trackProd('used-up-uranium-fuel-cell', 1);
      this.burnLeft += REACTOR_FUEL_ENERGY;
    }
    if (this.burnLeft <= 0) { this.lit = false; return; }
    this.lit = true;
    this.burning = true;
    reactorEmit(this, dt);
    this.burnLeft -= dt;
    // 核反应堆相邻加成（对齐《异星工厂》：每个相邻反应堆使输出 +100%，鼓励多堆并排布局）
    const neighbors = this.neighborCount();
    const rate = REACTOR_HEAT_RATE * (1 + neighbors); // 每秒产热量（远超锅炉产能）
    this.heatBuf = Math.min(REACTOR_HEAT_CAP, this.heatBuf + rate * dt);
    this.temp = Math.min(200, this.temp + 20 * (1 + neighbors * 0.5) * dt);
  }
  // 热量传导：把热量输送给相邻的导热管/热交换器（从更热的流向更冷的）
  heatFlow(dt) {
    if (this.heatBuf < 0.01) return;
    forEachNeighborEnt(this, n => {
      if (n._dead) return;
      const isHeatSink = (n instanceof HeatPipe) || (n instanceof HeatExchanger);
      if (!isHeatSink) return;
      // 仅相邻导热管/热交换器
      if (this.heatBuf < 0.5) return;
      const cap = n.heatCap ? n.heatCap() : HEAT_PIPE_CAP;
      if (n.heatBuf >= cap - 0.01) return;
      const want = Math.min(HEAT_PIPE_TRANSFER * dt, this.heatBuf, cap - n.heatBuf);
      if (want <= 0) return;
      this.heatBuf -= want;
      n.heatBuf = Math.min(cap, n.heatBuf + want);
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
    // 反应堆同时接受核燃料（向后兼容旧档）与铀燃料棒（对齐《异星工厂》：反应堆专用燃料），二者燃尽均产废燃料棒
    if ((item === 'nuclear-fuel' || item === 'uranium-fuel-cell') && this.fuel < 5) { this.fuel++; return true; }
    return false;
  }
  peekItem() {
    if (this.spent > 0) return 'used-up-uranium-fuel-cell';
    return null;
  }
  takeItem() {
    if (this.spent > 0) { this.spent--; return 'used-up-uranium-fuel-cell'; }
    return null;
  }
  countOf(item) { return item === 'used-up-uranium-fuel-cell' ? this.spent : 0; }
  takeItemOf(item) {
    if (item === 'used-up-uranium-fuel-cell' && this.spent > 0) { this.spent--; return item; }
    return null;
  }
  // 面板“取回全部”：退回废燃料棒（核燃料不参与）
  takeAll() {
    const rows = [];
    if (this.spent > 0) { rows.push(['used-up-uranium-fuel-cell', this.spent]); this.spent = 0; }
    return rows;
  }
  contents() {
    const list = [[this.type, 1]];
    if (this.fuel > 0) list.push(['nuclear-fuel', this.fuel]);
    if (this.spent > 0) list.push(['used-up-uranium-fuel-cell', this.spent]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.fuel = this.fuel; s.burnLeft = this.burnLeft; s.heatBuf = this.heatBuf;
    s.temp = this.temp; s.spent = this.spent;
    return s;
  }
  static restore(s) {
    const r = super.restore(s);
    r.fuel = s.fuel || 0; r.burnLeft = s.burnLeft || 0; r.heatBuf = s.heatBuf || 0;
    r.temp = s.temp || 0; r.spent = s.spent || 0;
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
  // 热量条（替代原水位条）
  const wPct = Math.max(0, Math.min(1, (e.heatBuf || 0) / REACTOR_HEAT_CAP));
  ctx.fillStyle = '#20242b';
  rr(ctx, px + 12, py + h - 22, w - 24, 6, 3); ctx.fill();
  ctx.fillStyle = wPct > 0 ? '#d98a3a' : '#6a5a3a';
  rr(ctx, px + 12, py + h - 22, (w - 24) * wPct, 6, 3); ctx.fill();
  // 热量传输示意（橙色，与导热管对接）
  const midx = px + (w >> 1), midRow = py + TILE * (e.h - 1);
  drawPort(ctx, midx, py + h, 1, PORT_STEAM, true, 0, TILE);
  ctx.fillStyle = '#eaf6ea';
  ctx.font = 'bold 13px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('核反应堆', px + w / 2, py + 14);
  ctx.globalAlpha = 1;
}
function reactorPanelHtml(e) {
  let h = row('核燃料', e.fuel > 0 ? chip('nuclear-fuel', e.fuel) : '<span class="dim">无</span>', 'fuel');
  if (invCount('nuclear-fuel') > 0)
    h += '<button data-action="fuel" data-id="nuclear-fuel">装入核燃料 (' + invCount('nuclear-fuel') + ')</button>';
  if (invCount('uranium-fuel-cell') > 0)
    h += '<button data-action="fuel" data-id="uranium-fuel-cell">装入铀燃料棒 (' + invCount('uranium-fuel-cell') + ')</button>';
  h += row('废燃料棒', '<span class="dim"></span>', 'spent');
  h += '<button data-action="takeout" id="btn-spent-takeout" style="display:none"></button>';
  h += row('热量缓存', '<span class="dim"></span>', 'heat');
  h += row('堆芯温度', '', 'temp');
  h += barHtml(0);
  h += '<div class="status"></div>';
  h += '<div class="dim">核反应堆：消耗铀燃料棒（或核燃料）产生巨量热量，经底边橙口传给导热管，再由导热管把热量送到热交换器，由热交换器把水烧成高温蒸汽供汽轮机发电（对齐《异星工厂》核能标准链路）。燃尽的燃料会留下废燃料棒，可在离心机再生为铀-238，闭合核燃料循环。核能技术解锁。</div>';
  h += '<div class="dim">💡 相邻加成：并排摆放多座反应堆，每座相邻反应堆使输出 +100%（对齐《异星工厂》）。</div>';
  h += '<div class="dim">🔗 标准接法：反应堆→(导热管)→热交换器（接水管）→(蒸汽管)→汽轮机</div>';
  return h;
}
function reactorPanelLive(e, api) {
  api.set('fuel', e.fuel > 0 ? chip('nuclear-fuel', e.fuel) : dimSpan('无'));
  api.set('spent', e.spent > 0 ? chip('used-up-uranium-fuel-cell', e.spent) : dimSpan('无'));
  api.toggle('#btn-spent-takeout', e.spent > 0, '取回废燃料棒 (' + e.spent + ')');
  api.set('heat', e.heatBuf >= 1 ? chip('heat-pipe', Math.floor(e.heatBuf)) : dimSpan('空'));
  api.set('temp', Math.round(e.temp) + ' / 200 °C');
  api.prog(Math.min(100, e.temp / 200 * 100));
  if (e.heatBuf >= REACTOR_HEAT_CAP - 0.01) api.status('已暂停：热量满，等待导热管/热交换器消耗', 'warn');
  else if (e.burning) api.status('运行中：产出热量', 'ok');
  else if (e.fuel <= 0 && e.burnLeft <= 0) api.status('已暂停：无核燃料', 'bad');
  else api.status('已暂停：待机', 'warn');
}
function reactorTip(e) {
  return e.burning ? '运行中 ' + Math.round(e.temp) + '°C（存热' + Math.floor(e.heatBuf || 0) + '）'
    : e.heatBuf >= REACTOR_HEAT_CAP - 0.01 ? '热量满·等待导热管消耗'
    : (e.fuel <= 0 && e.burnLeft <= 0) ? '无核燃料' : '待机';
}

// ===================== 汽轮机（3×3，耗蒸汽→发电）=====================
// 复用蒸汽机的“蒸汽→电力”模型，但功率与耗汽量远高（对齐《异星工厂》5.8MW）。
class SteamTurbine extends Entity {
  constructor(type, x, y) {
    super('steam-turbine', x, y);
    this.spin = 0;
    this.on = false;
    this.outMult = 0;
    this.powerOut = 0;
    this.steamBuf = 0;
  }
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
  // 顶部/底部汽口：从上方反应堆出汽格、或相邻汽轮机/蒸汽管道取蒸汽
  portFlow() {
    const covers = (n, cx, cy) => cx >= n.x && cx < n.x + n.w && cy >= n.y && cy < n.y + n.h;
    const midX = this.x + (this.w >> 1);
    forEachNeighborEnt(this, n => {
      // 顶部格：接反应堆底边出汽口；底部格：接管道/汽轮机串接
      const topPort = covers(n, midX, this.y - 1);
      const botPort = covers(n, midX, this.y + this.h);
      if (n instanceof Pipe) {
        if (!(topPort || botPort)) return;
        if (this.steamBuf < TURBINE_STEAM_CAP - 0.01 && (n.fluid['steam'] || 0) >= 1) {
          n.takeItemOf('steam'); this.steamBuf++;
        }
      } else if (n instanceof SteamTurbine) {
        if (!(topPort || botPort)) return;
        if (this.steamBuf >= n.steamBuf + 1 && n.steamBuf < TURBINE_STEAM_CAP - 0.01) { this.steamBuf--; n.steamBuf++; }
        else if (n.steamBuf >= this.steamBuf + 1 && this.steamBuf < TURBINE_STEAM_CAP - 0.01) { n.steamBuf--; this.steamBuf++; }
      } else if (n instanceof HeatExchanger) {
        // 热交换器底边出汽口正对汽轮机顶部：直接受汽
        if (topPort && this.steamBuf < TURBINE_STEAM_CAP - 0.01 && n.steamBuf >= 1) { n.steamBuf--; this.steamBuf++; }
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
  // 旋转叶片
  const cx = px + w / 2, cy = py + h * 0.42;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(e.spin || 0);
  ctx.fillStyle = om > 0 ? '#cfe0f0' : '#7d8894';
  gearShape(ctx, 0, 0, w * 0.22, w * 0.1, 12);
  ctx.fill();
  ctx.restore();
  // 叶片转速示意
  if (om > 0.02) {
    ctx.strokeStyle = 'rgba(200,225,255,.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const t = ((G.time * 4 * om) + i / 4) % 1;
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.32, t * Math.PI * 2 - 0.2, t * Math.PI * 2 + 0.2);
      ctx.stroke();
    }
  }
  // 功率输出
  ctx.fillStyle = om > 0.02 ? '#bff0bf' : '#8a93a0';
  ctx.font = 'bold 10px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText((e.powerOut || 0).toFixed(0) + ' kW', cx, py + h * 0.8);
  // 底部汽口
  drawPort(ctx, cx, py + h, 1, PORT_STEAM, true, 0, TILE);
  ctx.globalAlpha = 1;
}
function turbinePanelHtml(e) {
  return row('功率输出', '<span class="dim"></span>', 'power') +
    row('蒸汽缓存', '<span class="dim"></span>', 'steam') +
    '<div class="status"></div>' +
    '<div class="dim">汽轮机：底边汽口接入高温蒸汽（来自热交换器/蒸汽管道），以远高于蒸汽机的功率发电。核能技术解锁。</div>';
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
    : e.steamBuf < 0.5 ? '无高温蒸汽（检查底部汽口/管道）' : '待机';
}

// ===================== 导热管 Heat Pipe（1×1）=====================
// 对齐《异星工厂》Heat pipe：把核反应堆产生的热量沿路传导到热交换器。
// 相邻导热管会按热差互相传导，可多根串联成导热线路。
class HeatPipe extends Entity {
  constructor(type, x, y) {
    super('heat-pipe', x, y);
    this.heatBuf = 0;
    this.cool = 0.05; // 每秒散热（热量沿路衰减）
  }
  heatCap() { return HEAT_PIPE_CAP; }
  update(dt) {
    // 与相邻导热管/热交换器/反应堆按热差传导（从热的流向冷的）
    this.flow(dt);
    // 自然散热（衰减），避免热量滞留堆积
    if (this.heatBuf > 0) this.heatBuf = Math.max(0, this.heatBuf - this.cool * dt);
  }
  flow(dt) {
    forEachNeighborEnt(this, n => {
      if (n._dead) return;
      // 导热管向更冷的相邻导热管/热交换器传热（反应堆是热源，会主动送热）
      const isHeatDev = (n instanceof HeatPipe) || (n instanceof HeatExchanger);
      if (!isHeatDev) return;
      if (this.heatBuf < 0.1) return;
      const cap = n.heatCap ? n.heatCap() : HEAT_PIPE_CAP;
      if (n.heatBuf >= cap - 0.01) return;
      const want = Math.min(HEAT_PIPE_TRANSFER * dt, this.heatBuf, cap - n.heatBuf);
      if (want <= 0) return;
      this.heatBuf -= want;
      n.heatBuf = Math.min(cap, n.heatBuf + want);
    });
  }
  // 端口：相邻设备显示橙色热量口（用于逻辑判定：可传热）
  isHeatPortCell(cx, cy) {
    return cx === this.x && cy === this.y;
  }
  contents() {
    const list = [[this.type, 1]];
    if (this.heatBuf >= 1) list.push(['heat-pipe', Math.floor(this.heatBuf)]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.heatBuf = this.heatBuf;
    return s;
  }
  static restore(s) {
    const p = super.restore(s);
    p.heatBuf = s.heatBuf || 0;
    return p;
  }
}
function drawHeatPipe(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE;
  const hp = Math.max(0, Math.min(1, (e.heatBuf || 0) / HEAT_PIPE_CAP));
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#3a3428';
  rr(ctx, px + 2, py + 2, s - 4, s - 4, 5); ctx.fill();
  ctx.strokeStyle = '#1c1710';
  ctx.lineWidth = 2;
  rr(ctx, px + 2, py + 2, s - 4, s - 4, 5); ctx.stroke();
  // 内部导热芯（温度越高越亮）
  ctx.fillStyle = hp > 0.05 ? '#e8a14a' : '#5a5245';
  rr(ctx, px + 6, py + 6, s - 12, s - 12, 3); ctx.fill();
  if (hp > 0.05) {
    ctx.strokeStyle = 'rgba(255,170,80,' + (0.4 + hp * 0.6).toFixed(2) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px + s / 2, py + s / 2, s * 0.22, 0, 7);
    ctx.stroke();
  }
  ctx.fillStyle = hp > 0.4 ? '#ffe0b0' : '#b8a888';
  ctx.font = 'bold 9px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('导', px + s / 2, py + s / 2);
  ctx.globalAlpha = 1;
}
function heatPipeTip(e) {
  return (e.heatBuf || 0) > 0.5 ? '导热管（存热 ' + Math.floor(e.heatBuf) + '）' : '导热管（待机）';
}

// ===================== 热交换器 Heat Exchanger（3×1）=====================
// 对齐《异星工厂》Heat exchanger：消耗导热管传来的热量 + 水 → 产出高温蒸汽供汽轮机。
class HeatExchanger extends Entity {
  constructor(type, x, y) {
    super('heat-exchanger', x, y);
    this.heatBuf = 0;
    this.water = 0;       // 内部水箱（侧面进水口）
    this.steamBuf = 0;    // 高温蒸汽缓冲（底边出汽口）
    this.active = false;
  }
  heatCap() { return HEAT_EXCHANGER_CAP; }
  // 进水口：左端/右端侧面接管道
  acceptsPumpFeed(cx, cy, fromDir) {
    if (cy !== this.y) return false;
    if (cx === this.x) return fromDir === 0;
    if (cx === this.x + this.w - 1) return fromDir === 2;
    return false;
  }
  isWaterPortCell(cx, cy) {
    return cy === this.y && (cx === this.x - 1 || cx === this.x + this.w);
  }
  update(dt) {
    this.active = false;
    this.heatFlow(dt);
    this.portFlow(dt);
  }
  // 从相邻导热管/反应堆吸热（导热管/反应堆会主动送热，这里也做被动吸收兜底）
  heatFlow(dt) {
    forEachNeighborEnt(this, n => {
      if (n._dead) return;
      const isSrc = (n instanceof HeatPipe) || (n instanceof NuclearReactor);
      if (!isSrc) return;
      if (n.heatBuf < 0.5 || this.heatBuf >= HEAT_EXCHANGER_CAP - 0.01) return;
      const want = Math.min(HEAT_PIPE_TRANSFER * dt, n.heatBuf, HEAT_EXCHANGER_CAP - this.heatBuf);
      if (want <= 0) return;
      n.heatBuf -= want;
      this.heatBuf = Math.min(HEAT_EXCHANGER_CAP, this.heatBuf + want);
    });
  }
  // 端口物流：侧面进水（水口）、底边出汽
  portFlow(dt) {
    const covers = (n, cx, cy) => cx >= n.x && cx < n.x + n.w && cy >= n.y && cy < n.y + n.h;
    forEachNeighborEnt(this, n => {
      const wPort = covers(n, this.x - 1, this.y) || covers(n, this.x + this.w, this.y);
      const sPort = covers(n, this.x + (this.w >> 1), this.y + 1);
      if (n instanceof Pipe) {
        if (wPort) {
          const pw = n.fluid['water'] || 0;
          if (pw >= 1 && this.water < WATER_CAP - 0.01) { n.takeItemOf('water'); this.water++; }
          else if (this.water >= 1 && pw < PIPE_CAP && this.water > 0) { n.giveItem('water'); this.water--; }
        }
        if (sPort && this.steamBuf >= 1 && n.total() < PIPE_CAP && n.giveItem('steam')) this.steamBuf--;
      } else if (n instanceof SteamTurbine) {
        if (sPort && this.steamBuf >= 1 && n.steamBuf < TURBINE_STEAM_CAP - 0.01) { this.steamBuf--; n.steamBuf++; }
      }
    });
    // 产汽：耗热 + 耗水 → 蒸汽
    if (this.heatBuf >= 0.5 && this.water >= 0.5) {
      const rate = HEAT_EXCHANGER_STEAM_RATE;
      const heatUse = Math.min(rate * dt, this.heatBuf, HEAT_EXCHANGER_CAP * 0.9);
      const waterUse = Math.min(heatUse, this.water);
      if (waterUse > 0) {
        this.heatBuf -= waterUse;
        this.water -= waterUse;
        this.steamBuf = Math.min(HEAT_EXCHANGER_CAP, this.steamBuf + waterUse);
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
    s.heatBuf = this.heatBuf; s.water = this.water; s.steamBuf = this.steamBuf;
    return s;
  }
  static restore(s) {
    const h = super.restore(s);
    h.heatBuf = s.heatBuf || 0; h.water = s.water || 0; h.steamBuf = s.steamBuf || 0;
    return h;
  }
}
function drawHeatExchanger(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const w = TILE * e.w, h = TILE * e.h;
  const hp = Math.max(0, Math.min(1, (e.heatBuf || 0) / HEAT_EXCHANGER_CAP));
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#5a4436';
  rr(ctx, px + 2, py + 2, w - 4, h - 4, 6); ctx.fill();
  ctx.strokeStyle = '#33261c';
  ctx.lineWidth = 3;
  rr(ctx, px + 2, py + 2, w - 4, h - 4, 6); ctx.stroke();
  // 换热芯（温度越高越亮）
  ctx.fillStyle = hp > 0.05 ? '#e8a14a' : '#7a6a58';
  rr(ctx, px + 6, py + 8, w - 12, TILE * 0.5, 3); ctx.fill();
  // 蒸汽输出波纹（运行中）
  if (e.active) {
    ctx.fillStyle = 'rgba(210,235,255,' + (0.4 + Math.sin(G.time * 8) * 0.3).toFixed(2) + ')';
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('☁', px + w / 2, py + 4);
  }
  // 进水口（两侧蓝）与出汽口（底边白）
  drawPort(ctx, px + TILE, py + TILE, 2, PORT_WATER, false, 0, TILE);
  drawPort(ctx, px + w - TILE, py + TILE, 0, PORT_WATER, false, 0, TILE);
  drawPort(ctx, px + w / 2, py + h, 1, PORT_STEAM, true, 0, TILE);
  ctx.fillStyle = '#ffe0b0';
  ctx.font = 'bold 10px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('热交换器', px + w / 2, py + h - 6);
  ctx.globalAlpha = 1;
}
function heatExchangerPanelHtml(e) {
  return row('热量', '<span class="dim"></span>', 'heat') +
    row('水', '<span class="dim"></span>', 'water') +
    row('蒸汽缓存', '<span class="dim"></span>', 'steam') +
    '<div class="status"></div>' +
    '<div class="dim">热交换器：顶面/侧面接收导热管传来的热量，侧面蓝口接水管进水，底边白口送出高温蒸汽到汽轮机。核能技术解锁。</div>' +
    '<div class="dim">🔗 标准接法：反应堆→(导热管)→热交换器（接水管）→(蒸汽管)→汽轮机</div>';
}
function heatExchangerPanelLive(e, api) {
  api.set('heat', e.heatBuf >= 1 ? chip('heat-pipe', Math.floor(e.heatBuf)) : dimSpan('空'));
  api.set('water', e.water >= 1 ? chip('water', Math.floor(e.water)) : dimSpan('空'));
  api.set('steam', e.steamBuf >= 1 ? chip('steam', Math.floor(e.steamBuf)) : dimSpan('空'));
  if (e.active) api.status('运行中：产汽', 'ok');
  else if (e.heatBuf < 0.5) api.status('缺热量（检查导热管/反应堆）', 'warn');
  else if (e.water < 0.5) api.status('缺水（检查侧面蓝口水口）', 'bad');
  else api.status('待机', 'ok');
}
function heatExchangerTip(e) {
  if (e.active) return '运行中：产汽';
  if (e.heatBuf < 0.5) return '缺热量（检查导热管/反应堆）';
  if (e.water < 0.5) return '缺水（检查侧面蓝口水口）';
  return '待机';
}

// ===== 注册 =====
ENT_CLASSES['centrifuge'] = Centrifuge;
DEVICE_RENDER['centrifuge'] = drawCentrifuge;
DEVICE_STATUS['centrifuge'] = e => e.crafting ? 'g' : 'r';
DEVICE_PANEL['centrifuge'] = { html: centrifugePanelHtml, live: centrifugePanelLive, tip: centrifugeTip, onAction: (a) => circuitPanelAction('cen', a) };

ENT_CLASSES['nuclear-reactor'] = NuclearReactor;
DEVICE_RENDER['nuclear-reactor'] = drawNuclearReactor;
DEVICE_STATUS['nuclear-reactor'] = e => e.burning ? 'g' : (e.heatBuf >= REACTOR_HEAT_CAP - 0.01 ? 'y' : 'r');
DEVICE_PANEL['nuclear-reactor'] = { html: reactorPanelHtml, live: reactorPanelLive, tip: reactorTip };

ENT_CLASSES['steam-turbine'] = SteamTurbine;
DEVICE_RENDER['steam-turbine'] = drawSteamTurbine;
DEVICE_STATUS['steam-turbine'] = e => e.on ? 'g' : 'r';
DEVICE_PANEL['steam-turbine'] = { html: turbinePanelHtml, live: turbinePanelLive, tip: turbineTip };

ENT_CLASSES['heat-pipe'] = HeatPipe;
DEVICE_RENDER['heat-pipe'] = drawHeatPipe;
DEVICE_STATUS['heat-pipe'] = e => (e.heatBuf || 0) > 0.5 ? 'g' : 'r';
DEVICE_PANEL['heat-pipe'] = { html: () => row('热量', '<span class="dim"></span>', 'heat') + '<div class="status"></div>' + '<div class="dim">导热管：把核反应堆产生的热量传导到热交换器，可多根串联成导热线路。核能技术解锁。</div>', live: (e, api) => api.set('heat', e.heatBuf >= 1 ? chip('heat-pipe', Math.floor(e.heatBuf)) : dimSpan('空')), tip: heatPipeTip };

ENT_CLASSES['heat-exchanger'] = HeatExchanger;
DEVICE_RENDER['heat-exchanger'] = drawHeatExchanger;
DEVICE_STATUS['heat-exchanger'] = e => e.active ? 'g' : (e.heatBuf >= 0.5 ? 'y' : 'r');
DEVICE_PANEL['heat-exchanger'] = { html: heatExchangerPanelHtml, live: heatExchangerPanelLive, tip: heatExchangerTip };
