'use strict';

// ===== 小地图（Minimap） =====
// 位于画布右下角的缩略地图：只绘制已探索区块的地形与矿脉，玩家位置用亮点标出。
// 数据来源于 G.world.explored（区块级），瓦片级颜色直接查询确定性地形生成，避免额外存储。
const MINIMAP_SIZE = 168;           // 小地图边长（px）
const MINIMAP_ZOOM = 2.2;           // 每瓦片像素（越大多看得越细，但覆盖范围变小）
const MINIMAP_VIEW = Math.ceil(MINIMAP_SIZE / MINIMAP_ZOOM / 2); // 半边长覆盖瓦片数
function drawMinimap(ctx) {
  const size = MINIMAP_SIZE;
  const pad = 0;
  const x0 = W - size - pad, y0 = pad; // 小地图移至上（右）角显示
  const pcx = G.player.x / TILE, pcy = G.player.y / TILE;
  // 背景框
  ctx.fillStyle = 'rgba(8,12,10,0.78)';
  ctx.strokeStyle = 'rgba(140,200,160,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x0, y0, size, size, 6) : ctx.rect(x0, y0, size, size);
  ctx.fill(); ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  const z = MINIMAP_ZOOM;
  // 覆盖范围内的瓦片：遍历世界坐标瓦片，按探索状态绘制
  const cx = x0 + size / 2, cy = y0 + size / 2;
  for (let dy = -MINIMAP_VIEW; dy <= MINIMAP_VIEW; dy++) {
    for (let dx = -MINIMAP_VIEW; dx <= MINIMAP_VIEW; dx++) {
      const tx = Math.floor(pcx) + dx, ty = Math.floor(pcy) + dy;
      if (!tileExplored(tx, ty)) continue;
      const px = cx + (tx - pcx) * z, py = cy + (ty - pcy) * z;
      if (px < x0 - z || py < y0 - z || px > x0 + size || py > y0 + size) continue;
      const t = getTerrain(tx, ty);
      ctx.fillStyle = (t === T_WATER) ? 'rgba(40,90,140,0.9)'
        : (t === T_CONCRETE) ? 'rgba(120,120,126,0.85)'
        : (t === T_REF_CONCRETE) ? 'rgba(165,168,176,0.85)'
        : (t === T_HAZARD) ? 'rgba(190,180,40,0.85)'
        : (t === T_REF_HAZARD) ? 'rgba(200,190,50,0.85)'
        : (t === T_PATH) ? 'rgba(150,140,130,0.85)'
        : (t === T_CLIFF) ? 'rgba(100,96,88,0.9)'
        : (t === T_YUMAKO_SOIL) ? 'rgba(122,90,52,0.9)'
        : (t === T_OVERGROWTH_YUMAKO_SOIL) ? 'rgba(100,70,40,0.9)'
        : (t === T_JELLYNUT_SOIL) ? 'rgba(122,68,88,0.9)'
        : (t === T_OVERGROWTH_JELLYNUT_SOIL) ? 'rgba(100,52,78,0.9)'
        : (t === T_FOUNDATION) ? 'rgba(124,132,144,0.9)'
        : (t === T_ICE_PLATFORM) ? 'rgba(184,212,232,0.9)'
        : 'rgba(52,78,50,0.9)';
      ctx.fillRect(px, py, z + 0.4, z + 0.4);
      // 矿脉标记
      const oi = getOreType(tx, ty);
      if (oi >= 0) {
        const oid = oreItemId(oi);
        const oc = ITEMS[oid] ? ITEMS[oid].color : '#aaa';
        ctx.fillStyle = oc;
        ctx.fillRect(px + z * 0.25, py + z * 0.25, z * 0.5, z * 0.5);
      }
    }
  }
  // 地图标记：在小地图上绘制已探索范围内的标记
  if (typeof drawMapTagsMinimap === 'function') drawMapTagsMinimap(ctx, cx, cy, z, pcx, pcy, x0, y0, size);
  // 污染系统：在小地图叠加污染范围（红褐色），需在 clip() 内绘制，确保污染显示范围不超出小地图边界
  if (typeof drawPollutionMinimap === 'function') {
    drawPollutionMinimap(ctx, cx + (G.spawn ? G.spawn.x - pcx : 0) * z, cy + (G.spawn ? G.spawn.y - pcy : 0) * z, z);
  }
  ctx.restore();
  // 边框（覆盖 clip 外缘）
  ctx.strokeStyle = 'rgba(140,200,160,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y0, size, size);
  // 玩家位置亮点
  const ppx = x0 + size / 2, ppy = y0 + size / 2;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(ppx, ppy, 2.6, 0, 7);
  ctx.fill();
  ctx.strokeStyle = '#ffd23c';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // 标题
  ctx.fillStyle = 'rgba(200,230,210,0.8)';
  ctx.font = '10px system-ui';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('🗺 ' + Math.round(pcx) + ',' + Math.round(pcy), x0 + 6, y0 + 5);
}

// ===== 设备信息面板（小地图下方长条） =====
// 鼠标悬停到设备上时，在小地图正下方绘制一个长条面板，展示该设备的具体信息：
// 名称、类别/描述、运行状态、制造/开采速度、污染、生产输出、存储、生命值、电力消耗与供电。
// 与《异星工厂》选中山体/建筑的"详情条"风格对齐，数据全部来自 GAME_DATA 单源。
function drawDeviceInfoBar(ctx) {
  // 仅在小地图开启时展示（面板锚定在小地图正下方）
  if (!(G.settings && G.settings.minimap !== false)) return;
  const hovered = G.cursorTile ? entAt(G.cursorTile.tx, G.cursorTile.ty) : null;
  if (!hovered || hovered._dead || !hovered.type) return;
  const e = hovered;
  const it = ITEMS[e.type];
  if (!it) return;

  // ---- 收集面板数据 ----
  const name = it.name || e.type;
  const desc = it.desc || '';
  const hp = (e.hp !== undefined && e.maxhp) ? Math.max(0, Math.round(e.hp)) : null;
  const maxhp = e.maxhp || null;

  // 状态：优先复用各设备面板的 tip 文案（DEVICE_PANEL[type].tip）
  let status = '';
  const panel = DEVICE_PANEL[e.type];
  if (panel && panel.tip) { const t = panel.tip(e); if (t) status = t; }
  if (!status) status = runningStateText(e);

  // 制造/开采速度（来自官方 GAME_DATA.deviceStats，单源）
  let speed = '';
  const ds = GAME_DATA.deviceStats && GAME_DATA.deviceStats[e.type];
  if (ds) {
    if (ds.craftingSpeed) speed = '制造速度 ' + ds.craftingSpeed;
    else if (ds.miningSpeed) speed = '开采速度 ' + ds.miningSpeed;
    else if (ds.beltSpeed) speed = '带速 ' + ds.beltSpeed;
  }

  // 电力：当前耗电 + 最大能耗 + 供电饱和度
  const pow = devicePowerInfo(e);

  // 污染：官方/项目污染源速率（/m）
  let poll = '';
  if (typeof POLLUTION_SOURCES === 'object' && POLLUTION_SOURCES[e.type]) {
    poll = POLLUTION_SOURCES[e.type] + '/m';
  }

  // 输出（生产成品）与输入/存储
  let output = '';
  if (e.outp && Object.keys(e.outp).length) {
    const first = Object.keys(e.outp)[0];
    output = (ITEMS[first] ? ITEMS[first].name : first) + ' ×' + e.outp[first];
  } else output = '0';
  let storage = '';
  if (e.inp && Object.keys(e.inp).length) {
    storage = Object.keys(e.inp).map(k => (ITEMS[k] ? ITEMS[k].name : k) + '×' + e.inp[k]).join('、');
  }

  // ---- 布局 ----
  const bw = MINIMAP_SIZE + 16;          // 面板宽度略宽于小地图，容纳更多信息
  const bx = W - MINIMAP_SIZE - 8;       // 左缘略超小地图，右缘对齐画布右边缘
  const top = MINIMAP_SIZE + 6;          // 小地图正下方，留 6px 间距
  const pad = 8, lh = 15;
  // 估算行高：标题行 + 描述 + 分隔线 + 若干信息行
  let lines = [];
  if (name) lines.push({ label: '名称', value: name, bold: true });
  if (desc) lines.push({ label: '类别', value: desc });
  if (status) lines.push({ label: '状态', value: status });
  if (speed) lines.push({ label: '速度', value: speed });
  if (output !== null) lines.push({ label: '生产', value: output });
  if (storage) lines.push({ label: '存储', value: storage });
  if (poll) lines.push({ label: '污染', value: poll });
  if (pow) lines.push({ label: '电力', value: pow.text });
  if (hp !== null && maxhp) lines.push({ label: '生命值', value: hp + '/' + maxhp });

  const supH = (pow && pow.max > 0) ? 16 : 0;      // 供电进度条区块高度（条+百分比文字）
  const bh = pad + lines.length * lh + 6 + supH;
  const y0 = top;

  // ---- 绘制背景 ----
  ctx.fillStyle = 'rgba(8,12,10,0.82)';
  ctx.strokeStyle = 'rgba(140,200,160,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(bx, y0, bw, bh, 6) : ctx.rect(bx, y0, bw, bh);
  ctx.fill(); ctx.stroke();

  // ---- 信息行 ----
  ctx.textBaseline = 'top';
  let y = y0 + pad;
  for (const ln of lines) {
    // 标签
    ctx.font = '10px system-ui';
    ctx.fillStyle = 'rgba(160,190,175,0.85)';
    ctx.textAlign = 'left';
    ctx.fillText(ln.label + '：', bx + pad, y);
    // 值
    ctx.font = (ln.bold ? 'bold ' : '') + '10px system-ui';
    ctx.fillStyle = ln.color || 'rgba(225,235,228,0.95)';
    const vx = bx + pad + 42;
    const vw = bw - pad * 2 - 42;
    const txt = (ln.value.length > 16) ? ln.value.slice(0, 15) + '…' : ln.value;
    ctx.fillText(txt, vx, y);
    y += lh;
  }

  // ---- 供电进度条（若有电设备） ----
  if (pow && pow.max > 0) {
    const px0 = bx + pad, pw = bw - pad * 2, py = y + 4;
    const sat = Math.max(0, Math.min(1, pow.sat));
    const col = sat >= 1 ? '#7dd87d' : (sat > 0 ? '#ffd23c' : '#ff5b5b');
    // 条背景
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.fillRect(px0, py, pw, 6);
    // 条填充
    ctx.fillStyle = col;
    ctx.fillRect(px0, py, pw * sat, 6);
    ctx.strokeStyle = 'rgba(200,230,210,0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(px0, py, pw, 6);
    // 百分比文字（条下方）
    ctx.font = '9px system-ui';
    ctx.fillStyle = col;
    ctx.textAlign = 'right';
    ctx.fillText('供电 ' + Math.round(sat * 100) + '%', bx + bw - pad, py + 7);
  }
}

// 供电信息（复用 power.js 口径）：返回 { max, sat, text } 或 null
function devicePowerInfo(e) {
  const demand = (typeof e.powerDemand === 'function') ? (e.powerDemand() || 0) : 0;
  const base = POWER_USE[e.type] || (GAME_DATA.powerUse && GAME_DATA.powerUse[e.type]) || 0;
  const max = base || demand;
  const sat = (G.power && typeof G.power.sat === 'number') ? G.power.sat : 1;
  if (max <= 0 && demand <= 0) return null;   // 纯无电设备（如热能设备）不显示电力
  const text = (demand > 0 ? '耗电 ' + demand.toFixed(1) + ' kW · 最大 ' + max.toFixed(0) + ' kW'
               : '最大能耗 ' + max.toFixed(0) + ' kW');
  return { max, sat, text };
}

// 设备运行状态兜底文案
function runningStateText(e) {
  if (e.crafting === true) return '生产中';
  if (e.working === true) return '运行中';
  if (e.recipe && !e.crafting) return '已暂停';
  if (e.powerDemand && typeof e.powerDemand === 'function' && e.powerDemand() > 0 && G.power && G.power.sat <= 0) return '缺电停摆';
  return '待机';
}
