'use strict';
/*
 * 生成《异星工厂》科技清单与依赖关系报告（Markdown）。
 * 复用 tools/convert-data.js 现场把 factorio-data 的 Lua 数据转成 data.raw，
 * 提取其中全部 technology 原型（含前置/成本/效果/无限标记），输出到 docs/tech-report.md。
 *
 * 用法: node tools/tech-report.js   [可选: --out <路径>]
 */
const fs = require('fs');
const path = require('path');

const raw = require('./convert-data.js');

const idxOut = process.argv.indexOf('--out');
const OUT = idxOut > 0 ? process.argv[idxOut + 1] : path.join(__dirname, '..', 'docs', 'tech-report.md');

// ================= 归一化工具 =================
// 官方技术效果的 key（unlock-recipe / ammo-damage / modifier 等）用于摘要
const EFFECT_LABELS = {
  'unlock-recipe': '解锁配方',
  'ammo-damage': '弹药伤害',
  'gun-speed': '枪械射速',
  'turret-attack': '炮塔伤害',
  'artillery-range': '炮兵射程',
  'artillery-speed': '炮兵射速',
  'maximum-following-robot-count': '追击机器人上限',
  'inserter-stack-size-bonus': '机械臂堆叠',
  'laboratory-speed': '科研速度',
  'laboratory-productivity': '科研产能',
  'mining-drill-productivity-bonus': '采矿产能',
  'worker-robot-speed': '机器人速度',
  'character-logistic-slots': '个人物流栏',
  'character-trash-slots': '个人垃圾桶栏',
  'character-crafting-speed': '手搓速度',
  'character-mining-speed': '手挖速度',
  'character-build-distance': '建造距离',
  'character-reach-distance': '取放距离',
  'character-inventory-slots': '背包栏位',
  'character-health-bonus': '生命值加成',
  'character-runing-speed': '移动速度',
  'give-item': '给予物品',
  'unlock-space-location': '解锁太空位置',
  'unlock-recipes': '解锁配方(组)',
  'max-cargo-bay-unloading-distance': '卸货距离',
  'max-loop-carry': '环路载量',
  'cap-malachite-forest': '矿产',
  'set-internal-light': '内置照明',
  'inserter-distance-bonus': '',
};

function effectSummary(eff) {
  if (!eff) return '';
  if (Array.isArray(eff)) {
    return eff.map(effectSummary).filter(Boolean).join('、');
  }
  if (typeof eff !== 'object') return '';
  // 官方 effects / ingredients 为「数字键 → 记录」的稀疏哈希表，取其值逐个解析
  const vals = Object.values(eff);
  if (vals.some(v => v && typeof v === 'object' && v.type)) {
    return vals.map(effectSummary).filter(Boolean).join('、');
  }
  if (eff.type === 'unlock-recipe') return EFFECT_LABELS['unlock-recipe'] + ':' + eff.recipe;
  if (eff.type === 'give-item') return EFFECT_LABELS['give-item'] + ':' + eff.item;
  const label = EFFECT_LABELS[eff.type] || eff.type;
  let mod = '';
  if (typeof eff.modifier === 'number') mod = ' +' + modPct(eff.modifier);
  return label + (eff.ammo_category ? '(' + eff.ammo_category + ')' : '') + mod;
}

function modPct(v) {
  if (typeof v !== 'number') return v;
  return (Math.round(v * 10000) / 100) + '%';
}

// ================= 汇总提取 =================
const modOrder = {};
const assignMod = (names, modLabel) => {
  for (const n of names) if (!modOrder[n]) modOrder[n] = modLabel;
};

const techs = {};   // name -> {name, prerequisites[], cost{}, time, infinite, upgrade, effects, mod, tier}
for (const [name, proto] of Object.entries(raw.technology || {})) {
  if (!proto || typeof proto !== 'object') continue;
  let cost = {};
  if (proto.unit && proto.unit.ingredients) {
    for (const ing of Object.values(proto.unit.ingredients)) {
      if (Array.isArray(ing)) cost[ing[0]] = ing[1];
      else if (ing && ing['1']) cost[ing['1']] = ing['2'];
      else if (ing && ing.name) cost[ing.name] = ing.amount;
    }
  }
  const prereq = Array.isArray(proto.prerequisites)
    ? proto.prerequisites
    : (proto.prerequisites ? Object.values(proto.prerequisites) : []);
  techs[name] = {
    name,
    prereq,
    cost,
    time: proto.unit && proto.unit.time,
    infinite: proto.max_level === 'infinite' || !!proto.infinite,
    upgrade: !!proto.upgrade,
    effects: proto.effects ? effectSummary(proto.effects) : '',
  };
}

// 为无限科技填依赖：若某科技前置缺失(如 follower-robot-count-7 之前由循环生成)，
// 此处以已解析的 data.raw 最终态为准，缺失即自然缺失，不做推断。

// 汇总裁计
const allTypes = Object.keys(raw.technology || {});
const infiniteCount = Object.values(techs).filter(t => t.infinite).length;
const finiteCount = Object.values(techs).filter(t => !t.infinite).length;

// ================= 渲染 MD =================
const L = [];
const push = (s) => L.push(s);

// 按 DLC 科技定义文件的 name 精确归类（合并后 raw 已丢失来源，故重扫源文件）
const MOD_FILES = {
  'base': ['base/prototypes/technology.lua'],
  'space-age': ['space-age/prototypes/technology.lua'],
  'quality': ['quality/prototypes/technology.lua'],
  'recycler': ['recycler/data.lua'],
  'elevated-rails': ['elevated-rails/prototypes/technology/elevated-rails.lua'],
};
const nameByMod = {};
for (const [mod, files] of Object.entries(MOD_FILES)) {
  nameByMod[mod] = new Set();
  const srcDir = path.join(__dirname, '..', 'factorio-data');
  for (const rel of files) {
    const p = path.join(srcDir, rel);
    if (!fs.existsSync(p)) continue;
    const s = fs.readFileSync(p, 'utf8');
    const re = /type\s*=\s*"technology"[\s\S]*?name\s*=\s*"([^"]+)"/g;
    let m;
    while ((m = re.exec(s))) nameByMod[mod].add(m[1]);
  }
}
const modOfTech = {};
for (const n of allTypes) {
  for (const [mod, set] of Object.entries(nameByMod)) {
    if (set.has(n)) { modOfTech[n] = mod; break; }
  }
  if (!modOfTech[n]) modOfTech[n] = 'base'; // 兜底
}

push('# 《异星工厂》科技清单与依赖分析报告');
push('');
push('> 本报告由 `tools/tech-report.js` 现场解析 `factorio-data/` 的 Lua 数据自动生成（数据源：factorio 2.1 官方 + Space Age/Quality/Recycler/Elevated Rails 扩展）。');
push('> 依赖关系即每个科技的 `prerequisites` 前置科技列表，构成完整科技树有向图。');
push('');

const modFileMap = {};
{
  const counts = {};
  for (const m of ['base', 'space-age', 'quality', 'recycler', 'elevated-rails']) {
    counts[m] = Object.keys(raw.technology || {}).filter(n => modNameFor(m, n) === m).length;
  }
}
function modNameFor(mod, name) {
  // 粗略归属：前置含 space-science-pack 的制品多为 space-age，具体以文件名归属为准
  return mod;
}

push('## 总览');
push('');
push('| 模块 | 科技数 |');
push('|------|------:|');
{
  const byMod = {};
  for (const m of ['base', 'space-age', 'quality', 'recycler', 'elevated-rails']) byMod[m] = 0;
  for (const n of allTypes) byMod[modOfTech[n]]++;
  for (const m of Object.keys(byMod)) push(`| ${m} | ${byMod[m]} |`);
  push(`| **合计** | **${allTypes.length}** |`);
}
push('');
push(`- **科技总数**：${allTypes.length}`);
push(`- **无限科技（无限/可重复）**：${infiniteCount}`);
push(`- **普通科技**：${finiteCount}`);
push('');
const onlyInf = Object.values(techs).filter(t => t.infinite).map(t => t.name).sort().join('、');
push(`- **无限科技清单**：${onlyInf || '（无）'}`);
push('');
push('## 科技依赖明细');
push('');
push('> 每条目格式：`### 名称〔无限/升级〕` 下含前置 / 成本 / 效果。');
push('');

// 别名映射（项目自定 id ↔ 官方名基本一致，直接用官方名）
const color = {
  'automation-science-pack': '红',
  'logistic-science-pack': '绿',
  'military-science-pack': '军',
  'chemical-science-pack': '蓝',
  'production-science-pack': '紫',
  'utility-science-pack': '黄',
  'space-science-pack': '空间',
};
function costStr(cost) {
  const parts = Object.entries(cost).map(([k, v]) => `${color[k] || k}×${v}`);
  return parts.join('、') || '无成本(触发式)';
}

const sorted = allTypes.slice().sort((a, b) => a.localeCompare(b));
for (const name of sorted) {
  const t = techs[name];
  const pre = t.prereq.length ? t.prereq.join('、') : '—';
  const inf = t.infinite ? ' 〔无限〕' : '';
  const up = t.upgrade ? ' 〔可升级〕' : '';
  const eff = t.effects ? ' ｜ 效果: ' + t.effects : '';
  const time = t.time ? ` ｜ 时长: ${t.time}s` : '';
push(`### ${name}${inf}${up}`);
      push('');
      push(`- **模块**：${modOfTech[name]}`);
      push(`- **前置**：${pre}`);
  push(`- **成本**：${costStr(t.cost)}${time}`);
  if (t.effects) push(`- **效果**：${t.effects}`);
  push('');
}

// ================= 写出 =================
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, L.join('\n'), 'utf8');
console.log(`已生成: ${OUT}  (共 ${allTypes.length} 项科技)`);