'use strict';

// ===== 车站 TrainStop =====
// 对齐《异星工厂》Railway train stop：列车停靠后可自动装卸货。
// 车站可配置“装载（load）”与“卸载（unload）”的物品清单：
//   - 卸载：从列车车厢取出清单物品，存入车站旁 3×3 范围内的箱子；
//   - 装载：从车站旁箱子取出清单物品，装入列车车厢。
// 列车停靠期间持续装卸，装/卸完毕或超时后发车。
// 继承 CircuitNode（CircuitNode 亦是 Entity 子类）：车站可接入电路网络，
// 当有列车停靠本站时输出 signal-train 信号，供组合器/功率开关/告警音箱读取，
// 实现按列车到站自动化的调度（对齐《异星工厂》Train stop 电路信号）。
class TrainStop extends CircuitNode {
  constructor(type, x, y) {
    super(type, x, y);
    this.load = [];    // 要装入车厢的物品清单
    this.unload = [];  // 要从车厢卸出的物品清单
    this.name = '';    // 车站名（用于列车自动调度路线引用）
    this.readTrain = false;  // 是否把停靠列车所载物品/流体以信号输出到电路网络（对齐《异星工厂》车站“读取列车内容”）
  }
  // 是否有列车停靠本站（车头停在车站所在格且处于停靠状态）
  trainPresent() {
    return this.parkedTrain() !== null;
  }
  // 返回停靠在本站的列车对象（车头停在车站所在格）；无则返回 null
  parkedTrain() {
    if (!G.trains || !G.trains.length) return null;
    for (const tr of G.trains) {
      if (!tr || !tr.cars || !tr.cars.length) continue;
      const head = tr.cars[0];
      if (!head || head._dead) continue;
      if (head.x === this.x && head.y === this.y) return tr;
    }
    return null;
  }
  // 电路信号输出：有列车停靠时输出 signal-train=1（对齐《异星工厂》车站列车信号）；
  // 开启“读取列车内容”后，额外把停靠列车所有车厢所载物品/流体以物品信号输出到网络（对齐《异星工厂》车站 Read train contents）。
  outputCircuitSignals() {
    const tr = this.parkedTrain();
    if (!tr) return [];
    const out = [{ sig: 'signal-train', count: 1 }];
    if (!this.readTrain) return out;
    if (!tr.cars || !tr.cars.length) return out;
    for (const car of tr.cars) {
      if (!car || car._dead) continue;
      // 货运车厢：把每个槽位的物品汇总为信号（对齐原版：列车货物以物品信号输出）
      if (car instanceof CargoWagon && typeof car.slots !== 'undefined' && car.slots) {
        for (const st of car.slots) {
          if (!st || !st.item || !st.count) continue;
          const sig = { sig: st.item, count: st.count };
          out.push(sig);
        }
      }
      // 流体车厢：把所载流体以流体信号输出（对齐原版：流体车厢容量以流体信号输出）
      if (car instanceof FluidWagon && car.fluid) {
        out.push({ sig: car.fluid, count: car.amount });
      }
    }
    return out;
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
    s.readTrain = this.readTrain ? 1 : 0;
    return s;
  }
  static restore(s) {
    const st = super.restore(s);
    st.load = Array.isArray(s.load) ? s.load : [];
    st.unload = Array.isArray(s.unload) ? s.unload : [];
    st.name = s.name || '';
    st.readTrain = !!s.readTrain;
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
        while (car.countOf(item) < wagonSlots() * stackSize(item)) {
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
// 电路控制（对齐《异星工厂》：信号灯可接入电路网络，按电路信号强制闭合/放行）。
class RailSignal extends Entity {
  constructor(type, x, y) {
    super(type, x, y);
    // 电路条件：未启用时恒为正常信号灯；启用后仅当条件满足才放行，否则强制红灯闭合
    this.circuitCond = { enabled: false, channel: 'red', sig: 'iron-plate', op: '>', count: 1 };
  }
  // 电路放行：未启用条件时恒放行；启用后仅当附近电路信号满足条件才允许通过
  circuitEnabled() {
    if (!this.circuitCond || !this.circuitCond.enabled) return true;
    const sig = circuitSignalNear(this);
    return circuitCondOk(sig, this.circuitCond);
  }
  serialize() {
    const s = super.serialize();
    if (this.circuitCond) s.circuitCond = this.circuitCond;
    return s;
  }
  blueprint() {
    const s = super.blueprint();
    if (this.circuitCond) s.circuitCond = this.circuitCond;
    return s;
  }
  static restore(s) {
    const e = super.restore(s);
    e.circuitCond = s.circuitCond || { enabled: false, channel: 'red', sig: 'iron-plate', op: '>', count: 1 };
    return e;
  }
}
function railSignalAt(tx, ty) {
  const e = entAt(tx, ty);
  return e && e.type === 'rail-signal';
}
// ===== 链式信号灯 RailChainSignal（对齐《异星工厂》Rail chain signal）=====
class RailChainSignal extends RailSignal {
  constructor(type, x, y) { super(type || 'rail-chain-signal', x, y); }
}
// 车头前方 1~4 格内是否存在任一铁路信号灯（普通/链式）实体，用于电路闭合判定。
function signalNearAhead(head) {
  const cx = head.x, cy = head.y;
  const dir = head.dir != null ? head.dir : 0;
  const dx = DX[dir], dy = DY[dir];
  for (let i = 1; i <= 4; i++) {
    const e = entAt(cx + dx * i, cy + dy * i);
    if (e && (e.type === 'rail-signal' || e.type === 'rail-chain-signal')) return e;
  }
  return null;
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
// 取路线条目对应的车站名（条目可为字符串或 {stop, cond, time} 对象）
function routeEntryName(en) {
  return (typeof en === 'object' && en) ? en.stop : en;
}
function routeEntryCond(en) {
  return (typeof en === 'object' && en && en.cond) ? en.cond : 'leave';
}
function routeEntryTime(en) {
  return (typeof en === 'object' && en && typeof en.time === 'number') ? en.time : 10;
}
// 路线条目的电路条件（cond==='circuit' 时使用）：{ enabled, channel, sig, op, count }
function routeEntryCircuit(en) {
  if (typeof en !== 'object' || !en) return null;
  const c = en.circuit;
  if (c && typeof c === 'object' && c.enabled) return c;
  return null;
}
// 判断路线条目是否满足电路条件（在该站所在位置读取所连电路网络信号）
function routeEntryCircuitMet(en) {
  const c = routeEntryCircuit(en);
  if (!c) return true;   // 未配置电路条件视为满足
  const stopName = routeEntryName(en);
  const stop = trainStopByName(stopName);
  if (!stop) return true;   // 目标站不存在：回退为满足，避免列车永久滞留
  const sig = circuitSignalNear(stop);
  return circuitCondOk(sig, c);
}
// 找到路线中当前目标站点实体（按车站名）
function scheduleTargetStop(tr) {
  if (!trainHasSchedule(tr)) return null;
  const name = routeEntryName(tr.route[tr.routeIdx]);
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
// 按车站名查找车站实体（同名校名取第一个；用于读取该站电路网络信号）
function trainStopByName(name) {
  for (const e of G.ents) {
    if (e._dead || !(e instanceof TrainStop)) continue;
    if (e.displayName() === name) return e;
  }
  return null;
}

// ===== 列车调度“等待条件”（对齐《异星工厂》Train stop wait conditions） =====
// 路线每站可设置离开条件：
//   leave  —— 完成本站装卸后稍作停留即出发（默认，保持原行为）
//   full   —— 等待至列车全部车厢满载（货运箱槽满 / 流体车厢灌满）
//   empty  —— 等待至列车全部车厢卸空
//   time   —— 到站后停留固定秒数再出发
function trainCargoSlotsFull(w) {
  if (w instanceof FluidWagon) return w.fluid ? w.amount >= w.fluidCapacity() : false;
  if (w instanceof CargoWagon) {
    if (w.slots.length < wagonSlots()) return false;
    for (const s of w.slots) if (s && s.count < stackSize(s.item)) return false;
    return true;
  }
  return true;
}
function trainCargoSlotsEmpty(w) {
  if (w instanceof FluidWagon) return !w.fluid || w.amount <= 0;
  if (w instanceof CargoWagon) return !w.slots || w.slots.length === 0 || w.slots.every(s => !s || s.count <= 0);
  return true;
}
function trainCargoFull(tr) {
  let wagons = tr.cars.filter(c => c instanceof CargoWagon);
  if (!wagons.length) return false;
  return wagons.every(w => trainCargoSlotsFull(w));
}
function trainCargoEmpty(tr) {
  let wagons = tr.cars.filter(c => c instanceof CargoWagon);
  if (!wagons.length) return true;
  return wagons.every(w => trainCargoSlotsEmpty(w));
}
// 判断当前停靠站是否满足离开条件。arriveT 为本站已停留秒数。
function trainWaitMet(tr, arriveT) {
  const en = tr.route[tr.routeIdx];
  const cond = routeEntryCond(en);
  if (cond === 'full') return trainCargoFull(tr);
  if (cond === 'empty') return trainCargoEmpty(tr);
  if (cond === 'time') return arriveT >= routeEntryTime(en);
  // 电路条件：等待至该站所连电路网络信号满足条件（对齐《异星工厂》Train stop circuit wait condition）
  if (cond === 'circuit') return routeEntryCircuitMet(en);
  // leave：默认“装卸后出发”——至少停留一个装卸窗口（对齐原固定停靠时长），保证装/卸能完成；受火车制动科技缩短
  return arriveT >= trainBrakeWait();
}
// 当前路线条目的等待条件描述（用于面板显示）
function routeEntryCondLabel(en) {
  const c = routeEntryCond(en);
  if (c === 'full') return '满载后出发';
  if (c === 'empty') return '卸空后出发';
  if (c === 'time') return '停留 ' + routeEntryTime(en) + ' 秒';
  if (c === 'circuit') {
    const cc = en && en.circuit;
    if (cc && cc.enabled) {
      const nm = (typeof signalDisplayName === 'function') ? signalDisplayName(cc.sig) : (ITEMS[cc.sig] ? ITEMS[cc.sig].name : (cc.sig || ''));
      return '电路条件：' + nm + ' ' + (cc.op || '>') + ' ' + (cc.count || 0);
    }
    return '电路条件';
  }
  return '装卸后出发';
}
// 该车站是否被任一列车的自动调度路线引用（用于渲染调度光环标记）
function stationInSchedule(stop) {
  const n = stop.displayName();
  for (const tr of G.trains) {
    if (tr.route && tr.route.some(en => routeEntryName(en) === n)) return true;
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

