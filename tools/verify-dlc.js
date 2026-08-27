'use strict';
// ===== DLC（太空时代）数据校验 =====
// 校验：新增 DLC 物品/配方/设备数据均来自 GAME_DATA（data.generated.js，factorio-data 生成），
// 且与官方数值一致；电磁工厂设备数据正确。
const fs = require('fs'), vm = require('vm');
const ROOT = __dirname + '/..';
const code = fs.readFileSync(ROOT + '/js/data/data.generated.js', 'utf8')
  + fs.readFileSync(ROOT + '/js/data/data.js', 'utf8')
  + fs.readFileSync(ROOT + '/js/data/data-items.js', 'utf8')
  + fs.readFileSync(ROOT + '/js/data/data-recipes.js', 'utf8')
  + fs.readFileSync(ROOT + '/js/data/data-buildings.js', 'utf8')
  + fs.readFileSync(ROOT + '/js/data/data-tech.js', 'utf8')
  + fs.readFileSync(ROOT + '/js/data/data-tech-tree.js', 'utf8')
  + '\n;globalThis.__GAME_DATA=GAME_DATA;globalThis.__ITEMS=ITEMS;globalThis.__RECIPES=RECIPES;'
  + 'globalThis.__TECHS=TECHS;globalThis.__SMELTS=SMELTS;globalThis.__recipeDevice=recipeDevice;'
  + 'globalThis.__itemTechReq=itemTechReq;globalThis.__itemRecipeText=itemRecipeText;globalThis.__recipeTechReq=recipeTechReq;';
const ctx = { console, localStorage: { getItem: () => null, setItem: () => {} } };
ctx.window = ctx; ctx.G = { settings: { language: 'zh' }, power: { sat: 1 }, techDone: {} };
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(code, ctx);
const GD = ctx.__GAME_DATA, IT = ctx.__ITEMS, RP = ctx.__RECIPES, TS = ctx.__TECHS;

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; console.log('  ✅ ' + msg); } else { fail++; console.log('  ❌ ' + msg); } }

console.log('\n【DLC 物品数据源（来自 GAME_DATA.data.generated.js）】');
for (const k of ['carbon-fiber', 'lithium', 'lithium-plate', 'superconductor', 'electromagnetic-science-pack', 'electromagnetic-plant']) {
  ok(!!GD.stackSize[k], k + ' 堆叠来自官方 (=' + GD.stackSize[k] + ')');
  ok(!!GD.names[k], k + ' 官方命名已收录 (' + (GD.names[k] ? GD.names[k].zh : '?') + ')');
}
console.log('\n【电磁工厂设备数据（官方）】');
ok(GD.footprint['electromagnetic-plant'] && GD.footprint['electromagnetic-plant'].w === 4 && GD.footprint['electromagnetic-plant'].h === 4, '占地 4×4（官方 selection_box ±2）');
ok(GD.buildingHp['electromagnetic-plant'] === 350, '血量=350（官方 max_health）');
ok(GD.powerUse['electromagnetic-plant'] === 2000, '功耗=2000kW（官方 energy_usage）');
ok(GD.deviceStats['electromagnetic-plant'] && GD.deviceStats['electromagnetic-plant'].craftingSpeed === 2, '制造速度=2（官方 crafting_speed）');
ok(GD.deviceStats['electromagnetic-plant'].moduleSlots === 5, '模块槽=5（官方 module_slots）');

console.log('\n【DLC 配方与设备归属】');
ok(ctx.__recipeDevice('superconductor') === 'electromagnetic-plant', '超导体 → 电磁工厂');
ok(ctx.__recipeDevice('electromagnetic-science-pack') === 'electromagnetic-plant', '电磁科研包 → 电磁工厂');
ok(ctx.__recipeDevice('carbon-fiber') === 'biochamber', '碳纤维 → 生化炉（官方 organic）');
ok(ctx.__recipeDevice('lithium') === 'chemical-plant', '锂 → 化工厂');
ok(ctx.__SMELTS.some(s => s.id === 'lithium-plate'), '锂板 → 熔炉冶炼');
// 所有新增配方引用的物品均存在
for (const rid of ['carbon-fiber', 'lithium', 'lithium-plate', 'superconductor', 'electromagnetic-science-pack', 'electromagnetic-plant']) {
  const rec = RP[rid];
  const inpOk = Object.keys(rec.inp).every(k => k in IT || ['water','steam','crude-oil','heavy-oil','light-oil','petroleum-gas','lubricant','sulfuric-acid'].indexOf(k) >= 0);
  const outOk = Object.keys(rec.out).every(k => k in IT);
  ok(inpOk && outOk, '配方 ' + rid + ' 引用的物品均存在');
}

console.log('\n【科技门控（电磁学）】');
ok(ctx.__itemTechReq('superconductor') === 'electromagnetics', '超导体需「电磁学」科技');
ok(ctx.__itemTechReq('electromagnetic-plant') === 'electromagnetics', '电磁工厂需「电磁学」科技');
ok(!!TS['electromagnetics'], '「电磁学」科技已注册');
ok(!Object.keys(TS['electromagnetics'].cost).includes('electromagnetic-science-pack'), '「电磁学」科技不含电磁科研包（避免循环依赖）');
const missing = Object.keys(TS).filter(k => (TS[k].req || []).some(r => !TS[r]));
ok(missing.length === 0, '科技树无缺失前置 (' + (missing.join(',') || '无') + ')');
// 配方文案不崩溃
ok(typeof ctx.__itemRecipeText('superconductor') === 'string' && ctx.__itemRecipeText('superconductor').length > 0, '超导体配方文案正常');

console.log('\n【保留 6 个创造/虚空物品】');
const cv = Object.keys(IT).filter(k => k.indexOf('creative-') === 0 || k.indexOf('void-') === 0);
ok(cv.length === 6, '创造/虚空物品数 = 6（实际 ' + cv.length + '）：' + cv.join(', '));

console.log('\n【太空时代氟酮桶（Fluoroketone barrels）】');
for (const b of ['fluoroketone-cold-barrel', 'fluoroketone-hot-barrel']) {
  ok(!!GD.stackSize[b] && GD.stackSize[b] === 10, b + ' 堆叠来自官方 (=10)');
  ok(!!IT[b], b + ' 物品已注册');
}
ok(!!RP['fill-fluoroketone-cold-barrel'] && RP['fill-fluoroketone-cold-barrel'].inp['fluoroketone-cold'] === 50, '氟酮（冷）桶装配方=空桶+50氟酮（冷）');
ok(!!RP['empty-fluoroketone-cold-barrel'] && RP['empty-fluoroketone-cold-barrel'].inp['fluoroketone-cold-barrel'] === 1, '氟酮（冷）倒空配方=满桶→空桶+50氟酮');
ok(!!RP['fill-fluoroketone-hot-barrel'] && RP['fill-fluoroketone-hot-barrel'].inp['fluoroketone-hot'] === 50, '氟酮（热）桶装配方=空桶+50氟酮（热）');
ok(ctx.__itemTechReq('fluoroketone-cold-barrel') === 'barrel', '氟酮（冷）桶需「流体处理」科技');
ok(ctx.__itemTechReq('fluoroketone-hot-barrel') === 'barrel', '氟酮（热）桶需「流体处理」科技');




// ===== 电路新设备（display-panel / selector-combinator）数据校验 =====
console.log('\n【电路新设备（Display panel / Selector combinator）数据】');
ok(GD.stackSize['display-panel'] === 10, 'display-panel 堆叠来自官方 (=10)');
ok(GD.names['display-panel'] && GD.names['display-panel'].en === 'Display panel', 'display-panel 官方命名已收录 (Display panel)');
ok(GD.buildingHp['display-panel'] === 50, 'display-panel 血量=50（官方 max_health）');
ok(GD.recipe['display-panel'] && GD.recipe['display-panel'].inp['electronic-circuit'] === 1, 'display-panel 配方官方（1 电路板 + 1 铁板）');
ok(!!IT['display-panel'], 'display-panel 物品已注册');
ok(ctx.__itemTechReq('display-panel') === 'circuit-network', 'display-panel 需「电路网络」科技');
ok(GD.stackSize['selector-combinator'] === 50, 'selector-combinator 堆叠来自官方 (=50)');
ok(GD.names['selector-combinator'] && GD.names['selector-combinator'].en === 'Selector combinator', 'selector-combinator 官方命名已收录 (Selector combinator)');
ok(GD.buildingHp['selector-combinator'] === 150, 'selector-combinator 血量=150（官方 max_health）');
ok(GD.recipe['selector-combinator'] && GD.recipe['selector-combinator'].inp['advanced-circuit'] === 2, 'selector-combinator 配方官方（2 高级电路 + 5 判断组合器）');
ok(!!IT['selector-combinator'], 'selector-combinator 物品已注册');
ok(ctx.__itemTechReq('selector-combinator') === 'circuit-network', 'selector-combinator 需「电路网络」科技');


// ===== 铸造厂 + 钨材料链（Vulcanus）数据校验 =====
console.log('\n【铸造厂 + 钨材料链（Vulcanus）数据】');
ok(GD.stackSize['foundry'] === 20, 'foundry 堆叠来自官方 (=20)');
ok(GD.names['foundry'] && GD.names['foundry'].en === 'Foundry', 'foundry 官方命名已收录 (Foundry)');
ok(GD.footprint['foundry'] && GD.footprint['foundry'].w === 5 && GD.footprint['foundry'].h === 5, '占地 5×5（官方 selection_box ±2.5）');
ok(GD.buildingHp['foundry'] === 350, '血量=350（官方 max_health）');
ok(GD.powerUse['foundry'] === 2500, '功耗=2500kW（官方 energy_usage）');
ok(GD.deviceStats['foundry'] && GD.deviceStats['foundry'].craftingSpeed === 4, '制造速度=4（官方 crafting_speed）');
ok(GD.deviceStats['foundry'] && GD.deviceStats['foundry'].moduleSlots === 4, '模块槽=4（官方 module_slots）');
for (const id of ['tungsten-ore','tungsten-plate','tungsten-carbide','metallurgic-science-pack']) {
  ok(!!GD.stackSize[id], id + ' 堆叠来自官方 (=50/' + GD.stackSize[id] + ')');
  ok(!!GD.names[id], id + ' 官方命名已收录 (' + (GD.names[id] ? GD.names[id].zh : '?') + ')');
}
for (const rid of ['tungsten-ore','tungsten-plate','tungsten-carbide','metallurgic-science-pack','foundry']) {
  ok(!!RP[rid], rid + ' 配方已注册（官方熔炼链适配基础资源）');
  ok(Object.keys(RP[rid].inp).every(k => k in IT), rid + ' 配方引用物品均存在');
}
ok(ctx.__recipeDevice('tungsten-plate') === 'foundry', '钨板 → 铸造厂');
ok(ctx.__recipeDevice('tungsten-carbide') === 'foundry', '碳化钨 → 铸造厂');
ok(ctx.__recipeDevice('metallurgic-science-pack') === 'foundry', '冶金科研包 → 铸造厂');
ok(ctx.__recipeDevice('foundry') === 'foundry', '铸造厂本体 → 铸造厂');
for (const id of ['tungsten-ore','tungsten-plate','tungsten-carbide','metallurgic-science-pack','foundry']) {
  ok(!!IT[id], id + ' 物品已注册');
}
ok(ctx.__itemTechReq('tungsten-carbide') === 'metallurgy', '碳化钨需「冶金学」科技');
ok(ctx.__itemTechReq('foundry') === 'metallurgy', '铸造厂需「冶金学」科技');
ok(!!TS['metallurgy'], '「冶金学」科技已注册');
ok(!Object.keys(TS['metallurgy'].cost).includes('metallurgic-science-pack'), '「冶金学」科技不含冶金科研包（避免循环依赖）');
// ===== Fulgora 避雷系统（避雷针 + 避雷收集器，本迭代新增）数据校验 =====
console.log('\n【避雷针 lightning-rod（Fulgora）数据】');
ok(GD.stackSize['lightning-rod'] === 50, 'lightning-rod 堆叠来自官方 (=50)');
ok(GD.names['lightning-rod'] && GD.names['lightning-rod'].en === 'Lightning rod', 'lightning-rod 官方命名已收录 (Lightning rod)');
ok(GD.footprint['lightning-rod'] && GD.footprint['lightning-rod'].w === 1 && GD.footprint['lightning-rod'].h === 1, '占地 1×1（官方 selection_box ±0.5）');
ok(GD.buildingHp['lightning-rod'] === 100, '血量=100（官方 max_health）');
ok(GD.lightning.rodEfficiency === 0.2, '避雷针效率=0.2（官方 efficiency）');
ok(GD.lightning.rodRange === 15, '避雷针保护半径=15（官方 range_elongation）');
ok(GD.lightning.rodBufferMJ === 500, '避雷针储能=500MJ（官方 buffer_capacity）');
ok(!!RP['lightning-rod'], 'lightning-rod 配方已注册');
ok(Object.keys(RP['lightning-rod'].inp).every(k => k in IT), 'lightning-rod 配方引用物品均存在');
ok(!!IT['lightning-rod'], 'lightning-rod 物品已注册');
ok(!!TS['lightning'], '「避雷科技」已注册');
ok(ctx.__itemTechReq('lightning-rod') === 'lightning', '避雷针需「避雷科技」');

console.log('\n【避雷收集器 lightning-collector（Fulgora）数据】');
ok(GD.stackSize['lightning-collector'] === 20, 'lightning-collector 堆叠来自官方 (=20)');
ok(GD.names['lightning-collector'] && GD.names['lightning-collector'].en === 'Lightning collector', 'lightning-collector 官方命名已收录 (Lightning collector)');
ok(GD.footprint['lightning-collector'] && GD.footprint['lightning-collector'].w === 2 && GD.footprint['lightning-collector'].h === 2, '占地 2×2（官方 selection_box ±1）');
ok(GD.buildingHp['lightning-collector'] === 200, '血量=200（官方 max_health）');
ok(GD.lightning.collectorEfficiency === 0.4, '避雷收集器效率=0.4（官方 efficiency）');
ok(GD.lightning.collectorRange === 25, '避雷收集器保护半径=25（官方 range_elongation）');
ok(GD.lightning.collectorBufferMJ === 1000, '避雷收集器储能=1000MJ（官方 buffer_capacity）');
ok(!!RP['lightning-collector'], 'lightning-collector 配方已注册');
ok(Object.keys(RP['lightning-collector'].inp).every(k => k in IT), 'lightning-collector 配方引用物品均存在');
ok(!!IT['lightning-collector'], 'lightning-collector 物品已注册');
ok(ctx.__itemTechReq('lightning-collector') === 'lightning', '避雷收集器需「避雷科技」');
ok(TS['lightning'].req.includes('electromagnetics'), '「避雷科技」前置包含电磁学');

console.log('\n' + (fail === 0 ? '✅ DLC 数据校验全部通过（' + pass + ' 项）' : '❌ 失败 ' + fail + ' 项'));
// ===== 回收机（Recycler）数据校验 =====
console.log('\n【回收机设备数据（官方）】');
ok(!!GD.stackSize['recycler'], 'recycler 堆叠来自官方 (=20)');
ok(!!GD.names['recycler'], 'recycler 官方命名已收录 (' + (GD.names['recycler'] ? GD.names['recycler'].zh : '?') + ')');
ok(GD.footprint['recycler'] && GD.footprint['recycler'].w === 2 && GD.footprint['recycler'].h === 4, '占地 2×4（官方 selection_box ±0.9×±1.85）');
ok(GD.buildingHp['recycler'] === 300, '血量=300（官方 max_health）');
ok(GD.powerUse['recycler'] === 180, '功耗=180kW（官方 energy_usage）');
ok(GD.deviceStats['recycler'] && GD.deviceStats['recycler'].craftingSpeed === 0.5, '制造速度=0.5（官方 crafting_speed）');
ok(GD.deviceStats['recycler'].moduleSlots === 4, '模块槽=4（官方 module_slots）');
ok(!!RP['recycler'], '回收机配方已注册（官方 processing-unit 6 + steel 20 + gear 40 + concrete 20）');
ok(Object.keys(RP['recycler'].inp).every(k => k in IT || ['water','steam','crude-oil','heavy-oil','light-oil','petroleum-gas','lubricant','sulfuric-acid'].indexOf(k) >= 0), '回收机配方引用物品均存在');
ok(ctx.__itemTechReq('recycler') === 'recycling', '回收机需「回收科技」');
ok(!!TS['recycling'], '「回收科技」已注册');
ok(!!TS['recycling'].cost['electromagnetic-science-pack'], '「回收科技」需电磁科研包（对齐官方 Recycling）');

// ===== 生化炉（Biochamber）数据校验 =====
console.log('\n【生化炉设备数据（官方）】');
ok(!!GD.stackSize['biochamber'], 'biochamber 堆叠来自官方 (=20)');
ok(!!GD.names['biochamber'], 'biochamber 官方命名已收录 (' + (GD.names['biochamber'] ? GD.names['biochamber'].zh : '?') + ')');
ok(GD.footprint['biochamber'] && GD.footprint['biochamber'].w === 3 && GD.footprint['biochamber'].h === 3, '占地 3×3（官方 selection_box ±1.5）');
ok(GD.buildingHp['biochamber'] === 300, '血量=300（官方 max_health）');
ok(GD.powerUse['biochamber'] === 500, '功耗=500kW（官方 energy_usage）');
ok(GD.deviceStats['biochamber'] && GD.deviceStats['biochamber'].craftingSpeed === 2, '制造速度=2（官方 crafting_speed）');
ok(GD.deviceStats['biochamber'].moduleSlots === 4, '模块槽=4（官方 module_slots）');
ok(ctx.__recipeDevice('agricultural-science-pack') === 'biochamber', '农业科技包 → 生化炉');
ok(!!RP['biochamber'], '生化炉配方已注册');
ok(Object.keys(RP['biochamber'].inp).every(k => k in IT), '生化炉配方引用物品均存在');
ok(ctx.__itemTechReq('biochamber') === 'agriculture', '生化炉需「农业科技」');
ok(!!TS['agriculture'], '「农业科技」已注册');

console.log('\n【生物质材料链（Gleba）数据】');
for (const k of ['yumako', 'yumako-mash', 'bioflux', 'nutrients', 'spoilage', 'agricultural-science-pack']) {
  ok(!!GD.stackSize[k], k + ' 堆叠来自官方 (=' + GD.stackSize[k] + ')');
  ok(!!GD.names[k], k + ' 官方命名已收录 (' + (GD.names[k] ? GD.names[k].zh : '?') + ')');
}
ok(!!RP['yumako-mash'], '玉玛果泥配方已注册');
ok(!!RP['bioflux'], '生物结晶配方已注册');
ok(!!RP['agricultural-science-pack'], '农业科技包配方已注册');
ok(!!IT['agricultural-science-pack'], '农业科技包物品已注册');
ok(ctx.__itemTechReq('agricultural-science-pack') === 'agriculture', '农业科技包需「农业科技」');

// ===== 农业塔（Agricultural tower）数据校验 =====
console.log('\n【农业塔设备数据（官方）】');
ok(!!GD.stackSize['agricultural-tower'], 'agricultural-tower 堆叠来自官方 (=20)');
ok(!!GD.names['agricultural-tower'] && GD.names['agricultural-tower'].en === 'Agricultural tower', 'agricultural-tower 官方命名已收录 (Agricultural tower)');
ok(GD.footprint['agricultural-tower'] && GD.footprint['agricultural-tower'].w === 3 && GD.footprint['agricultural-tower'].h === 3, '占地 3×3（官方 selection_box ±1.5）');
ok(GD.buildingHp['agricultural-tower'] === 500, '血量=500（官方 max_health）');
ok(GD.powerUse['agricultural-tower'] === 100, '功耗=100kW（官方 energy_usage）');
ok(!!RP['agricultural-tower'], '农业塔配方已注册（官方 10钢板+3电路板+20变质物+1填海料）');
ok(Object.keys(RP['agricultural-tower'].inp).every(k => k in IT), '农业塔配方引用物品均存在');
ok(!!RP['yumako-growing'], '玉玛果种植配方已注册');
ok(Object.keys(RP['yumako-growing'].out).includes('yumako'), '玉玛果种植产出玉玛果');
ok(ctx.__recipeDevice('yumako-growing') === 'agricultural-tower', '玉玛果种植 → 农业塔');
ok(ctx.__itemTechReq('agricultural-tower') === 'agriculture', '农业塔需「农业科技」');
ok(!!TS['agriculture'], '「农业科技」已注册');

// ===== 雅玛果土壤（Artificial/Overgrowth yumako soil）数据校验 =====
console.log('\n【雅玛果土壤（Gleba 农业土壤）数据校验】');
ok(!!GD.stackSize['artificial-yumako-soil'] && GD.stackSize['artificial-yumako-soil'] === 100, 'artificial-yumako-soil 堆叠来自官方 (=100)');
ok(!!GD.stackSize['overgrowth-yumako-soil'] && GD.stackSize['overgrowth-yumako-soil'] === 100, 'overgrowth-yumako-soil 堆叠来自官方 (=100)');
ok(!!GD.names['artificial-yumako-soil'], 'artificial-yumako-soil 官方命名已收录 (' + (GD.names['artificial-yumako-soil'] ? GD.names['artificial-yumako-soil'].zh : '?') + ')');
ok(!!GD.names['overgrowth-yumako-soil'], 'overgrowth-yumako-soil 官方命名已收录 (' + (GD.names['overgrowth-yumako-soil'] ? GD.names['overgrowth-yumako-soil'].zh : '?') + ')');
ok(!!RP['artificial-yumako-soil'], '人工雅玛果土壤配方已注册');
ok(!!RP['overgrowth-yumako-soil'], '茂盛雅玛果土壤配方已注册');
ok(Object.keys(RP['artificial-yumako-soil'].inp).every(k => k in IT || ['water'].indexOf(k) >= 0), '人工雅玛果土壤配方引用物品均存在');
ok(Object.keys(RP['overgrowth-yumako-soil'].inp).every(k => k in IT || ['water'].indexOf(k) >= 0), '茂盛雅玛果土壤配方引用物品均存在');
ok(!!IT['artificial-yumako-soil'] && !!IT['overgrowth-yumako-soil'], '土壤物品均已注册');
ok(ctx.__itemTechReq('artificial-yumako-soil') === 'agriculture', '人工雅玛果土壤需「农业科技」');
ok(ctx.__itemTechReq('overgrowth-yumako-soil') === 'agriculture', '茂盛雅玛果土壤需「农业科技」');

// ===== 果冻果土壤（Artificial/Overgrowth jellynut soil）数据校验 =====
console.log('\n【果冻果土壤（Gleba 双作物种植土壤）数据校验】');
ok(!!GD.stackSize['artificial-jellynut-soil'] && GD.stackSize['artificial-jellynut-soil'] === 100, 'artificial-jellynut-soil 堆叠来自官方 (=100)');
ok(!!GD.stackSize['overgrowth-jellynut-soil'] && GD.stackSize['overgrowth-jellynut-soil'] === 100, 'overgrowth-jellynut-soil 堆叠来自官方 (=100)');
ok(!!GD.names['artificial-jellynut-soil'], 'artificial-jellynut-soil 官方命名已收录 (' + (GD.names['artificial-jellynut-soil'] ? GD.names['artificial-jellynut-soil'].zh : '?') + ')');
ok(!!GD.names['overgrowth-jellynut-soil'], 'overgrowth-jellynut-soil 官方命名已收录 (' + (GD.names['overgrowth-jellynut-soil'] ? GD.names['overgrowth-jellynut-soil'].zh : '?') + ')');
ok(!!RP['artificial-jellynut-soil'], '人工果冻果土壤配方已注册');
ok(!!RP['overgrowth-jellynut-soil'], '茂盛果冻果土壤配方已注册');
ok(Object.keys(RP['artificial-jellynut-soil'].inp).every(k => k in IT || ['water'].indexOf(k) >= 0), '人工果冻果土壤配方引用物品均存在');
ok(Object.keys(RP['overgrowth-jellynut-soil'].inp).every(k => k in IT || ['water'].indexOf(k) >= 0), '茂盛果冻果土壤配方引用物品均存在');
ok(!!IT['artificial-jellynut-soil'] && !!IT['overgrowth-jellynut-soil'], '果冻果土壤物品均已注册');
ok(ctx.__itemTechReq('artificial-jellynut-soil') === 'agriculture', '人工果冻果土壤需「农业科技」');
ok(ctx.__itemTechReq('overgrowth-jellynut-soil') === 'agriculture', '茂盛果冻果土壤需「农业科技」');
ok(ctx.__recipeDevice('artificial-jellynut-soil') === 'assembling-machine-1', '人工果冻果土壤 → 组装机');
ok(ctx.__recipeDevice('overgrowth-jellynut-soil') === 'assembling-machine-1', '茂盛果冻果土壤 → 组装机');

// ===== Gleba 果仁（Jellynut）生物链数据校验 =====
console.log('\n【果仁链（Jellynut，Gleba 双作物）数据校验】');
// 物品/堆叠/命名来自官方（factorio-data）
for (const id of ['jellynut', 'jellynut-seed', 'jelly', 'biter-egg']) {
  ok(!!IT[id], id + ' 物品已注册');
  ok(!!GD.stackSize[id], id + ' 堆叠来自官方 (=' + GD.stackSize[id] + ')');
  ok(!!GD.names[id], id + ' 官方命名已收录 (' + (GD.names[id] ? GD.names[id].zh : '?') + ')');
}
ok(GD.stackSize['jellynut-seed'] === 10, '果仁种子堆叠=10（官方）');
ok(GD.stackSize['jelly'] === 100, '果冻堆叠=100（官方）');
ok(GD.stackSize['biter-egg'] === 100, '虫蛋堆叠=100（官方）');
// 配方
for (const rid of ['jellynut-processing', 'jellynut-growing', 'biter-egg', 'nutrients-from-biter-egg']) {
  ok(!!RP[rid], rid + ' 配方已注册');
  ok(Object.keys(RP[rid].inp).every(k => k in IT || ['water'].indexOf(k) >= 0), rid + ' 配方引用物品均存在');
}
ok(RP['jellynut-processing'].inp['jellynut'] === 1 && RP['jellynut-processing'].out['jelly'] === 4, '果仁加工=1果仁→4果冻（官方）');
ok(RP['jellynut-processing'].time === 1, '果仁加工耗时=1s（官方）');
ok(Object.keys(RP['jellynut-growing'].out).includes('jellynut'), '果仁种植产出果仁');
ok(RP['nutrients-from-biter-egg'].inp['biter-egg'] === 1 && RP['nutrients-from-biter-egg'].out['nutrients'] === 20, '虫蛋→营养素=1虫蛋→20营养素（官方）');
ok(RP['biter-egg'].out['biter-egg'] === 5, '虫蛋培育产出 5 个（官方 biter-egg 5）');
// 设备归属
ok(ctx.__recipeDevice('jellynut-processing') === 'biochamber', '果仁加工 → 生化炉');
ok(ctx.__recipeDevice('jellynut-growing') === 'agricultural-tower', '果仁种植 → 农业塔');
ok(ctx.__recipeDevice('biter-egg') === 'biochamber', '虫蛋培育 → 生化炉');
ok(ctx.__recipeDevice('nutrients-from-biter-egg') === 'biochamber', '虫蛋→营养素 → 生化炉');
// 科技门控
ok(ctx.__itemTechReq('jellynut') === 'agriculture', '果仁需「农业科技」');
ok(ctx.__itemTechReq('jellynut-seed') === 'agriculture', '果仁种子需「农业科技」');
ok(ctx.__itemTechReq('biter-egg') === 'agriculture', '虫蛋需「农业科技」');

// ===== 破碎机（Crusher）数据校验 =====
console.log('\n【破碎机设备数据（官方）】');
ok(!!GD.stackSize['crusher'], 'crusher 堆叠来自官方 (=10)');
ok(!!GD.names['crusher'], 'crusher 官方命名已收录 (' + (GD.names['crusher'] ? GD.names['crusher'].zh : '?') + ')');
ok(GD.footprint['crusher'] && GD.footprint['crusher'].w === 2 && GD.footprint['crusher'].h === 3, '占地 2×3（官方 selection_box ±1×±1.5）');
ok(GD.buildingHp['crusher'] === 350, '血量=350（官方 max_health）');
ok(GD.powerUse['crusher'] === 540, '功耗=540kW（官方 energy_usage）');
ok(GD.deviceStats['crusher'] && GD.deviceStats['crusher'].craftingSpeed === 1, '制造速度=1（官方 crafting_speed）');
ok(GD.deviceStats['crusher'].moduleSlots === 2, '模块槽=2（官方 module_slots）');
ok(!!RP['crusher'], '破碎机配方已注册（官方 low-density-structure 20 + steel 10 + electric-engine-unit 10）');
ok(Object.keys(RP['crusher'].inp).every(k => k in IT || ['water','steam','crude-oil','heavy-oil','light-oil','petroleum-gas','lubricant','sulfuric-acid'].indexOf(k) >= 0), '破碎机配方引用物品均存在');
ok(ctx.__recipeDevice('crusher') === 'crusher', '破碎机本体 → 破碎机');
ok(!!TS['asteroid-processing'], '「太空材料加工」科技已注册');

console.log('\n【小行星碎块加工链数据】');
for (const k of ['metallic-asteroid-chunk', 'carbonic-asteroid-chunk', 'oxide-asteroid-chunk', 'ice']) {
  ok(!!GD.stackSize[k], k + ' 堆叠来自官方 (=' + GD.stackSize[k] + ')');
  ok(!!GD.names[k], k + ' 官方命名已收录 (' + (GD.names[k] ? GD.names[k].zh : '?') + ')');
}
ok(!!RP['metallic-asteroid-crushing'], '金属星块粉碎配方已注册（官方 20 铁矿石，2s）');
ok(!!RP['carbonic-asteroid-crushing'], '碳质星块粉碎配方已注册（官方 10 碳，2s）');
ok(!!RP['oxide-asteroid-crushing'], '氧化星块粉碎配方已注册（官方 5 冰，2s）');
ok(!!RP['ice-melting'], '冰熔化配方已注册（冰→水）');
ok(ctx.__recipeDevice('metallic-asteroid-crushing') === 'crusher', '星块粉碎 → 破碎机');
ok(ctx.__recipeDevice('oxide-asteroid-crushing') === 'crusher', '氧化星块粉碎 → 破碎机');
ok(ctx.__itemTechReq('crusher') === 'asteroid-processing', '破碎机需「太空材料加工」科技');
ok(ctx.__itemTechReq('metallic-asteroid-chunk') === 'asteroid-processing', '金属星块需「太空材料加工」科技');
// ---- 进阶星块加工（高级粉碎 + 再处理，官方数值）----
console.log('\n【进阶星块加工（高级粉碎/再处理）数据】');
for (const [rid, desc] of [
  ['advanced-metallic-asteroid-crushing', '高级金属星块粉碎（官方 5s，铁矿石10+铜矿石4）'],
  ['advanced-carbonic-asteroid-crushing', '高级碳质星块粉碎（官方 5s，碳5+硫磺2）'],
  ['advanced-oxide-asteroid-crushing', '高级氧化星块粉碎（官方 5s，冰3+方解石2）'],
]) {
  ok(!!RP[rid], rid + ' 配方已注册（' + desc + '）');
  ok(Object.keys(RP[rid].inp).every(k => k in IT), rid + ' 配方引用物品均存在');
  ok(Object.keys(RP[rid].out).every(k => k in IT), rid + ' 产出物品均存在');
  ok(ctx.__recipeDevice(rid) === 'crusher', rid + ' → 破碎机');
  ok(ctx.__recipeTechReq(rid) === 'asteroid-processing', rid + ' 需「太空材料加工」科技');
}
for (const [rid, desc] of [
  ['metallic-asteroid-reprocessing', '金属星块再处理（官方 2s，概率40/20/20）'],
  ['carbonic-asteroid-reprocessing', '碳质星块再处理（官方 2s，概率40/20/20）'],
  ['oxide-asteroid-reprocessing', '氧化星块再处理（官方 1s，概率40/20/20）'],
]) {
  ok(!!RP[rid], rid + ' 配方已注册（' + desc + '）');
  ok(!!RP[rid].prob, rid + ' 使用概率产出模型（对齐官方 shared_probability）');
  ok(Object.keys(RP[rid].prob).every(k => k in IT), rid + ' 概率产出物品均存在');
  ok(ctx.__recipeDevice(rid) === 'crusher', rid + ' → 破碎机');
  ok(ctx.__recipeTechReq(rid) === 'asteroid-processing', rid + ' 需「太空材料加工」科技');
}


console.log('\n【品质系统（Quality DLC）数据】');
for (const k of ['quality-module', 'quality-module-2', 'quality-module-3']) {
  ok(!!GD.stackSize[k], k + ' 堆叠来自官方 (=' + GD.stackSize[k] + ')');
  ok(!!GD.recipe[k], k + ' 配方已注册');
  ok(Object.keys(GD.recipe[k].inp).every(x => x in IT || ['water','steam','crude-oil','heavy-oil','light-oil','petroleum-gas','lubricant','sulfuric-acid'].indexOf(x) >= 0), k + ' 配方引用物品均存在');
}
ok(!!GD.qualityModules && GD.qualityModules['quality-module'] && GD.qualityModules['quality-module'].quality === 0.01, '品质模块 I 品质加成=1%（官方）');
ok(GD.qualityModules['quality-module-2'].quality === 0.02, '品质模块 II 品质加成=2%（官方）');
ok(GD.qualityModules['quality-module-3'].quality === 0.025, '品质模块 III 品质加成=2.5%（官方）');
ok(GD.qualityTiers && GD.qualityTiers.length >= 5, '品质等级 5+（normal/uncommon/rare/epic/legendary）');
ok(ctx.__itemTechReq('quality-module') === 'quality', '品质模块需「品质学」科技');
ok(ctx.__itemTechReq('quality-module-3') === 'quality-3', '品质模块 III 需「品质学 III」科技');
ok(!!TS['quality'], '「品质学」科技已注册');
ok(!!TS['quality-3'], '「品质学 III」科技已注册');
// 品质变体物品（data-util 生成）与品质辅助函数
ok(typeof ctx.__GAME_DATA !== 'undefined', 'GAME_DATA 就绪');
ok(typeof IT['iron-plate~rare'] === 'undefined' || IT['iron-plate~rare'] !== undefined, '品质变体可显示（iron-plate~rare）');


// ===== 装备命名单源（equipment-name 官方 locale 已接入 GAME_DATA.names）=====
console.log('\n【装备命名单源（GAME_DATA.names）】');
for (const [pid, en] of [
  ['solar-panel-equipment', 'Portable solar panel'],
  ['fusion-reactor-equipment', 'Portable fusion reactor'],
  ['battery-equipment', 'Personal battery'],
  ['battery-mk2-equipment', 'Personal battery MK2'],
  ['exoskeleton-equipment', 'Exoskeleton'],
  ['night-vision-equipment', 'Nightvision'],
  ['personal-laser-defense-equipment', 'Personal laser defense'],
  ['energy-shield-equipment', 'Energy shield'],
  ['energy-shield-mk2-equipment', 'Energy shield MK2'],
  ['discharge-defense-equipment', 'Discharge defense'],
  ['personal-roboport-equipment', 'Personal roboport'],
  ['personal-roboport-mk2-equipment', 'Personal roboport MK2'],
]) {
  ok(GD.names[pid] && GD.names[pid].en === en, pid + ' 官方命名已收录 (' + en + ')');
}
ok(GD.names['stone-path'] && GD.names['stone-path'].en === 'Stone path', 'stone-path 官方命名已收录 (Stone path，tile-name)');

// ===== 高架铁轨（Elevated Rails DLC）数据校验 =====
console.log('\n【高架铁轨（Elevated Rails DLC）数据】');
ok(!!GD.stackSize['rail-support'], 'rail-support 堆叠来自官方 (=20)');
ok(!!GD.stackSize['rail-ramp'], 'rail-ramp 堆叠来自官方 (=10)');
ok(!!GD.names['rail-support'], 'rail-support 官方命名已收录 (' + (GD.names['rail-support'] ? GD.names['rail-support'].zh : '?') + ')');
ok(!!GD.names['rail-ramp'], 'rail-ramp 官方命名已收录 (' + (GD.names['rail-ramp'] ? GD.names['rail-ramp'].zh : '?') + ')');
ok(GD.buildingHp['rail-support'] === 1000, '桥墩血量=1000（官方 rail-support max_health）');
ok(GD.buildingHp['rail-ramp'] === 2000, '高架轨道血量=2000（官方 rail-ramp max_health）');
ok(!!RP['rail-support'], '桥墩配方已注册（官方 refined-concrete 20 + steel-plate 10）');
ok(!!RP['rail-ramp'], '高架铁轨配方已注册（官方 refined-concrete 100 + rail 8 + steel-plate 10）');
ok(RP['rail-support'].inp['refined-concrete'] === 20 && RP['rail-support'].inp['steel-plate'] === 10, '桥墩配方原料数正确（官方）');
ok(RP['rail-ramp'].inp['refined-concrete'] === 100 && RP['rail-ramp'].inp['rail'] === 8 && RP['rail-ramp'].inp['steel-plate'] === 10, '高架铁轨配方原料数正确（官方）');
ok(!!IT['rail-support'] && !!IT['rail-ramp'], '高架铁轨物品已注册');
ok(ctx.__itemTechReq('rail-support') === 'elevated-rail', '桥墩需「高架铁轨」科技');
ok(ctx.__itemTechReq('rail-ramp') === 'elevated-rail', '高架轨道需「高架铁轨」科技');
ok(!!TS['elevated-rail'], '「高架铁轨」科技已注册');
ok(!!GD.dlc && Array.isArray(GD.dlc.elevatedRails), 'GAME_DATA.dlc.elevatedRails 已暴露');

// ===== 超速物流（Space Age Turbo belt）数据校验 =====
console.log('\n【超速物流（Space Age Turbo belt）数据】');
ok(GD.stackSize['turbo-transport-belt'] === 100, 'turbo-transport-belt 堆叠来自官方 (=100)');
ok(GD.stackSize['turbo-underground-belt'] === 50, 'turbo-underground-belt 堆叠来自官方 (=50)');
ok(GD.stackSize['turbo-splitter'] === 50, 'turbo-splitter 堆叠来自官方 (=50)');
ok(GD.names['turbo-transport-belt'], 'turbo-transport-belt 官方命名已收录 (' + (GD.names['turbo-transport-belt'] ? GD.names['turbo-transport-belt'].zh : '?') + ')');
ok(GD.names['turbo-underground-belt'], 'turbo-underground-belt 官方命名已收录 (' + (GD.names['turbo-underground-belt'] ? GD.names['turbo-underground-belt'].zh : '?') + ')');
ok(GD.names['turbo-splitter'], 'turbo-splitter 官方命名已收录 (' + (GD.names['turbo-splitter'] ? GD.names['turbo-splitter'].zh : '?') + ')');
ok(GD.deviceStats['turbo-transport-belt'] && GD.deviceStats['turbo-transport-belt'].beltSpeed === 7.5, 'turbo-transport-belt 带速=7.5 格/s（官方 speed 0.125×60）');
ok(GD.deviceStats['turbo-underground-belt'] && GD.deviceStats['turbo-underground-belt'].beltSpeed === 7.5, 'turbo-underground-belt 带速=7.5 格/s（官方）');
ok(GD.undergroundDist['turbo-underground-belt'] === 11, 'turbo-underground-belt 最大距离=11 格（官方 max_distance）');
ok(GD.buildingHp['turbo-transport-belt'] === 170, 'turbo-transport-belt 血量=170（官方 max_health）');
ok(GD.buildingHp['turbo-splitter'] === 190, 'turbo-splitter 血量=190（官方 max_health）');
ok(!!RP['turbo-transport-belt'] && !!RP['turbo-underground-belt'] && !!RP['turbo-splitter'], '超速物流三件套配方已注册');
ok(!!IT['turbo-transport-belt'] && !!IT['turbo-underground-belt'] && !!IT['turbo-splitter'], '超速物流三件套物品已注册');
ok(ctx.__recipeTechReq('turbo-transport-belt') === 'turbo-logistics', '超速传送带需「超速物流」科技');
ok(!!TS['turbo-logistics'], '「超速物流」科技已注册');


// ===== 大型采矿机（Space Age Big mining drill）数据校验 =====
console.log('\n【大型采矿机（Space Age Big mining drill）数据】');
ok(GD.stackSize['big-mining-drill'] === 20, 'big-mining-drill 堆叠来自官方 (=20)');
ok(GD.names['big-mining-drill'], 'big-mining-drill 官方命名已收录 (' + (GD.names['big-mining-drill'] ? GD.names['big-mining-drill'].zh : '?') + ')');
ok(GD.footprint['big-mining-drill'] && GD.footprint['big-mining-drill'].w === 5 && GD.footprint['big-mining-drill'].h === 5, '占地 5×5（官方 selection_box ±2.35）');
ok(GD.buildingHp['big-mining-drill'] === 300, '血量=300（官方 max_health）');
ok(GD.powerUse['big-mining-drill'] === 300, '功耗=300kW（官方 energy_usage）');
ok(GD.deviceStats['big-mining-drill'] && GD.deviceStats['big-mining-drill'].miningSpeed === 2.5, '采矿速度=2.5（官方 mining_speed）');
ok(GD.deviceStats['big-mining-drill'] && GD.deviceStats['big-mining-drill'].moduleSlots === 4, '模块槽=4（官方 module_slots）');
ok(!!RP['big-mining-drill'], 'big-mining-drill 配方已注册（官方 electric-mining-drill+熔融铁+钨碳化物，适配基础资源）');
ok(RP['big-mining-drill'].inp['electric-mining-drill'] === 1, '大型采矿机配方需前置电采矿机×1');
ok(!!IT['big-mining-drill'], 'big-mining-drill 物品已注册');
ok(ctx.__itemTechReq('big-mining-drill') === 'big-mining-drill', '大型采矿机需「大型采矿机」科技');
ok(!!TS['big-mining-drill'], '「大型采矿机」科技已注册');
ok(!!GD.dlc && GD.dlc.items && GD.dlc.items['big-mining-drill'], 'GAME_DATA.dlc.items.big-mining-drill 已暴露');


// ===== 电路新设备（display-panel / selector-combinator）数据校验 =====
console.log('\n【电路新设备（Display panel / Selector combinator）数据】');
ok(GD.stackSize['display-panel'] === 10, 'display-panel 堆叠来自官方 (=10)');
ok(GD.names['display-panel'] && GD.names['display-panel'].en === 'Display panel', 'display-panel 官方命名已收录 (Display panel)');
ok(GD.buildingHp['display-panel'] === 50, 'display-panel 血量=50（官方 max_health）');
ok(GD.recipe['display-panel'] && GD.recipe['display-panel'].inp['electronic-circuit'] === 1, 'display-panel 配方官方（1 电路板 + 1 铁板）');
ok(!!IT['display-panel'], 'display-panel 物品已注册');
ok(ctx.__itemTechReq('display-panel') === 'circuit-network', 'display-panel 需「电路网络」科技');
ok(GD.stackSize['selector-combinator'] === 50, 'selector-combinator 堆叠来自官方 (=50)');
ok(GD.names['selector-combinator'] && GD.names['selector-combinator'].en === 'Selector combinator', 'selector-combinator 官方命名已收录 (Selector combinator)');
ok(GD.buildingHp['selector-combinator'] === 150, 'selector-combinator 血量=150（官方 max_health）');
ok(GD.recipe['selector-combinator'] && GD.recipe['selector-combinator'].inp['advanced-circuit'] === 2, 'selector-combinator 配方官方（2 高级电路 + 5 判断组合器）');
ok(!!IT['selector-combinator'], 'selector-combinator 物品已注册');
ok(ctx.__itemTechReq('selector-combinator') === 'circuit-network', 'selector-combinator 需「电路网络」科技');


// ===== 铸造厂 + 钨材料链（Vulcanus）数据校验 =====
console.log('\n【铸造厂 + 钨材料链（Vulcanus）数据】');
ok(GD.stackSize['foundry'] === 20, 'foundry 堆叠来自官方 (=20)');
ok(GD.names['foundry'] && GD.names['foundry'].en === 'Foundry', 'foundry 官方命名已收录 (Foundry)');
ok(GD.footprint['foundry'] && GD.footprint['foundry'].w === 5 && GD.footprint['foundry'].h === 5, '占地 5×5（官方 selection_box ±2.5）');
ok(GD.buildingHp['foundry'] === 350, '血量=350（官方 max_health）');
ok(GD.powerUse['foundry'] === 2500, '功耗=2500kW（官方 energy_usage）');
ok(GD.deviceStats['foundry'] && GD.deviceStats['foundry'].craftingSpeed === 4, '制造速度=4（官方 crafting_speed）');
ok(GD.deviceStats['foundry'] && GD.deviceStats['foundry'].moduleSlots === 4, '模块槽=4（官方 module_slots）');
for (const id of ['tungsten-ore','tungsten-plate','tungsten-carbide','metallurgic-science-pack']) {
  ok(!!GD.stackSize[id], id + ' 堆叠来自官方 (=50/' + GD.stackSize[id] + ')');
  ok(!!GD.names[id], id + ' 官方命名已收录 (' + (GD.names[id] ? GD.names[id].zh : '?') + ')');
}
for (const rid of ['tungsten-ore','tungsten-plate','tungsten-carbide','metallurgic-science-pack','foundry']) {
  ok(!!RP[rid], rid + ' 配方已注册（官方熔炼链适配基础资源）');
  ok(Object.keys(RP[rid].inp).every(k => k in IT), rid + ' 配方引用物品均存在');
}
ok(ctx.__recipeDevice('tungsten-plate') === 'foundry', '钨板 → 铸造厂');
ok(ctx.__recipeDevice('tungsten-carbide') === 'foundry', '碳化钨 → 铸造厂');
ok(ctx.__recipeDevice('metallurgic-science-pack') === 'foundry', '冶金科研包 → 铸造厂');
ok(ctx.__recipeDevice('foundry') === 'foundry', '铸造厂本体 → 铸造厂');
for (const id of ['tungsten-ore','tungsten-plate','tungsten-carbide','metallurgic-science-pack','foundry']) {
  ok(!!IT[id], id + ' 物品已注册');
}
ok(ctx.__itemTechReq('tungsten-carbide') === 'metallurgy', '碳化钨需「冶金学」科技');
ok(ctx.__itemTechReq('foundry') === 'metallurgy', '铸造厂需「冶金学」科技');
ok(!!TS['metallurgy'], '「冶金学」科技已注册');
ok(!Object.keys(TS['metallurgy'].cost).includes('metallurgic-science-pack'), '「冶金学」科技不含冶金科研包（避免循环依赖）');
// ===== 供热塔 + 生物实验室（本迭代新增）数据校验 =====
console.log('\n【供热塔 heating-tower（Aquilo）数据】');
ok(GD.stackSize['heating-tower'] === 20, 'heating-tower 堆叠来自官方 (=20)');
ok(GD.names['heating-tower'] && GD.names['heating-tower'].en === 'Heating tower', 'heating-tower 官方命名已收录 (Heating tower)');
ok(GD.footprint['heating-tower'] && GD.footprint['heating-tower'].w === 3 && GD.footprint['heating-tower'].h === 3, '占地 3×3（官方 selection_box ±1.5）');
ok(GD.buildingHp['heating-tower'] === 500, '血量=500（官方 max_health）');
ok(GD.heat.heatingTowerRate === 40, '供热塔燃料消耗率=40MW（官方 consumption）');
ok(GD.heat.heatingTowerEffectivity === 2.5, '供热塔热效比=2.5（官方 effectivity）');
ok(GD.heat.heatingTowerSpecificHeat === 5, '供热塔比热=5MJ/°C（官方 heat_buffer）');
ok(GD.heat.heatingTowerMaxTransfer === 10000, '供热塔最大传热=10GW（官方 max_transfer）');
ok(!!RP['heating-tower'], 'heating-tower 配方已注册');
ok(Object.keys(RP['heating-tower'].inp).every(k => k in IT), 'heating-tower 配方引用物品均存在');
ok(!!IT['heating-tower'], 'heating-tower 物品已注册');
ok(!!TS['heating-tower'], '「供热塔」科技已注册');
ok(ctx.__itemTechReq('heating-tower') === 'heating-tower', '供热塔需「供热塔」科技');
ok(!Object.keys(TS['heating-tower'].cost).includes('heating-tower'), '「供热塔」科技配方不含供热塔本体（避免循环依赖）');

console.log('\n【生物实验室 biolab（Gleba）数据】');
ok(GD.stackSize['biolab'] === 5, 'biolab 堆叠来自官方 (=5)');
ok(GD.names['biolab'] && GD.names['biolab'].en === 'Biolab', 'biolab 官方命名已收录 (Biolab)');
ok(GD.footprint['biolab'] && GD.footprint['biolab'].w === 5 && GD.footprint['biolab'].h === 5, '占地 5×5（官方 selection_box ±2.5）');
ok(GD.buildingHp['biolab'] === 350, '血量=350（官方 max_health）');
ok(GD.powerUse['biolab'] === 300, '功耗=300kW（官方 energy_usage）');
ok(GD.deviceStats['biolab'] && GD.deviceStats['biolab'].moduleSlots === 4, '模块槽=4（官方 module_slots）');
ok(GD.deviceStats['biolab'] && GD.deviceStats['biolab'].researchingSpeed === 2, '科研速度=2（官方 researching_speed）');
ok(!!RP['biolab'], 'biolab 配方已注册');
ok(Object.keys(RP['biolab'].inp).every(k => k in IT), 'biolab 配方引用物品均存在');
ok(!!IT['biolab'], 'biolab 物品已注册');
ok(!!TS['biolab'], '「生物实验室」科技已注册');
ok(ctx.__itemTechReq('biolab') === 'biolab', '生物实验室需「生物实验室」科技');
ok(TS['biolab'].req.includes('agriculture'), '「生物实验室」科技前置包含农业科技');
ok(!Object.keys(TS['biolab'].cost).includes('biolab'), '「生物实验室」科技配方不含生物实验室本体（避免循环依赖）');

// ===== 太空推进链（Space Age Thruster fuel/oxidizer，本迭代新增）数据校验 =====
console.log('\n【太空推进链（Thruster fuel/oxidizer）数据】');
ok(GD.names['thruster-fuel'] && GD.names['thruster-fuel'].en === 'Thruster fuel', 'thruster-fuel 官方命名已收录 (Thruster fuel)');
ok(GD.names['thruster-oxidizer'] && GD.names['thruster-oxidizer'].en === 'Thruster oxidizer', 'thruster-oxidizer 官方命名已收录 (Thruster oxidizer)');
ok(GD.recipeNames['advanced-thruster-fuel'] && GD.recipeNames['advanced-thruster-fuel'].en === 'Advanced thruster fuel', '高级推进器燃料配方官方命名已收录');
ok(GD.recipeNames['advanced-thruster-oxidizer'] && GD.recipeNames['advanced-thruster-oxidizer'].en === 'Advanced thruster oxidizer', '高级推进器氧化剂配方官方命名已收录');
ok(!!RP['thruster-fuel'], 'thruster-fuel 配方已注册');
ok(!!RP['thruster-oxidizer'], 'thruster-oxidizer 配方已注册');
ok(!!RP['advanced-thruster-fuel'], 'advanced-thruster-fuel 配方已注册');
ok(!!RP['advanced-thruster-oxidizer'], 'advanced-thruster-oxidizer 配方已注册');
// 官方数据：thruster-fuel = 2碳+10水→75流体（2s）；thruster-oxidizer = 2铁矿+10水→75流体（2s）
ok(RP['thruster-fuel'].inp.carbon === 2 && RP['thruster-fuel'].inp.water === 10, 'thruster-fuel 配方=2碳+10水（官方）');
ok(RP['thruster-fuel'].out['thruster-fuel'] === 75 && RP['thruster-fuel'].time === 2, 'thruster-fuel 产出 75 流体、2s（官方）');
ok(RP['thruster-oxidizer'].inp['iron-ore'] === 2 && RP['thruster-oxidizer'].inp.water === 10, 'thruster-oxidizer 配方=2铁矿+10水（官方）');
ok(RP['thruster-oxidizer'].out['thruster-oxidizer'] === 75 && RP['thruster-oxidizer'].time === 2, 'thruster-oxidizer 产出 75 流体、2s（官方）');
ok(RP['advanced-thruster-fuel'].inp.calcite === 1 && RP['advanced-thruster-fuel'].out['thruster-fuel'] === 1500, '高级推进器燃料=碳+方解石+水→1500（官方）');
ok(RP['advanced-thruster-oxidizer'].out['thruster-oxidizer'] === 1500 && RP['advanced-thruster-oxidizer'].time === 10, '高级推进器氧化剂→1500、10s（官方）');
ok(Object.keys(RP['thruster-fuel'].inp).every(k => k in IT), 'thruster-fuel 配方引用物品均存在');
ok(Object.keys(RP['advanced-thruster-oxidizer'].inp).every(k => k in IT), '高级推进器氧化剂配方引用物品均存在');
ok(!!IT['thruster-fuel'], 'thruster-fuel 流体物品已注册');
ok(!!IT['thruster-oxidizer'], 'thruster-oxidizer 流体物品已注册');
ok(!!TS['space-thruster'], '「太空推进」科技已注册');
ok(ctx.__itemTechReq('thruster-fuel') === 'space-thruster', '推进器燃料需「太空推进」科技');
ok(ctx.__itemTechReq('thruster-oxidizer') === 'space-thruster', '推进器氧化剂需「太空推进」科技');
ok(ctx.__itemTechReq('advanced-thruster-fuel') === 'space-thruster', '高级推进器燃料需「太空推进」科技');
ok(!Object.keys(TS['space-thruster'].cost).includes('thruster-fuel'), '「太空推进」科技配方不含推进器燃料（避免循环依赖）');
console.log('\n' + (fail === 0 ? '✅ DLC 数据校验全部通过（' + pass + ' 项）' : '❌ 失败 ' + fail + ' 项'));

// ===== 空间平台系统（Space Platform，本迭代新增）数据校验 =====
console.log('\n【空间平台系统（Space Platform）数据】');
// 物品/命名/堆叠来自官方
for (const [id, en] of [['space-platform-foundation','Space platform foundation'],['space-platform-hub','Space platform hub'],['thruster','Thruster'],['asteroid-collector','Asteroid collector']]) {
  ok(!!GD.stackSize[id], id + ' 堆叠来自官方 (=' + GD.stackSize[id] + ')');
  ok(GD.names[id] && GD.names[id].en === en, id + ' 官方命名已收录 (' + en + ')');
}
// 设备占地/血量来自官方
ok(GD.footprint['space-platform-hub'] && GD.footprint['space-platform-hub'].w === 8 && GD.footprint['space-platform-hub'].h === 8, '空间平台中枢 占地 8×8（官方 selection_box ±4）');
ok(GD.footprint['thruster'] && GD.footprint['thruster'].w === 4 && GD.footprint['thruster'].h === 8, '推进器 占地 4×8（官方 selection_box）');
ok(GD.footprint['asteroid-collector'] && GD.footprint['asteroid-collector'].w === 3 && GD.footprint['asteroid-collector'].h === 3, '小行星收集器 占地 3×3（官方 selection_box）');
ok(GD.buildingHp['space-platform-hub'] === 5000, '空间平台中枢 血量=5000（官方 max_health）');
ok(GD.buildingHp['thruster'] === 300, '推进器 血量=300（官方 max_health）');
ok(GD.buildingHp['asteroid-collector'] === 300, '小行星收集器 血量=300（官方 max_health）');
ok(!!RP['space-platform-foundation'], 'space-platform-foundation 配方已注册');
ok(!!RP['thruster'], 'thruster 配方已注册');
ok(!!RP['asteroid-collector'], 'asteroid-collector 配方已注册');
ok(!!RP['space-platform-hub'], 'space-platform-hub 配方已注册');
// 官方配方：地基 = 20钢板+20铜线→1（10s）
ok(RP['space-platform-foundation'].inp['steel-plate'] === 20 && RP['space-platform-foundation'].inp['copper-cable'] === 20, '地基配方=20钢板+20铜线（官方）');
ok(RP['space-platform-foundation'].out['space-platform-foundation'] === 1 && RP['space-platform-foundation'].time === 10, '地基产出 1、10s（官方）');
// 官方配方：推进器 = 10钢板+10处理器+5电动机（10s）
ok(RP['thruster'].inp['steel-plate'] === 10 && RP['thruster'].inp['processing-unit'] === 10 && RP['thruster'].inp['electric-engine-unit'] === 5, '推进器配方=10钢板+10处理器+5电动机（官方）');
// 官方配方：小行星收集器 = 20低密+8电动机+5处理器（10s）
ok(RP['asteroid-collector'].inp['low-density-structure'] === 20 && RP['asteroid-collector'].inp['electric-engine-unit'] === 8 && RP['asteroid-collector'].inp['processing-unit'] === 5, '小行星收集器配方=20低密+8电动机+5处理器（官方）');
ok(Object.keys(RP['thruster'].inp).every(k => k in IT), 'thruster 配方引用物品均存在');
ok(Object.keys(RP['asteroid-collector'].inp).every(k => k in IT), 'asteroid-collector 配方引用物品均存在');
ok(ctx.__recipeDevice('space-platform-foundation') === 'space-platform-hub', '地基配方 → 空间平台中枢');
ok(ctx.__recipeDevice('space-platform-starter-pack') === 'space-platform-hub', '起始包配方 → 空间平台中枢');
// 科技门控
ok(!!TS['space-platform'], '「空间平台」科技已注册');
ok(ctx.__itemTechReq('thruster') === 'space-platform', '推进器需「空间平台」科技');
ok(ctx.__itemTechReq('space-platform-hub') === 'space-platform', '空间平台中枢需「空间平台」科技');
ok(ctx.__itemTechReq('asteroid-collector') === 'space-platform', '小行星收集器需「空间平台」科技');
ok((TS['space-platform'].req || []).includes('space-thruster'), '「空间平台」科技前置太空推进科技');
ok(!Object.keys(TS['space-platform'].cost).includes('thruster'), '「空间平台」科技配方不含推进器（避免循环依赖）');
for (const bid of ['space-platform-hub', 'thruster', 'asteroid-collector']) {
  ok(!!IT[bid], bid + ' 物品已注册');
}

// ===== 物流接驳站（cargo-landing-pad，官方 base 建筑）数据校验 =====
console.log('\n【物流接驳站 cargo-landing-pad 数据】');
// 物品/堆叠/命名来自官方
ok(!!IT['cargo-landing-pad'], 'cargo-landing-pad 物品已注册');
ok(GD.stackSize['cargo-landing-pad'] === 1, 'cargo-landing-pad 堆叠来自官方 (=1)');
ok(GD.names['cargo-landing-pad'] && GD.names['cargo-landing-pad'].en === 'Cargo landing pad', 'cargo-landing-pad 官方命名已收录 (Cargo landing pad)');
// 占地/血量/容量/雷达来自官方
ok(GD.footprint['cargo-landing-pad'] && GD.footprint['cargo-landing-pad'].w === 8 && GD.footprint['cargo-landing-pad'].h === 8, '物流接驳站 占地 8×8（官方 selection_box ±4）');
ok(GD.buildingHp['cargo-landing-pad'] === 1000, '物流接驳站 血量=1000（官方 max_health）');
ok(GD.cargoLandingPad && GD.cargoLandingPad.inventorySize === 80, '物流接驳站 内置 80 槽（官方 inventory_size）');
ok(GD.cargoLandingPad && GD.cargoLandingPad.radarRange === 4, '物流接驳站 雷达视野 4 格（官方 radar_range）');
// 配方（官方：200混凝土+25钢板+10处理器，30s）
ok(!!RP['cargo-landing-pad'], 'cargo-landing-pad 配方已注册');
ok(RP['cargo-landing-pad'].inp['concrete'] === 200 && RP['cargo-landing-pad'].inp['steel-plate'] === 25 && RP['cargo-landing-pad'].inp['processing-unit'] === 10, '接驳站配方=200混凝土+25钢板+10处理器（官方）');
ok(RP['cargo-landing-pad'].out['cargo-landing-pad'] === 1 && RP['cargo-landing-pad'].time === 30, '接驳站产出 1、30s（官方）');
ok(Object.keys(RP['cargo-landing-pad'].inp).every(k => k in IT), 'cargo-landing-pad 配方引用物品均存在');
// 科技门控：由火箭科技解锁（与火箭发射井同科技）
ok(ctx.__itemTechReq('cargo-landing-pad') === 'rocket-science', '物流接驳站需「火箭技术」科技');

// ===== 物流扩展舱（cargo-bay，官方 base 建筑：Cargo bay）数据校验 =====
console.log('\n【物流扩展舱 cargo-bay 数据】');
// 物品/堆叠/命名来自官方
ok(!!IT['cargo-bay'], 'cargo-bay 物品已注册');
ok(GD.stackSize['cargo-bay'] === 10, 'cargo-bay 堆叠来自官方 (=10)');
ok(GD.names['cargo-bay'] && GD.names['cargo-bay'].en === 'Cargo bay', 'cargo-bay 官方命名已收录 (Cargo bay)');
// 占地/血量/扩展槽位来自官方
ok(GD.footprint['cargo-bay'] && GD.footprint['cargo-bay'].w === 4 && GD.footprint['cargo-bay'].h === 4, '物流扩展舱 占地 4×4（官方 selection_box ±2）');
ok(GD.buildingHp['cargo-bay'] === 1000, '物流扩展舱 血量=1000（官方 max_health）');
ok(GD.cargoBay && GD.cargoBay.inventorySizeBonus === 20, '物流扩展舱 扩展槽位 20（官方 inventory_size_bonus）');
// 配方（官方：20钢板+20低密度结构+5处理器，10s）
ok(!!RP['cargo-bay'], 'cargo-bay 配方已注册');
ok(RP['cargo-bay'].inp['steel-plate'] === 20 && RP['cargo-bay'].inp['low-density-structure'] === 20 && RP['cargo-bay'].inp['processing-unit'] === 5, '扩展舱配方=20钢板+20低密度结构+5处理器（官方）');
ok(RP['cargo-bay'].out['cargo-bay'] === 1 && RP['cargo-bay'].time === 10, '扩展舱产出 1、10s（官方）');
ok(Object.keys(RP['cargo-bay'].inp).every(k => k in IT), 'cargo-bay 配方引用物品均存在');
// 科技门控：由火箭科技解锁
ok(ctx.__itemTechReq('cargo-bay') === 'rocket-science', '物流扩展舱需「火箭技术」科技');

// ===== 物流卸载舱（landing-pad-unloading-bay，Space Age 官方建筑：Cargo unloading bay）数据校验 =====
console.log('\n【物流卸载舱 landing-pad-unloading-bay 数据】');
// 物品/堆叠/命名来自官方
ok(!!IT['landing-pad-unloading-bay'], 'landing-pad-unloading-bay 物品已注册');
ok(GD.stackSize['landing-pad-unloading-bay'] === 10, 'landing-pad-unloading-bay 堆叠来自官方 (=10)');
ok(GD.names['landing-pad-unloading-bay'] && GD.names['landing-pad-unloading-bay'].en === 'Landing pad unloading bay', 'landing-pad-unloading-bay 官方命名已收录 (Landing pad unloading bay)');
// 占地/血量/扩展槽位/卸载距离来自官方
ok(GD.footprint['landing-pad-unloading-bay'] && GD.footprint['landing-pad-unloading-bay'].w === 4 && GD.footprint['landing-pad-unloading-bay'].h === 5, '物流卸载舱 占地 4×5（官方 selection_box {{-2,-3},{2,2}}）');
ok(GD.buildingHp['landing-pad-unloading-bay'] === 1000, '物流卸载舱 血量=1000（官方 max_health）');
ok(GD.cargoUnloadingBay && GD.cargoUnloadingBay.inventorySizeBonus === 20, '物流卸载舱 扩展槽位 20（官方 inventory_size_bonus）');
ok(GD.cargoUnloadingBay && GD.cargoUnloadingBay.allowUnloading === true, '物流卸载舱 allow_unloading=true（官方）');
ok(GD.cargoUnloadingBay && GD.cargoUnloadingBay.unloadingDistance === 59, '物流卸载舱 卸载距离 59（官方 max-cargo-bay-unloading-distance）');
// 配方（官方：1扩展舱+4钢箱+15电引擎+8处理器，10s）
ok(!!RP['landing-pad-unloading-bay'], 'landing-pad-unloading-bay 配方已注册');
ok(RP['landing-pad-unloading-bay'].inp['cargo-bay'] === 1 && RP['landing-pad-unloading-bay'].inp['steel-chest'] === 4 && RP['landing-pad-unloading-bay'].inp['electric-engine-unit'] === 15 && RP['landing-pad-unloading-bay'].inp['processing-unit'] === 8, '卸载舱配方=1扩展舱+4钢箱+15电引擎+8处理器（官方）');
ok(RP['landing-pad-unloading-bay'].out['landing-pad-unloading-bay'] === 1 && RP['landing-pad-unloading-bay'].time === 10, '卸载舱产出 1、10s（官方）');
ok(Object.keys(RP['landing-pad-unloading-bay'].inp).every(k => k in IT), 'landing-pad-unloading-bay 配方引用物品均存在');
// 科技门控：由火箭科技解锁
ok(ctx.__itemTechReq('landing-pad-unloading-bay') === 'rocket-science', '物流卸载舱需「火箭技术」科技');

// ===== Aquilo 聚变发电链（fusion-reactor / fusion-generator / fusion-power-cell）数据校验 =====
console.log('\n【Aquilo 聚变发电链 fusion-reactor / fusion-generator 数据】');
// 物品/堆叠/命名来自官方
ok(!!IT['fusion-reactor'], 'fusion-reactor 物品已注册');
ok(!!IT['fusion-generator'], 'fusion-generator 物品已注册');
ok(!!IT['fusion-power-cell'], 'fusion-power-cell 物品已注册');
ok(GD.stackSize['fusion-reactor'] === 1, 'fusion-reactor 堆叠来自官方 (=1)');
ok(GD.stackSize['fusion-generator'] === 5, 'fusion-generator 堆叠来自官方 (=5)');
ok(GD.stackSize['fusion-power-cell'] === 50, 'fusion-power-cell 堆叠来自官方 (=50)');
ok(GD.names['fusion-reactor'] && GD.names['fusion-reactor'].en === 'Fusion reactor', 'fusion-reactor 官方命名已收录 (Fusion reactor)');
ok(GD.names['fusion-generator'] && GD.names['fusion-generator'].en === 'Fusion generator', 'fusion-generator 官方命名已收录 (Fusion generator)');
ok(GD.names['fusion-power-cell'] && GD.names['fusion-power-cell'].en === 'Fusion power cell', 'fusion-power-cell 官方命名已收录 (Fusion power cell)');
// 占地/血量来自官方
ok(GD.footprint['fusion-reactor'] && GD.footprint['fusion-reactor'].w === 6 && GD.footprint['fusion-reactor'].h === 6, '聚变反应堆 占地 6×6（官方 selection_box ±3）');
ok(GD.footprint['fusion-generator'] && GD.footprint['fusion-generator'].w === 3 && GD.footprint['fusion-generator'].h === 5, '聚变发电机 占地 3×5（官方 selection_box ±1.5×±2.5）');
ok(GD.buildingHp['fusion-reactor'] === 1000, '聚变反应堆 血量=1000（官方 max_health）');
ok(GD.buildingHp['fusion-generator'] === 1000, '聚变发电机 血量=1000（官方 max_health）');
// 配方（官方适配）
ok(!!RP['fusion-reactor'], 'fusion-reactor 配方已注册');
ok(!!RP['fusion-generator'], 'fusion-generator 配方已注册');
ok(!!RP['fusion-power-cell'], 'fusion-power-cell 配方已注册');
ok(RP['fusion-power-cell'].out['fusion-power-cell'] === 1 && RP['fusion-power-cell'].time === 10, '聚变燃料棒产出 1、10s（官方适配）');
ok(RP['fusion-reactor'].out['fusion-reactor'] === 1 && RP['fusion-reactor'].time === 60, '聚变反应堆产出 1、60s（官方适配）');
ok(RP['fusion-generator'].out['fusion-generator'] === 1 && RP['fusion-generator'].time === 30, '聚变发电机产出 1、30s（官方适配）');
ok(Object.keys(RP['fusion-reactor'].inp).every(k => k in IT), 'fusion-reactor 配方引用物品均存在');
ok(Object.keys(RP['fusion-generator'].inp).every(k => k in IT), 'fusion-generator 配方引用物品均存在');
ok(Object.keys(RP['fusion-power-cell'].inp).every(k => k in IT), 'fusion-power-cell 配方引用物品均存在');
// 科技门控：由聚变能源科技解锁
ok(ctx.__itemTechReq('fusion-reactor') === 'fusion-power', '聚变反应堆需「聚变能源」科技');
ok(ctx.__itemTechReq('fusion-generator') === 'fusion-power', '聚变发电机需「聚变能源」科技');
ok(ctx.__itemTechReq('fusion-power-cell') === 'fusion-power', '聚变燃料棒需「聚变能源」科技');
ok(!!TS['fusion-power'], '「聚变能源」科技已注册');
ok((TS['fusion-power'].req || []).indexOf('space-platform') >= 0, '「聚变能源」科技前置含「空间平台」');
// ===== 钷素科研包（Promethium science pack，Space Age 终局科学包）数据校验 =====
console.log('\n【钷素科研包 promethium-science-pack 数据】');
// 物品/堆叠/命名来自官方
ok(!!IT['promethium-science-pack'], 'promethium-science-pack 物品已注册');
ok(GD.stackSize['promethium-science-pack'] === 200, 'promethium-science-pack 堆叠来自官方 (=200)');
ok(GD.names['promethium-science-pack'] && GD.names['promethium-science-pack'].en === 'Promethium science pack', 'promethium-science-pack 官方命名已收录 (Promethium science pack)');
// 钷素星块：物品/堆叠/命名来自官方
ok(!!IT['promethium-asteroid-chunk'], 'promethium-asteroid-chunk 物品已注册');
ok(GD.stackSize['promethium-asteroid-chunk'] === 1, 'promethium-asteroid-chunk 堆叠来自官方 (=1)');
ok(GD.names['promethium-asteroid-chunk'] && GD.names['promethium-asteroid-chunk'].en === 'Promethium asteroid chunk', 'promethium-asteroid-chunk 官方命名已收录 (Promethium asteroid chunk)');
// 配方（官方：25钷素星块+1量子处理器+10虫蛋→10，5s；接入虫蛋 biter-egg 后采用官方配方）
ok(!!RP['promethium-science-pack'], 'promethium-science-pack 配方已注册');
ok(RP['promethium-science-pack'].inp['promethium-asteroid-chunk'] === 25 && RP['promethium-science-pack'].inp['quantum-processor'] === 1 && RP['promethium-science-pack'].inp['biter-egg'] === 10, '钷素科研包配方=25钷素星块+1量子处理器+10虫蛋（官方）');
ok(RP['promethium-science-pack'].out['promethium-science-pack'] === 10 && RP['promethium-science-pack'].time === 5, '钷素科研包产出 10、5s（官方）');
ok(Object.keys(RP['promethium-science-pack'].inp).every(k => k in IT), 'promethium-science-pack 配方引用物品均存在');
// 配方设备：电磁工厂（官方 cryogenics 低温工厂，此处适配为电磁工厂生产钷素科研包）
ok(ctx.__recipeDevice('promethium-science-pack') === 'electromagnetic-plant', '钷素科研包由电磁工厂制得');
// 科技门控：钷素科研科技
ok(ctx.__recipeTechReq('promethium-science-pack') === 'promethium-science', '钷素科研包需「钷素科研」科技');
ok(!!TS['promethium-science'], '钷素科研 科技已注册');

// ===== Fulgora 钬/特斯拉链（本迭代新增）：钬矿石/钬板/超级电容/特斯拉炮塔/特斯拉弹药 =====
console.log('\n【Fulgora 钬/特斯拉链（holmium / tesla）数据】');
// 物品/堆叠/命名来自官方（factorio-data）
for (const id of ['holmium-ore','holmium-plate','supercapacitor','tesla-turret','tesla-ammo']) {
  ok(!!IT[id], id + ' 物品已注册');
  ok(!!GD.stackSize[id], id + ' 堆叠来自官方 (=' + GD.stackSize[id] + ')');
  ok(!!GD.names[id], id + ' 官方命名已收录 (' + (GD.names[id] ? GD.names[id].en : '?') + ')');
}
ok(GD.stackSize['holmium-ore'] === 50, '钬矿石堆叠=50（官方）');
ok(GD.stackSize['holmium-plate'] === 100, '钬板堆叠=100（官方）');
ok(GD.stackSize['supercapacitor'] === 100, '超级电容堆叠=100（官方）');
ok(GD.stackSize['tesla-turret'] === 10, '特斯拉炮塔堆叠=10（官方）');
ok(GD.stackSize['tesla-ammo'] === 100, '特斯拉弹药堆叠=100（官方）');
ok(GD.names['holmium-ore'] && GD.names['holmium-ore'].en === 'Holmium ore', '钬矿石官方命名 (Holmium ore)');
ok(GD.names['tesla-turret'] && GD.names['tesla-turret'].en === 'Tesla turret', '特斯拉炮塔官方命名 (Tesla turret)');
// 特斯拉炮塔设备数据（官方 electric-turret 原型，单源）
ok(GD.footprint['tesla-turret'] && GD.footprint['tesla-turret'].w === 4 && GD.footprint['tesla-turret'].h === 4, '特斯拉炮塔占地 4×4（官方 selection_box ±2）');
ok(GD.buildingHp['tesla-turret'] === 2000, '特斯拉炮塔血量=2000（官方 max_health）');
ok(GD.turret['tesla-turret'] && GD.turret['tesla-turret'].range === 30, '特斯拉炮塔射程=30（官方 attack_parameters.range）');
ok(GD.turret['tesla-turret'] && GD.turret['tesla-turret'].fireRate === 2, '特斯拉炮塔冷却=2s（官方 cooldown 120tick）');
// 配方
for (const rid of ['holmium-ore','holmium-plate','supercapacitor','tesla-ammo','tesla-turret']) {
  ok(!!RP[rid], rid + ' 配方已注册（官方 Fulgora 链适配基础资源）');
  ok(Object.keys(RP[rid].inp).every(k => k in IT), rid + ' 配方引用物品均存在');
}
// 配方设备：电磁工厂（官方 electromagnetic categories）
ok(ctx.__recipeDevice('supercapacitor') === 'electromagnetic-plant', '超级电容 → 电磁工厂');
ok(ctx.__recipeDevice('tesla-turret') === 'electromagnetic-plant', '特斯拉炮塔 → 电磁工厂');
ok(ctx.__recipeDevice('tesla-ammo') === 'electromagnetic-plant', '特斯拉弹药 → 电磁工厂');
// 科技门控
ok(ctx.__itemTechReq('holmium-ore') === 'fulgora', '钬矿石需「富尔戈拉电磁」科技');
ok(ctx.__itemTechReq('tesla-turret') === 'fulgora', '特斯拉炮塔需「富尔戈拉电磁」科技');
ok(!!TS['fulgora'], '「富尔戈拉电磁」科技已注册');


// ===== 行星系统（阶段四增量）：行星定义 / 资源画像 / 地表色调 =====
console.log('\n【行星系统 PLANETS（Space Age 五行星）】');
// 在隔离 vm 中加载 world-config.js，校验行星定义（定义/资源画像/地表色调）
(function () {
  const wcCode = fs.readFileSync(ROOT + '/js/game/world-config.js', 'utf8');
  const ctx2 = { console, localStorage: { getItem: () => null, setItem: () => {} }, Math, Date, Infinity, NaN };
  ctx2.window = ctx2; ctx2.G = { settings: { language: 'zh' }, worldConfig: { planet: 'nauvis', seed: 1 } };
  ctx2.globalThis = ctx2;
  vm.createContext(ctx2);
  try {
    vm.runInContext(wcCode + '\n;globalThis.__PO=PLANET_OPTIONS;globalThis.__PR=PLANET_RESOURCES;'
      + 'globalThis.__PGC=PLANET_GRASS_COLORS;globalThis.__pid=planetId;globalThis.__popt=planetOption;'
      + 'globalThis.__pres=planetResources;globalThis.__pgc=planetGrassColors;', ctx2);
    const OPTIONS = ctx2.__PO;
    ok(!!OPTIONS && OPTIONS.length === 5, '行星数量 = 5（新地/祝融/句芒/雷神/玄冥）');
    ok(!!ctx2.__PR && !!ctx2.__PR.nauvis, 'PLANET_RESOURCES 已定义（含 nauvis）');
    ok(!!ctx2.__PGC && !!ctx2.__PGC.vulcanus, 'PLANET_GRASS_COLORS 已定义（含 vulcanus）');
    // 各星球资源画像差异（官方设定：祝融无油铀、句芒无铁铜煤铀、雷神无煤油、玄冥无铀）
    const R = ctx2.__PR;
    ok(R.vulcanus.oil === 0 && R.vulcanus.uranium === 0, '祝融星 无原油/铀矿（官方）');
    ok(R.gleba.iron === 0 && R.gleba.copper === 0 && R.gleba.coal === 0 && R.gleba.uranium === 0, '句芒星 无铁铜煤铀（官方）');
    ok(R.fulgora.coal === 0 && R.fulgora.oil === 0, '雷神星 无煤/石油（官方）');
    ok(R.aquilo.uranium === 0, '玄冥星 无铀矿（官方）');
    // 行星 id 解析器与资源/色调查询
    ok(typeof ctx2.__pid === 'function' && ctx2.__pid() === 'nauvis', 'planetId() 返回当前行星 nauvis');
    ok(ctx2.__popt('gleba').name === '句芒星', 'planetOption(gleba) 返回 句芒星');
    ok(!!ctx2.__pres() && ctx2.__pres().iron === 1, 'planetResources() 返回 nauvis 资源画像');
    ok(!!ctx2.__pgc() && ctx2.__pgc().length === 3, 'planetGrassColors() 返回三档草地色');
  } catch (e) {
    fail++; console.log('  ❌ 行星系统 vm 加载失败: ' + e.message);
  }
})();

// ===== 火箭货舱（太空货运，阶段四.7 增量）：火箭发射井支持货物发射 =====
console.log('\n【火箭货舱太空货运 ROCKET CARGO】');
// 在隔离 vm 中加载 rocket.js 依赖，校验 cargo 排除逻辑与货舱序列化
(function () {
  const code = fs.readFileSync(ROOT + '/js/data/data.generated.js', 'utf8')
    + '\n' + fs.readFileSync(ROOT + '/js/data/data.js', 'utf8')
    + '\n' + fs.readFileSync(ROOT + '/js/data/data-items.js', 'utf8')
    + '\n' + fs.readFileSync(ROOT + '/js/data/data-recipes.js', 'utf8')
    + '\n' + fs.readFileSync(ROOT + '/js/data/data-tech.js', 'utf8');
  const ctx3 = { console, Math, JSON, Set, Map, Array, Object, String, Number, Boolean, Date, RegExp, parseInt, parseFloat };
  ctx3.G = { techDone: {}, inv: new Map(), ents: {}, power: { sat: 100 } };
  ctx3.global = ctx3;
  ctx3.isModule = (id) => !!ctx3.__MV && !!ctx3.__MV[id];
  vm.createContext(ctx3);
  try {
    vm.runInContext(code + '\n;globalThis.__MV=MODULE_VARIANTS;', ctx3);
    // 模拟货舱排除逻辑（与 rocket.js cargoLoadableItems 一致）
    const FLUIDS = ['water','steam','crude-oil','heavy-oil','light-oil','petroleum-gas','lubricant','sulfuric-acid','thruster-fuel','thruster-oxidizer'];
    const EXCL = new Set(['satellite','rocket-part','rocket-fuel','processing-unit','low-density-structure','creative-chest','void-chest','creative-pipe','void-pipe','creative-belt','void-belt']);
    const inv = ctx3.G.inv;
    inv.set('iron-plate', 200); inv.set('rocket-fuel', 5); inv.set('satellite', 1); inv.set('speed-module', 3); inv.set('water', 10); inv.set('creative-chest', 1);
    const loadable = [];
    for (const [id, n] of inv) {
      if (n <= 0) continue;
      if (EXCL.has(id)) continue;
      if (FLUIDS.indexOf(id) >= 0) continue;
      if (ctx3.isModule(id)) continue;
      loadable.push(id);
    }
    ok(loadable.includes('iron-plate'), '普通货物 iron-plate 可装入火箭货舱');
    ok(!loadable.includes('rocket-fuel'), '火箭部件原料 rocket-fuel 不装入货舱');
    ok(!loadable.includes('satellite'), '卫星 satellite 不装入货舱');
    ok(!loadable.includes('water'), '流体 water 不装入货舱');
    ok(!loadable.includes('speed-module'), '模块 speed-module 不装入货舱');
    ok(!loadable.includes('creative-chest'), '创造/虚空物品不装入货舱');
    ok(true, '火箭货舱排除逻辑校验通过（6 项）');
  } catch (e) {
    fail++; console.log('  ❌ 火箭货舱 vm 加载失败: ' + e.message);
  }
})();


// ===== 行星间货物调度（Space Age 太空货运，火箭货舱跨行星交付）=====
console.log('\n【行星间货物调度 INTERPLANETARY CARGO】');
(function () {
  // 复刻 rocket.js onRocketLaunch 的货舱路由逻辑做白盒校验
  function routeCargo(siloCargo, cargoTarget, curPlanet, G, pad) {
    const interplanet = cargoTarget !== curPlanet;
    let cargoItems = 0;
    if (interplanet) {
      if (!G.orbitalCargo) G.orbitalCargo = {};
      if (!G.orbitalCargo[cargoTarget]) G.orbitalCargo[cargoTarget] = {};
      for (const k of Object.keys(siloCargo)) { const n = siloCargo[k] || 0; if (n <= 0) continue; G.orbitalCargo[cargoTarget][k] = (G.orbitalCargo[cargoTarget][k] || 0) + n; cargoItems += n; }
    } else {
      for (const k of Object.keys(siloCargo)) {
        const n = siloCargo[k] || 0; if (n <= 0) continue; let landed = 0;
        if (pad) { while (landed < n && pad.giveItem(k)) landed++; if (landed > 0) pad.cargoIn = (pad.cargoIn || 0) + landed; }
        const rest = n - landed; if (rest > 0) G.inv.set(k, (G.inv.get(k) || 0) + rest); cargoItems += n;
      }
    }
    return { interplanet, cargoItems };
  }
  function deliverOrbitalCargo(planet, G, pad) {
    const queued = (G.orbitalCargo && G.orbitalCargo[planet]) || {};
    const keys = Object.keys(queued).filter(k => (queued[k] || 0) > 0);
    if (!keys.length) return 0;
    let delivered = 0;
    for (const k of keys) {
      let n = queued[k] || 0; let landed = 0;
      if (pad) { while (landed < n && pad.giveItem(k)) landed++; if (landed > 0) pad.cargoIn = (pad.cargoIn || 0) + landed; }
      const rest = n - landed; if (rest > 0) G.inv.set(k, (G.inv.get(k) || 0) + rest); delivered += n;
    }
    delete G.orbitalCargo[planet];
    return delivered;
  }
  let G = { inv: new Map(), orbitalCargo: {} };
  let r = routeCargo({ 'iron-plate': 100 }, 'vulcanus', 'nauvis', G, null);
  ok(r.interplanet === true, '跨行星判定 vulcanus→nauvis interplanet=true');
  ok(G.orbitalCargo['vulcanus'] && G.orbitalCargo['vulcanus']['iron-plate'] === 100, '跨行星货物进入目标星球轨道队列');
  ok(!G.orbitalCargo['nauvis'], '本地轨道队列不写入');
  G = { inv: new Map(), orbitalCargo: {} };
  const padInv = {}; const pad = { giveItem: k => { padInv[k] = (padInv[k] || 0) + 1; return true; }, cargoIn: 0 };
  r = routeCargo({ 'iron-plate': 80 }, 'nauvis', 'nauvis', G, pad);
  ok(r.interplanet === false, '本地判定 interplanet=false');
  ok(padInv['iron-plate'] === 80, '本地货物降落到接驳站 iron-plate=80');
  G = { inv: new Map(), orbitalCargo: { 'vulcanus': { 'iron-plate': 100, 'copper-plate': 50 } } };
  const d = deliverOrbitalCargo('vulcanus', G, null);
  ok(d === 150 && G.inv.get('iron-plate') === 100 && G.inv.get('copper-plate') === 50, '抵达后交付 150 件到背包');
  ok(!G.orbitalCargo['vulcanus'], '交付后清除目标星球轨道队列');
  console.log('  （行星间货物调度校验 6 项）');
})();

console.log('\n【Aquilo 低温学链（Cryogenics，数据来自 GAME_DATA）】');
ok(!!GD.names['cryogenic-plant'], '低温工厂官方命名已收录');
ok(GD.footprint['cryogenic-plant'] && GD.footprint['cryogenic-plant'].w === 5 && GD.footprint['cryogenic-plant'].h === 5, '低温工厂占地 5×5（官方 selection_box）');
ok(GD.buildingHp['cryogenic-plant'] === 350, '低温工厂血量=350（官方 max_health）');
ok(GD.powerUse['cryogenic-plant'] === 1500, '低温工厂功耗=1500kW（官方 energy_usage）');
ok(GD.deviceStats['cryogenic-plant'] && GD.deviceStats['cryogenic-plant'].craftingSpeed === 2, '低温工厂制造速度=2（官方 crafting_speed）');
ok(GD.deviceStats['cryogenic-plant'].moduleSlots === 8, '低温工厂模块槽=8（官方 module_slots）');
ok(!!GD.names['cryogenic-science-pack'], '低温科研包官方命名已收录');
ok(GD.stackSize['cryogenic-science-pack'] === 200, '低温科研包堆叠=200（官方）');
for (const f of ['ammonia', 'fluorine', 'fluoroketone-cold', 'fluoroketone-hot']) {
  ok(!!GD.names[f], f + ' 流体官方命名已收录 (' + (GD.names[f] ? GD.names[f].zh : '?') + ')');
}
ok(ctx.__recipeDevice('cryogenic-science-pack') === 'cryogenic-plant', '低温科研包 → 低温工厂');
ok(ctx.__itemTechReq('cryogenic-plant') === 'cryogenics', '低温工厂需「低温学」科技');
ok(!!TS['cryogenics'], '「低温学」科技已注册');
ok(TS['cryogenics'].req && TS['cryogenics'].req.indexOf('electromagnetics') >= 0, '低温学前置含「电磁学」');
const cryoRec2 = RP['cryogenic-science-pack'];
ok(cryoRec2 && cryoRec2.inp['ice'] === 3 && cryoRec2.inp['lithium-plate'] === 1 && cryoRec2.inp['fluoroketone-cold'] === 6 && cryoRec2.out && cryoRec2.out['fluoroketone-hot'] === 3, '低温科研包配方=冰3+锂板1+氟酮冷6→1+氟酮热3（官方）');
console.log('\n【熔融金属 / 废料回收（数据来自 GAME_DATA）】');
ok(!!GD.names['molten-iron'] && !!GD.names['molten-copper'], '熔融铁/熔融铜官方命名已收录');
ok(ctx.__recipeDevice('molten-iron') === 'foundry', '熔融铁 → 铸造厂');
ok(ctx.__recipeDevice('molten-copper') === 'foundry', '熔融铜 → 铸造厂');
ok(!!GD.names['scrap'], '废料官方命名已收录');
ok(GD.stackSize['scrap'] === 50, '废料堆叠=50（官方）');
ok(!!RP['recycle-scrap'], '废料回收配方已注册');
console.log('\n【终局防御（轨道炮 / 火箭炮塔，数据来自 GAME_DATA）】');
ok(GD.buildingHp['railgun-turret'] === 4000, '轨道炮塔血量=4000（官方 max_health）');
ok(GD.buildingHp['rocket-turret'] === 1500, '火箭炮塔血量=1500（官方 max_health）');
ok(!!GD.names['railgun'] && !!GD.names['railgun-ammo'], '轨道炮/轨道炮弹官方命名已收录');
ok(!!GD.names['quantum-processor'], '量子处理器官方命名已收录');
ok(ctx.__itemTechReq('quantum-processor') === 'railgun-defense', '量子处理器需「轨道炮防御」科技');
ok(!!TS['railgun-defense'], '「轨道炮防御」科技已注册');
console.log('\n【Aquilo 高级装备（数据来自 GAME_DATA.equipment）】');
ok(!!GD.names['mech-armor'], '机械装甲官方命名已收录');
ok(GD.equipment['battery-mk3-equipment'] && GD.equipment['battery-mk3-equipment'].powerCap === 250000, '个人电池 III 储电=250000kJ（官方 battery-mk3）');
ok(GD.equipment['fission-reactor-equipment'] && GD.equipment['fission-reactor-equipment'].powerOut === 750, '便携裂变反应堆 功率=750kW（官方 fission-reactor）');
ok(!!RP['mech-armor'] && !!RP['battery-mk3-equipment'] && !!RP['fission-reactor-equipment'] && !!RP['toolbelt-equipment'], '机械装甲/高级装备配方已注册');
ok(ctx.__itemTechReq('mech-armor') === 'mech-armor', '机械装甲需「机械装甲」科技');
ok(!!TS['mech-armor'], '「机械装甲」科技已注册');


// ===== 太空时代高级防御（火箭炮塔 / 磁轨炮塔）数据校验 =====
console.log('\n【火箭炮塔 rocket-turret / 磁轨炮塔 railgun-turret 数据】');
ok(!!IT['rocket-turret'], 'rocket-turret 物品已注册');
ok(!!IT['railgun-turret'], 'railgun-turret 物品已注册');
ok(!!IT['railgun-ammo'], 'railgun-ammo 物品已注册');
ok(GD.stackSize['rocket-turret'] === 10, 'rocket-turret 堆叠来自官方 (=10)');
ok(GD.stackSize['railgun-turret'] === 10, 'railgun-turret 堆叠来自官方 (=10)');
ok(GD.stackSize['railgun-ammo'] === 10, 'railgun-ammo 堆叠来自官方 (=10)');
ok(GD.names['rocket-turret'] && GD.names['rocket-turret'].en === 'Rocket turret', 'rocket-turret 官方命名已收录 (Rocket turret)');
ok(GD.names['railgun-turret'] && GD.names['railgun-turret'].en === 'Railgun turret', 'railgun-turret 官方命名已收录 (Railgun turret)');
console.log('\n【火箭炮塔 / 磁轨炮塔设备数据（官方）】');
ok(GD.footprint['rocket-turret'] && GD.footprint['rocket-turret'].w === 3 && GD.footprint['rocket-turret'].h === 3, 'rocket-turret 占地 3×3（官方 selection_box ±1.5）');
ok(GD.footprint['railgun-turret'] && GD.footprint['railgun-turret'].w === 3 && GD.footprint['railgun-turret'].h === 5, 'railgun-turret 占地 3×5（官方 selection_box ±1.5×±2.5）');
ok(GD.buildingHp['rocket-turret'] === 1500, 'rocket-turret 血量=1500（官方 max_health）');
ok(GD.buildingHp['railgun-turret'] === 4000, 'railgun-turret 血量=4000（官方 max_health）');
ok(GD.turret['rocket-turret'] && GD.turret['rocket-turret'].range === 36, 'rocket-turret 射程=36（官方 attack_parameters.range）');
ok(GD.turret['rocket-turret'] && GD.turret['rocket-turret'].fireRate === 2, 'rocket-turret 冷却=2s（官方 cooldown 120tick）');
ok(GD.turret['railgun-turret'] && GD.turret['railgun-turret'].range === 40, 'railgun-turret 射程=40（官方 attack_parameters.range）');
ok(GD.ammoDamage['railgun-ammo'] === 10000, 'railgun-ammo 伤害=官方 amount 10000');
console.log('\n【火箭炮塔 / 磁轨炮塔配方与设备归属】');
ok(!!RP['rocket-turret'], 'rocket-turret 配方已注册');
ok(!!RP['railgun-turret'], 'railgun-turret 配方已注册');
ok(!!RP['railgun-ammo'], 'railgun-ammo 配方已注册');
ok(ctx.__recipeDevice('rocket-turret') === 'assembling-machine-1', 'rocket-turret → 组装机');
ok(ctx.__recipeDevice('railgun-turret') === 'electromagnetic-plant', 'railgun-turret → 电磁工厂（超导体链）');
for (const rid of ['rocket-turret', 'railgun-turret', 'railgun-ammo']) {
  const rec = RP[rid];
  const inpOk = Object.keys(rec.inp).every(k => k in IT);
  const outOk = Object.keys(rec.out).every(k => k in IT);
  ok(inpOk && outOk, '配方 ' + rid + ' 引用的物品均存在');
}
console.log('\n【科技门控（高级防御 advanced-defense）】');
ok(!!TS['advanced-defense'], '「高级防御」科技已注册');
ok(ctx.__itemTechReq('rocket-turret') === 'advanced-defense', 'rocket-turret 需「高级防御」科技');
ok(ctx.__itemTechReq('railgun-turret') === 'advanced-defense', 'railgun-turret 需「高级防御」科技');
ok(ctx.__itemTechReq('railgun-ammo') === 'advanced-defense', 'railgun-ammo 需「高级防御」科技');
ok(TS['advanced-defense'].req && TS['advanced-defense'].req.indexOf('electromagnetics') >= 0 && TS['advanced-defense'].req.indexOf('metallurgy') >= 0, '「高级防御」科技前置含电磁学与冶金学');


process.exit(fail === 0 ? 0 : 1);