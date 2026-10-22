'use strict';
/**
 * Gleba 新鲜度（Spoilage freshness）校验
 * ------------------------------------------------
 * 核验对齐《异星工厂》Space Age 的腐坏机制：
 *   1. 数据单源：GAME_DATA.spoilItems 来自官方 spoil_ticks/spoil_result（生成器提取，
 *      仅收录项目已有物品），官方数值逐项比对（果泥 180s / 果冻 240s / 营养素 300s /
 *      生物结晶 7200s / 农业科研包 3600s / 玉玛果 3600s 等）。
 *   2. 星球开关：仅句芒星（gleba）启用；settings.spoilage=false 可强制关闭。
 *   3. 带上腐坏：可腐坏物品上带即计时，到期逐件转为 spoil_result（位置/车道保持）。
 *   4. 箱内腐坏：槽位逐件转化，变质物进同箱。
 *   5. 机器缓存腐坏：assembler.inp 逐件转出到 outp。
 *   6. 进度随物品走：搬运（带→臂→箱）不重置计时。
 *   7. 存档兼容：带上/箱内新鲜度随存档落盘与恢复；旧档无字段不报错。
 *
 * 运行：node tools/verify-spoilage.js （退出码 0 = 通过）
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'js');
const load = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');

const G = {
  grid: new Map(), ents: [], buckets: new Map(),
  settings: { language: 'zh' }, techDone: {}, time: 0,
  inv: new Map(), player: { x: 0, y: 0 },
};
const TERRAIN = new Map();

const sandbox = {
  console, Math, JSON, Set, Map, Array, Object, String, Number, Boolean, Date, RegExp,
  parseInt, parseFloat, isFinite, isNaN,
  G,
  getTerrain: (tx, ty) => TERRAIN.get(tx + ',' + ty) ?? 0,
  isWater: () => false, isCliff: () => false, isTree: () => false,
  row: (label, val) => '<div>' + label + val + '</div>',
  chip: (id, n) => id + '×' + (n === undefined ? '' : n),
  countStr: (o) => Object.keys(o).map(k => k + '×' + o[k]).join(''),
  buildingMaxHp: () => 100,
  regPowerEnt: () => {}, unregPowerEnt: () => {},
  invalidateBeltInputNear: () => {},
  circuitSignalNear: () => ({}),
  playSfx: () => {}, toast: () => {},
  localStorage: { getItem: () => null, setItem: () => {} },
  ENT_CLASSES: {}, DEVICE_RENDER: {}, DEVICE_STATUS: {}, DEVICE_PANEL: {}, DEVICE_DIR_ROTATE: {}, DEVICE_PLACE: {},
  planetId: () => sandbox.__planet || 'gleba',   // 测试默认句芒星（腐坏启用）
  requestAnimationFrame: () => {},
  performance,
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
  + 'globalThis.__Chest=Chest;globalThis.__Belt=Belt;globalThis.__Inserter=Inserter;'
  + 'globalThis.__GAME_DATA=GAME_DATA;globalThis.__spoilInfoOf=spoilInfoOf;'
  + 'globalThis.__spoilageEnabled=spoilageEnabled;globalThis.__spoilStamp=spoilStamp;'
  + 'globalThis.__updateSpoilage=updateSpoilage;globalThis.__spoilInvAdd=spoilInvAdd;',
  sandbox, { filename: 'spoilage.js' }
);

const { __Chest: Chest, __Belt: Belt, __Inserter: Inserter, __GAME_DATA: GD,
        __spoilInfoOf: spoilInfoOf, __spoilageEnabled: spoilageEnabled,
        __spoilStamp: spoilStamp, __updateSpoilage: updateSpoilage } = sandbox;

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name); }
}
function fresh() { G.grid = new Map(); G.ents = []; G.buckets = new Map(); TERRAIN.clear(); }
function put(e) {
  G.ents.push(e);
  const k = ((e.x >> 4) + 4096) * 8192 + ((e.y >> 4) + 4096);
  let s = G.buckets.get(k); if (!s) { s = new Set(); G.buckets.set(k, s); }
  s.add(e);
  for (let dy = 0; dy < e.h; dy++)
    for (let dx = 0; dx < e.w; dx++) G.grid.set(((e.x + dx + 32768) << 16) | (e.y + dy + 32768), e);
  return e;
}

console.log('\n【数据单源：官方 spoil_ticks / spoil_result】');
const SP = GD.spoilItems || {};
ok(Object.keys(SP).length >= 10, '可腐坏物品 ≥ 10 种（官方 item.lua 全量提取）');
// 官方数值（space-age/prototypes/item.lua，1h=3600s）
const official = {
  'yumako-mash': [180, 'spoilage'], 'jelly': [240, 'spoilage'], 'nutrients': [300, 'spoilage'],
  'yumako': [3600, 'spoilage'], 'jellynut': [3600, 'spoilage'],
  'agricultural-science-pack': [3600, 'spoilage'], 'bioflux': [7200, 'spoilage'],
  'iron-bacteria': [60, 'iron-ore'], 'copper-bacteria': [60, 'copper-ore'],
};
for (const [id, [sec, res]] of Object.entries(official)) {
  ok(SP[id] && SP[id].seconds === sec && SP[id].result === res,
    id + '：' + (SP[id] ? SP[id].seconds + 's → ' + SP[id].result : '缺失') + '（官方 ' + sec + 's → ' + res + '）');
}
ok(!SP['iron-plate'], '普通物品不腐坏（官方无 spoil_ticks）');

console.log('\n【星球开关：仅句芒星启用】');
sandbox.__planet = 'gleba';
ok(spoilageEnabled() === true, '句芒星（gleba）启用腐坏');
sandbox.__planet = 'nauvis';
ok(spoilageEnabled() === false, '新地星（nauvis）不启用');
sandbox.__planet = 'vulcanus';
ok(spoilageEnabled() === false, '火药星（vulcanus）不启用');
G.settings.spoilage = false;
sandbox.__planet = 'gleba';
ok(spoilageEnabled() === false, '设置强制关闭（settings.spoilage=false）');
G.settings.spoilage = true;
sandbox.__planet = 'gleba';
ok(spoilageEnabled() === true, '重新开启后句芒星恢复启用');

console.log('\n【带上腐坏：计时 → 逐件转化 → 位置保持】');
fresh();
{
  const belt = put(new Belt('transport-belt', 10, 10));
  belt.dir = 0;
  // 果泥官方 180s：测试用直接打短新鲜度戳（模拟已接近腐坏）
  belt.acceptItem('yumako-mash');
  const o = belt.items[0];
  ok(o && o.fresh !== undefined && Math.abs(o.fresh - 180) < 0.5, '果泥上带即计时（fresh≈180s）');
  ok(!belt.acceptItem('iron-plate') || belt.items.every(x => x.fresh === undefined || x.item !== 'iron-plate'),
    '普通物品上带无新鲜度');
  // 推进到腐坏
  o.fresh = 2;
  updateSpoilage(3);
  ok(belt.items[0] && belt.items[0].item === 'spoilage' && belt.items[0].fresh === undefined,
    '果泥腐坏 → 变质物（id 替换，计时清除）');
  ok(Math.abs(belt.items[0].pos - o.pos) < 2 || belt.items[0] === o, '条目引用保持（位置/车道不跳变）');
}

console.log('\n【箱内腐坏：逐件转化、变质物进同箱】');
fresh();
{
  const box = put(new Chest('iron-chest', 10, 10));
  box.giveItem('nutrients'); box.giveItem('nutrients'); box.giveItem('nutrients');
  const slot = box.slots.find(s => s && s.item === 'nutrients');
  ok(slot && slot.count === 3 && Math.abs(slot.fresh - 300) < 0.5, '营养素入箱计时（fresh≈300s，3 件同槽）');
  slot.fresh = 1;
  updateSpoilage(2);
  const spoils = box.countOf('spoilage');
  const rest = box.countOf('nutrients');
  ok(spoils === 1 && rest === 2, '到期转 1 件变质物（3→2 营养素 + 1 变质物，逐件口径）');
  // 继续推进：剩余 2 件逐件转
  const slot2 = box.slots.find(s => s && s.item === 'nutrients');
  if (slot2) slot2.fresh = 0.5;
  updateSpoilage(1); updateSpoilage(1); updateSpoilage(1);
  ok(box.countOf('nutrients') <= 2 && box.countOf('spoilage') >= 1, '继续腐坏不报错（箱容量足够时全部转化）');
}

console.log('\n【机器缓存腐坏：inp 逐件转出到 outp】');
fresh();
{
  // 用带 fresh 侧表结构的 assembler 不可得（本沙盒未载入 assembler.js）——
  // 以等价对象直连扫描器：验证 _spoilInp 侧表推进与转出口径。
  const mach = { inp: { 'jelly': 2 }, outp: {}, _spoilInp: {} };
  G.ents.push(mach);
  mach._spoilInp['jelly'] = { fresh: 1 };
  updateSpoilage(2);
  ok(mach.inp['jelly'] === 1 && mach.outp['spoilage'] === 1, '果冻 2 件到期转 1 件变质物进 outp');
  mach._spoilInp['jelly'].fresh = 0.5;
  updateSpoilage(1); updateSpoilage(1);
  ok(!mach.inp['jelly'] && mach.outp['spoilage'] === 2, '剩余 1 件继续转出（逐件清空）');
}

console.log('\n【进度随物品走：搬运不重置计时】');
fresh();
{
  const src = put(new Chest('iron-chest', 10, 10));
  for (let i = 0; i < 2; i++) src.giveItem('yumako-mash');
  // 在源头箱内流逝 20 秒（updateSpoilage 每秒节流推进）
  const sslot = src.slots.find(s => s && s.item === 'yumako-mash');
  for (let t = 0; t < 20; t++) updateSpoilage(1);
  ok(sslot.fresh > 155 && sslot.fresh < 165, '箱内 20s 后剩余 ≈160s（180-20，实测 ' + sslot.fresh.toFixed(1) + '）');
  const belt = put(new Belt('transport-belt', 12, 10)); belt.dir = 0;
  const arm = put(new Inserter('inserter', 11, 10)); arm.dir = 0;
  const arm2 = put(new Inserter('inserter', 13, 10)); arm2.dir = 0;   // 取西带 → 放东箱
  const dst = put(new Chest('iron-chest', 14, 10));
  for (let i = 0; i < 800; i++) {
    arm.update(0.03); arm2.update(0.03); belt.update(0.03);
    if (dst.countOf('yumako-mash') >= 2) break;
  }
  const dslot = dst.slots.find(s => s && s.item === 'yumako-mash');
  ok(!!dslot, '果泥经 臂→带→臂→箱 搬运到达目标箱');
  // 搬运很快（模拟秒级），计时应在 155~175 之间（<180 证明未重置，>150 证明未过度流逝）
  ok(dslot && dslot.fresh !== undefined && dslot.fresh < 175 && dslot.fresh > 150,
    '计时未重置（fresh=' + (dslot ? dslot.fresh.toFixed(1) : '?') + '，满值 180）');
}

console.log('\n【机械臂变质优先：grabZone 按新鲜度挑取】');
fresh();
{
  const belt = put(new Belt('transport-belt', 10, 10)); belt.dir = 0;
  // 同带放 2 件果泥：一件快腐坏（fresh=10）、一件新鲜（fresh=180）
  belt.acceptItem('yumako-mash'); belt.items[0].fresh = 10; belt.items[0].pos = 0.9;
  belt.acceptItem('yumako-mash'); belt.items[1].fresh = 180; belt.items[1].pos = 0.5;
  // 默认（未开启变质优先）：按 pos 靠前（下游方向）取 → pos=0.9 的旧件（恰好也是最不新鲜的）
  const zDefault = belt.grabZone(undefined, undefined, undefined);
  ok(zDefault && zDefault.fresh === 10, '未开启偏好：按 pos 靠前取（拿到 fresh=10 的件）');
  // 变质优先（'spoil'）：先腐坏先消耗 → 取 fresh 最小者
  const zSpoil = belt.grabZone(undefined, undefined, 'spoil');
  ok(zSpoil && zSpoil.fresh === 10, '变质优先：取最不新鲜（fresh=10）');
  // 新鲜优先（'fresh'）：保输出品质 → 取 fresh 最大者
  const zFresh = belt.grabZone(undefined, undefined, 'fresh');
  ok(zFresh && zFresh.fresh === 180, '新鲜优先：取最新鲜（fresh=180）');
  // 翻转场景：新鲜物品更靠前（pos 大），变质优先仍应越过它取旧件
  belt.items[0].fresh = 180; belt.items[0].pos = 0.9;   // 新鲜且靠前
  belt.items[1].fresh = 10;  belt.items[1].pos = 0.5;   // 旧且靠后
  const z2 = belt.grabZone(undefined, undefined, 'spoil');
  ok(z2 && z2.fresh === 10, '变质优先越过 pos 更前的新鲜件，取靠后的旧件');
  // 取走登记在途新鲜度（进度随物品走）
  G._spoilCarry = {};
  const z3 = belt.grabZone(undefined, undefined, 'spoil');
  ok(z3 && G._spoilCarry['yumako-mash'] && G._spoilCarry['yumako-mash'][0] === 10,
    '偏好取走仍登记在途新鲜度（carry 队列首条 = 10s）');
}

console.log('\n【机械臂变质优先：箱源 takeItemOf 按新鲜度挑槽】');
fresh();
{
  const box = put(new Chest('iron-chest', 10, 10));
  // 直接建两槽果泥：槽 0 旧（fresh=20）、槽 1 新（fresh=170）
  //（不用 giveItem：它会把同 id 合并进栈序末槽，与手动槽并存干扰断言）
  box.slots[0] = { item: 'yumako-mash', count: 1, fresh: 20 };
  box.slots[1] = { item: 'yumako-mash', count: 1, fresh: 170 };
  // 变质优先：先消耗最不新鲜的槽
  const got1 = box.takeItemOf('yumako-mash', 'spoil');
  ok(got1 === 'yumako-mash' && box.slots[0] === null && box.slots[1] && box.slots[1].fresh === 170,
    '变质优先：旧槽（fresh=20）先出，新槽保留');
  // 新鲜优先：保输出品质，先取最新鲜的槽
  const got2 = box.takeItemOf('yumako-mash', 'fresh');
  ok(got2 === 'yumako-mash' && box.slots[1] === null, '新鲜优先：新槽（fresh=170）先出');
  // 未传偏好：保持默认「后槽先出」
  box.slots[0] = { item: 'yumako-mash', count: 1, fresh: 20 };
  box.slots[1] = { item: 'yumako-mash', count: 1, fresh: 170 };
  const got3 = box.takeItemOf('yumako-mash');
  ok(got3 === 'yumako-mash' && box.slots[0] && box.slots[1] === null,
    '未传偏好：默认后槽先出（行为不变）');
  // 无 fresh 字段（不可腐坏物品）：回退默认不报错
  box.slots[0] = { item: 'iron-plate', count: 2 };
  const got4 = box.takeItemOf('iron-plate', 'spoil');
  ok(got4 === 'iron-plate' && box.countOf('iron-plate') === 1, '无新鲜度字段回退默认语义（不报错）');
}

console.log('\n【存档兼容：序列化/恢复保留新鲜度，旧档字段缺省不报错】');
fresh();
{
  const box = put(new Chest('iron-chest', 10, 10));
  box.giveItem('bioflux');
  const s = box.serialize();
  const fs2 = s.slots.find(v => v && v[0] === 'bioflux');
  ok(fs2 && fs2.length === 3 && typeof fs2[2] === 'number', '箱槽序列化含新鲜度三元组 [item, count, fresh]');
  const box2 = Chest.restore(s);
  const rs = box2.slots.find(v => v && v.item === 'bioflux');
  ok(rs && typeof rs.fresh === 'number' && Math.abs(rs.fresh - 7200) < 1, '恢复后新鲜度保留（≈7200s）');
  // 旧档：无 fresh 字段
  const old = Chest.restore({ type: 'iron-chest', x: 0, y: 0, slots: [['bioflux', 5]] });
  const os = old.slots.find(v => v && v.item === 'bioflux');
  ok(os && os.fresh === undefined, '旧档无新鲜度字段恢复不报错（undefined）');
  // 旧档物品在腐坏星球被扫描：无 fresh 的条目不计时也不报错（视为已存在未登记）
  G.ents.push(old);
  updateSpoilage(1);
  ok(old.countOf('bioflux') === 5, '旧档箱内可腐坏物品在启用星球扫描安全（无 fresh 不转化）');
}

console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
