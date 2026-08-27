'use strict';

// 共享空数组（避免战斗路径中每帧因 `G.enemies || []` 生成新字面量）
const EMPTY_ARR = [];

var G = {
  canvas: null,
  ctx: null,
  cam: { px: 0, py: 0, z: 1, pan: { x: 0, y: 0 } },
  world: null,
  player: null,
  ents: [],
  grid: new Map(),
  buckets: new Map(),   // 区块（桶）空间索引：bucketKey -> Set<Entity>（见 core/entity.js）
  inv: new Map(),
  logiRequest: {},   // 个人物流请求：item -> 目标数量（由物流机器人送达）
  trashSlots: {},    // 个人垃圾桶（对齐《异星工厂》Trash slots）：item -> true（标记后由物流机器人带走存回网络）
  logiEnabled: true,      // 「背包物流」总开关：关闭后机器人不再送达个人请求物品
  recycleUnrequested: false, // 「回收未请求物品」开关：开启后机器人回收背包中所有未请求的物品
  logiReqSlots: 50,       // 物流区（请求）格子数：每行 10 格，共 5 行
  logiRecycleSlots: 30,   // 物流回收区格子数：每行 10 格，共 3 行
  sel: -1,
  quickSel: null,
  ghostDir: 0,
  techDone: {},
  techProg: {},
  activeTech: null,
  techQueue: [],
  panelMode: null,
  panelEnt: null,
  cursorTile: null,
  mouseScreen: null,   // 最近一次鼠标屏幕坐标 {x, y}，用于判断鼠标是否位于地图画布上
  keys: {},
  showDetails: true,
  mouseDown: false,
  mouseRightDown: false,
  canvasActive: false,
  time: 0,
  dbg: { timeScale: 1, moveSpeed: 1, mineMult: 1, beltMult: 1, drillMult: 1, asmMult: 1, infinite: false, farReach: false, noclip: false },
  // 是否开启开发者调试（仅当 URL 参数含 debug=1 时为 true）
  debugEnabled: new URLSearchParams(window.location.search).get('debug') === '1',
  spawn: { x: 0, y: 0 },
  invRecipeQ: '',
  invRecipeTab: 'logistics', // 制作栏当前 Tab：logistics/production/intermediate-products/space/combat
  invItemQ: '',     // 背包「拥有的物品」列表的搜索关键字
  invTab: 'inv', // 背包三个 tab：'inv' 玩家（默认）/ 'logi' 物流 / 'craft' 制作
  clipboard: null,
  blueprint: null,        // 蓝图数据：{ minX, minY, w, h, ents: [序列化实体...] }
  blueBook: [],           // 蓝图库：保存的多个蓝图 { name, minX, minY, ents }（对齐《异星工厂》蓝图库）
  blueMode: null,         // 'blue' | 'red' | 'paste'（框选/删除/粘贴蓝图）
  orbitalCargo: {},       // 行星间货物调度：目标星球 -> { 物品 -> 数量 }（火箭发射送往目标星球，抵达后交付）
  blueStart: null,        // 框选起点瓦片
  blueEnd: null,          // 框选终点瓦片
  blueSelecting: false,   // 正在拖拽框选
  blueRot: 0,             // 蓝图粘贴旋转次数（0-3，顺时针90°）
  blueFlipH: false,       // 蓝图粘贴水平翻转
  blueFlipV: false,       // 蓝图粘贴垂直翻转
  greenAction: null,      // 绿图框选后的动作：'upgrade' | 'downgrade' | null
  greenRect: null,        // 绿图最近一次框选区域
  statsTab: 'items',      // 统计面板当前页：items | power | perf
  statsItemTab: 'hist',   // 统计面板-物品速率页：hist(历史,默认在前) | live(实时)
  statsLiveSub: 'prod',   // 统计面板-实时页子 tab：prod(生产) | cons(消耗)
  statsHistSub: 'prod',   // 统计面板-历史页子 tab：prod(生产) | cons(消耗)
  statsInterval: 2,       // 统计面板-实时页：统计间隔索引（0秒/10秒/分钟/小时/1天）；默认“分钟”（展开统计面板时以分钟为单位）
  statsHistItem: null,    // 统计面板-历史页：当前选中的物品 id
  statsHistZoom: 3,       // 统计面板-历史页：时间档位索引（10分钟/1小时/6小时/24小时）；默认 24 小时
  statsPowerTab: 'prod',  // 统计面板-电量页：prod(发电设备) | cons(耗电设备)
  machTab: 'prod',        // 设备面板-消耗/生产 tab：cons | prod（已弃用）
  settings: Object.assign({}, DEFAULT_SETTINGS),
  autoT: 0,
  power: { prod: 0, demand: 0, sat: 1 },
  powerT: 0,
  enemies: [],
  bullets: [],
  combatRobots: [],
  lootDrops: undefined,   // 击杀敌人掉落的矿石（见 combat2.js dropEnemyLoot）
  groundItems: undefined, // 玩家丢弃到地面的物品实体（见 player.js，供手动上料/传送带吸附）

  driving: null,       // 载具驾驶状态：{ ent: Car }，玩家进入驾驶时非空
  spawnT: 0,
  playerHP: PLAYER_BASE_MAX_HP,
  playerHPmax: PLAYER_BASE_MAX_HP,
  playerFireT: 0,
  weapon: null,       // 当前选中的武器 id（player 持有）
  screenFlash: 0,     // 全屏白光闪光强度（0~1，原子弹等大爆炸时触发，逐帧衰减）
  armor: null,        // 当前穿戴的护甲 id（light-armor / heavy-armor）
  gameWon: false,     // 是否已发射火箭赢得游戏
  repairPackUses: 0,  // 当前修理包剩余使用次数（用尽后消耗一个新修理包）
  victoryT: 0,
  inMenu: true,       // 开始菜单显示中：游戏世界尚未初始化，loop 暂停渲染与更新
  paused: false,      // 游戏暂停：由顶部“暂停/继续”按钮控制，暂停时世界/设备/玩家停摆
  deconstructMode: false,  // 拆除模式：开启后点触建筑即可拆除（右键拆除不受影响）
  deconstructHeld: false,  // 拆除模式：左键是否处于按住连续拆除状态
  craftQueue: [],     // 手搓合成队列：见 player.js 的 queueCraft / updateCraftQueue
};

let lastPlaceKey = '';
let lastPanelCheck = 0;
let fpsSmooth = 60;
let upsSmooth = 60;

// 存档由 js/saves.js 的多存档系统管理（自动存档 + 用户存档），不再使用单一键。
// 保留旧键常量供首次升级时迁移（见 migrateLegacySave）。

// 已废弃物品（对齐《异星工厂》2.0：以下物品已被官方移除，读档时从背包/各容器中清除）
const OBSOLETE_ITEMS = ['steel-stick', 'fishing-pole', 'iron-axe', 'steel-axe', 'steam-barrel',
  'thruster-fuel-barrel', 'thruster-oxidizer-barrel', 'portable-solar-panel-mk2',
  'diesel-locomotive'];

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(G.settings)); } catch (e) {}
}

function loadSettings() {
  try {
    const s = localStorage.getItem(SETTINGS_KEY);
    if (s) {
      // 已有保存的设置：以设置为准
      Object.assign(G.settings, JSON.parse(s));
    }
  } catch (e) {}
}

function newGame() {
  const seed = (typeof resolveWorldSeed === 'function') ? resolveWorldSeed() : ((Math.random() * 1e9) | 0);
  G.world = genWorld(seed);
  // 新种子下地形变化，清空分块离屏缓存
  if (typeof clearTerrainCache === 'function') clearTerrainCache();
  G.grid = new Map();
  G.buckets = new Map();
  G.ents = [];
  G.inv = new Map();
  G.techDone = {};
  G.techProg = {};
  G.activeTech = null;
  G.techQueue = [];
  G.sel = -1;
  G.quickSel = null;
  G.power = { prod: 0, demand: 0, sat: 1 };
  G.powerT = 0;
  G.enemies = []; G.bullets = []; G.spawnT = 0;
  G.enemyProjectiles = [];
  G.evolution = 0;   // 敌人进化度（战斗开启时随时间/击杀增长）
  // 敌人强度配置（对齐《异星工厂》新游戏敌人设置）：高难度开局即有一定初始进化度
  if (typeof enemyConfig === 'function' && G && G.worldConfig && enemyConfig().initEvolution) {
    G.evolution = enemyConfig().initEvolution;
  }
  G.pollution = 0;    // 污染值（对齐《异星工厂》：工业排放污染激怒虫群）
  G.pollutionWaves = 0; G.pollutionT = 0; G.pollutionScanT = 0; G.pollutionSpreadT = 0;
  G.pollutionField = null; G.treeWither = null;   // 逐格污染场与树枯萎进度（新游戏重置）
  G.combatRobots = [];
  G.aoeZones = [];        // 新游戏清空区域力场（毒/减速胶囊）
  G.groundFires = [];     // 新游戏清空地面火焰残留
  G.acidPools = [];       // 新游戏清空喷吐虫酸液洼地残留
  G.driving = null;    // 新游戏清空驾驶状态
  G.craftQueue = [];   // 新游戏清空手搓队列
  G.logiRobots = [];
  G.logiNet = null;
  G.logiNetT = 0;
  G.logiRequest = {};   // 新游戏清空个人物流请求
  G.trashSlots = {};     // 新游戏清空个人垃圾桶标记
  G.logiEnabled = true;   // 新游戏开启「背包物流」总开关
  G.recycleUnrequested = false; // 新游戏默认关闭「回收未请求物品」
  G.blueBook = [];      // 新游戏清空蓝图库
  G.orbitalCargo = {}; // 行星间货物调度：目标星球 -> { 物品 -> 数量 }（火箭发射送往目标星球，抵达后交付）
  G.mapTags = [];       // 新游戏清空地图标记
  if (typeof achInitStats === 'function') achInitStats();   // 新游戏清空成就状态
  G.railTiles = new Set();
  G.elevatedSupports = new Set();
  G.trains = [];
  G.playerHP = PLAYER_BASE_MAX_HP; G.playerHPmax = PLAYER_BASE_MAX_HP;
  G.weapon = null;
  G.armor = null;
  G.gameWon = false;
  if (typeof constrRestore === 'function') constrRestore(null);   // 重置个人机器人港与施工机器人状态
  if (typeof equipmentRestore === 'function') equipmentRestore(null);  // 重置个人装备网格
  G.victoryT = 0;
  if (typeof resetPowerReg === 'function') resetPowerReg();
  // 重置累计时间与历史统计（新游戏从头开始，无历史）
  G.time = 0;
  lastPanelCheck = 0;
  if (typeof initWeather === 'function') initWeather();  // 初始化天气（云层布局随世界种子确定性生成）
  if (typeof histReset === 'function') histReset();
  G.statsHistItem = null;
  G.statsItemTab = 'hist';
  G.statsHistSub = 'prod';
  G.statsLiveSub = 'prod';
  G.statsHistZoom = 3;
  const [sx, sy] = findSpawn(G.world);
  G.player = makePlayer(sx, sy);
  G.spawn = { x: sx, y: sy };
  G.cam.px = G.player.x;
  G.cam.py = G.player.y;
  invAdd('burner-mining-drill', 1);   // 热能采矿机
  invAdd('stone-furnace', 1);  // 石炉
  invAdd('transport-belt', 32); // 传送带
  invAdd('inserter', 4);        // 机械臂
  invAdd('coal', 8);
  // 初始装备（对齐《异星工厂》：手枪为游戏初始装备）
  invAdd('pistol', 1);
  // 测试用创造/虚空设备（创造箱/虚空箱/创造管道/虚空管道）不再默认发放：
  // 仅当在 Debug 模式中开启"无限资源"后才通过建造列表出现，正常游玩不可见。
}

// ===== 行星切换（Space Age 星际旅行） =====
// 研究「空间平台」科技后，可在游戏内切换到其它星球（祝融/句芒/雷神/玄冥）。
// 当前架构为单地表模型：切换星球会按目标星球的资源画像重新生成地表与矿脉，
// 保留玩家的背包、科技、装备与个人进度（资源/建筑为星球专属，故不跨星保留）。
// 未研究空间平台前调用会静默失败（由 UI 层把关）。
function travelToPlanet(planet, opts) {
  opts = opts || {};
  // 科技门禁：空间平台科技解锁星际旅行
  if (typeof isInfiniteTech !== 'function') return false;
  const gated = (opts.force !== true) && !(G.techDone && G.techDone['space-platform']);
  if (gated) return false;
  if (typeof planetId === 'function' && planet === planetId()) return false;  // 已在目标星球

  // 存档背包/科技/装备/玩家状态
  const inv = new Map(G.inv);
  const techDone = Object.assign({}, G.techDone);
  const techProg = Object.assign({}, G.techProg || {});
  const activeTech = G.activeTech;
  const techQueue = (G.techQueue || []).slice();
  const armor = G.armor;
  const weapon = G.weapon;
  const hp = G.playerHP, hpMax = G.playerHPmax;
  const repairUses = G.repairPackUses || 0;
  const logiRequest = Object.assign({}, G.logiRequest || {});
  const trashSlots = Object.assign({}, G.trashSlots || {});
  const logiEnabled = G.logiEnabled !== false;
  const recycleUnrequested = !!G.recycleUnrequested;
  const blueBook = (G.blueBook || []).slice();

  // 更新世界配置的星球
  if (!G.worldConfig) G.worldConfig = {};
  G.worldConfig.planet = planet;

  // 以相同种子重新生成地表（不同星球不同矿脉/地形）
  const seed = G.world.seed;
  G.world = genWorld(seed);
  if (typeof clearTerrainCache === 'function') clearTerrainCache();
  G.grid = new Map(); G.buckets = new Map(); G.ents = [];
  G.enemies = []; G.bullets = []; G.enemyProjectiles = []; G.groundFires = [];
  G.acidPools = []; G.combatRobots = []; G.aoeZones = [];
  G.railTiles = new Set(); G.elevatedSupports = new Set(); G.trains = [];
  G.logiNet = null; G.logiRequest = {}; G.trashSlots = {};
  if (typeof initWeather === 'function') initWeather();
  if (typeof pollutionReset === 'function') pollutionReset();
  if (typeof resetPowerReg === 'function') resetPowerReg();
  if (typeof initWeather === 'function') initWeather();

  // 恢复玩家状态
  const [sx, sy] = findSpawn(G.world);
  G.player = makePlayer(sx, sy);
  G.spawn = { x: sx, y: sy };
  G.cam.px = G.player.x; G.cam.py = G.player.y;
  G.playerHP = hp; G.playerHPmax = hpMax;
  G.armor = armor; G.weapon = weapon;
  G.repairPackUses = repairUses;

  // 恢复背包/科技/物流请求/蓝图库
  G.inv = inv;
  G.techDone = techDone; G.techProg = techProg; G.activeTech = activeTech; G.techQueue = techQueue;
  // 交付已送达本星球的行星间货物（火箭发射送往目标星球，抵达后降落）
  if (typeof deliverOrbitalCargo === 'function') deliverOrbitalCargo(planet);
  G.logiRequest = logiRequest; G.trashSlots = trashSlots; G.blueBook = blueBook;
  G.logiEnabled = logiEnabled; G.recycleUnrequested = recycleUnrequested;
  if (typeof constrRestore === 'function') constrRestore(null);
  if (typeof equipmentRestore === 'function') equipmentRestore(null);
  return true;
}

function serializeAll() {
  return {
    v: 2, // 存档布局版本：v2 起含核能设备占地迁移后的布局；旧档(v<2)读档时做占地迁移（见 applySave）
    seed: G.world.seed,
    worldConfig: (typeof normalizeWorldConfig === 'function') ? normalizeWorldConfig(G.worldConfig) : G.worldConfig,
    world: {
      remaining: Array.from(G.world.remaining, ([k, v]) => {
        const i = k.indexOf(',');
        return [+k.slice(0, i), +k.slice(i + 1), v];
      }),
      chunks: Array.from(G.world.chunks.values()).map(encodeChunkData),
      explored: (G.world.explored ? Array.from(G.world.explored) : [])
    },
    ents: G.ents.filter(e => !e._dead).map(e => e.serialize()),
    inv: Array.from(G.inv),
    logiRequest: Object.assign({}, G.logiRequest || {}),
    trashSlots: Object.assign({}, G.trashSlots || {}),
    logiEnabled: G.logiEnabled !== false,
    recycleUnrequested: !!G.recycleUnrequested,
    player: { x: G.player.x, y: G.player.y, hp: G.playerHP, weapon: G.weapon, armor: G.armor },
    evolution: G.evolution || 0,
    pollution: (typeof pollutionSerialize === 'function') ? pollutionSerialize() : null,
    craftQueue: (G.craftQueue || []).map(q => ({
      rid: q.rid, time: q.time, total: q.total, done: q.done, outId: q.outId
    })),
    gameWon: G.gameWon,
    repairPackUses: G.repairPackUses || 0,
    techDone: G.techDone,
    techProg: G.techProg,
    activeTech: G.activeTech,
    techQueue: G.techQueue || [],
    hotbar: HOTBAR.slice(),
    quickbar: (typeof qbSerialize === 'function') ? qbSerialize() : null,
    settings: Object.assign({}, G.settings),
    dbg: Object.assign({}, G.dbg),
    // 游戏累计时间（秒）：用于历史统计分桶的时间锚点，读档后延续
    time: G.time,
    // 历史统计：聚合为小时粒度写入（体积极小，最多 24 小时/物品）
    hist: (typeof histSerialize === 'function') ? histSerialize() : null,
    constr: (typeof constrSerialize === 'function') ? constrSerialize() : null,
    equipment: (typeof equipmentSerialize === 'function') ? equipmentSerialize() : null,
    orbitalCargo: Object.assign({}, G.orbitalCargo || {}),
    blueBook: (G.blueBook || []).map(b => ({ name: b.name, minX: b.minX | 0, minY: b.minY | 0, ents: b.ents, tiles: Array.isArray(b.tiles) ? b.tiles : [] })),
    mapTags: (typeof mapTagsSerialize === 'function') ? mapTagsSerialize() : (G.mapTags || []).slice(),
    achievements: (typeof achievementsSerialize === 'function') ? achievementsSerialize() : null
  };
}

// 保存为一条用户存档（type='user'）。id 为空时新建，否则覆盖指定存档。
// name 为用户自定义名称。返回 Promise<保存结果对象或 null>。
async function saveGame(id, name) {
  const data = serializeAll();
  let res;
  if (id && await hasSave(id)) {
    res = await overwriteSave(id, data);
    if (res) {
      const numTag = res.num ? (res.type === 'auto' ? '自动存档 #' + res.num : '用户存档 #' + res.num) : (res.name || '存档');
      toast('已覆盖存档：' + numTag);
    }
    else toast('保存失败');
  } else {
    // 新建用户存档：最多只能有 MAX_USER_SAVES 个，超出则提示
    if (!id && await countUserSaves() >= MAX_USER_SAVES) {
      toast('已达用户存档上限（' + MAX_USER_SAVES + ' 个），请先删除或覆盖旧存档');
      return null;
    }
    res = await writeSave(data, 'user', id || null, name || '');
    if (res) toast('已保存：用户存档 #' + (res.num || '?'));
    else toast('保存失败');
  }
  return res;
}

// 读取指定 id 的存档（不存在则返回 false）
async function loadGame(id) {
  if (!id) { toast('没有存档'); return false; }
  const data = await readSave(id);
  if (!data) { toast('没有存档'); return false; }
  try {
    applySave(data);
    closePanel();
    toast('已读档');
    if (typeof sfxWarmup === 'function') sfxWarmup(500); // 读档静默缓冲，过滤首帧实体恢复爆音
  } catch (err) {
    toast('存档损坏：' + err.message);
    return false;
  }
  return true;
}

// 旧档布局迁移：本版热交换器 3×1→3×2、汽轮机 3×3→3×5（占地变大/方向修正）。
// 读旧档（布局版本 <2）时，这些尺寸变化的设备按新尺寸占地会与相邻实体在 G.grid 中
// 互相覆盖，导致“既选不中又删不掉、却仍显示在地图上”。此处在读档时把它们平移到
// 不与相邻实体重叠的位置，保证可正常选中/拆除。仅对旧档生效，新档（已迁移）不受影响。
const LAYOUT_MIGRATE_TYPES = { 'heat-exchanger': true, 'steam-turbine': true };

// 判断实体 e 以 (x, y) 为左上角是否与 G.grid 中已注册实体重叠
function entityOverlaps(e, x, y) {
  for (let dy = 0; dy < e.h; dy++)
    for (let dx = 0; dx < e.w; dx++)
      if (G.grid.has(entKey(x + dx, y + dy))) return true;
  return false;
}

// 重叠消解：若实体 e 当前占地与相邻实体重叠，从原点出发按“由近及远、环形扩散”的顺序
// 试探平移，找到第一个不与任何已注册实体重叠的位置并更新 e.x/e.y。
// 采用环形扩散而非固定候选表：旧档在尺寸变化后（热交换器 3×1→3×2、汽轮机 3×3→5×3）
// 占地变大，密集型布局下固定候选格可能全部被占满，导致无法找到空位而残留重叠实体
// （“既选不中又删不掉、却仍显示在地图上”的幻影建筑）。环形扩散保证只要存在空位就能找到。
function migrateLegacyEntityLayout(e) {
  if (!entityOverlaps(e, e.x, e.y)) return;
  // 从半径 1 逐圈向外扩散，每圈只扫外边界格（避免重复探测内圈），半径上限 10 格
  const R = 10;
  for (let r = 1; r <= R; r++) {
    // 上/下边
    for (let dx = -r; dx <= r; dx++) {
      if (!entityOverlaps(e, e.x + dx, e.y - r)) { e.x += dx; e.y -= r; return; }
      if (!entityOverlaps(e, e.x + dx, e.y + r)) { e.x += dx; e.y += r; return; }
    }
    // 左/右边（跳过四角，避免重复）
    for (let dy = -r + 1; dy <= r - 1; dy++) {
      if (!entityOverlaps(e, e.x - r, e.y + dy)) { e.x -= r; e.y += dy; return; }
      if (!entityOverlaps(e, e.x + r, e.y + dy)) { e.x += r; e.y += dy; return; }
    }
  }
}


function applySave(d) {
  // ===== 物品/配方 ID 官方命名迁移 =====
  // 旧档使用项目自定 ID，现已全部对齐《异星工厂》官方命名。读档时把旧 ID 递归翻译为新官方名。
  // 旧档旧 ID → 新官方 ID（与 tools/generate-game-data.js 的命名对齐保持一致）。
  const ID_MIGRATE = {
    'iron-gear': 'iron-gear-wheel',
    'green-circuit': 'electronic-circuit',
    'science-pack': 'automation-science-pack',
    'green-science': 'logistic-science-pack',
    'military-science': 'military-science-pack',
    'blue-science': 'chemical-science-pack',
    'assembling-machine': 'assembling-machine-1',
    'assembling-machine-mk2': 'assembling-machine-2',
    'underground': 'underground-belt',
    'burner-drill': 'burner-mining-drill',
    'electric-drill': 'electric-mining-drill',
    'refinery': 'oil-refinery',
    'lamp': 'small-lamp',
    'long-inserter': 'long-handed-inserter',
    'empty-barrel': 'barrel',
    'explosive': 'explosives',
    'electric-engine': 'electric-engine-unit',
    'magazine': 'firearm-magazine',
    'piercing-rounds': 'piercing-rounds-magazine',
    'uranium-rounds': 'uranium-rounds-magazine',
    'rocket-ammo': 'rocket',
    'stack-inserter': 'bulk-inserter',
    'logistic-chest-passive': 'passive-provider-chest',
    'logistic-chest-active': 'active-provider-chest',
    'logistic-chest-storage': 'storage-chest',
    'logistic-chest-requester': 'requester-chest',
    'logistic-chest-buffer': 'buffer-chest',
    'portable-solar-panel': 'solar-panel-equipment',
    'personal-battery': 'battery-equipment',
    'portable-fusion-reactor': 'fusion-reactor-equipment',
    'exoskeleton': 'exoskeleton-equipment',
    'nightvision': 'night-vision-equipment',
    'energy-shield': 'energy-shield-equipment',
    'energy-shield-mk2': 'energy-shield-mk2-equipment',
    'personal-laser-defense': 'personal-laser-defense-equipment',
    'discharge-defense': 'discharge-defense-equipment',
    'personal-roboport': 'personal-roboport-equipment',
    'personal-battery-mk2': 'battery-mk2-equipment',
    'personal-roboport-mk2': 'personal-roboport-mk2-equipment',
    // 旧版基础储物箱（官方无此物品，basic 存储用铁/钢/木箱）→ 并入钢箱
    'storage-chest': 'steel-chest',
    // 内燃机车（官方无此物品，仅一种火车头 locomotive）→ 并入标准车头
    'diesel-locomotive': 'locomotive',
  };
  // 递归迁移：把对象/数组里出现的所有旧 ID 字符串键/值换成新 ID
  function migrateIds(obj) {
    if (Array.isArray(obj)) { for (let i = 0; i < obj.length; i++) obj[i] = migrateIds(obj[i]); return obj; }
    if (obj && typeof obj === 'object') {
      for (const k of Object.keys(obj)) {
        // 移除已废弃物品（对齐《异星工厂》2.0）
        if (OBSOLETE_ITEMS.includes(k)) { delete obj[k]; continue; }
        const nk = ID_MIGRATE[k] || k;
        if (nk !== k) { obj[nk] = migrateIds(obj[k]); delete obj[k]; }
        else obj[k] = migrateIds(obj[k]);
      }
      return obj;
    }
    if (typeof obj === 'string') return OBSOLETE_ITEMS.includes(obj) ? '' : (ID_MIGRATE[obj] || obj);
    return obj;
  }
  if (d) migrateIds(d);

  // 恢复地图生成配置（对齐《异星工厂》：新游戏的世界参数随存档持久化）
  if (typeof normalizeWorldConfig === 'function') {
    const wc = normalizeWorldConfig(d.worldConfig);
    // 用存档种子填充配置 seed（读档后不再用其重新生成，仅保留语义）
    wc.seed = (d.seed && d.seed > 0) ? d.seed : wc.seed;
    G.worldConfig = wc;
  }
  G.world = genWorld(d.seed);
  G.world.remaining = new Map();
  if (d.world && Array.isArray(d.world.chunks)) {
    // 已探索地图块原样还原：与生成算法解耦，保证升级后地图不变
    for (const cd of d.world.chunks) {
      try {
        const c = decodeChunkData(cd);
        G.world.chunks.set(c.cx + ',' + c.cy, c);
      } catch (e) { /* 单块数据损坏则跳过，该块回退到按需生成 */ }
    }
  }
  if (d.world && Array.isArray(d.world.remaining)) {
    for (const [x, y, amt] of d.world.remaining) G.world.remaining.set(x + ',' + y, amt);
  } else if (Array.isArray(d.oreType)) {
    const OW = 180, OH = 180;
    for (let i = 0; i < OW * OH; i++) {
      if (d.oreType[i] >= 0 && d.oreAmt && d.oreAmt[i] >= 0) {
        G.world.remaining.set((i % OW) + ',' + ((i / OW) | 0), d.oreAmt[i]);
      }
    }
  }
  G.grid = new Map();
  G.buckets = new Map();
  G.ents = [];
  if (Array.isArray(d.world && d.world.explored)) G.world.explored = new Set(d.world.explored);
  else if (!G.world.explored) G.world.explored = new Set();
  if (typeof resetPowerReg === 'function') resetPowerReg();
  // 占地尺寸兼容：此前热交换器占地 3×1、汽轮机 3×3，本版改为 3×2、3×5。
  // 旧档按旧尺寸摆放，读档后按新尺寸占地会与相邻设备在 G.grid 中互相覆盖，
  // 导致实体“既选不中又删不掉、却仍显示在地图上”。故对所有版本存档读档时
  // 对这两个尺寸敏感的设备做重叠消解：仅当重叠才平移，未重叠的保持原位（幂等）。
  for (const s of d.ents) {
    const cls = ENT_CLASSES[s.type];
    if (!cls) continue;
    const e = cls.restore(s);
    // 对所有版本存档都做占地重叠消解：仅当实体按当前尺寸占地与相邻实体重叠时才会平移
    // （幂等，未重叠的实体保持原位）。旧档（布局版本<2）因尺寸变化必然重叠故需要迁移；
    // 新档若曾被旧版迁移算法误留下重叠幻影，也会在此一并清除，保证可正常选中/拆除。
    if (LAYOUT_MIGRATE_TYPES[s.type]) migrateLegacyEntityLayout(e);
    addEnt(e);
  }
  G.inv = new Map(d.inv);
  // 物品 ID 重命名迁移：官方命名贫化铀燃料棒（depleted-uranium-fuel-cell），旧档用废燃料棒（used-up-uranium-fuel-cell）
  if (G.inv.has('used-up-uranium-fuel-cell')) {
    G.inv.set('depleted-uranium-fuel-cell', (G.inv.get('depleted-uranium-fuel-cell') || 0) + G.inv.get('used-up-uranium-fuel-cell'));
    G.inv.delete('used-up-uranium-fuel-cell');
  }
  // 移除已废弃物品（对齐《异星工厂》2.0：铁斧/钢斧/钓鱼竿/钢杆/桶装蒸汽已被官方移除）
  for (const ob of OBSOLETE_ITEMS) if (G.inv.has(ob)) G.inv.delete(ob);
  // 恢复个人物流请求（旧档无该字段则置空）
  G.logiRequest = {};
  if (d.logiRequest && typeof d.logiRequest === 'object') {
    for (const k in d.logiRequest) if (ITEMS[k] && d.logiRequest[k] > 0) G.logiRequest[k] = d.logiRequest[k] | 0;
  }
  // 恢复个人垃圾桶标记（旧档无该字段则置空）
  G.trashSlots = {};
  if (d.trashSlots && typeof d.trashSlots === 'object') {
    for (const k in d.trashSlots) if (ITEMS[k] && d.trashSlots[k]) G.trashSlots[k] = true;
  }
  // 恢复「背包物流」总开关与「回收未请求物品」开关（旧档默认背包物流开启、不回收未请求物品）
  G.logiEnabled = d.logiEnabled !== false;
  G.recycleUnrequested = !!d.recycleUnrequested;
  G.craftQueue = Array.isArray(d.craftQueue)
    ? d.craftQueue.filter(q => RECIPES[q.rid] && isHandCraftable(q.rid)).map(q => ({
      rid: q.rid, outId: q.outId, time: q.time || 1, total: q.time || 1, done: q.done || 0
    })) : [];
  G.player = makePlayer(0, 0);
  G.player.x = d.player.x; G.player.y = d.player.y;
  // 加载存档：保留当前生命值（不超过基础最大值），但最大生命值统一对齐《异星工厂》主角 250 点
  if (typeof d.player.hp === 'number') G.playerHP = Math.min(PLAYER_BASE_MAX_HP, Math.max(1, d.player.hp));
  G.playerHPmax = PLAYER_BASE_MAX_HP;
  G.weapon = d.player.weapon || null;
  G.armor = (isArmor && isArmor(d.player.armor)) ? d.player.armor : null;
  // 恢复敌人进化度（旧档无该字段则从 0 开始）
  G.evolution = (typeof d.evolution === 'number') ? Math.min(1, Math.max(0, d.evolution)) : 0;
  // 恢复污染状态（旧档无该字段则从 0 开始）
  if (typeof pollutionRestore === 'function') pollutionRestore(d.pollution);
  else { G.pollution = 0; G.pollutionWaves = 0; G.pollutionT = 0; }
  G.gameWon = !!d.gameWon;
  // 恢复蓝图库（旧档无该字段则置空）
  G.blueBook = [];
  if (Array.isArray(d.blueBook)) {
    for (const b of d.blueBook) {
      if (b && Array.isArray(b.ents) && b.ents.length && b.name) {
        G.blueBook.push({ name: String(b.name), minX: b.minX | 0, minY: b.minY | 0, ents: b.ents, tiles: Array.isArray(b.tiles) ? b.tiles : [] });
      }
    }
  }
  G.repairPackUses = (typeof d.repairPackUses === 'number') ? d.repairPackUses : 0;
  // 恢复行星间货物调度队列（旧档无该字段则置空）
  G.orbitalCargo = (d.orbitalCargo && typeof d.orbitalCargo === 'object') ? d.orbitalCargo : {};
  if (typeof mapTagsDeserialize === 'function') mapTagsDeserialize(d.mapTags); else G.mapTags = [];
  if (typeof achievementsRestore === 'function') achievementsRestore(d.achievements); else if (typeof achInitStats === 'function') achInitStats();
  G.combatRobots = [];
  G.driving = null;
  G.logiRobots = [];
  G.logiNet = null;
  G.logiNetT = 0;
  if (typeof constrRestore === 'function') constrRestore(d.constr);
  if (typeof equipmentRestore === 'function') equipmentRestore(d.equipment);
  if (typeof rebuildTrains === 'function') rebuildTrains();
  const [sx, sy] = findSpawn();
  G.spawn = { x: sx, y: sy };
  G.techDone = d.techDone || {};
  // 科技树新增科技迁移（对齐《异星工厂》进阶科技，保持旧档可用）
  // 新版本把原可直接用/仅按核能门控的配方拆成独立进阶科技；
  // 旧档已研究上游科技时自动补完新科技，避免已有产线因配方锁定而失效。
  migrateNewTechs(G.techDone);
  // 无限科技永不完成：读档时清除其被错误标记的“已完成”状态，保证仍可继续无限研究
  for (const t in G.techDone) if (isInfiniteTech(t)) delete G.techDone[t];
  G.techProg = d.techProg || {};
  G.activeTech = d.activeTech || null;
  // 恢复研究队列（过滤已完成/无效项）
  G.techQueue = Array.isArray(d.techQueue)
    ? d.techQueue.filter(t => TECHS[t] && !G.techDone[t])
    : (G.activeTech ? [G.activeTech] : []);
  G.sel = -1;
  G.quickSel = null;
  G.power = { prod: 0, demand: 0, sat: 1 };
  G.powerT = 0;
  if (d.settings) Object.assign(G.settings, d.settings);
  // 读档后恢复设置
  // 开发者调试数据随存档保存/读取。仅当 URL 参数含 debug=1（debug 按钮开启）时
  // 才恢复已保存的调试数据；否则这些数据不生效，保持默认值。
  if (G.debugEnabled) {
    if (d.dbg && typeof d.dbg === 'object') Object.assign(G.dbg, d.dbg);
    // 刷新Debug面板显示，使已恢复的调试数据正确展示在面板上
    if (typeof refreshDebugPanel === 'function') refreshDebugPanel();
  } else {
    // debug 未开启：重置为默认值，确保读档含 debug 的数据也不生效
    Object.assign(G.dbg, { timeScale: 1, moveSpeed: 1, mineMult: 1, beltMult: 1, drillMult: 1, asmMult: 1, infinite: false, farReach: false, noclip: false });
  }
  if (Array.isArray(d.hotbar)) {
    HOTBAR = d.hotbar.slice(0, 10);
    while (HOTBAR.length < 10) HOTBAR.push(null);
    buildHotbar();
  }
  if (typeof qbApply === 'function') qbApply(d.quickbar || null);
  // 恢复游戏累计时间（历史统计的时间锚点；旧档无该字段则从 0 开始）
  if (typeof d.time === 'number' && isFinite(d.time)) G.time = d.time;
  if (typeof initWeather === 'function') initWeather();  // 读档后按世界种子初始化天气
  // 恢复历史统计（把存档中的小时序列展开回环形缓冲；无历史则重置）
  if (typeof histReset === 'function') histReset();
  if (typeof histDeserialize === 'function' && d.hist) histDeserialize(d.hist);
  G.statsHistItem = null;
  G.statsHistZoom = G.statsHistZoom || 3;
  // 读档后回到存档点，清掉拖动 pan 偏移让相机居中于玩家
  if (G.cam.pan) { G.cam.pan.x = 0; G.cam.pan.y = 0; }
  G.cam.px = G.player.x; G.cam.py = G.player.y;
  uiDirty = true;
}

// 地面铺设：混凝土/石砖路铺在草地上，填海把水面填成草地，雅玛果土壤铺在草地上（太空时代农业）
const PAVE_TILE = { 'concrete': T_CONCRETE, 'refined-concrete': T_REF_CONCRETE, 'hazard-concrete': T_HAZARD, 'refined-hazard-concrete': T_REF_HAZARD, 'stone-path': T_PATH, 'foundation': T_FOUNDATION, 'ice-platform': T_ICE_PLATFORM, 'space-platform-foundation': T_SPACE_PLATFORM };
const SOIL_TILE = { 'artificial-yumako-soil': T_YUMAKO_SOIL, 'overgrowth-yumako-soil': T_OVERGROWTH_YUMAKO_SOIL, 'artificial-jellynut-soil': T_JELLYNUT_SOIL, 'overgrowth-jellynut-soil': T_OVERGROWTH_JELLYNUT_SOIL };
// 树种子（太空时代绿化补种）：铺在草地上种回一棵树（对齐《异星工厂》Space Age Tree seeding）
const SEED_TILE = { 'tree-seed': T_TREE };
function placeGround(type, tx, ty, infinite) {
  const t = getTerrain(tx, ty);
  if (type === 'landfill') {
    if (t !== T_WATER) { toast('填海料只能铺在水面上'); return; }
    if (entAt(tx, ty)) { toast('水面有建筑，无法填海'); return; }
    setTerrain(tx, ty, T_GRASS);
  } else if (type === 'foundation') {
    // 地基（官方 Foundation）：可铺在水面/熔岩上形成可建造硬地（对齐官方 place_as_tile 允许覆盖水域/熔岩），也可铺在地面
    if (entAt(tx, ty)) { toast('地面有建筑，先拆除'); return; }
    if (t === T_FOUNDATION) return;
    setTerrain(tx, ty, T_FOUNDATION);
  } else if (type === 'space-platform-foundation') {
    // 太空平台地基（官方 Space platform foundation）：灰色栅格合金地板，铺成太空平台地板（对齐官方 place_as_tile），可铺在地面/地基/混凝土等硬面上
    if (entAt(tx, ty)) { toast('地面有建筑，先拆除'); return; }
    if (t === T_SPACE_PLATFORM) return;
    setTerrain(tx, ty, T_SPACE_PLATFORM);
  } else if (SOIL_TILE[type] !== undefined) {
    const to = SOIL_TILE[type];
    // 铺设在树木上：先砍掉树（对齐《异星工厂》：铺设前自动清理树木）
    if (t === T_TREE) setTerrain(tx, ty, T_GRASS);
    const t2 = getTerrain(tx, ty);
    // 雅玛果土壤只能铺在草地上（对齐官方 place_as_tile 条件：需地面图层）
    if (t2 !== T_GRASS && t2 !== to) { toast(ITEMS[type]?.name + '只能铺在地面上'); return; }
    if (t2 === to) return; // 已是同种土壤，不重复消耗
    if (entAt(tx, ty)) { toast('地面有建筑，先拆除'); return; }
    setTerrain(tx, ty, to);
  } else if (SEED_TILE[type] !== undefined) {
    const to = SEED_TILE[type];
    // 树种子只能种在草地上（对齐官方：在 grass 或 dirt 上播种）
    if (t !== T_GRASS) { toast(ITEMS[type]?.name + '只能种在草地上'); return; }
    if (entAt(tx, ty)) { toast('地面有建筑，先拆除'); return; }
    setTerrain(tx, ty, to);
  } else {
    const to = PAVE_TILE[type];
    // 铺设在树木上：先砍掉树（对齐《异星工厂》：铺设前自动清理树木）
    if (t === T_TREE) setTerrain(tx, ty, T_GRASS);
    const t2 = getTerrain(tx, ty);
    if (t2 !== T_GRASS && t2 !== to) { toast('混凝土/石砖路只能铺在地面上'); return; }
    if (t2 === to) return; // 已是同种地砖，不重复消耗
    if (entAt(tx, ty)) { toast('地面有建筑，先拆除'); return; }
    setTerrain(tx, ty, to);
  }
  if (typeof invalidateTerrainChunk === 'function') invalidateTerrainChunk(tx, ty);
  if (!infinite) invTake(type, 1);
  if (typeof playSfx === 'function') playSfx('build');
  refreshHotbar();
}


// 植树造林：把树种播在草地上，长成一棵树（对齐《异星工厂》Space Age Tree seeding）
// 树为地形瓦片 T_TREE（可砍伐获木材，吸收污染）。只能种在无建筑的草地上。
function plantTree(tx, ty, infinite) {
  const t = getTerrain(tx, ty);
  if (t === T_TREE) { toast('这里已经有树了'); if (typeof playSfx === 'function') playSfx('deny'); return; }
  if (t !== T_GRASS) { toast('树种只能种在草地上'); if (typeof playSfx === 'function') playSfx('deny'); return; }
  if (entAt(tx, ty)) { toast('地面有建筑，无法种树'); if (typeof playSfx === 'function') playSfx('deny'); return; }
  setTerrain(tx, ty, T_TREE);
  if (typeof invalidateTerrainChunk === 'function') invalidateTerrainChunk(tx, ty);
  if (!infinite) invTake('tree-seed', 1);
  if (typeof playSfx === 'function') playSfx('build');
  refreshHotbar();
}

function tryPlaceAt(tx, ty) {
  const rawSel = selItem();
  if (!rawSel) return;
  const infinite = !!(G.dbg && G.dbg.infinite);
  // 品质物品：`item~quality` 由品质模块产出。放置时剥离品质后缀取基础类型，并把品质写入实体
  const sq = (typeof splitQuality === 'function') ? splitQuality(rawSel) : { base: rawSel, quality: 'normal' };
  const type = sq.base;
  const placeQuality = sq.quality;
  // 地面铺设（混凝土/石砖路/填海等）：不创建实体，直接修改地形（需优先于 BUILD_DEFS 守卫判定）
  if (type === 'concrete' || type === 'refined-concrete' || type === 'hazard-concrete' || type === 'stone-path' || type === 'landfill' || type === 'foundation' || type === 'ice-platform' || type === 'space-platform-foundation' || SOIL_TILE[type] !== undefined || SEED_TILE[type] !== undefined) {
    placeGround(type, tx, ty, infinite);
    return;
  }
  // 树种（植树造林）：不创建实体，直接把草地长成一棵树（对齐《异星工厂》Space Age Tree seeding）
  if (type === 'tree-seed') {
    plantTree(tx, ty, infinite);
    return;
  }
  // 非可建造物品（如修理包）不触发建造
  if (!BUILD_DEFS[type]) return;
  // 科技解锁要求拦截（火箭/激光炮塔等高级建筑）
  if (TECH_REQ[type] && !G.techDone[TECH_REQ[type]]) {
    toast('需要先研究「' + TECHS[TECH_REQ[type]].name + '」才能建造 ' + ITEMS[type].name);
    return;
  }
  // 无限资源模式：建造不消耗原料，且可直接放置测试用创造/虚空箱与管道（无需背包里拥有）
  // 品质物品须检查实际持有的带品质物品（背包里是 `item~quality`），基础类型未必有库存
  const needId = (placeQuality && placeQuality !== 'normal') ? rawSel : type;
  if (!infinite && invCount(needId) < 1) {
    toast('背包里没有' + ITEMS[type].name + '了');
    if (typeof playSfx === 'function') playSfx('deny');
    G.sel = -1;
    G.quickSel = null;
    refreshHotbar();
    return;
  }
  const chk = canPlaceAt(type, tx, ty, G.ghostDir);
  if (!chk.ok) {
    // 传送带特殊逻辑优先：同向衔接铺设、或自动改用地下带跨越障碍
    if (tryPlaceOntoSameDirBelt(type, tx, ty)) { uiDirty = true; return; }
    if (tryAutoUnderground(type, tx, ty)) { uiDirty = true; return; }
    // 不允许覆盖建造：目标格已有建筑（如组装机）时直接提示，不拆除替换。
    // 传送带升级/降级仍走上方同族覆盖逻辑，其余建筑冲突一律拒绝。
    toast('无法在这里建造');
    if (typeof playSfx === 'function') playSfx('deny');
    return;
  }
  // 覆盖升级/降级：把带/地下带/分流器放到同族现有传送带上，直接覆盖当前连续的一段
  const target = entAt(tx, ty);
  if (target && canOverwriteWithBelt(type, target)) {
    // 1×1 的传送带才走「整段连续升级」；2 格分流器必须走单格覆盖替换：
    // 否则 upgradeBeltSegment 会把分流器两个占地格当成两个独立实体处理，
    // 导致重复创建错位实体、格子索引错乱（被覆盖建筑残留且无法移除，读档后恢复）。
    if (target instanceof Belt && !(target instanceof Splitter)) {
      upgradeBeltSegment(tx, ty, type, infinite);   // 传送带：一键升级/降级整条连续带线
    } else {
      overwriteBeltTile(tx, ty, type, infinite);     // 地下带/分流器：单格覆盖
    }
    return;
  }
  // 分流器/地下带等多格实体：若新实体的「非光标分格」也覆盖了同族多格实体
  // （例如横向分流器覆盖纵向分流器时，光标落在空白格、仅另一半叠在旧分流器上），
  // 上面的 cursor 格判定会因 entAt(tx,ty) 为空而走不到覆盖分支，从而直接新建叠加，
  // 造成旧分流器未移除、新分流器只叠一半（bug）。这里扫一遍新实体占地格补上覆盖。
  const _def = BUILD_DEFS[type];
  let _ew = _def.w, _eh = _def.h;
  if (_def.rotSwap && (G.ghostDir % 2 === 1)) { _ew = _def.h; _eh = _def.w; }
  if (_ew > 1 || _eh > 1) {
    for (let dy = 0; dy < _eh; dy++) {
      for (let dx = 0; dx < _ew; dx++) {
        if (dx === 0 && dy === 0) continue; // 光标格已在上面处理过
        const e = entAt(tx + dx, ty + dy);
        if (e && canOverwriteWithBelt(type, e) && !(e instanceof Belt && !(e instanceof Splitter))) {
          overwriteBeltTile(tx + dx, ty + dy, type, infinite);
          return;
        }
      }
    }
  }
  const cls = ENT_CLASSES[type];
  const e = new cls(type, tx, ty);
  e.dir = G.ghostDir;
  e.applyDir();
  // 品质建筑：记录品质等级（normal 不记），后续设备速度/强度按品质加成
  if (placeQuality && placeQuality !== 'normal') e.quality = placeQuality;
  addEnt(e);
  if (!infinite) invTake(needId, 1);
  // 成就：建造计数（对齐《异星工厂》建造成就）
  if (typeof achEnsureStats === 'function') { achEnsureStats(); G.achStats.builds++; checkAchievements(); }
  if (typeof playSfx === 'function') playSfx('build');
  refreshHotbar();
}

// 点击传送带：用 type 覆盖目标，并一键升级/降级当前连续的所有同族传送带（对齐《异星工厂》覆盖升级整条带线）。
// 只升级当前那一节（同一方向、相互衔接、同阶）的带子；消耗新带、返还旧带，物品保留。
function upgradeBeltSegment(tx, ty, type, infinite) {
  const oldType = entAt(tx, ty) ? entAt(tx, ty).type : null;
  if (!oldType || oldType === type) return;   // 同阶覆盖：不消耗、视为未改变
  // 防御：仅允许 1×1 传送带参与整段连续升级。
  // 多格实体的每个占地格若被当成独立带子处理会重复创建错位实体、破坏格子索引，
  // 导致被覆盖建筑残留且无法移除（读档后才恢复）。分流器覆盖请走 overwriteBeltTile。
  const _t = entAt(tx, ty);
  if (_t && (_t.w * _t.h > 1 || _t instanceof Splitter)) return;
  const family = tierFamily(type);
  const oldFamily = tierFamily(oldType);
  if (!family || family !== oldFamily) return; // 非同族：不应走到这里

  // 收集目标所在连续段：与目标同族、且当前同阶的相邻（含斜向衔接的转弯带）带子
  const seg = new Set();
  const q = [[tx, ty]];
  seg.add(tx + ',' + ty);
  while (q.length) {
    const [cx, cy] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      const k = nx + ',' + ny;
      if (seg.has(k)) continue;
      const n = entAt(nx, ny);
      if (n && tierFamily(n.type) === family && n.type === oldType) {
        seg.add(k);
        q.push([nx, ny]);
      }
    }
  }
  const count = seg.size;
  // 检查是否有足够的新带（升级时消耗；降级时不消耗反而返还旧带）
  if (!infinite && tierNext(oldType) === type && invCount(type) < count) {
    toast('背包里没有足够的' + ITEMS[type].name + '（需 ' + count + '）');
    return;
  }
  // 执行：把段内所有带子换成新带，保留朝向与物品
  for (const k of seg) {
    const [sx, sy] = k.split(',').map(Number);
    const e = entAt(sx, sy);
    const dir = e.dir;
    const items = e.items ? e.items.map(o => ({ item: o.item, pos: o.pos })) : [];
    removeEnt(e);
    const cls = ENT_CLASSES[type];
    const ne = new cls(type, sx, sy);
    ne.dir = dir;
    ne.applyDir();
    if (ne.items) ne.items = items;
    addEnt(ne);
  }
  if (!infinite) {
    if (tierNext(oldType) === type) invTake(type, count);          // 升级：扣新带
    else invAdd(oldType, count);                                     // 降级：返还旧带
  }
  if (G.panelEnt && seg.has(G.panelEnt.x + ',' + G.panelEnt.y)) closePanel();
  toast('已' + (tierNext(oldType) === type ? '升级' : '降级') + ' ' + count + ' 格' + ITEMS[oldType].name + ' → ' + ITEMS[type].name);
  uiDirty = true;
  refreshHotbar();
}

// 单格覆盖：地下带/分流器等非 1×1 带子在原位置直接替换为 type（对齐《异星工厂》覆盖升级）
function overwriteBeltTile(tx, ty, type, infinite) {
  const old = entAt(tx, ty);
  if (!old) return;
  const oldType = old.type;
  if (oldType === type) return;
  const dir = old.dir;
  const items = old.items ? old.items.map(o => ({ item: o.item, pos: o.pos })) : [];
  const outp = old.outp ? JSON.parse(JSON.stringify(old.outp)) : null;
  if (!infinite && tierNext(oldType) === type && invCount(type) < 1) {
    toast('背包里没有' + ITEMS[type].name);
    return;
  }
  removeEnt(old);
  const cls = ENT_CLASSES[type];
  // 新实体放在旧实体的原点 (old.x, old.y)，而非传入的 (tx,ty)：
  // 否则光标落在 2 格分流器的第二格时，会以第二格为原点导致整体平移一格、
  // 半边空出半边残留（覆盖错位）。保持 dir 沿用旧方向，占地与旧实体一致。
  const ne = new cls(type, old.x, old.y);
  ne.dir = dir;
  ne.applyDir();
  if (ne.items) ne.items = items;
  if (ne.outp && outp) ne.outp = outp;
  addEnt(ne);
  if (!infinite) {
    if (tierNext(oldType) === type) invTake(type, 1);
    else invAdd(oldType, 1);
  }
  if (G.panelEnt === old) closePanel();
  toast('已' + (tierNext(oldType) === type ? '升级' : '降级') + '为 ' + ITEMS[type].name);
  uiDirty = true;
  refreshHotbar();
}

// 传送带类型 → 对应的地下传送带类型
const BELT_TO_UG = {
  'transport-belt': 'underground-belt',
  'fast-transport-belt': 'fast-underground-belt',
  'express-transport-belt': 'express-underground-belt',
  'turbo-transport-belt': 'turbo-underground-belt'
};

function ugMaxDist(ugType) {
  return ugType === 'fast-underground-belt' ? FAST_UNDERGROUND_MAX
    : ugType === 'express-underground-belt' ? EXPRESS_UNDERGROUND_MAX
    : ugType === 'turbo-underground-belt' ? TURBO_UNDERGROUND_MAX
    : UNDERGROUND_MAX;
}

// 障碍本身是同向传送带时，直接铺设普通传送带衔接（替换原传送带），无需地下带跨越。
// 返回 true 表示已成功铺设；否则返回 false 交由地下带逻辑处理。
function tryPlaceOntoSameDirBelt(type, tx, ty) {
  const t = entAt(tx, ty);
  // 必须是普通传送带（含快速/极速带，非分流器/地下带），且方向与当前铺设方向一致
  if (!(t instanceof Belt) || t instanceof Splitter || t instanceof Underground) return false;
  if (t.dir !== G.ghostDir) return false;
  const infinite = !!(G.dbg && G.dbg.infinite);
  if (!infinite && invCount(type) < 1) return false;
  // 同向传送带衔接：用当前传送带替换掉已有传送带，无需消耗地下带
  removeEnt(t);
  const e = new (ENT_CLASSES[type])(type, tx, ty);
  e.dir = G.ghostDir;
  e.applyDir();
  addEnt(e);
  if (!infinite) invTake(type, 1);
  refreshHotbar();
  return true;
}

// 拖动铺传送带遇障碍时自动搭一对地下传送带跨越：入口放在障碍前一格，
// 出口放在障碍之后第一个能放置的格子（不超过同档地下带的最大跨距）。
function tryAutoUnderground(type, tx, ty) {
  const ugType = BELT_TO_UG[type];
  if (!ugType) return false;              // 非传送带不触发
  if (entAt(tx, ty) instanceof Underground) return false; // 当前格已有地下带，不再生成
  const infinite = !!(G.dbg && G.dbg.infinite);
  const dir = G.ghostDir;
  const maxDist = ugMaxDist(ugType);

  // 入口位置：障碍前（沿铺设方向）一格
  const ex = tx - DX[dir], ey = ty - DY[dir];
  let replaced = null;
  let entOk = canPlaceAt(ugType, ex, ey, dir).ok;
  if (!entOk) {
    const t = entAt(ex, ey);
    if (t instanceof Belt && !(t instanceof Underground)) { replaced = t; entOk = true; }
    else return false;
  }
  if (!entOk) return false;

  // 出口位置：沿方向扫描障碍之后第一个可放置格
  let ox = null, oy = null;
  for (let k = 1; k <= maxDist; k++) {
    const px2 = tx + DX[dir] * k, py2 = ty + DY[dir] * k;
    if (canPlaceAt(ugType, px2, py2, dir).ok) { ox = px2; oy = py2; break; }
  }
  if (ox === null) return false;

  // 物资：优先扣地下带，不足则用普通传送带兜底（方便拖动时无缝跨越）
  if (!infinite) {
    if (invCount(ugType) >= 2) invTake(ugType, 2);
    else if (invCount(type) >= 2) invTake(type, 2);
    else return false;
    if (replaced) invAdd(type, 1);        // 归还被替换成入口的那条传送带
  }

  if (replaced) removeEnt(replaced);
  const ugIn = new (ENT_CLASSES[ugType])(ugType, ex, ey);
  ugIn.dir = dir; ugIn.applyDir(); addEnt(ugIn);
  const ugOut = new (ENT_CLASSES[ugType])(ugType, ox, oy);
  ugOut.dir = dir; ugOut.applyDir(); addEnt(ugOut);
  refreshHotbar();
  return true;
}

function deconstructAt(tx, ty) {
  const e = entAt(tx, ty);
  if (!e || !withinReach(tx, ty)) return;
  // 拆除的是正在驾驶的载具：先下车再拆除
  if (G.driving && G.driving.ent === e && typeof exitCar === 'function') exitCar();
  // 拆除时瞬间返还实体内容（含传送带上携带的物品），对齐红图批量删除行为：
  // 传送带是流动的，若逐件先取物品，移动中的传送带会不断补充导致无法清空，
  // 因此需一次性移除整条带上的所有物品并全部返还，再移除实体本身。
  for (const [id, n] of e.contents()) invAdd(id, n);
  removeEnt(e);
  if (G.panelEnt === e) closePanel();
  if (typeof playSfx === 'function') playSfx('demolish');
  uiDirty = true;
}

// ===== 右键取物（对齐《异星工厂》：右键点击传送带/地下带取最前物品、点击机械臂取爪上物品） =====
// 返回 true 表示已取到物品（此时不再执行拆除）。物品优先进背包，背包满则掉落到脚下地面。
// 注意：传送带与地下传送带是流动的，若右键优先取物会永远取不完、且拆除永不触发，
// 因此二者都不走“右键取物”，由调用方排除后直接整体拆除（见右键处理处）。
function rightClickPickupAt(tx, ty) {
  const e = entAt(tx, ty);
  if (!e || !withinReach(tx, ty)) return false;
  let id = null;
  if (e instanceof Belt && typeof e.takeItem === 'function') {
    id = e.takeItem();
  } else if (e.holding && e.holdingCount > 0) {
    // 机械臂爪上抓取的物品
    id = e.holding;
    e.holdingCount = (e.holdingCount || 1) - 1;
    if (e.holdingCount <= 0) e.holding = null;
  }
  if (!id) return false;
  if (!invAdd(id, 1)) {
    // 背包已满（或堆叠达到上限）：掉落到脚下地面
    if (typeof addGroundItem === 'function') {
      const fx = Math.floor(G.player.x / TILE), fy = Math.floor(G.player.y / TILE);
      addGroundItem(fx, fy, id, 1);
    }
  }
  if (typeof playSfx === 'function') playSfx('loot');
  uiDirty = true;
  return true;
}

// ===== 拆除模式 =====
// 通过“拆除模式”开关替代右键拆除：
// 开启后，左键点击建筑即可拆除单个建筑，长按可连续拆除。
function toggleDeconstructMode(on) {
  const next = (on === undefined) ? !G.deconstructMode : !!on;
  if (next === G.deconstructMode) return;
  G.deconstructMode = next;
  G.deconstructHeld = false;
  G.mouseDown = false;
  if (next) {
    // 进入拆除模式时退出蓝图/建造选择，避免左键行为冲突
    if (G.blueMode) cancelBlueprint();
    G.sel = -1;
    G.quickSel = null;
    refreshHotbar();
    toast('拆除模式：点触建筑即可拆除，再次点击按钮或按 Q/Esc 退出');
  }
  uiDirty = true;
}

