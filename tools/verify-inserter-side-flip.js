#!/usr/bin/env node
'use strict';
/**
 * 机械臂翻转切换投放/取货侧（sideFlip）验证脚本
 * ----------------------------------------------------------------
 * 验证《异星工厂》机械臂翻转换边语义：机械臂翻转（R 旋转 / V/H 镜像）后，
 * 它在传送带上的夹取边（lane）应换一边。
 *   - 默认：取近侧 lane / 放远侧 lane
 *   - 翻转后：取远侧 lane / 放近侧 lane
 * 覆盖：
 *   1) 默认投放/取货侧；
 *   2) 翻转后换边；
 *   3) 再次翻转换回；
 *   4) 序列化/还原保留 sideFlip。
 *
 * 运行：node tools/verify-inserter-side-flip.js （退出码 0 = 通过）
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const SRC = path.join(process.cwd(), 'js');
const load = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');
const TILE = 32, BELT_SPEED = 1.875, BELT_SPACING = 0.125;
const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
const G = { grid: new Map(), ents: [], buckets: new Map(), techProg: {}, time: 0, dbg: {} };
const entKey = (x, y) => ((x + 32768) << 16) | (y + 32768);
const entAt = (x, y) => G.grid.get(entKey(x, y));
const sandbox = {
  console, TILE, BELT_SPEED, BELT_SPACING, DX, DY, G, entAt, entKey,
  BUILD_DEFS: { 'transport-belt': { w: 1, h: 1, solid: true }, 'inserter': { w: 1, h: 1, solid: true } },
  ITEMS: { 'iron-plate': { name: '铁板' }, 'copper-plate': { name: '铜板' } },
  Underground: class Underground {}, Splitter: class Splitter {},
  buildingMaxHp: () => 100, beltSpeed: () => BELT_SPEED, groundItemForBelt: () => null,
  circuitSignalNear: () => ({}), circuitCondOk: () => true, playSfx: () => {},
  dirFromVec: () => 0,
  ENT_CLASSES: {}, DEVICE_RENDER: {}, DEVICE_STATUS: {}, DEVICE_PANEL: {}, DEVICE_DIR_ROTATE: {},
  window: {}, setTimeout, clearTimeout, setInterval, clearInterval,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);
const prefix = 'const G=globalThis.G; const ITEMS=globalThis.ITEMS; const BUILD_DEFS=globalThis.BUILD_DEFS;';
vm.runInContext(prefix + load('core/entity.js') + '\n' + load('devices/belt.js') + '\n' + load('devices/inserter.js'), sandbox, { filename: 'inserter.js' });
const Belt = vm.runInContext('Belt', sandbox);
const Inserter = vm.runInContext('Inserter', sandbox);

let pass=0, fail=0;
function ok(c,n){ if(c){pass++;console.log('  ✅ '+n);} else {fail++;console.log('  ❌ '+n);} }

function setup(){
  G.grid=new Map(); G.ents=[];
  const add=(e)=>{G.ents.push(e);G.grid.set(entKey(e.x,e.y),e);};
  // 竖向传送带 dir=1(向南) 在 (5,5)；机械臂在传送带西边 (4,5)，dir=0(朝东放物到传送带)
  const belt=new Belt('transport-belt',5,5); belt.dir=1; add(belt);
  const ins=new Inserter('inserter',4,5); ins.dir=0; add(ins);
  return {belt,ins};
}

// 传送带 dir=1, perp=[DY[1],-DX[1]]=[1,0]（东）。lane1=东侧，lane0=西侧。
// 机械臂在西边(4,5)，近侧=西侧lane0，远侧=东侧lane1。
{
  const {belt,ins}=setup();
  ok(ins.dropBeltLane(belt)===1, `默认放远侧 lane=${ins.dropBeltLane(belt)}（期望1=东侧远离机械臂）`);
  ok(ins.pickBeltLane(belt)===0, `默认取近侧 lane=${ins.pickBeltLane(belt)}（期望0=西侧靠近机械臂）`);
}
// 翻转（sideFlip=true）后换边
{
  const {belt,ins}=setup();
  ins.onRotate(); // 翻转切换投放侧
  ok(ins.sideFlip===true, '翻转后 sideFlip=true');
  ok(ins.dropBeltLane(belt)===0, `翻转后放近侧 lane=${ins.dropBeltLane(belt)}（期望0，与默认1换边）`);
  ok(ins.pickBeltLane(belt)===1, `翻转后取远侧 lane=${ins.pickBeltLane(belt)}（期望1，与默认0换边）`);
}
// 再翻转一次换回
{
  const {belt,ins}=setup();
  ins.onRotate(); ins.onRotate();
  ok(ins.dropBeltLane(belt)===1 && ins.pickBeltLane(belt)===0, '再翻转后换回默认侧');
}
// 序列化/还原保留 sideFlip
{
  const {belt,ins}=setup();
  ins.onRotate();
  const s=ins.serialize();
  ok(s.sideFlip===true, '序列化保留 sideFlip');
  const r=Inserter.restore(s);
  ok(r.sideFlip===true && r.dropBeltLane(belt)===0, '还原后投放侧仍为翻转侧');
}
console.log('\n----------------------------------------');
console.log(`通过 ${pass} 项，失败 ${fail} 项`);
if(fail){console.log('❌ 存在失败断言');process.exit(1);}
console.log('✅ 机械臂翻转切换投放侧语义正确');
