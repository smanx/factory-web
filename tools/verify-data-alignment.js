#!/usr/bin/env node
'use strict';
/**
 * 数据对齐官方验证脚本
 * ------------------------------------------------
 * 依据「数据先行 / 资源铁律：零冗余零遗漏」原则，核对 js/data.js 与设备文件中
 * 仍以硬编码形式维护、但官方 factorio-data 已有对应数值的常量，确保它们与
 * 《异星工厂》官方数据一致（或已从 GAME_DATA 桥接）。
 *
 * 检查项：
 *   1. 蒸汽机/汽轮机功率与耗汽率（官方 generator effectivity × fluid_usage_per_tick）
 *   2. 机械臂旋转/伸缩速度相对倍率（官方 inserter rotation_speed）
 *   3. 抽水机产水率（官方 offshore-pump pumping_speed）
 *   4. 离心机功耗（官方 assembling-machine-1 centrifuge energy_usage）
 *   5. 锅炉目标温度（官方 boiler target_temperature）
 *
 * 运行：node tools/verify-data-alignment.js
 * 退出码：0 = 全部通过；1 = 存在差异（便于接入 CI）。
 * 零依赖：仅读取 data.generated.js 与 data.js 文本常量。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const DATA_DIR = path.join(__dirname, '..', 'js', 'data');
const src = fs.readFileSync(path.join(DATA_DIR, 'data.generated.js'), 'utf8')
  + '\n' + fs.readFileSync(path.join(DATA_DIR, 'data.js'), 'utf8');

const sandbox = { console, Math, JSON, Set, Map, Array, Object, String, Number, Boolean, Date, RegExp, parseInt, parseFloat };
sandbox.G = { techDone: {}, dbg: null };
sandbox.global = sandbox;
vm.createContext(sandbox);
const probe = src + "\n;globalThis.__GD=GAME_DATA;globalThis.__ppe=POWER_PER_ENGINE;" +
  "globalThis.__ppt=POWER_PER_TURBINE;globalThis.__esr=ENGINE_STEAM_RATE;" +
  "globalThis.__tsr=TURBINE_STEAM_RATE;globalThis.__pr=PUMP_RATE;" +
  "globalThis.__cp=CENTRIFUGE_POWER;globalThis.__btm=BOILER_TEMP_MAX;globalThis.__bwr=BOILER_WATER_RATE;" +
  "globalThis.__esr=ENGINE_STEAM_RATE;globalThis.__fus=FLUID_UNIT_SCALE;" +
  "globalThis.__hxsh=HEAT_EXCHANGER_SPECIFIC_HEAT;globalThis.__hxmt=HEAT_EXCHANGER_MAX_TRANSFER;globalThis.__hxmwt=HEAT_EXCHANGER_MIN_WORK_TEMP;" +
  "globalThis.__hxeps=HEAT_EXCHANGER_ENERGY_PER_STEAM;";
vm.runInContext(probe, sandbox, { filename: 'data.js' });
const GAME_DATA = sandbox.__GD;

let passCount = 0;
let failCount = 0;
function check(name, actual, expected, tolerance) {
  const tol = tolerance || 0;
  const ok = typeof expected === 'number'
    ? Math.abs(actual - expected) <= tol
    : JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) { passCount++; console.log('  ✅ ' + name + '（' + actual + '）'); }
  else { failCount++; console.log('  ❌ ' + name + '：实际=' + actual + ' 官方=' + expected); }
}

console.log('\n【蒸汽机/汽轮机功率】');
// 官方：蒸汽机 effectivity=1、fluid_usage_per_tick=0.5、maximum_temperature=165
// 输出功率 = fluid_usage_per_tick(单位/秒=30) × (温度-15) × effectivity × 200J/°C/单位 = 900kW
// 汽轮机 = 60 × (500-15) × 1 × 200 = 5820kW（官方 5.82MW）
// 数据单源化：data.js 的 POWER_PER_ENGINE / POWER_PER_TURBINE 已从 GAME_DATA.steamPower 读取，
// 官方值即由 generate 脚本现场计算，此处双重核验（前端值 == GAME_DATA 单源值 == 官方期望值）。
const POWER_PER_ENGINE = sandbox.__ppe;
const POWER_PER_TURBINE = sandbox.__ppt;
check('蒸汽机满功率(kW)=GAME_DATA单源', POWER_PER_ENGINE, GAME_DATA.steamPower?.enginePower ?? 900);
check('汽轮机满功率(kW)=GAME_DATA单源', POWER_PER_TURBINE, GAME_DATA.steamPower?.turbinePower ?? 5820);
check('蒸汽机满功率(kW)=官方900', POWER_PER_ENGINE, 900);
check('汽轮机满功率(kW)=官方5820', POWER_PER_TURBINE, 5820);

console.log('\n【锅炉→蒸汽机 产能配比】');
// 官方：锅炉 1.8MW，蒸汽机 900kW → 1 台锅炉带 2 台蒸汽机。
// 游戏简化模型：锅炉产汽 1.2/s，蒸汽机耗汽 0.6/s → 2 台/锅炉（与官方一致）。
const ENGINE_STEAM_RATE = sandbox.__esr;
const BOILER_WATER_RATE = sandbox.__bwr;
check('锅炉:蒸汽机 配比 1:2（1.2/0.6）', Math.round(BOILER_WATER_RATE / ENGINE_STEAM_RATE * 10) / 10, 2, 0.01);
// 汽轮机耗汽率：官方 steam-turbine fluid_usage_per_tick=1 → 60 官方单位/s ÷ 项目刻度 50 = 1.2 项目单位/s。
// 单源推导（GAME_DATA.steamPower.turbineRate ÷ FLUID_UNIT_SCALE），与锅炉/蒸汽机同刻度。
const TURBINE_STEAM_RATE = sandbox.__tsr;
const FLUID_UNIT_SCALE = sandbox.__fus;
check('汽轮机耗汽率(项目单位/s)=官方60÷刻度50', Math.round(TURBINE_STEAM_RATE * 100) / 100,
  Math.round((GAME_DATA.steamPower?.turbineRate ?? 60) / FLUID_UNIT_SCALE * 100) / 100, 0.001);
check('汽轮机耗汽率(项目单位/s)=官方1.2', Math.round(TURBINE_STEAM_RATE * 100) / 100, 1.2, 0.001);

console.log('\n【热交换器→汽轮机 产能配比】');
// 官方：热交换器满负荷 10MW，每官方单位蒸汽热值 (500-15)°C×0.2kJ=0.097MJ → 产汽 ≈103.09 官方单位/s；
// 汽轮机耗汽 60 官方单位/s → 配比 1.718（约 1 台热交换器带 1.72 台汽轮机）。
// 项目刻度统一：热交换器产汽 = 10MW ÷ 4.85MJ/项目单位 ≈ 2.062 项目单位/s；汽轮机耗汽 1.2/s。
const HX_ENERGY_PER_STEAM = sandbox.__hxeps;
check('每单位蒸汽热值(MJ/项目单位)=官方0.097×50', Math.round(HX_ENERGY_PER_STEAM * 100) / 100, 4.85, 0.001);
const hxSteamRate = (GAME_DATA.steamPower?.heatExchangerSteamRate ?? 103.09) / FLUID_UNIT_SCALE; // 项目单位/s
check('热交换器产汽率(项目单位/s)=官方103.09÷50', Math.round(hxSteamRate * 100) / 100, Math.round(103.09 / 50 * 100) / 100, 0.001);
check('热交换器:汽轮机 配比=官方1.718', Math.round(hxSteamRate / TURBINE_STEAM_RATE * 1000) / 1000, 1.718, 0.001);
// 能量守恒：汽轮机耗汽热功率 = 输出电功率（官方 effectivity=1，输入输出严格相等）
const TURBINE_POWER = sandbox.__ppt;
check('汽轮机能量守恒: 耗汽热功率=输出功率(MW)', Math.round(TURBINE_STEAM_RATE * HX_ENERGY_PER_STEAM * 100) / 100,
  Math.round(TURBINE_POWER / 1000 * 100) / 100, 0.001);
// 反应堆→热交换器→汽轮机 整链官方配比
const REACTOR_HEAT_RATE = (sandbox.__GD && sandbox.__GD.heat && sandbox.__GD.heat.reactorHeatRate) || 40;
check('反应堆:热交换器 配比=官方1:4', Math.round(REACTOR_HEAT_RATE / (GAME_DATA.heat?.heatExchangerPower ?? 10) * 100) / 100, 4, 0.001);
check('1 反应堆可带汽轮机=官方6.87台', Math.round(REACTOR_HEAT_RATE / (TURBINE_STEAM_RATE * HX_ENERGY_PER_STEAM) * 100) / 100, 6.87, 0.001);

console.log('\n【抽水机产水率】');
const PUMP_RATE = sandbox.__pr;
check('抽水机产水率(/s)=官方20', PUMP_RATE, GAME_DATA.fluidCapacity?.pumpRate ?? 20);

console.log('\n【离心机功耗(kW)】');
// 数据单源化：data.js 的 CENTRIFUGE_POWER 已从 GAME_DATA.powerUse 读取，此处双重核验。
const CENTRIFUGE_POWER = sandbox.__cp;
check('离心机功耗=GAME_DATA单源', CENTRIFUGE_POWER, GAME_DATA.powerUse?.centrifuge ?? 350);
check('离心机功耗=官方350', CENTRIFUGE_POWER, 350);

console.log('\n【锅炉目标温度(°C)】');
const BOILER_TEMP_MAX = sandbox.__btm;
check('锅炉目标温度=官方165', BOILER_TEMP_MAX, GAME_DATA.steamPower?.boilerTargetTemp ?? 165);

console.log('\n【热交换器热量参数（GAME_DATA 单源）】');
// 官方 heat-exchanger（boiler 型）energy_source=heat：specific_heat=1MJ/°C、max_transfer=2GW、
// min_working_temperature=500、minimum_glow_temperature=350。此前为手工常量，本迭代单源化进 GAME_DATA.heat。
const HX_SPECIFIC_HEAT = sandbox.__hxsh;
const HX_MAX_TRANSFER = sandbox.__hxmt;
const HX_MIN_WORK_TEMP = sandbox.__hxmwt;
check('热交换器比热(MJ/°C)=GAME_DATA单源', HX_SPECIFIC_HEAT, GAME_DATA.heat?.heatExchangerSpecificHeat ?? 1);
check('热交换器最大传热(MW)=GAME_DATA单源', HX_MAX_TRANSFER, GAME_DATA.heat?.heatExchangerMaxTransfer ?? 2000);
check('热交换器最低工作温度(°C)=GAME_DATA单源', HX_MIN_WORK_TEMP, GAME_DATA.heat?.heatExchangerMinWorkTemp ?? 500);
check('热交换器比热=官方1', HX_SPECIFIC_HEAT, 1);
check('热交换器最大传热=官方2GW', HX_MAX_TRANSFER, 2000);
check('热交换器最低工作温度=官方500', HX_MIN_WORK_TEMP, 500);

console.log('\n【机械臂旋转速度相对倍率】');
// 官方 rotation_speed：普通 0.014、快速/堆叠 0.04、长臂 0.02、热能 0.013
// 项目以普通臂为基准，快速/堆叠臂应为 0.04/0.014≈2.857 倍。
const perType = (GAME_DATA.inserterStats && GAME_DATA.inserterStats.perType) || {};
const rot = (t) => perType[t] && perType[t].rotationSpeed;
if (rot('inserter')) {
  check('快速臂相对倍率=官方0.04/0.014', Math.round(rot('fast-inserter') / rot('inserter') * 1000) / 1000, 2.857, 0.01);
  check('堆叠臂相对倍率=官方0.04/0.014', Math.round(rot('bulk-inserter') / rot('inserter') * 1000) / 1000, 2.857, 0.01);
  check('长臂相对倍率=官方0.02/0.014', Math.round(rot('long-handed-inserter') / rot('inserter') * 1000) / 1000, 1.429, 0.01);
}


console.log('\n【火箭发射井占地（官方 selection_box ±4.5 → 9×9）】');
const SILO_FP = GAME_DATA.footprint && GAME_DATA.footprint['rocket-silo'];
check('rocket-silo 占地=官方9×9', SILO_FP ? SILO_FP.w + 'x' + SILO_FP.h : 'null', '9x9');

console.log('\n【特斯拉炮塔占地（Fulgora，官方 electric-turret selection_box ±2 → 4×4）】');
const TESLA_FP = GAME_DATA.footprint && GAME_DATA.footprint['tesla-turret'];
check('tesla-turret 占地=官方4×4', TESLA_FP ? TESLA_FP.w + 'x' + TESLA_FP.h : 'null', '4x4');
const TESLA_RANGE = GAME_DATA.turret && GAME_DATA.turret['tesla-turret'];
check('tesla-turret 射程=官方30', TESLA_RANGE ? String(TESLA_RANGE.range) : 'null', '30');
check('tesla-turret 冷却=官方2s', TESLA_RANGE ? String(TESLA_RANGE.fireRate) : 'null', '2');

console.log('');
if (failCount === 0) { console.log(`✅ 数据对齐官方校验全部通过（${passCount} 项）`); process.exit(0); }
else { console.log(`❌ 失败 ${failCount} 项（请将硬编码值改为从 GAME_DATA 桥接或对齐官方）`); process.exit(1); }
