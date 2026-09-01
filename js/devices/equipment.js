'use strict';

// ===== 模块化护甲个人装备网格系统（对齐《异星工厂》Equipment grid / Modular armor）=====
// 后 4 种模块化护甲自带“装备网格”（ARMORS[id].grid.w×h），玩家可把个人装备件
// （太阳能板/电池/外骨骼/激光防御/聚变堆等）安装进网格。装备件按各自尺寸占用网格，
// 并即时生效：太阳能板/聚变堆为个人电网发电，电池储电，外骨骼加速，激光防御自动开火。
//
// 数据模型：
//   - G.armorGrids: 每件模块化护甲独立保存的装备网格 { armorId: [{id, r, c}] }（r=行, c=列）。
//     每件护甲的网格互不影响；只有当前穿戴的护甲（G.armor）网格中的装备件才生效。
//   - G.panelArmor: 装甲面板当前查看的护甲 id（见 ui.js openPanel('armor')）。
//   - G.personalPower / G.personalPowerMax: 个人电网当前电量 / 容量（含电池）
//   - G.personalPowerProd: 个人电网发电速率（kW），由太阳能板/聚变堆产生
// 状态随存档持久化（见 equipmentSerialize / equipmentRestore），旧档单一网格自动迁移到穿戴护甲。

// ===== 装备件定义 =====
// size: 占用网格的行×列；powerOut: 发电(kW)；powerCap: 储电(kJ)；speed: 速度加成(每件)；
// laser: 个人激光防御射程(格)；night: 夜视(布尔)。
globalThis.EQUIPMENT = {
  'solar-panel-equipment':     { name: '个人太阳能板',      size: 1, powerOut: 30,  desc: '白天 30kW' },
  'fusion-reactor-equipment':  { name: '便携聚变反应堆',    size: 4, powerOut: 750, desc: '全天候 750kW' },
  'battery-equipment':         { name: '个人电池',          size: 2, powerCap: 10000, capE: 10000, desc: '储电 10MJ' },
  'battery-mk2-equipment':     { name: '个人电池 II',       size: 2, powerCap: 20000, capE: 20000, desc: '储电 20MJ' },
  'exoskeleton-equipment':              { name: '外骨骼',            size: 2, speed: 0.4, desc: '移动速度 +40%' },
  'night-vision-equipment':              { name: '夜视仪',            size: 1, night: true, desc: '夜间如白昼' },
  'personal-laser-defense-equipment':   { name: '个人激光防御',      size: 1, laser: 9, capE: 300, desc: '射程 9 格（需充能）' },
  // 能量护盾：受击时优先消耗个人电网电力生成护盾吸收伤害（shield: 每件护盾吸收上限）
  'energy-shield-equipment':            { name: '能量护盾',          size: 2, shield: 200, capE: 200, desc: '吸收 200 伤害（需充能）' },
  'energy-shield-mk2-equipment':        { name: '能量护盾 II',       size: 2, shield: 400, capE: 400, desc: '吸收 400 伤害（需充能）' },
  // 传送带免疫：站上传送带不再被带动位移
  'belt-immunity-equipment':  { name: '传送带免疫',        size: 1, beltImmune: true, desc: '传送带推动免疫' },
  // 放电防御：手动激活对周围敌人释放连锁电击，消耗个人电网电力
  'discharge-defense-equipment':        { name: '放电防御',          size: 3, discharge: true, capE: 5000, desc: '主动放电打击周围敌人（需充能）' },
  // 太空时代 Aquilo 高级装备（数据来自 GAME_DATA.equipment）
  'battery-mk3-equipment':     { name: '个人电池 III',      size: 2, powerCap: 100000, capE: 100000, desc: '储电 100MJ（官方 Battery Mk3）' },
  'fission-reactor-equipment': { name: '便携裂变反应堆',    size: 4, powerOut: 4000, desc: '全天候 4MW（官方 Fission reactor equipment）' },
  'toolbelt-equipment':        { name: '工具腰带',          size: 2, extraSlots: 10, desc: '随身额外物品栏 +10（官方 Toolbelt）' },
  // 个人机器人港（roboport-equipment，官方 2×2）：装备后提供施工机器人工作范围
  'personal-roboport-equipment':    { name: '个人机器人港',    size: 2, roboport: true, roboportRange: 15, robotLimit: 10, capE: 35000, desc: '施工机器人范围 15 格，最多 10 台在场' },
  'personal-roboport-mk2-equipment':{ name: '个人机器人港 II', size: 2, roboport: true, roboportRange: 20, robotLimit: 25, capE: 35000, desc: '施工机器人范围 20 格，最多 25 台在场' }
};
// 官方装备参数桥接（GAME_DATA.equipment 由 factorio-data 现场生成，见 tools/generate-game-data.js）。
// 仅覆盖官方有对应数据的数值字段（发电/储电/护盾/速度/射程/放电范围冷却）；
// 显示描述 desc、装备尺寸 size 及项目特有装备保持手工。
{
  const g = GAME_DATA.equipment || {};
  for (const eid of Object.keys(EQUIPMENT)) {
    const src = g[eid], def = EQUIPMENT[eid];
    if (!src || !def) continue;
    if (src.powerOut !== undefined) def.powerOut = src.powerOut;
    if (src.powerCap !== undefined) def.powerCap = src.powerCap;
    if (src.shield !== undefined) def.shield = src.shield;
    if (src.speed !== undefined) def.speed = src.speed;
    if (src.laser !== undefined) def.laser = src.laser;
    if (src.discharge !== undefined) def.discharge = src.discharge;
    if (src.dischargeRange !== undefined) def.dischargeRange = src.dischargeRange;
    if (src.dischargeCooldown !== undefined) def.dischargeCooldown = src.dischargeCooldown;
    // 工具腰带：背包扩容格数（官方 inventory_size_bonus）
    if (src.extraSlots !== undefined) def.extraSlots = src.extraSlots;
    // 个人机器人港：官方 roboport-equipment 数据（robot_limit / construction_radius /
    // charging_station_count / charging_energy）→ def.rbData；capE（energy_source.buffer_capacity → kJ）
    if (src.roboport !== undefined) def.rbData = src.roboport;
    if (src.capE !== undefined) def.capE = src.capE;
  }
}
// 装备件所属类别（对齐官方 equipment prototype 的 categories）：本项目全部为 "armor"，
// 与各装甲装备网格的 equipment_categories {"armor"} 匹配，故任何模块化护甲都可放置。
function isEquipment(id) { return !!EQUIPMENT[id]; }
for (const eid of Object.keys(EQUIPMENT)) {
  if (!EQUIPMENT[eid].cat) EQUIPMENT[eid].cat = 'armor';
}

// 装备件自带充能缓冲（capE）？需要充电的装备（电池/护盾/激光/放电/机器人港）才有。
function equipCapE(eid) { const d = EQUIPMENT[eid]; return (d && d.capE) || 0; }

// 装备件充电速率上限（能量/秒），对齐官方 input_flow_limit 的思路。
// 未显式配置时按「约 8 秒充满」折算（capE/8），保证进度条平稳可感。
function equipInF(eid) {
  const d = EQUIPMENT[eid];
  const cap = equipCapE(eid);
  if (!d || cap <= 0) return 0;
  return d.inF || cap / 8;
}

// ===== 个人机器人港（roboport-equipment，数据来自官方数据层）=====
// 机器人港的数据统一从 GAME_DATA.equipment[].roboport 获取（tools/generate-game-data.js 由官方
// roboport-equipment 原型生成），UI/逻辑只读、不在本文件手工维护数值。
// 含义对齐《异星工厂》：
//   - chargingStations × chargingEnergy = 同时给 N 台机器人充电（非排队充电）；
//   - 最大能耗 = 工作时的能耗 = 同时充电总功率（chargingStations × chargingEnergy）；
//   - 显示的“充电速度”是机器人港给机器人充电的速度（每站 chargingEnergy），而非机器人港自身充能速度。
function roboportConfig(eid) {
  const d = EQUIPMENT[eid];
  if (!d || !d.roboport) return null;
  const rb = d.rbData || {};
  const stations = (typeof rb.chargingStations === 'number') ? rb.chargingStations : 2;
  const chg = (typeof rb.chargingEnergy === 'number') ? rb.chargingEnergy : 1000; // kW/站
  const robotLimit = (typeof rb.robotLimit === 'number') ? rb.robotLimit : (d.robotLimit || 10);
  const radius = (typeof rb.constructionRadius === 'number') ? rb.constructionRadius : (d.roboportRange || 15);
  return { eid, stations, chargingEnergy: chg, robotLimit, radius, maxEnergy: stations * chg, capE: d.capE || 0 };
}
// 机器人港当前是否启用（Alt+F 切换，见 construction.js toggleRoboportActive）。未装备/未初始化视为启用。
function roboportActive() {
  return !(G.roboportActive === false);
}
// 格式化功率（kW → "X.X" MW 字符串，如 1000→"1.0"、4000→"4.0"）
function _fmw(kw) { return (kw / 1000).toFixed(1); }
// 生成机器人港的完整描述（多行，'\n' 分隔），由背包物品 tooltip 与装备网格 tooltip 共用。
function roboportDesc(eid) {
  const c = roboportConfig(eid);
  if (!c) return '';
  const size = EQUIPMENT[eid].size || 2;
  const area = (c.radius * 2) + 'x' + (c.radius * 2);          // 建设区域为直径 2× 半径
  const lines = [
    '可让建设机器人直接从背包中飞出来作业。',
    '状态:' + (roboportActive() ? '启用' : '已停用') + ' - 开关Alt+F',
    '建设区域：' + area,
    '可控机器人上限：' + c.robotLimit + '◆',
    '置于装备网格',
    '尺寸:' + size + 'x' + size,
    '安装于:护甲',
    '消耗装备网格电力',
    '最大能耗:' + _fmw(c.maxEnergy) + ' MW',
    '供电：',
    '机器人充电速度:' + c.stations + '×' + _fmw(c.chargingEnergy) + ' MW◆'
  ];
  return lines.join('\n');
}
// 供背包物品 tooltip 与装备网格 tooltip 读取机器人港完整描述（若装备在网格内则体现启用状态）。
function roboportTip(eid) {
  return ITEMS[eid] ? (ITEMS[eid].name + '|' + roboportDesc(eid)) : roboportDesc(eid);
}

// 从当前穿戴装备中某类装备的第一个实例扣减其充能缓冲 e。返回是否已扣空/扣过。
function drainEquipCharge(id, amount) {
  const grid = wornEquipGrid();
  for (const e of grid) {
    if (e.id === id && equipCapE(id) > 0) {
      e.e = Math.max(0, (e.e || 0) - amount);
      return e.e <= 0;
    }
  }
  return false;
}

// 确保个人电网/装备状态初始化
function ensureEquip() {
  if (G.armorGrids === undefined) G.armorGrids = {};
  if (G.personalPower === undefined) G.personalPower = 0;
  if (G.personalPowerMax === undefined) G.personalPowerMax = 0;
  if (G.personalPowerProd === undefined) G.personalPowerProd = 0;
}

// 指定护甲的装备网格尺寸（{w, h}），无网格的护甲返回 0。
function equipGridWHFor(armorId) {
  if (!armorId || !ARMORS[armorId]) return 0;
  return ARMORS[armorId].grid || 0;
}

// 当前正在编辑/查看的护甲：装甲面板打开时为面板对应的护甲，否则为穿戴中的护甲。
function activeArmorId() {
  if (G.panelMode === 'armor' && G.panelArmor && ARMORS[G.panelArmor]) return G.panelArmor;
  return G.armor;
}

// 指定护甲的装备网格数组（无网格护甲返回 null；首次访问时初始化空数组）。
function armorGridOf(armorId) {
  ensureEquip();
  if (!armorId || !ARMORS[armorId] || !ARMORS[armorId].grid) return null;
  if (!G.armorGrids[armorId]) G.armorGrids[armorId] = [];
  return G.armorGrids[armorId];
}

// 当前穿戴护甲的装备网格（用于计算生效效果）。无护甲/无网格返回空数组。
function wornEquipGrid() {
  ensureEquip();
  if (!G.armor || !ARMORS[G.armor] || !ARMORS[G.armor].grid) return [];
  if (!G.armorGrids[G.armor]) G.armorGrids[G.armor] = [];
  return G.armorGrids[G.armor];
}

// 装备件在指定护甲网格中是否可放置于 (r,c)（类别匹配、不越界、不与已有装备重叠）。
// armorId 省略时使用当前正在编辑的护甲。
function canPlaceEquip(eid, r, c, armorId) {
  const wh = equipGridWHFor(armorId);
  const def = EQUIPMENT[eid];
  if (!def || !wh) return false;
  // 类别校验：装备件类别必须被该护甲网格接受（对齐官方 equipment_categories）
  const cats = wh.cats || ['armor'];
  if (cats.indexOf(def.cat || 'armor') < 0) return false;
  const s = def.size;
  if (r < 0 || c < 0 || r + s > wh.h || c + s > wh.w) return false;
  const grid = armorGridOf(armorId);
  for (const e of grid) {
    const es = EQUIPMENT[e.id].size;
    if (e.r < r + s && e.r + es > r && e.c < c + s && e.c + es > c) return false;
  }
  return true;
}

// 从指定护甲网格卸下一件装备（按网格坐标），返还背包。
function removeEquip(r, c, armorId) {
  const aid = armorId || activeArmorId();
  const grid = armorGridOf(aid);
  if (!grid) return false;
  const idx = grid.findIndex(e => e.r === r && e.c === c);
  if (idx < 0) return false;
  const e = grid[idx];
  grid.splice(idx, 1);
  invAdd(e.id, 1);
  if (typeof playSfx === 'function') playSfx('unequip');
  if (typeof toast === 'function') toast('已卸下 ' + ITEMS[e.id].name);
  uiDirty = true;
  return true;
}

// 指定护甲网格中某类装备件数量
function equipCountIn(armorId, id) {
  let n = 0;
  for (const e of (armorGridOf(armorId) || [])) if (e.id === id) n++;
  return n;
}

// 当前穿戴护甲网格中某类装备件数量（如外骨骼数量、激光器数量）
function equipCount(id) {
  return equipCountIn(G.armor, id);
}

// ===== 工具腰带（Toolbelt equipment）背包扩容 =====
// 对齐《异星工厂》：个人装备网格中每装 1 件工具腰带（官方 Toolbelt equipment），
// 玩家背包容量 +extraSlots 格（本项目 10 格，数据来自 EQUIPMENT['toolbelt-equipment'].extraSlots）。
function toolbeltInventoryBonus() {
  const n = equipCount('toolbelt-equipment');
  if (n <= 0) return 0;
  const def = EQUIPMENT['toolbelt-equipment'];
  return n * ((def && def.extraSlots) || 0);
}

// ===== 个人电网效果 =====
// 汇总个人电网：发电量（太阳能板随昼夜）、储电容量（电池）。
function recomputePersonalPower() {
  ensureEquip();
  let prod = 0, cap = 0;
  for (const e of wornEquipGrid()) {
    const def = EQUIPMENT[e.id];
    if (!def) continue;
    if (def.powerOut) {
      // 太阳能板随昼夜发电；聚变堆全天候满发
      const f = (e.id === 'solar-panel-equipment')
        ? (typeof solarFactor === 'function' ? solarFactor() : 1)
        : 1;
      prod += def.powerOut * f;
    }
    if (def.powerCap) cap += def.powerCap;
  }
  G.personalPowerProd = prod;
  G.personalPowerMax = cap;
  // 电量不超过新容量上限
  if (G.personalPower > G.personalPowerMax) G.personalPower = G.personalPowerMax;
}

// 每帧推进个人电网：发电按需分配充电。
// 分配顺序（对齐官方）：先充入电池池（供护盾/激光/放电等耗电），再把剩余发电按各件的
// 固定充电速率上限（equipInF）分给能量装备件。发电不足时各件按比例分到较少功率。
function updatePersonalPower(dt) {
  ensureEquip();
  recomputePersonalPower();
  // 总发电预算（太阳能随昼夜 + 聚变/裂变全天候满发）
  let budget = G.personalPowerProd * dt;
  // 1) 电池池：发电优先充入电池（用于护盾/激光/放电/机器人港耗电）
  if (G.personalPowerMax > 0 && budget > 0) {
    const room = Math.max(0, G.personalPowerMax - G.personalPower);
    const used = Math.min(room, budget);
    G.personalPower += used;
    budget -= used;
  }
  // 电池类装备的进度条 → 反映其在电池池中所占份额（share），随时与池一致
  for (const e of wornEquipGrid()) {
    const d = EQUIPMENT[e.id];
    if (d && d.powerCap) {
      e.e = G.personalPowerMax > 0 ? G.personalPower * (d.powerCap / G.personalPowerMax) : 0;
      e._chg = 0; // 电池不显示独立充电功率
    }
  }
  // 2) 非电池的充能装备：分享剩余发电，各按固定速率上限充电（e._chg = 本件实际充电功率）
  for (const e of wornEquipGrid()) {
    const cap = equipCapE(e.id);
    const d = EQUIPMENT[e.id];
    if (cap <= 0 || (d && d.powerCap)) continue; // 电池已在上面同步
    if (budget <= 0) { e._chg = 0; continue; }
    const give = Math.min(budget, equipInF(e.id) * dt, cap - (e.e || 0));
    if (give > 0) { e.e = (e.e || 0) + give; budget -= give; }
    e._chg = give / dt; // 该件本帧实际充电功率（功率是固定分配，发电充足时=其 inF）
  }
  // 轻量刷新装甲面板网格上的充能进度条/数值（仅在面板打开且有网格时执行）
  refreshEquipChargeUI();
}

// 刷新装甲面板网格内已装装备的充电进度条与数值（每次个人电网更新时调用，开销小）。
function refreshEquipChargeUI() {
  const grid = document.getElementById('eqgrid-armor');
  if (!grid || !G.armorGrids) return;
  const aid = grid.dataset.aid;
  const arr = G.armorGrids[aid];
  if (!arr) return;
  for (const e of arr) {
    const cap = equipCapE(e.id);
    if (!cap) continue;
    const tile = grid.querySelector('.eqitem[data-eqpos="' + e.r + ',' + e.c + '"]');
    if (!tile) continue;
    const hv = e.e || 0;
    const pct = Math.max(0, Math.min(100, Math.round(hv / cap * 100)));
    const bar = tile.querySelector('.eqbar i');
    if (bar) bar.style.width = pct + '%';
    const lbl = tile.querySelector('.eqchg');
    if (lbl) lbl.textContent = Math.floor(hv) + '/' + cap;
    const sta = tile.querySelector('.eqsta');
    if (sta) {
      // 充电功率 = 本件装备自身固定充电速率上限（equipInF），不随发电总量漂移；
      // 发电不足时本件分得的实际功率较小（updatePersonalPower 中按比例分配）。
      const rate = equipInF(e.id);
      const pwr = Math.round((e._chg > 0 && e._chg < rate * 0.9) ? e._chg : (hv < cap ? rate : 0));
      if (hv >= cap) sta.textContent = '已充满';
      else if (rate > 0 && e._chg > 0) sta.textContent = pwr + 'kW 充电';
      else if (G.personalPowerProd > 0) sta.textContent = '排队 0kW';
      else sta.textContent = '无发电';
    }
    // 电量低于最低电量（20%）→ 显示红色三角「电量不足」闪烁警告（CSS 动画：显示1s/消失1s）
    const warn = tile.querySelector('.eqwarn');
    if (warn) warn.classList.toggle('on', hv < cap * 0.2);
  }
}

// 从个人电网取电（用于激光防御等耗电装备）。返回是否取到足够电力。
function drainPersonalPower(amount) {
  ensureEquip();
  if (G.personalPower >= amount) {
    G.personalPower -= amount;
    return true;
  }
  return false;
}

// ===== 能量护盾（对齐《异星工厂》Energy shield） =====
// 指定护甲网格内所有护盾的总吸收上限（armorId 省略时使用当前编辑/穿戴的护甲）。
function shieldCapacityOf(armorId) {
  ensureEquip();
  const grid = armorGridOf(armorId);
  let cap = 0;
  for (const e of grid || []) {
    const def = EQUIPMENT[e.id];
    if (def && def.shield) cap += def.shield;
  }
  return cap;
}
// 当前穿戴装备的所有护盾总吸收上限。
function totalShieldCapacity() {
  return shieldCapacityOf(G.armor);
}
// 当前护盾剩余可吸收量（受个人电网电力与护盾上限双重约束）。
// 每点伤害需消耗 5 单位个人电力（与个人电池 10MJ 量级匹配），护盾电量为 0 则无吸收能力。
function shieldRemaining() {
  ensureEquip();
  const cap = totalShieldCapacity();
  if (cap <= 0) return 0;
  return Math.min(cap, G.personalPower / 5);
}
// 用护盾吸收伤害。返回“实际扣除的玩家 HP 伤害”（已扣除被护盾吸收的部分）。
function applyShieldAbsorb(dmg) {
  ensureEquip();
  const cap = totalShieldCapacity();
  if (cap <= 0 || G.personalPower <= 0 || dmg <= 0) return dmg;
  const absorb = Math.min(dmg, cap, G.personalPower / 5);
  if (absorb <= 0) return dmg;
  G.personalPower -= absorb * 5;
  // 按各护盾缓冲扣减充能（护盾总量=各护盾 capE 之和），护盾缓冲 0 则该护盾无法吸收
  let rest = absorb;
  for (const e of wornEquipGrid()) {
    if (rest <= 0) break;
    if (EQUIPMENT[e.id] && EQUIPMENT[e.id].shield) {
      const used = Math.min(rest, e.e || 0);
      e.e = Math.max(0, (e.e || 0) - used);
      rest -= used;
    }
  }
  if (typeof spawnParticle === 'function') {
    for (let i = 0; i < 4; i++) spawnParticle('spark', G.player.x, G.player.y, { color: '#4ad0e0', speed: 3, life: 0.4 });
  }
  return Math.max(0, dmg - absorb);
}

// ===== 装备效果接入 =====
// 外骨骼速度加成：每个 +speed（叠加），作用于玩家移动速度。
function equipmentSpeedMult() {
  const n = equipCount('exoskeleton-equipment');
  return 1 + n * (EQUIPMENT['exoskeleton-equipment'].speed ?? 0.4);
}

// 夜视：当前是否启用夜视（夜间提亮）。
function hasNightVision() {
  return equipCount('night-vision-equipment') > 0;
}

// 个人激光防御：自动攻击进入射程的敌人，消耗个人电力（每发约 800 能量单位）。
const PERSONAL_LASER_DMG = 15;
const PERSONAL_LASER_COST = 800;   // 每发耗电（与个人电池容量 10MJ 量级匹配，按秒折算）
const PERSONAL_LASER_RATE = 0.6;   // 每个激光器开火间隔（秒）

// 每帧更新个人激光防御（战斗开启且有激光器时）。返回是否发射了激光。
function updatePersonalLaserDefense(dt) {
  const n = equipCount('personal-laser-defense-equipment');
  if (n <= 0 || !G.settings.combat || !G.enemies || G.enemies.length === 0) return false;
  if (!G.personalLaserT) G.personalLaserT = 0;
  G.personalLaserT -= dt;
  if (G.personalLaserT > 0) return false;
  // 找射程内最近的敌人
  const range = EQUIPMENT['personal-laser-defense-equipment'].laser * TILE;
  let target = null, bestD = Infinity;
  for (const en of G.enemies) {
    if (en.dead) continue;
    const d = Math.hypot(en.x - G.player.x, en.y - G.player.y);
    if (d <= range && d < bestD) { bestD = d; target = en; }
  }
  if (!target) return false;
  // 消耗个人电力；电力不足则不开火
  if (!drainPersonalPower(PERSONAL_LASER_COST)) return false;
  drainEquipCharge('personal-laser-defense-equipment', PERSONAL_LASER_COST);  // 同时扣减该激光器的充能缓冲
  // 对目标造成伤害（能量武器分类无限科技加成）
  const laserDmg = Math.round(PERSONAL_LASER_DMG * (typeof weaponCategoryMult === 'function' ? weaponCategoryMult('energy') : 1) * (typeof enemyResistMult === 'function' ? enemyResistMult(target, 'laser') : 1));
  target.hp -= laserDmg;
  if (target.hp <= 0) target.dead = true;
  G.personalLaserT = PERSONAL_LASER_RATE;
  // 激光特效（短暂闪光）
  (G.bullets || (G.bullets = [])).push({
    x: G.player.x, y: G.player.y, tx: target.x, ty: target.y, t: 0, life: 0.08,
    dmg: laserDmg, kind: 'laser'
  });
  uiDirty = true;
  return true;
}


// ===== 传送带免疫装备（对齐《异星工厂》Belt immunity equipment） =====
// 穿戴至少一件传送带免疫装备后，玩家站上传送带不再被带动位移。
function hasBeltImmunity() {
  return equipCount('belt-immunity-equipment') > 0;
}

// ===== 放电防御装备（对齐《异星工厂》Discharge defense） =====
// 手动激活（按快捷键或点击装备）后，以玩家为中心的大范围内所有敌人被连锁电击，
// 造成高额伤害并消耗个人电网电力。电力不足时无法激活。
const DISCHARGE_RANGE = GAME_DATA.equipment?.['discharge-defense-equipment']?.dischargeRange ?? 12;   // 电击半径（格，官方 attack_parameters.range 10）
const DISCHARGE_DMG = 100;          // 每个敌人受到的伤害
const DISCHARGE_COST = 5000;        // 每次激活耗电（与个人电池 10MJ 量级匹配）
const DISCHARGE_COOLDOWN = GAME_DATA.equipment?.['discharge-defense-equipment']?.dischargeCooldown ?? 2; // 激活冷却（秒，官方 cooldown 150tick=2.5s）

// 玩家是否已装备放电防御（用于快捷键判定）
function hasDischargeDefense() {
  return equipCount('discharge-defense-equipment') > 0;
}

// 激活放电防御：对周围敌人造成连锁电击。返回是否成功激活。
function activateDischargeDefense() {
  if (!hasDischargeDefense()) {
    if (typeof toast === 'function') toast('需要先安装「放电防御」装备');
    return false;
  }
  if (!G.settings.combat || !G.enemies || G.enemies.length === 0) {
    if (typeof toast === 'function') toast('当前没有敌人');
    return false;
  }
  if (G.dischargeCd > 0) return false;
  // 消耗个人电网电力；电力不足无法激活
  if (!drainPersonalPower(DISCHARGE_COST)) {
    if (typeof toast === 'function') toast('个人电网电力不足，无法放电');
    return false;
  }
  drainEquipCharge('discharge-defense-equipment', DISCHARGE_COST);  // 同时扣减放电防御的充能缓冲
  G.dischargeCd = DISCHARGE_COOLDOWN;
  const range = DISCHARGE_RANGE * TILE;
  const px = G.player.x, py = G.player.y;
  // 收集射程内敌人并逐一对每个敌人造成伤害（与手雷类似的范围电击）
  const hits = [];
  for (const en of G.enemies) {
    if (en.dead) continue;
    const d = Math.hypot(en.x - px, en.y - py);
    if (d <= range) { en.hp -= DISCHARGE_DMG; if (en.hp <= 0) en.dead = true; hits.push(en); }
  }
  // 电击特效：从玩家向每个被击中的敌人拉一道闪电弧（复用 bullet 管线，kind='laser' 短促亮弧）
  (G.bullets || (G.bullets = [])).push({
    x: px, y: py, tx: px, ty: py, t: 0, life: 0.06, dmg: 0, kind: 'laser'
  });
  for (const en of hits) {
    (G.bullets || (G.bullets = [])).push({
      x: px, y: py, tx: en.x, ty: en.y, t: 0, life: 0.12, dmg: 0, kind: 'laser', color: '#7ac0ff'
    });
  }
  if (typeof playSfx === 'function') playSfx('discharge');
  if (typeof spawnParticle === 'function') {
    for (let i = 0; i < 12; i++) spawnParticle('spark', px, py, { color: '#7ac0ff', speed: 8, life: 0.5 });
  }
  if (typeof toast === 'function') toast('⚡ 放电防御！击中 ' + hits.length + ' 个敌人');
  uiDirty = true;
  return true;
}

// 每帧推进放电防御冷却
function updateDischargeCooldown(dt) {
  if (G.dischargeCd > 0) G.dischargeCd -= dt;
}

// ===== 序列化 =====
// 每件模块化护甲独立保存其装备网格（G.armorGrids），存档时整体序列化。
function equipmentSerialize() {
  ensureEquip();
  const armorGrids = {};
  for (const aid of Object.keys(G.armorGrids)) {
    if (!ARMORS[aid] || !ARMORS[aid].grid) continue;
    armorGrids[aid] = (G.armorGrids[aid] || []).filter(e => e && isEquipment(e.id));
  }
  return {
    armorGrids: armorGrids,
    power: G.personalPower || 0
  };
}
function equipmentRestore(d) {
  G.armorGrids = {};
  if (d && d.armorGrids && typeof d.armorGrids === 'object') {
    for (const aid of Object.keys(d.armorGrids)) {
      if (!ARMORS[aid] || !ARMORS[aid].grid) continue;
      const arr = Array.isArray(d.armorGrids[aid]) ? d.armorGrids[aid] : [];
      G.armorGrids[aid] = arr.filter(e => e && isEquipment(e.id) && e.r >= 0 && e.c >= 0);
    }
  } else if (d && Array.isArray(d.grid)) {
    // 旧档单一网格：迁移到当前穿戴的模块化护甲（未穿戴则暂存到 modular-armor，后续穿戴时生效）
    const aid = (G.armor && ARMORS[G.armor] && ARMORS[G.armor].grid) ? G.armor : 'modular-armor';
    G.armorGrids[aid] = d.grid.filter(e => e && isEquipment(e.id));
  }
  G.personalPower = (d && typeof d.power === 'number') ? d.power : 0;
  G.personalPowerMax = 0;
  G.personalPowerProd = 0;
  ensureEquip();
}

// ===== 装备网格 UI（装甲面板/背包面板） =====
// 网格中每格一个格子；已有装备的格子占据其尺寸范围并显示图标。
// armorId 省略时使用当前正在编辑的护甲（activeArmorId：装甲面板打开时为其护甲，否则为穿戴护甲）。
function equipGridHtml(armorId) {
  ensureEquip();
  const aid = armorId || activeArmorId();
  const wh = equipGridWHFor(aid);
  if (!wh) return '<div class="dim">该护甲没有装备网格</div>';
  const cell = 42; // 每格像素（CSS 由 style.css 的 .eqgrid 控制）
  const wpx = wh.w * cell + (wh.w - 1) * 4;
  const hpx = wh.h * cell + (wh.h - 1) * 4;
  // 交互：从左侧背包拿起装备件（G.held），移到网格上显示幽灵占位，点击落子放置（见 equipGridMouseMove）。
  let h = '<div class="eqgrid" id="eqgrid-armor" data-aid="' + aid + '" data-tip="从左侧背包拿起装备件模块，移到网格显示占位并点击放置；点击已安装模块可卸下" style="width:' + wpx + 'px;height:' + hpx + 'px">';
  // 先铺背景格（w=列数, h=行数）
  for (let r = 0; r < wh.h; r++) {
    for (let c = 0; c < wh.w; c++) {
      h += '<div class="eqcell" data-eqpos="' + r + ',' + c + '" style="left:' + (c * (cell + 4)) + 'px;top:' + (r * (cell + 4)) + 'px;width:' + cell + 'px;height:' + cell + 'px"></div>';
    }
  }
  // 再铺已安装的装备（覆盖在格子上）
  for (const e of armorGridOf(aid) || []) {
    const def = EQUIPMENT[e.id];
    if (!def) continue;
    const s = def.size;
    const cap = equipCapE(e.id);
    // 充电信息（仅带充能缓冲的装备显示）：底部进度条 + 当前/容量 + 状态（由 refreshEquipChargeUI 实时更新数值/宽度）
    const chgHtml = cap > 0
      ? '<div class="eqcharge"><div class="eqbar"><i style="width:' + Math.max(0, Math.min(100, Math.round((e.e || 0) / cap * 100))) + '%"></i></div>' +
        '<div class="eqchg">' + Math.floor(e.e || 0) + '/' + cap + '</div>' +
        '<div class="eqsta">待充能</div></div>'
      : '';
    // 电量不足警告：电量低于阈值时红色三角闪烁（默认隐藏，由 refreshEquipChargeUI 实时开关 .on）
    const warnHtml = cap > 0
      ? '<div class="eqwarn"><div class="eqwarn-in"><div class="wtri">!</div><div class="wtxt">电量不足</div></div></div>'
      : '';
    h += '<div class="eqitem" data-eqpos="' + e.r + ',' + e.c + '" data-tip="' + (def.roboport ? roboportTip(e.id) : (ITEMS[e.id].name + '|' + def.desc)) + '（点击拿起，可移入背包/网格）" style="left:' + (e.c * (cell + 4)) + 'px;top:' + (e.r * (cell + 4)) + 'px;width:' + (s * cell + (s - 1) * 4) + 'px;height:' + (s * cell + (s - 1) * 4) + 'px">' +
      '<img src="' + iconDataURL(e.id) + '">' + chgHtml + warnHtml + '</div>';
  }
  // 放置幽灵：跟随鼠标，高亮当前模块将占据的格子
  h += '<div class="eqghost" style="display:none"></div>';
  h += '</div>';
  return h;
}

// 把装备件安装到指定护甲网格的指定坐标 (r,c)。从鼠标持握或背包扣 1 件。返回是否成功。
function installEquipAt(eid, r, c, armorId) {
  const aid = armorId || activeArmorId();
  const wh = equipGridWHFor(aid);
  if (!aid || !wh || !isEquipment(eid)) { toast('该护甲没有装备网格'); return false; }
  if (!canPlaceEquip(eid, r, c, aid)) { if (typeof toast === 'function') toast('这里放不下 ' + ITEMS[eid].name); return false; }
  // 消耗：优先鼠标持握的物品，其次从背包扣 1 件
  if (G.held && G.held.id === eid && G.held.count > 0) {
    G.held.count--;
    if (G.held.count <= 0) G.held = null;
  } else if (invCount(eid) >= 1) {
    invTake(eid, 1);
  } else {
    if (typeof toast === 'function') toast('背包里没有 ' + ITEMS[eid].name);
    return false;
  }
  armorGridOf(aid).push({ id: eid, r: r, c: c, e: (G.held && G.held._e) || 0 });
  if (typeof playSfx === 'function') playSfx('equip');
  if (typeof toast === 'function') toast('已安装 ' + ITEMS[eid].name + ' 到 ' + ARMORS[aid].name);
  uiDirty = true;
  return true;
}

// 从网格拿起一件装备到鼠标（G.held，src.kind='eq'），可再放回网格或点背包格放入背包（与物品移动一致）。
function equipPickup(r, c) {
  if (typeof cancelQuickBoxOnPickup === 'function') cancelQuickBoxOnPickup();
  const aid = activeArmorId();
  const grid = armorGridOf(aid);
  if (!grid) return false;
  const idx = grid.findIndex(e => e.r === r && e.c === c);
  if (idx < 0) return false;
  const ent = grid[idx];
  grid.splice(idx, 1);
  G.held = { id: ent.id, count: 1, src: { kind: 'eq', armor: aid, r: r, c: c }, _e: ent.e || 0 };
  if (typeof playSfx === 'function') playSfx('select');
  uiDirty = true;
  return true;
}

// 网格内鼠标移动：根据持握的装备件尺寸显示/隐藏放置幽灵。
// ev 为面板容器上的 mousemove 事件；若鼠标已离开装甲网格则隐藏幽灵。
function equipGridMouseMove(ev) {
  const grid = ev && ev.target && ev.target.closest ? ev.target.closest('#eqgrid-armor') : null;
  const ghost = document.getElementById('eqgrid-armor');
  if (ghost) {
    const gh = grid ? ghost.querySelector('.eqghost') : null;
    if (!gh) return; // 网格尚未渲染完成
    if (!grid || !G.held || !isEquipment(G.held.id)) {
      gh.style.display = 'none';
      return;
    }
    const aid = grid.dataset.aid;
    const wh = equipGridWHFor(aid);
    const def = EQUIPMENT[G.held.id];
    if (!wh || !def) { gh.style.display = 'none'; return; }
    const rect = grid.getBoundingClientRect();
    const cell = 42;
    const pitch = cell + 4; // 每格中心距（含间隔）
    let c = Math.floor((ev.clientX - rect.left) / pitch);
    let r = Math.floor((ev.clientY - rect.top) / pitch);
    c = Math.max(0, Math.min(wh.w - 1, c));
    r = Math.max(0, Math.min(wh.h - 1, r));
    // 鼠标定位到放置幽灵的中间：幽灵左上角格子 = 鼠标所在格 - ⌊尺寸/2⌋（对齐《异星工厂》拖放吸附）
    const s = def.size;
    const half = Math.floor(s / 2);
    let tlc = Math.max(0, Math.min(wh.w - s, c - half));
    let tlr = Math.max(0, Math.min(wh.h - s, r - half));
    const ok = canPlaceEquip(G.held.id, tlr, tlc, aid);
    gh.style.display = 'block';
    gh.style.left = (tlc * pitch) + 'px';
    gh.style.top = (tlr * pitch) + 'px';
    gh.style.width = (s * cell + (s - 1) * 4) + 'px';
    gh.style.height = (s * cell + (s - 1) * 4) + 'px';
    gh.className = 'eqghost ' + (ok ? 'ok' : 'bad');
    gh.innerHTML = '<b>' + ITEMS[G.held.id].name + ' ' + s + '×' + s + '</b>';
    G._eqHover = { r: tlr, c: tlc, aid: aid };
  }
}



// 处理装备网格相关点击。返回是否已处理。
// 支持背包面板（inv）与装甲面板（armor）两种模式。
function equipPanelClick(el) {
  if (G.panelMode !== 'inv' && G.panelMode !== 'armor') return false;
  // 点击放电防御按钮 → 激活
  if (el.closest('[data-discharge]')) {
    activateDischargeDefense();
    renderPanel(false);
    return true;
  }
  // 点击网格中的已安装装备 → 拿起于鼠标（与背包格点击一致的物品移动，可放回网格或点背包格放入背包）
  const eqItem = el.closest('.eqitem');
  if (eqItem) {
    const [r, c] = (eqItem.dataset.eqpos || '0,0').split(',').map(Number);
    if (typeof equipPickup === 'function' && equipPickup(r, c)) renderPanel(false);
    return true;
  }
  // 点击网格空白处：把鼠标持握（或背包中）的装备件放到鼠标所在格子（对齐《异星工厂》：拿起模块→网格点击放置）
  if (el.closest('#eqgrid-armor')) {
    if (G._eqHover) {
      if (G.held && isEquipment(G.held.id) && G.held.count > 0) {
        const placed = installEquipAt(G.held.id, G._eqHover.r, G._eqHover.c, G._eqHover.aid);
        if (placed) renderPanel(false);
        return true;
      }
      return true; // 无持握装备件时，点击网格无操作
    }
    return false;
  }
  return false;
}

