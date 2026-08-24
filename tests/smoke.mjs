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
  'js/devices/railway.js',
  'js/devices/assembler.js',
  'js/devices/assembler-mk2.js',
  'js/devices/assembler-3.js',
  'js/devices/chemical-plant.js',
  'js/devices/refinery.js',
  'js/devices/lab.js',
  'js/devices/belt.js',
  'js/devices/splitter.js',
  'js/devices/underground.js',
  'js/devices/inserter.js',
  'js/devices/boiler.js',
  'js/devices/steam-engine.js',
  'js/devices/pipe.js',
  'js/devices/nuclear.js'
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
    G, ITEMS, RECIPES, REFINERY_RECIPES, CENTRIFUGE_RECIPES, TECHS, MODULES, MODULE_SLOTS, FILTER_CHOICES, FLUIDS,
    BUILD_DEFS, ENT_CLASSES, POWER_USE,
    recipeUnlocked, recipeUnlockTech, modAllowed, moduleBonusesOf, modSpeedMult, modPowerMult,
    grantOutputWithBonus, dispatchJobs, updateRobots, spawnDockedRobot, makeRobot,
    logiRobotsSerialize, logiRobotsRestore, ensureExtraReg, resetExtraReg,
    entAt, addEnt, removeEnt,
    genWorld, getOreType, getOreAmt, mineableOre, ORES, URANIUM_ORE_TI,
    heatCapOf, heatTempOf, isHeatEnt, conductHeat,
    HEAT_CAP_PER_TILE, HEAT_TEMP_MAX, HEAT_EXCH_TEMP_MIN, REACTOR_HEAT_RATE, REACTOR_BURN_TIME,
    REACTOR_FUEL_CAP, EXCHANGER_STEAM_RATE, TURBINE_POWER, TURBINE_STEAM_RATE,
    findRailPath, trackLinks, stopNameAt,
    TRAIN_SPEED_MAX, TRAIN_ACCEL, TRAIN_BRAKE, WAGON_CAP, LOCO_FUEL_CAP, TRAIN_FUEL_VALUES
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
  for (const rid in T.CENTRIFUGE_RECIPES) {
    for (const k in T.CENTRIFUGE_RECIPES[rid].inp) if (!T.ITEMS[k]) bad.push(rid + '<-' + k);
    for (const k in T.CENTRIFUGE_RECIPES[rid].out) if (!T.ITEMS[k]) bad.push(rid + '->' + k);
  }
  ok(bad.length === 0, '全部配方的输入/输出物品均存在' + (bad.length ? '（缺:' + bad.join(',') + '）' : ''));

  bad = [];
  const recipeExists = rid => !!(T.RECIPES[rid] || T.REFINERY_RECIPES[rid] || T.CENTRIFUGE_RECIPES[rid] || T.ITEMS[rid]);
  for (const tid in T.TECHS) {
    const u = T.TECHS[tid].unlock;
    if (u) for (const rid of u) if (!recipeExists(rid)) bad.push(tid + '->' + rid);
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

// ================= 核能链：数据与铀矿生成 =================
section('核能链：数据与铀矿生成');
{
  ok(T.mineableOre(5) === null && T.mineableOre(6) === 'uranium-ore' && T.mineableOre(0) === 'iron-ore',
    '矿物查表：油床(索引5)不可开采、铀矿(索引6)与铁矿可开采');
  // 出生点区块必有一小片铀矿
  T.G.world = T.genWorld(20260824);
  let found = 0;
  for (let ly = 0; ly < 32; ly++)
    for (let lx = 0; lx < 32; lx++)
      if (T.getOreType(lx, ly) === T.URANIUM_ORE_TI) found++;
  ok(found > 0, '出生点区块（0,0）保底生成铀矿');
  // 远处区块铀矿富集（扫描 200 个远处区块，按概率应命中数十块）
  let farChunksWithU = 0;
  for (let c = 1; c <= 200; c++) {
    let hit = false;
    for (let ly = 0; ly < 32 && !hit; ly++)
      for (let lx = 0; lx < 32 && !hit; lx++)
        if (T.getOreType(c * 32 + lx, 512 + ly) === T.URANIUM_ORE_TI) hit = true;
    if (hit) farChunksWithU++;
  }
  ok(farChunksWithU >= 25, '远处区块铀矿富集（200 块中 ' + farChunksWithU + ' 块含铀）');
}

// ================= 核能链：离心机端到端 =================
section('核能链：离心机端到端');
{
  const c = new T.ENT_CLASSES['centrifuge']('centrifuge', 140, 140);
  T.addEnt(c);
  c.setRecipe('uranium-processing');
  for (let i = 0; i < 10; i++) c.giveItem('uranium-ore');
  let done = false;
  for (let i = 0; i < 400 && !done; i++) { T.G.time += 0.1; c.update(0.1); done = (c.outp['uranium-238'] || 0) > 0; }
  ok(done, '铀加工完成一个周期');
  ok(c.outp['uranium-235'] === 1 && c.outp['uranium-238'] === 39, '铀加工产出 39 铀-238 + 1 铀-235');
  // 机械臂从离心机东侧取货放入物流箱（臂在 (143,141) 朝东：取 (142,141)、放 (144,141)）
  const chest = new T.ENT_CLASSES['logi-chest-storage']('logi-chest-storage', 144, 141);
  const ins = new T.ENT_CLASSES['inserter']('inserter', 143, 141);
  ins.dir = 0;
  T.addEnt(chest); T.addEnt(ins);
  let got = false;
  for (let i = 0; i < 600 && !got; i++) {
    T.G.time += 0.05;
    c.update(0.05);
    ins.update(0.05);
    got = chest.countOf('uranium-238') > 0 || chest.countOf('uranium-235') > 0;
  }
  ok(got, '机械臂可从离心机取走产物送入钢箱');
  T.removeEnt(c); T.removeEnt(chest); T.removeEnt(ins);
}

// ================= 核能链：反应堆燃烧与邻居加成 =================
section('核能链：反应堆燃烧与邻居加成');
{
  // 单堆：放入燃料棒后开始产热；无邻居时 burnMult=1
  const r = new T.ENT_CLASSES['nuclear-reactor']('nuclear-reactor', 160, 160);
  ok(r.giveItem('nuclear-fuel-cell') && r.giveItem('nuclear-fuel-cell'), '可放入燃料棒');
  ok(!r.giveItem('iron-plate'), '反应堆拒收非燃料物品');
  ok(Math.abs(r.burnMult() - 1) < 1e-9, '无邻居时 burnMult=1');
  r.update(0.5);
  ok(r.burning === true && Math.abs(r.heat - T.REACTOR_HEAT_RATE * 0.5) < 1e-6,
    '产热速率 = REACTOR_HEAT_RATE');
  // 邻居加成：相邻反应堆使 burnMult ×2（纯几何判定）
  const r2 = new T.ENT_CLASSES['nuclear-reactor']('nuclear-reactor', 165, 160);
  T.addEnt(r2);
  ok(r.neighborReactors() === 1 && Math.abs(r.burnMult() - 2) < 1e-9, '相邻反应堆使 burnMult ×2');
  T.removeEnt(r2);
  // 保护性停堆：热量灌满后不再消耗燃料
  let guard = 0;
  while (r.heat < T.heatCapOf(r) && guard++ < 400) { T.G.time += 0.1; r.update(0.1); }
  ok(r.heat >= T.heatCapOf(r) - 1e-6, '孤立反应堆最终热饱和');
  const fuelBefore = r.fuelCells, burnBefore = r.burnLeft;
  T.G.time += 0.5;
  r.update(0.5);
  ok(!r.burning && r.fuelCells === fuelBefore && Math.abs(r.burnLeft - burnBefore) < 1e-9,
    '热饱和时保护性停堆，不浪费燃料');
}

// ================= 核能链：换热器 + 汽轮机端到端 =================
section('核能链：换热器+汽轮机端到端');
{
  // 布局：反应堆(5×5) | 换热器(3×2)贴其东侧，汽轮机(3×5)在换热器正下方
  const r = new T.ENT_CLASSES['nuclear-reactor']('nuclear-reactor', 180, 180);
  const ex = new T.ENT_CLASSES['heat-exchanger']('heat-exchanger', 185, 180);
  const tb = new T.ENT_CLASSES['steam-turbine']('steam-turbine', 185, 182);
  T.addEnt(r); T.addEnt(ex); T.addEnt(tb);
  r.giveItem('nuclear-fuel-cell');
  ex.water = 50;
  ok(T.isHeatEnt(r) && T.isHeatEnt(ex) && T.isHeatEnt(tb) === false, '热实体判定正确（汽轮机不导热）');
  let sawPower = false, sawSteamUse = false;
  for (let i = 0; i < 1200; i++) {   // 模拟至多 60 秒
    T.G.time += 0.05;
    r.update(0.05); ex.update(0.05); tb.update(0.05);
    if (ex.working) sawSteamUse = true;
    if (tb.on) sawPower = true;
    if (sawPower && tb.powerOut >= T.TURBINE_POWER * 0.9) break;
  }
  ok(sawSteamUse, '换热器达到 500°C 后开始产蒸汽');
  ok(sawPower && tb.powerOut >= T.TURBINE_POWER * 0.9, '汽轮机满负荷发电（' + T.TURBINE_POWER + 'kW）');
  ok(r.usedCells > 0 || r.burnLeft < T.REACTOR_BURN_TIME, '反应堆持续消耗燃料并积累乏燃料棒');
  ok(ex.water < 50, '换热器消耗了水');
  T.removeEnt(r); T.removeEnt(ex); T.removeEnt(tb);
}

// ================= 核能链：科技门控 =================
section('核能链：科技门控');
{
  ok(!T.recipeUnlocked('centrifuge') && !T.recipeUnlocked('uranium-processing'), '未研究「核能科技」前无法使用离心机/铀加工');
  T.G.techDone.nuclear = true;
  ok(T.recipeUnlocked('centrifuge') && T.recipeUnlocked('uranium-processing'), '研究「核能科技」后解锁离心机/铀加工');
  ok(T.G.techDone.atomicPower ? true : !T.recipeUnlocked('nuclear-reactor'), '未研究「原子能发电」前无法合成核反应堆');
  T.G.techDone.atomicPower = true;
  ok(T.recipeUnlocked('nuclear-reactor') && T.recipeUnlocked('steam-turbine') && T.recipeUnlocked('heat-pipe'), '研究「原子能发电」后解锁全套核电设备');
  ok(!T.recipeUnlocked('kovarex-enrichment'), 'Kovarex 需单独研究「铀浓缩」');
  T.G.techDone.kovarex = true;
  ok(T.recipeUnlocked('kovarex-enrichment') && T.recipeUnlocked('nuclear-reprocessing'), '研究「铀浓缩」后解锁 Kovarex 与再处理');
}

// ================= 核能链：序列化往返 =================
section('核能链：序列化往返');
{
  const r = new T.ENT_CLASSES['nuclear-reactor']('nuclear-reactor', 210, 210);
  r.giveItem('nuclear-fuel-cell'); r.giveItem('nuclear-fuel-cell');
  r.usedCells = 3; r.heat = 123.4; r.burnLeft = 45.6;
  const rs = JSON.parse(JSON.stringify(r.serialize()));
  const rr2 = T.ENT_CLASSES['nuclear-reactor'].restore(rs);
  ok(rr2.fuelCells === 2 && rr2.usedCells === 3 && rr2.heat === 123.4 && rr2.burnLeft === 45.6,
    '反应堆燃料/废料/热量/燃烧进度随存档还原');

  const ex = new T.ENT_CLASSES['heat-exchanger']('heat-exchanger', 215, 215);
  ex.water = 7; ex.steamBuf = 3.5; ex.heat = 88.8;
  const es = JSON.parse(JSON.stringify(ex.serialize()));
  const er = T.ENT_CLASSES['heat-exchanger'].restore(es);
  ok(er.water === 7 && er.steamBuf === 3.5 && er.heat === 88.8, '换热器水/汽/热量随存档还原');

  const c = new T.ENT_CLASSES['centrifuge']('centrifuge', 220, 220);
  c.setRecipe('kovarex-enrichment');
  c.inp = { 'uranium-235': 3 }; c.prog = 5;
  const cs = JSON.parse(JSON.stringify(c.serialize()));
  const cr = T.ENT_CLASSES['centrifuge'].restore(cs);
  ok(cr.recipe === 'kovarex-enrichment' && cr.inp['uranium-235'] === 3 && cr.prog === 5, '离心机配方/输入/进度随存档还原');

  const tb = new T.ENT_CLASSES['steam-turbine']('steam-turbine', 225, 225);
  tb.steamBuf = 12.5;
  const ts = JSON.parse(JSON.stringify(tb.serialize()));
  const tr = T.ENT_CLASSES['steam-turbine'].restore(ts);
  ok(tr.steamBuf === 12.5, '汽轮机储汽随存档还原');
}

// ================= 铁路：数据与注册 =================
section('铁路：数据与注册');
{
  for (const t of ['rail', 'train-stop', 'locomotive', 'cargo-wagon']) {
    ok(!!T.ITEMS[t] && !!T.RECIPES[t] && !!T.BUILD_DEFS[t] && !!T.ENT_CLASSES[t], '铁路物品/配方/建筑/实体注册齐全：' + t);
  }
  ok(T.BUILD_DEFS['rail'].solid === false && T.BUILD_DEFS['locomotive'].solid === false, '轨道与列车不阻挡玩家');
  ok(Object.keys(T.TRAIN_FUEL_VALUES).indexOf('coal') >= 0, '机车燃料表包含煤');
  ok(T.recipeUnlockTech('locomotive') === 'railway', '铁路设备由「铁路运输」科技解锁');
}

// ================= 铁路：轨道连通与寻路 =================
section('铁路：轨道连通与寻路');
{
  // 铺一条 x=300..316 的横线，两端放同名/异名车站
  const mkRail = (x, y) => { const r = new T.ENT_CLASSES['rail']('rail', x, y); T.addEnt(r); return r; };
  const mkStop = (x, y, name) => {
    const s = new T.ENT_CLASSES['train-stop']('train-stop', x, y);
    s.stopName = name; T.addEnt(s); return s;
  };
  for (let x = 330; x <= 346; x++) if (x !== 334 && x !== 342) mkRail(x, 400);
  const stopA = mkStop(334, 400, '甲');
  const stopB = mkStop(342, 400, '乙');
  ok(T.trackLinks(330, 400).length === 1 && T.trackLinks(338, 400).length === 2, '铁轨自动连接：端点 1 邻、中段 2 邻');
  ok(T.stopNameAt(334, 400) === '甲', '车站名可读取');
  const p = T.findRailPath(336, 400, '乙');
  ok(Array.isArray(p) && p.length === 6 && p[5][0] === 342 && p[5][1] === 400,
    'BFS 寻路：336→乙站 6 步到达（途经车站格）');
  ok(T.findRailPath(336, 400, '不存在的站') === null, '找不到目标站返回 null');
  T.G.techDone.railway = true;
  ok(T.recipeUnlocked('rail') && T.recipeUnlocked('cargo-wagon'), '研究「铁路运输」后解锁全套铁路配方');
  // 清场
  for (let x = 330; x <= 346; x++) { const e = T.entAt(x, 400); if (e) T.removeEnt(e); }
}

// ================= 铁路：列车端到端 =================
section('铁路：列车端到端');
{
  // 环形线：y=430 横线 x=360..380 + 两端折返竖线，两座车站
  const placed = [];
  const put = e => { T.addEnt(e); placed.push(e); return e; };
  for (let x = 360; x <= 380; x++)
    put(x === 365 ? new T.ENT_CLASSES['train-stop']('train-stop', x, 430) : new T.ENT_CLASSES['rail']('rail', x, 430));
  put(new T.ENT_CLASSES['train-stop']('train-stop', 375, 430));
  T.entAt(365, 430).stopName = '甲';
  T.entAt(375, 430).stopName = '乙';
  // 列车：机车+2 节车厢，初始停在 362
  const train = put(new T.ENT_CLASSES['locomotive']('locomotive', 362, 430));
  train.attachCar('cargo-wagon', 361, 430);
  train.attachCar('cargo-wagon', 360, 430);
  ok(train.cars.length === 3 && train.hasLoco() && train.wagonCount() === 2, '编组：1 机车 + 2 车厢挂接成功');
  ok(train.cargoSpace() === T.WAGON_CAP * 2, '载货上限 = 车厢数 × WAGON_CAP');
  // 停稳时可装货；给 5 个铁板
  for (let i = 0; i < 5; i++) ok(train.giveItem('iron-plate'), '停稳时装货');
  train.giveItem('coal');   // 燃料进机车仓
  ok(train.fuelN === 1 && train.totalCargo() === 5, '煤进机车燃料仓、货物进车厢');
  // 行驶中拒收拒出
  train.speed = 5;
  ok(!train.giveItem('iron-plate') && !train.takeItem() && train.countOf('iron-plate') === 0,
    '行驶中拒收货物也拒出货物');
  train.speed = 0;
  // 计划表：甲(定时1s) → 乙(卸空发车)
  train.schedule = [
    { name: '甲', cond: 'time', wait: 1 },
    { name: '乙', cond: 'empty', wait: 0 }
  ];
  train.si = 0;
  train.state = 'enroute';
  train.invalidateRoute();
  let sawA = false, sawB = false, backA = false, unloadedByArm = false;
  // 机械臂布局：臂放在乙站正南一格 (375,431)、朝南（放格=南侧物流箱），取格=北侧车站上的列车
  const ins2 = put(new T.ENT_CLASSES['inserter']('inserter', 375, 431));
  ins2.dir = 1;
  const chest2 = put(new T.ENT_CLASSES['logi-chest-passive']('logi-chest-passive', 375, 432));

  let steps = 0;
  while (steps++ < 6000) {
    T.G.time += 0.05;
    train.update(0.05);
    ins2.update(0.05);
    const hx = train.cars[0].x, hy = train.cars[0].y;
    if (train.state === 'loading' && T.stopNameAt(hx, hy) === '甲' && !sawA) sawA = true;
    else if (train.state === 'loading' && T.stopNameAt(hx, hy) === '甲' && sawA && sawB) { backA = true; break; }
    if (train.state === 'loading' && T.stopNameAt(hx, hy) === '乙') {
      sawB = true;
      if (chest2.countOf('iron-plate') >= 5) unloadedByArm = true;
      if (train.totalCargo() === 0) { /* 卸空即发车 */ }
    }
  }
  ok(sawA, '列车按计划表停靠第一站「甲」（定时条件）');
  ok(sawB, '列车随后停靠第二站「乙」');
  ok(unloadedByArm || chest2.countOf('iron-plate') > 0, '机械臂从停站列车卸货入箱');
  ok(train.totalCargo() === 0, '「卸空发车」条件生效（货物被卸完后离站）');
  ok(backA, '列车循环返回「甲」，开始下一轮往返');
  ok(train.fuelN < 1 || train.burnLeft < T.TRAIN_FUEL_VALUES.coal, '行驶消耗了燃料');

  // 序列化往返（含编组/计划表/货物/车站名）
  const snap = JSON.parse(JSON.stringify(train.serialize()));
  const rt = T.ENT_CLASSES['locomotive'].restore(snap);
  ok(rt.cars.length === 3 && rt.schedule.length === 2 && rt.totalCargo() === 0 &&
     rt.schedule[1].name === '乙' && rt.schedule[1].cond === 'empty', '列车存档往返：编组/计划表还原');
  // 车头可能正停在甲站上（网格键归列车），从实体表里找车站本体
  const stopEnt = T.G.ents.find(e => !e._dead && e instanceof T.ENT_CLASSES['train-stop'] && e.stopName === '甲');
  const ssnap = JSON.parse(JSON.stringify(stopEnt.serialize()));
  const srt = T.ENT_CLASSES['train-stop'].restore(ssnap);
  ok(srt.stopName === '甲', '车站名随存档还原');
  // 清场
  for (const e of placed) if (!e._dead) T.removeEnt(e);
}

// ================= 铁路：拆车厢拆分编组 =================
section('铁路：拆车厢拆分编组');
{
  const put = e => { T.addEnt(e); return e; };
  for (let x = 460; x <= 464; x++) put(new T.ENT_CLASSES['rail']('rail', x, 470));
  const t1 = put(new T.ENT_CLASSES['locomotive']('locomotive', 460, 470));
  t1.attachCar('cargo-wagon', 461, 470);
  t1.attachCar('cargo-wagon', 462, 470);
  t1.attachCar('cargo-wagon', 463, 470);
  t1.giveItem('iron-plate'); t1.giveItem('copper-plate');
  const refund = t1.removeCarAt(462, 470);   // 中间车厢
  ok(refund.length === 1 && refund[0][0] === 'cargo-wagon', '拆中间车厢返还该车');
  const rear = T.entAt(463, 470);
  const front = T.entAt(460, 470);
  ok(rear && rear.cars && rear.cars.length === 1 && rear !== t1, '后段拆分为新列车');
  ok(front.cars.length === 2 && front.cars[0].type === 'locomotive', '前段保留机车与首节车厢');
  // 被拆格恢复为车底原有的铁轨（轨道不因列车通行/拆除而消失）
  const mid = T.entAt(462, 470);
  ok(mid && mid.type === 'rail', '被拆格恢复为铁轨');
  // 拆分出的列车可继续拆解（最后一节拆完整列消失）
  ok(rear.removeCarAt(463, 470).length === 1 && !T.entAt(463, 470), '拆分出的列车可继续拆解');
  // 清场
  for (let x = 460; x <= 464; x++) { const e = T.entAt(x, 470); if (e) T.removeEnt(e); }
}

console.log('\n========================');
console.log(`通过 ${passed} / ${passed + failed}`);
if (failed > 0) { process.exit(1); }
