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
  'logistic-chest-passive': 'passive',
  'logistic-chest-active': 'active',
  'logistic-chest-storage': 'storage',
  'logistic-chest-requester': 'requester',
  'logistic-chest-buffer': 'buffer'
};
const ROBOT_SPEED = GAME_DATA.robotSpeed?.logistic ?? 3.0;  // 物流机器人飞行速度（格/秒，官方 logistic-robot speed 0.05×60=3.0）
const ROBOT_MAX_CHARGE = 100;   // 满电
const ROBOT_CHARGE_DRAIN = 2.2; // 每秒飞行耗电
const ROBOT_CHARGE_RATE = 40;   // 回港每秒充电量
const ROBOT_LOW_CHARGE = 20;    // 低于此值回家充电
const ROBOT_CARRY = 3;          // 单次最多搬运同类物品数量（基础值，可由「机器人容量」无限科技提升，见 robotCarryCap()）
const ROBOT_NET_T = 0.5;        // 网络调度复算间隔
const ROBOPORT_CAP = 50;        // 单机器人港最多容纳的机器人数量
const ROBOPORT_POWER_IDLE = GAME_DATA.roboportPower ?? 40; // 机器人港基础耗电（kW，官方 energy_usage 50kW）

// 机器人港实体
class Roboport extends CircuitNode {
  constructor(type, x, y) {
    super('roboport', x, y);
    this.roboCap = 0;   // 已投入的物流机器人数量（往港里塞 logistic-robot 增加）
  }
  // 电路网络信号输出（对齐《异星工厂》：机器人港可接入电路网络读取所在物流网络物资）。
  // 把整个物流网络中供应箱/仓储箱内的每种物品总量以该物品为信号输出，
  // 供组合器/功率开关/告警音箱读取，实现按网络库存的自动化调度。
  outputCircuitSignals() {
    const net = G.logiNet;
    if (!net || !net.signals) return [];
    return net.signals;   // 复用 scanNetwork 预计算好的信号缓存（性能优化）
  }
  giveItem(item) {
    if (item !== 'logistic-robot') return false;
    if (this.roboCap >= ROBOPORT_CAP) return false;
    this.roboCap++;
    if (typeof playSfx === 'function') playSfx('robot');
    return true;
  }
  takeItem() {
    if (this.roboCap <= 0) return null;
    this.roboCap--;
    // 若已派生出超出新上限的机器人，回收多余空闲机器人
    retireExcessRobots(this);
    if (typeof playSfx === 'function') playSfx('robot');
    return 'logistic-robot';
  }
  countOf(item) { return item === 'logistic-robot' ? this.roboCap : 0; }
  takeItemOf(item) {
    if (item !== 'logistic-robot' || this.roboCap <= 0) return null;
    return this.takeItem();
  }
  powerDemand() {
    // 港内已有机器人或网络有需求时才耗电；否则闲置省电
    if (this.roboCap > 0) return ROBOPORT_POWER_IDLE;
    return 0;
  }
  contents() {
    return [[this.type, 1]].concat(this.roboCap > 0 ? [['logistic-robot', this.roboCap]] : []);
  }
  serialize() {
    const s = super.serialize();
    s.roboCap = this.roboCap;
    return s;
  }
  blueprint() {
    const s = super.blueprint();
    s.roboCap = this.roboCap;   // 蓝图保留机器人数量配置
    return s;
  }
  static restore(s) {
    const e = super.restore(s);
    e.roboCap = s.roboCap | 0;
    return e;
  }
}

// ===== 物流箱基类（四类共用槽位逻辑，容量与储物箱一致）=====
class LogisticChest extends Entity {
  constructor(type, x, y) {
    super(type, x, y);
    this.slots = [];
  }
  giveItem(item) {
    for (const s of this.slots)
      if (s && s.item === item && s.count < stackSize(item)) { s.count++; return true; }
    if (this.slots.length >= 12) return false;
    this.slots.push({ item, count: 1 });
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
        if (s.count <= 0) this.slots.splice(i, 1);
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
        if (st.count <= 0) this.slots.splice(i, 1);
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
    this.slots = [];
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
    c.slots = (s.slots || []).map(v => v ? { item: v[0], count: v[1] } : null);
    return c;
  }
}

// 被动供应箱：机器人可取货，也接收返还
class LogisticPassive extends LogisticChest {
  constructor(type, x, y) { super('logistic-chest-passive', x, y); }
}
// 主动供应箱：机器人优先取货，收纳过剩
class LogisticActive extends LogisticChest {
  constructor(type, x, y) { super('logistic-chest-active', x, y); }
}
// 仓储箱：机器人收纳返还/多余货物，也可作备用取货源
class LogisticStorage extends LogisticChest {
  constructor(type, x, y) { super('logistic-chest-storage', x, y); }
}
// 需求箱：设置每种物品需求量，机器人自动送货补足
class LogisticRequester extends LogisticChest {
  constructor(type, x, y) {
    super('logistic-chest-requester', x, y);
    this.requests = {};   // item -> 目标数量
  }
  // 需求缺口：目标量 - 当前存量
  deficitOf(item) {
    return Math.max(0, (this.requests[item] || 0) - this.countOf(item));
  }
  serialize() {
    const s = super.serialize();
    s.requests = this.requests;
    return s;
  }
  static restore(s) {
    const c = super.restore(s);
    c.requests = {};
    for (const k in (s.requests || {})) if (s.requests[k] > 0) c.requests[k] = s.requests[k];
    return c;
  }
}

// 缓冲箱（对齐《异星工厂》Buffer chest 0.17+）：介于需求箱与仓储箱之间
// 既按设定请求货物（如需求箱），又向物流网络供应（如仓储箱），作为中转缓冲
class LogisticBuffer extends LogisticChest {
  constructor(type, x, y) {
    super('logistic-chest-buffer', x, y);
    this.requests = {};   // item -> 目标数量
  }
  // 需求缺口：目标量 - 当前存量
  deficitOf(item) {
    return Math.max(0, (this.requests[item] || 0) - this.countOf(item));
  }
  serialize() {
    const s = super.serialize();
    s.requests = this.requests;
    return s;
  }
  static restore(s) {
    const c = super.restore(s);
    c.requests = {};
    for (const k in (s.requests || {})) if (s.requests[k] > 0) c.requests[k] = s.requests[k];
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
  let excess = mine.length - port.roboCap;
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
function ensurePortRobots() {
  const ports = (G.logiNet && G.logiNet.ports) || null;
  if (ports) {
    for (const e of ports) {
      if (e._dead) continue;
      let mine = 0;
      for (const r of G.logiRobots) if (r.home === e && !r._dead) mine++;
      for (let i = mine; i < e.roboCap; i++) spawnRobotAt(e);
    }
    return;
  }
  // 兜底：尚无缓存时（如物流网络刚解锁、首次调度）再全量遍历一次
  for (const e of G.ents) {
    if (!(e instanceof Roboport) || e._dead) continue;
    let mine = 0;
    for (const r of G.logiRobots) if (r.home === e && !r._dead) mine++;
    for (let i = mine; i < e.roboCap; i++) spawnRobotAt(e);
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

// ===== 网络调度：计算供应与需求缺口，指派空闲机器人 =====
function scanNetwork() {
  // 供应：按物品聚合 { item -> count }，区分主动/被动/仓储优先级
  const supply = {};     // item -> { total, active }  active=主动供应箱中可立即提供的量
  const supplies = [];   // 所有可作为取货源的箱子 [{e, item, count}]
  const demand = {};     // item -> 总缺口
  const requesters = []; // 需求箱列表
  const ports = [];      // 机器人港列表

  for (const e of G.ents) {
    if (e._dead) continue;
    if (e instanceof Roboport) { ports.push(e); continue; }
    if (!(e instanceof LogisticChest)) continue;
    // 需求类：需求箱与缓冲箱都会按设定请求货物（缓冲箱同时是供应源，不 continue）
    if (e instanceof LogisticRequester || e instanceof LogisticBuffer) {
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

  // 玩家个人物流请求：作为额外的需求端（仅当玩家有个人请求且背包缺货时）
  if (G.logiRequest) {
    const pt = playerLogiTarget();
    let anyReq = false;
    for (const k in G.logiRequest) {
      const d = pt.deficitOf(k);
      if (d > 0) { demand[k] = (demand[k] || 0) + d; anyReq = true; }
    }
    if (anyReq) requesters.push(pt);
  }

  // 赋值给全局供调度使用
  G.logiNet = { supply, supplies, demand, requesters, ports };
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
      if (G.power.sat > 0) {
        r.charge = Math.min(ROBOT_MAX_CHARGE, r.charge + ROBOT_CHARGE_RATE * dt * Math.max(G.power.sat, 0.2));
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
        if (r.fromPlayer) {
          // 回收场景：从玩家取货后送回一个可存放的供应箱（仓储/主动/被动箱）
          const drop = (G.ents || []).find(e => !e._dead && e instanceof LogisticChest && !(e instanceof LogisticRequester) && e !== r.target && e.countOf && e.giveItem);
          if (r.carry && r.carry.count > 0 && drop) {
            r.target = drop;
            r.tx = (drop.x + drop.w / 2) * TILE;
            r.ty = (drop.y + drop.h / 2) * TILE;
            r.state = 'delivering';
            r.fromPlayer = false;
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
    if (G.logiRequest) {
      for (const k in G.logiRequest) if (G.logiRequest[k] > 0) { hasWork = true; break; }
    }
    // 个人垃圾桶标记有物品待回收也算作有工作（对齐《异星工厂》Trash slots）
    if (!hasWork && G.trashSlots) {
      for (const k in G.trashSlots) if (G.trashSlots[k] && invCount(k) > 0) { hasWork = true; break; }
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
        assignTask(r);
        if (r.state !== 'idle') break;   // 每帧至多指派一个，避免瞬间把所有机器人派空
      }
    }
  }
}

// 回收玩家身上的多余物资（对齐《异星工厂》：机器人带走多余物资存回网络）。
// 分两类：
//   1) 个人物流请求（logiRequest）：玩家身上超出请求量的部分被机器人带走；
//   2) 个人垃圾桶（trashSlots）：玩家主动标记为“丢弃”的物品，机器人会全部带走（无视请求量）。
function assignRecycleTask(r) {
  if (!G.logiRequest) return false;
  const pt = playerLogiTarget();
  // 优先回收「个人垃圾桶」中标记的物品（对齐《异星工厂》Trash slots：标记即带走）
  if (G.trashSlots) {
    for (const item in G.trashSlots) {
      if (!G.trashSlots[item]) continue;
      const have = invCount(item);
      if (have <= 0) continue;
      const takeN = Math.min(robotCarryCap(), have);
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
  // 其次回收「个人物流请求」超出部分（原有逻辑，保持语义不变）
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
  return false;
}

// ===== 渲染 =====
function drawLogiChestBase(ctx, px, py, base, lid, stroke, alpha) {
  ctx.globalAlpha = alpha;
  ctx.fillStyle = base;
  rr(ctx, px + 4, py + 8, TILE - 8, TILE - 13, 3); ctx.fill();
  ctx.fillStyle = lid;
  rr(ctx, px + 4, py + 5, TILE - 8, 10, 3); ctx.fill();
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 1.5;
  rr(ctx, px + 4, py + 8, TILE - 8, TILE - 13, 3); ctx.stroke();
  ctx.globalAlpha = 1;
}
function drawLogiChest(ctx, e, gx, gy, dir, alpha, colors, mark) {
  const px = gx * TILE, py = gy * TILE;
  drawLogiChestBase(ctx, px, py, colors.base, colors.lid, colors.stroke, alpha);
  // 物流标记徽章
  ctx.fillStyle = colors.badge;
  ctx.beginPath();
  ctx.arc(px + TILE - 7, py + 7, 5, 0, 7);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 7px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(mark, px + TILE - 7, py + 7);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}
function drawLogiPassive(ctx, e, gx, gy, dir, alpha) {
  drawLogiChest(ctx, e, gx, gy, dir, alpha, { base: '#9c7c2e', lid: '#b89a4a', stroke: '#6a5620', badge: '#8a6a2a' }, '供');
}
function drawLogiActive(ctx, e, gx, gy, dir, alpha) {
  drawLogiChest(ctx, e, gx, gy, dir, alpha, { base: '#b06a2e', lid: '#c98a4a', stroke: '#7a4a20', badge: '#d0743a' }, '主');
}
function drawLogiStorage(ctx, e, gx, gy, dir, alpha) {
  drawLogiChest(ctx, e, gx, gy, dir, alpha, { base: '#6a7a4a', lid: '#84945e', stroke: '#4a5630', badge: '#8a9a6a' }, '仓');
}
function drawLogiRequester(ctx, e, gx, gy, dir, alpha) {
  drawLogiChest(ctx, e, gx, gy, dir, alpha, { base: '#4a6a9c', lid: '#5f84b8', stroke: '#334a6a', badge: '#5a8ad0' }, '需');
}
function drawLogiBuffer(ctx, e, gx, gy, dir, alpha) {
  drawLogiChest(ctx, e, gx, gy, dir, alpha, { base: '#9c8a4a', lid: '#b8a860', stroke: '#6a5e2e', badge: '#c8a05a' }, '缓');
}

function drawRoboport(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE, s = e.w * TILE;
  ctx.globalAlpha = alpha;
  // 底板
  ctx.fillStyle = '#23484c';
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 5); ctx.fill();
  ctx.strokeStyle = '#0f2426';
  ctx.lineWidth = 2;
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 5); ctx.stroke();
  // 跑道环
  ctx.strokeStyle = 'rgba(120,220,200,.5)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(px + s / 2, py + s / 2, s * 0.22, 0, 7);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(120,220,200,.25)';
  ctx.beginPath();
  ctx.arc(px + s / 2, py + s / 2, s * 0.38, 0, 7);
  ctx.stroke();
  // 中央基站
  ctx.fillStyle = '#3a8a8a';
  ctx.beginPath();
  ctx.arc(px + s / 2, py + s / 2, s * 0.13, 0, 7);
  ctx.fill();
  ctx.strokeStyle = '#1e5052';
  ctx.lineWidth = 2;
  ctx.stroke();
  // 港内机器人数量
  if (e.roboCap > 0) {
    ctx.fillStyle = '#cfece8';
    ctx.font = 'bold ' + Math.max(9, s * 0.09) + 'px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(e.roboCap, px + s / 2, py + s * 0.42);
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
function logiChestPanelHtml(e) {
  const agg = {};
  for (const s of e.slots) if (s) agg[s.item] = (agg[s.item] || 0) + s.count;
  let h = row('内容', Object.keys(agg).length ? countStr(agg) : '<span class="dim">空</span>', 'contents');
  h += '<div class="status"></div>';
  const kind = LOGI_CHEST_KINDS[e.type];
  if (kind === 'requester' || kind === 'buffer') {
    h += '<div class="sec">需求量（机器人自动送货补足）</div>';
    const ids = Object.keys(e.requests);
    if (!ids.length) {
      h += '<div class="dim">尚未设置需求。下方为每种物品设置目标数量，物流机器人会自动从供应箱/仓储箱搬运货物过来，直到达到目标数量。</div>';
    } else {
      for (const id of ids) {
        h += '<div class="limitrow">' + chip(id, e.countOf(id)) +
          '<input class="limit-in" type="number" min="0" step="10" data-req="' + id + '"' +
          ' value="' + (e.requests[id] || 0) + '" data-tip="需求量|物流机器人会送货至此数量；0 表示不需求"></div>';
      }
    }
    if (kind === 'buffer') {
      h += '<div class="dim">缓冲箱：请求货物后，也会向物流网络供应库存，作为中转缓冲。</div>';
    }
    h += '<div class="dim">提示：在下方输入物品名后点击「应用需求」。</div>';
    h += '<div class="sec">添加需求物品</div>';
    h += '<input id="logi-req-add" class="inv-search" type="text" placeholder="输入物品名…" autocomplete="off">';
    h += '<button data-action="logi-req-apply">应用需求</button>';
    h += '<button data-action="logi-req-clear">清空全部需求</button>';
  } else {
    h += '<div class="dim">' + ITEMS[e.type].desc + '</div>';
    if (Object.keys(agg).length) h += '<button data-action="takeout" id="btn-chest-takeout">取出全部 (' + Object.values(agg).reduce((a, b) => a + b, 0) + ')</button>';
  }
  return h;
}

function logiChestPanelLive(e, api) {
  const agg = {};
  let total = 0;
  for (const s of e.slots) if (s) { agg[s.item] = (agg[s.item] || 0) + s.count; total += s.count; }
  api.set('contents', Object.keys(agg).length ? countStr(agg) : dimSpan('空'));
  api.toggle('#btn-chest-takeout', total > 0, '取出全部 (' + total + ')');
  const kind = LOGI_CHEST_KINDS[e.type];
  if (kind === 'requester' || kind === 'buffer') {
    const short = Object.keys(e.requests).filter(k => e.deficitOf(k) > 0).length;
    if (short) api.status('需求待补：' + short + ' 种，物流机器人正在配送…', 'ok');
    else if (Object.keys(e.requests).length) api.status('需求已满足', 'ok');
    else api.status('未设置需求', 'warn');
  } else if (kind === 'storage') {
    api.status(total > 0 ? '仓储收纳中：' + Object.keys(agg).length + ' 种，共 ' + total + ' 件' : '空仓储箱', total ? 'ok' : 'warn');
  } else {
    api.status(total > 0 ? '供应箱库存：' + Object.keys(agg).length + ' 种，共 ' + total + ' 件' : '空供应箱：等待放入货物', total ? 'ok' : 'warn');
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
  return (k ? '存货 ' + n + ' 个（' + k + ' 种）' : '空箱');
}
function roboportTip(e) {
  return '机器人 ' + e.roboCap + ' 台' + (e.roboCap > 0 ? ' · 网络运行中' : '（把物流机器人放入）');
}

// ===== 注册 =====
ENT_CLASSES['roboport'] = Roboport;
DEVICE_RENDER['roboport'] = drawRoboport;
DEVICE_DIR_ROTATE['roboport'] = true; // 支持旋转
DEVICE_PANEL['roboport'] = {
  html: e => {
    let h = row('机器人', e.roboCap + ' 台', 'robo');
    h += '<div class="status"></div>';
    h += '<div class="dim">把「物流机器人」放入此港，机器人会自动在供应箱与需求箱之间搬运货物。电量不足时回港充电（消耗电力）。</div>';
    if (e.roboCap > 0) h += '<div class="dim">已调度：物流网络覆盖全图。</div>';
    else h += '<button data-action="robo-add">投入 1 台物流机器人</button>';
    h += '<button data-action="robo-takeout">取出全部机器人</button>';
    return h;
  },
  live: (e, api) => {
    api.set('robo', e.roboCap + ' 台');
    if (e.roboCap > 0) api.status('网络运行中 · 机器人 ' + e.roboCap + ' 台', 'ok');
    else api.status('无机器人 · 请投入物流机器人', 'warn');
  },
  tip: roboportTip,
  onAction: act => {
    const e = G.panelEnt;
    if (!(e instanceof Roboport)) return false;
    if (act === 'robo-add') {
      if (invCount('logistic-robot') < 1) { toast('背包里没有物流机器人'); return true; }
      if (!invTake('logistic-robot', 1)) return true;
      if (!e.giveItem('logistic-robot')) { invAdd('logistic-robot', 1); toast('机器人港已满'); }
      uiDirty = true;
      return true;
    }
    if (act === 'robo-takeout') {
      const n = e.roboCap;
      if (n > 0) { invAdd('logistic-robot', n); e.roboCap = 0; retireExcessRobots(e); toast('取回 ' + n + ' 台物流机器人'); }
      uiDirty = true;
      return true;
    }
    return false;
  }
};

ENT_CLASSES['logistic-chest-passive'] = LogisticPassive;
ENT_CLASSES['logistic-chest-active'] = LogisticActive;
ENT_CLASSES['logistic-chest-storage'] = LogisticStorage;
ENT_CLASSES['logistic-chest-requester'] = LogisticRequester;
ENT_CLASSES['logistic-chest-buffer'] = LogisticBuffer;
DEVICE_RENDER['logistic-chest-passive'] = drawLogiPassive;
DEVICE_DIR_ROTATE['logistic-chest-passive'] = true; // 支持旋转
DEVICE_RENDER['logistic-chest-active'] = drawLogiActive;
DEVICE_DIR_ROTATE['logistic-chest-active'] = true; // 支持旋转
DEVICE_RENDER['logistic-chest-storage'] = drawLogiStorage;
DEVICE_DIR_ROTATE['logistic-chest-storage'] = true; // 支持旋转
DEVICE_RENDER['logistic-chest-requester'] = drawLogiRequester;
DEVICE_DIR_ROTATE['logistic-chest-requester'] = true; // 支持旋转
DEVICE_RENDER['logistic-chest-buffer'] = drawLogiBuffer;
DEVICE_DIR_ROTATE['logistic-chest-buffer'] = true; // 支持旋转
for (const t of Object.keys(LOGI_CHEST_KINDS)) {
  DEVICE_PANEL[t] = { html: logiChestPanelHtml, live: logiChestPanelLive, tip: logiChestTip, onAction: logiChestOnAction, onChange: logiRequesterOnChange };
}
