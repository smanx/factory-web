'use strict';

// ===== 战斗体系扩充（对齐《异星工厂》基础版军事体系）=====
// 新增：激光炮塔、火焰炮塔、玩家武器（手枪/冲锋枪/散弹枪/火箭筒/火焰喷射器）、
// 手雷、玩家生命值与敌人伤害、多种敌人类型（小虫/大虫/远程吐痰虫/蠕虫）。

// ===== 敌人类型表 =====
// kind: 'melee'（近战冲撞）| 'ranged'（远程吐痰）
// evolution: 该类型刷出所需的最低进化度（0~1），越高越强（对齐《异星工厂》敌人随进化度解锁更强变种）
const ENEMY_TYPES = {
  'small-biter':  { name: '小虫',   hp: 30,  speed: 2.3, size: 6,  dmg: 4,  color: '#d05040', kind: 'melee',   xp: 1, evolution: 0 },
  'medium-biter': { name: '大虫',   hp: 80,  speed: 1.75,size: 9,  dmg: 9,  color: '#b03a30', kind: 'melee',   xp: 2, evolution: 0.05 },
  'spitter':      { name: '吐痰虫', hp: 50,  speed: 1.75,size: 7,  dmg: 7,  color: '#8a6a2a', kind: 'ranged', xp: 2, evolution: 0.15 },
  'worm':         { name: '蠕虫',   hp: 120, speed: 0,   size: 12, dmg: 12, color: '#6a4a3a', kind: 'ranged', xp: 3, evolution: 0.2 },
  // 进化变种（需更高进化度，属性更强）
  'heavy-biter':  { name: '重甲虫', hp: 150, speed: 1.75,size: 11, dmg: 16, color: '#8a2a2a', kind: 'melee',   xp: 4, evolution: 0.35 },
  'fire-spitter': { name: '喷火虫', hp: 120, speed: 1.75,size: 9,  dmg: 18, color: '#d08a2a', kind: 'ranged', xp: 4, evolution: 0.5 },
  'big-worm':     { name: '巨型蠕虫', hp: 300, speed: 0,   size: 16, dmg: 24, color: '#4a3a2a', kind: 'ranged', xp: 6, evolution: 0.6 },
  'huge-biter':   { name: '巨兽虫', hp: 500, speed: 1.75,size: 15, dmg: 32, color: '#5a1a2a', kind: 'melee',   xp: 8, evolution: 0.8 },
  // 终局变种（对齐《异星工厂》Behemoth 巨兽级，进化度 0.9+）：属性最强，需最先进火力应对
  'behemoth-biter':   { name: '巨兽甲虫', hp: 1200, speed: 1.45,size: 19, dmg: 56, color: '#3a1018', kind: 'melee',   xp: 16, evolution: 0.9 },
  'behemoth-spitter': { name: '巨兽吐痰虫', hp: 900, speed: 1.45,size: 14, dmg: 48, color: '#5a3a1a', kind: 'ranged', xp: 14, evolution: 0.92 },
  'behemoth-worm':    { name: '巨兽蠕虫', hp: 1500, speed: 0,  size: 20, dmg: 55, color: '#2e1c14', kind: 'ranged', xp: 22, evolution: 0.95 }
};

// ===== 敌人进化度系统（对齐《异星工厂》Evolution factor） =====
// 进化度 0~1，原版由三大来源共同推进：
//   1. 时间（自然进化，最慢）；
//   2. 污染产生（工业活动越密集、排放大，虫群进化越快，为主来源）；
//   3. 击杀敌人/摧毁巢穴（战斗进化）。
// 三者速度都大幅调慢，避免开局短短几分钟就进化到高等级压垮玩家。
// 进化度越高，刷出的敌人越强、越容易出现高级变种；同时敌人基础属性按进化度小幅增强。
// 对齐原版：进化度不会随时间无脑涨满，而是随玩家“真正去搞工业/打架”才明显上升。
const EVOLUTION_TIME_RATE = 0.00028;   // 每秒自然进化增量（约 60 分钟到 1.0，远慢于原 11 分钟）
const EVOLUTION_KILL_RATE = 0.0035;    // 每击杀一个敌人进化增量（含巢穴，原 0.012 过快）
const EVOLUTION_POLLUTION_RATE = 0.00012; // 每单位污染产生量对应的进化增量（约产生 8300 污染进化到 1.0）
function evolutionFactor() { return G.evolution || 0; }
function addEvolution(amount) {
  G.evolution = Math.min(1, (G.evolution || 0) + amount);
}
// 污染驱动进化：由污染产生量推进进化度（对齐《异星工厂》：污染是进化主来源）
function advancePollutionEvolution(amount) {
  if (!G || !G.settings || !G.settings.combat) return;
  const ecfg = (typeof enemyConfig === 'function') ? enemyConfig() : { peaceful: false };
  if (ecfg.none) return;   // “无”模式无敌人，无进化
  addEvolution((amount || 0) * EVOLUTION_POLLUTION_RATE);
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
    ['huge-biter', 0.8],
    // 终局 Behemoth 巨兽级（进化度 0.9+）
    ['behemoth-biter', 0.9],
    ['behemoth-spitter', 0.92],
    ['behemoth-worm', 0.95]
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
const SPAWNER_TARGET = 2;        // 同时存在的巢穴目标数（历史上用于巢穴上限，现由 spawnerCapByEvo() 动态计算取代，保留作参考）
const SPAWNER_RANGE = 14;        // 巢穴生成敌人的距离（格）
const ENEMY_AGGRO_RANGE = 8;     // 主角靠近该距离（格）内，聚集在虫巢周围的虫子主动攻击主角（触发追踪距离）
// 主角拉开到该距离（格）后，正在追踪的敌人才会停止追踪/攻击（迟滞：为靠近触发距离的两倍，拉开才合理）
const ENEMY_DEAGGRO_RANGE = ENEMY_AGGRO_RANGE * 2;   // 敌人丢失目标的距离 = 靠近触发距离 × 2
const ENEMY_CHASE_GIVE_UP_RANGE = 22;   // 主角逃出该距离（格）后敌人放弃追击（即便虫巢被污染激怒），视为丢失目标回巢
const ENEMY_LINGER_TIME = 5;     // 敌人丢失目标后先原地游荡的时长（秒），随后返回虫巢点聚集

function makeSpawner() {
  const px = G.player.x / TILE, py = G.player.y / TILE;
  // 在玩家远处（22~32 格）生成巢穴，尽量避开水面/建筑
  for (let i = 0; i < 12; i++) {
    const dist = 22 + Math.random() * 10;
    const ang = Math.random() * Math.PI * 2;
    const tx = Math.round(px + Math.cos(ang) * dist);
    const ty = Math.round(py + Math.sin(ang) * dist);
    if ((!isWater(tx, ty) && !isCliff(tx, ty) && !isTree(tx, ty)) && !entAt(tx, ty)) {
      return spawnerAt(tx, ty);
    }
  }
  return null;
}

// ===== 敌人基地扩张（对齐《异星工厂》Biter expansion）=====
// 虫巢会周期性派出“扩张党”在远处建立新巢穴，世界中的敌人领地会随时间不断蔓延，
// 比“巢穴不足才补位”更贴近原版：即使玩家清剿了某片巢穴，其它巢穴仍会向四周扩张。
// 扩张会尽量避开玩家所在的出生区（距玩家过近不建），避免开局即被巢穴包围。
// 对齐《异星工厂》原版：虫巢扩张受“进化度”与“污染”共同影响——
// 进化度越高、污染越重，扩张越频繁；前期几乎不扩张，避免开局就被巢穴包围。
const EXPAND_MIN_INTERVAL = 90;    // 最短扩张间隔（秒，原 45）
const EXPAND_BASE_INTERVAL = 300;  // 基础扩张间隔（秒，原 120，前期更难得扩张）
const EXPAND_RANGE_MIN = 9;        // 距父巢穴最近距离（格）
const EXPAND_RANGE_MAX = 16;       // 距父巢穴最远距离（格）
const EXPAND_PLAYER_GAP = 14;      // 扩张巢穴距玩家至少保持的格数（原 12）
// 总巢穴数量上限：随进化度略微放宽，但整体收紧（前期更少巢穴，进展更慢）
function spawnerCapByEvo() {
  const evo = evolutionFactor();
  const base = G.techDone['advanced-combat'] ? 3 : 2;
  return base + (evo > 0.45 ? 1 : 0) + (evo > 0.85 ? 1 : 0);
}
// 虫巢占地：4×4 格（对齐《异星工厂》Enemy spawner 的 footprint）
const SPAWNER_FOOT = 4;   // 边长（格）

// 判断以 (tx,ty) 为左上角的 SPAWNER_FOOT×SPAWNER_FOOT 区域是否可用于放置虫巢
function spawnerAreaFree(tx, ty) {
  for (let dy = 0; dy < SPAWNER_FOOT; dy++) {
    for (let dx = 0; dx < SPAWNER_FOOT; dx++) {
      if (isWater(tx + dx, ty + dy) || isCliff(tx + dx, ty + dy) || isTree(tx + dx, ty + dy) || entAt(tx + dx, ty + dy)) return false;
    }
  }
  // 避免与其它虫巢占地重叠（虫巢不在 G.ents 网格中，需手动检查）
  const src = G.enemies || EMPTY_ARR;
  for (let i = 0; i < src.length; i++) {
    const s = src[i];
    if (s.dead || s.kind !== 'spawner') continue;
    const scx = Math.floor(s.x / TILE), scy = Math.floor(s.y / TILE);
    const h = SPAWNER_FOOT / 2;
    // 两虫巢的占地矩形（各自覆盖 [中心±h) 格）是否重叠
    if (tx < scx + h && tx + SPAWNER_FOOT > scx - h &&
        ty < scy + h && ty + SPAWNER_FOOT > scy - h) return false;
  }
  return true;
}

// 判断目标格 (tx,ty) 是否落在任一虫巢的 SPAWNER_FOOT×SPAWNER_FOOT 占地内
// （虫巢不在 G.ents 网格中，entAt 检测不到，需在此手动判断，供敌人生成时避开虫巢占地）
function onSpawner(tx, ty) {
  const src = G.enemies || EMPTY_ARR;
  for (let i = 0; i < src.length; i++) {
    const s = src[i];
    if (s.dead || s.kind !== 'spawner') continue;
    const scx = Math.floor(s.x / TILE), scy = Math.floor(s.y / TILE);
    const h = SPAWNER_FOOT / 2;
    if (tx >= scx - h && tx < scx + h && ty >= scy - h && ty < scy + h) return true;
  }
  return false;
}

// 在一个目标格生成巢穴（若该格可用）；不可用返回 null
function spawnerAt(tx, ty) {
  if (!spawnerAreaFree(tx, ty)) return null;
  return {
    x: (tx + (SPAWNER_FOOT - 1) / 2) * TILE, y: (ty + (SPAWNER_FOOT - 1) / 2) * TILE,
    hp: SPAWNER_HP, maxhp: SPAWNER_HP, dead: false, dir: 0,
    type: 'spawner', kind: 'spawner', speed: 0, size: SPAWNER_FOOT * TILE * 0.42, dmg: 0,
    color: '#5a3a8a', attackT: 0, fireT: 0, foot: SPAWNER_FOOT
  };
}
// 尝试让某个巢穴向远处扩张出一个新巢穴，成功返回 true
function expandFromSpawner(parent) {
  const px = G.player.x / TILE, py = G.player.y / TILE;
  const sx = Math.round(parent.x / TILE), sy = Math.round(parent.y / TILE);
  // 尽量朝“远离玩家”的扇形方向扩张，但带一定随机性；同时保证新巢穴距玩家不近于 EXPAND_PLAYER_GAP
  for (let i = 0; i < 16; i++) {
    // 与父巢到玩家的连线夹角偏向远离玩家侧（±60°），偶尔也允许其他方向
    const toPlayer = Math.atan2(py - sy, px - sx);
    const spread = (Math.random() * 2 - 1) * 1.1; // 扇形宽
    const ang = toPlayer + (Math.random() < 0.7 ? Math.PI + spread : Math.random() * Math.PI * 2);
    const dist = EXPAND_RANGE_MIN + Math.random() * (EXPAND_RANGE_MAX - EXPAND_RANGE_MIN);
    const tx = Math.round(sx + Math.cos(ang) * dist);
    const ty = Math.round(sy + Math.sin(ang) * dist);
    const pd = Math.hypot(tx - px, ty - py);
    if (pd < EXPAND_PLAYER_GAP) continue;
    const s = spawnerAt(tx, ty);
    if (s) { G.enemies.push(s); return true; }
  }
  return false;
}
// 每帧推进扩张计时，到点且满足条件时触发一次扩张

// 每帧懒计算并复用 spawner（巢穴）列表（P0 优化）：
// updateExpansion / spawnEnemies / updateWaves 三处每帧各做一次
// G.enemies.filter(...) 会分配新数组造成 GC 压力；改为每帧只算一次并复用同一数组。
// 由主循环在每帧 combat 块开头调用 resetSpawnerCache() 使缓存失效。
function resetSpawnerCache() { G._spawnerList = null; }
function getSpawnerList() {
  if (G._spawnerList) return G._spawnerList;
  const list = [];
  const src = G.enemies || EMPTY_ARR;
  for (let i = 0; i < src.length; i++) if (src[i].kind === 'spawner' && !src[i].dead) list.push(src[i]);
  G._spawnerList = list;
  return list;
}

// 敌人所属虫巢（home 记录的坐标）对应的虫巢是否仍存活（未被摧毁）。
// 虫巢被摧毁后敌人才会知道原巢已不在，从而改投最近的其它在世虫巢（需求：找不到最开始的虫巢就返回最近的虫巢聚集）。
function homeSpawnerExists(home) {
  if (!home) return false;
  const hcx = Math.round(home.x / TILE), hcy = Math.round(home.y / TILE);
  const spawners = getSpawnerList();
  for (const s of spawners) {
    const scx = Math.floor(s.x / TILE), scy = Math.floor(s.y / TILE);
    if (scx === hcx && scy === hcy) return true;
  }
  return false;
}

// 找距离 (x,y) 最近的在世虫巢；没有则返回 null。
function nearestSpawner(x, y) {
  const spawners = getSpawnerList();
  let best = null, bestD = Infinity;
  for (const s of spawners) {
    const d = Math.hypot(s.x - x, s.y - y);
    if (d < bestD) { bestD = d; best = s; }
  }
  return best;
}

function updateExpansion(dt) {
  if (!G.settings.combat) return;
  // “无”模式不生成虫巢（完全不刷敌人）
  const ecfg = (typeof enemyConfig === 'function') ? enemyConfig() : { peaceful: false };
  if (ecfg.none) return;
  if (!G.enemies) G.enemies = [];
  const spawners = getSpawnerList();
  if (spawners.length === 0) { G.expandT = 0; return; }
  const cap = spawnerCapByEvo();
  if (spawners.length >= cap) { G.expandT = 0; return; }
  const evo = evolutionFactor();
  // 扩张间隔受进化度与污染共同影响（对齐《异星工厂》：污染越重虫群越躁动、越爱扩张）。
  // 污染因素取当前全局污染值占阈值比例（0~1+），参与缩短间隔；整体仍受基础间隔约束，前期不轻易扩张。
  const pollutionRatio = Math.min(1.2, (G.pollution || 0) / POLLUTION_WAVE_THRESHOLD);
  const interval = Math.max(EXPAND_MIN_INTERVAL, EXPAND_BASE_INTERVAL * (1 - evo * 0.55) * (1 - pollutionRatio * 0.3));
  G.expandT = (G.expandT || 0) + dt;
  if (G.expandT < interval) return;
  G.expandT = 0;
  // 随机挑一个父巢穴扩张
  const parent = spawners[(Math.random() * spawners.length) | 0];
  if (parent && expandFromSpawner(parent)) {
    if (typeof playSfx === 'function') playSfx('spawn');
    // 轻微播报，让玩家感知领地蔓延
    if (typeof toast === 'function') toast('⚠ 探测到虫巢向外扩张，出现新的巢穴');
  }
}

function spawnEnemies(dt) {
  if (!G.enemies) G.enemies = [];
  // 敌人强度配置（对齐《异星工厂》新游戏敌人设置）：“无”模式不刷敌人；和平模式会刷敌但由 AI 保证不进攻
  const ecfg = (typeof enemyConfig === 'function') ? enemyConfig() : { peaceful: false, spawnMult: 1 };
  if (ecfg.none) return;
  G.spawnT = (G.spawnT || 0) + dt;
  // 敌人数量越多刷新越慢；火箭时代可允许更多敌人同时在场；高敌人强度提高上限。
  // 对齐《异星工厂》：敌人主要在虫巢周围聚集，整体受控而非无限膨胀（原版单图敌人有硬上限）。
  // 故下调基数，让虫群集结更缓慢、进攻压力更循序渐进。
  const cap = Math.round((G.techDone['advanced-combat'] ? 60 : 34) * ecfg.spawnMult);
  if (G.enemies.length >= cap) return;
  // 维护巢穴数量：不足则在远处生成新巢穴（初始布点由扩张系统接管后，这里仍保留保底补位）
  const spawners = getSpawnerList();
  const spawnerCap = spawnerCapByEvo();
  if (spawners.length < spawnerCap && G.spawnT > 3) {
    const s = makeSpawner();
    if (s) G.enemies.push(s);
  }
  // 高敌人强度 → 刷新更快（间隔缩短）
  const interval = Math.max(3, 12 - Math.min(9, (G.enemies.length || 0) / 3)) / Math.max(0.4, ecfg.spawnMult);
  if (G.spawnT < interval) return;
  G.spawnT = 0;
  const px = G.player.x / TILE, py = G.player.y / TILE;
  let tx, ty;
  // 优先从最近/随机的巢穴附近生成敌人
  const src = spawners.length ? spawners[(Math.random() * spawners.length) | 0] : null;
  if (src) {
    const gx = Math.round(src.x / TILE), gy = Math.round(src.y / TILE);
    // 敌人环绕虫巢外围生成（避开虫巢 SPAWNER_FOOT×SPAWNER_FOOT 占地，避免重叠）
    const dist = SPAWNER_FOOT / 2 + Math.random() * 1.5;
    const ang = Math.random() * Math.PI * 2;
    tx = Math.round(gx + Math.cos(ang) * dist);
    ty = Math.round(gy + Math.sin(ang) * dist);
    for (let i = 0; i < 8; i++) {
      const cx2 = tx + Math.floor(Math.random() * 5) - 2;
      const cy2 = ty + Math.floor(Math.random() * 5) - 2;
      if ((!isWater(cx2, cy2) && !isCliff(cx2, cy2) && !isTree(cx2, cy2)) && !entAt(cx2, cy2) && !onSpawner(cx2, cy2)) { tx = cx2; ty = cy2; break; }
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
      if ((!isWater(cx2, cy2) && !isCliff(cx2, cy2) && !isTree(cx2, cy2)) && !entAt(cx2, cy2) && !onSpawner(cx2, cy2)) { tx = cx2; ty = cy2; break; }
    }
  }
  const t = pickEnemyType();
  const def = scaledDef(ENEMY_TYPES[t]);
  // 记录敌人所属虫巢（home）坐标：默认围绕其游荡，污染覆盖其虫巢后才转为进攻（对齐《异星工厂》）。
  const home = src ? { x: src.x, y: src.y } : null;
  G.enemies.push({
    x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2,
    hp: def.hp, maxhp: def.hp, dead: false, dir: 0,
    type: t, kind: def.kind, speed: def.speed, size: def.size, dmg: def.dmg,
    color: def.color, attackT: 0, fireT: 0,
    home: home, wanderT: Math.random() * 2, aggro: false
  });
}

// ===== 巢穴进攻波次系统（对齐《异星工厂》：虫群定期集结成波进攻基地）=====
// 巢穴随时间积攒“攻击性”，达到阈值后在巢穴附近集结一支成建制的进攻波，
// 波内敌人锁定玩家基地/玩家，列队挺进，比散兵游勇更有压迫感。
// 进攻波敌人带 wave:true 标记，波次刷出时跳过普通数量上限约束。
const WAVE_BASE_INTERVAL = 130;        // 基础波次间隔（秒，原 90，节奏更缓，对齐原版进攻非高频）
const WAVE_MIN_INTERVAL = 50;         // 最短波次间隔（高级战斗/高进化后加速）
const WAVE_TIMER_KEY = 'waveT';       // 波次倒计时存于 G
function waveInterval() {
  const evo = evolutionFactor();
  const mult = G.techDone['advanced-combat'] ? 0.6 : 1;
  return Math.max(WAVE_MIN_INTERVAL, WAVE_BASE_INTERVAL * (1 - evo * 0.5) * mult);
}
// 一次进攻波的敌人构成：数量与强度随进化度提升，末期加入 Behemoth 巨兽级
function composeWave(px, py) {
  const evo = evolutionFactor();
  const group = [];
  const n = 5 + Math.round(evo * 10);   // 波次敌人总数（随进化度增长）
  for (let i = 0; i < n; i++) {
    const t = pickEnemyType();
    const def = scaledDef(ENEMY_TYPES[t]);
    // 在巢穴/玩家远处随机散布，保证整波成面推进而非重叠成一点
    const ang = Math.random() * Math.PI * 2;
    const rad = 4 + Math.random() * 4;
    group.push({
      x: px + Math.cos(ang) * rad * TILE, y: py + Math.sin(ang) * rad * TILE,
      hp: def.hp, maxhp: def.hp, dead: false, dir: 0,
      type: t, kind: def.kind, speed: def.speed, size: def.size, dmg: def.dmg,
      color: def.color, attackT: 0, fireT: 0,
      wave: true   // 标记为进攻波敌人
    });
  }
  return group;
}
// 每帧更新波次计时，触发进攻波
// 对齐《异星工厂》：进攻波由污染驱动——仅当至少一个虫巢被污染覆盖时才集结进攻，
// 且“无”模式不刷敌人、“和平”模式不主动进攻。
function updateWaves(dt) {
  if (!G.settings.combat) return;
  const ecfg = (typeof enemyConfig === 'function') ? enemyConfig() : { peaceful: false };
  if (ecfg.none || ecfg.peaceful) return;
  const evo = evolutionFactor();
  // 至少有一座巢穴、且进化度达到一定水平后才触发进攻波，避免开局就压垮玩家
  const spawners = getSpawnerList();
  if (spawners.length === 0 || evo < 0.06) return;
  // 仅当有虫巢被污染覆盖时才可能触发进攻波（对齐《异星工厂》：无污染则虫子不进攻）
  let polluted = false;
  for (const s of spawners) { if (spawnerPolluted(s)) { polluted = true; break; } }
  if (!polluted) return;
  G.waveT = (G.waveT || 0) + dt;
  if (G.waveT < waveInterval()) return;
  G.waveT = 0;
  // 选一座巢穴作为波次集结中心（优先离玩家最近的巢穴）
  let src = spawners[0];
  let bestD = Infinity;
  for (const s of spawners) {
    const d = Math.hypot(s.x - G.player.x, s.y - G.player.y);
    if (d < bestD) { bestD = d; src = s; }
  }
  const wave = composeWave(src.x, src.y);
  // 清掉可能卡在巢穴格上的旧物，然后压入波次
  if (G.enemies.length + wave.length > 120) G.enemies = G.enemies.filter(e => !e.wave);
  G.enemies.push(...wave);
  // 播报 + 音效（若存在）
  if (typeof toast === 'function') toast('⚠ 虫群进攻波次来袭！' + (evo >= 0.9 ? '（出现巨兽级）' : ''));
  if (typeof playSfx === 'function') playSfx('wave');
}

// 近战敌人：寻找可攻击的建筑。敌人撞到/贴近实心建筑时攻击它，而非穿过。
// 优先攻击防御类建筑（石墙/门/炮塔），其次生产建筑。返回目标实体或 null。
function findEnemyBuildingTarget(en) {
  const gx = Math.floor(en.x / TILE), gy = Math.floor(en.y / TILE);
  const r = 2;   // 扫描半径（格）
  let best = null, bestD = Infinity, bestDef = 0;
  const defPriority = { 'stone-wall': 3, 'gate': 3, 'gun-turret': 3, 'laser-turret': 3, 'flamethrower-turret': 3, 'artillery-turret': 3, 'land-mine': 3 };
  const ex = en.x / TILE, ey = en.y / TILE;
  // 用桶索引遍历附近实体，避免对空地形逐格 entAt（P2 优化）
  forEachEntInBuckets(bucketKeysIn(gx - r, gy - r, gx + r, gy + r), e => {
    if (e._dead || !e.solid || e.maxhp <= 0) return;
    const nearX = Math.max(e.x, Math.min(ex, e.x + e.w));
    const nearY = Math.max(e.y, Math.min(ey, e.y + e.h));
    const dist = Math.hypot(ex - nearX, ey - nearY);
    const reach = (e.w + e.h) / 4 + 0.8;
    if (dist > reach) return;
    const pri = defPriority[e.type] || 1;
    if (dist < bestD - 0.01 || (Math.abs(dist - bestD) < 0.01 && pri > bestDef)) {
      bestD = dist; best = e; bestDef = pri;
    }
  });
  return best;
}

// 远程敌人：在射程内寻找可攻击的建筑目标（玩家不在射程时）。
function findEnemyRangedTarget(en, range) {
  const gx = Math.floor(en.x / TILE), gy = Math.floor(en.y / TILE);
  const r = Math.ceil(range) + 1;
  let best = null, bestD = Infinity;
  const ex = en.x / TILE, ey = en.y / TILE;
  forEachEntInBuckets(bucketKeysIn(gx - r, gy - r, gx + r, gy + r), e => {
    if (e._dead || !e.solid || e.maxhp <= 0) return;
    const nearX = Math.max(e.x, Math.min(ex, e.x + e.w));
    const nearY = Math.max(e.y, Math.min(ey, e.y + e.h));
    const dist = Math.hypot(ex - nearX, ey - nearY);
    if (dist <= range && dist < bestD) { bestD = dist; best = e; }
  });
  return best;
}

// ===== 敌人 AI（对齐《异星工厂》Biter 行为）=====
// 原版 Biter/Spitter 正常模式：不会主动冲向玩家，而是在各自虫巢（Spawner）周围游荡、
// 守护巢穴；只有当工业污染扩散并覆盖到该虫巢所在的区块时，虫群才会被激怒而发起进攻。
// 本项目据此实现：敌人默认围绕所属虫巢游荡，仅在所属虫巢被污染覆盖时转为进攻状态。

// 计算某虫巢是否被污染覆盖（对齐原版：污染云扩散到虫巢即激怒）。
// 污染云以基地为圆心向外扩散，半径随污染值增大（与 drawPollution 的视觉半径一致）。
function spawnerPolluted(s) {
  if (!G || !G.settings || !G.settings.combat || !G.pollution) return false;
  if (!s) return false;
  const bx = (G.spawn ? G.spawn.x : 0) * TILE;
  const by = (G.spawn ? G.spawn.y : 0) * TILE;
  const radius = (12 + G.pollution / 30) * TILE;   // 污染云半径（像素），与 drawPollution 一致
  const d = Math.hypot(s.x - bx, s.y - by);
  // 污染值需达到激怒阈值且污染云覆盖到该虫巢
  return d <= radius && G.pollution >= POLLUTION_WAVE_THRESHOLD;
}

// 判断单个敌人当前是否处于“进攻”状态（会主动攻击玩家/建筑）。
// 逻辑（对齐《异星工厂》）：
//   - 波次敌人（进攻波/污染激怒波）天然处于进攻状态；
//   - 普通敌人默认不进攻，仅当所属虫巢被污染覆盖时才转为进攻；
//   - 主角靠近普通敌人（进入其激怒距离）时，即使虫巢未被污染也会主动扑向主角；
//   - 和平模式（peaceful）敌人永远不主动进攻，只会游荡。
function isEnemyAggressive(en) {
  // 战斗关闭/无敌人配置时始终不进攻
  if (!G.settings.combat) return false;
  const ecfg = (typeof enemyConfig === 'function') ? enemyConfig() : { peaceful: false };
  if (ecfg.none) return false;               // “无”模式没有任何敌人
  if (ecfg.peaceful) return false;           // “和平”模式敌人不主动攻击
  if (en.wave) return true;                  // 进攻波敌人始终进攻
  if (en.aggro) return true;                 // 已被标记为激怒（如遭攻击）
  // 正在“丢失目标回巢”流程中（lingerT>0 原地游荡 或 returning 正在返回虫巢）：
  // 保持非进攻，不因污染/靠近再次激怒，直到回到虫巢聚集完毕，否则永远无法完成回巢（需求：丢失目标后先游荡再回巢聚集）。
  if (en.returning || en.lingerT > 0) return false;
  // 主角靠近该敌人时主动攻击：即使虫巢未被污染激怒，聚集在虫巢周围的虫子也会扑向近身的主角
  if (G.player && en.x !== undefined && en.y !== undefined) {
    const d = Math.hypot(G.player.x - en.x, G.player.y - en.y) / TILE;
    // 触发攻击：主角进入激怒距离，敌人开始追踪主角
    if (d <= ENEMY_AGGRO_RANGE) { en.chasing = true; return true; }
    // 已经因靠近而追踪的敌人：需要拉开到更远的距离才会停止追踪（迟滞，避免紧贴阈值来回切换）
    if (en.chasing) {
      if (d <= ENEMY_DEAGGRO_RANGE) return true;
      // 主角已拉开足够远，解除追踪；先原地游荡 5 秒，随后返回虫巢附近聚集
      en.chasing = false;
      en.lingerT = ENEMY_LINGER_TIME;
      en.returning = true;
    }
  }
  // 普通敌人：所属虫巢被污染覆盖则进攻
  if (en.home) return spawnerPolluted({ x: en.home.x, y: en.home.y });
  // 无归属虫巢的敌人（兜底）：以当前污染是否达阈值判断
  return G.pollution >= POLLUTION_WAVE_THRESHOLD;
}

// 默认行为：敌人不追击玩家时，在所属虫巢周围聚集，不主动攻击玩家/建筑。
// 行为逻辑：
//  - 刚从追踪状态解除（en.lingerT>0）：先原地小范围游荡（来回游走）ENEMY_LINGER_TIME 秒（需求：丢失视野后游荡 5 秒）；
//  - 游荡结束后：返回最开始的虫巢（en.home），并聚在虫巢中心附近（需求：敌人在虫巢周围聚在一起、随时间越聚越多，不要分散）；
//  - 若最开始的虫巢已被摧毁（home 对应虫巢不存在），改投最近的其它在世虫巢，聚在其周围（需求：找不到最开始的虫巢就返回最近的虫巢聚集）；
//  - 无归属虫巢（home 为空）的敌人：在当前位置附近随机游荡，避免“丢失目标后停在原地不动”的 bug。
// 无论处于哪种形态，只要尚未持有方向（wdir），都先给一个随机方向，确保敌人永远有朝向、不会原地静止。
function wanderAroundHome(en, dt) {
  en.wanderT = (en.wanderT || 0) - dt;
  // 取回巢目标：若原虫巢已不存在，则就近改投最近的在世虫巢（并更新归属，便于后续按新巢判定污染激怒）。
  let home = en.home;
  if (home && !homeSpawnerExists(home)) {
    const ns = nearestSpawner(en.x, en.y);
    if (ns) {
      home = { x: ns.x, y: ns.y };
      en.home = home;
    } else {
      home = null;
      en.home = null;
    }
  }
  let mx = 0, my = 0;
  // 刚从追踪状态解除：先原地小范围游荡（小幅徘徊）ENEMY_LINGER_TIME 秒，不急着回巢
  if (en.lingerT > 0) {
    en.lingerT -= dt;
    // 首次进入游荡立即给一个方向，避免 wanderT 尚未到期时 wdir 为空而停在原地不动
    if (!en.wdir || en.wanderT <= 0) {
      en.wanderT = 0.4 + Math.random() * 0.5;
      const a = Math.random() * Math.PI * 2;
      en.wdir = { x: Math.cos(a), y: Math.sin(a) };
    }
    mx = en.wdir.x; my = en.wdir.y;
  } else if (home) {
    // 有归属虫巢：向虫巢中心聚集（需求：敌人聚在虫巢周围，不分散，随时间越聚越多）：
    // 离虫巢中心较远时始终朝虫巢聚拢，贴近虫巢中心后才做小幅徘徊保持聚集形态。
    const dx = home.x - en.x, dy = home.y - en.y;
    const dist = Math.hypot(dx, dy);
    const clusterR = 2.5 * TILE;   // 聚集半径（像素）：敌人贴着虫巢中心聚集成一团
    if (dist <= clusterR) {
      // 已回到虫巢附近聚集完毕：结束“丢失目标回巢”流程，恢复正常（可再次被激怒/靠近时追击）
      en.returning = false;
    }
    if (dist > clusterR) {
      // 离虫巢中心较远：朝虫巢中心聚拢，聚在一起而非散开
      mx = dx / (dist || 1); my = dy / (dist || 1);
    } else if (en.wanderT <= 0 || !en.wdir) {
      // 已贴近虫巢中心：小幅徘徊，维持聚集的一团（wdir 为空时也立即补方向，避免静止）
      en.wanderT = 0.8 + Math.random() * 1.2;
      const a = Math.random() * Math.PI * 2;
      en.wdir = { x: Math.cos(a), y: Math.sin(a) };
      mx = en.wdir.x; my = en.wdir.y;
    } else {
      mx = en.wdir.x; my = en.wdir.y;
    }
  } else {
    // 无归属虫巢的敌人：在当前位置附近随机游荡，避免停在原地（修复丢失目标后停住不动的 bug）
    if (en.wanderT <= 0 || !en.wdir) {
      en.wanderT = 1 + Math.random() * 1.5;
      const a = Math.random() * Math.PI * 2;
      en.wdir = { x: Math.cos(a), y: Math.sin(a) };
    }
    mx = en.wdir.x; my = en.wdir.y;
    // 无巢敌人游荡时保持可重新激怒（无虫巢可归，丢失目标后不必永久停留在“回巢”状态）
    en.returning = false;
  }
  const slow = aoeSlowFactor(en.x, en.y);
  const speedMul = en.lingerT > 0 ? 0.3 : 0.55;
  // 移动量按 TILE 缩放，与追踪移动（speed 单位为格/秒）保持一致：
  // 此前方向是单位向量而 dist 未乘 TILE，导致游荡/回巢实际仅约 1 像素/秒，敌人看似原地不动。
  moveEnemy(en, mx, my, en.speed * speedMul * dt * slow * TILE);
  // 游荡时更新朝向（用于敌人行走渲染），静止则保持原朝向
  if (mx !== 0 || my !== 0) {
    const a = Math.atan2(my, mx);
    en.dir = (a >= -Math.PI / 4 && a < Math.PI / 4) ? 0 : (a >= Math.PI / 4 && a < 3 * Math.PI / 4) ? 1 : (a >= -3 * Math.PI / 4 && a < -Math.PI / 4) ? 3 : 2;
  }
}
// 敌人/虫巢碰撞半径（像素）：虫子用其 size，虫巢按 2×2 占地边长一半计算（静态占地体积）。
function enemyRadius(e) {
  return (e.kind === 'spawner' ? e.foot * TILE * 0.5 : e.size);
}

// 敌人是否会被地形阻挡（需求：树木与峭壁都阻碍敌人移动，对齐玩家——树木/峭壁不可穿越，需绕开）。
function enemySolidBlocked(px, py) {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  return isTree(tx, ty) || isCliff(tx, ty);
}

// 敌人移动（含树木/峭壁阻挡）：逐轴尝试移动，目标格为树木或峭壁则该轴被挡住（避免斜向贴边穿障）。
function moveEnemy(en, mx, my, dist) {
  if (dist <= 0 || (mx === 0 && my === 0)) return;
  const nx = en.x + mx * dist;
  if (!enemySolidBlocked(nx, en.y)) en.x = nx;
  const ny = en.y + my * dist;
  if (!enemySolidBlocked(en.x, ny)) en.y = ny;
}

function updateEnemies(dt) {
  if (!G.enemies) return;
  // 推进自然进化（战斗开启时）
  updateEvolution(dt);
  // 推进虫巢扩张（对齐《异星工厂》Biter expansion：领地向外蔓延）
  updateExpansion(dt);
  const p = G.player;
  const pR = 9;   // 玩家碰撞半径（格）
  for (const en of G.enemies) {
    if (en.dead) continue;
    // 巢穴不移动、不攻击，仅作为生产点
    if (en.kind === 'spawner') continue;
    en.attackT = (en.attackT || 0) - dt;
    en.fireT = (en.fireT || 0) - dt;
    // 攻击动画计时：>0 时敌人处于“扑咬/喷吐”动作帧（供渲染表现），随时间衰减
    en.lungeT = (en.lungeT || 0) - dt;
    // 兼容旧档敌人：补充默认字段
    if (en.speed === undefined) { en.speed = 2.3; en.size = 8; en.dmg = 5; en.kind = 'melee'; en.maxhp = en.hp || 40; if (!en.color) en.color = enemyColor(en.hp, en.maxhp); }
    // 减速力场（减速胶囊）：降低移动速度
    const slow = aoeSlowFactor(en.x, en.y);
    // 敌人是否处于进攻状态（对齐《异星工厂》：默认围绕虫巢游荡，仅污染覆盖虫巢才进攻）
    const aggressive = isEnemyAggressive(en);
    if (!aggressive) {
      // 非进攻状态：在所属虫巢周围游荡，不主动攻击玩家/建筑
      wanderAroundHome(en, dt);
      continue;
    }
    const dx = p.x - en.x, dy = p.y - en.y;
    const d = Math.hypot(dx, dy) / TILE;   // 距离（格）
    if (en.kind === 'ranged') {
      // 远程敌人：与玩家保持距离，射程内间歇性吐痰
      const isWorm = en.type === 'worm' || en.type === 'big-worm' || en.type === 'behemoth-worm';
      const range = isWorm ? (en.type === 'behemoth-worm' ? 14 : (en.type === 'big-worm' ? 12 : 10)) : 8;
      const keep = en.type === 'behemoth-worm' ? 9 : (en.type === 'big-worm' ? 8 : (en.type === 'worm' ? 7 : 5));
      // 玩家在射程内则以玩家为目标；否则攻击射程内的建筑（对齐《异星工厂》：远程虫群也会破坏基地）
      let fireTarget = null;
      if (d <= range) fireTarget = p;
      else fireTarget = findEnemyRangedTarget(en, range);
      // 玩家已逃出最大追击距离且无建筑可打：放弃追击，视为丢失目标，回巢（原地游荡 5 秒后返回虫巢聚集）
      if (!fireTarget && d > ENEMY_CHASE_GIVE_UP_RANGE) {
        en.chasing = false;
        en.lingerT = ENEMY_LINGER_TIME;
        en.returning = true;
        wanderAroundHome(en, dt);
        continue;
      }
      if (d > range) {
        moveEnemy(en, dx / d, dy / d, en.speed * dt * slow);
      } else if (d < keep) {
        moveEnemy(en, -dx / d, -dy / d, en.speed * dt * slow);
      }
      // 吐痰（投射物）；喷火虫/巨型蠕虫吐火球（命中造成持续灼烧）
      if (en.fireT <= 0 && fireTarget) {
        en.fireT = isWorm ? (en.type === 'behemoth-worm' ? 2.6 : 2.2) : 1.6;
        en.lungeT = 0.22;   // 喷吐动作帧
        if (typeof playSfx === 'function') playSfx('spit');   // 远程敌人喷吐音效
        const fire = en.type === 'fire-spitter' || en.type === 'big-worm' || en.type === 'behemoth-worm';
        (G.enemyProjectiles || (G.enemyProjectiles = [])).push({
          x: en.x, y: en.y - en.size, tx: fireTarget.x, ty: fireTarget.y, speed: 3.2, dmg: en.dmg, t: 0,
          fire: fire, color: fire ? '#ff8a2a' : '#9ac04a',
          // 普通喷吐虫的酸液命中地面会留下酸液洼地（对齐《异星工厂》Spitter acid）
          acid: !fire,
          buildTarget: fireTarget !== p ? fireTarget : undefined
        });
      }
    } else {
      // 近战敌人：优先攻击附近建筑（石墙/炮塔/工厂等），受阻时转向攻击而非穿过
      const target = findEnemyBuildingTarget(en);
      if (target) {
        if (en.attackT <= 0) {
          en.attackT = 1.0;
          en.lungeT = 0.28;   // 扑咬建筑动作帧
          // 扑咬时短暂朝目标建筑前扑（视觉动作，对齐《异星工厂》Biter 扑咬姿态）
          const tdx = (target.x + target.w / 2 - en.x), tdy = (target.y + target.h / 2 - en.y);
          const td = Math.max(1, Math.hypot(tdx, tdy));
          moveEnemy(en, tdx / td, tdy / td, 5);
          if (typeof playSfx === 'function') playSfx('bite');
          if (typeof damageBuilding === 'function') damageBuilding(target, en.dmg);
        }
        continue;
      }
      // 主角已逃出最大追击距离：放弃追击，视为丢失目标，回巢（原地游荡 5 秒后返回虫巢聚集）
      if (d > ENEMY_CHASE_GIVE_UP_RANGE) {
        en.chasing = false;
        en.lingerT = ENEMY_LINGER_TIME;
        en.returning = true;
        wanderAroundHome(en, dt);
        continue;
      }
      // 冲向玩家，贴近后咬人
      if (d > 1.1) {
        moveEnemy(en, dx / d, dy / d, en.speed * dt * slow);
      } else if (en.attackT <= 0) {
        en.attackT = 1.0;
        en.lungeT = 0.28;   // 扑咬玩家动作帧
        if (typeof playSfx === 'function') playSfx('bite');
        if (G.settings.combat) {
          // 近战虫贴身咬玩家：主角自动用刀具还击（触发自动反击动画 + 音效）
          if (typeof playerAutoCounter === 'function') playerAutoCounter(en);
          damagePlayer(en.dmg);
        }
      }
    }
  }
  // 敌人/虫巢碰撞分离（需求：虫子与虫子、虫子与虫巢都要有碰撞效果）
  //  - 虫子与虫子互斥推开，保持间距不叠成一团（对齐《异星工厂》虫群列队）；
  //  - 虫子与虫巢同样互斥，但虫巢为静态占地（kind==='spawner'），只推动虫子、自身不动。
  const alive = G._aliveEnemies || G.enemies;
  for (let i = 0; i < alive.length; i++) {
    const a = alive[i];
    if (a.dead) continue;
    const aIsSpawner = a.kind === 'spawner';
    for (let j = i + 1; j < alive.length; j++) {
      const b = alive[j];
      if (b.dead) continue;
      const bIsSpawner = b.kind === 'spawner';
      // 虫巢之间无需处理（布点已保证互不重叠）；其余组合（虫-虫、虫-巢）均参与碰撞
      if (aIsSpawner && bIsSpawner) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy);
      const minD = (enemyRadius(a) + enemyRadius(b)) * 0.9 + 4;
      if (d > 0 && d < minD) {
        const push = ((minD - d) / minD) * 26 * dt;
        const ux = dx / d, uy = dy / d;
        // 虫巢不移动：只推动非虫巢一方，避免虫巢被虫子顶走（且不把虫子顶进树木）
        if (!aIsSpawner) moveEnemy(a, -ux, -uy, push);
        if (!bIsSpawner) moveEnemy(b, ux, uy, push);
      }
    }
  }
  // 更新远程投射物，命中玩家扣血 / 命中建筑损坏建筑
  if (G.enemyProjectiles) {
    for (const pr of G.enemyProjectiles) {
      const dx = pr.tx - pr.x, dy = pr.ty - pr.y;
      const d = Math.hypot(dx, dy);
      const step = pr.speed * TILE * dt;
      if (d <= step) {
        pr.hit = true;
        // 火球命中地面：留下燃烧火场（对齐《异星工厂》Fire entity）
        if (pr.fire && typeof spawnGroundFire === 'function') spawnGroundFire(pr.x, pr.y);
        // 喷吐虫酸液命中：落点形成酸液洼地，对范围内持续腐蚀（对齐《异星工厂》Acid puddle）
        if (pr.acid && typeof spawnAcidPool === 'function') spawnAcidPool(pr.x, pr.y);
        if (pr.buildTarget && pr.buildTarget._dead === false) {
          // 命中建筑：造成建筑伤害（火球附带灼烧）
          if (typeof damageBuilding === 'function') {
            damageBuilding(pr.buildTarget, pr.dmg + (pr.fire ? Math.round(pr.dmg * 0.5) : 0));
          }
        } else {
          damagePlayer(pr.dmg);
          // 火球命中：额外灼烧伤害（模拟持续灼烧）
          if (pr.fire) damagePlayer(pr.dmg * 0.6);
        }
        continue;
      }
      pr.x += (dx / d) * step;
      pr.y += (dy / d) * step;
    }
    G.enemyProjectiles = compactFilter(G.enemyProjectiles, pr => !pr.hit);
  }
  // 击杀敌人推进战斗进化（含巢穴），提升进化度；被击杀的敌人掉落少量矿石（对齐《异星工厂》）
  let kills = 0;
  G.enemies = compactFilter(G.enemies, e => {
    if (e.dead) { kills++; dropEnemyLoot(e); return false; }
    return true;
  });
  if (kills > 0) {
    addEvolution(EVOLUTION_KILL_RATE * kills);
    // 成就：击杀计数（对齐《异星工厂》战斗成就）
    if (typeof achEnsureStats === 'function') { achEnsureStats(); G.achStats.kills += kills; checkAchievements(); }
  }
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
    // 性能优化：平方距离比较（避免每帧 sqrt），与 Math.hypot 数学等价
    const _dx = d.x - p.x, _dy = d.y - p.y;
    if (_dx * _dx + _dy * _dy < pickR * pickR) {
      invAdd(d.id, d.n || 1);
      if (typeof toast === 'function' && d.id === 'uranium-ore') toast('拾取 铀矿石');
      if (typeof playSfx === 'function') playSfx('loot');
      d.picked = true;
    }
  }
  G.lootDrops = compactFilter(G.lootDrops, d => !d.picked && d.t < d.life);
  if (G.lootDrops.length === 0) G.lootDrops = undefined;
}

// 主角自动刀具反击：近战虫贴身咬到主角时，主角挥刀自动还击（对齐《异星工厂》玩家初始近战刀具）。
// 触发挥刀动画（counterT，供渲染表现）+ 挥刀音效，并对咬击自己的敌人造成反击伤害。
// 反击伤害随武器伤害科技（weaponDamageMult）增强，让玩家在后期也能有效贴身还击。
function playerAutoCounter(en) {
  const p = G.player;
  if (!p || !en || en.dead) return;
  // 反击动画/冷却：挥刀动画未结束前不再触发，避免连续无间隔挥刀
  if (p.counterT > 0) return;
  p.counterT = 0.34;   // 挥刀动画时长（秒）
  p.counterDir = Math.atan2(en.y - p.y, en.x - p.x);   // 面向攻击者方向挥刀
  // 反击伤害（基础刀具伤害；随武器伤害科技增强）
  let dmg = 12;
  if (typeof weaponDamageMult === 'function') dmg = Math.round(dmg * weaponDamageMult());
  en.hp -= dmg;
  if (en.hp <= 0) en.dead = true;
  if (typeof playSfx === 'function') playSfx('knife');
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
  // 能量护盾吸收：受击时优先消耗个人电网电力生成护盾吸收伤害（对齐《异星工厂》Energy shield）
  if (typeof applyShieldAbsorb === 'function' && totalShieldCapacity() > 0) {
    const before = dmg;
    dmg = applyShieldAbsorb(dmg);
    if (dmg < before && typeof playSfx === 'function') playSfx('shield');
  }
  dmg = Math.max(0, dmg);
  if (dmg > 0) {
    G.playerHP -= dmg;
    // 记录受伤时间，重置自动回血延迟计时（对齐《异星工厂》：受伤后需等待几秒才重新开始自动回血）
    if (G.player && typeof G.player === 'object') G.player.lastHurtT = G.time;
    // 主角受击音效（真正扣血时播放；护盾完全吸收则无受击音）
    if (typeof playSfx === 'function') playSfx('hit');
    if (G.playerHP <= 0) {
      G.playerHP = 0;
      // 玩家阵亡：弹出死亡菜单供玩家选择（出生点复活 / 读取存档 / 重新开始），对齐《异星工厂》阵亡结算
      if (typeof playSfx === 'function') playSfx('player-death');
      if (typeof showDeathMenu === 'function') showDeathMenu();
      else {
        // 兜底：无死亡菜单时回退到原行为（回出生点回满）
        G.enemies = []; G.enemyProjectiles = [];
        G.player.x = G.spawn.x * TILE + TILE / 2;
        G.player.y = G.spawn.y * TILE + TILE / 2;
        // 复位相机 pan 偏移，避免出生点设备被挤出屏幕（与 respawnAtSpawn 保持一致）
        if (G.cam.pan) { G.cam.pan.x = 0; G.cam.pan.y = 0; }
        G.cam.px = G.player.x; G.cam.py = G.player.y;
        G.playerHP = G.playerHPmax;
      }
    }
  }
  uiDirty = true;
}

