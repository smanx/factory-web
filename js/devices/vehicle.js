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

class Car extends Entity {
  constructor(type, x, y) {
    super(type, x, y);
    this.fuelCoal = 0;          // 内置煤量
    this.fuelSolid = 0;         // 内置固体燃料量
    this.fuelRocket = 0;        // 内置火箭燃料量（最高级燃料，优先烧）
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
    if (item === 'rocket-fuel' && this.fuelCoal + this.fuelSolid + this.fuelRocket < (this.fuelCap || CAR_FUEL_CAP)) { this.fuelRocket++; return true; }
    if (item === 'coal' && this.fuelCoal + this.fuelSolid + this.fuelRocket < (this.fuelCap || CAR_FUEL_CAP)) { this.fuelCoal++; return true; }
    if (item === 'solid-fuel' && this.fuelCoal + this.fuelSolid + this.fuelRocket < (this.fuelCap || CAR_FUEL_CAP)) { this.fuelSolid++; return true; }
    // 其余物品放入储物箱
    return this.trunkGiveItem(item);
  }
  peekItem() { return null; }
  takeItem() { return null; }
  countOf(item) {
    if (item === 'coal') return this.fuelCoal;
    if (item === 'solid-fuel') return this.fuelSolid;
    if (item === 'rocket-fuel') return this.fuelRocket;
    return this.trunkCountOf(item);
  }
  takeItemOf(item) {
    if (item === 'coal' && this.fuelCoal > 0) { this.fuelCoal--; return 'coal'; }
    if (item === 'solid-fuel' && this.fuelSolid > 0) { this.fuelSolid--; return 'solid-fuel'; }
    if (item === 'rocket-fuel' && this.fuelRocket > 0) { this.fuelRocket--; return 'rocket-fuel'; }
    return this.trunkTakeItemOf(item);
  }
  contents() {
    const list = [[this.type, 1]];
    if (this.fuelRocket > 0) list.push(['rocket-fuel', this.fuelRocket]);
    if (this.fuelSolid > 0) list.push(['solid-fuel', this.fuelSolid]);
    if (this.fuelCoal > 0) list.push(['coal', this.fuelCoal]);
    for (const k in this.trunk) if (this.trunk[k] > 0) list.push([k, this.trunk[k]]);
    return list;
  }
  takeAll() {
    const rows = [];
    if (this.fuelRocket > 0) rows.push(['rocket-fuel', this.fuelRocket]);
    if (this.fuelSolid > 0) rows.push(['solid-fuel', this.fuelSolid]);
    if (this.fuelCoal > 0) rows.push(['coal', this.fuelCoal]);
    for (const k in this.trunk) if (this.trunk[k] > 0) rows.push([k, this.trunk[k]]);
    this.fuelCoal = 0; this.fuelSolid = 0; this.fuelRocket = 0; this.trunk = {};
    return rows;
  }
  // 行驶时烧燃料：优先烧固体燃料（更耐用），其次烧煤
  // 受「燃料效率」无限科技影响：乘 fuelConsumptionMult()（<1）让每单位燃料更耐用
  burnFuel(n) {
    n *= fuelConsumptionMult();
    if (this.fuelRocket > 0) this.fuelRocket = Math.max(0, this.fuelRocket - n);
    else if (this.fuelSolid > 0) this.fuelSolid = Math.max(0, this.fuelSolid - n);
    else this.fuelCoal = Math.max(0, this.fuelCoal - n);
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
    if (typeof invCount === 'function' && invCount('piercing-rounds') > 0) use = 'piercing-rounds';
    else if (typeof invCount === 'function' && invCount('magazine') > 0) use = 'magazine';
    if (!use) return false;
    if (typeof invTake === 'function') invTake(use, 1);
    // 车载机枪伤害：穿甲弹强于普通弹（对齐原版）；叠加通用武器伤害与投射物伤害无限科技
    const base = 8 * (use === 'piercing-rounds' ? 1.6 : 1) *
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
    for (const e of (this.equipGrid || [])) if (e.id === 'portable-solar-panel' || e.id === 'portable-solar-panel-mk2') solar += EQUIPMENT[e.id].powerOut;
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
    const laserN = this.vehEquipCount('personal-laser-defense');
    if (laserN > 0 && G.settings.combat && G.enemies && G.enemies.length > 0) {
      this.vehLaserT = (this.vehLaserT || 0) - dt;
      if (this.vehLaserT <= 0) {
        const cx = this.x * TILE + TILE * this.w / 2, cy = this.y * TILE + TILE * this.h / 2;
        let best = null, bestD = Infinity;
        for (const en of G.enemies) {
          if (!en || en.dead) continue;
          const d = Math.hypot(en.x - cx, en.y - cy);
          if (d <= EQUIPMENT['personal-laser-defense'].laser * TILE && d < bestD) { best = en; bestD = d; }
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
    return 1 + this.vehEquipCount('exoskeleton') * 0.4;
  }
  // 护盾吸收（对齐《异星工厂》：载具装备护盾受击时消耗装备电网电力吸收伤害）
  vehShieldAbsorb(dmg) {
    const cap = (this.vehEquipCount('energy-shield') * 200) + (this.vehEquipCount('energy-shield-mk2') * 400);
    if (cap <= 0 || this.equipEnergy <= 0 || dmg <= 0) return dmg;
    const absorb = Math.min(dmg, cap, this.equipEnergy / 5);
    if (absorb <= 0) return dmg;
    this.equipEnergy -= absorb * 5;
    return Math.max(0, dmg - absorb);
  }
  serialize() { const s = super.serialize(); s.fuelCoal = this.fuelCoal; s.fuelSolid = this.fuelSolid; s.fuelRocket = this.fuelRocket; if (Object.keys(this.trunk).length) s.trunk = this.trunk; if (this.equipGrid && this.equipGrid.length) s.carEquip = this.equipGrid; s.carEnergy = this.equipEnergy || 0; return s; }
  blueprint() { const s = super.blueprint(); s.fuelCoal = this.fuelCoal; s.fuelSolid = this.fuelSolid; s.fuelRocket = this.fuelRocket; if (Object.keys(this.trunk).length) s.trunk = this.trunk; if (this.equipGrid && this.equipGrid.length) s.carEquip = this.equipGrid; s.carEnergy = this.equipEnergy || 0; return s; }
  static restore(s) {
    const c = super.restore(s);
    c.fuelCoal = s.fuelCoal || 0; c.fuelSolid = s.fuelSolid || 0; c.fuelRocket = s.fuelRocket || 0;
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
    if (item === 'rocket-fuel' && this.fuelCoal + this.fuelSolid + this.fuelRocket < TANK_FUEL_CAP) { this.fuelRocket++; return true; }
    if (item === 'coal' && this.fuelCoal + this.fuelSolid + this.fuelRocket < TANK_FUEL_CAP) { this.fuelCoal++; return true; }
    if (item === 'solid-fuel' && this.fuelCoal + this.fuelSolid + this.fuelRocket < TANK_FUEL_CAP) { this.fuelSolid++; return true; }
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
    if (item === 'rocket-fuel' && this.fuelRocket > 0) { this.fuelRocket--; return 'rocket-fuel'; }
    if (item === 'cannon-shell' && this.shells > 0) { this.shells--; return 'cannon-shell'; }
    if (item === 'uranium-cannon-shell' && this.uShells > 0) { this.uShells--; return 'uranium-cannon-shell'; }
    if (item === 'explosive-cannon-shell' && this.eShells > 0) { this.eShells--; return 'explosive-cannon-shell'; }
    if (item === 'explosive-uranium-cannon-shell' && this.euShells > 0) { this.euShells--; return 'explosive-uranium-cannon-shell'; }
    return this.trunkTakeItemOf(item);
  }
  countOf(item) {
    if (item === 'coal') return this.fuelCoal;
    if (item === 'solid-fuel') return this.fuelSolid;
    if (item === 'rocket-fuel') return this.fuelRocket;
    if (item === 'cannon-shell') return this.shells;
    if (item === 'uranium-cannon-shell') return this.uShells;
    if (item === 'explosive-cannon-shell') return this.eShells;
    if (item === 'explosive-uranium-cannon-shell') return this.euShells;
    return this.trunkCountOf(item);
  }
  contents() {
    const rows = [[this.type, 1]];
    if (this.fuelRocket > 0) rows.push(['rocket-fuel', this.fuelRocket]);
    if (this.fuelSolid > 0) rows.push(['solid-fuel', this.fuelSolid]);
    if (this.fuelCoal > 0) rows.push(['coal', this.fuelCoal]);
    if (this.euShells > 0) rows.push(['explosive-uranium-cannon-shell', this.euShells]);
    if (this.eShells > 0) rows.push(['explosive-cannon-shell', this.eShells]);
    if (this.uShells > 0) rows.push(['uranium-cannon-shell', this.uShells]);
    if (this.shells > 0) rows.push(['cannon-shell', this.shells]);
    for (const k in this.trunk) if (this.trunk[k] > 0) rows.push([k, this.trunk[k]]);
    return rows;
  }
  takeAll() {
    const rows = [];
    if (this.fuelRocket > 0) rows.push(['rocket-fuel', this.fuelRocket]);
    if (this.fuelSolid > 0) rows.push(['solid-fuel', this.fuelSolid]);
    if (this.fuelCoal > 0) rows.push(['coal', this.fuelCoal]);
    if (this.euShells > 0) rows.push(['explosive-uranium-cannon-shell', this.euShells]);
    if (this.eShells > 0) rows.push(['explosive-cannon-shell', this.eShells]);
    if (this.uShells > 0) rows.push(['uranium-cannon-shell', this.uShells]);
    if (this.shells > 0) rows.push(['cannon-shell', this.shells]);
    for (const k in this.trunk) if (this.trunk[k] > 0) rows.push([k, this.trunk[k]]);
    this.fuelCoal = 0; this.fuelSolid = 0; this.fuelRocket = 0; this.shells = 0; this.uShells = 0; this.eShells = 0; this.euShells = 0; this.trunk = {};
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
    const dmg = Math.round((use === 'euShells' ? 160 : (use === 'eShells' ? 110 : (use === 'uShells' ? 100 : 60))) * (typeof weaponDamageMult === 'function' ? weaponDamageMult() : 1) * (typeof weaponCategoryMult === 'function' ? weaponCategoryMult('explosive') : 1));
    const splash = use === 'euShells' ? 5 : (use === 'eShells' ? 4.5 : (use === 'uShells' ? 4 : 3));
    const explosive = (use === 'eShells' || use === 'euShells');   // 爆炸系弹药：命中即引爆，特效更华丽
    const px = this.x * TILE + TILE * this.w / 2, py = this.y * TILE + TILE * this.h / 2;
    const dist = 10 * TILE;
    const a = Math.atan2(ty - py, tx - px);
    const tx2 = px + Math.cos(a) * dist, ty2 = py + Math.sin(a) * dist;
    (G.bullets || (G.bullets = [])).push({
      x: px, y: py, tx: tx2, ty: ty2, t: 0, life: 0.22,
      splash: splash, dmg: dmg, kind: 'rocket', tank: true,
      explosive: explosive   // 爆炸系炮弹：命中时触发增强版爆炸特效与音效
    });
    this.fireT = 0.9;
    uiDirty = true;
    // 坦克重炮：厚重主炮音；爆炸系炮弹发射音更沉；蜘蛛机器人发射导弹用较轻的火箭音
    if (typeof playSfx === 'function') {
      if (this instanceof Spidertron) playSfx('rocket');
      else if (explosive) playSfx('tank-cannon-explosive');
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
    for (const e of this.equipGrid) if (e.id === 'portable-solar-panel' || e.id === 'portable-solar-panel-mk2') solar += EQUIPMENT[e.id].powerOut;
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
    const laserN = this.spiderEquipCount('personal-laser-defense');
    if (laserN > 0 && G.settings.combat && G.enemies && G.enemies.length > 0) {
      this.spiderLaserT = (this.spiderLaserT || 0) - dt;
      if (this.spiderLaserT <= 0) {
        const cx = this.x * TILE + TILE * this.w / 2, cy = this.y * TILE + TILE * this.h / 2;
        const range = EQUIPMENT['personal-laser-defense'].laser * TILE;
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
    const n = this.spiderEquipCount('exoskeleton');
    return 1 + n * 0.4;
  }
  // 装备护盾：吸收载具所受伤害（返回剩余伤害）
  spiderShieldAbsorb(dmg) {
    const shieldN = this.spiderEquipCount('energy-shield') + this.spiderEquipCount('energy-shield-mk2') * 2;
    if (shieldN <= 0) return dmg;
    const per = EQUIPMENT['energy-shield'].shield;
    // 简单模型：每次受击最多吸收 shield 量（按护盾总数），电力充足时吸收
    if (this.spiderDrainEnergy(per)) {
      const absorbed = Math.min(dmg, per);
      return dmg - absorbed;
    }
    return dmg;
  }
  giveItem(item) {
    if (item === 'rocket-fuel' && this.fuelCoal + this.fuelSolid + this.fuelRocket < SPIDER_FUEL_CAP) { this.fuelRocket++; return true; }
    if (item === 'coal' && this.fuelCoal + this.fuelSolid + this.fuelRocket < SPIDER_FUEL_CAP) { this.fuelCoal++; return true; }
    if (item === 'solid-fuel' && this.fuelCoal + this.fuelSolid + this.fuelRocket < SPIDER_FUEL_CAP) { this.fuelSolid++; return true; }
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
      splash: 3.5, dmg: Math.round(70 * (typeof weaponDamageMult === 'function' ? weaponDamageMult() : 1) * (typeof weaponCategoryMult === 'function' ? weaponCategoryMult('explosive') : 1)), kind: 'rocket', tank: true
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
    if (this.fuelCoal <= 0 && this.fuelSolid <= 0 && this.fuelRocket <= 0) return;
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
  let h = row('燃料', (e.fuelRocket > 0 ? ('火箭燃料 ' + e.fuelRocket) : '') + (e.fuelRocket > 0 && (e.fuelSolid > 0 || e.fuelCoal > 0) ? ' + ' : '') + (e.fuelSolid > 0 ? ('固体燃料 ' + e.fuelSolid) : '') + ((e.fuelRocket > 0 || e.fuelSolid > 0) && e.fuelCoal > 0 ? ' + ' : '') + (e.fuelCoal > 0 ? ('煤 ' + e.fuelCoal) : '<span class="dim">空</span>') + ' / ' + SPIDER_FUEL_CAP, 'fuel');
  h += row('导弹', e.missiles > 0 ? (e.missiles + ' / ' + SPIDER_MISSILE_CAP) : '<span class="dim">无</span>', 'missile');
  const cf = Math.min(invCount('coal'), SPIDER_FUEL_CAP - e.fuelCoal - e.fuelSolid - e.fuelRocket);
  const csol = Math.min(invCount('solid-fuel'), SPIDER_FUEL_CAP - e.fuelCoal - e.fuelSolid - e.fuelRocket);
  const crk = Math.min(invCount('rocket-fuel'), SPIDER_FUEL_CAP - e.fuelCoal - e.fuelSolid - e.fuelRocket);
  const cr = Math.min(invCount('rocket'), SPIDER_MISSILE_CAP - e.missiles);
  if (cf > 0) h += '<button data-action="feed" data-id="coal">放入煤 ×' + cf + '</button>';
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
  api.set('fuel', (e.fuelRocket > 0 ? ('火箭燃料 ' + e.fuelRocket) : '') + (e.fuelRocket > 0 && (e.fuelSolid > 0 || e.fuelCoal > 0) ? ' + ' : '') + (e.fuelSolid > 0 ? ('固体燃料 ' + e.fuelSolid) : '') + ((e.fuelRocket > 0 || e.fuelSolid > 0) && e.fuelCoal > 0 ? ' + ' : '') + (e.fuelCoal > 0 ? ('煤 ' + e.fuelCoal) : dimSpan('空')) + ' / ' + SPIDER_FUEL_CAP);
  api.set('missile', e.missiles > 0 ? (e.missiles + ' / ' + SPIDER_MISSILE_CAP) : dimSpan('无'));
  const cf = Math.min(invCount('coal'), SPIDER_FUEL_CAP - e.fuelCoal - e.fuelSolid - e.fuelRocket);
  const csol = Math.min(invCount('solid-fuel'), SPIDER_FUEL_CAP - e.fuelCoal - e.fuelSolid - e.fuelRocket);
  const crk = Math.min(invCount('rocket-fuel'), SPIDER_FUEL_CAP - e.fuelCoal - e.fuelSolid - e.fuelRocket);
  const cr = Math.min(invCount('rocket'), SPIDER_MISSILE_CAP - e.missiles);
  api.toggle('button[data-action="feed"][data-id="coal"]', cf > 0, '放入煤 ×' + cf);
  api.toggle('button[data-action="feed"][data-id="solid-fuel"]', csol > 0, '放入固体燃料 ×' + csol);
  api.toggle('button[data-action="feed"][data-id="rocket-fuel"]', crk > 0, '放入火箭燃料 ×' + crk);
  api.toggle('button[data-action="feed"][data-id="rocket"]', cr > 0, '装填导弹 ×' + cr);
  if (G.driving && G.driving.ent === e) api.status('驾驶中（空格发射导弹，E 下车）', 'ok');
  else if (e.fuelCoal <= 0 && e.fuelSolid <= 0 && e.fuelRocket <= 0) api.status('缺燃料：放入煤/固体燃料/火箭燃料后可驾驶', 'warn');
  else api.status('可驾驶', 'ok');
}

// ===== 进入/退出驾驶 =====
function enterCar(car) {
  if (!(car instanceof Car)) {
    // 火车：玩家可进入车头驾驶或乘坐车厢（对齐《异星工厂》：玩家可亲手驾驶列车/乘坐车厢）
    if (typeof Locomotive !== 'undefined' && (car instanceof Locomotive || car instanceof CargoWagon)) {
      enterTrain(car);
      return;
    }
    return;
  }
  // 清理上一次驾驶残留
  G.driving = { ent: car };
  // 玩家位置对准载具中心
  G.player.x = car.x * TILE + TILE * car.w / 2;
  G.player.y = car.y * TILE + TILE * car.h / 2;
  G.player.inVehicle = true;
  closePanel();
  if (typeof toast === 'function') toast(car instanceof Tank ? '已进入坦克（WASD 驾驶，空格开炮，E 下车）' : '已进入装甲车（WASD 驾驶，空格车载机枪，E 下车）');
  uiDirty = true;
}

// ===== 火车驾驶/乘坐（对齐《异星工厂》：玩家可亲手驾驶列车，双向行驶） =====
// 车头 → 驾驶模式（W 前进 / S 后退 / R 反转方向）；车厢 → 乘坐模式（随列车移动）。
function enterTrain(car) {
  G.driving = { ent: car, mode: (car instanceof Locomotive) ? 'drive' : 'ride' };
  G.player.x = car.x * TILE + TILE * car.w / 2;
  G.player.y = car.y * TILE + TILE * car.h / 2;
  G.player.inVehicle = true;
  closePanel();
  const isDrive = G.driving.mode === 'drive';
  if (typeof toast === 'function') toast(isDrive ? '已进入火车驾驶（W 前进，S 后退，R 反转车头，E 下车）' : '已登上车厢（随列车行驶，E 下车）');
  uiDirty = true;
}
function exitCar() {
  if (!G.driving) return;
  const car = G.driving.ent;
  const wasTrain = !!(car && (typeof Locomotive !== 'undefined' && (car instanceof Locomotive || car instanceof CargoWagon)));
  G.driving = null;
  if (G.player) G.player.inVehicle = false;
  // 下车：把玩家放在车的一侧，若被堵则原地
  if (car && !car._dead) {
    const side = [[0, 1], [0, -1], [1, 0], [-1, 0]];
    const ccx = car.x * TILE + TILE * car.w / 2, ccy = car.y * TILE + TILE * car.h / 2;
    // 火车为 1×1 实体，下车距离 1 格；载具（2×2 等）下车距离 2 格
    const dist = wasTrain ? TILE : TILE * 2;
    for (const [dx, dy] of side) {
      const sx = ccx + dx * dist;
      const sy = ccy + dy * dist;
      if (!solidAtPx(sx, sy) && !entAt(Math.round(sx / TILE), Math.round(sy / TILE))) {
        G.player.x = sx; G.player.y = sy;
        break;
      }
    }
  }
  if (typeof toast === 'function') toast('已下车');
  uiDirty = true;
}

// ===== 火车驾驶/乘坐更新（由 updateDriving 分发） =====
// 驾驶模式（车头）：W 前进 / S 后退，按车头类型对应的每格耗时逐步移动；R 反转车头方向。
// 乘坐模式（车厢）：仅跟随所在列车移动（列车由玩家驾驶或自动调度驱动）。
function updateTrainDriving(dt) {
  const d = G.driving;
  if (!d || !d.ent || d.ent._dead) return;
  const car = d.ent;
  const w = car.w || 1, h = car.h || 1;
  // 玩家位置始终跟随所在车辆（驾驶/乘坐统一）
  G.player.x = car.x * TILE + TILE * w / 2;
  G.player.y = car.y * TILE + TILE * h / 2;
  if (d.mode !== 'drive' || !(car instanceof Locomotive)) return;
  const tr = (typeof findTrainOfCar === 'function') ? findTrainOfCar(car) : null;
  if (!tr) return;
  // R 反转车头方向在 main.js rotateAction 中处理（对齐《异星工厂》：驾驶火车按 R 掉头）
  const goFwd = G.keys && (G.keys['w'] || G.keys['arrowup']);
  const goBack = G.keys && (G.keys['s'] || G.keys['arrowdown']);
  if (!goFwd && !goBack) { d.moveT = 0; return; }
  // 燃料检查
  car.refuel();
  if ((car.fuel || 0) <= 0) {
    if (!d.warned) { d.warned = true; if (typeof toast === 'function') toast('火车燃料不足：放入煤/固体燃料/火箭燃料'); }
    d.moveT = 0;
    return;
  }
  d.warned = false;
  d.moveT = (d.moveT || 0) + dt;
  const step = (typeof trainMoveTime === 'function') ? trainMoveTime(car) : TRAIN_SPEED;
  if (d.moveT >= step) {
    d.moveT -= step;
    if (goBack) { if (typeof moveTrainBack === 'function') moveTrainBack(tr); }
    else if (typeof moveTrainManual === 'function') moveTrainManual(tr);
  }
}

// ===== 驾驶更新（由 updatePlayer 调用）=====
function updateDriving(dt) {
  const d = G.driving;
  if (!d || !d.ent || d.ent._dead) return;
  const car = d.ent;
  // 火车：驾驶车头或乘坐车厢（对齐《异星工厂》手动驾驶/乘坐）
  if (typeof Locomotive !== 'undefined' && (car instanceof Locomotive || car instanceof CargoWagon)) {
    updateTrainDriving(dt);
    return;
  }
  const isTank = car instanceof Tank;
  const isSpider = car instanceof Spidertron;
  const speed = isSpider ? SPIDER_SPEED * car.spiderSpeedMult() : (isTank ? TANK_SPEED : CAR_SPEED) * (car.vehSpeedMult ? car.vehSpeedMult() : 1);
  // 蜘蛛机器人：车载自动炮塔持续开火；装甲车/坦克更新载具装备电网（个人激光防御等）
  if (isSpider) car.autoTurret(dt);
  else if (typeof car.vehUpdateEquipment === 'function') car.vehUpdateEquipment(dt);
  let mx = 0, my = 0;
  if (G.keys['w'] || G.keys['arrowup']) my -= 1;
  if (G.keys['s'] || G.keys['arrowdown']) my += 1;
  if (G.keys['a'] || G.keys['arrowleft']) mx -= 1;
  if (G.keys['d'] || G.keys['arrowright']) mx += 1;
  const len = Math.hypot(mx, my);
  if (len > 0) {
    // 车辆引擎环境音（节流，避免每帧重复触发）
    if (typeof playSfx === 'function' && (!d.sfxT || d.sfxT <= 0)) {
      playSfx('engine'); d.sfxT = 0.8;
    }
    if (d.sfxT) d.sfxT -= dt;
    // 消耗燃料：燃料不足则无法移动
    if (car.fuelCoal <= 0 && car.fuelSolid <= 0 && car.fuelRocket <= 0) {
      if (!d.warned) { d.warned = true; if (typeof toast === 'function') toast('燃料不足：' + (isSpider ? '蜘蛛机器人' : (isTank ? '坦克' : '装甲车')) + '需要煤/固体燃料/火箭燃料'); }
      // 玩家仍可下车（E）
      return;
    }
    d.warned = false;
    mx /= len; my /= len;
    if (Math.abs(mx) > Math.abs(my)) car.dir = mx > 0 ? 0 : 2;
    else car.dir = my > 0 ? 1 : 3;
    // 载具中心在世界坐标
    const cx = car.x * TILE + TILE * car.w / 2, cy = car.y * TILE + TILE * car.h / 2;
    const nx = cx + mx * speed * dt, ny = cy + my * speed * dt;
    const r = isTank ? TANK_COLLIDE : 14; // 载具碰撞半径
    let okX = !boxBlocked(nx, cy, r), okY = !boxBlocked(cx, ny, r);
    // 载具不能驶入建筑/水域：额外检查中心格（蜘蛛机器人可跨水/墙，不受此限）
    let ntx = car.x, nty = car.y;
    if (isSpider || (!isWater(Math.floor(nx / TILE), Math.floor(cy / TILE)) && !isCliff(Math.floor(nx / TILE), Math.floor(cy / TILE)))) {
      if (okX) ntx = Math.floor(nx / TILE);
    }
    if (isSpider || (!isWater(Math.floor(cx / TILE), Math.floor(ny / TILE)) && !isCliff(Math.floor(cx / TILE), Math.floor(ny / TILE)))) {
      if (okY) nty = Math.floor(ny / TILE);
    }
    // 目的地格子是否被其他实体占据（载具自身除外；蜘蛛机器人可越过石墙）
    let targetOccupied = false;
    if (ntx !== car.x || nty !== car.y) {
      for (let dy = 0; dy < car.h && !targetOccupied; dy++)
        for (let dx = 0; dx < car.w && !targetOccupied; dx++) {
          const other = entAt(ntx + dx, nty + dy);
          if (other && other !== car && !(isSpider && other.type === 'stone-wall')) targetOccupied = true;
        }
    }
    if (targetOccupied) { return; }
    // 移动载具：在空间索引中重定位（不重复 push 进 G.ents）
    if (ntx !== car.x || nty !== car.y) {
      // 先从旧位置网格/桶移除
      const ob = bucketKey(car.x, car.y);
      const obs = G.buckets.get(ob);
      if (obs) { obs.delete(car); if (!obs.size) G.buckets.delete(ob); }
      for (let dy = 0; dy < car.h; dy++)
        for (let dx = 0; dx < car.w; dx++) {
          const k = entKey(car.x + dx, car.y + dy);
          if (G.grid.get(k) === car) G.grid.delete(k);
        }
      // 写入新位置
      car.x = ntx; car.y = nty;
      ensureBucket(bucketKey(car.x, car.y)).add(car);
      for (let dy = 0; dy < car.h; dy++)
        for (let dx = 0; dx < car.w; dx++)
          G.grid.set(entKey(car.x + dx, car.y + dy), car);
      if (typeof invalidateBeltInputNear === 'function') invalidateBeltInputNear(car.x, car.y, car.w, car.h);
    }
    // 玩家位置跟随载具中心
    G.player.x = car.x * TILE + TILE * car.w / 2;
    G.player.y = car.y * TILE + TILE * car.h / 2;
    // 燃料消耗（蜘蛛最省、坦克最快；优先烧固体燃料）
    car.burnFuel((isSpider ? SPIDER_FUEL_BURN : (isTank ? TANK_FUEL_BURN : CAR_FUEL_BURN)) * dt);
  }
}

// ===== 载具储物箱面板（对齐《异星工厂》：车辆自带储物箱，可在面板查看/存取物品） =====
// 返回储物箱 HTML：列出箱内物品并提供"取出"按钮；空时提示可用机械臂/手动放入。
function trunkPanelHtml(e) {
  let h = '<div class="sec">储物箱（' + e.trunkUsedSlots() + '/' + TRUNK_SLOTS + ' 槽）</div>';
  const keys = Object.keys(e.trunk || {}).filter(k => e.trunk[k] > 0);
  if (!keys.length) {
    h += '<div class="dim">储物箱空。打开背包选中物品后在载具面板点"放入"，或让机械臂直接送入载具。</div>';
    return h;
  }
  let total = 0;
  for (const k of keys) total += e.trunk[k];
  h += '<div class="trunk-list">';
  for (const k of keys) {
    const cnt = e.trunk[k];
    h += '<div class="trunk-item" data-tip="' + itemTip(k) + '"><img src="' + iconDataURL(k) + '"><span>' + ITEMS[k].name + ' ×' + cnt + '</span>' +
      '<button data-action="trunk-take" data-id="' + k + '" data-tip="取出一件">取出</button></div>';
  }
  h += '</div>';
  h += '<div class="dim">共 ' + keys.length + ' 种、' + total + ' 件。点击"取出"移回背包（受背包堆叠上限约束）。</div>';
  return h;
}

// ===== 渲染 =====
function drawCar(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE, cy = py + TILE;
  ctx.globalAlpha = alpha;
  // 车身
  ctx.fillStyle = '#5a4a2a';
  rr(ctx, px + 4, py + 6, TILE * 2 - 8, TILE * 2 - 14, 8); ctx.fill();
  ctx.fillStyle = '#7a6a3a';
  rr(ctx, px + 4, py + 6, TILE * 2 - 8, TILE * 2 - 26, 8); ctx.fill();
  // 驾驶舱玻璃
  ctx.fillStyle = '#bfe8ff';
  rr(ctx, cx - 8, cy - 6, 16, 14, 4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  rr(ctx, cx - 8, cy - 6, 16, 5, 4); ctx.fill();
  // 车头朝向箭头（指示车头方向）
  const ang = (e.dir || 0) * Math.PI / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  // 车载机枪（对齐《异星工厂》Car）：车头前伸的短机枪枪管
  ctx.fillStyle = '#2a2620';
  ctx.fillRect(12, -2.5, 9, 5);
  ctx.fillRect(8, -4, 5, 8);
  ctx.fillStyle = '#e8c85a';
  ctx.beginPath();
  ctx.moveTo(12, 0); ctx.lineTo(5, -5); ctx.lineTo(5, 5); ctx.closePath();
  ctx.fill();
  ctx.restore();
  // 车轮
  ctx.fillStyle = '#2a2620';
  ctx.fillRect(px + 6, py + 4, 8, 6);
  ctx.fillRect(px + TILE * 2 - 14, py + 4, 8, 6);
  ctx.fillRect(px + 6, py + TILE * 2 - 12, 8, 6);
  ctx.fillRect(px + TILE * 2 - 14, py + TILE * 2 - 12, 8, 6);
  // 燃料显示（火箭燃料>固体燃料>煤 优先计数）
  const fl = (e.fuelRocket || 0) > 0 ? (e.fuelRocket || 0) : ((e.fuelSolid || 0) > 0 ? (e.fuelSolid || 0) : (e.fuelCoal || 0));
  if (fl > 0 || (G.driving && G.driving.ent === e)) {
    ctx.fillStyle = fl > 0 ? '#e8c85a' : '#ff5b5b';
    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText((e.fuelRocket > 0 ? '火 ' : (e.fuelSolid > 0 ? '燃 ' : '煤 ')) + fl, cx, py + TILE * 2 - 4);
  }
  ctx.globalAlpha = 1;
}
function carPanelHtml(e) {
  const cap = e.fuelCap || CAR_FUEL_CAP;
  let h = row('燃料', (e.fuelRocket > 0 ? ('火箭燃料 ' + e.fuelRocket) : '') + (e.fuelRocket > 0 && (e.fuelSolid > 0 || e.fuelCoal > 0) ? ' + ' : '') + (e.fuelSolid > 0 ? ('固体燃料 ' + e.fuelSolid) : '') + ((e.fuelRocket > 0 || e.fuelSolid > 0) && e.fuelCoal > 0 ? ' + ' : '') + (e.fuelCoal > 0 ? ('煤 ' + e.fuelCoal) : '<span class="dim">空</span>') + ' / ' + cap, 'fuel');
  const nc = Math.min(invCount('coal'), cap - e.fuelCoal - e.fuelSolid - e.fuelRocket);
  const ns = Math.min(invCount('solid-fuel'), cap - e.fuelCoal - e.fuelSolid - e.fuelRocket);
  const nrk = Math.min(invCount('rocket-fuel'), cap - e.fuelCoal - e.fuelSolid - e.fuelRocket);
  if (nc > 0) h += '<button data-action="feed" data-id="coal">放入煤 ×' + nc + '</button>';
  if (ns > 0) h += '<button data-action="feed" data-id="solid-fuel">放入固体燃料 ×' + ns + '</button>';
  if (nrk > 0) h += '<button data-action="feed" data-id="rocket-fuel">放入火箭燃料 ×' + nrk + '</button>';
  h += '<div class="status"></div>';
  h += '<button data-action="drive" id="btn-car-drive" class="primary">🚗 进入驾驶</button>';
  h += '<div class="dim">装甲车：靠近后按 E 进入驾驶（WASD 更快移动），移动消耗煤/固体燃料（固体燃料更耐用），驾驶时按空格发射车载机枪（消耗背包弹药），E 下车。可用机械臂/手动放入。</div>';
  h += trunkPanelHtml(e);
  h += vehEquipHtml(e);
  return h;
}
function carPanelLive(e, api) {
  const cap = e.fuelCap || CAR_FUEL_CAP;
  api.set('fuel', (e.fuelRocket > 0 ? ('火箭燃料 ' + e.fuelRocket) : '') + (e.fuelRocket > 0 && (e.fuelSolid > 0 || e.fuelCoal > 0) ? ' + ' : '') + (e.fuelSolid > 0 ? ('固体燃料 ' + e.fuelSolid) : '') + ((e.fuelRocket > 0 || e.fuelSolid > 0) && e.fuelCoal > 0 ? ' + ' : '') + (e.fuelCoal > 0 ? ('煤 ' + e.fuelCoal) : dimSpan('空')) + ' / ' + cap);
  const nc = Math.min(invCount('coal'), cap - e.fuelCoal - e.fuelSolid - e.fuelRocket);
  const ns = Math.min(invCount('solid-fuel'), cap - e.fuelCoal - e.fuelSolid - e.fuelRocket);
  const nrk = Math.min(invCount('rocket-fuel'), cap - e.fuelCoal - e.fuelSolid - e.fuelRocket);
  api.toggle('button[data-action="feed"][data-id="coal"]', nc > 0, '放入煤 ×' + nc);
  api.toggle('button[data-action="feed"][data-id="solid-fuel"]', ns > 0, '放入固体燃料 ×' + ns);
  api.toggle('button[data-action="feed"][data-id="rocket-fuel"]', nrk > 0, '放入火箭燃料 ×' + nrk);
  if (G.driving && G.driving.ent === e) api.status('驾驶中（E 下车）', 'ok');
  else if (e.fuelCoal <= 0 && e.fuelSolid <= 0 && e.fuelRocket <= 0) api.status('缺燃料：放入煤/固体燃料/火箭燃料后可驾驶', 'warn');
  else api.status('可驾驶', 'ok');
}
function carTip(e) {
  if (G.driving && G.driving.ent === e) return '驾驶中（E 下车）';
  return '装甲车（煤 ' + (e.fuelCoal || 0) + (e.fuelSolid > 0 ? '，固体燃料 ' + e.fuelSolid : '') + (e.fuelRocket > 0 ? '，火箭燃料 ' + e.fuelRocket : '') + '），按 E 进入驾驶，空格发射车载机枪';
}
function carOnAction(act) {
  if (act === 'drive') {
    const c = G.panelEnt;
    if (c instanceof Car) { enterCar(c); return true; }
  }
  return false;
}

// ===== 注册 =====
ENT_CLASSES['car'] = Car;
DEVICE_RENDER['car'] = drawCar;
DEVICE_PANEL['car'] = { html: carPanelHtml, live: carPanelLive, tip: carTip, onAction: carOnAction };
DEVICE_DIR_ROTATE['car'] = true;

// ===== 坦克渲染与面板 =====
function drawTank(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const wpx = TILE * e.w, hpx = TILE * e.h;
  const cx = px + wpx / 2, cy = py + hpx / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  // 底盘履带
  ctx.fillStyle = '#2a3026';
  rr(ctx, px + 4, py + 6, wpx - 8, hpx - 12, 6); ctx.fill();
  ctx.strokeStyle = '#1a1e18'; ctx.lineWidth = 2; ctx.stroke();
  // 装甲车身
  ctx.fillStyle = '#4a5a3a';
  rr(ctx, px + 10, py + 10, wpx - 20, hpx - 20, 6); ctx.fill();
  ctx.strokeStyle = '#2a3424'; ctx.lineWidth = 2; ctx.stroke();
  // 炮塔
  ctx.save();
  ctx.translate(cx, cy);
  const ang = (e.dir || 0) * Math.PI / 2;
  ctx.rotate(ang);
  ctx.fillStyle = '#3a4a2e';
  ctx.beginPath(); ctx.arc(0, 0, TILE * 0.42, 0, 7); ctx.fill(); ctx.stroke();
  // 主炮管
  ctx.fillStyle = '#2a3424';
  ctx.fillRect(TILE * 0.1, -TILE * 0.07, TILE * 0.72, TILE * 0.14);
  ctx.restore();
  // 状态灯
  ctx.fillStyle = e.shells > 0 ? '#d0a84a' : '#555';
  ctx.fillRect(px + wpx - 20, py + 8, 8, 8);
  ctx.restore();
}
function tankPanelHtml(e) {
  let h = row('燃料', (e.fuelRocket > 0 ? ('火箭燃料 ' + e.fuelRocket) : '') + (e.fuelRocket > 0 && (e.fuelSolid > 0 || e.fuelCoal > 0) ? ' + ' : '') + (e.fuelSolid > 0 ? ('固体燃料 ' + e.fuelSolid) : '') + ((e.fuelRocket > 0 || e.fuelSolid > 0) && e.fuelCoal > 0 ? ' + ' : '') + (e.fuelCoal > 0 ? ('煤 ' + e.fuelCoal) : '<span class="dim">空</span>') + ' / ' + TANK_FUEL_CAP, 'fuel');
  const parts = [];
  if (e.euShells > 0) parts.push('铀爆弹 ' + e.euShells);
  if (e.eShells > 0) parts.push('爆炸弹 ' + e.eShells);
  if (e.uShells > 0) parts.push('铀弹 ' + e.uShells);
  if (e.shells > 0) parts.push('炮弹 ' + e.shells);
  const shellStr = parts.length ? parts.join(' + ') + ' / ' + TANK_SHELL_CAP : '<span class="dim">无</span>';
  h += row('炮弹', shellStr, 'shell');
  const cf = Math.min(invCount('coal'), TANK_FUEL_CAP - e.fuelCoal - e.fuelSolid - e.fuelRocket);
  const csol = Math.min(invCount('solid-fuel'), TANK_FUEL_CAP - e.fuelCoal - e.fuelSolid - e.fuelRocket);
  const crk = Math.min(invCount('rocket-fuel'), TANK_FUEL_CAP - e.fuelCoal - e.fuelSolid - e.fuelRocket);
  const cs = Math.min(invCount('cannon-shell'), TANK_SHELL_CAP - e.shells);
  const cu = Math.min(invCount('uranium-cannon-shell'), TANK_SHELL_CAP - e.uShells);
  const ce = Math.min(invCount('explosive-cannon-shell'), TANK_SHELL_CAP - e.eShells);
  const ceu = Math.min(invCount('explosive-uranium-cannon-shell'), TANK_SHELL_CAP - e.euShells);
  if (cf > 0) h += '<button data-action="feed" data-id="coal">放入煤 ×' + cf + '</button>';
  if (csol > 0) h += '<button data-action="feed" data-id="solid-fuel">放入固体燃料 ×' + csol + '</button>';
  if (crk > 0) h += '<button data-action="feed" data-id="rocket-fuel">放入火箭燃料 ×' + crk + '</button>';
  if (cs > 0) h += '<button data-action="feed" data-id="cannon-shell">装填炮弹 ×' + cs + '</button>';
  if (cu > 0) h += '<button data-action="feed" data-id="uranium-cannon-shell">装填铀炮弹 ×' + cu + '</button>';
  if (ce > 0) h += '<button data-action="feed" data-id="explosive-cannon-shell">装填爆炸炮弹 ×' + ce + '</button>';
  if (ceu > 0) h += '<button data-action="feed" data-id="explosive-uranium-cannon-shell">装填铀爆炸炮弹 ×' + ceu + '</button>';
  h += '<div class="status"></div>';
  h += '<button data-action="drive" class="primary">🚀 进入驾驶（空格开炮）</button>';
  h += '<div class="dim">坦克：重型战斗载具，装甲更厚（驾驶时受伤减少），按空格向光标方向发射炮弹（范围爆炸）。弹药分级对齐《异星工厂》：炮弹 → 爆炸炮弹（爆炸物科技，更大爆炸）→ 铀炮弹（核能科技）→ 铀爆炸炮弹（终极）。需高级战斗科技。</div>';
  h += trunkPanelHtml(e);
  h += vehEquipHtml(e);
  return h;
}
function tankPanelLive(e, api) {
  api.set('fuel', (e.fuelRocket > 0 ? ('火箭燃料 ' + e.fuelRocket) : '') + (e.fuelRocket > 0 && (e.fuelSolid > 0 || e.fuelCoal > 0) ? ' + ' : '') + (e.fuelSolid > 0 ? ('固体燃料 ' + e.fuelSolid) : '') + ((e.fuelRocket > 0 || e.fuelSolid > 0) && e.fuelCoal > 0 ? ' + ' : '') + (e.fuelCoal > 0 ? ('煤 ' + e.fuelCoal) : dimSpan('空')) + ' / ' + TANK_FUEL_CAP);
  const parts = [];
  if (e.euShells > 0) parts.push('铀爆弹 ' + e.euShells);
  if (e.eShells > 0) parts.push('爆炸弹 ' + e.eShells);
  if (e.uShells > 0) parts.push('铀弹 ' + e.uShells);
  if (e.shells > 0) parts.push('炮弹 ' + e.shells);
  api.set('shell', parts.length ? parts.join(' + ') + ' / ' + TANK_SHELL_CAP : dimSpan('无'));
  const cf = Math.min(invCount('coal'), TANK_FUEL_CAP - e.fuelCoal - e.fuelSolid - e.fuelRocket);
  const csol = Math.min(invCount('solid-fuel'), TANK_FUEL_CAP - e.fuelCoal - e.fuelSolid - e.fuelRocket);
  const crk = Math.min(invCount('rocket-fuel'), TANK_FUEL_CAP - e.fuelCoal - e.fuelSolid - e.fuelRocket);
  const cs = Math.min(invCount('cannon-shell'), TANK_SHELL_CAP - e.shells);
  const cu = Math.min(invCount('uranium-cannon-shell'), TANK_SHELL_CAP - e.uShells);
  const ce = Math.min(invCount('explosive-cannon-shell'), TANK_SHELL_CAP - e.eShells);
  const ceu = Math.min(invCount('explosive-uranium-cannon-shell'), TANK_SHELL_CAP - e.euShells);
  api.toggle('button[data-action="feed"][data-id="coal"]', cf > 0, '放入煤 ×' + cf);
  api.toggle('button[data-action="feed"][data-id="solid-fuel"]', csol > 0, '放入固体燃料 ×' + csol);
  api.toggle('button[data-action="feed"][data-id="rocket-fuel"]', crk > 0, '放入火箭燃料 ×' + crk);
  api.toggle('button[data-action="feed"][data-id="cannon-shell"]', cs > 0, '装填炮弹 ×' + cs);
  api.toggle('button[data-action="feed"][data-id="uranium-cannon-shell"]', cu > 0, '装填铀炮弹 ×' + cu);
  api.toggle('button[data-action="feed"][data-id="explosive-cannon-shell"]', ce > 0, '装填爆炸炮弹 ×' + ce);
  api.toggle('button[data-action="feed"][data-id="explosive-uranium-cannon-shell"]', ceu > 0, '装填铀爆炸炮弹 ×' + ceu);
  if (G.driving && G.driving.ent === e) api.status('驾驶中（空格开炮，E 下车）', 'ok');
  else if (e.fuelCoal <= 0 && e.fuelSolid <= 0 && e.fuelRocket <= 0) api.status('缺燃料：放入煤/固体燃料/火箭燃料后可驾驶', 'warn');
  else api.status('可驾驶', 'ok');
}
function tankTip(e) {
  if (G.driving && G.driving.ent === e) return '坦克驾驶中（空格开炮，E 下车）';
  return '坦克（煤 ' + (e.fuelCoal || 0) + (e.fuelSolid > 0 ? '，固体燃料 ' + e.fuelSolid : '') + (e.fuelRocket > 0 ? '，火箭燃料 ' + e.fuelRocket : '') + ' · 炮弹 ' + (e.shells || 0) + (e.uShells > 0 ? ' + 铀弹 ' + e.uShells : '') + (e.eShells > 0 ? ' + 爆炸弹 ' + e.eShells : '') + (e.euShells > 0 ? ' + 铀爆弹 ' + e.euShells : '') + '），按 E 进入驾驶';
}
function tankOnAction(act) {
  if (act === 'drive') {
    const t = G.panelEnt;
    if (t instanceof Tank) { enterCar(t); return true; }
  }
  return false;
}

// ===== 注册 =====
ENT_CLASSES['tank'] = Tank;
DEVICE_RENDER['tank'] = drawTank;
DEVICE_PANEL['tank'] = { html: tankPanelHtml, live: tankPanelLive, tip: tankTip, onAction: tankOnAction };
ENT_CLASSES['spidertron'] = Spidertron;
DEVICE_RENDER['spidertron'] = drawSpidertron;
DEVICE_PANEL['spidertron'] = { html: spiderPanelHtml, live: spiderPanelLive, tip: spiderTip, onAction: tankOnAction };
DEVICE_DIR_ROTATE['tank'] = true;
