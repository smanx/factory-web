'use strict';

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
  }
  setRecipe(id) {
    if (this.recipe === id) return;
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
      if (!(n instanceof Pipe)) return;
      if (!(n.fluid[k] > 0)) return;
      if ((this.inp[k] || 0) < 50 && n.takeItemOf(k)) this.inp[k] = (this.inp[k] || 0) + 1;
    };
    pull(0, 0); // 左侧输入口(格0) ← 第1种流体
    pull(2, 1); // 右侧输入口(格2) ← 第2种流体
    // 排出：流体产物仅从输出侧(北)的两个输出格子排入管道
    for (const cell of CHEM_OUTPUT_CELLS) {
      const n = neighborOnSideCell(this, outSide, cell);
      if (!(n instanceof Pipe)) continue;
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
  update(dt) {
    this.working = false;
    const rec = this.recipe ? RECIPES[this.recipe] : null;
    if (!rec) { this.prog = 0; return; }
    this.portFlow();
    if (this.crafting) {
      if (G.power.sat <= 0) return;
      this.working = true;
      this.prog += dt * chemMult() * oilMult() * powerFactor();
      if (this.prog >= rec.time) {
        for (const k in rec.out) this.outp[k] = (this.outp[k] || 0) + rec.out[k];
        this.crafting = false;
        this.prog = 0;
      }
      return;
    }
    for (const k in rec.inp) if ((this.inp[k] || 0) < rec.inp[k]) return;
    for (const k in rec.out) if ((this.outp[k] || 0) + rec.out[k] > 50) { this.portFlow(); return; }
    for (const k in rec.inp) {
      this.inp[k] -= rec.inp[k];
      if (this.inp[k] <= 0) delete this.inp[k];
    }
    this.crafting = true;
    this.prog = 0;
  }
  giveItem(item) {
    if (!this.recipe) return false;
    const rec = RECIPES[this.recipe];
    if (!rec.inp[item]) return false;
    if ((this.inp[item] || 0) >= 50) return false;
    this.inp[item] = (this.inp[item] || 0) + 1;
    return true;
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
  powerDemand() { return this.recipe ? POWER_USE['chemical-plant'] : 0; }
  contents() {
    const list = [[this.type, 1]];
    for (const k in this.inp) list.push([k, this.inp[k]]);
    for (const k in this.outp) list.push([k, this.outp[k]]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.recipe = this.recipe; s.inp = this.inp; s.outp = this.outp;
    s.crafting = this.crafting; s.prog = this.prog;
    return s;
  }
  // 蓝图只保留配方配置，不复制内部原料/输出/进度
  blueprint() {
    const s = super.blueprint();
    s.recipe = this.recipe;
    return s;
  }
  static restore(s) {
    const c = super.restore(s);
    c.recipe = s.recipe || null; c.inp = s.inp || {}; c.outp = s.outp || {};
    c.crafting = !!s.crafting; c.prog = s.prog || 0;
    return c;
  }
}

// ===== 渲染 =====
// 化工厂流体接口：每个接口对齐一个格子（一格一接口）
// 底部(南，旋转跟随)2个输入口落在沿边第0、2格；顶部(北)2个输出口落在沿边第0、2格
const CHEM_INPUT_CELLS = [0, 2];   // 底部输入口所在格（沿边 0基，左输入=格0，右输入=格2）
const CHEM_OUTPUT_CELLS = [0, 2];  // 顶部输出口所在格（沿边 0基）
const CHEM_PORTS = [
  { side: 1, color: PORT_INPUT, arrow: true, off: 1, cells: [0] },    // 南·输入格0（左侧）
  { side: 1, color: PORT_INPUT, arrow: true, off: -1, cells: [2] },   // 南·输入格2（右侧）
  { side: 3, color: PORT_OUTPUT, off: -1, cells: [0] },               // 北·输出格0
  { side: 3, color: PORT_OUTPUT, off: 1, cells: [2] }                 // 北·输出格2
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
function drawChemicalPlant(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * 3;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#6f7f56';
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 10); ctx.fill();
  ctx.strokeStyle = '#46523a';
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 10); ctx.stroke();
  ctx.fillStyle = '#3b3230';
  rr(ctx, px + s * 0.12, py + 10, 13, s * 0.22, 3); ctx.fill();
  rr(ctx, px + s * 0.28, py + 10, 13, s * 0.22, 3); ctx.fill();
  if (e.working || e.crafting) {
    const fl = 0.5 + Math.sin(G.time * 9 + px) * 0.25;
    ctx.fillStyle = 'rgba(170,225,130,' + (fl * 0.45).toFixed(2) + ')';
    rr(ctx, px + 12, py + s * 0.42, s - 24, s * 0.22, 6); ctx.fill();
  }
  ctx.fillStyle = '#8a9a70';
  ctx.beginPath();
  ctx.arc(px + s * 0.62, py + s * 0.36, s * 0.15, 0, 7); ctx.fill();
  ctx.strokeStyle = '#46523a';
  ctx.lineWidth = 2;
  ctx.stroke();
  if (e.recipe) {
    const outId = Object.keys(RECIPES[e.recipe].out)[0];
    drawItemDotBig(ctx, px + s * 0.62, py + s * 0.36, outId);
    const pct = e.crafting ? Math.min(1, e.prog / RECIPES[e.recipe].time) : 0;
    if (pct > 0) {
      ctx.strokeStyle = '#8fe08f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px + s * 0.62, py + s * 0.36, 26, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    if (!(LOD && LOD.simple)) {
      ctx.font = 'bold 11px system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('无配方', px + s * 0.62, py + s * 0.36);
    }
  }
  let bx = px + 14;
  for (const id of ['plastic-bar', 'light-oil', 'petroleum-gas']) {
    const n = (e.outp && e.outp[id]) || 0;
    if (!n) continue;
    ctx.fillStyle = '#20242b';
    rr(ctx, bx, py + s - 18, 18, 7, 2); ctx.fill();
    ctx.fillStyle = ITEMS[id].color;
    rr(ctx, bx, py + s - 18, 18 * Math.min(1, n / 16), 7, 2); ctx.fill();
    bx += 24;
  }
  ctx.font = 'bold 11px system-ui';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#eef4e4';
  ctx.fillText('化工厂', px + 8, py + s - 10);
  // ===== 流体出入口标注（对齐《异星工厂》化工厂：2输入口在底部、2输出口在顶部，固定成对，位置随旋转） =====
  // 每个接口对齐一个格子（一格一接口）：输入/输出口分别落在沿边第0、2格；左右输入有讲究：
  // 配方第1种流体原料进左侧输入口，第2种进右侧输入口
  drawRotatablePorts(ctx, e, px, py, s, CHEM_PORTS);
  const cd = e.dir | 0;
  // 接口图标默认显示详情：各口只画流体/气体图标，不再显示文字标签
  if (portLabelVisible()) {
    const inSide = (1 + cd) % 4, outSide = (3 + cd) % 4;
    // 输入口（底部）：沿边偏移 = 格号 - 中心格(1)
    for (const cell of CHEM_INPUT_CELLS) {
      const f = chemInputFluid(e, cell);
      if (!f) continue;
      drawPortIcon(ctx, px, py, s, inSide, cell - 1, f);
    }
    // 输出口（顶部）：沿边偏移 = 格号 - 中心格(1)
    for (const cell of CHEM_OUTPUT_CELLS) {
      const f = chemOutputFluid(e, cell);
      if (!f) continue;
      drawPortIcon(ctx, px, py, s, outSide, cell - 1, f);
    }
  }
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function chemicalPlantPanelHtml(e) {
  let h = row('当前配方', e.recipe ? ITEMS[Object.keys(RECIPES[e.recipe].out)[0]].name : '<span class="dim">未设置</span>');
  // 消耗/产出速率显示在面板靠前位置（当前配方之后）
  h += machRateHtml(e.recipe ? RECIPES[e.recipe] : null, e.recipe ? chemMult() * oilMult() : 1);
  h += row('电力', powerStatusLiveHtml(e), 'power');
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
    h += '<button class="rcbtn ' + selCls + '" data-action="recipe" data-id="' + rid + '" data-itemid="' + outId + '" data-tip="' +
      ITEMS[outId].name + '|' + RECIPES[rid].out[outId] + '个/次，耗时' + RECIPES[rid].time + '秒">' +
      '<img src="' + iconDataURL(outId) + '">' + ITEMS[outId].name + '</button>';
  }
  h += '</div>';
  if (e.recipe) h += '<button data-action="recipe-clear">清除配方</button>';
  h += '<div class="dim">化工厂吃电力，专攻流体化学配方：塑料=石油气+煤；重油可逐级裂解成轻油、石油气。接口对齐格子：底部2个输入口分别在左数第1、3格（第1种原料进左侧、第2种进右侧），顶部2个输出口分别在左数第1、3格，一格对应一个接口、位置随旋转不变。所需流体经底部输入口相邻管道自动吸入，流体产物自动经顶部输出口排回管道；煤/铁板等固体原料机械臂可从任意方向抓取放入。</div>';
  return h;
}
function chemicalPlantPanelLive(e, api) {
  api.set('power', powerStatusLiveHtml(e));
  api.set('input', Object.keys(e.inp).length ? countStr(e.inp) : dimSpan('空'));
  api.set('output', Object.keys(e.outp).length ? countStr(e.outp) : dimSpan('空'));
  const n = Object.values(e.outp).reduce((a, b) => a + b, 0);
  api.toggle('#btn-takeout', n > 0, '取回全部产物 (' + n + ')');
  api.prog(e.recipe && e.crafting ? e.prog / RECIPES[e.recipe].time * 100 : 0);
  api.status(!e.recipe ? '已暂停：未设置配方，点击下方选择'
    : e.crafting ? '加工中（流体产物自动排入相邻管道）'
    : G.power.sat <= 0 ? '已暂停：缺电'
    : '已暂停：等待原料（流体经管道自动吸入）',
    !e.recipe || G.power.sat <= 0 ? 'warn' : (e.crafting ? 'ok' : 'warn'));
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
  return e.recipe ? (e.crafting ? 'g' : (G.power.sat <= 0 && Object.keys(e.inp).length ? 'r' : 'y')) : 'r';
};
DEVICE_PANEL['chemical-plant'] = { html: chemicalPlantPanelHtml, live: chemicalPlantPanelLive, tip: chemicalPlantTip };
// 化工厂四边均布流体口、本体对称，旋转仅记录朝向；选中/悬停后按 R 可直接旋转
DEVICE_DIR_ROTATE['chemical-plant'] = true;
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
