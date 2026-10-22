'use strict';

// ===== 自动生成文件：由 data/ 各 mod 的 locale/en 与 locale/zh-CN cfg 经 tools/generate-locale.js 打包生成 =====
// 官方文本唯一打包源：游戏内所有物品/建筑/流体/配方/装备/地图控件等官方名称（中英文）
// 均从本文件的 GAME_LOCALE 获取（见 js/data-util.js 的 localizedName）。
// 请勿手改本文件；data/ 文本变更后重新生成：npm run locale（或 node tools/generate-locale.js）
// 结构：GAME_LOCALE.sections = 段优先级（item-name > entity-name > recipe-name > fluid-name...）；
//       GAME_LOCALE.entries[段][官方名] = { zh, en }（多 mod 合并，后读覆盖前读）
// 生成时间指纹（data/ 各 .cfg 文件字节数，供 --check 过期检测）：data/base/locale/en/base.cfg:76848|data/base/locale/zh-CN/base.cfg:72169|data/core/locale/en/core.cfg:263617|data/core/locale/zh-CN/core.cfg:249261|data/elevated-rails/locale/en/elevated-rails.cfg:1405|data/elevated-rails/locale/zh-CN/elevated-rails.cfg:1311|data/quality/locale/en/quality.cfg:2600|data/quality/locale/zh-CN/quality.cfg:2524|data/recycler/locale/en/recycler.cfg:1270|data/recycler/locale/zh-CN/recycler.cfg:1180|data/space-age/locale/en/space-age.cfg:52342|data/space-age/locale/zh-CN/space-age.cfg:49091
const GAME_LOCALE = {
 "sections": [
  "autoplace-control-names",
  "item-name",
  "entity-name",
  "recipe-name",
  "fluid-name",
  "equipment-name",
  "tile-name",
  "map-gen-preset-name",
  "map-gen-preset-description"
 ],
 "entries": {
  "autoplace-control-names": {
   "enemy-base": {
    "en": "Enemy bases",
    "zh": "虫族部落"
   },
   "trees": {
    "en": "Trees",
    "zh": "树木"
   },
   "rocks": {
    "en": "Rocks",
    "zh": "岩石"
   },
   "starting_area_moisture": {
    "en": "Starting area moisture",
    "zh": "起始区域湿度"
   },
   "water": {
    "en": "Water",
    "zh": "水域"
   },
   "nauvis_cliff": {
    "en": "Cliffs",
    "zh": "悬崖"
   },
   "gleba_plants": {
    "en": "Gleba plants",
    "zh": "句芒星植物"
   },
   "gleba_enemy_base": {
    "en": "Gleba enemy bases",
    "zh": "句芒星虫族部落"
   },
   "gleba_water": {
    "en": "Gleba water",
    "zh": "句芒星水域"
   },
   "fulgora_islands": {
    "en": "Fulgora islands",
    "zh": "雷神星岛屿"
   },
   "vulcanus_volcanism": {
    "en": "Vulcanus volcanism",
    "zh": "祝融星火山活动"
   },
   "gleba_cliff": {
    "en": "Gleba cliffs",
    "zh": "句芒星悬崖"
   },
   "fulgora_cliff": {
    "en": "Fulgora cliffs",
    "zh": "雷神星悬崖"
   }
  },
  "item-name": {
   "electric-energy-interface-equipment": {
    "en": "Electric energy interface equipment",
    "zh": "电力接口模块"
   },
   "display-panel": {
    "en": "Display panel",
    "zh": "显示器"
   },
   "repair-pack": {
    "en": "Repair pack",
    "zh": "修理包"
   },
   "stone": {
    "en": "Stone",
    "zh": "石矿"
   },
   "wood": {
    "en": "Wood",
    "zh": "木材"
   },
   "copper-ore": {
    "en": "Copper ore",
    "zh": "铜矿"
   },
   "iron-ore": {
    "en": "Iron ore",
    "zh": "铁矿"
   },
   "uranium-ore": {
    "en": "Uranium ore",
    "zh": "铀矿"
   },
   "coal": {
    "en": "Coal",
    "zh": "煤矿"
   },
   "copper-plate": {
    "en": "Copper plate",
    "zh": "铜板"
   },
   "iron-plate": {
    "en": "Iron plate",
    "zh": "铁板"
   },
   "steel-plate": {
    "en": "Steel plate",
    "zh": "钢材"
   },
   "stone-brick": {
    "en": "Stone brick",
    "zh": "石砖"
   },
   "iron-gear-wheel": {
    "en": "Iron gear wheel",
    "zh": "铁齿轮"
   },
   "iron-stick": {
    "en": "Iron stick",
    "zh": "铁棒"
   },
   "copper-cable": {
    "en": "Copper cable",
    "zh": "铜缆"
   },
   "copper-wire": {
    "en": "Copper wire",
    "zh": "铜线"
   },
   "cliff-explosives": {
    "en": "Cliff explosives",
    "zh": "悬崖炸药"
   },
   "pistol": {
    "en": "Pistol",
    "zh": "手枪"
   },
   "submachine-gun": {
    "en": "Submachine gun",
    "zh": "冲锋枪"
   },
   "vehicle-machine-gun": {
    "en": "Vehicle machine gun",
    "zh": "车载机枪"
   },
   "tank-machine-gun": {
    "en": "Vehicle machine gun",
    "zh": "车载机枪"
   },
   "tank-flamethrower": {
    "en": "Vehicle flamethrower",
    "zh": "车载喷火器"
   },
   "artillery-wagon-cannon": {
    "en": "Artillery cannon",
    "zh": "重型火炮"
   },
   "rocket-launcher": {
    "en": "Rocket launcher",
    "zh": "火箭筒"
   },
   "spidertron-rocket-launcher": {
    "en": "Spidertron rocket launcher",
    "zh": "蜘蛛机甲火箭筒"
   },
   "flamethrower": {
    "en": "Flamethrower",
    "zh": "火焰喷射器"
   },
   "flamethrower-ammo": {
    "en": "Flamethrower ammo",
    "zh": "油料储罐"
   },
   "flamethrower-turret": {
    "en": "Flamethrower turret",
    "zh": "火焰炮塔"
   },
   "artillery-turret": {
    "en": "Artillery turret",
    "zh": "重炮炮塔"
   },
   "electronic-circuit": {
    "en": "Electronic circuit",
    "zh": "电路板"
   },
   "advanced-circuit": {
    "en": "Advanced circuit",
    "zh": "集成电路"
   },
   "processing-unit": {
    "en": "Processing unit",
    "zh": "处理器"
   },
   "light-armor": {
    "en": "Light armor",
    "zh": "轻型装甲"
   },
   "heavy-armor": {
    "en": "Heavy armor",
    "zh": "重型装甲"
   },
   "modular-armor": {
    "en": "Modular armor",
    "zh": "模块装甲"
   },
   "power-armor": {
    "en": "Power armor",
    "zh": "能量装甲"
   },
   "power-armor-mk2": {
    "en": "Power armor MK2",
    "zh": "能量装甲 MK2"
   },
   "rocket": {
    "en": "Rocket",
    "zh": "火箭弹"
   },
   "explosive-rocket": {
    "en": "Explosive rocket",
    "zh": "爆破火箭弹"
   },
   "firearm-magazine": {
    "en": "Firearm magazine",
    "zh": "标准弹匣"
   },
   "piercing-rounds-magazine": {
    "en": "Piercing rounds magazine",
    "zh": "穿甲弹匣"
   },
   "laser-turret": {
    "en": "Laser turret",
    "zh": "激光炮塔"
   },
   "solar-panel": {
    "en": "Solar panel",
    "zh": "太阳能板"
   },
   "raw-fish": {
    "en": "Raw fish",
    "zh": "鲜鱼"
   },
   "lab": {
    "en": "Lab",
    "zh": "研究中心"
   },
   "science": {
    "en": "Science",
    "zh": "科技"
   },
   "automation-science-pack": {
    "en": "Automation science pack",
    "zh": "机自科技包（红瓶）"
   },
   "logistic-science-pack": {
    "en": "Logistic science pack",
    "zh": "物流科技包（绿瓶）"
   },
   "chemical-science-pack": {
    "en": "Chemical science pack",
    "zh": "化工科技包（蓝瓶）"
   },
   "military-science-pack": {
    "en": "Military science pack",
    "zh": "军备科技包（灰瓶）"
   },
   "production-science-pack": {
    "en": "Production science pack",
    "zh": "生产科技包（紫瓶）"
   },
   "utility-science-pack": {
    "en": "Utility science pack",
    "zh": "效能科技包（黄瓶）"
   },
   "space-science-pack": {
    "en": "Space science pack",
    "zh": "太空科技包（白瓶）"
   },
   "red-wire": {
    "en": "Red wire",
    "zh": "红线"
   },
   "green-wire": {
    "en": "Green wire",
    "zh": "绿线"
   },
   "speed-module": {
    "en": "Speed module",
    "zh": "速度插件"
   },
   "speed-module-2": {
    "en": "Speed module 2",
    "zh": "速度插件 2"
   },
   "speed-module-3": {
    "en": "Speed module 3",
    "zh": "速度插件 3"
   },
   "productivity-module": {
    "en": "Productivity module",
    "zh": "产能插件"
   },
   "productivity-module-2": {
    "en": "Productivity module 2",
    "zh": "产能插件 2"
   },
   "productivity-module-3": {
    "en": "Productivity module 3",
    "zh": "产能插件 3"
   },
   "efficiency-module": {
    "en": "Efficiency module",
    "zh": "节能插件"
   },
   "efficiency-module-2": {
    "en": "Efficiency module 2",
    "zh": "节能插件 2"
   },
   "efficiency-module-3": {
    "en": "Efficiency module 3",
    "zh": "节能插件 3"
   },
   "empty-module-slot": {
    "en": "Empty module slot",
    "zh": "空插件槽位"
   },
   "no-item": {
    "en": "No item",
    "zh": "没有物品"
   },
   "shotgun": {
    "en": "Shotgun",
    "zh": "霰弹枪"
   },
   "combat-shotgun": {
    "en": "Combat shotgun",
    "zh": "冲锋霰弹枪"
   },
   "shotgun-shell": {
    "en": "Shotgun shells",
    "zh": "霰弹"
   },
   "piercing-shotgun-shell": {
    "en": "Piercing shotgun shells",
    "zh": "穿甲霰弹"
   },
   "defender-capsule": {
    "en": "Defender capsule",
    "zh": "防御无人机胶囊"
   },
   "distractor-capsule": {
    "en": "Distractor capsule",
    "zh": "掩护无人机胶囊"
   },
   "destroyer-capsule": {
    "en": "Destroyer capsule",
    "zh": "进攻无人机胶囊"
   },
   "poison-capsule": {
    "en": "Poison capsule",
    "zh": "剧毒胶囊"
   },
   "slowdown-capsule": {
    "en": "Slowdown capsule",
    "zh": "减速胶囊"
   },
   "grenade": {
    "en": "Grenade",
    "zh": "标准手雷"
   },
   "cluster-grenade": {
    "en": "Cluster grenade",
    "zh": "集束手雷"
   },
   "discharge-defense-remote": {
    "en": "Discharge defense remote",
    "zh": "放电防御遥控器"
   },
   "copy-paste-tool": {
    "en": "Copy paste tool",
    "zh": "复制粘贴工具"
   },
   "blueprint": {
    "en": "Blueprint",
    "zh": "蓝图（建设规划）"
   },
   "blueprint-book": {
    "en": "Blueprint book",
    "zh": "蓝图簿"
   },
   "deconstruction-planner": {
    "en": "Deconstruction planner",
    "zh": "红图（拆除规划）"
   },
   "upgrade-planner": {
    "en": "Upgrade planner",
    "zh": "绿图（升级规划）"
   },
   "sulfur": {
    "en": "Sulfur",
    "zh": "硫磺"
   },
   "solid-fuel": {
    "en": "Solid fuel",
    "zh": "固体燃料"
   },
   "plastic-bar": {
    "en": "Plastic bar",
    "zh": "塑料"
   },
   "engine-unit": {
    "en": "Engine unit",
    "zh": "内燃机"
   },
   "electric-engine-unit": {
    "en": "Electric engine unit",
    "zh": "电动机"
   },
   "flying-robot-frame": {
    "en": "Flying robot frame",
    "zh": "机器人构架"
   },
   "explosives": {
    "en": "Explosives",
    "zh": "炸药"
   },
   "battery": {
    "en": "Battery",
    "zh": "电池"
   },
   "barrel": {
    "en": "Barrel",
    "zh": "空桶"
   },
   "crude-oil-barrel": {
    "en": "Crude oil barrel",
    "zh": "原油桶"
   },
   "coin": {
    "en": "Coin",
    "zh": "金币"
   },
   "cannon-shell": {
    "en": "Cannon shell",
    "zh": "标准炮弹"
   },
   "explosive-cannon-shell": {
    "en": "Explosive cannon shell",
    "zh": "爆破炮弹"
   },
   "tank-cannon": {
    "en": "Tank cannon",
    "zh": "坦克炮"
   },
   "low-density-structure": {
    "en": "Low density structure",
    "zh": "轻质框架"
   },
   "rocket-fuel": {
    "en": "Rocket fuel",
    "zh": "火箭燃料"
   },
   "nuclear-fuel": {
    "en": "Nuclear fuel",
    "zh": "核能燃料"
   },
   "rocket-part": {
    "en": "Rocket part",
    "zh": "火箭组件"
   },
   "concrete": {
    "en": "Concrete",
    "zh": "标准混凝土"
   },
   "refined-concrete": {
    "en": "Refined concrete",
    "zh": "钢筋混凝土"
   },
   "hazard-concrete": {
    "en": "Hazard concrete",
    "zh": "标准混凝土（标识）"
   },
   "refined-hazard-concrete": {
    "en": "Refined hazard concrete",
    "zh": "钢筋混凝土（标识）"
   },
   "rail": {
    "en": "Rail",
    "zh": "铁轨"
   },
   "landfill": {
    "en": "Landfill",
    "zh": "填埋材料"
   },
   "electric-energy-interface": {
    "en": "Electric energy interface",
    "zh": "电力接口"
   },
   "heat-interface": {
    "en": "Heat interface",
    "zh": "热力接口"
   },
   "burner-generator": {
    "en": "Burner generator",
    "zh": "热能发电机"
   },
   "simple-entity-with-force": {
    "en": "Simple entity with force",
    "zh": "阵营的简单实体"
   },
   "simple-entity-with-owner": {
    "en": "Simple entity with owner",
    "zh": "个人的简单实体"
   },
   "uranium-235": {
    "en": "Uranium-235",
    "zh": "铀-235"
   },
   "uranium-238": {
    "en": "Uranium-238",
    "zh": "铀-238"
   },
   "uranium-fuel-cell": {
    "en": "Uranium fuel cell",
    "zh": "铀燃料棒"
   },
   "depleted-uranium-fuel-cell": {
    "en": "Depleted uranium fuel cell",
    "zh": "贫铀燃料棒"
   },
   "filled-barrel": {
    "en": "__1__ barrel",
    "zh": "__1__桶"
   },
   "uranium-rounds-magazine": {
    "en": "Uranium rounds magazine",
    "zh": "贫铀弹匣"
   },
   "uranium-cannon-shell": {
    "en": "Uranium cannon shell",
    "zh": "贫铀炮弹"
   },
   "explosive-uranium-cannon-shell": {
    "en": "Explosive uranium cannon shell",
    "zh": "爆破贫铀炮弹"
   },
   "atomic-bomb": {
    "en": "Atomic bomb",
    "zh": "原子弹"
   },
   "item-with-tags": {
    "en": "Item with tags",
    "zh": "带标签的物品"
   },
   "item-with-label": {
    "en": "Item with label",
    "zh": "带标识的物品"
   },
   "item-with-inventory": {
    "en": "Item with inventory",
    "zh": "带仓储的物品"
   },
   "selection-tool": {
    "en": "Selection tool",
    "zh": "选择工具"
   },
   "infinity-chest": {
    "en": "Infinity chest",
    "zh": "永续箱"
   },
   "linked-chest": {
    "en": "Linked chest",
    "zh": "关联箱"
   },
   "proxy-container": {
    "en": "Proxy container",
    "zh": "代理箱"
   },
   "bottomless-chest": {
    "en": "Bottomless chest",
    "zh": "无底箱"
   },
   "infinity-pipe": {
    "en": "Infinity pipe",
    "zh": "永续管"
   },
   "belt-immunity-equipment": {
    "en": "Belt immunity equipment",
    "zh": "锚定模块"
   },
   "artillery-shell": {
    "en": "Artillery shell",
    "zh": "重炮炮弹"
   },
   "artillery-targeting-remote": {
    "en": "Artillery targeting remote",
    "zh": "重炮瞄准遥控器"
   },
   "cut-paste-tool": {
    "en": "Cut paste tool",
    "zh": "剪切粘贴工具"
   },
   "spidertron-remote": {
    "en": "Spidertron remote",
    "zh": "蜘蛛机甲遥控器"
   },
   "satellite": {
    "en": "Satellite",
    "zh": "卫星"
   },
   "item-unknown": {
    "en": "Unknown item",
    "zh": "未知物品"
   },
   "quality-module": {
    "en": "Quality module",
    "zh": "品质插件"
   },
   "quality-module-2": {
    "en": "Quality module 2",
    "zh": "品质插件 2"
   },
   "quality-module-3": {
    "en": "Quality module 3",
    "zh": "品质插件 3"
   },
   "yumako-mash": {
    "en": "Yumako mash",
    "zh": "玉玛果泥"
   },
   "jelly": {
    "en": "Jelly",
    "zh": "果冻"
   },
   "iron-bacteria": {
    "en": "Iron bacteria",
    "zh": "铁细菌"
   },
   "copper-bacteria": {
    "en": "Copper bacteria",
    "zh": "铜细菌"
   },
   "bioflux": {
    "en": "Bioflux",
    "zh": "生物结晶"
   },
   "artificial-yumako-soil": {
    "en": "Artificial yumako soil",
    "zh": "玉玛果人造土"
   },
   "overgrowth-yumako-soil": {
    "en": "Overgrowth yumako soil",
    "zh": "玉玛果沃土"
   },
   "artificial-jellynut-soil": {
    "en": "Artificial jellynut soil",
    "zh": "果冻果人造土"
   },
   "overgrowth-jellynut-soil": {
    "en": "Overgrowth jellynut soil",
    "zh": "果冻果沃土"
   },
   "nutrients": {
    "en": "Nutrients",
    "zh": "营养素"
   },
   "jellynut": {
    "en": "Jellynut",
    "zh": "果冻果"
   },
   "yumako-seed": {
    "en": "Yumako seed",
    "zh": "玉玛果种子"
   },
   "jellynut-seed": {
    "en": "Jellynut seed",
    "zh": "果冻果种子"
   },
   "tree-seed": {
    "en": "Tree seed",
    "zh": "树种子"
   },
   "ice": {
    "en": "Ice",
    "zh": "冰"
   },
   "scrap": {
    "en": "Scrap",
    "zh": "废料"
   },
   "space-platform-foundation": {
    "en": "Space platform foundation",
    "zh": "太空平台基座"
   },
   "space-platform-starter-pack": {
    "en": "Space platform starter pack",
    "zh": "太空平台启动包"
   },
   "agricultural-science-pack": {
    "en": "Agricultural science pack",
    "zh": "农业科技包（草瓶）"
   },
   "metallic-asteroid-chunk": {
    "en": "Metallic asteroid chunk",
    "zh": "金属星块"
   },
   "carbonic-asteroid-chunk": {
    "en": "Carbonic asteroid chunk",
    "zh": "碳质星块"
   },
   "oxide-asteroid-chunk": {
    "en": "Oxide asteroid chunk",
    "zh": "氧化星块"
   },
   "promethium-asteroid-chunk": {
    "en": "Promethium asteroid chunk",
    "zh": "钷素星块"
   },
   "big-mining-drill": {
    "en": "Big mining drill",
    "zh": "大型采矿机"
   },
   "calcite": {
    "en": "Calcite",
    "zh": "方解石"
   },
   "captive-biter-spawner": {
    "en": "Captive biter spawner",
    "zh": "虫巢孵化器"
   },
   "biolab": {
    "en": "Biolab",
    "zh": "生物研究中心"
   },
   "capture-robot-rocket": {
    "en": "Capture bot rocket",
    "zh": "捕获者火箭弹"
   },
   "carbon": {
    "en": "Carbon",
    "zh": "碳"
   },
   "crusher": {
    "en": "Crusher",
    "zh": "破碎机"
   },
   "cryogenic-plant": {
    "en": "Cryogenic plant",
    "zh": "低温工厂"
   },
   "cryogenic-science-pack": {
    "en": "Cryogenic science pack",
    "zh": "低温科技包（靛瓶）"
   },
   "promethium-science-pack": {
    "en": "Promethium science pack",
    "zh": "钷素科技包（黑瓶）"
   },
   "electromagnetic-science-pack": {
    "en": "Electromagnetic science pack",
    "zh": "电磁科技包（粉瓶）"
   },
   "fusion-power-cell": {
    "en": "Fusion power cell",
    "zh": "聚变燃料棒"
   },
   "holmium-ore": {
    "en": "Holmium ore",
    "zh": "钬矿"
   },
   "holmium-plate": {
    "en": "Holmium plate",
    "zh": "钬板"
   },
   "lithium": {
    "en": "Lithium",
    "zh": "锂"
   },
   "lithium-plate": {
    "en": "Lithium plate",
    "zh": "锂板"
   },
   "mech-armor": {
    "en": "Mech armor",
    "zh": "机械装甲"
   },
   "metallurgic-science-pack": {
    "en": "Metallurgic science pack",
    "zh": "冶金科技包（橙瓶）"
   },
   "quantum-processor": {
    "en": "Quantum processor",
    "zh": "量子处理器"
   },
   "railgun": {
    "en": "Railgun",
    "zh": "磁轨炮"
   },
   "railgun-ammo": {
    "en": "Railgun ammo",
    "zh": "磁轨炮弹"
   },
   "supercapacitor": {
    "en": "Supercapacitor",
    "zh": "超级电容器"
   },
   "superconductor": {
    "en": "Superconductor",
    "zh": "超导体"
   },
   "tesla-ammo": {
    "en": "Tesla ammo",
    "zh": "特斯拉弹药"
   },
   "teslagun": {
    "en": "Tesla gun",
    "zh": "特斯拉枪"
   },
   "tungsten-carbide": {
    "en": "Tungsten carbide",
    "zh": "碳化钨"
   },
   "tungsten-ore": {
    "en": "Tungsten ore",
    "zh": "钨矿"
   },
   "tungsten-plate": {
    "en": "Tungsten plate",
    "zh": "钨板"
   },
   "turbo-splitter": {
    "en": "Turbo splitter",
    "zh": "超速分流器"
   },
   "turbo-transport-belt": {
    "en": "Turbo transport belt",
    "zh": "超速传送带"
   },
   "turbo-underground-belt": {
    "en": "Turbo underground belt",
    "zh": "超速地下传送带"
   },
   "yumako": {
    "en": "Yumako",
    "zh": "玉玛果"
   },
   "spoilage": {
    "en": "Spoilage",
    "zh": "变质物"
   },
   "carbon-fiber": {
    "en": "Carbon fiber",
    "zh": "碳纤维"
   },
   "biter-egg": {
    "en": "Biter egg",
    "zh": "异虫卵"
   },
   "pentapod-egg": {
    "en": "Pentapod egg",
    "zh": "五足虫卵"
   },
   "ice-platform": {
    "en": "Ice platform",
    "zh": "浮冰平台"
   },
   "foundation": {
    "en": "Foundation",
    "zh": "工程基座"
   }
  },
  "entity-name": {
   "cargo-landing-pad": {
    "en": "Cargo landing pad",
    "zh": "物流接驳站"
   },
   "cargo-landing-pad-remnants": {
    "en": "Cargo landing pad remnants",
    "zh": "物流接驳站残骸"
   },
   "cargo-pod": {
    "en": "Cargo pod",
    "zh": "货舱"
   },
   "cargo-pod-container": {
    "en": "Landed cargo pod",
    "zh": "着陆货舱"
   },
   "tree-proxy": {
    "en": "Trees",
    "zh": "树木"
   },
   "tree-dying-proxy": {
    "en": "Pollution absorbed by damaging trees",
    "zh": "树木受损所吸收的污染"
   },
   "tile-proxy": {
    "en": "Tiles",
    "zh": "地格"
   },
   "cliff": {
    "en": "Cliff",
    "zh": "悬崖"
   },
   "stone": {
    "en": "Stone",
    "zh": "石矿"
   },
   "wooden-chest": {
    "en": "Wooden chest",
    "zh": "木箱"
   },
   "copper-ore": {
    "en": "Copper ore",
    "zh": "铜矿"
   },
   "iron-ore": {
    "en": "Iron ore",
    "zh": "铁矿"
   },
   "uranium-ore": {
    "en": "Uranium ore",
    "zh": "铀矿"
   },
   "coal": {
    "en": "Coal",
    "zh": "煤矿"
   },
   "stone-furnace": {
    "en": "Stone furnace",
    "zh": "石炉"
   },
   "steel-furnace": {
    "en": "Steel furnace",
    "zh": "钢炉"
   },
   "electric-furnace": {
    "en": "Electric furnace",
    "zh": "电炉"
   },
   "transport-belt": {
    "en": "Transport belt",
    "zh": "基础传送带"
   },
   "fast-transport-belt": {
    "en": "Fast transport belt",
    "zh": "高速传送带"
   },
   "express-transport-belt": {
    "en": "Express transport belt",
    "zh": "极速传送带"
   },
   "underground-belt": {
    "en": "Underground belt",
    "zh": "基础地下传送带"
   },
   "fast-underground-belt": {
    "en": "Fast underground belt",
    "zh": "高速地下传送带"
   },
   "express-underground-belt": {
    "en": "Express underground belt",
    "zh": "极速地下传送带"
   },
   "loader-1x1": {
    "en": "Loader 1x1",
    "zh": "装卸机 1x1"
   },
   "loader": {
    "en": "Loader",
    "zh": "装卸机"
   },
   "fast-loader": {
    "en": "Fast loader",
    "zh": "高速装卸机"
   },
   "express-loader": {
    "en": "Express loader",
    "zh": "极速装卸机"
   },
   "electric-mining-drill": {
    "en": "Electric mining drill",
    "zh": "电力采矿机"
   },
   "burner-mining-drill": {
    "en": "Burner mining drill",
    "zh": "热能采矿机"
   },
   "gun-turret": {
    "en": "Gun turret",
    "zh": "机枪炮塔"
   },
   "laser-turret": {
    "en": "Laser turret",
    "zh": "激光炮塔"
   },
   "flamethrower-turret": {
    "en": "Flamethrower turret",
    "zh": "火焰炮塔"
   },
   "artillery-turret": {
    "en": "Artillery turret",
    "zh": "重炮炮塔"
   },
   "burner-inserter": {
    "en": "Burner inserter",
    "zh": "热能机械臂"
   },
   "inserter": {
    "en": "Inserter",
    "zh": "电力机械臂"
   },
   "long-handed-inserter": {
    "en": "Long-handed inserter",
    "zh": "加长机械臂"
   },
   "fast-inserter": {
    "en": "Fast inserter",
    "zh": "高速机械臂"
   },
   "bulk-inserter": {
    "en": "Bulk inserter",
    "zh": "集装机械臂"
   },
   "iron-chest": {
    "en": "Iron chest",
    "zh": "铁箱"
   },
   "steel-chest": {
    "en": "Steel chest",
    "zh": "钢箱"
   },
   "construction-robot": {
    "en": "Construction robot",
    "zh": "建设机器人"
   },
   "logistic-robot": {
    "en": "Logistic robot",
    "zh": "物流机器人"
   },
   "active-provider-chest": {
    "en": "Active provider chest",
    "zh": "主动供货箱（紫箱）"
   },
   "passive-provider-chest": {
    "en": "Passive provider chest",
    "zh": "被动供货箱（红箱）"
   },
   "storage-chest": {
    "en": "Storage chest",
    "zh": "被动存货箱（黄箱）"
   },
   "buffer-chest": {
    "en": "Buffer chest",
    "zh": "主动存货箱（绿箱）"
   },
   "requester-chest": {
    "en": "Requester chest",
    "zh": "优先集货箱（蓝箱）"
   },
   "beacon": {
    "en": "Beacon",
    "zh": "插件效果分享塔"
   },
   "car": {
    "en": "Car",
    "zh": "汽车"
   },
   "spidertron": {
    "en": "Spidertron",
    "zh": "蜘蛛机甲"
   },
   "tank": {
    "en": "Tank",
    "zh": "坦克"
   },
   "legacy-straight-rail": {
    "en": "Legacy straight rail",
    "zh": "传统直轨"
   },
   "legacy-curved-rail": {
    "en": "Legacy curved rail",
    "zh": "传统曲轨"
   },
   "rail-ending-remnants": {
    "en": "Rail ending remnants",
    "zh": "铁轨末端残骸"
   },
   "offshore-pump": {
    "en": "Offshore pump",
    "zh": "抽取泵"
   },
   "water-well-pump": {
    "en": "Water well pump",
    "zh": "水井泵"
   },
   "pump": {
    "en": "Pump",
    "zh": "管道泵"
   },
   "pipe": {
    "en": "Pipe",
    "zh": "管道"
   },
   "pipe-to-ground": {
    "en": "Pipe to ground",
    "zh": "地下管道"
   },
   "one-way-valve": {
    "en": "One-way valve",
    "zh": "单向阀"
   },
   "overflow-valve": {
    "en": "Overflow valve",
    "zh": "溢流阀"
   },
   "top-up-valve": {
    "en": "Top-up valve",
    "zh": "补充阀"
   },
   "locomotive": {
    "en": "Locomotive",
    "zh": "内燃机车"
   },
   "boiler": {
    "en": "Boiler",
    "zh": "锅炉"
   },
   "heat-exchanger": {
    "en": "Heat exchanger",
    "zh": "换热器"
   },
   "heat-pipe": {
    "en": "Heat pipe",
    "zh": "热管"
   },
   "small-electric-pole": {
    "en": "Small electric pole",
    "zh": "小型电线杆"
   },
   "steam-engine": {
    "en": "Steam engine",
    "zh": "蒸汽机"
   },
   "steam-turbine": {
    "en": "Steam turbine",
    "zh": "汽轮机"
   },
   "assembling-machine-1": {
    "en": "Assembling machine 1",
    "zh": "组装机1型"
   },
   "assembling-machine-2": {
    "en": "Assembling machine 2",
    "zh": "组装机2型"
   },
   "assembling-machine-3": {
    "en": "Assembling machine 3",
    "zh": "组装机3型"
   },
   "centrifuge": {
    "en": "Centrifuge",
    "zh": "离心机"
   },
   "oil-refinery": {
    "en": "Oil refinery",
    "zh": "炼油厂"
   },
   "chemical-plant": {
    "en": "Chemical plant",
    "zh": "化工厂"
   },
   "biter-spawner": {
    "en": "Biter spawner",
    "zh": "撕咬虫巢"
   },
   "rocket": {
    "en": "Rocket",
    "zh": "火箭弹"
   },
   "rocket-silo-rocket-shadow": {
    "en": "Rocket shadow",
    "zh": "火箭阴影"
   },
   "land-mine": {
    "en": "Land mine",
    "zh": "地雷"
   },
   "fish": {
    "en": "Fish",
    "zh": "鱼"
   },
   "solar-panel": {
    "en": "Solar panel",
    "zh": "太阳能板"
   },
   "small-biter": {
    "en": "Small biter",
    "zh": "小型撕咬虫"
   },
   "small-biter-corpse": {
    "en": "Small biter corpse",
    "zh": "小型撕咬虫尸体"
   },
   "medium-biter": {
    "en": "Medium biter",
    "zh": "中型撕咬虫"
   },
   "medium-biter-corpse": {
    "en": "Medium biter corpse",
    "zh": "中型撕咬虫尸体"
   },
   "big-biter": {
    "en": "Big biter",
    "zh": "大型撕咬虫"
   },
   "behemoth-biter": {
    "en": "Behemoth biter",
    "zh": "巨兽型撕咬虫"
   },
   "big-biter-corpse": {
    "en": "Big biter corpse",
    "zh": "大型撕咬虫尸体"
   },
   "behemoth-biter-corpse": {
    "en": "Behemoth biter corpse",
    "zh": "巨兽型撕咬虫尸体"
   },
   "biter-spawner-corpse": {
    "en": "Biter spawner corpse",
    "zh": "撕咬虫巢尸体"
   },
   "small-spitter": {
    "en": "Small spitter",
    "zh": "小型喷吐虫"
   },
   "small-spitter-corpse": {
    "en": "Small spitter corpse",
    "zh": "小型喷吐虫尸体"
   },
   "medium-spitter": {
    "en": "Medium spitter",
    "zh": "中型喷吐虫"
   },
   "medium-spitter-corpse": {
    "en": "Medium spitter corpse",
    "zh": "中型喷吐虫尸体"
   },
   "big-spitter": {
    "en": "Big spitter",
    "zh": "大型喷吐虫"
   },
   "behemoth-spitter": {
    "en": "Behemoth spitter",
    "zh": "巨兽型喷吐虫"
   },
   "big-spitter-corpse": {
    "en": "Big spitter corpse",
    "zh": "大型喷吐虫尸体"
   },
   "behemoth-spitter-corpse": {
    "en": "Behemoth spitter corpse",
    "zh": "巨兽型喷吐虫尸体"
   },
   "spitter-spawner": {
    "en": "Spitter spawner",
    "zh": "喷吐虫巢"
   },
   "spitter-spawner-corpse": {
    "en": "Spitter spawner corpse",
    "zh": "喷吐虫巢尸体"
   },
   "radar": {
    "en": "Radar",
    "zh": "雷达"
   },
   "stone-wall": {
    "en": "Wall",
    "zh": "墙壁"
   },
   "gate": {
    "en": "Gate",
    "zh": "闸门"
   },
   "lab": {
    "en": "Lab",
    "zh": "研究中心"
   },
   "display-panel": {
    "en": "Display panel",
    "zh": "显示器"
   },
   "character": {
    "en": "Character",
    "zh": "玩家"
   },
   "item-on-ground": {
    "en": "Item on ground",
    "zh": "落地物品"
   },
   "small-lamp": {
    "en": "Lamp",
    "zh": "照明灯"
   },
   "rocket-silo": {
    "en": "Rocket silo",
    "zh": "火箭发射井"
   },
   "roboport": {
    "en": "Roboport",
    "zh": "机器人指令平台"
   },
   "splitter": {
    "en": "Splitter",
    "zh": "基础分流器"
   },
   "fast-splitter": {
    "en": "Fast splitter",
    "zh": "高速分流器"
   },
   "express-splitter": {
    "en": "Express splitter",
    "zh": "极速分流器"
   },
   "lane-splitter": {
    "en": "Lane splitter",
    "zh": "单带分流器"
   },
   "market": {
    "en": "Market",
    "zh": "市场"
   },
   "train-stop": {
    "en": "Train stop",
    "zh": "车站"
   },
   "rail-signal": {
    "en": "Rail signal",
    "zh": "常规铁路信号"
   },
   "rail-chain-signal": {
    "en": "Rail chain signal",
    "zh": "联锁铁路信号"
   },
   "cargo-wagon": {
    "en": "Cargo wagon",
    "zh": "货运车厢"
   },
   "fluid-wagon": {
    "en": "Fluid wagon",
    "zh": "液罐车厢"
   },
   "artillery-wagon": {
    "en": "Artillery wagon",
    "zh": "重炮车厢"
   },
   "arithmetic-combinator": {
    "en": "Arithmetic combinator",
    "zh": "算术运算器"
   },
   "decider-combinator": {
    "en": "Decider combinator",
    "zh": "判断运算器"
   },
   "selector-combinator": {
    "en": "Selector combinator",
    "zh": "选择运算器"
   },
   "constant-combinator": {
    "en": "Constant combinator",
    "zh": "常量运算器"
   },
   "power-switch": {
    "en": "Power switch",
    "zh": "电闸"
   },
   "programmable-speaker": {
    "en": "Programmable speaker",
    "zh": "程控扬声器"
   },
   "big-electric-pole": {
    "en": "Big electric pole",
    "zh": "远程输电塔"
   },
   "medium-electric-pole": {
    "en": "Medium electric pole",
    "zh": "中型电线杆"
   },
   "accumulator": {
    "en": "Accumulator",
    "zh": "蓄电器"
   },
   "substation": {
    "en": "Substation",
    "zh": "广域配电站"
   },
   "small-worm-turret": {
    "en": "Small worm",
    "zh": "小型沙虫"
   },
   "medium-worm-turret": {
    "en": "Medium worm",
    "zh": "中型沙虫"
   },
   "big-worm-turret": {
    "en": "Big worm",
    "zh": "大型沙虫"
   },
   "behemoth-worm-turret": {
    "en": "Behemoth worm",
    "zh": "巨兽型沙虫"
   },
   "small-worm-corpse": {
    "en": "Small worm corpse",
    "zh": "小型沙虫尸体"
   },
   "medium-worm-corpse": {
    "en": "Medium worm corpse",
    "zh": "中型沙虫尸体"
   },
   "big-worm-corpse": {
    "en": "Big worm corpse",
    "zh": "大型沙虫尸体"
   },
   "behemoth-worm-corpse": {
    "en": "Behemoth worm corpse",
    "zh": "巨兽型沙虫尸体"
   },
   "small-worm-corpse-burrowed": {
    "en": "Small worm corpse burrowed",
    "zh": "被埋的小型沙虫尸体"
   },
   "medium-worm-corpse-burrowed": {
    "en": "Medium worm corpse burrowed",
    "zh": "被埋的中型沙虫尸体"
   },
   "big-worm-corpse-burrowed": {
    "en": "Big worm corpse burrowed",
    "zh": "被埋的大型沙虫尸体"
   },
   "behemoth-worm-corpse-burrowed": {
    "en": "Behemoth worm corpse burrowed",
    "zh": "被埋的巨兽型沙虫尸体"
   },
   "defender": {
    "en": "Defender",
    "zh": "防御无人机"
   },
   "distractor": {
    "en": "Distractor",
    "zh": "掩护无人机"
   },
   "destroyer": {
    "en": "Destroyer",
    "zh": "进攻无人机"
   },
   "poison-cloud": {
    "en": "Poison cloud",
    "zh": "毒雾"
   },
   "small-remnants": {
    "en": "Small remnants",
    "zh": "小型残骸"
   },
   "medium-remnants": {
    "en": "Medium remnants",
    "zh": "中型残骸"
   },
   "medium-small-remnants": {
    "en": "Medium small remnants",
    "zh": "中小型残骸"
   },
   "big-remnants": {
    "en": "Big remnants",
    "zh": "大型残骸"
   },
   "1x2-remnants": {
    "en": "1x2 remnants",
    "zh": "1x2残骸"
   },
   "small-scorchmark": {
    "en": "Small scorchmark",
    "zh": "小型焦痕"
   },
   "small-scorchmark-tintable": {
    "en": "Small tinted scorchmark",
    "zh": "小型着色焦痕"
   },
   "medium-scorchmark": {
    "en": "Medium scorchmark",
    "zh": "中型焦痕"
   },
   "medium-scorchmark-tintable": {
    "en": "Medium tinted scorchmark",
    "zh": "中型着色焦痕"
   },
   "big-scorchmark": {
    "en": "Big scorchmark",
    "zh": "大型焦痕"
   },
   "big-scorchmark-tintable": {
    "en": "Big tinted scorchmark",
    "zh": "大型着色焦痕"
   },
   "huge-scorchmark": {
    "en": "Huge scorchmark",
    "zh": "巨型焦痕"
   },
   "huge-scorchmark-tintable": {
    "en": "Huge tinted scorchmark",
    "zh": "巨型着色焦痕"
   },
   "storage-tank": {
    "en": "Storage tank",
    "zh": "储液罐"
   },
   "pumpjack": {
    "en": "Pumpjack",
    "zh": "抽油机"
   },
   "crude-oil": {
    "en": "Crude oil",
    "zh": "原油"
   },
   "tree": {
    "en": "Tree",
    "zh": "树木"
   },
   "tree-red": {
    "en": "Red tree",
    "zh": "红树"
   },
   "tree-brown": {
    "en": "Brown tree",
    "zh": "棕树"
   },
   "tree-stump": {
    "en": "Tree stump",
    "zh": "树桩"
   },
   "dead-tree-desert": {
    "en": "Dead tree - desert",
    "zh": "荒漠枯树"
   },
   "dry-tree": {
    "en": "Dry tree",
    "zh": "枯树"
   },
   "dead-grey-trunk": {
    "en": "Dead grey trunk",
    "zh": "灰色枯树干"
   },
   "dry-hairy-tree": {
    "en": "Dry hairy tree",
    "zh": "枯枝树"
   },
   "dead-dry-hairy-tree": {
    "en": "Dead dry hairy tree",
    "zh": "死枯枝树"
   },
   "green-coral": {
    "en": "Green coral",
    "zh": "绿色珊瑚"
   },
   "deconstructible-tile-proxy": {
    "en": "Deconstructible tile proxy",
    "zh": "替代地貌"
   },
   "item-request-proxy": {
    "en": "Item request slot",
    "zh": "需求物品"
   },
   "electric-energy-interface": {
    "en": "Electric energy interface",
    "zh": "电力接口"
   },
   "heat-interface": {
    "en": "Heat interface",
    "zh": "热力接口"
   },
   "burner-generator": {
    "en": "Burner generator",
    "zh": "热能发电机"
   },
   "simple-entity-with-force": {
    "en": "Simple entity with force",
    "zh": "阵营的简单实体"
   },
   "simple-entity-with-owner": {
    "en": "Simple entity with owner",
    "zh": "个人的简单实体"
   },
   "tile-ghost": {
    "en": "Tile ghost",
    "zh": "地格虚影"
   },
   "entity-ghost": {
    "en": "Entity ghost",
    "zh": "实体虚影"
   },
   "nuclear-reactor": {
    "en": "Nuclear reactor",
    "zh": "核反应堆"
   },
   "nuke-explosion": {
    "en": "Nuclear explosion",
    "zh": "核爆"
   },
   "huge-rock": {
    "en": "Huge rock",
    "zh": "巨型岩石"
   },
   "big-rock": {
    "en": "Big rock",
    "zh": "大型岩石"
   },
   "big-sand-rock": {
    "en": "Big sand rock",
    "zh": "大型沙岩"
   },
   "character-corpse": {
    "en": "Character corpse",
    "zh": "玩家尸体"
   },
   "red-chest": {
    "en": "Red chest",
    "zh": "红箱"
   },
   "blue-chest": {
    "en": "Blue chest",
    "zh": "蓝箱"
   },
   "infinity-cargo-wagon": {
    "en": "Infinity cargo wagon",
    "zh": "永续车厢"
   },
   "infinity-chest": {
    "en": "Infinity chest",
    "zh": "永续箱"
   },
   "linked-chest": {
    "en": "Linked chest",
    "zh": "关联箱"
   },
   "proxy-container": {
    "en": "Proxy container",
    "zh": "代理箱"
   },
   "bottomless-chest": {
    "en": "Bottomless chest",
    "zh": "无底箱"
   },
   "linked-belt": {
    "en": "Linked belt",
    "zh": "关联带"
   },
   "infinity-pipe": {
    "en": "Infinity pipe",
    "zh": "永续管"
   },
   "crash-site-chest-1": {
    "en": "Chest capsule",
    "zh": "货舱"
   },
   "crash-site-chest-2": {
    "en": "Chest capsule",
    "zh": "货舱"
   },
   "crash-site-spaceship": {
    "en": "Spaceship",
    "zh": "飞船"
   },
   "crash-site-spaceship-wreck-big": {
    "en": "Big spaceship wreck",
    "zh": "大型宇宙飞船残骸"
   },
   "crash-site-spaceship-wreck-medium": {
    "en": "Medium spaceship wreck",
    "zh": "中型宇宙飞船残骸"
   },
   "crash-site-spaceship-wreck-small": {
    "en": "Small spaceship wreck",
    "zh": "小型宇宙飞船残骸"
   },
   "crash-site-fire-flame": {
    "en": "Crash site fire flame",
    "zh": "坠机点火焰"
   },
   "fire-flame": {
    "en": "Fire",
    "zh": "火焰"
   },
   "acid-splash": {
    "en": "Acid splash",
    "zh": "酸液"
   },
   "explosion": {
    "en": "Explosion",
    "zh": "爆炸"
   },
   "explosion-hit": {
    "en": "Explosion hit",
    "zh": "爆炸冲击"
   },
   "big-explosion": {
    "en": "Big explosion",
    "zh": "大型爆炸"
   },
   "medium-explosion": {
    "en": "Medium explosion",
    "zh": "中型爆炸"
   },
   "grenade-explosion": {
    "en": "Grenade explosion",
    "zh": "手雷爆炸"
   },
   "massive-explosion": {
    "en": "Massive explosion",
    "zh": "巨型爆炸"
   },
   "ground-explosion": {
    "en": "Ground explosion",
    "zh": "地面爆炸"
   },
   "blood-explosion-small": {
    "en": "Blood explosion small",
    "zh": "小型血液爆炸"
   },
   "blood-explosion-big": {
    "en": "Blood explosion big",
    "zh": "大型血液爆炸"
   },
   "blood-explosion-huge": {
    "en": "Blood explosion huge",
    "zh": "巨型血液爆炸"
   },
   "blood-fountain": {
    "en": "Blood fountain",
    "zh": "血泉"
   },
   "blood-fountain-big": {
    "en": "Blood fountain big",
    "zh": "大型血泉"
   },
   "blood-fountain-hit-spray": {
    "en": "Blood fountain hit spray",
    "zh": "血泉喷溅"
   },
   "laser-bubble": {
    "en": "Laser bubble",
    "zh": "激光气泡"
   },
   "big-artillery-explosion": {
    "en": "Big artillery explosion",
    "zh": "大型重炮爆炸"
   },
   "water-splash": {
    "en": "Water splash",
    "zh": "水花"
   },
   "spark-explosion": {
    "en": "Spark explosion",
    "zh": "火花爆炸"
   },
   "spark-explosion-higher": {
    "en": "Spark explosion higher",
    "zh": "更大火花爆炸"
   },
   "wall-damaged-explosion": {
    "en": "Wall damaged explosion",
    "zh": "墙壁受损爆炸"
   },
   "rock-damaged-explosion": {
    "en": "Rock damaged explosion",
    "zh": "岩石受损爆炸"
   },
   "enemy-damaged-explosion": {
    "en": "Enemy damaged explosion",
    "zh": "敌方受损爆炸"
   },
   "flying-robot-damaged-explosion": {
    "en": "Flying robot damaged explosion",
    "zh": "飞行机器人受损爆炸"
   },
   "uranium-cannon-shell-explosion": {
    "en": "Uranium cannon shell explosion",
    "zh": "贫铀炮弹爆炸"
   },
   "spidertron-leg": {
    "en": "Spidertron leg",
    "zh": "蜘蛛机甲腿"
   },
   "factorio-logo-11tiles": {
    "en": "Factorio logo 11 tiles",
    "zh": "Factorio徽标11格"
   },
   "factorio-logo-16tiles": {
    "en": "Factorio logo 16 tiles",
    "zh": "Factorio徽标16格"
   },
   "factorio-logo-22tiles": {
    "en": "Factorio logo 22 tiles",
    "zh": "Factorio徽标22格"
   },
   "straight-rail": {
    "en": "Straight rail",
    "zh": "直线铁轨"
   },
   "half-diagonal-rail": {
    "en": "Half diagonal rail",
    "zh": "半对角铁轨"
   },
   "curved-rail-a": {
    "en": "Curved rail",
    "zh": "曲线铁轨"
   },
   "curved-rail-b": {
    "en": "Curved rail",
    "zh": "曲线铁轨"
   },
   "entity-unknown": {
    "en": "Unknown entity",
    "zh": "未知实体"
   },
   "rail-ramp": {
    "en": "Rail ramp",
    "zh": "铁路斜坡"
   },
   "rail-ramp-remnants": {
    "en": "Rail ramp remnants",
    "zh": "铁路斜坡残骸"
   },
   "elevated-straight-rail": {
    "en": "Elevated straight rail",
    "zh": "高架直轨"
   },
   "elevated-half-diagonal-rail": {
    "en": "Elevated half diagonal rail",
    "zh": "高架半斜轨"
   },
   "elevated-curved-rail-a": {
    "en": "Elevated curved rail",
    "zh": "高架曲轨"
   },
   "elevated-curved-rail-b": {
    "en": "Elevated curved rail",
    "zh": "高架曲轨"
   },
   "rail-support": {
    "en": "Rail support",
    "zh": "铁路支架"
   },
   "rail-support-remnants": {
    "en": "Rail support remnants",
    "zh": "铁路支架残骸"
   },
   "elevated-rail-remnants": {
    "en": "Elevated rail remnants",
    "zh": "高架铁路残骸"
   },
   "recycler": {
    "en": "Recycler",
    "zh": "回收机"
   },
   "vulcanus-chimney": {
    "en": "Chimney vent",
    "zh": "烟囱口"
   },
   "vulcanus-chimney-faded": {
    "en": "Faded chimney vent",
    "zh": "消褪的烟囱口"
   },
   "vulcanus-chimney-cold": {
    "en": "Extinct chimney vent",
    "zh": "熄灭的烟囱口"
   },
   "vulcanus-chimney-short": {
    "en": "Short chimney",
    "zh": "短小烟囱"
   },
   "vulcanus-chimney-truncated": {
    "en": "Truncated chimney",
    "zh": "截断烟囱"
   },
   "huge-volcanic-rock": {
    "en": "Huge volcanic rock",
    "zh": "巨型火山岩"
   },
   "huge-volcanic-rock-hot": {
    "en": "Huge hot volcanic rock",
    "zh": "巨型热火山岩"
   },
   "big-volcanic-rock": {
    "en": "Big volcanic rock",
    "zh": "大型火山岩"
   },
   "big-volcanic-rock-hot": {
    "en": "Big hot volcanic rock",
    "zh": "大型热火山岩"
   },
   "boompuff-explosion": {
    "en": "Boompuff",
    "zh": "高爆泡泡"
   },
   "biochamber": {
    "en": "Biochamber",
    "zh": "生物室"
   },
   "scrap": {
    "en": "Scrap",
    "zh": "废料"
   },
   "fulgoran-ruin-attractor": {
    "en": "Fulgoran lightning attractor",
    "zh": "雷神引雷器"
   },
   "fulgoran-ruin-stonehenge": {
    "en": "Big Fulgoran ruin",
    "zh": "大型雷神废墟"
   },
   "fulgoran-ruin-vault": {
    "en": "Fulgoran vault ruin",
    "zh": "雷神地宫废墟"
   },
   "fulgoran-ruin-colossal": {
    "en": "Colossal Fulgoran ruin",
    "zh": "恢弘雷神废墟"
   },
   "fulgoran-ruin-huge": {
    "en": "Huge Fulgoran ruin",
    "zh": "巨型雷神废墟"
   },
   "fulgoran-ruin-big": {
    "en": "Big Fulgoran ruin",
    "zh": "大型雷神废墟"
   },
   "fulgoran-ruin-medium": {
    "en": "Medium Fulgoran ruin",
    "zh": "中型雷神废墟"
   },
   "fulgoran-ruin-small": {
    "en": "Small Fulgoran ruin",
    "zh": "小型雷神废墟"
   },
   "fulgora-sunk-ruin-big": {
    "en": "Big flooded fulgoran ruin",
    "zh": "大型浸没雷神废墟"
   },
   "fulgora-sunk-ruin-medium-tall": {
    "en": "Medium flooded fulgoran ruin",
    "zh": "中型浸没雷神废墟"
   },
   "fulgurite": {
    "en": "Fulgorite",
    "zh": "雷击石"
   },
   "fulgurite-small": {
    "en": "Fulgorite pieces",
    "zh": "雷击石碎片"
   },
   "turbo-loader": {
    "en": "Turbo loader",
    "zh": "超速装卸机"
   },
   "space-platform-hub": {
    "en": "Space platform hub",
    "zh": "太空平台枢纽"
   },
   "cargo-bay": {
    "en": "Cargo bay",
    "zh": "接驳扩展仓"
   },
   "landing-pad-unloading-bay": {
    "en": "Landing pad unloading bay",
    "zh": "接驳卸货仓"
   },
   "cargo-bay-remnants": {
    "en": "Cargo bay remnants",
    "zh": "接驳扩展仓残骸"
   },
   "tungsten-ore": {
    "en": "Tungsten ore",
    "zh": "钨矿"
   },
   "calcite": {
    "en": "Calcite",
    "zh": "方解石"
   },
   "sulfuric-acid-geyser": {
    "en": "Sulfuric acid geyser",
    "zh": "硫酸喷泉"
   },
   "fluorine-vent": {
    "en": "Fluorine vent",
    "zh": "氟气喷口"
   },
   "lithium-brine": {
    "en": "Lithium brine",
    "zh": "锂盐水"
   },
   "big-mining-drill": {
    "en": "Big mining drill",
    "zh": "大型采矿机"
   },
   "big-mining-drill-remnants": {
    "en": "Big mining drill remnants",
    "zh": "大型采矿机残骸"
   },
   "agricultural-tower": {
    "en": "Agricultural tower",
    "zh": "农业塔"
   },
   "asteroid-collector": {
    "en": "Asteroid collector",
    "zh": "星岩抓取臂"
   },
   "huge-metallic-asteroid": {
    "en": "Huge metallic asteroid",
    "zh": "巨型金属星岩"
   },
   "big-metallic-asteroid": {
    "en": "Big metallic asteroid",
    "zh": "大型金属星岩"
   },
   "medium-metallic-asteroid": {
    "en": "Medium metallic asteroid",
    "zh": "中型金属星岩"
   },
   "small-metallic-asteroid": {
    "en": "Small metallic asteroid",
    "zh": "小型金属星岩"
   },
   "huge-carbonic-asteroid": {
    "en": "Huge carbonic asteroid",
    "zh": "巨型碳质星岩"
   },
   "big-carbonic-asteroid": {
    "en": "Big carbonic asteroid",
    "zh": "大型碳质星岩"
   },
   "medium-carbonic-asteroid": {
    "en": "Medium carbonic asteroid",
    "zh": "中型碳质星岩"
   },
   "small-carbonic-asteroid": {
    "en": "Small carbonic asteroid",
    "zh": "小型碳质星岩"
   },
   "huge-oxide-asteroid": {
    "en": "Huge oxide asteroid",
    "zh": "巨型氧化星岩"
   },
   "big-oxide-asteroid": {
    "en": "Big oxide asteroid",
    "zh": "大型氧化星岩"
   },
   "medium-oxide-asteroid": {
    "en": "Medium oxide asteroid",
    "zh": "中型氧化星岩"
   },
   "small-oxide-asteroid": {
    "en": "Small oxide asteroid",
    "zh": "小型氧化星岩"
   },
   "huge-promethium-asteroid": {
    "en": "Huge promethium asteroid",
    "zh": "巨型钷星岩"
   },
   "big-promethium-asteroid": {
    "en": "Big promethium asteroid",
    "zh": "大型钷星岩"
   },
   "medium-promethium-asteroid": {
    "en": "Medium promethium asteroid",
    "zh": "中型钷星岩"
   },
   "small-promethium-asteroid": {
    "en": "Small promethium asteroid",
    "zh": "小型钷星岩"
   },
   "captive-biter-spawner": {
    "en": "Captive biter spawner",
    "zh": "虫巢孵化器"
   },
   "biolab": {
    "en": "Biolab",
    "zh": "生物研究中心"
   },
   "capture-robot": {
    "en": "Capture bot",
    "zh": "捕获机器人"
   },
   "capture-robot-rocket": {
    "en": "Capture bot rocket",
    "zh": "捕获者火箭弹"
   },
   "crusher": {
    "en": "Crusher",
    "zh": "破碎机"
   },
   "cryogenic-plant": {
    "en": "Cryogenic plant",
    "zh": "低温工厂"
   },
   "electromagnetic-plant": {
    "en": "Electromagnetic plant",
    "zh": "电磁工厂"
   },
   "foundry": {
    "en": "Foundry",
    "zh": "铸造厂"
   },
   "fusion-reactor": {
    "en": "Fusion reactor",
    "zh": "聚变反应堆"
   },
   "heating-tower": {
    "en": "Heating tower",
    "zh": "供热塔"
   },
   "lightning": {
    "en": "Lightning",
    "zh": "闪电"
   },
   "lightning-collector": {
    "en": "Lightning collector",
    "zh": "闪电捕捉器"
   },
   "lightning-rod": {
    "en": "Lightning rod",
    "zh": "避雷针"
   },
   "railgun-turret": {
    "en": "Railgun turret",
    "zh": "磁轨炮塔"
   },
   "thruster": {
    "en": "Thruster",
    "zh": "推进器"
   },
   "tesla-turret": {
    "en": "Tesla turret",
    "zh": "特斯拉炮塔"
   },
   "tesla-turret-stun": {
    "en": "Tesla turret stun",
    "zh": "特斯拉炮塔眩晕"
   },
   "tesla-turret-slow": {
    "en": "Tesla turret slow",
    "zh": "特斯拉炮塔减速"
   },
   "turbo-transport-belt": {
    "en": "Turbo transport belt",
    "zh": "超速传送带"
   },
   "turbo-underground-belt": {
    "en": "Turbo underground belt",
    "zh": "超速地下传送带"
   },
   "turbo-splitter": {
    "en": "Turbo splitter",
    "zh": "超速分流器"
   },
   "crater-cliff": {
    "en": "Crater edge",
    "zh": "陨坑边缘"
   },
   "cliff-vulcanus": {
    "en": "Vulcanus cliff",
    "zh": "祝融星悬崖"
   },
   "cliff-gleba": {
    "en": "Gleba cliff",
    "zh": "句芒星悬崖"
   },
   "cliff-fulgora": {
    "en": "Plateau edge",
    "zh": "高原边缘"
   },
   "slipstack": {
    "en": "Slipstack",
    "zh": "黏叠珊瑚"
   },
   "cuttlepop": {
    "en": "Cuttlepop",
    "zh": "长须孢菌"
   },
   "sunnycomb": {
    "en": "Sunnycomb",
    "zh": "阳绵壳衣"
   },
   "teflilly": {
    "en": "Teflilly",
    "zh": "赤冠铁葵"
   },
   "yumako-tree": {
    "en": "Yumako tree",
    "zh": "玉玛果树"
   },
   "boompuff": {
    "en": "Boompuff",
    "zh": "高爆泡泡"
   },
   "funneltrunk": {
    "en": "Funneltrunk",
    "zh": "漏斗茎蕈"
   },
   "hairyclubnub": {
    "en": "Hairy clubnub",
    "zh": "毛根木菌"
   },
   "jellystem": {
    "en": "Jellystem",
    "zh": "果冻茎株"
   },
   "lickmaw": {
    "en": "Lickmaw",
    "zh": "粘魂精"
   },
   "stingfrond": {
    "en": "Stingfrond",
    "zh": "钩叶棘藓"
   },
   "ashland-lichen-tree": {
    "en": "Ashland tree",
    "zh": "灰烬木"
   },
   "ashland-lichen-tree-flaming": {
    "en": "Flaming ashland tree",
    "zh": "永燃木"
   },
   "rocket-turret": {
    "en": "Rocket turret",
    "zh": "火箭炮塔"
   },
   "lithium-iceberg-huge": {
    "en": "Huge lithium ice formation",
    "zh": "巨型锂冰岩"
   },
   "lithium-iceberg-big": {
    "en": "Big lithium ice formation",
    "zh": "大型锂冰岩"
   },
   "gleba-spawner": {
    "en": "Egg raft",
    "zh": "卵筏"
   },
   "gleba-spawner-small": {
    "en": "Small egg raft",
    "zh": "小卵筏"
   },
   "gleba-spawner-corpse": {
    "en": "Gleba spawner corpse",
    "zh": "句芒星虫巢尸体"
   },
   "gleba-spawner-corpse-small": {
    "en": "Small Gleba spawner corpse",
    "zh": "句芒星小型虫巢尸体"
   },
   "small-stomper-pentapod": {
    "en": "Small stomper pentapod",
    "zh": "小型重踏五足虫"
   },
   "small-strafer-pentapod": {
    "en": "Small strafer pentapod",
    "zh": "小型飞弹五足虫"
   },
   "small-wriggler-pentapod": {
    "en": "Small wriggler pentapod",
    "zh": "小型蠕动五足虫"
   },
   "small-wriggler-pentapod-corpse": {
    "en": "Small wriggler pentapod corpse",
    "zh": "小型蠕动五足虫尸体"
   },
   "small-wriggler-pentapod-premature": {
    "en": "Small premature wriggler pentapod",
    "zh": "小型早衰蠕动五足虫"
   },
   "medium-stomper-pentapod": {
    "en": "Medium stomper pentapod",
    "zh": "中型重踏五足虫"
   },
   "medium-strafer-pentapod": {
    "en": "Medium strafer pentapod",
    "zh": "中型飞弹五足虫"
   },
   "medium-wriggler-pentapod": {
    "en": "Medium wriggler pentapod",
    "zh": "中型蠕动五足虫"
   },
   "medium-wriggler-pentapod-corpse": {
    "en": "Medium wriggler pentapod corpse",
    "zh": "中型蠕动五足虫尸体"
   },
   "medium-wriggler-pentapod-premature": {
    "en": "Medium premature wriggler pentapod",
    "zh": "中型早衰蠕动五足虫"
   },
   "big-stomper-pentapod": {
    "en": "Big stomper pentapod",
    "zh": "大型重踏五足虫"
   },
   "big-strafer-pentapod": {
    "en": "Big strafer pentapod",
    "zh": "大型飞弹五足虫"
   },
   "big-wriggler-pentapod": {
    "en": "Big wriggler pentapod",
    "zh": "大型蠕动五足虫"
   },
   "big-wriggler-pentapod-corpse": {
    "en": "Big wriggler pentapod corpse",
    "zh": "大型蠕动五足虫尸体"
   },
   "big-wriggler-pentapod-premature": {
    "en": "Big premature wriggler pentapod",
    "zh": "大型早衰蠕动五足虫"
   },
   "small-stomper-corpse": {
    "en": "Small stomper pentapod corpse",
    "zh": "小型重踏五足虫尸体"
   },
   "medium-stomper-corpse": {
    "en": "Medium stomper pentapod corpse",
    "zh": "中型重踏五足虫尸体"
   },
   "big-stomper-corpse": {
    "en": "Big stomper pentapod corpse",
    "zh": "大型重踏五足虫尸体"
   },
   "small-strafer-corpse": {
    "en": "Small strafer pentapod corpse",
    "zh": "小型飞弹五足虫尸体"
   },
   "medium-strafer-corpse": {
    "en": "Medium strafer pentapod corpse",
    "zh": "中型飞弹五足虫尸体"
   },
   "big-strafer-corpse": {
    "en": "Big strafer pentapod corpse",
    "zh": "大型飞弹五足虫尸体"
   },
   "small-stomper-shell": {
    "en": "Small stomper pentapod shell",
    "zh": "小型重踏五足虫背壳"
   },
   "medium-stomper-shell": {
    "en": "Medium stomper pentapod shell",
    "zh": "中型重踏五足虫背壳"
   },
   "big-stomper-shell": {
    "en": "Big stomper pentapod shell",
    "zh": "大型重踏五足虫背壳"
   },
   "leg": {
    "en": "Leg",
    "zh": "腿"
   },
   "fusion-generator": {
    "en": "Fusion generator",
    "zh": "聚变发电机"
   },
   "stack-inserter": {
    "en": "Stack inserter",
    "zh": "堆叠机械臂"
   },
   "big-fulgora-rock": {
    "en": "Big Fulgora rock",
    "zh": "雷神星大型岩石"
   },
   "small-demolisher": {
    "en": "Small demolisher",
    "zh": "小型撼地虫"
   },
   "medium-demolisher": {
    "en": "Medium demolisher",
    "zh": "中型撼地虫"
   },
   "big-demolisher": {
    "en": "Big demolisher",
    "zh": "大型撼地虫"
   },
   "demolisher-segment": {
    "en": "__1__ segment",
    "zh": "__1__肢节"
   },
   "demolisher-tail": {
    "en": "__1__ tail",
    "zh": "__1__尾部"
   },
   "demolisher-corpse": {
    "en": "__1__ remains",
    "zh": "__1__残骸"
   },
   "demolisher-ash-cloud": {
    "en": "__1__ ash cloud",
    "zh": "__1__灰云"
   },
   "demolisher-expanding-ash-cloud": {
    "en": "__1__ expanding ash cloud __2__",
    "zh": "__1__不断扩大的灰云__2__"
   },
   "demolisher-ash-cloud-visual-dummy": {
    "en": "Demolisher ash cloud (visual dummy)",
    "zh": "撼地虫灰云（视觉假象）"
   },
   "demolisher-fissure": {
    "en": "__1__ erupting fissure",
    "zh": "__1__喷发裂缝"
   },
   "demolisher-fissure-scorchmark": {
    "en": "__1__ fissure scorchmark",
    "zh": "__1__裂缝焦痕"
   },
   "demolisher-fissure-explosion": {
    "en": "__1__ fissure explosion",
    "zh": "__1__裂隙爆炸"
   },
   "demolisher-fissure-damage-explosion": {
    "en": "__1__ fissure explosion damage",
    "zh": "__1__裂隙爆炸伤害"
   },
   "demolisher-ash-cloud-trail": {
    "en": "__1__ ash cloud trail",
    "zh": "__1__灰云痕迹"
   },
   "demolisher-trail-upper": {
    "en": "__1__ trail upper",
    "zh": "__1__上部痕迹"
   },
   "demolisher-trail-lower": {
    "en": "__1__ trail lower",
    "zh": "__1__下部痕迹"
   },
   "vulcanus-cliff-collapse": {
    "en": "Vulcanus cliff collapse",
    "zh": "祝融星悬崖崩塌"
   },
   "iron-stromatolite": {
    "en": "Iron stromatolite",
    "zh": "铁叠层石"
   },
   "copper-stromatolite": {
    "en": "Copper stromatolite",
    "zh": "铜叠层石"
   },
   "water-cane": {
    "en": "Water cane",
    "zh": "水竹"
   },
   "wube-logo-space-platform": {
    "en": "Wube logo (space platform)",
    "zh": "Wube徽标（太空平台）"
   }
  },
  "recipe-name": {
   "parameter-1": {
    "en": "Parameter 1",
    "zh": "参数 1"
   },
   "parameter-2": {
    "en": "Parameter 2",
    "zh": "参数 2"
   },
   "basic-oil-processing": {
    "en": "Basic oil processing",
    "zh": "基础原油处理"
   },
   "advanced-oil-processing": {
    "en": "Advanced oil processing",
    "zh": "高等原油处理"
   },
   "empty-crude-oil-barrel": {
    "en": "Empty crude oil barrel",
    "zh": "倒出原油"
   },
   "light-oil-cracking": {
    "en": "Light oil cracking to petroleum gas",
    "zh": "轻油裂解"
   },
   "heavy-oil-cracking": {
    "en": "Heavy oil cracking to light oil",
    "zh": "重油裂解"
   },
   "uranium-processing": {
    "en": "Uranium processing",
    "zh": "铀浓缩处理"
   },
   "kovarex-enrichment-process": {
    "en": "Kovarex enrichment process",
    "zh": "铀增殖处理"
   },
   "nuclear-fuel-reprocessing": {
    "en": "Nuclear fuel reprocessing",
    "zh": "乏燃料后处理"
   },
   "empty-filled-barrel": {
    "en": "Empty __1__ barrel",
    "zh": "倾倒__1__桶"
   },
   "fill-barrel": {
    "en": "Fill __1__ barrel",
    "zh": "灌装__1__桶"
   },
   "coal-liquefaction": {
    "en": "Coal liquefaction",
    "zh": "煤炭液化"
   },
   "solid-fuel-from-light-oil": {
    "en": "Solid fuel from light oil",
    "zh": "轻油制固体燃料"
   },
   "solid-fuel-from-heavy-oil": {
    "en": "Solid fuel from heavy oil",
    "zh": "重油制固体燃料"
   },
   "solid-fuel-from-petroleum-gas": {
    "en": "Solid fuel from petroleum gas",
    "zh": "石油气制固体燃料"
   },
   "recipe-unknown": {
    "en": "Unknown recipe",
    "zh": "未知配方"
   },
   "recycling": {
    "en": "__1__ recycling",
    "zh": "__1__（回收）"
   },
   "molten-iron-from-lava": {
    "en": "Molten iron from lava",
    "zh": "岩浆制熔融铁"
   },
   "molten-copper-from-lava": {
    "en": "Molten copper from lava",
    "zh": "岩浆制熔融铜"
   },
   "iron-ore-melting": {
    "en": "Iron ore melting",
    "zh": "铁矿制熔融铁"
   },
   "copper-ore-melting": {
    "en": "Copper ore melting",
    "zh": "铜矿制熔融铜"
   },
   "yumako-processing": {
    "en": "Yumako processing",
    "zh": "玉玛果加工"
   },
   "rocket-fuel-from-jelly": {
    "en": "Rocket fuel from jelly",
    "zh": "果冻制火箭燃料"
   },
   "jellynut-processing": {
    "en": "Jellynut processing",
    "zh": "果冻果加工"
   },
   "iron-bacteria": {
    "en": "Iron bacteria",
    "zh": "铁细菌"
   },
   "iron-bacteria-cultivation": {
    "en": "Iron bacteria cultivation",
    "zh": "铁细菌培养"
   },
   "copper-bacteria": {
    "en": "Copper bacteria",
    "zh": "铜细菌"
   },
   "copper-bacteria-cultivation": {
    "en": "Copper bacteria cultivation",
    "zh": "铜细菌培养"
   },
   "burnt-spoilage": {
    "en": "Burnt spoilage",
    "zh": "燃烧变质物"
   },
   "nutrients-from-spoilage": {
    "en": "Nutrients from spoilage",
    "zh": "变质物制营养素"
   },
   "nutrients-from-yumako-mash": {
    "en": "Nutrients from yumako mash",
    "zh": "玉玛果泥制营养素"
   },
   "nutrients-from-bioflux": {
    "en": "Nutrients from bioflux",
    "zh": "生物结晶制营养素"
   },
   "nutrients-from-fish": {
    "en": "Nutrients from fish",
    "zh": "鲜鱼制营养素"
   },
   "nutrients-from-biter-egg": {
    "en": "Nutrients from biter egg",
    "zh": "异虫卵制营养素"
   },
   "biosulfur": {
    "en": "Biosulfur",
    "zh": "生物硫磺"
   },
   "biolubricant": {
    "en": "Biolubricant",
    "zh": "生物润滑油"
   },
   "fish-breeding": {
    "en": "Fish breeding",
    "zh": "养鱼"
   },
   "simple-coal-liquefaction": {
    "en": "Simple coal liquefaction",
    "zh": "简易煤炭液化"
   },
   "coal-synthesis": {
    "en": "Coal synthesis",
    "zh": "煤合成"
   },
   "advanced-metallic-asteroid-crushing": {
    "en": "Advanced metallic asteroid crushing",
    "zh": "高级金属星岩粉碎"
   },
   "advanced-carbonic-asteroid-crushing": {
    "en": "Advanced carbonic asteroid crushing",
    "zh": "高级碳质星岩粉碎"
   },
   "advanced-oxide-asteroid-crushing": {
    "en": "Advanced oxide asteroid crushing",
    "zh": "高级氧化星岩粉碎"
   },
   "ice-melting": {
    "en": "Ice melting",
    "zh": "融冰"
   },
   "metallic-asteroid-crushing": {
    "en": "Metallic asteroid crushing",
    "zh": "金属星岩粉碎"
   },
   "metallic-asteroid-reprocessing": {
    "en": "Metallic asteroid reprocessing",
    "zh": "金属星岩再处理"
   },
   "carbonic-asteroid-crushing": {
    "en": "Carbonic asteroid crushing",
    "zh": "碳质星岩粉碎"
   },
   "carbonic-asteroid-reprocessing": {
    "en": "Carbonic asteroid reprocessing",
    "zh": "碳质星岩再处理"
   },
   "oxide-asteroid-crushing": {
    "en": "Oxide asteroid crushing",
    "zh": "氧化星岩粉碎"
   },
   "oxide-asteroid-reprocessing": {
    "en": "Oxide asteroid reprocessing",
    "zh": "氧化星岩再处理"
   },
   "fluoroketone": {
    "en": "Fluoroketone",
    "zh": "氟酮"
   },
   "fluoroketone-cooling": {
    "en": "Cooling hot fluoroketone",
    "zh": "热氟酮冷却"
   },
   "bioplastic": {
    "en": "Bioplastic",
    "zh": "生物塑料"
   },
   "acid-neutralisation": {
    "en": "Acid neutralisation",
    "zh": "酸中和"
   },
   "ammoniacal-solution-separation": {
    "en": "Ammoniacal solution separation",
    "zh": "氨溶液分离"
   },
   "solid-fuel-from-ammonia": {
    "en": "Solid fuel from ammonia",
    "zh": "氨制固体燃料"
   },
   "advanced-thruster-fuel": {
    "en": "Advanced thruster fuel",
    "zh": "高级推进器燃料"
   },
   "advanced-thruster-oxidizer": {
    "en": "Advanced thruster oxidizer",
    "zh": "高级推进器氧化剂"
   },
   "concrete-from-molten-iron": {
    "en": "Concrete from molten iron",
    "zh": "熔融铁制混凝土"
   },
   "casting-low-density-structure": {
    "en": "Casting low density structure",
    "zh": "浇铸轻质框架"
   },
   "casting-iron": {
    "en": "Casting iron",
    "zh": "浇铸铁"
   },
   "casting-steel": {
    "en": "Casting steel",
    "zh": "浇铸钢"
   },
   "casting-copper": {
    "en": "Casting copper",
    "zh": "浇铸铜"
   },
   "casting-iron-gear-wheel": {
    "en": "Casting iron gear wheel",
    "zh": "浇铸铁齿轮"
   },
   "casting-iron-stick": {
    "en": "Casting iron stick",
    "zh": "浇铸铁棒"
   },
   "casting-pipe": {
    "en": "Casting pipe",
    "zh": "浇铸管道"
   },
   "casting-pipe-to-ground": {
    "en": "Casting pipe to ground",
    "zh": "浇铸地下管道"
   },
   "casting-copper-cable": {
    "en": "Casting copper cable",
    "zh": "浇铸铜缆"
   },
   "steam-condensation": {
    "en": "Steam condensation",
    "zh": "蒸汽冷凝"
   },
   "scrap-recycling": {
    "en": "Scrap recycling",
    "zh": "废料回收"
   },
   "ammonia-rocket-fuel": {
    "en": "Ammonia rocket fuel",
    "zh": "氨制火箭燃料"
   }
  },
  "fluid-name": {
   "water": {
    "en": "Water",
    "zh": "水"
   },
   "steam": {
    "en": "Steam",
    "zh": "蒸汽"
   },
   "crude-oil": {
    "en": "Crude oil",
    "zh": "原油"
   },
   "light-oil": {
    "en": "Light oil",
    "zh": "轻油"
   },
   "heavy-oil": {
    "en": "Heavy oil",
    "zh": "重油"
   },
   "petroleum-gas": {
    "en": "Petroleum gas",
    "zh": "石油气"
   },
   "sulfuric-acid": {
    "en": "Sulfuric acid",
    "zh": "硫酸"
   },
   "lubricant": {
    "en": "Lubricant",
    "zh": "润滑油"
   },
   "fluid-unknown": {
    "en": "Unknown fluid",
    "zh": "未知流体"
   },
   "lava": {
    "en": "Lava",
    "zh": "岩浆"
   },
   "ammoniacal-solution": {
    "en": "Ammoniacal solution",
    "zh": "氨溶液"
   },
   "lithium-brine": {
    "en": "Lithium brine",
    "zh": "锂盐水"
   },
   "fluorine": {
    "en": "Fluorine",
    "zh": "氟"
   },
   "fluoroketone-cold": {
    "en": "Fluoroketone (Cold)",
    "zh": "氟酮（冷）"
   },
   "fluoroketone-hot": {
    "en": "Fluoroketone (Hot)",
    "zh": "氟酮（热）"
   },
   "ammonia": {
    "en": "Ammonia",
    "zh": "氨"
   },
   "molten-copper": {
    "en": "Molten copper",
    "zh": "熔融铜"
   },
   "molten-iron": {
    "en": "Molten iron",
    "zh": "熔融铁"
   },
   "holmium-solution": {
    "en": "Holmium solution",
    "zh": "钬溶液"
   },
   "electrolyte": {
    "en": "Electrolyte",
    "zh": "电解液"
   },
   "thruster-fuel": {
    "en": "Thruster fuel",
    "zh": "推进器燃料"
   },
   "thruster-oxidizer": {
    "en": "Thruster oxidizer",
    "zh": "推进器氧化剂"
   },
   "fusion-plasma": {
    "en": "Plasma",
    "zh": "等离子体"
   }
  },
  "equipment-name": {
   "equipment-ghost": {
    "en": "Equipment ghost",
    "zh": "装备虚影"
   },
   "energy-shield-equipment": {
    "en": "Energy shield",
    "zh": "能量盾模块"
   },
   "energy-shield-mk2-equipment": {
    "en": "Energy shield MK2",
    "zh": "能量盾模块 MK2"
   },
   "battery-equipment": {
    "en": "Personal battery",
    "zh": "电池组模块"
   },
   "battery-mk2-equipment": {
    "en": "Personal battery MK2",
    "zh": "电池组模块 MK2"
   },
   "solar-panel-equipment": {
    "en": "Portable solar panel",
    "zh": "太阳能模块"
   },
   "fission-reactor-equipment": {
    "en": "Portable fission reactor",
    "zh": "裂变反应堆模块"
   },
   "electric-energy-interface-equipment": {
    "en": "Electric energy interface equipment",
    "zh": "电力接口模块"
   },
   "personal-laser-defense-equipment": {
    "en": "Personal laser defense",
    "zh": "激光防御模块"
   },
   "discharge-defense-equipment": {
    "en": "Discharge defense",
    "zh": "放电防御模块"
   },
   "exoskeleton-equipment": {
    "en": "Exoskeleton",
    "zh": "外骨骼模块"
   },
   "night-vision-equipment": {
    "en": "Nightvision",
    "zh": "夜视模块"
   },
   "belt-immunity-equipment": {
    "en": "Belt immunity equipment",
    "zh": "锚定模块"
   },
   "personal-roboport-equipment": {
    "en": "Personal roboport",
    "zh": "机器人指令模块"
   },
   "personal-roboport-mk2-equipment": {
    "en": "Personal roboport MK2",
    "zh": "机器人指令模块 MK2"
   },
   "toolbelt-equipment": {
    "en": "Toolbelt equipment",
    "zh": "工具腰带模块"
   },
   "battery-mk3-equipment": {
    "en": "Personal battery MK3",
    "zh": "电池组模块 MK3"
   },
   "fusion-reactor-equipment": {
    "en": "Portable fusion reactor",
    "zh": "聚变反应堆模块"
   }
  },
  "tile-name": {
   "out-of-map": {
    "en": "Out of map",
    "zh": "地图外区域"
   },
   "landfill": {
    "en": "Landfill",
    "zh": "填埋材料"
   },
   "water": {
    "en": "Water",
    "zh": "水"
   },
   "deepwater": {
    "en": "Deep water",
    "zh": "深水"
   },
   "water-green": {
    "en": "Green water",
    "zh": "绿水"
   },
   "deepwater-green": {
    "en": "Deep green water",
    "zh": "深绿水"
   },
   "water-shallow": {
    "en": "Shallow water",
    "zh": "浅水"
   },
   "water-mud": {
    "en": "Marsh",
    "zh": "沼泽"
   },
   "sand-1": {
    "en": "Sand 1",
    "zh": "沙地 1"
   },
   "sand-2": {
    "en": "Sand 2",
    "zh": "沙地 2"
   },
   "sand-3": {
    "en": "Sand 3",
    "zh": "沙地 3"
   },
   "red-desert-0": {
    "en": "Red desert 0",
    "zh": "红漠 0"
   },
   "red-desert-1": {
    "en": "Red desert 1",
    "zh": "红漠 1"
   },
   "red-desert-2": {
    "en": "Red desert 2",
    "zh": "红漠 2"
   },
   "red-desert-3": {
    "en": "Red desert 3",
    "zh": "红漠 3"
   },
   "dirt-1": {
    "en": "Dirt 1",
    "zh": "泥地 1"
   },
   "dirt-2": {
    "en": "Dirt 2",
    "zh": "泥地 2"
   },
   "dirt-3": {
    "en": "Dirt 3",
    "zh": "泥地 3"
   },
   "dirt-4": {
    "en": "Dirt 4",
    "zh": "泥地 4"
   },
   "dirt-5": {
    "en": "Dirt 5",
    "zh": "泥地 5"
   },
   "dirt-6": {
    "en": "Dirt 6",
    "zh": "泥地 6"
   },
   "dirt-7": {
    "en": "Dirt 7",
    "zh": "泥地 7"
   },
   "dry-dirt": {
    "en": "Dry dirt",
    "zh": "干泥地"
   },
   "grass-1": {
    "en": "Grass",
    "zh": "草地"
   },
   "grass-2": {
    "en": "Grass 2",
    "zh": "草地 2"
   },
   "grass-3": {
    "en": "Grass 3",
    "zh": "草地 3"
   },
   "grass-4": {
    "en": "Grass 4",
    "zh": "草地 4"
   },
   "stone-path": {
    "en": "Stone path",
    "zh": "石砖路"
   },
   "concrete": {
    "en": "Concrete",
    "zh": "标准混凝土"
   },
   "hazard-concrete-left": {
    "en": "Hazard concrete left",
    "zh": "标准混凝土（左警戒）"
   },
   "hazard-concrete-right": {
    "en": "Hazard concrete right",
    "zh": "标准混凝土（右警戒）"
   },
   "refined-concrete": {
    "en": "Refined concrete",
    "zh": "钢筋混凝土"
   },
   "refined-hazard-concrete-left": {
    "en": "Refined hazard concrete left",
    "zh": "钢筋混凝土（左警戒）"
   },
   "refined-hazard-concrete-right": {
    "en": "Refined hazard concrete right",
    "zh": "钢筋混凝土（右警戒）"
   },
   "lab-dark-1": {
    "en": "Lab tile 1",
    "zh": "测试地格 1"
   },
   "lab-dark-2": {
    "en": "Lab tile 2",
    "zh": "测试地格 2"
   },
   "lab-white": {
    "en": "Lab white",
    "zh": "白色测试地格"
   },
   "tutorial-grid": {
    "en": "Tutorial grid",
    "zh": "教学网格地格"
   },
   "water-wube": {
    "en": "Water Wube",
    "zh": "Wube水"
   },
   "nuclear-ground": {
    "en": "Nuclear ground",
    "zh": "核爆地面"
   },
   "tile-unknown": {
    "en": "Unknown tile",
    "zh": "未知地格"
   },
   "lowland-olive-blubber-2": {
    "en": "Olive Blubber 2",
    "zh": "橄榄色脂地 2"
   },
   "lowland-olive-blubber-3": {
    "en": "Olive Blubber 3",
    "zh": "橄榄色脂地 3"
   },
   "lowland-brown-blubber": {
    "en": "Brown Blubber",
    "zh": "棕色脂地"
   },
   "lowland-pale-green": {
    "en": "Sickly Blubber",
    "zh": "苍白脂地"
   },
   "lowland-cream-cauliflower-2": {
    "en": "Cauliflower mold 2",
    "zh": "花椰菜松土 2"
   },
   "lowland-cream-red": {
    "en": "Cauliflower red mold",
    "zh": "红色花椰菜松土"
   },
   "lowland-dead-skin": {
    "en": "Deadskin mold",
    "zh": "枯皮松土"
   },
   "lowland-dead-skin-2": {
    "en": "Deadskin mold 2",
    "zh": "枯皮松土 2"
   },
   "lowland-red-vein-2": {
    "en": "Red vein bulges",
    "zh": "红脉隆起地形"
   },
   "lowland-red-vein-3": {
    "en": "Red vein dull",
    "zh": "暗红叶脉地形"
   },
   "lowland-red-vein-4": {
    "en": "Red vein bright",
    "zh": "鲜红叶脉地形"
   },
   "lowland-red-vein-dead": {
    "en": "Red vein dead",
    "zh": "褪色红脉地形"
   },
   "lowland-red-infection": {
    "en": "Red infection",
    "zh": "红腐之地"
   },
   "midland-cracked-lichen": {
    "en": "Cracked lichen",
    "zh": "裂缝地衣"
   },
   "midland-cracked-lichen-dull": {
    "en": "Cracked lichen dull",
    "zh": "裂缝地衣（暗淡）"
   },
   "midland-cracked-lichen-dark": {
    "en": "Cracked lichen dark",
    "zh": "裂缝地衣（深色）"
   },
   "midland-turquoise-bark-2": {
    "en": "Turquoise bark 2",
    "zh": "青绿树皮 2"
   },
   "midland-yellow-crust": {
    "en": "Orange crust lichen",
    "zh": "橙色地衣壳"
   },
   "midland-yellow-crust-2": {
    "en": "Red crust lichen",
    "zh": "红色地衣壳"
   },
   "midland-yellow-crust-3": {
    "en": "Beige crust lichen",
    "zh": "米色地衣壳"
   },
   "midland-yellow-crust-4": {
    "en": "Yellow crust lichen",
    "zh": "黄色地衣壳"
   },
   "highland-dark-rock-2": {
    "en": "Highland rock 2",
    "zh": "高原岩石 2"
   },
   "highland-yellow-rock": {
    "en": "Highland yellow rock",
    "zh": "高原黄岩"
   },
   "pit-rock": {
    "en": "Pit rock",
    "zh": "凹坑岩地"
   },
   "empty-space": {
    "en": "Empty space",
    "zh": "虚空"
   },
   "space-platform-foundation": {
    "en": "Space platform foundation",
    "zh": "太空平台基座"
   },
   "snow-flat": {
    "en": "Snow flat",
    "zh": "积雪平地"
   },
   "snow-crests": {
    "en": "Snow crests",
    "zh": "积雪覆盖"
   },
   "snow-lumpy": {
    "en": "Snow lumpy",
    "zh": "积雪结块"
   },
   "snow-patchy": {
    "en": "Snow patchy",
    "zh": "积雪斑驳"
   },
   "dust-flat": {
    "en": "Dust flat",
    "zh": "尘土平地"
   },
   "dust-crests": {
    "en": "Dust crests",
    "zh": "尘土覆盖"
   },
   "dust-lumpy": {
    "en": "Dust lumpy",
    "zh": "尘土结块"
   },
   "dust-patchy": {
    "en": "Dust patchy",
    "zh": "尘土斑驳"
   },
   "brash-ice": {
    "en": "Brash Ice",
    "zh": "碎冰"
   },
   "ice-rough": {
    "en": "Rough ice",
    "zh": "粗糙冰面"
   },
   "ice-smooth": {
    "en": "Smooth ice",
    "zh": "平滑冰面"
   },
   "ice-platform": {
    "en": "Ice platform",
    "zh": "浮冰平台"
   },
   "frozen-stone-path": {
    "en": "Frozen stone path",
    "zh": "冻结的石砖路"
   },
   "frozen-concrete": {
    "en": "Frozen concrete",
    "zh": "冻结的混凝土"
   },
   "frozen-foundation": {
    "en": "Frozen foundation",
    "zh": "冻结的工程基座"
   },
   "frozen-hazard-concrete-left": {
    "en": "Frozen hazard concrete left",
    "zh": "冻结的混凝土（左警戒）"
   },
   "frozen-hazard-concrete-right": {
    "en": "Frozen hazard concrete right",
    "zh": "冻结的混凝土（右警戒）"
   },
   "frozen-refined-concrete": {
    "en": "Frozen refined concrete",
    "zh": "冻结的钢筋混凝土"
   },
   "frozen-refined-hazard-concrete-left": {
    "en": "Frozen refined hazard concrete left",
    "zh": "冻结的钢筋混凝土（左警戒）"
   },
   "frozen-refined-hazard-concrete-right": {
    "en": "Frozen refined hazard concrete right",
    "zh": "冻结的钢筋混凝土（右警戒）"
   },
   "oil-ocean-shallow": {
    "en": "Oil ocean",
    "zh": "油海"
   },
   "oil-ocean-shallow-2": {
    "en": "Oil ocean 2",
    "zh": "油海 2"
   },
   "oil-ocean-deep": {
    "en": "Deep oil ocean",
    "zh": "深油海"
   },
   "oil-ocean-deep-2": {
    "en": "Deep oil ocean 2",
    "zh": "深油海 2"
   },
   "wetland-yumako": {
    "en": "Yumako wetland",
    "zh": "玉玛果湿地"
   },
   "wetland-jellynut": {
    "en": "Jellynut wetland",
    "zh": "果冻果湿地"
   },
   "ammoniacal-ocean": {
    "en": "Ammoniacal ocean",
    "zh": "氨海"
   },
   "ammoniacal-ocean-2": {
    "en": "Ammoniacal ocean",
    "zh": "氨海"
   },
   "natural-yumako-soil": {
    "en": "Natural yumako soil",
    "zh": "玉玛果天然土"
   },
   "natural-jellynut-soil": {
    "en": "Natural jellynut soil",
    "zh": "果冻果天然土"
   },
   "artificial-yumako-soil": {
    "en": "Artificial yumako soil",
    "zh": "玉玛果人造土"
   },
   "artificial-jellynut-soil": {
    "en": "Artificial jellynut soil",
    "zh": "果冻果人造土"
   },
   "overgrowth-yumako-soil": {
    "en": "Overgrowth yumako soil",
    "zh": "玉玛果沃土"
   },
   "overgrowth-jellynut-soil": {
    "en": "Overgrowth jellynut soil",
    "zh": "果冻果沃土"
   },
   "wetland-light-green-slime": {
    "en": "Light green marsh",
    "zh": "浅绿沼泽"
   },
   "wetland-green-slime": {
    "en": "Green marsh",
    "zh": "绿沼泽"
   },
   "wetland-light-dead-skin": {
    "en": "Light deadskin marsh",
    "zh": "浅枯皮沼泽"
   },
   "wetland-dead-skin": {
    "en": "Deadskin marsh",
    "zh": "枯皮沼泽"
   },
   "wetland-pink-tentacle": {
    "en": "Pink marsh",
    "zh": "粉红沼泽"
   },
   "wetland-red-tentacle": {
    "en": "Red coral marsh",
    "zh": "红珊瑚沼泽"
   },
   "wetland-blue-slime": {
    "en": "Blue marsh",
    "zh": "蓝沼泽"
   },
   "gleba-deep-lake": {
    "en": "Deep lake",
    "zh": "深湖"
   },
   "lowland-olive-blubber": {
    "en": "Olive blubber lichen",
    "zh": "橄榄色鲸脂地衣"
   },
   "lowland-cream-cauliflower": {
    "en": "Cauliflower lichen",
    "zh": "花椰菜地衣"
   },
   "lowland-red-vein": {
    "en": "Sanguine lichen",
    "zh": "血红地衣"
   },
   "midland-turquoise-bark": {
    "en": "Turquoise bark lichen",
    "zh": "青绿树皮地衣"
   },
   "highland-dark-rock": {
    "en": "Dark dry lichen",
    "zh": "暗色干地衣"
   },
   "lava-hot": {
    "en": "Hot lava",
    "zh": "热岩浆"
   },
   "lava": {
    "en": "Lava",
    "zh": "岩浆"
   },
   "volcanic-cracks-hot": {
    "en": "Volcanic cracks hot",
    "zh": "火山裂缝（热）"
   },
   "volcanic-cracks-warm": {
    "en": "Volcanic cracks warm",
    "zh": "火山裂缝（暖）"
   },
   "volcanic-cracks": {
    "en": "Volcanic cracks",
    "zh": "火山裂缝"
   },
   "volcanic-smooth-stone": {
    "en": "Volcanic smooth stone",
    "zh": "火山圆石"
   },
   "volcanic-smooth-stone-warm": {
    "en": "Volcanic smooth stone warm",
    "zh": "火山圆石（暖）"
   },
   "volcanic-folds-warm": {
    "en": "Volcanic folds warm",
    "zh": "火山皱褶（暖）"
   },
   "volcanic-folds": {
    "en": "Volcanic folds",
    "zh": "火山皱褶"
   },
   "volcanic-folds-flat": {
    "en": "Volcanic folds flat",
    "zh": "火山皱褶（平）"
   },
   "volcanic-jagged-ground": {
    "en": "Volcanic jagged ground",
    "zh": "火山嶙峋地"
   },
   "volcanic-pumice-stones": {
    "en": "Volcanic pumice stones",
    "zh": "火山浮石"
   },
   "volcanic-soil-dark": {
    "en": "Volcanic soil dark",
    "zh": "火山土壤（深色）"
   },
   "volcanic-soil-light": {
    "en": "Volcanic soil light",
    "zh": "火山土壤（浅色）"
   },
   "volcanic-ash-dark": {
    "en": "Volcanic ash dark",
    "zh": "火山灰烬（深色）"
   },
   "volcanic-ash-light": {
    "en": "Volcanic ash light",
    "zh": "火山灰烬（浅色）"
   },
   "volcanic-ash-flats": {
    "en": "Volcanic ash flat",
    "zh": "火山灰烬（平）"
   },
   "volcanic-ash-soil": {
    "en": "Volcanic ash soil",
    "zh": "火山灰土壤"
   },
   "volcanic-ash-cracks": {
    "en": "Volcanic ash cracks",
    "zh": "火山裂缝（灰）"
   },
   "fulgoran-rock": {
    "en": "Fulgoran rock",
    "zh": "雷神岩石"
   },
   "fulgoran-dust": {
    "en": "Fulgoran dust",
    "zh": "雷神尘地"
   },
   "fulgoran-sand": {
    "en": "Fulgoran sand",
    "zh": "雷神沙地"
   },
   "fulgoran-dunes": {
    "en": "Fulgoran dunes",
    "zh": "雷神沙丘"
   },
   "fulgoran-paving": {
    "en": "Fulgoran paving",
    "zh": "雷神石路"
   },
   "fulgoran-walls": {
    "en": "Fulgoran walls",
    "zh": "雷神墙壁"
   },
   "fulgoran-conduit": {
    "en": "Fulgoran conduit",
    "zh": "雷神管道"
   },
   "fulgoran-machinery": {
    "en": "Fulgoran machinery",
    "zh": "雷神机械"
   },
   "foundation": {
    "en": "Foundation",
    "zh": "工程基座"
   }
  },
  "map-gen-preset-name": {
   "default": {
    "en": "Default",
    "zh": "默认预设"
   },
   "rich-resources": {
    "en": "Rich resources",
    "zh": "富饶之地"
   },
   "marathon": {
    "en": "Marathon",
    "zh": "长期作战"
   },
   "death-world": {
    "en": "Death world",
    "zh": "末日领域"
   },
   "death-world-marathon": {
    "en": "Death world marathon",
    "zh": "绝地求生"
   },
   "rail-world": {
    "en": "Rail world",
    "zh": "铁道纵横"
   },
   "ribbon-world": {
    "en": "Ribbon world",
    "zh": "冤家路窄"
   },
   "lakes": {
    "en": "Lakes",
    "zh": "湖泊星罗"
   },
   "island": {
    "en": "Island",
    "zh": "汪洋孤岛"
   },
   "vulcanus": {
    "en": "Vulcanus",
    "zh": "祝融星"
   }
  },
  "map-gen-preset-description": {
   "default": {
    "en": "Normal settings. The recommended way to play Factorio.",
    "zh": "常规设置，推荐使用。"
   },
   "rich-resources": {
    "en": "Resource patches have a larger richness, so you don't have to expand far.",
    "zh": "矿区愈加丰饶，玩家因此不必拓张太远。"
   },
   "marathon": {
    "en": "Technologies are more expensive.",
    "zh": "科技更为昂贵。"
   },
   "death-world": {
    "en": "Biters are more dangerous and evolve faster.",
    "zh": "虫子更加残暴，而且进化得更快。"
   },
   "death-world-marathon": {
    "en": "Technologies are more expensive, and biters are dangerous and plentiful. Only select this if you are a Factorio veteran.",
    "zh": "科技更为昂贵，虫子更加残暴，而且进化得更快。仅推荐游戏老手尝试。"
   },
   "rail-world": {
    "en": "Resource patches are large and spread far apart to encourage train systems. Biters won't create any new bases or re-expand into cleared territory.",
    "zh": "矿区面积大且相距较远，鼓励使用列车系统。虫子不会扩张出新的虫巢，也不会重新回到已清理的领地。"
   },
   "ribbon-world": {
    "en": "The map height is limited to only 128 tiles, which introduces a range of challenges and interesting situations.",
    "zh": "地图高度限制为128格，这将带来一系列有趣挑战。"
   },
   "lakes": {
    "en": "Lakes with consistent size and cliffs that tend to follow the coastline. Forest paths are disabled. The same elevation as Factorio 1.1.",
    "zh": "大小一致的湖泊，悬崖沿着河岸线延伸，禁用林中小径。海拔与1.1版本一致。"
   },
   "island": {
    "en": "A large island in an endless ocean. Forest paths are disabled.",
    "zh": "无尽海洋中的一座大岛，禁用林中小径。"
   },
   "vulcanus": {
    "en": "A highly volcanically active planet.",
    "zh": "一颗火山高度活跃的星球。"
   }
  }
 }
};
