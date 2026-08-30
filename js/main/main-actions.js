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

function rotateAction() {
  // 驾驶火车时：R 反转车头方向（对齐《异星工厂》：驾驶列车按 R 掉头）
  if (G.driving && G.driving.ent && typeof reverseTrain === 'function' &&
      (G.driving.ent instanceof Locomotive || G.driving.ent instanceof CargoWagon) && G.driving.mode === 'drive') {
    const tr = findTrainOfCar ? findTrainOfCar(G.driving.ent) : null;
    if (tr) reverseTrain(tr);
    return;
  }
  // 蓝图粘贴中：旋转整个蓝图（对齐《异星工厂》R 键旋转蓝图）
  if (G.blueMode === 'paste' && G.blueprint) {
    G.blueRot = (G.blueRot + 1) % 4;
    uiDirty = true;
    toast('蓝图已旋转 90°（R 继续旋转，V/H 翻转）');
    return;
  }
  if (G.cursorTile && withinReach(G.cursorTile.tx, G.cursorTile.ty)) {
    const e = entAt(G.cursorTile.tx, G.cursorTile.ty);
    if (e && BUILD_DEFS[e.type]) {
      // 已放置设备默认不可旋转，仅物流件（传送带/机械臂/地下传送带/地下管道等）
      // 白名单例外可直接旋转；其余按 R 只作用于当前放置幽灵（预览）。
      // 非方形设备（分流器类）旋转后脚印变化，需重挂网格
      const rotOk = postPlaceRotatable(e.type);
      if (rotOk && BUILD_DEFS[e.type].rotSwap) {
        const nd = (e.dir + 1) % 4;
        // 抽水机必须始终压在水面上，旋转后脚印变化需重新校验
        if (e.type === 'offshore-pump' && !pumpCanFace(e, nd)) { toast('抽水机无法朝该方向旋转：必须仍压在水面上'); return; }
        removeEnt(e);
        e.dir = nd;
        e.applyDir();
        addEnt(e);
        uiDirty = true;
        return;
      }
      // 有朝向的设备：直接旋转（采矿机转完立即尝试朝新方向输出）
      if (rotOk && DEVICE_DIR_ROTATE[e.type]) {
        e.dir = (e.dir + 1) % 4;
        // 传送带方向变化会改变其输入侧判定，失效附近缓存
        invalidateBeltInputNear(e.x, e.y, e.w, e.h);
        if (typeof e.onRotate === 'function') e.onRotate();
        uiDirty = true;
        return;
      }
    }
  }
  G.ghostDir = (G.ghostDir + 1) % 4;
}

// 翻转方向：h=水平翻转（左右镜像，东西互兑），v=垂直翻转（上下镜像，南北互兑）
// 方向 0东 1南 2西 3北。水平翻转交换 0<->2；垂直翻转交换 1<->3，另一轴方向保持不变。
function flipDir(dir, axis) {
  if (axis === 'h') return dir === 0 ? 2 : dir === 2 ? 0 : dir;
  return dir === 1 ? 3 : dir === 3 ? 1 : dir;
}

function flipAction(axis) {
  // 蓝图粘贴中：翻转整个蓝图（V 垂直翻转 / H 水平翻转，对齐《异星工厂》）
  if (G.blueMode === 'paste' && G.blueprint) {
    if (axis === 'h') G.blueFlipH = !G.blueFlipH;
    else G.blueFlipV = !G.blueFlipV;
    uiDirty = true;
    toast('蓝图已' + (axis === 'h' ? '水平翻转' : '垂直翻转') + '（R 旋转，V/H 翻转）');
    return;
  }
  if (G.cursorTile && withinReach(G.cursorTile.tx, G.cursorTile.ty)) {
    const e = entAt(G.cursorTile.tx, G.cursorTile.ty);
    if (e && BUILD_DEFS[e.type]) {
      // 所有已放置设备均可直接翻转；非方形设备（分流器类）翻转后脚印变化，需重挂网格
      if (BUILD_DEFS[e.type].rotSwap) {
        const nd = flipDir(e.dir, axis);
        // 抽水机必须始终压在水面上，翻转后脚印变化需重新校验
        if (e.type === 'offshore-pump' && !pumpCanFace(e, nd)) { toast('抽水机无法朝该方向翻转：必须仍压在水面上'); return; }
        removeEnt(e);
        e.dir = nd;
        e.applyDir();
        addEnt(e);
        uiDirty = true;
        return;
      }
      // 地下传送带：翻转会交换整对的入/出口。若它已与另一座配对（同向），
      // 把配对的那一座也一起翻转，保持两者仍同向、整对继续有效。
      // 仅当翻转在当前轴真正改变了方向时才生效：
      //   横带(0/2)按 H → 方向互换；竖带(1/3)按 V → 方向互换；其它组合不改向。
      if (e instanceof Underground) {
        const nd = flipDir(e.dir, axis);
        if (nd !== e.dir) {
          const mate = e.findMate() || e.findBackMate();
          if (mate) {
            mate.dir = flipDir(mate.dir, axis);
            if (typeof mate.onRotate === 'function') mate.onRotate();
          }
          e.dir = nd;
          if (typeof e.onRotate === 'function') e.onRotate();
          uiDirty = true;
        }
        return;
      }
      // 有朝向的设备：直接翻转
      if (DEVICE_DIR_ROTATE[e.type]) {
        e.dir = flipDir(e.dir, axis);
        if (typeof e.onRotate === 'function') e.onRotate();
        uiDirty = true;
        return;
      }
    }
  }
  // 没有可翻转的已放置设备时，翻转幽灵/预览方向
  G.ghostDir = flipDir(G.ghostDir, axis);
}

