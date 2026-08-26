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

const DATA_DIR = path.join(__dirname, '..', 'js');
const src = fs.readFileSync(path.join(DATA_DIR, 'data.js'), 'utf8')
  + '\n' + fs.readFileSync(path.join(DATA_DIR, 'data-items.js'), 'utf8')
  + '\n' + fs.readFileSync(path.join(DATA_DIR, 'data-recipes.js'), 'utf8');

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

// 提取单个配方的组装配方耗时（time 字段，数值部分）
function getRecipeTime(key) {
  const line = getRecipeLine(key);
  const m = line.match(/time:\s*([0-9.]+)/);
  return m ? parseFloat(m[1]) : null;
}

// 铜线：1 铜板 → 2 铜线
const cableRec = getRecipeLine('copper-cable');
check('铜线(1铜→2线)', cableRec.includes("'copper-plate': 1") && cableRec.includes("'copper-cable': 2"), true);
// 齿轮：2 铁板 → 1 齿轮
const gearRec = getRecipeLine('iron-gear-wheel');
check('齿轮(2铁→1齿)', gearRec.includes("'iron-plate': 2"), true);
// 电路板：1 铁板 + 3 铜线 → 1
const gc = getRecipeLine('electronic-circuit');
check('电路板(1铁+3线)', gc.includes("'iron-plate': 1") && gc.includes("'copper-cable': 3"), true);
// 铁杆：1 铁板 → 2 铁杆
const stick = getRecipeLine('iron-stick');
check('铁杆(1铁→2杆)', stick.includes("'iron-plate': 1"), true);

// ---- 官方核心参数 ----
console.log('\n【关键物理/数值参数对齐官方】');
function hasConst(name, val) {
  const m = src.match(new RegExp('(?:const|let)\\s+' + name + '\\s*=\\s*([^;\\n]+);'));
  return m ? (m[1].trim() === String(val)) : false;
}
// 带速取自 GAME_DATA.deviceStats（唯一数值源）
const _vm = require('vm');
const _gd = fs.readFileSync(path.join(DATA_DIR, 'data.generated.js'), 'utf8').replace('const GAME_DATA = {', 'var GAME_DATA = {');
const _ctx = {}; _vm.createContext(_ctx); _vm.runInContext(_gd, _ctx);
const _DS = (_ctx.GAME_DATA && _ctx.GAME_DATA.deviceStats) || {};
const _belt = _DS['transport-belt'], _fast = _DS['fast-transport-belt'], _expr = _DS['express-transport-belt'];
const _beltOK = _belt && typeof _belt.beltSpeed === 'number';
const _fMult = _beltOK && _fast && _belt.beltSpeed > 0 && typeof _fast.beltSpeed === 'number' ? _fast.beltSpeed / _belt.beltSpeed : null;
const _eMult = _beltOK && _expr && _belt.beltSpeed > 0 && typeof _expr.beltSpeed === 'number' ? _expr.beltSpeed / _belt.beltSpeed : null;
check('BELT_SPEED 基础带速', _beltOK && Math.abs(_belt.beltSpeed - 1.875) < 1e-9, true);
// 传送带物品间隔 0.125 格（1/8 格/件），每列 8 件/格；以「双车道合计」计 → 基础带双车道合计 15 items/s
check('BELT_SPACING 物品间隔=0.125(官方)', hasConst('BELT_SPACING', '0.125'), true);
check('FAST_BELT_MULT 快速带倍数', _fMult !== null && Math.abs(_fMult - 2) < 1e-9, true);
check('EXPRESS_BELT_MULT 极速带倍数', _eMult !== null && Math.abs(_eMult - 3) < 1e-9, true);
check('POWER_PER_ENGINE 蒸汽机功率(kW)', hasConst('POWER_PER_ENGINE', '900'), true);
check('POWER_PER_TURBINE 汽轮机功率(kW)', hasConst('POWER_PER_TURBINE', '5820'), true);  // 官方 5.82MW
check('COAL_ENERGY 煤能量', hasConst('COAL_ENERGY', '12'), true);

// ---- 建筑配方（对齐《异星工厂》官方 Wiki：锅炉/蒸汽机/抽水机/机枪炮塔/雷达）----
console.log('\n【建筑配方对齐官方】');
function assertRecipeInput(key, item, count) {
  const line = getRecipeLine(key);
  return line.includes("'" + item + "': " + count);
}
check('锅炉(0.5s+4管道+1石炉)', assertRecipeInput('boiler', 'pipe', 4) && assertRecipeInput('boiler', 'stone-furnace', 1), true);
check('蒸汽机(0.5s+8齿轮+10铁板+5管道)',
  assertRecipeInput('steam-engine', 'iron-gear-wheel', 8) &&
  assertRecipeInput('steam-engine', 'iron-plate', 10) &&
  assertRecipeInput('steam-engine', 'pipe', 5), true);
check('蒸汽机不含电路板(官方无)', !getRecipeLine('steam-engine').includes('electronic-circuit'), true);
check('抽水机(0.5s+2齿轮+3管道)', assertRecipeInput('offshore-pump', 'iron-gear-wheel', 2) && assertRecipeInput('offshore-pump', 'pipe', 3), true);
check('机枪炮塔(8s+10铜板+10齿轮+20铁板)',
  assertRecipeInput('gun-turret', 'copper-plate', 10) &&
  assertRecipeInput('gun-turret', 'iron-gear-wheel', 10) &&
  assertRecipeInput('gun-turret', 'iron-plate', 20), true);
check('雷达(0.5s+5电路板+5齿轮+10铁板)',
  assertRecipeInput('radar', 'electronic-circuit', 5) &&
  assertRecipeInput('radar', 'iron-gear-wheel', 5) &&
  assertRecipeInput('radar', 'iron-plate', 10), true);
// 电动引擎：1 引擎单元 + 2 电路板 + 15 润滑油（官方 = 15 润滑油）
check('电动引擎(1引擎+2电路板+15润滑油)',
  assertRecipeInput('electric-engine-unit', 'engine-unit', 1) &&
  assertRecipeInput('electric-engine-unit', 'electronic-circuit', 2) &&
  assertRecipeInput('electric-engine-unit', 'lubricant', 15), true);


// ---- 机械臂族（对齐《异星工厂》官方 Wiki）----
console.log('\n【机械臂族配方对齐官方】');
// 电力机械臂：1 铁板 + 1 齿轮 + 1 电路板
check('电力机械臂(1铁板+1齿轮+1电路板)',
  assertRecipeInput('inserter', 'iron-plate', 1) &&
  assertRecipeInput('inserter', 'iron-gear-wheel', 1) &&
  assertRecipeInput('inserter', 'electronic-circuit', 1), true);
// 高速机械臂：1 电力机械臂 + 2 铁板（官方：1 inserter + 2 iron-plate）
check('高速机械臂(1电力机械臂+2铁板)',
  assertRecipeInput('fast-inserter', 'inserter', 1) &&
  assertRecipeInput('fast-inserter', 'iron-plate', 2), true);
// 加长机械臂：1 电力机械臂 + 1 齿轮（官方：1 inserter + 1 iron-gear-wheel）
check('加长机械臂(1电力机械臂+1齿轮)',
  assertRecipeInput('long-handed-inserter', 'inserter', 1) &&
  assertRecipeInput('long-handed-inserter', 'iron-gear-wheel', 1) &&
  !getRecipeLine('long-handed-inserter').includes('iron-plate'), true);
// 集装箱机械臂：官方 = 1 处理器（官方 0.5s + 1 processing unit）
check('集装箱机械臂(1处理器)',
  assertRecipeInput('bulk-inserter', 'processing-unit', 1), true);
// ---- 机械臂族配方耗时对齐官方（官方所有机械臂组装配方耗时均为 0.5s）----
console.log('\n【机械臂族配方耗时对齐官方】');
// 官方《异星工厂》Wiki：所有机械臂（含热能/电力/加长/高速/集装箱）
// 在组装机中的配方耗时（crafting time）均为 0.5 秒。
check('电力机械臂耗时(0.5s)', getRecipeTime('inserter'), 0.5);
check('热能机械臂耗时(0.5s)', getRecipeTime('burner-inserter'), 0.5);
check('加长机械臂耗时(0.5s)', getRecipeTime('long-handed-inserter'), 0.5);
check('高速机械臂耗时(0.5s)', getRecipeTime('fast-inserter'), 0.5);
check('集装箱机械臂耗时(0.5s)', getRecipeTime('bulk-inserter'), 0.5);

// ---- 传送带族（对齐《异星工厂》官方 Wiki）----
console.log('\n【传送带族配方对齐官方】');
// 传送带：1 铁板 + 1 齿轮 → 2 条（官方：1 iron-plate + 1 gear → 2）
check('传送带(1铁板+1齿轮→2条)',
  assertRecipeInput('transport-belt', 'iron-plate', 1) &&
  assertRecipeInput('transport-belt', 'iron-gear-wheel', 1) &&
  getRecipeLine('transport-belt').includes("'transport-belt': 2"), true);
// 快速传送带：官方 = 1 传送带 + 5 齿轮
check('快速传送带(1传送带+5齿轮)',
  assertRecipeInput('fast-transport-belt', 'transport-belt', 1) &&
  assertRecipeInput('fast-transport-belt', 'iron-gear-wheel', 5), true);
// 极速传送带：官方 = 1 快速带 + 10 齿轮 + 20 润滑油
check('极速传送带(1快速带+10齿轮+20润滑油)',
  assertRecipeInput('express-transport-belt', 'fast-transport-belt', 1) &&
  assertRecipeInput('express-transport-belt', 'iron-gear-wheel', 10) &&
  assertRecipeInput('express-transport-belt', 'lubricant', 20), true);
// 分流器：官方 = 5 电路板 + 5 铁板 + 4 传送带 → 1
check('分流器(5电路板+5铁板+4传送带)',
  assertRecipeInput('splitter', 'electronic-circuit', 5) &&
  assertRecipeInput('splitter', 'iron-plate', 5) &&
  assertRecipeInput('splitter', 'transport-belt', 4), true);
// 地下传送带：官方 = 10 铁板 + 5 传送带 → 2
check('地下传送带(10铁板+5传送带→2)',
  assertRecipeInput('underground-belt', 'iron-plate', 10) &&
  assertRecipeInput('underground-belt', 'transport-belt', 5) &&
  getRecipeLine('underground-belt').includes("'underground-belt': 2"), true);
// 快速地下传送带：官方 = 40 齿轮 + 2 地下带 → 2
check('快速地下传送带(40齿轮+2地下带→2)',
  assertRecipeInput('fast-underground-belt', 'iron-gear-wheel', 40) &&
  assertRecipeInput('fast-underground-belt', 'underground-belt', 2) &&
  getRecipeLine('fast-underground-belt').includes("'fast-underground-belt': 2"), true);

// ---- 组装机族 / 研究中心 / 电采矿机 / 铁箱 / 快速带（对齐《异星工厂》官方 Wiki）----
console.log('\n【组装机族 / 研究中心 / 电采矿机 / 铁箱配方对齐官方】');
// 组装机 I：官方 = 0.5s + 3 电路板 + 5 齿轮 + 9 铁板
check('组装机I(3电路板+5齿轮+9铁板)',
  assertRecipeInput('assembling-machine-1', 'electronic-circuit', 3) &&
  assertRecipeInput('assembling-machine-1', 'iron-gear-wheel', 5) &&
  assertRecipeInput('assembling-machine-1', 'iron-plate', 9), true);
// 组装机 II：官方 = 0.5s + 1 组装机I + 3 电路板 + 5 齿轮 + 2 钢板
check('组装机II(1组装机I+3电路板+5齿轮+2钢板)',
  assertRecipeInput('assembling-machine-2', 'assembling-machine-1', 1) &&
  assertRecipeInput('assembling-machine-2', 'electronic-circuit', 3) &&
  assertRecipeInput('assembling-machine-2', 'iron-gear-wheel', 5) &&
  assertRecipeInput('assembling-machine-2', 'steel-plate', 2), true);
// 组装机 III：官方 = 0.5s + 2 组装机II + 4 速度模块
check('组装机III(2组装机II+4速度模块)',
  assertRecipeInput('assembling-machine-3', 'assembling-machine-2', 2) &&
  assertRecipeInput('assembling-machine-3', 'speed-module', 4), true);
// 研究中心：官方 = 2s + 10 电路板 + 10 齿轮 + 4 传送带
check('研究中心(10电路板+10齿轮+4传送带)',
  assertRecipeInput('lab', 'electronic-circuit', 10) &&
  assertRecipeInput('lab', 'iron-gear-wheel', 10) &&
  assertRecipeInput('lab', 'transport-belt', 4), true);
// 电采矿机：官方 = 2s + 3 电路板 + 5 齿轮 + 10 铁板
check('电采矿机(3电路板+5齿轮+10铁板)',
  assertRecipeInput('electric-mining-drill', 'electronic-circuit', 3) &&
  assertRecipeInput('electric-mining-drill', 'iron-gear-wheel', 5) &&
  assertRecipeInput('electric-mining-drill', 'iron-plate', 10), true);
// 铁箱：官方 = 8 铁板 → 1（独立配方，非木箱升级）
check('铁箱(8铁板独立配方)',
  assertRecipeInput('iron-chest', 'iron-plate', 8) &&
  !getRecipeLine('iron-chest').includes('wooden-chest'), true);
// 木箱：官方 = 2 木材 → 1
check('木箱(2木材)',
  assertRecipeInput('wooden-chest', 'wood', 2), true);
// 钢箱：官方 = 8 钢板 → 1
check('钢箱(8钢板)', assertRecipeInput('steel-chest', 'steel-plate', 8), true);
// 修理包：官方 = 0.5s + 2 电路板 + 2 齿轮
check('修理包(2电路板+2齿轮)',
  assertRecipeInput('repair-pack', 'electronic-circuit', 2) &&
  assertRecipeInput('repair-pack', 'iron-gear-wheel', 2), true);

// ---- 生产建筑/电力建筑配方对齐官方（本次数据修正）----
console.log('\n【生产/电力建筑配方对齐官方】');
// 电炉：官方 = 5s + 5 高级电路板 + 10 钢板 + 10 石砖
check('电炉(5高级电路板+10钢板+10石砖)',
  assertRecipeInput('electric-furnace', 'advanced-circuit', 5) &&
  assertRecipeInput('electric-furnace', 'steel-plate', 10) &&
  assertRecipeInput('electric-furnace', 'stone-brick', 10), true);
// 化工厂：官方 = 5s + 5 电路板 + 5 齿轮 + 5 管道 + 5 钢板
check('化工厂(5电路板+5齿轮+5管道+5钢板)',
  assertRecipeInput('chemical-plant', 'electronic-circuit', 5) &&
  assertRecipeInput('chemical-plant', 'iron-gear-wheel', 5) &&
  assertRecipeInput('chemical-plant', 'pipe', 5) &&
  assertRecipeInput('chemical-plant', 'steel-plate', 5), true);
// 炼油厂：官方 = 8s + 10 电路板 + 10 齿轮 + 10 管道 + 15 钢板 + 10 石砖
check('炼油厂(10电路板+10齿轮+10管道+15钢板+10石砖)',
  assertRecipeInput('oil-refinery', 'electronic-circuit', 10) &&
  assertRecipeInput('oil-refinery', 'iron-gear-wheel', 10) &&
  assertRecipeInput('oil-refinery', 'pipe', 10) &&
  assertRecipeInput('oil-refinery', 'steel-plate', 15) &&
  assertRecipeInput('oil-refinery', 'stone-brick', 10), true);
// 变电站：官方 = 0.5s + 5 高级电路板 + 6 铜线 + 10 钢板
check('变电站(5高级电路板+6铜线+10钢板)',
  assertRecipeInput('substation', 'advanced-circuit', 5) &&
  assertRecipeInput('substation', 'copper-cable', 6) &&
  assertRecipeInput('substation', 'steel-plate', 10), true);
// 蓄电器：官方 = 10s + 5 电池 + 2 铁板
check('蓄电器(5电池+2铁板)',
  assertRecipeInput('accumulator', 'battery', 5) &&
  assertRecipeInput('accumulator', 'iron-plate', 2), true);


// ---- 后期科学包与火箭中间件配方对齐官方（本次数据修正）----
console.log('\n【后期科学包 / 火箭中间件配方对齐官方】');
// 产能科学包（紫瓶）：官方 = 30 铁轨 + 1 电炉 + 1 产能模块（craft 21s）
check('产能科学包(30铁轨+1电炉+1产能模块)',
  assertRecipeInput('production-science-pack', 'rail', 30) &&
  assertRecipeInput('production-science-pack', 'electric-furnace', 1) &&
  assertRecipeInput('production-science-pack', 'productivity-module', 1), true);
// 低密度结构：官方 = 15s + 20 铜板 + 5 塑料板 + 2 钢板
check('低密度结构(20铜板+5塑料板+2钢板)',
  assertRecipeInput('low-density-structure', 'copper-plate', 20) &&
  assertRecipeInput('low-density-structure', 'plastic-bar', 5) &&
  assertRecipeInput('low-density-structure', 'steel-plate', 2), true);
// 实用科学包（黄瓶）：官方 = 1 飞行机器人框架 + 3 低密度结构 + 2 处理器
check('实用科学包(1飞行框架+3低密度+2处理器)',
  assertRecipeInput('utility-science-pack', 'flying-robot-frame', 1) &&
  assertRecipeInput('utility-science-pack', 'low-density-structure', 3) &&
  assertRecipeInput('utility-science-pack', 'processing-unit', 2), true);

console.log('\n----------------------------------------');
console.log('通过 ' + passCount + ' 项，失败 ' + failCount + ' 项');
process.exit(failCount > 0 ? 1 : 0);
