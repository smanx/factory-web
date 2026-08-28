'use strict';

// ===== 进入/退出驾驶 =====
function enterCar(car) {
  if (!(car instanceof Car)) {
    // 火车：玩家可进入车头驾驶或乘坐车厢（对齐《异星工厂》：玩家可亲手驾驶列车/乘坐车厢）
    if (typeof Locomotive !== 'undefined' && (car instanceof Locomotive || car instanceof CargoWagon)) {
      enterTrain(car);
      return;
    }
    return;
  }
  // 清理上一次驾驶残留
  G.driving = { ent: car };
  // 玩家位置对准载具中心
  G.player.x = car.x * TILE + TILE * car.w / 2;
  G.player.y = car.y * TILE + TILE * car.h / 2;
  G.player.inVehicle = true;
  closePanel();
  if (typeof toast === 'function') toast(car instanceof Tank ? '已进入坦克（WASD 驾驶，空格开炮，E 下车）' : '已进入装甲车（WASD 驾驶，空格车载机枪，E 下车）');
  uiDirty = true;
}

// ===== 火车驾驶/乘坐（对齐《异星工厂》：玩家可亲手驾驶列车，双向行驶） =====
// 车头 → 驾驶模式（W 前进 / S 后退 / R 反转方向）；车厢 → 乘坐模式（随列车移动）。
function enterTrain(car) {
  G.driving = { ent: car, mode: (car instanceof Locomotive) ? 'drive' : 'ride' };
  G.player.x = car.x * TILE + TILE * car.w / 2;
  G.player.y = car.y * TILE + TILE * car.h / 2;
  G.player.inVehicle = true;
  closePanel();
  const isDrive = G.driving.mode === 'drive';
  if (typeof toast === 'function') toast(isDrive ? '已进入火车驾驶（W 前进，S 后退，R 反转车头，E 下车）' : '已登上车厢（随列车行驶，E 下车）');
  uiDirty = true;
}
function exitCar() {
  if (!G.driving) return;
  const car = G.driving.ent;
  const wasTrain = !!(car && (typeof Locomotive !== 'undefined' && (car instanceof Locomotive || car instanceof CargoWagon)));
  G.driving = null;
  if (G.player) G.player.inVehicle = false;
  // 下车：把玩家放在车的一侧，若被堵则原地
  if (car && !car._dead) {
    const side = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    const ccx = car.x * TILE + TILE * car.w / 2, ccy = car.y * TILE + TILE * car.h / 2;
    // 火车为 1×1 实体，下车距离 1 格；载具（2×2 等）下车距离 2 格
    const dist = wasTrain ? TILE : TILE * 2;
    for (const [dx, dy] of side) {
      const sx = ccx + dx * dist;
      const sy = ccy + dy * dist;
      if (!solidAtPx(sx, sy) && !entAt(Math.round(sx / TILE), Math.round(sy / TILE))) {
        G.player.x = sx; G.player.y = sy;
        break;
      }
    }
  }
  if (typeof toast === 'function') toast('已下车');
  uiDirty = true;
}

// ===== 火车驾驶/乘坐更新（由 updateDriving 分发） =====
// 驾驶模式（车头）：W 前进 / S 后退，按车头类型对应的每格耗时逐步移动；R 反转车头方向。
// 乘坐模式（车厢）：仅跟随所在列车移动（列车由玩家驾驶或自动调度驱动）。
function updateTrainDriving(dt) {
  const d = G.driving;
  if (!d || !d.ent || d.ent._dead) return;
  const car = d.ent;
  const w = car.w || 1, h = car.h || 1;
  // 玩家位置始终跟随所在车辆（驾驶/乘坐统一）
  G.player.x = car.x * TILE + TILE * w / 2;
  G.player.y = car.y * TILE + TILE * h / 2;
  if (d.mode !== 'drive' || !(car instanceof Locomotive)) return;
  const tr = (typeof findTrainOfCar === 'function') ? findTrainOfCar(car) : null;
  if (!tr) return;
  // R 反转车头方向在 main.js rotateAction 中处理（对齐《异星工厂》：驾驶火车按 R 掉头）
  const goFwd = G.keys && (G.keys['w'] || G.keys['arrowup']);
  const goBack = G.keys && (G.keys['s'] || G.keys['arrowdown']);
  if (!goFwd && !goBack) { d.moveT = 0; return; }
  // 燃料检查
  car.refuel();
  if ((car.fuel || 0) <= 0) {
    if (!d.warned) { d.warned = true; if (typeof toast === 'function') toast('火车燃料不足：放入煤/固体燃料/火箭燃料'); }
    d.moveT = 0;
    return;
  }
  d.warned = false;
  d.moveT = (d.moveT || 0) + dt;
  const step = (typeof trainMoveTime === 'function') ? trainMoveTime(car) : TRAIN_SPEED;
  if (d.moveT >= step) {
    d.moveT -= step;
    if (goBack) { if (typeof moveTrainBack === 'function') moveTrainBack(tr); }
    else if (typeof moveTrainManual === 'function') moveTrainManual(tr);
  }
}

// ===== 驾驶更新（由 updatePlayer 调用）=====
function updateDriving(dt) {
  const d = G.driving;
  if (!d || !d.ent || d.ent._dead) return;
  const car = d.ent;
  // 火车：驾驶车头或乘坐车厢（对齐《异星工厂》手动驾驶/乘坐）
  if (typeof Locomotive !== 'undefined' && (car instanceof Locomotive || car instanceof CargoWagon)) {
    updateTrainDriving(dt);
    return;
  }
  const isTank = car instanceof Tank;
  const isSpider = car instanceof Spidertron;
  const speed = isSpider ? SPIDER_SPEED * car.spiderSpeedMult() : (isTank ? TANK_SPEED : CAR_SPEED) * (car.vehSpeedMult ? car.vehSpeedMult() : 1);
  // 蜘蛛机器人：车载自动炮塔持续开火；装甲车/坦克更新载具装备电网（个人激光防御等）
  if (isSpider) car.autoTurret(dt);
  else if (typeof car.vehUpdateEquipment === 'function') car.vehUpdateEquipment(dt);
  let mx = 0, my = 0;
  if (G.keys['w'] || G.keys['arrowup']) my -= 1;
  if (G.keys['s'] || G.keys['arrowdown']) my += 1;
  if (G.keys['a'] || G.keys['arrowleft']) mx -= 1;
  if (G.keys['d'] || G.keys['arrowright']) mx += 1;
  const len = Math.hypot(mx, my);
  if (len > 0) {
    // 车辆引擎环境音（节流，避免每帧重复触发）
    if (typeof playSfx === 'function' && (!d.sfxT || d.sfxT <= 0)) {
      playSfx('engine'); d.sfxT = 0.8;
    }
    if (d.sfxT) d.sfxT -= dt;
    // 消耗燃料：燃料不足则无法移动
    if (car.fuelCoal <= 0 && car.fuelSolid <= 0 && car.fuelRocket <= 0 && (car.fuelNuclear||0) <= 0) {
      if (!d.warned) { d.warned = true; if (typeof toast === 'function') toast('燃料不足：' + (isSpider ? '蜘蛛机器人' : (isTank ? '坦克' : '装甲车')) + '需要煤/固体燃料/火箭燃料'); }
      // 玩家仍可下车（E）
      return;
    }
    d.warned = false;
    mx /= len; my /= len;
    if (Math.abs(mx) > Math.abs(my)) car.dir = mx > 0 ? 0 : 2;
    else car.dir = my > 0 ? 1 : 3;
    // 载具中心在世界坐标
    const cx = car.x * TILE + TILE * car.w / 2, cy = car.y * TILE + TILE * car.h / 2;
    const nx = cx + mx * speed * dt, ny = cy + my * speed * dt;
    const r = isTank ? TANK_COLLIDE : 14; // 载具碰撞半径
    let okX = !(isSpider ? terrainBoxBlocked(nx, cy, r) : boxBlocked(nx, cy, r));
    let okY = !(isSpider ? terrainBoxBlocked(cx, ny, r) : boxBlocked(cx, ny, r));
    // 载具不能驶入建筑/水域：额外检查中心格（蜘蛛机器人可跨水/墙，不受此限）
    let ntx = car.x, nty = car.y;
    if (isSpider || (!isWater(Math.floor(nx / TILE), Math.floor(cy / TILE)) && !isCliff(Math.floor(nx / TILE), Math.floor(cy / TILE)))) {
      if (okX) ntx = Math.floor(nx / TILE);
    }
    if (isSpider || (!isWater(Math.floor(cx / TILE), Math.floor(ny / TILE)) && !isCliff(Math.floor(cx / TILE), Math.floor(ny / TILE)))) {
      if (okY) nty = Math.floor(ny / TILE);
    }
    // 目的地格子是否被其他实体占据（载具自身除外；蜘蛛机器人可越过石墙）
    let targetOccupied = false;
    if (ntx !== car.x || nty !== car.y) {
      for (let dy = 0; dy < car.h && !targetOccupied; dy++)
        for (let dx = 0; dx < car.w && !targetOccupied; dx++) {
          const other = entAt(ntx + dx, nty + dy);
          if (other && other !== car && !(isSpider && other.type === 'stone-wall')) targetOccupied = true;
        }
    }
    if (targetOccupied) { return; }
    // 移动载具：在空间索引中重定位（不重复 push 进 G.ents）
    if (ntx !== car.x || nty !== car.y) {
      // 先从旧位置网格/桶移除
      const ob = bucketKey(car.x, car.y);
      const obs = G.buckets.get(ob);
      if (obs) { obs.delete(car); if (!obs.size) G.buckets.delete(ob); }
      for (let dy = 0; dy < car.h; dy++)
        for (let dx = 0; dx < car.w; dx++) {
          const k = entKey(car.x + dx, car.y + dy);
          if (G.grid.get(k) === car) G.grid.delete(k);
        }
      // 写入新位置
      car.x = ntx; car.y = nty;
      ensureBucket(bucketKey(car.x, car.y)).add(car);
      for (let dy = 0; dy < car.h; dy++)
        for (let dx = 0; dx < car.w; dx++)
          G.grid.set(entKey(car.x + dx, car.y + dy), car);
      if (typeof invalidateBeltInputNear === 'function') invalidateBeltInputNear(car.x, car.y, car.w, car.h);
    }
    // 玩家位置跟随载具中心
    G.player.x = car.x * TILE + TILE * car.w / 2;
    G.player.y = car.y * TILE + TILE * car.h / 2;
    // 燃料消耗（蜘蛛最省、坦克最快；优先烧固体燃料）
    car.burnFuel((isSpider ? SPIDER_FUEL_BURN : (isTank ? TANK_FUEL_BURN : CAR_FUEL_BURN)) * dt);
  }
}

// ===== 载具储物箱面板（对齐《异星工厂》：车辆自带储物箱，可在面板查看/存取物品） =====
// 返回储物箱 HTML：列出箱内物品并提供"取出"按钮；空时提示可用机械臂/手动放入。
function trunkPanelHtml(e) {
  let h = '<div class="sec">储物箱（' + e.trunkUsedSlots() + '/' + TRUNK_SLOTS + ' 槽）</div>';
  const keys = Object.keys(e.trunk || {}).filter(k => e.trunk[k] > 0);
  if (!keys.length) {
    h += '<div class="dim">储物箱空。打开背包选中物品后在载具面板点"放入"，或让机械臂直接送入载具。</div>';
    return h;
  }
  let total = 0;
  for (const k of keys) total += e.trunk[k];
  h += '<div class="trunk-list">';
  for (const k of keys) {
    const cnt = e.trunk[k];
    h += '<div class="trunk-item" data-tip="' + itemTip(k) + '"><img src="' + iconDataURL(k) + '"><span>' + ITEMS[k].name + ' ×' + cnt + '</span>' +
      '<button data-action="trunk-take" data-id="' + k + '" data-tip="取出一件">取出</button></div>';
  }
  h += '</div>';
  h += '<div class="dim">共 ' + keys.length + ' 种、' + total + ' 件。点击"取出"移回背包（受背包堆叠上限约束）。</div>';
  return h;
}

