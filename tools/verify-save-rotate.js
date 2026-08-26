#!/usr/bin/env node
'use strict';
/**
 * 存档读档旋转状态恢复验证脚本
 * ------------------------------------------------
 * 验证《异星工厂》建筑在读档后，旋转/翻转状态（占地宽高与方向）能正确恢复。
 *
 * 背景：rotSwap 类设备（热交换器、汽轮机、锅炉、蒸汽机、抽水机、分流器）
 *       旋转后占地宽高需随 dir 交换。此前 Entity.restore 只恢复 dir 而不调用
 *       applyDir()，导致读档后旋转状态复原/错乱。本脚本回归验证该修复。
 *
 * 运行：node tools/verify-save-rotate.js （退出码 0 = 通过）
 * 零依赖：加载真实 core/entity.js + data-buildings.js，用真实 Entity.restore 断言。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'js');
const load = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');
const TILE = 32;

const G = { grid: new Map(), ents: [], buckets: new Map(), world: {}, lootDrops: [] };
const sandbox = {
  console, TILE, G,
  buildingMaxHp: () => 100,
  regPowerEnt: () => {}, unregPowerEnt: () => {},
  globalThis: null, // 由下方回填
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const prefix = 'const G=globalThis.G; const TILE=globalThis.TILE;';

// 加载真实数据定义与实体基类
vm.runInContext(
  prefix + '\n' + load('core/entity.js') + '\n'
  + load('data-buildings.js'),
  sandbox, { filename: 'entity.js' }
);

let pass = 0, fail = 0;
function ok(c, n) { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n); } }

// rotSwap 设备的占地期望：dir 为奇数(旋转90°)时宽高互换
function expectWH(def, dir) {
  return (dir % 2 === 1) ? { w: def.h, h: def.w } : { w: def.w, h: def.h };
}

console.log('\n【Entity.restore 在读档后按方向恢复占地宽高】');

// 真实 Entity.restore 的调用路径：Entity.restore 内会调用 e.applyDir()
// 用 rotSwap 子类复刻 nuclear/boiler/steam-engine 设备的 applyDir 逻辑。
vm.runInContext(`
(function(){
  // 复刻 rotSwap 设备的 applyDir：dir 为奇数时宽高互换
  class RotSwapEnt extends Entity {
    applyDir() { if (this.dir % 2 === 1) { this.w = this.def.h; this.h = this.def.w; } }
  }
  globalThis.RotSwapEnt = RotSwapEnt;
  // 复刻非 rotSwap（方形）设备：仅用基类 applyDir
  class SquareEnt extends Entity {}
  globalThis.SquareEnt = SquareEnt;
})()`, sandbox);

// 测试的 rotSwap 设备（对应 data-buildings.js 定义）
const rotDevices = ['heat-exchanger', 'steam-turbine', 'boiler', 'steam-engine', 'offshore-pump', 'splitter'];
for (const t of rotDevices) {
  vm.runInContext(`(function(){
    const def = BUILD_DEFS['${t}'];
    __def = { w: def.w, h: def.h, rotSwap: !!def.rotSwap };
    __rows = [];
    for (let dir = 0; dir < 4; dir++) {
      // 模拟 serialize 保存的 dir，经 restore 恢复
      const e = RotSwapEnt.restore({ type: '${t}', x: 5, y: 5, dir: dir });
      __rows.push({ dir: e.dir, w: e.w, h: e.h });
    }
  })()`, sandbox);

  const def = sandbox.__def;
  ok(def.rotSwap, `${t} 已标记 rotSwap`);
  for (const row of sandbox.__rows) {
    const exp = expectWH(def, row.dir);
    ok(row.w === exp.w && row.h === exp.h,
      `${t} dir=${row.dir} restore后占地 w=${row.w} h=${row.h}（期望 w=${exp.w} h=${exp.h}）`);
  }
}

// 方形设备：dir 旋转不改变占地，restore 后保持 def 宽高
const squareDevices = ['nuclear-reactor', 'centrifuge'];
for (const t of squareDevices) {
  vm.runInContext(`(function(){
    const def = BUILD_DEFS['${t}'];
    __def = { w: def.w, h: def.h };
    __rows = [];
    for (let dir = 0; dir < 4; dir++) {
      const e = SquareEnt.restore({ type: '${t}', x: 5, y: 5, dir: dir });
      __rows.push({ dir: e.dir, w: e.w, h: e.h });
    }
  })()`, sandbox);
  const def = sandbox.__def;
  for (const row of sandbox.__rows) {
    ok(row.w === def.w && row.h === def.h,
      `${t} dir=${row.dir} restore后占地不变 w=${row.w} h=${row.h}（期望 w=${def.w} h=${def.h}）`);
  }
}

// 幂等性：重复调用 applyDir 结果一致（分流器/抽水机 restore 内部额外调用 applyDir 无副作用）
vm.runInContext(`(function(){
  const def = BUILD_DEFS['splitter'];
  const e = RotSwapEnt.restore({ type: 'splitter', x: 5, y: 5, dir: 1 });
  e.applyDir();  // 模拟抽水机/分流器 restore 中额外的 applyDir 调用
  __dupW = e.w; __dupH = e.h; __dupD = e.dir;
})()`, sandbox);
ok(sandbox.__dupD === 1 && sandbox.__dupW === 2 && sandbox.__dupH === 1,
  `restore 后重复调用 applyDir 幂等（分流器 dir=1 w=2 h=1）`);

console.log('\n----------------------------------------');
console.log(`通过 ${pass} 项，失败 ${fail} 项`);
if (fail) { console.log('❌ 存在失败断言'); process.exit(1); }
console.log('✅ 存档读档旋转状态恢复正确');
