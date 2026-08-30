'use strict';

// ===== 炼油厂：多配方流体加工（基础/进阶原油加工、煤液化、简易煤液化）=====
// 端口布局：背面(北)2个输入口、正面(南)3个输出口，各口之间留 1 格间隔
// 每个接口对齐一个格子（一格一接口）：输入口落在沿边第1、3格；输出口落在沿边第0、2、4格
// 原料缓冲上限：需能容纳任一配方的最大单种流体需求。基础/进阶原油加工一次需 100 原油，
// 进阶原油加工还需水 50；煤液化需蒸汽 50、重油 25；产物单次产出最大为石油气 55。故缓冲上限取 100，
// 确保能从管道持续吸入并累计到足量开始加工，且产物单次产出不因缓存过满而误停产
const REFINERY_BUF_CAP = 100;
class Refinery extends Entity {
  constructor(type, x, y) {
    super('oil-refinery', x, y);
    this.recipe = null;
    this.inp = {};   // 已吸入/放入的原料（流体与固体都在此缓冲）
    this.outp = {};  // 产物缓冲（流体）
    this.crafting = false;
    this.prog = 0;
    this.working = false;
    this.modules = {};  // 炼油厂可装 3 个模块（对齐《异星工厂》Oil oil-refinery）
    this.prodBuf = 0;   // 产能模块累积进度
    // 电路控制（对齐《异星工厂》：生产建筑可接入电路网络，按信号条件启用/禁用配方）
    this.circuitCond = { enabled: false, channel: 'red', sig: 'iron-plate', op: '>', count: 1 };
  }
  // 电路启停：未启用条件时恒工作；启用后仅当附近电路信号满足条件才生产
  circuitEnabled() {
    if (!this.circuitCond || !this.circuitCond.enabled) return true;
    const sig = circuitSignalNear(this);
    return circuitCondOk(sig, this.circuitCond);
  }
  moduleSlotCount() { return GAME_DATA.deviceStats?.[this.type]?.moduleSlots ?? 3; } // 对齐《异星工厂》官方 module_slots：炼油厂 3 槽
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
      const mainOut = rec ? Object.keys(rec.out)[0] : null;
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
  setRecipe(id) {
    if (this.recipe === id) return;
    // 切换配方前返还已投入/已产出物料（对齐《异星工厂》：切换配方返还残留）
    if (this.inp || this.outp) returnMachineContents(this);
    this.recipe = id || null;
    this.inp = {}; this.outp = {};
    this.crafting = false; this.prog = 0;
  }
  needsFluid(k) {
    const r = this.recipe ? REFINERY_RECIPES[this.recipe] : null;
    return !!(r && r.inp[k] && FLUIDS.indexOf(k) >= 0);
  }
  // 当前配方下的流体输入清单（按顺序，映射到输入口）
  fluidInputs() {
    const r = this.recipe ? REFINERY_RECIPES[this.recipe] : null;
    if (!r) return [];
    return Object.keys(r.inp).filter(k => FLUIDS.indexOf(k) >= 0);
  }
  // 当前配方下的流体输出清单（按顺序，映射到输出口）
  fluidOutputs() {
    const r = this.recipe ? REFINERY_RECIPES[this.recipe] : null;
    if (!r) return [];
    return Object.keys(r.out).filter(k => FLUIDS.indexOf(k) >= 0);
  }
  // 从背面(北)输入口的相邻管道吸入配方所需流体
  portInput() {
    const rec = this.recipe ? REFINERY_RECIPES[this.recipe] : null;
    if (!rec) return;
    const fluidIns = this.fluidInputs();
    const inSide = (3 + (this.dir | 0)) % 4;   // 输入基准方向：北
    // 第1种流体进左侧输入口(格1)，第2种进右侧输入口(格3)
    const map = [[1, 0], [3, 1]];
    for (const [cell, idx] of map) {
      if (idx >= fluidIns.length) break;
      const k = fluidIns[idx];
      if (!(rec.inp[k] > 0)) continue;
      const n = neighborOnSideCell(this, inSide, cell);
      // 普通管道与地下管道（管口朝本设备）均可吸入流体原料
      if (!n || !pipeConnAt(n.x, n.y, sideFromEntity(this, n))) continue;
      if (!(n.fluid[k] > 0)) continue;
      // 只按原料缓冲上限吸入流体原料：产物不做计数（煤液化等配方产物即原料）
      if ((this.inp[k] || 0) < REFINERY_BUF_CAP && n.takeItemOf(k)) this.inp[k] = (this.inp[k] || 0) + 1;
    }
  }
  // 将流体产物经正面(南)输出口排入相邻管道/容器
  tryOutput() {
    const outSide = (1 + (this.dir | 0)) % 4;  // 输出基准方向：南
    // 第1种流体进左输出口(格0)，第2种进中输出口(格2)，第3种进右输出口(格4)
    const map = [[0, 0], [2, 1], [4, 2]];
    for (const [cell, idx] of map) {
      const fluidOuts = this.fluidOutputs();
      if (idx >= fluidOuts.length) break;
      const k = fluidOuts[idx];
      if (!(this.outp[k] > 0)) continue;
      const t = neighborOnSideCell(this, outSide, cell);
      if (!t || t === this) continue;
      // 流体产物排入普通管道或地下管道（管口朝本设备）；箱子仅用于兼容旧存档玩法
      if ((pipeConnAt(t.x, t.y, sideFromEntity(this, t)) || t instanceof Chest) && !(t instanceof Splitter) && t.giveItem(k)) {
        this.outp[k]--;
        if (this.outp[k] <= 0) delete this.outp[k];
      }
    }
  }
  update(dt) {
    this.working = false;
    const rec = this.recipe ? REFINERY_RECIPES[this.recipe] : null;
    if (!rec) { this.prog = 0; return; }
    this.portInput();
    // 电路条件不满足时暂停生产（对齐《异星工厂》：电路控制配方启停）
    if (!this.circuitEnabled()) { this.crafting = false; return; }
    if (this.crafting) {
      if (G.power.sat <= 0) return;
      this.working = true;
      this.prog += dt * oilMult() * this.moduleSpeedMult() * powerFactor() * (this.quality ? qualityMult(this.quality) : 1);
      // 炼油厂运转：顶部低频排放蒸汽（画面优化）
      if (typeof spawnSteam === 'function' && Math.random() < dt * 0.9) {
        spawnSteam((this.x + 0.5 + (Math.random() - 0.5) * 0.6) * TILE, (this.y + 0.25) * TILE, { size: 3, life: 1.5 });
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
      this.tryOutput();
      return;
    }
    // 检查原料是否齐备
    for (const k in rec.inp) if ((this.inp[k] || 0) < rec.inp[k]) { this.tryOutput(); return; }
    // 产物堆积即停工（动态「够用」：存量足够再产 2 次即停，防止原料积压在前端机器）
    if (outputBacklogged(this.outp, rec.out, REFINERY_BUF_CAP)) { this.tryOutput(); return; }
    // 消耗原料，开始加工
    for (const k in rec.inp) {
      this.inp[k] -= rec.inp[k];
      if (typeof trackProd === 'function') trackProd(k, -rec.inp[k]);
      if (this.inp[k] <= 0) delete this.inp[k];
    }
    this.crafting = true;
    this.prog = 0;
  }
  isFluidInlet(x, y) {
    // 仅背面的两个输入格可被管道直接注入流体
    const inSide = (3 + (this.dir | 0)) % 4;
    for (const cell of REFINERY_INPUT_CELLS) {
      const p = neighborOnSideCell(this, inSide, cell);
      if (p && p.x === x && p.y === y) return true;
    }
    return false;
  }
  // 所有流体输入口外侧相邻格的世界坐标（供储液罐等大实体缓冲供料时命中判断）
  fluidInputCells() {
    return REFINERY_INPUT_CELLS.map(cell => sideNeighborCell(this, 3, cell));
  }
  giveItem(item) {
    // 配方原料优先：插件若为当前配方原料则入原料区，而非插件槽
    if (this.recipe) {
      const rec = REFINERY_RECIPES[this.recipe];
      if (rec.inp[item]) {
        // 只按原料缓冲上限判定：产物不做计数（煤液化等配方产物即原料，
        // 把产物算进总量会让设备被自己上一轮产出「喂饱」而拒收下一轮原料）
        if ((this.inp[item] || 0) >= REFINERY_BUF_CAP) return false;
        this.inp[item] = (this.inp[item] || 0) + 1;
        return true;
      }
    }
    if (isModule(item)) {
      // 模块槽位限制（对齐《异星工厂》：炼油厂 3 槽）
      if ((this.modules[item] || 0) >= this.moduleSlotCount()) return false;
      this.modules[item] = (this.modules[item] || 0) + 1;
      if (typeof playSfx === 'function') playSfx('module');
      return true;
    }
    return false;
  }
  peekItem() {
    for (const k in this.outp) if (this.outp[k] > 0) return k;
    return null;
  }
  takeItem() {
    for (const k in this.outp) if (this.outp[k] > 0) return this.takeItemOf(k);
    return null;
  }
  countOf(item) { return this.outp[item] || 0; }
  takeItemOf(item) {
    if ((this.outp[item] || 0) > 0) { this.outp[item]--; if (this.outp[item] <= 0) delete this.outp[item]; return item; }
    return null;
  }
  // 取回原料：从设备输入缓存中取 1 件指定原料回背包（供设备面板右键取出）
  takeInputItemOf(item) {
    if ((this.inp[item] || 0) > 0) { this.inp[item]--; if (this.inp[item] <= 0) delete this.inp[item]; return item; }
    return null;
  }
  powerDemand() { return this.recipe ? POWER_USE['oil-refinery'] : 0; }
  contents() {
    const list = [[this.type, 1]];
    for (const k in this.inp) list.push([k, this.inp[k]]);
    for (const k in this.outp) list.push([k, this.outp[k]]);
    for (const k in this.modules) if (this.modules[k] > 0) list.push([k, this.modules[k]]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.recipe = this.recipe; s.inp = this.inp; s.outp = this.outp;
    s.crafting = this.crafting; s.prog = this.prog;
    s.modules = this.modules; s.prodBuf = this.prodBuf;
    if (this.circuitCond) s.circuitCond = this.circuitCond;
    return s;
  }
  // 蓝图只保留配方配置与模块，不复制内部原料/输出/进度
  blueprint() {
    const s = super.blueprint();
    s.recipe = this.recipe; s.modules = this.modules;
    if (this.circuitCond) s.circuitCond = this.circuitCond;
    return s;
  }
  static restore(s) {
    const r = super.restore(s);
    r.recipe = s.recipe || null; r.inp = s.inp || {}; r.outp = s.outp || {};
    r.crafting = !!s.crafting; r.prog = s.prog || 0;
    r.modules = s.modules || {}; r.prodBuf = s.prodBuf || 0;
    r.circuitCond = s.circuitCond || { enabled: false, channel: 'red', sig: 'iron-plate', op: '>', count: 1 };
    return r;
  }
}

// ===== 渲染 =====
// 炼油厂流体接口：每个接口对齐一个格子（一格一接口）
// 背面(北，旋转跟随)2个输入口落在沿边第1、3格；正面(南)3个输出口落在沿边第0、2、4格（各口之间留 1 格间隔）
const REFINERY_INPUT_CELLS = [1, 3];     // 背面输入口所在格（沿边 0基，左=格1，右=格3）
const REFINERY_OUTPUT_CELLS = [0, 2, 4]; // 正面输出口所在格（沿边 0基，左/中/右）
const REFINERY_PORTS = [
  { side: 3, color: PORT_INPUT, arrow: true, off: -1, cells: [1], fluid: e => refineryInputFluid(e, 1), flow: 'in' },   // 北·输入格1（左）
  { side: 3, color: PORT_INPUT, arrow: true, off: 1, cells: [3], fluid: e => refineryInputFluid(e, 3), flow: 'in' },    // 北·输入格3（右）
  { side: 1, color: PORT_OUTPUT, off: -2, cells: [0], fluid: e => refineryOutputFluid(e, 0), flow: 'out' },             // 南·输出格0（左）
  { side: 1, color: PORT_OUTPUT, off: 0, cells: [2], fluid: e => refineryOutputFluid(e, 2), flow: 'out' },              // 南·输出格2（中）
  { side: 1, color: PORT_OUTPUT, off: 2, cells: [4], fluid: e => refineryOutputFluid(e, 4), flow: 'out' }               // 南·输出格4（右）
];
// 当前配方下各输出口对应流体：用于"显示详情"时在接口处画图标
function refineryOutputFluid(e, cell) {
  const outs = e.fluidOutputs ? e.fluidOutputs() : [];
  const map = { 0: 0, 2: 1, 4: 2 };
  const idx = map[cell];
  return (idx !== undefined && idx < outs.length) ? outs[idx] : null;
}
function refineryInputFluid(e, cell) {
  const ins = e.fluidInputs ? e.fluidInputs() : [];
  const map = { 1: 0, 3: 1 };
  const idx = map[cell];
  return (idx !== undefined && idx < ins.length) ? ins[idx] : null;
}
// 判断炼油厂当前配方是否缺原料：任一输入（流体或固体）尚未累计到配方所需用量即视为缺原料
function refineryMissingInput(e) {
  const rec = e.recipe ? REFINERY_RECIPES[e.recipe] : null;
  if (!rec) return false;
  for (const k in rec.inp) if ((e.inp[k] || 0) < rec.inp[k]) return true;
  return false;
}
// 判断炼油厂是否因产物堆积而无法开工：动态「够用」——存量足够再产 2 次即停
function refineryOutputFull(e) {
  const rec = e.recipe ? REFINERY_RECIPES[e.recipe] : null;
  if (!rec) return false;
  return outputBacklogged(e.outp, rec.out, REFINERY_BUF_CAP);
}
// 轻量色彩工具：把 #rrggbb 与 0~1 比例混合到 alpha（'rgba(r,g,b,a)' 字符串）
function _rfMix(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + Math.max(0, Math.min(1, t)).toFixed(3) + ')';
}
// 炼油厂渲染：俯视「离心分馏机」——圆形金属平台 + 六叶反应槽 + 三重环形分馏管道。
// 设备可 R 旋转、V/H 翻转（均只改 dir），因此视觉元素全部使用圆周对称结构：
// 气泡（圆点）、环形管道（圆弧）、离心辐条（过圆心直径线）、旋转辉光（圆弧）——
// 任意 dir 旋转/水平垂直翻转后动画观感完全一致，不再出现横置/倒置的柱状图。
// 视觉分层（自下而上）：
//   ① 地面阴影  ② 金属基座圆盘  ③ 外壳圆环（拉丝钢）④ 六叶反应槽（配方反应液 + 上升气泡）
//   ⑤ 分馏环管×2（内环/外环，运转时流动高光）⑥ 离心辐条与中心毂（运转时随离心节奏闪动）
//   ⑦ 配方图标 + 状态灯  ⑧ 流体端口（drawPort 世界坐标，不随本体旋转）⑨ 外圈描边
function drawRefinery(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w;                       // 5×5
  const cx = px + s / 2, cy = py + s / 2;
  ctx.globalAlpha = alpha;

  const rec = e.recipe ? REFINERY_RECIPES[e.recipe] : null;
  const working = !!(e.working || e.crafting);
  const t = G.time || 0;

  // 本体随 dir 旋转（R 旋转 / V·H 翻转均改 dir）。俯视圆对称结构在任意 dir 下观感一致。
  // 端口与文字在 restore 后以世界坐标绘制，避免双重旋转导致标注倒置。
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((dir | 0) * Math.PI / 2);
  ctx.translate(-cx, -cy);

  const R = s * 0.47;                         // 主体外接半径

  // ① 地面阴影（圆形，中心略向主光反方向偏移，与本体旋转无关）
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath(); ctx.arc(cx + 2, cy + 3, R, 0, Math.PI * 2); ctx.fill();

  // ② 金属基座圆盘（混凝土色，略大于本体）
  ctx.fillStyle = '#3a332b';
  ctx.beginPath(); ctx.arc(cx, cy, R + 2, 0, Math.PI * 2); ctx.fill();

  // ③ 外壳圆环（拉丝钢径向渐变，左上受光）
  const bodyGrad = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.1, cx, cy, R);
  bodyGrad.addColorStop(0, '#9a6a42');
  bodyGrad.addColorStop(0.55, '#7a4a26');
  bodyGrad.addColorStop(1, '#422612');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  // 外壳铆钉圈（12 颗，圆周均匀——旋转/翻转后依旧均匀）
  ctx.fillStyle = 'rgba(0,0,0,0.40)';
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6 + Math.PI / 12;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * (R - 4.5), cy + Math.sin(a) * (R - 4.5), 1.3, 0, Math.PI * 2);
    ctx.fill();
  }

  // ④ 六叶反应槽：圆周均匀 6 格（扇区环带），反应液 + 气泡 + 进度闪动
  const inR = R * 0.46, outR = R * 0.86;
  const outFluid = rec ? Object.keys(rec.out)[0] : null;
  const mixCol = rec
    ? ((FLUIDS.indexOf(outFluid) >= 0 || ITEMS[outFluid]) && ITEMS[outFluid] ? ITEMS[outFluid].color : '#8a5a2a')
    : '#2a1a10';
  // 反应槽底（深色腔体）：实心圆 + 深色腔描边（六等分效果由辐条分隔）
  ctx.fillStyle = '#160c06';
  ctx.beginPath(); ctx.arc(cx, cy, outR, 0, Math.PI * 2); ctx.fill();
  if (rec) {
    // 反应液（环形圆，各方向一致）
    const liqGrad = ctx.createRadialGradient(cx, cy, inR * 0.4, cx, cy, outR);
    liqGrad.addColorStop(0, _rfMix(mixCol, working ? 0.75 : 0.45));
    liqGrad.addColorStop(1, _rfMix(mixCol, working ? 0.42 : 0.25));
    ctx.fillStyle = liqGrad;
    ctx.beginPath(); ctx.arc(cx, cy, outR - 2, 0, Math.PI * 2); ctx.fill();
    // 液面气泡（圆点上升扩散，圆对称，任意方向观感一致）
    if (working) {
      ctx.fillStyle = 'rgba(255,235,200,0.50)';
      for (let i = 0; i < 6; i++) {
        const ph = (t * 0.35 + i * 0.167) % 1;                 // 0→1 循环
        const ba = i * Math.PI / 3 + 0.5;                      // 气泡方位角（均匀分布）
        const br = inR + (outR - inR - 4) * ph;                // 由内向外扩散
        ctx.beginPath();
        ctx.arc(cx + Math.cos(ba) * br, cy + Math.sin(ba) * br, 1.2 + ph * 1.8, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // 加工进度：六扇区轮流点亮（进度指示，每扇区等价，无方向性）
    const phase = rec.time ? Math.min(1, (e.prog || 0) / rec.time) : 0;
    const litN = Math.floor(phase * 6);
    for (let i = 0; i < 6; i++) {
      const flash = working && ((Math.floor(t * 3) + i) % 6 === 0);
      if (i < litN || flash) {
        const a0 = i * Math.PI / 3 - Math.PI / 2;
        ctx.fillStyle = flash ? 'rgba(255,190,110,0.30)' : 'rgba(255,170,80,0.16)';
        ctx.beginPath();
        ctx.arc(cx, cy, outR - 3, a0 + 0.06, a0 + Math.PI / 3 - 0.06);
        ctx.arc(cx, cy, inR + 3, a0 + Math.PI / 3 - 0.06, a0 + 0.06, true);
        ctx.closePath(); ctx.fill();
      }
    }
  }
  // 腔体外沿钢圈
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 2.2;
  ctx.beginPath(); ctx.arc(cx, cy, outR + 1, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 0.8;
  ctx.beginPath(); ctx.arc(cx, cy, outR + 2.4, 0, Math.PI * 2); ctx.stroke();

  // ⑤ 分馏环管×2（内环/外环同心，运转时高光弧顺时针流动——圆弧在任意 dir 下观感一致）
  for (const [rr2, segN] of [[inR - 8, 4], [outR + 7, 5]]) {
    ctx.strokeStyle = '#241206';
    ctx.lineWidth = 3.4;
    ctx.beginPath(); ctx.arc(cx, cy, rr2, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, rr2 - 1.2, 0, Math.PI * 2); ctx.stroke();
    if (working) {
      // 流动高光：若干段等分弧带，相位随时间推进（旋转对称）
      ctx.strokeStyle = 'rgba(255,200,130,0.55)';
      ctx.lineWidth = 1.6;
      const sweep = (t * 0.9) % (Math.PI * 2 / segN);
      for (let i = 0; i < segN; i++) {
        const a0 = i * Math.PI * 2 / segN + sweep;
        ctx.beginPath(); ctx.arc(cx, cy, rr2, a0, a0 + Math.PI * 2 / segN * 0.45); ctx.stroke();
      }
    }
  }

  // ⑥ 离心辐条 + 中心毂：三根过圆心的直径线（三重圆周对称，任意 90° 旋转后重合）
  ctx.strokeStyle = '#3a2412';
  ctx.lineWidth = 4.5;
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI / 3 + Math.PI / 6;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inR, cy + Math.sin(a) * inR);
    ctx.lineTo(cx + Math.cos(a) * outR, cy + Math.sin(a) * outR);
    ctx.stroke();
  }
  // 辐条高光
  ctx.strokeStyle = 'rgba(255,255,255,0.14)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI / 3 + Math.PI / 6;
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(a) * inR, cy + Math.sin(a) * inR);
    ctx.lineTo(cx + Math.cos(a) * outR, cy + Math.sin(a) * outR);
    ctx.stroke();
  }
  // 中心毂（圆 + 高光点；运转时随离心节奏微微增亮——亮度变化无方向性）
  ctx.fillStyle = '#241206';
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.17, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#8a5a34';
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.17, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = working ? _rfMix('#ffb060', 0.55 + Math.sin(t * 5) * 0.2) : '#3a2412';
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.09, 0, Math.PI * 2); ctx.fill();
  // 运转时的离心辉光（旋转扫过的高光弧）
  if (working) {
    const sweepA = t * 1.6;
    ctx.strokeStyle = 'rgba(255,180,100,0.28)';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.60, sweepA, sweepA + Math.PI * 0.85); ctx.stroke();
  }

  // ⑦ 中央配方图标（世界坐标restore后绘制保持正立可读）
  ctx.restore();

  if (portDetailsVisible() && rec) {
    const outId = Object.keys(rec.out)[0];
    drawRecipeIconCell(ctx, cx, cy, outId);
  }

  // ⑧ 流体出入口标注（REFINERY_PORTS，端口按 fluidIconCell 定位，内部随 dir 旋转；标注本身保持正立）
  if (!(LOD && LOD.simple)) {
    for (const p of REFINERY_PORTS) {
      const g = fluidIconCell(e, p.side, p.cells[0]);
      const fcx = g[0] * TILE + TILE / 2, fcy = g[1] * TILE + TILE / 2;
      const sd = (p.side + (e.dir | 0)) % 4;
      const fluid = (typeof p.fluid === 'function') ? p.fluid(e) : p.fluid;
      drawPort(ctx, fcx, fcy, sd, p.color, p.arrow, 0, TILE / 2, fluid, p.flow, p.forceSymbol);
    }
  }

  // 状态灯（右上角小圆点，世界坐标不随旋转；运转绿色呼吸、停机暗红）
  if (!(LOD && LOD.simple)) {
    const lx = cx + R * 0.72, ly = cy - R * 0.72;
    ctx.fillStyle = '#141414';
    ctx.beginPath(); ctx.arc(lx, ly, 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = working
      ? _rfMix('#7fe08f', 0.65 + Math.sin(t * 6) * 0.3)
      : '#663333';
    ctx.beginPath(); ctx.arc(lx, ly, 2.4, 0, Math.PI * 2); ctx.fill();
  }

  // 缺原料警示：居中感叹号（世界坐标，始终正立可读）
  if (!working && rec && refineryMissingInput(e) && !(LOD && LOD.simple)) {
    ctx.fillStyle = '#ffb04a';
    ctx.font = 'bold 14px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('!', cx, cy);
  }

  // ⑨ 外圈描边（随本体最后补一次，压住端口根部的衔接）
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((dir | 0) * Math.PI / 2);
  ctx.translate(-cx, -cy);
  ctx.strokeStyle = '#2a1a10';
  ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();

  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function refineryPanelHtml(e) {
  let h = row('当前配方', recipeValueHtml(e.recipe));
  // 消耗/产出速率显示在面板靠前位置（当前配方之后）
  h += machRateHtml(e.recipe ? REFINERY_RECIPES[e.recipe] : null, e.recipe ? oilMult() * e.moduleSpeedMult() : 1);
  h += row('电力', powerStatusLiveHtml(e), 'power');
  // 模块槽位（对齐《异星工厂》：炼油厂可装 3 模块）
  h += modulePanelSection(e);
  h += row('输入', Object.keys(e.inp).length ? countStr(e.inp) : '<span class="dim">空</span>', 'input');
  if (e.recipe)
    for (const k in REFINERY_RECIPES[e.recipe].inp) {
      const n = Math.min(invCount(k), REFINERY_BUF_CAP - (e.inp[k] || 0));
      if (n > 0) h += '<button data-action="feed" data-id="' + k + '">放入' +
        ITEMS[k].name + ' ×' + n + '</button>';
    }
  if (Object.keys(e.inp).length) h += '<button data-action="takein">取回全部输入</button>';
  h += row('产物', Object.keys(e.outp).length ? countStr(e.outp) : '<span class="dim">空</span>', 'output');
  h += '<button data-action="takeout" id="btn-takeout" style="display:none"></button>';
  h += barHtml(0);
  h += '<div class="status"></div>';
  h += '<div class="sec">选择配方</div><div class="recgrid">';
  for (const rid of REFINERY_RECIPE_IDS) {
    const r = REFINERY_RECIPES[rid];
    const outId = Object.keys(r.out)[0];
    const selCls = e.recipe === rid ? 'sel' : '';
    // 科技门控：未解锁的炼油配方显示锁定（对齐《异星工厂》进阶原油加工/煤液化独立科技）
    const unlocked = recipeUnlocked(rid);
    const lockTech = recipeLockingTech(rid);
    const lockCls = unlocked ? '' : ' locked-recipe';
    const disabled = unlocked ? '' : ' disabled';
    const lockNote = unlocked ? '' : ('🔒 需' + (lockTech ? TECHS[lockTech].name : '研究'));
    h += '<button class="rcbtn ' + selCls + lockCls + '" ' + disabled + ' data-action="recipe" data-id="' + rid + '" data-itemid="' + outId + '" data-tip="' +
      localizedName(rid, r.name) + '|' + (unlocked ? (r.out[outId] + '个/次，耗时' + r.time + '秒') : (lockNote + '')) + '">' +
      '<img src="' + iconDataURL(outId) + '">' + localizedName(rid, r.name) + (unlocked ? '' : ' 🔒') + '</button>';
  }
  h += '</div>';
  if (e.recipe) h += '<button data-action="recipe-clear">清除配方</button>';
  h += '<div class="dim">炼油厂吃电力，须先选配方。接口对齐格子：背面（上方）2个输入口分别在左数第2、4格，正面（下方）3个输出口分别在左数第1、3、5格（各口之间留 1 格间隔）。所需流体经背面输入口相邻管道自动吸入，流体产物自动经正面输出口排回管道；煤/方解石等固体原料机械臂可从任意方向抓取放入。可装 3 个模块（速度/产能/效率）并受信号塔加成。中央配方 + 各接口流体图标会直接显示。</div>';
  h += circuitPanelHtml(e, 'rf');
  return h;
}
function refineryPanelLive(e, api) {
  if (e.circuitCond && e.circuitCond.enabled && !e.circuitEnabled()) { api.status('已暂停：电路条件不满足', 'warn'); return; }
  api.set('power', powerStatusLiveHtml(e));
  api.set('input', Object.keys(e.inp).length ? countStr(e.inp) : dimSpan('空'));
  api.set('output', Object.keys(e.outp).length ? countStr(e.outp) : dimSpan('空'));
  const n = Object.values(e.outp).reduce((a, b) => a + b, 0);
  api.toggle('#btn-takeout', n > 0, '取回全部产物 (' + n + ')');
  api.prog(e.recipe && e.crafting ? e.prog / REFINERY_RECIPES[e.recipe].time * 100 : 0, e.recipe ? REFINERY_RECIPES[e.recipe].time : 0);
  if (!e.recipe) api.status('已暂停：未设置配方，点击下方选择', 'warn');
  else if (e.crafting) api.status('精炼中', 'ok');
  else if (G.power.sat <= 0) api.status('已暂停：缺电', 'bad');
  else if (refineryOutputFull(e)) api.status('已暂停：产物堆积（够用 2 次生产）', 'warn');
  else api.status('已暂停：等待原料', 'warn');
}
function refineryTip(e) {
  let base;
  if (!e.recipe) base = '未设置配方，点击打开面板';
  else if (e.crafting) base = '精炼中';
  else if (refineryOutputFull(e)) base = '产物堆积';
  else base = '待料';
  const s = powerStatusOf(e);
  if (s.consuming && s.sat < 1) return base + '；' + (s.sat > 0 ? '电量不足' + Math.round(s.sat * 100) + '%' : '缺电停摆');
  return base;
}

// ===== 注册 =====
ENT_CLASSES['oil-refinery'] = Refinery;
DEVICE_RENDER['oil-refinery'] = drawRefinery;
// 炼油厂：正在耗电时按供电状态显灯（电量不足黄灯、缺电停摆红灯）；未耗电时按原逻辑
DEVICE_STATUS['oil-refinery'] = e => {
  const s = powerStatusOf(e);
  if (s.consuming) return s.color;
  return e.recipe ? (e.crafting ? 'g' : (G.power.sat <= 0 && Object.keys(e.inp).length ? 'r' : 'y')) : 'r';
};
DEVICE_PANEL['oil-refinery'] = { html: refineryPanelHtml, live: refineryPanelLive, tip: refineryTip, onAction: (a) => circuitPanelAction('rf', a) };
// 炼油厂四边均布流体口、本体对称，旋转仅记录朝向；选中/悬停后按 R 可直接旋转
DEVICE_DIR_ROTATE['oil-refinery'] = true;
// 显示详情时，各接口流体图标所在世界格 + 对应流体名（用于鼠标悬停显示流体名称）
DEVICE_FLUID_ICONS['oil-refinery'] = e => {
  const icons = [];
  for (const cell of REFINERY_INPUT_CELLS) {
    const f = refineryInputFluid(e, cell);
    if (f) icons.push({ x: fluidIconCell(e, 3, cell)[0], y: fluidIconCell(e, 3, cell)[1], fluid: f });
  }
  for (const cell of REFINERY_OUTPUT_CELLS) {
    const f = refineryOutputFluid(e, cell);
    if (f) icons.push({ x: fluidIconCell(e, 1, cell)[0], y: fluidIconCell(e, 1, cell)[1], fluid: f });
  }
  return icons;
};
