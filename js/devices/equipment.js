'use strict';

// ===== 模块化护甲个人装备网格系统（对齐《异星工厂》Equipment grid / Modular armor）=====
// 模块化护甲自带“装备网格”（ARMORS[id].grid 为行列数），玩家可把个人装备件
// （太阳能板/电池/外骨骼/激光防御/聚变堆等）安装进网格。装备件按各自尺寸占用网格，
// 并即时生效：太阳能板/聚变堆为个人电网发电，电池储电，外骨骼加速，激光防御自动开火。
//
// 数据模型：
//   - G.equipGrid: 当前穿戴模块化护甲内的装备件数组 [{id, r, c}]（r=行, c=列）
//   - G.personalPower / G.personalPowerMax: 个人电网当前电量 / 容量（含电池）
//   - G.personalPowerProd: 个人电网发电速率（kW），由太阳能板/聚变堆产生
// 状态随存档持久化（见 equipmentSerialize / equipmentRestore），旧档自动从空网格开始。

// ===== 装备件定义 =====
// size: 占用网格的行×列；powerOut: 发电(kW)；powerCap: 储电(kJ)；speed: 速度加成(每件)；
// laser: 个人激光防御射程(格)；night: 夜视(布尔)。
const EQUIPMENT = {
  'portable-solar-panel':     { name: '个人太阳能板',      size: 1, powerOut: 30,  desc: '白天 30kW' },
  'portable-solar-panel-mk2': { name: '个人太阳能板 II',   size: 1, powerOut: 60,  desc: '白天 60kW' },
  'portable-fusion-reactor':  { name: '便携聚变反应堆',    size: 4, powerOut: 750, desc: '全天候 750kW' },
  'personal-battery':         { name: '个人电池',          size: 2, powerCap: 10000, desc: '储电 10MJ' },
  'personal-battery-mk2':     { name: '个人电池 II',       size: 2, powerCap: 20000, desc: '储电 20MJ' },
  'exoskeleton':              { name: '外骨骼',            size: 2, speed: 0.4, desc: '移动速度 +40%' },
  'nightvision':              { name: '夜视仪',            size: 1, night: true, desc: '夜间如白昼' },
  'personal-laser-defense':   { name: '个人激光防御',      size: 1, laser: 9, desc: '射程 9 格' },
  // 能量护盾：受击时优先消耗个人电网电力生成护盾吸收伤害（shield: 每件护盾吸收上限）
  'energy-shield':            { name: '能量护盾',          size: 2, shield: 200, desc: '吸收 200 伤害' },
  'energy-shield-mk2':        { name: '能量护盾 II',       size: 2, shield: 400, desc: '吸收 400 伤害' },
  // 传送带免疫：站上传送带不再被带动位移
  'belt-immunity-equipment':  { name: '传送带免疫',        size: 1, beltImmune: true, desc: '传送带推动免疫' },
  // 放电防御：手动激活对周围敌人释放连锁电击，消耗个人电网电力
  'discharge-defense':        { name: '放电防御',          size: 3, discharge: true, desc: '主动放电打击周围敌人' }
};
// 官方装备参数桥接（GAME_DATA.equipment 由 factorio-data 现场生成，见 tools/generate-game-data.js）。
// 仅覆盖官方有对应数据的数值字段（发电/储电/护盾/速度/射程/放电范围冷却）；
// 显示描述 desc、装备尺寸 size 及项目特有装备（portable-solar-panel-mk2 等）保持手工。
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
  }
}
function isEquipment(id) { return !!EQUIPMENT[id]; }

// 确保个人电网/装备状态初始化
function ensureEquip() {
  if (G.equipGrid === undefined) G.equipGrid = [];
  if (G.personalPower === undefined) G.personalPower = 0;
  if (G.personalPowerMax === undefined) G.personalPowerMax = 0;
  if (G.personalPowerProd === undefined) G.personalPowerProd = 0;
}

// 当前穿戴护甲的网格尺寸（非模块化护甲或无护甲返回 0）
function equipGridSize() {
  if (!G.armor || !ARMORS[G.armor]) return 0;
  return ARMORS[G.armor].grid || 0;
}

// 装备件在网格中是否可放置于 (r,c)（不越界、不与已有装备重叠）
function canPlaceEquip(eid, r, c) {
  const size = equipGridSize();
  const def = EQUIPMENT[eid];
  if (!def || size <= 0) return false;
  const s = def.size;
  if (r < 0 || c < 0 || r + s > size || c + s > size) return false;
  for (const e of G.equipGrid) {
    const es = EQUIPMENT[e.id].size;
    if (e.r < r + s && e.r + es > r && e.c < c + s && e.c + es > c) return false;
  }
  return true;
}

// 自动寻找网格中第一个可放置的空位，找不到返回 null
function findFreeSlot(eid) {
  const size = equipGridSize();
  const def = EQUIPMENT[eid];
  if (!def || size <= 0) return null;
  for (let r = 0; r <= size - def.size; r++)
    for (let c = 0; c <= size - def.size; c++)
      if (canPlaceEquip(eid, r, c)) return [r, c];
  return null;
}

// 安装一件装备到网格（自动找空位）。返回是否成功。
function installEquip(eid) {
  if (!isEquipment(eid)) return false;
  if (!G.armor || !ARMORS[G.armor] || !ARMORS[G.armor].grid) {
    if (typeof toast === 'function') toast('需要先穿戴带装备网格的模块化护甲');
    return false;
  }
  if (invCount(eid) < 1) { if (typeof toast === 'function') toast('背包里没有 ' + ITEMS[eid].name); return false; }
  const slot = findFreeSlot(eid);
  if (!slot) { if (typeof toast === 'function') toast('装备网格已满'); return false; }
  invTake(eid, 1);
  G.equipGrid.push({ id: eid, r: slot[0], c: slot[1] });
  if (typeof playSfx === 'function') playSfx('equip');
  if (typeof toast === 'function') toast('已安装 ' + ITEMS[eid].name);
  uiDirty = true;
  return true;
}

// 卸下一件装备（按网格坐标），返还背包。
function removeEquip(r, c) {
  const idx = G.equipGrid.findIndex(e => e.r === r && e.c === c);
  if (idx < 0) return false;
  const e = G.equipGrid[idx];
  G.equipGrid.splice(idx, 1);
  invAdd(e.id, 1);
  if (typeof playSfx === 'function') playSfx('unequip');
  if (typeof toast === 'function') toast('已卸下 ' + ITEMS[e.id].name);
  uiDirty = true;
  return true;
}

// 当前装备网格中某类装备件数量（如外骨骼数量、激光器数量）
function equipCount(id) {
  if (!G.equipGrid) return 0;
  let n = 0;
  for (const e of G.equipGrid) if (e.id === id) n++;
  return n;
}

// ===== 个人电网效果 =====
// 汇总个人电网：发电量（太阳能板随昼夜）、储电容量（电池）。
function recomputePersonalPower() {
  ensureEquip();
  let prod = 0, cap = 0;
  for (const e of G.equipGrid) {
    const def = EQUIPMENT[e.id];
    if (!def) continue;
    if (def.powerOut) {
      // 太阳能板随昼夜发电；聚变堆全天候满发
      const f = (e.id === 'portable-solar-panel' || e.id === 'portable-solar-panel-mk2')
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

// 每帧推进个人电网：发电充电，装备（激光防御/外骨骼等）耗电由各自逻辑处理。
function updatePersonalPower(dt) {
  ensureEquip();
  recomputePersonalPower();
  // 发电盈余充入个人电池（上限内）
  if (G.personalPowerProd > 0 && G.personalPowerMax > 0) {
    G.personalPower = Math.min(G.personalPowerMax, G.personalPower + G.personalPowerProd * dt);
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
// 当前装备的所有护盾总吸收上限。
function totalShieldCapacity() {
  ensureEquip();
  let cap = 0;
  for (const e of G.equipGrid) {
    const def = EQUIPMENT[e.id];
    if (def && def.shield) cap += def.shield;
  }
  return cap;
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
  if (typeof spawnParticle === 'function') {
    for (let i = 0; i < 4; i++) spawnParticle('spark', G.player.x, G.player.y, { color: '#4ad0e0', speed: 3, life: 0.4 });
  }
  return Math.max(0, dmg - absorb);
}

// ===== 装备效果接入 =====
// 外骨骼速度加成：每个 +speed（叠加），作用于玩家移动速度。
function equipmentSpeedMult() {
  const n = equipCount('exoskeleton');
  return 1 + n * (EQUIPMENT['exoskeleton'].speed ?? 0.4);
}

// 夜视：当前是否启用夜视（夜间提亮）。
function hasNightVision() {
  return equipCount('nightvision') > 0;
}

// 个人激光防御：自动攻击进入射程的敌人，消耗个人电力（每发约 800 能量单位）。
const PERSONAL_LASER_DMG = 15;
const PERSONAL_LASER_COST = 800;   // 每发耗电（与个人电池容量 10MJ 量级匹配，按秒折算）
const PERSONAL_LASER_RATE = 0.6;   // 每个激光器开火间隔（秒）

// 每帧更新个人激光防御（战斗开启且有激光器时）。返回是否发射了激光。
function updatePersonalLaserDefense(dt) {
  const n = equipCount('personal-laser-defense');
  if (n <= 0 || !G.settings.combat || !G.enemies || G.enemies.length === 0) return false;
  if (!G.personalLaserT) G.personalLaserT = 0;
  G.personalLaserT -= dt;
  if (G.personalLaserT > 0) return false;
  // 找射程内最近的敌人
  const range = EQUIPMENT['personal-laser-defense'].laser * TILE;
  let target = null, bestD = Infinity;
  for (const en of G.enemies) {
    if (en.dead) continue;
    const d = Math.hypot(en.x - G.player.x, en.y - G.player.y);
    if (d <= range && d < bestD) { bestD = d; target = en; }
  }
  if (!target) return false;
  // 消耗个人电力；电力不足则不开火
  if (!drainPersonalPower(PERSONAL_LASER_COST)) return false;
  // 对目标造成伤害（能量武器分类无限科技加成）
  const laserDmg = Math.round(PERSONAL_LASER_DMG * (typeof weaponCategoryMult === 'function' ? weaponCategoryMult('energy') : 1));
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
const DISCHARGE_RANGE = GAME_DATA.equipment?.['discharge-defense']?.dischargeRange ?? 12;   // 电击半径（格，官方 attack_parameters.range 10）
const DISCHARGE_DMG = 100;          // 每个敌人受到的伤害
const DISCHARGE_COST = 5000;        // 每次激活耗电（与个人电池 10MJ 量级匹配）
const DISCHARGE_COOLDOWN = GAME_DATA.equipment?.['discharge-defense']?.dischargeCooldown ?? 2; // 激活冷却（秒，官方 cooldown 150tick=2.5s）

// 玩家是否已装备放电防御（用于快捷键判定）
function hasDischargeDefense() {
  return equipCount('discharge-defense') > 0;
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
function equipmentSerialize() {
  ensureEquip();
  return {
    grid: (G.equipGrid || []).filter(e => isEquipment(e.id)),
    power: G.personalPower || 0
  };
}
function equipmentRestore(d) {
  G.equipGrid = (d && Array.isArray(d.grid)) ? d.grid.filter(e => isEquipment(e.id)) : [];
  G.personalPower = (d && typeof d.power === 'number') ? d.power : 0;
  G.personalPowerMax = 0;
  G.personalPowerProd = 0;
  ensureEquip();
}
// 更换护甲时保留原网格（若新护甲网格装得下则保留，否则清空并返还）
function migrateEquipGrid(oldArmor, newArmor) {
  ensureEquip();
  if (!oldArmor) return;
  // 新护甲同样带网格时尽量保留能放下的装备，放不下的返还背包
  const newSize = ARMORS[newArmor] ? (ARMORS[newArmor].grid || 0) : 0;
  const kept = [];
  for (const e of G.equipGrid) {
    const def = EQUIPMENT[e.id];
    if (!def) continue;
    if (newSize > 0 && e.r + def.size <= newSize && e.c + def.size <= newSize) {
      kept.push(e);
    } else {
      invAdd(e.id, 1);
      if (typeof toast === 'function') toast('装备 ' + ITEMS[e.id].name + ' 放不进新护甲，已返还背包');
    }
  }
  G.equipGrid = kept;
}

// ===== 装备网格 UI（背包面板） =====
// 网格中每格一个格子；已有装备的格子占据其尺寸范围并显示图标。
function equipGridHtml() {
  ensureEquip();
  const size = equipGridSize();
  if (size <= 0) return '<div class="dim">当前护甲没有装备网格</div>';
  const cell = 42; // 每格像素（CSS 由 style.css 的 .eqgrid 控制）
  let h = '<div class="eqgrid" style="width:' + (size * cell + size * 4) + 'px;height:' + (size * cell + size * 4) + 'px">';
  // 先铺背景格
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      h += '<div class="eqcell" data-eqpos="' + r + ',' + c + '" style="left:' + (c * (cell + 4)) + 'px;top:' + (r * (cell + 4)) + 'px;width:' + cell + 'px;height:' + cell + 'px"></div>';
    }
  }
  // 再铺已安装的装备（覆盖在格子上）
  for (const e of G.equipGrid) {
    const def = EQUIPMENT[e.id];
    if (!def) continue;
    const s = def.size;
    h += '<div class="eqitem" data-eqpos="' + e.r + ',' + e.c + '" data-tip="' + ITEMS[e.id].name + '|' + def.desc + '（点击卸下）" style="left:' + (e.c * (cell + 4)) + 'px;top:' + (e.r * (cell + 4)) + 'px;width:' + (s * cell + (s - 1) * 4) + 'px;height:' + (s * cell + (s - 1) * 4) + 'px">' +
      '<img src="' + iconDataURL(e.id) + '"><b>' + ITEMS[e.id].name + '</b></div>';
  }
  h += '</div>';
  // 可安装的装备件列表（背包中有货时）
  h += '<div class="eqlist">';
  for (const eid in EQUIPMENT) {
    const n = invCount(eid);
    const def = EQUIPMENT[eid];
    if (n <= 0) continue;
    const equippedN = equipCount(eid);
    h += '<button class="rcbtn' + (n > 0 ? '' : ' disabled') + '" data-eqinstall="' + eid + '" data-tip="' + ITEMS[eid].name + '|' + def.desc + '">' +
      '<img src="' + iconDataURL(eid) + '">' + ITEMS[eid].name + (equippedN > 0 ? ' 已装×' + equippedN : '') + (n > 0 ? ' 背包×' + n : '') + '</button>';
  }
  h += '</div>';
  h += '<div class="dim">点击右侧装备件图标安装到网格空位；点击网格中的装备件可卸下并返还背包。太阳能板/聚变堆发电、电池储电，为外骨骼/激光防御供能。</div>';
  return h;
}

// 个人电网状态展示
function equipPowerHtml() {
  ensureEquip();
  recomputePersonalPower();
  const pct = G.personalPowerMax > 0 ? Math.round(G.personalPower / G.personalPowerMax * 100) : 0;
  let h = '<div class="dim">个人电网：发电 ' + Math.round(G.personalPowerProd) + ' kW' +
    (G.personalPowerMax > 0 ? ' · 储电 ' + Math.round(G.personalPower / 1000) + '/' + Math.round(G.personalPowerMax / 1000) + ' MJ（' + pct + '%）' : '（未装电池，电力无法存储）') + '</div>';
  // 能量护盾状态
  if (typeof totalShieldCapacity === 'function' && totalShieldCapacity() > 0) {
    const cap = totalShieldCapacity();
    const rem = shieldRemaining();
    h += '<div class="dim">🛡 能量护盾：剩余 ' + Math.round(rem) + ' / ' + cap + ' 伤害吸收（受击时消耗个人电网电力）</div>';
  }
  // 放电防御：点击按钮激活
  if (hasDischargeDefense()) {
    const cd = Math.max(0, G.dischargeCd || 0);
    h += '<div class="dim"><button class="rcbtn" id="btn-discharge" data-discharge="1"' + (cd > 0 ? ' disabled' : '') + '>⚡ 放电防御（C 键，冷却 ' + cd.toFixed(1) + 's）</button><span class="dim">对周围 ' + DISCHARGE_RANGE + ' 格内敌人连锁电击，消耗 ' + (DISCHARGE_COST/1000) + 'MJ 个人电力</span></div>';
  }
  return h;
}

// 处理装备网格相关点击。返回是否已处理。
function equipPanelClick(el) {
  if (G.panelMode !== 'inv') return false;
  // 点击放电防御按钮 → 激活
  if (el.closest('[data-discharge]')) {
    activateDischargeDefense();
    renderPanel(false);
    return true;
  }
  // 点击网格中的装备 → 卸下
  const eqItem = el.closest('.eqitem');
  if (eqItem) {
    const [r, c] = (eqItem.dataset.eqpos || '0,0').split(',').map(Number);
    removeEquip(r, c);
    renderPanel(false);
    return true;
  }
  // 点击可安装装备件 → 安装
  const ins = el.closest('[data-eqinstall]');
  if (ins) {
    installEquip(ins.dataset.eqinstall);
    renderPanel(false);
    return true;
  }
  return false;
}

