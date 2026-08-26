'use strict';

// ===== 科技解锁要求（建造/武器/模块）=====
// 物品 -> 所需已完成科技 id。缺少科技时建造/使用会被拦截并提示。
const TECH_REQ = {
  'tank': 'military3',
  'cannon-shell': 'military3',
  'heavy-armor': 'military3',
  'spidertron': 'military4',
  'spidertron-remote': 'military4',   // 蜘蛛遥控器需军事科技 IV
  'land-mine': 'land-mine',
  'artillery-turret': 'military4',
  'artillery-shell': 'military4',
  'artillery-wagon': 'military4',
  'laser-turret': 'laser-turrets',
  'flamethrower-turret': 'flamethrower',
  'rocket-launcher': 'military2',
  'flamethrower': 'flamethrower',
  'explosive-rocket-launcher': 'explosives',
  'destroyer-capsule': 'advanced-combat',
  'defender-capsule': 'weapons',
  'distractor-capsule': 'weapons',
  // 终局战斗弹药与胶囊（对齐《异星工厂》）：铀弹需核能科技（铀-238 依赖），毒/减速胶囊与火焰弹药需高级战斗
  'uranium-rounds-magazine': 'uranium-ammo',
  'atomic-bomb': 'atomic-bomb',   // 原子弹需独立「原子弹科技」（对齐原版，需核能+火箭基础上进阶研究）
  'uranium-cannon-shell': 'uranium-ammo',
  'poison-capsule': 'advanced-combat',
  'slowdown-capsule': 'advanced-combat',
  'flamethrower-ammo': 'flamethrower',
  'rocket-silo': 'rocket-science',
  'rocket': 'rocket-science',
  'satellite': 'rocket-science',
  'rocket-control-unit': 'rocket-science',
  'rocket-fuel': 'rocket-science',
  'speed-module': 'modules',
  'productivity-module': 'modules',
  'efficiency-module': 'advanced-material-processing',
  'speed-module-2': 'modules2',
  'speed-module-3': 'modules3',
  'productivity-module-2': 'modules2',
  'productivity-module-3': 'modules3',
  'efficiency-module-2': 'advanced-material-processing-2',
  'efficiency-module-3': 'advanced-material-processing-3',
  'advanced-circuit': 'advanced-electronics',
  'sulfur': 'sulfur-processing',
  'sulfuric-acid': 'sulfur-processing',
  'processing-unit': 'advanced-electronics-2',
  'electric-engine-unit': 'electric-engine-unit',
  'radar': 'radar',
  'gate': 'military',
  'production-science-pack': 'production',
  'beacon': 'production',
  'utility-science-pack': 'utility',
  'flying-robot-frame': 'utility',
  'construction-robot': 'utility',
  'personal-roboport-equipment': 'utility',
  'personal-roboport-mk2-equipment': 'armor-power-mk2',
  // ===== 模块化护甲与个人装备科技门控 =====
  'modular-armor': 'armor-modular',
  'power-armor': 'armor-power',
  'power-armor-mk2': 'armor-power-mk2',
  'solar-panel-equipment': 'armor-modular',
  'portable-solar-panel-mk2': 'armor-modular',
  'battery-equipment': 'armor-modular',
  'battery-mk2-equipment': 'armor-modular',
  'exoskeleton-equipment': 'armor-power',
  'night-vision-equipment': 'armor-modular',
  'personal-laser-defense-equipment': 'armor-power',
  'fusion-reactor-equipment': 'armor-power-mk2',
  // 能量护盾：I 型需强力装甲科技，II 型需终极强力装甲 II 科技（对齐《异星工厂》Energy shield 科技线）
  'energy-shield-equipment': 'armor-power',
  'energy-shield-mk2-equipment': 'armor-power-mk2',
  // 传送带免疫/放电防御装备科技门控（对齐《异星工厂》装备科技线）
  'belt-immunity-equipment': 'armor-modular',
  'discharge-defense-equipment': 'armor-power',
  // ===== 组装机 / 集装箱机械臂科技门控（对齐《异星工厂》Automation 3 / Logistics 3） =====
  'assembling-machine-3': 'automation3',
  'bulk-inserter': 'logistics3',
  // ===== 机械臂进阶科技门控（对齐《异星工厂》科技树） =====
  // 原版：高速机械臂需「自动化 II」；加长机械臂需「物流 II」。
  // 此前这两类机械臂开局即可用，现改为对应科技解锁，让物流/自动化节奏更贴近原版进阶曲线（旧档经迁移自动补完）。
  'fast-inserter': 'automation2',
  'long-handed-inserter': 'logistics2',
  // ===== 基础中间件科技门控（对齐《异星工厂》科技树） =====
  'engine-unit': 'engine',          // 引擎单元：需「引擎技术」科技（对齐原版 Engine）
  'battery': 'battery',                // 电池：需「电池技术」科技（对齐原版 Battery）
  'plastic-bar': 'plastic',           // 塑料板：需「塑料合成」科技（对齐原版 Plastics）
  'low-density-structure': 'rocket-science', // 低密度结构：需「火箭技术」（对齐原版 Rocket science）
  'fishing-pole': 'fishing',            // 钓鱼竿：需「钓鱼」科技（对齐原版 Fishing）
  'solid-fuel': 'oil',               // 固体燃料：需「石油冶金」（对齐原版 Oil processing）
  // ===== 补齐官方缺失科技门控（对齐《异星工厂》科技树） =====
  'steel-axe': 'steel-axe',            // 钢斧：需「钢斧」科技（对齐原版 Steel axe）
  'concrete': 'concrete',              // 混凝土：需「混凝土」科技（对齐原版 Concrete）
  'refined-concrete': 'concrete',      // 精炼混凝土：需「混凝土」科技
  'hazard-concrete': 'concrete',       // 警示混凝土：需「混凝土」科技
  'landfill': 'landfill'               // 填海料：需「填海」科技（对齐原版 Landfill）
};
// ===== 核能科技门控 =====
for (const id of ['centrifuge', 'nuclear-reactor', 'steam-turbine', 'heat-pipe', 'heat-exchanger', 'uranium-235', 'uranium-238', 'nuclear-fuel', 'uranium-fuel-cell']) {
  if (!TECH_REQ[id]) TECH_REQ[id] = 'nuclear';
}
// ===== 补齐原版科技门控（对齐《异星工厂》科技树） =====
// 太阳能/蓄电器：太阳能板与蓄电器需蓝瓶科技解锁（对齐《异星工厂》Solar energy / Electric energy accumulators）
TECH_REQ['solar-panel'] = 'solar-energy';
TECH_REQ['accumulator'] = 'electric-energy-accumulators';
// 炼钢：钢炉与钢箱需炼钢科技解锁（对齐《异星工厂》Steel processing）
TECH_REQ['steel-furnace'] = 'steel-processing';
TECH_REQ['steel-chest'] = 'steel-processing';
// 地下管道：地下管道与流体泵需地下管道科技解锁（对齐《异星工厂》Fluid handling）
TECH_REQ['pipe-to-ground'] = 'fluid-handling';
TECH_REQ['pump'] = 'fluid-handling';
// 战斗机器人：三种战斗机器人胶囊需战斗机器人科技解锁（对齐《异星工厂》Combat robotics）
for (const id of ['defender-capsule', 'distractor-capsule', 'destroyer-capsule']) TECH_REQ[id] = 'combat-robotics';
// ===== 流体桶装科技门控（对齐《异星工厂》：桶装需流体处理科技） =====
TECH_REQ['barrel'] = 'barrel';
for (const f of BARREL_FLUIDS) TECH_REQ[f + '-barrel'] = 'barrel';
// ===== 铁路科技门控 =====
const RAIL_ITEMS = ['rail', 'locomotive', 'cargo-wagon', 'train-stop', 'fluid-wagon', 'diesel-locomotive'];
for (const id of RAIL_ITEMS) if (!TECH_REQ[id]) TECH_REQ[id] = 'railways';
// 内燃机车需处理单元（电子学），故需铁路技术+电子学双重前置（对齐原版：内燃机车需进阶电子科技）
TECH_REQ['diesel-locomotive'] = 'railways'; // 基础解锁为 railways，额外电子学前置由配方所用材料自动约束
if (!TECH_REQ['rail-signal']) TECH_REQ['rail-signal'] = 'rail-signals';
if (!TECH_REQ['rail-chain-signal']) TECH_REQ['rail-chain-signal'] = 'rail-signals';
// ===== 物流机器人网络 =====
const LOGISTIC_ITEMS = ['roboport', 'logistic-robot', 'passive-provider-chest', 'active-provider-chest', 'storage-chest', 'requester-chest', 'buffer-chest'];
// 物流箱科技门控：所有物流设备需先研究「物流网络」
for (const id of LOGISTIC_ITEMS) if (!TECH_REQ[id]) TECH_REQ[id] = 'logistics-network';
// ===== 电路网络科技门控 =====
const CIRCUIT_ITEMS = ['small-electric-pole', 'medium-electric-pole', 'big-electric-pole', 'constant-combinator', 'arithmetic-combinator', 'decider-combinator', 'substation', 'programmable-speaker', 'power-switch', 'red-wire', 'green-wire'];
for (const id of CIRCUIT_ITEMS) if (!TECH_REQ[id]) TECH_REQ[id] = 'circuit-network';
// 电灯：需电力工程科技解锁（对齐《异星工厂》灯由电力工程解锁）
TECH_REQ['small-lamp'] = 'electric';
// 玩家武器所需科技（用于选择武器时拦截）
const WEAPON_TECH_REQ = {
  'atomic-bomb': 'atomic-bomb',   // 原子弹需独立「原子弹科技」
  'pistol': 'weapons',
  'submachine-gun': 'weapons',
  'shotgun': 'weapons',
  'combat-shotgun': 'military2',
  'rocket-launcher': 'military2',
  'explosive-rocket-launcher': 'explosives',
  'flamethrower': 'flamethrower'
};
// 弹药/投掷物科技门控：散弹枪弹由武器科技解锁，穿甲散弹枪弹与集束手雷由高级战斗解锁
TECH_REQ['shotgun-shell'] = 'weapons';
TECH_REQ['piercing-shotgun-shell'] = 'military2';
TECH_REQ['cluster-grenade'] = 'cluster-grenade';
// 爆炸火箭弹/爆炸火箭筒：研究「爆炸物科技」后解锁（对齐《异星工厂》Explosive rocket 独立科技）
TECH_REQ['explosive-rocket'] = 'explosives';
TECH_REQ['explosive-rocket-launcher'] = 'explosives';
// 峭壁炸药：研究「爆炸物科技」后解锁（对齐《异星工厂》Cliff explosives 需爆炸物科技）
TECH_REQ['cliff-explosives'] = 'explosives';
// 爆炸炮弹 / 铀爆炸炮弹：需爆炸物科技解锁（对齐《异星工厂》：爆炸炮弹由爆炸物科技与核能科技门控）
TECH_REQ['explosive-cannon-shell'] = 'explosives';
TECH_REQ['explosive-uranium-cannon-shell'] = 'nuclear';

// ===== 配方按科技解锁（对齐《异星工厂》科技树门控）=====
// 统一查询物品所需科技：优先 TECH_REQ（建造门控），再查武器科技门控。
function itemTechReq(id) { return TECH_REQ[id] || WEAPON_TECH_REQ[id] || null; }

// ===== 模块变体表与当量统计（对齐《异星工厂》模块 1-3 级） =====
// 每个模块 id -> 等级(1/2/3) 与效果类型。当量用于折算速度/产能/效率加成。
const MODULE_VARIANTS = {
  'speed-module':         { tier: 1, type: 'speed', speed: 1,  power: 0.5 },
  'speed-module-2':       { tier: 2, type: 'speed', speed: 2,  power: 0.8 },
  'speed-module-3':       { tier: 3, type: 'speed', speed: 3,  power: 1.2 },
  'productivity-module':  { tier: 1, type: 'prod',  prod: 1,   power: 0.5, prodThreshold: 30 },
  'productivity-module-2':{ tier: 2, type: 'prod',  prod: 1.5, power: 0.8, prodThreshold: 20 },
  'productivity-module-3':{ tier: 3, type: 'prod',  prod: 2,   power: 1.2, prodThreshold: 15 },
  'efficiency-module':    { tier: 1, type: 'eff',   eff: 1,   power: 0 },
  'efficiency-module-2':  { tier: 2, type: 'eff',   eff: 1.5, power: 0 },
  'efficiency-module-3':  { tier: 3, type: 'eff',   eff: 2,   power: 0 }
};
function isModule(id) { return !!MODULE_VARIANTS[id]; }
function moduleType(id) { const v = MODULE_VARIANTS[id]; return v ? v.type : null; }
// 统计某设备 modules 表中速度/产能/效率模块的加权当量。
// modules 形如 { 'speed-module': 2, 'productivity-module-2': 1, ... }
function moduleCounts(modules) {
  let speed = 0, prod = 0, eff = 0;
  if (!modules) return { speed, prod, eff };
  for (const id in modules) {
    const v = MODULE_VARIANTS[id];
    if (!v) continue;
    const n = modules[id] || 0;
    if (v.type === 'speed') speed += v.speed * n;
    else if (v.type === 'prod') prod += v.prod * n;
    else if (v.type === 'eff') eff += v.eff * n;
  }
  return { speed, prod, eff };
}
// 模块污染影响标签（对齐《异星工厂》：速度/产能模块增污、效率模块减污）。
// 供模块面板展示；与 pollution.js 的 modulePollutionMult 使用相同系数保持口径一致。
function modulePollutionLabel(speed, prod, eff) {
  const delta = speed * 0.5 + prod * 0.6 - eff * 0.3;
  if (delta > 0) return '+' + delta.toFixed(1);
  return delta.toFixed(1);
}
// 产能模块累计产出阈值：根据模块等级取最低阈值（更高等级阈值更小 → 产出更快）
function moduleProdThreshold(modules) {
  let minT = 30;
  if (!modules) return minT;
  for (const id in modules) {
    const v = MODULE_VARIANTS[id];
    if (v && v.type === 'prod' && (modules[id] || 0) > 0 && v.prodThreshold < minT) minT = v.prodThreshold;
  }
  return minT;
}
// 生产建筑模块槽位面板区块（对齐《异星工厂》：电炉/炼油厂/化工厂/离心机等可装模块）。
// 生成「模块」行 + 各等级模块装入按钮 + 取出全部模块按钮。依赖 e.moduleSlotCount()、e.modules。
function modulePanelSection(e) {
  const slot = (typeof e.moduleSlotCount === 'function') ? e.moduleSlotCount() : 4;
  const mc = moduleCounts(e.modules);
  const hasMod = Object.keys(e.modules).length > 0;
  let h = row('模块', hasMod ? '速度+' + mc.speed.toFixed(1) + ' 产能+' + mc.prod.toFixed(1) + ' 效率-' + mc.eff.toFixed(1) + ' 污染' + modulePollutionLabel(mc.speed, mc.prod, mc.eff) : '<span class="dim">无</span>', 'mod');
  for (const mid of Object.keys(e.modules)) if ((e.modules[mid] || 0) > 0) h += '<span class="dim">' + ITEMS[mid].name + ' x' + e.modules[mid] + '</span> ';
  const order = ['speed-module', 'speed-module-2', 'speed-module-3', 'productivity-module', 'productivity-module-2', 'productivity-module-3', 'efficiency-module', 'efficiency-module-2', 'efficiency-module-3'];
  for (const mid of order) {
    if (!itemUnlocked(mid)) continue;
    const n = Math.min(invCount(mid), slot - (e.modules[mid] || 0));
    if (n > 0) h += '<button data-action="feed" data-id="' + mid + '">装入' + ITEMS[mid].name + ' x' + n + '</button>';
  }
  if (hasMod) h += '<button data-action="takein" data-modules="1">取出全部模块</button>';
  return h;
}
// 某物品是否已由科技解锁（无科技需求 = 开局可用；否则需对应科技已研究）
function itemUnlocked(id) {
  const tr = itemTechReq(id);
  if (!tr) return true;
  const anyList = RECIPE_TECH_ANY[tr];
  if (anyList) return anyList.some(t => !!G.techDone[t]);
  return !!(G.techDone[tr]);
}
// 配方是否已解锁：产出物（主输出）未被科技门控，或对应科技已研究。
// 用于手搓面板与各生产设备（组装机/化工厂/炼油厂/离心机）配方选择列表的解锁判断。
// ===== 配方级科技门控（对齐《异星工厂》科技树颗粒度）=====
// 部分配方的产出物为流体（炼油/裂解/富集），无法仅凭"产出物科技"区分解锁节奏，
// 需单独指定所需科技。此项优先于产出物判断，让原版独立科技形成各自进阶解锁节奏。
const RECIPE_TECH = {
  'advanced-oil': 'advanced-oil-processing',
  'crack-light':  'advanced-oil-processing',
  'crack-gas':    'advanced-oil-processing',
  'coal-liquefaction': 'coal-liquefaction',
  'kovarex': 'kovarex-enrichment'
};
// ===== 任一科技解锁（对齐《异星工厂》科技树）=====
// 某些配方（如效率模块）既可被新拆分的进阶科技解锁，也可被旧「模块工程」科技解锁，
// 用于保证旧存档兼容：只要满足其中任一科技即可解锁。
const RECIPE_TECH_ANY = {
  'advanced-electronics':     ['electronics', 'advanced-electronics'],
  'advanced-electronics-2':   ['electronics', 'advanced-electronics-2'],
  'electric-engine-unit':         ['electronics', 'electric-engine-unit'],
  'sulfur-processing':       ['oil', 'sulfur-processing'],
  'advanced-material-processing':     ['modules', 'advanced-material-processing'],
  'advanced-material-processing-2':   ['modules2', 'advanced-material-processing-2'],
  'advanced-material-processing-3':   ['modules3', 'advanced-material-processing-3']
};
// 查询配方所需科技：优先配方级门控，其次按产出物判断；无则返回 null。
function recipeTechReq(rid) {
  if (RECIPE_TECH[rid]) return RECIPE_TECH[rid];
  const rec = RECIPES[rid] || REFINERY_RECIPES[rid] || CENTRIFUGE_RECIPES[rid];
  if (!rec) return null;
  const outKeys = Object.keys(rec.out || rec.prob || {});
  if (!outKeys.length) return null;
  return itemTechReq(outKeys[0]);
}
// 配方是否已解锁：无配方级/产出物科技需求 = 解锁；否则需对应科技已研究。
// 若配方属于 RECIPE_TECH_ANY（任一科技解锁），只要满足其中任意一个即视为解锁。
function recipeUnlocked(rid) {
  const rec = RECIPES[rid] || REFINERY_RECIPES[rid] || CENTRIFUGE_RECIPES[rid];
  if (!rec) return false;
  const tr = recipeTechReq(rid);
  if (!tr) return true;
  const anyList = RECIPE_TECH_ANY[tr];
  if (anyList) return anyList.some(t => !!G.techDone[t]);
  return !!(G.techDone[tr]);
}
// 返回配方因缺少哪个科技而锁定（未锁定返回 null）。多科技解锁时返回第一个未满足的科技。
function recipeLockingTech(rid) {
  const rec = RECIPES[rid] || REFINERY_RECIPES[rid] || CENTRIFUGE_RECIPES[rid];
  if (!rec) return null;
  const tr = recipeTechReq(rid);
  if (!tr) return null;
  const anyList = RECIPE_TECH_ANY[tr];
  if (anyList) {
    for (const t of anyList) if (!G.techDone[t]) return t;
    return null;
  }
  return tr && !G.techDone[tr] ? tr : null;
}

// ===== 传送带阶级链（对齐《异星工厂》物流升级）=====
// 普通带 → 快速带 → 极速带。用于 R 旋转、覆盖升级/降级、绿图批量升级等。
const BELT_TIERS = ['transport-belt', 'fast-transport-belt', 'express-transport-belt'];
const UNDERGROUND_TIERS = ['underground-belt', 'fast-underground-belt', 'express-underground-belt'];
const SPLITTER_TIERS = ['splitter', 'fast-splitter', 'express-splitter'];
// 组装机阶级链（对齐《异星工厂》组装机 I/II/III）：绿图批量升级/降级也支持组装机
const ASSEMBLER_TIERS = ['assembling-machine-1', 'assembling-machine-2', 'assembling-machine-3'];
// 合并为“可升级物流链”查表：type -> 高一阶 / 低一阶（无则返回 null）
const TIER_NEXT = {};
const TIER_PREV = {};
for (const chain of [BELT_TIERS, UNDERGROUND_TIERS, SPLITTER_TIERS, ASSEMBLER_TIERS]) {
  for (let i = 0; i < chain.length; i++) {
    TIER_NEXT[chain[i]] = i + 1 < chain.length ? chain[i + 1] : null;
    TIER_PREV[chain[i]] = i > 0 ? chain[i - 1] : null;
  }
}
// 属于同一条升级链的族：用于判断“能否用同类覆盖”（普通带只能被带系/地下带/分流器按各自链条覆盖；组装机只能被组装机链覆盖）
const TIER_FAMILY = {};
for (const chain of [BELT_TIERS, UNDERGROUND_TIERS, SPLITTER_TIERS, ASSEMBLER_TIERS]) for (const t of chain) TIER_FAMILY[t] = chain;
function tierNext(type) { return TIER_NEXT[type] || null; }
function tierPrev(type) { return TIER_PREV[type] || null; }
function tierFamily(type) { return TIER_FAMILY[type] || null; }
// 判断两种物流类型是否属于同一升级链（可互相覆盖升级/降级）
function sameTierFamily(a, b) { return !!tierFamily(a) && tierFamily(a) === tierFamily(b); }

const DEFAULT_HOTBAR = ['transport-belt', 'splitter', 'underground-belt', 'inserter', 'long-handed-inserter', 'burner-mining-drill', 'stone-furnace', 'assembling-machine-1', 'steel-chest', 'lab'];
let HOTBAR = DEFAULT_HOTBAR.slice();

