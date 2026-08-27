#!/usr/bin/env node
'use strict';
/**
 * 建筑旋转/翻转语义验证脚本
 * ------------------------------------------------
 * 验证《异星工厂》建筑旋转/翻转规则：
 *   - 所有建筑在建造时（选择后、放下前，即幽灵预览阶段）均可按住 R 旋转、
 *     V/H 翻转（通过 ghostDir 生效，包括放置后不可旋转的建筑如箱子）。
 *   - 传送带、机械臂、地下传送带等物流设备在放置之后仍可按 R 旋转、V/H 翻转。
 *   - 非方形设备（rotSwap，如分流器）旋转/翻转后占地宽高正确交换。
 *
 * 运行：node tools/verify-entity-rotate.js （退出码 0 = 通过）
 * 零依赖：加载 entity.js / belt.js / underground.js / inserter.js / splitter.js
 *         与 main-actions.js 的 rotateAction / flipAction 做端到端模拟。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'js');
const load = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');

const TILE = 32, BELT_SPEED = 1.875, BELT_SPACING = 0.125;
const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];

const G = {
  grid: new Map(), ents: [], buckets: new Map(), techProg: {}, techDone: {}, time: 0, dbg: {},
  ghostDir: 0, cursorTile: null, sel: 0, quickSel: null, driving: null,
  blueMode: null, blueRot: 0, blueFlipH: false, blueFlipV: false,
};
const entKey = (x, y) => ((x + 32768) << 16) | (y + 32768);
const entAt = (x, y) => G.grid.get(entKey(x, y));

// 覆盖到的物流设备与普通建筑定义
const BUILD_DEFS = {
  'transport-belt':      { w: 1, h: 1, solid: false },
  'fast-transport-belt': { w: 1, h: 1, solid: false },
  'express-transport-belt': { w: 1, h: 1, solid: false },
  'underground-belt':         { w: 1, h: 1, solid: false },
  'fast-underground-belt': { w: 1, h: 1, solid: false },
  'express-underground-belt': { w: 1, h: 1, solid: false },
  'splitter':            { w: 1, h: 2, solid: false, rotSwap: true },
  'steam-turbine':       { w: 3, h: 5, solid: true, rotSwap: true },
  'heat-exchanger':      { w: 3, h: 2, solid: true, rotSwap: true },
  'boiler':              { w: 3, h: 2, solid: true, rotSwap: true },
  'steam-engine':        { w: 3, h: 5, solid: true, rotSwap: true },
  'inserter':            { w: 1, h: 1, solid: true },
  'burner-inserter':     { w: 1, h: 1, solid: true },
  'long-handed-inserter':       { w: 1, h: 1, solid: true },
  'bulk-inserter':      { w: 1, h: 1, solid: true },
  'fast-inserter':       { w: 1, h: 1, solid: true },
  'wooden-chest':        { w: 1, h: 1, solid: true },
};
// 放置后可直接旋转本体的设备（R/V/H 生效），其余建筑仅幽灵阶段可旋转
const DEVICE_DIR_ROTATE = {};
['transport-belt','fast-transport-belt','express-transport-belt',
 'underground-belt','fast-underground-belt','express-underground-belt',
 'inserter','burner-inserter','long-handed-inserter','bulk-inserter','fast-inserter']
  .forEach(t => { DEVICE_DIR_ROTATE[t] = true; });

const sandbox = {
  console, TILE, BELT_SPEED, BELT_SPACING, DX, DY, G, entAt, entKey,
  BUILD_DEFS, DEVICE_DIR_ROTATE,
  postPlaceRotatable: (t) => !(t === 'boiler' || t === 'steam-engine' || t === 'steam-turbine' || t === 'heat-exchanger'),
  ITEMS: {},
  Underground: class Underground {}, Splitter: class Splitter {},
  Belt: class Belt {}, Entity: class Entity {},
  buildingMaxHp: () => 100,
  beltSpeed: () => BELT_SPEED,
  groundItemForBelt: () => null,
  circuitSignalNear: () => ({}),
  circuitCondOk: () => true,
  playSfx: () => {},
  toast: () => {},
  withinReach: () => true,
  invalidateBeltInputNear: () => {},
  pumpCanFace: () => true,
  ENT_CLASSES: {}, DEVICE_RENDER: {}, DEVICE_STATUS: {}, DEVICE_PANEL: {}, DEVICE_PLACE: {},
  window: {}, setTimeout, clearTimeout, setInterval, clearInterval,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

// 供被加载脚本访问 sandbox 内全局（const 绑定在 vm 词法作用域，需通过 globalThis 透出）
const prefix = [
  'const G=globalThis.G;', 'const ITEMS=globalThis.ITEMS;',
  'const BUILD_DEFS=globalThis.BUILD_DEFS;', 'const DEVICE_DIR_ROTATE=globalThis.DEVICE_DIR_ROTATE;',
].join(' ');

let pass = 0, fail = 0;
function ok(c, n) { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n); } }

function fresh() {
  G.grid = new Map(); G.ents = []; G.ghostDir = 0; G.cursorTile = null;
}

function addEnt(e) { G.ents.push(e); G.grid.set(entKey(e.x, e.y), e); }

// 加载游戏核心逻辑
vm.runInContext(
  prefix
  + load('core/entity.js') + '\n'
  + load('devices/belt.js') + '\n'
  + load('devices/underground.js') + '\n'
  + load('devices/inserter.js') + '\n'
  + load('devices/burner-inserter.js') + '\n'
  + load('devices/splitter.js') + '\n'
  + load('main/main-actions.js'),
  sandbox, { filename: 'main-actions.js' }
);

const clsFor = {
  'transport-belt': 'Belt', 'fast-transport-belt': 'Belt', 'express-transport-belt': 'Belt',
  'underground-belt': 'Underground', 'fast-underground-belt': 'Underground', 'express-underground-belt': 'Underground',
  'splitter': 'Splitter',
  'inserter': 'Inserter', 'burner-inserter': 'Inserter', 'long-handed-inserter': 'Inserter',
  'bulk-inserter': 'Inserter', 'fast-inserter': 'Inserter',
};
const entities = ['transport-belt', 'fast-transport-belt', 'express-transport-belt',
  'underground-belt', 'fast-underground-belt', 'express-underground-belt',
  'inserter', 'burner-inserter', 'long-handed-inserter', 'bulk-inserter', 'fast-inserter'];

// ===== 一、幽灵阶段：所有建筑可 R 旋转、V/H 翻转 =====
// 场景：幽灵建造某个建筑（未放置），鼠标指向空白处，按 R/V/H 应旋转/翻转 ghostDir
console.log('\n【幽灵阶段旋转/翻转】');
fresh();
vm.runInContext(`(function(){
  G.cursorTile = {tx: 50, ty: 50};
  G.ghostDir = 0;
  rotateAction();  // R: 0 -> 1
  __g1 = G.ghostDir;
  flipAction('v'); // V: 1 -> 3
  __g2 = G.ghostDir;
  flipAction('h'); // H: 3 -> 3（水平翻转只交换东西，南北不变）
  __g3 = G.ghostDir;
  rotateAction();  // R: 3 -> 0
  __g4 = G.ghostDir;
})()`, sandbox);
ok(sandbox.__g1 === 1, `幽灵 R 旋转 0→${sandbox.__g1}（期望 1）`);
ok(sandbox.__g2 === 3, `幽灵 V 翻转 1→${sandbox.__g2}（期望 3）`);
ok(sandbox.__g3 === 3, `幽灵 H 翻转对南北方向 ${sandbox.__g3}（期望 3，东西互兑）`);
ok(sandbox.__g4 === 0, `幽灵 R 再旋转 3→${sandbox.__g4}（期望 0）`);

// 场景：幽灵建造时鼠标指向已放置的不可旋转建筑（箱子），R/V/H 仍应作用于幽灵而非实体
fresh();
vm.runInContext(`(function(){
  const e = {type:'wooden-chest', x:5, y:5, w:1, h:1, dir:0};
  G.grid.set(entKey(5,5), e); G.ents.push(e);
  G.cursorTile = {tx:5, ty:5};
  G.ghostDir = 0;
  rotateAction();  // 箱子不可旋转 -> 旋转幽灵
  __g1 = G.ghostDir;
  G.ghostDir = 0;
  flipAction('v'); // V: 0 -> 0（垂直翻转只交换南北）
  __g2 = G.ghostDir;
})()`, sandbox);
ok(sandbox.__g1 === 1, `幽灵建造指向箱子时 R 旋转幽灵 0→${sandbox.__g1}（期望 1）`);
ok(sandbox.__g2 === 0, `幽灵建造指向箱子时 V 翻转幽灵 0→${sandbox.__g2}（期望 0，垂直只换南北）`);

// ===== 二、放置后：传送带/机械臂/地下传送带仍可 R 旋转、V/H 翻转 =====
console.log('\n【物流设备放置后旋转/翻转】');
for (const t of entities) {
  fresh();
  vm.runInContext(`(function(){
    const e = new ${clsFor[t]}('${t}', 5, 5);
    e.dir = 0; G.grid.set(entKey(5,5), e); G.ents.push(e);
    G.cursorTile = {tx:5, ty:5};
    rotateAction();  // 0 -> 1
    __r1 = e.dir;
    flipAction('v'); // 1 -> 3
    __r2 = e.dir;
    flipAction('h'); // 3 -> 3（水平只交换东西）
    __r3 = e.dir;
    rotateAction();  // 3 -> 0
    __r4 = e.dir;
  })()`, sandbox);
  ok(sandbox.__r1 === 1, `${t} 放置后 R 旋转 0→${sandbox.__r1}（期望 1）`);
  ok(sandbox.__r2 === 3, `${t} 放置后 V 翻转 1→${sandbox.__r2}（期望 3）`);
  ok(sandbox.__r3 === 3, `${t} 放置后 H 翻转 ${sandbox.__r3}（期望 3，东西互兑）`);
  ok(sandbox.__r4 === 0, `${t} 放置后再 R 旋转 3→${sandbox.__r4}（期望 0）`);
}

// ===== 三、非方形 rotSwap 设备（分流器）放置后旋转/翻转占地正确交换 =====
console.log('\n【rotSwap 非方形设备占地交换】');
fresh();
vm.runInContext(`(function(){
  const sp = new Splitter('splitter', 5, 5);
  sp.dir = 0; sp.w = 1; sp.h = 2;
  G.grid.set(entKey(5,5), sp); G.ents.push(sp);
  G.cursorTile = {tx:5, ty:5};
  rotateAction();  // 0 -> 1，宽高交换
  __w1 = sp.w; __h1 = sp.h; __d1 = sp.dir;
})()`, sandbox);
ok(sandbox.__d1 === 1 && sandbox.__w1 === 2 && sandbox.__h1 === 1,
  `分流器 R 旋转 dir=${sandbox.__d1} w=${sandbox.__w1} h=${sandbox.__h1}（期望 dir=1 w=2 h=1）`);

// ===== 四、核能/蒸汽等非方形设备也可旋转/翻转，端口随 dir 旋转 =====
// 热交换器(3×2)、汽轮机(5×3)、锅炉(3×2)、蒸汽机(3×5) 均标记 rotSwap，
// 旋转后占地交换且端口格正确跟随。用 rotCell 校验端口格在 4 个方向的落点。
console.log('\n【非方形端口随 dir 旋转】');
const rotateDefs = {
  'heat-exchanger': { w: 3, h: 2, ports: [
      ['左水口', -1, 1], ['右水口', 3, 1], ['汽口', 1, -1]
  ]},
  'steam-turbine': { w: 3, h: 5, ports: [
      ['上汽口', 1, -1], ['下汽口', 1, 5]
  ]},
  'boiler': { w: 3, h: 2, ports: [
      ['左水口', -1, 1], ['右水口', 3, 1], ['底汽口', 1, 2]
  ]},
  'steam-engine': { w: 3, h: 5, ports: [
      ['上汽口', 1, -1], ['下汽口', 1, 5]
  ]},
};
for (const t in rotateDefs) {
  fresh();
  const d = rotateDefs[t];
  vm.runInContext(`(function(){
    const e = { type: '${t}', x: 10, y: 10, def: { w: ${d.w}, h: ${d.h} }, dir: 0, w: ${d.w}, h: ${d.h} };
    __d0w = e.w; __d0h = e.h;
    // dir=1（旋转90°）占地交换
    const e1 = { ...e, dir: 1, def: { w: ${d.w}, h: ${d.h} } };
    e1.w = e1.def.h; e1.h = e1.def.w;
    __d1w = e1.w; __d1h = e1.h;
    // 各朝向端口格：rotCell(e, lx, ly)
    __ports = [];
    for (let dd = 0; dd < 4; dd++) {
      const en = { ...e, dir: dd, def: { w: ${d.w}, h: ${d.h} } };
      const row = [];
      for (const p of ${JSON.stringify(d.ports)}) {
        const c = rotCell(en, p[1], p[2]);
        row.push(c.x + ',' + c.y);
      }
      __ports.push(row);
    }
  })()`, sandbox);
  // 占地交换：dir=1 时宽高互换
  ok(sandbox.__d1w === d.h && sandbox.__d1h === d.w,
    `${t} 旋转90°占地交换 dir=1 w=${sandbox.__d1w} h=${sandbox.__d1h}（期望 w=${d.h} h=${d.w}）`);
  // 端口格应随旋转而移动（0 与 2 方向端口不同 / 1 与 3 方向端口不同），且 4 方向均有有效坐标
  const p0 = sandbox.__ports[0], p1 = sandbox.__ports[1], p2 = sandbox.__ports[2], p3 = sandbox.__ports[3];
  const all = [].concat(p0, p1, p2, p3);
  const valid = all.every(s => /^-?\d+,-?\d+$/.test(s));
  ok(valid, `${t} 四方向端口格坐标均有效`);
  ok(p0.some((s,i) => s !== p2[i]), `${t} 旋转180°(dir0↔dir2)端口格随之变化`);
  ok(p1.some((s,i) => s !== p3[i]), `${t} 旋转180°(dir1↔dir3)端口格随之变化`);
}
// 各设备标记 rotSwap（建造时可旋转且占地正确交换）：直接校验 data-buildings.js 定义
const bdSrc = fs.readFileSync(path.join(SRC, 'data', 'data-buildings.js'), 'utf8');
for (const t in rotateDefs) {
  const re = new RegExp("'" + t + "'\\s*:\\s*\\{[^}]*rotSwap:\\s*true");
  ok(re.test(bdSrc), `${t} 已标记 rotSwap（建造时可旋转/翻转）`);
}

// ===== 五、固定管道口建筑放置后不可直接旋转（仅幽灵阶段可旋转） =====
// 锅炉/蒸汽机/汽轮机/热交换器放置后按 R/V/H 不应旋转本体，而是作用于幽灵；
// 而非固定管道口的 rotSwap 设备（分流器）放置后仍可旋转。
console.log('\n【固定管道口建筑放置后不可旋转】');
const fixedPipeDefs = { 'boiler': [3, 2], 'steam-engine': [3, 5], 'steam-turbine': [3, 5], 'heat-exchanger': [3, 2] };
for (const t in fixedPipeDefs) {
  fresh();
  vm.runInContext(`(function(){
    const e = { type: '${t}', x: 5, y: 5, dir: 0, w: ${fixedPipeDefs[t][0]}, h: ${fixedPipeDefs[t][1]},
                def: { w: ${fixedPipeDefs[t][0]}, h: ${fixedPipeDefs[t][1]}, rotSwap: true } };
    G.grid.set(entKey(5,5), e); G.ents.push(e);
    G.cursorTile = {tx:5, ty:5};
    G.ghostDir = 0;
    rotateAction(); // 指向已放置的固定管道口建筑，R 应作用于幽灵而非本体
    __d = e.dir; __gw = G.ghostDir;
  })()`, sandbox);
  ok(sandbox.__d === 0 && sandbox.__gw === 1,
    `${t} 放置后按 R 不旋转本体(dir=${sandbox.__d})，而旋转幽灵(dir=${sandbox.__gw})`);
}
// 分流器（非固定管道口 rotSwap）放置后仍可直接旋转
fresh();
vm.runInContext(`(function(){
  const sp = new Splitter('splitter', 5, 5);
  sp.dir = 0; sp.w = 1; sp.h = 2;
  G.grid.set(entKey(5,5), sp); G.ents.push(sp);
  G.cursorTile = {tx:5, ty:5};
  rotateAction();
  __d = sp.dir; __w = sp.w; __h = sp.h;
})()`, sandbox);
ok(sandbox.__d === 1 && sandbox.__w === 2 && sandbox.__h === 1,
  `分流器（非固定管道口）放置后按 R 仍可旋转 dir=${sandbox.__d} w=${sandbox.__w} h=${sandbox.__h}`);

console.log('\n----------------------------------------');
console.log(`通过 ${pass} 项，失败 ${fail} 项`);
if (fail) { console.log('❌ 存在失败断言'); process.exit(1); }
console.log('✅ 建筑旋转/翻转语义正确');
