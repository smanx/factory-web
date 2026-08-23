'use strict';

// ===== 石炉：烧煤冶炼 =====
class Furnace extends Entity {
  constructor(type, x, y) {
    super(type || 'stone-furnace', x, y);
    this.fuelCoal = 0;
    this.burnLeft = 0;
    this.inp = {};
    this.outp = {};
    this.cur = null;
    this.prog = 0;
    this.lit = false;
  }
  pickRecipe() {
    for (const r of SMELTS)
      if ((this.inp[r.inp] || 0) >= (r.inCount || 1) && (this.outp[r.id] || 0) < 25) return r;
    return null;
  }
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
    this.prog += dt / r.time;
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
  peekItem() {
    for (const k in this.outp) if (this.outp[k] > 0) return k;
    return null;
  }
  takeItem() {
    for (const k in this.outp) {
      if (this.outp[k] > 0) {
        this.outp[k]--;
        if (this.outp[k] <= 0) delete this.outp[k];
        return k;
      }
    }
    return null;
  }
  countOf(item) { return this.outp[item] || 0; }
  takeItemOf(item) {
    if ((this.outp[item] || 0) > 0) { this.outp[item]--; if (this.outp[item] <= 0) delete this.outp[item]; return item; }
    return null;
  }
  contents() {
    const list = [[this.type, 1]];
    if (this.fuelCoal > 0) list.push(['coal', this.fuelCoal]);
    for (const k in this.inp) list.push([k, this.inp[k]]);
    for (const k in this.outp) list.push([k, this.outp[k]]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.fuelCoal = this.fuelCoal; s.burnLeft = this.burnLeft;
    s.inp = this.inp; s.outp = this.outp; s.prog = this.prog;
    return s;
  }
  static restore(s) {
    const f = super.restore(s);
    f.fuelCoal = s.fuelCoal || 0; f.burnLeft = s.burnLeft || 0;
    f.inp = s.inp || {}; f.outp = s.outp || {}; f.prog = s.prog || 0;
    return f;
  }
}

// ===== 渲染（石炉/电炉共用，按 type 换色）=====
function drawFurnace(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w;
  const sh = TILE * e.h;
  const electric = e.type === 'electric-furnace';
  const bodyC = electric ? '#2e7d5c' : '#8b8577';
  const lineC = electric ? '#1a4f3a' : '#57524a';
  const innerC = electric ? '#25694c' : '#6d6759';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = bodyC;
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 8); ctx.fill();
  ctx.strokeStyle = lineC;
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 8); ctx.stroke();
  ctx.fillStyle = innerC;
  rr(ctx, px + 9, py + 9, s - 18, 12, 3); ctx.fill();
  if (e.lit) {
    const fl = 0.55 + Math.sin(G.time * 12 + px) * 0.2;
    ctx.fillStyle = electric ? 'rgba(64,216,160,' + (fl * 0.35).toFixed(2) + ')' : 'rgba(232,118,44,' + (fl * 0.35).toFixed(2) + ')';
    rr(ctx, px + 9, py + 9, s - 18, 12, 3); ctx.fill();
  }
  ctx.fillStyle = '#3a3630';
  rr(ctx, px + s * 0.24, py + s * 0.42, s * 0.52, s * 0.36, 6); ctx.fill();
  if (e.lit) {
    const fl = 0.65 + Math.sin(G.time * 12 + px) * 0.25;
    ctx.fillStyle = electric ? 'rgba(64,216,160,' + fl.toFixed(2) + ')' : 'rgba(232,118,44,' + fl.toFixed(2) + ')';
    rr(ctx, px + s * 0.27, py + s * 0.45, s * 0.46, s * 0.30, 4); ctx.fill();
    ctx.fillStyle = electric ? 'rgba(200,255,230,' + (fl * 0.7).toFixed(2) + ')' : 'rgba(255,210,60,' + (fl * 0.7).toFixed(2) + ')';
    rr(ctx, px + s * 0.32, py + s * 0.54, s * 0.36, s * 0.16, 3); ctx.fill();
  }
  if (e.cur && e.prog > 0) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(Math.floor(e.prog * 100) + '%', px + s / 2, py + 15);
  }
  if (!electric) {
    const fuelPct = Math.min(1, e.burnLeft / COAL_ENERGY);
    ctx.fillStyle = '#20242b';
    rr(ctx, px + 10, py + s - 12, s - 20, 5, 2); ctx.fill();
    ctx.fillStyle = fuelPct > 0 ? '#e8762c' : '#c33';
    rr(ctx, px + 10, py + s - 12, (s - 20) * fuelPct, 5, 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ===== 面板（石炉/电炉共用，电炉无燃料行）=====
function furnacePanelHtml(e) {
  const eFurn = e instanceof ElectricFurnace;
  let h = '';
  if (!eFurn) {
    h += row('燃料', e.fuelCoal > 0 ? chip('coal', e.fuelCoal) : '<span class="dim">无</span>', 'fuel');
    if (invCount('coal') > 0)
      h += '<button data-action="fuel" data-id="coal">加入 5 煤 (' + invCount('coal') + ')</button>';
  }
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
  return h;
}
function furnacePanelLive(e, api) {
  const eFurn = e instanceof ElectricFurnace;
  if (!eFurn) api.set('fuel', e.fuelCoal > 0 ? chip('coal', e.fuelCoal) : dimSpan('无'));
  api.set('input', Object.keys(e.inp).length ? countStr(e.inp) : dimSpan('空'));
  api.set('output', Object.keys(e.outp).length ? countStr(e.outp) : dimSpan('空'));
  const n = Object.values(e.outp).reduce((a, b) => a + b, 0);
  api.toggle('#btn-takeout', n > 0, '取回全部输出 (' + n + ')');
  api.prog(e.prog * 100);
  if (eFurn) {
    if (e.lit) api.status('冶炼中', 'ok');
    else if (e.cur && G.power.sat <= 0) api.status('已暂停：缺电', 'bad');
    else api.status('已暂停：待料（放入矿石）', 'warn');
  } else {
    if (e.lit) api.status('冶炼中', 'ok');
    else if (e.cur) api.status('已暂停：等待燃料（加入煤）', 'warn');
    else api.status('已暂停：待料（放入燃料和矿石）', 'warn');
  }
}
function furnaceTip(e) {
  return e.lit ? '冶炼中' : ((Object.keys(e.inp).length || e.fuelCoal > 0) ? '待料' : '空置，需放入燃料和矿石');
}

// ===== 注册 =====
ENT_CLASSES['stone-furnace'] = Furnace;
DEVICE_RENDER['stone-furnace'] = drawFurnace;
DEVICE_RENDER['electric-furnace'] = drawFurnace;
// 石炉：无配方时黄灯（等燃料），电炉：无配方时红灯
DEVICE_STATUS['stone-furnace'] = e => e.lit ? (e.cur ? 'g' : 'y') : 'r';
DEVICE_STATUS['electric-furnace'] = e => e.lit ? (e.cur ? 'g' : 'r') : 'r';
const furnacePanel = { html: furnacePanelHtml, live: furnacePanelLive, tip: furnaceTip };
DEVICE_PANEL['stone-furnace'] = furnacePanel;
DEVICE_PANEL['electric-furnace'] = furnacePanel;
