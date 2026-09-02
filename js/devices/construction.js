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
  if (!G.netRobots) G.netRobots = [];   // 网络施工机器人（由机器人港派发，取网内物流箱物品施工）
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

// 树木拆除标记（无实体，指向地形瓦片 T_TREE）：红图可标记树木，由施工机器人砍伐获得木材。
function treeDeconMark(x, y) {
  return { ent: null, tree: true, x, y, building: false, _dead: false };
}

// 峭壁拆除标记（无实体，指向地形瓦片 T_CLIFF）：强建（Shift/Ctrl+Shift 放置蓝图）会自动标记
// 蓝图范围内的峭壁，由施工机器人携带“峭壁炸药”炸毁清除（对齐《异星工厂》Cliff：
// 机器人不能空手拆悬崖，需从背包/物流网络取峭壁炸药；无炸药时标记保留等待）。
function cliffDeconMark(x, y) {
  return { ent: null, cliff: true, x, y, building: false, _dead: false };
}

// 拆除标记是否仍有效：树木/峭壁标记以该格仍为对应地形判定（被建筑覆盖/手动清除则失效）；
// 实体标记以实体仍存在判定。
function deconMarkValid(m) {
  if (!m || m._dead) return false;
  if (m.tree) return getTerrain(m.x, m.y) === T_TREE;
  if (m.cliff) return getTerrain(m.x, m.y) === T_CLIFF;
  return !!m.ent && !m.ent._dead;
}

// ===== 强建（Shift 强制建造 / Ctrl+Shift 超级强制建造）辅助 =====
// 为单格天然障碍（树木/峭壁）登记拆除标记；已有同格同类型标记则跳过。返回是否新增。
function markObstacleDecon(x, y) {
  const t = getTerrain(x, y);
  if (t === T_TREE) {
    if (G.deconMarks.some(m => !m._dead && m.tree && m.x === x && m.y === y)) return false;
    G.deconMarks.push(treeDeconMark(x, y));
    return true;
  }
  if (t === T_CLIFF) {
    if (G.deconMarks.some(m => !m._dead && m.cliff && m.x === x && m.y === y)) return false;
    G.deconMarks.push(cliffDeconMark(x, y));
    return true;
  }
  return false;
}

// 为实体登记拆除标记；已有同实体标记则跳过。返回是否新增。
function markEntDecon(e) {
  if (!e || e._dead) return false;
  if (G.deconMarks.some(m => !m._dead && m.ent === e)) return false;
  G.deconMarks.push(new DeconMark(e));
  return true;
}

// 远程视图右键标记拆除（对齐《异星工厂》地图视图：右键长按设备/障碍物即登记拆除标记，
// 由施工机器人处理；未在机器人覆盖范围的标记保留为可持久化规划标记，靠近后自动续拆）。
// 目标：设备实体 / 树木 / 峭壁。已登记/不存在则跳过。
function markRemoteDeconAt(tx, ty) {
  ensureConstr();
  const e = entAt(tx, ty);
  if (e) {
    if (markEntDecon(e)) {
      if (typeof playSfx === 'function') playSfx('click');
      uiDirty = true;
    }
    return;
  }
  const t = getTerrain(tx, ty);
  if (t === T_TREE || t === T_CLIFF) {
    if (markObstacleDecon(tx, ty)) {
      if (typeof playSfx === 'function') playSfx('click');
      uiDirty = true;
    }
  }
}

// 虚影占地内是否仍有阻挡建造的障碍（实体/树木/峭壁/水面）。
// 强建会把虚影派在障碍之上（等机器人清理后再施工），施工派发前用此判定障碍是否已清除，
// 避免“先扣材料、落地时却被阻挡而白白浪费建筑材料”（对齐《异星工厂》：先清障后建造）。
function ghostFootprintBlocked(g) {
  for (let dy = 0; dy < g.h; dy++)
    for (let dx = 0; dx < g.w; dx++) {
      const x = g.x + dx, y = g.y + dy;
      const e = entAt(x, y);
      if (e && e !== g.replaceEnt) return true;
      const t = getTerrain(x, y);
      if (t === T_TREE || t === T_CLIFF || t === T_WATER) return true;
    }
  return false;
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
// forceMode：0=普通虚影；1=强制建造（Shift，无视树/峭壁并标记拆除，跳过建筑冲突）；
//            2=超级强制建造（Shift+Ctrl，树/峭壁与玩家建筑全部标记拆除，先拆后建）。
function tryPlaceGhost(type, tx, ty, rawSel, forceMode) {
  ensureConstr();
  const def = BUILD_DEFS[type];
  if (!def) return false;
  forceMode = forceMode || 0;
  const dir = G.ghostDir | 0;
  let ew = def.w, eh = def.h;
  if (def.rotSwap && (dir % 2 === 1)) { ew = def.h; eh = def.w; }
  // 强建：先扫描占地（水面跳过 / 天然障碍待标记 / 玩家建筑按档处理）
  let water = false;
  const obstTiles = [];            // 占地内的天然障碍格（树/峭壁）
  const blockEnts = new Set();     // 占地内已有的玩家实体
  if (forceMode) {
    for (let dy = 0; dy < eh; dy++)
      for (let dx = 0; dx < ew; dx++) {
        const t = getTerrain(tx + dx, ty + dy);
        if (t === T_WATER) water = true;
        else if (t === T_TREE || t === T_CLIFF) obstTiles.push([tx + dx, ty + dy]);
        const e = entAt(tx + dx, ty + dy);
        if (e) blockEnts.add(e);
      }
    if (water) { if (typeof playSfx === 'function') playSfx('deny'); return false; }
    if (forceMode === 2) {
      // 超级强制建造：占地内玩家建筑全部登记“待拆除”，由施工机器人先拆后建（一键替换）
      for (const e of blockEnts) markEntDecon(e);
    } else if (blockEnts.size) {
      // 强制建造：不拆除玩家建筑；仅同类型同占地实体保留“替换建造”，其余冲突一律拒绝
      const oldEnt = entAt(tx, ty);
      if (!(oldEnt && oldEnt.type === type && canPlaceAt(type, tx, ty, dir, true).ok)) {
        if (typeof playSfx === 'function') playSfx('deny');
        return false;
      }
    }
    // 天然障碍（树/峭壁）：两档强建均登记拆除标记，由施工机器人清理（对齐《异星工厂》）
    for (const [ox, oy] of obstTiles) markObstacleDecon(ox, oy);
  } else {
    // 普通虚影：目标格已有真实实体不可建
    if (entAt(tx, ty)) { if (typeof playSfx === 'function') playSfx('deny'); return false; }
    // 建造虚影不受建造范围（距离）限制：与官方一致，规划幽灵可放置在任意远处（含水/峭壁/占用等其他规则仍生效）
    const chk = canPlaceAt(type, tx, ty, dir, true);
    if (!chk.ok) { if (typeof playSfx === 'function') playSfx('deny'); return false; }
  }
  if (ghostAt(tx, ty, ew, eh)) return false;
  const sq = (typeof splitQuality === 'function') ? splitQuality(rawSel) : { base: type, quality: 'normal' };
  const g = new ConstrGhost(type, tx, ty, dir);
  g.mirror = G.ghostMirror | 0;
  g.w = ew; g.h = eh;   // 按旋转后的实际占地记录
  if (sq.quality && sq.quality !== 'normal') { g.quality = sq.quality; g.needId = rawSel; }
  g.consumes = 'item';   // 手工虚影：施工时直接消耗建筑成品（见 updateConstruction / 调度）
  if (forceMode) {
    // 虚影派在障碍（树/峭壁/待拆建筑）之上：等障碍清除后再派施工（见 ghostFootprintBlocked / updateConstruction）
    if (obstTiles.length || (forceMode === 2 && blockEnts.size)) g.waitClear = true;
    // 强制建造（非超级）下的同类型实体：保留“替换建造”覆盖（对齐《异星工厂》覆盖升级）
    if (forceMode === 1 && blockEnts.size && entAt(tx, ty) && entAt(tx, ty).type === type) g.replaceEnt = entAt(tx, ty);
  }
  G.constrGhosts.push(g);
  if (typeof playSfx === 'function') playSfx('click');
  uiDirty = true;
  return true;
}

// ===== 由蓝图生成建造幽灵（替代直接落地）=====
// bp 为 applyBlueprintTransform() 后的 { ents:[{type,x,y,dir,...}], minX, minY }
// forceMode：0=普通粘贴；1=强制建造（Shift，无视树/峭壁，跳过玩家建筑冲突）；
//            2=超级强制建造（Shift+Ctrl，树/峭壁与玩家建筑全部标记拆除，实现一键替换）。
// 返回 { placed: 实际生成的幽灵数量, marked: 为强建新登记的拆除标记数量 }。
function pasteBlueprintAsGhosts(bp, forceMode) {
  ensureConstr();
  const ox = G.cursorTile.tx - bp.minX;
  const oy = G.cursorTile.ty - bp.minY;
  let count = 0;
  let marked = 0;
  for (const s of bp.ents) {
    const cls = ENT_CLASSES[s.type];
    if (!cls) continue;
    const def = BUILD_DEFS[s.type];
    const nx = s.x + ox, ny = s.y + oy;
    const ndir = s.dir | 0;
    let ew = def.w, eh = def.h;
    if (def.rotSwap && (ndir % 2 === 1)) { ew = def.h; eh = def.w; }
    if (ghostAt(nx, ny, ew, eh)) continue;   // 已有同格幽灵则跳过
    // —— 普通粘贴：沿用原逻辑（水面/树木/峭壁/已占用各自跳过；同类型设备替换建造）——
    if (!forceMode) {
      const oldEnt = entAt(nx, ny);
      const isReplace = !!oldEnt && oldEnt.type === s.type;
      if (oldEnt && !isReplace) continue;
      if (!canPlaceAt(s.type, nx, ny, ndir, true).ok) continue;
      const g = new ConstrGhost(s.type, nx, ny, ndir);
      g.w = ew; g.h = eh;
      g.mirror = s.mirror | 0;
      g.consumes = 'item';   // 蓝图虚影：施工时直接消耗背包中的建筑成品本身
      if (s.recipe) g.recipe = s.recipe;
      if (isReplace) g.replaceEnt = oldEnt;   // 标记替换建造：落地时移除旧设备并返还
      G.constrGhosts.push(g);
      count++;
      continue;
    }
    // —— 强建（Shift / Shift+Ctrl）——
    // 扫描占地：水面不可建也不可拆 → 跳过；实体（玩家建筑）与天然障碍（树/峭壁）另有处理。
    let water = false;
    const blockEnts = new Set();   // 占地内的玩家实体（去重）
    const obstTiles = [];          // 占地内的天然障碍格（树/峭壁）
    for (let dy = 0; dy < eh; dy++)
      for (let dx = 0; dx < ew; dx++) {
        const x = nx + dx, y = ny + dy;
        const t = getTerrain(x, y);
        if (t === T_WATER) water = true;
        else if (t === T_TREE || t === T_CLIFF) obstTiles.push({ x, y, t });
        const e = entAt(x, y);
        if (e) blockEnts.add(e);
      }
    if (water) continue;
    if (forceMode === 2) {
      // 超级强制建造：蓝图范围内的玩家建筑全部登记“待拆除”，由施工机器人先拆后建（一键替换）。
      for (const e of blockEnts) if (markEntDecon(e)) marked++;
    } else {
      // 强制建造（Shift）：不拆除玩家建筑；有建筑冲突则跳过该位置，只放能放下的建筑。
      if (blockEnts.size && !canPlaceAt(s.type, nx, ny, ndir, true).ok) continue;
    }
    // 天然障碍（树木/峭壁）：两档强建均登记拆除标记，由施工机器人清理（对齐《异星工厂》）。
    for (const t of obstTiles) if (markObstacleDecon(t.x, t.y)) marked++;
    const g = new ConstrGhost(s.type, nx, ny, ndir);
    g.w = ew; g.h = eh;
    g.mirror = s.mirror | 0;
    g.consumes = 'item';
    if (s.recipe) g.recipe = s.recipe;
    // 虚影派在障碍（树/峭壁/待拆建筑）之上：等障碍清除后再派施工（见 ghostFootprintBlocked）。
    if (obstTiles.length || (forceMode === 2 && blockEnts.size)) g.waitClear = true;
    // 强制建造（非超级）下的同类型设备：保留“替换建造”覆盖（对齐《异星工厂》蓝图覆盖升级）。
    const oldEnt = entAt(nx, ny);
    if (forceMode === 1 && oldEnt && oldEnt.type === s.type) g.replaceEnt = oldEnt;
    G.constrGhosts.push(g);
    count++;
  }
  return { placed: count, marked };
}

// 把红图框选区域内的实体登记为拆除标记（由施工机器人执行）
// 同时登记区域内的天然障碍（树木 T_TREE / 峭壁 T_CLIFF 地形）：机器人砍树获得木材，
// 峭壁需消耗峭壁炸药炸毁（对齐《异星工厂》红图/拆除规划可包含悬崖）。
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
  // 天然障碍（树木/峭壁）：无实体地形瓦片，同一格只登记一次（markObstacleDecon 已去重）
  for (let ty = r.y0; ty <= r.y1; ty++) {
    for (let tx = r.x0; tx <= r.x1; tx++) {
      if (markObstacleDecon(tx, ty)) count++;
    }
  }
  return count;
}

// 红图/远程视图 + Shift 框选：取消框选区域内已登记的拆除标记（红叉），建筑恢复不被拆除。
// 与 markAreaForDecon 同口径：以实体中心/树木/峭壁瓦片是否落在区域内判定。返回取消数量。
function unmarkAreaForDecon(r) {
  ensureConstr();
  if (!G.deconMarks || !G.deconMarks.length) return 0;
  let count = 0;
  for (const m of G.deconMarks) {
    if (m._dead) continue;
    if (m.tree) {
      // 树木标记：瓦片坐标落在区域内即取消
      if (m.x >= r.x0 && m.x <= r.x1 && m.y >= r.y0 && m.y <= r.y1) {
        m._dead = true;
        count++;
      }
      continue;
    }
    if (m.cliff) {
      // 峭壁标记：瓦片坐标落在区域内即取消（对齐树木标记；强建/右键产生的峭壁标记同样可取消）
      if (m.x >= r.x0 && m.x <= r.x1 && m.y >= r.y0 && m.y <= r.y1) {
        m._dead = true;
        count++;
      }
      continue;
    }
    const e = m.ent;
    if (!e || e._dead) continue;
    const cx = e.x + Math.floor(e.w / 2), cy = e.y + Math.floor(e.h / 2);
    if (cx >= r.x0 && cx <= r.x1 && cy >= r.y0 && cy <= r.y1) {
      m._dead = true;
      count++;
    }
  }
  if (count && typeof uiDirty !== 'undefined') uiDirty = true;
  return count;
}

// 手动处理/移除实体时同步清掉其上的“拆除标记”（红叉）：标记指向的实体已不存在即失效。
// 由 removeEnt（entity.js）调用，覆盖拆除模式/右键拆除/绿图升级替换/摧毁等所有实体移除路径。
function clearDeconMarkFor(e) {
  if (!e || !G.deconMarks || !G.deconMarks.length) return;
  for (const m of G.deconMarks) {
    if (!m._dead && m.ent === e) m._dead = true;
  }
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
    // 拆除物归位：随身携带拆除物的机器人在玩家身边盘旋，背包腾出空位才逐一放入；
    // 只要还有未放下的物品就继续等待，不回收、不出发（对齐《异星工厂》）。
    if (returnCargoToPlayer(r)) { if (typeof uiDirty !== 'undefined') uiDirty = true; return; }
    if (r.e >= r.maxE * CONSTR_MAX_CHARGE) {
      if (constrJobValid(r.job)) r.state = 'toghost';   // 还有任务 → 继续
      else r._dead = true;                              // 任务完成 → 回收
    }
    return;
  }

  if (r.state === 'toghost' || r.state === 'returning') {
    // 任务被取消（如 Shift 框选取消拆除标记）：正在飞过去的机器人不突然消失，
    // 直接掉头返航回玩家身边（个人机器人平台的充电点），回到玩家后停靠充电并回收。
    if (r.state === 'toghost' && !constrJobValid(r.job)) { r.state = 'returning'; }
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

  // 施工中：到达后立即消耗背包材料并落地（建造无耗时，立刻落地并马上返航，无需等待建造时间）
  if (r.state === 'building') {
    const job = r.job;
    // 任务已被取消（标记被 Shift 框选取消/虚影被清除）：不突然消失，返航回玩家身边充电后回收
    if (!constrJobValid(job)) { r.state = 'returning'; return; }
    if (job.kind === 'build') completeBuild(job.ghost); else completeDecon(job.mark, r);
    r.state = 'returning';
    r.job = null;
    r.buildT = 0;
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

// 完成一个拆除标记：移除实体，拆除物交由施工机器人携带（对齐《异星工厂》：机器人拿着拆除物
// 飞回玩家身边盘旋，背包腾出空位才逐一放入；不原地丢进背包，避免背包装满时物品静默丢失）。
function completeDecon(m, r) {
  // 树木拆除标记：无实体，直接清除地形瓦片并获得木材。
  if (m.tree) {
    if (getTerrain(m.x, m.y) !== T_TREE) { m._dead = true; return; }
    setTerrain(m.x, m.y, T_GRASS);
    if (typeof invalidateTerrainChunk === 'function') invalidateTerrainChunk(m.x, m.y);
    m._dead = true;
    // 木材与其他拆除物一致：随机器人携带（个人机器人返航入玩家背包；
    // 网络机器人回港后统一放入物流网络中的黄箱/绿箱，见 netDropCargo）。
    const wood = [['wood', 1]];
    if (r) r.cargo = mergeItemList(r.cargo || [], wood);
    else if (typeof invAdd === 'function') invAdd('wood');
    return;
  }
  // 峭壁拆除：需消耗“峭壁炸药”才能炸毁（对齐《异星工厂》：机器人不能空手拆悬崖）。
  // 个人机器人从玩家背包扣炸药；网络机器人使用先取货携带的炸药（r.carry）。
  // 炸药缺失时本格不拆除、标记保留等待——派发前已做炸药判定，此分支仅作安全兜底。
  if (m.cliff) {
    if (getTerrain(m.x, m.y) !== T_CLIFF) { m._dead = true; return; }
    if (r && r.home) {
      if (!r.carry || r.carry.item !== 'cliff-explosives' || r.carry.count < 1) return;
      r.carry = null;   // 消耗网络机器人携带来的炸药
    } else if (typeof invTake === 'function') {
      if (invCount('cliff-explosives') < 1) return;
      invTake('cliff-explosives', 1);   // 消耗玩家背包中的炸药
    }
    setTerrain(m.x, m.y, T_GRASS);
    if (typeof invalidateTerrainChunk === 'function') invalidateTerrainChunk(m.x, m.y);
    m._dead = true;
    // 爆炸视觉 + 音效（与手动峭壁炸药 cliffBlastAt 一致）
    if (typeof spawnSmoke === 'function') {
      for (let i = 0; i < 6; i++) spawnSmoke(m.x * TILE + TILE / 2 + (Math.random() - 0.5) * 22, m.y * TILE + TILE / 2 + (Math.random() - 0.5) * 22, { life: 1.2, size: 8, color: '#b0a898' });
    }
    if (typeof playSfx === 'function') playSfx('explosion');
    return;
  }
  const e = m.ent;
  if (!e || e._dead) { m._dead = true; return; }
  // 拆除时瞬间返还实体内容（含传送带上携带的物品），对齐手动拆除/红图批量删除：
  // 传送带是流动的，若逐件先取物品，移动中的传送带会不断补充导致无法清空，
  // 因此需一次性移除整条带上的所有物品并全部返还，再移除实体本身。
  const items = e.contents();
  removeEnt(e);
  if (G.panelEnt === e && typeof closePanel === 'function') closePanel();
  m._dead = true;
  if (r && items && items.length) r.cargo = mergeItemList(r.cargo || [], items);
  else for (const [id, n] of items) if (typeof invAdd === 'function') invAdd(id, n);
}

// 合并物品列表（相同 ID 累加），用于拆除物缓存到机器人身上
function mergeItemList(a, b) {
  const map = new Map();
  for (const [id, n] of a) if (n > 0) map.set(id, (map.get(id) || 0) + n);
  for (const [id, n] of b) if (n > 0) map.set(id, (map.get(id) || 0) + n);
  return [...map].map(([id, n]) => [id, n]);
}

// 把机器人随身携带的拆除物逐件放进玩家背包（有空间才放，放不下的继续随身携带等待）。
// 返回 true 表示仍持有未放入的拆除物（需继续盘旋等待），false 表示已全部放入/无携带。
function returnCargoToPlayer(r) {
  if (!r.cargo || !r.cargo.length) return false;
  let stillHolding = false;
  for (let i = r.cargo.length - 1; i >= 0; i--) {
    const [id, n] = r.cargo[i];
    if (n <= 0) { r.cargo.splice(i, 1); continue; }
    const added = invAdd(id, n);
    const rest = n - added;
    if (rest <= 0) r.cargo.splice(i, 1);
    else { r.cargo[i] = [id, rest]; stillHolding = true; }
  }
  if (!r.cargo.length) r.cargo = null;
  return stillHolding;
}

// ===== 全局施工调度 =====
function updateConstruction(dt) {
  ensureConstr();
  // 物流网络施工机器人（机器人港派发的“网内建造”）独立于个人机器人港运行：
  // 只要「物流网络」已解锁且有已通电机器人港覆盖虚影，就由网络机器人施工。
  updateNetConstruction(dt);
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
    // 物流网络优先级：若机器人港物流网络可（且将）施工该虚影，则让给网络机器人，
    // 个人机器人港不再重复施工（对齐《异星工厂》：网络机器人优先，个人在网内无该物品时才接手）。
    if (netCanBuildGhost(g)) continue;
    // 强建虚影（派在树/峭壁/待拆建筑上）：占地内障碍尚未清除时等待，避免材料被白白扣掉。
    if (g.waitClear && ghostFootprintBlocked(g)) continue;
    // 建造范围（距离）判定：虚影无距离限制可任意放置，但施工机器人只在个人机器人港建造范围内自动施工。
    // 超出范围的虚影保留显示（不消失），角色靠近进入范围后机器人自动续建。
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
    // 标记已失效（树木被覆盖/实体被移除）：直接清理，不再派机器人
    if (!deconMarkValid(m)) { m._dead = true; continue; }
    // 峭壁拆除需消耗“峭壁炸药”（对齐《异星工厂》：机器人不能空手拆悬崖）：
    // 背包无炸药则不派机器人，标记保留等待（炸药到位后自动续拆）。
    if (m.cliff && invCount('cliff-explosives') < 1) continue;
    // 物流网络优先级：若机器人港物流网络可（且将）拆除该标记，则让给网络机器人，
    // 个人机器人港不再重复拆除（对齐《异星工厂》：网络机器人优先执行拆除）。
    if (netCanDeconMark(m)) continue;
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

// ===== 物流网络施工机器人（对齐《异星工厂》）=====
// 机器人港（Roboport）内的建设机器人会对“物流网络建造范围”内的建造虚影自动施工：
//   (a) 飞到网络内某物流箱取走该建筑的物品；
//   (b) 飞到虚影所在位置建造落地；
//   (c) 飞回机器人港充电。
// 物流网络优先级高于个人机器人港：当网络机器人可施工该虚影时，个人机器人港不重复施工，
// 仅当网络内没有该物品（或网络未覆盖/无机器人）时，才由个人机器人港接手（见 updateConstruction 的 netCanBuildGhost 判断）。
// 网络施工机器人独立于个人机器人港实体（G.netRobots），其电量模型与建设机器人一致（kJ），充电点为所属机器人港。
const NET_CONSTR_CHARGE_RATE = 800;   // 网络建设机器人回港充电速率（kJ/s，约 2~3 秒充满，呈现“飞回充电”）

class NetConstrRobot {
  constructor(port, job) {
    const [px, py] = portCenter(port);
    this.x = px; this.y = py;
    this.tx = px; this.ty = py;
    this.home = port;                 // 所属/返航充电的机器人港
    this.job = job;                   // { kind:'build'|'decon', ghost?/mark?, item?, chest? }
    this.target = job.chest || null;  // 取货物流箱（建造任务；峭壁拆除任务为取峭壁炸药）
    this.state = (job.kind === 'decon' && !job.item) ? 'toghost' : 'collecting';  // 普通拆除直接飞向标记；建造/峭壁拆除先取货
    this.maxE = ROBOT_MAX_E;
    this.e = ROBOT_MAX_E * CONSTR_MAX_CHARGE;
    this.carry = null;                // 已从箱中取的建筑物品（建造任务）
    this.cargo = null;                // 随身携带的拆除物 [[item,count],...]（拆除任务）
    this._picked = false;             // 是否已取货（低电返充后再据此续飞建造成缔处）
    this._didBuild = false;           // 是否已建成（充电后据此回收）
    this._cancelReturn = false;       // 任务被取消后的返航标志（Shift 框选取消拆除标记等）
    this._dropChest = null;           // 拆除物（含树木木材）交付的物流箱（先飞往箱子交付再返航）
    this._returnPort = null;          // 返航充电的机器人港（就近选择，不一定是原派发港）
    this._dead = false;
  }
}

// 网络内可作为取货源的物流箱（被动/主动供应、仓储、缓冲箱均可）。
// home：可选，机器人港/机器人。传入后仅在其所属物流网络内查找取货箱（同物流网络才运输，
// 与物流机器人 assignTask 同口径）；不传则在全图聚合供应里查找（供优先级探测复用）。
function netSupplyChest(item, home) {
  const nets = (G.logiNet && G.logiNet.nets) || null;
  if (!nets) return null;
  const net = home ? (netOfPort(home instanceof Roboport ? home : home.home) || null) : null;
  const supplies = net ? net.supplies : (G.logiNet && G.logiNet.supplies);
  if (!supplies) return null;
  for (const c of supplies) {
    if (c.item !== item || c.count <= 0) continue;
    if (c.e._dead || typeof c.e.takeItemOf !== 'function') continue;
    return c.e;
  }
  return null;
}

// 某机器人港当前在途的网络建设机器人数量（与该港内建设机器人台数比对，限制并发）
function countNetRobotsOf(port) {
  let n = 0;
  for (const r of G.netRobots) if (!r._dead && r.home === port) n++;
  return n;
}

// 该虚影是否应由物流网络施工（网络优先级判定）。
// 严格对齐需求：只要网络内存在该物品，且虚影落在已通电机器人港的建造范围内，
// 就优先交给网络（即便港内暂无建设机器人，也等待网络后续施工）；仅当网络的物品中
// 没有该物品时，才由个人机器人港接手。里层 dispatch 另按机器人台数并发控制实际派发。
function netCanBuildGhost(g) {
  if (!g || g.consumes !== 'item') return false;
  const powered = (G.logiNet && G.logiNet.poweredPorts) || [];
  if (!powered.length) return false;
  if (!netSupplyChest(g.needId || g.type)) return false;   // 网内物品不含该建筑 → 交由个人机器人
  const gx = g.x + g.w / 2, gy = g.y + g.h / 2;
  for (const p of powered) {
    if (Math.abs(gx - (p.x + p.w / 2)) > ROBOPORT_CONSTR_RANGE) continue;
    if (Math.abs(gy - (p.y + p.h / 2)) > ROBOPORT_CONSTR_RANGE) continue;
    return true;   // 已通电网络建造范围覆盖该虚影 + 网内有该物品 → 网络优先
  }
  return false;
}

// 该拆除标记是否应由物流网络施工（网络优先级判定，对齐《异星工厂》：网络机器人优先执行拆除）。
// 只要拆除标记落在已通电机器人港的建造范围内且港内有建设机器人，就优先交给网络，
// 个人机器人港不再接手。峭壁例外：网内必须备有“峭壁炸药”（机器人需取炸药才能炸毁悬崖），
// 网内无炸药则交给个人机器人（从背包扣炸药）接手，避免拆不掉卡死。
function netCanDeconMark(m) {
  if (!m || m._dead) return false;
  const powered = (G.logiNet && G.logiNet.poweredPorts) || [];
  if (!powered.length) return false;
  const ex = m.x + 0.5, ey = m.y + 0.5;
  for (const p of powered) {
    if (Math.abs(ex - (p.x + p.w / 2)) > ROBOPORT_CONSTR_RANGE) continue;
    if (Math.abs(ey - (p.y + p.h / 2)) > ROBOPORT_CONSTR_RANGE) continue;
    if (p.countOf('construction-robot') <= 0) continue;   // 港内须有建设机器人才能拆除
    if (m.cliff && !netSupplyChest('cliff-explosives', p)) continue;   // 峭壁需网内有炸药
    return true;   // 已通电网络建造范围覆盖该拆除标记 → 网络优先
  }
  return false;
}

// 返回离指定世界坐标最近的已通电机器人港（供网络建设机器人就近返航充电/回收）。
// 优先在已通电港中找最近者；无已通电港时退回任意机器人港。
function nearestRoboport(px, py) {
  const powered = (G.logiNet && G.logiNet.poweredPorts) || [];
  let best = null, bestD = Infinity;
  const scan = powered.length ? powered : (G.ents || []);
  for (const p of scan) {
    if (!p || p._dead || !(p instanceof Roboport)) continue;
    if (powered.length && powerSatOf(p) <= 0) continue;   // 已通电港集合中只认通电港
    const [cx, cy] = portCenter(p);
    const d = (cx - px) * (cx - px) + (cy - py) * (cy - py);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}

// 网络建设机器人飞行移动（沿目标逼近，速度随科技倍率；飞行按格耗电 + 工作基底耗电）
function moveNetToward(r, tx, ty, dt) {
  const dx = tx - r.x, dy = ty - r.y;
  const dist = Math.hypot(dx, dy);
  const spd = Math.min(CONSTR_ROBOT_SPEED * robotSpeedMult() * TILE * dt, 2 * TILE);
  if (dist < 2 || spd >= dist) {
    r.x = tx; r.y = ty;
    r.e = Math.max(0, r.e - ROBOT_MOVE_E - ROBOT_IDLE_E * dt);
    return true;
  }
  const m = spd;
  r.x += dx / dist * m; r.y += dy / dist * m;
  r.e = Math.max(0, r.e - (m / TILE) * ROBOT_MOVE_E - ROBOT_IDLE_E * dt);
  return false;
}

// 单个网络建设机器人状态机更新
function updateNetConstrRobot(r, dt) {
  if (r._dead) return;
  const home = r.home;
  if (!home || home._dead) { r._dead = true; return; }   // 港被拆除 → 回收
  const [hx, hy] = portCenter(home);
  const job = r.job;
  const g = job ? job.ghost : null;
  const m = job ? job.mark : null;
  const isDecon = job && job.kind === 'decon';

  // —— 回港充电 ——
  if (r.state === 'charging') {
    // 充电点：就近返航的机器人港（_returnPort），未选择时用原派发港
    const cp = r._returnPort || home;
    const [cpx, cpy] = portCenter(cp);
    r.x = cpx; r.y = cpy; r.tx = cpx; r.ty = cpy;
    if (powerSatOf(cp) > 0) r.e = Math.min(r.maxE * CONSTR_MAX_CHARGE, r.e + NET_CONSTR_CHARGE_RATE * dt);
    if (r.e >= r.maxE * CONSTR_MAX_CHARGE) {
      // 已建成/已拆除 → 把拆除物放入网络后回收；低电中断的未完成任务 → 充满后继续。
      // 拆除物须放入与港同一物流网络的箱；网络内暂无存放箱时机器人滞留等待（不丢失拆除物）。
      if (r._didBuild) {
        netDropCargo(r);
        if (!r.cargo) r._dead = true;
      }
      else if (constrJobValid(job)) { r._returnPort = null; r.state = r._picked || isDecon ? 'toghost' : 'collecting'; }
      else {
        netDropCargo(r);
        if (!r.cargo) r._dead = true;
      }
    }
    return;
  }

  // —— 任务失效（虚影被清除 / 拆除标记被取消）——
  // 已建成（_didBuild）的机器人不受虚影消失影响，继续返航回港充电；
  // 未建成且任务消失（如 Shift 框选取消拆除标记）：不突然消失，直接返航回所属机器人港充电后回收。
  const taskGone = isDecon ? (!m || m._dead) : (!g || g._dead);
  if (taskGone && !r._didBuild && !r._cancelReturn) {
    r._cancelReturn = true;
    r.job = null;
    r.state = 'returning';
    return;
  }
  const cx = isDecon ? (m ? (m.x + 0.5) * TILE : hx) : (g ? (g.x + g.w / 2) * TILE : hx);
  const cy = isDecon ? (m ? (m.y + 0.5) * TILE : hy) : (g ? (g.y + g.h / 2) * TILE : hy);

  if (r.state === 'collecting') {
    // 目标箱已空/被拆 → 换一个网络供应箱；网内已无该物品则回收
    if (!r.target || r.target._dead || r.target.countOf(job.item) <= 0) {
      const c = netSupplyChest(job.item, r.home);
      if (!c) { r._dead = true; return; }
      r.target = c;
    }
    const t = r.target;
    if (moveNetToward(r, (t.x + t.w / 2) * TILE, (t.y + t.h / 2) * TILE, dt)) {
      if (t.takeItemOf(job.item)) {   // (a) 飞抵物流箱取走物品
        r.carry = { item: job.item, count: 1 };
        r._picked = true;
        r.state = 'toghost';
      } else { r._dead = true; return; }
    }
  } else if (r.state === 'toghost') {
    if (moveNetToward(r, cx, cy, dt)) r.state = 'building';   // (b) 飞抵虚影/拆除标记处
  } else if (r.state === 'building') {
    if (isDecon) {
      completeDecon(m, r);   // 拆除：拆除物（含树木木材）进 r.cargo
      r._didBuild = true;
      // 拆除物优先交付到物流箱：先飞往箱子把木材等放下，再就近返航充电
      if (r.cargo && r.cargo.length) {
        const drop = logiDropTarget(r.cargo[0][0], null, null, r.home);
        if (drop && typeof drop.giveItem === 'function') {
          r._dropChest = drop;
          r.state = 'dropoff';
        } else {
          r.state = 'returning';
        }
      } else {
        r.state = 'returning';
      }
    } else {
      completeBuild(g);   // 落地成真实建筑
      r._didBuild = true;
      r.carry = null;
      r.state = 'returning';
    }
  } else if (r.state === 'dropoff') {
    // 先飞往物流箱交付拆除物（木材等），交付完再就近返航充电
    const chest = r._dropChest;
    if (!chest || chest._dead) { r._dropChest = null; r.state = 'returning'; }
    else if (moveNetToward(r, (chest.x + chest.w / 2) * TILE, (chest.y + chest.h / 2) * TILE, dt)) {
      if (r.cargo) {
        for (let i = r.cargo.length - 1; i >= 0; i--) {
          const [id, n] = r.cargo[i];
          let left = n;
          while (left > 0 && chest.giveItem(id)) {
            left--;
            if (typeof trackProd === 'function') trackProd(id, -1);
          }
          if (left <= 0) r.cargo.splice(i, 1);
          else r.cargo[i] = [id, left];
        }
        if (!r.cargo.length) r.cargo = null;
      }
      r._dropChest = null;
      r.state = 'returning';
    }
  } else if (r.state === 'returning') {
    // 就近返航：飞往离当前位置最近的机器人港充电（任务取消/完成后不一定回原派发港）
    if (!r._returnPort || r._returnPort._dead) r._returnPort = nearestRoboport(r.x, r.y) || home;
    const [rpx, rpy] = portCenter(r._returnPort);
    if (moveNetToward(r, rpx, rpy, dt)) r.state = 'charging';
  }

  // 工作途中低电 → 回港充电（已取货/未取货任务在充满后继续）
  if ((r.state === 'collecting' || r.state === 'toghost') && r.e < CONSTR_MIN_CHARGE * r.maxE) {
    r.state = 'returning';
  }
}

// 网络机器人把随身携带的拆除物放入物流网络中的可存放箱（仅黄箱/绿箱）。
// 与物流机器人 logiDropTarget 同口径：优先级 黄箱已含该物品 > 黄箱未含该物品 > 绿箱。
// 树木拆除的木材与其它拆除物一致：统一放入物流网络箱子（不对玩家做特殊交付）。
function netDropCargo(r) {
  if (!r.cargo || !r.cargo.length) return;
  for (let i = r.cargo.length - 1; i >= 0; i--) {
    const [id, n] = r.cargo[i];
    let left = n;
    while (left > 0) {
      const drop = logiDropTarget(id, null, null, r.home);   // 仅放与机器人港同一物流网络（且网络范围内）的箱
      if (!drop || typeof drop.giveItem !== 'function' || !drop.giveItem(id)) break;
      left--;
      if (typeof trackProd === 'function') trackProd(id, -1);
    }
    if (left <= 0) r.cargo.splice(i, 1);
    else r.cargo[i] = [id, left];
  }
  if (!r.cargo.length) r.cargo = null;
}

// 全局网络施工调度：更新在途机器人 + 扫描网内虚影/拆除标记派发任务
function updateNetConstruction(dt) {
  if (!G.netRobots) G.netRobots = [];
  for (const r of G.netRobots) updateNetConstrRobot(r, dt);
  G.netRobots = compactFilter(G.netRobots, r => !r._dead);
  // 前置条件：物流网络已解锁 + 存在已通电机器人港
  if (!G.techDone || !G.techDone['logistics-network']) return;
  const powered = (G.logiNet && G.logiNet.poweredPorts) || [];
  if (!powered.length) return;
  // 扫描网内虚影，派发网络建设机器人（建造优先于拆除派发）
  for (const g of G.constrGhosts) {
    if (g._dead || g.building) continue;
    if (g.consumes !== 'item') continue;                 // 网络机器人只负责“建筑物品”虚影
    // 强建虚影（派在树/峭壁/待拆建筑上）：占地内障碍未清除时等待，先清障后建造。
    if (g.waitClear && ghostFootprintBlocked(g)) continue;
    const item = g.needId || g.type;
    const gx = g.x + g.w / 2, gy = g.y + g.h / 2;
    for (const p of powered) {
      if (Math.abs(gx - (p.x + p.w / 2)) > ROBOPORT_CONSTR_RANGE) continue;   // 建造覆盖范围
      if (Math.abs(gy - (p.y + p.h / 2)) > ROBOPORT_CONSTR_RANGE) continue;
      if (p.countOf('construction-robot') <= 0) continue;                       // 港内须有建设机器人
      if (countNetRobotsOf(p) >= p.countOf('construction-robot')) continue;     // 港内机器人未全部在途
      const chest = netSupplyChest(item, p);                // 网络内必须有该物品（且与港同物流网络）
      if (!chest) continue;
      g.building = true;
      G.netRobots.push(new NetConstrRobot(p, { kind: 'build', ghost: g, item, chest }));
      if (typeof playSfx === 'function') playSfx('robot');
      return;                                             // 每帧至多派发一个
    }
  }
  // 扫描网内拆除标记，派发网络建设机器人（对齐《异星工厂》：网络机器人优先执行拆除）
  for (const m of G.deconMarks) {
    if (m._dead || m.building) continue;
    // 标记已失效（树木被覆盖/实体被移除）：直接清理，不再派机器人
    if (!deconMarkValid(m)) { m._dead = true; continue; }
    const ex = m.x + 0.5, ey = m.y + 0.5;
    for (const p of powered) {
      if (Math.abs(ex - (p.x + p.w / 2)) > ROBOPORT_CONSTR_RANGE) continue;   // 建造覆盖范围
      if (Math.abs(ey - (p.y + p.h / 2)) > ROBOPORT_CONSTR_RANGE) continue;
      if (p.countOf('construction-robot') <= 0) continue;                       // 港内须有建设机器人
      if (countNetRobotsOf(p) >= p.countOf('construction-robot')) continue;     // 港内机器人未全部在途
      // 峭壁拆除需炸药（对齐《异星工厂》：机器人须从物流网络取峭壁炸药才能炸毁悬崖）：
      // 网内无炸药则不派发（标记等待，交由个人机器人用背包炸药接手）。
      let job;
      if (m.cliff) {
        const chest = netSupplyChest('cliff-explosives', p);
        if (!chest) continue;
        job = { kind: 'decon', mark: m, item: 'cliff-explosives', chest };
      } else {
        job = { kind: 'decon', mark: m };
      }
      m.building = true;
      G.netRobots.push(new NetConstrRobot(p, job));
      if (typeof playSfx === 'function') playSfx('robot');
      return;                                             // 每帧至多派发一个
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
    if (m._dead) continue;
    // 树木/峭壁标记：瓦片中心；实体标记：实体中心
    let px, py;
    if (m.tree || m.cliff) {
      if (m.tree ? getTerrain(m.x, m.y) !== T_TREE : getTerrain(m.x, m.y) !== T_CLIFF) continue;
      px = (m.x + 0.5) * TILE; py = (m.y + 0.5) * TILE;
    } else {
      if (!m.ent) continue;
      px = (m.x + (m.ent.w || 1) / 2) * TILE, py = (m.y + (m.ent.h || 1) / 2) * TILE;
    }
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
  // 个人机器人港的施工机器人 / 物流网络的建设机器人统一绘制
  for (const r of G.constrRobots) drawOneConstrRobot(ctx, r);
  for (const r of G.netRobots) drawOneConstrRobot(ctx, r);
}

// 绘制单个施工（/建设）机器人造型：朝向、拖尾、电量条与携物图标
function drawOneConstrRobot(ctx, r) {
  if (!r || r._dead || r.state === 'idle') return;
  if (typeof onScreen === 'function' && !onScreen({ x: r.x / TILE, y: r.y / TILE, w: 1, h: 1 })) return;
  // 朝向目标的角度：个人机器人港 → 任务中心；物流网络机器人取货 → 目标箱、建造 → 虚影
  let targetX = r.tx || r.x, targetY = r.ty || r.y;
  if (r.job && r.state !== 'returning') {
    if (r.job.kind === 'build' && r.state === 'collecting' && r.target && !r.target._dead) {
      targetX = (r.target.x + r.target.w / 2) * TILE;
      targetY = (r.target.y + r.target.h / 2) * TILE;
    } else {
      const [cjx, cjy] = constrJobCenter(r);
      if (cjx !== G.player.x || cjy !== G.player.y) { targetX = cjx; targetY = cjy; }
    }
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
  const frac = Math.max(0, Math.min(1, (r.e || 0) / (r.maxE || 1)));
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fillRect(bx - 1, by - 1, Ew + 2, Eh + 2);
  ctx.fillStyle = (r.state === 'charging')
    ? ((Math.floor(performance.now() / 120) % 2 === 0) ? '#5ad06a' : '#7de58a')
    : (frac > 0.5 ? '#d8b84a' : (frac > 0.25 ? '#e08a3a' : '#d04a3a'));
  ctx.fillRect(bx, by, Ew * frac, Eh);
  ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1; ctx.strokeRect(bx, by, Ew, Eh);
  // 头顶携带图标：去建造 → 显示所送建筑；拆除返回 → 显示随身携带的拆除物（对齐《异星工厂》机器人携物飞行）
  const carry = constrRobotCarryIcon(r);
  if (carry) {
    drawItemDot(ctx, r.x, r.y - 26, carry.id, 8);
    if (carry.n > 1 && typeof carry.id === 'string') {
      ctx.font = 'bold 9px system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const cn = String(carry.n);
      ctx.fillStyle = 'rgba(0,0,0,.6)';
      rr(ctx, r.x + 8, r.y - 30, 12 + cn.length * 5, 10, 3); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.fillText(cn, r.x + 14 + cn.length * 2.5, r.y - 25);
    }
  }
}

// 计算机器人头顶应显示的携带物品图标与数量：拆除归途取 cargo 首项；
// 去建造（toghost 且任务为 build）显示所送建筑类型。无携带返回 null。
function constrRobotCarryIcon(r) {
  // 网络建设机器人（机器人港派发）：仅在「拿到物品去建造」阶段（toghost）显示携物图标，
  // 取物阶段（collecting，去箱途中）显示；拆除完携带拆除物返航（returning）时显示随身拆除物。
  if (r.home) {
    if (r.cargo && r.cargo.length) return { id: r.cargo[0][0], n: r.cargo[0][1] };  // 拆除物
    return (r.state === 'toghost' && r._picked && r.carry) ? { id: r.carry.item, n: r.carry.count } : null;
  }
  if (r.cargo && r.cargo.length) return { id: r.cargo[0][0], n: r.cargo[0][1] };
  if (r.job && r.job.kind === 'build' && r.job.ghost) return { id: r.job.ghost.type, n: 1 };
  return null;
}

// 序列化个人机器人港状态（随存档保存，含启用状态与所有“建造虚影”）
function constrSerialize() {
  const ghosts = (G.constrGhosts && G.constrGhosts.length)
    ? G.constrGhosts.filter(g => !g._dead).map(g => ({
        type: g.type, x: g.x, y: g.y, dir: g.dir | 0, mirror: g.mirror | 0,
        w: g.w, h: g.h, quality: g.quality, needId: g.needId, recipe: g.recipe, consumes: g.consumes,
        waitClear: g.waitClear ? true : undefined   // 强建虚影：等占地障碍清除后再施工（随存档持久化）
      }))
    : [];
  // 拆除标记随存档持久化：记录其指向实体的左上角瓦片坐标（x/y）或树木/峭壁瓦片坐标，
  // 读档时（实体已恢复）按坐标重新关联回对应实体；树木/峭壁标记按瓦片判定地形；均不存在则跳过。
  const deconMarks = (G.deconMarks && G.deconMarks.length)
    ? G.deconMarks.filter(m => !m._dead && deconMarkValid(m)).map(m =>
        m.tree ? { x: m.x, y: m.y, tree: true }
               : m.cliff ? { x: m.x, y: m.y, cliff: true }
                         : { x: m.x, y: m.y })
    : [];
  return {
    personalRoboport: G.personalRoboport === 'mk2' ? 'mk2' : !!G.personalRoboport,
    roboportActive: G.roboportActive === false ? false : true,
    ghosts,
    deconMarks
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
      if (gd.waitClear) g.waitClear = true;
      G.constrGhosts.push(g);
    } catch (e) { /* 忽略无法重建的虚影条目 */ }
  }
  // 恢复存档中的“拆除标记”（红图框选/强建生成，由施工机器人拆除），按左上角瓦片坐标重新关联到已恢复的实体。
  // 读档时实体已先于此处恢复（applySave 先重建 d.ents），故可经 entAt 直接定位；
  // 实体已不存在（保存后/读档前被拆除）则跳过该标记。树木/峭壁标记按瓦片判定地形。
  const mdefs = (s && Array.isArray(s.deconMarks)) ? s.deconMarks : [];
  for (const md of mdefs) {
    if (!md || typeof md.x !== 'number' || typeof md.y !== 'number') continue;
    try {
      if (md.tree) {
        if (getTerrain(md.x | 0, md.y | 0) !== T_TREE) continue;
        G.deconMarks.push(treeDeconMark(md.x | 0, md.y | 0));
        continue;
      }
      if (md.cliff) {
        if (getTerrain(md.x | 0, md.y | 0) !== T_CLIFF) continue;
        G.deconMarks.push(cliffDeconMark(md.x | 0, md.y | 0));
        continue;
      }
      const e = entAt(md.x | 0, md.y | 0);
      if (!e || e._dead) continue;
      G.deconMarks.push(new DeconMark(e));
    } catch (err) { /* 忽略无法重建的拆除标记条目 */ }
  }
}
