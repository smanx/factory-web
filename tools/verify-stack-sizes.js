#!/usr/bin/env node
'use strict';
/**
 * 物品堆叠上限（stack_size）官方对齐验证脚本
 * ------------------------------------------------
 * 用于验证物品最终生效的堆叠上限与《异星工厂》(Factorio) 官方 factorio-data 完全一致。
 *
 * 数据单源：js/data.generated.js（由 factorio-data 经 tools/generate-game-data.js 现场生成）
 * 是唯一数值源。js/data-items.js 中 STACK_SIZES 手工表仅作为「官方无该物品 stack_size」时
 * 的兜底默认（如 satellite、stone-path 等非官方 stack 条目），所有官方已有 stack_size 的物品
 * 一律由 GAME_DATA.stackSize 覆盖（见 data-items.js 尾部 GAME_DATA 桥接）。
 *
 * 本脚本按浏览器加载顺序合并 data.generated.js + data-items.js 到同一上下文，取最终生效的
 * stackSize(id)，与官方 factorio-data 值比对。官方无该条目的物品才比对手工兜底值。
 *
 * 运行：node tools/verify-stack-sizes.js
 * 退出码：0 = 全部通过；1 = 存在差异。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DATA_DIR = path.join(__dirname, '..', 'js', 'data');
// 按浏览器加载顺序：data.generated.js → data.js → data-items.js（见 index.html）
const gd = fs.readFileSync(path.join(DATA_DIR, 'data.generated.js'), 'utf8');
const datajs = fs.readFileSync(path.join(DATA_DIR, 'data.js'), 'utf8');
const items = fs.readFileSync(path.join(DATA_DIR, 'data-items.js'), 'utf8');

const sandbox = { console, Math, JSON, Set, Map, Array, Object, String, Number, Boolean, Date, RegExp, parseInt, parseFloat, global: null };
sandbox.global = sandbox;
vm.createContext(sandbox);
const probe = gd + '\n' + datajs + '\n' + items + '\n;globalThis.__stackSize=stackSize;globalThis.__GD=GAME_DATA;';
vm.runInContext(probe, sandbox, { filename: 'data-items.js' });
const stackSize = sandbox.__stackSize;
const GAME_DATA = sandbox.__GD;

let passCount = 0;
let failCount = 0;

function check(name, id, expected) {
  const actual = stackSize(id);
  const ok = actual === expected;
  if (ok) {
    passCount++;
    console.log('  ✅ ' + name + '（' + id + '） = ' + actual);
  } else {
    failCount++;
    console.log('  ❌ ' + name + '（' + id + '） = ' + actual + '（期望 ' + expected + '，官方 factorio-data）');
  }
}

// 以官方 GAME_DATA 为准的检查项（若官方无该条目则用兜底期望）
const RAW_MAT = ['iron-ore','copper-ore','coal','stone','uranium-ore','calcite'];
const checks = [
  ['原材料-铁矿石', 'iron-ore', GAME_DATA.stackSize['iron-ore'] ?? 50],
  ['原材料-铜矿石', 'copper-ore', GAME_DATA.stackSize['copper-ore'] ?? 50],
  ['原材料-煤', 'coal', GAME_DATA.stackSize['coal'] ?? 50],
  ['原材料-石头', 'stone', GAME_DATA.stackSize['stone'] ?? 50],
  ['原材料-铀矿石', 'uranium-ore', GAME_DATA.stackSize['uranium-ore'] ?? 50],
  ['原材料-方解石', 'calcite', GAME_DATA.stackSize['calcite'] ?? 50],
  ['固体燃料', 'solid-fuel', GAME_DATA.stackSize['solid-fuel'] ?? 50],
  ['硫磺', 'sulfur', GAME_DATA.stackSize['sulfur'] ?? 50],
  ['铀-235', 'uranium-235', GAME_DATA.stackSize['uranium-235'] ?? 50],
  ['铀-238', 'uranium-238', GAME_DATA.stackSize['uranium-238'] ?? 50],
  ['木材', 'wood', GAME_DATA.stackSize['wood'] ?? 100],
  ['生鱼', 'raw-fish', GAME_DATA.stackSize['raw-fish'] ?? 100],
  ['石砖', 'stone-brick', GAME_DATA.stackSize['stone-brick'] ?? 100],
  ['火箭燃料', 'rocket-fuel', GAME_DATA.stackSize['rocket-fuel'] ?? 10],
  ['低密度结构', 'low-density-structure', GAME_DATA.stackSize['low-density-structure'] ?? 10],
  ['普通炮弹', 'cannon-shell', GAME_DATA.stackSize['cannon-shell'] ?? 100],
  ['爆炸炮弹', 'explosive-cannon-shell', GAME_DATA.stackSize['explosive-cannon-shell'] ?? 100],
  ['铀炮弹', 'uranium-cannon-shell', GAME_DATA.stackSize['uranium-cannon-shell'] ?? 100],
  ['炮兵炮弹', 'artillery-shell', GAME_DATA.stackSize['artillery-shell'] ?? 1],
  ['原子弹', 'atomic-bomb', GAME_DATA.stackSize['atomic-bomb'] ?? 10],
  ['火箭弹', 'rocket', GAME_DATA.stackSize['rocket'] ?? 1],
  ['核反应堆', 'nuclear-reactor', GAME_DATA.stackSize['nuclear-reactor'] ?? 10],
  ['汽车', 'car', GAME_DATA.stackSize['car'] ?? 1],
  ['坦克', 'tank', GAME_DATA.stackSize['tank'] ?? 1],
  ['蜘蛛机器人', 'spidertron', GAME_DATA.stackSize['spidertron'] ?? 1],
  ['核燃料', 'nuclear-fuel', GAME_DATA.stackSize['nuclear-fuel'] ?? 1],
  ['铀燃料棒', 'uranium-fuel-cell', GAME_DATA.stackSize['uranium-fuel-cell'] ?? 1],
  ['贫化铀燃料棒', 'depleted-uranium-fuel-cell', GAME_DATA.stackSize['depleted-uranium-fuel-cell'] ?? 50],
  ['火箭发射井', 'rocket-silo', GAME_DATA.stackSize['rocket-silo'] ?? 1],
  ['车头', 'locomotive', GAME_DATA.stackSize['locomotive'] ?? 5],
  ['货运车厢', 'cargo-wagon', GAME_DATA.stackSize['cargo-wagon'] ?? 5],
  ['流体车厢', 'fluid-wagon', GAME_DATA.stackSize['fluid-wagon'] ?? 5],
  ['炮兵车厢', 'artillery-wagon', GAME_DATA.stackSize['artillery-wagon'] ?? 5],
  ['红色科学包', 'automation-science-pack', GAME_DATA.stackSize['automation-science-pack'] ?? 200],
  ['绿色科学包', 'logistic-science-pack', GAME_DATA.stackSize['logistic-science-pack'] ?? 200],
  ['蓝色科学包', 'chemical-science-pack', GAME_DATA.stackSize['chemical-science-pack'] ?? 200],
  ['军事科学包', 'military-science-pack', GAME_DATA.stackSize['military-science-pack'] ?? 200],
  ['产能科学包', 'production-science-pack', GAME_DATA.stackSize['production-science-pack'] ?? 200],
  ['实用科学包', 'utility-science-pack', GAME_DATA.stackSize['utility-science-pack'] ?? 200],
  ['空间科学包', 'space-science-pack', GAME_DATA.stackSize['space-science-pack'] ?? 200],
  ['空桶', 'barrel', GAME_DATA.stackSize['barrel'] ?? 10],
  ['原油桶', 'crude-oil-barrel', GAME_DATA.stackSize['crude-oil-barrel'] ?? 10],
];

console.log('【物品堆叠上限（官方 factorio-data 对齐）】');
for (const [name, id, expected] of checks) check(name, id, expected);

// 兜底默认校验：官方无 stack_size 条目，验证手工兜底生效
console.log('\n【官方无 stack_size 的兜底默认】');
check('卫星（官方无 stack，兜底=1）', 'satellite', 1);
check('石径（官方无 stack，兜底=100）', 'stone-path', 100);

console.log('\n----------------------------------------');
console.log('通过 ' + passCount + ' 项，失败 ' + failCount + ' 项');
process.exit(failCount > 0 ? 1 : 0);
