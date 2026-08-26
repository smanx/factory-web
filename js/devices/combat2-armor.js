'use strict';

// ===== 护甲系统（对齐《异星工厂》Armor） =====
// 玩家可穿戴护甲减少所受伤害。护甲在背包中“使用”即装备，脱卸后回到背包。
const ARMORS = {
  'light-armor': { name: '轻型护甲', protect: 0.8, grid: 0 },   // 减伤 20%
  'heavy-armor': { name: '重型护甲', protect: 0.55, grid: 0 },   // 减伤 45%
  // 模块化护甲：自带装备网格（grid 为行列数），可安装个人装备件
  'modular-armor':   { name: '模块化护甲', protect: 0.7,  grid: 5 },  // 减伤 30%，5×5 网格
  'power-armor':     { name: '强力装甲',   protect: 0.55, grid: 7 },  // 减伤 45%，7×7 网格
  'power-armor-mk2': { name: '强力装甲 II', protect: 0.45, grid: 8 }   // 减伤 55%，8×8 网格
};
function isArmor(id) { return !!ARMORS[id]; }
// 装备护甲：消耗背包中的护甲；若已穿戴则替换（旧护甲回包）
function equipArmor(id) {
  if (!isArmor(id)) return;
  const old = G.armor;
  if (old && old !== id) invAdd(old, 1);
  G.armor = id;
  // 更换护甲时迁移装备网格（新护甲装得下则保留，否则返还）
  if (typeof migrateEquipGrid === 'function') migrateEquipGrid(old, id);
  invTake(id, 1);
  if (typeof playSfx === 'function') playSfx('equip');
  if (typeof toast === 'function') toast('已装备 ' + ARMORS[id].name + '（受伤 -' + Math.round((1 - ARMORS[id].protect) * 100) + '%' + (ARMORS[id].grid ? '，装备网格 ' + ARMORS[id].grid + '×' + ARMORS[id].grid : '') + '）');
  uiDirty = true;
}
// 脱卸护甲：回到背包（装备网格一并返还）
function unequipArmor() {
  if (G.armor) {
    invAdd(G.armor, 1);
    // 返还网格中的装备件
    if (typeof migrateEquipGrid === 'function') migrateEquipGrid(G.armor, null);
    G.armor = null;
  }
  if (typeof playSfx === 'function') playSfx('unequip');
  if (typeof toast === 'function') toast('已脱下护甲');
  uiDirty = true;
}
// 是否为可穿戴护甲且当前可装备（科技门控）
function canEquipArmor(id) {
  if (!isArmor(id)) return false;
  if (TECH_REQ[id] && !G.techDone[TECH_REQ[id]]) return false;
  return true;
}

function updateBullets(dt) {
  if (!G.bullets) return;
  for (const b of G.bullets) {
    b.t += dt;
    // 炮兵炮弹：飞行结束时在落点引发超大范围爆炸
    if (b.art && b.t >= b.life && !b.hit) {
      b.hit = true;
      explodeDamage(b.tx, b.ty, b.splash, b.dmg);
      // 落点爆破特效（大圈）
      b.boomBig = true;
    }
    // 火箭/手雷等范围爆炸：命中后延长存在时间以播放“冲击波扩散 + 火焰消散”动画（画面优化）
    if (b.splash && !b.hit && b.t >= b.life) {
      b.hit = true;
      // 纯冲击波环子弹（核爆特效用）只作视觉，不再重复伤害/特效
      if (!b.waveOnly) {
        explodeDamage(b.tx, b.ty, b.splash, b.dmg);
        // 原子弹：核爆特效（蘑菇云 + 冲击波 + 强光 + 高温火球）
        if (b.nuclear && typeof spawnNuclearExplosion === 'function') spawnNuclearExplosion(b.tx, b.ty);
      }
      b.boomBig = true;
    }
    if ((b.splash || b.boomBig) && b.hit && b._boomT === undefined) {
      b._boomT = 0;
      b._boomBase = b.life;
      b.life = b._boomBase + (b.art ? 0.6 : 0.35);
    }
    if (b._boomT !== undefined) b._boomT += dt;
    // 地雷爆炸特效：仅视觉短促闪光，无需额外伤害（已由 removeEnt 前引爆）
  }
  G.bullets = compactFilter(G.bullets, b => b.t < b.life);
}

// ===== 玩家武器 =====
// 武器数据：伤害、射速、弹药、弹种
const WEAPONS = {
  'pistol':          { name: '手枪',   dmg: 10, rate: 0.3, ammo: 'firearm-magazine',        spread: 0.06, auto: false, range: 7, sfx: 'shoot' },
  'submachine-gun':  { name: '冲锋枪', dmg: 7,  rate: 0.1, ammo: 'firearm-magazine', ammoTiers: ['firearm-magazine', 'piercing-rounds-magazine', 'uranium-rounds-magazine'], ammoDmg: { 'firearm-magazine': 7, 'piercing-rounds-magazine': 10, 'uranium-rounds-magazine': 16 }, spread: 0.12, auto: true,  range: 7, sfx: 'machine-gun' },
  'shotgun':         { name: '散弹枪', dmg: 6,  rate: 0.5, ammo: 'shotgun-shell', spread: 0.4,  auto: false, range: 6, pellets: 6, sfx: 'shotgun' },
  'combat-shotgun':  { name: '战斗散弹枪', dmg: 10, rate: 0.35, ammo: 'piercing-shotgun-shell', spread: 0.32, auto: false, range: 7, pellets: 8, sfx: 'shotgun' },
  'rocket-launcher': { name: '火箭筒', dmg: 35, rate: 1.1, ammo: 'rocket',          spread: 0.03, auto: false, range: 9, splash: 1.8, sfx: 'rocket' },
  'explosive-rocket-launcher': { name: '爆炸火箭筒', dmg: 60, rate: 1.3, ammo: 'explosive-rocket', spread: 0.05, auto: false, range: 9, splash: 3.2, sfx: 'rocket' },
  // 原子弹（对齐《异星工厂》Atomic bomb）：火箭筒发射的终极核武器，命中引发超大范围核爆
  'atomic-bomb': { name: '原子弹', dmg: 300, rate: 2.5, ammo: 'atomic-bomb', spread: 0.02, auto: false, range: 12, splash: 9, nuclear: true, sfx: 'rocket' },
  'grenade':         { name: '手雷',   dmg: 40, rate: 0.8, ammo: 'grenade',          spread: 0.05, auto: false, range: 6, splash: 2.5, sfx: 'throw' },
  'cluster-grenade': { name: '集束手雷', dmg: 80, rate: 1.0, ammo: 'cluster-grenade', spread: 0.05, auto: false, range: 6, splash: 4.5, sfx: 'throw' },
  'flamethrower':    { name: '火焰喷射器', dmg: 6, rate: 0.12, ammo: 'flamethrower-ammo', spread: 0.2, auto: true, range: 6, flame: true, sfx: 'flamethrower' },
  'poison-capsule':  { name: '毒胶囊', dmg: 0, rate: 0.8, ammo: 'poison-capsule', spread: 0.05, auto: false, range: 6, capsule: 'poison' },
  'slowdown-capsule':{ name: '减速胶囊', dmg: 0, rate: 0.8, ammo: 'slowdown-capsule', spread: 0.05, auto: false, range: 6, capsule: 'slowdown' },
  // 战斗机器人胶囊：投掷后释放战斗机器人（见 CAPSULES）
  'defender-capsule':   { name: '防御机器人',   dmg: 0, rate: 0.8, ammo: 'defender-capsule',   spread: 0, auto: false, range: 6, capsule: 'defender' },
  'distractor-capsule': { name: '干扰机器人',   dmg: 0, rate: 0.8, ammo: 'distractor-capsule', spread: 0, auto: false, range: 6, capsule: 'distractor' },
  'destroyer-capsule':  { name: '破坏机器人',   dmg: 0, rate: 0.8, ammo: 'destroyer-capsule',  spread: 0, auto: false, range: 6, capsule: 'destroyer' }
};
function isWeapon(id) { return !!WEAPONS[id]; }
function isCapsuleWeapon(id) { return !!(WEAPONS[id] && WEAPONS[id].capsule); }
// 设置当前手持武器（带科技/物品存在校验）
function setWeapon(id) {
  if (!id) { G.weapon = null; uiDirty = true; return; }
  if (!isWeapon(id)) { G.weapon = null; return; }
  if (WEAPON_TECH_REQ[id] && !G.techDone[WEAPON_TECH_REQ[id]]) {
    if (typeof toast === 'function') toast('需要先研究「' + TECHS[WEAPON_TECH_REQ[id]].name + '」才能使用 ' + ITEMS[id].name);
    return;
  }
  G.weapon = id;
  uiDirty = true;
}
// 朝目标点开火
function playerFire(tx, ty) {
  const id = G.weapon;
  if (!id) return;
  if (WEAPON_TECH_REQ[id] && !G.techDone[WEAPON_TECH_REQ[id]]) return;
  const w = WEAPONS[id];
  // 战斗机器人胶囊：投掷后释放机器人
  if (isCapsuleWeapon(id)) {
    throwCapsule(id, tx, ty);
    return;
  }
  const px = G.player.x, py = G.player.y;
  // 弹药检查：火焰喷射器消耗石油气（流体），其余消耗物品。
  // 冲锋枪等支持弹药升级的武器，自动消耗玩家身上最优的弹药并套用对应伤害（对齐《异星工厂》）。
  let ammoUsed = w.ammo;
  if (w.ammoTiers && w.ammoTiers.length > 1) {
    for (let i = w.ammoTiers.length - 1; i >= 0; i--) {
      if (invCount(w.ammoTiers[i]) >= 1) { ammoUsed = w.ammoTiers[i]; break; }
    }
  }
  if (ammoUsed === 'petroleum-gas') {
    if (invCount('petroleum-gas') < 1) return;
    invTake('petroleum-gas', 1);
  } else {
    if (invCount(ammoUsed) < 1) return;
    invTake(ammoUsed, 1);
  }
  const baseAng = Math.atan2(ty - py, tx - px);
  const pellets = w.pellets || 1;
  // 武器伤害无限科技倍率（对齐《异星工厂》Weapon damage research）+ 分类军事无限科技
  const base = (typeof weaponDamageMult === 'function' ? weaponDamageMult() : 1) * (typeof weaponCategoryMult === 'function' ? weaponCategoryMult(weaponDamageKind(id)) : 1);
  // 弹药升级伤害：使用穿甲弹/铀弹时套用对应伤害，否则用武器基础伤害
  let baseDmg = w.dmg;
  if (w.ammoDmg && w.ammoDmg[ammoUsed]) baseDmg = w.ammoDmg[ammoUsed];
  const dmg = Math.round(baseDmg * base);
  for (let i = 0; i < pellets; i++) {
    const a = baseAng + (Math.random() - 0.5) * 2 * w.spread;
    const dist = w.range * TILE;
    const tx2 = px + Math.cos(a) * dist;
    const ty2 = py + Math.sin(a) * dist;
    if (w.splash) {
      // 火箭弹：命中目标后范围爆炸
      (G.bullets || (G.bullets = [])).push({
        x: px, y: py, tx: tx2, ty: ty2, t: 0, life: 0.18,
        splash: w.splash, dmg: dmg, kind: 'rocket',
        nuclear: !!w.nuclear
      });
    } else if (w.flame) {
      (G.bullets || (G.bullets = [])).push({
        x: px, y: py, tx: tx2, ty: ty2, t: 0, life: 0.2, dmg: dmg, kind: 'flame'
      });
    } else {
      (G.bullets || (G.bullets = [])).push({
        x: px, y: py, tx: tx2, ty: ty2, t: 0, life: 0.12, dmg: dmg, kind: 'bullet'
      });
    }
  }
  if (typeof playSfx === 'function') playSfx(w.sfx || (w.pellets > 1 ? 'shotgun' : 'shoot'));
  uiDirty = true;
}
// 玩家开火更新：按住空格/左键对敌人持续射击
function updatePlayerFire(dt) {
  if (!G.weapon || !G.settings.combat) return;
  // 驾驶装甲车/坦克时：按住空格由车载机枪/主炮开火，不再用手持武器（对齐《异星工厂》：驾驶载具用载具武器）
  if (G.driving && G.driving.ent && (G.driving.ent instanceof Car)) return;
  G.playerFireT -= dt;
  // 空格键开火（触屏可自行调用 playerFire 实现开火）
  const firing = !!G.keys[' '];
  if (!firing) return;
  const w = WEAPONS[G.weapon];
  if (w && !w.auto && G.playerFireT > 0) return;  // 非自动武器需间隔
  if (G.playerFireT > 0) return;
  // 目标点：鼠标光标所在世界坐标，或朝向方向
  let tx, ty;
  if (G.cursorTile) {
    tx = G.cursorTile.tx * TILE + TILE / 2;
    ty = G.cursorTile.ty * TILE + TILE / 2;
  } else {
    const a = G.player.dir * Math.PI / 2;
    tx = G.player.x + Math.cos(a) * TILE * 3;
    ty = G.player.y + Math.sin(a) * TILE * 3;
  }
  playerFire(tx, ty);
  // 射击速度无限科技：射击间隔缩短，射速提升（对齐《异星工厂》Shooting speed）
  G.playerFireT = (typeof shootingSpeedMult === 'function' ? w.rate / shootingSpeedMult() : w.rate);
}
// 玩家子弹命中敌人（沿子弹飞行路径检测）
function updatePlayerBulletHits(dt) {
  if (!G.bullets) return;
  // 性能优化：复用主循环每帧缓存的存活敌人列表（避免重复 filter 分配数组）
  const alive = G._aliveEnemies || (G.enemies || []).filter(e => !e.dead);
  if (alive.length === 0) return;
  for (const b of G.bullets) {
    if (b.hit || (b.kind !== 'bullet' && b.kind !== 'flame' && b.kind !== 'rocket')) continue;
    // 火箭/手雷：飞行结束时在终点爆炸
    if (b.splash) {
      if (b.t >= b.life && !b.hit) { b.hit = true; explodeDamage(b.tx, b.ty, b.splash, b.dmg); }
      continue;
    }
    // 普通弹/火焰：命中飞行路径上的第一个敌人
    const t = b.t / b.life;
    const cx = b.x + (b.tx - b.x) * t, cy = b.y + (b.ty - b.y) * t;
    for (const en of alive) {
      if (en.dead) continue;   // 本帧内可能已被其他子弹/爆炸击杀
      const d = Math.hypot(cx - en.x, cy - en.y);
      if (d <= en.size + 4) {
        en.hp -= b.dmg;
        // 火焰命中敌人：在该处地面留下燃烧火场
        if (b.kind === 'flame' && typeof spawnGroundFire === 'function') spawnGroundFire(en.x, en.y);
        if (en.hp <= 0) en.dead = true;
        b.hit = true;
        break;
      }
    }
  }
}
// 范围爆炸伤害（火箭弹/手雷）
function explodeDamage(cx, cy, radius, dmg) {
  if (!G.enemies) return;
  for (const en of G.enemies) {
    if (en.dead) continue;
    const d = Math.hypot(cx - en.x, cy - en.y);
    if (d <= radius * TILE) {
      en.hp -= dmg;
      if (en.hp <= 0) en.dead = true;
    }
  }
  // 爆炸也会伤害玩家自身（距离过近时）
  // 性能优化：平方距离比较（与 Math.hypot 数学等价）
  { const _bx = cx - G.player.x, _by = cy - G.player.y, _br = radius * TILE * 0.5; if (_bx*_bx + _by*_by <= _br*_br) damagePlayer(dmg * 0.4); }
  if (typeof playSfx === 'function') playSfx('explosion');
}

// ===== 核爆特效（原子弹，对齐《异星工厂》Atomic bomb 的蘑菇云） =====
// 生成蘑菇云烟柱、冲击波环与强光闪光，并在爆炸中心留下高温灼烧粒子。
function spawnNuclearExplosion(cx, cy) {
  // 蘑菇云烟柱：多条上飘的烟粒子，随高度扩散
  const cols = ['#ffd27a', '#ff9a3a', '#d05a2a', '#7a4a3a', '#4a3a3a', '#9a9aa0'];
  for (let i = 0; i < 60; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 1 + Math.random() * 4;
    const hgt = (Math.random() * 4 + 1) * TILE;
    if (typeof spawnSmoke === 'function') {
      spawnSmoke(cx + Math.cos(a) * sp * 6, cy - hgt, {
        life: 2.5 + Math.random() * 2,
        size: 8 + Math.random() * 14,
        vx: Math.cos(a) * sp * 2,
        vy: -(3 + Math.random() * 5),
        color: cols[(Math.random() * cols.length) | 0]
      });
    }
  }
  // 蘑菇云顶部圆盘（球形扩散）
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = (Math.random() * 5 + 2) * TILE;
    if (typeof spawnSmoke === 'function') {
      spawnSmoke(cx + Math.cos(a) * r, cy - 4 * TILE - Math.random() * 2 * TILE, {
        life: 2 + Math.random() * 2,
        size: 10 + Math.random() * 16,
        vx: Math.cos(a) * 1.5,
        vy: -1 + Math.random(),
        color: '#c87a4a'
      });
    }
  }
  // 高温火花：爆炸中心向外飞溅
  for (let i = 0; i < 50; i++) {
    if (typeof spawnSpark === 'function') spawnSpark(cx, cy, { speed: 5 + Math.random() * 8, life: 0.8, size: 3, color: '#ffe0a0' });
  }
  // 冲击波环标记：通过 G.bullets 插入一枚无伤害的“波环”子弹，仅用于渲染扩散冲击波
  (G.bullets || (G.bullets = [])).push({
    x: cx, y: cy, tx: cx, ty: cy, t: 0, life: 0.8, dmg: 0,
    splash: 9, kind: 'nuclear-wave', _boomT: 0, _boomBase: 0, nuclear: true, waveOnly: true
  });
  // 强光闪屏
  if (typeof addScreenFlash === 'function') addScreenFlash(0.9);
  else if (G.screenFlash === undefined) G.screenFlash = 1;
  else G.screenFlash = Math.max(G.screenFlash || 0, 1);
  // 核爆轰鸣音效
  if (typeof playSfx === 'function') playSfx('explosion');
}


// ===== 战斗机器人胶囊（对齐《异星工厂》Combat robots） =====
// 玩家选择胶囊后按空格/点击投掷，落地释放战斗机器人：
//  - defender（防御）：跟随玩家，自动攻击附近敌人，有续航时间
//  - distractor（干扰）：原地悬浮吸引敌人火力
//  - destroyer（破坏）：主动冲向并摧毁敌人，伤害更高
const CAPSULES = {
  'defender-capsule':   { name: '防御机器人', hp: 120, dmg: 6,  speed: 60,  lifetime: 45, size: 5, follow: true,  seek: false, color: '#5aa0d0' },
  'distractor-capsule': { name: '干扰机器人', hp: 200, dmg: 0,  speed: 0,   lifetime: 30, size: 6, follow: false, seek: false, color: '#d0a04a' },
  'destroyer-capsule':  { name: '破坏机器人', hp: 100, dmg: 10, speed: 90,  lifetime: 30, size: 5, follow: true,  seek: true,  color: '#d05a5a' }
};
function isCapsule(id) { return !!CAPSULES[id]; }
function throwCapsule(id, tx, ty) {
  if (invCount(id) < 1) return false;
  if (TECH_REQ[id] && !G.techDone[TECH_REQ[id]]) {
    if (typeof toast === 'function') toast('需要先研究「' + TECHS[TECH_REQ[id]].name + '」才能使用 ' + ITEMS[id].name);
    return false;
  }
  // 追随机器人数量上限（对齐《异星工厂》Follower robot count）：默认 5，逐级 +2
  // 战斗机器人胶囊在消耗前校验上限，避免满员时白白扣掉胶囊（毒/减速胶囊不受此限制）
  if (CAPSULES[id] && !(id === 'poison-capsule' || id === 'slowdown-capsule')) {
    if (!G.combatRobots) G.combatRobots = [];
    const cap = 5 + 2 * ((G.techProg && G.techProg['follower-robot-count']) || 0);
    if (G.combatRobots.length >= cap) {
      if (typeof toast === 'function') toast('战斗机器人已达上限（' + cap + '，研究「追随机器人」可提升）');
      uiDirty = true;
      return false;
    }
  }
  invTake(id, 1);
  if (typeof playSfx === 'function') playSfx('deploy');
  if (id === 'poison-capsule' || id === 'slowdown-capsule') {
    const kind = id === 'poison-capsule' ? 'poison' : 'slowdown';
    if (!G.aoeZones) G.aoeZones = [];
    G.aoeZones.push({
      kind, x: tx, y: ty, radius: (id === 'poison-capsule' ? 3 : 3.5) * TILE,
      lifetime: (id === 'poison-capsule' ? 12 : 10), maxLife: (id === 'poison-capsule' ? 12 : 10),
      dmg: id === 'poison-capsule' ? 8 : 0, tickT: 0
    });
    if (typeof toast === 'function') toast('投掷 ' + ITEMS[id].name + '：释放' + (id === 'poison-capsule' ? '剧毒云雾' : '减速力场'));
    uiDirty = true;
    return true;
  }
  const c = CAPSULES[id];
  if (!G.combatRobots) G.combatRobots = [];
  const cap = 5 + 2 * ((G.techProg && G.techProg['follower-robot-count']) || 0);
  // 一次投掷释放 2 只（destroyer 1 只）
  const n = id === 'destroyer-capsule' ? 1 : 2;
  for (let i = 0; i < n; i++) {
    if (G.combatRobots.length >= cap) break;
    G.combatRobots.push({
      type: id, kind: id.replace('-capsule', ''),
      name: c.name, hp: c.hp, maxhp: c.hp, dmg: c.dmg, speed: c.speed,
      lifetime: c.lifetime, size: c.size, follow: c.follow, seek: c.seek,
      color: c.color, x: G.player.x + (Math.random() - 0.5) * 10,
      y: G.player.y + (Math.random() - 0.5) * 10, fireT: 0, dead: false, dir: 0
    });
  }
  if (typeof toast === 'function') toast('投掷 ' + ITEMS[id].name + '：释放 ' + c.name);
  uiDirty = true;
  return true;
}
// 更新战斗机器人：跟随/攻击/续航倒计时
function updateCombatRobots(dt) {
  if (!G.combatRobots || G.combatRobots.length === 0) return;
  const p = G.player;
  // 性能优化：复用主循环每帧缓存的存活敌人列表
  const enemies = G._aliveEnemies || (G.enemies || []).filter(e => !e.dead);
  for (const r of G.combatRobots) {
    if (r.dead) continue;
    r.lifetime -= dt;
    if (r.lifetime <= 0 || r.hp <= 0) { r.dead = true; continue; }
    r.fireT -= dt;
    if (r.kind === 'distractor') {
      // 干扰机器人：原地悬浮，不做攻击，但吸引近战敌人靠近
      continue;
    }
    // 寻找最近敌人
    let target = null, bestD = Infinity;
    for (const en of enemies) {
      if (en.kind === 'spawner') continue;
      const d = Math.hypot(en.x - r.x, en.y - r.y);
      if (d < bestD) { bestD = d; target = en; }
    }
    if (r.kind === 'destroyer' && target) {
      // 破坏机器人：主动冲向敌人
      const d = Math.max(1, Math.hypot(target.x - r.x, target.y - r.y));
      r.x += ((target.x - r.x) / d) * r.speed * dt;
      r.y += ((target.y - r.y) / d) * r.speed * dt;
      if (bestD < r.size + target.size + 6) {
        if (r.fireT <= 0) { r.fireT = 0.6; target.hp -= r.dmg; if (target.hp <= 0) target.dead = true; }
      }
    } else if (target) {
      // 防御机器人：跟随玩家，对射程内敌人开火
      const pd = Math.hypot(p.x - r.x, p.y - r.y);
      if (pd > TILE * 4) {
        const d = Math.max(1, pd);
        r.x += ((p.x - r.x) / d) * r.speed * dt;
        r.y += ((p.y - r.y) / d) * r.speed * dt;
      }
      if (bestD < TILE * 7 && r.fireT <= 0) {
        r.fireT = 0.5;
        target.hp -= r.dmg;
        if (target.hp <= 0) target.dead = true;
      }
    } else if (r.follow) {
      const pd = Math.hypot(p.x - r.x, p.y - r.y);
      if (pd > TILE * 3) {
        const d = Math.max(1, pd);
        r.x += ((p.x - r.x) / d) * r.speed * dt;
        r.y += ((p.y - r.y) / d) * r.speed * dt;
      }
    }
    // 机器人会被近战敌人攻击
    for (const en of enemies) {
      if (en.kind !== 'melee') continue;
      const d = Math.hypot(en.x - r.x, en.y - r.y);
      if (d < r.size + en.size + 4) { r.hp -= en.dmg * dt; }
    }
  }
  G.combatRobots = compactFilter(G.combatRobots, r => !r.dead);
}

// ===== 区域力场（毒胶囊 / 减速胶囊）=====
// 毒胶囊落地形成剧毒云雾，对范围内敌人持续伤害；减速胶囊形成减速力场，降低敌人移动速度。
function updateAoeZones(dt) {
  if (!G.aoeZones || G.aoeZones.length === 0) return;
  // 性能优化：复用主循环每帧缓存的存活敌人列表
  const alive = G._aliveEnemies || (G.enemies || []).filter(e => !e.dead);
  for (const z of G.aoeZones) {
    z.lifetime -= dt;
    if (z.lifetime <= 0) continue;
    if (z.kind === 'poison') {
      // 每秒造成一次范围伤害
      z.tickT -= dt;
      if (z.tickT <= 0) {
        z.tickT = 1;
        for (const en of alive) {
          if (en.dead) continue;
          const d = Math.hypot(en.x - z.x, en.y - z.y);
          if (d <= z.radius + en.size) en.hp -= z.dmg;
          if (en.hp <= 0) en.dead = true;
        }
      }
    } else if (z.kind === 'slowdown') {
      // 减速：标记力场是否覆盖玩家
      z.playerSlow = Math.hypot(G.player.x - z.x, G.player.y - z.y) <= z.radius;
    }
  }
  G.aoeZones = compactFilter(G.aoeZones, z => z.lifetime > 0);
}
// 供敌人移动逻辑调用：若敌人位于减速力场则返回减速系数（0.5 = 半速）
function aoeSlowFactor(x, y) {
  if (!G.aoeZones) return 1;
  for (const z of G.aoeZones) {
    if (z.kind === 'slowdown' && z.lifetime > 0 && Math.hypot(x - z.x, y - z.y) <= z.radius) return 0.45;
  }
  return 1;
}

// 手雷/集束手雷：从背包使用时投掷爆炸（由 ui.js 调用）。
// 投掷物复用 splash 爆炸路径（kind 用 'rocket'，由 updatePlayerBulletHits 的 splash 分支处理爆炸）。
function throwGrenade(tx, ty, type) {
  type = type || 'grenade';
  if (invCount(type) < 1) return;
  if (!G.settings.combat) {
    if (typeof toast === 'function') toast('需在设置中开启战斗才能投掷');
    return;
  }
  const w = WEAPONS[type] || WEAPONS['grenade'];
  invTake(type, 1);
  const px = G.player.x, py = G.player.y;
  // 投掷目标点：传入的是瓦片坐标，转换为世界坐标；若玩家在范围内则向目标投掷
  let gx = tx * TILE + TILE / 2, gy = ty * TILE + TILE / 2;
  (G.bullets || (G.bullets = [])).push({
    x: px, y: py, tx: gx, ty: gy,
    t: 0, life: 0.45, dmg: w.dmg, splash: w.splash, kind: 'rocket'
  });
  if (typeof toast === 'function') toast('💣 投掷 ' + ITEMS[type].name);
  uiDirty = true;
}

