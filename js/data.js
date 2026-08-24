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

const FLUIDS = ['water', 'steam', 'crude-oil', 'heavy-oil', 'light-oil', 'petroleum-gas', 'lubricant'];
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

const SCIENCE_PACKS = ['science-pack', 'green-science', 'blue-science', 'military-science'];
function isScience(item) { return SCIENCE_PACKS.indexOf(item) >= 0; }
const FILTER_CHOICES = ['iron-plate', 'copper-plate', 'steel-plate', 'iron-gear', 'copper-cable', 'green-circuit',
  'coal', 'stone', 'plastic-bar', 'science-pack', 'green-science', 'blue-science', 'military-science',
  'magazine', 'piercing-rounds', 'logistic-robot', 'uranium-235', 'uranium-238', 'nuclear-fuel'].concat(FLUIDS);
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
  // ===== 玩家武器与弹药（战斗体系扩充） =====
  'pistol':          { name: '手枪',   color: '#8a8f9a', desc: '基础随身武器。选中后按空格或对敌人点击开火，消耗弹药匣' },
  'submachine-gun':  { name: '冲锋枪', color: '#6a7285', desc: '高射速全自动武器，消耗弹药匣' },
  'shotgun':         { name: '散弹枪', color: '#a07a4a', desc: '近距霰弹，多弹丸高伤害，消耗穿甲弹' },
  'rocket-launcher': { name: '火箭筒', color: '#5a7a4a', desc: '发射火箭弹造成范围爆炸伤害' },
  'grenade':         { name: '手雷',   color: '#4a7a3a', desc: '投掷爆炸物，对范围敌人造成伤害，可在背包直接使用' },
  'rocket':          { name: '火箭弹', color: '#7a5a4a', desc: '火箭筒的弹药，爆炸造成范围伤害' },
  'flamethrower':    { name: '火焰喷射器', color: '#a05a2a', desc: '喷射燃烧的火焰，造成持续灼烧伤害，消耗石油气' },
  // ===== 军事炮塔扩充 =====
  'laser-turret':    { name: '激光炮塔', color: '#d04a5a', desc: '吃电力自动发射激光，无需弹药，射程更远（2×2）' },
  'flamethrower-turret': { name: '火焰炮塔', color: '#d07a2a', desc: '喷射火焰造成持续灼烧伤害，消耗石油气，范围杀伤（2×2）' },
  // ===== 模块系统 =====
  'speed-module':    { name: '速度模块', color: '#4aa0d0', desc: '装入组装机/电炉/炼油厂等，提高生产速度（+40%），增加耗电' },
  'productivity-module': { name: '产能模块', color: '#57b95c', desc: '装入组装机/电炉等，生产时累积额外产出（每 30 个 +1 免费产出），降低速度并增加耗电' },
  'efficiency-module': { name: '效率模块', color: '#8a7ae8', desc: '装入组装机/电炉等，大幅降低生产耗电（每级 -30% 用电，小幅度降速），节能环保' },
  // ===== 火箭发射（终局）=====
  'advanced-circuit':{ name: '高级电路板', color: '#d0608a', desc: '红板，中后期高级电子元件，用于产能模块与电引擎' },
  'engine-unit':     { name: '引擎单元', color: '#8a6a4a', desc: '基础机械动力单元' },
  'electric-engine': { name: '电动引擎', color: '#7a9a6a', desc: '高级动力单元，用于火箭燃料' },
  'processing-unit': { name: '处理器', color: '#5a8ad0', desc: '蓝板，最先进电子元件，用于火箭控制单元' },
  'low-density-structure': { name: '低密度结构', color: '#b0b8c0', desc: '轻质航空结构材料' },
  'rocket-fuel':     { name: '火箭燃料', color: '#d07a2a', desc: '火箭推进剂，用石油气+电引擎制造' },
  'rocket-control-unit': { name: '火箭控制单元', color: '#d04a4a', desc: '火箭的大脑，用处理器+高级电路板制造' },
  'satellite':       { name: '卫星', color: '#c0c8d0', desc: '放入火箭发射井发射，赢得游戏' },
  'rocket-silo':     { name: '火箭发射井', color: '#7a6a5a', desc: '组装并发射火箭的终局建筑（5×5），放入卫星并填充火箭部件后发射' },
  'radar':           { name: '雷达', color: '#5a8a8a', desc: '周期性扫描周围区域，点亮小地图/标记新探索区（3×3，吃电力）' },
  'explosive':       { name: '爆炸物', color: '#d05a2a', desc: '由煤和石油气制造的高能化合物，用于火箭弹' },
  'battery':         { name: '电池', color: '#d0c04a', desc: '储能元件，用于激光炮塔与卫星' },
  // ===== 铁路系统（火车） =====
  'rail':              { name: '铁轨', color: '#6a6a70', desc: '铺设铁轨形成铁路网，火车沿轨道行驶。与相邻铁轨自动连通，可拐弯（1×1）' },
  'locomotive':        { name: '火车头', color: '#d04a3a', desc: '烧煤驱动的机车，在铁轨上行驶。煤装入后自动前进；可挂接货运车厢组成列车' },
  'cargo-wagon':       { name: '货运车厢', color: '#8a6a4a', desc: '货车厢，挂在火车头后沿铁轨随行，最多存放 10 种物品各 100 个。车站可用机械臂装卸' },
  'train-stop':        { name: '车站', color: '#5a8ac0', desc: '火车停靠站：列车行驶到车站所在铁轨即停车，便于机械臂/传送带装卸货物' },
  'rail-signal':       { name: '铁路信号灯', color: '#e04a4a', desc: '放在铁轨旁，指示前方区段是否被列车占用，用于多列火车防追尾（1×1）' },
  // ===== 润滑油 =====
  'lubricant':         { name: '润滑油', color: '#d8c020', mark: 'Lub', desc: '流体，由化工厂用重油加工得到，用于制造电动引擎等高级部件' },
  // ===== 物流机器人网络 =====
  'roboport':          { name: '机器人港', color: '#3a8a8a', desc: '物流机器人的基地与充电站（4×4，吃电力）。把物流机器人放入机器人港后自动调度，机器人往返供应箱与需求箱搬运货物，电量低时回到机器人港充电' },
  'logistic-robot':    { name: '物流机器人', color: '#4aa0d0', desc: '飞行机器人，放入机器人港后自动在供应箱/需求箱之间搬运物资，消耗电量，需回港充电' },
  'logistic-chest-passive': { name: '被动供应箱', color: '#c9a84a', desc: '物流箱：可手动/机械臂存入货物，物流机器人会从箱中取货送往需求箱；也能接收机器人返还的货物' },
  'logistic-chest-active':  { name: '主动供应箱', color: '#d0743a', desc: '物流箱：机器人优先从此取货供应网络；多出的货物机器人会收纳到这里，适合作为原料集散点' },
  'logistic-chest-storage': { name: '仓储箱', color: '#8a9a6a', desc: '物流箱：机器人把返还/多余货物收纳到这里，也可作为备用取货源。所有仓储箱共享存放' },
  'logistic-chest-requester': { name: '需求箱', color: '#5a8ad0', desc: '物流箱：在面板设置每种物品的需求量，物流机器人会自动从供应箱/仓储箱送货过来补足到目标数量' },
  // ===== 核能（对齐《异星工厂》核动力）=====
  'uranium-ore':  { name: '铀矿石', color: '#7fd44a', mark: 'U', desc: '放射性矿物，距出生点较远处生成，须用电采矿机开采，离心机处理成铀' },
  'uranium-235': { name: '铀-235', color: '#9af07a', mark: 'U⁵', desc: '裂变同位素，由离心机处理铀矿小概率获得；是制造核燃料的关键' },
  'uranium-238': { name: '铀-238', color: '#6aa84a', mark: 'U⁸', desc: '丰度同位素，由离心机处理铀矿大量获得，可参与富集循环' },
  'nuclear-fuel': { name: '核燃料', color: '#9ae06a', mark: '☢', desc: '核反应堆的燃料，由铀-235制造，可持续提供巨量高温蒸汽' },
  'centrifuge':   { name: '离心机', color: '#7a8a9a', desc: '把铀矿石分离成铀-235 / 铀-238；也可进行铀富集循环（Kovarex）（2×2，吃电力）' },
  'nuclear-reactor': { name: '核反应堆', color: '#4a8a5a', desc: '消耗核燃料+水产出高温蒸汽（5×5，吃水）。高温蒸汽经汽轮机以远高于蒸汽机的功率发电' },
  'steam-turbine': { name: '汽轮机', color: '#8fb8d0', desc: '消耗高温蒸汽发电，功率远高于蒸汽机（3×3）。接入反应堆/储汽的蒸汽管道即可' }
};

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
  'lubricant':         { time: 2,   inp: { 'heavy-oil': 2 },                                      out: { 'lubricant': 1 } },
  // ===== 铁路系统（火车） =====
  'rail':              { time: 0.5, inp: { 'iron-plate': 1, 'stone': 1 },                          out: { 'rail': 2 } },
  'locomotive':        { time: 4,   inp: { 'iron-plate': 16, 'steel-plate': 6, 'iron-gear': 8, 'green-circuit': 4 }, out: { 'locomotive': 1 } },
  'cargo-wagon':       { time: 3,   inp: { 'iron-plate': 12, 'steel-plate': 6, 'iron-gear': 6 },  out: { 'cargo-wagon': 1 } },
  'train-stop':        { time: 2,   inp: { 'iron-plate': 8, 'green-circuit': 3, 'steel-plate': 2 }, out: { 'train-stop': 1 } },
  'rail-signal':       { time: 1,   inp: { 'iron-plate': 4, 'green-circuit': 1 },                 out: { 'rail-signal': 1 } },
  // ===== 玩家武器（战斗体系扩充） =====
  'pistol':            { time: 1,   inp: { 'iron-plate': 4, 'iron-gear': 1 },                     out: { 'pistol': 1 } },
  'submachine-gun':    { time: 2,   inp: { 'pistol': 1, 'steel-plate': 4, 'iron-gear': 2 },        out: { 'submachine-gun': 1 } },
  'shotgun':           { time: 2,   inp: { 'iron-plate': 6, 'steel-plate': 4 },                    out: { 'shotgun': 1 } },
  'rocket-launcher':   { time: 3,   inp: { 'steel-plate': 8, 'iron-gear': 6, 'advanced-circuit': 2 }, out: { 'rocket-launcher': 1 } },
  'grenade':           { time: 1,   inp: { 'iron-plate': 2, 'coal': 2 },                           out: { 'grenade': 1 } },
  'rocket':            { time: 1,   inp: { 'explosive': 1, 'iron-plate': 2 },                      out: { 'rocket': 1 } },
  'flamethrower':      { time: 2,   inp: { 'steel-plate': 8, 'iron-gear': 4 },                     out: { 'flamethrower': 1 } },
  // ===== 军事炮塔扩充 =====
  'laser-turret':      { time: 4,   inp: { 'steel-plate': 8, 'green-circuit': 10, 'battery': 2 },  out: { 'laser-turret': 1 } },
  'flamethrower-turret': { time: 3, inp: { 'steel-plate': 8, 'iron-gear': 4, 'pipe': 4 },         out: { 'flamethrower-turret': 1 } },
  // ===== 模块系统 =====
  'speed-module':      { time: 2,   inp: { 'green-circuit': 4, 'advanced-circuit': 2 },            out: { 'speed-module': 1 } },
  'productivity-module': { time: 2, inp: { 'advanced-circuit': 2, 'green-circuit': 2, 'iron-gear': 1 }, out: { 'productivity-module': 1 } },
  'efficiency-module': { time: 2,   inp: { 'green-circuit': 3, 'advanced-circuit': 1, 'plastic-bar': 1 }, out: { 'efficiency-module': 1 } },
  // ===== 火箭链路中间件 =====
  'advanced-circuit':  { time: 6,   inp: { 'green-circuit': 2, 'plastic-bar': 2, 'copper-cable': 4 }, out: { 'advanced-circuit': 1 } },
  'engine-unit':       { time: 10,  inp: { 'steel-plate': 1, 'iron-gear': 1, 'pipe': 2 },           out: { 'engine-unit': 1 } },
  'electric-engine':   { time: 10,  inp: { 'engine-unit': 1, 'green-circuit': 2, 'lubricant': 2 }, out: { 'electric-engine': 1 } },
  'processing-unit':   { time: 10,  inp: { 'advanced-circuit': 2, 'green-circuit': 20, 'copper-cable': 4 }, out: { 'processing-unit': 1 } },
  'low-density-structure': { time: 20, inp: { 'copper-plate': 20, 'plastic-bar': 5, 'steel-plate': 2 }, out: { 'low-density-structure': 1 } },
  'rocket-fuel':       { time: 8,   inp: { 'petroleum-gas': 10, 'electric-engine': 1 },             out: { 'rocket-fuel': 1 } },
  'rocket-control-unit': { time: 15, inp: { 'processing-unit': 1, 'advanced-circuit': 3 },          out: { 'rocket-control-unit': 1 } },
  'satellite':         { time: 10,  inp: { 'rocket-control-unit': 1, 'low-density-structure': 100, 'processing-unit': 1, 'solar-panel': 1 }, out: { 'satellite': 1 } },
  'rocket-silo':       { time: 20,  inp: { 'steel-plate': 50, 'engine-unit': 20, 'processing-unit': 20, 'green-circuit': 50 }, out: { 'rocket-silo': 1 } },
  'radar':             { time: 2,   inp: { 'iron-plate': 6, 'steel-plate': 2, 'green-circuit': 2 }, out: { 'radar': 1 } },
  // 爆炸物（火箭弹/手雷专用）
  'explosive':         { time: 2,   inp: { 'coal': 2, 'petroleum-gas': 1 },                        out: { 'explosive': 1 } },
  // 电池（激光炮塔/卫星）
  'battery':           { time: 4,   inp: { 'iron-plate': 2, 'copper-plate': 2, 'coal': 1 },         out: { 'battery': 1 } },
  // ===== 物流机器人网络 =====
  'roboport':          { time: 10,  inp: { 'steel-plate': 20, 'advanced-circuit': 5, 'green-circuit': 10, 'battery': 4 }, out: { 'roboport': 1 } },
  'logistic-robot':    { time: 3,   inp: { 'green-circuit': 4, 'iron-gear': 2, 'battery': 2 },          out: { 'logistic-robot': 1 } },
  'logistic-chest-passive': { time: 1, inp: { 'iron-plate': 4, 'green-circuit': 1 },                    out: { 'logistic-chest-passive': 1 } },
  'logistic-chest-active':  { time: 1.5, inp: { 'iron-plate': 6, 'green-circuit': 2 },                  out: { 'logistic-chest-active': 1 } },
  'logistic-chest-storage': { time: 1.5, inp: { 'iron-plate': 4, 'green-circuit': 2 },                  out: { 'logistic-chest-storage': 1 } },
  'logistic-chest-requester': { time: 1.5, inp: { 'iron-plate': 6, 'green-circuit': 3 },                out: { 'logistic-chest-requester': 1 } },
  // ===== 核能配方 =====
  // 铀富集（Kovarex，离心机）：铀-238 在铀-235 催化下持续富集出更多铀-235（可自持循环）
  'kovarex':           { time: 60, inp: { 'uranium-238': 40, 'uranium-235': 1 },                  out: { 'uranium-235': 1, 'uranium-238': 41 } },
  // 核燃料（组装机）：由铀-235 制成
  'nuclear-fuel':      { time: 5,   inp: { 'uranium-235': 1, 'iron-plate': 1 },                   out: { 'nuclear-fuel': 1 } },
  // 离心机/反应堆/汽轮机（组装机制造）
  'centrifuge':        { time: 2,   inp: { 'iron-plate': 8, 'green-circuit': 4 },                 out: { 'centrifuge': 1 } },
  'nuclear-reactor':   { time: 15,  inp: { 'steel-plate': 40, 'copper-plate': 20, 'battery': 5, 'centrifuge': 1 }, out: { 'nuclear-reactor': 1 } },
  'steam-turbine':     { time: 5,   inp: { 'steel-plate': 20, 'iron-gear': 8, 'copper-plate': 10 }, out: { 'steam-turbine': 1 } }
};

const CHEM_RECIPES = ['plastic-bar', 'crack-light', 'crack-gas', 'lubricant'];
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
  'uranium-processing': { name: '铀矿处理', time: 12, inp: { 'uranium-ore': 10 }, out: { 'uranium-235': 1, 'uranium-238': 9 } }
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
  'laser-turret':       { w: 2, h: 2, solid: true },
  'flamethrower-turret':{ w: 2, h: 2, solid: true },
  'rocket-silo':        { w: 5, h: 5, solid: true },
  'radar':              { w: 3, h: 3, solid: true },
  'stone-wall':         { w: 1, h: 1, solid: true },
  'pumpjack':           { w: 3, h: 3, solid: true },
  'refinery':           { w: 5, h: 5, solid: true },
  'chemical-plant':     { w: 3, h: 3, solid: true },
  'storage-tank':       { w: 3, h: 3, solid: true },
  // ===== 核能建筑 =====
  'centrifuge':         { w: 2, h: 2, solid: true },
  'nuclear-reactor':    { w: 5, h: 5, solid: true },
  'steam-turbine':      { w: 3, h: 3, solid: true },
  'roboport':           { w: 4, h: 4, solid: true },
  'rail':               { w: 1, h: 1, solid: false },
  'locomotive':         { w: 1, h: 1, solid: true },
  'cargo-wagon':        { w: 1, h: 1, solid: true },
  'train-stop':         { w: 1, h: 1, solid: true },
  'rail-signal':        { w: 1, h: 1, solid: true },
  'logistic-chest-passive': { w: 1, h: 1, solid: true },
  'logistic-chest-active':  { w: 1, h: 1, solid: true },
  'logistic-chest-storage': { w: 1, h: 1, solid: true },
  'logistic-chest-requester': { w: 1, h: 1, solid: true }
};

// ===== 科技解锁要求（建造/武器/模块）=====
// 物品 -> 所需已完成科技 id。缺少科技时建造/使用会被拦截并提示。
const TECH_REQ = {
  'laser-turret': 'advanced-combat',
  'flamethrower-turret': 'advanced-combat',
  'rocket-launcher': 'advanced-combat',
  'flamethrower': 'advanced-combat',
  'rocket-silo': 'rocket-science',
  'satellite': 'rocket-science',
  'rocket-control-unit': 'rocket-science',
  'rocket-fuel': 'rocket-science',
  'speed-module': 'modules',
  'productivity-module': 'modules',
  'efficiency-module': 'modules',
  'advanced-circuit': 'electronics',
  'processing-unit': 'electronics',
  'electric-engine': 'electronics',
  'radar': 'radar'
};
// ===== 核能科技门控 =====
for (const id of ['centrifuge', 'nuclear-reactor', 'steam-turbine', 'uranium-235', 'uranium-238', 'nuclear-fuel']) {
  if (!TECH_REQ[id]) TECH_REQ[id] = 'nuclear';
}
// ===== 铁路科技门控 =====
const RAIL_ITEMS = ['rail', 'locomotive', 'cargo-wagon', 'train-stop'];
for (const id of RAIL_ITEMS) if (!TECH_REQ[id]) TECH_REQ[id] = 'railways';
if (!TECH_REQ['rail-signal']) TECH_REQ['rail-signal'] = 'rail-signals';
// ===== 物流机器人网络 =====
const LOGISTIC_ITEMS = ['roboport', 'logistic-robot', 'logistic-chest-passive', 'logistic-chest-active', 'logistic-chest-storage', 'logistic-chest-requester'];
// 物流箱科技门控：所有物流设备需先研究「物流网络」
for (const id of LOGISTIC_ITEMS) if (!TECH_REQ[id]) TECH_REQ[id] = 'logistics-network';
// 玩家武器所需科技（用于选择武器时拦截）
const WEAPON_TECH_REQ = {
  'pistol': 'weapons',
  'submachine-gun': 'weapons',
  'shotgun': 'weapons',
  'rocket-launcher': 'advanced-combat',
  'flamethrower': 'advanced-combat'
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
  oil:        { name: '石油冶金', cost: { 'green-science': 30 }, desc: '炼油厂 / 抽油机速度 ×1.5' },
  railways:    { name: '铁路技术', cost: { 'green-science': 30 }, desc: '解锁铁轨、火车头、货运车厢与车站，构建铁路物流' },
  'rail-signals': { name: '铁路信号', cost: { 'blue-science': 30 }, desc: '解锁铁路信号灯，允许多列火车安全同网行驶' },
  plastic:    { name: '塑料合成', cost: { 'green-science': 20 }, desc: '化工厂生产塑料耗时缩短 ✓（绿色科研的核心支付项）' },
  automation2:{ name: '自动化 II', cost: { 'blue-science': 40 }, desc: '组装机 II 速度额外 ×1.2' },
  express:    { name: '极速物流', cost: { 'military-science': 40 }, desc: '解锁极速传送带/地下带/分流器，物流终极档' },
  military:   { name: '军事工程', cost: { 'military-science': 30 }, desc: '解锁机枪炮塔、石墙、弹药（防御体系）' },
  weapons:    { name: '单兵武器', cost: { 'military-science': 20 }, desc: '解锁手枪、冲锋枪、散弹枪（F 键或空格攻击）' },
  'advanced-combat': { name: '高级战斗', cost: { 'military-science': 40, 'blue-science': 30 }, desc: '解锁激光炮塔、火焰炮塔、火箭筒、火焰喷射器与远程敌人' },
  electronics: { name: '电子学', cost: { 'blue-science': 40 }, desc: '解锁高级电路板、处理器（火箭链路的关键）' },
  'rocket-science': { name: '火箭技术', cost: { 'blue-science': 100, 'military-science': 50 }, desc: '解锁火箭发射井、火箭部件与卫星，发射火箭赢得游戏' },
  modules:    { name: '模块工程', cost: { 'blue-science': 40 }, desc: '解锁速度模块与产能模块（增强组装机/电炉）' },
  radar:      { name: '雷达技术', cost: { 'green-science': 30 }, desc: '解锁雷达，自动扫描并标记新探索区域' },
  'logistics-network': { name: '物流网络', cost: { 'blue-science': 50 }, desc: '解锁机器人港、四类物流箱与物流机器人，构建自动化物流网络' },
  nuclear:    { name: '核能技术', cost: { 'blue-science': 60, 'military-science': 40 }, desc: '解锁离心机（铀矿处理）、核反应堆与汽轮机，构建核能发电体系' },
  deep:       { name: '重工蓝图', cost: { 'blue-science': 50 }, desc: '蓝包终技：科研总进度获取 +20%' },
  infinite:   { name: '无限科技', cost: {}, infinite: true, desc: '无限研究：消耗任意科学包，永不完成' }
};

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
    case 'blue-science': {
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
    case 'petroleum-gas': {
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
