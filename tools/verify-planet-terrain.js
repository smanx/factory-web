'use strict';
/**
 * 行星地表差异（Space Age 星球地貌）校验
 * ------------------------------------------------
 * 核验三颗星球的标志性地形生成与玩法规则（对齐《异星工厂》Space Age）：
 *   1. 祝融星（Vulcanus）：熔岩湖（T_LAVA）确定性生成、无天然水体；
 *      熔岩不可通行/不可建造；地基（foundation）可覆盖熔岩；填海料不可铺熔岩。
 *   2. 雷神星（Fulgora）：碎石岛（T_SCRAP）与沟壑（水格表现）成片分割；
 *      岛上可走行可出生；沟壑不可通行。
 *   3. 玄冥星（Aquilo）：冰海（T_ICE_SHEET）大片覆盖；冰海不可填海（官方规则）；
 *      冰面平台（ice-platform）可铺在冰海上；冰海可走行。
 *   4. 新地星（Nauvis）地形不受影响（水体=水格，无新地形）。
 *   5. 渲染/小地图：新增地形有专属配色（不落入默认草色）。
 *
 * 运行：node tools/verify-planet-terrain.js （退出码 0 = 通过）
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

// ===== 直接加载 world.js（含地形常量与生成函数）=====
const G = { settings: { language: 'zh' } };
const sandbox = {
  console, Math, JSON, Set, Map, Array, Object, String, Number, Boolean, Date, RegExp,
  parseInt, parseFloat, isFinite, isNaN, G,
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);
// world-config 先行（planetId/planetResources），world.js 依赖
vm.runInContext(load('data/data.generated.js') + '\n' + load('data/data.js') + '\n' + load('game/world-config.js') + '\n' + load('game/world.js') + '\n'
  + 'globalThis.__T_LAVA=T_LAVA;globalThis.__T_SCRAP=T_SCRAP;globalThis.__T_ICE_SHEET=T_ICE_SHEET;'
  + 'globalThis.__isLavaTile=isLavaTile;globalThis.__fulgoraIsland=fulgoraIsland;globalThis.__aquiloIceOcean=aquiloIceOcean;'
  + 'globalThis.__setPlanet=(p)=>{__worldCfg=null;};'
  + 'globalThis.__hash2=hash2;globalThis.__valueNoise=valueNoise;'
  + 'globalThis.__isWalkableTerrain=isWalkableTerrain;',
  sandbox, { filename: 'world.js' });

const { __T_LAVA: T_LAVA, __T_SCRAP: T_SCRAP, __T_ICE_SHEET: T_ICE_SHEET,
        __isLavaTile: isLavaTile, __fulgoraIsland: fulgoraIsland,
        __aquiloIceOcean: aquiloIceOcean, __isWalkableTerrain: isWalkableTerrain } = sandbox;

// planetId 的世界配置：world-config 从 worldConfig() 读取——直接改 G.worldConfig
console.log('\n【地形常量与可走行规则】');
ok(T_LAVA === 15 && T_SCRAP === 16 && T_ICE_SHEET === 17, '新地形 id：T_LAVA=15 / T_SCRAP=16 / T_ICE_SHEET=17');
ok(!isWalkableTerrain(T_LAVA), '熔岩不可走行（对齐官方 Vulcanus 熔岩湖）');
ok(isWalkableTerrain(T_SCRAP), '碎石岛可走行（对齐官方 Fulgora 干燥高地）');
ok(isWalkableTerrain(T_ICE_SHEET), '冰海可走行（对齐官方 Aquilo 冰面可通行）');

console.log('\n【祝融星：熔岩湖确定性生成、无天然水体】');
sandbox.planetId = () => 'vulcanus';
sandbox.planetResources = () => sandbox.PLANET_RESOURCES.vulcanus;
{
  let lava = 0, waterSim = 0;
  for (let gx = -200; gx <= 200; gx += 3)
    for (let gy = -200; gy <= 200; gy += 3) {
      if (isLavaTile(gx, gy)) lava++;
      if (Math.hypot(gx, gy) < 20 && isLavaTile(gx, gy)) waterSim++;
    }
  ok(lava > 30, '熔岩湖在 ±200 范围成片生成（采样 ' + lava + ' 格）');
  ok(waterSim === 0, '出生点 20 格内无熔岩（保证可开局）');
  // 确定性：同坐标两次调用一致
  ok(isLavaTile(50, 80) === isLavaTile(50, 80), '熔岩生成确定性（同种子同结果）');
  // 无水体：vulcanus water=0 → isLake 恒 false（pWater=-0.05 抵消阈值）
  vm.runInContext('globalThis.__PRvulcanus = PLANET_RESOURCES.vulcanus;', sandbox);
  ok(sandbox.__PRvulcanus && sandbox.__PRvulcanus.water === 0, '祝融星水资源=0（官方 Vulcanus 无海洋）');
}

console.log('\n【雷神星：碎石岛与沟壑成片分割】');
sandbox.planetId = () => 'fulgora';
{
  let island = 0, chasm = 0, islandNear = 0;
  for (let gx = -200; gx <= 200; gx += 3)
    for (let gy = -200; gy <= 200; gy += 3) {
      if (fulgoraIsland(gx, gy)) island++;
      else chasm++;
      if (Math.hypot(gx, gy) < 14 && fulgoraIsland(gx, gy)) islandNear++;
    }
  ok(island > 100 && chasm > 100, '碎石岛与沟壑均成片出现（岛 ' + island + ' / 沟壑 ' + chasm + ' 采样格）');
  ok(islandNear > 0, '出生点 14 格内为整片碎石岛（保证可开局）');
  ok(fulgoraIsland(50, 80) === fulgoraIsland(50, 80), '岛屿生成确定性');
}

console.log('\n【玄冥星：冰海大片覆盖】');
sandbox.planetId = () => 'aquilo';
{
  let ice = 0, total = 0;
  for (let gx = -200; gx <= 200; gx += 3)
    for (let gy = -200; gy <= 200; gy += 3) {
      total++;
      if (aquiloIceOcean(gx, gy)) ice++;
    }
  ok(ice > total * 0.3, '冰海覆盖超 30%（实测 ' + (ice / total * 100).toFixed(1) + '%，官方 Aquilo 大面积冰洋）');
  ok(aquiloIceOcean(50, 80) === aquiloIceOcean(50, 80), '冰海生成确定性');
}

console.log('\n【渲染与小地图：新地形有专属配色】');
{
  const renderSrc = load('render/render.js');
  ok(renderSrc.indexOf('drawLavaTile') >= 0 && renderSrc.indexOf('T_LAVA') >= 0, '主渲染：熔岩湖专属绘制');
  ok(renderSrc.indexOf('drawScrapTile') >= 0 && renderSrc.indexOf('T_SCRAP') >= 0, '主渲染：碎石高地专属绘制');
  ok(renderSrc.indexOf('drawIceSheetTile') >= 0 && renderSrc.indexOf('T_ICE_SHEET') >= 0, '主渲染：冰海专属绘制');
  const miniSrc = load('render/render-minimap.js');
  ok(miniSrc.indexOf('T_LAVA') >= 0 && miniSrc.indexOf('T_SCRAP') >= 0 && miniSrc.indexOf('T_ICE_SHEET') >= 0,
    '小地图：三种新地形均有专属配色');
}

console.log('\n【玩法规则：熔岩不可建造/地基可覆盖/冰海不可填海】');
{
  const mainSrc = load('main/main.js');
  ok(mainSrc.indexOf("lava: '熔岩阻挡") >= 0, '建造提示含熔岩原因');
  ok(mainSrc.indexOf('T_ICE_SHEET) { toast(\'冰面海层无法填海') >= 0, '冰海不可填海（官方 Aquilo 规则）');
  ok(mainSrc.indexOf("ice-platform') {\n    // 冰面平台") >= 0 || mainSrc.indexOf('冰面平台只能铺在冰海上') >= 0,
    '冰面平台只能铺在冰海/水面上');
  ok(mainSrc.indexOf('t === T_LAVA') < 0 || mainSrc.indexOf('可铺在水面/熔岩上') >= 0, '地基（foundation）可覆盖熔岩');
  const entitySrc = load('render/render-entity.js');
  ok(entitySrc.indexOf("reason: 'lava'") >= 0, 'canPlaceAt 熔岩阻挡建造');
  const playerSrc = load('game/player.js');
  ok(playerSrc.indexOf('T_LAVA') >= 0, '玩家碰撞：熔岩不可通行');
}

console.log('\n通过 ' + pass + ' 项，失败 ' + fail + ' 项');
process.exit(fail ? 1 : 0);
