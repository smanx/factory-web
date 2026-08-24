'use strict';

// ===== 载具（装甲车）：对齐《异星工厂》Car =====
// 可驾驶的 2×2 载具：玩家靠近后进入驾驶（WASD 更快移动），消耗煤作燃料，E 下车。
// 载具作为实体存在于网格中；玩家驾驶时由 updatePlayer 驱动它移动（玩家隐藏、相机跟随载具）。

const CAR_SPEED = 300;          // 载具速度（像素/秒，远超步行）
const CAR_FUEL_BURN = 0.08;     // 每秒消耗煤数（移动时）
const CAR_FUEL_CAP = 60;        // 载具燃料上限

class Car extends Entity {
  constructor(type, x, y) {
    super(type, x, y);
    this.fuelCoal = 0;          // 内置煤量
    this.dir = 0;               // 0东1南2西3北（车头朝向）
  }
  giveItem(item) {
    if (item === 'coal' && this.fuelCoal < CAR_FUEL_CAP) { this.fuelCoal++; return true; }
    return false;
  }
  peekItem() { return null; }
  takeItem() { return null; }
  countOf(item) { return item === 'coal' ? this.fuelCoal : 0; }
  takeItemOf(item) {
    if (item === 'coal' && this.fuelCoal > 0) { this.fuelCoal--; return 'coal'; }
    return null;
  }
  contents() { return [[this.type, 1]].concat(this.fuelCoal > 0 ? [['coal', this.fuelCoal]] : []); }
  takeAll() {
    const rows = [];
    if (this.fuelCoal > 0) rows.push(['coal', this.fuelCoal]);
    this.fuelCoal = 0;
    return rows;
  }
  // 载具无需电力
  powerDemand() { return 0; }
  update(dt) {}
  serialize() { const s = super.serialize(); s.fuelCoal = this.fuelCoal; return s; }
  blueprint() { const s = super.blueprint(); return s; }
  static restore(s) {
    const c = super.restore(s);
    c.fuelCoal = s.fuelCoal || 0;
    return c;
  }
}

// ===== 进入/退出驾驶 =====
function enterCar(car) {
  if (!(car instanceof Car)) return;
  // 清理上一次驾驶残留
  G.driving = { ent: car };
  // 玩家位置对准载具中心
  G.player.x = car.x * TILE + TILE;
  G.player.y = car.y * TILE + TILE;
  G.player.inVehicle = true;
  closePanel();
  if (typeof toast === 'function') toast('已进入装甲车（WASD 驾驶，E 下车）');
  uiDirty = true;
}
function exitCar() {
  if (!G.driving) return;
  const car = G.driving.ent;
  G.driving = null;
  if (G.player) G.player.inVehicle = false;
  // 下车：把玩家放在车的一侧，若被堵则原地
  if (car && !car._dead) {
    const side = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    for (const [dx, dy] of side) {
      const sx = car.x * TILE + TILE + dx * TILE * 2;
      const sy = car.y * TILE + TILE + dy * TILE * 2;
      if (!solidAtPx(sx, sy) && !entAt(Math.round(sx / TILE), Math.round(sy / TILE))) {
        G.player.x = sx; G.player.y = sy;
        break;
      }
    }
  }
  if (typeof toast === 'function') toast('已下车');
  uiDirty = true;
}

// ===== 驾驶更新（由 updatePlayer 调用）=====
function updateDriving(dt) {
  const d = G.driving;
  if (!d || !d.ent || d.ent._dead) return;
  const car = d.ent;
  let mx = 0, my = 0;
  if (G.keys['w'] || G.keys['arrowup']) my -= 1;
  if (G.keys['s'] || G.keys['arrowdown']) my += 1;
  if (G.keys['a'] || G.keys['arrowleft']) mx -= 1;
  if (G.keys['d'] || G.keys['arrowright']) mx += 1;
  const len = Math.hypot(mx, my);
  if (len > 0) {
    // 消耗燃料：燃料不足则无法移动
    if (car.fuelCoal <= 0) {
      if (!d.warned) { d.warned = true; if (typeof toast === 'function') toast('燃料不足：装甲车需要煤'); }
      // 玩家仍可下车（E）
      return;
    }
    d.warned = false;
    mx /= len; my /= len;
    if (Math.abs(mx) > Math.abs(my)) car.dir = mx > 0 ? 0 : 2;
    else car.dir = my > 0 ? 1 : 3;
    // 载具中心在世界坐标
    const cx = car.x * TILE + TILE, cy = car.y * TILE + TILE;
    const nx = cx + mx * CAR_SPEED * dt, ny = cy + my * CAR_SPEED * dt;
    const r = 14; // 载具碰撞半径
    let okX = !boxBlocked(nx, cy, r), okY = !boxBlocked(cx, ny, r);
    // 载具不能驶入建筑/水域：额外检查中心格
    let ntx = car.x, nty = car.y;
    if (!isWater(Math.floor(nx / TILE), Math.floor(cy / TILE))) {
      if (okX) ntx = Math.floor(nx / TILE);
    }
    if (!isWater(Math.floor(cx / TILE), Math.floor(ny / TILE))) {
      if (okY) nty = Math.floor(ny / TILE);
    }
    // 目的地格子是否被其他实体占据（载具自身除外）
    let targetOccupied = false;
    if (ntx !== car.x || nty !== car.y) {
      for (let dy = 0; dy < car.h && !targetOccupied; dy++)
        for (let dx = 0; dx < car.w && !targetOccupied; dx++) {
          const other = entAt(ntx + dx, nty + dy);
          if (other && other !== car) targetOccupied = true;
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
    G.player.x = car.x * TILE + TILE;
    G.player.y = car.y * TILE + TILE;
    // 燃料消耗
    car.fuelCoal = Math.max(0, car.fuelCoal - CAR_FUEL_BURN * dt);
  }
}

// ===== 渲染 =====
function drawCar(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE, cy = py + TILE;
  ctx.globalAlpha = alpha;
  // 车身
  ctx.fillStyle = '#5a4a2a';
  rr(ctx, px + 4, py + 6, TILE * 2 - 8, TILE * 2 - 14, 8); ctx.fill();
  ctx.fillStyle = '#7a6a3a';
  rr(ctx, px + 4, py + 6, TILE * 2 - 8, TILE * 2 - 26, 8); ctx.fill();
  // 驾驶舱玻璃
  ctx.fillStyle = '#bfe8ff';
  rr(ctx, cx - 8, cy - 6, 16, 14, 4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  rr(ctx, cx - 8, cy - 6, 16, 5, 4); ctx.fill();
  // 车头朝向箭头（指示车头方向）
  const ang = (e.dir || 0) * Math.PI / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  ctx.fillStyle = '#e8c85a';
  ctx.beginPath();
  ctx.moveTo(12, 0); ctx.lineTo(5, -5); ctx.lineTo(5, 5); ctx.closePath();
  ctx.fill();
  ctx.restore();
  // 车轮
  ctx.fillStyle = '#2a2620';
  ctx.fillRect(px + 6, py + 4, 8, 6);
  ctx.fillRect(px + TILE * 2 - 14, py + 4, 8, 6);
  ctx.fillRect(px + 6, py + TILE * 2 - 12, 8, 6);
  ctx.fillRect(px + TILE * 2 - 14, py + TILE * 2 - 12, 8, 6);
  // 燃料显示
  const fl = e.fuelCoal || 0;
  if (fl > 0 || (G.driving && G.driving.ent === e)) {
    ctx.fillStyle = fl > 0 ? '#e8c85a' : '#ff5b5b';
    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('煤 ' + fl, cx, py + TILE * 2 - 4);
  }
  ctx.globalAlpha = 1;
}
function carPanelHtml(e) {
  let h = row('煤燃料', e.fuelCoal > 0 ? (e.fuelCoal + ' / ' + CAR_FUEL_CAP) : '<span class="dim">空</span>', 'fuel');
  const n = Math.min(invCount('coal'), CAR_FUEL_CAP - e.fuelCoal);
  if (n > 0) h += '<button data-action="feed" data-id="coal">放入煤 ×' + n + '</button>';
  h += '<div class="status"></div>';
  h += '<button data-action="drive" id="btn-car-drive" class="primary">🚗 进入驾驶</button>';
  h += '<div class="dim">装甲车：靠近后按 E 进入驾驶（WASD 更快移动），移动消耗煤燃料，E 下车。可用机械臂/手动放入煤。</div>';
  return h;
}
function carPanelLive(e, api) {
  api.set('fuel', e.fuelCoal > 0 ? (e.fuelCoal + ' / ' + CAR_FUEL_CAP) : dimSpan('空'));
  const n = Math.min(invCount('coal'), CAR_FUEL_CAP - e.fuelCoal);
  api.toggle('button[data-action="feed"]', n > 0, '放入煤 ×' + n);
  if (G.driving && G.driving.ent === e) api.status('驾驶中（E 下车）', 'ok');
  else if (e.fuelCoal <= 0) api.status('缺燃料：放入煤后可驾驶', 'warn');
  else api.status('可驾驶', 'ok');
}
function carTip(e) {
  if (G.driving && G.driving.ent === e) return '驾驶中（E 下车）';
  return '装甲车（煤 ' + (e.fuelCoal || 0) + '），按 E 进入驾驶';
}
function carOnAction(act) {
  if (act === 'drive') {
    const c = G.panelEnt;
    if (c instanceof Car) { enterCar(c); return true; }
  }
  return false;
}

// ===== 注册 =====
ENT_CLASSES['car'] = Car;
DEVICE_RENDER['car'] = drawCar;
DEVICE_PANEL['car'] = { html: carPanelHtml, live: carPanelLive, tip: carTip, onAction: carOnAction };
DEVICE_DIR_ROTATE['car'] = true;
