#!/usr/bin/env node
// 一键全量回归：顺序执行全部数据/物理参数校验脚本。
// 任一失败即退出非零，作为提交前的执行闭环关口。
// 用法：node tools/run-verify.js
const { spawnSync } = require('node:child_process');
const path = require('node:path');

const scripts = [
  'tools/verify-recipes.js',
  'tools/verify-science-packs.js',
  'tools/verify-stack-sizes.js',
  'tools/verify-belt-throughput.js',
  'tools/verify-data-integrity.js',
  'tools/verify-beacon-modules.js',
  'tools/verify-nuclear.js',
  'tools/verify-inserter-lane-priority.js',
  'tools/verify-inserter-multi-input.js',
  'tools/verify-underground-belt-dual-lane.js',
  'tools/verify-auto-underground-cross.js',
  'tools/verify-inserter-side-flip.js',
  'tools/verify-splitter-input-priority.js',
  'tools/verify-entity-rotate.js',
  'tools/verify-save-rotate.js',
  'tools/verify-save-layout-migrate.js',
  'tools/verify-oil-rate.js',
  'tools/verify-data-alignment.js',
  'tools/verify-dlc.js',
  'tools/verify-terrain-render.js',
];

const root = path.join(__dirname, '..');
let fail = 0;

for (const s of scripts) {
  console.log('');
  console.log(`==================== ${s} ====================`);
  const res = spawnSync(process.execPath, [s], { cwd: root, stdio: 'inherit' });
  if (res.status !== 0) {
    console.log(`>>> 失败：${s}`);
    fail = 1;
  }
}

console.log('');
if (fail === 0) {
  console.log(`✅ 全部校验通过（${scripts.length} 个脚本）`);
} else {
  console.log('❌ 存在校验失败');
  process.exit(1);
}
