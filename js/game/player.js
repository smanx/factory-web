'use strict';

let mineToastAcc = 0;   // 手动挖矿提示去抖计数

// ===== 主角自动回血（对齐《异星工厂》：受伤后延迟几秒，之后每秒回复 6 点生命）=====
const PLAYER_REGEN_DELAY = 3;   // 受伤后延迟秒数，之后才开始自动回血
const PLAYER_REGEN_RATE = 6;    // 每秒回复生命值
const PLAYER_BASE_MAX_HP = 250; // 主角基础最大生命值

function playerSpeed() { return 140 * ((G.dbg && G.dbg.moveSpeed) || 1) * (typeof equipmentSpeedMult === 'function' ? equipmentSpeedMult() : 1); }

function makePlayer(tx, ty) {
  return {
    x: tx * TILE + TILE / 2,
    y: ty * TILE + TILE / 2,
    dir: 2,
    mining: null,
    mineProg: 0,
    walkT: 0,
    inVehicle: false,   // 是否在载具驾驶中
    counterT: 0,        // 自动刀具反击动画计时（>0 时渲染挥刀动作帧）
    counterDir: 0,      // 反击时面向的攻击方向（角度，弧度）
    lastHurtT: (typeof G !== 'undefined' && G.time) || 0  // 最近一次受伤的时间（用于自动回血延迟判断）
  };
}

// 仅地形碰撞（水/峭壁/树木），不含建筑——供蜘蛛机器人等可跨越建筑/石墙的单位使用
function terrainSolidAtPx(px, py) {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  return isWater(tx, ty) || isCliff(tx, ty) || isTree(tx, ty);
}

function solidAtPx(px, py) {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  // 玩家/载具碰撞：水、峭壁与树木均不可通行（对齐《异星工厂》：树与 Cliff 均阻隔移动，需砍伐/清除才能通过）
  if (terrainSolidAtPx(px, py)) return true;
  // 建筑碰撞：可建造的实心建筑阻挡移动（传送带/机械臂/箱子除外，对齐《异星工厂》：玩家可站上传送带被推动，
  // 机械臂不占行走格；箱子也不与主角碰撞，可自由穿行，方便在密集仓库间移动）
  const e = entAt(tx, ty);
  if (e && e.solid && !(e instanceof Belt) && !(e instanceof Inserter) &&
      !(typeof e.type === 'string' && e.type.endsWith('-chest'))) return true;
  return false;
}

// 仅地形碰撞的 boxBlocked（供蜘蛛机器人等保留跨水/墙能力，不受建筑碰撞影响）
function terrainBoxBlocked(cx, cy, r) {
  if (G.dbg && G.dbg.noclip) return false;
  return terrainSolidAtPx(cx - r, cy - r) || terrainSolidAtPx(cx + r, cy - r) ||
         terrainSolidAtPx(cx - r, cy + r) || terrainSolidAtPx(cx + r, cy + r);
}

function boxBlocked(cx, cy, r) {
  // 开发者调试：主角无视碰撞（穿越水/峭壁/树木/建筑等障碍）
  if (G.dbg && G.dbg.noclip) return false;
  return solidAtPx(cx - r, cy - r) || solidAtPx(cx + r, cy - r) ||
         solidAtPx(cx - r, cy + r) || solidAtPx(cx + r, cy + r);
}

// 建造校验用：type 对应的建筑是否与主角存在碰撞体积（对齐移动碰撞 solidAtPx）。
// 仅当建筑会与主角碰撞时，主角站在其占地内才禁止建造；
// 无碰撞体积的建筑（传送带/机械臂/箱子等，主角可穿行）即便主角站在原地也能正常建造。
function buildCollidesPlayer(type) {
  const def = BUILD_DEFS[type];
  if (!def || !def.solid) return false;          // 非实心建筑（传送带/地下带/分流器/铁路等）无碰撞体积
  if (type.indexOf('belt') >= 0 || type.indexOf('splitter') >= 0) return false;  // 传送带系：可站上去被推动
  if (type.indexOf('inserter') >= 0) return false;        // 机械臂不占行走格
  if (type.endsWith('-chest')) return false;              // 箱子不与主角碰撞，可穿行
  return true;
}

function updatePlayer(dt) {
  const p = G.player;
  // 自动回血（对齐《异星工厂》）：受伤后延迟几秒，之后每秒回复 6 点生命值，直到回满
  if (G.playerHP < G.playerHPmax && G.time - (p.lastHurtT || 0) > PLAYER_REGEN_DELAY) {
    G.playerHP = Math.min(G.playerHPmax, G.playerHP + PLAYER_REGEN_RATE * dt);
    uiDirty = true;
  }
  // 自动刀具反击动画计时递减（>0 时渲染挥刀动作帧）
  if (p.counterT > 0) p.counterT -= dt;
  // 玩家移动会点亮脚下区块（用于小地图）；限频避免每帧重算
  if (typeof markExplored === 'function') {
    if (!G._exploreT || G.time - G._exploreT > 0.5) {
      G._exploreT = G.time;
      markExplored(Math.floor(p.x / TILE), Math.floor(p.y / TILE), 2);
    }
  }
  // 载具驾驶模式：由 updateDriving 驱动载具，玩家自身不移动
  if (G.driving && G.driving.ent && !G.driving.ent._dead) {
    if (typeof updateDriving === 'function') updateDriving(dt);
    return;
  }
  let mx = 0, my = 0;
  if (G.keys['w'] || G.keys['arrowup']) my -= 1;
  if (G.keys['s'] || G.keys['arrowdown']) my += 1;
  if (G.keys['a'] || G.keys['arrowleft']) mx -= 1;
  if (G.keys['d'] || G.keys['arrowright']) mx += 1;
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len; my /= len;
    p.walkT += dt * 10;
    // 角色移动音效已去除（用户要求）：不再播放脚步音
    if (Math.abs(mx) > Math.abs(my)) p.dir = mx > 0 ? 0 : 2;
    else p.dir = my > 0 ? 1 : 3;
    const r = 9;
    // 硬化地面（混凝土/石砖路）上玩家行走提速 40%；精炼混凝土提速更高（50%，对齐《异星工厂》Refined concrete 更快）
    let sp = playerSpeed();
    const ptile = getTerrain(Math.floor(p.x / TILE), Math.floor(p.y / TILE));
    if (isPaved(ptile)) sp *= (ptile === T_REF_CONCRETE) ? 1.5 : 1.4;
    // 减速力场（减速胶囊）内玩家减速
    if (typeof aoeSlowFactor === 'function') sp *= aoeSlowFactor(p.x, p.y);
    const nx = p.x + mx * sp * dt;
    if (!boxBlocked(nx, p.y, r)) p.x = nx;
    const ny = p.y + my * sp * dt;
    if (!boxBlocked(p.x, ny, r)) p.y = ny;
  }
  // 传送带推动玩家（对齐《异星工厂》）：站上运转的传送带会被带动位移，除非穿戴传送带免疫装备
  updateBeltPush(dt);
  // 玩家与敌人/虫巢相互碰撞（需求：主角、敌人和虫巢之间相互都要有碰撞效果）
  playerEnemyCollision();
}

// 玩家与敌人/虫巢的实体碰撞分离（需求：主角、敌人和虫巢之间相互都要有碰撞效果）。
// 玩家不能穿过敌人与虫巢；重叠时按双方碰撞半径互相推开。虫巢为静态占地（kind==='spawner'），
// 只推玩家、自身不动；普通敌人会被推开，实现“相互碰撞”。
function playerEnemyCollision() {
  if (!G.settings || !G.settings.combat) return;
  const p = G.player;
  const src = G.enemies || EMPTY_ARR;
  const pr = 9;   // 玩家碰撞半径（像素，与移动 boxBlocked 的 r 一致）
  const r = 9;
  for (let i = 0; i < src.length; i++) {
    const e = src[i];
    if (e.dead) continue;
    const dx = p.x - e.x, dy = p.y - e.y;
    const d = Math.hypot(dx, dy);
    const er = (e.kind === 'spawner' ? e.foot * TILE * 0.5 : e.size);
    const minD = pr + er;
    if (d > 0 && d < minD) {
      const push = (minD - d) * 0.5;
      const ux = dx / d, uy = dy / d;
      // 推动玩家（避开地形以免被挤入水/峭壁）
      const px2 = p.x + ux * push;
      if (!boxBlocked(px2, p.y, r)) p.x = px2;
      const py2 = p.y + uy * push;
      if (!boxBlocked(p.x, py2, r)) p.y = py2;
      // 虫巢静态不动；普通敌人被推开，实现“相互碰撞”
      if (e.kind !== 'spawner') { e.x -= ux * push; e.y -= uy * push; }
    }
  }
}

// ===== 传送带推动玩家（对齐《异星工厂》物理机制） =====
// 玩家脚下所在格的传送带若在运转，会沿带向带动玩家移动。
// 穿戴「传送带免疫」装备后不再被推动。推动速度约为带速的 0.9 倍（略低于物品随带速度）。
function updateBeltPush(dt) {
  if (typeof hasBeltImmunity === 'function' && hasBeltImmunity()) return;
  const p = G.player;
  if (G.driving && G.driving.ent && !G.driving.ent._dead) return;  // 驾驶载具时不推动
  const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
  const e = entAt(tx, ty);
  if (!e || typeof e.update !== 'function' || !(e instanceof Belt)) return;
  // 传送带电路停转时不推动
  if (typeof e.circuitEnabled === 'function' && !e.circuitEnabled()) return;
  // 空带仍在运转（有速度）同样推动玩家
  const spd = beltSpeed() * e.speedMult() * 0.9;
  if (spd <= 0) return;
  // 沿带方向推动
  const r = 9;
  const nx = p.x + DX[e.dir] * spd * dt;
  if (!boxBlocked(nx, p.y, r)) p.x = nx;
  const ny = p.y + DY[e.dir] * spd * dt;
  if (!boxBlocked(p.x, ny, r)) p.y = ny;
}

function withinReach(tx, ty) {
  // 调试开关“无限交互距离”开启时，可对任意远的格子交互/建造
  if (G.dbg && G.dbg.farReach) return true;
  const p = G.player;
  return Math.hypot(tx * TILE + TILE / 2 - p.x, ty * TILE + TILE / 2 - p.y) <= REACH_PX;
}

function invAdd(id, n = 1) {
  // 物品堆叠上限（对齐《异星工厂》）：背包中每种物品不超过其最大堆叠数
  const cap = (typeof stackSize === 'function') ? stackSize(id) : 100;
  const cur = G.inv.get(id) || 0;
  const addable = Math.max(0, Math.min(n, cap - cur));
  if (addable <= 0) return 0;
  G.inv.set(id, cur + addable);
  if (typeof trackProd === 'function') trackProd(id, addable);
  uiDirty = true;
  return addable;
}

function invCount(id) { return G.inv.get(id) || 0; }

function selItem() { return G.sel >= 0 ? (HOTBAR[G.sel] || null) : (G.quickSel || null); }
function buildActive() { return G.sel >= 0 || !!G.quickSel; }

// 是否为手持工具（非建筑、选中时不应阻断采矿/使用）
function isToolItem(id) {
  return id === 'deconstruction-planner' || id === 'upgrade-planner' ||
         id === 'repair-pack' || id === 'cliff-explosives' || id === 'spidertron-remote' ||
         id === 'artillery-targeting-remote' || id === 'discharge-defense-remote';
}

function invTake(id, n = 1) {
  const c = invCount(id);
  if (c < n) return false;
  if (c - n <= 0) G.inv.delete(id); else G.inv.set(id, c - n);
  if (typeof trackProd === 'function') trackProd(id, -n);
  uiDirty = true;
  return true;
}

function canCraft(rid) {
  const rec = RECIPES[rid];
  for (const k in rec.inp) if (invCount(k) < rec.inp[k]) return false;
  return true;
}

// 是否有足够的背包空位容纳一次配方的全部产出（受物品堆叠上限约束）
function hasCraftRoom(rid) {
  const rec = RECIPES[rid];
  for (const k in rec.out) {
    if (FLUIDS.indexOf(k) >= 0) continue;          // 流体不入背包
    if (invCount(k) + (rec.out[k] || 1) > stackSize(k)) return false;
  }
  return true;
}

// 是否允许玩家手搓该配方（组装机/化工厂/炼油厂/离心机专属配方与含流体原料/产物的配方除外）
function isHandCraftable(rid) {
  if (isChemRecipe(rid) || isCentrifugeRecipe(rid) || isRefineryRecipe(rid)) return false;
  const _rec = RECIPES[rid];
  if (_rec) {
    if (Object.keys(_rec.inp).some(k => FLUIDS.indexOf(k) >= 0)) return false;
    // 产出流体（如倒空桶）的配方也不可手搓——流体只能进管道，不能直接入背包
    if (Object.keys(_rec.out).some(k => FLUIDS.indexOf(k) >= 0)) return false;
  }
  return true;
}

// ===== 手搓合成队列（对齐《异星工厂》Hand-crafting） =====
// 玩家点“合成”不再瞬时完成，而是进入制作队列，按配方耗时逐件生产（可后台排队、显示进度）。
// G.craftQueue: [{ rid, time, total, done, made }]  —— 队首为当前正在制作的一项。
// 点击时一次性把本批次的材料扣除并入队，制作过程中无需再检查材料。
function queueCraft(rid, times = 1) {
  if (!isHandCraftable(rid)) return 0;
  // 科技门控：未解锁的配方不能手搓（对齐《异星工厂》科技解锁配方）
  if (!recipeUnlocked(rid)) return 0;
  const rec = RECIPES[rid];
  const outId = Object.keys(rec.out)[0];
  const craftTime = (rec.time || 1) / Math.max(1, (G.dbg && G.dbg.asmMult) || 1);
  let queued = 0;
  for (let i = 0; i < times; i++) {
    if (!canCraft(rid) || !hasCraftRoom(rid)) break;
    for (const k in rec.inp) invTake(k, rec.inp[k]);
    if (!G.craftQueue) G.craftQueue = [];
    G.craftQueue.push({ rid, outId, time: craftTime, total: craftTime, done: 0 });
    queued++;
  }
  if (queued > 0) uiDirty = true;
  return queued;
}

// 队列当前正在制作的一项（队首）
function craftCurrent() {
  return (G.craftQueue && G.craftQueue.length) ? G.craftQueue[0] : null;
}

// 推进手搓队列（每帧调用）。返回本帧完成的件数。
function updateCraftQueue(dt) {
  if (!G.craftQueue || G.craftQueue.length === 0) return;
  let cur = G.craftQueue[0];
  cur.done += dt;
  let completed = 0;
  while (cur && cur.done >= cur.time) {
    // 背包已满（受物品堆叠上限约束）时暂停合成，避免产出丢失；
    // 待腾出空间后继续（对齐《异星工厂》：背包满则停止手搓）。
    if (!hasCraftRoom(cur.rid)) { cur.done = cur.time; break; }
    const over = cur.done - cur.time;
    for (const k in RECIPES[cur.rid].out) invAdd(k, RECIPES[cur.rid].out[k]);
    completed++;
    // 成就：手搓完成计数（对齐《异星工厂》手工合成成就）
    if (typeof achEnsureStats === 'function') { achEnsureStats(); G.achStats.crafts++; checkAchievements(); }
    G.craftQueue.shift();
    if (G.craftQueue.length === 0) break;
    cur = G.craftQueue[0];
    cur.done = over;
  }
  if (completed > 0) { uiDirty = true; if (typeof playSfx === 'function') playSfx('craft'); }
  return completed;
}

// 取消队列中所有未开始/正在进行的制作，返还材料（仅返还尚未制作完成的剩余件数的材料）
function cancelCraftQueue() {
  if (!G.craftQueue || G.craftQueue.length === 0) return;
  // 当前项若已消耗部分时间，其材料不返还；其余排队项全部返还材料
  for (let i = 1; i < G.craftQueue.length; i++) {
    const q = G.craftQueue[i];
    for (const k in RECIPES[q.rid].inp) invAdd(k, RECIPES[q.rid].inp[k]);
  }
  G.craftQueue = [];
  uiDirty = true;
}

// 兼容旧的即时合成调用（调试/一次性使用）：直接结算，不排队
function doCraft(rid, times = 1) {
  if (!isHandCraftable(rid)) return 0;
  let made = 0;
  for (let i = 0; i < times; i++) {
    if (!canCraft(rid) || !hasCraftRoom(rid)) break;
    for (const k in RECIPES[rid].inp) invTake(k, RECIPES[rid].inp[k]);
    for (const k in RECIPES[rid].out) invAdd(k, RECIPES[rid].out[k]);
    made++;
  }
  uiDirty = true;
  return made;
}

function updateMining(dt) {
  const p = G.player;
  // 载具驾驶中不能采矿
  if (G.driving && G.driving.ent && !G.driving.ent._dead) { p.mining = null; p.mineProg = 0; return; }
  // 采矿/砍树改为按住右键触发（对齐新控制方案：右键采集）。
  // 手持工具（如开采工具）选中时不阻断采矿；仅当真正在放置建筑时才阻断
  if (!G.mouseRightDown || !G.canvasActive) { p.mining = null; p.mineProg = 0; return; }
  const t = G.cursorTile;
  if (!t) { p.mining = null; p.mineProg = 0; return; }
  const key = t.tx + ',' + t.ty;
  if (p.mining !== key) { p.mining = key; p.mineProg = 0; mineToastAcc = 0; } // 新一次手动采集从零计数
  if (!withinReach(t.tx, t.ty)) { p.mineProg = 0; return; }
  const ti = getOreType(t.tx, t.ty);
  // 砍树：T_TREE 地形，按住可连续砍伐获得木材（对齐《异星工厂》）
  if (getTerrain(t.tx, t.ty) === T_TREE) {
    p.mineProg += dt * ((G.dbg && G.dbg.mineMult) || 1) / (HAND_MINE_TIME * 1.5);
    if (p.mineProg >= 1) {
      p.mineProg -= 1;
      setTerrain(t.tx, t.ty, T_GRASS);
      invAdd('wood');
      invalidateTerrainChunk(t.tx, t.ty);
      if (typeof achEnsureStats === 'function') { achEnsureStats(); G.achStats.mined++; checkAchievements(); }
      if (typeof playSfx === 'function') playSfx('mine');
      if (typeof toast === 'function') toast('+1 木材');
    }
  } else if (isOreType(ti) && getOreAmt(t.tx, t.ty) > 0) {
    p.mineProg += dt * ((G.dbg && G.dbg.mineMult) || 1) / HAND_MINE_TIME;
    if (p.mineProg >= 1) {
      p.mineProg -= 1;
      if (!G.settings.infiniteOre) consumeOre(t.tx, t.ty);
      const it = oreItemId(ti);
      invAdd(it);
      if (typeof achEnsureStats === 'function') { achEnsureStats(); G.achStats.mined++; checkAchievements(); }
      if (typeof playSfx === 'function') playSfx('mine');
      // 手动采矿反馈去抖：累积到一定数量再提示一次，避免连挖时刷屏
      mineToastAcc++;
      if (mineToastAcc % 5 === 0 && typeof toast === 'function') {
        toast('+' + mineToastAcc + ' ' + (ITEMS[it] ? ITEMS[it].name : '未知矿'));
      }
    }
  } else {
    p.mineProg = 0;
  }
}

// ===== 玩家丢弃物品到地面（对齐《异星工厂》：按 Q 把手持普通物品放到地面/传送带）=====
// G.groundItems：地面物品实体数组 { tx, ty, item, n, taken }
// 用于玩家手动上料：物品落到地面后，可被传送带吸附带走、玩家走近拾取。

function addGroundItem(tx, ty, item, n) {
  if (!G.groundItems) G.groundItems = [];
  // 同格同种物品自动合并（对齐《异星工厂》：地面同种物品堆叠）
  for (const g of G.groundItems) {
    if (!g.taken && g.tx === tx && g.ty === ty && g.item === item) { g.n += n; return; }
  }
  G.groundItems.push({ tx, ty, item, n, taken: false });
}

// 格子是否不可放置地面物品（水/峭壁/树/占用实体；传送带可承载故不视为阻挡）
function groundTileBlocked(tx, ty) {
  const t = getTerrain(tx, ty);
  if (t === T_WATER || t === T_CLIFF || t === T_TREE) return true;
  const e = entAt(tx, ty);
  if (e && !(e instanceof Belt)) return true;   // 非传送带实体阻挡（传送带可承载物品）
  return false;
}

// 手持物品是否为可丢弃到地面的普通物品（非建筑/工具/流体）
function isGroundDroppable(id) {
  if (!id || !ITEMS[id]) return false;
  if (BUILD_DEFS[id]) return false;            // 建筑不丢，Q 用于取消选择
  if (typeof isToolItem === 'function' && isToolItem(id)) return false;
  if (FLUIDS.indexOf(id) >= 0) return false;   // 流体不可直接放置到地面
  return true;
}

// 玩家按 Q 丢弃手持物品 1 个到前方地面（前方不可放则放脚下），保持手持便于连续上料
function dropHeldItemToGround() {
  const held = selItem();
  if (!isGroundDroppable(held)) return false;
  if (invCount(held) <= 0) return false;
  let tx = Math.floor(G.player.x / TILE) + DX[G.player.dir];
  let ty = Math.floor(G.player.y / TILE) + DY[G.player.dir];
  if (groundTileBlocked(tx, ty)) { tx = Math.floor(G.player.x / TILE); ty = Math.floor(G.player.y / TILE); }
  if (!invTake(held, 1)) return false;
  addGroundItem(tx, ty, held, 1);
  if (typeof playSfx === 'function') playSfx('loot');
  uiDirty = true;
  return true;
}

// ===== 设备切换配方时返还已投入原料（对齐《异星工厂》：切换配方返还残留物料） =====
// 组装机/化工/炼油/离心机在切换或清除配方时，把已投入但未消耗的原料与已产出的
// 成品返还到机器旁：固体掉落到旁边地面（addGroundItem，同格同种自动合并），
// 流体尝试推回相连管道；无法推回管道时丢弃（微量损失，简化实现）。
// 返回 { dropped, lostFluid } 供调用方决定提示。
function returnMachineContents(e) {
  if (!e) return { dropped: 0, lostFluid: false };
  let dropped = 0, lostFluid = false;
  // 选取机器旁第一个可放置地面物品的格子（前方优先，其次两侧、后方，最后机器自身格）
  let fx = e.x, fy = e.y;
  const cand = [];
  cand.push([e.x + DX[e.dir], e.y + DY[e.dir]]);            // 前方
  cand.push([e.x + DY[e.dir], e.y - DX[e.dir]]);            // 左侧
  cand.push([e.x - DY[e.dir], e.y + DX[e.dir]]);            // 右侧
  cand.push([e.x - DX[e.dir], e.y - DY[e.dir]]);            // 后方
  for (const [cx, cy] of cand) {
    if (!groundTileBlocked(cx, cy)) { fx = cx; fy = cy; break; }
  }
  const ret = (buff) => {
    if (!buff) return;
    for (const k in buff) {
      const n = buff[k];
      if (n <= 0) continue;
      if (FLUIDS.indexOf(k) >= 0) {
        // 流体：尝试推回机器四周相连管道
        let left = n;
        for (let i = 0; i < 4 && left > 0; i++) {
          const nb = entAt(e.x + DX[i], e.y + DY[i]);
          if (nb instanceof Pipe && nb.total() < PIPE_CAP) {
            while (left > 0 && nb.total() < PIPE_CAP && nb.giveItem(k)) left--;
          }
        }
        if (left > 0) lostFluid = true;
      } else {
        // 固体：掉落到机器旁地面
        addGroundItem(fx, fy, k, n);
        dropped += n;
      }
    }
  };
  ret(e.inp);
  ret(e.outp);
  e.inp = {}; e.outp = {};
  if (dropped > 0 && typeof playSfx === 'function') playSfx('loot');
  return { dropped, lostFluid };
}

// 每帧更新地面物品：玩家靠近自动拾取（传送带吸附由 Belt.update 处理）
function updateGroundItems(dt) {
  if (!G.groundItems || G.groundItems.length === 0) return;
  const p = G.player;
  const pickR = REACH_PX * 0.9;
  const pickR2 = pickR * pickR;   // 用平方距离代替每帧 Math.hypot（避免逐格开平方），语义完全一致
  let hasTaken = false;
  for (const g of G.groundItems) {
    if (g.taken) continue;
    const dx = g.tx * TILE + TILE / 2 - p.x, dy = g.ty * TILE + TILE / 2 - p.y;
    if (dx * dx + dy * dy < pickR2) {
      const got = invAdd(g.item, g.n);
      if (got > 0) {
        if (typeof playSfx === 'function') playSfx('loot');
        g.n -= got;
        if (g.n <= 0) { g.taken = true; hasTaken = true; }
      }
    }
  }
  // 仅在确实拾取过物品时（hasTaken）才压缩数组，避免无拾取时每帧二次遍历（热路径优化）
  if (hasTaken && G.groundItems.length) {
    G.groundItems = compactFilter(G.groundItems, g => !g.taken);
    if (G.groundItems.length === 0) G.groundItems = undefined;
  }
}

// 传送带吸附：返回 (tx,ty) 格的地面物品（若未取走）；由 Belt.update 调用
function groundItemForBelt(tx, ty) {
  if (!G.groundItems) return null;
  for (const g of G.groundItems) if (!g.taken && g.tx === tx && g.ty === ty) return g;
  return null;
}

// 判断坐标是否可安全出生：必须是可通行的草地，且四邻中至少有一个可通行的邻格，
// 避免出生即被水/峭壁团团围住而无法移动（修复“生成在水中央”bug）。
function isSafeSpawn(tx, ty) {
  if (getTerrain(tx, ty) !== T_GRASS) return false;
  if (isWater(tx, ty) || isCliff(tx, ty)) return false;
  for (let k = 0; k < 4; k++) {
    const nt = getTerrain(tx + DX[k], ty + DY[k]);
    if (nt !== T_WATER && nt !== T_CLIFF) return true;
  }
  return false;
}

function findSpawn() {
  let best = null, bestD = Infinity;
  const R = 22;
  for (let ty = -R; ty < R; ty++)
    for (let tx = -R; tx < R; tx++) {
      if (!isSafeSpawn(tx, ty)) continue;
      const d = Math.hypot(tx, ty);
      if (d < bestD) { bestD = d; best = [tx, ty]; }
    }
  // 出生点保证：从原点向外螺旋搜索第一个安全草地，避免兜底落到水里
  if (!best) {
    for (let r = 0; r <= R; r++) {
      for (let ty = -r; ty <= r; ty++) {
        for (let tx = -r; tx <= r; tx++) {
          if (Math.max(Math.abs(tx), Math.abs(ty)) !== r) continue;
          if (isSafeSpawn(tx, ty)) return [tx, ty];
        }
      }
    }
  }
  if (best) return best;
  return [0, 0];  // 理论不可达：原点区块保证出生点附近为草地
}
