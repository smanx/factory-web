'use strict';

// ===== 蓝图 / 红图 / 蓝图库 / 蓝图字符串 =====
// 蓝图相关功能（框选复制/粘贴/删除、旋转翻转、蓝图库、字符串导入导出）
// 已拆分到独立文件 js/blueprint.js，此处不再重复。

// 尝试进入面前的装甲车（F 键 / 交互）。成功返回 true。
function tryEnterNearbyCar() {
  if (G.driving) return false;
  if (typeof enterCar !== 'function') return false;
  const px = Math.floor(G.player.x / TILE), py = Math.floor(G.player.y / TILE);
  const checks = [[px, py], [px + DX[G.player.dir], py + DY[G.player.dir]]];
  for (const [tx, ty] of checks) {
    const e = entAt(tx, ty);
    if (e && (e.type === 'car' || e.type === 'tank' || e.type === 'locomotive' || e.type === 'cargo-wagon' || e.type === 'fluid-wagon' || e.type === 'artillery-wagon') && typeof enterCar === 'function') { enterCar(e); return true; }
  }
  return false;
}

function pickupAction() {
  // 优先拾取地面上的物品（对齐需求：F 捡起角色附近地面上的物品）
  if (pickupGroundNearby()) return;
  let t = null;
  if (G.cursorTile && withinReach(G.cursorTile.tx, G.cursorTile.ty)) t = G.cursorTile;
  else {
    const tx = Math.floor(G.player.x / TILE) + DX[G.player.dir];
    const ty = Math.floor(G.player.y / TILE) + DY[G.player.dir];
    t = { tx, ty };
  }
  if (!t) return;
  const e = entAt(t.tx, t.ty);
  if (!e) return;
  const got = e.takeItem();
  if (!got) {
    if (e instanceof Belt) toast('这条传送带上没有物品');
    return;
  }
  invAdd(got);
  if (typeof playSfx === 'function') playSfx('pickup');
  uiDirty = true;
}

// F 拾取地面物品：优先光标格（可及范围内），其次角色附近可及范围内最近的一堆；
// 受背包堆叠上限约束，放不下的留在原地。拾取到任意数量返回 true。
function pickupGroundNearby() {
  if (!G.groundItems || G.groundItems.length === 0) return false;
  let target = null;
  if (G.cursorTile && withinReach(G.cursorTile.tx, G.cursorTile.ty)) {
    target = G.groundItems.find(g => !g.taken && g.tx === G.cursorTile.tx && g.ty === G.cursorTile.ty) || null;
  }
  if (!target) {
    const p = G.player, r2 = REACH_PX * REACH_PX;
    let bd = Infinity;
    for (const g of G.groundItems) {
      if (g.taken) continue;
      const dx = g.tx * TILE + TILE / 2 - p.x, dy = g.ty * TILE + TILE / 2 - p.y;
      const d2 = dx * dx + dy * dy;
      if (d2 <= r2 && d2 < bd) { bd = d2; target = g; }
    }
  }
  if (!target) return false;
  const got = invAdd(target.item, target.n);
  if (got <= 0) { toast('背包已满，捡不起来'); return true; }
  target.n -= got;
  if (target.n <= 0) target.taken = true;
  G.groundItems = compactFilter(G.groundItems, g => !g.taken);
  if (G.groundItems.length === 0) G.groundItems = undefined;
  if (typeof playSfx === 'function') playSfx('pickup');
  toast('拾取 ' + (ITEMS[target.item] ? ITEMS[target.item].name : target.item) + ' ×' + got);
  uiDirty = true;
  return true;
}

// ===== 全部拾取（对齐《异星工厂》：按住 Z 拾取范围内所有地面物品）=====
// 官方 Factorio 默认快捷键 Z = Pick up items，一键收集玩家周围可触及范围内的全部散落物品
// （地面掉落物）。拾取受背包堆叠上限约束，放不下的物品保留在原地，返回实际拾取总数。
function pickupAllAction() {
  if (!G.groundItems || G.groundItems.length === 0) return 0;
  const p = G.player;
  const pickR = REACH_PX;
  const pickR2 = pickR * pickR;   // 用平方距离避免逐格开平方（与 updateGroundItems 语义一致）
  let total = 0;
  let anyPicked = false;
  for (const g of G.groundItems) {
    if (g.taken) continue;
    const dx = g.tx * TILE + TILE / 2 - p.x, dy = g.ty * TILE + TILE / 2 - p.y;
    if (dx * dx + dy * dy <= pickR2) {
      const got = invAdd(g.item, g.n);
      if (got > 0) {
        g.n -= got;
        total += got;
        anyPicked = true;
        if (g.n <= 0) g.taken = true;
      }
    }
  }
  if (anyPicked) {
    if (typeof playSfx === 'function') playSfx('pickup');
    G.groundItems = compactFilter(G.groundItems, g => !g.taken);
    if (G.groundItems.length === 0) G.groundItems = undefined;
    uiDirty = true;
    if (typeof toast === 'function') toast('拾取 ' + total + ' 个物品' + (total === 0 ? '（背包已满）' : ''));
  }
  return total;
}

// 手持修理包点击受损建筑：消耗修理包使用次数修复建筑 HP（对齐《异星工厂》Repair pack）
// 每个修理包最多修复 REPAIR_PACK_USES 次，用完后消耗该物品。
const REPAIR_PACK_USES = 5;
function repairActionAt(tx, ty) {
  if (!withinReach(tx, ty)) { toast('距离太远'); return false; }
  const e = entAt(tx, ty);
  if (!e || !isDamaged(e)) { toast('该建筑无需修复'); return false; }
  // 消耗修理包
  let uses = G.repairPackUses || 0;
  if (uses <= 0) {
    if (!invCount('repair-pack')) { toast('需要修理包'); return false; }
    uses = REPAIR_PACK_USES;
    invTake('repair-pack', 1);
  }
  const fixed = repairBuilding(e, 100);
  uses -= 1;
  if (uses <= 0) { uses = 0; toast('修理包已用尽'); }
  G.repairPackUses = uses;
  if (fixed > 0) {
    if (typeof makeSparkFx === 'function') makeSparkFx(e.x + e.w / 2, e.y + e.h / 2, e.w);
    if (typeof playSfx === 'function') playSfx('repair');
  }
  uiDirty = true;
  return true;
}
// 当前选中修理包（用于建造/点击优先触发修复）
function hasRepairPackSelected() { return selItem() === 'repair-pack'; }

// 使用峭壁炸药：选中峭壁炸药并点击峭壁格，炸毁该格峭壁（对齐《异星工厂》Cliff explosives）
function hasCliffBlastSelected() { return selItem() === 'cliff-explosives'; }
function cliffBlastAt(tx, ty) {
  if (!withinReach(tx, ty)) { toast('距离太远'); return false; }
  if (!isCliff(tx, ty)) { toast('这里没有峭壁'); return false; }
  if (!invCount('cliff-explosives')) { toast('需要峭壁炸药'); return false; }
  invTake('cliff-explosives', 1);
  setTerrain(tx, ty, T_GRASS);
  // 爆炸视觉 + 音效
  if (typeof spawnSmoke === 'function') {
    for (let i = 0; i < 6; i++) spawnSmoke(tx * TILE + TILE / 2 + (Math.random() - 0.5) * 22, ty * TILE + TILE / 2 + (Math.random() - 0.5) * 22, { life: 1.2, size: 8, color: '#b0a898' });
  }
  if (typeof playSfx === 'function') playSfx('explosion');
  uiDirty = true;
  return true;
}

function copySettings(e) {
  if (!e) return;
  const s = { type: e.type, dir: e.dir };
  if (typeof e.setRecipe === 'function') s.recipe = e.recipe;
  G.clipboard = s;
  toast('已复制 ' + ITEMS[e.type].name + ' 配置（Shift+左键粘贴到同类）');
}

function pasteSettings(e) {
  if (!e || !G.clipboard) return;
  const c = G.clipboard;
  if (e.type !== c.type) { toast('类型不匹配：剪贴板是' + ITEMS[c.type].name); return; }
  if (c.dir === undefined) return;
  if (BUILD_DEFS[e.type] && BUILD_DEFS[e.type].rotSwap) {
    // 抽水机旋转后脚印变化，需重新校验仍压水面
    if (e.type === 'offshore-pump' && !pumpCanFace(e, c.dir)) { toast('无法粘贴：抽水机必须仍压在水面上'); return; }
    removeEnt(e); e.dir = c.dir; e.applyDir(); addEnt(e);
  }
  else { e.dir = c.dir; }
  if (c.recipe && typeof e.setRecipe === 'function') e.setRecipe(c.recipe);
  uiDirty = true;
  toast('配置已粘贴');
}

// 列车编组保护：已连成多节列车的车厢/车头不可单独 R/V/H 改朝向（会拆散编组），
// 与地下带/地下管的配对同步同属「耦合实体」特例。单节未连挂的可自由旋转/翻转。
function _inCoupledTrain(e) {
  const isLoco = typeof Locomotive !== 'undefined' && e instanceof Locomotive;
  const isWagon = typeof CargoWagon !== 'undefined' && e instanceof CargoWagon;
  if (!isLoco && !isWagon) return false;
  if (typeof findTrainOfCar !== 'function') return false;
  const tr = findTrainOfCar(e);
  return !!(tr && tr.cars && tr.cars.length > 1);
}

// 是否处于「放置幽灵」态：手持可建造物品（含 Q 选中的同类复制）。
// 此态下 R/V/H 一律作用于待放置幽灵（所有设备都可旋转/翻转），不触碰光标下的已有建筑。
function _placingBuildable() {
  if (typeof selItem !== 'function') return false;
  let it = selItem();
  if (!it) return false;
  if (typeof isBlueprintItem === 'function' && isBlueprintItem(it)) return false;   // 蓝图另有处理
  if (typeof splitQuality === 'function') it = splitQuality(it).base;
  return !!BUILD_DEFS[it];
}

function rotateAction() {
  // 驾驶火车时：R 反转车头方向（对齐《异星工厂》：驾驶列车按 R 掉头）
  if (G.driving && G.driving.ent && typeof reverseTrain === 'function' &&
      (G.driving.ent instanceof Locomotive || G.driving.ent instanceof CargoWagon) && G.driving.mode === 'drive') {
    const tr = findTrainOfCar ? findTrainOfCar(G.driving.ent) : null;
    if (tr) reverseTrain(tr);
    return;
  }  // 蓝图旋转（对齐《异星工厂》R 键旋转蓝图）：粘贴中、或手持蓝图物品尚未放置时都生效。
  // 手持蓝图物品（blueprint#n）在未点击地图前还不在 paste 模式，此前按 R 无反应，
  // 与界面提示「R 旋转，V/H 翻转」不符；这里一并处理，预览幽灵立即跟着旋转。
  if (typeof isBlueprintHeld === 'function' && isBlueprintHeld()) {
    G.blueRot = (G.blueRot + 1) % 4;
    uiDirty = true;
    toast('蓝图已旋转 90°（R 继续旋转，V/H 翻转）');
    return;
  }
  // 蓝图粘贴中：旋转整个蓝图（对齐《异星工厂》R 键旋转蓝图）
  if (G.blueMode === 'paste' && G.blueprint) {
    G.blueRot = (G.blueRot + 1) % 4;
    uiDirty = true;
    toast('蓝图已旋转 90°（R 继续旋转，V/H 翻转）');
    return;
  }
  // 放置幽灵态：R 旋转待放置幽灵，所有设备都可旋转（不触碰光标下的已有建筑）。
  if (_placingBuildable()) { G.ghostDir = (G.ghostDir + 1) % 4; uiDirty = true; return; }
  if (G.cursorTile && withinReach(G.cursorTile.tx, G.cursorTile.ty)) {
    const e = entAt(G.cursorTile.tx, G.cursorTile.ty);
    if (e && BUILD_DEFS[e.type] && typeof e.rotateCW === 'function') {
      if (_inCoupledTrain(e)) { toast('列车编组中的车厢不可单独旋转'); return; }
      // 放置后：仅长宽相等（方形占地）的设备可 R 旋转本体；非方形设备朝向固定，需换向请在放置前用幽灵调好。
      if (e.w !== e.h) { toast('非方形设备放置后不可旋转（请在放置前按 R 调整朝向）'); return; }
      // 抽水机必须始终压在水面上，旋转后脚印变化需先校验。
      if (BUILD_DEFS[e.type].rotSwap && e.type === 'offshore-pump' && !pumpCanFace(e, (e.dir + 1) % 4)) {
        toast('抽水机无法朝该方向旋转：必须仍压在水面上'); return;
      }
      e.rotateCW();
      invalidateBeltInputNear(e.x, e.y, e.w, e.h);
      uiDirty = true;
      return;
    }
  }
  G.ghostDir = (G.ghostDir + 1) % 4;
}

function flipAction(axis) {
  // 蓝图翻转（对齐《异星工厂》V/H 键翻转蓝图）：与旋转同理，手持蓝图物品未放置时也生效
  if (typeof isBlueprintHeld === 'function' && isBlueprintHeld()) {
    if (axis === 'h') G.blueFlipH = !G.blueFlipH;
    else G.blueFlipV = !G.blueFlipV;
    uiDirty = true;
    toast('蓝图已' + (axis === 'h' ? '水平翻转' : '垂直翻转') + '（R 旋转，V/H 翻转）');
    return;
  }
  // 蓝图粘贴中：翻转整个蓝图（V 垂直翻转 / H 水平翻转，对齐《异星工厂》）
  if (G.blueMode === 'paste' && G.blueprint) {
    if (axis === 'h') G.blueFlipH = !G.blueFlipH;
    else G.blueFlipV = !G.blueFlipV;
    uiDirty = true;
    toast('蓝图已' + (axis === 'h' ? '水平翻转' : '垂直翻转') + '（R 旋转，V/H 翻转）');
    return;
  }
  // 放置幽灵态：V/H 翻转待放置幽灵，所有设备都可翻转（不触碰光标下的已有建筑）。
  if (_placingBuildable()) {
    let gt = (typeof selItem === 'function') ? selItem() : null;
    if (gt && typeof splitQuality === 'function') gt = splitQuality(gt).base;
    const [gd, gm] = flipEntityDir(gt, G.ghostDir, G.ghostMirror, axis);
    G.ghostDir = gd; G.ghostMirror = gm; uiDirty = true; return;
  }
  if (G.cursorTile && withinReach(G.cursorTile.tx, G.cursorTile.ty)) {
    const e = entAt(G.cursorTile.tx, G.cursorTile.ty);
    if (e && BUILD_DEFS[e.type] && typeof e.flip === 'function') {
      if (_inCoupledTrain(e)) { toast('列车编组中的车厢不可单独翻转'); return; }
      // 所有设备统一：V/H 真镜像翻转本体（继承 Entity.flip；rotSwap 自动重挂网格，
      // 地下传送带/地下管道各自覆写以同步配对端）。抽水机翻转后须仍压在水面上。
      if (BUILD_DEFS[e.type].rotSwap && e.type === 'offshore-pump' &&
          !pumpCanFace(e, flipEntityDir(e.type, e.dir, e.mirror, axis)[0])) {
        toast('抽水机无法朝该方向翻转：必须仍压在水面上'); return;
      }
      e.flip(axis);
      invalidateBeltInputNear(e.x, e.y, e.w, e.h);
      uiDirty = true;
      return;
    }
  }
  // 没有可翻转的已放置设备时，翻转幽灵/预览方向（当前手持设备有自定义镜像映射时同样生效）
  let ghostType = (typeof selItem === 'function') ? selItem() : null;
  if (ghostType && typeof splitQuality === 'function') ghostType = splitQuality(ghostType).base;
  const [gd, gm] = flipEntityDir(ghostType, G.ghostDir, G.ghostMirror, axis);
  G.ghostDir = gd;
  G.ghostMirror = gm;
}

