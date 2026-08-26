'use strict';

// ===== 军事体系：机枪炮塔 + 石墙 + 敌人系统 =====
// 敌人会周期性地从玩家/建筑附近刷出并向基地移动；炮塔自动攻击射程内敌人。
// 石墙为障碍物，阻挡敌人与玩家通行。弹药（弹药匣/穿甲弹）放入炮塔消耗。

// ===== 石墙（对齐《异星工厂》Stone wall，占地 1×1）=====
class StoneWall extends Entity {
  constructor(type, x, y) { super('stone-wall', x, y); }
  get solid() { return true; }
}
function drawStoneWall(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#8d8578';
  rr(ctx, px + 4, py + 4, TILE - 8, TILE - 8, 4); ctx.fill();
  ctx.strokeStyle = '#5c5649';
  ctx.lineWidth = 2;
  rr(ctx, px + 4, py + 4, TILE - 8, TILE - 8, 4); ctx.stroke();
  ctx.fillStyle = '#9a9284';
  ctx.fillRect(px + 4, py + 4, TILE - 8, 3);
  ctx.fillRect(px + 4, py + 4, 3, TILE - 8);
  ctx.globalAlpha = 1;
}
function stoneWallPanelHtml() {
  return '<div class="dim">石墙：防御障碍物，阻挡敌人与玩家通行。可围成防御工事保护炮塔（1×1）。</div><div class="status"></div>';
}
function stoneWallPanelLive(e, api) {
  api.status('防御墙', 'ok');
}
function stoneWallTip() { return '石墙：阻挡敌人通行'; }

// ===== 机枪炮塔（对齐《异星工厂》Gun turret，占地 2×2）=====
// 需装入弹药（弹药匣/穿甲弹/铀弹），自动攻击射程内敌人。
// 弹药等级列表：优先级从高到低（威力从大到小）。集中定义避免各处硬编码重复。
const TURRET_AMMO_TYPES = ['uranium-rounds', 'piercing-rounds', 'magazine'];
const TURRET_RANGE = GAME_DATA.turret?.['gun-turret']?.range ?? 6;       // 射程（格，官方 attack_parameters.range 18）
const TURRET_FIRE_RATE = GAME_DATA.turret?.['gun-turret']?.fireRate ?? 0.3; // 两次射击间隔（秒，官方 cooldown 6tick=0.1s）
class GunTurret extends CircuitNode {
  constructor(type, x, y) {
    super('gun-turret', x, y);
    this.ammo = {};      // { 'magazine': n, 'piercing-rounds': n, 'uranium-rounds': n }
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
      if (d <= TURRET_RANGE) n++;
    }
    return n;
  }
  // 输出传感器信号（对齐《异星工厂》：炮塔把射程内敌人数量以 signal-enemy 输出）
  outputCircuitSignals() {
    const n = this.enemiesInRange();
    if (n <= 0) return [];
    return [{ sig: 'signal-enemy', count: n }];
  }
  ammoCount(id) { return this.ammo[id] || 0; }
  totalAmmo() { let s = 0; for (const k in this.ammo) s += this.ammo[k]; return s; }
  giveItem(item) {
    if (TURRET_AMMO_TYPES.indexOf(item) >= 0) {
      if (this.ammoCount(item) >= 40) return false;
      this.ammo[item] = this.ammoCount(item) + 1;
      if (typeof playSfx === 'function') playSfx('turret');
      return true;
    }
    return false;
  }
  takeItem() {
    for (const k of TURRET_AMMO_TYPES)
      if (this.ammoCount(k) > 0) return this.takeItemOf(k);
    return null;
  }
  peekItem() {
    for (const k of TURRET_AMMO_TYPES)
      if (this.ammoCount(k) > 0) return k;
    return null;
  }
  countOf(item) { return this.ammoCount(item); }
  takeItemOf(item) {
    if (this.ammoCount(item) > 0) { this.ammo[item]--; if (this.ammo[item] <= 0) delete this.ammo[item]; return item; }
    return null;
  }
  contents() {
    const list = [[this.type, 1]];
    for (const k in this.ammo) if (this.ammo[k] > 0) list.push([k, this.ammo[k]]);
    return list;
  }
  takeAll() {
    const rows = [];
    for (const k of Object.keys(this.ammo)) { rows.push([k, this.ammo[k]]); delete this.ammo[k]; }
    return rows;
  }
  update(dt) {
    this.cooldown -= dt;
    this.target = null;
    // 电路条件不满足时炮塔停火（不选目标、不开枪）
    if (!this.circuitEnabled()) return;
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    let best = null, bestD = Infinity;
    // 性能优化：复用主循环每帧缓存的存活敌人列表（_aliveEnemies），避免重复 dead 判断遍历全数组
    const enemies = G._aliveEnemies || (G.enemies || []);
    for (const en of enemies) {
      if (!en || en.dead) continue;
      const ex = en.x / TILE, ey = en.y / TILE;
      const d = Math.hypot(ex - cx, ey - cy);
      if (d <= TURRET_RANGE && d < bestD) { best = en; bestD = d; }
    }
    if (!best) return;
    this.target = best;
    this.facing = Math.atan2(best.y - (this.y + this.h / 2) * TILE, best.x - (this.x + this.w / 2) * TILE);
    // 需要有弹药才能射击
    let ammo = 0;
    for (const k of TURRET_AMMO_TYPES) ammo += this.ammoCount(k);
    if (ammo <= 0 || this.cooldown > 0) return;
    // 射击速度无限科技：射击间隔缩短，射速提升（对齐《异星工厂》Shooting speed）
    this.cooldown = (typeof shootingSpeedMult === 'function' ? TURRET_FIRE_RATE / shootingSpeedMult() : TURRET_FIRE_RATE);
    // 用弹药攻击：铀弹 > 穿甲弹 > 普通弹（伤害取官方 ammo_type 弹药伤害）
    const dmgMap = {
      'uranium-rounds': GAME_DATA.ammoDamage?.['uranium-rounds'] ?? 18,
      'piercing-rounds': GAME_DATA.ammoDamage?.['piercing-rounds'] ?? 10,
      'magazine': GAME_DATA.ammoDamage?.['magazine'] ?? 5
    };
    let dmg = GAME_DATA.ammoDamage?.['magazine'] ?? 5;
    for (const k of TURRET_AMMO_TYPES) {
      if (this.ammoCount(k) > 0) { this.ammo[k]--; dmg = dmgMap[k]; break; }
    }
    for (const k of TURRET_AMMO_TYPES) if (this.ammo[k] <= 0) delete this.ammo[k];
    // 武器伤害无限科技倍率（对齐《异星工厂》Weapon damage research）+ 分类军事无限科技（投射物）
    // + 军事科技 III / IV（对齐《异星工厂》Military 3 / Military 4：机枪炮塔伤害强化）
    dmg = Math.round(dmg * (typeof weaponDamageMult === 'function' ? weaponDamageMult() : 1) * (typeof weaponCategoryMult === 'function' ? weaponCategoryMult('projectile') : 1) * (typeof turretDamageMult === 'function' ? turretDamageMult() : 1));
    best.hp -= dmg;
    // 子弹特效
    (G.bullets || (G.bullets = [])).push({
      x: (this.x + this.w / 2) * TILE, y: (this.y + this.h / 2) * TILE,
      tx: best.x, ty: best.y, t: 0, life: 0.15
    });
    if (typeof playSfx === 'function') playSfx('machine-gun');
    if (best.hp <= 0) best.dead = true;
  }
  powerDemand() { return 0; }
  serialize() { const s = super.serialize(); s.ammo = this.ammo; if (this.circuitCond) s.circuitCond = this.circuitCond; return s; }
  static restore(s) { const t = super.restore(s); t.ammo = s.ammo || {}; t.circuitCond = s.circuitCond || { enabled: false, channel: 'red', sig: 'iron-plate', op: '>', count: 1 }; return t; }
}
function drawGunTurret(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#5a5a66';
  rr(ctx, px + 4, py + 4, s - 8, s - 8, 8); ctx.fill();
  ctx.strokeStyle = '#3a3a44';
  ctx.lineWidth = 3;
  rr(ctx, px + 4, py + 4, s - 8, s - 8, 8); ctx.stroke();
  const cx = px + s / 2, cy = py + s / 2;
  ctx.fillStyle = '#3c3c46';
  ctx.beginPath(); ctx.arc(cx, cy, 12, 0, 7); ctx.fill();
  ctx.strokeStyle = '#2a2a33';
  ctx.lineWidth = 2;
  ctx.stroke();
  // 炮管朝向目标
  const ang = e.target ? e.facing : ((dir * Math.PI) / 2);
  ctx.strokeStyle = '#6a6a78';
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx + Math.cos(ang) * 5, cy + Math.sin(ang) * 5);
  ctx.lineTo(cx + Math.cos(ang) * 24, cy + Math.sin(ang) * 24);
  ctx.stroke();
  ctx.lineCap = 'butt';
  // 弹药余量指示
  if (e.totalAmmo() > 0) {
    ctx.fillStyle = '#ffd23c';
    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(e.totalAmmo(), cx, cy + 2);
  }
  ctx.globalAlpha = 1;
}
function gunTurretPanelHtml(e) {
  let h = row('弹药', e.totalAmmo() > 0 ? countStr(e.ammo) : '<span class="dim">空</span>', 'ammo');
  for (const id of TURRET_AMMO_TYPES) {
    const n = Math.min(invCount(id), 40 - e.ammoCount(id));
    if (n > 0) h += '<button data-action="feed" data-id="' + id + '">放入' +
      ITEMS[id].name + ' ×' + n + '</button>';
  }
  if (e.totalAmmo() > 0) h += '<button data-action="takeout" id="btn-turret-takeout">取出全部弹药</button>';
  h += '<div class="status"></div>';
  h += '<div class="dim">机枪炮塔：自动攻击射程内（' + TURRET_RANGE + ' 格）的敌人，需装入弹药。威力：铀弹 > 穿甲弹 > 弹药匣。配合石墙构筑防御阵地（2×2）。</div>';
  h += circuitPanelHtml(e, 'gt');
  return h;
}
function gunTurretPanelLive(e, api) {
  if (e.circuitCond && e.circuitCond.enabled && !e.circuitEnabled()) { api.status('已停火：电路条件不满足', 'warn'); return; }
  api.set('ammo', e.totalAmmo() > 0 ? countStr(e.ammo) : dimSpan('空'));
  api.toggle('#btn-turret-takeout', e.totalAmmo() > 0, '取出全部弹药 (' + e.totalAmmo() + ')');
  if (e.totalAmmo() <= 0) api.status('已暂停：无弹药（放入弹药匣/穿甲弹/铀弹）', 'warn');
  else if (e.target) api.status('开火中：攻击敌人', 'ok');
  else api.status('待机：射程内无敌人', 'ok');
}
function gunTurretTip(e) {
  if (e.totalAmmo() <= 0) return '无弹药，需放入弹药';
  return e.target ? '开火中（弹药 ×' + e.totalAmmo() + '）' : '待机（弹药 ×' + e.totalAmmo() + '）';
}

// ===== 敌人系统 =====
// 敌人周期性地在玩家/基地附近刷出，向最近建筑/玩家移动并造成威胁。
// G.enemies 数组由主循环更新；G.bullets 为子弹特效。
function enemyColor(hp, max) { return hp > max * 0.5 ? '#d05040' : '#a03028'; }
function spawnEnemies(dt) {
  if (!G.enemies) G.enemies = [];
  G.spawnT = (G.spawnT || 0) + dt;
  const interval = Math.max(4, 12 - Math.min(8, (G.enemies.length || 0) / 2));
  if (G.spawnT >= interval) {
    G.spawnT = 0;
    // 在玩家附近随机方向刷一只
    const px = G.player.x / TILE, py = G.player.y / TILE;
    const dist = 18 + Math.random() * 8;
    const ang = Math.random() * Math.PI * 2;
    let tx = Math.round(px + Math.cos(ang) * dist);
    let ty = Math.round(py + Math.sin(ang) * dist);
    // 找一块可站立的地面
    for (let i = 0; i < 8; i++) {
      const cx2 = tx + Math.floor(Math.random() * 5) - 2;
      const cy2 = ty + Math.floor(Math.random() * 5) - 2;
      if ((!isWater(cx2, cy2) && !isCliff(cx2, cy2)) && !entAt(cx2, cy2)) { tx = cx2; ty = cy2; break; }
    }
    G.enemies.push({ x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2, hp: 40, dead: false, dir: 0 });
  }
}
function updateEnemies(dt) {
  if (!G.enemies) return;
  const speed = 22; // 格/秒
  for (const en of G.enemies) {
    if (en.dead) continue;
    // 朝玩家移动（简单的追踪）
    const dx = G.player.x - en.x, dy = G.player.y - en.y;
    const d = Math.hypot(dx, dy);
    if (d > 1.5) {
      en.x += (dx / d) * speed * dt;
      en.y += (dy / d) * speed * dt;
    }
  }
  // 清理死亡敌人
  G.enemies = compactFilter(G.enemies, e => !e.dead);
}
function updateBullets(dt) {
  if (!G.bullets) return;
  for (const b of G.bullets) { b.t += dt; }
  G.bullets = compactFilter(G.bullets, b => b.t < b.life);
}

// ===== 注册 =====
ENT_CLASSES['gun-turret'] = GunTurret;
ENT_CLASSES['stone-wall'] = StoneWall;
DEVICE_RENDER['gun-turret'] = drawGunTurret;
DEVICE_RENDER['stone-wall'] = drawStoneWall;
DEVICE_DIR_ROTATE['stone-wall'] = true; // 支持旋转
DEVICE_STATUS['gun-turret'] = e => e.totalAmmo() > 0 ? (e.target ? 'g' : 'r') : 'r';
DEVICE_STATUS['stone-wall'] = () => null;
DEVICE_PANEL['gun-turret'] = { html: gunTurretPanelHtml, live: gunTurretPanelLive, tip: gunTurretTip, onAction: (a) => circuitPanelAction('gt', a) };
DEVICE_PANEL['stone-wall'] = { html: stoneWallPanelHtml, live: stoneWallPanelLive, tip: stoneWallTip };
DEVICE_DIR_ROTATE['gun-turret'] = true;
