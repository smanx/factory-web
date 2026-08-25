'use strict';

// ===== 机械臂族：普通 / 长臂 / 过滤 / 堆叠 =====
function angNorm(a) {
  return ((a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}
function approachAng(a, t, step) {
  const d = angNorm(t - a);
  if (Math.abs(d) < 1e-9) return t;
  const m = Math.min(Math.abs(d), step);
  return a + Math.sign(d) * m;
}
class Inserter extends Entity {
  constructor(type, x, y) {
    super(type || 'inserter', x, y);
    this.reach = 1;      // 触及距离（格），长臂子类改为 2
    this.holding = null;
    this.holdingCount = 0;
    this.stackMax = 1;   // 堆叠臂改为 3
    this.rotSpeed = 1;   // 旋转速度倍率：快速臂为 2，对齐《异星工厂》Fast inserter
    this.filter = null;  // 过滤臂：只抓该物品
    // 投放/取货侧翻转位：机械臂翻转（R 旋转 / V/H 镜像）后切换，使夹取传送带的边换一边。
    // 默认 false=取近侧/放远侧；翻转后 true=取远侧/放近侧。
    this.sideFlip = false;
    this.blocked = false;
    this.armAng = undefined;
    // 电路控制（对齐《异星工厂》：机械臂接入电路网络，可按信号启停，并可把爪上物品输出到电路网络）
    this.circuitCond = { enabled: false, channel: 'red', sig: 'iron-plate', op: '>', count: 1, readHand: false };
  }
  // 电路启停：未启用条件时恒工作；启用后仅当附近电路信号满足条件才运转
  // 翻转/旋转机械臂时切换取放侧，使夹取传送带的边（lane）换一边。
  onRotate() { this.sideFlip = !this.sideFlip; }
  circuitEnabled() {
    if (!this.circuitCond || !this.circuitCond.enabled) return true;
    const sig = circuitSignalNear(this);
    return circuitCondOk(sig, this.circuitCond);
  }
  // 单次抓取容量（对齐《异星工厂》：堆叠臂随「机械臂容量」无限科技提升抓取数量）
  capacity() {
    let cap = this.stackMax || 1;
    // 机械臂容量（无限科技）：每研究一次，堆叠臂单次抓取 +1（普通臂一次仍 1 个）
    if (this.stackMax > 1 && G.techProg['inserter-capacity']) cap += G.techProg['inserter-capacity'];
    return cap;
  }
  // ===== 几何：严格单向，取格 = 箭头反方向，放格 = 箭头方向 =====
  pickOffset() {
    const d = (this.dir + 2) % 4;
    return { dx: DX[d] * this.reach, dy: DY[d] * this.reach };
  }
  dropOffset() {
    return { dx: DX[this.dir] * this.reach, dy: DY[this.dir] * this.reach };
  }
  pickAng() { const o = this.pickOffset(); return Math.atan2(o.dy, o.dx); }
  dropAng() { const o = this.dropOffset(); return Math.atan2(o.dy, o.dx); }
  entAtPick() {
    const o = this.pickOffset();
    const x = this.x + o.dx, y = this.y + o.dy;
    const e = entAt(x, y);
    return (e && !(e instanceof Inserter)) ? e : null;
  }
  entAtDrop() {
    const o = this.dropOffset();
    const x = this.x + o.dx, y = this.y + o.dy;
    const e = entAt(x, y);
    return (e && !(e instanceof Inserter)) ? e : null;
  }
  // 取物格传送带的“近侧车道”：机械臂优先从靠近自己一侧的车道取物（对齐《异星工厂》）。
  // 返回 0/1（行进方向左/右列），供 grabZone 优先抓取近侧 lane；
  // 若近侧 lane 无货则回退到任意 lane，保证远侧物品也能被取到。
  pickBeltLane(s) {
    if (!(s instanceof Belt)) return undefined;
    const bx = s.x, by = s.y;
    const dx = this.x - bx, dy = this.y - by;
    const fdx = DX[s.dir], fdy = DY[s.dir];
    const perp = [fdy, -fdx];
    const d = dx * perp[0] + dy * perp[1];
    const near = d > 0 ? 1 : 0;
    // 默认优先取近侧 lane；翻转（sideFlip）后换到远侧 lane（夹取边换一边）。
    return this.sideFlip ? (near === 1 ? 0 : 1) : near;
  }
  // 放物格传送带的“远侧车道”：机械臂把物品放到远离自己一侧的车道。
  // 传送带为双列（左右两线）时，机械臂侧放默认进入远离机械臂的那一线，
  // 避免物品都挤在机械臂所在的近侧线上。翻转（sideFlip）后换到近侧车道（投放边换一边）。
  dropBeltLane(t) {
    if (!(t instanceof Belt)) return 0;
    const bx = t.x, by = t.y;
    const dx = this.x - bx, dy = this.y - by;
    const fdx = DX[t.dir], fdy = DY[t.dir];
    const perp = [fdy, -fdx];
    const near = (dx * perp[0] + dy * perp[1]) > 0 ? 1 : 0;
    const far = near === 1 ? 0 : 1;   // 远侧车道 = 近侧车道的对侧
    return this.sideFlip ? near : far;
  }
  // ===== 取物 =====
  peekSource(s) {
    if (!s) return null;
    let it = null;
    if (s instanceof Belt) {
      // 优先抓取靠近机械臂一侧的 lane；近侧无货时回退到任意 lane（远侧仍可取到）
      let z = s.grabZone(this.filter || undefined, this.pickBeltLane(s));
      if (!z) z = s.grabZone(this.filter || undefined);
      it = z ? z.item : null;
    } else if (this.filter && s.countOf) {
      // 过滤臂：直接探测源内是否存在过滤物（而非源的首个产出）
      it = s.countOf(this.filter) > 0 ? this.filter : null;
    } else if (s.peekItem) {
      it = s.peekItem();
    }
    if (it && this.filter && it !== this.filter) return null;
    return it;
  }
  countSourceOf(s, item) {
    if (!s) return 0;
    if (s.countOf) return s.countOf(item);
    return 1;
  }
  takeNFrom(s, item, n) {
    const got = [];
    for (let i = 0; i < n; i++) {
      let it = null;
      if (s instanceof Belt) {
        // 优先抓取近侧 lane；近侧无货时回退到任意 lane，跨越左右两线凑足所需数量
        let z = s.grabZone(item, this.pickBeltLane(s));
        if (!z) z = s.grabZone(item);
        if (!z) break;
        s.items.splice(s.items.indexOf(z), 1);
        it = z.item;
      } else if (s.takeItemOf) {
        it = s.takeItemOf(item);
      } else break;
      if (it !== item) break;
      got.push(it);
    }
    return got;
  }
  takeSource(s) {
    if (s instanceof Belt) {
      // 优先抓取近侧 lane；近侧无货时回退到任意 lane
      let z = s.grabZone(undefined, this.pickBeltLane(s));
      if (!z) z = s.grabZone(undefined);
      if (!z) return null;
      s.items.splice(s.items.indexOf(z), 1);
      return z.item;
    }
    if (s.takeOutput) return s.takeOutput();
    if (s.takeItem) return s.takeItem();
    return null;
  }
  // ===== 放物 =====
  canDropAt(t, item) {
    if (!t) return false;
    if (t instanceof Belt && !(t instanceof Splitter)) {
      // 机械臂放传送带统一“只在一边放置”：投放侧由机械臂朝向（翻转）决定，
      // 侧放/尾放一致，只检查该投放车道的尾端空位（不再两条车道轮流装载）。
      const lane = this.dropBeltLane(t);
      let back = Infinity;
      for (const o of t.items) if (t.laneOf(o) === lane) back = Math.min(back, o.pos);
      return back >= BELT_SPACING * 0.9;
    }
    switch (t.type) {
      case 'stone-furnace':
      case 'steel-furnace':
        if (item === 'coal') return t.fuelCoal < 20;
        if (item === 'wood') return (t.fuelWood || 0) < 20;
        if (item === 'solid-fuel') return (t.fuelSolid || 0) < 20;
        if (item === 'rocket-fuel') return (t.fuelRocket || 0) < 20;
        return SMELTS.some(r => r.inp === item) && (t.inp[item] || 0) < 25;
      case 'electric-furnace':
        if (item === 'coal') return false;
        return SMELTS.some(r => r.inp === item) && (t.inp[item] || 0) < 25;
      case 'assembling-machine':
      case 'assembling-machine-mk2':
      case 'assembling-machine-3':
      case 'chemical-plant': {
        if (!t.recipe) return false;
        const rec = RECIPES[t.recipe];
        return !!rec.inp[item] && (t.inp[item] || 0) < 50;
      }
      case 'burner-drill':
        if (item === 'coal') return t.fuelCoal < 10;
        if (item === 'wood') return (t.fuelWood || 0) < 10;
        if (item === 'solid-fuel') return (t.fuelSolid || 0) < 10;
        if (item === 'rocket-fuel') return (t.fuelRocket || 0) < 10;
        return false;
      case 'burner-inserter':
        if (item === 'coal') return t.fuelCoal < 5;
        if (item === 'wood') return (t.fuelWood || 0) < 5;
        if (item === 'solid-fuel') return (t.fuelSolid || 0) < 5;
        if (item === 'rocket-fuel') return (t.fuelRocket || 0) < 5;
        return false;
      case 'electric-drill':
        return false;
      case 'offshore-pump':
        return false;
      case 'boiler':
        if (item === 'coal') return t.fuelCoal < 20;
        if (item === 'wood') return (t.fuelWood || 0) < 20;
        if (item === 'solid-fuel') return (t.fuelSolid || 0) < 20;
        if (item === 'rocket-fuel') return (t.fuelRocket || 0) < 20;
        return item === 'water' && t.water < WATER_CAP - 0.01;
      case 'lab':
        return isScience(item) && (t.packs[item] || 0) < 40;
      case 'underground':
        return t.items.length < UG_CAP;
      case 'pipe':
      case 'pipe-to-ground':
      case 'pump':
        return FLUIDS.indexOf(item) >= 0 && t.total() < (t.maxDist ? PIPE_CAP : PIPE_CAP);
      case 'void-pipe':
        return FLUIDS.indexOf(item) >= 0;   // 虚空管道：接受任意流体后销毁
      case 'creative-pipe':
        return false;  // 创造管道：只产不收
      case 'refinery':
        return item === 'crude-oil' && (t.inp['crude-oil'] || 0) < 50;
      case 'storage-chest':
        return t.slots.length < 12 || t.slots.some(s => s && s.item === item && s.count < stackSize(item));
      case 'steel-chest':
        return t.slots.length < 24 || t.slots.some(s => s && s.item === item && s.count < stackSize(item));
      case 'void-chest':
        return true;   // 虚空箱：来者不拒，全部销毁
      case 'creative-chest':
        return false;  // 创造箱：只产不收
      case 'gun-turret':
        return (item === 'magazine' || item === 'piercing-rounds') && t.ammoCount(item) < 40;
      default:
        return false;
    }
  }
  deliverAt(t) {
    if (!t || !this.holding) return false;
    if (t instanceof Belt && !(t instanceof Splitter)) {
      const o = this.dropOffset();
      const fromDir = dirFromVec(o.dx, o.dy);
      // 机械臂放传送带统一“只在一边放置”：投放侧由机械臂朝向（翻转）决定，
      // 侧放/尾放一致，固定进入该投放车道（laneHint 覆盖 acceptItem 默认），不再轮流。
      const lane = this.dropBeltLane(t);
      return t.acceptItem(this.holding, fromDir, undefined, undefined, lane);
    }
    return t.giveItem(this.holding);
  }
  // 干跑：现在是否有活干（供 UI/其他系统查询）
  hasWork() {
    const s = this.entAtPick();
    const it = this.peekSource(s);
    return !!(it && this.canDropAt(this.entAtDrop(), it));
  }
  update(dt) {
    // 电路条件不满足时机械臂停转（保持当前姿态，不取放）
    if (!this.circuitEnabled()) { this.rotating = false; return; }
    if (this.armAng === undefined) this.armAng = this.pickAng();
    const step = Math.PI * 4.4 * (this.rotSpeed || 1) * dt;
    // 统一状态机：
    //  空手 -> 转向取物格 -> 到达后原子地“预览+校验+取走（可堆叠抓 N 个）”
    //  持物 -> 转向放物格 -> 到达后循环放入直到放空或目标拒收
    const holdingNow = this.holdingCount > 0;
    const target = holdingNow ? this.dropAng() : this.pickAng();
    const arrived = Math.abs(angNorm(target - this.armAng)) < 0.05;
    if (!arrived) {
      this.rotating = true;
      this.armAng = approachAng(this.armAng, target, step);
      if (Math.abs(angNorm(target - this.armAng)) < 0.05) this.armAng = target;
      else return;
    }
    this.rotating = false;
    this.armAng = target;
    if (!holdingNow) {
      // 惰性调度（P0 优化）：空手待机在取物位时，降频探测取/放（约 5 次/秒）。
      // 避免大量闲置机械臂每帧都做 entAt+peekSource+canDropAt 的邻居探测；
      // 有货/持物/旋转时仍每帧更新，不影响搬运响应。
      this._probeT = (this._probeT || 0) - dt;
      if (this._probeT > 0) return;
      this._probeT = 0.15;
      // 到达取物位：一次性完成“看源、验目标、取走”，避免探测与执行之间的状态漂移
      const s = this.entAtPick();
      const it = this.peekSource(s);
      this.blocked = false;
      if (!it) return;                       // 源为空：停在取物位等待
      if (!this.canDropAt(this.entAtDrop(), it)) return; // 目标暂不收：等待
      const want = Math.max(1, Math.min(this.capacity(), this.countSourceOf(s, it)));
      const got = this.takeNFrom(s, it, want);
      if (!got.length) return;
      this.holding = it;
      this.holdingCount = got.length;
      if (typeof playSfx === 'function') playSfx('inserter');
    } else {
      // 到达放物位：循环放入；失败保持持物、标记堵塞，下帧继续重试
      const t = this.entAtDrop();
      while (this.holdingCount > 0 && this.deliverAt(t)) this.holdingCount--;
      this.blocked = this.holdingCount > 0;
      if (this.holdingCount <= 0) this.holding = null;
    }
  }
  contents() {
    const list = [[this.type, 1]];
    if (this.holding) list.push([this.holding, 1]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.holding = this.holding;
    s.holdingCount = this.holdingCount || 1;
    if (this.filter) s.filter = this.filter;
    if (this.circuitCond) s.circuitCond = this.circuitCond;
    if (this.sideFlip) s.sideFlip = true;
    return s;
  }
  // 蓝图只保留过滤器与电路配置，不复制爪上抓取的物品
  blueprint() {
    const s = super.blueprint();
    if (this.filter) s.filter = this.filter;
    if (this.circuitCond) s.circuitCond = this.circuitCond;
    if (this.sideFlip) s.sideFlip = true;
    return s;
  }
  static restore(s) {
    const i = super.restore(s);
    i.holding = s.holding || null;
    i.holdingCount = s.holding ? (s.holdingCount || 1) : 0;
    i.filter = s.filter || null;
    i.circuitCond = s.circuitCond || { enabled: false, channel: 'red', sig: 'iron-plate', op: '>', count: 1 };
    i.sideFlip = !!s.sideFlip;
    return i;
  }
}

class LongInserter extends Inserter {
  constructor(type, x, y) {
    super(type || 'long-inserter', x, y);
    this.reach = 2;   // 几何、行为与普通臂完全一致，只是触及第二格
  }
}

// 高速机械臂：旋转速度约为普通臂的 2 倍（对齐《异星工厂》Fast inserter），抓取效率更高
class FastInserter extends Inserter {
  constructor(type, x, y) {
    super(type || 'fast-inserter', x, y);
    this.rotSpeed = 2;
  }
}

class StackInserter extends Inserter {
  constructor(type, x, y) {
    super(type || 'stack-inserter', x, y);
    this.stackMax = 3;   // 一次最多抓取 3 个同种物品
  }
}

// ===== 渲染 =====
// 臂体配色：不同机械臂类型各有固定主色，箭头等物流标记与臂体颜色保持一致
function inserterArmColor(e) {
  return e.type === 'burner-inserter' ? '#7a7f87'
    : e.type === 'fast-inserter' ? '#4f9fe8'
    : e.type === 'long-inserter' ? '#e05a4e'
    : e.type === 'stack-inserter' ? '#7ec850'
    : '#e0b23c';
}
function drawInserter(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#3c4048';
  ctx.beginPath(); ctx.arc(cx, cy, 9, 0, 7); ctx.fill();
  ctx.strokeStyle = '#22252a';
  ctx.lineWidth = 2;
  ctx.stroke();
  const long = e.type === 'long-inserter';
  if (e.filter) {
    ctx.strokeStyle = '#58b8e8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, 7);
    ctx.stroke();
  }
  const len = e.holding ? (long ? TILE * 2.02 : TILE * 1.06) : (long ? TILE * 1.55 : TILE * 0.82);
  const ang = e.armAng !== undefined ? e.armAng : ((dir + 2) % 4) * Math.PI / 2;
  const tipx = cx + Math.cos(ang) * len;
  const tipy = cy + Math.sin(ang) * len;
  ctx.strokeStyle = inserterArmColor(e);
  ctx.lineWidth = long ? 5 : 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(tipx, tipy);
  ctx.stroke();
  ctx.lineCap = 'butt';
  if (e.holding) drawItemDot(ctx, tipx, tipy, e.holding, 4);
  if (e.holding && (e.holdingCount || 1) > 1) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('×' + e.holdingCount, tipx, tipy - 9);
  }
  ctx.fillStyle = inserterArmColor(e);
  notch(ctx, px, py, dir);
  drawFlowMarks(ctx, e, cx, cy, dir);
  drawDropLane(ctx, e);
  ctx.globalAlpha = 1;
}

// 放物车道指示：在目标传送带上高亮显示机械臂会把物品放入哪一侧车道（投放侧）。
// 横向/竖向传送带都按“投放侧”规则放置，侧放/尾放一致，翻转（旋转）机械臂即可把物品转到另一侧；
// 这里用与臂体同色的脉冲三角标出投放侧，让“放到哪一边”一目了然。
function drawDropLane(ctx, e) {
  if (!e.entAtDrop) return;
  const t = e.entAtDrop();
  if (!(t instanceof Belt) || t instanceof Splitter) return;
  // 机械臂放传送带统一只在一边放置：投放侧由机械臂朝向决定（不再交替/轮流）
  const lane = e.dropBeltLane(t);
  // lane 1 位于行进方向右侧(+perp)，lane 0 位于左侧(-perp)
  const perp = [DY[t.dir], -DX[t.dir]];
  const k = lane === 1 ? 1 : -1;
  const ox = perp[0] * k, oy = perp[1] * k;
  const cx = t.x * TILE + TILE / 2, cy = t.y * TILE + TILE / 2;
  const col = inserterArmColor(e);
  const pulse = 0.5 + 0.5 * Math.sin((G.time || 0) * 6);
  ctx.save();
  ctx.globalAlpha = Math.max(0.45, pulse);
  ctx.fillStyle = col;
  // 三角：顶点朝带中心，底边在投放车道上，标记“物品会投放到这一侧”
  const off = 7, h = 6, base = 9;
  const tx = cx + ox * off, ty = cy + oy * off;
  const tipX = cx + ox * (off + h), tipY = cy + oy * (off + h);
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tx - oy * base, ty + ox * base);
  ctx.lineTo(tx + oy * base, ty - ox * base);
  ctx.closePath();
  ctx.fill();
  // 车道侧再补一条短线段，强化方位感
  ctx.strokeStyle = col;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(tx - oy * (base - 2), ty + ox * (base - 2));
  ctx.lineTo(tx + oy * (base - 2), ty - ox * (base - 2));
  ctx.stroke();
  ctx.restore();
}

// 物流方向标识：亮色脉冲大箭头 = 出料侧（与陷口同侧）；灰色小点 = 进料侧。
// 让“哪边进、哪边出”一眼可辨，不再依赖小陷口或臂体姿态去猜。
function drawFlowMarks(ctx, e, cx, cy, dir) {
  const reach = e.reach || 1;
  const dOut = (reach - 0.5) * TILE - 3;   // 标记到臂心的距离（触及格边缘内侧）
  const pulse = 0.55 + 0.45 * Math.sin((G.time || 0) * 6);
  function chevron(sideDir, color, alpha, size) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(sideDir * Math.PI / 2);
    ctx.globalAlpha = Math.max(0.15, Math.min(1, alpha));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(dOut - size, -size);
    ctx.lineTo(dOut + size * 0.7, 0);
    ctx.lineTo(dOut - size, size);
    ctx.stroke();
    ctx.restore();
  }
  // 出口：物流方向，双箭头向外（颜色与臂体一致，不随旋转方向改变）
  const oc = inserterArmColor(e);
  chevron(dir, oc, pulse, 5);
  chevron(dir, oc, pulse * 0.45, 8.5);
  // 入口：取货方向，静态灰点
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(((dir + 2) % 4) * Math.PI / 2);
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#9aa0aa';
  ctx.beginPath();
  ctx.arc(dOut, 0, 2.6, 0, 7);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
// 筛选功能：每台机械臂均自带（对齐需求「每个机械臂都自带筛选功能」）。
// 在面板选择过滤物后，机械臂只抓取该物品，其余一律不碰；清除后恢复抓取任意物品。
function inserterFilterSectionHtml(e, lead) {
  let h = lead + (e.filter ? chip(e.filter) : '<span class="dim">未设置</span>') + '</div>';
  h += '<div class="sec">筛选：只抓取该物品</div>';
  if (e.filter) h += '<div class="mrow"><span class="mval"><button data-action="flt-clear">清除筛选（恢复抓取任意物品）</button></span></div>';
  h += '<input id="flt-search" class="inv-search" type="text" placeholder="搜索物品（输入名称）" autocomplete="off">';
  h += '<div id="flt-empty" class="dim" style="display:none"></div>';
  h += '<div class="recgrid">';
  for (const id of (typeof filterChoices === 'function' ? filterChoices() : FILTER_CHOICES)) {
    const name = ITEMS[id]?.name || id;
    h += '<button class="rcbtn ' + (e.filter === id ? 'sel' : '') + '" data-action="flt" data-id="' + id + '" data-itemid="' + id + '" data-search="' + (name + ' ' + id).toLowerCase() + '">' +
      '<img src="' + iconDataURL(id) + '">' + name + '</button>';
  }
  h += '</div>';
  return h;
}
function inserterPanelHtml(e) {
  return '<div class="dim">电力机械臂：严格单向搬运。从臂体指向的一侧（灰色圆点）取货，放到地面箭头/亮色箭头的一侧（物流方向）。放到传送带时只在一边放置（目标带上会有一个同色脉冲三角标出投放侧），翻转（R 旋转）机械臂即可把物品转到另一侧车道，横/竖传送带行为一致；侧放/尾放都固定投放一侧，不再两条车道轮流装。双列传送带上优先抓取靠近自己一侧的车道，近侧无货时再取远侧。普通臂作用相邻格，加长臂作用第二格。R 旋转。</div>' +
    inserterFilterSectionHtml(e, '<div class="dim">当前筛选：') +
    circuitPanelHtml(e, 'ins') + '<div class="status"></div>';
}
function stackInserterPanelHtml(e) {
  return '<div class="dim">集装箱机械臂：一次最多抓取 3 个同种物品再放下，装卸效率约为普通臂的 3 倍。R 旋转。</div>' +
    inserterFilterSectionHtml(e, '<div class="dim">当前筛选：') +
    circuitPanelHtml(e, 'ins') + '<div class="status"></div>';
}
function inserterFilterOnAction(act, btn) {
  if (act === 'flt') {
    if (G.panelEnt instanceof Inserter) G.panelEnt.filter = btn.dataset.id;
    return true;
  }
  if (act === 'flt-clear') {
    if (G.panelEnt instanceof Inserter) G.panelEnt.filter = null;
    return true;
  }
  return circuitPanelAction('ins', act);
}
// 悬浮提示（普通/长臂/过滤/堆叠共用）
function inserterTip(e) {
  return e.holding ? ('搬运 ' + ITEMS[e.holding].name + '，8格取放') : '待机：周围8格取放（优先近侧车道、取背面放正面）';
}
// 面板实时状态：工作中或暂停原因
function inserterPanelLive(e, api) {
  if (!e.circuitEnabled()) { api.status('已停止：电路条件不满足', 'warn'); return; }
  if (e.holding) {
    if (e.blocked) api.status('已暂停：放货格已满，卡住 ' + ITEMS[e.holding].name, 'warn');
    else api.status('搬运中：' + ITEMS[e.holding].name, 'ok');
    return;
  }
  if (e.rotating) { api.status('工作中：转向取货格', 'ok'); return; }
  const s = e.entAtPick();
  const it = e.peekSource(s);
  if (!it) {
    if (e.filter) api.status('已暂停：取货格没有「' + ITEMS[e.filter].name + '」', 'warn');
    else api.status('已暂停：取货格无物品可取', 'warn');
    return;
  }
  if (!e.canDropAt(e.entAtDrop(), it)) api.status('已暂停：放货格已满', 'warn');
  else api.status('待机：等待取货格出现货物', 'ok');
}

// ===== 电路控制面板（机械臂/传送带通用） =====
// 复用电路网络 UI：启用条件后，仅当附近电路信号满足条件时设备才运转。
// prefix 用于生成唯一控件 id，避免同屏多面板冲突（机械臂 ins / 传送带 belt）。
function circuitPanelHtml(e, prefix) {
  const c = e.circuitCond || {};
  prefix = prefix || 'cb';
  let h = '<div class="sec">电路控制</div>';
  h += '<div class="circ-add">' +
    '<select id="' + prefix + '-en" class="circ-btype">' +
      '<option value="off"' + (!c.enabled ? ' selected' : '') + '>关闭（常开）</option>' +
      '<option value="on"' + (c.enabled ? ' selected' : '') + '>启用条件</option>' +
    '</select>' +
    '<select id="' + prefix + '-ch" class="circ-op">' + (typeof channelSelect === 'function' ? channelSelect(c.channel) : '') + '</select>' +
    '<input type="text" id="' + prefix + '-sig" class="circ-siginv" value="' + (typeof signalDisplayName === 'function' ? signalDisplayName(c.sig) : (ITEMS[c.sig]?.name || c.sig || '')) + '" placeholder="信号" autocomplete="off">' +
    '<select id="' + prefix + '-op" class="circ-op">' + ['>', '<', '=', '!=', '>=', '<='].map(o => '<option value="' + o + '"' + (c.op === o ? ' selected' : '') + '>' + o + '</option>').join('') + '</select>' +
    '<input type="number" id="' + prefix + '-cnt" class="circ-cnt" value="' + (c.count || 0) + '" min="-99999" max="99999">' +
    '<button data-action="cb-cond">应用</button></div>' +
    '<label class="circ-readhand"><input type="checkbox" id="' + prefix + '-rh"' + (c.readHand ? ' checked' : '') + '> 读取手持物品（把机械臂爪上物品数量作为信号输出到电路网络）</label>' +
    (prefix === 'belt' ? '<label class="circ-readhand"><input type="checkbox" id="' + prefix + '-rc"' + (c.circuitRead ? ' checked' : '') + '> 读取内容（把传送带上携带的每种物品数量作为信号输出到电路网络，对齐《异星工厂》Belt Read contents）</label>' : '');
  h += '<div class="dim">启用后，仅当所选电路信号满足条件时设备才工作（如铁板信号 ≥ 100 才运转）。</div>';
  return h;
}
function circuitPanelAction(prefix, act) {
  if (act !== 'cb-cond') return false;
  const e = G.panelEnt;
  if (!e) return false;
  if (!e.circuitCond) e.circuitCond = { enabled: false, channel: 'red', sig: 'iron-plate', op: '>', count: 1 };
  const c = e.circuitCond;
  c.enabled = document.getElementById(prefix + '-en').value === 'on';
  c.channel = document.getElementById(prefix + '-ch').value;
  c.sig = (typeof resolveSignalName === 'function' ? resolveSignalName(document.getElementById(prefix + '-sig').value) : document.getElementById(prefix + '-sig').value) || c.sig;
  c.op = document.getElementById(prefix + '-op').value;
  c.count = Math.floor(Number(document.getElementById(prefix + '-cnt').value)) || 0;
  const rh = document.getElementById(prefix + '-rh');
  c.readHand = !!(rh && rh.checked);
  const rc = document.getElementById(prefix + '-rc');
  if (rc) c.circuitRead = !!(rc && rc.checked);
  uiDirty = true;
  return true;
}

// ===== 注册 =====
function inserterStatusFn(e) {
  if (e.circuitCond && e.circuitCond.enabled && !e.circuitEnabled()) return 'r';
  return e.holding ? (e.blocked ? 'y' : 'g') : (e.rotating ? 'g' : 'r');
}
const inserterPanel = { html: inserterPanelHtml, live: inserterPanelLive, tip: inserterTip, onAction: inserterFilterOnAction };
const stackInserterPanel = { html: stackInserterPanelHtml, live: inserterPanelLive, tip: inserterTip, onAction: inserterFilterOnAction };
ENT_CLASSES['inserter'] = Inserter;
ENT_CLASSES['long-inserter'] = LongInserter;
ENT_CLASSES['stack-inserter'] = StackInserter;
ENT_CLASSES['fast-inserter'] = FastInserter;
DEVICE_RENDER['inserter'] = drawInserter;
DEVICE_RENDER['long-inserter'] = drawInserter;
DEVICE_RENDER['stack-inserter'] = drawInserter;
DEVICE_RENDER['fast-inserter'] = drawInserter;
DEVICE_STATUS['inserter'] = inserterStatusFn;
DEVICE_STATUS['long-inserter'] = inserterStatusFn;
DEVICE_STATUS['stack-inserter'] = inserterStatusFn;
DEVICE_STATUS['fast-inserter'] = inserterStatusFn;
DEVICE_PANEL['inserter'] = inserterPanel;
DEVICE_PANEL['long-inserter'] = inserterPanel;
DEVICE_PANEL['stack-inserter'] = stackInserterPanel;
DEVICE_PANEL['fast-inserter'] = inserterPanel;
DEVICE_DIR_ROTATE['inserter'] = true;
DEVICE_DIR_ROTATE['long-inserter'] = true;
DEVICE_DIR_ROTATE['stack-inserter'] = true;
DEVICE_DIR_ROTATE['fast-inserter'] = true;
