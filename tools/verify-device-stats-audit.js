'use strict';
// ===== 数值体验精修守门人：DLC 设备 module_slots / emissions_per_minute 官方一致性 =====
// 依据官方 factorio-data 逐项核对（本文件内数值即官方值快照，来源见各项注释）：
//   - module_slots / crafting_speed：base/space-age/recycler 各 prototypes entity 定义
//   - emissions_per_minute.pollution：各设备 energy_source.emissions_per_minute
// 覆盖：
//   ① GAME_DATA.pollution 全表与官方一致（26 项：含负排放 -1 两项 + 项目兜底 3 项）
//   ② deviceStats 关键槽位/速度单源（36 项中抽全量 DLC + 长尾）
//   ③ 污染扫描工作态判定（各设备工作字段差异——修复「只认 working」的漏排 bug）
//   ④ 有意不接入项的决策记录（agricultural-tower spores 维度）
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  ✗ ' + msg); } }

// ---- 加载 GAME_DATA ----
const sb = { console }; sb.globalThis = sb; sb.window = sb; vm.createContext(sb);
vm.runInContext(fs.readFileSync(ROOT + '/js/data/data.generated.js', 'utf8'), sb);
vm.runInContext('globalThis.__GD = GAME_DATA;', sb);
const GD = sb.__GD;

console.log('【① GAME_DATA.pollution：官方 emissions_per_minute.pollution 全表】');
// 官方值快照（factorio-data 2026-10 校对）：
const OFFICIAL_EM = {
  'burner-mining-drill': 12, 'electric-mining-drill': 10, 'big-mining-drill': 40, 'pumpjack': 10,
  'stone-furnace': 2, 'steel-furnace': 4, 'electric-furnace': 1,
  'boiler': 30, 'oil-refinery': 6, 'chemical-plant': 4, 'centrifuge': 4,
  'assembling-machine-1': 4, 'assembling-machine-2': 3, 'assembling-machine-3': 2,
  // DLC（太空时代）：电磁工厂 4 / 铸造厂 6 / 低温工厂 6 / 破碎机 1 / 生物实验室 8 / 供热塔 100
  'electromagnetic-plant': 4, 'foundry': 6, 'cryogenic-plant': 6, 'crusher': 1,
  'biolab': 8, 'heating-tower': 100,
  // 回收机（recycler mod）：2
  'recycler': 2,
  // 官方负排放：工作时吸收污染
  'biochamber': -1, 'captive-biter-spawner': -1,
};
for (const [id, em] of Object.entries(OFFICIAL_EM)) {
  ok(GD.pollution[id] === em, `pollution[${id}] = ${em}（官方 emissions_per_minute，实际 ${GD.pollution[id]}）`);
}
// 项目兜底 3 项（官方无数值型排放，保留微量：核堆/热能机械臂/火车头）
ok(GD.pollution['nuclear-reactor'] === 7, 'pollution[nuclear-reactor] = 7（项目兜底，官方零排放）');
ok(GD.pollution['burner-inserter'] === 0.3, 'pollution[burner-inserter] = 0.3（项目兜底，官方无数值）');
ok(GD.pollution['locomotive'] === 3, 'pollution[locomotive] = 3（项目兜底，官方无数值）');
ok(Object.keys(GD.pollution).length === 26, `污染表共 26 项（实际 ${Object.keys(GD.pollution).length}）`);
// 有意不接入：agricultural-tower 官方 { spores = 4 } 为孢子维度（Gleba 惹虫用），项目无该维度
ok(GD.pollution['agricultural-tower'] === undefined, 'agricultural-tower 不入污染表（官方 spores 维度，有意不接入）');

console.log('【② deviceStats：官方 module_slots / crafting_speed 单源】');
// 官方快照（module_slots, crafting_speed；null=官方无该字段）
const OFFICIAL_DS = {
  'assembling-machine-1': { ms: 0, cs: 0.5 },   // 官方组装机 I 无插件槽
  'assembling-machine-2': { ms: 2, cs: 0.75 },
  'assembling-machine-3': { ms: 4, cs: 1.25 },
  'electric-furnace': { ms: 2, cs: 2 },
  'steel-furnace': { ms: null, cs: 2 },
  'stone-furnace': { ms: null, cs: 1 },
  'electric-mining-drill': { ms: 3, cs: null },
  'burner-mining-drill': { ms: 0, cs: null },   // 官方热能采矿机无插件槽
  'pumpjack': { ms: 2, cs: null },
  'big-mining-drill': { ms: 4, cs: null },      // 官方 mining_speed=2.5
  'lab': { ms: 2, cs: null },
  'biolab': { ms: 4, cs: null },                // 官方 researching_speed=2
  'beacon': { ms: 2, cs: null },
  'oil-refinery': { ms: 3, cs: 1 },
  'chemical-plant': { ms: 3, cs: 1 },
  'centrifuge': { ms: 2, cs: 1 },
  'electromagnetic-plant': { ms: 5, cs: 2 },
  'foundry': { ms: 4, cs: 4 },
  'cryogenic-plant': { ms: 8, cs: 2 },
  'crusher': { ms: 2, cs: 1 },
  'biochamber': { ms: 4, cs: 2 },
  'recycler': { ms: 4, cs: 0.5 },
  'captive-biter-spawner': { ms: 0, cs: 1 },
  'rocket-silo': { ms: 4, cs: null },           // 官方 4 槽；crafting_speed=1 属固定配方，项目剔除
};
for (const [id, o] of Object.entries(OFFICIAL_DS)) {
  const ds = GD.deviceStats[id];
  ok(!!ds, `deviceStats[${id}] 存在`);
  if (!ds) continue;
  if (o.ms !== null) ok(ds.moduleSlots === o.ms, `deviceStats[${id}].moduleSlots = ${o.ms}（官方 module_slots，实际 ${ds.moduleSlots}）`);
  if (o.cs !== null) ok(ds.craftingSpeed === o.cs, `deviceStats[${id}].craftingSpeed = ${o.cs}（官方 crafting_speed，实际 ${ds.craftingSpeed}）`);
}
ok(GD.deviceStats['rocket-silo'].craftingSpeed === undefined, 'rocket-silo 无 craftingSpeed（固定配方，防误导）');
ok(GD.deviceStats['big-mining-drill'].miningSpeed === 2.5, 'big-mining-drill miningSpeed = 2.5（官方）');
ok(GD.deviceStats['biolab'].researchingSpeed === 2, 'biolab researchingSpeed = 2（官方）');

console.log('【③ 污染扫描工作态判定（deviceIsWorking 覆盖各设备工作字段）】');
{
  const src = fs.readFileSync(ROOT + '/js/devices/pollution.js', 'utf8');
  ok(/function deviceIsWorking/.test(src), 'deviceIsWorking 判定函数存在');
  ok(/e\.working \|\| e\.crafting \|\| e\.burning \|\| e\.active \|\| e\.lit/.test(src),
    '工作态覆盖全部字段：working(采矿/泵/炼油/化工) + crafting(组装机系/回收/离心) + burning(锅炉/核堆/热塔) + active(实验室) + lit(熔炉/锅炉)');
  ok(/e\.rotating \|\| \(e\.holdingCount > 0\)/.test(src), '热能机械臂工作态（rotating/holdingCount）');
  ok(/_movingUntil/.test(src), '火车头行驶态（_movingUntil timestamp）');
  ok(/function deviceAbsorbsPollution/.test(src), '负排放（吸收污染）判定函数存在');
  // 吸收逻辑：工作时从全局污染扣除 |rate|
  ok(/deviceAbsorbsPollution\(e\)[\s\S]{0,200}Math\.max\(0, \(G\.pollution \|\| 0\) - absorb\)/.test(src),
    '负排放设备工作时吸收全局污染（对齐官方 -1）');
  // 扫描循环走 deviceIsWorking 而非裸 e.working
  ok(/if \(deviceIsWorking\(e\)\)/.test(src), 'scanPollutionSources 统一走 deviceIsWorking');
  ok(!/if \(e\.working\) \{[\s\S]{0,80}modulePollutionMult/.test(src), '不再裸判 e.working（修复锅炉/组装机/熔炉/实验室漏排 bug）');
}
{
  const src = fs.readFileSync(ROOT + '/js/devices/railway.js', 'utf8');
  ok((src.match(/_movingUntil = \(G\.time \|\| 0\) \+ trainMoveTime\(head\)/g) || []).length >= 3,
    '铁路三处移动路径（moveTrain/moveTrainToward/moveTrainManual）均盖行驶 timestamp');
}
{
  const src = fs.readFileSync(ROOT + '/js/devices/rocket.js', utf());
  ok(/moduleSlotCount\(\) \{ return GAME_DATA\.deviceStats\?\.\['rocket-silo'\]\?\.moduleSlots \?\? 4; \}/.test(src),
    'rocket-silo 模块槽单源 GAME_DATA.deviceStats（官方 4）');
}

console.log('【④ 官方 source 快照复核（防手滑改动）】');
// 重申两项易错口径：
ok(GD.pollution['heating-tower'] === 100, '供热塔排放 100/分（官方 reactor 原型 energy_source，烧化学燃料产热）');
ok(GD.pollution['biochamber'] === -1 && GD.pollution['captive-biter-spawner'] === -1,
  '生化炉/虫巢孵化器官方 -1（负排放=吸收，非漏提取）');

function utf() { return 'utf8'; }

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
