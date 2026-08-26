#!/usr/bin/env node
'use strict';
/**
 * 核能配方官方对齐验证脚本
 * ------------------------------------------------
 * 验证 js/data.js 中核能链路配方的数值与《异星工厂》(Factorio 1.1) 官方 Wiki 一致：
 *   - 离心机：铀矿处理 / Kovarex 富集 / 废燃料再生
 *   - 组装机：核燃料 / 铀燃料棒
 * 运行：node tools/verify-nuclear.js
 * 退出码：0 = 全部通过；1 = 存在差异（便于接入 CI）。
 * 零依赖：仅读取 data.js 的 RECIPES / CENTRIFUGE_RECIPES 文本常量。
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'js');
const src = fs.readFileSync(path.join(DATA_DIR, 'data.js'), 'utf8')
  + '\n' + fs.readFileSync(path.join(DATA_DIR, 'data-items.js'), 'utf8')
  + '\n' + fs.readFileSync(path.join(DATA_DIR, 'data-recipes.js'), 'utf8');
// 核反应堆设备参数取自 js/devices/nuclear.js（温度上限/燃料槽等设备行为）
const nuclearSrc = fs.readFileSync(path.join(DATA_DIR, 'devices', 'nuclear.js'), 'utf8');
const inserterSrc = fs.readFileSync(path.join(DATA_DIR, 'devices', 'inserter.js'), 'utf8');

let passCount = 0;
let failCount = 0;

// 提取指定配方对象（跨行），在 RECIPES 或 CENTRIFUGE_RECIPES 表内查找
function findRecipeObj(tableName, id) {
  const start = src.indexOf('const ' + tableName + ' = {');
  if (start < 0) return null;
  const end = src.indexOf('\n};', start);
  const table = src.slice(start, end);
  // 匹配 'id': { ... }，允许跨行、花括号嵌套
  const re = new RegExp("'" + id + "'\\s*:\\s*\\{", 'm');
  const m = table.match(re);
  if (!m) return null;
  // 从匹配起点向后做括号配对，找到闭合的 } 之前
  let i = table.indexOf('{', m.index);
  let depth = 0;
  let j = i;
  for (; j < table.length; j++) {
    const c = table[j];
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) break; }
  }
  const seg = table.slice(m.index, j + 1);
  // 提取字段
  const time = (seg.match(/time:\s*([0-9.]+)/) || [])[1];
  const inp = {};
  const out = {};
  const prob = {};
  (seg.match(/inp:\s*\{(.*?)\}/s) || [])[1]?.replace(/'([a-z0-9-]+)':\s*([0-9.]+)/g, (_, k, v) => { inp[k] = +v; return ''; });
  (seg.match(/out:\s*\{(.*?)\}/s) || [])[1]?.replace(/'([a-z0-9-]+)':\s*([0-9.]+)/g, (_, k, v) => { out[k] = +v; return ''; });
  (seg.match(/prob:\s*\{(.*?)\}/s) || [])[1]?.replace(/'([a-z0-9-]+)':\s*([0-9.]+)/g, (_, k, v) => { prob[k] = +v; return ''; });
  return { id, time: time ? +time : null, inp, out, prob };
}

function check(name, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passCount++; console.log('  ✅ ' + name); }
  else { failCount++; console.log('  ❌ ' + name + '：实际=' + JSON.stringify(actual) + ' 期望=' + JSON.stringify(expected)); }
}
function checkNum(name, actual, expected) {
  const ok = actual === expected;
  if (ok) { passCount++; console.log('  ✅ ' + name + ' = ' + actual); }
  else { failCount++; console.log('  ❌ ' + name + ' = ' + actual + '（期望 ' + expected + '）'); }
}

console.log('\n【铀浓缩处理（离心机）】');
const up = findRecipeObj('CENTRIFUGE_RECIPES', 'uranium-processing');
checkNum('铀浓缩处理耗时(12s)', up && up.time, 12);
checkNum('铀浓缩处理消耗铀矿(10)', up && up.inp['uranium-ore'], 10);
checkNum('铀浓缩处理概率铀-235(0.7%)', up && up.prob['uranium-235'], 0.007);
checkNum('铀浓缩处理概率铀-238(99.3%)', up && up.prob['uranium-238'], 0.993);

console.log('\n【铀增殖处理 Kovarex（离心机）】');
const kov = findRecipeObj('RECIPES', 'kovarex');
checkNum('Kovarex 耗时(60s)', kov && kov.time, 60);
checkNum('Kovarex 消耗铀-235(40)', kov && kov.inp['uranium-235'], 40);
checkNum('Kovarex 消耗铀-238(5)', kov && kov.inp['uranium-238'], 5);
checkNum('Kovarex 产出铀-235(41,净增产1)', kov && kov.out['uranium-235'], 41);
checkNum('Kovarex 产出铀-238(2)', kov && kov.out['uranium-238'], 2);

console.log('\n【乏燃料后处理（离心机）】');
const fr = findRecipeObj('CENTRIFUGE_RECIPES', 'used-fuel-reprocessing');
checkNum('乏燃料后处理耗时(60s)', fr && fr.time, 60);
checkNum('乏燃料后处理消耗废棒(5)', fr && fr.inp['used-up-uranium-fuel-cell'], 5);
checkNum('乏燃料后处理产出铀-238(3)', fr && fr.out['uranium-238'], 3);

console.log('\n【核燃料棒（组装机）对齐官方】');
const ufc = findRecipeObj('RECIPES', 'uranium-fuel-cell');
checkNum('核燃料棒耗时(10s)', ufc && ufc.time, 10);
checkNum('核燃料棒消耗铁板(10)', ufc && ufc.inp['iron-plate'], 10);
checkNum('核燃料棒消耗铀-235(1)', ufc && ufc.inp['uranium-235'], 1);
checkNum('核燃料棒消耗铀-238(19)', ufc && ufc.inp['uranium-238'], 19);
checkNum('核燃料棒产出(10)', ufc && ufc.out['uranium-fuel-cell'], 10);

console.log('\n【核反应堆（对齐官方 Wiki：最高 1000°C、燃料槽 5、耗铀燃料棒）】');
// 堆芯最高温度 = 1000°C（官方：最高温度 1000 °C）
const tempMatch = nuclearSrc.match(/this\.temp = Math\.min\((\d+),/);
checkNum('核反应堆最高温度(1000°C)', tempMatch ? +tempMatch[1] : null, 1000);
// 面板显示的温度分母也应同步为 1000
check('核反应堆面板显示最高温度(1000°C)', /\/ 1000 °C/.test(nuclearSrc), true);
// 燃料槽容量 = 5（官方：反应堆可装 5 根燃料棒）
const fuelCapMatch = nuclearSrc.match(/item === 'uranium-fuel-cell' && this\.fuel < (\d+)/);
checkNum('核反应堆燃料槽容量(5)', fuelCapMatch ? +fuelCapMatch[1] : null, 5);
// 反应堆仅接受铀燃料棒（官方：消耗 Uranium fuel cell 而非 Nuclear fuel）
check('核反应堆仅接受铀燃料棒(不接受核燃料)', /item === 'uranium-fuel-cell' && this\.fuel < \d+/.test(nuclearSrc), true);
check('核反应堆不再接受核燃料(nuclear-fuel)', !/item === 'nuclear-fuel'\|\|/.test(nuclearSrc), true);
// 机械臂可往核反应堆投入铀燃料棒（canDropAt 含 nuclear-reactor 分支）
check('机械臂可为核反应堆投放铀燃料棒', /case 'nuclear-reactor':/.test(inserterSrc) && /item === 'uranium-fuel-cell'/.test(inserterSrc), true);

console.log('\n【核燃料（组装机）对齐官方】');
const nf = findRecipeObj('RECIPES', 'nuclear-fuel');
checkNum('核燃料耗时(90s)', nf && nf.time, 90);
checkNum('核燃料消耗火箭燃料(1)', nf && nf.inp['rocket-fuel'], 1);
checkNum('核燃料消耗铀-235(1)', nf && nf.inp['uranium-235'], 1);
checkNum('核燃料产出(1)', nf && nf.out['nuclear-fuel'], 1);

console.log('\n----------------------------------------');
console.log('通过 ' + passCount + ' 项，失败 ' + failCount + ' 项');
process.exit(failCount > 0 ? 1 : 0);
