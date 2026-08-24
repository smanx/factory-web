'use strict';

// ===== 战斗体系扩充（对齐《异星工厂》基础版军事体系）=====
// 新增：激光炮塔、火焰炮塔、玩家武器（手枪/冲锋枪/散弹枪/火箭筒/火焰喷射器）、
// 手雷、玩家生命值与敌人伤害、多种敌人类型（小虫/大虫/远程吐痰虫/蠕虫）。

// ===== 敌人类型表 =====
// kind: 'melee'（近战冲撞）| 'ranged'（远程吐痰）
// evolution: 该类型刷出所需的最低进化度（0~1），越高越强（对齐《异星工厂》敌人随进化度解锁更强变种）
const ENEMY_TYPES = {
  'small-biter':  { name: '小虫',   hp: 30,  speed: 22,  size: 6,  dmg: 4,  color: '#d05040', kind: 'melee',   xp: 1, evolution: 0 },
  'medium-biter': { name: '大虫',   hp: 80,  speed: 18,  size: 9,  dmg: 9,  color: '#b03a30', kind: 'melee',   xp: 2, evolution: 0.05 },
  'spitter':      { name: '吐痰虫', hp: 50,  speed: 12,  size: 7,  dmg: 7,  color: '#8a6a2a', kind: 'ranged', xp: 2, evolution: 0.15 },
  'worm':         { name: '蠕虫',   hp: 120, speed: 0,   size: 12, dmg: 12, color: '#6a4a3a', kind: 'ranged', xp: 3, evolution: 0.2 },
  // 进化变种（需更高进化度，属性更强）
  'heavy-biter':  { name: '重甲虫', hp: 150, speed: 14,  size: 11, dmg: 16, color: '#8a2a2a', kind: 'melee',   xp: 4, evolution: 0.35 },
  'fire-spitter': { name: '喷火虫', hp: 120, speed: 12,  size: 9,  dmg: 18, color: '#d08a2a', kind: 'ranged', xp: 4, evolution: 0.5 },
  'big-worm':     { name: '巨型蠕虫', hp: 300, speed: 0,   size: 16, dmg: 24, color: '#4a3a2a', kind: 'ranged', xp: 6, evolution: 0.6 },
  'huge-biter':   { name: '巨兽虫', hp: 500, speed: 12,  size: 15, dmg: 32, color: '#5a1a2a', kind: 'melee',   xp: 8, evolution: 0.8 }
};

// ===== 敌人进化度系统（对齐《异星工厂》Evolution factor） =====
// 进化度 0~1，随时间（自然进化）与击杀敌人（战斗进化）而增长。
// 进化度越高，刷出的敌人越强、越容易出现高级变种；同时敌人基础属性按进化度小幅增强。
const EVOLUTION_TIME_RATE = 0.0015;   // 每秒自然进化增量（约 11 分钟到 1.0）
const EVOLUTION_KILL_RATE = 0.012;    // 每击杀一个敌人进化增量（含巢穴）
function evolutionFactor() { return G.evolution || 0; }
function addEvolution(amount) {
  G.evolution = Math.min(1, (G.evolution || 0) + amount);
}
// 每帧推进自然进化（仅战斗开启时）
function updateEvolution(dt) {
  if (!G.settings.combat) return;
  addEvolution(EVOLUTION_TIME_RATE * dt);
}
// 敌人属性随进化度增强：hp/dmg 按进化度线性提升（最高 +120%）
function scaledDef(def) {
  const evo = evolutionFactor();
  const mult = 1 + evo * 1.2;
  return { ...def, hp: Math.round(def.hp * mult), dmg: Math.round(def.dmg * mult) };
}

// 按权重随机出一个敌人类型（前期以小虫为主，后期更强）。
// 权重随进化度提升而向更强变种倾斜；进化度不足的变种不会刷出。
function pickEnemyType() {
  const evo = evolutionFactor();
  const base = [
    ['small-biter', 60],
    ['medium-biter', G.techDone['advanced-combat'] ? 25 : 10],
    ['spitter', G.techDone['advanced-combat'] ? 12 : 4],
    ['worm', G.techDone['rocket-science'] ? 6 : 2]
  ];
  // 高级变种在达到对应进化度后按权重加入，权重随进化度进一步增大
  const advanced = [
    ['heavy-biter', 0.35],
    ['fire-spitter', 0.5],
    ['big-worm', 0.6],
    ['huge-biter', 0.8]
  ];
  const weights = base.map(([k, w]) => [k, w]);
  for (const [k, thr] of advanced) {
    if (evo >= thr) weights.push([k, 8 + Math.round((evo - thr) * 60)]);
  }
  let total = 0;
  for (const [, w] of weights) total += w;
  let r = Math.random() * total;
  for (const [k, w] of weights) { r -= w; if (r <= 0) return k; }
  return 'small-biter';
}

// ===== 覆盖/扩展敌人刷出与更新 =====
// 原 military.js 的 spawnEnemies/updateEnemies 为简单版，这里增强为多类型。
// ===== 敌人巢穴系统（对齐《异星工厂》Enemy spawner）=====
// 巢穴（Spawner）是敌方生产点：敌人从巢穴附近生成，而非随机在玩家周围。
// 巢穴有生命值，可被武器攻击摧毁；摧毁后该区域不再刷怪。
// 巢穴作为 G.enemies 中的一个特殊项（kind='spawner'）复用敌人渲染/伤害管线。
const SPAWNER_HP = 260;          // 虫巢生命值
const SPAWNER_TARGET = 2;        // 同时存在的巢穴目标数（高级战斗后 3）
const SPAWNER_RANGE = 14;        // 巢穴生成敌人的距离（格）

function makeSpawner() {
  const px = G.player.x / TILE, py = G.player.y / TILE;
  // 在玩家远处（16~26 格）生成巢穴，尽量避开水面/建筑
  for (let i = 0; i < 12; i++) {
    const dist = 16 + Math.random() * 10;
    const ang = Math.random() * Math.PI * 2;
    const tx = Math.round(px + Math.cos(ang) * dist);
    const ty = Math.round(py + Math.sin(ang) * dist);
    if (!isWater(tx, ty) && !entAt(tx, ty)) {
      return {
        x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2,
        hp: SPAWNER_HP, maxhp: SPAWNER_HP, dead: false, dir: 0,
        type: 'spawner', kind: 'spawner', speed: 0, size: 13, dmg: 0,
        color: '#5a3a8a', attackT: 0, fireT: 0
      };
    }
  }
  return null;
}

function spawnEnemies(dt) {
  if (!G.enemies) G.enemies = [];
  G.spawnT = (G.spawnT || 0) + dt;
  // 敌人数量越多刷新越慢；火箭时代可允许更多敌人同时在场
  const cap = G.techDone['advanced-combat'] ? 40 : 24;
  if (G.enemies.length >= cap) return;
  // 维护巢穴数量：不足则在远处生成新巢穴
  const spawners = G.enemies.filter(e => e.kind === 'spawner' && !e.dead);
  const spawnerCap = G.techDone['advanced-combat'] ? 3 : SPAWNER_TARGET;
  if (spawners.length < spawnerCap && G.spawnT > 3) {
    const s = makeSpawner();
    if (s) G.enemies.push(s);
  }
  const interval = Math.max(3, 12 - Math.min(9, (G.enemies.length || 0) / 3));
  if (G.spawnT < interval) return;
  G.spawnT = 0;
  const px = G.player.x / TILE, py = G.player.y / TILE;
  let tx, ty;
  // 优先从最近/随机的巢穴附近生成敌人
  const src = spawners.length ? spawners[(Math.random() * spawners.length) | 0] : null;
  if (src) {
    const gx = Math.round(src.x / TILE), gy = Math.round(src.y / TILE);
    const dist = 3 + Math.random() * 4;
    const ang = Math.random() * Math.PI * 2;
    tx = Math.round(gx + Math.cos(ang) * dist);
    ty = Math.round(gy + Math.sin(ang) * dist);
    for (let i = 0; i < 8; i++) {
      const cx2 = tx + Math.floor(Math.random() * 5) - 2;
      const cy2 = ty + Math.floor(Math.random() * 5) - 2;
      if (!isWater(cx2, cy2) && !entAt(cx2, cy2)) { tx = cx2; ty = cy2; break; }
    }
  } else {
    // 兜底：无巢穴时（巢穴尚未生成或全部被摧毁）在玩家远处生成
    const dist = 16 + Math.random() * 9;
    const ang = Math.random() * Math.PI * 2;
    tx = Math.round(px + Math.cos(ang) * dist);
    ty = Math.round(py + Math.sin(ang) * dist);
    for (let i = 0; i < 8; i++) {
      const cx2 = tx + Math.floor(Math.random() * 5) - 2;
      const cy2 = ty + Math.floor(Math.random() * 5) - 2;
      if (!isWater(cx2, cy2) && !entAt(cx2, cy2)) { tx = cx2; ty = cy2; break; }
    }
  }
  const t = pickEnemyType();
  const def = scaledDef(ENEMY_TYPES[t]);
  G.enemies.push({
    x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2,
    hp: def.hp, maxhp: def.hp, dead: false, dir: 0,
    type: t, kind: def.kind, speed: def.speed, size: def.size, dmg: def.dmg,
    color: def.color, attackT: 0, fireT: 0
  });
}

function updateEnemies(dt) {
  if (!G.enemies) return;
  // 推进自然进化（战斗开启时）
  updateEvolution(dt);
  const p = G.player;
  const pR = 9;   // 玩家碰撞半径（格）
  for (const en of G.enemies) {
    if (en.dead) continue;
    // 巢穴不移动、不攻击，仅作为生产点
    if (en.kind === 'spawner') continue;
    en.attackT = (en.attackT || 0) - dt;
    en.fireT = (en.fireT || 0) - dt;
    // 兼容旧档敌人：补充默认字段
    if (en.speed === undefined) { en.speed = 22; en.size = 8; en.dmg = 5; en.kind = 'melee'; en.maxhp = en.hp || 40; if (!en.color) en.color = enemyColor(en.hp, en.maxhp); }
    const dx = p.x - en.x, dy = p.y - en.y;
    const d = Math.hypot(dx, dy) / TILE;   // 距离（格）
    if (en.kind === 'ranged') {
      // 远程敌人：与玩家保持距离，射程内间歇性吐痰
      const range = (en.type === 'worm' || en.type === 'big-worm') ? (en.type === 'big-worm' ? 12 : 10) : 8;
      const keep = en.type === 'big-worm' ? 8 : (en.type === 'worm' ? 7 : 5);
      if (d > range) {
        en.x += (dx / d) * en.speed * dt;
        en.y += (dy / d) * en.speed * dt;
      } else if (d < keep) {
        en.x -= (dx / d) * en.speed * dt;
        en.y -= (dy / d) * en.speed * dt;
      }
      // 吐痰（投射物）；喷火虫/巨型蠕虫吐火球（命中造成持续灼烧）
      if (en.fireT <= 0 && d <= range) {
        en.fireT = en.type === 'worm' || en.type === 'big-worm' ? 2.2 : 1.6;
        const fire = en.type === 'fire-spitter' || en.type === 'big-worm';
        (G.enemyProjectiles || (G.enemyProjectiles = [])).push({
          x: en.x, y: en.y - en.size, tx: p.x, ty: p.y, speed: 3.2, dmg: en.dmg, t: 0,
          fire: fire, color: fire ? '#ff8a2a' : '#9ac04a'
        });
      }
    } else {
      // 近战敌人：冲向玩家，贴近后咬人
      if (d > 1.1) {
        en.x += (dx / d) * en.speed * dt;
        en.y += (dy / d) * en.speed * dt;
      } else if (en.attackT <= 0) {
        en.attackT = 1.0;
        if (G.settings.combat) damagePlayer(en.dmg);
      }
    }
  }
  // 更新远程投射物，命中玩家扣血
  if (G.enemyProjectiles) {
    for (const pr of G.enemyProjectiles) {
      const dx = pr.tx - pr.x, dy = pr.ty - pr.y;
      const d = Math.hypot(dx, dy);
      const step = pr.speed * TILE * dt;
      if (d <= step) {
        pr.hit = true;
        damagePlayer(pr.dmg);
        // 火球命中：额外灼烧伤害（模拟持续灼烧）
        if (pr.fire) damagePlayer(pr.dmg * 0.6);
        continue;
      }
      pr.x += (dx / d) * step;
      pr.y += (dy / d) * step;
    }
    G.enemyProjectiles = G.enemyProjectiles.filter(pr => !pr.hit);
  }
  // 击杀敌人推进战斗进化（含巢穴），提升进化度；被击杀的敌人掉落少量矿石（对齐《异星工厂》）
  let kills = 0;
  G.enemies = G.enemies.filter(e => {
    if (e.dead) { kills++; dropEnemyLoot(e); return false; }
    return true;
  });
  if (kills > 0) addEvolution(EVOLUTION_KILL_RATE * kills);
}

// ===== 敌人掉落（对齐《异星工厂》：击杀虫群/巢穴会掉落少量矿石）=====
// 敌人被击杀后，在死亡位置附近掉落少量矿石，供玩家拾取；巢穴掉落更多且大概率含铀矿。
function dropEnemyLoot(e) {
  if (!e || !e.x || !e.y) return;
  // 巢穴被摧毁掉落更多（含少量铀矿，助力核能）；普通敌人掉 1-2 块矿石
  const isSpawner = e.kind === 'spawner';
  if (!G.lootDrops) G.lootDrops = [];
  const n = isSpawner ? 3 + ((Math.random() * 3) | 0) : 1 + ((Math.random() * 2) | 0);
  for (let i = 0; i < n; i++) {
    // 巢穴约 20% 概率掉铀矿，其余掉铁矿/铜矿/煤/石头；普通敌人随机一种基础矿
    let ore;
    const r = Math.random();
    if (isSpawner && r < 0.2) ore = 'uranium-ore';
    else if (isSpawner && r < 0.35) ore = 'stone';
    else {
      const pool = ['iron-ore', 'copper-ore', 'coal', 'stone'];
      ore = pool[(Math.random() * pool.length) | 0];
    }
    G.lootDrops.push({
      x: e.x + (Math.random() - 0.5) * 24,
      y: e.y + (Math.random() - 0.5) * 24,
      id: ore, vx: (Math.random() - 0.5) * 40, vy: -20 - Math.random() * 20,
      t: 0, life: 8
    });
  }
}

// 更新地面掉落物：飘落、玩家靠近自动拾取、超时消失
function updateLootDrops(dt) {
  if (!G.lootDrops || G.lootDrops.length === 0) return;
  const p = G.player;
  const pickR = REACH_PX * 0.9;
  for (const d of G.lootDrops) {
    d.t += dt;
    // 简易抛物线：先上抛后落地
    d.vy += 60 * dt;
    d.x += d.vx * dt;
    d.y += d.vy * dt;
    if (d.y > (Math.floor(d.y / TILE) + 0.9) * TILE) d.y = (Math.floor(d.y / TILE) + 0.9) * TILE;
    // 玩家靠近自动拾取
    if (Math.hypot(d.x - p.x, d.y - p.y) < pickR) {
      invAdd(d.id, 1);
      if (typeof toast === 'function' && d.id === 'uranium-ore') toast('拾取 铀矿石');
      d.picked = true;
    }
  }
  G.lootDrops = G.lootDrops.filter(d => !d.picked && d.t < d.life);
  if (G.lootDrops.length === 0) G.lootDrops = undefined;
}

function damagePlayer(dmg) {
  if (G.dbg && G.dbg.infinite) return;
  // 载具装甲减免：驾驶坦克时受伤大幅减少；驾驶装甲车小幅减少
  if (G.driving && G.driving.ent) {
    const v = G.driving.ent;
    if (v instanceof Tank) dmg *= TANK_ARMOR;
    else if (v && typeof v.type === 'string' && v.type === 'car') dmg *= 0.8;
  }
  // 玩家护甲减免：装备护甲后进一步减伤
  if (G.armor) {
    const a = ARMORS[G.armor];
    if (a && a.protect) dmg *= a.protect;
  }
  dmg = Math.max(0, dmg);
  G.playerHP -= dmg;
  if (G.playerHP <= 0) {
    G.playerHP = 0;
    // 玩家阵亡：清空附近敌人并重置于出生点，HP 回满
    if (typeof toast === 'function') toast('你阵亡了！已回到出生点');
    G.enemies = []; G.enemyProjectiles = [];
    G.player.x = G.spawn.x * TILE + TILE / 2;
    G.player.y = G.spawn.y * TILE + TILE / 2;
    G.cam.px = G.player.x; G.cam.py = G.player.y;
    G.playerHP = G.playerHPmax;
  }
  uiDirty = true;
}

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
    // 地雷爆炸特效：仅视觉短促闪光，无需额外伤害（已由 removeEnt 前引爆）
  }
  G.bullets = G.bullets.filter(b => b.t < b.life);
}

// ===== 玩家武器 =====
// 武器数据：伤害、射速、弹药、弹种
const WEAPONS = {
  'pistol':          { name: '手枪',   dmg: 10, rate: 0.3, ammo: 'magazine',        spread: 0.06, auto: false, range: 7 },
  'submachine-gun':  { name: '冲锋枪', dmg: 7,  rate: 0.1, ammo: 'magazine',        spread: 0.12, auto: true,  range: 7 },
  'shotgun':         { name: '散弹枪', dmg: 6,  rate: 0.5, ammo: 'piercing-rounds', spread: 0.4,  auto: false, range: 6, pellets: 6 },
  'rocket-launcher': { name: '火箭筒', dmg: 35, rate: 1.1, ammo: 'rocket',          spread: 0.03, auto: false, range: 9, splash: 1.8 },
  'grenade':         { name: '手雷',   dmg: 40, rate: 0.8, ammo: 'grenade',          spread: 0.05, auto: false, range: 6, splash: 2.5 },
  'flamethrower':    { name: '火焰喷射器', dmg: 6, rate: 0.12, ammo: 'petroleum-gas', spread: 0.2, auto: true, range: 6, flame: true },
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
  // 弹药检查：火焰喷射器消耗石油气（流体），其余消耗物品
  if (w.ammo === 'petroleum-gas') {
    if (invCount('petroleum-gas') < 1) return;
    invTake('petroleum-gas', 1);
  } else {
    if (invCount(w.ammo) < 1) return;
    invTake(w.ammo, 1);
  }
  const baseAng = Math.atan2(ty - py, tx - px);
  const pellets = w.pellets || 1;
  for (let i = 0; i < pellets; i++) {
    const a = baseAng + (Math.random() - 0.5) * 2 * w.spread;
    const dist = w.range * TILE;
    const tx2 = px + Math.cos(a) * dist;
    const ty2 = py + Math.sin(a) * dist;
    if (w.splash) {
      // 火箭弹：命中目标后范围爆炸
      (G.bullets || (G.bullets = [])).push({
        x: px, y: py, tx: tx2, ty: ty2, t: 0, life: 0.18,
        splash: w.splash, dmg: w.dmg, kind: 'rocket'
      });
    } else if (w.flame) {
      (G.bullets || (G.bullets = [])).push({
        x: px, y: py, tx: tx2, ty: ty2, t: 0, life: 0.2, dmg: w.dmg, kind: 'flame'
      });
    } else {
      (G.bullets || (G.bullets = [])).push({
        x: px, y: py, tx: tx2, ty: ty2, t: 0, life: 0.12, dmg: w.dmg, kind: 'bullet'
      });
    }
  }
  uiDirty = true;
}
// 玩家开火更新：按住空格/左键对敌人持续射击
function updatePlayerFire(dt) {
  if (!G.weapon || !G.settings.combat) return;
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
  G.playerFireT = w.rate;
}
// 玩家子弹命中敌人（沿子弹飞行路径检测）
function updatePlayerBulletHits(dt) {
  if (!G.bullets) return;
  // 性能优化：预先收集存活敌人列表（避免每颗子弹都遍历 dead 敌人）
  const alive = (G.enemies || []).filter(e => !e.dead);
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
  if (Math.hypot(cx - G.player.x, cy - G.player.y) <= radius * TILE * 0.5) damagePlayer(dmg * 0.4);
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
  invTake(id, 1);
  const c = CAPSULES[id];
  if (!G.combatRobots) G.combatRobots = [];
  // 一次投掷释放 2 只（destroyer 1 只）
  const n = id === 'destroyer-capsule' ? 1 : 2;
  for (let i = 0; i < n; i++) {
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
  const enemies = (G.enemies || []).filter(e => !e.dead);
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
  G.combatRobots = G.combatRobots.filter(r => !r.dead);
}

// 手雷：从背包使用时投掷爆炸（由 ui.js 调用）。
// 投掷物复用 splash 爆炸路径（kind 用 'rocket'，由 updatePlayerBulletHits 的 splash 分支处理爆炸）。
function throwGrenade(tx, ty) {
  if (invCount('grenade') < 1) return;
  if (!G.settings.combat) {
    if (typeof toast === 'function') toast('需在设置中开启战斗才能投掷手雷');
    return;
  }
  invTake('grenade', 1);
  const px = G.player.x, py = G.player.y;
  // 投掷目标点：传入的是瓦片坐标，转换为世界坐标；若玩家在范围内则向目标投掷
  let gx = tx * TILE + TILE / 2, gy = ty * TILE + TILE / 2;
  (G.bullets || (G.bullets = [])).push({
    x: px, y: py, tx: gx, ty: gy,
    t: 0, life: 0.45, dmg: 40, splash: 2.5, kind: 'rocket'
  });
  if (typeof toast === 'function') toast('💣 投掷手雷');
  uiDirty = true;
}

// ===== 激光炮塔 =====
// 吃电力、无需弹药、射程更远（对齐《异星工厂》Laser turret）
const LASER_RANGE = 9;
const LASER_FIRE_RATE = 0.35;
const LASER_DMG = 14;
class LaserTurret extends Entity {
  constructor(type, x, y) {
    super('laser-turret', x, y);
    this.cooldown = 0;
    this.target = null;
    this.facing = 0;
    this.beamT = 0;
  }
  update(dt) {
    this.cooldown -= dt;
    this.beamT = Math.max(0, this.beamT - dt);
    this.target = null;
    if (G.power.sat <= 0) return;
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    let best = null, bestD = Infinity;
    for (const en of (G.enemies || [])) {
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
    best.hp -= LASER_DMG;
    this.beamT = 0.15;
    (G.bullets || (G.bullets = [])).push({
      x: (this.x + this.w / 2) * TILE, y: (this.y + this.h / 2) * TILE,
      tx: best.x, ty: best.y, t: 0, life: 0.1, dmg: 0, kind: 'laser'
    });
    if (best.hp <= 0) best.dead = true;
  }
  powerDemand() { return 180; }
  serialize() { return super.serialize(); }
  static restore(s) { return super.restore(s); }
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
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  if (!(LOD && LOD.simple)) {
    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('激光', cx, cy + 20);
  }
  ctx.globalAlpha = 1;
}
function laserTurretPanelHtml(e) {
  let h = row('电力', powerStatusLiveHtml(e), 'power');
  h += '<div class="status"></div>';
  h += '<div class="dim">激光炮塔：吃电力自动发射激光攻击射程内（' + LASER_RANGE + ' 格）敌人，无需弹药，伤害高于机枪。供电不足时停止开火。配合石墙构筑防线（2×2）。</div>';
  return h;
}
function laserTurretPanelLive(e, api) {
  api.set('power', powerStatusLiveHtml(e));
  if (G.power.sat <= 0) api.status('已暂停：缺电', 'warn');
  else if (e.target) api.status('开火中：激光攻击敌人', 'ok');
  else api.status('待机：射程内无敌人', 'ok');
}
function laserTurretTip(e) {
  return e.target ? '开火中（激光）' : (G.power.sat <= 0 ? '缺电停摆' : '待机（无需弹药）');
}

// ===== 火焰炮塔 =====
// 喷射火焰造成持续灼烧，消耗石油气，范围杀伤（对齐《异星工厂》Flamethrower turret）
const FT_RANGE = 6;
const FT_FIRE_RATE = 0.3;
const FT_DMG = 8;
const FT_FLUID_CAP = 200;
class FlamethrowerTurret extends Entity {
  constructor(type, x, y) {
    super('flamethrower-turret', x, y);
    this.fluid = {};       // { 'petroleum-gas': n }
    this.cooldown = 0;
    this.target = null;
    this.facing = 0;
  }
  giveItem(item) {
    if (item === 'petroleum-gas') {
      if ((this.fluid['petroleum-gas'] || 0) >= FT_FLUID_CAP) return false;
      this.fluid['petroleum-gas'] = (this.fluid['petroleum-gas'] || 0) + 1;
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
    // 底部(南)一格接石油气
    const n = neighborOnSideCell(this, (1 + (this.dir | 0)) % 4, 0);
    if (n instanceof Pipe && n.fluid['petroleum-gas'] > 0 && (this.fluid['petroleum-gas'] || 0) < FT_FLUID_CAP && n.takeItemOf('petroleum-gas')) {
      this.fluid['petroleum-gas'] = (this.fluid['petroleum-gas'] || 0) + 1;
    }
  }
  update(dt) {
    this.cooldown -= dt;
    this.target = null;
    this.fluidPort();
    if (G.power.sat <= 0) return;
    if ((this.fluid['petroleum-gas'] || 0) <= 0) return;
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    let best = null, bestD = Infinity;
    for (const en of (G.enemies || [])) {
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
    this.fluid['petroleum-gas']--;
    if (this.fluid['petroleum-gas'] <= 0) delete this.fluid['petroleum-gas'];
    // 喷射火焰覆盖锥形范围
    const ang = this.facing;
    for (const en of G.enemies) {
      if (en.dead) continue;
      const dx = en.x - (this.x + this.w / 2) * TILE, dy = en.y - (this.y + this.h / 2) * TILE;
      const d = Math.hypot(dx, dy);
      if (d > FT_RANGE * TILE) continue;
      const da = Math.abs(normAng(Math.atan2(dy, dx) - ang));
      if (da < 0.5) { en.hp -= FT_DMG; if (en.hp <= 0) en.dead = true; }
    }
    (G.bullets || (G.bullets = [])).push({
      x: (this.x + this.w / 2) * TILE, y: (this.y + this.h / 2) * TILE,
      tx: best.x, ty: best.y, t: 0, life: 0.3, dmg: 0, kind: 'flame'
    });
  }
  powerDemand() { return 200; }
  serialize() { const s = super.serialize(); s.fluid = this.fluid; return s; }
  static restore(s) { const t = super.restore(s); t.fluid = s.fluid || {}; return t; }
}
function normAng(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
function drawFlamethrowerTurret(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#6a4a3a';
  rr(ctx, px + 4, py + 4, s - 8, s - 8, 8); ctx.fill();
  ctx.strokeStyle = '#463028';
  ctx.lineWidth = 3;
  rr(ctx, px + 4, py + 4, s - 8, s - 8, 8); ctx.stroke();
  const cx = px + s / 2, cy = py + s / 2;
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
  const fl = (e.fluid && e.fluid['petroleum-gas']) || 0;
  if (fl > 0) {
    ctx.fillStyle = '#d0a04a';
    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('油:' + fl, cx, cy + 22);
  }
  ctx.globalAlpha = 1;
}
function flameTurretPanelHtml(e) {
  let h = row('石油气', (e.fluid['petroleum-gas'] || 0) > 0 ? ((e.fluid['petroleum-gas'] || 0) + ' 单位') : '<span class="dim">空</span>', 'fluid');
  const n = Math.min(invCount('petroleum-gas'), FT_FLUID_CAP - (e.fluid['petroleum-gas'] || 0));
  if (n > 0) h += '<button data-action="feed" data-id="petroleum-gas">放入石油气 ×' + n + '</button>';
  h += '<div class="status"></div>';
  h += '<div class="dim">火焰炮塔：消耗石油气喷射火焰，对锥形范围敌人造成持续灼烧伤害。可从底部输入口相邻管道自动吸入石油气（2×2）。</div>';
  return h;
}
function flameTurretPanelLive(e, api) {
  api.set('fluid', (e.fluid['petroleum-gas'] || 0) > 0 ? ((e.fluid['petroleum-gas'] || 0) + ' 单位') : dimSpan('空'));
  const fl = e.fluid['petroleum-gas'] || 0;
  if (G.power.sat <= 0) api.status('已暂停：缺电', 'warn');
  else if (fl <= 0) api.status('已暂停：缺石油气（管道或按钮放入）', 'warn');
  else if (e.target) api.status('喷射中：灼烧敌人', 'ok');
  else api.status('待机：射程内无敌人', 'ok');
}
function flameTurretTip(e) {
  if (G.power.sat <= 0) return '缺电停摆';
  if ((e.fluid['petroleum-gas'] || 0) <= 0) return '缺石油气';
  return e.target ? '喷射中（火焰）' : '待机';
}

// ===== 注册 =====
ENT_CLASSES['laser-turret'] = LaserTurret;
ENT_CLASSES['flamethrower-turret'] = FlamethrowerTurret;
DEVICE_RENDER['laser-turret'] = drawLaserTurret;
DEVICE_RENDER['flamethrower-turret'] = drawFlamethrowerTurret;
DEVICE_STATUS['laser-turret'] = e => (G.power.sat <= 0 ? 'r' : (e.target ? 'g' : 'y'));
DEVICE_STATUS['flamethrower-turret'] = e => (G.power.sat <= 0 ? 'r' : ((e.fluid['petroleum-gas'] || 0) <= 0 ? 'r' : (e.target ? 'g' : 'y')));
DEVICE_PANEL['laser-turret'] = { html: laserTurretPanelHtml, live: laserTurretPanelLive, tip: laserTurretTip };
DEVICE_PANEL['flamethrower-turret'] = { html: flameTurretPanelHtml, live: flameTurretPanelLive, tip: flameTurretTip };
DEVICE_DIR_ROTATE['laser-turret'] = true;
DEVICE_DIR_ROTATE['flamethrower-turret'] = true;
