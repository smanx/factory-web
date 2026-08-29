'use strict';

// ===== 物流接驳站（cargo-landing-pad，官方 base 建筑）=====
// 火箭货物接驳枢纽：火箭发射后，被发射物品的产物降落在此；内置 80 格大容量存储
// 与雷达视野（官方 radar_range=4），供终局物流/太空货运调度。
// 数据全部来自 GAME_DATA（data.generated.js 官方单源）：
//   占地 8×8（selection_box ±4）、血量 1000、堆叠 1、内置 80 槽（inventory_size）、
//   雷达视野 4 格（radar_range）。未单独维护数值表。
const CARGO_PAD_SLOTS = GAME_DATA.cargoLandingPad?.inventorySize ?? 80;   // 官方 inventory_size=80
const CARGO_PAD_RADAR = GAME_DATA.cargoLandingPad?.radarRange ?? 4;       // 官方 radar_range=4
const CARGO_PAD_SWEEP = 2.5;  // 雷达扫描间隔（秒，与官方雷达同节奏）

class CargoLandingPad extends CircuitNode {
  constructor(type, x, y) {
    super('cargo-landing-pad', x, y);
    this.slots = [];
    this.limits = {};
    this.t = 0;       // 雷达扫描计时
    this.cargoIn = 0; // 累计接收的火箭货物量（显示用）
  }
  // ===== 存储：80 槽大容量（官方 inventory_size=80）=====
  // 相邻物流扩展舱（cargo-bay）可为接驳站提供额外槽位（官方 inventory_size_bonus=20/舱）。
  slotCap() {
    let bonus = 0;
    if (typeof G !== 'undefined' && G.ents) {
      for (const k in G.ents) {
        const e = G.ents[k];
        if (!e || (e.type !== 'cargo-bay' && e.type !== 'landing-pad-unloading-bay') || !e.w || !e.h) continue;
        // 相邻判定：扩展舱/卸载舱与接驳站矩形相邻（不重叠且任一边接触）
        const cx1 = e.x, cy1 = e.y, cx2 = e.x + e.w, cy2 = e.y + e.h;
        const px1 = this.x, py1 = this.y, px2 = this.x + this.w, py2 = this.y + this.h;
        const touch = (cx1 === px2 || cx2 === px1 || cy1 === py2 || cy2 === py1) &&
          (cx2 > px1 && cx1 < px2) && (cy2 > py1 && cy1 < py2);
        if (touch) bonus += GAME_DATA.cargoBay?.inventorySizeBonus ?? 20;
      }
    }
    return CARGO_PAD_SLOTS + bonus;
  }
  giveItem(item) {
    const cap = this.limits[item];
    if (cap !== undefined && this.countOf(item) >= cap) return false;
    for (const s of this.slots)
      if (s && s.item === item && s.count < stackSize(item)) { s.count++; return true; }
    if (this.slots.length >= this.slotCap()) return false;
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
  // ===== 电路网络信号：把箱内每种物品数量作为信号输出（对齐官方：接驳站可接入电路）=====
  outputCircuitSignals() {
    const out = [];
    for (const s of this.slots) if (s) {
      let has = false;
      for (const o of out) if (o.sig === s.item) { o.count += s.count; has = true; break; }
      if (!has) out.push({ sig: s.item, count: s.count });
    }
    return out;
  }
  // ===== 雷达扫描：周期性扩展探索（官方 radar_range=4）=====
  update(dt) {
    this.t += dt;
    if (this.t < CARGO_PAD_SWEEP) return;
    this.t = 0;
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    if (typeof ensureChunk === 'function') {
      for (let dy = -CARGO_PAD_RADAR; dy <= CARGO_PAD_RADAR; dy++)
        for (let dx = -CARGO_PAD_RADAR; dx <= CARGO_PAD_RADAR; dx++) {
          if (dx * dx + dy * dy > CARGO_PAD_RADAR * CARGO_PAD_RADAR) continue;
          ensureChunk(cx + dx, cy + dy);
        }
    }
    if (typeof markExplored === 'function') markExplored(cx, cy, CARGO_PAD_RADAR);
  }
  serialize() {
    const s = super.serialize();
    s.slots = this.slots.map(v => v ? [v.item, v.count] : null);
    s.limits = this.limits;
    s.cargoIn = this.cargoIn || 0;
    return s;
  }
  static restore(s) { return super.restore(s); }
}

// ===== 渲染：8×8 大型接驳平台 =====
function drawCargoLandingPad(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w;
  ctx.globalAlpha = alpha;
  // 地基平台
  ctx.fillStyle = '#5a4a6a';
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 8); ctx.fill();
  ctx.fillStyle = '#6a5a7a';
  rr(ctx, px + 8, py + 8, s - 16, s - 16, 6); ctx.fill();
  // 中央着陆标记（圆形平台）
  ctx.strokeStyle = '#8a7a9a';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(px + s / 2, py + s / 2, s * 0.22, 0, 7); ctx.stroke();
  // 雷达天线（右上角旋转）
  const ang = G.time * 2;
  const ax = px + s - 14, ay = py + 14;
  ctx.strokeStyle = '#b0a0c0';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax + Math.cos(ang) * 10, ay + Math.sin(ang) * 10); ctx.stroke();
  ctx.fillStyle = '#b0a0c0';
  ctx.beginPath(); ctx.arc(ax, ay, 3, 0, 7); ctx.fill();
  // 货物指示灯（有存货时亮绿）
  const total = e.slots.reduce((a, s) => a + (s ? s.count : 0), 0);
  ctx.fillStyle = total > 0 ? '#57e389' : '#7a6a8a';
  ctx.fillRect(px + 10, py + s - 18, 10, 10);
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function cargoLandingPadPanelHtml(e) {
  const agg = {};
  for (const s of e.slots) if (s) agg[s.item] = (agg[s.item] || 0) + s.count;
  let h = row('货物', Object.keys(agg).length ? countStr(agg) : '<span class="dim">空</span>', 'contents');
  h += row('雷达', '扫描范围 ' + CARGO_PAD_RADAR + ' 格', 'radar');
  h += row('存储', e.slotCap() + ' 格', 'slots');
  h += row('累计接收', (e.cargoIn || 0) + ' 件', 'cargo');
  let total = 0;
  for (const k in agg) total += agg[k];
  if (total > 0) h += '<button data-action="takeout" id="btn-clp-takeout">取出全部 (' + total + ')</button>';
  h += '<div class="dim">物流接驳站：火箭发射后货物降落于此（8×8，' + e.slotCap() + ' 格存储）。可接入电路网络输出货物信号。</div>';
  return h;
}
function cargoLandingPadPanelLive(e, api) {
  let total = 0, k = 0;
  for (const s of e.slots) if (s) { total += s.count; k++; }
  const agg = {};
  for (const s of e.slots) if (s) agg[s.item] = (agg[s.item] || 0) + s.count;
  api.set('contents', total ? countStr(agg) : dimSpan('空'));
  api.set('radar', '扫描范围 ' + CARGO_PAD_RADAR + ' 格');
  api.set('slots', e.slotCap() + ' 格');
  api.set('cargo', (e.cargoIn || 0) + ' 件');
  api.toggle('#btn-clp-takeout', total > 0, '取出全部 (' + total + ')');
  api.status(total ? ('货物：' + k + ' 种，共 ' + total + ' 件') : '空接驳站', total ? 'ok' : 'ok');
}
function cargoLandingPadTip(e) {
  let n = 0;
  for (const s of e.slots) if (s) n += s.count;
  return n ? ('接驳站存货 ' + n + ' 个') : '空物流接驳站';
}

// ===== 注册 =====
ENT_CLASSES['cargo-landing-pad'] = CargoLandingPad;
DEVICE_RENDER['cargo-landing-pad'] = drawCargoLandingPad;
DEVICE_STATUS['cargo-landing-pad'] = e => {
  const total = e.slots.reduce((a, s) => a + (s ? s.count : 0), 0);
  return total > 0 ? 'g' : 'y';
};
DEVICE_PANEL['cargo-landing-pad'] = { html: cargoLandingPadPanelHtml, live: cargoLandingPadPanelLive, tip: cargoLandingPadTip, onAction: chestOnAction, onChange: chestOnChange };
