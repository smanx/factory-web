'use strict';

// ===== 物流卸载舱（landing-pad-unloading-bay，Space Age 官方建筑：Cargo unloading bay）=====
// 物流接驳站的卸载舱：官方 Cargo unloading bay 允许从太空平台向接驳站卸载货物
// （allow_unloading=true，卸载距离 max-cargo-bay-unloading-distance=59），自身亦提供
// inventory_size_bonus（官方 20）扩展存储槽位。本项目实现为（与 cargo-bay 一致）：
//   1. 独立存储容器：自带 20 格存储（官方 inventory_size_bonus=20）
//   2. 紧邻接驳站时，把接驳站的有效存储容量 +20（对齐官方扩展机制）
// 数据全部来自 GAME_DATA（data.generated.js 官方单源）：
//   占地 4×5（selection_box {{-2,-3},{2,2}}）、血量 1000、堆叠 10、
//   扩展槽位 20（inventory_size_bonus）、卸载距离 59（max-cargo-bay-unloading-distance）。
const UNLOADING_BAY_SLOTS = GAME_DATA.cargoUnloadingBay?.inventorySizeBonus ?? 20;  // 官方 inventory_size_bonus=20
const UNLOADING_BAY_DIST   = GAME_DATA.cargoUnloadingBay?.unloadingDistance ?? 59;  // 官方 max-cargo-bay-unloading-distance=59

class CargoUnloadingBay extends CircuitNode {
  constructor(type, x, y) {
    super('landing-pad-unloading-bay', x, y);
    this.slots = [];
    this.limits = {};
  }
  // ===== 存储：20 格（官方 inventory_size_bonus=20）=====
  giveItem(item) {
    const cap = this.limits[item];
    if (cap !== undefined && this.countOf(item) >= cap) return false;
    for (const s of this.slots)
      if (s && s.item === item && s.count < stackSize(item)) { s.count++; return true; }
    if (this.slots.length >= UNLOADING_BAY_SLOTS) return false;
    this.slots.push({ item, count: 1 });
    return true;
  }
  peekItem() {
    for (let i = this.slots.length - 1; i >= 0; i--) { const s = this.slots[i]; if (s) return s.item; }
    return null;
  }
  takeItem() {
    for (let i = this.slots.length - 1; i >= 0; i--) {
      const s = this.slots[i];
      if (s) { const it = s.item; s.count--; if (s.count <= 0) this.slots.splice(i, 1); return it; }
    }
    return null;
  }
  takeItemOf(item) {
    for (let i = this.slots.length - 1; i >= 0; i--) {
      const st = this.slots[i];
      if (st && st.item === item) { st.count--; if (st.count <= 0) this.slots.splice(i, 1); return item; }
    }
    return null;
  }
  countOf(item) {
    let n = 0;
    for (const st of this.slots) if (st && st.item === item) n += st.count;
    return n;
  }
  contents() {
    const list = [[this.type, 1]];
    for (const s of this.slots) if (s) list.push([s.item, s.count]);
    return list;
  }
  takeAll() {
    const rows = [];
    for (const s of this.slots) if (s) rows.push([s.item, s.count]);
    this.slots = [];
    return rows;
  }
  // ===== 电路网络信号：把舱内每种物品数量作为信号输出 =====
  outputCircuitSignals() {
    const out = [];
    for (const s of this.slots) if (s) {
      let has = false;
      for (const o of out) if (o.sig === s.item) { o.count += s.count; has = true; break; }
      if (!has) out.push({ sig: s.item, count: s.count });
    }
    return out;
  }
  serialize() {
    const s = super.serialize();
    s.slots = this.slots.map(v => v ? [v.item, v.count] : null);
    s.limits = this.limits;
    return s;
  }
  static restore(s) { return super.restore(s); }
}

// ===== 渲染：4×5 卸载舱（比扩展舱更高的绯红货舱）=====
function drawCargoUnloadingBay(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const w = TILE * e.w, h = TILE * e.h;
  ctx.globalAlpha = alpha;
  // 舱体（绯红卸载舱）
  ctx.fillStyle = '#6a3a4a';
  rr(ctx, px + 4, py + 4, w - 8, h - 8, 6); ctx.fill();
  ctx.fillStyle = '#8a4a5a';
  rr(ctx, px + 9, py + 9, w - 18, h - 18, 4); ctx.fill();
  // 顶部吊装/指示灯
  ctx.fillStyle = '#a05a6a';
  ctx.fillRect(px + w / 2 - 3, py + 4, 6, 6);
  // 卸载斜坡（右侧开口，对齐卸载舱 allow_unloading）
  ctx.fillStyle = '#5a3a4a';
  ctx.beginPath();
  ctx.moveTo(px + w - 6, py + h / 2 - 6); ctx.lineTo(px + w - 2, py + h / 2); ctx.lineTo(px + w - 6, py + h / 2 + 6); ctx.closePath(); ctx.fill();
  // 货物指示灯（有存货时亮绿）
  const total = e.slots.reduce((a, s) => a + (s ? s.count : 0), 0);
  ctx.fillStyle = total > 0 ? '#57e389' : '#6a4a5a';
  ctx.fillRect(px + w - 14, py + h - 14, 10, 10);
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function cargoUnloadingBayPanelHtml(e) {
  const agg = {};
  for (const s of e.slots) if (s) agg[s.item] = (agg[s.item] || 0) + s.count;
  let h = row('货物', Object.keys(agg).length ? countStr(agg) : '<span class="dim">空</span>', 'contents');
  h += row('扩展存储', '+' + UNLOADING_BAY_SLOTS + ' 格', 'bonus');
  h += row('卸载距离', UNLOADING_BAY_DIST + ' 格', 'range');
  h += '<div class="status"></div>';
  let total = 0;
  for (const k in agg) total += agg[k];
  if (total > 0) h += '<button data-action="takeout" id="btn-ub-takeout">取出全部 (' + total + ')</button>';
  h += '<div class="dim">物流卸载舱：为物流接驳站提供扩展存储（4×5，+20 格）并作为货物卸载点（官方 Cargo unloading bay，卸载距离 ' + UNLOADING_BAY_DIST + ' 格）。可接入电路网络输出货物信号。</div>';
  return h;
}
function cargoUnloadingBayPanelLive(e, api) {
  let total = 0, k = 0;
  for (const s of e.slots) if (s) { total += s.count; k++; }
  const agg = {};
  for (const s of e.slots) if (s) agg[s.item] = (agg[s.item] || 0) + s.count;
  api.set('contents', total ? countStr(agg) : dimSpan('空'));
  api.set('bonus', '+' + UNLOADING_BAY_SLOTS + ' 格');
  api.set('range', UNLOADING_BAY_DIST + ' 格');
  api.toggle('#btn-ub-takeout', total > 0, '取出全部 (' + total + ')');
  api.status(total ? ('货物：' + k + ' 种，共 ' + total + ' 件') : '空卸载舱', 'ok');
}
function cargoUnloadingBayTip(e) {
  let n = 0;
  for (const s of e.slots) if (s) n += s.count;
  return n ? ('卸载舱存货 ' + n + ' 个') : '空物流卸载舱';
}

// ===== 注册 =====
ENT_CLASSES['landing-pad-unloading-bay'] = CargoUnloadingBay;
DEVICE_RENDER['landing-pad-unloading-bay'] = drawCargoUnloadingBay;
DEVICE_STATUS['landing-pad-unloading-bay'] = e => {
  const total = e.slots.reduce((a, s) => a + (s ? s.count : 0), 0);
  return total > 0 ? 'g' : 'y';
};
DEVICE_PANEL['landing-pad-unloading-bay'] = { html: cargoUnloadingBayPanelHtml, live: cargoUnloadingBayPanelLive, tip: cargoUnloadingBayTip, onAction: chestOnAction, onChange: chestOnChange };
