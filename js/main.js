'use strict';

// 共享空数组（避免战斗路径中每帧因 `G.enemies || []` 生成新字面量）
const EMPTY_ARR = [];

const G = {
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
  keys: {},
  showDetails: true,
  mouseDown: false,
  canvasActive: false,
  time: 0,
  dbg: { timeScale: 1, moveSpeed: 1, mineMult: 1, beltMult: 1, drillMult: 1, asmMult: 1, infinite: false, farReach: false, noclip: false },
  // 是否开启开发者调试（仅当 URL 参数含 debug=1 时为 true）
  debugEnabled: new URLSearchParams(window.location.search).get('debug') === '1',
  spawn: { x: 0, y: 0 },
  hbArm: null,
  invRecipeQ: '',
  buildDevQ: '',     // 背包「建造设备」列表的搜索关键字
  invTab: 'materials', // 背包两个 tab：'materials' 材料（默认）/ 'craft' 合成
  clipboard: null,
  blueprint: null,        // 蓝图数据：{ minX, minY, w, h, ents: [序列化实体...] }
  blueBook: [],           // 蓝图库：保存的多个蓝图 { name, minX, minY, ents }（对齐《异星工厂》蓝图库）
  blueMode: null,         // 'blue' | 'red' | 'paste'（框选/删除/粘贴蓝图）
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
  joystick: { active: false, id: null, baseX: 0, baseY: 0, dx: 0, dy: 0 },
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
  axeDura: 0,         // 当前手持开采工具（铁斧/钢斧）剩余耐久（用尽后消失，对齐《异星工厂》Axe）
  victoryT: 0,
  inMenu: true,       // 开始菜单显示中：游戏世界尚未初始化，loop 暂停渲染与更新
  paused: false,      // 游戏暂停：由顶部“暂停/继续”按钮控制，暂停时世界/设备/玩家停摆
  deconstructMode: false,  // 触屏拆除模式：开启后点触建筑即可拆除（PC 右键拆除不受影响）
  deconstructHeld: false,  // 拆除模式：左键/触屏是否处于按住连续拆除状态
  craftQueue: [],     // 手搓合成队列：见 player.js 的 queueCraft / updateCraftQueue
};

let lastPlaceKey = '';
let lastPanelCheck = 0;
let fpsSmooth = 60;

// 存档由 js/saves.js 的多存档系统管理（自动存档 + 用户存档），不再使用单一键。
// 保留旧键常量供首次升级时迁移（见 migrateLegacySave）。

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(G.settings)); } catch (e) {}
}

function loadSettings() {
  try {
    const s = localStorage.getItem(SETTINGS_KEY);
    if (s) {
      // 已有保存的设置：以设置为准
      Object.assign(G.settings, JSON.parse(s));
    } else {
      // 首次打开：自动检测是否为触屏设备，触屏则自动开启虚拟摇杆
      const touchCapable = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
      if (touchCapable) G.settings.virtualJoystick = true;
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
  G.blueBook = [];      // 新游戏清空蓝图库
  G.mapTags = [];       // 新游戏清空地图标记
  if (typeof achInitStats === 'function') achInitStats();   // 新游戏清空成就状态
  G.railTiles = new Set();
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
  invAdd('burner-drill', 1);   // 热能采矿机
  invAdd('stone-furnace', 1);  // 石炉
  invAdd('transport-belt', 32); // 传送带
  invAdd('inserter', 4);        // 机械臂
  invAdd('coal', 8);
  invAdd('iron-axe', 1);       // 铁斧（对齐《异星工厂》开局默认手持铁斧，砍树/手挖更快）
  // 测试用创造/虚空设备（创造箱/虚空箱/创造管道/虚空管道）不再默认发放：
  // 仅当在 Debug 模式中开启"无限资源"后才通过建造列表出现，正常游玩不可见。
}

function serializeAll() {
  return {
    v: 1,
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
    player: { x: G.player.x, y: G.player.y, hp: G.playerHP, weapon: G.weapon, armor: G.armor },
    evolution: G.evolution || 0,
    pollution: (typeof pollutionSerialize === 'function') ? pollutionSerialize() : null,
    craftQueue: (G.craftQueue || []).map(q => ({
      rid: q.rid, time: q.time, total: q.total, done: q.done, outId: q.outId
    })),
    gameWon: G.gameWon,
    repairPackUses: G.repairPackUses || 0,
    axeDura: G.axeDura || 0,
    techDone: G.techDone,
    techProg: G.techProg,
    activeTech: G.activeTech,
    techQueue: G.techQueue || [],
    hotbar: HOTBAR.slice(),
    settings: Object.assign({}, G.settings),
    dbg: Object.assign({}, G.dbg),
    // 游戏累计时间（秒）：用于历史统计分桶的时间锚点，读档后延续
    time: G.time,
    // 历史统计：聚合为小时粒度写入（体积极小，最多 24 小时/物品）
    hist: (typeof histSerialize === 'function') ? histSerialize() : null,
    constr: (typeof constrSerialize === 'function') ? constrSerialize() : null,
    equipment: (typeof equipmentSerialize === 'function') ? equipmentSerialize() : null,
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
    if (res) toast('已覆盖存档：' + (res.name || '存档'));
    else toast('保存失败');
  } else {
    // 新建用户存档：最多只能有 MAX_USER_SAVES 个，超出则提示
    if (!id && await countUserSaves() >= MAX_USER_SAVES) {
      toast('已达用户存档上限（' + MAX_USER_SAVES + ' 个），请先删除或覆盖旧存档');
      return null;
    }
    res = await writeSave(data, 'user', id || null, name || '');
    if (res) toast('已保存');
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

function applySave(d) {
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
  for (const s of d.ents) {
    const cls = ENT_CLASSES[s.type];
    if (!cls) continue;
    addEnt(cls.restore(s));
  }
  G.inv = new Map(d.inv);
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
  G.axeDura = (typeof d.axeDura === 'number') ? d.axeDura : 0;
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
  // 读档后按设置刷新虚拟摇杆显示状态
  if (typeof updateJoystickVisibility === 'function') updateJoystickVisibility();
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

// 地面铺设：混凝土/石砖路铺在草地上，填海把水面填成草地
const PAVE_TILE = { 'concrete': T_CONCRETE, 'refined-concrete': T_REF_CONCRETE, 'hazard-concrete': T_HAZARD, 'stone-path': T_PATH };
function placeGround(type, tx, ty, infinite) {
  const t = getTerrain(tx, ty);
  if (type === 'landfill') {
    if (t !== T_WATER) { toast('填海料只能铺在水面上'); return; }
    if (entAt(tx, ty)) { toast('水面有建筑，无法填海'); return; }
    setTerrain(tx, ty, T_GRASS);
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

function tryPlaceAt(tx, ty) {
  const type = selItem();
  if (!type) return;
  const infinite = !!(G.dbg && G.dbg.infinite);
  // 地面铺设（混凝土/石砖路/填海等）：不创建实体，直接修改地形（需优先于 BUILD_DEFS 守卫判定）
  if (type === 'concrete' || type === 'refined-concrete' || type === 'hazard-concrete' || type === 'stone-path' || type === 'landfill') {
    placeGround(type, tx, ty, infinite);
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
  if (!infinite && invCount(type) < 1) {
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
  const cls = ENT_CLASSES[type];
  const e = new cls(type, tx, ty);
  e.dir = G.ghostDir;
  e.applyDir();
  addEnt(e);
  if (!infinite) invTake(type, 1);
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
  const ne = new cls(type, tx, ty);
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
  'transport-belt': 'underground',
  'fast-transport-belt': 'fast-underground-belt',
  'express-transport-belt': 'express-underground-belt'
};

function ugMaxDist(ugType) {
  return ugType === 'fast-underground-belt' ? FAST_UNDERGROUND_MAX
    : ugType === 'express-underground-belt' ? EXPRESS_UNDERGROUND_MAX
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
  // 传送带/分流器（含快速/高速带）：拆除时连同带上物品一并移除，不再先返还带上物品（对齐《异星工厂》）
  if (!(e instanceof Belt)) {
    for (const [id, n] of e.contents()) invAdd(id, n);
  }
  removeEnt(e);
  if (G.panelEnt === e) closePanel();
  if (typeof playSfx === 'function') playSfx('demolish');
  uiDirty = true;
}

// ===== 右键取物（对齐《异星工厂》：右键点击传送带/地下带取最前物品、点击机械臂取爪上物品） =====
// 返回 true 表示已取到物品（此时不再执行拆除）。物品优先进背包，背包满则掉落到脚下地面。
function rightClickPickupAt(tx, ty) {
  const e = entAt(tx, ty);
  if (!e || !withinReach(tx, ty)) return false;
  let id = null;
  if (e instanceof Belt && typeof e.takeItem === 'function') {
    id = e.takeItem();
  } else if (typeof e.takeItem === 'function' && (e.type === 'underground' || e.type === 'fast-underground-belt' || e.type === 'express-underground-belt')) {
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

// ===== 拆除模式（触屏专用，PC 右键拆除不受影响） =====
// 手机端无法使用鼠标右键，通过“拆除模式”开关替代：
// 开启后，点触/左键点击建筑即可拆除单个建筑，长按可连续拆除。
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
    updateDeconstructBtn();
    toast('拆除模式：点触建筑即可拆除，再次点击按钮或按 Q/Esc 退出');
  } else {
    updateDeconstructBtn();
  }
  uiDirty = true;
}

// ===== 蓝图 / 红图：框选一整块进行复制粘贴或删除 =====
function toggleBlueprint(mode) {
  // 进入蓝图/红图/绿图模式时退出触屏拆除模式，避免左键行为冲突
  if (!G.blueMode && G.deconstructMode) toggleDeconstructMode(false);
  // 再次点击同按钮取消框选
  if (G.blueMode === mode) { cancelBlueprint(); return; }
  if (G.blueMode === 'paste' && mode === 'blue') {
    // 蓝图粘贴中再点蓝图：退出蓝图模式（保留已复制的蓝图数据可再次粘贴）
    cancelBlueprint();
    return;
  }
  G.blueMode = mode;
  G.blueStart = null; G.blueEnd = null;
  G.greenAction = null;
  G.sel = -1; G.quickSel = null; refreshHotbar();
  toast(mode === 'blue'
    ? '蓝图模式：拖拽框选要复制的区域，松开后点击空白处粘贴'
    : mode === 'red'
      ? '红图模式：拖拽框选要删除的区域，松开即删除整块'
      : '绿图模式：拖拽框选要升级/降级的区域，松开后选择升级或降级');
}

function cancelBlueprint() {
  G.blueMode = null;
  G.blueStart = null; G.blueEnd = null;
  G.blueRot = 0; G.blueFlipH = false; G.blueFlipV = false;
  G.greenRect = null; G.greenAction = null;
  hideGreenBar();
  refreshHotbar();
}

// 框选矩形（瓦片坐标，规范化左上/右下）
function blueRect() {
  if (!G.blueStart || !G.blueEnd) return null;
  return {
    x0: Math.min(G.blueStart.tx, G.blueEnd.tx),
    y0: Math.min(G.blueStart.ty, G.blueEnd.ty),
    x1: Math.max(G.blueStart.tx, G.blueEnd.tx),
    y1: Math.max(G.blueStart.ty, G.blueEnd.ty)
  };
}

// 红图：删除矩形区域内所有实体（含内部物资返还，跨区域不重复）
function applyRedBlueprint() {
  const r = blueRect();
  if (!r) return;
  // 装备个人机器人港且有施工机器人：生成拆除标记，由施工机器人拆除
  if (typeof canUseConstruction === 'function' && canUseConstruction() && typeof markAreaForDecon === 'function') {
    const n = markAreaForDecon(r);
    G.blueStart = null; G.blueEnd = null;
    toast(n > 0 ? ('已标记 ' + n + ' 个建筑待拆除，施工机器人正在拆除' + (constrPending().decon > 0 ? '（剩 ' + constrPending().decon + ' 个待拆）' : ''))
      : '区域内没有可拆除的建筑');
    uiDirty = true;
    return;
  }
  const seen = new Set();
  let count = 0;
  for (let ty = r.y0; ty <= r.y1; ty++) {
    for (let tx = r.x0; tx <= r.x1; tx++) {
      const e = entAt(tx, ty);
      if (!e || seen.has(e)) continue;
      seen.add(e);
      // 若实体中心在区域内才整体删除（避免误删部分在框内的巨型设备）
      const cx = e.x + Math.floor(e.w / 2), cy = e.y + Math.floor(e.h / 2);
      if (cx >= r.x0 && cx <= r.x1 && cy >= r.y0 && cy <= r.y1) {
        for (const [id, n] of e.contents()) invAdd(id, n);
        removeEnt(e);
        if (G.panelEnt === e) closePanel();
        count++;
      }
    }
  }
  // 保持红图模式，仅重置框选范围，便于继续框选删除
  G.blueStart = null; G.blueEnd = null;
  toast('红图：已删除 ' + count + ' 个建筑（物资已返还背包），可继续框选');
  uiDirty = true;
}

// 绿图：框选完成后，记录区域并弹出升级/降级操作栏，由用户选择后批量升级/降级
function applyGreenBlueprint() {
  const r = blueRect();
  if (!r) return;
  // 统计区域内可升级/降级的同族物流数量，供操作栏显示
  const stats = greenAreaStats(r);
  if (!stats.total) {
    G.blueStart = null; G.blueEnd = null;
    toast('框选区域内没有可升级/降级的传送带或组装机');
    return;
  }
  G.greenRect = r;
  G.greenAction = null;
  // 保持绿图模式，展示操作栏，便于继续框选
  showGreenBar(r, stats);
}

// 统计矩形区域内可升级（有更高阶）/可降级（有更低阶）的传送带与组装机数量
function greenAreaStats(r) {
  const seen = new Set();
  let up = 0, down = 0, total = 0;
  for (let ty = r.y0; ty <= r.y1; ty++) {
    for (let tx = r.x0; tx <= r.x1; tx++) {
      const e = entAt(tx, ty);
      if (!e || seen.has(e)) continue;
      seen.add(e);
      const cx = e.x + Math.floor(e.w / 2), cy = e.y + Math.floor(e.h / 2);
      if (cx < r.x0 || cx > r.x1 || cy < r.y0 || cy > r.y1) continue;
      if (!tierFamily(e.type)) continue;
      total++;
      if (tierNext(e.type)) up++;
      if (tierPrev(e.type)) down++;
    }
  }
  return { up, down, total };
}

// 显示绿图操作栏（升级/降级/取消）
function showGreenBar(r, stats) {
  const bar = document.getElementById('greenbar');
  if (!bar) return;
  const w = (r.x1 - r.x0 + 1), h = (r.y1 - r.y0 + 1);
  bar.innerHTML =
    '<span class="gb-t">绿图 ' + w + '×' + h + '：可升级 ' + stats.up + ' · 可降级 ' + stats.down + '</span>' +
    '<button data-gact="upgrade">⬆ 一键升级</button>' +
    '<button data-gact="downgrade">⬇ 一键降级</button>' +
    '<button data-gact="cancel">取消</button>';
  bar.style.display = 'flex';
}

function hideGreenBar() {
  const bar = document.getElementById('greenbar');
  if (bar) bar.style.display = 'none';
}

// 执行绿图升级/降级：作用于上次框选的 greenRect 内所有同族带子
function greenAreaAction(action) {
  const r = G.greenRect;
  if (!r) return;
  const infinite = !!(G.dbg && G.dbg.infinite);
  let changed = 0;
  const seen = new Set();
  for (let ty = r.y0; ty <= r.y1; ty++) {
    for (let tx = r.x0; tx <= r.x1; tx++) {
      const e = entAt(tx, ty);
      if (!e || seen.has(e)) continue;
      seen.add(e);
      const cx = e.x + Math.floor(e.w / 2), cy = e.y + Math.floor(e.h / 2);
      if (cx < r.x0 || cx > r.x1 || cy < r.y0 || cy > r.y1) continue;
      if (!tierFamily(e.type)) continue;
      const target = action === 'upgrade' ? tierNext(e.type) : tierPrev(e.type);
      if (!target) continue;
      if (!infinite && action === 'upgrade' && invCount(target) < 1) continue;   // 升级需有对应新带
      const dir = e.dir;
      const items = e.items ? e.items.map(o => ({ item: o.item, pos: o.pos })) : [];
      // 带内部状态（如组装机的配方/输入输出/进度）的实体：序列化后改 type 再还原，保留全部状态
      const st = e.serialize ? e.serialize() : null;
      removeEnt(e);
      const cls = ENT_CLASSES[target];
      let ne;
      if (st && st.recipe !== undefined && typeof cls.restore === 'function') {
        st.type = target;
        ne = cls.restore(st);
      } else {
        ne = new cls(target, e.x, e.y);
        ne.dir = dir;
        ne.applyDir();
        if (ne.items) ne.items = items;
        // 分流器升级/降级时保留可编程分离器的过滤配置（对齐《异星工厂》Programmable splitter）
        if (st && st.filter && typeof Splitter !== 'undefined' && ne instanceof Splitter) {
          ne.filter = st.filter;
        }
      }
      addEnt(ne);
      if (!infinite) {
        if (action === 'upgrade') invTake(target, 1);
        else invAdd(e.type, 1);
      }
      changed++;
    }
  }
  if (G.panelEnt && !G.ents.includes(G.panelEnt)) closePanel();
  toast('绿图已' + (action === 'upgrade' ? '升级' : '降级') + ' ' + changed + ' 个传送带/组装机');
  uiDirty = true;
}

// 蓝图：复制矩形区域内实体（相对坐标 + 完整配置）
function captureBlueprint() {
  const r = blueRect();
  if (!r) return;
  const ents = [];
  const seen = new Set();
  for (let ty = r.y0; ty <= r.y1; ty++) {
    for (let tx = r.x0; tx <= r.x1; tx++) {
      const e = entAt(tx, ty);
      if (!e || seen.has(e)) continue;
      seen.add(e);
      const cx = e.x + Math.floor(e.w / 2), cy = e.y + Math.floor(e.h / 2);
      if (cx < r.x0 || cx > r.x1 || cy < r.y0 || cy > r.y1) continue;
      // 仅复制建筑本身，不含内部原料/输出/燃料/流体及传送带物品
      ents.push(e.blueprint());
    }
  }
  if (!ents.length) { toast('框选区域没有可复制的建筑'); return; }
  // 蓝图含地面铺装（混凝土/石砖路/填海料等，对齐《异星工厂》：蓝图会记录地砖）
  const TILE_IDS = { '2': 'concrete', '3': 'stone-path', '5': 'refined-concrete', '6': 'hazard-concrete' };
  const tiles = [];
  for (let ty = r.y0; ty <= r.y1; ty++) {
    for (let tx = r.x0; tx <= r.x1; tx++) {
      const t = getTerrain(tx, ty);
      const tid = TILE_IDS[t];
      if (!tid) continue;
      tiles.push({ type: tid, x: tx, y: ty });
    }
  }
  G.blueprint = { minX: r.x0, minY: r.y0, ents, tiles: tiles.length ? tiles : [] };
  // 自动存入蓝图库（去重：与已有蓝图内容相同则不重复添加）
  if (typeof blueBookAdd === 'function') blueBookAdd(G.blueprint);
  if (typeof playSfx === 'function') playSfx('blueprint');
  G.blueMode = 'paste';
  G.blueStart = null; G.blueEnd = null;
  G.blueRot = 0; G.blueFlipH = false; G.blueFlipV = false;
  toast('蓝图已复制 ' + ents.length + ' 个建筑，点击空白处粘贴（R旋转，V/H翻转，右键取消）');
}

// ===== 蓝图变换（粘贴时 R 旋转 / V、H 翻转，对齐《异星工厂》）=====
// 计算实体在蓝图中占用的宽高（rotSwap 设备随朝向交换宽高）
function blueprintFootprint(s) {
  const def = BUILD_DEFS[s.type];
  if (!def) return { w: 1, h: 1 };
  if (def.rotSwap && (s.dir & 1)) return { w: def.h, h: def.w };
  return { w: def.w, h: def.h };
}

// 蓝图包围盒（含各实体占用范围）
function blueprintBounds(ents) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of ents) {
    const fp = blueprintFootprint(s);
    minX = Math.min(minX, s.x);
    minY = Math.min(minY, s.y);
    maxX = Math.max(maxX, s.x + fp.w - 1);
    maxY = Math.max(maxY, s.y + fp.h - 1);
  }
  return { minX, minY, maxX, maxY, W: maxX - minX + 1, H: maxY - minY + 1 };
}

// 顺时针旋转蓝图 90°：以包围盒几何中心为轴，左上角锚点旋转，实体朝向 +1
function rotateEnts90(ents) {
  const bb = blueprintBounds(ents);
  const cx = bb.minX + bb.W / 2, cy = bb.minY + bb.H / 2;
  const k1 = cx - cy, k2 = cx + cy;
  const newEnts = ents.map(s => {
    // 绕中心顺时针旋转 90°：x'=k1+y, y'=k2-x，四舍五入对齐网格
    const nx = Math.round(k1 + s.y);
    const ny = Math.round(k2 - s.x);
    return { ...s, x: nx, y: ny, dir: (s.dir + 1) % 4 };
  });
  const nb = blueprintBounds(newEnts);
  return { ents: newEnts, minX: nb.minX, minY: nb.minY };
}

// 旋转地砖数组（90°顺时针）：以包围盒几何中心为轴，与实体旋转同坐标系
function rotateTiles90(tiles, bb) {
  const cx = bb.minX + bb.W / 2, cy = bb.minY + bb.H / 2;
  const k1 = cx - cy, k2 = cx + cy;
  return tiles.map(t => ({ type: t.type, x: Math.round(k1 + t.y), y: Math.round(k2 - t.x) }));
}
// 翻转地砖数组：axis='h' 水平镜像 / 'v' 垂直镜像（与实体翻转同坐标系）
function flipTiles(tiles, axis, bb) {
  return tiles.map(t => axis === 'h'
    ? { type: t.type, x: bb.minX + bb.maxX - t.x, y: t.y }
    : { type: t.type, x: t.x, y: bb.minY + bb.maxY - t.y });
}

// 翻转蓝图：axis='h' 水平镜像（东西互兑），axis='v' 垂直镜像（南北互兑）
function flipEnts(ents, axis) {
  const bb = blueprintBounds(ents);
  const newEnts = ents.map(s => {
    const fp = blueprintFootprint(s);
    let nx = s.x, ny = s.y, ndir = s.dir;
    if (axis === 'h') {
      nx = bb.minX + bb.maxX - (s.x + fp.w - 1);
      ndir = flipDir(s.dir, 'h');
    } else {
      ny = bb.minY + bb.maxY - (s.y + fp.h - 1);
      ndir = flipDir(s.dir, 'v');
    }
    return { ...s, x: nx, y: ny, dir: ndir };
  });
  const nb = blueprintBounds(newEnts);
  return { ents: newEnts, minX: nb.minX, minY: nb.minY };
}

// 应用当前旋转/翻转状态，返回变换后的蓝图实体与新的左上角基准
function applyBlueprintTransform() {
  let ents = G.blueprint.ents.map(s => ({ ...s }));
  let tiles = Array.isArray(G.blueprint.tiles) ? G.blueprint.tiles.map(t => ({ ...t })) : [];
  if (G.blueFlipH) {
    const bb = blueprintBounds(ents); if (tiles.length) tiles = flipTiles(tiles, 'h', bb);
    const r = flipEnts(ents, 'h'); ents = r.ents;
  }
  if (G.blueFlipV) {
    const bb = blueprintBounds(ents); if (tiles.length) tiles = flipTiles(tiles, 'v', bb);
    const r = flipEnts(ents, 'v'); ents = r.ents;
  }
  const rot = ((G.blueRot % 4) + 4) % 4;
  for (let i = 0; i < rot; i++) {
    const bb = blueprintBounds(ents); if (tiles.length) tiles = rotateTiles90(tiles, bb);
    const r = rotateEnts90(ents); ents = r.ents;
  }
  const bb = blueprintBounds(ents);
  return { ents, tiles, minX: bb.minX, minY: bb.minY };
}

// 粘贴蓝图到鼠标所指位置
function pasteBlueprint() {
  if (!G.blueprint || !G.cursorTile) return;
  const bp = applyBlueprintTransform();
  // 装备个人机器人港且有施工机器人：生成建造幽灵，由施工机器人自动施工
  if (typeof canUseConstruction === 'function' && canUseConstruction()) {
    const n = pasteBlueprintAsGhosts(bp);
    toast(n > 0 ? ('已排布 ' + n + ' 个建造幽灵，施工机器人正在建造' + (constrPending().build > 0 ? '（剩 ' + constrPending().build + ' 个待建）' : ''))
      : '无可建造的位置（区域内已有建筑或超出机器人范围）');
    if (typeof playSfx === 'function') playSfx('blueprint');
    uiDirty = true;
    return;
  }
  const ox = G.cursorTile.tx - bp.minX;
  const oy = G.cursorTile.ty - bp.minY;
  // 先校验所有目标位置是否可放置，再一次性放置
  const placements = [];
  for (const s of bp.ents) {
    const cls = ENT_CLASSES[s.type];
    if (!cls) continue;
    const nx = s.x + ox, ny = s.y + oy;
    const tmp = cls.restore(Object.assign({}, s, { x: nx, y: ny }));
    tmp.dir = s.dir | 0; tmp.applyDir();
    if (!canPlaceAt(s.type, nx, ny, tmp.dir).ok) {
      toast('粘贴失败：区域被占用或不可放置');
      return;
    }
    placements.push({ cls, s, nx, ny });
  }
  for (const p of placements) {
    const e = p.cls.restore(Object.assign({}, p.s, { x: p.nx, y: p.ny }));
    e.dir = p.s.dir | 0; e.applyDir();
    addEnt(e);
  }
  // 恢复蓝图地砖（混凝土/石砖路/填海料等，对齐《异星工厂》：蓝图粘贴含地砖）
  let tileCount = 0;
  if (Array.isArray(bp.tiles) && bp.tiles.length) {
    for (const t of bp.tiles) {
      const nx = t.x + ox, ny = t.y + oy;
      const to = PAVE_TILE[t.type];
      if (to === undefined) continue;
      // 仅在目标格为草地/同种可覆盖且无建筑时才铺设，避免覆盖已有地砖或建筑
      const cur = getTerrain(nx, ny);
      if (cur !== T_GRASS && cur !== to) continue;
      if (entAt(nx, ny)) continue;
      setTerrain(nx, ny, to);
      if (typeof invalidateTerrainChunk === 'function') invalidateTerrainChunk(nx, ny);
      tileCount++;
    }
  }
  if (typeof playSfx === 'function') playSfx('blueprint');
  toast('蓝图已粘贴 ' + placements.length + ' 个建筑' + (tileCount ? '（含 ' + tileCount + ' 格地砖）' : '') + '（可继续点击空白处粘贴，R旋转/V翻转，右键取消）');
  uiDirty = true;
}

// ===== 蓝图库（对齐《异星工厂》Blueprint book）：保存多个蓝图供随时调用 =====
// 复制蓝图时自动加入蓝图库；也可在蓝图库面板中加载任一蓝图进行粘贴。
function blueBookAdd(bp) {
  if (!bp || !bp.ents || !bp.ents.length) return;
  if (!Array.isArray(G.blueBook)) G.blueBook = [];
  // 去重：内容（类型+相对位置）与已有蓝图相同则不重复添加
  const key = bp.ents.map(e => e.type + '@' + (e.x - bp.minX) + ',' + (e.y - bp.minY)).join('|');
  for (const b of G.blueBook) {
    const bk = b.ents.map(e => e.type + '@' + (e.x - b.minX) + ',' + (e.y - b.minY)).join('|');
    if (bk === key) return;   // 已存在相同蓝图
  }
  G.blueBook.push({ name: '蓝图 ' + (G.blueBook.length + 1), minX: bp.minX, minY: bp.minY, ents: bp.ents.slice(), tiles: Array.isArray(bp.tiles) ? bp.tiles.slice() : [] });
  uiDirty = true;
}

// 从蓝图库加载指定蓝图，进入粘贴模式
function blueBookLoad(i) {
  const b = G.blueBook[i];
  if (!b) { toast('蓝图库中没有该项'); return; }
  G.blueprint = { minX: b.minX, minY: b.minY, ents: b.ents.slice(), tiles: Array.isArray(b.tiles) ? b.tiles.slice() : [] };
  G.blueMode = 'paste';
  G.blueStart = null; G.blueEnd = null;
  G.blueRot = 0; G.blueFlipH = false; G.blueFlipV = false;
  closePanel();
  toast('已加载蓝图「' + b.name + '」，点击空白处粘贴（R旋转，右键取消）');
}

// 删除蓝图库中指定项
function blueBookRemove(i) {
  if (!Array.isArray(G.blueBook) || i < 0 || i >= G.blueBook.length) return;
  const name = G.blueBook[i].name;
  G.blueBook.splice(i, 1);
  toast('已从蓝图库删除「' + name + '」');
  uiDirty = true;
}

// 重命名蓝图库中指定项（对齐《异星工厂》：蓝图库中可自由为蓝图命名）
function blueBookRename(i, newName) {
  if (!Array.isArray(G.blueBook) || i < 0 || i >= G.blueBook.length) return;
  const old = G.blueBook[i].name;
  const name = String(newName || '').trim();
  if (!name) { toast('蓝图名称不能为空'); return; }
  G.blueBook[i].name = name;
  toast('已重命名蓝图：' + old + ' → ' + name);
  uiDirty = true;
}

// ===== 蓝图字符串导出/导入（对齐《异星工厂》Blueprint string）=====
// Factorio 允许把蓝图导出为编码字符串（Blueprint string）供复制分享、或粘贴导入复用。
// 这里把蓝图序列化为紧凑 JSON 再用 UTF-8 安全 Base64 编码（兼容任意物品/名称字符）。
function utf8ToB64(s) {
  // 用 TextEncoder 生成 UTF-8 字节序列后逐字节 Base64 编码，避免 btoa 对中文抛错
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(bin);
}
function b64ToUtf8(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// 把蓝图库中的一项编码为可分享的字符串。返回 null 表示空蓝图。
function blueprintEncode(b) {
  if (!b || !Array.isArray(b.ents) || !b.ents.length) return null;
  const ents = b.ents.map(e => {
    const arr = [e.type, e.x - b.minX, e.y - b.minY, e.dir | 0];
    return arr;
  });
  const obj = { n: String(b.name || '蓝图'), w: 1, h: 1, e: ents };
  const fp = blueprintBounds(b.ents);
  obj.w = fp.W; obj.h = fp.H;
  // 蓝图字符串携带地砖（对齐《异星工厂》：蓝图含地面铺装）
  if (Array.isArray(b.tiles) && b.tiles.length) {
    obj.t = b.tiles.map(t => [t.type, t.x - b.minX, t.y - b.minY]);
  }
  return utf8ToB64(JSON.stringify(obj));
}

// 从字符串解码蓝图对象。成功返回 { name, minX, minY, ents }；失败返回 null。
function blueprintDecode(str) {
  try {
    const json = b64ToUtf8(String(str || '').trim());
    const obj = JSON.parse(json);
    if (!obj || !Array.isArray(obj.e)) return null;
    const ents = obj.e.map(arr => {
      if (!Array.isArray(arr) || arr.length < 3) return null;
      const e = { type: String(arr[0]), x: arr[1], y: arr[2], dir: (arr[3] || 0) | 0 };
      // 仅接受已知设备类型，避免导入未知类型导致异常
      if (!BUILD_DEFS[e.type] && !ENT_CLASSES[e.type]) return null;
      return e;
    }).filter(Boolean);
    if (!ents.length) return null;
    const bb = blueprintBounds(ents);
    // 解析地砖（相对坐标 → 绝对坐标，对齐《异星工厂》：蓝图含地面铺装）
    let tiles = [];
    if (Array.isArray(obj.t)) {
      for (const arr of obj.t) {
        if (!Array.isArray(arr) || arr.length < 3) continue;
        const type = String(arr[0]);
        if (PAVE_TILE[type] === undefined) continue;
        tiles.push({ type, x: arr[1] + bb.minX, y: arr[2] + bb.minY });
      }
    }
    return { name: String(obj.n || '导入蓝图'), minX: bb.minX, minY: bb.minY, ents, tiles };
  } catch (e) {
    return null;
  }
}

// 导出指定蓝图库项到剪贴板（显示字符串供复制分享）。
function blueBookExport(i) {
  const b = Array.isArray(G.blueBook) ? G.blueBook[i] : null;
  if (!b) { toast('蓝图库中没有该项'); return; }
  const s = blueprintEncode(b);
  if (!s) { toast('蓝图为空，无法导出'); return; }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(s).then(() => toast('蓝图「' + b.name + '」已复制到剪贴板')).catch(() => toast('蓝图字符串：' + s));
  } else {
    prompt('蓝图字符串（复制保存以便分享/导入）', s);
  }
}

// 尝试进入面前的装甲车（F 键 / 交互）。成功返回 true。
function tryEnterNearbyCar() {
  if (G.driving) return false;
  if (typeof enterCar !== 'function') return false;
  const px = Math.floor(G.player.x / TILE), py = Math.floor(G.player.y / TILE);
  const checks = [[px, py], [px + DX[G.player.dir], py + DY[G.player.dir]]];
  for (const [tx, ty] of checks) {
    const e = entAt(tx, ty);
    if (e && (e.type === 'car' || e.type === 'tank' || e.type === 'locomotive' || e.type === 'diesel-locomotive' || e.type === 'cargo-wagon' || e.type === 'fluid-wagon' || e.type === 'artillery-wagon') && typeof enterCar === 'function') { enterCar(e); return true; }
  }
  return false;
}

function pickupAction() {
  let t = null;
  if (G.cursorTile && withinReach(G.cursorTile.tx, G.cursorTile.ty)) t = G.cursorTile;
  else {
    const tx = Math.floor(G.player.x / TILE) + DX[G.player.dir];
    const ty = Math.floor(G.player.y / TILE) + DY[G.player.dir];
    t = { tx, ty };
  }
  if (!t) return;
  const e = entAt(t.tx, t.ty);
  if (!e) return;
  const got = e.takeItem();
  if (!got) {
    if (e instanceof Belt) toast('这条传送带上没有物品');
    return;
  }
  invAdd(got);
  if (typeof playSfx === 'function') playSfx('pickup');
  uiDirty = true;
}

// ===== 全部拾取（对齐《异星工厂》：按住 Z 拾取范围内所有地面物品）=====
// 官方 Factorio 默认快捷键 Z = Pick up items，一键收集玩家周围可触及范围内的全部散落物品
// （地面掉落物）。拾取受背包堆叠上限约束，放不下的物品保留在原地，返回实际拾取总数。
function pickupAllAction() {
  if (!G.groundItems || G.groundItems.length === 0) return 0;
  const p = G.player;
  const pickR = REACH_PX;
  const pickR2 = pickR * pickR;   // 用平方距离避免逐格开平方（与 updateGroundItems 语义一致）
  let total = 0;
  let anyPicked = false;
  for (const g of G.groundItems) {
    if (g.taken) continue;
    const dx = g.tx * TILE + TILE / 2 - p.x, dy = g.ty * TILE + TILE / 2 - p.y;
    if (dx * dx + dy * dy <= pickR2) {
      const got = invAdd(g.item, g.n);
      if (got > 0) {
        g.n -= got;
        total += got;
        anyPicked = true;
        if (g.n <= 0) g.taken = true;
      }
    }
  }
  if (anyPicked) {
    if (typeof playSfx === 'function') playSfx('pickup');
    G.groundItems = compactFilter(G.groundItems, g => !g.taken);
    if (G.groundItems.length === 0) G.groundItems = undefined;
    uiDirty = true;
    if (typeof toast === 'function') toast('拾取 ' + total + ' 个物品' + (total === 0 ? '（背包已满）' : ''));
  }
  return total;
}

// 手持修理包点击受损建筑：消耗修理包使用次数修复建筑 HP（对齐《异星工厂》Repair pack）
// 每个修理包最多修复 REPAIR_PACK_USES 次，用完后消耗该物品。
const REPAIR_PACK_USES = 5;
function repairActionAt(tx, ty) {
  if (!withinReach(tx, ty)) { toast('距离太远'); return false; }
  const e = entAt(tx, ty);
  if (!e || !isDamaged(e)) { toast('该建筑无需修复'); return false; }
  // 消耗修理包
  let uses = G.repairPackUses || 0;
  if (uses <= 0) {
    if (!invCount('repair-pack')) { toast('需要修理包'); return false; }
    uses = REPAIR_PACK_USES;
    invTake('repair-pack', 1);
  }
  const fixed = repairBuilding(e, 100);
  uses -= 1;
  if (uses <= 0) { uses = 0; toast('修理包已用尽'); }
  G.repairPackUses = uses;
  if (fixed > 0) {
    if (typeof makeSparkFx === 'function') makeSparkFx(e.x + e.w / 2, e.y + e.h / 2, e.w);
    if (typeof playSfx === 'function') playSfx('repair');
  }
  uiDirty = true;
  return true;
}
// 当前选中修理包（用于建造/点击优先触发修复）
function hasRepairPackSelected() { return selItem() === 'repair-pack'; }

// 使用峭壁炸药：选中峭壁炸药并点击峭壁格，炸毁该格峭壁（对齐《异星工厂》Cliff explosives）
function hasCliffBlastSelected() { return selItem() === 'cliff-explosives'; }
function cliffBlastAt(tx, ty) {
  if (!withinReach(tx, ty)) { toast('距离太远'); return false; }
  if (!isCliff(tx, ty)) { toast('这里没有峭壁'); return false; }
  if (!invCount('cliff-explosives')) { toast('需要峭壁炸药'); return false; }
  invTake('cliff-explosives', 1);
  setTerrain(tx, ty, T_GRASS);
  // 爆炸视觉 + 音效
  if (typeof spawnSmoke === 'function') {
    for (let i = 0; i < 6; i++) spawnSmoke(tx * TILE + TILE / 2 + (Math.random() - 0.5) * 22, ty * TILE + TILE / 2 + (Math.random() - 0.5) * 22, { life: 1.2, size: 8, color: '#b0a898' });
  }
  if (typeof playSfx === 'function') playSfx('explosion');
  uiDirty = true;
  return true;
}

function copySettings(e) {
  if (!e) return;
  const s = { type: e.type, dir: e.dir };
  if (typeof e.setRecipe === 'function') s.recipe = e.recipe;
  G.clipboard = s;
  toast('已复制 ' + ITEMS[e.type].name + ' 配置（Shift+左键粘贴到同类）');
}

function pasteSettings(e) {
  if (!e || !G.clipboard) return;
  const c = G.clipboard;
  if (e.type !== c.type) { toast('类型不匹配：剪贴板是' + ITEMS[c.type].name); return; }
  if (c.dir === undefined) return;
  if (BUILD_DEFS[e.type] && BUILD_DEFS[e.type].rotSwap) {
    // 抽水机旋转后脚印变化，需重新校验仍压水面
    if (e.type === 'offshore-pump' && !pumpCanFace(e, c.dir)) { toast('无法粘贴：抽水机必须仍压在水面上'); return; }
    removeEnt(e); e.dir = c.dir; e.applyDir(); addEnt(e);
  }
  else { e.dir = c.dir; }
  if (c.recipe && typeof e.setRecipe === 'function') e.setRecipe(c.recipe);
  uiDirty = true;
  toast('配置已粘贴');
}

function rotateAction() {
  // 驾驶火车时：R 反转车头方向（对齐《异星工厂》：驾驶列车按 R 掉头）
  if (G.driving && G.driving.ent && typeof reverseTrain === 'function' &&
      (G.driving.ent instanceof Locomotive || G.driving.ent instanceof CargoWagon) && G.driving.mode === 'drive') {
    const tr = findTrainOfCar ? findTrainOfCar(G.driving.ent) : null;
    if (tr) reverseTrain(tr);
    return;
  }
  // 蓝图粘贴中：旋转整个蓝图（对齐《异星工厂》R 键旋转蓝图）
  if (G.blueMode === 'paste' && G.blueprint) {
    G.blueRot = (G.blueRot + 1) % 4;
    uiDirty = true;
    toast('蓝图已旋转 90°（R 继续旋转，V/H 翻转）');
    return;
  }
  if (G.cursorTile && withinReach(G.cursorTile.tx, G.cursorTile.ty)) {
    const e = entAt(G.cursorTile.tx, G.cursorTile.ty);
    if (e && BUILD_DEFS[e.type]) {
      // 非方形设备（分流器类）：旋转后脚印变化，需重挂网格
      if (BUILD_DEFS[e.type].rotSwap) {
        const nd = (e.dir + 1) % 4;
        // 抽水机必须始终压在水面上，旋转后脚印变化需重新校验
        if (e.type === 'offshore-pump' && !pumpCanFace(e, nd)) { toast('抽水机无法朝该方向旋转：必须仍压在水面上'); return; }
        removeEnt(e);
        e.dir = nd;
        e.applyDir();
        addEnt(e);
        uiDirty = true;
        return;
      }
      // 有朝向的设备：直接旋转（采矿机转完立即尝试朝新方向输出）
      if (DEVICE_DIR_ROTATE[e.type]) {
        e.dir = (e.dir + 1) % 4;
        // 传送带方向变化会改变其输入侧判定，失效附近缓存
        invalidateBeltInputNear(e.x, e.y, e.w, e.h);
        if (typeof e.onRotate === 'function') e.onRotate();
        uiDirty = true;
        return;
      }
    }
  }
  G.ghostDir = (G.ghostDir + 1) % 4;
}

// 翻转方向：h=水平翻转（左右镜像，东西互兑），v=垂直翻转（上下镜像，南北互兑）
// 方向 0东 1南 2西 3北。水平翻转交换 0<->2；垂直翻转交换 1<->3，另一轴方向保持不变。
function flipDir(dir, axis) {
  if (axis === 'h') return dir === 0 ? 2 : dir === 2 ? 0 : dir;
  return dir === 1 ? 3 : dir === 3 ? 1 : dir;
}

function flipAction(axis) {
  // 蓝图粘贴中：翻转整个蓝图（V 垂直翻转 / H 水平翻转，对齐《异星工厂》）
  if (G.blueMode === 'paste' && G.blueprint) {
    if (axis === 'h') G.blueFlipH = !G.blueFlipH;
    else G.blueFlipV = !G.blueFlipV;
    uiDirty = true;
    toast('蓝图已' + (axis === 'h' ? '水平翻转' : '垂直翻转') + '（R 旋转，V/H 翻转）');
    return;
  }
  if (G.cursorTile && withinReach(G.cursorTile.tx, G.cursorTile.ty)) {
    const e = entAt(G.cursorTile.tx, G.cursorTile.ty);
    if (e && BUILD_DEFS[e.type]) {
      // 非方形设备（分流器类）：翻转后脚印变化，需重挂网格
      if (BUILD_DEFS[e.type].rotSwap) {
        const nd = flipDir(e.dir, axis);
        // 抽水机必须始终压在水面上，翻转后脚印变化需重新校验
        if (e.type === 'offshore-pump' && !pumpCanFace(e, nd)) { toast('抽水机无法朝该方向翻转：必须仍压在水面上'); return; }
        removeEnt(e);
        e.dir = nd;
        e.applyDir();
        addEnt(e);
        uiDirty = true;
        return;
      }
      // 有朝向的设备：直接翻转
      if (DEVICE_DIR_ROTATE[e.type]) {
        e.dir = flipDir(e.dir, axis);
        if (typeof e.onRotate === 'function') e.onRotate();
        uiDirty = true;
        return;
      }
    }
  }
  // 没有可翻转的已放置设备时，翻转幽灵/预览方向
  G.ghostDir = flipDir(G.ghostDir, axis);
}

// ===== 开始菜单：新游戏 / 读取存档 =====
// 游戏启动后先停留在开始菜单，由用户选择才开始/继续游戏。

// 显示新手引导面板（首次新游戏时自动弹出；也可用 Alt+H 手动查看完整说明）
function showTutorial() {
  const ov = document.getElementById('tutorial-overlay');
  if (ov) {
    ov.classList.remove('hidden');
    if (typeof playSfx === 'function') playSfx('click');
  }
}
function hideTutorial() {
  const ov = document.getElementById('tutorial-overlay');
  if (ov) ov.classList.add('hidden');
}
function tutorialShownMark() {
  G.settings.tutorialShown = true;
  hideTutorial();
  if (typeof saveSettings === 'function') saveSettings(); // 持久化已看标记
}

// 初始化新手引导：绑定“开始游戏”关闭按钮（供首次引导与 Alt+H 说明共用）
function initTutorial() {
  const btn = document.getElementById('btn-tutorial-close');
  if (btn) {
    btn.addEventListener('click', () => tutorialShownMark());
  }
  // 点击遮罩空白处也可关闭
  const ov = document.getElementById('tutorial-overlay');
  if (ov) ov.addEventListener('click', ev => { if (ev.target === ov) tutorialShownMark(); });
}

function startNewGame() {
  newGame();
  buildHotbar();
  enterGame();
  if (!G.settings.tutorialShown) showTutorial();   // 首次新游戏：弹出新手引导
}

async function startFromSave() {
  // 读取时间最新的存档（自动或用户均可）
  const data = await readNewestSave();
  if (!data) { toast('没有存档，请先开始新游戏'); return false; }
  return enterFromSave(data, '已读档');
}

// 从开始菜单读取指定 id 的存档并进入游戏
async function loadSaveFromMenu(id) {
  if (!id) { toast('没有存档'); return false; }
  const data = await readSave(id);
  if (!data) { toast('存档不存在或已损坏'); return false; }
  return enterFromSave(data, '已读档');
}

// 应用存档数据并进入游戏（供开始菜单读取存档复用）
function enterFromSave(data, okMsg) {
  try {
    applySave(data);
  } catch (err) {
    toast('存档损坏：' + err.message);
    return false;
  }
  buildHotbar();
  if (typeof sfxWarmup === 'function') sfxWarmup(500); // 读档静默缓冲，过滤首帧实体恢复爆音
  enterGame();
  if (okMsg) toast(okMsg);
  return true;
}

// 隐藏开始菜单并进入游戏主循环（loop 检测 G.inMenu=false 后开始渲染/更新）。
function enterGame() {
  const sc = document.getElementById('start-screen');
  if (sc) sc.classList.add('hidden');
  G.inMenu = false;
  G.paused = false;
  const pb = document.getElementById('btn-pause');
  if (pb) { pb.textContent = '⏸ 暂停'; pb.title = '暂停游戏'; }
  toast('WASD 移动 · 左键挖矿/放建筑(覆盖建造) · 右键拆除 · R 旋转 · F 拿取 · Q 取消/拾取朝向 · 中键/E 面板 · T 科技 · P 统计 · B 蓝图 · Alt+B 蓝图库 · Alt+D 红图 · Alt+U 绿图 · K/L 存读档');
  // 触屏设备：首次进入展示新手引导
  if (typeof maybeShowTouchTip === 'function') maybeShowTouchTip();
}

// 退出到开始菜单（主页面）：隐藏游戏界面、显示开始菜单，并暂停游戏循环。
function returnToMenu() {
  if (typeof closePanel === 'function') closePanel();
  G.inMenu = true;
  G.paused = false;
  G.sel = -1;
  G.blueMode = null;
  G.deconstructMode = false;
  G.ghostDir = 0;
  const sc = document.getElementById('start-screen');
  if (sc) sc.classList.remove('hidden');
  const pb = document.getElementById('btn-pause');
  if (pb) { pb.textContent = '⏸ 暂停'; pb.title = '暂停游戏'; }
  // 收起顶部菜单（保持整洁的主菜单视图）
  const topMenu = document.getElementById('topright');
  const menuToggle = document.getElementById('btn-menu-toggle');
  if (topMenu && !topMenu.classList.contains('collapsed')) {
    topMenu.classList.add('collapsed');
    if (menuToggle) { menuToggle.textContent = '☰'; menuToggle.title = '展开顶部菜单'; }
  }
  if (typeof playSfx === 'function') playSfx('click');
  toast('已退出到主页面');
  // 回到主菜单时随机生成一张新地图作为背景（复用游戏地图生成功能）
  if (typeof refreshStartBackground === 'function') refreshStartBackground();
}

// ===== 死亡结算菜单（对齐《异星工厂》：阵亡后选择 出生点复活 / 读取存档 / 重新开始）=====
// 玩家阵亡时由 combat2.damagePlayer 调用；暂停游戏并弹出死亡菜单。
function showDeathMenu() {
  const ov = document.getElementById('death-overlay');
  if (ov) ov.classList.remove('hidden');
  G.paused = true;   // 阵亡后暂停游戏世界，等待玩家选择
  if (typeof playSfx === 'function') playSfx('player-death');
}
function hideDeathMenu() {
  const ov = document.getElementById('death-overlay');
  if (ov) ov.classList.add('hidden');
}

// 出生点复活：清空附近敌人，回到出生点并回满生命，继续游戏
function respawnAtSpawn() {
  hideDeathMenu();
  G.enemies = []; G.enemyProjectiles = [];
  G.player.x = G.spawn.x * TILE + TILE / 2;
  G.player.y = G.spawn.y * TILE + TILE / 2;
  // 复位相机：清掉触屏拖动留下的 pan 偏移，否则相机中心会落在 player+pan 处
  // （偏离出生点，导致玩家眼前的基地/设备被挤到屏幕外，看起来“全部不见了”）。
  if (G.cam.pan) { G.cam.pan.x = 0; G.cam.pan.y = 0; }
  G.cam.px = G.player.x; G.cam.py = G.player.y;
  G.playerHP = G.playerHPmax;
  G.paused = false;
  if (typeof toast === 'function') toast('已在出生点复活');
  uiDirty = true;
}

function initDeathMenu() {
  const r = document.getElementById('btn-death-respawn');
  const l = document.getElementById('btn-death-load');
  const s = document.getElementById('btn-death-restart');
  if (r) r.addEventListener('click', () => { if (typeof playSfx === 'function') playSfx('click'); respawnAtSpawn(); });
  if (l) l.addEventListener('click', async () => {
    if (typeof playSfx === 'function') playSfx('click');
    hideDeathMenu();
    // 读取最新存档继续（无存档则回退到出生点复活）
    const ok = await startFromSave();
    if (!ok) respawnAtSpawn();
  });
  if (s) s.addEventListener('click', () => {
    if (typeof playSfx === 'function') playSfx('click');
    hideDeathMenu();
    startNewGame();   // 重新开始游戏（生成新世界）
  });
}

function bindInput() {
  window.addEventListener('keydown', ev => {
    const k = ev.key.toLowerCase();
    if (G.inMenu) return;                 // 开始菜单期间屏蔽游戏快捷键
    if (k === 'f5' || k === 'f12') return;
    const t = ev.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
      if (k === 'escape') { ev.target.blur(); ev.stopPropagation(); }
      return;
    }
    // 只有鼠标点击按钮才能触发按钮操作；按回车/空格不再触发当前聚焦按钮的点击
    if (t && t.tagName === 'BUTTON' && (k === 'enter' || k === ' ')) {
      ev.preventDefault();
      t.blur();
      return;
    }
    G.keys[k] = true;
    if (k >= '1' && k <= '9') selectSlot(+k - 1);
    else if (k === '0') selectSlot(9);
    else if (k === 'tab') { ev.preventDefault(); G.panelMode === 'inv' ? closePanel() : openPanel('inv'); }
    // 统计/蓝图/红图/绿图快捷键（对齐《异星工厂》：P 统计、B 蓝图、Alt+D 红图、Alt+U 绿图）
    else if (k === 'p') G.panelMode === 'stats' ? closePanel() : openPanel('stats');
    else if (k === 'b') { closePanel(); toggleBlueprint('blue'); }
    else if (ev.altKey && k === 'b') { ev.preventDefault(); if (G.blueMode) cancelBlueprint(); G.panelMode === 'bluebook' ? closePanel() : openPanel('bluebook'); }
    else if (ev.altKey && k === 'd') { ev.preventDefault(); closePanel(); toggleBlueprint('red'); }
    else if (ev.altKey && k === 'u') { ev.preventDefault(); closePanel(); toggleBlueprint('green'); }
    else if ((k === 'delete' || k === 'backspace') && G.panelMode === 'machine' &&
             G.panelEnt && typeof G.panelEnt.setRecipe === 'function' && G.panelEnt.recipe) {
      G.panelEnt.setRecipe(null);
      renderPanel(false);
      toast('配方已清除');
    }
    else if (k === 'r') rotateAction();
    else if (k === 'h') flipAction('h');
    else if (k === 'v') flipAction('v');
    else if (k === 'f') { if (!tryEnterNearbyCar()) pickupAction(); }
    // 全部拾取（对齐《异星工厂》：按住 Z 拾取范围内所有地面物品）
    else if (k === 'z') { if (typeof pickupAllAction === 'function') pickupAllAction(); }
    else if (k === 'e') {
      if (G.driving) { if (typeof exitCar === 'function') exitCar(); }
      else if (G.panelMode === 'inv') closePanel();
      else openPanel('inv');
    }
    else if (k === 't') G.panelMode === 'tech' ? closePanel() : openPanel('tech');
    else if (k === 'o') G.panelMode === 'set' ? closePanel() : openPanel('set');
    else if (k === 'm') { G.settings.minimap = !(G.settings.minimap !== false); toast(G.settings.minimap ? '小地图：开启' : '小地图：关闭'); }
    // 地图标记（对齐《异星工厂》：N 放置地图标记，Alt+N 管理）
    else if (ev.altKey && k === 'n') {
      ev.preventDefault();
      G.panelMode === 'maptags' ? closePanel() : openPanel('maptags');
    }
    else if (k === 'n') { if (typeof placeMapTag === 'function') placeMapTag(); }
    // 操作说明（Alt+H）：随时查看完整快捷键指南
    else if (ev.altKey && k === 'h') { ev.preventDefault(); if (typeof showTutorial === 'function') showTutorial(); }
    // 放电防御装备：C 键激活对周围敌人放电（对齐《异星工厂》Discharge defense）
    else if (k === 'c') { if (typeof activateDischargeDefense === 'function') activateDischargeDefense(); }
    // ALT 模式（对齐《异星工厂》ALT 模式）：按 Alt 键切换建筑配方/内容叠加显示
    else if (k === 'alt') {
      ev.preventDefault();
      G.settings.altMode = !(G.settings.altMode !== false);
      saveSettings();
      toast(G.settings.altMode ? 'ALT 模式：开（显示建筑配方/内容叠加）' : 'ALT 模式：关');
    }
    else if (k === 'escape' || k === 'q') {
      if (G.driving) { if (typeof exitCar === 'function') exitCar(); }
      else if (G.blueMode) {
        cancelBlueprint();
      } else if (G.deconstructMode) {
        toggleDeconstructMode(false);
      } else if (G.panelMode) {
        closePanel();
      } else if (buildActive() || !G.cursorTile) {
        // 手持普通物品时按 Q 丢弃 1 个到地面（保持手持，便于手动上料，对齐《异星工厂》）；
        // 手持建筑/工具时 Q 仍为取消选择。
        if (buildActive() && typeof dropHeldItemToGround === 'function' && dropHeldItemToGround()) {
          // 已丢弃到地面，保持手持
        } else {
          G.sel = -1;
          G.quickSel = null;
          refreshHotbar();
        }
      } else {
        const e = entAt(G.cursorTile.tx, G.cursorTile.ty);
        const idx = e ? HOTBAR.indexOf(e.type) : -1;
        if (idx < 0) {
          G.sel = -1;
          if (e && BUILD_DEFS[e.type]) {
            G.quickSel = e.type;
            G.ghostDir = e.dir;
            toast('已直接选中 ' + ITEMS[e.type].name + '（Q 取消）');
          }
          uiDirty = true;
          refreshHotbar();
        } else {
          G.sel = idx;
          G.ghostDir = e.dir;
          uiDirty = true;
          refreshHotbar();
        }
      }
    }
  });
  window.addEventListener('keyup', ev => {
    const k = ev.key.toLowerCase();
    G.keys[k] = false;
  });

  G.canvas.addEventListener('mousemove', ev => {
    updateCursorTile(ev.clientX, ev.clientY);
    if (G.blueSelecting && G.cursorTile) {
      G.blueEnd = { tx: G.cursorTile.tx, ty: G.cursorTile.ty };
    }
  });
  // 触屏手势交互：由 js/touch.js 的 touchInit() 统一注册（点按/长按操作盘/拖动平移/攒合缩放等）
  touchInit();
  G.canvas.addEventListener('mouseenter', () => { G.canvasActive = true; });
  G.canvas.addEventListener('mouseleave', () => {
    G.canvasActive = false;
    G.cursorTile = null;
    G.mouseDown = false;
  });
  G.canvas.addEventListener('mousedown', ev => {
    ev.preventDefault();
    updateCursorTile(ev.clientX, ev.clientY);
    // 蓝图/红图交互：左键开始框选或粘贴，右键取消
    if (G.blueMode) {
      if (ev.button === 2) { cancelBlueprint(); return; }
      if (ev.button === 0) {
        if (G.blueMode === 'paste') {
          pasteBlueprint();
          // 粘贴后保持粘贴模式，可继续在别处粘贴（右键或按 Q/Esc 取消）
        } else {
          G.blueStart = { tx: G.cursorTile.tx, ty: G.cursorTile.ty };
          G.blueEnd = { tx: G.cursorTile.tx, ty: G.cursorTile.ty };
          G.blueSelecting = true;
        }
        return;
      }
      return;
    }
    const hovered = G.cursorTile ? entAt(G.cursorTile.tx, G.cursorTile.ty) : null;
    if (ev.button === 0) {
      // Shift+左键“粘贴设置”，与普通左键建造（默认支持覆盖）区分开
      if (ev.shiftKey && !ev.ctrlKey && hovered) { pasteSettings(hovered); return; }
      // 拆除模式：左键（含触屏模拟）用于拆除建筑，而非建造/挖矿
      if (G.deconstructMode) {
        G.deconstructHeld = true;
        if (G.cursorTile) deconstructAt(G.cursorTile.tx, G.cursorTile.ty);
        return;
      }
      G.mouseDown = true;
      lastPlaceKey = '';
      handleLeftDown();
    } else if (ev.button === 2) {
      if (ev.shiftKey && hovered) { copySettings(hovered); return; }
      // 右键取物优先：传送带/地下带/机械臂（对齐《异星工厂》）
      if (G.cursorTile && withinReach(G.cursorTile.tx, G.cursorTile.ty)) {
        if (rightClickPickupAt(G.cursorTile.tx, G.cursorTile.ty)) return;
      }
      if (G.cursorTile) deconstructAt(G.cursorTile.tx, G.cursorTile.ty);
    } else if (ev.button === 1) {
      if (G.cursorTile) {
        const e = entAt(G.cursorTile.tx, G.cursorTile.ty);
        if (e) openPanel('machine', e);
      }
    }
  });
  window.addEventListener('mouseup', ev => {
    if (ev.button !== 0) return;
    G.mouseDown = false;
    G.deconstructHeld = false;
    // 蓝图/红图：松开鼠标完成框选
    if (G.blueSelecting) {
      G.blueSelecting = false;
      if (!G.blueStart || !G.blueEnd) { cancelBlueprint(); return; }
      if (G.blueMode === 'blue') captureBlueprint();
      else if (G.blueMode === 'red') applyRedBlueprint();
      else if (G.blueMode === 'green') applyGreenBlueprint();
    }
  });

  // ===== 触屏手势已由 js/touch.js 的 touchInit() 统一接管（点按/长按/拖动/攒合/双击） =====

  G.canvas.addEventListener('contextmenu', ev => ev.preventDefault());
  G.canvas.addEventListener('wheel', ev => {
    ev.preventDefault();
    // 滚轮切换快捷栏（对齐《异星工厂》：滚轮在快捷栏槽位间循环切换）；
    // 按住 Ctrl/Shift 时仍用滚轮缩放视野（保留原缩放交互）；
    // 打开面板/蓝图/红图/绿图时滚轮不切换快捷栏（避免误关面板）。
    if (!ev.ctrlKey && !ev.shiftKey && !G.panelMode && !G.blueMode && !G.deconstructMode) {
      const delta = ev.deltaY > 0 ? 1 : -1;
      const n = HOTBAR.length || 10;
      const cur = G.sel >= 0 && G.sel < n ? G.sel : 0;
      selectSlot((cur + delta + n) % n);
      return;
    }
    G.cam.z *= ev.deltaY < 0 ? 1.12 : 0.89;
    G.cam.z = Math.max(0.5, Math.min(2.2, G.cam.z));
  }, { passive: false });

  window.addEventListener('resize', resize);
  document.getElementById('game').addEventListener('click', ev => {
    if (ev.button !== 0 || ev.shiftKey) return;
    if (G.blueMode) return;   // 蓝图/红图模式下不触发面板
    updateCursorTile(ev.clientX, ev.clientY);
    if (!G.cursorTile) return;
    // 手持修理包点击受损建筑 → 修复（优先于打开面板）
    if (hasRepairPackSelected() && withinReach(G.cursorTile.tx, G.cursorTile.ty)) {
      const e = entAt(G.cursorTile.tx, G.cursorTile.ty);
      if (e && isDamaged(e)) { repairActionAt(G.cursorTile.tx, G.cursorTile.ty); return; }
    }
    // 手持蜘蛛遥控器点击地面 → 命令蜘蛛机器人移动
    if (typeof selItem === 'function' && selItem() === 'spidertron-remote') { commandSpidertron(G.cursorTile.tx, G.cursorTile.ty); return; }
    // 手持峭壁炸药点击峭壁 → 炸毁清除（对齐《异星工厂》Cliff explosives）
    if (hasCliffBlastSelected() && isCliff(G.cursorTile.tx, G.cursorTile.ty)) { cliffBlastAt(G.cursorTile.tx, G.cursorTile.ty); return; }
    // 手持红/绿电路线缆点击电路设备 → 切换其接入通道（对齐《异星工厂》Red/Green wire）
    if (typeof wireToolSelected === 'function' && wireToolSelected() && withinReach(G.cursorTile.tx, G.cursorTile.ty)) {
      const we = entAt(G.cursorTile.tx, G.cursorTile.ty);
      if (we && applyWireToNode(we, wireToolSelected())) { toast((we.wireChan === 'both' ? '已恢复双通道接入' : '仅接入' + (we.wireChan === 'red' ? '红线' : '绿线') + '网络') + '（' + ITEMS[we.type].name + '）'); return; }
    }
    if (buildActive()) return;
    const e = entAt(G.cursorTile.tx, G.cursorTile.ty);
    if (e) openPanel('machine', e);
    // 点击敌人 → 显示该敌人的简单介绍（对齐《异星工厂》：可查看敌对单位图鉴信息）
    else {
      const en = (typeof enemyAtTile === 'function') ? enemyAtTile(G.cursorTile.tx, G.cursorTile.ty) : null;
      if (en) {
        const d = ENEMY_TYPES[en.type];
        const nm = d ? d.name : (en.kind === 'spawner' ? '虫巢' : '敌人');
        toast(nm + '：' + ((typeof enemyDesc === 'function') ? enemyDesc(en) : '敌对单位'));
      }
    }
  });
}

function handleLeftDown() {
  // 手持蜘蛛遥控器点击地面 → 命令蜘蛛机器人移动到目标点（对齐《异星工厂》Spidertron remote）
  if (typeof selItem === 'function' && selItem() === 'spidertron-remote' && G.cursorTile) {
    commandSpidertron(G.cursorTile.tx, G.cursorTile.ty);
    return;
  }
  // 手持修理包点击受损建筑 → 修复（对齐《异星工厂》：左键维修）
  if (hasRepairPackSelected() && G.cursorTile && withinReach(G.cursorTile.tx, G.cursorTile.ty)) {
    const e = entAt(G.cursorTile.tx, G.cursorTile.ty);
    if (e && isDamaged(e)) { repairActionAt(G.cursorTile.tx, G.cursorTile.ty); return; }
  }
  // 手持峭壁炸药点击峭壁 → 炸毁清除（对齐《异星工厂》Cliff explosives）
  if (hasCliffBlastSelected() && G.cursorTile && isCliff(G.cursorTile.tx, G.cursorTile.ty)) {
    cliffBlastAt(G.cursorTile.tx, G.cursorTile.ty);
    return;
  }
  // 手持红/绿电路线缆点击电路设备 → 切换其接入通道（对齐《异星工厂》Red/Green wire）
  if (G.cursorTile && typeof wireToolSelected === 'function' && wireToolSelected() && withinReach(G.cursorTile.tx, G.cursorTile.ty)) {
    const we = entAt(G.cursorTile.tx, G.cursorTile.ty);
    if (we && applyWireToNode(we, wireToolSelected())) { toast((we.wireChan === 'both' ? '已恢复双通道接入' : '仅接入' + (we.wireChan === 'red' ? '红线' : '绿线') + '网络') + '（' + ITEMS[we.type].name + '）'); return; }
  }
  if (buildActive() && G.cursorTile) {
    tryPlaceAt(G.cursorTile.tx, G.cursorTile.ty);
    lastPlaceKey = G.cursorTile.tx + ',' + G.cursorTile.ty;
  } else if (G.cursorTile && typeof tryFishAt === 'function' && isWater(G.cursorTile.tx, G.cursorTile.ty)) {
    // 无建造选中、点击水域 → 钓鱼（对齐《异星工厂》鼠标钓鱼）
    tryFishAt(G.cursorTile.tx, G.cursorTile.ty);
  }
}

// 触发全屏强光闪光（原子弹核爆等大爆炸用）：叠加白光，数值越大越亮
function addScreenFlash(v) {
  G.screenFlash = Math.max(G.screenFlash || 0, v);
}

// ===== 蜘蛛遥控器（对齐《异星工厂》Spidertron remote）=====
// 手持遥控器点击地图：命令最近的蜘蛛机器人（优先当前驾驶的）自主移动到目标点。
// 若当前在驾驶蜘蛛机器人，则退出驾驶，交由自主移动接管。
function commandSpidertron(tx, ty) {
  const px = G.player.x, py = G.player.y;
  let best = null, bestD = Infinity;
  for (const e of G.ents) {
    if (e._dead || e.type !== 'spidertron') continue;
    const d = Math.hypot((e.x + e.w / 2) * TILE - px, (e.y + e.h / 2) * TILE - py);
    if (d < bestD) { best = e; bestD = d; }
  }
  if (!best) {
    if (typeof toast === 'function') toast('未找到蜘蛛机器人，请先建造蜘蛛机器人');
    return;
  }
  // 若正驾驶的是该蜘蛛，则退出驾驶
  if (G.driving && G.driving.ent === best && typeof exitCar === 'function') exitCar();
  best.remoteTarget = { x: tx, y: ty };
  if (typeof toast === 'function') toast('蜘蛛机器人正在前往目标点…');
  if (typeof playSfx === 'function') playSfx('click');
  uiDirty = true;
}

function updateCursorTile(cx, cy) {
  const [wx, wy] = screenToWorld(cx, cy);
  const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
  G.cursorTile = { tx, ty };
}

function updateHeldMouse(dt) {
  // 拆除模式：按住左键/触屏拖动可连续拆除目标格上的建筑
  if (G.deconstructHeld && G.cursorTile) {
    if (G.blueMode) { G.deconstructHeld = false; return; }
    deconstructAt(G.cursorTile.tx, G.cursorTile.ty);
    return;
  }
  if (!G.mouseDown || !G.cursorTile) return;
  if (buildActive()) {
    const key = G.cursorTile.tx + ',' + G.cursorTile.ty;
    if (key !== lastPlaceKey) {
      tryPlaceAt(G.cursorTile.tx, G.cursorTile.ty);
      lastPlaceKey = key;
    }
  } else {
    updateMining(dt);
  }
}

function loop(ts) {
  requestAnimationFrame(loop);
  if (G.inMenu) return;   // 开始菜单显示中：不渲染、不更新游戏世界
  const now = ts / 1000;
  const raw = Math.min(0.05, now - (loop.lastT || now));
  loop.lastT = now;
  const dt = Math.min(0.3, raw * ((G.dbg && G.dbg.timeScale) || 1));
  // 游戏暂停：由顶部“暂停/继续”按钮控制（G.paused）。
  // 打开设置面板不再暂停游戏（仅暂停时世界/设备/电力/玩家停摆）。
  const paused = !!G.paused;
  if (!paused) G.time += dt;
  fpsSmooth += (1 / Math.max(raw, 0.0001) - fpsSmooth) * 0.05;
  if (G.settings.autoSave) {
    G.autoT += raw;
    if (G.autoT >= 60) { G.autoT = 0; autoSaveGame().then(() => toast('自动保存完成')); }
  }

  try {
    if (!paused) {
      // 成就周期性判定（每 3s 覆盖污染等连续增长条件；事件触发点另有即时判定）
      G.achT = (G.achT || 0) + dt;
      if (G.achT >= 3) { G.achT = 0; if (typeof checkAchievements === 'function') checkAchievements(); }
      // 每帧失效信号塔模块加成缓存（P0 优化：同一帧内同坐标只查询一次）
      if (typeof clearBeaconBonusCache === 'function') clearBeaconBonusCache();
      updatePlayer(dt);
      updateTouchMove(dt);
      updateHeldMouse(dt);
      updateMining(dt);
      if (typeof updateGroundItems === 'function') updateGroundItems(dt);   // 地面物品（手动上料）拾取
      updateCraftQueue(dt);   // 手搓合成队列（按时间逐件制作）
      if (typeof updateFishing === 'function') updateFishing(dt);   // 钓鱼冷却
      if (typeof updatePersonalPower === 'function') updatePersonalPower(dt);   // 个人电网（装备件）
      if (typeof updateDischargeCooldown === 'function') updateDischargeCooldown(dt);   // 放电防御冷却
      for (const e of G.ents) {
        // 性能优化：跳过继承基类空 update 的静态实体（储物箱/门/石墙/铁轨/火车车厢/信号灯/机器人港/物流箱/信号塔/电灯等），
        // 其逻辑由独立系统（箱子存取/门开合/铁路调度/物流扫描/模块广播等）处理，无需每帧调用空函数。
        // 调用基类空 update 与跳过完全等价，故不影响任何功能。
        if (e._dead || typeof e.update !== 'function') continue;
        if (e.update === Entity.prototype.update) continue;
        e.update(dt);
      }
      // 敌人/子弹系统（可在设置中开关战斗）
      if (G.settings.combat) {
        if (typeof resetSpawnerCache === 'function') resetSpawnerCache();   // 每帧失效 spawner 列表缓存（P0 优化）
        spawnEnemies(dt);
        // 性能优化：本帧存活敌人列表只计算一次，供子弹命中/战斗机器人/区域力场等复用，
        // 避免每帧多处在 combat2.js 里各自 filter 生成全新数组（降低 GC 压力）。
        // 复用数组而非每帧 new：先清空再用 for 循环回填，避免每帧分配新数组带来的 GC 压力。
        if (!G._aliveEnemies) G._aliveEnemies = [];
        const _ae = G._aliveEnemies;
        _ae.length = 0;
        const _src = G.enemies || EMPTY_ARR;
        for (let i = 0; i < _src.length; i++) if (!_src[i].dead) _ae.push(_src[i]);
        if (typeof updateWaves === 'function') updateWaves(dt);
        if (typeof updatePollution === 'function') updatePollution(dt);   // 污染系统（对齐《异星工厂》)
        updateEnemies(dt);
        updateBullets(dt);
        updatePlayerFire(dt);
        updatePlayerBulletHits(dt);
        updateCombatRobots(dt);
        updateAoeZones(dt);
        if (typeof updateGroundFires === 'function') updateGroundFires(dt);
        if (typeof updateAcidPools === 'function') updateAcidPools(dt);
        if (typeof updatePersonalLaserDefense === 'function') updatePersonalLaserDefense(dt);
        if (typeof updateCarFire === 'function') updateCarFire(dt);   // 车载机枪（对齐《异星工厂》Car）
        if (typeof updateTankFire === 'function') updateTankFire(dt);
        if (typeof updateLootDrops === 'function') updateLootDrops(dt);
      }
      G.powerT += dt;
      if (G.powerT >= 0.25) { G.powerT = 0; updatePower(); }
      // 电路网络重算（固定间隔，红/绿信号聚合）
      G.circuitT = (G.circuitT || 0) + dt;
      if (G.circuitT >= 0.25) { G.circuitT = 0; if (typeof recomputeCircuit === 'function') recomputeCircuit(); }
      updateLogistics(dt);
      if (typeof updateConstruction === 'function') updateConstruction(dt);
      updateTrains(dt);
      if (typeof updateParticles === 'function') updateParticles(dt);
      updateCamera(dt);
      // 全屏闪光衰减（原子弹核爆等触发的强光，随时间减弱）
      if (G.screenFlash > 0) G.screenFlash = Math.max(0, G.screenFlash - dt * 1.6);
      // 天气系统（动态云层 / 阴云，低开销）
      if (typeof updateWeather === 'function') updateWeather(dt);
      // 环境氛围音（Web Audio 昼夜背景音）
      if (typeof ambientUpdate === 'function') ambientUpdate(dt);
    }

    // 背景音乐（可独立开关）：暂停游戏时仍持续播放（界面层氛围）
    if (typeof bgmUpdate === 'function') bgmUpdate(dt);

    render();

    if (uiDirty || G.time - lastPanelCheck > 0.25) {
      lastPanelCheck = G.time;
      refreshHotbar();
      if (G.panelMode === 'machine') updateMachineLive();
      if (G.panelMode === 'stats') updateStatsLive();
      if (uiDirty && (G.panelMode === 'inv' || G.panelMode === 'tech')) renderPanel(false);
      uiDirty = false;
    }
    updateHUD(dt, Math.round(fpsSmooth));
  } catch (err) {
    if (!loop.errShown) {
      loop.errShown = true;
      console.error(err);
      toast('发生内部错误：' + err.message + '（控制台可见详情）');
    }
  }
}

function boot() {
  if (G.booted) return;
  G.booted = true;
  const steps = [
    ['canvas', () => { G.canvas = document.getElementById('game'); G.ctx = G.canvas.getContext('2d'); resize(); }],
    ['settings', () => loadSettings()],
    ['saves', () => migrateLegacySave()],
    ['topbtn', () => initTopButtons()],
    ['panel', () => initPanelEvents()],
    ['joystick', () => initJoystick()],
    ['deconstruct', () => initDeconstructBtn()],
    ['tooltip', () => initTooltips()],
    ['hudinfo', () => initHudInfo()],
    ['tutorial', () => initTutorial()],
    ['debug', () => buildDebug()],
    ['deathmenu', () => initDeathMenu()],
    ['input', () => bindInput()]
  ];
  for (const [name, fn] of steps) {
    try { fn(); } catch (err) {
      console.error('init[' + name + ']', err);
      toast('初始化[' + name + ']失败：' + err.message);
    }
  }
  if (!G.rafStarted) { G.rafStarted = true; requestAnimationFrame(loop); }
}
window.addEventListener('load', boot);
if (document.readyState === 'complete') setTimeout(boot, 0);
