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

// ===== 地下带链式拼接：出口 → 下一组地下带的入口 =====
// 布局（统一向东 dir=0）：
//   带(0,0)(1,0)(2,0) → UG1入口(3,0) … UG1出口(6,0) → UG2入口(7,0) … UG2出口(10,0) → 带(11,0)
const UG_SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'devices', 'underground.js'), 'utf8');
// 回退补丁：屏蔽"出口接入下一组入口"的新分支（模拟修改前行为）
const UG_OLD = s => s.replace(
  'if (t.dir === this.dir && t.type === this.type && t.isEntrance()) {',
  'if (false) {');

function buildUg(ugSrc) {
  const prelude = `
const DX=[1,0,-1,0], DY=[0,1,0,-1], TILE=32, BELT_SPACING=0.125, BELT_SPEED=1.875;
const UG_CAP=8, UNDERGROUND_MAX=6, FAST_UNDERGROUND_MAX=14, FAST_BELT_MULT=2;
const G={time:0, dbg:{}, cam:{z:1}};
const LOD={simple:false};
const ITEMS={};
function beltSpeed(){return BELT_SPEED;}
class Entity{constructor(t,x,y){this.type=t;this.x=x;this.y=y;}}
class Splitter{}
function circuitSignalNear(){return {};}
function circuitCondOk(){return true;}
function tri(){}
function rr(){}
function drawItemDot(){}
function drawItemDotLOD(){}
const ENT_CLASSES={},DEVICE_RENDER={},DEVICE_STATUS={},DEVICE_PANEL={},DEVICE_DIR_ROTATE={};
const __ents=new Map();
function entAt(x,y){return __ents.get(x+','+y)||null;}
`;
  return new Function(prelude + '\n' + BELT_SRC + '\n' + ugSrc
    + '\nreturn { Belt, Underground, __ents, beltInputSide };')();
}
function runUgChain(ugSrc) {
  const { Belt, Underground, __ents, beltInputSide } = buildUg(ugSrc);
  __ents.clear();
  const put = (e) => __ents.set(e.x + ',' + e.y, e);
  const src = [];
  for (let x = 0; x <= 2; x++) { const b = new Belt('transport-belt', x, 0); b.dir = 0; src.push(b); put(b); }
  const ug1i = new Underground('underground-belt', 3, 0); ug1i.dir = 0; put(ug1i);
  const ug1o = new Underground('underground-belt', 6, 0); ug1o.dir = 0; put(ug1o);
  const ug2i = new Underground('underground-belt', 7, 0); ug2i.dir = 0; put(ug2i);
  const ug2o = new Underground('underground-belt', 10, 0); ug2o.dir = 0; put(ug2o);
  const dst = new Belt('transport-belt', 11, 0); dst.dir = 0; put(dst);
  // 侧面邻居：位于 UG2 入口南侧的传送带（UG2 入口不应被当作"向地面输出"的输入源）
  const sideBelt = new Belt('transport-belt', 7, 1); sideBelt.dir = 0; put(sideBelt);
  const IT = lane => ({ item: 'iron-plate', pos: 0.9, lane, side: -1 });
  src.forEach(b => { b.items = [IT(0), IT(1), IT(0), IT(1)]; });
  const dt = 1 / 60;
  let arrived = 0; const byLane = [0, 0];
  for (let t = 0; t < 1200; t++) {
    for (const b of src) b.update(dt);
    ug1i.update(dt); ug1o.update(dt); ug2i.update(dt); ug2o.update(dt);
    dst.update(dt);
    arrived += dst.items.length;
    for (const o of dst.items) byLane[o.lane === 1 ? 1 : 0]++;
    dst.items.length = 0;                       // 终点持续消耗
    for (const b of src) if (b.items.length < 4) b.items.push(IT(t % 2));  // 源头持续供料
  }
  return {
    arrived, byLane,
    ug1oIsExit: ug1o.isExit(),
    ug2iIsEntrance: ug2i.isEntrance(),
    sideInp: beltInputSide(sideBelt).length,    // 侧面带的输入源数量（UG2 入口不应计入）
  };
}
const ugOld = runUgChain(UG_OLD(UG_SRC));
const ugNew = runUgChain(UG_SRC);
console.log('地下带链（修改前）:', JSON.stringify(ugOld));
console.log('地下带链（修改后）:', JSON.stringify(ugNew));
check('出口紧邻下一组入口时仍正确判定出口/入口', ugNew.ug1oIsExit && ugNew.ug2iIsEntrance, JSON.stringify(ugNew));
check('修改前：出口接不进下一组入口（终点 0 件）', ugOld.arrived === 0, 'arrived=' + ugOld.arrived);
check('修改后：物品贯穿两组地下带（终点 >0 件）', ugNew.arrived > 0, 'arrived=' + ugNew.arrived);
check('入口不再被当作地面输出源（侧面带输入源 = 0）', ugNew.sideInp === 0, 'sideInp=' + ugNew.sideInp);
check('贯穿隧道后车道保持（左进左出/右进右出，两列都有货）', ugNew.byLane[0] > 0 && ugNew.byLane[1] > 0, JSON.stringify(ugNew.byLane));

// ===== 地下带/地下管道配对规则：已配对的不能再与下一座配对 =====
function buildPair(ugSrc, pipeSrc) {
  const prelude = `
const DX=[1,0,-1,0], DY=[0,1,0,-1], TILE=32, BELT_SPACING=0.125, BELT_SPEED=1.875;
const UG_CAP=8, UNDERGROUND_MAX=6, FAST_UNDERGROUND_MAX=14, FAST_BELT_MULT=2;
const PIPE_CAP=100;
const GAME_DATA={};
const G={time:0, dbg:{}, cam:{z:1}};
const LOD={simple:false};
const ITEMS={};
function beltSpeed(){return BELT_SPEED;}
function isCliff(){return false;}
function isWater(){return false;}
class Entity{constructor(t,x,y){this.type=t;this.x=x;this.y=y;}}
class Splitter{}
class Pipe{}
function circuitSignalNear(){return {};}
function circuitCondOk(){return true;}
function tri(){}
function rr(){}
function drawItemDot(){}
function drawItemDotLOD(){}
const ENT_CLASSES={},DEVICE_RENDER={},DEVICE_STATUS={},DEVICE_PANEL={},DEVICE_DIR_ROTATE={};
const __ents=new Map();
function entAt(x,y){return __ents.get(x+','+y)||null;}
`;
  return new Function(prelude + '\n' + BELT_SRC + '\n' + ugSrc + '\n' + (pipeSrc || '')
    + '\nreturn { Belt, Underground, __ents, PipeToGround: (typeof PipeToGround === "undefined") ? null : PipeToGround };')();
}
// 一条线上 n 座同向地下带（间距 2 格，均在 maxDist 内），返回各座的配对关系
function ugLine(n) {
  const { Underground, __ents } = buildPair(UG_SRC);
  __ents.clear();
  const us = [];
  for (let i = 0; i < n; i++) { const u = new Underground('underground-belt', i * 2, 0); u.dir = 0; us.push(u); __ents.set(u.x + ',' + u.y, u); }
  const name = u => (u ? '#' + (us.indexOf(u) + 1) : 'null');
  return {
    fwd: us.map(u => name(u.findMate())),
    back: us.map(u => name(u.findBackMate())),
    paired: us.map(u => u.isPaired()),
    roles: us.map(u => (u.isEntrance() ? 'in' : (u.isExit() ? 'out' : '-'))),
  };
}
const PIPE_SRC = fs.readFileSync(path.join(__dirname, '..', 'js', 'devices', 'pipe-ground.js'), 'utf8');
// 管道：#1(x=0,朝东) 与 #2(x=3,朝西) 已配对；#3(x=6) 旋转为朝西后不得再与 #1/#2 配对
function pipeLine() {
  const { PipeToGround, __ents } = buildPair(UG_SRC, PIPE_SRC);
  __ents.clear();
  const mk = (x, dir) => { const p = new PipeToGround('pipe-to-ground', x, 0); p.dir = dir; __ents.set(x + ',0', p); return p; };
  const p1 = mk(0, 0), p2 = mk(3, 2), p3 = mk(6, 2);   // 东、西、西
  return { p1, p2, p3, m1: p1.findMate() === p2, m2: p2.findMate() === p1, m3: !!p3.findMate() };
}

const l4 = ugLine(4), l3 = ugLine(3);
console.log('地下带×4 配对:', JSON.stringify(l4));
console.log('地下带×3 配对:', JSON.stringify(l3));
check('4 座线：1-2、3-4 各自成对', l4.fwd[0] === '#2' && l4.back[1] === '#1' && l4.fwd[2] === '#4' && l4.back[3] === '#3', JSON.stringify(l4.fwd) + JSON.stringify(l4.back));
check('4 座线：已配对的 2 号不再向前配 3 号', l4.fwd[1] === 'null', 'fwd=' + JSON.stringify(l4.fwd));
check('4 座线：3 号不回头配 2 号/1 号', l4.back[2] === 'null', 'back=' + JSON.stringify(l4.back));
check('4 座线：角色交替 in/out/in/out', l4.roles.join(',') === 'in,out,in,out', JSON.stringify(l4.roles));
check('3 座线：落单的 3 号判定为未配对', l3.paired[2] === false, JSON.stringify(l3));
check('3 座线：3 号旋转不会牵动 1/2 号（无配对端）', l3.fwd[2] === 'null' && l3.back[2] === 'null', JSON.stringify(l3));
check('3 座线：1-2 仍然配对', l3.fwd[0] === '#2' && l3.back[1] === '#1', JSON.stringify(l3));

const pl = pipeLine();
console.log('地下管道:', JSON.stringify({ m1: pl.m1, m2: pl.m2, m3: pl.m3 }));
check('管道：1-2 背向配对', pl.m1 && pl.m2, JSON.stringify({ m1: pl.m1, m2: pl.m2 }));
check('管道：3 号隔着同向的 2 号不得再配 1/2 号', pl.m3 === false, 'm3=' + pl.m3);

// ===== 幽灵配对：幽灵实体坐标必须先设为光标格，内部配对判定才与真实摆放一致 =====
function ghostPairOrder() {
  const { PipeToGround, __ents } = buildPair(UG_SRC, PIPE_SRC);
  __ents.clear();
  const mk = (x, dir) => { const p = new PipeToGround('pipe-to-ground', x, 0); p.dir = dir; __ents.set(x + ',0', p); return p; };
  const a = mk(0, 0);                       // 已铺设：朝东（管口朝西）
  // 幽灵实体：与 drawGhost 里 getGhostEnt 的缓存对象一样，初始 x/y 停留在原点
  const ghost = new PipeToGround('pipe-to-ground', 0, 0);
  ghost.dir = 2;                            // 幽灵朝西，光标在 (3,0)
  // 旧顺序（bug）：drawEntity 先于 tmp.x/tmp.y 赋值 → isPaired 用的是缓存旧坐标 (0,0)
  const stale = ghost.isPaired();
  // 修复后顺序：先 tmp.x=3; tmp.y=0 再 drawEntity → 判定基于光标格
  ghost.x = 3; ghost.y = 0;
  const fixed = ghost.isPaired();
  // 真实放置后的对照：同一位置同一朝向的已铺设管道
  const real = mk(3, 2);
  return { stale, fixed, real: real.isPaired() };
}
const gp = ghostPairOrder();
console.log('幽灵配对（旧坐标/新坐标/真实摆放）:', JSON.stringify(gp));
check('幽灵在旧坐标上配对判定错误（stale=false，bug 特征）', gp.stale === false, 'stale=' + gp.stale);
check('坐标先赋值后，幽灵配对与真实摆放一致', gp.fixed === true && gp.fixed === gp.real, JSON.stringify(gp));

// ===== 插入配对：3 号放在已配对的 1、2 中间 =====
// 1@(0,0)朝东 与 2@(6,0)朝西 已配对；3 号(3,0)插中间
function insertMiddle() {
  const { PipeToGround, __ents } = buildPair(UG_SRC, PIPE_SRC);
  __ents.clear();
  const mk = (x, dir) => { const p = new PipeToGround('pipe-to-ground', x, 0); p.dir = dir; __ents.set(x + ',0', p); return p; };
  const p1 = mk(0, 0), p2 = mk(6, 2);
  const pairedBefore = p1.findMate() === p2 && p2.findMate() === p1;
  // 幽灵预览：3 号（朝西）在 (3,0)，未铺设
  const ghost = new PipeToGround('pipe-to-ground', 3, 0); ghost.dir = 2;
  const ghostMate = ghost.findMate();
  // 放置后：把 3 号真实铺进去
  const p3 = mk(3, 2);
  return {
    pairedBefore,
    ghostPairs1: ghostMate === p1,
    ghostPairs2: ghostMate === p2,
    after: {
      p1Mate3: p1.findMate() === p3,
      p3Mate1: p3.findMate() === p1,
      p2Mate: p2.findMate(),
    },
  };
}
const im = insertMiddle();
console.log('插入配对（3 号插中间）:', JSON.stringify(im, (k, v) => (v && v.x !== undefined ? 'pipe@' + v.x : v)));
check('插入前 1-2 保持配对', im.pairedBefore === true, 'pairedBefore=' + im.pairedBefore);
check('幽灵预览：3 号可配对（预测放置后与 1 配对）', im.ghostPairs1 === true && im.ghostPairs2 === false, 'ghostMate=' + (im.ghostPairs1 ? 'p1' : (im.ghostPairs2 ? 'p2' : 'null')));
check('放置后 1-3 配对', im.after.p1Mate3 === true && im.after.p3Mate1 === true, JSON.stringify(im.after));
check('放置后 1-2 自然断开（2 号失配）', im.after.p2Mate === null, 'p2Mate=' + (im.after.p2Mate ? '有' : 'null'));

// ===== 口对口 vs 背对背：只有背靠背才配对、才显示配对框 =====
function mouthVsBack() {
  const { PipeToGround, __ents } = buildPair(UG_SRC, PIPE_SRC);
  __ents.clear();
  const mk = (x, dir) => { const p = new PipeToGround('pipe-to-ground', x, 0); p.dir = dir; __ents.set(x + ',0', p); return p; };
  // 口对口（隔空、朝向相背）：1@0 朝西、2@3 朝东 → 各自朝向相反方向，不配对
  const a1 = mk(0, 2), a2 = mk(3, 0);
  const mouthGap = { m1: a1.findMate(), m2: a2.findMate(), p1: a1.isPaired(), p2: a2.isPaired() };
  __ents.clear();
  // 紧挨口对口（距离 1）：3@0 朝西、4@1 朝东 → 不配对，但管口相邻可直接互通
  const b1 = mk(0, 2), b2 = mk(1, 0);
  const mouthAdj = { m1: b1.findMate(), m2: b2.findMate(), p1: b1.isPaired(), p2: b2.isPaired(), opp: b1._adjacentMouthOpposite() === b2 };
  __ents.clear();
  // 背靠背（距离 3）：5@0 朝东、6@3 朝西 → 配对
  const c1 = mk(0, 0), c2 = mk(3, 2);
  const backPair = { m1: c1.findMate() === c2, m2: c2.findMate() === c1 };
  return { mouthGap, mouthAdj, backPair };
}
const mv = mouthVsBack();
console.log('口对口/背对背:', JSON.stringify(mv, (k, v) => (v && v.x !== undefined ? 'pipe@' + v.x : v)));
check('口对口（隔空）：不配对、无配对端', mv.mouthGap.m1 === null && mv.mouthGap.m2 === null && !mv.mouthGap.p1 && !mv.mouthGap.p2, JSON.stringify(mv.mouthGap));
check('口对口（紧挨）：仍不配对', !mv.mouthAdj.p1 && !mv.mouthAdj.p2, JSON.stringify(mv.mouthAdj));
check('口对口（紧挨）：管口相邻可直接互通', mv.mouthAdj.opp === true, 'opp=' + mv.mouthAdj.opp);
check('背靠背：配对（绿色框线只在此显示）', mv.backPair.m1 && mv.backPair.m2, JSON.stringify(mv.backPair));

// ===== 背靠背紧挨（距离 1、无间隔）：也要配对连通 =====
function backAdjacent() {
  const { PipeToGround, __ents } = buildPair(UG_SRC, PIPE_SRC);
  __ents.clear();
  const mk = (x, dir) => { const p = new PipeToGround('pipe-to-ground', x, 0); p.dir = dir; __ents.set(x + ',0', p); return p; };
  const a = mk(0, 0), b = mk(1, 2);   // 朝东 + 朝西，紧挨背靠背
  return { m1: a.findMate() === b, m2: b.findMate() === a, p1: a.isPaired(), p2: b.isPaired() };
}
const ba = backAdjacent();
console.log('背靠背紧挨:', JSON.stringify(ba));
check('背靠背紧挨（距离 1）：双向配对连通', ba.m1 && ba.m2 && ba.p1 && ba.p2, JSON.stringify(ba));

process.exit(fail ? 1 : 0);
