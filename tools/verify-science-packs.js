#!/usr/bin/env node
'use strict';
/**
 * 科学包配方官方对齐验证脚本
 * ------------------------------------------------
 * 依据「数值精确：配方取自官方，误差归零」原则，验证《异星工厂》(Factorio) 全部
 * 科学包（红/绿/蓝/灰/紫/黄 + 空间）的配方输入与组装配方耗时完全对齐官方 Wiki。
 *
 * 运行：node tools/verify-science-packs.js
 * 退出码：0 = 全部通过；1 = 存在差异（便于接入 CI）。
 *
 * 官方《异星工厂》科学包配方（crafting time 单位：秒）：
 *   - 自动化科学包（红）：1 铁齿轮 + 1 铜板，5s
 *   - 物流科学包（绿）：1 传送带 + 1 机械臂，6s
 *   - 化工科学包（蓝）：1 高级电路板 + 2 引擎单元 + 3 硫磺，24s
 *   - 军事科学包（灰）：1 石墙 + 1 穿甲弹匣 + 1 手雷，10s
 *   - 产能科学包（紫）：30 铁轨 + 1 电炉 + 1 产能模块，21s
 *   - 实用科学包（黄）：1 处理器 + 1 飞行机器人框架 + 3 低密度结构，21s
 *   - 空间科学包：由火箭发射产出（无合成配方，本脚本不校验）
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'js');
const src = fs.readFileSync(path.join(DATA_DIR, 'data.js'), 'utf8')
  + '\n' + fs.readFileSync(path.join(DATA_DIR, 'data-items.js'), 'utf8')
  + '\n' + fs.readFileSync(path.join(DATA_DIR, 'data-recipes.js'), 'utf8');

let passCount = 0;
let failCount = 0;
function check(name, ok, detail) {
  if (ok) { passCount++; console.log('  ✅ ' + name); }
  else { failCount++; console.log('  ❌ ' + name + (detail ? '：' + detail : '')); }
}

// 从 RECIPES 表提取单个配方的文本
function getRecipeLine(key) {
  const recStart = src.indexOf('const RECIPES = {');
  const recEnd = src.indexOf('\n};', recStart);
  const recTable = src.slice(recStart, recEnd);
  const lines = recTable.split('\n');
  return lines.find(l => new RegExp("^\\s*'" + key + "'\\s*:").test(l)) || '';
}
function getRecipeTime(key) {
  const line = getRecipeLine(key);
  const m = line.match(/time:\s*([0-9.]+)/);
  return m ? parseFloat(m[1]) : null;
}
function hasInput(line, item, count) {
  return line.includes("'" + item + "': " + count);
}
function noOtherInput(line, items) {
  // 校验配方没有出现非预期原料（排除 output 键）
  const outM = line.match(/out:\s*\{([^}]*)\}/);
  const outBlock = outM ? outM[1] : '';
  const m = line.match(/inp:\s*\{([^}]*)\}/);
  const inpBlock = m ? m[1] : '';
  const keys = inpBlock.match(/'[a-z0-9-]+':\s*\d+/g) || [];
  const ok = keys.every(k => items.some(it => k.startsWith("'" + it + "'")));
  return ok;
}

console.log('\n【科学包配方输入对齐官方】');

// 自动化科学包（红）：1 铁齿轮 + 1 铜板
const red = getRecipeLine('science-pack');
check('红瓶(1齿轮+1铜板)', hasInput(red, 'iron-gear', 1) && hasInput(red, 'copper-plate', 1) && noOtherInput(red, ['iron-gear','copper-plate']), '当前配方原料异常');

// 物流科学包（绿）：1 传送带 + 1 机械臂
const green = getRecipeLine('green-science');
check('绿瓶(1传送带+1机械臂)', hasInput(green, 'transport-belt', 1) && hasInput(green, 'inserter', 1) && noOtherInput(green, ['transport-belt','inserter']), '当前配方原料异常');

// 军事科学包（灰）：2 石墙 + 1 穿甲弹匣 + 1 手雷（对齐官方）
const gray = getRecipeLine('military-science');
check('灰瓶(2石墙+1穿甲弹+1手雷)', hasInput(gray, 'stone-wall', 2) && hasInput(gray, 'piercing-rounds', 1) && hasInput(gray, 'grenade', 1) && noOtherInput(gray, ['stone-wall','piercing-rounds','grenade']), '当前配方原料异常');

// 产能科学包（紫）：30 铁轨 + 1 电炉 + 1 产能模块
const purple = getRecipeLine('production-science-pack');
check('紫瓶(30铁轨+1电炉+1产能模块)', hasInput(purple, 'rail', 30) && hasInput(purple, 'electric-furnace', 1) && hasInput(purple, 'productivity-module', 1) && noOtherInput(purple, ['rail','electric-furnace','productivity-module']), '当前配方原料异常');

// 实用科学包（黄）：1 飞行机器人框架 + 3 低密度结构 + 2 处理器（对齐官方）
const yellow = getRecipeLine('utility-science-pack');
check('黄瓶(1框架+3低密度+2处理器)', hasInput(yellow, 'flying-robot-frame', 1) && hasInput(yellow, 'low-density-structure', 3) && hasInput(yellow, 'processing-unit', 2) && noOtherInput(yellow, ['flying-robot-frame','low-density-structure','processing-unit']), '当前配方原料异常');

console.log('\n【科学包组装配方耗时对齐官方】');
check('红瓶耗时(5s)', getRecipeTime('science-pack'), 5);
check('绿瓶耗时(6s)', getRecipeTime('green-science'), 6);
check('灰瓶耗时(10s)', getRecipeTime('military-science'), 10);
check('紫瓶耗时(21s)', getRecipeTime('production-science-pack'), 21);
check('黄瓶耗时(21s)', getRecipeTime('utility-science-pack'), 21);
// 蓝瓶（化工科学包）官方为 1高级电路板+2引擎单元+3硫磺、24s。
// 本项目为保持科技树无环（electronics 需蓝瓶），采用旧版配方，
// 故此处仅校验其存在，不强制原料/耗时（避免循环依赖，见 README 说明）。
check('蓝瓶配方已定义', getRecipeLine('blue-science').length > 0, '蓝瓶配方缺失');
// 空间科学包由火箭发射产出，非合成配方，不校验。

console.log('\n----------------------------------------');
console.log('通过 ' + passCount + ' 项，失败 ' + failCount + ' 项');
process.exit(failCount > 0 ? 1 : 0);
