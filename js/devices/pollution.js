'use strict';
// =============================================================
// 污染系统（对齐《异星工厂》Pollution 核心机制）
// 异星工厂最标志性的生态机制：矿物开采、冶炼、石油化工与烧煤发电
// 会向大气排放污染，污染随基地规模增长并向外扩散。当污染扩散到虫巢，
// 虫群会被激怒而集结进攻——玩家的活动强度直接决定虫患的进攻压力。
//
// 实现要点：
//   - 全局污染值 G.pollution（0 起，随污染排放增长，上限受配置约束）
//   - 污染源：按异星工厂设定，来自 开采 / 冶炼 / 石油化工 / 烧煤发电；
//     耗电组装不产生污染（与官方一致）。
//   - 污染激怒：污染值累积到阈值后激怒最近的虫巢，触发一波强化进攻波，
//     并把部分污染"消耗"掉（虫群集结吸收大气污染，形成动态攻防循环）。
//   - 污染扩散：污染值随时间轻微自然消散，模拟扩散到更广区域。
//   - 视觉化：以基地为中心在地面叠加红褐色半透明污染云，浓度随污染值上升，
//     小地图同步显示污染范围，直观体现"污染扩散、激怒虫群"。
// =============================================================


// ---- 污染常量（可调平衡） ----
// 对齐《异星工厂》原版：污染并非无限累加的“资源条”，而是随排放增长、
// 又随扩散持续消散的云。故全局污染值设较低上限、配较强自然消散，
// 使其在“高污染源 → 快速累积触发激怒”与“低排放 → 缓慢回落”间保持动态平衡，
// 避免污染无脑上涨到顶、虫巢过早全面激怒（原版开局很长一段时间污染都很低）。
const POLLUTION_MAX = 1200;            // 污染值上限（低于原上限，防无脑上涨失衡）
const POLLUTION_DECAY = 3.5;           // 每帧自然消散量（原版污染随扩散到大范围持续消散，故调大让污染更易回落）
const POLLUTION_WAVE_THRESHOLD = 560;  // 污染达到此值触发虫巢进攻波（首个阈值，略高于消散量使需持续污染才能触发）
const POLLUTION_AGGRO_PER_WAVE = 260;  // 每触发一波进攻波消耗的污染值（虫群被激怒吸收）
const POLLUTION_MIN_WAVE_GAP = 18;     // 两次污染进攻波的最短间隔（秒，原版波次节奏更缓）
const POLLUTION_SCAN_INTERVAL = 0.5;   // 污染源扫描间隔（秒，避免每帧全量遍历）

// ===== 树木吸收污染（对齐《异星工厂》Pollution absorption）=====
// 异星工厂中最具标志性的生态机制之一：污染作为一片云从污染源向外扩散，
// 途中的树木会吸收污染（充当污染汇点）；被污染侵蚀过重的树木会枯萎消失。
// 本作在保留全局污染值（驱动虫巢激怒）的同时，新增一块逐格污染场：
//   - 污染源向周围格排放污染，污染随时间向相邻格扩散并自然衰减；
//   - 树木从其所在格的污染场吸收污染（同时减少全局污染值，形成"保树减污"生态玩法）；
//   - 树吸收足够多污染后会枯萎死亡（变成草地），与砍树一致地释放木材；
//   - 污染云改为绘制在实际受污染的区域上空（而非固定以出生点为中心），直观体现扩散。
const POLLUTION_EMIT_RADIUS = 3;       // 污染源向周围辐射污染场的半径（格）
const POLLUTION_SPREAD_INTERVAL = 0.5; // 污染场扩散/衰减/树吸收的计算间隔（秒）
const POLLUTION_TILE_MIN = 0.03;       // 低于此值的污染格将被移除（限制场大小，防无界增长）
const POLLUTION_TILE_MAX = 200;        // 单格污染上限
const POLLUTION_SPREAD_RATE = 0.30;    // 污染向相邻格扩散比例（每间隔向邻格送出本格污染的比例）
const POLLUTION_TILE_DECAY = 0.08;     // 单格污染自然衰减比例（每间隔）
const POLLUTION_TREE_ABSORB = 3.0;     // 每棵树每间隔从所在格吸收的污染量
const POLLUTION_TREE_DIE = 60;         // 树累计吸收污染达到此量后枯萎死亡
const POLLUTION_FIELD_MAX_TILES = 6000; // 逐格污染场最大格数（超出时加强衰减，防无界膨胀）

// 各设备的污染排放系数（每秒，单位：污染值/s）
// 对齐《异星工厂》：污染主要来自采矿 / 冶炼 / 石油化工 / 烧煤发电。
const POLLUTION_SOURCES = {
  'burner-mining-drill': 3,        // 热能采矿机（烧煤）
  'electric-mining-drill': 4,      // 电采矿机（采掘污染，略高于热能）
  'big-mining-drill': 6,        // 大型采矿机（太空时代，更大更快，采掘污染更高）
  'pumpjack': 2,            // 抽油机（石油开采）
  'stone-furnace': 2,       // 石炉（烧煤冶炼）
  'steel-furnace': 4,       // 钢铁炉（烧煤冶炼，产能更高）
  'electric-furnace': 5,    // 电炉（冶炼污染，功率更大）
  'boiler': 4,              // 锅炉（烧煤发电）
  'oil-refinery': 6,            // 炼油厂（石油化工）
  'chemical-plant': 5,      // 化工厂（石油化工）
  'centrifuge': 1,          // 离心机（铀浓缩处理，低污染）
  'nuclear-reactor': 7,     // 核反应堆（虽清洁但燃料处理与热量管理仍有微量排放）
  'locomotive': 3,          // 火车头（烧煤行驶）
  'diesel-locomotive': 3,   // 内燃机车（烧燃料行驶，对齐原版：内燃机车同样有尾气）
  'burner-inserter': 0.3    // 热能机械臂（烧煤，微量）
};

// 累加污染值（外部调用入口，钳制到上限）
// 同时累计“总污染产生量”（G.pollutionProduced），用于驱动进化度
// （对齐《异星工厂》：进化度的主要来源之一就是“产生污染”本身——
// 你的工业活动越密集、排放大，虫群进化越快）。
function pollute(amount) {
  if (!G || !G.settings || !G.settings.combat) return;
  if (!G.pollution) G.pollution = 0;
  G.pollution = Math.min(POLLUTION_MAX, G.pollution + (amount || 0));
  if (amount > 0) {
    G.pollutionProduced = (G.pollutionProduced || 0) + amount;
    // 污染驱动进化：随污染产生量缓慢推进进化度（见 advancePollutionEvolution）
    if (typeof advancePollutionEvolution === 'function') advancePollutionEvolution(amount);
  }
}

// =============================================================
// 逐格污染场（对齐《异星工厂》：污染以云的形式扩散，树木吸收污染）
// G.pollutionField: Map<"tx,ty", value>——仅存有污染的格，值低于阈值即移除，
// 因此场大小与"当前受污染区域"成正比，不会随世界无限膨胀。
// G.treeWither: Map<"tx,ty", 累计吸收量>——记录每棵树已吸收的污染量，达到阈值即枯萎。
// =============================================================
function pollutionFieldGet(tx, ty) {
  if (!G.pollutionField) return 0;
  return G.pollutionField.get(tx + ',' + ty) || 0;
}
// 污染场质心缓存（性能优化）：质心是污染场的纯函数，渲染每帧都要读取；
// 若每次全量遍历 Map（大场可达数千格）会浪费帧时间。改为缓存 + 脏标记：
// 任何对污染场的增删改（pollutionFieldAdd / spreadPollutionField / 树吸收 / 读档）都会置脏，
// 下次读取时惰性重算。语义与原先每次全量计算完全一致。
let _centroidCache = null;
let _centroidDirty = true;
function _invalidateCentroid() { _centroidDirty = true; _centroidCache = null; }
function pollutionFieldAdd(tx, ty, v) {
  if (!G.pollutionField) G.pollutionField = new Map();
  const k = tx + ',' + ty;
  let cur = G.pollutionField.get(k) || 0;
  cur = Math.min(POLLUTION_TILE_MAX, cur + v);
  if (cur <= POLLUTION_TILE_MIN) {
    if (G.pollutionField.has(k)) { G.pollutionField.delete(k); _invalidateCentroid(); }
    return 0;
  }
  G.pollutionField.set(k, cur);
  _invalidateCentroid();
  return cur;
}
// 污染场质心（用于把污染云绘制在实际受污染区域上空）
function pollutionFieldCentroid() {
  // 缓存命中：污染场未变则直接返回（避免每帧全量遍历，性能优化）
  if (!_centroidDirty && _centroidCache) return _centroidCache;
  if (!G.pollutionField || G.pollutionField.size === 0) { _centroidCache = null; _centroidDirty = true; return null; }
  let sx = 0, sy = 0, sw = 0, max = 0, mx = 0, my = 0;
  for (const [k, v] of G.pollutionField) {
    const i = k.indexOf(',');
    const tx = +k.slice(0, i), ty = +k.slice(i + 1);
    sx += tx * v; sy += ty * v; sw += v;
    if (v > max) { max = v; mx = tx; my = ty; }
  }
  // 用最高浓度格作为中心（比纯加权质心更贴合污染核心）
  _centroidCache = { tx: sw > 0 ? sx / sw : mx, ty: sw > 0 ? sy / sw : my, weight: Math.min(1, sw / 400) };
  _centroidDirty = false;
  return _centroidCache;
}
// 污染源向周围格排放污染（在 scanPollutionSources 内调用）
function emitFieldPollution(tx, ty, amount) {
  const r = POLLUTION_EMIT_RADIUS;
  const per = amount / ((2 * r + 1) * (2 * r + 1));
  if (per <= 0) return;
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
    // 简单圆形衰减：离中心越远排放越少
    const dist = Math.hypot(dx, dy);
    if (dist > r) continue;
    const w = 1 - dist / (r + 1);
    pollutionFieldAdd(tx + dx, ty + dy, per * w);
  }
}
// 污染场主更新：扩散 + 衰减 + 树吸收（固定间隔调用）
// 返回本间隔树吸收掉、并已从全局污染值中扣除的总量。
function spreadPollutionField(dt) {
  if (!G.pollutionField || G.pollutionField.size === 0) return 0;
  // 用当前键的快照遍历，避免迭代中增删冲突
  const keys = Array.from(G.pollutionField.keys());
  let absorbed = 0;
  // 1) 扩散：向相邻格送出本格污染的一部分
  const next = new Map();
  const addTo = (k, v) => { if (v <= POLLUTION_TILE_MIN) return; next.set(k, Math.min(POLLUTION_TILE_MAX, (next.get(k) || 0) + v)); };
  for (const k of keys) {
    const v = G.pollutionField.get(k) || 0;
    const i = k.indexOf(',');
    const tx = +k.slice(0, i), ty = +k.slice(i + 1);
    const send = v * POLLUTION_SPREAD_RATE;
    const remain = v - send;
    // 自然衰减；场过大时额外加强衰减（防止无界膨胀，保护性能）
    let decay = POLLUTION_TILE_DECAY;
    if (keys.length > POLLUTION_FIELD_MAX_TILES) decay += 0.04;
    const after = remain * (1 - decay);
    if (after > POLLUTION_TILE_MIN) addTo(k, after);
    const perNeighbor = send / 4;
    if (perNeighbor > POLLUTION_TILE_MIN) {
      addTo(tx + 1 + ',' + ty, perNeighbor);
      addTo(tx - 1 + ',' + ty, perNeighbor);
      addTo(tx + ',' + (ty + 1), perNeighbor);
      addTo(tx + ',' + (ty - 1), perNeighbor);
    }
  }
  G.pollutionField = next;
  _invalidateCentroid();
  // 2) 树吸收：对每棵位于污染场的树，从该格吸收污染并累计枯萎进度
  if (typeof isTree !== 'function' || typeof getTerrain !== 'function') return absorbed;
  const treeWither = G.treeWither || (G.treeWither = new Map());
  const toRemove = [];
  let treeDirty = false;   // 是否发生了树吸收（污染场内容变化），用于末尾统一失效质心缓存
  for (const [k, v] of G.pollutionField) {
    if (v < POLLUTION_TREE_ABSORB) continue;
    const i = k.indexOf(',');
    const tx = +k.slice(0, i), ty = +k.slice(i + 1);
    if (!isTree(tx, ty)) continue;
    // 树吸收污染：本格污染减少，同时全局污染值也减少（保树减污）
    const take = Math.min(v, POLLUTION_TREE_ABSORB);
    const nv = v - take;
    absorbed += take;
    treeDirty = true;
    if (nv <= POLLUTION_TILE_MIN) toRemove.push(k);
    else G.pollutionField.set(k, nv);
    // 累计枯萎进度
    const wk = tx + ',' + ty;
    const acc = (treeWither.get(wk) || 0) + take;
    treeWither.set(wk, acc);
    if (acc >= POLLUTION_TREE_DIE) {
      treeWither.delete(wk);
      // 树被污染侵蚀枯萎死亡：变成草地（对齐《异星工厂》污染杀死树木）
      setTerrain(tx, ty, 0 /* T_GRASS */);
      if (typeof invalidateTerrainChunk === 'function') invalidateTerrainChunk(tx, ty);
      if (typeof toast === 'function') toast('树木被污染侵蚀枯萎');
    }
  }
  for (const k of toRemove) G.pollutionField.delete(k);
  if (treeDirty) _invalidateCentroid();   // 统一一次失效质心缓存（等价于每棵树调用，减少冗余）
  return absorbed;
}


// 计算当前污染激怒所需的阈值（随进化度与已触发波次递增，让后期更刺激）
function pollutionAggroThreshold() {
  const evo = (typeof evolutionFactor === 'function') ? evolutionFactor() : (G.evolution || 0);
  // 基础阈值随进化度与已触发的污染波次小幅抬升，保持后期持续有挑战
  return POLLUTION_WAVE_THRESHOLD * (1 + evo * 0.4 + (G.pollutionWaves || 0) * 0.08);
}

// 当前污染的激怒程度 0~1（供画面表现：虫巢变红/泛光/脉动加快）
// 污染越接近并超过激怒阈值，巢穴越躁动；0 表示无影响。
function pollutionAggroFactor() {
  if (!G || !G.settings || !G.settings.combat || !G.pollution) return 0;
  const th = pollutionAggroThreshold();
  const ratio = G.pollution / th;                 // 0~…，1=触发进攻
  if (ratio <= 0.5) return 0;                     // 低于一半阈值不体现
  return Math.min(1, (ratio - 0.5) / 0.7);        // 0.5倍→0，1.2倍→1
}

// 计算某设备的模块污染乘数（对齐《异星工厂》：效率模块减少污染、速度/产能模块增加污染）。
// 计入设备自身装入的模块，以及附近信号塔（Beacon）广播的模块效果（含生效系数，与原版一致）。
// 返回 ≥0 的乘数：效率模块（eff）每 1 点约 -30% 污染、速度模块（speed）每 1 点约 +50% 污染、
// 产能模块（prod）每 1 点约 +60% 污染；钳制在 [0.05, 4] 避免归零/爆炸（对齐原版污染有下限）。
function modulePollutionMult(e) {
  if (!e) return 1;
  const mc = moduleCounts(e.modules);
  let speed = mc.speed, prod = mc.prod, eff = mc.eff;
  // 并入信号塔广播的模块效果（效率/速度/产能模块经信号塔同样影响污染，对齐原版 Beacon）
  if (typeof beaconBonus === 'function') {
    const bb = beaconBonus(e.x, e.y);
    if (bb) { speed += bb.speed; prod += bb.prod; eff += bb.eff; }
  }
  let m = 1 + 0.5 * speed + 0.6 * prod - 0.3 * eff;
  if (m < 0.05) m = 0.05;
  if (m > 4) m = 4;
  return m;
}

// 扫描一次 G.ents 中所有正在工作的污染源，累加污染值，并向逐格污染场排放
function scanPollutionSources(dt) {
  if (!G.ents) return;
  let total = 0;
  for (const e of G.ents) {
    if (e._dead || !e.type) continue;
    const rate = POLLUTION_SOURCES[e.type];
    if (!rate) continue;
    // 仅当设备处于工作/运行状态才排放（利用各设备统一的 working 字段）
    if (e.working) {
      const m = modulePollutionMult(e);
      total += rate * m;
      // 向逐格污染场排放（对齐《异星工厂》：污染从污染源向外扩散）
      if (typeof emitFieldPollution === 'function' && e.x !== undefined && e.y !== undefined) {
        emitFieldPollution(Math.round(e.x), Math.round(e.y), rate * m * dt * 6.0);
      }
    }
  }
  if (total > 0) pollute(total * dt);
}

// 尝试用污染激怒虫巢：达到阈值且超过最短间隔时，触发一波强化进攻波
function pollutionAggro(dt) {
  if (!G || !G.settings || !G.settings.combat) return;
  // “无/和平”模式下污染不引发虫群进攻（和平模式敌人始终不主动攻击）
  const ecfg = (typeof enemyConfig === 'function') ? enemyConfig() : { peaceful: false };
  if (ecfg.none || ecfg.peaceful) return;
  if (!G.pollution || G.pollution < pollutionAggroThreshold()) return;
  G.pollutionT = (G.pollutionT || 0) + dt;
  if (G.pollutionT < POLLUTION_MIN_WAVE_GAP) return;
  // 存在虫巢才可能被激怒（没有虫巢就无从进攻）
  // 性能优化：复用 combat2.js 中每帧缓存的存活巢穴列表 getSpawnerList()，
  // 避免此处每帧 G.enemies.filter(...) 分配新数组造成 GC 压力（P0 优化）。
  const spawners = (typeof getSpawnerList === 'function') ? getSpawnerList() : (G.enemies ? G.enemies.filter(e => e.kind === 'spawner' && !e.dead) : []);
  if (spawners.length === 0) return;
  G.pollutionT = 0;
  // 消耗部分污染（虫群集结吸收），避免无限连发
  G.pollution = Math.max(0, G.pollution - POLLUTION_AGGRO_PER_WAVE);
  G.pollutionWaves = (G.pollutionWaves || 0) + 1;
  // 选取最近虫巢作为波次集结中心
  let src = spawners[0], bestD = Infinity;
  for (const s of spawners) {
    const d = Math.hypot(s.x - (G.player && G.player.x || 0), s.y - (G.player && G.player.y || 0));
    if (d < bestD) { bestD = d; src = s; }
  }
  // 复用现有进攻波生成（composeWave 为全局函数）
  if (typeof composeWave === 'function') {
    const wave = composeWave(src.x, src.y);
    // 污染激怒波强度更高：额外补一批敌人
    if (G.enemies.length + wave.length > 140) G.enemies = G.enemies.filter(e => !e.wave);
    G.enemies.push(...wave);
    if (typeof toast === 'function') toast('⚠ 污染扩散引发虫群疯狂反扑！');
    if (typeof playSfx === 'function') playSfx('pollution');
  }
}

// 主更新：扫描污染源 + 自然消散 + 虫巢激怒（战斗开启时由主循环调用）
function updatePollution(dt) {
  if (!G || !G.settings || !G.settings.combat) return;
  if (!G.pollution) G.pollution = 0;
  // 污染源扫描（固定间隔，省开销）
  G.pollutionScanT = (G.pollutionScanT || 0) + dt;
  if (G.pollutionScanT >= POLLUTION_SCAN_INTERVAL) {
    G.pollutionScanT = 0;
    scanPollutionSources(POLLUTION_SCAN_INTERVAL);
  }
  // 自然消散（污染扩散到大范围）
  G.pollution = Math.max(0, G.pollution - POLLUTION_DECAY * dt);
  // 逐格污染场更新（扩散 + 衰减 + 树吸收）：固定间隔，省开销
  G.pollutionSpreadT = (G.pollutionSpreadT || 0) + dt;
  if (G.pollutionSpreadT >= POLLUTION_SPREAD_INTERVAL) {
    G.pollutionSpreadT = 0;
    // 树木吸收污染会减少全局污染值（保树减污），但不会低于 0
    const absorbed = spreadPollutionField(POLLUTION_SPREAD_INTERVAL);
    if (absorbed > 0) G.pollution = Math.max(0, G.pollution - absorbed);
  }
  // 污染弥漫的烟尘粒子（画面优化）：污染较重时基地上空持续冒烟
  if (G.pollution > 220 && typeof spawnSmoke === 'function' && G.spawn) {
    G.pollutionSmokeT = (G.pollutionSmokeT || 0) + dt;
    if (G.pollutionSmokeT > 0.12) {
      G.pollutionSmokeT = 0;
      const bx = G.spawn.x * TILE, by = G.spawn.y * TILE;
      const ox = (Math.random() - 0.5) * 26 * TILE;
      const oy = (Math.random() - 0.5) * 26 * TILE;
      spawnSmoke(bx + ox, by + oy - Math.random() * 4 * TILE, {
        life: 2 + Math.random() * 1.5,
        size: 4 + Math.random() * 3,
        color: Math.random() < 0.5 ? 'rgba(130,120,90,0.6)' : 'rgba(150,130,90,0.5)'
      });
    }
  }
  // 虫巢激怒进攻
  pollutionAggro(dt);
}

// 供序列化：当前污染相关状态（含逐格污染场与树枯萎进度）
function pollutionSerialize() {
  const field = G.pollutionField ? Array.from(G.pollutionField.entries()) : [];
  const wither = G.treeWither ? Array.from(G.treeWither.entries()) : [];
  return {
    pollution: G.pollution || 0,
    pollutionProduced: G.pollutionProduced || 0,
    pollutionWaves: G.pollutionWaves || 0,
    pollutionT: G.pollutionT || 0,
    field,
    wither
  };
}
// 读档恢复
function pollutionRestore(d) {
  G.pollution = (d && typeof d.pollution === 'number') ? Math.min(POLLUTION_MAX, Math.max(0, d.pollution)) : 0;
  G.pollutionProduced = (d && typeof d.pollutionProduced === 'number') ? d.pollutionProduced : 0;
  G.pollutionWaves = (d && typeof d.pollutionWaves === 'number') ? d.pollutionWaves : 0;
  G.pollutionT = (d && typeof d.pollutionT === 'number') ? d.pollutionT : 0;
  // 逐格污染场与树枯萎进度（对齐《异星工厂》污染场持久化）
  G.pollutionField = null;
  G.treeWither = null;
  if (d && Array.isArray(d.field) && d.field.length) {
    G.pollutionField = new Map(d.field.filter(([, v]) => v > POLLUTION_TILE_MIN));
  }
  if (d && Array.isArray(d.wither) && d.wither.length) {
    G.treeWither = new Map(d.wither);
  }
  _invalidateCentroid();
}

// =============================================================
// 污染可视化（在 render 中、实体绘制之后、昼夜遮罩之前调用）
// 优先把污染云绘制在实际受污染的区域上空（逐格污染场质心），体现"污染从污染源扩散"；
// 无逐格污染场时回退为以基地（出生点）为中心。浓度随污染值上升。
// =============================================================
function drawPollution(ctx) {
  if (!G || !G.settings || !G.settings.combat) return;
  if (!G.pollution && !(G.pollutionField && G.pollutionField.size)) return;   // 无污染不绘制
  const p = G.pollution || 0;
  const intensity = Math.min(1, p / 600);        // 0~1 污染浓度
  // 以逐格污染场质心为污染中心（对齐《异星工厂》：污染云随污染源位置扩散）
  let cx, cy, radius;
  const cent = (typeof pollutionFieldCentroid === 'function') ? pollutionFieldCentroid() : null;
  if (cent) {
    cx = cent.tx * TILE;
    cy = cent.ty * TILE;
    radius = (10 + Math.min(p, 400) / 22) * TILE;
  } else {
    cx = (G.spawn ? G.spawn.x : 0) * TILE;
    cy = (G.spawn ? G.spawn.y : 0) * TILE;
    radius = (12 + p / 30) * TILE;
  }
  // 视口外剔除（用 FRAME_BOUNDS 快速判断，避免离屏绘制浪费）
  // FRAME_BOUNDS 为世界像素坐标：x0=右边界 x1=左边界 y0=下边界 y1=上边界
  if (typeof FRAME_BOUNDS === 'object' && FRAME_BOUNDS) {
    if (cx + radius < FRAME_BOUNDS.x1 || cx - radius > FRAME_BOUNDS.x0 ||
        cy + radius < FRAME_BOUNDS.y1 || cy - radius > FRAME_BOUNDS.y0) return;
  }
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  // 多层径向渐变模拟雾状污染（外缘淡、中心浓）
  const g = ctx.createRadialGradient(cx, cy, radius * 0.1, cx, cy, radius);
  const a = 0.16 + intensity * 0.24;
  g.addColorStop(0, 'rgba(140,120,70,' + a.toFixed(3) + ')');
  g.addColorStop(0.45, 'rgba(150,120,70,' + (a * 0.7).toFixed(3) + ')');
  g.addColorStop(0.8, 'rgba(150,125,75,' + (a * 0.32).toFixed(3) + ')');
  g.addColorStop(1, 'rgba(150,125,75,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 小地图污染显示（叠加在 drawMinimap 之上，红褐色范围）
// 参数：cx/cy 为污染中心在画布上的小地图坐标（像素），scale 为小地图瓦片缩放
function drawPollutionMinimap(ctx, cx, cy, scale) {
  if (!G || !G.settings || !G.settings.combat) return;
  if (!G.pollution && !(G.pollutionField && G.pollutionField.size)) return;
  const p = G.pollution || 0;
  const intensity = Math.min(1, p / 600);
  // 小地图同样优先以逐格污染场质心为污染中心（对齐《异星工厂》污染云扩散）
  let px, py, radius;
  const cent = (typeof pollutionFieldCentroid === 'function') ? pollutionFieldCentroid() : null;
  if (cent) {
    px = cx + (cent.tx - (G.spawn ? G.spawn.x : 0)) * scale;
    py = cy + (cent.ty - (G.spawn ? G.spawn.y : 0)) * scale;
    radius = (10 + Math.min(p, 400) / 22) * scale;
  } else {
    px = cx; py = cy;
    radius = (12 + p / 30) * scale;
  }
  ctx.save();
  const g = ctx.createRadialGradient(px, py, 1, px, py, radius);
  const a = 0.35 + intensity * 0.4;
  g.addColorStop(0, 'rgba(160,130,70,' + a.toFixed(3) + ')');
  g.addColorStop(0.6, 'rgba(160,130,70,' + (a * 0.6).toFixed(3) + ')');
  g.addColorStop(1, 'rgba(160,130,70,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(px, py, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
