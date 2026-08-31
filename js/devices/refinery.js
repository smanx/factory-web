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
  // 当前每秒 prog 增量（制作速度倍率）：与 update() 累加公式同源，供面板换算真实剩余秒数
  craftProgRate() {
    const qMult = (typeof qualityMult === 'function' && this.quality) ? qualityMult(this.quality) : 1;
    return oilMult() * this.moduleSpeedMult() * powerFactor(this) * qMult;
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
      if (powerSatOf(this) <= 0) return;
      this.working = true;
      this.prog += dt * this.craftProgRate();
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
  // 是否为炼油厂当前配方下「真正在用」的流体端口格：该格须有对应的进料或出料流体
  // （refineryInputFluid/refineryOutputFluid 非空）。配方未用到的口（如基础炼油只用 1 个输入口、
  // 产物只占部分输出口）不显示连接。
  isFluidPort(x, y) {
    for (const cell of REFINERY_INPUT_CELLS) {
      if (!refineryInputFluid(this, cell)) continue;
      const p = sideNeighborCell(this, 3, cell); if (p[0] === x && p[1] === y) return true;
    }
    for (const cell of REFINERY_OUTPUT_CELLS) {
      if (!refineryOutputFluid(this, cell)) continue;
      const p = sideNeighborCell(this, 1, cell); if (p[0] === x && p[1] === y) return true;
    }
    return false;
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
// 炼油厂渲染：俯视「分馏厂」——方形混凝土基座 + 双蒸馏塔 + 中央分馏反应槽 + 三产品储球。
// 设备可 R 旋转、V/H 翻转（均只改 dir），整座厂区随 dir 一起旋转：
// 双塔圆心对准背面 2 个输入口、三储球对准正面 3 个输出口，管廊按工艺流向
// （原油吸入 → 蒸馏塔 → 分馏反应槽 → 产品储球 → 排出）前后贯通——
// 任意朝向下，端口布局与视觉流向天然一致，朝向本身即传达进料/出料方向。
// 配色对齐物品图标：锈橙主厂房 + 钢灰塔/罐 + 混凝土基座，运转时琥珀色工艺辉光。
// 视觉分层（自下而上）：
//   ① 地面阴影  ② 混凝土基座（圆角方形 + 地脚螺栓 + 端口警示色块）  ③ 工艺管廊（运转时油流流动高光）
//   ④ 双蒸馏塔 + 火炬塔（钢质环缝 + 顶盖，运转时脉冲辉光）  ⑤ 中央分馏反应槽（配方液窗 + 进度段 + 气泡）
//   ⑥ 三产品储球  ⑦ 配方图标 + 状态灯  ⑧ 流体端口（drawPort 世界坐标，不随本体旋转） ⑨ 外框描边
function drawRefinery(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w;                       // 5×5
  const cx = px + s / 2, cy = py + s / 2;
  ctx.globalAlpha = alpha;

  const rec = e.recipe ? REFINERY_RECIPES[e.recipe] : null;
  const working = !!(e.working || e.crafting);
  const t = G.time || 0;
  const H = s / 2;                            // 半占地（80px）

  const outFluid = rec ? Object.keys(rec.out)[0] : null;
  const mixCol = (outFluid && ITEMS[outFluid]) ? ITEMS[outFluid].color : '#8a5a2a';

  // 低 LOD（缩远）：基座 + 主厂房剪影，省掉全部细节
  if (LOD && LOD.simple) {
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    rr(ctx, cx - H + 6, cy - H + 7, s - 8, s - 8, 10); ctx.fill();
    ctx.fillStyle = '#3a332b';
    rr(ctx, cx - H + 4, cy - H + 4, s - 8, s - 8, 10); ctx.fill();
    ctx.fillStyle = rec ? _rfMix(mixCol, 0.75) : '#7a4a26';
    rr(ctx, cx - 26, cy - 14, 52, 34, 6); ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }

  // 本体随 dir 旋转（R 旋转 / V·H 翻转均改 dir），厂区全部画在局部坐标（原点=中心）。
  // 端口与文字在 restore 后以世界坐标绘制，避免双重旋转导致标注倒置。
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((dir | 0) * Math.PI / 2);
  // 真镜像手性：V/H 翻转置 mirror 时，本体在旋转后再沿竖直轴反射（R(dir)·S），
  // 与端口逻辑 rotCell/sideNeighborCell 的局部反射严格一致。否则本体只会转 180°（左右也翻），
  // 而非真正的上下镜像——化工厂因本体是正圆看不出差别，炼油厂有前后双塔/三球就会露馅。
  if (e.mirror) ctx.scale(-1, 1);

  // ① 地面阴影（略向主光反方向偏移）
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  rr(ctx, -H + 6, -H + 7, s - 8, s - 8, 12); ctx.fill();

  // ② 混凝土基座（圆角方形，左上受光渐变 + 深色描边 + 内沿高光）
  const padGrad = ctx.createLinearGradient(-H, -H, H, H);
  padGrad.addColorStop(0, '#4a4238');
  padGrad.addColorStop(0.5, '#3a332b');
  padGrad.addColorStop(1, '#241f19');
  ctx.fillStyle = padGrad;
  rr(ctx, -H + 4, -H + 4, s - 8, s - 8, 12); ctx.fill();
  ctx.strokeStyle = '#191410';
  ctx.lineWidth = 2;
  rr(ctx, -H + 4, -H + 4, s - 8, s - 8, 12); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  rr(ctx, -H + 7, -H + 7, s - 14, s - 14, 10); ctx.stroke();
  // 地脚螺栓（8 颗沿基座边均匀）
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + Math.PI / 8;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * (H - 10), Math.sin(a) * (H - 10), 1.4, 0, Math.PI * 2);
    ctx.fill();
  }
  // 端口警示色块：背面输入格绿块、正面输出格橙红块（与端口内孔同色，强化进/出方向感）
  for (const ix of [-32, 32]) {
    ctx.fillStyle = _rfMix(PORT_INPUT, 0.5);
    rr(ctx, ix - 10, -H + 5, 20, 3.4, 1.7); ctx.fill();
  }
  for (const ox of [-64, 0, 64]) {
    ctx.fillStyle = _rfMix(PORT_OUTPUT, 0.5);
    rr(ctx, ox - 10, H - 8.4, 20, 3.4, 1.7); ctx.fill();
  }

  // ③ 工艺管廊（先画，设备压住接头；运转时油流沿"输入→输出"方向流动）
  const pipeRuns = [
    [[-32, -H + 2], [-32, -52]],                          // 左输入口 → 左蒸馏塔
    [[32, -H + 2], [32, -52]],                            // 右输入口 → 右蒸馏塔
    [[-32, -24], [-32, -14]],                             // 左塔 → 反应槽
    [[32, -24], [32, -14]],                               // 右塔 → 反应槽
    [[0, -52], [0, -14]],                                 // 火炬塔 → 反应槽
    [[0, 28], [0, 34]],                                   // 反应槽 → 产品汇管
    [[-64, 34], [64, 34]],                                // 产品汇管（横贯三储球）
    [[-64, 34], [-64, 38]], [[0, 34], [0, 38]], [[64, 34], [64, 38]]  // 汇管 → 储球
  ];
  ctx.lineCap = 'round';
  for (const run of pipeRuns) {
    ctx.strokeStyle = '#1c1008';
    ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(run[0][0], run[0][1]); ctx.lineTo(run[1][0], run[1][1]); ctx.stroke();
    ctx.strokeStyle = '#59626e';
    ctx.lineWidth = 4.4;
    ctx.beginPath(); ctx.moveTo(run[0][0], run[0][1]); ctx.lineTo(run[1][0], run[1][1]); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(run[0][0], run[0][1]); ctx.lineTo(run[1][0], run[1][1]); ctx.stroke();
  }
  if (working) {
    ctx.strokeStyle = _rfMix('#ffcf8a', 0.55);
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 11]);
    ctx.lineDashOffset = -t * 26;
    for (const run of pipeRuns) {
      ctx.beginPath(); ctx.moveTo(run[0][0], run[0][1]); ctx.lineTo(run[1][0], run[1][1]); ctx.stroke();
    }
    ctx.setLineDash([]);
  }
  ctx.lineCap = 'butt';

  // 蒸馏塔助手：俯视钢质圆柱（环缝 + 圈带螺栓 + 顶盖；运转时顶盖脉冲辉光 + 旋转高光弧）
  const drawColumn = (x, y, r) => {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.arc(x, y + 2, r, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.12, x, y, r);
    g.addColorStop(0, '#9aa6b4');
    g.addColorStop(0.55, '#5a6470');
    g.addColorStop(1, '#20262e');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#141a20';
    ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.30)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r * 0.72, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r * 0.46, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.40)';
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      ctx.beginPath(); ctx.arc(x + Math.cos(a) * (r - 3), y + Math.sin(a) * (r - 3), 1.1, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#6d7886';
    ctx.beginPath(); ctx.arc(x, y, r * 0.30, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r * 0.30, 0, Math.PI * 2); ctx.stroke();
    if (working) {
      ctx.fillStyle = _rfMix('#ffb060', 0.5 + Math.sin(t * 4 + x * 0.1) * 0.25);
      ctx.beginPath(); ctx.arc(x, y, r * 0.16, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(255,210,150,0.35)';
      ctx.lineWidth = 1.4;
      const sw = t * 1.8 + y;
      ctx.beginPath(); ctx.arc(x, y, r * 0.85, sw, sw + Math.PI * 0.7); ctx.stroke();
    }
  };
  // ④ 双蒸馏塔（对准背面两输入口）+ 火炬塔（居中略小）
  drawColumn(-32, -38, 15);
  drawColumn(32, -38, 15);
  drawColumn(0, -60, 9);

  // ⑤ 中央分馏反应槽：锈橙主厂房 + 配方液窗 + 进度段
  const bx = -44, by = -16, bw = 88, bh = 44;
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  rr(ctx, bx + 2, by + 3, bw, bh, 8); ctx.fill();
  const hallGrad = ctx.createLinearGradient(bx, by, bx, by + bh);
  hallGrad.addColorStop(0, '#a06a3c');
  hallGrad.addColorStop(0.5, '#7a4a26');
  hallGrad.addColorStop(1, '#42260f');
  ctx.fillStyle = hallGrad;
  rr(ctx, bx, by, bw, bh, 8); ctx.fill();
  ctx.strokeStyle = '#241206';
  ctx.lineWidth = 2;
  rr(ctx, bx, by, bw, bh, 8); ctx.stroke();
  // 厂房铆钉（上下两排）
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let i = 0; i < 6; i++) {
    const rx2 = bx + 10 + i * (bw - 20) / 5;
    ctx.beginPath(); ctx.arc(rx2, by + 4.5, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(rx2, by + bh - 4.5, 1.1, 0, Math.PI * 2); ctx.fill();
  }
  // 液窗（深色腔体 + 按配方主产物上色反应液；运转时外溢辉光）
  const wx = bx + 8, wy = by + 8, ww = bw - 16, wh = bh - 16;
  ctx.fillStyle = '#160c06';
  rr(ctx, wx, wy, ww, wh, 5); ctx.fill();
  if (rec) {
    if (working) { ctx.save(); ctx.shadowColor = _rfMix(mixCol, 0.8); ctx.shadowBlur = 10; }
    const lg = ctx.createLinearGradient(wx, wy, wx, wy + wh);
    lg.addColorStop(0, _rfMix(mixCol, working ? 0.72 : 0.42));
    lg.addColorStop(1, _rfMix(mixCol, working ? 0.40 : 0.22));
    ctx.fillStyle = lg;
    rr(ctx, wx + 1.5, wy + 1.5, ww - 3, wh - 3, 4); ctx.fill();
    if (working) ctx.restore();
    // 气泡：沿工艺方向（朝产品侧）漂移，横向均匀分布
    if (working) {
      ctx.fillStyle = 'rgba(255,235,200,0.50)';
      for (let i = 0; i < 5; i++) {
        const ph = (t * 0.45 + i * 0.2) % 1;
        const bxx = wx + 8 + (i * 37) % (ww - 16);
        ctx.beginPath();
        ctx.arc(bxx, wy + 3 + ph * (wh - 6), 1 + ph * 1.4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    // 加工进度：液窗底沿 6 段自左向右点亮
    const phase = rec.time ? Math.min(1, (e.prog || 0) / rec.time) : 0;
    const litN = Math.floor(phase * 6);
    for (let i = 0; i < 6; i++) {
      if (i < litN) {
        ctx.fillStyle = 'rgba(255,190,110,0.35)';
        rr(ctx, wx + 3 + i * (ww - 6) / 6, wy + wh - 4.5, (ww - 6) / 6 - 2, 2.6, 1.2); ctx.fill();
      }
    }
  }
  ctx.strokeStyle = 'rgba(0,0,0,0.50)';
  ctx.lineWidth = 1.6;
  rr(ctx, wx, wy, ww, wh, 5); ctx.stroke();

  // 储球助手：俯视钢球罐（焊缝 + 左上高光弧 + 顶检人孔按产物着色）
  const drawTank = (x, y, r) => {
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.arc(x, y + 2, r, 0, Math.PI * 2); ctx.fill();
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.35, r * 0.12, x, y, r);
    g.addColorStop(0, '#8e9aa8');
    g.addColorStop(0.55, '#525c68');
    g.addColorStop(1, '#1e242c');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#141a20';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r * 0.66, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = rec ? _rfMix(mixCol, working ? 0.6 : 0.35) : '#39414c';
    ctx.beginPath(); ctx.arc(x, y, r * 0.34, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.40)';
    ctx.beginPath(); ctx.arc(x, y, r * 0.34, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.30)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(x, y, r * 0.8, Math.PI * 1.05, Math.PI * 1.55); ctx.stroke();
  };
  // ⑥ 三产品储球（对准正面三输出口）
  drawTank(-64, 48, 12);
  drawTank(0, 48, 12);
  drawTank(64, 48, 12);

  // ⑨ 外框描边（压住基座外沿）
  ctx.strokeStyle = '#2a1a10';
  ctx.lineWidth = 2.4;
  rr(ctx, -H + 4, -H + 4, s - 8, s - 8, 12); ctx.stroke();

  // 退出本体旋转变换，以下在世界坐标绘制（端口与文字不随本体翻转，保证可读）
  ctx.restore();

  // ⑦ 中央配方图标（世界坐标绘制，保持正立可读）
  if (portDetailsVisible() && rec) {
    drawRecipeIconCell(ctx, cx, cy, outFluid);
  }

  // ⑧ 流体出入口标注（REFINERY_PORTS，端口按 fluidIconCell 定位，内部随 dir 旋转；标注本身保持正立）
  for (const p of REFINERY_PORTS) {
    const g = fluidIconCell(e, p.side, p.cells[0]);
    const fcx = g[0] * TILE + TILE / 2, fcy = g[1] * TILE + TILE / 2;
    const sd = (p.side + (e.dir | 0)) % 4;
    const fluid = (typeof p.fluid === 'function') ? p.fluid(e) : p.fluid;
    drawPort(ctx, fcx, fcy, sd, p.color, p.arrow, 0, TILE / 2, fluid, p.flow, p.forceSymbol);
  }

  // 状态灯（基座右上角小圆点，世界坐标不随旋转；运转绿色呼吸、停机暗红）
  {
    const lx = cx + H - 20, ly = cy - H + 20;
    ctx.fillStyle = '#141414';
    ctx.beginPath(); ctx.arc(lx, ly, 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = working ? _rfMix('#7fe08f', 0.65 + Math.sin(t * 6) * 0.3) : '#663333';
    ctx.beginPath(); ctx.arc(lx, ly, 2.4, 0, Math.PI * 2); ctx.fill();
  }

  // 缺原料警示：居中感叹号（世界坐标，始终正立可读）
  if (!working && rec && refineryMissingInput(e)) {
    ctx.fillStyle = '#ffb04a';
    ctx.font = 'bold 14px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('!', cx, cy);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
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
  h += '<div class="dim">炼油厂吃电力，须先选配方。厂区进料/出料方向与外观一致：背面（双蒸馏塔侧）2个输入口分别在左数第2、4格，正面（三储球侧）3个输出口分别在左数第1、3、5格（各口之间留 1 格间隔）。所需流体经背面输入口相邻管道自动吸入，流体产物自动经正面输出口排回管道；煤/方解石等固体原料机械臂可从任意方向抓取放入。可装 3 个模块（速度/产能/效率）并受信号塔加成。中央配方 + 各接口流体图标会直接显示。</div>';
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
  else if (powerSatOf(e) <= 0) api.status('已暂停：缺电', 'bad');
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
  return e.recipe ? (e.crafting ? 'g' : (powerSatOf(e) <= 0 && Object.keys(e.inp).length ? 'r' : 'y')) : 'r';
};
DEVICE_PANEL['oil-refinery'] = { html: refineryPanelHtml, live: refineryPanelLive, tip: refineryTip, onAction: (a) => circuitPanelAction('rf', a) };
// 炼油厂四边均布流体口、本体对称，旋转仅记录朝向；选中/悬停后按 R 可直接旋转
DEVICE_DIR_ROTATE['oil-refinery'] = true;
// V/H 真镜像：左右镜像保持朝向、沿边端口左右对调；上下镜像前后边互换（dir+2）。
DEVICE_FLIP['oil-refinery'] = mirrorFlipDir;
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
