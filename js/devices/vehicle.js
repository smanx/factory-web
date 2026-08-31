'use strict';

// ===== 载具（装甲车）：对齐《异星工厂》Car =====
// 可驾驶的 2×2 载具：玩家靠近后进入驾驶（WASD 更快移动），消耗煤作燃料，E 下车。
// 载具作为实体存在于网格中；玩家驾驶时由 updatePlayer 驱动它移动（玩家隐藏、相机跟随载具）。

const CAR_SPEED = 300;          // 载具速度（像素/秒，远超步行）
const CAR_FUEL_BURN = 0.08;     // 每秒消耗煤数（移动时）
const CAR_FUEL_CAP = 60;        // 载具燃料上限
// 坦克（重型战斗载具）：更慢但更厚，主炮发射炮弹
const TANK_SPEED = 190;
const TANK_FUEL_BURN = 0.14;
const TANK_FUEL_CAP = 120;
const TANK_SHELL_CAP = 40;       // 内置炮弹容量
const TANK_COLLIDE = 22;         // 坦克碰撞半径（比车大）
const TANK_ARMOR = 0.55;         // 驾驶坦克时玩家所受伤害系数（55%）
const TRUNK_SLOTS = 10;          // 载具储物箱槽位数（对齐《异星工厂》：汽车/坦克/蜘蛛机自带储物箱）
// ===== 载具燃料显示辅助（对齐《异星工厂》燃料分级：核燃料 > 火箭燃料 > 固体燃料 > 煤）=====
function vehicleFuelDisplay(e, cap) {
  const o = {};
  if ((e.fuelNuclear || 0) > 0) o['nuclear-fuel'] = e.fuelNuclear;
  if ((e.fuelRocket || 0) > 0) o['rocket-fuel'] = e.fuelRocket;
  if ((e.fuelSolid || 0) > 0) o['solid-fuel'] = e.fuelSolid;
  if ((e.fuelCoal || 0) > 0) o['coal'] = e.fuelCoal;
  if ((e.fuelWood || 0) > 0) o['wood'] = e.fuelWood;
  if (!Object.keys(o).length) return '<span class="dim">空</span> / ' + cap;
  return '<div class="asm3-inp-row">' + itemSlotsHtml(o, { action: 'display' }) + '</div> / ' + cap;
}


class Car extends Entity {
  constructor(type, x, y) {
    super(type, x, y);
    this.noGridPower = true;    // 载具靠燃料/装备电网驱动，不接入世界电网 → 不显示电线杆缺电警告
    this.fuelCoal = 0;          // 内置煤量
    this.fuelSolid = 0;         // 内置固体燃料量
    this.fuelRocket = 0;        // 内置火箭燃料量（最高级燃料，优先烧）
    this.fuelNuclear = 0;       // 内置核燃料量（终极燃料，最高级优先烧）
    this.fuelWood = 0;          // 内置木材量（低效燃料，最后烧）
    this.dir = 0;               // 0东1南2西3北（车头朝向）
    this.trunk = {};            // 储物箱：{ 物品id: 数量 }（对齐《异星工厂》载具自带储物箱）
    // 载具装备网格（对齐《异星工厂》Vehicle equipment grid）：Car 5×5、Tank 6×6（蜘蛛机用自带的 4×4 网格）
    this.equipGrid = [];           // [{id, r, c}]
    this.equipEnergy = 0;          // 装备电网当前电量
    this.equipEnergyMax = 0;       // 装备电网容量（含电池）
    this.equipEnergyProd = 0;      // 装备电网发电速率（太阳能板/聚变堆）
  }
  // ===== 载具储物箱（trunk）：可存放任意物品，槽位 = TRUNK_SLOTS，每槽不超过该物品堆叠上限 =====
  trunkUsedSlots() {
    let n = 0;
    for (const k in this.trunk) if (this.trunk[k] > 0) n++;
    return n;
  }
  trunkGiveItem(item) {
    const stk = (typeof stackSize === 'function') ? stackSize(item) : 100;
    const cur = this.trunk[item] || 0;
    if (cur >= stk) return false;                       // 当前堆叠已满
    if (cur === 0 && this.trunkUsedSlots() >= TRUNK_SLOTS) return false;  // 新物品但槽位已满
    this.trunk[item] = cur + 1;
    return true;
  }
  trunkTakeItemOf(item) {
    if ((this.trunk[item] || 0) > 0) { this.trunk[item]--; if (this.trunk[item] <= 0) delete this.trunk[item]; return item; }
    return null;
  }
  trunkCountOf(item) { return this.trunk[item] || 0; }
  giveItem(item) {
    if (item === 'nuclear-fuel' && this.fuelCoal + this.fuelSolid + this.fuelRocket + (this.fuelNuclear||0) + (this.fuelWood||0) < (this.fuelCap || CAR_FUEL_CAP)) { this.fuelNuclear++; return true; }
    if (item === 'rocket-fuel' && this.fuelCoal + this.fuelSolid + this.fuelRocket + (this.fuelNuclear||0) + (this.fuelWood||0) < (this.fuelCap || CAR_FUEL_CAP)) { this.fuelRocket++; return true; }
    if (item === 'coal' && this.fuelCoal + this.fuelSolid + this.fuelRocket + (this.fuelNuclear||0) + (this.fuelWood||0) < (this.fuelCap || CAR_FUEL_CAP)) { this.fuelCoal++; return true; }
    if (item === 'solid-fuel' && this.fuelCoal + this.fuelSolid + this.fuelRocket + (this.fuelNuclear||0) + (this.fuelWood||0) < (this.fuelCap || CAR_FUEL_CAP)) { this.fuelSolid++; return true; }
    if (item === 'wood' && this.fuelCoal + this.fuelSolid + this.fuelRocket + (this.fuelNuclear||0) + (this.fuelWood||0) < (this.fuelCap || CAR_FUEL_CAP)) { this.fuelWood++; return true; }
    // 其余物品放入储物箱
    return this.trunkGiveItem(item);
  }
  peekItem() { return null; }
  takeItem() { return null; }
  countOf(item) {
    if (item === 'coal') return this.fuelCoal;
    if (item === 'solid-fuel') return this.fuelSolid;
    if (item === 'nuclear-fuel') return this.fuelNuclear;
    if (item === 'rocket-fuel') return this.fuelRocket;
    if (item === 'wood') return this.fuelWood;
    return this.trunkCountOf(item);
  }
  takeItemOf(item) {
    if (item === 'coal' && this.fuelCoal > 0) { this.fuelCoal--; return 'coal'; }
    if (item === 'solid-fuel' && this.fuelSolid > 0) { this.fuelSolid--; return 'solid-fuel'; }
    if (item === 'nuclear-fuel' && this.fuelNuclear > 0) { this.fuelNuclear--; return 'nuclear-fuel'; }
    if (item === 'rocket-fuel' && this.fuelRocket > 0) { this.fuelRocket--; return 'rocket-fuel'; }
    if (item === 'wood' && this.fuelWood > 0) { this.fuelWood--; return 'wood'; }
    return this.trunkTakeItemOf(item);
  }
  contents() {
    const list = [[this.type, 1]];
    if (this.fuelNuclear > 0) list.push(['nuclear-fuel', this.fuelNuclear]);
    if (this.fuelRocket > 0) list.push(['rocket-fuel', this.fuelRocket]);
    if (this.fuelSolid > 0) list.push(['solid-fuel', this.fuelSolid]);
    if (this.fuelCoal > 0) list.push(['coal', this.fuelCoal]);
    if (this.fuelWood > 0) list.push(['wood', this.fuelWood]);
    for (const k in this.trunk) if (this.trunk[k] > 0) list.push([k, this.trunk[k]]);
    return list;
  }
  takeAll() {
    const rows = [];
    if (this.fuelNuclear > 0) rows.push(['nuclear-fuel', this.fuelNuclear]);
    if (this.fuelRocket > 0) rows.push(['rocket-fuel', this.fuelRocket]);
    if (this.fuelSolid > 0) rows.push(['solid-fuel', this.fuelSolid]);
    if (this.fuelCoal > 0) rows.push(['coal', this.fuelCoal]);
    if (this.fuelWood > 0) rows.push(['wood', this.fuelWood]);
    for (const k in this.trunk) if (this.trunk[k] > 0) rows.push([k, this.trunk[k]]);
    this.fuelCoal = 0; this.fuelSolid = 0; this.fuelRocket = 0; this.fuelNuclear = 0; this.fuelWood = 0; this.trunk = {};
    return rows;
  }
  // 行驶时烧燃料：优先烧固体燃料（更耐用），其次烧煤
  // 受「燃料效率」无限科技影响：乘 fuelConsumptionMult()（<1）让每单位燃料更耐用
  burnFuel(n) {
    n *= fuelConsumptionMult();
    if (this.fuelNuclear > 0) this.fuelNuclear = Math.max(0, this.fuelNuclear - n);
    else if (this.fuelRocket > 0) this.fuelRocket = Math.max(0, this.fuelRocket - n);
    else if (this.fuelSolid > 0) this.fuelSolid = Math.max(0, this.fuelSolid - n);
    else if (this.fuelCoal > 0) this.fuelCoal = Math.max(0, this.fuelCoal - n);
    else this.fuelWood = Math.max(0, this.fuelWood - n);
  }
  // 载具无需电力
  powerDemand() { return 0; }
  update(dt) {}

  // ===== 车载机枪（对齐《异星工厂》Car 车载机枪） =====
  // 装甲车自带车载机枪：驾驶时按住空格向光标方向自动连发子弹，
  // 消耗玩家背包中的弹药（优先穿甲弹、其次普通弹药匣），实现边驾驶边射击（对齐原版）。
  fireMachineGun(tx, ty) {
    // 弹药检查：优先穿甲弹（威力更高），其次普通弹药匣（对齐《异星工厂》优先级）
    let use = null;
    if (typeof invCount === 'function' && invCount('piercing-rounds-magazine') > 0) use = 'piercing-rounds-magazine';
    else if (typeof invCount === 'function' && invCount('firearm-magazine') > 0) use = 'firearm-magazine';
    if (!use) return false;
    if (typeof invTake === 'function') invTake(use, 1);
    // 车载机枪伤害：穿甲弹强于普通弹（对齐原版）；叠加通用武器伤害与投射物伤害无限科技
    const base = 8 * (use === 'piercing-rounds-magazine' ? 1.6 : 1) *
      (typeof weaponDamageMult === 'function' ? weaponDamageMult() : 1) *
      (typeof weaponCategoryMult === 'function' ? weaponCategoryMult('projectile') : 1);
    const px = this.x * TILE + TILE * this.w / 2, py = this.y * TILE + TILE * this.h / 2;
    const a = Math.atan2(ty - py, tx - px) + (Math.random() - 0.5) * 0.12; // 轻微的散射（对齐原版车载机枪散布）
    const dist = 8 * TILE;
    const tx2 = px + Math.cos(a) * dist, ty2 = py + Math.sin(a) * dist;
    (G.bullets || (G.bullets = [])).push({
      x: px, y: py, tx: tx2, ty: ty2, t: 0, life: 0.12,
      dmg: Math.round(base), kind: 'bullet', carMG: true
    });
    if (typeof playSfx === 'function') playSfx('machine-gun');
    uiDirty = true;
    return true;
  }

  // ===== 载具装备网格（对齐《异星工厂》：Car 5×5、Tank 6×6；蜘蛛机用自带 4×4） =====
  vehGridSize() { return (typeof VEHICLE_GRIDS === 'object') ? (VEHICLE_GRIDS[this.type] || 0) : 0; }
  vehEquipUsedSlots() { return (this.equipGrid || []).length; }
  vehEquipCount(id) { let n = 0; for (const e of (this.equipGrid || [])) if (e.id === id) n++; return n; }
  vehCanPlace(eid, r, c) {
    const def = EQUIPMENT[eid]; const size = this.vehGridSize();
    if (!def || size <= 0) return false;
    const s = def.size;
    if (r < 0 || c < 0 || r + s > size || c + s > size) return false;
    for (const e of (this.equipGrid || [])) {
      const es = EQUIPMENT[e.id].size;
      if (e.r < r + s && e.r + es > r && e.c < c + s && e.c + es > c) return false;
    }
    return true;
  }
  vehFindFreeSlot(eid) {
    const def = EQUIPMENT[eid];
    if (!def) return null;
    const size = this.vehGridSize();
    for (let r = 0; r <= size - def.size; r++)
      for (let c = 0; c <= size - def.size; c++)
        if (this.vehCanPlace(eid, r, c)) return [r, c];
    return null;
  }
  vehInstall(eid) {
    if (!isEquipment(eid)) return false;
    if (typeof invCount !== 'function' || invCount(eid) < 1) { if (typeof toast === 'function') toast('背包里没有 ' + ITEMS[eid].name); return false; }
    const slot = this.vehFindFreeSlot(eid);
    if (!slot) { if (typeof toast === 'function') toast('载具装备网格已满'); return false; }
    invTake(eid, 1);
    this.equipGrid.push({ id: eid, r: slot[0], c: slot[1] });
    this.vehRecomputePower();
    if (typeof playSfx === 'function') playSfx('equip');
    if (typeof toast === 'function') toast('已安装 ' + ITEMS[eid].name + ' 到载具装备网格');
    uiDirty = true;
    return true;
  }
  vehRemove(r, c) {
    const idx = (this.equipGrid || []).findIndex(e => e.r === r && e.c === c);
    if (idx < 0) return false;
    const e = this.equipGrid[idx];
    this.equipGrid.splice(idx, 1);
    if (typeof invAdd === 'function') invAdd(e.id, 1);
    this.vehRecomputePower();
    if (typeof playSfx === 'function') playSfx('unequip');
    if (typeof toast === 'function') toast('已卸下 ' + ITEMS[e.id].name + ' 并返还背包');
    uiDirty = true;
    return true;
  }
  vehRecomputePower() {
    let prod = 0, cap = 0;
    for (const e of (this.equipGrid || [])) {
      const def = EQUIPMENT[e.id];
      if (def.powerOut) prod += def.powerOut;
      if (def.powerCap) cap += def.powerCap;
    }
    let solar = 0;
    for (const e of (this.equipGrid || [])) if (e.id === 'solar-panel-equipment') solar += EQUIPMENT[e.id].powerOut;
    const isDay = typeof isDaytime === 'function' ? isDaytime() : true;
    this.equipEnergyProd = (prod - solar) + (isDay ? solar : 0);
    this.equipEnergyMax = cap;
    if (this.equipEnergy > this.equipEnergyMax) this.equipEnergy = this.equipEnergyMax;
  }
  vehDrainEnergy(need) {
    if (this.equipEnergy < need) return false;
    this.equipEnergy -= need;
    return true;
  }
  // 每帧更新装备电网：发电充能 + 个人激光防御 + 护盾（仅非蜘蛛载具调用）
  vehUpdateEquipment(dt) {
    this.vehRecomputePower();
    this.equipEnergy = Math.min(this.equipEnergyMax, this.equipEnergy + this.equipEnergyProd * dt);
    // 个人激光防御：自动攻击射程内敌人
    const laserN = this.vehEquipCount('personal-laser-defense-equipment');
    if (laserN > 0 && G.settings.combat && G.enemies && G.enemies.length > 0) {
      this.vehLaserT = (this.vehLaserT || 0) - dt;
      if (this.vehLaserT <= 0) {
        const cx = this.x * TILE + TILE * this.w / 2, cy = this.y * TILE + TILE * this.h / 2;
        let best = null, bestD = Infinity;
        for (const en of G.enemies) {
          if (!en || en.dead) continue;
          const d = Math.hypot(en.x - cx, en.y - cy);
          if (d <= EQUIPMENT['personal-laser-defense-equipment'].laser * TILE && d < bestD) { best = en; bestD = d; }
        }
        if (best && this.vehDrainEnergy(SPIDER_LASER_COST)) {
          best.hp -= SPIDER_LASER_DMG;
          if (best.hp <= 0) best.dead = true;
          this.vehLaserT = SPIDER_LASER_RATE;
          (G.bullets || (G.bullets = [])).push({ x: cx, y: cy, tx: best.x, ty: best.y, t: 0, life: 0.08, dmg: SPIDER_LASER_DMG, kind: 'laser' });
          uiDirty = true;
        }
      }
    }
  }
  // 外骨骼速度加成：每个 +40% 叠加
  vehSpeedMult() {
    return 1 + this.vehEquipCount('exoskeleton-equipment') * 0.4;
  }
  // 护盾吸收（对齐《异星工厂》：载具装备护盾受击时消耗装备电网电力吸收伤害）
  vehShieldAbsorb(dmg) {
    const cap = (this.vehEquipCount('energy-shield-equipment') * 200) + (this.vehEquipCount('energy-shield-mk2-equipment') * 400);
    if (cap <= 0 || this.equipEnergy <= 0 || dmg <= 0) return dmg;
    const absorb = Math.min(dmg, cap, this.equipEnergy / 5);
    if (absorb <= 0) return dmg;
    this.equipEnergy -= absorb * 5;
    return Math.max(0, dmg - absorb);
  }
  serialize() { const s = super.serialize(); s.fuelCoal = this.fuelCoal; s.fuelSolid = this.fuelSolid; s.fuelRocket = this.fuelRocket; s.fuelNuclear = this.fuelNuclear; s.fuelWood = this.fuelWood; if (Object.keys(this.trunk).length) s.trunk = this.trunk; if (this.equipGrid && this.equipGrid.length) s.carEquip = this.equipGrid; s.carEnergy = this.equipEnergy || 0; return s; }
  blueprint() { const s = super.blueprint(); s.fuelCoal = this.fuelCoal; s.fuelSolid = this.fuelSolid; s.fuelRocket = this.fuelRocket; s.fuelNuclear = this.fuelNuclear; s.fuelWood = this.fuelWood; if (Object.keys(this.trunk).length) s.trunk = this.trunk; if (this.equipGrid && this.equipGrid.length) s.carEquip = this.equipGrid; s.carEnergy = this.equipEnergy || 0; return s; }
  static restore(s) {
    const c = super.restore(s);
    c.fuelCoal = s.fuelCoal || 0; c.fuelSolid = s.fuelSolid || 0; c.fuelRocket = s.fuelRocket || 0; c.fuelNuclear = s.fuelNuclear || 0; c.fuelWood = s.fuelWood || 0;
    c.trunk = s.trunk ? JSON.parse(JSON.stringify(s.trunk)) : {};
    c.equipGrid = s.carEquip ? JSON.parse(JSON.stringify(s.carEquip)) : [];
    c.equipEnergy = s.carEnergy || 0; c.equipEnergyMax = 0; c.equipEnergyProd = 0;
    return c;
  }
}

// ===== 坦克 Tank（对齐《异星工厂》Tank 重型载具） =====
// 3×3 重型战斗载具：装甲更厚（驾驶时玩家受伤减少）、速度较慢、主炮发射炮弹造成范围伤害。
class Tank extends Car {
  constructor(type, x, y) {
    super(type, x, y);
    this.fuelCap = TANK_FUEL_CAP;
    this.shells = 0;           // 内置炮弹数（普通）
    this.uShells = 0;          // 内置铀炮弹数（高级，威力更高）
    this.eShells = 0;          // 内置爆炸炮弹数（爆炸范围更大）
    this.euShells = 0;         // 内置铀爆炸炮弹数（终极，威力最强）
    this.fireT = 0;            // 主炮冷却计时
  }
  giveItem(item) {
    if (item === 'nuclear-fuel' && this.fuelCoal + this.fuelSolid + this.fuelRocket + (this.fuelNuclear||0) + (this.fuelWood||0) < TANK_FUEL_CAP) { this.fuelNuclear++; return true; }
    if (item === 'rocket-fuel' && this.fuelCoal + this.fuelSolid + this.fuelRocket + (this.fuelNuclear||0) + (this.fuelWood||0) < TANK_FUEL_CAP) { this.fuelRocket++; return true; }
    if (item === 'coal' && this.fuelCoal + this.fuelSolid + this.fuelRocket + (this.fuelNuclear||0) + (this.fuelWood||0) < TANK_FUEL_CAP) { this.fuelCoal++; return true; }
    if (item === 'solid-fuel' && this.fuelCoal + this.fuelSolid + this.fuelRocket + (this.fuelNuclear||0) + (this.fuelWood||0) < TANK_FUEL_CAP) { this.fuelSolid++; return true; }
    if (item === 'wood' && this.fuelCoal + this.fuelSolid + this.fuelRocket + (this.fuelNuclear||0) + (this.fuelWood||0) < TANK_FUEL_CAP) { this.fuelWood++; return true; }
    if (item === 'cannon-shell' && this.shells < TANK_SHELL_CAP) { this.shells++; return true; }
    if (item === 'uranium-cannon-shell' && this.uShells < TANK_SHELL_CAP) { this.uShells++; return true; }
    if (item === 'explosive-cannon-shell' && this.eShells < TANK_SHELL_CAP) { this.eShells++; return true; }
    if (item === 'explosive-uranium-cannon-shell' && this.euShells < TANK_SHELL_CAP) { this.euShells++; return true; }
    // 其余物品放入储物箱
    return this.trunkGiveItem(item);
  }
  takeItemOf(item) {
    if (item === 'coal' && this.fuelCoal > 0) { this.fuelCoal--; return 'coal'; }
    if (item === 'solid-fuel' && this.fuelSolid > 0) { this.fuelSolid--; return 'solid-fuel'; }
    if (item === 'nuclear-fuel' && this.fuelNuclear > 0) { this.fuelNuclear--; return 'nuclear-fuel'; }
    if (item === 'rocket-fuel' && this.fuelRocket > 0) { this.fuelRocket--; return 'rocket-fuel'; }
    if (item === 'wood' && this.fuelWood > 0) { this.fuelWood--; return 'wood'; }
    if (item === 'cannon-shell' && this.shells > 0) { this.shells--; return 'cannon-shell'; }
    if (item === 'uranium-cannon-shell' && this.uShells > 0) { this.uShells--; return 'uranium-cannon-shell'; }
    if (item === 'explosive-cannon-shell' && this.eShells > 0) { this.eShells--; return 'explosive-cannon-shell'; }
    if (item === 'explosive-uranium-cannon-shell' && this.euShells > 0) { this.euShells--; return 'explosive-uranium-cannon-shell'; }
    return this.trunkTakeItemOf(item);
  }
  countOf(item) {
    if (item === 'coal') return this.fuelCoal;
    if (item === 'solid-fuel') return this.fuelSolid;
    if (item === 'nuclear-fuel') return this.fuelNuclear;
    if (item === 'rocket-fuel') return this.fuelRocket;
    if (item === 'wood') return this.fuelWood;
    if (item === 'cannon-shell') return this.shells;
    if (item === 'uranium-cannon-shell') return this.uShells;
    if (item === 'explosive-cannon-shell') return this.eShells;
    if (item === 'explosive-uranium-cannon-shell') return this.euShells;
    return this.trunkCountOf(item);
  }
  contents() {
    const rows = [[this.type, 1]];
    if (this.fuelNuclear > 0) rows.push(['nuclear-fuel', this.fuelNuclear]);
    if (this.fuelRocket > 0) rows.push(['rocket-fuel', this.fuelRocket]);
    if (this.fuelSolid > 0) rows.push(['solid-fuel', this.fuelSolid]);
    if (this.fuelCoal > 0) rows.push(['coal', this.fuelCoal]);
    if (this.fuelWood > 0) rows.push(['wood', this.fuelWood]);
    if (this.euShells > 0) rows.push(['explosive-uranium-cannon-shell', this.euShells]);
    if (this.eShells > 0) rows.push(['explosive-cannon-shell', this.eShells]);
    if (this.uShells > 0) rows.push(['uranium-cannon-shell', this.uShells]);
    if (this.shells > 0) rows.push(['cannon-shell', this.shells]);
    for (const k in this.trunk) if (this.trunk[k] > 0) rows.push([k, this.trunk[k]]);
    return rows;
  }
  takeAll() {
    const rows = [];
    if (this.fuelNuclear > 0) rows.push(['nuclear-fuel', this.fuelNuclear]);
    if (this.fuelRocket > 0) rows.push(['rocket-fuel', this.fuelRocket]);
    if (this.fuelSolid > 0) rows.push(['solid-fuel', this.fuelSolid]);
    if (this.fuelCoal > 0) rows.push(['coal', this.fuelCoal]);
    if (this.fuelWood > 0) rows.push(['wood', this.fuelWood]);
    if (this.euShells > 0) rows.push(['explosive-uranium-cannon-shell', this.euShells]);
    if (this.eShells > 0) rows.push(['explosive-cannon-shell', this.eShells]);
    if (this.uShells > 0) rows.push(['uranium-cannon-shell', this.uShells]);
    if (this.shells > 0) rows.push(['cannon-shell', this.shells]);
    for (const k in this.trunk) if (this.trunk[k] > 0) rows.push([k, this.trunk[k]]);
    this.fuelCoal = 0; this.fuelSolid = 0; this.fuelRocket = 0; this.fuelNuclear = 0; this.fuelWood = 0; this.shells = 0; this.uShells = 0; this.eShells = 0; this.euShells = 0; this.trunk = {};
    return rows;
  }
  serialize() {
    const s = super.serialize();
    s.shells = this.shells;
    s.uShells = this.uShells;
    s.eShells = this.eShells;
    s.euShells = this.euShells;
    return s;
  }
  blueprint() {
    const s = super.blueprint();
    s.shells = this.shells;
    s.uShells = this.uShells;
    s.eShells = this.eShells;
    s.euShells = this.euShells;
    return s;
  }
  static restore(s) {
    const c = super.restore(s);
    c.shells = s.shells | 0;
    c.uShells = s.uShells | 0;
    c.eShells = s.eShells | 0;
    c.euShells = s.euShells | 0;
    return c;
  }
  // 主炮开火：发射一枚炮弹（范围爆炸），消耗内置炮弹（铀炮弹威力更高）
  fire(tx, ty) {
    // 弹药优先级（对齐《异星工厂》：优先消耗最强弹药）：铀爆炸 > 爆炸 > 铀 > 普通
    if (this.euShells + this.eShells + this.shells + this.uShells <= 0) return false;
    let use = 'shells';
    if (this.euShells > 0) { use = 'euShells'; }
    else if (this.eShells > 0) { use = 'eShells'; }
    else if (this.uShells > 0) { use = 'uShells'; }
    this[use]--;
    // 威力与爆炸范围分级（对齐《异星工厂》Cannon shell / Explosive cannon shell / Uranium / Explosive uranium）
    const dmg = Math.round((use === 'euShells' ? 160 : (use === 'eShells' ? 110 : (use === 'uShells' ? 100 : 60))) * (typeof weaponDamageMult === 'function' ? weaponDamageMult() : 1) * (typeof weaponCategoryMult === 'function' ? weaponCategoryMult('explosives') : 1));
    const splash = use === 'euShells' ? 5 : (use === 'eShells' ? 4.5 : (use === 'uShells' ? 4 : 3));
    const explosives = (use === 'eShells' || use === 'euShells');   // 爆炸系弹药：命中即引爆，特效更华丽
    const px = this.x * TILE + TILE * this.w / 2, py = this.y * TILE + TILE * this.h / 2;
    const dist = 10 * TILE;
    const a = Math.atan2(ty - py, tx - px);
    const tx2 = px + Math.cos(a) * dist, ty2 = py + Math.sin(a) * dist;
    (G.bullets || (G.bullets = [])).push({
      x: px, y: py, tx: tx2, ty: ty2, t: 0, life: 0.22,
      splash: splash, dmg: dmg, kind: 'rocket', tank: true,
      explosives: explosives   // 爆炸系炮弹：命中时触发增强版爆炸特效与音效
    });
    this.fireT = 0.9;
    uiDirty = true;
    // 坦克重炮：厚重主炮音；爆炸系炮弹发射音更沉；蜘蛛机器人发射导弹用较轻的火箭音
    if (typeof playSfx === 'function') {
      if (this instanceof Spidertron) playSfx('rocket');
      else if (explosives) playSfx('tank-cannon-explosive');
      else playSfx('tank-cannon');
    }
    return true;
  }
}

// 驾驶装甲车时：按住空格向光标方向用车载机枪连发（需战斗模式开启，消耗玩家背包弹药）
function updateCarFire(dt) {
  const d = G.driving;
  if (!d || !(d.ent instanceof Car) || d.ent instanceof Tank || !G.settings.combat) return;
  const c = d.ent;
  c.mgT = (c.mgT || 0) - dt;
  if (c.mgT > 0) return;
  if (!G.keys[' ']) return;
  let tx, ty;
  if (G.cursorTile) {
    tx = G.cursorTile.tx * TILE + TILE / 2;
    ty = G.cursorTile.ty * TILE + TILE / 2;
  } else {
    const a = (c.dir || 0) * Math.PI / 2;
    tx = c.x * TILE + TILE * c.w / 2 + Math.cos(a) * TILE * 3;
    ty = c.y * TILE + TILE * c.h / 2 + Math.sin(a) * TILE * 3;
  }
  // 射击速度无限科技：车载机枪射速提升（对齐《异星工厂》Shooting speed）
  if (c.fireMachineGun(tx, ty)) c.mgT = 0.12 / (typeof shootingSpeedMult === 'function' ? shootingSpeedMult() : 1); // 高速连发（对齐原版车载机枪射速）
}

// 驾驶坦克时：按住空格向光标方向开炮（需战斗模式开启）
function updateTankFire(dt) {
  const d = G.driving;
  if (!d || !(d.ent instanceof Tank) || !G.settings.combat) return;
  const t = d.ent;
  t.fireT = (t.fireT || 0) - dt;
  if (t.fireT > 0) return;
  if (!G.keys[' ']) return;
  let tx, ty;
  if (G.cursorTile) {
    tx = G.cursorTile.tx * TILE + TILE / 2;
    ty = G.cursorTile.ty * TILE + TILE / 2;
  } else {
    const a = (t.dir || 0) * Math.PI / 2;
    tx = t.x * TILE + TILE * t.w / 2 + Math.cos(a) * TILE * 3;
    ty = t.y * TILE + TILE * t.h / 2 + Math.sin(a) * TILE * 3;
  }
  t.fire(tx, ty);
}

