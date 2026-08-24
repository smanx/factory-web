'use strict';

// 全量载入校验：按 index.html 的脚本顺序在桩环境中执行所有游戏脚本，
// 捕捉顶层引用错误（未定义变量、注册表缺失等），并做关键集成冒烟：
//   - 新设备可实例化并 addEnt/removeEnt
//   - serializeAll/applySave 往返（模拟存读档）
//   - updateLogistics/updatePower 等主循环函数存在
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const html = readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const FILES = [...html.matchAll(/<script src="([^"]+)\?[^"]*"><\/script>/g)]
  .map(m => m[1]);

const fakeEl = () => ({
  style: {}, dataset: {}, children: [], innerHTML: '', textContent: '',
  getContext: () => new Proxy({}, { get: () => () => {} }),
  toDataURL: () => 'data:',
  cloneNode() { return fakeEl(); },
  appendChild() {}, addEventListener() {}, classList: { add() {}, remove() {}, toggle() {} },
  getBoundingClientRect: () => ({ left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 }),
  querySelector: () => null, querySelectorAll: () => []
});
const sandbox = {
  console, performance,
  setTimeout: () => 0, clearTimeout: () => {},
  window: { location: { search: '' }, addEventListener() {}, innerWidth: 1280, innerHeight: 720 },
  document: {
    createElement: fakeEl,
    getElementById: () => fakeEl(),
    querySelector: () => null,
    querySelectorAll: () => [],
    addEventListener() {},
    body: { appendChild() {} }
  },
  localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  navigator: { maxTouchPoints: 0 },
  location: { search: '' },
  requestAnimationFrame() {},
  URLSearchParams: class { get() { return null; } },
  toast() {},
  uiDirty: false
};
sandbox.globalThis = sandbox;
const ctx = vm.createContext(sandbox);

let n = 0;
for (const f of FILES) {
  const src = readFileSync(path.join(ROOT, f), 'utf8');
  try {
    vm.runInContext(src, ctx, { filename: f });
    n++;
  } catch (err) {
    console.error(`✗ ${f}: ${err.stack.split('\n').slice(0, 3).join('\n')}`);
    process.exit(1);
  }
}
console.log(`✓ 全部 ${n} 个脚本按 index.html 顺序载入成功`);

// UI 渲染依赖真实 DOM：桩掉纯视觉函数，聚焦逻辑集成验证
vm.runInContext(`
  buildHotbar = function() {};
  refreshHotbar = function() {};
`, ctx);

vm.runInContext(`
  // ---- 集成冒烟：新设备全流程 ----
  const out = [];
  function assert(c, m) { out.push((c ? '✓ ' : '✗ ') + m); if (!c) process.exitCode = 1; }
  globalThis.process = { exitCode: 0 };

  newGame();   // 完整初始化一局

  // 放置信标 + 港口 + 物流箱 + 组装机 III
  const mk = (t, x, y) => { const e = new ENT_CLASSES[t](t, x, y); e.dir = 0; e.applyDir(); addEnt(e); return e; };
  const beacon = mk('beacon', 8, 8);
  const port = mk('roboport', 20, 20);
  const prov = mk('logi-chest-passive', 24, 24);
  const req = mk('logi-chest-requester', 28, 28);
  const asm3 = mk('assembling-machine-3', 12, 12);
  assert(beacon && port && prov && req && asm3, '新设备放置成功');

  // 注册表已收录
  assert(G.extraReg && G.extraReg.beacons.has(beacon) && G.extraReg.ports.has(port) &&
         G.extraReg.chests.has(prov) && G.extraReg.chests.has(req), '信标/港口/物流箱增量注册表生效');
  assert(regExtraEnt === regExtraEnt && typeof unregExtraEnt === 'function' && typeof resetExtraReg === 'function', 'extra 注册表 API 齐全');

  // 移除后注销
  removeEnt(prov);
  assert(!G.extraReg.chests.has(prov), '拆除物流箱后从注册表注销');
  addEnt(prov);

  // 存档往返
  for (let i = 0; i < 5; i++) prov.giveItem('iron-gear');
  asm3.setRecipe('iron-gear');
  asm3.mods[0] = 'speed-module';
  beacon.mods[0] = 'productivity-module';
  req.req['iron-gear'] = 20;
  spawnDockedRobot(port);
  updateRobots(0.016);   // 清理墓碑
  const snap = serializeAll();
  const snapStr = JSON.stringify(snap);
  applySave(JSON.parse(snapStr));
  const restoredPort = entAt(20, 20);
  const restoredReq = entAt(28, 28);
  const restoredBeacon = entAt(8, 8);
  const restoredAsm3 = entAt(12, 12);
  assert(restoredPort && typeof restoredPort.dockedCount === 'function', '读档：机器人港口还原');
  assert(restoredPort.dockedCount() === 1, '读档：机器人随存档还原并回港');
  assert(restoredReq && restoredReq.req['iron-gear'] === 20, '读档：请求箱请求还原');
  assert(restoredBeacon && restoredBeacon.mods[0] === 'productivity-module', '读档：信标模块还原');
  assert(restoredAsm3 && restoredAsm3.mods[0] === 'speed-module' && restoredAsm3.recipe === 'iron-gear', '读档：组装机 III 模块与配方还原');
  assert(G.extraReg.beacons.size >= 1 && G.extraReg.ports.size >= 1, '读档后增量注册表重建');

  // 主循环函数就位
  assert(typeof updateLogistics === 'function' && typeof dispatchJobs === 'function' &&
         typeof moduleBonusesOf === 'function' && typeof modOnAction === 'function', '模块/物流全局函数就位');

  // 真实生产节拍：组装机 III 带速度模块跑完一个配方周期
  const asmT = entAt(12, 12);
  for (let i = 0; i < 10; i++) asmT.giveItem('iron-plate');
  asmT.outp = {};
  const t0 = G.time;
  let steps = 0;
  while (!asmT.crafting && steps++ < 10) { G.time += 0.1; asmT.update(0.1); }        // 备料开动
  while (asmT.crafting && steps++ < 4000) { G.time += 0.1; asmT.update(0.1); }      // 加工至完成
  assert((asmT.outp['iron-gear'] || 0) === 1 && steps < 4000, '带模块的组装机 III 完整跑通生产节拍');
  assert(asmT.inp['iron-plate'] === undefined || asmT.inp['iron-plate'] < 10, '原料按配方扣减');

  // 物流机器人主循环入口：updateLogistics 不抛错
  try { for (let i = 0; i < 30; i++) { G.time += 0.05; updateLogistics(0.05); } out.push('✓ updateLogistics 主循环连续执行无异常'); }
  catch (err) { out.push('✗ updateLogistics 异常：' + err.message); process.exitCode = 1; }

  // ---- 集成冒烟：核能链全流程（反应堆→热管→换热器→汽轮机）----
  try {
    G.techDone.nuclear = true;
    G.techDone.atomicPower = true;
    const nk = (t, x, y) => { const e = new ENT_CLASSES[t](t, x, y); e.dir = 0; e.applyDir(); addEnt(e); return e; };
    const reactor = nk('nuclear-reactor', -40, -40);
    const pipeH1 = nk('heat-pipe', -35, -40);
    const pipeH2 = nk('heat-pipe', -34, -40);
    const exch = nk('heat-exchanger', -33, -40);
    const turb = nk('steam-turbine', -33, -38);
    reactor.giveItem('nuclear-fuel-cell');
    exch.water = 100;
    let fullPower = false;
    for (let i = 0; i < 1200 && !fullPower; i++) {
      G.time += 0.05;
      for (const e of [reactor, pipeH1, pipeH2, exch, turb]) e.update(0.05);
      if (turb.powerOut >= TURBINE_POWER * 0.9) fullPower = true;
    }
    assert(fullPower, '核能链端到端：反应堆经热管/换热器带动汽轮机满功率发电');
    assert(exch.temp() >= HEAT_EXCH_TEMP_MIN || exch.working, '换热器工作温度达标');

    // 含核电设备的存档往返
    const centrifuge = nk('centrifuge', -20, -20);
    centrifuge.setRecipe('uranium-processing');
    for (let i = 0; i < 10; i++) centrifuge.giveItem('uranium-ore');
    for (let i = 0; i < 200; i++) { G.time += 0.1; centrifuge.update(0.1); if ((centrifuge.outp['uranium-238'] || 0) > 0) break; }
    assert((centrifuge.outp['uranium-235'] || 0) === 1, '离心机铀加工产出铀-235');
    reactor.usedCells = 2; reactor.burnLeft = 77;
    const snap2 = serializeAll();
    applySave(JSON.parse(JSON.stringify(snap2)));
    const rReactor = entAt(-40, -40), rExch = entAt(-33, -40), rTurb = entAt(-33, -38), rCent = entAt(-20, -20);
    assert(rReactor && rReactor.usedCells === 2 && Math.abs(rReactor.burnLeft - 77) < 1e-9, '读档：反应堆燃料状态还原');
    assert(rTurb && rTurb.steamBuf > 0, '读档：汽轮机储汽还原');
    assert(rCent && rCent.recipe === 'uranium-processing' && (rCent.outp['uranium-238'] || 0) === 39, '读档：离心机配方与产物还原');
    assert(rExch && typeof rExch.temp === 'function', '读档：换热器还原且热实体方法就位');
  } catch (err) {
    assert(false, '核能链集成异常：' + err.message);
  }

  console.log(out.join('|'));
`, ctx);

// ---- 集成冒烟：铁路运输全流程（放置→编组→计划表行驶→装卸→存读档）----
vm.runInContext(`
  const out2 = [];
  function assert2(c, m) { out2.push((c ? '✓ ' : '✗ ') + m); if (!c) process.exitCode = 1; }
  try {
    G.techDone.railway = true;

    // 铺设轨道：y=-60 横线 x=-70..-50，两座车站「矿区」「厂区」
    for (let x = -70; x <= -50; x++)
      addEnt(x === -66 ? new ENT_CLASSES['train-stop']('train-stop', x, -60)
           : x === -54 ? new ENT_CLASSES['train-stop']('train-stop', x, -60)
           : new ENT_CLASSES['rail']('rail', x, -60));
    entAt(-66, -60).stopName = '矿区';
    entAt(-54, -60).stopName = '厂区';

    // 用真实放置 API：把机车放到铁轨上（替换被压住的铁轨并返还）
    G.player.x = -68 * TILE; G.player.y = -60 * TILE + TILE / 2;
    invAdd('locomotive', 1); invAdd('cargo-wagon', 4); invAdd('rail', 10);
    const railsBefore = invCount('rail');
    assert2(railwayTryPlace('locomotive', -68, -60), '放置 API：机车放上铁轨');
    const train = entAt(-68, -60);
    assert2(train && typeof train.attachCar === 'function' && invCount('locomotive') === 0,
      '机车消耗且成为列车实体');
    assert2(invCount('rail') === railsBefore + 1, '被压住的铁轨已返还背包');
    // 挂接车厢：车尾西侧逐节放置
    assert2(railwayTryPlace('cargo-wagon', -69, -60) && railwayTryPlace('cargo-wagon', -70, -60),
      '放置 API：两节车厢挂到车尾');
    assert2(train.cars.length === 3 && train.cars[0].x === -68, '编组完成：机车在头、车厢在后');
    // 中段挂接被拒绝（只允许首尾）
    invAdd('cargo-wagon', 1);
    railwayTryPlace('cargo-wagon', -69, -59);
    assert2(train.cars.length === 3, '非首尾位置挂接被拒绝');

    // 计划表：矿区(定时) → 厂区(卸空发车)；装货 8 铁板 + 煤
    train.schedule = [{ name: '矿区', cond: 'time', wait: 1 }, { name: '厂区', cond: 'empty', wait: 0 }];
    for (let i = 0; i < 8; i++) train.giveItem('iron-plate');
    train.giveItem('coal'); train.giveItem('coal'); train.giveItem('coal');
    // 矿区旁机械臂卸货入箱：臂 (-54,-59) 在「厂区」车站正南、箭头朝南
    // ⇒ 取格=北侧车站上停靠的列车车头，放格=南侧物流箱
    const arm = new ENT_CLASSES['inserter']('inserter', -54, -59);
    arm.dir = 1;
    addEnt(arm);
    const unloadChest = new ENT_CLASSES['logi-chest-passive']('logi-chest-passive', -54, -58);
    addEnt(unloadChest);
    train.state = 'enroute'; train.invalidateRoute();

    let roundTrips = 0, lastStop = null, unloadOK = false;
    for (let i = 0; i < 9000 && !unloadOK; i++) {
      G.time += 0.05;
      train.update(0.05);
      arm.update(0.05);
      if (train.state === 'loading') {
        const sn = stopNameAt(train.cars[0].x, train.cars[0].y);
        if (sn !== lastStop) { if (sn === '矿区' && lastStop === '厂区') roundTrips++; lastStop = sn; }
        if (sn === '厂区' && unloadChest.countOf('iron-plate') >= 8 && train.totalCargo() === 0) unloadOK = true;
      }
    }
    assert2(unloadOK, '端到端：列车自动往返并在「厂区」由机械臂卸空 8 件货物后发车');
    assert2(roundTrips >= 1, '列车完成至少一次 矿区→厂区→矿区 循环');

    // 存档往返
    const hx = train.cars[0].x, hy = train.cars[0].y;
    const snapRail = serializeAll();
    applySave(JSON.parse(JSON.stringify(snapRail)));
    const rtTrain = entAt(hx, hy);
    assert2(rtTrain && rtTrain.cars.length === 3 && rtTrain.schedule.length === 2 &&
            rtTrain.schedule[0].name === '矿区', '读档：列车编组与计划表完整还原');
    assert2(stopNameAt(-66, -60) === '矿区', '读档：车站名还原');
    // 读档后仍可继续行驶（先补燃料——此前长途运行可能已把煤烧完）
    rtTrain.giveItem('coal'); rtTrain.giveItem('coal'); rtTrain.giveItem('coal');
    rtTrain.state = 'enroute'; rtTrain.invalidateRoute();
    let moved2 = false;
    for (let i = 0; i < 2000 && !moved2; i++) {
      G.time += 0.05; rtTrain.update(0.05);
      if (rtTrain.state === 'loading' && stopNameAt(rtTrain.cars[0].x, rtTrain.cars[0].y) === '厂区') moved2 = true;
    }
    assert2(moved2, '读档后的列车继续按计划表运行');

    // 拆除中间车厢 → 拆分编组
    const midCar = rtTrain.cars[1];
    const refundList = railwayDeconstruct(rtTrain, midCar.x, midCar.y);
    assert2(Array.isArray(refundList) && refundList.length >= 1, '拆除中间车厢返回返还清单');
  } catch (err) {
    assert2(false, '铁路集成异常：' + err.message);
  }
  console.log(out2.join('|'));
`, ctx);
