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

  console.log(out.join('|'));
`, ctx);
