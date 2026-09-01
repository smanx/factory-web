'use strict';

// ===== 施工机器人网络（对齐《异星工厂》Construction robots / Personal roboport）=====
// 个人机器人港（Personal roboport，装备件）+ 施工机器人（Construction robot）。
// 装备个人机器人港后，蓝图粘贴不再直接落地，而是生成“建造幽灵（ghost）”，
// 由施工机器人从玩家背包取料飞行到幽灵处施工；红图框选则生成“拆除标记”，
// 由施工机器人飞过去拆除并把物资返还背包。
//
// 简化但完整的模型：
//   - G.personalRoboport: 是否已装备个人机器人港
//   - G.constrGhosts: 建造幽灵数组（等待施工的目标，含类型/坐标/朝向/进度）
//   - G.deconMarks: 拆除标记数组（指向待拆除实体）
//   - G.constrRobots: 施工机器人实体数组（飞行中/施工中/返航）
//   - 施工机器人从玩家位置起飞，飞到目标格施工（消耗背包中对应物品），完成后落地成真实建筑。
//   - 无个人机器人港或背包无施工机器人时，蓝图仍按原逻辑直接粘贴。

// ===== 常量 =====
const CONSTR_ROBOT_SPEED = GAME_DATA.robotSpeed?.construction ?? 3.6;  // 施工机器人飞行速度（格/秒，官方 construction-robot speed 0.06×60=3.6）
const CONSTR_BUILD_TIME = 1.0;       // 单格建造耗时（秒）
const CONSTR_DOCK_TIME = 0.6;        // 施工机器人回港停靠充电的可见时长（秒）
// 施工机器人修复受损建筑（对齐《异星工厂》：施工机器人自动修复基地建筑）
const CONSTR_REPAIR_INTERVAL = 0.6;  // 每次修复动作的间隔（秒）
const CONSTR_REPAIR_AMOUNT = 60;     // 每次修复动作恢复的 HP
const CONSTR_REPAIR_USES = 5;        // 每个修理包可修复次数（与手动修理包一致）
const CONSTR_REPAIR_SCAN_T = 0.5;    // 受损建筑扫描间隔（秒）

// ===== 施工机器人电量模型（对齐《异星工厂》Construction robot 的能量系统）=====
// 数值来自官方 construction-robot 原型（tools/generate-game-data.js → GAME_DATA.robotData.construction）：
//   maxEnergyKJ=最大携带能量（"3MJ"）；moveEnergyKJ=每移动一格耗能（"5kJ"）；
//   idleEnergyKJS=待机/工作基底能耗（energy_per_tick "0.05kJ"/tick → 3kJ/s）；
//   minToCharge / maxToCharge=回港充电与再出发阈值（官方 min_to_charge 0.2 / max_to_charge 0.95）。
// 机器人自带电池：飞行（按格）与工作（按秒）都耗电；电量低于 minToCharge 必须回玩家身边的
// 个人机器人港充电，充到 maxToCharge 才可再次出发。机器人港自身带储能 buffer（capE），
// 由个人电网（太阳能/电池/聚变堆）充电，机器人回港后从该 buffer 以每充电站额定功率（chargingEnergy）取电。
const ROBOT_DATA_C = (GAME_DATA && GAME_DATA.robotData && GAME_DATA.robotData.construction) || {};
const ROBOT_MAX_E = ROBOT_DATA_C.maxEnergyKJ ?? 3000;      // 机器人最大携带能量（kJ，官方 3MJ）
const ROBOT_MOVE_E = ROBOT_DATA_C.moveEnergyKJ ?? 5;        // 每移动一格耗能（kJ/格，官方 5kJ）
const ROBOT_IDLE_E = ROBOT_DATA_C.idleEnergyKJS ?? 3;       // 待机/工作基底能耗（kJ/s，官方 3kJ/s）
const CONSTR_MIN_CHARGE = ROBOT_DATA_C.minToCharge ?? 0.2;  // 电量低于该比例 → 回港充电
const CONSTR_MAX_CHARGE = ROBOT_DATA_C.maxToCharge ?? 0.95; // 充到该比例 → 再次出发

// 根据已装备的个人机器人港版本返回 { range, maxActive }。
// 数值来自数据层（GAME_DATA.equipment[].roboport，由官方 roboport-equipment 原型生成）：
// 施工范围=construction_radius、可控机器人上限=robot_limit。缺失时回退到旧常量。
// 判定顺序：① 当前穿戴护甲装备网格中实际安装的机器人港（对齐《异星工厂》官方装备网格）→ ② G.personalRoboport 标志。
const CONSTR_RANGE = 15;             // 回退：个人机器人港 Mk1 工作范围（格）
const CONSTR_MAX_ACTIVE = 10;        // 回退：个人机器人港 Mk1 可控机器人上限
function robotPortInGrid() {
  if (typeof wornEquipGrid !== 'function') return null;
  let eid = null;
  for (const e of wornEquipGrid()) {
    const d = (typeof EQUIPMENT !== 'undefined') ? EQUIPMENT[e.id] : null;
    if (d && d.roboport) eid = e.id;   // 网格中最后一个机器人港（多港并联时取其一作代表，上限近似叠加）
  }
  return eid;
}
function constrRoboportInfo() {
  let eid = robotPortInGrid();
  if (!eid) eid = (G.personalRoboport === 'mk2') ? 'personal-roboport-mk2-equipment' : 'personal-roboport-equipment';
  const cfg = (typeof roboportConfig === 'function') ? roboportConfig(eid) : null;
  if (!cfg) {
    if (eid === 'personal-roboport-mk2-equipment') return { range: 20, maxActive: 25 };
    return { range: CONSTR_RANGE, maxActive: CONSTR_MAX_ACTIVE };
  }
  return { range: cfg.radius, maxActive: cfg.robotLimit };
}

// ===== 个人机器人港装备 =====
function ensureConstr() {
  if (G.personalRoboport === undefined) G.personalRoboport = false;
  if (G.roboportActive === undefined) G.roboportActive = true;   // 机器人港启用状态（Alt+F 切换）
  if (!G.constrGhosts) G.constrGhosts = [];
  if (!G.deconMarks) G.deconMarks = [];
  if (!G.constrRobots) G.constrRobots = [];
  if (G._constrRepairScanT === undefined) G._constrRepairScanT = 0;
}
// 是否拥有个人机器人港：G.personalRoboport 标志（背包“使用”装备）或当前穿戴护甲的装备网格中
// 安装了个人机器人港装备件（对齐《异星工厂》：把机器人港装进装甲装备网格即激活施工机器人）。
function hasPersonalRoboport() {
  if (G.personalRoboport) return true;
  return !!robotPortInGrid();
}
// 机器人港是否启用（Alt+F 切换；未初始化视为启用）。复用装备层 roboportActive（读取 G.roboportActive）。
function roboportOn() { return (typeof roboportActive === 'function') ? roboportActive() : !(G.roboportActive === false); }
// Alt+F 切换机器人港启用/停用
function toggleRoboportActive() {
  ensureConstr();
  if (!hasPersonalRoboport()) {
    if (typeof toast === 'function') toast('需要先装备个人机器人港');
    return;
  }
  G.roboportActive = !roboportOn();
  if (typeof toast === 'function') toast('机器人港' + (roboportOn() ? '启用' : '已停用' + '（Alt+F 再次启用）'));
  if (typeof uiDirty !== 'undefined' && uiDirty !== undefined) uiDirty = true;
}
// 背包中可用施工机器人数量
function constrRobotCount() {
  return invCount('construction-robot');
}
// 是否具备施工能力：装备个人机器人港、已启用且背包有施工机器人
function canUseConstruction() {
  return hasPersonalRoboport() && roboportOn() && constrRobotCount() > 0;
}
// 装备/卸下个人机器人港（背包“使用”触发，或面板按钮）。
// wantMk2：点击 Mk2 按钮时强制装备 Mk2；否则若持有 Mk2 优先装备 Mk2（对齐《异星工厂》：机器人港可升级换代）
function togglePersonalRoboport(wantMk2) {
  if (hasPersonalRoboport()) {
    const id = (G.personalRoboport === 'mk2') ? 'personal-roboport-mk2-equipment' : 'personal-roboport-equipment';
    invAdd(id, 1);
    G.personalRoboport = false;
    if (typeof playSfx === 'function') playSfx('unequip');
    if (typeof toast === 'function') toast('已卸下' + ITEMS[id].name);
  } else {
    const haveMk2 = invCount('personal-roboport-mk2-equipment') > 0;
    const useMk2 = (wantMk2 === true) ? (invCount('personal-roboport-mk2-equipment') > 0) : (haveMk2 && invCount('personal-roboport-equipment') < 1);
    const id = useMk2 ? 'personal-roboport-mk2-equipment' : 'personal-roboport-equipment';
    if (invCount(id) < 1) { if (typeof toast === 'function') toast('背包里没有' + ITEMS[id].name); return; }
    invTake(id, 1);
    G.personalRoboport = useMk2 ? 'mk2' : true;
    if (typeof playSfx === 'function') playSfx('equip');
    if (typeof toast === 'function') toast('已装备' + ITEMS[id].name + '：蓝图由施工机器人自动建造');
  }
  uiDirty = true;
}

// ===== 施工机器人实体 =====
class ConstrRobot {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.tx = x; this.ty = y;      // 当前目标
    this.state = 'idle';           // idle | toghost | building | returning | charging
    this.job = null;               // { kind:'build'|'decon', ghost?/mark?, item?, need }
    this.buildT = 0;
    this.maxE = ROBOT_MAX_E;                 // 最大携带能量（kJ）
    this.e = ROBOT_MAX_E * CONSTR_MAX_CHARGE; // 从港出发电量（充到 max_to_charge=95% 后才出发）
    this.dockT = 0;                          // 回港停靠充电剩余时长（秒，>0 时表现为悬停在玩家身边充电）
    this._dead = false;
  }
}

// ===== 建造幽灵 =====
class ConstrGhost {
  constructor(type, x, y, dir) {
    const def = BUILD_DEFS[type];
    this.type = type;
    this.x = x; this.y = y; this.dir = dir | 0;
    this.mirror = 0;               // 镜像手性（蓝图粘贴时随快照携带，储液罐等对角接口设备用）
    this.w = def.w; this.h = def.h;
    this.recipe = null;            // 组装机/化工厂/炼油厂等保留配方
    this.buildT = 0;               // 施工进度
    this.building = false;         // 是否有机器人在施工
    this._dead = false;
  }
}

// ===== 拆除标记 =====
class DeconMark {
  constructor(e) {
    this.ent = e;
    this.x = e.x; this.y = e.y;
    this.building = false;
    this._dead = false;
  }
}

// 判断某格是否已有建造幽灵占用（避免重复放置同一格）
function ghostAt(x, y, w, h) {
  for (const g of G.constrGhosts) {
    if (g._dead) continue;
    if (x < g.x + g.w && x + w > g.x && y < g.y + g.h && y + h > g.y) return g;
  }
  return null;
}

// ===== Shift+左键放置“建造虚影”（对齐《异星工厂》手动放置建造幽灵 / Building ghost）=====
// 选中可建造建筑时按住 Shift+左键：不直接落地，而是生成一个施工幽灵（虚影只投影到该处），
// 由施工机器人按触发条件（装备个人机器人港 + 背包有施工机器人 + 背包有该建筑成品）自动施工落地。
// 与蓝图粘贴生成的幽灵不同：本幽灵施工时直接消耗背包中的建筑成品本身（等价于手动建造 takeForPlace），
// 而非合成配方原料。返回是否成功放置。放置本身不消耗背包物品，可规划尚未拥有的建筑。
function tryPlaceGhost(type, tx, ty, rawSel) {
  ensureConstr();
  const def = BUILD_DEFS[type];
  if (!def) return false;
  const dir = G.ghostDir | 0;
  let ew = def.w, eh = def.h;
  if (def.rotSwap && (dir % 2 === 1)) { ew = def.h; eh = def.w; }
  // 与手动建造一致：目标格已有真实实体不可建虚影；已有同格幽灵则跳过
  if (entAt(tx, ty)) { if (typeof playSfx === 'function') playSfx('deny'); return false; }
  if (ghostAt(tx, ty, ew, eh)) return false;
  // 建造虚影不受建造范围（距离）限制：与官方一致，规划幽灵可放置在任意远处（含水/峭壁/占用等其他规则仍生效）
  const chk = canPlaceAt(type, tx, ty, dir, true);
  if (!chk.ok) { if (typeof playSfx === 'function') playSfx('deny'); return false; }
  const sq = (typeof splitQuality === 'function') ? splitQuality(rawSel) : { base: type, quality: 'normal' };
  const g = new ConstrGhost(type, tx, ty, dir);
  g.mirror = G.ghostMirror | 0;
  g.w = ew; g.h = eh;   // 按旋转后的实际占地记录
  if (sq.quality && sq.quality !== 'normal') { g.quality = sq.quality; g.needId = rawSel; }
  g.consumes = 'item';   // 手工虚影：施工时直接消耗建筑成品（见 updateConstruction / 调度）
  G.constrGhosts.push(g);
  if (typeof playSfx === 'function') playSfx('click');
  uiDirty = true;
  return true;
}

// ===== 由蓝图生成建造幽灵（替代直接落地）=====
// bp 为 applyBlueprintTransform() 后的 { ents:[{type,x,y,dir,...}], minX, minY }
// 返回实际生成的幽灵数量。被占用/不可放置的格跳过。
function pasteBlueprintAsGhosts(bp) {
  ensureConstr();
  const ox = G.cursorTile.tx - bp.minX;
  const oy = G.cursorTile.ty - bp.minY;
  let count = 0;
  for (const s of bp.ents) {
    const cls = ENT_CLASSES[s.type];
    if (!cls) continue;
    const nx = s.x + ox, ny = s.y + oy;
    const ndir = s.dir | 0;
    // 已占用则跳过（原地已有真实实体或已有同格幽灵）；
    // 同类型设备例外：登记为「替换建造」幽灵，机器人施工落地时移除旧设备并返还（对齐《异星工厂》蓝图覆盖升级）
    const oldEnt = entAt(nx, ny);
    const isReplace = !!oldEnt && oldEnt.type === s.type;
    if (oldEnt && !isReplace) continue;
    if (ghostAt(nx, ny, BUILD_DEFS[s.type].w, BUILD_DEFS[s.type].h)) continue;
    // 校验放置合法性（水面/可放置规则），不合法跳过
    if (!canPlaceAt(s.type, nx, ny, ndir).ok) continue;
    const g = new ConstrGhost(s.type, nx, ny, ndir);
    g.mirror = s.mirror | 0;
    if (s.recipe) g.recipe = s.recipe;
    if (isReplace) g.replaceEnt = oldEnt;   // 标记替换建造：落地时移除旧设备并返还
    G.constrGhosts.push(g);
    count++;
  }
  return count;
}

// 把红图框选区域内的实体登记为拆除标记（由施工机器人执行）
function markAreaForDecon(r) {
  ensureConstr();
  const seen = new Set();
  let count = 0;
  for (let ty = r.y0; ty <= r.y1; ty++) {
    for (let tx = r.x0; tx <= r.x1; tx++) {
      const e = entAt(tx, ty);
      if (!e || seen.has(e)) continue;
      seen.add(e);
      const cx = e.x + Math.floor(e.w / 2), cy = e.y + Math.floor(e.h / 2);
      if (cx >= r.x0 && cx <= r.x1 && cy >= r.y0 && cy <= r.y1) {
        // 已有同实体拆除标记则跳过
        if (G.deconMarks.some(m => !m._dead && m.ent === e)) continue;
        G.deconMarks.push(new DeconMark(e));
        count++;
      }
    }
  }
  return count;
}

// 统计矩形区域内的“建造虚影”数量（供红图删除确认弹窗，与 removeGhostsInRect 同口径）
function countGhostsInRect(r) {
  ensureConstr();
  let count = 0;
  for (const g of G.constrGhosts) {
    if (g._dead) continue;
    const cx = g.x + g.w / 2, cy = g.y + g.h / 2;
    if (cx >= r.x0 && cx <= r.x1 && cy >= r.y0 && cy <= r.y1) count++;
  }
  return count;
}

// 移除矩形区域内的“建造虚影”（红图 ALT+D / 批量清空规划标记）。
// 虚影是规划标记本身，无需施工机器人，直接抹除（在途机器人因 ghost._dead 自动返航，见 updateConstrRobot）。
// 以虚影中心是否落在区域内判定（与拆除/删除同口径）。返回移除数量。
function removeGhostsInRect(r) {
  ensureConstr();
  let count = 0;
  for (let i = G.constrGhosts.length - 1; i >= 0; i--) {
    const g = G.constrGhosts[i];
    if (g._dead) continue;
    const cx = g.x + g.w / 2, cy = g.y + g.h / 2;
    if (cx >= r.x0 && cx <= r.x1 && cy >= r.y0 && cy <= r.y1) {
      g._dead = true;
      count++;
    }
  }
  if (count) uiDirty = true;
  return count;
}

// 施工机器人任务目标中心坐标（供 toghost/repairing 飞行目标使用）。
// 支持 build（幽灵）/ decon（拆除标记）/ repair（受损实体）三种任务。
function constrJobCenter(r) {
  const job = r.job;
  if (!job) return [G.player.x, G.player.y];
  if (job.kind === 'build' && job.ghost) {
    return [(job.ghost.x + job.ghost.w / 2) * TILE, (job.ghost.y + job.ghost.h / 2) * TILE];
  }
  if (job.kind === 'decon' && job.mark) {
    return [job.mark.x * TILE + TILE / 2, job.mark.y * TILE + TILE / 2];
  }
  if (job.kind === 'repair' && job.target) {
    return [(job.target.x + job.target.w / 2) * TILE, (job.target.y + job.target.h / 2) * TILE];
  }
  return [G.player.x, G.player.y];
}

// 机器人当前任务是否仍有效（任务被清除 / 实体被移除则失效，机器人在途自动取消返航）
function constrJobValid(job) {
  if (!job) return false;
  if (job.kind === 'build') return !!job.ghost && !job.ghost._dead;
  if (job.kind === 'decon') return !!job.mark && !job.mark._dead;
  if (job.kind === 'repair') return !!job.target && !job.target._dead && isDamaged(job.target);
  return false;
}
// 机器人消耗能量：飞行按格(ROBOT_MOVE_E/格) + 待机/工作基底(ROBOT_IDLE_E/s)。
// 电量不降到负值（0 电仍能低速返航，靠 returning 分支强制飞回玩家身边）。
function constrDrain(r, moveTiles, dt) {
  const mv = (moveTiles > 0) ? moveTiles * ROBOT_MOVE_E : 0;
  r.e = Math.max(0, r.e - mv - ROBOT_IDLE_E * dt);
  return r.e;
}
// 个人机器人港（当前穿戴护甲装备网格内）总充电资源：{ stations:充电站总数, perChg:单站功率(kW), buffer:总储能(kJ) }。
// 机器人充电从机器人港自身储能 buffer（capE，由个人电网 updatePersonalPower 充电）取电，
// 每台机器人以单站额定功率（chargingEnergy，官方 1MW）速率充，最多可同时充 stations 台。
function constrChargingRates() {
  if (typeof wornEquipGrid !== 'function') return null;
  let stations = 0, perChg = 0, buffer = 0;
  const eq = (typeof EQUIPMENT !== 'undefined') ? EQUIPMENT : {};
  for (const e of wornEquipGrid()) {
    const d = eq[e.id];
    if (!d || !d.roboport) continue;
    if (typeof roboportConfig !== 'function') continue;
    const c = roboportConfig(e.id) || {};
    stations += c.stations || 2;                       // 充电站数累加（多港并联可同时充更多台）
    if (!perChg) perChg = c.chargingEnergy || 1000;    // 单站功率（各港官方均为 1MW）
    buffer += e.e || 0;                                // 机器人港自身储能缓冲剩余（kJ）
  }
  if (stations <= 0 || perChg <= 0) return null;
  return { stations, perChg, buffer };
}
// 从个人机器人港储能 buffer 取电（多港求和，先到先得）。返回实际取到的电量（kJ）。
function drainRoboportBuffer(amount) {
  if (typeof wornEquipGrid !== 'function') return 0;
  const eq = (typeof EQUIPMENT !== 'undefined') ? EQUIPMENT : {};
  let need = amount, got = 0;
  for (const e of wornEquipGrid()) {
    const d = eq[e.id];
    if (!d || !d.roboport) continue;
    const avail = e.e || 0;
    if (avail <= 0) continue;
    const use = Math.min(need, avail);
    e.e = avail - use;   // 挥机器人港缓冲（由个人电网充电补充）
    got += use; need -= use;
    if (need <= 0) break;
  }
  return got;
}
// 当前正在充电的机器人数量（机器人港 charging_stations 决定可同时充电台数，超出排队）
function countChargingRobots() {
  let n = 0;
  for (const r of G.constrRobots || []) if (!r._dead && r.state === 'charging') n++;
  return n;
}

// 给指定幽灵施工 / 拆除 / 修复：飞行 → 执行 → 返航 → （电量不足时）回港充电
function updateConstrRobot(r, dt) {
  const px = G.player.x, py = G.player.y;
  if (r.state === 'idle') return;

  // 回港充电：悬停在玩家身边，从个人机器人港储能 buffer 取电，充到 max_to_charge 后可继续任务或回收。
  // 机器人港停用 / 无电可充 / 充电位满 → 悬停等待（对齐官方电力不足时机器人停在机器人港。
  if (r.state === 'charging') {
    // 停靠可视时长未走完：先在玩家身边悬停充一下（表现为“飞回来充电”），期间不回收。
    // 距玩家仍远（低电中断返航但尚未落地）时先贴回玩家位置再充，保证充电点始终在主角身边。
    const dpx = r.x - px, dpy = r.y - py;
    const dp = Math.hypot(dpx, dpy);
    if (dp > TILE) {
      const st = CONSTR_ROBOT_SPEED * TILE * dt;
      const m = Math.min(st, dp);
      r.x -= dpx / dp * m; r.y -= dpy / dp * m;
    }
    const info = constrChargingRates();
    if (info && info.perChg > 0 && info.buffer > 0 && countChargingRobots() <= info.stations) {
      const give = info.perChg * dt;
      const got = drainRoboportBuffer(give);
      r.e = Math.min(r.maxE * CONSTR_MAX_CHARGE, r.e + got);
    }
    if (r.dockT > 0) r.dockT = Math.max(0, r.dockT - dt);
    if (r.dockT > 0) return;                          // 仍在停靠，暂不回收/出发
    if (r.e >= r.maxE * CONSTR_MAX_CHARGE) {
      if (constrJobValid(r.job)) r.state = 'toghost';   // 还有任务 → 继续
      else r._dead = true;                              // 任务完成 → 回收
    }
    return;
  }

  if (r.state === 'toghost' || r.state === 'returning') {
    const target = (r.state === 'toghost') ? constrJobCenter(r) : [px, py];
    const tx = target[0], ty = target[1];
    const dx = tx - r.x, dy = ty - r.y;
    const dist = Math.hypot(dx, dy);
    // 目标速度：基数 × 科技倍率，但每帧位移设上限，保证即使科技很高/距离很近也一定经过多帧过渡、
    // 不会“啪”一下瞬移到位（飞行过程肉眼可见）。上限 2 格/帧 ≈ 60fps 下 120 格/秒。
    const STEP_CAP = 2 * TILE;
    const spd = Math.min(CONSTR_ROBOT_SPEED * robotSpeedMult() * TILE * dt, STEP_CAP);
    // 平滑落地：当前速度向目标速度缓慢逼近（模拟加减速），并保证最后一步贴到目标。
    const curSpd = Math.hypot(r.vx || 0, r.vy || 0);
    const ns = curSpd + (Math.min(spd, dist) - curSpd) * 0.35;
    const ux = dx / dist, uy = dy / dist;
    r.vx = ux * ns; r.vy = uy * ns;
    const move = Math.hypot(r.vx, r.vy);
    if (dist < 2 || move >= dist) {
      r.x = tx; r.y = ty;
      r.vx = 0; r.vy = 0;
      if (r.state === 'toghost') {
        r.state = (r.job.kind === 'repair') ? 'repairing' : 'building';
      } else {
        // 回到玩家身边：若仍有未完成任务（低电中断的返回）→ 电量不足则回港充电后继续，否则直接折返；
        // 无未完成任务（建造/拆除完成）→ 进入回港停靠充电（可见的“飞回来充电”效果），短停后回收。
        if (constrJobValid(r.job)) r.state = (r.e < CONSTR_MIN_CHARGE * r.maxE) ? 'charging' : 'toghost';
        else { r.state = 'charging'; r.dockT = CONSTR_DOCK_TIME; }
      }
      return;
    }
    r.x += r.vx; r.y += r.vy;
    constrDrain(r, move / TILE, dt);
    // 去任务途中电量见底 → 中断任务回港充电（returning 途中不再判低电，强制返航回到玩家身边）
    if (r.state === 'toghost' && r.e < CONSTR_MIN_CHARGE * r.maxE) {
      r.state = 'returning';
    }
    return;
  }

  // 施工中：逐步完成，到达后消耗背包材料并落地（工作阶段仅耗基底 idle 电能，几乎不耗电）
  if (r.state === 'building') {
    const job = r.job;
    if (!constrJobValid(job)) { r._dead = true; return; }
    r.buildT += dt;
    constrDrain(r, 0, dt);
    if (r.buildT >= CONSTR_BUILD_TIME) {
      if (job.kind === 'build') completeBuild(job.ghost); else completeDecon(job.mark);
      r.state = 'returning';
      r.job = null;
      r.buildT = 0;
    }
    return;
  }

  // 修复中：逐步恢复受损建筑 HP（工作阶段仅耗基底 idle 电能；电量见底由返航飞行阶段处理）
  if (r.state === 'repairing') {
    const t = r.job && r.job.target;
    if (!constrJobValid(r.job)) { r._dead = true; return; }
    if (invCount('repair-pack') <= 0 && (G.repairPackUses || 0) <= 0) { r._dead = true; return; }
    r.buildT += dt;
    constrDrain(r, 0, dt);
    if (r.buildT >= CONSTR_REPAIR_INTERVAL) {
      r.buildT = 0;
      if (repairByRobot(t)) {   // 每次修复消耗修理包使用次数
        if (typeof makeSparkFx === 'function') makeSparkFx(t.x + t.w / 2, t.y + t.h / 2, t.w);
        if (typeof playSfx === 'function') playSfx('repair');
      }
      if (!isDamaged(t)) { r._dead = true; return; }   // 修好了返航
    }
  }
}

// 由施工机器人修复一个受损建筑：消耗修理包（复用玩家修理包使用次数机制）。
// 返回本次是否产生了实际修复（HP 增加）。
function repairByRobot(e) {
  if (!e || e._dead || !isDamaged(e)) return false;
  // 消耗修理包使用次数（与手动修理包共用 G.repairPackUses，背包需持有修理包）
  let uses = G.repairPackUses || 0;
  if (uses <= 0) {
    if (typeof invCount === 'function' && invCount('repair-pack') <= 0) return false;
    uses = CONSTR_REPAIR_USES;
    if (typeof invTake === 'function') invTake('repair-pack', 1);
  }
  const fixed = repairBuilding(e, CONSTR_REPAIR_AMOUNT);
  if (fixed > 0) {
    uses -= 1;
    if (uses <= 0) uses = 0;
    G.repairPackUses = uses;
    if (typeof uiDirty !== 'undefined' && uiDirty !== undefined) uiDirty = true;
    return true;
  }
  return false;
}

// 完成一个建造幽灵：落地真实实体
function completeBuild(g) {
  const cls = ENT_CLASSES[g.type];
  if (!cls) { g._dead = true; return; }
  // 替换建造：移除旧设备并返还背包（蓝图粘贴覆盖同类型设备，对齐《异星工厂》）
  if (g.replaceEnt && !g.replaceEnt._dead && g.replaceEnt.type === g.type) {
    if (typeof invAdd === 'function') invAdd(g.replaceEnt.type, 1);
    removeEnt(g.replaceEnt);
    g.replaceEnt = null;
  }
  // 格仍被占用则放弃
  if (entAt(g.x, g.y)) { g._dead = true; return; }
  const e = cls.restore({ type: g.type, x: g.x, y: g.y, dir: g.dir, mirror: g.mirror | 0 });
  e.dir = g.dir | 0; e.mirror = g.mirror | 0; e.applyDir();
  if (g.recipe && typeof e.setRecipe === 'function') e.setRecipe(g.recipe);
  addEnt(e);
  g._dead = true;
  // 施工机器人建成：短促金属“叮”
  if (typeof playSfx === 'function') playSfx('robot-build');
}

// 完成一个拆除标记：返还物资并移除实体
function completeDecon(m) {
  const e = m.ent;
  if (!e || e._dead) { m._dead = true; return; }
  // 拆除时瞬间返还实体内容（含传送带上携带的物品），对齐手动拆除/红图批量删除：
  // 传送带是流动的，若逐件先取物品，移动中的传送带会不断补充导致无法清空，
  // 因此需一次性移除整条带上的所有物品并全部返还，再移除实体本身。
  for (const [id, n] of e.contents()) if (typeof invAdd === 'function') invAdd(id, n);
  removeEnt(e);
  if (G.panelEnt === e && typeof closePanel === 'function') closePanel();
  m._dead = true;
}

// ===== 全局施工调度 =====
function updateConstruction(dt) {
  ensureConstr();
  // 没有个人机器人港：清空在途机器人/拆除标记，但【保留建造幽灵】。
  // 手动 Shift+左键放置的“建造虚影”是规划标记（虚影只投影到该处），即使当前未装备机器人港
  // 也应一直保留；装配个人机器人港+背包有施工机器人后，再由机器人自动施工落地。
  // （蓝图流本就不会在无机器人港时产生幽灵，故此处不会残留无效蓝图幽灵。）
  if (!hasPersonalRoboport()) {
    // 单遍 compactFilter 原地清理（替代 .filter 每帧分配新数组），并修复原有误：原实现
    // G.constrRobots.filter(r => r._dead) 误保留死亡机器人、丢弃存活机器人，此处改为保留存活。
    G.deconMarks = compactFilter(G.deconMarks, m => !m._dead);
    G.constrRobots = compactFilter(G.constrRobots, r => !r._dead);
    return;
  }
  // 清理墓碑：单遍 compactFilter（替代原 .some()+filter 双遍扫描，减少每帧遍历与分配）
  G.constrGhosts = compactFilter(G.constrGhosts, g => !g._dead);
  G.deconMarks = compactFilter(G.deconMarks, m => !m._dead);
  G.constrRobots = compactFilter(G.constrRobots, r => !r._dead);

  // 机器人港被 Alt+F 停用：不再派发新机器人、已进场机器人暂停原地（保留幽灵与在场机器人）
  if (!roboportOn()) return;

  // 更新现有机器人
  for (const r of G.constrRobots) updateConstrRobot(r, dt);

  // 统计当前在施工的机器人数量（计数循环替代 filter().length，避免每帧分配新数组）
  const rInfo = constrRoboportInfo();
  let activeCount = 0;
  for (const r of G.constrRobots) if (!r._dead && r.state !== 'idle') activeCount++;
  if (activeCount >= rInfo.maxActive) return;

  // 找待施工幽灵（优先未在施工的）
  // 触发条件：装备个人机器人港（上方已判定）+ 背包须有施工机器人 + 背包有足够材料/成品，缺一则不派机器人。
  const constrHasRobot = constrRobotCount() > 0;
  let targetGhost = null;
  for (const g of G.constrGhosts) {
    if (g._dead || g.building) continue;
    // 范围内判断
    if (Math.abs((g.x + g.w / 2) - G.player.x / TILE) > rInfo.range) continue;
    if (Math.abs((g.y + g.h / 2) - G.player.y / TILE) > rInfo.range) continue;
    // 需要材料：只有全部材料齐备时才施工（材料不足的幽灵原地等待，下次材料备齐自动续建，不会丢失）。
    // 手工虚影（consumes==='item'）直接消耗背包中的建筑成品本身；蓝图虚影则消耗合成配方原料。
    let enough = true;
    if (g.consumes === 'item') {
      if (constrHasRobot && haveForPlace(g.needId || g.type) < 1) enough = false;
    } else {
      const rec = RECIPES[g.type] || null;
      if (rec) {
        for (const k in rec.inp) if (invCount(k) < rec.inp[k]) { enough = false; break; }
      }
    }
    if (!enough) continue;   // 材料不足跳过，等下次再试
    targetGhost = g;
    break;
  }
  if (targetGhost && constrHasRobot) {
    // 从背包扣除建造所需材料（此时已确认全部材料充足，一次性扣足）
    if (targetGhost.consumes === 'item') {
      takeForPlace(targetGhost.needId || targetGhost.type);
      if (typeof trackProd === 'function') trackProd(targetGhost.type, -1);
    } else {
      const rec = RECIPES[targetGhost.type];
      if (rec) {
        for (const k in rec.inp) {
          for (let i = 0; i < rec.inp[k]; i++) invTake(k, 1);
          if (typeof trackProd === 'function') trackProd(k, -rec.inp[k]);
        }
      }
    }
    targetGhost.building = true;
    const r = new ConstrRobot(G.player.x, G.player.y);
    r.state = 'toghost';
    r.job = { kind: 'build', ghost: targetGhost };
    G.constrRobots.push(r);
    return;
  }

  // 找待拆除标记
  let targetMark = null;
  for (const m of G.deconMarks) {
    if (m._dead || m.building) continue;
    if (Math.abs(m.x - G.player.x / TILE) > rInfo.range) continue;
    if (Math.abs(m.y - G.player.y / TILE) > rInfo.range) continue;
    targetMark = m;
    break;
  }
  if (targetMark) {
    targetMark.building = true;
    const r = new ConstrRobot(G.player.x, G.player.y);
    r.state = 'toghost';
    r.job = { kind: 'decon', mark: targetMark };
    G.constrRobots.push(r);
    return;
  }

  // 找待修复的受损建筑（对齐《异星工厂》：施工机器人自动修复基地建筑）
  // 背包须持有修理包才有修复能力；按扫描间隔节流以避免高频全量扫描。
  const haveRepair = (invCount('repair-pack') > 0 || (G.repairPackUses || 0) > 0);
  if (haveRepair) {
    if (G._constrRepairScanT === undefined) G._constrRepairScanT = 0;
    G._constrRepairScanT -= dt;
    if (G._constrRepairScanT <= 0) {
      G._constrRepairScanT = CONSTR_REPAIR_SCAN_T;
      const pcx = Math.floor(G.player.x / TILE), pcy = Math.floor(G.player.y / TILE);
      const keys = bucketKeysIn(pcx - rInfo.range, pcy - rInfo.range, pcx + rInfo.range, pcy + rInfo.range);
      let repairTarget = null;
      forEachEntInBuckets(keys, function(e) {
        if (repairTarget) return;
        if (!e || e._dead) return;
        if (!isDamaged(e)) return;
        // 中心点在个人机器人港范围内才可修复
        const cx = e.x + e.w / 2 - pcx, cy = e.y + e.h / 2 - pcy;
        if (cx * cx + cy * cy > rInfo.range * rInfo.range) return;
        // 已有机器人在修复该实体则跳过
        for (const rr of G.constrRobots) {
          if (rr._dead || rr.state !== 'repairing') continue;
          if (rr.job && rr.job.kind === 'repair' && rr.job.target === e) return;
        }
        repairTarget = e;
      });
      if (repairTarget) {
        const r = new ConstrRobot(G.player.x, G.player.y);
        r.state = 'toghost';
        r.job = { kind: 'repair', target: repairTarget };
        G.constrRobots.push(r);
        return;
      }
    }
  }
}

// 供 UI 查询：当前待施工幽灵数 / 待拆除数
function constrPending() {
  return {
    build: G.constrGhosts ? G.constrGhosts.filter(g => !g._dead && !g.building).length : 0,
    decon: G.deconMarks ? G.deconMarks.filter(m => !m._dead && !m.building).length : 0,
    robots: G.constrRobots ? G.constrRobots.filter(r => !r._dead && r.state !== 'idle').length : 0
  };
}

// ===== 渲染：幽灵 / 拆除标记 / 施工机器人 =====
// 建造虚影与拆除标记单独绘制：放在玩家之前（下层），保证主角移到虚影上时显示在最上层不被遮挡。
function drawConstrGhosts(ctx) {
  ensureConstr();
  // 建造幽灵：绘制该建筑自身造型的半透明虚影 + 绿色虚边框
  for (const g of G.constrGhosts) {
    if (g._dead) continue;
    if (typeof onScreen === 'function' && !onScreen({ x: g.x, y: g.y, w: g.w, h: g.h })) continue;
    const px = g.x * TILE, py = g.y * TILE;
    // 半透明目标建筑（复用放置幽灵的 drawEntity：渲染建筑自身的真实造型，只是半透明虚影）
    const def = BUILD_DEFS[g.type];
    if (def && typeof getGhostEnt === 'function' && typeof drawEntity === 'function') {
      let ew = def.w, eh = def.h;
      if (def.rotSwap && (g.dir % 2 === 1)) { ew = def.h; eh = def.w; }
      const tmp = getGhostEnt(g.type);
      tmp.dir = g.dir; tmp.mirror = g.mirror | 0;
      tmp.x = g.x; tmp.y = g.y; tmp.w = ew; tmp.h = eh;
      drawEntity(ctx, tmp, g.x, g.y, g.dir, 0.5);
    } else {
      // 兜底：无绘制回调时用物品色填充的虚影框
      const col = ITEMS[g.type] ? ITEMS[g.type].color : '#7a7a8a';
      ctx.save();
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = col;
      ctx.fillRect(px + 2, py + 2, TILE * g.w - 4, TILE * g.h - 4);
      ctx.restore();
    }
    // 浅蓝色蒙层（替代原绿色边框）：半透明建筑之上覆盖一层淡蓝，用于标识“待施工虚影”
    ctx.save();
    ctx.globalAlpha = 0.2;
    ctx.fillStyle = '#9fd7ff';
    ctx.fillRect(px, py, TILE * g.w, TILE * g.h);
    ctx.restore();
  }
  // 拆除标记：红色斜叉
  for (const m of G.deconMarks) {
    if (m._dead || !m.ent) continue;
    const px = (m.x + (m.ent.w || 1) / 2) * TILE, py = (m.y + (m.ent.h || 1) / 2) * TILE;
    ctx.strokeStyle = '#e05a4a';
    ctx.lineWidth = 3;
    const s = Math.max(6, TILE / 3);
    ctx.beginPath();
    ctx.moveTo(px - s, py - s); ctx.lineTo(px + s, py + s);
    ctx.moveTo(px + s, py - s); ctx.lineTo(px - s, py + s);
    ctx.stroke();
  }
}

// 施工机器人（飞行动画等）：放在玩家之后（最上层）
function drawConstruction(ctx) {
  ensureConstr();
  // 施工机器人
  for (const r of G.constrRobots) {
    if (r._dead || r.state === 'idle') continue;
    if (typeof onScreen === 'function' && !onScreen({ x: r.x / TILE, y: r.y / TILE, w: 1, h: 1 })) continue;
    // 朝向目标的角度
    let targetX = r.tx || r.x, targetY = r.ty || r.y;
    if (r.job && r.job.kind !== 'returning') {
      const [cjx, cjy] = constrJobCenter(r);
      if (cjx !== G.player.x || cjy !== G.player.y) { targetX = cjx; targetY = cjy; }
    }
    const robAng = Math.atan2(targetY - r.y, targetX - r.x);
    const flying = (r.state === 'toghost' || r.state === 'returning');
    // 飞行拖尾：沿运动反方向拉伸的渐隐色带，让“飞出去/飞回来”轨迹一眼可见
    if (flying) {
      ctx.strokeStyle = 'rgba(240,170,60,.28)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(r.x - Math.cos(robAng) * 16, r.y - Math.sin(robAng) * 16);
      ctx.lineTo(r.x - Math.cos(robAng) * 34, r.y - Math.sin(robAng) * 34);
      ctx.stroke();
    }
    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath();
    ctx.ellipse(r.x, r.y + 11, 7, 3, 0, 0, 7);
    ctx.fill();
    // 施工/充电光效（绿色脉冲）
    if (r.state === 'building' || r.state === 'charging' || r.state === 'repairing') {
      ctx.fillStyle = 'rgba(120,230,120,.5)';
      ctx.beginPath();
      ctx.arc(r.x, r.y, 10 + (performance.now() % 300) / 300 * 5, 0, 7);
      ctx.fill();
    }
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(robAng);
    ctx.fillStyle = (r.state === 'repairing') ? '#8ac0e0' : '#e0a63a';
    ctx.beginPath();
    ctx.moveTo(13, 0); ctx.lineTo(-8, -8); ctx.lineTo(-4, 0); ctx.lineTo(-8, 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.45)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.restore();
    // 施工工具小图标
    ctx.fillStyle = '#e0e0a0';
    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((r.state === 'repairing') ? '🛠' : '🔧', r.x + 8, r.y - 8);
    // 头顶电量条：黄(>50%)→橙(≤50%)→红(≤25%)；充电/回港停靠时偏绿闪烁，直观反映“飞回来充电”
    const Ew = 16, Eh = 4;
    const bx = r.x - Ew / 2, by = r.y - 15;
    const frac = Math.max(0, Math.min(1, r.e / r.maxE));
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillRect(bx - 1, by - 1, Ew + 2, Eh + 2);
    ctx.fillStyle = (r.state === 'charging')
      ? ((Math.floor(performance.now() / 120) % 2 === 0) ? '#5ad06a' : '#7de58a')
      : (frac > 0.5 ? '#d8b84a' : (frac > 0.25 ? '#e08a3a' : '#d04a3a'));
    ctx.fillRect(bx, by, Ew * frac, Eh);
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, Ew, Eh);
  }
}

// 序列化个人机器人港状态（随存档保存，含启用状态与所有“建造虚影”）
function constrSerialize() {
  const ghosts = (G.constrGhosts && G.constrGhosts.length)
    ? G.constrGhosts.filter(g => !g._dead).map(g => ({
        type: g.type, x: g.x, y: g.y, dir: g.dir | 0, mirror: g.mirror | 0,
        w: g.w, h: g.h, quality: g.quality, needId: g.needId, recipe: g.recipe, consumes: g.consumes
      }))
    : [];
  return {
    personalRoboport: G.personalRoboport === 'mk2' ? 'mk2' : !!G.personalRoboport,
    roboportActive: G.roboportActive === false ? false : true,
    ghosts
  };
}
function constrRestore(s) {
  const v = s && s.personalRoboport;
  G.personalRoboport = (v === 'mk2' || v === true) ? (v === 'mk2' ? 'mk2' : true) : false;
  G.roboportActive = (s && s.roboportActive === false) ? false : true;
  G.constrGhosts = [];
  G.deconMarks = [];
  G.constrRobots = [];
  // 恢复存档中的“建造虚影”规划标记（Ctrl+C/X、Shift+左键、蓝图粘贴等生成的虚影都随存档持久化）。
  // 逐条容错：类型无效或重建失败即跳过该条，其余正常保留。
  const gdefs = (s && Array.isArray(s.ghosts)) ? s.ghosts : [];
  for (const gd of gdefs) {
    if (!gd || !gd.type || !BUILD_DEFS[gd.type]) continue;
    try {
      const g = new ConstrGhost(gd.type, gd.x | 0, gd.y | 0, gd.dir | 0);
      g.mirror = gd.mirror | 0;
      if (typeof gd.w === 'number' && typeof gd.h === 'number') { g.w = gd.w; g.h = gd.h; }
      if (gd.quality) g.quality = gd.quality;
      if (gd.needId) g.needId = gd.needId;
      if (gd.recipe) g.recipe = gd.recipe;
      if (gd.consumes) g.consumes = gd.consumes;
      G.constrGhosts.push(g);
    } catch (e) { /* 忽略无法重建的虚影条目 */ }
  }
}
