'use strict';

const DEFAULT_SETTINGS = { infiniteOre: true, autoSave: true, combat: false, capDPR: true, lowRes: false, virtualJoystick: false, minimap: true, sound: true, soundVol: 0.8, altMode: true, weather: false, daylight: false, music: true };  // sound:音效开关 soundVol:音量0~1  altMode:ALT模式(建筑配方/内容叠加显示)
const SETTINGS_KEY = 'factory-settings-v1';

function drawItemGlyph(x, id, cx, cy, s) {
  const col = ITEMS[id].color;
  const r = s / 2;
  const dark = 'rgba(10,12,16,.55)';
  x.save();
  x.translate(cx, cy);
  switch (id) {
    case 'iron-ore':
    case 'copper-ore': {
      x.fillStyle = col;
      for (let i = 0; i < 3; i++) {
        const a = i * 2.09 - Math.PI / 2;
        x.beginPath();
        x.arc(Math.cos(a) * r * 0.36, Math.sin(a) * r * 0.36, s * 0.17, 0, 7);
        x.fill();
      }
      break;
    }
    case 'coal': {
      x.fillStyle = col;
      x.beginPath();
      x.moveTo(-r * 0.6, -r * 0.5);
      x.lineTo(0, -r * 0.85);
      x.lineTo(r * 0.7, -r * 0.3);
      x.lineTo(r * 0.45, r * 0.6);
      x.lineTo(-r * 0.55, r * 0.55);
      x.closePath();
      x.fill();
      break;
    }
    case 'stone': {
      x.fillStyle = col;
      x.beginPath();
      x.moveTo(-r * 0.7, r * 0.2);
      x.lineTo(-r * 0.15, -r * 0.65);
      x.lineTo(r * 0.35, -r * 0.1);
      x.lineTo(-r * 0.05, r * 0.6);
      x.closePath();
      x.fill();
      x.beginPath();
      x.moveTo(r * 0.1, r * 0.55);
      x.lineTo(r * 0.45, r * 0.05);
      x.lineTo(r * 0.75, r * 0.55);
      x.closePath();
      x.fill();
      break;
    }
    case 'iron-plate':
    case 'copper-plate': {
      x.fillStyle = col;
      x.fillRect(-r * 0.85, -r * 0.55, r * 1.7, r * 1.1);
      x.fillStyle = 'rgba(255,255,255,.4)';
      x.fillRect(-r * 0.85, -r * 0.55, r * 1.7, r * 0.22);
      break;
    }
    case 'iron-gear': {
      x.fillStyle = col;
      x.beginPath();
      for (let i = 0; i < 16; i++) {
        const a = i * Math.PI / 8;
        const rad = i % 2 ? s * 0.17 : s * 0.42;
        const px = Math.cos(a) * rad, py = Math.sin(a) * rad;
        i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
      }
      x.closePath();
      x.moveTo(s * 0.09, 0);
      x.arc(0, 0, s * 0.11, 0, Math.PI * 2, true);
      x.fill('evenodd');
      break;
    }
    case 'copper-cable': {
      x.strokeStyle = col;
      x.lineWidth = s * 0.14;
      x.lineCap = 'round';
      x.beginPath();
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const px = -r * 0.8 + t * r * 1.6;
        const py = Math.sin(t * Math.PI * 3) * r * 0.42;
        i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
      }
      x.stroke();
      break;
    }
    case 'green-circuit': {
      x.fillStyle = col;
      x.fillRect(-r * 0.72, -r * 0.62, r * 1.44, r * 1.24);
      x.strokeStyle = '#123c16';
      x.lineWidth = Math.max(1, s * 0.06);
      x.beginPath();
      x.moveTo(-r * 0.5, 0); x.lineTo(r * 0.5, 0);
      x.moveTo(0, -r * 0.45); x.lineTo(0, r * 0.45);
      x.stroke();
      break;
    }
    case 'science-pack':
    case 'green-science':
    case 'blue-science':
    case 'military-science':
    case 'production-science-pack':
    case 'utility-science-pack': {
      x.fillStyle = '#e8ecf2';
      x.fillRect(-r * 0.16, -r * 0.9, r * 0.32, r * 0.35);
      x.fillStyle = col;
      x.beginPath();
      x.moveTo(-r * 0.16, -r * 0.55);
      x.lineTo(r * 0.16, -r * 0.55);
      x.lineTo(r * 0.75, r * 0.75);
      x.arc(0, r * 0.75, r * 0.75, 0, Math.PI, true);
      x.closePath();
      x.fill();
      break;
    }
    case 'water':
    case 'steam':
    case 'crude-oil':
    case 'heavy-oil':
    case 'light-oil':
    case 'petroleum-gas':
    case 'sulfuric-acid': {
      x.fillStyle = col;
      x.beginPath();
      x.arc(0, r * 0.15, r * 0.55, 0, 7);
      x.fill();
      x.beginPath();
      x.ellipse(-r * 0.28, -r * 0.35, r * 0.2, r * 0.32, -0.5, 0, 7);
      x.ellipse(r * 0.3, -r * 0.2, r * 0.16, r * 0.26, 0.6, 0, 7);
      x.fill();
      break;
    }
    // ===== 流体桶（对齐《异星工厂》Barrel）：金属桶身 + 顶部环口 + 流体色带 =====
    case 'empty-barrel':
    case 'water-barrel':
    case 'steam-barrel':
    case 'crude-oil-barrel':
    case 'heavy-oil-barrel':
    case 'light-oil-barrel':
    case 'petroleum-gas-barrel':
    case 'lubricant-barrel':
    case 'sulfuric-acid-barrel': {
      const fluid = fluidFromBarrelItem(id);
      const bodyC = '#a8b0b8', rimC = '#7a8288', fluidC = fluid ? ITEMS[fluid].color : 'transparent';
      // 桶身
      x.fillStyle = bodyC;
      x.beginPath();
      x.moveTo(-r * 0.72, r * 0.05);
      x.lineTo(-r * 0.72, -r * 0.55);
      x.arc(0, -r * 0.55, r * 0.72, Math.PI, 0, true);
      x.lineTo(r * 0.72, r * 0.05);
      x.closePath();
      x.fill();
      // 底部
      x.fillStyle = rimC;
      x.beginPath();
      x.moveTo(-r * 0.72, r * 0.05);
      x.lineTo(r * 0.72, r * 0.05);
      x.lineTo(r * 0.62, r * 0.3);
      x.lineTo(-r * 0.62, r * 0.3);
      x.closePath();
      x.fill();
      // 流体色带（盛装流体的颜色）
      if (fluid) {
        x.fillStyle = fluidC;
        x.fillRect(-r * 0.6, -r * 0.15, r * 1.2, r * 0.28);
        x.fillStyle = 'rgba(0,0,0,.25)';
        x.fillRect(-r * 0.6, -r * 0.15, r * 1.2, r * 0.05);
      }
      // 顶部环口
      x.strokeStyle = rimC;
      x.lineWidth = Math.max(1.5, s * 0.08);
      x.beginPath();
      x.arc(0, -r * 0.72, r * 0.22, 0, 7);
      x.stroke();
      x.fillStyle = '#d8dee2';
      x.beginPath();
      x.arc(0, -r * 0.72, r * 0.12, 0, 7);
      x.fill();
      break;
    }
    case 'refined-concrete':
    case 'hazard-concrete': {
      // 地砖图标：四块石板拼合（警示混凝土加条纹）
      x.fillStyle = col;
      rrPath(x, -r * 0.8, -r * 0.8, r * 1.6, r * 1.6, s * 0.1);
      x.fill();
      x.strokeStyle = dark;
      x.lineWidth = Math.max(1, s * 0.05);
      x.stroke();
      // 石板缝
      x.strokeStyle = 'rgba(0,0,0,.35)';
      x.lineWidth = Math.max(1, s * 0.04);
      x.beginPath();
      x.moveTo(-r * 0.2, -r * 0.8); x.lineTo(-r * 0.2, r * 0.8);
      x.moveTo(r * 0.55, -r * 0.8); x.lineTo(r * 0.55, r * 0.8);
      x.moveTo(-r * 0.8, r * 0.1); x.lineTo(r * 0.8, r * 0.1);
      x.stroke();
      if (id === 'hazard-concrete') {
        // 黑黄警示斜纹
        x.strokeStyle = '#2a2a30';
        x.lineWidth = Math.max(1.5, s * 0.1);
        for (let i = 0; i < 3; i++) {
          const yy = -r * 0.9 + i * r * 0.6;
          x.beginPath();
          x.moveTo(-r * 0.9, yy + r * 0.3); x.lineTo(-r * 0.9 + r * 0.6, yy);
          x.moveTo(r * 0.9, yy + r * 0.3); x.lineTo(r * 0.9 - r * 0.6, yy);
          x.stroke();
        }
      }
      break;
    }
    // ===== 红/绿电路线缆（对齐《异星工厂》Red/Green wire）：一段卷曲的线缆 =====
    case 'red-wire':
    case 'green-wire': {
      const wireC = (id === 'red-wire') ? '#e05a4a' : '#3fbf4f';
      x.strokeStyle = wireC;
      x.lineWidth = Math.max(1.5, s * 0.12);
      x.lineCap = 'round';
      x.beginPath();
      for (let i = 0; i <= 14; i++) {
        const t = i / 14;
        const px = -r * 0.85 + t * r * 1.7;
        const py = Math.sin(t * Math.PI * 4) * r * 0.5 + (i === 0 ? -r * 0.3 : i === 14 ? r * 0.3 : 0);
        i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
      }
      x.stroke();
      // 两端线头
      x.fillStyle = '#d8dee2';
      x.beginPath(); x.arc(-r * 0.85, -r * 0.3, s * 0.07, 0, 7); x.fill();
      x.beginPath(); x.arc(r * 0.85, r * 0.3, s * 0.07, 0, 7); x.fill();
      break;
    }
    case 'personal-roboport':
    case 'personal-roboport-mk2': {
      // 机器人港：带雷达天线的方形基座
      x.fillStyle = col;
      rrPath(x, -r * 0.8, -r * 0.65, r * 1.6, r * 1.3, s * 0.1);
      x.fill();
      x.strokeStyle = dark;
      x.lineWidth = Math.max(1, s * 0.05);
      x.stroke();
      // 天线
      x.strokeStyle = dark;
      x.lineWidth = Math.max(1.2, s * 0.06);
      x.beginPath();
      x.moveTo(0, -r * 0.65); x.lineTo(0, -r * 0.95);
      x.stroke();
      x.fillStyle = '#e0d040';
      x.beginPath();
      x.arc(0, -r * 0.98, r * 0.1, 0, 7);
      x.fill();
      // 中部圆盘（机器人进出港标识）
      x.fillStyle = (id === 'personal-roboport-mk2') ? '#d04a5a' : '#b8c0a0';
      x.beginPath();
      x.arc(0, -r * 0.1, r * 0.32, 0, 7);
      x.fill();
      x.strokeStyle = dark;
      x.lineWidth = Math.max(1, s * 0.04);
      x.stroke();
      break;
    }
    // ===== 开采工具（铁斧 / 钢斧，对齐《异星工厂》Axe） =====
    case 'iron-axe':
    case 'steel-axe': {
      const steel = id === 'steel-axe';
      // 木柄
      x.fillStyle = '#8a6a3a';
      x.fillRect(-r * 0.06, -r * 0.95, r * 0.2, r * 1.9);
      // 斧刃
      x.fillStyle = steel ? '#e0e6ec' : '#b8c0c8';
      x.beginPath();
      x.moveTo(r * 0.05, -r * 0.95);
      x.arc(r * 0.5, -r * 0.5, r * 0.62, -Math.PI / 2, Math.PI / 2);
      x.lineTo(r * 0.05, r * 0.15);
      x.closePath();
      x.fill();
      x.fillStyle = 'rgba(255,255,255,.45)';
      x.beginPath();
      x.moveTo(r * 0.05, -r * 0.95);
      x.arc(r * 0.5, -r * 0.5, r * 0.62, -Math.PI / 2, 0);
      x.lineTo(r * 0.05, -r * 0.2);
      x.closePath();
      x.fill();
      break;
    }
    // ===== 规划器（拆除/升级，对齐《异星工厂》Planner） =====
    case 'deconstruction-planner':
    case 'upgrade-planner': {
      const decon = id === 'deconstruction-planner';
      x.fillStyle = '#f4f6f8';
      rrPath(x, -r * 0.8, -r * 0.7, r * 1.6, r * 1.4, s * 0.12);
      x.fill();
      x.strokeStyle = dark;
      x.lineWidth = Math.max(1, s * 0.05);
      x.stroke();
      x.fillStyle = decon ? '#d04848' : '#57b95c';
      rrPath(x, -r * 0.62, -r * 0.5, r * 1.24, r * 0.6, s * 0.08);
      x.fill();
      x.fillStyle = decon ? '#57b95c' : '#d04848';
      rrPath(x, -r * 0.62, r * 0.22, r * 1.24, r * 0.32, s * 0.08);
      x.fill();
      break;
    }
    default: {
      x.fillStyle = col;
      rrPath(x, -r * 0.8, -r * 0.8, r * 1.6, r * 1.6, s * 0.12);
      x.fill();
      x.strokeStyle = dark;
      x.lineWidth = Math.max(1, s * 0.05);
      x.stroke();
      x.fillStyle = '#f4f6f8';
      x.font = 'bold ' + Math.round(s * 0.42) + 'px system-ui';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText((ITEMS[id].mark || ITEMS[id].name[0]), 0, 1);
    }
  }
  x.restore();
}

function rrPath(x, px, py, w, h, r) {
  x.beginPath();
  x.moveTo(px + r, py);
  x.arcTo(px + w, py, px + w, py + h, r);
  x.arcTo(px + w, py + h, px, py + h, r);
  x.arcTo(px, py + h, px, py, r);
  x.arcTo(px, py, px + w, py, r);
  x.closePath();
  return x;
}

// 判断某物品是否为可燃烧燃料（煤 / 固体燃料）。各烧煤设备以此判断能否加入燃料。
function isBurnerFuel(item) { return item === 'coal' || item === 'wood' || item === 'solid-fuel' || item === 'rocket-fuel' || item === 'nuclear-fuel' || item === 'raw-fish'; }
function fuelEnergy(item) {
  if (item === 'nuclear-fuel') return NUCLEAR_FUEL_ENERGY;  // 核燃料能量密度最高（对齐《异星工厂》：核燃料远高于火箭燃料）
  if (item === 'rocket-fuel') return ROCKET_FUEL_ENERGY;
  if (item === 'solid-fuel') return SOLID_FUEL_ENERGY;
  if (item === 'raw-fish') return 4;  // 生鱼可作低效燃料（对齐《异星工厂》：鱼能烧，但能量很低）
  if (item === 'wood') return WOOD_FUEL_ENERGY;  // 木材低效燃料（约煤的 1/4）
  return COAL_ENERGY;
}

function beltSpeed()  {
  // 面板/数值以「双车道合计吞吐」计：基础传送带双车道合计 15 items/s（每车道 7.5），
  // 不会随任何科技升级而提升；更快的物流由更高级的传送带种类（快速带/极速带）提供。
  return BELT_SPEED * ((G.dbg && G.dbg.beltMult) || 1);
}
function drillMult()  { return (G.techDone.mining ? 2 : 1) * ((G.dbg && G.dbg.drillMult) || 1); }
function asmMult()    { return (G.techDone.automation ? 1.5 : 1) * (G.techDone.automation2 ? 1.2 : 1) * ((G.dbg && G.dbg.asmMult) || 1); }
function elecMachMult() { return (G.techDone.electric ? 1.2 : 1); }
function oilMult()    { return (G.techDone.oil ? 1.5 : 1); }
// 科研速度倍率（对齐《异星工厂》Research speed 无限科技）：普通科研速度 ×1.5，
// 空间科研速度无限科技每级再 ×1.2，可无限叠加。
function labSpeedMult() {
  let m = (techResearched('research-speed') ? 1.5 : 1);
  m *= Math.pow(1.2, techLevel('space-research-speed'));
  return m;
}
// 机器人速度倍率（对齐《异星工厂》Worker robot speed 无限科技）：每级 ×1.5 叠加。
// 兼容旧档：此前该科技为单次科技（techDone 已置位但 techProg=0），按 1 级处理。
function robotSpeedMult() {
  if (!techResearched('worker-robot-speed')) return 1;
  const lvl = Math.max(1, techLevel('worker-robot-speed'));
  return Math.pow(1.5, lvl);
}
// 采矿产能倍率（对齐《异星工厂》Mining productivity 无限科技）：采矿产能 ×1.1，
// 空间采矿产能无限科技每级再 ×1.1，可无限叠加。
function miningProdMult() {
  let m = (techResearched('mining-productivity') ? 1.1 : 1);
  m *= Math.pow(1.1, techLevel('space-mining-productivity'));
  return m;
}
// 燃料效率无限科技（对齐《异星工厂》Fuel efficiency）：每级降低所有燃烧设备燃料消耗约 9%。
// 通过把每秒燃料能量消耗乘以 fuelConsumptionMult()（<1），让每单位燃料维持更久、更耐用。
// 不影响核燃料棒（原版燃料效率不作用于核燃料燃烧时间）。
function fuelEfficiencyLevel() {
  if (!techResearched('fuel-efficiency')) return 0;
  return techLevel('fuel-efficiency');
}
// 燃料消耗系数（<1 表示更省燃料）。每级消耗降至 1/1.1 ≈ 0.909，即省约 9%。
function fuelConsumptionMult() {
  const lvl = fuelEfficiencyLevel();
  if (!lvl) return 1;
  return 1 / Math.pow(1.1, lvl);
}

// 武器伤害无限科技倍率（对齐《异星工厂》Weapon damage）：每级 +10%，作用于玩家武器与炮塔
function weaponDamageMult() {
  const lvl = (G.techProg && G.techProg['weapon-damage']) || 0;
  return 1 + 0.1 * lvl;
}
// 分类军事无限科技倍率（对齐《异星工厂》Military research 无限科技）：
// 在通用武器伤害之上再按武器类别叠加（投射物/能量/燃烧/爆炸）。
// kind: 'projectile' | 'energy' | 'fire' | 'explosive'
function weaponCategoryMult(kind) {
  const map = { projectile: 'physical-projectile-damage', energy: 'energy-weapons-damage', fire: 'refined-flammables', explosive: 'stronger-explosives' };
  const tid = map[kind];
  if (!tid) return 1;
  const lvl = (G.techProg && G.techProg[tid]) || 0;
  return 1 + 0.1 * lvl;
}
// 根据武器/设备 id 返回其伤害分类（projectile/energy/fire/explosive），用于套用分类军事无限科技。
function weaponDamageKind(id) {
  if (!id) return 'projectile';
  // 枪械类投射物
  if (/pistol|submachine|shotgun|magazine|rounds|cannon|turret(?!-laser)|machine/.test(id)) return 'projectile';
  // 能量武器
  if (/laser/.test(id)) return 'energy';
  // 燃烧类
  if (/flame|fire|flammable/.test(id)) return 'fire';
  // 爆炸类
  if (/rocket|grenade|explosive|bomb|artillery|land-mine|shell|mine/.test(id)) return 'explosive';
  return 'projectile';
}
// 机器人容量（对齐《异星工厂》Worker robot cargo size 无限科技）：物流/施工机器人单次搬运量基础 3，每级 +2。
function robotCarryCap() {
  const lvl = (G.techProg && G.techProg['worker-robot-cargo-size']) || 0;
  return 3 + 2 * lvl;
}
// 炮兵炮弹射击速度（对齐《异星工厂》Artillery shell shooting speed 无限科技）：每级射击间隔缩短 10%（即射速提升）。
function artilleryShootingSpeedMult() {
  const lvl = (G.techProg && G.techProg['artillery-shooting-speed']) || 0;
  return 1 + 0.1 * lvl;
}
// 玩家枪械/机枪炮塔射击速度（对齐《异星工厂》Shooting speed 无限科技）：每级射击间隔缩短 10%（即射速提升）。
function shootingSpeedMult() {
  const lvl = (G.techProg && G.techProg['shooting-speed']) || 0;
  return 1 + 0.1 * lvl;
}
// 炮兵射程（对齐《异星工厂》Artillery shell range 无限科技）：每级射程提升 30%。
function artilleryRangeMult() {
  const lvl = (G.techProg && G.techProg['artillery-shell-range']) || 0;
  return 1 + 0.3 * lvl;
}

// 军事科技 III / IV 机枪炮塔伤害倍率（对齐《异星工厂》Military 3 / Military 4）：
// 军事科技 III 使机枪炮塔伤害 +40%，军事科技 IV 额外 +60%（叠加）。
function turretDamageMult() {
  let m = 1;
  if (G.techDone && G.techDone['military3']) m *= 1.4;
  if (G.techDone && G.techDone['military4']) m *= 1.6;
  return m;
}
// 火车制动（对齐《异星工厂》Braking force 无限科技）：每级让列车停靠/让行等待时间缩短 15%。
function brakingForceMult() {
  const lvl = (G.techProg && G.techProg['braking-force']) || 0;
  return Math.pow(0.85, lvl);
}
// 火箭产能（对齐《异星工厂》Rocket productivity）：每级降低火箭组装部件需求。
// 返回各部件当前所需数量（每级各 -1，最低保留 1）。lvl 为已研究等级。
function rocketPartNeed(item, base) {
  const lvl = (G.techProg && G.techProg['rocket-productivity']) || 0;
  // 仅低密度结构与火箭燃料享受产能减免（对齐原版：产能作用于火箭燃料与低密度结构）
  if (item !== 'low-density-structure' && item !== 'rocket-fuel') return base;
  return Math.max(1, base - lvl);
}
