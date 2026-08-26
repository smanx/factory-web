'use strict';

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + d * t;
}

// ===== 实体绘制分发 =====
// 各设备的绘制函数与状态灯颜色在 js/devices/*.js 里注册到 DEVICE_RENDER/DEVICE_STATUS。
function drawStatusDot(ctx, x, y, c) {
  const col = { g: '#57e389', y: '#ffd23c', r: '#ff5b5b' }[c] || '#888';
  ctx.fillStyle = '#14161a';
  ctx.beginPath();
  ctx.arc(x, y, 5.4, 0, 7);
  ctx.fill();
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(x, y, 3.9, 0, 7);
  ctx.fill();
}

// 画面优化：实体建筑软阴影——在建筑脚下绘制柔和椭圆投影，增强立体感与工业氛围
// 仅在离屏缓存首次渲染时生成（不破坏分块缓存复用），低开销
function drawEntityShadow(ctx, e, gx, gy) {
  const w = e.w * TILE, h = e.h * TILE;
  const px = gx * TILE, py = gy * TILE;
  ctx.save();
  ctx.globalAlpha = 0.16;
  ctx.fillStyle = '#000';
  // 沿底边绘制椭圆投影
  ctx.beginPath();
  ctx.ellipse(px + w / 2, py + h - TILE * 0.28, w * 0.42, TILE * 0.3, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawEntity(ctx, e, gx, gy, dir, alpha) {
  const fn = DEVICE_RENDER[e.type];
  if (fn) {
    // 画面优化：实体建筑软阴影（仅实际建筑、非幽灵/低LOD，增强立体感）
    if (alpha === 1 && !LOD.simple && BUILD_DEFS[e.type] && BUILD_DEFS[e.type].solid) {
      drawEntityShadow(ctx, e, gx, gy);
    }
    fn(ctx, e, gx, gy, dir, alpha);
  }
  // 建筑受损：绘制耐久条与裂纹（对齐《异星工厂》建筑受击表现）
  if (alpha === 1 && e.maxhp > 0 && e.hp !== undefined && e.hp < e.maxhp) {
    const px = gx * TILE, py = gy * TILE, w = e.w * TILE, h = e.h * TILE;
    // 裂纹随受损程度加深
    const ratio = e.hp / e.maxhp;
    if (ratio < 0.5) {
      ctx.strokeStyle = 'rgba(20,20,20,.55)';
      ctx.lineWidth = Math.max(1, 12 * (1 - ratio));
      ctx.beginPath();
      ctx.moveTo(px + w * 0.25, py + h * 0.2); ctx.lineTo(px + w * 0.5, py + h * 0.5);
      ctx.lineTo(px + w * 0.35, py + h * 0.85);
      ctx.stroke();
    }
    // 顶部耐久条（HP 低时更醒目）
    if (ratio < 0.75) {
      const barW = Math.min(w, TILE * 2.4), barH = 3;
      const bx = gx * TILE + (w - barW) / 2, by = py - 4;
      ctx.fillStyle = 'rgba(10,10,12,.6)';
      ctx.fillRect(bx - 1, by - 1, barW + 2, barH + 2);
      ctx.fillStyle = ratio > 0.5 ? '#7ec850' : (ratio > 0.25 ? '#e0b23c' : '#e04a3a');
      ctx.fillRect(bx, by, barW * ratio, barH);
    }
  }
  // 低 LOD 时跳过状态灯（像素太小看不清，省一次 path+fill）
  // 传送带分流器、地下传送带与水管本身已用图形直观表达工作状态，不再叠加状态小点
  if (alpha === 1 && !LOD.simple && !NO_STATUS_DOT[e.type]) {
    const sf = DEVICE_STATUS[e.type];
    const c = sf ? sf(e) : null;
    if (c) drawStatusDot(ctx, (gx + e.w) * TILE - 8, gy * TILE + 8, c);
  }
}

// 不显示运行状态小点的设备：各类传送带、传送带分流器、地下传送带、水管（状态由图形本身表达）
const NO_STATUS_DOT = {
  // 各类传送带（含创造/虚空传送带）不显示右上角状态小点
  'transport-belt': true, 'fast-transport-belt': true, 'express-transport-belt': true,
  'creative-belt': true, 'void-belt': true,
  // 传送带分流器
  'splitter': true, 'fast-splitter': true, 'express-splitter': true,
  // 地下传送带
  'underground': true, 'fast-underground-belt': true, 'express-underground-belt': true,
  // 水管
  'pipe': true, 'pipe-to-ground': true,
  // 其他流体管路（核电传热管、创造/虚空管道）同样不显示状态小点
  'heat-pipe': true, 'creative-pipe': true, 'void-pipe': true,
  // 机械臂（电力/加长/高速/集装箱/热能）运行状态由臂体与动画直观表达，不显示状态小点
  'inserter': true, 'long-inserter': true, 'stack-inserter': true, 'fast-inserter': true,
  'burner-inserter': true,
};

// 机械臂类型集合：绘制时置顶，永远显示在传送带/其他设备之上，不被遮挡。
const IS_INSERTER = { inserter: true, 'long-inserter': true, 'stack-inserter': true, 'fast-inserter': true };

const ghostCache = { type: null, ent: null };

// ===== ALT 模式（对齐《异星工厂》ALT 模式）=====
// 在建筑上叠加显示当前配方/内容标签，方便玩家快速总览产线：
//  - 组装机/炼油厂/化工厂/离心机/火箭井：当前配方产出物
//  - 研究中心：当前研究科技
//  - 各类箱/货运车厢/载具储物箱：箱内主要物品
//  - 带过滤的机械臂：过滤物品
//  - 机枪炮塔/炮兵：弹药数量
// 缓存复用：只对配方/内容发生变化的建筑重算标签（key 直接挂实体上），避免每帧字符串拼接。
function _altLabelKey(e) {
  const t = e.type;
  if (e.recipe) return 'r:' + e.recipe;
  if (t === 'train-stop') {
    // 车站：以站名 + 装卸清单为指纹（对齐《异星工厂》ALT 模式显示车站装卸内容）
    return 'st:' + (e.name || '') + ':' + (e.load || []).join(',') + ':' + (e.unload || []).join(',');
  }
  if (t === 'lab') return 'lab:' + (G.activeTech || '');
  if (t === 'rocket-silo') {
    const inp = e.inp || {};
    return 'rs:' + (e.parts || 0) + ':' + (inp.satellite || 0) + ':' + (e.launching ? 1 : 0);
  }
  if (t === 'gun-turret' || t === 'artillery-turret') {
    // 避免 JSON.stringify 每帧分配；用弹药类型数+总数做轻量指纹
    let n = 0, types = 0;
    if (e.ammo) { for (const k in e.ammo) if (e.ammo[k] > 0) { n += e.ammo[k]; types++; } }
    if (t === 'artillery-turret') n = (e.shells || 0);
    return 'ammo:' + n + ':' + types;
  }
  if (e.slots) {
    // 箱/车厢内容标签：拼接每槽物品+数量
    let k = 'sl:';
    for (const s of e.slots) if (s) k += s.item + ':' + s.count + ';';
    return k;
  }
  if (t === 'car' || t === 'tank' || t === 'spidertron') {
    const tr = e.trunk || {};
    let k = 'tr:';
    for (const id in tr) if (tr[id] > 0) k += id + ':' + tr[id] + ';';
    return k;
  }
  if (e.filter) return 'f:' + e.filter;
  return '';
}
// ALT 模式（图标版）：把建筑当前配方/内容映射为一组物品图标（配方的产出物 / 材料 / 物品），
// 供 drawAltMode 在建筑顶部叠加绘制图标，取代原来的文本标签（需求：切换详情只显示图标）。
function _altLabelIcons(e) {
  const t = e.type;
  // 带配方机器：配方产出物图标
  if (e.recipe) {
    const rec = RECIPES[e.recipe] || REFINERY_RECIPES[e.recipe] || CENTRIFUGE_RECIPES[e.recipe];
    if (!rec) return [];
    const outs = Object.keys(rec.out || rec.prob || {});
    return outs.slice(0, 3);
  }
  if (t === 'train-stop') {
    // 车站：装卸物品图标（去重）
    const ids = [];
    const push = arr => { for (const id of arr) if (ITEMS[id] && ids.indexOf(id) < 0) ids.push(id); };
    if ((e.load || []).length) push(e.load);
    if ((e.unload || []).length) push(e.unload);
    return ids.slice(0, 3);
  }
  if (t === 'lab') {
    // 实验室：当前研究科技消耗的科研瓶图标（材料图标）
    if (!G.activeTech || !TECHS[G.activeTech]) return [];
    const ids = Object.keys(TECHS[G.activeTech].cost || {});
    return ids.slice(0, 3);
  }
  if (t === 'rocket-silo') {
    const inp = e.inp || {};
    const ids = [];
    if ((inp.satellite || 0) > 0) ids.push('satellite');
    if ((e.parts || 0) > 0) ids.push('rocket-part');
    return ids;
  }
  if (t === 'gun-turret') {
    const ids = [];
    if (e.ammo) for (const k in e.ammo) if (e.ammo[k] > 0 && ITEMS[k] && ids.indexOf(k) < 0) ids.push(k);
    return ids.slice(0, 3);
  }
  if (t === 'artillery-turret') {
    return (e.shells || 0) > 0 ? ['artillery-shell'] : [];
  }
  if (e.slots) {
    // 箱/车厢：箱内主要物品图标（最多 3 种）
    const ids = [];
    for (const s of e.slots) if (s && s.item && ids.indexOf(s.item) < 0) ids.push(s.item);
    return ids.slice(0, 3);
  }
  if (t === 'car' || t === 'tank' || t === 'spidertron') {
    const tr = e.trunk || {};
    const ids = [];
    for (const id in tr) if (tr[id] > 0 && ids.indexOf(id) < 0) ids.push(id);
    return ids.slice(0, 3);
  }
  if (e.filter && ITEMS[e.filter]) return [e.filter];
  return [];
}
function drawAltMode(ctx, keys, seenBuf) {
  // ALT 模式改为在建筑顶部叠加一排物品图标（配方产出物 / 材料 / 物品），不再显示文本标签。
  const iconSize = Math.max(9, 12 * G.cam.z);
  const gap = Math.max(2, iconSize * 0.25);
  const pad = 3;
  const iter = e => {
    if (e._dead || !onScreen(e)) return;
    // 缓存复用：把上次计算的 key/icons 直接挂在实体上，只有 key 变化才重算 icons，
    // 避免每帧为稳定内容重复查表（ALT 模式高频路径优化）。
    const key = _altLabelKey(e);
    if (!key) { if (e._altKey) { e._altKey = ''; e._altIcons = null; } return; }
    let icons;
    if (e._altKey === key) {
      icons = e._altIcons;
    } else {
      icons = _altLabelIcons(e);
      e._altKey = key;
      e._altIcons = icons;
    }
    if (!icons || !icons.length) return;
    // 图标排绘制在建筑顶部中央
    const n = icons.length;
    const bw = n * iconSize + (n - 1) * gap + pad * 2;
    const bh = iconSize + pad * 2;
    const px = (e.x + e.w / 2) * TILE;
    const py = e.y * TILE - 2;
    const x0 = px - bw / 2;
    const y0 = py - bh;
    ctx.save();
    ctx.globalAlpha = 0.85;
    ctx.fillStyle = 'rgba(8,10,14,0.78)';
    ctx.fillRect(x0, y0, bw, bh);
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 + 0.5, y0 + 0.5, bw - 1, bh - 1);
    ctx.globalAlpha = 1;
    for (let i = 0; i < n; i++) {
      const cx = x0 + pad + iconSize / 2 + i * (iconSize + gap);
      const cy = y0 + pad + iconSize / 2;
      drawItemGlyph(ctx, icons[i], cx, cy, iconSize);
    }
    ctx.restore();
  };
  if (keys) forEachEntInBuckets(keys, iter, seenBuf);
  else for (const e of G.ents) iter(e);
}

function getGhostEnt(type) {
  if (ghostCache.type !== type) {
    ghostCache.type = type;
    ghostCache.ent = new (ENT_CLASSES[type])(type, 0, 0);
  }
  return ghostCache.ent;
}

function drawGhost(ctx) {
  if (!buildActive() || !G.cursorTile || !G.canvasActive) return;
  const type = selItem();
  if (!type) return;
  const def = BUILD_DEFS[type];
  let ew = def.w, eh = def.h;
  if (def.rotSwap && (G.ghostDir % 2 === 1)) { ew = def.h; eh = def.w; }
  // 不允许覆盖建造：目标格已有实体时判定为红色不可放置，与建造行为一致。
  const chk = canPlaceAt(type, G.cursorTile.tx, G.cursorTile.ty, G.ghostDir);
  const tmp = getGhostEnt(type);
  tmp.dir = G.ghostDir;
  tmp.w = ew; tmp.h = eh;
  drawEntity(ctx, tmp, G.cursorTile.tx, G.cursorTile.ty, G.ghostDir, 0.55);
  ctx.fillStyle = chk.ok ? 'rgba(120,220,120,.18)' : 'rgba(230,80,80,.22)';
  ctx.fillRect(G.cursorTile.tx * TILE, G.cursorTile.ty * TILE, ew * TILE, eh * TILE);
  ctx.strokeStyle = chk.ok ? 'rgba(140,255,140,.9)' : 'rgba(255,110,110,.9)';
  ctx.lineWidth = 2 / G.cam.z;
  ctx.strokeRect(G.cursorTile.tx * TILE, G.cursorTile.ty * TILE, ew * TILE, eh * TILE);
}

// 放置校验：默认规则（不能压水/已有实体/超出触及范围）+ 设备自定义规则
// （DEVICE_PLACE[type] 返回 {ok} 则短路，返回 null 则继续默认校验）
// 不允许覆盖建造：目标格已有实体时返回 {ok:false}，由调用方提示。
function canPlaceAt(type, tx, ty, dir) {
  const def = BUILD_DEFS[type];
  let ew = def.w, eh = def.h;
  if (def.rotSwap && (dir % 2 === 1)) { ew = def.h; eh = def.w; }
  const rule = DEVICE_PLACE[type];
  if (rule) {
    const r = rule(type, tx, ty, dir, ew, eh);
    if (r) return r;
  }
  for (let dy = 0; dy < eh; dy++)
    for (let dx = 0; dx < ew; dx++) {
      if (isWater(tx + dx, ty + dy)) return { ok: false };
      // 峭壁阻挡建造（对齐《异星工厂》：峭壁需先用峭壁炸药清除）
      if (getTerrain(tx + dx, ty + dy) === T_CLIFF) return { ok: false };
      // 树木阻挡建造（对齐《异星工厂》：需先砍树清空场地）
      if (getTerrain(tx + dx, ty + dy) === T_TREE) return { ok: false };
      if (entAt(tx + dx, ty + dy)) {
        // 传送带升级/降级覆盖：用带系/地下带/分流器的同类覆盖现有同族带（对齐《异星工厂》覆盖升级）
        // 但反向传送带视为障碍（不参与覆盖），交由自动地下带逻辑跨越处理
        const e = entAt(tx + dx, ty + dy);
        const reversed = e instanceof Belt && Math.abs(((e.dir - dir) % 4 + 4) % 4) === 2;
        if (!reversed && canOverwriteWithBelt(type, e)) continue;
        return { ok: false };
      }
      if (!withinReach(tx + dx, ty + dy)) return { ok: false };
    }
  return { ok: true };
}

// 判断能否用 type 覆盖现有实体 e（仅限同族物流链：传送带/地下带/分流器按各自链条覆盖）
function canOverwriteWithBelt(type, e) {
  if (!e) return false;
  // 1×1 且属于同一条升级链（传送带覆盖传送带、地下带覆盖地下带、分流器覆盖分流器）
  if (!sameTierFamily(type, e.type)) return false;
  return true;
}

function drawHoverAndMining(ctx) {
  if (!G.cursorTile) return;
  const { tx, ty } = G.cursorTile;
  const e = entAt(tx, ty);
  // 拆除模式：红色高亮光标所在建筑，提示将被拆除（替代手机端无法使用的右键）
  if (G.deconstructMode) {
    if (e && withinReach(tx, ty)) {
      ctx.fillStyle = 'rgba(230,60,60,.22)';
      ctx.fillRect(e.x * TILE, e.y * TILE, e.w * TILE, e.h * TILE);
      ctx.strokeStyle = 'rgba(255,90,90,.95)';
      ctx.lineWidth = 2.5 / G.cam.z;
      ctx.strokeRect(e.x * TILE + 1, e.y * TILE + 1, e.w * TILE - 2, e.h * TILE - 2);
      // 画红色叉
      const cx = e.x * TILE + e.w * TILE / 2, cy = e.y * TILE + e.h * TILE / 2;
      const r = Math.min(e.w * TILE, e.h * TILE) * 0.28;
      ctx.beginPath();
      ctx.moveTo(cx - r, cy - r); ctx.lineTo(cx + r, cy + r);
      ctx.moveTo(cx + r, cy - r); ctx.lineTo(cx - r, cy + r);
      ctx.stroke();
    } else if (withinReach(tx, ty)) {
      // 空白格：淡红提示拆除模式已开启
      ctx.fillStyle = 'rgba(230,60,60,.12)';
      ctx.fillRect(tx * TILE, ty * TILE, TILE, TILE);
      ctx.strokeStyle = 'rgba(255,90,90,.7)';
      ctx.lineWidth = 1.5 / G.cam.z;
      ctx.strokeRect(tx * TILE + 1, ty * TILE + 1, TILE - 2, TILE - 2);
    }
    return;
  }
  if (e && withinReach(tx, ty)) {
    ctx.strokeStyle = 'rgba(255,255,255,.8)';
    ctx.lineWidth = 2 / G.cam.z;
    ctx.strokeRect(e.x * TILE + 1, e.y * TILE + 1, e.w * TILE - 2, e.h * TILE - 2);
  }
  const p = G.player;
  if (p.mining) {
    const [mx, my] = p.mining.split(',').map(Number);
    const ti = getOreType(mx, my);
    if ((ti >= 0 && ti < ORES.length) || ti === ORE_URANIUM) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(mx * TILE + TILE / 2, my * TILE + TILE / 2, 12, -Math.PI / 2, -Math.PI / 2 + p.mineProg * Math.PI * 2);
      ctx.stroke();
    }
  }
}

function drawEnemies(ctx) {
  if (!G.enemies) return;
  for (const en of G.enemies) {
    if (en.dead) continue;
    const bob = Math.sin(G.time * 8 + en.x) * 1.2;
    const size = en.size || 8;
    const maxhp = en.maxhp || 40;
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath();
    ctx.ellipse(en.x, en.y + 10, size * 1.2, size * 0.5, 0, 0, 7);
    ctx.fill();
    // 不同敌人不同形状：蠕虫为细长条形，其余为圆
    const color = en.color || enemyColor(en.hp, 40);
    ctx.fillStyle = color;
    ctx.strokeStyle = '#7c1a12';
    ctx.lineWidth = 2;
    if (en.kind === 'spawner') {
      // 巢穴：带呼吸的肉质圆形虫巢；污染高时被激怒（变红、脉动加快、泛光）
      const aggrod = (typeof pollutionAggroFactor === 'function') ? pollutionAggroFactor() : 0;
      const pulse = 1 + Math.sin(G.time * (2 + aggrod * 4) + en.x) * (0.06 + aggrod * 0.12);
      const baseCol = aggrod > 0.6 ? '#8a2a1a' : (aggrod > 0.2 ? '#7a2a2a' : '#5a3a8a');
      ctx.fillStyle = baseCol;
      ctx.beginPath(); ctx.arc(en.x, en.y, size * pulse, 0, 7); ctx.fill(); ctx.stroke();
      // 污染激怒时巢穴整体泛红
      if (aggrod > 0.1) {
        ctx.fillStyle = 'rgba(255,80,40,' + (0.18 * aggrod).toFixed(3) + ')';
        ctx.beginPath(); ctx.arc(en.x, en.y, size * (pulse + 1.2), 0, 7); ctx.fill();
      }
      ctx.fillStyle = aggrod > 0.6 ? '#5a1010' : '#3a225a';
      ctx.beginPath(); ctx.arc(en.x, en.y, size * 0.5, 0, 7); ctx.fill();
      ctx.fillStyle = aggrod > 0.6 ? '#e06040' : '#8a5ac0';
      ctx.beginPath(); ctx.arc(en.x, en.y, size * 0.3, 0, 7); ctx.fill();
      ctx.fillStyle = '#ffd0a0';
      for (let i = 0; i < 4; i++) {
        const a = i * Math.PI / 2 + G.time * 0.5;
        ctx.beginPath(); ctx.arc(en.x + Math.cos(a) * size * 0.7, en.y + Math.sin(a) * size * 0.7, 2, 0, 7); ctx.fill();
      }
    } else if (en.type === 'worm' || en.type === 'big-worm' || en.type === 'behemoth-worm') {
      ctx.beginPath();
      ctx.ellipse(en.x, en.y + bob, size, size * 0.5, 0, 0, 7);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#3a2a22';
      ctx.beginPath(); ctx.arc(en.x, en.y + bob - 4, 3, 0, 7); ctx.fill();
    } else if (en.kind === 'ranged') {
      ctx.beginPath();
      ctx.arc(en.x, en.y + bob, size, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#ffe0a0';
      ctx.beginPath(); ctx.arc(en.x, en.y + bob - 3, 2, 0, 7); ctx.fill();
    } else {
      // 近战敌人：扑咬动画——攻击帧（lungeT>0）时朝玩家方向前扑并张开血盆大口
      const a = Math.atan2(G.player.y - en.y, G.player.x - en.x);
      const lunge = (en.lungeT || 0) > 0 ? Math.min(1, (en.lungeT || 0) / 0.28) : 0;
      const bx = en.x + Math.cos(a) * lunge * 7;   // 前扑位移
      const by = en.y + bob + Math.sin(a) * lunge * 7;
      // 扑咬时身体略微前倾放大
      const biteScale = 1 + lunge * 0.12;
      ctx.save();
      ctx.translate(bx, by);
      ctx.scale(biteScale, biteScale);
      ctx.beginPath();
      ctx.arc(0, 0, size, 0, 7); ctx.fill(); ctx.stroke();
      // 眼睛朝玩家
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * size * 0.4, Math.sin(a) * size * 0.4, 2.5, 0, 7);
      ctx.fill();
      ctx.fillStyle = '#1a1a2a';
      ctx.beginPath();
      ctx.arc(Math.cos(a) * size * 0.4, Math.sin(a) * size * 0.4, 1.2, 0, 7);
      ctx.fill();
      // 扑咬时张开大口（朝玩家的血盆大口/獠牙）
      if (lunge > 0) {
        ctx.fillStyle = '#e0402a';
        ctx.beginPath();
        ctx.arc(Math.cos(a) * size * 0.55, Math.sin(a) * size * 0.55, size * (0.32 + lunge * 0.15), 0, 7);
        ctx.fill();
        ctx.fillStyle = '#fff';
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.arc(Math.cos(a) * size * (0.7 + lunge * 0.1) + Math.sin(a) * i * 2.5, Math.sin(a) * size * (0.7 + lunge * 0.1) - Math.cos(a) * i * 2.5, 1.6, 0, 7);
          ctx.fill();
        }
      }
      ctx.restore();
    }
    // 血条
    const w = 16;
    ctx.fillStyle = '#20242b';
    ctx.fillRect(en.x - w / 2, en.y - 16, w, 3);
    ctx.fillStyle = Math.max(0, Math.min(1, en.hp / maxhp)) > 0.5 ? '#57e389' : '#ff5b5b';
    ctx.fillRect(en.x - w / 2, en.y - 16, w * Math.max(0, en.hp / maxhp), 3);
  }
  // 远程投射物（吐痰/火球）
  if (G.enemyProjectiles) {
    for (const pr of G.enemyProjectiles) {
      if (pr.fire) {
        ctx.fillStyle = 'rgba(255,140,40,.85)';
        ctx.beginPath(); ctx.arc(pr.x, pr.y, 4, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,200,120,.7)';
        ctx.beginPath(); ctx.arc(pr.x, pr.y, 2.2, 0, 7); ctx.fill();
      } else {
        ctx.fillStyle = 'rgba(150,180,60,.8)';
        ctx.beginPath(); ctx.arc(pr.x, pr.y, 3, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(200,220,120,.6)';
        ctx.beginPath(); ctx.arc(pr.x, pr.y, 2, 0, 7); ctx.fill();
      }
    }
  }
}

function drawBullets(ctx) {
  if (!G.bullets) return;
  for (const b of G.bullets) {
    const t = b.t / b.life;
    const cx = b.x + (b.tx - b.x) * t, cy = b.y + (b.ty - b.y) * t;
    if (b.kind === 'laser') {
      // 激光/放电电弧：中心亮白 + 外层辉光，增强命中视觉效果（可自定义颜色）
      const a = (1 - t);
      const col = b.color || '#ff5070';   // 放电防御的电击弧为浅蓝色，普通激光为红色
      const r1 = parseInt(col.slice(1, 3), 16), g1 = parseInt(col.slice(3, 5), 16), bl1 = parseInt(col.slice(5, 7), 16);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = 'rgba(' + r1 + ',' + g1 + ',' + bl1 + ',' + (a * 0.35).toFixed(2) + ')';
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(cx, cy); ctx.stroke();
      ctx.strokeStyle = 'rgba(' + r1 + ',' + g1 + ',' + bl1 + ',' + (a * 0.9).toFixed(2) + ')';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(cx, cy); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,' + (a * 0.7).toFixed(2) + ')';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(cx, cy); ctx.stroke();
      ctx.restore();
    } else if (b.kind === 'flame') {
      ctx.fillStyle = 'rgba(255,' + (120 + Math.random() * 60 | 0) + ',40,' + (1 - t).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(cx, cy, 6 + Math.random() * 5, 0, 7); ctx.fill();
    } else if (b.splash || b.art) {
      // 火箭/手雷/炮兵炮弹：轨迹 + 命中爆炸圈
      ctx.strokeStyle = b.art ? 'rgba(255,140,90,' + (1 - t).toFixed(2) + ')' : 'rgba(255,200,120,' + (1 - t).toFixed(2) + ')';
      ctx.lineWidth = b.art ? 3.5 : 2.5;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(cx, cy); ctx.stroke();
      if (t >= 1) {
        const rad0 = (b.splash || 0) * TILE * (b.art ? 0.8 : 0.6) * (b.explosive ? 1.25 : 1);
        // 原子弹核爆：超大范围蘑菇云冲击波环 + 高温火球（对齐《异星工厂》原子弹）
        const rad = b.nuclear ? Math.max(rad0, 9 * TILE) : rad0;
        const nucBoost = b.nuclear ? 1.8 : 1;
        // 爆炸推进进度：用 _boomT 让爆炸随时间膨胀/消散（画面优化：层次火球 + 冲击波环）
        const boomDur = b.nuclear ? 0.9 : (b.art ? 0.6 : (b.explosive ? 0.5 : 0.35));
        const age = (b._boomT || 0);
        const prog = age > 0 ? Math.min(1, age / boomDur) : 1;
        const grow = 0.7 + 0.6 * prog;               // 冲击波扩散
        const fade = Math.max(0, 1 - prog);           // 火焰渐隐
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        // 外层冲击波环（扩散+渐隐）
        ctx.strokeStyle = 'rgba(' + (b.nuclear ? '255,240,200' : '255,220,160') + ',' + (fade * (b.nuclear ? 0.85 : 0.6)).toFixed(2) + ')';
        ctx.lineWidth = b.nuclear ? 6 : 4;
        ctx.beginPath(); ctx.arc(b.tx, b.ty, rad * grow * (b.nuclear ? 1.35 : 1), 0, 7); ctx.stroke();
        ctx.strokeStyle = 'rgba(255,150,70,' + (fade * 0.5).toFixed(2) + ')';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(b.tx, b.ty, rad * grow * 1.15, 0, 7); ctx.stroke();
        // 外层火球 + 中心高亮闪光
        ctx.fillStyle = b.art ? 'rgba(255,120,50,' + (0.4 * fade).toFixed(2) + ')' : 'rgba(255,160,60,' + (0.35 * fade).toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(b.tx, b.ty, rad, 0, 7); ctx.fill();
        ctx.fillStyle = b.art ? 'rgba(255,200,120,' + (0.55 * fade).toFixed(2) + ')' : 'rgba(255,220,140,' + (0.5 * fade).toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(b.tx, b.ty, rad * 0.55, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,230,' + (0.85 * fade).toFixed(2) + ')';
        ctx.beginPath(); ctx.arc(b.tx, b.ty, rad * 0.22, 0, 7); ctx.fill();
        // 爆炸系弹药（爆炸炮弹/铀爆炸炮弹）增强特效：灼热橙芯 + 外圈飞散火星（画面优化）
        if (b.explosive) {
          ctx.fillStyle = 'rgba(255,190,80,' + (0.7 * fade).toFixed(2) + ')';
          ctx.beginPath(); ctx.arc(b.tx, b.ty, rad * 0.42, 0, 7); ctx.fill();
          ctx.fillStyle = 'rgba(255,120,40,' + (0.6 * fade).toFixed(2) + ')';
          ctx.beginPath(); ctx.arc(b.tx, b.ty, rad * 0.62, 0, 7); ctx.fill();
          for (let i = 0; i < 10; i++) {
            const ea = Math.random() * Math.PI * 2;
            const er = rad * (0.4 + Math.random() * 0.8) * prog;
            ctx.fillStyle = 'rgba(255,' + (140 + Math.random() * 80 | 0) + ',50,' + (fade * 0.8).toFixed(2) + ')';
            ctx.beginPath(); ctx.arc(b.tx + Math.cos(ea) * er, b.ty + Math.sin(ea) * er, 2 + Math.random() * 3, 0, 7); ctx.fill();
          }
        }
        ctx.strokeStyle = b.art ? 'rgba(255,120,50,' + (0.9 * fade).toFixed(2) + ')' : 'rgba(255,160,60,' + (0.8 * fade).toFixed(2) + ')';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(b.tx, b.ty, rad, 0, 7); ctx.stroke();
        ctx.restore();
      }
    } else if (b.boom) {
      // 地雷爆炸：短促闪光
      ctx.fillStyle = 'rgba(255,190,90,' + (1 - t).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(b.x, b.y, 10 + (1 - t) * 20, 0, 7); ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(255,220,120,' + (1 - t).toFixed(2) + ')';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(cx, cy); ctx.stroke();
    }
  }
}

// 战斗机器人（胶囊投掷物）：悬浮小无人机，附电池条/血条
function drawCombatRobots(ctx) {
  if (!G.combatRobots) return;
  for (const r of G.combatRobots) {
    if (r.dead) continue;
    const bob = Math.sin(G.time * 6 + r.x) * 2;
    ctx.fillStyle = 'rgba(0,0,0,.25)';
    ctx.beginPath();
    ctx.ellipse(r.x, r.y + 8, r.size * 1.2, r.size * 0.5, 0, 0, 7);
    ctx.fill();
    // 机身
    ctx.fillStyle = r.color;
    ctx.strokeStyle = '#1a2028';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(r.x, r.y + bob, r.size, 0, 7);
    ctx.fill(); ctx.stroke();
    // 小翅膀
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.fillRect(r.x - r.size - 3, r.y + bob - 1, 3, 4);
    ctx.fillRect(r.x + r.size, r.y + bob - 1, 3, 4);
    // 状态灯
    ctx.fillStyle = r.kind === 'destroyer' ? '#ff5b5b' : (r.kind === 'distractor' ? '#ffd23c' : '#7ff0ff');
    ctx.beginPath(); ctx.arc(r.x, r.y + bob - r.size * 0.5, 2, 0, 7); ctx.fill();
    // 血条 / 续航条
    const w = 14;
    ctx.fillStyle = '#20242b';
    ctx.fillRect(r.x - w / 2, r.y + bob - r.size - 7, w, 2.5);
    ctx.fillStyle = r.hp > 0 ? '#57e389' : '#ff5b5b';
    ctx.fillRect(r.x - w / 2, r.y + bob - r.size - 7, w * Math.max(0, r.hp / r.maxhp), 2.5);
  }
}

// 区域力场（毒胶囊 / 减速胶囊）：毒云雾/减速圈的半透明范围叠加
function drawAoeZones(ctx) {
  if (!G.aoeZones) return;
  for (const z of G.aoeZones) {
    if (z.lifetime <= 0) continue;
    const fade = Math.min(1, z.lifetime / (z.maxLife || 10));
    if (z.kind === 'poison') {
      ctx.fillStyle = 'rgba(120,208,70,' + (0.28 * fade) + ')';
      ctx.strokeStyle = 'rgba(160,235,110,' + (0.6 * fade) + ')';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(z.x, z.y, z.radius, 0, 7); ctx.fill(); ctx.stroke();
      // 冒泡微粒
      ctx.fillStyle = 'rgba(170,235,110,' + (0.7 * fade) + ')';
      for (let i = 0; i < 6; i++) {
        const a = i * 1.05 + G.time * 1.3;
        ctx.beginPath();
        ctx.arc(z.x + Math.cos(a) * z.radius * 0.6, z.y + Math.sin(a) * z.radius * 0.6 + Math.sin(G.time * 2 + i) * 3, 2, 0, 7);
        ctx.fill();
      }
    } else if (z.kind === 'slowdown') {
      ctx.fillStyle = 'rgba(74,154,208,' + (0.22 * fade) + ')';
      ctx.strokeStyle = 'rgba(120,190,235,' + (0.55 * fade) + ')';
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 5]);
      ctx.beginPath(); ctx.arc(z.x, z.y, z.radius, 0, 7); ctx.fill(); ctx.stroke();
      ctx.setLineDash([]);
      // 涡旋雪花
      ctx.fillStyle = 'rgba(160,215,250,' + (0.8 * fade) + ')';
      for (let i = 0; i < 5; i++) {
        const a = i * 1.25 + G.time * 0.8;
        ctx.beginPath();
        ctx.arc(z.x + Math.cos(a) * z.radius * 0.55, z.y + Math.sin(a) * z.radius * 0.55, 2.2, 0, 7);
        ctx.fill();
      }
    }
  }
}

// 地面火焰残留（燃烧火场）：橙色摇曳火焰 + 中心高亮，随生命周期渐弱熄灭
function drawGroundFires(ctx) {
  if (!G.groundFires || G.groundFires.length === 0) return;
  const cam = G.cam, z = cam.z;
  const sx = (wx) => (wx - cam.px) * z + W / 2;
  const sy = (wy) => (wy - cam.py) * z + H / 2;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const f of G.groundFires) {
    if (f.life <= 0) continue;
    const cx = sx(f.tx * TILE + TILE / 2), cy = sy(f.ty * TILE + TILE / 2);
    const r = TILE * z * 0.6;                     // 火焰半径
    const lifeT = f.life / f.maxLife;             // 剩余寿命比例（1→0）
    const flick = 0.75 + 0.5 * Math.sin(G.time * 18 + f.tx * 3 + f.ty * 7);   // 火苗摇曳
    const rr = r * (0.85 + 0.3 * flick) * (0.6 + 0.4 * lifeT);
    if (cx < -rr || cx > W + rr || cy < -rr || cy > H + rr) continue;
    const a = Math.min(1, lifeT * 1.4);
    // 外层橙焰（半透明，摇曳）
    ctx.fillStyle = 'rgba(255,' + (90 + 40 * flick) + ',20,' + (0.5 * a).toFixed(3) + ')';
    ctx.beginPath();
    // 用三段弧线叠加模拟不规则火苗
    for (let k = 0; k < 3; k++) {
      const fa = k * 2.09 + G.time * 3;
      const fr = rr * (0.7 + 0.3 * Math.sin(G.time * 12 + k * 2));
      ctx.arc(cx + Math.cos(fa) * rr * 0.5, cy + Math.sin(fa) * rr * 0.3, fr, 0, Math.PI * 2);
    }
    ctx.fill();
    // 内层高亮火心
    ctx.fillStyle = 'rgba(255,220,120,' + (0.75 * a).toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.1, rr * 0.5, 0, Math.PI * 2);
    ctx.fill();
    // 顶部亮白火焰舌
    ctx.fillStyle = 'rgba(255,255,220,' + (0.6 * a).toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(cx, cy - r * 0.25, rr * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}


// 喷吐虫酸液洼地：半透明绿色腐蚀液面，随生命周期渐淡蒸发
function drawAcidPools(ctx) {
  if (!G.acidPools || G.acidPools.length === 0) return;
  const cam = G.cam, z = cam.z;
  const sx = (wx) => (wx - cam.px) * z + W / 2;
  const sy = (wy) => (wy - cam.py) * z + H / 2;
  for (const f of G.acidPools) {
    if (f.life <= 0) continue;
    const cx = sx(f.tx * TILE + TILE / 2), cy = sy(f.ty * TILE + TILE / 2);
    const r = TILE * z * 0.62;
    if (cx < -r || cx > W + r || cy < -r || cy > H + r) continue;
    const lifeT = f.life / f.maxLife;
    const a = Math.min(1, lifeT * 1.5);
    const bubble = 0.85 + 0.15 * Math.sin(G.time * 8 + f.tx * 5 + f.ty * 11);
    ctx.fillStyle = 'rgba(120,180,60,' + (0.4 * a).toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(cx, cy, r * bubble, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(180,230,110,' + (0.45 * a).toFixed(3) + ')';
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.55 * bubble, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(90,150,50,' + (0.5 * a).toFixed(3) + ')';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(cx, cy, r * bubble, 0, Math.PI * 2);
    ctx.stroke();
  }
}


// 击杀敌人掉落的地面矿石（见 combat2.js dropEnemyLoot）：小矿石图标带轻微上下浮动
function drawLootDrops(ctx) {
  if (!G.lootDrops || G.lootDrops.length === 0) return;
  // 视口剔除（P 优化）：只绘制屏幕范围内的掉落物，避免战后大量远处掉落每帧全量绘制。
  const b = FRAME_BOUNDS;
  for (const d of G.lootDrops) {
    if (b && (d.x < b.x1 || d.x > b.x0 || d.y < b.y1 || d.y > b.y0)) continue;
    const bob = Math.sin(G.time * 3 + d.x) * 1.5;
    // 地面阴影
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath(); ctx.ellipse(d.x, d.y + 6, 5, 2.5, 0, 0, 7); ctx.fill();
    // 矿石图标
    const it = ITEMS[d.id];
    if (it) {
      ctx.fillStyle = it.color;
      ctx.beginPath(); ctx.arc(d.x, d.y + bob, 5, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(20,26,34,.6)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(d.x, d.y + bob, 5, 0, 7); ctx.stroke();
    }
  }
}

// 玩家丢弃到地面的物品（见 player.js）：在格子中心绘制物品图标（可被传送带吸附/玩家拾取）
function drawGroundItems(ctx) {
  if (!G.groundItems || G.groundItems.length === 0) return;
  // 视口剔除（P 优化）：只绘制屏幕范围内的地面物品，避免大量远处堆积物品每帧全量 drawItemGlyph。
  const b = FRAME_BOUNDS;
  for (const g of G.groundItems) {
    if (g.taken || !ITEMS[g.item]) continue;
    const cx = g.tx * TILE + TILE / 2;
    const cy = g.ty * TILE + TILE / 2;
    if (b && (cx < b.x1 || cx > b.x0 || cy < b.y1 || cy > b.y0)) continue;
    // 地面阴影
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    ctx.beginPath(); ctx.ellipse(cx, cy + 6, 6, 3, 0, 0, 7); ctx.fill();
    // 物品图标
    if (typeof drawItemGlyph === 'function') {
      drawItemGlyph(ctx, g.item, cx, cy, 14);
    } else {
      ctx.fillStyle = ITEMS[g.item].color;
      ctx.beginPath(); ctx.arc(cx, cy, 5, 0, 7); ctx.fill();
    }
    // 数量 > 1 时显示堆叠数
    if (g.n > 1) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px system-ui';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'bottom';
      ctx.fillText(String(g.n), cx + 6, cy + 7);
    }
  }
}

