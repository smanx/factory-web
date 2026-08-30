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
// 储液罐渲染：俯视「圆形储罐」（2×2 占地保持不变）——正圆金属罐体 + 同心环带 +
// 圆周均匀液面指示点 + 中心毂盖，接口仍在对角角落（对齐官方 factorio-data）。
// 设备可 R 旋转、V/H 翻转（dir 0/2↔1/3 切换接口对角，翻转仅镜像 dir 不改端口逻辑），
// 因此视觉元素全部使用圆对称结构：液量以「圆周刻度点 + 中心液色辉光」表现——
// 任意 dir 旋转/水平垂直翻转后观感完全一致；罐内液量多寡只改变亮度/点亮数，不产生方向性形变。
// 视觉分层（自下而上）：
//   ① 地面阴影  ② 混凝土基座圆盘  ③ 罐体外壳圆盘（径向渐变 + 铆钉圈 + 环箍焊缝）
//   ④ 内腔（环形腔带：液色随液位加深，运转涟漪高光弧）
//   ⑤ 圆周液面刻度（16 点均匀分布，按液位比例从缺口起顺时针点亮）
//   ⑥ 中心毂盖（六角螺栓盖 + 液色小圆窗）
//   ⑦ 顶部呼吸阀小点（液满时闪烁警示）⑧ 对角角落接口（对齐格中心线）+ ALT 流体图标
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
  const t = G.time || 0;

  // ===== 俯视圆罐几何（正圆，与 dir 无关；dir 仅切换接口对角）=====
  const R = 28 * k;               // 罐体外接半径（略小于 32k 半格宽，留基座边）

  // 罐体路径（正圆）
  const tankPath = () => {
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
  };

  // ===== 低 LOD（缩远）：圆罐剪影 + 液色填充 + 角落接口点，省掉全部细节 =====
  if (simple) {
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath(); ctx.arc(cx + 1.5 * k, cy + 1.5 * k, R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#465264';
    tankPath(); ctx.fill();
    if (level > 0) {
      ctx.fillStyle = _tankMix(fluidColor, 0.5 + level * 0.4);
      ctx.beginPath(); ctx.arc(cx, cy, R * 0.82, 0, Math.PI * 2); ctx.fill();
    }
    // 活跃对角角落的接口点（低 LOD 下每角落两枚小点，对齐格中心线，与法兰位置一致）
    ctx.fillStyle = '#636c78';
    const _cs = (dir % 2 === 0) ? [[-1, -1], [1, 1]] : [[1, -1], [-1, 1]];
    for (const [sx, sy] of _cs) {
      const _colX = px + (sx > 0 ? 48 * k : 16 * k);
      const _rowY = py + (sy > 0 ? 48 * k : 16 * k);
      const _edge = 5 * k;
      ctx.fillRect(_colX - 1.25 * k, py + (sy < 0 ? _edge : s - _edge) - 1.25 * k, 2.5 * k, 2.5 * k);
      ctx.fillRect(px + (sx < 0 ? _edge : s - _edge) - 1.25 * k, _rowY - 1.25 * k, 2.5 * k, 2.5 * k);
    }
    ctx.globalAlpha = 1;
    return;
  }

  // ===== ① 地面阴影 =====
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath(); ctx.arc(cx + 2 * k, cy + 3 * k, R, 0, Math.PI * 2); ctx.fill();

  // ===== ② 混凝土基座圆盘 + 地脚螺栓（8 颗圆周均匀）=====
  ctx.fillStyle = '#333b44';
  ctx.beginPath(); ctx.arc(cx, cy, R + 2.5 * k, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#151b23';
  ctx.lineWidth = 1 * k;
  ctx.beginPath(); ctx.arc(cx, cy, R + 2.5 * k, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + Math.PI / 8;
    const bx = cx + Math.cos(a) * (R - 1.5 * k), by = cy + Math.sin(a) * (R - 1.5 * k);
    ctx.beginPath(); ctx.arc(bx, by, 1.1 * k, 0, Math.PI * 2); ctx.fill();
  }

  // ===== ③ 罐体外壳圆盘（径向渐变：左上受光）+ 铆钉圈 + 环箍焊缝×2 =====
  const bodyGrad = ctx.createRadialGradient(cx - R * 0.35, cy - R * 0.35, R * 0.08, cx, cy, R);
  bodyGrad.addColorStop(0, '#8494aa');
  bodyGrad.addColorStop(0.45, '#5f7089');
  bodyGrad.addColorStop(1, '#232b36');
  ctx.fillStyle = bodyGrad;
  tankPath(); ctx.fill();
  // 铆钉圈（12 颗，圆周均匀——旋转/翻转后依旧均匀）
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * (R - 5 * k), cy + Math.sin(a) * (R - 5 * k), 1.1 * k, 0, Math.PI * 2);
    ctx.fill();
  }
  // 环箍焊缝×2（同心圆，深浅双线）
  for (const [wr, lw] of [[R * 0.72, 1 * k], [R * 0.44, 0.8 * k]]) {
    ctx.strokeStyle = 'rgba(0,0,0,0.28)';
    ctx.lineWidth = lw;
    ctx.beginPath(); ctx.arc(cx, cy, wr, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)';
    ctx.lineWidth = lw * 0.6;
    ctx.beginPath(); ctx.arc(cx, cy, wr + lw, 0, Math.PI * 2); ctx.stroke();
  }

  // ===== ④ 内腔（环形腔带：液色随液位加深；运转时涟漪高光弧流动——圆对称无方向性）=====
  const inR = R * 0.34;
  ctx.fillStyle = '#0c1118';
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.78, 0, Math.PI * 2); ctx.fill();
  if (level > 0) {
    // 液色辉光：液位越高越亮（径向渐变，圆对称）
    const fg = ctx.createRadialGradient(cx, cy, inR * 0.3, cx, cy, R * 0.76);
    fg.addColorStop(0, _tankMix(fluidColor, 0.35 + level * 0.6));
    fg.addColorStop(1, _tankMix(fluidColor, 0.18 + level * 0.42));
    ctx.fillStyle = fg;
    ctx.beginPath(); ctx.arc(cx, cy, R * 0.76, 0, Math.PI * 2); ctx.fill();
    // 运转涟漪（有进液/存液时的高光弧流动；角度随时间推进，任意方向观感一致）
    if (level > 0.02) {
      ctx.strokeStyle = _tankMix('#ffffff', 0.18 + Math.sin(t * 2.4) * 0.06);
      ctx.lineWidth = 1.4 * k;
      const sweep = (t * 0.8) % (Math.PI * 2);
      for (let i = 0; i < 3; i++) {
        const a0 = sweep + i * Math.PI * 2 / 3;
        ctx.beginPath(); ctx.arc(cx, cy, R * 0.58, a0, a0 + Math.PI * 0.55); ctx.stroke();
      }
    }
  }
  // 内腔外沿钢圈
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1.6 * k;
  ctx.beginPath(); ctx.arc(cx, cy, R * 0.78, 0, Math.PI * 2); ctx.stroke();

  // ===== ⑤ 圆周液面刻度（16 点均匀分布，按液位从缺口起顺时针点亮——液量指示无方向性）=====
  const tickN = 16, litN = Math.round(level * tickN);
  for (let i = 0; i < tickN; i++) {
    const a = -Math.PI / 2 + i * Math.PI * 2 / tickN;   // 起点缺口在正上（仅起点，旋转后刻度环依旧均匀）
    const tx = cx + Math.cos(a) * (R * 0.90), ty = cy + Math.sin(a) * (R * 0.90);
    if (i < litN) {
      ctx.fillStyle = _tankMix(fluidColor, 0.85);
      ctx.beginPath(); ctx.arc(tx, ty, 1.7 * k, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.beginPath(); ctx.arc(tx - 0.5 * k, ty - 0.5 * k, 0.6 * k, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.beginPath(); ctx.arc(tx, ty, 1.1 * k, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ===== ⑥ 中心毂盖（六角螺栓盖 + 液色小圆窗——液位联动亮度）=====
  // 六角盖（6 边正多边形，旋转对称）
  ctx.fillStyle = '#333c48';
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 + Math.PI / 6;
    const hx = cx + Math.cos(a) * inR * 1.05, hy = cy + Math.sin(a) * inR * 1.05;
    i === 0 ? ctx.moveTo(hx, hy) : ctx.lineTo(hx, hy);
  }
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#151b23';
  ctx.lineWidth = 1 * k;
  ctx.stroke();
  // 液色小圆窗（观察孔：液量越多越亮）
  ctx.fillStyle = '#0c1117';
  ctx.beginPath(); ctx.arc(cx, cy, inR * 0.55, 0, Math.PI * 2); ctx.fill();
  if (level > 0) {
    ctx.fillStyle = _tankMix(fluidColor, 0.3 + level * 0.65);
    ctx.beginPath(); ctx.arc(cx, cy, inR * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath(); ctx.arc(cx - inR * 0.12, cy - inR * 0.12, inR * 0.14, 0, Math.PI * 2); ctx.fill();
  }
  // 六颗盖面螺栓（圆周均匀）
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * inR * 0.78, cy + Math.sin(a) * inR * 0.78, 0.7 * k, 0, Math.PI * 2);
    ctx.fill();
  }

  // ===== ⑦ 呼吸阀小点（顶部边缘一点；液满时闪烁警示——圆对称单点，方向无关）=====
  {
    const va = -Math.PI / 2;
    const vx = cx + Math.cos(va) * (R - 2 * k), vy = cy + Math.sin(va) * (R - 2 * k);
    ctx.fillStyle = '#2a323e';
    ctx.beginPath(); ctx.arc(vx, vy, 2.2 * k, 0, Math.PI * 2); ctx.fill();
    if (level >= 0.999) {
      ctx.fillStyle = _tankMix('#ff7848', 0.5 + Math.sin(t * 6) * 0.4);
      ctx.beginPath(); ctx.arc(vx, vy, 1.3 * k, 0, Math.PI * 2); ctx.fill();
    } else if (level > 0) {
      ctx.fillStyle = _tankMix(fluidColor, 0.6);
      ctx.beginPath(); ctx.arc(vx, vy, 1.1 * k, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ===== 罐体外框描边 + 顶盖弧高光 =====
  ctx.strokeStyle = '#151b23';
  ctx.lineWidth = 1.5 * k;
  tankPath(); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1 * k;
  ctx.beginPath(); ctx.arc(cx, cy, R - 2.5 * k, Math.PI * 1.1, Math.PI * 1.5); ctx.stroke();

  // ===== ⑧ 对角角落接口（对齐官方 factorio-data：每个角落两只口，互不合并）=====
  // 活跃角落：dir 0/2 → 北西角+南东角；dir 1/3 → 北东角+南西角。
  // 每个角落两只独立端口法兰，均精确对齐接口所在格的中心线（沿边 16k/48k）：
  //   横边口（北/南面口）中心落在该列格中心线上、距横边 5k；竖边口（西/东面口）落在该行格中心线上、距竖边 5k。
  // 法兰外缘跨过包围盒边界约 1.5px：与相邻管道的连接段严丝合缝对接。
  const corners = (dir % 2 === 0) ? [[-1, -1], [1, 1]] : [[1, -1], [-1, 1]];
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
  let h = row('流体', Object.keys(agg).length ? '<div class="asm3-inp-row">' + itemSlotsHtml(agg, { action: 'display' }) + '</div>' : '<span class="dim">空</span>', 'contents');
  h += row('容量', e.total() + ' / ' + STORAGE_TANK_CAP, 'cap');
  if (Object.keys(agg).length) h += '<button data-action="takeout" id="btn-tank-takeout">取出全部 (' + e.total() + ')</button>';
  h += '<div class="dim">储液罐大容量缓冲（' + STORAGE_TANK_CAP + ' 单位），罐内只容纳单一液体/气体。罐像管道一样互联互通：接口集中在一对对角角落（北西角：北面+西面两口；南东角：东面+南面两口，对齐官方布局；旋转 90° 切换为另一对对角），可进可出，与相邻管道/地下管道（管口侧）/储液罐按液位自动平衡，任一接口进、可从其他接口出，也能接其他管道或其他储液罐；同时向相邻炼油厂/化工厂等输入口供料。出入口处会显示当前流体图标。</div>';
  h += '<div class="dim">已接入电路网络：罐内流体存量以流体名（如水→water）作为信号输出到所连网络，供组合器/功率开关/机械臂等做按液位自动化（对齐《异星工厂》储液罐电路信号）。</div>';
  return h;
}
function storageTankPanelLive(e, api) {
  const agg = {};
  for (const k in e.fluid) if (e.fluid[k] > 0) agg[k] = e.fluid[k];
  api.set('contents', Object.keys(agg).length ? '<div class="asm3-inp-row">' + itemSlotsHtml(agg, { action: 'display' }) + '</div>' : dimSpan('空'));
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
