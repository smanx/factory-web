'use strict';

// ===== 铁路运输（对齐《异星工厂》Railway）=====
// 组成：
//   Rail 铁轨（1×1）：相邻铁轨/车站自动连接成轨道网，可拖动连续铺设
//   TrainStop 车站：铺在轨道上的命名停靠点，加入机车计划表后列车到站自动停车
//   Train 列车：机车头 + 若干货运车厢组成的复合实体（每节车厢各占一格），
//     沿轨道 BFS 寻路、按计划表在车站间循环往返；停站时机械臂可装卸货物，
//     前方轨道被其他列车占用时自动制动排队（简化版信号系统）。

// ===== 轨道连通性 =====
// 轨道被列车压住时，透过列车查到被压的铁轨/车站（列车 _disp 表）。
function isTrackAt(x, y) {
  let e = entAt(x, y);
  if (!e) return false;
  if (e.isTrack) return true;
  if (typeof Train === 'function' && e instanceof Train && e._disp) {
    const d = e._disp.get(entKey(x, y));
    return !!(d && d.isTrack && !d._dead);
  }
  return false;
}
function trackLinks(x, y) {
  const links = [];
  for (let d = 0; d < 4; d++) if (isTrackAt(x + DX[d], y + DY[d])) links.push(d);
  return links;
}
function stopNameAt(x, y) {
  let e = entAt(x, y);
  if (e && typeof Train === 'function' && e instanceof Train && e._disp)
    e = e._disp.get(entKey(x, y)) || null;
  return (e && e.stopName) ? e.stopName : null;
}

// ===== 铁轨 =====
// 轨道被列车压住时网格键归列车；轨道后放置/读档还原时把占格还给车（顺序无关）。
function railReclaimFromTrains(self) {
  for (const t of G.ents) {
    if (t === self || t._dead || !(t instanceof Train)) continue;
    for (const c of t.cars) {
      if (c.x >= self.x && c.x < self.x + self.w && c.y >= self.y && c.y < self.y + self.h) {
        const k = entKey(c.x, c.y);
        t._disp.set(k, self);
        G.grid.set(k, t);
      }
    }
  }
}
class Rail extends Entity {
  constructor(type, x, y) {
    super(type || 'rail', x, y);
    this.isTrack = true;
  }
  afterAdd() { railReclaimFromTrains(this); }
}

// ===== 车站：铺在轨道上的命名停靠点 =====
class TrainStop extends Entity {
  constructor(type, x, y) {
    super(type || 'train-stop', x, y);
    this.isTrack = true;
    this.stopName = defaultStopName();   // 新放置自动编号（读档时被存档名覆盖）
  }
  afterAdd() { railReclaimFromTrains(this); }
  serialize() { const s = super.serialize(); s.stopName = this.stopName; return s; }
  blueprint() { const s = super.blueprint(); s.stopName = this.stopName; return s; }
  static restore(s) {
    const e = super.restore(s);
    e.stopName = s.stopName || '车站';
    return e;
  }
}

// 全部已命名的车站名集合（计划表下拉联想用）
function allStopNames() {
  const names = [];
  for (const e of G.ents) {
    if (e._dead || !(e instanceof TrainStop)) continue;
    if (names.indexOf(e.stopName) < 0) names.push(e.stopName);
  }
  return names;
}
function defaultStopName() {
  let n = 1;
  const used = new Set(allStopNames());
  while (used.has('车站' + n)) n++;
  return '车站' + n;
}

// ===== 轨道寻路（BFS）：从 (sx,sy) 出发找同名车站，返回途经格序列（含终点格）=====
// 途中被其他列车占用的格子视为不可通行（终点车站除外），天然避免对向列车对穿。
function findRailPath(sx, sy, name) {
  const startKey = entKey(sx, sy);
  const prev = new Map([[startKey, 0]]);
  const queue = [[sx, sy]];
  let qi = 0;
  while (qi < queue.length) {
    const [cx, cy] = queue[qi++];
    for (let d = 0; d < 4; d++) {
      const nx = cx + DX[d], ny = cy + DY[d];
      const k = entKey(nx, ny);
      if (prev.has(k)) continue;
      if (!isTrackAt(nx, ny)) continue;
      // 目的地：同名车站（允许终点被其他列车占用——到站前它会离开或排队）
      if (stopNameAt(nx, ny) === name) {
        const path = [[nx, ny]];
        let ck = entKey(cx, cy);
        while (ck !== startKey && ck !== 0) {
          path.push([((ck >> 16) & 0xffff) - ENT_KEY_OFF, (ck & 0xffff) - ENT_KEY_OFF]);
          ck = prev.get(ck) || 0;
        }
        path.reverse();
        return path;
      }
      // 途中格子被其他列车占用则绕行/不通
      const occ = entAt(nx, ny);
      if (occ instanceof Train && occ !== G._pathSelf) continue;
      prev.set(k, entKey(cx, cy));
      queue.push([nx, ny]);
    }
  }
  return null;
}

// ===== 列车（复合实体：车头锚点 x,y = 第 0 节车厢所在格）=====
const TRAIN_STOP_EPS = 0.03;

class Train extends Entity {
  constructor(type, x, y) {
    super(type || 'locomotive', x, y);
    this.cars = [{ type: type === 'cargo-wagon' ? 'cargo-wagon' : 'locomotive', x, y }];
    this.schedule = [];   // [{name, cond:'time'|'full'|'empty'|'any', wait:秒}]
    this.si = 0;
    this.state = 'idle';  // idle | enroute | loading
    this.speed = 0;
    this.segD = 0;        // 当前段（trail[0]→下一格）内的进度 0..1
    this.trail = [{ x, y }];   // 已驶过的格子链（车头在最前）
    this.path = null;     // 前方路径（不含当前段起点），末元素为目的地格
    this.pathName = null;
    this.waitT = 0;
    this.lastChange = 0;  // 最近一次货物变动时刻（"无装卸"条件用）
    this.retryT = 0;
    this.recheckT = 0;
    this.blocked = false;
    this.noFuel = false;
    this.fuelN = 0;
    this.burnLeft = 0;
    this.fuelType = 'coal';
    this.cargo = {};      // 全列货物池 item -> 数量（容量 = 车厢数 × WAGON_CAP）
    this.carPx = null;    // 每节车厢像素中心（update 时刷新，渲染用）
    this.bb = { x0: x, y0: y, x1: x, y1: y };
    this._cells = [];          // 已登记网格键的车厢格（空集：addEnt 后由 afterAdd 全量登记并记录被压轨道）
    this._disp = new Map();    // 被车厢压住的铁轨/车站（cellKey -> 实体），驶离时恢复
  }

  // ---- 结构 ----
  hasLoco() { return this.cars.some(c => c.type === 'locomotive'); }
  wagonCount() { return this.cars.reduce((a, c) => a + (c.type === 'cargo-wagon' ? 1 : 0), 0); }
  cargoSpace() { return this.wagonCount() * WAGON_CAP - this.totalCargo(); }
  totalCargo() { let n = 0; for (const k in this.cargo) n += this.cargo[k]; return n; }
  halted() { return this.speed < 0.05; }
  updateBB() {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const c of this.cars) {
      x0 = Math.min(x0, c.x); y0 = Math.min(y0, c.y);
      x1 = Math.max(x1, c.x); y1 = Math.max(y1, c.y);
    }
    this.bb.x0 = x0; this.bb.y0 = y0; this.bb.x1 = x1; this.bb.y1 = y1;
  }
  // 复合实体网格注册：每节车厢所在格都指向本实体；被压住的铁轨/车站记入 _disp，
  // 车厢驶离或列车拆除时原样恢复（轨道永远在车底，不因通行而消失）。
  _registerCarCell(x, y) {
    const k = entKey(x, y);
    const cur = G.grid.get(k);
    if (cur && cur !== this && !cur._dead) this._disp.set(k, cur);
    G.grid.set(k, this);
  }
  _unregisterCarCell(x, y) {
    const k = entKey(x, y);
    if (G.grid.get(k) !== this) { this._disp.delete(k); return; }
    const d = this._disp.get(k);
    if (d && !d._dead) { G.grid.set(k, d); this._disp.delete(k); }
    else G.grid.delete(k);
  }
  _syncCarCells() {
    const want = this.cars.map(c => [c.x, c.y]);
    for (const old of this._cells)
      if (!want.some(w => w[0] === old[0] && w[1] === old[1])) this._unregisterCarCell(old[0], old[1]);
    for (const w of want)
      if (!this._cells.some(o => o[0] === w[0] && o[1] === w[1])) this._registerCarCell(w[0], w[1]);
    this._cells = want;
  }
  afterAdd() { this._syncCarCells(); this.updateBB(); }
  beforeRemove() {
    for (const c of this.cars) this._unregisterCarCell(c.x, c.y);
    this._disp.clear();
  }

  // 挂接车厢：只允许接在车尾或车头（保持运动链相邻连续）
  attachCar(type, tx, ty) {
    const adj = c => Math.abs(c.x - tx) + Math.abs(c.y - ty) === 1;
    if (!this.cars.length || adj(this.cars[this.cars.length - 1])) {
      this.cars.push({ type, x: tx, y: ty });
    } else if (adj(this.cars[0])) {
      this.cars.unshift({ type, x: tx, y: ty });
      this.x = tx; this.y = ty;
    } else return false;
    this._syncCarCells();
    this.resetMotion();
    return true;
  }
  // 拆走指定格上的那节车厢；返回返还清单（含溢出货物）。
  // 拆中间车厢时把后段拆成一列新列车（对齐《异星工厂》拆分编组语义）。
  removeCarAt(tx, ty) {
    const i = this.cars.findIndex(c => c.x === tx && c.y === ty);
    if (i < 0) return [];
    const car = this.cars[i];
    const refund = [[car.type, 1]];
    this.cars.splice(i, 1);
    if (!this.cars.length) { removeEnt(this); return refund; }
    // 容量缩水：超出新容量的货物直接退回
    let total = this.totalCargo();
    const cap = this.wagonCount() * WAGON_CAP;
    if (total > cap) {
      for (const k of Object.keys(this.cargo)) {
        const take = Math.min(this.cargo[k], total - cap);
        if (take > 0) { refund.push([k, take]); this.cargo[k] -= take; total -= take; }
        if (this.cargo[k] <= 0) delete this.cargo[k];
        if (total <= cap) break;
      }
    }
    if (i === 0) { this.x = this.cars[0].x; this.y = this.cars[0].y; }
    this.resetMotion();
    // 拆的是中间车厢：其后段拆出一列新列车（原地待命、无计划表）
    if (i > 0 && i < this.cars.length) {
      const rear = this.cars.splice(i);
      if (rear.length) {
        const nt = new Train(rear[0].type, rear[0].x, rear[0].y);
        nt.dir = this.dir;
        nt.applyDir();
        nt.cars = rear;
        nt.x = rear[0].x; nt.y = rear[0].y;
        addEnt(nt);
      }
    }
    return refund;
  }
  resetMotion() {
    this._syncCarCells();
    this.speed = 0; this.segD = 0;
    this.state = 'idle';
    this.trail = this.cars.map(c => ({ x: c.x, y: c.y }));
    this.path = null; this.pathName = null;
    this.carPx = null;
    this.updateBB();
  }

  // ---- 计划表 ----
  invalidateRoute() { this.path = null; this.pathName = null; this.retryT = 0; this.recheckT = 0; }
  depart() {
    this.si = (this.si + 1) % Math.max(1, this.schedule.length);
    this.state = 'enroute';
    this.invalidateRoute();
  }
  manualDepart() {
    if (this.state === 'loading') this.depart();
    else if (this.hasLoco() && this.schedule.length) { this.state = 'enroute'; this.invalidateRoute(); }
  }
  arrive() {
    // 吸附到目的地格：把最后一段走完，让车头逻辑格恰好落在车站上
    if (this.path && this.path.length === 1) {
      const dst = this.path.shift();
      this.trail.unshift({ x: dst[0], y: dst[1] });
      if (this.trail.length > this.cars.length + 3) this.trail.pop();
    }
    this.segD = 0;
    this.state = 'loading';
    this.waitT = 0;
    this.speed = 0;
    this.lastChange = G.time;
    this.path = null;
    this.updateCarPositions();
  }
  condMet() {
    const e = this.schedule[this.si];
    if (!e) return true;
    const w = Math.max(0, +e.wait || 0);
    switch (e.cond) {
      case 'full': return this.cargoSpace() <= 0 || this.waitT >= Math.max(w, 30);
      case 'empty': return this.totalCargo() <= 0 || this.waitT >= Math.max(w, 30);
      case 'any': return (G.time - this.lastChange) >= w;
      default: return this.waitT >= w;
    }
  }

  // ---- 与世界的物品交互（仅在列车停下时可装卸，行驶中拒收拒出）----
  acceptsInsert(item) {
    if (!this.halted()) return false;
    if (TRAIN_FUEL_VALUES[item] !== undefined && this.fuelN < LOCO_FUEL_CAP) return true;
    return this.cargoSpace() > 0;
  }
  giveItem(item) {
    if (!this.halted()) return false;
    if (TRAIN_FUEL_VALUES[item] !== undefined && this.fuelN < LOCO_FUEL_CAP) {
      this.fuelN++; this.fuelType = item; return true;
    }
    if (this.cargoSpace() > 0) {
      this.cargo[item] = (this.cargo[item] || 0) + 1;
      this.lastChange = G.time;
      return true;
    }
    return false;
  }
  peekItem() {
    if (!this.halted()) return null;
    for (const k in this.cargo) if (this.cargo[k] > 0) return k;
    return null;
  }
  takeItem() {
    const it = this.peekItem();
    return it ? this.takeItemOf(it) : null;
  }
  countOf(item) { return this.halted() ? (this.cargo[item] || 0) : 0; }
  takeItemOf(item) {
    if (!this.halted() || !(this.cargo[item] > 0)) return null;
    this.cargo[item]--;
    if (this.cargo[item] <= 0) delete this.cargo[item];
    this.lastChange = G.time;
    return item;
  }
  takeAll() {
    if (!this.halted()) return [];
    const rows = [];
    for (const k of Object.keys(this.cargo)) rows.push([k, this.cargo[k]]);
    this.cargo = {};
    return rows;
  }
  contents() {
    const list = this.cars.map(c => [c.type, 1]);
    if (this.fuelN > 0) list.push([this.fuelType, this.fuelN]);
    for (const k in this.cargo) if (this.cargo[k] > 0) list.push([k, this.cargo[k]]);
    return list;
  }

  // ---- 运动学 ----
  // 链条点序（按弧长降序）：pts[0]=下一格(弧+1)，pts[1]=trail[0](弧0)，pts[k]=trail[k-1](弧-(k-2))。
  // 车头位于弧 segD∈[0,1)；距车头 d 格的车厢位于弧 segD-d。
  posAtPx(d) {
    const pts = [];
    let off = 0;   // pts[0] 的弧长：enroute 时 pts[0]=下一格(弧+1)，否则 pts[0]=trail[0](弧0)
    if (this.path && this.path.length && this.state === 'enroute') {
      const n0 = this.path[0];
      pts.push(Array.isArray(n0) ? { x: n0[0], y: n0[1] } : n0);
      off = 1;
    }
    for (const c of this.trail) pts.push(c);
    const s = this.segD - d;   // 目标点的弧长
    // 弧 a(k)=off-k：目标落在 pts[k+1](弧off-k-1) → pts[k](弧off-k) 段内，k=floor(off-s)
    let k = Math.floor(off - s);
    k = Math.max(0, Math.min(pts.length - 2, k));
    const t = Math.max(0, Math.min(1, s + k + 1 - off));
    const ahead = pts[k], behind = pts[k + 1];
    return {
      x: (behind.x + (ahead.x - behind.x) * t + 0.5) * TILE,
      y: (behind.y + (ahead.y - behind.y) * t + 0.5) * TILE,
      dx: ahead.x - behind.x, dy: ahead.y - behind.y
    };
  }
  updateCarPositions() {
    if (!this.carPx || this.carPx.length !== this.cars.length) this.carPx = this.cars.map(() => null);
    for (let i = 0; i < this.cars.length; i++) this.carPx[i] = this.posAtPx(i);
    // 网格占格跟随实际位置
    let moved = false;
    for (let i = 0; i < this.cars.length; i++) {
      const p = this.carPx[i];
      const cx = Math.floor(p.x / TILE), cy = Math.floor(p.y / TILE);
      if (this.cars[i].x !== cx || this.cars[i].y !== cy) { this.cars[i].x = cx; this.cars[i].y = cy; moved = true; }
    }
    if (moved) { this._syncCarCells(); this.updateBB(); this.x = this.cars[0].x; this.y = this.cars[0].y; }
  }

  computePath() {
    const tgt = this.schedule[this.si];
    if (!tgt) { this.state = 'idle'; return; }
    const head = this.cars[0];
    if (stopNameAt(head.x, head.y) === tgt.name) { this.arrive(); return; }
    G._pathSelf = this;
    const p = findRailPath(head.x, head.y, tgt.name);
    G._pathSelf = null;
    this.path = p;
    this.pathName = tgt.name;
    if (p && p.length) { this.state = 'enroute'; this.recheckT = 0.7; }
    else { this.path = null; this.retryT = 1.2; }   // 找不到路：稍后重试
  }
  pathValid() {
    if (!this.path) return false;
    for (const [x, y] of this.path) {
      const e = entAt(x, y);
      if (!e || !e.isTrack) return false;
    }
    return true;
  }

  update(dt) {
    if (this.state === 'loading') {
      this.speed = 0;
      this.waitT += dt;
      this.updateCarPositions();
      if (this.condMet()) this.depart();
      return;
    }
    if (!this.hasLoco() || !this.schedule.length) {
      // 无机车 / 无计划：原地待命
      this.speed = Math.max(0, this.speed - TRAIN_BRAKE * dt);
      this.advance(dt);
      return;
    }
    // 保持路由有效
    this.retryT -= dt; this.recheckT -= dt;
    if (!this.path) {
      if (this.retryT <= 0 || this.pathName !== this.schedule[this.si].name) this.computePath();
      if (!this.path) { this.speed = Math.max(0, this.speed - TRAIN_BRAKE * dt); this.advance(dt); return; }
    } else if (this.pathName !== this.schedule[this.si].name || this.recheckT <= 0) {
      if (this.pathName !== this.schedule[this.si].name || !this.pathValid()) this.computePath();
      else this.recheckT = 0.7;
    }
    if (!this.path) { this.advance(dt); return; }

    // 目标速度：按剩余距离的制动抛物线限速；前方有车或缺燃料则刹停
    const remain = (this.path.length - 1) + (1 - this.segD);
    let desired = Math.min(TRAIN_SPEED_MAX, Math.sqrt(2 * TRAIN_BRAKE * Math.max(0, remain)));
    const nextCell = this.path[0];
    const occ = nextCell ? entAt(nextCell[0], nextCell[1]) : null;
    this.blocked = !!(occ instanceof Train && occ !== this);
    if (this.blocked || this.noFuel) desired = 0;
    // 燃料消耗（速度越快烧得越旺；编组越长越费油）
    const mass = 1 + 0.25 * (this.cars.length - 1);
    if (desired > 0.01 || this.speed > 0.01) {
      if (this.burnLeft <= 0 && this.fuelN > 0) {
        this.fuelN--;
        this.burnLeft += TRAIN_FUEL_VALUES[this.fuelType] || COAL_ENERGY;
      }
      if (this.burnLeft > 0) this.burnLeft -= dt * mass * (0.35 + 0.65 * this.speed / TRAIN_SPEED_MAX);
      this.noFuel = this.burnLeft <= 0 && this.fuelN <= 0;
      if (this.noFuel) desired = 0;
    }
    const dv = desired - this.speed;
    this.speed += Math.max(-TRAIN_BRAKE * dt, Math.min(TRAIN_ACCEL * dt, dv));
    if (this.speed < 0.01 && remain <= TRAIN_STOP_EPS * 4) {
      // 到站：精确停靠
      this.arrive();
      return;
    }
    this.advance(dt);
  }
  advance(dt) {
    if (this.speed <= 0) { this.updateCarPositions(); return; }
    this.segD += this.speed * dt;
    let guard = 0;
    while (this.segD >= 1 && guard++ < 8) {
      this.segD -= 1;
      const nxt = this.path ? this.path.shift() : null;
      if (nxt) {
        this.trail.unshift({ x: nxt[0], y: nxt[1] });
        if (this.trail.length > this.cars.length + 3) this.trail.pop();
      } else { this.segD = 0; break; }
      if (!this.path || !this.path.length) { this.segD = 0; this.arrive(); return; }   // 驶入终点格
    }
    this.updateCarPositions();
  }

  // ---- 序列化 ----
  serialize() {
    const s = super.serialize();
    s.cars = this.cars.map(c => ({ type: c.type, x: c.x, y: c.y }));
    s.schedule = this.schedule.map(e => ({ name: e.name, cond: e.cond, wait: +e.wait || 0 }));
    s.si = this.si;
    s.fuelN = this.fuelN; s.burnLeft = this.burnLeft; s.fuelType = this.fuelType;
    s.cargo = this.cargo;
    return s;
  }
  static restore(s) {
    const t = new Train(s.type, s.x, s.y);
    t.dir = s.dir | 0;
    if (Array.isArray(s.cars) && s.cars.length) {
      t.cars = s.cars.map(c => ({ type: c.type === 'cargo-wagon' ? 'cargo-wagon' : 'locomotive', x: c.x | 0, y: c.y | 0 }));
      t.x = t.cars[0].x; t.y = t.cars[0].y;
    }
    t.schedule = Array.isArray(s.schedule)
      ? s.schedule.filter(e => e && e.name).map(e => ({ name: '' + e.name, cond: ['time', 'full', 'empty', 'any'].indexOf(e.cond) >= 0 ? e.cond : 'time', wait: Math.max(0, +e.wait || 5) }))
      : [];
    t.si = (s.si | 0) % Math.max(1, t.schedule.length || 1);
    t.fuelN = Math.max(0, s.fuelN | 0);
    t.burnLeft = +s.burnLeft || 0;
    t.fuelType = TRAIN_FUEL_VALUES[s.fuelType] ? s.fuelType : 'coal';
    t.cargo = {};
    for (const k in (s.cargo || {})) if (s.cargo[k] > 0) t.cargo[k] = s.cargo[k] | 0;
    t.resetMotion();
    return t;
  }
}

// ===== 放置辅助：把机车/车厢放到轨道上（替换被压住的铁轨/车站并返还）=====
// 返回 true 表示该放置已处理（成功或明确失败）；false 交回通用流程提示。
function railwayTryPlace(type, tx, ty) {
  if (type !== 'locomotive' && type !== 'cargo-wagon') return false;
  const under = entAt(tx, ty);
  if (!under || !under.isTrack) { toast('机车和车厢必须放在铁轨或车站上'); return true; }
  if (!withinReach(tx, ty)) return true;
  const infinite = !!(G.dbg && G.dbg.infinite);
  if (!infinite && invCount(type) < 1) {
    toast('背包里没有' + ITEMS[type].name + '了');
    G.sel = -1; G.quickSel = null; refreshHotbar();
    return true;
  }
  // 相邻已有列车 → 挂接为新车厢（只允许首尾挂接；先校验再拆轨道，失败不消耗）
  let host = null, hostOk = false;
  for (let d = 0; d < 4; d++) {
    const n = entAt(tx + DX[d], ty + DY[d]);
    if (n instanceof Train && !n._dead) { host = n; break; }
  }
  if (host) {
    const adjTail = Math.abs(host.cars[host.cars.length - 1].x - tx) + Math.abs(host.cars[host.cars.length - 1].y - ty) === 1;
    const adjHead = Math.abs(host.cars[0].x - tx) + Math.abs(host.cars[0].y - ty) === 1;
    hostOk = adjTail || adjHead;
    if (!hostOk) { toast('车厢只能挂在列车的车头或车尾'); return true; }
  }
  removeEnt(under);
  invAdd(under.type, 1);   // 返还被压住的铁轨/车站
  if (host) host.attachCar(type, tx, ty);
  else {
    const tr = new Train(type, tx, ty);
    tr.dir = G.ghostDir;
    tr.applyDir();
    addEnt(tr);
  }
  if (!infinite) invTake(type, 1);
  refreshHotbar();
  return true;
}

// ===== 拆除辅助：只拆被点击的那节车厢（整车随红图删除走通用 contents 流程）=====
// 返回非 null 表示已处理（refund 为返还清单）。
function railwayDeconstruct(e, tx, ty) {
  if (!(e instanceof Train)) return null;
  return e.removeCarAt(tx, ty);
}

// ===== 渲染 =====
function drawRailBase(ctx, gx, gy, links, defaultHoriz) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  ctx.fillStyle = '#4a463f';
  ctx.fillRect(px + 2, py + 2, TILE - 4, TILE - 4);
  ctx.fillStyle = '#55514a';
  ctx.fillRect(px + 4, py + 4, TILE - 8, TILE - 8);
  // 枕木
  ctx.strokeStyle = '#5d4a33';
  ctx.lineWidth = 3;
  const horiz = defaultHoriz;
  const tieDir = horiz ? 0 : 1;
  ctx.beginPath();
  for (let i = -1; i <= 1; i += 2) {
    if (tieDir === 0) { ctx.moveTo(cx + i * 9, cy - 9); ctx.lineTo(cx + i * 9, cy + 9); }
    else { ctx.moveTo(cx - 9, cy + i * 9); ctx.lineTo(cx + 9, cy + i * 9); }
  }
  ctx.stroke();
  // 钢轨：朝每个连接方向画两条平行线
  const dirs = links.length ? links : (horiz ? [0, 2] : [1, 3]);
  ctx.strokeStyle = '#b9bfc9';
  ctx.lineWidth = 2;
  ctx.beginPath();
  for (const d of dirs) {
    const vx = DX[d], vy = DY[d];
    const ox = vy !== 0 ? 3 : 0, oy = vx !== 0 ? 3 : 0;
    ctx.moveTo(cx + ox * (vx === 0 ? 1 : 0), cy + oy);
    ctx.lineTo(cx + vx * TILE / 2 + (vx === 0 ? ox : 0), cy + vy * TILE / 2 + (vy === 0 ? oy : 0));
    ctx.moveTo(cx - ox * (vx === 0 ? 1 : 0), cy - oy);
    ctx.lineTo(cx + vx * TILE / 2 - (vx === 0 ? ox : 0), cy + vy * TILE / 2 - (vy === 0 ? oy : 0));
  }
  ctx.stroke();
}

function drawRail(ctx, e, gx, gy) {
  drawRailBase(ctx, gx, gy, trackLinks(gx, gy), (e.dir & 1) === 0);
}

function drawTrainStop(ctx, e, gx, gy) {
  drawRailBase(ctx, gx, gy, trackLinks(gx, gy), true);
  const px = gx * TILE, py = gy * TILE;
  // 站台：南半侧的黄黑警示条站台
  ctx.fillStyle = '#6f675a';
  rr(ctx, px + 2, py + TILE / 2, TILE - 4, TILE / 2 - 2, 3); ctx.fill();
  ctx.fillStyle = '#e0b23c';
  ctx.fillRect(px + 4, py + TILE / 2 + 2, TILE - 8, 4);
  ctx.fillStyle = '#20242b';
  for (let i = 0; i < 3; i++) ctx.fillRect(px + 6 + i * 9, py + TILE / 2 + 2, 5, 4);
  // 名牌
  ctx.fillStyle = '#e8ecf2';
  ctx.font = 'bold 10px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText((e.stopName || '车站').slice(0, 5), px + TILE / 2, py + 7);
}

function drawCarBody(ctx, px, py, ang, bodyC, roofC) {
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(ang);
  // 底盘阴影
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  rr(ctx, -13, -9, 27, 19, 5); ctx.fill();
  // 车体
  ctx.fillStyle = bodyC;
  rr(ctx, -14, -10, 28, 20, 5); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.45)';
  ctx.lineWidth = 1.6;
  rr(ctx, -14, -10, 28, 20, 5); ctx.stroke();
  // 顶盖条纹
  ctx.fillStyle = roofC;
  rr(ctx, -10, -6, 18, 12, 3); ctx.fill();
  ctx.restore();
}

function drawTrain(ctx, e) {
  if (!e.carPx) {
    // 幽灵预览 / 未初始化：按逻辑格绘制
    e.carPx = e.cars.map(c => ({ x: (c.x + 0.5) * TILE, y: (c.y + 0.5) * TILE, dx: DX[e.dir], dy: DY[e.dir] }));
  }
  for (let i = e.cars.length - 1; i >= 0; i--) {
    const p = e.carPx[i];
    const isLoco = e.cars[i].type === 'locomotive';
    const ang = Math.atan2(p.dy || DY[e.dir], p.dx || DX[e.dir]);
    if (isLoco) {
      drawCarBody(ctx, p.x, p.y, ang, '#b3402e', '#7c2a20');
      // 驾驶室窗 + 前灯
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(ang);
      ctx.fillStyle = '#cfe4ef';
      rr(ctx, 3, -7, 7, 14, 2); ctx.fill();
      ctx.fillStyle = e.speed > 0.1 ? '#ffe98a' : '#8a8578';
      ctx.beginPath(); ctx.arc(15, 0, 2.6, 0, 7); ctx.fill();
      // 烟囱冒烟
      if (e.burnLeft > 0 && e.speed > 0.2) {
        const puff = ((G.time * 2.2) % 1);
        ctx.globalAlpha = (1 - puff) * 0.55;
        ctx.fillStyle = '#c9ccd2';
        ctx.beginPath();
        ctx.arc(-6 - puff * 10, -12 - puff * 8, 3 + puff * 3.5, 0, 7);
        ctx.fill();
        ctx.globalAlpha = 1;
      }
      ctx.restore();
    } else {
      drawCarBody(ctx, p.x, p.y, ang, '#7a6a52', '#5d5040');
      // 载货指示条
      const fill = Math.min(1, e.totalCargo() / Math.max(1, e.wagonCount() * WAGON_CAP));
      if (fill > 0.01) {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(ang);
        ctx.fillStyle = '#20242b';
        ctx.fillRect(-12, -13, 24, 3.4);
        ctx.fillStyle = '#57b95c';
        ctx.fillRect(-12, -13, 24 * fill, 3.4);
        ctx.restore();
      }
    }
  }
  // 停站装卸提示光圈
  if (e.state === 'loading') {
    const h = e.cars[0];
    ctx.strokeStyle = 'rgba(255,220,120,' + (0.35 + 0.25 * Math.sin(G.time * 5)).toFixed(2) + ')';
    ctx.lineWidth = 2;
    ctx.strokeRect(h.x * TILE + 3, h.y * TILE + 3, TILE - 6, TILE - 6);
  }
}

// ===== 面板 =====
const TRAIN_CONDS = [['time', '定时'], ['full', '装满发车'], ['empty', '卸空发车'], ['any', '无装卸延时']];
function trainCondName(c) { const f = TRAIN_CONDS.find(v => v[0] === c); return f ? f[1] : c; }

function schedRowsHtml(e) {
  let h = '';
  e.schedule.forEach((s, i) => {
    h += '<div class="sched-row">' +
      '<span class="sched-i">' + (i + 1) + '</span>' +
      '<input class="sched-name" data-sched="name" data-i="' + i + '" value="' + String(s.name).replace(/"/g, '&quot;') + '" maxlength="10" list="stop-names">' +
      '<select data-sched="cond" data-i="' + i + '">' +
      TRAIN_CONDS.map(c => '<option value="' + c[0] + '"' + (s.cond === c[0] ? ' selected' : '') + '>' + c[1] + '</option>').join('') +
      '</select>' +
      '<input class="sched-wait" data-sched="wait" data-i="' + i + '" type="number" min="0" max="600" step="1" value="' + (+s.wait || 0) + '">秒' +
      '<button data-action="sched-del" data-i="' + i + '" title="删除此站">✕</button>' +
      '</div>';
  });
  if (!e.schedule.length) h += '<div class="dim">计划表为空：添加至少两个车站名，列车才会自动往返。</div>';
  return h;
}

function trainPanelHtml(e) {
  let h = row('状态', '', 'st');
  h += row('燃料', '', 'fuel');
  h += '<button data-action="train-fuel">加入 5 煤</button>';
  h += row('载货', '', 'cargo');
  h += '<button data-action="train-unload">卸空全部货物</button>';
  h += '<div class="sec">计划表（顺序循环）</div>';
  h += '<datalist id="stop-names">' + allStopNames().map(n => '<option value="' + n + '">').join('') + '</datalist>';
  h += '<div id="sched-rows">' + schedRowsHtml(e) + '</div>';
  h += '<div class="sched-add"><input id="sched-name" list="stop-names" maxlength="10" placeholder="输入或选择车站名">' +
    '<button data-action="sched-add">＋ 添加车站</button></div>';
  h += '<button data-action="train-go">立即出发</button> ';
  h += '<button data-action="sched-clear">清空计划表</button>';
  h += '<div class="hint">列车沿铁轨自动寻路，按计划表顺序在同名车站间往返。停车条件：定时=停够秒数；装满/卸空=满足即走（超时兜底）；无装卸延时=持续 N 秒没有装卸就发车。前方轨道有车会自动刹车排队。机车需加煤，机械臂可自动补燃料与装卸货物。</div>';
  h += barHtml(0);
  h += '<div class="status"></div>';
  return h;
}

function trainPanelLive(e, api) {
  let st, kind = 'ok';
  if (!e.hasLoco()) { st = '缺少机车头：无法行驶'; kind = 'bad'; }
  else if (!e.schedule.length) { st = '未设置计划表：待命中（仍可手动装卸）'; kind = 'warn'; }
  else if (e.state === 'loading') {
    const s = e.schedule[e.si];
    st = '停靠「' + s.name + '」：' + trainCondName(s.cond) + ' ' + (Math.max(0, +s.wait || 0)).toFixed(0) + ' 秒（已等 ' + e.waitT.toFixed(0) + ' 秒）';
    kind = e.condMet() ? 'ok' : 'warn';
  }
  else if (e.blocked) { st = '前方轨道有列车，制动排队中'; kind = 'warn'; }
  else if (e.noFuel) { st = '燃料耗尽：请补充煤/固体燃料'; kind = 'bad'; }
  else if (e.state === 'enroute') {
    st = e.path ? ('行驶中 → 「' + (e.pathName || '?') + '」 ' + e.speed.toFixed(1) + ' 格/秒')
                : ('正在寻找通往「' + (e.pathName || e.schedule[e.si] && e.schedule[e.si].name || '?') + '」的路线…');
    kind = e.path ? 'ok' : 'warn';
  }
  else st = '待命中';
  api.status(st, kind);
  api.set('st', dimSpan(st));
  api.set('fuel', e.fuelN > 0 ? chip(e.fuelType || 'coal', e.fuelN) : dimSpan('空'));
  api.toggle('[data-action="train-fuel"]', invCount('coal') > 0 && e.fuelN < LOCO_FUEL_CAP, '加入 5 煤 (' + invCount('coal') + ')');
  api.set('cargo', e.totalCargo() > 0 ? countStr(e.cargo) : dimSpan('空'));
  api.prog(Math.min(100, (e.totalCargo() / Math.max(1, e.wagonCount() * WAGON_CAP)) * 100));
}

function trainOnAction(act, btn) {
  const e = G.panelEnt;
  if (!(e instanceof Train)) return false;
  if (act === 'train-fuel') {
    const n = Math.min(5, LOCO_FUEL_CAP - e.fuelN, invCount('coal'));
    if (n > 0) { invTake('coal', n); e.fuelN += n; e.fuelType = 'coal'; toast('已加入 ' + n + ' 煤'); uiDirty = true; }
    return true;
  }
  if (act === 'train-unload') {
    const rows = e.takeAll();
    if (rows.length) { for (const [id, n] of rows) invAdd(id, n); toast('已取回全部货物'); }
    uiDirty = true;
    return true;
  }
  if (act === 'train-go') { e.manualDepart(); return true; }
  if (act === 'sched-del') {
    e.schedule.splice(+btn.dataset.i, 1);
    e.si = 0;
    e.invalidateRoute();
    renderPanel(false);
    return true;
  }
  if (act === 'sched-add') {
    const inp = document.getElementById('sched-name');
    const name = inp && inp.value.trim();
    if (!name) { toast('请先输入要添加的车站名（可与地图上的车站同名）'); return true; }
    e.schedule.push({ name, cond: 'time', wait: 5 });
    if (e.schedule.length === 1) e.si = 0;
    e.invalidateRoute();
    renderPanel(false);
    return true;
  }
  if (act === 'sched-clear') {
    e.schedule = [];
    e.si = 0;
    e.invalidateRoute();
    renderPanel(false);
    return true;
  }
  return false;
}

function trainOnChange(ev) {
  const e = G.panelEnt;
  if (!(e instanceof Train)) return false;
  const t = ev.target;
  if (!t.matches || !t.matches('[data-sched]')) return false;
  const i = +t.dataset.i;
  const row = e.schedule[i];
  if (!row) return true;
  if (t.dataset.sched === 'name') row.name = t.value.trim().slice(0, 10);
  else if (t.dataset.sched === 'cond') row.cond = t.value;
  else if (t.dataset.sched === 'wait') row.wait = Math.max(0, +t.value || 0);
  e.invalidateRoute();
  return true;
}

function stopPanelHtml(e) {
  let h = row('车站名', '<input class="stop-rename" data-stop-rename="1" value="' + String(e.stopName || '').replace(/"/g, '&quot;') + '" maxlength="10">', '');
  h += row('停靠列车', '', 'dock');
  h += '<div class="hint">把此名字填进机车的计划表，列车就会停靠在这里。多座同名车站视为同一目的地（就近停靠）。机械臂可在列车停稳时装卸货物与煤。</div><div class="status"></div>';
  return h;
}
function stopPanelLive(e, api) {
  let docked = null;
  for (const t of G.ents) {
    if (t._dead || !(t instanceof Train)) continue;
    if (t.state === 'loading' && t.schedule[t.si] && t.schedule[t.si].name === e.stopName &&
        stopNameAt(t.cars[0].x, t.cars[0].y) === e.stopName) { docked = t; break; }
  }
  api.set('dock', docked
    ? '列车停靠中：编组 ' + docked.cars.length + ' 节，载货 ' + docked.totalCargo() + ' 件'
    : dimSpan('暂无列车停靠'));
}
function stopOnChange(ev) {
  const e = G.panelEnt;
  if (!(e instanceof TrainStop)) return false;
  if (ev.target.matches && ev.target.matches('[data-stop-rename]')) {
    e.stopName = ev.target.value.trim().slice(0, 10) || e.stopName;
    return true;
  }
  return false;
}

// ===== 注册 =====
ENT_CLASSES['rail'] = Rail;
ENT_CLASSES['train-stop'] = TrainStop;
ENT_CLASSES['locomotive'] = Train;
ENT_CLASSES['cargo-wagon'] = Train;
DEVICE_RENDER['rail'] = drawRail;
DEVICE_RENDER['train-stop'] = drawTrainStop;
DEVICE_RENDER['locomotive'] = drawTrain;
DEVICE_RENDER['cargo-wagon'] = drawTrain;
DEVICE_STATUS['locomotive'] = e => {
  if (!e.hasLoco() || e.noFuel) return 'r';
  if (e.state === 'loading') return e.condMet() ? 'g' : 'y';
  if (e.blocked) return 'y';
  return e.schedule.length ? 'g' : 'r';
};
DEVICE_STATUS['cargo-wagon'] = DEVICE_STATUS['locomotive'];
DEVICE_PLACE['locomotive'] = (type, tx, ty) => {
  const u = entAt(tx, ty);
  if (!u || !u.isTrack) return { ok: false };
  if (!withinReach(tx, ty)) return { ok: false };
  return { ok: true };
};
DEVICE_PLACE['cargo-wagon'] = DEVICE_PLACE['locomotive'];
const trainPanel = { html: trainPanelHtml, live: trainPanelLive, onAction: trainOnAction, onChange: trainOnChange };
DEVICE_PANEL['locomotive'] = trainPanel;
DEVICE_PANEL['cargo-wagon'] = trainPanel;
DEVICE_PANEL['train-stop'] = { html: stopPanelHtml, live: stopPanelLive, onChange: stopOnChange };
