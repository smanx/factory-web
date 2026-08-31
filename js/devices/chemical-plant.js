'use strict';

// ===== 化工厂粒子（画面优化）：生产时冒蒸汽 =====
function chemPlantEmit(e, dt) {
  if (typeof spawnSteam !== 'function') return;
  const key = 'c' + e.x + ',' + e.y;
  if (!G.entFxTimer) G.entFxTimer = {};
  G.entFxTimer[key] = (G.entFxTimer[key] || 0) + dt;
  if (G.entFxTimer[key] < 0.4) return;
  G.entFxTimer[key] = 0;
  const cx = (e.x + 0.5) * TILE;
  const cy = (e.y + 0.3) * TILE;
  spawnSteam(cx + (Math.random() - 0.5) * e.w * TILE * 0.4, cy, { size: 3, color: '#cfdde8' });
}

// ===== 化工厂：流体化学加工（塑料/裂解）=====
class ChemicalPlant extends Entity {
  constructor(type, x, y) {
    super('chemical-plant', x, y);
    this.recipe = null;
    this.inp = {};
    this.outp = {};
    this.crafting = false;
    this.prog = 0;
    this.working = false;
    this.modules = {};  // 化工厂可装 3 个模块（对齐《异星工厂》Chemical plant）
    this.prodBuf = 0;   // 产能模块累积进度
    this.prodTechBuf = 0;
    // 电路控制（对齐《异星工厂》：生产建筑可接入电路网络，按信号条件启用/禁用配方）
    this.circuitCond = { enabled: false, channel: 'red', sig: 'iron-plate', op: '>', count: 1 };
  }
  // 电路启停：未启用条件时恒工作；启用后仅当附近电路信号满足条件才生产
  circuitEnabled() {
    if (!this.circuitCond || !this.circuitCond.enabled) return true;
    const sig = circuitSignalNear(this);
    return circuitCondOk(sig, this.circuitCond);
  }
  moduleSlotCount() { return GAME_DATA.deviceStats?.[this.type]?.moduleSlots ?? 3; } // 对齐《异星工厂》官方 module_slots：化工厂 3 槽
  moduleSpeedMult() {
    const mc = moduleCounts(this.modules);
    const bb = (typeof beaconBonus === 'function') ? beaconBonus(this.x, this.y) : null;
    if (bb) { mc.speed += bb.speed; mc.prod += bb.prod; mc.eff += bb.eff; }
    return 1 + 0.4 * mc.speed - 0.1 * mc.prod - 0.03 * mc.eff - mc.qualityPenalty;
  }
  // 当前每秒 prog 增量（制作速度倍率）：与 update() 累加公式同源，供面板换算真实剩余秒数
  craftProgRate() {
    const qMult = (typeof qualityMult === 'function' && this.quality) ? qualityMult(this.quality) : 1;
    return chemMult() * oilMult() * this.moduleSpeedMult() * powerFactor(this) * qMult;
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
    this.recipe = id;
    this.inp = {}; this.outp = {};
    this.crafting = false; this.prog = 0;
  }
  needsFluid(k) {
    const r = this.recipe ? RECIPES[this.recipe] : null;
    return !!(r && r.inp[k]);
  }
  portFlow() {
    const rec = this.recipe ? RECIPES[this.recipe] : null;
    if (!rec) return;
    // 接口布局（对齐《异星工厂》化工厂）：2个输入口在底部(南)、2个输出口在顶部(北)，固定成对
    // 每个接口对齐一个格子（一格一接口）：输入/输出口分别落在沿边第0、2格；左右输入有讲究：
    // 配方第1种流体原料进左侧(格0)输入口，第2种进右侧(格2)输入口
    const fluidInps = Object.keys(rec.inp).filter(k => FLUIDS.indexOf(k) >= 0);
    const inSide = (1 + (this.dir | 0)) % 4;   // 输入口基准：南
    const outSide = (3 + (this.dir | 0)) % 4;  // 输出口基准：北
    // 吸入：左侧输入口(格0)只收第1种流体，右侧输入口(格2)只收第2种流体
    const pull = (cell, fluidIdx) => {
      if (fluidIdx >= fluidInps.length) return;
      const k = fluidInps[fluidIdx];
      if (!this.needsFluid(k)) return;
      const n = neighborOnSideCell(this, inSide, cell);
      if (!n || !pipeConnAt(n.x, n.y, sideFromEntity(this, n))) return;
      if (!(n.fluid[k] > 0)) return;
      // 只按原料缓冲上限吸入流体原料：产物不做计数（自循环配方产物即原料）
      if ((this.inp[k] || 0) < 50 && n.takeItemOf(k)) this.inp[k] = (this.inp[k] || 0) + 1;
    };
    pull(0, 0); // 左侧输入口(格0) ← 第1种流体
    pull(2, 1); // 右侧输入口(格2) ← 第2种流体
    // 排出：流体产物仅从输出侧(北)的两个输出格子排入管道
    for (const cell of CHEM_OUTPUT_CELLS) {
      const n = neighborOnSideCell(this, outSide, cell);
      if (!n || !pipeConnAt(n.x, n.y, sideFromEntity(this, n))) continue;
      for (const k of Object.keys(this.outp)) {
        if (!(this.outp[k] > 0) || FLUIDS.indexOf(k) < 0) continue;
        if (n.total() < PIPE_CAP && n.giveItem(k)) {
          this.outp[k]--;
          if (this.outp[k] <= 0) delete this.outp[k];
        }
      }
    }
  }
  isFluidInlet(x, y) {
    // 仅底部的两个输入格子可被管道直接注入流体
    const inSide = (1 + (this.dir | 0)) % 4;
    for (const cell of CHEM_INPUT_CELLS) {
      const p = neighborOnSideCell(this, inSide, cell);
      if (p && p.x === x && p.y === y) return true;
    }
    return false;
  }
  // 所有流体输入口外侧相邻格的世界坐标（供储液罐等大实体缓冲供料时命中判断）
  fluidInputCells() {
    return CHEM_INPUT_CELLS.map(cell => sideNeighborCell(this, 1, cell));
  }
  // 是否为化工厂当前配方下「真正在用」的流体端口格：该格须有对应的进料或出料流体
  // （chemInputFluid/chemOutputFluid 非空）。配方未用到的口（如只用 1 个输入口、产物只占 1 个输出口）
  // 不显示连接。
  isFluidPort(x, y) {
    for (const cell of CHEM_INPUT_CELLS) {
      if (!chemInputFluid(this, cell)) continue;
      const p = sideNeighborCell(this, 1, cell); if (p[0] === x && p[1] === y) return true;
    }
    for (const cell of CHEM_OUTPUT_CELLS) {
      if (!chemOutputFluid(this, cell)) continue;
      const p = sideNeighborCell(this, 3, cell); if (p[0] === x && p[1] === y) return true;
    }
    return false;
  }
  update(dt) {
    this.working = false;
    const rec = this.recipe ? RECIPES[this.recipe] : null;
    if (!rec) { this.prog = 0; return; }
    this.portFlow();
    // 电路条件不满足时暂停生产（对齐《异星工厂》：电路控制配方启停）
    if (!this.circuitEnabled()) { this.crafting = false; return; }
    if (this.crafting) {
      if (powerSatOf(this) <= 0) return;
      this.working = true;
      chemPlantEmit(this, dt);
      this.prog += dt * this.craftProgRate();
      if (this.prog >= rec.time) {
        for (const k in rec.out) {
          emitQuality(this, this.outp, k, rec.out[k]);
          if (typeof trackProd === 'function') trackProd(k, rec.out[k]);
        }
        this.applyProductivity(rec);
        {
          const mainOut = Object.keys(rec.out)[0];
          if (mainOut && typeof applyTechProductivity === 'function') {
            const extra = applyTechProductivity(this, mainOut, rec.out[mainOut]);
            if (extra > 0) { this.outp[mainOut] = (this.outp[mainOut] || 0) + extra; if (typeof trackProd === 'function') trackProd(mainOut, extra); }
          }
        }
        this.crafting = false;
        this.prog = 0;
      }
      return;
    }
    for (const k in rec.inp) if ((this.inp[k] || 0) < rec.inp[k]) return;
    // 产物堆积即停工（动态「够用」：存量足够再产 2 次即停，防止原料积压在前端机器）
    if (outputBacklogged(this.outp, rec.out)) { this.portFlow(); return; }
    for (const k in rec.inp) {
      this.inp[k] -= rec.inp[k];
      if (typeof trackProd === 'function') trackProd(k, -rec.inp[k]);
      if (this.inp[k] <= 0) delete this.inp[k];
    }
    this.crafting = true;
    this.prog = 0;
  }
  giveItem(item) {
    // 配方原料优先：插件若为当前配方原料则入原料区，而非插件槽
    if (this.recipe) {
      const rec = RECIPES[this.recipe];
      if (rec.inp[item]) {
        // 只按原料判定是否超过 2 倍：产物不做计数（自循环配方产物即原料，
        // 把产物算进总量会让设备被自己上一轮产出「喂饱」而拒收下一轮原料）
        if ((this.inp[item] || 0) >= rec.inp[item] * 2) return false;
        this.inp[item] = (this.inp[item] || 0) + 1;
        return true;
      }
    }
    if (isModule(item)) {
      // 模块槽位限制（对齐《异星工厂》：化工厂 3 槽）
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
  powerDemand() { return this.recipe ? POWER_USE['chemical-plant'] * this.modulePowerFactor() : 0; }
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
    s.modules = this.modules; s.prodBuf = this.prodBuf; s.prodTechBuf = this.prodTechBuf || 0;
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
    const c = super.restore(s);
    c.recipe = s.recipe || null; c.inp = s.inp || {}; c.outp = s.outp || {};
    c.crafting = !!s.crafting; c.prog = s.prog || 0;
    c.modules = s.modules || {}; c.prodBuf = s.prodBuf || 0; c.prodTechBuf = s.prodTechBuf || 0;
    c.circuitCond = s.circuitCond || { enabled: false, channel: 'red', sig: 'iron-plate', op: '>', count: 1 };
    return c;
  }
}

// ===== 渲染 =====
// 化工厂流体接口：每个接口对齐一个格子（一格一接口）
// 底部(南，旋转跟随)2个输入口落在沿边第0、2格；顶部(北)2个输出口落在沿边第0、2格
const CHEM_INPUT_CELLS = [0, 2];   // 底部输入口所在格（沿边 0基，左输入=格0，右输入=格2）
const CHEM_OUTPUT_CELLS = [0, 2];  // 顶部输出口所在格（沿边 0基）
const CHEM_PORTS = [
  { side: 1, color: PORT_INPUT, arrow: true, off: 1, cells: [0], fluid: e => chemInputFluid(e, 0), flow: 'in' },    // 南·输入格0（左侧）
  { side: 1, color: PORT_INPUT, arrow: true, off: -1, cells: [2], fluid: e => chemInputFluid(e, 2), flow: 'in' },   // 南·输入格2（右侧）
  { side: 3, color: PORT_OUTPUT, off: -1, cells: [0], fluid: e => chemOutputFluid(e, 0), flow: 'out' },             // 北·输出格0
  { side: 3, color: PORT_OUTPUT, off: 1, cells: [2], fluid: e => chemOutputFluid(e, 2), flow: 'out' }               // 北·输出格2
];
// 当前配方下各输入口对应流体：用于“显示详情”时在接口处画图标
// 化工厂 3×3，中心格=1；配方第1种流体进左侧(格0)，第2种进右侧(格2)
function chemInputFluid(e, cell) {
  const rec = e.recipe ? RECIPES[e.recipe] : null;
  if (!rec) return null;
  const ins = Object.keys(rec.inp).filter(k => FLUIDS.indexOf(k) >= 0);
  const map = { 0: 0, 2: 1 };
  const idx = map[cell];
  return (idx !== undefined && idx < ins.length) ? ins[idx] : null;
}
// 当前配方下各输出口对应流体：用于“显示详情”时在接口处画图标
// 左输出口(格0)←第1种流体产物；右输出口(格2)←第2种流体产物
function chemOutputFluid(e, cell) {
  const rec = e.recipe ? RECIPES[e.recipe] : null;
  if (!rec) return null;
  const outs = Object.keys(rec.out).filter(k => FLUIDS.indexOf(k) >= 0);
  const map = { 0: 0, 2: 1 };
  const idx = map[cell];
  return (idx !== undefined && idx < outs.length) ? outs[idx] : null;
}
// 轻量色彩工具（仅在化工厂渲染中用到）：把 #rrggbb 与 0~1 比例混合到 alpha
function _cpMix(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + t.toFixed(3) + ')';
}
// 化工厂渲染：俯视「三釜环形反应台」——圆形金属平台 + 中央反应核 + 三个环绕反应釜。
// 设备可 R 旋转、V/H 翻转（均只改 dir），因此视觉元素全部使用圆周对称结构：
// 气泡（圆点）、搅拌涡流（旋转高光弧）、反应液辉光（径向渐变圆）——
// 任意 dir 旋转/水平垂直翻转后动画观感完全一致，不再出现横置/倒置的柱状图。
// 视觉分层（自下而上）：
//   ① 地面阴影  ② 金属基座圆盘  ③ 工业绿外壳圆盘（径向渐变 + 铆钉圈）
//   ④ 三个环绕反应釜（120° 均布：玻璃罐内含液 + 波动液面 + 运转气泡）
//   ⑤ 釜间连接管（三段圆周弦，运转时流动高光）
//   ⑥ 中央反应核（辉光脉冲 + 涡流高光弧）⑦ 配方图标 + 状态灯
//   ⑧ 流体端口（CHEM_PORTS + drawRotatablePorts，内部按 dir 旋转）⑨ 外圈描边
function drawChemicalPlant(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * 3;                                  // 化工厂固定 3×3
  const cx = px + s / 2, cy = py + s / 2;
  ctx.globalAlpha = alpha;

  // 本体随 dir 旋转（R 旋转 / V·H 翻转均改 dir）。俯视圆对称结构在任意 dir 下观感一致。
  // drawRotatablePorts 内部已按 dir 旋转，故在变换外（世界坐标）绘制，避免双重旋转。
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((dir | 0) * Math.PI / 2);
  ctx.translate(-cx, -cy);

  const rec = e.recipe ? RECIPES[e.recipe] : null;
  const working = !!(e.working || e.crafting);
  const t = G.time || 0;
  const R = s * 0.47;                                  // 主体外接半径
  const outFluid = rec ? Object.keys(rec.out)[0] : null;
  const mixCol = (outFluid && ITEMS[outFluid]) ? ITEMS[outFluid].color : '#6e8a52';

  // ① 地面阴影（圆形）
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath(); ctx.arc(cx + 2, cy + 3, R, 0, Math.PI * 2); ctx.fill();

  // ② 金属基座圆盘
  ctx.fillStyle = '#2b3524';
  ctx.beginPath(); ctx.arc(cx, cy, R + 2, 0, Math.PI * 2); ctx.fill();

  // ③ 工业绿外壳圆盘（径向渐变，左上受光）+ 铆钉圈（8 颗圆周均匀）
  const bodyGrad = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.1, cx, cy, R);
  bodyGrad.addColorStop(0, '#8aa66a');
  bodyGrad.addColorStop(0.55, '#5c7a44');
  bodyGrad.addColorStop(1, '#2c4220');
  ctx.fillStyle = bodyGrad;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.38)';
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + Math.PI / 8;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * (R - 4), cy + Math.sin(a) * (R - 4), 1.2, 0, Math.PI * 2);
    ctx.fill();
  }

  // ④ 三个环绕反应釜：120° 均布（玻璃罐圆 + 内含反应液 + 液面波动 + 运转气泡）
  const vatR = R * 0.24;                    // 反应釜半径
  const vatD = R * 0.56;                    // 釜心到本体中心距离
  const drawVat = (vx, vy, idx) => {
    // 玻璃罐体（径向渐变，左上高光——每只罐自身受光方向固定，圆结构旋转后观感一致）
    const vatGrad = ctx.createRadialGradient(vx - vatR * 0.35, vy - vatR * 0.35, vatR * 0.15, vx, vy, vatR);
    vatGrad.addColorStop(0, '#a8c890');
    vatGrad.addColorStop(0.55, '#5e7846');
    vatGrad.addColorStop(1, '#22301a');
    ctx.fillStyle = vatGrad;
    ctx.beginPath(); ctx.arc(vx, vy, vatR, 0, Math.PI * 2); ctx.fill();
    // 内部反应液（按配方主产物上色；液面波动幅度沿罐径向，无方向性）
    ctx.save();
    ctx.beginPath(); ctx.arc(vx, vy, vatR - 2, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = _cpMix(mixCol, working ? 0.62 : 0.38);
    ctx.fillRect(vx - vatR, vy - vatR, vatR * 2, vatR * 2);
    // 液面高光小弧（随时间呼吸，罐内对称）
    ctx.strokeStyle = 'rgba(255,255,255,0.30)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(vx, vy, (vatR - 2) * (0.55 + (working ? Math.sin(t * 3 + idx * 2.1) * 0.08 : 0)), Math.PI * 1.05, Math.PI * 1.75);
    ctx.stroke();
    // 运转气泡（圆点，自罐心向罐壁扩散——圆对称）
    if (working) {
      ctx.fillStyle = 'rgba(200,240,170,0.55)';
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.5 + idx * 0.31 + i * 0.33) % 1;
        const ba = i * Math.PI * 2 / 3 + idx;
        ctx.beginPath();
        ctx.arc(vx + Math.cos(ba) * (vatR - 3) * ph, vy + Math.sin(ba) * (vatR - 3) * ph, 0.8 + ph * 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    // 罐体钢圈描边 + 玻璃高光
    ctx.strokeStyle = '#1a2418';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(vx, vy, vatR, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.arc(vx - vatR * 0.15, vy - vatR * 0.15, vatR * 0.62, Math.PI * 1.1, Math.PI * 1.55); ctx.stroke();
  };
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + i * Math.PI * 2 / 3;      // 顶 / 左下 / 右下（随本体整体旋转）
    drawVat(cx + Math.cos(a) * vatD, cy + Math.sin(a) * vatD, i);
  }

  // ⑤ 釜间连接管（三段圆周弧，位于釜心所在圆上，运转时高光段流动——旋转对称）
  ctx.strokeStyle = '#22301a';
  ctx.lineWidth = 3.2;
  ctx.beginPath(); ctx.arc(cx, cy, vatD, -Math.PI / 2 + 0.45, -Math.PI / 2 + Math.PI * 2 / 3 - 0.45); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, vatD, -Math.PI / 2 + Math.PI * 2 / 3 + 0.45, -Math.PI / 2 + Math.PI * 4 / 3 - 0.45); ctx.stroke();
  ctx.beginPath(); ctx.arc(cx, cy, vatD, -Math.PI / 2 + Math.PI * 4 / 3 + 0.45, -Math.PI / 2 + Math.PI * 2 - 0.45); ctx.stroke();
  if (working) {
    ctx.strokeStyle = 'rgba(200,240,170,0.45)';
    ctx.lineWidth = 1.5;
    const sweep = (t * 1.1) % (Math.PI * 2 / 3);
    for (let i = 0; i < 3; i++) {
      const a0 = -Math.PI / 2 + i * Math.PI * 2 / 3 + 0.5 + sweep;
      ctx.beginPath(); ctx.arc(cx, cy, vatD, a0, a0 + 0.5); ctx.stroke();
    }
  }

  // ⑥ 中央反应核（深色腔 + 辉光脉冲 + 涡流高光弧——亮度/角度变化均无方向性）
  const coreR = R * 0.26;
  ctx.fillStyle = '#0e1a0c';
  ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, Math.PI * 2); ctx.fill();
  if (rec) {
    const gAlpha = working ? (0.45 + Math.sin(t * 4) * 0.18) : 0.18;
    const gGrad = ctx.createRadialGradient(cx, cy, 1, cx, cy, coreR);
    gGrad.addColorStop(0, _cpMix(mixCol, gAlpha));
    gGrad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gGrad;
    ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#1a2418';
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, Math.PI * 2); ctx.stroke();
  // 涡流高光弧（运转时旋转；停机时静止半弧）
  const vA = working ? t * 2.2 : Math.PI * 0.9;
  ctx.strokeStyle = working ? 'rgba(220,245,200,0.40)' : 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.arc(cx, cy, coreR * 0.62, vA, vA + Math.PI * 1.1); ctx.stroke();

  // 罐体外框描边（最上层，随本体一起旋转）
  ctx.strokeStyle = '#1a2418';
  ctx.lineWidth = 2.4;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();

  // 退出本体旋转变换，以下在世界坐标绘制（端口与文字不随本体翻转，保证可读）
  ctx.restore();

  // ⑦ 中央配方图标（世界坐标绘制，保持正立可读）
  if (portDetailsVisible() && rec) {
    const outId = Object.keys(rec.out)[0];
    drawRecipeIconCell(ctx, cx, cy, outId);
  }

  // 状态灯（右上角小圆点，世界坐标不随旋转；运转绿色呼吸、停机暗红）
  if (!(LOD && LOD.simple)) {
    const lx = cx + R * 0.70, ly = cy - R * 0.70;
    ctx.fillStyle = '#141414';
    ctx.beginPath(); ctx.arc(lx, ly, 3.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = working ? _cpMix('#9ce06c', 0.65 + Math.sin(t * 6) * 0.3) : '#513a33';
    ctx.beginPath(); ctx.arc(lx, ly, 2.1, 0, Math.PI * 2); ctx.fill();
  }

  // ⑧ 流体出入口凸缘（CHEM_PORTS + drawRotatablePorts，内部按 dir 旋转）
  drawRotatablePorts(ctx, e, px, py, s, CHEM_PORTS);

  // 缺料警示：居中感叹号（世界坐标，始终正立可读）
  if (!working && rec) {
    let missing = false;
    for (const k in rec.inp) if ((e.inp[k] || 0) < rec.inp[k]) { missing = true; break; }
    if (missing && !(LOD && LOD.simple)) {
      ctx.fillStyle = '#ffb04a';
      ctx.font = 'bold 14px system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('!', cx, cy);
    }
  }

  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function chemicalPlantPanelHtml(e) {
  let h = row('当前配方', recipeValueHtml(e.recipe));
  // 消耗/产出速率显示在面板靠前位置（当前配方之后）
  h += machRateHtml(e.recipe ? RECIPES[e.recipe] : null, e.recipe ? chemMult() * oilMult() * e.moduleSpeedMult() : 1);
  h += row('电力', powerStatusLiveHtml(e), 'power');
  // 模块槽位（对齐《异星工厂》：化工厂可装 3 模块）
  h += modulePanelSection(e);
  h += row('输入', Object.keys(e.inp).length ? countStr(e.inp) : '<span class="dim">空</span>', 'input');
  if (e.recipe)
    for (const k in RECIPES[e.recipe].inp) {
      const n = Math.min(invCount(k), 50 - (e.inp[k] || 0));
      if (n > 0) h += '<button data-action="feed" data-id="' + k + '">放入' +
        ITEMS[k].name + ' ×' + n + '</button>';
    }
  if (Object.keys(e.inp).length) h += '<button data-action="takein">取回全部输入</button>';
  h += row('产物', Object.keys(e.outp).length ? countStr(e.outp) : '<span class="dim">空</span>', 'output');
  h += '<button data-action="takeout" id="btn-takeout" style="display:none"></button>';
  h += barHtml(0);
  h += '<div class="status"></div>';
  h += '<div class="sec">选择配方</div><div class="recgrid">';
  for (const rid of CHEM_RECIPES) {
    const outId = Object.keys(RECIPES[rid].out)[0];
    const selCls = e.recipe === rid ? 'sel' : '';
    // 科技门控：未解锁的化工配方显示锁定（对齐《异星工厂》重油/轻油裂化需进阶原油加工科技）
    const unlocked = recipeUnlocked(rid);
    const lockTech = recipeLockingTech(rid);
    const lockCls = unlocked ? '' : ' locked-recipe';
    const disabled = unlocked ? '' : ' disabled';
    const lockNote = unlocked ? '' : ('🔒 需' + (lockTech ? TECHS[lockTech].name : '研究'));
    h += '<button class="rcbtn ' + selCls + lockCls + '" ' + disabled + ' data-action="recipe" data-id="' + rid + '" data-itemid="' + outId + '" data-tip="' +
      ITEMS[outId].name + '|' + (unlocked ? (RECIPES[rid].out[outId] + '个/次，耗时' + RECIPES[rid].time + '秒') : lockNote) + '">' +
      '<img src="' + iconDataURL(outId) + '">' + ITEMS[outId].name + (unlocked ? '' : ' 🔒') + '</button>';
  }
  h += '</div>';
  if (e.recipe) h += '<button data-action="recipe-clear">清除配方</button>';
  h += '<div class="dim">化工厂吃电力，专攻流体化学配方：塑料=石油气+煤；重油可逐级裂解成轻油、石油气。接口对齐格子：底部2个输入口分别在左数第1、3格（第1种原料进左侧、第2种进右侧），顶部2个输出口分别在左数第1、3格，一格对应一个接口、位置随旋转不变。所需流体经底部输入口相邻管道自动吸入，流体产物自动经顶部输出口排回管道；煤/铁板等固体原料机械臂可从任意方向抓取放入。可装 3 个模块（速度/产能/效率）并受信号塔加成。</div>';
  h += circuitPanelHtml(e, 'cp');
  return h;
}
function chemicalPlantPanelLive(e, api) {
  if (e.circuitCond && e.circuitCond.enabled && !e.circuitEnabled()) { api.status('已暂停：电路条件不满足', 'warn'); return; }
  api.set('power', powerStatusLiveHtml(e));
  api.set('input', Object.keys(e.inp).length ? countStr(e.inp) : dimSpan('空'));
  api.set('output', Object.keys(e.outp).length ? countStr(e.outp) : dimSpan('空'));
  const n = Object.values(e.outp).reduce((a, b) => a + b, 0);
  api.toggle('#btn-takeout', n > 0, '取回全部产物 (' + n + ')');
  api.prog(e.recipe && e.crafting ? e.prog / RECIPES[e.recipe].time * 100 : 0, e.recipe ? RECIPES[e.recipe].time : 0);
  api.status(!e.recipe ? '已暂停：未设置配方，点击下方选择'
    : e.crafting ? '加工中（流体产物自动排入相邻管道）'
    : powerSatOf(e) <= 0 ? '已暂停：缺电'
    : '已暂停：等待原料（流体经管道自动吸入）',
    !e.recipe || powerSatOf(e) <= 0 ? 'warn' : (e.crafting ? 'ok' : 'warn'));
}
function chemicalPlantTip(e) {
  let base = e.crafting ? ('加工 ' + ITEMS[Object.keys(RECIPES[e.recipe].out)[0]].name)
    : (e.recipe ? '待料（流体经管道自动吸入）' : '未设置配方，点击打开面板');
  const s = powerStatusOf(e);
  if (s.consuming && s.sat < 1) return base + '；' + (s.sat > 0 ? '电量不足' + Math.round(s.sat * 100) + '%' : '缺电停摆');
  return base;
}

// ===== 注册 =====
ENT_CLASSES['chemical-plant'] = ChemicalPlant;
DEVICE_RENDER['chemical-plant'] = drawChemicalPlant;
// 化工厂：正在耗电时按供电状态显灯（电量不足黄灯、缺电停摆红灯）；未耗电时按原逻辑
DEVICE_STATUS['chemical-plant'] = e => {
  const s = powerStatusOf(e);
  if (s.consuming) return s.color;
  return e.recipe ? (e.crafting ? 'g' : (powerSatOf(e) <= 0 && Object.keys(e.inp).length ? 'r' : 'y')) : 'r';
};
DEVICE_PANEL['chemical-plant'] = { html: chemicalPlantPanelHtml, live: chemicalPlantPanelLive, tip: chemicalPlantTip, onAction: (a) => circuitPanelAction('cp', a) };
// 化工厂四边均布流体口、本体对称，旋转仅记录朝向；选中/悬停后按 R 可直接旋转
DEVICE_DIR_ROTATE['chemical-plant'] = true;
// V/H 真镜像：左右镜像保持朝向、左右输入口（两种不同流体）对调；上下镜像前后边互换（dir+2）。
DEVICE_FLIP['chemical-plant'] = mirrorFlipDir;
// 显示详情时，各接口流体图标所在世界格 + 对应流体名（用于鼠标悬停显示流体名称）
DEVICE_FLUID_ICONS['chemical-plant'] = e => {
  const icons = [];
  for (const cell of CHEM_INPUT_CELLS) {
    const f = chemInputFluid(e, cell);
    if (f) icons.push({ x: fluidIconCell(e, 1, cell)[0], y: fluidIconCell(e, 1, cell)[1], fluid: f });
  }
  for (const cell of CHEM_OUTPUT_CELLS) {
    const f = chemOutputFluid(e, cell);
    if (f) icons.push({ x: fluidIconCell(e, 3, cell)[0], y: fluidIconCell(e, 3, cell)[1], fluid: f });
  }
  return icons;
};

// ===== 低温工厂（太空时代 Cryogenic plant，复用化工厂流体组装机行为） =====
// 数据全部来自 GAME_DATA（占地 4×4 / 血量 350 / 功耗 1500kW / crafting_speed 2 / 模块槽 8）。
ENT_CLASSES['cryogenic-plant'] = ChemicalPlant;
DEVICE_RENDER['cryogenic-plant'] = drawChemicalPlant;
DEVICE_STATUS['cryogenic-plant'] = DEVICE_STATUS['chemical-plant'];
DEVICE_PANEL['cryogenic-plant'] = { html: chemicalPlantPanelHtml, live: chemicalPlantPanelLive, tip: (e) => {
  const base = e.recipe ? (e.crafting ? '低温加工 ' + ITEMS[Object.keys(RECIPES[e.recipe].out)[0]].name : '待料（流体经管道自动吸入）') : '未设置配方，点击打开面板';
  const s = powerStatusOf(e);
  if (s.consuming && s.sat < 1) return base + '；' + (s.sat > 0 ? '电量不足' + Math.round(s.sat * 100) + '%' : '缺电停摆');
  return base;
}, onAction: (a) => circuitPanelAction('cp', a) };
DEVICE_DIR_ROTATE['cryogenic-plant'] = true;
DEVICE_FLIP['cryogenic-plant'] = mirrorFlipDir;
DEVICE_FLUID_ICONS['cryogenic-plant'] = DEVICE_FLUID_ICONS['chemical-plant'];
