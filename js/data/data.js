'use strict';

const TILE = 32;
const CHUNK = 32;
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

let BELT_SPEED = 1.875;   // 基础传送带速度（格/秒），对齐《异星工厂》1.875 tiles/s（官方 speed 0.03125 格/tick × 60，由 GAME_DATA 桥接）
const BELT_SPACING = 0.125; // 物品间隔（格）0.125=1/8 格/件，每列 8 件/格；以「双车道合计」计 → 基础带双车道合计 15 items/s（每车道 7.5）
let FAST_BELT_MULT = 2;    // 快速传送带 = 2× 基础（对齐《异星工厂》3.75 tiles/s，由 GAME_DATA 桥接）
let EXPRESS_BELT_MULT = 3; // 极速传送带 = 3× 基础（对齐《异星工厂》5.625 tiles/s，由 GAME_DATA 桥接）
let TURBO_BELT_MULT = 4;   // 超速传送带 = 4× 基础（太空时代 7.5 tiles/s，官方 speed 0.125，由 GAME_DATA 桥接）
// 燃料能量密度（项目相对刻度）——数据单源化，全部来自 GAME_DATA.fuelEnergy（data.generated.js，
// 由 tools/generate-game-data.js 统一下发），不在本文件另行维护第二套数值。
// 官方 fuel_value 为 MJ 绝对值（煤 4MJ / 固体燃料 12MJ / 火箭燃料 100MJ / 核燃料 1.21GJ），
// 本项目采用相对刻度（煤=12 为基准，见 tools/generate-game-data.js fuelEnergy 注释）。
const COAL_ENERGY = GAME_DATA.fuelEnergy?.['coal'] ?? 12;
const WOOD_FUEL_ENERGY = GAME_DATA.fuelEnergy?.['wood'] ?? 3;   // 木材能量密度（约煤的 1/4）
const SOLID_FUEL_ENERGY = GAME_DATA.fuelEnergy?.['solid-fuel'] ?? 50;   // 约 4 倍于煤
const ROCKET_FUEL_ENERGY = GAME_DATA.fuelEnergy?.['rocket-fuel'] ?? 500; // 约 40 倍于煤
const NUCLEAR_FUEL_ENERGY = GAME_DATA.fuelEnergy?.['nuclear-fuel'] ?? 2500; // 核燃料（官方 1.21GJ）
const SELF_FUEL_MAX = 4;   // 热能采矿机燃料槽容量（对齐《异星工厂》：burner mining drill 16MJ/4MJ=4 个煤）
const DRILL_BUFFER_CAP = 20; // 采矿机矿物输出缓冲上限（对齐《异星工厂》：采矿机内置 20 格输出缓冲）
const UNDERGROUND_MAX = GAME_DATA.undergroundDist?.['underground-belt'] ?? 6;
const FAST_UNDERGROUND_MAX = GAME_DATA.undergroundDist?.['fast-underground-belt'] ?? 14;
const EXPRESS_UNDERGROUND_MAX = GAME_DATA.undergroundDist?.['express-underground-belt'] ?? 20;
const TURBO_UNDERGROUND_MAX = GAME_DATA.undergroundDist?.['turbo-underground-belt'] ?? 11;
const UG_CAP = 8;  // 地下带每列缓存容量（双列，两列共 2×UG_CAP 件），对齐传送带每列每格 8 件
const DRILL_TIME = 1.0;
// 各矿石的采矿时间（秒，采 1 个矿所需基础时间），对齐《异星工厂》每种资源独立的 mining_time：
//   普通矿（铁/铜/煤/石）mining_time = 2s；铀矿 mining_time = 4s。
// 实际每采 1 个矿耗时 = 该矿石采矿时间 ÷ 采矿机速度（热能 0.25 / 电 0.5）。
const ORE_MINING_TIME = {
  'iron-ore': 2.0, 'copper-ore': 2.0, 'coal': 2.0, 'stone': 2.0, 'uranium-ore': 4.0, 'metallic-asteroid-chunk': 2.0, 'carbonic-asteroid-chunk': 2.0, 'oxide-asteroid-chunk': 2.0,
  'tungsten-ore': 2.0, 'holmium-ore': 2.0   // 太空时代行星专属矿（官方 mining_time=2，与普通矿一致）
};
function oreMiningTime(item) {
  const t = ORE_MINING_TIME[item];
  return (typeof t === 'number' && t > 0) ? t : DRILL_TIME;
}
const HAND_MINE_TIME = 0.45;
const REACH_TILES = 5.5;
const REACH_PX = REACH_TILES * TILE;
const LAB_TIME = 1; // 研究中心每瓶科学包耗时（秒）
// 功率数值对齐《异星工厂》(Factorio) 官方 Wiki（单位 kW）
// 数据单源化：全部来自 GAME_DATA.steamPower / GAME_DATA.powerUse（data.generated.js，
// 由 tools/generate-game-data.js 从 factorio-data 现场计算），不在本文件另行维护第二套数值。
//   官方蒸汽机满功率 = 30/s × (165-15)°C × 1 × 200J = 900kW（GAME_DATA.steamPower.enginePower）
//   官方汽轮机满功率 = 60/s × (500-15)°C × 1 × 200J = 5.82MW（GAME_DATA.steamPower.turbinePower）
//   离心机功耗 = 350kW（GAME_DATA.powerUse.centrifuge）
const POWER_PER_ENGINE = GAME_DATA.steamPower?.enginePower ?? 900;    // 蒸汽机满功率输出
const POWER_PER_TURBINE = GAME_DATA.steamPower?.turbinePower ?? 5820; // 汽轮机满功率输出
const CENTRIFUGE_POWER = GAME_DATA.powerUse?.['centrifuge'] ?? 350;   // 离心机功耗 kW
// ===== 核能（对齐《异星工厂》核动力）=====
// 核反应堆：消耗核燃料 + 水 → 产出高温蒸汽；汽轮机以远高于蒸汽机的功率发电。
const REACTOR_POWER = 40000;    // 反应堆热功率 40MW（对齐官方）；简化：直接折算成产汽能力
const REACTOR_FUEL_ENERGY = 200;  // 每组核燃料可持续燃烧秒数
const REACTOR_WATER_RATE = 4.0;   // 反应堆每秒耗水量（远超锅炉，产汽量更高）
const REACTOR_STEAM_CAP = 40;     // 反应堆内部蒸汽缓冲
const TURBINE_STEAM_RATE = 1.5;   // 汽轮机满功率耗汽（单位/秒）
const TURBINE_STEAM_CAP = 12;     // 汽轮机内部储汽上限
const CENTRIFUGE_TIME = 12;       // 离心机处理一批铀矿耗时（秒）
const URANIUM_CENTRIFUGE_KOVAREX_TIME = 60; // Kovarex 富集耗时（秒）
// ===== 核能热量链路（反应堆 → 导热管 → 热交换器 → 高温蒸汽 → 汽轮机）=====
// 引入“热量(heat)”概念：反应堆不直接产蒸汽，而是产热量；热量经导热管传导，
// 在热交换器处把水烧成高温蒸汽，再供汽轮机发电（对齐《异星工厂》核能标准链路）。
// ---------------------------------------------------------------------------
// 热量模型对齐 factorio-data 官方 Heat buffer：
//   - heat_buffer 以能量(J/MJ)存储，温度 = 能量 / 比热(specific_heat)；
//   - 相邻 heat connection 按温度差传导，从高温流向低温，速率受双方较小 max_transfer 限制；
//   - 官方数值：导热管 max_temperature=1000, specific_heat=1MJ, max_transfer=1GW；
//     反应堆 specific_heat=10MJ, max_transfer=10GW；热交换器 specific_heat=1MJ, max_transfer=2GW。
const HEAT_MAX_TEMP = GAME_DATA.heat?.reactorMaxTemp ?? 1000;   // 所有 heat buffer 最高温度 1000°C（官方 max_temperature）
const REACTOR_SPECIFIC_HEAT = GAME_DATA.heat?.reactorSpecificHeat ?? 10;  // 反应堆比热 10MJ/°C（官方）
const HEAT_PIPE_SPECIFIC_HEAT = GAME_DATA.heat?.heatPipeSpecificHeat ?? 1; // 导热管比热 1MJ/°C（官方）
const HEAT_EXCHANGER_SPECIFIC_HEAT = GAME_DATA.heat?.heatExchangerSpecificHeat ?? 1;    // 热交换器比热 1MJ/°C（官方 energy_source specific_heat，GAME_DATA 单源）
const REACTOR_MAX_TRANSFER = GAME_DATA.heat?.reactorMaxTransfer ?? 10000;  // 反应堆最大传热 10GW=10000MW（官方 max_transfer）
const HEAT_PIPE_MAX_TRANSFER = GAME_DATA.heat?.heatPipeMaxTransfer ?? 1000; // 导热管最大传热 1GW=1000MW（官方 max_transfer）
const HEAT_EXCHANGER_MAX_TRANSFER = GAME_DATA.heat?.heatExchangerMaxTransfer ?? 2000;  // 热交换器最大传热 2GW=2000MW（官方 energy_source max_transfer，GAME_DATA 单源）
const REACTOR_HEAT_RATE = GAME_DATA.heat?.reactorHeatRate ?? 40;  // 反应堆热功率 40MW（铀燃料棒 8GJ / 200s，官方）
const HEAT_EXCHANGER_MIN_WORK_TEMP = GAME_DATA.heat?.heatExchangerMinWorkTemp ?? 500;  // 热交换器最低工作温度 500°C（官方 energy_source min_working_temperature，GAME_DATA 单源）
const HEAT_PIPE_MIN_GLOW_TEMP = GAME_DATA.heat?.heatPipeMinGlowTemp ?? 350; // 导热管/热设备最低发光温度 350°C（官方 minimum_glow_temperature）
const HEAT_EXCHANGER_ENERGY_PER_STEAM = 20;// 热交换器每产 1 单位蒸汽需消耗热量(MJ)，满产(2单位/s)恰好消耗反应堆 40MW 热功率
const HEAT_EXCHANGER_STEAM_RATE = 2.0;     // 热交换器满功率产汽速率（单位/秒）
// 太空时代供热塔（heating-tower，Aquilo）：官方 reactor 原型，燃烧化学燃料产热，数据来自 GAME_DATA.heat。
// 产热 = 燃料消耗率 × 效比（官方 consumption=40MW、effectivity=2.5 → 100MW，高于核反应堆 40MW）。
const HEATING_TOWER_RATE = GAME_DATA.heat?.heatingTowerRate ?? 40;             // 燃料消耗率 40MW（官方 consumption）
const HEATING_TOWER_EFFECTIVITY = GAME_DATA.heat?.heatingTowerEffectivity ?? 2.5; // 热效比 2.5（官方 effectivity）
const HEATING_TOWER_SPECIFIC_HEAT = GAME_DATA.heat?.heatingTowerSpecificHeat ?? 5; // 比热 5MJ/°C（官方 heat_buffer specific_heat）
const HEATING_TOWER_MAX_TRANSFER = GAME_DATA.heat?.heatingTowerMaxTransfer ?? 10000; // 最大传热 10GW（官方 max_transfer）
// ===== Aquilo 聚变发电链（fusion-reactor / fusion-generator，对齐《异星工厂》Space Age Fusion）=====
// 官方 fusion-reactor：6×6、max_health 1000、power_input 10MW；fusion-generator：3×5、output_flow_limit 50MW。
// 数据单源化：发电功率/反应堆耗电/氟酮冷液消耗均来自 GAME_DATA.fusion（data.generated.js，
// 由 tools/generate-game-data.js 从 factorio-data 现场提取官方 power_input / max_fluid_usage /
// output_flow_limit），不在本文件另行维护第二套数值表。
const FUSION_REACTOR_SPECIFIC_HEAT = 10;   // 聚变反应堆比热 10MJ/°C（官方 heat_buffer）
const FUSION_REACTOR_MAX_TRANSFER = 10000; // 聚变反应堆最大传热 10GW（官方 max_transfer）
const FUSION_REACTOR_HEAT_RATE = 200;      // 聚变反应堆热功率 200MW（终极发电，高于核反应堆 40MW/供热塔 100MW）
const FUSION_REACTOR_POWER_INPUT = GAME_DATA.fusion?.reactorPowerInput ?? 10;  // 聚变反应堆耗电 MW（官方 power_input=10MW）
const FUSION_REACTOR_FLUID_USAGE = GAME_DATA.fusion?.reactorFluidUsage ?? 4;   // 聚变反应堆每秒耗氟酮冷液单位（官方 max_fluid_usage 4/s）
const FUSION_FUEL_ENERGY = 200;            // 每根聚变燃料棒可持续燃烧秒数
const FUSION_GENERATOR_SPECIFIC_HEAT = 1;  // 聚变发电机比热 1MJ/°C
const FUSION_GENERATOR_MAX_TRANSFER = 2000;// 聚变发电机最大传热 2GW（官方 max_transfer）
const FUSION_GENERATOR_MAX_POWER = GAME_DATA.fusion?.generatorMaxPower ?? 50000;  // 聚变发电机满功率 50MW（官方 output_flow_limit=50MW，GAME_DATA 单源）
const FUSION_HEAT_PER_KW = 0.004;          // 每 kW·s 发电需消耗热量(MJ)：50MW 满功率每秒需 200MJ
// 聚变等离子体（官方 fusion-plasma）工作介质常数：反应堆产 Plasma → 管道 → 发电机吸 Plasma 发电。
// 相对刻度（项目简化模型），以热功率线性换算（200MW → 每秒 2000 单位 Plasma），
// 每单位 Plasma 折算 1MJ 热量；数值不单独维护数值表（官方无固定产出速率，按热功率换算）。
const FUSION_PLASMA_RATE = 2000;           // 聚变反应堆每秒产 Plasma 单位（200MW→2000/s）
const FUSION_PLASMA_BUF = 2000;            // 聚变反应堆内部 Plasma 缓冲上限
const FUSION_HEAT_PER_PLASMA = 1;          // 每单位 Plasma 折算热量(MJ)（发电机吸 Plasma 供热）
const POWER_USE = {
  'electric-mining-drill': 90,          // 电采矿机
  'electric-furnace': 180,       // 电炉
  'assembling-machine-1': 75,      // 组装机 I
  'assembling-machine-2': 150, // 组装机 II
  'assembling-machine-3': 375,   // 组装机 III
  'pumpjack': 90,                // 抽油机
  'oil-refinery': 420,               // 炼油厂
  'chemical-plant': 210,         // 化工厂
  'centrifuge': 350,             // 离心机（官方 energy_usage 350kW）
  'lab': 60                      // 研究中心
};

// ===== 发电链（抽水机 → 水 → 锅炉烧出蒸汽 → 蒸汽口送汽 → 蒸汽机发电）=====
const WATER_CAP = 20;            // 锅炉/抽水机内部储水上限（兼作锅炉蒸汽缓冲上限）
const BOILER_WATER_RATE = 1.2;   // 锅炉每秒耗水（1:1 转为蒸汽输出）
const BOILER_HEAT_RATE = 30;     // 锅炉每秒升温（°C，耗煤+水时）
const BOILER_COOL_RATE = 2;      // 锅炉每秒自然降温（°C）
const BOILER_TEMP_MAX = GAME_DATA.steamPower?.boilerTargetTemp ?? 165;  // 锅炉目标温度（官方 boiler target_temperature=165°C）
const PUMP_RATE = GAME_DATA.fluidCapacity?.pumpRate ?? 20;  // 抽水机每秒产水（官方 offshore-pump pumping_speed=20）
const ENGINE_STEAM_RATE = 0.6;   // 蒸汽机满功率耗汽（单位/秒）：1 台锅炉可带 2 台蒸汽机
const ENGINE_STEAM_CAP = 10;     // 蒸汽机内部储汽上限

const FLUIDS = ['water', 'steam', 'crude-oil', 'heavy-oil', 'light-oil', 'petroleum-gas', 'lubricant', 'sulfuric-acid', 'thruster-fuel', 'thruster-oxidizer', 'ammonia', 'ammoniacal-solution', 'fluorine', 'fluoroketone-cold', 'fluoroketone-hot', 'lithium-brine', 'lava', 'molten-iron', 'molten-copper', 'holmium-solution', 'electrolyte', 'fusion-plasma'];
// 矿石索引：iron/copper/coal/stone = 0-3；原油 = 5（不进手挖矿表）；铀矿 = 6。
// ⚠️ 版本迁移：早期版本原油索引为 5，本次新增铀矿后改为 6，读档时对旧档做 5→6 重映射。
const ORE_OIL = 5;                       // 原油矿床的 oreType 索引（不进手挖矿表）
const ORE_URANIUM = 6;                   // 铀矿床的 oreType 索引
const ORE_ASTEROID = 7;                  // 小行星碎块矿床的 oreType 索引（太空时代，随机出金属/碳质/氧化星块）
const ORE_TUNGSTEN = 8;                // 钨矿床的 oreType 索引（太空时代祝融星天然矿脉，官方 tungsten-ore）
const ORE_HOLMIUM = 9;                 // 钬矿床的 oreType 索引（太空时代雷神星天然矿脉，官方 holmium-ore）
function oreItemId(ti) {
  if (ti === ORE_OIL) return 'crude-oil';
  if (ti === ORE_URANIUM) return 'uranium-ore';
  if (ti === ORE_ASTEROID) return randomAsteroidChunk();
  if (ti === ORE_TUNGSTEN) return 'tungsten-ore';
  if (ti === ORE_HOLMIUM) return 'holmium-ore';
  return ORES[ti];
}
// 是否为可开采的矿脉格（含普通矿 + 铀矿 + 小行星 + 祝融星钨矿 + 雷神星钬矿）。
// 集中判断，供采矿机/手挖/渲染复用，避免各文件分散维护矿石清单。
function isOreType(ti) {
  return (ti >= 0 && ti < ORES.length) || ti === ORE_URANIUM || ti === ORE_ASTEROID || ti === ORE_TUNGSTEN || ti === ORE_HOLMIUM;
}
// 随机返回一种小行星碎块（金属/碳质/氧化），破碎机可粉碎加工
function randomAsteroidChunk() {
  const r = Math.random();
  if (r < 0.4) return 'metallic-asteroid-chunk';
  if (r < 0.7) return 'carbonic-asteroid-chunk';
  return 'oxide-asteroid-chunk';
}
// 按矿点坐标确定性返回一种小行星碎块：同一矿点始终产出同一种星块，
// 避免采矿机缓冲内混入多种星块类型（破碎机/传送带以单类型处理）。
function asteroidChunkFor(tx, ty) {
  const h = ((tx * 374761393 + ty * 668265263) ^ (tx * ty)) >>> 0;
  const r = h % 100 / 100;
  if (r < 0.4) return 'metallic-asteroid-chunk';
  if (r < 0.7) return 'carbonic-asteroid-chunk';
  return 'oxide-asteroid-chunk';
}
const PIPE_CAP = GAME_DATA.fluidCapacity?.pipeVolume ?? 100;   // 管道容量（官方 pipe fluid_box.volume=100，由 GAME_DATA 桥接）
const PIPE_FLOW = 3;
// 储液罐（对齐《异星工厂》Storage Tank）：占地 3×3、容量大、只存单一流体，东西两侧各一个通用流体口
const STORAGE_TANK_CAP = GAME_DATA.fluidCapacity?.storageTank ?? 2500; // 储液罐容量（官方 25000）
const FLUID_WAGON_CAP = GAME_DATA.fluidCapacity?.fluidWagon ?? 2500;   // 流体车厢容量（官方 50000）
// 载具装备网格尺寸（对齐《异星工厂》Vehicle equipment grid：Car 5×5、Tank 6×6；蜘蛛机另用 4×4 见 vehicle.js）
// 载具可安装个人装备件（外骨骼加速、太阳能板/聚变堆供能、电池储电、夜视/传送带免疫等）
const VEHICLE_GRIDS = { car: 5, tank: 6 };

const SCIENCE_PACKS = ['automation-science-pack', 'logistic-science-pack', 'chemical-science-pack', 'military-science-pack', 'production-science-pack', 'utility-science-pack', 'space-science-pack', 'electromagnetic-science-pack', 'agricultural-science-pack', 'metallurgic-science-pack', 'promethium-science-pack', 'cryogenic-science-pack'];
function isScience(item) { return SCIENCE_PACKS.indexOf(item) >= 0; }
const FILTER_CHOICES = ['iron-plate', 'copper-plate', 'steel-plate', 'iron-gear-wheel', 'iron-stick', 'copper-cable', 'electronic-circuit',
  'coal', 'solid-fuel', 'stone', 'plastic-bar', 'automation-science-pack', 'logistic-science-pack', 'chemical-science-pack', 'military-science-pack',
  'production-science-pack', 'utility-science-pack', 'space-science-pack', 'flying-robot-frame',
  'firearm-magazine', 'piercing-rounds-magazine', 'uranium-rounds-magazine', 'uranium-cannon-shell', 'flamethrower-ammo', 'poison-capsule', 'slowdown-capsule', 'shotgun-shell', 'piercing-shotgun-shell', 'cluster-grenade', 'logistic-robot', 'construction-robot', 'uranium-235', 'uranium-238', 'nuclear-fuel', 'uranium-fuel-cell', 'depleted-uranium-fuel-cell', 'sulfur', 'carbon', 'raw-fish', 'yumako', 'yumako-mash', 'bioflux', 'nutrients', 'spoilage', 'agricultural-science-pack', 'artificial-yumako-soil', 'overgrowth-yumako-soil', 'artificial-jellynut-soil', 'overgrowth-jellynut-soil', 'jellynut', 'jellynut-seed', 'jelly', 'biter-egg', 'pentapod-egg'].concat(FLUIDS);
function techPacks(tid) { return (TECHS && TECHS[tid] && TECHS[tid].cost) || {}; }
function techCostTotal(tid) {
  let s = 0;
  for (const k in techPacks(tid)) s += techPacks(tid)[k];
  return s;
}
function techNeedList(tid) {
  const cost = techPacks(tid), arr = [];
  for (const item in cost) for (let i = 0; i < cost[item]; i++) arr.push(item);
  return arr;
}

// ===== 官方功耗数据桥接（GAME_DATA 由 factorio-data 现场生成，见 tools/generate-game-data.js）=====
// 与《异星工厂》官方完全一致：官方 energy_usage 覆盖手工值（单位 kW）。
for (const k in (GAME_DATA.powerUse || {})) {
  if (typeof GAME_DATA.powerUse[k] === 'number' && GAME_DATA.powerUse[k] > 0) POWER_USE[k] = GAME_DATA.powerUse[k];
}

// ===== 官方带速桥接（deviceStats.beltSpeed 已换算为格/秒；快带/极速倍率 = 官方速度比）=====
{
  const ds = GAME_DATA.deviceStats || {};
  const b = ds['transport-belt'], f = ds['fast-transport-belt'], e = ds['express-transport-belt'], t = ds['turbo-transport-belt'];
  if (b && typeof b.beltSpeed === 'number') BELT_SPEED = b.beltSpeed;
  if (b && f && b.beltSpeed > 0 && typeof f.beltSpeed === 'number') FAST_BELT_MULT = f.beltSpeed / b.beltSpeed;
  if (b && e && b.beltSpeed > 0 && typeof e.beltSpeed === 'number') EXPRESS_BELT_MULT = e.beltSpeed / b.beltSpeed;
  if (b && t && b.beltSpeed > 0 && typeof t.beltSpeed === 'number') TURBO_BELT_MULT = t.beltSpeed / b.beltSpeed;
}

