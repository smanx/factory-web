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
const SPAWNER_TARGET = 2;        // 同时存在的巢穴目标数（高级战斗后 3）
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
const EXPAND_MIN_INTERVAL = 45;   // 最短扩张间隔（秒）
const EXPAND_BASE_INTERVAL = 120; // 基础扩张间隔（秒）
const EXPAND_RANGE_MIN = 9;       // 距父巢穴最近距离（格）
const EXPAND_RANGE_MAX = 16;      // 距父巢穴最远距离（格）
const EXPAND_PLAYER_GAP = 12;     // 扩张巢穴距玩家至少保持的格数
// 总巢穴数量上限：随进化度略微放宽，但始终受控，避免无限扩张导致失衡
function spawnerCapByEvo() {
  const evo = evolutionFactor();
  const base = G.techDone['advanced-combat'] ? 3 : SPAWNER_TARGET;
  return base + (evo > 0.4 ? 1 : 0) + (evo > 0.8 ? 1 : 0);
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
  const interval = Math.max(EXPAND_MIN_INTERVAL, EXPAND_BASE_INTERVAL * (1 - evo * 0.55));
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
  // 需求：敌人会随时间在虫巢越聚越多，故上限放宽以允许虫群持续集结累积。
  const cap = Math.round((G.techDone['advanced-combat'] ? 80 : 48) * ecfg.spawnMult);
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
const WAVE_BASE_INTERVAL = 90;        // 基础波次间隔（秒）
const WAVE_MIN_INTERVAL = 35;         // 最短波次间隔（高级战斗/高进化后加速）
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
//  - 刚从追踪状态解除（en.lingerT>0）：先原地游荡 ENEMY_LINGER_TIME 秒（需求：丢失目标后游荡 5 秒）；
//  - 游荡结束后：返回所属虫巢，并聚在虫巢中心附近（需求：敌人在虫巢周围聚在一起、随时间越聚越多，不要分散）；
//  - 无归属虫巢（home 为空）的敌人：继续在当前位置随机游荡，避免“丢失目标后停在原地不动”的 bug。
function wanderAroundHome(en, dt) {
  en.wanderT = (en.wanderT || 0) - dt;
  const home = en.home;
  let mx = 0, my = 0;
  // 刚从追踪状态解除：先原地游荡（小幅徘徊）ENEMY_LINGER_TIME 秒，不急着回巢
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
    } else if (en.wanderT <= 0) {
      // 已贴近虫巢中心：小幅徘徊，维持聚集的一团
      en.wanderT = 0.8 + Math.random() * 1.2;
      const a = Math.random() * Math.PI * 2;
      en.wdir = { x: Math.cos(a), y: Math.sin(a) };
      if (en.wdir) { mx = en.wdir.x; my = en.wdir.y; }
    } else if (en.wdir) {
      mx = en.wdir.x; my = en.wdir.y;
    }
  } else {
    // 无归属虫巢的敌人：在当前位置附近随机游荡，避免停在原地（修复丢失目标后停住不动的 bug）
    if (en.wanderT <= 0) {
      en.wanderT = 1 + Math.random() * 1.5;
      const a = Math.random() * Math.PI * 2;
      en.wdir = { x: Math.cos(a), y: Math.sin(a) };
    }
    if (en.wdir) { mx = en.wdir.x; my = en.wdir.y; }
  }
  const slow = aoeSlowFactor(en.x, en.y);
  const speedMul = en.lingerT > 0 ? 0.3 : 0.55;
  moveEnemy(en, mx, my, en.speed * speedMul * dt * slow);
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
    if (Math.hypot(d.x - p.x, d.y - p.y) < pickR) {
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
        G.cam.px = G.player.x; G.cam.py = G.player.y;
        G.playerHP = G.playerHPmax;
      }
    }
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
  'pistol':          { name: '手枪',   dmg: 10, rate: 0.3, ammo: 'magazine',        spread: 0.06, auto: false, range: 7, sfx: 'shoot' },
  'submachine-gun':  { name: '冲锋枪', dmg: 7,  rate: 0.1, ammo: 'magazine', ammoTiers: ['magazine', 'piercing-rounds', 'uranium-rounds'], ammoDmg: { 'magazine': 7, 'piercing-rounds': 10, 'uranium-rounds': 16 }, spread: 0.12, auto: true,  range: 7, sfx: 'machine-gun' },
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
  if (Math.hypot(cx - G.player.x, cy - G.player.y) <= radius * TILE * 0.5) damagePlayer(dmg * 0.4);
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

// ===== 激光炮塔 =====
// 吃电力、无需弹药、射程更远（对齐《异星工厂》Laser turret）
const LASER_RANGE = 9;
const LASER_FIRE_RATE = 0.35;
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
const FT_RANGE = 6;
const FT_FIRE_RATE = 0.3;
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
  const fl = (e.fluid && e.fluid['light-oil']) || 0;
  if (fl > 0) {
    ctx.fillStyle = '#d0a04a';
    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('油:' + fl, cx, cy + 22);
  }
  ctx.globalAlpha = 1;
}
function flameTurretPanelHtml(e) {
  let h = row('轻油', (e.fluid['light-oil'] || 0) > 0 ? ((e.fluid['light-oil'] || 0) + ' 单位') : '<span class="dim">空</span>', 'fluid');
  const n = Math.min(invCount('light-oil'), FT_FLUID_CAP - (e.fluid['light-oil'] || 0));
  if (n > 0) h += '<button data-action="feed" data-id="light-oil">放入轻油 ×' + n + '</button>';
  h += '<div class="status"></div>';
  h += '<div class="dim">火焰炮塔：消耗轻油喷射火焰，对锥形范围敌人造成持续灼烧伤害。可从底部输入口相邻管道自动吸入轻油（2×2）。对齐《异星工厂》Flamethrower turret：以轻油为燃料。</div>';
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
        if (Math.hypot(en.x - cx, en.y - cy) <= TILE * 1.15) { en.hp -= Math.round(GROUND_FIRE_DMG * (typeof weaponCategoryMult === 'function' ? weaponCategoryMult('fire') : 1)); if (en.hp <= 0) en.dead = true; }
      }
      // 玩家站在火焰上也受灼烧
      if (G.settings.combat && Math.hypot(G.player.x - cx, G.player.y - cy) <= TILE * 1.1) damagePlayer(GROUND_FIRE_DMG * 0.6);
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
        if (Math.hypot(en.x - cx, en.y - cy) <= TILE * 1.15) { en.hp -= ACID_POOL_DMG; if (en.hp <= 0) en.dead = true; }
      }
      // 玩家踩中酸液也受腐蚀
      if (G.settings.combat && Math.hypot(G.player.x - cx, G.player.y - cy) <= TILE * 1.1) damagePlayer(ACID_POOL_DMG * 0.6);
    }
    // 酸液表面冒气泡（低频特效，避免爆量）
    if (Math.random() < 0.25 && typeof spawnSmoke === 'function') {
      spawnSmoke(cx + (Math.random() - 0.5) * TILE * 0.4, cy + (Math.random() - 0.5) * TILE * 0.4, { life: 0.7, size: 4, color: '#8ac04a', vx: (Math.random() - 0.5) * 0.2, vy: -(0.3 + Math.random() * 0.3) });
    }
  }
  // 清理蒸发的酸液
  G.acidPools = compactFilter(arr, f => f.life > 0);
}

// ===== 注册 =====
ENT_CLASSES['laser-turret'] = LaserTurret;
ENT_CLASSES['flamethrower-turret'] = FlamethrowerTurret;
DEVICE_RENDER['laser-turret'] = drawLaserTurret;
DEVICE_RENDER['flamethrower-turret'] = drawFlamethrowerTurret;
DEVICE_STATUS['laser-turret'] = e => (G.power.sat <= 0 ? 'r' : (e.target ? 'g' : 'y'));
DEVICE_STATUS['flamethrower-turret'] = e => (G.power.sat <= 0 ? 'r' : ((e.fluid['light-oil'] || 0) <= 0 ? 'r' : (e.target ? 'g' : 'y')));
DEVICE_PANEL['laser-turret'] = { html: laserTurretPanelHtml, live: laserTurretPanelLive, tip: laserTurretTip, onAction: (a) => circuitPanelAction('lt', a) };
DEVICE_PANEL['flamethrower-turret'] = { html: flameTurretPanelHtml, live: flameTurretPanelLive, tip: flameTurretTip, onAction: (a) => circuitPanelAction('ft', a) };
DEVICE_DIR_ROTATE['laser-turret'] = true;
DEVICE_DIR_ROTATE['flamethrower-turret'] = true;
