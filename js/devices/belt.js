'use strict';

// ===== 传送带 =====
// 性能优化：传送带物品排序的比较器提为模块级常量，避免每帧在 update 中重建闭包（降低 GC 压力）
const _beltItemSortDesc = (a, b) => b.pos - a.pos;

class Belt extends Entity {
  constructor(type, x, y) {
    super(type || 'transport-belt', x, y);
    this.items = [];
    // 电路控制（对齐《异星工厂》：传送带接入电路网络，可按信号启停）
    this.circuitCond = { enabled: false, channel: 'red', sig: 'iron-plate', op: '>', count: 1, circuitRead: false };
  }
  // 电路启停：未启用条件时恒运转；启用后仅当附近电路信号满足条件才送带
  circuitEnabled() {
    if (!this.circuitCond || !this.circuitCond.enabled) return true;
    const sig = circuitSignalNear(this);
    return circuitCondOk(sig, this.circuitCond);
  }
  speedMult() { return this.type === 'fast-transport-belt' ? FAST_BELT_MULT : 1; }
  // 双列车道：传送带由左右两列独立车道组成（对齐《异星工厂》），
  // 每条车道各自携带物品、互不占位。Lane 0 / Lane 1 指行进方向的左右列。
  laneOf(o) { return o && o.lane === 1 ? 1 : 0; }
  update(dt) {
    // 电路条件不满足时传送带停转，带上物品原地冻结
    if (!this.circuitEnabled()) return;
    // 吸附地面物品：玩家按 Q 丢到带上的物品会被传送带带走（对齐《异星工厂》手动上料）
    if (typeof groundItemForBelt === 'function' && (!this.items || this.items.length === 0)) {
      const g = groundItemForBelt(this.x, this.y);
      if (g && this.acceptItem(g.item)) {   // 不传来源方向：从带尾接入（相当于地面物品被带推动）
        g.n--;
        if (g.n <= 0) g.taken = true;
      }
    }
    // 惰性调度（P0 优化）：空带没有任何可移动物品，跳过真实更新
    // （排序/邻居扫描/转移判定），空传送带完全无需每帧运行。
    if (!this.items || this.items.length === 0) return;
    // 双车道合计吞吐口径：两条车道并行但面板/数值以「双车道总速度」计（基础带=15 件/秒）。
    // 因此单车道移动速度须为带速的一半（基础带 1.875/2=0.9375 格/秒 → 单列 7.5、双列 15 件/秒）。
    const sp = beltSpeed() * this.speedMult() * dt / 2;
    this._sp = sp;
    // 每列车道各自推进：前端到达出口即转移到下一格对应车道
    this.transferFront();
    for (let lane = 0; lane < 2; lane++) {
      const laneItems = [];
      for (const o of this.items) if (this.laneOf(o) === lane) laneItems.push(o);
      if (!laneItems.length) continue;
      laneItems.sort(_beltItemSortDesc);
      for (let i = 0; i < laneItems.length; i++) {
        const it = laneItems[i];
        let lim = 1;
        if (i > 0) lim = Math.max(0, laneItems[i - 1].pos - BELT_SPACING);
        it.pos = Math.min(it.pos + sp, lim);
        if (it.pos < 0) it.pos = 0;
      }
    }
  }
  // 前端转移：两条车道的各自前端物品到达出口时，各自转移到下一格对应车道
  transferFront() {
    const sp = this._sp || 0;
    for (let lane = 0; lane < 2; lane++) {
      let idx = -1, front = null;
      for (let i = 0; i < this.items.length; i++) {
        const o = this.items[i];
        if (this.laneOf(o) !== lane) continue;
        if (!front || o.pos > front.pos) { front = o; idx = i; }
      }
      if (!front || front.pos + sp < 1) continue;
      this._transferOne(idx);
    }
  }
  _transferOne(idx) {
    const f = this.items[idx];
    const nx = this.x + DX[this.dir], ny = this.y + DY[this.dir];
    const nb = entAt(nx, ny);
    if (!nb) return false;
    if (nb instanceof Belt) {
      // 是否为“纯 90° 转角”：下游带从侧面接入、背面无直行带。此时源带的左右两列
      // 应各自映射到转角的内/外弧（车道号保持），对齐《异星工厂》弯道双列不交叉，
      // 绝不能把两条源车道塌缩成一条（否则 A/B 两线物品会在弯道混叠、互相干扰）。
      const isCorner = beltCornerDir(nb) !== null;
      if (!(nb instanceof Splitter)) {
        if (nb.dir === ((this.dir + 2) % 4)) return false;
        // 直通/纯转角沿用源车道；一般侧面交叉（横向搭接进直线带）则进入下游“近侧车道”。
        // 因此尾部空位检查也应对应物品实际进入的那条车道。
        const targetLane = (nb.dir === this.dir || isCorner) ? f.lane : sideOfLane(nb, this.dir);
        let back = Infinity;
        for (const o of nb.items) if (nb.laneOf(o) === targetLane) back = Math.min(back, o.pos);
        if (back < BELT_SPACING) return false;
      }
      // 纯转角沿用源车道号传入 laneHint，让转角按内/外弧承接两条车道；
      // 一般侧面交叉（横向搭接进直线带）不传 laneHint，交由下游按“近侧车道”
      // 判定，避免把 A 的车道号误当作 B 的车道号、把物品错放到 B 的远侧车道。
      const laneHint = (nb.dir === this.dir || isCorner) ? f.lane : undefined;
      if (!nb.acceptItem(f.item, this.dir, this.x, this.y, laneHint)) return false;
      this.items.splice(idx, 1);
      return true;
    }
    if (nb instanceof Underground) {
      // 传入 lane 作为 laneHint：让地下带保留物品所在车道（左进左出/右进右出），
      // 与地上传送带直通逻辑一致，避免进洞后 lane 信息丢失导致两线混合。
      if (!nb.acceptItem(f.item, this.dir, this.x, this.y, f.lane)) return false;
      this.items.splice(idx, 1);
      return true;
    }
    if (nb instanceof Splitter && nb.acceptItem(f.item, this.dir, this.x, this.y, f.lane)) {
      this.items.splice(idx, 1);
      return true;
    }
    return false;
  }
  // 判断邻居带 (x,y) 是否“有货即将进入本带”：其前端物品已过半程、逼近出口。
  // 用于 T 型转角调度：直线优先时判定直通方向是否待进入；双侧轮流时判定对侧是否待进入。
  _beltIncoming(x, y) {
    const nb = entAt(x, y);
    if (!(nb instanceof Belt) || !nb.items || !nb.items.length) return false;
    for (const o of nb.items) if (o.pos >= 0.5) return true;
    return false;
  }
  // 是否背面存在同向直行带（即“直线输入”，与出口同一直线）。
  _hasStraightBack() {
    const bx = this.x - DX[this.dir], by = this.y - DY[this.dir];
    const nb = entAt(bx, by);
    return nb instanceof Belt && nb.dir === this.dir;
  }
  acceptItem(item, fromDir, sx, sy, laneHint) {
    const rel = (fromDir === undefined || fromDir === null) ? -1 : ((fromDir - this.dir) % 4 + 4) % 4;
    const isSide = rel === 1 || rel === 3;
    const isTail = rel === 0;   // 尾部输入：与行进同向的直通带从带尾送入
    const side = isSide ? beltSideIndex(this, fromDir) : -1;
    const inp = beltInputSide(this);
    const haveBack = this._hasStraightBack();

    // —— 调度规则（仅对 T 型多路进“双路进一出”生效）——
    if (isSide && (haveBack || inp.length >= 2)) {
      // 1) 直线优先：背面存在直通输入时，直线方向先于侧面进入；
      //    直通有货且能进入本带时侧面暂缓（return false，让直通先过）；
      //    但若直通货物因目标车道满载无法进入本带，不应阻止侧面输入流向空闲车道。
      if (haveBack && this._beltIncoming(this.x - DX[this.dir], this.y - DY[this.dir])) {
        const backBelt = entAt(this.x - DX[this.dir], this.y - DY[this.dir]);
        let backCanEnter = false;
        if (backBelt instanceof Belt && backBelt.items) {
          for (const o of backBelt.items) {
            if (o.pos < 0.5) continue;
            let space = Infinity;
            for (const bi of this.items) if (this.laneOf(bi) === o.lane) space = Math.min(space, bi.pos);
            if (space >= BELT_SPACING) { backCanEnter = true; break; }
          }
        }
        if (backCanEnter) return false;
      }
      // 2) 两个相对侧面（无背面直通）：方向感知优先。
      //    对齐《异星工厂》双线交汇：当 1 号带 A、B 两线汇聚到 2 号带同一线且该线满载时，
      //    优先让“接收带流向右侧”的输入进入——两侧输入分别对应接收带流向的左/右侧
      //    （sides[0] 恒为流向右侧、sides[1] 为流向左侧），因此旋转接收带即可切换优先侧，
      //    优先级随 2 号带流动方向改变，而不是盲目轮流。
      //    - 优先侧（流向右侧）：对侧也有货且本侧刚进过时才让位（防饿死，保证对侧也有机会）。
      //    - 非优先侧（流向左侧）：优先侧有货待进入时一律让位。
      if (!haveBack && inp.length >= 2) {
        const pref = 0; // sides[0] 恒为接收带流向右侧的输入
        if (side === pref) {
          const other = inp[1 - side];
          if (other && this._beltIncoming(this.x + other[0], this.y + other[1]) && this._lastSideIn === side) return false;
        } else {
          const pri = inp[pref];
          if (pri && this._beltIncoming(this.x + pri[0], this.y + pri[1]) && this._lastSideIn !== pref) return false;
        }
      }
      this._lastSideIn = side;
    }

    // —— 双列车道选择（对齐《异星工厂》）——
    // 1) 直通转移：沿用源车道；
    // 2) 侧面输入（机械臂/侧带）：进入近侧车道；
    // 3) 尾部输入：交替车道，使两条车道均衡装载。
    let lane;
    if (laneHint !== undefined && laneHint !== null) {
      lane = laneHint === 1 ? 1 : 0;
    } else if (isSide) {
      lane = sideOfLane(this, fromDir);
    } else {
      lane = isTail ? (this._nextTailLane || 0) : 0;
    }

    // 车道选择已确定（lane）。对“已指定车道”的输入（直通 laneHint / 侧面 side）
    // 严格只使用该车道，绝不让物品溢出到另一条车道（对齐《异星工厂》：两条线路相互独立，
    // 侧面搭接的物品只走靠近源的那条边，另一条边保持空置）。
    // 仅对“未指定车道的尾部输入”（机械臂/地面物品从带尾投放）保留回退，用于均衡装载。
    const strictLane = (laneHint !== undefined && laneHint !== null) || isSide;
    const laneTry = strictLane ? [lane] : [lane, 1 - lane];
    const candidates = isSide ? [0.45, 0] : [0, 0.45];
    for (const l of laneTry) {
      for (const p of candidates) {
        let ok = true;
        for (const o of this.items)
          if (this.laneOf(o) === l && Math.abs(o.pos - p) < BELT_SPACING) { ok = false; break; }
        if (ok) {
          this.items.push({ item, pos: p, lane: l, side: isSide ? side : -1 });
          if (isTail && l === lane) this._nextTailLane = 1 - (this._nextTailLane || 0);
          return true;
        }
      }
    }
    return false;
  }
  grabZone(item, lane) {
    let best = null;
    for (const o of this.items)
      if ((lane === undefined || lane === null || this.laneOf(o) === lane)
        && o.pos >= 0.2 && (!item || o.item === item) && (!best || o.pos > best.pos)) best = o;
    return best;
  }
  countOf(item) {
    let n = 0;
    for (const o of this.items) if (o.pos >= 0.2 && o.item === item) n++;
    return n;
  }
  peekItem() {
    const z = this.grabZone();
    return z ? z.item : null;
  }
  takeOutput() {
    const z = this.grabZone();
    if (!z) return null;
    this.items.splice(this.items.indexOf(z), 1);
    return z.item;
  }
  // 手动拿取（F 键）：取带上最前端的物品
  takeItem() {
    if (!this.items.length) return null;
    let best = this.items[0];
    for (const o of this.items) if (o.pos > best.pos) best = o;
    this.items.splice(this.items.indexOf(best), 1);
    return best.item;
  }
  // 带上携带的每种物品计数（供电路网络「读取内容」输出信号，对齐《异星工厂》Belt Read contents）
  countsByItem() {
    const agg = {};
    for (const o of this.items) agg[o.item] = (agg[o.item] || 0) + 1;
    return agg;
  }
  contents() {
    const list = [[this.type, 1]];
    for (const o of this.items) list.push([o.item, 1]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.items = this.items.map(o => [o.item, +o.pos.toFixed(3), o.side === undefined ? -1 : o.side, o.lane === 1 ? 1 : 0]);
    if (this.circuitCond) s.circuitCond = this.circuitCond;
    return s;
  }
  static restore(s) {
    const b = super.restore(s);
    b.items = (s.items || []).map(a => ({ item: a[0], pos: a[1], side: a.length > 2 ? a[2] : -1, lane: a.length > 3 ? (a[3] === 1 ? 1 : 0) : 0 }));
    b.circuitCond = s.circuitCond || { enabled: false, channel: 'red', sig: 'iron-plate', op: '>', count: 1, circuitRead: false };
    return b;
  }
}

// ===== 渲染 =====
function dirIndexOf(dx, dy) {
  for (let i = 0; i < 4; i++) if (DX[i] === dx && DY[i] === dy) return i;
  return -1;
}

// beltInputSide 结果缓存在实体上：邻居增删时由 addEnt/removeEnt 统一失效，
// 避免每帧为每条传送带反复遍历邻居实体（P0 优化）。
// 返回一个数组：横向传送带的左右两侧都可各接一条传送带（对齐《异星工厂》），
// 因此这里返回 0~2 个侧面输入源，而不再只取第一个。
function beltInputSide(e) {
  if (e.__inpCached) return e.__inp;
  const fdx = DX[e.dir], fdy = DY[e.dir];
  const sides = [[fdy, -fdx], [-fdy, fdx]];
  const inps = [];
  for (const [sx, sy] of sides) {
    const nb = entAt(e.x + sx, e.y + sy);
    if (!nb) continue;
    const want = dirIndexOf(-sx, -sy);
    // 地下带只有“出口”（已配对、后方有mate）才会把货投向地面带，
    // 入口会把货钻入地下、不会向旁边传送带输出，因此入口不搭在侧面传送带上。
    // 未配对的地下带仅作静态显示，不搭在其他传送带上（对齐《异星工厂》）。
    if (nb instanceof Underground && nb.dir === want && nb.findBackMate()) { inps.push([sx, sy]); continue; }
    if (nb instanceof Belt && nb.dir === want) { inps.push([sx, sy]); continue; }
  }
  e.__inp = inps;
  e.__inpCached = true;
  return inps;
}

// 返回 fromDir 对应的侧面输入索引（0/1），若 not 侧面输入返回 -1。
// 用于 acceptItem 记录物品来自哪个侧面，从而在渲染时让物品从对应侧面“搭上去”。
function beltSideIndex(e, fromDir) {
  const fdx = DX[e.dir], fdy = DY[e.dir];
  const sides = [[fdy, -fdx], [-fdy, fdx]];
  const sx = -DX[fromDir], sy = -DY[fromDir];
  for (let i = 0; i < 2; i++) if (sides[i][0] === sx && sides[i][1] === sy) return i;
  return -1;
}

// 侧面输入（机械臂/侧带）进入的车道：物品进入近侧车道（对齐《异星工厂》）。
// 返回 0 或 1，与渲染偏移（+perp 侧为 lane 1）保持一致。
function sideOfLane(e, fromDir) {
  const sx = -DX[fromDir], sy = -DY[fromDir];
  const fdx = DX[e.dir], fdy = DY[e.dir];
  const perp = [fdy, -fdx];
  const d = sx * perp[0] + sy * perp[1];
  return d > 0 ? 1 : 0;
}

// 车道垂直偏移向量（沿行进方向左侧为 lane 0、右侧为 lane 1）。
// 用于渲染物品在两条车道上的水平错位。
function beltLaneOffset(e, lane) {
  const fdx = DX[e.dir], fdy = DY[e.dir];
  // perp = [fdy, -fdx] 为行进方向右侧；lane 1 在右侧（+perp），lane 0 在左侧（-perp）
  const k = lane === 1 ? 1 : -1;
  return [fdy * k, -fdx * k];
}

// ===== 90° 转角渲染 =====
// 判断是否为"纯 90° 转角"：有且仅有一个侧面输入，且背面（与行进方向相反）
// 没有同向直行传送带。这样的单转角用弯曲圆弧绘制，区别于 T 型转角（背面有直行）。
// 返回该侧面输入方向向量；非转角返回 null。
function beltCornerDir(e) {
  const inp = beltInputSide(e);
  if (inp.length !== 1) return null;
  const bx = e.x - DX[e.dir], by = e.y - DY[e.dir];
  const nb = entAt(bx, by);
  if (nb instanceof Belt && nb.dir === e.dir) return null; // 背面有直行 → T 型，非纯转角
  return inp[0];
}

// 判断是否为“梯形交汇”转角：转角出口通向一条直线传送带，且该直线带的另一端也有转角汇聚进来。
// 此时两个转角与中间直线带构成梯形，若仍按弯曲圆弧绘制会在视觉上把直线带/另一转角覆盖住，
// 因此转角应直接连到直线带上，不单独绘制圆弧。非梯形交汇（纯单转）则继续用弯曲圆弧。
function beltCornerTrapezoid(e) {
  if (!beltCornerDir(e)) return false;
  const dir = e.dir;
  // 出口必须是传送带（直线带或转角），作为梯形交汇的基准带
  const nx = e.x + DX[dir], ny = e.y + DY[dir];
  const nb = entAt(nx, ny);
  if (!(nb instanceof Belt)) return false;
  // 沿基准带方向走到其另一端
  const runDir = nb.dir;
  let x = nx, y = ny;
  while (true) {
    const fx = x + DX[runDir], fy = y + DY[runDir];
    const f = entAt(fx, fy);
    if (f instanceof Belt && f.dir === runDir) { x = fx; y = fy; continue; }
    break;
  }
  // 基准带另一端之后若是一个转角、且把货送回这条带（出口反向）→ 构成梯形交汇
  const far = entAt(x + DX[runDir], y + DY[runDir]);
  if (far instanceof Belt && far.dir === ((runDir + 2) % 4)) {
    const inp = beltInputSide(far);
    if (inp.length === 1) return true;
  }
  return false;
}

// 绘制 90° 转角（弯曲圆弧带）。返回 true 表示已按转角绘制完成（含动效与物品）。
// colors: { belt: 轨道底色, chev: 动效箭头色 }
function drawBeltCorner(ctx, e, gx, gy, dir, alpha, colors) {
  const s = beltCornerDir(e);
  if (!s) return false;
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  const step = TILE / 2;
  // 转角圆弧的圆心 = 入口边与出口边相交的格角点
  // （竖直格边坐标来自水平方向 s/dir，水平格边坐标来自竖直方向 s/dir）
  const CCx = (s[0] !== 0 ? s[0] : DX[dir]) * step;
  const CCy = (s[1] !== 0 ? s[1] : DY[dir]) * step;
  const aE = Math.atan2(s[1] * step - CCy, s[0] * step - CCx); // 入口角
  const aX = Math.atan2(DY[dir] * step - CCy, DX[dir] * step - CCx); // 出口角
  let d = aX - aE;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const ccw = d < 0;
  // 轨道带：带宽 18 与直行带一致，中心线半径 = step（衔接相邻格边中心）
  const rIn = step - 9, rOut = step + 9, rC = step;

  // 轨道底色（圆环带）
  ctx.globalAlpha = alpha;
  ctx.fillStyle = colors.belt;
  ctx.strokeStyle = '#22252a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx + CCx, cy + CCy, rOut, aE, aX, ccw);
  ctx.arc(cx + CCx, cy + CCy, rIn, aX, aE, !ccw);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 动效箭头沿弧（随带速前进）
  const off = ((G.time * beltSpeed() * (e.speedMult ? e.speedMult() : 1) * TILE / 2) % step + step) % step;
  const arcLen = rC * Math.abs(d);
  ctx.fillStyle = colors.chev;
  for (let ap = off - step; ap <= arcLen + step; ap += step) {
    if (ap < 0 || ap > arcLen) continue;
    const ang = aE + d * (ap / arcLen);
    const ax = cx + CCx + Math.cos(ang) * rC, ay = cy + CCy + Math.sin(ang) * rC;
    // 切向即物品行进方向
    const tAng = ccw ? Math.atan2(-Math.cos(ang), Math.sin(ang)) : Math.atan2(Math.cos(ang), -Math.sin(ang));
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(tAng);
    tri(ctx, -3, -5, -3, 5, 3, 0);
    ctx.fill();
    ctx.restore();
  }

  // 物品沿圆弧行进（双列：外/内弧，对齐《异星工厂》弯道）。
  // lane 号是传送带材质本身的物理车道（右转为内/外互换、左转保持），
  // 因此内/外弧归属取决于转弯方向：右转 lane0 走内弧、lane1 走外弧；
  // 左转 lane0 走外弧、lane1 走内弧，与源带/出带的直行车道视觉连续。
  const srcDir = dirIndexOf(-s[0], -s[1]);
  const turnZ = DX[srcDir] * DY[dir] - DY[srcDir] * DX[dir]; // >0 右转，<0 左转
  const rightTurn = turnZ > 0;
  const itemFn = (LOD && LOD.simple) ? drawItemDotLOD : drawItemDot;
  for (const o of e.items) {
    const ang = aE + d * o.pos;
    const innerLane = rightTurn ? 0 : 1; // 内弧所属车道（右转=0，左转=1）
    const laneR = rC + ((o.lane === innerLane ? -1 : 1) * 5);
    const ix = cx + CCx + Math.cos(ang) * laneR, iy = cy + CCy + Math.sin(ang) * laneR;
    itemFn(ctx, ix, iy, o.item);
  }
  ctx.globalAlpha = 1;
  return true;
}

// 绘制 T 型转角中侧面接入带的自然连接段：让侧面带以一段圆弧平滑地汇入主带，
// 而不是用直矩形“搭”在主带之上。s 为侧面输入方向（指向相邻带一侧，即邻带朝本格）。
// 返回该侧面的内/外弧信息（laneInner 内弧所属车道号、CC/aE/d），供物品沿弧线流动复用。
function drawBeltSideMerge(ctx, e, cx, cy, dir, s, step, alpha, col) {
  const fdx = DX[dir], fdy = DY[dir];
  // 圆弧圆心 = 侧面入口边与主带出口方向相交的格角点（与纯转角同源算法），
  // 使侧面带从自身方向自然弯折、汇入主带流向，视觉上平滑衔接而非硬搭在主带上。
  const CCx = (s[0] !== 0 ? s[0] : fdx) * step;
  const CCy = (s[1] !== 0 ? s[1] : fdy) * step;
  const aE = Math.atan2(s[1] * step - CCy, s[0] * step - CCx); // 侧面入口角
  const aX = Math.atan2(fdy * step - CCy, fdx * step - CCx);   // 主带方向出口角
  let d = aX - aE;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const ccw = d < 0;
  const rIn = step - 9, rOut = step + 9, rC = step;
  // 弧形轨道带（圆环段），颜色与主带一致，自然并入而非叠加矩形。
  // clip 到本格范围：汇入圆弧只在格子内连接带子边缘，不覆盖相邻传送带/主带。
  ctx.save();
  ctx.beginPath();
  ctx.rect(cx - TILE / 2, cy - TILE / 2, TILE, TILE);
  ctx.clip();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = col.belt;
  ctx.strokeStyle = '#22252a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx + CCx, cy + CCy, rOut, aE, aX, ccw);
  ctx.arc(cx + CCx, cy + CCy, rIn, aX, aE, !ccw);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 动效箭头沿弧（与主带速度同步），随带速前进
  const off = ((G.time * beltSpeed() * (e.speedMult ? e.speedMult() : 1) * TILE / 2) % step + step) % step;
  const arcLen = rC * Math.abs(d);
  ctx.fillStyle = col.chev;
  for (let ap = off - step; ap <= arcLen + step; ap += step) {
    if (ap < 0 || ap > arcLen) continue;
    const ang = aE + d * (ap / arcLen);
    const ax = cx + CCx + Math.cos(ang) * rC, ay = cy + CCy + Math.sin(ang) * rC;
    const tAng = ccw ? Math.atan2(-Math.cos(ang), Math.sin(ang)) : Math.atan2(Math.cos(ang), -Math.sin(ang));
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(tAng);
    tri(ctx, -3, -5, -3, 5, 3, 0);
    ctx.fill();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
  ctx.restore();
  return { CCx, CCy, aE, d, ccw, rC };
}

// 传送带配色解析：普通/快速带为黄橙系，创造带为绿色系，虚空带为暗红系（测试设备）。
function beltColors(e) {
  if (e.type === 'fast-transport-belt') return { belt: '#4a2a28', chev: 'rgba(224,90,78,.9)' };
  if (e.type === 'creative-belt') return { belt: '#2e6b3a', chev: 'rgba(140,255,175,.9)' };
  if (e.type === 'void-belt') return { belt: '#3a2a28', chev: 'rgba(255,138,128,.9)' };
  return { belt: '#3a3f47', chev: 'rgba(224,178,60,.85)' };
}

function drawBelt(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  const inp = beltInputSide(e);
  const col = beltColors(e);
  // 纯 90° 转角：直接以弯曲圆弧绘制，区分于 T 型转角。
  // 梯形交汇的转角例外——直接连到直线带（走下方直行带绘制），不再单独画圆弧。
  if (!beltCornerTrapezoid(e) && drawBeltCorner(ctx, e, gx, gy, dir, alpha, col)) {
    drawBeltMark(ctx, e, gx, gy, alpha);
    return;
  }
  ctx.globalAlpha = alpha;
  ctx.fillStyle = col.belt;
  ctx.strokeStyle = '#22252a';
  ctx.lineWidth = 2;

  function strip(angle, x0, len) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    rr(ctx, x0, -9, len, 18, 4);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  const step = TILE / 2;
  const off = ((G.time * beltSpeed() * (e.speedMult ? e.speedMult() : 1) * TILE / 2) % step + step) % step;

  strip(dir * Math.PI / 2, -TILE / 2 + 2, TILE - 4);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(dir * Math.PI / 2);
  ctx.beginPath();
  ctx.rect(-TILE / 2 + 3, -TILE / 2 + 3, TILE - 6, TILE - 6);
  ctx.clip();
  ctx.fillStyle = col.chev;
  for (let k = -1; k <= 2; k++) {
    const xx = -step + k * step + off;
    tri(ctx, xx - 3, -5, xx - 3, 5, xx + 3, 0);
    ctx.fill();
  }
  ctx.restore();

  // 侧面接入带：用一段圆弧自然汇入主带（而非直矩形“搭”在主带之上），
  // 与主带同色、同轮廓，平滑衔接；同时返回每个侧面的弧线参数供物品沿弧流动。
  const bx = e.x - DX[dir], by = e.y - DY[dir];
  const backBelt = entAt(bx, by);
  const hasBackInput = backBelt instanceof Belt && backBelt.dir === dir;
  const sideArc = (inp.length === 1 && !hasBackInput) ? [drawBeltSideMerge(ctx, e, cx, cy, dir, inp[0], step, alpha, col)] : [];

  const exitX = DX[dir] * step, exitY = DY[dir] * step;
  // 双列错位：两条车道在行进方向垂直方向各偏移一半，物品沿各自车道流动
  const LANE_OFF = 7;
  const laneOffset = e.items.length ? beltLaneOffset(e, 1) : null;
  // 低 LOD：物品用色块直填，省去 clip+glyph 的昂贵路径绘制
  const itemFn = (LOD && LOD.simple) ? drawItemDotLOD : drawItemDot;
  for (const o of e.items) {
    let ix, iy;
    // 该物品所属车道的垂直偏移（lane 0 在 -perp 侧，lane 1 在 +perp 侧）
    const lo = (o.lane === 1 ? 1 : -1);
    const perpX = laneOffset ? laneOffset[0] * lo * LANE_OFF : 0;
    const perpY = laneOffset ? laneOffset[1] * lo * LANE_OFF : 0;
    // 前半段（pos<0.5）：从入口走到格心。仅“确实来自侧面”的物品走侧面接入线；
    // 直通物品（side<0，从背面同向进来，即首尾相接方向一致的直通连接）无需向中间靠拢，
    // 全程保持各自车道偏移、直接平移过去；侧面进入的物品沿接入圆弧自然弯折汇入主带。
    const fromSide = inp.length > 0 && o.side !== undefined && o.side >= 0 && o.side < inp.length;
    const a = fromSide && sideArc.length > 0 ? sideArc[o.side] : null;
    if (a) {
      // 侧面进入的物品沿接入圆弧走完整段（入口边 → 汇入主带方向 → 出口边），
      // 与弧形轨道一致，不再直楞楞地斜穿格心、也避免直矩形“搭”在主带上；
      // 内/外弧决定车道位置，平滑接续主带车道。
      const s = inp[o.side];
      const srcDir = dirIndexOf(-s[0], -s[1]);
      const turnZ = DX[srcDir] * DY[dir] - DY[srcDir] * DX[dir]; // >0 右转，<0 左转
      const rightTurn = turnZ > 0;
      const innerLane = rightTurn ? 0 : 1; // 内弧所属车道（右转=0，左转=1），与纯转角一致
      const laneR = a.rC + ((o.lane === innerLane ? -1 : 1) * 5);
      const ang = a.aE + a.d * o.pos;
      ix = cx + a.CCx + Math.cos(ang) * laneR;
      iy = cy + a.CCy + Math.sin(ang) * laneR;
    } else if (o.pos < 0.5) {
      if (fromSide) {
        const s = inp[o.side];
        const inX = cx + s[0] * step, inY = cy + s[1] * step;
        const t = o.pos / 0.5;
        ix = inX + (cx - inX) * t;
        iy = inY + (cy - inY) * t;
        // 侧面进入的物品：随车道向目标车道水平收拢
        ix += perpX * t; iy += perpY * t;
      } else {
        // 直通物品（首尾相接方向一致）：全程保持车道偏移直接平移，不向中间收拢
        const inX = cx - DX[dir] * step, inY = cy - DY[dir] * step; // 背面入口
        const t = o.pos / 0.5;
        ix = inX + (cx - inX) * t + perpX;
        iy = inY + (cy - inY) * t + perpY;
      }
    } else {
      // 后半段：从格心走到出口（直通物品共用）
      const t = (o.pos - 0.5) / 0.5;
      ix = cx + exitX * t + perpX;
      iy = cy + exitY * t + perpY;
    }
    itemFn(ctx, ix, iy, o.item);
  }
  drawBeltMark(ctx, e, gx, gy, alpha);
  ctx.globalAlpha = 1;
}

// 创造/虚空传送带叠加角标：绿色 ∞（创造带）与红色 ×（虚空带），便于辨识测试设备。
function drawBeltMark(ctx, e, gx, gy, alpha) {
  if (e.type !== 'creative-belt' && e.type !== 'void-belt') return;
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (e.type === 'creative-belt') {
    // 角标底色小圆
    ctx.fillStyle = '#1d4d29';
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, 7); ctx.fill();
    // ∞ 标志
    ctx.strokeStyle = '#d8ffe0';
    ctx.lineWidth = 2;
    const R = 3.2;
    ctx.beginPath(); ctx.ellipse(cx - 3.4, cy, R, R * 0.6, 0, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx + 3.4, cy, R, R * 0.6, 0, 0, 7); ctx.stroke();
    // 选中物品色点
    if (e.selected && ITEMS[e.selected]) {
      ctx.fillStyle = ITEMS[e.selected].color;
      ctx.beginPath(); ctx.arc(cx, cy + 6.5, 2.2, 0, 7); ctx.fill();
    }
  } else {
    // 虚空带：红色 ×
    ctx.fillStyle = '#2a1a18';
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, 7); ctx.fill();
    ctx.strokeStyle = '#ff8a80';
    ctx.lineWidth = 2.5;
    const R = 3.4;
    ctx.beginPath();
    ctx.moveTo(cx - R, cy - R); ctx.lineTo(cx + R, cy + R);
    ctx.moveTo(cx + R, cy - R); ctx.lineTo(cx - R, cy + R);
    ctx.stroke();
  }
  ctx.restore();
}

// ===== 注册 =====
function beltPanelHtml(e) {
  return '<div class="dim">传送带：双列独立输送（对齐《异星工厂》左右两列），物品沿箭头方向流动。R 旋转方向。靠近后按 F 拿取带上物品。</div>' +
    '<div class="dim">当前吞吐：<span data-live="speed">-</span>（件/秒，双车道合计）</div>' +
    (typeof circuitPanelHtml === 'function' ? circuitPanelHtml(e, 'belt') : '') +
    '<div class="status"></div>';
}
function beltPanelLive(e, api) {
  if (!e.circuitEnabled()) { api.status('已停止：电路条件不满足', 'warn'); return; }
  const mult = e.speedMult ? e.speedMult() : 1;
  // 面板显示的传送带速度为「双车道合计吞吐」（件/秒）：基础带=15 件/秒。
  // 物体驱动已按带速/2 推进（单列 7.5 件/秒），双列合计即 beltSpeed/BELT_SPACING：
  // 基础带 1.875/0.125=15 件/秒、快速带 30、极速带 45。
  const speed = (1 / BELT_SPACING) * beltSpeed() * mult;
  api.set('speed', (Math.round(speed * 10) / 10) + '');
  const agg = {};
  for (const o of e.items) agg[o.item] = (agg[o.item] || 0) + 1;
  if (e.items.length) api.status('输送中：' + Object.keys(agg).map(k => ITEMS[k].name + '×' + agg[k]).join('、'), 'ok');
  else api.status('空闲（无物品）', 'ok');
}
function beltTip(e) {
  if (e.items.length) {
    const agg = {};
    for (const o of e.items) agg[o.item] = (agg[o.item] || 0) + 1;
    return '载物 ' + Object.keys(agg).map(k => ITEMS[k].name + '×' + agg[k]).join('、') + '，按F拿取';
  }
  return '空闲';
}
ENT_CLASSES['transport-belt'] = Belt;
ENT_CLASSES['fast-transport-belt'] = Belt;
DEVICE_RENDER['transport-belt'] = drawBelt;
DEVICE_RENDER['fast-transport-belt'] = drawBelt;
DEVICE_STATUS['transport-belt'] = e => e.items.length ? 'g' : 'r';
DEVICE_STATUS['fast-transport-belt'] = e => e.items.length ? 'g' : 'r';
const beltPanel = { html: beltPanelHtml, live: beltPanelLive, tip: beltTip, onAction: (a) => (typeof circuitPanelAction === 'function' ? circuitPanelAction('belt', a) : false) };
DEVICE_PANEL['transport-belt'] = beltPanel;
DEVICE_PANEL['fast-transport-belt'] = beltPanel;
// 已铺设的传送带可用 R 键直接旋转方向（对齐《异星工厂》）
DEVICE_DIR_ROTATE['transport-belt'] = true;
DEVICE_DIR_ROTATE['fast-transport-belt'] = true;
