'use strict';
/**
 * 存档兼容回归（P2）：品质变体 / 新鲜度字段 / 平台设备 / 废料回收
 * ------------------------------------------------
 * 核验旧档读档不报错、新字段读档后正确恢复：
 *   1. 品质变体物品 id（item~quality）在背包/箱槽/带条目中原样保留（不迁移不报错）。
 *   2. 新鲜度字段：箱槽三元组 [item, count, fresh] 与带条目第 7 元 fresh 恢复；
 *      旧档无字段 → undefined（懒初始化，不报错）。
 *   3. 平台设备存档：推进器 fuelBuf/oxidBuf、收集器 buf/timer、中枢 cargo/cargoTarget 恢复。
 *   4. 废弃物品迁移：OBSOLETE_ITEMS（桶装推进剂等）读档时从容器键中清除；ID_MIGRATE 生效。
 *   5. 回收机/遥测依赖的序列化字段闭环（recycleItem/outp 恢复）。
 *
 * 运行：node tools/verify-save-dlc-fields.js （退出码 0 = 通过）
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'js');
const load = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name); }
}

const G = { grid: new Map(), ents: [], buckets: new Map(), settings: { language: 'zh' }, techDone: {}, inv: new Map(), player: { x: 0, y: 0 } };
const sandbox = {
  console, Math, JSON, Set, Map, Array, Object, String, Number, Boolean, Date, RegExp,
  parseInt, parseFloat, isFinite, isNaN, G,
  playSfx: () => {}, toast: () => {},
  ENT_CLASSES: {}, DEVICE_RENDER: {}, DEVICE_STATUS: {}, DEVICE_PANEL: {}, DEVICE_DIR_ROTATE: {}, DEVICE_PLACE: {},
  DEVICE_FLUID_ICONS: {}, DEVICE_FLUID_PORTS: {},
  performance, requestAnimationFrame: () => {},
  localStorage: { getItem: () => null, setItem: () => {} },
  planetId: () => 'gleba',
  regPowerEnt: () => {}, unregPowerEnt: () => {},
  invalidateBeltInputNear: () => {}, circuitSignalNear: () => ({}),
  buildingMaxHp: () => 100,
  getTerrain: () => 0, isWater: () => false, isCliff: () => false, isTree: () => false,
  row: (l, v) => l + v, chip: (i, n) => i + '×' + (n || ''), countStr: o => Object.keys(o).join(),
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(
  load('data/data.generated.js') + '\n'
  + load('data/data.js') + '\n'
  + load('data/data-items.js') + '\n'
  + load('data/data-recipes.js') + '\n'
  + load('data/data-buildings.js') + '\n'
  + load('data/data-tech.js') + '\n'
  + load('data/data-util.js') + '\n'
  + load('game/spoilage.js') + '\n'
  + load('core/entity.js') + '\n'
  + load('devices/chest.js') + '\n'
  + load('devices/belt.js') + '\n'
  + load('devices/splitter.js') + '\n'
  + load('devices/inserter.js') + '\n'
  + load('devices/assembler.js') + '\n'
  + load('devices/recycler.js') + '\n'
  + load('devices/pipe.js') + '\n'
  + load('devices/space-platform.js') + '\n'
  + 'globalThis.__Chest=Chest;globalThis.__Belt=Belt;globalThis.__Recycler=Recycler;'
  + 'globalThis.__Thruster=Thruster;globalThis.__AsteroidCollector=AsteroidCollector;'
  + 'globalThis.__SpacePlatformHub=SpacePlatformHub;',
  sandbox, { filename: 'save.js' }
);
// OBSOLETE_ITEMS 定义在 main.js（依赖较多），这里单测迁移语义：从 main.js 提取数组字面量
const mainJs = load('main/main.js');
const mObs = mainJs.match(/const OBSOLETE_ITEMS = (\[[^\]]*\])/);
const OBSOLETE = mObs ? JSON.parse(mObs[1].replace(/'/g, '"')) : [];
ok(OBSOLETE.includes('thruster-fuel-barrel') && OBSOLETE.includes('thruster-oxidizer-barrel')
   && OBSOLETE.includes('diesel-locomotive'), 'OBSOLETE_ITEMS 含废弃桶装推进剂与内燃机车');

const { __Chest: Chest, __Belt: Belt, __Recycler: Recycler,
        __Thruster: Thruster, __AsteroidCollector: AsteroidCollector,
        __SpacePlatformHub: SpacePlatformHub } = sandbox;

function put(e) {
  G.ents.push(e);
  const k = ((e.x >> 4) + 4096) * 8192 + ((e.y >> 4) + 4096);
  let s = G.buckets.get(k); if (!s) { s = new Set(); G.buckets.set(k, s); }
  s.add(e);
  for (let dy = 0; dy < e.h; dy++)
    for (let dx = 0; dx < e.w; dx++) G.grid.set(((e.x + dx + 32768) << 16) | (e.y + dy + 32768), e);
  return e;
}
function fresh() { G.grid = new Map(); G.ents = []; G.buckets = new Map(); }

console.log('\n【品质变体物品 id 存档保留】');
{
  fresh();
  const box = put(new Chest('iron-chest', 0, 0));
  box.giveItem('iron-gear-wheel~uncommon');   // 品质变体 id
  box.giveItem('iron-gear-wheel~uncommon');
  const s = box.serialize();
  const v = s.slots.find(x => x && x[0] === 'iron-gear-wheel~uncommon');
  ok(!!v && v[1] === 2, '箱槽序列化保留品质变体 id（×2）');
  const box2 = Chest.restore(s);
  ok(box2.countOf('iron-gear-wheel~uncommon') === 2, '恢复后品质变体物品数量不变');
  // 带上品质变体
  const belt = put(new Belt('transport-belt', 5, 0)); belt.dir = 0;
  belt.acceptItem('iron-plate~rare');
  const bs = belt.serialize();
  ok(bs.items[0][0] === 'iron-plate~rare', '带条目序列化保留品质变体 id');
  const belt2 = Belt.restore(bs);
  ok(belt2.items[0].item === 'iron-plate~rare', '带条目恢复品质变体 id');
}

console.log('\n【新鲜度字段存档闭环与旧档兼容】');
{
  fresh();
  const box = put(new Chest('iron-chest', 0, 0));
  box.giveItem('yumako-mash');
  const s = box.serialize();
  const slotEntry = s.slots.find(x => x && x[0] === 'yumako-mash');
  ok(Array.isArray(slotEntry) && slotEntry.length === 3 && typeof slotEntry[2] === 'number',
    '箱槽三元组含 fresh（[item,count,fresh]）');
  const box2 = Chest.restore(s);
  const rslot = box2.slots.find(v => v && v.item === 'yumako-mash');
  ok(typeof rslot.fresh === 'number', '恢复后 fresh 为数值');
  // 旧档（无 fresh）：不报错，字段 undefined
  const old = Chest.restore({ type: 'iron-chest', x: 0, y: 0, slots: [['bioflux', 5]] });
  ok(old.countOf('bioflux') === 5 && old.slots[0].fresh === undefined, '旧档无 fresh 字段恢复不报错');
  // 带条目第 7 元 fresh
  const belt = put(new Belt('transport-belt', 5, 0)); belt.dir = 0;
  belt.acceptItem('nutrients');
  const bs = belt.serialize();
  ok(bs.items[0].length === 7 && typeof bs.items[0][6] === 'number', '带条目 7 元含 fresh');
  const belt2 = Belt.restore(bs);
  ok(typeof belt2.items[0].fresh === 'number', '带条目恢复 fresh');
  const beltOld = Belt.restore({ type: 'transport-belt', x: 5, y: 0, dir: 0, items: [['nutrients', 0.5]] });
  ok(beltOld.items[0].fresh === undefined && beltOld.items[0].item === 'nutrients', '旧档带条目（无第7元）恢复不报错');
}

console.log('\n【平台设备存档字段闭环】');
{
  fresh();
  const t = put(new Thruster('thruster', 0, 0));
  t.fuelBuf = 123.5; t.oxidBuf = 77.25;
  const ts = t.serialize();
  const t2 = Thruster.restore(ts);
  ok(t2.fuelBuf === 123.5 && t2.oxidBuf === 77.25, '推进器 fuelBuf/oxidBuf 恢复');
  const c = put(new AsteroidCollector('asteroid-collector', 10, 0));
  c.buf = { 'metallic-asteroid-chunk': 4 }; c.timer = 7.5;
  const c2 = AsteroidCollector.restore(c.serialize());
  ok(c2.buf['metallic-asteroid-chunk'] === 4 && c2.timer === 7.5, '收集器 buf/timer 恢复');
  const h = put(new SpacePlatformHub('space-platform-hub', 20, 0));
  h.cargo = { 'steel-plate': 12 }; h.cargoTarget = 'vulcanus';
  const h2 = SpacePlatformHub.restore(h.serialize());
  ok(h2.cargo['steel-plate'] === 12 && h2.cargoTarget === 'vulcanus', '中枢 cargo/cargoTarget 恢复');
}

console.log('\n【回收机存档字段闭环】');
{
  fresh();
  const r = put(new Recycler('recycler', 0, 0));
  r.recycleItem = 'iron-gear-wheel'; r.outp = { 'iron-plate': 2 }; r.prog = 0.5; r.crafting = true;
  const r2 = Recycler.restore(r.serialize());
  ok(r2.recycleItem === 'iron-gear-wheel' && r2.outp['iron-plate'] === 2 && r2.crafting === true,
    '回收机 recycleItem/outp/crafting 恢复');
}

console.log('\n【废弃物品迁移语义（migrateIds 行为复刻核验）】');
{
  // 复刻 applySave 的 migrateIds：对象键/字符串值同时处理
  const ID_MIGRATE = { 'iron-gear': 'iron-gear-wheel' };
  function migrateIds(obj) {
    if (Array.isArray(obj)) { for (let i = 0; i < obj.length; i++) obj[i] = migrateIds(obj[i]); return obj; }
    if (obj && typeof obj === 'object') {
      for (const k of Object.keys(obj)) {
        if (OBSOLETE.includes(k)) { delete obj[k]; continue; }
        const nk = ID_MIGRATE[k] || k;
        if (nk !== k) { obj[nk] = migrateIds(obj[k]); delete obj[k]; }
        else obj[k] = migrateIds(obj[k]);
      }
      return obj;
    }
    if (typeof obj === 'string') return OBSOLETE.includes(obj) ? '' : (ID_MIGRATE[obj] || obj);
    return obj;
  }
  const inv = { 'thruster-fuel-barrel': 5, 'iron-plate': 10, 'iron-gear': 1, 'iron-gear-wheel~uncommon': 3 };
  migrateIds(inv);
  ok(!('thruster-fuel-barrel' in inv) && inv['iron-plate'] === 10, '废弃物品键被清除，正常键保留');
  ok(inv['iron-gear-wheel'] === 1, 'ID_MIGRATE 键迁移（iron-gear→iron-gear-wheel）');
  ok(inv['iron-gear-wheel~uncommon'] === 3, '品质变体 id 不受迁移影响');
  const arr = ['thruster-oxidizer-barrel', 'copper-plate'];
  migrateIds(arr);
  ok(arr[0] === '' && arr[1] === 'copper-plate', '数组中的废弃物品字符串值置空（不清数组位）');
}

console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
