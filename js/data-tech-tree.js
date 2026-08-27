'use strict';

const TECHS = {
  // ==== 一级科技（红瓶，无前置） ====
  mining:     { name: '采矿业', cost: { 'automation-science-pack': 10 }, desc: '采矿机速度 ×2', req: [] },
  // ===== 钓鱼科技（对齐《异星工厂》Fishing：解锁钓鱼竿，可在水域钓获生鱼） =====
  fishing:    { name: '钓鱼', cost: { 'automation-science-pack': 10 }, desc: '解锁钓鱼竿，可在岸边水域抛竿钓获生鱼（对齐《异星工厂》Fishing 科技）', req: [] },
  logistics:  { name: '物流学', cost: { 'automation-science-pack': 15 }, desc: '物流前置科技：解锁铁路等进阶物流科技（对齐《异星工厂》Logistics）', req: [] },
  automation: { name: '自动化', cost: { 'automation-science-pack': 20 }, desc: '组装机速度 ×1.5', req: [] },
  // ==== 二级科技（绿瓶） ====
  logistics2: { name: '物流 II', cost: { 'logistic-science-pack': 25 }, desc: '解锁加长机械臂与极速物流、物流网络等进阶物流（对齐《异星工厂》Logistics 2）', req: ['logistics'] },
  landfill: { name: '填海', cost: { 'logistic-science-pack': 20 }, desc: '解锁填海料：用石头填充水面，把水域填成可建造陆地（对齐《异星工厂》Landfill）', req: ['logistics'] },
  logistics3: { name: '物流 III', cost: { 'logistic-science-pack': 40, 'chemical-science-pack': 30 }, desc: '解锁集装箱机械臂，可一次抓取多达 3 个同种物品，装卸效率极高（对齐《异星工厂》Logistics 3）', req: ['logistics2'] },
  electric:   { name: '电力工程', cost: { 'logistic-science-pack': 15 }, desc: '电炉 / 电采矿机速度 ×1.2', req: ['automation'] },
  oil:        { name: '石油冶金', cost: { 'logistic-science-pack': 30 }, desc: '炼油厂 / 抽油机速度 ×1.5', req: [] },
  railways:    { name: '铁路技术', cost: { 'logistic-science-pack': 30 }, desc: '解锁铁轨、火车头、货运车厢与车站，构建铁路物流', req: ['logistics'] },
  'rail-signals': { name: '铁路信号', cost: { 'chemical-science-pack': 30 }, desc: '解锁铁路信号灯，允许多列火车安全同网行驶', req: ['railways'] },
  'elevated-rail': { name: '高架铁轨', cost: { 'production-science-pack': 30, 'chemical-science-pack': 30 }, desc: '解锁高架桥墩与高架铁轨：在高架桥墩上铺设高架铁轨，让列车跨越水域与地面障碍，拓展铁路网地形适应性（对齐《异星工厂》Elevated Rails 科技，前置混凝土+产能科研包）', req: ['concrete', 'production'] },
  plastic:    { name: '塑料合成', cost: { 'logistic-science-pack': 20 }, desc: '解锁塑料板制造；化工厂生产塑料耗时缩短 ✓（绿色科研的核心支付项，对齐《异星工厂》Plastics）', req: ['oil'] },
  engine:     { name: '引擎技术', cost: { 'logistic-science-pack': 30 }, desc: '解锁引擎单元制造，是载具、电动引擎与重型机械的核心动力部件（对齐《异星工厂》Engine 科技）', req: ['automation'] },
  barrel:     { name: '流体处理', cost: { 'chemical-science-pack': 50 }, desc: '解锁空桶与流体桶装配方，可把流体灌入桶中经物流网络/传送带/火车运输，实现流体走物流链', req: ['oil', 'electronics'] },
  'advanced-oil-processing': { name: '进阶原油加工', cost: { 'chemical-science-pack': 50 }, desc: '解锁进阶原油加工与重油/轻油裂化配方，原油产出更高价值的重/轻油与石油气（对齐《异星工厂》Advanced oil processing）', req: ['oil', 'electronics'] },
  'coal-liquefaction': { name: '煤液化', cost: { 'chemical-science-pack': 60, 'production-science-pack': 30 }, desc: '解锁煤液化配方：用煤+重油+蒸汽在炼油厂转化为重油/轻油/石油气，为缺油地区提供石油替代来源（对齐《异星工厂》Coal liquefaction）', req: ['advanced-oil-processing'] },
  optics:     { name: '光学', cost: { 'chemical-science-pack': 30 }, desc: '解锁雷达建造，并掌握先进光学仪器制造（对齐《异星工厂》Optics 科技，雷达的前置）', req: ['electronics'] },
  radar:      { name: '雷达技术', cost: { 'logistic-science-pack': 30 }, desc: '解锁雷达，自动扫描并标记新探索区域', req: ['optics'] },
  // ==== 三级科技（蓝/军瓶） ====
  automation2:{ name: '自动化 II', cost: { 'chemical-science-pack': 40 }, desc: '组装机 II 速度额外 ×1.2', req: ['electric'] },
  automation3:{ name: '自动化 III', cost: { 'chemical-science-pack': 50, 'logistic-science-pack': 30 }, desc: '解锁组装机 III，速度最高的生产建筑（对齐《异星工厂》Automation 3）', req: ['automation2'] },
  express:    { name: '极速物流', cost: { 'military-science-pack': 40 }, desc: '解锁极速传送带/地下带/分流器，物流终极档', req: ['logistics2'] },
  military:   { name: '军事工程', cost: { 'military-science-pack': 30 }, desc: '解锁机枪炮塔、石墙、弹药（防御体系）', req: [] },
  weapons:    { name: '单兵武器', cost: { 'military-science-pack': 20 }, desc: '解锁手枪、冲锋枪、散弹枪（F 键或空格攻击）', req: ['military'] },
  military2:  { name: '军事科技 II', cost: { 'military-science-pack': 30 }, desc: '解锁战斗散弹枪、火箭筒与穿甲散弹枪弹，强化单兵火力（对齐《异星工厂》Military 2）', req: ['weapons'] },
  military3:  { name: '军事科技 III', cost: { 'military-science-pack': 40, 'chemical-science-pack': 30 }, desc: '解锁坦克、炮弹与重型护甲；机枪炮塔伤害 +40%（对齐《异星工厂》Military 3）', req: ['military2', 'electronics'] },
  military4:  { name: '军事科技 IV', cost: { 'military-science-pack': 60, 'chemical-science-pack': 40, 'production-science-pack': 30 }, desc: '解锁蜘蛛机器人、蜘蛛遥控器与炮兵系统；机枪炮塔伤害额外 +60%（对齐《异星工厂》Military 4）', req: ['military3', 'rocket-science'] },
  'advanced-combat': { name: '高级战斗', cost: { 'military-science-pack': 40, 'chemical-science-pack': 30 }, desc: '解锁战斗机器人胶囊、更强的远程敌人，以及激光/火焰炮塔、爆炸物、核能等高级科技的前置', req: ['military3'] },
  explosives: { name: '爆炸物科技', cost: { 'military-science-pack': 30 }, desc: '解锁爆炸火箭弹（更高威力与更大爆炸范围）与更多爆炸类弹药', req: ['advanced-combat'] },
  'laser-turrets': { name: '激光炮塔', cost: { 'military-science-pack': 30, 'chemical-science-pack': 30 }, desc: '解锁激光炮塔，无需弹药、靠电力自动攻击（对齐《异星工厂》Laser turret 科技）', req: ['advanced-combat', 'battery'] },
  flamethrower: { name: '火焰科技', cost: { 'military-science-pack': 30, 'chemical-science-pack': 30 }, desc: '解锁火焰喷射器、火焰炮塔与火焰弹药，喷射燃烧火焰造成持续灼烧（对齐《异星工厂》Flamethrower 科技）', req: ['advanced-combat', 'oil'] },
  'land-mine': { name: '地雷', cost: { 'military-science-pack': 20 }, desc: '解锁地雷，铺设后敌人踏入即爆炸造成范围伤害（对齐《异星工厂》Landmines 科技）', req: ['military'] },
  'cluster-grenade': { name: '集束手雷', cost: { 'military-science-pack': 30 }, desc: '解锁集束手雷，爆炸范围与威力远胜普通手雷（对齐《异星工厂》Cluster grenade 科技）', req: ['explosives'] },
  'uranium-ammo': { name: '铀弹', cost: { 'production-science-pack': 30, 'military-science-pack': 30 }, desc: '解锁铀弹与铀炮弹，以铀-238 制成的高伤害弹药（对齐《异星工厂》Uranium ammo 科技）', req: ['nuclear'] },
  electronics: { name: '电子学', cost: { 'chemical-science-pack': 40 }, desc: '解锁电子电路与基础电子元件（火箭链路的关键）', req: ['plastic', 'oil'] },
  'advanced-electronics': { name: '高级电子学', cost: { 'chemical-science-pack': 60 }, desc: '解锁高级电路板（对齐《异星工厂》Advanced electronics）', req: ['electronics'] },
  'advanced-electronics-2': { name: '高级电子学 II', cost: { 'chemical-science-pack': 90 }, desc: '解锁处理器（蓝板）（对齐《异星工厂》Advanced electronics 2）', req: ['advanced-electronics', 'advanced-oil-processing'] },
  'electric-engine-unit': { name: '电动引擎', cost: { 'chemical-science-pack': 50 }, desc: '解锁电动引擎单元（对齐《异星工厂》Electric engine）', req: ['engine', 'advanced-electronics'] },
  'sulfur-processing': { name: '硫磺处理', cost: { 'chemical-science-pack': 40 }, desc: '解锁硫磺与硫酸（对齐《异星工厂》Sulfur processing）', req: ['oil'] },
  'solar-energy': { name: '太阳能', cost: { 'chemical-science-pack': 30 }, desc: '解锁太阳能板，白天可采集阳光发电（对齐《异星工厂》Solar energy）', req: ['electric', 'electronics'] },
  'electric-energy-accumulators': { name: '蓄电器', cost: { 'chemical-science-pack': 30 }, desc: '解锁蓄电器，存储电力以在夜晚/低谷期为电网续供（对齐《异星工厂》Electric energy accumulators）', req: ['solar-energy'] },
  'steel-processing': { name: '炼钢科技', cost: { 'chemical-science-pack': 20 }, desc: '解锁钢炉与钢箱，提升冶炼效率与储物容量（对齐《异星工厂》Steel processing）', req: ['electric'] },
  'steel-axe': { name: '钢斧', cost: { 'chemical-science-pack': 30 }, desc: '解锁钢斧：比铁斧更耐用的开采/砍树工具，手挖/砍树速度显著提升（对齐《异星工厂》Steel axe）', req: ['steel-processing'] },
  concrete: { name: '混凝土', cost: { 'chemical-science-pack': 50 }, desc: '解锁混凝土、精炼混凝土与警示混凝土地砖：铺设后加速玩家行走，并可填海造地（对齐《异星工厂》Concrete）', req: ['steel-processing', 'automation2'] },
  'fluid-handling': { name: '地下管道', cost: { 'logistic-science-pack': 20 }, desc: '解锁地下管道与流体泵，可跨格输送流体并提升管道网络吞吐（对齐《异星工厂》Fluid handling）', req: ['oil'] },
  battery:    { name: '电池技术', cost: { 'chemical-science-pack': 30 }, desc: '解锁电池制造，用于激光炮塔、卫星与机器人（对齐《异星工厂》Battery 科技）', req: ['oil'] },
  'combat-robotics': { name: '战斗机器人', cost: { 'military-science-pack': 40, 'chemical-science-pack': 30 }, desc: '解锁防御/干扰/破坏三种战斗机器人胶囊，可投掷释放伴随作战（对齐《异星工厂》Combat robotics）', req: ['advanced-combat', 'electronics'] },
  'rocket-science': { name: '火箭技术', cost: { 'chemical-science-pack': 100, 'military-science-pack': 50 }, desc: '解锁火箭发射井、火箭部件与卫星，发射火箭赢得游戏', req: ['electronics', 'express'] },
  modules:    { name: '模块工程', cost: { 'chemical-science-pack': 40 }, desc: '解锁速度模块与产能模块（增强组装机/电炉）', req: ['electronics'] },
  'modules2': { name: '模块工程 II', cost: { 'production-science-pack': 50, 'chemical-science-pack': 30 }, desc: '解锁二级速度/产能模块（效果更强）', req: ['modules', 'production'] },
  'modules3': { name: '模块工程 III', cost: { 'production-science-pack': 80, 'utility-science-pack': 60 }, desc: '解锁三级速度/产能模块（效果最强）', req: ['modules2', 'utility'] },
  'advanced-material-processing': { name: '进阶材料处理', cost: { 'chemical-science-pack': 50 }, desc: '解锁效率模块（大幅降低生产耗电）。对齐《异星工厂》Advanced material processing 科技，与模块工程（速度/产能模块）并列' }, 
  'advanced-material-processing-2': { name: '进阶材料处理 II', cost: { 'production-science-pack': 50, 'chemical-science-pack': 30 }, desc: '解锁效率模块 II（更强降耗）。对齐《异星工厂》Advanced material processing 2', req: ['advanced-material-processing', 'production'] },
  'advanced-material-processing-3': { name: '进阶材料处理 III', cost: { 'production-science-pack': 80, 'utility-science-pack': 60 }, desc: '解锁效率模块 III（极强降耗）。对齐《异星工厂》Advanced material processing 3', req: ['advanced-material-processing-2', 'utility'] },
  'quality': { name: '品质学', cost: { 'chemical-science-pack': 50 }, desc: '解锁品质模块：生产时有概率产出更高质量（罕见/稀有/史诗/传说）的物品（对齐《异星工厂》Quality DLC 品质模块 I），高品质建筑更快、更强' },
  'quality-2': { name: '品质学 II', cost: { 'production-science-pack': 50, 'chemical-science-pack': 30 }, desc: '解锁品质模块 II（更高品质概率）。对齐《异星工厂》Quality 2', req: ['quality', 'production'] },
  'quality-3': { name: '品质学 III', cost: { 'production-science-pack': 80, 'utility-science-pack': 60 }, desc: '解锁品质模块 III（极高品质概率）。对齐《异星工厂》Quality 3', req: ['quality-2', 'utility'] },
  'logistics-network': { name: '物流网络', cost: { 'chemical-science-pack': 50 }, desc: '解锁机器人港、四类物流箱与物流机器人，构建自动化物流网络', req: ['logistics2', 'electronics'] },
  nuclear:    { name: '核能技术', cost: { 'chemical-science-pack': 60, 'military-science-pack': 40 }, desc: '解锁离心机（铀浓缩处理）、核反应堆与汽轮机，构建核能发电体系', req: ['electronics', 'advanced-combat'] },
  'atomic-bomb': { name: '原子弹科技', cost: { 'chemical-science-pack': 80, 'military-science-pack': 80 }, desc: '解锁终极核武器原子弹：由铀-235+火箭+爆炸物制成，落地引发超大范围核爆（对齐《异星工厂》Atomic bomb 独立科技）', req: ['nuclear', 'rocket-science'] },
  'circuit-network': { name: '电路网络', cost: { 'chemical-science-pack': 40 }, desc: '解锁电线杆与组合器（常量/运算/判断），构建电路网络，实现信号逻辑控制；含超大型变电站与可编程音箱（告警）', req: ['electronics'] },
  deep:       { name: '重工蓝图', cost: { 'chemical-science-pack': 50 }, desc: '蓝包终技：科研总进度获取 +20%', req: ['automation2', 'express'] },
  // ==== 四级科技（紫瓶：产能科学） ====
  production: { name: '产能科技', cost: { 'production-science-pack': 50 }, desc: '解锁信号塔（Beacon）与产能科学链，让产能模块覆盖范围翻倍', req: ['modules', 'deep'] },
  'mining-productivity': { name: '采矿产能', cost: { 'production-science-pack': 60 }, infinite: true, desc: '无限科技：采矿机额外产出（每级 +10%），可无限叠加（对齐《异星工厂》Mining productivity 无限科技）', req: ['production'] },
  // ==== 五级科技（黄瓶：实用科学） ====
  'worker-robot-speed': { name: '机器人速度', cost: { 'production-science-pack': 50, 'utility-science-pack': 50 }, infinite: true, desc: '无限科技：物流/施工机器人速度每级 ×1.5，可无限叠加（对齐《异星工厂》Worker robot speed 无限科技）', req: ['production'] },
  utility: { name: '实用科技', cost: { 'utility-science-pack': 60 }, desc: '解锁飞行机器人框架、施工机器人，完善机器人网络', req: ['logistics-network', 'worker-robot-speed'] },
  'research-speed': { name: '科研速度', cost: { 'production-science-pack': 50, 'utility-science-pack': 50 }, infinite: true, desc: '无限科技：科研速度每级 +50%，可无限叠加（对齐《异星工厂》Research speed 无限科技）', req: ['utility'] },
  'kovarex-enrichment': { name: '铀富集', cost: { 'production-science-pack': 60, 'utility-science-pack': 40 }, desc: '解锁 Kovarex 富集循环：用铀-238 在铀-235 催化下持续富集出更多铀-235，可自持循环（对齐《异星工厂》Kovarex enrichment process）', req: ['nuclear', 'production'] },
  'inserter-capacity': { name: '机械臂容量', cost: { 'production-science-pack': 50, 'utility-science-pack': 30 }, infinite: true, desc: '无限科技：每次研究让集装箱机械臂单次抓取数量 +1（对齐《异星工厂》Inserter capacity bonus）', req: ['production', 'utility'] },
  // ==== 终局装备科技（对齐《异星工厂》Modular armor / Power armor 科技链）====
  'armor-modular': { name: '模块化护甲', cost: { 'production-science-pack': 50, 'utility-science-pack': 50 }, desc: '解锁模块化护甲与基础个人装备（个人太阳能板 / 个人电池 / 夜视仪），装备网格中可安装外骨骼等装备件', req: ['production', 'utility'] },
  'armor-power': { name: '强力装甲', cost: { 'utility-science-pack': 80 }, desc: '解锁强力装甲（更大装备网格）与外骨骼、个人激光防御等高级装备件', req: ['armor-modular'] },
  'armor-power-mk2': { name: '强力装甲 II', cost: { 'utility-science-pack': 120 }, desc: '解锁终极强力装甲 II 与便携聚变反应堆，个人电网获得终极动力', req: ['armor-power', 'nuclear'] },
  // ==== 空间科技（火箭发射后，用空间科学包推进终极无限科研）====
  'space-science': { name: '空间科技', cost: { 'space-science-pack': 50, 'utility-science-pack': 50 }, desc: '解锁空间科学科研体系，允许用空间科学包研究终极科技（科研速度/采矿产能等）', req: ['utility', 'rocket-science'] },
  'turbo-logistics': { name: '超速物流', cost: { 'space-science-pack': 100, 'production-science-pack': 100 }, desc: '太空时代超速物流：解锁超速传送带/地下带/分流器（4 档带，速度 7.5 格/s，为普通带 4 倍），物流终极档（对齐《异星工厂》Space Age Turbo transport belt，需先建立太空科研体系）', req: ['space-science', 'express'] },
  'electromagnetics': { name: '电磁学', cost: { 'space-science-pack': 100, 'utility-science-pack': 100 }, desc: '太空时代电磁学：解锁碳纤维/锂/锂板/超导体材料链与电磁工厂、电磁科研包（对齐《异星工厂》Space Age 电磁科学），需先建立空间科学体系', req: ['space-science'] },
  'metallurgy': { name: '冶金学', cost: { 'space-science-pack': 100, 'utility-science-pack': 100 }, desc: '太空时代冶金学：解锁钨矿石/钨板/碳化钨材料链与铸造厂、冶金科研包（对齐《异星工厂》Space Age 冶金科学），需先建立空间科学体系', req: ['space-science'] },
  'recycling': { name: '回收科技', cost: { 'electromagnetic-science-pack': 100, 'utility-science-pack': 100 }, desc: '解锁回收机：把物品还原成其配方原料的 25%，用于处理生产过剩与回收高级材料（对齐《异星工厂》Recycling 科技，需电磁科研）', req: ['electromagnetics'] },
  'agriculture': { name: '农业科技', cost: { 'space-science-pack': 100, 'utility-science-pack': 100 }, desc: '太空时代农业：解锁雅玛果泥/生物流/营养素/生物硫磺生物质材料链与生化炉、农业科研包（对齐《异星工厂》Space Age 农业科学），需先建立太空科研体系', req: ['space-science'] },
  'asteroid-processing': { name: '太空材料加工', cost: { 'space-science-pack': 100, 'utility-science-pack': 100 }, desc: '太空时代小行星材料加工：解锁破碎机与小行星碎块（金属/碳质/氧化星块）的粉碎加工，可把星块还原为铁矿石/碳/冰等基础资源（对齐《异星工厂》Space Age 破碎机/小行星加工），需先建立太空科研体系', req: ['space-science'] },
  'big-mining-drill': { name: '大型采矿机', cost: { 'space-science-pack': 100, 'production-science-pack': 100 }, desc: '太空时代大型采矿机：解锁 5×5 大型采矿钻机（mining_speed 2.5，官方 Space Age Big mining drill），采矿范围更大、速度更快，对齐官方科技', req: ['space-science', 'mining'] },
  'heating-tower': { name: '供热塔', cost: { 'space-science-pack': 100, 'chemical-science-pack': 100 }, desc: '太空时代供热塔：解锁 3×3 供热塔（官方 Heating tower，燃烧化学燃料产热 100MW，为核反应堆 2.5 倍），供热塔经四边热量接口向导热管传导，达到最高温仍持续燃烧，用于热水/防冻基础设施（对齐《异星工厂》Space Age 供热塔科技）', req: ['space-science'] },
  'biolab': { name: '生物实验室', cost: { 'agricultural-science-pack': 100, 'electromagnetic-science-pack': 100 }, desc: '太空时代生物实验室：解锁 5×5 生物实验室（官方 Biolab，科研速度 2 倍、模块槽 4），可研究全部太空时代科技（对齐《异星工厂》Space Age 生物实验室科技，前置农业科技）', req: ['agriculture'] },
  'lightning': { name: '避雷科技', cost: { 'space-science-pack': 100, 'electromagnetic-science-pack': 100 }, desc: '太空时代避雷科技：解锁避雷针与避雷收集器（Fulgora 官方 Lightning 科技）。雷电季节会随机落雷，避雷针/避雷收集器保护周围区域免受雷击并把雷电能量转化为电网电力（官方 efficiency：避雷针 0.2 / 收集器 0.4，数据来自 GAME_DATA.lightning），需电磁科研', req: ['electromagnetics'] },
  'space-research-speed': { name: '空间科研速度', cost: { 'space-science-pack': 100 }, infinite: true, desc: '无限科技：每次研究科研速度 +20%（对齐《异星工厂》Research speed 无限科技）', req: ['space-science'] },
  'space-mining-productivity': { name: '空间采矿产能', cost: { 'space-science-pack': 100 }, infinite: true, desc: '无限科技：每次研究采矿产能 +10%（对齐《异星工厂》Mining productivity 无限科技）', req: ['space-science'] },
  'weapon-damage': { name: '武器伤害', cost: { 'space-science-pack': 100, 'military-science-pack': 50 }, infinite: true, desc: '无限科技：每次研究提升所有武器与炮塔伤害 +10%（对齐《异星工厂》Weapon damage 无限科技），让科技军备在终局持续成长', req: ['space-science', 'advanced-combat'] },
  'follower-robot-count': { name: '追随机器人', cost: { 'production-science-pack': 50, 'utility-science-pack': 50 }, infinite: true, desc: '无限科技：每次研究提升同时在场战斗机器人数量上限 +2（对齐《异星工厂》Follower robot count）', req: ['utility', 'advanced-combat'] },
  'worker-robot-cargo-size': { name: '机器人容量', cost: { 'production-science-pack': 50, 'utility-science-pack': 50 }, infinite: true, desc: '无限科技：每次研究提升物流/施工机器人单次搬运物品数量 +2（对齐《异星工厂》Worker robot cargo size 无限科技）', req: ['production', 'utility'] },
  'artillery-shooting-speed': { name: '炮兵射速', cost: { 'production-science-pack': 60, 'utility-science-pack': 60, 'military-science-pack': 40 }, infinite: true, desc: '无限科技：每次研究提升炮兵连与炮兵车厢射击速度 +10%（对齐《异星工厂》Artillery shell shooting speed 无限科技）', req: ['production', 'utility', 'advanced-combat'] },
  'shooting-speed': { name: '射击速度', cost: { 'military-science-pack': 40, 'chemical-science-pack': 30 }, infinite: true, desc: '无限科技：每次研究提升玩家枪械（手枪/冲锋枪/散弹枪/战斗散弹枪）与机枪炮塔的射击速度，射击间隔缩短 10%（对齐《异星工厂》Shooting speed 无限科技）', req: ['advanced-combat'] },
  'artillery-shell-range': { name: '炮兵射程', cost: { 'production-science-pack': 60, 'utility-science-pack': 60, 'military-science-pack': 40 }, infinite: true, desc: '无限科技：每次研究提升炮兵连与炮兵车厢的射程 +30%，让远程火力覆盖更远（对齐《异星工厂》Artillery shell range 无限科技）', req: ['production', 'utility', 'advanced-combat'] },
  'rail-productivity': { name: '铁路产能', cost: { 'production-science-pack': 60, 'utility-science-pack': 60 }, infinite: true, desc: '无限科技：每次研究提升货运车厢槽位容量 +2，列车单趟装载更多货物（对齐《异星工厂》Rail productivity 无限科技）', req: ['production', 'utility', 'railways'] },
  // ==== 火车制动（对齐《异星工厂》Braking force 无限科技：强化列车制动，缩短停靠/让行等待，提升铁路吞吐）====
  'braking-force': { name: '火车制动', cost: { 'production-science-pack': 50, 'utility-science-pack': 40 }, infinite: true, desc: '无限科技：每次研究提升列车制动能力，车站停靠与信号灯让行的等待时间缩短 15%（对齐《异星工厂》Braking force 无限科技）', req: ['production', 'utility', 'railways'] },
  // ==== 火箭产能（对齐《异星工厂》Rocket productivity：逐级降低火箭组装部件需求）====
  'rocket-productivity': { name: '火箭产能', cost: { 'production-science-pack': 60, 'utility-science-pack': 40 }, desc: '逐级降低火箭组装所需的火箭燃料与低密度结构数量（每级各 -1，最低保留 1），让终局火箭冲刺更轻松（对齐《异星工厂》Rocket productivity）', req: ['rocket-science', 'production'] },
  'physical-projectile-damage': { name: '投射物伤害', cost: { 'space-science-pack': 80, 'military-science-pack': 50 }, infinite: true, desc: '无限科技：每次研究提升玩家枪械与子弹（手枪/冲锋枪/散弹枪/机枪炮塔/车辆机炮等投射物）伤害 +10%（对齐《异星工厂》Physical projectile damage）', req: ['space-science', 'advanced-combat'] },
  'energy-weapons-damage': { name: '能量武器伤害', cost: { 'space-science-pack': 80, 'military-science-pack': 50 }, infinite: true, desc: '无限科技：每次研究提升激光炮塔与个人激光防御等能量武器伤害 +10%（对齐《异星工厂》Energy weapons damage）', req: ['space-science', 'advanced-combat'] },
  'refined-flammables': { name: '燃烧伤害', cost: { 'space-science-pack': 80, 'military-science-pack': 50 }, infinite: true, desc: '无限科技：每次研究提升火焰喷射器、火焰炮塔与地面火场等燃烧伤害 +10%（对齐《异星工厂》Refined flammables）', req: ['space-science', 'advanced-combat'] },
  'stronger-explosives': { name: '爆炸伤害', cost: { 'space-science-pack': 80, 'military-science-pack': 50 }, infinite: true, desc: '无限科技：每次研究提升火箭筒/炮弹/手雷/炮兵/地雷/原子弹等爆炸类伤害 +10%（对齐《异星工厂》Stronger explosives）', req: ['space-science', 'explosives'] },
  'fuel-efficiency': { name: '燃料效率', cost: { 'space-science-pack': 80, 'utility-science-pack': 40 }, infinite: true, desc: '无限科技：每次研究降低所有燃烧设备（锅炉/熔炉/矿机/热能机械臂/车头/载具等）的燃料消耗约 9%，让每单位燃料更耐用（对齐《异星工厂》Fuel efficiency 无限科技），核燃料棒不受影响', req: ['space-science', 'utility'] },
  infinite:   { name: '无限科技', cost: {}, infinite: true, desc: '无限研究：消耗任意科学包，永不完成', req: [] }
};

// 判断是否为无限科技（永不完成、消耗任意科学包）
function isInfiniteTech(tid) { return !!(TECHS[tid] && TECHS[tid].infinite); }
// 科技是否已“研究过”（可为前置所用）：已完成，或无限科技至少研究过一次（G.techProg>0）。
// 异星工厂中「机器人速度/科研速度/采矿产能/武器伤害/机械臂容量/追随机器人」等均为可重复
// 研究的无限科技，首次研究即满足前置依赖，后续可继续无限叠加等级。
function techResearched(tid) {
  if (G.techDone[tid]) return true;
  return isInfiniteTech(tid) && (G.techProg[tid] || 0) > 0;
}
// 无限科技当前研究等级（未研究返回 0）
function techLevel(tid) { return (G.techProg[tid] || 0); }
// 研究队列：完成当前科技后顺延到队列下一项。返回下一个 activeTech（或 null）。
function advanceTechQueue() {
  if (!G.techQueue) G.techQueue = [];
  // 移除已完成/已入队的当前项
  if (G.techQueue.length && G.techQueue[0] === G.activeTech) G.techQueue.shift();
  // 跳过已完成与前置未满足的项
  while (G.techQueue.length && (techResearched(G.techQueue[0]) || techLocked(G.techQueue[0]))) G.techQueue.shift();
  G.activeTech = G.techQueue.length ? G.techQueue[0] : null;
  if (typeof renderPanel === 'function') renderPanel(false);
  return G.activeTech;
}
// 前置科技是否全部完成（空前置或无前置即视为满足）
function techPrereqsDone(tid) {
  const req = (TECHS[tid] && TECHS[tid].req) || [];
  for (const r of req) if (!techResearched(r)) return false;
  return true;
}
// 科技是否被前置锁定（有未完成的前置科技）
function techLocked(tid) { return !techPrereqsDone(tid); }
// 返回未完成的前置科技 id 列表（用于界面提示）
function techMissingPrereqs(tid) {
  const req = (TECHS[tid] && TECHS[tid].req) || [];
  return req.filter(r => !techResearched(r));
}

// ===== 新增科技迁移（对齐《异星工厂》进阶科技，保持旧档可用）=====
// 新版本把部分原本直接可用或仅按核能门控的配方拆成独立进阶科技（进阶原油加工、
// 煤液化、铀富集、原子弹科技）。旧档玩家在拆分前已研究对应上游科技（石油冶金/核能），
// 加载时自动补完这些新科技，避免已有产线因配方锁定而失效。对新档无影响。
function migrateNewTechs(techDone) {
  if (!techDone) return;
  // 已研究「石油冶金」→ 自动补完「进阶原油加工」「煤液化」（原版进阶原油加工解锁裂化）
  if (techDone['oil']) {
    techDone['advanced-oil-processing'] = true;
    techDone['coal-liquefaction'] = true;
  }
  // 已研究「核能技术」→ 自动补完「铀富集」「原子弹科技」（拆分前二者仅受核能门控）
  if (techDone['nuclear']) {
    techDone['kovarex-enrichment'] = true;
    techDone['atomic-bomb'] = true;
  }
  // 兼容旧档：此前太阳能板/蓄电器/钢炉/钢箱/地下管道/流体泵/战斗机器人胶囊
  // 未受科技门控，老玩家可能已拥有；补完对应新科技以避免被锁死（对齐《异星工厂》科技树拆分）。
  if (techDone['electronics'] || techDone['electric']) {
    techDone['solar-energy'] = true;
    techDone['electric-energy-accumulators'] = true;
    techDone['steel-processing'] = true;
  }
  if (techDone['oil']) techDone['fluid-handling'] = true;
  if (techDone['advanced-combat']) { techDone['combat-robotics'] = true; techDone['military3'] = true; techDone['military4'] = true; }
  // 兼容旧档：集装箱机械臂此前无科技门控，组装机 III 此前开局可用；
  // 拆分后分别由「物流 III」与「自动化 III」门控，老玩家补完对应科技避免产线被锁死（对齐《异星工厂》Logistics 3 / Automation 3）。
  if (techDone['logistics2'] || techDone['express']) techDone['logistics3'] = true;
  if (techDone['automation2']) techDone['automation3'] = true;
  // 兼容旧档：高速/加长机械臂此前无科技门控，开局即可用；现分别由「自动化 II」「物流 II」门控，
  // 老玩家可能已拥有对应产线，补完对应科技避免被锁死（对齐《异星工厂》Automation 2 / Logistics 2）。
  if (techDone['automation']) techDone['automation2'] = true;
  if (techDone['logistics']) techDone['logistics2'] = true;
  // 兼容旧档：效率模块此前由「模块工程」解锁，现拆分出「进阶材料处理」科技链；
  // 旧档已研究模块工程时补完对应进阶材料处理科技，保持科技树一致（功能本身仍兼容任一解锁）。
  if (techDone['modules']) techDone['advanced-material-processing'] = true;
  if (techDone['modules2']) techDone['advanced-material-processing-2'] = true;
  if (techDone['modules3']) techDone['advanced-material-processing-3'] = true;
  // 兼容旧档：引擎单元/电池/塑料板/固体燃料此前不受科技门控，现分别由「引擎技术」「电池技术」「塑料合成」「石油冶金」解锁；
  // 老玩家可能已拥有对应产线，补完对应科技避免被锁死（对齐《异星工厂》科技树）。
  if (techDone['automation']) techDone['engine'] = true;
  if (techDone['oil']) { techDone['battery'] = true; techDone['plastic'] = true; }
  // 兼容旧档：高级电路/处理器/电动引擎/硫磺此前由「电子学」/「石油冶金」直接解锁，
  // 现拆分为独立进阶科技（高级电子学/高级电子学II/电动引擎/硫磺处理），
  // 老玩家补完对应科技避免产线被锁死（对齐《异星工厂》科技树）。
  if (techDone['electronics']) { techDone['advanced-electronics'] = true; techDone['advanced-electronics-2'] = true; techDone['electric-engine-unit'] = true; }
  if (techDone['oil']) techDone['sulfur-processing'] = true;
  // 兼容旧档：钓鱼此前无需鱼竿、直接点击水域即可；现改为需手持「钓鱼竿」+「钓鱼」科技。
  // 老玩家此前本就能钓鱼，自动补完钓鱼科技以避免被锁死（对齐《异星工厂》Fishing 科技）。
  techDone['fishing'] = true;
  // 兼容旧档：混凝土/填海/钢斧此前不受科技门控，老玩家可能已拥有对应产线；
  // 现拆分为独立科技（对齐《异星工厂》Concrete/Landfill/Steel axe），旧档按已解锁的上游补完，避免被锁死。
  if (techDone['steel-processing']) techDone['steel-axe'] = true;
  if (techDone['steel-processing'] && techDone['automation2']) techDone['concrete'] = true;
  if (techDone['logistics']) techDone['landfill'] = true;
  return techDone;
}

