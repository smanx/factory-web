'use strict';

// ===== 终局防御体系：地雷 + 炮兵连（对齐《异星工厂》Landmine / Artillery turret）=====

// ===== 地雷（Landmine，占地 1×1）=====
// 铺设在地面，敌人踏入触发半径即爆炸，造成范围伤害并自行销毁。
// 玩家可安全行走，不会误触（避免误伤）。
const LANDMINE_TRIGGER = 0.8;   // 触发半径（格）
const LANDMINE_DMG = 60;        // 爆炸伤害
const LANDMINE_RADIUS = 2.5;    // 爆炸范围（格）
class LandMine extends Entity {
  constructor(type, x, y) { super('land-mine', x, y); this.armed = true; }
  update(dt) {
    if (!this.armed) return;
    const cx = (this.x + 0.5) * TILE, cy = (this.y + 0.5) * TILE;
    for (const en of (G.enemies || [])) {
      if (en.dead) continue;
      if (Math.hypot(en.x - cx, en.y - cy) <= LANDMINE_TRIGGER * TILE) {
        // 引爆：范围伤害敌人
        explodeDamage(cx, cy, LANDMINE_RADIUS, Math.round(LANDMINE_DMG * (typeof weaponCategoryMult === 'function' ? weaponCategoryMult('explosives') : 1)));
        // 爆炸特效
        (G.bullets || (G.bullets = [])).push({
          x: cx, y: cy, tx: cx, ty: cy, t: 0, life: 0.3, boom: true
        });
        this.armed = false;
        if (typeof playSfx === 'function') playSfx('landmine');
        removeEnt(this);   // 一次性消耗
        return;
      }
    }
  }
  powerDemand() { return 0; }
  serialize() { return super.serialize(); }
  static restore(s) { const m = super.restore(s); m.armed = !!s.armed; return m; }
}
function drawLandMine(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  ctx.globalAlpha = alpha;
  // 地面轮廓（几乎与地形融为一体，但保留一点可辨识度）
  ctx.fillStyle = 'rgba(120,100,70,.55)';
  ctx.beginPath();
  ctx.arc(px + TILE / 2, py + TILE / 2, 9, 0, 7); ctx.fill();
  ctx.strokeStyle = 'rgba(60,50,35,.6)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(px + TILE / 2, py + TILE / 2, 9, 0, 7); ctx.stroke();
  // 顶部引信小凸起
  ctx.fillStyle = '#5a4a3a';
  ctx.beginPath();
  ctx.arc(px + TILE / 2, py + TILE / 2, 3, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;
}
function landMinePanelHtml() {
  return '<div class="dim">地雷：铺设在地面，敌人踏入后爆炸造成 ' + LANDMINE_DMG + ' 点范围伤害并自行销毁。玩家自身可安全通过（1×1）。</div><div class="status"></div>';
}
function landMinePanelLive(e, api) { api.status('已布设，等待敌人踏入', 'ok'); }
function landMineTip() { return '地雷：敌人踏入时爆炸'; }

// ===== 炮兵连（Artillery turret，占地 4×4）=====
// 超远程防御建筑：消耗炮弹（artillery-shell）轰击视野极远处的敌人，
// 命中造成超大范围爆炸伤害，是晚期基地防御的利器。
const ARTILLERY_RANGE = 60;      // 基础射程（格），远超普通炮塔；受「炮兵射程」无限科技加成
// 当前有效射程（对齐《异星工厂》Artillery shell range：炮兵射程无限科技每级 +30%）
function artilleryRange() { return Math.round(ARTILLERY_RANGE * (typeof artilleryRangeMult === 'function' ? artilleryRangeMult() : 1)); }
const ARTILLERY_FIRE_RATE = 3;   // 两次射击间隔（秒）
const ARTILLERY_DMG = 200;       // 爆炸伤害
const ARTILLERY_RADIUS = 5;      // 爆炸范围（格）
const ARTILLERY_SHELL_CAP = 40;  // 内置炮弹容量

// ===== 手动炮兵瞄准（对齐《异星工厂》Artillery targeting remote）=====
// 手持重炮瞄准遥控器点击地图任意位置：优先锁定落点附近最近的敌人，否则直接轰击落点；
// 选择最近的炮兵连（artillery-turret）或炮兵车厢（artillery-wagon，含炮弹者）开火。
function fireArtilleryShellAt(tx, ty) {
  const range = artilleryRange();
  const tpx = tx * TILE + TILE / 2, tpy = ty * TILE + TILE / 2;
  // 1) 确定目标：落点附近（5 格内）最近敌人，否则直接落点
  let target = null, bestD = Infinity;
  for (const en of (G.enemies || [])) {
    if (!en || en.dead) continue;
    const d = Math.hypot(en.x - tpx, en.y - tpy);
    if (d < bestD) { bestD = d; target = en; }
  }
  const aimX = target ? target.x : tpx, aimY = target ? target.y : tpy;
  // 2) 找到最近的炮兵源（炮兵连 / 炮兵车厢），需有炮弹且在射程内
  let src = null, srcD = Infinity;
  const addSrc = (ex, ey, e) => {
    const d = Math.hypot((ex) * TILE - tpx, (ey) * TILE - tpy);
    if (d <= range * TILE && d < srcD) { srcD = d; src = e; }
  };
  for (const e of (G.ents || [])) {
    if (e._dead) continue;
    if (e.type === 'artillery-turret' && e.shells > 0) addSrc(e.x + e.w / 2, e.y + e.h / 2, e);
  }
  for (const tr of (G.trains || [])) {
    for (const car of tr.cars) {
      if (car instanceof ArtilleryWagon && (car.shells || 0) > 0) addSrc(car.x + car.w / 2, car.y + car.h / 2, car);
    }
  }
  if (!src) { if (typeof toast === 'function') toast('手动炮兵：没有可用的炮兵连/炮兵车厢（需有炮弹）'); return false; }
  // 3) 开火
  const cx = (src.x + src.w / 2), cy = (src.y + src.h / 2);
  if (src instanceof ArtilleryWagon) { src.shells--; }
  else if (typeof src.takeItemOf === 'function') { src.takeItemOf('artillery-shell'); }
  src.facing = Math.atan2(aimY - cy * TILE, aimX - cx * TILE);
  if (typeof playSfx === 'function') playSfx('artillery');
  (G.bullets || (G.bullets = [])).push({
    x: cx * TILE, y: cy * TILE, tx: aimX, ty: aimY, t: 0,
    life: Math.max(0.3, srcD / 40), art: true, splash: ARTILLERY_RADIUS,
    dmg: Math.round(ARTILLERY_DMG * (typeof weaponDamageMult === 'function' ? weaponDamageMult() : 1) * (typeof weaponCategoryMult === 'function' ? weaponCategoryMult('explosives') : 1))
  });
  if (typeof toast === 'function') toast('🎯 手动炮兵：轰击 (' + tx + ',' + ty + ')' + (target ? ' 已锁定附近敌人' : ''));
  return true;
}
class ArtilleryTurret extends CircuitNode {
  constructor(type, x, y) {
    super('artillery-turret', x, y);
    this.shells = 0;
    this.cooldown = 0;
    this.target = null;
    this.facing = 0;
    // 电路控制（对齐《异星工厂》：炮兵接入电路网络，可按信号启停火力）
    this.circuitCond = { enabled: false, channel: 'red', sig: 'iron-plate', op: '>', count: 1 };
  }
  // 电路启停：未启用条件时恒工作；启用后仅当附近电路信号满足条件才开火
  circuitEnabled() {
    if (!this.circuitCond || !this.circuitCond.enabled) return true;
    const sig = circuitSignalNear(this);
    return circuitCondOk(sig, this.circuitCond);
  }
  // 射程内存活敌人数量（作为传感器信号输出到电路网络）
  enemiesInRange() {
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    const enemies = G._aliveEnemies || (G.enemies || []);
    let n = 0;
    for (const en of enemies) {
      if (!en || en.dead) continue;
      const d = Math.hypot(en.x / TILE - cx, en.y / TILE - cy);
      if (d <= artilleryRange() && d > 4) n++;
    }
    return n;
  }
  outputCircuitSignals() {
    const n = this.enemiesInRange();
    if (n <= 0) return [];
    return [{ sig: 'signal-enemy', count: n }];
  }
  giveItem(item) {
    if (item === 'artillery-shell' && this.shells < ARTILLERY_SHELL_CAP) { this.shells++; return true; }
    return false;
  }
  takeItem() { return this.shells > 0 ? this.takeItemOf('artillery-shell') : null; }
  peekItem() { return this.shells > 0 ? 'artillery-shell' : null; }
  countOf(item) { return item === 'artillery-shell' ? this.shells : 0; }
  takeItemOf(item) {
    if (item === 'artillery-shell' && this.shells > 0) { this.shells--; return item; }
    return null;
  }
  contents() {
    const list = [[this.type, 1]];
    if (this.shells > 0) list.push(['artillery-shell', this.shells]);
    return list;
  }
  takeAll() {
    const rows = [];
    if (this.shells > 0) rows.push(['artillery-shell', this.shells]);
    this.shells = 0;
    return rows;
  }
  powerDemand() { return 0; }
  update(dt) {
    this.cooldown -= dt;
    this.target = null;
    // 电路条件不满足时炮兵停火
    if (!this.circuitEnabled()) return;
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    let best = null, bestD = Infinity;
    for (const en of (G.enemies || [])) {
      if (!en || en.dead) continue;
      const d = Math.hypot(en.x / TILE - cx, en.y / TILE - cy);
      if (d <= artilleryRange() && d > 4 && d < bestD) { best = en; bestD = d; }
    }
    if (!best) return;
    this.target = best;
    this.facing = Math.atan2(best.y - cy * TILE, best.x - cx * TILE);
    if (this.shells <= 0 || this.cooldown > 0) return;
    // 炮兵炮弹射击速度无限科技：射速提升 → 射击间隔缩短
    this.cooldown = ARTILLERY_FIRE_RATE / (typeof artilleryShootingSpeedMult === 'function' ? artilleryShootingSpeedMult() : 1);
    this.shells--;
    if (typeof playSfx === 'function') playSfx('artillery');
    // 炮弹出膛：以抛物弹道飞向目标（借用 bullet 系统，落地爆炸）
    (G.bullets || (G.bullets = [])).push({
      x: cx * TILE, y: cy * TILE, tx: best.x, ty: best.y, t: 0,
      life: Math.max(0.3, bestD / 40), art: true, splash: ARTILLERY_RADIUS, dmg: Math.round(ARTILLERY_DMG * (typeof weaponDamageMult === 'function' ? weaponDamageMult() : 1) * (typeof weaponCategoryMult === 'function' ? weaponCategoryMult('explosives') : 1))
    });
  }
  serialize() { const s = super.serialize(); s.shells = this.shells; if (this.circuitCond) s.circuitCond = this.circuitCond; return s; }
  static restore(s) { const t = super.restore(s); t.shells = s.shells || 0; t.circuitCond = s.circuitCond || { enabled: false, channel: 'red', sig: 'iron-plate', op: '>', count: 1 }; return t; }
}
function drawArtillery(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const w = TILE * e.w, h = TILE * e.h;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#5a4a42';
  rr(ctx, px + 2, py + 2, w - 4, h - 4, 6); ctx.fill();
  ctx.strokeStyle = '#3a2f2a';
  ctx.lineWidth = 3;
  rr(ctx, px + 2, py + 2, w - 4, h - 4, 6); ctx.stroke();
  const cx = px + w / 2, cy = py + h / 2;
  // 底座转盘
  ctx.fillStyle = '#4a3d35';
  ctx.beginPath(); ctx.arc(cx, cy, 22, 0, 7); ctx.fill();
  ctx.strokeStyle = '#2e2620';
  ctx.lineWidth = 2; ctx.stroke();
  // 炮管（朝向目标，极长）
  const ang = e.target ? e.facing : ((dir * Math.PI) / 2);
  ctx.strokeStyle = '#3a3028';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(ang) * 10, cy + Math.sin(ang) * 10);
  ctx.lineTo(cx + Math.cos(ang) * 46, cy + Math.sin(ang) * 46);
  ctx.stroke();
  ctx.lineCap = 'butt';
  // 炮弹余量
  if (e.shells > 0) {
    ctx.fillStyle = '#ffd23c';
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(e.shells, cx, cy + 30);
  }
  ctx.globalAlpha = 1;
}
function artilleryPanelHtml(e) {
  let h = row('炮弹', e.shells + ' / ' + ARTILLERY_SHELL_CAP, 'shells');
  const n = invCount('artillery-shell');
  if (n > 0) h += '<button data-action="feed" data-id="artillery-shell">放入炮弹 ×' + n + '</button>';
  if (e.shells > 0) h += '<button data-action="takeout" id="btn-art-takeout">取出全部炮弹</button>';
  h += '<div class="status"></div>';
  h += '<div class="dim">炮兵连：射程 ' + artilleryRange() + ' 格（基础 ' + ARTILLERY_RANGE + '，受「炮兵射程」无限科技加成），消耗炮弹轰击超远距离敌人，命中造成 ' + ARTILLERY_DMG + ' 点大范围爆炸伤害（3×3）。晚期基地防御的利器。</div>';
  h += circuitPanelHtml(e, 'at');
  return h;
}
function artilleryPanelLive(e, api) {
  api.set('shells', e.shells + ' / ' + ARTILLERY_SHELL_CAP);
  api.toggle('#btn-art-takeout', e.shells > 0, '取出全部炮弹 (' + e.shells + ')');
  if (e.circuitCond && e.circuitCond.enabled && !e.circuitEnabled()) { api.status('已停火：电路条件不满足', 'warn'); return; }
  if (e.shells <= 0) api.status('已暂停：无炮弹（放入炮弹）', 'warn');
  else if (e.target) api.status('开火中：轰击远处敌人', 'ok');
  else api.status('待机：射程内无敌人', 'ok');
}
function artilleryTip(e) {
  if (e.shells <= 0) return '无炮弹，需放入炮弹';
  return e.target ? '轰击远处敌人' : '待机（炮弹 ×' + e.shells + '）';
}

// ===== 注册 =====
ENT_CLASSES['land-mine'] = LandMine;
ENT_CLASSES['artillery-turret'] = ArtilleryTurret;
DEVICE_RENDER['land-mine'] = drawLandMine;
DEVICE_DIR_ROTATE['land-mine'] = true; // 支持旋转
DEVICE_RENDER['artillery-turret'] = drawArtillery;
DEVICE_DIR_ROTATE['artillery-turret'] = true; // 支持旋转
DEVICE_STATUS['land-mine'] = () => null;
DEVICE_STATUS['artillery-turret'] = e => e.shells > 0 ? (e.target ? 'g' : 'y') : 'r';
DEVICE_PANEL['land-mine'] = { html: landMinePanelHtml, live: landMinePanelLive, tip: landMineTip };
DEVICE_PANEL['artillery-turret'] = { html: artilleryPanelHtml, live: artilleryPanelLive, tip: artilleryTip, onAction: (a) => circuitPanelAction('at', a) };
