'use strict';

// ===== 钢铁炉：烧煤冶炼，速度高于石炉（对齐《异星工厂》Steel furnace，占地 2×2）=====
class SteelFurnace extends Furnace {
  constructor(type, x, y) { super('steel-furnace', x, y); }
  // 速度约为石炉的 2 倍（石炉基础耗时 1，钢铁炉 0.5）
  update(dt) {
    const r = this.pickRecipe();
    this.cur = r;
    if (!r) { this.prog = 0; this.lit = false; return; }
    if (this.burnLeft <= 0) {
      if (this.fuelCoal > 0) { this.fuelCoal--; this.burnLeft += COAL_ENERGY; }
      else { this.lit = false; return; }
    }
    this.lit = true;
    this.burnLeft -= dt;
    this.prog += dt / r.time * 2;
    if (this.prog >= 1) {
      this.prog -= 1;
      this.inp[r.inp] = (this.inp[r.inp] || 0) - (r.inCount || 1);
      if (this.inp[r.inp] <= 0) delete this.inp[r.inp];
      this.outp[r.id] = (this.outp[r.id] || 0) + 1;
    }
  }
  giveItem(item) {
    if (item === 'coal' && this.fuelCoal < 20) { this.fuelCoal++; return true; }
    for (const r of SMELTS)
      if (r.inp === item && (this.inp[item] || 0) < 25) { this.inp[item] = (this.inp[item] || 0) + 1; return true; }
    return false;
  }
}

// ===== 渲染（钢铁炉：金属灰蓝配色，区别于石炉）=====
function drawSteelFurnace(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w, sh = TILE * e.h;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#7f8a99';
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 8); ctx.fill();
  ctx.strokeStyle = '#4a535f';
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 8); ctx.stroke();
  ctx.fillStyle = '#67727f';
  rr(ctx, px + 9, py + 9, s - 18, 12, 3); ctx.fill();
  if (e.lit) {
    const fl = 0.55 + Math.sin(G.time * 12 + px) * 0.2;
    ctx.fillStyle = 'rgba(232,118,44,' + (fl * 0.35).toFixed(2) + ')';
    rr(ctx, px + 9, py + 9, s - 18, 12, 3); ctx.fill();
  }
  ctx.fillStyle = '#3a3630';
  rr(ctx, px + s * 0.24, py + s * 0.42, s * 0.52, s * 0.36, 6); ctx.fill();
  if (e.lit) {
    const fl = 0.65 + Math.sin(G.time * 12 + px) * 0.25;
    ctx.fillStyle = 'rgba(232,118,44,' + fl.toFixed(2) + ')';
    rr(ctx, px + s * 0.27, py + s * 0.45, s * 0.46, s * 0.30, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,210,60,' + (fl * 0.7).toFixed(2) + ')';
    rr(ctx, px + s * 0.32, py + s * 0.54, s * 0.36, s * 0.16, 3); ctx.fill();
  }
  if (e.cur && e.prog > 0) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(Math.floor(e.prog * 100) + '%', px + s / 2, py + 15);
  }
  const fuelPct = Math.min(1, e.burnLeft / COAL_ENERGY);
  ctx.fillStyle = '#20242b';
  rr(ctx, px + 10, py + s - 12, s - 20, 5, 2); ctx.fill();
  ctx.fillStyle = fuelPct > 0 ? '#e8762c' : '#c33';
  rr(ctx, px + 10, py + s - 12, (s - 20) * fuelPct, 5, 2); ctx.fill();
  ctx.font = 'bold 10px system-ui';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f0f4fa';
  ctx.fillText('钢铁炉', px + 8, py + s - 18);
  ctx.globalAlpha = 1;
}

// ===== 面板：复用石炉面板（燃料/输入/输出/进度），但状态文案标注钢铁炉=====
function steelFurnacePanelHtml(e) {
  let h = row('燃料', e.fuelCoal > 0 ? chip('coal', e.fuelCoal) : '<span class="dim">无</span>', 'fuel');
  if (invCount('coal') > 0)
    h += '<button data-action="fuel" data-id="coal">加入 5 煤 (' + invCount('coal') + ')</button>';
  h += row('输入', Object.keys(e.inp).length ? countStr(e.inp) : '<span class="dim">空</span>', 'input');
  for (const r of SMELTS) {
    const n = Math.min(invCount(r.inp), 25 - (e.inp[r.inp] || 0));
    if (n > 0) h += '<button data-action="feed" data-id="' + r.inp + '">放入' +
      ITEMS[r.inp].name + ' ×' + n + '</button>';
  }
  if (Object.keys(e.inp).length) h += '<button data-action="takein">取回全部输入</button>';
  h += row('输出', Object.keys(e.outp).length ? countStr(e.outp) : '<span class="dim">空</span>', 'output');
  h += '<button data-action="takeout" id="btn-takeout" style="display:none"></button>';
  h += barHtml(0);
  h += '<div class="status"></div>';
  h += '<div class="dim">钢铁炉：烧煤冶炼，速度约为石炉的 2 倍，可高效产铁板/铜板/钢板（2×2）。</div>';
  return h;
}
function steelFurnacePanelLive(e, api) {
  api.set('fuel', e.fuelCoal > 0 ? chip('coal', e.fuelCoal) : dimSpan('无'));
  api.set('input', Object.keys(e.inp).length ? countStr(e.inp) : dimSpan('空'));
  api.set('output', Object.keys(e.outp).length ? countStr(e.outp) : dimSpan('空'));
  const n = Object.values(e.outp).reduce((a, b) => a + b, 0);
  api.toggle('#btn-takeout', n > 0, '取回全部输出 (' + n + ')');
  api.prog(e.prog * 100);
  if (e.lit) api.status('冶炼中（钢铁炉·高速）', 'ok');
  else if (e.cur) api.status('已暂停：等待燃料（加入煤）', 'warn');
  else api.status('已暂停：待料（放入燃料和矿石）', 'warn');
}
function steelFurnaceTip(e) {
  return e.lit ? '冶炼中（钢铁炉·高速）' : ((Object.keys(e.inp).length || e.fuelCoal > 0) ? '待料' : '空置，需放入燃料和矿石');
}

// ===== 注册 =====
ENT_CLASSES['steel-furnace'] = SteelFurnace;
DEVICE_RENDER['steel-furnace'] = drawSteelFurnace;
DEVICE_STATUS['steel-furnace'] = e => e.lit ? (e.cur ? 'g' : 'y') : 'r';
DEVICE_PANEL['steel-furnace'] = { html: steelFurnacePanelHtml, live: steelFurnacePanelLive, tip: steelFurnaceTip };
