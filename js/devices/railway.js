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
const LOCO_NUCLEAR_FUEL = 80000; // 单格核燃料提供的燃料量（约为火箭燃料的 5 倍，对齐《异星工厂》Nuclear fuel 为最高级车头燃料）
const LOCO_WOOD_FUEL = 100;    // 单格木材提供的燃料量（低效燃料，约为煤的 1/4，对齐《异星工厂》木可烧）
const LOCO_MAX_FUEL = 4000;    // 车头燃料能量池上限
const LOCO_MAX_UNITS = 10;     // 车头燃料槽可存燃料个数（煤/固体燃料合计）
const LOCO_COAL_PER = 1;       // 每格耗煤 1 单位
const WAGON_SLOTS = 10;        // 车厢槽位数
const WAGON_STACK = 100;       // 每槽容量
// 铁路产能无限科技：每次研究提升货运车厢槽位容量 +2（对齐《异星工厂》Rail productivity）
const RAIL_PRODUCTIVITY_SLOTS = 2; // 每级科技新增槽位数
function wagonSlots() { return WAGON_SLOTS + (typeof G !== 'undefined' && G.techProg && G.techProg['rail-productivity'] ? G.techProg['rail-productivity'] * RAIL_PRODUCTIVITY_SLOTS : 0); }
// 火车制动（对齐《异星工厂》Braking force 无限科技）：每级缩短停靠/让行等待时长，提升铁路吞吐。
function trainBrakeWait() {
  const base = TRAIN_STOP_WAIT;
  return (typeof brakingForceMult === 'function' ? base * brakingForceMult() : base);
}
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
    // 玩家正驾驶该车头：自动调度让位给手动驾驶，仅保持燃料/炮兵等刷新，不自动移动
    if (G.driving && G.driving.ent === head) {
      tr.wasStopped = false;
      tr.stopT = 0; tr.waitT = 0;
      continue;
    }
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
      const bw = trainBrakeWait();
      if (acted) tr.stopT = bw;
      else if (!tr.stopT) tr.stopT = bw;
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
  // 到达目标站所在格：停靠装卸，满足该站“等待条件”后前往下一站
  if (head.x === target.x && head.y === target.y) {
    trainAutoLoadUnload(tr, target);
    // 累计本站停留时间
    tr.waitT = (tr.waitT || 0) + dt;
    tr.stopT = Math.max(tr.stopT || 0, tr.waitT);
    tr.wasStopped = true;
    // 等待条件满足后发往路线下一站（循环）
    if (trainWaitMet(tr, tr.waitT)) {
      tr.routeIdx = (tr.routeIdx + 1) % tr.route.length;
      tr.waitT = 0;
      if (typeof playSfx === 'function') playSfx('train');
    }
    return true;
  }
  // 到站停留窗口（尚未驶离，等待下一格移动节拍）
  if (tr.waitT > 0) {
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
  head.fuel -= LOCO_COAL_PER * fuelConsumptionMult();
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
  head.fuel -= LOCO_COAL_PER * fuelConsumptionMult();
  // 车厢依次占据前一节车的旧位置
  for (let i = 1; i < tr.cars.length; i++) {
    const car = tr.cars[i];
    removeEntFromGrid(car);
    car.x = oldPos[i - 1].x; car.y = oldPos[i - 1].y;
    addEntToGrid(car);
  }
}

// 找到包含某车头/车厢的列车对象（玩家驾驶/乘坐时用）。找不到返回 null。
function findTrainOfCar(car) {
  if (!G.trains) return null;
  for (const tr of G.trains) if (tr.cars.indexOf(car) >= 0) return tr;
  return null;
}

// 玩家驾驶火车时：让整列车反向移动一格（车头后退、车厢反向依次跟进）。
// 以车尾为基准向“车尾当前朝向”前方移动，其余节依次继承前一节旧位置。
function moveTrainBack(tr) {
  const cars = tr.cars;
  if (!cars || !cars.length) return false;
  const head = cars[0];
  // 倒车方向 = 列车前进方向的反向（车头朝向不变，整列车沿反向平移一格，对齐《异星工厂》倒车）
  const backDir = (head.dir + 2) % 4;
  const bx = DX[backDir], by = DY[backDir];
  const tail = cars[cars.length - 1];
  const ntx = tail.x + bx, nty = tail.y + by;
  // 车尾目标格必须仍是轨道，且未被本列车其它节或其它列车占用
  if (!railHas(ntx, nty)) return false;
  for (const c of cars) if (c.x === ntx && c.y === nty) return false;
  if (trainOccupy(ntx, nty, head)) return false;
  const oldPos = cars.map(c => ({ x: c.x, y: c.y }));
  // 所有节整体平移一格（朝向不变）
  for (let i = 0; i < cars.length; i++) {
    const c = cars[i];
    removeEntFromGrid(c);
    c.x = oldPos[i].x + bx; c.y = oldPos[i].y + by;
    addEntToGrid(c);
  }
  if (head.fuel != null) head.fuel -= LOCO_COAL_PER * fuelConsumptionMult();
  if (typeof playSfx === 'function') playSfx('train');
  return true;
}

// 玩家驾驶火车时反转车头朝向（在轨道上掉头，对齐《异星工厂》按 R 反转车头）。
function reverseTrain(tr) {
  const head = tr.cars[0];
  if (!head) return;
  head.dir = (head.dir + 2) % 4;
  removeEntFromGrid(head); addEntToGrid(head);
  if (typeof playSfx === 'function') playSfx('train');
}

// 玩家驾驶火车时向前移动一格（复用 moveTrain，但带燃料检查与音效）。返回是否移动。
function moveTrainManual(tr) {
  const head = tr.cars[0];
  if (!head) return false;
  head.refuel();
  if ((head.fuel || 0) <= 0) return false;  // 无燃料无法前进
  const ox = head.x, oy = head.y;
  moveTrain(tr);
  if (head.x === ox && head.y === oy) return false; // 前方无轨/被占，未移动
  if (typeof playSfx === 'function') playSfx('train');
  return true;
}

// 目标格是否被除 head 自身列车外的其它列车占用（防重叠）
function trainOccupy(tx, ty, head) {
  const own = findTrainOfCar(head);
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
  const own = findTrainOfCar(head);
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
    this.fuelNuclear = 0; // 存核燃料个数（终极燃料，最高级优先烧）
    this.fuelWood = 0;   // 存木材个数（低效燃料，对齐《异星工厂》：车头可用木材烧）
    this.schedule = [];  // 自动调度路线：车站名数组（列车按此顺序循环行驶装卸）
  }
  giveItem(item) {
    if (item === 'nuclear-fuel' && this._fuelCount() < LOCO_MAX_UNITS) { this.fuelNuclear++; return true; }
    if (item === 'rocket-fuel' && this._fuelCount() < LOCO_MAX_UNITS) { this.fuelRocket++; return true; }
    if (item === 'coal' && this._fuelCount() < LOCO_MAX_UNITS) { this.fuelCoal++; return true; }
    if (item === 'solid-fuel' && this._fuelCount() < LOCO_MAX_UNITS) { this.fuelSolid++; return true; }
    if (item === 'wood' && this._fuelCount() < LOCO_MAX_UNITS) { this.fuelWood++; return true; }
    return false;
  }
  _fuelCount() { return (this.fuelCoal || 0) + (this.fuelSolid || 0) + (this.fuelRocket || 0) + (this.fuelNuclear || 0) + (this.fuelWood || 0); }
  // 能量池不足时从燃料槽取一单位填充（优先核燃料，其次火箭燃料，再固体燃料/煤，最后木材）
  refuel() {
    if (this.fuel >= LOCO_FUEL) return;
    if (this.fuelNuclear > 0) { this.fuelNuclear--; this.fuel = Math.min(LOCO_MAX_FUEL, this.fuel + LOCO_NUCLEAR_FUEL); }
    else if (this.fuelRocket > 0) { this.fuelRocket--; this.fuel = Math.min(LOCO_MAX_FUEL, this.fuel + LOCO_ROCKET_FUEL); }
    else if (this.fuelSolid > 0) { this.fuelSolid--; this.fuel = Math.min(LOCO_MAX_FUEL, this.fuel + LOCO_SOLID_FUEL); }
    else if (this.fuelCoal > 0) { this.fuelCoal--; this.fuel = Math.min(LOCO_MAX_FUEL, this.fuel + LOCO_FUEL); }
    else if (this.fuelWood > 0) { this.fuelWood--; this.fuel = Math.min(LOCO_MAX_FUEL, this.fuel + LOCO_WOOD_FUEL); }
  }
  countOf(item) {
    if (item === 'coal') return this.fuelCoal;
    if (item === 'solid-fuel') return this.fuelSolid;
    if (item === 'nuclear-fuel') return this.fuelNuclear;
    if (item === 'rocket-fuel') return this.fuelRocket;
    if (item === 'wood') return this.fuelWood;
    return 0;
  }
  takeItemOf(item) {
    if (item === 'coal' && this.fuelCoal > 0) { this.fuelCoal--; return 'coal'; }
    if (item === 'solid-fuel' && this.fuelSolid > 0) { this.fuelSolid--; return 'solid-fuel'; }
    if (item === 'nuclear-fuel' && this.fuelNuclear > 0) { this.fuelNuclear--; return 'nuclear-fuel'; }
    if (item === 'rocket-fuel' && this.fuelRocket > 0) { this.fuelRocket--; return 'rocket-fuel'; }
    if (item === 'wood' && this.fuelWood > 0) { this.fuelWood--; return 'wood'; }
    return null;
  }
  contents() {
    const list = [[this.type, 1]];
    if (this.fuelNuclear > 0) list.push(['nuclear-fuel', this.fuelNuclear]);
    if (this.fuelRocket > 0) list.push(['rocket-fuel', this.fuelRocket]);
    if (this.fuelSolid > 0) list.push(['solid-fuel', this.fuelSolid]);
    if (this.fuelCoal > 0) list.push(['coal', this.fuelCoal]);
    if (this.fuelWood > 0) list.push(['wood', this.fuelWood]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.fuel = this.fuel; s.fuelCoal = this.fuelCoal; s.fuelSolid = this.fuelSolid; s.fuelRocket = this.fuelRocket; s.fuelNuclear = this.fuelNuclear; s.fuelWood = this.fuelWood;
    s.schedule = this.schedule;
    return s;
  }
  blueprint() {
    const s = super.blueprint();
    s.fuel = this.fuel; s.fuelCoal = this.fuelCoal; s.fuelSolid = this.fuelSolid; s.fuelRocket = this.fuelRocket; s.fuelNuclear = this.fuelNuclear; s.fuelWood = this.fuelWood;
    s.schedule = this.schedule;
    return s;
  }
  static restore(s) {
    const e = super.restore(s);
    e.fuel = s.fuel | 0; e.fuelCoal = s.fuelCoal | 0; e.fuelSolid = s.fuelSolid | 0; e.fuelRocket = s.fuelRocket | 0; e.fuelNuclear = s.fuelNuclear | 0; e.fuelWood = s.fuelWood | 0;
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
    const total = this.fuelCoal + this.fuelSolid + this.fuelRocket + (this.fuelNuclear || 0);
    if (item === 'nuclear-fuel' && total < LOCO_MAX_UNITS) { this.fuelNuclear++; return true; }
    if (item === 'rocket-fuel' && total < LOCO_MAX_UNITS) { this.fuelRocket++; return true; }
    if (item === 'solid-fuel' && total < LOCO_MAX_UNITS) { this.fuelSolid++; return true; }
    return false;
  }
  refuel() {
    if (this.fuel >= LOCO_FUEL) return;
    if (this.fuelNuclear > 0) { this.fuelNuclear--; this.fuel = Math.min(LOCO_MAX_FUEL, this.fuel + LOCO_NUCLEAR_FUEL); }
    else if (this.fuelRocket > 0) { this.fuelRocket--; this.fuel = Math.min(LOCO_MAX_FUEL, this.fuel + LOCO_ROCKET_FUEL); }
    else if (this.fuelSolid > 0) { this.fuelSolid--; this.fuel = Math.min(LOCO_MAX_FUEL, this.fuel + LOCO_SOLID_FUEL); }
    // 内燃机车不吃煤，fuelCoal 恒为 0，不会走到煤分支
  }
  takeItemOf(item) {
    if (item === 'solid-fuel' && this.fuelSolid > 0) { this.fuelSolid--; return 'solid-fuel'; }
    if (item === 'nuclear-fuel' && this.fuelNuclear > 0) { this.fuelNuclear--; return 'nuclear-fuel'; }
    if (item === 'rocket-fuel' && this.fuelRocket > 0) { this.fuelRocket--; return 'rocket-fuel'; }
    return null;
  }
  contents() {
    const list = [[this.type, 1]];
    if (this.fuelNuclear > 0) list.push(['nuclear-fuel', this.fuelNuclear]);
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
    // 过滤槽（对齐《异星工厂》Cargo wagon filter slots）：每个槽位可设置一个过滤物，
    // 设置了过滤的槽只能装入该物品；未设过滤的空槽可装入任意物品。
    // 索引与车厢槽位一一对应，避免混合装载错位。
    this.filters = [];
  }
  slotFilter(i) { return (this.filters && this.filters[i]) || null; }
  setSlotFilter(i, id) {
    if (!this.filters) this.filters = [];
    while (this.filters.length <= i) this.filters.push(null);
    this.filters[i] = id || null;
    // 若清空过滤且该槽已装入与过滤冲突的物品，则不改动已有货物（仅约束后续装入）
  }
  // 槽位是否允许装入 item：空槽看其过滤；非空槽允许继续堆叠同种物品
  slotAccepts(i, item) {
    const flt = this.slotFilter(i);
    if (!flt) return true;                    // 未设过滤：允许任意物品
    return flt === item;                      // 设了过滤：仅允许该物品
  }
  giveItem(item) {
    if (item === 'logistic-robot') return false;
    // 先尝试堆叠到已有同种物品的槽位（槽位必须允许该物品，通常同种即允许）
    for (let i = 0; i < this.slots.length; i++) {
      const s = this.slots[i];
      if (s && s.item === item && s.count < stackSize(item) && this.slotAccepts(i, item)) { s.count++; return true; }
    }
    // 再寻找空槽：优先“设了过滤且匹配”的空槽，其次任意未设过滤的空槽；
    // 被其他过滤占用的槽（设了过滤但指向别的物品）不可用。
    const total = wagonSlots();
    let filtered = -1, free = -1;
    for (let i = 0; i < total; i++) {
      if (this.slots[i]) continue;                 // 已占用
      const flt = this.slotFilter(i);
      if (flt === item && filtered < 0) filtered = i;
      if (!flt && free < 0) free = i;
    }
    const idx = filtered >= 0 ? filtered : free;
    if (idx < 0) return false;                     // 满或仅剩被其他过滤占用的槽
    this.slots[idx] = { item, count: 1 };
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
    if (this.filters && this.filters.length) s.filters = this.filters.map(f => f || null);
    return s;
  }
  blueprint() {
    const s = super.blueprint();
    s.slots = [];
    if (this.filters && this.filters.length) s.filters = this.filters.map(f => f || null);
    return s;
  }
  static restore(s) {
    const e = super.restore(s);
    e.slots = (s.slots || []).map(x => ({ item: x.item, count: x.count }));
    e.filters = (s.filters || []).map(f => f || null);
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
    this.fluidFilter = null; // 流体过滤（对齐《异星工厂》Fluid wagon 过滤）：设置后仅接受该流体
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
  // 向车厢注入流体；返回实际注入量。若设置了流体过滤且与过滤不符则拒绝
  addFluid(fid, n) {
    if (this.fluidFilter && fid !== this.fluidFilter) return 0;
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
    if (this.fluidFilter) s.fluidFilter = this.fluidFilter;
    return s;
  }
  blueprint() {
    const s = super.blueprint();
    s.fluid = this.fluid;
    s.amount = this.amount;
    if (this.fluidFilter) s.fluidFilter = this.fluidFilter;
    return s;
  }
  static restore(s) {
    const e = super.restore(s);
    e.fluid = s.fluid || null;
    e.amount = s.amount | 0;
    e.fluidFilter = s.fluidFilter || null;
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
      if (d <= (typeof artilleryRange === 'function' ? artilleryRange() : ARTILLERY_RANGE) && d > 4 && d < bestD) { best = en; bestD = d; }
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

