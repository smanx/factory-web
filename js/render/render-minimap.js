'use strict';

// ===== 小地图（Minimap） =====
// 位于画布右下角的缩略地图：只绘制已探索区块的地形与矿脉，玩家位置用亮点标出。
// 数据来源于 G.world.explored（区块级），瓦片级颜色直接查询确定性地形生成，避免额外存储。
const MINIMAP_SIZE = 168;           // 小地图边长（px）
const MINIMAP_ZOOM = 2.2;           // 每瓦片像素（越大多看得越细，但覆盖范围变小）
const MINIMAP_VIEW = Math.ceil(MINIMAP_SIZE / MINIMAP_ZOOM / 2); // 半边长覆盖瓦片数

// 小地图背景缓存（渲染优化）：地形/矿点是静态的，不需要每帧重绘。
// 原实现每帧对 79×79=6241 个瓦片做逐格 getTerrain + 十二分支字符串配色 + fillRect + getOreType，
// 在缩放 0.5 全景时是 render() 的大头之一。
// 改为：把地形+矿点画进一块离屏画布，仅在“玩家换格 / 首次 / 距上次≥500ms”时重建一次，
// 其余帧直接用 drawImage 整图贴上（克还是动态的污染/标签/玩家点仍逐帧叠加）。
let _mmCache = null;                // 离屏背景画布（按 DPR 分辨率）
let _mmLastKey = '';                // 上次绘制时玩家所在瓦片（用于换格重绘）
let _mmNextPaint = 0;               // 下一次允许重建的时间戳（节流）
let _mmDirty = true;                // 主动强制重建标记

// 确保离屏背景画布存在且与当前 DPR 匹配（显示缩放变化时需重建）。
function _mmEnsure() {
  const dpr = window.devicePixelRatio || 1;
  if (!_mmCache) {
    _mmCache = document.createElement('canvas');
    _mmCache.width = Math.round(MINIMAP_SIZE * dpr);
    _mmCache.height = Math.round(MINIMAP_SIZE * dpr);
    _mmCache._dpr = dpr;
  } else if (_mmCache._dpr !== dpr) {
    _mmCache.width = Math.round(MINIMAP_SIZE * dpr);
    _mmCache.height = Math.round(MINIMAP_SIZE * dpr);
    _mmCache._dpr = dpr;
    _mmDirty = true;
  }
  return _mmCache;
}

// 把当前玩家视口内的地形+矿点一次性画进离屏背景画布（逻辑与旧 drawMinimap 的瓦片循环一致）。
function _paintMinimapBg(pcx, pcy) {
  const c = _mmEnsure();
  const cctx = c.getContext('2d');
  const dpr = c._dpr;
  cctx.save();
  cctx.scale(dpr, dpr);
  cctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
  const size = MINIMAP_SIZE, z = MINIMAP_ZOOM;
  const cx = size / 2, cy = size / 2;
  for (let dy = -MINIMAP_VIEW; dy <= MINIMAP_VIEW; dy++) {
    for (let dx = -MINIMAP_VIEW; dx <= MINIMAP_VIEW; dx++) {
      const tx = Math.floor(pcx) + dx, ty = Math.floor(pcy) + dy;
      if (!tileExplored(tx, ty)) continue;
      const px = cx + (tx - pcx) * z, py = cy + (ty - pcy) * z;
      if (px < -z || py < -z || px > size + z || py > size + z) continue;
      const t = getTerrain(tx, ty);
      cctx.fillStyle = (t === T_WATER) ? 'rgba(40,90,140,0.9)'
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
        : (t === T_SPACE_PLATFORM) ? 'rgba(110,112,120,0.9)'
        : 'rgba(104,108,60,0.9)';   // 草+土混合观感（与主地形露土风格一致）
      cctx.fillRect(px, py, z + 0.4, z + 0.4);
      // 矿脉标记
      const oi = getOreType(tx, ty);
      if (oi >= 0) {
        const oid = oreItemId(oi);
        const oc = ITEMS[oid] ? ITEMS[oid].color : '#aaa';
        cctx.fillStyle = oc;
        cctx.fillRect(px + z * 0.25, py + z * 0.25, z * 0.5, z * 0.5);
      }
    }
  }
  cctx.restore();
}

function drawMinimap(ctx) {
  const size = MINIMAP_SIZE;
  const pad = 0;
  const x0 = W - size - pad, y0 = pad; // 小地图移至上（右）角显示
  const pcx = G.player.x / TILE, pcy = G.player.y / TILE;
  const z = MINIMAP_ZOOM;
  const cx = x0 + size / 2, cy = y0 + size / 2;
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
  // 背景缓存：仅玩家换格/首次/节流到点才重建 6241 格地形+矿点，其余帧直接贴整图
  const curKey = Math.floor(pcx) + ',' + Math.floor(pcy);
  const now = performance.now();
  if (_mmDirty || curKey !== _mmLastKey || now >= _mmNextPaint) {
    _paintMinimapBg(pcx, pcy);
    _mmLastKey = curKey;
    _mmDirty = false;
    _mmNextPaint = now + 500;   // 节流：最多 500ms 重建一次，兜住雷达扩图/矿量变化
  }
  ctx.drawImage(_mmEnsure(), x0, y0, size, size);
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

// 按像素宽度把文本折行（支持中英文混排）：
// 优先在空格处断行（英文单词），单个超长词（或无空格的中文长句）按字符逐个断行。返回行数组。
function _wrapTooltipText(ctx, text, maxW) {
  const words = String(text).split(/(\s+)/);
  const lines = [];
  let cur = '';
  const flush = (t) => { if (t) lines.push(t); };
  for (const w of words) {
    if (ctx.measureText(cur + w).width <= maxW) { cur += w; continue; }
    flush(cur);
    cur = w;
    // 当前行已满，且剩下一整段仍超宽：按字符拆行
    // 注意：内层 while 找到的是“第一个超宽字符”，必须退回一格，保证每行都不超过 maxW，
    // 否则长文本换行后会比限制宽一个字符、顶到右边框（实测 CJK 差 ~11px）。
    while (ctx.measureText(cur).width > maxW) {
      let i = 1;
      while (i < cur.length && ctx.measureText(cur.slice(0, i)).width <= maxW) i++;
      if (ctx.measureText(cur.slice(0, i)).width > maxW) i--;   // 退回最后一个放得下的字符
      if (i < 1) i = 1;                                          // 单字符也放不下时强制推一个
      lines.push(cur.slice(0, i));
      cur = cur.slice(i);
    }
  }
  flush(cur);
  return lines.length ? lines : [String(text)];
}

// 燃烧器（烧燃料）设备：能量显示“(燃烧器)”而非“(电能)”，对齐官方 tooltip。
const _BURNER_DEVICES = new Set(['burner-mining-drill', 'stone-furnace', 'steel-furnace', 'boiler', 'burner-inserter']);

// ===== 设备信息面板（小地图下方长条） =====
// 鼠标悬停到设备上时，在小地图正下方绘制详情面板。
// 宽度与小地图完全一致并紧贴其下方/屏幕边缘；内容与排版对齐《异星工厂》官方 tooltip：
// 金色名称标题 + 物品图标 + 描述 + 分隔线 + 官方字段行
// （采矿速度/制造速度/研究速度/运载速度/存储容量/消耗量/污染/插件槽位/生命值），
// 字段标签取自官方 core.cfg [description]，数值全部来自 GAME_DATA 单源。
// 文本超宽时自动换行（标题/描述/字段值均可折行），不做省略号截断。
function drawDeviceInfoBar(ctx) {
  // 仅在小地图开启时展示（面板锚定在小地图正下方）
  if (!(G.settings && G.settings.minimap !== false)) return;
  const hovered = G.cursorTile ? entAt(G.cursorTile.tx, G.cursorTile.ty) : null;
  if (!hovered || hovered._dead || !hovered.type) return;
  const e = hovered;
  const it = ITEMS[e.type];
  if (!it) return;

  const name = localizedName(e.type, it.name || e.type);
  const desc = it.desc || '';
  const ds = GAME_DATA.deviceStats && GAME_DATA.deviceStats[e.type];

  // ---- 收集官方字段（GAME_DATA 单源；标签对齐官方 core.cfg [description]）----
  // 顺序对齐官方 tooltip：速度类 → 存储容量 → 能量 → 污染 → 插件槽位 → 生命值。
  const lines = [];
  const add = (label, value) => lines.push({ label, value });

  // 速度类（官方 制造速度/采矿速度/研究速度/运载速度）
  if (ds && ds.miningSpeed) add('采矿速度', String(ds.miningSpeed));
  if (ds && ds.craftingSpeed) add('制造速度', String(ds.craftingSpeed));
  if (ds && ds.researchingSpeed) add('研究速度', String(ds.researchingSpeed));
  if (ds && ds.beltSpeed) add('运载速度', Math.round(ds.beltSpeed * 8) + ' 个/秒'); // 官方 15 个/秒 = 1.875 格/秒 × 8

  // 存储容量（管道/地下管道/储液罐/流体车厢；官方 core.cfg fluid-capacity=存储容量）
  const fcap = GAME_DATA.fluidCapacity;
  if (fcap) {
    const cap = (e.type === 'storage-tank') ? fcap.storageTank
      : (e.type === 'pipe') ? fcap.pipeVolume
      : (e.type === 'pipe-to-ground') ? fcap.pipeToGroundVolume
      : (e.type === 'fluid-wagon') ? fcap.fluidWagon
      : null;
    if (cap) add('存储容量', String(cap));
  }

  // 消耗量（官方 core.cfg energy-consumption=消耗量；燃烧器设备显示“(燃烧器)”，其余“(电能)”）
  const pw = GAME_DATA.powerUse && GAME_DATA.powerUse[e.type];
  if (pw) add('消耗量', pw + ' kW（' + (_BURNER_DEVICES.has(e.type) ? '燃烧器' : '电能') + '）');

  // 污染
  const poll = GAME_DATA.pollution && GAME_DATA.pollution[e.type];
  if (poll) add('污染', poll + ' / 分钟');

  // 插件槽位
  if (ds && ds.moduleSlots) add('插件槽位', String(ds.moduleSlots));

  // 生命值（官方 tooltip 中位于最末；受损时显示当前/最大）
  const hp = GAME_DATA.buildingHp && GAME_DATA.buildingHp[e.type];
  if (hp) {
    const cur = (e.hp !== undefined && e.maxhp) ? Math.min(hp, Math.max(0, Math.round(e.hp))) : hp;
    add('生命值', cur >= hp ? String(hp) : cur + '/' + hp);
  }

  // ---- 布局：宽度与小地图一致，紧贴其下方、紧贴屏幕右边缘 ----
  const bw = MINIMAP_SIZE;               // 宽度与小地图完全一致
  const bx = W - MINIMAP_SIZE;           // 右缘贴屏幕右边缘（与小地图右缘对齐）
  const top = MINIMAP_SIZE;              // 顶缘紧贴小地图底边（无间距）
  const pad = 9;                         // 左侧内边距
  const padR = 14;                       // 右侧内边距（文本不贴右边框）
  const iconW = it.emoji ? 19 : 0;       // 物品图标占宽
  const innerW = bw - pad - padR;        // 内容区宽

  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  // 标题：名称折行（短名称单行不变）
  ctx.font = 'bold 12.5px system-ui';
  const titleLines = _wrapTooltipText(ctx, name, innerW - iconW);

  // 描述：折行显示
  ctx.font = '10.5px system-ui';
  const descLines = desc ? _wrapTooltipText(ctx, desc, innerW - iconW) : [];

  // 字段行：标签灰 + 值白；值超宽则换行（续行缩进到数值列），列宽过窄时标签独占一行
  const rows = [];
  for (const f of lines) {
    const labelFull = f.label + '：';
    const labelW = ctx.measureText(labelFull).width;
    const vx = bx + pad + labelW + 6;
    const valueMaxW = (bx + bw - padR) - vx;
    if (valueMaxW < 24) {
      rows.push({ label: labelFull, value: null, vx });
      for (const vl of _wrapTooltipText(ctx, f.value, innerW)) rows.push({ label: null, value: vl, vx: bx + pad });
    } else {
      const vLines = _wrapTooltipText(ctx, f.value, valueMaxW);
      rows.push({ label: labelFull, value: vLines[0], vx });
      for (let i = 1; i < vLines.length; i++) rows.push({ label: null, value: vLines[i], vx });
    }
  }

  // ---- 高度：由折行后的行数累加 ----
  const titleLh = 16;                    // 标题行高
  const descLh = 13;                     // 描述行高
  const fieldLh = 14;                    // 字段行高
  const sepBefore = 3;                   // 描述→分隔线间距
  const sepAfter = 5;                    // 分隔线→字段间距
  const padTop = 8, padBottom = 8;
  const bh = padTop + titleLines.length * titleLh
    + descLines.length * descLh
    + sepBefore + 1 + sepAfter
    + rows.length * fieldLh
    + padBottom;

  // ---- 背景（官方 tooltip 深色半透明底 + 细边框）----
  ctx.fillStyle = 'rgba(15,16,14,0.92)';
  ctx.strokeStyle = 'rgba(150,150,140,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(bx, top, bw, bh, 4) : ctx.rect(bx, top, bw, bh);
  ctx.fill(); ctx.stroke();

  // ---- 标题（名称，金色粗体，前接物品图标，对齐官方 tooltip 图标+名称）----
  let y = top + padTop;
  let nx = bx + pad;
  if (it.emoji) { ctx.font = '13px system-ui'; ctx.fillText(it.emoji, nx, y); nx += iconW; ctx.font = 'bold 12.5px system-ui'; }
  ctx.fillStyle = '#ffd43b';
  for (const tl of titleLines) { ctx.fillText(tl, nx, y); y += titleLh; }

  // ---- 描述（浅色正文，超宽换行）----
  if (descLines.length) {
    ctx.font = '10.5px system-ui';
    ctx.fillStyle = 'rgba(226,228,222,0.9)';
    for (const dl of descLines) { ctx.fillText(dl, bx + pad + iconW, y); y += descLh; }
  }

  // ---- 分隔线 ----
  y += sepBefore;
  ctx.strokeStyle = 'rgba(200,200,190,0.18)';
  ctx.beginPath();
  ctx.moveTo(bx + pad, y);
  ctx.lineTo(bx + bw - padR, y);
  ctx.stroke();
  y += 1 + sepAfter;

  // ---- 官方字段行（标签灰 + 值白，值超宽换行）----
  ctx.font = '10.5px system-ui';
  for (const r of rows) {
    if (r.label) { ctx.fillStyle = 'rgba(160,164,155,0.85)'; ctx.fillText(r.label, bx + pad, y); }
    if (r.value) { ctx.fillStyle = 'rgba(240,242,236,0.95)'; ctx.fillText(r.value, r.vx, y); }
    y += fieldLh;
  }
}
