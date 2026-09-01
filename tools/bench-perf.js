#!/usr/bin/env node
'use strict';
/**
 * 性能热点基准（临时诊断脚本）
 * 测量近期改动引入的候选性能开销，用接近真实存档的规模估算单次/每 tick 耗时：
 *   1) power.js rebuildPowerGrids（每 0.25s 一次）
 *   2) logistics updateLogistics 的 hasWork 全 G.ents 扫描（每 tick 一次）
 *   3) recomputeCircuit refreshNodeWires O(n²)（每 0.25s 一次）
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');

function bench(name, n, fn) {
  // 预热
  for (let i = 0; i < 3; i++) fn();
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < n; i++) fn();
  const t1 = process.hrtime.bigint();
  const ms = Number(t1 - t0) / 1e6;
  console.log(name + ': ' + ms.toFixed(2) + ' ms 总 / ' + (ms / n).toFixed(4) + ' ms 每次');
}

// ================= 1) power.js rebuildPowerGrids =================
console.log('\n===== 1) rebuildPowerGrids（真实存档规模：280 杆 + ~2000 设备）=====');
{
  const powerSrc = fs.readFileSync(path.join(ROOT, 'js/core/power.js'), 'utf8');
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
  const { resetPowerReg, regPowerEnt, updatePower } = sandbox;

  resetPowerReg();
  let uid = 0;
  const pole = (x, y) => { const e = { _id: ++uid, type: 'small-electric-pole', x, y, w: 1, h: 1, _dead: false }; regPowerEnt(e); return e; };
  const device = (x, y, i) => {
    const e = { _id: ++uid, type: 'asm', x, y, w: 1, h: 1, _dead: false,
      powerDemand() { return (i % 5 === 0) ? 90 : (i % 3 === 0 ? 180 : 45); } };
    regPowerEnt(e); return e;
  };
  let k = 0;
  for (let gx = 0; gx < 28 && k < 280; gx++) for (let gy = 0; gy < 10 && k < 280; gy++, k++) pole(gx * 6 + 2, gy * 6 + 2);
  for (let i = 0; i < 2000; i++) device((i % 100) * 3 + 1, Math.floor(i / 100) * 3 + 1, i);
  bench('rebuildPowerGrids/updatePower', 50, () => updatePower());
}
// 分阶段计时：复刻 rebuildPowerGrids 内部三个阶段
{
  const powerSrc = fs.readFileSync(path.join(ROOT, 'js/core/power.js'), 'utf8');
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
  const { resetPowerReg, regPowerEnt, poleWireOf, poleSupplyOf, pcx, pcy, poleCovers } = sandbox;
  resetPowerReg();
  let uid = 0;
  const poles = [];
  const devs = [];
  let k = 0;
  for (let gx = 0; gx < 28 && k < 280; gx++) for (let gy = 0; gy < 10 && k < 280; gy++, k++) { const e = { _id: ++uid, type: 'small-electric-pole', x: gx * 6 + 2, y: gy * 6 + 2, w: 1, h: 1, _dead: false }; regPowerEnt(e); poles.push(e); }
  for (let i = 0; i < 2000; i++) { const e = { _id: ++uid, type: 'asm', x: (i % 100) * 3 + 1, y: Math.floor(i / 100) * 3 + 1, w: 1, h: 1, _dead: false, powerDemand() { return 90; } }; regPowerEnt(e); devs.push(e); }
  // 空间哈希（复刻）
  const CELL = 16;
  const hmap = new Map();
  for (let i = 0; i < poles.length; i++) {
    const p = poles[i];
    const key = Math.floor(p.x / CELL) + ',' + Math.floor(p.y / CELL);
    let a = hmap.get(key); if (!a) { a = []; hmap.set(key, a); }
    a.push(i);
  }
  const buf = [];
  function nearPoles(x, y, reach) {
    buf.length = 0;
    const cx = Math.floor(x / CELL), cy = Math.floor(y / CELL), rad = Math.ceil(reach / CELL);
    for (let gx = cx - rad; gx <= cx + rad; gx++)
      for (let gy = cy - rad; gy <= cy + rad; gy++) {
        const a = hmap.get(gx + ',' + gy);
        if (a) for (let t = 0; t < a.length; t++) buf.push(a[t]);
      }
    return buf;
  }
  // 杆-杆阶段
  let nPairs = 0;
  bench('杆-杆连接判定', 100, () => {
    nPairs = 0;
    for (let i = 0; i < poles.length; i++) {
      const p = poles[i]; const w = poleWireOf(p);
      const cand = nearPoles(p.x, p.y, w);
      for (let t = 0; t < cand.length; t++) {
        const j = cand[t]; if (j <= i) continue;
        const q = poles[j];
        const d = Math.max(Math.abs(pcx(p) - pcx(q)), Math.abs(pcy(p) - pcy(q)));
        if (d <= Math.min(w, poleWireOf(q))) nPairs++;
      }
    }
  });
  // 设备-杆阶段（复刻 power.js 新「杆→设备」反转算法：设备按占地注册进 DCELL 粗格子哈希）
  // 注意：设备可能横跨多格、同一 (杆,设备) 对被多个重叠格重复命中，故用 Set 统计唯一覆盖对数。
  let nCov = 0;
  bench('设备-杆覆盖判定(新:杆→设备哈希)', 100, () => {
    const DCELL = 4;
    const dmap = new Map();
    for (let di = 0; di < devs.length; di++) {
      const e = devs[di];
      // 与 power.js 一致：右边界 +0.001 对齐闭区间判定，保证相贴边界对共享格子不漏判
      const gx0 = Math.floor(e.x / DCELL), gy0 = Math.floor(e.y / DCELL);
      const gx1 = Math.floor((e.x + (e.w || 1) + 0.001) / DCELL);
      const gy1 = Math.floor((e.y + (e.h || 1) + 0.001) / DCELL);
      for (let gy = gy0; gy <= gy1; gy++)
        for (let gx = gx0; gx <= gx1; gx++) {
          const k = gx + ',' + gy;
          let a = dmap.get(k); if (!a) { a = []; dmap.set(k, a); }
          a.push(di);
        }
    }
    const cov = new Set();
    for (let i = 0; i < poles.length; i++) {
      const p = poles[i];
      const s = poleSupplyOf(p);
      const cx = pcx(p), cy = pcy(p);
      const qx0 = cx - s, qy0 = cy - s, qx1 = cx + s, qy1 = cy + s;
      const gx0 = Math.floor((qx0 - 0.001) / DCELL), gy0 = Math.floor((qy0 - 0.001) / DCELL);
      const gx1 = Math.floor((qx1 + 0.001) / DCELL), gy1 = Math.floor((qy1 + 0.001) / DCELL);
      for (let gy = gy0; gy <= gy1; gy++)
        for (let gx = gx0; gx <= gx1; gx++) {
          const a = dmap.get(gx + ',' + gy);
          if (!a) continue;
          for (let t = 0; t < a.length; t++) {
            const e = devs[a[t]];
            const ex0 = e.x, ey0 = e.y, ex1 = e.x + (e.w || 1), ey1 = e.y + (e.h || 1);
            if (ex0 <= qx1 && ex1 >= qx0 && ey0 <= qy1 && ey1 >= qy0) cov.add(i * 100000 + a[t]);
          }
        }
    }
    nCov = cov.size;
  });
  console.log('  (杆-杆 连接对数=' + nPairs + ' 设备-杆 覆盖数=' + nCov + ')');
}

// ================= 2) hasWork 全 G.ents 扫描（每 tick）=================
console.log('\n===== 2) logistics hasWork 全 G.ents 扫描（每 tick，3955 实体）=====');
{
  class Entity {}
  class LogisticChest extends Entity {}
  class LogisticRequester extends LogisticChest {}
  class LogisticBuffer extends LogisticChest {}
  const ents = [];
  for (let i = 0; i < 3955; i++) {
    const e = new Entity(); e._dead = false;
    if (i === 1000) { const q = new LogisticRequester(); q.trashGrid = [null, null, null, null]; ents.push(q); continue; }
    if (i === 2000) { const b = new LogisticBuffer(); b.trashGrid = [null, null]; ents.push(b); continue; }
    ents.push(e);
  }
  bench('hasWork G.ents 扫描(有 requester/buffer 但回收区空)', 600, () => {
    let hasWork = false;
    for (const e of ents) {
      if (e._dead) continue;
      if (!(e instanceof LogisticRequester) && !(e instanceof LogisticBuffer)) continue;
      const tg = e.trashGrid;
      if (tg) for (const s of tg) if (s && s.count > 0) { hasWork = true; break; }
      if (hasWork) break;
    }
  });
}

// ================= 3) recomputeCircuit refreshNodeWires O(n²) =================
console.log('\n===== 3) recomputeCircuit refreshNodeWires（电路节点 N² 距离判定）=====');
{
  const N = 300;
  const nodes = [];
  for (let i = 0; i < N; i++) nodes.push({ x: (i % 30) * 6, y: Math.floor(i / 30) * 6, w: 1, h: 1, red: new Set(), green: new Set() });
  const distTo = (a, b) => Math.max(Math.abs(a.x + a.w / 2 - (b.x + b.w / 2)), Math.abs(a.y + a.h / 2 - (b.y + b.h / 2)));
  bench('refreshNodeWires(' + N + ' 节点)', 10, () => {
    for (const node of nodes) {
      node.red.clear(); node.green.clear();
      for (const o of nodes) {
        if (o === node) continue;
        const d = distTo(node, o);
        if (d <= 7.5) { node.red.add(o); node.green.add(o); }
      }
    }
  });
}

// ================= 4) 全部实体 update 循环骨架 =================
console.log('\n===== 4) 实体 update 循环骨架（3955 实体）=====');
{
  class Entity { update() {} }
  class Active extends Entity { update(dt) { this.n = (this.n || 0) + 1; } }
  const ents = [];
  for (let i = 0; i < 3955; i++) {
    if (i % 4 === 0) { const a = new Active(); a._dead = false; ents.push(a); }
    else { const e = new Entity(); e._dead = false; ents.push(e); }
  }
  bench('update 循环(含原型比较跳过静态)', 600, () => {
    for (const e of ents) {
      if (e._dead || typeof e.update !== 'function') continue;
      if (e.update === Entity.prototype.update) continue;
      e.update(1 / 60);
    }
  });
}

console.log('\n基准完成');
