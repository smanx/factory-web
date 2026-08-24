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
const CONSTR_ROBOT_SPEED = 5.2;      // 施工机器人飞行速度（格/秒）
const CONSTR_BUILD_TIME = 1.0;       // 单格建造耗时（秒）
const CONSTR_RANGE = 12;             // 个人机器人港工作范围（格，含玩家所在格）
const CONSTR_MAX_ACTIVE = 4;         // 同时最多在场施工的机器人数量

// ===== 个人机器人港装备 =====
function ensureConstr() {
  if (G.personalRoboport === undefined) G.personalRoboport = false;
  if (!G.constrGhosts) G.constrGhosts = [];
  if (!G.deconMarks) G.deconMarks = [];
  if (!G.constrRobots) G.constrRobots = [];
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
// 装备/卸下个人机器人港（背包“使用”触发，或面板按钮）
function togglePersonalRoboport() {
  if (hasPersonalRoboport()) {
    invAdd('personal-roboport', 1);
    G.personalRoboport = false;
    if (typeof toast === 'function') toast('已卸下个人机器人港');
  } else {
    if (invCount('personal-roboport') < 1) { if (typeof toast === 'function') toast('背包里没有个人机器人港'); return; }
    invTake('personal-roboport', 1);
    G.personalRoboport = true;
    if (typeof toast === 'function') toast('已装备个人机器人港：蓝图由施工机器人自动建造');
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
    // 已占用则跳过（原地已有真实实体或已有同格幽灵）
    if (entAt(nx, ny)) continue;
    if (ghostAt(nx, ny, BUILD_DEFS[s.type].w, BUILD_DEFS[s.type].h)) continue;
    // 校验放置合法性（水面/可放置规则），不合法跳过
    if (!canPlaceAt(s.type, nx, ny, ndir).ok) continue;
    const g = new ConstrGhost(s.type, nx, ny, ndir);
    if (s.recipe) g.recipe = s.recipe;
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

// ===== 给指定幽灵施工：飞行/建造/落地 =====
function updateConstrRobot(r, dt) {
  const px = G.player.x, py = G.player.y;
  if (r.state === 'idle') return;

  if (r.state === 'toghost' || r.state === 'returning') {
    const targetX = (r.state === 'toghost' ? (r.job.ghost ? r.job.ghost.x * TILE + TILE / 2 : r.job.mark.x * TILE + TILE / 2) : px);
    const targetY = (r.state === 'toghost' ? (r.job.ghost ? r.job.ghost.y * TILE + TILE / 2 : r.job.mark.y * TILE + TILE / 2) : py);
    const dx = targetX - r.x, dy = targetY - r.y;
    const dist = Math.hypot(dx, dy);
    const step = CONSTR_ROBOT_SPEED * robotSpeedMult() * TILE * dt;
    if (dist < 2) {
      r.x = targetX; r.y = targetY;
      if (r.state === 'toghost') r.state = 'building';
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
  }
}

// 完成一个建造幽灵：落地真实实体
function completeBuild(g) {
  const cls = ENT_CLASSES[g.type];
  if (!cls) { g._dead = true; return; }
  // 格仍被占用则放弃
  if (entAt(g.x, g.y)) { g._dead = true; return; }
  const e = cls.restore({ type: g.type, x: g.x, y: g.y, dir: g.dir });
  e.dir = g.dir | 0; e.applyDir();
  if (g.recipe && typeof e.setRecipe === 'function') e.setRecipe(g.recipe);
  addEnt(e);
  g._dead = true;
}

// 完成一个拆除标记：返还物资并移除实体
function completeDecon(m) {
  const e = m.ent;
  if (!e || e._dead) { m._dead = true; return; }
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
    G.constrGhosts = G.constrGhosts.filter(g => !g._dead);
    G.deconMarks = G.deconMarks.filter(m => !m._dead);
    if (G.constrRobots.some(r => !r._dead)) G.constrRobots = G.constrRobots.filter(r => r._dead);
    return;
  }
  // 清理墓碑
  if (G.constrGhosts.some(g => g._dead)) G.constrGhosts = G.constrGhosts.filter(g => !g._dead);
  if (G.deconMarks.some(m => m._dead)) G.deconMarks = G.deconMarks.filter(m => !m._dead);
  if (G.constrRobots.some(r => r._dead)) G.constrRobots = G.constrRobots.filter(r => !r._dead);

  // 更新现有机器人
  for (const r of G.constrRobots) updateConstrRobot(r, dt);

  // 统计当前在施工的机器人数量
  const activeCount = G.constrRobots.filter(r => !r._dead && r.state !== 'idle').length;
  if (activeCount >= CONSTR_MAX_ACTIVE) return;

  // 找待施工幽灵（优先未在施工的）
  let targetGhost = null;
  for (const g of G.constrGhosts) {
    if (g._dead || g.building) continue;
    // 范围内判断
    if (Math.abs((g.x + g.w / 2) - G.player.x / TILE) > CONSTR_RANGE) continue;
    if (Math.abs((g.y + g.h / 2) - G.player.y / TILE) > CONSTR_RANGE) continue;
    // 需要材料且背包有材料才施工
    const rec = RECIPES[g.type] || null;
    if (rec) {
      const needItem = Object.keys(rec.inp)[0];
      if (invCount(needItem) < rec.inp[needItem]) continue;   // 材料不足跳过
    }
    targetGhost = g;
    break;
  }
  if (targetGhost) {
    // 从背包扣除建造所需材料（先校验全部材料充足再一次性扣足，避免部分扣取后放弃）
    const rec = RECIPES[targetGhost.type];
    if (rec) {
      let ok = true;
      for (const k in rec.inp) if (invCount(k) < rec.inp[k]) { ok = false; break; }
      if (!ok) { targetGhost._dead = true; }   // 材料不足则放弃该幽灵
      else {
        for (const k in rec.inp) {
          for (let i = 0; i < rec.inp[k]; i++) invTake(k, 1);
          if (typeof trackProd === 'function') trackProd(k, -rec.inp[k]);
        }
      }
    }
    if (targetGhost._dead) return;
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
    if (Math.abs(m.x - G.player.x / TILE) > CONSTR_RANGE) continue;
    if (Math.abs(m.y - G.player.y / TILE) > CONSTR_RANGE) continue;
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
    if (r.job && r.job.ghost) { targetX = (r.job.ghost.x + r.job.ghost.w / 2) * TILE; targetY = (r.job.ghost.y + r.job.ghost.h / 2) * TILE; }
    else if (r.job && r.job.mark) { targetX = r.job.mark.x * TILE + TILE / 2; targetY = r.job.mark.y * TILE + TILE / 2; }
    const robAng = Math.atan2(targetY - r.y, targetX - r.x);
    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath();
    ctx.ellipse(r.x, r.y + 9, 6, 2.5, 0, 0, 7);
    ctx.fill();
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(robAng);
    ctx.fillStyle = '#d0a04a';
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
    ctx.fillText('🔧', r.x + 6, r.y - 6);
  }
}

// 序列化个人机器人港状态（随存档保存）
function constrSerialize() {
  return { personalRoboport: !!G.personalRoboport };
}
function constrRestore(s) {
  G.personalRoboport = !!(s && s.personalRoboport);
  G.constrGhosts = [];
  G.deconMarks = [];
  G.constrRobots = [];
}
