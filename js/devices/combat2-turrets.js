'use strict';

// ===== 激光炮塔 =====
// 吃电力、无需弹药、射程更远（对齐《异星工厂》Laser turret）
const LASER_RANGE = GAME_DATA.turret?.['laser-turret']?.range ?? 9;       // 射程（格，官方 attack_parameters.range 24）
const LASER_FIRE_RATE = GAME_DATA.turret?.['laser-turret']?.fireRate ?? 0.35; // 两次射击间隔（秒，官方 cooldown 40tick=0.667s）
const LASER_DMG = 14;
class LaserTurret extends CircuitNode {
  constructor(type, x, y) {
    super('laser-turret', x, y);
    this.cooldown = 0;
    this.target = null;
    this.facing = 0;
    this.beamT = 0;
    // 电路控制（对齐《异星工厂》：炮塔接入电路网络，可按信号启停火力）
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
      if (d <= LASER_RANGE) n++;
    }
    return n;
  }
  outputCircuitSignals() {
    const n = this.enemiesInRange();
    if (n <= 0) return [];
    return [{ sig: 'signal-enemy', count: n }];
  }
  update(dt) {
    this.cooldown -= dt;
    this.beamT = Math.max(0, this.beamT - dt);
    this.target = null;
    if (G.power.sat <= 0) return;
    // 电路条件不满足时炮塔停火
    if (!this.circuitEnabled()) return;
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    let best = null, bestD = Infinity;
    // 性能优化：复用主循环每帧缓存的存活敌人列表（_aliveEnemies），避免重复 dead 判断遍历全数组
    const enemies = G._aliveEnemies || (G.enemies || []);
    for (const en of enemies) {
      if (!en || en.dead) continue;
      const ex = en.x / TILE, ey = en.y / TILE;
      const d = Math.hypot(ex - cx, ey - cy);
      if (d <= LASER_RANGE && d < bestD) { best = en; bestD = d; }
    }
    if (!best) return;
    this.target = best;
    this.facing = Math.atan2(best.y - (this.y + this.h / 2) * TILE, best.x - (this.x + this.w / 2) * TILE);
    if (this.cooldown > 0) return;
    this.cooldown = LASER_FIRE_RATE;
    best.hp -= Math.round(LASER_DMG * (typeof weaponDamageMult === 'function' ? weaponDamageMult() : 1) * (typeof weaponCategoryMult === 'function' ? weaponCategoryMult('energy') : 1));
    this.beamT = 0.15;
    (G.bullets || (G.bullets = [])).push({
      x: (this.x + this.w / 2) * TILE, y: (this.y + this.h / 2) * TILE,
      tx: best.x, ty: best.y, t: 0, life: 0.1, dmg: 0, kind: 'laser'
    });
    if (typeof playSfx === 'function') playSfx('laser');
    if (best.hp <= 0) best.dead = true;
  }
  powerDemand() { return 180; }
  serialize() { const s = super.serialize(); if (this.circuitCond) s.circuitCond = this.circuitCond; return s; }
  static restore(s) { const e = super.restore(s); e.circuitCond = s.circuitCond || { enabled: false, channel: 'red', sig: 'iron-plate', op: '>', count: 1 }; return e; }
}
function drawLaserTurret(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#5a4a6a';
  rr(ctx, px + 4, py + 4, s - 8, s - 8, 10); ctx.fill();
  ctx.strokeStyle = '#3a3044';
  ctx.lineWidth = 3;
  rr(ctx, px + 4, py + 4, s - 8, s - 8, 10); ctx.stroke();
  const cx = px + s / 2, cy = py + s / 2;
  // 旋转炮头
  const ang = e.target ? e.facing : -Math.PI / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  ctx.fillStyle = '#d04a5a';
  ctx.fillRect(-7, -7, 14, 14);
  ctx.fillStyle = '#e87888';
  ctx.fillRect(4, -4, 20, 8);
  ctx.restore();
  // 激光光束
  if (e.beamT > 0 && e.target) {
    ctx.strokeStyle = 'rgba(255,60,80,' + (e.beamT / 0.15).toFixed(2) + ')';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(e.target.x, e.target.y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
function laserTurretPanelHtml(e) {
  let h = row('电力', powerStatusLiveHtml(e), 'power');
  h += '<div class="status"></div>';
  h += '<div class="dim">激光炮塔：吃电力自动发射激光攻击射程内（' + LASER_RANGE + ' 格）敌人，无需弹药，伤害高于机枪。供电不足时停止开火。配合石墙构筑防线（2×2）。</div>';
  h += circuitPanelHtml(e, 'lt');
  return h;
}
function laserTurretPanelLive(e, api) {
  api.set('power', powerStatusLiveHtml(e));
  if (e.circuitCond && e.circuitCond.enabled && !e.circuitEnabled()) { api.status('已停火：电路条件不满足', 'warn'); return; }
  if (G.power.sat <= 0) api.status('已暂停：缺电', 'warn');
  else if (e.target) api.status('开火中：激光攻击敌人', 'ok');
  else api.status('待机：射程内无敌人', 'ok');
}
function laserTurretTip(e) {
  return e.target ? '开火中（激光）' : (G.power.sat <= 0 ? '缺电停摆' : '待机（无需弹药）');
}

// ===== 火焰炮塔 =====
// 喷射火焰造成持续灼烧，消耗石油气，范围杀伤（对齐《异星工厂》Flamethrower turret）
const FT_RANGE = GAME_DATA.turret?.['flamethrower-turret']?.range ?? 6;   // 射程（格，官方 attack_parameters.range 30）
const FT_FIRE_RATE = GAME_DATA.turret?.['flamethrower-turret']?.fireRate ?? 0.3; // 两次喷射间隔（秒，官方 cooldown 4tick=0.067s）
const FT_DMG = 8;
const FT_FLUID_CAP = 200;
class FlamethrowerTurret extends CircuitNode {
  constructor(type, x, y) {
    super('flamethrower-turret', x, y);
    this.fluid = {};       // { 'light-oil': n }（对齐《异星工厂》：火焰炮塔以轻油为燃料）
    this.cooldown = 0;
    this.target = null;
    this.facing = 0;
    // 电路控制（对齐《异星工厂》：炮塔接入电路网络，可按信号启停火力）
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
      if (d <= FT_RANGE) n++;
    }
    return n;
  }
  outputCircuitSignals() {
    const n = this.enemiesInRange();
    if (n <= 0) return [];
    return [{ sig: 'signal-enemy', count: n }];
  }
  giveItem(item) {
    if (item === 'light-oil') {
      if ((this.fluid['light-oil'] || 0) >= FT_FLUID_CAP) return false;
      this.fluid['light-oil'] = (this.fluid['light-oil'] || 0) + 1;
      return true;
    }
    return false;
  }
  takeItem() { return null; }
  countOf(item) { return this.fluid[item] || 0; }
  takeItemOf(item) {
    if ((this.fluid[item] || 0) > 0) { this.fluid[item]--; if (this.fluid[item] <= 0) delete this.fluid[item]; return item; }
    return null;
  }
  contents() { return [[this.type, 1]].concat(Object.keys(this.fluid).map(k => [k, this.fluid[k]])); }
  fluidPort() {
    // 底部(南)一格接轻油（对齐《异星工厂》：火焰炮塔以轻油为燃料）
    const n = neighborOnSideCell(this, (1 + (this.dir | 0)) % 4, 0);
    if (n instanceof Pipe && n.fluid['light-oil'] > 0 && (this.fluid['light-oil'] || 0) < FT_FLUID_CAP && n.takeItemOf('light-oil')) {
      this.fluid['light-oil'] = (this.fluid['light-oil'] || 0) + 1;
    }
  }
  update(dt) {
    this.cooldown -= dt;
    this.target = null;
    this.fluidPort();
    if (G.power.sat <= 0) return;
    if ((this.fluid['light-oil'] || 0) <= 0) return;
    // 电路条件不满足时炮塔停火
    if (!this.circuitEnabled()) return;
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    let best = null, bestD = Infinity;
    // 性能优化：复用主循环每帧缓存的存活敌人列表（_aliveEnemies）
    const enemies = G._aliveEnemies || (G.enemies || []);
    for (const en of enemies) {
      if (!en || en.dead) continue;
      const ex = en.x / TILE, ey = en.y / TILE;
      const d = Math.hypot(ex - cx, ey - cy);
      if (d <= FT_RANGE && d < bestD) { best = en; bestD = d; }
    }
    if (!best) return;
    this.target = best;
    this.facing = Math.atan2(best.y - (this.y + this.h / 2) * TILE, best.x - (this.x + this.w / 2) * TILE);
    if (this.cooldown > 0) return;
    this.cooldown = FT_FIRE_RATE;
    this.fluid['light-oil']--;
    if (this.fluid['light-oil'] <= 0) delete this.fluid['light-oil'];
    // 喷射火焰覆盖锥形范围
    const ang = this.facing;
    for (const en of enemies) {
      if (en.dead) continue;
      const dx = en.x - (this.x + this.w / 2) * TILE, dy = en.y - (this.y + this.h / 2) * TILE;
      const d = Math.hypot(dx, dy);
      if (d > FT_RANGE * TILE) continue;
      const da = Math.abs(normAng(Math.atan2(dy, dx) - ang));
      if (da < 0.5) { en.hp -= Math.round(FT_DMG * (typeof weaponDamageMult === 'function' ? weaponDamageMult() : 1) * (typeof weaponCategoryMult === 'function' ? weaponCategoryMult('fire') : 1)); if (en.hp <= 0) en.dead = true; }
    }
    (G.bullets || (G.bullets = [])).push({
      x: (this.x + this.w / 2) * TILE, y: (this.y + this.h / 2) * TILE,
      tx: best.x, ty: best.y, t: 0, life: 0.3, dmg: 0, kind: 'flame'
    });
    // 火焰落地后在地面残留燃烧火场（对齐《异星工厂》Fire entity）
    if (typeof spawnGroundFire === 'function') spawnGroundFire(best.x, best.y);
    if (typeof playSfx === 'function') playSfx('flamethrower');
  }
  powerDemand() { return 200; }
  serialize() { const s = super.serialize(); s.fluid = this.fluid; if (this.circuitCond) s.circuitCond = this.circuitCond; return s; }
  static restore(s) {
    const t = super.restore(s);
    t.fluid = s.fluid || {};
    t.circuitCond = s.circuitCond || { enabled: false, channel: 'red', sig: 'iron-plate', op: '>', count: 1 };
    // 迁移旧存档：旧版火焰炮塔以石油气为燃料，读档时丢弃残留的石油气，避免遗留旧流体
    if (t.fluid['petroleum-gas']) delete t.fluid['petroleum-gas'];
    return t;
  }
}
function normAng(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
function drawFlamethrowerTurret(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w, sh = TILE * e.h;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#6a4a3a';
  rr(ctx, px + 4, py + 4, s - 8, sh - 8, 8); ctx.fill();
  ctx.strokeStyle = '#463028';
  ctx.lineWidth = 3;
  rr(ctx, px + 4, py + 4, s - 8, sh - 8, 8); ctx.stroke();
  const cx = px + s / 2, cy = py + sh / 2;
  const ang = e.target ? e.facing : -Math.PI / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  ctx.fillStyle = '#a05a2a';
  ctx.fillRect(-7, -4, 24, 8);
  ctx.fillStyle = '#d07a2a';
  ctx.fillRect(16, -3, 8, 6);
  ctx.restore();
  // 喷射火焰特效
  if (e.target && G.time % 0.1 < 0.05) {
    ctx.fillStyle = 'rgba(255,140,40,.5)';
    ctx.beginPath();
    ctx.arc(e.target.x, e.target.y, 8 + Math.random() * 5, 0, 7);
    ctx.fill();
  }
  const fl = (e.fluid && e.fluid['light-oil']) || 0;
  if (fl > 0) {
    // 轻油余量：橙色小点 + 数字（不再显示中文“油”）
    ctx.fillStyle = '#d0a04a';
    ctx.beginPath(); ctx.arc(cx - 6, cy + 22, 3, 0, 7); ctx.fill();
    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(String(fl), cx, cy + 22);
  }
  ctx.globalAlpha = 1;
}
function flameTurretPanelHtml(e) {
  let h = row('轻油', (e.fluid['light-oil'] || 0) > 0 ? ((e.fluid['light-oil'] || 0) + ' 单位') : '<span class="dim">空</span>', 'fluid');
  const n = Math.min(invCount('light-oil'), FT_FLUID_CAP - (e.fluid['light-oil'] || 0));
  if (n > 0) h += '<button data-action="feed" data-id="light-oil">放入轻油 ×' + n + '</button>';
  h += '<div class="status"></div>';
  h += '<div class="dim">火焰炮塔：消耗轻油喷射火焰，对锥形范围敌人造成持续灼烧伤害。可从底部输入口相邻管道自动吸入轻油（2×3）。对齐《异星工厂》Flamethrower turret：以轻油为燃料。</div>';
  h += circuitPanelHtml(e, 'ft');
  return h;
}
function flameTurretPanelLive(e, api) {
  api.set('fluid', (e.fluid['light-oil'] || 0) > 0 ? ((e.fluid['light-oil'] || 0) + ' 单位') : dimSpan('空'));
  const fl = e.fluid['light-oil'] || 0;
  if (e.circuitCond && e.circuitCond.enabled && !e.circuitEnabled()) { api.status('已停火：电路条件不满足', 'warn'); return; }
  if (G.power.sat <= 0) api.status('已暂停：缺电', 'warn');
  else if (fl <= 0) api.status('已暂停：缺轻油（管道或按钮放入）', 'warn');
  else if (e.target) api.status('喷射中：灼烧敌人', 'ok');
  else api.status('待机：射程内无敌人', 'ok');
}
function flameTurretTip(e) {
  if (G.power.sat <= 0) return '缺电停摆';
  if ((e.fluid['light-oil'] || 0) <= 0) return '缺轻油';
  return e.target ? '喷射中（火焰）' : '待机';
}

// ===== 地面火焰残留（燃烧火场，对齐《异星工厂》Fire entity）=====
// 火焰炮塔/火焰喷射器/喷火虫/火球命中后会在命中地面留下燃烧火场（按瓦片记），
// 火场内敌人/玩家持续受灼烧伤害，数秒后火焰自然熄灭。
// G.groundFires: [{ tx, ty, life, maxLife, tickT }]（同一瓦片只保留一个，新火刷新余焰）
function ensureGroundFires() { if (!G.groundFires) G.groundFires = []; return G.groundFires; }

const GROUND_FIRE_LIFE = 4.0;      // 单片火焰持续秒数
const GROUND_FIRE_MAX = 120;       // 全图火焰瓦片上限（防爆量）
const GROUND_FIRE_DMG = 9;         // 每 tick 灼烧伤害
const GROUND_FIRE_TICK = 0.5;      // 灼烧 tick 间隔（秒）

// 在世界坐标 wx,wy 所在瓦片生成/刷新地面火焰
function spawnGroundFire(wx, wy) {
  const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
  const arr = ensureGroundFires();
  for (const f of arr) {
    if (f.tx === tx && f.ty === ty) { f.life = GROUND_FIRE_LIFE; return; }  // 已有火焰：刷新余焰
  }
  if (arr.length >= GROUND_FIRE_MAX) return;
  arr.push({ tx, ty, life: GROUND_FIRE_LIFE, maxLife: GROUND_FIRE_LIFE, tickT: 0 });
}

// 每帧更新地面火焰：计时、对站上火焰的敌人/玩家造成灼烧
function updateGroundFires(dt) {
  const arr = G.groundFires;
  if (!arr || arr.length === 0) return;
  for (const f of arr) {
    f.life -= dt;
    if (f.life <= 0) continue;
    // 火焰中心世界坐标
    const cx = f.tx * TILE + TILE / 2, cy = f.ty * TILE + TILE / 2;
    // 周期性灼烧范围内的敌人（含巢穴，但巢穴不受火焰灼烧）
    f.tickT -= dt;
    if (f.tickT <= 0) {
      f.tickT = GROUND_FIRE_TICK;
      // 性能优化：复用主循环缓存的存活敌人列表（G._aliveEnemies），避免全量遍历含已死敌人
      const _alive = G._aliveEnemies || (G.enemies || EMPTY_ARR);
      for (let i = 0; i < _alive.length; i++) {
        const en = _alive[i];
        if (!en || en.dead || en.type === 'spawner') continue;
        // 性能优化：平方距离比较
        { const _fx = en.x - cx, _fy = en.y - cy, _fr = TILE * 1.15; if (_fx*_fx + _fy*_fy <= _fr*_fr) { en.hp -= Math.round(GROUND_FIRE_DMG * (typeof weaponCategoryMult === 'function' ? weaponCategoryMult('fire') : 1)); if (en.hp <= 0) en.dead = true; } }
      }
      // 玩家站在火焰上也受灼烧
      if (G.settings.combat) { const _fp = G.player; const _fx2 = _fp.x - cx, _fy2 = _fp.y - cy, _fr2 = TILE * 1.1; if (_fx2*_fx2 + _fy2*_fy2 <= _fr2*_fr2) damagePlayer(GROUND_FIRE_DMG * 0.6); }
    }
    // 火焰燃烧时冒出零星火星/余烬（低频，避免爆量）
    if (Math.random() < 0.25 && typeof spawnSmoke === 'function') {
      spawnSmoke(cx + (Math.random() - 0.5) * TILE * 0.5, cy + (Math.random() - 0.5) * TILE * 0.4, { life: 0.8, size: 3, color: '#3a3a3a', vx: (Math.random() - 0.5) * 0.3, vy: -(0.6 + Math.random() * 0.4) });
    }
  }
  // 清理熄灭的火焰
  G.groundFires = compactFilter(arr, f => f.life > 0);
  // 有火焰燃烧时播放低频烈焰声（限频，避免音爆）
  if (G.groundFires.length > 0 && typeof playSfx === 'function') {
    G.burnSfxT = (G.burnSfxT || 0) - dt;
    if (G.burnSfxT <= 0) { G.burnSfxT = 0.9; playSfx('burn'); }
  }
}

// ===== 喷吐虫酸液洼地（对齐《异星工厂》：Spitter 远程酸液在落点形成酸液坑，对范围内持续伤害） =====
// G.acidPools: [{ tx, ty, life, maxLife, tickT }]（同一瓦片只保留一个，新酸刷新）
function ensureAcidPools() { if (!G.acidPools) G.acidPools = []; return G.acidPools; }

const ACID_POOL_LIFE = 6.0;     // 单片酸液持续秒数
const ACID_POOL_MAX = 120;      // 全图酸液瓦片上限（防爆量）
const ACID_POOL_DMG = 7;        // 每 tick 腐蚀伤害
const ACID_POOL_TICK = 0.5;     // 腐蚀 tick 间隔（秒）

// 在世界坐标 wx,wy 所在瓦片生成/刷新酸液洼地（仅喷吐虫的酸液会留下）
function spawnAcidPool(wx, wy) {
  const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
  const arr = ensureAcidPools();
  for (const f of arr) {
    if (f.tx === tx && f.ty === ty) { f.life = ACID_POOL_LIFE; return; }  // 已有酸液：刷新时长
  }
  if (arr.length >= ACID_POOL_MAX) return;
  arr.push({ tx, ty, life: ACID_POOL_LIFE, maxLife: ACID_POOL_LIFE, tickT: 0 });
}

// 每帧更新酸液洼地：计时、对站上的敌人（酸液也伤虫）与玩家造成腐蚀伤害
function updateAcidPools(dt) {
  const arr = G.acidPools;
  if (!arr || arr.length === 0) return;
  for (const f of arr) {
    f.life -= dt;
    if (f.life <= 0) continue;
    const cx = f.tx * TILE + TILE / 2, cy = f.ty * TILE + TILE / 2;
    f.tickT -= dt;
    if (f.tickT <= 0) {
      f.tickT = ACID_POOL_TICK;
      // 酸液对范围内的敌人持续腐蚀（含虫巢，与火焰一致）
      // 性能优化：复用主循环缓存的存活敌人列表（G._aliveEnemies），避免全量遍历含已死敌人
      const _alive = G._aliveEnemies || (G.enemies || EMPTY_ARR);
      for (let i = 0; i < _alive.length; i++) {
        const en = _alive[i];
        if (!en || en.dead) continue;
        // 性能优化：平方距离比较
        { const _ax = en.x - cx, _ay = en.y - cy, _ar = TILE * 1.15; if (_ax*_ax + _ay*_ay <= _ar*_ar) { en.hp -= ACID_POOL_DMG; if (en.hp <= 0) en.dead = true; } }
      }
      // 玩家踩中酸液也受腐蚀
      if (G.settings.combat) { const _ap = G.player; const _ax2 = _ap.x - cx, _ay2 = _ap.y - cy, _ar2 = TILE * 1.1; if (_ax2*_ax2 + _ay2*_ay2 <= _ar2*_ar2) damagePlayer(ACID_POOL_DMG * 0.6); }
    }
    // 酸液表面冒气泡（低频特效，避免爆量）
    if (Math.random() < 0.25 && typeof spawnSmoke === 'function') {
      spawnSmoke(cx + (Math.random() - 0.5) * TILE * 0.4, cy + (Math.random() - 0.5) * TILE * 0.4, { life: 0.7, size: 4, color: '#8ac04a', vx: (Math.random() - 0.5) * 0.2, vy: -(0.3 + Math.random() * 0.3) });
    }
  }
  // 清理蒸发的酸液
  G.acidPools = compactFilter(arr, f => f.life > 0);
}

// ===== 特斯拉炮塔（Space Age Tesla turret，Fulgora）=====
// 发射可连锁跳转的电弧攻击射程内多个敌人，无需弹药，吃电力（对齐《异星工厂》Tesla turret：
// 射程 30、cooldown 120tick=2s，官方 electric-turret 原型，数据来自 GAME_DATA.turret）。
const TESLA_RANGE = GAME_DATA.turret?.['tesla-turret']?.range ?? 30;
const TESLA_FIRE_RATE = GAME_DATA.turret?.['tesla-turret']?.fireRate ?? 2;
const TESLA_DMG = 30;            // 首目标电弧伤害（官方 tesla-ammo 电弧伤害，链式递减）
const TESLA_CHAIN = 5;           // 电弧最多连锁目标数
const TESLA_CHAIN_DECAY = 0.8;   // 每跳伤害衰减系数
class TeslaTurret extends CircuitNode {
  constructor(type, x, y) {
    super('tesla-turret', x, y);
    this.cooldown = 0;
    this.target = null;
    this.facing = 0;
    this.arcT = 0;
    this.arcChain = [];
    this.circuitCond = { enabled: false, channel: 'red', sig: 'iron-plate', op: '>', count: 1 };
  }
  circuitEnabled() {
    if (!this.circuitCond || !this.circuitCond.enabled) return true;
    const sig = circuitSignalNear(this);
    return circuitCondOk(sig, this.circuitCond);
  }
  enemiesInRange() {
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    const enemies = G._aliveEnemies || (G.enemies || []);
    let n = 0;
    for (const en of enemies) {
      if (!en || en.dead) continue;
      const d = Math.hypot(en.x / TILE - cx, en.y / TILE - cy);
      if (d <= TESLA_RANGE) n++;
    }
    return n;
  }
  outputCircuitSignals() {
    const n = this.enemiesInRange();
    if (n <= 0) return [];
    return [{ sig: 'signal-enemy', count: n }];
  }
  update(dt) {
    this.cooldown -= dt;
    this.arcT = Math.max(0, this.arcT - dt);
    this.target = null;
    if (G.power.sat <= 0) return;
    if (!this.circuitEnabled()) return;
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    let best = null, bestD = Infinity;
    const enemies = G._aliveEnemies || (G.enemies || []);
    for (const en of enemies) {
      if (!en || en.dead) continue;
      const ex = en.x / TILE, ey = en.y / TILE;
      const d = Math.hypot(ex - cx, ey - cy);
      if (d <= TESLA_RANGE && d < bestD) { best = en; bestD = d; }
    }
    if (!best) return;
    this.target = best;
    this.facing = Math.atan2(best.y - (this.y + this.h / 2) * TILE, best.x - (this.x + this.w / 2) * TILE);
    if (this.cooldown > 0) return;
    this.cooldown = TESLA_FIRE_RATE;
    // 电弧连锁：以首目标为起点，向射程内最近的未命中敌人逐跳跳转，伤害逐跳递减
    const chain = [];
    let cur = best;
    const hit = new Set();
    let dmg = TESLA_DMG * (typeof weaponDamageMult === 'function' ? weaponDamageMult() : 1) * (typeof weaponCategoryMult === 'function' ? weaponCategoryMult('electric') : 1);
    for (let i = 0; i < TESLA_CHAIN && cur; i++) {
      hit.add(cur);
      chain.push({ x: cur.x, y: cur.y });
      cur.hp -= Math.round(dmg);
      if (cur.hp <= 0) cur.dead = true;
      dmg *= TESLA_CHAIN_DECAY;
      // 找下一个最近的未命中敌人
      let nxt = null, nxtD = Infinity;
      for (const en of enemies) {
        if (!en || en.dead || hit.has(en)) continue;
        const d = Math.hypot(en.x - cur.x, en.y - cur.y);
        if (d <= TILE * 10 && d < nxtD) { nxt = en; nxtD = d; }
      }
      cur = nxt;
    }
    this.arcT = 0.2;
    this.arcChain = chain;
    (G.bullets || (G.bullets = [])).push({
      x: (this.x + this.w / 2) * TILE, y: (this.y + this.h / 2) * TILE,
      tx: best.x, ty: best.y, t: 0, life: 0.1, dmg: 0, kind: 'tesla'
    });
    if (typeof playSfx === 'function') playSfx('laser');
  }
  powerDemand() { return 1800; }
  serialize() { const s = super.serialize(); if (this.circuitCond) s.circuitCond = this.circuitCond; return s; }
  static restore(s) { const e = super.restore(s); e.circuitCond = s.circuitCond || { enabled: false, channel: 'red', sig: 'iron-plate', op: '>', count: 1 }; return e; }
}
function drawTeslaTurret(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#3a4a7a';
  rr(ctx, px + 4, py + 4, s - 8, s - 8, 8); ctx.fill();
  ctx.strokeStyle = '#2a3055';
  ctx.lineWidth = 3;
  rr(ctx, px + 4, py + 4, s - 8, s - 8, 8); ctx.stroke();
  const cx = px + s / 2, cy = py + s / 2;
  const ang = e.target ? e.facing : -Math.PI / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  ctx.fillStyle = '#4a8ae0';
  ctx.fillRect(-7, -7, 14, 14);
  ctx.fillStyle = '#7ab0f0';
  ctx.fillRect(4, -4, 20, 8);
  ctx.restore();
  // 特斯拉电弧（连锁跳转）
  if (e.arcT > 0 && e.arcChain && e.arcChain.length) {
    const alphaA = (e.arcT / 0.2).toFixed(2);
    ctx.lineWidth = 2;
    const pts = [{ x: cx, y: cy }].concat(e.arcChain);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      ctx.strokeStyle = 'rgba(120,170,255,' + alphaA + ')';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      // 锯齿状电弧
      const segs = 6;
      for (let j = 1; j <= segs; j++) {
        const t = j / segs;
        const mx = a.x + (b.x - a.x) * t + (Math.random() - 0.5) * 12;
        const my = a.y + (b.y - a.y) * t + (Math.random() - 0.5) * 12;
        ctx.lineTo(mx, my);
      }
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
}
function teslaTurretPanelHtml(e) {
  let h = row('电力', powerStatusLiveHtml(e), 'power');
  h += '<div class="status"></div>';
  h += '<div class="dim">特斯拉炮塔：吃电力发射可连锁跳转的电弧，攻击射程内（' + TESLA_RANGE + ' 格）最多 ' + TESLA_CHAIN + ' 个敌人，无需弹药，伤害随连锁递减。供电不足时停止开火（4×4）。</div>';
  h += circuitPanelHtml(e, 'tt');
  return h;
}
function teslaTurretPanelLive(e, api) {
  api.set('power', powerStatusLiveHtml(e));
  if (e.circuitCond && e.circuitCond.enabled && !e.circuitEnabled()) { api.status('已停火：电路条件不满足', 'warn'); return; }
  if (G.power.sat <= 0) api.status('已暂停：缺电', 'warn');
  else if (e.target) api.status('开火中：电弧连锁攻击敌人', 'ok');
  else api.status('待机：射程内无敌人', 'ok');
}
function teslaTurretTip(e) {
  return e.target ? '开火中（特斯拉电弧）' : (G.power.sat <= 0 ? '缺电停摆' : '待机（无需弹药）');
}

// ===== 注册 =====
ENT_CLASSES['laser-turret'] = LaserTurret;
ENT_CLASSES['flamethrower-turret'] = FlamethrowerTurret;
ENT_CLASSES['tesla-turret'] = TeslaTurret;
DEVICE_RENDER['laser-turret'] = drawLaserTurret;
DEVICE_RENDER['flamethrower-turret'] = drawFlamethrowerTurret;
DEVICE_RENDER['tesla-turret'] = drawTeslaTurret;
DEVICE_STATUS['laser-turret'] = e => (G.power.sat <= 0 ? 'r' : (e.target ? 'g' : 'y'));
DEVICE_STATUS['flamethrower-turret'] = e => (G.power.sat <= 0 ? 'r' : ((e.fluid['light-oil'] || 0) <= 0 ? 'r' : (e.target ? 'g' : 'y')));
DEVICE_STATUS['tesla-turret'] = e => (G.power.sat <= 0 ? 'r' : (e.target ? 'g' : 'y'));
DEVICE_PANEL['laser-turret'] = { html: laserTurretPanelHtml, live: laserTurretPanelLive, tip: laserTurretTip, onAction: (a) => circuitPanelAction('lt', a) };
DEVICE_PANEL['flamethrower-turret'] = { html: flameTurretPanelHtml, live: flameTurretPanelLive, tip: flameTurretTip, onAction: (a) => circuitPanelAction('ft', a) };
DEVICE_PANEL['tesla-turret'] = { html: teslaTurretPanelHtml, live: teslaTurretPanelLive, tip: teslaTurretTip, onAction: (a) => circuitPanelAction('tt', a) };
DEVICE_DIR_ROTATE['laser-turret'] = true;
DEVICE_DIR_ROTATE['flamethrower-turret'] = true;
DEVICE_DIR_ROTATE['tesla-turret'] = true;

// ===== 轨道炮塔（太空时代 Railgun turret，复用能量炮塔模式） =====
// 数据来自 GAME_DATA（占地 5×5 / 血量 3000，官方 Railgun turret）。
const RAILGUN_RANGE = 32;          // 射程（格）
const RAILGUN_FIRE_RATE = 1.5;     // 冷却（秒）
const RAILGUN_DMG = 300;           // 单发伤害（贯穿线伤）
class RailgunTurret extends CircuitNode {
  constructor(type, x, y) { super('railgun-turret', x, y); this.cooldown = 0; this.target = null; this.facing = 0; this.beamT = 0; this.circuitCond = { enabled: false, channel: 'red', sig: 'iron-plate', op: '>', count: 1 }; }
  circuitEnabled() { if (!this.circuitCond || !this.circuitCond.enabled) return true; return circuitCondOk(circuitSignalNear(this), this.circuitCond); }
  enemiesInRange() { const cx=this.x+this.w/2,cy=this.y+this.h/2; const es=G._aliveEnemies||(G.enemies||[]); let n=0; for(const en of es){ if(!en||en.dead)continue; if(Math.hypot(en.x/TILE-cx,en.y/TILE-cy)<=RAILGUN_RANGE)n++; } return n; }
  outputCircuitSignals() { const n=this.enemiesInRange(); return n>0?[{sig:'signal-enemy',count:n}]:[]; }
  update(dt) {
    this.cooldown-=dt; this.beamT=Math.max(0,this.beamT-dt); this.target=null;
    if(G.power.sat<=0||!this.circuitEnabled())return;
    const cx=this.x+this.w/2,cy=this.y+this.h/2; let best=null,bestD=Infinity;
    const es=G._aliveEnemies||(G.enemies||[]);
    for(const en of es){ if(!en||en.dead)continue; const d=Math.hypot(en.x/TILE-cx,en.y/TILE-cy); if(d<=RAILGUN_RANGE&&d<bestD){best=en;bestD=d;} }
    if(!best)return; this.target=best;
    this.facing=Math.atan2(best.y-(this.y+this.h/2)*TILE,best.x-(this.x+this.w/2)*TILE);
    if(this.cooldown>0)return; this.cooldown=RAILGUN_FIRE_RATE;
    // 贯穿线伤：对以炮塔为起点的方向扇形内多个敌人造成伤害
    const ang=this.facing; let dmg=RAILGUN_DMG*(typeof weaponDamageMult==='function'?weaponDamageMult():1);
    for(const en of es){ if(!en||en.dead)continue; const dx=en.x/TILE-cx,dy=en.y/TILE-cy; const d=Math.hypot(dx,dy); if(d>RAILGUN_RANGE)continue; const a=Math.atan2(dy,dx); let da=Math.abs(a-ang); if(da>Math.PI)da=2*Math.PI-da; if(da<0.35){ en.hp-=Math.round(dmg); if(en.hp<=0)en.dead=true; } }
    this.beamT=0.2; (G.bullets||(G.bullets=[])).push({x:(this.x+this.w/2)*TILE,y:(this.y+this.h/2)*TILE,tx:best.x,ty:best.y,t:0,life:0.12,dmg:0,kind:'laser'});
    if(typeof playSfx==='function')playSfx('laser');
  }
  powerDemand(){return 1000;}
  serialize(){const s=super.serialize();if(this.circuitCond)s.circuitCond=this.circuitCond;return s;}
  static restore(s){const e=super.restore(s);e.circuitCond=s.circuitCond||{enabled:false,channel:'red',sig:'iron-plate',op:'>',count:1};return e;}
}
function drawRailgunTurret(ctx,e,gx,gy,dir,alpha){
  const px=gx*TILE,py=gy*TILE,s=TILE*e.w;ctx.globalAlpha=alpha;
  ctx.fillStyle='#4a4a6a';rr(ctx,px+6,py+6,s-12,s-12,12);ctx.fill();
  ctx.strokeStyle='#30304a';ctx.lineWidth=4;rr(ctx,px+6,py+6,s-12,s-12,12);ctx.stroke();
  const cx=px+s/2,cy=py+s/2,ang=e.target?e.facing:-Math.PI/2;
  ctx.save();ctx.translate(cx,cy);ctx.rotate(ang);
  ctx.fillStyle='#7a6ad0';ctx.fillRect(-10,-10,20,20);
  ctx.fillStyle='#a89ae8';ctx.fillRect(6,-5,26,10);
  ctx.restore();
  if(e.beamT>0&&e.target){ctx.strokeStyle='rgba(140,120,255,'+(e.beamT/0.2).toFixed(2)+')';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(e.target.x,e.target.y);ctx.stroke();}
  ctx.globalAlpha=1;
}
function railgunTurretTip(e){return e.target?'开火中（轨道贯穿）':(G.power.sat<=0?'缺电停摆':'待机（吃电力，无需弹药）');}

// ===== 火箭炮塔（太空时代 Rocket turret） =====
const ROCKET_TURRET_RANGE = 26;    // 射程（格）
const ROCKET_TURRET_FIRE_RATE = 0.8; // 冷却（秒）
const ROCKET_TURRET_DMG = 120;     // 单发伤害
class RocketTurret extends CircuitNode {
  constructor(type,x,y){super('rocket-turret',x,y);this.cooldown=0;this.target=null;this.facing=0;this.beamT=0;this.circuitCond={enabled:false,channel:'red',sig:'iron-plate',op:'>',count:1};}
  circuitEnabled(){if(!this.circuitCond||!this.circuitCond.enabled)return true;return circuitCondOk(circuitSignalNear(this),this.circuitCond);}
  enemiesInRange(){const cx=this.x+this.w/2,cy=this.y+this.h/2;const es=G._aliveEnemies||(G.enemies||[]);let n=0;for(const en of es){if(!en||en.dead)continue;if(Math.hypot(en.x/TILE-cx,en.y/TILE-cy)<=ROCKET_TURRET_RANGE)n++;}return n;}
  outputCircuitSignals(){const n=this.enemiesInRange();return n>0?[{sig:'signal-enemy',count:n}]:[];}
  update(dt){
    this.cooldown-=dt;this.beamT=Math.max(0,this.beamT-dt);this.target=null;
    if(G.power.sat<=0||!this.circuitEnabled())return;
    const cx=this.x+this.w/2,cy=this.y+this.h/2;let best=null,bestD=Infinity;
    const es=G._aliveEnemies||(G.enemies||[]);
    for(const en of es){if(!en||en.dead)continue;const d=Math.hypot(en.x/TILE-cx,en.y/TILE-cy);if(d<=ROCKET_TURRET_RANGE&&d<bestD){best=en;bestD=d;}}
    if(!best)return;this.target=best;
    this.facing=Math.atan2(best.y-(this.y+this.h/2)*TILE,best.x-(this.x+this.w/2)*TILE);
    if(this.cooldown>0)return;this.cooldown=ROCKET_TURRET_FIRE_RATE;
    const dmg=Math.round(ROCKET_TURRET_DMG*(typeof weaponDamageMult==='function'?weaponDamageMult():1));
    best.hp-=dmg;this.beamT=0.15;
    (G.bullets||(G.bullets=[])).push({x:(this.x+this.w/2)*TILE,y:(this.y+this.h/2)*TILE,tx:best.x,ty:best.y,t:0,life:0.15,dmg:0,kind:'rocket'});
    if(typeof playSfx==='function')playSfx('shoot');
    if(best.hp<=0)best.dead=true;
  }
  powerDemand(){return 500;}
  serialize(){const s=super.serialize();if(this.circuitCond)s.circuitCond=this.circuitCond;return s;}
  static restore(s){const e=super.restore(s);e.circuitCond=s.circuitCond||{enabled:false,channel:'red',sig:'iron-plate',op:'>',count:1};return e;}
}
function drawRocketTurret(ctx,e,gx,gy,dir,alpha){
  const px=gx*TILE,py=gy*TILE,s=TILE*e.w;ctx.globalAlpha=alpha;
  ctx.fillStyle='#6a5a3a';rr(ctx,px+4,py+4,s-8,s-8,10);ctx.fill();
  ctx.strokeStyle='#4a3a24';ctx.lineWidth=3;rr(ctx,px+4,py+4,s-8,s-8,10);ctx.stroke();
  const cx=px+s/2,cy=py+s/2,ang=e.target?e.facing:-Math.PI/2;
  ctx.save();ctx.translate(cx,cy);ctx.rotate(ang);
  ctx.fillStyle='#c8a04a';ctx.fillRect(-8,-8,16,16);
  ctx.fillStyle='#e0c070';ctx.fillRect(5,-4,20,8);
  ctx.restore();
  if(e.beamT>0&&e.target){ctx.strokeStyle='rgba(255,180,80,'+(e.beamT/0.15).toFixed(2)+')';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(e.target.x,e.target.y);ctx.stroke();}
  ctx.globalAlpha=1;
}
function rocketTurretTip(e){return e.target?'开火中（火箭弹）':(G.power.sat<=0?'缺电停摆':'待机（吃电力，无需弹药）');}

// ===== 注册新炮塔 =====
ENT_CLASSES['railgun-turret'] = RailgunTurret;
ENT_CLASSES['rocket-turret'] = RocketTurret;
DEVICE_RENDER['railgun-turret'] = drawRailgunTurret;
DEVICE_RENDER['rocket-turret'] = drawRocketTurret;
DEVICE_STATUS['railgun-turret'] = e => (G.power.sat<=0?'r':(e.target?'g':'y'));
DEVICE_STATUS['rocket-turret'] = e => (G.power.sat<=0?'r':(e.target?'g':'y'));
DEVICE_PANEL['railgun-turret'] = { html: laserTurretPanelHtml, live: laserTurretPanelLive, tip: railgunTurretTip, onAction: (a) => circuitPanelAction('rg', a) };
DEVICE_PANEL['rocket-turret'] = { html: laserTurretPanelHtml, live: laserTurretPanelLive, tip: rocketTurretTip, onAction: (a) => circuitPanelAction('rk', a) };
DEVICE_DIR_ROTATE['railgun-turret'] = true;
DEVICE_DIR_ROTATE['rocket-turret'] = true;
