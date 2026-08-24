'use strict';

// ===== 储物箱：存物资，可设每种物品的存量上限 =====
class Chest extends Entity {
  constructor(type, x, y) {
    super('storage-chest', x, y);
    this.slots = [];
    this.limits = {};
  }
  giveItem(item) {
    const cap = this.limits[item];
    if (cap !== undefined && this.countOf(item) >= cap) return false;
    for (const s of this.slots)
      if (s && s.item === item && s.count < 50) { s.count++; return true; }
    if (this.slots.length >= 12) return false;
    this.slots.push({ item, count: 1 });
    return true;
  }
  peekItem() {
    for (let i = this.slots.length - 1; i >= 0; i--) {
      const s = this.slots[i];
      if (s) return s.item;
    }
    return null;
  }
  takeItem() {
    for (let i = this.slots.length - 1; i >= 0; i--) {
      const s = this.slots[i];
      if (s) {
        const it = s.item;
        s.count--;
        if (s.count <= 0) this.slots.splice(i, 1);
        return it;
      }
    }
    return null;
  }
  countOf(item) {
    let n = 0;
    for (const st of this.slots) if (st && st.item === item) n += st.count;
    return n;
  }
  takeItemOf(item) {
    for (let i = this.slots.length - 1; i >= 0; i--) {
      const st = this.slots[i];
      if (st && st.item === item) {
        st.count--;
        if (st.count <= 0) this.slots.splice(i, 1);
        return item;
      }
    }
    return null;
  }
  contents() {
    const list = [[this.type, 1]];
    for (const s of this.slots) if (s) list.push([s.item, s.count]);
    return list;
  }
  // 面板"取出全部"：清空所有槽位
  takeAll() {
    const rows = [];
    for (const s of this.slots) if (s) rows.push([s.item, s.count]);
    this.slots = [];
    return rows;
  }
  serialize() {
    const s = super.serialize();
    s.slots = this.slots.map(v => v ? [v.item, v.count] : null);
    s.limits = this.limits;
    return s;
  }
  // 蓝图保留格子数量上限配置，不复制箱内物品
  blueprint() {
    const s = super.blueprint();
    s.limits = this.limits;
    return s;
  }
  static restore(s) {
    const c = super.restore(s);
    c.slots = (s.slots || []).map(v => v ? { item: v[0], count: v[1] } : null);
    c.limits = {};
    for (const k in (s.limits || {})) if (s.limits[k] > 0) c.limits[k] = s.limits[k];
    return c;
  }
}

// ===== 渲染 =====
function drawChest(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#7c5c39';
  rr(ctx, px + 4, py + 8, TILE - 8, TILE - 13, 3); ctx.fill();
  ctx.fillStyle = '#95734a';
  rr(ctx, px + 4, py + 5, TILE - 8, 10, 3); ctx.fill();
  ctx.strokeStyle = '#4c371f';
  ctx.lineWidth = 1.5;
  rr(ctx, px + 4, py + 8, TILE - 8, TILE - 13, 3); ctx.stroke();
  ctx.fillStyle = '#e0c56e';
  ctx.fillRect(px + TILE / 2 - 2, py + 12, 4, 6);
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function chestPanelHtml(e) {
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
  return h;
}
function chestPanelLive(e, api) {
  const agg = {};
  let total = 0;
  for (const s of e.slots) if (s) { agg[s.item] = (agg[s.item] || 0) + s.count; total += s.count; }
  const kinds = Object.keys(agg).length;
  api.set('contents', Object.keys(agg).length ? countStr(agg) : dimSpan('空'));
  api.toggle('#btn-chest-takeout', total > 0, '取出全部 (' + total + ')');
  // 状态：达到上限的物品种类提示暂停收纳
  const full = Object.keys(agg).filter(id => e.limits[id] !== undefined && agg[id] >= e.limits[id]);
  if (full.length) api.status('已满：' + full.map(id => ITEMS[id].name).join('、') + ' 达到上限，暂停收纳', 'warn');
  else if (total > 0) api.status('收纳中：' + kinds + ' 种，共 ' + total + ' 件', 'ok');
  else api.status('空箱：等待存入物品', 'ok');
}
function chestTip(e) {
  let n = 0, k = 0;
  for (const s of e.slots) if (s) { n += s.count; k++; }
  return k ? ('存货 ' + n + ' 个（' + k + ' 种）') : '空箱';
}
function chestOnAction(act) {
  if (act === 'limits-clear') {
    const c = G.panelEnt;
    if (c instanceof Chest) c.limits = {};
    return true;
  }
  return false;
}
function chestOnChange(ev) {
  const lim = ev.target.closest ? ev.target.closest('[data-limit]') : null;
  if (!lim) return false;
  const c = G.panelEnt;
  if (c instanceof Chest) {
    const id = lim.dataset.limit;
    let v = Math.floor(+lim.value);
    if (!isFinite(v) || v <= 0) { delete c.limits[id]; lim.value = ''; }
    else { c.limits[id] = v; lim.value = v; }
    uiDirty = true;
  }
  return true;
}

// ===== 注册 =====
ENT_CLASSES['storage-chest'] = Chest;
DEVICE_RENDER['storage-chest'] = drawChest;
DEVICE_PANEL['storage-chest'] = { html: chestPanelHtml, live: chestPanelLive, tip: chestTip, onAction: chestOnAction, onChange: chestOnChange };

// ===== 木箱（对齐《异星工厂》Wooden chest，占地 1×1，容量较小 16 格）=====
class WoodenChest extends Chest {
  constructor(type, x, y) { super('wooden-chest', x, y); }
  giveItem(item) {
    const cap = this.limits[item];
    if (cap !== undefined && this.countOf(item) >= cap) return false;
    for (const s of this.slots)
      if (s && s.item === item && s.count < 40) { s.count++; return true; }
    if (this.slots.length >= 16) return false;
    this.slots.push({ item, count: 1 });
    return true;
  }
}
function drawWoodenChest(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#8a6a42';
  rr(ctx, px + 4, py + 8, TILE - 8, TILE - 13, 3); ctx.fill();
  ctx.fillStyle = '#a08050';
  rr(ctx, px + 4, py + 5, TILE - 8, 10, 3); ctx.fill();
  ctx.strokeStyle = '#5c4326';
  ctx.lineWidth = 1.5;
  rr(ctx, px + 4, py + 8, TILE - 8, TILE - 13, 3); ctx.stroke();
  ctx.fillStyle = '#c8a860';
  ctx.fillRect(px + TILE / 2 - 2, py + 12, 4, 6);
  ctx.globalAlpha = 1;
}
function woodenChestPanelHtml(e) {
  const agg = {};
  for (const s of e.slots) if (s) agg[s.item] = (agg[s.item] || 0) + s.count;
  let h = row('内容', Object.keys(agg).length ? countStr(agg) : '<span class="dim">空</span>', 'contents');
  h += '<div class="status"></div>';
  let total = 0;
  for (const k in agg) total += agg[k];
  if (total > 0) h += '<button data-action="takeout" id="btn-chest-takeout">取出全部 (' + total + ')</button>';
  h += '<div class="dim">木箱：最基础的储物箱（16 格），开局即可用木材合成。</div>';
  return h;
}
function woodenChestPanelLive(e, api) {
  let total = 0, k = 0;
  for (const s of e.slots) if (s) { total += s.count; k++; }
  api.set('contents', total ? countStr(e.slots.filter(Boolean).reduce((a, s) => (a[s.item] = (a[s.item] || 0) + s.count, a), {})) : dimSpan('空'));
  api.toggle('#btn-chest-takeout', total > 0, '取出全部 (' + total + ')');
  api.status(total ? ('收纳中：' + k + ' 种，共 ' + total + ' 件') : '空木箱', total ? 'ok' : 'ok');
}
function woodenChestTip(e) {
  let n = 0;
  for (const s of e.slots) if (s) n += s.count;
  return n ? ('木箱存货 ' + n + ' 个') : '空木箱';
}
ENT_CLASSES['wooden-chest'] = WoodenChest;
DEVICE_RENDER['wooden-chest'] = drawWoodenChest;
DEVICE_PANEL['wooden-chest'] = { html: woodenChestPanelHtml, live: woodenChestPanelLive, tip: woodenChestTip, onAction: chestOnAction, onChange: chestOnChange };

// ===== 铁箱（对齐《异星工厂》Iron chest，占地 1×1，容量 32 格，比木箱大、比钢箱小）=====
class IronChest extends Chest {
  constructor(type, x, y) { super('iron-chest', x, y); }
  giveItem(item) {
    const cap = this.limits[item];
    if (cap !== undefined && this.countOf(item) >= cap) return false;
    for (const s of this.slots)
      if (s && s.item === item && s.count < 50) { s.count++; return true; }
    if (this.slots.length >= 32) return false;
    this.slots.push({ item, count: 1 });
    return true;
  }
}
function drawIronChest(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#8a939e';
  rr(ctx, px + 4, py + 8, TILE - 8, TILE - 13, 3); ctx.fill();
  ctx.fillStyle = '#a3aab5';
  rr(ctx, px + 4, py + 5, TILE - 8, 10, 3); ctx.fill();
  ctx.strokeStyle = '#58616c';
  ctx.lineWidth = 1.5;
  rr(ctx, px + 4, py + 8, TILE - 8, TILE - 13, 3); ctx.stroke();
  ctx.fillStyle = '#c8d0da';
  ctx.fillRect(px + TILE / 2 - 2, py + 12, 4, 6);
  ctx.globalAlpha = 1;
}
function ironChestPanelHtml(e) {
  const agg = {};
  for (const s of e.slots) if (s) agg[s.item] = (agg[s.item] || 0) + s.count;
  let h = row('内容', Object.keys(agg).length ? countStr(agg) : '<span class="dim">空</span>', 'contents');
  h += '<div class="status"></div>';
  let total = 0;
  for (const k in agg) total += agg[k];
  if (total > 0) h += '<button data-action="takeout" id="btn-chest-takeout">取出全部 (' + total + ')</button>';
  h += '<div class="dim">铁箱：容量比木箱更大（32 格），由木箱升级而来。</div>';
  return h;
}
function ironChestPanelLive(e, api) {
  let total = 0, k = 0;
  for (const s of e.slots) if (s) { total += s.count; k++; }
  api.set('contents', total ? countStr(e.slots.filter(Boolean).reduce((a, s) => (a[s.item] = (a[s.item] || 0) + s.count, a), {})) : dimSpan('空'));
  api.toggle('#btn-chest-takeout', total > 0, '取出全部 (' + total + ')');
  api.status(total ? ('收纳中：' + k + ' 种，共 ' + total + ' 件') : '空铁箱', total ? 'ok' : 'ok');
}
function ironChestTip(e) {
  let n = 0;
  for (const s of e.slots) if (s) n += s.count;
  return n ? ('铁箱存货 ' + n + ' 个') : '空铁箱';
}
ENT_CLASSES['iron-chest'] = IronChest;
DEVICE_RENDER['iron-chest'] = drawIronChest;
DEVICE_PANEL['iron-chest'] = { html: ironChestPanelHtml, live: ironChestPanelLive, tip: ironChestTip, onAction: chestOnAction, onChange: chestOnChange };
