'use strict';
const fs = require('fs');
// 现场转换 factorio-data → data.raw 的 JS 对象（内存，不依赖 generated/data.raw.json）
const d = require('./convert-data.js');
const recs = d.recipe;

const DEV = {
  'oil-processing': '炼油厂',
  'chemistry': '化工厂',
  'centrifuging': '离心机',
  'crafting': '组装机',
  'smelting': '冶炼炉',
  'electromagnetics': '电磁实验室',
  'agriculture': '农业塔',
  'cryogenics': '低温工厂',
  'metallurgy': '冶金',
  'electronics': '电子',
  'robotics': '机器人',
  'biolab': '生物实验室',
  'recycling': '回收机',
};

function devOf(r) {
  const cs = Object.values(r.categories || {});
  for (const c of cs) { if (DEV[c]) return DEV[c]; }
  return '组装机';
}

function fmt(obj) {
  return Object.values(obj || {}).map(e => {
    let amt;
    if (e.amount !== undefined) amt = e.amount;
    else if (e.probability !== undefined) amt = 'p' + e.probability;
    else if (e.shared_probability) amt = 'p' + e.shared_probability.max;
    else amt = '?';
    return e.name + '×' + amt;
  }).join(', ');
}

const rows = [];
for (const name of Object.keys(recs)) {
  const r = recs[name];
  if (r.hidden) continue;
  if (name.indexOf('parameter-') === 0) continue;
  rows.push({
    name,
    dev: devOf(r),
    time: r.energy_required !== undefined ? r.energy_required : 0.5,
    ing: fmt(r.ingredients),
    out: fmt(r.results),
  });
}
rows.sort((a, b) => a.name.localeCompare(b.name));

const L = [];
L.push('# Factorio 配方总表（来自 factorio-data）');
L.push('');
L.push('共 ' + rows.length + ' 条合成/冶炼/化工/炼油/离心配方（已排除隐藏与参数占位）。');
L.push('');
L.push('| 配方 ID | 产物 | 输入材料 | 耗时(s) | 生产机器 |');
L.push('|---|---|---|---|---|');
for (const x of rows) {
  L.push('| `' + x.name + '` | ' + x.out + ' | ' + x.ing + ' | ' + x.time + ' | ' + x.dev + ' |');
}
fs.writeFileSync('generated/recipes-table.md', L.join('\n'));
console.log('written generated/recipes-table.md, rows=' + rows.length);
