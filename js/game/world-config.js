'use strict';

// ===== 地图生成器配置（对齐《异星工厂》新游戏地图设置）=====
// 原版《异星工厂》在开始新游戏前允许玩家配置世界参数：
//   地图大小 / 资源（丰富度、频率、大小）/ 敌人强度 / 水等。
// 本项目据此新增「地图设置」面板，让玩家在开局前按需定制世界。
//
// 配置保存在 G.worldConfig（随存档持久化），并在 newGame()/genChunk() 中生效；
// 未配置时使用默认值，保持与原随机生成完全一致的旧行为，兼容旧存档。

// ============================================================
// 地图设置：全部来源于 data.generated.js（GAME_DATA.mapGen）
//   GAME_DATA.mapGen.autoplaceControls = 所有可调节的地图控件（自动从 factorio-data 提取），
//     每项含 { id, category(resource/terrain/cliff/enemy), order, richness, canBeDisabled, name:{zh,en} }
//   GAME_DATA.mapGen.presets = 官方预设（默认/富饶/铁路/末日等），含各自 autoplaceControls 覆盖
// 配置面板据此动态生成：每个控件对应 频率/大小/丰富度 三档（有 richness 的控件才有第三档）。
// ============================================================
// 三档可选项（对齐原版界面，取值即 data.generated.js 中控件/预设使用的等级字符串）
const AP_FREQUENCY_OPTIONS = [
  { v: 'none', name: '无' },
  { v: 'very-low', name: '极低' },
  { v: 'low', name: '低' },
  { v: 'normal', name: '中' },
  { v: 'high', name: '高' },
  { v: 'very-high', name: '极高' }
];
const AP_SIZE_OPTIONS = [
  { v: 'none', name: '无' },
  { v: 'very-small', name: '极小' },
  { v: 'small', name: '小' },
  { v: 'normal', name: '中' },
  { v: 'big', name: '大' },
  { v: 'very-big', name: '极大' }
];
const AP_RICHNESS_OPTIONS = [
  { v: 'none', name: '无' },
  { v: 'poor', name: '贫瘠' },
  { v: 'normal', name: '中' },
  { v: 'good', name: '良好' },
  { v: 'very-good', name: '富饶' }
];
// 等级字符串 → 数值倍率（用于 mapGen 里 preset 的字符串覆盖值 → 本项目实际倍率）
const AP_LEVEL_MULT = {
  // frequency
  'very-low': 0.5, 'low': 0.7, 'normal': 1, 'high': 1.4, 'very-high': 1.8,
  // size
  'very-small': 0.6, 'small': 0.8, 'big': 1.3, 'very-big': 1.6,
  // richness
  'poor': 0.55, 'good': 1.4, 'very-good': 1.9,
  'none': 0
};
// 当年老的全局档位名（low/normal/high）作为兜底倍率
const LEGACY_LEVEL_MULT = { low: 0.7, normal: 1, high: 1.4 };

// 配置结构（各字段取值见 *_OPTIONS）
function defaultWorldConfig() {
  return {
    seed: 0,                     // 世界种子，0 表示随机
    size: 'infinite',            // 地图大小
    preset: 'default',           // 官方预设 id（来自 GAME_DATA.mapGen.presets，默认"常规"）
    planet: 'nauvis',            // 起始星球（对齐《异星工厂》Space Age：新地星 Nauvis 为默认）
    // 每个 Autoplace 控件（resource/terrain/cliff/enemy）的细致设置
    // controls[id] = { frequency, size, richness }（均为等级字符串，见 AP_*_OPTIONS）
    controls: defaultControls(),
    // 兼容旧字段：读档时若旧存档只有全局档位，映射到所有资源控件，随后以新 controls 为准
    resourceRichness: 'normal',
    resourceFrequency: 'normal',
    resourceSize: 'normal',
    water: 'normal',
    enemy: 'normal',             // 敌人强度（none/peaceful/low/normal/high）
    cliff: 'on'
  };
}
// 依据 data.generated.js 的 autoplaceControls 生成每控件默认档位（全部"中"，有 richness 的给 richness:normal）
function defaultControls() {
  const out = {};
  const list = (typeof GAME_DATA !== 'undefined' && GAME_DATA.mapGen && GAME_DATA.mapGen.autoplaceControls) || [];
  for (const c of list) {
    const o = { frequency: 'normal', size: 'normal' };
    if (c.richness) o.richness = 'normal';
    out[c.id] = o;
  }
  return out;
}
// 默认配置单例：保证 worldConfig() 在未设置时返回同一引用，避免缓存永不命中的递归/重建
const DEFAULT_WC = defaultWorldConfig();

// 地图大小 / 敌人 全局选项（沿用旧档位，仅这两项在面板上用带语义的全局档）
const WORLD_SIZE_OPTIONS = [
  { v: 'small',    name: '小' },
  { v: 'medium',   name: '中' },
  { v: 'large',    name: '大' },
  { v: 'infinite', name: '无限' }
];
const WORLD_ENEMY_OPTIONS = [
  { v: 'none',     name: '无' },
  { v: 'peaceful', name: '和平' },
  { v: 'low',      name: '低' },
  { v: 'normal',   name: '中' },
  { v: 'high',     name: '高' }
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
// 行星专属矿藏：tungsten（祝融星）/ holmium（雷神星）为太空时代天然矿脉（官方）。
// 仅在其母星丰度 >0 时自然生成；其余星球为 0（不生成），仍可经合成配方获得。
const PLANET_RESOURCES = {
  nauvis:   { iron: 1,   copper: 1,   coal: 1,   stone: 1,   uranium: 1,   oil: 1,   asteroid: 1,  water: 1, tungsten: 0, holmium: 0 },
  vulcanus: { iron: 1.4, copper: 1.4, coal: 0.4, stone: 1.5, uranium: 0,   oil: 0,   asteroid: 1,  water: 0, tungsten: 1.4, holmium: 0 },
  gleba:    { iron: 0,   copper: 0,   coal: 0,   stone: 1.2, uranium: 0,   oil: 0,   asteroid: 1,  water: 1.5, tungsten: 0, holmium: 0 },
  fulgora:  { iron: 0.2, copper: 0.2, coal: 0,   stone: 1,   uranium: 1.6, oil: 0,   asteroid: 1.4, water: 0, tungsten: 0, holmium: 1.6 },
  aquilo:   { iron: 0.5, copper: 0.5, coal: 1.2, stone: 1.2, uranium: 0,   oil: 1,   asteroid: 1.5, water: 1, tungsten: 0, holmium: 0 }
};


// 归一化：确保配置对象字段完整、取值合法（旧存档/外部传入可能缺字段）
// 注意：新格式以 per-control 的 controls[id] 为准；旧存档仅有全局档位（resourceFrequency 等）
// 时，将其映射为对所有资源控件生效，随后以新 controls 覆盖，保证旧档无缝升级。
function normalizeWorldConfig(c) {
  const d = defaultWorldConfig();
  if (!c || typeof c !== 'object') return d;
  // 1) 基础标量
  const out = Object.assign({}, d);
  out.seed = (typeof c.seed === 'number' && isFinite(c.seed) && c.seed > 0) ? c.seed : 0;
  out.size = WORLD_SIZE_OPTIONS.some(o => o.v === c.size) ? c.size : d.size;
  out.planet = PLANET_OPTIONS.some(o => o.v === c.planet) ? c.planet : d.planet;
  out.enemy = WORLD_ENEMY_OPTIONS.some(o => o.v === c.enemy) ? c.enemy : d.enemy;
  out.cliff = (c.cliff === 'off') ? 'off' : d.cliff;
  out.preset = isValidPreset(c.preset) ? c.preset : d.preset;

  // 2) 逐控件 controls[id] = { frequency, size, richness }
  //    先用旧全局档位兜底缩放默认值（无旧档 → 保持默认"中"），再叠加新 controls 精确覆盖。
  const legacy = {
    frequency: AP_LEVEL_MULT[c.resourceFrequency] != null ? c.resourceFrequency : LEGACY_LEVEL_MULT[c.resourceFrequency] || null,
    size: AP_LEVEL_MULT[c.resourceSize] != null ? c.resourceSize : LEGACY_LEVEL_MULT[c.resourceSize] || null,
    richness: (c.resourceRichness === 'low' || c.resourceRichness === 'high') ? c.resourceRichness : null
  };
  const fresh = defaultControls();
  for (const id in fresh) {
    const def = fresh[id];
    const cur = (c.controls && typeof c.controls === 'object' && c.controls[id]) ? c.controls[id] : {};
    const pick = (field) =>
      validLevel(field, cur[field] != null ? cur[field] : legacy[field]) ||
      validLevel(field, legacy[field]) ||
      validLevel(field, def[field]) ||
      'none';
    const o = { frequency: pick('frequency'), size: pick('size') };
    if (def.richness) o.richness = pick('richness');
    fresh[id] = o;
  }
  out.controls = fresh;
  return out;
}
// 等级字符串是否为该维度合法取值
function validLevel(field, v) {
  if (v == null) return null;
  const pool = field === 'frequency' ? AP_FREQUENCY_OPTIONS
    : field === 'size' ? AP_SIZE_OPTIONS : AP_RICHNESS_OPTIONS;
  return pool.some(o => o.v === v) ? v : null;
}
// controls[id] 某维度倍率（供 world.js 按控件读取；缺省/无控件 → 1）
function controlMult(id, field) {
  const cfg = worldConfig();
  const cur = cfg.controls && cfg.controls[id];
  let v = cur && cur[field];
  let m = AP_LEVEL_MULT[v];
  if (m == null) m = LEGACY_LEVEL_MULT[v];
  if (m == null) return 1;
  return m;
}
// 控件 id 对应的控件定义（来自 data.generated.js）；未知 → null
function autoplaceControl(id) {
  if (typeof GAME_DATA === 'undefined' || !GAME_DATA.mapGen) return null;
  const list = GAME_DATA.mapGen.autoplaceControls || [];
  for (const c of list) if (c.id === id) return c;
  return null;
}
// 该控件当前是否已关闭（frequency 或 size 为 none / 无 → false）
function controlDisabled(id) {
  const cfg = worldConfig();
  const cur = cfg.controls && cfg.controls[id];
  return !cur || (cur.frequency === 'none' && cur.size === 'none' && (cur.richness || 'normal') === 'none');
}
// 控件 id 的本地化显示名（data.generated.js 官方命名）
function autoplaceControlName(id) {
  const c = autoplaceControl(id);
  if (c && c.name && typeof localizedName === 'function') {
    const t = localizedName(LOCALE_ZH_KEY === undefined || !(LOCALE_KEY && localeKey() === 'en') ? c.name.zh : c.name.en);
  }
  return (c && c.name) ? c.name.zh : id;
}
const LOCALE_ZH_KEY = 'zh';
// 官方预设是否存在
function isValidPreset(id) {
  if (typeof GAME_DATA === 'undefined' || !GAME_DATA.mapGen) return id === 'default';
  const list = GAME_DATA.mapGen.presets || [];
  return !!list.find(p => p.id === id);
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
    _wcf = {
      richness: richnessMult0(),
      frequency: frequencyMult0(),
      size: sizeMult0(),
      water: waterBias0(),
      enemy: enemyConfig0(),
      cliff: cliffOn0(),
      // precompute all per-control mults into cache to avoid repeated string lookups during generation
      controls: controlCache(),
    };
  }
  return _wcCache;
}
// 预计算所有控件当前倍率到缓存（_wcf.controls[id] = { freqMult, sizeMult, richMult }）
function controlCache() {
  const cfg = worldConfig();
  const out = {};
  if (!cfg || !cfg.controls) return out;
  for (const [id, c] of Object.entries(cfg.controls)) {
    out[id] = {
      freq: typeof AP_LEVEL_MULT[c.frequency] === 'number' ? AP_LEVEL_MULT[c.frequency] : 1,
      size: typeof AP_LEVEL_MULT[c.size] === 'number' ? AP_LEVEL_MULT[c.size] : 1,
      rich: c.richness != null && typeof AP_LEVEL_MULT[c.richness] === 'number' ? AP_LEVEL_MULT[c.richness] : 1,
    };
  }
  return out;
}
// 控件倍率快速查询（如果缓存已有）
function cachedControlMult(id, key) {
  if (!_wcf || !_wcf.controls || !_wcf.controls[id]) return 1;
  return _wcf.controls[id][key] || 1;
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
// 这些全局兜底倍率用于 world.js 中并非逐资源生成的环节（矿区整体密度），
// 以及旧档没有 controls 时的 fallback。逐资源的实际倍率见 controlMult(id, field)。
function richnessMult0() {
  const c = cachedControlMult('iron-ore', 'rich');
  return c !== 1 ? c : controlMult('iron-ore', 'richness');
}
function frequencyMult0() {
  const c = cachedControlMult('iron-ore', 'freq');
  return c !== 1 ? c : controlMult('iron-ore', 'frequency');
}
function sizeMult0() {
  const c = cachedControlMult('iron-ore', 'size');
  return c !== 1 ? c : controlMult('iron-ore', 'size');
}
function waterBias0() {
  // 水频率：由 "water" 控件频率档位换算成湖水密度偏置
  const m = controlMult('water', 'frequency');
  const map = { 0: -100, 0.5: -0.004, 0.7: -0.002, 1: 0, 1.4: 0.002, 1.8: 0.004 };
  const b = map[m];
  return b != null ? b : 0;
}
function cliffOn0() {
  return !controlDisabled('nauvis_cliff') && worldConfig().cliff !== 'off';
}
function enemyConfig0() {
  const v = worldConfig().enemy;
  // 敌人控件（enemy-base）频率档位缩放刷怪
  const eb = controlMult('enemy-base', 'frequency');
  const ebSz = controlMult('enemy-base', 'size');
  if (controlDisabled('enemy-base')) return { none: true, peaceful: true, initEvolution: 0, spawnMult: 0 };
  if (v === 'none' || eb <= 0) return { none: true, peaceful: true, initEvolution: 0, spawnMult: 0 };
  // 和平模式：敌人存在并在虫巢周围游荡，但永不主动攻击（由 isEnemyAggressive 保证）
  if (v === 'peaceful') return { peaceful: true, initEvolution: 0, spawnMult: eb * ebSz };
  if (v === 'low') return { peaceful: false, initEvolution: 0.1 * ebSz, spawnMult: 0.55 * eb };
  if (v === 'high') return { peaceful: false, initEvolution: 0.5 * ebSz, spawnMult: 2.1 * eb };
  return { peaceful: false, initEvolution: 0, spawnMult: eb * ebSz };
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
// 面板内容完全由 data.generated.js（GAME_DATA.mapGen）驱动：
//   - 官方预设（presets）一键套用
//   - 每个 Autoplace 控件（resource/terrain/cliff/enemy）的三档选择
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
  // 控件所在分类的本地化名（Factorio map-gen UI 分组）
  const CAT_NAMES = { resource: '资源', terrain: '地形', cliff: '峭壁', enemy: '敌人' };

  // ---- 官方预设下拉（data.generated.js）----
  let presetsHtml = '';
  const presetList = (typeof GAME_DATA !== 'undefined' && GAME_DATA.mapGen && GAME_DATA.mapGen.presets) || [];
  presetsHtml += '<div class="wcfg-ctrl-group"><div class="wcfg-group-title">🎛 官方预设</div>' +
    '<div class="wcfg-preset-row">';
  for (const p of presetList) {
    presetsHtml += '<button type="button" class="wcfg-preset' + (p.id === cfg.preset ? ' active' : '') + '" data-preset="' + p.id + '">' +
      (p.name && p.name.zh ? p.name.zh : p.id) + '</button>';
  }
  presetsHtml += '</div><div class="dim wcfg-desc" id="wcfg-preset-desc">选择预设可一键套用官方资源配置。</div></div>';

  // ---- 基础标量：种子 / 大小 / 星球----
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
  h += seg('起始星球', PLANET_OPTIONS, cfg.planet, 'planet') + presetsHtml;

  // ---- 逐控件设置（data.generated.js autoplaceControls，按 category 分组）----
  const all = (typeof GAME_DATA !== 'undefined' && GAME_DATA.mapGen && GAME_DATA.mapGen.autoplaceControls) ? GAME_DATA.mapGen.autoplaceControls.slice() : [];
  // 仅保留当前星球相关控件 + 通用控件，并按 category 分组
  const groupByCat = {};
  for (const c of all) {
    (groupByCat[c.category] = groupByCat[c.category] || []).push(c);
  }
  // 三维维度的显示名与选项
  const axisMeta = {
    frequency: { label: '频率', opts: AP_FREQUENCY_OPTIONS },
    size: { label: '大小', opts: AP_SIZE_OPTIONS },
    richness: { label: '丰富度', opts: AP_RICHNESS_OPTIONS }
  };
  const catOrder = ['resource', 'terrain', 'cliff', 'enemy'];
  for (const cat of catOrder) {
    const list = groupByCat[cat];
    if (!list || !list.length) continue;
    h += '<div class="wcfg-ctrl-group"><div class="wcfg-group-title">' + (CAT_NAMES[cat] || cat) + '</div>';
    for (const c of list) {
      const name = (c.name && c.name.zh) ? c.name.zh : c.id;
      const ctl = cfg.controls && cfg.controls[c.id] ? cfg.controls[c.id] : { frequency: 'normal', size: 'normal' };
      h += '<div class="wcfg-ctrl">' +
        '<div class="wcfg-ctrl-name">' + name + '</div>' +
        '<div class="wcfg-ctrl-opts">';
      for (const axis of ['frequency', 'size', 'richness']) {
        if (axis === 'richness' && !c.richness) continue;
        const meta = axisMeta[axis];
        h += '<span class="wcfg-axis-label">' + meta.label + '</span>';
        for (const o of meta.opts) {
          h += '<button type="button" class="wcfg-opt wcfg-axis' + (o.v === ctl[axis] ? ' active' : '') + '" data-ctrl="' + c.id + '" data-axis="' + axis + '" data-val="' + o.v + '">' + o.name + '</button>';
        }
        h += '<span class="wcfg-axis-sep"></span>';
      }
      h += '</div></div>';
    }
    h += '</div>';
  }

  // ---- 敌人强度 / 峭壁（全局开关，对齐原版）----
  h += seg('敌人强度', WORLD_ENEMY_OPTIONS, cfg.enemy, 'enemy');
  h += '<div class="dim wcfg-desc">无 = 完全没有敌人；和平 = 敌人存在但不主动攻击；低/中/高与「敌人」控件共同决定刷怪与初始进化度。</div>';
  h += seg('峭壁', [ { v: 'on', name: '开启' }, { v: 'off', name: '关闭' } ], cfg.cliff, 'cliff');
  h += '<div class="dim wcfg-desc">默认开启生成峭壁山脊；关闭则整个世界无峭壁，也可在「峭壁」分组下调低或关闭 nauvis_cliff 控件。</div>';

  ov.querySelector('.world-config-body').innerHTML = h;

  // ---- 交互绑定 ----
  // 随机种子
  const rnd = ov.querySelector('#wcfg-seed-random');
  if (rnd) rnd.addEventListener('click', function () {
    const inp = ov.querySelector('#wcfg-seed-input');
    if (inp) inp.value = (1 + Math.floor(Math.random() * 1e9));
  });
  // 一般选项切换（data-key 简单标量）
  const opts = ov.querySelectorAll('.wcfg-opt[data-key]');
  for (const b of opts) {
    b.addEventListener('click', function () {
      const key = b.getAttribute('data-key');
      ov.querySelectorAll('.wcfg-opt[data-key="' + key + '"]').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    });
  }
  // 逐控件三档切换（data-ctrl / data-axis）→ 写入 cfg.controls 内存对象，确认时一并保存
  const axisBtns = ov.querySelectorAll('.wcfg-opt[data-ctrl]');
  for (const b of axisBtns) {
    b.addEventListener('click', function () {
      const id = b.getAttribute('data-ctrl');
      const axis = b.getAttribute('data-axis');
      const val = b.getAttribute('data-val');
      if (!cfg.controls[id]) cfg.controls[id] = { frequency: 'normal', size: 'normal' };
      cfg.controls[id][axis] = val;
      ov.querySelectorAll('.wcfg-opt[data-ctrl="' + id + '"][data-axis="' + axis + '"]').forEach(x => x.classList.remove('active'));
      b.classList.add('active');
    });
  }
  // 官方预设一键套用（覆盖 cfg.controls + cfg.preset，并联动高亮）
  const presetBtns = ov.querySelectorAll('.wcfg-preset');
  for (const b of presetBtns) {
    b.addEventListener('click', function () {
      const pid = b.getAttribute('data-preset');
      applyPresetToConfig(cfg, pid, true);
      presetBtns.forEach(x => x.classList.remove('active'));
      b.classList.add('active');
      // 同步控件按钮高亮
      syncControlHighlight(ov, cfg);
      const pd = ov.querySelector('#wcfg-preset-desc');
      if (pd) {
        const p = findPreset(pid);
        pd.textContent = (p && p.desc && p.desc.zh) ? p.desc.zh : '';
      }
    });
  }
  // 加载完成后若当前非默认预设，同步控件高亮
  if (cfg.preset !== 'default') syncControlHighlight(ov, cfg);
}

// 把预设的 autoplaceControls 覆盖应用到 cfg.controls（预设值多为等级字符串，另有数值型）
function applyPresetToConfig(cfg, presetId, markPreset) {
  const p = findPreset(presetId);
  if (markPreset) cfg.preset = presetId;
  if (!p || !p.autoplaceControls) {
    // preset 无覆盖（default）→ 恢复默认控件
    const def = defaultControls();
    cfg.controls = def;
    return;
  }
  const base = defaultControls();
  for (const [id, vals] of Object.entries(p.autoplaceControls)) {
    if (!base[id]) continue;
    if (!cfg.controls[id]) cfg.controls[id] = { frequency: 'normal', size: 'normal' };
    const o = cfg.controls[id];
    // 将预设覆盖值（字符串等级或数值）转为控件档位
    for (const axis of ['frequency', 'size', 'richness']) {
      if (vals[axis] == null) continue;
      o[axis] = normalizePresetVal(vals[axis]);
    }
  }
}
// 官方预设覆盖值 → 控件档位字符串（数值型按乘数映射到最接近档位）
function normalizePresetVal(v) {
  if (typeof v === 'string') return v;      // very-high / very-good / very-big 等直接使用
  if (typeof v === 'number') {
    if (v <= 0.2) return 'none';
    if (v < 0.7) return 'low';
    if (v > 1.3) return 'high';
    return 'normal';
  }
  return 'normal';
}
function findPreset(id) {
  if (typeof GAME_DATA === 'undefined' || !GAME_DATA.mapGen) return null;
  const list = GAME_DATA.mapGen.presets || [];
  for (const p of list) if (p.id === id) return p;
  return null;
}
// 依据 cfg.controls 同步面板上控件按钮的高亮
function syncControlHighlight(ov, cfg) {
  if (!ov) return;
  const btns = ov.querySelectorAll('.wcfg-opt[data-ctrl]');
  for (const b of btns) {
    const id = b.getAttribute('data-ctrl');
    const axis = b.getAttribute('data-axis');
    const ctl = cfg.controls && cfg.controls[id] ? cfg.controls[id] : {};
    b.classList.toggle('active', b.getAttribute('data-val') === ctl[axis]);
  }
}

// 读取面板当前选择，合并进配置
function readWorldConfigFromPanel(body, cfg) {
  const out = Object.assign({}, normalizeWorldConfig(cfg));
  const seedInp = document.getElementById('wcfg-seed-input');
  const sv = seedInp ? parseInt(seedInp.value, 10) : 0;
  out.seed = (sv && isFinite(sv) && sv > 0) ? sv : 0;
  if (body) {
    // data-key 简单标量（size / planet / enemy / cliff）
    const actives = body.querySelectorAll('.wcfg-opt.active[data-key]');
    for (const a of actives) {
      const key = a.getAttribute('data-key');
      if (key) out[key] = a.getAttribute('data-val');
    }
  }
  // controls 已在点击时写入 cfg.controls，此处纳入
  out.controls = cfg.controls || defaultControls();
  out.preset = cfg.preset || 'default';
  return out;
}

// 生成最终 seed：配置 seed=0（随机）时返回一个随机数
function resolveWorldSeed() {
  const cfg = worldConfig();
  if (cfg.seed && cfg.seed > 0) return cfg.seed;
  return (Math.random() * 1e9) | 0;
}

// ===== 行星专属生产建筑（对齐《异星工厂》Space Age：星球专属建筑只能在对应星球建造）=====
// 官方每个星球拥有专属生产建筑（见 factorio-data 各建筑 prototypes 的 planet 字段）：
//   - 祝融星 Vulcanus：铸造厂 foundry
//   - 雷神星 Fulgora：电磁工厂 electromagnetic-plant
//   - 句芒星 Gleba：生化炉 biochamber、农业塔 agricultural-tower
//   - 玄冥星 Aquilo：低温工厂 cryogenic-plant
// 项目未实现行星专属的其它建筑（破碎机 crusher / 回收机 recycler / 生物实验室 biolab 等）
// 按适配设计可在任意星球建造，不在此限制，避免破坏既有玩法。
const PLANET_BUILDINGS = {
  'foundry': 'vulcanus',
  'electromagnetic-plant': 'fulgora',
  'biochamber': 'gleba',
  'agricultural-tower': 'gleba',
  'cryogenic-plant': 'aquilo'
};
// 某建筑是否受行星限制；未列出的建筑返回 null（任意星球可建造）。
// 返回 { planet } 表示只能在指定星球建造；返回 null 表示不限制。
function buildingRequiredPlanet(type) {
  return PLANET_BUILDINGS[type] ? { planet: PLANET_BUILDINGS[type] } : null;
}
// 当前星球是否允许建造该建筑（无限制→true；有限制→当前星球是否为对应星球）
function canBuildOnCurrentPlanet(type) {
  const r = buildingRequiredPlanet(type);
  if (!r) return true;
  return planetId() === r.planet;
}
