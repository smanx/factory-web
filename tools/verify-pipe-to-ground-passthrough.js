#!/usr/bin/env node
'use strict';
/**
 * 地下管道「中间可放设备 + 配对恒互通」验证脚本
 * ------------------------------------------------
 * 对齐《异星工厂》地下管道（pipe-to-ground）行为，验证：
 *   1. 两座背向（朝向相反、同轴）的地下管道之间**可以放任意设备**：
 *      中间放石炉/组装机/传送带/管道/机械臂/箱子等，配对依旧成立、依旧互通；
 *      这正是地下管道的用途——地下管段从设备「下方」穿过。
 *   2. 中间的设备**不会与地下管段连通流体**（地下段只连两端管口，不与中间设备交换流体）。
 *   3. 只有「峭壁 / 水面」这类不可建造地形会切断地下管段（对齐官方 Cliff 阻挡）。
 *   4. 距离语义不变：距离 1 相邻口对口不算配对、只与最近的背向管道配对（同向不配对）。
 *   5. PIPE_GROUND_MAX 来自官方单源 GAME_DATA.pipeGroundDist（官方 = 10）。
 *   6. 已配对的两座之间流体按压差双向均压（可从任一端进、任一端出）。
 *   7. 面板/提示文案正确说明「中间可放设备」。
 *
 * 运行：node tools/verify-pipe-to-ground-passthrough.js （退出码 0 = 通过）
 * 零依赖：加载真实 data.generated.js / data.js / data-buildings.js / core/entity.js
 *         / devices/pipe.js / devices/pipe-ground.js 做端到端模拟。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'js');
const load = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');

// 世界地形：默认全草地；测试里可把指定格改成水面/峭壁/树木
const TERRAIN = new Map();

const G = { grid: new Map(), ents: [], buckets: new Map(), settings: { language: 'zh' }, techDone: {} };

const sandbox = {
  console, Math, JSON, Set, Map, Array, Object, String, Number, Boolean, Date, RegExp,
  parseInt, parseFloat, isFinite, isNaN,
  G,
  // 地形函数（复刻 world.js：默认草地 T_GRASS=0，可按测试设定水面/峭壁/树木）
  getTerrain: (tx, ty) => TERRAIN.get(tx + ',' + ty) ?? 0,
  setTerrain: (tx, ty, v) => TERRAIN.set(tx + ',' + ty, v),
  isWater: (tx, ty) => sandbox.getTerrain(tx, ty) === 1,
  isCliff: (tx, ty) => sandbox.getTerrain(tx, ty) === 7,
  isTree: (tx, ty) => sandbox.getTerrain(tx, ty) === 4,
  // 面板渲染所需的最小 UI 桩（row / chip / countStr / ITEMS 水名），仅为生成面板 HTML
  row: (label, val, liveKey) => '<div class="mrow"><span class="mlabel">' + label + '</span><span class="mval"' +
    (liveKey ? ' data-live="' + liveKey + '"' : '') + '>' + val + '</span></div>',
  chip: (id, n) => id + '×' + (n === undefined ? '' : n),
  countStr: (o) => Object.keys(o).map(k => k + '×' + o[k]).join(''),
  ITEMS: { water: { name: '水', color: '#3fa0e8' } },
  buildingMaxHp: () => 100,
  regPowerEnt: () => {}, unregPowerEnt: () => {},
  invalidateBeltInputNear: () => {},
  circuitSignalNear: () => ({}),
  playSfx: () => {}, toast: () => {},
  ENT_CLASSES: {}, DEVICE_RENDER: {}, DEVICE_STATUS: {}, DEVICE_PANEL: {}, DEVICE_DIR_ROTATE: {}, DEVICE_PLACE: {},
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);

vm.runInContext(
  load('data/data.generated.js') + '\n'
  + load('data/data.js') + '\n'
  + load('data/data-buildings.js') + '\n'
  + load('core/entity.js') + '\n'
  + load('devices/pipe.js') + '\n'
  + load('devices/pipe-ground.js') + '\n'
  + 'globalThis.__Entity=Entity;globalThis.__Pipe=Pipe;globalThis.__PipeToGround=PipeToGround;'
  + 'globalThis.__PIPE_GROUND_MAX=PIPE_GROUND_MAX;globalThis.__PIPE_CAP=PIPE_CAP;'
  + 'globalThis.__ugPipePassable=ugPipePassable;globalThis.__GAME_DATA=GAME_DATA;'
  + 'globalThis.__BUILD_DEFS=BUILD_DEFS;globalThis.__row=typeof row==="function"?row:null;'
  + 'globalThis.__pipeGroundPanelHtml=pipeGroundPanelHtml;',
  sandbox, { filename: 'pipe-ground.js' }
);

const { __Entity: Entity, __Pipe: Pipe, __PipeToGround: PipeToGround,
        __PIPE_GROUND_MAX: PIPE_GROUND_MAX, __PIPE_CAP: PIPE_CAP,
        __ugPipePassable: ugPipePassable, __GAME_DATA: GAME_DATA,
        __BUILD_DEFS: BUILD_DEFS, __pipeGroundPanelHtml: pipeGroundPanelHtml } = sandbox;

const T_CLIFF = 7, T_WATER = 1, T_TREE = 4;

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name); }
}

function fresh() {
  G.grid = new Map(); G.ents = []; G.buckets = new Map();
  TERRAIN.clear();
}
// 放置实体（多格占地：把每一格都写进 grid，与 addEnt 一致）
function put(e) {
  G.ents.push(e);
  ensureBucket(e);
  for (let dy = 0; dy < e.h; dy++)
    for (let dx = 0; dx < e.w; dx++) G.grid.set(entKey(e.x + dx, e.y + dy), e);
  return e;
}
function entKey(x, y) { return ((x + 32768) << 16) | (y + 32768); }
function ensureBucket(e) {
  const k = ((e.x >> 4) + 4096) * 8192 + ((e.y >> 4) + 4096);
  let s = G.buckets.get(k); if (!s) { s = new Set(); G.buckets.set(k, s); }
  s.add(e);
}
function ug(x, y, dir) { const e = new PipeToGround('pipe-to-ground', x, y); e.dir = dir; return put(e); }

console.log('\n【官方数据单源：最大跨距】');
ok(GAME_DATA.pipeGroundDist === 10, 'GAME_DATA.pipeGroundDist = 10（官方 max_underground_distance）');
ok(PIPE_GROUND_MAX === 10, 'PIPE_GROUND_MAX 取自官方单源 = ' + PIPE_GROUND_MAX);

console.log('\n【中间放设备：配对不中断（核心修复）】');
// 场景：x=10 (dir=0 朝东) ↔ x=14 (dir=2 朝西)，中间 11/12/13 放各种设备
const blockers = [
  ['石炉 2×2', (x, y) => put(new Entity('stone-furnace', x, y))],
  ['组装机 3×3', (x, y) => put(new Entity('assembling-machine-1', x, y))],
  ['传送带', (x, y) => put(new Entity('transport-belt', x, y))],
  ['普通管道', (x, y) => put(new Pipe('pipe', x, y))],
  ['木箱', (x, y) => put(new Entity('wooden-chest', x, y))],
  ['机械臂', (x, y) => put(new Entity('inserter', x, y))],
  ['抽油机 3×3', (x, y) => put(new Entity('pumpjack', x, y))],
];
for (const [label, make] of blockers) {
  fresh();
  const a = ug(10, 5, 0);       // 朝东：管口朝东（背侧朝西）
  const b = ug(16, 5, 2);       // 朝西：与 a 背向相对
  const mid = [];
  // 中间放一台设备（多格设备从 x 向右下扩展，仍完整落在两端之间的地下段上）
  mid.push(make(12, 5));
  ok(a.findMate() === b && b.findMate() === a, '中间放' + label + '：两座仍配对（互为 findMate）');
  ok(a.isPaired() && b.isPaired(), '中间放' + label + '：isPaired() 均为真');
  // 中间设备不得与地下管段连通：地下段只连两端管口
  a.giveItem('water');
  for (let i = 0; i < 200; i++) { a.update(0.05); b.update(0.05); }
  const leaked = mid.filter(m => m.fluid && Object.keys(m.fluid).some(k => m.fluid[k] > 0));
  ok(leaked.length === 0, '中间放' + label + '：中间设备不与地下管段连通（无流体渗入）');
}

console.log('\n【配对端双向互通：可从任一端进、任一端出】');
fresh();
{
  const a = ug(10, 5, 0), b = ug(16, 5, 2);
  put(new Entity('stone-furnace', 12, 5));
  put(new Entity('stone-furnace', 14, 5));
  for (let i = 0; i < 4; i++) a.giveItem('water');
  for (let i = 0; i < 400; i++) { a.update(0.05); b.update(0.05); }
  ok(a.total() > 0 && b.total() > 0, '流体被均分到两端（a=' + a.total() + ' b=' + b.total() + '）');
  ok(a.total() + b.total() === 4, '总量守恒 = 4（实际 ' + (a.total() + b.total()) + '）');
  // 反向注入：从 b 端进，也应流向 a 端（不分入口/出口）
  const a0 = a.total();
  b.giveItem('water'); b.giveItem('water');
  for (let i = 0; i < 400; i++) { a.update(0.05); b.update(0.05); }
  ok(a.total() > a0, '反向注入也可流向另一端（b 端进 → a 端由 ' + a0 + ' 增至 ' + a.total() + '）');
  ok(Math.abs(a.total() - b.total()) <= 1, '稳态两端趋平（a=' + a.total() + ' b=' + b.total() + '）');
}

console.log('\n【管口方向性：只有管口能接管道（Bug 修复回归）】');
// dir=0 时管口在 -dir（西侧），背向在 +dir（东侧）
fresh();
{
  const a = ug(10, 5, 0);
  const backPipe = put(new Pipe('pipe', 11, 5));   // 背向（东侧）的普通管道
  a.giveItem('water'); a.giveItem('water');
  for (let i = 0; i < 200; i++) a.update(0.05);   // 流体交换由地下管道 update 驱动
  ok(backPipe.total() === 0, '背向（+dir）接普通管道：不连通、不接流体（修复后，back=' + backPipe.total() + '）');
  ok(a.total() === 2, '背向不泄流：流体仍留在管内（a=' + a.total() + '）');
}
fresh();
{
  const a = ug(10, 5, 0);
  const mouthPipe = put(new Pipe('pipe', 9, 5));   // 管口（西侧）的普通管道
  a.giveItem('water'); a.giveItem('water');
  for (let i = 0; i < 200; i++) a.update(0.05);   // 流体交换由地下管道 update 驱动
  ok(mouthPipe.total() > 0, '管口（-dir）接普通管道：正常连通并接流体（mouth=' + mouthPipe.total() + '）');
  ok(a.total() + mouthPipe.total() === 2, '管口侧总量守恒 = 2（实际 ' + (a.total() + mouthPipe.total()) + '）');
}
fresh();
{
  // 背对背相邻的地下管道不就近互通（背向不接管道），但背向配对的长段仍互通
  const a = ug(10, 5, 0), b = ug(11, 5, 2);   // b 在 a 背向
  for (let i = 0; i < 3; i++) a.giveItem('water');
  for (let i = 0; i < 200; i++) { a.update(0.05); b.update(0.05); }
  ok(b.total() === 0, '背对背相邻地下管道：背向不互通（b=' + b.total() + '）');
  const c = ug(16, 5, 2);   // 与 a 背向配对（距离 6）
  for (let i = 0; i < 200; i++) { a.update(0.05); b.update(0.05); c.update(0.05); }
  ok(a.findMate() === c, 'a 仍与背向远端 c 配对（findMate=c）');
  ok(c.total() > 0, '背向配对端经地下管段互通（c=' + c.total() + '）');
}

console.log('\n【地形阻挡：峭壁 / 水面切断地下管段】');
for (const [label, tile] of [['峭壁', T_CLIFF], ['水面', T_WATER]]) {
  fresh();
  const a = ug(10, 5, 0), b = ug(14, 5, 2);
  sandbox.setTerrain(12, 5, tile);
  ok(a.findMate() === null && b.findMate() === null, '中间是' + label + '：配对被切断（findMate=null）');
  ok(!a.isPaired() && !b.isPaired(), '中间是' + label + '：isPaired() 为假');
}
fresh();
{
  const a = ug(10, 5, 0), b = ug(14, 5, 2);
  sandbox.setTerrain(12, 5, T_TREE);
  ok(a.findMate() === b, '中间是树木：不阻挡配对（地下管道可穿树）');
}

console.log('\n【距离与配对语义不变（回归）】');
fresh();
{
  const a = ug(10, 5, 0), b = ug(11, 5, 2);
  ok(a.findMate() === null, '距离 1 相邻：不算配对（findMate=null）');
  ok(a._adjacentMouthOpposite() === null, '距离 1 背对背（b 在 a 背向）：背向不接管道（_adjacentMouthOpposite=null）');
  // 口对口（管口侧）的相邻地下管道仍就近互通：a 管口朝西，c 管口朝东，两两相对
  const c = ug(9, 5, 2);
  ok(a._adjacentMouthOpposite() === c, '距离 1 口对口（管口侧）：仍按口对口就近互通');
}
fresh();
{
  const a = ug(10, 5, 0), b = ug(14, 5, 0);
  ok(a.findMate() === null && b.findMate() === null, '同向两座不配对');
}
fresh();
{
  const a = ug(10, 5, 0), b = ug(13, 5, 2), c = ug(16, 5, 0);
  ok(a.findMate() === b, '一条线上多座：a 只与最近的背向管道配对（a↔b，不越过 b 与 c 配）');
  ok(c.findMate() === b, '一条线上多座：c 只与最近的背向管道配对（c↔b）');
}
fresh();
{
  const a = ug(10, 5, 0), b = ug(10 + PIPE_GROUND_MAX + 1, 5, 2);
  ok(a.findMate() === null, '超出 ' + PIPE_GROUND_MAX + ' 格跨距：不配对');
  const a2 = ug(20, 8, 0), b2 = ug(20 + PIPE_GROUND_MAX, 8, 2);
  ok(a2.findMate() === b2, '恰好 ' + PIPE_GROUND_MAX + ' 格跨距：仍配对');
}

console.log('\n【容量与防混合（回归）】');
fresh();
{
  const a = ug(10, 5, 0), b = ug(14, 5, 2);
  for (let i = 0; i < PIPE_CAP; i++) a.giveItem('water');
  ok(a.total() === PIPE_CAP, '单座容量上限 = PIPE_CAP(' + PIPE_CAP + ')');
  ok(a.giveItem('water') === false, '已满时拒绝再注入');
  ok(a.giveItem('crude-oil') === false, '已有其它流体时拒绝混入');
}

console.log('\n【ugPipePassable 语义】');
fresh();
{
  ok(ugPipePassable(3, 3) === true, '空格/草地可穿越');
  sandbox.setTerrain(3, 3, T_TREE);
  ok(ugPipePassable(3, 3) === true, '树木可穿越');
  sandbox.setTerrain(3, 3, T_CLIFF);
  ok(ugPipePassable(3, 3) === false, '峭壁不可穿越');
  sandbox.setTerrain(3, 3, T_WATER);
  ok(ugPipePassable(3, 3) === false, '水面不可穿越');
}

console.log('\n【面板文案说明「中间可放设备」】');
{
  const html = pipeGroundPanelHtml(ug(10, 5, 0));
  ok(/中间<\/b>可以放任意设备|中间可以放任意设备/.test(html), '面板提示含「中间可以放任意设备」');
  ok(/不会被阻挡/.test(html), '面板提示含「不会被阻挡」');
  ok(/峭壁|水面/.test(html), '面板提示说明峭壁/水面会切断管段');
}

console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
