'use strict';

const RECIPES = {
  'steel-plate':        { time: 16,  inp: { 'iron-plate': 5 },                                   out: { 'steel-plate': 1 } },
  'iron-gear':          { time: 0.5, inp: { 'iron-plate': 2 },                                   out: { 'iron-gear': 1 } },
  'iron-stick':         { time: 0.5, inp: { 'iron-plate': 1 },                                   out: { 'iron-stick': 2 } },
  'steel-stick':        { time: 0.5, inp: { 'steel-plate': 1 },                                  out: { 'steel-stick': 2 } },
  'copper-cable':       { time: 0.5, inp: { 'copper-plate': 1 },                                 out: { 'copper-cable': 2 } },
  'green-circuit':      { time: 0.5, inp: { 'iron-plate': 1, 'copper-cable': 3 },                out: { 'green-circuit': 1 } },
  'science-pack':       { time: 5,   inp: { 'copper-plate': 1, 'iron-gear': 1 },                 out: { 'science-pack': 1 } },
  'transport-belt':     { time: 0.5, inp: { 'iron-plate': 1, 'iron-gear': 1 },                   out: { 'transport-belt': 2 } },
  'fast-transport-belt': { time: 0.5, inp: { 'transport-belt': 1, 'iron-gear': 1 },                  out: { 'fast-transport-belt': 1 } },  // 对齐官方：1传送带+1齿轮→1
  'express-transport-belt': { time: 0.5, inp: { 'fast-transport-belt': 1, 'iron-gear': 5 }, out: { 'express-transport-belt': 1 } },
  'underground':        { time: 1.5, inp: { 'transport-belt': 2, 'iron-gear': 2, 'iron-stick': 5 },       out: { 'underground': 2 } },  // 对齐官方：2传送带+2齿轮+5铁杆→2
  'fast-underground-belt': { time: 1, inp: { 'underground': 1, 'fast-transport-belt': 2, 'iron-gear': 2 },                  out: { 'fast-underground-belt': 2 } },  // 对齐官方：1地下带+2快带+2齿轮→2
  'express-underground-belt': { time: 1, inp: { 'fast-underground-belt': 1, 'iron-gear': 10 }, out: { 'express-underground-belt': 1 } },
  'splitter':           { time: 1,   inp: { 'transport-belt': 2, 'iron-gear': 1, 'iron-stick': 4 },       out: { 'splitter': 1 } },  // 对齐官方：2传送带+1齿轮+4铁杆→1
  'fast-splitter':   { time: 1, inp: { 'splitter': 1, 'iron-gear': 5 }, out: { 'fast-splitter': 1 } },
  'express-splitter': { time: 1, inp: { 'fast-transport-belt': 4, 'iron-gear': 10 }, out: { 'express-splitter': 1 } },
  'inserter':           { time: 0.5, inp: { 'iron-plate': 1, 'iron-gear': 1, 'green-circuit': 1 }, out: { 'inserter': 1 } },
  'burner-inserter':    { time: 0.5, inp: { 'iron-plate': 1, 'iron-gear': 1 },                  out: { 'burner-inserter': 1 } },
  'long-inserter':      { time: 0.5, inp: { 'inserter': 1, 'iron-gear': 1 },                             out: { 'long-inserter': 1 } },
  'fast-inserter':     { time: 0.5, inp: { 'inserter': 1, 'iron-plate': 2 },                             out: { 'fast-inserter': 1 } },
  'burner-drill':       { time: 2,   inp: { 'iron-plate': 4, 'iron-gear': 2 },                   out: { 'burner-drill': 1 } },
  'stone-furnace':      { time: 0.5, inp: { 'stone': 5 },                                        out: { 'stone-furnace': 1 } },
  'storage-chest':      { time: 1,   inp: { 'iron-plate': 8 },                                   out: { 'storage-chest': 1 } },
  'assembling-machine': { time: 2,   inp: { 'iron-plate': 5, 'iron-gear': 2, 'green-circuit': 2 }, out: { 'assembling-machine': 1 } },  // 对齐官方：5铁板+2齿轮+2电路板
  'lab':                { time: 3,   inp: { 'iron-gear': 10, 'green-circuit': 10, 'stone': 10 },   out: { 'lab': 1 } },  // 对齐官方：10齿轮+10电路板+10石头
  'boiler':             { time: 1.5, inp: { 'stone': 5, 'iron-plate': 1 },                         out: { 'boiler': 1 } },
  'steam-engine':       { time: 2,   inp: { 'iron-plate': 2, 'iron-gear': 1, 'pipe': 1 },          out: { 'steam-engine': 1 } },
  'offshore-pump':      { time: 1,   inp: { 'iron-plate': 5, 'iron-gear': 1 },                     out: { 'offshore-pump': 1 } },
  'electric-drill':     { time: 2,   inp: { 'iron-plate': 8, 'iron-gear': 3, 'green-circuit': 2 },                     out: { 'electric-drill': 1 } },  // 对齐官方：8铁板+3齿轮+2电路板
  'electric-furnace':   { time: 2.5, inp: { 'steel-plate': 8, 'iron-plate': 5, 'advanced-circuit': 3, 'stone-brick': 2 }, out: { 'electric-furnace': 1 } },
  'assembling-machine-mk2': { time: 3, inp: { 'assembling-machine': 2, 'steel-plate': 2, 'iron-gear': 2, 'green-circuit': 4 }, out: { 'assembling-machine-mk2': 1 } },  // 对齐官方：2组装机I+2钢板+2齿轮+4电路板
  'stack-inserter':    { time: 0.5, inp: { 'inserter': 1, 'iron-gear': 15 },                       out: { 'stack-inserter': 1 } },  // 对齐官方：1机械臂+15齿轮
  'green-science':     { time: 6,   inp: { 'transport-belt': 1, 'inserter': 1 },                  out: { 'green-science': 1 } },  // 对齐《异星工厂》物流科学包：1传送带+1机械臂，耗时 6s
  'blue-science':      { time: 8,   inp: { 'plastic-bar': 2, 'green-circuit': 2, 'copper-plate': 1 }, out: { 'blue-science': 1 } },
  'pipe':              { time: 0.5, inp: { 'iron-plate': 1 },                                     out: { 'pipe': 1 } },
  'pumpjack':          { time: 2.5, inp: { 'steel-plate': 4, 'iron-gear': 3, 'green-circuit': 2 }, out: { 'pumpjack': 1 } },
  'refinery':          { time: 3,   inp: { 'steel-plate': 8, 'iron-gear': 4, 'pipe': 10, 'green-circuit': 5 },      out: { 'refinery': 1 } },
  'chemical-plant':    { time: 4,   inp: { 'steel-plate': 5, 'iron-gear': 5, 'pipe': 10, 'green-circuit': 5 }, out: { 'chemical-plant': 1 } },
  'storage-tank':      { time: 2,   inp: { 'steel-plate': 4, 'iron-gear': 2, 'pipe': 4 }, out: { 'storage-tank': 1 } },
  'steel-chest':      { time: 1,   inp: { 'steel-plate': 8 }, out: { 'steel-chest': 1 } },
  // ===== 基础储物箱（木箱→铁箱→钢箱递进，对齐《异星工厂》） =====
  'wooden-chest':     { time: 0.5, inp: { 'wood': 2 }, out: { 'wooden-chest': 1 } },
  'iron-chest':       { time: 1,   inp: { 'iron-plate': 8 }, out: { 'iron-chest': 1 } },  // 对齐官方：8铁板→1铁箱
  // ===== 钓鱼竿（对齐《异星工厂》Fishing pole：1 木材 + 1 铁杆 → 1 鱼竿，需「钓鱼」科技） =====
  'fishing-pole':     { time: 1,   inp: { 'wood': 1, 'iron-stick': 1 }, out: { 'fishing-pole': 1 } },
  // ===== 修理包（对齐《异星工厂》Repair pack） =====
  'repair-pack':      { time: 1,   inp: { 'iron-gear': 1, 'copper-plate': 2 }, out: { 'repair-pack': 1 } },
  // ===== 开采工具配方（对齐《异星工厂》Iron axe / Steel axe） =====
  'iron-axe':  { time: 1.5, inp: { 'iron-plate': 2, 'iron-stick': 2 }, out: { 'iron-axe': 1 } },
  'steel-axe': { time: 3,   inp: { 'steel-plate': 2, 'iron-stick': 2 }, out: { 'steel-axe': 1 } },
  // ===== 规划器配方（对齐《异星工厂》Deconstruction planner / Upgrade planner） =====
  'deconstruction-planner': { time: 1, inp: { 'iron-plate': 1 }, out: { 'deconstruction-planner': 1 } },
  'upgrade-planner': { time: 1, inp: { 'iron-plate': 1, 'green-circuit': 1 }, out: { 'upgrade-planner': 1 } },
  'steel-furnace':    { time: 2,   inp: { 'steel-plate': 8, 'stone': 6 }, out: { 'steel-furnace': 1 } },
  'assembling-machine-3': { time: 3, inp: { 'assembling-machine-mk2': 2, 'steel-plate': 4, 'iron-gear': 4, 'advanced-circuit': 4, 'processing-unit': 4 }, out: { 'assembling-machine-3': 1 } },  // 对齐官方：2组装机II+4钢板+4齿轮+4红板+4处理器
  'pipe-to-ground':   { time: 1,   inp: { 'pipe': 10, 'iron-plate': 5 }, out: { 'pipe-to-ground': 1 } },
  'pump':             { time: 1,   inp: { 'iron-plate': 4, 'steel-plate': 2, 'green-circuit': 1 }, out: { 'pump': 1 } },
  'solar-panel':      { time: 5,   inp: { 'copper-plate': 5, 'steel-plate': 5, 'green-circuit': 5 }, out: { 'solar-panel': 1 } },
  'accumulator':      { time: 3,   inp: { 'iron-plate': 2, 'copper-plate': 2, 'iron-gear': 2 }, out: { 'accumulator': 1 } },
  'military-science': { time: 10,  inp: { 'grenade': 1, 'stone-wall': 1, 'piercing-rounds': 1 }, out: { 'military-science': 1 } },  // 对齐《异星工厂》军事科学包：石墙+穿甲弹+手雷，耗时 10s
  // ===== 后期科学包（对齐《异星工厂》7 色科学包）=====
  'flying-robot-frame': { time: 20, inp: { 'electric-engine': 1, 'battery': 2, 'steel-plate': 2, 'green-circuit': 3 }, out: { 'flying-robot-frame': 1 } },
  'production-science-pack': { time: 21, inp: { 'rail': 30, 'electric-furnace': 1, 'productivity-module': 1 }, out: { 'production-science-pack': 1 } },  // 对齐官方：30铁轨+1电炉+1产能模块
  'utility-science-pack': { time: 21, inp: { 'processing-unit': 1, 'flying-robot-frame': 1, 'low-density-structure': 3 }, out: { 'utility-science-pack': 1 } },
  // 空间科学包：卫星发射后由火箭发射井产出（非合成配方，见 rocket.js 发射逻辑）
  'gun-turret':       { time: 3,   inp: { 'iron-plate': 10, 'iron-gear': 4, 'copper-plate': 2 }, out: { 'gun-turret': 1 } },
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
  // 固体燃料·重油（对齐《异星工厂》：三种原油产物均可压制固体燃料，重油出料比与轻油一致）
  'solid-fuel-heavy-oil': { time: 2, inp: { 'heavy-oil': 10 },                                   out: { 'solid-fuel': 1 } },
  // ===== 铁路系统（火车） =====
  'rail':              { time: 0.5, inp: { 'iron-plate': 1, 'stone': 1, 'iron-stick': 1 },          out: { 'rail': 2 } },
  'locomotive':        { time: 4,   inp: { 'iron-plate': 16, 'steel-plate': 6, 'iron-gear': 8, 'green-circuit': 4 }, out: { 'locomotive': 1 } },
  'diesel-locomotive': { time: 5,   inp: { 'engine-unit': 20, 'steel-plate': 10, 'processing-unit': 5 },        out: { 'diesel-locomotive': 1 } },
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
  // 蜘蛛遥控器（对齐《异星工厂》Spidertron remote）：用于远程命令蜘蛛机器人移动
  'spidertron-remote': { time: 5, inp: { 'processing-unit': 2, 'advanced-circuit': 4, 'iron-gear': 6, 'battery': 2 }, out: { 'spidertron-remote': 1 } },
  'land-mine':         { time: 2,   inp: { 'iron-plate': 3, 'steel-plate': 1, 'explosive': 2 },         out: { 'land-mine': 4 } },
  'cliff-explosives':  { time: 8,   inp: { 'explosive': 10, 'iron-plate': 5, 'stone': 5 },               out: { 'cliff-explosives': 20 } },
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
  'rocket-ammo':      { time: 1,   inp: { 'explosive': 1, 'iron-plate': 2 },                      out: { 'rocket-ammo': 1 } },
  'explosive-rocket':  { time: 1.5, inp: { 'rocket-ammo': 1, 'explosive': 2, 'steel-plate': 2 },        out: { 'explosive-rocket': 1 } },
  // 原子弹（对齐《异星工厂》Atomic bomb）：铀-235 + 火箭弹 + 爆炸物 + 处理器 → 终极核武器
  'atomic-bomb':  { time: 30, inp: { 'uranium-235': 1, 'rocket-ammo': 1, 'explosive': 2, 'processing-unit': 2 }, out: { 'atomic-bomb': 1 } },
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
  'laser-turret':      { time: 4,   inp: { 'steel-plate': 8, 'iron-gear': 4, 'green-circuit': 10, 'battery': 2 },  out: { 'laser-turret': 1 } },
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
  'electric-engine':   { time: 10,  inp: { 'engine-unit': 1, 'green-circuit': 2, 'lubricant': 1 }, out: { 'electric-engine': 1 } },
  'processing-unit':   { time: 10,  inp: { 'advanced-circuit': 2, 'green-circuit': 20, 'copper-cable': 4 }, out: { 'processing-unit': 1 } },
  'low-density-structure': { time: 20, inp: { 'copper-plate': 20, 'plastic-bar': 2, 'steel-plate': 2 }, out: { 'low-density-structure': 1 } },  // 对齐官方：20铜板+2塑料板+2钢板
  'rocket-fuel':       { time: 8,   inp: { 'solid-fuel': 10, 'light-oil': 10, 'electric-engine': 1 }, out: { 'rocket-fuel': 1 } },
  'rocket-control-unit': { time: 15, inp: { 'processing-unit': 1, 'advanced-circuit': 3 },          out: { 'rocket-control-unit': 1 } },
  'satellite':         { time: 10,  inp: { 'rocket-control-unit': 1, 'low-density-structure': 100, 'processing-unit': 1, 'solar-panel': 1 }, out: { 'satellite': 1 } },
  'rocket-silo':       { time: 20,  inp: { 'steel-plate': 50, 'engine-unit': 20, 'processing-unit': 20, 'green-circuit': 50 }, out: { 'rocket-silo': 1 } },
  'radar':             { time: 2,   inp: { 'iron-plate': 5, 'steel-plate': 2, 'green-circuit': 4 }, out: { 'radar': 1 } },
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
  'kovarex':           { time: 60, inp: { 'uranium-238': 40, 'uranium-235': 1 },                  out: { 'uranium-235': 2, 'uranium-238': 41 } },
  // 核燃料（组装机）：由铀-235 制成
  'nuclear-fuel':      { time: 10,  inp: { 'uranium-235': 1 },                                 out: { 'nuclear-fuel': 1 } },
  // 铀燃料棒（对齐《异星工厂》：1 铀-235 + 19 铀-238 → 1 燃料棒，组装机）：反应堆专用燃料，燃尽产废燃料棒
  'uranium-fuel-cell': { time: 10,  inp: { 'uranium-235': 1, 'uranium-238': 19 },            out: { 'uranium-fuel-cell': 1 } },
  // 离心机/反应堆/汽轮机（组装机制造）
  'centrifuge':        { time: 2,   inp: { 'iron-plate': 8, 'iron-gear': 4, 'green-circuit': 4 },                 out: { 'centrifuge': 1 } },
  'nuclear-reactor':   { time: 15,  inp: { 'steel-plate': 40, 'copper-plate': 20, 'battery': 5, 'centrifuge': 1 }, out: { 'nuclear-reactor': 1 } },
  'steam-turbine':     { time: 5,   inp: { 'steel-plate': 20, 'iron-gear': 8, 'copper-plate': 10 }, out: { 'steam-turbine': 1 } },
  'heat-pipe':         { time: 1,   inp: { 'steel-plate': 4, 'copper-plate': 3 }, out: { 'heat-pipe': 1 } },
  'heat-exchanger':    { time: 3,   inp: { 'steel-plate': 15, 'iron-gear': 4, 'copper-plate': 15, 'pipe': 10 }, out: { 'heat-exchanger': 1 } },
  // ===== 电路网络配方 =====
  'small-electric-pole': { time: 0.5, inp: { 'iron-plate': 1, 'copper-plate': 1 },                   out: { 'small-electric-pole': 1 } },
  'substation':        { time: 2,   inp: { 'big-electric-pole': 2, 'steel-plate': 2, 'copper-plate': 8, 'processing-unit': 2 }, out: { 'substation': 1 } },
  'programmable-speaker': { time: 1.5, inp: { 'iron-plate': 3, 'green-circuit': 3, 'advanced-circuit': 1, 'copper-cable': 4 }, out: { 'programmable-speaker': 1 } },
  'lamp':              { time: 0.5, inp: { 'iron-plate': 1, 'copper-cable': 2 },                   out: { 'lamp': 1 } },
  'medium-electric-pole': { time: 1,  inp: { 'iron-plate': 3, 'copper-plate': 2, 'iron-gear': 1 },   out: { 'medium-electric-pole': 1 } },
  'big-electric-pole': { time: 1.5,   inp: { 'iron-plate': 5, 'copper-plate': 3, 'iron-gear': 2 },   out: { 'big-electric-pole': 1 } },
  'constant-combinator': { time: 1.5, inp: { 'iron-plate': 4, 'green-circuit': 2, 'copper-cable': 4 }, out: { 'constant-combinator': 1 } },
  'arithmetic-combinator': { time: 1.5, inp: { 'iron-plate': 4, 'green-circuit': 3, 'copper-cable': 4 }, out: { 'arithmetic-combinator': 1 } },
  'decider-combinator': { time: 1.5,  inp: { 'iron-plate': 4, 'green-circuit': 3, 'copper-cable': 4 }, out: { 'decider-combinator': 1 } },
  // 功率开关（对齐《异星工厂》Power switch）：铁板 + 电路板 + 铜线
  'power-switch':       { time: 1.5,  inp: { 'iron-plate': 4, 'green-circuit': 2, 'copper-cable': 4 }, out: { 'power-switch': 1 } },
  // 红/绿电路线缆（对齐《异星工厂》：用铜线+电路板制成，用于手动区分接入红/绿网络）
  'red-wire':          { time: 1,    inp: { 'copper-cable': 2, 'green-circuit': 1 },                   out: { 'red-wire': 4 } },
  'green-wire':        { time: 1,    inp: { 'copper-cable': 2, 'green-circuit': 1 },                   out: { 'green-wire': 4 } },
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

// ===== 筛选/需求可选物品全集（对齐《异星工厂》：机械臂筛选、物流需求箱可筛选任意可生产物品）=====
// FILTER_CHOICES 为基础静态清单；此处动态补全所有“可通过配方/冶炼/离心/炼油生产、或可建造/可收集”
// 的物品，保证机械臂筛选与需求箱能选到任意中间件/终局物品（高级电路板、处理器、电池、引擎、火箭部件等）。
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

const CHEM_RECIPES = ['plastic-bar', 'crack-light', 'crack-gas', 'lubricant', 'solid-fuel', 'solid-fuel-light-oil', 'solid-fuel-heavy-oil', 'sulfur', 'sulfuric-acid', 'flamethrower-ammo'];
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
// 铀浓缩处理：10 铀矿石 → 小概率 1 铀-235 + 大量铀-238
// Kovarex 富集循环由通用配方表 RECIPES['kovarex'] 承载（也由离心机执行）。
const CENTRIFUGE_RECIPES = {
  'uranium-processing': { name: '铀浓缩处理', time: 12, inp: { 'uranium-ore': 10 }, out: { 'uranium-235': 1, 'uranium-238': 9 } },
  // 废燃料棒再生（对齐《异星工厂》Nuclear fuel reprocessing）：5 根废棒 → 3 铀-238，闭合核燃料循环
  'used-fuel-reprocessing': { name: '乏燃料后处理', time: 12, inp: { 'used-up-uranium-fuel-cell': 5 }, out: { 'uranium-238': 3 } }
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

// 天然资源（非合成产出，需开采/采集获得），悬停时标明无配方原因
const RAW_RESOURCES = ['iron-ore', 'copper-ore', 'coal', 'stone', 'uranium-ore', 'wood', 'raw-fish', 'calcite'];

// 无配方物品：返回「无配方原因」文案（未知则写「无」）
function itemNoRecipeReason(id) {
  if (FLUIDS.indexOf(id) >= 0) return '流体，无法合成，需开采或生产获得';
  if (RAW_RESOURCES.indexOf(id) >= 0) return '天然资源，无合成配方，需开采/采集获得';
  if (id.indexOf('creative-') === 0 || id.indexOf('void-') === 0 || id === 'passive-power') return '测试物品，无合成配方';
  if (id === 'rocket-part') return '由火箭发射井逐件组装获得，无手工配方';
  if (id === 'space-science-pack') return '卫星发射后由火箭发射井产出，无合成配方';
  if (id === 'used-up-uranium-fuel-cell') return '核燃料棒反应后的副产物，无法合成';
  if (id === 'empty-barrel') return '由灌装机倒空流体桶后获得';
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
      [REFINERY_RECIPES, 'refinery'],
      [CENTRIFUGE_RECIPES, 'centrifuge'],
      [RECIPES, 'assembling-machine']
    ];
    outer:
    for (const [table, dev] of candidates) {
      for (const key in table) {
        const r = table[key];
        if (r && r.out && r.out[id] !== undefined) { rec = r; devId = dev; found = true; break outer; }
      }
    }
  }
  if (!found || !rec || !rec.inp) return itemNoRecipeReason(id);
  const inpParts = Object.keys(rec.inp).map(k => (ITEMS[k] ? ITEMS[k].name : k) + "×" + rec.inp[k]);
  const outParts = Object.keys(rec.out).map(k => (ITEMS[k] ? ITEMS[k].name : k) + (rec.out[k] > 1 ? "×" + rec.out[k] : ""));
  const dev = DEVICE_NAMES[devId] || "组装机";
  return "配方（" + dev + "）：" + inpParts.join(" + ") + " → " + outParts.join(" + ");
}

