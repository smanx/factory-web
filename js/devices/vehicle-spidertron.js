'use strict';

// ===== 蜘蛛机器人 Spidertron（对齐《异星工厂》Spidertron） =====
// 终极战斗载具：速度快、可跨越水域/墙体，具备车载自动炮塔（自动攻击附近敌人）
// 与玩家主炮（空格发射导弹造成范围爆炸）。
const SPIDER_SPEED = 340;          // 速度（像素/秒），高于坦克
const SPIDER_FUEL_BURN = 0.05;     // 每秒燃料消耗（固体燃料/煤）
const SPIDER_FUEL_CAP = 100;
const SPIDER_MISSILE_CAP = 50;     // 内置导弹容量
const SPIDER_TURRET_RANGE = 7;     // 车载自动炮塔射程（格）
const SPIDER_TURRET_RATE = 0.4;    // 自动炮塔射击间隔（秒）
const SPIDER_AUTO_DMG = 8;         // 自动炮塔单发伤害
const SPIDER_GRID = 4;             // 蜘蛛机器人装备网格尺寸（4×4，对齐《异星工厂》）
const SPIDER_LASER_RATE = 0.6;     // 装备个人激光防御开火间隔（秒）
const SPIDER_LASER_DMG = 15;
const SPIDER_LASER_COST = 800;     // 每发耗电

class Spidertron extends Tank {
  constructor(type, x, y) {
    super('spidertron', x, y);
    this.fuelCap = SPIDER_FUEL_CAP;
    this.missiles = 0;             // 内置导弹数（用 rocket 弹药）
    this.autoT = 0;                // 自动炮塔冷却
    // 蜘蛛机器人装备网格（对齐《异星工厂》Spidertron 自带 4×4 装备网格）
    this.equipGrid = [];           // [{id, r, c}]
    this.equipEnergy = 0;          // 装备电网当前电量
    this.equipEnergyMax = 0;       // 装备电网容量（含电池）
    this.equipEnergyProd = 0;      // 装备电网发电速率（太阳能板/聚变堆）
    this.spiderLaserT = 0;         // 个人激光防御冷却
  }
  // ===== 蜘蛛机器人装备网格：可安装外骨骼/激光/电池/聚变堆/护盾等装备件 =====
  spiderGridSize() { return SPIDER_GRID; }
  spiderEquipUsedSlots() { return this.equipGrid.length; }
  spiderCanPlace(eid, r, c) {
    const def = EQUIPMENT[eid];
    const size = SPIDER_GRID;
    if (!def) return false;
    const s = def.size;
    if (r < 0 || c < 0 || r + s > size || c + s > size) return false;
    for (const e of this.equipGrid) {
      const es = EQUIPMENT[e.id].size;
      if (e.r < r + s && e.r + es > r && e.c < c + s && e.c + es > c) return false;
    }
    return true;
  }
  spiderFindFreeSlot(eid) {
    const def = EQUIPMENT[eid];
    if (!def) return null;
    for (let r = 0; r <= SPIDER_GRID - def.size; r++)
      for (let c = 0; c <= SPIDER_GRID - def.size; c++)
        if (this.spiderCanPlace(eid, r, c)) return [r, c];
    return null;
  }
  spiderInstall(eid) {
    if (!isEquipment(eid)) return false;
    if (typeof invCount !== 'function' || invCount(eid) < 1) { if (typeof toast === 'function') toast('背包里没有 ' + ITEMS[eid].name); return false; }
    const slot = this.spiderFindFreeSlot(eid);
    if (!slot) { if (typeof toast === 'function') toast('装备网格已满'); return false; }
    invTake(eid, 1);
    this.equipGrid.push({ id: eid, r: slot[0], c: slot[1] });
    this.recomputeSpiderPower();
    if (typeof playSfx === 'function') playSfx('equip');
    if (typeof toast === 'function') toast('已安装 ' + ITEMS[eid].name);
    uiDirty = true;
    return true;
  }
  spiderRemove(r, c) {
    const idx = this.equipGrid.findIndex(e => e.r === r && e.c === c);
    if (idx < 0) return false;
    const e = this.equipGrid[idx];
    this.equipGrid.splice(idx, 1);
    if (typeof invAdd === 'function') invAdd(e.id, 1);
    this.recomputeSpiderPower();
    if (typeof playSfx === 'function') playSfx('unequip');
    if (typeof toast === 'function') toast('已卸下 ' + ITEMS[e.id].name);
    uiDirty = true;
    return true;
  }
  spiderEquipCount(id) { let n = 0; for (const e of this.equipGrid) if (e.id === id) n++; return n; }
  // 汇总装备电网：发电量（太阳能板随昼夜）+ 储电容量（电池）
  recomputeSpiderPower() {
    let prod = 0, cap = 0;
    for (const e of this.equipGrid) {
      const def = EQUIPMENT[e.id];
      if (def.powerOut) prod += def.powerOut;
      if (def.powerCap) cap += def.powerCap;
    }
    // 便携聚变反应堆全天候发电；个人太阳能板仅白天发电
    let solar = 0;
    for (const e of this.equipGrid) if (e.id === 'solar-panel-equipment' || e.id === 'portable-solar-panel-mk2') solar += EQUIPMENT[e.id].powerOut;
    const isDay = typeof isDaytime === 'function' ? isDaytime() : true;
    const totalProd = (prod - solar) + (isDay ? solar : 0);
    this.equipEnergyProd = totalProd;
    this.equipEnergyMax = cap;
    if (this.equipEnergy > this.equipEnergyMax) this.equipEnergy = this.equipEnergyMax;
  }
  // 从装备电网取电（返回是否足够）
  spiderDrainEnergy(need) {
    if (this.equipEnergy < need) return false;
    this.equipEnergy -= need;
    return true;
  }
  // 每帧更新装备电网：充放电 + 个人激光防御 + 护盾（由载具 update 调用）
  spiderUpdateEquipment(dt) {
    this.recomputeSpiderPower();
    // 发电充能
    this.equipEnergy = Math.min(this.equipEnergyMax, this.equipEnergy + this.equipEnergyProd * dt);
    // 个人激光防御：自动攻击射程内敌人（消耗装备电力）
    const laserN = this.spiderEquipCount('personal-laser-defense-equipment');
    if (laserN > 0 && G.settings.combat && G.enemies && G.enemies.length > 0) {
      this.spiderLaserT = (this.spiderLaserT || 0) - dt;
      if (this.spiderLaserT <= 0) {
        const cx = this.x * TILE + TILE * this.w / 2, cy = this.y * TILE + TILE * this.h / 2;
        const range = EQUIPMENT['personal-laser-defense-equipment'].laser * TILE;
        let target = null, bestD = Infinity;
        for (const en of G.enemies) {
          if (!en || en.dead) continue;
          const d = Math.hypot(en.x - cx, en.y - cy);
          if (d <= range && d < bestD) { bestD = d; target = en; }
        }
        if (target && this.spiderDrainEnergy(SPIDER_LASER_COST)) {
          this.spiderLaserT = SPIDER_LASER_RATE;
          const dmg = Math.round(SPIDER_LASER_DMG * (typeof weaponCategoryMult === 'function' ? weaponCategoryMult('energy') : 1));
          target.hp -= dmg;
          if (target.hp <= 0) target.dead = true;
          (G.bullets || (G.bullets = [])).push({ x: cx, y: cy, tx: target.x, ty: target.y, t: 0, life: 0.08, dmg, kind: 'laser' });
        }
      }
    }
  }
  // 外骨骼速度加成（×）
  spiderSpeedMult() {
    const n = this.spiderEquipCount('exoskeleton-equipment');
    return 1 + n * 0.4;
  }
  // 装备护盾：吸收载具所受伤害（返回剩余伤害）
  spiderShieldAbsorb(dmg) {
    const shieldN = this.spiderEquipCount('energy-shield-equipment') + this.spiderEquipCount('energy-shield-mk2-equipment') * 2;
    if (shieldN <= 0) return dmg;
    const per = EQUIPMENT['energy-shield-equipment'].shield;
    // 简单模型：每次受击最多吸收 shield 量（按护盾总数），电力充足时吸收
    if (this.spiderDrainEnergy(per)) {
      const absorbed = Math.min(dmg, per);
      return dmg - absorbed;
    }
    return dmg;
  }
  giveItem(item) {
    if (item === 'nuclear-fuel' && this.fuelCoal + this.fuelSolid + this.fuelRocket + (this.fuelNuclear||0) < SPIDER_FUEL_CAP) { this.fuelNuclear++; return true; }
    if (item === 'rocket-fuel' && this.fuelCoal + this.fuelSolid + this.fuelRocket + (this.fuelNuclear||0) < SPIDER_FUEL_CAP) { this.fuelRocket++; return true; }
    if (item === 'coal' && this.fuelCoal + this.fuelSolid + this.fuelRocket + (this.fuelNuclear||0) < SPIDER_FUEL_CAP) { this.fuelCoal++; return true; }
    if (item === 'solid-fuel' && this.fuelCoal + this.fuelSolid + this.fuelRocket + (this.fuelNuclear||0) < SPIDER_FUEL_CAP) { this.fuelSolid++; return true; }
    if (item === 'rocket' && this.missiles < SPIDER_MISSILE_CAP) { this.missiles++; return true; }
    // 其余物品放入储物箱
    return this.trunkGiveItem(item);
  }
  takeItemOf(item) {
    if (item === 'rocket' && this.missiles > 0) { this.missiles--; return 'rocket'; }
    return super.takeItemOf(item);
  }
  countOf(item) {
    if (item === 'rocket') return this.missiles;
    return super.countOf(item);
  }
  contents() {
    const rows = super.contents();
    if (this.missiles > 0) rows.push(['rocket', this.missiles]);
    return rows;
  }
  takeAll() {
    const rows = super.takeAll();
    if (this.missiles > 0) rows.push(['rocket', this.missiles]);
    this.missiles = 0;
    return rows;
  }
  serialize() { const s = super.serialize(); s.missiles = this.missiles; if (this.equipGrid && this.equipGrid.length) s.spiderEquip = this.equipGrid; s.spiderEnergy = this.equipEnergy || 0; return s; }
  static restore(s) { const c = super.restore(s); c.missiles = s.missiles | 0; c.equipGrid = s.spiderEquip ? JSON.parse(JSON.stringify(s.spiderEquip)) : []; c.equipEnergy = s.spiderEnergy || 0; c.spiderLaserT = 0; return c; }
  // 车载自动炮塔：自动攻击附近的敌人（无需玩家操作）
  autoTurret(dt) {
    this.autoT = (this.autoT || 0) - dt;
    if (this.autoT > 0) return;
    const cx = this.x * TILE + TILE * this.w / 2, cy = this.y * TILE + TILE * this.h / 2;
    let best = null, bestD = Infinity;
    for (const en of (G.enemies || [])) {
      if (!en || en.dead) continue;
      const d = Math.hypot(en.x - cx, en.y - cy) / TILE;
      if (d <= SPIDER_TURRET_RANGE && d < bestD) { best = en; bestD = d; }
    }
    if (!best) return;
    this.autoT = SPIDER_TURRET_RATE;
    const autoDmg = Math.round(SPIDER_AUTO_DMG * (typeof weaponDamageMult === 'function' ? weaponDamageMult() : 1) * (typeof weaponCategoryMult === 'function' ? weaponCategoryMult('projectile') : 1));
    best.hp -= autoDmg;
    if (best.hp <= 0) best.dead = true;
    (G.bullets || (G.bullets = [])).push({
      x: cx, y: cy, tx: best.x, ty: best.y, t: 0, life: 0.12, kind: 'bullet', dmg: autoDmg
    });
  }
  // 主炮：发射导弹（范围爆炸），消耗内置导弹
  fire(tx, ty) {
    if (this.missiles <= 0) { if (typeof toast === 'function') toast('蜘蛛机器人需要导弹（rocket）'); return false; }
    this.missiles--;
    const px = this.x * TILE + TILE * this.w / 2, py = this.y * TILE + TILE * this.h / 2;
    const dist = 12 * TILE;
    const a = Math.atan2(ty - py, tx - px);
    const tx2 = px + Math.cos(a) * dist, ty2 = py + Math.sin(a) * dist;
    (G.bullets || (G.bullets = [])).push({
      x: px, y: py, tx: tx2, ty: ty2, t: 0, life: 0.3,
      splash: 3.5, dmg: Math.round(70 * (typeof weaponDamageMult === 'function' ? weaponDamageMult() : 1) * (typeof weaponCategoryMult === 'function' ? weaponCategoryMult('explosives') : 1)), kind: 'rocket', tank: true
    });
    this.fireT = 0.9;
    uiDirty = true;
    return true;
  }
  // 遥控自主移动：被蜘蛛遥控器下达移动命令后，自动朝目标格寻路并沿途开火
  update(dt) {
    // 每帧更新装备电网（发电/激光防御），无论是否在遥控移动
    this.spiderUpdateEquipment(dt);
    if (!this.remoteTarget) return;
    // 卡死检测：若一段时间无法有效接近目标（位置未变），则放弃命令，避免每帧无效计算
    if (this._stallT === undefined) { this._stallT = 0; this._lastD = Infinity; }
    const dist0 = Math.hypot((this.remoteTarget.x + 0.5) * TILE - (this.x + this.w / 2) * TILE, (this.remoteTarget.y + 0.5) * TILE - (this.y + this.h / 2) * TILE);
    if (dist0 >= this._lastD - 2) this._stallT += dt; else this._stallT = 0;
    this._lastD = dist0;
    if (this._stallT > 3) {
      this.remoteTarget = null; this._stallT = 0; this._lastD = Infinity;
      if (typeof toast === 'function') toast('蜘蛛机器人无法到达目标点（被障碍阻挡）');
      return;
    }
    // 车载自动炮塔持续开火（自主移动时也生效）
    this.autoTurret(dt);
    const t = this.remoteTarget;
    const cx = this.x * TILE + TILE * this.w / 2, cy = this.y * TILE + TILE * this.h / 2;
    const tcx = t.x * TILE + TILE / 2, tcy = t.y * TILE + TILE / 2;
    const dx = tcx - cx, dy = tcy - cy;
    const dist = Math.hypot(dx, dy);
    // 到达目标格：停下并清除命令
    if (dist < TILE * 0.6) { this.remoteTarget = null; return; }
    // 燃料不足则无法移动
    if (this.fuelCoal <= 0 && this.fuelSolid <= 0 && this.fuelRocket <= 0 && (this.fuelNuclear||0) <= 0 && (this.fuelWood||0) <= 0) return;
    const speed = SPIDER_SPEED * this.spiderSpeedMult();
    const mx = dx / dist, my = dy / dist;
    // 更新朝向（东/南/西/北近似）
    if (Math.abs(mx) > Math.abs(my)) this.dir = mx > 0 ? 0 : 2;
    else this.dir = my > 0 ? 1 : 3;
    const nx = cx + mx * speed * dt, ny = cy + my * speed * dt;
    // 蜘蛛可跨水/墙，仅需避开其他建筑实体
    const r = 14;
    let okX = !boxBlocked(nx, cy, r), okY = !boxBlocked(cx, ny, r);
    let ntx = this.x, nty = this.y;
    if (okX) ntx = Math.floor(nx / TILE);
    if (okY) nty = Math.floor(ny / TILE);
    // 目的地格子被占用则跳过（蜘蛛可越过石墙，其余实体阻挡）
    let targetOccupied = false;
    if (ntx !== this.x || nty !== this.y) {
      for (let dy2 = 0; dy2 < this.h && !targetOccupied; dy2++)
        for (let dx2 = 0; dx2 < this.w && !targetOccupied; dx2++) {
          const other = entAt(ntx + dx2, nty + dy2);
          if (other && other !== this && !(other.type === 'stone-wall')) targetOccupied = true;
        }
    }
    if (targetOccupied) return;
    if (ntx !== this.x || nty !== this.y) {
      // 空间索引重定位
      const ob = bucketKey(this.x, this.y);
      const obs = G.buckets.get(ob);
      if (obs) { obs.delete(this); if (!obs.size) G.buckets.delete(ob); }
      for (let dy2 = 0; dy2 < this.h; dy2++)
        for (let dx2 = 0; dx2 < this.w; dx2++) {
          const k = entKey(this.x + dx2, this.y + dy2);
          if (G.grid.get(k) === this) G.grid.delete(k);
        }
      this.x = ntx; this.y = nty;
      ensureBucket(bucketKey(this.x, this.y)).add(this);
      for (let dy2 = 0; dy2 < this.h; dy2++)
        for (let dx2 = 0; dx2 < this.w; dx2++)
          G.grid.set(entKey(this.x + dx2, this.y + dy2), this);
      if (typeof invalidateBeltInputNear === 'function') invalidateBeltInputNear(this.x, this.y, this.w, this.h);
    }
    this.burnFuel(SPIDER_FUEL_BURN * dt);
  }
}
function drawSpidertron(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w;
  ctx.globalAlpha = alpha;
  // 六足（四条固定腿 + 身体），深紫色步行机
  ctx.strokeStyle = '#4a3a6a';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const lx = px + s / 2 + Math.cos(a) * s * 0.38;
    const ly = py + s / 2 + Math.sin(a) * s * 0.38;
    ctx.beginPath();
    ctx.moveTo(px + s / 2, py + s / 2);
    ctx.lineTo(lx, ly);
    ctx.stroke();
  }
  ctx.lineCap = 'butt';
  // 身体
  ctx.fillStyle = '#6a58b0';
  ctx.beginPath(); ctx.arc(px + s / 2, py + s / 2, 20, 0, 7); ctx.fill();
  ctx.strokeStyle = '#45358a';
  ctx.lineWidth = 3;
  ctx.stroke();
  // 座舱（玩家方向）
  ctx.fillStyle = '#8a7ad0';
  ctx.beginPath(); ctx.arc(px + s / 2, py + s / 2, 10, 0, 7); ctx.fill();
  // 主炮朝向
  const ang = e.dir * Math.PI / 2;
  ctx.strokeStyle = '#3a2f5a';
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.moveTo(px + s / 2 + Math.cos(ang) * 8, py + s / 2 + Math.sin(ang) * 8);
  ctx.lineTo(px + s / 2 + Math.cos(ang) * 34, py + s / 2 + Math.sin(ang) * 34);
  ctx.stroke();
  ctx.globalAlpha = 1;
}
function spiderTip(e) {
  return '蜘蛛机器人：终极载具，可跨水/墙；车载自动炮塔 + 空格发射导弹';
}
// ===== 装甲车/坦克装备网格面板（对齐《异星工厂》：Car 5×5、Tank 6×6 装备网格） =====
function vehEquipHtml(e) {
  const size = e.vehGridSize();
  if (size <= 0) return '';
  const cell = 42;
  const vname = e.type === 'tank' ? '坦克' : '装甲车';
  let h = '<div class="sec">载具装备网格（' + vname + ' ' + size + '×' + size + '）</div>';
  h += '<div class="eqgrid" style="width:' + (size * cell + size * 4) + 'px;height:' + (size * cell + size * 4) + 'px">';
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++)
    h += '<div class="eqcell" data-veq="' + r + ',' + c + '" style="left:' + (c * (cell + 4)) + 'px;top:' + (r * (cell + 4)) + 'px;width:' + cell + 'px;height:' + cell + 'px"></div>';
  for (const eq of (e.equipGrid || [])) {
    const def = EQUIPMENT[eq.id]; if (!def) continue;
    const s = def.size;
    h += '<div class="eqitem" data-veq="' + eq.r + ',' + eq.c + '" data-tip="' + ITEMS[eq.id].name + '|' + def.desc + '（点击卸下）" style="left:' + (eq.c * (cell + 4)) + 'px;top:' + (eq.r * (cell + 4)) + 'px;width:' + (s * cell + (s - 1) * 4) + 'px;height:' + (s * cell + (s - 1) * 4) + 'px">' +
      '<img src="' + iconDataURL(eq.id) + '"><b>' + ITEMS[eq.id].name + '</b></div>';
  }
  h += '</div>';
  h += '<div class="eqlist">';
  for (const eid in EQUIPMENT) {
    const n = typeof invCount === 'function' ? invCount(eid) : 0;
    if (n <= 0) continue;
    const def = EQUIPMENT[eid];
    const equippedN = e.vehEquipCount(eid);
    h += '<button class="rcbtn" data-veqinstall="' + eid + '" data-tip="' + ITEMS[eid].name + '|' + def.desc + '">' +
      '<img src="' + iconDataURL(eid) + '">' + ITEMS[eid].name + (equippedN > 0 ? ' 已装×' + equippedN : '') + ' 背包×' + n + '</button>';
  }
  h += '</div>';
  const pct = e.equipEnergyMax > 0 ? Math.round(e.equipEnergy / e.equipEnergyMax * 100) : 0;
  h += '<div class="dim">载具装备电网：发电 ' + Math.round(e.equipEnergyProd) + ' kW' +
    (e.equipEnergyMax > 0 ? ' · 储电 ' + Math.round(e.equipEnergy / 1000) + '/' + Math.round(e.equipEnergyMax / 1000) + ' MJ（' + pct + '%）' : '（未装电池）') + '</div>';
  h += '<div class="dim">外骨骼提升载具移动速度（每个 +40%）、能量护盾受击时消耗电网电力吸收伤害、个人激光防御自动攻击敌人（耗电）、夜视/传送带免疫驾驶时生效。点击背包装备件安装到网格空位，点击网格中的装备件卸下。</div>';
  return h;
}
// 处理装甲车/坦克装备网格点击（安装/卸下）。返回是否已处理。
function vehEquipPanelClick(el) {
  if (!G.panelEnt || !(G.panelEnt instanceof Car) || G.panelEnt instanceof Spidertron) return false;
  const eqItem = el.closest('.eqitem');
  if (eqItem) {
    const [r, c] = (eqItem.dataset.veq || '0,0').split(',').map(Number);
    G.panelEnt.vehRemove(r, c);
    renderPanel(false);
    return true;
  }
  const ins = el.closest('[data-veqinstall]');
  if (ins) {
    G.panelEnt.vehInstall(ins.dataset.veqinstall);
    renderPanel(false);
    return true;
  }
  return false;
}

// ===== 蜘蛛机器人装备网格面板（对齐《异星工厂》：Spidertron 自带 4×4 装备网格） =====
function spiderEquipHtml(e) {
  const size = e.spiderGridSize();
  const cell = 42;
  let h = '<div class="sec">装备网格（' + size + '×' + size + '）</div>';
  h += '<div class="eqgrid" style="width:' + (size * cell + size * 4) + 'px;height:' + (size * cell + size * 4) + 'px">';
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++)
    h += '<div class="eqcell" data-spidereq="' + r + ',' + c + '" style="left:' + (c * (cell + 4)) + 'px;top:' + (r * (cell + 4)) + 'px;width:' + cell + 'px;height:' + cell + 'px"></div>';
  for (const eq of e.equipGrid) {
    const def = EQUIPMENT[eq.id]; if (!def) continue;
    const s = def.size;
    h += '<div class="eqitem" data-spidereq="' + eq.r + ',' + eq.c + '" data-tip="' + ITEMS[eq.id].name + '|' + def.desc + '（点击卸下）" style="left:' + (eq.c * (cell + 4)) + 'px;top:' + (eq.r * (cell + 4)) + 'px;width:' + (s * cell + (s - 1) * 4) + 'px;height:' + (s * cell + (s - 1) * 4) + 'px">' +
      '<img src="' + iconDataURL(eq.id) + '"><b>' + ITEMS[eq.id].name + '</b></div>';
  }
  h += '</div>';
  h += '<div class="eqlist">';
  for (const eid in EQUIPMENT) {
    const n = typeof invCount === 'function' ? invCount(eid) : 0;
    if (n <= 0) continue;
    const def = EQUIPMENT[eid];
    const equippedN = e.spiderEquipCount(eid);
    h += '<button class="rcbtn" data-spiderinstall="' + eid + '" data-tip="' + ITEMS[eid].name + '|' + def.desc + '">' +
      '<img src="' + iconDataURL(eid) + '">' + ITEMS[eid].name + (equippedN > 0 ? ' 已装×' + equippedN : '') + ' 背包×' + n + '</button>';
  }
  h += '</div>';
  const pct = e.equipEnergyMax > 0 ? Math.round(e.equipEnergy / e.equipEnergyMax * 100) : 0;
  h += '<div class="dim">装备电网：发电 ' + Math.round(e.equipEnergyProd) + ' kW' +
    (e.equipEnergyMax > 0 ? ' · 储电 ' + Math.round(e.equipEnergy / 1000) + '/' + Math.round(e.equipEnergyMax / 1000) + ' MJ（' + pct + '%）' : '（未装电池）') + '</div>';
  h += '<div class="dim">外骨骼提升移动速度、能量护盾受击时消耗电网电力吸收伤害、个人激光防御自动攻击敌人（耗电）。点击背包装备件安装到网格空位，点击网格中的装备件卸下。</div>';
  return h;
}

// 处理蜘蛛机器人装备网格点击（安装/卸下）。返回是否已处理。
function spiderEquipPanelClick(el) {
  if (!G.panelEnt || !(G.panelEnt instanceof Spidertron)) return false;
  // 点击网格中的装备 → 卸下
  const eqItem = el.closest('.eqitem');
  if (eqItem) {
    const [r, c] = (eqItem.dataset.spidereq || '0,0').split(',').map(Number);
    G.panelEnt.spiderRemove(r, c);
    renderPanel(false);
    return true;
  }
  // 点击可安装装备件 → 安装
  const ins = el.closest('[data-spiderinstall]');
  if (ins) {
    G.panelEnt.spiderInstall(ins.dataset.spiderinstall);
    renderPanel(false);
    return true;
  }
  return false;
}

function spiderPanelHtml(e) {
  let h = row('燃料', vehicleFuelDisplay(e, SPIDER_FUEL_CAP), 'fuel');
  h += row('导弹', e.missiles > 0 ? (e.missiles + ' / ' + SPIDER_MISSILE_CAP) : '<span class="dim">无</span>', 'missile');
  const cf = Math.min(invCount('coal'), SPIDER_FUEL_CAP - e.fuelCoal - e.fuelSolid - e.fuelRocket - (e.fuelNuclear||0) - (e.fuelWood||0));
  const csol = Math.min(invCount('solid-fuel'), SPIDER_FUEL_CAP - e.fuelCoal - e.fuelSolid - e.fuelRocket - (e.fuelNuclear||0) - (e.fuelWood||0));
  const crk = Math.min(invCount('rocket-fuel'), SPIDER_FUEL_CAP - e.fuelCoal - e.fuelSolid - e.fuelRocket - (e.fuelNuclear||0) - (e.fuelWood||0));
  const cnuc = Math.min(invCount('nuclear-fuel'), SPIDER_FUEL_CAP - e.fuelCoal - e.fuelSolid - e.fuelRocket - (e.fuelNuclear||0) - (e.fuelWood||0));
  const cwd = Math.min(invCount('wood'), SPIDER_FUEL_CAP - e.fuelCoal - e.fuelSolid - e.fuelRocket - (e.fuelNuclear||0) - (e.fuelWood||0));
  const cr = Math.min(invCount('rocket'), SPIDER_MISSILE_CAP - e.missiles);
  if (cnuc > 0) h += '<button data-action="feed" data-id="nuclear-fuel">放入核燃料 ×' + cnuc + '</button>';
  if (cf > 0) h += '<button data-action="feed" data-id="coal">放入煤 ×' + cf + '</button>';
  if (cwd > 0) h += '<button data-action="feed" data-id="wood">放入木材 ×' + cwd + '</button>';
  if (csol > 0) h += '<button data-action="feed" data-id="solid-fuel">放入固体燃料 ×' + csol + '</button>';
  if (crk > 0) h += '<button data-action="feed" data-id="rocket-fuel">放入火箭燃料 ×' + crk + '</button>';
  if (cr > 0) h += '<button data-action="feed" data-id="rocket">装填导弹 ×' + cr + '</button>';
  h += '<div class="status"></div>';
  h += '<button data-action="drive" class="primary">🚀 进入驾驶（空格发射导弹）</button>';
  h += '<div class="dim">蜘蛛机器人：终极战斗载具，速度快、可跨越水域与墙体；车载自动炮塔自动攻击附近敌人，按空格发射导弹（范围爆炸）。需高级战斗科技。</div>';
  h += trunkPanelHtml(e);
  h += spiderEquipHtml(e);
  return h;
}
function spiderPanelLive(e, api) {
  api.set('fuel', vehicleFuelDisplay(e, SPIDER_FUEL_CAP));
  api.set('missile', e.missiles > 0 ? (e.missiles + ' / ' + SPIDER_MISSILE_CAP) : dimSpan('无'));
  const cf = Math.min(invCount('coal'), SPIDER_FUEL_CAP - e.fuelCoal - e.fuelSolid - e.fuelRocket - (e.fuelNuclear||0));
  const csol = Math.min(invCount('solid-fuel'), SPIDER_FUEL_CAP - e.fuelCoal - e.fuelSolid - e.fuelRocket - (e.fuelNuclear||0));
  const crk = Math.min(invCount('rocket-fuel'), SPIDER_FUEL_CAP - e.fuelCoal - e.fuelSolid - e.fuelRocket - (e.fuelNuclear||0) - (e.fuelWood||0));
  const cnuc = Math.min(invCount('nuclear-fuel'), SPIDER_FUEL_CAP - e.fuelCoal - e.fuelSolid - e.fuelRocket - (e.fuelNuclear||0) - (e.fuelWood||0));
  const cwd = Math.min(invCount('wood'), SPIDER_FUEL_CAP - e.fuelCoal - e.fuelSolid - e.fuelRocket - (e.fuelNuclear||0) - (e.fuelWood||0));
  const cr = Math.min(invCount('rocket'), SPIDER_MISSILE_CAP - e.missiles);
  api.toggle('button[data-action="feed"][data-id="nuclear-fuel"]', cnuc > 0, '放入核燃料 ×' + cnuc);
  api.toggle('button[data-action="feed"][data-id="coal"]', cf > 0, '放入煤 ×' + cf);
  api.toggle('button[data-action="feed"][data-id="wood"]', cwd > 0, '放入木材 ×' + cwd);
  api.toggle('button[data-action="feed"][data-id="solid-fuel"]', csol > 0, '放入固体燃料 ×' + csol);
  api.toggle('button[data-action="feed"][data-id="rocket-fuel"]', crk > 0, '放入火箭燃料 ×' + crk);
  api.toggle('button[data-action="feed"][data-id="rocket"]', cr > 0, '装填导弹 ×' + cr);
  if (G.driving && G.driving.ent === e) api.status('驾驶中（空格发射导弹，E 下车）', 'ok');
  else if (e.fuelCoal <= 0 && e.fuelSolid <= 0 && e.fuelRocket <= 0 && (e.fuelNuclear||0) <= 0) api.status('缺燃料：放入煤/固体燃料/火箭燃料/核燃料后可驾驶', 'warn');
  else api.status('可驾驶', 'ok');
}

