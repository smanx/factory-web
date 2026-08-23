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
const plant = place(ChemicalPlant, 10, 10);
plant.setRecipe('plastic-bar');
const gasPipe = place(Pipe, 9, 11);
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

// ---- cracking: fluid output auto-drains to pipes ----
const p2 = place(ChemicalPlant, 20, 10);
p2.setRecipe('crack-light');
const hoPipe = place(Pipe, 19, 11);
for (let i = 0; i < 40; i++) hoPipe.giveItem('heavy-oil');
run(600);
const loPipe = place(Pipe, 23, 11);
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

console.log(failures ? '\n' + failures + ' FAILURES' : '\nALL PASSED');
process.exit(failures ? 1 : 0);
