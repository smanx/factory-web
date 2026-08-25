#!/usr/bin/env node
'use strict';
/**
 * 分流器 4 线物流模型验证脚本（对齐《异星工厂》Splitter）
 * -----------------------------------------------------------------
 * 官方机制依据（Factorio Wiki / Belt transport system）：
 *   - Belts of all tiers have 2 lanes（每条传送带 2 条独立车道）
 *   - Splitters preserve the lanes：穿过分流器，右车道物品不会移到左车道，反之亦然
 *   - Splitters have two input belts and two output belts（两入两出）
 *   - 单输入时均匀分配到两输出；一输出堵死则全部走另一输出
 *   - 输入优先级：优先口有货时优先消耗，仅当优先口出现空隙才消费另一口
 *   - 输出优先级：重定向所有物品到指定输出口，仅当指定口满才用另一口
 *
 * 验证点：
 *   1. 输入车道保持（laneHint 贯通：A 进 A 出）
 *   2. 默认轮流输入（两输入口交替放行，单口空置不饿死）
 *   3. 输入优先级（inPref=0/1 对带双线输入真正生效）
 *   4. 默认输出轮流（两输出口交替输出）
 *   5. 输出优先级（outPref 重定向）
 *   6. 输出 lane 保持（outLane = lane，穿过分流器不换道）
 *   7. 渲染几何：每入口/出口双线对称（4 线模型）
 *
 * 运行：node tools/verify-splitter-input-priority.js （退出码 0 = 通过）
 * 零依赖：加载 entity.js / belt.js / splitter.js 做端到端模拟。
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

// ---- 测试 1：输入车道保持（laneHint 贯通）----
// 从 top 入口直通（sx=2,sy=2 → port 0）传入 laneHint=1，物品应保留 lane=1。
function testLanePreserveInput() {
  const { sp } = setup();
  sp.inPref = -1;
  const ok = sp.acceptItem('iron-plate', 0, 2, 2, 1); // laneHint=1 → lane 1
  if (!ok) { check('输入车道保持：laneHint=1 被接受', false, 'acceptItem 拒绝'); return false; }
  const o = sp.items[0];
  let r = check('输入车道保持：laneHint=1 进入 lane 1', o.lane === 1, 'lane=' + o.lane);
  r = check('输入端口跟随来源（top→port0）', o.inPort === 0, 'inPort=' + o.inPort) && r;
  // laneHint=0 → lane 0
  sp.items = [];
  sp.acceptItem('copper-plate', 0, 2, 2, 0);
  r = check('输入车道保持：laneHint=0 进入 lane 0', sp.items[0].lane === 0, 'lane=' + sp.items[0].lane) && r;
  return r;
}

// ---- 测试 2：默认轮流输入（两输入口交替放行）----
function testAlternate() {
  const { sp } = setup();
  sp.inPref = -1;
  sp.inToggle = 0;
  const inPosSeq = [];
  for (let i = 0; i < 6; i++) {
    if (sp.acceptItem('iron-plate', 0, 2, 2, 0)) inPosSeq.push('top'); // top→port0
    if (sp.acceptItem('copper-plate', 0, 2, 3, 0)) inPosSeq.push('bot'); // bot→port1
    sp.items = []; // 模拟物品前移腾空入口
  }
  const topCount = inPosSeq.filter(x => x === 'top').length;
  const botCount = inPosSeq.filter(x => x === 'bot').length;
  const diff = Math.abs(topCount - botCount);
  let ok = diff <= 1 && topCount > 0 && botCount > 0;
  check('默认轮流输入：两入口交替放行，无单口饿死', ok,
    'top=' + topCount + ' bot=' + botCount + '（序列=' + inPosSeq.join(',') + '）');
  return ok;
}

// ---- 测试 3：输入优先级（inPref=0 优先上方输入）----
function testPriorityTop() {
  const { sp, inTop, inBot } = setup();
  sp.inPref = 0;
  inTop.items = [{ item: 'iron-plate', pos: 0.99, lane: 0 }];
  inBot.items = [{ item: 'copper-plate', pos: 0.99, lane: 0 }];
  // 优先口（top/port0）持续有货时，非优先口（bot/port1）应被暂缓
  sp.acceptItem('iron-plate', 0, 2, 2, 0); // top 进一件
  sp.items = [];
  sp.acceptItem('iron-plate', 0, 2, 2, 0); // top 再进（模拟持续）
  const botAccepted = sp.acceptItem('copper-plate', 0, 2, 3, 0); // bot 尝试
  let ok = botAccepted === false;
  check('优先上方(inPref=0)：上方持续有货时，下方口暂缓', ok,
    '下口是否被暂缓=' + (botAccepted === false));
  // 优先口通畅后，非优先口放行
  sp.items = []; inTop.items = [];
  const botAccepted2 = sp.acceptItem('copper-plate', 0, 2, 3, 0);
  ok = ok && botAccepted2 === true;
  check('优先上方：上方通畅后，下方口正常放行（溢出通道）', botAccepted2 === true,
    '下口是否放行=' + (botAccepted2 === true));
  return ok;
}

// ---- 测试 4：输入优先级（inPref=1 优先下方输入）----
function testPriorityBot() {
  const { sp, inTop, inBot } = setup();
  sp.inPref = 1;
  inTop.items = [{ item: 'iron-plate', pos: 0.99, lane: 0 }];
  inBot.items = [{ item: 'copper-plate', pos: 0.99, lane: 0 }];
  sp.acceptItem('copper-plate', 0, 2, 3, 0); // bot 进
  sp.acceptItem('copper-plate', 0, 2, 3, 0); // bot 再进
  const topAccepted = sp.acceptItem('iron-plate', 0, 2, 2, 0); // top 尝试
  let ok = topAccepted === false;
  check('优先下方(inPref=1)：下方持续有货时，上方口暂缓', ok,
    '上口是否被暂缓=' + (topAccepted === false));
  return ok;
}

// ---- 测试 5：轮流模式单口满载不饿死另一口 ----
function testSingleEntrance() {
  const { sp, inTop, inBot } = setup();
  sp.inPref = -1;
  sp.inToggle = 0;
  inTop.items = [{ item: 'iron-plate', pos: 0.99, lane: 0 }];
  inBot.items = []; // 下口无货
  let accepted = 0;
  for (let i = 0; i < 6; i++) {
    if (sp.acceptItem('iron-plate', 0, 2, 2, 0)) accepted++;
    sp.items = [];
  }
  let ok = accepted === 6;
  check('轮流模式单口满载：另一口无货时不影响该口吞吐', ok,
    '上口放行=' + accepted + '（期望 6）');
  return ok;
}

// ---- 测试 6：输出 lane 保持（穿过分流器 A 进 A 出）----
function testOutputLanePreserve() {
  const { sp, outTop, outBot } = setup();
  // 向分流器放一件 lane=1（B 线）物品，推进到出口触发输出决策
  sp.items = [{ item: 'iron-plate', pos: 0.5, inPort: 0, lane: 1 }];
  sp.outPref = -1;
  sp.update(0.001);
  const o = sp.items[0];
  let r = check('输出 lane 保持：lane=1 物品 outLane=1', o.outLane === 1, 'outLane=' + o.outLane);
  r = check('输出端口已分配（outPort 为 0 或 1）', o.outPort === 0 || o.outPort === 1, 'outPort=' + o.outPort) && r;
  return r;
}

// ---- 测试 7：输出优先级（outPref=0 重定向到顶部输出口）----
function testOutputPriority() {
  const { sp } = setup();
  sp.outPref = 0;
  sp.items = [{ item: 'iron-plate', pos: 0.5, inPort: 0, lane: 0 }];
  sp.update(0.001);
  let r = check('输出优先级(outPref=0)：物品分配到输出口 0', sp.items[0].outPort === 0,
    'outPort=' + sp.items[0].outPort);
  // outPref=1
  sp.items = [{ item: 'copper-plate', pos: 0.5, inPort: 0, lane: 0 }];
  sp.outPref = 1;
  sp.update(0.001);
  r = check('输出优先级(outPref=1)：物品分配到输出口 1', sp.items[0].outPort === 1,
    'outPort=' + sp.items[0].outPort) && r;
  return r;
}

// ---- 测试 8：默认输出轮流（两出口交替）----
function testOutputAlternate() {
  const { sp } = setup();
  sp.outPref = -1;
  sp.outToggle = false;
  const seq = [];
  for (let i = 0; i < 6; i++) {
    sp.items = [{ item: 'iron-plate', pos: 0.5, inPort: 0, lane: 0 }];
    sp.update(0.001);
    seq.push(sp.items[0].outPort);
    sp.items = [];
  }
  const p0 = seq.filter(x => x === 0).length, p1 = seq.filter(x => x === 1).length;
  const diff = Math.abs(p0 - p1);
  let ok = diff <= 1 && p0 > 0 && p1 > 0;
  check('默认输出轮流：两出口交替输出', ok, 'out0=' + p0 + ' out1=' + p1 + '（序列=' + seq.join(',') + '）');
  return ok;
}

// ---- 测试 9：过滤分流器（可编程分离器）----
function testFilter() {
  const { sp } = setup();
  sp.filter = 'iron-plate';
  sp.outPref = 0;
  // 命中过滤物 → 走输出口 0；未命中 → 走输出口 1
  sp.items = [{ item: 'iron-plate', pos: 0.5, inPort: 0, lane: 0 }];
  sp.update(0.001);
  let r = check('过滤分流器：命中物品走优先输出口', sp.items[0].outPort === 0, 'outPort=' + sp.items[0].outPort);
  sp.items = [{ item: 'copper-plate', pos: 0.5, inPort: 0, lane: 0 }];
  sp.update(0.001);
  r = check('过滤分流器：未命中物品走另一输出口', sp.items[0].outPort === 1, 'outPort=' + sp.items[0].outPort) && r;
  // 入口过滤：未命中物品在入口被挡
  sp.items = [];
  const rejected = sp.acceptItem('copper-plate', 0, 2, 2, 0);
  r = check('过滤分流器：未命中物品被挡在入口', rejected === false, '是否拒绝=' + (rejected === false)) && r;
  return r;
}

// ---- 测试 10：渲染几何 4 线模型 ----
const splitterLaneEntryPoint = vm.runInContext('splitterLaneEntryPoint', sandbox);
const splitterLaneExitPoint = vm.runInContext('splitterLaneExitPoint', sandbox);
const laneCenterAt = vm.runInContext('laneCenterAt', sandbox);

function testDualLineGeometry() {
  reset();
  const sp = new Splitter('splitter', 3, 2); sp.dir = 0; sp.applyDir();
  const gx = sp.x, gy = sp.y;
  const perp = [-DY[0], DX[0]]; // 朝右：车道垂直方向是 Y 轴
  let ok = true;
  const absLines = [];
  for (let port = 0; port < 2; port++) {
    for (const [kind, fn] of [['入口', splitterLaneEntryPoint], ['出口', splitterLaneExitPoint]]) {
      const [cpx, cpy] = laneCenterAt(sp, gx, gy, port);
      const [a0x, a0y] = fn(sp, gx, gy, port, 0);
      const [a1x, a1y] = fn(sp, gx, gy, port, 1);
      const d0 = (a0x - cpx) * perp[0] + (a0y - cpy) * perp[1];
      const d1 = (a1x - cpx) * perp[0] + (a1y - cpy) * perp[1];
      const sep = Math.abs(d1 - d0);
      const sym = Math.abs(Math.abs(d0) - Math.abs(d1)) < 1e-6;
      // 绝对线位：分流器中心沿车道轴 + 端口偏移(TILE) + 端口内 lane 偏移
      // 朝右(dir=0)时车道轴为 Y：center + (port-0.5)*TILE + (lane-0.5)*0.3*TILE
      const cy = (gy + sp.h / 2) * TILE;
      const portOff = (port - 0.5) * TILE;
      absLines.push(cy + portOff + d0);
      absLines.push(cy + portOff + d1);
      if (sep < 1 || !sym) {
        ok = false;
        check(kind + port + ' 双线分离', false, 'sep=' + sep.toFixed(1));
      } else {
        check(kind + port + ' A/B 双线分离且对称', true, '间距=' + sep.toFixed(1) + 'px（lane0=' + d0.toFixed(1) + ' lane1=' + d1.toFixed(1) + '）');
      }
    }
  }
  // 两入口 × 双线共 4 个互不重叠的绝对线位（构成 4 线模型）
  const unique = new Set(absLines.map(v => v.toFixed(3))).size;
  check('4 线模型：两入口 × 双线共 4 个互异绝对线位', unique === 4, 'unique=' + unique + '/4');
  return ok;
}

console.log('\n【分流器 4 线物流模型】');
testLanePreserveInput();
console.log('\n【输入调度】');
testAlternate();
testPriorityTop();
testPriorityBot();
testSingleEntrance();
console.log('\n【输出调度】');
testOutputLanePreserve();
testOutputPriority();
testOutputAlternate();
testFilter();
console.log('\n【渲染几何】');
testDualLineGeometry();
console.log('\n----------------------------------------');
console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail > 0 ? 1 : 0);
