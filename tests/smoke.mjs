'use strict';

// ===== 冒烟测试（零依赖，Node >= 16 运行：node tests/smoke.mjs）=====
// 在最小浏览器桩环境下按依赖顺序载入游戏脚本，
// 覆盖：数据一致性 / 模块效果数学 / 产能加成进位 / 物流机器人网络端到端 /
//       序列化往返 / 科技解锁门控 / 港口充电与电力 / 机械臂投喂规则。

import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const FILES = [
  'js/data.js',
  'js/world.js',
  'js/core/registry.js',
  'js/core/entity.js',
  'js/core/draw.js',
  'js/core/power.js',
  'js/devices/modules.js',
  'js/devices/logistics.js',
  'js/devices/assembler.js',
  'js/devices/assembler-mk2.js',
  'js/devices/assembler-3.js',
  'js/devices/chemical-plant.js',
  'js/devices/refinery.js',
  'js/devices/lab.js',
  'js/devices/belt.js',
  'js/devices/splitter.js',
  'js/devices/underground.js',
  'js/devices/inserter.js'
];

// ---- 浏览器桩环境 ----
const sandbox = {
  console,
  performance,
  window: { location: { search: '' }, addEventListener() {}, innerWidth: 1280, innerHeight: 720 },
  document: {
    createElement: () => ({ getContext: () => null, style: {}, toDataURL: () => '' }),
    getElementById: () => null,
    addEventListener() {}
  },
  localStorage: { getItem: () => null, setItem() {} },
  navigator: { maxTouchPoints: 0 },
  toast() {},
  uiDirty: false,
  LOD: { simple: false, level: 2 }
};
sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox);

// 最小 G 全局（模拟 main.js 中 loop 驱动所需字段）
vm.runInContext(`
  const G = {
    time: 0,
    power: { prod: 0, demand: 0, sat: 1 },
    techDone: {}, techProg: {}, activeTech: null,
    inv: new Map(),
    dbg: {},
    settings: {},
    ents: [], grid: new Map(), buckets: new Map(),
    enemies: [], bullets: [],
    logiRobots: [],
    world: null
  };
`, ctx);

for (const f of FILES) {
  const src = readFileSync(path.join(ROOT, f), 'utf8');
  try {
    vm.runInContext(src, ctx, { filename: f });
  } catch (err) {
    console.error(`✗ 载入失败 ${f}: ${err.message}`);
    process.exit(1);
  }
}

// 导出待测符号
vm.runInContext(`
  globalThis.__T = {
    G, ITEMS, RECIPES, REFINERY_RECIPES, TECHS, MODULES, MODULE_SLOTS, FILTER_CHOICES, FLUIDS,
    BUILD_DEFS, ENT_CLASSES, POWER_USE,
    recipeUnlocked, recipeUnlockTech, modAllowed, moduleBonusesOf, modSpeedMult, modPowerMult,
    grantOutputWithBonus, dispatchJobs, updateRobots, spawnDockedRobot, makeRobot,
    logiRobotsSerialize, logiRobotsRestore, ensureExtraReg, resetExtraReg,
    entAt, addEnt, removeEnt
  };
`, ctx);

const T = sandbox.__T;

let passed = 0, failed = 0;
function ok(cond, name) {
  if (cond) { passed++; console.log('  ✓ ' + name); }
  else { failed++; console.error('  ✗ ' + name); }
}
function section(t) { console.log('\n== ' + t + ' =='); }

// ================= 数据一致性 =================
section('数据一致性');
{
  let bad = [];
  for (const rid in T.RECIPES) {
    for (const k in T.RECIPES[rid].inp) if (!T.ITEMS[k]) bad.push(rid + '<-' + k);
    for (const k in T.RECIPES[rid].out) if (!T.ITEMS[k]) bad.push(rid + '->' + k);
  }
  for (const rid in T.REFINERY_RECIPES) {
    for (const k in T.REFINERY_RECIPES[rid].inp) if (!T.ITEMS[k]) bad.push(rid + '<-' + k);
    for (const k in T.REFINERY_RECIPES[rid].out) if (!T.ITEMS[k]) bad.push(rid + '->' + k);
  }
  ok(bad.length === 0, '全部配方的输入/输出物品均存在' + (bad.length ? '（缺:' + bad.join(',') + '）' : ''));

  bad = [];
  for (const tid in T.TECHS) {
    const u = T.TECHS[tid].unlock;
    if (u) for (const rid of u) if (!T.RECIPES[rid] && !T.ITEMS[rid]) bad.push(tid + '->' + rid);
  }
  ok(bad.length === 0, '科技解锁项均指向有效配方/物品');

  ok(Object.keys(T.MODULES).length === 9 && Object.values(T.MODULES).every(m => ['speed', 'prod', 'eff'].includes(m.kind)),
    '模块表：3 类 × 3 阶共 9 种');
  ok(Object.keys(T.MODULE_SLOTS).every(t => !!T.BUILD_DEFS[t]), 'MODULE_SLOTS 设备均有建造定义');
  ok(!!T.POWER_USE['beacon'], '信标已登记耗电');
  ok(T.FILTER_CHOICES.every(id => !!T.ITEMS[id]), '过滤臂候选物品均有效');
  // 新设备有渲染与类注册
  for (const t of ['beacon', 'roboport', 'logi-chest-passive', 'logi-chest-storage', 'logi-chest-requester']) {
    ok(!!T.ENT_CLASSES[t] && !!T.BUILD_DEFS[t], '新设备注册齐全：' + t);
  }
}

// ================= 模块效果数学 =================
section('模块效果数学');
{
  const asm = new T.ENT_CLASSES['assembling-machine']('assembling-machine', 10, 10);
  ok(asm.mods.length === 0, '组装机 I 无模块插槽');
  const mk2 = new T.ENT_CLASSES['assembling-machine-mk2']('assembling-machine-mk2', 20, 20);
  ok(mk2.mods.length === 2, '组装机 II 有 2 个插槽');
  const asm3 = new T.ENT_CLASSES['assembling-machine-3']('assembling-machine-3', 30, 30);
  ok(asm3.mods.length === 4, '组装机 III 有 4 个插槽');

  mk2.mods[0] = 'speed-module';
  mk2.recipe = 'iron-gear';
  T.G.time = 1;
  ok(Math.abs(modSpeedOf(mk2) - 1.2) < 1e-9, '速度模块 I：速度 ×1.2');
  ok(Math.abs(modPowerOf(mk2) - 1.4) < 1e-9, '速度模块 I：耗电 ×1.4');
  ok(Math.abs(mk2.powerDemand() - T.POWER_USE['assembling-machine-mk2'] * 1.4) < 1e-6, '组装机 II 耗电随模块放大');

  mk2.mods[1] = 'effectivity-module-3';
  mk2._mbT = undefined;   // 失效缓存
  ok(Math.abs(modPowerOf(mk2) - Math.max(0.2, 1 + 0.4 - 0.5)) < 1e-9, '速度I+效能III：耗电 ×0.9');
  ok(modPowerOf(mk2) >= 0.2, '耗电倍率下限 20% 生效');

  function modSpeedOf(e) { return T.modSpeedMult(e); }
  function modPowerOf(e) { return T.modPowerMult(e); }

  // 研究中心禁插产能模块
  const lab = new T.ENT_CLASSES['lab']('lab', 40, 40);
  ok(lab.mods.length === 2, '研究中心有 2 个插槽');
  ok(!T.modAllowed(lab, 'productivity-module'), '研究中心不能插产能模块');
  ok(T.modAllowed(lab, 'speed-module'), '研究中心可以插速度模块');

  // 信标转发
  const beacon = new T.ENT_CLASSES['beacon']('beacon', 14, 14);
  beacon.mods[0] = 'speed-module-3';
  T.addEnt(beacon);
  T.G.time = 2; mk2._mbT = undefined;
  ok(Math.abs(T.moduleBonusesOf(mk2).speed - (0.2 + 0.25)) < 1e-9, '信标转发：自身+0.2 与 信标+0.5×50% 叠加为 +0.45');
  // 远处机器不受影响
  const far = new T.ENT_CLASSES['assembling-machine-mk2']('assembling-machine-mk2', 60, 60);
  T.G.time = 2; 
  ok(Math.abs(T.moduleBonusesOf(far).speed - 0) < 1e-9, '信标范围外的机器不受影响');
  T.removeEnt(beacon);
}

// ================= 产能加成进位 =================
section('产能加成进位');
{
  const fake = { outp: {} };
  const rec = { out: { 'iron-gear': 1 } };
  T.grantOutputWithBonus(fake, rec, { prod: 0.5 });
  T.grantOutputWithBonus(fake, rec, { prod: 0.5 });
  ok(fake.outp['iron-gear'] === 3, '+50% 产能两次合成产出 3 个（小数进位累积）');
  const fake2 = { outp: {} };
  T.grantOutputWithBonus(fake2, rec, { prod: 0 });   // 无加成走普通路径
  ok(fake2.outp['iron-gear'] === 1, '无产能加成时产出不变');
}

// ================= 物流机器人网络端到端 =================
section('物流机器人网络端到端');
{
  const port = new T.ENT_CLASSES['roboport']('roboport', 44, 44);
  const provider = new T.ENT_CLASSES['logi-chest-passive']('logi-chest-passive', 40, 40);
  const requester = new T.ENT_CLASSES['logi-chest-requester']('logi-chest-requester', 50, 52);
  T.addEnt(port); T.addEnt(provider); T.addEnt(requester);
  for (let i = 0; i < 10; i++) provider.giveItem('iron-plate');
  requester.req['iron-plate'] = 7;
  T.spawnDockedRobot(port);
  T.spawnDockedRobot(port);

  // 模拟主循环直到配送完成（上限 400 帧）
  let delivered = false;
  for (let i = 0; i < 400; i++) {
    T.G.time += 0.05;
    port.update(0.05);
    T.dispatchJobs();
    T.updateRobots(0.05);
    if (requester.countOf('iron-plate') >= 7) { delivered = true; break; }
  }
  ok(delivered, '请求箱自动补货到 7 个铁板');
  // 让在途机器人全部回港后再断言
  for (let i = 0; i < 600 && T.G.logiRobots.some(r => !r.dead && r.state !== 'dock' && r.state !== 'charge'); i++) {
    T.G.time += 0.05;
    port.update(0.05);
    T.updateRobots(0.05);
  }
  ok(requester.countOf('iron-plate') === 7, '不多送（请求上限与在途数量核算生效）');
  ok(provider.countOf('iron-plate') === 3, '被动供应箱被取走 7 个');

  // 机器人回港充电待命
  let docked = 0;
  for (const rb of T.G.logiRobots) if (rb.home === port && (rb.state === 'dock' || rb.state === 'charge')) docked++;
  ok(docked === 2, '任务完成后机器人返回港口');

  // 存储箱作为次级货源
  requester.req['copper-cable'] = 4;
  const storage = new T.ENT_CLASSES['logi-chest-storage']('logi-chest-storage', 46, 48);
  T.addEnt(storage);
  storage.giveItem('copper-cable'); storage.giveItem('copper-cable'); storage.giveItem('copper-cable');
  let gotCable = false;
  for (let i = 0; i < 400; i++) {
    T.G.time += 0.05;
    port.update(0.05);
    T.dispatchJobs();
    T.updateRobots(0.05);
    if (requester.countOf('copper-cable') >= 3) { gotCable = true; break; }
  }
  ok(gotCable && requester.countOf('copper-cable') === 3, '存储物流箱作为次级货源自动补货（库存只有 3 不超发）');

  // 请求箱不是货源：互相请求不会搬运
  const req2 = new T.ENT_CLASSES['logi-chest-requester']('logi-chest-requester', 54, 54);
  T.addEnt(req2);
  req2.giveItem('coal');
  requester.req['coal'] = 5;
  req2.req['coal'] = 0;
  let coalMoved = false;
  for (let i = 0; i < 300; i++) {
    T.G.time += 0.05;
    port.update(0.05);
    T.dispatchJobs();
    T.updateRobots(0.05);
    if (requester.countOf('coal') > 0) { coalMoved = true; break; }
  }
  ok(!coalMoved, '请求箱不会被当作取货来源');
}

// ================= 港口电力与充电 =================
section('港口电力与充电');
{
  const port = new T.ENT_CLASSES['roboport']('roboport', 80, 80);
  T.addEnt(port);
  ok(port.dockedCount() === 0 && Math.abs(port.powerDemand() - 25) < 1e-9, '空港空闲耗电 25kW');
  T.spawnDockedRobot(port);
  const rb = T.G.logiRobos || T.G.logiRobots[T.G.logiRobots.length - 1];
  rb.state = 'charge'; rb.charge = 40;
  ok(port.chargingCount() === 1, '充电中的机器人被计入');
  ok(port.powerDemand() === 25 + 70, '充电时耗电 25+70kW');
  for (let i = 0; i < 200; i++) { T.G.time += 0.1; port.update(0.1); }
  ok(rb.charge === T.makeRobot(port).charge && rb.state === 'dock', '充满后转回待命');
  // 取回机器人
  ok(port.takeItem() === 'logistic-robot' && port.dockedCount() === 0, '可从港口取回机器人');
  // contents 含机器人数量（拆除返还）
  T.spawnDockedRobot(port); T.spawnDockedRobot(port);
  const cont = Object.fromEntries(port.contents());
  ok(cont['logistic-robot'] === 2, '拆除返还清单包含停靠的机器人');
  // 只接受机器人
  ok(!port.giveItem('iron-plate'), '港口拒收非机器人物品');
}

// ================= 序列化往返 =================
section('序列化往返');
{
  const mk2 = new T.ENT_CLASSES['assembling-machine-mk2']('assembling-machine-mk2', 90, 90);
  mk2.mods[0] = 'speed-module';
  mk2.recipe = 'iron-gear';
  mk2.inp = { 'iron-plate': 2 };
  const s = JSON.parse(JSON.stringify(mk2.serialize()));
  const r = T.ENT_CLASSES['assembling-machine-mk2'].restore(s);
  ok(r.mods[0] === 'speed-module' && r.mods.length === 2, '组装机 II 模块配置随存档还原');
  ok(r.recipe === 'iron-gear' && r.inp['iron-plate'] === 2, '配方与输入照常还原');

  const beacon = new T.ENT_CLASSES['beacon']('beacon', 95, 95);
  beacon.mods[0] = 'productivity-module-2';
  const bs = JSON.parse(JSON.stringify(beacon.serialize()));
  const br = T.ENT_CLASSES['beacon'].restore(bs);
  ok(br.mods[0] === 'productivity-module-2', '信标模块随存档还原');

  const req = new T.ENT_CLASSES['logi-chest-requester']('logi-chest-requester', 96, 96);
  req.giveItem('coal'); req.giveItem('coal');
  req.req['coal'] = 50; req.req['water'] = 0;   // 0 值应被丢弃
  const qs = JSON.parse(JSON.stringify(req.serialize()));
  const qr = T.ENT_CLASSES['logi-chest-requester'].restore(qs);
  ok(qr.countOf('coal') === 2 && qr.req['coal'] === 50 && !('water' in qr.req), '请求箱内容与请求表往返一致');

  // 机器人序列化 → 还原（引用按坐标重挂）
  const port = new T.ENT_CLASSES['roboport']('roboport', 100, 100);
  T.addEnt(port);
  T.spawnDockedRobot(port);
  T.updateRobots(0.01);   // 触发死亡机器人的惰性清理（游戏中每帧都会执行）
  const list = JSON.parse(JSON.stringify(T.logiRobotsSerialize()));
  const before = T.G.logiRobots.length;
  T.logiRobotsRestore(list.concat([{ hx: 999, hy: 999, state: 'dock', charge: 50 }]));
  ok(T.G.logiRobots.length === before, '无效归属的机器人被丢弃，其余正常还原');
  ok(T.G.logiRobots.every(rb => rb.home && typeof rb.home.update === 'function' && rb.charge >= 0), '还原后的机器人引用有效');
}

// ================= 科技解锁门控 =================
section('科技解锁门控');
{
  ok(!T.recipeUnlocked('roboport'), '未研究「物流网络」前无法使用机器人港口配方');
  T.G.techDone.logiNet = true;
  ok(T.recipeUnlocked('roboport'), '研究「物流网络」后解锁机器人港口');
  ok(T.recipeUnlocked('logistic-robot') && T.recipeUnlocked('logi-chest-requester'), '同科技一并解锁机器人与物流箱');
  ok(!T.recipeUnlocked('beacon'), '信标需研究对应科技');
  T.G.techDone.beaconTech = true;
  ok(T.recipeUnlocked('beacon'), '研究「信标」后解锁信标');
  ok(T.recipeUnlockTech('speed-module-3') === 'advModule', '三级模块由「高级模块」科技解锁');
}

// ================= 机械臂投喂规则 =================
section('机械臂投喂规则');
{
  const ins = new T.ENT_CLASSES['inserter']('inserter', 120, 120);
  const chest = new T.ENT_CLASSES['logi-chest-passive']('logi-chest-passive', 121, 121);
  ok(ins.canDropAt(chest, 'iron-plate'), '机械臂可向被动物流箱投喂');
  const port = new T.ENT_CLASSES['roboport']('roboport', 124, 124);
  ok(ins.canDropAt(port, 'logistic-robot'), '机械臂可向港口投入物流机器人');
  ok(!ins.canDropAt(port, 'iron-plate'), '港口不收铁板');
  const req = new T.ENT_CLASSES['logi-chest-requester']('logi-chest-requester', 126, 126);
  ok(ins.canDropAt(req, 'steel-plate'), '机械臂可向请求箱投喂');
}

console.log('\n========================');
console.log(`通过 ${passed} / ${passed + failed}`);
if (failed > 0) { process.exit(1); }
