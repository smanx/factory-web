'use strict';
/**
 * 太空平台遥测（Space platform telemetry）校验
 * ------------------------------------------------
 * 核验「平台遥测」统计页与平台设备自动化链路（对齐官方 Space hub 遥测语义）：
 *   1. 遥测汇总：platformTelemetry() 远程只读收集推进器（燃料/氧化剂/功率/运行态）、
 *      小行星收集器（星块缓存）、平台中枢（货舱余量/派发目标）。
 *   2. 告警：推进器缺燃料/氧化剂（warn/bad 分级）、收集器满（停止收集）、货舱满。
 *   3. 推进器双流体输入与缓冲：portFlow 从管道抽液、双输入才发电（官方语义）。
 *   4. 电路信号：推进器输出 thruster-fuel/thruster-oxidizer 信号；收集器输出星块信号；
 *      中枢输出货舱信号（组合器自动化闭环）。
 *   5. 平台货舱轨道货运：hubDispatchCargo 派发到目标星球 G.orbitalCargo。
 *   6. 统计页注册：STAT_TABS 含 platform 页，HTML 渲染与 data-live 增量节点。
 *
 * 运行：node tools/verify-platform-telemetry.js （退出码 0 = 通过）
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'js');
const load = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name); }
}

const G = { settings: { language: 'zh' }, techDone: {}, ents: [], orbitalCargo: {}, grid: new Map(), buckets: new Map() };
const sandbox = {
  console, Math, JSON, Set, Map, Array, Object, String, Number, Boolean, Date, RegExp,
  parseInt, parseFloat, isFinite, isNaN, G,
  playSfx: () => {}, toast: (m) => { sandbox._toast = m; },
  ENT_CLASSES: {}, DEVICE_RENDER: {}, DEVICE_STATUS: {}, DEVICE_PANEL: {}, DEVICE_DIR_ROTATE: {}, DEVICE_PLACE: {},
  DEVICE_FLUID_ICONS: {}, DEVICE_FLUID_PORTS: {},
  performance, requestAnimationFrame: () => {},
  document: { createElement: () => ({ getContext: () => ({}) }), getElementById: () => null },
  localStorage: { getItem: () => null, setItem: () => {} },
  planetId: () => 'nauvis',
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(
  load('data/data.generated.js') + '\n'
  + load('data/data.js') + '\n'
  + load('data/data-items.js') + '\n'
  + load('data/data-recipes.js') + '\n'
  + load('data/data-buildings.js') + '\n'
  + load('data/data-tech.js') + '\n'
  + load('data/data-util.js') + '\n'
  + load('core/entity.js') + '\n'
  + load('devices/assembler.js') + '\n'
  + load('devices/pipe.js') + '\n'
  + load('devices/space-platform.js') + '\n'
  + load('game/stats.js') + '\n'
  + 'globalThis.__Thruster=Thruster;globalThis.__AsteroidCollector=AsteroidCollector;'
  + 'globalThis.__SpacePlatformHub=SpacePlatformHub;globalThis.__hubDispatchCargo=hubDispatchCargo;'
  + 'globalThis.__platformTelemetry=platformTelemetry;globalThis.__STAT_TABS=STAT_TABS;'
  + 'globalThis.__htmlStatsPlatform=htmlStatsPlatform;globalThis.__Pipe=Pipe;'
  + 'globalThis.__regLast=null;globalThis.regPowerEnt=(e)=>{__regLast=e;};',
  sandbox, { filename: 'platform.js' }
);

const { __Thruster: Thruster, __AsteroidCollector: AsteroidCollector,
        __SpacePlatformHub: SpacePlatformHub, __hubDispatchCargo: hubDispatchCargo,
        __platformTelemetry: platformTelemetry, __STAT_TABS: STAT_TABS,
        __htmlStatsPlatform: htmlStatsPlatform, __Pipe: Pipe } = sandbox;

function put(e) {
  G.ents.push(e);
  const k = ((e.x >> 4) + 4096) * 8192 + ((e.y >> 4) + 4096);
  let s = G.buckets.get(k); if (!s) { s = new Set(); G.buckets.set(k, s); }
  s.add(e);
  for (let dy = 0; dy < e.h; dy++)
    for (let dx = 0; dx < e.w; dx++) G.grid.set(((e.x + dx + 32768) << 16) | (e.y + dy + 32768), e);
  return e;
}
function fresh() { G.grid = new Map(); G.ents = []; G.buckets = new Map(); }

console.log('\n【统计页注册：平台遥测 tab】');
ok(STAT_TABS.some(t => t[0] === 'platform'), 'STAT_TABS 含 platform（平台遥测）页');
{
  fresh();
  const html = htmlStatsPlatform();
  ok(html.indexOf('未建造推进器') >= 0 && html.indexOf('未建造小行星收集器') >= 0 && html.indexOf('未建造空间平台中枢') >= 0,
    '空场景渲染：三类设备空态提示');
  ok(html.indexOf('全部平台设备状态正常') >= 0, '无告警时正常态提示');
}

console.log('\n【推进器：双流体输入与发电】');
{
  fresh();
  const t = put(new Thruster('thruster', 0, 0));
  // 无流体：不发电
  t.update(0.1);
  ok(t.powerOut === 0 && !t.on, '双流体缺失：推进器停机（功率 0）');
  // 只有燃料：仍停机（官方语义：燃料与氧化剂双输入）
  t.fuelBuf = 100; t.update(0.1);
  ok(t.powerOut === 0, '仅燃料无氧化剂：停机');
  // 双流体齐备：按消耗比例发电
  t.oxidBuf = 100; t.update(0.1);
  ok(t.on && t.powerOut > 0, '燃料+氧化剂齐备：发电 ' + (t.powerOut / 1000).toFixed(1) + ' MW');
  ok(t.fuelBuf < 100 && t.oxidBuf < 100, '双流体按速率消耗（燃料 ' + t.fuelBuf.toFixed(2) + ' / 氧化剂 ' + t.oxidBuf.toFixed(2) + '）');
  // 电路信号输出
  const sigs = t.outputCircuitSignals();
  ok(sigs.some(s => s.sig === 'thruster-fuel') && sigs.some(s => s.sig === 'thruster-oxidizer'),
    '电路信号输出 thruster-fuel/thruster-oxidizer（组合器自动化）');
  // 回归（E2E 浏览器实测发现）：点火判定曾用「本帧可耗量 > 0.1」，真实帧 dt≈16.7ms 时
  // fuelAvail=2×0.0167≈0.033 恒低于阈值 → 正常游玩推进器永远无法点火。已改为按缓冲判燃。
  t.fuelBuf = 40; t.oxidBuf = 40;
  t.update(1 / 60);
  ok(t.on && t.powerOut > 0, '真实帧 dt≈16.7ms 也能点火（回归：0.1 阈值 bug 已修）');
  ok(Math.abs(t.powerOut - 8000) < 1e-6, '满缓冲满速率输出 8MW');
  t.update(1 / 60);
  ok(t.fuelBuf < 40 && t.oxidBuf < 40, '小步长下双流体仍按速率消耗');
}

console.log('\n【小行星收集器：缓存与满仓停收】');
{
  fresh();
  const c = put(new AsteroidCollector('asteroid-collector', 0, 0));
  c.buf['metallic-asteroid-chunk'] = 10;   // 缓冲上限 10
  c.update(30);
  ok(Object.values(c.buf).reduce((a, b) => a + b, 0) === 10, '缓存满 10 后停止收集（30s 不新增）');
  ok(c.outputCircuitSignals().some(s => s.sig === 'metallic-asteroid-chunk' && s.count === 10),
    '电路信号输出星块存量（满仓自动化）');
}

console.log('\n【遥测汇总与告警分级】');
{
  fresh();
  put(new Thruster('thruster', 0, 0));                 // 双缺 → bad
  const t2 = put(new Thruster('thruster', 10, 0));     // 仅缺氧化剂 → warn
  t2.fuelBuf = 50;
  const col = put(new AsteroidCollector('asteroid-collector', 20, 0));
  col.buf['oxide-asteroid-chunk'] = 10;                // 满 → warn
  const hub = put(new SpacePlatformHub('space-platform-hub', 30, 0));
  hub.cargo['steel-plate'] = 50;                        // 满 → warn
  const tel = platformTelemetry();
  ok(tel.thrusters.length === 2 && tel.collectors.length === 1 && tel.hubs.length === 1,
    '遥测收集三类设备（推进器2/收集器1/中枢1）');
  ok(tel.alerts.length === 4, '告警 4 条（缺料×2 + 收集满 + 货舱满）');
  ok(tel.alerts.some(a => a.lvl === 'bad' && a.msg.indexOf('燃料与氧化剂') >= 0), '双缺告警为 bad 级');
  ok(tel.alerts.some(a => a.lvl === 'warn' && a.msg.indexOf('氧化剂') >= 0), '单缺告警为 warn 级');
  ok(tel.alerts.some(a => a.msg.indexOf('停止收集') >= 0), '收集器满仓告警');
  ok(tel.alerts.some(a => a.msg.indexOf('货舱已满') >= 0), '中枢货舱满告警');
  ok(tel.hubs[0].total === 50 && tel.hubs[0].cap === 50, '中枢货舱余量遥测（50/50）');
  const html = htmlStatsPlatform();
  ok(html.indexOf('⚠') >= 0 && html.indexOf('数据-live') < 0 && html.indexOf('data-live="tf-0,0"') >= 0,
    '遥测页含告警与 data-live 增量节点');
}

console.log('\n【平台货舱轨道货运：hubDispatchCargo】');
{
  fresh();
  const hub = put(new SpacePlatformHub('space-platform-hub', 0, 0));
  hub.cargo = { 'steel-plate': 20, 'speed-module': 5 };
  const n = hubDispatchCargo(hub, 'vulcanus');
  ok(n === 25, '派发 25 件货物到祝融星轨道');
  ok((G.orbitalCargo.vulcanus['steel-plate'] || 0) === 20 && (G.orbitalCargo.vulcanus['speed-module'] || 0) === 5,
    'G.orbitalCargo 目标星球入账（抵达后自动交付）');
  ok(hub.cargoTotal() === 0, '派发后货舱清空');
  sandbox._toast = null;
  hubDispatchCargo(hub, 'nauvis');
  ok(String(sandbox._toast).indexOf('货舱为空') >= 0, '空货舱派发被拒（提示）');
  hub.cargo = { 'iron-plate': 3 };
  sandbox._toast = null;
  hubDispatchCargo(hub, 'nauvis');
  ok(String(sandbox._toast).indexOf('不能派发到当前星球') >= 0, '派发到当前星球被拒（官方语义）');
}

console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
