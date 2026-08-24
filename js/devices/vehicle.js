'use strict';

// ===== 载具（装甲车）：对齐《异星工厂》Car =====
// 可驾驶的 2×2 载具：玩家靠近后进入驾驶（WASD 更快移动），消耗煤作燃料，E 下车。
// 载具作为实体存在于网格中；玩家驾驶时由 updatePlayer 驱动它移动（玩家隐藏、相机跟随载具）。

const CAR_SPEED = 300;          // 载具速度（像素/秒，远超步行）
const CAR_FUEL_BURN = 0.08;     // 每秒消耗煤数（移动时）
const CAR_FUEL_CAP = 60;        // 载具燃料上限
// 坦克（重型战斗载具）：更慢但更厚，主炮发射炮弹
const TANK_SPEED = 190;
const TANK_FUEL_BURN = 0.14;
const TANK_FUEL_CAP = 120;
const TANK_SHELL_CAP = 40;       // 内置炮弹容量
const TANK_COLLIDE = 22;         // 坦克碰撞半径（比车大）
const TANK_ARMOR = 0.55;         // 驾驶坦克时玩家所受伤害系数（55%）

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

// ===== 坦克 Tank（对齐《异星工厂》Tank 重型载具） =====
// 3×3 重型战斗载具：装甲更厚（驾驶时玩家受伤减少）、速度较慢、主炮发射炮弹造成范围伤害。
class Tank extends Car {
  constructor(type, x, y) {
    super(type, x, y);
    this.fuelCap = TANK_FUEL_CAP;
    this.shells = 0;           // 内置炮弹数
    this.fireT = 0;            // 主炮冷却计时
  }
  giveItem(item) {
    if (item === 'coal' && this.fuelCoal < TANK_FUEL_CAP) { this.fuelCoal++; return true; }
    if (item === 'cannon-shell' && this.shells < TANK_SHELL_CAP) { this.shells++; return true; }
    return false;
  }
  takeItemOf(item) {
    if (item === 'coal' && this.fuelCoal > 0) { this.fuelCoal--; return 'coal'; }
    if (item === 'cannon-shell' && this.shells > 0) { this.shells--; return 'cannon-shell'; }
    return null;
  }
  countOf(item) {
    if (item === 'coal') return this.fuelCoal;
    if (item === 'cannon-shell') return this.shells;
    return 0;
  }
  contents() {
    const rows = [[this.type, 1]];
    if (this.fuelCoal > 0) rows.push(['coal', this.fuelCoal]);
    if (this.shells > 0) rows.push(['cannon-shell', this.shells]);
    return rows;
  }
  takeAll() {
    const rows = [];
    if (this.fuelCoal > 0) rows.push(['coal', this.fuelCoal]);
    if (this.shells > 0) rows.push(['cannon-shell', this.shells]);
    this.fuelCoal = 0; this.shells = 0;
    return rows;
  }
  serialize() {
    const s = super.serialize();
    s.shells = this.shells;
    return s;
  }
  blueprint() {
    const s = super.blueprint();
    s.shells = this.shells;
    return s;
  }
  static restore(s) {
    const c = super.restore(s);
    c.shells = s.shells | 0;
    return c;
  }
  // 主炮开火：发射一枚炮弹（范围爆炸），消耗内置炮弹
  fire(tx, ty) {
    if (this.shells <= 0) return false;
    this.shells--;
    const px = this.x * TILE + TILE * this.w / 2, py = this.y * TILE + TILE * this.h / 2;
    const dist = 10 * TILE;
    const a = Math.atan2(ty - py, tx - px);
    const tx2 = px + Math.cos(a) * dist, ty2 = py + Math.sin(a) * dist;
    (G.bullets || (G.bullets = [])).push({
      x: px, y: py, tx: tx2, ty: ty2, t: 0, life: 0.22,
      splash: 3, dmg: 60, kind: 'rocket', tank: true
    });
    this.fireT = 0.9;
    uiDirty = true;
    return true;
  }
}

// 驾驶坦克时：按住空格向光标方向开炮（需战斗模式开启）
function updateTankFire(dt) {
  const d = G.driving;
  if (!d || !(d.ent instanceof Tank) || !G.settings.combat) return;
  const t = d.ent;
  t.fireT = (t.fireT || 0) - dt;
  if (t.fireT > 0) return;
  if (!G.keys[' ']) return;
  let tx, ty;
  if (G.cursorTile) {
    tx = G.cursorTile.tx * TILE + TILE / 2;
    ty = G.cursorTile.ty * TILE + TILE / 2;
  } else {
    const a = (t.dir || 0) * Math.PI / 2;
    tx = t.x * TILE + TILE * t.w / 2 + Math.cos(a) * TILE * 3;
    ty = t.y * TILE + TILE * t.h / 2 + Math.sin(a) * TILE * 3;
  }
  t.fire(tx, ty);
}

// ===== 进入/退出驾驶 =====
function enterCar(car) {
  if (!(car instanceof Car)) return;
  // 清理上一次驾驶残留
  G.driving = { ent: car };
  // 玩家位置对准载具中心
  G.player.x = car.x * TILE + TILE * car.w / 2;
  G.player.y = car.y * TILE + TILE * car.h / 2;
  G.player.inVehicle = true;
  closePanel();
  if (typeof toast === 'function') toast(car instanceof Tank ? '已进入坦克（WASD 驾驶，空格开炮，E 下车）' : '已进入装甲车（WASD 驾驶，E 下车）');
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
    const ccx = car.x * TILE + TILE * car.w / 2, ccy = car.y * TILE + TILE * car.h / 2;
    for (const [dx, dy] of side) {
      const sx = ccx + dx * TILE * 2;
      const sy = ccy + dy * TILE * 2;
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
  const isTank = car instanceof Tank;
  const speed = isTank ? TANK_SPEED : CAR_SPEED;
  let mx = 0, my = 0;
  if (G.keys['w'] || G.keys['arrowup']) my -= 1;
  if (G.keys['s'] || G.keys['arrowdown']) my += 1;
  if (G.keys['a'] || G.keys['arrowleft']) mx -= 1;
  if (G.keys['d'] || G.keys['arrowright']) mx += 1;
  const len = Math.hypot(mx, my);
  if (len > 0) {
    // 消耗燃料：燃料不足则无法移动
    if (car.fuelCoal <= 0) {
      if (!d.warned) { d.warned = true; if (typeof toast === 'function') toast('燃料不足：' + (isTank ? '坦克' : '装甲车') + '需要煤'); }
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
    G.player.x = car.x * TILE + TILE * car.w / 2;
    G.player.y = car.y * TILE + TILE * car.h / 2;
    // 燃料消耗（坦克耗煤更快）
    car.fuelCoal = Math.max(0, car.fuelCoal - (isTank ? TANK_FUEL_BURN : CAR_FUEL_BURN) * dt);
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

// ===== 坦克渲染与面板 =====
function drawTank(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const wpx = TILE * e.w, hpx = TILE * e.h;
  const cx = px + wpx / 2, cy = py + hpx / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  // 底盘履带
  ctx.fillStyle = '#2a3026';
  rr(ctx, px + 4, py + 6, wpx - 8, hpx - 12, 6); ctx.fill();
  ctx.strokeStyle = '#1a1e18'; ctx.lineWidth = 2; ctx.stroke();
  // 装甲车身
  ctx.fillStyle = '#4a5a3a';
  rr(ctx, px + 10, py + 10, wpx - 20, hpx - 20, 6); ctx.fill();
  ctx.strokeStyle = '#2a3424'; ctx.lineWidth = 2; ctx.stroke();
  // 炮塔
  ctx.save();
  ctx.translate(cx, cy);
  const ang = (e.dir || 0) * Math.PI / 2;
  ctx.rotate(ang);
  ctx.fillStyle = '#3a4a2e';
  ctx.beginPath(); ctx.arc(0, 0, TILE * 0.42, 0, 7); ctx.fill(); ctx.stroke();
  // 主炮管
  ctx.fillStyle = '#2a3424';
  ctx.fillRect(TILE * 0.1, -TILE * 0.07, TILE * 0.72, TILE * 0.14);
  ctx.restore();
  // 状态灯
  ctx.fillStyle = e.shells > 0 ? '#d0a84a' : '#555';
  ctx.fillRect(px + wpx - 20, py + 8, 8, 8);
  ctx.restore();
}
function tankPanelHtml(e) {
  let h = row('煤燃料', e.fuelCoal > 0 ? (e.fuelCoal + ' / ' + TANK_FUEL_CAP) : '<span class="dim">空</span>', 'fuel');
  h += row('炮弹', e.shells > 0 ? (e.shells + ' / ' + TANK_SHELL_CAP) : '<span class="dim">无</span>', 'shell');
  const cf = Math.min(invCount('coal'), TANK_FUEL_CAP - e.fuelCoal);
  const cs = Math.min(invCount('cannon-shell'), TANK_SHELL_CAP - e.shells);
  if (cf > 0) h += '<button data-action="feed" data-id="coal">放入煤 ×' + cf + '</button>';
  if (cs > 0) h += '<button data-action="feed" data-id="cannon-shell">装填炮弹 ×' + cs + '</button>';
  h += '<div class="status"></div>';
  h += '<button data-action="drive" class="primary">🚀 进入驾驶（空格开炮）</button>';
  h += '<div class="dim">坦克：重型战斗载具，装甲更厚（驾驶时受伤减少），按空格向光标方向发射炮弹（范围爆炸）。需高级战斗科技。</div>';
  return h;
}
function tankPanelLive(e, api) {
  api.set('fuel', e.fuelCoal > 0 ? (e.fuelCoal + ' / ' + TANK_FUEL_CAP) : dimSpan('空'));
  api.set('shell', e.shells > 0 ? (e.shells + ' / ' + TANK_SHELL_CAP) : dimSpan('无'));
  const cf = Math.min(invCount('coal'), TANK_FUEL_CAP - e.fuelCoal);
  const cs = Math.min(invCount('cannon-shell'), TANK_SHELL_CAP - e.shells);
  api.toggle('button[data-action="feed"][data-id="coal"]', cf > 0, '放入煤 ×' + cf);
  api.toggle('button[data-action="feed"][data-id="cannon-shell"]', cs > 0, '装填炮弹 ×' + cs);
  if (G.driving && G.driving.ent === e) api.status('驾驶中（空格开炮，E 下车）', 'ok');
  else if (e.fuelCoal <= 0) api.status('缺燃料：放入煤后可驾驶', 'warn');
  else api.status('可驾驶', 'ok');
}
function tankTip(e) {
  if (G.driving && G.driving.ent === e) return '坦克驾驶中（空格开炮，E 下车）';
  return '坦克（煤 ' + (e.fuelCoal || 0) + ' · 炮弹 ' + (e.shells || 0) + '），按 E 进入驾驶';
}
function tankOnAction(act) {
  if (act === 'drive') {
    const t = G.panelEnt;
    if (t instanceof Tank) { enterCar(t); return true; }
  }
  return false;
}

// ===== 注册 =====
ENT_CLASSES['tank'] = Tank;
DEVICE_RENDER['tank'] = drawTank;
DEVICE_PANEL['tank'] = { html: tankPanelHtml, live: tankPanelLive, tip: tankTip, onAction: tankOnAction };
DEVICE_DIR_ROTATE['tank'] = true;
