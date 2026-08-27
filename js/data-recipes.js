'use strict';

const RECIPES = {
  'steel-plate':        { time: 16,  inp: { 'iron-plate': 5 },                                   out: { 'steel-plate': 1 } },
  'iron-gear-wheel':          { time: 0.5, inp: { 'iron-plate': 2 },                                   out: { 'iron-gear-wheel': 1 } },
  'iron-stick':         { time: 0.5, inp: { 'iron-plate': 1 },                                   out: { 'iron-stick': 2 } },
  'copper-cable':       { time: 0.5, inp: { 'copper-plate': 1 },                                 out: { 'copper-cable': 2 } },
  'electronic-circuit':      { time: 0.5, inp: { 'iron-plate': 1, 'copper-cable': 3 },                out: { 'electronic-circuit': 1 } },
  'automation-science-pack':       { time: 5,   inp: { 'copper-plate': 1, 'iron-gear-wheel': 1 },                 out: { 'automation-science-pack': 1 } },
  'transport-belt':     { time: 0.5, inp: { 'iron-plate': 1, 'iron-gear-wheel': 1 },                   out: { 'transport-belt': 2 } },
  'fast-transport-belt':        { time: 0.5, inp: { 'iron-gear-wheel': 5, 'transport-belt': 1 }, out: { 'fast-transport-belt': 1 } },
  'express-transport-belt':        { time: 0.5, inp: { 'fast-transport-belt': 1, 'iron-gear-wheel': 10, 'lubricant': 20 }, out: { 'express-transport-belt': 1 } },
  'underground-belt':        { time: 1, inp: { 'iron-plate': 10, 'transport-belt': 5 }, out: { 'underground-belt': 2 } },
  'fast-underground-belt':        { time: 2, inp: { 'iron-gear-wheel': 40, 'underground-belt': 2 }, out: { 'fast-underground-belt': 2 } },
  'express-underground-belt':        { time: 2, inp: { 'fast-underground-belt': 2, 'iron-gear-wheel': 80, 'lubricant': 40 }, out: { 'express-underground-belt': 2 } },
  'splitter':        { time: 1, inp: { 'electronic-circuit': 5, 'iron-plate': 5, 'transport-belt': 4 }, out: { 'splitter': 1 } },
  'fast-splitter':        { time: 2, inp: { 'electronic-circuit': 10, 'iron-gear-wheel': 10, 'splitter': 1 }, out: { 'fast-splitter': 1 } },
  'express-splitter':        { time: 2, inp: { 'advanced-circuit': 10, 'fast-splitter': 1, 'iron-gear-wheel': 10, 'lubricant': 80 }, out: { 'express-splitter': 1 } },
  // ===== 超速物流（太空时代 Space Age 4 档带，对齐《异星工厂》Turbo belt）=====
  // 官方配方依赖钨板(tungsten-plate，Vulcanus 资源)，项目尚未实现行星系统，
  // 故适配为可用高级材料（钢板+高级电路+塑料等）合成，产出物/耗时参考官方。
  'turbo-transport-belt': { time: 0.5, inp: { 'express-transport-belt': 1, 'steel-plate': 5, 'plastic-bar': 5, 'lubricant': 20 }, out: { 'turbo-transport-belt': 1 } },
  'turbo-underground-belt': { time: 2, inp: { 'express-underground-belt': 2, 'steel-plate': 40, 'plastic-bar': 20, 'lubricant': 40 }, out: { 'turbo-underground-belt': 2 } },
  'turbo-splitter':        { time: 2, inp: { 'express-splitter': 1, 'steel-plate': 15, 'processing-unit': 2, 'lubricant': 80 }, out: { 'turbo-splitter': 1 } },
  'inserter':           { time: 0.5, inp: { 'iron-plate': 1, 'iron-gear-wheel': 1, 'electronic-circuit': 1 }, out: { 'inserter': 1 } },
  'burner-inserter':    { time: 0.5, inp: { 'iron-plate': 1, 'iron-gear-wheel': 1 },                  out: { 'burner-inserter': 1 } },
  'long-handed-inserter':      { time: 0.5, inp: { 'inserter': 1, 'iron-gear-wheel': 1 },                             out: { 'long-handed-inserter': 1 } },
  'fast-inserter':        { time: 0.5, inp: { 'electronic-circuit': 2, 'inserter': 1, 'iron-plate': 2 }, out: { 'fast-inserter': 1 } },
  'burner-mining-drill':        { time: 2, inp: { 'iron-gear-wheel': 3, 'iron-plate': 3, 'stone-furnace': 1 }, out: { 'burner-mining-drill': 1 } },
  'stone-furnace':      { time: 0.5, inp: { 'stone': 5 },                                        out: { 'stone-furnace': 1 } },
  'assembling-machine-1':        { time: 0.5, inp: { 'electronic-circuit': 3, 'iron-gear-wheel': 5, 'iron-plate': 9 }, out: { 'assembling-machine-1': 1 } },
  'lab':        { time: 2, inp: { 'electronic-circuit': 10, 'iron-gear-wheel': 10, 'transport-belt': 4 }, out: { 'lab': 1 } },
  'biolab':        { time: 10, inp: { 'lab': 1, 'bioflux': 10, 'refined-concrete': 25, 'uranium-235': 3 }, out: { 'biolab': 1 } },  // 太空时代生物实验室（官方配方依赖 biter-egg/capture-robot-rocket=生物星球资源，适配为项目现有生物链资源；耗时 10s 参考官方）
  'boiler':        { time: 0.5, inp: { 'pipe': 4, 'stone-furnace': 1 }, out: { 'boiler': 1 } },
  'steam-engine':        { time: 0.5, inp: { 'iron-gear-wheel': 8, 'iron-plate': 10, 'pipe': 5 }, out: { 'steam-engine': 1 } },
  'offshore-pump':        { time: 0.5, inp: { 'iron-gear-wheel': 2, 'pipe': 3 }, out: { 'offshore-pump': 1 } },
  'electric-mining-drill':        { time: 2, inp: { 'electronic-circuit': 3, 'iron-gear-wheel': 5, 'iron-plate': 10 }, out: { 'electric-mining-drill': 1 } },
  'big-mining-drill':        { time: 30, inp: { 'electric-mining-drill': 1, 'advanced-circuit': 10, 'electric-engine-unit': 10, 'steel-plate': 50, 'refined-concrete': 20 }, out: { 'big-mining-drill': 1 } },  // 太空时代大型采矿机（官方配方依赖熔融铁/钨碳化物=行星资源，适配为基础资源；产出物/耗时 30s 参考官方）
  'electric-furnace':        { time: 5, inp: { 'advanced-circuit': 5, 'steel-plate': 10, 'stone-brick': 10 }, out: { 'electric-furnace': 1 } },
  'assembling-machine-2':        { time: 0.5, inp: { 'assembling-machine-1': 1, 'electronic-circuit': 3, 'iron-gear-wheel': 5, 'steel-plate': 2 }, out: { 'assembling-machine-2': 1 } },
  'bulk-inserter':        { time: 0.5, inp: { 'processing-unit': 1 }, out: { 'bulk-inserter': 1 } },
  'logistic-science-pack':     { time: 6,   inp: { 'transport-belt': 1, 'inserter': 1 },                  out: { 'logistic-science-pack': 1 } },  // 对齐《异星工厂》物流科学包：1传送带+1机械臂，耗时 6s
  'chemical-science-pack':      { time: 8,   inp: { 'plastic-bar': 2, 'electronic-circuit': 2, 'copper-plate': 1 }, out: { 'chemical-science-pack': 1 } },  // 项目为保持科技树无环采用旧版配方（见 README）
  'pipe':              { time: 0.5, inp: { 'iron-plate': 1 },                                     out: { 'pipe': 1 } },
  'pumpjack':        { time: 5, inp: { 'electronic-circuit': 5, 'iron-gear-wheel': 10, 'pipe': 10, 'steel-plate': 5 }, out: { 'pumpjack': 1 } },
  'oil-refinery':        { time: 8, inp: { 'electronic-circuit': 10, 'iron-gear-wheel': 10, 'pipe': 10, 'steel-plate': 15, 'stone-brick': 10 }, out: { 'oil-refinery': 1 } },
  'chemical-plant':        { time: 5, inp: { 'electronic-circuit': 5, 'iron-gear-wheel': 5, 'pipe': 5, 'steel-plate': 5 }, out: { 'chemical-plant': 1 } },
  'storage-tank':        { time: 3, inp: { 'iron-plate': 20, 'steel-plate': 5 }, out: { 'storage-tank': 1 } },
  'steel-chest':        { time: 0.5, inp: { 'steel-plate': 8 }, out: { 'steel-chest': 1 } },
  // ===== 基础储物箱（木箱→铁箱→钢箱递进，对齐《异星工厂》） =====
  'wooden-chest':     { time: 0.5, inp: { 'wood': 2 }, out: { 'wooden-chest': 1 } },
  'iron-chest':        { time: 0.5, inp: { 'iron-plate': 8 }, out: { 'iron-chest': 1 } },
  // ===== 钓鱼竿（对齐《异星工厂》Fishing pole：1 木材 + 1 铁杆 → 1 鱼竿，需「钓鱼」科技） =====
  // ===== 修理包（对齐《异星工厂》Repair pack） =====
  'repair-pack':        { time: 0.5, inp: { 'electronic-circuit': 2, 'iron-gear-wheel': 2 }, out: { 'repair-pack': 1 } },
  // ===== 开采工具配方（对齐《异星工厂》Iron axe / Steel axe） =====
  // ===== 规划器配方（对齐《异星工厂》Deconstruction planner / Upgrade planner） =====
  'deconstruction-planner': { time: 1, inp: { 'iron-plate': 1 }, out: { 'deconstruction-planner': 1 } },
  'upgrade-planner': { time: 1, inp: { 'iron-plate': 1, 'electronic-circuit': 1 }, out: { 'upgrade-planner': 1 } },
  'steel-furnace':        { time: 3, inp: { 'steel-plate': 6, 'stone-brick': 10 }, out: { 'steel-furnace': 1 } },
  'assembling-machine-3':        { time: 0.5, inp: { 'assembling-machine-2': 2, 'speed-module': 4 }, out: { 'assembling-machine-3': 1 } },
  'pipe-to-ground':        { time: 0.5, inp: { 'iron-plate': 5, 'pipe': 10 }, out: { 'pipe-to-ground': 2 } },
  'pump':        { time: 2, inp: { 'engine-unit': 1, 'pipe': 1, 'steel-plate': 1 }, out: { 'pump': 1 } },
  'solar-panel':        { time: 10, inp: { 'copper-plate': 5, 'electronic-circuit': 15, 'steel-plate': 5 }, out: { 'solar-panel': 1 } },
  'accumulator':        { time: 10, inp: { 'battery': 5, 'iron-plate': 2 }, out: { 'accumulator': 1 } },
  'military-science-pack':        { time: 10, inp: { 'grenade': 1, 'stone-wall': 2, 'piercing-rounds-magazine': 1 }, out: { 'military-science-pack': 2 } },  // 对齐官方：2石墙+1穿甲弹+1手雷 → 2
  // ===== 后期科学包（对齐《异星工厂》7 色科学包）=====
  'flying-robot-frame':        { time: 20, inp: { 'battery': 2, 'electric-engine-unit': 1, 'electronic-circuit': 3, 'steel-plate': 1 }, out: { 'flying-robot-frame': 1 } },
  'production-science-pack': { time: 21, inp: { 'rail': 30, 'electric-furnace': 1, 'productivity-module': 1 }, out: { 'production-science-pack': 1 } },  // 对齐官方：30铁轨+1电炉+1产能模块
  'utility-science-pack':        { time: 21, inp: { 'flying-robot-frame': 1, 'low-density-structure': 3, 'processing-unit': 2 }, out: { 'utility-science-pack': 3 } },
  // 空间科学包：卫星发射后由火箭发射井产出（非合成配方，见 rocket.js 发射逻辑）
  'gun-turret':        { time: 8, inp: { 'copper-plate': 10, 'iron-gear-wheel': 10, 'iron-plate': 20 }, out: { 'gun-turret': 1 } },
  'stone-wall':       { time: 0.5, inp: { 'stone-brick': 5 }, out: { 'stone-wall': 1 } },  // 对齐官方：5 石砖
  'gate':        { time: 0.5, inp: { 'electronic-circuit': 2, 'steel-plate': 2, 'stone-wall': 1 }, out: { 'gate': 1 } },  // 对齐官方：2电路板+2钢板+1石墙
  'firearm-magazine':        { time: 1, inp: { 'iron-plate': 4 }, out: { 'firearm-magazine': 1 } },
  'piercing-rounds-magazine':        { time: 6, inp: { 'copper-plate': 2, 'firearm-magazine': 2, 'steel-plate': 1 }, out: { 'piercing-rounds-magazine': 2 } },
  'plastic-bar':        { time: 1, inp: { 'coal': 1, 'petroleum-gas': 20 }, out: { 'plastic-bar': 2 } },
  'crack-light':       { time: 2,   inp: { 'heavy-oil': 40 },                                     out: { 'light-oil': 30 } },  // 对齐官方：40 重油 → 30 轻油
  'crack-gas':         { time: 2,   inp: { 'light-oil': 30 },                                     out: { 'petroleum-gas': 20 } },  // 对齐官方：30 轻油 → 20 石油气
  'lubricant':        { time: 1, inp: { 'heavy-oil': 10 }, out: { 'lubricant': 10 } },
  // 固体燃料（对齐《异星工厂》：石油气/轻油/重油在化工厂压制，耗时 1s）
  'solid-fuel':        { time: 1,   inp: { 'petroleum-gas': 20 },                                 out: { 'solid-fuel': 1 } },
  'solid-fuel-light-oil': { time: 1, inp: { 'light-oil': 10 },                                    out: { 'solid-fuel': 1 } },
  // 固体燃料·重油（对齐《异星工厂》：重油出料比 20:1，与轻油不同）
  'solid-fuel-heavy-oil': { time: 1, inp: { 'heavy-oil': 20 },                                   out: { 'solid-fuel': 1 } },
  // ===== 铁路系统（火车） =====
  'rail':        { time: 0.5, inp: { 'iron-stick': 1, 'steel-plate': 1, 'stone': 1 }, out: { 'rail': 2 } },
  'locomotive':        { time: 4, inp: { 'electronic-circuit': 10, 'engine-unit': 20, 'steel-plate': 30 }, out: { 'locomotive': 1 } },
  'cargo-wagon':        { time: 1, inp: { 'iron-gear-wheel': 10, 'iron-plate': 20, 'steel-plate': 20 }, out: { 'cargo-wagon': 1 } },
  'fluid-wagon':        { time: 1.5, inp: { 'iron-gear-wheel': 10, 'pipe': 8, 'steel-plate': 16, 'storage-tank': 1 }, out: { 'fluid-wagon': 1 } },
  'artillery-wagon':        { time: 4, inp: { 'advanced-circuit': 20, 'engine-unit': 64, 'iron-gear-wheel': 10, 'pipe': 16, 'steel-plate': 40 }, out: { 'artillery-wagon': 1 } },
  'train-stop':        { time: 0.5, inp: { 'electronic-circuit': 5, 'iron-plate': 6, 'iron-stick': 6, 'steel-plate': 3 }, out: { 'train-stop': 1 } },
  'rail-signal':        { time: 0.5, inp: { 'electronic-circuit': 1, 'iron-plate': 5 }, out: { 'rail-signal': 1 } },
  'rail-chain-signal':        { time: 0.5, inp: { 'electronic-circuit': 1, 'iron-plate': 5 }, out: { 'rail-chain-signal': 1 } },
  // ===== 高架铁轨（Elevated Rails DLC，数据来自 factorio-data 官方配方）=====
  'rail-support':        { time: 1, inp: { 'refined-concrete': 20, 'steel-plate': 10 }, out: { 'rail-support': 1 } },
  'rail-ramp':           { time: 2, inp: { 'refined-concrete': 100, 'rail': 8, 'steel-plate': 10 }, out: { 'rail-ramp': 1 } },
  // ===== 载具（对齐《异星工厂》Car，需引擎单元）=====
  'car':        { time: 2, inp: { 'engine-unit': 8, 'iron-plate': 20, 'steel-plate': 5 }, out: { 'car': 1 } },
  'tank':        { time: 5, inp: { 'advanced-circuit': 10, 'engine-unit': 32, 'iron-gear-wheel': 15, 'steel-plate': 50 }, out: { 'tank': 1 } },
  'cannon-shell':        { time: 8, inp: { 'explosives': 1, 'plastic-bar': 2, 'steel-plate': 2 }, out: { 'cannon-shell': 1 } },
  // 爆炸炮弹 / 铀爆炸炮弹（对齐《异星工厂》Explosive cannon shell / Explosive uranium cannon shell，坦克弹药分级）
  'explosive-cannon-shell':        { time: 8, inp: { 'explosives': 2, 'plastic-bar': 2, 'steel-plate': 2 }, out: { 'explosive-cannon-shell': 1 } },
  'explosive-uranium-cannon-shell':        { time: 12, inp: { 'explosive-cannon-shell': 1, 'uranium-238': 1 }, out: { 'explosive-uranium-cannon-shell': 1 } },
  'light-armor':        { time: 3, inp: { 'iron-plate': 40 }, out: { 'light-armor': 1 } },
  'heavy-armor':        { time: 8, inp: { 'copper-plate': 100, 'steel-plate': 50 }, out: { 'heavy-armor': 1 } },
  'spidertron':        { time: 10, inp: { 'efficiency-module-3': 2, 'exoskeleton-equipment': 4, 'low-density-structure': 150, 'processing-unit': 16, 'radar': 2, 'rocket-launcher': 4 }, out: { 'spidertron': 1 } },
  // 蜘蛛遥控器（对齐《异星工厂》Spidertron remote）：用于远程命令蜘蛛机器人移动
  'spidertron-remote': { time: 5, inp: { 'processing-unit': 2, 'advanced-circuit': 4, 'iron-gear-wheel': 6, 'battery': 2 }, out: { 'spidertron-remote': 1 } },
  'land-mine':        { time: 5, inp: { 'explosives': 2, 'steel-plate': 1 }, out: { 'land-mine': 4 } },
  'cliff-explosives':        { time: 8, inp: { 'explosives': 10, 'grenade': 1 }, out: { 'cliff-explosives': 1 } },
  'artillery-turret':        { time: 40, inp: { 'advanced-circuit': 20, 'concrete': 60, 'iron-gear-wheel': 40, 'steel-plate': 60 }, out: { 'artillery-turret': 1 } },
  'artillery-shell':        { time: 15, inp: { 'explosive-cannon-shell': 4, 'explosives': 8, 'radar': 1 }, out: { 'artillery-shell': 1 } },
  // ===== 玩家武器（战斗体系扩充） =====
  'pistol':            { time: 1,   inp: { 'iron-plate': 4, 'iron-gear-wheel': 1 },                     out: { 'pistol': 1 } },
  'submachine-gun':        { time: 10, inp: { 'copper-plate': 5, 'iron-gear-wheel': 10, 'iron-plate': 10 }, out: { 'submachine-gun': 1 } },
  'shotgun':        { time: 10, inp: { 'copper-plate': 10, 'iron-gear-wheel': 5, 'iron-plate': 15, 'wood': 5 }, out: { 'shotgun': 1 } },
  'rocket-launcher':        { time: 10, inp: { 'electronic-circuit': 5, 'iron-gear-wheel': 5, 'iron-plate': 5 }, out: { 'rocket-launcher': 1 } },
  'grenade':        { time: 8, inp: { 'coal': 10, 'iron-plate': 5 }, out: { 'grenade': 1 } },
  // 集束手雷（对齐《异星工厂》Cluster grenade）：更强爆炸范围
  'cluster-grenade':        { time: 8, inp: { 'explosives': 5, 'grenade': 7, 'steel-plate': 5 }, out: { 'cluster-grenade': 1 } },
  // 散弹枪弹药体系（对齐《异星工厂》Shotgun shell / Piercing shotgun shell）
  'shotgun-shell':     { time: 3,   inp: { 'iron-plate': 2, 'copper-plate': 2 },                   out: { 'shotgun-shell': 2 } },  // 对齐官方：3s + 2铜板 + 2铁板 → 2
  'piercing-shotgun-shell': { time: 8, inp: { 'shotgun-shell': 2, 'copper-plate': 2, 'steel-plate': 1 }, out: { 'piercing-shotgun-shell': 2 } },  // 对齐官方：8s + 2散弹枪弹+2铜板+1钢板 → 2
  'combat-shotgun':        { time: 10, inp: { 'copper-plate': 10, 'iron-gear-wheel': 5, 'steel-plate': 15, 'wood': 10 }, out: { 'combat-shotgun': 1 } },
  'rocket':        { time: 4, inp: { 'explosives': 1, 'iron-plate': 2 }, out: { 'rocket': 1 } },
  'explosive-rocket':        { time: 8, inp: { 'explosives': 2, 'rocket': 1 }, out: { 'explosive-rocket': 1 } },
  // 原子弹（对齐《异星工厂》Atomic bomb）：铀-235 + 火箭弹 + 爆炸物 + 处理器 → 终极核武器
  'atomic-bomb':        { time: 50, inp: { 'explosives': 10, 'processing-unit': 10, 'uranium-235': 30 }, out: { 'atomic-bomb': 1 } },
  'flamethrower':        { time: 10, inp: { 'iron-gear-wheel': 10, 'steel-plate': 5 }, out: { 'flamethrower': 1 } },
  // ===== 终局战斗弹药与胶囊（对齐《异星工厂》Uranium ammo / Capsules）=====
  // 铀弹：铀-238 + 穿甲弹 → 高伤害穿甲弹药（供冲锋枪/机枪炮塔）
  'uranium-rounds-magazine':        { time: 10, inp: { 'piercing-rounds-magazine': 1, 'uranium-238': 1 }, out: { 'uranium-rounds-magazine': 1 } },
  // 铀炮弹：普通炮弹 + 铀-238 → 坦克超重炮
  'uranium-cannon-shell':        { time: 12, inp: { 'cannon-shell': 1, 'uranium-238': 1 }, out: { 'uranium-cannon-shell': 1 } },
  // 毒胶囊 / 减速胶囊（对齐《异星工厂》Combat capsules）
  'poison-capsule':        { time: 8, inp: { 'coal': 10, 'electronic-circuit': 3, 'steel-plate': 3 }, out: { 'poison-capsule': 1 } },
  'slowdown-capsule':        { time: 8, inp: { 'coal': 5, 'electronic-circuit': 2, 'steel-plate': 2 }, out: { 'slowdown-capsule': 1 } },
  // 火焰弹药：轻油+重油在化工厂制成（对齐《异星工厂》Flamethrower ammo，化工厂配方）
  'flamethrower-ammo':        { time: 6, inp: { 'crude-oil': 100, 'steel-plate': 5 }, out: { 'flamethrower-ammo': 1 } },
  // ===== 军事炮塔扩充 =====
  'laser-turret':        { time: 20, inp: { 'battery': 12, 'electronic-circuit': 20, 'steel-plate': 20 }, out: { 'laser-turret': 1 } },
  'flamethrower-turret':        { time: 20, inp: { 'engine-unit': 5, 'iron-gear-wheel': 15, 'pipe': 10, 'steel-plate': 30 }, out: { 'flamethrower-turret': 1 } },
  // ===== 模块系统 =====
  'speed-module':        { time: 15, inp: { 'advanced-circuit': 5, 'electronic-circuit': 5 }, out: { 'speed-module': 1 } },
  'speed-module-2':        { time: 30, inp: { 'advanced-circuit': 5, 'processing-unit': 5, 'speed-module': 4 }, out: { 'speed-module-2': 1 } },
  'speed-module-3':        { time: 60, inp: { 'advanced-circuit': 5, 'processing-unit': 5, 'speed-module-2': 4 }, out: { 'speed-module-3': 1 } },
  'productivity-module':        { time: 15, inp: { 'advanced-circuit': 5, 'electronic-circuit': 5 }, out: { 'productivity-module': 1 } },
  'productivity-module-2':        { time: 30, inp: { 'advanced-circuit': 5, 'processing-unit': 5, 'productivity-module': 4 }, out: { 'productivity-module-2': 1 } },
  'productivity-module-3':        { time: 60, inp: { 'advanced-circuit': 5, 'processing-unit': 5, 'productivity-module-2': 4 }, out: { 'productivity-module-3': 1 } },
  'efficiency-module':        { time: 15, inp: { 'advanced-circuit': 5, 'electronic-circuit': 5 }, out: { 'efficiency-module': 1 } },
  'efficiency-module-2':        { time: 30, inp: { 'advanced-circuit': 5, 'efficiency-module': 4, 'processing-unit': 5 }, out: { 'efficiency-module-2': 1 } },
  'efficiency-module-3':        { time: 60, inp: { 'advanced-circuit': 5, 'efficiency-module-2': 4, 'processing-unit': 5 }, out: { 'efficiency-module-3': 1 } },
  // 品质模块（对齐《异星工厂》Quality DLC：品质模块官方配方与耗时）
  'quality-module':        { time: 15, inp: { 'electronic-circuit': 5, 'advanced-circuit': 5 }, out: { 'quality-module': 1 } },
  'quality-module-2':        { time: 30, inp: { 'quality-module': 4, 'advanced-circuit': 5, 'processing-unit': 5 }, out: { 'quality-module-2': 1 } },
  'quality-module-3':        { time: 60, inp: { 'quality-module-2': 4, 'advanced-circuit': 5, 'processing-unit': 5 }, out: { 'quality-module-3': 1 } },
  'beacon':        { time: 15, inp: { 'advanced-circuit': 20, 'copper-cable': 10, 'electronic-circuit': 20, 'steel-plate': 10 }, out: { 'beacon': 1 } },
  // ===== 火箭链路中间件 =====
  'advanced-circuit':  { time: 6,   inp: { 'electronic-circuit': 2, 'plastic-bar': 2, 'copper-cable': 4 }, out: { 'advanced-circuit': 1 } },
  'engine-unit':       { time: 10,  inp: { 'steel-plate': 1, 'iron-gear-wheel': 1, 'pipe': 2 },           out: { 'engine-unit': 1 } },
  'electric-engine-unit':        { time: 10, inp: { 'electronic-circuit': 2, 'engine-unit': 1, 'lubricant': 15 }, out: { 'electric-engine-unit': 1 } },
  'processing-unit':        { time: 10, inp: { 'electronic-circuit': 20, 'advanced-circuit': 2, 'sulfuric-acid': 5 }, out: { 'processing-unit': 1 } },
  'low-density-structure':        { time: 15, inp: { 'copper-plate': 20, 'steel-plate': 2, 'plastic-bar': 5 }, out: { 'low-density-structure': 1 } },
  'rocket-fuel':        { time: 15, inp: { 'light-oil': 10, 'solid-fuel': 10 }, out: { 'rocket-fuel': 1 } },
  'satellite':        { time: 5, inp: { 'accumulator': 100, 'low-density-structure': 100, 'processing-unit': 100, 'radar': 5, 'rocket-fuel': 50, 'solar-panel': 100 }, out: { 'satellite': 1 } },
  'rocket-silo':        { time: 30, inp: { 'concrete': 1000, 'electric-engine-unit': 200, 'pipe': 100, 'processing-unit': 200, 'steel-plate': 1000 }, out: { 'rocket-silo': 1 } },
  'cargo-landing-pad':  { time: 30, inp: { 'concrete': 200, 'steel-plate': 25, 'processing-unit': 10 }, out: { 'cargo-landing-pad': 1 } },  // 官方：200混凝土+25钢板+10处理器（30s）
  'cargo-bay':          { time: 10, inp: { 'steel-plate': 20, 'low-density-structure': 20, 'processing-unit': 5 }, out: { 'cargo-bay': 1 } },  // 官方：20钢板+20低密度结构+5处理器（10s）
  'landing-pad-unloading-bay': { time: 10, inp: { 'cargo-bay': 1, 'steel-chest': 4, 'electric-engine-unit': 15, 'processing-unit': 8 }, out: { 'landing-pad-unloading-bay': 1 } },  // 官方：1扩展舱+4钢箱+15电引擎+8处理器（10s）
  'radar':        { time: 0.5, inp: { 'electronic-circuit': 5, 'iron-gear-wheel': 5, 'iron-plate': 10 }, out: { 'radar': 1 } },
  // 爆炸物（火箭弹/手雷专用）
  'explosives':        { time: 4, inp: { 'coal': 1, 'sulfur': 1, 'water': 10 }, out: { 'explosives': 2 } },
  // 电池（激光炮塔/卫星），对齐《异星工厂》：硫酸 + 铁板 + 铜板
  'battery':        { time: 4, inp: { 'iron-plate': 1, 'copper-plate': 1, 'sulfuric-acid': 20 }, out: { 'battery': 1 } },
  // ===== 硫磺/硫酸（对齐《异星工厂》Sulfur & Sulfuric acid，化工厂配方）=====
  // 硫磺：石油气 + 水 → 硫磺（原版 1s，2:1 比例简化为 3:2）
  'sulfur':        { time: 1, inp: { 'petroleum-gas': 30, 'water': 30 }, out: { 'sulfur': 2 } },
  'carbon':        { time: 1, inp: { 'coal': 2, 'sulfuric-acid': 20 }, out: { 'carbon': 1 } },
  // ===== 太空推进链（Space Age Thruster fuel/oxidizer，官方数据，化工厂化学配方）=====
  // 推进器燃料：碳 + 水 → 推进器燃料（官方 thruster-fuel 2s，2碳+10水→75流体，化学类别，化工厂生产）
  'thruster-fuel': { time: 2, inp: { 'carbon': 2, 'water': 10 }, out: { 'thruster-fuel': 75 } },
  // 推进器氧化剂：铁矿 + 水 → 推进器氧化剂（官方 thruster-oxidizer 2s，2铁矿+10水→75流体，化工厂生产）
  'thruster-oxidizer': { time: 2, inp: { 'iron-ore': 2, 'water': 10 }, out: { 'thruster-oxidizer': 75 } },
  // 高级推进器燃料：碳 + 方解石 + 水 → 推进器燃料（官方 advanced-thruster-fuel 10s，2碳+1方解石+100水→1500流体，化工厂生产）
  'advanced-thruster-fuel': { time: 10, inp: { 'carbon': 2, 'calcite': 1, 'water': 100 }, out: { 'thruster-fuel': 1500 } },
  // 高级推进器氧化剂：铁矿 + 方解石 + 水 → 推进器氧化剂（官方 advanced-thruster-oxidizer 10s，2铁矿+1方解石+100水→1500流体，化工厂生产）
  'advanced-thruster-oxidizer': { time: 10, inp: { 'iron-ore': 2, 'calcite': 1, 'water': 100 }, out: { 'thruster-oxidizer': 1500 } },
  // ===== 太空时代 空间平台系统（Space Platform，官方数据）=====
  // 空间平台地基：钢板 + 铜线 → 地基（官方 space-platform-foundation 10s，20钢板+20铜线→1）
  'space-platform-foundation': { time: 10, inp: { 'steel-plate': 20, 'copper-cable': 20 }, out: { 'space-platform-foundation': 1 } },
  // 空间平台起始包：地基 + 钢板 + 处理器 → 起始包（官方 space-platform-starter-pack 60s，60地基+20钢板+20处理器→1）
  'space-platform-starter-pack': { time: 60, inp: { 'space-platform-foundation': 60, 'steel-plate': 20, 'processing-unit': 20 }, out: { 'space-platform-starter-pack': 1 } },
  // 空间平台中枢：地基 + 钢板 + 处理器 → 中枢（官方中枢由起始包在太空展开，此处适配为地面组装，60s）
  'space-platform-hub': { time: 60, inp: { 'space-platform-foundation': 100, 'steel-plate': 50, 'processing-unit': 50 }, out: { 'space-platform-hub': 1 } },
  // 推进器：钢板 + 处理器 + 电动机 → 推进器（官方 thruster 10s，10钢板+10处理器+5电动机→1）
  'thruster': { time: 10, inp: { 'steel-plate': 10, 'processing-unit': 10, 'electric-engine-unit': 5 }, out: { 'thruster': 1 } },
  // 小行星收集器：低密度结构 + 电动机 + 处理器 → 收集器（官方 asteroid-collector 10s，20低密+8电动机+5处理器→1）
  'asteroid-collector': { time: 10, inp: { 'low-density-structure': 20, 'electric-engine-unit': 8, 'processing-unit': 5 }, out: { 'asteroid-collector': 1 } },
  // ===== 太空时代 Space Age 材料链（数据来自官方 factorio-data，见 GAME_DATA）=====
  // 碳纤维：碳 → 碳纤维（官方 carbon-fiber 由 yumako-mash+碳，此处适配为化工厂碳加工，耗时 5s）
  'carbon-fiber':        { time: 5, inp: { 'carbon': 3 }, out: { 'carbon-fiber': 1 } },
  // 锂：硫酸 + 轻油 → 锂（官方 lithium 需 lithium-brine+氨水+钬板，此处适配为化工厂电解，20s）
  'lithium':        { time: 20, inp: { 'sulfuric-acid': 50, 'light-oil': 50 }, out: { 'lithium': 5 } },
  // 锂板：锂 → 锂板（官方 lithium-plate 为熔炼配方，耗时 6.4s）
  'lithium-plate':        { time: 6.4, inp: { 'lithium': 1 }, out: { 'lithium-plate': 1 } },
  // 超导体：锂板 + 铜板 + 塑料 → 超导体（官方 superconductor 需钬板，此处适配，5s）
  'superconductor':        { time: 5, inp: { 'lithium-plate': 1, 'copper-plate': 1, 'plastic-bar': 1 }, out: { 'superconductor': 2 } },
  // 电磁科研包：超导体 + 蓄电器 + 电路板 → 电磁科研包（官方需超电容/电解液/钬溶液，此处适配，10s）
  'electromagnetic-science-pack': { time: 10, inp: { 'superconductor': 2, 'accumulator': 1, 'electronic-circuit': 2 }, out: { 'electromagnetic-science-pack': 1 } },
  // 电磁工厂：钢板 + 处理器 + 钢筋混凝土 + 超导体 → 电磁工厂（官方需钬板，此处适配，10s）
  'electromagnetic-plant': { time: 10, inp: { 'steel-plate': 50, 'processing-unit': 50, 'refined-concrete': 50, 'superconductor': 20 }, out: { 'electromagnetic-plant': 1 } },
  // 回收机：处理器 + 钢板 + 齿轮 + 混凝土 → 回收机（官方 energy_required=3s，此处对齐，10s）
  'recycler': { time: 10, inp: { 'processing-unit': 6, 'steel-plate': 20, 'iron-gear-wheel': 40, 'concrete': 20 }, out: { 'recycler': 1 } },
  // ===== 太空时代 Vulcanus 铸造/钨材料链（官方配方依赖熔融铁/火山熔岩等星球专属资源，此处适配基础资源）=====
  // 钨矿石：石头 + 煤 → 钨矿石×2（官方 tungsten-ore 为 Vulcanus 天然矿脉，此处适配为铸造厂从基础矿石还原，12s）
  'tungsten-ore': { time: 12, inp: { 'stone': 4, 'coal': 2 }, out: { 'tungsten-ore': 2 } },
  // 钨板：钨矿石 → 钨板（官方 tungsten-plate 为熔炼配方 energy_required=6.4s，由铸造厂熔炼，此处对齐时间）
  'tungsten-plate': { time: 6.4, inp: { 'tungsten-ore': 1 }, out: { 'tungsten-plate': 1 } },
  // 碳化钨：钨板 + 碳 → 碳化钨（官方 tungsten-carbide 4s，由铸造厂制得，此处适配）
  'tungsten-carbide': { time: 4, inp: { 'tungsten-plate': 2, 'carbon': 1 }, out: { 'tungsten-carbide': 1 } },
  // 冶金科研包：钨板 + 碳化钨 + 电路板 → 冶金科研包（官方 metallurgic-science-pack 6s，此处适配）
  'metallurgic-science-pack': { time: 6, inp: { 'tungsten-plate': 2, 'tungsten-carbide': 1, 'electronic-circuit': 2 }, out: { 'metallurgic-science-pack': 1 } },
  // 铸造厂：钢板 + 处理器 + 钢筋混凝土 + 电炉 → 铸造厂（官方需熔融铁+碳化钨，此处适配基础资源，10s）
  'foundry': { time: 10, inp: { 'steel-plate': 50, 'processing-unit': 50, 'refined-concrete': 50, 'electric-furnace': 4 }, out: { 'foundry': 1 } },
  // ===== 太空时代 农业/Gleba 生物质材料链（官方数值参考，见 GAME_DATA）=====
  // 雅玛果泥：雅玛果 → 果泥×2（官方 yumako-processing 1s，2 果泥 + 概率种子）
  'yumako-mash': { time: 1, inp: { 'yumako': 1 }, out: { 'yumako-mash': 2 } },
  // 生物流：果泥×15 → 生物流×4（官方 bioflux 6s，需胶质，此处适配为仅果泥）
  'bioflux': { time: 6, inp: { 'yumako-mash': 15 }, out: { 'bioflux': 4 } },
  // 营养素：果泥×4 → 营养素×6（官方 nutrients-from-yumako-mash 2s）
  'nutrients-from-bioflux': { time: 2, inp: { 'yumako-mash': 4 }, out: { 'nutrients': 6 } },
  // 生物硫磺：腐败物×5 + 生物流×1 → 硫磺×2（官方 biosulfur 2s）
  'biosulfur': { time: 2, inp: { 'spoilage': 5, 'bioflux': 1 }, out: { 'sulfur': 2 } },
  // 农业科研包：生物流×1 + 五足虫蛋×1 → 农业科研包×1（官方 agricultural-science-pack 4s，此处适配为生物流+腐败物）
  'agricultural-science-pack': { time: 4, inp: { 'bioflux': 1, 'spoilage': 2 }, out: { 'agricultural-science-pack': 1 } },
  // 生化炉：钢板 + 电路板 + 齿轮 + 混凝土 → 生化炉（官方需生物质，此处适配基础资源）
  'biochamber': { time: 10, inp: { 'steel-plate': 50, 'electronic-circuit': 50, 'iron-gear-wheel': 40, 'concrete': 20 }, out: { 'biochamber': 1 } },
  // 农业塔：钢板 + 电路板 + 变质物 + 填海料 → 农业塔（官方 agricultural-tower 10s：10钢板+3电路板+20变质物+1填海料，此处对齐官方）
  'agricultural-tower': { time: 10, inp: { 'steel-plate': 10, 'electronic-circuit': 3, 'spoilage': 20, 'landfill': 1 }, out: { 'agricultural-tower': 1 } },
  // 玉玛果种植（农业塔专属生长配方）：玉玛果种子×1 → 玉玛果×6 + 有概率返还种子，持续收获（对齐《异星工厂》Agricultural tower 种植）
  'yumako-growing': { time: 30, inp: { 'yumako-seed': 1 }, out: { 'yumako': 6 } },
  // 人工雅玛果土壤：玉玛果种子×2 + 营养素×50 + 填海料×5 → 人工雅玛果土壤×10（官方 artificial-yumako-soil 2s）
  'artificial-yumako-soil': { time: 2, inp: { 'yumako-seed': 2, 'nutrients': 50, 'landfill': 5 }, out: { 'artificial-yumako-soil': 10 } },
  // 茂盛雅玛果土壤：人工雅玛果土壤×2 + 玉玛果种子×5 + 变质物×50 + 水×100 → 茂盛雅玛果土壤×1
  // （官方 overgrowth-yumako-soil 10s 依赖 biter-egg 生物蛋，项目适配为现有生物链资源：变质物代替）
  'overgrowth-yumako-soil': { time: 10, inp: { 'artificial-yumako-soil': 2, 'yumako-seed': 5, 'spoilage': 50, 'water': 100 }, out: { 'overgrowth-yumako-soil': 1 } },
  // ===== 太空时代 小行星碎块加工链（破碎机配方，官方数值参考，见 GAME_DATA）=====
  // 破碎机本体：低密度结构 + 钢板 + 电动引擎 → 破碎机（官方 energy_required=10s，此处对齐 10s）
  'crusher': { time: 10, inp: { 'low-density-structure': 20, 'steel-plate': 10, 'electric-engine-unit': 10 }, out: { 'crusher': 1 } },
  // 金属星块粉碎：金属星块×1 → 铁矿石×20（官方 2s，30% 概率返还星块）
  'metallic-asteroid-crushing': { time: 2, inp: { 'metallic-asteroid-chunk': 1 }, out: { 'iron-ore': 20 } },
  // 碳质星块粉碎：碳质星块×1 → 碳×10（官方 2s，30% 概率返还星块）
  'carbonic-asteroid-crushing': { time: 2, inp: { 'carbonic-asteroid-chunk': 1 }, out: { 'carbon': 10 } },
  // 氧化星块粉碎：氧化星块×1 → 冰×5（官方 2s，30% 概率返还星块）
  'oxide-asteroid-crushing': { time: 2, inp: { 'oxide-asteroid-chunk': 1 }, out: { 'ice': 5 } },
  // 进阶粉碎（官方 advanced-*-asteroid-crushing 5s，产出更丰富的基础资源；此处沿用纯确定性产出简化）
  'advanced-metallic-asteroid-crushing': { time: 5, inp: { 'metallic-asteroid-chunk': 1 }, out: { 'iron-ore': 10, 'copper-ore': 4 } },
  'advanced-carbonic-asteroid-crushing': { time: 5, inp: { 'carbonic-asteroid-chunk': 1 }, out: { 'carbon': 5, 'sulfur': 2 } },
  'advanced-oxide-asteroid-crushing': { time: 5, inp: { 'oxide-asteroid-chunk': 1 }, out: { 'ice': 3, 'calcite': 2 } },
  // 星块再处理（官方 *-asteroid-reprocessing：把一种星块随机转换为三种星块，概率模型对齐官方 shared_probability）
  'metallic-asteroid-reprocessing': { time: 2, inp: { 'metallic-asteroid-chunk': 1 }, prob: { 'metallic-asteroid-chunk': 0.4, 'carbonic-asteroid-chunk': 0.2, 'oxide-asteroid-chunk': 0.2 } },
  'carbonic-asteroid-reprocessing': { time: 2, inp: { 'carbonic-asteroid-chunk': 1 }, prob: { 'carbonic-asteroid-chunk': 0.4, 'metallic-asteroid-chunk': 0.2, 'oxide-asteroid-chunk': 0.2 } },
  'oxide-asteroid-reprocessing': { time: 1, inp: { 'oxide-asteroid-chunk': 1 }, prob: { 'oxide-asteroid-chunk': 0.4, 'metallic-asteroid-chunk': 0.2, 'carbonic-asteroid-chunk': 0.2 } },
  // 钷素科研包：钷素星块×25 + 超导体×1 + 生物结晶×10 → 钷素科研包×10（官方 promethium-science-pack 5s：
  // 25钷素星块+1量子处理器+10五足虫蛋，适配为超导体代量子处理器、生物结晶代五足虫蛋；由电磁工厂制得，5s 对齐官方）
  'promethium-science-pack': { time: 5, inp: { 'promethium-asteroid-chunk': 25, 'superconductor': 1, 'bioflux': 10 }, out: { 'promethium-science-pack': 10 } },
  // 冰熔化：冰 → 水（官方 ice-melting 0.5s，此处适配熔炉/锅炉链，供氧化链循环）
  'ice-melting': { time: 0.5, inp: { 'ice': 1 }, out: { 'water': 100 } },
  // 硫酸：硫磺 + 水 + 铁板 → 硫酸（原版 1s，数量简化）
  // 硫酸：硫磺 + 水 + 铁板 → 硫酸（原版 1s，数量简化）
  'sulfuric-acid':        { time: 1, inp: { 'iron-plate': 1, 'sulfur': 5, 'water': 100 }, out: { 'sulfuric-acid': 50 } },
  // ===== 战斗机器人胶囊配方（对齐《异星工厂》Capsules）=====
  'defender-capsule':        { time: 8, inp: { 'electronic-circuit': 3, 'iron-gear-wheel': 3, 'piercing-rounds-magazine': 3 }, out: { 'defender-capsule': 1 } },
  'distractor-capsule':        { time: 15, inp: { 'advanced-circuit': 3, 'defender-capsule': 4 }, out: { 'distractor-capsule': 1 } },
  'destroyer-capsule':        { time: 15, inp: { 'distractor-capsule': 4, 'speed-module': 1 }, out: { 'destroyer-capsule': 1 } },
  // ===== 物流机器人网络 =====
  'roboport':        { time: 5, inp: { 'advanced-circuit': 45, 'iron-gear-wheel': 45, 'steel-plate': 45 }, out: { 'roboport': 1 } },
  'logistic-robot':        { time: 0.5, inp: { 'advanced-circuit': 2, 'flying-robot-frame': 1 }, out: { 'logistic-robot': 1 } },
  'construction-robot':        { time: 0.5, inp: { 'electronic-circuit': 2, 'flying-robot-frame': 1 }, out: { 'construction-robot': 1 } },
  'personal-roboport-equipment':        { time: 10, inp: { 'advanced-circuit': 10, 'battery': 45, 'iron-gear-wheel': 40, 'steel-plate': 20 }, out: { 'personal-roboport-equipment': 1 } },
  'personal-roboport-mk2-equipment':        { time: 20, inp: { 'low-density-structure': 20, 'personal-roboport-equipment': 5, 'processing-unit': 100 }, out: { 'personal-roboport-mk2-equipment': 1 } },
  'passive-provider-chest':        { time: 0.5, inp: { 'advanced-circuit': 1, 'electronic-circuit': 3, 'steel-chest': 1 }, out: { 'passive-provider-chest': 1 } },
  'active-provider-chest':        { time: 0.5, inp: { 'advanced-circuit': 1, 'electronic-circuit': 3, 'steel-chest': 1 }, out: { 'active-provider-chest': 1 } },
  'storage-chest':        { time: 0.5, inp: { 'advanced-circuit': 1, 'electronic-circuit': 3, 'steel-chest': 1 }, out: { 'storage-chest': 1 } },
  'requester-chest':        { time: 0.5, inp: { 'advanced-circuit': 1, 'electronic-circuit': 3, 'steel-chest': 1 }, out: { 'requester-chest': 1 } },
  // 缓冲物流箱（对齐《异星工厂》Buffer chest 0.17+）：兼具请求与供应能力
  'buffer-chest':        { time: 0.5, inp: { 'advanced-circuit': 1, 'electronic-circuit': 3, 'steel-chest': 1 }, out: { 'buffer-chest': 1 } },
  // ===== 核能配方 =====
  // 铀增殖处理（Kovarex，离心机）：铀-235 催化下把铀-238 富集成更多铀-235（可自持循环）
  // 40 铀-235 + 5 铀-238 → 41 铀-235 + 2 铀-238（净增产 1 铀-235，消耗 3 铀-238），60s（对齐《异星工厂》Kovarex 富集 60s）
  'kovarex':           { time: 60,  inp: { 'uranium-235': 40, 'uranium-238': 5 },                  out: { 'uranium-235': 41, 'uranium-238': 2 } },
  // 核燃料（组装机，对齐《异星工厂》：1 火箭燃料 + 1 铀-235 → 1 核燃料）：火箭燃料 + 铀-235 制成
  'nuclear-fuel':        { time: 90, inp: { 'rocket-fuel': 1, 'uranium-235': 1 }, out: { 'nuclear-fuel': 1 } },
  // 铀燃料棒（对齐《异星工厂》：10 铁板 + 1 铀-235 + 19 铀-238 → 10 燃料棒，组装机）：反应堆专用燃料，燃尽产贫化铀燃料棒
  'uranium-fuel-cell': { time: 10,  inp: { 'iron-plate': 10, 'uranium-235': 1, 'uranium-238': 19 }, out: { 'uranium-fuel-cell': 10 } },
  // 离心机/反应堆/汽轮机（组装机制造）
  'centrifuge':        { time: 4, inp: { 'advanced-circuit': 100, 'concrete': 100, 'iron-gear-wheel': 100, 'steel-plate': 50 }, out: { 'centrifuge': 1 } },
  'nuclear-reactor':        { time: 8, inp: { 'advanced-circuit': 500, 'concrete': 500, 'copper-plate': 500, 'steel-plate': 500 }, out: { 'nuclear-reactor': 1 } },
  'steam-turbine':        { time: 3, inp: { 'copper-plate': 50, 'iron-gear-wheel': 50, 'pipe': 20 }, out: { 'steam-turbine': 1 } },
  'heat-pipe':        { time: 1, inp: { 'copper-plate': 20, 'steel-plate': 10 }, out: { 'heat-pipe': 1 } },
  'heat-exchanger':        { time: 3, inp: { 'copper-plate': 100, 'pipe': 10, 'steel-plate': 10 }, out: { 'heat-exchanger': 1 } },
  'heating-tower':        { time: 10, inp: { 'boiler': 2, 'heat-pipe': 5, 'concrete': 20 }, out: { 'heating-tower': 1 } },  // 太空时代供热塔（官方配方：2锅炉+5导热管+20混凝土，10s）
  // ===== Aquilo 聚变发电链（太空时代 Space Age，对齐《异星工厂》fusion-reactor / fusion-generator / fusion-power-cell）=====
  // 官方配方依赖钨板/量子处理器/钬板/氨（Aquilo 行星专属资源），项目暂无行星系统，适配为现有超导体/锂板/处理器等高级材料，产出物/耗时参考官方。
  'fusion-power-cell': { time: 10, inp: { 'lithium-plate': 5, 'superconductor': 1, 'carbon-fiber': 1 }, out: { 'fusion-power-cell': 1 } },  // 官方 5锂板+1钬板+100氨（10s），适配
  'fusion-reactor':    { time: 60, inp: { 'superconductor': 50, 'processing-unit': 50, 'lithium-plate': 30, 'steel-plate': 50 }, out: { 'fusion-reactor': 1 } },  // 官方 200钨板+200超导+250量子处理器（60s），适配
  'fusion-generator':  { time: 30, inp: { 'superconductor': 30, 'processing-unit': 30, 'lithium-plate': 20 }, out: { 'fusion-generator': 1 } },  // 官方 100钨板+100超导+50量子处理器（30s），适配
  // ===== Fulgora 避雷系统（太空时代 Space Age，对齐《异星工厂》lightning-rod / lightning-collector）=====
  // 官方配方：避雷针=12铜线+8钢板+4石砖（5s）；避雷收集器=1避雷针+8超级电容+1蓄电器+80电解质（5s）。
  // 项目未实现 Fulgora 专属 supercapacitor/electrolyte，故收集器配方适配为现有超导体替代超级电容，产出物/耗时参考官方。
  'lightning-rod':        { time: 5, inp: { 'copper-cable': 12, 'steel-plate': 8, 'stone-brick': 4 }, out: { 'lightning-rod': 1 } },
  'lightning-collector':  { time: 5, inp: { 'lightning-rod': 1, 'superconductor': 8, 'accumulator': 1 }, out: { 'lightning-collector': 1 } },
  // ===== 电路网络配方 =====
  'small-electric-pole':        { time: 0.5, inp: { 'copper-cable': 2, 'wood': 1 }, out: { 'small-electric-pole': 2 } },
  'substation':        { time: 0.5, inp: { 'advanced-circuit': 5, 'copper-cable': 6, 'steel-plate': 10 }, out: { 'substation': 1 } },
  'programmable-speaker':        { time: 2, inp: { 'copper-cable': 5, 'electronic-circuit': 4, 'iron-plate': 3, 'iron-stick': 4 }, out: { 'programmable-speaker': 1 } },
  'small-lamp':        { time: 0.5, inp: { 'copper-cable': 3, 'electronic-circuit': 1, 'iron-plate': 1 }, out: { 'small-lamp': 1 } },
  'medium-electric-pole':        { time: 0.5, inp: { 'copper-cable': 2, 'iron-stick': 4, 'steel-plate': 2 }, out: { 'medium-electric-pole': 1 } },
  'big-electric-pole':        { time: 0.5, inp: { 'copper-cable': 4, 'iron-stick': 8, 'steel-plate': 5 }, out: { 'big-electric-pole': 1 } },
  'constant-combinator':        { time: 0.5, inp: { 'copper-cable': 5, 'electronic-circuit': 2 }, out: { 'constant-combinator': 1 } },
  'arithmetic-combinator':        { time: 0.5, inp: { 'copper-cable': 5, 'electronic-circuit': 5 }, out: { 'arithmetic-combinator': 1 } },
  'decider-combinator':        { time: 0.5, inp: { 'copper-cable': 5, 'electronic-circuit': 5 }, out: { 'decider-combinator': 1 } },
  'selector-combinator':        { time: 0.5, inp: { 'advanced-circuit': 2, 'decider-combinator': 5 }, out: { 'selector-combinator': 1 } },  // 官方：2 高级电路 + 5 判断组合器
  'display-panel':              { time: 0.5, inp: { 'iron-plate': 1, 'electronic-circuit': 1 }, out: { 'display-panel': 1 } },  // 官方：1 铁板 + 1 电路板
  // 功率开关（对齐《异星工厂》Power switch）：铁板 + 电路板 + 铜线
  'power-switch':        { time: 2, inp: { 'copper-cable': 5, 'electronic-circuit': 2, 'iron-plate': 5 }, out: { 'power-switch': 1 } },
  // 红/绿电路线缆（对齐《异星工厂》：用铜线+电路板制成，用于手动区分接入红/绿网络）
  'red-wire':          { time: 1,    inp: { 'copper-cable': 2, 'electronic-circuit': 1 },                   out: { 'red-wire': 4 } },
  'green-wire':        { time: 1,    inp: { 'copper-cable': 2, 'electronic-circuit': 1 },                   out: { 'green-wire': 4 } },
  // ===== 混凝土 / 地形改造配方 =====
  'concrete':        { time: 10, inp: { 'iron-ore': 1, 'stone-brick': 5, 'water': 100 }, out: { 'concrete': 10 } },
  'refined-concrete':        { time: 15, inp: { 'concrete': 20, 'iron-stick': 8, 'steel-plate': 1, 'water': 100 }, out: { 'refined-concrete': 10 } },
  'hazard-concrete':        { time: 0.25, inp: { 'concrete': 10 }, out: { 'hazard-concrete': 10 } },
  'refined-hazard-concrete':{ time: 0.25, inp: { 'refined-concrete': 10 }, out: { 'refined-hazard-concrete': 10 } },
  'stone-path':        { time: 0.5, inp: { 'stone-brick': 2 },                                      out: { 'stone-path': 4 } },
  'landfill':        { time: 0.5, inp: { 'stone': 50 }, out: { 'landfill': 1 } },
  // ===== 模块化护甲（对齐《异星工厂》Modular armor）=====
  'modular-armor':        { time: 15, inp: { 'advanced-circuit': 30, 'steel-plate': 50 }, out: { 'modular-armor': 1 } },
  'power-armor':        { time: 20, inp: { 'electric-engine-unit': 20, 'processing-unit': 40, 'steel-plate': 40 }, out: { 'power-armor': 1 } },
  'power-armor-mk2':        { time: 25, inp: { 'efficiency-module-2': 25, 'electric-engine-unit': 40, 'low-density-structure': 30, 'processing-unit': 60, 'speed-module-2': 25 }, out: { 'power-armor-mk2': 1 } },
  // ===== 个人装备件 =====
  'solar-panel-equipment':        { time: 10, inp: { 'advanced-circuit': 2, 'solar-panel': 1, 'steel-plate': 5 }, out: { 'solar-panel-equipment': 1 } },
  'fusion-reactor-equipment': { time: 20, inp: { 'nuclear-reactor': 1, 'processing-unit': 20, 'low-density-structure': 10, 'electric-engine-unit': 10 }, out: { 'fusion-reactor-equipment': 1 } },
  'battery-equipment':        { time: 10, inp: { 'battery': 5, 'steel-plate': 10 }, out: { 'battery-equipment': 1 } },
  'battery-mk2-equipment':        { time: 10, inp: { 'battery-equipment': 10, 'low-density-structure': 5, 'processing-unit': 15 }, out: { 'battery-mk2-equipment': 1 } },
  'exoskeleton-equipment':        { time: 10, inp: { 'electric-engine-unit': 30, 'processing-unit': 10, 'steel-plate': 20 }, out: { 'exoskeleton-equipment': 1 } },
  'night-vision-equipment':        { time: 10, inp: { 'advanced-circuit': 5, 'steel-plate': 10 }, out: { 'night-vision-equipment': 1 } },
  'personal-laser-defense-equipment':        { time: 10, inp: { 'laser-turret': 5, 'low-density-structure': 5, 'processing-unit': 20 }, out: { 'personal-laser-defense-equipment': 1 } },
  // ===== 能量护盾配方（对齐《异星工厂》：护盾需个人电池/高级电路板/处理器） =====
  'energy-shield-equipment':        { time: 10, inp: { 'advanced-circuit': 5, 'steel-plate': 10 }, out: { 'energy-shield-equipment': 1 } },
  'energy-shield-mk2-equipment':        { time: 10, inp: { 'energy-shield-equipment': 10, 'low-density-structure': 5, 'processing-unit': 5 }, out: { 'energy-shield-mk2-equipment': 1 } },
  // ===== 传送带免疫装备（对齐《异星工厂》：铁板+电路板，早期装备件） =====
  'belt-immunity-equipment':        { time: 10, inp: { 'advanced-circuit': 5, 'steel-plate': 10 }, out: { 'belt-immunity-equipment': 1 } },
  // ===== 放电防御装备（对齐《异星工厂》：需高级电路板/电池/处理器等） =====
  'discharge-defense-equipment':        { time: 10, inp: { 'laser-turret': 10, 'processing-unit': 5, 'steel-plate': 20 }, out: { 'discharge-defense-equipment': 1 } },
};

// ===== 流体桶装配方（对齐《异星工厂》Barrel system） =====
// 桶装：空桶 + 50 流体 → 对应满桶（组装机）；倒空：满桶 → 50 流体 + 空桶。
// 通过下方循环动态生成到 RECIPES，配方归属组装机（含流体输入/输出走管道口）。
(function() {
  for (const f of BARREL_FLUIDS) {
    const barrel = f + '-barrel';
    RECIPES['fill-' + barrel] = { time: 1, inp: { 'barrel': 1, [f]: BARREL_CAP }, out: { [barrel]: 1 } };
    RECIPES['empty-' + barrel] = { time: 1, inp: { [barrel]: 1 }, out: { 'barrel': 1, [f]: BARREL_CAP } };
  }
  // 空桶制造配方（对齐《异星工厂》：钢桶由钢板压制）
  RECIPES['barrel'] = { time: 1, inp: { 'steel-plate': 1 }, out: { 'barrel': 1 } };
})();

// ===== 筛选/需求可选物品全集（对齐《异星工厂》：机械臂筛选、物流需求箱可筛选任意可生产物品）=====
// FILTER_CHOICES 为基础静态清单；此处动态补全所有“可通过配方/冶炼/离心/炼油生产、或可建造/可收集”
// 的物品，保证机械臂筛选与需求箱能选到任意中间件/终局物品（高级电路板、处理器、电池、引擎、火箭部件等）。
let _filterChoicesCache = null;
function filterChoices() {
  if (_filterChoicesCache) return _filterChoicesCache;
  const set = new Set(FILTER_CHOICES);
  // 收集所有配方/炼油/离心配方中的输入输出
  const addRec = (rec) => { if (!rec) return; for (const k in rec.inp) set.add(k); for (const k in (rec.out || rec.prob || {})) set.add(k); };
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

const CHEM_RECIPES = ['plastic-bar', 'crack-light', 'crack-gas', 'lubricant', 'solid-fuel', 'solid-fuel-light-oil', 'solid-fuel-heavy-oil', 'sulfur', 'sulfuric-acid', 'carbon', 'carbon-fiber', 'lithium', 'thruster-fuel', 'thruster-oxidizer', 'advanced-thruster-fuel', 'advanced-thruster-oxidizer', 'flamethrower-ammo'];
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
// 铀浓缩处理：10 铀矿石 → 概率产出 1 件铀（0.7% 铀-235，99.3% 铀-238），12s
//   概率用 prob 字段表达（离心机按概率随机产出 1 件），与确定性 out 配方区分。
// Kovarex 富集循环（铀增殖处理）由通用配方表 RECIPES['kovarex'] 承载（也由离心机执行）。
const CENTRIFUGE_RECIPES = {
  'uranium-processing': { name: '铀浓缩处理', time: 12, inp: { 'uranium-ore': 10 }, prob: { 'uranium-235': 0.007, 'uranium-238': 0.993 } },
  // 核燃料后处理（对齐《异星工厂》Nuclear fuel reprocessing）：5 根贫化铀燃料棒 → 3 铀-238，60s，闭合核燃料循环
  'nuclear-fuel-reprocessing': { name: '核燃料后处理', time: 60, inp: { 'depleted-uranium-fuel-cell': 5 }, out: { 'uranium-238': 3 } }
};
function isCentrifugeRecipe(id) { return CENTRIFUGE_RECIPES[id] !== undefined || id === 'kovarex'; }

// ---- 配方归属设备 ----
// 判断某配方适用于哪台设备：炼油厂 / 化工厂 / 离心机 / 组装机。
const DEVICE_NAMES = {
  'assembling-machine-1': '组装机',
  'chemical-plant': '化工厂',
  'oil-refinery': '炼油厂',
  'centrifuge': '离心机',
  'electromagnetic-plant': '电磁工厂',
  'biochamber': '生化炉',
  'crusher': '破碎机',
  'foundry': '铸造厂',
  'agricultural-tower': '农业塔',
  'space-platform-hub': '空间平台中枢'
};
// 电磁工厂专属配方（太空时代电磁产品）：超导体 / 电磁科研包 / 电磁工厂本体
const ELECTRO_RECIPES = ['superconductor', 'electromagnetic-science-pack', 'electromagnetic-plant', 'promethium-science-pack'];
function isElectroRecipe(id) { return ELECTRO_RECIPES.indexOf(id) >= 0; }
// 生化炉专属配方（太空时代生物产品）：果泥 / 生物流 / 营养素 / 生物硫磺 / 农业科研包 / 生化炉本体
const BIOCHAMBER_RECIPES = ['yumako-mash', 'bioflux', 'nutrients-from-bioflux', 'biosulfur', 'agricultural-science-pack', 'biochamber'];
function isBiochamberRecipe(id) { return BIOCHAMBER_RECIPES.indexOf(id) >= 0; }
// 破碎机专属配方（太空时代小行星碎块加工）：金属/碳质/氧化星块粉碎 + 破碎机本体 + 冰熔化
const CRUSHER_RECIPES = ['metallic-asteroid-crushing', 'carbonic-asteroid-crushing', 'oxide-asteroid-crushing',
  'advanced-metallic-asteroid-crushing', 'advanced-carbonic-asteroid-crushing', 'advanced-oxide-asteroid-crushing',
  'metallic-asteroid-reprocessing', 'carbonic-asteroid-reprocessing', 'oxide-asteroid-reprocessing',
  'crusher', 'ice-melting'];
function isCrusherRecipe(id) { return CRUSHER_RECIPES.indexOf(id) >= 0; }
// 铸造厂专属配方（太空时代 Vulcanus 冶金产品）：钨板 / 碳化钨 / 冶金科研包 / 铸造厂本体
const FOUNDRY_RECIPES = ['tungsten-ore', 'tungsten-plate', 'tungsten-carbide', 'metallurgic-science-pack', 'foundry'];
function isFoundryRecipe(id) { return FOUNDRY_RECIPES.indexOf(id) >= 0; }
// 农业塔专属种植配方（太空时代 Gleba 作物种植）：玉玛果种植 + 农业塔本体
const AGRICULTURE_TOWER_RECIPES = ['yumako-growing'];
function isAgricultureTowerRecipe(id) { return AGRICULTURE_TOWER_RECIPES.indexOf(id) >= 0; }
// 空间平台中枢专属配方（太空时代空间平台产品）：地基 / 起始包 / 中枢本体
const HUB_RECIPES = ['space-platform-foundation', 'space-platform-starter-pack', 'space-platform-hub'];
function isHubRecipe(id) { return HUB_RECIPES.indexOf(id) >= 0; }
function recipeDevice(id) {
  if (GAME_DATA.recipeDevice && GAME_DATA.recipeDevice[id]) return GAME_DATA.recipeDevice[id];
  if (isElectroRecipe(id)) return 'electromagnetic-plant';
  if (isBiochamberRecipe(id)) return 'biochamber';
  if (isCrusherRecipe(id)) return 'crusher';
  if (isFoundryRecipe(id)) return 'foundry';
  if (isAgricultureTowerRecipe(id)) return 'agricultural-tower';
  if (isHubRecipe(id)) return 'space-platform-hub';
  if (isRefineryRecipe(id)) return 'oil-refinery';
  if (isChemRecipe(id)) return 'chemical-plant';
  if (isCentrifugeRecipe(id)) return 'centrifuge';
  return 'assembling-machine-1';
}
function recipeDeviceName(id) { return DEVICE_NAMES[recipeDevice(id)] || ''; }

// 天然资源（非合成产出，需开采/采集获得），悬停时标明无配方原因
const RAW_RESOURCES = ['iron-ore', 'copper-ore', 'coal', 'stone', 'uranium-ore', 'wood', 'raw-fish', 'calcite'];

// 无配方物品：返回「无配方原因」文案（未知则写「无」）
function itemNoRecipeReason(id) {
  if (FLUIDS.indexOf(id) >= 0) return '流体，无法合成，需开采或生产获得';
  if (RAW_RESOURCES.indexOf(id) >= 0) return '天然资源，无合成配方，需开采/采集获得';
  if (id.indexOf('creative-') === 0 || id.indexOf('void-') === 0 ) return '测试物品，无合成配方';
  if (id === 'rocket-part') return '由火箭发射井逐件组装获得，无手工配方';
  if (id === 'space-science-pack') return '卫星发射后由火箭发射井产出，无合成配方';
  if (id === 'depleted-uranium-fuel-cell') return '核燃料棒反应后的副产物，无法合成';
  if (id === 'barrel') return '由灌装机倒空流体桶后获得';
  if (id.indexOf('-barrel') >= 0) return '由灌装机灌装对应流体获得';
  return '无';
}

// 返回物品作为产物时对应的合成配方描述（用于 tooltip 展示）；
// 有配方返回配方，无配方返回「无配方原因」（未知写「无」）。
// 覆盖：熔炉冶炼（SMELTS）、组装机 / 化工厂 / 炼油厂 / 离心机等全部合成配方，
// 并支持含流体输入/输出的配方（流体按名称展示）。
function itemRecipeText(id) {
  // 熔炉冶炼配方（铁板/铜板/钢板/石砖）
  for (const s of SMELTS) {
    if (s.id === id) {
      const inpName = ITEMS[s.inp] ? ITEMS[s.inp].name : s.inp;
      const inpCount = s.inCount || 1;
      const outName = ITEMS[id] ? ITEMS[id].name : id;
      const outCount = s.outCount || 1;
      return '配方（熔炉）：' + inpName + (inpCount > 1 ? '×' + inpCount : '') +
        ' → ' + outName + (outCount > 1 ? '×' + outCount : '');
    }
  }
  // 查找该物品作为产物对应的配方，并定位其所属设备（含炼油/离心/化工等）
  let rec = RECIPES[id];
  let devId = recipeDevice(id);
  let found = !!(rec && rec.inp);
  if (!found) {
    const candidates = [
      [REFINERY_RECIPES, 'oil-refinery'],
      [CENTRIFUGE_RECIPES, 'centrifuge'],
      [RECIPES, 'assembling-machine-1']
    ];
    outer:
    for (const [table, dev] of candidates) {
      for (const key in table) {
        const r = table[key];
        if (r && ((r.out && r.out[id] !== undefined) || (r.prob && r.prob[id] !== undefined))) { rec = r; devId = dev; found = true; break outer; }
      }
    }
  }
  if (!found || !rec || !rec.inp) return itemNoRecipeReason(id);
  const inpParts = Object.keys(rec.inp).map(k => (ITEMS[k] ? ITEMS[k].name : k) + "×" + rec.inp[k]);
  const outParts = rec.prob
    ? Object.keys(rec.prob).map(k => (ITEMS[k] ? ITEMS[k].name : k) + "（" + (rec.prob[k] * 100) + "%）")
    : Object.keys(rec.out).map(k => (ITEMS[k] ? ITEMS[k].name : k) + (rec.out[k] > 1 ? "×" + rec.out[k] : ""));
  const dev = DEVICE_NAMES[devId] || "组装机";
  return "配方（" + dev + "）：" + inpParts.join(" + ") + " → " + outParts.join(" + ");
}

// ===== 官方配方数据桥接（GAME_DATA 由 factorio-data 现场生成，见 tools/generate-game-data.js）=====
// 唯一数值源 = factorio-data；此处在文件末尾把自动生成配方合并进 RECIPES（自动覆盖手工同名键，
// 未生成的键（保留手工 / 官方无 / 引用未知物品）保持手工值不变）。
for (const k in GAME_DATA.recipe) RECIPES[k] = GAME_DATA.recipe[k];

