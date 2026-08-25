#!/usr/bin/env node
'use strict';
/**
 * 信号塔模块规则验证脚本
 * ------------------------------------------------
 * 验证 js/devices/beacon.js 中信号塔（Beacon）的模块规则与《异星工厂》官方一致：
 *   - 信号塔只能装速度模块，产能/效率模块无法放入信号塔（官方 Beacon 仅接受速度模块）。
 * 运行：node tools/verify-beacon-modules.js
 * 退出码：0 = 全部通过；1 = 存在差异（便于接入 CI）。
 * 仅读取源文件文本常量，不加载整个游戏，零依赖。
 */
const fs = require('fs');
const path = require('path');

const BEACON_PATH = path.join(__dirname, '..', 'js', 'devices', 'beacon.js');
const src = fs.readFileSync(BEACON_PATH, 'utf8');

let passCount = 0;
let failCount = 0;
function check(name, actual, expected) {
  const ok = actual === expected;
  if (ok) { passCount++; console.log('  ✅ ' + name); }
  else { failCount++; console.log('  ❌ ' + name + '（未通过）'); }
}

console.log('\n【信号塔模块规则对齐官方】');
// 1. giveItem 必须拒绝非速度模块（moduleType(item) !== 'speed' 时返回 false）
check('giveItem 仅接受速度模块',
  src.includes("moduleType(item) !== 'speed'") ? 'ok' : 'missing', 'ok');
// 2. 面板模块按钮列表只含速度模块（不提供产能/效率模块按钮）
const panelHasOnlySpeed =
  src.indexOf("const order = ['speed-module', 'speed-module-2', 'speed-module-3'];") >= 0;
check('面板仅提供速度模块', panelHasOnlySpeed ? 'ok' : 'missing', 'ok');
// 3. 面板不应再提供产能/效率模块按钮（排除旧的三类齐全列表）
check('面板不含产能/效率模块按钮',
  !src.includes("const order = ['speed-module', 'speed-module-2', 'speed-module-3', 'productivity-module'") ? 'ok' : 'found', 'ok');
// 4. 读档迁移：restore 需剔除非法模块并掉落归还
check('读档剔除非法模块并掉落归还',
  src.includes("addGroundItem") && src.includes("moduleType(k) === 'speed'") ? 'ok' : 'missing', 'ok');

console.log('\n----------------------------------------');
console.log('通过 ' + passCount + ' 项，失败 ' + failCount + ' 项');
process.exit(failCount > 0 ? 1 : 0);
