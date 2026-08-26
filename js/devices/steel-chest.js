'use strict';

// ===== 钢箱：比储物箱容量更大的钢铁储物箱（对齐《异星工厂》Steel chest，占地 1×1）=====
class SteelChest extends Chest {
  constructor(type, x, y) { super('steel-chest', x, y); }
  giveItem(item) {
    const cap = this.limits[item];
    if (cap !== undefined && this.countOf(item) >= cap) return false;
    for (const s of this.slots)
      if (s && s.item === item && s.count < stackSize(item)) { s.count++; return true; }
    if (this.slots.length >= 24) return false;
    this.slots.push({ item, count: 1 });
    return true;
  }
}

// ===== 渲染（钢箱：金属灰蓝配色）=====
function drawSteelChest(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#6f7884';
  rr(ctx, px + 4, py + 8, TILE - 8, TILE - 13, 3); ctx.fill();
  ctx.fillStyle = '#8792a0';
  rr(ctx, px + 4, py + 5, TILE - 8, 10, 3); ctx.fill();
  ctx.strokeStyle = '#434b57';
  ctx.lineWidth = 1.5;
  rr(ctx, px + 4, py + 8, TILE - 8, TILE - 13, 3); ctx.stroke();
  ctx.fillStyle = '#b8c4d2';
  ctx.fillRect(px + TILE / 2 - 2, py + 12, 4, 6);
  ctx.globalAlpha = 1;
}

// ===== 面板：复用储物箱面板（含存量上限），仅文案标注钢箱=====
function steelChestPanelHtml(e) {
  const agg = {};
  for (const s of e.slots) if (s) agg[s.item] = (agg[s.item] || 0) + s.count;
  let h = row('内容', Object.keys(agg).length ? countStr(agg) : '<span class="dim">空</span>', 'contents');
  h += '<div class="status"></div>';
  const ids = Object.keys(agg);
  for (const id in e.limits) if (!(id in agg)) ids.push(id);
  h += '<div class="sec">存量上限（每种物品）</div>';
  if (!ids.length) {
    h += '<div class="dim">空箱。放入物品后可为每种物品设置最大存量，达到上限后机械臂/手动均无法再存入。</div>';
  } else {
    for (const id of ids) {
      h += '<div class="limitrow">' + chip(id, agg[id]) +
        '<input class="limit-in" type="number" min="0" step="10" placeholder="不限" data-limit="' + id + '"' +
        ' value="' + (e.limits[id] || '') + '" data-tip="上限|该物品最大存量；留空或 0 表示不限制"></div>';
    }
    h += '<button data-action="limits-clear">清除所有上限</button>';
  }
  let total = 0;
  for (const k in agg) total += agg[k];
  if (total > 0) h += '<button data-action="takeout" id="btn-chest-takeout">取出全部 (' + total + ')</button>';
  h += '<div class="dim">钢箱：容量为储物箱的两倍（24 格），配合机械臂可做大容量缓冲仓库。</div>';
  return h;
}
function steelChestPanelLive(e, api) {
  const agg = {};
  let total = 0;
  for (const s of e.slots) if (s) { agg[s.item] = (agg[s.item] || 0) + s.count; total += s.count; }
  const kinds = Object.keys(agg).length;
  api.set('contents', Object.keys(agg).length ? countStr(agg) : dimSpan('空'));
  api.toggle('#btn-chest-takeout', total > 0, '取出全部 (' + total + ')');
  const full = Object.keys(agg).filter(id => e.limits[id] !== undefined && agg[id] >= e.limits[id]);
  if (full.length) api.status('已满：' + full.map(id => ITEMS[id].name).join('、') + ' 达到上限，暂停收纳', 'warn');
  else if (total > 0) api.status('收纳中：' + kinds + ' 种，共 ' + total + ' 件', 'ok');
  else api.status('空箱：等待存入物品', 'ok');
}
function steelChestTip(e) {
  let n = 0, k = 0;
  for (const s of e.slots) if (s) { n += s.count; k++; }
  return k ? ('钢箱存货 ' + n + ' 个（' + k + ' 种）') : '空钢箱';
}

// ===== 注册 =====
ENT_CLASSES['steel-chest'] = SteelChest;
DEVICE_RENDER['steel-chest'] = drawSteelChest;
DEVICE_DIR_ROTATE['steel-chest'] = true; // 支持旋转
DEVICE_PANEL['steel-chest'] = { html: steelChestPanelHtml, live: steelChestPanelLive, tip: steelChestTip, onAction: chestOnAction, onChange: chestOnChange };
