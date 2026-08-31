#!/usr/bin/env node
'use strict';
/**
 * 电线杆电网模型验证脚本
 * ------------------------------------------------
 * 验证 js/core/power.js 的电网逻辑与《异星工厂》电线杆供电模型一致：
 *   - 电线杆参数取自 GAME_DATA.pole（官方 maximum_wire_distance / supply_area_distance）；
 *   - 设备须被电线杆 supply 范围覆盖才接入电网，否则缺电停摆；
 *   - 杆间按 wire 距离自动连线；
 *   - 多个电网相互独立（各自供需平衡）。
 * 运行：node tools/verify-power-grid.js
 * 退出码：0 = 全部通过；1 = 存在差异。
 * 零依赖：在 vm 沙箱中加载 power.js 核心函数，构造假实体做功能校验。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const powerSrc = fs.readFileSync(path.join(ROOT, 'js/core/power.js'), 'utf8');
const genSrc = fs.readFileSync(path.join(ROOT, 'js/data/data.generated.js'), 'utf8');

let passCount = 0, failCount = 0;
function check(name, cond) {
  if (cond) { passCount++; console.log('  ✅ ' + name); }
  else { failCount++; console.log('  ❌ ' + name); }
}

// ---- 1. GAME_DATA.pole 官方数值对齐（从生成的 data.generated.js 读取）----
console.log('\n【电线杆参数对齐官方 factorio-data】');
const poleJson = genSrc.slice(genSrc.indexOf('"pole": {'));
function poleVal(id, key) {
  const re = new RegExp('"' + id + '":\\s*\\{[^}]*"' + key + '":\\s*([0-9.]+)');
  const m = poleJson.match(re); return m ? parseFloat(m[1]) : undefined;
}
check('小型电线杆 wire=7.5', poleVal('small-electric-pole', 'wire') === 7.5);
check('小型电线杆 supply=2.5', poleVal('small-electric-pole', 'supply') === 2.5);
check('中型电线杆 wire=9', poleVal('medium-electric-pole', 'wire') === 9);
check('中型电线杆 supply=3.5', poleVal('medium-electric-pole', 'supply') === 3.5);
check('远程输电塔 wire=32', poleVal('big-electric-pole', 'wire') === 32);
check('远程输电塔 supply=2', poleVal('big-electric-pole', 'supply') === 2);
check('广域配电站 wire=18', poleVal('substation', 'wire') === 18);
check('广域配电站 supply=9', poleVal('substation', 'supply') === 9);

// ---- 加载 power.js 到沙箱 ----
const GAME_DATA = { pole: {
  'small-electric-pole': { wire: 7.5, supply: 2.5 },
  'medium-electric-pole': { wire: 9, supply: 3.5 },
  'big-electric-pole': { wire: 32, supply: 2 },
  'substation': { wire: 18, supply: 9 },
} };
const G = { power: { prod: 0, demand: 0, sat: 1 }, grids: [], ents: [] };
const sandbox = { console, GAME_DATA, G, dimSpan: (t) => t, entKey: (x, y) => x + ',' + y, TILE: 32 };
vm.createContext(sandbox);
vm.runInContext(powerSrc, sandbox);
const { resetPowerReg, regPowerEnt, updatePower, powerSatOf, powerFactor, rebuildPowerGrids, isGridPowerDevice, powerWarnState, poleSupplyRect } = sandbox;

// 实体工厂
let uid = 0;
function pole(type, x, y) { const w = type === 'big-electric-pole' || type === 'substation' ? 2 : 1; return { _id: ++uid, type, x, y, w, h: w }; }
function consumer(x, y, demand) { return { _id: ++uid, type: 'asm', x, y, w: 1, h: 1, powerDemand() { return demand; } }; }
function producer(x, y, out) { return { _id: ++uid, type: 'steam', x, y, w: 2, h: 2, powerOut: out }; }
function addAll(list) { resetPowerReg(); for (const e of list) { e._dead = false; G.ents.push(e); regPowerEnt(e); } }

// ---- 2. 未被电线杆覆盖 → 缺电停摆 ----
console.log('\n【设备须被电线杆供电范围覆盖】');
{
  const c = consumer(100, 100, 90);   // 远离任何杆
  addAll([c]);
  updatePower();
  check('未覆盖设备 _grid=null', c._grid === null);
  check('未覆盖设备饱和度=0', powerSatOf(c) === 0);
  check('未覆盖设备停摆(powerFactor=0)', powerFactor(c) === 0);
}
// ---- 3. 被覆盖 → 接入电网并按供需平衡 ----
console.log('\n【覆盖范围内设备接入电网并独立平衡】');
{
  const p = pole('small-electric-pole', 10, 10);   // supply 2.5 → 覆盖中心距 <=2.5
  const gen = producer(11, 10, 200);               // 蒸汽机在杆覆盖内，发电 200
  const c = consumer(9, 10, 100);                  // 耗电设备在杆覆盖内，耗电 100
  addAll([p, gen, c]);
  updatePower();
  check('发电设备接入电网', gen._grid === p._grid && !!gen._grid);
  check('耗电设备接入同一电网', c._grid === p._grid);
  check('电网 capacity=200（产能）', Math.abs(p._grid.capacity - 200) < 1e-6);
  check('电网 demand=100', Math.abs(p._grid.demand - 100) < 1e-6);
  check('发电机随负载节流：实际出力 prod=min(产能,需求)=100', Math.abs(p._grid.prod - 100) < 1e-6);
  check('throttle=0.5（需求/产能）', Math.abs(p._grid.throttle - 0.5) < 1e-6);
  check('电网供电充足 sat=1', p._grid.sat === 1);
  check('设备满速 powerFactor=1', powerFactor(c) === 1);
}
// ---- 4. 供电不足 → 低效运转（20% 下限）----
console.log('\n【供电不足低效运转】');
{
  const p = pole('small-electric-pole', 30, 30);
  const gen = producer(31, 30, 50);                // 发 50
  const c = consumer(29, 30, 100);                 // 耗 100 → sat=0.5
  addAll([p, gen, c]);
  updatePower();
  check('电网 sat=0.5', Math.abs(p._grid.sat - 0.5) < 1e-6);
  check('低效运转 powerFactor=max(0.5,0.2)=0.5', Math.abs(powerFactor(c) - 0.5) < 1e-6);
}
// ---- 5. 多个电网相互独立 ----
console.log('\n【多电网相互独立】');
{
  // 电网 A：充足；电网 B：缺电。两簇杆相距很远（>连线距离）故不互联。
  const pA = pole('small-electric-pole', 0, 0);
  const genA = producer(1, 0, 500); const cA = consumer(-1, 0, 100);
  const pB = pole('small-electric-pole', 200, 200);
  const genB = producer(201, 200, 50); const cB = consumer(199, 200, 100);
  addAll([pA, genA, cA, pB, genB, cB]);
  updatePower();
  check('两簇杆形成 2 张独立电网', G.grids.length === 2);
  check('电网 A 供电充足 sat=1', pA._grid.sat === 1);
  check('电网 B 缺电 sat=0.5', Math.abs(pB._grid.sat - 0.5) < 1e-6);
  check('A/B 电网对象不同', pA._grid !== pB._grid);
  check('A 设备满速', powerFactor(cA) === 1);
  check('B 设备低效', Math.abs(powerFactor(cB) - 0.5) < 1e-6);
}
// ---- 6. 杆间连线：wire 距离内互联为同一电网，超出则分离 ----
console.log('\n【杆间自动连线组网】');
{
  // 两个小型杆相距 7（<=7.5）→ 互联；设备分别覆盖两端 → 同一电网
  const p1 = pole('small-electric-pole', 0, 0);
  const p2 = pole('small-electric-pole', 7, 0);
  addAll([p1, p2]);
  updatePower();
  check('相距 7 格的两小型杆连为同一电网', p1._grid === p2._grid && G.grids.length === 1);
  // 相距 9（>7.5）→ 不互联 → 两张电网
  const p3 = pole('small-electric-pole', 100, 0);
  const p4 = pole('small-electric-pole', 109, 0);
  addAll([p3, p4]);
  updatePower();
  check('相距 9 格的两小型杆分为两张电网', p3._grid !== p4._grid && G.grids.length === 2);
}
// ---- 7. 远程输电塔长距离组网（wire=32）----
console.log('\n【远程输电塔长距离输电】');
{
  const b1 = pole('big-electric-pole', 0, 0);
  const b2 = pole('big-electric-pole', 30, 0);   // 相距 30 <=32 → 互联
  addAll([b1, b2]);
  updatePower();
  check('相距 30 格的两输电塔连为同一电网', b1._grid === b2._grid);
  // 但 supply=2 覆盖很小：设备距杆中心 >2.5 即不接入
  const far = consumer(10, 0, 50);
  addAll([b1, far]);
  updatePower();
  check('输电塔 supply 小，远处设备不接入', far._grid === null);
}
// ---- 8. 设备同时覆盖两簇不互联的杆 → 经设备合并为同一电网 ----
console.log('\n【共享设备合并电网】');
{
  // 两变电站中心相距 19 > wire(18) 故不互联；但 supply=9 的覆盖区在中间交叠，
  // 落在交叠区的设备同时被两杆覆盖 → 并查集经该设备把两杆并入同一电网。
  const sA = pole('substation', 0, 0);    // 中心 (1,1)
  const sB = pole('substation', 19, 0);   // 中心 (20,1)，与 sA 相距 19 > 18 不互联
  const dev = consumer(10, 0, 50);        // 中心 (10.5,0.5)：距 sA=9.5<=9.5 ✓，距 sB=9.5<=9.5 ✓
  addAll([sA, sB, dev]);
  updatePower();
  check('两不互联杆经共享设备合并为同一电网', sA._grid === sB._grid && G.grids.length === 1);
  check('该设备接入合并后的电网', dev._grid === sA._grid);
}

// ---- 9. 缺电警告图标 / 覆盖判定辅助（发电+耗电共用）----
console.log('\n【缺电警告状态与覆盖判定】');
{
  const c = consumer(50, 50, 80);
  const gen = producer(60, 60, 100);
  const p = pole('small-electric-pole', 0, 0);
  const veh = { type: 'car', x: 0, y: 0, w: 5, h: 5, noGridPower: true, powerDemand() { return 0; } };
  check('耗电设备是电网设备', isGridPowerDevice(c) === true);
  check('发电设备是电网设备', isGridPowerDevice(gen) === true);
  check('电线杆本身不显示缺电警告', isGridPowerDevice(p) === false);
  check('载具不显示缺电警告', isGridPowerDevice(veh) === false);
  // 未接入电网 → plug
  addAll([c]);
  updatePower();
  check('未接入电网耗电设备 = plug', powerWarnState(c) === 'plug');
  // 接入电网但电网无电（有耗电无发电 → sat=0）→ bolt
  const p2 = pole('small-electric-pole', 100, 100);
  const c2 = consumer(101, 100, 100);   // 覆盖内，耗电，无发电 → sat=0
  addAll([p2, c2]);
  updatePower();
  check('接入电网但电网无电 = bolt', powerWarnState(c2) === 'bolt');
  // 接入电网且供电充足 → null
  const p3 = pole('small-electric-pole', 200, 200);
  const g3 = producer(201, 200, 200); const c3 = consumer(199, 200, 100);
  addAll([p3, g3, c3]);
  updatePower();
  check('供电充足设备无警告 = null', powerWarnState(c3) === null);
  // 覆盖矩形：小型杆 (0,0) 1×1，supply 2.5 → 中心(0.5,0.5)，范围 [-2,-2]..[3,3]
  const rc = poleSupplyRect('small-electric-pole', 0, 0, 1, 1);
  check('poleSupplyRect 小型杆 x0=-2', Math.abs(rc.x0 + 2) < 1e-9);
  check('poleSupplyRect 小型杆 x1=3', Math.abs(rc.x1 - 3) < 1e-9);
}

console.log('\n----------------------------------------');
console.log('通过 ' + passCount + ' 项，失败 ' + failCount + ' 项');
process.exit(failCount > 0 ? 1 : 0);
