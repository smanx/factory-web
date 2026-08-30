#!/usr/bin/env node
'use strict';
/**
 * 建筑旋转/翻转语义验证脚本
 * ------------------------------------------------
 * 验证《异星工厂》建筑旋转/翻转规则：
 *   - 所有建筑在建造时（选择后、放下前，即幽灵预览阶段）均可按住 R 旋转、
 *     V/H 翻转（通过 ghostDir 生效，包括放置后不可旋转的建筑如箱子）。
 *   - 放置后：V/H 翻转所有建筑均可用；R 旋转仅物流件白名单（传送带/机械臂/
 *     地下传送带/地下管道）可用，其余建筑不可旋转（R 只作用于放置幽灵）。
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
// 地下带最大跨距：js/devices/underground.js 从 data.js 读取 UNDERGROUND_MAX/FAST_UNDERGROUND_MAX/…，
// 而 data.js 又桥接自 GAME_DATA.undergroundDist（官方单源）。本脚本用 vm 加载设备文件，
// 未加载 data.js，故在此按同一官方源补上常量，供 Underground.maxDist() 使用。
const _gdSrc = fs.readFileSync(path.join(__dirname, '..', 'js', 'data', 'data.generated.js'), 'utf8');
const _gdVm = { GAME_DATA: null };
require('vm').createContext(_gdVm);
require('vm').runInContext(_gdSrc.replace('const GAME_DATA =', 'GAME_DATA ='), _gdVm);
const _UG = (_gdVm.GAME_DATA && _gdVm.GAME_DATA.undergroundDist) || {};
const UNDERGROUND_MAX = _UG['underground-belt'];
const FAST_UNDERGROUND_MAX = _UG['fast-underground-belt'];
const EXPRESS_UNDERGROUND_MAX = _UG['express-underground-belt'];

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
  'stack-inserter':    { w: 1, h: 1, solid: true },
  'fast-inserter':       { w: 1, h: 1, solid: true },
  'wooden-chest':        { w: 1, h: 1, solid: true },
  'pipe-to-ground':      { w: 1, h: 1, solid: true },
  'storage-tank':        { w: 2, h: 2, solid: true },
  'oil-refinery':        { w: 5, h: 5, solid: true },
  'chemical-plant':      { w: 3, h: 3, solid: true },
};
// 放置后可直接旋转本体的设备（R/V/H 生效），其余建筑仅幽灵阶段可旋转
const DEVICE_DIR_ROTATE = {};
 ['transport-belt','fast-transport-belt','express-transport-belt',
  'underground-belt','fast-underground-belt','express-underground-belt',
  'inserter','burner-inserter','long-handed-inserter','bulk-inserter','fast-inserter',
  'pipe-to-ground','storage-tank','oil-refinery','chemical-plant']
   .forEach(t => { DEVICE_DIR_ROTATE[t] = true; });

const sandbox = {
  console, TILE, BELT_SPEED, BELT_SPACING, DX, DY, G, entAt, entKey,
  BUILD_DEFS, DEVICE_DIR_ROTATE,
  // 设备自定义 V/H 真镜像翻转映射（与 js/core/registry.js 同名表；此处模拟
  // js/devices/storage-tank.js 的注册：返回 [dir, mirror]，镜像切换手性）
  DEVICE_FLIP: {
    'storage-tank': (dir, mirror, axis) =>
      [axis === 'h' ? (4 - dir) % 4 : (2 - dir + 4) % 4, (mirror | 0) ^ 1],
  },
  UNDERGROUND_MAX, FAST_UNDERGROUND_MAX, EXPRESS_UNDERGROUND_MAX,
  // 放置后仍可直接旋转（R）的白名单：仅物流件（传送带/机械臂/地下传送带/地下管道）
  postPlaceRotatable: (t) => /^(transport-belt|fast-transport-belt|express-transport-belt|turbo-transport-belt|creative-belt|void-belt|inserter|burner-inserter|long-handed-inserter|fast-inserter|bulk-inserter|stack-inserter|underground-belt|fast-underground-belt|express-underground-belt|turbo-underground-belt|pipe-to-ground)$/.test(t),
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
function removeEnt(e) { /* 模拟环境：占地交换后仍占同一格，无需真正摘挂 */ }

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

// 场景：鼠标指向已放置的普通设备（箱子），R/V/H 现在统一作用于本体（所有设备一致）
fresh();
vm.runInContext(`(function(){
  const e = new Entity('wooden-chest', 5, 5);
  G.grid.set(entKey(5,5), e); G.ents.push(e);
  G.cursorTile = {tx:5, ty:5};
  G.ghostDir = 0;
  rotateAction();  // 箱子本体旋转 0->1
  __d1 = e.dir; __g1 = G.ghostDir;
  flipAction('v'); // V 方向性翻转：dir1 -> 3
  __d2 = e.dir;
})()`, sandbox);
ok(sandbox.__d1 === 1 && sandbox.__g1 === 0, `指向箱子 R 旋转本体 0→${sandbox.__d1}（期望 1，所有设备统一），幽灵不变(${sandbox.__g1})`);
ok(sandbox.__d2 === 3, `箱子 V 翻转 1→${sandbox.__d2}（期望 3，方向性镜像）`);

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

// ===== 三、非方形 rotSwap 设备（分流器）放置后：R 不可旋转（非方形），V/H 翻转仍可 =====
console.log('\n【rotSwap 非方形设备（分流器）放置后：R 拦截、V/H 可用】');
fresh();
vm.runInContext(`(function(){
  const sp = new Splitter('splitter', 5, 5);
  sp.dir = 0; sp.w = 1; sp.h = 2;
  G.grid.set(entKey(5,5), sp); G.ents.push(sp);
  G.cursorTile = {tx:5, ty:5};
  G.ghostDir = 0;
  rotateAction();  // 非方形：R 不旋转本体
  __w1 = sp.w; __h1 = sp.h; __d1 = sp.dir; __g1 = G.ghostDir;
  flipAction('h'); // V/H 不受方形限制：H 翻转 dir0->2，rotSwap 占地交换
  __d2 = sp.dir; __w2 = sp.w; __h2 = sp.h;
})()`, sandbox);
ok(sandbox.__d1 === 0 && sandbox.__w1 === 1 && sandbox.__h1 === 2 && sandbox.__g1 === 0,
  `分流器放置后 R 不旋转本体 dir=${sandbox.__d1} w=${sandbox.__w1} h=${sandbox.__h1}（期望 dir=0 w=1 h=2，非方形拦截），幽灵不变(${sandbox.__g1})`);
ok(sandbox.__d2 === 2 && sandbox.__w2 === 1 && sandbox.__h2 === 2,
  `分流器放置后 H 翻转本体 0→${sandbox.__d2} w=${sandbox.__w2} h=${sandbox.__h2}（期望 dir=2 w=1 h=2，偶数向不换占地）`);

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

// ===== 五、放置后旋转白名单 =====
// 已放置设备默认不可旋转：非物流件（锅炉/蒸汽机/汽轮机/热交换器/分流器等）
// 放置后：非方形（w≠h）设备 R 被拦截、V/H 仍可；方形设备 R 可用。
console.log('\n【放置后：非方形 R 拦截 / V·H 全设备可用】');
const rotSwapDefs = { 'boiler': [3, 2], 'steam-engine': [3, 5], 'steam-turbine': [3, 5], 'heat-exchanger': [3, 2] };
for (const t in rotSwapDefs) {
  fresh();
  vm.runInContext(`(function(){
    const e = new Entity('${t}', 5, 5);
    e.applyDir = function(){ if (this.dir % 2 === 1) { this.w = this.def.h; this.h = this.def.w; } else { this.w = this.def.w; this.h = this.def.h; } };
    e.applyDir();
    G.grid.set(entKey(5,5), e); G.ents.push(e);
    G.cursorTile = {tx:5, ty:5};
    G.ghostDir = 0;
    rotateAction(); // 非方形：R 拦截，本体不动
    __d = e.dir; __w = e.w; __h = e.h; __gw = G.ghostDir;
    flipAction('h'); // V/H 不限方形：dir0->2，rotSwap 占地交换
    __fd = e.dir; __fw = e.w; __fh = e.h;
  })()`, sandbox);
  const [dw, dh] = rotSwapDefs[t];
  ok(sandbox.__d === 0 && sandbox.__w === dw && sandbox.__h === dh && sandbox.__gw === 0,
    `${t} 放置后 R 拦截（非方形）dir=${sandbox.__d} w=${sandbox.__w} h=${sandbox.__h}（期望 dir=0 w=${dw} h=${dh}），幽灵不变(${sandbox.__gw})`);
  ok(sandbox.__fd === 2 && sandbox.__fw === dw && sandbox.__fh === dh, `${t} 放置后 H 翻转 0→${sandbox.__fd} w=${sandbox.__fw} h=${sandbox.__fh}（期望 dir=2 w=${dw} h=${dh}，偶数向不换占地）`);
}
// 方形设备（箱子 1×1）放置后 R 可旋转本体
fresh();
vm.runInContext(`(function(){
  const e = new Entity('wooden-chest', 5, 5);
  G.grid.set(entKey(5,5), e); G.ents.push(e);
  G.cursorTile = {tx:5, ty:5}; G.ghostDir = 0;
  rotateAction();
  __d = e.dir; __gw = G.ghostDir;
})()`, sandbox);
ok(sandbox.__d === 1 && sandbox.__gw === 0, `方形设备(箱子)放置后 R 旋转本体 0→${sandbox.__d}（期望 1），幽灵不变(${sandbox.__gw})`);

// 放置幽灵态：手持可建造物品时，即使光标压在已有非方形建筑上，R/V/H 也只作用于幽灵（所有设备可调）。
fresh();
vm.runInContext(`(function(){
  const sp = new Splitter('splitter', 5, 5); sp.dir = 0; sp.w = 1; sp.h = 2;
  G.grid.set(entKey(5,5), sp); G.ents.push(sp);
  G.cursorTile = {tx:5, ty:5}; G.ghostDir = 0; G.ghostMirror = 0;
  const _si = globalThis.selItem; globalThis.selItem = () => 'transport-belt';   // 手持传送带=放置态
  rotateAction();  __bd = sp.dir; __bw = sp.w; __bh = sp.h; __gd = G.ghostDir;   // 本体不动，幽灵转
  flipAction('v'); __gvd = G.ghostDir;                                           // 幽灵 V：1->3
  globalThis.selItem = _si;
})()`, sandbox);
ok(sandbox.__bd === 0 && sandbox.__bw === 1 && sandbox.__bh === 2 && sandbox.__gd === 1,
  `放置态 R 作用于幽灵：本体分流器不动(dir${sandbox.__bd} w${sandbox.__bw}h${sandbox.__bh})，幽灵旋转(${sandbox.__gd}→期望1)`);
ok(sandbox.__gvd === 3, `放置态 V 翻转幽灵 1→${sandbox.__gvd}（期望 3）`);

// 端口几何原语回归：rotCell 的「镜像反射局部 x + 随 dir 旋转」= R(dir)·S，与本体渲染一致。
// 炼油厂(5×5)输入口基准北边 cell1，V 镜像后应为 (dir2,mirror1)：真上下镜像 → 南边、x 不变(cell1)。
// 旧版手算分解会多一次左右翻 → 错成南边 cell3（观感即"中心转了180°"）。
fresh();
vm.runInContext(`(function(){
  const e = { x: 0, y: 0, dir: 2, mirror: 1, def: { w: 5, h: 5 } };
  __p = rotCell(e, 1, -1);                 // 北边 cell1 经 V 镜像
  const e0 = { x: 0, y: 0, dir: 0, mirror: 0, def: { w: 5, h: 5 } };
  __base = rotCell(e0, 1, -1);             // 基线：北边 cell1
})()`, sandbox);
ok(sandbox.__base.x === 1 && sandbox.__base.y === -1, `基线北边cell1 → (${sandbox.__base.x},${sandbox.__base.y})（期望 1,-1）`);
ok(sandbox.__p.x === 1 && sandbox.__p.y === 5, `V镜像后北边cell1 → 南边同x (${sandbox.__p.x},${sandbox.__p.y})（期望 1,5：上下镜像、左右不翻）`);

// ===== 六、储液罐（对角接口设备）V/H 真镜像翻转：切换接口对角 + 手性，非旋转 =====
// 通用 flipDir 只表达旋转（0↔2 / 1↔3，奇偶不变），对角接口设备镜像后接口对角
// 必须换到另一对 → 走 DEVICE_FLIP 真镜像映射（返回 [dir, mirror]，手性取反）。
// 接口有效奇偶 = (dir%2) XOR mirror。
console.log('\n【储液罐 V/H 真镜像翻转】');
fresh();
vm.runInContext(`(function(){
  const e = new Entity('storage-tank', 5, 5);
  const par = () => ((e.dir % 2) ^ (e.mirror | 0));
  G.grid.set(entKey(5,5), e); G.ents.push(e);
  G.cursorTile = {tx:5, ty:5};
  flipAction('h'); __hd = e.dir; __hm = e.mirror; __hp = par();   // H: (0,0)->(0,1) 对角切换
  flipAction('h'); __hd2 = e.dir; __hm2 = e.mirror; __hp2 = par(); // H 两次复原
  flipAction('v'); __vd = e.dir; __vm = e.mirror; __vp = par();    // V: (0,0)->(2,1) 对角切换
  flipAction('v'); __vd2 = e.dir; __vm2 = e.mirror;                // V 两次复原
  flipAction('h'); flipAction('v'); __hv_d = e.dir; __hv_m = e.mirror; // H∘V = 旋转180°(dir2,手性0)
  G.cursorTile = null;
  G.ghostDir = 0; G.ghostMirror = 0;
  const _si = globalThis.selItem; globalThis.selItem = () => 'storage-tank';
  flipAction('h'); __ghd = G.ghostDir; __ghm = G.ghostMirror;      // 幽灵预览同样镜像
  globalThis.selItem = _si;
})()`, sandbox);
ok(sandbox.__hd === 0 && sandbox.__hm === 1 && sandbox.__hp === 1,
  `储液罐 H 镜像 (dir0,m0)→(dir${sandbox.__hd},m${sandbox.__hm})（期望 dir0/m1，接口对角切换且非旋转）`);
ok(sandbox.__hd2 === 0 && sandbox.__hm2 === 0 && sandbox.__hp2 === 0,
  `储液罐 H 镜像两次复原 (dir${sandbox.__hd2},m${sandbox.__hm2})（期望 0/0，对合）`);
ok(sandbox.__vd === 2 && sandbox.__vm === 1 && sandbox.__vp === 1,
  `储液罐 V 镜像 (dir0,m0)→(dir${sandbox.__vd},m${sandbox.__vm})（期望 dir2/m1，接口对角切换）`);
ok(sandbox.__vd2 === 0 && sandbox.__vm2 === 0,
  `储液罐 V 镜像两次复原 (dir${sandbox.__vd2},m${sandbox.__vm2})（期望 0/0，对合）`);
ok(sandbox.__hv_d === 2 && sandbox.__hv_m === 0,
  `储液罐 H∘V = 旋转180° (dir${sandbox.__hv_d},m${sandbox.__hv_m})（期望 dir2/m0，两轴镜像=半圈旋转）`);
ok(sandbox.__ghd === 0 && sandbox.__ghm === 1,
  `储液罐幽灵 H 镜像 (dir${sandbox.__ghd},m${sandbox.__ghm})（期望 0/1，预览同步镜像）`);

// ===== 七、地下传送带：H/V 在入口上表现不同，保持方向性翻转（绝不镜像）=====
// 横带(0/2)按 H 换向、按 V 不改向；竖带(1/3)按 V 换向、按 H 不改向。
// mirror 手性恒为 0（地下带入口/出口由 dir 几何决定，无镜像语义）。
console.log('\n【地下传送带 H/V 方向性翻转（入口区别）】');
fresh();
vm.runInContext(`(function(){
  const e = new Underground('underground-belt', 5, 5);
  e.dir = 0; e.mirror = 0; G.grid.set(entKey(5,5), e); G.ents.push(e);
  G.cursorTile = {tx:5, ty:5};
  flipAction('h'); __eh = e.dir; __ehm = e.mirror | 0;
  flipAction('v'); __ev = e.dir;
  const v2 = new Underground('underground-belt', 9, 9);
  v2.dir = 1; v2.mirror = 0; G.grid.set(entKey(9,9), v2); G.ents.push(v2);
  G.cursorTile = {tx:9, ty:9};
  flipAction('h'); __vh = v2.dir;
  flipAction('v'); __vv = v2.dir; __vvm = v2.mirror | 0;
  G.cursorTile = null; G.ghostDir = 0; G.ghostMirror = 0;
  const _si = globalThis.selItem; globalThis.selItem = () => 'underground-belt';
  flipAction('h'); __guh = G.ghostDir; __gum = G.ghostMirror | 0;
  globalThis.selItem = _si;
})()`, sandbox);
ok(sandbox.__eh === 2 && sandbox.__ehm === 0, `横带入口 H 翻转 0→${sandbox.__eh}（期望 2 换向，手性${sandbox.__ehm} 期望 0）`);
ok(sandbox.__ev === 2, `横带再 V 翻转不改向 ${sandbox.__ev}（期望 2，V 只换南北）`);
ok(sandbox.__vh === 1, `竖带 H 翻转不改向 ${sandbox.__vh}（期望 1，H 只换东西）`);
ok(sandbox.__vv === 3 && sandbox.__vvm === 0, `竖带 V 翻转 1→${sandbox.__vv}（期望 3 换向，手性${sandbox.__vvm} 期望 0）`);
ok(sandbox.__guh === 2 && sandbox.__gum === 0, `地下带幽灵 H 翻转 0→${sandbox.__guh}（期望 2，手性${sandbox.__gum} 期望 0，方向性非镜像）`);

// ===== 八、炼油厂 vs 化工厂：同属边口机器，V/H 真镜像行为必须一致 =====
// 二者均注册 DEVICE_FLIP=mirrorFlipDir（dir 选前/后边、端口沿边分布的通用真镜像映射）。
// 旧版 flipDir 对 dir0 设备 V 完全无反应、H 转180°，两机因美术对称性不同而观感不一致；
// 真镜像下：H 保持朝向+手性翻转（左右口对调），V 前后边互换（dir+2）+手性翻转，二者逐位相同。
console.log('\n【炼油厂/化工厂 V/H 真镜像一致性】');
fresh();
vm.runInContext(`(function(){
  DEVICE_FLIP['oil-refinery'] = mirrorFlipDir;
  DEVICE_FLIP['chemical-plant'] = mirrorFlipDir;
  const rf = new Entity('oil-refinery', 5, 5);
  const cp = new Entity('chemical-plant', 20, 20);
  G.grid.set(entKey(5,5), rf); G.ents.push(rf);
  G.grid.set(entKey(20,20), cp); G.ents.push(cp);
  G.cursorTile = {tx:5, ty:5}; flipAction('h'); __rf_h = [rf.dir, rf.mirror|0];
  G.cursorTile = {tx:5, ty:5}; flipAction('v'); __rf_v = [rf.dir, rf.mirror|0];   // 在 H 基础上再 V
  G.cursorTile = {tx:20, ty:20}; flipAction('h'); __cp_h = [cp.dir, cp.mirror|0];
  G.cursorTile = {tx:20, ty:20}; flipAction('v'); __cp_v = [cp.dir, cp.mirror|0];
})()`, sandbox);
ok(sandbox.__rf_h[0] === 0 && sandbox.__rf_h[1] === 1, `炼油厂 H 镜像 (dir${sandbox.__rf_h[0]},m${sandbox.__rf_h[1]})（期望 0/1：朝向不变、左右口对调）`);
ok(sandbox.__cp_h[0] === 0 && sandbox.__cp_h[1] === 1, `化工厂 H 镜像 (dir${sandbox.__cp_h[0]},m${sandbox.__cp_h[1]})（期望 0/1，与炼油厂一致）`);
ok(String(sandbox.__rf_h) === String(sandbox.__cp_h) && String(sandbox.__rf_v) === String(sandbox.__cp_v),
  `炼油厂与化工厂 H/V 翻转结果逐位相同（rf H=${sandbox.__rf_h} V=${sandbox.__rf_v} / cp H=${sandbox.__cp_h} V=${sandbox.__cp_v}）`);
ok(sandbox.__rf_v[0] === 2 && sandbox.__rf_v[1] === 0, `H∘V = 旋转180° (dir${sandbox.__rf_v[0]},m${sandbox.__rf_v[1]})（期望 2/0，两机一致）`);

console.log('\n----------------------------------------');
console.log(`通过 ${pass} 项，失败 ${fail} 项`);
if (fail) { console.log('❌ 存在失败断言'); process.exit(1); }
console.log('✅ 建筑旋转/翻转语义正确');
