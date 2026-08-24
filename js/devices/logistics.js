'use strict';

// ===== 物流机器人网络（对齐《异星工厂》Logistic network）=====
// 组成：
//   RoboPort 机器人港口（4×4）：覆盖半径 ROBO_COVER_R，为停靠机器人充电、派发任务
//   LogiChest 物流箱族：被动物流箱（供货）/ 存储物流箱（次级供货）/ 请求物流箱（按请求数补货）
//   物流机器人：在覆盖范围内直线飞行搬运；电量耗尽低速爬行返航充电
// 任务调度由全局 dispatchJobs()（每 0.55s）完成：请求箱缺货 → 同网络内就近取货 →
// 从该网络组件中挑一座有满电待命机器人的港口派单。机器人飞行逐帧更新于 updateRobots()。

// ===== 物流箱基类（与储物箱相同的槽位模型：12 槽 ×50 叠放）=====
class LogiChest extends Entity {
  constructor(type, x, y) {
    super(type, x, y);
    this.slots = [];
    this.isLogiChest = true;
  }
  giveItem(item) {
    for (const s of this.slots)
      if (s && s.item === item && s.count < 50) { s.count++; return true; }
    if (this.slots.length >= 12) return false;
    this.slots.push({ item, count: 1 });
    return true;
  }
  peekItem() {
    for (let i = this.slots.length - 1; i >= 0; i--) if (this.slots[i]) return this.slots[i].item;
    return null;
  }
  takeItem() { return this.takeItemOf(this.peekItem()); }
  countOf(item) {
    let n = 0;
    for (const s of this.slots) if (s && s.item === item) n += s.count;
    return n;
  }
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
  serialize() { const s = super.serialize(); s.slots = this.slots.map(v => v ? [v.item, v.count] : null); return s; }
  blueprint() { return super.blueprint(); }   // 蓝图不复制箱内物品
  static restore(s) {
    const c = super.restore(s);
    c.slots = (s.slots || []).map(v => v ? { item: v[0], count: v[1] } : null);
    return c;
  }
}

class PassiveProviderChest extends LogiChest {
  constructor(type, x, y) { super(type || 'logi-chest-passive', x, y); }
}
class StorageLogiChest extends LogiChest {
  constructor(type, x, y) { super(type || 'logi-chest-storage', x, y); }
}

// 请求物流箱：面板设定每种物品的请求数量，机器人自动补货到设定值
class RequesterChest extends LogiChest {
  constructor(type, x, y) {
    super(type || 'logi-chest-requester', x, y);
    this.req = {};   // item -> 请求数量下限
  }
  serialize() { const s = super.serialize(); s.req = this.req; return s; }
  static restore(s) {
    const c = super.restore(s);
    c.req = {};
    for (const k in (s.req || {})) if (s.req[k] > 0) c.req[k] = s.req[k];
    return c;
  }
}

// ===== 机器人港口 =====
class RoboPort extends Entity {
  constructor(type, x, y) {
    super(type || 'roboport', x, y);
    this.nCharge = 0;   // 正在本港充电的机器人数（供电力需求与渲染）
  }
  dockedCount() {
    let n = 0;
    for (const rb of G.logiRobots) if (!rb.dead && rb.home === this && (rb.state === 'dock' || rb.state === 'charge')) n++;
    return n;
  }
  chargingCount() {
    let n = 0;
    for (const rb of G.logiRobots) if (!rb.dead && rb.home === this && rb.state === 'charge') n++;
    return n;
  }
  // 把背包中的物流机器人放入港口停靠
  giveItem(item) {
    if (item !== 'logistic-robot') return false;
    if (this.dockedCount() >= ROBO_PORT_ROBOT_CAP) return false;
    spawnDockedRobot(this);
    return true;
  }
  // 取回一台停靠的机器人
  takeItem() {
    for (const rb of G.logiRobots) {
      if (!rb.dead && rb.home === this && (rb.state === 'dock')) {
        rb.dead = true;
        return 'logistic-robot';
      }
    }
    return null;
  }
  countOf(item) { return item === 'logistic-robot' ? this.dockedCount() : 0; }
  takeItemOf(item) { return item === 'logistic-robot' ? this.takeItem() : null; }
  peekItem() { return this.dockedCount() > 0 ? 'logistic-robot' : null; }
  contents() {
    const list = [[this.type, 1]];
    const n = this.dockedCount();
    if (n > 0) list.push(['logistic-robot', n]);
    return list;
  }
  powerDemand() {
    // 实时统计：空闲 25kW，每台充电中的机器人 +70kW
    return 25 + 70 * this.chargingCount();
  }
  update(dt) {
    // 港口本体的逐帧工作只有推进停靠机器人的充电（并缓存充电数供电力系统使用）
    let n = 0;
    const pf = powerFactor();
    for (const rb of G.logiRobots) {
      if (rb.dead || rb.home !== this || rb.state !== 'charge') continue;
      n++;
      rb.charge = Math.min(ROBOT_CHARGE_MAX, rb.charge + ROBOT_RECHARGE_RATE * pf * dt);
      if (rb.charge >= ROBOT_CHARGE_MAX) rb.state = 'dock';
    }
    this.nCharge = n;
  }
  serialize() { const s = super.serialize(); s.nCharge = this.nCharge; return s; }
  static restore(s) {
    const p = super.restore(s);
    p.nCharge = s.nCharge | 0;
    return p;
  }
}

// ===== 机器人对象管理 =====
// 所有机器人都存放在全局 G.logiRobots（含停靠中的）。state:
//   'dock'    停靠待命（可接单）
//   'charge'  停靠充电（充满转 dock；占用港口电力）
//   'toSrc'   飞往取货箱 → 到达取货后转 toDst
//   'toDst'   飞往送货箱 → 卸货后转 toHome
//   'toHome'  返航 → 到达后按电量转 charge/dock
function makeRobot(home) {
  return {
    home,
    x: (home.x + home.w / 2) * TILE,
    y: (home.y + home.h / 2) * TILE,
    state: 'dock',
    item: null, want: 0, have: 0,
    src: null, dst: null,
    charge: ROBOT_CHARGE_MAX,
    dead: false, spin: Math.random() * 7
  };
}
function spawnDockedRobot(port) {
  const rb = makeRobot(port);
  G.logiRobots.push(rb);
  uiDirty = true;
  return rb;
}

// 实体中心像素坐标
function entCenterPx(e) { return [(e.x + e.w / 2) * TILE, (e.y + e.h / 2) * TILE]; }
function entDistTiles(a, b) {
  const [ax, ay] = entCenterPx(a), [bx, by] = entCenterPx(b);
  return Math.hypot(ax - bx, ay - by) / TILE;
}

// ===== 全局任务调度（每 ~0.55 秒一次）=====
let _logiT = 0;
function updateLogistics(dt) {
  updateRobots(dt);
  _logiT -= dt;
  if (_logiT > 0) return;
  _logiT = 0.55;
  dispatchJobs();
}

function dispatchJobs() {
  const reg = ensureExtraReg();
  const ports = Array.from(reg.ports).filter(p => !p._dead);
  if (!ports.length) return;
  // --- 并查集：把相互覆盖（中心距 <= 2R）的港口归为一个物流网络组件 ---
  const par = ports.map((_, i) => i);
  const find = i => { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; };
  for (let i = 0; i < ports.length; i++)
    for (let j = i + 1; j < ports.length; j++) {
      if (entDistTiles(ports[i], ports[j]) <= ROBO_COVER_R * 2) {
        const a = find(i), b = find(j);
        if (a !== b) par[a] = b;
      }
    }
  const compOfPort = new Map();
  ports.forEach((p, i) => compOfPort.set(p, find(i)));
  // --- 每个物流箱归属最近覆盖它的港口所在组件 ---
  const chests = Array.from(reg.chests).filter(c => !c._dead);
  const compOfChest = new Map();
  for (const c of chests) {
    let best = null, bd = Infinity;
    for (const p of ports) {
      const d = entDistTiles(p, c);
      if (d <= ROBO_COVER_R && d < bd) { bd = d; best = p; }
    }
    if (best) compOfChest.set(c, compOfPort.get(best));
  }
  // --- 各组件内可接单的待命机器人（按电量降序）---
  const avail = new Map();   // compId -> [robot]
  for (const rb of G.logiRobots) {
    if (rb.dead || (rb.state !== 'dock' && rb.state !== 'charge')) continue;
    if (!rb.home || rb.home._dead) continue;
    const cid = compOfPort.get(rb.home);
    if (cid === undefined) continue;
    if (!avail.has(cid)) avail.set(cid, []);
    avail.get(cid).push(rb);
  }
  for (const arr of avail.values()) arr.sort((a, b) => b.charge - a.charge);
  // --- 遍历请求箱派单 ---
  for (const c of chests) {
    if (!(c instanceof RequesterChest)) continue;
    const cid = compOfChest.get(c);
    if (cid === undefined) continue;
    const robots = avail.get(cid);
    if (!robots || !robots.length) continue;
    let outstanding = 0;
    const inflight = {};   // 各物品已在途数量：防止两台机器人重复补同一缺口导致超发
    for (const rb of G.logiRobots) {
      if (!rb.dead && rb.dst === c && rb.state !== 'dock' && rb.state !== 'charge') {
        outstanding++;
        inflight[rb.item] = (inflight[rb.item] || 0) + rb.want;
      }
    }
    if (outstanding >= 3) continue;   // 单个请求箱最多 3 个在途任务，避免堆积
    for (const item in c.req) {
      const want = c.req[item];
      if (!(want > 0)) continue;
      const deficit = Math.min(want - c.countOf(item) - (inflight[item] || 0), ROBOT_CARRY);
      if (deficit <= 0) continue;
      // 就近找货源：被动供应箱优先，存储箱次之
      let src = null, sbd = Infinity, sprio = 9;
      for (const s of chests) {
        if (s === c || s instanceof RequesterChest) continue;
        if (compOfChest.get(s) !== cid) continue;
        if (s.countOf(item) <= 0) continue;
        const prio = s instanceof PassiveProviderChest ? 0 : 1;
        const d = entDistTiles(s, c);
        if (prio < sprio || (prio === sprio && d < sbd)) { src = s; sbd = d; sprio = prio; }
      }
      if (!src) continue;
      // 找电量足够跑一个来回的机器人（估算：取送两段 ×15% 余量 + 两段进出港半径）
      let ri = -1;
      const needCharge = ((sbd + entDistTiles(src, c)) * 1.15 + ROBO_COVER_R) * ROBOT_DRAIN_PER_TILE + ROBOT_JOB_RESERVE;
      for (let k = 0; k < robots.length; k++)
        if (robots[k].charge >= needCharge) { ri = k; break; }
      if (ri < 0) continue;
      const rb = robots.splice(ri, 1)[0];
      rb.state = 'toSrc';
      rb.src = src; rb.dst = c;
      rb.item = item; rb.want = deficit; rb.have = 0;
      outstanding++;
      if (!robots.length || outstanding >= 3) break;
    }
  }
}

// ===== 机器人飞行更新（每帧）=====
function robotTarget(rb) {
  if (rb.state === 'toSrc' && rb.src && !rb.src._dead) return entCenterPx(rb.src);
  if (rb.state === 'toDst' && rb.dst && !rb.dst._dead) return entCenterPx(rb.dst);
  if (rb.home && !rb.home._dead) return entCenterPx(rb.home);
  return null;
}

function updateRobots(dt) {
  if (!G.logiRobots || !G.logiRobots.length) return;
  let dirty = false;
  for (const rb of G.logiRobots) {
    if (rb.dead) continue;
    rb.spin += dt * 40;
    if (rb.state === 'dock' || rb.state === 'charge') continue;
    // 目标丢失处理：取货/送货点被拆 → 中止任务返航
    const tgt = robotTarget(rb);
    if (!tgt) { abortMission(rb); continue; }
    const [txp, typ] = tgt;
    const dx = txp - rb.x, dy = typ - rb.y;
    const dpx = Math.hypot(dx, dy);
    const speedPx = ROBOT_SPEED * TILE * (rb.charge > 0 ? 1 : 0.3) * dt;
    if (dpx <= Math.max(speedPx, TILE * 0.35)) {
      // 抵达目标点：按状态结算
      arriveAction(rb);
      dirty = true;
      continue;
    }
    rb.x += dx / dpx * speedPx;
    rb.y += dy / dpx * speedPx;
    rb.charge = Math.max(0, rb.charge - (speedPx / TILE) * ROBOT_DRAIN_PER_TILE);
    dirty = true;
  }
  // 清理死亡机器人（墓碑惰性清理）
  if (G.logiRobots.some(r => r.dead)) G.logiRobots = G.logiRobots.filter(r => !r.dead);
  if (dirty) uiDirty = true;
}

function abortMission(rb) {
  rb.src = null; rb.dst = null; rb.want = 0;
  rb.state = 'toHome';
}

function arriveAction(rb) {
  if (rb.state === 'toSrc') {
    // 到达取货箱：抓满 want 个
    if (rb.src && !rb.src._dead) {
      while (rb.have < rb.want && rb.src.countOf(rb.item) > 0) {
        if (!rb.src.takeItemOf(rb.item)) break;
        rb.have++;
      }
    }
    rb.src = null;
    rb.state = rb.have > 0 ? 'toDst' : 'toHome';
    return;
  }
  if (rb.state === 'toDst') {
    // 到达送货箱：卸货；拒收则悬停等待（blocked）
    let blocked = false;
    if (rb.dst && !rb.dst._dead) {
      while (rb.have > 0 && rb.dst.giveItem(rb.item)) rb.have--;
      blocked = rb.have > 0;
    } else blocked = rb.have > 0;
    if (!blocked) { rb.dst = null; rb.state = 'toHome'; }
    return;
  }
  if (rb.state === 'toHome') {
    // 回港：家没了就找覆盖当前位置的其他港口收留
    if (!rb.home || rb.home._dead) {
      const np = findCoveringPort(rb.x / TILE, rb.y / TILE);
      if (np) { rb.home = np; }
      else { rb.state = 'dock'; return; }   // 无家可归：原地待命（仍可被重新指派？保守起见挂起）
    }
    if (rb.have > 0) {
      // 手上还有货（目的地失效）：尝试改投任意同网络存储/请求箱
      const alt = findAltDestination(rb);
      if (alt) { rb.dst = alt; rb.state = 'toDst'; return; }
    }
    rb.state = rb.charge < ROBOT_CHARGE_MAX ? 'charge' : 'dock';
    const [hx, hy] = entCenterPx(rb.home);
    rb.x = hx; rb.y = hy;
  }
}

function findCoveringPort(tx, ty) {
  const reg = ensureExtraReg();
  let best = null, bd = Infinity;
  for (const p of reg.ports) {
    if (p._dead) continue;
    const d = Math.hypot((p.x + p.w / 2) - tx, (p.y + p.h / 2) - ty);
    if (d <= ROBO_COVER_R && d < bd) { bd = d; best = p; }
  }
  return best;
}

// 给持货回港的机器人找一个愿意收货的替代目的地（请求箱缺货优先，其次存储箱）
function findAltDestination(rb) {
  const reg = ensureExtraReg();
  if (!rb.home || rb.home._dead) return null;
  const rx = rb.x / TILE, ry = rb.y / TILE;
  let best = null, bd = Infinity;
  for (const c of reg.chests) {
    if (c._dead || !(c instanceof LogiChest) || !(c instanceof RequesterChest || c instanceof StorageLogiChest)) continue;
    const cx = c.x + 0.5, cy = c.y + 0.5;
    const dPort = Math.hypot((rb.home.x + rb.home.w / 2) - cx, (rb.home.y + rb.home.h / 2) - cy);
    if (dPort > ROBO_COVER_R) continue;
    const d = Math.hypot(cx - rx, cy - ry);
    const wants = c instanceof RequesterChest && (c.req[rb.item] || 0) > c.countOf(rb.item);
    if (wants && d < bd) { best = c; bd = d; }
    else if (!best && c instanceof StorageLogiChest && d < bd) { best = c; bd = d; }
  }
  return best;
}

// ===== 序列化 =====
// 机器人随存档保存（引用以瓦片坐标记录，读档后按网格还原）
function logiRobotsSerialize() {
  const out = [];
  for (const rb of G.logiRobots) {
    if (rb.dead) continue;
    out.push({
      hx: rb.home ? rb.home.x : -9999, hy: rb.home ? rb.home.y : -9999,
      sx: rb.src ? rb.src.x : -9999, sy: rb.src ? rb.src.y : -9999,
      dx: rb.dst ? rb.dst.x : -9999, dy: rb.dst ? rb.dst.y : -9999,
      x: rb.x, y: rb.y, state: rb.state,
      item: rb.item, want: rb.want, have: rb.have, charge: rb.charge
    });
  }
  return out;
}
function logiRobotsRestore(list) {
  G.logiRobots = [];
  for (const r of (list || [])) {
    const home = r.hx > -9000 ? entAt(r.hx, r.hy) : null;
    if (!home) continue;   // 港口已不存在：丢弃该机器人（其物品随港口拆除返还过）
    const rb = makeRobot(home);
    rb.x = r.x; rb.y = r.y;
    rb.state = (r.state === 'dock' || r.state === 'charge') ? r.state : 'toHome';   // 飞行中的先回家再重新调度
    rb.item = r.item || null;
    rb.want = r.want || 0;
    rb.have = r.have || 0;
    rb.charge = Math.max(0, Math.min(ROBOT_CHARGE_MAX, +r.charge || 0));
    rb.src = r.sx > -9000 ? entAt(r.sx, r.sy) : null;
    rb.dst = r.dx > -9000 ? entAt(r.dx, r.dy) : null;
    G.logiRobots.push(rb);
  }
}

// ===== 渲染：机器人 =====
function drawLogiRobots(ctx) {
  if (!G.logiRobots || !G.logiRobots.length || LOD.simple) return;
  const t = G.time;
  for (const rb of G.logiRobots) {
    if (rb.dead) continue;
    const docked = rb.state === 'dock' || rb.state === 'charge';
    const bob = docked ? 0 : Math.sin(t * 6 + rb.spin) * 1.5;
    const x = rb.x, y = rb.y + bob;
    // 影子
    ctx.fillStyle = 'rgba(0,0,0,.22)';
    ctx.beginPath();
    ctx.ellipse(x, rb.y + 8, 6, 2.5, 0, 0, 7);
    ctx.fill();
    // 旋翼模糊十字
    ctx.strokeStyle = 'rgba(220,228,238,.55)';
    ctx.lineWidth = 2;
    const rl = 7 + Math.sin(rb.spin) * 1.5;
    ctx.beginPath();
    ctx.moveTo(x - rl, y - 3); ctx.lineTo(x + rl, y - 3);
    ctx.moveTo(x, y - 3 - rl); ctx.lineTo(x, y - 3 + rl);
    ctx.stroke();
    // 机腹
    ctx.fillStyle = '#e05a4a';
    rr(ctx, x - 4.5, y - 3, 9, 7, 2.5); ctx.fill();
    ctx.strokeStyle = '#7a261c';
    ctx.lineWidth = 1;
    rr(ctx, x - 4.5, y - 3, 9, 7, 2.5); ctx.stroke();
    // 携带物
    if (rb.have > 0 && rb.item) drawItemDot(ctx, x, y - 8, rb.item, 4);
    // 低电量警示条
    if (!docked && rb.charge < ROBOT_CHARGE_MAX * 0.25) {
      ctx.fillStyle = '#ff5b5b';
      ctx.fillRect(x - 6, y + 6, 12 * (rb.charge / (ROBOT_CHARGE_MAX * 0.25)), 2);
    }
  }
}

// ===== 渲染：覆盖圈叠加层（放置预览 / 选中港口时）=====
function drawLogiOverlays(ctx) {
  const showFor = e => {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,170,80,.45)';
    ctx.lineWidth = 1.6 / G.cam.z;
    ctx.setLineDash([7 / G.cam.z, 5 / G.cam.z]);
    ctx.beginPath();
    ctx.arc((e.x + e.w / 2) * TILE, (e.y + e.h / 2) * TILE, ROBO_COVER_R * TILE, 0, 7);
    ctx.stroke();
    ctx.restore();
  };
  // 幽灵预览
  if (buildActive()) {
    const type = selItem();
    if (type === 'roboport' && G.cursorTile) {
      const def = BUILD_DEFS[type];
      showFor({ x: G.cursorTile.tx, y: G.cursorTile.ty, w: def.w, h: def.h });
    }
  }
  // 已选中 / 打开面板的港口
  const he = G.cursorTile ? entAt(G.cursorTile.tx, G.cursorTile.ty) : null;
  if (he instanceof RoboPort) showFor(he);
  else if (G.panelEnt instanceof RoboPort) showFor(G.panelEnt);
}

// ===== 渲染：物流箱 =====
function drawLogiChest(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  ctx.globalAlpha = alpha;
  const col = e.type === 'logi-chest-passive' ? ['#b85a3a', '#7a3620'] :
    e.type === 'logi-chest-storage' ? ['#5a7ab8', '#33486e'] : ['#4a9a6a', '#28573c'];
  ctx.fillStyle = col[0];
  rr(ctx, px + 4, py + 8, TILE - 8, TILE - 13, 3); ctx.fill();
  ctx.fillStyle = col[0];
  rr(ctx, px + 4, py + 5, TILE - 8, 10, 3); ctx.fill();
  ctx.strokeStyle = col[1];
  ctx.lineWidth = 1.5;
  rr(ctx, px + 4, py + 8, TILE - 8, TILE - 13, 3); ctx.stroke();
  // 天线（联网标识）
  ctx.strokeStyle = col[1];
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(px + TILE - 9, py + 8);
  ctx.lineTo(px + TILE - 9, py + 2);
  ctx.stroke();
  const pulse = 0.5 + 0.5 * Math.sin(G.time * 4 + px);
  ctx.fillStyle = 'rgba(120,230,140,' + (0.4 + pulse * 0.6).toFixed(2) + ')';
  ctx.beginPath(); ctx.arc(px + TILE - 9, py + 2, 2, 0, 7); ctx.fill();
  // 类型字母标
  ctx.fillStyle = '#f4f6f8';
  ctx.font = 'bold 10px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(e.type === 'logi-chest-passive' ? 'P' : e.type === 'logi-chest-storage' ? 'S' : 'Q', px + TILE / 2, py + TILE / 2 + 3);
  ctx.globalAlpha = 1;
}

// ===== 渲染：机器人港口（4×4）=====
function drawRoboPort(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * 4;
  ctx.globalAlpha = alpha;
  // 外壳
  ctx.fillStyle = '#8f6242';
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 10); ctx.fill();
  ctx.strokeStyle = '#59381f';
  ctx.lineWidth = 4;
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 10); ctx.stroke();
  // 内部停机坪
  ctx.fillStyle = '#54413a';
  rr(ctx, px + 12, py + 12, s - 24, s - 24, 8); ctx.fill();
  // 黄黑警示角
  if (!LOD.simple) {
    ctx.fillStyle = '#e0b23c';
    for (const [ox, oy] of [[8, 8], [s - 22, 8], [8, s - 16], [s - 22, s - 16]]) {
      ctx.fillRect(px + ox, py + oy, 14, 8);
      ctx.fillStyle = '#2a2c30';
      ctx.fillRect(px + ox + 4, py + oy, 3, 8);
      ctx.fillRect(px + ox + 9, py + oy, 2, 8);
      ctx.fillStyle = '#e0b23c';
    }
  }
  // 中央充电柱
  const cx = px + s / 2, cy = py + s / 2;
  ctx.fillStyle = '#3c3f46';
  ctx.beginPath(); ctx.arc(cx, cy, 14, 0, 7); ctx.fill();
  const glow = e.nCharge > 0 ? 0.5 + 0.5 * Math.sin(G.time * 6) : 0.18;
  ctx.fillStyle = 'rgba(255,200,80,' + (glow * 0.85).toFixed(2) + ')';
  ctx.beginPath(); ctx.arc(cx, cy, 7, 0, 7); ctx.fill();
  ctx.strokeStyle = '#20232a'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, 7, 0, 7); ctx.stroke();
  // 停靠机器人小点（环绕排布）
  if (!LOD.simple) {
    let i = 0;
    for (const rb of G.logiRobots) {
      if (rb.dead || rb.home !== e || (rb.state !== 'dock' && rb.state !== 'charge')) continue;
      const ang = i * 0.9 + 0.4;
      const rad = 22;
      const dx = cx + Math.cos(ang) * rad, dy = cy + Math.sin(ang) * rad;
      ctx.fillStyle = rb.state === 'charge' && rb.charge < ROBOT_CHARGE_MAX ? '#ffb84a' : '#dfe6ee';
      ctx.beginPath(); ctx.arc(dx, dy, 2.6, 0, 7); ctx.fill();
      i++;
    }
  }
  ctx.font = 'bold 11px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#ffe9c9';
  if (!LOD.simple) ctx.fillText('🤖' + e.dockedCount(), cx, py + s - 10);
  ctx.globalAlpha = 1;
}

// ===== 面板：机器人港口 =====
function roboportPanelHtml(e) {
  let h = row('机器人', '<span data-live="bots"></span>', 'bots');
  h += row('电力', powerStatusLiveHtml(e), 'power');
  h += row('覆盖半径', ROBO_COVER_R + ' 格');
  const n = Math.min(invCount('logistic-robot'), ROBO_PORT_ROBOT_CAP - e.dockedCount());
  if (n > 0) h += '<button data-action="bot-in">放入物流机器人 ×' + n + '</button>';
  if (e.dockedCount() > 0) h += '<button data-action="bot-out" data-live="btn-botout" style="display:none"></button>';
  h += barHtml(0);
  h += '<div class="status"></div>';
  h += '<div class="dim">机器人港口是物流网络的核心（4×4）：覆盖半径 ' + ROBO_COVER_R + ' 格内的物流箱互相连通；' +
    '多个港口覆盖圈重叠时网络合并。把「物流机器人」放入港口后，它们会自动在被动物流箱/存储箱与请求箱之间搬运货物，' +
    '并在港内充电（每台充电约 ' + 70 + 'kW）。</div>';
  return h;
}
function roboportPanelLive(e, api) {
  const total = e.dockedCount(), chg = e.chargingCount();
  api.set('bots', total + ' / ' + ROBO_PORT_ROBOT_CAP + ' 台' + (chg > 0 ? '（充电中 ' + chg + '）' : ''));
  api.toggle('[data-live="btn-botout"]', total > 0, '取回机器人 (' + total + ')');
  api.prog(total > 0 ? chg / Math.max(1, total) * 100 : 0);
  if (total <= 0) api.status('已暂停：港内没有物流机器人（放入或用机械臂装入）', 'warn');
  else if (chg > 0) api.status('运行中：正在为 ' + chg + ' 台机器人充电', 'ok');
  else api.status('待命中：' + total + ' 台机器人随时可接单', 'ok');
}
function roboportTip(e) {
  const n = e.dockedCount();
  return n > 0 ? '机器人港口（' + n + ' 台待命）· 覆盖 ' + ROBO_COVER_R + ' 格' : '机器人港口：放入物流机器人启用物流网络';
}
function roboportOnAction(act) {
  const e = G.panelEnt;
  if (!(e instanceof RoboPort)) return false;
  if (act === 'bot-in') {
    const n = Math.min(invCount('logistic-robot'), ROBO_PORT_ROBOT_CAP - e.dockedCount());
    if (n <= 0) { toast('没有可放入的物流机器人'); return true; }
    for (let i = 0; i < n; i++) { if (!invTake('logistic-robot', 1)) break; spawnDockedRobot(e); }
    toast('已放入 ' + n + ' 台物流机器人');
    return true;
  }
  if (act === 'bot-out') {
    let n = 0;
    while (e.dockedCount() > 0) { const got = e.takeItem(); if (!got) break; invAdd(got, 1); n++; }
    if (n > 0) toast('已取回 ' + n + ' 台物流机器人');
    return true;
  }
  return false;
}

// ===== 面板：物流箱通用 =====
function logiChestAgg(e) {
  const agg = {};
  let total = 0;
  for (const s of e.slots) if (s) { agg[s.item] = (agg[s.item] || 0) + s.count; total += s.count; }
  return { agg, total };
}
function logiChestBodyHtml(e) {
  const { agg, total } = logiChestAgg(e);
  let h = row('内容', Object.keys(agg).length ? countStr(agg) : '<span class="dim">空</span>', 'contents');
  if (total > 0) h += '<button data-action="takeout" data-live="btn-takeout" style="display:none"></button>';
  h += '<div class="status"></div>';
  return h;
}
function logiChestBodyLive(e, api, statusFn) {
  const { agg, total } = logiChestAgg(e);
  api.set('contents', Object.keys(agg).length ? countStr(agg) : dimSpan('空'));
  api.toggle('[data-live="btn-takeout"]', total > 0, '取出全部 (' + total + ')');
  statusFn(e, agg, total);
}
function passiveProviderPanelHtml(e) {
  let h = '<div class="dim">被动物流箱：网络中的物流机器人可以随时从这里取货送往请求箱。用机械臂把产物投入此箱即可实现全自动配送。</div>';
  return h + logiChestBodyHtml(e);
}
function passiveProviderPanelLive(e, api) {
  logiChestBodyLive(e, api, (c, agg, total) => {
    api.status(total > 0 ? '供应中：' + total + ' 件货物等待配送' : '空箱：等待投入货物', 'ok');
  });
}
function storageLogiPanelHtml(e) {
  let h = '<div class="dim">存储物流箱：存放物资，也是请求配送的次级取货来源（被动供应箱优先）。</div>';
  return h + logiChestBodyHtml(e);
}
function storageLogiPanelLive(e, api) {
  logiChestBodyLive(e, api, (c, agg, total) => {
    api.status(total > 0 ? '存储中：' + total + ' 件' : '空箱', 'ok');
  });
}

// ===== 面板：请求物流箱（请求编辑器） =====
function requesterPanelHtml(e) {
  let h = '<div class="dim">请求物流箱：为每种物品设置请求数量，物流机器人会自动从网络内补货到该数量。</div>';
  h += '<div class="sec">请求清单</div>';
  const keys = Object.keys(e.req);
  if (!keys.length) h += '<div class="dim">暂无请求。从下方添加。</div>';
  for (const k of keys) {
    h += '<div class="limitrow">' + chip(k, e.countOf(k)) +
      '<span class="mlabel">请求 ≥</span>' +
      '<input class="limit-in" type="number" min="0" step="5" value="' + e.req[k] + '" data-req="' + k + '" data-tip="请求数量|低于该数量时机器人自动补货">' +
      '<button data-action="req-rm" data-id="' + k + '">✕</button></div>';
  }
  h += '<div class="sec">添加请求</div>';
  h += '<div class="limitrow">' +
    '<input id="req-new-item" class="inv-search" type="text" list="req-item-list" placeholder="输入物品名…" autocomplete="off">' +
    '<input id="req-new-amt" class="limit-in" type="number" min="1" step="5" value="20">' +
    '<button data-action="req-add">添加</button></div>';
  h += '<datalist id="req-item-list">';
  for (const id of Object.keys(ITEMS)) {
    if (FLUIDS.indexOf(id) >= 0) continue;
    h += '<option value="' + escHtml(ITEMS[id].name) + '">' + id + '</option>';
  }
  h += '</datalist>';
  h += logiChestBodyHtml(e);
  h += '<div class="dim">必须位于机器人港口覆盖范围内才会自动补货；取货优先级：被动物流箱 &gt; 存储物流箱。</div>';
  return h;
}
function requesterPanelLive(e, api) {
  logiChestBodyLive(e, api, (c, agg, total) => {
    // 缺货提示
    const miss = Object.keys(c.req).filter(k => c.countOf(k) < c.req[k]);
    if (miss.length) api.status('等待补货：' + miss.map(k => ITEMS[k].name).join('、'), 'warn');
    else api.status(total > 0 ? '库存充足' : '空箱：等待机器人配送', 'ok');
  });
}
function requesterOnChange(ev) {
  const inp = ev.target.closest ? ev.target.closest('[data-req]') : null;
  if (!inp) return false;
  const e = G.panelEnt;
  if (e instanceof RequesterChest) {
    const id = inp.dataset.req;
    let v = Math.floor(+inp.value);
    if (!isFinite(v) || v <= 0) { delete e.req[id]; inp.value = ''; }
    else { e.req[id] = v; inp.value = v; }
    uiDirty = true;
  }
  return true;
}
function requesterOnAction(act, btn) {
  const e = G.panelEnt;
  if (!(e instanceof RequesterChest)) return false;
  if (act === 'req-rm') {
    delete e.req[btn.dataset.id];
    uiDirty = true;
    return true;
  }
  if (act === 'req-add') {
    const nameIn = document.getElementById('req-new-item');
    const amtIn = document.getElementById('req-new-amt');
    if (!nameIn) return true;
    const q = nameIn.value.trim().toLowerCase();
    if (!q) { toast('请输入物品名称'); return true; }
    // 按名称或 id 匹配
    let id = Object.keys(ITEMS).find(i => i.toLowerCase() === q);
    if (!id) id = Object.keys(ITEMS).find(i => ITEMS[i].name.toLowerCase() === q ||
      ITEMS[i].name.indexOf(nameIn.value.trim()) === 0);
    if (!id || FLUIDS.indexOf(id) >= 0) { toast('找不到该物品'); return true; }
    let amt = Math.floor(+amtIn.value) || 20;
    if (amt < 1) amt = 1;
    e.req[id] = amt;
    toast('已添加请求：' + ITEMS[id].name + ' ≥ ' + amt);
    uiDirty = true;
    return true;
  }
  return false;
}

function logiChestTip(e) {
  const { total } = logiChestAgg(e);
  const kind = e.type === 'logi-chest-passive' ? '被动供应' : e.type === 'logi-chest-storage' ? '存储' : '请求补货';
  return '物流箱（' + kind + '）' + (total > 0 ? ' · ' + total + ' 件' : '');
}

// ===== 注册 =====
ENT_CLASSES['roboport'] = RoboPort;
ENT_CLASSES['logi-chest-passive'] = PassiveProviderChest;
ENT_CLASSES['logi-chest-storage'] = StorageLogiChest;
ENT_CLASSES['logi-chest-requester'] = RequesterChest;
DEVICE_RENDER['roboport'] = drawRoboPort;
DEVICE_RENDER['logi-chest-passive'] = drawLogiChest;
DEVICE_RENDER['logi-chest-storage'] = drawLogiChest;
DEVICE_RENDER['logi-chest-requester'] = drawLogiChest;
DEVICE_STATUS['roboport'] = e => {
  const n = e.dockedCount();
  if (n <= 0) return 'r';
  return e.chargingCount() > 0 ? 'y' : 'g';
};
DEVICE_STATUS['logi-chest-passive'] = () => null;
DEVICE_STATUS['logi-chest-storage'] = () => null;
DEVICE_STATUS['logi-chest-requester'] = () => null;
DEVICE_PANEL['roboport'] = { html: roboportPanelHtml, live: roboportPanelLive, tip: roboportTip, onAction: roboportOnAction };
DEVICE_PANEL['logi-chest-passive'] = { html: passiveProviderPanelHtml, live: passiveProviderPanelLive, tip: logiChestTip };
DEVICE_PANEL['logi-chest-storage'] = { html: storageLogiPanelHtml, live: storageLogiPanelLive, tip: logiChestTip };
DEVICE_PANEL['logi-chest-requester'] = { html: requesterPanelHtml, live: requesterPanelLive, tip: logiChestTip, onAction: requesterOnAction, onChange: requesterOnChange };
