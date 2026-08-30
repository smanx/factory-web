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
// 轻量色彩工具（仅在炼油厂/化工厂渲染中用到）：把 #rrggbb 与 0~1 比例混合到 alpha
function _rfMix(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + t.toFixed(3) + ')';
}
// 炼油厂渲染：重工业铜色立式炉 + 顶部双烟囱 + 中央蒸馏塔 + 底部 3 路输出油管
// 视觉分区（自下而上）：
//   ① 罐底阴影与基座  ② 铜钢外壳（铜→焦橙渐变 + 焊接筋板）
//   ③ 顶部双烟囱（运转时持续冒蒸汽）  ④ 中央蒸馏塔（橙色炉火 + 配方图标）
//   ⑤ 罐体侧壁检修门与螺栓  ⑥ 底部 3 路输出口油管（按产油量填充）
//   ⑦ 流体出入口凸缘（沿用旧 REFINERY_PORTS 约定，端口按 fluidIconCell 精确定位）
//   ⑧ 罐体外框
function drawRefinery(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w, sh = TILE * e.h;
  const cx = px + s / 2, cy = py + sh / 2;
  ctx.globalAlpha = alpha;

  // 本体随 dir 旋转（R 旋转 / V·H 翻转均改 dir），管道口随本体一起转。
  // ⑦ 的端口标注用 fluidIconCell/drawPort 内部已按 dir 旋转，故在变换外（世界坐标）绘制，避免双重旋转。
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((dir | 0) * Math.PI / 2);
  ctx.translate(-cx, -cy);

  const rec = e.recipe ? REFINERY_RECIPES[e.recipe] : null;
  const working = e.working || e.crafting;
  const fl = 0.5 + Math.sin((G.time || 0) * 10 + px) * 0.25;     // 炉火闪烁系数
  const heat = working ? (0.55 + fl * 0.35) : 0.18;                 // 炉火强度（待机也微亮）

  // ① 罐底投影 + 基座
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(cx, py + sh - 2, s * 0.42, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2a1a10';
  rr(ctx, px + 5, py + sh - 12, s - 10, 9, 3); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(px + 9, py + sh - 7, s - 18, 0.8);

  // ② 铜钢外壳（重工业铜色，顶亮底暗）
  const bodyGrad = ctx.createLinearGradient(0, py + 4, 0, py + sh - 4);
  bodyGrad.addColorStop(0,    '#b8703c');
  bodyGrad.addColorStop(0.18, '#9a5a2a');
  bodyGrad.addColorStop(0.55, '#7a4321');
  bodyGrad.addColorStop(1,    '#4a2812');
  ctx.fillStyle = bodyGrad;
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 10); ctx.fill();

  // ②b 罐体外壳左右各 3 条焊接筋板（明暗交替，强化金属拼接感）
  const ribXs = [px + s * 0.14, px + s * 0.30, px + s * 0.50 - 1,
                 px + s * 0.50 + 1, px + s * 0.70, px + s * 0.86];
  const ribShade = ['rgba(0,0,0,0.25)', 'rgba(0,0,0,0.20)', 'rgba(0,0,0,0.22)',
                    'rgba(255,255,255,0.10)', 'rgba(0,0,0,0.20)', 'rgba(0,0,0,0.25)'];
  for (let i = 0; i < ribXs.length; i++) {
    ctx.fillStyle = ribShade[i];
    ctx.fillRect(ribXs[i], py + 26, 1.6, sh - 50);
    ctx.fillStyle = i < 3 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.18)';
    ctx.fillRect(ribXs[i] + (i < 3 ? 1.6 : -0.6), py + 26, 0.6, sh - 50);
  }

  // ③ 顶部双烟囱（圆柱形 + 顶冠 + 烟囱口高亮；运转时冒蒸汽）
  const stackY = py + 4, stackH = 22, stackW = 8;
  const drawStack = (sx) => {
    // 烟囱阴影侧
    const stackGrad = ctx.createLinearGradient(sx - stackW / 2, 0, sx + stackW / 2, 0);
    stackGrad.addColorStop(0,   '#3a2818');
    stackGrad.addColorStop(0.5, '#6a4830');
    stackGrad.addColorStop(1,   '#2a1a10');
    ctx.fillStyle = stackGrad;
    rr(ctx, sx - stackW / 2, stackY, stackW, stackH, 2.5); ctx.fill();
    // 烟囱顶冠（向外凸一档）
    ctx.fillStyle = '#7a5238';
    rr(ctx, sx - stackW / 2 - 1.5, stackY - 2, stackW + 3, 4, 1.5); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 0.8;
    rr(ctx, sx - stackW / 2 - 1.5, stackY - 2, stackW + 3, 4, 1.5); ctx.stroke();
    // 烟囱口（暗内孔）
    ctx.fillStyle = '#1a0e08';
    ctx.fillRect(sx - stackW / 2 + 1.5, stackY - 1, stackW - 3, 1.4);
    // 烟囱中段高光环
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(sx - stackW / 2 + 0.5, stackY + 4, 0.8, stackH - 8);
  };
  drawStack(px + s * 0.30);
  drawStack(px + s * 0.70);

  // ③b 运转时烟囱持续排放蒸汽（用 spawnSteam 已有节奏在 update 中调用；这里只画高光）
  if (working) {
    for (let i = 0; i < 2; i++) {
      const sx = i === 0 ? px + s * 0.30 : px + s * 0.70;
      const phase = ((G.time || 0) * 0.7 + i * 0.5) % 1;
      ctx.fillStyle = 'rgba(240,232,220,' + (0.35 * (1 - phase)).toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(sx + Math.sin(phase * 5 + i) * 1.8, stackY - 4 - phase * 8, 2 + phase * 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ④ 中央蒸馏塔（圆角矩形，钢圈 + 橙色炉火内透）
  // 塔身外壳
  const tcX = px + 12, tcY = py + 30, tcW = s - 24, tcH = sh - 56;
  ctx.fillStyle = '#3a261a';
  rr(ctx, tcX, tcY, tcW, tcH, 5); ctx.fill();
  // 塔身内框（深色凹陷，让炉火像从内部透出）
  ctx.save();
  rr(ctx, tcX + 3, tcY + 3, tcW - 6, tcH - 6, 3); ctx.clip();
  // 底色（深焦）
  const darkGrad = ctx.createLinearGradient(0, tcY, 0, tcY + tcH);
  darkGrad.addColorStop(0, '#1a0e08');
  darkGrad.addColorStop(0.5, '#2a1408');
  darkGrad.addColorStop(1, '#3a1c0a');
  ctx.fillStyle = darkGrad;
  ctx.fillRect(tcX + 3, tcY + 3, tcW - 6, tcH - 6);
  // 炉火（橙红渐变，越亮表示越热）
  const fireY = tcY + tcH * (1 - heat * 0.85);
  const fireH = tcH * heat * 0.85;
  const fireGrad = ctx.createLinearGradient(0, fireY, 0, tcY + tcH);
  fireGrad.addColorStop(0,   _rfMix('#ff6a2a', 0.85));
  fireGrad.addColorStop(0.4, _rfMix('#ff8a3a', 0.70));
  fireGrad.addColorStop(1,   _rfMix('#ffae48', 0.25));
  ctx.fillStyle = fireGrad;
  ctx.fillRect(tcX + 3, fireY, tcW - 6, fireH);
  // 炉火表面波纹（动态）
  if (working) {
    const w1 = Math.sin((G.time || 0) * 4.5 + px) * 1.5;
    const w2 = Math.cos((G.time || 0) * 3.2 + py) * 1.2;
    ctx.fillStyle = 'rgba(255,220,120,0.55)';
    ctx.fillRect(tcX + 4, fireY + w1, tcW - 8, 1.4);
    ctx.fillStyle = 'rgba(255,140,40,0.45)';
    ctx.fillRect(tcX + 4, fireY + w1 + 2, tcW - 8, 1);
  }
  ctx.restore();
  // 塔身边框
  ctx.strokeStyle = 'rgba(255,255,255,0.20)';
  ctx.lineWidth = 1;
  rr(ctx, tcX, tcY, tcW, tcH, 5); ctx.stroke();
  // 钢圈（2 条横线，分隔出上下层）
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(tcX + 2, tcY + tcH * 0.35);
  ctx.lineTo(tcX + tcW - 2, tcY + tcH * 0.35);
  ctx.moveTo(tcX + 2, tcY + tcH * 0.65);
  ctx.lineTo(tcX + tcW - 2, tcY + tcH * 0.65);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(tcX + 2, tcY + tcH * 0.35 + 1);
  ctx.lineTo(tcX + tcW - 2, tcY + tcH * 0.35 + 1);
  ctx.moveTo(tcX + 2, tcY + tcH * 0.65 + 1);
  ctx.lineTo(tcX + tcW - 2, tcY + tcH * 0.65 + 1);
  ctx.stroke();

  // ④b 中央配方图标（选择配方后显示在蒸馏塔上方）
  if (portDetailsVisible() && rec) {
    const outId = Object.keys(rec.out)[0];
    drawRecipeIconCell(ctx, cx, tcY + tcH * 0.42, outId);
  }

  // ⑤ 罐体侧壁检修门（左下 + 右下两块带把手的金属板）
  const drawPlate = (x, y, w, h) => {
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    rr(ctx, x, y, w, h, 2); ctx.fill();
    ctx.fillStyle = '#5a3018';
    rr(ctx, x + 1, y + 1, w - 2, h - 2, 1.5); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 0.8;
    rr(ctx, x + 1, y + 1, w - 2, h - 2, 1.5); ctx.stroke();
    // 门把手（小圆点）
    ctx.fillStyle = '#d8a060';
    ctx.beginPath();
    ctx.arc(x + w - 4, y + h / 2, 1.4, 0, Math.PI * 2);
    ctx.fill();
  };
  drawPlate(px + 6,         py + sh - 28, 12, 14);
  drawPlate(px + s - 6 - 12, py + sh - 28, 12, 14);

  // ⑤b 角部螺栓（4 角各 1 颗）
  const drawBolt = (bx, by) => {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.arc(bx, by, 2.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a1a10';
    ctx.beginPath(); ctx.arc(bx, by, 2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,200,140,0.30)';
    ctx.beginPath(); ctx.arc(bx - 0.5, by - 0.5, 0.9, 0, Math.PI * 2); ctx.fill();
  };
  drawBolt(px + 9,        py + 9);
  drawBolt(px + s - 9,     py + 9);
  drawBolt(px + 9,        py + sh - 9);
  drawBolt(px + s - 9,     py + sh - 9);

  // ⑥ 底部 3 路输出口油管（按产油量填充进度条）
  const pipeY = py + sh - 17, pipeH = 6;
  const pipeW = 22, gap = 4;
  const pipeTotalW = pipeW * 3 + gap * 2;
  let bx = cx - pipeTotalW / 2;
  for (const [id] of [['heavy-oil'], ['light-oil'], ['petroleum-gas']]) {
    const n = e.outp[id] || 0;
    // 管底（暗）
    ctx.fillStyle = '#1a0e08';
    rr(ctx, bx, pipeY, pipeW, pipeH, 2); ctx.fill();
    if (n > 0) {
      ctx.fillStyle = ITEMS[id].color;
      rr(ctx, bx, pipeY, pipeW * Math.min(1, n / REFINERY_BUF_CAP), pipeH, 2); ctx.fill();
      // 管内液面高光
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(bx + 1, pipeY, pipeW * Math.min(1, n / REFINERY_BUF_CAP) - 2, 1.2);
    }
    // 管口上下边
    ctx.strokeStyle = 'rgba(0,0,0,0.55)';
    ctx.lineWidth = 0.6;
    rr(ctx, bx, pipeY, pipeW, pipeH, 2); ctx.stroke();
    // 管标签小点
    ctx.fillStyle = ITEMS[id].color;
    ctx.beginPath();
    ctx.arc(bx + pipeW / 2, pipeY - 2, 1.2, 0, Math.PI * 2);
    ctx.fill();
    bx += pipeW + gap;
  }

  // ⑧ 罐体外框描边（最上层，随本体一起旋转）
  ctx.strokeStyle = '#2a1a10';
  ctx.lineWidth = 2.4;
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 10); ctx.stroke();

  // 退出本体旋转变换，以下在世界坐标绘制（端口与文字不随本体翻转，保证可读）
  ctx.restore();

  // ⑦ 流体出入口标注（沿用旧 REFINERY_PORTS 约定，端口按 fluidIconCell 精确定位，内部按 dir 旋转）
  if (!(LOD && LOD.simple)) {
    for (const p of REFINERY_PORTS) {
      const g = fluidIconCell(e, p.side, p.cells[0]);
      const fcx = g[0] * TILE + TILE / 2, fcy = g[1] * TILE + TILE / 2;
      const sd = (p.side + (e.dir | 0)) % 4;
      const fluid = (typeof p.fluid === 'function') ? p.fluid(e) : p.fluid;
      drawPort(ctx, fcx, fcy, sd, p.color, p.arrow, 0, TILE / 2, fluid, p.flow, p.forceSymbol);
    }
  }

  // ⑥b 缺原料警示：居中显示感叹号（世界坐标，始终正立可读）
  if (!working && rec && refineryMissingInput(e) && !(LOD && LOD.simple)) {
    ctx.fillStyle = '#ffb04a';
    ctx.font = 'bold 14px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('!', cx, cy);
  }

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
