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
const POLLUTION_MAX = 2000;            // 污染值上限（此后不再无脑上涨）
const POLLUTION_DECAY = 1.5;           // 每帧自然消散量（模拟扩散到大范围，防无限累积）
const POLLUTION_WAVE_THRESHOLD = 520;  // 污染达到此值触发虫巢进攻波（首个阈值）
const POLLUTION_AGGRO_PER_WAVE = 240;  // 每触发一波进攻波消耗的污染值（虫群被激怒吸收）
const POLLUTION_MIN_WAVE_GAP = 12;     // 两次污染进攻波的最短间隔（秒）
const POLLUTION_SCAN_INTERVAL = 0.5;   // 污染源扫描间隔（秒，避免每帧全量遍历）

// 各设备的污染排放系数（每秒，单位：污染值/s）
// 对齐《异星工厂》：污染主要来自采矿 / 冶炼 / 石油化工 / 烧煤发电。
const POLLUTION_SOURCES = {
  'burner-drill': 4,        // 热能采矿机（烧煤）
  'electric-drill': 5,      // 电采矿机（采掘污染，略高于热能）
  'pumpjack': 3,            // 抽油机（石油开采）
  'stone-furnace': 3,       // 石炉（烧煤冶炼）
  'steel-furnace': 5,       // 钢铁炉（烧煤冶炼，产能更高）
  'electric-furnace': 6,    // 电炉（冶炼污染，功率更大）
  'boiler': 6,              // 锅炉（烧煤发电）
  'refinery': 8,            // 炼油厂（石油化工）
  'chemical-plant': 7,      // 化工厂（石油化工）
  'centrifuge': 2,          // 离心机（铀矿处理，低污染）
  'nuclear-reactor': 10,    // 核反应堆（虽清洁但燃料处理与热量管理仍有微量排放）
  'locomotive': 4,          // 火车头（烧煤行驶）
  'burner-inserter': 0.4    // 燃料机械臂（烧煤，微量）
};

// 累加污染值（外部调用入口，钳制到上限）
function pollute(amount) {
  if (!G || !G.settings || !G.settings.combat) return;
  if (!G.pollution) G.pollution = 0;
  G.pollution = Math.min(POLLUTION_MAX, G.pollution + (amount || 0));
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

// 扫描一次 G.ents 中所有正在工作的污染源，累加污染值
function scanPollutionSources(dt) {
  if (!G.ents) return;
  let total = 0;
  for (const e of G.ents) {
    if (e._dead || !e.type) continue;
    const rate = POLLUTION_SOURCES[e.type];
    if (!rate) continue;
    // 仅当设备处于工作/运行状态才排放（利用各设备统一的 working 字段）
    if (e.working) total += rate;
  }
  if (total > 0) pollute(total * dt);
}

// 尝试用污染激怒虫巢：达到阈值且超过最短间隔时，触发一波强化进攻波
function pollutionAggro(dt) {
  if (!G || !G.settings || !G.settings.combat) return;
  if (!G.pollution || G.pollution < pollutionAggroThreshold()) return;
  G.pollutionT = (G.pollutionT || 0) + dt;
  if (G.pollutionT < POLLUTION_MIN_WAVE_GAP) return;
  // 存在虫巢才可能被激怒（没有虫巢就无从进攻）
  const spawners = G.enemies ? G.enemies.filter(e => e.kind === 'spawner' && !e.dead) : [];
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

// 供序列化：当前污染相关状态
function pollutionSerialize() {
  return {
    pollution: G.pollution || 0,
    pollutionWaves: G.pollutionWaves || 0,
    pollutionT: G.pollutionT || 0
  };
}
// 读档恢复
function pollutionRestore(d) {
  G.pollution = (d && typeof d.pollution === 'number') ? Math.min(POLLUTION_MAX, Math.max(0, d.pollution)) : 0;
  G.pollutionWaves = (d && typeof d.pollutionWaves === 'number') ? d.pollutionWaves : 0;
  G.pollutionT = (d && typeof d.pollutionT === 'number') ? d.pollutionT : 0;
}

// =============================================================
// 污染可视化（在 render 中、实体绘制之后、昼夜遮罩之前调用）
// 以基地（出生点）为中心绘制一层红褐色半透明污染云，浓度随污染值上升。
// 使用叠加混合增强雾感；污染较轻时贴近地面，污染重时扩散更远更浓。
// =============================================================
function drawPollution(ctx) {
  if (!G || !G.settings || !G.settings.combat) return;
  if (!G.pollution || G.pollution < 8) return;   // 微量污染不明显
  const p = G.pollution;
  const intensity = Math.min(1, p / 600);        // 0~1 污染浓度
  // 以基地为污染中心（出生点附近），玩家视角能看到基地污染云
  // 在 render 的世界变换上下文中调用，直接使用世界坐标（单位：像素/格×TILE）
  const sx = (G.spawn ? G.spawn.x : 0) * TILE;
  const sy = (G.spawn ? G.spawn.y : 0) * TILE;
  // 污染云半径随污染值扩大（格）
  const radius = (12 + p / 30) * TILE;
  // 视口外剔除（用 FRAME_BOUNDS 快速判断，避免离屏绘制浪费）
  // FRAME_BOUNDS 为世界像素坐标：x0=右边界 x1=左边界 y0=下边界 y1=上边界
  if (typeof FRAME_BOUNDS === 'object' && FRAME_BOUNDS) {
    if (sx + radius < FRAME_BOUNDS.x1 || sx - radius > FRAME_BOUNDS.x0 ||
        sy + radius < FRAME_BOUNDS.y1 || sy - radius > FRAME_BOUNDS.y0) return;
  }
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  // 多层径向渐变模拟雾状污染（外缘淡、中心浓）
  const g = ctx.createRadialGradient(sx, sy, radius * 0.1, sx, sy, radius);
  const a = 0.16 + intensity * 0.24;
  g.addColorStop(0, 'rgba(140,120,70,' + a.toFixed(3) + ')');
  g.addColorStop(0.45, 'rgba(150,120,70,' + (a * 0.7).toFixed(3) + ')');
  g.addColorStop(0.8, 'rgba(150,125,75,' + (a * 0.32).toFixed(3) + ')');
  g.addColorStop(1, 'rgba(150,125,75,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(sx, sy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// 小地图污染显示（叠加在 drawMinimap 之上，红褐色范围）
// 参数：cx/cy 为污染中心在画布上的小地图坐标（像素），scale 为小地图瓦片缩放
function drawPollutionMinimap(ctx, cx, cy, scale) {
  if (!G || !G.settings || !G.settings.combat) return;
  if (!G.pollution || G.pollution < 8) return;
  const p = G.pollution;
  const intensity = Math.min(1, p / 600);
  const radius = (12 + p / 30) * scale;
  ctx.save();
  const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, radius);
  const a = 0.35 + intensity * 0.4;
  g.addColorStop(0, 'rgba(160,130,70,' + a.toFixed(3) + ')');
  g.addColorStop(0.6, 'rgba(160,130,70,' + (a * 0.6).toFixed(3) + ')');
  g.addColorStop(1, 'rgba(160,130,70,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}
