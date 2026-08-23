'use strict';

// ===== 炼油厂：多配方流体加工（基础/进阶原油加工、煤液化、简易煤液化）=====
// 端口布局：背面(北)2个输入口、正面(南)3个输出口，各口之间留 1 格间隔
// 每个接口对齐一个格子（一格一接口）：输入口落在沿边第1、3格；输出口落在沿边第0、2、4格
// 原料缓冲上限：需能容纳任一配方的最大单种流体需求。基础/进阶原油加工一次需 100 原油，
// 煤液化需重油/蒸汽各 50；产物单次产出最大为石油气 55。故缓冲上限取 100，
// 确保能从管道持续吸入并累计到足量开始加工，且产物单次产出不因缓存过满而误停产
const REFINERY_BUF_CAP = 100;
class Refinery extends Entity {
  constructor(type, x, y) {
    super('refinery', x, y);
    this.recipe = null;
    this.inp = {};   // 已吸入/放入的原料（流体与固体都在此缓冲）
    this.outp = {};  // 产物缓冲（流体）
    this.crafting = false;
    this.prog = 0;
    this.working = false;
  }
  setRecipe(id) {
    if (this.recipe === id) return;
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
      if (!(n instanceof Pipe)) continue;
      if (!(n.fluid[k] > 0)) continue;
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
      if ((t instanceof Pipe || t instanceof Chest) && !(t instanceof Splitter) && t.giveItem(k)) {
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
    if (this.crafting) {
      if (G.power.sat <= 0) return;
      this.working = true;
      this.prog += dt * oilMult() * (G.power.sat < 1 ? G.power.sat : 1);
      if (this.prog >= rec.time) {
        for (const k in rec.out) this.outp[k] = (this.outp[k] || 0) + rec.out[k];
        this.crafting = false;
        this.prog = 0;
      }
      this.tryOutput();
      return;
    }
    // 检查原料是否齐备
    for (const k in rec.inp) if ((this.inp[k] || 0) < rec.inp[k]) { this.tryOutput(); return; }
    // 产物缓存是否过满（防止产物未排出时停产）
    for (const k in rec.out) if ((this.outp[k] || 0) + rec.out[k] > REFINERY_BUF_CAP) { this.tryOutput(); return; }
    // 消耗原料，开始加工
    for (const k in rec.inp) {
      this.inp[k] -= rec.inp[k];
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
    if (!this.recipe) return false;
    const rec = REFINERY_RECIPES[this.recipe];
    if (!rec.inp[item]) return false;
    if ((this.inp[item] || 0) >= REFINERY_BUF_CAP) return false;
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
  powerDemand() { return this.recipe ? POWER_USE['refinery'] : 0; }
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
  static restore(s) {
    const r = super.restore(s);
    r.recipe = s.recipe || null; r.inp = s.inp || {}; r.outp = s.outp || {};
    r.crafting = !!s.crafting; r.prog = s.prog || 0;
    return r;
  }
}

// ===== 渲染 =====
// 炼油厂流体接口：每个接口对齐一个格子（一格一接口）
// 背面(北，旋转跟随)2个输入口落在沿边第1、3格；正面(南)3个输出口落在沿边第0、2、4格（各口之间留 1 格间隔）
const REFINERY_INPUT_CELLS = [1, 3];     // 背面输入口所在格（沿边 0基，左=格1，右=格3）
const REFINERY_OUTPUT_CELLS = [0, 2, 4]; // 正面输出口所在格（沿边 0基，左/中/右）
const REFINERY_PORTS = [
  { side: 3, color: PORT_INPUT, arrow: true, off: -1, cells: [1] },   // 北·输入格1（左）
  { side: 3, color: PORT_INPUT, arrow: true, off: 1, cells: [3] },    // 北·输入格3（右）
  { side: 1, color: PORT_OUTPUT, off: -2, cells: [0] },               // 南·输出格0（左）
  { side: 1, color: PORT_OUTPUT, off: 0, cells: [2] },                // 南·输出格2（中）
  { side: 1, color: PORT_OUTPUT, off: 2, cells: [4] }                 // 南·输出格4（右）
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
function drawRefinery(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w;
  const sh = TILE * e.h;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#8f5a34';
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 10); ctx.fill();
  ctx.strokeStyle = '#5c3820';
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 10); ctx.stroke();
  ctx.fillStyle = '#3b3230';
  rr(ctx, px + s * 0.12, py + 10, 13, s * 0.22, 3); ctx.fill();
  rr(ctx, px + s * 0.28, py + 10, 13, s * 0.22, 3); ctx.fill();
  if (e.working) {
    const fl = 0.5 + Math.sin(G.time * 10 + px) * 0.25;
    ctx.fillStyle = 'rgba(255,160,60,' + (fl * 0.45).toFixed(2) + ')';
    rr(ctx, px + 12, py + s * 0.42, s - 24, s * 0.24, 6); ctx.fill();
  }
  // ===== 中央显示当前配方（对齐《异星工厂》：显示详情时展示配方图标）=====
  if (portLabelVisible()) {
    const cxp = px + s / 2, cyp = py + s / 2;
    if (e.recipe) {
      const outId = Object.keys(REFINERY_RECIPES[e.recipe].out)[0];
      drawItemDotBig(ctx, cxp, cyp, outId);
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.font = 'bold 12px system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(REFINERY_RECIPES[e.recipe].name, cxp, cyp + s * 0.17);
    } else {
      ctx.fillStyle = 'rgba(255,255,255,.6)';
      ctx.font = 'bold 11px system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('无配方', cxp, cyp);
    }
  }
  let bx = px + 14;
  for (const [id] of [['heavy-oil'], ['light-oil'], ['petroleum-gas']]) {
    const n = e.outp[id] || 0;
    ctx.fillStyle = '#20242b';
    rr(ctx, bx, py + s - 18, 18, 7, 2); ctx.fill();
    if (n > 0) {
      ctx.fillStyle = ITEMS[id].color;
      rr(ctx, bx, py + s - 18, 18 * Math.min(1, n / 16), 7, 2); ctx.fill();
    }
    bx += 24;
  }
  if (!e.working && (!e.recipe || (e.inp['crude-oil'] || 0) < 2)) {
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(e.recipe ? '缺原料' : '无配方', px + s / 2, py + s * 0.58);
  }
  // ===== 流体出入口标注（对齐《异星工厂》：入口绿、出口橙红，位置随旋转） =====
  // 布局：每个接口对齐到对应的格子（一格一接口）：背面(上方=北)2个输入口落在格1/格3，正面(下方=南)3个输出口落在格0/格2/格4（各留 1 格间隔）
  drawRotatablePorts(ctx, e, px, py, s, REFINERY_PORTS);
  const d = e.dir | 0;
  // 接口图标默认隐藏，松开 Alt 切换显示详情：各口只画流体/气体图标，不再显示文字标签
  if (portLabelVisible()) {
    const inSide = (3 + d) % 4, outSide = (1 + d) % 4;
    // 输入口：沿边偏移 = 格号 - 中心格(2)
    for (const cell of REFINERY_INPUT_CELLS) {
      const f = refineryInputFluid(e, cell);
      if (!f) continue;
      drawPortIcon(ctx, px, py, s, inSide, cell - 2, f);
    }
    // 输出口：沿边偏移 = 格号 - 中心格(2)
    for (const cell of REFINERY_OUTPUT_CELLS) {
      const f = refineryOutputFluid(e, cell);
      if (!f) continue;
      drawPortIcon(ctx, px, py, s, outSide, cell - 2, f);
    }
  }
  ctx.globalAlpha = 1;
}

// 在设备某边内侧（off=沿边偏移格数，中心为0）画该口流体的图标
function drawPortIcon(ctx, px, py, s, side, off, fluid) {
  let cx, cy;
  const cxp = px + s / 2, cyp = py + s / 2;
  if (side === 3) { cx = cxp + off * TILE; cy = py + 18; }          // 北（设备内部）
  else if (side === 1) { cx = cxp + off * TILE; cy = py + s - 26; } // 南（设备内部，避开底部产物条）
  else if (side === 0) { cx = px + s - 18; cy = cyp + off * TILE; } // 东（设备内部）
  else { cx = px + 18; cy = cyp + off * TILE; }                     // 西（设备内部）
  drawItemDot(ctx, cx, cy, fluid, 7);
}

// ===== 面板 =====
function refineryPanelHtml(e) {
  let h = row('当前配方', e.recipe ? REFINERY_RECIPES[e.recipe].name : '<span class="dim">未设置</span>');
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
    h += '<button class="rcbtn ' + selCls + '" data-action="recipe" data-id="' + rid + '" data-itemid="' + outId + '" data-tip="' +
      r.name + '|' + r.out[outId] + '个/次，耗时' + r.time + '秒">' +
      '<img src="' + iconDataURL(outId) + '">' + r.name + '</button>';
  }
  h += '</div>';
  if (e.recipe) h += '<button data-action="recipe-clear">清除配方</button>';
  h += '<div class="dim">炼油厂吃电力，须先选配方。接口对齐格子：背面（上方）2个输入口分别在左数第2、4格，正面（下方）3个输出口分别在左数第1、3、5格（各口之间留 1 格间隔）。所需流体经背面输入口相邻管道自动吸入，流体产物自动经正面输出口排回管道；煤/方解石等固体原料机械臂可从任意方向抓取放入。按一下 Alt 可切换显示详情（中央配方 + 各接口流体图标）。</div>';
  return h;
}
function refineryPanelLive(e, api) {
  api.set('input', Object.keys(e.inp).length ? countStr(e.inp) : dimSpan('空'));
  api.set('output', Object.keys(e.outp).length ? countStr(e.outp) : dimSpan('空'));
  const n = Object.values(e.outp).reduce((a, b) => a + b, 0);
  api.toggle('#btn-takeout', n > 0, '取回全部产物 (' + n + ')');
  api.prog(e.recipe && e.crafting ? e.prog / REFINERY_RECIPES[e.recipe].time * 100 : 0);
  if (!e.recipe) api.status('已暂停：未设置配方，点击下方选择', 'warn');
  else if (e.crafting) api.status('精炼中', 'ok');
  else if (G.power.sat <= 0) api.status('已暂停：缺电', 'bad');
  else api.status('已暂停：等待原料', 'warn');
}
function refineryTip(e) {
  if (!e.recipe) return '未设置配方，点击打开面板';
  return e.crafting ? '精炼中' : '待料';
}

// ===== 注册 =====
ENT_CLASSES['refinery'] = Refinery;
DEVICE_RENDER['refinery'] = drawRefinery;
DEVICE_STATUS['refinery'] = e =>
  e.recipe ? (e.crafting ? 'g' : (G.power.sat <= 0 && Object.keys(e.inp).length ? 'r' : 'y')) : 'r';
DEVICE_PANEL['refinery'] = { html: refineryPanelHtml, live: refineryPanelLive, tip: refineryTip };
// 炼油厂四边均布流体口、本体对称，旋转仅记录朝向；选中/悬停后按 R 可直接旋转
DEVICE_DIR_ROTATE['refinery'] = true;
// 显示详情(Alt)时，各接口流体图标所在世界格 + 对应流体名（用于鼠标悬停显示流体名称）
DEVICE_FLUID_ICONS['refinery'] = e => {
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
