'use strict';

// ===== 地图标记（Map Tags，对齐《异星工厂》：在地图/世界中放置可命名的导航标记）=====
//  - 按 N 在玩家当前位置放置一个标记（默认命名"标记 N"，可改）
//  - 按 Alt+N 打开标记管理面板：可重命名、删除、传送至某标记
//  - 标记在小地图上以小旗图标显示；在世界视野内以标签显示
//  - 标记随存档持久化（G.mapTags 序列化）
// 用途：标记关键矿点、基地分区、铁路站点、敌人巢穴等，方便导航定位。

const MAPTAG_COLORS = ['#ffd23c', '#5ac8ff', '#5aff8a', '#ff7a5a', '#d05ad0', '#ff5aa0', '#c8a030'];
let _maptagSeq = 1;

function initMapTags() { if (!Array.isArray(G.mapTags)) G.mapTags = []; }

// 放置标记（在玩家脚下）。name 可空（自动命名）。
function placeMapTag(name) {
  if (!G.mapTags) initMapTags();
  const id = 'mt' + (_maptagSeq++);
  const color = MAPTAG_COLORS[(G.mapTags.length) % MAPTAG_COLORS.length];
  G.mapTags.push({ id, x: G.player.x / TILE, y: G.player.y / TILE, name: name || ('标记 ' + G.mapTags.length), color });
  uiDirty = true;
  if (typeof playSfx === 'function') playSfx('build');
  if (typeof toast === 'function') toast('已放置地图标记：' + (name || '标记 ' + G.mapTags.length));
  return id;
}

// 删除标记
function removeMapTag(id) {
  if (!G.mapTags) return;
  const i = G.mapTags.findIndex(t => t.id === id);
  if (i >= 0) { G.mapTags.splice(i, 1); uiDirty = true; if (typeof playSfx === 'function') playSfx('deconstruct'); }
}

// 重命名标记
function renameMapTag(id, name) {
  if (!G.mapTags) return;
  const t = G.mapTags.find(t => t.id === id);
  if (t && name) { t.name = name; uiDirty = true; }
}

// 传送玩家到标记位置（快捷导航）
function teleportToMapTag(id) {
  const t = G.mapTags && G.mapTags.find(t => t.id === id);
  if (!t) return;
  const sx = t.x * TILE, sy = t.y * TILE;
  G.player.x = sx; G.player.y = sy;
  G.cam.px = sx; G.cam.py = sy;
  markExplored(sx, sy, 4);
  if (typeof playSfx === 'function') playSfx('teleport');
  if (typeof toast === 'function') toast('已传送到标记「' + t.name + '」');
}

// ===== 世界中的标记绘制：当标记在玩家视野内时，绘制旗帜图标 + 名称标签 =====
function drawMapTagsWorld(ctx) {
  if (!G.mapTags || !G.mapTags.length) return;
  if (typeof FRAME_BOUNDS === 'undefined' || !FRAME_BOUNDS) return;
  const cam = G.cam, z = cam.z;
  const sx = (wx) => (wx - cam.px) * z + W / 2;
  const sy = (wy) => (wy - cam.py) * z + H / 2;
  for (const t of G.mapTags) {
    const wx = t.x * TILE, wy = t.y * TILE;
    // 剔除视野外
    if (wx < FRAME_BOUNDS.x1 - TILE || wx > FRAME_BOUNDS.x0 + TILE ||
        wy < FRAME_BOUNDS.y1 - TILE || wy > FRAME_BOUNDS.y0 + TILE) continue;
    const px = sx(wx), py = sy(wy);
    const fs = Math.max(9, 14 * z);
    // 旗杆
    ctx.strokeStyle = '#e8e8e8';
    ctx.lineWidth = Math.max(1, 1.4 * z);
    ctx.beginPath();
    ctx.moveTo(px, py - fs);
    ctx.lineTo(px, py);
    ctx.stroke();
    // 旗面
    ctx.fillStyle = t.color;
    ctx.beginPath();
    ctx.moveTo(px, py - fs);
    ctx.lineTo(px + fs * 0.75, py - fs * 0.68);
    ctx.lineTo(px, py - fs * 0.36);
    ctx.closePath();
    ctx.fill();
    // 名称标签（缩放合适时才显示文字，避免低倍率下模糊）
    if (z > 0.55 && t.name) {
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      const tw = ctx.measureText(t.name).width;
      ctx.fillRect(px - tw / 2 - 3, py - fs - 20, tw + 6, 14);
      ctx.fillStyle = '#fff';
      ctx.font = (11 * Math.max(0.8, Math.min(1.4, z))) + 'px system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(t.name, px, py - fs - 13);
    }
  }
}

// ===== 小地图上的标记：在 drawMinimap 内部调用，绘制已探索范围内的标记 =====
function drawMapTagsMinimap(ctx, cx, cy, z, pcx, pcy, x0, y0, size) {
  if (!G.mapTags || !G.mapTags.length) return;
  for (const t of G.mapTags) {
    const px = cx + (t.x - pcx) * z;
    const py = cy + (t.y - pcy) * z;
    if (px < x0 - 6 || py < y0 - 6 || px > x0 + size + 6 || py > y0 + size + 6) continue;
    // 小旗图标
    ctx.fillStyle = t.color;
    ctx.beginPath();
    ctx.moveTo(px, py - 7);
    ctx.lineTo(px + 6, py - 4.5);
    ctx.lineTo(px, py - 2);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = '#ddd';
    ctx.fillRect(px - 0.6, py - 7, 1.2, 7);
    // 名称（小地图空间有限，仅当空间允许时显示）
    if (size > 120 && t.name) {
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.font = '9px system-ui';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText(t.name, px + 7, py - 4);
    }
  }
}

// ===== 管理面板 =====
function mapTagsPanelHtml() {
  if (!G.mapTags) initMapTags();
  let h = '<div class="sec">地图标记（' + G.mapTags.length + '）</div>';
  h += '<div class="hint">按 <b>N</b> 在当前玩家位置放置标记；点下方按钮可<b>传送</b>至某标记、<b>重命名</b>或<b>删除</b>。标记用于导航矿点/基地/站点。</div>';
  if (!G.mapTags.length) { h += '<div class="dim">还没有标记。走到想标注的地点，按 N 放置。</div>'; }
  for (let i = 0; i < G.mapTags.length; i++) {
    const t = G.mapTags[i];
    const dist = G.player ? Math.round(Math.hypot((t.x * TILE - G.player.x) / TILE, (t.y * TILE - G.player.y) / TILE)) : 0;
    h += '<div class="setrow" style="align-items:center;gap:6px">';
    h += '<span style="width:10px;height:10px;border-radius:2px;background:' + t.color + ';display:inline-block"></span>';
    h += '<b style="flex:1">' + t.name + '</b>';
    h += '<span class="dim">(' + Math.round(t.x) + ',' + Math.round(t.y) + ' · ' + dist + '格)</span>';
    h += '<button data-action="tag-tp" data-id="' + t.id + '" title="传送">📍</button>';
    h += '<button data-action="tag-rename" data-id="' + t.id + '" title="重命名">✏️</button>';
    h += '<button data-action="tag-del" data-id="' + t.id + '" title="删除">🗑</button>';
    h += '</div>';
  }
  h += '<div class="hint" style="margin-top:8px">提示：地图标记随存档保存。</div>';
  return h;
}

// 面板操作分派（由 ui.js 面板事件调用）
function mapTagsAction(action, id, api) {
  if (action === 'tag-tp') { teleportToMapTag(id); if (api) api.render(); }
  else if (action === 'tag-del') {
    removeMapTag(id);
    if (api) api.render();
  }
  else if (action === 'tag-rename') {
    const t = G.mapTags && G.mapTags.find(t => t.id === id);
    if (!t) return;
    const nn = prompt('输入新名称：', t.name);
    if (nn !== null) { renameMapTag(id, nn.trim() || t.name); if (api) api.render(); }
  }
}

// ===== 存档序列化 =====
function mapTagsSerialize() { return (G.mapTags || []).map(t => ({ x: t.x, y: t.y, name: t.name, color: t.color })); }
function mapTagsDeserialize(arr) {
  G.mapTags = (Array.isArray(arr) ? arr : []).map((t, i) => ({
    id: 'mt' + (i + 1), x: t.x, y: t.y, name: t.name || ('标记 ' + (i + 1)), color: t.color || MAPTAG_COLORS[i % MAPTAG_COLORS.length]
  }));
  _maptagSeq = G.mapTags.length + 1;
}
