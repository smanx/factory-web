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
  // 产物缓冲容量：自循环配方（Kovarex 等）单轮产出量大且产物即下一轮原料，
  // 不适用「够用 2 次生产」的堆积判定（否则单轮产出本身就会触发停工），
  // 改按输出栏总存量到达固定容量时停工，玩家抓出后自动恢复——对齐官方持续运转设定。
  outputBufferCap() {
    return 80;
  }
  outputBufferFull(rec) {
    if (!rec) return false;
    if (rec.prob) {                       // 概率配方：每周期 1 件，总存量 >= 2 即停
      let total = 0;
      for (const k in this.outp) total += this.outp[k];
      return total >= 2;
    }
    if (this.isSelfFeeding(rec)) {        // 自循环配方：按固定缓冲容量
      let total = 0;
      for (const k in this.outp) total += this.outp[k];
      return total >= this.outputBufferCap();
    }
    return outputBacklogged(this.outp, rec.out);
  }
  // 自循环配方：产物包含本配方原料（如 Kovarex 产出的铀-235 同时是输入）
  isSelfFeeding(rec) {
    for (const k in rec.out) if (rec.inp[k]) return true;
    return false;
  }
  update(dt) {
    if (!this.recipe) { this.crafting = false; return; }
    if (G.power.sat <= 0) { this.crafting = false; return; }
    // 电路条件不满足时暂停生产（对齐《异星工厂》：电路控制配方启停）
    if (!this.circuitEnabled()) { this.crafting = false; return; }
    const rec = this.recipeObj();
    if (!rec) { this.crafting = false; return; }
    if (this.crafting) {
      this.prog += dt * 1 * this.moduleSpeedMult() * powerFactor() * (this.quality ? qualityMult(this.quality) : 1);
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
    // 产出容量检查（产物堆积即停工，动态「够用」）：
    // - 概率配方（每周期只产 1 件）按总存量 >= 2 停，防止原料积压在前端机器；
    // - 自循环配方（如 Kovarex：单轮产出 41+2 已超「够用 2 次」与硬上限，属正常形态，
    //   且产物即下一轮原料，官方设定持续运转）：改按固定缓冲容量 outputBufferCap() 判定；
    // - 其余普通配方按「存量够再产 2 次」停。
    if (this.outputBufferFull(rec)) return;
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
    // 配方原料优先：插件若为当前配方原料则入原料区，而非插件槽
    if (this.recipe) {
      const rec = this.recipeObj();
      if (rec && rec.inp[item]) {
        // 只按原料判定是否超过 2 倍：产物不做计数（Kovarex 等自循环配方产物即原料，
        // 把产物算进总量会让离心机被自己上一轮产出「喂饱」而拒收下一轮原料）
        if ((this.inp[item] || 0) >= rec.inp[item] * 2) return false;
        this.inp[item] = (this.inp[item] || 0) + 1;
        return true;
      }
    }
    if (isModule(item)) {
      // 模块槽位限制（对齐《异星工厂》：离心机 2 槽）
      if ((this.modules[item] || 0) >= this.moduleSlotCount()) return false;
      this.modules[item] = (this.modules[item] || 0) + 1;
      if (typeof playSfx === 'function') playSfx('module');
      return true;
    }
    return false;
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
    let info = '<div class="sec">当前配方 · ' + recipeValueHtml(e.recipe, curNm) + '</div>';
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
  const inpObj = {};
  for (const k in e.inp) if (e.inp[k] > 0) inpObj[k] = e.inp[k];
  api.set('inp', Object.keys(inpObj).length ? '<div class="asm3-inp-row">' + itemSlotsHtml(inpObj, { action: 'display' }) + '</div>' : dimSpan('空'));
  const outObj = {};
  for (const k in e.outp) if (e.outp[k] > 0) outObj[k] = e.outp[k];
  api.set('out', Object.keys(outObj).length ? '<div class="asm3-inp-row">' + itemSlotsHtml(outObj, { action: 'take-slot' }) + '</div>' : dimSpan('空'));
  const rec = e.recipeObj();
  if (!rec) api.status('未选择配方', 'warn');
  else if (e.crafting) api.status('处理中', 'ok');
  else if (e.outputBufferFull && e.outputBufferFull(rec)) {
    api.status('已暂停：产物缓冲已满（取走产物后继续）', 'warn');
  } else {
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

// ===== 官方 heat_buffer.connections 接口判定 =====
// 热量只能通过设备声明的热量接口格流出/流入(对齐官方 connections):
//   - 核反应堆(5×5):四边各 3 个接口格(相对中心 -2/0/+2,即第 1/3/5 格);
//   - 供热塔(3×3)/聚变反应堆(6×6):四边各 1 个接口格(边中心);
//   - 热交换器(3×2):热交换接口 1 格(默认下边(南)中间,随 dir 旋转);
//   - 聚变发电机(3×5):热交换接口 1 格(默认下边(南)中间,随 dir 旋转,与热交换器同布局)。
// 端口判定统一走 rotCell 局部坐标 → 世界格,再判断目标格是否被该实体占据。
function heatDevicePortCells(e) {
  // 反应堆:四边各 3 个(官方 -2/0/+2 偏移)
  if (e instanceof NuclearReactor) {
    const cells = [];
    for (const o of [-2, 0, 2]) {
      cells.push({ x: e.x + ((e.w / 2) | 0) + o, y: e.y - 1 });               // 北边
      cells.push({ x: e.x + ((e.w / 2) | 0) + o, y: e.y + e.h });             // 南边
      cells.push({ x: e.x + e.w, y: e.y + ((e.h / 2) | 0) + o });             // 东边
      cells.push({ x: e.x - 1, y: e.y + ((e.h / 2) | 0) + o });               // 西边
    }
    return cells;
  }
  // 供热塔:四边各 1 个(官方 heating-tower heat_buffer.connections,不随 dir 旋转)
  if (e instanceof HeatingTower) {
    return [
      { x: e.x + ((e.w / 2) | 0), y: e.y - 1 },
      { x: e.x + ((e.w / 2) | 0), y: e.y + e.h },
      { x: e.x + e.w, y: e.y + ((e.h / 2) | 0) },
      { x: e.x - 1, y: e.y + ((e.h / 2) | 0) },
    ];
  }
  // 热交换器/聚变发电机:热交换接口 1 格(默认下边(南)中间,随 dir 旋转)
  if (e instanceof HeatExchanger || e instanceof FusionGenerator) {
    return [rotCell(e, e.def.w >> 1, e.def.h)];   // 接口外侧相邻格
  }
  return null;
}
// from 的某世界格 (cx,cy) 是否是 from 的热量接口外侧格,且该格被 to 占据
// (即 to 有一格贴在 from 的热量接口上 → 二者可通过该接口传热)
function heatDevicesConnectedViaPort(from, to) {
  const ports = heatDevicePortCells(from);
  if (!ports) return true;    // 无接口定义的设备(如导热管)按全格连通
  for (const p of ports) {
    if (p.x >= to.x && p.x < to.x + to.w && p.y >= to.y && p.y < to.y + to.h) return true;
  }
  return false;
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
  // 仅经官方 heat_buffer.connections 声明的热量接口传热（四边各 3 个接口格），接口未对上不传热。
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
// 核反应堆渲染（5×5）：重工业安全壳厂房风格
// 视觉分区（自下而上）：
//   ① 落地投影            ② 混凝土基座（全占地双色调底盘，四边承载热量接口黄线）
//   ③ 八角形安全壳主体（垂直渐变 + 内嵌板缝亮线 + 短焊缝 + 四角螺栓）
//   ④ 顶部通风格栅 ×2 + 辐射三叶铭牌（黄漆地面标识，运行时提亮）
//   ⑤ 左右百叶散热窗（钢框 + 横向叶片）
//   ⑥ 中央反应堆坑：黄黑警戒条纹环 + 深色堆坑水池
//   ⑦ 5×5 燃料棒阵列（运行时亮蓝绿，停堆后是暗色棒位）
//   ⑧ 控制棒驱动机构 ×4（斜向骑在坑环上：运行时提起、停堆时插底，附状态 LED）
//   ⑨ 堆芯辉光（运行中：蓝绿"切伦科夫"光随堆温增亮 + 呼吸脉动与扩散涟漪；停堆余温：暗红微光）
//   ⑩ 底部仪表面板：堆温条 + 燃料条（沿用原坐标/配色，>85% 高温红光警示）
//   ⑪ 四边热量接口黄线（对齐官方 heat_buffer.connections，位置与旧版完全一致）
function drawNuclearReactor(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const w = TILE * e.w, h = TILE * e.h;
  ctx.globalAlpha = alpha;

  // —— 运行状态 ——
  const temp = (typeof e.temperature === 'function') ? e.temperature() : 0;
  const wPct = Math.max(0, Math.min(1, temp / HEAT_MAX_TEMP));                  // 堆芯温度占比
  const fp = Math.max(0, Math.min(1, (e.burnLeft || 0) / REACTOR_FUEL_ENERGY)); // 当前燃料棒燃剩
  const burning = !!e.burning;
  const pulse = 0.62 + 0.38 * Math.sin((G.time || 0) * 6);   // 呼吸幅度 0.24~1.0（原 0.6~1.0），节奏稍快、更明显

  const cx = px + w / 2;
  const cy = py + h * 0.47;   // 反应堆坑中心（略偏上，底部留给仪表面板）

  // 八角形路径（切角安全壳）
  const oct = (x, y, ow, oh, b) => {
    ctx.beginPath();
    ctx.moveTo(x + b, y);
    ctx.lineTo(x + ow - b, y);
    ctx.lineTo(x + ow, y + b);
    ctx.lineTo(x + ow, y + oh - b);
    ctx.lineTo(x + ow - b, y + oh);
    ctx.lineTo(x + b, y + oh);
    ctx.lineTo(x, y + oh - b);
    ctx.lineTo(x, y + b);
    ctx.closePath();
  };

  // ① 落地投影（向下偏移的柔和阴影）
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  rr(ctx, px + 4, py + 6, w - 4, h - 5, 9); ctx.fill();

  // ② 混凝土基座（双色调：外圈压边 + 内圈台面）
  ctx.fillStyle = '#1e2229';
  rr(ctx, px + 2, py + 2, w - 4, h - 4, 7); ctx.fill();
  ctx.fillStyle = '#272c34';
  rr(ctx, px + 5, py + 5, w - 10, h - 10, 5); ctx.fill();
  ctx.strokeStyle = '#101318';
  ctx.lineWidth = 2;
  rr(ctx, px + 2, py + 2, w - 4, h - 4, 7); ctx.stroke();

  // ③ 安全壳主体（八角形钢筋混凝土壳）
  const bx = px + w * 0.0625, by = py + h * 0.0625;
  const bw = w * 0.875, bh = h * 0.7375;   // 底边收在仪表面板上方
  const bev = w * 0.1375;                  // 切角尺寸
  const shellGrad = ctx.createLinearGradient(0, by, 0, by + bh);
  shellGrad.addColorStop(0, '#4d5866');
  shellGrad.addColorStop(0.45, '#3d4653');
  shellGrad.addColorStop(1, '#2c343f');
  ctx.fillStyle = shellGrad;
  oct(bx, by, bw, bh, bev); ctx.fill();
  ctx.strokeStyle = '#14171d';
  ctx.lineWidth = 2.5;
  oct(bx, by, bw, bh, bev); ctx.stroke();
  // 内嵌板缝亮线（双层壳体的焊接边）
  ctx.strokeStyle = 'rgba(255,255,255,0.09)';
  ctx.lineWidth = 1;
  oct(bx + 5, by + 5, bw - 10, bh - 10, bev - 5); ctx.stroke();
  // 短焊缝（内框通向外缘：西/东中点、南中点）
  ctx.strokeStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.moveTo(cx, by + bh - 6); ctx.lineTo(cx, by + bh); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx, cy); ctx.lineTo(bx + 6, cy); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(bx + bw - 6, cy); ctx.lineTo(bx + bw, cy); ctx.stroke();
  // 四角螺栓
  const bolts = [
    [px + w * 0.165, py + h * 0.165],
    [px + w * 0.835, py + h * 0.165],
    [px + w * 0.165, py + h * 0.70],
    [px + w * 0.835, py + h * 0.70]
  ];
  for (const bpos of bolts) {
    ctx.fillStyle = '#171b21';
    ctx.beginPath(); ctx.arc(bpos[0], bpos[1], 2.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#576272';
    ctx.beginPath(); ctx.arc(bpos[0], bpos[1], 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath(); ctx.arc(bpos[0] - 0.5, bpos[1] - 0.5, 0.6, 0, Math.PI * 2); ctx.fill();
  }

  // ④ 顶部通风格栅 ×2（蒸汽粒子从顶部冒出）
  for (const vx of [px + w * 0.27, px + w * 0.73]) {
    const vy = py + h * 0.115;
    ctx.fillStyle = '#181d24';
    rr(ctx, vx - 8, vy, 16, 13, 2); ctx.fill();
    ctx.strokeStyle = '#0e1116'; ctx.lineWidth = 1; rr(ctx, vx - 8, vy, 16, 13, 2); ctx.stroke();
    ctx.strokeStyle = '#3c4550';
    ctx.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(vx - 5.5, vy + 3.5 + i * 3.2);
      ctx.lineTo(vx + 5.5, vy + 3.5 + i * 3.2);
      ctx.stroke();
    }
  }

  // ⑤ 左右百叶散热窗
  for (const lx of [px + w * 0.10, px + w * 0.90 - 20]) {
    const ly = cy - 14;
    ctx.fillStyle = '#181d24';
    rr(ctx, lx, ly, 20, 28, 2); ctx.fill();
    ctx.strokeStyle = '#0e1116'; ctx.lineWidth = 1; rr(ctx, lx, ly, 20, 28, 2); ctx.stroke();
    ctx.strokeStyle = '#3c4550';
    ctx.lineWidth = 2;
    for (let i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.moveTo(lx + 3, ly + 4.5 + i * 4.6);
      ctx.lineTo(lx + 17, ly + 4.5 + i * 4.6);
      ctx.stroke();
    }
  }

  // ⑥ 辐射三叶铭牌（顶部黄漆地面标识，运行时提亮）
  const tx = cx, ty = py + h * 0.15;
  ctx.fillStyle = '#1c2027';
  ctx.beginPath(); ctx.arc(tx, ty, w * 0.069, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#0e1116'; ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(tx, ty, w * 0.069, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = burning ? '#e8c04a' : '#b3932f';
  for (let i = 0; i < 3; i++) {
    const a0 = -Math.PI / 2 + i * Math.PI * 2 / 3 - Math.PI / 6;
    const a1 = a0 + Math.PI / 3;
    ctx.beginPath();
    ctx.arc(tx, ty, w * 0.05, a0, a1);
    ctx.lineTo(tx, ty);
    ctx.closePath();
    ctx.fill();
  }
  ctx.beginPath(); ctx.arc(tx, ty, w * 0.014, 0, Math.PI * 2); ctx.fill();

  // ⑦ 中央反应堆坑：黄黑警戒条纹环
  const rimOut = w * 0.23, rimIn = w * 0.18;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, rimOut, 0, Math.PI * 2);
  ctx.arc(cx, cy, rimIn, 0, Math.PI * 2, true);
  ctx.clip();
  ctx.fillStyle = '#262b32';
  ctx.fillRect(cx - rimOut, cy - rimOut, rimOut * 2, rimOut * 2);
  ctx.strokeStyle = '#c8a23a';
  ctx.lineWidth = w * 0.031;
  const step = w * 0.055;
  for (let i = -9; i <= 9; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - rimOut + i * step, cy - rimOut - 4);
    ctx.lineTo(cx - rimOut + i * step + rimOut * 2 + 8, cy + rimOut + 4);
    ctx.stroke();
  }
  ctx.restore();
  // 环缘描边
  ctx.strokeStyle = '#111419'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, rimOut, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#0e1116'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, rimIn, 0, Math.PI * 2); ctx.stroke();

  // 堆坑内部（深色反应堆水池）
  const pitGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, rimIn);
  pitGrad.addColorStop(0, '#151d24');
  pitGrad.addColorStop(1, '#0b1015');
  ctx.fillStyle = pitGrad;
  ctx.beginPath(); ctx.arc(cx, cy, rimIn, 0, Math.PI * 2); ctx.fill();

  // ⑧ 燃料棒阵列（5×5：运行时发出蓝绿光，停堆后是暗色棒位）
  const rodGap = w * 0.053, rodR = w * 0.0165;
  for (let r = -2; r <= 2; r++) {
    for (let c = -2; c <= 2; c++) {
      const rx = cx + c * rodGap, ry = cy + r * rodGap;
      if (burning) {
        // 燃料棒亮度随呼吸脉动（0.62~1.0）
        ctx.fillStyle = 'rgba(142,255,210,' + (0.5 + 0.5 * pulse).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(rx, ry, rodR, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = '#333e49';
        ctx.beginPath(); ctx.arc(rx, ry, rodR, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1a2129';
        ctx.beginPath(); ctx.arc(rx, ry, rodR * 0.45, 0, Math.PI * 2); ctx.fill();
      }
    }
  }

  // ⑨ 控制棒驱动机构 ×4（斜向骑在坑环上：运行时提起、停堆时插底）
  const actR = w * 0.20;
  for (let i = 0; i < 4; i++) {
    const ang = Math.PI / 4 + i * Math.PI / 2;
    const ax = cx + Math.cos(ang) * actR, ay = cy + Math.sin(ang) * actR;
    // 控制棒本体（插向堆芯的细杆）
    const rodLen = burning ? actR * 0.30 : actR * 0.72;
    const ux = -Math.cos(ang), uy = -Math.sin(ang);   // 指向堆芯
    ctx.strokeStyle = '#4a5560';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(ax + ux * 5, ay + uy * 5);
    ctx.lineTo(ax + ux * rodLen, ay + uy * rodLen);
    ctx.stroke();
    ctx.strokeStyle = '#20262e';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(ax + ux * 5, ay + uy * 5);
    ctx.lineTo(ax + ux * rodLen, ay + uy * rodLen);
    ctx.stroke();
    // 驱动机构外壳
    ctx.fillStyle = '#3d4652';
    rr(ctx, ax - 4.5, ay - 4.5, 9, 9, 2); ctx.fill();
    ctx.strokeStyle = '#161a20'; ctx.lineWidth = 1.2;
    rr(ctx, ax - 4.5, ay - 4.5, 9, 9, 2); ctx.stroke();
    // 状态 LED（运行绿光 / 停堆暗红）
    ctx.fillStyle = burning ? '#7dff9e' : '#5a4040';
    ctx.beginPath(); ctx.arc(ax - 1.5, ay - 1.5, 1.2, 0, Math.PI * 2); ctx.fill();
    if (burning) {
      ctx.fillStyle = 'rgba(125,255,158,0.35)';
      ctx.beginPath(); ctx.arc(ax - 1.5, ay - 1.5, 2.4, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ⑩ 堆芯辉光（运行中：蓝绿"切伦科夫"光随堆温增亮；停堆余温：暗红微光）
  if (burning) {
    const a = (0.38 + 0.45 * wPct) * pulse;
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.28);
    glow.addColorStop(0, 'rgba(150,255,220,' + (a * 0.85).toFixed(3) + ')');
    glow.addColorStop(0.45, 'rgba(110,240,200,' + (a * 0.45).toFixed(3) + ')');
    glow.addColorStop(1, 'rgba(110,240,200,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, w * 0.28, 0, Math.PI * 2); ctx.fill();
    // 堆芯白热中心
    ctx.fillStyle = 'rgba(225,255,242,' + (0.35 + 0.3 * pulse * (0.4 + 0.6 * wPct)).toFixed(3) + ')';
    ctx.beginPath(); ctx.arc(cx, cy, w * 0.05, 0, Math.PI * 2); ctx.fill();
    // 呼吸涟漪：两圈错相扩散的光环，从堆芯扩散到警戒环外缘，让"呼吸"肉眼可见
    for (let k = 0; k < 2; k++) {
      const rt = (((G.time || 0) * 0.9) + k * 0.5) % 1;   // 0→1 循环，两圈错开半周期
      const rrr = w * 0.06 + (w * 0.22 - w * 0.06) * rt;  // 半径：堆芯 → 警戒环外缘
      ctx.strokeStyle = 'rgba(140,255,215,' + (0.4 * (1 - rt)).toFixed(3) + ')';
      ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.arc(cx, cy, rrr, 0, Math.PI * 2); ctx.stroke();
    }
  } else if (wPct > 0.05) {
    const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, w * 0.17);
    glow.addColorStop(0, 'rgba(255,110,50,' + (0.30 * wPct).toFixed(3) + ')');
    glow.addColorStop(1, 'rgba(255,110,50,0)');
    ctx.fillStyle = glow;
    ctx.beginPath(); ctx.arc(cx, cy, w * 0.17, 0, Math.PI * 2); ctx.fill();
  }

  // ⑪ 底部仪表面板（堆温条 + 燃料条，沿用原坐标与配色）
  ctx.fillStyle = '#161a20';
  rr(ctx, px + 9, py + h - 31, w - 18, 24, 4); ctx.fill();
  ctx.strokeStyle = '#0c0f13'; ctx.lineWidth = 1.5;
  rr(ctx, px + 9, py + h - 31, w - 18, 24, 4); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(px + 13, py + h - 30); ctx.lineTo(px + w - 13, py + h - 30); ctx.stroke();
  // 堆温条（温度 / 最高温度 1000°C）
  ctx.fillStyle = '#0d1115';
  rr(ctx, px + 12, py + h - 22, w - 24, 6, 3); ctx.fill();
  if (wPct > 0) {
    const hg = ctx.createLinearGradient(0, py + h - 22, 0, py + h - 16);
    hg.addColorStop(0, '#f2a850');
    hg.addColorStop(1, '#c47a2e');
    ctx.fillStyle = hg;
    rr(ctx, px + 12, py + h - 22, (w - 24) * wPct, 6, 3); ctx.fill();
  }
  // 燃料条（当前燃料棒燃剩）
  ctx.fillStyle = '#0d1115';
  rr(ctx, px + 12, py + h - 14, w - 24, 6, 3); ctx.fill();
  if (fp > 0) {
    const fg = ctx.createLinearGradient(0, py + h - 14, 0, py + h - 8);
    fg.addColorStop(0, '#b6ec84');
    fg.addColorStop(1, '#7cb851');
    ctx.fillStyle = fg;
    rr(ctx, px + 12, py + h - 14, (w - 24) * fp, 6, 3); ctx.fill();
  }
  // 高温警示（>85% 时红光呼吸）
  if (wPct > 0.85) {
    ctx.fillStyle = 'rgba(255,64,44,' + (0.16 + 0.14 * Math.sin((G.time || 0) * 9)).toFixed(3) + ')';
    rr(ctx, px + 12, py + h - 22, w - 24, 6, 3); ctx.fill();
  }
  // 刻度线（25/50/75%）
  ctx.fillStyle = 'rgba(13,17,21,0.85)';
  for (const t of [0.25, 0.5, 0.75]) {
    ctx.fillRect(px + 12 + (w - 24) * t, py + h - 22, 1, 6);
    ctx.fillRect(px + 12 + (w - 24) * t, py + h - 14, 1, 6);
  }

  // ⑫ 热量出口（黄色线标注，与热交换器热交换接口同款样式）
  // 对齐官方 heat_buffer.connections：核反应堆四边（北/东/南/西）各 3 个热交换接口，
  // 5 格边中仅第 1/3/5 格（相对中心 -2/0/+2）有接口，而非整条边均布。
  // 接口外侧相邻格接上导热管/热交换器时亮黄，未连接时暗黄，方便核对接口是否对上。
  ctx.lineWidth = 3;
  ctx.lineCap = 'butt';
  const cRx = px + w / 2, cRy = py + h / 2;   // 反应堆中心
  const hC = [ -2 * TILE, 0, 2 * TILE ];      // 每条边 3 个连接点（相对中心）
  // 判定某条边第 o 格（-2/0/+2）外侧相邻格是否为可传热设备（导热管/热交换器）
  const rx0 = e.x, ry0 = e.y;
  const half = ((e.w / 2) | 0);
  const portLit = (side, o) => {
    const cxp = rx0 + half + o, cyp = ry0 + half + o;
    let nx, ny;
    if (side === 3) { nx = cxp; ny = ry0 - 1; }        // 北
    else if (side === 1) { nx = cxp; ny = ry0 + e.h; } // 南
    else if (side === 0) { nx = rx0 + e.w; ny = cyp; } // 东
    else { nx = rx0 - 1; ny = cyp; }                   // 西
    const t = entAt(nx, ny);
    return !!t && !t._dead && ((t instanceof HeatPipe) || (t instanceof HeatExchanger));
  };
  const drawHeatSeg = (x0, y0, x1, y1, lit) => {
    ctx.strokeStyle = lit ? '#ffd23a' : 'rgba(255,210,58,0.28)';
    ctx.beginPath();
    ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
    ctx.stroke();
  };
  // 上边（北）
  for (const dx of hC) drawHeatSeg(cRx + dx - TILE * 0.22, py + 3, cRx + dx + TILE * 0.22, py + 3, portLit(3, Math.round(dx / TILE)));
  // 下边（南）
  for (const dx of hC) drawHeatSeg(cRx + dx - TILE * 0.22, py + h - 3, cRx + dx + TILE * 0.22, py + h - 3, portLit(1, Math.round(dx / TILE)));
  // 左边（西）
  for (const dy of hC) drawHeatSeg(px + 3, cRy + dy - TILE * 0.22, px + 3, cRy + dy + TILE * 0.22, portLit(2, Math.round(dy / TILE)));
  // 右边（东）
  for (const dy of hC) drawHeatSeg(px + w - 3, cRy + dy - TILE * 0.22, px + w - 3, cRy + dy + TILE * 0.22, portLit(0, Math.round(dy / TILE)));
  ctx.globalAlpha = 1;
}
function reactorPanelHtml(e) {
  let h = row('铀燃料棒', e.fuel > 0 ? '<div class="asm3-inp-row">' + itemSlotsHtml({ 'uranium-fuel-cell': e.fuel }, { action: 'display' }) + '</div>' : '<span class="dim">无</span>', 'fuel');
  if (invCount('uranium-fuel-cell') > 0)
    h += '<button data-action="fuel" data-id="uranium-fuel-cell">装入铀燃料棒 (' + invCount('uranium-fuel-cell') + ')</button>';
  h += row('贫化铀燃料棒', '<span class="dim"></span>', 'spent');
  h += '<button data-action="takeout" id="btn-spent-takeout" style="display:none"></button>';
  h += row('堆芯温度', '', 'heat');
  h += row('堆芯温度上限', '', 'temp');
  h += '<div class="dim">核反应堆：消耗铀燃料棒产生巨量热量，经四边（北/东/南/西）黄色热量接口传给导热管（对齐官方 heat_buffer.connections，每条 5 格边仅中间 3 格有热交换接口，非整条边均布，导热管/热交换器须对准接口格才传热），再由导热管把热量送到热交换器（热交换器须接其热交换口），由热交换器把水烧成高温蒸汽供汽轮机发电（对齐《异星工厂》核能标准链路，反应堆仅消耗铀燃料棒而非核燃料）。燃尽的燃料会留下贫化铀燃料棒，可在离心机再生为铀-238，闭合核燃料循环。核能技术解锁。</div>';
  h += '<div class="dim">💡 相邻加成：并排摆放多座反应堆，每座相邻反应堆使输出 +100%（对齐《异星工厂》）。</div>';
  h += '<div class="dim">🔗 标准接法：反应堆→(导热管)→热交换器（接水管）→(蒸汽管)→汽轮机</div>';
  return h;
}
function reactorPanelLive(e, api) {
  api.set('fuel', e.fuel > 0 ? '<div class="asm3-inp-row">' + itemSlotsHtml({ 'uranium-fuel-cell': e.fuel }, { action: 'display' }) + '</div>' : dimSpan('无'));
  api.set('spent', e.spent > 0 ? '<div class="asm3-inp-row">' + itemSlotsHtml({ 'depleted-uranium-fuel-cell': e.spent }, { action: 'take-slot' }) + '</div>' : dimSpan('无'));
  api.toggle('#btn-spent-takeout', e.spent > 0, '取回贫化铀燃料棒 (' + e.spent + ')');
  const _temp = e.temperature();
  api.set('heat', _temp >= 1 ? chip('heat-pipe', Math.round(_temp) + '°C') : dimSpan('空'));
  api.set('temp', Math.round(_temp) + ' / ' + HEAT_MAX_TEMP + ' °C');
  // 进度条显示当前燃料棒消耗进度（剩余燃烧时间占比），对齐《异星工厂》反应堆燃料槽显示
  const fuelPct = e.burning && e.burnLeft > 0 ? Math.max(0, Math.min(100, (e.burnLeft || 0) / REACTOR_FUEL_ENERGY * 100)) : 0;
  api.prog(fuelPct, REACTOR_FUEL_ENERGY);
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
      if (pipeConnAt(n.x, n.y, sideFromEntity(this, n))) {
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
// ===== 汽轮机渲染：3×5 立式轴流汽轮发电机组 =====
// 与蒸汽机（往复式：飞轮+活塞）区分：这里是真正的轴流式汽轮机。
// 视觉分区（自上而下，虚拟竖向画布，随 dir 旋转对齐北向汽口）：
//   ① 进汽颈 + 进汽室（压力表 + 青铜阀轮）  ② 上法兰（螺栓）
//   ③ 汽缸外壳（银灰渐变 + 焊接筋板）+ 观察窗（3 级叶轮旋转 + 青色蒸汽流）
//   ④ 下法兰 + 联轴器  ⑤ 发电机（深青蓝 + 铜绕组 + LCD 功率读数 + 状态 LED）
//   ⑥ 排汽短管（对接南向汽口）  ⑦ 右侧旁通蒸汽管（连通进汽室与排汽口，解释双汽口串接）
//   ⑧ 基座（防振垫）  ⑨ 外框
function drawSteamTurbine(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const w = TILE * e.w, h = TILE * e.h;
  const om = Math.max(0, Math.min(1, e.outMult || 0));                       // 负载率
  const steam = Math.max(0, Math.min(1, (e.steamBuf || 0) / TURBINE_STEAM_CAP)); // 汽压占比
  const _d = (e.dir | 0) % 4;
  ctx.globalAlpha = alpha;

  // —— 随 dir 旋转到统一「竖向」画布绘制：虚拟上端=进汽端，始终对准北向(pN)汽口 ——
  //    dir1 → +90°（虚拟北→东）、dir2 → 180°、dir3 → -90°（虚拟北→西），与 rotCell/rotSide 映射一致
  ctx.save();
  let rotT = 0;
  if (_d === 1 || _d === 3) {
    rotT = _d === 1 ? Math.PI / 2 : -Math.PI / 2;
    ctx.translate(px + w / 2, py + h / 2);
    ctx.rotate(rotT);
    ctx.translate(-(px + h / 2), -(py + w / 2));
  } else if (_d === 2) {
    rotT = Math.PI;
    ctx.translate(px + w / 2, py + h / 2);
    ctx.rotate(Math.PI);
    ctx.translate(-(px + w / 2), -(py + h / 2));
  }
  const vw = (_d === 1 || _d === 3) ? h : w;   // 虚拟竖向画布宽/高（3×5 → 96×160）
  const vh = (_d === 1 || _d === 3) ? w : h;
  const cx = px + vw / 2;
  const T = (G.time || 0);

  // 抛光银灰圆柱质感（左暗→高光→右暗，模拟立式缸体受光）
  const silver = (x0, x1) => {
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, '#66727e');
    g.addColorStop(0.35, '#d9e1e8');
    g.addColorStop(0.62, '#93a1ad');
    g.addColorStop(1, '#4b5762');
    return g;
  };
  const bolt = (bx, by) => {   // 设备角螺栓（家族同款）
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.beginPath(); ctx.arc(bx, by, 2.1, 0, 7); ctx.fill();
    ctx.fillStyle = '#26313c';
    ctx.beginPath(); ctx.arc(bx, by, 1.5, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(220,235,245,.4)';
    ctx.beginPath(); ctx.arc(bx - 0.4, by - 0.4, 0.6, 0, 7); ctx.fill();
  };
  const fBolt = (bx, by) => {  // 法兰小螺栓
    ctx.fillStyle = 'rgba(0,0,0,.5)';
    ctx.beginPath(); ctx.arc(bx, by, 1.7, 0, 7); ctx.fill();
    ctx.fillStyle = '#2e3a44';
    ctx.beginPath(); ctx.arc(bx, by, 1.2, 0, 7); ctx.fill();
  };

  // ⑦ 右侧旁通蒸汽管（先画：被法兰/缸体压住一截，显得从缸体后侧穿过）
  const pipePath = () => {
    ctx.beginPath();
    ctx.moveTo(px + 81, py + 25);
    ctx.lineTo(px + 87, py + 25);
    ctx.lineTo(px + 87, py + 142);
    ctx.lineTo(px + 63, py + 142);
  };
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  ctx.strokeStyle = '#3c4650';
  ctx.lineWidth = 7;
  pipePath(); ctx.stroke();
  ctx.strokeStyle = '#6a7884';
  ctx.lineWidth = 5;
  pipePath(); ctx.stroke();
  if (steam > 0.02) {   // 管内蒸汽流动（虚线滚动）
    ctx.strokeStyle = 'rgba(140,225,255,' + (0.22 + 0.4 * Math.max(om, steam * 0.6)).toFixed(2) + ')';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 8]);
    ctx.lineDashOffset = -T * 22;
    pipePath(); ctx.stroke();
    ctx.setLineDash([]);
  }
  for (const pyy of [py + 34, py + 132]) {   // 管段法兰环
    ctx.fillStyle = '#57646f';
    ctx.beginPath(); ctx.arc(px + 87, pyy, 3.6, 0, 7); ctx.fill();
    ctx.strokeStyle = '#26313c'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(px + 87, pyy, 3.6, 0, 7); ctx.stroke();
  }

  // ⑧ 基座 + 防振垫（先画，发电机/排汽管压在其上）
  ctx.fillStyle = '#141e28';
  rr(ctx, px + 6, py + 149, 84, 8, 3); ctx.fill();
  ctx.strokeStyle = '#0c141c'; ctx.lineWidth = 1;
  rr(ctx, px + 6, py + 149, 84, 8, 3); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.07)';
  ctx.fillRect(px + 9, py + 150, 78, 1);
  ctx.fillStyle = '#0c141c';
  rr(ctx, px + 11, py + 153, 10, 3.5, 1.5); ctx.fill();
  rr(ctx, px + 75, py + 153, 10, 3.5, 1.5); ctx.fill();

  // ① 进汽颈（对接北向汽口法兰）+ 进汽室
  ctx.fillStyle = silver(px + 40, px + 56);
  ctx.fillRect(px + 41, py + 5, 14, 8);
  ctx.strokeStyle = '#26313c'; ctx.lineWidth = 1;
  ctx.strokeRect(px + 41, py + 5, 14, 8);
  ctx.fillStyle = silver(px + 16, px + 80);
  rr(ctx, px + 16, py + 10, 64, 30, 7); ctx.fill();
  ctx.strokeStyle = '#26313c'; ctx.lineWidth = 2;
  rr(ctx, px + 16, py + 10, 64, 30, 7); ctx.stroke();
  // 压力表（指针随汽压摆动，运行中轻微抖动）
  const gx0 = px + 30, gy0 = py + 24, gr = 6.5;
  ctx.fillStyle = '#e9eef2';
  ctx.beginPath(); ctx.arc(gx0, gy0, gr, 0, 7); ctx.fill();
  ctx.strokeStyle = '#26313c'; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(gx0, gy0, gr, 0, 7); ctx.stroke();
  ctx.strokeStyle = '#d9584a'; ctx.lineWidth = 1.6;   // 红色警戒区
  ctx.beginPath(); ctx.arc(gx0, gy0, gr - 2.2, -2.3, -1.6); ctx.stroke();
  ctx.strokeStyle = '#55636f'; ctx.lineWidth = 1;     // 刻度
  for (const ta of [-2.6, -1.57, -0.55]) {
    ctx.beginPath();
    ctx.moveTo(gx0 + Math.cos(ta) * (gr - 1.5), gy0 + Math.sin(ta) * (gr - 1.5));
    ctx.lineTo(gx0 + Math.cos(ta) * (gr - 3.2), gy0 + Math.sin(ta) * (gr - 3.2));
    ctx.stroke();
  }
  const na = -2.6 + 2.05 * Math.max(om, steam) + (om > 0.05 ? Math.sin(T * 5) * 0.07 : 0);
  ctx.strokeStyle = '#c8452e'; ctx.lineWidth = 1.3;   // 指针
  ctx.beginPath();
  ctx.moveTo(gx0, gy0);
  ctx.lineTo(gx0 + Math.cos(na) * (gr - 2.4), gy0 + Math.sin(na) * (gr - 2.4));
  ctx.stroke();
  ctx.fillStyle = '#26313c';
  ctx.beginPath(); ctx.arc(gx0, gy0, 1.3, 0, 7); ctx.fill();
  // 青铜阀轮（进汽截止阀）
  const wx0 = px + 67, wy0 = py + 24, wr = 5.5;
  ctx.strokeStyle = '#b58a3e'; ctx.lineWidth = 1.8;
  ctx.beginPath(); ctx.arc(wx0, wy0, wr, 0, 7); ctx.stroke();
  for (let i = 0; i < 3; i++) {
    const sa = i * Math.PI * 2 / 3 + 0.5;
    ctx.beginPath();
    ctx.moveTo(wx0 - Math.cos(sa) * wr, wy0 - Math.sin(sa) * wr);
    ctx.lineTo(wx0 + Math.cos(sa) * wr, wy0 + Math.sin(sa) * wr);
    ctx.stroke();
  }
  ctx.fillStyle = '#8a6528';
  ctx.beginPath(); ctx.arc(wx0, wy0, 1.8, 0, 7); ctx.fill();

  // ② 上法兰（进汽室↔汽缸）
  const flange = (fy) => {
    ctx.fillStyle = '#7a8894';
    rr(ctx, px + 10, fy, 76, 7, 3); ctx.fill();
    ctx.strokeStyle = '#26313c'; ctx.lineWidth = 1.2;
    rr(ctx, px + 10, fy, 76, 7, 3); ctx.stroke();
    ctx.fillStyle = 'rgba(230,240,248,.28)';
    ctx.fillRect(px + 13, fy + 1, 70, 1);
  };
  flange(py + 36);
  for (const bx of [px + 16, px + 36, px + 60, px + 80]) fBolt(bx, py + 39.5);

  // ③ 汽缸外壳（银灰渐变）+ 焊接筋板
  ctx.fillStyle = silver(px + 12, px + 84);
  rr(ctx, px + 12, py + 42, 72, 74, 8); ctx.fill();
  ctx.strokeStyle = '#26313c'; ctx.lineWidth = 2;
  rr(ctx, px + 12, py + 42, 72, 74, 8); ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const rx = px + [18, 24, 72, 78][i];
    ctx.fillStyle = i % 2 === 0 ? 'rgba(0,0,0,.18)' : 'rgba(255,255,255,.12)';
    ctx.fillRect(rx, py + 48, 1.4, 62);
  }
  // 观察窗：深色内腔 + 青色蒸汽辉光 + 3 级叶轮（高压级→低压级，半径逐级增大）
  const winX = px + 30, winY = py + 46, winW = 36, winH = 66;
  ctx.fillStyle = '#131e27';
  rr(ctx, winX, winY, winW, winH, 11); ctx.fill();
  if (steam > 0.02 || om > 0.02) {
    const wg = ctx.createRadialGradient(cx, py + 79, 4, cx, py + 79, 40);
    wg.addColorStop(0, 'rgba(140,225,255,' + (0.10 + 0.30 * Math.max(om, steam * 0.5)).toFixed(2) + ')');
    wg.addColorStop(1, 'rgba(140,225,255,0)');
    ctx.fillStyle = wg;
    rr(ctx, winX, winY, winW, winH, 11); ctx.fill();
  }
  const stages = [[py + 56, 8], [py + 76, 9], [py + 99, 11]];
  for (let i = 0; i < stages.length; i++) {
    const sy = stages[i][0], sr = stages[i][1];
    if (om > 0.08) {   // 高速运动模糊光环
      ctx.strokeStyle = 'rgba(190,230,255,' + (0.10 + om * 0.14).toFixed(2) + ')';
      ctx.lineWidth = sr * 0.55;
      ctx.beginPath(); ctx.arc(cx, sy, sr * 0.6, 0, 7); ctx.stroke();
    }
    const dg = ctx.createRadialGradient(cx - 2, sy - 2, 1, cx, sy, sr);   // 轮盘
    dg.addColorStop(0, '#cdd8e1'); dg.addColorStop(0.7, '#8b98a4'); dg.addColorStop(1, '#4c5a66');
    ctx.fillStyle = dg;
    ctx.beginPath(); ctx.arc(cx, sy, sr, 0, 7); ctx.fill();
    ctx.save();   // 8 片动叶（低压级转速略低、相位错开）
    ctx.translate(cx, sy);
    ctx.rotate((e.spin || 0) * (1 - i * 0.1) + i * 1.1);
    for (let b = 0; b < 8; b++) {
      ctx.save(); ctx.rotate(b * Math.PI / 4);
      ctx.fillStyle = '#e2eaf1';
      ctx.fillRect(-0.9, -sr + 1, 1.8, sr - 3.2);
      ctx.restore();
    }
    ctx.fillStyle = '#57646f';   // 轮毂
    ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(230,240,248,.55)';
    ctx.beginPath(); ctx.arc(-0.5, -0.5, 0.8, 0, 7); ctx.fill();
    ctx.restore();
  }
  if (steam > 0.03 || om > 0.03) {   // 汽流虚线（自上而下穿过叶轮）
    ctx.strokeStyle = 'rgba(160,232,255,' + (0.22 + 0.3 * om).toFixed(2) + ')';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([4, 10]);
    ctx.lineDashOffset = -T * 30 * (0.4 + 0.6 * om);
    for (const sx of [px + 42, px + 54]) {
      ctx.beginPath(); ctx.moveTo(sx, py + 48); ctx.lineTo(sx, py + 110); ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  ctx.fillStyle = 'rgba(220,240,255,.07)';   // 玻璃反光
  rr(ctx, px + 34, py + 50, 5, 58, 3); ctx.fill();
  ctx.strokeStyle = '#26313c'; ctx.lineWidth = 2;   // 窗框
  rr(ctx, winX, winY, winW, winH, 11); ctx.stroke();
  ctx.strokeStyle = 'rgba(230,240,248,.22)'; ctx.lineWidth = 1;
  rr(ctx, winX + 1.5, winY + 1.5, winW - 3, winH - 3, 9.5); ctx.stroke();

  // ④ 下法兰（汽缸↔联轴器）
  flange(py + 112);
  fBolt(px + 16, py + 115.5); fBolt(px + 80, py + 115.5);

  // ⑤ 发电机（深青蓝外壳 + 两侧铜绕组 + LCD 功率屏）
  const gg = ctx.createLinearGradient(0, py + 126, 0, py + 154);
  gg.addColorStop(0, '#35586c'); gg.addColorStop(0.55, '#20404f'); gg.addColorStop(1, '#132937');
  ctx.fillStyle = gg;
  rr(ctx, px + 10, py + 126, 72, 28, 6); ctx.fill();
  ctx.strokeStyle = '#10222e'; ctx.lineWidth = 2;
  rr(ctx, px + 10, py + 126, 72, 28, 6); ctx.stroke();
  const coil = (cxx) => {   // 定子铜绕组条（分段线圈）
    ctx.fillStyle = '#c07a3e';
    rr(ctx, cxx, py + 129, 5, 18, 2.5); ctx.fill();
    ctx.strokeStyle = '#8a5426'; ctx.lineWidth = 0.8;
    for (let yy = py + 132; yy < py + 147; yy += 4.5) {
      ctx.beginPath(); ctx.moveTo(cxx, yy); ctx.lineTo(cxx + 5, yy); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(240,200,140,.4)';
    ctx.fillRect(cxx + 1, py + 129.8, 1.2, 16);
  };
  coil(px + 13); coil(px + 74);
  ctx.fillStyle = '#0c161e';   // LCD 功率屏
  rr(ctx, px + 20, py + 129, 48, 15, 4); ctx.fill();
  ctx.strokeStyle = 'rgba(127,232,255,.28)'; ctx.lineWidth = 1;
  rr(ctx, px + 20, py + 129, 48, 15, 4); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,.3)';   // 散热格栅
  rr(ctx, px + 22, py + 147, 8, 3, 1.5); ctx.fill();
  rr(ctx, px + 64, py + 147, 8, 3, 1.5); ctx.fill();
  // 状态 LED（运行=绿 / 有汽待机=黄 / 停机=暗）
  ctx.fillStyle = om > 0.02 ? '#9ce06c' : ((e.steamBuf || 0) > 0 ? '#ffd23c' : '#37475a');
  ctx.beginPath(); ctx.arc(px + 15.5, py + 150.5, 1.8, 0, 7); ctx.fill();
  if (om > 0.02) {
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.beginPath(); ctx.arc(px + 15, py + 150, 0.6, 0, 7); ctx.fill();
  }
  // 功率读数（始终水平显示，不随机体旋转）
  ctx.save();
  ctx.translate(px + 44, py + 136.5);
  if (rotT) ctx.rotate(-rotT);
  ctx.font = 'bold 10px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const ps = '+' + ((e.powerOut || 0) / 1000).toFixed(1) + ' MW';
  if (om > 0.02) {
    ctx.fillStyle = 'rgba(127,232,255,.3)';
    ctx.fillText(ps, 0, 0);
  }
  ctx.fillStyle = om > 0.02 ? '#7fe8ff' : '#44525e';
  ctx.fillText(ps, 0, 0);
  ctx.restore();

  // ④ 联轴器（缸体→发电机传动轴，压在发电机顶上）
  ctx.fillStyle = '#8d9aa6';
  ctx.fillRect(px + 42, py + 117, 12, 11);
  ctx.strokeStyle = '#26313c'; ctx.lineWidth = 1;
  ctx.strokeRect(px + 42, py + 117, 12, 11);
  ctx.fillStyle = '#6a7884';
  rr(ctx, px + 34, py + 119, 28, 9, 3); ctx.fill();
  ctx.strokeStyle = '#26313c'; ctx.lineWidth = 1.2;
  rr(ctx, px + 34, py + 119, 28, 9, 3); ctx.stroke();
  ctx.fillStyle = 'rgba(230,240,248,.3)';
  ctx.fillRect(px + 37, py + 120.5, 22, 1);
  fBolt(px + 38, py + 123.5); fBolt(px + 58, py + 123.5);

  // ⑥ 排汽短管（对接南向汽口，多台汽轮机串接时蒸汽由此送往下一台）
  const eg = ctx.createLinearGradient(px + 38, 0, px + 62, 0);
  eg.addColorStop(0, '#66727e'); eg.addColorStop(0.4, '#a8b4be'); eg.addColorStop(1, '#4b5762');
  ctx.fillStyle = eg;
  rr(ctx, px + 38, py + 144, 24, 14, 3); ctx.fill();
  ctx.strokeStyle = '#26313c'; ctx.lineWidth = 1.4;
  rr(ctx, px + 38, py + 144, 24, 14, 3); ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1;
  for (const ry of [py + 149, py + 153]) {
    ctx.beginPath(); ctx.moveTo(px + 40, ry); ctx.lineTo(px + 60, ry); ctx.stroke();
  }
  if (om > 0.1) {   // 排汽口轻微蒸汽溢散
    for (let i = 0; i < 2; i++) {
      const ph = (T * 0.9 + i * 0.5) % 1;
      ctx.fillStyle = 'rgba(210,235,245,' + ((1 - ph) * 0.22 * om).toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(px + 42 + i * 13, py + 142 - ph * 8, 2.4 + ph * 2.5, 0, 7);
      ctx.fill();
    }
  }

  // 角螺栓 + ⑨ 外框
  bolt(px + 21, py + 15); bolt(px + 75, py + 15);
  ctx.strokeStyle = '#26313c'; ctx.lineWidth = 2.4;
  rr(ctx, px + 3, py + 3, vw - 6, vh - 6, 9); ctx.stroke();

  ctx.restore();

  // 窄边(3)中部汽口：上/下两端中部各一只通用汽口，蒸汽可进可出，支持多台汽轮机串接（对齐官方：蒸汽入口在南北两侧，随 dir 旋转，画在设备内部边缘）
  const pN = rotCell(e, e.def.w >> 1, 0);
  const pS = rotCell(e, e.def.w >> 1, e.def.h - 1);
  const cD = TILE / 2 - 1; // 端口凸缘贴合设备内部边缘
  drawPort(ctx, pN.x * TILE + TILE / 2, pN.y * TILE + TILE / 2, rotSide(3, _d), ITEMS['steam'].color, true, 0, cD, 'steam', 'both');
  drawPort(ctx, pS.x * TILE + TILE / 2, pS.y * TILE + TILE / 2, rotSide(1, _d), ITEMS['steam'].color, true, 0, cD, 'steam', 'both');
  ctx.globalAlpha = 1;
}
function turbinePanelHtml(e) {
  return row('功率输出', '<span class="dim"></span>', 'power') +
    row('蒸汽缓存', '<span class="dim"></span>', 'steam') +
    '<div class="dim">汽轮机：上/下两端中部汽口接入高温蒸汽（来自热交换器上边(北)出汽口/蒸汽管道），以远高于蒸汽机的功率发电。核能技术解锁。</div>';
}
function turbinePanelLive(e, api) {
  api.set('power', '+' + (e.powerOut || 0).toFixed(0) + ' kW');
  api.set('steam', e.steamBuf >= 1 ? '<div class="asm3-inp-row">' + itemSlotsHtml({ steam: Math.floor(e.steamBuf) }, { action: 'display' }) + '</div>' : dimSpan('空'));
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
      // 热交换器只在其热交换接口格接收/输出热量（官方 connections），未对上不传热
      if (n instanceof HeatExchanger && !heatDevicesConnectedViaPort(n, this)) return;
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
  // 相邻格是否有可连接的导热设备（与 heatFlow 逻辑判定完全一致，对齐官方 heat_buffer.connections）：
  // 导热管全向连接；反应堆仅四边 3 个热量接口格；供热塔四边中心各 1 格；
  // 热交换器/聚变发电机仅其热交换接口格（默认下边(南)中间，随 dir 旋转）。
  const nx = e.x + dx, ny = e.y + dy;
  const nb = entAt(nx, ny);
  if (!nb || nb._dead) return false;
  if (nb instanceof HeatPipe) return true;
  if (nb instanceof HeatExchanger || nb instanceof FusionGenerator) {
    // 与传热逻辑（heatDevicesConnectedViaPort）完全一致：接口外侧相邻格被本导热管占据即连通，
    // 该格必与本导热管正交相邻，等价于 nx/ny 落在接口外侧格。
    return heatDevicesConnectedViaPort(nb, e);
  }
  if (nb instanceof NuclearReactor || nb instanceof HeatingTower) {
    // 反应堆：5 格边仅第 1/3/5 格（-2/0/+2）有接口；供热塔：四边中心各 1 格
    return heatDevicesConnectedViaPort(nb, e);
  }
  return false;
}
// 颜色插值小工具（核能设备局部使用）：'#rrggbb' 两色按 t∈[0,1] 混合
function _heatMix(a, b, t) {
  t = Math.max(0, Math.min(1, t));
  const av = [parseInt(a.slice(1, 3), 16), parseInt(a.slice(3, 5), 16), parseInt(a.slice(5, 7), 16)];
  const bv = [parseInt(b.slice(1, 3), 16), parseInt(b.slice(3, 5), 16), parseInt(b.slice(5, 7), 16)];
  return 'rgb(' + Math.round(av[0] + (bv[0] - av[0]) * t) + ',' + Math.round(av[1] + (bv[1] - av[1]) * t) + ',' + Math.round(av[2] + (bv[2] - av[2]) * t) + ')';
}

// 渲染：细金属导热管——相邻导热设备自动连接，直通/L/T/十字自动连通。
// 衔接策略（消除相邻格叠加渲染）：每格只画「中心 → 各连接边」的半段（对向直通为贯穿段），
// 相邻两格的半段在格边界平头对接、互不重叠；同一格内多段合并成单一 path 一次描边，
// 交叉区域按并集填充、不重复叠加；L/T/十字交汇处用金属节点圆补出圆角。
// 层次（外→内）：炽热泛光 → 深色管壳 → 钢灰渐变壳（横管垂直渐变/竖管水平渐变，圆柱质感）→
// 管壳上缘高光线 → 金属节点圆 → 导热内芯 → 发光芯辉线；自由端带法兰套环，
// 达到发光温度(350°C)后内芯由暗灰转为炽橙并随温度增亮（官方 minimum_glow_temperature）。
function drawHeatPipe(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  // 四向连接检测
  const cn = heatPipeConnect(e, 0, -1);   // 北
  const cs = heatPipeConnect(e, 0, 1);    // 南
  const cw = heatPipeConnect(e, -1, 0);  // 西
  const ce = heatPipeConnect(e, 1, 0);    // 东
  // 温度占比 + 是否达到最低发光温度 350°C（官方 minimum_glow_temperature）
  const temp = e.temperature();
  const hp = Math.max(0, Math.min(1, temp / HEAT_MAX_TEMP));
  const glow = temp >= HEAT_PIPE_MIN_GLOW_TEMP;

  // 管道尺寸：保持细管道观感
  const R = 7;      // 管体外半径
  const rIn = 3.5;  // 导热芯半径

  // 半段端点只取到本格边缘：相邻格各自绘制自己的半段，在格边界平头对接，互不重叠
  const eN = [cx, py], eS = [cx, py + TILE], eW = [px, cy], eE = [px + TILE, cy];
  const segs = [];
  if (cw && ce) {
    segs.push([eW[0], eW[1], eE[0], eE[1]]);    // 西—东直通（贯穿本格）
  } else {
    if (cw) segs.push([eW[0], eW[1], cx, cy]);  // 中心→西边
    if (ce) segs.push([cx, cy, eE[0], eE[1]]);  // 中心→东边
  }
  if (cn && cs) {
    segs.push([eN[0], eN[1], eS[0], eS[1]]);    // 北—南直通（贯穿本格）
  } else {
    if (cn) segs.push([eN[0], eN[1], cx, cy]);  // 中心→北边
    if (cs) segs.push([cx, cy, eS[0], eS[1]]);  // 中心→南边
  }
  // 是否存在转弯/路口（同时有横、纵连接）→ 需画中心节点圆补圆角并盖住交叉亮线
  const isJunction = (cn || cs) && (cw || ce);
  // 孤立导热管（四向均无连接）：画成一截细长管道（而非圆点），两端带法兰，
  // 让 Q 复制/单根导热管的光标与地图上的管道观感一致。
  const stubLen = TILE * 0.55;
  if (segs.length === 0) segs.push([cx - stubLen, cy, cx + stubLen, cy]);
  const connCount = (cn?1:0) + (cs?1:0) + (cw?1:0) + (ce?1:0);

  // 段方向：是否为沿 x 延伸的横向段（横/竖渐变方向不同，需分开描边）
  const horiz = s => Math.abs(s[3] - s[1]) < Math.abs(s[2] - s[0]);
  const hSegs = segs.filter(horiz), vSegs = segs.filter(s => !horiz(s));

  // 多段合并为单一 path 一次描边：同格内 L/T/十字的交叉区域按并集填充、不重复叠加。
  // ext>0 时把落在格边界上的对接端点向外延伸（仅用于不透明层，补齐抗锯齿缝隙；
  // 半透明层严格画到边界，避免相邻格叠加发亮）。
  const strokeSegs = (list, width, style, ext) => {
    if (!list.length) return;
    ctx.lineCap = 'butt';
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (const s of list) {
      let x0 = s[0], y0 = s[1], x1 = s[2], y1 = s[3];
      if (ext) {
        if (y0 === cy && x0 === px) x0 -= ext;                 // 西边界端
        else if (y0 === cy && x0 === px + TILE) x0 += ext;     // 东边界端
        else if (x0 === cx && y0 === py) y0 -= ext;            // 北边界端
        else if (x0 === cx && y0 === py + TILE) y0 += ext;     // 南边界端
        if (y1 === cy && x1 === px) x1 -= ext;
        else if (y1 === cy && x1 === px + TILE) x1 += ext;
        else if (x1 === cx && y1 === py) y1 -= ext;
        else if (x1 === cx && y1 === py + TILE) y1 += ext;
      }
      ctx.moveTo(x0, y0);
      ctx.lineTo(x1, y1);
    }
    ctx.stroke();
  };
  // 平行于管轴的细线（高光/辉线）：横段取 y=cy-off、竖段取 x=cx-off；全段合一 path，
  // 单次描边交叉处不叠加；严格画到本格边界，跨格对接连续。
  const strokeOffsetLine = (width, style, off) => {
    ctx.lineCap = 'butt';
    ctx.strokeStyle = style;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (const s of segs) {
      if (horiz(s)) { ctx.moveTo(s[0], cy - off); ctx.lineTo(s[2], cy - off); }
      else { ctx.moveTo(cx - off, s[1]); ctx.lineTo(cx - off, s[3]); }
    }
    ctx.stroke();
  };

  ctx.globalAlpha = alpha;

  // ---- ① 炽热泛光（最底层，沿管外发橙光；单 path 描边，路口交叉不叠加）----
  if (glow) strokeSegs(segs, (R + 5) * 2, 'rgba(255,150,60,' + (0.10 + hp * 0.30).toFixed(2) + ')');

  // ---- ② 管壳深色底线（不透明；边界端外延 0.6px 补缝，对接无缝）----
  strokeSegs(segs, R * 2, '#191510', 0.6);

  // ---- ③ 钢灰渐变壳（圆柱高光质感：横管垂直渐变、竖管水平渐变）----
  if (hSegs.length) {
    const g = ctx.createLinearGradient(0, cy - R, 0, cy + R);
    g.addColorStop(0, '#a49e90'); g.addColorStop(0.45, '#6f6b5f'); g.addColorStop(1, '#3a372e');
    strokeSegs(hSegs, R * 2 - 1.5, g, 0.6);   // 四周留 0.75px 深色描边
  }
  if (vSegs.length) {
    const g = ctx.createLinearGradient(cx - R, 0, cx + R, 0);
    g.addColorStop(0, '#a49e90'); g.addColorStop(0.45, '#6f6b5f'); g.addColorStop(1, '#3a372e');
    strokeSegs(vSegs, R * 2 - 1.5, g, 0.6);
  }

  // ---- ④ 管壳上缘高光线（横管上侧 / 竖管左侧；单 path 交叉不叠加）----
  strokeOffsetLine(1, 'rgba(255,255,255,0.22)', R * 0.45);

  // ---- ⑤ 转弯/路口中心金属节点圆（盖住高光线在交汇处的交叉，补出圆角）----
  if (isJunction) {
    ctx.fillStyle = '#191510';
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
    const jg = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.1, cx, cy, R);
    jg.addColorStop(0, '#a49e90'); jg.addColorStop(0.55, '#6f6b5f'); jg.addColorStop(1, '#3a372e');
    ctx.fillStyle = jg;
    ctx.beginPath(); ctx.arc(cx, cy, R - 0.75, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R - 2.2, -Math.PI * 0.95, -Math.PI * 0.5); ctx.stroke();
  }

  // ---- ⑥ 导热内芯（达到发光温度由暗灰转炽橙，随温度增亮；单 path 交叉不叠加）----
  const coreC = glow ? _heatMix('#d97e2a', '#ffc34d', hp) : '#5a5245';
  strokeSegs(segs, rIn * 2, coreC, 0.6);

  // ---- ⑦ 发光芯辉线（炽热时内芯上缘的亮线，增强炽热感）----
  if (glow) strokeOffsetLine(1.2, 'rgba(255,232,175,' + (0.30 + hp * 0.40).toFixed(2) + ')', rIn * 0.45);

  // ---- ⑧ 交汇处内芯节点（画在辉线后，盖住中心交叉杂线）----
  if (isJunction) {
    ctx.fillStyle = coreC;
    ctx.beginPath(); ctx.arc(cx, cy, rIn, 0, Math.PI * 2); ctx.fill();
  }

  // ---- ⑨ 自由端法兰套环（管口凸缘：深色底环 + 钢色亮环，朝开放侧）----
  // 单连接：自由端在管中心，开放方向为连接方向的对侧；孤立管：两端均为自由端
  const freeEnds = [];
  if (connCount === 1) {
    if (cw)      freeEnds.push([cx, cy, 0]);              // 西连 → 东侧开放
    else if (ce) freeEnds.push([cx, cy, Math.PI]);        // 东连 → 西侧开放
    else if (cn) freeEnds.push([cx, cy, Math.PI / 2]);    // 北连 → 南侧开放
    else         freeEnds.push([cx, cy, -Math.PI / 2]);   // 南连 → 北侧开放
  } else if (connCount === 0) {
    freeEnds.push([cx - stubLen, cy, Math.PI]);
    freeEnds.push([cx + stubLen, cy, 0]);
  }
  const span = Math.PI * 0.46;
  for (const f of freeEnds) {
    ctx.strokeStyle = '#241f15';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(f[0], f[1], R + 0.6, f[2] - span, f[2] + span); ctx.stroke();
    ctx.strokeStyle = '#958f80';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(f[0], f[1], R + 0.1, f[2] - span, f[2] + span); ctx.stroke();
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
    this.animT = 0;       // 运行动画相位计时器（仅运行时推进，停止运行即冻结/消失）
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
  // 热交换接口是否接了热源（导热管/反应堆/供热塔）——重新连接后立即恢复受热判定
  hasHeatSourceNeighbor() {
    const pHT = rotCell(this, this.def.w >> 1, this.def.h); // 热交换接口外侧：默认下边(南)中间
    const t = entAt(pHT.x, pHT.y);
    return !!t && !t._dead &&
      ((t instanceof HeatPipe) || (t instanceof NuclearReactor) || (t instanceof HeatingTower));
  }
  // 从相邻导热管/反应堆吸热（导热管/反应堆会主动送热，这里也做被动吸收兜底）
  // 仅经热交换接口（官方 connections：默认下边(南)中间，随 dir 旋转）吸热，接口未对上不传热。
  heatFlow(dt) {
    forEachNeighborEnt(this, n => {
      if (n._dead) return;
      const isSrc = (n instanceof HeatPipe) || (n instanceof NuclearReactor) || (n instanceof HeatingTower);
      if (!isSrc) return;
      if (!heatDevicesConnectedViaPort(this, n)) return;
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
      if (pipeConnAt(n.x, n.y, sideFromEntity(this, n))) {
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
    // 降温（项目自定补充，官方原型无自然散热字段，对齐官方保守表现）：
    // 热交换接口未接热源（热管/反应堆断开或未对准）后，热量不再自动清零，
    // 而是以 HEAT_EXCHANGER_COOL_RATE 恒定速率缓慢散失（无官方数值可取，取远低于运转能耗的保守值），
    // 温度平滑回落至环境温度 15°C（AMBIENT_TEMP）。接回热源后立即恢复受热，无状态锁定。
    if (!this.hasHeatSourceNeighbor() && this.heatEnergy > 0) {
      const loss = Math.min(this.heatEnergy, HEAT_EXCHANGER_COOL_RATE * dt);
      this.heatEnergy -= loss;
      if (this.heatEnergy <= AMBIENT_TEMP * this.specificHeat() + 1e-9) this.heatEnergy = AMBIENT_TEMP * this.specificHeat();
    }
    // 产汽：温度 >= 500°C（官方 min_working_temperature）才开始工作，耗热 + 耗水 → 蒸汽
    // 满负荷固定耗热 HEAT_EXCHANGER_POWER(官方 energy_consumption 10MW，1 反应堆 40MW 可带 4 台)：
    // 耗热恒定不随温度升高而增大，多余热量使全链温度继续升向 1000°C（对齐官方核能表现）。
    if (this.temperature() >= HEAT_EXCHANGER_MIN_WORK_TEMP && this.water >= 0.5) {
      const maxHeat = HEAT_EXCHANGER_POWER * dt;                    // 满负荷每秒消耗热量(MJ)
      const heatUse = Math.min(maxHeat, this.heatEnergy);
      const steamProduced = heatUse / HEAT_EXCHANGER_ENERGY_PER_STEAM;
      const waterUse = Math.min(steamProduced, this.water);
      if (waterUse > 0) {
        this.heatEnergy -= waterUse * HEAT_EXCHANGER_ENERGY_PER_STEAM;
        this.water -= waterUse;
        this.steamBuf = Math.min(TURBINE_STEAM_CAP, this.steamBuf + waterUse);
        this.active = true;
        this.animT = (this.animT + dt) % 1;   // 运行中推进动画相位；停止运行时不再推进，动画随之停止
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
// 渲染：银灰钢换热机身 + 中央玻璃观察窗排管换热器——
// 底部椭圆阴影与基座、顶亮底暗渐变机身、焊接筋板与四角铆钉、左上圆形温度表（指针随温度偏转）、
// 观察窗内 4 根换热管（温度越高管色越暖，≥350°C 发橙光、产汽时脉动）、下边黄铜热接口；
// 端口（左右两侧水口 + 上边中间出汽口）与热接口位置随 dir 旋转。
function drawHeatExchanger(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const w = TILE * e.w, h = TILE * e.h;
  const temp = e.temperature();
  const hp = Math.max(0, Math.min(1, temp / HEAT_MAX_TEMP));
  const glow = temp >= HEAT_PIPE_MIN_GLOW_TEMP;
  const cx = px + w / 2;
  ctx.globalAlpha = alpha;

  // ① 底部椭圆阴影 + 深色基座
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(cx, py + h - 2, w * 0.42, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#22262c';
  rr(ctx, px + 5, py + h - 10, w - 10, 5, 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(px + 9, py + h - 5.5, w - 18, 0.8);

  // ② 炽热/产汽时的底层泛光（画在机身之下，沿机身轮廓外溢）
  if (glow || e.active) {
    const fl = e.active ? 0.7 + Math.sin(G.time * 6) * 0.3 : 1;
    ctx.strokeStyle = 'rgba(255,150,60,' + ((0.08 + hp * 0.16) * fl).toFixed(2) + ')';
    ctx.lineWidth = 9;
    rr(ctx, px + 6, py + 6, w - 12, h - 12, 7); ctx.stroke();
  }

  // ③ 银灰渐变机身（顶亮底暗）
  const bodyGrad = ctx.createLinearGradient(0, py + 3, 0, py + h - 3);
  bodyGrad.addColorStop(0, '#cdd2d8');
  bodyGrad.addColorStop(0.5, '#8f959e');
  bodyGrad.addColorStop(1, '#4d525b');
  ctx.fillStyle = bodyGrad;
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 7); ctx.fill();
  ctx.strokeStyle = '#22252b';
  ctx.lineWidth = 2;
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 7); ctx.stroke();

  // ④ 焊接筋板（横向设备竖筋 / 竖向设备横筋）+ 四角圆头铆钉
  const rib = (rv) => {
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    if (w >= h) ctx.fillRect(rv - 0.7, py + 8, 1.4, h - 20);
    else ctx.fillRect(px + 8, rv - 0.7, w - 20, 1.4);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    if (w >= h) ctx.fillRect(rv + 0.7, py + 8, 0.5, h - 20);
    else ctx.fillRect(px + 8, rv + 0.7, w - 20, 0.5);
  };
  if (w >= h) { rib(px + w * 0.21); rib(px + w * 0.79); }
  else { rib(py + h * 0.20); rib(py + h * 0.84); }
  const drawRivet = (rx, ry) => {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.arc(rx, ry, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#b8bcc2';
    ctx.beginPath(); ctx.arc(rx, ry, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(rx - 0.3, ry - 0.3, 0.45, 0, Math.PI * 2); ctx.fill();
  };
  drawRivet(px + 8, py + 8); drawRivet(px + w - 8, py + 8);
  drawRivet(px + 8, py + h - 15); drawRivet(px + w - 8, py + h - 15);

  // ⑤ 中央玻璃观察窗 + 换热排管（沿长边方向排布，避开顶部出汽口）
  let wx0, wx1, wy0, wy1;
  if (w >= h) { wx0 = px + w * 0.30; wx1 = px + w * 0.70; wy0 = py + 18; wy1 = py + h - 13; }
  else { wx0 = px + 9; wx1 = px + w - 13; wy0 = py + h * 0.30; wy1 = py + h * 0.76; }
  ctx.fillStyle = '#191b20';
  rr(ctx, wx0 - 2.5, wy0 - 2.5, wx1 - wx0 + 5, wy1 - wy0 + 5, 5); ctx.fill();
  ctx.save();
  rr(ctx, wx0, wy0, wx1 - wx0, wy1 - wy0, 3.5); ctx.clip();
  ctx.fillStyle = 'rgba(8,9,12,0.95)';
  ctx.fillRect(wx0, wy0, wx1 - wx0, wy1 - wy0);
  const coreC = glow ? _heatMix('#e0862e', '#ffd06a', hp) : _heatMix('#5e5850', '#8d8072', hp);
  const pulse = e.active ? 0.72 + Math.sin(G.time * 6) * 0.28 : 1;
  ctx.lineCap = 'round';
  const nT = 4;
  for (let i = 0; i < nT; i++) {
    const t = (i + 0.5) / nT;
    let x0, y0, x1, y1;
    if (w >= h) { y0 = wy0 + (wy1 - wy0) * t; y1 = y0; x0 = wx0 + 3; x1 = wx1 - 3; }
    else { x0 = wx0 + (wx1 - wx0) * t; x1 = x0; y0 = wy0 + 3; y1 = wy1 - 3; }
    // 炽热光晕层
    if (glow) {
      ctx.strokeStyle = 'rgba(255,190,90,' + ((0.20 + hp * 0.40) * pulse).toFixed(2) + ')';
      ctx.lineWidth = 5.5;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
    // 换热管主体
    ctx.strokeStyle = coreC;
    ctx.lineWidth = 3.2;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    // 管端小法兰（深色端标）
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    if (w >= h) {
      ctx.fillRect(x0 - 1, y0 - 2.6, 1.8, 5.2);
      ctx.fillRect(x1 - 0.8, y0 - 2.6, 1.8, 5.2);
    } else {
      ctx.fillRect(x0 - 2.6, y0 - 1, 5.2, 1.8);
      ctx.fillRect(x0 - 2.6, y1 - 0.8, 5.2, 1.8);
    }
  }
  // 汽泡上升动画：仅在正常运行（active）时绘制并随 animT 推进，停止运行即刻消失
  if (e.active) {
    const nB = 7;
    for (let i = 0; i < nB; i++) {
      const ph = (e.animT + i * 0.618) % 1;                       // 各泡错相上升（0→1）
      const bx = w >= h
        ? wx0 + (wx1 - wx0) * (0.10 + ((i * 0.37) % 0.8) + Math.sin((ph + i) * 6.28) * 0.03)
        : wx0 + (wx1 - wx0) * (0.18 + (i % 3) * 0.32 + Math.sin((ph + i) * 6.28) * 0.03);
      const by = w >= h
        ? wy1 - (wy1 - wy0) * ph
        : wy1 - (wy1 - wy0) * ((ph + i * 0.13) % 1);
      const r = 1.1 + ((i * 0.29) % 1) * 1.5;
      const a = 0.55 * Math.sin(Math.PI * ph);                    // 底部渐现、顶部渐隐
      ctx.fillStyle = 'rgba(215,238,255,' + a.toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,' + (a * 0.5).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(bx - r * 0.3, by - r * 0.3, r * 0.35, 0, Math.PI * 2); ctx.fill();
    }
  }
  // 玻璃高光（斜向反光线）
  ctx.strokeStyle = 'rgba(255,255,255,0.20)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(wx0 + 2, wy1 - 3);
  ctx.lineTo(wx1 - 3, wy0 + 2);
  ctx.stroke();
  ctx.restore();

  // ⑥ 左上圆形温度表（指针随温度从左下扫到右下）
  const gx0 = px + 14, gy0 = py + 13.5, gR = 7;
  ctx.fillStyle = '#26292f';
  ctx.beginPath(); ctx.arc(gx0, gy0, gR + 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e6e2d6';
  ctx.beginPath(); ctx.arc(gx0, gy0, gR, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#6a675e';
  ctx.lineWidth = 1;
  for (const a of [Math.PI * 0.75, Math.PI * 1.5, Math.PI * 2.25]) {
    ctx.beginPath();
    ctx.moveTo(gx0 + Math.cos(a) * (gR - 1.2), gy0 + Math.sin(a) * (gR - 1.2));
    ctx.lineTo(gx0 + Math.cos(a) * (gR - 3.2), gy0 + Math.sin(a) * (gR - 3.2));
    ctx.stroke();
  }
  const ang = Math.PI * 0.75 + hp * Math.PI * 1.5;
  ctx.strokeStyle = '#d06018';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(gx0, gy0);
  ctx.lineTo(gx0 + Math.cos(ang) * (gR - 2.2), gy0 + Math.sin(ang) * (gR - 2.2));
  ctx.stroke();
  ctx.fillStyle = '#2a2d33';
  ctx.beginPath(); ctx.arc(gx0, gy0, 1.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.beginPath(); ctx.arc(gx0 - 0.4, gy0 - 0.4, 0.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(gx0, gy0, gR - 1, -Math.PI * 1.05, -Math.PI * 0.6); ctx.stroke();

  // ⑦ 黄铜热接口（下边中间，接收导热管热量；随 dir 旋转到对应边）
  const pHt = rotCell(e, e.def.w >> 1, e.def.h - 1); // 下边中间热交换接口（内部格）
  const ht = rotSide(1, e.dir); // 下边(南)方向
  if (ht === 3 || ht === 1) {
    // 横向边（北/南）：沿 x 方向的接口条
    const yy = pHt.y * TILE + (ht === 3 ? 1.5 : TILE - 5.5);
    const hx0 = pHt.x * TILE + TILE * 0.28, hx1 = pHt.x * TILE + TILE * 0.72;
    ctx.fillStyle = '#55400a';
    rr(ctx, hx0 - 1.5, yy - 1.5, hx1 - hx0 + 3, 7, 1.5); ctx.fill();
    const hg = ctx.createLinearGradient(0, yy, 0, yy + 4);
    hg.addColorStop(0, glow ? '#ffe98f' : '#f0cf5e');
    hg.addColorStop(1, glow ? '#e8a52a' : '#b8861e');
    ctx.fillStyle = hg;
    rr(ctx, hx0, yy, hx1 - hx0, 4, 1); ctx.fill();
    ctx.fillStyle = '#55400a';
    ctx.fillRect(hx0 - 1.5, yy - 1, 2.6, 6);
    ctx.fillRect(hx1 - 1.1, yy - 1, 2.6, 6);
  } else {
    // 纵向边（西/东）：沿 y 方向的接口条
    const xx = pHt.x * TILE + (ht === 2 ? 1.5 : TILE - 5.5);
    const hy0 = pHt.y * TILE + TILE * 0.28, hy1 = pHt.y * TILE + TILE * 0.72;
    ctx.fillStyle = '#55400a';
    rr(ctx, xx - 1.5, hy0 - 1.5, 7, hy1 - hy0 + 3, 1.5); ctx.fill();
    const hg = ctx.createLinearGradient(xx, 0, xx + 4, 0);
    hg.addColorStop(0, glow ? '#ffe98f' : '#f0cf5e');
    hg.addColorStop(1, glow ? '#e8a52a' : '#b8861e');
    ctx.fillStyle = hg;
    rr(ctx, xx, hy0, 4, hy1 - hy0, 1); ctx.fill();
    ctx.fillStyle = '#55400a';
    ctx.fillRect(xx - 1, hy0 - 1.5, 6, 2.6);
    ctx.fillRect(xx - 1, hy1 - 1.1, 6, 2.6);
  }

  // ⑧ 端口（内部边缘）：左右两侧两个水口（互通）+ 上边中间出汽口，随 dir 旋转
  const pWL = rotCell(e, 0, 1);              // 左水口（内部格）
  const pWR = rotCell(e, e.def.w - 1, 1);    // 右水口（内部格）
  const pS = rotCell(e, e.def.w >> 1, 0);    // 上边中间蒸汽口（内部格）
  const cD = TILE / 2 - 1; // 端口凸缘贴合设备内部边缘
  // 蒸汽输出波纹（运行中，画在出汽口外）
  if (e.active) {
    ctx.fillStyle = 'rgba(210,235,255,.8)';
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const _s0 = rotSide(3, e.dir); // 上边(北)方向
    ctx.fillText('☁', pS.x * TILE + TILE / 2 + (_s0 === 0 ? TILE / 2 : _s0 === 2 ? -TILE / 2 : 0), pS.y * TILE + TILE / 2 + (_s0 === 1 ? TILE / 2 : _s0 === 3 ? -TILE / 2 : 0));
  }
  drawPort(ctx, pWL.x * TILE + TILE / 2, pWL.y * TILE + TILE / 2, rotSide(2, e.dir), ITEMS['water'].color, false, 0, cD, 'water', 'both');
  drawPort(ctx, pWR.x * TILE + TILE / 2, pWR.y * TILE + TILE / 2, rotSide(0, e.dir), ITEMS['water'].color, false, 0, cD, 'water', 'both');
  drawPort(ctx, pS.x * TILE + TILE / 2, pS.y * TILE + TILE / 2, rotSide(3, e.dir), ITEMS['steam'].color, true, 0, cD, 'steam', 'out');
  ctx.globalAlpha = 1;
}
function heatExchangerPanelHtml(e) {
  return row('温度', '<span class="dim"></span>', 'heat') +
    row('水', '<span class="dim"></span>', 'water') +
    row('蒸汽缓存', '<span class="dim"></span>', 'steam') +
    '<div class="dim">热交换器：下边(南)黄色热交换口接收导热管热量（导热管/反应堆须对准该接口格，接在其他位置不传热），左右两侧两个蓝口接水管进水（互通，多台水口可直接对口串接），上边(北)中间白口送出高温蒸汽到汽轮机。满负荷耗热 10MW（官方 energy_consumption），1 反应堆可带 4 台。核能技术解锁。</div>' +
    '<div class="dim">🔗 标准接法：反应堆→(导热管对准热交换口)→热交换器（接水管）→(蒸汽管)→汽轮机</div>';
}
function heatExchangerPanelLive(e, api) {
  const t = e.temperature();
  api.set('heat', t >= 1 ? chip('heat-pipe', Math.round(t) + '°C') : dimSpan('空'));
  api.set('water', e.water >= 1 ? '<div class="asm3-inp-row">' + itemSlotsHtml({ water: Math.floor(e.water) }, { action: 'display' }) + '</div>' : dimSpan('空'));
  api.set('steam', e.steamBuf >= 1 ? '<div class="asm3-inp-row">' + itemSlotsHtml({ steam: Math.floor(e.steamBuf) }, { action: 'display' }) + '</div>' : dimSpan('空'));
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
DEVICE_PANEL['heat-pipe'] = { html: () => row('温度', '<span class="dim"></span>', 'heat') + '<div class="dim">导热管：把核反应堆产生的热量传导到热交换器，可多根串联成导热线路（对齐官方：按温度差传导）。核能技术解锁。</div>', live: (e, api) => api.set('heat', e.temperature() >= 1 ? chip('heat-pipe', Math.round(e.temperature()) + '°C') : dimSpan('待机')), tip: heatPipeTip };
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
