'use strict';

// ===== 物品堆叠上限（对齐《异星工厂》：每种物品有固定最大堆叠数） =====
// 参考原版 stack_size：
//   - 终局/单体物品（火箭、卫星、核反应堆、离心机、装甲、载具、蜘蛛机等）= 1
//   - 原材料（矿石/煤/石头/原油桶等）= 50
//   - 板材/电路/齿轮等中间产物与大部分机器 = 100
//   - 科学包 = 200（对齐原版各色科学包 stack_size=200）
// 未列出的物品使用默认 100。玩家背包/储物箱/载具等存储受此上限约束。
const STACK_SIZES = {
  // 终局单体物品与载具：堆叠 1（rocket=官方 rocket 物品 stack=100，见下方桥接）
  'rocket': 1, 'rocket-part': 100, 'satellite': 1, 'nuclear-reactor': 10, 'rocket-silo': 1, 'cargo-landing-pad': 1, 'cargo-bay': 10, 'landing-pad-unloading-bay': 10,  // nuclear-reactor 官方 10；cargo-landing-pad 官方 stack=1；cargo-bay/landing-pad-unloading-bay 官方 stack=10
  'recycler': 20,  // 回收机官方 stack=20（由 GAME_DATA 桥接）
  'fusion-reactor': 1, 'fusion-generator': 5, 'fusion-power-cell': 50,  // Aquilo 聚变发电链官方 stack（fusion-reactor=1、fusion-generator=5、fusion-power-cell=50，由 GAME_DATA 桥接）
  'crusher': 10,  // 破碎机官方 stack=10（由 GAME_DATA 桥接）
  'metallic-asteroid-chunk': 1, 'carbonic-asteroid-chunk': 1, 'oxide-asteroid-chunk': 1, 'promethium-asteroid-chunk': 1,  // 小行星碎块官方 stack=1
  'ice': 50,  // 冰官方 stack=50
  'car': 1, 'tank': 1, 'spidertron': 1,
  'locomotive': 5, 'cargo-wagon': 5, 'fluid-wagon': 5, 'artillery-wagon': 5,  // 车厢/车头官方 5
  'light-armor': 1, 'heavy-armor': 1, 'modular-armor': 1, 'power-armor': 1, 'power-armor-mk2': 1,
  'fusion-reactor-equipment': 20, 'spidertron-remote': 1,  // 便携聚变堆官方 20
  // 弹药：官方 stack（cannon-shell=100、atomic-bomb=10、artillery-shell=1）
  'cannon-shell': 100, 'explosive-cannon-shell': 100, 'uranium-cannon-shell': 100, 'artillery-shell': 1, 'atomic-bomb': 10,
  // 原材料：堆叠 50
  'iron-ore': 50, 'copper-ore': 50, 'coal': 50, 'stone': 50, 'uranium-ore': 50,
  'wood': 100, 'raw-fish': 100, 'stone-brick': 100, 'calcite': 50,
  'sulfur': 50, 'carbon': 50, 'uranium-235': 50, 'uranium-238': 50, 'nuclear-fuel': 1, 'uranium-fuel-cell': 1,
  'depleted-uranium-fuel-cell': 50,
  // 固体燃料/火箭燃料/低密度结构：对齐原版 stack_size（固体燃料 50、火箭燃料 10、低密度结构 10）
  'solid-fuel': 50, 'rocket-fuel': 10, 'low-density-structure': 10,
  // 流体桶（对齐原版 1 桶 = 1 堆叠）
  'barrel': 10, 'water-barrel': 10, 'crude-oil-barrel': 10,
  'heavy-oil-barrel': 10, 'light-oil-barrel': 10, 'petroleum-gas-barrel': 10,
  'lubricant-barrel': 10, 'sulfuric-acid-barrel': 10,
  // 科学包：堆叠 200（对齐原版）
  'automation-science-pack': 200, 'logistic-science-pack': 200, 'chemical-science-pack': 200,
  'military-science-pack': 200, 'production-science-pack': 200, 'utility-science-pack': 200,
  'space-science-pack': 200, 'promethium-science-pack': 200,  // 普罗米修斯科研包官方 stack=200
  // 基础建材与管线：堆叠 100
  'concrete': 100, 'refined-concrete': 100, 'hazard-concrete': 100, 'refined-hazard-concrete': 100, 'stone-path': 100, 'landfill': 100,
  // 品质模块（对齐《异星工厂》Quality DLC：quality-module 官方 stack=50）
  'quality-module': 50, 'quality-module-2': 50, 'quality-module-3': 50,
  // 雅玛果土壤（太空时代 Gleba，官方 stack=100）
  'artificial-yumako-soil': 100, 'overgrowth-yumako-soil': 100
};
// 返回某物品的最大堆叠数（未特别指定则默认 100，对齐原版多数物品）
function stackSize(id) {
  const v = STACK_SIZES[id];
  return (typeof v === 'number' && v > 0) ? v : 100;
}

const ITEMS = {
  'iron-ore':   { name: '铁矿石', color: '#6b8fd4', mark: 'Fe', desc: '基础矿物，放入石炉冶炼成铁板' },
  'copper-ore': { name: '铜矿石', color: '#d0793f', mark: 'Cu', desc: '基础矿物，放入石炉冶炼成铜板' },
  'coal':       { name: '煤',     color: '#3a3a42', mark: 'C',  desc: '燃料，供采矿机与石炉燃烧' },
  'solid-fuel': { name: '固体燃料', color: '#d08a3a', mark: 'SF', desc: '由石油气/轻油/重油在化工厂压制的致密燃料，能量约为煤的 4 倍，可作煤的高效替代品' },
  'stone':      { name: '石头',   color: '#d0b78a', mark: 'St', desc: '合成石炉的材料，可在熔炉烧成石砖' },
  'stone-brick': { name: '石砖',   color: '#b3a685', mark: 'Sb', desc: '由石头在熔炉烧制，可在组装机合成石墙' },
  'calcite':    { name: '方解石', color: '#e8e0d0', mark: 'Ca', desc: '矿物，用于炼油厂煤液化配方（太空时代）' },
  'iron-plate':   { name: '铁板',   color: '#ccd4de', mark: 'Fp', desc: '最常用的结构材料' },
  'copper-plate': { name: '铜板',   color: '#e0975f', mark: 'Cp', desc: '用于拉制铜线' },
  'iron-gear-wheel':    { name: '齿轮',   color: '#aab5c2', mark: 'G',  desc: '机械核心零件（对齐《异星工厂》Iron gear wheel）' },
  'iron-stick':   { name: '铁杆',   color: '#b8c0c8', mark: 'Is', desc: '细铁杆，用于分流器、地下带、铁轨与部分配方（对齐《异星工厂》）' },
  'copper-cable': { name: '铜线',   color: '#e8a06a', mark: 'W',  desc: '制造电路板的原料' },
  'electronic-circuit':{ name: '电路板', color: '#57b95c', mark: 'GC', desc: '自动化与科研的基础元件' },
  'automation-science-pack': { name: '自动化科学包', color: '#d04848', mark: 'SP', desc: '红色科学包，初期的科研消耗品（自动化科学）' },
  'transport-belt':    { name: '基础传送带', color: '#e0b23c', desc: '运输物品，R 旋转方向，可拖动铺设' },
  'inserter':          { name: '电力机械臂', color: '#e0b23c', desc: '严格单向：臂体侧取货、箭头侧放货（亮色箭头=物流方向），需电力驱动' },
  'burner-inserter':   { name: '热能机械臂', color: '#7a7f87', desc: '烧煤驱动的机械臂，无需电力，开局即可用；需不断补充煤作燃料（对齐《异星工厂》Burner inserter）' },
  'long-handed-inserter':     { name: '加长机械臂', color: '#e05a4e', desc: '同电力机械臂，但取放都延伸到第二格' },
  'burner-mining-drill':      { name: '热能采矿机', color: '#c46a3a', desc: '放在矿上自动开采，产出朝向前方，需煤' },
  'stone-furnace':     { name: '石炉',   color: '#9c9486', desc: '把矿石冶炼成板材，需煤作燃料' },
  'assembling-machine-1':{ name: '组装机', color: '#6f86c9', desc: '设置配方后自动生产（3×3）' },
  'lab':               { name: '研究中心', color: '#4aa8a0', desc: '消耗科学包推进所选科技（3×3）' },
  'biolab':            { name: '生物实验室', color: '#4aa8a0', desc: '太空时代生物实验室（5×5，吃电力）：比普通研究中心快 2 倍、模块槽更多，可研究全部太空时代科技（对齐《异星工厂》Space Age 生物实验室，数据来自 GAME_DATA）' },
  'small-lamp':              { name: '电灯', color: '#e8e4a0', desc: '耗电照明设备（1×1）：通电后在夜间照亮周围区域，让基地在黑暗中清晰可见。夜晚无电时熄灭' },
  'substation':        { name: '变电站', color: '#b0802a', desc: '超大型电线杆（4×4）：连接电力与电路网络，覆盖范围远大于普通电线杆（连接距离约 18 格），用于跨区域组网（对齐《异星工厂》Substation）' },
  'programmable-speaker': { name: '可编程音箱', color: '#a05ad0', desc: '电路网络设备（1×1）：读取所连网络的信号，可在面板设置告警条件与输出信号，满足条件时发光提示，用于信号监控与告警（对齐《异星工厂》Programmable speaker）' },
  'splitter':          { name: '基础分流器', color: '#e0b23c', desc: '两入两出：物品轮流流向两个出口（A/B 车道各自保持不混合）；一边堵了自动走另一边。面板可设输入/输出优先级，并自带筛选功能（指定只放行某物品）' },
  'underground-belt':       { name: '基础地下传送带', color: '#e0b23c', desc: '同向摆两座（最远6格）自动配对：入口收货钻入地下，出口送回地面向前输出' },
  'steel-plate':       { name: '钢板',   color: '#c9ced6', mark: 'S', desc: '电炉炼铁板产出的高级建材' },
  'boiler':            { name: '锅炉',   color: '#d0743a', desc: '烧煤+水产出蒸汽（3×2）：左右两端各一只蓝口水口，双向进出、水位互通平衡，可从一端进水另一端出、多台同排串联；底边中间白口=出汽口，向下接蒸汽机或蒸汽管道' },
  'steam-engine':      { name: '蒸汽机', color: '#8fb8d0', desc: '蒸汽发电（3×5）：上下两端各一只功能相同的通用汽口，蒸汽可从任意一端进入，多余蒸汽也可从另一端送出，支持首尾串联；供汽越足功率越高，满功率并入全图电网' },
  'offshore-pump':     { name: '抽水机', color: '#3f9fc0', mark: 'P', desc: '必须放在水面上，免电力无限抽水；产出朝箭头方向，指向锅炉左端/右端的蓝口水口可直接供水，或接管道（2×1）' },
  'water':             { name: '水',     color: '#4a90d9', mark: 'H₂O', desc: '流体，由抽水机从水域抽取，经管道或锅炉两端水口送入锅炉烧成蒸汽' },
  'steam':             { name: '蒸汽',   color: '#c8d4dc', mark: '汽', desc: '流体，锅炉烧水所得；经锅炉出汽口或蒸汽管道送往蒸汽机发电' },
  'electric-mining-drill':    { name: '电采矿机', color: '#4f7dd3', desc: '免燃料、吃电力开采，速度快于热能采矿机（3×3）' },
  'big-mining-drill':         { name: '大型采矿机', color: '#4f7dd3', desc: '一款更大更猛的采矿机，具备更广的采矿范围，并可开采更坚硬的矿石（5×5，mining_speed 2.5，官方 Space Age Big mining drill）' },
  'electric-furnace':  { name: '电炉',   color: '#3fa87e', desc: '免燃料、吃电力冶炼，速度更高，可出钢板（3×3）' },
  'assembling-machine-2': { name: '组装机 II', color: '#a05fd0', desc: '吃电力、速度更高的高级组装机（3×3）' },
  'fast-transport-belt': { name: '高速传送带', color: '#e05a4e', desc: '速度约为基础带的 2 倍（对齐《异星工厂》）' },
  'fast-underground-belt': { name: '高速地下传送带', color: '#e05a4e', desc: '同向配对距离最远 14 格，速度是高速带标准' },
  'express-transport-belt': { name: '极速传送带', color: '#4f9fe8', desc: '速度约为基础带的 3 倍，物流终极档（对齐《异星工厂》）' },
  'express-underground-belt': { name: '极速地下传送带', color: '#4f9fe8', desc: '同向配对距离最远 20 格，速度是极速带标准' },
  'express-splitter': { name: '极速分流器', color: '#4f9fe8', desc: '同分流器，但吞吐与极速带一致，可输送最快物流' },
  'turbo-transport-belt': { name: '超速传送带', color: '#5a7a5a', desc: '速度约为基础带的 4 倍，物流终极档（太空时代 Space Age 4 档带，对齐《异星工厂》Turbo transport belt，速度 7.5 格/s）' },
  'turbo-underground-belt': { name: '超速地下传送带', color: '#5a7a5a', desc: '同向配对距离最远 11 格，速度是超速带标准（太空时代 Space Age，对齐《异星工厂》Turbo underground belt）' },
  'turbo-splitter': { name: '超速分流器', color: '#5a7a5a', desc: '同分流器，但吞吐与超速带一致，可输送最快物流（太空时代 Space Age，对齐《异星工厂》Turbo splitter）' },
  'fast-splitter':    { name: '高速分流器', color: '#e05a4e', desc: '同分流器，但吞吐与高速带一致，可输送更快的物流（对齐《异星工厂》Fast splitter）' },
  'bulk-inserter':    { name: '集装箱机械臂', color: '#7ec850', desc: '同电力机械臂，但可一次性抓取多达 3 个同种物品（对齐《异星工厂》Stack inserter）' },
  'fast-inserter':     { name: '高速机械臂', color: '#4f9fe8', desc: '比普通机械臂抓取更快（旋转速度约为其 2 倍）（对齐《异星工厂》Fast inserter）' },
  'steel-chest':       { name: '钢箱', color: '#9aa4b0', desc: '比储物箱容量更大的钢铁储物箱（24 格）。可接入电路网络输出箱内物品数量信号（对齐《异星工厂》）' },
  'creative-chest':    { name: '创造箱', color: '#3e8f4a', mark: '∞', desc: '测试设备：无限生成选定物品，点开面板选择要生成的物品，机械臂可无限取走' },
  'void-chest':        { name: '虚空箱', color: '#4a3430', mark: '×', desc: '测试设备：无限销毁任何存入的物品，放进去即刻消失' },
  'logistic-science-pack':     { name: '物流科学包', color: '#6fd06f', mark: 'GS', desc: '绿色科学包，解锁二级科技（物流/石油等的钥匙）' },
  'chemical-science-pack':      { name: '化工科学包', color: '#4f9fe8', mark: 'BS', desc: '蓝色科学包，依赖石油与塑料的高级科研包' },
  'crude-oil':         { name: '原油', color: '#2a2418', mark: 'Oil', desc: '流体，用抽油机开采，经管道输送' },
  'heavy-oil':         { name: '重油', color: '#5a3a1e', mark: 'HO', desc: '炼油副产物，常作为润滑油等原料' },
  'light-oil':         { name: '轻油', color: '#8a5a22', mark: 'LO', desc: '炼油副产物，可继续加工成石油气' },
  'petroleum-gas':     { name: '石油气', color: '#c9a84a', mark: 'PG', desc: '炼油关键产物，制造塑料的原料' },
  'plastic-bar':       { name: '塑料板', color: '#cfe8a8', mark: 'Pl', desc: '石油化工产物，须在化工厂用石油气+煤生产，用于高级配方' },
  'pipe':              { name: '管道', color: '#6a5f52', desc: '输送流体（水/蒸汽/原油/重轻油/石油气），相邻互连，容量 40' },
  'pipe-to-ground':    { name: '地下管道', color: '#8a7a6a', desc: '同向摆两座（最远 10 格）自动配对，从地下穿行流体，可跨过传送带/管道' },
  'pump':              { name: '流体泵', color: '#5aa0a8', desc: '从背侧吸入流体、向前侧加压泵出，单向输送、提速吞吐（1×1）' },
  'storage-tank':      { name: '储液罐', color: '#7d95a8', desc: '大容量存储任意一种液体/气体（3×3，容量 ' + STORAGE_TANK_CAP + '）。只有一对对角（北西↔南东）的 4 个面可接管道，另一对对角为空不可接；罐内只能容纳单一流体。相邻管道会自动把流体灌入罐内，罐也会从该对角接口向相邻炼油厂/化工厂等输入口供料，作为缓冲库容使用' },
  'creative-pipe':     { name: '创造管道', color: '#3e8f4a', mark: '∞', desc: '测试设备：无限生成选定的流体，点开面板选择要生成的流体，源源不断灌入相邻管道/储液罐' },
  'void-pipe':         { name: '虚空管道', color: '#6a3a3a', mark: '×', desc: '测试设备：无限销毁流经的流体，相邻管道会把流体持续排入这里销毁' },
  'creative-belt':     { name: '创造传送带', color: '#3e8f4a', mark: '∞', desc: '测试设备：点开面板选择要生成的物品，带上无限产出该物品并随带流动，机械臂/玩家可无限取走（传送带）' },
  'void-belt':         { name: '虚空传送带', color: '#4a3430', mark: '×', desc: '测试设备：任何流转到这条带上的物品都会被即刻销毁，无法取出，作为物流销毁汇点（传送带）' },
  'pumpjack':          { name: '抽油机', color: '#3a6a66', desc: '吃电力开采原油矿床，产出原油（3×3）' },
  'solar-panel':       { name: '太阳能板', color: '#3f6fc0', desc: '白天无燃料发电（2×2），并入全图电网' },
  'accumulator':       { name: '蓄电器', color: '#c9a84a', desc: '储存电力，白天充电、夜间放电（2×2），平滑电网波动' },
  'steel-furnace':     { name: '钢铁炉', color: '#8b95a3', desc: '烧煤冶炼，速度高于石炉（2×2）' },
  'assembling-machine-3': { name: '组装机 III', color: '#7a58c8', desc: '吃电力、速度最高的组装机（3×3）' },
  'military-science-pack':  { name: '军事科学包', color: '#b0b0b0', mark: 'MS', desc: '灰色科学包，解锁军事科技（炮塔/墙壁/弹药等）' },
  'gun-turret':        { name: '机枪炮塔', color: '#5a5a66', desc: '自动攻击进入射程的敌人，需装入弹药（2×2）' },
  'stone-wall':        { name: '石墙', color: '#8d8578', desc: '防御障碍，阻挡敌人与玩家通行（1×1）' },
  'gate':              { name: '门', color: '#7a7468', desc: '可开合的入口：玩家靠近自动打开、离开自动关闭，敌人无法通过（1×1），与石墙搭配构建防线' },
  'firearm-magazine':          { name: '弹药匣', color: '#b08a4a', desc: '机枪炮塔的标准弹药' },
  'piercing-rounds-magazine':   { name: '穿甲弹', color: '#b05a4a', desc: '比普通弹药威力更高的穿甲弹药' },
  'oil-refinery':          { name: '炼油厂', color: '#b06a3e', desc: '把原油炼成重油/轻油/石油气，或煤液化（5×5，吃电力，需选配方）。背面2输入、正面3输出' },
  'chemical-plant':    { name: '化工厂', color: '#7d9464', desc: '流体化学加工厂：石油气+煤→塑料，重油/轻油裂解（3×3，吃电力）。底部2输入、顶部2输出，成对固定；固体原料机械臂任意方向放入' },
  // ===== 玩家武器与弹药（战斗体系扩充） =====
  'pistol':          { name: '手枪',   color: '#8a8f9a', desc: '基础随身武器。选中后按空格或对敌人点击开火，消耗弹药匣' },
  'submachine-gun':  { name: '冲锋枪', color: '#6a7285', desc: '高射速全自动武器，消耗弹药匣；自动优先消耗更高级弹药（穿甲弹 / 铀弹）以提升伤害（对齐《异星工厂》SMG 弹药升级）' },
  'shotgun':         { name: '散弹枪', color: '#a07a4a', desc: '近距霰弹，多弹丸高伤害，消耗散弹枪弹' },
  'combat-shotgun':  { name: '战斗散弹枪', color: '#a05a3a', desc: '进阶散弹枪：射速更快、伤害更高，消耗穿甲散弹枪弹（对齐《异星工厂》Combat shotgun）' },
  'shotgun-shell':   { name: '散弹枪弹', color: '#c07a4a', desc: '散弹枪的专用弹药，一次性发射多枚弹丸（对齐《异星工厂》Shotgun shell）' },
  'piercing-shotgun-shell': { name: '穿甲散弹枪弹', color: '#d05a3a', desc: '穿甲散弹枪弹：每枚弹丸伤害更高，供散弹枪与战斗散弹枪使用（对齐《异星工厂》Piercing shotgun shell）' },
  'cluster-grenade': { name: '集束手雷', color: '#3a7a2a', desc: '威力更强、爆炸范围更大的升级手雷，对成片敌人造成重创（对齐《异星工厂》Cluster grenade）' },
  'rocket-launcher': { name: '火箭筒', color: '#5a7a4a', desc: '发射火箭弹造成范围爆炸伤害' },
  'grenade':         { name: '手雷',   color: '#4a7a3a', desc: '投掷爆炸物，对范围敌人造成伤害，可在背包直接使用' },
  'rocket':      { name: '火箭弹', color: '#7a5a4a', desc: '火箭筒的弹药，爆炸造成范围伤害' },
  'explosive-rocket':{ name: '爆炸火箭弹', color: '#c05a2a', desc: '装填高能爆炸物的重型火箭弹，命中后爆炸范围与伤害远超普通火箭弹，供爆炸火箭筒使用（对齐《异星工厂》Explosive rocket）' },
  'flamethrower':    { name: '火焰喷射器', color: '#a05a2a', desc: '喷射燃烧的火焰，造成持续灼烧伤害，消耗火焰弹药（由化工厂用轻油/重油制造）' },
  'flamethrower-ammo': { name: '火焰弹药', color: '#d06a2a', desc: '火焰喷射器的专用燃料，由化工厂用轻油+重油制成，能量密度高（对齐《异星工厂》Flamethrower ammo）' },
  'uranium-rounds-magazine':  { name: '铀弹', color: '#9af07a', desc: '铀-238 制成的穿甲弹药，威力远超穿甲弹，供冲锋枪与机枪炮塔使用（对齐《异星工厂》Uranium rounds）' },
  'atomic-bomb': { name: '原子弹', color: '#a8e0c0', mark: '☢', desc: '终极核武器：由铀-235 制成，火箭筒发射，落地引发超大范围核爆，对成片敌人造成毁灭性打击（对齐《异星工厂》Atomic bomb）' },

  'uranium-cannon-shell': { name: '铀炮弹', color: '#9af07a', desc: '铀-238 制成的重型炮弹，威力远超普通炮弹，供坦克主炮使用（对齐《异星工厂》Uranium cannon shell）' },
  'poison-capsule':  { name: '毒胶囊', color: '#7ad04a', desc: '投掷后落地释放剧毒云雾，对范围内的敌人持续造成伤害（对齐《异星工厂》Poison capsule）' },
  'slowdown-capsule':{ name: '减速胶囊', color: '#4a9ad0', desc: '投掷后落地形成减速力场，大幅降低范围内敌人的移动速度（对齐《异星工厂》Slowdown capsule）' },
  // ===== 军事炮塔扩充 =====
  'laser-turret':    { name: '激光炮塔', color: '#d04a5a', desc: '吃电力自动发射激光，无需弹药，射程更远（2×2）' },
  'flamethrower-turret': { name: '火焰炮塔', color: '#d07a2a', desc: '喷射火焰造成持续灼烧伤害，消耗轻油，范围杀伤（2×2）。对齐《异星工厂》Flamethrower turret：以轻油为燃料' },
  // ===== 模块系统（速度/产能/效率各 1-3 级，对齐《异星工厂》Module tiers） =====
  'speed-module':    { name: '速度模块', color: '#4aa0d0', desc: '装入组装机/电炉/炼油厂等，提高生产速度（+40%），增加耗电与污染排放（对齐《异星工厂》速度模块副作用）' },
  'speed-module-2':  { name: '速度模块 II', color: '#3a80b0', desc: '二级速度模块：提高生产速度（+80%），增加耗电与污染排放。需模块工程 II' },
  'speed-module-3':  { name: '速度模块 III', color: '#2a60a0', desc: '三级速度模块：大幅提高生产速度（+120%），增加耗电与污染排放。需模块工程 III' },
  'productivity-module': { name: '产能模块', color: '#57b95c', desc: '装入组装机/电炉等，生产时累积额外产出（每 30 个 +1 免费产出），降低速度并增加耗电与污染排放' },
  'productivity-module-2': { name: '产能模块 II', color: '#3a9a4a', desc: '二级产能模块：累积额外产出效率更高（每 20 个 +1 免费产出），降低速度并增加耗电与污染排放。需模块工程 II' },
  'productivity-module-3': { name: '产能模块 III', color: '#2a8a3a', desc: '三级产能模块：累积额外产出效率最高（每 15 个 +1 免费产出），降低速度并增加耗电与污染排放。需模块工程 III' },
  'beacon':        { name: '信号塔', color: '#5a7a9a', desc: '模块中继塔（3×3，吃电力）：内装 2 个模块，向 9×9 范围内的生产建筑广播模块加成，效果约为信号塔内模块的 ' + '50%' + '。一座信号塔可服务多台生产设备' },
  'efficiency-module': { name: '效率模块', color: '#8a7ae8', desc: '装入组装机/电炉等，大幅降低生产耗电（每级 -30% 用电）并减少污染排放（每级约 -30% 污染，对齐《异星工厂》效率模块环保），小幅度降速' },
  'efficiency-module-2': { name: '效率模块 II', color: '#6a5ac8', desc: '二级效率模块：更强降低生产耗电（-45% 用电）并大幅减少污染排放（约 -45% 污染）。需模块工程 II' },
  'efficiency-module-3': { name: '效率模块 III', color: '#4a3aa8', desc: '三级效率模块：极强降低生产耗电（-60% 用电）并极大幅减少污染排放（约 -60% 污染）。需模块工程 III' },
  'quality-module':    { name: '品质模块', color: '#d0a040', mark: 'Q', desc: '装入组装机/电炉/炼油厂等，生产时有概率产出更高品质的物品（对齐《异星工厂》Quality DLC：品质+1%，速度-5%）' },
  'quality-module-2':  { name: '品质模块 II', color: '#c08020', mark: 'Q2', desc: '二级品质模块：更高概率产出高品质物品（品质+2%，速度-5%）。需品质学 II' },
  'quality-module-3':  { name: '品质模块 III', color: '#b06010', mark: 'Q3', desc: '三级品质模块：极高概率产出高品质物品（品质+2.5%，速度-5%）。需品质学 III' },
  // ===== 火箭发射（终局）=====
  'advanced-circuit':{ name: '高级电路板', color: '#d0608a', desc: '红板，中后期高级电子元件，用于产能模块与电引擎' },
  'engine-unit':     { name: '引擎单元', color: '#8a6a4a', desc: '基础机械动力单元' },
  'electric-engine-unit': { name: '电动引擎', color: '#7a9a6a', desc: '高级动力单元，用于火箭燃料' },
  'processing-unit': { name: '处理器', color: '#5a8ad0', desc: '蓝板，最先进电子元件，用于火箭控制单元' },
  'low-density-structure': { name: '低密度结构', color: '#b0b8c0', desc: '轻质航空结构材料' },
  'rocket-fuel':     { name: '火箭燃料', color: '#d07a2a', desc: '火箭推进剂，用石油气+电引擎制造；同时也是能量最高的可燃烧燃料（约为固体燃料 10 倍、煤 40 倍），可投入锅炉/熔炉/采矿机/火车/载具使用（对齐《异星工厂》Rocket fuel）' },
  'rocket-part':     { name: '火箭部件', color: '#a8b0c0', mark: '◈', desc: '火箭发射井逐件组装的中间部件（对齐《异星工厂》Rocket part），集齐后拼装出完整火箭；装产能模块可免费累积额外部件' },
  'rocket-body':     { name: '火箭', color: '#c0c8d0', mark: '🚀', desc: '由火箭发射井集齐火箭部件组装而成的完整火箭本体，放入卫星后可发射' },
  'satellite':       { name: '卫星', color: '#c0c8d0', desc: '放入火箭发射井发射，赢得游戏' },
  'rocket-silo':     { name: '火箭发射井', color: '#7a6a5a', desc: '组装并发射火箭的终局建筑（9×9，占地来自 GAME_DATA.footprint 官方 selection_box ±4.5），放入卫星并填充火箭部件后发射。可接入电路网络输出井内火箭/卫星/部件就绪状态信号（对齐《异星工厂》火箭发射井电路信号）' },
  'cargo-landing-pad':{ name: '物流接驳站', color: '#6a5a8a', desc: '火箭货物接驳建筑（8×8）：火箭发射后，被发射物品的产物降落在此，内置 80 格大容量存储与雷达视野（对齐《异星工厂》Cargo landing pad，数据来自 GAME_DATA）' },
  'cargo-bay':       { name: '物流扩展舱', color: '#7a6a9a', desc: '物流接驳站的扩展存储舱（4×4）：紧邻接驳站铺设，为接驳站增加 20 格额外存储槽位（官方 Cargo bay，inventory_size_bonus=20，数据来自 GAME_DATA）' },
  'landing-pad-unloading-bay': { name: '物流卸载舱', color: '#8a5a7a', desc: '物流接驳站的卸载舱（4×5）：官方 Cargo unloading bay，允许从太空平台向接驳站卸载货物，紧邻接驳站铺设亦为其增加 20 格额外存储槽位（inventory_size_bonus=20，卸载距离 59 格，数据来自 GAME_DATA）' },
  'radar':           { name: '雷达', color: '#5a8a8a', desc: '周期性扫描周围区域，点亮小地图/标记新探索区（3×3，吃电力）' },
  'explosives':       { name: '爆炸物', color: '#d05a2a', desc: '由煤和石油气制造的高能化合物，用于火箭弹' },
  'cliff-explosives': { name: '峭壁炸药', color: '#8a7a5a', desc: '选中后点击峭壁即可将其炸毁清除，开辟地形通途（对齐《异星工厂》Cliff explosives）' },
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
  'car':               { name: '装甲车', color: '#8a6a3a', desc: '可驾驶的载具：靠近后按 E 进入驾驶（WASD 更快移动），消耗煤作燃料，E 下车。驾驶时按空格可发射车载机枪（消耗背包弹药），实现边驾驶边战斗（对齐《异星工厂》Car）。自带 ' + VEHICLE_GRIDS.car + '×' + VEHICLE_GRIDS.car + ' 载具装备网格与储物箱，可安装外骨骼等装备件' },
  'tank':              { name: '坦克', color: '#4a6a3a', desc: '重型战斗载具：装甲更厚、速度较慢，可发射炮弹造成范围伤害。需军事科技 III。自带 ' + VEHICLE_GRIDS.tank + '×' + VEHICLE_GRIDS.tank + ' 载具装备网格与储物箱' },
  'cannon-shell':      { name: '炮弹', color: '#8a5a2a', desc: '坦克主炮的弹药，命中后造成范围爆炸伤害' },
  'explosive-cannon-shell': { name: '爆炸炮弹', color: '#d05a2a', desc: '装填高能爆炸物的重型炮弹：命中后造成更大范围、更高伤害的爆炸，供坦克主炮使用（对齐《异星工厂》Explosive cannon shell）' },
  'explosive-uranium-cannon-shell': { name: '铀爆炸炮弹', color: '#9ae07a', desc: '铀-238 制成的终极重型炮弹：兼具铀的穿透杀伤与爆炸的范围杀伤，是坦克最强弹药（对齐《异星工厂》Explosive uranium cannon shell）' },
  // ===== 护甲（对齐《异星工厂》Armor）=====
  'light-armor':       { name: '轻型护甲', color: '#8a8a72', desc: '基础护甲：减少 20% 所受伤害。穿在身上防御敌人' },
  'heavy-armor':       { name: '重型护甲', color: '#6a6a5a', desc: '高级护甲：减少 45% 所受伤害。需军事科技 III' },
  // ===== 终局载具与防御（对齐《异星工厂》Spidertron / Artillery / Landmine）=====
  'spidertron':        { name: '蜘蛛机器人', color: '#7a6ad0', desc: '终极战斗载具：六足步行机，速度快、可发射导弹并配备车载自动炮塔，无视地形（跨越水/墙）（3×3）。需军事科技 IV' },
  'spidertron-remote': { name: '蜘蛛遥控器', color: '#a08ae0', mark: '⌖', desc: '远程遥控蜘蛛机器人的手持设备：选中后点击地图任意位置，命令蜘蛛机器人自主移动到目标点并沿途自动开火（对齐《异星工厂》Spidertron remote）' },
  'land-mine':         { name: '地雷', color: '#8a7a5a', desc: '铺设在地面，敌人踏入时爆炸造成范围伤害。一次性消耗（1×1）' },
  'artillery-turret':  { name: '炮兵连', color: '#7a5a4a', desc: '超远程炮台：消耗炮弹轰击超远距离的敌人，是晚期基地防御的利器（4×4）' },
  'artillery-shell':   { name: '炮弹（炮兵）', color: '#8a5a3a', desc: '炮兵连的弹药，命中后造成超大范围爆炸伤害' },
  // ===== 铁路系统（火车） =====
  'rail':              { name: '铁轨', color: '#6a6a70', desc: '铺设铁轨形成铁路网，火车沿轨道行驶。与相邻铁轨自动连通，可拐弯（1×1）' },
  'locomotive':        { name: '火车头', color: '#d04a3a', desc: '烧煤驱动的机车，在铁轨上行驶。煤装入后自动前进；可挂接货运车厢组成列车' },
  'cargo-wagon':       { name: '货运车厢', color: '#8a6a4a', desc: '货车厢，挂在火车头后沿铁轨随行，最多存放 10 种物品各 100 个（研究「铁路产能」可提升槽位）。车站可用机械臂装卸' },
  'fluid-wagon':       { name: '流体车厢', color: '#4a90c0', desc: '罐车车厢，挂在车头后沿铁轨随行，可运输任意一种流体（容量 ' + FLUID_WAGON_CAP + '）。车站可用泵从侧边装卸流体' },
  'artillery-wagon':   { name: '炮兵车厢', color: '#8a5a3a', desc: '挂载于列车的远程炮兵：列车行驶/停靠期间自动轰击射程内远处敌人，命中造成大范围爆炸，内装炮兵炮弹（对齐《异星工厂》Artillery wagon）' },
  'train-stop':        { name: '车站', color: '#5a8ac0', desc: '火车停靠站：列车行驶到车站所在铁轨即停车，便于机械臂/传送带装卸货物' },
  'rail-signal':       { name: '铁路信号灯', color: '#e04a4a', desc: '放在铁轨旁，指示前方区段是否被列车占用，用于多列火车防追尾（1×1）' },
  'rail-chain-signal': { name: '铁路链式信号灯', color: '#e0a04a', desc: '放在铁轨旁，连锁转发前方信号灯状态：只有当前方区段整段畅通时才放行，防止列车在复杂交叉口内停车堵塞（1×1，对齐《异星工厂》Rail chain signal）' },
  // ===== 高架铁轨（Elevated Rails DLC，数据来自 factorio-data 官方）=====
  'rail-support': { name: '高架桥墩', color: '#8a8a90', desc: '高架铁轨的支撑桥墩，铺设在陆地/水面（1×1，吃电力无）。在高架桥墩上可铺设高架铁轨，让列车跨越水域与障碍（对齐《异星工厂》Elevated Rails：Rail support，堆叠 20）' },
  'rail-ramp': { name: '高架铁轨', color: '#6a6a78', mark: '⤴', desc: '高架铁轨规划器：在高架桥墩上铺设，让列车在高架层行驶，可跨越水域、建筑物等地面障碍。由精炼混凝土+铁轨+钢板制成（对齐《异星工厂》Elevated Rails：Rail ramp，堆叠 10）' },
  // ===== 润滑油 =====
  'lubricant':         { name: '润滑油', color: '#d8c020', mark: 'Lub', desc: '流体，由化工厂用重油加工得到，用于制造电动引擎等高级部件' },
  // ===== 硫磺/硫酸（对齐《异星工厂》Sulfur & Sulfuric acid 化工链）=====
  'sulfur':            { name: '硫磺', color: '#d8d020', mark: 'S', desc: '黄色粉末，由石油气+水在化工厂制得，是制造硫酸的原料' },
  'sulfuric-acid':     { name: '硫酸', color: '#c8c030', mark: 'H₂SO₄', desc: '强腐蚀性流体，由硫磺+水+铁板在化工厂制得，用于制造电池、激光炮塔与火箭卫星等高级装备' },
  'carbon': { name: '碳', color: '#2a2a2a', mark: 'C', desc: '太空时代基础碳材料，由煤+硫酸在化工厂制得，用于制造碳纤维与硬质合金等高级材料（对齐《异星工厂》Space Age）' },
  // ===== 太空推进链（Space Age Thruster fuel/oxidizer，对齐《异星工厂》Space Age，数据来自官方 locale/GAME_DATA）=====
  'thruster-fuel': { name: '推进器燃料', color: '#e03020', mark: 'TF', desc: '太空时代红色推进流体，由碳+水在化工厂制得（官方 Thruster fuel，化学类别配方）。供推进器/太空平台燃烧，制造推进剂（对齐《异星工厂》Space Age，堆叠以流体计）' },
  'thruster-oxidizer': { name: '推进器氧化剂', color: '#1565ca', mark: 'TO', desc: '太空时代蓝色氧化流体，由铁矿+水在化工厂制得（官方 Thruster oxidizer，化学类别配方）。与推进器燃料配合作为氧化剂（对齐《异星工厂》Space Age，堆叠以流体计）' },
  // ===== 太空时代 Space Age 材料链（数据来自 factorio-data 官方，见 GAME_DATA）=====
  'carbon-fiber': { name: '碳纤维', color: '#7a7a8a', mark: 'CF', desc: '太空时代复合材料，由碳在化工厂制得，用于制造先进装备与科研产物（对齐《异星工厂》Space Age）' },
  'lithium': { name: '锂', color: '#d8d8e8', mark: 'Li', desc: '太空时代金属，由硫酸+轻油在化工厂电解制得，冶炼成锂板用于高级科研（对齐《异星工厂》Space Age）' },
  'lithium-plate': { name: '锂板', color: '#c8c8e0', mark: 'Lp', desc: '太空时代高能材料，由锂在电炉冶炼制成，是电磁科研与高级装备的核心原料（对齐《异星工厂》Space Age）' },
  'superconductor': { name: '超导体', color: '#5a8ae8', mark: 'Sc', desc: '太空时代导电材料，由锂板+铜板+塑料在组装机/电磁工厂制得，用于制造电磁科研包与先进电力设备（对齐《异星工厂》Space Age）' },
  'electromagnetic-science-pack': { name: '电磁科研包', color: '#5a5ae8', mark: 'ESP', desc: '太空时代紫色科研包，由超导体+蓄电器+电路板在电磁工厂制得，解锁太空时代高级科技（对齐《异星工厂》Space Age）' },
  'electromagnetic-plant': { name: '电磁工厂', color: '#4a7ad8', desc: '太空时代高级生产建筑（4×4，吃电力）：比组装机 III 更快、模块槽更多，专用于生产超导体等电磁产品（对齐《异星工厂》Space Age，数据来自 GAME_DATA）' },
  'recycler': { name: '回收机', color: '#8a8f99', desc: '太空时代回收建筑（2×4，吃电力）：把可回收物品还原成其配方原料的 25%（每项至少 1 个），用于处理生产过剩与劣质品（对齐《异星工厂》Space Age 回收机，数据来自 GAME_DATA）' },
  // ===== 太空时代 Vulcanus 铸造/钨材料链（数据来自 factorio-data 官方，见 GAME_DATA）=====
  'tungsten-ore': { name: '钨矿石', color: '#6a6a72', mark: 'W', desc: '太空时代 Vulcanus 星球金属矿石，须用铸造厂冶炼成钨板（对齐《异星工厂》Space Age Tungsten ore，堆叠 50）' },
  'tungsten-plate': { name: '钨板', color: '#9a9aa8', mark: 'Wp', desc: '太空时代高密度金属板，由钨矿石在铸造厂熔炼制得，是高级装备与超速带的核心原料（对齐《异星工厂》Space Age Tungsten plate）' },
  'tungsten-carbide': { name: '碳化钨', color: '#8a8a9a', mark: 'Wc', desc: '太空时代超硬合金，由钨板+碳在铸造厂制得，用于制造冶金科研包与高级工业设备（对齐《异星工厂》Space Age Tungsten carbide）' },
  'metallurgic-science-pack': { name: '冶金科研包', color: '#d08040', mark: 'MSP', desc: '太空时代橙色科研包，由钨板+碳化钨在铸造厂制得，解锁太空时代冶金科技（对齐《异星工厂》Space Age Metallurgic science pack）' },
  'foundry': { name: '铸造厂', color: '#c88040', desc: '太空时代高级熔炼生产建筑（4×4，吃电力）：比电炉/组装机更快的熔炼速度、模块槽更多，专用于冶炼钨/金属与生产冶金产品（对齐《异星工厂》Space Age Foundry，数据来自 GAME_DATA）' },
  // ===== 太空时代 农业/Gleba 生物质材料链（数据来自 factorio-data 官方，见 GAME_DATA）=====
  'yumako': { name: '玉玛果', color: '#d8a020', mark: 'Ym', desc: '太空时代 Gleba 星球作物，用于生物质加工，可制成果泥（对齐《异星工厂》Space Age Yumako，堆叠 50）' },
  'yumako-seed': { name: '玉玛果种子', color: '#c88020', mark: 'Ys', desc: '太空时代 Gleba 作物种子，用于种植雅玛果（对齐《异星工厂》Space Age Yumako seed，堆叠 10）' },
  'yumako-mash': { name: '玉玛果泥', color: '#e0a030', mark: 'Ymh', desc: '太空时代生物质中间产物，由雅玛果加工制得，用于制造生物流与生物质（对齐《异星工厂》Space Age Yumako mash，堆叠 100）' },
  'bioflux': { name: '生物结晶', color: '#40b880', mark: 'Bf', desc: '太空时代高级生物质产物，由果泥+胶质在生化炉制得，是农业科研包与生物质的高级原料（对齐《异星工厂》Space Age Bioflux，堆叠 100）' },
  'nutrients': { name: '营养素', color: '#70a850', mark: 'Nt', desc: '太空时代生物燃料，由雅玛果泥在生化炉制得，用作生化炉的生物质燃料（对齐《异星工厂》Space Age Nutrients，堆叠 100）' },
  'spoilage': { name: '变质物', color: '#8a7a50', mark: 'Sp', desc: '太空时代生物质副产物，用于制造生物硫磺等（对齐《异星工厂》Space Age Spoilage，堆叠 200）' },
  'agricultural-science-pack': { name: '农业科技包', color: '#a8d84a', mark: 'ASP', desc: '太空时代黄色科研包，由生物流在生化炉制得，解锁太空时代农业/生物科技（对齐《异星工厂》Space Age Agricultural science pack，堆叠 200）' },
  'biochamber': { name: '生物室', color: '#4aa86a', desc: '太空时代生物生产建筑（3×3，吃电力）：专用于生产生物质产品（果泥/生物流/营养素/农业科研包等），比组装机更快（对齐《异星工厂》Space Age 生化炉，数据来自 GAME_DATA）' },
  'agricultural-tower': { name: '农业塔', color: '#a08030', desc: '太空时代农业建筑（3×3，吃电力）：在人工雅玛果土壤上种植作物，放入玉玛果种子后持续收获玉玛果（对齐《异星工厂》Space Age Agricultural tower，数据来自 GAME_DATA）' },
  // ===== 太空时代 Gleba 农业土壤（人工雅玛果土壤 / 茂盛雅玛果土壤，数据来自 factorio-data 官方，见 GAME_DATA）=====
  'artificial-yumako-soil': { name: '玉玛果人造土', color: '#7a5a34', mark: '土', desc: '太空时代农业种植土壤（地面铺设）：铺在草地上形成可种植雅玛果的人工土壤，供农业塔种植作物。由玉玛果种子+营养素+填海料制成（对齐《异星工厂》Space Age Artificial yumako soil，堆叠 100）' },
  'overgrowth-yumako-soil': { name: '玉玛果沃土', color: '#5a4a2a', mark: '沃', desc: '太空时代更肥沃的雅玛果土壤（地面铺设）：在人工雅玛果土壤上再铺一层，含更丰富养分，作物生长更快。由人工雅玛果土壤+玉玛果种子+变质物+水制成（对齐《异星工厂》Space Age Overgrowth yumako soil，堆叠 100）' },
  // ===== 太空时代 小行星碎块加工链（破碎机 + 小行星碎块，数据来自 factorio-data 官方，见 GAME_DATA）=====
  'crusher': { name: '破碎机', color: '#9a8a7a', desc: '太空时代破碎建筑（2×3，吃电力）：把小行星碎块（金属/碳质/氧化星块）粉碎成基础资源（铁矿石/碳/冰等），破碎机只会用“破碎”配方（对齐《异星工厂》Space Age 破碎机，官方重力0/太空，此处适配为地面设备，数据来自 GAME_DATA）' },
  'metallic-asteroid-chunk': { name: '金属星块', color: '#8a7a6a', mark: 'Me', desc: '太空时代高金属含量的小行星碎块，用破碎机粉碎可获得大量铁矿石（对齐《异星工厂》Space Age Metallic asteroid chunk，堆叠 1）' },
  'carbonic-asteroid-chunk': { name: '碳质星块', color: '#6a5a4a', mark: 'Ca', desc: '太空时代高碳含量的小行星碎块，用破碎机粉碎可获得碳（对齐《异星工厂》Space Age Carbonic asteroid chunk，堆叠 1）' },
  'oxide-asteroid-chunk': { name: '氧化星块', color: '#4a6a8a', mark: 'Ox', desc: '太空时代高氧含量的小行星碎块，用破碎机粉碎可获得冰（对齐《异星工厂》Space Age Oxide asteroid chunk，堆叠 1）' },
  'promethium-asteroid-chunk': { name: '钷素星块', color: '#4a4a8a', mark: '钷', desc: '太空时代稀有的小行星碎块（钷素 Promethium，堆叠 1），由小行星收集器在远太空中以较低概率收集到，用于合成终极科研包「钷素科研包」（对齐《异星工厂》Space Age Promethium asteroid chunk）' },
  'ice': { name: '冰', color: '#a8d8e8', mark: '冰', desc: '由氧化星块在破碎机粉碎获得，可在熔炉熔化（对齐《异星工厂》Space Age Ice，堆叠 50）' },
  // ===== 太空时代 空间平台系统（Space Platform，数据来自 factorio-data 官方，见 GAME_DATA）=====
  'space-platform-foundation': { name: '太空平台地基', color: '#6a6a76', mark: 'SF', desc: '太空时代空间平台地基（堆叠 100）：铺设成太空平台地板，供空间平台建筑与轨道物流使用（对齐《异星工厂》Space Age Space platform foundation）' },
  'space-platform-hub': { name: '太空平台中枢', color: '#4a5a9a', desc: '太空时代空间平台核心建筑（8×8）：空间平台的中央枢纽，接收行星物资并生产/调度平台地基，是轨道物流的中枢（对齐《异星工厂》Space Age Space platform hub，数据来自 GAME_DATA）' },
  'thruster': { name: '推进器', color: '#a06030', desc: '太空时代推进器（4×8）：燃烧推进器燃料与推进器氧化剂产生推力/电能，是空间平台在行星间航行的动力源（对齐《异星工厂》Space Age Thruster，数据来自 GAME_DATA）' },
  'asteroid-collector': { name: '小行星收集器', color: '#5a6a8a', desc: '太空时代小行星收集器（2×3）：在轨道上收集小行星碎块（金属/碳质/氧化/钷素星块），供破碎机粉碎加工（对齐《异星工厂》Space Age Asteroid collector，数据来自 GAME_DATA）' },
  'space-platform-starter-pack': { name: '空间平台起始包', color: '#8a8a9a', mark: 'SSP', desc: '太空时代空间平台起始套件：由火箭发射升空后构成空间平台的初始骨架（对齐《异星工厂》Space Age Space platform starter pack，堆叠 1）' },
  // ===== 物流机器人网络 =====
  'roboport':          { name: '机器人港', color: '#3a8a8a', desc: '物流机器人的基地与充电站（4×4，吃电力）。把物流机器人放入机器人港后自动调度，机器人往返供应箱与需求箱搬运货物，电量低时回到机器人港充电。可接入电路网络输出整个物流网络各物品库存总量信号（对齐《异星工厂》机器人港电路信号）' },
  'logistic-robot':    { name: '物流机器人', color: '#4aa0d0', desc: '飞行机器人，放入机器人港后自动在供应箱/需求箱之间搬运物资，消耗电量，需回港充电' },
  'construction-robot':{ name: '施工机器人', color: '#d0a04a', desc: '飞行机器人，装备个人机器人港后，可自动按蓝图/红图施工：建造蓝图中的建筑、拆除标记的建筑，消耗背包物资' },
  'personal-roboport-equipment':{ name: '个人机器人港', color: '#7a9a4a', desc: '个人装备：装备后提供施工机器人工作范围（12 格、最多 4 台在场），蓝图粘贴自动由施工机器人建造（需背包中拥有施工机器人）' },
  'personal-roboport-mk2-equipment':{ name: '个人机器人港 II', color: '#5a8ac0', desc: '进阶个人装备：装备后提供更大施工机器人工作范围（20 格、最多 8 台在场），蓝图粘贴自动由施工机器人建造（对齐《异星工厂》Personal roboport Mk2）' },
  'passive-provider-chest': { name: '被动供应箱', color: '#c9a84a', desc: '物流箱：可手动/机械臂存入货物，物流机器人会从箱中取货送往需求箱；也能接收机器人返还的货物' },
  'active-provider-chest':  { name: '主动供应箱', color: '#d0743a', desc: '物流箱：机器人优先从此取货供应网络；多出的货物机器人会收纳到这里，适合作为原料集散点' },
  'storage-chest': { name: '仓储箱', color: '#8a9a6a', desc: '物流箱：机器人把返还/多余货物收纳到这里，也可作为备用取货源。所有仓储箱共享存放' },
  'buffer-chest': { name: '缓冲箱', color: '#c8a05a', desc: '物流箱：介于需求箱与仓储箱之间——既按设定请求货物，又可向网络供应，作为中转缓冲（对齐《异星工厂》Buffer chest）' },
  'requester-chest': { name: '需求箱', color: '#5a8ad0', desc: '物流箱：在面板设置每种物品的需求量，物流机器人会自动从供应箱/仓储箱送货过来补足到目标数量' },
  // ===== 钓鱼与生鱼（对齐《异星工厂》：需手持鱼竿在水域钓鱼，钓到生鱼） =====
  'raw-fish': { name: '生鱼', color: '#8ab0c0', mark: '鱼', desc: '在水域边缘用钓鱼竿钓获的基础食物，可作为低效燃料使用；也可在背包中食用恢复生命值（对齐《异星工厂》：吃鱼治疗）' },
  // ===== 核能（对齐《异星工厂》核动力）=====
  'uranium-ore':  { name: '铀矿石', color: '#7fd44a', mark: 'U', desc: '放射性矿物，距出生点较远处生成，须用电采矿机开采，离心机处理成铀' },
  'uranium-235': { name: '铀-235', color: '#9af07a', mark: 'U⁵', desc: '裂变同位素，由离心机处理铀矿小概率获得；是制造核燃料的关键' },
  'uranium-238': { name: '铀-238', color: '#6aa84a', mark: 'U⁸', desc: '丰度同位素，由离心机处理铀矿大量获得，是核燃料棒的主料，也可参与富集循环与铀弹制造' },
  'nuclear-fuel': { name: '核燃料', color: '#9ae06a', mark: '☢', desc: '由铀-235制造的高能燃烧燃料，可作为载具/车头/锅炉等燃烧器的最高级燃料（能量约为火箭燃料 5 倍，对齐《异星工厂》Nuclear fuel）' },
  'uranium-fuel-cell': { name: '铀燃料棒', color: '#7ad68a', mark: '棒', desc: '核反应堆的专用燃料棒，由10铁板+1铀-235+19铀-238压制出10根（对齐《异星工厂》：反应堆消耗铀燃料棒而非核燃料）。点燃一根可持续燃烧并产出贫化铀燃料棒，可在离心机再生为铀-238，闭合核燃料循环' },
  'depleted-uranium-fuel-cell': { name: '贫化铀燃料棒', color: '#6a7a4a', mark: '废', desc: '铀燃料棒燃尽的残棒（对齐官方命名 depleted-uranium-fuel-cell），可在离心机再生为铀-238，闭合核燃料循环' },
  'centrifuge':   { name: '离心机', color: '#7a8a9a', desc: '把铀矿石分离成铀-235 / 铀-238；也可进行铀增值处理（Kovarex）（3×3，吃电力）' },
  'nuclear-reactor': { name: '核反应堆', color: '#4a8a5a', desc: '消耗铀燃料棒产生巨量热量（5×5）。热量经导热管传导至热交换器，由热交换器把水烧成高温蒸汽，再供汽轮机发电（对齐《异星工厂》核能标准链路，反应堆仅消耗铀燃料棒而非核燃料）' },
  'steam-turbine': { name: '汽轮机', color: '#8fb8d0', desc: '消耗高温蒸汽发电，功率远高于蒸汽机（3×5，对齐官方）。上/下两端中部各有一管道出入口，蒸汽可进可出，支持多台汽轮机串接；与热交换器上边(北)出汽口用蒸汽管对接' },
  'heat-pipe':    { name: '导热管', color: '#d98a3a', desc: '核能的传热设备（1×1）：把核反应堆产生的热量传导到热交换器，可多根串联、沿路传输（对齐《异星工厂》Heat pipe）' },
  'heat-exchanger': { name: '热交换器', color: '#a06a4a', desc: '核能的水→蒸汽转换设备（3×2，对齐《异星工厂》Heat exchanger 真实结构）：下边(南)热交换接口接收导热管热量，左右两侧各一水口进水（互通，多台水口可直接对口串接），上边(北)中间出高温蒸汽供汽轮机发电' },
  'heating-tower': { name: '供热塔', color: '#d98a3a', desc: '太空时代供热塔（3×3，燃烧式）：高效燃烧化学燃料（煤/固体燃料/火箭燃料）产生巨量热量（100MW，官方 consumption 40MW × effectivity 2.5），经导热管传导，达到最高温仍持续燃烧（对齐《异星工厂》Space Age 供热塔，数据来自 GAME_DATA）' },
  'fusion-reactor': { name: '聚变反应堆', color: '#c08a4a', desc: '太空时代聚变反应堆（6×6，Aquilo）：燃烧聚变燃料棒产生超高温等离子热量，经导热管传导至聚变发电机发电，功率远超核反应堆（官方 fusion-reactor，需氟酮冷却液，数据来自 GAME_DATA）' },
  'fusion-generator': { name: '聚变发电机', color: '#4a9ac0', desc: '太空时代聚变发电机（3×5，Aquilo）：把聚变反应堆经导热管传来的等离子热量直接转化为电能，单台满功率 50MW（官方 fusion-generator，数据来自 GAME_DATA）' },
  'fusion-power-cell': { name: '聚变燃料棒', color: '#8ae0c0', desc: '太空时代聚变燃料棒（Aquilo）：聚变反应堆的专属燃料，燃烧后释放等离子体能量（官方 fusion-power-cell，数据来自 GAME_DATA）' },
  'lightning-rod': { name: '避雷针', color: '#e8d848', desc: '太空时代避雷针（1×1，Fulgora）：雷电季节保护小片区域免受雷击，并吸收雷电能量转化为电网电力（官方 efficiency 0.2，数据来自 GAME_DATA.lightning）' },
  'lightning-collector': { name: '避雷收集器', color: '#c0c020', desc: '太空时代避雷收集器（2×2，Fulgora）：保护大片区域免受雷击，收集雷电能量效率更高并转化为电网电力（官方 efficiency 0.4，数据来自 GAME_DATA.lightning）' },
  // ===== 电路网络（对齐《异星工厂》Circuit Network）=====
  'small-electric-pole': { name: '小型电线杆', color: '#8a5a2a', desc: '电线杆：铺设后与附近电线杆自动连线，构成电路网络（1×1，连接距离 7 格）。红/绿线可独立传输信号' },
  'medium-electric-pole': { name: '中型电线杆', color: '#a06a2a', desc: '电线杆：连接距离更远（9 格），构成更大范围的电路网络（2×2）' },
  'big-electric-pole': { name: '大型电线杆', color: '#b0802a', desc: '电线杆：超远连接距离（15 格），用于跨区域组网（2×2）' },
  'constant-combinator': { name: '常量组合器', color: '#4a7ac0', desc: '电路设备：面板设置若干常量信号，持续输出到所连网络（1×1）。可指定输出到红线或绿线' },
  'arithmetic-combinator': { name: '运算组合器', color: '#4a9ac0', desc: '电路设备：读取网络输入信号，做加减乘除运算后输出结果信号（1×1）' },
  'decider-combinator': { name: '判断组合器', color: '#4ac0a0', desc: '电路设备：按条件（如 信号 > 10）判断，满足时输出指定信号；可做“非”逻辑（1×1）' },
  'selector-combinator': { name: '选择组合器', color: '#4a70c0', desc: '电路设备（1×1）：按索引/随机/堆叠等模式从网络信号中选出目标信号并输出其值；可输出红/绿信号、游戏内时钟（对齐《异星工厂》Selector combinator）' },
  'display-panel': { name: '显示屏', color: '#d8d8e8', desc: '电路设备（1×1）：读取所连网络的信号，以文字形式显示在面板上（对齐《异星工厂》Display panel）' },
  // ===== 功率开关（对齐《异星工厂》Power switch，电路控制断电）=====
  'power-switch': { name: '功率开关', color: '#c06040', desc: '电路设备（1×1）：接入电路网络，按面板设定的条件判断是否切断电网供电。条件满足时强制全图断电（甩负荷保护），不满足时正常供电，用于按燃料/电量等信号自动调度电力（对齐《异星工厂》Power switch）' },
  'red-wire': { name: '红电路线缆', color: '#e05a4a', mark: 'R', desc: '手持后点击任意电路设备，可把该设备切换为「仅接入红线网络」（再点切回自动双通）。同一区域内仅用红线连接的设备构成独立的红线网络，实现红绿信号物理隔离（对齐《异星工厂》Red wire）' },
  'green-wire': { name: '绿电路线缆', color: '#5ae06a', mark: 'G', desc: '手持后点击任意电路设备，可把该设备切换为「仅接入绿线网络」（再点切回自动双通）。同一区域内仅用绿线连接的设备构成独立的绿线网络，实现红绿信号物理隔离（对齐《异星工厂》Green wire）' },
  // ===== 混凝土 / 地形改造（对齐《异星工厂》Concrete & Landfill）=====
  'concrete': { name: '混凝土', color: '#9a9aa0', desc: '地面装饰：铺设在草地上可加速玩家行走（比泥地快），需在玩家脚下使用或按住铺设' },
  'refined-concrete': { name: '精炼混凝土', color: '#b0b0b6', desc: '地面装饰：比普通混凝土更耐磨、行走加速更明显（对齐《异星工厂》Refined concrete）' },
  'hazard-concrete': { name: '警示混凝土', color: '#c0a020', desc: '地面装饰：黑黄警示条纹装饰地砖，行走加速同普通混凝土（对齐《异星工厂》Hazard concrete）' },
  'refined-hazard-concrete': { name: '精炼警示混凝土', color: '#c8b020', desc: '地面装饰：精炼混凝土底配黑黄警示条纹，行走加速更快（对齐《异星工厂》Refined hazard concrete）' },
  'stone-path': { name: '石砖路', color: '#a8a09a', desc: '地面装饰：铺设在地面上美观且加速行走（由石砖合成）' },
  'landfill': { name: '填海料', color: '#8a6a3a', desc: '地形改造：把水面填成可建造的陆地（由石头+土合成）' },
  // ===== 模块化护甲 + 个人装备（对齐《异星工厂》Modular armor & Equipment grid）=====
  'modular-armor':  { name: '模块化护甲', color: '#6a8a9a', desc: '基础模块化护甲：减伤 30%，自带 5×5 装备网格，可安装太阳能板/电池/外骨骼等个人装备' },
  'power-armor':    { name: '强力装甲', color: '#5a7aa8', desc: '高级模块化护甲：减伤 45%，自带 7×7 装备网格，更多插槽安装个人装备' },
  'power-armor-mk2':{ name: '强力装甲 II', color: '#5a5aa8', desc: '顶级模块化护甲：减伤 55%，自带 8×8 装备网格，容纳最强个人装备组合' },
  // ---- 个人装备件（装入护甲网格生效） ----
  'solar-panel-equipment': { name: '个人太阳能板', color: '#4aa0d0', desc: '装备件（1×1）：白天为个人电网发电，为外骨骼/激光防御等装备供能' },
  'fusion-reactor-equipment': { name: '便携聚变反应堆', color: '#8ae0a0', desc: '装备件（4×4）：无惧昼夜、持续大功率发电，个人电网的终极电源' },
  'battery-equipment': { name: '个人电池', color: '#d0c04a', desc: '装备件（2×2）：存储个人电力，白天/发电盈余时充电，供装备随时调用' },
  'battery-mk2-equipment': { name: '个人电池 II', color: '#c0a030', desc: '装备件（2×2）：更大储电量的个人电池' },
  'exoskeleton-equipment':    { name: '外骨骼', color: '#8a7a5a', desc: '装备件（2×2）：穿戴后大幅提升玩家移动速度，每个 +40%（叠加）' },
  'night-vision-equipment':    { name: '夜视仪', color: '#5aa05a', desc: '装备件（1×1）：夜间增强视野，使夜晚如同白昼（对齐《异星工厂》Night vision）' },
  'personal-laser-defense-equipment': { name: '个人激光防御', color: '#d04a5a', desc: '装备件（1×1）：自动攻击进入射程的敌人，消耗个人电力，每个激光器各自独立开火' },
  // ===== 能量护盾（对齐《异星工厂》Energy shield：受击时消耗个人电力吸收伤害） =====
  'energy-shield-equipment':   { name: '能量护盾', color: '#4ac0d0', desc: '装备件（2×2）：受击时优先消耗个人电网电力生成护盾吸收伤害（每件最多吸收 200 伤害），电力不足时护盾失效、按原伤害扣血' },
  'energy-shield-mk2-equipment': { name: '能量护盾 II', color: '#3aa0e0', desc: '装备件（2×2）：更强大的能量护盾（每件最多吸收 400 伤害），受击时优先消耗个人电网电力吸收伤害（对齐《异星工厂》Energy shield MK2）' },
  // ===== 传送带免疫装备（对齐《异星工厂》Belt immunity equipment：站上传送带不再被推动） =====
  'belt-immunity-equipment': { name: '传送带免疫', color: '#8a6ac0', desc: '装备件（1×1）：穿戴后玩家站上传送带不再被带动位移，可稳定在带上站立/作业（对齐《异星工厂》Belt immunity equipment）' },
  // ===== 放电防御装备（对齐《异星工厂》Discharge defense：主动对周围敌人释放电击） =====
  'discharge-defense-equipment': { name: '放电防御', color: '#7ac0e0', desc: '装备件（3×3）：手动激活（面板/快捷键）后对以玩家为中心的大范围内所有敌人释放连锁电击，造成高额伤害并大幅消耗个人电网电力。电力不足时无法激活（对齐《异星工厂》Discharge defense equipment）' },
  // ===== 地形树木与木材（对齐《异星工厂》：树可砍伐获得木） =====
  'wood': { name: '木材', color: '#8a6a3a', mark: 'W', desc: '由砍伐树木获得，是木质家具与修理包的原料，也可作低效燃料' },
  // ===== 基础储物箱（对齐《异星工厂》：木箱/铁箱/钢箱递进） =====
  'wooden-chest': { name: '木箱', color: '#a08050', desc: '最基础的储物箱，容量较小（16 格），开局即可合成。可接入电路网络输出箱内物品数量信号（对齐《异星工厂》）' },
  'iron-chest': { name: '铁箱', color: '#b0b8c4', desc: '储物箱，容量比木箱更大（32 格）。可接入电路网络输出箱内物品数量信号（对齐《异星工厂》：8铁板→1铁箱）' },
  // ===== 修理包（对齐《异星工厂》Repair pack） =====
  'repair-pack': { name: '修理包', color: '#5aa0d0', desc: '选中后点击受损建筑可修复其耐久度。每个修理包有多次使用次数，损坏建筑恢复 HP' },
  // ===== 开采工具（对齐《异星工厂》Iron axe / Steel axe：手持加速手挖） =====
  // ===== 规划器（对齐《异星工厂》Deconstruction planner / Upgrade planner） =====
  'deconstruction-planner': { name: '拆除规划器', color: '#d04848', mark: '拆', desc: '手持规划器：选中后进入红图框选模式，框选一块区域即可批量拆除其中的建筑（装备个人机器人港后改由施工机器人拆除）。对齐《异星工厂》Deconstruction planner' },
  'upgrade-planner': { name: '升级规划器', color: '#57b95c', mark: '升', desc: '手持规划器：选中后进入绿图框选模式，框选一块区域后可批量升级/降级其中的建筑。对齐《异星工厂》Upgrade planner' },
  // ===== 空间科学包（对齐《异星工厂》Space science pack，火箭发射产出） =====
  'space-science-pack': { name: '空间科学包', color: '#d0d0e0', mark: 'SC', desc: '由卫星成功发射后获得的高级科学包，用于终局无限科研（科研速度/采矿产能等）' },
  'promethium-science-pack': { name: '钷素科研包', color: '#5a4ad8', mark: 'PSP', desc: '太空时代终极科研包（钷素 Promethium，堆叠 200）：由钷素星块+超导体+生物结晶在电磁工厂/空间平台中枢制得，解锁太空时代终局科技（对齐《异星工厂》Space Age Promethium science pack）' },
  // ===== 流体桶装系统（对齐《异星工厂》Barrel system） =====
  'barrel': { name: '空桶', color: '#9aa0aa', mark: '桶', desc: '可盛装流体的金属桶（1×1）。把空桶放进组装机并接好流体管道，选桶装配方即可把流体灌入桶中；装满的桶可用传送带/机械臂/物流机器人/火车运输，实现流体走物流网络；再把满桶放回组装机选倒空配方，即可把流体倒回管道' },
  'water-barrel':          { name: '桶装水',   color: '#4a90d9', mark: '桶', desc: '盛满水的桶，可经物流网络运输，倒空后获得空桶' },
  'crude-oil-barrel':      { name: '桶装原油', color: '#2a2418', mark: '桶', desc: '盛满原油的桶，可经物流网络运输，倒空后获得空桶' },
  'heavy-oil-barrel':      { name: '桶装重油', color: '#5a3a1e', mark: '桶', desc: '盛满重油的桶，可经物流网络运输，倒空后获得空桶' },
  'light-oil-barrel':      { name: '桶装轻油', color: '#8a5a22', mark: '桶', desc: '盛满轻油的桶，可经物流网络运输，倒空后获得空桶' },
  'petroleum-gas-barrel':  { name: '桶装石油气', color: '#c9a84a', mark: '桶', desc: '盛满石油气的桶，可经物流网络运输，倒空后获得空桶' },
  'lubricant-barrel':      { name: '桶装润滑油', color: '#d8c020', mark: '桶', desc: '盛满润滑油的桶，可经物流网络运输，倒空后获得空桶' },
  'sulfuric-acid-barrel':  { name: '桶装硫酸', color: '#c8c030', mark: '桶', desc: '盛满硫酸的桶，可经物流网络运输，倒空后获得空桶' },
};

// ===== 食用生鱼回血（对齐《异星工厂》：吃鱼治疗） =====
const FISH_HEAL = 20;  // 食用一条生鱼恢复的生命值

// ===== 可桶装的流体（对齐《异星工厂》：所有流体均可桶装，蒸汽亦可） =====
const BARREL_FLUIDS = ['water', 'crude-oil', 'heavy-oil', 'light-oil', 'petroleum-gas', 'lubricant', 'sulfuric-acid'];
const BARREL_CAP = 50;  // 每桶盛装流体量（对齐《异星工厂》Barrel 容量）
// 由流体 id 取对应桶物品 id；非桶装流体返回 null
function barrelItemId(fluid) { return BARREL_FLUIDS.indexOf(fluid) >= 0 ? fluid + '-barrel' : null; }
function fluidFromBarrelItem(item) {
  if (item === 'barrel') return null;
  for (const f of BARREL_FLUIDS) if (f + '-barrel' === item) return f;
  return null;
}

const ORES = ['iron-ore', 'copper-ore', 'coal', 'stone'];  // 0-3；原油/铀矿用特殊索引（见 ORE_OIL/ORE_URANIUM）

const SMELTS = [
  { id: 'iron-plate',   inp: 'iron-ore',   time: 3.2 },
  { id: 'copper-plate', inp: 'copper-ore', time: 3.2 },
  { id: 'steel-plate',  inp: 'iron-plate', inCount: 5, time: 16 },
  { id: 'stone-brick',  inp: 'stone',      inCount: 2, time: 3.2 },
  // 太空时代：锂板（官方 lithium-plate 熔炼配方，由电炉冶炼锂，耗时 6.4s）
  { id: 'lithium-plate', inp: 'lithium',   time: 6.4 }
];

// ===== 官方堆叠数据桥接（GAME_DATA 由 factorio-data 现场生成，见 tools/generate-game-data.js）=====
// 与《异星工厂》官方完全一致：官方 stack_size 覆盖手工值（含 rocket/cargo-wagon/等，
// 官方 rocket=100、cargo-wagon=5、fusion-reactor-equipment=20、cannon-shell=100）。
for (const k in (GAME_DATA.stackSize || {})) {
  STACK_SIZES[k] = GAME_DATA.stackSize[k];
}
