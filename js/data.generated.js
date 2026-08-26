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
//           heatPipeSpecificHeat, heatPipeMaxTransfer, reactorHeatRate(MW) }, roboportPower(kW)
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
  "iron-gear": 100,
  "iron-stick": 100,
  "copper-cable": 200,
  "green-circuit": 200,
  "science-pack": 200,
  "transport-belt": 100,
  "inserter": 50,
  "burner-inserter": 50,
  "long-inserter": 50,
  "burner-drill": 50,
  "stone-furnace": 50,
  "assembling-machine": 50,
  "storage-chest": 50,
  "lab": 10,
  "lamp": 50,
  "substation": 50,
  "programmable-speaker": 10,
  "splitter": 50,
  "underground": 50,
  "steel-plate": 100,
  "boiler": 50,
  "steam-engine": 10,
  "offshore-pump": 20,
  "electric-drill": 50,
  "electric-furnace": 50,
  "assembling-machine-mk2": 50,
  "fast-transport-belt": 100,
  "fast-underground-belt": 50,
  "express-transport-belt": 100,
  "express-underground-belt": 50,
  "express-splitter": 50,
  "fast-splitter": 50,
  "stack-inserter": 50,
  "fast-inserter": 50,
  "steel-chest": 50,
  "green-science": 200,
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
  "military-science": 200,
  "gun-turret": 50,
  "stone-wall": 100,
  "gate": 50,
  "magazine": 100,
  "piercing-rounds": 100,
  "refinery": 10,
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
  "rocket-ammo": 100,
  "explosive-rocket": 100,
  "flamethrower": 5,
  "flamethrower-ammo": 100,
  "uranium-rounds": 100,
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
  "advanced-circuit": 200,
  "engine-unit": 50,
  "electric-engine": 50,
  "processing-unit": 100,
  "low-density-structure": 50,
  "rocket-fuel": 20,
  "rocket-part": 5,
  "rocket": 100,
  "rocket-silo": 1,
  "radar": 50,
  "explosive": 50,
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
  "sulfur": 50,
  "carbon": 50,
  "roboport": 10,
  "logistic-robot": 50,
  "construction-robot": 50,
  "personal-roboport": 20,
  "personal-roboport-mk2": 20,
  "logistic-chest-passive": 50,
  "logistic-chest-active": 50,
  "logistic-chest-storage": 50,
  "logistic-chest-buffer": 50,
  "logistic-chest-requester": 50,
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
  "small-electric-pole": 50,
  "medium-electric-pole": 50,
  "big-electric-pole": 50,
  "constant-combinator": 50,
  "arithmetic-combinator": 50,
  "decider-combinator": 50,
  "power-switch": 10,
  "red-wire": 1,
  "green-wire": 1,
  "concrete": 100,
  "refined-concrete": 100,
  "hazard-concrete": 100,
  "landfill": 100,
  "modular-armor": 1,
  "power-armor": 1,
  "power-armor-mk2": 1,
  "portable-solar-panel": 20,
  "portable-fusion-reactor": 20,
  "personal-battery": 20,
  "personal-battery-mk2": 20,
  "exoskeleton": 20,
  "nightvision": 20,
  "personal-laser-defense": 20,
  "energy-shield": 20,
  "energy-shield-mk2": 20,
  "belt-immunity-equipment": 20,
  "discharge-defense": 20,
  "wood": 100,
  "wooden-chest": 50,
  "iron-chest": 50,
  "repair-pack": 100,
  "deconstruction-planner": 1,
  "upgrade-planner": 1,
  "space-science-pack": 200,
  "empty-barrel": 10,
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
  "underground": 150,
  "fast-underground-belt": 160,
  "express-underground-belt": 170,
  "splitter": 170,
  "fast-splitter": 180,
  "express-splitter": 190,
  "inserter": 150,
  "burner-inserter": 100,
  "lamp": 100,
  "programmable-speaker": 150,
  "long-inserter": 160,
  "stack-inserter": 160,
  "fast-inserter": 150,
  "burner-drill": 150,
  "stone-furnace": 200,
  "steel-furnace": 300,
  "assembling-machine": 300,
  "assembling-machine-3": 400,
  "beacon": 200,
  "storage-chest": 350,
  "wooden-chest": 100,
  "iron-chest": 200,
  "steel-chest": 350,
  "lab": 150,
  "boiler": 200,
  "steam-engine": 400,
  "offshore-pump": 150,
  "electric-drill": 300,
  "electric-furnace": 350,
  "assembling-machine-mk2": 350,
  "pipe": 100,
  "pipe-to-ground": 150,
  "pump": 180,
  "solar-panel": 200,
  "accumulator": 150,
  "gun-turret": 400,
  "laser-turret": 1000,
  "flamethrower-turret": 1400,
  "rocket-silo": 5000,
  "radar": 250,
  "stone-wall": 350,
  "gate": 350,
  "pumpjack": 200,
  "refinery": 350,
  "chemical-plant": 300,
  "storage-tank": 500,
  "centrifuge": 350,
  "nuclear-reactor": 500,
  "steam-turbine": 300,
  "heat-pipe": 200,
  "heat-exchanger": 200,
  "roboport": 500,
  "locomotive": 1000,
  "cargo-wagon": 600,
  "fluid-wagon": 600,
  "artillery-wagon": 600,
  "train-stop": 250,
  "rail-signal": 100,
  "rail-chain-signal": 100,
  "car": 450,
  "tank": 2000,
  "spidertron": 3000,
  "land-mine": 15,
  "artillery-turret": 2000,
  "logistic-chest-passive": 350,
  "logistic-chest-active": 350,
  "logistic-chest-storage": 350,
  "logistic-chest-requester": 350,
  "logistic-chest-buffer": 350,
  "small-electric-pole": 100,
  "medium-electric-pole": 100,
  "big-electric-pole": 150,
  "constant-combinator": 120,
  "arithmetic-combinator": 150,
  "decider-combinator": 150,
  "power-switch": 200,
  "substation": 200
 },
 "powerUse": {
  "burner-drill": 150,
  "stone-furnace": 90,
  "steel-furnace": 90,
  "assembling-machine": 75,
  "assembling-machine-3": 375,
  "beacon": 480,
  "lab": 60,
  "offshore-pump": 60,
  "electric-drill": 90,
  "electric-furnace": 180,
  "assembling-machine-mk2": 150,
  "pump": 29,
  "rocket-silo": 250,
  "radar": 300,
  "pumpjack": 90,
  "refinery": 420,
  "chemical-plant": 210,
  "centrifuge": 350,
  "roboport": 50
 },
 "deviceStats": {
  "assembling-machine": {
   "craftingSpeed": 0.5
  },
  "assembling-machine-mk2": {
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
  "electric-drill": {
   "moduleSlots": 3,
   "miningSpeed": 0.5
  },
  "burner-drill": {
   "miningSpeed": 0.25
  },
  "pumpjack": {
   "moduleSlots": 2,
   "miningSpeed": 1
  },
  "lab": {
   "moduleSlots": 2
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
  "underground": {
   "beltSpeed": 1.875
  },
  "fast-underground-belt": {
   "beltSpeed": 3.75
  },
  "express-underground-belt": {
   "beltSpeed": 5.625
  },
  "refinery": {
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
  "iron-gear": {
   "time": 0.5,
   "inp": {
    "iron-plate": 2
   },
   "out": {
    "iron-gear": 1
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
  "green-circuit": {
   "time": 0.5,
   "inp": {
    "iron-plate": 1,
    "copper-cable": 3
   },
   "out": {
    "green-circuit": 1
   }
  },
  "science-pack": {
   "time": 5,
   "inp": {
    "copper-plate": 1,
    "iron-gear": 1
   },
   "out": {
    "science-pack": 1
   }
  },
  "transport-belt": {
   "time": 0.5,
   "inp": {
    "iron-plate": 1,
    "iron-gear": 1
   },
   "out": {
    "transport-belt": 2
   }
  },
  "fast-transport-belt": {
   "time": 0.5,
   "inp": {
    "iron-gear": 5,
    "transport-belt": 1
   },
   "out": {
    "fast-transport-belt": 1
   }
  },
  "express-transport-belt": {
   "time": 0.5,
   "inp": {
    "iron-gear": 10,
    "fast-transport-belt": 1,
    "lubricant": 20
   },
   "out": {
    "express-transport-belt": 1
   }
  },
  "underground": {
   "time": 1,
   "inp": {
    "iron-plate": 10,
    "transport-belt": 5
   },
   "out": {
    "underground": 2
   }
  },
  "fast-underground-belt": {
   "time": 2,
   "inp": {
    "iron-gear": 40,
    "underground": 2
   },
   "out": {
    "fast-underground-belt": 2
   }
  },
  "express-underground-belt": {
   "time": 2,
   "inp": {
    "iron-gear": 80,
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
    "green-circuit": 5,
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
    "iron-gear": 10,
    "green-circuit": 10
   },
   "out": {
    "fast-splitter": 1
   }
  },
  "express-splitter": {
   "time": 2,
   "inp": {
    "fast-splitter": 1,
    "iron-gear": 10,
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
    "green-circuit": 1,
    "iron-gear": 1,
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
    "iron-gear": 1
   },
   "out": {
    "burner-inserter": 1
   }
  },
  "long-inserter": {
   "time": 0.5,
   "inp": {
    "iron-gear": 1,
    "iron-plate": 1,
    "inserter": 1
   },
   "out": {
    "long-inserter": 1
   }
  },
  "fast-inserter": {
   "time": 0.5,
   "inp": {
    "green-circuit": 2,
    "iron-plate": 2,
    "inserter": 1
   },
   "out": {
    "fast-inserter": 1
   }
  },
  "burner-drill": {
   "time": 2,
   "inp": {
    "iron-gear": 3,
    "stone-furnace": 1,
    "iron-plate": 3
   },
   "out": {
    "burner-drill": 1
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
  "assembling-machine": {
   "time": 0.5,
   "inp": {
    "green-circuit": 3,
    "iron-gear": 5,
    "iron-plate": 9
   },
   "out": {
    "assembling-machine": 1
   }
  },
  "lab": {
   "time": 2,
   "inp": {
    "green-circuit": 10,
    "iron-gear": 10,
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
    "iron-gear": 8,
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
    "iron-gear": 2
   },
   "out": {
    "offshore-pump": 1
   }
  },
  "electric-drill": {
   "time": 2,
   "inp": {
    "green-circuit": 3,
    "iron-gear": 5,
    "iron-plate": 10
   },
   "out": {
    "electric-drill": 1
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
  "assembling-machine-mk2": {
   "time": 0.5,
   "inp": {
    "steel-plate": 2,
    "green-circuit": 3,
    "iron-gear": 5,
    "assembling-machine": 1
   },
   "out": {
    "assembling-machine-mk2": 1
   }
  },
  "stack-inserter": {
   "time": 0.5,
   "inp": {
    "iron-gear": 15,
    "green-circuit": 15,
    "advanced-circuit": 1,
    "fast-inserter": 1
   },
   "out": {
    "stack-inserter": 1
   }
  },
  "green-science": {
   "time": 6,
   "inp": {
    "inserter": 1,
    "transport-belt": 1
   },
   "out": {
    "green-science": 1
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
    "iron-gear": 10,
    "green-circuit": 5,
    "pipe": 10
   },
   "out": {
    "pumpjack": 1
   }
  },
  "refinery": {
   "time": 8,
   "inp": {
    "steel-plate": 15,
    "iron-gear": 10,
    "stone-brick": 10,
    "green-circuit": 10,
    "pipe": 10
   },
   "out": {
    "refinery": 1
   }
  },
  "chemical-plant": {
   "time": 5,
   "inp": {
    "steel-plate": 5,
    "iron-gear": 5,
    "green-circuit": 5,
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
    "green-circuit": 2,
    "iron-gear": 2
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
    "assembling-machine-mk2": 2,
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
    "green-circuit": 15,
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
  "military-science": {
   "time": 10,
   "inp": {
    "piercing-rounds": 1,
    "grenade": 1,
    "stone-wall": 2
   },
   "out": {
    "military-science": 2
   }
  },
  "flying-robot-frame": {
   "time": 20,
   "inp": {
    "electric-engine": 1,
    "battery": 2,
    "steel-plate": 1,
    "green-circuit": 3
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
    "iron-gear": 10,
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
    "green-circuit": 2
   },
   "out": {
    "gate": 1
   }
  },
  "magazine": {
   "time": 1,
   "inp": {
    "iron-plate": 4
   },
   "out": {
    "magazine": 1
   }
  },
  "piercing-rounds": {
   "time": 6,
   "inp": {
    "magazine": 2,
    "steel-plate": 1,
    "copper-plate": 2
   },
   "out": {
    "piercing-rounds": 2
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
    "green-circuit": 10,
    "steel-plate": 30
   },
   "out": {
    "locomotive": 1
   }
  },
  "cargo-wagon": {
   "time": 1,
   "inp": {
    "iron-gear": 10,
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
    "iron-gear": 10,
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
    "green-circuit": 5,
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
    "green-circuit": 1,
    "iron-plate": 5
   },
   "out": {
    "rail-signal": 1
   }
  },
  "rail-chain-signal": {
   "time": 0.5,
   "inp": {
    "green-circuit": 1,
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
    "iron-gear": 15,
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
    "explosive": 1
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
    "explosive": 2
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
    "explosive": 2
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
    "iron-gear": 10,
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
    "iron-gear": 5,
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
    "iron-gear": 5,
    "green-circuit": 5
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
    "explosive": 5,
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
    "iron-gear": 5,
    "copper-plate": 10,
    "wood": 10
   },
   "out": {
    "combat-shotgun": 1
   }
  },
  "rocket-ammo": {
   "time": 4,
   "inp": {
    "explosive": 1,
    "iron-plate": 2
   },
   "out": {
    "rocket-ammo": 1
   }
  },
  "explosive-rocket": {
   "time": 8,
   "inp": {
    "rocket-ammo": 1,
    "explosive": 2
   },
   "out": {
    "explosive-rocket": 1
   }
  },
  "atomic-bomb": {
   "time": 50,
   "inp": {
    "processing-unit": 10,
    "explosive": 10,
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
    "iron-gear": 10
   },
   "out": {
    "flamethrower": 1
   }
  },
  "uranium-rounds": {
   "time": 10,
   "inp": {
    "piercing-rounds": 1,
    "uranium-238": 1
   },
   "out": {
    "uranium-rounds": 1
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
    "green-circuit": 3,
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
    "green-circuit": 2,
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
    "green-circuit": 20,
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
    "iron-gear": 15,
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
    "green-circuit": 5
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
    "green-circuit": 5
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
    "green-circuit": 5
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
  "beacon": {
   "time": 15,
   "inp": {
    "green-circuit": 20,
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
    "green-circuit": 2,
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
    "iron-gear": 1,
    "pipe": 2
   },
   "out": {
    "engine-unit": 1
   }
  },
  "electric-engine": {
   "time": 10,
   "inp": {
    "engine-unit": 1,
    "lubricant": 15,
    "green-circuit": 2
   },
   "out": {
    "electric-engine": 1
   }
  },
  "processing-unit": {
   "time": 10,
   "inp": {
    "green-circuit": 20,
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
    "electric-engine": 200
   },
   "out": {
    "rocket-silo": 1
   }
  },
  "radar": {
   "time": 0.5,
   "inp": {
    "green-circuit": 5,
    "iron-gear": 5,
    "iron-plate": 10
   },
   "out": {
    "radar": 1
   }
  },
  "explosive": {
   "time": 4,
   "inp": {
    "sulfur": 1,
    "coal": 1,
    "water": 10
   },
   "out": {
    "explosive": 2
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
    "piercing-rounds": 3,
    "green-circuit": 3,
    "iron-gear": 3
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
    "iron-gear": 45,
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
    "green-circuit": 2
   },
   "out": {
    "construction-robot": 1
   }
  },
  "personal-roboport": {
   "time": 10,
   "inp": {
    "advanced-circuit": 10,
    "iron-gear": 40,
    "steel-plate": 20,
    "battery": 45
   },
   "out": {
    "personal-roboport": 1
   }
  },
  "logistic-chest-passive": {
   "time": 0.5,
   "inp": {
    "steel-chest": 1,
    "green-circuit": 3,
    "advanced-circuit": 1
   },
   "out": {
    "logistic-chest-passive": 1
   }
  },
  "logistic-chest-active": {
   "time": 0.5,
   "inp": {
    "steel-chest": 1,
    "green-circuit": 3,
    "advanced-circuit": 1
   },
   "out": {
    "logistic-chest-active": 1
   }
  },
  "logistic-chest-storage": {
   "time": 0.5,
   "inp": {
    "steel-chest": 1,
    "green-circuit": 3,
    "advanced-circuit": 1
   },
   "out": {
    "logistic-chest-storage": 1
   }
  },
  "logistic-chest-requester": {
   "time": 0.5,
   "inp": {
    "steel-chest": 1,
    "green-circuit": 3,
    "advanced-circuit": 1
   },
   "out": {
    "logistic-chest-requester": 1
   }
  },
  "logistic-chest-buffer": {
   "time": 0.5,
   "inp": {
    "steel-chest": 1,
    "green-circuit": 3,
    "advanced-circuit": 1
   },
   "out": {
    "logistic-chest-buffer": 1
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
    "iron-gear": 100
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
    "iron-gear": 50,
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
    "green-circuit": 4
   },
   "out": {
    "programmable-speaker": 1
   }
  },
  "lamp": {
   "time": 0.5,
   "inp": {
    "green-circuit": 1,
    "copper-cable": 3,
    "iron-plate": 1
   },
   "out": {
    "lamp": 1
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
    "green-circuit": 2
   },
   "out": {
    "constant-combinator": 1
   }
  },
  "arithmetic-combinator": {
   "time": 0.5,
   "inp": {
    "copper-cable": 5,
    "green-circuit": 5
   },
   "out": {
    "arithmetic-combinator": 1
   }
  },
  "decider-combinator": {
   "time": 0.5,
   "inp": {
    "copper-cable": 5,
    "green-circuit": 5
   },
   "out": {
    "decider-combinator": 1
   }
  },
  "power-switch": {
   "time": 2,
   "inp": {
    "iron-plate": 5,
    "copper-cable": 5,
    "green-circuit": 2
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
    "electric-engine": 20,
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
    "electric-engine": 40,
    "low-density-structure": 30
   },
   "out": {
    "power-armor-mk2": 1
   }
  },
  "portable-solar-panel": {
   "time": 10,
   "inp": {
    "solar-panel": 1,
    "advanced-circuit": 2,
    "steel-plate": 5
   },
   "out": {
    "portable-solar-panel": 1
   }
  },
  "personal-battery": {
   "time": 10,
   "inp": {
    "battery": 5,
    "steel-plate": 10
   },
   "out": {
    "personal-battery": 1
   }
  },
  "personal-battery-mk2": {
   "time": 10,
   "inp": {
    "personal-battery": 10,
    "processing-unit": 15,
    "low-density-structure": 5
   },
   "out": {
    "personal-battery-mk2": 1
   }
  },
  "exoskeleton": {
   "time": 10,
   "inp": {
    "processing-unit": 10,
    "electric-engine": 30,
    "steel-plate": 20
   },
   "out": {
    "exoskeleton": 1
   }
  },
  "nightvision": {
   "time": 10,
   "inp": {
    "advanced-circuit": 5,
    "steel-plate": 10
   },
   "out": {
    "nightvision": 1
   }
  },
  "personal-laser-defense": {
   "time": 10,
   "inp": {
    "processing-unit": 20,
    "low-density-structure": 5,
    "laser-turret": 5
   },
   "out": {
    "personal-laser-defense": 1
   }
  },
  "energy-shield": {
   "time": 10,
   "inp": {
    "advanced-circuit": 5,
    "steel-plate": 10
   },
   "out": {
    "energy-shield": 1
   }
  },
  "energy-shield-mk2": {
   "time": 10,
   "inp": {
    "energy-shield": 10,
    "processing-unit": 5,
    "low-density-structure": 5
   },
   "out": {
    "energy-shield-mk2": 1
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
  "discharge-defense": {
   "time": 10,
   "inp": {
    "processing-unit": 5,
    "steel-plate": 20,
    "laser-turret": 10
   },
   "out": {
    "discharge-defense": 1
   }
  }
 },
 "recipeDevice": {
  "steel-plate": "assembling-machine",
  "iron-gear": "assembling-machine",
  "iron-stick": "assembling-machine",
  "copper-cable": "assembling-machine",
  "green-circuit": "assembling-machine",
  "science-pack": "assembling-machine",
  "transport-belt": "assembling-machine",
  "fast-transport-belt": "assembling-machine",
  "express-transport-belt": "assembling-machine",
  "underground": "assembling-machine",
  "fast-underground-belt": "assembling-machine",
  "express-underground-belt": "assembling-machine",
  "splitter": "assembling-machine",
  "fast-splitter": "assembling-machine",
  "express-splitter": "assembling-machine",
  "inserter": "assembling-machine",
  "burner-inserter": "assembling-machine",
  "long-inserter": "assembling-machine",
  "fast-inserter": "assembling-machine",
  "burner-drill": "assembling-machine",
  "stone-furnace": "assembling-machine",
  "assembling-machine": "assembling-machine",
  "lab": "assembling-machine",
  "boiler": "assembling-machine",
  "steam-engine": "assembling-machine",
  "offshore-pump": "assembling-machine",
  "electric-drill": "assembling-machine",
  "electric-furnace": "assembling-machine",
  "assembling-machine-mk2": "assembling-machine",
  "stack-inserter": "assembling-machine",
  "green-science": "assembling-machine",
  "pipe": "assembling-machine",
  "pumpjack": "assembling-machine",
  "refinery": "assembling-machine",
  "chemical-plant": "assembling-machine",
  "storage-tank": "assembling-machine",
  "steel-chest": "assembling-machine",
  "wooden-chest": "assembling-machine",
  "iron-chest": "assembling-machine",
  "repair-pack": "assembling-machine",
  "steel-furnace": "assembling-machine",
  "assembling-machine-3": "assembling-machine",
  "pipe-to-ground": "assembling-machine",
  "pump": "assembling-machine",
  "solar-panel": "assembling-machine",
  "accumulator": "assembling-machine",
  "military-science": "assembling-machine",
  "flying-robot-frame": "assembling-machine",
  "production-science-pack": "assembling-machine",
  "utility-science-pack": "assembling-machine",
  "gun-turret": "assembling-machine",
  "stone-wall": "assembling-machine",
  "gate": "assembling-machine",
  "magazine": "assembling-machine",
  "piercing-rounds": "assembling-machine",
  "plastic-bar": "chemical-plant",
  "crack-light": "chemical-plant",
  "crack-gas": "chemical-plant",
  "lubricant": "chemical-plant",
  "solid-fuel": "chemical-plant",
  "solid-fuel-light-oil": "chemical-plant",
  "solid-fuel-heavy-oil": "chemical-plant",
  "rail": "assembling-machine",
  "locomotive": "assembling-machine",
  "cargo-wagon": "assembling-machine",
  "fluid-wagon": "assembling-machine",
  "train-stop": "assembling-machine",
  "rail-signal": "assembling-machine",
  "rail-chain-signal": "assembling-machine",
  "car": "assembling-machine",
  "tank": "assembling-machine",
  "cannon-shell": "assembling-machine",
  "explosive-cannon-shell": "assembling-machine",
  "explosive-uranium-cannon-shell": "assembling-machine",
  "light-armor": "assembling-machine",
  "heavy-armor": "assembling-machine",
  "land-mine": "assembling-machine",
  "pistol": "assembling-machine",
  "submachine-gun": "assembling-machine",
  "shotgun": "assembling-machine",
  "rocket-launcher": "assembling-machine",
  "grenade": "assembling-machine",
  "cluster-grenade": "assembling-machine",
  "shotgun-shell": "assembling-machine",
  "piercing-shotgun-shell": "assembling-machine",
  "combat-shotgun": "assembling-machine",
  "rocket-ammo": "assembling-machine",
  "explosive-rocket": "assembling-machine",
  "atomic-bomb": "assembling-machine",
  "flamethrower": "assembling-machine",
  "uranium-rounds": "assembling-machine",
  "uranium-cannon-shell": "assembling-machine",
  "poison-capsule": "assembling-machine",
  "slowdown-capsule": "assembling-machine",
  "flamethrower-ammo": "chemical-plant",
  "laser-turret": "assembling-machine",
  "flamethrower-turret": "assembling-machine",
  "speed-module": "assembling-machine",
  "speed-module-2": "assembling-machine",
  "productivity-module": "assembling-machine",
  "productivity-module-2": "assembling-machine",
  "efficiency-module": "assembling-machine",
  "efficiency-module-2": "assembling-machine",
  "beacon": "assembling-machine",
  "advanced-circuit": "assembling-machine",
  "engine-unit": "assembling-machine",
  "electric-engine": "assembling-machine",
  "processing-unit": "assembling-machine",
  "low-density-structure": "assembling-machine",
  "rocket-fuel": "assembling-machine",
  "rocket-silo": "assembling-machine",
  "radar": "assembling-machine",
  "explosive": "chemical-plant",
  "battery": "chemical-plant",
  "sulfur": "chemical-plant",
  "carbon": "chemical-plant",
  "sulfuric-acid": "chemical-plant",
  "defender-capsule": "assembling-machine",
  "distractor-capsule": "assembling-machine",
  "destroyer-capsule": "assembling-machine",
  "roboport": "assembling-machine",
  "logistic-robot": "assembling-machine",
  "construction-robot": "assembling-machine",
  "personal-roboport": "assembling-machine",
  "logistic-chest-passive": "assembling-machine",
  "logistic-chest-active": "assembling-machine",
  "logistic-chest-storage": "assembling-machine",
  "logistic-chest-requester": "assembling-machine",
  "logistic-chest-buffer": "assembling-machine",
  "kovarex": "centrifuge",
  "nuclear-fuel": "centrifuge",
  "uranium-fuel-cell": "assembling-machine",
  "centrifuge": "assembling-machine",
  "nuclear-reactor": "assembling-machine",
  "steam-turbine": "assembling-machine",
  "heat-pipe": "assembling-machine",
  "heat-exchanger": "assembling-machine",
  "small-electric-pole": "assembling-machine",
  "substation": "assembling-machine",
  "programmable-speaker": "assembling-machine",
  "lamp": "assembling-machine",
  "medium-electric-pole": "assembling-machine",
  "big-electric-pole": "assembling-machine",
  "constant-combinator": "assembling-machine",
  "arithmetic-combinator": "assembling-machine",
  "decider-combinator": "assembling-machine",
  "power-switch": "assembling-machine",
  "concrete": "assembling-machine",
  "refined-concrete": "assembling-machine",
  "hazard-concrete": "assembling-machine",
  "landfill": "assembling-machine",
  "modular-armor": "assembling-machine",
  "power-armor": "assembling-machine",
  "power-armor-mk2": "assembling-machine",
  "portable-solar-panel": "assembling-machine",
  "personal-battery": "assembling-machine",
  "personal-battery-mk2": "assembling-machine",
  "exoskeleton": "assembling-machine",
  "nightvision": "assembling-machine",
  "personal-laser-defense": "assembling-machine",
  "energy-shield": "assembling-machine",
  "energy-shield-mk2": "assembling-machine",
  "belt-immunity-equipment": "assembling-machine",
  "discharge-defense": "assembling-machine"
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
  "iron-gear": {
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
  "green-circuit": {
   "zh": "电路板",
   "en": "Electronic circuit"
  },
  "science-pack": {
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
  "long-inserter": {
   "zh": "加长机械臂",
   "en": "Long-handed inserter"
  },
  "burner-drill": {
   "zh": "热能采矿机",
   "en": "Burner mining drill"
  },
  "stone-furnace": {
   "zh": "石炉",
   "en": "Stone furnace"
  },
  "assembling-machine": {
   "zh": "组装机1型",
   "en": "Assembling machine 1"
  },
  "storage-chest": {
   "zh": "被动存货箱（黄箱）",
   "en": "Storage chest"
  },
  "lab": {
   "zh": "研究中心",
   "en": "Lab"
  },
  "lamp": {
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
  "underground": {
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
  "electric-drill": {
   "zh": "电力采矿机",
   "en": "Electric mining drill"
  },
  "electric-furnace": {
   "zh": "电炉",
   "en": "Electric furnace"
  },
  "assembling-machine-mk2": {
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
  "fast-splitter": {
   "zh": "高速分流器",
   "en": "Fast splitter"
  },
  "stack-inserter": {
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
  "green-science": {
   "zh": "物流科技包（绿瓶）",
   "en": "Logistic science pack"
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
  "military-science": {
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
  "magazine": {
   "zh": "标准弹匣",
   "en": "Firearm magazine"
  },
  "piercing-rounds": {
   "zh": "穿甲弹匣",
   "en": "Piercing rounds magazine"
  },
  "refinery": {
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
  "rocket-ammo": {
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
  "uranium-rounds": {
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
  "advanced-circuit": {
   "zh": "集成电路",
   "en": "Advanced circuit"
  },
  "engine-unit": {
   "zh": "内燃机",
   "en": "Engine unit"
  },
  "electric-engine": {
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
  "rocket": {
   "zh": "火箭弹",
   "en": "Rocket"
  },
  "satellite": {
   "zh": "卫星",
   "en": "Satellite"
  },
  "rocket-silo": {
   "zh": "火箭发射井",
   "en": "Rocket silo"
  },
  "radar": {
   "zh": "雷达",
   "en": "Radar"
  },
  "explosive": {
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
  "logistic-chest-passive": {
   "zh": "被动供货箱（红箱）",
   "en": "Passive provider chest"
  },
  "logistic-chest-active": {
   "zh": "主动供货箱（紫箱）",
   "en": "Active provider chest"
  },
  "logistic-chest-storage": {
   "zh": "被动存货箱（黄箱）",
   "en": "Storage chest"
  },
  "logistic-chest-buffer": {
   "zh": "主动存货箱（绿箱）",
   "en": "Buffer chest"
  },
  "logistic-chest-requester": {
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
  "belt-immunity-equipment": {
   "zh": "锚定模块",
   "en": "Belt immunity equipment"
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
  "empty-barrel": {
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
  "underground": 5,
  "fast-underground-belt": 7,
  "express-underground-belt": 9
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
  "magazine": 5,
  "piercing-rounds": 8,
  "uranium-rounds": 24
 },
 "radar": {
  "range": 14,
  "power": 300
 },
 "equipment": {
  "portable-solar-panel": {
   "powerOut": 30
  },
  "portable-fusion-reactor": {
   "powerOut": 2500
  },
  "personal-battery": {
   "powerCap": 20000
  },
  "personal-battery-mk2": {
   "powerCap": 100000
  },
  "energy-shield": {
   "shield": 50
  },
  "energy-shield-mk2": {
   "shield": 150
  },
  "exoskeleton": {
   "speed": 0.3
  },
  "personal-laser-defense": {
   "laser": 15
  },
  "discharge-defense": {
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
  "reactorHeatRate": 40
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
  "underground": {
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
  "long-inserter": {
   "w": 1,
   "h": 1
  },
  "fast-inserter": {
   "w": 1,
   "h": 1
  },
  "stack-inserter": {
   "w": 1,
   "h": 1
  },
  "burner-drill": {
   "w": 2,
   "h": 2
  },
  "electric-drill": {
   "w": 3,
   "h": 3
  },
  "pumpjack": {
   "w": 3,
   "h": 3
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
  "assembling-machine": {
   "w": 3,
   "h": 3
  },
  "assembling-machine-mk2": {
   "w": 3,
   "h": 3
  },
  "assembling-machine-3": {
   "w": 3,
   "h": 3
  },
  "refinery": {
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
   "long-inserter": {
    "rotationSpeed": 0.02,
    "extensionSpeed": 0.05
   },
   "fast-inserter": {
    "rotationSpeed": 0.04,
    "extensionSpeed": 0.1
   },
   "stack-inserter": {
    "rotationSpeed": 0.04,
    "extensionSpeed": 0.1
   },
   "burner-inserter": {
    "rotationSpeed": 0.013,
    "extensionSpeed": 0.035
   }
  }
 }
};
