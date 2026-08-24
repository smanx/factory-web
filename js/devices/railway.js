'use strict';

// ===== 铁路系统（火车，对齐《异星工厂》Railway）=====
// 铁轨 Rail：1×1 非实体占用，铺设成网。与相邻铁轨自动连通，可直行/转弯。
// 火车头 Locomotive：烧煤驱动，在铁轨上移动；可挂接货运车厢组成列车。
// 货运车厢 CargoWagon：跟随车头移动，存 10 格×100，车站可用机械臂装卸。
// 车站 TrainStop：放在铁轨上，列车经过即短暂停车（装卸窗口）。
// 铁路信号灯 RailSignal：放在铁轨旁，指示前方是否被其他列车占用，防追尾。
//
// 模型：火车不依赖网格实体的 entAt 检测轨道，而是通过独立的轨道集合
// G.railTiles（坐标 Set）查询连接。火车实体（车头/车厢）以 solid 实体
// addEnt 到网格，移动时 removeEnt/addEnt 跨格；铁轨实体在 G.ents 中独立
// 保留用于渲染，即使被火车覆盖也不影响 railTiles 连接判定。

// ===== 常量 =====
const TRAIN_SPEED = 0.35;      // 列车每格移动耗时（秒），慢于传送带但运量大（蒸汽车头）
const DIESEL_SPEED = 0.24;     // 内燃机车每格移动耗时（秒），约为蒸汽车头的 1.45 倍速（对齐《异星工厂》Diesel locomotive 更快）
// 按车头类型返回每格移动耗时：内燃机车更快，其余为蒸汽车头标准速度。
function trainMoveTime(head) {
  return (head && head.type === 'diesel-locomotive') ? DIESEL_SPEED : TRAIN_SPEED;
}
const LOCO_FUEL = 400;         // 单格煤提供的燃料量（一格跑多格）
const LOCO_SOLID_FUEL = 1600;  // 单格固体燃料提供的燃料量（约为煤的 4 倍）
const LOCO_ROCKET_FUEL = 16000; // 单格火箭燃料提供的燃料量（约为固体燃料的 10 倍，对齐《异星工厂》Rocket fuel）
const LOCO_WOOD_FUEL = 100;    // 单格木材提供的燃料量（低效燃料，约为煤的 1/4，对齐《异星工厂》木可烧）
const LOCO_MAX_FUEL = 4000;    // 车头燃料能量池上限
const LOCO_MAX_UNITS = 10;     // 车头燃料槽可存燃料个数（煤/固体燃料合计）
const LOCO_COAL_PER = 1;       // 每格耗煤 1 单位
const WAGON_SLOTS = 10;        // 车厢槽位数
const WAGON_STACK = 100;       // 每槽容量
const TRAIN_STOP_WAIT = 1.6;   // 车站停车时长（秒）
const SIGNAL_RANGE = 10;       // 信号灯检测前方列车距离（格）
// 链式信号灯：连锁转发，检测前方区段整段是否畅通（距离更长），
// 防止列车在复杂交叉口内停车堵塞。对齐《异星工厂》Rail chain signal。
const CHAIN_SIGNAL_RANGE = 20; // 链式信号灯向前额外延伸检测距离（格）

// ===== 铁轨集合 =====
// 由铁轨实体 addEnt/removeEnt 时同步维护。惰性初始化（G 在 main.js 中定义，加载时不可访问）。
function ensureRailGlobals() {
  if (!G.railTiles) G.railTiles = new Set();
  if (!G.trains) G.trains = [];
}
function railConnAt(tx, ty) {
  ensureRailGlobals();
  return {
    E: G.railTiles.has((tx + 1) + ',' + ty),
    S: G.railTiles.has(tx + ',' + (ty + 1)),
    W: G.railTiles.has((tx - 1) + ',' + ty),
    N: G.railTiles.has(tx + ',' + (ty - 1))
  };
}
function railHas(tx, ty) { ensureRailGlobals(); return G.railTiles.has(tx + ',' + ty); }

// ===== 列车列表 =====
// G.trains: 数组，每项 { id, cars: [car...], active, stopT }
// car: Locomotive 或 CargoWagon 实体（car.head=true 表示车头）。

// 列车更新入口（main.js loop 中调用）
function updateTrains(dt) {
  // 性能：早期无任何列车时直接短路返回，避免每帧惰性初始化检查与空数组遍历
  // （ensureRailGlobals 的 if 判断仅在存在列车/铁轨时才需要触发）
  if (!G.trains || !G.trains.length) return;
  ensureRailGlobals();
  for (const tr of G.trains) {
    if (tr.cars.length === 0) continue;
    const head = tr.cars[0];
    // 炮兵车厢：列车行驶/停靠期间自动轰击远处敌人
    if (typeof updateTrainArtillery === 'function' && G.settings.combat) updateTrainArtillery(tr, dt);
    // 车头烧煤移动：能量池耗尽时从燃料槽补一单位（优先固体燃料）
    head.refuel();
    const coal = (head.fuel || 0);
    if (coal <= 0) { tr.wasStopped = true; continue; }   // 没燃料则停车

    // ===== 自动调度路线：列车按路线循环前往各站装卸 =====
    if (trainHasSchedule(tr)) {
      if (updateScheduledTrain(tr, dt)) continue;
    }

    // 车站停车：车头所在格是车站时停车等待 + 自动装卸货
    const station = trainStopAt(head.x, head.y);
    if (station) {
      // 停靠期间持续执行自动装卸；有装卸动作则延长停靠窗口，直至装/卸完成
      const acted = trainAutoLoadUnload(tr, station);
      if (acted) tr.stopT = TRAIN_STOP_WAIT;
      else if (!tr.stopT) tr.stopT = TRAIN_STOP_WAIT;
      tr.stopT -= dt;
      tr.wasStopped = true;
      continue;
    }
    if (tr.stopT > 0) {
      tr.stopT -= dt;
      tr.wasStopped = true;
      continue;
    }
    // 信号灯防追尾：前方有其它列车则停车
    if (railSignalBlocked(head)) {
      tr.wasStopped = true;
      continue;
    }

    // 从停靠/等待状态恢复行驶时鸣笛（对齐《异星工厂》：列车启动鸣笛）
    if ((tr.stopT > 0 || tr.wasStopped) && typeof playSfx === 'function') playSfx('train');
    tr.wasStopped = false;

    tr.moveT = (tr.moveT || 0) + dt;
    if (tr.moveT >= trainMoveTime(head)) {
      tr.moveT -= trainMoveTime(head);
      moveTrain(tr);
    }
  }
}

// 调度模式下驱动列车：朝当前目标站点行驶，到站装卸后前往下一站。
// 返回 true 表示本次已由调度逻辑处理（占用当前帧）。
function updateScheduledTrain(tr, dt) {
  const head = tr.cars[0];
  if (!head || !(head instanceof Locomotive)) return false;
  const target = scheduleTargetStop(tr);
  // 目标站不存在（被拆/改名）：直接回退为普通行驶
  if (!target) return false;
  // 到达目标站所在格：停靠装卸，完成停留后前往下一站
  if (head.x === target.x && head.y === target.y) {
    const acted = trainAutoLoadUnload(tr, target);
    if (acted) tr.waitT = TRAIN_STOP_WAIT;
    else if (!tr.waitT) tr.waitT = TRAIN_STOP_WAIT;
    tr.waitT -= dt;
    tr.stopT = Math.max(tr.stopT || 0, tr.waitT);
    tr.wasStopped = true;
    // 停留结束：前往路线下一站（循环）
    if (tr.waitT <= 0) {
      tr.routeIdx = (tr.routeIdx + 1) % tr.route.length;
      tr.waitT = 0;
      if (typeof playSfx === 'function') playSfx('train');
    }
    return true;
  }
  // 等待窗口（到站装卸刚结束）
  if (tr.waitT > 0) {
    tr.waitT -= dt;
    tr.wasStopped = true;
    return true;
  }
  // 信号灯防追尾
  if (railSignalBlocked(head)) { tr.wasStopped = true; return true; }
  // 朝目标站行驶
  if (tr.wasStopped && typeof playSfx === 'function') playSfx('train');
  tr.wasStopped = false;
  tr.moveT = (tr.moveT || 0) + dt;
  if (tr.moveT >= trainMoveTime(head)) {
    tr.moveT -= trainMoveTime(head);
    moveTrainToward(tr, target.x, target.y);
  }
  return true;
}

// 朝目标格行驶（自动调度用）：直行优先，岔路口优先选择使车头更接近目标的方向。
// 复用 moveTrain 的车厢跟随逻辑，但转向优先级不同。
function moveTrainToward(tr, tx, ty) {
  const head = tr.cars[0];
  if (!head) return;
  const oldPos = tr.cars.map(c => ({ x: c.x, y: c.y, dir: c.dir }));
  const dir = head.dir;
  let nd = null;
  // 候选方向：直行 + 左右转 + 掉头，按“接近目标”程度排序
  const cand = [dir, (dir + 1) % 4, (dir + 3) % 4, (dir + 2) % 4];
  const dist = d => Math.abs(head.x + DX[d] - tx) + Math.abs(head.y + DY[d] - ty);
  cand.sort((a, b) => dist(a) - dist(b));
  for (const d of cand) {
    const dx = DX[d], dy = DY[d];
    if (railHas(head.x + dx, head.y + dy) && !trainOccupy(head.x + dx, head.y + dy, head)) { nd = d; break; }
  }
  if (nd === null) return;
  head.x += DX[nd]; head.y += DY[nd]; head.dir = nd;
  removeEntFromGrid(head); addEntToGrid(head);
  head.fuel -= LOCO_COAL_PER;
  for (let i = 1; i < tr.cars.length; i++) {
    const car = tr.cars[i];
    removeEntFromGrid(car);
    car.x = oldPos[i - 1].x; car.y = oldPos[i - 1].y;
    addEntToGrid(car);
  }
}

// 车头尝试沿 dir 前进一格（直行优先，转弯次之，均不可则掉头）
function moveTrain(tr) {
  const head = tr.cars[0];
  if (!head) return;
  // 记录每节车旧位置，车厢依次继承前一节
  const oldPos = tr.cars.map(c => ({ x: c.x, y: c.y, dir: c.dir }));
  const dir = head.dir;
  const fwd = [DX[dir], DY[dir]];
  let nd = null;
  // 直行
  if (railHas(head.x + fwd[0], head.y + fwd[1]) && !trainOccupy(head.x + fwd[0], head.y + fwd[1], head)) {
    nd = dir;
  } else {
    // 转弯：优先右转，其次左转
    for (const d of [(dir + 1) % 4, (dir + 3) % 4]) {
      const dx = DX[d], dy = DY[d];
      if (railHas(head.x + dx, head.y + dy) && !trainOccupy(head.x + dx, head.y + dy, head)) { nd = d; break; }
    }
  }
  // 前方与左右都不通：尝试掉头（反向也是铁轨时）；否则停车不动
  if (nd === null) {
    const rd = (dir + 2) % 4;
    if (railHas(head.x + DX[rd], head.y + DY[rd]) && !trainOccupy(head.x + DX[rd], head.y + DY[rd], head)) nd = rd;
  }
  if (nd === null) return;
  // 移动车头到下一格
  head.x += DX[nd]; head.y += DY[nd]; head.dir = nd;
  removeEntFromGrid(head); addEntToGrid(head);
  head.fuel -= LOCO_COAL_PER;
  // 车厢依次占据前一节车的旧位置
  for (let i = 1; i < tr.cars.length; i++) {
    const car = tr.cars[i];
    removeEntFromGrid(car);
    car.x = oldPos[i - 1].x; car.y = oldPos[i - 1].y;
    addEntToGrid(car);
  }
}

// 目标格是否被除 head 自身列车外的其它列车占用（防重叠）
function trainOccupy(tx, ty, head) {
  let own = null;
  for (const tr of G.trains) if (tr.cars.indexOf(head) >= 0) { own = tr; break; }
  for (const tr of G.trains) {
    if (tr === own) continue;
    for (const c of tr.cars) {
      if (c.x === tx && c.y === ty) return true;
    }
  }
  return false;
}

// 前方信号灯是否拦截：前方 SIGNAL_RANGE 格内存在其它列车的车厢则停车
// 仅检查“其它列车”，忽略同一列车自己的车厢，避免自我拦截。
function railSignalBlocked(head) {
  // 找到 head 所在列车
  let own = null;
  for (const tr of G.trains) if (tr.cars.indexOf(head) >= 0) { own = tr; break; }
  // 车头前方是否紧邻链式信号灯（链式信号灯强制更大的跟车距离）
  const chainAhead = chainSignalNearAhead(head);
  const range = chainAhead ? CHAIN_SIGNAL_RANGE : SIGNAL_RANGE;
  for (const tr of G.trains) {
    if (tr === own) continue;
    for (const c of tr.cars) {
      const dist = Math.abs(c.x - head.x) + Math.abs(c.y - head.y);
      if (dist > 0 && dist <= range) return true;
    }
  }
  return false;
}

// 车头朝向正前方一小段距离内是否存在链式信号灯（用于扩大跟车距离）。
function chainSignalNearAhead(head) {
  const cx = head.x, cy = head.y;
  const dir = head.dir != null ? head.dir : 0;
  const dx = DX[dir], dy = DY[dir];
  // 检查车头前方 1~4 格内是否有链式信号灯实体
  for (let i = 1; i <= 4; i++) {
    const e = entAt(cx + dx * i, cy + dy * i);
    if (e && e.type === 'rail-chain-signal') return true;
  }
  return false;
}

// 网格操作：火车实体在铁轨上移动，removeEnt/addEnt 更新 grid 与 buckets
function removeEntFromGrid(e) {
  if (e._dead) return;
  e._dead = true;
  _tombCount++;
  if (_tombCount >= 128) _compactEnts();
  const b = bucketKey(e.x, e.y);
  const bs = G.buckets.get(b);
  if (bs) { bs.delete(e); if (!bs.size) G.buckets.delete(b); }
  for (let dy = 0; dy < e.h; dy++)
    for (let dx = 0; dx < e.w; dx++) {
      const k = entKey(e.x + dx, e.y + dy);
      if (G.grid.get(k) === e) G.grid.delete(k);
    }
}
function addEntToGrid(e) {
  if (e._dead) e._dead = false;
  ensureBucket(bucketKey(e.x, e.y)).add(e);
  for (let dy = 0; dy < e.h; dy++)
    for (let dx = 0; dx < e.w; dx++)
      G.grid.set(entKey(e.x + dx, e.y + dy), e);
}

// ===== 铁轨 Rail =====
class Rail extends Entity {
  constructor(type, x, y) { super(type, x, y); }
  giveItem(item) { return false; }
  contents() { return [[this.type, 1]]; }
}
// 铁轨放置后/拆除时维护 railTiles
function registerRail(x, y) { G.railTiles.add(x + ',' + y); }
function unregisterRail(x, y) { G.railTiles.delete(x + ',' + y); }

// ===== 车头 Locomotive =====
class Locomotive extends Entity {
  constructor(type, x, y) {
    super(type, x, y);
    this.fuel = 0;       // 能量池（用于烧起来）；由煤/固体燃料填充
    this.fuelCoal = 0;   // 存煤个数
    this.fuelSolid = 0;  // 存固体燃料个数
    this.fuelRocket = 0; // 存火箭燃料个数（最高级燃料，优先烧）
    this.fuelWood = 0;   // 存木材个数（低效燃料，对齐《异星工厂》：车头可用木材烧）
    this.schedule = [];  // 自动调度路线：车站名数组（列车按此顺序循环行驶装卸）
  }
  giveItem(item) {
    if (item === 'rocket-fuel' && this._fuelCount() < LOCO_MAX_UNITS) { this.fuelRocket++; return true; }
    if (item === 'coal' && this._fuelCount() < LOCO_MAX_UNITS) { this.fuelCoal++; return true; }
    if (item === 'solid-fuel' && this._fuelCount() < LOCO_MAX_UNITS) { this.fuelSolid++; return true; }
    if (item === 'wood' && this._fuelCount() < LOCO_MAX_UNITS) { this.fuelWood++; return true; }
    return false;
  }
  _fuelCount() { return (this.fuelCoal || 0) + (this.fuelSolid || 0) + (this.fuelRocket || 0) + (this.fuelWood || 0); }
  // 能量池不足时从燃料槽取一单位填充（优先火箭燃料，其次固体燃料/煤，最后木材）
  refuel() {
    if (this.fuel >= LOCO_FUEL) return;
    if (this.fuelRocket > 0) { this.fuelRocket--; this.fuel = Math.min(LOCO_MAX_FUEL, this.fuel + LOCO_ROCKET_FUEL); }
    else if (this.fuelSolid > 0) { this.fuelSolid--; this.fuel = Math.min(LOCO_MAX_FUEL, this.fuel + LOCO_SOLID_FUEL); }
    else if (this.fuelCoal > 0) { this.fuelCoal--; this.fuel = Math.min(LOCO_MAX_FUEL, this.fuel + LOCO_FUEL); }
    else if (this.fuelWood > 0) { this.fuelWood--; this.fuel = Math.min(LOCO_MAX_FUEL, this.fuel + LOCO_WOOD_FUEL); }
  }
  countOf(item) {
    if (item === 'coal') return this.fuelCoal;
    if (item === 'solid-fuel') return this.fuelSolid;
    if (item === 'rocket-fuel') return this.fuelRocket;
    if (item === 'wood') return this.fuelWood;
    return 0;
  }
  takeItemOf(item) {
    if (item === 'coal' && this.fuelCoal > 0) { this.fuelCoal--; return 'coal'; }
    if (item === 'solid-fuel' && this.fuelSolid > 0) { this.fuelSolid--; return 'solid-fuel'; }
    if (item === 'rocket-fuel' && this.fuelRocket > 0) { this.fuelRocket--; return 'rocket-fuel'; }
    if (item === 'wood' && this.fuelWood > 0) { this.fuelWood--; return 'wood'; }
    return null;
  }
  contents() {
    const list = [[this.type, 1]];
    if (this.fuelRocket > 0) list.push(['rocket-fuel', this.fuelRocket]);
    if (this.fuelSolid > 0) list.push(['solid-fuel', this.fuelSolid]);
    if (this.fuelCoal > 0) list.push(['coal', this.fuelCoal]);
    if (this.fuelWood > 0) list.push(['wood', this.fuelWood]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.fuel = this.fuel; s.fuelCoal = this.fuelCoal; s.fuelSolid = this.fuelSolid; s.fuelRocket = this.fuelRocket; s.fuelWood = this.fuelWood;
    s.schedule = this.schedule;
    return s;
  }
  blueprint() {
    const s = super.blueprint();
    s.fuel = this.fuel; s.fuelCoal = this.fuelCoal; s.fuelSolid = this.fuelSolid; s.fuelRocket = this.fuelRocket; s.fuelWood = this.fuelWood;
    s.schedule = this.schedule;
    return s;
  }
  static restore(s) {
    const e = super.restore(s);
    e.fuel = s.fuel | 0; e.fuelCoal = s.fuelCoal | 0; e.fuelSolid = s.fuelSolid | 0; e.fuelRocket = s.fuelRocket | 0; e.fuelWood = s.fuelWood | 0;
    e.schedule = Array.isArray(s.schedule) ? s.schedule.slice() : [];
    return e;
  }
}

// ===== 内燃机车 DieselLocomotive（对齐《异星工厂》Diesel locomotive） =====
// 进阶机车：速度更快（trainMoveTime 取 DIESEL_SPEED），吃固体燃料/火箭燃料（不吃煤，对齐原版内燃机车）。
class DieselLocomotive extends Locomotive {
  constructor(type, x, y) {
    super(type, x, y);
    this.fuelCoal = 0; // 内燃机车不吃煤（原版内燃机车烧液体/固体燃料），煤槽始终为空
  }
  giveItem(item) {
    // 内燃机车只吃固体燃料与火箭燃料（对齐《异星工厂》：内燃机车不使用煤）
    const total = this.fuelCoal + this.fuelSolid + this.fuelRocket;
    if (item === 'rocket-fuel' && total < LOCO_MAX_UNITS) { this.fuelRocket++; return true; }
    if (item === 'solid-fuel' && total < LOCO_MAX_UNITS) { this.fuelSolid++; return true; }
    return false;
  }
  refuel() {
    if (this.fuel >= LOCO_FUEL) return;
    if (this.fuelRocket > 0) { this.fuelRocket--; this.fuel = Math.min(LOCO_MAX_FUEL, this.fuel + LOCO_ROCKET_FUEL); }
    else if (this.fuelSolid > 0) { this.fuelSolid--; this.fuel = Math.min(LOCO_MAX_FUEL, this.fuel + LOCO_SOLID_FUEL); }
    // 内燃机车不吃煤，fuelCoal 恒为 0，不会走到煤分支
  }
  takeItemOf(item) {
    if (item === 'solid-fuel' && this.fuelSolid > 0) { this.fuelSolid--; return 'solid-fuel'; }
    if (item === 'rocket-fuel' && this.fuelRocket > 0) { this.fuelRocket--; return 'rocket-fuel'; }
    return null;
  }
  contents() {
    const list = [[this.type, 1]];
    if (this.fuelRocket > 0) list.push(['rocket-fuel', this.fuelRocket]);
    if (this.fuelSolid > 0) list.push(['solid-fuel', this.fuelSolid]);
    return list;
  }
}

// ===== 货运车厢 CargoWagon =====
class CargoWagon extends Entity {
  constructor(type, x, y) {
    super(type, x, y);
    this.slots = [];
  }
  giveItem(item) {
    if (item === 'logistic-robot') return false;
    for (const s of this.slots)
      if (s && s.item === item && s.count < WAGON_STACK) { s.count++; return true; }
    if (this.slots.length >= WAGON_SLOTS) return false;
    this.slots.push({ item, count: 1 });
    return true;
  }
  peekItem() {
    for (let i = this.slots.length - 1; i >= 0; i--) { const s = this.slots[i]; if (s) return s.item; }
    return null;
  }
  takeItem() {
    for (let i = this.slots.length - 1; i >= 0; i--) {
      const s = this.slots[i];
      if (s) {
        const it = s.item; s.count--;
        if (s.count <= 0) this.slots.splice(i, 1);
        return it;
      }
    }
    return null;
  }
  countOf(item) { let n = 0; for (const st of this.slots) if (st && st.item === item) n += st.count; return n; }
  takeItemOf(item) {
    for (let i = this.slots.length - 1; i >= 0; i--) {
      const s = this.slots[i];
      if (s && s.item === item) {
        s.count--;
        if (s.count <= 0) this.slots.splice(i, 1);
        return item;
      }
    }
    return null;
  }
  contents() {
    const rows = [[this.type, 1]];
    for (const s of this.slots) if (s) rows.push([s.item, s.count]);
    return rows;
  }
  serialize() {
    const s = super.serialize();
    s.slots = this.slots.filter(Boolean);
    return s;
  }
  blueprint() {
    const s = super.blueprint();
    s.slots = [];
    return s;
  }
  static restore(s) {
    const e = super.restore(s);
    e.slots = (s.slots || []).map(x => ({ item: x.item, count: x.count }));
    return e;
  }
}

// ===== 流体车厢 FluidWagon（对齐《异星工厂》Fluid Wagon） =====
// 继承 CargoWagon 以复用列车编组逻辑；但存储的是单一流体而非物品槽位。
// 容量 FLUID_WAGON_CAP，只容纳一种流体。车站可用流体泵从侧边装卸。
class FluidWagon extends CargoWagon {
  constructor(type, x, y) {
    super(type, x, y);
    this.slots = [];
    this.fluid = null;   // 当前装载的流体 id
    this.amount = 0;     // 已装流体量
  }
  // 物品接口：流体车厢不存普通物品
  giveItem(item) { return false; }
  peekItem() { return null; }
  takeItem() { return null; }
  countOf(item) { return 0; }
  takeItemOf(item) { return null; }
  contents() { return [[this.type, 1]]; }
  takeAll() { return [[this.type, 1]]; }
  // 流体接口：由泵/面板调用
  fluidContents() { return this.fluid ? { item: this.fluid, count: this.amount } : null; }
  fluidCapacity() { return FLUID_WAGON_CAP; }
  // 向车厢注入流体；返回实际注入量
  addFluid(fid, n) {
    if (this.fluid && this.fluid !== fid) return 0;
    const room = FLUID_WAGON_CAP - this.amount;
    const take = Math.min(room, n);
    if (take <= 0) return 0;
    this.fluid = fid;
    this.amount += take;
    return take;
  }
  // 从车厢抽出流体；返回实际抽出量
  takeFluid(fid, n) {
    if (!this.fluid || (fid && this.fluid !== fid) || this.amount <= 0) return 0;
    const out = Math.min(this.amount, n);
    this.amount -= out;
    if (this.amount <= 0) this.fluid = null;
    return out;
  }
  serialize() {
    const s = super.serialize();
    s.fluid = this.fluid;
    s.amount = this.amount;
    return s;
  }
  blueprint() {
    const s = super.blueprint();
    s.fluid = this.fluid;
    s.amount = this.amount;
    return s;
  }
  static restore(s) {
    const e = super.restore(s);
    e.fluid = s.fluid || null;
    e.amount = s.amount | 0;
    return e;
  }
}

// ===== 炮兵车厢 ArtilleryWagon（对齐《异星工厂》Artillery wagon） =====
// 挂在列车上的远程炮兵：内装炮兵炮弹（artillery-shell），列车行驶/停靠期间自动
// 轰击极远距离的敌人，命中造成大范围爆炸。需先研究高级战斗科技（与炮兵连相同）。
const ARTILLERY_WAGON_SHELLS = 20;  // 炮兵车厢炮弹容量（对齐《异星工厂》容量 100，简化为 20）
class ArtilleryWagon extends CargoWagon {
  constructor(type, x, y) {
    super(type, x, y);
    this.shells = 0;
    this.cooldown = 0;
    this.facing = 0;
  }
  // 只接受炮兵炮弹，其余物品拒绝
  giveItem(item) {
    if (item === 'artillery-shell' && this.shells < ARTILLERY_WAGON_SHELLS) { this.shells++; return true; }
    return false;
  }
  takeItem() { return this.shells > 0 ? this.takeItemOf('artillery-shell') : null; }
  peekItem() { return this.shells > 0 ? 'artillery-shell' : null; }
  countOf(item) { return item === 'artillery-shell' ? this.shells : 0; }
  takeItemOf(item) {
    if (item === 'artillery-shell' && this.shells > 0) { this.shells--; return item; }
    return null;
  }
  contents() {
    const list = [[this.type, 1]];
    if (this.shells > 0) list.push(['artillery-shell', this.shells]);
    return list;
  }
  takeAll() {
    const rows = [];
    if (this.shells > 0) rows.push(['artillery-shell', this.shells]);
    this.shells = 0;
    return rows;
  }
  serialize() {
    const s = super.serialize();
    s.shells = this.shells;
    return s;
  }
  blueprint() {
    const s = super.blueprint();
    s.shells = 0;
    return s;
  }
  static restore(s) {
    const e = super.restore(s);
    e.shells = (s && s.shells) | 0;
    return e;
  }
}
// 列车炮击：每帧由 updateTrains 调用，检查列车上所有炮兵车厢并对射程内敌人开火。
function updateTrainArtillery(tr, dt) {
  for (const car of tr.cars) {
    if (!(car instanceof ArtilleryWagon) || car.shells <= 0) continue;
    car.cooldown = (car.cooldown || 0) - dt;
    if (car.cooldown > 0) continue;
    const cx = car.x + car.w / 2, cy = car.y + car.h / 2;
    let best = null, bestD = Infinity;
    for (const en of (G.enemies || [])) {
      if (!en || en.dead) continue;
      const d = Math.hypot(en.x / TILE - cx, en.y / TILE - cy);
      if (d <= ARTILLERY_RANGE && d > 4 && d < bestD) { best = en; bestD = d; }
    }
    if (!best) continue;
    car.facing = Math.atan2(best.y - cy * TILE, best.x - cx * TILE);
    // 炮兵炮弹射击速度无限科技：射速提升 → 射击间隔缩短
    car.cooldown = ARTILLERY_FIRE_RATE / (typeof artilleryShootingSpeedMult === 'function' ? artilleryShootingSpeedMult() : 1);
    car.shells--;
    (G.bullets || (G.bullets = [])).push({
      x: cx * TILE, y: cy * TILE, tx: best.x, ty: best.y, t: 0,
      life: Math.max(0.3, bestD / 40), art: true, splash: ARTILLERY_RADIUS, dmg: ARTILLERY_DMG
    });
  }
}

// ===== 车站 TrainStop =====
// 对齐《异星工厂》Railway train stop：列车停靠后可自动装卸货。
// 车站可配置“装载（load）”与“卸载（unload）”的物品清单：
//   - 卸载：从列车车厢取出清单物品，存入车站旁 3×3 范围内的箱子；
//   - 装载：从车站旁箱子取出清单物品，装入列车车厢。
// 列车停靠期间持续装卸，装/卸完毕或超时后发车。
class TrainStop extends Entity {
  constructor(type, x, y) {
    super(type, x, y);
    this.load = [];    // 要装入车厢的物品清单
    this.unload = [];  // 要从车厢卸出的物品清单
    this.name = '';    // 车站名（用于列车自动调度路线引用）
  }
  contents() {
    return [[this.type, 1]];
  }
  displayName() {
    if (this.name) return this.name;
    // 未命名车站：按在 G.ents 中的放置顺序分配唯一编号（站1、站2…）
    let n = 0;
    for (const e of G.ents) {
      if (e._dead) continue;
      if (e instanceof TrainStop) {
        n++;
        if (e === this) break;
      }
    }
    return '站' + n;
  }
  serialize() {
    const s = super.serialize();
    s.load = this.load; s.unload = this.unload; s.name = this.name;
    return s;
  }
  static restore(s) {
    const st = super.restore(s);
    st.load = Array.isArray(s.load) ? s.load : [];
    st.unload = Array.isArray(s.unload) ? s.unload : [];
    st.name = s.name || '';
    return st;
  }
}
function trainStopAt(tx, ty) {
  // 车头占用铁轨格，entAt 返回车头而非车站；改为遍历 G.ents 检测车站实体
  for (const e of G.ents) {
    if (e._dead) continue;
    if (e.type === 'train-stop' && e.x === tx && e.y === ty) return e;
  }
  return null;
}
// 获取车站旁 3×3 范围内的普通储物箱（含木/铁/钢箱，不含创造/虚空箱）
function stationChests(st) {
  const out = [];
  for (let dy = -1; dy <= 1; dy++)
    for (let dx = -1; dx <= 1; dx++) {
      const e = entAt(st.x + dx, st.y + dy);
      if (e && !e._dead && (e instanceof Chest)) out.push(e);
    }
  return out;
}
// 列车停靠车站时的自动装卸：
// 对车站配置的每个 unload 物品：从车厢卸到相邻箱子；
// 对每个 load 物品：从相邻箱子装进车厢。返回是否完成了本次装卸。
function trainAutoLoadUnload(train, station) {
  if (!train || !station) return false;
  let acted = false;
  const chests = stationChests(station);
  if (!chests.length) return acted;
  // 卸载：车厢 → 箱子
  for (const item of station.unload || []) {
    for (const car of train.cars) {
      if (car.type === 'cargo-wagon' && car.countOf && typeof car.takeItemOf === 'function') {
        if (car.countOf(item) > 0) {
          while (car.countOf(item) > 0) {
            let stored = false;
            for (const c of chests) {
              if (c.giveItem && c.giveItem(item)) { car.takeItemOf(item); stored = true; acted = true; break; }
            }
            if (!stored) break;
          }
        }
      }
    }
  }
  // 装载：箱子 → 车厢
  for (const item of station.load || []) {
    for (const car of train.cars) {
      if (car.type === 'cargo-wagon' && car.giveItem && car.countOf) {
        while (car.countOf(item) < WAGON_STACK * 10) {
          let got = false;
          for (const c of chests) {
            if (c.countOf && c.countOf(item) > 0 && c.takeItemOf) {
              const it = c.takeItemOf(item);
              if (it && car.giveItem(it)) { got = true; acted = true; }
            }
          }
          if (!got) break;
        }
      }
    }
  }
  return acted;
}

// ===== 铁路信号灯 RailSignal =====
class RailSignal extends Entity {
  constructor(type, x, y) { super(type, x, y); }
}
function railSignalAt(tx, ty) {
  const e = entAt(tx, ty);
  return e && e.type === 'rail-signal';
}
// ===== 链式信号灯 RailChainSignal（对齐《异星工厂》Rail chain signal）=====
class RailChainSignal extends Entity {
  constructor(type, x, y) { super(type, x, y); }
}

// ===== 列车编组管理 =====
// 车头放置：若目标铁轨上无火车，则创建一列仅含车头的列车。
// 车厢放置：若与已有车头/车厢相邻，挂接到该列车末尾。
function addTrainCar(e, tx, ty) {
  // 找到把该车加入哪列列车
  let train = null;
  for (const tr of G.trains) {
    const last = tr.cars[tr.cars.length - 1];
    if (last && Math.abs(last.x - tx) + Math.abs(last.y - ty) === 1) { train = tr; break; }
  }
  if (e instanceof Locomotive) {
    train = newTrain(e);
    G.trains.push(train);
  } else {
    if (!train) {
      // 孤立车厢：也算单独"列车"（不移动）
      train = newTrain(e);
      G.trains.push(train);
    } else {
      train.cars.push(e);
    }
  }
}
// 创建列车对象（含自动调度运行态）
function newTrain(loco) {
  const t = { id: G.trains.length + 1, cars: [], moveT: 0, stopT: 0, route: [], routeIdx: 0, waitT: 0 };
  if (loco) {
    t.cars = [loco];
    t.route = (loco.schedule || []).slice();
    t.routeIdx = 0;
  }
  return t;
}
// 列车是否有自动调度路线
function trainHasSchedule(tr) { return !!(tr && tr.route && tr.route.length > 0); }
// 找到路线中当前目标站点实体（按车站名）
function scheduleTargetStop(tr) {
  if (!trainHasSchedule(tr)) return null;
  const name = tr.route[tr.routeIdx];
  for (const e of G.ents) {
    if (e._dead || !(e instanceof TrainStop)) continue;
    if (e.displayName() === name) return e;
  }
  return null;
}
// 查找所有车站名（用于调度面板选择）
function allTrainStopNames() {
  const names = [];
  for (const e of G.ents) {
    if (e._dead || !(e instanceof TrainStop)) continue;
    const n = e.displayName();
    if (names.indexOf(n) < 0) names.push(n);
  }
  return names;
}
// 该车站是否被任一列车的自动调度路线引用（用于渲染调度光环标记）
function stationInSchedule(stop) {
  const n = stop.displayName();
  for (const tr of G.trains) {
    if (tr.route && tr.route.indexOf(n) >= 0) return true;
  }
  return false;
}

function removeTrainCar(e) {
  for (let i = G.trains.length - 1; i >= 0; i--) {
    const tr = G.trains[i];
    const idx = tr.cars.indexOf(e);
    if (idx >= 0) {
      tr.cars.splice(idx, 1);
      if (tr.cars.length === 0) G.trains.splice(i, 1);
      return;
    }
  }
}

// 拆除/重建时火车实体通过 removeEnt 移除，需同步从列车列表摘除。
// 在铁路设备 removeEnt 的包装函数中调用。

// ===== 铁轨渲染 =====
DEVICE_RENDER['rail'] = function (ctx, e, gx, gy, dir, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#4a4a52';
  ctx.fillRect(gx, gy, TILE, TILE);
  const c = railConnAt(e.x, e.y);
  ctx.strokeStyle = '#8a8a92';
  ctx.lineWidth = TILE * 0.22;
  ctx.lineCap = 'round';
  ctx.beginPath();
  // 水平方向连接
  if (c.E || c.W) {
    const x1 = c.E ? gx + TILE : gx + TILE / 2;
    const x2 = c.W ? gx : gx + TILE / 2;
    ctx.moveTo(x2, gy + TILE / 2); ctx.lineTo(x1, gy + TILE / 2);
  }
  // 垂直方向连接
  if (c.N || c.S) {
    const y1 = c.S ? gy + TILE : gy + TILE / 2;
    const y2 = c.N ? gy : gy + TILE / 2;
    ctx.moveTo(gx + TILE / 2, y2); ctx.lineTo(gx + TILE / 2, y1);
  }
  ctx.stroke();
  // 枕木
  ctx.fillStyle = '#5a5a64';
  if (c.E || c.W) { ctx.fillRect(gx + TILE * 0.42, gy + TILE * 0.18, TILE * 0.16, TILE * 0.64); }
  if (c.N || c.S) { ctx.fillRect(gx + TILE * 0.18, gy + TILE * 0.42, TILE * 0.64, TILE * 0.16); }
  ctx.restore();
};

// ===== 车头渲染 =====
DEVICE_RENDER['locomotive'] = function (ctx, e, gx, gy, dir, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(gx + TILE / 2, gy + TILE / 2);
  ctx.rotate(dir * Math.PI / 2);
  ctx.fillStyle = '#d04a3a';
  rrPath(ctx, -TILE * 0.42, -TILE * 0.32, TILE * 0.84, TILE * 0.64, TILE * 0.12);
  ctx.fill();
  ctx.strokeStyle = '#7a2018'; ctx.lineWidth = 2; ctx.stroke();
  // 车灯朝前
  ctx.fillStyle = '#ffe08a';
  ctx.fillRect(TILE * 0.2, -TILE * 0.06, TILE * 0.1, TILE * 0.12);
  // 燃料状态灯
  ctx.fillStyle = (e.fuel || 0) > 0 ? '#6fd06f' : '#b04040';
  ctx.fillRect(-TILE * 0.2, -TILE * 0.38, TILE * 0.12, TILE * 0.12);
  ctx.restore();
};

// ===== 内燃机车渲染（蓝灰进阶车头，带速度标识） =====
DEVICE_RENDER['diesel-locomotive'] = function (ctx, e, gx, gy, dir, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(gx + TILE / 2, gy + TILE / 2);
  ctx.rotate(dir * Math.PI / 2);
  // 车体（蓝灰）
  ctx.fillStyle = '#3f6fa8';
  rrPath(ctx, -TILE * 0.42, -TILE * 0.32, TILE * 0.84, TILE * 0.64, TILE * 0.12);
  ctx.fill();
  ctx.strokeStyle = '#1f3f68'; ctx.lineWidth = 2; ctx.stroke();
  // 车头驾驶舱窗（体现内燃机车更流线）
  ctx.fillStyle = '#9fc8ef';
  rrPath(ctx, TILE * 0.02, -TILE * 0.18, TILE * 0.22, TILE * 0.36, TILE * 0.06);
  ctx.fill();
  // 车灯朝前
  ctx.fillStyle = '#ffe08a';
  ctx.fillRect(TILE * 0.2, -TILE * 0.06, TILE * 0.1, TILE * 0.12);
  // 速度标识（两道速度线，标志更快）
  ctx.strokeStyle = '#c8e0ff'; ctx.lineWidth = 2; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-TILE * 0.3, -TILE * 0.1); ctx.lineTo(-TILE * 0.3, -TILE * 0.24); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(-TILE * 0.18, -TILE * 0.1); ctx.lineTo(-TILE * 0.18, -TILE * 0.24); ctx.stroke();
  ctx.lineCap = 'butt';
  // 燃料状态灯
  ctx.fillStyle = (e.fuel || 0) > 0 ? '#6fd06f' : '#b04040';
  ctx.fillRect(-TILE * 0.34, -TILE * 0.38, TILE * 0.12, TILE * 0.12);
  ctx.restore();
};

// ===== 车厢渲染 =====
DEVICE_RENDER['cargo-wagon'] = function (ctx, e, gx, gy, dir, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(gx + TILE / 2, gy + TILE / 2);
  ctx.rotate(dir * Math.PI / 2);
  ctx.fillStyle = '#8a6a4a';
  rrPath(ctx, -TILE * 0.42, -TILE * 0.3, TILE * 0.84, TILE * 0.6, TILE * 0.08);
  ctx.fill();
  ctx.strokeStyle = '#4a3222'; ctx.lineWidth = 2; ctx.stroke();
  // 货物指示灯
  ctx.fillStyle = (e.slots && e.slots.length) ? '#e0b23c' : '#555';
  ctx.fillRect(-TILE * 0.2, -TILE * 0.38, TILE * 0.12, TILE * 0.12);
  ctx.restore();
};

// ===== 车站渲染 =====
DEVICE_RENDER['fluid-wagon'] = function (ctx, e, gx, gy, dir, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(gx + TILE / 2, gy + TILE / 2);
  ctx.rotate(dir * Math.PI / 2);
  // 罐体
  ctx.fillStyle = '#3a6a8a';
  rrPath(ctx, -TILE * 0.4, -TILE * 0.3, TILE * 0.8, TILE * 0.6, TILE * 0.22);
  ctx.fill();
  ctx.strokeStyle = '#1a3a52'; ctx.lineWidth = 2; ctx.stroke();
  // 装载液位
  const fc = (typeof e.fluidContents === 'function') ? e.fluidContents() : null;
  if (fc && fc.count > 0) {
    const fcol = ITEMS[fc.item] ? ITEMS[fc.item].color : '#4a90c0';
    ctx.fillStyle = fcol;
    const lvl = Math.max(0.1, fc.count / FLUID_WAGON_CAP);
    rrPath(ctx, -TILE * 0.32, TILE * 0.3 - TILE * 0.6 * lvl, TILE * 0.64, TILE * 0.6 * lvl, TILE * 0.12);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold ' + Math.round(TILE * 0.32) + 'px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(fc.item === 'water' ? 'H2O' : fc.item === 'crude-oil' ? 'OIL' : fc.item === 'steam' ? 'ST' : fc.item, 0, 0);
  }
  // 液位状态灯
  ctx.fillStyle = fc && fc.count > 0 ? '#7fd0ff' : '#555';
  ctx.fillRect(-TILE * 0.2, -TILE * 0.38, TILE * 0.12, TILE * 0.12);
  ctx.restore();
};

// ===== 炮兵车厢渲染 =====
DEVICE_RENDER['artillery-wagon'] = function (ctx, e, gx, gy, dir, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(gx + TILE / 2, gy + TILE / 2);
  ctx.rotate(dir * Math.PI / 2);
  // 车体
  ctx.fillStyle = '#5a4a42';
  rrPath(ctx, -TILE * 0.44, -TILE * 0.3, TILE * 0.88, TILE * 0.6, TILE * 0.08);
  ctx.fill();
  ctx.strokeStyle = '#3a2f2a'; ctx.lineWidth = 2; ctx.stroke();
  // 转盘炮座
  ctx.fillStyle = '#4a3d35';
  ctx.beginPath(); ctx.arc(0, 0, TILE * 0.22, 0, 7); ctx.fill();
  ctx.strokeStyle = '#2e2620'; ctx.lineWidth = 1.5; ctx.stroke();
  // 炮管（朝向目标或车厢朝向）
  const ang = e.facing !== undefined ? e.facing : (dir * Math.PI) / 2;
  ctx.strokeStyle = '#2e2620';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(Math.cos(ang) * 6, Math.sin(ang) * 6);
  ctx.lineTo(Math.cos(ang) * TILE * 0.5, Math.sin(ang) * TILE * 0.5);
  ctx.stroke();
  ctx.lineCap = 'butt';
  // 炮弹余量指示灯
  ctx.fillStyle = e.shells > 0 ? '#ff5a3a' : '#555';
  ctx.fillRect(-TILE * 0.2, -TILE * 0.38, TILE * 0.12, TILE * 0.12);
  ctx.restore();
};

DEVICE_RENDER['train-stop'] = function (ctx, e, gx, gy, dir, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#3a4a6a';
  rrPath(ctx, gx + 4, gy + 4, TILE - 8, TILE - 8, 6); ctx.fill();
  ctx.strokeStyle = '#5a8ac0'; ctx.lineWidth = 2; ctx.stroke();
  ctx.fillStyle = '#9ac0e8';
  ctx.font = 'bold ' + Math.round(TILE * 0.4) + 'px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('S', gx + TILE / 2, gy + TILE / 2);
  // 若该车站被列车自动调度路线引用：叠加呼吸的蓝色调度光环，直观标记调度网络节点
  if (stationInSchedule(e)) {
    const t = (performance.now() || Date.now()) / 1000;
    const pulse = 0.5 + 0.5 * Math.sin(t * 2.4);
    ctx.globalAlpha = alpha * (0.35 + 0.35 * pulse);
    ctx.strokeStyle = '#4ab8ff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(gx + TILE / 2, gy + TILE / 2, TILE * (0.62 + 0.06 * pulse), 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
};

// ===== 信号灯渲染 =====
DEVICE_RENDER['rail-signal'] = function (ctx, e, gx, gy, dir, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#3a3a44';
  ctx.fillRect(gx + TILE * 0.3, gy + TILE * 0.3, TILE * 0.4, TILE * 0.4);
  const blocked = railSignalBlocked({ x: e.x, y: e.y, type: 'rail-signal' });
  ctx.fillStyle = blocked ? '#e04a4a' : '#4ae04a';
  ctx.beginPath(); ctx.arc(gx + TILE / 2, gy + TILE / 2, TILE * 0.14, 0, 7); ctx.fill();
  ctx.restore();
};

// ===== 链式信号灯渲染（橙黄灯身，双色指示灯）=====
DEVICE_RENDER['rail-chain-signal'] = function (ctx, e, gx, gy, dir, alpha) {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#3a3a44';
  ctx.fillRect(gx + TILE * 0.3, gy + TILE * 0.3, TILE * 0.4, TILE * 0.4);
  // 前方是否被占用（用链式信号灯的大范围检测）
  const blocked = railSignalBlocked({ x: e.x, y: e.y, type: 'rail-chain-signal' });
  ctx.fillStyle = blocked ? '#e0a04a' : '#4ae04a';
  ctx.beginPath(); ctx.arc(gx + TILE / 2, gy + TILE / 2, TILE * 0.14, 0, 7); ctx.fill();
  // 双灯：上方小圆点表示连锁（黄/绿）
  ctx.fillStyle = blocked ? '#e04a4a' : '#4ae04a';
  ctx.beginPath(); ctx.arc(gx + TILE / 2, gy + TILE * 0.32, TILE * 0.08, 0, 7); ctx.fill();
  ctx.restore();
};

// ===== 面板 =====
// ===== 车头自动调度面板 =====
function locoScheduleHtml(e) {
  const stops = allTrainStopNames();
  let h = '<div class="sec">🚂 自动调度路线（对齐《异星工厂》Schedule）</div>';
  if (!stops.length) {
    h += '<div class="dim">尚未放置任何车站。请先放置车站（Train Stop）到铁轨上，再回来配置路线。</div>';
    return h;
  }
  // 当前路线
  h += '<div class="rows">';
  if (!e.schedule || !e.schedule.length) h += '<div class="dim">未配置路线：列车将一直直线行驶、遇站装卸。配置路线后按序循环往返各站。</div>';
  else for (let i = 0; i < e.schedule.length; i++) {
    h += '<div class="row"><span>' + (i + 1) + '. ' + chip('train-stop') + ' ' + e.schedule[i] + '</span>' +
      '<button data-act="sch-up" data-idx="' + i + '" title="上移">↑</button>' +
      '<button data-act="sch-down" data-idx="' + i + '" title="下移">↓</button>' +
      '<button data-act="sch-del" data-idx="' + i + '" title="删除该站">✕</button></div>';
  }
  h += '</div>';
  // 添加站点（下拉选择车站）
  h += '<div class="rows"><div class="row"><span>加入站点</span><select id="sch-add" data-act="sch-add">' +
    stops.map((n, i) => '<option value="' + n + '">' + n + '</option>').join('') +
    '</select><button data-act="sch-add-btn">＋ 追加</button></div></div>';
  h += '<div class="dim">路线按顺序循环：列车沿铁轨驶向路线中的每个车站，到站自动装卸该站的“装载/卸载”物品，随后前往下一站。用此实现两站（或多站）间往返自动化运输。</div>';
  return h;
}

DEVICE_PANEL['locomotive'] = {
  html(e) {
    return '<div class="dim">车头：烧燃料在铁轨上行驶。装入煤/固体燃料后自动前进，可挂接货运车厢。固体燃料更耐用。</div>' +
      '<div class="sec">燃料</div><div class="rows">' +
      '<div class="row"><span>煤</span><b>' + (e.fuelCoal || 0) + '</b><button data-act="putcoal">+1</button><button data-act="takecoal">取出</button></div>' +
      (invCount('solid-fuel') > 0 || (e.fuelSolid || 0) > 0
        ? '<div class="row"><span>固体燃料</span><b>' + (e.fuelSolid || 0) + '</b><button data-act="putsolid">+1</button><button data-act="takesolid">取出</button></div>'
        : '') +
      (invCount('rocket-fuel') > 0 || (e.fuelRocket || 0) > 0
        ? '<div class="row"><span>火箭燃料</span><b>' + (e.fuelRocket || 0) + '</b><button data-act="putrocket">+1</button><button data-act="takerocket">取出</button></div>'
        : '') +
      (invCount('wood') > 0 || (e.fuelWood || 0) > 0
        ? '<div class="row"><span>木材</span><b>' + (e.fuelWood || 0) + '</b><button data-act="putwood">+1</button><button data-act="takewood">取出</button></div>'
        : '') +
      '</div>' + locoScheduleHtml(e);
  },
  live() { return ''; },
  tip() { return 'g'; },
  onAction(btn, e) {
    if (btn === 'putcoal' && invCount('coal') > 0) { e.giveItem('coal'); invTake('coal', 1); toast('已加煤'); uiDirty = true; }
    else if (btn === 'takecoal') { const it = e.takeItemOf('coal'); if (it) { invAdd(it); toast('已取出煤'); uiDirty = true; } }
    else if (btn === 'putsolid' && invCount('solid-fuel') > 0) { e.giveItem('solid-fuel'); invTake('solid-fuel', 1); toast('已加固体燃料'); uiDirty = true; }
    else if (btn === 'takesolid') { const it = e.takeItemOf('solid-fuel'); if (it) { invAdd(it); toast('已取出固体燃料'); uiDirty = true; } }
    else if (btn === 'putrocket' && invCount('rocket-fuel') > 0) { e.giveItem('rocket-fuel'); invTake('rocket-fuel', 1); toast('已加火箭燃料'); uiDirty = true; }
    else if (btn === 'takerocket') { const it = e.takeItemOf('rocket-fuel'); if (it) { invAdd(it); toast('已取出火箭燃料'); uiDirty = true; } }
    else if (btn === 'putwood' && invCount('wood') > 0) { e.giveItem('wood'); invTake('wood', 1); toast('已加木材'); uiDirty = true; }
    else if (btn === 'takewood') { const it = e.takeItemOf('wood'); if (it) { invAdd(it); toast('已取出木材'); uiDirty = true; } }
    else if (btn === 'sch-add-btn') {
      const sel = document.getElementById('sch-add');
      if (sel && sel.value) {
        e.schedule = e.schedule || [];
        e.schedule.push(sel.value);
        // 同步到所属列车的 route（若列车已在运行）
        syncLocoSchedule(e);
        toast('已把车站「' + sel.value + '」加入路线');
        uiDirty = true;
      }
    }
    else if (btn === 'sch-del' || btn === 'sch-up' || btn === 'sch-down') {
      const idx = +((btn && btn.dataset && btn.dataset.idx) || -1);
      if (!e.schedule || idx < 0 || idx >= e.schedule.length) return true;
      if (btn === 'sch-del') e.schedule.splice(idx, 1);
      else if (btn === 'sch-up' && idx > 0) { const t = e.schedule[idx]; e.schedule[idx] = e.schedule[idx - 1]; e.schedule[idx - 1] = t; }
      else if (btn === 'sch-down' && idx < e.schedule.length - 1) { const t = e.schedule[idx]; e.schedule[idx] = e.schedule[idx + 1]; e.schedule[idx + 1] = t; }
      syncLocoSchedule(e);
      uiDirty = true;
    }
    return true;
  }
};

// 把车头的 schedule 同步到其所属列车的 route（编辑路线时实时生效）
function syncLocoSchedule(loco) {
  for (const tr of G.trains) {
    if (tr.cars[0] === loco) {
      tr.route = (loco.schedule || []).slice();
      if (tr.routeIdx >= tr.route.length) tr.routeIdx = 0;
      return;
    }
  }
}

// 内燃机车面板：复用调度路线，但不吃煤（只吃固体/火箭燃料）
DEVICE_PANEL['diesel-locomotive'] = {
  html(e) {
    return '<div class="dim">内燃机车：进阶车头，速度约为烧煤车头的 1.5 倍。只吃固体燃料/火箭燃料（不吃煤，对齐《异星工厂》内燃机车）。可挂接货运车厢。</div>' +
      '<div class="sec">燃料</div><div class="rows">' +
      (invCount('solid-fuel') > 0 || (e.fuelSolid || 0) > 0
        ? '<div class="row"><span>固体燃料</span><b>' + (e.fuelSolid || 0) + '</b><button data-act="putsolid">+1</button><button data-act="takesolid">取出</button></div>'
        : '') +
      (invCount('rocket-fuel') > 0 || (e.fuelRocket || 0) > 0
        ? '<div class="row"><span>火箭燃料</span><b>' + (e.fuelRocket || 0) + '</b><button data-act="putrocket">+1</button><button data-act="takerocket">取出</button></div>'
        : '') +
      '</div>' + locoScheduleHtml(e);
  },
  live() { return ''; },
  tip() { return 'g'; },
  onAction(btn, e) {
    if (btn === 'putsolid' && invCount('solid-fuel') > 0) { e.giveItem('solid-fuel'); invTake('solid-fuel', 1); toast('已加固体燃料'); uiDirty = true; }
    else if (btn === 'takesolid') { const it = e.takeItemOf('solid-fuel'); if (it) { invAdd(it); toast('已取出固体燃料'); uiDirty = true; } }
    else if (btn === 'putrocket' && invCount('rocket-fuel') > 0) { e.giveItem('rocket-fuel'); invTake('rocket-fuel', 1); toast('已加火箭燃料'); uiDirty = true; }
    else if (btn === 'takerocket') { const it = e.takeItemOf('rocket-fuel'); if (it) { invAdd(it); toast('已取出火箭燃料'); uiDirty = true; } }
    else if (btn === 'sch-add-btn') {
      const sel = document.getElementById('sch-add');
      if (sel && sel.value) {
        e.schedule = e.schedule || [];
        e.schedule.push(sel.value);
        syncLocoSchedule(e);
        toast('已把车站「' + sel.value + '」加入路线');
        uiDirty = true;
      }
    }
    else if (btn === 'sch-del' || btn === 'sch-up' || btn === 'sch-down') {
      const idx = +((btn && btn.dataset && btn.dataset.idx) || -1);
      if (!e.schedule || idx < 0 || idx >= e.schedule.length) return true;
      if (btn === 'sch-del') e.schedule.splice(idx, 1);
      else if (btn === 'sch-up' && idx > 0) { const t = e.schedule[idx]; e.schedule[idx] = e.schedule[idx - 1]; e.schedule[idx - 1] = t; }
      else if (btn === 'sch-down' && idx < e.schedule.length - 1) { const t = e.schedule[idx]; e.schedule[idx] = e.schedule[idx + 1]; e.schedule[idx + 1] = t; }
      syncLocoSchedule(e);
      uiDirty = true;
    }
    return true;
  }
};

DEVICE_PANEL['cargo-wagon'] = {
  html(e) {
    let h = '<div class="dim">货运车厢：挂在车头后随列车移动，最多 ' + WAGON_SLOTS + ' 格各 ' + WAGON_STACK + ' 个。车站可用机械臂装卸。</div><div class="sec">货物</div><div class="rows">';
    if (!e.slots || !e.slots.length) h += '<div class="dim">车厢是空的</div>';
    else for (const s of e.slots) if (s) h += '<div class="row"><span>' + ITEMS[s.item].name + '</span><b>' + s.count + '</b><button data-act="take" data-id="' + s.item + '">取出1</button></div>';
    return h + '</div>';
  },
  live() { return ''; },
  tip() { return 'g'; },
  onAction(btn, e) {
    const id = btn && btn.dataset ? btn.dataset.id : null;
    if (btn === 'take' && id && e.countOf(id) > 0) {
      const it = e.takeItemOf(id); if (it) { invAdd(it); uiDirty = true; }
    }
    return true;
  }
};

DEVICE_PANEL['fluid-wagon'] = {
  html(e) {
    const fc = (typeof e.fluidContents === 'function') ? e.fluidContents() : null;
    let h = '<div class="dim">流体车厢：挂在车头后随列车移动，可运输任意一种流体（容量 ' + FLUID_WAGON_CAP + '）。可用流体泵从侧边装卸，或面板手动加/取。</div><div class="sec">装载</div>';
    if (!fc || fc.count <= 0) h += '<div class="dim">车厢是空的</div>';
    else h += '<div class="row"><span>' + (ITEMS[fc.item] ? ITEMS[fc.item].name : fc.item) + '</span><b>' + fc.count + ' / ' + FLUID_WAGON_CAP + '</b></div>';
    // 手动装卸流体下拉
    const opts = FLUIDS.map(f => '<option value="' + f + '">' + (ITEMS[f] ? ITEMS[f].name : f) + '</option>').join('');
    h += '<div class="rows"><div class="row"><span>装载流体</span><select id="fw-fluid">' + opts + '</select>' +
      '<button data-act="fw-add">加1000</button><button data-act="fw-take">取1000</button></div></div>';
    return h;
  },
  live() { return ''; },
  tip() { return 'g'; },
  onAction(btn, e) {
    if (btn === 'fw-add' || btn === 'fw-take') {
      const sel = document.getElementById('fw-fluid');
      const fid = sel ? sel.value : 'water';
      if (btn === 'fw-add') {
        if (!invCount(fid)) { toast('背包里没有该流体'); return true; }
        const n = e.addFluid(fid, 1000);
        if (n > 0) { invTake(fid, n); toast('已装入 ' + n + ' ' + (ITEMS[fid] ? ITEMS[fid].name : fid)); uiDirty = true; }
        else toast('车厢已满或流体不兼容');
      } else {
        const n = e.takeFluid(fid, 1000);
        if (n > 0) { invAdd(fid, n); toast('已取出 ' + n); uiDirty = true; }
        else toast('没有可取的流体');
      }
      return true;
    }
    return false;
  }
};

// ===== 炮兵车厢面板 =====
DEVICE_PANEL['artillery-wagon'] = {
  html(e) {
    let h = '<div class="dim">炮兵车厢：挂在车头后随列车移动，行驶/停靠期间自动轰击射程内远处敌人（' + ARTILLERY_RANGE + ' 格），命中造成 ' + ARTILLERY_DMG + ' 点大范围爆炸（对齐《异星工厂》Artillery wagon）。</div><div class="sec">炮弹</div>';
    h += '<div class="row"><span>炮兵炮弹</span><b>' + e.shells + ' / ' + ARTILLERY_WAGON_SHELLS + '</b></div>';
    const n = invCount('artillery-shell');
    if (n > 0) h += '<button data-action="feed" data-id="artillery-shell">装入炮弹 ×' + n + '</button>';
    if (e.shells > 0) h += '<button data-action="takeout" id="btn-aw-takeout">取出全部炮弹</button>';
    h += '<div class="status"></div>';
    return h;
  },
  live(e, api) {
    api.set('shells', e.shells + ' / ' + ARTILLERY_WAGON_SHELLS);
    api.toggle('#btn-aw-takeout', e.shells > 0, '取出全部炮弹 (' + e.shells + ')');
    if (e.shells <= 0) api.status('已暂停：无炮弹', 'warn');
    else api.status('待机：列车行驶/停靠时自动轰击敌人', 'ok');
  },
  tip(e) { return e.shells <= 0 ? '无炮弹，需装入炮弹' : '待机（炮弹 ×' + e.shells + '）'; }
};

// ===== 放置/拆除钩子（包装 addEnt/removeEnt，维护 railTiles 与列车编组）=====
const __railAddEnt = addEnt;
const __railRemoveEnt = removeEnt;
addEnt = function (e) {
  __railAddEnt(e);
  afterRailAdd(e);
};
removeEnt = function (e) {
  beforeRailRemove(e);
  __railRemoveEnt(e);
};

function afterRailAdd(e) {
  ensureRailGlobals();
  if (e instanceof Rail) registerRail(e.x, e.y);
  else if (e instanceof Locomotive || e instanceof CargoWagon) {
    // 车头/车厢放置：加入列车编组
    if (!e._inTrain) {
      addTrainCar(e, e.x, e.y);
      e._inTrain = true;
    }
  }
}

function beforeRailRemove(e) {
  if (e instanceof Rail) unregisterRail(e.x, e.y);
  else if (e instanceof Locomotive || e instanceof CargoWagon) {
    removeTrainCar(e);
    e._inTrain = false;
  }
}

// ===== 实体注册 =====
ENT_CLASSES['rail'] = Rail;
ENT_CLASSES['locomotive'] = Locomotive;
ENT_CLASSES['diesel-locomotive'] = DieselLocomotive;
ENT_CLASSES['cargo-wagon'] = CargoWagon;
ENT_CLASSES['fluid-wagon'] = FluidWagon;
ENT_CLASSES['artillery-wagon'] = ArtilleryWagon;
ENT_CLASSES['train-stop'] = TrainStop;
ENT_CLASSES['rail-signal'] = RailSignal;
ENT_CLASSES['rail-chain-signal'] = RailChainSignal;

// R 键可旋转车头（决定行进方向）
DEVICE_DIR_ROTATE['locomotive'] = true;
DEVICE_DIR_ROTATE['diesel-locomotive'] = true;
DEVICE_DIR_ROTATE['fluid-wagon'] = true;

// 放置规则
DEVICE_PLACE['rail'] = null;   // 铁轨放任何空地
DEVICE_PLACE['locomotive'] = (type, tx, ty) => railHas(tx, ty) ? { ok: true } : { ok: false };
DEVICE_PLACE['diesel-locomotive'] = (type, tx, ty) => railHas(tx, ty) ? { ok: true } : { ok: false };
DEVICE_PLACE['cargo-wagon'] = (type, tx, ty) => railHas(tx, ty) ? { ok: true } : { ok: false };
DEVICE_PLACE['fluid-wagon'] = (type, tx, ty) => railHas(tx, ty) ? { ok: true } : { ok: false };
DEVICE_PLACE['artillery-wagon'] = (type, tx, ty) => railHas(tx, ty) ? { ok: true } : { ok: false };
DEVICE_PLACE['train-stop'] = (type, tx, ty) => railHas(tx, ty) ? { ok: true } : { ok: false };
// 信号灯：放在铁轨旁任意一格（四周有铁轨即可）
DEVICE_PLACE['rail-signal'] = (type, tx, ty) => {
  const c = railConnAt(tx, ty);
  return (c.E || c.S || c.W || c.N) ? { ok: true } : { ok: false };
};
// 链式信号灯：同样放在铁轨旁（四周有铁轨即可）
DEVICE_PLACE['rail-chain-signal'] = (type, tx, ty) => {
  const c = railConnAt(tx, ty);
  return (c.E || c.S || c.W || c.N) ? { ok: true } : { ok: false };
};

// 读档后重建列车编组（由 main.js applySave 末尾调用）

// ===== 车站面板：配置自动装卸清单 =====
// 装卸循环：点击物品，状态在 [未选 → 装载(load) → 卸载(unload) → 未选] 间循环。
function trainStopPanelHtml(e) {
  let h = '<div class="dim">车站：列车停靠后自动装卸货。下方选择物品并设“装载/卸载”。</div>';
  // 车站名（用于列车自动调度路线引用）
  h += '<div class="sec">车站名（自动调度引用）</div>' +
    '<div class="rows"><div class="row"><input id="ts-name" type="text" maxlength="12" value="' + escHtml(e.displayName()) + '" placeholder="车站名">' +
    '<button data-act="ts-rename">重命名</button></div></div>' +
    '<div class="dim">给本站命名后，在车头面板的“自动调度路线”里把本站加入路线，列车即可按路线循环往返本站装卸。</div>';
  h += '<div class="sec">装载（箱子→车厢）</div><div class="rows">';
  if (!e.load || !e.load.length) h += '<div class="dim">未设置</div>';
  else for (const id of e.load) h += '<div class="row"><span>' + chip(id) + ' ' + ITEMS[id].name + '</span><button data-action="ts-unload" data-id="' + id + '">→卸</button><button data-action="ts-rm" data-id="' + id + '">✕</button></div>';
  h += '</div>';
  h += '<div class="sec">卸载（车厢→箱子）</div><div class="rows">';
  if (!e.unload || !e.unload.length) h += '<div class="dim">未设置</div>';
  else for (const id of e.unload) h += '<div class="row"><span>' + chip(id) + ' ' + ITEMS[id].name + '</span><button data-action="ts-load" data-id="' + id + '">→装</button><button data-action="ts-rm" data-id="' + id + '">✕</button></div>';
  h += '</div>';
  h += '<div class="sec">选择物品</div><div class="recgrid">';
  const choices = (typeof filterChoices === 'function' ? filterChoices() : []);
  for (const id of choices) {
    const state = (e.load && e.load.includes(id)) ? 'L' : (e.unload && e.unload.includes(id)) ? 'U' : '';
    h += '<button class="rcbtn ' + (state ? 'sel' : '') + '" data-action="ts-toggle" data-id="' + id + '" data-itemid="' + id + '">' +
      (state ? '<b>[' + state + ']</b>' : '') + '<img src="' + iconDataURL(id) + '">' + ITEMS[id].name + '</button>';
  }
  h += '</div>';
  h += '<div class="status"></div>';
  h += '<div class="dim">放置：把车站放在铁轨上，车站旁（3×3）放储物箱。列车停靠时，自动把“卸载”物品从车厢卸入箱子、把“装载”物品从箱子装入车厢。对齐《异星工厂》火车车站装卸。</div>';
  return h;
}
function trainStopPanelLive(e, api) {
  let n = (e.load ? e.load.length : 0) + (e.unload ? e.unload.length : 0);
  const sched = stationInSchedule(e);
  const parts = [];
  if (sched) parts.push('已纳入列车自动调度路线（蓝色光环标记）');
  if (n) parts.push('已配置 ' + n + ' 种装卸物品');
  else parts.push('未配置装卸（列车仅短暂停车）');
  api.status(parts.join(' · '), (sched ? 'ok' : n ? 'ok' : 'warn'));
}
function trainStopOnAction(act, btn) {
  const st = G.panelEnt;
  if (!st || !(st instanceof TrainStop)) return false;
  if (act === 'ts-rename') {
    const inp = document.getElementById('ts-name');
    if (inp && inp.value.trim()) {
      const name = inp.value.trim().slice(0, 12);
      st.name = name;
      // 车站改名后，所有调度路线中的旧名引用失效——同步各列车：若旧自动名被引用则跟随改名
      toast('车站已命名为「' + name + '」');
      uiDirty = true;
      return true;
    }
    return true;
  }
  const id = btn && btn.dataset ? btn.dataset.id : null;
  if (!id) return false;
  if (act === 'ts-rm') {
    st.load = (st.load || []).filter(x => x !== id);
    st.unload = (st.unload || []).filter(x => x !== id);
    return true;
  }
  if (act === 'ts-load') {
    st.load = (st.load || []).filter(x => x !== id);
    if (!st.load.includes(id)) st.load.push(id);
    st.unload = (st.unload || []).filter(x => x !== id);
    return true;
  }
  if (act === 'ts-unload') {
    st.unload = (st.unload || []).filter(x => x !== id);
    if (!st.unload.includes(id)) st.unload.push(id);
    st.load = (st.load || []).filter(x => x !== id);
    return true;
  }
  if (act === 'ts-toggle') {
    // 循环：未选 → 装载 → 卸载 → 未选
    if (st.load && st.load.includes(id)) {
      st.load = st.load.filter(x => x !== id);
      if (!st.unload.includes(id)) st.unload.push(id);
    } else if (st.unload && st.unload.includes(id)) {
      st.unload = st.unload.filter(x => x !== id);
    } else {
      if (!st.load.includes(id)) st.load.push(id);
    }
    return true;
  }
  return false;
}
DEVICE_PANEL['train-stop'] = { html: trainStopPanelHtml, live: trainStopPanelLive, tip: () => '车站（列车停靠装卸）', onAction: trainStopOnAction };
DEVICE_STATUS['train-stop'] = () => 'g';
function rebuildTrains() {
  G.trains = [];
  G.railTiles = new Set();
  for (const e of G.ents) {
    if (e._dead) continue;
    if (e instanceof Rail) registerRail(e.x, e.y);
  }
  for (const e of G.ents) {
    if (e._dead) continue;
    if (e instanceof Locomotive || e instanceof CargoWagon) {
      e._inTrain = false;
      addTrainCar(e, e.x, e.y);
      e._inTrain = true;
    }
  }
}
