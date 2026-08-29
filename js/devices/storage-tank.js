'use strict';

// ===== 储液罐（对齐《异星工厂》Storage Tank）：大容量缓冲、单一流体、对角角落共 4 个通用流体口 =====
// 占地 2×2；容量 STORAGE_TANK_CAP；罐内只容纳一种流体（液体/气体均可）；
// 接口布局对齐官方 factorio-data（base/prototypes/entity/entities.lua → storage-tank.fluid_box）：
//   pipe_connections = { {direction=north, position={-1,-1}}, {direction=west, position={-1,-1}},
//                        {direction=east,  position={ 1, 1}}, {direction=south, position={ 1, 1}} }
// 即 4 个口集中在两个对角角落：北西角（北面+西面各一口）、南东角（东面+南面各一口）；
// two_direction_only：旋转 90° 后切换为另一对对角（北东角 ↔ 南西角）。
// 相邻管道/地下管道（管口侧）会自动把流体灌入罐内，罐也会按液位比例向它们及
// 相邻下游设备的输入口供流，作为缓冲库容（任一接口进、可从其他接口出）。
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
  // 4 个接口所在的外部相邻世界格（一对对角角落，随 dir 切换）：
  //   dir 0/2 → 北西角（北面口=西北格上方、西面口=西北格左侧）+ 南东角（东面口、南面口）；
  //   dir 1/3 → 北东角（北面口、东面口）+ 南西角（南面口、西面口）。
  // 与官方 pipe_connections 的 position+direction 一一对应（角落格 + 该角落的两个朝向）。
  portCells() {
    const x2 = this.x + this.w - 1, y2 = this.y + this.h - 1;   // 东南角格
    return (this.dir % 2 === 0)
      ? [[this.x, this.y - 1], [this.x - 1, this.y],            // 北西角：北面口 + 西面口
         [x2, this.y + this.h], [this.x + this.w, y2]]          // 南东角：南面口 + 东面口
      : [[x2, this.y - 1], [this.x + this.w, this.y],           // 北东角：北面口 + 东面口
         [this.x, this.y + this.h], [this.x - 1, y2]];          // 南西角：南面口 + 西面口
  }
  // 判断世界格 (wx,wy) 是否为储液罐“可接管”的接口格（用于限制管道/泵只在接口处接入与灌入流体）。
  // 只有一对对角角落的 4 个面可接管道，另一对对角为空不可接。
  isPortCell(wx, wy) {
    return this.portCells().some(c => c[0] === wx && c[1] === wy);
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
          } else if (typeof PipeToGround !== 'undefined' && t instanceof PipeToGround) {
            // 地下管道：仅当罐位于其「管口」侧（dir 反向相邻格）才互通——背向是地下管段侧，
            // 不接任何管道（对齐 pipe-ground.js 的管口约定）。管口接入后与普通管道一样
            // 按液位比例双向平衡：罐 → 地下管道 → 配对端 → 远端管道 全链路互通。
            const mouthX = t.x - DX[t.dir], mouthY = t.y - DY[t.dir];
            if (gx === mouthX && gy === mouthY && this._balanceWith(t, f)) visited.add(t);
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
    // 管道与地下管道容量同为 PIPE_CAP；相邻储液罐为 STORAGE_TANK_CAP
    const capT = (t instanceof Pipe || (typeof PipeToGround !== 'undefined' && t instanceof PipeToGround))
      ? PIPE_CAP : STORAGE_TANK_CAP;
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
    // 目标 = 罐自身的液位比例（对齐官方压力均分：整个连通网络趋同于同一比例）。
    // 若取两方均值，管道永远低于罐的比例，且下取整后每步推进极小、近似停滞，
    // 会让罐里的流体看起来"不往外流"。
    const targetRatio = ratioMine;
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
// 接口布局见类头注释：4 个口集中在两个对角角落（对齐官方 factorio-data）。
// 渲染上每个活跃角落画两只独立端口法兰：一只贴横边（北/南面口）、一只贴竖边（西/东面口），
// 均精确对齐所在格的中心线（沿边 16k/48k）并贴近包围盒边界——与相邻管道画到瓦片边的
// 连接段严丝合缝对接（管道口显示在格子中间，视觉上刚好连接）。
// 当前罐内流体（若有）：用于"显示详情"时在接口处画流体图标
function tankFluid(e) { return e.storedFluid ? e.storedFluid() : null; }
// 轻量色彩工具（仅在储液罐渲染中用到）：把 #rrggbb 与 0~1 比例混合到当前 canvas 状态
// 返回形如 'rgba(r,g,b,a)' 的字符串，便于在已有 fillStyle 之外快速派生阴影/高光色。
function _tankMix(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + t.toFixed(3) + ')';
}
// 储液罐渲染：单体立式圆顶储罐（2×2）+ 对角角落接口 + 正面磁翻板液位计 + 顶部压力表/放空管
// 罐体始终保持竖直（圆柱直筒 + 碟形顶盖 + 裙座 + 混凝土基座），不随 dir 旋转；
// 接口集中在一对对角角落（对齐官方 factorio-data）：dir 0/2 → 北西角+南东角，dir 1/3 → 北东角+南西角。
// 每个活跃角落两只独立端口法兰：贴横边的北/南面口 + 贴竖边的西/东面口（对齐官方，互不合并），
// 法兰中心精确落在接口格的中心线上（16k/48k），与相邻管道的连接段刚好对齐。
// 视觉分区（自下而上）：
//   ① 地面椭圆阴影       ② 裙座（梯形钢座 + 检修孔）
//   ③ 混凝土基座 + 地脚螺栓
//   ④ 罐体外壳（立式圆柱 + 碟形顶盖：水平渐变模拟圆柱侧反光）
//   ⑤ 焊缝（环箍焊缝×2 + 竖向焊缝 + 顶盖环缝）
//   ⑥ 正面磁翻板液位计（透明窄管：实时液位 + 液面波纹 + 刻度 + 上下端盖）
//   ⑦ 顶部附件：压力表（液位联动指针，>85% 变红）+ 放空管（呼吸阀）
//   ⑧ 对角角落接口：每角落两只端口法兰（对齐格中心线）+ ALT 模式流体图标
function drawStorageTank(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w;
  const k = s / 64;                     // 以 64px（2×2）为基准的缩放系数
  const cx = px + s / 2, cy = py + s / 2;
  ctx.globalAlpha = alpha;

  const f = e.storedFluid ? e.storedFluid() : null;
  const total = e.total ? e.total() : 0;
  const level = Math.max(0, Math.min(1, total / STORAGE_TANK_CAP));
  const fluidColor = f ? ITEMS[f].color : '#8a97a6';
  const simple = (typeof LOD !== 'undefined' && LOD && LOD.simple);

  // ===== 立式罐几何（罐体竖直、左右对称，与 dir 无关）=====
  const R = 22 * k;               // 罐体半径（半宽）
  const bodyTop = cy - 18 * k;    // 直筒段顶（碟形盖交界）
  const bodyBot = cy + 18 * k;    // 直筒段底（裙座交界）
  const domeRy = 8 * k;           // 碟形顶盖椭圆纵向半径

  // 罐体路径：平底直筒 + 碟形顶盖
  const tankPath = () => {
    ctx.beginPath();
    ctx.moveTo(cx - R, bodyBot);
    ctx.lineTo(cx - R, bodyTop);
    ctx.ellipse(cx, bodyTop, R, domeRy, 0, Math.PI, Math.PI * 2);
    ctx.lineTo(cx + R, bodyBot);
    ctx.closePath();
  };

  // ===== 低 LOD（缩远）：罐体剪影 + 液面色带 + 角落接口点，省掉全部细节 =====
  if (simple) {
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath();
    ctx.ellipse(cx, cy + 28 * k, R + 3 * k, 3.2 * k, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#465264';
    tankPath(); ctx.fill();
    if (level > 0) {
      const fh = 30 * k * level;
      ctx.fillStyle = _tankMix(fluidColor, 0.8);
      ctx.fillRect(cx - R + 2.5 * k, bodyBot - fh, 2 * R - 5 * k, fh);
    }
    // 活跃对角角落的接口点（低 LOD 下每角落两枚小点，对齐格中心线，与法兰位置一致）
    ctx.fillStyle = '#636c78';
    const _cs = (dir % 2 === 0) ? [[-1, -1], [1, 1]] : [[1, -1], [-1, 1]];
    for (const [sx, sy] of _cs) {
      const _colX = px + (sx > 0 ? 48 * k : 16 * k);   // 列格中心线
      const _rowY = py + (sy > 0 ? 48 * k : 16 * k);   // 行格中心线
      const _edge = 5 * k;                             // 距边位置（与法兰中心一致）
      ctx.fillRect(_colX - 1.25 * k, py + (sy < 0 ? _edge : s - _edge) - 1.25 * k, 2.5 * k, 2.5 * k);   // 横边口
      ctx.fillRect(px + (sx < 0 ? _edge : s - _edge) - 1.25 * k, _rowY - 1.25 * k, 2.5 * k, 2.5 * k);   // 竖边口
    }
    ctx.globalAlpha = 1;
    return;
  }

  // ===== ① 地面阴影 =====
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 28 * k, R + 3 * k, 3.2 * k, 0, 0, Math.PI * 2);
  ctx.fill();

  // ===== ② 裙座（梯形钢座 + 检修孔）=====
  ctx.fillStyle = '#262e3a';
  ctx.beginPath();
  ctx.moveTo(cx - R + 6 * k, bodyBot);
  ctx.lineTo(cx + R - 6 * k, bodyBot);
  ctx.lineTo(cx + R - 2 * k, cy + 20 * k);
  ctx.lineTo(cx - R + 2 * k, cy + 20 * k);
  ctx.closePath(); ctx.fill();
  // 裙座内壁高光 + 检修孔
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(cx - R + 7 * k, bodyBot + 1 * k, 2 * k, 2.8 * k);
  ctx.fillStyle = '#10151d';
  rr(ctx, cx - 3 * k, cy + 14 * k, 6 * k, 4 * k, 1 * k); ctx.fill();

  // ===== ③ 混凝土基座 + 地脚螺栓（左右各一颗）=====
  ctx.fillStyle = '#333b44';
  rr(ctx, cx - R - 1 * k, cy + 20 * k, 2 * R + 2 * k, 5.5 * k, 1 * k); ctx.fill();
  ctx.strokeStyle = '#151b23';
  ctx.lineWidth = 0.8 * k;
  rr(ctx, cx - R - 1 * k, cy + 20 * k, 2 * R + 2 * k, 5.5 * k, 1 * k); ctx.stroke();
  for (const bx of [cx - R + 0.5 * k, cx + R - 0.5 * k]) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.arc(bx, cy + 22.5 * k, 1.2 * k, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a6470';
    ctx.beginPath(); ctx.arc(bx, cy + 22.5 * k, 0.7 * k, 0, Math.PI * 2); ctx.fill();
  }

  // ===== ⑤ 罐体外壳（水平渐变：左亮右暗，模拟圆柱侧面受光）=====
  const bodyGrad = ctx.createLinearGradient(cx - R, 0, cx + R, 0);
  bodyGrad.addColorStop(0, '#2e3947');
  bodyGrad.addColorStop(0.38, '#8494aa');
  bodyGrad.addColorStop(0.58, '#5f7089');
  bodyGrad.addColorStop(1, '#232b36');
  ctx.fillStyle = bodyGrad;
  tankPath(); ctx.fill();

  // ===== ⑤ 焊缝：环箍焊缝×2（水平）+ 竖向焊缝 + 顶盖环缝 =====
  ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 0.7 * k;
  for (const wy of [cy - 10 * k, cy + 4 * k]) {
    ctx.beginPath(); ctx.moveTo(cx - R + 1 * k, wy); ctx.lineTo(cx + R - 1 * k, wy); ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 0.5 * k;
  for (const wy of [cy - 10 * k + 0.8 * k, cy + 4 * k + 0.8 * k]) {
    ctx.beginPath(); ctx.moveTo(cx - R + 1 * k, wy); ctx.lineTo(cx + R - 1 * k, wy); ctx.stroke();
  }
  // 竖向焊缝（亮面右侧，避开液位计）
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'; ctx.lineWidth = 0.6 * k;
  ctx.beginPath();
  ctx.moveTo(cx + 6 * k, bodyTop + 3 * k);
  ctx.lineTo(cx + 6 * k, bodyBot - 1 * k);
  ctx.stroke();
  // 顶盖环缝（碟形盖与直筒的焊接交界）
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 0.7 * k;
  ctx.beginPath();
  ctx.moveTo(cx - R, bodyTop);
  ctx.lineTo(cx + R, bodyTop);
  ctx.stroke();

  // ===== ⑥ 正面磁翻板液位计（透明窄管：实时液位 + 液面波纹 + 刻度 + 上下端盖）=====
  const lgW = 5 * k;
  const lgx = cx - 2.5 * k;
  const lgTop = cy - 14 * k, lgBot = cy + 14 * k;
  // 液位计管背景（深色内腔）
  ctx.fillStyle = '#0c1118';
  rr(ctx, lgx - lgW / 2, lgTop, lgW, lgBot - lgTop, 1.2 * k); ctx.fill();
  // 管内液体（连通器：与罐内液位保持一致）
  if (level > 0) {
    const fillH = (lgBot - lgTop - 1.4 * k) * level;
    const fy = lgBot - 0.7 * k - fillH;
    const fg = ctx.createLinearGradient(0, fy, 0, lgBot);
    fg.addColorStop(0, _tankMix(fluidColor, 0.95));
    fg.addColorStop(1, _tankMix(fluidColor, 0.6));
    ctx.fillStyle = fg;
    ctx.fillRect(lgx - lgW / 2 + 0.7 * k, fy, lgW - 1.4 * k, fillH);
    // 液面波动线
    const wave = Math.sin((G.time || 0) * 2.4) * 0.6 * k;
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(lgx - lgW / 2 + 0.7 * k, fy + wave, lgW - 1.4 * k, 0.7 * k);
  }
  // 液位计刻度（右侧 3 道短线：1/4 / 1/2 / 3/4）
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  for (let i = 1; i <= 3; i++) {
    const sy = lgBot - (lgBot - lgTop) * i / 4;
    ctx.fillRect(lgx + lgW / 2 + 0.4 * k, sy - 0.25 * k, 1.6 * k, 0.5 * k);
  }
  // 液位计外框 + 上下端盖（旁通管接头盖帽）
  ctx.strokeStyle = '#465264';
  ctx.lineWidth = 0.8 * k;
  rr(ctx, lgx - lgW / 2, lgTop, lgW, lgBot - lgTop, 1.2 * k); ctx.stroke();
  ctx.fillStyle = '#333c48';
  ctx.fillRect(lgx - lgW / 2 - 1 * k, lgTop - 1.4 * k, lgW + 2 * k, 1.6 * k);
  ctx.fillRect(lgx - lgW / 2 - 1 * k, lgBot - 0.2 * k, lgW + 2 * k, 1.6 * k);

  // ===== ⑦ 顶部附件：压力表（左）+ 放空管（右）=====
  {
    // 压力表（支撑颈 + 表盘 + 4 刻度 + 液位联动指针，>85% 变红）
    // 位置略向穹顶中间收（cx-4k）：避开北面格中心线上的端口法兰（x=16k/48k 两档）
    const gx0 = cx - 4 * k, gy0 = cy - 26 * k, gr = 4.5 * k;
    ctx.fillStyle = '#333c48';
    ctx.fillRect(gx0 - 0.9 * k, cy - 25 * k, 1.8 * k, 3.5 * k);
    ctx.fillStyle = '#0c1117';
    ctx.beginPath(); ctx.arc(gx0, gy0, gr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3a4656';
    ctx.lineWidth = 0.8 * k;
    ctx.beginPath(); ctx.arc(gx0, gy0, gr, 0, Math.PI * 2); ctx.stroke();
    // 玻璃高光
    ctx.fillStyle = 'rgba(255,255,255,0.20)';
    ctx.beginPath(); ctx.arc(gx0 - 1.3 * k, gy0 - 1.4 * k, 1.3 * k, 0, Math.PI * 2); ctx.fill();
    // 刻度（4 个主刻度）
    ctx.strokeStyle = 'rgba(255,255,255,0.55)'; ctx.lineWidth = 0.6 * k;
    for (let a = 0; a < 4; a++) {
      const t1 = Math.PI * 0.75 + a * Math.PI * 0.5;
      ctx.beginPath();
      ctx.moveTo(gx0 + Math.cos(t1) * 3 * k, gy0 + Math.sin(t1) * 3 * k);
      ctx.lineTo(gx0 + Math.cos(t1) * 4 * k, gy0 + Math.sin(t1) * 4 * k);
      ctx.stroke();
    }
    // 指针：随液位在 0.75π ~ 2.25π（270°~0°+45°）扫动
    const needle = Math.PI * 0.75 + Math.PI * 1.5 * level;
    ctx.strokeStyle = level > 0.85 ? '#ff7848' : '#7fe08f';
    ctx.lineWidth = 1 * k;
    ctx.beginPath();
    ctx.moveTo(gx0, gy0);
    ctx.lineTo(gx0 + Math.cos(needle) * 3.1 * k, gy0 + Math.sin(needle) * 3.1 * k);
    ctx.stroke();
    // 表中心轴
    ctx.fillStyle = '#1a212c';
    ctx.beginPath(); ctx.arc(gx0, gy0, 0.9 * k, 0, Math.PI * 2); ctx.fill();
  }
  {
    // 放空管（呼吸阀：短竖管 + 管箍 + 顶帽）；同样居中偏右（cx+6k）避开端口法兰
    const vx = cx + 6 * k;
    const vg = ctx.createLinearGradient(vx - 1.4 * k, 0, vx + 1.4 * k, 0);
    vg.addColorStop(0, '#7a8a9e');
    vg.addColorStop(1, '#3a4656');
    ctx.fillStyle = vg;
    ctx.fillRect(vx - 1.4 * k, cy - 29 * k, 2.8 * k, 5.5 * k);
    ctx.fillStyle = '#2a323e';
    ctx.fillRect(vx - 2.6 * k, cy - 26 * k, 5.2 * k, 1.3 * k);   // 管箍
    ctx.fillStyle = '#4a5566';
    ctx.fillRect(vx - 2.8 * k, cy - 30.6 * k, 5.6 * k, 1.6 * k);  // 顶帽
    ctx.strokeStyle = '#151b23';
    ctx.lineWidth = 0.5 * k;
    ctx.strokeRect(vx - 2.8 * k, cy - 30.6 * k, 5.6 * k, 1.6 * k);
  }

  // ===== 罐体外框描边 + 顶盖弧高光 =====
  ctx.strokeStyle = '#151b23';
  ctx.lineWidth = 1.5 * k;
  tankPath(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1 * k;
  ctx.beginPath();
  ctx.ellipse(cx, bodyTop, R - 2.5 * k, domeRy - 1.8 * k, 0, Math.PI * 1.1, Math.PI * 1.8);
  ctx.stroke();

  // ===== ⑧ 对角角落接口（对齐官方 factorio-data：每个角落两只口，互不合并）=====
  // 活跃角落：dir 0/2 → 北西角+南东角；dir 1/3 → 北东角+南西角。
  // 每个角落两只独立端口法兰，均精确对齐接口所在格的中心线（沿边 16k/48k = 半格/整格中线）：
  //   横边口（北/南面口）中心落在该列格中心线上、距横边 5k；竖边口（西/东面口）落在该行格中心线上、距竖边 5k。
  // 法兰外缘跨过包围盒边界约 1.5px：相邻管道的连接段正好画到瓦片边、沿同一格中心线，
  // 与法兰严丝合缝对接——管道口显示在格子中线上，视觉上刚好与管道连接。
  const corners = (dir % 2 === 0) ? [[-1, -1], [1, 1]] : [[1, -1], [-1, 1]];
  // 单只端口法兰（drawPort 同款五层样式；半径 6.5k，同角落两只并排不重叠）
  const drawPortDisc = (x, y) => {
    ctx.fillStyle = '#454b54';                                    // ① 法兰底座
    ctx.beginPath(); ctx.arc(x, y, 6.5 * k, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 0.9 * k;
    ctx.beginPath(); ctx.arc(x, y, 6.5 * k, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#636c78';                                    // ② 法兰顶面
    ctx.beginPath(); ctx.arc(x, y, 5.2 * k, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = PORT_FLUID;                                   // ③ 端口内孔（通用流体口色）
    ctx.beginPath(); ctx.arc(x, y, 3.8 * k, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 0.8 * k; // ④ 内孔凹槽描边
    ctx.beginPath(); ctx.arc(x, y, 3.8 * k, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.38)'; ctx.lineWidth = 1 * k;    // ⑤ 顶部高光弧
    ctx.beginPath(); ctx.arc(x, y, 4.6 * k, -Math.PI * 1.05, -Math.PI * 0.62); ctx.stroke();
  };
  for (const [sx, sy] of corners) {
    const colX = px + (sx > 0 ? 48 * k : 16 * k);   // 角落所在列的格中心线
    const rowY = py + (sy > 0 ? 48 * k : 16 * k);   // 角落所在行的格中心线
    drawPortDisc(colX, py + (sy < 0 ? 5 * k : s - 5 * k));   // 横边口（北/南面口）
    drawPortDisc(px + (sx < 0 ? 5 * k : s - 5 * k), rowY);   // 竖边口（西/东面口）
  }
  // ALT 详情：在每个活跃角落两只法兰之间画当前流体图标（悬停角落格同样显示流体名）
  if (portDetailsVisible() && f && ITEMS[f]) {
    for (const [sx, sy] of corners) {
      drawItemGlyph(ctx, f, cx + sx * 12 * k, cy + sy * 12 * k, 18 * k);
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
  h += '<div class="dim">储液罐大容量缓冲（' + STORAGE_TANK_CAP + ' 单位），罐内只容纳单一液体/气体。罐像管道一样互联互通：接口集中在一对对角角落（北西角：北面+西面两口；南东角：东面+南面两口，对齐官方布局；旋转 90° 切换为另一对对角），可进可出，与相邻管道/地下管道（管口侧）/储液罐按液位自动平衡，任一接口进、可从其他接口出，也能接其他管道或其他储液罐；同时向相邻炼油厂/化工厂等输入口供料。出入口处会显示当前流体图标。</div>';
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
DEVICE_DIR_ROTATE['storage-tank'] = true; // 支持旋转
DEVICE_STATUS['storage-tank'] = e => e.total() > 0 ? 'g' : 'r';
DEVICE_PANEL['storage-tank'] = { html: storageTankPanelHtml, live: storageTankPanelLive, tip: storageTankTip };
// 显示详情时，接口所在的对角角落格 + 当前存储流体名（用于鼠标悬停显示流体名称）。
// 图标放在罐体自身的角落格上（entAt 可命中），随 dir 在两对对角之间切换。
DEVICE_FLUID_ICONS['storage-tank'] = e => {
  const f = tankFluid(e);
  if (!f) return [];
  const cs = (e.dir % 2 === 0)
    ? [[e.x, e.y], [e.x + e.w - 1, e.y + e.h - 1]]        // 北西角格 + 南东角格
    : [[e.x + e.w - 1, e.y], [e.x, e.y + e.h - 1]];       // 北东角格 + 南西角格
  return cs.map(c => ({ x: c[0], y: c[1], fluid: f }));
};
