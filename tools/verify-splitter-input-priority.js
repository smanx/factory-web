#!/usr/bin/env node
'use strict';
/**
 * 分流器输入优先级 / 轮流输入 验证脚本
 * ------------------------------------------------
 * 验证《异星工厂》分流器输入调度：
 *  - 默认（inPref=-1）：两个输入口轮流放行（公平交替，单口空置不饿死另一口）。
 *  - inPref=0/1（优先某口）：优先口有货时优先接纳，非优先口仅作溢出通道。
 * 回归目标：此前 inPref 只对无几何信息的投放（机械臂/地面）生效，带输入始终
 * 跟随来源入口几何位置，导致“切换输入优先之后没有任何反应”。本脚本验证修复后
 * 对带输入同样生效，切换 inPref 能产生可见的流量倾斜。
 *
 * 运行：node tools/verify-splitter-input-priority.js （退出码 0 = 通过）
 * 零依赖：加载 core/entity.js / devices/belt.js / devices/splitter.js 做端到端模拟。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'js');
const load = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');

const TILE = 32, BELT_SPEED = 1.875, BELT_SPACING = 0.125, FAST_BELT_MULT = 1;
const DX = [1, 0, -1, 0], DY = [0, 1, 0, -1];
const G = { grid: new Map(), ents: [], buckets: new Map(), techDone: {}, dbg: {}, time: 0 };
const entKey = (x, y) => ((x + 32768) << 16) | (y + 32768);
const entAt = (x, y) => G.grid.get(entKey(x, y));

const sandbox = {
  console, TILE, BELT_SPEED, BELT_SPACING, FAST_BELT_MULT, DX, DY, G, entAt, entKey,
  BUILD_DEFS: {
    'transport-belt': { w: 1, h: 1, solid: true },
    'splitter': { w: 1, h: 2, solid: false, rotSwap: true },
    'priority-splitter': { w: 1, h: 2, solid: false, rotSwap: true },
  },
  ITEMS: { 'iron-plate': { name: '铁板' }, 'copper-plate': { name: '铜板' } },
  Underground: class Underground {}, Splitter: class Splitter {},
  buildingMaxHp: () => 100,
  beltSpeed: () => BELT_SPEED,
  groundItemForBelt: () => null,
  circuitSignalNear: () => ({}),
  circuitCondOk: () => true,
  ENT_CLASSES: {}, DEVICE_RENDER: {}, DEVICE_STATUS: {}, DEVICE_PANEL: {}, DEVICE_DIR_ROTATE: {},
  window: {}, setTimeout, clearTimeout, setInterval, clearInterval,
};
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

const prefix = 'const G=globalThis.G; const ITEMS=globalThis.ITEMS; const BUILD_DEFS=globalThis.BUILD_DEFS;';
const code = prefix + load('core/entity.js') + '\n' + load('devices/belt.js') + '\n' + load('devices/splitter.js');
vm.runInContext(code, sandbox, { filename: 'splitter.js' });

const Splitter = vm.runInContext('Splitter', sandbox);
const Belt = vm.runInContext('Belt', sandbox);

function reset() { G.grid = new Map(); G.ents = []; G.buckets = new Map(); }
function add(e) { G.ents.push(e); for (let dy = 0; dy < e.h; dy++) for (let dx = 0; dx < e.w; dx++) G.grid.set(entKey(e.x + dx, e.y + dy), e); return e; }

// 构造一个朝右(0)的分流器：入口在 x=3 两行(y=2/y=3)，出口在 x=5 两行
// 布局：x: 2(top/bottom 输入带) 3(分流器) 4(top/bottom 输出带)
function setup() {
  reset();
  const sp = add(new Splitter('splitter', 3, 2)); sp.dir = 0; sp.applyDir();
  const inTop = add(new Belt('transport-belt', 2, 2)); inTop.dir = 0;
  const inBot = add(new Belt('transport-belt', 2, 3)); inBot.dir = 0;
  const outTop = add(new Belt('transport-belt', 4, 2)); outTop.dir = 0;
  const outBot = add(new Belt('transport-belt', 4, 3)); outBot.dir = 0;
  return { sp, inTop, inBot, outTop, outBot };
}

let pass = 0, fail = 0;
function check(name, cond, detail) {
  console.log((cond ? '  ✅ ' : '  ❌ ') + name + (detail ? '：' + detail : ''));
  if (cond) pass++; else fail++;
  return cond;
}

// 测试：默认轮流输入 - 两输入带都载货，轮流放行两入口
function testAlternate() {
  const { sp, inTop, inBot, outTop, outBot } = setup();
  sp.inPref = -1;
  sp.inToggle = 0;
  // 让两条入口带持续有货（前端物品待进入），模拟满载
  inTop.items = [{ item: 'iron-plate', pos: 0.99, lane: 0, side: -1 }];
  inBot.items = [{ item: 'copper-plate', pos: 0.99, lane: 0, side: -1 }];
  // 轮流输入：每轮清除已接纳物品（模拟物品前移腾空入口），再交替接纳两入口
  const inPosSeq = [];
  for (let i = 0; i < 4; i++) {
    // 当前当班口应被接纳
    if (sp.acceptItem('iron-plate', 0, 2, 2, 0)) inPosSeq.push('top');
    if (sp.acceptItem('copper-plate', 0, 2, 3, 0)) inPosSeq.push('bot');
    sp.items = []; // 模拟物品已前移腾空，避免入口积压干扰调度判定
  }
  const topCount = inPosSeq.filter(x => x === 'top').length;
  const botCount = inPosSeq.filter(x => x === 'bot').length;
  const diff = Math.abs(topCount - botCount);
  let ok = diff <= 1 && topCount > 0 && botCount > 0;
  check('默认轮流输入：两入口交替放行，无单口饿死', ok,
    'top=' + topCount + ' bot=' + botCount + '（序列=' + inPosSeq.join(',') + '）');
  return ok;
}

// 测试：优先上方输入 - inPref=0 时，上方口有货则下方口被暂缓
function testPriorityTop() {
  const { sp, inTop, inBot, outTop, outBot } = setup();
  sp.inPref = 0;
  // 上口有货（待进入），下口也有货
  inTop.items = [{ item: 'iron-plate', pos: 0.99, lane: 0, side: -1 }];
  inBot.items = [{ item: 'copper-plate', pos: 0.99, lane: 0, side: -1 }];
  // 先让上口送一件（被接纳），再让下口尝试送（应被上口积压挡住，除非上口通畅）
  sp.acceptItem('iron-plate', 0, 2, 2, 0); // 上口进一件
  sp.items = []; // 腾空（模拟物品前移）
  sp.acceptItem('iron-plate', 0, 2, 2, 0); // 上口再进一件（模拟持续）
  const botAccepted = sp.acceptItem('copper-plate', 0, 2, 3, 0); // 下口尝试
  // 上口持续有货时，下口应被暂缓
  let ok = botAccepted === false;
  check('优先上方(inPref=0)：上方持续有货时，下方口暂缓', ok,
    '下口是否被暂缓=' + (botAccepted === false));
  // 再验证：下口无上口积压后放行
  sp.items = []; inTop.items = []; // 清空并让上口无货，模拟上口通畅
  const botAccepted2 = sp.acceptItem('copper-plate', 0, 2, 3, 0);
  ok = ok && botAccepted2 === true;
  check('优先上方：上方通畅后，下方口正常放行（溢出通道）', botAccepted2 === true,
    '下口是否放行=' + (botAccepted2 === true));
  return ok;
}

// 测试：优先下方输入 - inPref=1 时，下方口优先
function testPriorityBot() {
  const { sp, inTop, inBot } = setup();
  sp.inPref = 1;
  inTop.items = [{ item: 'iron-plate', pos: 0.99, lane: 0, side: -1 }];
  inBot.items = [{ item: 'copper-plate', pos: 0.99, lane: 0, side: -1 }];
  sp.acceptItem('copper-plate', 0, 2, 3, 0); // 下口进一件
  sp.acceptItem('copper-plate', 0, 2, 3, 0); // 下口再进一件
  const topAccepted = sp.acceptItem('iron-plate', 0, 2, 2, 0); // 上口尝试
  let ok = topAccepted === false;
  check('优先下方(inPref=1)：下方持续有货时，上方口暂缓', ok,
    '上口是否被暂缓=' + (topAccepted === false));
  return ok;
}

// 测试：单口无货时，另一口不因轮流模式被饿死
function testSingleEntrance() {
  const { sp, inTop, inBot } = setup();
  sp.inPref = -1;
  sp.inToggle = 0;
  inTop.items = [{ item: 'iron-plate', pos: 0.99, lane: 0, side: -1 }];
  inBot.items = []; // 下口无货
  let accepted = 0;
  for (let i = 0; i < 6; i++) {
    // 只有上口有货：每次都应放行，不应因轮到下口而饿死
    if (sp.acceptItem('iron-plate', 0, 2, 2, 0)) accepted++;
    sp.items = []; // 腾空（模拟物品前移）
  }
  let ok = accepted === 6;
  check('轮流模式单口满载：另一口无货时不影响该口吞吐', ok,
    '上口放行=' + accepted + '（期望 6）');
  return ok;
}

console.log('\n【分流器输入优先级 / 轮流输入】');
testAlternate();
testPriorityTop();
testPriorityBot();
testSingleEntrance();
console.log('\n----------------------------------------');
console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail > 0 ? 1 : 0);
