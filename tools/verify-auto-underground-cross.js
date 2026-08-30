#!/usr/bin/env node
'use strict';
/**
 * 拖动铺设传送带遇障碍自动生成地下带 验证脚本
 * ------------------------------------------------
 * 端到端模拟拖动铺设，验证 tryPlaceAt 各分支：
 *   1. 垂直交叉传送带（横向带障碍）→ 自动生成一对地下带跨越，障碍带保留不损坏；
 *      入口在障碍前一格、出口在障碍后第一空格，配对成立（核心回归场景）。
 *   2. 固体障碍（石炉）→ 自动生成一对地下带跨越。
 *   3. 同向传送带 → 直接衔接替换，不生成地下带。
 *   4. 反向传送带 → 自动生成地下带跨越。
 *   5. 分流器障碍 → 自动生成地下带跨越，分流器保留。
 *   6. 光标处已是地下带 → 不重复生成（走覆盖升级分支）。
 *   7. 正常转角铺设 → 不误触发地下带。
 *   8. 非传送带物品（石炉）→ 不触发自动地下带。
 * 运行：node tools/verify-auto-underground-cross.js （退出码 0 = 通过）
 * 零依赖：按 index.html 顺序加载全部 js 源码做端到端模拟。
 */
const fs = require('fs');
const path = require('path');

global.window = { addEventListener: () => {}, innerWidth: 1280, innerHeight: 800, devicePixelRatio: 1, location: { search: '' } };
global.document = {
  getElementById: () => null,
  createElement: () => ({ getContext: () => ({}), toDataURL: () => '', style: {}, appendChild: () => {}, addEventListener: () => {} }),
  addEventListener: () => {},
  readyState: 'loading',
  body: { appendChild: () => {} }
};
global.requestAnimationFrame = () => {};
global.localStorage = { getItem: () => null, setItem() {} };

const ctxStub = new Proxy({}, {
  get: (t, k) => {
    if (k === 'measureText') return () => ({ width: 0 });
    if (k === 'getImageData') return () => ({ data: [] });
    return k in t ? t[k] : () => {};
  },
  set: () => true
});
const realCreateElement = global.document.createElement;
global.document.createElement = tag => {
  const el = realCreateElement(tag);
  if (tag === 'canvas') {
    el.width = el.height = 34;
    el.getContext = () => ctxStub;
    el.toDataURL = () => 'data:,';
  }
  return el;
};

// 按 index.html 的 script 顺序加载全部源码
const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const srcFiles = [...html.matchAll(/src="(js\/[^"]+)"/g)]
  .map(m => m[1])
  .filter(p => !p.includes('visitor-badge'))
  .map(p => p.replace(/^js\//, ''));
let src = srcFiles.map(f => fs.readFileSync(path.join(root, 'js', f), 'utf8')).join('\n;\n');
// 静默 toast（无 DOM）：在源码之后覆盖定义，避免 ui.js 内部的 toast 抢先声明
src += '\n;\nfunction toast(){}\n';

let pass = 0, fail = 0;

const test = `
function fresh() {
  G.world = genWorld(12345); G.world.seed = 12345;
  G.ents = []; G.grid = new Map(); G.time = 0;
  G.player = makePlayer(-40, -40);
  G.dbg.farReach = true;
  G.inv = new Map(); G.inv.set('transport-belt', 100); G.inv.set('underground-belt', 10);
  G.sel = -1; G.quickSel = 'transport-belt';
  G.ghostDir = 0;
}
function addBelt(x, y, d) { const b = new (ENT_CLASSES['transport-belt'])('transport-belt', x, y); b.dir = d; b.applyDir(); addEnt(b); return b; }
function dragTo(tx, ty) { G.cursorTile = { tx, ty }; tryPlaceAt(tx, ty); }
const ax = -20, ay = -20;

// S1: 垂直交叉带（东西向横带，南北拖动）→ 核心修复场景
fresh();
G.ghostDir = 1;
for (let x = ax-3; x <= ax+3; x++) addBelt(x, ay+2, 0);
dragTo(ax, ay); dragTo(ax, ay+1); dragTo(ax, ay+2); dragTo(ax, ay+3); dragTo(ax, ay+4);
check('交叉带 → 恰好一对地下带（入口/出口）',
  G.ents.filter(e => e instanceof Underground).length === 2
  && entAt(ax,ay+1)?.type === 'underground-belt' && entAt(ax,ay+1)?.dir === 1
  && entAt(ax,ay+3)?.type === 'underground-belt' && entAt(ax,ay+3)?.dir === 1);
check('交叉带 → 障碍带保留不受损',
  entAt(ax,ay+2)?.type === 'transport-belt' && entAt(ax,ay+2)?.dir === 0);
const ugIn = G.ents.find(e => e instanceof Underground && e.x===ax && e.y===ay+1);
const ugOut = G.ents.find(e => e instanceof Underground && e.x===ax && e.y===ay+3);
check('交叉带 → 地下带正确配对', !!ugIn && !!ugOut && ugIn.findMate() === ugOut);
check('交叉带 → 消耗 2 条地下带', invCount('underground-belt') === 8);

// S2: 固体障碍 → 地下带
fresh();
const obst = new (ENT_CLASSES['stone-furnace'])('stone-furnace', ax+3, ay); addEnt(obst);
dragTo(ax, ay); dragTo(ax+1, ay); dragTo(ax+2, ay); dragTo(ax+3, ay); dragTo(ax+4, ay);
check('固体障碍 → 地下带跨越且障碍保留',
  G.ents.filter(e => e instanceof Underground).length === 2 && entAt(ax+3,ay)?.type === 'stone-furnace');

// S3: 同向带 → 直接衔接替换，不生成地下带
fresh();
addBelt(ax+3, ay, 0);
dragTo(ax, ay); dragTo(ax+1, ay); dragTo(ax+2, ay); dragTo(ax+3, ay);
check('同向衔接 → 不生成地下带',
  G.ents.filter(e => e instanceof Underground).length === 0
  && entAt(ax+3,ay)?.type === 'transport-belt' && entAt(ax+3,ay)?.dir === 0);

// S4: 快速带盖普通带 → 同阶升级覆盖仍正常
fresh();
addBelt(ax+3, ay, 0);
G.inv = new Map(); G.inv.set('fast-transport-belt', 100);
G.quickSel = 'fast-transport-belt';
dragTo(ax+3, ay);
check('同族升级覆盖 → 正常替换', entAt(ax+3,ay)?.type === 'fast-transport-belt');

// S5: 反向带障碍 → 地下带
fresh();
addBelt(ax+3, ay, 2);
dragTo(ax, ay); dragTo(ax+1, ay); dragTo(ax+2, ay); dragTo(ax+3, ay);
check('反向带 → 地下带跨越', G.ents.filter(e => e instanceof Underground).length === 2);

// S6: 分流器障碍 → 地下带跨越且分流器保留
fresh();
const sp = new (ENT_CLASSES['splitter'])('splitter', ax+3, ay); sp.dir = 1; sp.applyDir(); addEnt(sp);
dragTo(ax, ay); dragTo(ax+1, ay); dragTo(ax+2, ay); dragTo(ax+3, ay);
check('分流器 → 地下带跨越且保留',
  G.ents.filter(e => e instanceof Underground).length === 2 && entAt(ax+3,ay)?.type === 'splitter');

// S7: 光标处已是地下带 → 不重复生成（走覆盖分支）
fresh();
const ugE = new (ENT_CLASSES['underground-belt'])('underground-belt', ax+3, ay); ugE.dir = 1; ugE.applyDir(); addEnt(ugE);
dragTo(ax, ay); dragTo(ax+1, ay); dragTo(ax+2, ay); dragTo(ax+3, ay);
check('已有地下带 → 不重复生成',
  G.ents.filter(e => e instanceof Underground).length === 1 && entAt(ax+3,ay)?.type === 'underground-belt');

// S8: 正常转角铺设 → 不误触发
fresh();
dragTo(ax, ay); dragTo(ax+1, ay); dragTo(ax+2, ay);
G.ghostDir = 1;
dragTo(ax+2, ay+1); dragTo(ax+2, ay+2);
check('正常转角 → 不触发地下带', G.ents.filter(e => e instanceof Underground).length === 0);

// S9: 非传送带物品 → 不触发自动地下带
fresh();
const f1 = new (ENT_CLASSES['stone-furnace'])('stone-furnace', ax+3, ay); addEnt(f1);
G.quickSel = 'stone-furnace';
G.inv = new Map(); G.inv.set('stone-furnace', 100);
dragTo(ax+3, ay);
check('非传送带 → 不触发自动地下带', entAt(ax+3,ay)?.type === 'stone-furnace');
globalThis.__PASS = pass; globalThis.__FAIL = fail;
`;

try {
  (0, eval)(src + '\n;\nvar pass = 0, fail = 0;\nfunction check(n, c){ if (c) { pass++; console.log("  \u2705 " + n); } else { fail++; console.log("  \u274c " + n); } }\n;\n' + test);

} catch (e) {
  console.log('  ❌ 执行异常: ' + e.message);
  process.exit(1);
}
pass = globalThis.__PASS || 0; fail = globalThis.__FAIL || 0;

console.log('');
if (fail === 0) console.log(`✅ 全部校验通过（${pass} 项）`);
else console.log(`❌ ${fail} 项校验失败`);
process.exit(fail ? 1 : 0);
