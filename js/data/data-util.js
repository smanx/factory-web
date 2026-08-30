'use strict';

const DEFAULT_SETTINGS = { infiniteOre: true, autoSave: true, combat: false, capDPR: true, lowRes: false, minimap: true, sound: true, soundVol: 0.8, altMode: true, weather: false, daylight: false, music: true, language: 'zh', showReach: false };  // sound:音效开关 soundVol:音量0~1  altMode:ALT模式(建筑配方/内容叠加显示)  language:界面数据语言('zh'中文/'en'English)  showReach:显示角色建造范围圆圈(默认关闭)
const SETTINGS_KEY = 'factory-settings-v1';

// ===== 多语言名称（官方 locale 数据，见 GAME_DATA.names / GAME_DATA.recipeNames）=====
// 按设置 G.settings.language 返回物品/建筑/流体/配方的官方中文或英文名；
// 未收录官方名的项目自定物品回到手工中文名 manual。所有显示点经 ITEMS[id].name 读取，自动生效。
function localizedName(id, manual) {
  const lang = (typeof G !== 'undefined' && G.settings && G.settings.language === 'en') ? 'en' : 'zh';
  const n = (GAME_DATA.names && GAME_DATA.names[id]) || (GAME_DATA.recipeNames && GAME_DATA.recipeNames[id]);
  if (n && n[lang]) return n[lang];
  return manual || id;
}

function drawItemGlyph(x, id, cx, cy, s) {
  const col = ITEMS[id].color;
  const r = s / 2;
  const dark = 'rgba(10,12,16,.55)';
  x.save();
  x.translate(cx, cy);
  // 专属图标最优先：命中 ITEM_CUSTOM_ICONS（data-item-icons.js）的物品使用手绘专属图标，
  // 跳过 emoji 兜底，保证每个已设计物品有独一无二的辨识度。
  const _custom = typeof ITEM_CUSTOM_ICONS !== 'undefined' && ITEM_CUSTOM_ICONS[id];
  if (_custom) {
    _custom(x, r, s, col);
    x.restore();
    return;
  }
  // emoji 图标优先：所有配置了 emoji 字段的物品一律使用 emoji 渲染
  // 直接渲染 emoji 原图：不绘制边框、底框与高光/阴影蒙层，保证 emoji 清晰可见。
  const _emoji = ITEMS[id].emoji;
  if (_emoji) {
    const eb = r * 0.92;
    x.font = Math.round(eb * 1.4) + 'px "Segoe UI Emoji","Noto Color Emoji","Apple Color Emoji",system-ui';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = '#fff';
    x.fillText(_emoji, 0, 1);
    x.restore();
    return;
  }
  switch (id) {
    case 'iron-ore':
    case 'copper-ore': {
      // 立体矿石：三颗带高光的矿粒
      for (let i = 0; i < 3; i++) {
        const a = i * 2.09 - Math.PI / 2;
        const cx = Math.cos(a) * r * 0.36, cy = Math.sin(a) * r * 0.36;
        const rr = s * 0.17;
        const g = x.createLinearGradient(cx - rr, cy - rr, cx + rr, cy + rr);
        g.addColorStop(0, lightenColor(col, 0.5));
        g.addColorStop(1, darkenColor(col, 0.3));
        x.fillStyle = g;
        x.beginPath();
        x.arc(cx, cy, rr, 0, 7);
        x.fill();
        // 高光
        x.fillStyle = 'rgba(255,255,255,.35)';
        x.beginPath();
        x.arc(cx - rr * 0.28, cy - rr * 0.32, rr * 0.32, 0, 7);
        x.fill();
      }
      break;
    }
    case 'coal': {
      const g = x.createLinearGradient(-r * 0.6, -r * 0.85, r * 0.6, r * 0.6);
      g.addColorStop(0, lightenColor(col, 0.3));
      g.addColorStop(1, darkenColor(col, 0.35));
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(-r * 0.6, -r * 0.5);
      x.lineTo(0, -r * 0.85);
      x.lineTo(r * 0.7, -r * 0.3);
      x.lineTo(r * 0.45, r * 0.6);
      x.lineTo(-r * 0.55, r * 0.55);
      x.closePath();
      x.fill();
      // 顶面高光
      x.fillStyle = 'rgba(255,255,255,.16)';
      x.beginPath();
      x.moveTo(-r * 0.5, -r * 0.42);
      x.lineTo(0, -r * 0.72);
      x.lineTo(r * 0.55, -r * 0.3);
      x.lineTo(-r * 0.05, -r * 0.42);
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
      // 金属板：渐变 + 顶部高光 + 底部阴影，立体金属质感
      const g = x.createLinearGradient(-r * 0.85, -r * 0.55, r * 0.85, r * 0.55);
      g.addColorStop(0, lightenColor(col, 0.42));
      g.addColorStop(1, darkenColor(col, 0.28));
      x.fillStyle = g;
      x.fillRect(-r * 0.85, -r * 0.55, r * 1.7, r * 1.1);
      // 顶部折光
      x.fillStyle = 'rgba(255,255,255,.45)';
      x.fillRect(-r * 0.85, -r * 0.55, r * 1.7, r * 0.2);
      x.fillStyle = 'rgba(255,255,255,.18)';
      x.fillRect(-r * 0.85, -r * 0.35, r * 1.7, r * 0.1);
      // 底部暗部
      x.fillStyle = 'rgba(0,0,0,.18)';
      x.fillRect(-r * 0.85, r * 0.3, r * 1.7, r * 0.25);
      break;
    }
    case 'iron-gear-wheel': {
      const g = x.createLinearGradient(-r * 0.8, -r * 0.8, r * 0.8, r * 0.8);
      g.addColorStop(0, lightenColor(col, 0.4));
      g.addColorStop(1, darkenColor(col, 0.3));
      x.fillStyle = g;
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
      // 顶部高光
      x.fillStyle = 'rgba(255,255,255,.22)';
      x.beginPath();
      x.arc(0, -s * 0.18, s * 0.3, Math.PI, 0);
      x.fill();
      break;
    }
    case 'copper-cable': {
      // 铜线：粗线 + 高光细线，更具金属线缆质感
      x.strokeStyle = darkenColor(col, 0.3);
      x.lineWidth = s * 0.16;
      x.lineCap = 'round';
      x.beginPath();
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const px = -r * 0.8 + t * r * 1.6;
        const py = Math.sin(t * Math.PI * 3) * r * 0.42;
        i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
      }
      x.stroke();
      // 高光芯线
      x.strokeStyle = 'rgba(255,255,255,.5)';
      x.lineWidth = s * 0.05;
      x.beginPath();
      for (let i = 0; i <= 12; i++) {
        const t = i / 12;
        const px = -r * 0.8 + t * r * 1.6;
        const py = Math.sin(t * Math.PI * 3) * r * 0.42 - s * 0.02;
        i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
      }
      x.stroke();
      break;
    }
    case 'electronic-circuit': {
      const g = x.createLinearGradient(-r * 0.72, -r * 0.62, r * 0.72, r * 0.62);
      g.addColorStop(0, lightenColor(col, 0.4));
      g.addColorStop(1, darkenColor(col, 0.3));
      x.fillStyle = g;
      x.fillRect(-r * 0.72, -r * 0.62, r * 1.44, r * 1.24);
      x.strokeStyle = '#123c16';
      x.lineWidth = Math.max(1, s * 0.06);
      x.beginPath();
      x.moveTo(-r * 0.5, 0); x.lineTo(r * 0.5, 0);
      x.moveTo(0, -r * 0.45); x.lineTo(0, r * 0.45);
      x.stroke();
      // 高光
      x.fillStyle = 'rgba(255,255,255,.14)';
      x.fillRect(-r * 0.72, -r * 0.62, r * 1.44, r * 0.16);
      break;
    }
    case 'automation-science-pack':
    case 'logistic-science-pack':
    case 'chemical-science-pack':
    case 'military-science-pack':
    case 'production-science-pack':
    case 'utility-science-pack': {
      // 科学瓶：瓶盖 + 渐变液滴
      x.fillStyle = '#e8ecf2';
      x.fillRect(-r * 0.16, -r * 0.82, r * 0.32, r * 0.32);
      const g = x.createLinearGradient(-r * 0.6, -r * 0.5, r * 0.6, r * 0.68);
      g.addColorStop(0, lightenColor(col, 0.4));
      g.addColorStop(1, darkenColor(col, 0.3));
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(-r * 0.16, -r * 0.5);
      x.lineTo(r * 0.16, -r * 0.5);
      x.lineTo(r * 0.68, r * 0.68);
      x.arc(0, r * 0.68, r * 0.68, 0, Math.PI, true);
      x.closePath();
      x.fill();
      // 液滴高光
      x.fillStyle = 'rgba(255,255,255,.3)';
      x.beginPath();
      x.moveTo(-r * 0.05, -r * 0.28);
      x.lineTo(r * 0.02, -r * 0.28);
      x.arc(0, r * 0.2, r * 0.3, -0.4, Math.PI + 0.4, true);
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
    case 'barrel':
    case 'water-barrel':
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
    case 'hazard-concrete':
    case 'refined-hazard-concrete': {
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
      if (id === 'hazard-concrete' || id === 'refined-hazard-concrete') {
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
    case 'personal-roboport-equipment':
    case 'personal-roboport-mk2-equipment': {
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
      x.moveTo(0, -r * 0.62); x.lineTo(0, -r * 0.82);
      x.stroke();
      x.fillStyle = '#e0d040';
      x.beginPath();
      x.arc(0, -r * 0.86, r * 0.09, 0, 7);
      x.fill();
      // 中部圆盘（机器人进出港标识）
      x.fillStyle = (id === 'personal-roboport-mk2-equipment') ? '#d04a5a' : '#b8c0a0';
      x.beginPath();
      x.arc(0, -r * 0.1, r * 0.32, 0, 7);
      x.fill();
      x.strokeStyle = dark;
      x.lineWidth = Math.max(1, s * 0.04);
      x.stroke();
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
      // 通用精美图标：立体渐变底 + 圆角 + 高光 + 描边 + 精致首字符
      // 范围控制在 r*0.85 内，配合 iconCanvas 的 size*1.08 正好铺满整个格子。
      const box = r * 0.86;                      // 半边长（图形最大范围）
      const grad = x.createLinearGradient(-box, -box, box, box);
      const lighter = lightenColor(col, 0.45);
      const darker = darkenColor(col, 0.38);
      grad.addColorStop(0, lighter);
      grad.addColorStop(1, darker);
      x.fillStyle = grad;
      rrPath(x, -box, -box, box * 2, box * 2, box * 0.34);
      x.fill();
      // 外描边（加深立体感）
      x.strokeStyle = darkenColor(col, 0.55);
      x.lineWidth = Math.max(1, s * 0.045);
      x.stroke();
      // 顶部光泽高光
      x.fillStyle = 'rgba(255,255,255,.22)';
      rrPath(x, -box + s * 0.08, -box + s * 0.08, box * 2 - s * 0.16, box * 0.62, box * 0.28);
      x.fill();
      // 底部内侧阴影
      x.fillStyle = 'rgba(0,0,0,.16)';
      rrPath(x, -box + s * 0.08, box - box * 0.5, box * 2 - s * 0.16, box * 0.42, box * 0.22);
      x.fill();
      // emoji 图标优先（若配置了 emoji 字段则渲染 emoji，否则回退到首字符/标记文字）
      const emoji = ITEMS[id].emoji;
      if (emoji) {
        x.font = Math.round(box * 1.15) + 'px "Segoe UI Emoji","Noto Color Emoji","Apple Color Emoji",system-ui';
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.fillText(emoji, 0, 1);
      } else {
        // 文字：白字 + 深色描边，清晰醒目
        const label = (ITEMS[id].mark || ITEMS[id].name[0]).slice(0, 2);
        x.font = 'bold ' + Math.round(box * 1.0) + 'px system-ui';
        x.textAlign = 'center';
        x.textBaseline = 'middle';
        x.lineWidth = Math.max(1, s * 0.09);
        x.strokeStyle = 'rgba(10,14,20,.85)';
        x.lineJoin = 'round';
        x.strokeText(label, 0, 1);
        x.fillStyle = '#f7f9fb';
        x.fillText(label, 0, 1);
      }
      // 底部迷你高光（金属质感）
      x.fillStyle = 'rgba(255,255,255,.1)';
      x.fillRect(-box * 0.7, box * 0.6, box * 1.4, Math.max(1, s * 0.05));
    }

  }
  x.restore();
}

// 颜色工具：对十六进制色值做明暗处理（用于图标立体渐变），返回新 hex。
function shadeColor(hex, amt) {
  const h = (hex || '#888888').replace('#', '');
  let n = parseInt(h.length === 3 ? h.split('').map(c => c + c).join('') : h, 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const t = amt < 0 ? 0 : 255;
  const p = Math.abs(amt);
  r = Math.round((t - r) * p) + r;
  g = Math.round((t - g) * p) + g;
  b = Math.round((t - b) * p) + b;
  const to2 = v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0');
  return '#' + to2(r) + to2(g) + to2(b);
}
function lightenColor(hex, amt) { return shadeColor(hex, Math.abs(amt)); }
function darkenColor(hex, amt) { return shadeColor(hex, -Math.abs(amt)); }

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
function isBurnerFuel(item) { return item === 'coal' || item === 'wood' || item === 'solid-fuel' || item === 'rocket-fuel' || item === 'nuclear-fuel' || item === 'raw-fish' || item === 'pentapod-egg'; }
function fuelEnergy(item) {
  // 数据单源：优先取 GAME_DATA.fuelEnergy（data.generated.js，含弱效生物质燃料），
  // 其余常用燃料由 data.js 常量（亦来自 GAME_DATA.fuelEnergy）提供。
  const fe = GAME_DATA && GAME_DATA.fuelEnergy && GAME_DATA.fuelEnergy[item];
  if (typeof fe === 'number') return fe;
  if (item === 'nuclear-fuel') return NUCLEAR_FUEL_ENERGY;  // 核燃料能量密度最高（对齐《异星工厂》：核燃料远高于火箭燃料）
  if (item === 'rocket-fuel') return ROCKET_FUEL_ENERGY;
  if (item === 'solid-fuel') return SOLID_FUEL_ENERGY;
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
// 科研速度倍率（对齐《异星工厂》Research speed 累加式 laboratory-speed，链条 L1~L6）：
// 各等级累加 modifier：+0.2/+0.3/+0.4/+0.5/+0.5/+0.6 → 满级加成 +2.5（最终 ×3.5），超过 6 级不再叠加。
// 空间科研速度（终局额外加成）：每级累加 +5%。
// 科研产能（Research productivity）无限科技：每级让研究进度 +10% 累加（对齐官方，非复利）。
function labSpeedMult() {
  const lvl = techResearched('research-speed') ? Math.min(6, Math.max(1, techLevel('research-speed') || 1)) : 0;
  const lvlADD = [0, 0.2, 0.5, 0.9, 1.4, 1.9, 2.5];
  let m = 1 + lvlADD[lvl];
  m += 0.05 * techLevel('space-research-speed');
  m += 0.1 * techLevel('research-productivity');
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
// 物品生产产能无限科技（对齐《异星工厂》各 *-productivity 无限科技）：每级让指定物品产出额外 +10%。
// 通过累积分数进度，在整数产物上追加额外产出（与产能模块 prodBuf 机制一致）。
// 返回该物品的产能加成分数（每级 0.1）。
function techProductivity(item) {
  const map = {
    'processing-unit': 'processing-unit-productivity',
    'steel-plate': 'steel-plate-productivity',
    'plastic-bar': 'plastic-bar-productivity',
    'rocket-fuel': 'rocket-fuel-productivity',
    'low-density-structure': 'low-density-structure-productivity',
    'rocket-part': 'rocket-part-productivity',
    'scrap': 'scrap-recycling-productivity',
    'metallic-asteroid-chunk': 'asteroid-productivity',
    'carbonic-asteroid-chunk': 'asteroid-productivity',
    'oxide-asteroid-chunk': 'asteroid-productivity',
    'promethium-asteroid-chunk': 'asteroid-productivity'
  };
  const tid = map[item];
  if (!tid || !techResearched(tid)) return 0;
  return 0.1 * techLevel(tid);
}
// 实体级产能分数缓冲：给定实体与本次产出物品/数量，累积产能分数并返回应追加的整数额外产物。
// e 须有 prodTechBuf 字段（各生产设备在构造时初始化）。
function applyTechProductivity(e, item, count) {
  const frac = techProductivity(item);
  if (!frac) return 0;
  if (e.prodTechBuf === undefined) e.prodTechBuf = 0;
  e.prodTechBuf += count * frac;
  const whole = Math.floor(e.prodTechBuf);
  if (whole >= 1) { e.prodTechBuf -= whole; return whole; }
  return 0;
}


// 健康无限科技等级（对齐《异星工厂》Space Age Health 科技）：每级提升主角最大生命值 +50
function healthLevel() {
  if (!techResearched('health')) return 0;
  return techLevel('health');
}
// 主角最大生命值（基础 250 + 健康无限科技每级 +50，对齐官方 health 科技 character-health-bonus +50/级）
function playerMaxHp() {
  return PLAYER_BASE_MAX_HP + 50 * healthLevel();
}

// 武器伤害无限科技倍率（对齐《异星工厂》Weapon damage）：每级 +10%，作用于玩家武器与炮塔
function weaponDamageMult() {
  const lvl = (G.techProg && G.techProg['weapon-damage']) || 0;
  return 1 + 0.1 * lvl;
}
// 分类军事无限科技倍率（对齐《异星工厂》Military research 无限科技）：
// 在通用武器伤害之上再按武器类别叠加（投射物/能量/燃烧/爆炸）。
// kind: 'projectile' | 'energy' | 'fire' | 'explosives'
function weaponCategoryMult(kind) {
  const map = { projectile: 'physical-projectile-damage', energy: 'energy-weapons-damage', fire: 'refined-flammables', explosives: 'stronger-explosives' };
  const tid = map[kind];
  if (!tid) return 1;
  const lvl = (G.techProg && G.techProg[tid]) || 0;
  return 1 + 0.1 * lvl;
}
// 根据武器/设备 id 返回其伤害分类（projectile/energy/fire/explosives），用于套用分类军事无限科技。
function weaponDamageKind(id) {
  if (!id) return 'projectile';
  // 枪械类投射物
  if (/pistol|submachine|shotgun|firearm-magazine|rounds|cannon|turret(?!-laser)|machine/.test(id)) return 'projectile';
  // 能量武器
  if (/laser/.test(id)) return 'energy';
  // 燃烧类
  if (/flame|fire|flammable/.test(id)) return 'fire';
  // 爆炸类
  if (/rocket|grenade|explosives|bomb|artillery|land-mine|shell|mine/.test(id)) return 'explosives';
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

// ===== 官方多语言命名桥接（GAME_DATA.names / recipeNames 由 factorio-data locale 现场生成）=====
// 把每个 ITEMS[id].name 替换为 getter：按设置 G.settings.language 返回官方中文/英文名，
// 未收录官方名时回退到手工中文名。面板/提示/ALT/合成列表等所有读 ITEMS[id].name 处自动中英切换。
// 在此处（data-util.js 末尾）安装，晚于 data-items.js 等文件，其加载期读取的仍是手工名，无副作用。
for (const id in ITEMS) {
  const manual = ITEMS[id].name;
  Object.defineProperty(ITEMS[id], 'name', {
    get() { return localizedName(id, manual); },
    configurable: true
  });
}

// ===== 品质物品变体（对齐《异星工厂》Quality DLC）=====
// 品质模块产出 `item~quality`（罕见/稀有/史诗/传说）。为让各处读 ITEMS[id].name/color 正常显示，
// 此处（data-util.js，晚于 data-items/data-buildings 加载）为所有可建造/可装备物品预生成各品质变体条目。
(function qualityVariantGen() {
  const qTiers = (typeof GAME_DATA !== 'undefined' && GAME_DATA.qualityTiers) || [];
  const qNames = { normal: '普通', uncommon: '罕见', rare: '稀有', epic: '史诗', legendary: '传说' };
  const qNamesEn = { normal: '', uncommon: 'Uncommon ', rare: 'Rare ', epic: 'Epic ', legendary: 'Legendary ' };
  const qColors = { uncommon: '#2ba53d', rare: '#1968b2', epic: '#8900b2', legendary: '#b26800' };
  const qColorOf = (q) => {
    const t = qTiers.find(x => x.id === q);
    if (t && t.color && t.color.length >= 3) return 'rgb(' + t.color[0] + ',' + t.color[1] + ',' + t.color[2] + ')';
    return qColors[q] || '#d0d0d0';
  };
  const qualityTargets = new Set(Object.keys(BUILD_DEFS || {}));
  globalThis.QUALITY_ELIGIBLE_ITEMS = qualityTargets;
  if (typeof EQUIPMENT !== 'undefined') for (const k in EQUIPMENT) qualityTargets.add(k);
  for (const baseId of qualityTargets) {
    const base = ITEMS[baseId];
    if (!base) continue;
    for (const q of ['uncommon', 'rare', 'epic', 'legendary']) {
      const vid = baseId + '~' + q;
      if (ITEMS[vid]) continue;
      const manual = (typeof G !== 'undefined' && G.settings && G.settings.language === 'en') ? (qNamesEn[q] + base.name) : (qNames[q] + base.name);
      const descBase = base.desc || '';
      ITEMS[vid] = {
        name: manual,
        color: qColorOf(q),
        desc: descBase + '（' + qNames[q] + '品质：属性更强）',
        mark: base.mark,
        emoji: base.emoji,
        _quality: q,
        _base: baseId,
        _qualityVariant: true,
      };
    }
  }
})();

// ===== 机械臂精准补货辅助 =====
// 对齐《异星工厂》：机械臂按配方实际消耗量精准补货，而非一次性塞满硬编码大数值。
// 1) 组装机/化工厂/离心机等：每种原料补充到「配方单次消耗量 × 2」
// 2) 熔炉：矿石补充到「冶炼配方单次消耗量 × 2」，燃料补充到「足够燃烧 5 秒」的量
function smeltNeed(item) {
  for (const r of SMELTS) if (r.inp === item) return r.inCount || 1;
  return 1;
}
// 燃料上限 = 足够燃烧 5 秒所需的燃料块数（每块燃料提供 fuelEnergy 点能量，熔炉每秒消耗 fuelConsumptionMult() 点）
function fuelLimitFor5s(fuelEnergy) {
  return Math.max(1, Math.ceil(5 * fuelConsumptionMult() / fuelEnergy));
}

// ===== 产物「堆积即停工」判定（动态「够用」状态） =====
// 规则（除熔炉外所有生产设备统一遵循）：产物输出栏里某产物的存量一旦
// 「足够再进行 2 次生产」（存量 + 一次产出量 > 2 × 一次产出量，即存量 > 一次产出量），
// 设备即视为产物堆积：本机停止生产，输入机械臂/管道也停止送料，防止原料
// 过度积压在前端机器上；存量低于两次生产所需时恢复正常运行。
// 熔炉（Furnace）是例外：持续工作直到产品栏堆满一整组（Stack，stackSize()）为止。
// cap：产物缓冲硬上限（默认 50），任何情况下不得超过。
function outputBacklogged(outp, recOut, cap) {
  const hardCap = (typeof cap === 'number' && cap > 0) ? cap : 50;
  for (const k in recOut) {
    const per = recOut[k] || 1;
    const have = outp[k] || 0;
    if (have + per > hardCap) return true;            // 超硬上限：必然停
    if (have >= per * 2) return true;                 // 存量足够再生产 2 次：堆积停工
  }
  return false;
}
