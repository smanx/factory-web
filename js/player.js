'use strict';

let mineToastAcc = 0;   // 手动挖矿提示去抖计数

function playerSpeed() { return 140 * ((G.dbg && G.dbg.moveSpeed) || 1) * (typeof equipmentSpeedMult === 'function' ? equipmentSpeedMult() : 1); }

function makePlayer(tx, ty) {
  return {
    x: tx * TILE + TILE / 2,
    y: ty * TILE + TILE / 2,
    dir: 2,
    mining: null,
    mineProg: 0,
    walkT: 0,
    inVehicle: false   // 是否在载具驾驶中
  };
}

function solidAtPx(px, py) {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  return isWater(tx, ty);
}

function boxBlocked(cx, cy, r) {
  return solidAtPx(cx - r, cy - r) || solidAtPx(cx + r, cy - r) ||
         solidAtPx(cx - r, cy + r) || solidAtPx(cx + r, cy + r);
}

function updatePlayer(dt) {
  const p = G.player;
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
  // 虚拟摇杆输入（手机/触屏）：叠加到方向向量上
  const j = G.joystick;
  if (j && (j.dx !== 0 || j.dy !== 0)) {
    mx += j.dx;
    my += j.dy;
  }
  const len = Math.hypot(mx, my);
  if (len > 0) {
    // 手动输入（方向键/摇杆）时取消“点击移动”目标
    if (typeof cancelTouchMove === 'function') cancelTouchMove();
    mx /= len; my /= len;
    p.walkT += dt * 10;
    // 行走脚步声：随步态相位周期触发（低频短促，增强沉浸感）
    if (typeof playSfx === 'function' && G.settings.sound) {
      const stepPhase = Math.sin(p.walkT);
      if (stepPhase < -0.7 && (G._lastStepPhase >= -0.7)) playSfx('step');
      G._lastStepPhase = stepPhase;
    }
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
  G.inv.set(id, (G.inv.get(id) || 0) + n);
  if (typeof trackProd === 'function') trackProd(id, n);
  uiDirty = true;
}

function invCount(id) { return G.inv.get(id) || 0; }

function selItem() { return G.sel >= 0 ? (HOTBAR[G.sel] || null) : (G.quickSel || null); }
function buildActive() { return G.sel >= 0 || !!G.quickSel; }

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
    if (!canCraft(rid)) break;
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
    const over = cur.done - cur.time;
    for (const k in RECIPES[cur.rid].out) invAdd(k, RECIPES[cur.rid].out[k]);
    completed++;
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
    if (!canCraft(rid)) break;
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
  if (!G.mouseDown || buildActive() || !G.canvasActive) { p.mining = null; p.mineProg = 0; return; }
  const t = G.cursorTile;
  if (!t) { p.mining = null; p.mineProg = 0; return; }
  const key = t.tx + ',' + t.ty;
  if (p.mining !== key) { p.mining = key; p.mineProg = 0; }
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
      if (typeof playSfx === 'function') playSfx('mine');
      if (typeof toast === 'function') toast('+1 木材');
    }
  } else if (((ti >= 0 && ti < ORES.length) || ti === ORE_URANIUM) && getOreAmt(t.tx, t.ty) > 0) {
    p.mineProg += dt * ((G.dbg && G.dbg.mineMult) || 1) / HAND_MINE_TIME;
    if (p.mineProg >= 1) {
      p.mineProg -= 1;
      if (!G.settings.infiniteOre) consumeOre(t.tx, t.ty);
      const it = oreItemId(ti);
      invAdd(it);
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

function findSpawn() {
  let best = null, bestD = Infinity;
  const R = 22;
  for (let ty = -R; ty < R; ty++)
    for (let tx = -R; tx < R; tx++) {
      if (getTerrain(tx, ty) !== T_GRASS) continue;
      if (getOreType(tx, ty) !== ORES.indexOf('iron-ore')) continue;
      if (isWater(tx + 1, ty) || isWater(tx - 1, ty) || isWater(tx, ty + 1) || isWater(tx, ty - 1)) continue;
      const d = Math.hypot(tx, ty);
      if (d < bestD) { bestD = d; best = [tx, ty]; }
    }
  if (!best) best = [4, 4];
  return best;
}
