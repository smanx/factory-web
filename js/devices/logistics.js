'use strict';

// ===== 物流机器人网络（对齐《异星工厂》Logistics Network）=====
// 新增：机器人港 Roboport（4×4）、四类物流箱（被动供应/主动供应/仓储/需求）、
// 物流机器人。机器人港为物流机器人提供停放与充电；物流机器人往返于
// 供应箱/仓储箱 与 需求箱之间搬运货物。机器人耗电，电量低时回港充电。
//
// 网络模型（简化但完整）：
//   - 全图视为一个物流网络，所有机器人港与物流箱共同参与。
//   - 每 0.5s 复算一次“供应/需求”，把闲置满电机器人指派为搬运任务。
//   - 机器人状态机：idle → 去供应箱取货(collecting) → 去需求箱放货(delivering)
//     → 电量不足时返回机器人港充电(charging) → 充满回 idle。
//   - 供应源：被动供应箱、主动供应箱、仓储箱（主动供应箱优先）。
//   - 需求端：需求箱按各自配置的需求量产生缺口；仓储箱收纳多余货物。

// ===== 常量 =====
const LOGI_CHEST_KINDS = {
  'passive-provider-chest': 'passive',
  'active-provider-chest': 'active',
  'storage-chest': 'storage',
  'requester-chest': 'requester',
  'buffer-chest': 'buffer'
};
const ROBOT_SPEED = GAME_DATA.robotSpeed?.logistic ?? 3.0;  // 物流机器人飞行速度（格/秒，官方 logistic-robot speed 0.05×60=3.0）
const ROBOT_MAX_CHARGE = 100;   // 满电
const ROBOT_CHARGE_DRAIN = 2.2; // 每秒飞行耗电
const ROBOT_CHARGE_RATE = 40;   // 回港每秒充电量
const ROBOT_LOW_CHARGE = 20;    // 低于此值回家充电
const ROBOT_CARRY = 3;          // 单次最多搬运同类物品数量（基础值，可由「机器人容量」无限科技提升，见 robotCarryCap()）
const ROBOT_NET_T = 0.5;        // 网络调度复算间隔
const ROBOPORT_POWER_IDLE = GAME_DATA.roboportPower ?? 40; // 机器人港基础耗电（kW，官方 energy_usage 50kW）
// 机器人港范围与槽位（官方 roboport 原型，经 GAME_DATA 单源桥接）：
//   logistics=物流网络覆盖半径（官方 logistics_radius=25 格），construction=施工机器人覆盖半径（官方 construction_radius=55 格）
//   robotSlots=第一排机器人槽（官方 robot_slots_count=7，每槽最多 50 台同类型机器人，见官方 wiki Roboport#Storage），
//   materialSlots=第二排修理包槽（官方 material_slots_count=7，每槽堆叠）
const ROBOPORT_LOGI_RANGE = GAME_DATA.roboportRange?.logistics ?? 25;
const ROBOPORT_CONSTR_RANGE = GAME_DATA.roboportRange?.construction ?? 55;
const ROBOT_SLOT_COUNT = GAME_DATA.roboportRange?.robotSlots ?? 7;
const MAT_SLOT_COUNT = GAME_DATA.roboportRange?.materialSlots ?? 7;
const ROBOT_SLOT_MAX = 50;   // 每机器人槽堆叠上限（官方：每槽可容纳 50 台同类型机器人）
const ROBOPORT_CAP = ROBOT_SLOT_COUNT * ROBOT_SLOT_MAX; // 单港机器人总容量 = 7×50=350 台
// 修理包充电（对齐官方 2.0：机器人回港充电消耗「修理包」，充满 1 台耗 1 个）；
// 项目兜底：网络内无修理包时退回纯电力慢充（旧存档兼容，项目自定倍率）。
const ROBOT_NO_PACK_CHARGE_MULT = 0.25;

// 机器人港实体：第一排 7 格机器人槽（物流机器人 / 建设机器人共用，每槽堆叠同型机器人、每槽最多 50 台）
// + 第二排 7 格修理包槽。玩家/机械臂/面板均可投入取出；同星球上物流覆盖相交的机器人港互相连接，
// 构成同一物流网络（连通分量），网络内机器人、修理包、物流箱库存全部共享。
class Roboport extends CircuitNode {
  constructor(type, x, y) {
    super('roboport', x, y);
    // 统一 slots 数组（长度 = 机器人槽 + 修理包槽），前 ROBOT_SLOT_COUNT 格为机器人槽
    // （物流/建设机器人共用，一格一种、每格最多 ROBOT_SLOT_MAX 台），后 MAT_SLOT_COUNT 格为修理包槽。
    // 统一成与箱子一致的 slots 接口，使面板槽位直接复用背包/箱子通用交互（拿起/放入/交换/Shift/Ctrl 快捷键）。
    this.slots = new Array(ROBOT_SLOT_COUNT + MAT_SLOT_COUNT).fill(null);
    this._netComp = null;   // 最近一次调度所属的连通网络（scanNetwork 重算）
  }
  // 兼容视图：机器人槽 / 修理包槽。只读：既有的调度/绘制/序列化代码仍可读 robotSlots/matSlots；
  // 写入一律走 this.slots（面板通用交互直接读写 slots，格子索引 = 机器人槽索引 / ROBOT_SLOT_COUNT + 修理包索引）。
  get robotSlots() { return this.slots.slice(0, ROBOT_SLOT_COUNT); }
  get matSlots() { return this.slots.slice(ROBOT_SLOT_COUNT); }
  get roboCap() { let n = 0; for (const s of this.robotSlots) if (s) n += s.count; return n; }  // 港内机器人总台数（物流+建设求和）
  hasFreeRobotSlot(item) {
    if (item) {
      // 指定类型：可放入同型未满槽，或占用空槽（7 槽两型共用，一格一种机器人）
      for (const s of this.robotSlots) {
        if (!s) return true;
        if (s.item === item && s.count < ROBOT_SLOT_MAX) return true;
      }
      return false;
    }
    // 未指定类型：只要有可容纳机器人的槽即可
    return this.robotSlots.some(s => !s || s.count < ROBOT_SLOT_MAX);
  }
  hasFreeMatSlot(item) {
    const cap = stackSize(item);
    for (const s of this.matSlots) { if (!s || (s.item === item && s.count < cap)) return true; }
    return false;
  }
  // 槽位类型校验：第一排机器人槽只收两种机器人，第二排修理包槽只收修理包。
  // 面板通用交互（data-chestslot 放入/交换/半放）先经 slotAccepts 把关，不符的物品放不进去（与 giveItem 的接收规则一致）。
  slotAccepts(idx, id) {
    if (idx < ROBOT_SLOT_COUNT) return (id === 'logistic-robot' || id === 'construction-robot');
    return (id === 'repair-pack');
  }
  matCount(item) { let n = 0; for (const s of this.matSlots) if (s && s.item === item) n += s.count; return n; }
  // 电路网络信号输出（对齐《异星工厂》：机器人港可接入电路网络读取所在物流网络物资）。
  // 输出本连通网络内供应箱/仓储箱每种物品总量（scanNetwork 预计算缓存）。
  outputCircuitSignals() {
    const comp = this._netComp;
    return (comp && comp.signals) || [];
  }
  giveItem(item, silent) {
    // 机器人槽：物流/建设机器人共用。优先填入同类型未堆满的槽（堆满 50 台才轮到下一个槽），
    // 无同型槽时占用第一个空槽（一格一种机器人，对齐官方 7 槽×每槽最多 50 台）。
    if (item === 'logistic-robot' || item === 'construction-robot') {
      for (let i = 0; i < ROBOT_SLOT_COUNT; i++) {
        const s = this.slots[i];
        if (s && s.item === item && s.count < ROBOT_SLOT_MAX) {
          s.count++;
          if (!silent && typeof playSfx === 'function') playSfx('robot');
          return true;
        }
      }
      const i = this.slots.findIndex(s => !s);
      if (i < 0) return false;
      this.slots[i] = { item, count: 1 };
      if (!silent && typeof playSfx === 'function') playSfx('robot');
      return true;
    }
    if (item === 'repair-pack') {
      const cap = stackSize('repair-pack');
      let i = this.slots.findIndex((s, j) => j >= ROBOT_SLOT_COUNT && s && s.item === 'repair-pack' && s.count < cap);
      if (i < 0) i = this.slots.findIndex((s, j) => j >= ROBOT_SLOT_COUNT && !s);
      if (i < 0) return false;
      if (this.slots[i]) this.slots[i].count++;
      else this.slots[i] = { item: 'repair-pack', count: 1 };
      return true;
    }
    return false;
  }
  peekItem() {
    for (const s of this.robotSlots) if (s) return s.item;
    for (const s of this.matSlots) if (s) return s.item;
    return null;
  }
  takeItem() { return this.takeItemOf(this.peekItem()); }
  takeItemOf(item) {
    if (item === 'logistic-robot' || item === 'construction-robot') {
      // 从第一个含该类型机器人的槽取走 1 台（减到 0 即清空该槽）
      for (let i = 0; i < ROBOT_SLOT_COUNT; i++) {
        const s = this.slots[i];
        if (s && s.item === item && s.count > 0) {
          s.count--;
          if (s.count <= 0) this.slots[i] = null;
          // 若已派生出超出新上限的机器人，回收多余空闲机器人
          retireExcessRobots(this);
          if (typeof playSfx === 'function') playSfx('robot');
          return item;
        }
      }
      return null;
    }
    if (item === 'repair-pack') {
      const i = this.slots.findIndex((s, j) => j >= ROBOT_SLOT_COUNT && s && s.item === 'repair-pack');
      if (i < 0) return null;
      const s = this.slots[i];
      s.count--;
      if (s.count <= 0) this.slots[i] = null;
      return 'repair-pack';
    }
    return null;
  }
  countOf(item) {
    if (item === 'logistic-robot' || item === 'construction-robot') {
      let n = 0;
      for (const s of this.robotSlots) if (s && s.item === item) n += s.count;
      return n;
    }
    if (item === 'repair-pack') return this.matCount('repair-pack');
    return 0;
  }
  powerDemand() {
    // 港内已有机器人或网络有需求时才耗电；否则闲置省电
    if (this.roboCap > 0) return ROBOPORT_POWER_IDLE;
    return 0;
  }
  contents() {
    const list = [[this.type, 1]];
    const logi = this.countOf('logistic-robot'), constr = this.countOf('construction-robot');
    if (logi > 0) list.push(['logistic-robot', logi]);
    if (constr > 0) list.push(['construction-robot', constr]);
    const rp = this.matCount('repair-pack');
    if (rp > 0) list.push(['repair-pack', rp]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.robotSlots = this.robotSlots.map(v => v ? [v.item, v.count] : null);
    s.matSlots = this.matSlots.map(v => v ? [v.item, v.count] : null);
    return s;
  }
  blueprint() {
    const s = super.blueprint();
    // 蓝图保留机器人槽分布（类型 + 数量），恢复时经 restore 的 robotSlots 分支还原
    s.robotSlots = this.robotSlots.map(v => v ? [v.item, v.count] : null);
    return s;
  }
  static restore(s) {
    const e = super.restore(s);
    if (Array.isArray(s.robotSlots)) {
      for (let i = 0; i < ROBOT_SLOT_COUNT; i++) {
        const v = s.robotSlots[i];
        if (v && Array.isArray(v)) {
          // 新格式 [item, count]
          const item = (v[0] === 'construction-robot') ? 'construction-robot' : 'logistic-robot';
          const cnt = Math.max(1, Math.min(ROBOT_SLOT_MAX, v[1] | 0));
          e.slots[i] = { item, count: cnt };
        } else if (typeof v === 'number' && v > 0) {
          // 旧格式（每槽台数 0/1，或上一版堆叠台数）→ 按物流机器人还原
          e.slots[i] = { item: 'logistic-robot', count: Math.max(1, Math.min(ROBOT_SLOT_MAX, v)) };
        }
      }
    } else if ((s.roboCap | 0) > 0) {
      // 更旧存档迁移：roboCap（台数）→ 按顺序堆叠填入各槽（每槽满 50 才下一槽），超出总容量退回背包
      let n = s.roboCap | 0;
      for (let i = 0; i < ROBOT_SLOT_COUNT && n > 0; i++) {
        const put = Math.min(ROBOT_SLOT_MAX, n);
        e.slots[i] = { item: 'logistic-robot', count: put };
        n -= put;
      }
      if (n > 0 && typeof invAdd === 'function') invAdd('logistic-robot', n);
    }
    if (Array.isArray(s.matSlots)) {
      for (let i = 0; i < MAT_SLOT_COUNT; i++) {
        const v = s.matSlots[i];
        e.slots[ROBOT_SLOT_COUNT + i] = v ? { item: v[0] ?? v.item, count: v[1] ?? v.count } : null;
      }
    }
    return e;
  }
}

// ===== 物流箱基类（四类共用槽位逻辑，容量官方 48 格）=====
// 与储物箱一致采用固定格子数组：一格一种物品、堆叠满占格、空槽可见。
// 容量统一走 GAME_DATA.containerSizes（官方 inventory_size=48）。
class LogisticChest extends Entity {
  constructor(type, x, y) {
    super(type, x, y);
    this.slots = new Array(this.slotCap()).fill(null);
  }
  // 槽位容量：官方 logistic-container inventory_size=48
  slotCap() {
    return GAME_DATA.containerSizes?.[this.type] ?? 48;
  }
  freeSlotIndex() {
    for (let i = this.slots.length - 1; i >= 0; i--) if (!this.slots[i]) return i;
    return -1;
  }
  giveItem(item) {
    for (const s of this.slots)
      if (s && s.item === item && s.count < stackSize(item)) { s.count++; return true; }
    const i = this.freeSlotIndex();
    if (i < 0) return false;
    this.slots[i] = { item, count: 1 };
    return true;
  }
  peekItem() {
    for (let i = this.slots.length - 1; i >= 0; i--) {
      const s = this.slots[i];
      if (s) return s.item;
    }
    return null;
  }
  takeItem() {
    for (let i = this.slots.length - 1; i >= 0; i--) {
      const s = this.slots[i];
      if (s) {
        const it = s.item;
        s.count--;
        if (s.count <= 0) this.slots[i] = null;
        return it;
      }
    }
    return null;
  }
  countOf(item) {
    let n = 0;
    for (const st of this.slots) if (st && st.item === item) n += st.count;
    return n;
  }
  takeItemOf(item) {
    for (let i = this.slots.length - 1; i >= 0; i--) {
      const st = this.slots[i];
      if (st && st.item === item) {
        st.count--;
        if (st.count <= 0) this.slots[i] = null;
        return item;
      }
    }
    return null;
  }
  contents() {
    const list = [[this.type, 1]];
    for (const s of this.slots) if (s) list.push([s.item, s.count]);
    return list;
  }
  takeAll() {
    const rows = [];
    for (const s of this.slots) if (s) rows.push([s.item, s.count]);
    this.slots = new Array(this.slotCap()).fill(null);
    return rows;
  }
  serialize() {
    const s = super.serialize();
    s.slots = this.slots.map(v => v ? [v.item, v.count] : null);
    return s;
  }
  blueprint() {
    const s = super.blueprint();
    if (this.requests) s.requests = this.requests;
    return s;
  }
  static restore(s) {
    const c = super.restore(s);
    const raw = s.slots || [];
    const cap = c.slotCap();
    c.slots = new Array(cap).fill(null);
    for (let i = 0; i < Math.min(cap, raw.length); i++) {
      const v = raw[i];
      if (v) c.slots[i] = { item: v[0] ?? v.item, count: v[1] ?? v.count };
    }
    return c;
  }
}

// 被动供应箱：机器人可取货，也接收返还
class LogisticPassive extends LogisticChest {
  constructor(type, x, y) { super('passive-provider-chest', x, y); }
}
// 主动供应箱：机器人优先取货，收纳过剩
class LogisticActive extends LogisticChest {
  constructor(type, x, y) { super('active-provider-chest', x, y); }
}
// 仓储箱：机器人收纳返还/多余货物，也可作备用取货源
class LogisticStorage extends LogisticChest {
  constructor(type, x, y) { super('storage-chest', x, y); this.filter = null; }
  acceptsLogi(item) { return !this.filter || this.filter === item; }
  serialize() { const s = super.serialize(); if (this.filter) s.filter = this.filter; return s; }
  blueprint() { const s = super.blueprint(); if (this.filter) s.filter = this.filter; return s; }
  static restore(s) { const c = super.restore(s); c.filter = (s.filter && ITEMS[s.filter]) ? s.filter : null; return c; }
}
// 需求箱：设置每种物品需求量，机器人自动送货补足
class LogisticRequester extends LogisticChest {
  constructor(type, x, y) {
    super('requester-chest', x, y);
    this.requests = {};   // item -> 目标数量
    this.reqGrid = null;  // 物流请求区格位布局（50 格，每格 item 或 null），与 requests 同步
    this.trashGrid = null; // 物流回收区格位（30 格，每格 {item,count} 实体堆叠或 null）
  }
  // 需求缺口：目标量 - 当前存量
  deficitOf(item) {
    return Math.max(0, (this.requests[item] || 0) - this.countOf(item));
  }
  // 拆除时回收区内的实体物品一并退回（与箱子槽位一致）
  contents() {
    const list = super.contents();
    for (const s of (this.trashGrid || [])) if (s && ITEMS[s.item]) list.push([s.item, s.count]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.requests = this.requests;
    s.reqGrid = this.reqGrid || null;
    s.trashGrid = this.trashGrid ? this.trashGrid.map(v => v ? [v.item, v.count] : null) : null;
    return s;
  }
  static restore(s) {
    const c = super.restore(s);
    c.requests = {};
    for (const k in (s.requests || {})) if (s.requests[k] > 0) c.requests[k] = s.requests[k];
    c.reqGrid = Array.isArray(s.reqGrid) ? s.reqGrid.slice() : null;
    if (Array.isArray(s.trashGrid)) {
      const cap = LOGI_RECYCLE_ROWS * LOGI_RECYCLE_PER_ROW;
      c.trashGrid = new Array(cap).fill(null);
      const raw = s.trashGrid;
      for (let i = 0; i < Math.min(cap, raw.length); i++) {
        const v = raw[i];
        if (v) c.trashGrid[i] = { item: v[0] ?? v.item, count: v[1] ?? v.count };
      }
    } else c.trashGrid = null;
    return c;
  }
}

// 缓冲箱（对齐《异星工厂》Buffer chest 0.17+）：介于需求箱与仓储箱之间
// 既按设定请求货物（如需求箱），又向物流网络供应（如仓储箱），作为中转缓冲
class LogisticBuffer extends LogisticChest {
  constructor(type, x, y) {
    super('buffer-chest', x, y);
    this.requests = {};   // item -> 目标数量
    this.reqGrid = null;  // 物流请求区格位布局（50 格）
    this.trashGrid = null; // 物流回收区格位（30 格，每格 {item,count}）
  }
  // 需求缺口：目标量 - 当前存量
  deficitOf(item) {
    return Math.max(0, (this.requests[item] || 0) - this.countOf(item));
  }
  contents() {
    const list = super.contents();
    for (const s of (this.trashGrid || [])) if (s && ITEMS[s.item]) list.push([s.item, s.count]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.requests = this.requests;
    s.reqGrid = this.reqGrid || null;
    s.trashGrid = this.trashGrid ? this.trashGrid.map(v => v ? [v.item, v.count] : null) : null;
    return s;
  }
  static restore(s) {
    const c = super.restore(s);
    c.requests = {};
    for (const k in (s.requests || {})) if (s.requests[k] > 0) c.requests[k] = s.requests[k];
    c.reqGrid = Array.isArray(s.reqGrid) ? s.reqGrid.slice() : null;
    if (Array.isArray(s.trashGrid)) {
      const cap = LOGI_RECYCLE_ROWS * LOGI_RECYCLE_PER_ROW;
      c.trashGrid = new Array(cap).fill(null);
      const raw = s.trashGrid;
      for (let i = 0; i < Math.min(cap, raw.length); i++) {
        const v = raw[i];
        if (v) c.trashGrid[i] = { item: v[0] ?? v.item, count: v[1] ?? v.count };
      }
    } else c.trashGrid = null;
    return c;
  }
}

// ===== 全局物流网络状态 =====
// G.logiRobots: 全部物流机器人实体数组
// G.logiNet: 最近一次调度缓存 {supply, demand, ports}
function ensureLogi() {
  if (!G.logiRobots) G.logiRobots = [];
  if (!G.logiNetT) G.logiNetT = 0;
}

// 判定某实体是否为“机器人可从其取货”的物流供应箱
function isLogiSupply(e) {
  return e && (e instanceof LogisticPassive || e instanceof LogisticActive || e instanceof LogisticStorage || e instanceof LogisticBuffer);
}

// 向机器人港塞入 logistic-robot：玩家/机械臂往港内 give 时增加 roboCap
function retireExcessRobots(port) {
  if (!G.logiRobots) return;
  const mine = G.logiRobots.filter(r => r.home === port && !r._dead);
  let excess = mine.length - port.countOf('logistic-robot');  // 仅按物流机器人台数回收实体（建设机器人暂为存储，不派生实体）
  if (excess > 0) {
    // 优先回收空闲机器人，其次回收正在返港/充电的
    const order = ['idle', 'returning', 'charging'];
    for (const st of order) {
      for (const r of mine) {
        if (excess <= 0) break;
        if (r.state === st) { r._dead = true; excess--; }
      }
      if (excess <= 0) break;
    }
  }
  G.logiRobots = compactFilter(G.logiRobots, r => !r._dead);   // 单遍 compactFilter 清理死亡机器人（P0 优化）
}

// 新增机器人实体（挂到某机器人港名下）
function spawnRobotAt(port) {
  const r = {
    home: port,
    x: (port.x + port.w / 2) * TILE,
    y: (port.y + port.h / 2) * TILE,
    tx: 0, ty: 0,
    charge: ROBOT_MAX_CHARGE,
    carry: null,        // { item, count }
    state: 'idle',      // idle | collecting | delivering | returning | charging
    target: null,       // 目标实体
    _dead: false
  };
  G.logiRobots.push(r);
  return r;
}

// 确保每个机器人港拥有 roboCap 个机器人。
// 优先复用 scanNetwork 已收集的机器人港列表（G.logiNet.ports），避免对 G.ents 重复全量遍历（性能优化）。
// 玩家/机械臂/面板用通用交互取出机器人后，槽位台数减少但飞行实体可能仍有盈余，
// 故先调用 retireExcessRobots 回收多余空闲实体，再按缺口补充（集中兜底，覆盖所有取出路径）。
function ensurePortRobots() {
  const ports = (G.logiNet && G.logiNet.ports) || null;
  if (ports) {
    for (const e of ports) {
      if (e._dead) continue;
      retireExcessRobots(e);
      let mine = 0;
      for (const r of G.logiRobots) if (r.home === e && !r._dead) mine++;
      for (let i = mine; i < e.countOf('logistic-robot'); i++) spawnRobotAt(e);
    }
    return;
  }
  // 兜底：尚无缓存时（如物流网络刚解锁、首次调度）再全量遍历一次
  for (const e of G.ents) {
    if (!(e instanceof Roboport) || e._dead) continue;
    retireExcessRobots(e);
    let mine = 0;
    for (const r of G.logiRobots) if (r.home === e && !r._dead) mine++;
    for (let i = mine; i < e.countOf('logistic-robot'); i++) spawnRobotAt(e);
  }
}

// ===== 玩家个人物流请求（对齐《异星工厂》Personal logistic request）=====
// 玩家可在背包面板设置个人请求量，只要处于物流网络内（已研究物流网络且有机器人港），
// 物流机器人会自动把请求的物品送达玩家背包，并把玩家身上超出请求量的物品带回网络存储。
function playerLogiTarget() {
  return {
    isPlayer: true,
    x: (G.player ? G.player.x : 0) / TILE,
    y: (G.player ? G.player.y : 0) / TILE,
    w: 1, h: 1,
    _dead: false,
    deficitOf(item) {
      const want = (G.logiRequest && G.logiRequest[item]) || 0;
      if (want <= 0) return 0;
      return Math.max(0, want - invCount(item));
    },
    giveItem(item) { invAdd(item, 1); return true; },
    countOf(item) { return invCount(item); },
    takeItemOf(item) { return invTake(item, 1) ? item : null; }
  };
}

// 物流回收区（实体箱子）作为机器人取货端：机器人飞到玩家处，从 G.logiTrashGrid 格子里取走物品
function playerTrashTarget() {
  return {
    isPlayer: true,
    x: (G.player ? G.player.x : 0) / TILE,
    y: (G.player ? G.player.y : 0) / TILE,
    w: 1, h: 1,
    _dead: false,
    deficitOf() { return 0; },
    giveItem() { return false; },
    countOf(item) { return trashGridCount(item); },
    takeItemOf(item) { return trashGridTake(item, 1) ? item : null; }
  };
}

// ===== 物流箱（绿箱/蓝箱）回收区：机器人飞到箱子处，从 e.trashGrid 格子里取走物品运回网络 =====
function chestTrashCount(e, item) {
  let n = 0;
  for (const s of (e && e.trashGrid) || []) if (s && s.item === item) n += s.count;
  return n;
}
function chestTrashTake(e, item, n) {
  let left = n;
  const g = (e && e.trashGrid) || [];
  for (let i = 0; i < g.length && left > 0; i++) {
    const s = g[i];
    if (s && s.item === item) {
      const c = Math.min(s.count, left);
      s.count -= c; left -= c;
      if (s.count <= 0) g[i] = null;
    }
  }
  return n - left;
}
function chestTrashTarget(e) {
  return {
    isChestTrash: true,
    x: e.x + e.w / 2, y: e.y + e.h / 2,
    w: e.w, h: e.h,
    get _dead() { return !!e._dead; },
    deficitOf() { return 0; },
    giveItem() { return false; },
    countOf(item) { return chestTrashCount(e, item); },
    takeItemOf(item) { return chestTrashTake(e, item, 1) ? item : null; }
  };
}

// ===== 网络调度：计算供应与需求缺口，指派空闲机器人 =====
// 为机器人挑选一个可存放返还/多余货物的供应箱（对齐官方黄箱筛选语义）：
// - 设置了筛选格的仓储箱（黄箱）只接受该物品：就算物品无处可放也不违反筛选规则；
// - 存货优先级（对齐官方 2.0.7：筛选匹配优先于库存匹配）：
//   筛选黄箱（已含该物品 > 空 > 含其它物品）> 未筛选箱（含该物品 > 空 > 含其它物品）。
function logiDropTarget(item, exclude, exclude2) {
  let best = null, bestScore = -1;
  for (const e of G.ents || []) {
    if (!e || e._dead || e === exclude || e === exclude2) continue;
    if (!(e instanceof LogisticChest) || e instanceof LogisticRequester) continue;
    if (typeof e.giveItem !== 'function' || typeof e.countOf !== 'function') continue;
    const has = item ? e.countOf(item) > 0 : false;
    const empty = e.slots.every(s => !s);
    let score;
    if (e instanceof LogisticStorage) {
      if (item && !e.acceptsLogi(item)) continue;
      score = e.filter ? (has ? 6 : empty ? 5 : 4) : (has ? 3 : empty ? 2 : 1);
    } else {
      score = has ? 3 : empty ? 2 : 1;
    }
    if (score > bestScore) { bestScore = score; best = e; }
  }
  return best;
}
function scanNetwork() {
  // 供应：按物品聚合 { item -> count }，区分主动/被动/仓储优先级
  const supply = {};     // item -> { total, active }  active=主动供应箱中可立即提供的量
  const supplies = [];   // 所有可作为取货源的箱子 [{e, item, count}]
  const demand = {};     // item -> 总缺口
  const requesters = []; // 需求箱列表
  const ports = [];      // 机器人港列表
  const recycleChests = []; // 需求箱/缓冲箱（带回收区）列表：供每帧回收任务与工作探测复用，避免每帧全图遍历 G.ents

  for (const e of G.ents) {
    if (e._dead) continue;
    if (e instanceof Roboport) { ports.push(e); continue; }
    if (!(e instanceof LogisticChest)) continue;
    // 需求类：需求箱与缓冲箱都会按设定请求货物（缓冲箱同时是供应源，不 continue）
    if (e instanceof LogisticRequester || e instanceof LogisticBuffer) {
      if (e.trashGrid) recycleChests.push(e);
      requesters.push(e);
      for (const k in e.requests) {
        const d = e.deficitOf(k);
        if (d > 0) demand[k] = (demand[k] || 0) + d;
      }
      if (e instanceof LogisticRequester) continue;
    }
    // 供应类箱：汇总每种物品可用量
    for (const s of e.slots) {
      if (!s) continue;
      supply[s.item] = supply[s.item] || { total: 0, active: 0 };
      supply[s.item].total += s.count;
      if (e instanceof LogisticActive) supply[s.item].active += s.count;
      supplies.push({ e, item: s.item, count: s.count, active: e instanceof LogisticActive });
    }
  }

  // 玩家个人物流请求：作为额外的需求端（仅当「背包物流」开关开启、有个人请求且背包缺货时）
  if (G.logiRequest && G.logiEnabled !== false) {
    const pt = playerLogiTarget();
    let anyReq = false;
    for (const k in G.logiRequest) {
      const d = pt.deficitOf(k);
      if (d > 0) { demand[k] = (demand[k] || 0) + d; anyReq = true; }
    }
    if (anyReq) requesters.push(pt);
  }

  // 赋值给全局供调度使用
  G.logiNet = { supply, supplies, demand, requesters, ports, recycleChests };
  // 预计算物流网络电路信号缓存（性能优化）：把网络各物品库存总量转成
  // [{sig,count},...] 信号列表，供所有机器人港的 outputCircuitSignals 复用，
  // 避免每个机器人港在电路重算时各自重复遍历 supply。
  const sigList = [];
  for (const item in supply) {
    const c = supply[item];
    if (c && c.total > 0) sigList.push({ sig: item, count: c.total });
  }
  G.logiNet.signals = sigList;
  return G.logiNet;
}

// 指派一个空闲满电机器人的搬运任务
function assignTask(r) {
  const net = G.logiNet;
  if (!net) return;
  // 有需求才值得搬
  const wantedItems = Object.keys(net.demand).filter(k => net.demand[k] > 0);
  if (!wantedItems.length) return;

  // 找供应：优先主动供应箱，其次任意供应箱（含仓储）
  let best = null;
  outer:
  for (const item of wantedItems) {
    // 主动供应箱优先
    for (const c of net.supplies) {
      if (c.item !== item || c.count <= 0) continue;
      if (c.active) { best = { e: c.e, item, need: net.demand[item] }; break outer; }
    }
  }
  if (!best) {
    outer2:
    for (const item of wantedItems) {
      for (const c of net.supplies) {
        if (c.item !== item || c.count <= 0) continue;
        best = { e: c.e, item, need: net.demand[item] }; break outer2;
      }
    }
  }
  if (!best) return;

  // 找到一个匹配的需求箱来送货
  const req = net.requesters.find(q => q.deficitOf(best.item) > 0);
  if (!req) return;

  // 取货量不超过目标缺口、供应量与单次搬运上限（避免超出缺口导致物品丢失）
  const takeN = Math.min(robotCarryCap(), req.deficitOf(best.item), best.e.countOf(best.item));
  if (takeN <= 0) return;

  // 指派
  r.carry = { item: best.item, count: takeN };
  r.target = best.e;
  r.tx = (best.e.x + best.e.w / 2) * TILE;
  r.ty = (best.e.y + best.e.h / 2) * TILE;
  r.state = 'collecting';
  if (typeof playSfx === 'function') playSfx('robot');
}

// ===== 机器人飞行更新 =====
function moveToward(r, dt) {
  const dx = r.tx - r.x, dy = r.ty - r.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 2) { r.x = r.tx; r.y = r.ty; return true; }
  const step = ROBOT_SPEED * robotSpeedMult() * TILE * dt;
  const m = Math.min(step, dist);
  r.x += dx / dist * m;
  r.y += dy / dist * m;
  return dist <= step;
}

function nearestPort(r) {
  let best = null, bd = Infinity;
  for (const e of G.ents) {
    if (!(e instanceof Roboport) || e._dead) continue;
    const cx = (e.x + e.w / 2) * TILE, cy = (e.y + e.h / 2) * TILE;
    const d = (cx - r.x) * (cx - r.x) + (cy - r.y) * (cy - r.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best || r.home;
}

function updateRobot(r, dt) {
  if (r._dead) return;
  // 机器人港被拆除则回收该机器人
  if (!r.home || r.home._dead) { r._dead = true; return; }

  // 飞行耗电（idle/charging 不耗电）
  if (r.state === 'collecting' || r.state === 'delivering' || r.state === 'returning') {
    r.charge -= ROBOT_CHARGE_DRAIN * dt;
  }

  switch (r.state) {
    case 'idle':
      // 等待在港内，满电即可被调度
      break;
    case 'charging': {
      // 回到港内充电（需电网有电）
      const [px, py] = portCenter(r.home);
      r.x = px; r.y = py;
      if (powerSatOf(this) > 0) {
        r.charge = Math.min(ROBOT_MAX_CHARGE, r.charge + ROBOT_CHARGE_RATE * dt * Math.max(powerSatOf(this), 0.2));
      }
      if (r.charge >= ROBOT_MAX_CHARGE) { r.state = 'idle'; r.target = null; r.carry = null; }
      break;
    }
    case 'collecting': {
      if (!r.target || r.target._dead) { r.state = 'returning'; break; }
      if (moveToward(r, dt)) {
        // 到达供应箱：取货
        if (r.carry && r.target.countOf(r.carry.item) >= r.carry.count) {
          let taken = 0;
          for (let i = 0; i < r.carry.count; i++)
            if (r.target.takeItemOf(r.carry.item) === r.carry.item) taken++;
          if (taken > 0) r.carry.count = taken;
        }
        if (r.fromPlayer || r.recycleEnt) {
          // 回收场景：从玩家/物流箱回收区取货后送回一个可存放的供应箱（仓储/主动/被动箱）
          const drop = logiDropTarget(r.carry ? r.carry.item : null, r.target, r.recycleEnt);
          if (r.carry && r.carry.count > 0 && drop) {
            r.target = drop;
            r.tx = (drop.x + drop.w / 2) * TILE;
            r.ty = (drop.y + drop.h / 2) * TILE;
            r.state = 'delivering';
            r.fromPlayer = false;
            r.recycleEnt = null;
          } else {
            r.carry = null; r.state = 'returning';
          }
          break;
        }
        // 找需求箱送货
        const net = G.logiNet || scanNetwork();
        const req = (net.requesters || []).find(q => q.deficitOf(r.carry ? r.carry.item : '') > 0);
        if (req && r.carry && r.carry.count > 0) {
          r.target = req;
          r.tx = (req.x + req.w / 2) * TILE;
          r.ty = (req.y + req.h / 2) * TILE;
          r.state = 'delivering';
        } else {
          r.carry = null;
          r.state = 'returning';
        }
      }
      break;
    }
    case 'delivering': {
      if (!r.target || r.target._dead) { r.carry = null; r.state = 'returning'; break; }
      if (moveToward(r, dt)) {
        // 到达需求箱：放货（不超过需求缺口）
        if (r.carry) {
          const can = (r.target instanceof LogisticRequester || r.target instanceof LogisticBuffer || (r.target && r.target.isPlayer)) ? r.target.deficitOf(r.carry.item) : r.carry.count;
          const give = Math.max(0, Math.min(r.carry.count, can));
          for (let i = 0; i < give; i++) {
            if (!r.target.giveItem(r.carry.item)) break;
            if (typeof trackProd === 'function') trackProd(r.carry.item, 1);
          }
        }
        if (r.carry && r.carry.item) {
          // 成就：物流机器人完成一次搬运（对齐《异星工厂》：机器人革命）
          if (typeof achEnsureStats === 'function') { achEnsureStats(); G.achStats.robotDeliveries++; checkAchievements(); }
        }
        r.carry = null;
        r.state = 'returning';
      }
      break;
    }
    case 'returning': {
      // 若电量不足，回港充电；否则回港等待
      const [px, py] = portCenter(r.home);
      r.tx = px; r.ty = py;
      if (moveToward(r, dt)) {
        // 回到港后总是充满电再重新可用（对齐异星工厂：机器人在港内充电）
        if (r.charge < ROBOT_MAX_CHARGE) r.state = 'charging';
        else { r.state = 'idle'; r.target = null; }
      }
      break;
    }
  }

  // 电量过低且正在搬运 → 先回港充电，保存任务（简化：丢弃当前任务）
  if ((r.state === 'collecting' || r.state === 'delivering') && r.charge < ROBOT_LOW_CHARGE) {
    r.carry = null;
    r.state = 'returning';
  }
}

function portCenter(p) {
  return [(p.x + p.w / 2) * TILE, (p.y + p.h / 2) * TILE];
}

// ===== 全局物流更新（main.js 主循环调用）=====
function updateLogistics(dt) {
  if (!G.techDone['logistics-network']) return;
  ensureLogi();
  G.logiNetT += dt;
  if (G.logiNetT >= ROBOT_NET_T) {
    G.logiNetT = 0;
    // 性能优化：先 scanNetwork 收集机器人港列表到 G.logiNet.ports，
    // ensurePortRobots 复用该缓存，避免对 G.ents 做两次全量遍历。
    scanNetwork();
    ensurePortRobots();
  }
  // 更新所有机器人
  for (const r of G.logiRobots) updateRobot(r, dt);
  // 清理死亡机器人（单遍 compactFilter 原地清理，避免每帧分配新数组）
  G.logiRobots = compactFilter(G.logiRobots, r => !r._dead);
  // 空闲且满电的机器人尝试接任务
  if (G.logiNet) {
    // 性能优化：网络无需求且无玩家回收任务时，跳过对全部机器人的空闲扫描，
    // 避免无物流压力时每帧遍历所有机器人（降低空闲时的每帧开销，不改变指派行为）。
    let hasWork = false;
    // 玩家有请求（背包物流开启）即有工作（送达/回收超出部分）
    if (G.logiEnabled !== false && G.logiRequest) {
      for (const k in G.logiRequest) if (G.logiRequest[k] > 0) { hasWork = true; break; }
    }
    // 回收区格子里存放有物品待回收也算作有工作
    if (!hasWork && G.logiTrashGrid) {
      for (const s of G.logiTrashGrid) if (s && s.count > 0) { hasWork = true; break; }
    }
    // 物流箱（绿箱/蓝箱）回收区有物品待回收也算作有工作
    if (!hasWork) {
      const rc = (G.logiNet && G.logiNet.recycleChests) || [];
      for (const e of rc) {
        if (e._dead) continue;
        const tg = e.trashGrid;
        if (tg) for (const s of tg) if (s && s.count > 0) { hasWork = true; break; }
        if (hasWork) break;
      }
    }
    // 「回收未请求物品」开启时，背包中存在未请求物品也算有工作
    if (!hasWork && G.recycleUnrequested) {
      G.inv.forEach((n, k) => { if (n > 0 && ITEMS[k] && !(G.logiRequest && G.logiRequest[k] > 0)) { hasWork = true; } });
    }
    if (!hasWork) {
      const dm = G.logiNet.demand;
      if (dm) { for (const k in dm) if (dm[k] > 0) { hasWork = true; break; } }
    }
    if (hasWork) {
      for (const r of G.logiRobots) {
        if (r._dead || r.state !== 'idle' || r.charge < ROBOT_MAX_CHARGE) continue;
        // 优先回收玩家身上超出个人请求量的物品
        if (assignRecycleTask(r)) break;
        // 其次回收物流箱（绿箱/蓝箱）回收区里存放的物品
        if (assignChestRecycleTask(r)) break;
        assignTask(r);
        if (r.state !== 'idle') break;   // 每帧至多指派一个，避免瞬间把所有机器人派空
      }
    }
  }
}

// 回收玩家身上的多余物资（对齐《异星工厂》：机器人带走多余物资存回网络）。
// 顺序：
//   1) 物流回收区（logiTrashGrid，相当于一个箱子）：格子里存放的物品，全部取走；
//   2) 「回收未请求物品」开启：背包中所有未设置请求的物品全部带走；
//   3) 个人物流请求超出部分：超出请求量的部分被机器人带走。
// 「背包物流」总开关关闭时不做任何玩家回收（回收也属于背包物流范畴）。
function assignRecycleTask(r) {
  if (G.logiEnabled === false) return false;
  const pt = playerLogiTarget();
  // 1) 优先回收「物流回收区」格子里存放的物品（回收区相当于一个箱子，机器人直接从中取走）
  const tg = G.logiTrashGrid;
  if (tg) {
    for (let i = 0; i < tg.length; i++) {
      const s = tg[i];
      if (!s || !ITEMS[s.item] || s.count <= 0) continue;
      const takeN = Math.min(robotCarryCap(), s.count);
      if (takeN <= 0) continue;
      r.carry = { item: s.item, count: takeN };
      r.target = playerTrashTarget();
      r.tx = (G.player ? G.player.x : 0);
      r.ty = (G.player ? G.player.y : 0);
      r.fromPlayer = true;
      r.state = 'collecting';
      return true;
    }
  }
  // 2) 「回收未请求物品」开启：回收背包中所有未请求的物品
  if (G.recycleUnrequested) {
    const reqSet = G.logiRequest || {};
    const carried = new Set();
    G.inv.forEach((n, k) => {
      if (n <= 0 || !ITEMS[k]) return;
      if (reqSet[k] > 0) return;         // 已请求的物品不回收
      if (carried.has(k)) return;
      carried.add(k);
      const takeN = Math.min(robotCarryCap(), n);
      if (takeN <= 0) return;
      r.carry = { item: k, count: takeN };
      r.target = pt;
      r.tx = (G.player ? G.player.x : 0);
      r.ty = (G.player ? G.player.y : 0);
      r.fromPlayer = true;
      r.state = 'collecting';
    });
    if (r.state === 'collecting') return true;
  }
  // 3) 回收「个人物流请求」超出部分
  if (G.logiRequest) {
    for (const item in G.logiRequest) {
      const want = G.logiRequest[item] || 0;
      if (want <= 0) continue;
      const excess = invCount(item) - want;
      if (excess <= 0) continue;
      const takeN = Math.min(robotCarryCap(), excess);
      if (takeN <= 0) continue;
      r.carry = { item, count: takeN };
      r.target = pt;
      r.tx = (G.player ? G.player.x : 0);
      r.ty = (G.player ? G.player.y : 0);
      r.fromPlayer = true;
      r.state = 'collecting';
      return true;
    }
  }
  return false;
}

// 回收物流箱（绿箱/蓝箱）「物流回收区」格子里存放的物品：机器人飞到箱子取走运回网络存储箱。
// 与玩家回收区同款实体箱子模型：回收区格子里的堆叠被机器人逐格取走。
// 只遍历 scanNetwork 缓存的需求箱/缓冲箱列表（G.logiNet.recycleChests），避免每帧全图扫描 G.ents。
function assignChestRecycleTask(r) {
  const rc = (G.logiNet && G.logiNet.recycleChests) || [];
  for (const e of rc) {
    if (e._dead) continue;
    const tg = e.trashGrid;
    if (!tg) continue;
    for (let i = 0; i < tg.length; i++) {
      const s = tg[i];
      if (!s || !ITEMS[s.item] || s.count <= 0) continue;
      const takeN = Math.min(robotCarryCap(), s.count);
      if (takeN <= 0) continue;
      r.carry = { item: s.item, count: takeN };
      r.target = chestTrashTarget(e);
      r.tx = (e.x + e.w / 2) * TILE;
      r.ty = (e.y + e.h / 2) * TILE;
      r.recycleEnt = e;
      r.state = 'collecting';
      return true;
    }
  }
  return false;
}

// ===== 渲染 =====
// 物流箱：箱体整体按各类型功能色上色，对齐《异星工厂》2.0 物流箱配色
// （官方中文文案：被动供货箱（红箱）/主动供货箱（紫箱）/被动存货箱（黄箱）/
//   优先集货箱（蓝箱）/主动存货箱（绿箱）），
// 盖顶上方信号灯随呼吸辉光、箱体正面底部信号条，一眼区分五类物流箱职能；
// 正面以 noCorner 省去护角，留给锁扣/双筋/信号条更干净。
// 每类一套与主题色匹配的金属漆渐变（tier 结构同 CHEST_TIERS，ribs=2 双加强筋）。
const LOGI_CHEST_TIERS = {
  passive:   { grad:['#e05a4a','#c43a2e','#8e241c'], lidG:['#ea6e5c','#c94634'], lidTop:'#f0876f', line:'#6b1c16', rib:'#b0362a', rivet:'#f5c2b8', pallet:'#4e1210', style:'metal', ribs:2, noCorner:true },
  active:    { grad:['#b279d8','#8e54c0','#64348c'], lidG:['#bd88e0','#9a63ca'], lidTop:'#caa0ec', line:'#4a2266', rib:'#7d4fa8', rivet:'#e4c8f5', pallet:'#3a1c50', style:'metal', ribs:2, noCorner:true },
  storage:   { grad:['#e6cf62','#cdb643','#a3881f'], lidG:['#eed874','#cfae45'], lidTop:'#f2e08a', line:'#6e5c14', rib:'#b39a33', rivet:'#f0e6b0', pallet:'#57470f', style:'metal', ribs:2, noCorner:true },
  requester: { grad:['#6f98dc','#5480c4','#3a5c8e'], lidG:['#7fa6e2','#5f8cd4'], lidTop:'#8fb0e8', line:'#2c4266', rib:'#4d76b0', rivet:'#bcd2f2', pallet:'#16243c', style:'metal', ribs:2, noCorner:true },
  buffer:    { grad:['#83c068','#5f9e46','#3f7229'], lidG:['#8fc978','#6aa84e'], lidTop:'#a3d689', line:'#2a4d18', rib:'#548a3c', rivet:'#d4ecc4', pallet:'#263d14', style:'metal', ribs:2, noCorner:true },
};
const LOGI_CHEST_ACCENTS = {
  passive:   { color: '#e04a3a' },  // 红：可被机器人取货
  active:    { color: '#a868d8' },  // 紫：优先供向网络
  storage:   { color: '#e8c83a' },  // 黄：收纳返还/多余货物
  requester: { color: '#5a8ad0' },  // 蓝：按需求收货
  buffer:    { color: '#68b04e' },  // 绿：中转缓冲
};
function drawLogiChest(ctx, e, gx, gy, dir, alpha, kind) {
  const A = LOGI_CHEST_ACCENTS[kind];
  const tier = LOGI_CHEST_TIERS[kind];
  const pulse = 0.55 + 0.3 * Math.sin((G.time || 0) * 5 + (gx * 7 + gy * 13));
  drawChestBox(ctx, e, gx, gy, dir, alpha, tier, (g, px, py) => {
    const cx = px + TILE / 2;
    // 盖顶上方信号灯座 + 呼吸灯（功能色，像天线指示灯凸起）
    g.fillStyle = '#232a34';
    rr(g, cx - 3, py + 3.1, 6, 2.2, 1); g.fill();
    g.fillStyle = A.color;
    g.beginPath(); g.arc(cx, py + 4.2, 1.7 + pulse * 0.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,' + (0.25 + pulse * 0.2).toFixed(2) + ')';
    g.beginPath(); g.arc(cx - 0.5, py + 3.9, 0.65, 0, Math.PI * 2); g.fill();
    // 箱体正面底部功能色信号条（带顶部高光/底缘收边）
    const barY = py + 22, barH = 2.4;
    g.fillStyle = A.color;
    rr(g, px + 7, barY, 18, barH, 1); g.fill();
    g.fillStyle = 'rgba(255,255,255,0.35)';
    rr(g, px + 7, barY, 18, 0.8, 0.4); g.fill();
    g.fillStyle = 'rgba(0,0,0,0.30)';
    rr(g, px + 7, barY + barH - 0.7, 18, 0.7, 0.35); g.fill();
  });
}
function drawLogiPassive(ctx, e, gx, gy, dir, alpha) {
  drawLogiChest(ctx, e, gx, gy, dir, alpha, 'passive');
}
function drawLogiActive(ctx, e, gx, gy, dir, alpha) {
  drawLogiChest(ctx, e, gx, gy, dir, alpha, 'active');
}
function drawLogiStorage(ctx, e, gx, gy, dir, alpha) {
  drawLogiChest(ctx, e, gx, gy, dir, alpha, 'storage');
}
function drawLogiRequester(ctx, e, gx, gy, dir, alpha) {
  drawLogiChest(ctx, e, gx, gy, dir, alpha, 'requester');
}
function drawLogiBuffer(ctx, e, gx, gy, dir, alpha) {
  drawLogiChest(ctx, e, gx, gy, dir, alpha, 'buffer');
}

// 机器人港实体渲染（对齐《异星工厂》Roboport 视觉语言：深青灰平台 + 四角停机坪 +
// 中央基塔 + 环绕跑道）。自下而上：地面投影 → 底座平台（面板收光、内嵌凹槽）→
// 四角机器人停机坪（停靠充电小圆台 + 呼吸信号灯）→ 双环跑道（外虚线环 = 机器人巡航
// 轨道，内环 = 归港减速带）→ 中央基塔（塔体 + 顶部天线）→ 塔顶呼吸灯；港内机器人数量
// 显示在塔顶下方。负责在地图上与机器人港面板图标（drawDeviceIcon 复用）呈现一致的样貌。
function drawRoboport(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE, s = e.w * TILE;
  const cx = px + s / 2, cy = py + s / 2;
  ctx.globalAlpha = alpha;
  const pulse = 0.5 + 0.35 * Math.sin((G.time || 0) * 4 + (gx * 7 + gy * 13));
  // ① 地面投影：整座平台的大椭圆阴影，托起视觉重心
  ctx.fillStyle = 'rgba(0,0,0,.34)';
  ctx.beginPath(); ctx.ellipse(cx, py + s * 0.93, s * 0.48, s * 0.13, 0, 0, Math.PI * 2); ctx.fill();
  // ② 底座平台：深青灰金属面板 + 外描边 + 顶面收光
  ctx.fillStyle = '#22393d';
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 6); ctx.fill();
  ctx.strokeStyle = '#0b1a1c';
  ctx.lineWidth = 2;
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 6); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.06)';
  rr(ctx, px + 6.5, py + 6.5, s - 13, s - 13, 4); ctx.fill();
  ctx.strokeStyle = 'rgba(150,220,208,.16)';
  ctx.lineWidth = 1;
  rr(ctx, px + 6.5, py + 6.5, s - 13, s - 13, 4); ctx.stroke();
  // ③ 四角机器人停机坪：机器人在此起降/停靠充能，带呼吸信号灯
  const padXY = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
  for (const [ox, oy] of padXY) {
    const pdx = cx + ox * s * 0.29, pdy = cy + oy * s * 0.29;
    ctx.fillStyle = '#163238';
    ctx.beginPath(); ctx.arc(pdx, pdy, s * 0.095, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(120,220,200,.4)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(pdx, pdy, s * 0.095, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(120,220,200,' + (0.3 + pulse * 0.25).toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(pdx, pdy, s * 0.028, 0, Math.PI * 2); ctx.fill();
  }
  // ④ 双环跑道：外虚线环（机器人巡航轨道）+ 内细环（归港减速带）
  ctx.strokeStyle = 'rgba(120,220,200,.5)';
  ctx.lineWidth = 2.6;
  ctx.setLineDash([s * 0.09, s * 0.06]);
  ctx.beginPath(); ctx.arc(cx, cy, s * 0.27, 0, Math.PI * 2); ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = 'rgba(120,220,200,.22)';
  ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.arc(cx, cy, s * 0.18, 0, Math.PI * 2); ctx.stroke();
  // ⑤ 中央基塔：塔座 + 塔身 + 顶部天线
  ctx.fillStyle = '#103f44';
  rr(ctx, cx - s * 0.115, cy - s * 0.16, s * 0.23, s * 0.32, 3); ctx.fill();
  ctx.strokeStyle = '#0a2c2f';
  ctx.lineWidth = 1.5;
  rr(ctx, cx - s * 0.115, cy - s * 0.16, s * 0.23, s * 0.32, 3); ctx.stroke();
  ctx.fillStyle = '#2e8f8f';
  rr(ctx, cx - s * 0.085, cy - s * 0.30, s * 0.17, s * 0.14, 2); ctx.fill();
  ctx.strokeStyle = '#0e383b';
  ctx.lineWidth = 1.2;
  rr(ctx, cx - s * 0.085, cy - s * 0.30, s * 0.17, s * 0.14, 2); ctx.stroke();
  // 塔顶天线 + 呼吸通讯灯（活跃时更亮）
  ctx.strokeStyle = '#8fdcd0';
  ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(cx, cy - s * 0.30); ctx.lineTo(cx, cy - s * 0.375); ctx.stroke();
  const ant = (e.roboCap > 0) ? 1 : 0.75;
  ctx.fillStyle = 'rgba(200,240,230,' + (0.55 + pulse * 0.45 * ant).toFixed(2) + ')';
  ctx.beginPath(); ctx.arc(cx, cy - s * 0.39, Math.max(1.8, s * 0.022 + pulse * s * 0.008), 0, Math.PI * 2); ctx.fill();
  // ⑥ 港内机器人数量（塔顶下方文字，有机器人才显示）
  if (e.roboCap > 0) {
    ctx.fillStyle = '#cfece8';
    ctx.font = 'bold ' + Math.max(9, s * 0.075) + 'px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(e.roboCap, cx, py + s * 0.86);
  }
  ctx.globalAlpha = 1;
}

// 渲染飞行中的物流机器人（render.js 在子弹后调用）
function drawLogisticsRobots(ctx) {
  if (!G.logiRobots || !G.techDone['logistics-network']) return;
  for (const r of G.logiRobots) {
    if (r._dead) continue;
    if (typeof onScreen === 'function' && !onScreen({ x: r.x / TILE, y: r.y / TILE, w: 1, h: 1 })) continue;
    const a = Math.atan2(r.ty - r.y, r.tx - r.x);
    // 投影阴影
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath();
    ctx.ellipse(r.x, r.y + 9, 6, 2.5, 0, 0, 7);
    ctx.fill();
    // 机身
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(a);
    ctx.fillStyle = r.charge < ROBOT_LOW_CHARGE ? '#c04040' : '#4aa0d0';
    ctx.beginPath();
    ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-3, 0); ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    // 携带的物品
    if (r.carry && r.carry.item) {
      drawItemDot(ctx, r.x + 10, r.y, r.carry.item);
    }
  }
}

// ===== 面板 =====
// 黄箱筛选格（单格，样式复用机械臂筛选槽）：点击设置一种物品，
// 设置后物流网络只向该箱存入此物品；箱内已有其它物品不受影响（仍可作货源被取走），
// 玩家/机械臂手动存取不受筛选限制（对齐官方：筛选仅约束物流网络）。
function logiStorageFilterHtml(e) {
  let h = '<div class="logi-flt"><span class="logi-flt-label">筛选</span>';
  if (e.filter) {
    h += '<div class="ins-slot" data-action="chest-flt-slot" title="点击重新选择筛选物品">' +
      '<img src="' + iconDataURL(e.filter) + '">' +
      '<span class="ins-slot-x" data-action="chest-flt-clear" title="清除筛选物品">✕</span></div>';
    h += '<span class="dim">物流网络只向此箱存入「' + (ITEMS[e.filter] ? ITEMS[e.filter].name : e.filter) + '」</span>';
  } else {
    h += '<div class="ins-slot empty" data-action="chest-flt-slot" title="点击选择筛选物品"><span class="ins-slot-plus">+</span></div>';
    h += '<span class="dim">未设置筛选：任意多余货物都可存入。点击格子设置后，物流网络只存入该物品</span>';
  }
  h += '</div>';
  return h;
}
// 箱子回收区实时刷新：机器人取走物品后格子变化时重建（签名比对，避免每帧闪烁）
function chestLogiRecycleSig(e) {
  let s = '';
  for (const st of (e && e.trashGrid) || []) s += (st ? st.item + ':' + st.count : '') + ',';
  return s;
}
function refreshChestLogiRecycle(e) {
  const box = document.getElementById('chest-logi-recycle');
  if (!box) return;
  const sig = chestLogiRecycleSig(e);
  if (box.dataset.sig === sig) return;
  box.dataset.sig = sig;
  box.innerHTML = chestLogiRecycleGridHtml(e);
}
function logiChestPanelHtml(e) {
  const agg = {};
  for (const s of e.slots) if (s) agg[s.item] = (agg[s.item] || 0) + s.count;
  const kind = LOGI_CHEST_KINDS[e.type];
  let total = 0;
  for (const k in agg) total += agg[k];
  let right = '<div class="status"></div>';
  right += '<div class="chest-items" id="chest-items">';
  right += chestSlotGridHtml(e);
  right += '</div>';
  if (kind === 'requester' || kind === 'buffer') {
    if (kind === 'buffer') {
      right += '<div class="dim">缓冲箱：请求货物后，也会向物流网络供应库存，作为中转缓冲。</div>';
    }
    right += '<div class="dim">下方「物流请求区」点击格子设置箱子需求（左键选择/修改数量，右键清除），物流机器人会自动送货入箱；把物品拖入「物流回收区」，机器人会从这里取走运回网络。</div>';
    right += '<div class="chest-logi-area">' + chestLogiColHtml(e) + '</div>';
  } else {
    if (kind === 'storage') right += logiStorageFilterHtml(e);
    if (total > 0) right += '<button data-action="takeout" id="btn-chest-takeout">取出全部 (' + total + ')</button>';
  }
  right += '<div class="dim">' + ITEMS[e.type].desc + '</div>';
  const left = htmlInventory();
  return '<div class="inv-layout machine-layout chest-layout">' +
    '<div class="inv-col inv-col-left" id="inv-col-left"><div class="inv-col-head">🎒 玩家</div>' +
    '<div class="inv-col-body" id="inv-mat">' + left + '</div></div>' +
    '<div class="inv-col inv-col-right" id="inv-col-right"><div class="inv-col-head">📦 ' + ITEMS[e.type].name + '（物流箱）</div>' +
    '<div class="inv-col-body">' + right + '</div></div>' +
  '</div>';
}

function logiChestPanelLive(e, api) {
  const agg = {};
  let total = 0;
  for (const s of e.slots) if (s) { agg[s.item] = (agg[s.item] || 0) + s.count; total += s.count; }
  const kinds = Object.keys(agg).length;
  refreshChestGrid(e);
  api.toggle('#btn-chest-takeout', total > 0, '取出全部 (' + total + ')');
  const kind = LOGI_CHEST_KINDS[e.type];
  if (kind === 'requester' || kind === 'buffer') {
    refreshChestLogiRecycle(e);
    const short = Object.keys(e.requests).filter(k => e.deficitOf(k) > 0).length;
    if (short) api.status('需求待补：' + short + ' 种，物流机器人正在配送…', 'ok');
    else if (Object.keys(e.requests).length) api.status('需求已满足', 'ok');
    else api.status('未设置需求', 'warn');
  } else if (kind === 'storage') {
    api.status(total > 0 ? '仓储收纳中：' + kinds + ' 种，共 ' + total + ' 件' : '空仓储箱', total ? 'ok' : 'warn');
  } else {
    api.status(total > 0 ? '供应箱库存：' + kinds + ' 种，共 ' + total + ' 件' : '空供应箱：等待放入货物', total ? 'ok' : 'warn');
  }
}

function logiRequesterOnChange(ev) {
  const req = ev.target.closest('[data-req]');
  if (!req) return false;
  const e = G.panelEnt;
  if (!(e instanceof LogisticRequester) && !(e instanceof LogisticBuffer)) return false;
  const id = req.dataset.req;
  let v = Math.floor(+req.value);
  if (!isFinite(v) || v <= 0) { delete e.requests[id]; req.value = ''; }
  else { e.requests[id] = v; req.value = v; }
  uiDirty = true;
  return true;
}

function logiChestOnAction(act) {
  const e = G.panelEnt;
  if (!(e instanceof LogisticChest)) return false;
  if (e instanceof LogisticStorage && act === 'chest-flt-slot') {
    if (typeof openChestFilterChooser === 'function') openChestFilterChooser(e);
    return true;
  }
  if (e instanceof LogisticStorage && act === 'chest-flt-clear') {
    e.filter = null; uiDirty = true; renderPanel(false);
    return true;
  }
  if (act === 'logi-req-clear' && (e instanceof LogisticRequester || e instanceof LogisticBuffer)) {
    e.requests = {};
    renderPanel(false);
    return true;
  }
  if (act === 'logi-req-apply' && (e instanceof LogisticRequester || e instanceof LogisticBuffer)) {
    const input = document.getElementById('logi-req-add');
    if (!input) return true;
    const name = input.value.trim();
    // 按名称或 id 匹配物品
    let id = null;
    for (const k in ITEMS) if (ITEMS[k].name === name) { id = k; break; }
    if (!id) id = ITEMS[name] ? name : null;
    if (!id) { toast('未找到物品「' + name + '」'); return true; }
    if (!e.requests[id]) e.requests[id] = 50;
    else e.requests[id] += 10;
    input.value = '';
    uiDirty = true;
    renderPanel(false);
    return true;
  }
  return false;
}

function logiChestTip(e) {
  let n = 0, k = 0;
  for (const s of e.slots) if (s) { n += s.count; k++; }
  if (e instanceof LogisticRequester || e instanceof LogisticBuffer) {
    const short = Object.keys(e.requests).filter(i => e.deficitOf(i) > 0).length;
    return (k ? '存货 ' + n + ' 个' : '空') + (short ? ' · 待补 ' + short + ' 种' : '');
  }
  return (k ? '存货 ' + n + ' 个（' + k + ' 种）' : '空箱') +
    (e instanceof LogisticStorage && e.filter ? ' · 筛选：' + (ITEMS[e.filter] ? ITEMS[e.filter].name : e.filter) : '');
}
// 机器人港建筑实体悬浮提示（注意：勿与 equipment.js 的 roboportTip(id 字符串) 重名，
// 那个供背包/装备格 tooltip 读取 id 描述；本函数接收港实体 e，展示实时机器人数）
function roboportEntTip(e) {
  const rp = e.matCount('repair-pack');
  const logi = e.countOf('logistic-robot'), constr = e.countOf('construction-robot');
  let t = '物流机器人 ' + logi + ' 台';
  if (constr > 0) t += ' · 建设机器人 ' + constr + ' 台';
  if (rp > 0) t += ' · 修理包 ' + rp + ' 个';
  t += (e.roboCap > 0 ? ' · 网络运行中' : '（把物流/建设机器人放入）');
  return t;
}

// ===== 机器人港面板（对齐《异星工厂》Roboport GUI）=====
// 双栏布局：左栏 = 玩家背包，右栏 = 机器人港操作面板。
// 右栏结构（自上而下）：
//   ① 状态行（状态点 + 状态文字，通用机器外壳）
//   ② 机器人平台样式展示：与地图同款 drawRoboport 图标（机器画布）
//   ③ 两排槽位（每排 7 格）：第一排 = 机器人槽（物流/建设机器人共用，每格可堆叠 50 台），第二排 = 修理包（每格堆叠）
// 槽位交互完全复用背包/箱子通用的「持握于鼠标」机制（ui-panel.js 的 data-chestslot 分支）：
//   - 点击有物品的格子：整叠拿起悬浮于鼠标（可放入背包/箱格/设备格，点同格放回，Q 取消）
//   - 点击空槽：背包已选中（幽灵持握）对应物品时放入 1 件；鼠标正持握物品时尽量整叠放入（装满为止）
//   - Shift+左键 移动一整组 / Ctrl+左键 移动全部同类 / Shift+右键 拿取或放入一半 —— 与其他物品完全一致
// 机械臂也可直接向机器人港放入物流机器人/修理包（见 inserter.js canDropAt 的 roboport 分支）。
// 格子使用全局索引：机器人槽 i → slots[i]；修理包槽 j → slots[ROBOT_SLOT_COUNT + j]。
function roboportSlotsHtml(e) {
  // 持握来源格（物品已移出悬浮于鼠标）高亮，点击可放回
  const heldSlot = (G.held && G.held.src && G.held.src.kind === 'chest' && G.held.src.ent === e) ? G.held.src.slot : -1;
  let h = '<div class="robo-row"><div class="robo-slot-row">';
  for (let i = 0; i < ROBOT_SLOT_COUNT; i++) {
    const s = e.slots[i];
    const sel = (heldSlot === i) ? ' slot-sel' : '';
    h += (s && s.count > 0)
      ? '<div class="inv-slot robo-slot' + sel + '" data-chestslot="' + i + '" data-itemid="' + s.item + '" data-tip="' +
        (ITEMS[s.item] ? ITEMS[s.item].name : s.item) +
        '|点击拿起整叠悬浮于鼠标：可放入背包/箱格/设备格（当前 ' + s.count + ' 台，每格最多 ' + ROBOT_SLOT_MAX + ' 台）">' +
        '<img src="' + iconDataURL(s.item) + '"><span class="cnt">' + s.count + '</span></div>'
      : '<div class="inv-slot empty robo-slot' + sel + '" data-chestslot="' + i + '" data-tip="' +
        (heldSlot === i ? '放回原格|点击把手持机器人放回此处' : '空槽|拿起物品后点击此格放入（物流/建设机器人，每格最多 ' + ROBOT_SLOT_MAX + ' 台）') + '"></div>';
  }
  h += '</div></div>';
  h += '<div class="robo-row">' +
    '<div class="robo-row-label">🧰 修理包 <b data-live="mat-cnt">' + e.matCount('repair-pack') + '</b></div>' +
    '<div class="robo-slot-row">';
  for (let j = 0; j < MAT_SLOT_COUNT; j++) {
    const gi = ROBOT_SLOT_COUNT + j;
    const s = e.slots[gi];
    const sel = (heldSlot === gi) ? ' slot-sel' : '';
    h += (s && s.count > 0)
      ? '<div class="inv-slot robo-slot' + sel + '" data-chestslot="' + gi + '" data-itemid="repair-pack" data-tip="' +
        (ITEMS['repair-pack'] ? ITEMS['repair-pack'].name : 'repair-pack') + '|点击拿起整叠悬浮于鼠标（当前 ' + s.count + ' 个）">' +
        '<img src="' + iconDataURL('repair-pack') + '"><span class="cnt">' + s.count + '</span></div>'
      : '<div class="inv-slot empty robo-slot' + sel + '" data-chestslot="' + gi + '" data-tip="' +
        (heldSlot === gi ? '放回原格|点击把手持修理包放回此处' : '空槽|拿起物品后点击此格放入（修理包）') + '"></div>';
  }
  h += '</div></div>';
  return h;
}
// 槽位内容签名：机器人/修理包槽、鼠标持握或持握来源高亮格变化时才重建，避免每帧 innerHTML 重建导致闪烁、点击丢失
function roboportSlotSig(e) {
  const heldSlot = (G.held && G.held.src && G.held.src.kind === 'chest' && G.held.src.ent === e) ? G.held.src.slot : -1;
  let s = heldSlot + '|' + (G.held ? G.held.id + ':' + G.held.count : '') + '|';
  for (const v of e.slots) s += (v && v.count > 0) ? v.item + ':' + v.count + ';' : '0;';
  return s;
}
function refreshRoboportSlots(e) {
  const box = document.getElementById('robo-slots');
  if (!box) return;
  const sig = roboportSlotSig(e);
  if (box.dataset.sig === sig) return;
  box.dataset.sig = sig;
  box.innerHTML = roboportSlotsHtml(e);
}
function roboportRightHtml(e) {
  // 仅渲染两排槽位：状态区与机器展示由统一操控面板外壳（asm3-status / asm3-machine）提供，
  // 说明文字与批量按钮（投入/取出全部）不再展示（槽位点击交互已覆盖放入/取出）。
  return '<div class="robo-slots" id="robo-slots">' + roboportSlotsHtml(e) + '</div>';
}
// 机器人港操作面板内容：直接输出右侧槽位区（无标题栏、无内嵌玩家栏），
// 统一设备面板（unifiedMachineLayoutHtml）外层已提供「左侧玩家背包 + 操控面板外壳」，
// 操控面板本身 overflow-y:auto，内容超高时随面板滚动。
function roboportPanelHtml(e) {
  return roboportRightHtml(e);
}
function roboportPanelLive(e, api, body) {
  // 槽位实时刷新（签名比对，机械臂装入或机器人变化时即时更新，避免闪烁）
  refreshRoboportSlots(e);
  api.set('robo-cnt', e.roboCap + '/' + ROBOPORT_CAP);
  api.set('mat-cnt', String(e.matCount('repair-pack')));
  const mats = e.matCount('repair-pack');
  const logi = e.countOf('logistic-robot'), constr = e.countOf('construction-robot');
  if (e.roboCap > 0) {
    api.status('网络运行中 · 物流机器人 ' + logi + ' 台' + (constr > 0 ? ' · 建设机器人 ' + constr + ' 台' : '') + (mats > 0 ? ' · 修理包 ' + mats + ' 个' : ''), 'ok');
  } else {
    api.status('无机器人 · 请点击空槽放入物流/建设机器人，或放机械臂从传送带/箱子抓取装入', 'warn');
  }
}

// ===== 注册 =====
ENT_CLASSES['roboport'] = Roboport;
DEVICE_RENDER['roboport'] = drawRoboport;
DEVICE_DIR_ROTATE['roboport'] = true; // 支持旋转
DEVICE_PANEL['roboport'] = {
  html: roboportPanelHtml,
  live: roboportPanelLive,
  tip: roboportTip
};

ENT_CLASSES['passive-provider-chest'] = LogisticPassive;
ENT_CLASSES['active-provider-chest'] = LogisticActive;
ENT_CLASSES['storage-chest'] = LogisticStorage;
ENT_CLASSES['requester-chest'] = LogisticRequester;
ENT_CLASSES['buffer-chest'] = LogisticBuffer;
DEVICE_RENDER['passive-provider-chest'] = drawLogiPassive;
DEVICE_DIR_ROTATE['passive-provider-chest'] = true; // 支持旋转
DEVICE_RENDER['active-provider-chest'] = drawLogiActive;
DEVICE_DIR_ROTATE['active-provider-chest'] = true; // 支持旋转
DEVICE_RENDER['storage-chest'] = drawLogiStorage;
DEVICE_DIR_ROTATE['storage-chest'] = true; // 支持旋转
DEVICE_RENDER['requester-chest'] = drawLogiRequester;
DEVICE_DIR_ROTATE['requester-chest'] = true; // 支持旋转
DEVICE_RENDER['buffer-chest'] = drawLogiBuffer;
DEVICE_DIR_ROTATE['buffer-chest'] = true; // 支持旋转
for (const t of Object.keys(LOGI_CHEST_KINDS)) {
  DEVICE_PANEL[t] = { html: logiChestPanelHtml, live: logiChestPanelLive, tip: logiChestTip, onAction: logiChestOnAction, onChange: logiRequesterOnChange };
}
