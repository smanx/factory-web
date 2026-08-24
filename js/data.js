'use strict';

const TILE = 32;
const CHUNK = 32;
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

const BELT_SPEED = 1.875;   // 基础传送带速度（格/秒），对齐《异星工厂》1.875 tiles/s
const BELT_SPACING = 0.25;
const FAST_BELT_MULT = 2;    // 快速传送带 = 2× 基础（对齐《异星工厂》3.75 tiles/s）
const EXPRESS_BELT_MULT = 3; // 极速传送带 = 3× 基础（对齐《异星工厂》5.625 tiles/s）
const COAL_ENERGY = 12;
const SELF_FUEL_MAX = 10;
const UNDERGROUND_MAX = 6;
const FAST_UNDERGROUND_MAX = 14;
const EXPRESS_UNDERGROUND_MAX = 20;
const UG_CAP = 8;
const DRILL_TIME = 1.0;
const HAND_MINE_TIME = 0.45;
const REACH_TILES = 5.5;
const REACH_PX = REACH_TILES * TILE;
const LAB_TIME = 1; // 研究中心每瓶科学包耗时（秒）
// 功率数值对齐《异星工厂》(Factorio) 官方 Wiki（单位 kW）
// ===== 火箭发射（终局目标，对齐《异星工厂》火箭发射井）=====
// 发射井固定配方：4 低密度结构 + 4 火箭燃料 + 4 处理器 → 1 火箭部件（12 秒/件）；
// 攒满 100 个部件自动点火发射（Space Age 同款 50 部件的减负版取 100 对齐本体）。
const ROCKET_PART_TIME = 12;
const ROCKET_PARTS_TOTAL = 100;
const ROCKET_LAUNCH_DUR = 8;   // 点火到升空完成的动画时长（秒）
const SILO_INPUT_CAP = 200;    // 发射井每种原料缓存上限
const ROCKET_PART_RECIPE = { time: ROCKET_PART_TIME, inp: { 'low-density-structure': 4, 'rocket-fuel': 4, 'processing-unit': 4 }, out: { 'rocket-part': 1 } };
// ===== 插件模块（对齐《异星工厂》Modules：速度/产能/效能 ×3 阶）=====
// speed：设备速度加成；power：耗电倍率增量；prod：额外免费产出概率
const MODULES = {
  'speed-module':          { tier: 1, kind: 'speed', speed: 0.20, power: 0.40 },
  'speed-module-2':        { tier: 2, kind: 'speed', speed: 0.30, power: 0.60 },
  'speed-module-3':        { tier: 3, kind: 'speed', speed: 0.50, power: 0.80 },
  'productivity-module':   { tier: 1, kind: 'prod',  prod: 0.04, speed: -0.05, power: 0.40 },
  'productivity-module-2': { tier: 2, kind: 'prod',  prod: 0.06, speed: -0.10, power: 0.60 },
  'productivity-module-3': { tier: 3, kind: 'prod',  prod: 0.10, speed: -0.15, power: 0.80 },
  'effectivity-module':    { tier: 1, kind: 'eff',   power: -0.30 },
  'effectivity-module-2':  { tier: 2, kind: 'eff',   power: -0.40 },
  'effectivity-module-3':  { tier: 3, kind: 'eff',   power: -0.50 }
};
// 模块效果下限（对齐《异星工厂》：速度/耗电最低降至 20%）
const MOD_SPEED_MIN = 0.2;
const MOD_POWER_MIN = 0.2;
// 各设备模块插槽数（对齐《异星工厂》：组装机 II=2 / III=4，化工厂/炼油厂=4，研究中心=2）
const MODULE_SLOTS = {
  'assembling-machine-mk2': 2,
  'assembling-machine-3': 4,
  'chemical-plant': 4,
  'refinery': 4,
  'lab': 2
};
// ===== 信标（对齐《异星工厂》Beacon）：向作用半径内的机器转发模块效果 =====
const BEACON_RANGE = 8;    // 信标中心到机器中心的最大作用距离（格）
const BEACON_EFF = 0.5;    // 信标转发模块效果的折算系数（多台信标叠加）
// ===== 物流机器人网络（对齐《异星工厂》Logistic network）=====
const ROBO_COVER_R = 22;          // 机器人港口覆盖半径（格）
const ROBO_PORT_ROBOT_CAP = 50;   // 每座港口可容纳机器人数
const ROBOT_CARRY = 4;            // 物流机器人一次搬运件数
const ROBOT_SPEED = 5.2;          // 巡航速度（格/秒）
const ROBOT_CHARGE_MAX = 100;     // 机器人的电量上限
const ROBOT_DRAIN_PER_TILE = 0.6; // 每飞行一格消耗的电量
const ROBOT_RECHARGE_RATE = 14;   // 停靠充电速率（电量/秒，受电网供电比例影响）
const ROBOT_JOB_RESERVE = 10;     // 接单所需最低电量冗余
// ===== 核能链（对齐《异星工厂》Nuclear power）=====
// 链路：铀矿 → 离心机分离 U-235/U-238 → 合成核燃料棒 → 反应堆燃烧产热
//       → 热管导热 → 换热器（≥500°C）烧水成蒸汽 → 汽轮机高效发电
const URANIUM_ORE_TI = 6;         // 铀矿的 oreType 索引（ORES 数组第 7 位，见 ORES 定义）
const REACTOR_BURN_TIME = 120;    // 每根核燃料棒燃烧时长（秒），对齐本体 200s 的缩放版
const REACTOR_HEAT_RATE = 240;    // 反应堆满负荷每秒产热（热单位/s）：恰好带 4 台换热器
const REACTOR_NEIGHBOR_BONUS = 1.0; // 每台相邻反应堆 +100% 产热（对齐本体邻居加成）
const HEAT_CAP_PER_TILE = 24;     // 热实体每格热容量（热单位）；占满即 1000°C
const HEAT_TEMP_MAX = 1000;       // 热实体最高温度（°C）
const HEAT_EXCH_TEMP_MIN = 500;   // 换热器最低工作温度（°C，对齐本体 500°C 高温蒸汽）
const HEAT_TRANSFER_K = 0.6;      // 相邻热实体间导热系数（温差越大传热越快）
const EXCHANGER_STEAM_RATE = 2.4; // 换热器满负荷产汽速率（单位/秒）：恰好带满 2 台汽轮机
const HEAT_PER_STEAM = 25;        // 换热器每产出 1 单位蒸汽消耗的热量
const TURBINE_POWER = 3600;       // 汽轮机满功率输出（kW）= 4 台蒸汽机，1 台反应堆 ≈ 32 台蒸汽机
const TURBINE_STEAM_RATE = 1.2;   // 汽轮机满功率耗汽（单位/秒），效率约为蒸汽机的 2 倍/汽
const TURBINE_STEAM_CAP = 20;     // 汽轮机内部储汽上限（高于蒸汽机，缓冲更足）
const REACTOR_FUEL_CAP = 5;       // 反应堆内可存的燃料棒上限
// ===== 铁路运输（对齐《异星工厂》Railway）=====
// 铁轨连成轨道网 → 车站命名停靠点 → 机车按"车站计划表"自动往返，
// 货运车厢停靠时经机械臂装卸货物。速度/加速度对齐本体手感缩放到本作格距。
const TRAIN_SPEED_MAX = 9;        // 列车最高速度（格/秒），远快于传送带的终局物流
const TRAIN_ACCEL = 2.5;          // 加速度（格/秒²）
const TRAIN_BRAKE = 6;            // 制动减速度（格/秒²），进站自动刹停
const WAGON_CAP = 400;            // 每节货运车厢载货上限（件）
const LOCO_FUEL_CAP = 5;          // 机车燃料仓容量（块煤）
const TRAIN_FUEL_VALUES = { 'coal': COAL_ENERGY, 'solid-fuel': COAL_ENERGY * 2, 'rocket-fuel': COAL_ENERGY * 5 };
const POWER_PER_ENGINE = 900;   // 蒸汽机满功率输出
const POWER_USE = {
  'electric-drill': 90,          // 电采矿机
  'electric-furnace': 180,       // 电炉
  'assembling-machine': 75,      // 组装机 I
  'assembling-machine-mk2': 150, // 组装机 II
  'assembling-machine-3': 375,   // 组装机 III
  'pumpjack': 90,                // 抽油机
  'refinery': 420,               // 炼油厂
  'chemical-plant': 210,         // 化工厂
  'lab': 60,                     // 研究中心
  'centrifuge': 350,             // 离心机
  'rocket-silo': 350,            // 火箭发射井
  'beacon': 480                  // 信标（装有模块时耗电）
};

// ===== 发电链（抽水机 → 水 → 锅炉烧出蒸汽 → 蒸汽口送汽 → 蒸汽机发电）=====
const WATER_CAP = 20;            // 锅炉/抽水机内部储水上限（兼作锅炉蒸汽缓冲上限）
const BOILER_WATER_RATE = 1.2;   // 锅炉每秒耗水（1:1 转为蒸汽输出）
const BOILER_HEAT_RATE = 30;     // 锅炉每秒升温（°C，耗煤+水时）
const BOILER_COOL_RATE = 2;      // 锅炉每秒自然降温（°C）
const BOILER_TEMP_MAX = 100;     // 温度达标线
const PUMP_RATE = 6;             // 抽水机每秒产水
const ENGINE_STEAM_RATE = 0.6;   // 蒸汽机满功率耗汽（单位/秒）：1 台锅炉可带 2 台蒸汽机
const ENGINE_STEAM_CAP = 10;     // 蒸汽机内部储汽上限

const FLUIDS = ['water', 'steam', 'crude-oil', 'heavy-oil', 'light-oil', 'petroleum-gas', 'lubricant', 'sulfuric-acid'];
const ORE_OIL = 5;                       // 原油矿床的 oreType 索引（不进手挖矿表）
function oreItemId(ti) { return ti === ORE_OIL ? 'crude-oil' : ORES[ti]; }
const PIPE_CAP = 40;
const PIPE_FLOW = 3;
// 储液罐（对齐《异星工厂》Storage Tank）：占地 3×3、容量大、只存单一流体，东西两侧各一个通用流体口
const STORAGE_TANK_CAP = 2500;

const SCIENCE_PACKS = ['science-pack', 'green-science', 'blue-science', 'military-science', 'production-science', 'utility-science'];
function isScience(item) { return SCIENCE_PACKS.indexOf(item) >= 0; }
const FILTER_CHOICES = ['iron-plate', 'copper-plate', 'steel-plate', 'iron-gear', 'copper-cable', 'green-circuit',
  'coal', 'stone', 'plastic-bar', 'science-pack', 'green-science', 'blue-science', 'military-science',
  'magazine', 'piercing-rounds', 'sulfur', 'battery', 'advanced-circuit', 'processing-unit',
  'electric-engine-unit', 'flying-robot-frame', 'low-density-structure', 'rocket-fuel',
  'speed-module', 'speed-module-2', 'speed-module-3',
  'productivity-module', 'productivity-module-2', 'productivity-module-3',
  'effectivity-module', 'effectivity-module-2', 'effectivity-module-3',
  'production-science', 'utility-science',
  'uranium-ore', 'uranium-235', 'uranium-238', 'nuclear-fuel-cell', 'used-up-fuel-cell',
  'rail', 'train-stop', 'locomotive', 'cargo-wagon'].concat(FLUIDS);
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

const ITEMS = {
  'iron-ore':   { name: '铁矿石', color: '#8fa0b8', mark: 'Fe', desc: '基础矿物，放入石炉冶炼成铁板' },
  'copper-ore': { name: '铜矿石', color: '#d0793f', mark: 'Cu', desc: '基础矿物，放入石炉冶炼成铜板' },
  'coal':       { name: '煤',     color: '#3a3a42', mark: 'C',  desc: '燃料，供采矿机与石炉燃烧' },
  'stone':      { name: '石头',   color: '#b3a685', mark: 'St', desc: '合成石炉的材料，可在熔炉烧成石砖' },
  'stone-brick': { name: '石砖',   color: '#b3a685', mark: 'Sb', desc: '由石头在熔炉烧制，可在组装机合成石墙' },
  'calcite':    { name: '方解石', color: '#e8e0d0', mark: 'Ca', desc: '矿物，用于炼油厂煤液化配方（太空时代）' },
  'uranium-ore': { name: '铀矿石', color: '#7ed83c', mark: 'U', desc: '放射性矿物（亮绿色晶簇），在离心机中分离出铀-235 与铀-238' },
  'uranium-235': { name: '铀-235', color: '#a4f04c', mark: 'U5', desc: '稀有裂变同位素，与铀-238 一起合成核燃料棒；Kovarex 流程可增殖' },
  'uranium-238': { name: '铀-238', color: '#5a8a4a', mark: 'U8', desc: '丰产同位素，核燃料棒的主要原料，也是 Kovarex 增殖的消耗品' },
  'iron-plate':   { name: '铁板',   color: '#ccd4de', mark: 'Fp', desc: '最常用的结构材料' },
  'copper-plate': { name: '铜板',   color: '#e0975f', mark: 'Cp', desc: '用于拉制铜线' },
  'iron-gear':    { name: '铁齿轮', color: '#aab5c2', mark: 'G',  desc: '机械核心零件' },
  'copper-cable': { name: '铜线',   color: '#e8a06a', mark: 'W',  desc: '制造电路板的原料' },
  'green-circuit':{ name: '电路板', color: '#57b95c', mark: 'GC', desc: '自动化与科研的基础元件' },
  'science-pack': { name: '自动化科学包', color: '#d04848', mark: 'SP', desc: '红色科学包，初期的科研消耗品（自动化科学）' },
  'transport-belt':    { name: '传送带', color: '#e0b23c', desc: '运输物品，R 旋转方向，可拖动铺设' },
  'inserter':          { name: '机械臂', color: '#d8cf4e', desc: '严格单向：臂体侧取货、箭头侧放货（亮色箭头=物流方向）' },
  'long-inserter':     { name: '长臂机械臂', color: '#e08a4a', desc: '同机械臂，但取放都延伸到第二格' },
  'burner-drill':      { name: '热能采矿机', color: '#c46a3a', desc: '放在矿上自动开采，产出朝向前方，需煤' },
  'stone-furnace':     { name: '石炉',   color: '#9c9486', desc: '把矿石冶炼成板材，需煤作燃料' },
  'assembling-machine':{ name: '组装机', color: '#6f86c9', desc: '设置配方后自动生产（3×3）' },
  'storage-chest':     { name: '储物箱', color: '#8a6a45', desc: '存放物资，配合机械臂自动装卸' },
  'lab':               { name: '研究中心', color: '#4aa8a0', desc: '消耗科学包推进所选科技（3×3）' },
  'splitter':          { name: '分流器', color: '#d98f3c', desc: '把一条带的货轮流分向前方和右侧；一边堵了自动走另一边' },
  'underground':       { name: '地下传送带', color: '#9a7fd6', desc: '同向摆两座（最远6格）自动配对：入口收货钻入地下，出口送回地面向前输出' },
  'steel-plate':       { name: '钢板',   color: '#c9ced6', mark: 'S', desc: '电炉炼铁板产出的高级建材' },
  'boiler':            { name: '锅炉',   color: '#d0743a', desc: '烧煤+水产出蒸汽（3×2）：左右两端各一只蓝口水口，双向进出、水位互通平衡，可从一端进水另一端出、多台同排串联；底边中间白口=出汽口，向下接蒸汽机或蒸汽管道' },
  'steam-engine':      { name: '蒸汽机', color: '#8fb8d0', desc: '蒸汽发电（3×5）：上下两端各一只功能相同的通用汽口，蒸汽可从任意一端进入，多余蒸汽也可从另一端送出，支持首尾串联；供汽越足功率越高，满功率并入全图电网' },
  'offshore-pump':     { name: '抽水机', color: '#3f9fc0', mark: 'P', desc: '必须放在水面上，免电力无限抽水；产出朝箭头方向，指向锅炉左端/右端的蓝口水口可直接供水，或接管道（2×1）' },
  'water':             { name: '水',     color: '#4a90d9', mark: 'H₂O', desc: '流体，由抽水机从水域抽取，经管道或锅炉两端水口送入锅炉烧成蒸汽' },
  'steam':             { name: '蒸汽',   color: '#c8d4dc', mark: '汽', desc: '流体，锅炉烧水所得；经锅炉出汽口或蒸汽管道送往蒸汽机发电' },
  'electric-drill':    { name: '电采矿机', color: '#4f7dd3', desc: '免燃料、吃电力开采，速度快于热能采矿机（3×3）' },
  'electric-furnace':  { name: '电炉',   color: '#3fa87e', desc: '免燃料、吃电力冶炼，速度更高，可出钢板（3×3）' },
  'assembling-machine-mk2': { name: '组装机 II', color: '#a05fd0', desc: '吃电力、速度更高的高级组装机（3×3）' },
  'fast-transport-belt': { name: '快速传送带', color: '#f2c14e', desc: '速度约为普通带的 2 倍（对齐《异星工厂》）' },
  'fast-underground-belt': { name: '快速地下传送带', color: '#b98ee0', desc: '同向配对距离最远 14 格，速度是快带标准' },
  'express-transport-belt': { name: '极速传送带', color: '#e05a4e', desc: '速度约为普通带的 3 倍，物流终极档（对齐《异星工厂》）' },
  'express-underground-belt': { name: '极速地下传送带', color: '#e07a6a', desc: '同向配对距离最远 20 格，速度是极速带标准' },
  'express-splitter': { name: '极速分流器', color: '#e06048', desc: '同分流器，但吞吐与极速带一致，可输送最快物流' },
  'priority-splitter': { name: '优先级分流器', color: '#e07b2e', desc: '同分流器，但可通过面板指定优先把货推向一侧；另一侧仅作为溢出通道' },
  'filter-inserter':   { name: '过滤机械臂', color: '#58b8e8', desc: '同机械臂，可在面板指定只抓取某种物品' },
  'stack-inserter':    { name: '堆叠机械臂', color: '#e8e059', desc: '同机械臂，但可一次性抓取多达 3 个同种物品' },
  'steel-chest':       { name: '钢箱', color: '#9aa4b0', desc: '比储物箱容量更大的钢铁储物箱（24 格）' },
  'creative-chest':    { name: '创造箱', color: '#3e8f4a', mark: '∞', desc: '测试设备：无限生成选定物品，点开面板选择要生成的物品，机械臂可无限取走' },
  'void-chest':        { name: '虚空箱', color: '#4a3430', mark: '×', desc: '测试设备：无限销毁任何存入的物品，放进去即刻消失' },
  'green-science':     { name: '物流科学包', color: '#6fd06f', mark: 'GS', desc: '绿色科学包，解锁二级科技（物流/石油等的钥匙）' },
  'blue-science':      { name: '化工科学包', color: '#4f9fe8', mark: 'BS', desc: '蓝色科学包，依赖石油与塑料的高级科研包' },
  'crude-oil':         { name: '原油', color: '#2a2418', mark: 'Oil', desc: '流体，用抽油机开采，经管道输送' },
  'heavy-oil':         { name: '重油', color: '#5a3a1e', mark: 'HO', desc: '炼油副产物，常作为润滑油等原料' },
  'light-oil':         { name: '轻油', color: '#8a5a22', mark: 'LO', desc: '炼油副产物，可继续加工成石油气' },
  'petroleum-gas':     { name: '石油气', color: '#c9a84a', mark: 'PG', desc: '炼油关键产物，制造塑料的原料' },
  'plastic-bar':       { name: '塑料板', color: '#cfe8a8', mark: 'Pl', desc: '石油化工产物，须在化工厂用石油气+煤生产，用于高级配方' },
  'pipe':              { name: '管道', color: '#6a5f52', desc: '输送流体（水/蒸汽/原油/重轻油/石油气），相邻互连，容量 40' },
  'pipe-to-ground':    { name: '地下管道', color: '#8a7a6a', desc: '同向摆两座（最远 10 格）自动配对，从地下穿行流体，可跨过传送带/管道' },
  'pump':              { name: '流体泵', color: '#5aa0a8', desc: '从背侧吸入流体、向前侧加压泵出，单向输送、提速吞吐（1×1）' },
  'storage-tank':      { name: '储液罐', color: '#7d95a8', desc: '大容量存储任意一种液体/气体（3×3，容量 ' + STORAGE_TANK_CAP + '）。东西两侧各一只通用流体口，可进可出；罐内只能容纳单一流体。相邻管道会自动把流体灌入罐内，罐也会向相邻炼油厂/化工厂等输入口供料，作为缓冲库容使用' },
  'creative-pipe':     { name: '创造管道', color: '#3e8f4a', mark: '∞', desc: '测试设备：无限生成选定的流体，点开面板选择要生成的流体，源源不断灌入相邻管道/储液罐' },
  'void-pipe':         { name: '虚空管道', color: '#6a3a3a', mark: '×', desc: '测试设备：无限销毁流经的流体，相邻管道会把流体持续排入这里销毁' },
  'creative-belt':     { name: '创造传送带', color: '#3e8f4a', mark: '∞', desc: '测试设备：点开面板选择要生成的物品，带上无限产出该物品并随带流动，机械臂/玩家可无限取走（传送带）' },
  'void-belt':         { name: '虚空传送带', color: '#4a3430', mark: '×', desc: '测试设备：任何流转到这条带上的物品都会被即刻销毁，无法取出，作为物流销毁汇点（传送带）' },
  'pumpjack':          { name: '抽油机', color: '#3a6a66', desc: '吃电力开采原油矿床，产出原油（3×3）' },
  'solar-panel':       { name: '太阳能板', color: '#3f6fc0', desc: '白天无燃料发电（2×2），并入全图电网' },
  'accumulator':       { name: '蓄电器', color: '#c9a84a', desc: '储存电力，白天充电、夜间放电（2×2），平滑电网波动' },
  'passive-power':     { name: '被动供电设备', color: '#e0b23c', mark: '⚡', desc: '被动应急供电：电网电量不足时一次性供出剩余所有电兜底（2×2），仅无限资源模式可建造' },
  'steel-furnace':     { name: '钢铁炉', color: '#8b95a3', desc: '烧煤冶炼，速度高于石炉（2×2）' },
  'assembling-machine-3': { name: '组装机 III', color: '#7a58c8', desc: '吃电力、速度最高的组装机（3×3）' },
  'military-science':  { name: '军事科学包', color: '#b0b0b0', mark: 'MS', desc: '灰色科学包，解锁军事科技（炮塔/墙壁/弹药等）' },
  'gun-turret':        { name: '机枪炮塔', color: '#5a5a66', desc: '自动攻击进入射程的敌人，需装入弹药（2×2）' },
  'stone-wall':        { name: '石墙', color: '#8d8578', desc: '防御障碍，阻挡敌人与玩家通行（1×1）' },
  'magazine':          { name: '弹药匣', color: '#b08a4a', desc: '机枪炮塔的标准弹药' },
  'piercing-rounds':   { name: '穿甲弹', color: '#b05a4a', desc: '比普通弹药威力更高的穿甲弹药' },
  'refinery':          { name: '炼油厂', color: '#b06a3e', desc: '把原油炼成重油/轻油/石油气，或煤液化（5×5，吃电力，需选配方）。背面2输入、正面3输出' },
  'chemical-plant':    { name: '化工厂', color: '#7d9464', desc: '流体化学加工厂：石油气+煤→塑料，重油/轻油裂解（3×3，吃电力）。底部2输入、顶部2输出，成对固定；固体原料机械臂任意方向放入' },
  'solid-fuel':        { name: '固体燃料', color: '#5a5a64', mark: 'F', desc: '由重油/轻油/石油气在化工厂制成的高能量燃料，也是火箭燃料的原料' },
  'lubricant':         { name: '润滑油', color: '#c86a2a', mark: 'Lu', desc: '流体，由重油在化工厂制成，电引擎单元的关键原料' },
  'sulfur':            { name: '硫', color: '#e0d44a', mark: 'S', desc: '石油气在化工厂的产物，用于制硫酸' },
  'sulfuric-acid':     { name: '硫酸', color: '#b5c23c', mark: 'Sa', desc: '流体，硫+水+铁板在化工厂反应所得；经管道供给组装机制造电池与处理器' },
  'battery':           { name: '电池', color: '#43c26e', mark: 'B', desc: '铁板+铜板+硫酸在组装机合成（硫酸需管道接入），飞行机器人机架的原料' },
  'advanced-circuit':  { name: '高级电路板', color: '#cf4a3a', mark: 'AC', desc: '红色电路板：电路板+塑料板+铜线，处理器与高科技产品的核心元件' },
  'processing-unit':   { name: '处理器', color: '#c04ad0', mark: 'PU', desc: '蓝色电路板：高级电路板+电路板+硫酸，最高级电子元件，火箭部件必备' },
  'electric-engine-unit': { name: '电引擎单元', color: '#98a8bc', mark: 'EE', desc: '钢板+齿轮+润滑油在组装机合成，飞行机器人机架的动力核心' },
  'flying-robot-frame': { name: '飞行机器人机架', color: '#dfe6ee', mark: 'FR', desc: '电引擎单元+电池+电路板组装而成，黄色高科技科学包的主要部件' },
  'low-density-structure': { name: '低密度结构', color: '#d09a58', mark: 'LD', desc: '铜板+塑料板+钢板的轻量化高强度材料，火箭与高科技产品的骨架' },
  'rocket-fuel':       { name: '火箭燃料', color: '#d05a2a', mark: 'RF', desc: '固体燃料+轻油在组装机合成的高能燃料，推动火箭升空' },
  'rocket-part':       { name: '火箭部件', color: '#d8dde4', mark: 'Rp', desc: '只能在发射井内组装：低密度结构+火箭燃料+处理器；攒满100个即可点火发射' },
  'production-science':{ name: '生产科学包', color: '#c05acd', mark: 'PS', desc: '紫色科学包：石砖+钢板+电炉，解锁生产侧终极科技' },
  'utility-science':   { name: '高科技科学包', color: '#e0c840', mark: 'US', desc: '黄色科学包：飞行机器人机架+低密度结构+处理器，解锁最高科技与火箭' },
  'rocket-silo':       { name: '火箭发射井', color: '#8892a2', desc: '终局建筑（7×7）：自动组装火箭部件，攒满100个点火发射。发射火箭即达成通关目标！' },
  // ===== 插件模块（对齐《异星工厂》：插入机器插槽改变速度/耗电/产能）=====
  'speed-module':          { name: '速度模块 I',   color: '#e8d24a', mark: 'S1', desc: '设备速度 +20%，耗电 +40%。可插入组装机 II/III、化工厂、炼油厂、研究中心与信标' },
  'speed-module-2':        { name: '速度模块 II',  color: '#f0e05a', mark: 'S2', desc: '设备速度 +30%，耗电 +60%' },
  'speed-module-3':        { name: '速度模块 III', color: '#fff06a', mark: 'S3', desc: '设备速度 +50%，耗电 +80%' },
  'productivity-module':   { name: '产能模块 I',   color: '#c05acd', mark: 'P1', desc: '每次生产额外 +4% 免费产出，速度 -5%，耗电 +40%（不能插入研究中心）' },
  'productivity-module-2': { name: '产能模块 II',  color: '#ce6ada', mark: 'P2', desc: '额外 +6% 免费产出，速度 -10%，耗电 +60%' },
  'productivity-module-3': { name: '产能模块 III', color: '#dc7ae8', mark: 'P3', desc: '额外 +10% 免费产出，速度 -15%，耗电 +80%' },
  'effectivity-module':    { name: '效能模块 I',   color: '#57b95c', mark: 'E1', desc: '设备耗电 -30%。高耗电工厂的省钱利器' },
  'effectivity-module-2':  { name: '效能模块 II',  color: '#67c96c', mark: 'E2', desc: '设备耗电 -40%' },
  'effectivity-module-3':  { name: '效能模块 III', color: '#77d97c', mark: 'E3', desc: '设备耗电 -50%' },
  // ===== 信标与物流机器人网络 =====
  'beacon':            { name: '信标', color: '#4ac0c8', mark: '◈', desc: '（3×3）向作用半径 ' + BEACON_RANGE + ' 格内的机器转发其插槽内模块的效果（折算 ' + (BEACON_EFF * 100) + '%）。多台信标效果叠加，是全厂提速/增产的核心手段' },
  'roboport':          { name: '机器人港口', color: '#d0743a', mark: 'Rb', desc: '物流网络核心（4×4）：覆盖半径 ' + ROBO_COVER_R + ' 格，为停靠的物流机器人充电并派发搬运任务。把物流机器人放入港口即可组网' },
  'logistic-robot':    { name: '物流机器人', color: '#e05050', mark: 'Lo', desc: '在物流网络覆盖范围内自动把物品从被动物流箱/存储箱搬往请求箱，一次最多携带 ' + ROBOT_CARRY + ' 件；需放入机器人港口充电待命' },
  'logi-chest-passive': { name: '被动物流箱', color: '#b85a3a', mark: 'P', desc: '被动供应：网络中的机器人可从这里取货发往请求箱。配合机械臂投入产物即可实现全自动物流配送' },
  'logi-chest-storage': { name: '存储物流箱', color: '#5a7ab8', mark: 'S', desc: '存储物资，也可作为请求配送的次级取货来源（优先级低于被动供应箱）' },
  'logi-chest-requester': { name: '请求物流箱', color: '#4a9a6a', mark: 'Q', desc: '在面板中设置每种物品的请求数量，机器人会自动从网络内补货到设定值。产线供料神器' },
  // ===== 核能链（对齐《异星工厂》Nuclear power）=====
  'centrifuge':        { name: '离心机', color: '#7a8a5c', desc: '高速旋转分离铀同位素：铀加工 / Kovarex 铀浓缩 / 核废料再处理（3×3，吃电力）' },
  'nuclear-fuel-cell': { name: '核燃料棒', color: '#8fe05a', mark: 'Fu', desc: '铀-235+铀-238+铁板合成；放入核反应堆燃烧产热，烧完变成乏燃料棒' },
  'used-up-fuel-cell': { name: '乏燃料棒', color: '#4a5a42', mark: 'Ex', desc: '反应堆烧完的核废料，可在离心机再处理回收部分铀-238' },
  'nuclear-reactor':   { name: '核反应堆', color: '#4a4f58', desc: '燃烧核燃料棒产出巨量热量（5×5）：每台相邻反应堆 +100% 邻居加成；热量经热管送往换热器，热满自动保护性停堆不浪费燃料' },
  'heat-pipe':         { name: '热管', color: '#b06a2e', desc: '传导热量（1×1）：连接反应堆与换热器，温度越高颜色越亮（暗红→橙→白热）' },
  'heat-exchanger':    { name: '换热器', color: '#9a7d3e', desc: '把 ≥500°C 的热量转化为蒸汽（3×2）：两端蓝口水口进水、底边白汽口出汽，接法与锅炉一致；满负荷产汽可带满 2 台汽轮机' },
  'steam-turbine':     { name: '汽轮机', color: '#57b0a2', desc: '高效蒸汽发电（3×5）：接法与蒸汽机一致（两端通用汽口），功率 = 4 台蒸汽机，耗汽效率更高' },
  // ===== 铁路运输（对齐《异星工厂》Railway）=====
  'rail':              { name: '铁轨', color: '#8d8d94', mark: '═', desc: '铺设轨道（1×1）：相邻铁轨/车站自动连接成网，列车沿轨道行驶。拖动可连续铺设' },
  'train-stop':        { name: '车站', color: '#c9a53e', mark: 'S', desc: '铺在轨道上的停靠点：在面板中命名后加入机车计划表，列车到站自动停车装卸。同名车站视为同一目的地' },
  'locomotive':        { name: '机车头', color: '#b3402e', mark: 'L', desc: '列车动力核心：烧煤驱动，按计划表在车站间自动往返。须放在铁轨/车站上；车厢放在其旁边即挂接' },
  'cargo-wagon':       { name: '货运车厢', color: '#7a6a52', mark: 'W', desc: '载货 ' + WAGON_CAP + ' 件的车厢：放在机车/车厢旁边自动挂接；列车停站时机械臂可装卸货物' }
};

const ORES = ['iron-ore', 'copper-ore', 'coal', 'stone', 'calcite', null, 'uranium-ore'];
// 索引 5 保留给原油矿床（ORE_OIL），索引 6 为铀矿石（URANIUM_ORE_TI）。
// 手挖/采矿机遍历 ORES 时跳过 null（油床不进普通矿物流程）。
// 可开采矿物查表：油床（索引 5，值为 null）与越界一律返回 null
function mineableOre(ti) { return (ti >= 0 && ti < ORES.length && ORES[ti]) ? ORES[ti] : null; }

const SMELTS = [
  { id: 'iron-plate',   inp: 'iron-ore',   time: 3.2 },
  { id: 'copper-plate', inp: 'copper-ore', time: 3.2 },
  { id: 'steel-plate',  inp: 'iron-plate', inCount: 2, time: 16 },
  { id: 'stone-brick',  inp: 'stone',      time: 3.2 }
];

const RECIPES = {
  'steel-plate':        { time: 16,  inp: { 'iron-plate': 2 },                                   out: { 'steel-plate': 1 } },
  'iron-gear':          { time: 0.5, inp: { 'iron-plate': 2 },                                   out: { 'iron-gear': 1 } },
  'copper-cable':       { time: 0.5, inp: { 'copper-plate': 1 },                                 out: { 'copper-cable': 2 } },
  'green-circuit':      { time: 0.5, inp: { 'iron-plate': 1, 'copper-cable': 3 },                out: { 'green-circuit': 1 } },
  'science-pack':       { time: 5,   inp: { 'copper-plate': 1, 'iron-gear': 1 },                 out: { 'science-pack': 1 } },
  'transport-belt':     { time: 0.5, inp: { 'iron-plate': 1, 'iron-gear': 1 },                   out: { 'transport-belt': 2 } },
  'inserter':           { time: 1,   inp: { 'iron-plate': 1, 'iron-gear': 1, 'green-circuit': 1 }, out: { 'inserter': 1 } },
  'long-inserter':      { time: 1,   inp: { 'inserter': 1, 'iron-plate': 2 },                             out: { 'long-inserter': 1 } },
  'burner-drill':       { time: 2,   inp: { 'iron-plate': 4, 'iron-gear': 2 },                   out: { 'burner-drill': 1 } },
  'stone-furnace':      { time: 0.5, inp: { 'stone': 5 },                                        out: { 'stone-furnace': 1 } },
  'storage-chest':      { time: 1,   inp: { 'iron-plate': 8 },                                   out: { 'storage-chest': 1 } },
  'assembling-machine': { time: 2,   inp: { 'iron-plate': 5, 'iron-gear': 4, 'green-circuit': 3 }, out: { 'assembling-machine': 1 } },
  'lab':                { time: 3,   inp: { 'iron-gear': 8, 'green-circuit': 8, 'stone': 10 },   out: { 'lab': 1 } },
  'splitter':           { time: 1,   inp: { 'iron-plate': 4, 'iron-gear': 4 },                     out: { 'splitter': 1 } },
  'underground':        { time: 1.5, inp: { 'iron-plate': 6, 'iron-gear': 4 },                     out: { 'underground': 1 } },
  'boiler':             { time: 1.5, inp: { 'stone': 4, 'iron-plate': 2 },                         out: { 'boiler': 1 } },
  'steam-engine':       { time: 2,   inp: { 'iron-plate': 2, 'iron-gear': 2, 'green-circuit': 2 }, out: { 'steam-engine': 1 } },
  'offshore-pump':      { time: 1,   inp: { 'iron-plate': 5, 'iron-gear': 2 },                     out: { 'offshore-pump': 1 } },
  'electric-drill':     { time: 2,   inp: { 'iron-plate': 8, 'iron-gear': 3 },                     out: { 'electric-drill': 1 } },
  'electric-furnace':   { time: 2.5, inp: { 'iron-plate': 6, 'steel-plate': 2, 'green-circuit': 2 }, out: { 'electric-furnace': 1 } },
  'assembling-machine-mk2': { time: 3, inp: { 'steel-plate': 6, 'iron-gear': 4, 'green-circuit': 6 }, out: { 'assembling-machine-mk2': 1 } },
  'fast-transport-belt': { time: 0.5, inp: { 'iron-plate': 2, 'iron-gear': 1 },                  out: { 'fast-transport-belt': 1 } },
  'fast-underground-belt': { time: 1, inp: { 'underground': 1, 'iron-gear': 5 },                  out: { 'fast-underground-belt': 1 } },
  'priority-splitter': { time: 1,   inp: { 'splitter': 1, 'iron-gear': 1 },                       out: { 'priority-splitter': 1 } },
  'filter-inserter':   { time: 1,   inp: { 'inserter': 1, 'green-circuit': 1 },                   out: { 'filter-inserter': 1 } },
  'stack-inserter':    { time: 1.5, inp: { 'inserter': 1, 'iron-gear': 8 },                       out: { 'stack-inserter': 1 } },
  'green-science':     { time: 4,   inp: { 'transport-belt': 1, 'inserter': 1 },                  out: { 'green-science': 1 } },
  'blue-science':      { time: 8,   inp: { 'plastic-bar': 2, 'green-circuit': 2, 'copper-plate': 1 }, out: { 'blue-science': 1 } },
  'pipe':              { time: 0.5, inp: { 'iron-plate': 1 },                                     out: { 'pipe': 1 } },
  'pumpjack':          { time: 2.5, inp: { 'steel-plate': 4, 'iron-gear': 3, 'green-circuit': 2 }, out: { 'pumpjack': 1 } },
  'refinery':          { time: 3,   inp: { 'steel-plate': 8, 'pipe': 6, 'green-circuit': 5 },      out: { 'refinery': 1 } },
  'chemical-plant':    { time: 4,   inp: { 'steel-plate': 10, 'iron-gear': 10, 'pipe': 10, 'green-circuit': 5 }, out: { 'chemical-plant': 1 } },
  'storage-tank':      { time: 2,   inp: { 'steel-plate': 4, 'iron-gear': 2, 'pipe': 4 }, out: { 'storage-tank': 1 } },
  'express-transport-belt': { time: 0.5, inp: { 'fast-transport-belt': 1, 'iron-gear': 5 }, out: { 'express-transport-belt': 1 } },
  'express-underground-belt': { time: 1, inp: { 'fast-underground-belt': 1, 'iron-gear': 10 }, out: { 'express-underground-belt': 1 } },
  'express-splitter': { time: 1, inp: { 'fast-transport-belt': 4, 'iron-gear': 10 }, out: { 'express-splitter': 1 } },
  'steel-chest':      { time: 1,   inp: { 'steel-plate': 8 }, out: { 'steel-chest': 1 } },
  'steel-furnace':    { time: 2,   inp: { 'steel-plate': 8, 'stone': 6 }, out: { 'steel-furnace': 1 } },
  'assembling-machine-3': { time: 3, inp: { 'assembling-machine-mk2': 1, 'steel-plate': 8, 'iron-gear': 6, 'green-circuit': 8 }, out: { 'assembling-machine-3': 1 } },
  'pipe-to-ground':   { time: 1,   inp: { 'pipe': 10, 'iron-plate': 5 }, out: { 'pipe-to-ground': 1 } },
  'pump':             { time: 1,   inp: { 'iron-plate': 4, 'steel-plate': 2, 'green-circuit': 1 }, out: { 'pump': 1 } },
  'solar-panel':      { time: 5,   inp: { 'copper-plate': 5, 'steel-plate': 5, 'green-circuit': 5 }, out: { 'solar-panel': 1 } },
  'accumulator':      { time: 3,   inp: { 'iron-plate': 2, 'copper-plate': 2, 'green-circuit': 2 }, out: { 'accumulator': 1 } },
  'military-science': { time: 6,   inp: { 'magazine': 1, 'stone-wall': 1, 'piercing-rounds': 1 }, out: { 'military-science': 1 } },
  'gun-turret':       { time: 3,   inp: { 'iron-plate': 8, 'iron-gear': 4, 'copper-plate': 2 }, out: { 'gun-turret': 1 } },
  'stone-wall':       { time: 0.5, inp: { 'stone-brick': 2 }, out: { 'stone-wall': 1 } },
  'magazine':         { time: 0.5, inp: { 'iron-plate': 1 }, out: { 'magazine': 4 } },
  'piercing-rounds':  { time: 1,   inp: { 'magazine': 1, 'copper-plate': 1, 'steel-plate': 1 }, out: { 'piercing-rounds': 1 } },
  'plastic-bar':       { time: 2,   inp: { 'petroleum-gas': 1, 'coal': 1 },                       out: { 'plastic-bar': 1 } },
  'crack-light':       { time: 3,   inp: { 'heavy-oil': 3 },                                      out: { 'light-oil': 2 } },
  'crack-gas':         { time: 3,   inp: { 'light-oil': 3 },                                      out: { 'petroleum-gas': 2 } },
  // ===== 中后期链：高级电子 / 化工深加工（对齐《异星工厂》配方比例，数值按本作规模缩放）=====
  // 高级电路板（红）：本体 6s = 2电路板+2塑料+4铜线
  'advanced-circuit':  { time: 6,   inp: { 'green-circuit': 2, 'plastic-bar': 2, 'copper-cable': 4 }, out: { 'advanced-circuit': 1 } },
  // 电池：本体 2s = 铁板1+铜板1+硫酸20（硫酸为流体，需管道接入组装机）
  'battery':           { time: 2,   inp: { 'iron-plate': 1, 'copper-plate': 1, 'sulfuric-acid': 10 }, out: { 'battery': 1 } },
  // 处理器（蓝）：本体 10s = 20高级+2普通+2硫酸；按规模缩放
  'processing-unit':   { time: 10,  inp: { 'advanced-circuit': 4, 'green-circuit': 2, 'sulfuric-acid': 4 }, out: { 'processing-unit': 1 } },
  // 电引擎单元：本体 = 引擎(钢板1+齿轮1)+润滑油
  'electric-engine-unit': { time: 8, inp: { 'steel-plate': 1, 'iron-gear': 1, 'lubricant': 8 },    out: { 'electric-engine-unit': 1 } },
  // 飞行机器人机架：本体 15s = 电引擎1+电池2+电路板3
  'flying-robot-frame':{ time: 15,  inp: { 'electric-engine-unit': 1, 'battery': 2, 'green-circuit': 3 }, out: { 'flying-robot-frame': 1 } },
  // 低密度结构：本体 20s = 铜板20+塑料5+钢板2
  'low-density-structure': { time: 12, inp: { 'copper-plate': 10, 'plastic-bar': 5, 'steel-plate': 2 }, out: { 'low-density-structure': 1 } },
  // 火箭燃料：本体 = 固体燃料10+轻油50
  'rocket-fuel':       { time: 8,   inp: { 'solid-fuel': 5, 'light-oil': 25 },                     out: { 'rocket-fuel': 1 } },
  // 生产科学包（紫）：本体 21s = 电炉1+产能模块1+铁轨30 → 3包；以电炉+石砖+钢板对齐生产侧定位
  'production-science':{ time: 14,  inp: { 'stone-brick': 8, 'steel-plate': 2, 'electric-furnace': 1 }, out: { 'production-science': 2 } },
  // 高科技科学包（黄）：本体 21s = 机架1+低密度3+处理器2 → 3包
  'utility-science':   { time: 18,  inp: { 'flying-robot-frame': 1, 'low-density-structure': 2, 'processing-unit': 2 }, out: { 'utility-science': 3 } },
  // 火箭发射井：本体需电引擎+处理器+混凝土；以钢板/石砖/管道对齐
  'rocket-silo':       { time: 60,  inp: { 'steel-plate': 50, 'stone-brick': 50, 'pipe': 20, 'processing-unit': 10, 'electric-engine-unit': 10 }, out: { 'rocket-silo': 1 } },
  // ===== 化工厂配方（固体产物经机械臂取出，流体产物自动排回管道）=====
  'solid-fuel-light':  { time: 3,   inp: { 'light-oil': 10 },      out: { 'solid-fuel': 1 } },
  'solid-fuel-heavy':  { time: 3,   inp: { 'heavy-oil': 20 },      out: { 'solid-fuel': 1 } },
  'solid-fuel-gas':    { time: 3,   inp: { 'petroleum-gas': 20 },  out: { 'solid-fuel': 1 } },
  'sulfur':            { time: 1,   inp: { 'petroleum-gas': 30 },  out: { 'sulfur': 2 } },
  'sulfuric-acid':     { time: 1,   inp: { 'sulfur': 5, 'water': 40, 'iron-plate': 1 }, out: { 'sulfuric-acid': 40 } },
  'lubricant':         { time: 1,   inp: { 'heavy-oil': 10 },      out: { 'lubricant': 8 } },
  // ===== 插件模块（对齐《异星工厂》模块配方结构：低阶模块×2 + 高级电子件合成高阶）=====
  'speed-module':          { time: 15, inp: { 'green-circuit': 5, 'advanced-circuit': 1 }, out: { 'speed-module': 1 } },
  'speed-module-2':        { time: 30, inp: { 'speed-module': 2, 'advanced-circuit': 2, 'processing-unit': 1 }, out: { 'speed-module-2': 1 } },
  'speed-module-3':        { time: 45, inp: { 'speed-module-2': 2, 'processing-unit': 4, 'advanced-circuit': 3 }, out: { 'speed-module-3': 1 } },
  'productivity-module':   { time: 30, inp: { 'green-circuit': 5, 'plastic-bar': 2, 'advanced-circuit': 1 }, out: { 'productivity-module': 1 } },
  'productivity-module-2': { time: 60, inp: { 'productivity-module': 2, 'advanced-circuit': 2, 'processing-unit': 1 }, out: { 'productivity-module-2': 1 } },
  'productivity-module-3': { time: 90, inp: { 'productivity-module-2': 2, 'processing-unit': 4, 'low-density-structure': 2 }, out: { 'productivity-module-3': 1 } },
  'effectivity-module':    { time: 15, inp: { 'green-circuit': 5, 'advanced-circuit': 1 }, out: { 'effectivity-module': 1 } },
  'effectivity-module-2':  { time: 30, inp: { 'effectivity-module': 2, 'advanced-circuit': 2, 'processing-unit': 1 }, out: { 'effectivity-module-2': 1 } },
  'effectivity-module-3':  { time: 45, inp: { 'effectivity-module-2': 2, 'processing-unit': 4, 'advanced-circuit': 3 }, out: { 'effectivity-module-3': 1 } },
  // ===== 信标与物流网络设备 =====
  'beacon':                { time: 30, inp: { 'steel-plate': 10, 'green-circuit': 10, 'advanced-circuit': 5, 'copper-cable': 10 }, out: { 'beacon': 1 } },
  'roboport':              { time: 20, inp: { 'steel-plate': 30, 'iron-gear': 30, 'battery': 20, 'processing-unit': 10 }, out: { 'roboport': 1 } },
  'logistic-robot':        { time: 10, inp: { 'flying-robot-frame': 1, 'processing-unit': 1 }, out: { 'logistic-robot': 1 } },
  'logi-chest-passive':    { time: 1,  inp: { 'steel-chest': 1, 'advanced-circuit': 1 }, out: { 'logi-chest-passive': 1 } },
  'logi-chest-storage':    { time: 1,  inp: { 'steel-chest': 1, 'green-circuit': 1 }, out: { 'logi-chest-storage': 1 } },
  'logi-chest-requester':  { time: 1,  inp: { 'steel-chest': 1, 'advanced-circuit': 1, 'green-circuit': 3 }, out: { 'logi-chest-requester': 1 } },
  // ===== 核能链设备与燃料（对齐《异星工厂》配方结构，数值按本作规模缩放）=====
  // 核燃料棒：本体 90s = 1铀235+19铀238+10铁 → 10 根；一次铀加工（1铀235+39铀238）恰好支持两批
  'nuclear-fuel-cell':     { time: 60, inp: { 'uranium-235': 1, 'uranium-238': 19, 'iron-plate': 5 }, out: { 'nuclear-fuel-cell': 10 } },
  'centrifuge':            { time: 20, inp: { 'steel-plate': 20, 'iron-gear': 20, 'pipe': 10, 'green-circuit': 10 }, out: { 'centrifuge': 1 } },
  'nuclear-reactor':       { time: 60, inp: { 'steel-plate': 40, 'stone-brick': 20, 'advanced-circuit': 10, 'copper-cable': 20 }, out: { 'nuclear-reactor': 1 } },
  'heat-pipe':             { time: 1,  inp: { 'steel-plate': 4, 'copper-plate': 4 }, out: { 'heat-pipe': 1 } },
  'heat-exchanger':        { time: 15, inp: { 'steel-plate': 10, 'pipe': 8, 'green-circuit': 5 }, out: { 'heat-exchanger': 1 } },
  'steam-turbine':         { time: 15, inp: { 'iron-gear': 10, 'pipe': 8, 'steel-plate': 6 }, out: { 'steam-turbine': 1 } },
  // ===== 铁路运输（对齐《异星工厂》配方结构，数值按本作规模缩放）=====
  // 铁轨：本体 0.5s = 1铁棍+1石头 → 2 根；以铁板替代铁棍
  'rail':                  { time: 0.5, inp: { 'iron-plate': 1, 'stone': 1 }, out: { 'rail': 2 } },
  'train-stop':            { time: 3,   inp: { 'steel-plate': 3, 'iron-plate': 5, 'green-circuit': 2 }, out: { 'train-stop': 1 } },
  'locomotive':            { time: 4,   inp: { 'steel-plate': 8, 'iron-gear': 8, 'green-circuit': 5 }, out: { 'locomotive': 1 } },
  'cargo-wagon':           { time: 4,   inp: { 'steel-plate': 8, 'iron-plate': 8, 'iron-gear': 6 }, out: { 'cargo-wagon': 1 } }
};

// ===== 离心机配方（对齐《异星工厂》Centrifuge：全部为固体进出，机械臂投喂/取走）=====
// 铀加工：10 铀矿石 → 39 铀-238 + 1 铀-235（12s）。取本体期望产率（0.7%≈每周期1个）的确定性版本，
// 一个周期恰好支撑两批核燃料棒（2×19=38 个 U-238），自平衡不积压。
// Kovarex 铀浓缩：3 铀-235 + 18 铀-238 → 4 铀-235 + 17 铀-238（30s）：净 +1 U-235，把过剩的
// U-238 增殖成稀有同位素（对齐本体 Kovarex process 的"放大器"语义）。
// 核废料再处理：5 乏燃料棒 → 3 铀-238（60s，对齐 Nuclear fuel reprocessing）。
const CENTRIFUGE_RECIPES = {
  'uranium-processing':   { name: '铀加工',          time: 12, inp: { 'uranium-ore': 10 },                          out: { 'uranium-238': 39, 'uranium-235': 1 } },
  'kovarex-enrichment':   { name: 'Kovarex 铀浓缩',  time: 30, inp: { 'uranium-235': 3, 'uranium-238': 18 },        out: { 'uranium-235': 4, 'uranium-238': 17 } },
  'nuclear-reprocessing': { name: '核废料再处理',     time: 60, inp: { 'used-up-fuel-cell': 5 },                     out: { 'uranium-238': 3 } }
};
const CENTRIFUGE_RECIPE_IDS = Object.keys(CENTRIFUGE_RECIPES);
function isCentrifugeRecipe(id) { return CENTRIFUGE_RECIPES[id] !== undefined; }

// 化工厂配方（对齐《异星工厂》官方数值）：
// 塑料：1 石油气 + 1 煤 → 1 塑料板（1s）
// 重油裂解：3 重油 → 2 轻油；轻油裂解：3 轻油 → 2 石油气
// 固体燃料：轻油10/重油20/石油气20 → 1（本体 3s）
// 硫：30 石油气 → 2 硫（1s）；硫酸：5硫+40水+1铁板 → 40 硫酸（1s）
// 润滑油：10 重油 → 8 润滑油（1s）
const CHEM_RECIPES = ['plastic-bar', 'crack-light', 'crack-gas',
  'solid-fuel-light', 'solid-fuel-heavy', 'solid-fuel-gas', 'sulfur', 'sulfuric-acid', 'lubricant'];
function isChemRecipe(id) { return CHEM_RECIPES.indexOf(id) >= 0; }
function chemMult() { return (G.techDone.plastic ? 1.5 : 1) * ((G.dbg && G.dbg.asmMult) || 1); }

// ===== 炼油厂配方（对齐《异星工厂》官方 Wiki：Oil processing 共 4 种）=====
// 基础原油加工：100 原油 → 45 石油气（只产出石油气，5s）
// 进阶原油加工：100 原油 + 50 水 → 25 重油 + 45 轻油 + 55 石油气（5s）
// 煤液化：10 煤 + 25 重油 + 50 蒸汽 → 90 重油 + 20 轻油 + 10 石油气（5s）
// 简易煤液化（太空时代）：10 煤 + 2 硫酸 + 25 方解石 → 50 重油（只产出重油，5s）
const REFINERY_RECIPES = {
  'basic-oil':      { name: '基础原油加工', time: 5, inp: { 'crude-oil': 100 },  out: { 'petroleum-gas': 45 } },
  'advanced-oil':   { name: '进阶原油加工', time: 5, inp: { 'crude-oil': 100, 'water': 50 },  out: { 'heavy-oil': 25, 'light-oil': 45, 'petroleum-gas': 55 } },
  'coal-liquefaction': { name: '煤液化', time: 5, inp: { 'coal': 10, 'heavy-oil': 25, 'steam': 50 }, out: { 'heavy-oil': 90, 'light-oil': 20, 'petroleum-gas': 10 } },
  'simple-coal':    { name: '简易煤液化', time: 5, inp: { 'coal': 10, 'calcite': 25 }, out: { 'heavy-oil': 50 } }
};
const REFINERY_RECIPE_IDS = Object.keys(REFINERY_RECIPES);
function isRefineryRecipe(id) { return REFINERY_RECIPES[id] !== undefined; }

// ---- 配方归属设备 ----
// 判断某配方适用于哪台设备：炼油厂 / 化工厂 / 离心机 / 组装机。
const DEVICE_NAMES = {
  'assembling-machine': '组装机',
  'chemical-plant': '化工厂',
  'refinery': '炼油厂',
  'centrifuge': '离心机'
};
function recipeDevice(id) {
  if (isRefineryRecipe(id)) return 'refinery';
  if (isChemRecipe(id)) return 'chemical-plant';
  if (isCentrifugeRecipe(id)) return 'centrifuge';
  return 'assembling-machine';
}
function recipeDeviceName(id) { return DEVICE_NAMES[recipeDevice(id)] || ''; }

const BUILD_DEFS = {
  'transport-belt':     { w: 1, h: 1, solid: false },
  'fast-transport-belt': { w: 1, h: 1, solid: false },
  'express-transport-belt': { w: 1, h: 1, solid: false },
  'splitter':           { w: 1, h: 2, solid: false, rotSwap: true },
  'priority-splitter':  { w: 1, h: 2, solid: false, rotSwap: true },
  'express-splitter':   { w: 1, h: 2, solid: false, rotSwap: true },
  'underground':        { w: 1, h: 1, solid: false },
  'fast-underground-belt': { w: 1, h: 1, solid: false },
  'express-underground-belt': { w: 1, h: 1, solid: false },
  'inserter':           { w: 1, h: 1, solid: true },
  'long-inserter':      { w: 1, h: 1, solid: true },
  'filter-inserter':    { w: 1, h: 1, solid: true },
  'stack-inserter':     { w: 1, h: 1, solid: true },
  'burner-drill':       { w: 2, h: 2, solid: true },
  'stone-furnace':      { w: 2, h: 2, solid: true },
  'steel-furnace':      { w: 2, h: 2, solid: true },
  'assembling-machine': { w: 3, h: 3, solid: true },
  'assembling-machine-3': { w: 3, h: 3, solid: true },
  'storage-chest':      { w: 1, h: 1, solid: true },
  'steel-chest':        { w: 1, h: 1, solid: true },
  'creative-chest':     { w: 1, h: 1, solid: true },
  'void-chest':         { w: 1, h: 1, solid: true },
  'lab':                { w: 3, h: 3, solid: true },
  'boiler':             { w: 3, h: 2, solid: true },
  'steam-engine':       { w: 3, h: 5, solid: true },
  'offshore-pump':      { w: 2, h: 1, solid: true, rotSwap: true },
  'electric-drill':     { w: 3, h: 3, solid: true },
  'electric-furnace':   { w: 3, h: 3, solid: true },
  'assembling-machine-mk2': { w: 3, h: 3, solid: true },
  'pipe':               { w: 1, h: 1, solid: true },
  'creative-pipe':      { w: 1, h: 1, solid: true },
  'void-pipe':          { w: 1, h: 1, solid: true },
  'creative-belt':      { w: 1, h: 1, solid: false },
  'void-belt':          { w: 1, h: 1, solid: false },
  'pipe-to-ground':     { w: 1, h: 1, solid: true },
  'pump':               { w: 1, h: 1, solid: true },
  'solar-panel':        { w: 2, h: 2, solid: true },
  'accumulator':        { w: 2, h: 2, solid: true },
  'passive-power':      { w: 2, h: 2, solid: true },
  'gun-turret':         { w: 2, h: 2, solid: true },
  'stone-wall':         { w: 1, h: 1, solid: true },
  'pumpjack':           { w: 3, h: 3, solid: true },
  'refinery':           { w: 5, h: 5, solid: true },
  'chemical-plant':     { w: 3, h: 3, solid: true },
  'storage-tank':       { w: 3, h: 3, solid: true },
  'rocket-silo':        { w: 7, h: 7, solid: true },
  'beacon':             { w: 3, h: 3, solid: true },
  'roboport':           { w: 4, h: 4, solid: true },
  'logi-chest-passive': { w: 1, h: 1, solid: true },
  'logi-chest-storage': { w: 1, h: 1, solid: true },
  'logi-chest-requester': { w: 1, h: 1, solid: true },
  // ===== 核能链 =====
  'centrifuge':         { w: 3, h: 3, solid: true },
  'nuclear-reactor':    { w: 5, h: 5, solid: true },
  'heat-pipe':          { w: 1, h: 1, solid: true },
  'heat-exchanger':     { w: 3, h: 2, solid: true },
  'steam-turbine':      { w: 3, h: 5, solid: true },
  // ===== 铁路运输（轨道/列车均可通行，不阻挡玩家）=====
  'rail':               { w: 1, h: 1, solid: false },
  'train-stop':         { w: 1, h: 1, solid: false },
  'locomotive':         { w: 1, h: 1, solid: false },
  'cargo-wagon':        { w: 1, h: 1, solid: false }
};

// ===== 传送带阶级链（对齐《异星工厂》物流升级）=====
// 普通带 → 快速带 → 极速带。用于 R 旋转、覆盖升级/降级、绿图批量升级等。
const BELT_TIERS = ['transport-belt', 'fast-transport-belt', 'express-transport-belt'];
const UNDERGROUND_TIERS = ['underground', 'fast-underground-belt', 'express-underground-belt'];
const SPLITTER_TIERS = ['splitter', 'priority-splitter', 'express-splitter'];
// 组装机阶级链（对齐《异星工厂》组装机 I/II/III）：绿图批量升级/降级也支持组装机
const ASSEMBLER_TIERS = ['assembling-machine', 'assembling-machine-mk2', 'assembling-machine-3'];
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

const DEFAULT_HOTBAR = ['transport-belt', 'splitter', 'underground', 'inserter', 'long-inserter', 'burner-drill', 'stone-furnace', 'assembling-machine', 'storage-chest', 'lab'];
let HOTBAR = DEFAULT_HOTBAR.slice();

const TECHS = {
  mining:     { name: '采矿业', cost: { 'science-pack': 10 }, desc: '采矿机速度 ×2' },
  logistics:  { name: '物流学', cost: { 'science-pack': 15 }, desc: '传送带速度 ×1.5' },
  automation: { name: '自动化', cost: { 'science-pack': 20 }, desc: '组装机速度 ×1.5' },
  logistics2: { name: '物流 II', cost: { 'green-science': 25 }, desc: '传送带速度额外 ×1.2（与物流学叠加）' },
  electric:   { name: '电力工程', cost: { 'green-science': 15 }, desc: '电炉 / 电采矿机速度 ×1.2' },
  railway:    { name: '铁路运输', cost: { 'science-pack': 30, 'green-science': 50 }, desc: '解锁铁轨、车站、机车头与货运车厢：铺设轨道网，用计划表让列车在车站间自动往返，大宗远程物流的终极方案', unlock: ['rail', 'train-stop', 'locomotive', 'cargo-wagon'] },
  oil:        { name: '石油冶金', cost: { 'green-science': 30 }, desc: '炼油厂 / 抽油机速度 ×1.5' },
  plastic:    { name: '塑料合成', cost: { 'green-science': 20 }, desc: '化工厂生产塑料耗时缩短 ✓（绿色科研的核心支付项）' },
  lubricant:  { name: '润滑油', cost: { 'green-science': 20 }, desc: '解锁润滑油与电引擎单元（重油深加工链）', unlock: ['lubricant', 'electric-engine-unit'] },
  solidFuel:  { name: '可燃物加工', cost: { 'green-science': 25 }, desc: '解锁固体燃料：重油/轻油/石油气均可制成', unlock: ['solid-fuel-light', 'solid-fuel-heavy', 'solid-fuel-gas'] },
  sulfur:     { name: '硫处理', cost: { 'green-science': 30 }, desc: '解锁硫与硫酸（电池与处理器的前置）', unlock: ['sulfur', 'sulfuric-acid'] },
  automation2:{ name: '自动化 II', cost: { 'blue-science': 40 }, desc: '组装机 II 速度额外 ×1.2' },
  advElec:    { name: '高级电子学', cost: { 'blue-science': 25 }, desc: '解锁高级电路板（红电路）', unlock: ['advanced-circuit'] },
  battery:    { name: '电池', cost: { 'blue-science': 25 }, desc: '解锁电池（硫酸需经管道接入组装机）', unlock: ['battery'] },
  processing: { name: '处理器', cost: { 'blue-science': 45 }, desc: '解锁处理器（蓝电路，火箭部件必备）', unlock: ['processing-unit'] },
  military:   { name: '军事工程', cost: { 'military-science': 30 }, desc: '解锁机枪炮塔、石墙、弹药（防御体系）' },
  express:    { name: '极速物流', cost: { 'military-science': 40 }, desc: '解锁极速传送带/地下带/分流器，物流终极档' },
  prodSci:    { name: '生产科学包', cost: { 'blue-science': 45 }, desc: '解锁紫色生产科学包（石砖+钢板+电炉）', unlock: ['production-science'] },
  lds:        { name: '低密度结构', cost: { 'blue-science': 30, 'production-science': 30 }, desc: '解锁低密度结构（火箭骨架材料）', unlock: ['low-density-structure'] },
  robotics:   { name: '机器人工程', cost: { 'production-science': 45 }, desc: '解锁飞行机器人机架（黄包主件）', unlock: ['flying-robot-frame'] },
  rocketFuel: { name: '火箭燃料', cost: { 'production-science': 40 }, desc: '解锁火箭燃料（固体燃料+轻油）', unlock: ['rocket-fuel'] },
  utilSci:    { name: '高科技科学包', cost: { 'production-science': 50 }, desc: '解锁黄色高科技科学包', unlock: ['utility-science'] },
  rocketSilo: { name: '火箭发射井', cost: { 'production-science': 80, 'utility-science': 80 }, desc: '终局科技：解锁火箭发射井——攒满100个火箭部件发射火箭通关！', unlock: ['rocket-silo'] },
  // ===== 模块与物流网络（终局工厂优化玩法）=====
  effModule:  { name: '效能模块', cost: { 'blue-science': 25 }, desc: '解锁效能模块 I/II：降低设备耗电（耗电大户必备）', unlock: ['effectivity-module', 'effectivity-module-2'] },
  spdModule:  { name: '速度模块', cost: { 'blue-science': 30 }, desc: '解锁速度模块 I/II：提升设备速度、增加耗电', unlock: ['speed-module', 'speed-module-2'] },
  prodModule: { name: '产能模块', cost: { 'production-science': 35 }, desc: '解锁产能模块 I/II：免费额外产出，代价是降速增耗（不能插入研究中心）', unlock: ['productivity-module', 'productivity-module-2'] },
  advModule:  { name: '高级模块', cost: { 'utility-science': 50, 'production-science': 40 }, desc: '解锁全部三级模块（速度/产能/效能 III）', unlock: ['speed-module-3', 'productivity-module-3', 'effectivity-module-3'] },
  beaconTech: { name: '信标', cost: { 'utility-science': 40 }, desc: '解锁信标：向周围机器转发模块效果，多台叠加全厂提速增产', unlock: ['beacon'] },
  logiNet:    { name: '物流网络', cost: { 'utility-science': 40, 'production-science': 30 }, desc: '解锁机器人港口、物流机器人与三种物流箱：被动物流体系，产线供料全自动', unlock: ['roboport', 'logistic-robot', 'logi-chest-passive', 'logi-chest-storage', 'logi-chest-requester'] },
  // ===== 核能链（对齐《异星工厂》Nuclear power 科技线）=====
  nuclear:    { name: '核能科技', cost: { 'blue-science': 40, 'production-science': 30 }, desc: '解锁离心机与铀加工：从铀矿石分离出铀-235 与铀-238', unlock: ['centrifuge', 'uranium-processing'] },
  atomicPower:{ name: '原子能发电', cost: { 'production-science': 50, 'utility-science': 50 }, desc: '解锁核反应堆、热管、换热器、汽轮机与核燃料棒合成——1 台反应堆 ≈ 32 台蒸汽机的终局电力', unlock: ['nuclear-fuel-cell', 'nuclear-reactor', 'heat-pipe', 'heat-exchanger', 'steam-turbine'] },
  kovarex:    { name: '铀浓缩', cost: { 'utility-science': 60, 'production-science': 40 }, desc: '解锁 Kovarex 铀浓缩（把过剩铀-238 增殖成稀有铀-235）与核废料再处理', unlock: ['kovarex-enrichment', 'nuclear-reprocessing'] },
  deep:       { name: '重工蓝图', cost: { 'blue-science': 50 }, desc: '科研总进度获取 +20%' },
  infinite:   { name: '无限科技', cost: {}, infinite: true, desc: '无限研究：消耗任意科学包，永不完成' }
};

// ===== 研究解锁配方（对齐《异星工厂》：研究科技后才能使用对应配方）=====
// RECIPE_UNLOCK_TECH: 配方id -> 解锁它的科技id。未登记的配方默认始终可用
// （兼容旧行为：基础配方无需研究）。读入旧存档时按 techDone 判定。
const RECIPE_UNLOCK_TECH = {};
for (const tid in TECHS) {
  const u = TECHS[tid].unlock;
  if (u) for (const rid of u) RECIPE_UNLOCK_TECH[rid] = tid;
}
function recipeUnlockTech(rid) { return RECIPE_UNLOCK_TECH[rid] || null; }
function recipeUnlocked(rid) {
  const t = RECIPE_UNLOCK_TECH[rid];
  return !t || !!G.techDone[t];
}

// 判断是否为无限科技（永不完成、消耗任意科学包）
function isInfiniteTech(tid) { return !!(TECHS[tid] && TECHS[tid].infinite); }

const DEFAULT_SETTINGS = { infiniteOre: true, autoSave: true, combat: false, capDPR: true, lowRes: false, virtualJoystick: false };
const SETTINGS_KEY = 'factory-settings-v1';

function drawItemGlyph(x, id, cx, cy, s) {
  const col = ITEMS[id].color;
  const r = s / 2;
  const dark = 'rgba(10,12,16,.55)';
  x.save();
  x.translate(cx, cy);
  switch (id) {
    case 'iron-ore':
    case 'copper-ore':
    case 'uranium-ore': {
      x.fillStyle = col;
      for (let i = 0; i < 3; i++) {
        const a = i * 2.09 - Math.PI / 2;
        x.beginPath();
        x.arc(Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.36, s * 0.17, 0, 7);
        x.fill();
      }
      break;
    }
    case 'coal': {
      x.fillStyle = col;
      x.beginPath();
      x.moveTo(-r * 0.6, -r * 0.5);
      x.lineTo(0, -r * 0.85);
      x.lineTo(r * 0.7, -r * 0.3);
      x.lineTo(r * 0.45, r * 0.6);
      x.lineTo(-r * 0.55, r * 0.55);
      x.closePath();
      x.fill();
      break;
    }
    case 'stone': {
      x.fillStyle = col;
      x.beginPath();
      x.moveTo(-r * 0.7, r * 0.2);
      x.lineTo(-r * 0.15, -r * 0.65);
      x.lineTo(r * 0.35, -r * 0.1);
      x.lineTo(-r * 0.05, r * 0.6);
      x.closePath();
      x.fill();
      x.beginPath();
      x.moveTo(r * 0.1, r * 0.55);
      x.lineTo(r * 0.45, r * 0.05);
      x.lineTo(r * 0.75, r * 0.55);
      x.closePath();
      x.fill();
      break;
    }
    case 'iron-plate':
    case 'copper-plate': {
      x.fillStyle = col;
      x.fillRect(-r * 0.85, -r * 0.55, r * 1.7, r * 1.1);
      x.fillStyle = 'rgba(255,255,255,.4)';
      x.fillRect(-r * 0.85, -r * 0.55, r * 1.7, r * 0.22);
      break;
    }
    case 'iron-gear': {
      x.fillStyle = col;
      x.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = i * Math.PI / 8;
        const rad = i % 2 ? s * 0.17 : s * 0.42;
        const px = Math.cos(a) * rad, py = Math.sin(a) * rad;
        i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
      }
      x.closePath();
      x.moveTo(s * 0.09, 0);
      x.arc(0, 0, s * 0.11, 0, Math.PI * 2, true);
      x.fill('evenodd');
      break;
    }
    case 'copper-cable': {
      x.strokeStyle = col;
      x.lineWidth = s * 0.14;
      x.lineCap = 'round';
      x.beginPath();
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const px = -r * 0.8 + t * r * 1.6;
        const py = Math.sin(t * Math.PI * 3) * r * 0.42;
        i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
      }
      x.stroke();
      break;
    }
    case 'green-circuit': {
      x.fillStyle = col;
      x.fillRect(-r * 0.72, -r * 0.62, r * 1.44, r * 1.24);
      x.strokeStyle = '#123c16';
      x.lineWidth = Math.max(1, s * 0.06);
      x.beginPath();
      x.moveTo(-r * 0.5, 0); x.lineTo(r * 0.5, 0);
      x.moveTo(0, -r * 0.45); x.lineTo(0, r * 0.45);
      x.stroke();
      break;
    }
    case 'uranium-235':
    case 'uranium-238': {
      // 同位素圆盘：实心圆 + 高光环（对齐《异星工厂》铀同位素的圆盘造型）
      x.fillStyle = col;
      x.beginPath();
      x.arc(0, 0, r * 0.78, 0, 7);
      x.fill();
      x.strokeStyle = 'rgba(255,255,255,.55)';
      x.lineWidth = Math.max(1, s * 0.05);
      x.beginPath();
      x.arc(0, 0, r * 0.46, 0, 7);
      x.stroke();
      break;
    }
    case 'science-pack':
    case 'green-science':
    case 'blue-science':
    case 'production-science':
    case 'utility-science': {
      x.fillStyle = '#e8ecf2';
      x.fillRect(-r * 0.16, -r * 0.9, r * 0.32, r * 0.35);
      x.fillStyle = col;
      x.beginPath();
      x.moveTo(-r * 0.16, -r * 0.55);
      x.lineTo(r * 0.16, -r * 0.55);
      x.lineTo(r * 0.75, r * 0.75);
      x.arc(0, r * 0.75, r * 0.75, 0, Math.PI, true);
      x.closePath();
      x.fill();
      break;
    }
    case 'water':
    case 'steam':
    case 'crude-oil':
    case 'heavy-oil':
    case 'light-oil':
    case 'petroleum-gas':
    case 'lubricant':
    case 'sulfuric-acid': {
      x.fillStyle = col;
      x.beginPath();
      x.arc(0, r * 0.15, r * 0.55, 0, 7);
      x.fill();
      x.beginPath();
      x.ellipse(-r * 0.28, -r * 0.35, r * 0.2, r * 0.32, -0.5, 0, 7);
      x.ellipse(r * 0.3, -r * 0.2, r * 0.16, r * 0.26, 0.6, 0, 7);
      x.fill();
      break;
    }
    default: {
      x.fillStyle = col;
      rrPath(x, -r * 0.8, -r * 0.8, r * 1.6, r * 1.6, s * 0.12);
      x.fill();
      x.strokeStyle = dark;
      x.lineWidth = Math.max(1, s * 0.05);
      x.stroke();
      x.fillStyle = '#f4f6f8';
      x.font = 'bold ' + Math.round(s * 0.42) + 'px system-ui';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText((ITEMS[id].mark || ITEMS[id].name[0]), 0, 1);
    }
  }
  x.restore();
}

function rrPath(x, px, py, w, h, r) {
  x.beginPath();
  x.moveTo(px + r, py);
  x.arcTo(px + w, py, px + w, py + h, r);
  x.arcTo(px + w, py + h, px, py + h, r);
  x.arcTo(px, py + h, px, py, r);
  x.arcTo(px, py, px + w, py, r);
  x.closePath();
  return x;
}

function beltSpeed()  {
  return BELT_SPEED * (G.techDone.logistics ? 1.5 : 1) * (G.techDone.logistics2 ? 1.2 : 1) * ((G.dbg && G.dbg.beltMult) || 1);
}
function drillMult()  { return (G.techDone.mining ? 2 : 1) * ((G.dbg && G.dbg.drillMult) || 1); }
function asmMult()    { return (G.techDone.automation ? 1.5 : 1) * (G.techDone.automation2 ? 1.2 : 1) * ((G.dbg && G.dbg.asmMult) || 1); }
function elecMachMult() { return (G.techDone.electric ? 1.2 : 1); }
function oilMult()    { return (G.techDone.oil ? 1.5 : 1); }
