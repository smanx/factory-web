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
const CONSTR_RANGE = 12;             // 个人机器人港 Mk1 工作范围（格，含玩家所在格）
const CONSTR_MAX_ACTIVE = 4;         // 个人机器人港 Mk1 同时最多在场施工的机器人数量
const CONSTR_RANGE_MK2 = 20;         // 个人机器人港 II 工作范围（格）
const CONSTR_MAX_ACTIVE_MK2 = 8;     // 个人机器人港 II 同时最多在场施工的机器人数量
// 施工机器人修复受损建筑（对齐《异星工厂》：施工机器人自动修复基地建筑）
const CONSTR_REPAIR_INTERVAL = 0.6;  // 每次修复动作的间隔（秒）
const CONSTR_REPAIR_AMOUNT = 60;     // 每次修复动作恢复的 HP
const CONSTR_REPAIR_USES = 5;        // 每个修理包可修复次数（与手动修理包一致）
const CONSTR_REPAIR_SCAN_T = 0.5;    // 受损建筑扫描间隔（秒）

// 根据已装备的个人机器人港版本返回 { range, maxActive }（对齐《异星工厂》Personal roboport Mk2：更大范围、更多机器人）
function constrRoboportInfo() {
  if (G.personalRoboport === 'mk2') return { range: CONSTR_RANGE_MK2, maxActive: CONSTR_MAX_ACTIVE_MK2 };
  return { range: CONSTR_RANGE, maxActive: CONSTR_MAX_ACTIVE };
}

// ===== 个人机器人港装备 =====
function ensureConstr() {
  if (G.personalRoboport === undefined) G.personalRoboport = false;
  if (!G.constrGhosts) G.constrGhosts = [];
  if (!G.deconMarks) G.deconMarks = [];
  if (!G.constrRobots) G.constrRobots = [];
  if (G._constrRepairScanT === undefined) G._constrRepairScanT = 0;
}
// 是否拥有个人机器人港（装备中）
function hasPersonalRoboport() { return !!G.personalRoboport; }
// 背包中可用施工机器人数量
function constrRobotCount() {
  return invCount('construction-robot');
}
// 是否具备施工能力：装备个人机器人港且背包有施工机器人
function canUseConstruction() {
  return hasPersonalRoboport() && constrRobotCount() > 0;
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
    this.state = 'idle';           // idle | toghost | building | returning
    this.job = null;               // { kind:'build'|'decon', ghost?/mark?, item?, need }
    this.buildT = 0;
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

// 给指定幽灵施工 / 拆除 / 修复：飞行 → 执行 → 返航
function updateConstrRobot(r, dt) {
  const px = G.player.x, py = G.player.y;
  if (r.state === 'idle') return;

  if (r.state === 'toghost' || r.state === 'returning') {
    const [tx, ty] = (r.state === 'toghost') ? constrJobCenter(r) : [px, py];
    const dx = tx - r.x, dy = ty - r.y;
    const dist = Math.hypot(dx, dy);
    const step = CONSTR_ROBOT_SPEED * robotSpeedMult() * TILE * dt;
    if (dist < 2) {
      r.x = tx; r.y = ty;
      if (r.state === 'toghost') r.state = (r.job.kind === 'repair') ? 'repairing' : 'building';
      else { r._dead = true; return; }
    } else {
      const m = Math.min(step, dist);
      r.x += dx / dist * m; r.y += dy / dist * m;
    }
    return;
  }

  // 施工中：逐步完成，到达后消耗背包材料并落地
  if (r.state === 'building') {
    const job = r.job;
    // 任务可能已被取消（幽灵被手动清除/实体已被移除）
    if (job.kind === 'build' && (!job.ghost || job.ghost._dead)) { r._dead = true; return; }
    if (job.kind === 'decon' && (!job.mark || job.mark._dead)) { r._dead = true; return; }
    r.buildT += dt;
    if (r.buildT >= CONSTR_BUILD_TIME) {
      if (job.kind === 'build') {
        completeBuild(job.ghost);
      } else {
        completeDecon(job.mark);
      }
      r.state = 'returning';
      r.job = null;
      r.buildT = 0;
    }
    return;
  }

  // 修复中：逐步恢复受损建筑 HP，消耗背包中的修理包
  if (r.state === 'repairing') {
    const t = r.job && r.job.target;
    // 目标消失或已满血：返航
    if (!t || t._dead || !isDamaged(t)) { r._dead = true; return; }
    // 背包无修理包：返航等待（下次有包再派新机器人）
    if (invCount('repair-pack') <= 0 && (G.repairPackUses || 0) <= 0) { r._dead = true; return; }
    r.buildT += dt;
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
  // 没有个人机器人港则静默清理（保留幽灵等待下次装备？为符合直觉，直接清空幽灵与机器人）
  if (!hasPersonalRoboport()) {
    // 单遍 compactFilter 原地清理（替代 .filter 每帧分配新数组），并修复原有误：原实现
    // G.constrRobots.filter(r => r._dead) 误保留死亡机器人、丢弃存活机器人，此处改为保留存活。
    G.constrGhosts = compactFilter(G.constrGhosts, g => !g._dead);
    G.deconMarks = compactFilter(G.deconMarks, m => !m._dead);
    G.constrRobots = compactFilter(G.constrRobots, r => !r._dead);
    return;
  }
  // 清理墓碑：单遍 compactFilter（替代原 .some()+filter 双遍扫描，减少每帧遍历与分配）
  G.constrGhosts = compactFilter(G.constrGhosts, g => !g._dead);
  G.deconMarks = compactFilter(G.deconMarks, m => !m._dead);
  G.constrRobots = compactFilter(G.constrRobots, r => !r._dead);

  // 更新现有机器人
  for (const r of G.constrRobots) updateConstrRobot(r, dt);

  // 统计当前在施工的机器人数量（计数循环替代 filter().length，避免每帧分配新数组）
  const rInfo = constrRoboportInfo();
  let activeCount = 0;
  for (const r of G.constrRobots) if (!r._dead && r.state !== 'idle') activeCount++;
  if (activeCount >= rInfo.maxActive) return;

  // 找待施工幽灵（优先未在施工的）
  let targetGhost = null;
  for (const g of G.constrGhosts) {
    if (g._dead || g.building) continue;
    // 范围内判断
    if (Math.abs((g.x + g.w / 2) - G.player.x / TILE) > rInfo.range) continue;
    if (Math.abs((g.y + g.h / 2) - G.player.y / TILE) > rInfo.range) continue;
    // 需要材料：只有全部材料齐备时才施工（材料不足的幽灵原地等待，下次材料备齐自动续建，不会丢失）
    const rec = RECIPES[g.type] || null;
    if (rec) {
      let enough = true;
      for (const k in rec.inp) if (invCount(k) < rec.inp[k]) { enough = false; break; }
      if (!enough) continue;   // 材料不足跳过，等下次再试
    }
    targetGhost = g;
    break;
  }
  if (targetGhost) {
    // 从背包扣除建造所需材料（此时已确认全部材料充足，一次性扣足）
    const rec = RECIPES[targetGhost.type];
    if (rec) {
      for (const k in rec.inp) {
        for (let i = 0; i < rec.inp[k]; i++) invTake(k, 1);
        if (typeof trackProd === 'function') trackProd(k, -rec.inp[k]);
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
function drawConstruction(ctx) {
  ensureConstr();
  // 建造幽灵：半透明目标建筑轮廓 + 绿色边框
  for (const g of G.constrGhosts) {
    if (g._dead) continue;
    if (typeof onScreen === 'function' && !onScreen({ x: g.x, y: g.y, w: g.w, h: g.h })) continue;
    const px = g.x * TILE, py = g.y * TILE;
    // 半透明目标建筑示意（用物品色填充的虚影框）
    const col = ITEMS[g.type] ? ITEMS[g.type].color : '#7a7a8a';
    ctx.save();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = col;
    ctx.fillRect(px + 2, py + 2, TILE * g.w - 4, TILE * g.h - 4);
    ctx.restore();
    // 绿色幽灵边框
    ctx.strokeStyle = '#6fe06f';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 3]);
    ctx.strokeRect(px + 1.5, py + 1.5, TILE * g.w - 3, TILE * g.h - 3);
    ctx.setLineDash([]);
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
    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath();
    ctx.ellipse(r.x, r.y + 9, 6, 2.5, 0, 0, 7);
    ctx.fill();
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(robAng);
    ctx.fillStyle = (r.state === 'repairing') ? '#8ac0e0' : '#d0a04a';
    ctx.beginPath();
    ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-3, 0); ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
    // 施工工具小图标
    ctx.fillStyle = '#e0e0a0';
    ctx.font = 'bold 9px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((r.state === 'repairing') ? '🛠' : '🔧', r.x + 6, r.y - 6);
  }
}

// 序列化个人机器人港状态（随存档保存）
function constrSerialize() {
  return { personalRoboport: G.personalRoboport === 'mk2' ? 'mk2' : !!G.personalRoboport };
}
function constrRestore(s) {
  const v = s && s.personalRoboport;
  G.personalRoboport = (v === 'mk2' || v === true) ? (v === 'mk2' ? 'mk2' : true) : false;
  G.constrGhosts = [];
  G.deconMarks = [];
  G.constrRobots = [];
}
