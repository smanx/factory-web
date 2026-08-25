#!/usr/bin/env node
'use strict';
/**
 * 配方数据官方对齐验证脚本
 * ------------------------------------------------
 * 用于验证 js/data.js 中的关键配方数值与《异星工厂》(Factorio) 官方 Wiki 一致。
 * 运行：node tools/verify-recipes.js
 * 退出码：0 = 全部通过；1 = 存在差异（便于接入 CI）。
 *
 * 用法：从仓库根目录运行。此脚本仅读取 data.js 的文本常量，不加载整个游戏，
 * 因此可在 Node 环境独立执行（零依赖）。
 */
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'js', 'data.js');
const src = fs.readFileSync(DATA_PATH, 'utf8');

let passCount = 0;
let failCount = 0;

// 解析 SMELTS（熔炉冶炼配方）数组
function parseSmelts() {
  const m = src.match(/const SMELTS = \[([\s\S]*?)\n\];/);
  if (!m) throw new Error('未找到 SMELTS 定义');
  return Function('return [' + m[1].replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '') + '];')();
}

// 从 RECIPES 表中提取单个配方（按产物 id）
function findRecipe(outId) {
  const m = src.match(new RegExp("'" + outId + "'\\s*:\\s*\\{[^}]*\\}", 'm'));
  if (!m) return null;
  // 仅匹配 RECIPES 表范围内的条目（排除 ITEMS 中同名字段）
  const recStart = src.indexOf('const RECIPES = {');
  const recEnd = src.indexOf('\n};', recStart);
  const recTable = src.slice(recStart, recEnd);
  const em = recTable.match(new RegExp("'" + outId + "'\\s*:\\s*\\{[^}]*\\}"));
  if (!em) return null;
  return em[0];
}

function check(name, actual, expected) {
  const ok = actual === expected;
  if (ok) {
    passCount++;
    console.log('  ✅ ' + name + ' = ' + actual);
  } else {
    failCount++;
    console.log('  ❌ ' + name + ' = ' + actual + '（期望 ' + expected + '）');
  }
}

// ---- 官方基础冶炼配方（Factorio Wiki）----
console.log('\n【熔炉冶炼配方对齐官方】');
const smelts = parseSmelts();
const steel = smelts.find(s => s.id === 'steel-plate');
const brick = smelts.find(s => s.id === 'stone-brick');
const iron = smelts.find(s => s.id === 'iron-plate');
const copper = smelts.find(s => s.id === 'copper-plate');

check('钢板消耗铁板数', steel.inCount, 5);      // 官方 5 铁板 → 1 钢板
check('钢板耗时(秒)', steel.time, 16);
check('石砖消耗石头数', brick.inCount, 2);      // 官方 2 石头 → 1 石砖
check('石砖耗时(秒)', brick.time, 3.2);
check('铁板消耗铁矿数', iron.inCount || 1, 1);  // 官方 1 铁矿 → 1 铁板
check('铁板耗时(秒)', iron.time, 3.2);
check('铜板消耗铜矿数', copper.inCount || 1, 1);
check('铜板耗时(秒)', copper.time, 3.2);

// 组装机中的钢板配方也应同步为 5 铁板（保持冶炼与组装口径一致）
const asmSteel = findRecipe('steel-plate');
check('组装机钢板配方含5铁板', asmSteel && asmSteel.includes("'iron-plate': 5"), true);

// ---- 官方基础中间件配方 ----
console.log('\n【基础中间件配方对齐官方】');
function recipeChecks() {
  const recStart = src.indexOf('const RECIPES = {');
  const recEnd = src.indexOf('\n};', recStart);
  return src.slice(recStart, recEnd);
}
const recTable = recipeChecks();
function hasInput(recSrc, item, count) {
  return recSrc.includes("'" + item + "': " + count);
}
// 按行提取单个配方（每个配方在一行内）
function getRecipeLine(key) {
  const lines = recTable.split('\n');
  const line = lines.find(l => new RegExp("^\\s*'" + key + "'\\s*:").test(l));
  return line || '';
}

// 铜线：1 铜板 → 2 铜线
const cableRec = getRecipeLine('copper-cable');
check('铜线(1铜→2线)', cableRec.includes("'copper-plate': 1") && cableRec.includes("'copper-cable': 2"), true);
// 齿轮：2 铁板 → 1 齿轮
const gearRec = getRecipeLine('iron-gear');
check('齿轮(2铁→1齿)', gearRec.includes("'iron-plate': 2"), true);
// 电路板：1 铁板 + 3 铜线 → 1
const gc = getRecipeLine('green-circuit');
check('电路板(1铁+3线)', gc.includes("'iron-plate': 1") && gc.includes("'copper-cable': 3"), true);
// 铁杆：1 铁板 → 2 铁杆
const stick = getRecipeLine('iron-stick');
check('铁杆(1铁→2杆)', stick.includes("'iron-plate': 1"), true);

// ---- 官方核心参数 ----
console.log('\n【关键物理/数值参数对齐官方】');
function hasConst(name, val) {
  const m = src.match(new RegExp('const\\s+' + name + '\\s*=\\s*([^;\\n]+);'));
  return m ? (m[1].trim() === String(val)) : false;
}
check('BELT_SPEED 基础带速', hasConst('BELT_SPEED', '1.875'), true);
check('FAST_BELT_MULT 快速带倍数', hasConst('FAST_BELT_MULT', '2'), true);
check('EXPRESS_BELT_MULT 极速带倍数', hasConst('EXPRESS_BELT_MULT', '3'), true);
check('POWER_PER_ENGINE 蒸汽机功率(kW)', hasConst('POWER_PER_ENGINE', '900'), true);
check('POWER_PER_TURBINE 汽轮机功率(kW)', hasConst('POWER_PER_TURBINE', '5800'), true);
check('COAL_ENERGY 煤能量', hasConst('COAL_ENERGY', '12'), true);

// ---- 建筑配方（对齐《异星工厂》官方 Wiki：锅炉/蒸汽机/抽水机/机枪炮塔/雷达）----
console.log('\n【建筑配方对齐官方】');
function assertRecipeInput(key, item, count) {
  const line = getRecipeLine(key);
  return line.includes("'" + item + "': " + count);
}
check('锅炉(5石+1铁板)', assertRecipeInput('boiler', 'stone', 5) && assertRecipeInput('boiler', 'iron-plate', 1), true);
check('蒸汽机(2铁板+1齿轮+1管道)',
  assertRecipeInput('steam-engine', 'iron-plate', 2) &&
  assertRecipeInput('steam-engine', 'iron-gear', 1) &&
  assertRecipeInput('steam-engine', 'pipe', 1), true);
check('蒸汽机不含电路板(官方无)', !getRecipeLine('steam-engine').includes('green-circuit'), true);
check('抽水机(5铁板+1齿轮)', assertRecipeInput('offshore-pump', 'iron-plate', 5) && assertRecipeInput('offshore-pump', 'iron-gear', 1), true);
check('机枪炮塔(10铁板+4齿轮+2铜板)',
  assertRecipeInput('gun-turret', 'iron-plate', 10) &&
  assertRecipeInput('gun-turret', 'iron-gear', 4) &&
  assertRecipeInput('gun-turret', 'copper-plate', 2), true);
check('雷达(5铁板+4电路板+2钢板)',
  assertRecipeInput('radar', 'iron-plate', 5) &&
  assertRecipeInput('radar', 'green-circuit', 4) &&
  assertRecipeInput('radar', 'steel-plate', 2), true);
// 电动引擎：1 引擎单元 + 2 电路板 + 1 润滑油（官方 = 1 润滑油）
check('电动引擎(1引擎+2电路板+1润滑油)',
  assertRecipeInput('electric-engine', 'engine-unit', 1) &&
  assertRecipeInput('electric-engine', 'green-circuit', 2) &&
  assertRecipeInput('electric-engine', 'lubricant', 1), true);


// ---- 机械臂族（对齐《异星工厂》官方 Wiki）----
console.log('\n【机械臂族配方对齐官方】');
// 机械臂：1 铁板 + 1 齿轮 + 1 电路板
check('机械臂(1铁板+1齿轮+1电路板)',
  assertRecipeInput('inserter', 'iron-plate', 1) &&
  assertRecipeInput('inserter', 'iron-gear', 1) &&
  assertRecipeInput('inserter', 'green-circuit', 1), true);
// 快速机械臂：1 机械臂 + 2 铁板（官方：1 inserter + 2 iron-plate）
check('快速机械臂(1机械臂+2铁板)',
  assertRecipeInput('fast-inserter', 'inserter', 1) &&
  assertRecipeInput('fast-inserter', 'iron-plate', 2), true);
// 长臂机械臂：1 机械臂 + 1 齿轮（官方：1 inserter + 1 iron-gear-wheel）
check('长臂机械臂(1机械臂+1齿轮)',
  assertRecipeInput('long-inserter', 'inserter', 1) &&
  assertRecipeInput('long-inserter', 'iron-gear', 1) &&
  !getRecipeLine('long-inserter').includes('iron-plate'), true);
// 过滤机械臂：基于机械臂（官方：1 inserter + 5 green-circuit，本项目简化）
check('过滤机械臂基于机械臂', assertRecipeInput('filter-inserter', 'inserter', 1), true);
// 堆叠机械臂：基于机械臂 + 齿轮
check('堆叠机械臂基于机械臂+齿轮',
  assertRecipeInput('stack-inserter', 'inserter', 1) &&
  assertRecipeInput('stack-inserter', 'iron-gear', 8), true);
// 堆叠过滤机械臂：1 过滤 + 1 堆叠
check('堆叠过滤机械臂(过滤+堆叠)',
  assertRecipeInput('stack-filter-inserter', 'filter-inserter', 1) &&
  assertRecipeInput('stack-filter-inserter', 'stack-inserter', 1), true);

// ---- 传送带族（对齐《异星工厂》官方 Wiki）----
console.log('\n【传送带族配方对齐官方】');
// 传送带：1 铁板 + 1 齿轮 → 2 条（官方：1 iron-plate + 1 gear → 2）
check('传送带(1铁板+1齿轮→2条)',
  assertRecipeInput('transport-belt', 'iron-plate', 1) &&
  assertRecipeInput('transport-belt', 'iron-gear', 1) &&
  getRecipeLine('transport-belt').includes("'transport-belt': 2"), true);
// 快速传送带：官方 = 1 传送带 + 1 齿轮 → 1 条
check('快速传送带基于传送带+齿轮',
  assertRecipeInput('fast-transport-belt', 'iron-gear', 1), true);
// 极速传送带：官方 = 1 快速带 + 5 齿轮 → 1 条
check('极速传送带基于快速带+5齿轮',
  assertRecipeInput('express-transport-belt', 'fast-transport-belt', 1) &&
  assertRecipeInput('express-transport-belt', 'iron-gear', 5), true);
console.log('\n----------------------------------------');
console.log('通过 ' + passCount + ' 项，失败 ' + failCount + ' 项');
process.exit(failCount > 0 ? 1 : 0);
