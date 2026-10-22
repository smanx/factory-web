'use strict';
/**
 * 导线可视化（组合器 wires vision，P2）校验
 * ------------------------------------------------
 * 对齐《异星工厂》2.0 组合器「导线可视连接模式」：
 *   1. 默认关：常态仅显示设备间实际配置的红/绿连线；杆-杆信号线隐藏（黄线已表达）。
 *   2. G.settings.wiresVision 开启后：杆-杆红/绿信号线也强制显示，线宽/不透明度加亮。
 *   3. Alt+W 快捷键与设置面板复选框（data-set="wiresVision"）双入口。
 *
 * 运行：node tools/verify-wires-vision.js （退出码 0 = 通过）
 */
const fs = require('fs');
const path = require('path');

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name); }
}

console.log('\n【导线可视化渲染逻辑】');
const circuitSrc = fs.readFileSync('js/devices/circuit.js', 'utf8');
ok(circuitSrc.indexOf('wiresVision') >= 0, 'drawCircuitWires 读取 G.settings.wiresVision');
ok(circuitSrc.indexOf("!wiresOn && selfIsPole && isPole(o)") >= 0,
  '常态：杆-杆红/绿信号线跳过（导线可视化模式下仍显示）');
ok(circuitSrc.indexOf('wiresOn ? 0.95 : 0.7') >= 0, '导线可视化模式线加亮（alpha 0.95）');
ok(circuitSrc.indexOf('(wiresOn ? 3 : 2)') >= 0, '导线可视化模式线宽加粗（3px）');

console.log('\n【快捷键与设置面板入口】');
const inputSrc = fs.readFileSync('js/main/main-input.js', 'utf8');
ok(inputSrc.indexOf("ev.altKey && k === 'w'") >= 0, 'Alt+W 快捷键切换导线可视化');
ok(inputSrc.indexOf('G.settings.wiresVision = !G.settings.wiresVision') >= 0, '开关写入 G.settings（随设置持久化）');
const uiSrc = fs.readFileSync('js/ui/ui-panel.js', 'utf8');
ok(uiSrc.indexOf('data-set="wiresVision"') >= 0, '设置面板复选框（data-set=wiresVision）');
ok(uiSrc.indexOf('导线可视化') >= 0, '设置面板含中文说明');

console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
