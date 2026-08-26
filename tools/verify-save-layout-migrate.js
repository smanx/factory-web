#!/usr/bin/env node
'use strict';
/**
 * 旧档设备占地迁移验证脚本
 * ------------------------------------------------
 * 验证：读旧档（布局版本 <2）时，本版尺寸发生变化的设备
 *       （热交换器 3×1→3×2、汽轮机 3×3→5×3）会迁移到不与相邻实体重叠的位置，
 *       从而保证读档后每个实体都能被完整选中/拆除。
 *
 * 背景：此前热交换器占地 3×1、汽轮机 3×3；本版改为 3×2、5×3。旧档按旧尺寸摆放，
 *       读档后按新尺寸占地会与相邻设备在 G.grid 中互相覆盖，
 *       导致实体“既选不中又删不掉、却仍显示在地图上”。本脚本回归验证迁移逻辑。
 *
 * 运行：node tools/verify-save-layout-migrate.js （退出码 0 = 通过）
 * 零依赖：加载真实 core/entity.js + data-buildings.js，用真实 Entity.restore
 *         + 复刻的迁移函数断言。
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
vm.runInContext(
  prefix + '\n' + load('core/entity.js') + '\n' + load('data-buildings.js')
  + '\nglobalThis.Entity = Entity;',
  sandbox, { filename: 'entity.js' }
);

// 复刻核能设备 applyDir（与 js/devices/nuclear.js 一致）
vm.runInContext(`
class HeatExchanger extends Entity {
  applyDir() { if (this.dir % 2 === 1) { this.w = this.def.h; this.h = this.def.w; } }
}
class SteamTurbine extends Entity {
  applyDir() { if (this.dir % 2 === 1) { this.w = this.def.h; this.h = this.def.w; } }
}
globalThis.HeatExchanger = HeatExchanger;
globalThis.SteamTurbine = SteamTurbine;
`, sandbox);

// 从 js/main.js 读取并求值：复刻布局迁移函数（LAYOUT_MIGRATE_TYPES / entityOverlaps / migrateLegacyEntityLayout）
const mainJs = load('main.js');
const extract = (re) => { const m = mainJs.match(re); return m ? m[1] : null; };
const migrateTypesSrc = extract(/(const LAYOUT_MIGRATE_TYPES = \{.*?\};)/s);
const overlapsSrc = extract(/(function entityOverlaps[\s\S]*?\n\})/);
const migrateSrc = extract(/(function migrateLegacyEntityLayout[\s\S]*?\n\})/);
if (!migrateTypesSrc || !overlapsSrc || !migrateSrc) {
  console.error('❌ 无法从 js/main.js 提取迁移函数，请确认代码已添加');
  process.exit(1);
}
vm.runInContext(migrateTypesSrc + '\n' + overlapsSrc + '\n' + migrateSrc + '\nglobalThis.LAYOUT_MIGRATE_TYPES = LAYOUT_MIGRATE_TYPES;\nglobalThis.migrateLegacyEntityLayout = migrateLegacyEntityLayout;', sandbox);

function key(x, y) { return ((x + 32768) << 16) | (y + 32768); }
function entAt(x, y) { return G.grid.get(key(x, y)); }
function addEnt(e) {
  G.ents.push(e);
  for (let dy = 0; dy < e.h; dy++)
    for (let dx = 0; dx < e.w; dx++)
      G.grid.set(key(e.x + dx, e.y + dy), e);
}

let pass = 0, fail = 0;
function ok(c, n) { if (c) { pass++; console.log('  ✅ ' + n); } else { fail++; console.log('  ❌ ' + n); } }

// 模拟 applySave 中“旧档布局迁移 + addEnt”流程
function loadLegacySave(oldEnts) {
  G.grid = new Map(); G.ents = [];
  for (const s of oldEnts) {
    let e;
    if (s.type === 'heat-exchanger') e = sandbox.HeatExchanger.restore(s);
    else if (s.type === 'steam-turbine') e = sandbox.SteamTurbine.restore(s);
    else e = sandbox.Entity.restore(s);
    if (sandbox.LAYOUT_MIGRATE_TYPES[s.type]) sandbox.migrateLegacyEntityLayout(e);
    addEnt(e);
  }
  return G.ents;
}

console.log('\n【旧档核能模块（热交换器 3×1 在汽轮机 3×3 上方）读档迁移】');
// 旧档布局：两个热交换器 3×1 并排，汽轮机 3×3 在其下方，周围有管道
const legacy = [
  { type: 'heat-exchanger', x: 10, y: 20, dir: 0 },
  { type: 'heat-exchanger', x: 13, y: 20, dir: 0 },
  { type: 'steam-turbine', x: 11, y: 21, dir: 0 },
  { type: 'pipe', x: 9, y: 20, dir: 0 },
  { type: 'pipe', x: 16, y: 21, dir: 0 },
];
const ents = loadLegacySave(legacy);

// 每个实体都必须能被完整选中（每个格子 entAt 返回自身）
for (const e of ents) {
  let bad = 0;
  for (let dy = 0; dy < e.h; dy++)
    for (let dx = 0; dx < e.w; dx++)
      if (entAt(e.x + dx, e.y + dy) !== e) bad++;
  ok(bad === 0, `${e.type}@(${e.x},${e.y}) w=${e.w} h=${e.h} 迁移后全部格子可选中`);
}

// 迁移后实体占地符合新 def（热交换器 3×2 / 汽轮机 3×5）
const he = ents.filter(e => e.type === 'heat-exchanger');
ok(he.length === 2 && he.every(e => e.w === 3 && e.h === 2), '旧档热交换器迁移后占地为 3×2');
const st = ents.filter(e => e.type === 'steam-turbine');
ok(st.length === 1 && st[0].w === 3 && st[0].h === 5, '旧档汽轮机迁移后占地为 3×5');

// 汽轮机应被下移（避开热交换器向下扩展），不再与热交换器重叠
ok(st[0].y >= 22, '汽轮机被下移以避开热交换器新占地');

console.log('\n【新档（v≥2）不受迁移影响】');
// 模拟新档：实体按新 def 摆放，不重叠时迁移函数不移动它们
G.grid = new Map(); G.ents = [];
const fresh = [
  { type: 'heat-exchanger', x: 10, y: 20, dir: 0 },
  { type: 'steam-turbine', x: 10, y: 23, dir: 0 }, // 已不重叠
];
for (const s of fresh) {
  const e = s.type === 'heat-exchanger' ? sandbox.HeatExchanger.restore(s) : sandbox.SteamTurbine.restore(s);
  sandbox.migrateLegacyEntityLayout(e); // 若调用也不会误移动
  addEnt(e);
  ok(e.x === s.x && e.y === s.y, `不重叠时 ${s.type}@(${s.x},${s.y}) 保持原位（不被误移动）`);
}

console.log('\n【密集型旧档布局：不残留幻影】');
// 回归：旧版迁移用固定候选格，密集型布局（热交换器 3×2 多行密集、汽轮机 5×3 网格）下
// 候选格会被占满导致找不到空位，残留重叠实体 → “选不中删不掉却仍显示”的幻影。
// 新版改用环形扩散，必须保证迁移后每个实体占地都与其它实体不重叠、全部可选中。
function allSelectable() {
  let bad = 0;
  for (const e of G.ents) {
    for (let dy = 0; dy < e.h; dy++)
      for (let dx = 0; dx < e.w; dx++)
        if (entAt(e.x + dx, e.y + dy) !== e) bad++;
  }
  return bad;
}
// 密集型：4 行 × 5 列旧 3×1 热交换器 + 下方 3×3 汽轮机
const dense = [];
for (let row = 0; row < 4; row++) for (let col = 0; col < 5; col++) dense.push({ type: 'heat-exchanger', x: 10 + col * 3, y: 20 + row, dir: 0 });
for (let col = 0; col < 5; col++) dense.push({ type: 'steam-turbine', x: 10 + col * 3, y: 24, dir: 0 });
loadLegacySave(dense);
ok(allSelectable() === 0, '密集型热交换器 2D 布局迁移后无重叠幻影（全部可选中）');

// 密集型：汽轮机 3×3 网格 + 热交换器行
const dense2 = [];
for (let ty = 20; ty < 27; ty += 3) for (let tx = 10; tx < 19; tx += 3) dense2.push({ type: 'steam-turbine', x: tx, y: ty, dir: 0 });
for (let tx = 10; tx < 22; tx += 3) dense2.push({ type: 'heat-exchanger', x: tx, y: 19, dir: 0 });
loadLegacySave(dense2);
ok(allSelectable() === 0, '密集型汽轮机网格 + 热交换器迁移后无重叠幻影（全部可选中）');

console.log('\n----------------------------------------');
console.log(`通过 ${pass} 项，失败 ${fail} 项`);
if (fail) { console.log('❌ 存在失败断言'); process.exit(1); }
console.log('✅ 旧档设备占地迁移正确');
