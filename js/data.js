'use strict';

const TILE = 32;
const CHUNK = 32;
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

let BELT_SPEED = 1.875;   // 基础传送带速度（格/秒），对齐《异星工厂》1.875 tiles/s（官方 speed 0.03125 格/tick × 60，由 GAME_DATA 桥接）
const BELT_SPACING = 0.125; // 物品间隔（格）0.125=1/8 格/件，每列 8 件/格；以「双车道合计」计 → 基础带双车道合计 15 items/s（每车道 7.5）
let FAST_BELT_MULT = 2;    // 快速传送带 = 2× 基础（对齐《异星工厂》3.75 tiles/s，由 GAME_DATA 桥接）
let EXPRESS_BELT_MULT = 3; // 极速传送带 = 3× 基础（对齐《异星工厂》5.625 tiles/s，由 GAME_DATA 桥接）
const COAL_ENERGY = 12;
const WOOD_FUEL_ENERGY = 3;   // 木材能量密度（约煤的 1/4），对齐《异星工厂》：原木可作低效燃料
const SOLID_FUEL_ENERGY = 50;   // 固体燃料能量密度（对齐《异星工厂》：约 4 倍于煤），可作煤的替代燃料
const ROCKET_FUEL_ENERGY = 500; // 火箭燃料能量密度（对齐《异星工厂》：约 10 倍于固体燃料、约 40 倍于煤），可燃烧燃料
const NUCLEAR_FUEL_ENERGY = 2500; // 核燃料能量密度（对齐《异星工厂》：核燃料约 1.21GJ，约为火箭燃料 225MJ 的 5 倍多），可作载具/车头/锅炉等燃烧器的最高级燃料
const SELF_FUEL_MAX = 4;   // 热能采矿机燃料槽容量（对齐《异星工厂》：burner mining drill 16MJ/4MJ=4 个煤）
const DRILL_BUFFER_CAP = 20; // 采矿机矿物输出缓冲上限（对齐《异星工厂》：采矿机内置 20 格输出缓冲）
const UNDERGROUND_MAX = GAME_DATA.undergroundDist?.['underground-belt'] ?? 6;
const FAST_UNDERGROUND_MAX = GAME_DATA.undergroundDist?.['fast-underground-belt'] ?? 14;
const EXPRESS_UNDERGROUND_MAX = GAME_DATA.undergroundDist?.['express-underground-belt'] ?? 20;
const UG_CAP = 8;  // 地下带每列缓存容量（双列，两列共 2×UG_CAP 件），对齐传送带每列每格 8 件
const DRILL_TIME = 1.0;
// 各矿石的采矿时间（秒，采 1 个矿所需基础时间），对齐《异星工厂》每种资源独立的 mining_time：
//   普通矿（铁/铜/煤/石）mining_time = 2s；铀矿 mining_time = 4s。
// 实际每采 1 个矿耗时 = 该矿石采矿时间 ÷ 采矿机速度（热能 0.25 / 电 0.5）。
const ORE_MINING_TIME = {
  'iron-ore': 2.0, 'copper-ore': 2.0, 'coal': 2.0, 'stone': 2.0, 'uranium-ore': 4.0
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
const POWER_PER_ENGINE = 900;   // 蒸汽机满功率输出
const POWER_PER_TURBINE = 5820; // 汽轮机满功率输出（官方 effectivity1 × 60/s × (500-15)°C × 200J = 5.82MW）
const CENTRIFUGE_POWER = 350;   // 离心机功耗 kW（对齐《异星工厂》350kW）
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
const HEAT_EXCHANGER_SPECIFIC_HEAT = 1;    // 热交换器比热 1MJ/°C（官方，本数据集中为简化锅炉型 → 手工）
const REACTOR_MAX_TRANSFER = GAME_DATA.heat?.reactorMaxTransfer ?? 10000;  // 反应堆最大传热 10GW=10000MW（官方 max_transfer）
const HEAT_PIPE_MAX_TRANSFER = GAME_DATA.heat?.heatPipeMaxTransfer ?? 1000; // 导热管最大传热 1GW=1000MW（官方 max_transfer）
const HEAT_EXCHANGER_MAX_TRANSFER = 2000;  // 热交换器最大传热 2GW=2000MW（官方 max_transfer，手工）
const REACTOR_HEAT_RATE = GAME_DATA.heat?.reactorHeatRate ?? 40;  // 反应堆热功率 40MW（铀燃料棒 8GJ / 200s，官方）
const HEAT_EXCHANGER_MIN_WORK_TEMP = 500;  // 热交换器最低工作温度 500°C（官方 min_working_temperature，手工）
const HEAT_PIPE_MIN_GLOW_TEMP = GAME_DATA.heat?.heatPipeMinGlowTemp ?? 350; // 导热管/热设备最低发光温度 350°C（官方 minimum_glow_temperature）
const HEAT_EXCHANGER_ENERGY_PER_STEAM = 20;// 热交换器每产 1 单位蒸汽需消耗热量(MJ)，满产(2单位/s)恰好消耗反应堆 40MW 热功率
const HEAT_EXCHANGER_STEAM_RATE = 2.0;     // 热交换器满功率产汽速率（单位/秒）
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

const FLUIDS = ['water', 'steam', 'crude-oil', 'heavy-oil', 'light-oil', 'petroleum-gas', 'lubricant', 'sulfuric-acid'];
// 矿石索引：iron/copper/coal/stone = 0-3；原油 = 5（不进手挖矿表）；铀矿 = 6。
// ⚠️ 版本迁移：早期版本原油索引为 5，本次新增铀矿后改为 6，读档时对旧档做 5→6 重映射。
const ORE_OIL = 5;                       // 原油矿床的 oreType 索引（不进手挖矿表）
const ORE_URANIUM = 6;                   // 铀矿床的 oreType 索引
function oreItemId(ti) {
  if (ti === ORE_OIL) return 'crude-oil';
  if (ti === ORE_URANIUM) return 'uranium-ore';
  return ORES[ti];
}
const PIPE_CAP = GAME_DATA.fluidCapacity?.pipeVolume ?? 100;   // 管道容量（官方 pipe fluid_box.volume=100，由 GAME_DATA 桥接）
const PIPE_FLOW = 3;
// 储液罐（对齐《异星工厂》Storage Tank）：占地 3×3、容量大、只存单一流体，东西两侧各一个通用流体口
const STORAGE_TANK_CAP = GAME_DATA.fluidCapacity?.storageTank ?? 2500; // 储液罐容量（官方 25000）
const FLUID_WAGON_CAP = GAME_DATA.fluidCapacity?.fluidWagon ?? 2500;   // 流体车厢容量（官方 50000）
// 载具装备网格尺寸（对齐《异星工厂》Vehicle equipment grid：Car 5×5、Tank 6×6；蜘蛛机另用 4×4 见 vehicle.js）
// 载具可安装个人装备件（外骨骼加速、太阳能板/聚变堆供能、电池储电、夜视/传送带免疫等）
const VEHICLE_GRIDS = { car: 5, tank: 6 };

const SCIENCE_PACKS = ['automation-science-pack', 'logistic-science-pack', 'chemical-science-pack', 'military-science-pack', 'production-science-pack', 'utility-science-pack', 'space-science-pack', 'electromagnetic-science-pack'];
function isScience(item) { return SCIENCE_PACKS.indexOf(item) >= 0; }
const FILTER_CHOICES = ['iron-plate', 'copper-plate', 'steel-plate', 'iron-gear-wheel', 'iron-stick', 'steel-stick', 'copper-cable', 'electronic-circuit',
  'coal', 'solid-fuel', 'stone', 'plastic-bar', 'automation-science-pack', 'logistic-science-pack', 'chemical-science-pack', 'military-science-pack',
  'production-science-pack', 'utility-science-pack', 'space-science-pack', 'flying-robot-frame',
  'firearm-magazine', 'piercing-rounds-magazine', 'uranium-rounds-magazine', 'uranium-cannon-shell', 'flamethrower-ammo', 'poison-capsule', 'slowdown-capsule', 'shotgun-shell', 'piercing-shotgun-shell', 'cluster-grenade', 'logistic-robot', 'construction-robot', 'uranium-235', 'uranium-238', 'nuclear-fuel', 'uranium-fuel-cell', 'depleted-uranium-fuel-cell', 'sulfur', 'carbon', 'raw-fish'].concat(FLUIDS);
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
  const b = ds['transport-belt'], f = ds['fast-transport-belt'], e = ds['express-transport-belt'];
  if (b && typeof b.beltSpeed === 'number') BELT_SPEED = b.beltSpeed;
  if (b && f && b.beltSpeed > 0 && typeof f.beltSpeed === 'number') FAST_BELT_MULT = f.beltSpeed / b.beltSpeed;
  if (b && e && b.beltSpeed > 0 && typeof e.beltSpeed === 'number') EXPRESS_BELT_MULT = e.beltSpeed / b.beltSpeed;
}

