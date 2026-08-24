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
  'personal-laser-defense':   { name: '个人激光防御',      size: 1, laser: 9, desc: '射程 9 格' }
};
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

// ===== 装备效果接入 =====
// 外骨骼速度加成：每个 +40%（叠加），作用于玩家移动速度。
function equipmentSpeedMult() {
  const n = equipCount('exoskeleton');
  return 1 + n * 0.4;
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
  // 对目标造成伤害
  target.hp -= PERSONAL_LASER_DMG;
  if (target.hp <= 0) target.dead = true;
  G.personalLaserT = PERSONAL_LASER_RATE;
  // 激光特效（短暂闪光）
  (G.bullets || (G.bullets = [])).push({
    x: G.player.x, y: G.player.y, tx: target.x, ty: target.y, t: 0, life: 0.08,
    dmg: PERSONAL_LASER_DMG, kind: 'laser'
  });
  uiDirty = true;
  return true;
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
  return h;
}

// 处理装备网格相关点击。返回是否已处理。
function equipPanelClick(el) {
  if (G.panelMode !== 'inv') return false;
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

