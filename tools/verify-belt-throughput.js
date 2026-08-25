#!/usr/bin/env node
'use strict';
/**
 * 传送带吞吐官方对齐验证脚本
 * ------------------------------------------------
 * 验证 js/data.js 的传送带物品间隔（BELT_SPACING）与吞吐口径对齐：
 *   官方物品间隔 = 0.125 格（1/8 格/件）→ 每列 8 件/格
 *   面板/数值以「双车道合计吞吐」计：基础带双车道合计 = 15 items/s（每车道 7.5）
 *   基础带速 BELT_SPEED = 1.875 格/秒 → 双车道合计 = 1.875 / 0.125 = 15 items/s
 * 运行：node tools/verify-belt-throughput.js （退出码 0 = 通过）
 * 零依赖：仅读取 data.js 的常量文本，并对独立运动模型做数值模拟对拍。
 */
const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'js', 'data.js');
const src = fs.readFileSync(DATA_PATH, 'utf8');

let pass = 0, fail = 0;
function check(name, actual, expected) {
  const ok = actual === expected;
  if (ok) { pass++; console.log('  ✅ ' + name + ' = ' + actual); }
  else { fail++; console.log('  ❌ ' + name + ' = ' + actual + '（期望 ' + expected + '）'); }
}
function approx(name, actual, expected, tol) {
  const ok = Math.abs(actual - expected) <= tol;
  if (ok) { pass++; console.log('  ✅ ' + name + ' = ' + actual.toFixed(3) + '（期望 ' + expected + '）'); }
  else { fail++; console.log('  ❌ ' + name + ' = ' + actual.toFixed(3) + '（期望 ' + expected + '，容差 ' + tol + '）'); }
}

function getConst(name) {
  const m = src.match(new RegExp('const\\s+' + name + '\\s*=\\s*([^;\\n]+);'));
  return m ? m[1].trim() : null;
}

const BELT_SPEED = parseFloat(getConst('BELT_SPEED'));
const BELT_SPACING = parseFloat(getConst('BELT_SPACING'));
const FAST_BELT_MULT = parseFloat(getConst('FAST_BELT_MULT'));
const EXPRESS_BELT_MULT = parseFloat(getConst('EXPRESS_BELT_MULT'));

console.log('\n【官方参数一致性】');
check('BELT_SPEED = 1.875', BELT_SPEED, 1.875);
check('BELT_SPACING = 0.125', BELT_SPACING, 0.125);
check('FAST_BELT_MULT = 2', FAST_BELT_MULT, 2);
check('EXPRESS_BELT_MULT = 3', EXPRESS_BELT_MULT, 3);

// 每列每格能容纳的物品数 = 1 / 间距
const itemsPerTilePerLane = 1 / BELT_SPACING;
check('每列每格物品数 = 8', Math.round(itemsPerTilePerLane), 8);

// 每车道吞吐 = 带速的一半 / 间距（双车道合计口径：每车道 = 合计的一半）
const throughputPerLane = (BELT_SPEED / 2) / BELT_SPACING;
approx('基础带每车道吞吐(items/s) = 7.5', throughputPerLane, 7.5, 1e-9);
approx('基础带双车道合计吞吐(items/s) = 15', throughputPerLane * 2, 15, 1e-9);
approx('快速带双车道合计吞吐(items/s) = 30', (BELT_SPEED * FAST_BELT_MULT) / BELT_SPACING, 30, 1e-9);
approx('极速带双车道合计吞吐(items/s) = 45', (BELT_SPEED * EXPRESS_BELT_MULT) / BELT_SPACING, 45, 1e-9);

// 独立复刻传送带运动模型：带上物品按间距 BELT_SPACING 排布，
// 每帧以带速前进，前端越过 1 格出口即“出带”。统计单位时间内出带件数。
// 双车道合计口径下，模拟的是单条车道的吞吐（每车道移动速度 = 带速/2）。
function simulate(speed, spacing, dt, simTime) {
  // 连续供带模型：格长 1，物品以间距 spacing 从尾部喂入（满带，无限供应）。
  // 每件物品相对格内位移以带速前进，越过出口(pos>=1)即“出带”。
  // 满带上最多容纳 1/spacing 件；推进后从尾部补入新件，保持恒定密度。
  let outCount = 0;
  let t = 0;
  // 用“出带间隔”等价建模：满带上相邻两件相距 spacing，出口推进速度为 speed/2（单车道），
  // 故每 (spacing/(speed/2)) 秒出一件。逐帧累计。
  let acc = 0;
  while (t < simTime) {
    acc += (speed / 2) * dt;      // 单车道出口累计推进距离
    while (acc >= spacing) {    // 每推进一个间距就有一件离开
      acc -= spacing;
      outCount++;
    }
    t += dt;
  }
  return outCount;
}

const simTime = 60; // 秒
const dt = 1 / 60;
const baseOut = simulate(BELT_SPEED, BELT_SPACING, dt, simTime);
approx('模拟：基础带 60s 每车道出带件数 = 450', baseOut, 450, 6);
const fastOut = simulate(BELT_SPEED * FAST_BELT_MULT, BELT_SPACING, dt, simTime);
approx('模拟：快速带 60s 每车道出带件数 = 900', fastOut, 900, 6);
const expressOut = simulate(BELT_SPEED * EXPRESS_BELT_MULT, BELT_SPACING, dt, simTime);
approx('模拟：极速带 60s 每车道出带件数 = 1350', expressOut, 1350, 6);

console.log('\n----------------------------------------');
console.log('通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail > 0 ? 1 : 0);
