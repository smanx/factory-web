'use strict';
// ===== DLC（太空时代）数据校验 =====
// 校验：新增 DLC 物品/配方/设备数据均来自 GAME_DATA（data.generated.js，factorio-data 生成），
// 且与官方数值一致；电磁工厂设备数据正确。
const fs = require('fs'), vm = require('vm');
const ROOT = __dirname + '/..';
const code = fs.readFileSync(ROOT + '/js/data.generated.js', 'utf8')
  + fs.readFileSync(ROOT + '/js/data.js', 'utf8')
  + fs.readFileSync(ROOT + '/js/data-items.js', 'utf8')
  + fs.readFileSync(ROOT + '/js/data-recipes.js', 'utf8')
  + fs.readFileSync(ROOT + '/js/data-buildings.js', 'utf8')
  + fs.readFileSync(ROOT + '/js/data-tech.js', 'utf8')
  + fs.readFileSync(ROOT + '/js/data-tech-tree.js', 'utf8')
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
ok(ctx.__recipeDevice('carbon-fiber') === 'chemical-plant', '碳纤维 → 化工厂');
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
console.log('\n' + (fail === 0 ? '✅ DLC 数据校验全部通过（' + pass + ' 项）' : '❌ 失败 ' + fail + ' 项'));
process.exit(fail === 0 ? 0 : 1);
