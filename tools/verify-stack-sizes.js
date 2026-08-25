#!/usr/bin/env node
'use strict';
/**
 * 物品堆叠上限（stack_size）官方对齐验证脚本
 * ------------------------------------------------
 * 用于验证 js/data.js 中 STACK_SIZES 关键物品的堆叠上限与《异星工厂》(Factorio)
 * 官方 Wiki 完全一致（数值精确：堆叠）。
 *
 * 运行：node tools/verify-stack-sizes.js
 * 退出码：0 = 全部通过；1 = 存在差异（便于接入 CI）。
 *
 * 用法：从仓库根目录运行。此脚本仅读取 data.js 的文本常量，不加载整个游戏，
 * 因此可在 Node 环境独立执行（零依赖）。
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'js');
const src = fs.readFileSync(path.join(DATA_DIR, 'data-items.js'), 'utf8');

let passCount = 0;
let failCount = 0;

// 解析 STACK_SIZES 表中的单个键值（用于显式声明的堆叠）
function stackValue(id) {
  const m = src.match(new RegExp("'\\s*" + id + "\\s*':\\s*(\\d+)"));
  if (!m) return null; // 未显式声明（将走默认值 100）
  return parseInt(m[1], 10);
}

// 获取最终生效的堆叠数（与 data.js 的 stackSize() 逻辑一致：未声明默认 100）
function effectiveStack(id) {
  const v = stackValue(id);
  return (typeof v === 'number' && v > 0) ? v : 100;
}

function check(name, id, expected) {
  const actual = effectiveStack(id);
  const ok = actual === expected;
  if (ok) {
    passCount++;
    console.log('  ✅ ' + name + '（' + id + '） = ' + actual);
  } else {
    failCount++;
    console.log('  ❌ ' + name + '（' + id + '） = ' + actual + '（期望 ' + expected + '，官方 Wiki）');
  }
}

// ---- 原材料（官方 stack=50）----
console.log('\n【原材料堆叠=50（官方）】');
check('铁矿石', 'iron-ore', 50);
check('铜矿石', 'copper-ore', 50);
check('煤', 'coal', 50);
check('石头', 'stone', 50);
check('铀矿石', 'uranium-ore', 50);
check('固体燃料', 'solid-fuel', 50);
check('硫磺', 'sulfur', 50);
check('铀-235', 'uranium-235', 50);
check('铀-238', 'uranium-238', 50);

// ---- 木材 / 生鱼 / 石砖（官方 stack=100）----
console.log('\n【木材/生鱼/石砖堆叠=100（官方）】');
check('木材', 'wood', 100);
check('生鱼', 'raw-fish', 100);
check('石砖', 'stone-brick', 100);

// ---- 火箭燃料 / 低密度结构（官方 stack=10）----
console.log('\n【火箭燃料/低密度结构堆叠=10（官方）】');
check('火箭燃料', 'rocket-fuel', 10);
check('低密度结构', 'low-density-structure', 10);

// ---- 弹药（官方 stack=1）----
console.log('\n【炮弹/原子弹堆叠=1（官方）】');
check('普通炮弹', 'cannon-shell', 1);
check('爆炸炮弹', 'explosive-cannon-shell', 1);
check('铀炮弹', 'uranium-cannon-shell', 1);
check('炮兵炮弹', 'artillery-shell', 1);
check('原子弹', 'atomic-bomb', 1);

// ---- 终局单体/载具（官方 stack=1）----
console.log('\n【终局单体/载具堆叠=1（官方）】');
check('火箭', 'rocket', 1);
check('卫星', 'satellite', 1);
check('核反应堆', 'nuclear-reactor', 1);
check('汽车', 'car', 1);
check('坦克', 'tank', 1);
check('蜘蛛机器人', 'spidertron', 1);
check('核燃料', 'nuclear-fuel', 1);
check('火箭发射井', 'rocket-silo', 1);

// ---- 科学包（官方 stack=200）----
console.log('\n【科学包堆叠=200（官方）】');
check('红色科学包', 'science-pack', 200);
check('绿色科学包', 'green-science', 200);
check('蓝色科学包', 'blue-science', 200);
check('军事科学包', 'military-science', 200);
check('产能科学包', 'production-science-pack', 200);
check('实用科学包', 'utility-science-pack', 200);
check('空间科学包', 'space-science-pack', 200);

// ---- 流体桶（官方 stack=10）----
console.log('\n【流体桶堆叠=10（官方）】');
check('空桶', 'empty-barrel', 10);
check('原油桶', 'crude-oil-barrel', 10);

console.log('\n----------------------------------------');
console.log('通过 ' + passCount + ' 项，失败 ' + failCount + ' 项');
process.exit(failCount > 0 ? 1 : 0);
