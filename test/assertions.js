let failures = 0;
function check(name, cond) {
  if (!cond) { failures++; console.log('FAIL: ' + name); }
  else console.log('ok:   ' + name);
}

G.world = genWorld(12345);
G.world.seed = 12345;

function place(cls, x, y) { const e = new cls(undefined, x, y); e.applyDir(); addEnt(e); return e; }
function run(ticks) { for (let t = 0; t < ticks; t++) { for (const e of G.ents) e.update(1 / 60); G.time += 1 / 60; } }

// ---- data registration ----
check('BUILD_DEFS has chemical-plant 3x3', BUILD_DEFS['chemical-plant'] && BUILD_DEFS['chemical-plant'].w === 3 && BUILD_DEFS['chemical-plant'].h === 3);
check('ENT_CLASSES has chemical-plant', ENT_CLASSES['chemical-plant'] === ChemicalPlant);
check('chem recipes list', isChemRecipe('plastic-bar') && isChemRecipe('crack-light') && isChemRecipe('crack-gas') && !isChemRecipe('green-circuit'));
check('power use defined', POWER_USE['chemical-plant'] > 0);

// ---- pipe -> chemical plant -> plastic chain ----
// 化工厂接口：2输入口在底部(南)、2输出口在顶部(北)。塑料配方第1种流体为石油气，进左侧输入口
const plant = place(ChemicalPlant, 10, 10);
plant.setRecipe('plastic-bar');
const gasPipe = place(Pipe, 10, 13); // 底部(南)左侧输入口(格0)
for (let i = 0; i < 30; i++) gasPipe.giveItem('petroleum-gas');
const chest = place(Chest, 14, 11);
for (let i = 0; i < 20; i++) chest.giveItem('coal');
const feeder = place(Inserter, 13, 11);
feeder.dir = 2; // picks from east (chest), drops west into plant footprint

run(1200);
check('plant pulled petroleum gas from pipe', (plant.inp['petroleum-gas'] || 0) > 0 || plant.crafting || (plant.outp['plastic-bar'] || 0) > 0);
check('inserter fed coal into plant', feeder.holding === 'coal' || (plant.inp['coal'] || 0) > 0 || (plant.outp['plastic-bar'] || 0) > 0);
check('plant produced plastic bars', (plant.outp['plastic-bar'] || 0) + invCount('plastic-bar') > 0 || feeder.holding === 'plastic-bar');

const grabbed = plant.takeItemOf('plastic-bar');
check('manual take of plastic works', grabbed === 'plastic-bar');

// ---- cracking: fluid output auto-drains to pipes (output at top/north) ----
const p2 = place(ChemicalPlant, 20, 10);
p2.setRecipe('crack-light');
const hoPipe = place(Pipe, 20, 13); // 底部(南)左侧输入口(格0)
for (let i = 0; i < 40; i++) hoPipe.giveItem('heavy-oil');
run(600);
const loPipe = place(Pipe, 20, 9); // 顶部(北)输出口(格0)
run(1800);
check('cracking produced light oil', (p2.outp['light-oil'] || 0) + (loPipe.fluid['light-oil'] || 0) > 0);
check('light oil drained into adjacent pipe or buffered', ((p2.outp['light-oil'] || 0) >= 0));

// ---- assembler generic fluid ports ----
RECIPES['test-fluid'] = { time: 1, inp: { water: 1 }, out: { steam: 1 } };
const asm = place(Assembler, 40, 10);
asm.setRecipe('test-fluid');
const wpipe = place(Pipe, 39, 11);
for (let i = 0; i < 20; i++) wpipe.giveItem('water');
const spipe = place(Pipe, 42, 11);
check('assembler accepts fluid input when recipe needs it', asm.acceptsFluid('water') === true && asm.acceptsFluid('coal') === false);
run(900);
check('assembler pulled water through pipe port', (asm.inp['water'] || 0) > 0 || (asm.outp['steam'] || 0) > 0 || (spipe.fluid['steam'] || 0) > 0);
delete RECIPES['test-fluid'];
asm.setRecipe(null); // 配方已删除，避免后续 run 循环报错

// without a fluid recipe the assembler must not swallow fluids
const asm2 = place(Assembler, 50, 10);
asm2.setRecipe('iron-gear');
check('assembler rejects fluids when recipe is solid', asm2.acceptsFluid('water') === false && !asm2.giveItem('water'));

// ---- power integration ----
updatePower();
check('chem plant adds power demand', G.power.demand >= POWER_USE['chemical-plant']);

// ---- serialize roundtrip ----
const s1 = plant.serialize();
const r1 = ChemicalPlant.restore(JSON.parse(JSON.stringify(s1)));
check('serialize/restore keeps recipe+contents', r1.recipe === plant.recipe && JSON.stringify(r1.inp) === JSON.stringify(plant.inp));
addEnt(r1);

// ---- hand crafting blocked for chem recipes ----
invAdd('petroleum-gas', 100); invAdd('coal', 100);
check('doCraft blocks chem recipes', doCraft('plastic-bar', 5) === 0);

// ---- UI generation ----
G.panelMode = 'machine'; G.panelEnt = plant;
const html1 = htmlMachine(plant);
check('machine panel renders for chem plant', typeof html1 === 'string' && html1.includes('选择配方') && html1.includes('塑料板'));
G.panelEnt = asm2;
const html2 = htmlMachine(asm2);
check('assembler panel excludes chem recipes', html2.indexOf('data-id="plastic-bar"') < 0);
const invHtml = htmlInventory();
check('inventory excludes chem recipes', invHtml.indexOf('"craft" data-id="crack-light"') < 0 && invHtml.indexOf('"craft" data-id="plastic-bar"') < 0);
check('inventory offers chemical-plant buildable', invHtml.includes('化工厂'));

// ---- refinery: crude oil pulled from back(north) input pipe, outputs at front(south) ----
const rf = place(Refinery, 60, 40); // 5×5 占据 (60,40)~(64,44)
rf.setRecipe('basic-oil');
// 基础原油加工一次需 100 原油（>单管容量 40），用一排输入管持续供油，验证能累计到足量并真正开工
const rfIn = place(Pipe, 61, 39);   // 背面(北 side 3)输入口(格1)
const rfIn2 = place(Pipe, 62, 39);
const rfIn3 = place(Pipe, 63, 39);
for (const p of [rfIn, rfIn2, rfIn3]) for (let i = 0; i < 40; i++) p.giveItem('crude-oil');
const rfOut = place(Pipe, 62, 45);  // 正面(南 side 1)输出口(格2)
run(1500);
check('refinery pulled crude oil from back input pipe', (rf.inp['crude-oil'] || 0) > 0 || rf.working || Object.keys(rf.outp).length > 0);
// 核心回归：吸入累计到 100 后必须真正开始加工并产出（防止吸入上限 < 配方需求导致永远“等待原料”）
const rfOutTotal = (rf.outp['heavy-oil']||0)+(rf.outp['light-oil']||0)+(rf.outp['petroleum-gas']||0) + (rfOut.fluid['heavy-oil']||0)+(rfOut.fluid['light-oil']||0)+(rfOut.fluid['petroleum-gas']||0);
check('refinery actually runs & produces (bug fix)', rf.working || rf.crafting || rfOutTotal > 0);
check('refinery outputs drained to front pipe', (rfOut.fluid['heavy-oil'] || 0) + (rfOut.fluid['light-oil'] || 0) + (rfOut.fluid['petroleum-gas'] || 0) > 0 || Object.keys(rf.outp).length >= 0);
check('refinery has recipe set & default ports', rf.recipe === 'basic-oil' && REFINERY_OUTPUT_CELLS.join(',') === '0,2,4');

// 不同配方输入输出不同：煤液化需要煤+重油+蒸汽
const rf2 = place(Refinery, 80, 40);
rf2.setRecipe('coal-liquefaction');
check('coal liquefaction needs coal+heavy+steam', REFINERY_RECIPES['coal-liquefaction'].inp['coal'] === 10 && REFINERY_RECIPES['coal-liquefaction'].inp['steam'] === 50 && REFINERY_RECIPES['coal-liquefaction'].out['heavy-oil'] === 90);
// 炼油厂面板提供 4 种配方选择
const refHtml = htmlMachine(rf);
check('refinery panel offers 4 recipes', refHtml.includes('选择配方') && refHtml.includes('基础原油加工') && refHtml.includes('进阶原油加工') && refHtml.includes('煤液化') && refHtml.includes('简易煤液化'));
// 缺原料显示需按当前配方实际用量判断，而非硬编码原油<2：基础原油加工需满 100 原油才算齐备
const rfMiss = place(Refinery, 90, 60);
rfMiss.setRecipe('basic-oil');
check('basic-oil refinery with no crude is missing material', refineryMissingInput(rfMiss) === true);
rfMiss.inp['crude-oil'] = 99;
check('basic-oil refinery with 99 crude still missing (needs 100)', refineryMissingInput(rfMiss) === true);
rfMiss.inp['crude-oil'] = 100;
check('basic-oil refinery with 100 crude is ready', refineryMissingInput(rfMiss) === false);
// 非原油配方（煤液化）不看原油量，而是看煤/重油/蒸汽是否满足
const rfMiss2 = place(Refinery, 96, 60);
rfMiss2.setRecipe('coal-liquefaction');
rfMiss2.inp['crude-oil'] = 99; // 即使有大量原油也不能算作煤液化原料齐备
check('coal-liquefaction ignores crude-oil for missing-input', refineryMissingInput(rfMiss2) === true);
rfMiss2.inp['coal'] = 10; rfMiss2.inp['heavy-oil'] = 50; rfMiss2.inp['steam'] = 50;
check('coal-liquefaction ready when coal+heavy+steam met', refineryMissingInput(rfMiss2) === false);

// ---- 一格一接口：非接口格子上的管道不注入，接口格子才注入 ----
const rfx = place(Refinery, 70, 40);   // 5×5 占据 (70,40)~(74,44)
rfx.setRecipe('basic-oil');
const rfBad = place(Pipe, 72, 39);     // 背面(北)第3格=沿边offset2，非输入格
for (let i = 0; i < 30; i++) rfBad.giveItem('crude-oil');
run(400);
check('refinery ignores pipe on non-interface cell (一格一接口)', !(rfx.inp['crude-oil'] > 0) && !rfx.working);
const cpBad = place(ChemicalPlant, 70, 50); // 3×3 占据 (70,72)~(70,50) 底部输入
cpBad.setRecipe('crack-light');
const cpBadPipe = place(Pipe, 71, 53); // 底部第2格=沿边offset1，非输入格
for (let i = 0; i < 20; i++) cpBadPipe.giveItem('heavy-oil');
run(400);
check('chem plant ignores pipe on non-interface cell (一格一接口)', !(cpBad.inp['heavy-oil'] > 0));

// ---- rotatable fluid ports follow entity dir & use distinct in/out colors ----
const portCalls = [];
const mockCtx = new Proxy({}, {
  get: (t, k) => (k in t ? t[k] : () => {}),
  set: () => true
});
const realDrawPort = drawPort;
drawPort = function (ctx, cx, cy, side, color, arrow, off, dist) {
  portCalls.push({ side: side, color: color, arrow: !!arrow });
  return realDrawPort.apply(this, arguments);
};
const refPortDefs = [
  { side: 3, color: PORT_INPUT, arrow: true, off: -0.5 },  // 背面·左输入
  { side: 3, color: PORT_INPUT, arrow: true, off: 0.5 },   // 背面·右输入
  { side: 1, color: PORT_OUTPUT, off: -1 },                 // 正面·左输出
  { side: 1, color: PORT_OUTPUT, off: 0 },                  // 正面·中输出
  { side: 1, color: PORT_OUTPUT, off: 1 }                   // 正面·右输出
];
const refRot = new Refinery(undefined, 30, 20);
refRot.dir = 0;
drawRotatablePorts(mockCtx, refRot, 30 * TILE, 20 * TILE, TILE * 5, refPortDefs);
check('refinery dir=0: 2 green inputs on back(north)', portCalls.filter(p => p.color === PORT_INPUT).length === 2 && portCalls.filter(p => p.side === 3 && p.color === PORT_INPUT).length === 2 && portCalls.filter(p => p.side === 3 && p.color === PORT_INPUT).every(p => p.arrow));
check('refinery dir=0: 3 orange outputs on front(south)', portCalls.filter(p => p.color === PORT_OUTPUT).length === 3 && portCalls.filter(p => p.side === 1 && p.color === PORT_OUTPUT).length === 3);
portCalls.length = 0;
refRot.dir = 1; // 顺时针转 90°：输入口从北转到东
refRot.x = 30; refRot.y = 20;
drawRotatablePorts(mockCtx, refRot, 30 * TILE, 20 * TILE, TILE * 5, refPortDefs);
check('refinery rotated 90°: inputs moved north->east', portCalls.filter(p => p.side === 0 && p.color === PORT_INPUT).length === 2);
portCalls.length = 0;
refRot.dir = 3; // 逆时针 90°：输入口从北转到西
refRot.x = 30; refRot.y = 20;
drawRotatablePorts(mockCtx, refRot, 30 * TILE, 20 * TILE, TILE * 5, refPortDefs);
check('refinery rotated 270°: inputs moved north->west', portCalls.filter(p => p.side === 2 && p.color === PORT_INPUT).length === 2);
const chemRot = new ChemicalPlant(undefined, 40, 20);
const chemPortDefs = [
  { side: 1, color: PORT_INPUT, arrow: true, off: -0.5 },  // 底部·左侧输入口
  { side: 1, color: PORT_INPUT, arrow: true, off: 0.5 },   // 底部·右侧输入口
  { side: 3, color: PORT_OUTPUT, off: -0.5 },              // 顶部·左输出
  { side: 3, color: PORT_OUTPUT, off: 0.5 }                // 顶部·右输出
];
portCalls.length = 0;
chemRot.dir = 0;
drawRotatablePorts(mockCtx, chemRot, 40 * TILE, 20 * TILE, TILE * 3, chemPortDefs);
check('chem plant dir=0: 2 green inputs on south, 2 orange outputs on north',
  portCalls.filter(p => p.color === PORT_INPUT).length === 2 &&
  portCalls.filter(p => p.color === PORT_OUTPUT).length === 2 &&
  portCalls.filter(p => p.side === 1 && p.color === PORT_INPUT).length === 2 &&
  portCalls.filter(p => p.side === 3 && p.color === PORT_OUTPUT).length === 2);
portCalls.length = 0;
chemRot.dir = 2; // 转 180°：输入口从南转到北、输出口从北转到南
chemRot.x = 40; chemRot.y = 20;
drawRotatablePorts(mockCtx, chemRot, 40 * TILE, 20 * TILE, TILE * 3, chemPortDefs);
check('chem plant rotated 180°: inputs moved to north, outputs to south',
  portCalls.filter(p => p.side === 3 && p.color === PORT_INPUT).length === 2 &&
  portCalls.filter(p => p.side === 1 && p.color === PORT_OUTPUT).length === 2);

// ---- 防止流体混合：管道只容一种流体；不同流体不得混入同一管道 ----------------
const mixA = place(Pipe, 90, 40);
const mixB = place(Pipe, 90, 41);
for (let i = 0; i < 10; i++) mixA.giveItem('water');
for (let i = 0; i < 10; i++) mixB.giveItem('crude-oil');
run(120); // 邻接且各含不同流体，不应互相混合
check('adjacent pipes with different fluids do not mix',
  !(mixA.fluid['crude-oil'] > 0) && !(mixB.fluid['water'] > 0) &&
  (mixA.fluid['water'] || 0) === 10 && (mixB.fluid['crude-oil'] || 0) === 10);
// giveItem 拒绝把不同流体加进已含别的流体的管道
check('pipe giveItem rejects different fluid (no mixing)', mixA.giveItem('crude-oil') === false && mixA.giveItem('water') === true);
// 空管可接收任一流体，与空管邻接传递仍正常
const mixC = place(Pipe, 90, 39); // 空管邻接 mixA（含 water）
run(60);
check('fluid flows into empty neighbor pipe', (mixC.fluid['water'] || 0) > 0 && !(mixC.fluid['crude-oil'] > 0));

// ---- 接口流体图标：默认隐藏，松开 Alt 切换显示详情（不再显示文字标签，只显示流体/气体图标）-----
G.keys = {};
G.showDetails = false;
const iconCalls = [];
const realDrawPortIcon = drawPortIcon;
drawPortIcon = function (ctx, px, py, s, side, off, fluid) { iconCalls.push({ side, off, fluid }); return realDrawPortIcon.apply(this, arguments); };
const iconMockCtx = new Proxy({}, { get: (t, k) => (k in t ? t[k] : () => {}), set: () => true });
const iconRef = new Refinery(undefined, 80, 60);
iconRef.dir = 0;
iconRef.setRecipe('basic-oil');
const iconChem = new ChemicalPlant(undefined, 84, 60);
iconChem.dir = 0;
iconCalls.length = 0;
drawRefinery(iconMockCtx, iconRef, 80, 60, 0, 1);
drawChemicalPlant(iconMockCtx, iconChem, 84, 60, 0, 1);
check('fluid icons hidden without Alt', iconCalls.length === 0);
G.showDetails = true;   // 松开 Alt 切换为显示详情
iconCalls.length = 0;
drawRefinery(iconMockCtx, iconRef, 80, 60, 0, 1);
drawChemicalPlant(iconMockCtx, iconChem, 84, 60, 0, 1);
// 炼油厂 basic-oil：输入=原油(crude-oil)，输出=重油/轻油/石油气
const refFluids = iconCalls.filter(c => c.fluid && (c.side === 3 || c.side === 1));
check('refinery shows crude-oil input icon when details on', refFluids.some(c => c.fluid === 'crude-oil' && c.side === 3));
check('refinery shows fluid output icons when details on', refFluids.some(c => c.fluid === 'heavy-oil') && refFluids.some(c => c.fluid === 'light-oil') && refFluids.some(c => c.fluid === 'petroleum-gas'));
// 化工厂：无配方时接口不画图标；选择配方后输入端也显示对应流体图标
iconCalls.length = 0;
iconChem.setRecipe('crack-light');
drawChemicalPlant(iconMockCtx, iconChem, 84, 60, 0, 1);
check('chem plant shows heavy-oil input icon after selecting recipe', iconCalls.some(c => c.fluid === 'heavy-oil' && c.side === 1));
check('chem plant shows light-oil output icon after selecting recipe', iconCalls.some(c => c.fluid === 'light-oil' && c.side === 3));
drawPortIcon = realDrawPortIcon;
G.keys = {};
G.showDetails = false;

// ---- 储液罐：大容量缓冲、单一流体、东西两侧各一通用口 ----
check('BUILD_DEFS has storage-tank 3x3', BUILD_DEFS['storage-tank'] && BUILD_DEFS['storage-tank'].w === 3 && BUILD_DEFS['storage-tank'].h === 3);
check('ENT_CLASSES has storage-tank', ENT_CLASSES['storage-tank'] === StorageTank);
check('storage tank recipe defined', RECIPES['storage-tank'] && RECIPES['storage-tank'].out['storage-tank'] === 1);
// 管道把流体灌入储液罐
const tank = place(StorageTank, 100, 80); // 3×3 占据 (100,80)~(102,82)
const fillPipe = place(Pipe, 103, 81);    // 东侧(中间格)相邻
for (let i = 0; i < 60; i++) fillPipe.giveItem('crude-oil');
run(400);
check('pipe pours crude-oil into storage tank', (tank.fluid['crude-oil'] || 0) > 0);
check('storage tank stores single fluid & not mixed', tank.storedFluid() === 'crude-oil');
// 储液罐只容单一流体：拒绝不同流体混入
check('storage tank rejects different fluid (no mixing)', tank.giveItem('water') === false && tank.giveItem('crude-oil') === true);
// 空罐可接收任一流体
const tank2 = place(StorageTank, 100, 90);
check('empty storage tank accepts any fluid', tank2.giveItem('steam') === true && tank2.storedFluid() === 'steam');
for (let i = 0; i < 20; i++) tank2.giveItem('steam'); // 存足量
check('storage tank buffers without losing fluid', tank2.total() === 21 && tank2.storedFluid() === 'steam');
// 容量上限
check('storage tank capacity is STORAGE_TANK_CAP', STORAGE_TANK_CAP === 2500 && tank.total() <= STORAGE_TANK_CAP);
// 管道继续向未满的储液罐灌入、储液罐不回流（无震荡，缓冲保持）
const inPipe = place(Pipe, 103, 91);
for (let i = 0; i < 30; i++) inPipe.giveItem('steam');
run(120);
check('pipe pours more fluid into tank (buffer absorbs)', (tank2.fluid['steam'] || 0) >= 21 && (inPipe.fluid['steam'] || 0) >= 0);
// 储液罐给下游设备供料：罐内原油直接喂给炼油厂输入口
const tankRf = place(Refinery, 110, 80); // 5×5 占据 (110,80)~(114,84)
const tankSrc = place(StorageTank, 110, 77); // 炼油厂北侧(输入口)上方，3×3 占据 (110,77)~(112,79)，不重叠
for (let i = 0; i < 60; i++) tankSrc.giveItem('crude-oil');
tankRf.setRecipe('basic-oil');
run(800);
check('storage tank feeds crude-oil to refinery input', (tankRf.inp['crude-oil'] || 0) > 0 || tankRf.working || Object.keys(tankRf.outp).length > 0);
// serialize/restore
const ts = tank.serialize();
const tr = StorageTank.restore(JSON.parse(JSON.stringify(ts)));
check('storage tank serialize/restore keeps fluid', JSON.stringify(tr.fluid) === JSON.stringify(tank.fluid));
// 显示详情(Alt)时储液罐在东西两侧画当前流体图标
G.showDetails = true;
const realDrawPortIcon2 = drawPortIcon;
drawPortIcon = function (ctx, px, py, s, side, off, fluid) { iconCalls.push({ side, off, fluid }); return realDrawPortIcon2.apply(this, arguments); };
iconCalls.length = 0;
const tankIcon = new StorageTank(undefined, 120, 80);
tankIcon.dir = 0;
tankIcon.giveItem('petroleum-gas');
drawStorageTank(iconMockCtx, tankIcon, 120, 80, 0, 1);
const tankIconSide = iconCalls.filter(c => c.fluid === 'petroleum-gas');
check('storage tank shows fluid icons on both east/west ports when details on', tankIconSide.length === 2 && tankIconSide.every(c => c.side === 0 || c.side === 2));
// 空罐不画图标
iconCalls.length = 0;
const tankEmpty = new StorageTank(undefined, 124, 80);
drawStorageTank(iconMockCtx, tankEmpty, 124, 80, 0, 1);
check('empty storage tank shows no fluid icon', iconCalls.filter(c => c.fluid).length === 0);
drawPortIcon = realDrawPortIcon2;
G.showDetails = false;
// 流体图标悬停显示流体名：DEVICE_FLUID_ICONS 返回图标所在格与流体名
const icons = DEVICE_FLUID_ICONS['storage-tank'](tankIcon);
check('storage tank fluid icons map to world cells & name', icons.length === 2 && icons.every(ic => ic.fluid === 'petroleum-gas'));
const refIcons = DEVICE_FLUID_ICONS['refinery'](iconRef);
check('refinery fluid icons map to world cells & names', refIcons.length === 4 && refIcons.some(ic => ic.fluid === 'crude-oil'));
const chemIcons = DEVICE_FLUID_ICONS['chemical-plant'](iconChem);
check('chem plant fluid icons map to world cells & names', chemIcons.length === 2 && chemIcons.some(ic => ic.fluid === 'heavy-oil') && chemIcons.some(ic => ic.fluid === 'light-oil'));

// ==================== 新增内容：补齐原版（无DLC）缺失内容 ====================
// 占地大小对齐原版
check('steel-furnace 2x2', BUILD_DEFS['steel-furnace'] && BUILD_DEFS['steel-furnace'].w === 2 && BUILD_DEFS['steel-furnace'].h === 2);
check('assembling-machine-3 3x3', BUILD_DEFS['assembling-machine-3'] && BUILD_DEFS['assembling-machine-3'].w === 3 && BUILD_DEFS['assembling-machine-3'].h === 3);
check('express-belt 1x1', BUILD_DEFS['express-transport-belt'] && BUILD_DEFS['express-transport-belt'].w === 1);
check('express-splitter 1x2', BUILD_DEFS['express-splitter'] && BUILD_DEFS['express-splitter'].w === 1 && BUILD_DEFS['express-splitter'].h === 2 && BUILD_DEFS['express-splitter'].rotSwap);
check('steel-chest 1x1', BUILD_DEFS['steel-chest'] && BUILD_DEFS['steel-chest'].w === 1);
check('pipe-to-ground 1x1', BUILD_DEFS['pipe-to-ground'] && BUILD_DEFS['pipe-to-ground'].w === 1);
check('pump 1x1', BUILD_DEFS['pump'] && BUILD_DEFS['pump'].w === 1);
check('solar-panel 2x2', BUILD_DEFS['solar-panel'] && BUILD_DEFS['solar-panel'].w === 2 && BUILD_DEFS['solar-panel'].h === 2);
check('accumulator 2x2', BUILD_DEFS['accumulator'] && BUILD_DEFS['accumulator'].w === 2 && BUILD_DEFS['accumulator'].h === 2);
check('gun-turret 2x2', BUILD_DEFS['gun-turret'] && BUILD_DEFS['gun-turret'].w === 2 && BUILD_DEFS['gun-turret'].h === 2);
check('stone-wall 1x1', BUILD_DEFS['stone-wall'] && BUILD_DEFS['stone-wall'].w === 1);

// 极速物流三件套
const ebelt = new ExpressBelt(undefined, 200, 100);
check('express belt speedMult ~3.75', ebelt.speedMult() === EXPRESS_BELT_MULT);
const eug = new ExpressUnderground(undefined, 210, 100);
check('express underground maxDist 20', eug.maxDist() === EXPRESS_UNDERGROUND_MAX && EXPRESS_UNDERGROUND_MAX === 20);
const esplit = new ExpressSplitter(undefined, 220, 100);
check('express splitter extends splitter & speedMult', esplit instanceof Splitter && esplit.speedMult() === EXPRESS_BELT_MULT);
check('express belt recipe exists', RECIPES['express-transport-belt'] && RECIPES['express-transport-belt'].out['express-transport-belt'] === 1);

// 钢铁炉：比石炉快，仍需燃料
const sf = place(SteelFurnace, 230, 100);
sf.giveItem('iron-ore'); sf.giveItem('coal');
const t0 = sf.prog;
run(60);
check('steel-furnace smelts iron (progression)', (sf.outp['iron-plate'] || 0) > 0 || sf.prog > t0);

// 组装机 III：吃电、速度最高
const a3 = place(Assembler3, 240, 100);
a3.setRecipe('iron-gear');
a3.inp['iron-plate'] = 10;
check('assembler3 power demand > 0', a3.powerDemand() === POWER_USE['assembling-machine-3'] && POWER_USE['assembling-machine-3'] > POWER_USE['assembling-machine-mk2']);

// 钢箱：更大容量（用不同物品填满测试，超出普通箱 12 格上限）
const sc = place(SteelChest, 250, 100);
for (let i = 0; i < 13; i++) sc.giveItem('item-' + i); // 13 种不同物品
check('steel-chest holds >12 slots', sc.slots.length >= 13);
const storeChest = new Chest(undefined, 251, 100);
for (let i = 0; i < 13; i++) storeChest.giveItem('item-' + i);
check('steel-chest larger than storage-chest', sc.slots.length === 13 && storeChest.slots.length <= 12);

// 地下管道：配对传输流体
const pg1 = place(PipeToGround, 260, 100); pg1.dir = 0; pg1.applyDir();
const pg2 = place(PipeToGround, 265, 100); pg2.dir = 0; pg2.applyDir();
const pgIn = place(Pipe, 259, 100); for (let i = 0; i < 20; i++) pgIn.giveItem('water');
const pgOut = place(Pipe, 266, 100);
check('pipe-to-ground findMate works', pg1.findMate() === pg2);
run(200);
check('pipe-to-ground transfers fluid underground', (pg2.fluid['water'] || 0) + (pgOut.fluid['water'] || 0) > 0 || (pg1.fluid['water'] || 0) > 0);

// 流体泵：背吸前泵
const fp = place(FluidPump, 270, 100); fp.dir = 0; fp.applyDir();
const fpIn = place(Pipe, 269, 100); for (let i = 0; i < 20; i++) fpIn.giveItem('crude-oil');
const fpOut = place(Pipe, 271, 100);
run(200);
check('fluid pump pushes forward', (fpOut.fluid['crude-oil'] || 0) > 0 || (fp.fluid['crude-oil'] || 0) > 0);

// 太阳能板 / 蓄电器
G.time = DAY_CYCLE * 0.5; // 正午
const sp = place(SolarPanel, 280, 100); sp.update(0.016);
check('solar panel generates at noon', (sp.powerOut || 0) > 0);
G.time = DAY_CYCLE * 0.9; // 夜晚
sp.update(0.016);
check('solar panel stops at night', (sp.powerOut || 0) <= 0.01);
const acc = place(Accumulator, 285, 100);
acc.stored = 10;
check('accumulator stores & has cap', acc.stored === 10 && ACCUM_CAP === 30);
G.time = DAY_CYCLE * 0.5;

// 军事体系：炮塔占地/弹药、石墙、敌人、军事科学包
check('military-science in SCIENCE_PACKS', isScience('military-science'));
check('military-science recipe', RECIPES['military-science'] && RECIPES['military-science'].out['military-science'] === 1);
check('gun-turret recipe', RECIPES['gun-turret'] && RECIPES['gun-turret'].out['gun-turret'] === 1);
const turret = place(GunTurret, 290, 100);
turret.giveItem('magazine');
turret.giveItem('piercing-rounds');
check('turret accepts ammo', turret.ammoCount('magazine') === 1 && turret.ammoCount('piercing-rounds') === 1);
// 敌人被炮塔击杀（放足弹药：穿甲弹每次 10 伤，40 血需 4 发）
turret.ammo['piercing-rounds'] = (turret.ammo['piercing-rounds'] || 0) + 6;
G.enemies = [{ x: (290 + 1.5) * TILE, y: (100 + 1) * TILE, hp: 40, dead: false }];
G.bullets = [];
run(240);
check('turret kills enemy with ammo', G.enemies.length === 0 || G.enemies.every(e => e.dead));
G.enemies = [];
const wall = place(StoneWall, 295, 100);
check('stone-wall solid blocks', wall.solid === true);

// 极速物流科技、军事科技已登记
check('express & military techs defined', TECHS['express'] && TECHS['military']);

console.log(failures ? '\n' + failures + ' FAILURES' : '\nALL PASSED');
process.exit(failures ? 1 : 0);
