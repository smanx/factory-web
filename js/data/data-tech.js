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
  'cargo-landing-pad': 'rocket-science',  // 物流接驳站（对齐《异星工厂》：由火箭科技解锁，火箭货物降落于此）
  'cargo-bay': 'rocket-science',  // 物流扩展舱（对齐《异星工厂》：由火箭科技解锁，接驳站扩展存储）
  'landing-pad-unloading-bay': 'rocket-science',  // 物流卸载舱（对齐《异星工厂》：由火箭科技解锁，接驳站卸载/扩展存储）
  'rocket': 'rocket-science',
  'satellite': 'rocket-science',
  'rocket-fuel': 'rocket-science',
  // ===== 太空时代 Space Age 电磁学材料链（对齐《异星工厂》Space Age，统一由「电磁学」科技解锁）=====
  'carbon-fiber': 'electromagnetics',
  'lithium': 'electromagnetics',
  'lithium-plate': 'electromagnetics',
  'superconductor': 'electromagnetics',
  'electromagnetic-science-pack': 'electromagnetics',
  'electromagnetic-plant': 'electromagnetics',
  'recycler': 'recycling',   // 回收机需「回收科技」（对齐《异星工厂》Recycling）
  // ===== 太空时代 Fulgora 钬/特斯拉链（统一由「富尔戈拉电磁」科技解锁）=====
  'holmium-ore': 'fulgora',
  'holmium-solution': 'fulgora',
  'holmium-plate': 'fulgora',
  'electrolyte': 'fulgora',
  'teslagun': 'fulgora',
  'supercapacitor': 'fulgora',
  'tesla-turret': 'fulgora',
  'tesla-ammo': 'fulgora',
  // ===== 太空时代高级防御（火箭炮塔 / 磁轨炮塔，统一由「高级防御」科技解锁）=====
  'rocket-turret': 'advanced-defense',
  'railgun-turret': 'advanced-defense',
  'railgun-ammo': 'advanced-defense',
  // ===== 太空时代 Vulcanus 铸造/冶金材料链（统一由「冶金学」科技解锁）=====
  'tungsten-ore': 'metallurgy',
  'tungsten-plate': 'metallurgy',
  'tungsten-carbide': 'metallurgy',
  'metallurgic-science-pack': 'metallurgy',
  'foundry': 'metallurgy',
  // ===== 太空时代 农业/Gleba 生物质链（统一由「农业科技」解锁）=====
  'yumako': 'agriculture',
  'yumako-mash': 'agriculture',
  'bioflux': 'agriculture',
  'nutrients': 'agriculture',
  'spoilage': 'agriculture',
  'agricultural-science-pack': 'agriculture',
  'biochamber': 'agriculture',
  'agricultural-tower': 'agriculture',
  'yumako-seed': 'agriculture',
  'artificial-yumako-soil': 'agriculture',
  'overgrowth-yumako-soil': 'agriculture',
  // Gleba 果仁（Jellynut）生物链：与玉玛果并列，统一由「农业科技」解锁
  'jellynut': 'agriculture',
  'jellynut-seed': 'agriculture',
  'jelly': 'agriculture',
  'biter-egg': 'agriculture',
  'pentapod-egg': 'agriculture',
  'artificial-jellynut-soil': 'agriculture',
  // Gleba 金属细菌链（Iron/Copper bacteria）：由生化炉培育，统一由「农业科技」解锁
  'iron-bacteria': 'agriculture',
  'copper-bacteria': 'agriculture',
  'overgrowth-jellynut-soil': 'agriculture',
  // ===== 植树造林（对齐《异星工厂》Space Age Tree seeding：官方 tree-seeding 科技解锁 tree-seed 树种）=====
  'tree-seed': 'tree-seeding',
  'biolab': 'biolab',  // 生物实验室（Gleba）：需「生物实验室」科技（官方 Biolab 科技，前置农业科技），科研速度 2 倍
  // ===== 太空时代 小行星碎块加工链（统一由「太空材料加工」科技解锁）=====
  'crusher': 'asteroid-processing',
  'big-mining-drill': 'big-mining-drill',  // 大型采矿机需「大型采矿机」科技（对齐《异星工厂》Space Age Big mining drill 科技）
  'heating-tower': 'heating-tower',  // 供热塔（Aquilo）：需「供热塔」科技（官方 Heating 科技，燃烧化学燃料产热）
  // ===== Fulgora 避雷系统（对齐《异星工厂》Space Age Lightning 科技）=====
  'lightning-rod': 'lightning',
  'lightning-collector': 'lightning',  // 避雷收集器需「避雷科技」（官方 Lightning 科技解锁避雷针与收集器）
  // ===== 太空推进链（对齐《异星工厂》Space Age Thruster 科技：解锁推进器燃料/氧化剂化工厂配方）=====
  'thruster-fuel': 'space-thruster',
  'thruster-oxidizer': 'space-thruster',
  'advanced-thruster-fuel': 'space-thruster',
  'advanced-thruster-oxidizer': 'space-thruster',
  // ===== 太空平台系统（对齐《异星工厂》Space Age 空间平台科技）=====
  'space-platform-foundation': 'space-platform',
  'space-platform-starter-pack': 'space-platform',
  'space-platform-hub': 'space-platform',
  'thruster': 'space-platform',
  'asteroid-collector': 'space-platform',
  'metallic-asteroid-chunk': 'asteroid-processing',
  'carbonic-asteroid-chunk': 'asteroid-processing',
  'oxide-asteroid-chunk': 'asteroid-processing',
  'ice': 'asteroid-processing',
  'speed-module': 'modules',
  'productivity-module': 'modules',
  // ===== Aquilo 聚变发电链（对齐《异星工厂》Space Age Fusion 科技）=====
  'fusion-reactor': 'fusion-power',
  'fusion-generator': 'fusion-power',
  'fusion-power-cell': 'fusion-power',
  'efficiency-module': 'advanced-material-processing',
  'speed-module-2': 'modules2',
  'speed-module-3': 'modules3',
  'productivity-module-2': 'modules2',
  'productivity-module-3': 'modules3',
  'efficiency-module-2': 'advanced-material-processing-2',
  'efficiency-module-3': 'advanced-material-processing-3',
  // 品质模块（对齐《异星工厂》Quality DLC：品质学科技解锁）
  'quality-module': 'quality',
  'quality-module-2': 'quality-2',
  'quality-module-3': 'quality-3',
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
  'stack-inserter': 'stack-inserter-tech',
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
  'solid-fuel': 'oil',               // 固体燃料：需「石油冶金」（对齐原版 Oil processing）
  // ===== 补齐官方缺失科技门控（对齐《异星工厂》科技树） =====
  'concrete': 'concrete',              // 混凝土：需「混凝土」科技（对齐原版 Concrete）
  'refined-concrete': 'concrete',      // 精炼混凝土：需「混凝土」科技
  'hazard-concrete': 'concrete',       // 警示混凝土：需「混凝土」科技
  'refined-hazard-concrete': 'concrete',   // 精炼警示混凝土：需「混凝土」科技
  'landfill': 'landfill',               // 填海料：需「填海」科技（对齐原版 Landfill）
  // ===== 太空时代 Aquilo 低温学链（统一由「低温学」科技解锁） =====
  'cryogenic-plant': 'cryogenics',
  'cryogenic-science-pack': 'cryogenics',
  'ammonia': 'cryogenics',
  'fluorine': 'cryogenics',
  'fluoroketone-cold': 'cryogenics',
  'fluoroketone-hot': 'cryogenics',
  'foundation': 'cryogenics',   // 平台基座（空间平台走行地板，官方 Foundation，需氟酮冷，归低温学链）
  'ice-platform': 'cryogenics',  // 冰面平台（玄冥星冰原，官方 Ice platform，需氨水，归低温学链）
  // ===== 太空时代 熔融金属铸造链 / 废料回收（统一由对应科技解锁） =====
  'iron-ore-melting': 'molten-metal',
  'copper-ore-melting': 'molten-metal',
  'casting-iron': 'molten-metal',
  'casting-steel': 'molten-metal',
  'casting-copper': 'molten-metal',
  'casting-iron-gear-wheel': 'molten-metal',
  'casting-iron-stick': 'molten-metal',
  'casting-pipe': 'molten-metal',
  'casting-pipe-to-ground': 'molten-metal',
  'casting-low-density-structure': 'molten-metal',
  'casting-copper-cable': 'molten-metal',
  'concrete-from-molten-iron': 'molten-metal',
  'steam-condensation': 'cryogenics',
  'acid-neutralisation': 'cryogenics',
  'scrap': 'scrap-recycling',
  'recycle-scrap': 'scrap-recycling',
  // ===== 太空时代 终局防御（轨道炮/量子处理器由「轨道炮防御」科技解锁；炮塔由「高级防御」科技解锁） =====
  'quantum-processor': 'railgun-defense',
  'railgun': 'railgun-defense',
  // ===== 太空时代 机械装甲（统一由「机械装甲」科技解锁） =====
  'mech-armor': 'mech-armor',
  'battery-mk3-equipment': 'mech-armor',
  'fission-reactor-equipment': 'mech-armor',
  'toolbelt-equipment': 'mech-armor',
  // ===== 太空时代 虫巢孵化器（统一由「虫巢孵化器」科技解锁）=====
  'captive-biter-spawner': 'captive-biter-spawner',
  'capture-robot-rocket': 'captive-biter-spawner',
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
// Factorio 2.0 流体阀门：由流体处理科技解锁（与泵/地下管道一致，官方 fluid-handling）
TECH_REQ['one-way-valve'] = 'fluid-handling';
TECH_REQ['overflow-valve'] = 'fluid-handling';
TECH_REQ['top-up-valve'] = 'fluid-handling';
// 战斗机器人：三种战斗机器人胶囊需战斗机器人科技解锁（对齐《异星工厂》Combat robotics）
for (const id of ['defender-capsule', 'distractor-capsule', 'destroyer-capsule']) TECH_REQ[id] = 'combat-robotics';
// ===== 流体桶装科技门控（对齐《异星工厂》：桶装需流体处理科技） =====
TECH_REQ['barrel'] = 'barrel';
for (const f of BARREL_FLUIDS) TECH_REQ[f + '-barrel'] = 'barrel';
// ===== 铁路科技门控 =====
const RAIL_ITEMS = ['rail', 'locomotive', 'cargo-wagon', 'train-stop', 'fluid-wagon'];
for (const id of RAIL_ITEMS) if (!TECH_REQ[id]) TECH_REQ[id] = 'railways';
// 内燃机车需处理单元（电子学），故需铁路技术+电子学双重前置（对齐原版：内燃机车需进阶电子科技）
if (!TECH_REQ['rail-signal']) TECH_REQ['rail-signal'] = 'rail-signals';
if (!TECH_REQ['rail-chain-signal']) TECH_REQ['rail-chain-signal'] = 'rail-signals';
// 高架铁轨（Elevated Rails DLC）：高架桥墩与高架铁轨需「高架铁轨」科技解锁（对齐官方：前置混凝土+产能科研包）
TECH_REQ['rail-support'] = 'elevated-rail';
TECH_REQ['rail-ramp'] = 'elevated-rail';
// ===== 物流机器人网络 =====
const LOGISTIC_ITEMS = ['roboport', 'logistic-robot', 'passive-provider-chest', 'active-provider-chest', 'storage-chest', 'requester-chest', 'buffer-chest'];
// 物流箱科技门控：所有物流设备需先研究「物流网络」
for (const id of LOGISTIC_ITEMS) if (!TECH_REQ[id]) TECH_REQ[id] = 'logistics-network';
// ===== 电路网络科技门控 =====
const CIRCUIT_ITEMS = ['small-electric-pole', 'medium-electric-pole', 'big-electric-pole', 'constant-combinator', 'arithmetic-combinator', 'decider-combinator', 'selector-combinator', 'display-panel', 'substation', 'programmable-speaker', 'power-switch', 'red-wire', 'green-wire'];
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
  'flamethrower': 'flamethrower'
};
// 弹药/投掷物科技门控：散弹枪弹由武器科技解锁，穿甲散弹枪弹与集束手雷由高级战斗解锁
TECH_REQ['shotgun-shell'] = 'weapons';
TECH_REQ['piercing-shotgun-shell'] = 'military2';
TECH_REQ['cluster-grenade'] = 'cluster-grenade';
// 爆炸火箭弹/爆炸火箭筒：研究「爆炸物科技」后解锁（对齐《异星工厂》Explosive rocket 独立科技）
TECH_REQ['explosive-rocket'] = 'explosives';
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
  'efficiency-module-3':  { tier: 3, type: 'eff',   eff: 2,   power: 0 },
  // 品质模块（对齐《异星工厂》Quality DLC：品质加成/速度惩罚来自 GAME_DATA.qualityModules 单源）
  'quality-module':    { tier: 1, type: 'quality', quality: (GAME_DATA.qualityModules?.['quality-module']?.quality ?? 0.01), speedPenalty: (GAME_DATA.qualityModules?.['quality-module']?.speedPenalty ?? 0.05) },
  'quality-module-2':  { tier: 2, type: 'quality', quality: (GAME_DATA.qualityModules?.['quality-module-2']?.quality ?? 0.02), speedPenalty: (GAME_DATA.qualityModules?.['quality-module-2']?.speedPenalty ?? 0.05) },
  'quality-module-3':  { tier: 3, type: 'quality', quality: (GAME_DATA.qualityModules?.['quality-module-3']?.quality ?? 0.025), speedPenalty: (GAME_DATA.qualityModules?.['quality-module-3']?.speedPenalty ?? 0.05) }
};
function isModule(id) { return !!MODULE_VARIANTS[id]; }
function moduleType(id) { const v = MODULE_VARIANTS[id]; return v ? v.type : null; }
// 统计某设备 modules 表中速度/产能/效率模块的加权当量。
// modules 形如 { 'speed-module': 2, 'productivity-module-2': 1, ... }
function moduleCounts(modules) {
  let speed = 0, prod = 0, eff = 0, quality = 0;
  if (!modules) return { speed, prod, eff, quality };
  for (const id in modules) {
    const v = MODULE_VARIANTS[id];
    if (!v) continue;
    const n = modules[id] || 0;
    if (v.type === 'speed') speed += v.speed * n;
    else if (v.type === 'prod') prod += v.prod * n;
    else if (v.type === 'eff') eff += v.eff * n;
    else if (v.type === 'quality') quality += v.quality * n;
  }
  // 品质模块速度惩罚（官方 speed=-0.05/级），用于各类设备 moduleSpeedMult 折算
  let qualityPenalty = 0;
  if (modules) for (const id in modules) {
    const v = MODULE_VARIANTS[id];
    if (v && v.type === 'quality' && (modules[id] || 0) > 0) qualityPenalty += v.speedPenalty * (modules[id] || 0);
  }
  return { speed, prod, eff, quality, qualityPenalty };
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
  let h = row('模块', hasMod ? '速度+' + mc.speed.toFixed(1) + ' 产能+' + mc.prod.toFixed(1) + ' 效率-' + mc.eff.toFixed(1) + ' 品质+' + (mc.quality * 100).toFixed(1) + '%' + ' 污染' + modulePollutionLabel(mc.speed, mc.prod, mc.eff) : '<span class="dim">无</span>', 'mod');
  for (const mid of Object.keys(e.modules)) if ((e.modules[mid] || 0) > 0) h += '<span class="dim">' + ITEMS[mid].name + ' x' + e.modules[mid] + '</span> ';
  const order = ['speed-module', 'speed-module-2', 'speed-module-3', 'productivity-module', 'productivity-module-2', 'productivity-module-3', 'efficiency-module', 'efficiency-module-2', 'efficiency-module-3', 'quality-module', 'quality-module-2', 'quality-module-3'];
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
  'kovarex': 'kovarex-enrichment',
  // 太空时代 小行星进阶加工：进阶粉碎 / 星块再处理统一由「太空材料加工」科技解锁（对齐官方进阶星块加工科技链）
  'advanced-metallic-asteroid-crushing': 'asteroid-processing',
  'advanced-carbonic-asteroid-crushing': 'asteroid-processing',
  'advanced-oxide-asteroid-crushing': 'asteroid-processing',
  'metallic-asteroid-reprocessing': 'asteroid-processing',
  'carbonic-asteroid-reprocessing': 'asteroid-processing',
  'oxide-asteroid-reprocessing': 'asteroid-processing',
  // 太空时代 超速物流（Turbo belt，对齐官方 Space Age Turbo transport belt 科技）
  'turbo-transport-belt': 'turbo-logistics',
  // 太空时代 Gleba 变质物回收（官方 Nutrients from spoilage / Burnt spoilage 配方，生化炉 organic，
  // 与其它生物质链统一由「农业科技」解锁）
  'nutrients-from-spoilage': 'agriculture',
  'burnt-spoilage': 'agriculture',
  'bioplastic': 'agriculture',
  'biolubricant': 'agriculture',
  // 太空时代 养鱼/鱼制营养素/煤合成（官方 fish-breeding / nutrients-from-fish /
  // coal-synthesis 配方，与其它 Gleba 生物质/化工链统一由「农业科技」解锁）
  'fish-breeding': 'agriculture',
  'nutrients-from-fish': 'agriculture',
  'coal-synthesis': 'agriculture',
  'rocket-fuel-from-jelly': 'agriculture',  // 果冻制火箭燃料（Gleba 生物质配方，由「农业科技」解锁）
  'solid-fuel-from-ammonia': 'cryogenics',  // 氨制固体燃料（Aquilo 低温学链，由「低温学」科技解锁）
  'turbo-underground-belt': 'turbo-logistics',
  'turbo-splitter': 'turbo-logistics',
  // ===== 装载机 Loader（对齐《异星工厂》Loader，web 复刻开放官方隐藏物流设备）=====
  'loader': 'logistics2',             // 基础装载机：需「物流 II」
  'fast-loader': 'logistics2',        // 高速装载机：需「物流 II」
  'express-loader': 'logistics3',     // 极速装载机：需「物流 III」
  'turbo-loader': 'turbo-logistics',  // 超速装载机：需「超速物流」科技
  // 太空时代 堆叠机械臂（官方 Space Age Stack inserter 科技，需碳纤维+集装箱机械臂）
  'stack-inserter': 'stack-inserter-tech',
  // 太空时代 钷素科研包（官方 Promethium science pack 科技，由钷素星块+超导体+生物结晶在电磁工厂制得）
  'promethium-science-pack': 'promethium-science',  // 太空时代 Aquilo 低温学链（统一由「低温学」科技解锁）
  'cryogenic-plant': 'cryogenics',
  'cryogenic-science-pack': 'cryogenics',
  'ammonia': 'cryogenics',
  'fluorine': 'cryogenics',
  'fluoroketone-cold': 'cryogenics',
  'fluoroketone-hot': 'cryogenics',
  // 太空时代 熔融金属铸造链（统一由「熔融金属」科技解锁）
  'iron-ore-melting': 'molten-metal',
  'copper-ore-melting': 'molten-metal',
  'casting-iron': 'molten-metal',
  'casting-steel': 'molten-metal',
  'casting-copper': 'molten-metal',
  'casting-iron-gear-wheel': 'molten-metal',
  'casting-iron-stick': 'molten-metal',
  'casting-pipe': 'molten-metal',
  'casting-pipe-to-ground': 'molten-metal',
  'casting-low-density-structure': 'molten-metal',
  'casting-copper-cable': 'molten-metal',
  'concrete-from-molten-iron': 'molten-metal',
  'steam-condensation': 'cryogenics',
  'acid-neutralisation': 'cryogenics',
  // 太空时代 废料回收（统一由「废料回收」科技解锁）
  'scrap': 'scrap-recycling',
  'recycle-scrap': 'scrap-recycling',
  // 太空时代 终局防御（轨道炮/量子处理器由「轨道炮防御」科技解锁；炮塔由「高级防御」科技解锁）
  'quantum-processor': 'railgun-defense',
  'railgun': 'railgun-defense',
  // 太空时代 机械装甲（统一由「机械装甲」科技解锁）
  'mech-armor': 'mech-armor',
  'battery-mk3-equipment': 'mech-armor',
  'fission-reactor-equipment': 'mech-armor',
  'toolbelt-equipment': 'mech-armor',
  // ===== 植树造林（对齐《异星工厂》Space Age Tree seeding：官方 tree-seeding 科技解锁 tree-seed 树种配方）=====
  'tree-seed': 'tree-seeding',
  // 太空时代地面瓦片（统一由「低温学」科技解锁，官方 Foundation/Ice platform）
  'foundation': 'cryogenics',
  'ice-platform': 'cryogenics'

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
const BELT_TIERS = ['transport-belt', 'fast-transport-belt', 'express-transport-belt', 'turbo-transport-belt'];
const UNDERGROUND_TIERS = ['underground-belt', 'fast-underground-belt', 'express-underground-belt', 'turbo-underground-belt'];
const SPLITTER_TIERS = ['splitter', 'fast-splitter', 'express-splitter', 'turbo-splitter'];
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


// ===== 品质系统（对齐《异星工厂》Quality DLC：6 级品质） =====
// 品质等级定义（官方 quality 原型：normal/uncommon/rare/epic/legendary，含 quality-unknown 占位）。
// 每级对应一个提升比例，用于装备/建筑在更高品质下的数值加成（官方无统一公式，此处按
// 等级线性折衷：normal=1.0、uncommon=1.1、rare=1.2、epic=1.3、legendary=1.5）。
const QUALITY_TIERS = [
  { id: 'normal',    name: '普通',   color: '#d0d0d0', mult: 1.0 },
  { id: 'uncommon',  name: '罕见',   color: '#2ba53d', mult: 1.1 },
  { id: 'rare',      name: '稀有',   color: '#1968b2', mult: 1.2 },
  { id: 'epic',      name: '史诗',   color: '#8900b2', mult: 1.3 },
  { id: 'legendary', name: '传说',   color: '#b26800', mult: 1.5 },
];
const QUALITY_INDEX = { normal: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
// 物品的品质后缀标记：`item~quality`。无后缀视为 normal 品质。
const QUALITY_SEP = '~';
// 解析物品 id，返回 { base, quality }；normal 返回 { base: id, quality: 'normal' }
function splitQuality(id) {
  const i = id.indexOf(QUALITY_SEP);
  if (i < 0) return { base: id, quality: 'normal' };
  return { base: id.slice(0, i), quality: id.slice(i + 1) };
}
// 给物品 id 打品质后缀（normal 不加后缀）
function tagQuality(id, quality) {
  if (!quality || quality === 'normal') return id;
  return id + QUALITY_SEP + quality;
}
// 返回某设备模块的品质加成总和（%）
function moduleQualityChance(modules) {
  const mc = moduleCounts(modules);
  return mc.quality;
}
// 依据品质加成，掷一次品质升级：返回升级后的品质 id（未升级返回原品质）
// 品质模块提供 chance 概率进入“升级池”，升级池内按等级逐级累计概率（官方链式概率，此处简化）。
function rollQualityUpgrade(currentQuality, chance) {
  if (chance <= 0) return currentQuality;
  const cur = QUALITY_INDEX[currentQuality] || 0;
  // 逐级尝试升级：每级成功概率 = chance（品质加成），最高到 legendary
  for (let lvl = cur; lvl < QUALITY_TIERS.length - 1; lvl++) {
    if (Math.random() < chance) {
      // 连续升级（链式概率，官方 chain_probability=0.1 简化取 chance）
      return QUALITY_TIERS[lvl + 1].id;
    }
  }
  return currentQuality;
}
// 品质对数值的加成倍率（用于建筑速度/装备强度等）
function qualityMult(quality) {
  const q = QUALITY_INDEX[quality] || 0;
  return QUALITY_TIERS[q].mult;
}
