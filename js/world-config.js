'use strict';

// ===== 地图生成器配置（对齐《异星工厂》新游戏地图设置）=====
// 原版《异星工厂》在开始新游戏前允许玩家配置世界参数：
//   地图大小 / 资源（丰富度、频率、大小）/ 敌人强度 / 水等。
// 本项目据此新增「地图设置」面板，让玩家在开局前按需定制世界。
//
// 配置保存在 G.worldConfig（随存档持久化），并在 newGame()/genChunk() 中生效；
// 未配置时使用默认值，保持与原随机生成完全一致的旧行为，兼容旧存档。

// 配置结构（各字段取值见 *_OPTIONS）
function defaultWorldConfig() {
  return {
    seed: 0,                     // 世界种子，0 表示随机
    size: 'infinite',            // 地图大小
    resourceRichness: 'normal',  // 资源丰富度（矿量）
    resourceFrequency: 'normal', // 资源频率（矿团数量）
    resourceSize: 'normal',      // 资源大小（矿团尺寸）
    water: 'normal',             // 水频率
    enemy: 'normal',             // 敌人强度
    cliff: 'on',                 // 是否生成峭壁（对齐《异星工厂》：峭壁默认开启）
    planet: 'nauvis'            // 起始星球（对齐《异星工厂》Space Age：新地星 Nauvis 为默认）
  };
}
// 默认配置单例：保证 worldConfig() 在未设置时返回同一引用，避免缓存永不命中的递归/重建
const DEFAULT_WC = defaultWorldConfig();

// 各配置项的候选值与显示名（对齐原版界面：地图大小 / 资源 / 敌人 / 水）
const WORLD_SIZE_OPTIONS = [
  { v: 'small',    name: '小' },
  { v: 'medium',   name: '中' },
  { v: 'large',    name: '大' },
  { v: 'infinite', name: '无限' }
];
const WORLD_LEVEL_OPTIONS = [
  { v: 'low',    name: '低' },
  { v: 'normal', name: '中' },
  { v: 'high',   name: '高' }
];
const WORLD_ENEMY_OPTIONS = [
  { v: 'none',     name: '无' },
  { v: 'peaceful', name: '和平' },
  { v: 'low',      name: '低' },
  { v: 'normal',   name: '中' },
  { v: 'high',     name: '高' }
];
const WORLD_CLIFF_OPTIONS = [
  { v: 'on',  name: '开启' },
  { v: 'off', name: '关闭' }
];

// ===== 行星系统（对齐《异星工厂》Space Age 五颗行星）=====
// 开局可选起始星球（新游戏设置面板），不同星球拥有不同的地表色调与资源分布。
// 每颗星球在官方 factorio-data 中有专属命名（见 data/space-age/locale）。
// 资源画像 resourceProfile：{ iron,copper,coal,stone,uranium,oil,asteroid,water }
//   - 0   = 该星球无此资源（不生成）
//   - 0.5 = 更少/更稀缺
//   - 1   = 正常
//   - 1.5 = 更丰富
const PLANET_OPTIONS = [
  { v: 'nauvis',   name: '新地星', en: 'Nauvis' },
  { v: 'vulcanus', name: '祝融星', en: 'Vulcanus' },
  { v: 'gleba',    name: '句芒星', en: 'Gleba' },
  { v: 'fulgora',  name: '雷神星', en: 'Fulgora' },
  { v: 'aquilo',   name: '玄冥星', en: 'Aquilo' }
];

// 行星地表主色调（草地色，渲染时对同行星所有地块生效；灰度为石质地面）
const PLANET_GRASS_COLORS = {
  nauvis:   ['#4f7c3b', '#4a7538', '#456f35'],  // 温带绿
  vulcanus: ['#8a6a3a', '#835f32', '#7c592e'],  // 火山赭石
  gleba:    ['#3f7a3a', '#3a7335', '#356c30'],  // 沼泽深绿
  fulgora:  ['#7a7a88', '#72727f', '#6b6b78'],  // 雷云灰
  aquilo:   ['#8a9aa8', '#82929f', '#7a8a97']   // 冰原灰蓝
};

// 行星资源画像：每颗星球各资源丰度倍率（0=无）。依据官方星球设定适配到现有矿种。
const PLANET_RESOURCES = {
  nauvis:   { iron: 1,   copper: 1,   coal: 1,   stone: 1,   uranium: 1,   oil: 1,   asteroid: 1,  water: 1 },
  vulcanus: { iron: 1.4, copper: 1.4, coal: 0.4, stone: 1.5, uranium: 0,   oil: 0,   asteroid: 1,  water: 0 },
  gleba:    { iron: 0,   copper: 0,   coal: 0,   stone: 1.2, uranium: 0,   oil: 0,   asteroid: 1,  water: 1.5 },
  fulgora:  { iron: 0.2, copper: 0.2, coal: 0,   stone: 1,   uranium: 1.6, oil: 0,   asteroid: 1.4, water: 0 },
  aquilo:   { iron: 0.5, copper: 0.5, coal: 1.2, stone: 1.2, uranium: 0,   oil: 1,   asteroid: 1.5, water: 1 }
};


// 归一化：确保配置对象字段完整、取值合法（旧存档/外部传入可能缺字段）
function normalizeWorldConfig(c) {
  const d = defaultWorldConfig();
  if (!c || typeof c !== 'object') return d;
  const out = {};
  out.seed = (typeof c.seed === 'number' && isFinite(c.seed) && c.seed > 0) ? c.seed : 0;
  out.size = WORLD_SIZE_OPTIONS.some(o => o.v === c.size) ? c.size : d.size;
  out.resourceRichness = WORLD_LEVEL_OPTIONS.some(o => o.v === c.resourceRichness) ? c.resourceRichness : d.resourceRichness;
  out.resourceFrequency = WORLD_LEVEL_OPTIONS.some(o => o.v === c.resourceFrequency) ? c.resourceFrequency : d.resourceFrequency;
  out.resourceSize = WORLD_LEVEL_OPTIONS.some(o => o.v === c.resourceSize) ? c.resourceSize : d.resourceSize;
  out.water = WORLD_LEVEL_OPTIONS.some(o => o.v === c.water) ? c.water : d.water;
  out.enemy = WORLD_ENEMY_OPTIONS.some(o => o.v === c.enemy) ? c.enemy : d.enemy;
  out.cliff = WORLD_CLIFF_OPTIONS.some(o => o.v === c.cliff) ? c.cliff : d.cliff;
  out.planet = PLANET_OPTIONS.some(o => o.v === c.planet) ? c.planet : d.planet;
  return out;
}

// 当前生效的世界配置（随存档持久化）；未设置时返回默认。
// 带轻量派生缓存：配置在开局/读档后不变，避免 spawnEnemies 等每帧路径重复做字符串比较（P0 微优化）。
// _wcCache 记录上次用于计算派生值的配置对象引用；引用变化或首次调用时才重建。
let _wcCache = null;
let _wcf = null;
function worldConfig() {
  const cfg = (G && G.worldConfig) ? G.worldConfig : DEFAULT_WC;
  if (_wcCache !== cfg) {
    _wcCache = cfg;   // 先更新引用，避免计算派生值时递归
    _wcf = { richness: richnessMult0(), frequency: frequencyMult0(), size: sizeMult0(), water: waterBias0(), enemy: enemyConfig0(), cliff: cliffOn0() };
  }
  return _wcCache;
}
// 派生值查询（优先读缓存，零重复计算）
function richnessMult() { return worldConfig() && _wcf ? _wcf.richness : richnessMult0(); }
function frequencyMult() { return worldConfig() && _wcf ? _wcf.frequency : frequencyMult0(); }
function sizeMult() { return worldConfig() && _wcf ? _wcf.size : sizeMult0(); }
function waterBias() { return worldConfig() && _wcf ? _wcf.water : waterBias0(); }
function enemyConfig() { return worldConfig() && _wcf ? _wcf.enemy : enemyConfig0(); }
function cliffOn() { return worldConfig() && _wcf ? _wcf.cliff : cliffOn0(); }
function planetId() { return worldConfig().planet || 'nauvis'; }
// 当前行星资源画像（供 world.js 按行星差异化生成资源/地形）
function planetResources() { return PLANET_RESOURCES[planetId()] || PLANET_RESOURCES.nauvis; }
function planetGrassColors() { return PLANET_GRASS_COLORS[planetId()] || PLANET_GRASS_COLORS.nauvis; }
function planetOption(id) { return PLANET_OPTIONS.find(o => o.v === id) || PLANET_OPTIONS[0]; }

// 实际计算逻辑（供 worldConfig 缓存派生值；也可在缓存未就绪时直接调用）
function richnessMult0() {
  const v = worldConfig().resourceRichness;
  if (v === 'low') return 0.65;
  if (v === 'high') return 1.55;
  return 1;
}
function frequencyMult0() {
  const v = worldConfig().resourceFrequency;
  if (v === 'low') return 0.6;
  if (v === 'high') return 1.45;
  return 1;
}
function sizeMult0() {
  const v = worldConfig().resourceSize;
  if (v === 'low') return 0.7;
  if (v === 'high') return 1.35;
  return 1;
}
function waterBias0() {
  const v = worldConfig().water;
  if (v === 'low') return -0.006;
  if (v === 'high') return 0.006;
  return 0;
}
function cliffOn0() {
  return worldConfig().cliff !== 'off';
}
function enemyConfig0() {
  const v = worldConfig().enemy;
  if (v === 'none') return { none: true, peaceful: true, initEvolution: 0, spawnMult: 0 };
  // 和平模式：敌人存在并在虫巢周围游荡，但永不主动攻击（由 isEnemyAggressive 保证）
  if (v === 'peaceful') return { peaceful: true, initEvolution: 0, spawnMult: 1 };
  if (v === 'low') return { peaceful: false, initEvolution: 0.1, spawnMult: 0.55 };
  if (v === 'high') return { peaceful: false, initEvolution: 0.5, spawnMult: 2.1 };
  return { peaceful: false, initEvolution: 0, spawnMult: 1 };
}
// 地图大小 → 可探索最大区块半径（格）。infinite 返回 Infinity。
// 超出范围的区块视为不可生成（世界边界，对齐原版地图大小限制）。
function maxMapDist() {
  const v = worldConfig().size;
  if (v === 'small') return 120;
  if (v === 'medium') return 240;
  if (v === 'large') return 480;
  return Infinity;
}

// ===== 地图设置面板 =====
// 在开始新游戏前弹出，允许玩家配置世界参数。确认后写入 G.worldConfig。
// 返回当前（用于「开始游戏」时读取）配置。
function openWorldConfigPanel(onConfirm) {
  const cfg = normalizeWorldConfig(G && G.worldConfig);
  const ov = document.getElementById('world-config-overlay');
  if (!ov) { if (onConfirm) onConfirm(cfg); return; }
  ov.classList.remove('hidden');
  buildWorldConfigHtml(ov, cfg);
  const body = ov.querySelector('.world-config-body');
  // 确认按钮（在 buildWorldConfigHtml 前清除旧监听，避免累积）
  const okBtn = ov.querySelector('#world-config-ok');
  if (okBtn) {
    const newBtn = okBtn.cloneNode(true);
    okBtn.parentNode.replaceChild(newBtn, okBtn);
    newBtn.addEventListener('click', function () {
      const final = readWorldConfigFromPanel(body, cfg);
      if (G) G.worldConfig = final;
      closeWorldConfigPanel();
      if (onConfirm) onConfirm(final);
    });
  }
}

function closeWorldConfigPanel() {
  const ov = document.getElementById('world-config-overlay');
  if (ov) ov.classList.add('hidden');
}

// 渲染配置面板 HTML
function buildWorldConfigHtml(ov, cfg) {
  const seg = (label, optList, cur, key) => {
    let h = '<div class="wcfg-row"><div class="wcfg-label">' + label + '</div><div class="wcfg-opts">';
    for (const o of optList) {
      h += '<button type="button" class="wcfg-opt' + (o.v === cur ? ' active' : '') + '" data-key="' + key + '" data-val="' + o.v + '">' + o.name + '</button>';
    }
    h += '</div></div>';
    return h;
  };
  // 行星选择：对齐《异星工厂》Space Age 五颗行星（新地/祝融/句芒/雷神/玄冥）
  {
    let hh = '<div class="wcfg-row"><div class="wcfg-label">🌍 起始星球</div><div class="wcfg-opts">';
    for (const o of PLANET_OPTIONS) {
      hh += '<button type="button" class="wcfg-opt' + (o.v === cfg.planet ? ' active' : '') + '" data-key="planet" data-val="' + o.v + '" title="' + o.en + '">' + o.name + '</button>';
    }
    hh += '</div></div>';
    hh += '<div class="dim wcfg-desc">选择起始星球：不同星球拥有不同的地表色调与资源分布（对齐《异星工厂》Space Age）。各星球专属资源为：祝融星=金属/石矿更丰、无原油铀矿；句芒星=无铁铜煤矿但石矿充足；雷神星=铀矿更丰、无石油；玄冥星=冰原、油为主、太阳能效率低。</div>';
    h += hh;
  }
  let h = '<div class="wcfg-field">' +
    '<div class="wcfg-label">世界种子</div>' +
    '<div class="wcfg-seedrow">' +
      '<input id="wcfg-seed-input" type="number" min="1" value="' + (cfg.seed || '') + '" placeholder="留空 = 随机">' +
      '<button type="button" id="wcfg-seed-random" class="wcfg-opt">🎲 随机</button>' +
    '</div>' +
    '<div class="dim wcfg-desc">相同种子会生成相同世界（地形/矿脉/水/峭壁）。留空或 0 表示随机。</div>' +
  '</div>';
  h += seg('地图大小', WORLD_SIZE_OPTIONS, cfg.size, 'size');
  h += '<div class="dim wcfg-desc">限制可探索范围：小/中/大为有限地图，无限则不限制（默认）。</div>';
  h += seg('资源丰富度', WORLD_LEVEL_OPTIONS, cfg.resourceRichness, 'resourceRichness');
  h += '<div class="dim wcfg-desc">影响矿脉储量：低 = 稀薄，高 = 富饶。</div>';
  h += seg('资源频率', WORLD_LEVEL_OPTIONS, cfg.resourceFrequency, 'resourceFrequency');
  h += '<div class="dim wcfg-desc">影响矿团数量：低 = 更少更分散，高 = 更多更密集。</div>';
  h += seg('资源大小', WORLD_LEVEL_OPTIONS, cfg.resourceSize, 'resourceSize');
  h += '<div class="dim wcfg-desc">影响单个矿团的尺寸。</div>';
  h += seg('水频率', WORLD_LEVEL_OPTIONS, cfg.water, 'water');
  h += '<div class="dim wcfg-desc">影响水域的数量。</div>';
  h += seg('峭壁', WORLD_CLIFF_OPTIONS, cfg.cliff, 'cliff');
  h += '<div class="dim wcfg-desc">是否生成峭壁山脊（阻挡通行，可用峭壁炸药清除）。关闭则世界无峭壁。</div>';
  h += seg('敌人', WORLD_ENEMY_OPTIONS, cfg.enemy, 'enemy');
  h += '<div class="dim wcfg-desc">无 = 完全没有敌人；和平 = 敌人存在但不主动攻击，只会游荡；低/中/高 = 影响初始进化度与刷怪频率，且敌人仅在污染覆盖虫巢后发动进攻。</div>';
  ov.querySelector('.world-config-body').innerHTML = h;

  // 随机种子按钮
  const rnd = ov.querySelector('#wcfg-seed-random');
  if (rnd) rnd.addEventListener('click', function () {
    const inp = ov.querySelector('#wcfg-seed-input');
    if (inp) inp.value = (1 + Math.floor(Math.random() * 1e9));
  });
  // 选项切换
  const opts = ov.querySelectorAll('.wcfg-opt[data-key]');
  for (const b of opts) {
    b.addEventListener('click', function () {
      const key = b.getAttribute('data-key');
      ov.querySelectorAll('.wcfg-opt[data-key="' + key + '"]').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    });
  }
}

// 读取面板当前选择，合并进配置
function readWorldConfigFromPanel(body, cfg) {
  const out = Object.assign({}, normalizeWorldConfig(cfg));
  const seedInp = document.getElementById('wcfg-seed-input');
  const sv = seedInp ? parseInt(seedInp.value, 10) : 0;
  out.seed = (sv && isFinite(sv) && sv > 0) ? sv : 0;
  if (body) {
    const actives = body.querySelectorAll('.wcfg-opt.active');
    for (const a of actives) {
      const key = a.getAttribute('data-key');
      if (key) out[key] = a.getAttribute('data-val');
    }
  }
  return out;
}

// 生成最终 seed：配置 seed=0（随机）时返回一个随机数
function resolveWorldSeed() {
  const cfg = worldConfig();
  if (cfg.seed && cfg.seed > 0) return cfg.seed;
  return (Math.random() * 1e9) | 0;
}
