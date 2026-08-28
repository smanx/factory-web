'use strict';

// ===== 自动生成文件：由 factorio-data 经 tools/generate-game-data.js 现场生成 =====
// 唯一数值源 = factorio-data（经 tools/convert-data.js 现场转换），请勿手改本文件。
// 重新生成：npm run data（或 node tools/generate-game-data.js）
// GAME_DATA 结构：
//   recipe[key] = { time, inp:{item:count}, out:{item:count} | prob:{item:p} }
//   recipeDevice[key] = 组装机/化工厂/炼油厂/离心机
//   stackSize[item] = 最大堆叠,  buildingHp[building] = 血量,  powerUse[building] = 功耗kW
//   deviceStats[id] = { craftingSpeed, moduleSlots, miningSpeed, beltSpeed(格/s), beaconEffectivity }
//   names[id] = { zh, en }（物品/建筑/流体官方命名，供中英文切换，见 data-util.js localizedName）
//   recipeNames[rid] = { zh, en }（配方官方命名，供炼油/离心机面板切换）
//   itemGroup[item] = 制作栏 5 Tab（物流/生产/中间产品/太空/武器）
//   itemSubgroup[item] = item-group 内二级分组（官方 item-subgroup）
//   subgroupOrder[subgroup] = subgroup 在 group 内官方顺序,  itemOrder[item] = 物品在 subgroup 内官方顺序
//   其余设备行为参数（官方接入，见对应设备文件 GAME_DATA.xxx?.[..] ?? 兜底）：
//   undergroundDist[带] = 地下带最大距离(格), renewable = { solarPower, accumCap, accumChargeRate }
//   fluidCapacity = { storageTank, fluidWagon, pumpRate, pipeVolume, pipeToGroundVolume }, beaconRange = 信号塔半径(格)
//   turret[塔] = { range, fireRate(秒) }, ammoDamage[弹药] = 伤害, radar = { range, power(kW) }
//   equipment[装备] = { powerOut | powerCap(kJ) | shield | speed | laser | dischargeRange/Cooldown }
//   heat = { reactorMaxTemp, reactorSpecificHeat, reactorMaxTransfer, heatPipeMaxTemp, heatPipeMinGlowTemp,
//           heatPipeSpecificHeat, heatPipeMaxTransfer, reactorHeatRate(MW),
//           heatingTowerRate(MW), heatingTowerEffectivity, heatingTowerMaxTemp,
//           heatingTowerSpecificHeat, heatingTowerMaxTransfer }, roboportPower(kW)
//   cargoLandingPad = { inventorySize, radarRange }, cargoBay = { inventorySizeBonus }（物流接驳站/扩展舱）
//   cargoUnloadingBay = { inventorySizeBonus, allowUnloading, unloadingDistance }（物流卸载舱）
//   footprint[building] = { w, h }（占地面积格数，官方 selection_box）
//   pollution[building] = 官方每分排放（emissions_per_minute.pollution，污染/分），供污染系统单源读取
//   recycling[item] = { time, out:{outItem:每批期望产出} }（官方 *-recycling 回收配方，供回收机单源读取）
//   fuelEnergy[item] = 燃料能量密度（项目相对刻度，供 burner 设备单源读取：煤=12 基准）
const GAME_DATA = {
 "stackSize": {
  "iron-ore": 50,
  "copper-ore": 50,
  "coal": 50,
  "solid-fuel": 50,
  "stone": 50,
  "stone-brick": 100,
  "calcite": 50,
  "iron-plate": 100,
  "copper-plate": 100,
  "iron-gear-wheel": 100,
  "iron-stick": 100,
  "copper-cable": 200,
  "electronic-circuit": 200,
  "automation-science-pack": 200,
  "transport-belt": 100,
  "inserter": 50,
  "burner-inserter": 50,
  "long-handed-inserter": 50,
  "burner-mining-drill": 50,
  "stone-furnace": 50,
  "assembling-machine-1": 50,
  "lab": 10,
  "biolab": 5,
  "small-lamp": 50,
  "substation": 50,
  "programmable-speaker": 10,
  "splitter": 50,
  "underground-belt": 50,
  "steel-plate": 100,
  "boiler": 50,
  "steam-engine": 10,
  "offshore-pump": 20,
  "electric-mining-drill": 50,
  "big-mining-drill": 20,
  "electric-furnace": 50,
  "assembling-machine-2": 50,
  "fast-transport-belt": 100,
  "fast-underground-belt": 50,
  "express-transport-belt": 100,
  "express-underground-belt": 50,
  "express-splitter": 50,
  "turbo-transport-belt": 100,
  "turbo-underground-belt": 50,
  "turbo-splitter": 50,
  "loader": 50,
  "fast-loader": 50,
  "express-loader": 50,
  "turbo-loader": 50,
  "fast-splitter": 50,
  "bulk-inserter": 50,
  "stack-inserter": 50,
  "fast-inserter": 50,
  "steel-chest": 50,
  "logistic-science-pack": 200,
  "chemical-science-pack": 200,
  "plastic-bar": 100,
  "pipe": 100,
  "pipe-to-ground": 50,
  "pump": 50,
  "one-way-valve": 10,
  "overflow-valve": 10,
  "top-up-valve": 10,
  "storage-tank": 50,
  "pumpjack": 20,
  "solar-panel": 50,
  "accumulator": 50,
  "steel-furnace": 50,
  "assembling-machine-3": 50,
  "military-science-pack": 200,
  "gun-turret": 50,
  "stone-wall": 100,
  "gate": 50,
  "firearm-magazine": 100,
  "piercing-rounds-magazine": 100,
  "oil-refinery": 10,
  "chemical-plant": 10,
  "pistol": 5,
  "submachine-gun": 5,
  "shotgun": 5,
  "combat-shotgun": 5,
  "shotgun-shell": 100,
  "piercing-shotgun-shell": 100,
  "cluster-grenade": 100,
  "rocket-launcher": 5,
  "grenade": 100,
  "rocket": 100,
  "explosive-rocket": 100,
  "flamethrower": 5,
  "flamethrower-ammo": 100,
  "uranium-rounds-magazine": 100,
  "atomic-bomb": 10,
  "uranium-cannon-shell": 100,
  "poison-capsule": 100,
  "slowdown-capsule": 100,
  "laser-turret": 50,
  "flamethrower-turret": 50,
  "speed-module": 50,
  "speed-module-2": 50,
  "speed-module-3": 50,
  "productivity-module": 50,
  "productivity-module-2": 50,
  "productivity-module-3": 50,
  "beacon": 20,
  "efficiency-module": 50,
  "efficiency-module-2": 50,
  "efficiency-module-3": 50,
  "quality-module": 50,
  "quality-module-2": 50,
  "quality-module-3": 50,
  "advanced-circuit": 200,
  "engine-unit": 50,
  "electric-engine-unit": 50,
  "processing-unit": 100,
  "low-density-structure": 50,
  "rocket-fuel": 20,
  "rocket-part": 5,
  "rocket-silo": 1,
  "cargo-landing-pad": 1,
  "cargo-bay": 10,
  "landing-pad-unloading-bay": 10,
  "radar": 50,
  "explosives": 50,
  "cliff-explosives": 20,
  "battery": 200,
  "flying-robot-frame": 50,
  "production-science-pack": 200,
  "utility-science-pack": 200,
  "defender-capsule": 100,
  "distractor-capsule": 100,
  "destroyer-capsule": 100,
  "car": 1,
  "tank": 1,
  "cannon-shell": 100,
  "explosive-cannon-shell": 100,
  "explosive-uranium-cannon-shell": 100,
  "light-armor": 1,
  "heavy-armor": 1,
  "spidertron": 1,
  "spidertron-remote": 1,
  "land-mine": 100,
  "artillery-turret": 10,
  "artillery-shell": 1,
  "artillery-targeting-remote": 1,
  "rail": 100,
  "locomotive": 5,
  "cargo-wagon": 5,
  "fluid-wagon": 5,
  "artillery-wagon": 5,
  "train-stop": 10,
  "rail-signal": 50,
  "rail-chain-signal": 50,
  "rail-support": 20,
  "rail-ramp": 10,
  "sulfur": 50,
  "carbon": 50,
  "carbon-fiber": 100,
  "lithium": 50,
  "lithium-plate": 100,
  "superconductor": 200,
  "electromagnetic-science-pack": 200,
  "electromagnetic-plant": 20,
  "recycler": 20,
  "holmium-ore": 50,
  "holmium-plate": 100,
  "teslagun": 5,
  "supercapacitor": 100,
  "tesla-turret": 10,
  "tesla-ammo": 100,
  "rocket-turret": 10,
  "railgun-turret": 10,
  "railgun-ammo": 10,
  "tungsten-ore": 50,
  "tungsten-plate": 50,
  "tungsten-carbide": 50,
  "metallurgic-science-pack": 200,
  "foundry": 20,
  "yumako": 50,
  "yumako-seed": 10,
  "yumako-mash": 100,
  "bioflux": 100,
  "nutrients": 100,
  "spoilage": 200,
  "agricultural-science-pack": 200,
  "biochamber": 20,
  "agricultural-tower": 20,
  "artificial-yumako-soil": 100,
  "overgrowth-yumako-soil": 100,
  "artificial-jellynut-soil": 100,
  "overgrowth-jellynut-soil": 100,
  "jellynut": 50,
  "jellynut-seed": 10,
  "jelly": 100,
  "biter-egg": 100,
  "pentapod-egg": 20,
  "tree-seed": 10,
  "captive-biter-spawner": 1,
  "capture-robot-rocket": 10,
  "iron-bacteria": 50,
  "copper-bacteria": 50,
  "crusher": 10,
  "metallic-asteroid-chunk": 1,
  "carbonic-asteroid-chunk": 1,
  "oxide-asteroid-chunk": 1,
  "promethium-asteroid-chunk": 1,
  "ice": 50,
  "space-platform-foundation": 100,
  "space-platform-hub": 1,
  "thruster": 10,
  "asteroid-collector": 10,
  "space-platform-starter-pack": 1,
  "roboport": 10,
  "logistic-robot": 50,
  "construction-robot": 50,
  "personal-roboport-equipment": 20,
  "personal-roboport-mk2-equipment": 20,
  "passive-provider-chest": 50,
  "active-provider-chest": 50,
  "storage-chest": 50,
  "buffer-chest": 50,
  "requester-chest": 50,
  "raw-fish": 100,
  "uranium-ore": 50,
  "uranium-235": 100,
  "uranium-238": 100,
  "nuclear-fuel": 1,
  "uranium-fuel-cell": 50,
  "depleted-uranium-fuel-cell": 50,
  "centrifuge": 10,
  "nuclear-reactor": 10,
  "steam-turbine": 10,
  "heat-pipe": 50,
  "heat-exchanger": 50,
  "heating-tower": 20,
  "fusion-reactor": 1,
  "fusion-generator": 5,
  "fusion-power-cell": 50,
  "lightning-rod": 50,
  "lightning-collector": 20,
  "small-electric-pole": 50,
  "medium-electric-pole": 50,
  "big-electric-pole": 50,
  "constant-combinator": 50,
  "arithmetic-combinator": 50,
  "decider-combinator": 50,
  "selector-combinator": 50,
  "display-panel": 10,
  "power-switch": 10,
  "red-wire": 1,
  "green-wire": 1,
  "concrete": 100,
  "refined-concrete": 100,
  "hazard-concrete": 100,
  "refined-hazard-concrete": 100,
  "landfill": 100,
  "foundation": 50,
  "ice-platform": 100,
  "modular-armor": 1,
  "power-armor": 1,
  "power-armor-mk2": 1,
  "solar-panel-equipment": 20,
  "fusion-reactor-equipment": 20,
  "battery-equipment": 20,
  "battery-mk2-equipment": 20,
  "exoskeleton-equipment": 20,
  "night-vision-equipment": 20,
  "personal-laser-defense-equipment": 20,
  "energy-shield-equipment": 20,
  "energy-shield-mk2-equipment": 20,
  "belt-immunity-equipment": 20,
  "discharge-defense-equipment": 20,
  "discharge-defense-remote": 1,
  "wood": 100,
  "wooden-chest": 50,
  "iron-chest": 50,
  "repair-pack": 100,
  "deconstruction-planner": 1,
  "upgrade-planner": 1,
  "space-science-pack": 200,
  "promethium-science-pack": 200,
  "cryogenic-plant": 20,
  "cryogenic-science-pack": 200,
  "quantum-processor": 100,
  "scrap": 50,
  "battery-mk3-equipment": 20,
  "fission-reactor-equipment": 20,
  "toolbelt-equipment": 20,
  "mech-armor": 1,
  "railgun": 1,
  "barrel": 10,
  "water-barrel": 10,
  "crude-oil-barrel": 10,
  "heavy-oil-barrel": 10,
  "light-oil-barrel": 10,
  "petroleum-gas-barrel": 10,
  "lubricant-barrel": 10,
  "sulfuric-acid-barrel": 10,
  "fluoroketone-cold-barrel": 10,
  "fluoroketone-hot-barrel": 10
 },
 "buildingHp": {
  "transport-belt": 150,
  "fast-transport-belt": 160,
  "express-transport-belt": 170,
  "turbo-transport-belt": 170,
  "underground-belt": 150,
  "fast-underground-belt": 160,
  "express-underground-belt": 170,
  "turbo-underground-belt": 170,
  "splitter": 170,
  "fast-splitter": 180,
  "express-splitter": 190,
  "turbo-splitter": 190,
  "loader": 170,
  "fast-loader": 170,
  "express-loader": 170,
  "turbo-loader": 170,
  "inserter": 150,
  "burner-inserter": 100,
  "small-lamp": 100,
  "programmable-speaker": 150,
  "long-handed-inserter": 160,
  "bulk-inserter": 160,
  "fast-inserter": 150,
  "stack-inserter": 160,
  "burner-mining-drill": 150,
  "stone-furnace": 200,
  "steel-furnace": 300,
  "assembling-machine-1": 300,
  "assembling-machine-3": 400,
  "electromagnetic-plant": 350,
  "recycler": 300,
  "biochamber": 300,
  "crusher": 350,
  "foundry": 350,
  "agricultural-tower": 500,
  "cryogenic-plant": 350,
  "beacon": 200,
  "wooden-chest": 100,
  "iron-chest": 200,
  "steel-chest": 350,
  "lab": 150,
  "biolab": 350,
  "captive-biter-spawner": 350,
  "boiler": 200,
  "steam-engine": 400,
  "offshore-pump": 150,
  "electric-mining-drill": 300,
  "big-mining-drill": 300,
  "electric-furnace": 350,
  "assembling-machine-2": 350,
  "pipe": 100,
  "pipe-to-ground": 150,
  "pump": 180,
  "one-way-valve": 100,
  "overflow-valve": 100,
  "top-up-valve": 100,
  "solar-panel": 200,
  "accumulator": 150,
  "gun-turret": 400,
  "laser-turret": 1000,
  "tesla-turret": 2000,
  "flamethrower-turret": 1400,
  "rocket-turret": 1500,
  "railgun-turret": 4000,
  "rocket-silo": 5000,
  "cargo-landing-pad": 1000,
  "cargo-bay": 1000,
  "landing-pad-unloading-bay": 1000,
  "radar": 250,
  "stone-wall": 350,
  "gate": 350,
  "pumpjack": 200,
  "oil-refinery": 350,
  "chemical-plant": 300,
  "storage-tank": 500,
  "centrifuge": 350,
  "nuclear-reactor": 500,
  "steam-turbine": 300,
  "heat-pipe": 200,
  "heat-exchanger": 200,
  "heating-tower": 500,
  "fusion-reactor": 1000,
  "fusion-generator": 1000,
  "lightning-rod": 100,
  "lightning-collector": 200,
  "space-platform-hub": 5000,
  "thruster": 300,
  "asteroid-collector": 300,
  "roboport": 500,
  "locomotive": 1000,
  "cargo-wagon": 600,
  "fluid-wagon": 600,
  "artillery-wagon": 600,
  "train-stop": 250,
  "rail-signal": 100,
  "rail-chain-signal": 100,
  "rail-support": 1000,
  "rail-ramp": 2000,
  "car": 450,
  "tank": 2000,
  "spidertron": 3000,
  "land-mine": 15,
  "artillery-turret": 2000,
  "passive-provider-chest": 350,
  "active-provider-chest": 350,
  "storage-chest": 350,
  "requester-chest": 350,
  "buffer-chest": 350,
  "small-electric-pole": 100,
  "medium-electric-pole": 100,
  "big-electric-pole": 150,
  "constant-combinator": 120,
  "arithmetic-combinator": 150,
  "decider-combinator": 150,
  "selector-combinator": 150,
  "display-panel": 50,
  "power-switch": 200,
  "substation": 200
 },
 "powerUse": {
  "burner-mining-drill": 150,
  "stone-furnace": 90,
  "steel-furnace": 90,
  "assembling-machine-1": 75,
  "assembling-machine-3": 375,
  "electromagnetic-plant": 2000,
  "recycler": 180,
  "biochamber": 500,
  "crusher": 540,
  "foundry": 2500,
  "agricultural-tower": 100,
  "cryogenic-plant": 1500,
  "beacon": 480,
  "lab": 60,
  "biolab": 300,
  "captive-biter-spawner": 100,
  "offshore-pump": 60,
  "electric-mining-drill": 90,
  "big-mining-drill": 300,
  "electric-furnace": 180,
  "assembling-machine-2": 150,
  "pump": 29,
  "rocket-silo": 250,
  "radar": 300,
  "pumpjack": 90,
  "oil-refinery": 420,
  "chemical-plant": 210,
  "centrifuge": 350,
  "roboport": 50
 },
 "deviceStats": {
  "assembling-machine-1": {
   "craftingSpeed": 0.5,
   "moduleSlots": 0
  },
  "assembling-machine-2": {
   "craftingSpeed": 0.75,
   "moduleSlots": 2
  },
  "assembling-machine-3": {
   "craftingSpeed": 1.25,
   "moduleSlots": 4
  },
  "electric-furnace": {
   "craftingSpeed": 2,
   "moduleSlots": 2
  },
  "steel-furnace": {
   "craftingSpeed": 2
  },
  "stone-furnace": {
   "craftingSpeed": 1
  },
  "electric-mining-drill": {
   "moduleSlots": 3,
   "miningSpeed": 0.5
  },
  "burner-mining-drill": {
   "miningSpeed": 0.25
  },
  "pumpjack": {
   "moduleSlots": 2,
   "miningSpeed": 1
  },
  "big-mining-drill": {
   "moduleSlots": 4,
   "miningSpeed": 2.5
  },
  "lab": {
   "moduleSlots": 2,
   "researchingSpeed": 1
  },
  "beacon": {
   "moduleSlots": 2,
   "beaconEffectivity": 1.5
  },
  "transport-belt": {
   "beltSpeed": 1.875
  },
  "fast-transport-belt": {
   "beltSpeed": 3.75
  },
  "express-transport-belt": {
   "beltSpeed": 5.625
  },
  "turbo-transport-belt": {
   "beltSpeed": 7.5
  },
  "loader": {
   "beltSpeed": 1.875
  },
  "fast-loader": {
   "beltSpeed": 3.75
  },
  "express-loader": {
   "beltSpeed": 5.625
  },
  "turbo-loader": {
   "beltSpeed": 7.5
  },
  "underground-belt": {
   "beltSpeed": 1.875
  },
  "fast-underground-belt": {
   "beltSpeed": 3.75
  },
  "express-underground-belt": {
   "beltSpeed": 5.625
  },
  "turbo-underground-belt": {
   "beltSpeed": 7.5
  },
  "oil-refinery": {
   "craftingSpeed": 1,
   "moduleSlots": 3
  },
  "chemical-plant": {
   "craftingSpeed": 1,
   "moduleSlots": 3
  },
  "centrifuge": {
   "craftingSpeed": 1,
   "moduleSlots": 2
  },
  "electromagnetic-plant": {
   "craftingSpeed": 2,
   "moduleSlots": 5
  },
  "recycler": {
   "craftingSpeed": 0.5,
   "moduleSlots": 4
  },
  "biochamber": {
   "craftingSpeed": 2,
   "moduleSlots": 4
  },
  "crusher": {
   "craftingSpeed": 1,
   "moduleSlots": 2
  },
  "foundry": {
   "craftingSpeed": 4,
   "moduleSlots": 4
  },
  "cryogenic-plant": {
   "craftingSpeed": 2,
   "moduleSlots": 8
  },
  "captive-biter-spawner": {
   "craftingSpeed": 1,
   "moduleSlots": 0
  },
  "biolab": {
   "moduleSlots": 4,
   "researchingSpeed": 2
  }
 },
 "recipe": {
  "steel-plate": {
   "time": 16,
   "inp": {
    "iron-plate": 5
   },
   "out": {
    "steel-plate": 1
   }
  },
  "iron-gear-wheel": {
   "time": 0.5,
   "inp": {
    "iron-plate": 2
   },
   "out": {
    "iron-gear-wheel": 1
   }
  },
  "iron-stick": {
   "time": 0.5,
   "inp": {
    "iron-plate": 1
   },
   "out": {
    "iron-stick": 2
   }
  },
  "copper-cable": {
   "time": 0.5,
   "inp": {
    "copper-plate": 1
   },
   "out": {
    "copper-cable": 2
   }
  },
  "electronic-circuit": {
   "time": 0.5,
   "inp": {
    "iron-plate": 1,
    "copper-cable": 3
   },
   "out": {
    "electronic-circuit": 1
   }
  },
  "automation-science-pack": {
   "time": 5,
   "inp": {
    "copper-plate": 1,
    "iron-gear-wheel": 1
   },
   "out": {
    "automation-science-pack": 1
   }
  },
  "transport-belt": {
   "time": 0.5,
   "inp": {
    "iron-plate": 1,
    "iron-gear-wheel": 1
   },
   "out": {
    "transport-belt": 2
   }
  },
  "fast-transport-belt": {
   "time": 0.5,
   "inp": {
    "iron-gear-wheel": 5,
    "transport-belt": 1
   },
   "out": {
    "fast-transport-belt": 1
   }
  },
  "express-transport-belt": {
   "time": 0.5,
   "inp": {
    "iron-gear-wheel": 10,
    "fast-transport-belt": 1,
    "lubricant": 20
   },
   "out": {
    "express-transport-belt": 1
   }
  },
  "underground-belt": {
   "time": 1,
   "inp": {
    "iron-plate": 10,
    "transport-belt": 5
   },
   "out": {
    "underground-belt": 2
   }
  },
  "fast-underground-belt": {
   "time": 2,
   "inp": {
    "iron-gear-wheel": 40,
    "underground-belt": 2
   },
   "out": {
    "fast-underground-belt": 2
   }
  },
  "express-underground-belt": {
   "time": 2,
   "inp": {
    "iron-gear-wheel": 80,
    "fast-underground-belt": 2,
    "lubricant": 40
   },
   "out": {
    "express-underground-belt": 2
   }
  },
  "splitter": {
   "time": 1,
   "inp": {
    "electronic-circuit": 5,
    "iron-plate": 5,
    "transport-belt": 4
   },
   "out": {
    "splitter": 1
   }
  },
  "fast-splitter": {
   "time": 2,
   "inp": {
    "splitter": 1,
    "iron-gear-wheel": 10,
    "electronic-circuit": 10
   },
   "out": {
    "fast-splitter": 1
   }
  },
  "express-splitter": {
   "time": 2,
   "inp": {
    "fast-splitter": 1,
    "iron-gear-wheel": 10,
    "advanced-circuit": 10,
    "lubricant": 80
   },
   "out": {
    "express-splitter": 1
   }
  },
  "turbo-transport-belt": {
   "time": 0.5,
   "inp": {
    "tungsten-plate": 5,
    "express-transport-belt": 1,
    "lubricant": 20
   },
   "out": {
    "turbo-transport-belt": 1
   }
  },
  "turbo-underground-belt": {
   "time": 2,
   "inp": {
    "tungsten-plate": 40,
    "express-underground-belt": 2,
    "lubricant": 40
   },
   "out": {
    "turbo-underground-belt": 2
   }
  },
  "turbo-splitter": {
   "time": 2,
   "inp": {
    "express-splitter": 1,
    "tungsten-plate": 15,
    "processing-unit": 2,
    "lubricant": 80
   },
   "out": {
    "turbo-splitter": 1
   }
  },
  "loader": {
   "time": 1,
   "inp": {
    "inserter": 5,
    "electronic-circuit": 5,
    "iron-gear-wheel": 5,
    "iron-plate": 5,
    "transport-belt": 5
   },
   "out": {
    "loader": 1
   }
  },
  "fast-loader": {
   "time": 3,
   "inp": {
    "fast-transport-belt": 5,
    "loader": 1
   },
   "out": {
    "fast-loader": 1
   }
  },
  "express-loader": {
   "time": 10,
   "inp": {
    "express-transport-belt": 5,
    "fast-loader": 1
   },
   "out": {
    "express-loader": 1
   }
  },
  "turbo-loader": {
   "time": 20,
   "inp": {
    "turbo-transport-belt": 5,
    "express-loader": 1
   },
   "out": {
    "turbo-loader": 1
   }
  },
  "inserter": {
   "time": 0.5,
   "inp": {
    "electronic-circuit": 1,
    "iron-gear-wheel": 1,
    "iron-plate": 1
   },
   "out": {
    "inserter": 1
   }
  },
  "burner-inserter": {
   "time": 0.5,
   "inp": {
    "iron-plate": 1,
    "iron-gear-wheel": 1
   },
   "out": {
    "burner-inserter": 1
   }
  },
  "long-handed-inserter": {
   "time": 0.5,
   "inp": {
    "iron-gear-wheel": 1,
    "iron-plate": 1,
    "inserter": 1
   },
   "out": {
    "long-handed-inserter": 1
   }
  },
  "fast-inserter": {
   "time": 0.5,
   "inp": {
    "electronic-circuit": 2,
    "iron-plate": 2,
    "inserter": 1
   },
   "out": {
    "fast-inserter": 1
   }
  },
  "burner-mining-drill": {
   "time": 2,
   "inp": {
    "iron-gear-wheel": 3,
    "stone-furnace": 1,
    "iron-plate": 3
   },
   "out": {
    "burner-mining-drill": 1
   }
  },
  "stone-furnace": {
   "time": 0.5,
   "inp": {
    "stone": 5
   },
   "out": {
    "stone-furnace": 1
   }
  },
  "assembling-machine-1": {
   "time": 0.5,
   "inp": {
    "electronic-circuit": 3,
    "iron-gear-wheel": 5,
    "iron-plate": 9
   },
   "out": {
    "assembling-machine-1": 1
   }
  },
  "lab": {
   "time": 2,
   "inp": {
    "electronic-circuit": 10,
    "iron-gear-wheel": 10,
    "transport-belt": 4
   },
   "out": {
    "lab": 1
   }
  },
  "boiler": {
   "time": 0.5,
   "inp": {
    "stone-furnace": 1,
    "pipe": 4
   },
   "out": {
    "boiler": 1
   }
  },
  "steam-engine": {
   "time": 0.5,
   "inp": {
    "iron-gear-wheel": 8,
    "pipe": 5,
    "iron-plate": 10
   },
   "out": {
    "steam-engine": 1
   }
  },
  "offshore-pump": {
   "time": 0.5,
   "inp": {
    "pipe": 3,
    "iron-gear-wheel": 2
   },
   "out": {
    "offshore-pump": 1
   }
  },
  "electric-mining-drill": {
   "time": 2,
   "inp": {
    "electronic-circuit": 3,
    "iron-gear-wheel": 5,
    "iron-plate": 10
   },
   "out": {
    "electric-mining-drill": 1
   }
  },
  "big-mining-drill": {
   "time": 30,
   "inp": {
    "electric-mining-drill": 1,
    "molten-iron": 200,
    "tungsten-carbide": 20,
    "electric-engine-unit": 10,
    "advanced-circuit": 10
   },
   "out": {
    "big-mining-drill": 1
   }
  },
  "electric-furnace": {
   "time": 5,
   "inp": {
    "steel-plate": 10,
    "advanced-circuit": 5,
    "stone-brick": 10
   },
   "out": {
    "electric-furnace": 1
   }
  },
  "assembling-machine-2": {
   "time": 0.5,
   "inp": {
    "steel-plate": 2,
    "electronic-circuit": 3,
    "iron-gear-wheel": 5,
    "assembling-machine-1": 1
   },
   "out": {
    "assembling-machine-2": 1
   }
  },
  "bulk-inserter": {
   "time": 0.5,
   "inp": {
    "iron-gear-wheel": 15,
    "electronic-circuit": 15,
    "advanced-circuit": 1,
    "fast-inserter": 1
   },
   "out": {
    "bulk-inserter": 1
   }
  },
  "stack-inserter": {
   "time": 0.5,
   "inp": {
    "bulk-inserter": 1,
    "processing-unit": 1,
    "carbon-fiber": 2,
    "jelly": 10
   },
   "out": {
    "stack-inserter": 1
   }
  },
  "logistic-science-pack": {
   "time": 6,
   "inp": {
    "inserter": 1,
    "transport-belt": 1
   },
   "out": {
    "logistic-science-pack": 1
   }
  },
  "pipe": {
   "time": 0.5,
   "inp": {
    "iron-plate": 1
   },
   "out": {
    "pipe": 1
   }
  },
  "pumpjack": {
   "time": 5,
   "inp": {
    "steel-plate": 5,
    "iron-gear-wheel": 10,
    "electronic-circuit": 5,
    "pipe": 10
   },
   "out": {
    "pumpjack": 1
   }
  },
  "oil-refinery": {
   "time": 8,
   "inp": {
    "steel-plate": 15,
    "iron-gear-wheel": 10,
    "stone-brick": 10,
    "electronic-circuit": 10,
    "pipe": 10
   },
   "out": {
    "oil-refinery": 1
   }
  },
  "chemical-plant": {
   "time": 5,
   "inp": {
    "steel-plate": 5,
    "iron-gear-wheel": 5,
    "electronic-circuit": 5,
    "pipe": 5
   },
   "out": {
    "chemical-plant": 1
   }
  },
  "storage-tank": {
   "time": 3,
   "inp": {
    "iron-plate": 20,
    "steel-plate": 5
   },
   "out": {
    "storage-tank": 1
   }
  },
  "steel-chest": {
   "time": 0.5,
   "inp": {
    "steel-plate": 8
   },
   "out": {
    "steel-chest": 1
   }
  },
  "wooden-chest": {
   "time": 0.5,
   "inp": {
    "wood": 2
   },
   "out": {
    "wooden-chest": 1
   }
  },
  "tree-seed": {
   "time": 2,
   "inp": {
    "wood": 2
   },
   "out": {
    "tree-seed": 1
   }
  },
  "iron-chest": {
   "time": 0.5,
   "inp": {
    "iron-plate": 8
   },
   "out": {
    "iron-chest": 1
   }
  },
  "repair-pack": {
   "time": 0.5,
   "inp": {
    "electronic-circuit": 2,
    "iron-gear-wheel": 2
   },
   "out": {
    "repair-pack": 1
   }
  },
  "steel-furnace": {
   "time": 3,
   "inp": {
    "steel-plate": 6,
    "stone-brick": 10
   },
   "out": {
    "steel-furnace": 1
   }
  },
  "assembling-machine-3": {
   "time": 0.5,
   "inp": {
    "assembling-machine-2": 2,
    "speed-module": 4
   },
   "out": {
    "assembling-machine-3": 1
   }
  },
  "pipe-to-ground": {
   "time": 0.5,
   "inp": {
    "pipe": 10,
    "iron-plate": 5
   },
   "out": {
    "pipe-to-ground": 2
   }
  },
  "pump": {
   "time": 2,
   "inp": {
    "engine-unit": 1,
    "steel-plate": 1,
    "pipe": 1
   },
   "out": {
    "pump": 1
   }
  },
  "solar-panel": {
   "time": 10,
   "inp": {
    "steel-plate": 5,
    "electronic-circuit": 15,
    "copper-plate": 5
   },
   "out": {
    "solar-panel": 1
   }
  },
  "accumulator": {
   "time": 10,
   "inp": {
    "iron-plate": 2,
    "battery": 5
   },
   "out": {
    "accumulator": 1
   }
  },
  "military-science-pack": {
   "time": 10,
   "inp": {
    "piercing-rounds-magazine": 1,
    "grenade": 1,
    "stone-wall": 2
   },
   "out": {
    "military-science-pack": 2
   }
  },
  "flying-robot-frame": {
   "time": 20,
   "inp": {
    "electric-engine-unit": 1,
    "battery": 2,
    "steel-plate": 1,
    "electronic-circuit": 3
   },
   "out": {
    "flying-robot-frame": 1
   }
  },
  "production-science-pack": {
   "time": 21,
   "inp": {
    "electric-furnace": 1,
    "productivity-module": 1,
    "rail": 30
   },
   "out": {
    "production-science-pack": 3
   }
  },
  "utility-science-pack": {
   "time": 21,
   "inp": {
    "low-density-structure": 3,
    "processing-unit": 2,
    "flying-robot-frame": 1
   },
   "out": {
    "utility-science-pack": 3
   }
  },
  "gun-turret": {
   "time": 8,
   "inp": {
    "iron-gear-wheel": 10,
    "copper-plate": 10,
    "iron-plate": 20
   },
   "out": {
    "gun-turret": 1
   }
  },
  "stone-wall": {
   "time": 0.5,
   "inp": {
    "stone-brick": 5
   },
   "out": {
    "stone-wall": 1
   }
  },
  "gate": {
   "time": 0.5,
   "inp": {
    "stone-wall": 1,
    "steel-plate": 2,
    "electronic-circuit": 2
   },
   "out": {
    "gate": 1
   }
  },
  "firearm-magazine": {
   "time": 1,
   "inp": {
    "iron-plate": 4
   },
   "out": {
    "firearm-magazine": 1
   }
  },
  "piercing-rounds-magazine": {
   "time": 6,
   "inp": {
    "firearm-magazine": 2,
    "steel-plate": 1,
    "copper-plate": 2
   },
   "out": {
    "piercing-rounds-magazine": 2
   }
  },
  "plastic-bar": {
   "time": 1,
   "inp": {
    "petroleum-gas": 20,
    "coal": 1
   },
   "out": {
    "plastic-bar": 2
   }
  },
  "crack-light": {
   "time": 2,
   "inp": {
    "water": 30,
    "heavy-oil": 40
   },
   "out": {
    "light-oil": 30
   }
  },
  "crack-gas": {
   "time": 2,
   "inp": {
    "water": 30,
    "light-oil": 30
   },
   "out": {
    "petroleum-gas": 20
   }
  },
  "lubricant": {
   "time": 1,
   "inp": {
    "heavy-oil": 10
   },
   "out": {
    "lubricant": 10
   }
  },
  "solid-fuel": {
   "time": 1,
   "inp": {
    "petroleum-gas": 20
   },
   "out": {
    "solid-fuel": 1
   }
  },
  "solid-fuel-light-oil": {
   "time": 1,
   "inp": {
    "light-oil": 10
   },
   "out": {
    "solid-fuel": 1
   }
  },
  "solid-fuel-heavy-oil": {
   "time": 1,
   "inp": {
    "heavy-oil": 20
   },
   "out": {
    "solid-fuel": 1
   }
  },
  "rail": {
   "time": 0.5,
   "inp": {
    "stone": 1,
    "iron-stick": 1,
    "steel-plate": 1
   },
   "out": {
    "rail": 2
   }
  },
  "locomotive": {
   "time": 4,
   "inp": {
    "engine-unit": 20,
    "electronic-circuit": 10,
    "steel-plate": 30
   },
   "out": {
    "locomotive": 1
   }
  },
  "cargo-wagon": {
   "time": 1,
   "inp": {
    "iron-gear-wheel": 10,
    "iron-plate": 20,
    "steel-plate": 20
   },
   "out": {
    "cargo-wagon": 1
   }
  },
  "fluid-wagon": {
   "time": 1.5,
   "inp": {
    "iron-gear-wheel": 10,
    "steel-plate": 16,
    "pipe": 8,
    "storage-tank": 1
   },
   "out": {
    "fluid-wagon": 1
   }
  },
  "artillery-wagon": {
   "time": 4,
   "inp": {
    "engine-unit": 60,
    "tungsten-plate": 60,
    "refined-concrete": 60,
    "iron-gear-wheel": 40,
    "processing-unit": 10
   },
   "out": {
    "artillery-wagon": 1
   }
  },
  "train-stop": {
   "time": 0.5,
   "inp": {
    "electronic-circuit": 5,
    "iron-plate": 6,
    "iron-stick": 6,
    "steel-plate": 3
   },
   "out": {
    "train-stop": 1
   }
  },
  "rail-signal": {
   "time": 0.5,
   "inp": {
    "electronic-circuit": 1,
    "iron-plate": 5
   },
   "out": {
    "rail-signal": 1
   }
  },
  "rail-chain-signal": {
   "time": 0.5,
   "inp": {
    "electronic-circuit": 1,
    "iron-plate": 5
   },
   "out": {
    "rail-chain-signal": 1
   }
  },
  "rail-support": {
   "time": 0.5,
   "inp": {
    "refined-concrete": 20,
    "steel-plate": 10
   },
   "out": {
    "rail-support": 1
   }
  },
  "rail-ramp": {
   "time": 0.5,
   "inp": {
    "refined-concrete": 100,
    "rail": 8,
    "steel-plate": 10
   },
   "out": {
    "rail-ramp": 1
   }
  },
  "car": {
   "time": 2,
   "inp": {
    "engine-unit": 8,
    "iron-plate": 20,
    "steel-plate": 5
   },
   "out": {
    "car": 1
   }
  },
  "tank": {
   "time": 5,
   "inp": {
    "engine-unit": 32,
    "steel-plate": 50,
    "iron-gear-wheel": 15,
    "advanced-circuit": 10
   },
   "out": {
    "tank": 1
   }
  },
  "cannon-shell": {
   "time": 8,
   "inp": {
    "steel-plate": 2,
    "plastic-bar": 2,
    "explosives": 1
   },
   "out": {
    "cannon-shell": 1
   }
  },
  "explosive-cannon-shell": {
   "time": 8,
   "inp": {
    "steel-plate": 2,
    "plastic-bar": 2,
    "explosives": 2
   },
   "out": {
    "explosive-cannon-shell": 1
   }
  },
  "explosive-uranium-cannon-shell": {
   "time": 12,
   "inp": {
    "explosive-cannon-shell": 1,
    "uranium-238": 1
   },
   "out": {
    "explosive-uranium-cannon-shell": 1
   }
  },
  "light-armor": {
   "time": 3,
   "inp": {
    "iron-plate": 40
   },
   "out": {
    "light-armor": 1
   }
  },
  "heavy-armor": {
   "time": 8,
   "inp": {
    "copper-plate": 100,
    "steel-plate": 50
   },
   "out": {
    "heavy-armor": 1
   }
  },
  "spidertron": {
   "time": 10,
   "inp": {
    "exoskeleton-equipment": 4,
    "fission-reactor-equipment": 2,
    "rocket-turret": 1,
    "radar": 2,
    "raw-fish": 1
   },
   "out": {
    "spidertron": 1
   }
  },
  "land-mine": {
   "time": 5,
   "inp": {
    "steel-plate": 1,
    "explosives": 2
   },
   "out": {
    "land-mine": 4
   }
  },
  "cliff-explosives": {
   "time": 8,
   "inp": {
    "explosives": 10,
    "calcite": 10,
    "grenade": 1,
    "barrel": 1
   },
   "out": {
    "cliff-explosives": 1
   }
  },
  "artillery-turret": {
   "time": 40,
   "inp": {
    "tungsten-plate": 60,
    "refined-concrete": 60,
    "iron-gear-wheel": 40,
    "processing-unit": 10
   },
   "out": {
    "artillery-turret": 1
   }
  },
  "artillery-shell": {
   "time": 15,
   "inp": {
    "radar": 1,
    "calcite": 1,
    "tungsten-plate": 4,
    "explosives": 8
   },
   "out": {
    "artillery-shell": 1
   }
  },
  "pistol": {
   "time": 5,
   "inp": {
    "copper-plate": 5,
    "iron-plate": 5
   },
   "out": {
    "pistol": 1
   }
  },
  "submachine-gun": {
   "time": 10,
   "inp": {
    "iron-gear-wheel": 10,
    "copper-plate": 5,
    "iron-plate": 10
   },
   "out": {
    "submachine-gun": 1
   }
  },
  "shotgun": {
   "time": 10,
   "inp": {
    "iron-plate": 15,
    "iron-gear-wheel": 5,
    "copper-plate": 10,
    "wood": 5
   },
   "out": {
    "shotgun": 1
   }
  },
  "rocket-launcher": {
   "time": 10,
   "inp": {
    "iron-plate": 5,
    "iron-gear-wheel": 5,
    "electronic-circuit": 5
   },
   "out": {
    "rocket-launcher": 1
   }
  },
  "grenade": {
   "time": 8,
   "inp": {
    "iron-plate": 5,
    "coal": 10
   },
   "out": {
    "grenade": 1
   }
  },
  "cluster-grenade": {
   "time": 8,
   "inp": {
    "grenade": 7,
    "explosives": 5,
    "steel-plate": 5
   },
   "out": {
    "cluster-grenade": 1
   }
  },
  "shotgun-shell": {
   "time": 3,
   "inp": {
    "copper-plate": 2,
    "iron-plate": 2
   },
   "out": {
    "shotgun-shell": 1
   }
  },
  "piercing-shotgun-shell": {
   "time": 8,
   "inp": {
    "shotgun-shell": 2,
    "copper-plate": 2,
    "steel-plate": 1
   },
   "out": {
    "piercing-shotgun-shell": 2
   }
  },
  "combat-shotgun": {
   "time": 10,
   "inp": {
    "steel-plate": 15,
    "iron-gear-wheel": 5,
    "copper-plate": 10,
    "wood": 10
   },
   "out": {
    "combat-shotgun": 1
   }
  },
  "rocket": {
   "time": 4,
   "inp": {
    "explosives": 1,
    "iron-plate": 2
   },
   "out": {
    "rocket": 1
   }
  },
  "explosive-rocket": {
   "time": 8,
   "inp": {
    "rocket": 1,
    "explosives": 2
   },
   "out": {
    "explosive-rocket": 1
   }
  },
  "atomic-bomb": {
   "time": 50,
   "inp": {
    "processing-unit": 10,
    "explosives": 10,
    "uranium-235": 100
   },
   "out": {
    "atomic-bomb": 1
   }
  },
  "flamethrower": {
   "time": 10,
   "inp": {
    "steel-plate": 5,
    "iron-gear-wheel": 10
   },
   "out": {
    "flamethrower": 1
   }
  },
  "uranium-rounds-magazine": {
   "time": 10,
   "inp": {
    "piercing-rounds-magazine": 1,
    "uranium-238": 1
   },
   "out": {
    "uranium-rounds-magazine": 1
   }
  },
  "uranium-cannon-shell": {
   "time": 12,
   "inp": {
    "cannon-shell": 1,
    "uranium-238": 1
   },
   "out": {
    "uranium-cannon-shell": 1
   }
  },
  "poison-capsule": {
   "time": 8,
   "inp": {
    "steel-plate": 3,
    "electronic-circuit": 3,
    "coal": 10
   },
   "out": {
    "poison-capsule": 1
   }
  },
  "slowdown-capsule": {
   "time": 8,
   "inp": {
    "steel-plate": 2,
    "electronic-circuit": 2,
    "coal": 5
   },
   "out": {
    "slowdown-capsule": 1
   }
  },
  "flamethrower-ammo": {
   "time": 6,
   "inp": {
    "steel-plate": 5,
    "crude-oil": 100
   },
   "out": {
    "flamethrower-ammo": 1
   }
  },
  "laser-turret": {
   "time": 20,
   "inp": {
    "steel-plate": 20,
    "electronic-circuit": 20,
    "battery": 12
   },
   "out": {
    "laser-turret": 1
   }
  },
  "flamethrower-turret": {
   "time": 20,
   "inp": {
    "steel-plate": 30,
    "iron-gear-wheel": 15,
    "pipe": 10,
    "engine-unit": 5
   },
   "out": {
    "flamethrower-turret": 1
   }
  },
  "speed-module": {
   "time": 15,
   "inp": {
    "advanced-circuit": 5,
    "electronic-circuit": 5
   },
   "out": {
    "speed-module": 1
   }
  },
  "speed-module-2": {
   "time": 30,
   "inp": {
    "speed-module": 4,
    "advanced-circuit": 5,
    "processing-unit": 5
   },
   "out": {
    "speed-module-2": 1
   }
  },
  "speed-module-3": {
   "time": 60,
   "inp": {
    "speed-module-2": 4,
    "advanced-circuit": 5,
    "processing-unit": 5,
    "tungsten-carbide": 1
   },
   "out": {
    "speed-module-3": 1
   }
  },
  "productivity-module": {
   "time": 15,
   "inp": {
    "advanced-circuit": 5,
    "electronic-circuit": 5
   },
   "out": {
    "productivity-module": 1
   }
  },
  "productivity-module-2": {
   "time": 30,
   "inp": {
    "productivity-module": 4,
    "advanced-circuit": 5,
    "processing-unit": 5
   },
   "out": {
    "productivity-module-2": 1
   }
  },
  "productivity-module-3": {
   "time": 60,
   "inp": {
    "productivity-module-2": 4,
    "advanced-circuit": 5,
    "processing-unit": 5,
    "biter-egg": 1
   },
   "out": {
    "productivity-module-3": 1
   }
  },
  "efficiency-module": {
   "time": 15,
   "inp": {
    "advanced-circuit": 5,
    "electronic-circuit": 5
   },
   "out": {
    "efficiency-module": 1
   }
  },
  "efficiency-module-2": {
   "time": 30,
   "inp": {
    "efficiency-module": 4,
    "advanced-circuit": 5,
    "processing-unit": 5
   },
   "out": {
    "efficiency-module-2": 1
   }
  },
  "efficiency-module-3": {
   "time": 60,
   "inp": {
    "efficiency-module-2": 4,
    "advanced-circuit": 5,
    "processing-unit": 5,
    "spoilage": 5
   },
   "out": {
    "efficiency-module-3": 1
   }
  },
  "quality-module": {
   "time": 15,
   "inp": {
    "electronic-circuit": 5,
    "advanced-circuit": 5
   },
   "out": {
    "quality-module": 1
   }
  },
  "quality-module-2": {
   "time": 30,
   "inp": {
    "quality-module": 4,
    "advanced-circuit": 5,
    "processing-unit": 5
   },
   "out": {
    "quality-module-2": 1
   }
  },
  "quality-module-3": {
   "time": 60,
   "inp": {
    "quality-module-2": 4,
    "advanced-circuit": 5,
    "processing-unit": 5,
    "superconductor": 1
   },
   "out": {
    "quality-module-3": 1
   }
  },
  "beacon": {
   "time": 15,
   "inp": {
    "electronic-circuit": 20,
    "advanced-circuit": 20,
    "steel-plate": 10,
    "copper-cable": 10
   },
   "out": {
    "beacon": 1
   }
  },
  "advanced-circuit": {
   "time": 6,
   "inp": {
    "electronic-circuit": 2,
    "plastic-bar": 2,
    "copper-cable": 4
   },
   "out": {
    "advanced-circuit": 1
   }
  },
  "engine-unit": {
   "time": 10,
   "inp": {
    "steel-plate": 1,
    "iron-gear-wheel": 1,
    "pipe": 2
   },
   "out": {
    "engine-unit": 1
   }
  },
  "electric-engine-unit": {
   "time": 10,
   "inp": {
    "engine-unit": 1,
    "lubricant": 15,
    "electronic-circuit": 2
   },
   "out": {
    "electric-engine-unit": 1
   }
  },
  "processing-unit": {
   "time": 10,
   "inp": {
    "electronic-circuit": 20,
    "advanced-circuit": 2,
    "sulfuric-acid": 5
   },
   "out": {
    "processing-unit": 1
   }
  },
  "low-density-structure": {
   "time": 15,
   "inp": {
    "steel-plate": 2,
    "copper-plate": 20,
    "plastic-bar": 5
   },
   "out": {
    "low-density-structure": 1
   }
  },
  "rocket-fuel": {
   "time": 15,
   "inp": {
    "solid-fuel": 10,
    "light-oil": 10
   },
   "out": {
    "rocket-fuel": 1
   }
  },
  "rocket-silo": {
   "time": 30,
   "inp": {
    "steel-plate": 1000,
    "concrete": 1000,
    "pipe": 100,
    "processing-unit": 200,
    "electric-engine-unit": 200
   },
   "out": {
    "rocket-silo": 1
   }
  },
  "cargo-landing-pad": {
   "time": 30,
   "inp": {
    "concrete": 200,
    "steel-plate": 25,
    "processing-unit": 10
   },
   "out": {
    "cargo-landing-pad": 1
   }
  },
  "cargo-bay": {
   "time": 10,
   "inp": {
    "steel-plate": 20,
    "low-density-structure": 20,
    "processing-unit": 5
   },
   "out": {
    "cargo-bay": 1
   }
  },
  "landing-pad-unloading-bay": {
   "time": 10,
   "inp": {
    "cargo-bay": 1,
    "steel-chest": 4,
    "electric-engine-unit": 15,
    "processing-unit": 8
   },
   "out": {
    "landing-pad-unloading-bay": 1
   }
  },
  "radar": {
   "time": 0.5,
   "inp": {
    "electronic-circuit": 5,
    "iron-gear-wheel": 5,
    "iron-plate": 10
   },
   "out": {
    "radar": 1
   }
  },
  "explosives": {
   "time": 4,
   "inp": {
    "sulfur": 1,
    "coal": 1,
    "water": 10
   },
   "out": {
    "explosives": 2
   }
  },
  "battery": {
   "time": 4,
   "inp": {
    "sulfuric-acid": 20,
    "iron-plate": 1,
    "copper-plate": 1
   },
   "out": {
    "battery": 1
   }
  },
  "sulfur": {
   "time": 1,
   "inp": {
    "water": 30,
    "petroleum-gas": 30
   },
   "out": {
    "sulfur": 2
   }
  },
  "carbon": {
   "time": 1,
   "inp": {
    "coal": 2,
    "sulfuric-acid": 20
   },
   "out": {
    "carbon": 1
   }
  },
  "thruster-fuel": {
   "time": 2,
   "inp": {
    "carbon": 2,
    "water": 10
   },
   "out": {
    "thruster-fuel": 75
   }
  },
  "thruster-oxidizer": {
   "time": 2,
   "inp": {
    "iron-ore": 2,
    "water": 10
   },
   "out": {
    "thruster-oxidizer": 75
   }
  },
  "advanced-thruster-fuel": {
   "time": 10,
   "inp": {
    "carbon": 2,
    "calcite": 1,
    "water": 100
   },
   "out": {
    "thruster-fuel": 1500
   }
  },
  "advanced-thruster-oxidizer": {
   "time": 10,
   "inp": {
    "iron-ore": 2,
    "calcite": 1,
    "water": 100
   },
   "out": {
    "thruster-oxidizer": 1500
   }
  },
  "space-platform-foundation": {
   "time": 10,
   "inp": {
    "steel-plate": 20,
    "copper-cable": 20
   },
   "out": {
    "space-platform-foundation": 1
   }
  },
  "space-platform-starter-pack": {
   "time": 60,
   "inp": {
    "space-platform-foundation": 60,
    "steel-plate": 20,
    "processing-unit": 20
   },
   "out": {
    "space-platform-starter-pack": 1
   }
  },
  "thruster": {
   "time": 10,
   "inp": {
    "steel-plate": 10,
    "processing-unit": 10,
    "electric-engine-unit": 5
   },
   "out": {
    "thruster": 1
   }
  },
  "asteroid-collector": {
   "time": 10,
   "inp": {
    "low-density-structure": 20,
    "electric-engine-unit": 8,
    "processing-unit": 5
   },
   "out": {
    "asteroid-collector": 1
   }
  },
  "carbon-fiber": {
   "time": 5,
   "inp": {
    "yumako-mash": 10,
    "carbon": 1
   },
   "out": {
    "carbon-fiber": 1
   }
  },
  "lithium-plate": {
   "time": 6.4,
   "inp": {
    "lithium": 1
   },
   "out": {
    "lithium-plate": 1
   }
  },
  "superconductor": {
   "time": 5,
   "inp": {
    "holmium-plate": 1,
    "copper-plate": 1,
    "plastic-bar": 1,
    "light-oil": 5
   },
   "out": {
    "superconductor": 2
   }
  },
  "electromagnetic-plant": {
   "time": 10,
   "inp": {
    "holmium-plate": 150,
    "steel-plate": 50,
    "processing-unit": 50,
    "refined-concrete": 50
   },
   "out": {
    "electromagnetic-plant": 1
   }
  },
  "recycler": {
   "time": 3,
   "inp": {
    "processing-unit": 6,
    "steel-plate": 20,
    "iron-gear-wheel": 40,
    "concrete": 20
   },
   "out": {
    "recycler": 1
   }
  },
  "holmium-solution": {
   "time": 10,
   "inp": {
    "holmium-ore": 2,
    "stone": 1,
    "water": 10
   },
   "out": {
    "holmium-solution": 100
   }
  },
  "holmium-plate": {
   "time": 1,
   "inp": {
    "holmium-solution": 20
   },
   "out": {
    "holmium-plate": 1
   }
  },
  "electrolyte": {
   "time": 5,
   "inp": {
    "stone": 1,
    "heavy-oil": 10,
    "holmium-solution": 10
   },
   "out": {
    "electrolyte": 10
   }
  },
  "teslagun": {
   "time": 30,
   "inp": {
    "holmium-plate": 10,
    "superconductor": 10,
    "plastic-bar": 30,
    "electrolyte": 100
   },
   "out": {
    "teslagun": 1
   }
  },
  "supercapacitor": {
   "time": 10,
   "inp": {
    "holmium-plate": 2,
    "superconductor": 2,
    "electronic-circuit": 4,
    "battery": 1,
    "electrolyte": 10
   },
   "out": {
    "supercapacitor": 1
   }
  },
  "tesla-ammo": {
   "time": 30,
   "inp": {
    "supercapacitor": 1,
    "plastic-bar": 1,
    "electrolyte": 10
   },
   "out": {
    "tesla-ammo": 1
   }
  },
  "tesla-turret": {
   "time": 30,
   "inp": {
    "teslagun": 1,
    "supercapacitor": 10,
    "processing-unit": 10,
    "superconductor": 50,
    "electrolyte": 500
   },
   "out": {
    "tesla-turret": 1
   }
  },
  "rocket-turret": {
   "time": 10,
   "inp": {
    "rocket-launcher": 4,
    "processing-unit": 4,
    "carbon-fiber": 20,
    "steel-plate": 20,
    "iron-gear-wheel": 20
   },
   "out": {
    "rocket-turret": 1
   }
  },
  "railgun-ammo": {
   "time": 25,
   "inp": {
    "steel-plate": 5,
    "copper-cable": 10,
    "explosives": 2
   },
   "out": {
    "railgun-ammo": 1
   }
  },
  "railgun-turret": {
   "time": 10,
   "inp": {
    "quantum-processor": 100,
    "tungsten-plate": 30,
    "superconductor": 50,
    "carbon-fiber": 20,
    "fluoroketone-cold": 100
   },
   "out": {
    "railgun-turret": 1
   }
  },
  "tungsten-plate": {
   "time": 10,
   "inp": {
    "tungsten-ore": 4,
    "molten-iron": 10
   },
   "out": {
    "tungsten-plate": 1
   }
  },
  "tungsten-carbide": {
   "time": 1,
   "inp": {
    "tungsten-ore": 2,
    "sulfuric-acid": 10,
    "carbon": 1
   },
   "out": {
    "tungsten-carbide": 1
   }
  },
  "metallurgic-science-pack": {
   "time": 10,
   "inp": {
    "tungsten-carbide": 3,
    "tungsten-plate": 2,
    "molten-copper": 200
   },
   "out": {
    "metallurgic-science-pack": 1
   }
  },
  "foundry": {
   "time": 10,
   "inp": {
    "tungsten-carbide": 50,
    "steel-plate": 50,
    "electronic-circuit": 30,
    "refined-concrete": 20,
    "lubricant": 20
   },
   "out": {
    "foundry": 1
   }
  },
  "yumako-mash": {
   "time": 1,
   "inp": {
    "yumako": 1
   },
   "out": {
    "yumako-seed": 1,
    "yumako-mash": 2
   }
  },
  "bioflux": {
   "time": 6,
   "inp": {
    "yumako-mash": 15,
    "jelly": 12
   },
   "out": {
    "bioflux": 4
   }
  },
  "nutrients-from-yumako-mash": {
   "time": 4,
   "inp": {
    "yumako-mash": 4
   },
   "out": {
    "nutrients": 6
   }
  },
  "nutrients-from-bioflux": {
   "time": 2,
   "inp": {
    "bioflux": 5
   },
   "out": {
    "nutrients": 40
   }
  },
  "nutrients-from-spoilage": {
   "time": 2,
   "inp": {
    "spoilage": 10
   },
   "out": {
    "nutrients": 1
   }
  },
  "burnt-spoilage": {
   "time": 12,
   "inp": {
    "spoilage": 6
   },
   "out": {
    "carbon": 1
   }
  },
  "biosulfur": {
   "time": 2,
   "inp": {
    "spoilage": 5,
    "bioflux": 1
   },
   "out": {
    "sulfur": 2
   }
  },
  "bioplastic": {
   "time": 2,
   "inp": {
    "bioflux": 1,
    "yumako-mash": 4
   },
   "out": {
    "plastic-bar": 3
   }
  },
  "biolubricant": {
   "time": 3,
   "inp": {
    "jelly": 60
   },
   "out": {
    "lubricant": 20
   }
  },
  "coal-synthesis": {
   "time": 2,
   "inp": {
    "carbon": 5,
    "sulfur": 1,
    "water": 10
   },
   "out": {
    "coal": 1
   }
  },
  "agricultural-tower": {
   "time": 10,
   "inp": {
    "steel-plate": 10,
    "electronic-circuit": 3,
    "spoilage": 20,
    "landfill": 1
   },
   "out": {
    "agricultural-tower": 1
   }
  },
  "artificial-yumako-soil": {
   "time": 2,
   "inp": {
    "yumako-seed": 2,
    "nutrients": 50,
    "landfill": 5
   },
   "out": {
    "artificial-yumako-soil": 10
   }
  },
  "overgrowth-yumako-soil": {
   "time": 10,
   "inp": {
    "artificial-yumako-soil": 2,
    "yumako-seed": 5,
    "biter-egg": 10,
    "spoilage": 50,
    "water": 100
   },
   "out": {
    "overgrowth-yumako-soil": 1
   }
  },
  "artificial-jellynut-soil": {
   "time": 2,
   "inp": {
    "jellynut-seed": 2,
    "nutrients": 50,
    "landfill": 5
   },
   "out": {
    "artificial-jellynut-soil": 10
   }
  },
  "overgrowth-jellynut-soil": {
   "time": 10,
   "inp": {
    "artificial-jellynut-soil": 2,
    "jellynut-seed": 5,
    "biter-egg": 10,
    "spoilage": 50,
    "water": 100
   },
   "out": {
    "overgrowth-jellynut-soil": 1
   }
  },
  "jellynut-processing": {
   "time": 1,
   "inp": {
    "jellynut": 1
   },
   "out": {
    "jellynut-seed": 1,
    "jelly": 4
   }
  },
  "biter-egg": {
   "time": 10,
   "inp": {},
   "out": {
    "biter-egg": 5
   }
  },
  "nutrients-from-biter-egg": {
   "time": 2,
   "inp": {
    "biter-egg": 1
   },
   "out": {
    "nutrients": 20
   }
  },
  "fish-breeding": {
   "time": 6,
   "inp": {
    "raw-fish": 2,
    "nutrients": 100,
    "water": 100
   },
   "out": {
    "raw-fish": 3
   }
  },
  "nutrients-from-fish": {
   "time": 2,
   "inp": {
    "raw-fish": 1
   },
   "out": {
    "nutrients": 20
   }
  },
  "pentapod-egg": {
   "time": 15,
   "inp": {
    "pentapod-egg": 1,
    "nutrients": 30,
    "water": 60
   },
   "out": {
    "pentapod-egg": 2
   }
  },
  "rocket-fuel-from-jelly": {
   "time": 10,
   "inp": {
    "water": 30,
    "jelly": 30,
    "bioflux": 2
   },
   "out": {
    "rocket-fuel": 1
   }
  },
  "solid-fuel-from-ammonia": {
   "time": 0.5,
   "inp": {
    "ammonia": 15,
    "crude-oil": 6
   },
   "out": {
    "solid-fuel": 1
   }
  },
  "capture-robot-rocket": {
   "time": 10,
   "inp": {
    "flying-robot-frame": 1,
    "steel-plate": 2,
    "bioflux": 20,
    "processing-unit": 2
   },
   "out": {
    "capture-robot-rocket": 1
   }
  },
  "captive-biter-spawner": {
   "time": 10,
   "inp": {
    "biter-egg": 10,
    "capture-robot-rocket": 1,
    "uranium-235": 15,
    "fluoroketone-cold": 100
   },
   "out": {
    "captive-biter-spawner": 1
   }
  },
  "iron-bacteria": {
   "time": 1,
   "inp": {
    "jelly": 6
   },
   "out": {
    "iron-bacteria": 1,
    "spoilage": 4
   }
  },
  "copper-bacteria": {
   "time": 1,
   "inp": {
    "yumako-mash": 3
   },
   "out": {
    "copper-bacteria": 1,
    "spoilage": 1
   }
  },
  "iron-bacteria-cultivation": {
   "time": 4,
   "inp": {
    "iron-bacteria": 1,
    "bioflux": 1
   },
   "out": {
    "iron-bacteria": 4
   }
  },
  "copper-bacteria-cultivation": {
   "time": 4,
   "inp": {
    "copper-bacteria": 1,
    "bioflux": 1
   },
   "out": {
    "copper-bacteria": 4
   }
  },
  "crusher": {
   "time": 10,
   "inp": {
    "low-density-structure": 20,
    "steel-plate": 10,
    "electric-engine-unit": 10
   },
   "out": {
    "crusher": 1
   }
  },
  "metallic-asteroid-crushing": {
   "time": 2,
   "inp": {
    "metallic-asteroid-chunk": 1
   },
   "out": {
    "iron-ore": 20,
    "metallic-asteroid-chunk": 1
   }
  },
  "carbonic-asteroid-crushing": {
   "time": 2,
   "inp": {
    "carbonic-asteroid-chunk": 1
   },
   "out": {
    "carbon": 10,
    "carbonic-asteroid-chunk": 1
   }
  },
  "oxide-asteroid-crushing": {
   "time": 2,
   "inp": {
    "oxide-asteroid-chunk": 1
   },
   "out": {
    "ice": 5,
    "oxide-asteroid-chunk": 1
   }
  },
  "advanced-metallic-asteroid-crushing": {
   "time": 5,
   "inp": {
    "metallic-asteroid-chunk": 1
   },
   "out": {
    "iron-ore": 10,
    "copper-ore": 4,
    "metallic-asteroid-chunk": 1
   }
  },
  "advanced-carbonic-asteroid-crushing": {
   "time": 5,
   "inp": {
    "carbonic-asteroid-chunk": 1
   },
   "out": {
    "carbon": 5,
    "sulfur": 2,
    "carbonic-asteroid-chunk": 1
   }
  },
  "advanced-oxide-asteroid-crushing": {
   "time": 5,
   "inp": {
    "oxide-asteroid-chunk": 1
   },
   "out": {
    "ice": 3,
    "calcite": 2,
    "oxide-asteroid-chunk": 1
   }
  },
  "metallic-asteroid-reprocessing": {
   "time": 2,
   "inp": {
    "metallic-asteroid-chunk": 1
   },
   "prob": {
    "metallic-asteroid-chunk": 0.4,
    "carbonic-asteroid-chunk": 0.2,
    "oxide-asteroid-chunk": 0.2
   }
  },
  "carbonic-asteroid-reprocessing": {
   "time": 2,
   "inp": {
    "carbonic-asteroid-chunk": 1
   },
   "prob": {
    "carbonic-asteroid-chunk": 0.4,
    "metallic-asteroid-chunk": 0.2,
    "oxide-asteroid-chunk": 0.2
   }
  },
  "oxide-asteroid-reprocessing": {
   "time": 1,
   "inp": {
    "oxide-asteroid-chunk": 1
   },
   "prob": {
    "oxide-asteroid-chunk": 0.4,
    "metallic-asteroid-chunk": 0.2,
    "carbonic-asteroid-chunk": 0.2
   }
  },
  "promethium-science-pack": {
   "time": 5,
   "inp": {
    "promethium-asteroid-chunk": 25,
    "quantum-processor": 1,
    "biter-egg": 10
   },
   "out": {
    "promethium-science-pack": 10
   }
  },
  "cryogenic-science-pack": {
   "time": 20,
   "inp": {
    "ice": 3,
    "lithium-plate": 1,
    "fluoroketone-cold": 6
   },
   "out": {
    "cryogenic-science-pack": 1,
    "fluoroketone-hot": 3
   }
  },
  "ammonia-rocket-fuel": {
   "time": 10,
   "inp": {
    "solid-fuel": 10,
    "water": 50,
    "ammonia": 500
   },
   "out": {
    "rocket-fuel": 1
   }
  },
  "cryogenic-plant": {
   "time": 10,
   "inp": {
    "refined-concrete": 40,
    "superconductor": 20,
    "processing-unit": 20,
    "lithium-plate": 20
   },
   "out": {
    "cryogenic-plant": 1
   }
  },
  "iron-ore-melting": {
   "time": 32,
   "inp": {
    "iron-ore": 50,
    "calcite": 1
   },
   "out": {
    "molten-iron": 500
   }
  },
  "copper-ore-melting": {
   "time": 32,
   "inp": {
    "copper-ore": 50,
    "calcite": 1
   },
   "out": {
    "molten-copper": 500
   }
  },
  "casting-iron": {
   "time": 3.2,
   "inp": {
    "molten-iron": 20
   },
   "out": {
    "iron-plate": 2
   }
  },
  "casting-steel": {
   "time": 3.2,
   "inp": {
    "molten-iron": 30
   },
   "out": {
    "steel-plate": 1
   }
  },
  "casting-copper": {
   "time": 3.2,
   "inp": {
    "molten-copper": 20
   },
   "out": {
    "copper-plate": 2
   }
  },
  "casting-iron-gear-wheel": {
   "time": 1,
   "inp": {
    "molten-iron": 10
   },
   "out": {
    "iron-gear-wheel": 1
   }
  },
  "casting-iron-stick": {
   "time": 1,
   "inp": {
    "molten-iron": 20
   },
   "out": {
    "iron-stick": 4
   }
  },
  "casting-pipe": {
   "time": 1,
   "inp": {
    "molten-iron": 10
   },
   "out": {
    "pipe": 1
   }
  },
  "casting-pipe-to-ground": {
   "time": 1,
   "inp": {
    "molten-iron": 50,
    "pipe": 10
   },
   "out": {
    "pipe-to-ground": 2
   }
  },
  "casting-low-density-structure": {
   "time": 15,
   "inp": {
    "molten-iron": 80,
    "molten-copper": 250,
    "plastic-bar": 5
   },
   "out": {
    "low-density-structure": 1
   }
  },
  "casting-copper-cable": {
   "time": 1,
   "inp": {
    "molten-copper": 5
   },
   "out": {
    "copper-cable": 2
   }
  },
  "concrete-from-molten-iron": {
   "time": 10,
   "inp": {
    "molten-iron": 20,
    "water": 100,
    "stone-brick": 5
   },
   "out": {
    "concrete": 10
   }
  },
  "steam-condensation": {
   "time": 1,
   "inp": {
    "steam": 1000
   },
   "out": {
    "water": 90
   }
  },
  "acid-neutralisation": {
   "time": 0.5,
   "inp": {
    "calcite": 1,
    "sulfuric-acid": 100
   },
   "out": {
    "steam": 1000
   }
  },
  "quantum-processor": {
   "time": 30,
   "inp": {
    "tungsten-carbide": 1,
    "processing-unit": 1,
    "superconductor": 1,
    "carbon-fiber": 1,
    "lithium-plate": 2,
    "fluoroketone-cold": 10
   },
   "out": {
    "quantum-processor": 1,
    "fluoroketone-hot": 5
   }
  },
  "railgun": {
   "time": 10,
   "inp": {
    "tungsten-plate": 10,
    "superconductor": 10,
    "quantum-processor": 20,
    "fluoroketone-cold": 10
   },
   "out": {
    "railgun": 1
   }
  },
  "ice-melting": {
   "time": 1,
   "inp": {
    "ice": 1
   },
   "out": {
    "water": 20
   }
  },
  "sulfuric-acid": {
   "time": 1,
   "inp": {
    "sulfur": 5,
    "iron-plate": 1,
    "water": 100
   },
   "out": {
    "sulfuric-acid": 50
   }
  },
  "defender-capsule": {
   "time": 8,
   "inp": {
    "piercing-rounds-magazine": 3,
    "electronic-circuit": 3,
    "iron-gear-wheel": 3
   },
   "out": {
    "defender-capsule": 1
   }
  },
  "distractor-capsule": {
   "time": 15,
   "inp": {
    "defender-capsule": 4,
    "advanced-circuit": 3
   },
   "out": {
    "distractor-capsule": 1
   }
  },
  "destroyer-capsule": {
   "time": 15,
   "inp": {
    "distractor-capsule": 4,
    "steel-plate": 4,
    "processing-unit": 1
   },
   "out": {
    "destroyer-capsule": 1
   }
  },
  "roboport": {
   "time": 5,
   "inp": {
    "steel-plate": 45,
    "iron-gear-wheel": 45,
    "advanced-circuit": 45
   },
   "out": {
    "roboport": 1
   }
  },
  "logistic-robot": {
   "time": 0.5,
   "inp": {
    "flying-robot-frame": 1,
    "advanced-circuit": 2
   },
   "out": {
    "logistic-robot": 1
   }
  },
  "construction-robot": {
   "time": 0.5,
   "inp": {
    "flying-robot-frame": 1,
    "electronic-circuit": 2
   },
   "out": {
    "construction-robot": 1
   }
  },
  "personal-roboport-equipment": {
   "time": 10,
   "inp": {
    "advanced-circuit": 10,
    "iron-gear-wheel": 40,
    "steel-plate": 20,
    "battery": 45
   },
   "out": {
    "personal-roboport-equipment": 1
   }
  },
  "personal-roboport-mk2-equipment": {
   "time": 20,
   "inp": {
    "personal-roboport-equipment": 5,
    "processing-unit": 50,
    "superconductor": 50
   },
   "out": {
    "personal-roboport-mk2-equipment": 1
   }
  },
  "passive-provider-chest": {
   "time": 0.5,
   "inp": {
    "steel-chest": 1,
    "electronic-circuit": 3,
    "advanced-circuit": 1
   },
   "out": {
    "passive-provider-chest": 1
   }
  },
  "active-provider-chest": {
   "time": 0.5,
   "inp": {
    "steel-chest": 1,
    "electronic-circuit": 3,
    "advanced-circuit": 1
   },
   "out": {
    "active-provider-chest": 1
   }
  },
  "requester-chest": {
   "time": 0.5,
   "inp": {
    "steel-chest": 1,
    "electronic-circuit": 3,
    "advanced-circuit": 1
   },
   "out": {
    "requester-chest": 1
   }
  },
  "buffer-chest": {
   "time": 0.5,
   "inp": {
    "steel-chest": 1,
    "electronic-circuit": 3,
    "advanced-circuit": 1
   },
   "out": {
    "buffer-chest": 1
   }
  },
  "kovarex": {
   "time": 60,
   "inp": {
    "uranium-235": 40,
    "uranium-238": 5
   },
   "out": {
    "uranium-235": 41,
    "uranium-238": 2
   }
  },
  "nuclear-fuel": {
   "time": 90,
   "inp": {
    "uranium-235": 1,
    "rocket-fuel": 1
   },
   "out": {
    "nuclear-fuel": 1
   }
  },
  "uranium-fuel-cell": {
   "time": 10,
   "inp": {
    "iron-plate": 10,
    "uranium-235": 1,
    "uranium-238": 19
   },
   "out": {
    "uranium-fuel-cell": 10
   }
  },
  "centrifuge": {
   "time": 4,
   "inp": {
    "concrete": 100,
    "steel-plate": 50,
    "advanced-circuit": 100,
    "iron-gear-wheel": 100
   },
   "out": {
    "centrifuge": 1
   }
  },
  "nuclear-reactor": {
   "time": 8,
   "inp": {
    "concrete": 500,
    "steel-plate": 500,
    "advanced-circuit": 500,
    "copper-plate": 500
   },
   "out": {
    "nuclear-reactor": 1
   }
  },
  "steam-turbine": {
   "time": 3,
   "inp": {
    "iron-gear-wheel": 50,
    "copper-plate": 50,
    "pipe": 20
   },
   "out": {
    "steam-turbine": 1
   }
  },
  "heat-pipe": {
   "time": 1,
   "inp": {
    "steel-plate": 10,
    "copper-plate": 20
   },
   "out": {
    "heat-pipe": 1
   }
  },
  "heat-exchanger": {
   "time": 3,
   "inp": {
    "steel-plate": 10,
    "copper-plate": 100,
    "pipe": 10
   },
   "out": {
    "heat-exchanger": 1
   }
  },
  "heating-tower": {
   "time": 10,
   "inp": {
    "boiler": 2,
    "heat-pipe": 5,
    "concrete": 20
   },
   "out": {
    "heating-tower": 1
   }
  },
  "fusion-power-cell": {
   "time": 10,
   "inp": {
    "lithium-plate": 5,
    "holmium-plate": 1,
    "ammonia": 100
   },
   "out": {
    "fusion-power-cell": 1
   }
  },
  "fusion-reactor": {
   "time": 60,
   "inp": {
    "tungsten-plate": 200,
    "superconductor": 200,
    "quantum-processor": 250
   },
   "out": {
    "fusion-reactor": 1
   }
  },
  "fusion-generator": {
   "time": 30,
   "inp": {
    "tungsten-plate": 100,
    "superconductor": 100,
    "quantum-processor": 50
   },
   "out": {
    "fusion-generator": 1
   }
  },
  "lightning-rod": {
   "time": 5,
   "inp": {
    "copper-cable": 12,
    "steel-plate": 8,
    "stone-brick": 4
   },
   "out": {
    "lightning-rod": 1
   }
  },
  "lightning-collector": {
   "time": 5,
   "inp": {
    "lightning-rod": 1,
    "supercapacitor": 8,
    "accumulator": 1,
    "electrolyte": 80
   },
   "out": {
    "lightning-collector": 1
   }
  },
  "small-electric-pole": {
   "time": 0.5,
   "inp": {
    "wood": 1,
    "copper-cable": 2
   },
   "out": {
    "small-electric-pole": 2
   }
  },
  "substation": {
   "time": 0.5,
   "inp": {
    "steel-plate": 10,
    "advanced-circuit": 5,
    "copper-cable": 6
   },
   "out": {
    "substation": 1
   }
  },
  "programmable-speaker": {
   "time": 2,
   "inp": {
    "iron-plate": 3,
    "iron-stick": 4,
    "copper-cable": 5,
    "electronic-circuit": 4
   },
   "out": {
    "programmable-speaker": 1
   }
  },
  "small-lamp": {
   "time": 0.5,
   "inp": {
    "electronic-circuit": 1,
    "copper-cable": 3,
    "iron-plate": 1
   },
   "out": {
    "small-lamp": 1
   }
  },
  "medium-electric-pole": {
   "time": 0.5,
   "inp": {
    "iron-stick": 4,
    "steel-plate": 2,
    "copper-cable": 2
   },
   "out": {
    "medium-electric-pole": 1
   }
  },
  "big-electric-pole": {
   "time": 0.5,
   "inp": {
    "iron-stick": 8,
    "steel-plate": 5,
    "copper-cable": 4
   },
   "out": {
    "big-electric-pole": 1
   }
  },
  "constant-combinator": {
   "time": 0.5,
   "inp": {
    "copper-cable": 5,
    "electronic-circuit": 2
   },
   "out": {
    "constant-combinator": 1
   }
  },
  "arithmetic-combinator": {
   "time": 0.5,
   "inp": {
    "copper-cable": 5,
    "electronic-circuit": 5
   },
   "out": {
    "arithmetic-combinator": 1
   }
  },
  "decider-combinator": {
   "time": 0.5,
   "inp": {
    "copper-cable": 5,
    "electronic-circuit": 5
   },
   "out": {
    "decider-combinator": 1
   }
  },
  "selector-combinator": {
   "time": 0.5,
   "inp": {
    "advanced-circuit": 2,
    "decider-combinator": 5
   },
   "out": {
    "selector-combinator": 1
   }
  },
  "display-panel": {
   "time": 0.5,
   "inp": {
    "iron-plate": 1,
    "electronic-circuit": 1
   },
   "out": {
    "display-panel": 1
   }
  },
  "power-switch": {
   "time": 2,
   "inp": {
    "iron-plate": 5,
    "copper-cable": 5,
    "electronic-circuit": 2
   },
   "out": {
    "power-switch": 1
   }
  },
  "concrete": {
   "time": 10,
   "inp": {
    "stone-brick": 5,
    "iron-ore": 1,
    "water": 100
   },
   "out": {
    "concrete": 10
   }
  },
  "refined-concrete": {
   "time": 15,
   "inp": {
    "concrete": 20,
    "iron-stick": 8,
    "steel-plate": 1,
    "water": 100
   },
   "out": {
    "refined-concrete": 10
   }
  },
  "hazard-concrete": {
   "time": 0.25,
   "inp": {
    "concrete": 10
   },
   "out": {
    "hazard-concrete": 10
   }
  },
  "refined-hazard-concrete": {
   "time": 0.25,
   "inp": {
    "refined-concrete": 10
   },
   "out": {
    "refined-hazard-concrete": 10
   }
  },
  "landfill": {
   "time": 0.5,
   "inp": {
    "stone": 50
   },
   "out": {
    "landfill": 1
   }
  },
  "foundation": {
   "time": 30,
   "inp": {
    "tungsten-plate": 4,
    "lithium-plate": 4,
    "carbon-fiber": 4,
    "stone": 20,
    "fluoroketone-cold": 20
   },
   "out": {
    "foundation": 1
   }
  },
  "ice-platform": {
   "time": 30,
   "inp": {
    "ammonia": 400,
    "ice": 50
   },
   "out": {
    "ice-platform": 1
   }
  },
  "modular-armor": {
   "time": 15,
   "inp": {
    "advanced-circuit": 30,
    "steel-plate": 50
   },
   "out": {
    "modular-armor": 1
   }
  },
  "power-armor": {
   "time": 20,
   "inp": {
    "processing-unit": 40,
    "electric-engine-unit": 20,
    "steel-plate": 40
   },
   "out": {
    "power-armor": 1
   }
  },
  "power-armor-mk2": {
   "time": 25,
   "inp": {
    "efficiency-module": 100,
    "speed-module": 100,
    "processing-unit": 60,
    "electric-engine-unit": 40,
    "low-density-structure": 30
   },
   "out": {
    "power-armor-mk2": 1
   }
  },
  "solar-panel-equipment": {
   "time": 10,
   "inp": {
    "solar-panel": 1,
    "advanced-circuit": 2,
    "steel-plate": 5
   },
   "out": {
    "solar-panel-equipment": 1
   }
  },
  "fusion-reactor-equipment": {
   "time": 30,
   "inp": {
    "fission-reactor-equipment": 1,
    "fusion-power-cell": 10,
    "tungsten-plate": 250,
    "carbon-fiber": 100,
    "supercapacitor": 25,
    "quantum-processor": 250
   },
   "out": {
    "fusion-reactor-equipment": 1
   }
  },
  "battery-equipment": {
   "time": 10,
   "inp": {
    "battery": 5,
    "steel-plate": 10
   },
   "out": {
    "battery-equipment": 1
   }
  },
  "battery-mk2-equipment": {
   "time": 10,
   "inp": {
    "battery-equipment": 10,
    "processing-unit": 15,
    "low-density-structure": 5
   },
   "out": {
    "battery-mk2-equipment": 1
   }
  },
  "exoskeleton-equipment": {
   "time": 10,
   "inp": {
    "processing-unit": 10,
    "electric-engine-unit": 30,
    "steel-plate": 20
   },
   "out": {
    "exoskeleton-equipment": 1
   }
  },
  "night-vision-equipment": {
   "time": 10,
   "inp": {
    "advanced-circuit": 5,
    "steel-plate": 10
   },
   "out": {
    "night-vision-equipment": 1
   }
  },
  "personal-laser-defense-equipment": {
   "time": 10,
   "inp": {
    "processing-unit": 20,
    "low-density-structure": 5,
    "laser-turret": 5
   },
   "out": {
    "personal-laser-defense-equipment": 1
   }
  },
  "energy-shield-equipment": {
   "time": 10,
   "inp": {
    "advanced-circuit": 5,
    "steel-plate": 10
   },
   "out": {
    "energy-shield-equipment": 1
   }
  },
  "energy-shield-mk2-equipment": {
   "time": 10,
   "inp": {
    "energy-shield-equipment": 10,
    "processing-unit": 5,
    "low-density-structure": 5
   },
   "out": {
    "energy-shield-mk2-equipment": 1
   }
  },
  "belt-immunity-equipment": {
   "time": 10,
   "inp": {
    "advanced-circuit": 5,
    "steel-plate": 10
   },
   "out": {
    "belt-immunity-equipment": 1
   }
  },
  "battery-mk3-equipment": {
   "time": 10,
   "inp": {
    "battery-mk2-equipment": 5,
    "supercapacitor": 10
   },
   "out": {
    "battery-mk3-equipment": 1
   }
  },
  "fission-reactor-equipment": {
   "time": 10,
   "inp": {
    "processing-unit": 200,
    "low-density-structure": 50,
    "uranium-fuel-cell": 4
   },
   "out": {
    "fission-reactor-equipment": 1
   }
  },
  "toolbelt-equipment": {
   "time": 10,
   "inp": {
    "advanced-circuit": 3,
    "carbon-fiber": 10
   },
   "out": {
    "toolbelt-equipment": 1
   }
  },
  "mech-armor": {
   "time": 60,
   "inp": {
    "power-armor-mk2": 1,
    "holmium-plate": 200,
    "processing-unit": 100,
    "superconductor": 50,
    "supercapacitor": 50
   },
   "out": {
    "mech-armor": 1
   }
  },
  "discharge-defense-equipment": {
   "time": 10,
   "inp": {
    "processing-unit": 5,
    "steel-plate": 20,
    "laser-turret": 10
   },
   "out": {
    "discharge-defense-equipment": 1
   }
  },
  "basic-oil": {
   "time": 5,
   "inp": {
    "crude-oil": 100
   },
   "out": {
    "petroleum-gas": 45
   }
  },
  "advanced-oil": {
   "time": 5,
   "inp": {
    "water": 50,
    "crude-oil": 100
   },
   "out": {
    "heavy-oil": 25,
    "light-oil": 45,
    "petroleum-gas": 55
   }
  },
  "coal-liquefaction": {
   "time": 5,
   "inp": {
    "coal": 10,
    "heavy-oil": 25,
    "steam": 50
   },
   "out": {
    "heavy-oil": 90,
    "light-oil": 20,
    "petroleum-gas": 10
   }
  },
  "simple-coal": {
   "time": 5,
   "inp": {
    "coal": 10,
    "calcite": 2,
    "sulfuric-acid": 25
   },
   "out": {
    "heavy-oil": 50
   }
  },
  "uranium-processing": {
   "time": 12,
   "inp": {
    "uranium-ore": 10
   },
   "prob": {
    "uranium-235": 0.007,
    "uranium-238": 0.993
   }
  },
  "nuclear-fuel-reprocessing": {
   "time": 60,
   "inp": {
    "depleted-uranium-fuel-cell": 5
   },
   "out": {
    "uranium-238": 3
   }
  }
 },
 "recipeDevice": {
  "steel-plate": "assembling-machine-1",
  "iron-gear-wheel": "assembling-machine-1",
  "iron-stick": "assembling-machine-1",
  "copper-cable": "assembling-machine-1",
  "electronic-circuit": "assembling-machine-1",
  "automation-science-pack": "assembling-machine-1",
  "transport-belt": "assembling-machine-1",
  "fast-transport-belt": "assembling-machine-1",
  "express-transport-belt": "assembling-machine-1",
  "underground-belt": "assembling-machine-1",
  "fast-underground-belt": "assembling-machine-1",
  "express-underground-belt": "assembling-machine-1",
  "splitter": "assembling-machine-1",
  "fast-splitter": "assembling-machine-1",
  "express-splitter": "assembling-machine-1",
  "turbo-transport-belt": "foundry",
  "turbo-underground-belt": "foundry",
  "turbo-splitter": "foundry",
  "loader": "assembling-machine-1",
  "fast-loader": "assembling-machine-1",
  "express-loader": "assembling-machine-1",
  "turbo-loader": "assembling-machine-1",
  "inserter": "assembling-machine-1",
  "burner-inserter": "assembling-machine-1",
  "long-handed-inserter": "assembling-machine-1",
  "fast-inserter": "assembling-machine-1",
  "burner-mining-drill": "assembling-machine-1",
  "stone-furnace": "assembling-machine-1",
  "assembling-machine-1": "assembling-machine-1",
  "lab": "assembling-machine-1",
  "boiler": "assembling-machine-1",
  "steam-engine": "assembling-machine-1",
  "offshore-pump": "assembling-machine-1",
  "electric-mining-drill": "assembling-machine-1",
  "big-mining-drill": "assembling-machine-1",
  "electric-furnace": "assembling-machine-1",
  "assembling-machine-2": "assembling-machine-1",
  "bulk-inserter": "assembling-machine-1",
  "stack-inserter": "assembling-machine-1",
  "logistic-science-pack": "assembling-machine-1",
  "pipe": "assembling-machine-1",
  "pumpjack": "assembling-machine-1",
  "oil-refinery": "assembling-machine-1",
  "chemical-plant": "assembling-machine-1",
  "storage-tank": "assembling-machine-1",
  "steel-chest": "assembling-machine-1",
  "wooden-chest": "assembling-machine-1",
  "tree-seed": "assembling-machine-1",
  "iron-chest": "assembling-machine-1",
  "repair-pack": "assembling-machine-1",
  "steel-furnace": "assembling-machine-1",
  "assembling-machine-3": "assembling-machine-1",
  "pipe-to-ground": "assembling-machine-1",
  "pump": "assembling-machine-1",
  "solar-panel": "assembling-machine-1",
  "accumulator": "assembling-machine-1",
  "military-science-pack": "assembling-machine-1",
  "flying-robot-frame": "assembling-machine-1",
  "production-science-pack": "assembling-machine-1",
  "utility-science-pack": "assembling-machine-1",
  "gun-turret": "assembling-machine-1",
  "stone-wall": "assembling-machine-1",
  "gate": "assembling-machine-1",
  "firearm-magazine": "assembling-machine-1",
  "piercing-rounds-magazine": "assembling-machine-1",
  "plastic-bar": "chemical-plant",
  "crack-light": "chemical-plant",
  "crack-gas": "chemical-plant",
  "lubricant": "chemical-plant",
  "solid-fuel": "chemical-plant",
  "solid-fuel-light-oil": "chemical-plant",
  "solid-fuel-heavy-oil": "chemical-plant",
  "rail": "assembling-machine-1",
  "locomotive": "assembling-machine-1",
  "cargo-wagon": "assembling-machine-1",
  "fluid-wagon": "assembling-machine-1",
  "artillery-wagon": "assembling-machine-1",
  "train-stop": "assembling-machine-1",
  "rail-signal": "assembling-machine-1",
  "rail-chain-signal": "assembling-machine-1",
  "rail-support": "assembling-machine-1",
  "rail-ramp": "assembling-machine-1",
  "car": "assembling-machine-1",
  "tank": "assembling-machine-1",
  "cannon-shell": "assembling-machine-1",
  "explosive-cannon-shell": "assembling-machine-1",
  "explosive-uranium-cannon-shell": "assembling-machine-1",
  "light-armor": "assembling-machine-1",
  "heavy-armor": "assembling-machine-1",
  "spidertron": "assembling-machine-1",
  "land-mine": "assembling-machine-1",
  "cliff-explosives": "assembling-machine-1",
  "artillery-turret": "assembling-machine-1",
  "artillery-shell": "assembling-machine-1",
  "pistol": "assembling-machine-1",
  "submachine-gun": "assembling-machine-1",
  "shotgun": "assembling-machine-1",
  "rocket-launcher": "assembling-machine-1",
  "grenade": "assembling-machine-1",
  "cluster-grenade": "assembling-machine-1",
  "shotgun-shell": "assembling-machine-1",
  "piercing-shotgun-shell": "assembling-machine-1",
  "combat-shotgun": "assembling-machine-1",
  "rocket": "assembling-machine-1",
  "explosive-rocket": "assembling-machine-1",
  "atomic-bomb": "assembling-machine-1",
  "flamethrower": "assembling-machine-1",
  "uranium-rounds-magazine": "assembling-machine-1",
  "uranium-cannon-shell": "assembling-machine-1",
  "poison-capsule": "assembling-machine-1",
  "slowdown-capsule": "assembling-machine-1",
  "flamethrower-ammo": "chemical-plant",
  "laser-turret": "assembling-machine-1",
  "flamethrower-turret": "assembling-machine-1",
  "speed-module": "assembling-machine-1",
  "speed-module-2": "assembling-machine-1",
  "speed-module-3": "assembling-machine-1",
  "productivity-module": "assembling-machine-1",
  "productivity-module-2": "assembling-machine-1",
  "productivity-module-3": "assembling-machine-1",
  "efficiency-module": "assembling-machine-1",
  "efficiency-module-2": "assembling-machine-1",
  "efficiency-module-3": "assembling-machine-1",
  "quality-module": "assembling-machine-1",
  "quality-module-2": "assembling-machine-1",
  "quality-module-3": "assembling-machine-1",
  "beacon": "assembling-machine-1",
  "advanced-circuit": "assembling-machine-1",
  "engine-unit": "assembling-machine-1",
  "electric-engine-unit": "assembling-machine-1",
  "processing-unit": "assembling-machine-1",
  "low-density-structure": "assembling-machine-1",
  "rocket-fuel": "assembling-machine-1",
  "rocket-silo": "assembling-machine-1",
  "cargo-landing-pad": "assembling-machine-1",
  "cargo-bay": "assembling-machine-1",
  "landing-pad-unloading-bay": "assembling-machine-1",
  "radar": "assembling-machine-1",
  "explosives": "chemical-plant",
  "battery": "chemical-plant",
  "sulfur": "chemical-plant",
  "carbon": "chemical-plant",
  "thruster-fuel": "chemical-plant",
  "thruster-oxidizer": "chemical-plant",
  "advanced-thruster-fuel": "chemical-plant",
  "advanced-thruster-oxidizer": "chemical-plant",
  "space-platform-foundation": "space-platform-hub",
  "space-platform-starter-pack": "space-platform-hub",
  "thruster": "assembling-machine-1",
  "asteroid-collector": "assembling-machine-1",
  "carbon-fiber": "biochamber",
  "lithium-plate": "assembling-machine-1",
  "superconductor": "electromagnetic-plant",
  "electromagnetic-plant": "electromagnetic-plant",
  "recycler": "assembling-machine-1",
  "holmium-solution": "chemical-plant",
  "holmium-plate": "electromagnetic-plant",
  "electrolyte": "electromagnetic-plant",
  "teslagun": "electromagnetic-plant",
  "supercapacitor": "electromagnetic-plant",
  "tesla-ammo": "electromagnetic-plant",
  "tesla-turret": "electromagnetic-plant",
  "rocket-turret": "assembling-machine-1",
  "railgun-ammo": "assembling-machine-1",
  "railgun-turret": "electromagnetic-plant",
  "tungsten-plate": "foundry",
  "tungsten-carbide": "foundry",
  "metallurgic-science-pack": "foundry",
  "foundry": "foundry",
  "yumako-mash": "biochamber",
  "bioflux": "biochamber",
  "nutrients-from-yumako-mash": "biochamber",
  "nutrients-from-bioflux": "biochamber",
  "nutrients-from-spoilage": "biochamber",
  "burnt-spoilage": "biochamber",
  "biosulfur": "biochamber",
  "bioplastic": "biochamber",
  "biolubricant": "biochamber",
  "coal-synthesis": "chemical-plant",
  "agricultural-tower": "assembling-machine-1",
  "artificial-yumako-soil": "assembling-machine-1",
  "overgrowth-yumako-soil": "assembling-machine-1",
  "artificial-jellynut-soil": "assembling-machine-1",
  "overgrowth-jellynut-soil": "assembling-machine-1",
  "jellynut-processing": "biochamber",
  "biter-egg": "biochamber",
  "nutrients-from-biter-egg": "biochamber",
  "fish-breeding": "biochamber",
  "nutrients-from-fish": "biochamber",
  "pentapod-egg": "biochamber",
  "rocket-fuel-from-jelly": "biochamber",
  "solid-fuel-from-ammonia": "chemical-plant",
  "capture-robot-rocket": "assembling-machine-1",
  "captive-biter-spawner": "assembling-machine-1",
  "iron-bacteria": "biochamber",
  "copper-bacteria": "biochamber",
  "iron-bacteria-cultivation": "biochamber",
  "copper-bacteria-cultivation": "biochamber",
  "crusher": "crusher",
  "metallic-asteroid-crushing": "crusher",
  "carbonic-asteroid-crushing": "crusher",
  "oxide-asteroid-crushing": "crusher",
  "advanced-metallic-asteroid-crushing": "crusher",
  "advanced-carbonic-asteroid-crushing": "crusher",
  "advanced-oxide-asteroid-crushing": "crusher",
  "metallic-asteroid-reprocessing": "crusher",
  "carbonic-asteroid-reprocessing": "crusher",
  "oxide-asteroid-reprocessing": "crusher",
  "promethium-science-pack": "electromagnetic-plant",
  "cryogenic-science-pack": "cryogenic-plant",
  "ammonia-rocket-fuel": "chemical-plant",
  "cryogenic-plant": "cryogenic-plant",
  "iron-ore-melting": "foundry",
  "copper-ore-melting": "foundry",
  "casting-iron": "foundry",
  "casting-steel": "foundry",
  "casting-copper": "foundry",
  "casting-iron-gear-wheel": "foundry",
  "casting-iron-stick": "foundry",
  "casting-pipe": "foundry",
  "casting-pipe-to-ground": "foundry",
  "casting-low-density-structure": "foundry",
  "casting-copper-cable": "foundry",
  "concrete-from-molten-iron": "foundry",
  "steam-condensation": "chemical-plant",
  "acid-neutralisation": "chemical-plant",
  "quantum-processor": "assembling-machine-1",
  "railgun": "assembling-machine-1",
  "ice-melting": "crusher",
  "sulfuric-acid": "chemical-plant",
  "defender-capsule": "assembling-machine-1",
  "distractor-capsule": "assembling-machine-1",
  "destroyer-capsule": "assembling-machine-1",
  "roboport": "assembling-machine-1",
  "logistic-robot": "assembling-machine-1",
  "construction-robot": "assembling-machine-1",
  "personal-roboport-equipment": "assembling-machine-1",
  "personal-roboport-mk2-equipment": "assembling-machine-1",
  "passive-provider-chest": "assembling-machine-1",
  "active-provider-chest": "assembling-machine-1",
  "requester-chest": "assembling-machine-1",
  "buffer-chest": "assembling-machine-1",
  "kovarex": "centrifuge",
  "nuclear-fuel": "centrifuge",
  "uranium-fuel-cell": "assembling-machine-1",
  "centrifuge": "assembling-machine-1",
  "nuclear-reactor": "assembling-machine-1",
  "steam-turbine": "assembling-machine-1",
  "heat-pipe": "assembling-machine-1",
  "heat-exchanger": "assembling-machine-1",
  "heating-tower": "assembling-machine-1",
  "fusion-power-cell": "assembling-machine-1",
  "fusion-reactor": "assembling-machine-1",
  "fusion-generator": "assembling-machine-1",
  "lightning-rod": "assembling-machine-1",
  "lightning-collector": "electromagnetic-plant",
  "small-electric-pole": "assembling-machine-1",
  "substation": "assembling-machine-1",
  "programmable-speaker": "assembling-machine-1",
  "small-lamp": "assembling-machine-1",
  "medium-electric-pole": "assembling-machine-1",
  "big-electric-pole": "assembling-machine-1",
  "constant-combinator": "assembling-machine-1",
  "arithmetic-combinator": "assembling-machine-1",
  "decider-combinator": "assembling-machine-1",
  "selector-combinator": "assembling-machine-1",
  "display-panel": "assembling-machine-1",
  "power-switch": "assembling-machine-1",
  "concrete": "assembling-machine-1",
  "refined-concrete": "assembling-machine-1",
  "hazard-concrete": "assembling-machine-1",
  "refined-hazard-concrete": "assembling-machine-1",
  "landfill": "assembling-machine-1",
  "foundation": "cryogenic-plant",
  "ice-platform": "cryogenic-plant",
  "modular-armor": "assembling-machine-1",
  "power-armor": "assembling-machine-1",
  "power-armor-mk2": "assembling-machine-1",
  "solar-panel-equipment": "assembling-machine-1",
  "fusion-reactor-equipment": "assembling-machine-1",
  "battery-equipment": "assembling-machine-1",
  "battery-mk2-equipment": "assembling-machine-1",
  "exoskeleton-equipment": "assembling-machine-1",
  "night-vision-equipment": "assembling-machine-1",
  "personal-laser-defense-equipment": "assembling-machine-1",
  "energy-shield-equipment": "assembling-machine-1",
  "energy-shield-mk2-equipment": "assembling-machine-1",
  "belt-immunity-equipment": "assembling-machine-1",
  "battery-mk3-equipment": "assembling-machine-1",
  "fission-reactor-equipment": "assembling-machine-1",
  "toolbelt-equipment": "assembling-machine-1",
  "mech-armor": "assembling-machine-1",
  "discharge-defense-equipment": "assembling-machine-1",
  "basic-oil": "oil-refinery",
  "advanced-oil": "oil-refinery",
  "coal-liquefaction": "oil-refinery",
  "simple-coal": "oil-refinery",
  "uranium-processing": "centrifuge",
  "nuclear-fuel-reprocessing": "centrifuge"
 },
 "names": {
  "iron-ore": {
   "zh": "铁矿",
   "en": "Iron ore"
  },
  "copper-ore": {
   "zh": "铜矿",
   "en": "Copper ore"
  },
  "coal": {
   "zh": "煤矿",
   "en": "Coal"
  },
  "solid-fuel": {
   "zh": "固体燃料",
   "en": "Solid fuel"
  },
  "stone": {
   "zh": "石矿",
   "en": "Stone"
  },
  "stone-brick": {
   "zh": "石砖",
   "en": "Stone brick"
  },
  "calcite": {
   "zh": "方解石",
   "en": "Calcite"
  },
  "iron-plate": {
   "zh": "铁板",
   "en": "Iron plate"
  },
  "copper-plate": {
   "zh": "铜板",
   "en": "Copper plate"
  },
  "iron-gear-wheel": {
   "zh": "铁齿轮",
   "en": "Iron gear wheel"
  },
  "iron-stick": {
   "zh": "铁棒",
   "en": "Iron stick"
  },
  "copper-cable": {
   "zh": "铜缆",
   "en": "Copper cable"
  },
  "electronic-circuit": {
   "zh": "电路板",
   "en": "Electronic circuit"
  },
  "automation-science-pack": {
   "zh": "机自科技包（红瓶）",
   "en": "Automation science pack"
  },
  "transport-belt": {
   "zh": "基础传送带",
   "en": "Transport belt"
  },
  "inserter": {
   "zh": "电力机械臂",
   "en": "Inserter"
  },
  "burner-inserter": {
   "zh": "热能机械臂",
   "en": "Burner inserter"
  },
  "long-handed-inserter": {
   "zh": "加长机械臂",
   "en": "Long-handed inserter"
  },
  "burner-mining-drill": {
   "zh": "热能采矿机",
   "en": "Burner mining drill"
  },
  "stone-furnace": {
   "zh": "石炉",
   "en": "Stone furnace"
  },
  "assembling-machine-1": {
   "zh": "组装机1型",
   "en": "Assembling machine 1"
  },
  "lab": {
   "zh": "研究中心",
   "en": "Lab"
  },
  "biolab": {
   "zh": "生物研究中心",
   "en": "Biolab"
  },
  "small-lamp": {
   "zh": "照明灯",
   "en": "Lamp"
  },
  "substation": {
   "zh": "广域配电站",
   "en": "Substation"
  },
  "programmable-speaker": {
   "zh": "程控扬声器",
   "en": "Programmable speaker"
  },
  "splitter": {
   "zh": "基础分流器",
   "en": "Splitter"
  },
  "underground-belt": {
   "zh": "基础地下传送带",
   "en": "Underground belt"
  },
  "steel-plate": {
   "zh": "钢材",
   "en": "Steel plate"
  },
  "boiler": {
   "zh": "锅炉",
   "en": "Boiler"
  },
  "steam-engine": {
   "zh": "蒸汽机",
   "en": "Steam engine"
  },
  "offshore-pump": {
   "zh": "抽取泵",
   "en": "Offshore pump"
  },
  "water": {
   "zh": "水",
   "en": "Water"
  },
  "steam": {
   "zh": "蒸汽",
   "en": "Steam"
  },
  "electric-mining-drill": {
   "zh": "电力采矿机",
   "en": "Electric mining drill"
  },
  "big-mining-drill": {
   "zh": "大型采矿机",
   "en": "Big mining drill"
  },
  "electric-furnace": {
   "zh": "电炉",
   "en": "Electric furnace"
  },
  "assembling-machine-2": {
   "zh": "组装机2型",
   "en": "Assembling machine 2"
  },
  "fast-transport-belt": {
   "zh": "高速传送带",
   "en": "Fast transport belt"
  },
  "fast-underground-belt": {
   "zh": "高速地下传送带",
   "en": "Fast underground belt"
  },
  "express-transport-belt": {
   "zh": "极速传送带",
   "en": "Express transport belt"
  },
  "express-underground-belt": {
   "zh": "极速地下传送带",
   "en": "Express underground belt"
  },
  "express-splitter": {
   "zh": "极速分流器",
   "en": "Express splitter"
  },
  "turbo-transport-belt": {
   "zh": "超速传送带",
   "en": "Turbo transport belt"
  },
  "turbo-underground-belt": {
   "zh": "超速地下传送带",
   "en": "Turbo underground belt"
  },
  "turbo-splitter": {
   "zh": "超速分流器",
   "en": "Turbo splitter"
  },
  "loader": {
   "zh": "装卸机",
   "en": "Loader"
  },
  "fast-loader": {
   "zh": "高速装卸机",
   "en": "Fast loader"
  },
  "express-loader": {
   "zh": "极速装卸机",
   "en": "Express loader"
  },
  "turbo-loader": {
   "zh": "超速装卸机",
   "en": "Turbo loader"
  },
  "fast-splitter": {
   "zh": "高速分流器",
   "en": "Fast splitter"
  },
  "bulk-inserter": {
   "zh": "集装机械臂",
   "en": "Bulk inserter"
  },
  "stack-inserter": {
   "zh": "堆叠机械臂",
   "en": "Stack inserter"
  },
  "fast-inserter": {
   "zh": "高速机械臂",
   "en": "Fast inserter"
  },
  "steel-chest": {
   "zh": "钢箱",
   "en": "Steel chest"
  },
  "logistic-science-pack": {
   "zh": "物流科技包（绿瓶）",
   "en": "Logistic science pack"
  },
  "chemical-science-pack": {
   "zh": "化工科技包（蓝瓶）",
   "en": "Chemical science pack"
  },
  "crude-oil": {
   "zh": "原油",
   "en": "Crude oil"
  },
  "heavy-oil": {
   "zh": "重油",
   "en": "Heavy oil"
  },
  "light-oil": {
   "zh": "轻油",
   "en": "Light oil"
  },
  "petroleum-gas": {
   "zh": "石油气",
   "en": "Petroleum gas"
  },
  "plastic-bar": {
   "zh": "塑料",
   "en": "Plastic bar"
  },
  "pipe": {
   "zh": "管道",
   "en": "Pipe"
  },
  "pipe-to-ground": {
   "zh": "地下管道",
   "en": "Pipe to ground"
  },
  "pump": {
   "zh": "管道泵",
   "en": "Pump"
  },
  "one-way-valve": {
   "zh": "单向阀",
   "en": "One-way valve"
  },
  "overflow-valve": {
   "zh": "溢流阀",
   "en": "Overflow valve"
  },
  "top-up-valve": {
   "zh": "补充阀",
   "en": "Top-up valve"
  },
  "storage-tank": {
   "zh": "储液罐",
   "en": "Storage tank"
  },
  "pumpjack": {
   "zh": "抽油机",
   "en": "Pumpjack"
  },
  "solar-panel": {
   "zh": "太阳能板",
   "en": "Solar panel"
  },
  "accumulator": {
   "zh": "蓄电器",
   "en": "Accumulator"
  },
  "steel-furnace": {
   "zh": "钢炉",
   "en": "Steel furnace"
  },
  "assembling-machine-3": {
   "zh": "组装机3型",
   "en": "Assembling machine 3"
  },
  "military-science-pack": {
   "zh": "军备科技包（灰瓶）",
   "en": "Military science pack"
  },
  "gun-turret": {
   "zh": "机枪炮塔",
   "en": "Gun turret"
  },
  "stone-wall": {
   "zh": "墙壁",
   "en": "Wall"
  },
  "gate": {
   "zh": "闸门",
   "en": "Gate"
  },
  "firearm-magazine": {
   "zh": "标准弹匣",
   "en": "Firearm magazine"
  },
  "piercing-rounds-magazine": {
   "zh": "穿甲弹匣",
   "en": "Piercing rounds magazine"
  },
  "oil-refinery": {
   "zh": "炼油厂",
   "en": "Oil refinery"
  },
  "chemical-plant": {
   "zh": "化工厂",
   "en": "Chemical plant"
  },
  "pistol": {
   "zh": "手枪",
   "en": "Pistol"
  },
  "submachine-gun": {
   "zh": "冲锋枪",
   "en": "Submachine gun"
  },
  "shotgun": {
   "zh": "霰弹枪",
   "en": "Shotgun"
  },
  "combat-shotgun": {
   "zh": "冲锋霰弹枪",
   "en": "Combat shotgun"
  },
  "shotgun-shell": {
   "zh": "霰弹",
   "en": "Shotgun shells"
  },
  "piercing-shotgun-shell": {
   "zh": "穿甲霰弹",
   "en": "Piercing shotgun shells"
  },
  "cluster-grenade": {
   "zh": "集束手雷",
   "en": "Cluster grenade"
  },
  "rocket-launcher": {
   "zh": "火箭筒",
   "en": "Rocket launcher"
  },
  "grenade": {
   "zh": "标准手雷",
   "en": "Grenade"
  },
  "rocket": {
   "zh": "火箭弹",
   "en": "Rocket"
  },
  "explosive-rocket": {
   "zh": "爆破火箭弹",
   "en": "Explosive rocket"
  },
  "flamethrower": {
   "zh": "火焰喷射器",
   "en": "Flamethrower"
  },
  "flamethrower-ammo": {
   "zh": "油料储罐",
   "en": "Flamethrower ammo"
  },
  "uranium-rounds-magazine": {
   "zh": "贫铀弹匣",
   "en": "Uranium rounds magazine"
  },
  "atomic-bomb": {
   "zh": "原子弹",
   "en": "Atomic bomb"
  },
  "uranium-cannon-shell": {
   "zh": "贫铀炮弹",
   "en": "Uranium cannon shell"
  },
  "poison-capsule": {
   "zh": "剧毒胶囊",
   "en": "Poison capsule"
  },
  "slowdown-capsule": {
   "zh": "减速胶囊",
   "en": "Slowdown capsule"
  },
  "laser-turret": {
   "zh": "激光炮塔",
   "en": "Laser turret"
  },
  "flamethrower-turret": {
   "zh": "火焰炮塔",
   "en": "Flamethrower turret"
  },
  "speed-module": {
   "zh": "速度插件",
   "en": "Speed module"
  },
  "speed-module-2": {
   "zh": "速度插件 2",
   "en": "Speed module 2"
  },
  "speed-module-3": {
   "zh": "速度插件 3",
   "en": "Speed module 3"
  },
  "productivity-module": {
   "zh": "产能插件",
   "en": "Productivity module"
  },
  "productivity-module-2": {
   "zh": "产能插件 2",
   "en": "Productivity module 2"
  },
  "productivity-module-3": {
   "zh": "产能插件 3",
   "en": "Productivity module 3"
  },
  "beacon": {
   "zh": "插件效果分享塔",
   "en": "Beacon"
  },
  "efficiency-module": {
   "zh": "节能插件",
   "en": "Efficiency module"
  },
  "efficiency-module-2": {
   "zh": "节能插件 2",
   "en": "Efficiency module 2"
  },
  "efficiency-module-3": {
   "zh": "节能插件 3",
   "en": "Efficiency module 3"
  },
  "quality-module": {
   "zh": "品质插件",
   "en": "Quality module"
  },
  "quality-module-2": {
   "zh": "品质插件 2",
   "en": "Quality module 2"
  },
  "quality-module-3": {
   "zh": "品质插件 3",
   "en": "Quality module 3"
  },
  "advanced-circuit": {
   "zh": "集成电路",
   "en": "Advanced circuit"
  },
  "engine-unit": {
   "zh": "内燃机",
   "en": "Engine unit"
  },
  "electric-engine-unit": {
   "zh": "电动机",
   "en": "Electric engine unit"
  },
  "processing-unit": {
   "zh": "处理器",
   "en": "Processing unit"
  },
  "low-density-structure": {
   "zh": "轻质框架",
   "en": "Low density structure"
  },
  "rocket-fuel": {
   "zh": "火箭燃料",
   "en": "Rocket fuel"
  },
  "rocket-part": {
   "zh": "火箭组件",
   "en": "Rocket part"
  },
  "satellite": {
   "zh": "卫星",
   "en": "Satellite"
  },
  "rocket-silo": {
   "zh": "火箭发射井",
   "en": "Rocket silo"
  },
  "cargo-landing-pad": {
   "zh": "物流接驳站",
   "en": "Cargo landing pad"
  },
  "cargo-bay": {
   "zh": "接驳扩展仓",
   "en": "Cargo bay"
  },
  "landing-pad-unloading-bay": {
   "zh": "接驳卸货仓",
   "en": "Landing pad unloading bay"
  },
  "radar": {
   "zh": "雷达",
   "en": "Radar"
  },
  "explosives": {
   "zh": "炸药",
   "en": "Explosives"
  },
  "cliff-explosives": {
   "zh": "悬崖炸药",
   "en": "Cliff explosives"
  },
  "battery": {
   "zh": "电池",
   "en": "Battery"
  },
  "flying-robot-frame": {
   "zh": "机器人构架",
   "en": "Flying robot frame"
  },
  "production-science-pack": {
   "zh": "生产科技包（紫瓶）",
   "en": "Production science pack"
  },
  "utility-science-pack": {
   "zh": "效能科技包（黄瓶）",
   "en": "Utility science pack"
  },
  "defender-capsule": {
   "zh": "防御无人机胶囊",
   "en": "Defender capsule"
  },
  "distractor-capsule": {
   "zh": "掩护无人机胶囊",
   "en": "Distractor capsule"
  },
  "destroyer-capsule": {
   "zh": "进攻无人机胶囊",
   "en": "Destroyer capsule"
  },
  "car": {
   "zh": "汽车",
   "en": "Car"
  },
  "tank": {
   "zh": "坦克",
   "en": "Tank"
  },
  "cannon-shell": {
   "zh": "标准炮弹",
   "en": "Cannon shell"
  },
  "explosive-cannon-shell": {
   "zh": "爆破炮弹",
   "en": "Explosive cannon shell"
  },
  "explosive-uranium-cannon-shell": {
   "zh": "爆破贫铀炮弹",
   "en": "Explosive uranium cannon shell"
  },
  "light-armor": {
   "zh": "轻型装甲",
   "en": "Light armor"
  },
  "heavy-armor": {
   "zh": "重型装甲",
   "en": "Heavy armor"
  },
  "spidertron": {
   "zh": "蜘蛛机甲",
   "en": "Spidertron"
  },
  "spidertron-remote": {
   "zh": "蜘蛛机甲遥控器",
   "en": "Spidertron remote"
  },
  "land-mine": {
   "zh": "地雷",
   "en": "Land mine"
  },
  "artillery-turret": {
   "zh": "重炮炮塔",
   "en": "Artillery turret"
  },
  "artillery-shell": {
   "zh": "重炮炮弹",
   "en": "Artillery shell"
  },
  "artillery-targeting-remote": {
   "zh": "重炮瞄准遥控器",
   "en": "Artillery targeting remote"
  },
  "rail": {
   "zh": "铁轨",
   "en": "Rail"
  },
  "locomotive": {
   "zh": "内燃机车",
   "en": "Locomotive"
  },
  "cargo-wagon": {
   "zh": "货运车厢",
   "en": "Cargo wagon"
  },
  "fluid-wagon": {
   "zh": "液罐车厢",
   "en": "Fluid wagon"
  },
  "artillery-wagon": {
   "zh": "重炮车厢",
   "en": "Artillery wagon"
  },
  "train-stop": {
   "zh": "车站",
   "en": "Train stop"
  },
  "rail-signal": {
   "zh": "常规铁路信号",
   "en": "Rail signal"
  },
  "rail-chain-signal": {
   "zh": "联锁铁路信号",
   "en": "Rail chain signal"
  },
  "rail-support": {
   "zh": "铁路支架",
   "en": "Rail support"
  },
  "rail-ramp": {
   "zh": "铁路斜坡",
   "en": "Rail ramp"
  },
  "lubricant": {
   "zh": "润滑油",
   "en": "Lubricant"
  },
  "sulfur": {
   "zh": "硫磺",
   "en": "Sulfur"
  },
  "sulfuric-acid": {
   "zh": "硫酸",
   "en": "Sulfuric acid"
  },
  "carbon": {
   "zh": "碳",
   "en": "Carbon"
  },
  "thruster-fuel": {
   "zh": "推进器燃料",
   "en": "Thruster fuel"
  },
  "thruster-oxidizer": {
   "zh": "推进器氧化剂",
   "en": "Thruster oxidizer"
  },
  "ammonia": {
   "zh": "氨",
   "en": "Ammonia"
  },
  "fluorine": {
   "zh": "氟",
   "en": "Fluorine"
  },
  "fluoroketone-cold": {
   "zh": "氟酮（冷）",
   "en": "Fluoroketone (Cold)"
  },
  "fluoroketone-hot": {
   "zh": "氟酮（热）",
   "en": "Fluoroketone (Hot)"
  },
  "ammoniacal-solution": {
   "zh": "氨溶液",
   "en": "Ammoniacal solution"
  },
  "lithium-brine": {
   "zh": "锂盐水",
   "en": "Lithium brine"
  },
  "lava": {
   "zh": "岩浆",
   "en": "Lava"
  },
  "fusion-plasma": {
   "zh": "等离子体",
   "en": "Plasma"
  },
  "carbon-fiber": {
   "zh": "碳纤维",
   "en": "Carbon fiber"
  },
  "lithium": {
   "zh": "锂",
   "en": "Lithium"
  },
  "lithium-plate": {
   "zh": "锂板",
   "en": "Lithium plate"
  },
  "superconductor": {
   "zh": "超导体",
   "en": "Superconductor"
  },
  "electromagnetic-science-pack": {
   "zh": "电磁科技包（粉瓶）",
   "en": "Electromagnetic science pack"
  },
  "electromagnetic-plant": {
   "zh": "电磁工厂",
   "en": "Electromagnetic plant"
  },
  "recycler": {
   "zh": "回收机",
   "en": "Recycler"
  },
  "holmium-ore": {
   "zh": "钬矿",
   "en": "Holmium ore"
  },
  "holmium-solution": {
   "zh": "钬溶液",
   "en": "Holmium solution"
  },
  "holmium-plate": {
   "zh": "钬板",
   "en": "Holmium plate"
  },
  "electrolyte": {
   "zh": "电解液",
   "en": "Electrolyte"
  },
  "teslagun": {
   "zh": "特斯拉枪",
   "en": "Tesla gun"
  },
  "supercapacitor": {
   "zh": "超级电容器",
   "en": "Supercapacitor"
  },
  "tesla-turret": {
   "zh": "特斯拉炮塔",
   "en": "Tesla turret"
  },
  "tesla-ammo": {
   "zh": "特斯拉弹药",
   "en": "Tesla ammo"
  },
  "rocket-turret": {
   "zh": "火箭炮塔",
   "en": "Rocket turret"
  },
  "railgun-turret": {
   "zh": "磁轨炮塔",
   "en": "Railgun turret"
  },
  "railgun-ammo": {
   "zh": "磁轨炮弹",
   "en": "Railgun ammo"
  },
  "tungsten-ore": {
   "zh": "钨矿",
   "en": "Tungsten ore"
  },
  "tungsten-plate": {
   "zh": "钨板",
   "en": "Tungsten plate"
  },
  "tungsten-carbide": {
   "zh": "碳化钨",
   "en": "Tungsten carbide"
  },
  "metallurgic-science-pack": {
   "zh": "冶金科技包（橙瓶）",
   "en": "Metallurgic science pack"
  },
  "foundry": {
   "zh": "铸造厂",
   "en": "Foundry"
  },
  "yumako": {
   "zh": "玉玛果",
   "en": "Yumako"
  },
  "yumako-seed": {
   "zh": "玉玛果种子",
   "en": "Yumako seed"
  },
  "yumako-mash": {
   "zh": "玉玛果泥",
   "en": "Yumako mash"
  },
  "bioflux": {
   "zh": "生物结晶",
   "en": "Bioflux"
  },
  "nutrients": {
   "zh": "营养素",
   "en": "Nutrients"
  },
  "spoilage": {
   "zh": "变质物",
   "en": "Spoilage"
  },
  "agricultural-science-pack": {
   "zh": "农业科技包（草瓶）",
   "en": "Agricultural science pack"
  },
  "biochamber": {
   "zh": "生物室",
   "en": "Biochamber"
  },
  "agricultural-tower": {
   "zh": "农业塔",
   "en": "Agricultural tower"
  },
  "artificial-yumako-soil": {
   "zh": "玉玛果人造土",
   "en": "Artificial yumako soil"
  },
  "overgrowth-yumako-soil": {
   "zh": "玉玛果沃土",
   "en": "Overgrowth yumako soil"
  },
  "artificial-jellynut-soil": {
   "zh": "果冻果人造土",
   "en": "Artificial jellynut soil"
  },
  "overgrowth-jellynut-soil": {
   "zh": "果冻果沃土",
   "en": "Overgrowth jellynut soil"
  },
  "jellynut": {
   "zh": "果冻果",
   "en": "Jellynut"
  },
  "jellynut-seed": {
   "zh": "果冻果种子",
   "en": "Jellynut seed"
  },
  "jelly": {
   "zh": "果冻",
   "en": "Jelly"
  },
  "biter-egg": {
   "zh": "异虫卵",
   "en": "Biter egg"
  },
  "pentapod-egg": {
   "zh": "五足虫卵",
   "en": "Pentapod egg"
  },
  "tree-seed": {
   "zh": "树种子",
   "en": "Tree seed"
  },
  "captive-biter-spawner": {
   "zh": "虫巢孵化器",
   "en": "Captive biter spawner"
  },
  "capture-robot-rocket": {
   "zh": "捕获者火箭弹",
   "en": "Capture bot rocket"
  },
  "iron-bacteria": {
   "zh": "铁细菌",
   "en": "Iron bacteria"
  },
  "copper-bacteria": {
   "zh": "铜细菌",
   "en": "Copper bacteria"
  },
  "crusher": {
   "zh": "破碎机",
   "en": "Crusher"
  },
  "metallic-asteroid-chunk": {
   "zh": "金属星块",
   "en": "Metallic asteroid chunk"
  },
  "carbonic-asteroid-chunk": {
   "zh": "碳质星块",
   "en": "Carbonic asteroid chunk"
  },
  "oxide-asteroid-chunk": {
   "zh": "氧化星块",
   "en": "Oxide asteroid chunk"
  },
  "promethium-asteroid-chunk": {
   "zh": "钷素星块",
   "en": "Promethium asteroid chunk"
  },
  "ice": {
   "zh": "冰",
   "en": "Ice"
  },
  "space-platform-foundation": {
   "zh": "太空平台基座",
   "en": "Space platform foundation"
  },
  "space-platform-hub": {
   "zh": "太空平台枢纽",
   "en": "Space platform hub"
  },
  "thruster": {
   "zh": "推进器",
   "en": "Thruster"
  },
  "asteroid-collector": {
   "zh": "星岩抓取臂",
   "en": "Asteroid collector"
  },
  "space-platform-starter-pack": {
   "zh": "太空平台启动包",
   "en": "Space platform starter pack"
  },
  "roboport": {
   "zh": "机器人指令平台",
   "en": "Roboport"
  },
  "logistic-robot": {
   "zh": "物流机器人",
   "en": "Logistic robot"
  },
  "construction-robot": {
   "zh": "建设机器人",
   "en": "Construction robot"
  },
  "personal-roboport-equipment": {
   "zh": "机器人指令模块",
   "en": "Personal roboport"
  },
  "personal-roboport-mk2-equipment": {
   "zh": "机器人指令模块 MK2",
   "en": "Personal roboport MK2"
  },
  "passive-provider-chest": {
   "zh": "被动供货箱（红箱）",
   "en": "Passive provider chest"
  },
  "active-provider-chest": {
   "zh": "主动供货箱（紫箱）",
   "en": "Active provider chest"
  },
  "storage-chest": {
   "zh": "被动存货箱（黄箱）",
   "en": "Storage chest"
  },
  "buffer-chest": {
   "zh": "主动存货箱（绿箱）",
   "en": "Buffer chest"
  },
  "requester-chest": {
   "zh": "优先集货箱（蓝箱）",
   "en": "Requester chest"
  },
  "raw-fish": {
   "zh": "鲜鱼",
   "en": "Raw fish"
  },
  "uranium-ore": {
   "zh": "铀矿",
   "en": "Uranium ore"
  },
  "uranium-235": {
   "zh": "铀-235",
   "en": "Uranium-235"
  },
  "uranium-238": {
   "zh": "铀-238",
   "en": "Uranium-238"
  },
  "nuclear-fuel": {
   "zh": "核能燃料",
   "en": "Nuclear fuel"
  },
  "uranium-fuel-cell": {
   "zh": "铀燃料棒",
   "en": "Uranium fuel cell"
  },
  "depleted-uranium-fuel-cell": {
   "zh": "贫铀燃料棒",
   "en": "Depleted uranium fuel cell"
  },
  "centrifuge": {
   "zh": "离心机",
   "en": "Centrifuge"
  },
  "nuclear-reactor": {
   "zh": "核反应堆",
   "en": "Nuclear reactor"
  },
  "steam-turbine": {
   "zh": "汽轮机",
   "en": "Steam turbine"
  },
  "heat-pipe": {
   "zh": "热管",
   "en": "Heat pipe"
  },
  "heat-exchanger": {
   "zh": "换热器",
   "en": "Heat exchanger"
  },
  "heating-tower": {
   "zh": "供热塔",
   "en": "Heating tower"
  },
  "fusion-reactor": {
   "zh": "聚变反应堆",
   "en": "Fusion reactor"
  },
  "fusion-generator": {
   "zh": "聚变发电机",
   "en": "Fusion generator"
  },
  "fusion-power-cell": {
   "zh": "聚变燃料棒",
   "en": "Fusion power cell"
  },
  "lightning-rod": {
   "zh": "避雷针",
   "en": "Lightning rod"
  },
  "lightning-collector": {
   "zh": "闪电捕捉器",
   "en": "Lightning collector"
  },
  "small-electric-pole": {
   "zh": "小型电线杆",
   "en": "Small electric pole"
  },
  "medium-electric-pole": {
   "zh": "中型电线杆",
   "en": "Medium electric pole"
  },
  "big-electric-pole": {
   "zh": "远程输电塔",
   "en": "Big electric pole"
  },
  "constant-combinator": {
   "zh": "常量运算器",
   "en": "Constant combinator"
  },
  "arithmetic-combinator": {
   "zh": "算术运算器",
   "en": "Arithmetic combinator"
  },
  "decider-combinator": {
   "zh": "判断运算器",
   "en": "Decider combinator"
  },
  "selector-combinator": {
   "zh": "选择运算器",
   "en": "Selector combinator"
  },
  "display-panel": {
   "zh": "显示器",
   "en": "Display panel"
  },
  "power-switch": {
   "zh": "电闸",
   "en": "Power switch"
  },
  "red-wire": {
   "zh": "红线",
   "en": "Red wire"
  },
  "green-wire": {
   "zh": "绿线",
   "en": "Green wire"
  },
  "concrete": {
   "zh": "标准混凝土",
   "en": "Concrete"
  },
  "refined-concrete": {
   "zh": "钢筋混凝土",
   "en": "Refined concrete"
  },
  "hazard-concrete": {
   "zh": "标准混凝土（标识）",
   "en": "Hazard concrete"
  },
  "refined-hazard-concrete": {
   "zh": "钢筋混凝土（标识）",
   "en": "Refined hazard concrete"
  },
  "stone-path": {
   "zh": "石砖路",
   "en": "Stone path"
  },
  "landfill": {
   "zh": "填埋材料",
   "en": "Landfill"
  },
  "foundation": {
   "zh": "工程基座",
   "en": "Foundation"
  },
  "ice-platform": {
   "zh": "浮冰平台",
   "en": "Ice platform"
  },
  "modular-armor": {
   "zh": "模块装甲",
   "en": "Modular armor"
  },
  "power-armor": {
   "zh": "能量装甲",
   "en": "Power armor"
  },
  "power-armor-mk2": {
   "zh": "能量装甲 MK2",
   "en": "Power armor MK2"
  },
  "solar-panel-equipment": {
   "zh": "太阳能模块",
   "en": "Portable solar panel"
  },
  "fusion-reactor-equipment": {
   "zh": "聚变反应堆模块",
   "en": "Portable fusion reactor"
  },
  "battery-equipment": {
   "zh": "电池组模块",
   "en": "Personal battery"
  },
  "battery-mk2-equipment": {
   "zh": "电池组模块 MK2",
   "en": "Personal battery MK2"
  },
  "exoskeleton-equipment": {
   "zh": "外骨骼模块",
   "en": "Exoskeleton"
  },
  "night-vision-equipment": {
   "zh": "夜视模块",
   "en": "Nightvision"
  },
  "personal-laser-defense-equipment": {
   "zh": "激光防御模块",
   "en": "Personal laser defense"
  },
  "energy-shield-equipment": {
   "zh": "能量盾模块",
   "en": "Energy shield"
  },
  "energy-shield-mk2-equipment": {
   "zh": "能量盾模块 MK2",
   "en": "Energy shield MK2"
  },
  "belt-immunity-equipment": {
   "zh": "锚定模块",
   "en": "Belt immunity equipment"
  },
  "discharge-defense-equipment": {
   "zh": "放电防御模块",
   "en": "Discharge defense"
  },
  "discharge-defense-remote": {
   "zh": "放电防御遥控器",
   "en": "Discharge defense remote"
  },
  "wood": {
   "zh": "木材",
   "en": "Wood"
  },
  "wooden-chest": {
   "zh": "木箱",
   "en": "Wooden chest"
  },
  "iron-chest": {
   "zh": "铁箱",
   "en": "Iron chest"
  },
  "repair-pack": {
   "zh": "修理包",
   "en": "Repair pack"
  },
  "deconstruction-planner": {
   "zh": "红图（拆除规划）",
   "en": "Deconstruction planner"
  },
  "upgrade-planner": {
   "zh": "绿图（升级规划）",
   "en": "Upgrade planner"
  },
  "space-science-pack": {
   "zh": "太空科技包（白瓶）",
   "en": "Space science pack"
  },
  "promethium-science-pack": {
   "zh": "钷素科技包（黑瓶）",
   "en": "Promethium science pack"
  },
  "cryogenic-plant": {
   "zh": "低温工厂",
   "en": "Cryogenic plant"
  },
  "cryogenic-science-pack": {
   "zh": "低温科技包（靛瓶）",
   "en": "Cryogenic science pack"
  },
  "quantum-processor": {
   "zh": "量子处理器",
   "en": "Quantum processor"
  },
  "molten-iron": {
   "zh": "熔融铁",
   "en": "Molten iron"
  },
  "molten-copper": {
   "zh": "熔融铜",
   "en": "Molten copper"
  },
  "scrap": {
   "zh": "废料",
   "en": "Scrap"
  },
  "battery-mk3-equipment": {
   "zh": "电池组模块 MK3",
   "en": "Personal battery MK3"
  },
  "fission-reactor-equipment": {
   "zh": "裂变反应堆模块",
   "en": "Portable fission reactor"
  },
  "toolbelt-equipment": {
   "zh": "工具腰带模块",
   "en": "Toolbelt equipment"
  },
  "mech-armor": {
   "zh": "机械装甲",
   "en": "Mech armor"
  },
  "railgun": {
   "zh": "磁轨炮",
   "en": "Railgun"
  },
  "barrel": {
   "zh": "空桶",
   "en": "Barrel"
  },
  "crude-oil-barrel": {
   "zh": "原油桶",
   "en": "Crude oil barrel"
  }
 },
 "recipeNames": {
  "crack-light": {
   "zh": "重油裂解",
   "en": "Heavy oil cracking to light oil"
  },
  "crack-gas": {
   "zh": "轻油裂解",
   "en": "Light oil cracking to petroleum gas"
  },
  "solid-fuel": {
   "zh": "石油气制固体燃料",
   "en": "Solid fuel from petroleum gas"
  },
  "solid-fuel-light-oil": {
   "zh": "轻油制固体燃料",
   "en": "Solid fuel from light oil"
  },
  "solid-fuel-heavy-oil": {
   "zh": "重油制固体燃料",
   "en": "Solid fuel from heavy oil"
  },
  "advanced-thruster-fuel": {
   "zh": "高级推进器燃料",
   "en": "Advanced thruster fuel"
  },
  "advanced-thruster-oxidizer": {
   "zh": "高级推进器氧化剂",
   "en": "Advanced thruster oxidizer"
  },
  "yumako-mash": {
   "zh": "玉玛果加工",
   "en": "Yumako processing"
  },
  "nutrients-from-yumako-mash": {
   "zh": "玉玛果泥制营养素",
   "en": "Nutrients from yumako mash"
  },
  "nutrients-from-bioflux": {
   "zh": "生物结晶制营养素",
   "en": "Nutrients from bioflux"
  },
  "nutrients-from-spoilage": {
   "zh": "变质物制营养素",
   "en": "Nutrients from spoilage"
  },
  "burnt-spoilage": {
   "zh": "燃烧变质物",
   "en": "Burnt spoilage"
  },
  "biosulfur": {
   "zh": "生物硫磺",
   "en": "Biosulfur"
  },
  "bioplastic": {
   "zh": "生物塑料",
   "en": "Bioplastic"
  },
  "biolubricant": {
   "zh": "生物润滑油",
   "en": "Biolubricant"
  },
  "coal-synthesis": {
   "zh": "煤合成",
   "en": "Coal synthesis"
  },
  "jellynut-processing": {
   "zh": "果冻果加工",
   "en": "Jellynut processing"
  },
  "nutrients-from-biter-egg": {
   "zh": "异虫卵制营养素",
   "en": "Nutrients from biter egg"
  },
  "fish-breeding": {
   "zh": "养鱼",
   "en": "Fish breeding"
  },
  "nutrients-from-fish": {
   "zh": "鲜鱼制营养素",
   "en": "Nutrients from fish"
  },
  "rocket-fuel-from-jelly": {
   "zh": "果冻制火箭燃料",
   "en": "Rocket fuel from jelly"
  },
  "solid-fuel-from-ammonia": {
   "zh": "氨制固体燃料",
   "en": "Solid fuel from ammonia"
  },
  "iron-bacteria": {
   "zh": "铁细菌",
   "en": "Iron bacteria"
  },
  "copper-bacteria": {
   "zh": "铜细菌",
   "en": "Copper bacteria"
  },
  "iron-bacteria-cultivation": {
   "zh": "铁细菌培养",
   "en": "Iron bacteria cultivation"
  },
  "copper-bacteria-cultivation": {
   "zh": "铜细菌培养",
   "en": "Copper bacteria cultivation"
  },
  "metallic-asteroid-crushing": {
   "zh": "金属星岩粉碎",
   "en": "Metallic asteroid crushing"
  },
  "carbonic-asteroid-crushing": {
   "zh": "碳质星岩粉碎",
   "en": "Carbonic asteroid crushing"
  },
  "oxide-asteroid-crushing": {
   "zh": "氧化星岩粉碎",
   "en": "Oxide asteroid crushing"
  },
  "advanced-metallic-asteroid-crushing": {
   "zh": "高级金属星岩粉碎",
   "en": "Advanced metallic asteroid crushing"
  },
  "advanced-carbonic-asteroid-crushing": {
   "zh": "高级碳质星岩粉碎",
   "en": "Advanced carbonic asteroid crushing"
  },
  "advanced-oxide-asteroid-crushing": {
   "zh": "高级氧化星岩粉碎",
   "en": "Advanced oxide asteroid crushing"
  },
  "metallic-asteroid-reprocessing": {
   "zh": "金属星岩再处理",
   "en": "Metallic asteroid reprocessing"
  },
  "carbonic-asteroid-reprocessing": {
   "zh": "碳质星岩再处理",
   "en": "Carbonic asteroid reprocessing"
  },
  "oxide-asteroid-reprocessing": {
   "zh": "氧化星岩再处理",
   "en": "Oxide asteroid reprocessing"
  },
  "ammoniacal-solution-separation": {
   "zh": "氨溶液分离",
   "en": "Ammoniacal solution separation"
  },
  "ammonia-rocket-fuel": {
   "zh": "氨制火箭燃料",
   "en": "Ammonia rocket fuel"
  },
  "iron-ore-melting": {
   "zh": "铁矿制熔融铁",
   "en": "Iron ore melting"
  },
  "copper-ore-melting": {
   "zh": "铜矿制熔融铜",
   "en": "Copper ore melting"
  },
  "casting-iron": {
   "zh": "浇铸铁",
   "en": "Casting iron"
  },
  "casting-steel": {
   "zh": "浇铸钢",
   "en": "Casting steel"
  },
  "casting-copper": {
   "zh": "浇铸铜",
   "en": "Casting copper"
  },
  "casting-iron-gear-wheel": {
   "zh": "浇铸铁齿轮",
   "en": "Casting iron gear wheel"
  },
  "casting-iron-stick": {
   "zh": "浇铸铁棒",
   "en": "Casting iron stick"
  },
  "casting-pipe": {
   "zh": "浇铸管道",
   "en": "Casting pipe"
  },
  "casting-pipe-to-ground": {
   "zh": "浇铸地下管道",
   "en": "Casting pipe to ground"
  },
  "casting-low-density-structure": {
   "zh": "浇铸轻质框架",
   "en": "Casting low density structure"
  },
  "casting-copper-cable": {
   "zh": "浇铸铜缆",
   "en": "Casting copper cable"
  },
  "concrete-from-molten-iron": {
   "zh": "熔融铁制混凝土",
   "en": "Concrete from molten iron"
  },
  "steam-condensation": {
   "zh": "蒸汽冷凝",
   "en": "Steam condensation"
  },
  "acid-neutralisation": {
   "zh": "酸中和",
   "en": "Acid neutralisation"
  },
  "molten-iron-from-lava": {
   "zh": "岩浆制熔融铁",
   "en": "Molten iron from lava"
  },
  "molten-copper-from-lava": {
   "zh": "岩浆制熔融铜",
   "en": "Molten copper from lava"
  },
  "ice-melting": {
   "zh": "融冰",
   "en": "Ice melting"
  },
  "kovarex": {
   "zh": "铀增殖处理",
   "en": "Kovarex enrichment process"
  },
  "basic-oil": {
   "zh": "基础原油处理",
   "en": "Basic oil processing"
  },
  "advanced-oil": {
   "zh": "高等原油处理",
   "en": "Advanced oil processing"
  },
  "coal-liquefaction": {
   "zh": "煤炭液化",
   "en": "Coal liquefaction"
  },
  "simple-coal": {
   "zh": "简易煤炭液化",
   "en": "Simple coal liquefaction"
  },
  "uranium-processing": {
   "zh": "铀浓缩处理",
   "en": "Uranium processing"
  },
  "nuclear-fuel-reprocessing": {
   "zh": "乏燃料后处理",
   "en": "Nuclear fuel reprocessing"
  }
 },
 "undergroundDist": {
  "underground-belt": 5,
  "fast-underground-belt": 7,
  "express-underground-belt": 9,
  "turbo-underground-belt": 11
 },
 "renewable": {
  "solarPower": 60,
  "accumCap": 5000,
  "accumChargeRate": 300
 },
 "fluidCapacity": {
  "storageTank": 25000,
  "fluidWagon": 50000,
  "pumpRate": 20,
  "pipeVolume": 100,
  "pipeToGroundVolume": 100
 },
 "beaconRange": 3,
 "turret": {
  "gun-turret": {
   "range": 18,
   "fireRate": 0.1,
   "powerDraw": 0
  },
  "laser-turret": {
   "range": 24,
   "fireRate": 0.667,
   "powerDraw": 9600,
   "drain": 24,
   "damage": 14
  },
  "flamethrower-turret": {
   "range": 30,
   "fireRate": 0.067,
   "powerDraw": 0,
   "damage": 8
  },
  "tesla-turret": {
   "range": 30,
   "fireRate": 2,
   "powerDraw": 7000,
   "drain": 1000,
   "damage": 30
  },
  "rocket-turret": {
   "range": 36,
   "fireRate": 2,
   "powerDraw": 0
  },
  "railgun-turret": {
   "range": 40,
   "fireRate": 2.833,
   "powerDraw": 10000,
   "drain": null
  }
 },
 "ammoDamage": {
  "firearm-magazine": 5,
  "piercing-rounds-magazine": 8,
  "uranium-rounds-magazine": 24,
  "railgun-ammo": 10000,
  "rocket": 35,
  "explosive-rocket": 60
 },
 "radar": {
  "range": 14,
  "power": 300
 },
 "cargoLandingPad": {
  "inventorySize": 80,
  "radarRange": 4
 },
 "cargoBay": {
  "inventorySizeBonus": 20
 },
 "cargoUnloadingBay": {
  "inventorySizeBonus": 20,
  "allowUnloading": true,
  "unloadingDistance": 59
 },
 "equipment": {
  "solar-panel-equipment": {
   "powerOut": 30
  },
  "fusion-reactor-equipment": {
   "powerOut": 2500
  },
  "battery-equipment": {
   "powerCap": 20000
  },
  "battery-mk2-equipment": {
   "powerCap": 100000
  },
  "battery-mk3-equipment": {
   "powerCap": 250000
  },
  "fission-reactor-equipment": {
   "powerOut": 750
  },
  "energy-shield-equipment": {
   "shield": 50
  },
  "energy-shield-mk2-equipment": {
   "shield": 150
  },
  "exoskeleton-equipment": {
   "speed": 0.3
  },
  "personal-laser-defense-equipment": {
   "laser": 15
  },
  "discharge-defense-equipment": {
   "discharge": true,
   "dischargeRange": 10,
   "dischargeCooldown": 2.5
  },
  "toolbelt-equipment": {
   "extraSlots": 10
  }
 },
 "heat": {
  "reactorMaxTemp": 1000,
  "reactorSpecificHeat": 10,
  "reactorMaxTransfer": 10000,
  "heatPipeMaxTemp": 1000,
  "heatPipeMinGlowTemp": 350,
  "heatPipeSpecificHeat": 1,
  "heatPipeMaxTransfer": 1000,
  "reactorHeatRate": 40,
  "heatingTowerRate": 40,
  "heatingTowerEffectivity": 2.5,
  "heatingTowerMaxTemp": 1000,
  "heatingTowerSpecificHeat": 5,
  "heatingTowerMaxTransfer": 10000
 },
 "lightning": {
  "rodEfficiency": 0.2,
  "rodRange": 15,
  "rodBufferMJ": 500,
  "collectorEfficiency": 0.4,
  "collectorRange": 25,
  "collectorBufferMJ": 1000
 },
 "roboportPower": 50,
 "footprint": {
  "transport-belt": {
   "w": 1,
   "h": 1
  },
  "fast-transport-belt": {
   "w": 1,
   "h": 1
  },
  "express-transport-belt": {
   "w": 1,
   "h": 1
  },
  "turbo-transport-belt": {
   "w": 1,
   "h": 1
  },
  "loader": {
   "w": 1,
   "h": 2
  },
  "fast-loader": {
   "w": 1,
   "h": 2
  },
  "express-loader": {
   "w": 1,
   "h": 2
  },
  "turbo-loader": {
   "w": 1,
   "h": 2
  },
  "underground-belt": {
   "w": 1,
   "h": 1
  },
  "fast-underground-belt": {
   "w": 1,
   "h": 1
  },
  "express-underground-belt": {
   "w": 1,
   "h": 1
  },
  "turbo-underground-belt": {
   "w": 1,
   "h": 1
  },
  "splitter": {
   "w": 2,
   "h": 1
  },
  "fast-splitter": {
   "w": 2,
   "h": 1
  },
  "express-splitter": {
   "w": 2,
   "h": 1
  },
  "inserter": {
   "w": 1,
   "h": 1
  },
  "burner-inserter": {
   "w": 1,
   "h": 1
  },
  "long-handed-inserter": {
   "w": 1,
   "h": 1
  },
  "fast-inserter": {
   "w": 1,
   "h": 1
  },
  "bulk-inserter": {
   "w": 1,
   "h": 1
  },
  "stack-inserter": {
   "w": 1,
   "h": 1
  },
  "burner-mining-drill": {
   "w": 2,
   "h": 2
  },
  "electric-mining-drill": {
   "w": 3,
   "h": 3
  },
  "pumpjack": {
   "w": 3,
   "h": 3
  },
  "big-mining-drill": {
   "w": 5,
   "h": 5
  },
  "stone-furnace": {
   "w": 2,
   "h": 2
  },
  "steel-furnace": {
   "w": 2,
   "h": 2
  },
  "electric-furnace": {
   "w": 3,
   "h": 3
  },
  "assembling-machine-1": {
   "w": 3,
   "h": 3
  },
  "assembling-machine-2": {
   "w": 3,
   "h": 3
  },
  "assembling-machine-3": {
   "w": 3,
   "h": 3
  },
  "oil-refinery": {
   "w": 5,
   "h": 5
  },
  "chemical-plant": {
   "w": 3,
   "h": 3
  },
  "centrifuge": {
   "w": 3,
   "h": 3
  },
  "beacon": {
   "w": 3,
   "h": 3
  },
  "lab": {
   "w": 3,
   "h": 3
  },
  "boiler": {
   "w": 3,
   "h": 2
  },
  "steam-engine": {
   "w": 3,
   "h": 5
  },
  "steam-turbine": {
   "w": 3,
   "h": 5
  },
  "heat-exchanger": {
   "w": 3,
   "h": 2
  },
  "offshore-pump": {
   "w": 2,
   "h": 2
  },
  "pipe": {
   "w": 1,
   "h": 1
  },
  "pipe-to-ground": {
   "w": 1,
   "h": 1
  },
  "pump": {
   "w": 1,
   "h": 2
  },
  "storage-tank": {
   "w": 3,
   "h": 3
  },
  "one-way-valve": {
   "w": 1,
   "h": 1
  },
  "overflow-valve": {
   "w": 1,
   "h": 1
  },
  "top-up-valve": {
   "w": 1,
   "h": 1
  },
  "solar-panel": {
   "w": 3,
   "h": 3
  },
  "accumulator": {
   "w": 2,
   "h": 2
  },
  "radar": {
   "w": 3,
   "h": 3
  },
  "rocket-silo": {
   "w": 9,
   "h": 9
  },
  "cargo-landing-pad": {
   "w": 8,
   "h": 8
  },
  "cargo-bay": {
   "w": 4,
   "h": 4
  },
  "landing-pad-unloading-bay": {
   "w": 4,
   "h": 5
  },
  "roboport": {
   "w": 4,
   "h": 4
  },
  "nuclear-reactor": {
   "w": 5,
   "h": 5
  },
  "heat-pipe": {
   "w": 1,
   "h": 1
  },
  "gun-turret": {
   "w": 2,
   "h": 2
  },
  "laser-turret": {
   "w": 2,
   "h": 2
  },
  "tesla-turret": {
   "w": 4,
   "h": 4
  },
  "rocket-turret": {
   "w": 3,
   "h": 3
  },
  "railgun-turret": {
   "w": 3,
   "h": 5
  },
  "flamethrower-turret": {
   "w": 2,
   "h": 3
  },
  "stone-wall": {
   "w": 1,
   "h": 1
  },
  "gate": {
   "w": 1,
   "h": 1
  },
  "small-electric-pole": {
   "w": 1,
   "h": 1
  },
  "medium-electric-pole": {
   "w": 1,
   "h": 1
  },
  "big-electric-pole": {
   "w": 2,
   "h": 2
  },
  "substation": {
   "w": 2,
   "h": 2
  },
  "constant-combinator": {
   "w": 1,
   "h": 1
  },
  "arithmetic-combinator": {
   "w": 1,
   "h": 2
  },
  "decider-combinator": {
   "w": 1,
   "h": 2
  },
  "selector-combinator": {
   "w": 1,
   "h": 2
  },
  "display-panel": {
   "w": 1,
   "h": 2
  },
  "power-switch": {
   "w": 2,
   "h": 2
  },
  "programmable-speaker": {
   "w": 1,
   "h": 1
  },
  "land-mine": {
   "w": 1,
   "h": 1
  },
  "electromagnetic-plant": {
   "w": 4,
   "h": 4
  },
  "recycler": {
   "w": 2,
   "h": 4
  },
  "biochamber": {
   "w": 3,
   "h": 3
  },
  "crusher": {
   "w": 2,
   "h": 3
  },
  "foundry": {
   "w": 5,
   "h": 5
  },
  "cryogenic-plant": {
   "w": 5,
   "h": 5
  },
  "agricultural-tower": {
   "w": 3,
   "h": 3
  },
  "heating-tower": {
   "w": 3,
   "h": 3
  },
  "biolab": {
   "w": 5,
   "h": 5
  },
  "captive-biter-spawner": {
   "w": 5,
   "h": 5
  },
  "lightning-rod": {
   "w": 1,
   "h": 1
  },
  "lightning-collector": {
   "w": 2,
   "h": 2
  },
  "space-platform-hub": {
   "w": 8,
   "h": 8
  },
  "thruster": {
   "w": 4,
   "h": 8
  },
  "asteroid-collector": {
   "w": 3,
   "h": 3
  },
  "fusion-reactor": {
   "w": 6,
   "h": 6
  },
  "fusion-generator": {
   "w": 3,
   "h": 5
  }
 },
 "steamPower": {
  "boilerPower": 1.8,
  "boilerTargetTemp": 165,
  "engineRate": 30,
  "effectivity": 1,
  "turbineRate": 60
 },
 "robotSpeed": {
  "logistic": 3,
  "construction": 3.6
 },
 "inserterStats": {
  "rotationSpeed": 0.014,
  "extensionSpeed": 0.035,
  "perType": {
   "inserter": {
    "rotationSpeed": 0.014,
    "extensionSpeed": 0.035,
    "stack": 1
   },
   "long-handed-inserter": {
    "rotationSpeed": 0.02,
    "extensionSpeed": 0.05,
    "stack": 1
   },
   "fast-inserter": {
    "rotationSpeed": 0.04,
    "extensionSpeed": 0.1,
    "stack": 1
   },
   "bulk-inserter": {
    "rotationSpeed": 0.04,
    "extensionSpeed": 0.1,
    "stack": 3
   },
   "stack-inserter": {
    "rotationSpeed": 0.04,
    "extensionSpeed": 0.1,
    "stack": 4
   },
   "burner-inserter": {
    "rotationSpeed": 0.013,
    "extensionSpeed": 0.035,
    "stack": 1
   }
  }
 },
 "dlc": {
  "version": "2.1.17",
  "items": {
   "cargo-landing-pad": {
    "stack": 1
   },
   "recycler": {
    "stack": 20
   },
   "space-platform-foundation": {
    "stack": 100
   },
   "agricultural-science-pack": {
    "stack": 200
   },
   "electromagnetic-science-pack": {
    "stack": 200
   },
   "promethium-science-pack": {
    "stack": 200
   },
   "landing-pad-unloading-bay": {
    "stack": 10
   },
   "metallic-asteroid-chunk": {
    "stack": 1
   },
   "carbonic-asteroid-chunk": {
    "stack": 1
   },
   "oxide-asteroid-chunk": {
    "stack": 1
   },
   "promethium-asteroid-chunk": {
    "stack": 1
   },
   "asteroid-collector": {
    "stack": 10
   },
   "thruster": {
    "stack": 10
   },
   "carbon": {
    "stack": 50
   },
   "big-mining-drill": {
    "stack": 20
   },
   "yumako-seed": {
    "stack": 10
   },
   "artificial-yumako-soil": {
    "stack": 100
   },
   "overgrowth-yumako-soil": {
    "stack": 100
   },
   "agricultural-tower": {
    "stack": 20
   },
   "carbon-fiber": {
    "stack": 100
   },
   "lithium": {
    "stack": 50
   },
   "lithium-plate": {
    "stack": 100
   },
   "lightning-rod": {
    "stack": 50
   },
   "lightning-collector": {
    "stack": 20
   },
   "electromagnetic-plant": {
    "stack": 20
   },
   "superconductor": {
    "stack": 200
   },
   "space-platform-hub": {
    "stack": 1
   },
   "fluoroketone-cold-barrel": {
    "stack": 10
   },
   "fluoroketone-hot-barrel": {
    "stack": 10
   }
  },
  "recipes": {
   "cargo-landing-pad": true,
   "quality-module": true,
   "quality-module-2": true,
   "quality-module-3": true,
   "recycler": true,
   "yumako-processing": true,
   "artificial-yumako-soil": true,
   "overgrowth-yumako-soil": true,
   "nutrients-from-yumako-mash": true,
   "nutrients-from-bioflux": true,
   "bioflux": true,
   "carbon-fiber": true,
   "space-platform-foundation": true,
   "space-platform-starter-pack": true,
   "landing-pad-unloading-bay": true,
   "asteroid-collector": true,
   "thruster": true,
   "agricultural-science-pack": true,
   "electromagnetic-science-pack": true,
   "metallic-asteroid-crushing": true,
   "carbonic-asteroid-crushing": true,
   "oxide-asteroid-crushing": true,
   "advanced-metallic-asteroid-crushing": true,
   "advanced-carbonic-asteroid-crushing": true,
   "advanced-oxide-asteroid-crushing": true,
   "metallic-asteroid-reprocessing": true,
   "carbonic-asteroid-reprocessing": true,
   "oxide-asteroid-reprocessing": true,
   "thruster-fuel": true,
   "thruster-oxidizer": true,
   "advanced-thruster-fuel": true,
   "advanced-thruster-oxidizer": true,
   "carbon": true,
   "big-mining-drill": true,
   "agricultural-tower": true,
   "capture-robot-rocket": true,
   "lightning-rod": true,
   "electromagnetic-plant": true,
   "superconductor": true,
   "lightning-collector": true,
   "lithium": true,
   "lithium-plate": true,
   "fluoroketone": true,
   "fluoroketone-cooling": true,
   "promethium-science-pack": true,
   "fluoroketone-cold-barrel": true,
   "empty-fluoroketone-cold-barrel": true,
   "fluoroketone-hot-barrel": true,
   "empty-fluoroketone-hot-barrel": true,
   "cargo-landing-pad-recycling": true,
   "quality-module-recycling": true,
   "quality-module-2-recycling": true,
   "quality-module-3-recycling": true,
   "recycler-recycling": true,
   "artificial-yumako-soil-recycling": true,
   "overgrowth-yumako-soil-recycling": true,
   "space-platform-foundation-recycling": true,
   "landing-pad-unloading-bay-recycling": true,
   "asteroid-collector-recycling": true,
   "thruster-recycling": true,
   "big-mining-drill-recycling": true,
   "agricultural-tower-recycling": true,
   "capture-robot-rocket-recycling": true,
   "lightning-rod-recycling": true,
   "electromagnetic-plant-recycling": true,
   "lightning-collector-recycling": true,
   "fluoroketone-cold-barrel-recycling": true,
   "fluoroketone-hot-barrel-recycling": true,
   "agricultural-science-pack-recycling": true,
   "electromagnetic-science-pack-recycling": true,
   "promethium-science-pack-recycling": true,
   "metallic-asteroid-chunk-recycling": true,
   "carbonic-asteroid-chunk-recycling": true,
   "oxide-asteroid-chunk-recycling": true,
   "promethium-asteroid-chunk-recycling": true,
   "carbon-recycling": true,
   "yumako-seed-recycling": true,
   "carbon-fiber-recycling": true,
   "lithium-recycling": true,
   "lithium-plate-recycling": true,
   "superconductor-recycling": true,
   "space-platform-hub-recycling": true,
   "yumako-recycling": true,
   "yumako-mash-recycling": true,
   "bioflux-recycling": true
  },
  "quality": [
   "quality-unknown",
   "normal",
   "uncommon",
   "rare",
   "epic",
   "legendary"
  ],
  "elevatedRails": [
   "dummy-elevated-straight-rail",
   "elevated-straight-rail"
  ]
 },
 "qualityModules": {
  "quality-module": {
   "quality": 0.01,
   "speedPenalty": 0.05
  },
  "quality-module-2": {
   "quality": 0.02,
   "speedPenalty": 0.05
  },
  "quality-module-3": {
   "quality": 0.025,
   "speedPenalty": 0.05
  }
 },
 "qualityTiers": [
  {
   "id": "normal",
   "level": 0,
   "color": [
    0,
    0,
    0
   ]
  },
  {
   "id": "uncommon",
   "level": 1,
   "color": [
    43,
    165,
    61
   ]
  },
  {
   "id": "rare",
   "level": 2,
   "color": [
    25,
    104,
    178
   ]
  },
  {
   "id": "epic",
   "level": 3,
   "color": [
    137,
    0,
    178
   ]
  },
  {
   "id": "legendary",
   "level": 5,
   "color": [
    178,
    104,
    0
   ]
  }
 ],
 "itemGroup": {
  "iron-ore": "intermediate-products",
  "copper-ore": "intermediate-products",
  "coal": "intermediate-products",
  "solid-fuel": "intermediate-products",
  "stone": "intermediate-products",
  "stone-brick": "logistics",
  "calcite": "intermediate-products",
  "iron-plate": "intermediate-products",
  "copper-plate": "intermediate-products",
  "iron-gear-wheel": "intermediate-products",
  "iron-stick": "intermediate-products",
  "copper-cable": "intermediate-products",
  "electronic-circuit": "intermediate-products",
  "automation-science-pack": "intermediate-products",
  "transport-belt": "logistics",
  "inserter": "logistics",
  "burner-inserter": "logistics",
  "long-handed-inserter": "logistics",
  "burner-mining-drill": "production",
  "stone-furnace": "production",
  "assembling-machine-1": "production",
  "lab": "production",
  "biolab": "production",
  "small-lamp": "logistics",
  "substation": "logistics",
  "programmable-speaker": "logistics",
  "splitter": "logistics",
  "underground-belt": "logistics",
  "steel-plate": "intermediate-products",
  "boiler": "production",
  "steam-engine": "production",
  "offshore-pump": "production",
  "electric-mining-drill": "production",
  "big-mining-drill": "production",
  "electric-furnace": "production",
  "assembling-machine-2": "production",
  "fast-transport-belt": "logistics",
  "fast-underground-belt": "logistics",
  "express-transport-belt": "logistics",
  "express-underground-belt": "logistics",
  "express-splitter": "logistics",
  "turbo-transport-belt": "logistics",
  "turbo-underground-belt": "logistics",
  "turbo-splitter": "logistics",
  "loader": "logistics",
  "fast-loader": "logistics",
  "express-loader": "logistics",
  "turbo-loader": "logistics",
  "fast-splitter": "logistics",
  "bulk-inserter": "logistics",
  "stack-inserter": "logistics",
  "fast-inserter": "logistics",
  "steel-chest": "logistics",
  "creative-chest": "logistics",
  "void-chest": "logistics",
  "logistic-science-pack": "intermediate-products",
  "chemical-science-pack": "intermediate-products",
  "plastic-bar": "intermediate-products",
  "pipe": "logistics",
  "pipe-to-ground": "logistics",
  "pump": "logistics",
  "storage-tank": "logistics",
  "creative-pipe": "logistics",
  "void-pipe": "logistics",
  "creative-belt": "logistics",
  "void-belt": "logistics",
  "pumpjack": "production",
  "solar-panel": "production",
  "accumulator": "production",
  "steel-furnace": "production",
  "assembling-machine-3": "production",
  "military-science-pack": "intermediate-products",
  "gun-turret": "combat",
  "stone-wall": "combat",
  "gate": "combat",
  "firearm-magazine": "combat",
  "piercing-rounds-magazine": "combat",
  "oil-refinery": "production",
  "chemical-plant": "production",
  "pistol": "combat",
  "submachine-gun": "combat",
  "shotgun": "combat",
  "combat-shotgun": "combat",
  "shotgun-shell": "combat",
  "piercing-shotgun-shell": "combat",
  "cluster-grenade": "combat",
  "rocket-launcher": "combat",
  "grenade": "combat",
  "rocket": "combat",
  "explosive-rocket": "combat",
  "flamethrower": "combat",
  "flamethrower-ammo": "combat",
  "uranium-rounds-magazine": "combat",
  "atomic-bomb": "combat",
  "uranium-cannon-shell": "combat",
  "poison-capsule": "combat",
  "slowdown-capsule": "combat",
  "laser-turret": "combat",
  "flamethrower-turret": "combat",
  "speed-module": "production",
  "speed-module-2": "production",
  "speed-module-3": "production",
  "productivity-module": "production",
  "productivity-module-2": "production",
  "productivity-module-3": "production",
  "beacon": "production",
  "efficiency-module": "production",
  "efficiency-module-2": "production",
  "efficiency-module-3": "production",
  "quality-module": "production",
  "quality-module-2": "production",
  "quality-module-3": "production",
  "advanced-circuit": "intermediate-products",
  "engine-unit": "intermediate-products",
  "electric-engine-unit": "intermediate-products",
  "processing-unit": "intermediate-products",
  "low-density-structure": "intermediate-products",
  "rocket-fuel": "intermediate-products",
  "rocket-part": "space",
  "rocket-body": "space",
  "satellite": "space",
  "rocket-silo": "space",
  "cargo-landing-pad": "space",
  "cargo-bay": "space",
  "landing-pad-unloading-bay": "space",
  "radar": "combat",
  "explosives": "intermediate-products",
  "cliff-explosives": "logistics",
  "battery": "intermediate-products",
  "flying-robot-frame": "intermediate-products",
  "production-science-pack": "intermediate-products",
  "utility-science-pack": "intermediate-products",
  "defender-capsule": "combat",
  "distractor-capsule": "combat",
  "destroyer-capsule": "combat",
  "car": "logistics",
  "tank": "logistics",
  "cannon-shell": "combat",
  "explosive-cannon-shell": "combat",
  "explosive-uranium-cannon-shell": "combat",
  "light-armor": "combat",
  "heavy-armor": "combat",
  "spidertron": "logistics",
  "spidertron-remote": "logistics",
  "land-mine": "combat",
  "artillery-turret": "combat",
  "artillery-shell": "combat",
  "rail": "logistics",
  "locomotive": "logistics",
  "cargo-wagon": "logistics",
  "fluid-wagon": "logistics",
  "artillery-wagon": "logistics",
  "train-stop": "logistics",
  "rail-signal": "logistics",
  "rail-chain-signal": "logistics",
  "rail-support": "logistics",
  "rail-ramp": "logistics",
  "lubricant": "intermediate-products",
  "sulfur": "intermediate-products",
  "sulfuric-acid": "intermediate-products",
  "carbon": "intermediate-products",
  "thruster-fuel": "space",
  "thruster-oxidizer": "space",
  "carbon-fiber": "intermediate-products",
  "lithium": "intermediate-products",
  "lithium-plate": "intermediate-products",
  "superconductor": "intermediate-products",
  "electromagnetic-science-pack": "intermediate-products",
  "electromagnetic-plant": "production",
  "recycler": "production",
  "holmium-ore": "intermediate-products",
  "holmium-solution": "intermediate-products",
  "holmium-plate": "intermediate-products",
  "electrolyte": "intermediate-products",
  "teslagun": "combat",
  "supercapacitor": "intermediate-products",
  "tesla-turret": "combat",
  "tesla-ammo": "combat",
  "rocket-turret": "combat",
  "railgun-turret": "combat",
  "railgun-ammo": "combat",
  "tungsten-ore": "intermediate-products",
  "tungsten-plate": "intermediate-products",
  "tungsten-carbide": "intermediate-products",
  "metallurgic-science-pack": "intermediate-products",
  "foundry": "production",
  "yumako": "intermediate-products",
  "yumako-seed": "intermediate-products",
  "yumako-mash": "intermediate-products",
  "bioflux": "intermediate-products",
  "nutrients": "intermediate-products",
  "spoilage": "intermediate-products",
  "agricultural-science-pack": "intermediate-products",
  "biochamber": "production",
  "agricultural-tower": "production",
  "artificial-yumako-soil": "logistics",
  "overgrowth-yumako-soil": "logistics",
  "artificial-jellynut-soil": "logistics",
  "overgrowth-jellynut-soil": "logistics",
  "jellynut": "intermediate-products",
  "jellynut-seed": "intermediate-products",
  "jelly": "intermediate-products",
  "biter-egg": "intermediate-products",
  "pentapod-egg": "intermediate-products",
  "tree-seed": "intermediate-products",
  "captive-biter-spawner": "production",
  "capture-robot-rocket": "combat",
  "iron-bacteria": "intermediate-products",
  "copper-bacteria": "intermediate-products",
  "crusher": "space",
  "metallic-asteroid-chunk": "space",
  "carbonic-asteroid-chunk": "space",
  "oxide-asteroid-chunk": "space",
  "promethium-asteroid-chunk": "space",
  "ice": "intermediate-products",
  "space-platform-foundation": "space",
  "space-platform-hub": "production",
  "thruster": "space",
  "asteroid-collector": "space",
  "space-platform-starter-pack": "space",
  "roboport": "logistics",
  "logistic-robot": "logistics",
  "construction-robot": "logistics",
  "personal-roboport-equipment": "combat",
  "personal-roboport-mk2-equipment": "combat",
  "passive-provider-chest": "logistics",
  "active-provider-chest": "logistics",
  "storage-chest": "logistics",
  "buffer-chest": "logistics",
  "requester-chest": "logistics",
  "raw-fish": "intermediate-products",
  "uranium-ore": "intermediate-products",
  "uranium-235": "intermediate-products",
  "uranium-238": "intermediate-products",
  "nuclear-fuel": "intermediate-products",
  "uranium-fuel-cell": "intermediate-products",
  "depleted-uranium-fuel-cell": "intermediate-products",
  "centrifuge": "production",
  "nuclear-reactor": "production",
  "steam-turbine": "production",
  "heat-pipe": "production",
  "heat-exchanger": "production",
  "heating-tower": "production",
  "fusion-reactor": "production",
  "fusion-generator": "production",
  "fusion-power-cell": "intermediate-products",
  "lightning-rod": "production",
  "lightning-collector": "production",
  "small-electric-pole": "logistics",
  "medium-electric-pole": "logistics",
  "big-electric-pole": "logistics",
  "constant-combinator": "logistics",
  "arithmetic-combinator": "logistics",
  "decider-combinator": "logistics",
  "selector-combinator": "logistics",
  "display-panel": "logistics",
  "power-switch": "logistics",
  "red-wire": "logistics",
  "green-wire": "logistics",
  "concrete": "logistics",
  "refined-concrete": "logistics",
  "hazard-concrete": "logistics",
  "refined-hazard-concrete": "logistics",
  "stone-path": "logistics",
  "landfill": "logistics",
  "foundation": "logistics",
  "ice-platform": "logistics",
  "modular-armor": "combat",
  "power-armor": "combat",
  "power-armor-mk2": "combat",
  "solar-panel-equipment": "combat",
  "fusion-reactor-equipment": "combat",
  "battery-equipment": "combat",
  "battery-mk2-equipment": "combat",
  "exoskeleton-equipment": "combat",
  "night-vision-equipment": "combat",
  "personal-laser-defense-equipment": "combat",
  "energy-shield-equipment": "combat",
  "energy-shield-mk2-equipment": "combat",
  "belt-immunity-equipment": "combat",
  "discharge-defense-equipment": "combat",
  "wood": "intermediate-products",
  "wooden-chest": "logistics",
  "iron-chest": "logistics",
  "repair-pack": "production",
  "deconstruction-planner": "production",
  "upgrade-planner": "production",
  "space-science-pack": "intermediate-products",
  "promethium-science-pack": "intermediate-products",
  "cryogenic-plant": "production",
  "cryogenic-science-pack": "intermediate-products",
  "quantum-processor": "intermediate-products",
  "scrap": "intermediate-products",
  "battery-mk3-equipment": "combat",
  "fission-reactor-equipment": "combat",
  "toolbelt-equipment": "combat",
  "mech-armor": "combat",
  "railgun": "combat",
  "barrel": "intermediate-products",
  "water-barrel": "intermediate-products",
  "crude-oil-barrel": "intermediate-products",
  "heavy-oil-barrel": "intermediate-products",
  "light-oil-barrel": "intermediate-products",
  "petroleum-gas-barrel": "intermediate-products",
  "lubricant-barrel": "intermediate-products",
  "sulfuric-acid-barrel": "intermediate-products",
  "fluoroketone-cold-barrel": "intermediate-products",
  "fluoroketone-hot-barrel": "intermediate-products"
 },
 "itemSubgroup": {
  "iron-ore": "raw-resource",
  "copper-ore": "raw-resource",
  "coal": "raw-resource",
  "solid-fuel": "raw-material",
  "stone": "raw-resource",
  "stone-brick": "terrain",
  "calcite": "vulcanus-processes",
  "iron-plate": "raw-material",
  "copper-plate": "raw-material",
  "iron-gear-wheel": "intermediate-product",
  "iron-stick": "intermediate-product",
  "copper-cable": "intermediate-product",
  "electronic-circuit": "intermediate-product",
  "automation-science-pack": "science-pack",
  "transport-belt": "belt",
  "inserter": "inserter",
  "burner-inserter": "inserter",
  "long-handed-inserter": "inserter",
  "burner-mining-drill": "extraction-machine",
  "stone-furnace": "smelting-machine",
  "assembling-machine-1": "production-machine",
  "lab": "production-machine",
  "biolab": "production-machine",
  "small-lamp": "circuit-network",
  "substation": "energy-pipe-distribution",
  "programmable-speaker": "circuit-network",
  "splitter": "belt",
  "underground-belt": "belt",
  "steel-plate": "raw-material",
  "boiler": "energy",
  "steam-engine": "energy",
  "offshore-pump": "extraction-machine",
  "electric-mining-drill": "extraction-machine",
  "big-mining-drill": "extraction-machine",
  "electric-furnace": "smelting-machine",
  "assembling-machine-2": "production-machine",
  "fast-transport-belt": "belt",
  "fast-underground-belt": "belt",
  "express-transport-belt": "belt",
  "express-underground-belt": "belt",
  "express-splitter": "belt",
  "turbo-transport-belt": "belt",
  "turbo-underground-belt": "belt",
  "turbo-splitter": "belt",
  "loader": "belt",
  "fast-loader": "belt",
  "express-loader": "belt",
  "turbo-loader": "belt",
  "fast-splitter": "belt",
  "bulk-inserter": "inserter",
  "stack-inserter": "inserter",
  "fast-inserter": "inserter",
  "steel-chest": "storage",
  "logistic-science-pack": "science-pack",
  "chemical-science-pack": "science-pack",
  "plastic-bar": "raw-material",
  "pipe": "energy-pipe-distribution",
  "pipe-to-ground": "energy-pipe-distribution",
  "pump": "energy-pipe-distribution",
  "storage-tank": "storage",
  "pumpjack": "extraction-machine",
  "solar-panel": "energy",
  "accumulator": "energy",
  "steel-furnace": "smelting-machine",
  "assembling-machine-3": "production-machine",
  "military-science-pack": "science-pack",
  "gun-turret": "turret",
  "stone-wall": "defensive-structure",
  "gate": "defensive-structure",
  "firearm-magazine": "ammo",
  "piercing-rounds-magazine": "ammo",
  "oil-refinery": "production-machine",
  "chemical-plant": "production-machine",
  "pistol": "gun",
  "submachine-gun": "gun",
  "shotgun": "gun",
  "combat-shotgun": "gun",
  "shotgun-shell": "ammo",
  "piercing-shotgun-shell": "ammo",
  "cluster-grenade": "capsule",
  "rocket-launcher": "gun",
  "grenade": "capsule",
  "rocket": "ammo",
  "explosive-rocket": "ammo",
  "flamethrower": "gun",
  "flamethrower-ammo": "ammo",
  "uranium-rounds-magazine": "ammo",
  "atomic-bomb": "ammo",
  "uranium-cannon-shell": "ammo",
  "poison-capsule": "capsule",
  "slowdown-capsule": "capsule",
  "laser-turret": "turret",
  "flamethrower-turret": "turret",
  "speed-module": "module",
  "speed-module-2": "module",
  "speed-module-3": "module",
  "productivity-module": "module",
  "productivity-module-2": "module",
  "productivity-module-3": "module",
  "beacon": "module",
  "efficiency-module": "module",
  "efficiency-module-2": "module",
  "efficiency-module-3": "module",
  "quality-module": "module",
  "quality-module-2": "module",
  "quality-module-3": "module",
  "advanced-circuit": "intermediate-product",
  "engine-unit": "intermediate-product",
  "electric-engine-unit": "intermediate-product",
  "processing-unit": "intermediate-product",
  "low-density-structure": "intermediate-product",
  "rocket-fuel": "intermediate-product",
  "rocket-part": "space-interactors",
  "rocket-silo": "space-interactors",
  "cargo-landing-pad": "space-interactors",
  "cargo-bay": "space-platform",
  "landing-pad-unloading-bay": "space-platform",
  "radar": "defensive-structure",
  "explosives": "raw-material",
  "cliff-explosives": "terrain",
  "battery": "raw-material",
  "flying-robot-frame": "intermediate-product",
  "production-science-pack": "science-pack",
  "utility-science-pack": "science-pack",
  "defender-capsule": "capsule",
  "distractor-capsule": "capsule",
  "destroyer-capsule": "capsule",
  "car": "transport",
  "tank": "transport",
  "cannon-shell": "ammo",
  "explosive-cannon-shell": "ammo",
  "explosive-uranium-cannon-shell": "ammo",
  "light-armor": "armor",
  "heavy-armor": "armor",
  "spidertron": "transport",
  "land-mine": "defensive-structure",
  "artillery-turret": "turret",
  "artillery-shell": "ammo",
  "rail": "train-transport",
  "locomotive": "train-transport",
  "cargo-wagon": "train-transport",
  "fluid-wagon": "train-transport",
  "artillery-wagon": "train-transport",
  "train-stop": "train-transport",
  "rail-signal": "train-transport",
  "rail-chain-signal": "train-transport",
  "rail-support": "train-transport",
  "rail-ramp": "train-transport",
  "lubricant": "fluid-recipes",
  "sulfur": "raw-material",
  "sulfuric-acid": "fluid-recipes",
  "carbon": "raw-material",
  "thruster-fuel": "space-processing",
  "thruster-oxidizer": "space-processing",
  "carbon-fiber": "agriculture-products",
  "lithium": "aquilo-processes",
  "lithium-plate": "aquilo-processes",
  "superconductor": "fulgora-processes",
  "electromagnetic-science-pack": "science-pack",
  "electromagnetic-plant": "production-machine",
  "recycler": "smelting-machine",
  "holmium-ore": "fulgora-processes",
  "holmium-solution": "fulgora-processes",
  "holmium-plate": "fulgora-processes",
  "electrolyte": "fulgora-processes",
  "teslagun": "gun",
  "supercapacitor": "fulgora-processes",
  "tesla-turret": "turret",
  "tesla-ammo": "ammo",
  "rocket-turret": "turret",
  "railgun-turret": "turret",
  "railgun-ammo": "ammo",
  "tungsten-ore": "vulcanus-processes",
  "tungsten-plate": "vulcanus-processes",
  "tungsten-carbide": "vulcanus-processes",
  "metallurgic-science-pack": "science-pack",
  "foundry": "smelting-machine",
  "yumako": "agriculture-processes",
  "yumako-seed": "agriculture-processes",
  "yumako-mash": "agriculture-products",
  "bioflux": "agriculture-products",
  "nutrients": "agriculture-processes",
  "spoilage": "agriculture-processes",
  "agricultural-science-pack": "science-pack",
  "biochamber": "agriculture",
  "agricultural-tower": "agriculture",
  "artificial-yumako-soil": "terrain",
  "overgrowth-yumako-soil": "terrain",
  "artificial-jellynut-soil": "terrain",
  "overgrowth-jellynut-soil": "terrain",
  "jellynut": "agriculture-processes",
  "jellynut-seed": "agriculture-processes",
  "jelly": "agriculture-products",
  "biter-egg": "agriculture-products",
  "pentapod-egg": "agriculture-products",
  "tree-seed": "nauvis-agriculture",
  "captive-biter-spawner": "agriculture",
  "capture-robot-rocket": "ammo",
  "iron-bacteria": "agriculture-processes",
  "copper-bacteria": "agriculture-processes",
  "crusher": "space-platform",
  "metallic-asteroid-chunk": "space-material",
  "carbonic-asteroid-chunk": "space-material",
  "oxide-asteroid-chunk": "space-material",
  "promethium-asteroid-chunk": "space-material",
  "ice": "raw-resource",
  "space-platform-foundation": "space-platform",
  "space-platform-hub": "space-related",
  "thruster": "space-platform",
  "asteroid-collector": "space-platform",
  "space-platform-starter-pack": "space-rocket",
  "roboport": "logistic-network",
  "logistic-robot": "logistic-network",
  "construction-robot": "logistic-network",
  "personal-roboport-equipment": "utility-equipment",
  "personal-roboport-mk2-equipment": "utility-equipment",
  "passive-provider-chest": "logistic-network",
  "active-provider-chest": "logistic-network",
  "storage-chest": "logistic-network",
  "buffer-chest": "logistic-network",
  "requester-chest": "logistic-network",
  "raw-fish": "raw-resource",
  "uranium-ore": "raw-resource",
  "uranium-235": "uranium-processing",
  "uranium-238": "uranium-processing",
  "nuclear-fuel": "uranium-processing",
  "uranium-fuel-cell": "uranium-processing",
  "depleted-uranium-fuel-cell": "uranium-processing",
  "centrifuge": "production-machine",
  "nuclear-reactor": "energy",
  "steam-turbine": "energy",
  "heat-pipe": "energy",
  "heat-exchanger": "energy",
  "heating-tower": "environmental-protection",
  "fusion-reactor": "energy",
  "fusion-generator": "energy",
  "fusion-power-cell": "aquilo-processes",
  "lightning-rod": "environmental-protection",
  "lightning-collector": "environmental-protection",
  "small-electric-pole": "energy-pipe-distribution",
  "medium-electric-pole": "energy-pipe-distribution",
  "big-electric-pole": "energy-pipe-distribution",
  "constant-combinator": "circuit-network",
  "arithmetic-combinator": "circuit-network",
  "decider-combinator": "circuit-network",
  "selector-combinator": "circuit-network",
  "display-panel": "circuit-network",
  "power-switch": "circuit-network",
  "concrete": "terrain",
  "refined-concrete": "terrain",
  "hazard-concrete": "terrain",
  "refined-hazard-concrete": "terrain",
  "landfill": "terrain",
  "foundation": "terrain",
  "ice-platform": "terrain",
  "modular-armor": "armor",
  "power-armor": "armor",
  "power-armor-mk2": "armor",
  "solar-panel-equipment": "equipment",
  "fusion-reactor-equipment": "equipment",
  "battery-equipment": "equipment",
  "battery-mk2-equipment": "equipment",
  "exoskeleton-equipment": "utility-equipment",
  "night-vision-equipment": "utility-equipment",
  "personal-laser-defense-equipment": "military-equipment",
  "energy-shield-equipment": "military-equipment",
  "energy-shield-mk2-equipment": "military-equipment",
  "belt-immunity-equipment": "utility-equipment",
  "discharge-defense-equipment": "military-equipment",
  "wood": "raw-resource",
  "wooden-chest": "storage",
  "iron-chest": "storage",
  "repair-pack": "tool",
  "deconstruction-planner": "tool",
  "upgrade-planner": "tool",
  "space-science-pack": "science-pack",
  "promethium-science-pack": "science-pack",
  "cryogenic-plant": "production-machine",
  "cryogenic-science-pack": "science-pack",
  "quantum-processor": "aquilo-processes",
  "scrap": "fulgora-processes",
  "battery-mk3-equipment": "equipment",
  "fission-reactor-equipment": "equipment",
  "toolbelt-equipment": "utility-equipment",
  "mech-armor": "armor",
  "railgun": "gun",
  "barrel": "intermediate-product",
  "water-barrel": "barrel",
  "crude-oil-barrel": "barrel",
  "heavy-oil-barrel": "barrel",
  "light-oil-barrel": "barrel",
  "petroleum-gas-barrel": "barrel",
  "lubricant-barrel": "barrel",
  "sulfuric-acid-barrel": "barrel",
  "fluoroketone-cold-barrel": "barrel",
  "fluoroketone-hot-barrel": "barrel"
 },
 "subgroupOrder": {
  "storage": "a",
  "belt": "b",
  "inserter": "c",
  "energy-pipe-distribution": "d",
  "train-transport": "e",
  "transport": "f",
  "logistic-network": "g",
  "circuit-network": "h",
  "terrain": "i",
  "tool": "a",
  "energy": "b",
  "extraction-machine": "c",
  "smelting-machine": "d",
  "production-machine": "e",
  "module": "g",
  "space-related": "e",
  "fluid-recipes": "a",
  "raw-resource": "b",
  "raw-material": "c",
  "barrel": "d",
  "fill-barrel": "e",
  "empty-barrel": "f",
  "intermediate-product": "g",
  "intermediate-recipe": "h",
  "uranium-processing": "i",
  "science-pack": "y",
  "internal-process": "z",
  "gun": "a",
  "ammo": "b",
  "capsule": "c",
  "armor": "d",
  "equipment": "e",
  "utility-equipment": "f",
  "military-equipment": "g",
  "defensive-structure": "h",
  "turret": "i",
  "ammo-category": "j",
  "fluid": "a",
  "virtual-signal-special": "a",
  "virtual-signal-number": "b",
  "virtual-signal-letter": "c",
  "virtual-signal-punctuation": "cb",
  "virtual-signal-math": "cd",
  "virtual-signal-color": "d",
  "virtual-signal": "e",
  "shapes": "f",
  "arrows": "g",
  "arrows-misc": "h",
  "pictographs": "i",
  "bullets": "j",
  "enemies": "a",
  "creatures": "a",
  "cliffs": "a",
  "trees": "aa",
  "grass": "b",
  "mineable-fluids": "ba",
  "obstacles": "bb",
  "corpses": "c",
  "remnants": "dz",
  "storage-remnants": "da",
  "belt-remnants": "db",
  "inserter-remnants": "dc",
  "energy-pipe-distribution-remnants": "dd",
  "train-transport-remnants": "de",
  "transport-remnants": "df",
  "logistic-network-remnants": "dg",
  "circuit-network-remnants": "dh",
  "energy-remnants": "di",
  "extraction-machine-remnants": "di",
  "smelting-machine-remnants": "dj",
  "production-machine-remnants": "dk",
  "defensive-structure-remnants": "dl",
  "generic-remnants": "dl",
  "scorchmarks": "dm",
  "wrecks": "e",
  "artificial-tiles": "a",
  "nauvis-tiles": "b",
  "vulcanus-tiles": "c",
  "gleba-water-tiles": "d-a",
  "gleba-tiles": "d-b",
  "fulgora-tiles": "e",
  "aquilo-tiles": "f",
  "special-tiles": "g",
  "storage-explosions": "aa",
  "belt-explosions": "ab",
  "inserter-explosions": "ac",
  "energy-pipe-distribution-explosions": "ad",
  "train-transport-explosions": "ae",
  "transport-explosions": "af",
  "logistic-network-explosions": "ag",
  "circuit-network-explosions": "ah",
  "energy-explosions": "ba",
  "extraction-machine-explosions": "bb",
  "smelting-machine-explosions": "bc",
  "production-machine-explosions": "bd",
  "module-explosions": "be",
  "campaign-explosions": "bf",
  "gun-explosions": "ca",
  "defensive-structure-explosions": "cb",
  "capsule-explosions": "cc",
  "tree-explosions": "cd",
  "rock-explosions": "da",
  "ground-explosions": "db",
  "decorative-explosions": "dc",
  "enemy-death-explosions": "de",
  "fluid-explosions": "df",
  "explosions": "dg",
  "hit-effects": "e",
  "particles": "e",
  "parameters": "a",
  "qualities": "b",
  "spawnables": "c",
  "other": "d",
  "vulcanus-processes": "k",
  "fulgora-processes": "l",
  "agriculture-processes": "m",
  "agriculture-products": "n",
  "nauvis-agriculture": "o",
  "aquilo-processes": "p",
  "agriculture": "da",
  "environmental-protection": "f",
  "space-interactors": "a",
  "space-platform": "a",
  "space-rocket": "b",
  "space-environment": "f",
  "space-material": "g",
  "space-crushing": "h",
  "space-processing": "i",
  "planets": "j",
  "planet-connections": "k",
  "agriculture-remnants": "dja",
  "environmental-protection-remnants": "dkb",
  "space-platform-remnants": "eb",
  "agriculture-explosions": "bca",
  "environmental-protection-explosions": "bdb",
  "space-platform-explosions": "c"
 },
 "itemOrder": {
  "iron-ore": "e[iron-ore]",
  "copper-ore": "f[copper-ore]",
  "coal": "b[coal]",
  "solid-fuel": "b[chemistry]-a[solid-fuel]",
  "stone": "d[stone]",
  "stone-brick": "a[stone-brick]",
  "calcite": "a[melting]-a[calcite]",
  "iron-plate": "a[smelting]-a[iron-plate]",
  "copper-plate": "a[smelting]-b[copper-plate]",
  "iron-gear-wheel": "a[basic-intermediates]-a[iron-gear-wheel]",
  "iron-stick": "a[basic-intermediates]-b[iron-stick]",
  "copper-cable": "a[basic-intermediates]-c[copper-cable]",
  "electronic-circuit": "b[circuits]-a[electronic-circuit]",
  "automation-science-pack": "a[automation-science-pack]",
  "transport-belt": "a[transport-belt]-a[transport-belt]",
  "inserter": "b[inserter]",
  "burner-inserter": "a[burner-inserter]",
  "long-handed-inserter": "c[long-handed-inserter]",
  "burner-mining-drill": "a[items]-a[burner-mining-drill]",
  "stone-furnace": "a[stone-furnace]",
  "assembling-machine-1": "a[assembling-machine-1]",
  "lab": "z[lab]",
  "biolab": "z[z-biolab]",
  "small-lamp": "a[light]-a[small-lamp]",
  "substation": "a[energy]-d[substation]",
  "programmable-speaker": "d[other]-b[programmable-speaker]",
  "splitter": "c[splitter]-a[splitter]",
  "underground-belt": "b[underground-belt]-a[underground-belt]",
  "steel-plate": "a[smelting]-c[steel-plate]",
  "boiler": "b[steam-power]-a[boiler]",
  "steam-engine": "b[steam-power]-b[steam-engine]",
  "offshore-pump": "b[fluids]-a[offshore-pump]",
  "electric-mining-drill": "a[items]-b[electric-mining-drill]",
  "big-mining-drill": "a[items]-c[big-mining-drill]",
  "electric-furnace": "c[electric-furnace]",
  "assembling-machine-2": "b[assembling-machine-2]",
  "fast-transport-belt": "a[transport-belt]-b[fast-transport-belt]",
  "fast-underground-belt": "b[underground-belt]-b[fast-underground-belt]",
  "express-transport-belt": "a[transport-belt]-c[express-transport-belt]",
  "express-underground-belt": "b[underground-belt]-c[express-underground-belt]",
  "express-splitter": "c[splitter]-c[express-splitter]",
  "turbo-transport-belt": "a[transport-belt]-d[turbo-transport-belt]",
  "turbo-underground-belt": "b[underground-belt]-d[turbo-underground-belt]",
  "turbo-splitter": "c[splitter]-d[turbo-splitter]",
  "loader": "d[loader]-a[basic-loader]",
  "fast-loader": "d[loader]-b[fast-loader]",
  "express-loader": "d[loader]-c[express-loader]",
  "turbo-loader": "d[loader]-d[turbo-loader]",
  "fast-splitter": "c[splitter]-b[fast-splitter]",
  "bulk-inserter": "f[bulk-inserter]",
  "stack-inserter": "h[stack-inserter]",
  "fast-inserter": "d[fast-inserter]",
  "steel-chest": "a[items]-c[steel-chest]",
  "logistic-science-pack": "b[logistic-science-pack]",
  "chemical-science-pack": "d[chemical-science-pack]",
  "plastic-bar": "b[chemistry]-b[plastic-bar]",
  "pipe": "a[pipe]-a[pipe]",
  "pipe-to-ground": "a[pipe]-b[pipe-to-ground]",
  "pump": "b[pipe]-c[pump]",
  "storage-tank": "b[fluid]-a[storage-tank]",
  "pumpjack": "b[fluids]-b[pumpjack]",
  "solar-panel": "d[solar-panel]-a[solar-panel]",
  "accumulator": "e[accumulator]-a[accumulator]",
  "steel-furnace": "b[steel-furnace]",
  "assembling-machine-3": "c[assembling-machine-3]",
  "military-science-pack": "c[military-science-pack]",
  "gun-turret": "b[turret]-a[gun-turret]",
  "stone-wall": "a[stone-wall]-a[stone-wall]",
  "gate": "a[wall]-b[gate]",
  "firearm-magazine": "a[basic-clips]-a[firearm-magazine]",
  "piercing-rounds-magazine": "a[basic-clips]-b[piercing-rounds-magazine]",
  "oil-refinery": "d[refinery]",
  "chemical-plant": "e[chemical-plant]",
  "pistol": "a[basic-clips]-a[pistol]",
  "submachine-gun": "a[basic-clips]-b[submachine-gun]",
  "shotgun": "b[shotgun]-a[basic]",
  "combat-shotgun": "b[shotgun]-a[combat]",
  "shotgun-shell": "b[shotgun]-a[basic]",
  "piercing-shotgun-shell": "b[shotgun]-b[piercing]",
  "cluster-grenade": "a[grenade]-b[cluster]",
  "rocket-launcher": "d[rocket-launcher]",
  "grenade": "a[grenade]-a[normal]",
  "rocket": "d[rocket-launcher]-a[basic]",
  "explosive-rocket": "d[rocket-launcher]-b[explosive]",
  "flamethrower": "e[flamethrower]",
  "flamethrower-ammo": "e[flamethrower]",
  "uranium-rounds-magazine": "a[basic-clips]-c[uranium-rounds-magazine]",
  "atomic-bomb": "d[rocket-launcher]-d[atomic-bomb]",
  "uranium-cannon-shell": "d[cannon-shell]-c[uranium]",
  "poison-capsule": "b[poison-capsule]",
  "slowdown-capsule": "c[slowdown-capsule]",
  "laser-turret": "b[turret]-b[laser-turret]",
  "flamethrower-turret": "b[turret]-c[flamethrower-turret]",
  "speed-module": "a[speed]-a[speed-module-1]",
  "speed-module-2": "a[speed]-b[speed-module-2]",
  "speed-module-3": "a[speed]-c[speed-module-3]",
  "productivity-module": "c[productivity]-a[productivity-module-1]",
  "productivity-module-2": "c[productivity]-b[productivity-module-2]",
  "productivity-module-3": "c[productivity]-c[productivity-module-3]",
  "beacon": "a[beacon]",
  "efficiency-module": "c[efficiency]-a[efficiency-module-1]",
  "efficiency-module-2": "c[efficiency]-b[efficiency-module-2]",
  "efficiency-module-3": "c[efficiency]-c[efficiency-module-3]",
  "quality-module": "d[quality]-a[quality-module-1]",
  "quality-module-2": "d[quality]-b[quality-module-2]",
  "quality-module-3": "d[quality]-c[quality-module-3]",
  "advanced-circuit": "b[circuits]-b[advanced-circuit]",
  "engine-unit": "c[advanced-intermediates]-a[engine-unit]",
  "electric-engine-unit": "c[advanced-intermediates]-b[electric-engine-unit]",
  "processing-unit": "b[circuits]-c[processing-unit]",
  "low-density-structure": "d[rocket-parts]-a[low-density-structure]",
  "rocket-fuel": "d[rocket-parts]-b[rocket-fuel]",
  "rocket-part": "b[rocket-part]",
  "rocket-silo": "a[rocket-silo]",
  "cargo-landing-pad": "c[cargo-landing-pad]",
  "cargo-bay": "c[cargo-bay]",
  "landing-pad-unloading-bay": "c[landing-pad-unloading-bay]",
  "radar": "d[radar]-a[radar]",
  "explosives": "b[chemistry]-e[explosives]",
  "cliff-explosives": "d[cliff-explosives]",
  "battery": "b[chemistry]-d[battery]",
  "flying-robot-frame": "c[advanced-intermediates]-c[flying-robot-frame]",
  "production-science-pack": "e[production-science-pack]",
  "utility-science-pack": "f[utility-science-pack]",
  "defender-capsule": "d[defender]-b[capsule]",
  "distractor-capsule": "e[distractor]-b[capsule]",
  "destroyer-capsule": "f[destroyer]-b[capsule]",
  "car": "b[personal-transport]-a[car]",
  "tank": "b[personal-transport]-b[tank]",
  "cannon-shell": "d[cannon-shell]-a[basic]",
  "explosive-cannon-shell": "d[cannon-shell]-c[explosive]",
  "explosive-uranium-cannon-shell": "d[explosive-cannon-shell]-c[uranium]",
  "light-armor": "a[light-armor]",
  "heavy-armor": "b[heavy-armor]",
  "spidertron": "b[personal-transport]-c[spidertron]-a[spider]",
  "land-mine": "f[land-mine]",
  "artillery-turret": "b[turret]-d[artillery-turret]-a[turret]",
  "artillery-shell": "d[explosive-cannon-shell]-d[artillery]",
  "rail": "a[rail]-a[rail]",
  "locomotive": "c[rolling-stock]-a[locomotive]",
  "cargo-wagon": "c[rolling-stock]-b[cargo-wagon]",
  "fluid-wagon": "c[rolling-stock]-c[fluid-wagon]",
  "artillery-wagon": "c[rolling-stock]-d[artillery-wagon]",
  "train-stop": "b[train-automation]-a[train-stop]",
  "rail-signal": "b[train-automation]-b[rail-signal]",
  "rail-chain-signal": "b[train-automation]-c[rail-chain-signal]",
  "rail-support": "a[rail]-c[rail-support]",
  "rail-ramp": "a[rail]-b[rail-ramp]",
  "lubricant": "c[oil-products]-a[lubricant]",
  "sulfur": "b[chemistry]-c[sulfur]",
  "sulfuric-acid": "c[oil-products]-b[sulfuric-acid]",
  "carbon": "b[chemistry]-f[carbon]",
  "thruster-fuel": "a[thruster-fuel]",
  "thruster-oxidizer": "c[thruster-oxidizer]",
  "carbon-fiber": "a[organic-products]-e[carbon-fiber]",
  "lithium": "c[lithium]-a[lithium]",
  "lithium-plate": "c[lithium]-b[lithium-plate]",
  "superconductor": "b[holmium]-d[superconductor]",
  "electromagnetic-science-pack": "j",
  "electromagnetic-plant": "g[electromagnetic-plant]",
  "recycler": "d[recycler]",
  "holmium-ore": "b[holmium]-a[holmium-ore]",
  "holmium-solution": "b[holmium]-b[holmium-solution]",
  "holmium-plate": "b[holmium]-c[holmium-plate]",
  "electrolyte": "b[holmium]-e[electrolyte]",
  "teslagun": "a[basic-clips]-h[teslagun]",
  "supercapacitor": "b[holmium]-f[supercapacitor]",
  "tesla-turret": "b[turret]-f[tesla-turret]-a[turret]",
  "tesla-ammo": "e[railgun-ammo]-a[basic]",
  "rocket-turret": "b[turret]-e[rocket-turret]-a[turret]",
  "railgun-turret": "b[turret]-g[railgun-turret]-a[turret]",
  "railgun-ammo": "e[railgun-ammo]-a[basic]",
  "tungsten-ore": "c[tungsten]-a[tungsten-ore]",
  "tungsten-plate": "c[tungsten]-c[tungsten-plate]",
  "tungsten-carbide": "c[tungsten]-b[tungsten-carbide]",
  "metallurgic-science-pack": "h",
  "foundry": "d[foundry]",
  "yumako": "b[agriculture]-a[yumako]",
  "yumako-seed": "a[seeds]-a[yumako-seed]",
  "yumako-mash": "a[organic-processing]-c[yumako-mash]",
  "bioflux": "a[organic-products]-g[bioflux]",
  "nutrients": "c[nutrients]-b[nutrients]",
  "spoilage": "c[nutrients]-a[spoilage]",
  "agricultural-science-pack": "i",
  "biochamber": "b[biochamber]",
  "agricultural-tower": "a[agricultural-tower]",
  "artificial-yumako-soil": "c[landfill]-b[artificial-yumako-soil]",
  "overgrowth-yumako-soil": "c[landfill]-c[overgrowth-yumako-soil]",
  "artificial-jellynut-soil": "c[landfill]-d[artificial-jellynut-soil]",
  "overgrowth-jellynut-soil": "c[landfill]-e[overgrowth-jellynut-soil]",
  "jellynut": "b[agriculture]-b[jellynut]",
  "jellynut-seed": "a[seeds]-b[jellynut-seed]",
  "jelly": "a[organic-processing]-d[jelly]",
  "biter-egg": "c[eggs]-a[biter-egg]",
  "pentapod-egg": "c[eggs]-b[pentapod-egg]",
  "tree-seed": "a[seeds]-b[tree-seed]",
  "captive-biter-spawner": "z[biter-nest]",
  "capture-robot-rocket": "d[rocket-launcher]-d[capture]",
  "iron-bacteria": "b[agriculture]-d[bacteria]-a[iron-bacteria]",
  "copper-bacteria": "b[agriculture]-d[bacteria]-c[copper-bacteria]",
  "crusher": "e[crusher]",
  "metallic-asteroid-chunk": "a[metallic]-e[chunk]",
  "carbonic-asteroid-chunk": "b[carbonic]-e[chunk]",
  "oxide-asteroid-chunk": "c[oxide]-e[chunk]",
  "promethium-asteroid-chunk": "d[promethium]-e[chunk]",
  "ice": "j[ice]",
  "space-platform-foundation": "a[space-platform-foundation]",
  "thruster": "f[thruster]",
  "asteroid-collector": "d[asteroid-collector]",
  "space-platform-starter-pack": "b[space-platform-starter-pack]",
  "roboport": "c[signal]-a[roboport]",
  "logistic-robot": "a[robot]-a[logistic-robot]",
  "construction-robot": "a[robot]-b[construction-robot]",
  "personal-roboport-equipment": "e[robotics]-a[personal-roboport-equipment]",
  "personal-roboport-mk2-equipment": "e[robotics]-b[personal-roboport-mk2-equipment]",
  "passive-provider-chest": "b[storage]-c[passive-provider-chest]",
  "active-provider-chest": "b[storage]-c[active-provider-chest]",
  "storage-chest": "b[storage]-c[storage-chest]",
  "buffer-chest": "b[storage]-d[buffer-chest]",
  "requester-chest": "b[storage]-e[requester-chest]",
  "raw-fish": "h[raw-fish]",
  "uranium-ore": "g[uranium-ore]",
  "uranium-235": "a[uranium-processing]-b[uranium-235]",
  "uranium-238": "a[uranium-processing]-c[uranium-238]",
  "nuclear-fuel": "r[uranium-processing]-e[nuclear-fuel]",
  "uranium-fuel-cell": "b[uranium-products]-a[uranium-fuel-cell]",
  "depleted-uranium-fuel-cell": "b[uranium-products]-b[depleted-uranium-fuel-cell]",
  "centrifuge": "f[centrifuge]",
  "nuclear-reactor": "f[nuclear-energy]-a[reactor]",
  "steam-turbine": "f[nuclear-energy]-d[steam-turbine]",
  "heat-pipe": "f[nuclear-energy]-b[heat-pipe]",
  "heat-exchanger": "f[nuclear-energy]-c[heat-exchanger]",
  "heating-tower": "c[heating-tower]",
  "fusion-reactor": "g[fusion-energy]-a[reactor]",
  "fusion-generator": "g[fusion-energy]-b[generator]",
  "fusion-power-cell": "c[lithium]-d[fusion-power-cell]",
  "lightning-rod": "a[lightning-rod]",
  "lightning-collector": "b[lightning-collector]",
  "small-electric-pole": "a[energy]-a[small-electric-pole]",
  "medium-electric-pole": "a[energy]-b[medium-electric-pole]",
  "big-electric-pole": "a[energy]-c[big-electric-pole]",
  "constant-combinator": "c[combinators]-d[constant-combinator]",
  "arithmetic-combinator": "c[combinators]-a[arithmetic-combinator]",
  "decider-combinator": "c[combinators]-b[decider-combinator]",
  "selector-combinator": "c[combinators]-c[selector-combinator]",
  "display-panel": "s[display-panel]",
  "power-switch": "d[other]-a[power-switch]",
  "concrete": "b[concrete]-a[plain]",
  "refined-concrete": "b[concrete]-c[refined]",
  "hazard-concrete": "b[concrete]-b[hazard]",
  "refined-hazard-concrete": "b[concrete]-d[refined-hazard]",
  "landfill": "c[landfill]-a[dirt]",
  "foundation": "c[landfill]-g[foundation]",
  "ice-platform": "c[landfill]-f[ice-platform]",
  "modular-armor": "c[modular-armor]",
  "power-armor": "d[power-armor]",
  "power-armor-mk2": "e[power-armor-mk2]",
  "solar-panel-equipment": "a[energy-source]-a[solar-panel]",
  "fusion-reactor-equipment": "a[energy-source]-c[fusion-reactor]",
  "battery-equipment": "b[battery]-a[battery-equipment]",
  "battery-mk2-equipment": "b[battery]-b[battery-equipment-mk2]",
  "exoskeleton-equipment": "d[exoskeleton]-a[exoskeleton-equipment]",
  "night-vision-equipment": "f[night-vision]-a[night-vision-equipment]",
  "personal-laser-defense-equipment": "b[active-defense]-a[personal-laser-defense-equipment]",
  "energy-shield-equipment": "a[shield]-a[energy-shield-equipment]",
  "energy-shield-mk2-equipment": "a[shield]-b[energy-shield-equipment-mk2]",
  "belt-immunity-equipment": "c[belt-immunity]-a[belt-immunity]",
  "discharge-defense-equipment": "b[active-defense]-b[discharge-defense-equipment]-a[equipment]",
  "wood": "a[wood]",
  "wooden-chest": "a[items]-a[wooden-chest]",
  "iron-chest": "a[items]-b[iron-chest]",
  "repair-pack": "b[repair]-a[repair-pack]",
  "deconstruction-planner": "c[automated-construction]-b[deconstruction-planner]",
  "upgrade-planner": "c[automated-construction]-c[upgrade-planner]",
  "space-science-pack": "g[space-science-pack]",
  "promethium-science-pack": "l",
  "cryogenic-plant": "h[cryogenic-plant]",
  "cryogenic-science-pack": "k",
  "quantum-processor": "c[lithium]-c[quantum-processor]",
  "scrap": "a[scrap]-a[scrap]",
  "battery-mk3-equipment": "b[battery]-c[battery-equipment-mk3]",
  "fission-reactor-equipment": "a[energy-source]-b[fission-reactor]",
  "toolbelt-equipment": "g[toolbelt]-a[night-vision-equipment]",
  "mech-armor": "f[mech-armor]",
  "railgun": "a[basic-clips]-h[railgun]",
  "barrel": "a[basic-intermediates]-d[empty-barrel]",
  "water-barrel": "a[fluid]-a[water]-a[water]",
  "crude-oil-barrel": "a[fluid]-b[oil]-a[crude-oil]",
  "heavy-oil-barrel": "a[fluid]-b[oil]-d[heavy-oil]",
  "light-oil-barrel": "a[fluid]-b[oil]-c[light-oil]",
  "petroleum-gas-barrel": "a[fluid]-b[oil]-b[petroleum-gas]",
  "lubricant-barrel": "a[fluid]-b[oil]-e[lubricant]",
  "sulfuric-acid-barrel": "a[fluid]-b[oil]-f[sulfuric-acid]",
  "fluoroketone-cold-barrel": "b[new-fluid]-e[aquilo]-e[fluoroketone-cold]",
  "fluoroketone-hot-barrel": "b[new-fluid]-e[aquilo]-d[fluoroketone-hot]"
 },
 "pollution": {
  "burner-mining-drill": 12,
  "electric-mining-drill": 10,
  "big-mining-drill": 40,
  "pumpjack": 10,
  "stone-furnace": 2,
  "steel-furnace": 4,
  "electric-furnace": 1,
  "boiler": 30,
  "oil-refinery": 6,
  "chemical-plant": 4,
  "centrifuge": 4,
  "nuclear-reactor": 7,
  "burner-inserter": 0.3,
  "locomotive": 3
 },
 "enemy": {
  "small-wriggler-pentapod": {
   "hp": 100,
   "speed": 9.600000000000001,
   "kind": "melee",
   "evo": 0.3,
   "size": 8,
   "color": "#7ac24a",
   "attack": {
    "type": "projectile",
    "range": 1.08,
    "cooldown": 0.43333333333333335
   },
   "resist": [
    {
     "type": "laser",
     "percent": 50
    }
   ]
  },
  "medium-wriggler-pentapod": {
   "hp": 200,
   "speed": 10.8,
   "kind": "melee",
   "evo": 0.45,
   "size": 11,
   "color": "#5f9c3a",
   "attack": {
    "type": "projectile",
    "range": 1.4400000000000002,
    "cooldown": 0.43333333333333335
   },
   "resist": [
    {
     "type": "laser",
     "percent": 50
    }
   ]
  },
  "big-wriggler-pentapod": {
   "hp": 400,
   "speed": 12,
   "kind": "melee",
   "evo": 0.7,
   "size": 14,
   "color": "#4a7c2a",
   "attack": {
    "type": "projectile",
    "range": 1.8,
    "cooldown": 0.43333333333333335
   },
   "resist": [
    {
     "type": "laser",
     "percent": 50
    }
   ]
  },
  "small-strafer-pentapod": {
   "hp": 800,
   "speed": 0,
   "kind": "ranged",
   "evo": 0.55,
   "size": 13,
   "color": "#9a6a3a",
   "attack": {
    "type": "projectile",
    "range": 25,
    "cooldown": 2
   },
   "resist": [
    {
     "type": "physical",
     "percent": 10
    },
    {
     "type": "laser",
     "percent": 50
    }
   ]
  },
  "medium-strafer-pentapod": {
   "hp": 1400,
   "speed": 0,
   "kind": "ranged",
   "evo": 0.75,
   "size": 16,
   "color": "#7a522a",
   "attack": {
    "type": "projectile",
    "range": 28,
    "cooldown": 2
   },
   "resist": [
    {
     "type": "physical",
     "percent": 10
    },
    {
     "type": "laser",
     "percent": 50
    }
   ]
  },
  "big-strafer-pentapod": {
   "hp": 2400,
   "speed": 0,
   "kind": "ranged",
   "evo": 0.9,
   "size": 20,
   "color": "#5a3a1a",
   "attack": {
    "type": "projectile",
    "range": 31,
    "cooldown": 2
   },
   "resist": [
    {
     "type": "physical",
     "percent": 10
    },
    {
     "type": "laser",
     "percent": 50
    }
   ]
  },
  "small-stomper-pentapod": {
   "hp": 3500,
   "speed": 0,
   "kind": "stomp",
   "evo": 0.8,
   "size": 22,
   "color": "#6a5a2a",
   "attack": {
    "type": "stream",
    "range": 5.8500000000000005,
    "minRange": 3.6,
    "cooldown": 1,
    "dmgMod": 0.5
   },
   "resist": [
    {
     "type": "physical",
     "percent": 50
    },
    {
     "type": "laser",
     "percent": 80
    },
    {
     "type": "impact",
     "percent": 80
    }
   ]
  },
  "medium-stomper-pentapod": {
   "hp": 8000,
   "speed": 0,
   "kind": "stomp",
   "evo": 0.93,
   "size": 28,
   "color": "#4f4220",
   "attack": {
    "type": "stream",
    "range": 7.8,
    "minRange": 4.8,
    "cooldown": 1,
    "dmgMod": 1
   },
   "resist": [
    {
     "type": "physical",
     "percent": 50
    },
    {
     "type": "laser",
     "percent": 80
    },
    {
     "type": "impact",
     "percent": 80
    }
   ]
  },
  "big-stomper-pentapod": {
   "hp": 15000,
   "speed": 0,
   "kind": "stomp",
   "evo": 0.97,
   "size": 34,
   "color": "#3a3018",
   "attack": {
    "type": "stream",
    "range": 10.4,
    "minRange": 6.4,
    "cooldown": 1,
    "dmgMod": 1.6
   },
   "resist": [
    {
     "type": "physical",
     "percent": 50
    },
    {
     "type": "laser",
     "percent": 80
    },
    {
     "type": "impact",
     "percent": 80
    }
   ]
  }
 },
 "fuelEnergy": {
  "coal": 12,
  "wood": 3,
  "solid-fuel": 50,
  "rocket-fuel": 500,
  "nuclear-fuel": 2500,
  "raw-fish": 4,
  "pentapod-egg": 5
 },
 "thruster": {
  "fluidUsage": 2,
  "fluidVolume": 0.8,
  "effectivity": 0.51
 },
 "recycling": {
  "scrap": {
   "time": 0.2,
   "out": {
    "iron-gear-wheel": 1,
    "solid-fuel": 1,
    "concrete": 1,
    "ice": 1,
    "steel-plate": 1,
    "battery": 1,
    "stone": 1,
    "advanced-circuit": 1,
    "copper-cable": 1,
    "processing-unit": 1,
    "low-density-structure": 1,
    "holmium-ore": 1
   }
  },
  "speed-module": {
   "time": 0.9375,
   "out": {
    "electronic-circuit": 1.25,
    "advanced-circuit": 1.25
   }
  },
  "speed-module-2": {
   "time": 1.875,
   "out": {
    "processing-unit": 1.25,
    "advanced-circuit": 1.25,
    "speed-module": 1
   }
  },
  "speed-module-3": {
   "time": 3.75,
   "out": {
    "processing-unit": 1.25,
    "advanced-circuit": 1.25,
    "speed-module-2": 1,
    "tungsten-carbide": 0.25
   }
  },
  "productivity-module": {
   "time": 0.9375,
   "out": {
    "electronic-circuit": 1.25,
    "advanced-circuit": 1.25
   }
  },
  "productivity-module-2": {
   "time": 1.875,
   "out": {
    "processing-unit": 1.25,
    "advanced-circuit": 1.25,
    "productivity-module": 1
   }
  },
  "productivity-module-3": {
   "time": 3.75,
   "out": {
    "processing-unit": 1.25,
    "advanced-circuit": 1.25,
    "productivity-module-2": 1,
    "biter-egg": 0.25
   }
  },
  "efficiency-module": {
   "time": 0.9375,
   "out": {
    "electronic-circuit": 1.25,
    "advanced-circuit": 1.25
   }
  },
  "efficiency-module-2": {
   "time": 1.875,
   "out": {
    "processing-unit": 1.25,
    "advanced-circuit": 1.25,
    "efficiency-module": 1
   }
  },
  "efficiency-module-3": {
   "time": 3.75,
   "out": {
    "processing-unit": 1.25,
    "advanced-circuit": 1.25,
    "efficiency-module-2": 1,
    "spoilage": 1.25
   }
  },
  "bulk-inserter": {
   "time": 0.03125,
   "out": {
    "fast-inserter": 0.25,
    "advanced-circuit": 0.25,
    "electronic-circuit": 3.75,
    "iron-gear-wheel": 3.75
   }
  },
  "barrel": {
   "time": 0.0625,
   "out": {
    "steel-plate": 0.25
   }
  },
  "night-vision-equipment": {
   "time": 0.625,
   "out": {
    "steel-plate": 2.5,
    "advanced-circuit": 1.25
   }
  },
  "belt-immunity-equipment": {
   "time": 0.625,
   "out": {
    "steel-plate": 2.5,
    "advanced-circuit": 1.25
   }
  },
  "energy-shield-equipment": {
   "time": 0.625,
   "out": {
    "steel-plate": 2.5,
    "advanced-circuit": 1.25
   }
  },
  "energy-shield-mk2-equipment": {
   "time": 0.625,
   "out": {
    "low-density-structure": 1.25,
    "processing-unit": 1.25,
    "energy-shield-equipment": 2.5
   }
  },
  "battery-equipment": {
   "time": 0.625,
   "out": {
    "steel-plate": 2.5,
    "battery": 1.25
   }
  },
  "battery-mk2-equipment": {
   "time": 0.625,
   "out": {
    "low-density-structure": 1.25,
    "processing-unit": 3.75,
    "battery-equipment": 2.5
   }
  },
  "solar-panel-equipment": {
   "time": 0.625,
   "out": {
    "steel-plate": 1.25,
    "advanced-circuit": 0.5,
    "solar-panel": 0.25
   }
  },
  "fission-reactor-equipment": {
   "time": 0.625,
   "out": {
    "uranium-fuel-cell": 1,
    "low-density-structure": 12.5,
    "processing-unit": 50
   }
  },
  "personal-laser-defense-equipment": {
   "time": 0.625,
   "out": {
    "laser-turret": 1.25,
    "low-density-structure": 1.25,
    "processing-unit": 5
   }
  },
  "discharge-defense-equipment": {
   "time": 0.625,
   "out": {
    "laser-turret": 2.5,
    "steel-plate": 5,
    "processing-unit": 1.25
   }
  },
  "exoskeleton-equipment": {
   "time": 0.625,
   "out": {
    "steel-plate": 5,
    "electric-engine-unit": 7.5,
    "processing-unit": 2.5
   }
  },
  "personal-roboport-equipment": {
   "time": 0.625,
   "out": {
    "battery": 11.25,
    "steel-plate": 5,
    "iron-gear-wheel": 10,
    "advanced-circuit": 2.5
   }
  },
  "personal-roboport-mk2-equipment": {
   "time": 1.25,
   "out": {
    "superconductor": 12.5,
    "processing-unit": 12.5,
    "personal-roboport-equipment": 1.25
   }
  },
  "laser-turret": {
   "time": 1.25,
   "out": {
    "battery": 3,
    "electronic-circuit": 5,
    "steel-plate": 5
   }
  },
  "flamethrower-turret": {
   "time": 1.25,
   "out": {
    "engine-unit": 1.25,
    "pipe": 2.5,
    "iron-gear-wheel": 3.75,
    "steel-plate": 7.5
   }
  },
  "artillery-turret": {
   "time": 2.5,
   "out": {
    "processing-unit": 2.5,
    "iron-gear-wheel": 10,
    "refined-concrete": 15,
    "tungsten-plate": 15
   }
  },
  "gun-turret": {
   "time": 0.5,
   "out": {
    "iron-plate": 5,
    "copper-plate": 2.5,
    "iron-gear-wheel": 2.5
   }
  },
  "wooden-chest": {
   "time": 0.03125,
   "out": {
    "wood": 0.5
   }
  },
  "display-panel": {
   "time": 0.03125,
   "out": {
    "electronic-circuit": 0.25,
    "iron-plate": 0.25
   }
  },
  "iron-stick": {
   "time": 0.015625,
   "out": {
    "iron-plate": 0.125
   }
  },
  "stone-furnace": {
   "time": 0.03125,
   "out": {
    "stone": 1.25
   }
  },
  "boiler": {
   "time": 0.03125,
   "out": {
    "pipe": 1,
    "stone-furnace": 0.25
   }
  },
  "steam-engine": {
   "time": 0.03125,
   "out": {
    "iron-plate": 2.5,
    "pipe": 1.25,
    "iron-gear-wheel": 2
   }
  },
  "iron-gear-wheel": {
   "time": 0.03125,
   "out": {
    "iron-plate": 0.5
   }
  },
  "electronic-circuit": {
   "time": 0.03125,
   "out": {
    "copper-cable": 0.75,
    "iron-plate": 0.25
   }
  },
  "transport-belt": {
   "time": 0.015625,
   "out": {
    "iron-gear-wheel": 0.125,
    "iron-plate": 0.125
   }
  },
  "electric-mining-drill": {
   "time": 0.125,
   "out": {
    "iron-plate": 2.5,
    "iron-gear-wheel": 1.25,
    "electronic-circuit": 0.75
   }
  },
  "burner-mining-drill": {
   "time": 0.125,
   "out": {
    "iron-plate": 0.75,
    "stone-furnace": 0.25,
    "iron-gear-wheel": 0.75
   }
  },
  "inserter": {
   "time": 0.03125,
   "out": {
    "iron-plate": 0.25,
    "iron-gear-wheel": 0.25,
    "electronic-circuit": 0.25
   }
  },
  "fast-inserter": {
   "time": 0.03125,
   "out": {
    "inserter": 0.25,
    "iron-plate": 0.5,
    "electronic-circuit": 0.5
   }
  },
  "long-handed-inserter": {
   "time": 0.03125,
   "out": {
    "inserter": 0.25,
    "iron-plate": 0.25,
    "iron-gear-wheel": 0.25
   }
  },
  "burner-inserter": {
   "time": 0.03125,
   "out": {
    "iron-gear-wheel": 0.25,
    "iron-plate": 0.25
   }
  },
  "pipe": {
   "time": 0.03125,
   "out": {
    "iron-plate": 0.25
   }
  },
  "offshore-pump": {
   "time": 0.03125,
   "out": {
    "iron-gear-wheel": 0.5,
    "pipe": 0.75
   }
  },
  "copper-cable": {
   "time": 0.015625,
   "out": {
    "copper-plate": 0.125
   }
  },
  "small-electric-pole": {
   "time": 0.015625,
   "out": {
    "copper-cable": 0.25,
    "wood": 0.125
   }
  },
  "submachine-gun": {
   "time": 0.625,
   "out": {
    "iron-plate": 2.5,
    "copper-plate": 1.25,
    "iron-gear-wheel": 2.5
   }
  },
  "firearm-magazine": {
   "time": 0.0625,
   "out": {
    "iron-plate": 1
   }
  },
  "light-armor": {
   "time": 0.1875,
   "out": {
    "iron-plate": 10
   }
  },
  "radar": {
   "time": 0.03125,
   "out": {
    "iron-plate": 2.5,
    "iron-gear-wheel": 1.25,
    "electronic-circuit": 1.25
   }
  },
  "small-lamp": {
   "time": 0.03125,
   "out": {
    "iron-plate": 0.25,
    "copper-cable": 0.75,
    "electronic-circuit": 0.25
   }
  },
  "pipe-to-ground": {
   "time": 0.015625,
   "out": {
    "iron-plate": 0.625,
    "pipe": 1.25
   }
  },
  "assembling-machine-1": {
   "time": 0.03125,
   "out": {
    "iron-plate": 2.25,
    "iron-gear-wheel": 1.25,
    "electronic-circuit": 0.75
   }
  },
  "lab": {
   "time": 0.125,
   "out": {
    "transport-belt": 1,
    "iron-gear-wheel": 2.5,
    "electronic-circuit": 2.5
   }
  },
  "stone-wall": {
   "time": 0.03125,
   "out": {
    "stone-brick": 1.25
   }
  },
  "assembling-machine-2": {
   "time": 0.03125,
   "out": {
    "assembling-machine-1": 0.25,
    "iron-gear-wheel": 1.25,
    "electronic-circuit": 0.75,
    "steel-plate": 0.5
   }
  },
  "splitter": {
   "time": 0.0625,
   "out": {
    "transport-belt": 1,
    "iron-plate": 1.25,
    "electronic-circuit": 1.25
   }
  },
  "underground-belt": {
   "time": 0.03125,
   "out": {
    "transport-belt": 0.625,
    "iron-plate": 1.25
   }
  },
  "loader": {
   "time": 0.0625,
   "out": {
    "transport-belt": 1.25,
    "iron-plate": 1.25,
    "iron-gear-wheel": 1.25,
    "electronic-circuit": 1.25,
    "inserter": 1.25
   }
  },
  "engine-unit": {
   "time": 0.625,
   "out": {
    "pipe": 0.5,
    "iron-gear-wheel": 0.25,
    "steel-plate": 0.25
   }
  },
  "iron-chest": {
   "time": 0.03125,
   "out": {
    "iron-plate": 2
   }
  },
  "big-electric-pole": {
   "time": 0.03125,
   "out": {
    "copper-cable": 1,
    "steel-plate": 1.25,
    "iron-stick": 2
   }
  },
  "medium-electric-pole": {
   "time": 0.03125,
   "out": {
    "copper-cable": 0.5,
    "steel-plate": 0.5,
    "iron-stick": 1
   }
  },
  "shotgun": {
   "time": 0.625,
   "out": {
    "wood": 1.25,
    "copper-plate": 2.5,
    "iron-gear-wheel": 1.25,
    "iron-plate": 3.75
   }
  },
  "shotgun-shell": {
   "time": 0.1875,
   "out": {
    "iron-plate": 0.5,
    "copper-plate": 0.5
   }
  },
  "piercing-rounds-magazine": {
   "time": 0.1875,
   "out": {
    "copper-plate": 0.25,
    "steel-plate": 0.125,
    "firearm-magazine": 0.25
   }
  },
  "grenade": {
   "time": 0.5,
   "out": {
    "coal": 2.5,
    "iron-plate": 1.25
   }
  },
  "steel-furnace": {
   "time": 0.1875,
   "out": {
    "stone-brick": 2.5,
    "steel-plate": 1.5
   }
  },
  "gate": {
   "time": 0.03125,
   "out": {
    "electronic-circuit": 0.5,
    "steel-plate": 0.5,
    "stone-wall": 0.25
   }
  },
  "heavy-armor": {
   "time": 0.5,
   "out": {
    "steel-plate": 12.5,
    "copper-plate": 25
   }
  },
  "steel-chest": {
   "time": 0.03125,
   "out": {
    "steel-plate": 2
   }
  },
  "fast-underground-belt": {
   "time": 0.0625,
   "out": {
    "underground-belt": 0.25,
    "iron-gear-wheel": 5
   }
  },
  "fast-splitter": {
   "time": 0.125,
   "out": {
    "electronic-circuit": 2.5,
    "iron-gear-wheel": 2.5,
    "splitter": 0.25
   }
  },
  "concrete": {
   "time": 0.0625,
   "out": {
    "iron-ore": 0.025,
    "stone-brick": 0.125
   }
  },
  "hazard-concrete": {
   "time": 0.0625,
   "out": {
    "iron-ore": 0.025,
    "stone-brick": 0.125
   }
  },
  "refined-concrete": {
   "time": 0.09375,
   "out": {
    "steel-plate": 0.025,
    "iron-stick": 0.2,
    "concrete": 0.5
   }
  },
  "refined-hazard-concrete": {
   "time": 0.09375,
   "out": {
    "steel-plate": 0.025,
    "iron-stick": 0.2,
    "concrete": 0.5
   }
  },
  "fast-transport-belt": {
   "time": 0.03125,
   "out": {
    "transport-belt": 0.25,
    "iron-gear-wheel": 1.25
   }
  },
  "solar-panel": {
   "time": 0.625,
   "out": {
    "copper-plate": 1.25,
    "electronic-circuit": 3.75,
    "steel-plate": 1.25
   }
  },
  "rail-signal": {
   "time": 0.03125,
   "out": {
    "iron-plate": 1.25,
    "electronic-circuit": 0.25
   }
  },
  "rail-chain-signal": {
   "time": 0.03125,
   "out": {
    "iron-plate": 1.25,
    "electronic-circuit": 0.25
   }
  },
  "train-stop": {
   "time": 0.03125,
   "out": {
    "steel-plate": 0.75,
    "iron-stick": 1.5,
    "iron-plate": 1.5,
    "electronic-circuit": 1.25
   }
  },
  "arithmetic-combinator": {
   "time": 0.03125,
   "out": {
    "electronic-circuit": 1.25,
    "copper-cable": 1.25
   }
  },
  "decider-combinator": {
   "time": 0.03125,
   "out": {
    "electronic-circuit": 1.25,
    "copper-cable": 1.25
   }
  },
  "constant-combinator": {
   "time": 0.03125,
   "out": {
    "electronic-circuit": 0.5,
    "copper-cable": 1.25
   }
  },
  "selector-combinator": {
   "time": 0.03125,
   "out": {
    "decider-combinator": 1.25,
    "advanced-circuit": 0.5
   }
  },
  "power-switch": {
   "time": 0.125,
   "out": {
    "electronic-circuit": 0.5,
    "copper-cable": 1.25,
    "iron-plate": 1.25
   }
  },
  "programmable-speaker": {
   "time": 0.125,
   "out": {
    "electronic-circuit": 1,
    "copper-cable": 1.25,
    "iron-stick": 1,
    "iron-plate": 0.75
   }
  },
  "poison-capsule": {
   "time": 0.5,
   "out": {
    "coal": 2.5,
    "electronic-circuit": 0.75,
    "steel-plate": 0.75
   }
  },
  "slowdown-capsule": {
   "time": 0.5,
   "out": {
    "coal": 1.25,
    "electronic-circuit": 0.5,
    "steel-plate": 0.5
   }
  },
  "cluster-grenade": {
   "time": 0.5,
   "out": {
    "steel-plate": 1.25,
    "explosives": 1.25,
    "grenade": 1.75
   }
  },
  "defender-capsule": {
   "time": 0.5,
   "out": {
    "iron-gear-wheel": 0.75,
    "electronic-circuit": 0.75,
    "piercing-rounds-magazine": 0.75
   }
  },
  "distractor-capsule": {
   "time": 0.9375,
   "out": {
    "advanced-circuit": 0.75,
    "defender-capsule": 1
   }
  },
  "destroyer-capsule": {
   "time": 0.9375,
   "out": {
    "processing-unit": 0.25,
    "steel-plate": 1,
    "distractor-capsule": 1
   }
  },
  "cliff-explosives": {
   "time": 0.5,
   "out": {
    "barrel": 0.25,
    "grenade": 0.25,
    "calcite": 2.5,
    "explosives": 2.5
   }
  },
  "uranium-rounds-magazine": {
   "time": 0.625,
   "out": {
    "uranium-238": 0.25,
    "piercing-rounds-magazine": 0.25
   }
  },
  "rocket": {
   "time": 0.25,
   "out": {
    "iron-plate": 0.5,
    "explosives": 0.25
   }
  },
  "explosive-rocket": {
   "time": 0.5,
   "out": {
    "explosives": 0.5,
    "rocket": 0.25
   }
  },
  "atomic-bomb": {
   "time": 3.125,
   "out": {
    "uranium-235": 25,
    "explosives": 2.5,
    "processing-unit": 2.5
   }
  },
  "piercing-shotgun-shell": {
   "time": 0.25,
   "out": {
    "steel-plate": 0.125,
    "copper-plate": 0.25,
    "shotgun-shell": 0.25
   }
  },
  "cannon-shell": {
   "time": 0.5,
   "out": {
    "explosives": 0.25,
    "plastic-bar": 0.5,
    "steel-plate": 0.5
   }
  },
  "explosive-cannon-shell": {
   "time": 0.5,
   "out": {
    "explosives": 0.5,
    "plastic-bar": 0.5,
    "steel-plate": 0.5
   }
  },
  "uranium-cannon-shell": {
   "time": 0.75,
   "out": {
    "uranium-238": 0.25,
    "cannon-shell": 0.25
   }
  },
  "explosive-uranium-cannon-shell": {
   "time": 0.75,
   "out": {
    "uranium-238": 0.25,
    "explosive-cannon-shell": 0.25
   }
  },
  "artillery-shell": {
   "time": 0.9375,
   "out": {
    "explosives": 2,
    "tungsten-plate": 1,
    "calcite": 0.25,
    "radar": 0.25
   }
  },
  "express-transport-belt": {
   "time": 0.03125,
   "out": {
    "fast-transport-belt": 0.25,
    "iron-gear-wheel": 2.5
   }
  },
  "assembling-machine-3": {
   "time": 0.03125,
   "out": {
    "speed-module": 1,
    "assembling-machine-2": 0.5
   }
  },
  "modular-armor": {
   "time": 0.9375,
   "out": {
    "steel-plate": 12.5,
    "advanced-circuit": 7.5
   }
  },
  "power-armor": {
   "time": 1.25,
   "out": {
    "steel-plate": 10,
    "electric-engine-unit": 5,
    "processing-unit": 10
   }
  },
  "power-armor-mk2": {
   "time": 1.5625,
   "out": {
    "low-density-structure": 7.5,
    "electric-engine-unit": 10,
    "processing-unit": 15,
    "speed-module": 25,
    "efficiency-module": 25
   }
  },
  "flamethrower": {
   "time": 0.625,
   "out": {
    "iron-gear-wheel": 2.5,
    "steel-plate": 1.25
   }
  },
  "land-mine": {
   "time": 0.078125,
   "out": {
    "explosives": 0.125,
    "steel-plate": 0.0625
   }
  },
  "rocket-launcher": {
   "time": 0.625,
   "out": {
    "electronic-circuit": 1.25,
    "iron-gear-wheel": 1.25,
    "iron-plate": 1.25
   }
  },
  "combat-shotgun": {
   "time": 0.625,
   "out": {
    "wood": 2.5,
    "copper-plate": 2.5,
    "iron-gear-wheel": 1.25,
    "steel-plate": 3.75
   }
  },
  "express-underground-belt": {
   "time": 0.0625,
   "out": {
    "fast-underground-belt": 0.25,
    "iron-gear-wheel": 10
   }
  },
  "fast-loader": {
   "time": 0.1875,
   "out": {
    "loader": 0.25,
    "fast-transport-belt": 1.25
   }
  },
  "express-loader": {
   "time": 0.625,
   "out": {
    "fast-loader": 0.25,
    "express-transport-belt": 1.25
   }
  },
  "express-splitter": {
   "time": 0.125,
   "out": {
    "advanced-circuit": 2.5,
    "iron-gear-wheel": 2.5,
    "fast-splitter": 0.25
   }
  },
  "advanced-circuit": {
   "time": 0.375,
   "out": {
    "copper-cable": 1,
    "plastic-bar": 0.5,
    "electronic-circuit": 0.5
   }
  },
  "processing-unit": {
   "time": 0.625,
   "out": {
    "advanced-circuit": 0.5,
    "electronic-circuit": 5
   }
  },
  "logistic-robot": {
   "time": 0.03125,
   "out": {
    "advanced-circuit": 0.5,
    "flying-robot-frame": 0.25
   }
  },
  "construction-robot": {
   "time": 0.03125,
   "out": {
    "electronic-circuit": 0.5,
    "flying-robot-frame": 0.25
   }
  },
  "passive-provider-chest": {
   "time": 0.03125,
   "out": {
    "advanced-circuit": 0.25,
    "electronic-circuit": 0.75,
    "steel-chest": 0.25
   }
  },
  "active-provider-chest": {
   "time": 0.03125,
   "out": {
    "advanced-circuit": 0.25,
    "electronic-circuit": 0.75,
    "steel-chest": 0.25
   }
  },
  "storage-chest": {
   "time": 0.03125,
   "out": {
    "advanced-circuit": 0.25,
    "electronic-circuit": 0.75,
    "steel-chest": 0.25
   }
  },
  "buffer-chest": {
   "time": 0.03125,
   "out": {
    "advanced-circuit": 0.25,
    "electronic-circuit": 0.75,
    "steel-chest": 0.25
   }
  },
  "requester-chest": {
   "time": 0.03125,
   "out": {
    "advanced-circuit": 0.25,
    "electronic-circuit": 0.75,
    "steel-chest": 0.25
   }
  },
  "rocket-silo": {
   "time": 1.875,
   "out": {
    "electric-engine-unit": 50,
    "processing-unit": 50,
    "pipe": 25,
    "concrete": 250,
    "steel-plate": 250
   }
  },
  "cargo-landing-pad": {
   "time": 1.875,
   "out": {
    "processing-unit": 2.5,
    "steel-plate": 6.25,
    "concrete": 50
   }
  },
  "roboport": {
   "time": 0.3125,
   "out": {
    "advanced-circuit": 11.25,
    "iron-gear-wheel": 11.25,
    "steel-plate": 11.25
   }
  },
  "substation": {
   "time": 0.03125,
   "out": {
    "copper-cable": 1.5,
    "advanced-circuit": 1.25,
    "steel-plate": 2.5
   }
  },
  "accumulator": {
   "time": 0.625,
   "out": {
    "battery": 1.25,
    "iron-plate": 0.5
   }
  },
  "electric-furnace": {
   "time": 0.3125,
   "out": {
    "stone-brick": 2.5,
    "advanced-circuit": 1.25,
    "steel-plate": 2.5
   }
  },
  "beacon": {
   "time": 0.9375,
   "out": {
    "copper-cable": 2.5,
    "steel-plate": 2.5,
    "advanced-circuit": 5,
    "electronic-circuit": 5
   }
  },
  "pumpjack": {
   "time": 0.3125,
   "out": {
    "pipe": 2.5,
    "electronic-circuit": 1.25,
    "iron-gear-wheel": 2.5,
    "steel-plate": 1.25
   }
  },
  "oil-refinery": {
   "time": 0.5,
   "out": {
    "pipe": 2.5,
    "electronic-circuit": 2.5,
    "stone-brick": 2.5,
    "iron-gear-wheel": 2.5,
    "steel-plate": 3.75
   }
  },
  "electric-engine-unit": {
   "time": 0.625,
   "out": {
    "electronic-circuit": 0.5,
    "engine-unit": 0.25
   }
  },
  "flying-robot-frame": {
   "time": 1.25,
   "out": {
    "electronic-circuit": 0.75,
    "steel-plate": 0.25,
    "battery": 0.5,
    "electric-engine-unit": 0.25
   }
  },
  "battery": {
   "time": 0.25,
   "out": {
    "copper-plate": 0.25,
    "iron-plate": 0.25
   }
  },
  "storage-tank": {
   "time": 0.1875,
   "out": {
    "steel-plate": 1.25,
    "iron-plate": 5
   }
  },
  "pump": {
   "time": 0.125,
   "out": {
    "pipe": 0.25,
    "steel-plate": 0.25,
    "engine-unit": 0.25
   }
  },
  "chemical-plant": {
   "time": 0.3125,
   "out": {
    "pipe": 1.25,
    "electronic-circuit": 1.25,
    "iron-gear-wheel": 1.25,
    "steel-plate": 1.25
   }
  },
  "low-density-structure": {
   "time": 0.9375,
   "out": {
    "plastic-bar": 1.25,
    "copper-plate": 5,
    "steel-plate": 0.5
   }
  },
  "rocket-fuel": {
   "time": 0.9375,
   "out": {
    "solid-fuel": 2.5
   }
  },
  "nuclear-reactor": {
   "time": 0.5,
   "out": {
    "copper-plate": 125,
    "advanced-circuit": 125,
    "steel-plate": 125,
    "concrete": 125
   }
  },
  "centrifuge": {
   "time": 0.25,
   "out": {
    "iron-gear-wheel": 25,
    "advanced-circuit": 25,
    "steel-plate": 12.5,
    "concrete": 25
   }
  },
  "nuclear-fuel": {
   "time": 5.625,
   "out": {
    "rocket-fuel": 0.25,
    "uranium-235": 0.25
   }
  },
  "heat-exchanger": {
   "time": 0.1875,
   "out": {
    "pipe": 2.5,
    "copper-plate": 25,
    "steel-plate": 2.5
   }
  },
  "heat-pipe": {
   "time": 0.0625,
   "out": {
    "copper-plate": 5,
    "steel-plate": 2.5
   }
  },
  "steam-turbine": {
   "time": 0.1875,
   "out": {
    "pipe": 5,
    "copper-plate": 12.5,
    "iron-gear-wheel": 12.5
   }
  },
  "rail-support": {
   "time": 0.03125,
   "out": {
    "steel-plate": 2.5,
    "refined-concrete": 5
   }
  },
  "quality-module": {
   "time": 0.9375,
   "out": {
    "advanced-circuit": 1.25,
    "electronic-circuit": 1.25
   }
  },
  "quality-module-2": {
   "time": 1.875,
   "out": {
    "processing-unit": 1.25,
    "advanced-circuit": 1.25,
    "quality-module": 1
   }
  },
  "quality-module-3": {
   "time": 3.75,
   "out": {
    "superconductor": 0.25,
    "processing-unit": 1.25,
    "advanced-circuit": 1.25,
    "quality-module-2": 1
   }
  },
  "recycler": {
   "time": 0.1875,
   "out": {
    "concrete": 5,
    "iron-gear-wheel": 10,
    "steel-plate": 5,
    "processing-unit": 1.5
   }
  },
  "artificial-yumako-soil": {
   "time": 0.0125,
   "out": {
    "landfill": 0.125,
    "nutrients": 1.25,
    "yumako-seed": 0.05
   }
  },
  "overgrowth-yumako-soil": {
   "time": 0.625,
   "out": {
    "spoilage": 12.5,
    "biter-egg": 2.5,
    "yumako-seed": 1.25,
    "artificial-yumako-soil": 0.5
   }
  },
  "artificial-jellynut-soil": {
   "time": 0.0125,
   "out": {
    "landfill": 0.125,
    "nutrients": 1.25,
    "jellynut-seed": 0.05
   }
  },
  "overgrowth-jellynut-soil": {
   "time": 0.625,
   "out": {
    "spoilage": 12.5,
    "biter-egg": 2.5,
    "jellynut-seed": 1.25,
    "artificial-jellynut-soil": 0.5
   }
  },
  "nutrients": {
   "time": 0.125,
   "out": {
    "spoilage": 2.5
   }
  },
  "toolbelt-equipment": {
   "time": 0.625,
   "out": {
    "carbon-fiber": 2.5,
    "advanced-circuit": 0.75
   }
  },
  "battery-mk3-equipment": {
   "time": 0.625,
   "out": {
    "supercapacitor": 2.5,
    "battery-mk2-equipment": 1.25
   }
  },
  "space-platform-foundation": {
   "time": 0.625,
   "out": {
    "copper-cable": 5,
    "steel-plate": 5
   }
  },
  "stack-inserter": {
   "time": 0.03125,
   "out": {
    "jelly": 2.5,
    "carbon-fiber": 0.5,
    "processing-unit": 0.25,
    "bulk-inserter": 0.25
   }
  },
  "rocket-turret": {
   "time": 0.625,
   "out": {
    "iron-gear-wheel": 5,
    "steel-plate": 5,
    "carbon-fiber": 5,
    "processing-unit": 1,
    "rocket-launcher": 1
   }
  },
  "cargo-bay": {
   "time": 0.625,
   "out": {
    "processing-unit": 1.25,
    "low-density-structure": 5,
    "steel-plate": 5
   }
  },
  "landing-pad-unloading-bay": {
   "time": 0.625,
   "out": {
    "processing-unit": 2,
    "electric-engine-unit": 3.75,
    "steel-chest": 1,
    "cargo-bay": 0.25
   }
  },
  "asteroid-collector": {
   "time": 0.625,
   "out": {
    "processing-unit": 1.25,
    "electric-engine-unit": 2,
    "low-density-structure": 5
   }
  },
  "crusher": {
   "time": 0.625,
   "out": {
    "electric-engine-unit": 2.5,
    "steel-plate": 2.5,
    "low-density-structure": 5
   }
  },
  "thruster": {
   "time": 0.625,
   "out": {
    "electric-engine-unit": 1.25,
    "processing-unit": 2.5,
    "steel-plate": 2.5
   }
  },
  "foundry": {
   "time": 0.625,
   "out": {
    "refined-concrete": 5,
    "electronic-circuit": 7.5,
    "steel-plate": 12.5,
    "tungsten-carbide": 12.5
   }
  },
  "turbo-transport-belt": {
   "time": 0.03125,
   "out": {
    "express-transport-belt": 0.25,
    "tungsten-plate": 1.25
   }
  },
  "turbo-underground-belt": {
   "time": 0.0625,
   "out": {
    "express-underground-belt": 0.25,
    "tungsten-plate": 5
   }
  },
  "turbo-splitter": {
   "time": 0.125,
   "out": {
    "processing-unit": 0.5,
    "tungsten-plate": 3.75,
    "express-splitter": 0.25
   }
  },
  "turbo-loader": {
   "time": 1.25,
   "out": {
    "express-loader": 0.25,
    "turbo-transport-belt": 1.25
   }
  },
  "big-mining-drill": {
   "time": 1.875,
   "out": {
    "advanced-circuit": 2.5,
    "electric-engine-unit": 2.5,
    "tungsten-carbide": 5,
    "electric-mining-drill": 0.25
   }
  },
  "mech-armor": {
   "time": 3.75,
   "out": {
    "supercapacitor": 12.5,
    "superconductor": 12.5,
    "processing-unit": 25,
    "holmium-plate": 50,
    "power-armor-mk2": 0.25
   }
  },
  "railgun": {
   "time": 0.625,
   "out": {
    "quantum-processor": 5,
    "superconductor": 2.5,
    "tungsten-plate": 2.5
   }
  },
  "railgun-turret": {
   "time": 0.625,
   "out": {
    "carbon-fiber": 5,
    "superconductor": 12.5,
    "tungsten-plate": 7.5,
    "quantum-processor": 25
   }
  },
  "railgun-ammo": {
   "time": 1.5625,
   "out": {
    "explosives": 0.5,
    "copper-cable": 2.5,
    "steel-plate": 1.25
   }
  },
  "agricultural-tower": {
   "time": 0.625,
   "out": {
    "landfill": 0.25,
    "spoilage": 5,
    "electronic-circuit": 0.75,
    "steel-plate": 2.5
   }
  },
  "biochamber": {
   "time": 1.25,
   "out": {
    "landfill": 0.25,
    "electronic-circuit": 1.25,
    "iron-plate": 5,
    "pentapod-egg": 0.25,
    "nutrients": 1.25
   }
  },
  "capture-robot-rocket": {
   "time": 0.625,
   "out": {
    "processing-unit": 0.5,
    "bioflux": 5,
    "steel-plate": 0.5,
    "flying-robot-frame": 0.25
   }
  },
  "lightning-rod": {
   "time": 0.3125,
   "out": {
    "stone-brick": 1,
    "steel-plate": 2,
    "copper-cable": 3
   }
  },
  "electromagnetic-plant": {
   "time": 0.625,
   "out": {
    "refined-concrete": 12.5,
    "processing-unit": 12.5,
    "steel-plate": 12.5,
    "holmium-plate": 37.5
   }
  },
  "supercapacitor": {
   "time": 0.625,
   "out": {
    "battery": 0.25,
    "electronic-circuit": 1,
    "superconductor": 0.5,
    "holmium-plate": 0.5
   }
  },
  "lightning-collector": {
   "time": 0.3125,
   "out": {
    "accumulator": 0.25,
    "supercapacitor": 2,
    "lightning-rod": 0.25
   }
  },
  "teslagun": {
   "time": 1.875,
   "out": {
    "plastic-bar": 7.5,
    "superconductor": 2.5,
    "holmium-plate": 2.5
   }
  },
  "tesla-turret": {
   "time": 1.875,
   "out": {
    "superconductor": 12.5,
    "processing-unit": 2.5,
    "supercapacitor": 2.5,
    "teslagun": 0.25
   }
  },
  "tesla-ammo": {
   "time": 1.875,
   "out": {
    "plastic-bar": 0.25,
    "supercapacitor": 0.25
   }
  },
  "heating-tower": {
   "time": 0.625,
   "out": {
    "concrete": 5,
    "heat-pipe": 1.25,
    "boiler": 0.5
   }
  },
  "cryogenic-plant": {
   "time": 0.625,
   "out": {
    "lithium-plate": 5,
    "processing-unit": 5,
    "superconductor": 5,
    "refined-concrete": 10
   }
  },
  "quantum-processor": {
   "time": 1.875,
   "out": {
    "lithium-plate": 0.5,
    "carbon-fiber": 0.25,
    "superconductor": 0.25,
    "processing-unit": 0.25,
    "tungsten-carbide": 0.25
   }
  },
  "fusion-reactor-equipment": {
   "time": 1.875,
   "out": {
    "quantum-processor": 62.5,
    "supercapacitor": 6.25,
    "carbon-fiber": 25,
    "tungsten-plate": 62.5,
    "fusion-power-cell": 2.5,
    "fission-reactor-equipment": 0.25
   }
  },
  "fusion-reactor": {
   "time": 3.75,
   "out": {
    "quantum-processor": 62.5,
    "superconductor": 50,
    "tungsten-plate": 50
   }
  },
  "fusion-generator": {
   "time": 1.875,
   "out": {
    "quantum-processor": 12.5,
    "superconductor": 25,
    "tungsten-plate": 25
   }
  },
  "ice-platform": {
   "time": 1.875,
   "out": {
    "ice": 12.5
   }
  },
  "foundation": {
   "time": 1.875,
   "out": {
    "stone": 5,
    "carbon-fiber": 1,
    "lithium-plate": 1,
    "tungsten-plate": 1
   }
  },
  "water-barrel": {
   "time": 0.0125,
   "out": {
    "barrel": 0.25
   }
  },
  "sulfuric-acid-barrel": {
   "time": 0.0125,
   "out": {
    "barrel": 0.25
   }
  },
  "crude-oil-barrel": {
   "time": 0.0125,
   "out": {
    "barrel": 0.25
   }
  },
  "heavy-oil-barrel": {
   "time": 0.0125,
   "out": {
    "barrel": 0.25
   }
  },
  "light-oil-barrel": {
   "time": 0.0125,
   "out": {
    "barrel": 0.25
   }
  },
  "petroleum-gas-barrel": {
   "time": 0.0125,
   "out": {
    "barrel": 0.25
   }
  },
  "lubricant-barrel": {
   "time": 0.0125,
   "out": {
    "barrel": 0.25
   }
  },
  "fluoroketone-cold-barrel": {
   "time": 0.0125,
   "out": {
    "barrel": 0.25
   }
  },
  "fluoroketone-hot-barrel": {
   "time": 0.0125,
   "out": {
    "barrel": 0.25
   }
  },
  "stone-brick": {
   "time": 0.2,
   "out": {
    "stone-brick": 0.25
   }
  },
  "wood": {
   "time": 0.03125,
   "out": {
    "wood": 0.25
   }
  },
  "coal": {
   "time": 0.03125,
   "out": {
    "coal": 0.25
   }
  },
  "stone": {
   "time": 0.03125,
   "out": {
    "stone": 0.25
   }
  },
  "iron-ore": {
   "time": 0.03125,
   "out": {
    "iron-ore": 0.25
   }
  },
  "copper-ore": {
   "time": 0.03125,
   "out": {
    "copper-ore": 0.25
   }
  },
  "iron-plate": {
   "time": 0.2,
   "out": {
    "iron-plate": 0.25
   }
  },
  "copper-plate": {
   "time": 0.2,
   "out": {
    "copper-plate": 0.25
   }
  },
  "automation-science-pack": {
   "time": 0.3125,
   "out": {
    "automation-science-pack": 0.25
   }
  },
  "logistic-science-pack": {
   "time": 0.375,
   "out": {
    "logistic-science-pack": 0.25
   }
  },
  "steel-plate": {
   "time": 1,
   "out": {
    "steel-plate": 0.25
   }
  },
  "solid-fuel": {
   "time": 0.03125,
   "out": {
    "solid-fuel": 0.25
   }
  },
  "landfill": {
   "time": 0.03125,
   "out": {
    "landfill": 0.25
   }
  },
  "uranium-ore": {
   "time": 0.03125,
   "out": {
    "uranium-ore": 0.25
   }
  },
  "chemical-science-pack": {
   "time": 1.5,
   "out": {
    "chemical-science-pack": 0.25
   }
  },
  "military-science-pack": {
   "time": 0.625,
   "out": {
    "military-science-pack": 0.25
   }
  },
  "production-science-pack": {
   "time": 1.3125,
   "out": {
    "production-science-pack": 0.25
   }
  },
  "utility-science-pack": {
   "time": 1.3125,
   "out": {
    "utility-science-pack": 0.25
   }
  },
  "space-science-pack": {
   "time": 0.9375,
   "out": {
    "space-science-pack": 0.25
   }
  },
  "sulfur": {
   "time": 0.0625,
   "out": {
    "sulfur": 0.25
   }
  },
  "plastic-bar": {
   "time": 0.0625,
   "out": {
    "plastic-bar": 0.25
   }
  },
  "explosives": {
   "time": 0.25,
   "out": {
    "explosives": 0.25
   }
  },
  "uranium-235": {
   "time": 0.03125,
   "out": {
    "uranium-235": 0.25
   }
  },
  "uranium-238": {
   "time": 0.03125,
   "out": {
    "uranium-238": 0.25
   }
  },
  "uranium-fuel-cell": {
   "time": 0.625,
   "out": {
    "uranium-fuel-cell": 0.25
   }
  },
  "depleted-uranium-fuel-cell": {
   "time": 0.03125,
   "out": {
    "depleted-uranium-fuel-cell": 0.25
   }
  },
  "one-way-valve": {
   "time": 0.03125,
   "out": {
    "one-way-valve": 0.25
   }
  },
  "overflow-valve": {
   "time": 0.03125,
   "out": {
    "overflow-valve": 0.25
   }
  },
  "top-up-valve": {
   "time": 0.03125,
   "out": {
    "top-up-valve": 0.25
   }
  },
  "metallurgic-science-pack": {
   "time": 0.625,
   "out": {
    "metallurgic-science-pack": 0.25
   }
  },
  "agricultural-science-pack": {
   "time": 0.25,
   "out": {
    "agricultural-science-pack": 0.25
   }
  },
  "electromagnetic-science-pack": {
   "time": 0.625,
   "out": {
    "electromagnetic-science-pack": 0.25
   }
  },
  "cryogenic-science-pack": {
   "time": 1.25,
   "out": {
    "cryogenic-science-pack": 0.25
   }
  },
  "promethium-science-pack": {
   "time": 0.3125,
   "out": {
    "promethium-science-pack": 0.25
   }
  },
  "metallic-asteroid-chunk": {
   "time": 0.03125,
   "out": {
    "metallic-asteroid-chunk": 0.25
   }
  },
  "carbonic-asteroid-chunk": {
   "time": 0.03125,
   "out": {
    "carbonic-asteroid-chunk": 0.25
   }
  },
  "oxide-asteroid-chunk": {
   "time": 0.03125,
   "out": {
    "oxide-asteroid-chunk": 0.25
   }
  },
  "promethium-asteroid-chunk": {
   "time": 0.03125,
   "out": {
    "promethium-asteroid-chunk": 0.25
   }
  },
  "ice": {
   "time": 0.03125,
   "out": {
    "ice": 0.25
   }
  },
  "carbon": {
   "time": 0.0625,
   "out": {
    "carbon": 0.25
   }
  },
  "calcite": {
   "time": 0.03125,
   "out": {
    "calcite": 0.25
   }
  },
  "tungsten-ore": {
   "time": 0.03125,
   "out": {
    "tungsten-ore": 0.25
   }
  },
  "tungsten-plate": {
   "time": 0.625,
   "out": {
    "tungsten-plate": 0.25
   }
  },
  "tungsten-carbide": {
   "time": 0.0625,
   "out": {
    "tungsten-carbide": 0.25
   }
  },
  "copper-bacteria": {
   "time": 0.0625,
   "out": {
    "copper-bacteria": 0.25
   }
  },
  "iron-bacteria": {
   "time": 0.0625,
   "out": {
    "iron-bacteria": 0.25
   }
  },
  "yumako-seed": {
   "time": 0.03125,
   "out": {
    "yumako-seed": 0.25
   }
  },
  "jellynut-seed": {
   "time": 0.03125,
   "out": {
    "jellynut-seed": 0.25
   }
  },
  "biolab": {
   "time": 0.625,
   "out": {
    "biolab": 0.25
   }
  },
  "captive-biter-spawner": {
   "time": 0.625,
   "out": {
    "captive-biter-spawner": 0.25
   }
  },
  "biter-egg": {
   "time": 0.625,
   "out": {
    "biter-egg": 0.25
   }
  },
  "pentapod-egg": {
   "time": 0.9375,
   "out": {
    "pentapod-egg": 0.25
   }
  },
  "carbon-fiber": {
   "time": 0.3125,
   "out": {
    "carbon-fiber": 0.25
   }
  },
  "holmium-ore": {
   "time": 0.03125,
   "out": {
    "holmium-ore": 0.25
   }
  },
  "holmium-plate": {
   "time": 0.0625,
   "out": {
    "holmium-plate": 0.25
   }
  },
  "lithium": {
   "time": 1.25,
   "out": {
    "lithium": 0.25
   }
  },
  "lithium-plate": {
   "time": 0.4,
   "out": {
    "lithium-plate": 0.25
   }
  },
  "superconductor": {
   "time": 0.3125,
   "out": {
    "superconductor": 0.25
   }
  },
  "fusion-power-cell": {
   "time": 0.625,
   "out": {
    "fusion-power-cell": 0.25
   }
  },
  "spoilage": {
   "time": 0.03125,
   "out": {
    "spoilage": 0.25
   }
  },
  "space-platform-hub": {
   "time": 0.03125,
   "out": {
    "space-platform-hub": 0.25
   }
  },
  "tree-seed": {
   "time": 0.125,
   "out": {
    "tree-seed": 0.25
   }
  },
  "flamethrower-ammo": {
   "time": 0.375,
   "out": {
    "flamethrower-ammo": 0.25
   }
  },
  "raw-fish": {
   "time": 0.03125,
   "out": {
    "raw-fish": 0.25
   }
  },
  "yumako": {
   "time": 0.03125,
   "out": {
    "yumako": 0.25
   }
  },
  "jellynut": {
   "time": 0.03125,
   "out": {
    "jellynut": 0.25
   }
  },
  "yumako-mash": {
   "time": 0.03125,
   "out": {
    "yumako-mash": 0.25
   }
  },
  "jelly": {
   "time": 0.03125,
   "out": {
    "jelly": 0.25
   }
  },
  "bioflux": {
   "time": 0.375,
   "out": {
    "bioflux": 0.25
   }
  },
  "pistol": {
   "time": 0.3125,
   "out": {
    "pistol": 0.25
   }
  }
 }
};
