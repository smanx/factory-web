# 《异星工厂》科技清单与依赖分析报告

> 本报告由 `tools/tech-report.js` 现场解析 `factorio-data/` 的 Lua 数据自动生成（数据源：factorio 2.1 官方 + Space Age/Quality/Recycler/Elevated Rails 扩展）。
> 依赖关系即每个科技的 `prerequisites` 前置科技列表，构成完整科技树有向图。

## 总览

| 模块 | 科技数 |
|------|------:|
| base | 195 |
| space-age | 75 |
| quality | 5 |
| recycler | 1 |
| elevated-rails | 1 |
| **合计** | **277** |

- **科技总数**：277
- **无限科技（无限/可重复）**：23
- **普通科技**：254

- **无限科技清单**：artillery-shell-damage-1、artillery-shell-range-1、artillery-shell-speed-1、asteroid-productivity、electric-weapons-damage-4、follower-robot-count-5、health、laser-weapons-damage-7、low-density-structure-productivity、mining-productivity-3、physical-projectile-damage-7、plastic-bar-productivity、processing-unit-productivity、railgun-damage-1、railgun-shooting-speed-1、refined-flammables-7、research-productivity、rocket-fuel-productivity、rocket-part-productivity、scrap-recycling-productivity、steel-plate-productivity、stronger-explosives-7、worker-robots-speed-7

## 科技依赖明细

> 每条目格式：`### 名称〔无限/升级〕` 下含前置 / 成本 / 效果。

### advanced-asteroid-processing

- **模块**：space-age
- **前置**：agricultural-science-pack、production-science-pack、utility-science-pack
- **成本**：红×1、绿×1、蓝×1、紫×1、黄×1、空间×1、agricultural-science-pack×1 ｜ 时长: 60s
- **效果**：解锁配方:advanced-metallic-asteroid-crushing、解锁配方:advanced-carbonic-asteroid-crushing、解锁配方:advanced-oxide-asteroid-crushing、解锁配方:advanced-thruster-fuel、解锁配方:advanced-thruster-oxidizer

### advanced-circuit

- **模块**：base
- **前置**：plastics
- **成本**：红×1、绿×1 ｜ 时长: 15s
- **效果**：解锁配方:advanced-circuit

### advanced-combinators

- **模块**：base
- **前置**：circuit-network、chemical-science-pack
- **成本**：红×1、绿×1、蓝×1 ｜ 时长: 30s
- **效果**：解锁配方:selector-combinator

### advanced-material-processing

- **模块**：base
- **前置**：steel-processing、logistic-science-pack
- **成本**：红×1、绿×1 ｜ 时长: 30s
- **效果**：解锁配方:steel-furnace

### advanced-material-processing-2

- **模块**：base
- **前置**：advanced-material-processing、chemical-science-pack
- **成本**：红×1、绿×1、蓝×1 ｜ 时长: 30s
- **效果**：解锁配方:electric-furnace

### advanced-oil-processing

- **模块**：base
- **前置**：chemical-science-pack
- **成本**：红×1、绿×1、蓝×1 ｜ 时长: 30s
- **效果**：解锁配方:advanced-oil-processing、解锁配方:heavy-oil-cracking、解锁配方:light-oil-cracking、解锁配方:solid-fuel-from-heavy-oil、解锁配方:solid-fuel-from-light-oil

### agricultural-science-pack

- **模块**：space-age
- **前置**：bioflux-processing、bacteria-cultivation、artificial-soil
- **成本**：无成本(触发式)
- **效果**：解锁配方:agricultural-science-pack

### agriculture

- **模块**：space-age
- **前置**：planet-discovery-gleba
- **成本**：无成本(触发式)
- **效果**：解锁配方:agricultural-tower、解锁配方:nutrients-from-spoilage

### artificial-soil

- **模块**：space-age
- **前置**：yumako、jellynut
- **成本**：无成本(触发式)
- **效果**：解锁配方:artificial-yumako-soil、解锁配方:artificial-jellynut-soil

### artillery

- **模块**：base
- **前置**：military-4、metallurgic-science-pack、radar
- **成本**：红×1、绿×1、蓝×1、军×1、黄×1、空间×1、metallurgic-science-pack×1 ｜ 时长: 30s
- **效果**：解锁配方:artillery-wagon、解锁配方:artillery-turret、解锁配方:artillery-shell

### artillery-shell-damage-1 〔无限〕

- **模块**：space-age
- **前置**：artillery
- **成本**：红×1、绿×1、蓝×1、军×1、黄×1、空间×1、metallurgic-science-pack×1 ｜ 时长: 60s
- **效果**：弹药伤害(artillery-shell) +10%

### artillery-shell-range-1 〔无限〕

- **模块**：base
- **前置**：artillery
- **成本**：红×1、绿×1、蓝×1、军×1、黄×1、空间×1、metallurgic-science-pack×1 ｜ 时长: 60s
- **效果**：炮兵射程 +30%

### artillery-shell-speed-1 〔无限〕

- **模块**：base
- **前置**：artillery
- **成本**：红×1、绿×1、蓝×1、军×1、黄×1、空间×1、metallurgic-science-pack×1 ｜ 时长: 60s
- **效果**：枪械射速(artillery-shell) +100%

### asteroid-productivity 〔无限〕 〔可升级〕

- **模块**：space-age
- **前置**：advanced-asteroid-processing
- **成本**：红×1、绿×1、蓝×1、紫×1、黄×1、空间×1、agricultural-science-pack×1 ｜ 时长: 60s
- **效果**：change-recipe-productivity、change-recipe-productivity、change-recipe-productivity、change-recipe-productivity、change-recipe-productivity、change-recipe-productivity

### asteroid-reprocessing

- **模块**：space-age
- **前置**：metallurgic-science-pack
- **成本**：红×1、绿×1、蓝×1、空间×1、metallurgic-science-pack×1 ｜ 时长: 60s
- **效果**：解锁配方:metallic-asteroid-reprocessing、解锁配方:oxide-asteroid-reprocessing、解锁配方:carbonic-asteroid-reprocessing

### atomic-bomb

- **模块**：base
- **前置**：military-4、kovarex-enrichment-process、rocketry
- **成本**：红×1、绿×1、蓝×1、军×1、黄×1、空间×1 ｜ 时长: 45s
- **效果**：解锁配方:atomic-bomb

### automated-rail-transportation

- **模块**：base
- **前置**：railway
- **成本**：红×1、绿×1 ｜ 时长: 30s
- **效果**：解锁配方:train-stop、解锁配方:rail-signal、解锁配方:rail-chain-signal

### automation

- **模块**：base
- **前置**：automation-science-pack
- **成本**：红×1 ｜ 时长: 10s
- **效果**：解锁配方:assembling-machine-1、解锁配方:long-handed-inserter

### automation-2

- **模块**：base
- **前置**：automation、steel-processing、logistic-science-pack
- **成本**：红×1、绿×1 ｜ 时长: 15s
- **效果**：解锁配方:assembling-machine-2

### automation-3

- **模块**：base
- **前置**：speed-module、production-science-pack、electric-engine
- **成本**：红×1、绿×1、蓝×1、紫×1 ｜ 时长: 60s
- **效果**：解锁配方:assembling-machine-3

### automation-science-pack

- **模块**：base
- **前置**：steam-power、electronics
- **成本**：无成本(触发式)
- **效果**：解锁配方:automation-science-pack

### automobilism

- **模块**：base
- **前置**：logistics-2、engine
- **成本**：红×1、绿×1 ｜ 时长: 30s
- **效果**：解锁配方:car

### bacteria-cultivation

- **模块**：space-age
- **前置**：bioflux
- **成本**：无成本(触发式)
- **效果**：解锁配方:copper-bacteria-cultivation、解锁配方:iron-bacteria-cultivation

### battery

- **模块**：base
- **前置**：sulfur-processing
- **成本**：红×1、绿×1 ｜ 时长: 30s
- **效果**：解锁配方:battery

### battery-equipment

- **模块**：base
- **前置**：battery、solar-panel-equipment
- **成本**：红×1、绿×1 ｜ 时长: 15s
- **效果**：解锁配方:battery-equipment

### battery-mk2-equipment

- **模块**：base
- **前置**：battery-equipment、power-armor、utility-science-pack
- **成本**：红×1、绿×1、蓝×1、黄×1 ｜ 时长: 30s
- **效果**：解锁配方:battery-mk2-equipment

### battery-mk3-equipment

- **模块**：space-age
- **前置**：battery-mk2-equipment、electromagnetic-science-pack
- **成本**：红×1、绿×1、蓝×1、黄×1、空间×1、electromagnetic-science-pack×1 ｜ 时长: 60s
- **效果**：解锁配方:battery-mk3-equipment

### belt-immunity-equipment

- **模块**：base
- **前置**：solar-panel-equipment
- **成本**：红×1、绿×1 ｜ 时长: 15s
- **效果**：解锁配方:belt-immunity-equipment

### big-mining-drill

- **模块**：space-age
- **前置**：foundry、electric-mining-drill
- **成本**：无成本(触发式)
- **效果**：解锁配方:big-mining-drill

### biochamber

- **模块**：space-age
- **前置**：yumako、jellynut
- **成本**：无成本(触发式)
- **效果**：解锁配方:biochamber、解锁配方:nutrients-from-yumako-mash、解锁配方:burnt-spoilage、解锁配方:pentapod-egg

### bioflux

- **模块**：space-age
- **前置**：biochamber
- **成本**：无成本(触发式)
- **效果**：解锁配方:bioflux、解锁配方:nutrients-from-bioflux

### bioflux-processing

- **模块**：space-age
- **前置**：bioflux
- **成本**：无成本(触发式)
- **效果**：解锁配方:bioplastic、解锁配方:rocket-fuel-from-jelly、解锁配方:biosulfur、解锁配方:biolubricant、解锁配方:coal-synthesis

### biolab

- **模块**：space-age
- **前置**：biter-egg-handling、production-science-pack、utility-science-pack、uranium-processing
- **成本**：红×1、绿×1、蓝×1、军×1、紫×1、黄×1、空间×1、agricultural-science-pack×1 ｜ 时长: 60s
- **效果**：解锁配方:biolab

### biter-egg-handling

- **模块**：space-age
- **前置**：captivity
- **成本**：无成本(触发式)
- **效果**：解锁配方:biter-egg、解锁配方:nutrients-from-biter-egg

### braking-force-1 〔可升级〕

- **模块**：base
- **前置**：railway、chemical-science-pack
- **成本**：红×1、绿×1、蓝×1 ｜ 时长: 30s
- **效果**：train-braking-force-bonus +10%

### braking-force-2 〔可升级〕

- **模块**：base
- **前置**：braking-force-1
- **成本**：红×1、绿×1、蓝×1 ｜ 时长: 30s
- **效果**：train-braking-force-bonus +15%

### braking-force-3 〔可升级〕

- **模块**：base
- **前置**：braking-force-2、production-science-pack
- **成本**：红×1、绿×1、蓝×1、紫×1 ｜ 时长: 30s
- **效果**：train-braking-force-bonus +15%

### braking-force-4 〔可升级〕

- **模块**：base
- **前置**：braking-force-3
- **成本**：红×1、绿×1、蓝×1、紫×1 ｜ 时长: 30s
- **效果**：train-braking-force-bonus +15%

### braking-force-5 〔可升级〕

- **模块**：base
- **前置**：braking-force-4
- **成本**：红×1、绿×1、蓝×1、紫×1 ｜ 时长: 35s
- **效果**：train-braking-force-bonus +15%

### braking-force-6 〔可升级〕

- **模块**：base
- **前置**：braking-force-5、utility-science-pack
- **成本**：红×1、绿×1、蓝×1、紫×1、黄×1 ｜ 时长: 45s
- **效果**：train-braking-force-bonus +15%

### braking-force-7 〔可升级〕

- **模块**：base
- **前置**：braking-force-6
- **成本**：红×1、绿×1、蓝×1、紫×1、黄×1 ｜ 时长: 60s
- **效果**：train-braking-force-bonus +15%

### bulk-inserter

- **模块**：base
- **前置**：fast-inserter、logistics-2、advanced-circuit
- **成本**：红×1、绿×1 ｜ 时长: 30s
- **效果**：解锁配方:bulk-inserter、bulk-inserter-capacity-bonus +100%

### calcite-processing

- **模块**：space-age
- **前置**：planet-discovery-vulcanus
- **成本**：无成本(触发式)
- **效果**：解锁配方:acid-neutralisation、解锁配方:steam-condensation、解锁配方:simple-coal-liquefaction

### captive-biter-spawner

- **模块**：space-age
- **前置**：cryogenic-science-pack、biter-egg-handling、kovarex-enrichment-process
- **成本**：红×1、绿×1、蓝×1、军×1、紫×1、黄×1、空间×1、metallurgic-science-pack×1、agricultural-science-pack×1、electromagnetic-science-pack×1、cryogenic-science-pack×1 ｜ 时长: 60s
- **效果**：解锁配方:captive-biter-spawner

### captivity

- **模块**：space-age
- **前置**：agricultural-science-pack、military-3、rocketry
- **成本**：红×1、绿×1、蓝×1、军×1、空间×1、agricultural-science-pack×1 ｜ 时长: 60s
- **效果**：解锁配方:capture-robot-rocket

### carbon-fiber

- **模块**：space-age
- **前置**：agricultural-science-pack
- **成本**：红×1、绿×1、蓝×1、空间×1、agricultural-science-pack×1 ｜ 时长: 60s
- **效果**：解锁配方:carbon-fiber

### chemical-science-pack

- **模块**：base
- **前置**：advanced-circuit、sulfur-processing
- **成本**：红×1、绿×1 ｜ 时长: 10s
- **效果**：解锁配方:chemical-science-pack

### circuit-network

- **模块**：base
- **前置**：logistic-science-pack
- **成本**：红×1、绿×1 ｜ 时长: 15s
- **效果**：unlock-circuit-network、解锁配方:arithmetic-combinator、解锁配方:decider-combinator、解锁配方:constant-combinator、解锁配方:power-switch、解锁配方:programmable-speaker、解锁配方:display-panel、解锁配方:iron-stick

### cliff-explosives

- **模块**：base
- **前置**：explosives、military-science-pack、metallurgic-science-pack
- **成本**：红×1、绿×1、蓝×1、空间×1、metallurgic-science-pack×1 ｜ 时长: 30s
- **效果**：解锁配方:cliff-explosives、cliff-deconstruction-enabled

### coal-liquefaction

- **模块**：base
- **前置**：metallurgic-science-pack
- **成本**：红×1、绿×1、蓝×1、空间×1、metallurgic-science-pack×1 ｜ 时长: 30s
- **效果**：解锁配方:coal-liquefaction

### concrete

- **模块**：base
- **前置**：advanced-material-processing、automation-2
- **成本**：红×1、绿×1 ｜ 时长: 30s
- **效果**：解锁配方:concrete、解锁配方:hazard-concrete、解锁配方:refined-concrete、解锁配方:refined-hazard-concrete、解锁配方:iron-stick

### construction-robotics

- **模块**：base
- **前置**：robotics
- **成本**：红×1、绿×1、蓝×1 ｜ 时长: 30s
- **效果**：解锁配方:roboport、解锁配方:passive-provider-chest、解锁配方:storage-chest、解锁配方:construction-robot、create-ghost-on-entity-death、unlock-logistic-network

### cryogenic-plant

- **模块**：space-age
- **前置**：lithium-processing
- **成本**：无成本(触发式)
- **效果**：解锁配方:cryogenic-plant、解锁配方:fluoroketone、解锁配方:fluoroketone-cooling

### cryogenic-science-pack

- **模块**：space-age
- **前置**：cryogenic-plant
- **成本**：无成本(触发式)
- **效果**：解锁配方:cryogenic-science-pack

### defender

- **模块**：base
- **前置**：military-science-pack
- **成本**：红×1、绿×1、军×1 ｜ 时长: 30s
- **效果**：解锁配方:defender-capsule、maximum-following-robots-count +400%

### destroyer

- **模块**：base
- **前置**：military-4、distractor、speed-module
- **成本**：红×1、绿×1、蓝×1、军×1、黄×1 ｜ 时长: 30s
- **效果**：解锁配方:destroyer-capsule

### discharge-defense-equipment

- **模块**：base
- **前置**：laser-turret、military-3、power-armor、solar-panel-equipment
- **成本**：红×1、绿×1、蓝×1、军×1 ｜ 时长: 30s
- **效果**：解锁配方:discharge-defense-equipment

### distractor

- **模块**：base
- **前置**：defender、military-3、laser
- **成本**：红×1、绿×1、蓝×1、军×1 ｜ 时长: 30s
- **效果**：解锁配方:distractor-capsule

### effect-transmission

- **模块**：base
- **前置**：processing-unit、production-science-pack
- **成本**：红×1、绿×1、蓝×1、紫×1 ｜ 时长: 30s
- **效果**：解锁配方:beacon

### efficiency-module 〔可升级〕

- **模块**：base
- **前置**：modules
- **成本**：红×1、绿×1 ｜ 时长: 30s
- **效果**：解锁配方:efficiency-module

### efficiency-module-2 〔可升级〕

- **模块**：base
- **前置**：efficiency-module、space-science-pack
- **成本**：红×1、绿×1、蓝×1、空间×1 ｜ 时长: 30s
- **效果**：解锁配方:efficiency-module-2

### efficiency-module-3 〔可升级〕

- **模块**：base
- **前置**：efficiency-module-2、agricultural-science-pack
- **成本**：红×1、绿×1、蓝×1、空间×1、agricultural-science-pack×1 ｜ 时长: 60s
- **效果**：解锁配方:efficiency-module-3

### electric-energy-accumulators

- **模块**：base
- **前置**：electric-energy-distribution-1、battery
- **成本**：红×1、绿×1 ｜ 时长: 30s
- **效果**：解锁配方:accumulator

### electric-energy-distribution-1

- **模块**：base
- **前置**：steel-processing、logistic-science-pack
- **成本**：红×1、绿×1 ｜ 时长: 30s
- **效果**：解锁配方:medium-electric-pole、解锁配方:big-electric-pole、解锁配方:iron-stick

### electric-energy-distribution-2

- **模块**：base
- **前置**：electric-energy-distribution-1、chemical-science-pack
- **成本**：红×1、绿×1、蓝×1 ｜ 时长: 45s
- **效果**：解锁配方:substation

### electric-engine

- **模块**：base
- **前置**：lubricant
- **成本**：红×1、绿×1、蓝×1 ｜ 时长: 30s
- **效果**：解锁配方:electric-engine-unit

### electric-mining-drill

- **模块**：base
- **前置**：automation-science-pack
- **成本**：红×1 ｜ 时长: 10s
- **效果**：解锁配方:electric-mining-drill

### electric-weapons-damage-1 〔可升级〕

- **模块**：space-age
- **前置**：destroyer
- **成本**：红×1、绿×1、军×1、蓝×1、黄×1 ｜ 时长: 30s
- **效果**：弹药伤害(beam) +30%

### electric-weapons-damage-2 〔可升级〕

- **模块**：space-age
- **前置**：electric-weapons-damage-1、space-science-pack
- **成本**：红×1、绿×1、蓝×1、军×1、黄×1、空间×1 ｜ 时长: 60s
- **效果**：弹药伤害(beam) +40%

### electric-weapons-damage-3 〔可升级〕

- **模块**：space-age
- **前置**：electric-weapons-damage-2、tesla-weapons
- **成本**：红×1、绿×1、蓝×1、军×1、黄×1、空间×1、electromagnetic-science-pack×1 ｜ 时长: 60s
- **效果**：弹药伤害(tesla) +70%、弹药伤害(electric) +70%、弹药伤害(beam) +60%

### electric-weapons-damage-4 〔无限〕 〔可升级〕

- **模块**：space-age
- **前置**：electric-weapons-damage-3
- **成本**：红×1、绿×1、蓝×1、军×1、黄×1、空间×1、electromagnetic-science-pack×1 ｜ 时长: 60s
- **效果**：弹药伤害(tesla) +70%、弹药伤害(electric) +70%、弹药伤害(beam) +30%

### electromagnetic-plant

- **模块**：space-age
- **前置**：holmium-processing
- **成本**：无成本(触发式)
- **效果**：解锁配方:electromagnetic-plant、解锁配方:superconductor、解锁配方:supercapacitor、解锁配方:electrolyte

### electromagnetic-science-pack

- **模块**：space-age
- **前置**：electromagnetic-plant
- **成本**：无成本(触发式)
- **效果**：解锁配方:electromagnetic-science-pack

### electronics

- **模块**：base
- **前置**：—
- **成本**：无成本(触发式)
- **效果**：解锁配方:copper-cable、解锁配方:electronic-circuit、解锁配方:lab、解锁配方:inserter、解锁配方:small-electric-pole

### elevated-rail

- **模块**：elevated-rails
- **前置**：concrete、production-science-pack
- **成本**：红×1、绿×1、蓝×1、紫×1 ｜ 时长: 30s
- **效果**：解锁配方:rail-support、解锁配方:rail-ramp、rail-planner-allow-elevated-rails

### energy-shield-equipment

- **模块**：base
- **前置**：solar-panel-equipment、military-science-pack
- **成本**：红×1、绿×1、军×1 ｜ 时长: 15s
- **效果**：解锁配方:energy-shield-equipment

### energy-shield-mk2-equipment

- **模块**：base
- **前置**：energy-shield-equipment、military-4、electromagnetic-science-pack、power-armor
- **成本**：红×1、绿×1、蓝×1、军×1、空间×1、黄×1、electromagnetic-science-pack×1 ｜ 时长: 30s
- **效果**：解锁配方:energy-shield-mk2-equipment

### engine

- **模块**：base
- **前置**：steel-processing、logistic-science-pack
- **成本**：红×1、绿×1 ｜ 时长: 15s
- **效果**：解锁配方:engine-unit

### epic-quality

- **模块**：quality
- **前置**：agricultural-science-pack、utility-science-pack、quality-module
- **成本**：红×1、绿×1、蓝×1、黄×1、空间×1、agricultural-science-pack×1 ｜ 时长: 60s
- **效果**：unlock-quality

### exoskeleton-equipment

- **模块**：base
- **前置**：processing-unit、electric-engine、solar-panel-equipment
- **成本**：红×1、绿×1、蓝×1 ｜ 时长: 30s
- **效果**：解锁配方:exoskeleton-equipment

### explosive-rocketry

- **模块**：base
- **前置**：rocketry、military-3
- **成本**：红×1、绿×1、蓝×1、军×1 ｜ 时长: 30s
- **效果**：解锁配方:explosive-rocket

### explosives

- **模块**：base
- **前置**：sulfur-processing
- **成本**：红×1、绿×1 ｜ 时长: 15s
- **效果**：解锁配方:explosives

### fast-inserter

- **模块**：base
- **前置**：automation-science-pack
- **成本**：红×1 ｜ 时长: 15s
- **效果**：解锁配方:fast-inserter

### fish-breeding

- **模块**：space-age
- **前置**：tree-seeding
- **成本**：红×1、绿×1、蓝×1、空间×1、agricultural-science-pack×1 ｜ 时长: 60s
- **效果**：解锁配方:fish-breeding、解锁配方:nutrients-from-fish

### fission-reactor-equipment

- **模块**：base
- **前置**：utility-science-pack、power-armor、military-science-pack、nuclear-power
- **成本**：红×1、绿×1、蓝×1、军×1、黄×1 ｜ 时长: 30s
- **效果**：解锁配方:fission-reactor-equipment

### flamethrower

- **模块**：base
- **前置**：flammables、military-science-pack
- **成本**：红×1、绿×1、军×1 ｜ 时长: 30s
- **效果**：解锁配方:flamethrower、解锁配方:flamethrower-ammo、解锁配方:flamethrower-turret

### flammables

- **模块**：base
- **前置**：oil-processing
- **成本**：红×1、绿×1 ｜ 时长: 30s

### fluid-handling

- **模块**：base
- **前置**：automation-2、engine
- **成本**：红×1、绿×1 ｜ 时长: 15s
- **效果**：解锁配方:storage-tank、解锁配方:pump、解锁配方:barrel、解锁配方:water-barrel、解锁配方:empty-water-barrel、解锁配方:sulfuric-acid-barrel、解锁配方:empty-sulfuric-acid-barrel、解锁配方:crude-oil-barrel、解锁配方:empty-crude-oil-barrel、解锁配方:heavy-oil-barrel、解锁配方:empty-heavy-oil-barrel、解锁配方:light-oil-barrel、解锁配方:empty-light-oil-barrel、解锁配方:petroleum-gas-barrel、解锁配方:empty-petroleum-gas-barrel、解锁配方:lubricant-barrel、解锁配方:empty-lubricant-barrel、解锁配方:fluoroketone-cold-barrel、解锁配方:empty-fluoroketone-cold-barrel、解锁配方:fluoroketone-hot-barrel、解锁配方:empty-fluoroketone-hot-barrel

### fluid-wagon

- **模块**：base
- **前置**：railway、fluid-handling
- **成本**：红×1、绿×1 ｜ 时长: 30s
- **效果**：解锁配方:fluid-wagon

### follower-robot-count-1 〔可升级〕

- **模块**：base
- **前置**：defender
- **成本**：红×1、绿×1、军×1 ｜ 时长: 30s
- **效果**：maximum-following-robots-count +500%

### follower-robot-count-2 〔可升级〕

- **模块**：base
- **前置**：follower-robot-count-1
- **成本**：红×1、绿×1、军×1 ｜ 时长: 30s
- **效果**：maximum-following-robots-count +1000%

### follower-robot-count-3 〔可升级〕

- **模块**：base
- **前置**：follower-robot-count-2、chemical-science-pack
- **成本**：红×1、绿×1、蓝×1、军×1 ｜ 时长: 30s
- **效果**：maximum-following-robots-count +1000%

### follower-robot-count-4 〔可升级〕

- **模块**：base
- **前置**：follower-robot-count-3、destroyer
- **成本**：红×1、绿×1、蓝×1、军×1、黄×1 ｜ 时长: 30s
- **效果**：maximum-following-robots-count +2000%

### follower-robot-count-5 〔无限〕 〔可升级〕

- **模块**：base
- **前置**：follower-robot-count-4、space-science-pack、production-science-pack、production-science-pack
- **成本**：红×1、绿×1、蓝×1、军×1、紫×1、黄×1、空间×1 ｜ 时长: 30s
- **效果**：maximum-following-robots-count +2500%

### foundation

- **模块**：space-age
- **前置**：cryogenic-science-pack
- **成本**：红×1、绿×1、蓝×1、紫×1、黄×1、空间×1、metallurgic-science-pack×1、agricultural-science-pack×1、electromagnetic-science-pack×1、cryogenic-science-pack×1 ｜ 时长: 60s
- **效果**：解锁配方:foundation

### foundry

- **模块**：space-age
- **前置**：calcite-processing、tungsten-carbide
- **成本**：无成本(触发式)
- **效果**：解锁配方:foundry、解锁配方:molten-iron-from-lava、解锁配方:molten-copper-from-lava、解锁配方:concrete-from-molten-iron、解锁配方:casting-low-density-structure、解锁配方:iron-ore-melting、解锁配方:copper-ore-melting、解锁配方:casting-iron、解锁配方:casting-steel、解锁配方:casting-copper、解锁配方:casting-iron-gear-wheel、解锁配方:casting-iron-stick、解锁配方:casting-pipe、解锁配方:casting-pipe-to-ground、解锁配方:casting-copper-cable

### fusion-reactor

- **模块**：space-age
- **前置**：quantum-processor
- **成本**：红×1、绿×1、蓝×1、紫×1、黄×1、空间×1、metallurgic-science-pack×1、agricultural-science-pack×1、electromagnetic-science-pack×1、cryogenic-science-pack×1 ｜ 时长: 60s
- **效果**：解锁配方:fusion-reactor、解锁配方:fusion-generator、解锁配方:fusion-power-cell

### fusion-reactor-equipment

- **模块**：space-age
- **前置**：fusion-reactor、fission-reactor-equipment
- **成本**：红×1、绿×1、蓝×1、紫×1、黄×1、空间×1、metallurgic-science-pack×1、agricultural-science-pack×1、electromagnetic-science-pack×1、cryogenic-science-pack×1 ｜ 时长: 60s
- **效果**：解锁配方:fusion-reactor-equipment

### gate

- **模块**：base
- **前置**：stone-wall、military-2
- **成本**：红×1、绿×1 ｜ 时长: 30s
- **效果**：解锁配方:gate

### gun-turret

- **模块**：base
- **前置**：automation-science-pack
- **成本**：红×1 ｜ 时长: 10s
- **效果**：解锁配方:gun-turret

### health 〔无限〕

- **模块**：space-age
- **前置**：agricultural-science-pack、utility-science-pack、military-science-pack
- **成本**：红×1、绿×1、蓝×1、黄×1、空间×1、agricultural-science-pack×1 ｜ 时长: 60s
- **效果**：生命值加成 +5000%

### heating-tower

- **模块**：space-age
- **前置**：planet-discovery-gleba
- **成本**：无成本(触发式)
- **效果**：解锁配方:heating-tower、解锁配方:heat-pipe、解锁配方:heat-exchanger、解锁配方:steam-turbine

### heavy-armor

- **模块**：base
- **前置**：military、steel-processing
- **成本**：红×1 ｜ 时长: 30s
- **效果**：解锁配方:heavy-armor

### holmium-processing

- **模块**：space-age
- **前置**：recycling
- **成本**：无成本(触发式)
- **效果**：解锁配方:holmium-solution、解锁配方:holmium-plate

### inserter-capacity-bonus-1 〔可升级〕

- **模块**：base
- **前置**：bulk-inserter
- **成本**：红×1、绿×1 ｜ 时长: 30s
- **效果**：bulk-inserter-capacity-bonus +100%

### inserter-capacity-bonus-2 〔可升级〕

- **模块**：base
- **前置**：inserter-capacity-bonus-1
- **成本**：红×1、绿×1 ｜ 时长: 30s
- **效果**：机械臂堆叠 +100%、bulk-inserter-capacity-bonus +100%

### inserter-capacity-bonus-3 〔可升级〕

- **模块**：base
- **前置**：inserter-capacity-bonus-2、chemical-science-pack
- **成本**：红×1、绿×1、蓝×1 ｜ 时长: 30s
- **效果**：bulk-inserter-capacity-bonus +100%

### inserter-capacity-bonus-4 〔可升级〕

- **模块**：base
- **前置**：inserter-capacity-bonus-3、production-science-pack
- **成本**：红×1、绿×1、蓝×1、紫×1 ｜ 时长: 30s
- **效果**：bulk-inserter-capacity-bonus +100%

### inserter-capacity-bonus-5 〔可升级〕

- **模块**：base
- **前置**：inserter-capacity-bonus-4
- **成本**：红×1、绿×1、蓝×1、紫×1 ｜ 时长: 30s
- **效果**：bulk-inserter-capacity-bonus +200%

### inserter-capacity-bonus-6 〔可升级〕

- **模块**：base
- **前置**：inserter-capacity-bonus-5
- **成本**：红×1、绿×1、蓝×1、紫×1 ｜ 时长: 30s
- **效果**：bulk-inserter-capacity-bonus +200%

### inserter-capacity-bonus-7 〔可升级〕

- **模块**：base
- **前置**：inserter-capacity-bonus-6、utility-science-pack
- **成本**：红×1、绿×1、蓝×1、紫×1、黄×1 ｜ 时长: 30s
- **效果**：机械臂堆叠 +100%、bulk-inserter-capacity-bonus +200%

### jellynut

- **模块**：space-age
- **前置**：agriculture
- **成本**：无成本(触发式)
- **效果**：解锁配方:jellynut-processing、解锁配方:iron-bacteria

### kovarex-enrichment-process

- **模块**：base
- **前置**：uranium-processing、space-science-pack
- **成本**：红×1、绿×1、蓝×1、空间×1 ｜ 时长: 30s
- **效果**：解锁配方:kovarex-enrichment-process、解锁配方:nuclear-fuel

### lamp

- **模块**：base
- **前置**：automation-science-pack
- **成本**：红×1 ｜ 时长: 15s
- **效果**：解锁配方:small-lamp

### land-mine

- **模块**：base
- **前置**：explosives、military-science-pack
- **成本**：红×1、绿×1、军×1 ｜ 时长: 30s
- **效果**：解锁配方:land-mine

### landfill

- **模块**：base
- **前置**：logistic-science-pack
- **成本**：红×1、绿×1 ｜ 时长: 30s
- **效果**：解锁配方:landfill

### landing-pad-unloading-bay

- **模块**：space-age
- **前置**：space-science-pack
- **成本**：红×1、绿×1、蓝×1、空间×1 ｜ 时长: 60s
- **效果**：解锁配方:landing-pad-unloading-bay、卸货距离 +5900%

### laser

- **模块**：base
- **前置**：battery、chemical-science-pack
- **成本**：红×1、绿×1、蓝×1 ｜ 时长: 30s

### laser-shooting-speed-1 〔可升级〕

- **模块**：base
- **前置**：laser、military-science-pack
- **成本**：红×1、绿×1、军×1、蓝×1 ｜ 时长: 30s
- **效果**：枪械射速(laser) +10%

### laser-shooting-speed-2 〔可升级〕

- **模块**：base
- **前置**：laser-shooting-speed-1
- **成本**：红×1、绿×1、军×1、蓝×1 ｜ 时长: 30s
- **效果**：枪械射速(laser) +20%

### laser-shooting-speed-3 〔可升级〕

- **模块**：base
- **前置**：laser-shooting-speed-2
- **成本**：红×1、绿×1、蓝×1、军×1 ｜ 时长: 60s
- **效果**：枪械射速(laser) +30%

### laser-shooting-speed-4 〔可升级〕

- **模块**：base
- **前置**：laser-shooting-speed-3
- **成本**：红×1、绿×1、蓝×1、军×1 ｜ 时长: 60s
- **效果**：枪械射速(laser) +30%

### laser-shooting-speed-5 〔可升级〕

- **模块**：base
- **前置**：laser-shooting-speed-4、utility-science-pack
- **成本**：红×1、绿×1、蓝×1、军×1、黄×1 ｜ 时长: 60s
- **效果**：枪械射速(laser) +40%

### laser-shooting-speed-6 〔可升级〕

- **模块**：base
- **前置**：laser-shooting-speed-5
- **成本**：红×1、绿×1、蓝×1、军×1、黄×1 ｜ 时长: 60s
- **效果**：枪械射速(laser) +40%

### laser-shooting-speed-7 〔可升级〕

- **模块**：base
- **前置**：laser-shooting-speed-6
- **成本**：红×1、绿×1、蓝×1、军×1、黄×1 ｜ 时长: 60s
- **效果**：枪械射速(laser) +50%

### laser-turret

- **模块**：base
- **前置**：laser、military-science-pack
- **成本**：红×1、绿×1、军×1、蓝×1 ｜ 时长: 30s
- **效果**：解锁配方:laser-turret

### laser-weapons-damage-1 〔可升级〕

- **模块**：base
- **前置**：laser、military-science-pack
- **成本**：红×1、绿×1、军×1、蓝×1 ｜ 时长: 30s
- **效果**：弹药伤害(laser) +20%

### laser-weapons-damage-2 〔可升级〕

- **模块**：base
- **前置**：laser-weapons-damage-1
- **成本**：红×1、绿×1、军×1、蓝×1 ｜ 时长: 30s
- **效果**：弹药伤害(laser) +20%

### laser-weapons-damage-3 〔可升级〕

- **模块**：base
- **前置**：laser-weapons-damage-2
- **成本**：红×1、绿×1、军×1、蓝×1 ｜ 时长: 60s
- **效果**：弹药伤害(laser) +30%

### laser-weapons-damage-4 〔可升级〕

- **模块**：base
- **前置**：laser-weapons-damage-3
- **成本**：红×1、绿×1、军×1、蓝×1 ｜ 时长: 60s
- **效果**：弹药伤害(laser) +40%

### laser-weapons-damage-5 〔可升级〕

- **模块**：base
- **前置**：laser-weapons-damage-4、utility-science-pack
- **成本**：红×1、绿×1、蓝×1、军×1、黄×1 ｜ 时长: 60s
- **效果**：弹药伤害(laser) +50%

### laser-weapons-damage-6 〔可升级〕

- **模块**：base
- **前置**：laser-weapons-damage-5
- **成本**：红×1、绿×1、蓝×1、军×1、黄×1 ｜ 时长: 60s
- **效果**：弹药伤害(laser) +70%

### laser-weapons-damage-7 〔无限〕 〔可升级〕

- **模块**：base
- **前置**：laser-weapons-damage-6、space-science-pack
- **成本**：红×1、绿×1、蓝×1、军×1、黄×1、空间×1 ｜ 时长: 60s
- **效果**：弹药伤害(laser) +70%

### legendary-quality

- **模块**：quality
- **前置**：cryogenic-science-pack、epic-quality
- **成本**：红×1、绿×1、蓝×1、紫×1、黄×1、空间×1、metallurgic-science-pack×1、agricultural-science-pack×1、electromagnetic-science-pack×1、cryogenic-science-pack×1 ｜ 时长: 60s
- **效果**：unlock-quality

### lightning-collector

- **模块**：space-age
- **前置**：electromagnetic-science-pack
- **成本**：红×1、绿×1、蓝×1、空间×1、electromagnetic-science-pack×1 ｜ 时长: 60s
- **效果**：解锁配方:lightning-collector

### lithium-processing

- **模块**：space-age
- **前置**：planet-discovery-aquilo
- **成本**：无成本(触发式)
- **效果**：解锁配方:lithium、解锁配方:lithium-plate

### logistic-robotics

- **模块**：base
- **前置**：robotics
- **成本**：红×1、绿×1、蓝×1 ｜ 时长: 30s
- **效果**：解锁配方:roboport、解锁配方:passive-provider-chest、解锁配方:storage-chest、解锁配方:logistic-robot、character-logistic-requests、character-logistic-trash-slots +3000%、unlock-logistic-network

### logistic-science-pack

- **模块**：base
- **前置**：automation-science-pack
- **成本**：红×1 ｜ 时长: 5s
- **效果**：解锁配方:logistic-science-pack

### logistic-system

- **模块**：base
- **前置**：space-science-pack
- **成本**：红×1、绿×1、蓝×1、空间×1 ｜ 时长: 30s
- **效果**：解锁配方:active-provider-chest、解锁配方:requester-chest、解锁配方:buffer-chest、vehicle-logistics

### logistics

- **模块**：base
- **前置**：automation-science-pack
- **成本**：红×1 ｜ 时长: 15s
- **效果**：解锁配方:underground-belt、解锁配方:splitter

### logistics-2

- **模块**：base
- **前置**：logistics、logistic-science-pack
- **成本**：红×1、绿×1 ｜ 时长: 30s
- **效果**：解锁配方:fast-transport-belt、解锁配方:fast-underground-belt、解锁配方:fast-splitter

### logistics-3

- **模块**：base
- **前置**：production-science-pack、lubricant
- **成本**：红×1、绿×1、蓝×1、紫×1 ｜ 时长: 15s
- **效果**：解锁配方:express-transport-belt、解锁配方:express-underground-belt、解锁配方:express-splitter

### low-density-structure

- **模块**：base
- **前置**：advanced-material-processing、chemical-science-pack
- **成本**：红×1、绿×1、蓝×1 ｜ 时长: 45s
- **效果**：解锁配方:low-density-structure

### low-density-structure-productivity 〔无限〕 〔可升级〕

- **模块**：space-age
- **前置**：production-science-pack、metallurgic-science-pack
- **成本**：红×1、绿×1、蓝×1、紫×1、metallurgic-science-pack×1 ｜ 时长: 60s
- **效果**：change-recipe-productivity、change-recipe-productivity

### lubricant

- **模块**：base
- **前置**：advanced-oil-processing
- **成本**：红×1、绿×1、蓝×1 ｜ 时长: 30s
- **效果**：解锁配方:lubricant

### mech-armor

- **模块**：space-age
- **前置**：electromagnetic-science-pack、power-armor-mk2
- **成本**：红×1、绿×1、蓝×1、军×1、黄×1、空间×1、electromagnetic-science-pack×1 ｜ 时长: 60s
- **效果**：解锁配方:mech-armor

### metallurgic-science-pack

- **模块**：space-age
- **前置**：tungsten-steel
- **成本**：无成本(触发式)
- **效果**：解锁配方:metallurgic-science-pack

### military

- **模块**：base
- **前置**：automation-science-pack
- **成本**：红×1 ｜ 时长: 15s
- **效果**：解锁配方:submachine-gun、解锁配方:shotgun、解锁配方:shotgun-shell

### military-2

- **模块**：base
- **前置**：military、steel-processing、logistic-science-pack
- **成本**：红×1、绿×1 ｜ 时长: 15s
- **效果**：解锁配方:piercing-rounds-magazine、解锁配方:grenade

### military-3

- **模块**：base
- **前置**：chemical-science-pack、military-science-pack
- **成本**：红×1、绿×1、蓝×1、军×1 ｜ 时长: 30s
- **效果**：解锁配方:poison-capsule、解锁配方:slowdown-capsule、解锁配方:piercing-shotgun-shell

### military-4

- **模块**：base
- **前置**：military-3、utility-science-pack、explosives
- **成本**：红×1、绿×1、蓝×1、军×1、黄×1 ｜ 时长: 45s
- **效果**：解锁配方:cluster-grenade、解锁配方:combat-shotgun

### military-science-pack

- **模块**：base
- **前置**：military-2、stone-wall
- **成本**：红×1、绿×1 ｜ 时长: 15s
- **效果**：解锁配方:military-science-pack

### mining-productivity-1 〔可升级〕

- **模块**：base
- **前置**：advanced-circuit
- **成本**：红×1、绿×1 ｜ 时长: 60s
- **效果**：采矿产能 +10%

### mining-productivity-2 〔可升级〕

- **模块**：base
- **前置**：mining-productivity-1、chemical-science-pack
- **成本**：红×1、绿×1、蓝×1 ｜ 时长: 60s
- **效果**：采矿产能 +10%

### mining-productivity-3 〔无限〕 〔可升级〕

- **模块**：base
- **前置**：mining-productivity-2、production-science-pack
- **成本**：红×1、绿×1、蓝×1、紫×1 ｜ 时长: 60s
- **效果**：采矿产能 +10%

### modular-armor

- **模块**：base
- **前置**：heavy-armor、advanced-circuit
- **成本**：红×1、绿×1 ｜ 时长: 30s
- **效果**：解锁配方:modular-armor

### modules

- **模块**：base
- **前置**：advanced-circuit
- **成本**：红×1、绿×1 ｜ 时长: 30s

### night-vision-equipment

- **模块**：base
- **前置**：solar-panel-equipment
- **成本**：红×1、绿×1 ｜ 时长: 15s
- **效果**：解锁配方:night-vision-equipment

### nuclear-fuel-reprocessing

- **模块**：base
- **前置**：nuclear-power、production-science-pack
- **成本**：红×1、绿×1、蓝×1、紫×1 ｜ 时长: 30s
- **效果**：解锁配方:nuclear-fuel-reprocessing

### nuclear-power

- **模块**：base
- **前置**：uranium-processing
- **成本**：红×1、绿×1、蓝×1 ｜ 时长: 30s
- **效果**：解锁配方:nuclear-reactor、解锁配方:heat-exchanger、解锁配方:heat-pipe、解锁配方:steam-turbine、解锁配方:uranium-fuel-cell

### oil-gathering

- **模块**：base
- **前置**：fluid-handling
- **成本**：红×1、绿×1 ｜ 时长: 30s
- **效果**：解锁配方:pumpjack

### oil-processing

- **模块**：base
- **前置**：oil-gathering
- **成本**：无成本(触发式)
- **效果**：解锁配方:oil-refinery、解锁配方:chemical-plant、解锁配方:basic-oil-processing、解锁配方:solid-fuel-from-petroleum-gas

### overgrowth-soil

- **模块**：space-age
- **前置**：biter-egg-handling、production-science-pack、utility-science-pack
- **成本**：红×1、绿×1、蓝×1、紫×1、黄×1、空间×1、agricultural-science-pack×1 ｜ 时长: 60s
- **效果**：解锁配方:overgrowth-yumako-soil、解锁配方:overgrowth-jellynut-soil

### personal-laser-defense-equipment

- **模块**：base
- **前置**：laser-turret、military-3、low-density-structure、power-armor、solar-panel-equipment
- **成本**：红×1、绿×1、蓝×1、军×1 ｜ 时长: 30s
- **效果**：解锁配方:personal-laser-defense-equipment

### personal-roboport-equipment

- **模块**：base
- **前置**：construction-robotics、solar-panel-equipment
- **成本**：红×1、绿×1、蓝×1 ｜ 时长: 30s
- **效果**：解锁配方:personal-roboport-equipment

### personal-roboport-mk2-equipment

- **模块**：base
- **前置**：personal-roboport-equipment、electromagnetic-science-pack、utility-science-pack
- **成本**：红×1、绿×1、蓝×1、黄×1、空间×1、electromagnetic-science-pack×1 ｜ 时长: 30s
- **效果**：解锁配方:personal-roboport-mk2-equipment

### physical-projectile-damage-1 〔可升级〕

- **模块**：base
- **前置**：military
- **成本**：红×1 ｜ 时长: 30s
- **效果**：弹药伤害(bullet) +10%、炮塔伤害 +10%、弹药伤害(shotgun-shell) +10%

### physical-projectile-damage-2 〔可升级〕

- **模块**：base
- **前置**：physical-projectile-damage-1、logistic-science-pack
- **成本**：红×1、绿×1 ｜ 时长: 30s
- **效果**：弹药伤害(bullet) +10%、炮塔伤害 +10%、弹药伤害(shotgun-shell) +10%

### physical-projectile-damage-3 〔可升级〕

- **模块**：base
- **前置**：physical-projectile-damage-2、military-science-pack
- **成本**：红×1、绿×1、军×1 ｜ 时长: 60s
- **效果**：弹药伤害(bullet) +20%、炮塔伤害 +20%、弹药伤害(shotgun-shell) +20%

### physical-projectile-damage-4 〔可升级〕

- **模块**：base
- **前置**：physical-projectile-damage-3
- **成本**：红×1、绿×1、军×1 ｜ 时长: 60s
- **效果**：弹药伤害(bullet) +20%、炮塔伤害 +20%、弹药伤害(shotgun-shell) +20%

### physical-projectile-damage-5 〔可升级〕

- **模块**：base
- **前置**：physical-projectile-damage-4、chemical-science-pack
- **成本**：红×1、绿×1、蓝×1、军×1 ｜ 时长: 60s
- **效果**：弹药伤害(bullet) +20%、炮塔伤害 +20%、弹药伤害(shotgun-shell) +20%、弹药伤害(cannon-shell) +90%

### physical-projectile-damage-6 〔可升级〕

- **模块**：base
- **前置**：physical-projectile-damage-5、utility-science-pack
- **成本**：红×1、绿×1、蓝×1、军×1、黄×1 ｜ 时长: 60s
- **效果**：弹药伤害(bullet) +20%、炮塔伤害 +20%、弹药伤害(shotgun-shell) +40%、弹药伤害(cannon-shell) +130%

### physical-projectile-damage-7 〔无限〕 〔可升级〕

- **模块**：base
- **前置**：physical-projectile-damage-6、space-science-pack
- **成本**：红×1、绿×1、蓝×1、军×1、黄×1、空间×1 ｜ 时长: 60s
- **效果**：弹药伤害(bullet) +20%、炮塔伤害 +20%、弹药伤害(shotgun-shell) +40%、弹药伤害(cannon-shell) +100%

### planet-discovery-aquilo

- **模块**：space-age
- **前置**：rocket-turret、advanced-asteroid-processing、heating-tower、asteroid-reprocessing、electromagnetic-science-pack
- **成本**：红×1、绿×1、蓝×1、紫×1、黄×1、空间×1、metallurgic-science-pack×1、agricultural-science-pack×1、electromagnetic-science-pack×1 ｜ 时长: 60s
- **效果**：解锁太空位置、解锁配方:ammoniacal-solution-separation、解锁配方:solid-fuel-from-ammonia、解锁配方:ammonia-rocket-fuel、解锁配方:ice-platform

### planet-discovery-fulgora

- **模块**：space-age
- **前置**：space-platform-thruster、electric-energy-accumulators
- **成本**：红×1、绿×1、蓝×1、空间×1 ｜ 时长: 60s
- **效果**：解锁太空位置、unlock-travel-to-space-platforms、解锁配方:lightning-rod

### planet-discovery-gleba

- **模块**：space-age
- **前置**：space-platform-thruster、landfill
- **成本**：红×1、绿×1、蓝×1、空间×1 ｜ 时长: 60s
- **效果**：解锁太空位置、unlock-travel-to-space-platforms

### planet-discovery-vulcanus

- **模块**：space-age
- **前置**：space-platform-thruster
- **成本**：红×1、绿×1、蓝×1、空间×1 ｜ 时长: 60s
- **效果**：解锁太空位置、unlock-travel-to-space-platforms

### plastic-bar-productivity 〔无限〕 〔可升级〕

- **模块**：space-age
- **前置**：agricultural-science-pack、production-science-pack
- **成本**：红×1、绿×1、蓝×1、紫×1、agricultural-science-pack×1 ｜ 时长: 60s
- **效果**：change-recipe-productivity、change-recipe-productivity

### plastics

- **模块**：base
- **前置**：oil-processing
- **成本**：红×1、绿×1 ｜ 时长: 30s
- **效果**：解锁配方:plastic-bar

### power-armor

- **模块**：base
- **前置**：modular-armor、electric-engine、processing-unit
- **成本**：红×1、绿×1、蓝×1 ｜ 时长: 30s
- **效果**：解锁配方:power-armor

### power-armor-mk2

- **模块**：base
- **前置**：power-armor、military-4、speed-module、efficiency-module
- **成本**：红×1、绿×1、蓝×1、军×1、黄×1 ｜ 时长: 30s
- **效果**：解锁配方:power-armor-mk2

### processing-unit

- **模块**：base
- **前置**：chemical-science-pack
- **成本**：红×1、绿×1、蓝×1 ｜ 时长: 30s
- **效果**：解锁配方:processing-unit

### processing-unit-productivity 〔无限〕 〔可升级〕

- **模块**：space-age
- **前置**：electromagnetic-science-pack、production-science-pack
- **成本**：红×1、绿×1、蓝×1、紫×1、electromagnetic-science-pack×1 ｜ 时长: 60s
- **效果**：change-recipe-productivity

### production-science-pack

- **模块**：base
- **前置**：productivity-module、advanced-material-processing-2、railway
- **成本**：红×1、绿×1、蓝×1 ｜ 时长: 30s
- **效果**：解锁配方:production-science-pack

### productivity-module 〔可升级〕

- **模块**：base
- **前置**：modules
- **成本**：红×1、绿×1 ｜ 时长: 30s
- **效果**：解锁配方:productivity-module

### productivity-module-2 〔可升级〕

- **模块**：base
- **前置**：productivity-module、space-science-pack
- **成本**：红×1、绿×1、蓝×1、空间×1 ｜ 时长: 30s
- **效果**：解锁配方:productivity-module-2

### productivity-module-3 〔可升级〕

- **模块**：base
- **前置**：productivity-module-2、biter-egg-handling
- **成本**：红×1、绿×1、蓝×1、空间×1、agricultural-science-pack×1 ｜ 时长: 60s
- **效果**：解锁配方:productivity-module-3

### promethium-science-pack

- **模块**：space-age
- **前置**：biter-egg-handling、stellar-discovery-solar-system-edge
- **成本**：红×1、绿×1、蓝×1、紫×1、黄×1、空间×1、metallurgic-science-pack×1、agricultural-science-pack×1、electromagnetic-science-pack×1、cryogenic-science-pack×1 ｜ 时长: 60s
- **效果**：解锁太空位置、解锁配方:promethium-science-pack

### quality-module 〔可升级〕

- **模块**：quality
- **前置**：modules
- **成本**：红×1、绿×1 ｜ 时长: 30s
- **效果**：解锁配方:quality-module、unlock-quality、unlock-quality

### quality-module-2 〔可升级〕

- **模块**：quality
- **前置**：quality-module、space-science-pack
- **成本**：红×1、绿×1、蓝×1、空间×1 ｜ 时长: 30s
- **效果**：解锁配方:quality-module-2

### quality-module-3 〔可升级〕

- **模块**：quality
- **前置**：quality-module-2、electromagnetic-science-pack
- **成本**：红×1、绿×1、蓝×1、空间×1、electromagnetic-science-pack×1 ｜ 时长: 60s
- **效果**：解锁配方:quality-module-3

### quantum-processor

- **模块**：space-age
- **前置**：cryogenic-science-pack
- **成本**：红×1、绿×1、蓝×1、紫×1、黄×1、空间×1、metallurgic-science-pack×1、agricultural-science-pack×1、electromagnetic-science-pack×1、cryogenic-science-pack×1 ｜ 时长: 60s
- **效果**：解锁配方:quantum-processor

### radar

- **模块**：base
- **前置**：automation-science-pack
- **成本**：红×1 ｜ 时长: 10s
- **效果**：解锁配方:radar

### rail-support-foundations

- **模块**：space-age
- **前置**：electromagnetic-science-pack、utility-science-pack、metallurgic-science-pack、elevated-rail
- **成本**：红×1、绿×1、蓝×1、紫×1、黄×1、空间×1、metallurgic-science-pack×1、electromagnetic-science-pack×1 ｜ 时长: 30s
- **效果**：rail-support-on-deep-oil-ocean

### railgun

- **模块**：space-age
- **前置**：quantum-processor
- **成本**：红×1、绿×1、蓝×1、军×1、黄×1、空间×1、metallurgic-science-pack×1、electromagnetic-science-pack×1、agricultural-science-pack×1、cryogenic-science-pack×1 ｜ 时长: 60s
- **效果**：解锁配方:railgun、解锁配方:railgun-turret、解锁配方:railgun-ammo

### railgun-damage-1 〔无限〕

- **模块**：space-age
- **前置**：railgun
- **成本**：红×1、绿×1、蓝×1、军×1、黄×1、空间×1、metallurgic-science-pack×1、agricultural-science-pack×1 ｜ 时长: 60s
- **效果**：弹药伤害(railgun) +40%

### railgun-shooting-speed-1 〔无限〕

- **模块**：space-age
- **前置**：railgun
- **成本**：红×1、绿×1、蓝×1、军×1、黄×1、空间×1、electromagnetic-science-pack×1、cryogenic-science-pack×1 ｜ 时长: 60s
- **效果**：枪械射速(railgun) +15%

### railway

- **模块**：base
- **前置**：logistics-2、engine
- **成本**：红×1、绿×1 ｜ 时长: 30s
- **效果**：解锁配方:rail、解锁配方:locomotive、解锁配方:cargo-wagon、解锁配方:iron-stick

### recycling

- **模块**：recycler
- **前置**：planet-discovery-fulgora
- **成本**：无成本(触发式)
- **效果**：解锁配方:recycler、解锁配方:scrap-recycling、解锁配方:speed-module-recycling、解锁配方:speed-module-2-recycling、解锁配方:speed-module-3-recycling、解锁配方:productivity-module-recycling、解锁配方:productivity-module-2-recycling、解锁配方:productivity-module-3-recycling、解锁配方:efficiency-module-recycling、解锁配方:efficiency-module-2-recycling、解锁配方:efficiency-module-3-recycling、解锁配方:bulk-inserter-recycling、解锁配方:barrel-recycling、解锁配方:night-vision-equipment-recycling、解锁配方:belt-immunity-equipment-recycling、解锁配方:energy-shield-equipment-recycling、解锁配方:energy-shield-mk2-equipment-recycling、解锁配方:battery-equipment-recycling、解锁配方:battery-mk2-equipment-recycling、解锁配方:solar-panel-equipment-recycling、解锁配方:fission-reactor-equipment-recycling、解锁配方:personal-laser-defense-equipment-recycling、解锁配方:discharge-defense-equipment-recycling、解锁配方:exoskeleton-equipment-recycling、解锁配方:personal-roboport-equipment-recycling、解锁配方:personal-roboport-mk2-equipment-recycling、解锁配方:laser-turret-recycling、解锁配方:flamethrower-turret-recycling、解锁配方:artillery-turret-recycling、解锁配方:gun-turret-recycling、解锁配方:wooden-chest-recycling、解锁配方:display-panel-recycling、解锁配方:iron-stick-recycling、解锁配方:stone-furnace-recycling、解锁配方:boiler-recycling、解锁配方:steam-engine-recycling、解锁配方:iron-gear-wheel-recycling、解锁配方:electronic-circuit-recycling、解锁配方:transport-belt-recycling、解锁配方:electric-mining-drill-recycling、解锁配方:burner-mining-drill-recycling、解锁配方:inserter-recycling、解锁配方:fast-inserter-recycling、解锁配方:long-handed-inserter-recycling、解锁配方:burner-inserter-recycling、解锁配方:pipe-recycling、解锁配方:offshore-pump-recycling、解锁配方:copper-cable-recycling、解锁配方:small-electric-pole-recycling、解锁配方:submachine-gun-recycling、解锁配方:firearm-magazine-recycling、解锁配方:light-armor-recycling、解锁配方:radar-recycling、解锁配方:small-lamp-recycling、解锁配方:pipe-to-ground-recycling、解锁配方:assembling-machine-1-recycling、解锁配方:lab-recycling、解锁配方:stone-wall-recycling、解锁配方:assembling-machine-2-recycling、解锁配方:splitter-recycling、解锁配方:underground-belt-recycling、解锁配方:loader-recycling、解锁配方:engine-unit-recycling、解锁配方:iron-chest-recycling、解锁配方:big-electric-pole-recycling、解锁配方:medium-electric-pole-recycling、解锁配方:shotgun-recycling、解锁配方:shotgun-shell-recycling、解锁配方:piercing-rounds-magazine-recycling、解锁配方:grenade-recycling、解锁配方:steel-furnace-recycling、解锁配方:gate-recycling、解锁配方:heavy-armor-recycling、解锁配方:steel-chest-recycling、解锁配方:fast-underground-belt-recycling、解锁配方:fast-splitter-recycling、解锁配方:concrete-recycling、解锁配方:hazard-concrete-recycling、解锁配方:refined-concrete-recycling、解锁配方:refined-hazard-concrete-recycling、解锁配方:fast-transport-belt-recycling、解锁配方:solar-panel-recycling、解锁配方:rail-signal-recycling、解锁配方:rail-chain-signal-recycling、解锁配方:train-stop-recycling、解锁配方:arithmetic-combinator-recycling、解锁配方:decider-combinator-recycling、解锁配方:constant-combinator-recycling、解锁配方:selector-combinator-recycling、解锁配方:power-switch-recycling、解锁配方:programmable-speaker-recycling、解锁配方:poison-capsule-recycling、解锁配方:slowdown-capsule-recycling、解锁配方:cluster-grenade-recycling、解锁配方:defender-capsule-recycling、解锁配方:distractor-capsule-recycling、解锁配方:destroyer-capsule-recycling、解锁配方:cliff-explosives-recycling、解锁配方:uranium-rounds-magazine-recycling、解锁配方:rocket-recycling、解锁配方:explosive-rocket-recycling、解锁配方:atomic-bomb-recycling、解锁配方:piercing-shotgun-shell-recycling、解锁配方:cannon-shell-recycling、解锁配方:explosive-cannon-shell-recycling、解锁配方:uranium-cannon-shell-recycling、解锁配方:explosive-uranium-cannon-shell-recycling、解锁配方:artillery-shell-recycling、解锁配方:express-transport-belt-recycling、解锁配方:assembling-machine-3-recycling、解锁配方:modular-armor-recycling、解锁配方:power-armor-recycling、解锁配方:power-armor-mk2-recycling、解锁配方:flamethrower-recycling、解锁配方:land-mine-recycling、解锁配方:rocket-launcher-recycling、解锁配方:combat-shotgun-recycling、解锁配方:express-underground-belt-recycling、解锁配方:fast-loader-recycling、解锁配方:express-loader-recycling、解锁配方:express-splitter-recycling、解锁配方:advanced-circuit-recycling、解锁配方:processing-unit-recycling、解锁配方:logistic-robot-recycling、解锁配方:construction-robot-recycling、解锁配方:passive-provider-chest-recycling、解锁配方:active-provider-chest-recycling、解锁配方:storage-chest-recycling、解锁配方:buffer-chest-recycling、解锁配方:requester-chest-recycling、解锁配方:rocket-silo-recycling、解锁配方:cargo-landing-pad-recycling、解锁配方:roboport-recycling、解锁配方:substation-recycling、解锁配方:accumulator-recycling、解锁配方:electric-furnace-recycling、解锁配方:beacon-recycling、解锁配方:pumpjack-recycling、解锁配方:oil-refinery-recycling、解锁配方:electric-engine-unit-recycling、解锁配方:flying-robot-frame-recycling、解锁配方:battery-recycling、解锁配方:storage-tank-recycling、解锁配方:pump-recycling、解锁配方:chemical-plant-recycling、解锁配方:low-density-structure-recycling、解锁配方:rocket-fuel-recycling、解锁配方:nuclear-reactor-recycling、解锁配方:centrifuge-recycling、解锁配方:nuclear-fuel-recycling、解锁配方:heat-exchanger-recycling、解锁配方:heat-pipe-recycling、解锁配方:steam-turbine-recycling、解锁配方:rail-support-recycling、解锁配方:quality-module-recycling、解锁配方:quality-module-2-recycling、解锁配方:quality-module-3-recycling、解锁配方:recycler-recycling、解锁配方:artificial-yumako-soil-recycling、解锁配方:overgrowth-yumako-soil-recycling、解锁配方:artificial-jellynut-soil-recycling、解锁配方:overgrowth-jellynut-soil-recycling、解锁配方:nutrients-recycling、解锁配方:toolbelt-equipment-recycling、解锁配方:battery-mk3-equipment-recycling、解锁配方:space-platform-foundation-recycling、解锁配方:stack-inserter-recycling、解锁配方:rocket-turret-recycling、解锁配方:infinity-chest-recycling、解锁配方:infinity-pipe-recycling、解锁配方:heat-interface-recycling、解锁配方:cargo-bay-recycling、解锁配方:landing-pad-unloading-bay-recycling、解锁配方:asteroid-collector-recycling、解锁配方:crusher-recycling、解锁配方:thruster-recycling、解锁配方:foundry-recycling、解锁配方:turbo-transport-belt-recycling、解锁配方:turbo-underground-belt-recycling、解锁配方:turbo-splitter-recycling、解锁配方:turbo-loader-recycling、解锁配方:big-mining-drill-recycling、解锁配方:mech-armor-recycling、解锁配方:railgun-recycling、解锁配方:railgun-turret-recycling、解锁配方:railgun-ammo-recycling、解锁配方:agricultural-tower-recycling、解锁配方:biochamber-recycling、解锁配方:capture-robot-rocket-recycling、解锁配方:lightning-rod-recycling、解锁配方:electromagnetic-plant-recycling、解锁配方:supercapacitor-recycling、解锁配方:lightning-collector-recycling、解锁配方:teslagun-recycling、解锁配方:tesla-turret-recycling、解锁配方:tesla-ammo-recycling、解锁配方:heating-tower-recycling、解锁配方:cryogenic-plant-recycling、解锁配方:quantum-processor-recycling、解锁配方:fusion-reactor-equipment-recycling、解锁配方:fusion-reactor-recycling、解锁配方:fusion-generator-recycling、解锁配方:ice-platform-recycling、解锁配方:foundation-recycling、解锁配方:water-barrel-recycling、解锁配方:sulfuric-acid-barrel-recycling、解锁配方:crude-oil-barrel-recycling、解锁配方:heavy-oil-barrel-recycling、解锁配方:light-oil-barrel-recycling、解锁配方:petroleum-gas-barrel-recycling、解锁配方:lubricant-barrel-recycling、解锁配方:fluoroketone-cold-barrel-recycling、解锁配方:fluoroketone-hot-barrel-recycling、解锁配方:item-unknown-recycling、解锁配方:stone-brick-recycling、解锁配方:wood-recycling、解锁配方:coal-recycling、解锁配方:stone-recycling、解锁配方:iron-ore-recycling、解锁配方:copper-ore-recycling、解锁配方:iron-plate-recycling、解锁配方:copper-plate-recycling、解锁配方:automation-science-pack-recycling、解锁配方:logistic-science-pack-recycling、解锁配方:steel-plate-recycling、解锁配方:solid-fuel-recycling、解锁配方:landfill-recycling、解锁配方:uranium-ore-recycling、解锁配方:chemical-science-pack-recycling、解锁配方:military-science-pack-recycling、解锁配方:production-science-pack-recycling、解锁配方:utility-science-pack-recycling、解锁配方:space-science-pack-recycling、解锁配方:lane-splitter-recycling、解锁配方:coin-recycling、解锁配方:sulfur-recycling、解锁配方:plastic-bar-recycling、解锁配方:explosives-recycling、解锁配方:electric-energy-interface-recycling、解锁配方:uranium-235-recycling、解锁配方:uranium-238-recycling、解锁配方:uranium-fuel-cell-recycling、解锁配方:depleted-uranium-fuel-cell-recycling、解锁配方:simple-entity-with-force-recycling、解锁配方:simple-entity-with-owner-recycling、解锁配方:infinity-cargo-wagon-recycling、解锁配方:burner-generator-recycling、解锁配方:linked-chest-recycling、解锁配方:proxy-container-recycling、解锁配方:bottomless-chest-recycling、解锁配方:linked-belt-recycling、解锁配方:one-way-valve-recycling、解锁配方:overflow-valve-recycling、解锁配方:top-up-valve-recycling、解锁配方:empty-module-slot-recycling、解锁配方:electric-energy-interface-equipment-recycling、解锁配方:science-recycling、解锁配方:metallurgic-science-pack-recycling、解锁配方:agricultural-science-pack-recycling、解锁配方:electromagnetic-science-pack-recycling、解锁配方:cryogenic-science-pack-recycling、解锁配方:promethium-science-pack-recycling、解锁配方:metallic-asteroid-chunk-recycling、解锁配方:carbonic-asteroid-chunk-recycling、解锁配方:oxide-asteroid-chunk-recycling、解锁配方:promethium-asteroid-chunk-recycling、解锁配方:ice-recycling、解锁配方:carbon-recycling、解锁配方:calcite-recycling、解锁配方:tungsten-ore-recycling、解锁配方:tungsten-plate-recycling、解锁配方:tungsten-carbide-recycling、解锁配方:copper-bacteria-recycling、解锁配方:iron-bacteria-recycling、解锁配方:yumako-seed-recycling、解锁配方:jellynut-seed-recycling、解锁配方:biolab-recycling、解锁配方:captive-biter-spawner-recycling、解锁配方:biter-egg-recycling、解锁配方:pentapod-egg-recycling、解锁配方:carbon-fiber-recycling、解锁配方:holmium-ore-recycling、解锁配方:holmium-plate-recycling、解锁配方:lithium-recycling、解锁配方:lithium-plate-recycling、解锁配方:superconductor-recycling、解锁配方:fusion-power-cell-recycling、解锁配方:spoilage-recycling、解锁配方:space-platform-hub-recycling、解锁配方:tree-seed-recycling、解锁配方:flamethrower-ammo-recycling、解锁配方:raw-fish-recycling、解锁配方:yumako-recycling、解锁配方:jellynut-recycling、解锁配方:yumako-mash-recycling、解锁配方:jelly-recycling、解锁配方:bioflux-recycling、解锁配方:pistol-recycling、解锁配方:blueprint-recycling、解锁配方:scrap-recycling

### refined-flammables-1 〔可升级〕

- **模块**：base
- **前置**：flamethrower
- **成本**：红×1、绿×1、军×1 ｜ 时长: 30s
- **效果**：弹药伤害(flamethrower) +20%、炮塔伤害 +20%

### refined-flammables-2 〔可升级〕

- **模块**：base
- **前置**：refined-flammables-1
- **成本**：红×1、绿×1、军×1 ｜ 时长: 30s
- **效果**：弹药伤害(flamethrower) +20%、炮塔伤害 +20%

### refined-flammables-3 〔可升级〕

- **模块**：base
- **前置**：refined-flammables-2、chemical-science-pack
- **成本**：红×1、绿×1、军×1、蓝×1 ｜ 时长: 60s
- **效果**：弹药伤害(flamethrower) +20%、炮塔伤害 +20%

### refined-flammables-4 〔可升级〕

- **模块**：base
- **前置**：refined-flammables-3、utility-science-pack
- **成本**：红×1、绿×1、军×1、蓝×1、黄×1 ｜ 时长: 60s
- **效果**：弹药伤害(flamethrower) +30%、炮塔伤害 +30%

### refined-flammables-5 〔可升级〕

- **模块**：base
- **前置**：refined-flammables-4
- **成本**：红×1、绿×1、军×1、蓝×1、黄×1 ｜ 时长: 60s
- **效果**：弹药伤害(flamethrower) +30%、炮塔伤害 +30%

### refined-flammables-6 〔可升级〕

- **模块**：base
- **前置**：refined-flammables-5、space-science-pack
- **成本**：红×1、绿×1、蓝×1、军×1、黄×1、空间×1 ｜ 时长: 60s
- **效果**：弹药伤害(flamethrower) +40%、炮塔伤害 +40%

### refined-flammables-7 〔无限〕 〔可升级〕

- **模块**：base
- **前置**：refined-flammables-6、agricultural-science-pack
- **成本**：红×1、绿×1、蓝×1、军×1、黄×1、空间×1、agricultural-science-pack×1 ｜ 时长: 60s
- **效果**：弹药伤害(flamethrower) +20%、炮塔伤害 +20%

### repair-pack

- **模块**：base
- **前置**：automation-science-pack
- **成本**：红×1 ｜ 时长: 10s
- **效果**：解锁配方:repair-pack

### research-productivity 〔无限〕 〔可升级〕

- **模块**：space-age
- **前置**：promethium-science-pack
- **成本**：红×1、绿×1、军×1、蓝×1、紫×1、黄×1、空间×1、metallurgic-science-pack×1、electromagnetic-science-pack×1、agricultural-science-pack×1、cryogenic-science-pack×1、promethium-science-pack×1 ｜ 时长: 120s
- **效果**：科研产能 +10%

### research-speed-1 〔可升级〕

- **模块**：base
- **前置**：automation-2
- **成本**：红×1、绿×1 ｜ 时长: 30s
- **效果**：科研速度 +20%

### research-speed-2 〔可升级〕

- **模块**：base
- **前置**：research-speed-1
- **成本**：红×1、绿×1 ｜ 时长: 30s
- **效果**：科研速度 +30%

### research-speed-3 〔可升级〕

- **模块**：base
- **前置**：research-speed-2、chemical-science-pack
- **成本**：红×1、绿×1、蓝×1 ｜ 时长: 30s
- **效果**：科研速度 +40%

### research-speed-4 〔可升级〕

- **模块**：base
- **前置**：research-speed-3
- **成本**：红×1、绿×1、蓝×1 ｜ 时长: 30s
- **效果**：科研速度 +50%

### research-speed-5 〔可升级〕

- **模块**：base
- **前置**：research-speed-4、production-science-pack
- **成本**：红×1、绿×1、蓝×1、紫×1 ｜ 时长: 30s
- **效果**：科研速度 +50%

### research-speed-6 〔可升级〕

- **模块**：base
- **前置**：research-speed-5、utility-science-pack
- **成本**：红×1、绿×1、蓝×1、紫×1、黄×1 ｜ 时长: 30s
- **效果**：科研速度 +60%

### robotics

- **模块**：base
- **前置**：electric-engine、battery
- **成本**：红×1、绿×1、蓝×1 ｜ 时长: 30s
- **效果**：解锁配方:flying-robot-frame

### rocket-fuel

- **模块**：base
- **前置**：flammables、advanced-oil-processing
- **成本**：红×1、绿×1、蓝×1 ｜ 时长: 45s
- **效果**：解锁配方:rocket-fuel

### rocket-fuel-productivity 〔无限〕 〔可升级〕

- **模块**：space-age
- **前置**：agricultural-science-pack、production-science-pack
- **成本**：红×1、绿×1、蓝×1、紫×1、agricultural-science-pack×1 ｜ 时长: 60s
- **效果**：change-recipe-productivity、change-recipe-productivity、change-recipe-productivity

### rocket-part-productivity 〔无限〕 〔可升级〕

- **模块**：space-age
- **前置**：cryogenic-science-pack
- **成本**：红×1、绿×1、蓝×1、紫×1、cryogenic-science-pack×1 ｜ 时长: 60s
- **效果**：change-recipe-productivity

### rocket-silo

- **模块**：base
- **前置**：concrete、rocket-fuel、processing-unit、logistic-robotics、low-density-structure、advanced-material-processing-2
- **成本**：红×1、绿×1、蓝×1 ｜ 时长: 60s
- **效果**：解锁配方:rocket-silo、解锁配方:rocket-part、解锁配方:cargo-landing-pad、unlock-space-platforms、解锁配方:space-platform-starter-pack、解锁配方:space-platform-foundation

### rocket-turret

- **模块**：space-age
- **前置**：rocketry、carbon-fiber、stronger-explosives-2
- **成本**：红×1、绿×1、军×1、蓝×1、空间×1、agricultural-science-pack×1 ｜ 时长: 30s
- **效果**：解锁配方:rocket-turret

### rocketry

- **模块**：base
- **前置**：explosives、flammables、military-science-pack
- **成本**：红×1、绿×1、军×1 ｜ 时长: 15s
- **效果**：解锁配方:rocket-launcher、解锁配方:rocket

### scrap-recycling-productivity 〔无限〕 〔可升级〕

- **模块**：space-age
- **前置**：electromagnetic-science-pack、production-science-pack
- **成本**：红×1、绿×1、蓝×1、紫×1、electromagnetic-science-pack×1 ｜ 时长: 60s
- **效果**：change-recipe-productivity

### solar-energy

- **模块**：base
- **前置**：steel-processing、logistic-science-pack
- **成本**：红×1、绿×1 ｜ 时长: 30s
- **效果**：解锁配方:solar-panel

### solar-panel-equipment

- **模块**：base
- **前置**：modular-armor、solar-energy
- **成本**：红×1、绿×1 ｜ 时长: 15s
- **效果**：解锁配方:solar-panel-equipment

### space-platform

- **模块**：space-age
- **前置**：rocket-silo
- **成本**：无成本(触发式)
- **效果**：解锁配方:asteroid-collector、解锁配方:crusher、解锁配方:metallic-asteroid-crushing、解锁配方:carbonic-asteroid-crushing、解锁配方:oxide-asteroid-crushing、解锁配方:cargo-bay

### space-platform-thruster

- **模块**：space-age
- **前置**：space-science-pack
- **成本**：红×1、绿×1、蓝×1、空间×1 ｜ 时长: 60s
- **效果**：解锁配方:thruster、解锁配方:ice-melting、解锁配方:thruster-fuel、解锁配方:thruster-oxidizer

### space-science-pack

- **模块**：base
- **前置**：space-platform
- **成本**：无成本(触发式)
- **效果**：解锁配方:space-science-pack

### speed-module 〔可升级〕

- **模块**：base
- **前置**：modules
- **成本**：红×1、绿×1 ｜ 时长: 30s
- **效果**：解锁配方:speed-module

### speed-module-2 〔可升级〕

- **模块**：base
- **前置**：speed-module、space-science-pack
- **成本**：红×1、绿×1、蓝×1、空间×1 ｜ 时长: 30s
- **效果**：解锁配方:speed-module-2

### speed-module-3 〔可升级〕

- **模块**：base
- **前置**：speed-module-2、metallurgic-science-pack
- **成本**：红×1、绿×1、蓝×1、空间×1、metallurgic-science-pack×1 ｜ 时长: 60s
- **效果**：解锁配方:speed-module-3

### spidertron

- **模块**：base
- **前置**：rocket-turret、exoskeleton-equipment、fission-reactor-equipment、military-4、production-science-pack、radar
- **成本**：红×1、绿×1、军×1、蓝×1、紫×1、黄×1、空间×1、agricultural-science-pack×1 ｜ 时长: 30s
- **效果**：解锁配方:spidertron

### stack-inserter

- **模块**：space-age
- **前置**：carbon-fiber、production-science-pack、utility-science-pack、bulk-inserter
- **成本**：红×1、绿×1、蓝×1、紫×1、黄×1、空间×1、agricultural-science-pack×1 ｜ 时长: 60s
- **效果**：解锁配方:stack-inserter、belt-stack-size-bonus +100%

### steam-power

- **模块**：base
- **前置**：—
- **成本**：无成本(触发式)
- **效果**：解锁配方:pipe、解锁配方:pipe-to-ground、解锁配方:offshore-pump、解锁配方:boiler、解锁配方:steam-engine

### steel-axe

- **模块**：base
- **前置**：steel-processing
- **成本**：无成本(触发式)
- **效果**：手挖速度 +100%

### steel-plate-productivity 〔无限〕 〔可升级〕

- **模块**：space-age
- **前置**：production-science-pack
- **成本**：红×1、绿×1、蓝×1、紫×1 ｜ 时长: 60s
- **效果**：change-recipe-productivity、change-recipe-productivity

### steel-processing

- **模块**：base
- **前置**：automation-science-pack
- **成本**：红×1 ｜ 时长: 5s
- **效果**：解锁配方:steel-plate、解锁配方:steel-chest

### stellar-discovery-solar-system-edge

- **模块**：space-age
- **前置**：fusion-reactor、railgun
- **成本**：红×1、绿×1、蓝×1、紫×1、黄×1、空间×1、metallurgic-science-pack×1、agricultural-science-pack×1、electromagnetic-science-pack×1、cryogenic-science-pack×1 ｜ 时长: 60s
- **效果**：解锁太空位置

### stone-wall

- **模块**：base
- **前置**：automation-science-pack
- **成本**：红×1 ｜ 时长: 10s
- **效果**：解锁配方:stone-wall

### stronger-explosives-1 〔可升级〕

- **模块**：base
- **前置**：military-2
- **成本**：红×1、绿×1 ｜ 时长: 30s
- **效果**：弹药伤害(grenade) +25%

### stronger-explosives-2 〔可升级〕

- **模块**：base
- **前置**：stronger-explosives-1、military-science-pack
- **成本**：红×1、绿×1、军×1 ｜ 时长: 30s
- **效果**：弹药伤害(grenade) +20%、弹药伤害(landmine) +20%

### stronger-explosives-3 〔可升级〕

- **模块**：base
- **前置**：stronger-explosives-2、chemical-science-pack
- **成本**：红×1、绿×1、军×1、蓝×1 ｜ 时长: 60s
- **效果**：弹药伤害(rocket) +30%、弹药伤害(grenade) +20%、弹药伤害(landmine) +20%

### stronger-explosives-4 〔可升级〕

- **模块**：base
- **前置**：stronger-explosives-3、utility-science-pack
- **成本**：红×1、绿×1、军×1、蓝×1、黄×1 ｜ 时长: 60s
- **效果**：弹药伤害(rocket) +40%、弹药伤害(grenade) +20%、弹药伤害(landmine) +20%

### stronger-explosives-5 〔可升级〕

- **模块**：base
- **前置**：stronger-explosives-4、space-science-pack
- **成本**：红×1、绿×1、军×1、蓝×1、黄×1、空间×1 ｜ 时长: 60s
- **效果**：弹药伤害(rocket) +50%、弹药伤害(grenade) +20%、弹药伤害(landmine) +20%

### stronger-explosives-6 〔可升级〕

- **模块**：base
- **前置**：stronger-explosives-5
- **成本**：红×1、绿×1、蓝×1、军×1、黄×1、空间×1 ｜ 时长: 60s
- **效果**：弹药伤害(rocket) +60%、弹药伤害(grenade) +20%、弹药伤害(landmine) +20%

### stronger-explosives-7 〔无限〕 〔可升级〕

- **模块**：base
- **前置**：stronger-explosives-6、agricultural-science-pack
- **成本**：红×1、绿×1、蓝×1、军×1、黄×1、空间×1、agricultural-science-pack×1 ｜ 时长: 60s
- **效果**：弹药伤害(rocket) +50%、弹药伤害(grenade) +20%、弹药伤害(landmine) +20%

### sulfur-processing

- **模块**：base
- **前置**：oil-processing
- **成本**：红×1、绿×1 ｜ 时长: 30s
- **效果**：解锁配方:sulfuric-acid、解锁配方:sulfur

### tank

- **模块**：base
- **前置**：automobilism、military-3、explosives
- **成本**：红×1、绿×1、蓝×1、军×1 ｜ 时长: 30s
- **效果**：解锁配方:tank、解锁配方:cannon-shell、解锁配方:explosive-cannon-shell

### tesla-weapons

- **模块**：space-age
- **前置**：electromagnetic-science-pack、military-4
- **成本**：红×1、绿×1、蓝×1、军×1、黄×1、空间×1、electromagnetic-science-pack×1 ｜ 时长: 60s
- **效果**：解锁配方:teslagun、解锁配方:tesla-turret、解锁配方:tesla-ammo

### toolbelt

- **模块**：base
- **前置**：logistic-science-pack
- **成本**：红×1、绿×1 ｜ 时长: 30s
- **效果**：character-inventory-slots-bonus +1000%

### toolbelt-equipment

- **模块**：space-age
- **前置**：power-armor、toolbelt、carbon-fiber
- **成本**：红×1、绿×1、蓝×1、空间×1、agricultural-science-pack×1 ｜ 时长: 30s
- **效果**：解锁配方:toolbelt-equipment

### transport-belt-capacity-1 〔可升级〕

- **模块**：space-age
- **前置**：stack-inserter
- **成本**：红×1、绿×1、蓝×1、紫×1、黄×1、空间×1、agricultural-science-pack×1 ｜ 时长: 60s
- **效果**：belt-stack-size-bonus +100%

### transport-belt-capacity-2 〔可升级〕

- **模块**：space-age
- **前置**：transport-belt-capacity-1、inserter-capacity-bonus-7
- **成本**：红×1、绿×1、蓝×1、紫×1、黄×1、空间×1、agricultural-science-pack×1 ｜ 时长: 60s
- **效果**：belt-stack-size-bonus +100%、机械臂堆叠 +100%

### tree-seeding

- **模块**：space-age
- **前置**：agricultural-science-pack
- **成本**：红×1、绿×1、蓝×1、空间×1、agricultural-science-pack×1 ｜ 时长: 60s
- **效果**：解锁配方:tree-seed

### tungsten-carbide

- **模块**：space-age
- **前置**：planet-discovery-vulcanus
- **成本**：无成本(触发式)
- **效果**：解锁配方:carbon、解锁配方:tungsten-carbide

### tungsten-steel

- **模块**：space-age
- **前置**：big-mining-drill
- **成本**：无成本(触发式)
- **效果**：解锁配方:tungsten-plate

### turbo-transport-belt

- **模块**：space-age
- **前置**：metallurgic-science-pack、logistics-3
- **成本**：红×1、绿×1、蓝×1、紫×1、空间×1、metallurgic-science-pack×1 ｜ 时长: 60s
- **效果**：解锁配方:turbo-transport-belt、解锁配方:turbo-underground-belt、解锁配方:turbo-splitter

### uranium-ammo

- **模块**：base
- **前置**：uranium-processing、military-4、tank
- **成本**：红×1、绿×1、蓝×1、军×1、黄×1 ｜ 时长: 45s
- **效果**：解锁配方:uranium-rounds-magazine、解锁配方:uranium-cannon-shell、解锁配方:explosive-uranium-cannon-shell

### uranium-mining

- **模块**：base
- **前置**：chemical-science-pack、concrete
- **成本**：红×1、绿×1、蓝×1 ｜ 时长: 30s
- **效果**：mining-with-fluid

### uranium-processing

- **模块**：base
- **前置**：uranium-mining
- **成本**：无成本(触发式)
- **效果**：解锁配方:centrifuge、解锁配方:uranium-processing

### utility-science-pack

- **模块**：base
- **前置**：robotics、processing-unit、low-density-structure
- **成本**：红×1、绿×1、蓝×1 ｜ 时长: 30s
- **效果**：解锁配方:utility-science-pack

### weapon-shooting-speed-1 〔可升级〕

- **模块**：base
- **前置**：military
- **成本**：红×1 ｜ 时长: 30s
- **效果**：枪械射速(bullet) +10%、枪械射速(shotgun-shell) +10%

### weapon-shooting-speed-2 〔可升级〕

- **模块**：base
- **前置**：weapon-shooting-speed-1、logistic-science-pack
- **成本**：红×1、绿×1 ｜ 时长: 30s
- **效果**：枪械射速(bullet) +20%、枪械射速(shotgun-shell) +20%

### weapon-shooting-speed-3 〔可升级〕

- **模块**：base
- **前置**：weapon-shooting-speed-2、military-science-pack
- **成本**：红×1、绿×1、军×1 ｜ 时长: 60s
- **效果**：枪械射速(bullet) +20%、枪械射速(shotgun-shell) +20%、枪械射速(rocket) +50%

### weapon-shooting-speed-4 〔可升级〕

- **模块**：base
- **前置**：weapon-shooting-speed-3
- **成本**：红×1、绿×1、军×1 ｜ 时长: 60s
- **效果**：枪械射速(bullet) +30%、枪械射速(shotgun-shell) +30%、枪械射速(rocket) +70%

### weapon-shooting-speed-5 〔可升级〕

- **模块**：base
- **前置**：weapon-shooting-speed-4、chemical-science-pack
- **成本**：红×1、绿×1、蓝×1、军×1 ｜ 时长: 60s
- **效果**：枪械射速(bullet) +30%、枪械射速(shotgun-shell) +40%、枪械射速(cannon-shell) +80%、枪械射速(rocket) +90%

### weapon-shooting-speed-6 〔可升级〕

- **模块**：base
- **前置**：weapon-shooting-speed-5、utility-science-pack
- **成本**：红×1、绿×1、蓝×1、军×1、黄×1 ｜ 时长: 60s
- **效果**：枪械射速(bullet) +40%、枪械射速(shotgun-shell) +40%、枪械射速(cannon-shell) +150%、枪械射速(rocket) +130%

### worker-robots-speed-1 〔可升级〕

- **模块**：base
- **前置**：robotics
- **成本**：红×1、绿×1、蓝×1 ｜ 时长: 30s
- **效果**：机器人速度 +35%

### worker-robots-speed-2 〔可升级〕

- **模块**：base
- **前置**：worker-robots-speed-1
- **成本**：红×1、绿×1、蓝×1 ｜ 时长: 30s
- **效果**：机器人速度 +40%

### worker-robots-speed-3 〔可升级〕

- **模块**：base
- **前置**：worker-robots-speed-2、utility-science-pack
- **成本**：红×1、绿×1、蓝×1、黄×1 ｜ 时长: 60s
- **效果**：机器人速度 +45%

### worker-robots-speed-4 〔可升级〕

- **模块**：base
- **前置**：worker-robots-speed-3
- **成本**：红×1、绿×1、蓝×1、黄×1 ｜ 时长: 60s
- **效果**：机器人速度 +55%

### worker-robots-speed-5 〔可升级〕

- **模块**：base
- **前置**：worker-robots-speed-4、production-science-pack
- **成本**：红×1、绿×1、蓝×1、紫×1、黄×1 ｜ 时长: 60s
- **效果**：机器人速度 +65%

### worker-robots-speed-6 〔可升级〕

- **模块**：base
- **前置**：worker-robots-speed-5、space-science-pack
- **成本**：红×1、绿×1、蓝×1、紫×1、黄×1、空间×1 ｜ 时长: 60s
- **效果**：机器人速度 +65%

### worker-robots-speed-7 〔无限〕 〔可升级〕

- **模块**：space-age
- **前置**：worker-robots-speed-6、electromagnetic-science-pack
- **成本**：红×1、绿×1、蓝×1、紫×1、黄×1、空间×1、electromagnetic-science-pack×1 ｜ 时长: 60s
- **效果**：机器人速度 +65%

### worker-robots-storage-1 〔可升级〕

- **模块**：base
- **前置**：robotics
- **成本**：红×1、绿×1、蓝×1 ｜ 时长: 30s
- **效果**：worker-robot-storage +100%

### worker-robots-storage-2 〔可升级〕

- **模块**：base
- **前置**：worker-robots-storage-1、production-science-pack
- **成本**：红×1、绿×1、蓝×1、紫×1 ｜ 时长: 60s
- **效果**：worker-robot-storage +100%

### worker-robots-storage-3 〔可升级〕

- **模块**：base
- **前置**：worker-robots-storage-2、utility-science-pack
- **成本**：红×1、绿×1、蓝×1、紫×1、黄×1 ｜ 时长: 60s
- **效果**：worker-robot-storage +100%

### yumako

- **模块**：space-age
- **前置**：agriculture
- **成本**：无成本(触发式)
- **效果**：解锁配方:yumako-processing、解锁配方:copper-bacteria
