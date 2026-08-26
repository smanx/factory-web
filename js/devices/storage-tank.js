'use strict';

// ===== 储液罐（对齐《异星工厂》Storage Tank）：大容量缓冲、单一流体、一对对角共 4 个通用流体口 =====
// 占地 3×3；容量 STORAGE_TANK_CAP；罐内只容纳一种流体（液体/气体均可）；
// 相邻管道会自动把流体灌入罐内，罐也会把流体供给相邻下游设备的输入口，作为缓冲库容。
// 继承 CircuitNode（CircuitNode 亦是 Entity 子类）：储液罐可接入电路网络，
// 把罐内当前流体的存量以该流体为信号名输出到所连网络，供组合器/机械臂/功率开关等做逻辑控制
// （对齐《异星工厂》：储液罐可接入电路网络读取流体存量，实现按液位自动化）。
class StorageTank extends CircuitNode {
  constructor(type, x, y) {
    super('storage-tank', x, y);
    this.fluid = {};
  }
  total() { let s = 0; for (const k in this.fluid) s += this.fluid[k]; return s; }
  storedFluid() { for (const k in this.fluid) if (this.fluid[k] > 0) return k; return null; }
  // 判断 (x,y) 是否为储液罐的边缘格子（用于设备输入口供流的格级判断）
  isEdgeCell(x, y) {
    return x >= this.x && x < this.x + this.w && y >= this.y && y < this.y + this.h &&
      (x === this.x || x === this.x + this.w - 1 || y === this.y || y === this.y + this.h - 1);
  }
  // 判断世界格 (wx,wy) 是否为储液罐“可接管”的对角接口所在的外部相邻格。
  // 只有一对对角（北西↔南东）的 4 个面可接管道，另一对对角（北东↔南西）为空不可接。
  // 用于限制管道/泵只在接口对角处接入与灌入流体。
  isPortCell(wx, wy) {
    const isPort = (side, cell) => {
      const nb = sideNeighborCell(this, side, cell);
      return nb[0] === wx && nb[1] === wy;
    };
    // 北·左上角(side3,cell0)、西·左上角(side2,cell0)、南·右下角(side1,cell2)、东·右下角(side0,cell2)
    return isPort(3, 0) || isPort(2, 0) || isPort(1, 2) || isPort(0, 2);
  }
  update(dt) {
    const f = this.storedFluid();
    if (!f) return;
    const visited = new Set();
    // 储液罐像管道一样互联互通：任一接口进，可从其他接口出。
    // 只在一对对角（北西↔南东）的 4 个接口格与外界交换流体，另一对对角（北东↔南西）为空不可接。
    for (let gx = this.x; gx < this.x + this.w; gx++) {
      for (let gy = this.y; gy < this.y + this.h; gy++) {
        if (!this.isEdgeCell(gx, gy)) continue;
        for (const [dx, dy] of PIPE_DIRS) {
          if (!this.storedFluid()) return;
          const t = entAt(gx + dx, gy + dy);
          if (!t || t === this || visited.has(t)) continue;
          // 仅允许在对角接口格与外界交换流体（另一对对角为空不可接也不供流）
          if (!this.isPortCell(gx + dx, gy + dy)) continue;
          if (t instanceof Pipe) {
            // 罐与相邻管道双向平衡：罐把流体供给管道（管道也会把流体灌入罐内，二者自动趋平），
            // 因此从任一接口进，可从其他接口经管道流出。
            if (this._balanceWith(t, f)) visited.add(t);
          } else if (t instanceof StorageTank) {
            // 罐与相邻储液罐自动平衡（互为缓冲库容）
            if (this._balanceWith(t, f)) visited.add(t);
          } else {
            const isFluidMach = (t instanceof Refinery) || (t instanceof ChemicalPlant) ||
              (t instanceof Assembler && t.acceptsFluid && t.acceptsFluid(f)) ||
              (t instanceof ElectricDrill);
            if (!isFluidMach) continue;
            // 仅当 (gx,gy) 命中该设备的某个流体输入口外侧相邻格时才供流（一格一接口）
            const inCells = (t.fluidInputCells && t.fluidInputCells()) || [];
            const hit = inCells.some(c => c[0] === gx && c[1] === gy);
            if (hit && t.giveItem(f)) { this.takeItemOf(f); visited.add(t); }
          }
        }
      }
    }
  }
  // 与相邻管道/储液罐按“液位比例”自动平衡：液位高的向液位低的流动，让整条流体网络趋平。
  // 管道容量(PIPE_CAP)与罐容量(STORAGE_TANK_CAP)相差悬殊，故按比例而非绝对量平衡。
  // 返回是否发生了流动（供 visited 去重用）。
  _balanceWith(t, f) {
    const capT = (t instanceof Pipe) ? PIPE_CAP : STORAGE_TANK_CAP;
    const theirs = t.fluid[f] || 0;
    // 防混液：目标已容纳别的流体时拒绝
    if (t.total() - theirs > 0) return false;
    // 目标已满：不再灌入
    if (t.total() >= capT) return false;
    const mine = this.fluid[f] || 0;
    if (mine <= 0) return false;
    // 按液位比例平衡，仅当本罐液位更高时才向目标流动
    const ratioMine = mine / STORAGE_TANK_CAP;
    const ratioTheirs = theirs / capT;
    if (ratioMine <= ratioTheirs) return false;
    // 期望目标液位 = 两液位均值，折算成目标应增的数量
    const targetRatio = (ratioMine + ratioTheirs) / 2;
    const targetAmount = Math.floor(targetRatio * capT);
    const move = Math.min(targetAmount - theirs, mine, capT - t.total());
    if (move <= 0) return false;
    this.fluid[f] -= move;
    if (this.fluid[f] <= 0) delete this.fluid[f];
    t.fluid[f] = theirs + move;
    return true;
  }
  giveItem(item) {
    if (FLUIDS.indexOf(item) < 0) return false;
    if (this.total() >= STORAGE_TANK_CAP) return false;
    // 只容单一流体：罐内已有别的流体时拒绝
    for (const k in this.fluid) if (this.fluid[k] > 0 && k !== item) return false;
    this.fluid[item] = (this.fluid[item] || 0) + 1;
    return true;
  }
  peekItem() { return this.storedFluid(); }
  takeItem() { const f = this.storedFluid(); if (f) return this.takeItemOf(f); return null; }
  takeOutput() { return this.takeItem(); }
  countOf(item) { return this.fluid[item] || 0; }
  takeItemOf(item) {
    if ((this.fluid[item] || 0) > 0) {
      this.fluid[item]--;
      if (this.fluid[item] <= 0) delete this.fluid[item];
      return item;
    }
    return null;
  }
  contents() {
    const list = [[this.type, 1]];
    for (const k in this.fluid) if (this.fluid[k] > 0) list.push([k, this.fluid[k]]);
    return list;
  }
  // 面板"取出全部"：排空罐内流体
  takeAll() {
    const rows = [];
    for (const k of Object.keys(this.fluid)) { rows.push([k, this.fluid[k]]); delete this.fluid[k]; }
    return rows;
  }
  serialize() { const s = super.serialize(); s.fluid = this.fluid; return s; }
  static restore(s) { const t = super.restore(s); t.fluid = s.fluid || {}; return t; }
}

// ===== 渲染 =====
// 储液罐（3×3）只在一对对角（北西↔南东）的 4 个面各设一只通用流体口：
// 北·左上角、西·左上角（北西对角）、南·右下角、东·右下角（南东对角）；
// 另一对对角（北东↔南西）为空，不可接管。可进可出。
const TANK_PORTS = [
  { side: 3, color: PORT_FLUID, off: -1, iconOff: -1, cells: [0] },  // 北·左上角（北西对角）
  { side: 2, color: PORT_FLUID, off: 1, iconOff: -1, cells: [0] },   // 西·左上角（北西对角）
  { side: 1, color: PORT_FLUID, off: -1, iconOff: 1, cells: [2] },   // 南·右下角（南东对角）
  { side: 0, color: PORT_FLUID, off: 1, iconOff: 1, cells: [2] }     // 东·右下角（南东对角）
];
// 当前罐内流体（若有）：用于"显示详情"时在接口处画流体图标
function tankFluid(e) { return e.storedFluid ? e.storedFluid() : null; }
function drawStorageTank(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w;
  ctx.globalAlpha = alpha;
  // 罐体
  ctx.fillStyle = '#5f7184';
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 9); ctx.fill();
  ctx.strokeStyle = '#3a4656';
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 9); ctx.stroke();
  // 罐内流体液位：由中央液体环显示，不再绘制中心矩形
  const f = e.storedFluid ? e.storedFluid() : null;
  const total = e.total ? e.total() : 0;
  // 液体环：显示在设备中央，直径较小，弧长随储液量百分比变化，颜色随流体颜色
  const tankLevel = Math.max(0, Math.min(1, total / STORAGE_TANK_CAP));
  const ringCx = px + s / 2, ringCy = py + s / 2, ringR = s * 0.22;
  ctx.lineWidth = 3.5;
  ctx.strokeStyle = 'rgba(30,36,44,.55)';   // 底环（空环）
  ctx.beginPath();
  ctx.arc(ringCx, ringCy, ringR, 0, Math.PI * 2); ctx.stroke();
  if (tankLevel > 0) {
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = f ? ITEMS[f].color : '#8a97a6';  // 颜色随流体
    ctx.beginPath();
    ctx.arc(ringCx, ringCy, ringR, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * tankLevel); ctx.stroke();
  }
  // 流体出入口凸缘（一对对角的 4 个面各一口，位置随旋转跟随）
  drawRotatablePorts(ctx, e, px, py, s, TANK_PORTS);
  // 接口图标默认显示详情：在出入口处画当前流体图标
  if (portLabelVisible()) {
    const fl = tankFluid(e);
    if (fl) {
      const d = e.dir | 0;
      // 沿 4 个接口各画一只当前流体图标（side 随旋转跟随，iconOff 为沿边偏移）
      for (const p of TANK_PORTS) {
        const sd = (p.side + d) % 4;
        drawPortIcon(ctx, px, py, s, sd, p.iconOff, fl);
      }
    }
  }
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function storageTankPanelHtml(e) {
  const agg = {};
  for (const k in e.fluid) if (e.fluid[k] > 0) agg[k] = e.fluid[k];
  let h = row('流体', Object.keys(agg).length ? countStr(agg) : '<span class="dim">空</span>', 'contents');
  h += row('容量', e.total() + ' / ' + STORAGE_TANK_CAP, 'cap');
  if (Object.keys(agg).length) h += '<button data-action="takeout" id="btn-tank-takeout">取出全部 (' + e.total() + ')</button>';
  h += '<div class="status"></div>';
  h += '<div class="dim">储液罐大容量缓冲（' + STORAGE_TANK_CAP + ' 单位），罐内只容纳单一液体/气体。罐像管道一样互联互通：一对对角（北西↔南东）的 4 个通用流体口可进可出，与相邻管道/储液罐按液位自动平衡，任一接口进、可从其他接口出，也能接其他管道或其他储液罐；同时向相邻炼油厂/化工厂等输入口供料。出入口处会显示当前流体图标。</div>';
  h += '<div class="dim">已接入电路网络：罐内流体存量以流体名（如水→water）作为信号输出到所连网络，供组合器/功率开关/机械臂等做按液位自动化（对齐《异星工厂》储液罐电路信号）。</div>';
  return h;
}
function storageTankPanelLive(e, api) {
  const agg = {};
  for (const k in e.fluid) if (e.fluid[k] > 0) agg[k] = e.fluid[k];
  api.set('contents', Object.keys(agg).length ? countStr(agg) : dimSpan('空'));
  api.set('cap', e.total() + ' / ' + STORAGE_TANK_CAP);
  api.toggle('#btn-tank-takeout', e.total() > 0, '取出全部 (' + e.total() + ')');
  if (e.total() >= STORAGE_TANK_CAP) api.status('已满：储罐达到容量上限', 'warn');
  else if (e.total() > 0) api.status('储存中：' + Object.keys(agg).map(k => ITEMS[k].name + '×' + agg[k]).join('、'), 'ok');
  else api.status('空罐：等待流体从管道灌入', 'ok');
}
function storageTankTip(e) {
  const agg = {};
  for (const k in e.fluid) if (e.fluid[k] > 0) agg[k] = e.fluid[k];
  return Object.keys(agg).length
    ? ('储罐 ' + Object.keys(agg).map(k => ITEMS[k].name + '×' + agg[k]).join('、') + '，按F拿取')
    : '空储罐';
}

// ===== 注册 =====
ENT_CLASSES['storage-tank'] = StorageTank;
DEVICE_RENDER['storage-tank'] = drawStorageTank;
DEVICE_STATUS['storage-tank'] = e => e.total() > 0 ? 'g' : 'r';
DEVICE_PANEL['storage-tank'] = { html: storageTankPanelHtml, live: storageTankPanelLive, tip: storageTankTip };
// 显示详情时，一对对角接口流体图标所在世界格 + 当前存储流体名（用于鼠标悬停显示流体名称）
DEVICE_FLUID_ICONS['storage-tank'] = e => {
  const f = tankFluid(e);
  if (!f) return [];
  const icons = [];
  for (const p of TANK_PORTS) {
    const cell = p.cells[0];
    icons.push({ x: fluidIconCell(e, p.side, cell)[0], y: fluidIconCell(e, p.side, cell)[1], fluid: f });
  }
  return icons;
};
