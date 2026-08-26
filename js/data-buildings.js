'use strict';

const BUILD_DEFS = {
  'transport-belt':     { w: 1, h: 1, solid: false },
  'fast-transport-belt': { w: 1, h: 1, solid: false },
  'express-transport-belt': { w: 1, h: 1, solid: false },
  'underground':        { w: 1, h: 1, solid: false },
  'fast-underground-belt': { w: 1, h: 1, solid: false },
  'express-underground-belt': { w: 1, h: 1, solid: false },
  'splitter':           { w: 1, h: 2, solid: false, rotSwap: true },
  'fast-splitter':      { w: 1, h: 2, solid: false, rotSwap: true },
  'express-splitter':   { w: 1, h: 2, solid: false, rotSwap: true },
  'inserter':           { w: 1, h: 1, solid: true },
  'burner-inserter':    { w: 1, h: 1, solid: true },
  'lamp':               { w: 1, h: 1, solid: true },
  'programmable-speaker': { w: 1, h: 1, solid: true },
  'long-inserter':      { w: 1, h: 1, solid: true },
  'stack-inserter':     { w: 1, h: 1, solid: true },
  'fast-inserter':      { w: 1, h: 1, solid: true },
  'burner-drill':       { w: 2, h: 2, solid: true },
  'stone-furnace':      { w: 2, h: 2, solid: true },
  'steel-furnace':      { w: 2, h: 2, solid: true },
  'assembling-machine': { w: 3, h: 3, solid: true },
  'assembling-machine-3': { w: 3, h: 3, solid: true },
  'beacon':             { w: 3, h: 3, solid: true },
  'storage-chest':      { w: 1, h: 1, solid: true },
  'wooden-chest':       { w: 1, h: 1, solid: true },
  'iron-chest':         { w: 1, h: 1, solid: true },
  'steel-chest':        { w: 1, h: 1, solid: true },
  'creative-chest':     { w: 1, h: 1, solid: true },
  'void-chest':         { w: 1, h: 1, solid: true },
  'lab':                { w: 3, h: 3, solid: true },
  'boiler':             { w: 3, h: 2, solid: true, rotSwap: true },
  'steam-engine':       { w: 3, h: 5, solid: true, rotSwap: true },
  'offshore-pump':      { w: 2, h: 1, solid: true, rotSwap: true },
  'electric-drill':     { w: 3, h: 3, solid: true },
  'electric-furnace':   { w: 3, h: 3, solid: true },
  'assembling-machine-mk2': { w: 3, h: 3, solid: true },
  'pipe':               { w: 1, h: 1, solid: true },
  'creative-pipe':      { w: 1, h: 1, solid: true },
  'void-pipe':          { w: 1, h: 1, solid: true },
  'creative-belt':      { w: 1, h: 1, solid: false },
  'void-belt':          { w: 1, h: 1, solid: false },
  'pipe-to-ground':     { w: 1, h: 1, solid: true },
  'pump':               { w: 1, h: 1, solid: true },
  'solar-panel':        { w: 3, h: 3, solid: true },  // 官方 collision_box ±1.35 → 3×3
  'accumulator':        { w: 2, h: 2, solid: true },
  'passive-power':      { w: 2, h: 2, solid: true },
  'gun-turret':         { w: 2, h: 2, solid: true },
  'laser-turret':       { w: 2, h: 2, solid: true },
  'flamethrower-turret':{ w: 2, h: 3, solid: true },  // 官方 collision_box ±0.72×±1.2 → 2×3
  'rocket-silo':        { w: 5, h: 5, solid: true },
  'radar':              { w: 3, h: 3, solid: true },
  'stone-wall':         { w: 1, h: 1, solid: true },
  'gate':               { w: 1, h: 1, solid: true },
  'pumpjack':           { w: 3, h: 3, solid: true },
  'refinery':           { w: 5, h: 5, solid: true },
  'chemical-plant':     { w: 3, h: 3, solid: true },
  'storage-tank':       { w: 3, h: 3, solid: true },
  // ===== 核能建筑 =====
  'centrifuge':         { w: 3, h: 3, solid: true },  // 官方 collision_box ±1.2 → 3×3
  'nuclear-reactor':    { w: 5, h: 5, solid: true },
  'steam-turbine':      { w: 3, h: 5, solid: true, rotSwap: true },  // 官方 collision_box ±1.25×±2.35 → 3×5
  'heat-pipe':          { w: 1, h: 1, solid: true },
  'heat-exchanger':     { w: 3, h: 2, solid: true, rotSwap: true },
  'roboport':           { w: 4, h: 4, solid: true },
  'rail':               { w: 1, h: 1, solid: false },
  'locomotive':         { w: 1, h: 1, solid: true },
  'diesel-locomotive':  { w: 1, h: 1, solid: true },
  'cargo-wagon':        { w: 1, h: 1, solid: true },
  'fluid-wagon':        { w: 1, h: 1, solid: true },
  'artillery-wagon':    { w: 1, h: 1, solid: true },
  'train-stop':         { w: 1, h: 1, solid: true },
  'rail-signal':        { w: 1, h: 1, solid: true },
  'rail-chain-signal':  { w: 1, h: 1, solid: true },
  'car':                { w: 2, h: 2, solid: true, rotSwap: true },
  'tank':               { w: 3, h: 3, solid: true, rotSwap: true },
  'spidertron':         { w: 3, h: 3, solid: true, rotSwap: true },
  'land-mine':          { w: 1, h: 1, solid: false },
  'artillery-turret':   { w: 3, h: 3, solid: true },  // 官方 collision_box ±1.2 → 3×3
  'logistic-chest-passive': { w: 1, h: 1, solid: true },
  'logistic-chest-active':  { w: 1, h: 1, solid: true },
  'logistic-chest-storage': { w: 1, h: 1, solid: true },
  'logistic-chest-requester': { w: 1, h: 1, solid: true },
  'logistic-chest-buffer': { w: 1, h: 1, solid: true },
  // ===== 电路网络 =====
  'small-electric-pole': { w: 1, h: 1, solid: true },
  'medium-electric-pole': { w: 1, h: 1, solid: true },  // 官方 collision_box ±0.15 → 1×1
  'big-electric-pole': { w: 2, h: 2, solid: true },
  'constant-combinator': { w: 1, h: 1, solid: true },
  'arithmetic-combinator': { w: 1, h: 1, solid: true },
  'decider-combinator': { w: 1, h: 1, solid: true },
  'power-switch':      { w: 1, h: 1, solid: true },
  'substation':        { w: 2, h: 2, solid: true }   // 官方 collision_box ±0.7 → 2×2
};

// ===== 建筑耐久度（对齐《异星工厂》官方 factorio-data max_health 数值） =====
// 每个可建造建筑的最大 HP。敌人会攻击基地内的建筑，受损建筑可用修理包修复；
// HP 归零即被摧毁。无线索设备（传送带/管道/电线等）也有 HP，但敌人优先攻击防御建筑。
// 数值已按 factorio-data 2.1.16 官方 max_health 逐项对齐。
const BUILDING_HP = {
  // 传送带族（官方 transport-belt 150 / fast 160 / express 170）
  'transport-belt': 150, 'fast-transport-belt': 160, 'express-transport-belt': 170,
  // 分流器族（官方 splitter 170 / fast 180 / express 190）
  'splitter': 170, 'express-splitter': 190, 'fast-splitter': 180,
  // 地下带族（官方 underground-belt 150 / fast 160 / express 170）
  'underground': 150, 'fast-underground-belt': 160, 'express-underground-belt': 170,
  // 机械臂族（官方 inserter 150 / fast 150 / long 160 / bulk 160 / burner 100）
  'inserter': 150, 'long-inserter': 160, 'stack-inserter': 160, 'fast-inserter': 150,
  'burner-inserter': 100,
  // 采矿机（官方 burner-mining-drill 150 / electric-mining-drill 300 / pumpjack 200）
  'burner-drill': 150, 'electric-drill': 300, 'pumpjack': 200,
  // 熔炉（官方 stone 200 / steel 300 / electric 350）
  'stone-furnace': 200, 'steel-furnace': 300, 'electric-furnace': 350,
  // 组装机（官方 AM1 300 / AM2 350 / AM3 400 / beacon 200）
  'assembling-machine': 300, 'assembling-machine-mk2': 350, 'assembling-machine-3': 400, 'beacon': 200,
  // 储物箱（官方 wooden 100 / iron 200 / steel 350 / storage 350）
  'storage-chest': 350, 'wooden-chest': 100, 'iron-chest': 200, 'steel-chest': 350,
  'creative-chest': 350, 'void-chest': 350,
  // 研究中心（官方 lab 150）
  'lab': 150,
  // 发电与水（官方 boiler 200 / steam-engine 400 / offshore-pump 150）
  'boiler': 200, 'steam-engine': 400, 'offshore-pump': 150,
  // 流体（官方 pipe 100 / pipe-to-ground 150 / pump 180 / storage-tank 500）
  'pipe': 100, 'pipe-to-ground': 150, 'pump': 180, 'storage-tank': 500,
  'creative-pipe': 100, 'void-pipe': 100, 'creative-belt': 150, 'void-belt': 150,
  // 电力（官方 solar-panel 200 / accumulator 150）
  'solar-panel': 200, 'accumulator': 150, 'passive-power': 200,
  // 炮塔（官方 gun 400 / laser 1000 / flamethrower 1400 / artillery 2000）
  'gun-turret': 400, 'laser-turret': 1000, 'flamethrower-turret': 1400, 'artillery-turret': 2000,
  'stone-wall': 350, 'gate': 350,
  // 石化与火箭（官方 oil-refinery 350 / chemical-plant 300 / rocket-silo 5000 / radar 250）
  'refinery': 350, 'chemical-plant': 300, 'rocket-silo': 5000, 'radar': 250,
  // 核能（官方 centrifuge 350 / reactor 500 / turbine 300 / heat-pipe 200 / heat-exchanger 200）
  'centrifuge': 350, 'nuclear-reactor': 500, 'steam-turbine': 300, 'heat-pipe': 200, 'heat-exchanger': 200,
  // 机器人网络（官方 roboport 500 / 物流箱 350）
  'roboport': 500, 'logistic-chest-passive': 350, 'logistic-chest-active': 350,
  'logistic-chest-storage': 350, 'logistic-chest-requester': 350, 'logistic-chest-buffer': 350,
  // 电路网络（官方 small/medium pole 100 / big 150 / substation 200）
  'small-electric-pole': 100, 'medium-electric-pole': 100, 'big-electric-pole': 150, 'substation': 200,
  // 组合器（官方 constant 120 / arithmetic 150 / decider 150 / power-switch 200）
  'constant-combinator': 120, 'arithmetic-combinator': 150, 'decider-combinator': 150,
  'power-switch': 200,
  // 照明与告警（官方 small-lamp 100 / programmable-speaker 150）
  'lamp': 100, 'programmable-speaker': 150,
  // 铁路（官方 rail 200 / locomotive 1000 / 车厢 600 / train-stop 250 / 信号灯 100）
  'rail': 200, 'locomotive': 1000, 'diesel-locomotive': 1000, 'cargo-wagon': 600, 'fluid-wagon': 600, 'artillery-wagon': 600, 'train-stop': 250, 'rail-signal': 100, 'rail-chain-signal': 100,
  // 载具（官方 car 450 / tank 2000 / spidertron 400）
  'car': 450, 'tank': 2000, 'spidertron': 400, 'land-mine': 15
};
function buildingMaxHp(type) { return BUILDING_HP[type] || 100; }

// 所有建筑统一支持旋转与翻转（含锅炉/蒸汽机/汽轮机/热交换器等固定管道口建筑）。
// 旋转时设备本身与管道口随方向一起转动。
function postPlaceRotatable(type) { return true; }

// ===== 官方建筑血量数据桥接（GAME_DATA 由 factorio-data 现场生成，见 tools/generate-game-data.js）=====
// 手工 BUILDING_HP 优先，缺失的用官方值补缺。
for (const k in (GAME_DATA.buildingHp || {})) {
  if (typeof BUILDING_HP[k] !== 'number') BUILDING_HP[k] = GAME_DATA.buildingHp[k];
}
