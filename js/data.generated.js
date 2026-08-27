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
//   其余设备行为参数（官方接入，见对应设备文件 GAME_DATA.xxx?.[..] ?? 兜底）：
//   undergroundDist[带] = 地下带最大距离(格), renewable = { solarPower, accumCap, accumChargeRate }
//   fluidCapacity = { storageTank, fluidWagon, pumpRate, pipeVolume, pipeToGroundVolume }, beaconRange = 信号塔半径(格)
//   turret[塔] = { range, fireRate(秒) }, ammoDamage[弹药] = 伤害, radar = { range, power(kW) }
//   equipment[装备] = { powerOut | powerCap(kJ) | shield | speed | laser | dischargeRange/Cooldown }
//   heat = { reactorMaxTemp, reactorSpecificHeat, reactorMaxTransfer, heatPipeMaxTemp, heatPipeMinGlowTemp,
//           heatPipeSpecificHeat, heatPipeMaxTransfer, reactorHeatRate(MW),
//           heatingTowerRate(MW), heatingTowerEffectivity, heatingTowerMaxTemp,
//           heatingTowerSpecificHeat, heatingTowerMaxTransfer }, roboportPower(kW)
//   footprint[building] = { w, h }（占地面积格数，官方 selection_box）
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
  "fast-splitter": 50,
  "bulk-inserter": 50,
  "fast-inserter": 50,
  "steel-chest": 50,
  "logistic-science-pack": 200,
  "chemical-science-pack": 200,
  "plastic-bar": 100,
  "pipe": 100,
  "pipe-to-ground": 50,
  "pump": 50,
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
  "crusher": 10,
  "metallic-asteroid-chunk": 1,
  "carbonic-asteroid-chunk": 1,
  "oxide-asteroid-chunk": 1,
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
  "wood": 100,
  "wooden-chest": 50,
  "iron-chest": 50,
  "repair-pack": 100,
  "deconstruction-planner": 1,
  "upgrade-planner": 1,
  "space-science-pack": 200,
  "barrel": 10,
  "water-barrel": 10,
  "crude-oil-barrel": 10,
  "heavy-oil-barrel": 10,
  "light-oil-barrel": 10,
  "petroleum-gas-barrel": 10,
  "lubricant-barrel": 10,
  "sulfuric-acid-barrel": 10
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
  "inserter": 150,
  "burner-inserter": 100,
  "small-lamp": 100,
  "programmable-speaker": 150,
  "long-handed-inserter": 160,
  "bulk-inserter": 160,
  "fast-inserter": 150,
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
  "beacon": 200,
  "wooden-chest": 100,
  "iron-chest": 200,
  "steel-chest": 350,
  "lab": 150,
  "biolab": 350,
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
  "solar-panel": 200,
  "accumulator": 150,
  "gun-turret": 400,
  "laser-turret": 1000,
  "flamethrower-turret": 1400,
  "rocket-silo": 5000,
  "cargo-landing-pad": 1000,
  "cargo-bay": 1000,
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
  "beacon": 480,
  "lab": 60,
  "biolab": 300,
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
   "craftingSpeed": 0.5
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
  "electric-furnace": "assembling-machine-1",
  "assembling-machine-2": "assembling-machine-1",
  "bulk-inserter": "assembling-machine-1",
  "logistic-science-pack": "assembling-machine-1",
  "pipe": "assembling-machine-1",
  "pumpjack": "assembling-machine-1",
  "oil-refinery": "assembling-machine-1",
  "chemical-plant": "assembling-machine-1",
  "storage-tank": "assembling-machine-1",
  "steel-chest": "assembling-machine-1",
  "wooden-chest": "assembling-machine-1",
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
  "train-stop": "assembling-machine-1",
  "rail-signal": "assembling-machine-1",
  "rail-chain-signal": "assembling-machine-1",
  "car": "assembling-machine-1",
  "tank": "assembling-machine-1",
  "cannon-shell": "assembling-machine-1",
  "explosive-cannon-shell": "assembling-machine-1",
  "explosive-uranium-cannon-shell": "assembling-machine-1",
  "light-armor": "assembling-machine-1",
  "heavy-armor": "assembling-machine-1",
  "land-mine": "assembling-machine-1",
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
  "productivity-module": "assembling-machine-1",
  "productivity-module-2": "assembling-machine-1",
  "efficiency-module": "assembling-machine-1",
  "efficiency-module-2": "assembling-machine-1",
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
  "recycler": "assembling-machine-1",
  "artificial-yumako-soil": "assembling-machine-1",
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
  "lightning-rod": "assembling-machine-1",
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
  "modular-armor": "assembling-machine-1",
  "power-armor": "assembling-machine-1",
  "power-armor-mk2": "assembling-machine-1",
  "solar-panel-equipment": "assembling-machine-1",
  "battery-equipment": "assembling-machine-1",
  "battery-mk2-equipment": "assembling-machine-1",
  "exoskeleton-equipment": "assembling-machine-1",
  "night-vision-equipment": "assembling-machine-1",
  "personal-laser-defense-equipment": "assembling-machine-1",
  "energy-shield-equipment": "assembling-machine-1",
  "energy-shield-mk2-equipment": "assembling-machine-1",
  "belt-immunity-equipment": "assembling-machine-1",
  "discharge-defense-equipment": "assembling-machine-1"
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
  "fast-splitter": {
   "zh": "高速分流器",
   "en": "Fast splitter"
  },
  "bulk-inserter": {
   "zh": "集装机械臂",
   "en": "Bulk inserter"
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
  "nutrients-from-bioflux": {
   "zh": "生物结晶制营养素",
   "en": "Nutrients from bioflux"
  },
  "biosulfur": {
   "zh": "生物硫磺",
   "en": "Biosulfur"
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
   "fireRate": 0.1
  },
  "laser-turret": {
   "range": 24,
   "fireRate": 0.667
  },
  "flamethrower-turret": {
   "range": 30,
   "fireRate": 0.067
  }
 },
 "ammoDamage": {
  "firearm-magazine": 5,
  "piercing-rounds-magazine": 8,
  "uranium-rounds-magazine": 24
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
  "cargo-landing-pad": {
   "w": 8,
   "h": 8
  },
  "cargo-bay": {
   "w": 4,
   "h": 4
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
    "extensionSpeed": 0.035
   },
   "long-handed-inserter": {
    "rotationSpeed": 0.02,
    "extensionSpeed": 0.05
   },
   "fast-inserter": {
    "rotationSpeed": 0.04,
    "extensionSpeed": 0.1
   },
   "bulk-inserter": {
    "rotationSpeed": 0.04,
    "extensionSpeed": 0.1
   },
   "burner-inserter": {
    "rotationSpeed": 0.013,
    "extensionSpeed": 0.035
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
 ]
};
