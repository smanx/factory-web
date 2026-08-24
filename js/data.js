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
const SOLID_FUEL_ENERGY = 50;   // 固体燃料能量密度（对齐《异星工厂》：约 4 倍于煤），可作煤的替代燃料
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
const POWER_PER_ENGINE = 900;   // 蒸汽机满功率输出
const POWER_PER_TURBINE = 5800; // 汽轮机满功率输出（对齐《异星工厂》5.8MW）
const CENTRIFUGE_POWER = 75;    // 离心机功耗 kW（对齐《异星工厂》）
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
const REACTOR_HEAT_RATE = 6.0;     // 反应堆每秒产热量（单位/秒）
const REACTOR_HEAT_CAP = 60;       // 反应堆内部热量缓冲（相当于原蒸汽缓冲）
const HEAT_PIPE_CAP = 12;          // 导热管内部热量缓冲
const HEAT_PIPE_TRANSFER = 6.0;    // 导热管每秒向相邻导热管/热交换器传导的热量上限
const HEAT_EXCHANGER_CAP = 12;     // 热交换器内部热量缓冲
const HEAT_EXCHANGER_STEAM_RATE = 2.0; // 热交换器满功率耗热量→产蒸汽速率（单位/秒）
const POWER_USE = {
  'electric-drill': 90,          // 电采矿机
  'electric-furnace': 180,       // 电炉
  'assembling-machine': 75,      // 组装机 I
  'assembling-machine-mk2': 150, // 组装机 II
  'assembling-machine-3': 375,   // 组装机 III
  'pumpjack': 90,                // 抽油机
  'refinery': 420,               // 炼油厂
  'chemical-plant': 210,         // 化工厂
  'centrifuge': 75,              // 离心机
  'lab': 60                      // 研究中心
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
// 矿石索引：iron/copper/coal/stone/calcite = 0-4；原油 = 5（不进手挖矿表）；铀矿 = 6。
// ⚠️ 版本迁移：早期版本原油索引为 5，本次新增铀矿后改为 6，读档时对旧档做 5→6 重映射。
const ORE_OIL = 5;                       // 原油矿床的 oreType 索引（不进手挖矿表）
const ORE_URANIUM = 6;                   // 铀矿床的 oreType 索引
function oreItemId(ti) {
  if (ti === ORE_OIL) return 'crude-oil';
  if (ti === ORE_URANIUM) return 'uranium-ore';
  return ORES[ti];
}
const PIPE_CAP = 40;
const PIPE_FLOW = 3;
// 储液罐（对齐《异星工厂》Storage Tank）：占地 3×3、容量大、只存单一流体，东西两侧各一个通用流体口
const STORAGE_TANK_CAP = 2500;
const FLUID_WAGON_CAP = 2500;   // 流体车厢容量（对齐《异星工厂》Fluid Wagon 2.5 万单位）

const SCIENCE_PACKS = ['science-pack', 'green-science', 'blue-science', 'military-science', 'production-science-pack', 'utility-science-pack', 'space-science-pack'];
function isScience(item) { return SCIENCE_PACKS.indexOf(item) >= 0; }
const FILTER_CHOICES = ['iron-plate', 'copper-plate', 'steel-plate', 'iron-gear', 'iron-stick', 'steel-stick', 'copper-cable', 'green-circuit',
  'coal', 'solid-fuel', 'stone', 'plastic-bar', 'science-pack', 'green-science', 'blue-science', 'military-science',
  'production-science-pack', 'utility-science-pack', 'space-science-pack', 'flying-robot-frame',
  'magazine', 'piercing-rounds', 'uranium-rounds', 'uranium-cannon-shell', 'flamethrower-ammo', 'poison-capsule', 'slowdown-capsule', 'shotgun-shell', 'piercing-shotgun-shell', 'cluster-grenade', 'logistic-robot', 'construction-robot', 'uranium-235', 'uranium-238', 'nuclear-fuel', 'used-up-uranium-fuel-cell', 'sulfur', 'raw-fish'].concat(FLUIDS);
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
  'solid-fuel': { name: '固体燃料', color: '#d08a3a', mark: 'SF', desc: '由石油气/轻油在化工厂制成的致密燃料，能量约为煤的 4 倍，可作煤的高效替代品' },
  'stone':      { name: '石头',   color: '#b3a685', mark: 'St', desc: '合成石炉的材料，可在熔炉烧成石砖' },
  'stone-brick': { name: '石砖',   color: '#b3a685', mark: 'Sb', desc: '由石头在熔炉烧制，可在组装机合成石墙' },
  'calcite':    { name: '方解石', color: '#e8e0d0', mark: 'Ca', desc: '矿物，用于炼油厂煤液化配方（太空时代）' },
  'iron-plate':   { name: '铁板',   color: '#ccd4de', mark: 'Fp', desc: '最常用的结构材料' },
  'copper-plate': { name: '铜板',   color: '#e0975f', mark: 'Cp', desc: '用于拉制铜线' },
  'iron-gear':    { name: '铁齿轮', color: '#aab5c2', mark: 'G',  desc: '机械核心零件' },
  'iron-stick':   { name: '铁杆',   color: '#b8c0c8', mark: 'Is', desc: '细铁杆，用于分流器、地下带、铁轨与部分配方（对齐《异星工厂》）' },
  'steel-stick':  { name: '钢杆',   color: '#d0d6dc', mark: 'Ss', desc: '细钢杆，用于部分高级配方（对齐《异星工厂》）' },
  'copper-cable': { name: '铜线',   color: '#e8a06a', mark: 'W',  desc: '制造电路板的原料' },
  'green-circuit':{ name: '电路板', color: '#57b95c', mark: 'GC', desc: '自动化与科研的基础元件' },
  'science-pack': { name: '自动化科学包', color: '#d04848', mark: 'SP', desc: '红色科学包，初期的科研消耗品（自动化科学）' },
  'transport-belt':    { name: '传送带', color: '#e0b23c', desc: '运输物品，R 旋转方向，可拖动铺设' },
  'inserter':          { name: '机械臂', color: '#d8cf4e', desc: '严格单向：臂体侧取货、箭头侧放货（亮色箭头=物流方向）' },
  'burner-inserter':   { name: '燃料机械臂', color: '#c46a3a', desc: '烧煤驱动的机械臂，无需电力，开局即可用；需不断补充煤作燃料（对齐《异星工厂》Burner inserter）' },
  'long-inserter':     { name: '长臂机械臂', color: '#e08a4a', desc: '同机械臂，但取放都延伸到第二格' },
  'burner-drill':      { name: '热能采矿机', color: '#c46a3a', desc: '放在矿上自动开采，产出朝向前方，需煤' },
  'stone-furnace':     { name: '石炉',   color: '#9c9486', desc: '把矿石冶炼成板材，需煤作燃料' },
  'assembling-machine':{ name: '组装机', color: '#6f86c9', desc: '设置配方后自动生产（3×3）' },
  'storage-chest':     { name: '储物箱', color: '#8a6a45', desc: '存放物资，配合机械臂自动装卸' },
  'lab':               { name: '研究中心', color: '#4aa8a0', desc: '消耗科学包推进所选科技（3×3）' },
  'lamp':              { name: '电灯', color: '#e8e4a0', desc: '耗电照明设备（1×1）：通电后在夜间照亮周围区域，让基地在黑暗中清晰可见。夜晚无电时熄灭' },
  'substation':        { name: '变电站', color: '#b0802a', desc: '超大型电线杆（4×4）：连接电力与电路网络，覆盖范围远大于普通电线杆（连接距离约 18 格），用于跨区域组网（对齐《异星工厂》Substation）' },
  'programmable-speaker': { name: '可编程音箱', color: '#a05ad0', desc: '电路网络设备（1×1）：读取所连网络的信号，可在面板设置告警条件与输出信号，满足条件时发光提示，用于信号监控与告警（对齐《异星工厂》Programmable speaker）' },
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
  'fast-splitter':    { name: '快速分流器', color: '#d04a3a', desc: '同分流器，但吞吐与快速带一致，可输送更快的物流（对齐《异星工厂》Fast splitter）' },
  'priority-splitter': { name: '优先级分流器', color: '#e07b2e', desc: '同分流器，但可通过面板指定优先把货推向一侧；另一侧仅作为溢出通道' },
  'filter-inserter':   { name: '过滤机械臂', color: '#58b8e8', desc: '同机械臂，可在面板指定只抓取某种物品' },
  'stack-inserter':    { name: '堆叠机械臂', color: '#e8e059', desc: '同机械臂，但可一次性抓取多达 3 个同种物品' },
  'stack-filter-inserter': { name: '堆叠过滤机械臂', color: '#d8e048', desc: '过滤与堆叠二合一：可一次抓取多达 3 个「指定物品」，装卸效率高且精确分类' },
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
  'gate':              { name: '门', color: '#7a7468', desc: '可开合的入口：玩家靠近自动打开、离开自动关闭，敌人无法通过（1×1），与石墙搭配构建防线' },
  'magazine':          { name: '弹药匣', color: '#b08a4a', desc: '机枪炮塔的标准弹药' },
  'piercing-rounds':   { name: '穿甲弹', color: '#b05a4a', desc: '比普通弹药威力更高的穿甲弹药' },
  'refinery':          { name: '炼油厂', color: '#b06a3e', desc: '把原油炼成重油/轻油/石油气，或煤液化（5×5，吃电力，需选配方）。背面2输入、正面3输出' },
  'chemical-plant':    { name: '化工厂', color: '#7d9464', desc: '流体化学加工厂：石油气+煤→塑料，重油/轻油裂解（3×3，吃电力）。底部2输入、顶部2输出，成对固定；固体原料机械臂任意方向放入' },
  // ===== 玩家武器与弹药（战斗体系扩充） =====
  'pistol':          { name: '手枪',   color: '#8a8f9a', desc: '基础随身武器。选中后按空格或对敌人点击开火，消耗弹药匣' },
  'submachine-gun':  { name: '冲锋枪', color: '#6a7285', desc: '高射速全自动武器，消耗弹药匣' },
  'shotgun':         { name: '散弹枪', color: '#a07a4a', desc: '近距霰弹，多弹丸高伤害，消耗散弹枪弹' },
  'combat-shotgun':  { name: '战斗散弹枪', color: '#a05a3a', desc: '进阶散弹枪：射速更快、伤害更高，消耗穿甲散弹枪弹（对齐《异星工厂》Combat shotgun）' },
  'shotgun-shell':   { name: '散弹枪弹', color: '#c07a4a', desc: '散弹枪的专用弹药，一次性发射多枚弹丸（对齐《异星工厂》Shotgun shell）' },
  'piercing-shotgun-shell': { name: '穿甲散弹枪弹', color: '#d05a3a', desc: '穿甲散弹枪弹：每枚弹丸伤害更高，供散弹枪与战斗散弹枪使用（对齐《异星工厂》Piercing shotgun shell）' },
  'cluster-grenade': { name: '集束手雷', color: '#3a7a2a', desc: '威力更强、爆炸范围更大的升级手雷，对成片敌人造成重创（对齐《异星工厂》Cluster grenade）' },
  'rocket-launcher': { name: '火箭筒', color: '#5a7a4a', desc: '发射火箭弹造成范围爆炸伤害' },
  'explosive-rocket-launcher': { name: '爆炸火箭筒', color: '#c05a2a', desc: '发射爆炸火箭弹，爆炸范围与伤害远超普通火箭筒（对齐《异星工厂》Explosive rocket launcher）' },
  'grenade':         { name: '手雷',   color: '#4a7a3a', desc: '投掷爆炸物，对范围敌人造成伤害，可在背包直接使用' },
  'rocket':          { name: '火箭弹', color: '#7a5a4a', desc: '火箭筒的弹药，爆炸造成范围伤害' },
  'explosive-rocket':{ name: '爆炸火箭弹', color: '#c05a2a', desc: '装填高能爆炸物的重型火箭弹，命中后爆炸范围与伤害远超普通火箭弹，供爆炸火箭筒使用（对齐《异星工厂》Explosive rocket）' },
  'flamethrower':    { name: '火焰喷射器', color: '#a05a2a', desc: '喷射燃烧的火焰，造成持续灼烧伤害，消耗火焰弹药（由化工厂用轻油/重油制造）' },
  'flamethrower-ammo': { name: '火焰弹药', color: '#d06a2a', desc: '火焰喷射器的专用燃料，由化工厂用轻油+重油制成，能量密度高（对齐《异星工厂》Flamethrower ammo）' },
  'uranium-rounds':  { name: '铀弹', color: '#9af07a', desc: '铀-238 制成的穿甲弹药，威力远超穿甲弹，供冲锋枪与机枪炮塔使用（对齐《异星工厂》Uranium rounds）' },
  'uranium-cannon-shell': { name: '铀炮弹', color: '#9af07a', desc: '铀-238 制成的重型炮弹，威力远超普通炮弹，供坦克主炮使用（对齐《异星工厂》Uranium cannon shell）' },
  'poison-capsule':  { name: '毒胶囊', color: '#7ad04a', desc: '投掷后落地释放剧毒云雾，对范围内的敌人持续造成伤害（对齐《异星工厂》Poison capsule）' },
  'slowdown-capsule':{ name: '减速胶囊', color: '#4a9ad0', desc: '投掷后落地形成减速力场，大幅降低范围内敌人的移动速度（对齐《异星工厂》Slowdown capsule）' },
  // ===== 军事炮塔扩充 =====
  'laser-turret':    { name: '激光炮塔', color: '#d04a5a', desc: '吃电力自动发射激光，无需弹药，射程更远（2×2）' },
  'flamethrower-turret': { name: '火焰炮塔', color: '#d07a2a', desc: '喷射火焰造成持续灼烧伤害，消耗石油气，范围杀伤（2×2）' },
  // ===== 模块系统（速度/产能/效率各 1-3 级，对齐《异星工厂》Module tiers） =====
  'speed-module':    { name: '速度模块', color: '#4aa0d0', desc: '装入组装机/电炉/炼油厂等，提高生产速度（+40%），增加耗电' },
  'speed-module-2':  { name: '速度模块 II', color: '#3a80b0', desc: '二级速度模块：提高生产速度（+80%），增加耗电。需模块工程 II' },
  'speed-module-3':  { name: '速度模块 III', color: '#2a60a0', desc: '三级速度模块：大幅提高生产速度（+120%），增加耗电。需模块工程 III' },
  'productivity-module': { name: '产能模块', color: '#57b95c', desc: '装入组装机/电炉等，生产时累积额外产出（每 30 个 +1 免费产出），降低速度并增加耗电' },
  'productivity-module-2': { name: '产能模块 II', color: '#3a9a4a', desc: '二级产能模块：累积额外产出效率更高（每 20 个 +1 免费产出），降低速度并增加耗电。需模块工程 II' },
  'productivity-module-3': { name: '产能模块 III', color: '#2a8a3a', desc: '三级产能模块：累积额外产出效率最高（每 15 个 +1 免费产出），降低速度并增加耗电。需模块工程 III' },
  'beacon':        { name: '信号塔', color: '#5a7a9a', desc: '模块中继塔（3×3，吃电力）：内装 2 个模块，向 9×9 范围内的生产建筑广播模块加成，效果约为信号塔内模块的 ' + '50%' + '。一座信号塔可服务多台生产设备' },
  'efficiency-module': { name: '效率模块', color: '#8a7ae8', desc: '装入组装机/电炉等，大幅降低生产耗电（每级 -30% 用电，小幅度降速），节能环保' },
  'efficiency-module-2': { name: '效率模块 II', color: '#6a5ac8', desc: '二级效率模块：更强降低生产耗电（-45% 用电），小幅度降速。需模块工程 II' },
  'efficiency-module-3': { name: '效率模块 III', color: '#4a3aa8', desc: '三级效率模块：极强降低生产耗电（-60% 用电），小幅度降速。需模块工程 III' },
  // ===== 火箭发射（终局）=====
  'advanced-circuit':{ name: '高级电路板', color: '#d0608a', desc: '红板，中后期高级电子元件，用于产能模块与电引擎' },
  'engine-unit':     { name: '引擎单元', color: '#8a6a4a', desc: '基础机械动力单元' },
  'electric-engine': { name: '电动引擎', color: '#7a9a6a', desc: '高级动力单元，用于火箭燃料' },
  'processing-unit': { name: '处理器', color: '#5a8ad0', desc: '蓝板，最先进电子元件，用于火箭控制单元' },
  'low-density-structure': { name: '低密度结构', color: '#b0b8c0', desc: '轻质航空结构材料' },
  'rocket-fuel':     { name: '火箭燃料', color: '#d07a2a', desc: '火箭推进剂，用石油气+电引擎制造' },
  'rocket-control-unit': { name: '火箭控制单元', color: '#d04a4a', desc: '火箭的大脑，用处理器+高级电路板制造' },
  'rocket':          { name: '火箭', color: '#c0c8d0', mark: '🚀', desc: '由火箭发射井集齐部件组装而成的完整火箭本体，放入卫星后可发射' },
  'satellite':       { name: '卫星', color: '#c0c8d0', desc: '放入火箭发射井发射，赢得游戏' },
  'rocket-silo':     { name: '火箭发射井', color: '#7a6a5a', desc: '组装并发射火箭的终局建筑（5×5），放入卫星并填充火箭部件后发射' },
  'radar':           { name: '雷达', color: '#5a8a8a', desc: '周期性扫描周围区域，点亮小地图/标记新探索区（3×3，吃电力）' },
  'explosive':       { name: '爆炸物', color: '#d05a2a', desc: '由煤和石油气制造的高能化合物，用于火箭弹' },
  'battery':         { name: '电池', color: '#d0c04a', desc: '储能元件，用于激光炮塔与卫星' },
  // ===== 后期科学包与飞行机器人框架（对齐《异星工厂》7 色科学包）=====
  'flying-robot-frame':{ name: '飞行机器人框架', color: '#7a9ad0', desc: '机器人飞行骨架，制造施工/物流机器人与黄瓶的关键中间件' },
  'production-science-pack': { name: '产能科学包', color: '#a05ad0', mark: 'PP', desc: '紫色科学包，晚期科研消耗品（产能科学）' },
  'utility-science-pack': { name: '实用科学包', color: '#d0d048', mark: 'UP', desc: '黄色科学包，最高级科研消耗品（实用科学）' },
  // ===== 战斗机器人胶囊（对齐《异星工厂》Combat robots / Capsules）=====
  'defender-capsule':  { name: '防御机器人胶囊', color: '#5aa0d0', desc: '投掷后释放防御机器人：跟随玩家，自动攻击附近敌人（有续航时间）' },
  'distractor-capsule':{ name: '干扰机器人胶囊', color: '#d0a04a', desc: '投掷后释放干扰机器人：原地悬浮吸引敌人火力，为玩家争取时间' },
  'destroyer-capsule': { name: '破坏机器人胶囊', color: '#d05a5a', desc: '投掷后释放破坏机器人：主动冲向并摧毁敌人，伤害更高（高级战斗解锁）' },
  // ===== 载具（对齐《异星工厂》Car）=====
  'car':               { name: '装甲车', color: '#8a6a3a', desc: '可驾驶的载具：靠近后按 E 进入驾驶（WASD 更快移动），消耗煤作燃料，E 下车' },
  'tank':              { name: '坦克', color: '#4a6a3a', desc: '重型战斗载具：装甲更厚、速度较慢，可发射炮弹造成范围伤害。需高级战斗科技' },
  'cannon-shell':      { name: '炮弹', color: '#8a5a2a', desc: '坦克主炮的弹药，命中后造成范围爆炸伤害' },
  'explosive-cannon-shell': { name: '爆炸炮弹', color: '#d05a2a', desc: '装填高能爆炸物的重型炮弹：命中后造成更大范围、更高伤害的爆炸，供坦克主炮使用（对齐《异星工厂》Explosive cannon shell）' },
  'explosive-uranium-cannon-shell': { name: '铀爆炸炮弹', color: '#9ae07a', desc: '铀-238 制成的终极重型炮弹：兼具铀的穿透杀伤与爆炸的范围杀伤，是坦克最强弹药（对齐《异星工厂》Explosive uranium cannon shell）' },
  // ===== 护甲（对齐《异星工厂》Armor）=====
  'light-armor':       { name: '轻型护甲', color: '#8a8a72', desc: '基础护甲：减少 20% 所受伤害。穿在身上防御敌人' },
  'heavy-armor':       { name: '重型护甲', color: '#6a6a5a', desc: '高级护甲：减少 45% 所受伤害。需高级战斗科技' },
  // ===== 终局载具与防御（对齐《异星工厂》Spidertron / Artillery / Landmine）=====
  'spidertron':        { name: '蜘蛛机器人', color: '#7a6ad0', desc: '终极战斗载具：六足步行机，速度快、可发射导弹并配备车载自动炮塔，无视地形（跨越水/墙）（3×3）' },
  'land-mine':         { name: '地雷', color: '#8a7a5a', desc: '铺设在地面，敌人踏入时爆炸造成范围伤害。一次性消耗（1×1）' },
  'artillery-turret':  { name: '炮兵连', color: '#7a5a4a', desc: '超远程炮台：消耗炮弹轰击超远距离的敌人，是晚期基地防御的利器（4×4）' },
  'artillery-shell':   { name: '炮弹（炮兵）', color: '#8a5a3a', desc: '炮兵连的弹药，命中后造成超大范围爆炸伤害' },
  // ===== 铁路系统（火车） =====
  'rail':              { name: '铁轨', color: '#6a6a70', desc: '铺设铁轨形成铁路网，火车沿轨道行驶。与相邻铁轨自动连通，可拐弯（1×1）' },
  'locomotive':        { name: '火车头', color: '#d04a3a', desc: '烧煤驱动的机车，在铁轨上行驶。煤装入后自动前进；可挂接货运车厢组成列车' },
  'cargo-wagon':       { name: '货运车厢', color: '#8a6a4a', desc: '货车厢，挂在火车头后沿铁轨随行，最多存放 10 种物品各 100 个。车站可用机械臂装卸' },
  'fluid-wagon':       { name: '流体车厢', color: '#4a90c0', desc: '罐车车厢，挂在车头后沿铁轨随行，可运输任意一种流体（容量 ' + FLUID_WAGON_CAP + '）。车站可用泵从侧边装卸流体' },
  'artillery-wagon':   { name: '炮兵车厢', color: '#8a5a3a', desc: '挂载于列车的远程炮兵：列车行驶/停靠期间自动轰击射程内远处敌人，命中造成大范围爆炸，内装炮兵炮弹（对齐《异星工厂》Artillery wagon）' },
  'train-stop':        { name: '车站', color: '#5a8ac0', desc: '火车停靠站：列车行驶到车站所在铁轨即停车，便于机械臂/传送带装卸货物' },
  'rail-signal':       { name: '铁路信号灯', color: '#e04a4a', desc: '放在铁轨旁，指示前方区段是否被列车占用，用于多列火车防追尾（1×1）' },
  'rail-chain-signal': { name: '铁路链式信号灯', color: '#e0a04a', desc: '放在铁轨旁，连锁转发前方信号灯状态：只有当前方区段整段畅通时才放行，防止列车在复杂交叉口内停车堵塞（1×1，对齐《异星工厂》Rail chain signal）' },
  // ===== 润滑油 =====
  'lubricant':         { name: '润滑油', color: '#d8c020', mark: 'Lub', desc: '流体，由化工厂用重油加工得到，用于制造电动引擎等高级部件' },
  // ===== 硫磺/硫酸（对齐《异星工厂》Sulfur & Sulfuric acid 化工链）=====
  'sulfur':            { name: '硫磺', color: '#d8d020', mark: 'S', desc: '黄色粉末，由石油气+水在化工厂制得，是制造硫酸的原料' },
  'sulfuric-acid':     { name: '硫酸', color: '#c8c030', mark: 'H₂SO₄', desc: '强腐蚀性流体，由硫磺+水+铁板在化工厂制得，用于制造电池、激光炮塔与火箭卫星等高级装备' },
  // ===== 物流机器人网络 =====
  'roboport':          { name: '机器人港', color: '#3a8a8a', desc: '物流机器人的基地与充电站（4×4，吃电力）。把物流机器人放入机器人港后自动调度，机器人往返供应箱与需求箱搬运货物，电量低时回到机器人港充电' },
  'logistic-robot':    { name: '物流机器人', color: '#4aa0d0', desc: '飞行机器人，放入机器人港后自动在供应箱/需求箱之间搬运物资，消耗电量，需回港充电' },
  'construction-robot':{ name: '施工机器人', color: '#d0a04a', desc: '飞行机器人，装备个人机器人港后，可自动按蓝图/红图施工：建造蓝图中的建筑、拆除标记的建筑，消耗背包物资' },
  'personal-roboport':{ name: '个人机器人港', color: '#7a9a4a', desc: '个人装备：装备后提供施工机器人工作范围（12 格、最多 4 台在场），蓝图粘贴自动由施工机器人建造（需背包中拥有施工机器人）' },
  'personal-roboport-mk2':{ name: '个人机器人港 II', color: '#5a8ac0', desc: '进阶个人装备：装备后提供更大施工机器人工作范围（20 格、最多 8 台在场），蓝图粘贴自动由施工机器人建造（对齐《异星工厂》Personal roboport Mk2）' },
  'logistic-chest-passive': { name: '被动供应箱', color: '#c9a84a', desc: '物流箱：可手动/机械臂存入货物，物流机器人会从箱中取货送往需求箱；也能接收机器人返还的货物' },
  'logistic-chest-active':  { name: '主动供应箱', color: '#d0743a', desc: '物流箱：机器人优先从此取货供应网络；多出的货物机器人会收纳到这里，适合作为原料集散点' },
  'logistic-chest-storage': { name: '仓储箱', color: '#8a9a6a', desc: '物流箱：机器人把返还/多余货物收纳到这里，也可作为备用取货源。所有仓储箱共享存放' },
  'logistic-chest-buffer': { name: '缓冲箱', color: '#c8a05a', desc: '物流箱：介于需求箱与仓储箱之间——既按设定请求货物，又可向网络供应，作为中转缓冲（对齐《异星工厂》Buffer chest）' },
  'logistic-chest-requester': { name: '需求箱', color: '#5a8ad0', desc: '物流箱：在面板设置每种物品的需求量，物流机器人会自动从供应箱/仓储箱送货过来补足到目标数量' },
  // ===== 钓鱼与生鱼（对齐《异星工厂》：水域可钓鱼，钓到生鱼） =====
  'raw-fish': { name: '生鱼', color: '#8ab0c0', mark: '鱼', desc: '在水域边缘钓鱼获得的基础食物，可作为低效燃料使用；也可在背包中食用恢复生命值（对齐《异星工厂》：吃鱼治疗）' },
  // ===== 核能（对齐《异星工厂》核动力）=====
  'uranium-ore':  { name: '铀矿石', color: '#7fd44a', mark: 'U', desc: '放射性矿物，距出生点较远处生成，须用电采矿机开采，离心机处理成铀' },
  'uranium-235': { name: '铀-235', color: '#9af07a', mark: 'U⁵', desc: '裂变同位素，由离心机处理铀矿小概率获得；是制造核燃料的关键' },
  'uranium-238': { name: '铀-238', color: '#6aa84a', mark: 'U⁸', desc: '丰度同位素，由离心机处理铀矿大量获得，可参与富集循环' },
  'nuclear-fuel': { name: '核燃料', color: '#9ae06a', mark: '☢', desc: '核反应堆的燃料，由铀-235制造，可持续提供巨量高温蒸汽' },
  'used-up-uranium-fuel-cell': { name: '废燃料棒', color: '#6a7a4a', mark: '废', desc: '核燃料燃尽的残棒，可在离心机再生为铀-238，闭合核燃料循环' },
  'centrifuge':   { name: '离心机', color: '#7a8a9a', desc: '把铀矿石分离成铀-235 / 铀-238；也可进行铀富集循环（Kovarex）（2×2，吃电力）' },
  'nuclear-reactor': { name: '核反应堆', color: '#4a8a5a', desc: '消耗核燃料产生巨量热量（5×5）。热量经导热管传导至热交换器，由热交换器把水烧成高温蒸汽，再供汽轮机发电（对齐《异星工厂》核能标准链路）' },
  'steam-turbine': { name: '汽轮机', color: '#8fb8d0', desc: '消耗高温蒸汽发电，功率远高于蒸汽机（3×3）。接入热交换器/储汽的蒸汽管道即可' },
  'heat-pipe':    { name: '导热管', color: '#d98a3a', desc: '核能的传热设备（1×1）：把核反应堆产生的热量传导到热交换器，可多根串联、沿路传输（对齐《异星工厂》Heat pipe）' },
  'heat-exchanger': { name: '热交换器', color: '#a06a4a', desc: '核能的水→蒸汽转换设备（3×1）：消耗导热管传来的热量，把水烧成高温蒸汽供汽轮机发电（对齐《异星工厂》Heat exchanger）' },
  // ===== 电路网络（对齐《异星工厂》Circuit Network）=====
  'small-electric-pole': { name: '小型电线杆', color: '#8a5a2a', desc: '电线杆：铺设后与附近电线杆自动连线，构成电路网络（1×1，连接距离 7 格）。红/绿线可独立传输信号' },
  'medium-electric-pole': { name: '中型电线杆', color: '#a06a2a', desc: '电线杆：连接距离更远（9 格），构成更大范围的电路网络（2×2）' },
  'big-electric-pole': { name: '大型电线杆', color: '#b0802a', desc: '电线杆：超远连接距离（15 格），用于跨区域组网（2×2）' },
  'constant-combinator': { name: '常量组合器', color: '#4a7ac0', desc: '电路设备：面板设置若干常量信号，持续输出到所连网络（1×1）。可指定输出到红线或绿线' },
  'arithmetic-combinator': { name: '运算组合器', color: '#4a9ac0', desc: '电路设备：读取网络输入信号，做加减乘除运算后输出结果信号（1×1）' },
  'decider-combinator': { name: '判断组合器', color: '#4ac0a0', desc: '电路设备：按条件（如 信号 > 10）判断，满足时输出指定信号；可做“非”逻辑（1×1）' },
  // ===== 功率开关（对齐《异星工厂》Power switch，电路控制断电）=====
  'power-switch': { name: '功率开关', color: '#c06040', desc: '电路设备（1×1）：接入电路网络，按面板设定的条件判断是否切断电网供电。条件满足时强制全图断电（甩负荷保护），不满足时正常供电，用于按燃料/电量等信号自动调度电力（对齐《异星工厂》Power switch）' },
  // ===== 混凝土 / 地形改造（对齐《异星工厂》Concrete & Landfill）=====
  'concrete': { name: '混凝土', color: '#9a9aa0', desc: '地面装饰：铺设在草地上可加速玩家行走（比泥地快），需在玩家脚下使用或按住铺设' },
  'refined-concrete': { name: '精炼混凝土', color: '#b0b0b6', desc: '地面装饰：比普通混凝土更耐磨、行走加速更明显（对齐《异星工厂》Refined concrete）' },
  'hazard-concrete': { name: '警示混凝土', color: '#c0a020', desc: '地面装饰：黑黄警示条纹装饰地砖，行走加速同普通混凝土（对齐《异星工厂》Hazard concrete）' },
  'stone-path': { name: '石砖路', color: '#a8a09a', desc: '地面装饰：铺设在地面上美观且加速行走（由石砖合成）' },
  'landfill': { name: '填海料', color: '#8a6a3a', desc: '地形改造：把水面填成可建造的陆地（由石头+土合成）' },
  // ===== 模块化护甲 + 个人装备（对齐《异星工厂》Modular armor & Equipment grid）=====
  'modular-armor':  { name: '模块化护甲', color: '#6a8a9a', desc: '基础模块化护甲：减伤 30%，自带 5×5 装备网格，可安装太阳能板/电池/外骨骼等个人装备' },
  'power-armor':    { name: '强力装甲', color: '#5a7aa8', desc: '高级模块化护甲：减伤 45%，自带 7×7 装备网格，更多插槽安装个人装备' },
  'power-armor-mk2':{ name: '强力装甲 II', color: '#5a5aa8', desc: '顶级模块化护甲：减伤 55%，自带 8×8 装备网格，容纳最强个人装备组合' },
  // ---- 个人装备件（装入护甲网格生效） ----
  'portable-solar-panel': { name: '个人太阳能板', color: '#4aa0d0', desc: '装备件（1×1）：白天为个人电网发电，为外骨骼/激光防御等装备供能' },
  'portable-solar-panel-mk2': { name: '个人太阳能板 II', color: '#3a80c0', desc: '装备件（1×1）：更高功率的个人太阳能板，为个人电网提供更多电力' },
  'portable-fusion-reactor': { name: '便携聚变反应堆', color: '#8ae0a0', desc: '装备件（4×4）：无惧昼夜、持续大功率发电，个人电网的终极电源' },
  'personal-battery': { name: '个人电池', color: '#d0c04a', desc: '装备件（2×2）：存储个人电力，白天/发电盈余时充电，供装备随时调用' },
  'personal-battery-mk2': { name: '个人电池 II', color: '#c0a030', desc: '装备件（2×2）：更大储电量的个人电池' },
  'exoskeleton':    { name: '外骨骼', color: '#8a7a5a', desc: '装备件（2×2）：穿戴后大幅提升玩家移动速度，每个 +40%（叠加）' },
  'nightvision':    { name: '夜视仪', color: '#5aa05a', desc: '装备件（1×1）：夜间增强视野，使夜晚如同白昼（对齐《异星工厂》Night vision）' },
  'personal-laser-defense': { name: '个人激光防御', color: '#d04a5a', desc: '装备件（1×1）：自动攻击进入射程的敌人，消耗个人电力，每个激光器各自独立开火' },
  // ===== 能量护盾（对齐《异星工厂》Energy shield：受击时消耗个人电力吸收伤害） =====
  'energy-shield':   { name: '能量护盾', color: '#4ac0d0', desc: '装备件（2×2）：受击时优先消耗个人电网电力生成护盾吸收伤害（每件最多吸收 200 伤害），电力不足时护盾失效、按原伤害扣血' },
  'energy-shield-mk2': { name: '能量护盾 II', color: '#3aa0e0', desc: '装备件（2×2）：更强大的能量护盾（每件最多吸收 400 伤害），受击时优先消耗个人电网电力吸收伤害（对齐《异星工厂》Energy shield MK2）' },
  // ===== 传送带免疫装备（对齐《异星工厂》Belt immunity equipment：站上传送带不再被推动） =====
  'belt-immunity-equipment': { name: '传送带免疫', color: '#8a6ac0', desc: '装备件（1×1）：穿戴后玩家站上传送带不再被带动位移，可稳定在带上站立/作业（对齐《异星工厂》Belt immunity equipment）' },
  // ===== 放电防御装备（对齐《异星工厂》Discharge defense：主动对周围敌人释放电击） =====
  'discharge-defense': { name: '放电防御', color: '#7ac0e0', desc: '装备件（3×3）：手动激活（面板/快捷键）后对以玩家为中心的大范围内所有敌人释放连锁电击，造成高额伤害并大幅消耗个人电网电力。电力不足时无法激活（对齐《异星工厂》Discharge defense equipment）' },
  // ===== 地形树木与木材（对齐《异星工厂》：树可砍伐获得木） =====
  'wood': { name: '木材', color: '#8a6a3a', mark: 'W', desc: '由砍伐树木获得，是木质家具与修理包的原料，也可作低效燃料' },
  // ===== 基础储物箱（对齐《异星工厂》：木箱/铁箱/钢箱递进） =====
  'wooden-chest': { name: '木箱', color: '#a08050', desc: '最基础的储物箱，容量较小（16 格），开局即可合成' },
  'iron-chest': { name: '铁箱', color: '#b0b8c4', desc: '由木箱升级的储物箱，容量更大（32 格）' },
  // ===== 修理包（对齐《异星工厂》Repair pack） =====
  'repair-pack': { name: '修理包', color: '#5aa0d0', desc: '选中后点击受损建筑可修复其耐久度。每个修理包有多次使用次数，损坏建筑恢复 HP' },
  // ===== 空间科学包（对齐《异星工厂》Space science pack，火箭发射产出） =====
  'space-science-pack': { name: '空间科学包', color: '#d0d0e0', mark: 'SC', desc: '由卫星成功发射后获得的高级科学包，用于终局无限科研（科研速度/采矿产能等）' },
  // ===== 流体桶装系统（对齐《异星工厂》Barrel system） =====
  'empty-barrel': { name: '空桶', color: '#9aa0aa', mark: '桶', desc: '可盛装流体的金属桶（1×1）。把空桶放进组装机并接好流体管道，选桶装配方即可把流体灌入桶中；装满的桶可用传送带/机械臂/物流机器人/火车运输，实现流体走物流网络；再把满桶放回组装机选倒空配方，即可把流体倒回管道' },
  'water-barrel':          { name: '桶装水',   color: '#4a90d9', mark: '桶', desc: '盛满水的桶，可经物流网络运输，倒空后获得空桶' },
  'steam-barrel':          { name: '桶装蒸汽', color: '#c8d4dc', mark: '桶', desc: '盛满蒸汽的桶，可经物流网络运输，倒空后获得空桶' },
  'crude-oil-barrel':      { name: '桶装原油', color: '#2a2418', mark: '桶', desc: '盛满原油的桶，可经物流网络运输，倒空后获得空桶' },
  'heavy-oil-barrel':      { name: '桶装重油', color: '#5a3a1e', mark: '桶', desc: '盛满重油的桶，可经物流网络运输，倒空后获得空桶' },
  'light-oil-barrel':      { name: '桶装轻油', color: '#8a5a22', mark: '桶', desc: '盛满轻油的桶，可经物流网络运输，倒空后获得空桶' },
  'petroleum-gas-barrel':  { name: '桶装石油气', color: '#c9a84a', mark: '桶', desc: '盛满石油气的桶，可经物流网络运输，倒空后获得空桶' },
  'lubricant-barrel':      { name: '桶装润滑油', color: '#d8c020', mark: '桶', desc: '盛满润滑油的桶，可经物流网络运输，倒空后获得空桶' },
  'sulfuric-acid-barrel':  { name: '桶装硫酸', color: '#c8c030', mark: '桶', desc: '盛满硫酸的桶，可经物流网络运输，倒空后获得空桶' }
};

// ===== 食用生鱼回血（对齐《异星工厂》：吃鱼治疗） =====
const FISH_HEAL = 20;  // 食用一条生鱼恢复的生命值

// ===== 可桶装的流体（对齐《异星工厂》：所有流体均可桶装，蒸汽亦可） =====
const BARREL_FLUIDS = ['water', 'steam', 'crude-oil', 'heavy-oil', 'light-oil', 'petroleum-gas', 'lubricant', 'sulfuric-acid'];
const BARREL_CAP = 50;  // 每桶盛装流体量（对齐《异星工厂》Barrel 容量）
// 由流体 id 取对应桶物品 id；非桶装流体返回 null
function barrelItemId(fluid) { return BARREL_FLUIDS.indexOf(fluid) >= 0 ? fluid + '-barrel' : null; }
function fluidFromBarrelItem(item) {
  if (item === 'empty-barrel') return null;
  for (const f of BARREL_FLUIDS) if (f + '-barrel' === item) return f;
  return null;
}

const ORES = ['iron-ore', 'copper-ore', 'coal', 'stone', 'calcite'];  // 0-4；原油/铀矿用特殊索引（见 ORE_OIL/ORE_URANIUM）

const SMELTS = [
  { id: 'iron-plate',   inp: 'iron-ore',   time: 3.2 },
  { id: 'copper-plate', inp: 'copper-ore', time: 3.2 },
  { id: 'steel-plate',  inp: 'iron-plate', inCount: 2, time: 16 },
  { id: 'stone-brick',  inp: 'stone',      time: 3.2 }
];

const RECIPES = {
  'steel-plate':        { time: 16,  inp: { 'iron-plate': 2 },                                   out: { 'steel-plate': 1 } },
  'iron-gear':          { time: 0.5, inp: { 'iron-plate': 2 },                                   out: { 'iron-gear': 1 } },
  'iron-stick':         { time: 0.5, inp: { 'iron-plate': 1 },                                   out: { 'iron-stick': 2 } },
  'steel-stick':        { time: 0.5, inp: { 'steel-plate': 1 },                                  out: { 'steel-stick': 2 } },
  'copper-cable':       { time: 0.5, inp: { 'copper-plate': 1 },                                 out: { 'copper-cable': 2 } },
  'green-circuit':      { time: 0.5, inp: { 'iron-plate': 1, 'copper-cable': 3 },                out: { 'green-circuit': 1 } },
  'science-pack':       { time: 5,   inp: { 'copper-plate': 1, 'iron-gear': 1 },                 out: { 'science-pack': 1 } },
  'transport-belt':     { time: 0.5, inp: { 'iron-plate': 1, 'iron-gear': 1 },                   out: { 'transport-belt': 2 } },
  'inserter':           { time: 1,   inp: { 'iron-plate': 1, 'iron-gear': 1, 'green-circuit': 1 }, out: { 'inserter': 1 } },
  'burner-inserter':    { time: 0.5, inp: { 'iron-plate': 1, 'iron-gear': 1 },                  out: { 'burner-inserter': 1 } },
  'long-inserter':      { time: 1,   inp: { 'inserter': 1, 'iron-plate': 2 },                             out: { 'long-inserter': 1 } },
  'burner-drill':       { time: 2,   inp: { 'iron-plate': 4, 'iron-gear': 2 },                   out: { 'burner-drill': 1 } },
  'stone-furnace':      { time: 0.5, inp: { 'stone': 5 },                                        out: { 'stone-furnace': 1 } },
  'storage-chest':      { time: 1,   inp: { 'iron-plate': 8 },                                   out: { 'storage-chest': 1 } },
  'assembling-machine': { time: 2,   inp: { 'iron-plate': 5, 'iron-gear': 4, 'green-circuit': 3 }, out: { 'assembling-machine': 1 } },
  'lab':                { time: 3,   inp: { 'iron-gear': 8, 'green-circuit': 8, 'stone': 10 },   out: { 'lab': 1 } },
  'splitter':           { time: 1,   inp: { 'iron-plate': 4, 'iron-gear': 4, 'iron-stick': 2 },       out: { 'splitter': 1 } },
  'underground':        { time: 1.5, inp: { 'iron-plate': 6, 'iron-gear': 4, 'iron-stick': 4 },       out: { 'underground': 1 } },
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
  'stack-filter-inserter': { time: 2, inp: { 'filter-inserter': 1, 'stack-inserter': 1, 'iron-gear': 4 }, out: { 'stack-filter-inserter': 1 } },
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
  'fast-splitter':   { time: 1, inp: { 'splitter': 1, 'iron-gear': 5 }, out: { 'fast-splitter': 1 } },
  'steel-chest':      { time: 1,   inp: { 'steel-plate': 8 }, out: { 'steel-chest': 1 } },
  // ===== 基础储物箱（木箱→铁箱→钢箱递进，对齐《异星工厂》） =====
  'wooden-chest':     { time: 0.5, inp: { 'wood': 2 }, out: { 'wooden-chest': 1 } },
  'iron-chest':       { time: 1,   inp: { 'wooden-chest': 1, 'iron-plate': 4 }, out: { 'iron-chest': 1 } },
  // ===== 修理包（对齐《异星工厂》Repair pack） =====
  'repair-pack':      { time: 1,   inp: { 'iron-gear': 1, 'copper-plate': 2 }, out: { 'repair-pack': 1 } },
  'steel-furnace':    { time: 2,   inp: { 'steel-plate': 8, 'stone': 6 }, out: { 'steel-furnace': 1 } },
  'assembling-machine-3': { time: 3, inp: { 'assembling-machine-mk2': 1, 'steel-plate': 8, 'iron-gear': 6, 'green-circuit': 8 }, out: { 'assembling-machine-3': 1 } },
  'pipe-to-ground':   { time: 1,   inp: { 'pipe': 10, 'iron-plate': 5 }, out: { 'pipe-to-ground': 1 } },
  'pump':             { time: 1,   inp: { 'iron-plate': 4, 'steel-plate': 2, 'green-circuit': 1 }, out: { 'pump': 1 } },
  'solar-panel':      { time: 5,   inp: { 'copper-plate': 5, 'steel-plate': 5, 'green-circuit': 5 }, out: { 'solar-panel': 1 } },
  'accumulator':      { time: 3,   inp: { 'iron-plate': 2, 'copper-plate': 2, 'green-circuit': 2 }, out: { 'accumulator': 1 } },
  'military-science': { time: 6,   inp: { 'grenade': 1, 'stone-wall': 1, 'piercing-rounds': 1 }, out: { 'military-science': 1 } },  // 对齐《异星工厂》：石墙+穿甲弹+手雷
  // ===== 后期科学包（对齐《异星工厂》7 色科学包）=====
  'flying-robot-frame': { time: 20, inp: { 'electric-engine': 1, 'battery': 2, 'steel-plate': 2, 'green-circuit': 3 }, out: { 'flying-robot-frame': 1 } },
  'production-science-pack': { time: 21, inp: { 'rail': 1, 'electric-furnace': 1, 'productivity-module': 1 }, out: { 'production-science-pack': 1 } },
  'utility-science-pack': { time: 21, inp: { 'processing-unit': 1, 'flying-robot-frame': 1, 'low-density-structure': 3 }, out: { 'utility-science-pack': 1 } },
  // 空间科学包：卫星发射后由火箭发射井产出（非合成配方，见 rocket.js 发射逻辑）
  'gun-turret':       { time: 3,   inp: { 'iron-plate': 8, 'iron-gear': 4, 'copper-plate': 2 }, out: { 'gun-turret': 1 } },
  'stone-wall':       { time: 0.5, inp: { 'stone-brick': 2 }, out: { 'stone-wall': 1 } },
  'gate':             { time: 1,   inp: { 'stone-brick': 4, 'steel-plate': 2 }, out: { 'gate': 1 } },
  'magazine':         { time: 0.5, inp: { 'iron-plate': 1 }, out: { 'magazine': 4 } },
  'piercing-rounds':  { time: 1,   inp: { 'magazine': 1, 'copper-plate': 1, 'steel-plate': 1 }, out: { 'piercing-rounds': 1 } },
  'plastic-bar':       { time: 2,   inp: { 'petroleum-gas': 1, 'coal': 1 },                       out: { 'plastic-bar': 1 } },
  'crack-light':       { time: 3,   inp: { 'heavy-oil': 3 },                                      out: { 'light-oil': 2 } },
  'crack-gas':         { time: 3,   inp: { 'light-oil': 3 },                                      out: { 'petroleum-gas': 2 } },
  'lubricant':         { time: 2,   inp: { 'heavy-oil': 2 },                                      out: { 'lubricant': 1 } },
  // 固体燃料（对齐《异星工厂》：石油气/轻油在化工厂压制）
  'solid-fuel':        { time: 2,   inp: { 'petroleum-gas': 20 },                                 out: { 'solid-fuel': 1 } },
  'solid-fuel-light-oil': { time: 2, inp: { 'light-oil': 10 },                                    out: { 'solid-fuel': 1 } },
  // ===== 铁路系统（火车） =====
  'rail':              { time: 0.5, inp: { 'iron-plate': 1, 'stone': 1, 'iron-stick': 1 },          out: { 'rail': 2 } },
  'locomotive':        { time: 4,   inp: { 'iron-plate': 16, 'steel-plate': 6, 'iron-gear': 8, 'green-circuit': 4 }, out: { 'locomotive': 1 } },
  'cargo-wagon':       { time: 3,   inp: { 'iron-plate': 12, 'steel-plate': 6, 'iron-gear': 6 },  out: { 'cargo-wagon': 1 } },
  'fluid-wagon':       { time: 3,   inp: { 'iron-plate': 8, 'steel-plate': 6, 'pipe': 8 },        out: { 'fluid-wagon': 1 } },
  'artillery-wagon':   { time: 8,   inp: { 'cargo-wagon': 1, 'artillery-turret': 1, 'steel-plate': 20, 'iron-gear': 10, 'processing-unit': 2 }, out: { 'artillery-wagon': 1 } },
  'train-stop':        { time: 2,   inp: { 'iron-plate': 8, 'green-circuit': 3, 'steel-plate': 2 }, out: { 'train-stop': 1 } },
  'rail-signal':       { time: 1,   inp: { 'iron-plate': 4, 'green-circuit': 1 },                 out: { 'rail-signal': 1 } },
  'rail-chain-signal': { time: 1,   inp: { 'iron-plate': 5, 'green-circuit': 2, 'iron-stick': 2 }, out: { 'rail-chain-signal': 1 } },
  // ===== 载具（对齐《异星工厂》Car，需引擎单元）=====
  'car':               { time: 6,   inp: { 'engine-unit': 2, 'steel-plate': 10, 'iron-plate': 6, 'iron-gear': 4 }, out: { 'car': 1 } },
  'tank':              { time: 10,  inp: { 'engine-unit': 4, 'steel-plate': 30, 'iron-gear': 12, 'processing-unit': 2 }, out: { 'tank': 1 } },
  'cannon-shell':      { time: 2,   inp: { 'steel-plate': 4, 'explosive': 2 },                           out: { 'cannon-shell': 1 } },
  // 爆炸炮弹 / 铀爆炸炮弹（对齐《异星工厂》Explosive cannon shell / Explosive uranium cannon shell，坦克弹药分级）
  'explosive-cannon-shell': { time: 3, inp: { 'cannon-shell': 1, 'explosive': 2, 'steel-plate': 2 },       out: { 'explosive-cannon-shell': 1 } },
  'explosive-uranium-cannon-shell': { time: 4, inp: { 'explosive-cannon-shell': 1, 'uranium-238': 2 },   out: { 'explosive-uranium-cannon-shell': 1 } },
  'light-armor':       { time: 3,   inp: { 'iron-plate': 20, 'steel-plate': 5 },                       out: { 'light-armor': 1 } },
  'heavy-armor':       { time: 6,   inp: { 'light-armor': 1, 'steel-plate': 20, 'advanced-circuit': 4 }, out: { 'heavy-armor': 1 } },
  'spidertron':        { time: 30,  inp: { 'tank': 1, 'engine-unit': 16, 'electric-engine': 16, 'low-density-structure': 8, 'processing-unit': 4, 'iron-gear': 20 }, out: { 'spidertron': 1 } },
  'land-mine':         { time: 2,   inp: { 'iron-plate': 3, 'steel-plate': 1, 'explosive': 2 },         out: { 'land-mine': 4 } },
  'artillery-turret':  { time: 15,  inp: { 'steel-plate': 40, 'iron-gear': 16, 'processing-unit': 4, 'steel-stick': 8 }, out: { 'artillery-turret': 1 } },
  'artillery-shell':   { time: 8,   inp: { 'steel-plate': 4, 'explosive': 4, 'processing-unit': 1 }, out: { 'artillery-shell': 1 } },
  // ===== 玩家武器（战斗体系扩充） =====
  'pistol':            { time: 1,   inp: { 'iron-plate': 4, 'iron-gear': 1 },                     out: { 'pistol': 1 } },
  'submachine-gun':    { time: 2,   inp: { 'pistol': 1, 'steel-plate': 4, 'iron-gear': 2 },        out: { 'submachine-gun': 1 } },
  'shotgun':           { time: 2,   inp: { 'iron-plate': 6, 'steel-plate': 4 },                    out: { 'shotgun': 1 } },
  'rocket-launcher':   { time: 3,   inp: { 'steel-plate': 8, 'iron-gear': 6, 'advanced-circuit': 2 }, out: { 'rocket-launcher': 1 } },
  'explosive-rocket-launcher': { time: 4, inp: { 'rocket-launcher': 1, 'steel-plate': 6, 'explosive': 4 }, out: { 'explosive-rocket-launcher': 1 } },
  'grenade':           { time: 1,   inp: { 'iron-plate': 2, 'coal': 2 },                           out: { 'grenade': 1 } },
  // 集束手雷（对齐《异星工厂》Cluster grenade）：更强爆炸范围
  'cluster-grenade':   { time: 2,   inp: { 'grenade': 1, 'steel-plate': 2, 'explosive': 2 },       out: { 'cluster-grenade': 1 } },
  // 散弹枪弹药体系（对齐《异星工厂》Shotgun shell / Piercing shotgun shell）
  'shotgun-shell':     { time: 1,   inp: { 'iron-plate': 2, 'copper-plate': 2 },                   out: { 'shotgun-shell': 2 } },
  'piercing-shotgun-shell': { time: 2, inp: { 'shotgun-shell': 1, 'copper-plate': 2, 'steel-plate': 1 }, out: { 'piercing-shotgun-shell': 1 } },
  'combat-shotgun':    { time: 3,   inp: { 'steel-plate': 6, 'iron-gear': 4, 'advanced-circuit': 2 }, out: { 'combat-shotgun': 1 } },
  'rocket':            { time: 1,   inp: { 'explosive': 1, 'iron-plate': 2 },                      out: { 'rocket': 1 } },
  'explosive-rocket':  { time: 1.5, inp: { 'rocket': 1, 'explosive': 2, 'steel-plate': 2 },        out: { 'explosive-rocket': 1 } },
  'flamethrower':      { time: 2,   inp: { 'steel-plate': 8, 'iron-gear': 4 },                     out: { 'flamethrower': 1 } },
  // ===== 终局战斗弹药与胶囊（对齐《异星工厂》Uranium ammo / Capsules）=====
  // 铀弹：铀-238 + 穿甲弹 → 高伤害穿甲弹药（供冲锋枪/机枪炮塔）
  'uranium-rounds':  { time: 2,   inp: { 'piercing-rounds': 1, 'uranium-238': 1 },                out: { 'uranium-rounds': 1 } },
  // 铀炮弹：普通炮弹 + 铀-238 → 坦克超重炮
  'uranium-cannon-shell': { time: 3, inp: { 'cannon-shell': 1, 'uranium-238': 2 },                out: { 'uranium-cannon-shell': 1 } },
  // 毒胶囊 / 减速胶囊（对齐《异星工厂》Combat capsules）
  'poison-capsule':  { time: 3,   inp: { 'iron-plate': 2, 'green-circuit': 1, 'sulfuric-acid': 2 }, out: { 'poison-capsule': 1 } },
  'slowdown-capsule':{ time: 3,   inp: { 'iron-plate': 2, 'green-circuit': 2, 'sulfuric-acid': 1 }, out: { 'slowdown-capsule': 1 } },
  // 火焰弹药：轻油+重油在化工厂制成（对齐《异星工厂》Flamethrower ammo，化工厂配方）
  'flamethrower-ammo': { time: 2, inp: { 'light-oil': 2, 'heavy-oil': 1 },                        out: { 'flamethrower-ammo': 1 } },
  // ===== 军事炮塔扩充 =====
  'laser-turret':      { time: 4,   inp: { 'steel-plate': 8, 'green-circuit': 10, 'battery': 2 },  out: { 'laser-turret': 1 } },
  'flamethrower-turret': { time: 3, inp: { 'steel-plate': 8, 'iron-gear': 4, 'pipe': 4 },         out: { 'flamethrower-turret': 1 } },
  // ===== 模块系统 =====
  'speed-module':      { time: 2,   inp: { 'green-circuit': 4, 'advanced-circuit': 2 },            out: { 'speed-module': 1 } },
  'speed-module-2':    { time: 4,   inp: { 'speed-module': 2, 'advanced-circuit': 2, 'processing-unit': 2, 'copper-cable': 4 }, out: { 'speed-module-2': 1 } },
  'speed-module-3':    { time: 8,   inp: { 'speed-module-2': 2, 'processing-unit': 4, 'advanced-circuit': 4 }, out: { 'speed-module-3': 1 } },
  'productivity-module': { time: 2, inp: { 'advanced-circuit': 2, 'green-circuit': 2, 'iron-gear': 1 }, out: { 'productivity-module': 1 } },
  'productivity-module-2': { time: 4, inp: { 'productivity-module': 2, 'advanced-circuit': 2, 'processing-unit': 2, 'iron-gear': 2 }, out: { 'productivity-module-2': 1 } },
  'productivity-module-3': { time: 8, inp: { 'productivity-module-2': 2, 'processing-unit': 4, 'advanced-circuit': 4 }, out: { 'productivity-module-3': 1 } },
  'efficiency-module': { time: 2,   inp: { 'green-circuit': 3, 'advanced-circuit': 1, 'plastic-bar': 1 }, out: { 'efficiency-module': 1 } },
  'efficiency-module-2': { time: 4, inp: { 'efficiency-module': 2, 'advanced-circuit': 2, 'processing-unit': 2, 'plastic-bar': 2 }, out: { 'efficiency-module-2': 1 } },
  'efficiency-module-3': { time: 8, inp: { 'efficiency-module-2': 2, 'processing-unit': 4, 'advanced-circuit': 4 }, out: { 'efficiency-module-3': 1 } },
  'beacon':        { time: 4,   inp: { 'steel-plate': 10, 'advanced-circuit': 5, 'green-circuit': 10, 'copper-plate': 5 }, out: { 'beacon': 1 } },
  // ===== 火箭链路中间件 =====
  'advanced-circuit':  { time: 6,   inp: { 'green-circuit': 2, 'plastic-bar': 2, 'copper-cable': 4 }, out: { 'advanced-circuit': 1 } },
  'engine-unit':       { time: 10,  inp: { 'steel-plate': 1, 'iron-gear': 1, 'pipe': 2 },           out: { 'engine-unit': 1 } },
  'electric-engine':   { time: 10,  inp: { 'engine-unit': 1, 'green-circuit': 2, 'lubricant': 2 }, out: { 'electric-engine': 1 } },
  'processing-unit':   { time: 10,  inp: { 'advanced-circuit': 2, 'green-circuit': 20, 'copper-cable': 4 }, out: { 'processing-unit': 1 } },
  'low-density-structure': { time: 20, inp: { 'copper-plate': 20, 'plastic-bar': 5, 'steel-plate': 2 }, out: { 'low-density-structure': 1 } },
  'rocket-fuel':       { time: 8,   inp: { 'solid-fuel': 10, 'light-oil': 10, 'electric-engine': 1 }, out: { 'rocket-fuel': 1 } },
  'rocket-control-unit': { time: 15, inp: { 'processing-unit': 1, 'advanced-circuit': 3 },          out: { 'rocket-control-unit': 1 } },
  'satellite':         { time: 10,  inp: { 'rocket-control-unit': 1, 'low-density-structure': 100, 'processing-unit': 1, 'solar-panel': 1 }, out: { 'satellite': 1 } },
  'rocket-silo':       { time: 20,  inp: { 'steel-plate': 50, 'engine-unit': 20, 'processing-unit': 20, 'green-circuit': 50 }, out: { 'rocket-silo': 1 } },
  'radar':             { time: 2,   inp: { 'iron-plate': 6, 'steel-plate': 2, 'green-circuit': 2 }, out: { 'radar': 1 } },
  // 爆炸物（火箭弹/手雷专用）
  'explosive':         { time: 2,   inp: { 'coal': 2, 'petroleum-gas': 1 },                        out: { 'explosive': 1 } },
  // 电池（激光炮塔/卫星），对齐《异星工厂》：硫酸 + 铁板 + 铜板
  'battery':           { time: 4,   inp: { 'sulfuric-acid': 5, 'iron-plate': 2, 'copper-plate': 2 }, out: { 'battery': 1 } },
  // ===== 硫磺/硫酸（对齐《异星工厂》Sulfur & Sulfuric acid，化工厂配方）=====
  // 硫磺：石油气 + 水 → 硫磺（原版 1s，2:1 比例简化为 3:2）
  'sulfur':            { time: 1,   inp: { 'petroleum-gas': 3, 'water': 2 },                       out: { 'sulfur': 2 } },
  // 硫酸：硫磺 + 水 + 铁板 → 硫酸（原版 1s，数量简化）
  'sulfuric-acid':     { time: 1,   inp: { 'sulfur': 5, 'water': 10, 'iron-plate': 1 },           out: { 'sulfuric-acid': 5 } },
  // ===== 战斗机器人胶囊配方（对齐《异星工厂》Capsules）=====
  'defender-capsule':   { time: 3,  inp: { 'iron-plate': 2, 'green-circuit': 1, 'battery': 1 },         out: { 'defender-capsule': 1 } },
  'distractor-capsule': { time: 3,  inp: { 'iron-plate': 2, 'green-circuit': 2, 'battery': 2 },         out: { 'distractor-capsule': 1 } },
  'destroyer-capsule':  { time: 4,  inp: { 'steel-plate': 2, 'advanced-circuit': 1, 'battery': 2 },      out: { 'destroyer-capsule': 1 } },
  // ===== 物流机器人网络 =====
  'roboport':          { time: 10,  inp: { 'steel-plate': 20, 'advanced-circuit': 5, 'green-circuit': 10, 'battery': 4 }, out: { 'roboport': 1 } },
  'logistic-robot':    { time: 3,   inp: { 'green-circuit': 4, 'iron-gear': 2, 'battery': 2 },          out: { 'logistic-robot': 1 } },
  'construction-robot':{ time: 3,   inp: { 'iron-gear': 2, 'green-circuit': 2, 'battery': 2, 'flying-robot-frame': 1 }, out: { 'construction-robot': 1 } },
  'personal-roboport':{ time: 8,   inp: { 'steel-plate': 12, 'advanced-circuit': 6, 'battery': 4, 'green-circuit': 6 }, out: { 'personal-roboport': 1 } },
  'personal-roboport-mk2':{ time: 14, inp: { 'personal-roboport': 1, 'processing-unit': 10, 'steel-plate': 20, 'battery': 10, 'low-density-structure': 5 }, out: { 'personal-roboport-mk2': 1 } },
  'logistic-chest-passive': { time: 1, inp: { 'iron-plate': 4, 'green-circuit': 1 },                    out: { 'logistic-chest-passive': 1 } },
  'logistic-chest-active':  { time: 1.5, inp: { 'iron-plate': 6, 'green-circuit': 2 },                  out: { 'logistic-chest-active': 1 } },
  'logistic-chest-storage': { time: 1.5, inp: { 'iron-plate': 4, 'green-circuit': 2 },                  out: { 'logistic-chest-storage': 1 } },
  'logistic-chest-requester': { time: 1.5, inp: { 'iron-plate': 6, 'green-circuit': 3 },                out: { 'logistic-chest-requester': 1 } },
  // 缓冲物流箱（对齐《异星工厂》Buffer chest 0.17+）：兼具请求与供应能力
  'logistic-chest-buffer': { time: 2, inp: { 'iron-plate': 6, 'steel-plate': 2, 'green-circuit': 3 },   out: { 'logistic-chest-buffer': 1 } },
  // ===== 核能配方 =====
  // 铀富集（Kovarex，离心机）：铀-238 在铀-235 催化下持续富集出更多铀-235（可自持循环）
  'kovarex':           { time: 60, inp: { 'uranium-238': 40, 'uranium-235': 1 },                  out: { 'uranium-235': 1, 'uranium-238': 41 } },
  // 核燃料（组装机）：由铀-235 制成
  'nuclear-fuel':      { time: 5,   inp: { 'uranium-235': 1, 'iron-plate': 1 },                   out: { 'nuclear-fuel': 1 } },
  // 离心机/反应堆/汽轮机（组装机制造）
  'centrifuge':        { time: 2,   inp: { 'iron-plate': 8, 'green-circuit': 4 },                 out: { 'centrifuge': 1 } },
  'nuclear-reactor':   { time: 15,  inp: { 'steel-plate': 40, 'copper-plate': 20, 'battery': 5, 'centrifuge': 1 }, out: { 'nuclear-reactor': 1 } },
  'steam-turbine':     { time: 5,   inp: { 'steel-plate': 20, 'iron-gear': 8, 'copper-plate': 10 }, out: { 'steam-turbine': 1 } },
  'heat-pipe':         { time: 1,   inp: { 'steel-plate': 4, 'copper-plate': 3 }, out: { 'heat-pipe': 1 } },
  'heat-exchanger':    { time: 3,   inp: { 'steel-plate': 15, 'copper-plate': 15, 'pipe': 10 }, out: { 'heat-exchanger': 1 } },
  // ===== 电路网络配方 =====
  'small-electric-pole': { time: 0.5, inp: { 'iron-plate': 1, 'copper-plate': 1 },                   out: { 'small-electric-pole': 1 } },
  'substation':        { time: 2,   inp: { 'big-electric-pole': 2, 'steel-plate': 8, 'copper-plate': 8, 'processing-unit': 2 }, out: { 'substation': 1 } },
  'programmable-speaker': { time: 1.5, inp: { 'iron-plate': 3, 'green-circuit': 3, 'advanced-circuit': 1, 'copper-cable': 4 }, out: { 'programmable-speaker': 1 } },
  'lamp':              { time: 0.5, inp: { 'iron-plate': 1, 'copper-cable': 2 },                   out: { 'lamp': 1 } },
  'medium-electric-pole': { time: 1,  inp: { 'iron-plate': 3, 'copper-plate': 2, 'iron-gear': 1 },   out: { 'medium-electric-pole': 1 } },
  'big-electric-pole': { time: 1.5,   inp: { 'iron-plate': 5, 'copper-plate': 3, 'iron-gear': 2 },   out: { 'big-electric-pole': 1 } },
  'constant-combinator': { time: 1.5, inp: { 'iron-plate': 4, 'green-circuit': 2, 'copper-cable': 4 }, out: { 'constant-combinator': 1 } },
  'arithmetic-combinator': { time: 1.5, inp: { 'iron-plate': 4, 'green-circuit': 3, 'copper-cable': 4 }, out: { 'arithmetic-combinator': 1 } },
  'decider-combinator': { time: 1.5,  inp: { 'iron-plate': 4, 'green-circuit': 3, 'copper-cable': 4 }, out: { 'decider-combinator': 1 } },
  // 功率开关（对齐《异星工厂》Power switch）：铁板 + 电路板 + 铜线
  'power-switch':       { time: 1.5,  inp: { 'iron-plate': 4, 'green-circuit': 2, 'copper-cable': 4 }, out: { 'power-switch': 1 } },
  // ===== 混凝土 / 地形改造配方 =====
  'concrete':          { time: 0.5, inp: { 'stone-brick': 5, 'iron-plate': 2 },                     out: { 'concrete': 10 } },
  'refined-concrete':  { time: 0.5, inp: { 'concrete': 2, 'steel-plate': 1 },                       out: { 'refined-concrete': 2 } },
  'hazard-concrete':   { time: 0.5, inp: { 'concrete': 1, 'stone-brick': 1, 'iron-plate': 1 },      out: { 'hazard-concrete': 4 } },
  'stone-path':        { time: 0.5, inp: { 'stone-brick': 2 },                                      out: { 'stone-path': 4 } },
  'landfill':          { time: 0.5, inp: { 'stone': 20, 'iron-plate': 1 },                          out: { 'landfill': 1 } },
  // ===== 模块化护甲（对齐《异星工厂》Modular armor）=====
  'modular-armor':     { time: 6,   inp: { 'iron-plate': 20, 'steel-plate': 10, 'green-circuit': 8, 'engine-unit': 2 }, out: { 'modular-armor': 1 } },
  'power-armor':       { time: 12,  inp: { 'modular-armor': 1, 'steel-plate': 30, 'advanced-circuit': 8, 'processing-unit': 4 }, out: { 'power-armor': 1 } },
  'power-armor-mk2':   { time: 20,  inp: { 'power-armor': 1, 'steel-plate': 60, 'processing-unit': 12, 'low-density-structure': 8 }, out: { 'power-armor-mk2': 1 } },
  // ===== 个人装备件 =====
  'portable-solar-panel': { time: 4, inp: { 'solar-panel': 1, 'steel-plate': 3, 'green-circuit': 2 }, out: { 'portable-solar-panel': 1 } },
  'portable-solar-panel-mk2': { time: 8, inp: { 'portable-solar-panel': 2, 'processing-unit': 2, 'steel-plate': 5 }, out: { 'portable-solar-panel-mk2': 1 } },
  'portable-fusion-reactor': { time: 20, inp: { 'nuclear-reactor': 1, 'processing-unit': 20, 'low-density-structure': 10, 'electric-engine': 10 }, out: { 'portable-fusion-reactor': 1 } },
  'personal-battery':  { time: 4,   inp: { 'battery': 2, 'steel-plate': 2, 'copper-plate': 2 },     out: { 'personal-battery': 1 } },
  'personal-battery-mk2': { time: 8, inp: { 'personal-battery': 2, 'processing-unit': 2, 'steel-plate': 4 }, out: { 'personal-battery-mk2': 1 } },
  'exoskeleton':       { time: 10,  inp: { 'engine-unit': 4, 'steel-plate': 20, 'processing-unit': 4, 'battery': 4 }, out: { 'exoskeleton': 1 } },
  'nightvision':       { time: 4,   inp: { 'iron-plate': 4, 'green-circuit': 3, 'advanced-circuit': 1 }, out: { 'nightvision': 1 } },
  'personal-laser-defense': { time: 8, inp: { 'laser-turret': 1, 'processing-unit': 2, 'battery': 4 }, out: { 'personal-laser-defense': 1 } },
  // ===== 能量护盾配方（对齐《异星工厂》：护盾需个人电池/高级电路板/处理器） =====
  'energy-shield':   { time: 8,  inp: { 'steel-plate': 6, 'advanced-circuit': 4, 'battery': 2, 'processing-unit': 1 }, out: { 'energy-shield': 1 } },
  'energy-shield-mk2': { time: 12, inp: { 'energy-shield': 1, 'steel-plate': 10, 'processing-unit': 4, 'battery': 4, 'low-density-structure': 2 }, out: { 'energy-shield-mk2': 1 } },
  // ===== 传送带免疫装备（对齐《异星工厂》：铁板+电路板，早期装备件） =====
  'belt-immunity-equipment': { time: 2, inp: { 'iron-plate': 6, 'green-circuit': 4, 'steel-plate': 2 }, out: { 'belt-immunity-equipment': 1 } },
  // ===== 放电防御装备（对齐《异星工厂》：需高级电路板/电池/处理器等） =====
  'discharge-defense': { time: 10, inp: { 'steel-plate': 10, 'advanced-circuit': 6, 'battery': 4, 'processing-unit': 2 }, out: { 'discharge-defense': 1 } }
};

// ===== 流体桶装配方（对齐《异星工厂》Barrel system） =====
// 桶装：空桶 + 50 流体 → 对应满桶（组装机）；倒空：满桶 → 50 流体 + 空桶。
// 通过下方循环动态生成到 RECIPES，配方归属组装机（含流体输入/输出走管道口）。
(function() {
  for (const f of BARREL_FLUIDS) {
    const barrel = f + '-barrel';
    RECIPES['fill-' + barrel] = { time: 1, inp: { 'empty-barrel': 1, [f]: BARREL_CAP }, out: { [barrel]: 1 } };
    RECIPES['empty-' + barrel] = { time: 1, inp: { [barrel]: 1 }, out: { 'empty-barrel': 1, [f]: BARREL_CAP } };
  }
  // 空桶制造配方（对齐《异星工厂》：钢桶由钢板压制）
  RECIPES['empty-barrel'] = { time: 1, inp: { 'steel-plate': 1 }, out: { 'empty-barrel': 1 } };
})();

// ===== 过滤/需求可选物品全集（对齐《异星工厂》：过滤机械臂、物流需求箱可筛选任意可生产物品）=====
// FILTER_CHOICES 为基础静态清单；此处动态补全所有“可通过配方/冶炼/离心/炼油生产、或可建造/可收集”
// 的物品，保证过滤机械臂与需求箱能选到任意中间件/终局物品（高级电路板、处理器、电池、引擎、火箭部件等）。
let _filterChoicesCache = null;
function filterChoices() {
  if (_filterChoicesCache) return _filterChoicesCache;
  const set = new Set(FILTER_CHOICES);
  // 收集所有配方/炼油/离心配方中的输入输出
  const addRec = (rec) => { if (!rec) return; for (const k in rec.inp) set.add(k); for (const k in rec.out) set.add(k); };
  for (const rid in RECIPES) addRec(RECIPES[rid]);
  for (const rid in REFINERY_RECIPES) addRec(REFINERY_RECIPES[rid]);
  for (const rid in CENTRIFUGE_RECIPES) addRec(CENTRIFUGE_RECIPES[rid]);
  // 冶炼产物（铁板/铜板/钢板/石砖）
  for (const s of SMELTS) { set.add(s.id); set.add(s.inp); }
  // 可建造物品
  for (const id in BUILD_DEFS) set.add(id);
  // 排除纯流体后的有序列表（流体仍保留，但排到末尾）
  const fluids = new Set(FLUIDS);
  const solids = [];
  for (const id of set) if (ITEMS[id] && !fluids.has(id)) solids.push(id);
  // 按物品名称排序，便于查找
  solids.sort((a, b) => (ITEMS[a].name < ITEMS[b].name ? -1 : ITEMS[a].name > ITEMS[b].name ? 1 : 0));
  _filterChoicesCache = solids.concat(FLUIDS.filter(f => ITEMS[f]));
  return _filterChoicesCache;
}

const CHEM_RECIPES = ['plastic-bar', 'crack-light', 'crack-gas', 'lubricant', 'solid-fuel', 'solid-fuel-light-oil', 'sulfur', 'sulfuric-acid', 'flamethrower-ammo'];
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

// ===== 离心机配方（对齐《异星工厂》Centrifuge）=====
// 铀矿处理：10 铀矿石 → 小概率 1 铀-235 + 大量铀-238
// Kovarex 富集循环由通用配方表 RECIPES['kovarex'] 承载（也由离心机执行）。
const CENTRIFUGE_RECIPES = {
  'uranium-processing': { name: '铀矿处理', time: 12, inp: { 'uranium-ore': 10 }, out: { 'uranium-235': 1, 'uranium-238': 9 } },
  // 废燃料棒再生（对齐《异星工厂》Nuclear fuel reprocessing）：5 根废棒 → 3 铀-238，闭合核燃料循环
  'used-fuel-reprocessing': { name: '核燃料再生', time: 12, inp: { 'used-up-uranium-fuel-cell': 5 }, out: { 'uranium-238': 3 } }
};
function isCentrifugeRecipe(id) { return CENTRIFUGE_RECIPES[id] !== undefined || id === 'kovarex'; }

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
  'fast-splitter':      { w: 1, h: 2, solid: false, rotSwap: true },
  'underground':        { w: 1, h: 1, solid: false },
  'fast-underground-belt': { w: 1, h: 1, solid: false },
  'express-underground-belt': { w: 1, h: 1, solid: false },
  'inserter':           { w: 1, h: 1, solid: true },
  'burner-inserter':    { w: 1, h: 1, solid: true },
  'lamp':               { w: 1, h: 1, solid: true },
  'programmable-speaker': { w: 1, h: 1, solid: true },
  'long-inserter':      { w: 1, h: 1, solid: true },
  'filter-inserter':    { w: 1, h: 1, solid: true },
  'stack-inserter':     { w: 1, h: 1, solid: true },
  'stack-filter-inserter': { w: 1, h: 1, solid: true },
  'burner-drill':       { w: 2, h: 2, solid: true },
  'stone-furnace':      { w: 2, h: 2, solid: true },
  'steel-furnace':      { w: 2, h: 2, solid: true },
  'assembling-machine': { w: 3, h: 3, solid: true },
  'assembling-machine-3': { w: 3, h: 3, solid: true },
  'beacon':             { w: 3, h: 3, solid: true },
  'storage-chest':      { w: 1, h: 1, solid: true },
  'wooden-chest':       { w: 1, h: 1, solid: true },
  'iron-chest':         { w: 1, h: 1, solid: true },
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
  'laser-turret':       { w: 2, h: 2, solid: true },
  'flamethrower-turret':{ w: 2, h: 2, solid: true },
  'rocket-silo':        { w: 5, h: 5, solid: true },
  'radar':              { w: 3, h: 3, solid: true },
  'stone-wall':         { w: 1, h: 1, solid: true },
  'gate':               { w: 1, h: 1, solid: true },
  'pumpjack':           { w: 3, h: 3, solid: true },
  'refinery':           { w: 5, h: 5, solid: true },
  'chemical-plant':     { w: 3, h: 3, solid: true },
  'storage-tank':       { w: 3, h: 3, solid: true },
  // ===== 核能建筑 =====
  'centrifuge':         { w: 2, h: 2, solid: true },
  'nuclear-reactor':    { w: 5, h: 5, solid: true },
  'steam-turbine':      { w: 3, h: 3, solid: true },
  'heat-pipe':          { w: 1, h: 1, solid: true },
  'heat-exchanger':     { w: 3, h: 1, solid: true },
  'roboport':           { w: 4, h: 4, solid: true },
  'rail':               { w: 1, h: 1, solid: false },
  'locomotive':         { w: 1, h: 1, solid: true },
  'cargo-wagon':        { w: 1, h: 1, solid: true },
  'fluid-wagon':        { w: 1, h: 1, solid: true },
  'artillery-wagon':    { w: 1, h: 1, solid: true },
  'train-stop':         { w: 1, h: 1, solid: true },
  'rail-signal':        { w: 1, h: 1, solid: true },
  'rail-chain-signal':  { w: 1, h: 1, solid: true },
  'car':                { w: 2, h: 2, solid: true, rotSwap: true },
  'tank':               { w: 3, h: 3, solid: true, rotSwap: true },
  'spidertron':         { w: 3, h: 3, solid: true, rotSwap: true },
  'land-mine':          { w: 1, h: 1, solid: false },
  'artillery-turret':   { w: 4, h: 4, solid: true },
  'logistic-chest-passive': { w: 1, h: 1, solid: true },
  'logistic-chest-active':  { w: 1, h: 1, solid: true },
  'logistic-chest-storage': { w: 1, h: 1, solid: true },
  'logistic-chest-requester': { w: 1, h: 1, solid: true },
  'logistic-chest-buffer': { w: 1, h: 1, solid: true },
  // ===== 电路网络 =====
  'small-electric-pole': { w: 1, h: 1, solid: true },
  'medium-electric-pole': { w: 2, h: 2, solid: true },
  'big-electric-pole': { w: 2, h: 2, solid: true },
  'constant-combinator': { w: 1, h: 1, solid: true },
  'arithmetic-combinator': { w: 1, h: 1, solid: true },
  'decider-combinator': { w: 1, h: 1, solid: true },
  'power-switch':      { w: 1, h: 1, solid: true },
  'substation':        { w: 4, h: 4, solid: true }
};

// ===== 建筑耐久度（对齐《异星工厂》HP 数值） =====
// 每个可建造建筑的最大 HP。敌人会攻击基地内的建筑，受损建筑可用修理包修复；
// HP 归零即被摧毁。无线索设备（传送带/管道/电线等）也有 HP，但敌人优先攻击防御建筑。
const BUILDING_HP = {
  'transport-belt': 60, 'fast-transport-belt': 100, 'express-transport-belt': 140,
  'splitter': 80, 'priority-splitter': 100, 'express-splitter': 120, 'fast-splitter': 100,
  'underground': 60, 'fast-underground-belt': 100, 'express-underground-belt': 140,
  'inserter': 100, 'long-inserter': 100, 'filter-inserter': 100, 'stack-inserter': 100, 'stack-filter-inserter': 100,
  'burner-inserter': 100,
  'burner-drill': 300, 'electric-drill': 300, 'pumpjack': 400,
  'stone-furnace': 200, 'steel-furnace': 200, 'electric-furnace': 300,
  'assembling-machine': 300, 'assembling-machine-mk2': 300, 'assembling-machine-3': 400, 'beacon': 300,
  'storage-chest': 150, 'wooden-chest': 100, 'iron-chest': 150, 'steel-chest': 200,
  'creative-chest': 200, 'void-chest': 200,
  'lab': 400,
  'boiler': 200, 'steam-engine': 300, 'offshore-pump': 200,
  'pipe': 50, 'pipe-to-ground': 50, 'pump': 100, 'storage-tank': 300,
  'creative-pipe': 100, 'void-pipe': 100, 'creative-belt': 100, 'void-belt': 100,
  'solar-panel': 100, 'accumulator': 100, 'passive-power': 200,
  'gun-turret': 400, 'laser-turret': 400, 'flamethrower-turret': 400, 'artillery-turret': 800,
  'stone-wall': 350, 'gate': 350,
  'refinery': 500, 'chemical-plant': 400, 'rocket-silo': 1000, 'radar': 300,
  'centrifuge': 300, 'nuclear-reactor': 1000, 'steam-turbine': 400, 'heat-pipe': 200, 'heat-exchanger': 300,
  'roboport': 600, 'logistic-chest-passive': 200, 'logistic-chest-active': 200,
  'logistic-chest-storage': 200, 'logistic-chest-requester': 200, 'logistic-chest-buffer': 200,
  'small-electric-pole': 60, 'medium-electric-pole': 100, 'big-electric-pole': 150, 'substation': 300,
  'constant-combinator': 100, 'arithmetic-combinator': 100, 'decider-combinator': 100,
  'power-switch': 100,
  'lamp': 50, 'programmable-speaker': 100,
  'rail': 100, 'locomotive': 300, 'cargo-wagon': 250, 'fluid-wagon': 250, 'artillery-wagon': 300, 'train-stop': 300, 'rail-signal': 100, 'rail-chain-signal': 100,
  'car': 200, 'tank': 400, 'spidertron': 600, 'land-mine': 100
};
function buildingMaxHp(type) { return BUILDING_HP[type] || 100; }

// ===== 科技解锁要求（建造/武器/模块）=====
// 物品 -> 所需已完成科技 id。缺少科技时建造/使用会被拦截并提示。
const TECH_REQ = {
  'tank': 'advanced-combat',
  'cannon-shell': 'advanced-combat',
  'heavy-armor': 'advanced-combat',
  'spidertron': 'advanced-combat',
  'land-mine': 'military',
  'artillery-turret': 'advanced-combat',
  'artillery-shell': 'advanced-combat',
  'artillery-wagon': 'advanced-combat',
  'laser-turret': 'advanced-combat',
  'flamethrower-turret': 'advanced-combat',
  'rocket-launcher': 'advanced-combat',
  'flamethrower': 'advanced-combat',
  'explosive-rocket-launcher': 'explosives',
  'destroyer-capsule': 'advanced-combat',
  'defender-capsule': 'weapons',
  'distractor-capsule': 'weapons',
  // 终局战斗弹药与胶囊（对齐《异星工厂》）：铀弹需核能科技（铀-238 依赖），毒/减速胶囊与火焰弹药需高级战斗
  'uranium-rounds': 'nuclear',
  'uranium-cannon-shell': 'nuclear',
  'poison-capsule': 'advanced-combat',
  'slowdown-capsule': 'advanced-combat',
  'flamethrower-ammo': 'advanced-combat',
  'rocket-silo': 'rocket-science',
  'rocket': 'rocket-science',
  'satellite': 'rocket-science',
  'rocket-control-unit': 'rocket-science',
  'rocket-fuel': 'rocket-science',
  'speed-module': 'modules',
  'productivity-module': 'modules',
  'efficiency-module': 'modules',
  'speed-module-2': 'modules2',
  'speed-module-3': 'modules3',
  'productivity-module-2': 'modules2',
  'productivity-module-3': 'modules3',
  'efficiency-module-2': 'modules2',
  'efficiency-module-3': 'modules3',
  'advanced-circuit': 'electronics',
  'sulfur': 'oil',
  'sulfuric-acid': 'oil',
  'processing-unit': 'electronics',
  'electric-engine': 'electronics',
  'radar': 'radar',
  'gate': 'military',
  'production-science-pack': 'production',
  'beacon': 'production',
  'utility-science-pack': 'utility',
  'flying-robot-frame': 'utility',
  'construction-robot': 'utility',
  'personal-roboport': 'utility',
  'personal-roboport-mk2': 'armor-power-mk2',
  // ===== 模块化护甲与个人装备科技门控 =====
  'modular-armor': 'armor-modular',
  'power-armor': 'armor-power',
  'power-armor-mk2': 'armor-power-mk2',
  'portable-solar-panel': 'armor-modular',
  'portable-solar-panel-mk2': 'armor-modular',
  'personal-battery': 'armor-modular',
  'personal-battery-mk2': 'armor-modular',
  'exoskeleton': 'armor-power',
  'nightvision': 'armor-modular',
  'personal-laser-defense': 'armor-power',
  'portable-fusion-reactor': 'armor-power-mk2',
  // 能量护盾：I 型需强力装甲科技，II 型需终极强力装甲 II 科技（对齐《异星工厂》Energy shield 科技线）
  'energy-shield': 'armor-power',
  'energy-shield-mk2': 'armor-power-mk2',
  // 传送带免疫/放电防御装备科技门控（对齐《异星工厂》装备科技线）
  'belt-immunity-equipment': 'armor-modular',
  'discharge-defense': 'armor-power'
};
// ===== 核能科技门控 =====
for (const id of ['centrifuge', 'nuclear-reactor', 'steam-turbine', 'heat-pipe', 'heat-exchanger', 'uranium-235', 'uranium-238', 'nuclear-fuel']) {
  if (!TECH_REQ[id]) TECH_REQ[id] = 'nuclear';
}
// ===== 流体桶装科技门控（对齐《异星工厂》：桶装需流体处理科技） =====
TECH_REQ['empty-barrel'] = 'barrel';
for (const f of BARREL_FLUIDS) TECH_REQ[f + '-barrel'] = 'barrel';
// ===== 铁路科技门控 =====
const RAIL_ITEMS = ['rail', 'locomotive', 'cargo-wagon', 'train-stop', 'fluid-wagon'];
for (const id of RAIL_ITEMS) if (!TECH_REQ[id]) TECH_REQ[id] = 'railways';
if (!TECH_REQ['rail-signal']) TECH_REQ['rail-signal'] = 'rail-signals';
if (!TECH_REQ['rail-chain-signal']) TECH_REQ['rail-chain-signal'] = 'rail-signals';
// ===== 物流机器人网络 =====
const LOGISTIC_ITEMS = ['roboport', 'logistic-robot', 'logistic-chest-passive', 'logistic-chest-active', 'logistic-chest-storage', 'logistic-chest-requester', 'logistic-chest-buffer'];
// 物流箱科技门控：所有物流设备需先研究「物流网络」
for (const id of LOGISTIC_ITEMS) if (!TECH_REQ[id]) TECH_REQ[id] = 'logistics-network';
// ===== 电路网络科技门控 =====
const CIRCUIT_ITEMS = ['small-electric-pole', 'medium-electric-pole', 'big-electric-pole', 'constant-combinator', 'arithmetic-combinator', 'decider-combinator', 'substation', 'programmable-speaker', 'power-switch'];
for (const id of CIRCUIT_ITEMS) if (!TECH_REQ[id]) TECH_REQ[id] = 'circuit-network';
// 电灯：需电力工程科技解锁（对齐《异星工厂》灯由电力工程解锁）
TECH_REQ['lamp'] = 'electric';
// 玩家武器所需科技（用于选择武器时拦截）
const WEAPON_TECH_REQ = {
  'pistol': 'weapons',
  'submachine-gun': 'weapons',
  'shotgun': 'weapons',
  'combat-shotgun': 'advanced-combat',
  'rocket-launcher': 'advanced-combat',
  'explosive-rocket-launcher': 'explosives',
  'flamethrower': 'advanced-combat'
};
// 弹药/投掷物科技门控：散弹枪弹由武器科技解锁，穿甲散弹枪弹与集束手雷由高级战斗解锁
TECH_REQ['shotgun-shell'] = 'weapons';
TECH_REQ['piercing-shotgun-shell'] = 'advanced-combat';
TECH_REQ['cluster-grenade'] = 'advanced-combat';
// 爆炸火箭弹/爆炸火箭筒：研究「爆炸物科技」后解锁（对齐《异星工厂》Explosive rocket 独立科技）
TECH_REQ['explosive-rocket'] = 'explosives';
TECH_REQ['explosive-rocket-launcher'] = 'explosives';
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
// 某物品是否已由科技解锁（无科技需求 = 开局可用；否则需对应科技已研究）
function itemUnlocked(id) {
  const tr = itemTechReq(id);
  return !tr || !!(G.techDone[tr]);
}
// 配方是否已解锁：产出物（主输出）未被科技门控，或对应科技已研究。
// 用于手搓面板与各生产设备（组装机/化工厂/炼油厂/离心机）配方选择列表的解锁判断。
function recipeUnlocked(rid) {
  const rec = RECIPES[rid] || REFINERY_RECIPES[rid] || CENTRIFUGE_RECIPES[rid];
  if (!rec) return false;
  const outKeys = Object.keys(rec.out || {});
  // 无产出物的配方视为未解锁（不会出现）；取第一个产出判断
  if (!outKeys.length) return false;
  return itemUnlocked(outKeys[0]);
}
// 返回配方因缺少哪个科技而锁定（未锁定返回 null）
function recipeLockingTech(rid) {
  const rec = RECIPES[rid] || REFINERY_RECIPES[rid] || CENTRIFUGE_RECIPES[rid];
  if (!rec) return null;
  const outKeys = Object.keys(rec.out || {});
  if (!outKeys.length) return null;
  const tr = itemTechReq(outKeys[0]);
  return tr && !G.techDone[tr] ? tr : null;
}

// ===== 传送带阶级链（对齐《异星工厂》物流升级）=====
// 普通带 → 快速带 → 极速带。用于 R 旋转、覆盖升级/降级、绿图批量升级等。
const BELT_TIERS = ['transport-belt', 'fast-transport-belt', 'express-transport-belt'];
const UNDERGROUND_TIERS = ['underground', 'fast-underground-belt', 'express-underground-belt'];
const SPLITTER_TIERS = ['splitter', 'fast-splitter', 'express-splitter'];
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
  // ==== 一级科技（红瓶，无前置） ====
  mining:     { name: '采矿业', cost: { 'science-pack': 10 }, desc: '采矿机速度 ×2', req: [] },
  logistics:  { name: '物流学', cost: { 'science-pack': 15 }, desc: '传送带速度 ×1.5', req: [] },
  automation: { name: '自动化', cost: { 'science-pack': 20 }, desc: '组装机速度 ×1.5', req: [] },
  // ==== 二级科技（绿瓶） ====
  logistics2: { name: '物流 II', cost: { 'green-science': 25 }, desc: '传送带速度额外 ×1.2（与物流学叠加）', req: ['logistics'] },
  electric:   { name: '电力工程', cost: { 'green-science': 15 }, desc: '电炉 / 电采矿机速度 ×1.2', req: ['automation'] },
  oil:        { name: '石油冶金', cost: { 'green-science': 30 }, desc: '炼油厂 / 抽油机速度 ×1.5', req: [] },
  railways:    { name: '铁路技术', cost: { 'green-science': 30 }, desc: '解锁铁轨、火车头、货运车厢与车站，构建铁路物流', req: ['logistics'] },
  'rail-signals': { name: '铁路信号', cost: { 'blue-science': 30 }, desc: '解锁铁路信号灯，允许多列火车安全同网行驶', req: ['railways'] },
  plastic:    { name: '塑料合成', cost: { 'green-science': 20 }, desc: '化工厂生产塑料耗时缩短 ✓（绿色科研的核心支付项）', req: ['oil'] },
  barrel:     { name: '流体处理', cost: { 'blue-science': 50 }, desc: '解锁空桶与流体桶装配方，可把流体灌入桶中经物流网络/传送带/火车运输，实现流体走物流链', req: ['oil', 'electronics'] },
  radar:      { name: '雷达技术', cost: { 'green-science': 30 }, desc: '解锁雷达，自动扫描并标记新探索区域', req: ['logistics'] },
  // ==== 三级科技（蓝/军瓶） ====
  automation2:{ name: '自动化 II', cost: { 'blue-science': 40 }, desc: '组装机 II 速度额外 ×1.2', req: ['electric'] },
  express:    { name: '极速物流', cost: { 'military-science': 40 }, desc: '解锁极速传送带/地下带/分流器，物流终极档', req: ['logistics2'] },
  military:   { name: '军事工程', cost: { 'military-science': 30 }, desc: '解锁机枪炮塔、石墙、弹药（防御体系）', req: [] },
  weapons:    { name: '单兵武器', cost: { 'military-science': 20 }, desc: '解锁手枪、冲锋枪、散弹枪（F 键或空格攻击）', req: ['military'] },
  'advanced-combat': { name: '高级战斗', cost: { 'military-science': 40, 'blue-science': 30 }, desc: '解锁激光炮塔、火焰炮塔、火箭筒、火焰喷射器与远程敌人', req: ['weapons', 'electronics'] },
  explosives: { name: '爆炸物科技', cost: { 'military-science': 30 }, desc: '解锁爆炸火箭弹（更高威力与更大爆炸范围）与更多爆炸类弹药', req: ['advanced-combat'] },
  electronics: { name: '电子学', cost: { 'blue-science': 40 }, desc: '解锁高级电路板、处理器（火箭链路的关键）', req: ['plastic', 'oil'] },
  'rocket-science': { name: '火箭技术', cost: { 'blue-science': 100, 'military-science': 50 }, desc: '解锁火箭发射井、火箭部件与卫星，发射火箭赢得游戏', req: ['electronics', 'express'] },
  modules:    { name: '模块工程', cost: { 'blue-science': 40 }, desc: '解锁速度模块与产能模块（增强组装机/电炉）', req: ['electronics'] },
  'modules2': { name: '模块工程 II', cost: { 'production-science-pack': 50, 'blue-science': 30 }, desc: '解锁二级速度/产能/效率模块（效果更强）', req: ['modules', 'production'] },
  'modules3': { name: '模块工程 III', cost: { 'production-science-pack': 80, 'utility-science-pack': 60 }, desc: '解锁三级速度/产能/效率模块（效果最强）', req: ['modules2', 'utility'] },
  'logistics-network': { name: '物流网络', cost: { 'blue-science': 50 }, desc: '解锁机器人港、四类物流箱与物流机器人，构建自动化物流网络', req: ['logistics2', 'electronics'] },
  nuclear:    { name: '核能技术', cost: { 'blue-science': 60, 'military-science': 40 }, desc: '解锁离心机（铀矿处理）、核反应堆与汽轮机，构建核能发电体系', req: ['electronics', 'advanced-combat'] },
  'circuit-network': { name: '电路网络', cost: { 'blue-science': 40 }, desc: '解锁电线杆与组合器（常量/运算/判断），构建电路网络，实现信号逻辑控制；含超大型变电站与可编程音箱（告警）', req: ['electronics'] },
  deep:       { name: '重工蓝图', cost: { 'blue-science': 50 }, desc: '蓝包终技：科研总进度获取 +20%', req: ['automation2', 'express'] },
  // ==== 四级科技（紫瓶：产能科学） ====
  production: { name: '产能科技', cost: { 'production-science-pack': 50 }, desc: '解锁信号塔（Beacon）与产能科学链，让产能模块覆盖范围翻倍', req: ['modules', 'deep'] },
  'mining-productivity': { name: '采矿产能', cost: { 'production-science-pack': 60 }, desc: '采矿机额外产出（每级 +10%）', req: ['production'] },
  // ==== 五级科技（黄瓶：实用科学） ====
  'worker-robot-speed': { name: '机器人速度', cost: { 'production-science-pack': 50, 'utility-science-pack': 50 }, desc: '物流/施工机器人速度 ×1.5', req: ['production'] },
  utility: { name: '实用科技', cost: { 'utility-science-pack': 60 }, desc: '解锁飞行机器人框架、施工机器人，完善机器人网络', req: ['logistics-network', 'worker-robot-speed'] },
  'research-speed': { name: '科研速度', cost: { 'production-science-pack': 50, 'utility-science-pack': 50 }, desc: '科研速度 +50%', req: ['utility'] },
  'inserter-capacity': { name: '机械臂容量', cost: { 'production-science-pack': 50, 'utility-science-pack': 30 }, infinite: true, desc: '无限科技：每次研究让堆叠机械臂单次抓取数量 +1（对齐《异星工厂》Inserter capacity bonus）', req: ['production', 'utility'] },
  // ==== 终局装备科技（对齐《异星工厂》Modular armor / Power armor 科技链）====
  'armor-modular': { name: '模块化护甲', cost: { 'production-science-pack': 50, 'utility-science-pack': 50 }, desc: '解锁模块化护甲与基础个人装备（个人太阳能板 / 个人电池 / 夜视仪），装备网格中可安装外骨骼等装备件', req: ['production', 'utility'] },
  'armor-power': { name: '强力装甲', cost: { 'utility-science-pack': 80 }, desc: '解锁强力装甲（更大装备网格）与外骨骼、个人激光防御等高级装备件', req: ['armor-modular'] },
  'armor-power-mk2': { name: '强力装甲 II', cost: { 'utility-science-pack': 120 }, desc: '解锁终极强力装甲 II 与便携聚变反应堆，个人电网获得终极动力', req: ['armor-power', 'nuclear'] },
  // ==== 空间科技（火箭发射后，用空间科学包推进终极无限科研）====
  'space-science': { name: '空间科技', cost: { 'space-science-pack': 50, 'utility-science-pack': 50 }, desc: '解锁空间科学科研体系，允许用空间科学包研究终极科技（科研速度/采矿产能等）', req: ['utility', 'rocket-science'] },
  'space-research-speed': { name: '空间科研速度', cost: { 'space-science-pack': 100 }, infinite: true, desc: '无限科技：每次研究科研速度 +20%（对齐《异星工厂》Research speed 无限科技）', req: ['space-science'] },
  'space-mining-productivity': { name: '空间采矿产能', cost: { 'space-science-pack': 100 }, infinite: true, desc: '无限科技：每次研究采矿产能 +10%（对齐《异星工厂》Mining productivity 无限科技）', req: ['space-science'] },
  'weapon-damage': { name: '武器伤害', cost: { 'space-science-pack': 100, 'military-science': 50 }, infinite: true, desc: '无限科技：每次研究提升所有武器与炮塔伤害 +10%（对齐《异星工厂》Weapon damage 无限科技），让科技军备在终局持续成长', req: ['space-science', 'advanced-combat'] },
  infinite:   { name: '无限科技', cost: {}, infinite: true, desc: '无限研究：消耗任意科学包，永不完成', req: [] }
};

// 判断是否为无限科技（永不完成、消耗任意科学包）
function isInfiniteTech(tid) { return !!(TECHS[tid] && TECHS[tid].infinite); }
// 研究队列：完成当前科技后顺延到队列下一项。返回下一个 activeTech（或 null）。
function advanceTechQueue() {
  if (!G.techQueue) G.techQueue = [];
  // 移除已完成/已入队的当前项
  if (G.techQueue.length && G.techQueue[0] === G.activeTech) G.techQueue.shift();
  // 跳过已完成与前置未满足的项
  while (G.techQueue.length && (G.techDone[G.techQueue[0]] || techLocked(G.techQueue[0]))) G.techQueue.shift();
  G.activeTech = G.techQueue.length ? G.techQueue[0] : null;
  if (typeof renderPanel === 'function') renderPanel(false);
  return G.activeTech;
}
// 前置科技是否全部完成（空前置或无前置即视为满足）
function techPrereqsDone(tid) {
  const req = (TECHS[tid] && TECHS[tid].req) || [];
  for (const r of req) if (!G.techDone[r]) return false;
  return true;
}
// 科技是否被前置锁定（有未完成的前置科技）
function techLocked(tid) { return !techPrereqsDone(tid); }
// 返回未完成的前置科技 id 列表（用于界面提示）
function techMissingPrereqs(tid) {
  const req = (TECHS[tid] && TECHS[tid].req) || [];
  return req.filter(r => !G.techDone[r]);
}

const DEFAULT_SETTINGS = { infiniteOre: true, autoSave: true, combat: false, capDPR: true, lowRes: false, virtualJoystick: false, minimap: true, sound: true, soundVol: 0.8 }; // sound:音效开关 soundVol:音量0~1
const SETTINGS_KEY = 'factory-settings-v1';

function drawItemGlyph(x, id, cx, cy, s) {
  const col = ITEMS[id].color;
  const r = s / 2;
  const dark = 'rgba(10,12,16,.55)';
  x.save();
  x.translate(cx, cy);
  switch (id) {
    case 'iron-ore':
    case 'copper-ore': {
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
    case 'science-pack':
    case 'green-science':
    case 'blue-science':
    case 'military-science':
    case 'production-science-pack':
    case 'utility-science-pack': {
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
    // ===== 流体桶（对齐《异星工厂》Barrel）：金属桶身 + 顶部环口 + 流体色带 =====
    case 'empty-barrel':
    case 'water-barrel':
    case 'steam-barrel':
    case 'crude-oil-barrel':
    case 'heavy-oil-barrel':
    case 'light-oil-barrel':
    case 'petroleum-gas-barrel':
    case 'lubricant-barrel':
    case 'sulfuric-acid-barrel': {
      const fluid = fluidFromBarrelItem(id);
      const bodyC = '#a8b0b8', rimC = '#7a8288', fluidC = fluid ? ITEMS[fluid].color : 'transparent';
      // 桶身
      x.fillStyle = bodyC;
      x.beginPath();
      x.moveTo(-r * 0.72, r * 0.05);
      x.lineTo(-r * 0.72, -r * 0.55);
      x.arc(0, -r * 0.55, r * 0.72, Math.PI, 0, true);
      x.lineTo(r * 0.72, r * 0.05);
      x.closePath();
      x.fill();
      // 底部
      x.fillStyle = rimC;
      x.beginPath();
      x.moveTo(-r * 0.72, r * 0.05);
      x.lineTo(r * 0.72, r * 0.05);
      x.lineTo(r * 0.62, r * 0.3);
      x.lineTo(-r * 0.62, r * 0.3);
      x.closePath();
      x.fill();
      // 流体色带（盛装流体的颜色）
      if (fluid) {
        x.fillStyle = fluidC;
        x.fillRect(-r * 0.6, -r * 0.15, r * 1.2, r * 0.28);
        x.fillStyle = 'rgba(0,0,0,.25)';
        x.fillRect(-r * 0.6, -r * 0.15, r * 1.2, r * 0.05);
      }
      // 顶部环口
      x.strokeStyle = rimC;
      x.lineWidth = Math.max(1.5, s * 0.08);
      x.beginPath();
      x.arc(0, -r * 0.72, r * 0.22, 0, 7);
      x.stroke();
      x.fillStyle = '#d8dee2';
      x.beginPath();
      x.arc(0, -r * 0.72, r * 0.12, 0, 7);
      x.fill();
      break;
    }
    case 'refined-concrete':
    case 'hazard-concrete': {
      // 地砖图标：四块石板拼合（警示混凝土加条纹）
      x.fillStyle = col;
      rrPath(x, -r * 0.8, -r * 0.8, r * 1.6, r * 1.6, s * 0.1);
      x.fill();
      x.strokeStyle = dark;
      x.lineWidth = Math.max(1, s * 0.05);
      x.stroke();
      // 石板缝
      x.strokeStyle = 'rgba(0,0,0,.35)';
      x.lineWidth = Math.max(1, s * 0.04);
      x.beginPath();
      x.moveTo(-r * 0.2, -r * 0.8); x.lineTo(-r * 0.2, r * 0.8);
      x.moveTo(r * 0.55, -r * 0.8); x.lineTo(r * 0.55, r * 0.8);
      x.moveTo(-r * 0.8, r * 0.1); x.lineTo(r * 0.8, r * 0.1);
      x.stroke();
      if (id === 'hazard-concrete') {
        // 黑黄警示斜纹
        x.strokeStyle = '#2a2a30';
        x.lineWidth = Math.max(1.5, s * 0.1);
        for (let i = 0; i < 3; i++) {
          const yy = -r * 0.9 + i * r * 0.6;
          x.beginPath();
          x.moveTo(-r * 0.9, yy + r * 0.3); x.lineTo(-r * 0.9 + r * 0.6, yy);
          x.moveTo(r * 0.9, yy + r * 0.3); x.lineTo(r * 0.9 - r * 0.6, yy);
          x.stroke();
        }
      }
      break;
    }
    case 'personal-roboport':
    case 'personal-roboport-mk2': {
      // 机器人港：带雷达天线的方形基座
      x.fillStyle = col;
      rrPath(x, -r * 0.8, -r * 0.65, r * 1.6, r * 1.3, s * 0.1);
      x.fill();
      x.strokeStyle = dark;
      x.lineWidth = Math.max(1, s * 0.05);
      x.stroke();
      // 天线
      x.strokeStyle = dark;
      x.lineWidth = Math.max(1.2, s * 0.06);
      x.beginPath();
      x.moveTo(0, -r * 0.65); x.lineTo(0, -r * 0.95);
      x.stroke();
      x.fillStyle = '#e0d040';
      x.beginPath();
      x.arc(0, -r * 0.98, r * 0.1, 0, 7);
      x.fill();
      // 中部圆盘（机器人进出港标识）
      x.fillStyle = (id === 'personal-roboport-mk2') ? '#d04a5a' : '#b8c0a0';
      x.beginPath();
      x.arc(0, -r * 0.1, r * 0.32, 0, 7);
      x.fill();
      x.strokeStyle = dark;
      x.lineWidth = Math.max(1, s * 0.04);
      x.stroke();
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

// 判断某物品是否为可燃烧燃料（煤 / 固体燃料）。各烧煤设备以此判断能否加入燃料。
function isBurnerFuel(item) { return item === 'coal' || item === 'solid-fuel' || item === 'raw-fish'; }
function fuelEnergy(item) {
  if (item === 'solid-fuel') return SOLID_FUEL_ENERGY;
  if (item === 'raw-fish') return 4;  // 生鱼可作低效燃料（对齐《异星工厂》：鱼能烧，但能量很低）
  return COAL_ENERGY;
}

function beltSpeed()  {
  return BELT_SPEED * (G.techDone.logistics ? 1.5 : 1) * (G.techDone.logistics2 ? 1.2 : 1) * ((G.dbg && G.dbg.beltMult) || 1);
}
function drillMult()  { return (G.techDone.mining ? 2 : 1) * ((G.dbg && G.dbg.drillMult) || 1); }
function asmMult()    { return (G.techDone.automation ? 1.5 : 1) * (G.techDone.automation2 ? 1.2 : 1) * ((G.dbg && G.dbg.asmMult) || 1); }
function elecMachMult() { return (G.techDone.electric ? 1.2 : 1); }
function oilMult()    { return (G.techDone.oil ? 1.5 : 1); }
function labSpeedMult()  { return (G.techDone['research-speed'] ? 1.5 : 1); }   // 科研速度
function robotSpeedMult() { return (G.techDone['worker-robot-speed'] ? 1.5 : 1); } // 机器人速度
function miningProdMult() { return (G.techDone['mining-productivity'] ? 1.1 : 1); } // 采矿产能 +10%
// 武器伤害无限科技倍率（对齐《异星工厂》Weapon damage）：每级 +10%，作用于玩家武器与炮塔
function weaponDamageMult() {
  const lvl = (G.techProg && G.techProg['weapon-damage']) || 0;
  return 1 + 0.1 * lvl;
}
