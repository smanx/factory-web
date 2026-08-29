'use strict';
// 侧向搭接：一侧目标车道堵塞、另一侧目标车道空闲时，空闲侧不应被连累卡死。
// 场景（C 向左流）：A(0,-1) 向下汇入 C 上侧（→ C.lane0）、B(0,1) 向上汇入 C 下侧（→ C.lane1）。
// C.lane1 满载堵塞、C.lane0 为空。期望：A 的物品持续流入 C.lane0。
// 用法：node tools/test-belt-sideload.js
const fs = require('fs');
const path = require('path');

const BELT_SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'devices', 'belt.js'), 'utf8');

function buildBelt(src) {
  const prelude = `
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];
const TILE = 32;
const BELT_SPACING = 0.125;
const BELT_SPEED = 1.875;
const FAST_BELT_MULT = 1;
function beltSpeed() { return BELT_SPEED; }
const G = { time: 0, dbg: {} };
class Entity { constructor(t, x, y) { this.type = t; this.x = x; this.y = y; } }
class Splitter { }
class Underground { }
function circuitSignalNear() { return {}; }
function circuitCondOk() { return true; }
function tri() {}
const ENT_CLASSES = {}, DEVICE_RENDER = {}, DEVICE_STATUS = {}, DEVICE_PANEL = {}, DEVICE_DIR_ROTATE = {};
const ITEMS = {};
const __ents = new Map();
function entAt(x, y) { return __ents.get(x + ',' + y) || null; }
`;
  return new Function(prelude + '\n' + src + '\nreturn { Belt, __ents };')();
}

const IT = (lane, pos) => ({ item: 'iron-plate', pos, lane, side: -1 });

function buildWorld(Belt, ents) {
  ents.clear();
  const C = new Belt('transport-belt', 0, 0); C.dir = 2; // 向左
  const A = new Belt('transport-belt', 0, -1); A.dir = 1; // 向下，汇入 C 上侧 lane0
  const B = new Belt('transport-belt', 0, 1); B.dir = 3;  // 向上，汇入 C 下侧 lane1
  ents.set('0,0', C); ents.set('0,-1', A); ents.set('0,1', B);
  C.items = [0, 1, 2, 3, 4, 5, 6].map(i => IT(1, +(0.875 - i * 0.125).toFixed(3))); // lane1 近满载
  A.items = [IT(1, 0.9), IT(1, 0.65), IT(0, 0.9), IT(0, 0.65)];
  B.items = [IT(0, 1), IT(0, 0.875), IT(0, 0.75), IT(1, 1), IT(1, 0.875), IT(1, 0.75)];
  return { C, A, B };
}

function run(src, ticks = 120) {
  const { Belt, __ents } = buildBelt(src);
  const w = buildWorld(Belt, __ents);
  const dt = 1 / 60;
  for (let t = 0; t < ticks; t++) { w.A.update(dt); w.C.update(dt); w.B.update(dt); }
  const count = (items, lane) => items.filter(o => (o.lane === 1 ? 1 : 0) === lane).length;
  return {
    cLane0: count(w.C.items, 0),
    cLane1: count(w.C.items, 1),
    aLeft: w.A.items.length,
    bLeft: w.B.items.length,
  };
}

// 修复前等价行为：去掉规则 2 的「真能进入」门控
const PRE = src => src
  .replace('&& this._sideCanEnter(pri[0], pri[1])', '&& true')
  .replace('&& this._sideCanEnter(other[0], other[1])', '&& true');

let fail = 0;
function check(name, cond, detail) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? '  → ' + detail : ''}`);
  if (!cond) fail++;
}

const pre = run(PRE(BELT_SRC));
console.log('修复前（无门控）:', JSON.stringify(pre));
check('bug 复现：A 被连累卡死（A 剩余积压、lane0 未流满）', pre.aLeft >= 1 && pre.cLane0 < 4, `C.lane0=${pre.cLane0}, C.lane1=${pre.cLane1}, A 剩余=${pre.aLeft}`);

const post = run(BELT_SRC);
console.log('修复后（当前代码）:', JSON.stringify(post));
check('A 持续流入空闲 lane0（4 件全部流入）', post.cLane0 === 4 && post.aLeft === 0, `C.lane0=${post.cLane0}, C.lane1=${post.cLane1}, A 剩余=${post.aLeft}`);
check('B 侧仍被 lane1 堵塞（未异常放行）', post.cLane1 >= 8 && post.bLeft >= 2, `C.lane1=${post.cLane1}, B 剩余=${post.bLeft}`);

// 回归：两侧都空闲时，1:1 轮流仍应生效（两侧都能进）
function runBothOpen(src) {
  const { Belt, __ents } = buildBelt(src);
  __ents.clear();
  const C = new Belt('transport-belt', 0, 0); C.dir = 2;
  const A = new Belt('transport-belt', 0, -1); A.dir = 1;
  const B = new Belt('transport-belt', 0, 1); B.dir = 3;
  __ents.set('0,0', C); __ents.set('0,-1', A); __ents.set('0,1', B);
  C.items = [];
  A.items = [IT(1, 1), IT(1, 0.875), IT(0, 1), IT(0, 0.875)];
  B.items = [IT(0, 1), IT(0, 0.875), IT(1, 1), IT(1, 0.875)];
  const dt = 1 / 60;
  for (let t = 0; t < 120; t++) { A.update(dt); C.update(dt); B.update(dt); }
  const count = (items, lane) => items.filter(o => (o.lane === 1 ? 1 : 0) === lane).length;
  return { cLane0: count(C.items, 0), cLane1: count(C.items, 1) };
}
const both = runBothOpen(BELT_SRC);
console.log('回归（双侧空闲）:', JSON.stringify(both));
check('双侧空闲时 A、B 都能进入', both.cLane0 >= 1 && both.cLane1 >= 1, JSON.stringify(both));

// ===== 渲染回归：传送带两遍绘制（第一遍带面 → 第二遍物品）=====
// 背景：相邻带后画时，其不透明带面会盖掉上游带物品越过接缝的部分（连接处闪动/被裁掉）。
function buildRenderHarness(src) {
  const prelude = `
const DX=[1,0,-1,0], DY=[0,1,0,-1], TILE=32, BELT_SPACING=0.125, BELT_SPEED=1.875;
const G={time:0, dbg:{}, cam:{z:1}};
const LOD={simple:false};
const REC=[];
function beltSpeed(){return BELT_SPEED;}
class Entity{constructor(t,x,y){this.type=t;this.x=x;this.y=y;}}
class Splitter{}
class Underground{}
function circuitSignalNear(){return {};}
function circuitCondOk(){return true;}
function tri(){REC.push('chev');}
function rr(){}
function drawItemDot(c,x,y,item){REC.push('item');}
function drawItemDotLOD(c,x,y,item){REC.push('item');}
const ENT_CLASSES={},DEVICE_RENDER={},DEVICE_STATUS={},DEVICE_PANEL={},DEVICE_DIR_ROTATE={},ITEMS={};
const __ents=new Map();
function entAt(x,y){return __ents.get(x+','+y)||null;}
const ctx={globalAlpha:1,fillStyle:'',strokeStyle:'',lineWidth:1,font:'',textAlign:'',textBaseline:'',
  save(){},restore(){},translate(){},rotate(){},scale(){},beginPath(){},closePath(){},moveTo(){},lineTo(){},
  rect(){},clip(){},fill(){REC.push('track');},stroke(){},arc(){},ellipse(){},arcTo(){},fillRect(){REC.push('track');},
  fillText(){},measureText(){return {width:0};},drawImage(){},setLineDash(){},clearRect(){}};
`;
  return new Function(prelude + '\n' + src + '\nreturn { Belt, __ents, REC, ctx, drawBelt, drawBeltItemsAll };')();
}
function runRenderOrder(src) {
  const { Belt, __ents, REC, ctx, drawBelt, drawBeltItemsAll } = buildRenderHarness(src);
  __ents.clear();
  const A = new Belt('transport-belt', 0, 0); A.dir = 0; // 向东
  const B = new Belt('transport-belt', 1, 0); B.dir = 0; // 下游同向（桶序上后画，旧逻辑会盖住 A 越界的物品）
  __ents.set('0,0', A); __ents.set('1,0', B);
  const IT = (lane, pos) => ({ item: 'iron-plate', pos, lane, side: -1 });
  A.items = [IT(0, 0.95), IT(1, 0.5)]; // 0.95 → 已探出接缝进入下游格
  B.items = [IT(0, 0.5)];
  REC.length = 0;
  drawBelt(ctx, A, 0, 0, 0, 1);   // 第一遍：带面
  drawBelt(ctx, B, 1, 0, 0, 1);   // 第一遍：带面（下游带）
  const itemsInPass1 = REC.filter(r => r === 'item').length;
  drawBeltItemsAll(ctx);          // 第二遍：物品
  const seq = REC.slice();
  return { itemsInPass1, total: seq.filter(r => r === 'item').length, lastTrack: seq.lastIndexOf('track'), firstItem: seq.indexOf('item'), tracks: seq.filter(r => r === 'track').length };
}
const r = runRenderOrder(BELT_SRC);
console.log('渲染顺序:', JSON.stringify(r));
check('第一遍只画带面（不画物品）', r.itemsInPass1 === 0, `第一遍物品数=${r.itemsInPass1}`);
check('物品统一排在所有带面之后', r.firstItem > r.lastTrack, `firstItem=${r.firstItem}, lastTrack=${r.lastTrack}`);
check('物品总数正确（3 件）', r.total === 3, `total=${r.total}`);

// ===== 转角回归：物品只画一遍 + 外弧弧长贴近一格（满带不'发虚'）=====
// 带坐标记录的变体：重跑一次并抓取实际坐标
function runCornerGeom(src) {
  const build2 = s => {
    const prelude = `
const DX=[1,0,-1,0], DY=[0,1,0,-1], TILE=32, BELT_SPACING=0.125, BELT_SPEED=1.875;
const G={time:0,dbg:{},cam:{z:1}};
const LOD={simple:false};
const DOTS=[];
function beltSpeed(){return BELT_SPEED;}
class Entity{constructor(t,x,y){this.type=t;this.x=x;this.y=y;}}
class Splitter{}
class Underground{}
function circuitSignalNear(){return {};}
function circuitCondOk(){return true;}
function tri(){}
function rr(){}
function drawItemDot(c,x,y){DOTS.push([x,y]);}
function drawItemDotLOD(c,x,y){DOTS.push([x,y]);}
const ENT_CLASSES={},DEVICE_RENDER={},DEVICE_STATUS={},DEVICE_PANEL={},DEVICE_DIR_ROTATE={},ITEMS={};
const __ents=new Map();
function entAt(x,y){return __ents.get(x+','+y)||null;}
const ctx={globalAlpha:1,fillStyle:'',strokeStyle:'',lineWidth:1,font:'',textAlign:'',textBaseline:'',
  save(){},restore(){},translate(){},rotate(){},scale(){},beginPath(){},closePath(){},moveTo(){},lineTo(){},
  rect(){},clip(){},fill(){},stroke(){},arc(){},ellipse(){},arcTo(){},fillRect(){},
  fillText(){},measureText(){return {width:0};},drawImage(){},setLineDash(){},clearRect(){}};
`;
    return new Function(prelude + '\n' + s + '\nreturn { Belt, __ents, ctx, DOTS, drawBelt, drawBeltItemsAll };')();
  };
  const { Belt, __ents, ctx, DOTS, drawBelt, drawBeltItemsAll } = build2(src);
  __ents.clear();
  const chain = [];
  for (let n = 6; n >= 1; n--) { const b = new Belt('transport-belt', 0, -n); b.dir = 1; chain.push(b); }
  const C = new Belt('transport-belt', 0, 0); C.dir = 2;
  const D = new Belt('transport-belt', -1, 0); D.dir = 2;
  for (const b of chain.concat([C, D])) __ents.set(b.x + ',' + b.y, b);
  const IT = (lane, pos) => ({ item: 'iron-plate', pos, lane, side: -1 });
  chain.forEach(b => { for (const lane of [0, 1]) for (let k = 0; k < 8; k++) b.items.push(IT(lane, +(0.9375 - k * 0.125).toFixed(4))); });
  for (const lane of [0, 1]) for (let k = 0; k < 4; k++) D.items.push(IT(lane, +(0.5 - k * 0.125).toFixed(4)));
  const dt = 1 / 60;
  for (let t = 0; t < 400; t++) {
    for (const b of chain) b.update(dt);
    C.update(dt); D.update(dt);
    D.items = D.items.filter(o => o.pos < 1.2);
  }
  DOTS.length = 0;
  drawBelt(ctx, C, 0, 0, 2, 1);
  drawBeltItemsAll(ctx);
  // CC = 格西北角(0,0)（局部坐标），内弧 R=9、外弧 R=23
  const ann = DOTS.map(([x, y]) => ({ x, y, r: Math.hypot(x, y) }));
  const outer = ann.filter(o => o.r > 16).sort((a, b) => Math.atan2(a.y, a.x) - Math.atan2(b.y, b.x));
  let len = 0;
  for (let i = 1; i < outer.length; i++) len += Math.hypot(outer[i].x - outer[i - 1].x, outer[i].y - outer[i - 1].y);
  const seamR = [outer[0], outer[outer.length - 1]].map(o => o.r);
  return { total: ann.length, laneCount: C.items.length, outerLen: +len.toFixed(2), outerN: outer.length, seamR: seamR.map(r => +r.toFixed(2)) };
}
const g = runCornerGeom(BELT_SRC);
console.log('转角几何:', JSON.stringify(g));
check('转角物品只绘制一遍', g.total === g.laneCount, `绘制点数=${g.total}, 带上物品=${g.laneCount}`);
check('外弧路径长度贴近一格（<35px，旧值 36.1）', g.outerLen < 35, `外弧总长=${g.outerLen}px（${g.outerN} 件）`);
check('外弧端点仍与相邻直带车道对齐（半径 23）', g.seamR.every(r => Math.abs(r - 23) < 0.01), JSON.stringify(g.seamR));

process.exit(fail ? 1 : 0);
