'use strict';

// ===== 物流扩展舱（cargo-bay，官方 base 建筑：Cargo bay）=====
// 物流接驳站的扩展存储舱：官方 Cargo bay 紧邻接驳站铺设，为接驳站增加
// inventory_size_bonus（官方 20）额外存储槽位。本项目实现为：
//   1. 独立存储容器：自带 20 格存储（对齐官方 inventory_size_bonus=20）
//   2. 紧邻接驳站时，把接驳站的有效存储容量 +20（对齐官方扩展机制）
// 数据全部来自 GAME_DATA（data.generated.js 官方单源）：
//   占地 4×4（selection_box ±2）、血量 1000、堆叠 10、扩展槽位 20（inventory_size_bonus）。
const CARGO_BAY_SLOTS = GAME_DATA.cargoBay?.inventorySizeBonus ?? 20;   // 官方 inventory_size_bonus=20

class CargoBay extends CircuitNode {
  constructor(type, x, y) {
    super('cargo-bay', x, y);
    this.slots = [];
    this.limits = {};
  }
  // ===== 存储：20 格（官方 inventory_size_bonus=20）=====
  giveItem(item) {
    const cap = this.limits[item];
    if (cap !== undefined && this.countOf(item) >= cap) return false;
    for (const s of this.slots)
      if (s && s.item === item && s.count < stackSize(item)) { s.count++; return true; }
    if (this.slots.length >= CARGO_BAY_SLOTS) return false;
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

// ===== 渲染：4×4 扩展存储舱 =====
function drawCargoBay(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w;
  ctx.globalAlpha = alpha;
  // 舱体（比接驳站更小的紫色货舱）
  ctx.fillStyle = '#4a3a5a';
  rr(ctx, px + 4, py + 4, s - 8, s - 8, 6); ctx.fill();
  ctx.fillStyle = '#6a5a8a';
  rr(ctx, px + 9, py + 9, s - 18, s - 18, 4); ctx.fill();
  // 顶部吊装/指示灯
  ctx.fillStyle = '#8a7a9a';
  ctx.fillRect(px + s / 2 - 3, py + 4, 6, 6);
  // 货物指示灯（有存货时亮绿）
  const total = e.slots.reduce((a, s) => a + (s ? s.count : 0), 0);
  ctx.fillStyle = total > 0 ? '#57e389' : '#6a5a7a';
  ctx.fillRect(px + s - 14, py + s - 14, 10, 10);
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function cargoBayPanelHtml(e) {
  const agg = {};
  for (const s of e.slots) if (s) agg[s.item] = (agg[s.item] || 0) + s.count;
  let h = row('货物', Object.keys(agg).length ? countStr(agg) : '<span class="dim">空</span>', 'contents');
  h += row('扩展存储', '+' + CARGO_BAY_SLOTS + ' 格', 'bonus');
  h += '<div class="status"></div>';
  let total = 0;
  for (const k in agg) total += agg[k];
  if (total > 0) h += '<button data-action="takeout" id="btn-cb-takeout">取出全部 (' + total + ')</button>';
  h += '<div class="dim">物流扩展舱：为物流接驳站提供扩展存储（4×4，+20 格）。可接入电路网络输出货物信号。</div>';
  return h;
}
function cargoBayPanelLive(e, api) {
  let total = 0, k = 0;
  for (const s of e.slots) if (s) { total += s.count; k++; }
  const agg = {};
  for (const s of e.slots) if (s) agg[s.item] = (agg[s.item] || 0) + s.count;
  api.set('contents', total ? countStr(agg) : dimSpan('空'));
  api.set('bonus', '+' + CARGO_BAY_SLOTS + ' 格');
  api.toggle('#btn-cb-takeout', total > 0, '取出全部 (' + total + ')');
  api.status(total ? ('货物：' + k + ' 种，共 ' + total + ' 件') : '空扩展舱', 'ok');
}
function cargoBayTip(e) {
  let n = 0;
  for (const s of e.slots) if (s) n += s.count;
  return n ? ('扩展舱存货 ' + n + ' 个') : '空物流扩展舱';
}

// ===== 注册 =====
ENT_CLASSES['cargo-bay'] = CargoBay;
DEVICE_RENDER['cargo-bay'] = drawCargoBay;
DEVICE_STATUS['cargo-bay'] = e => {
  const total = e.slots.reduce((a, s) => a + (s ? s.count : 0), 0);
  return total > 0 ? 'g' : 'y';
};
DEVICE_PANEL['cargo-bay'] = { html: cargoBayPanelHtml, live: cargoBayPanelLive, tip: cargoBayTip, onAction: chestOnAction, onChange: chestOnChange };
