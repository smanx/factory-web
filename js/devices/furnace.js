'use strict';

// ===== 熔炉粒子（画面优化）：燃烧时冒烟/迸火星 =====
// 用 G.entFxTimer 按实体位置节流，避免每帧都生成。石炉/钢炉冒橙烟+火星，电炉冒淡绿烟。
function furnaceEmit(e, dt) {
  if (typeof spawnSmoke !== 'function' || typeof spawnSpark !== 'function') return;
  const key = e.x + ',' + e.y;
  if (!G.entFxTimer) G.entFxTimer = {};
  const t = G.entFxTimer[key] || 0;
  G.entFxTimer[key] = t + dt;
  if (G.entFxTimer[key] < 0.18) return;   // 节流：约每秒 5 次
  G.entFxTimer[key] = 0;
  const electric = e.type === 'electric-furnace';
  const cx = (e.x + 0.5) * TILE;
  const cy = (e.y + 0.3) * TILE;
  if (electric) {
    spawnSteam(cx + (Math.random() - 0.5) * e.w * TILE * 0.4, cy, { size: 3, color: '#b8e8c8' });
  } else {
    spawnSmoke(cx + (Math.random() - 0.5) * e.w * TILE * 0.4, cy, { size: 4, color: '#9a8a80' });
    if (Math.random() < 0.5) spawnSpark(cx + (Math.random() - 0.5) * e.w * TILE * 0.4, cy + 4, { speed: 1.5, color: '#ff9a3a' });
  }
}

// ===== 石炉：烧煤冶炼 =====
class Furnace extends Entity {
  constructor(type, x, y) {
    super(type || 'stone-furnace', x, y);
    this.fuelCoal = 0;
    this.fuelSolid = 0;
    this.fuelRocket = 0;
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
      if (this.fuelRocket > 0) {
        this.fuelRocket--;
        if (typeof trackProd === 'function') trackProd('rocket-fuel', -1);
        this.burnLeft += ROCKET_FUEL_ENERGY;
      } else if (this.fuelSolid > 0) {
        this.fuelSolid--;
        if (typeof trackProd === 'function') trackProd('solid-fuel', -1);
        this.burnLeft += SOLID_FUEL_ENERGY;
      } else if (this.fuelCoal > 0) {
        this.fuelCoal--;
        if (typeof trackProd === 'function') trackProd('coal', -1);
        this.burnLeft += COAL_ENERGY;
      }
      else { this.lit = false; return; }
    }
    this.lit = true;
    this.burnLeft -= dt;
    furnaceEmit(this, dt);
    this.prog += dt / r.time;
    if (this.prog >= 1) {
      this.prog -= 1;
      this.inp[r.inp] = (this.inp[r.inp] || 0) - (r.inCount || 1);
      if (typeof trackProd === 'function') trackProd(r.inp, -(r.inCount || 1));
      if (this.inp[r.inp] <= 0) delete this.inp[r.inp];
      this.outp[r.id] = (this.outp[r.id] || 0) + 1;
      if (typeof trackProd === 'function') trackProd(r.id, 1);
    }
  }
  giveItem(item) {
    if (item === 'rocket-fuel' && this.fuelRocket < 20) { this.fuelRocket++; return true; }
    if (item === 'coal' && this.fuelCoal < 20) { this.fuelCoal++; return true; }
    if (item === 'solid-fuel' && this.fuelSolid < 20) { this.fuelSolid++; return true; }
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
    if (this.fuelRocket > 0) list.push(['rocket-fuel', this.fuelRocket]);
    if (this.fuelSolid > 0) list.push(['solid-fuel', this.fuelSolid]);
    if (this.fuelCoal > 0) list.push(['coal', this.fuelCoal]);
    for (const k in this.inp) list.push([k, this.inp[k]]);
    for (const k in this.outp) list.push([k, this.outp[k]]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.fuelCoal = this.fuelCoal; s.fuelSolid = this.fuelSolid; s.fuelRocket = this.fuelRocket; s.burnLeft = this.burnLeft;
    s.inp = this.inp; s.outp = this.outp; s.prog = this.prog;
    return s;
  }
  static restore(s) {
    const f = super.restore(s);
    f.fuelCoal = s.fuelCoal || 0; f.fuelSolid = s.fuelSolid || 0; f.fuelRocket = s.fuelRocket || 0; f.burnLeft = s.burnLeft || 0;
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
  if (eFurn) {
    h += row('电力', powerStatusLiveHtml(e), 'power');
  } else {
    h += row('燃料', (e.fuelRocket > 0 ? chip('rocket-fuel', e.fuelRocket) + ' ' : '') + (e.fuelSolid > 0 ? chip('solid-fuel', e.fuelSolid) + ' ' : '') + (e.fuelCoal > 0 ? chip('coal', e.fuelCoal) : '<span class="dim">无</span>'), 'fuel');
    if (invCount('coal') > 0)
      h += '<button data-action="fuel" data-id="coal">加 5 煤 (' + invCount('coal') + ')</button>';
    if (invCount('solid-fuel') > 0)
      h += '<button data-action="fuel" data-id="solid-fuel">加 5 固体燃料 (' + invCount('solid-fuel') + ')</button>';
    if (invCount('rocket-fuel') > 0)
      h += '<button data-action="fuel" data-id="rocket-fuel">加 5 火箭燃料 (' + invCount('rocket-fuel') + ')</button>';
  }
  // 消耗/产出速率显示在面板靠前位置（电力/燃料行之后）
  h += '<div id="mach-rate-block"></div>';
  // 模块槽位（仅电炉，对齐《异星工厂》：电炉可装 2 模块）
  if (eFurn) h += modulePanelSection(e);
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
  if (eFurn) api.set('power', powerStatusLiveHtml(e));
  if (!eFurn) api.set('fuel', (e.fuelRocket > 0 ? chip('rocket-fuel', e.fuelRocket) + ' ' : '') + (e.fuelSolid > 0 ? chip('solid-fuel', e.fuelSolid) + ' ' : '') + (e.fuelCoal > 0 ? chip('coal', e.fuelCoal) : dimSpan('无')));
  api.set('input', Object.keys(e.inp).length ? countStr(e.inp) : dimSpan('空'));
  api.set('output', Object.keys(e.outp).length ? countStr(e.outp) : dimSpan('空'));
  const n = Object.values(e.outp).reduce((a, b) => a + b, 0);
  api.toggle('#btn-takeout', n > 0, '取回全部输出 (' + n + ')');
  api.prog(e.prog * 100);
  // 当前冶炼项的消耗/产出速率（石炉×1、电炉×2，对齐《异星工厂》crafting-speed）
  const rateEl = body.querySelector('#mach-rate-block');
  if (rateEl) {
    const mult = eFurn ? 2 * e.moduleSpeedMult() : 1;
    const rec = e.cur ? { time: e.cur.time, inp: { [e.cur.inp]: e.cur.inCount || 1 }, out: { [e.cur.id]: 1 } } : null;
    const html = rec ? machRateHtml(rec, mult) : '';
    if (rateEl.innerHTML !== html) rateEl.innerHTML = html;
  }
  if (eFurn) {
    if (e.lit) api.status('冶炼中', 'ok');
    else if (e.cur && G.power.sat <= 0) api.status('已暂停：缺电', 'bad');
    else api.status('已暂停：待料（放入矿石）', 'warn');
  } else {
    if (e.lit) api.status('冶炼中', 'ok');
    else if (e.cur) api.status('已暂停：等待燃料（加入煤/固体燃料/火箭燃料）', 'warn');
    else api.status('已暂停：待料（放入燃料和矿石）', 'warn');
  }
}
function furnaceTip(e) {
  const base = e.lit ? '冶炼中' : ((Object.keys(e.inp).length || e.fuelCoal > 0) ? '待料' : '空置，需放入燃料和矿石');
  // 电炉：电量不足（正在耗电且 sat<1）时在提示中注明
  if (e instanceof ElectricFurnace) {
    const s = powerStatusOf(e);
    if (s.consuming && s.sat < 1) return base + '；' + (s.sat > 0 ? '电量不足' + Math.round(s.sat * 100) + '%' : '缺电停摆');
  }
  return base;
}

// ===== 注册 =====
ENT_CLASSES['stone-furnace'] = Furnace;
DEVICE_RENDER['stone-furnace'] = drawFurnace;
DEVICE_RENDER['electric-furnace'] = drawFurnace;
// 石炉：无配方时黄灯（等燃料），电炉：无配方时红灯
DEVICE_STATUS['stone-furnace'] = e => e.lit ? (e.cur ? 'g' : 'y') : 'r';
// 电炉：正在耗电且电量不足（sat<1）时亮黄灯提示；缺电停摆时红灯；未耗电时按是否冶炼显红/绿
DEVICE_STATUS['electric-furnace'] = e => {
  const s = powerStatusOf(e);
  return s.consuming ? s.color : (e.lit ? (e.cur ? 'g' : 'r') : 'r');
};
const furnacePanel = { html: furnacePanelHtml, live: furnacePanelLive, tip: furnaceTip };
DEVICE_PANEL['stone-furnace'] = furnacePanel;
DEVICE_PANEL['electric-furnace'] = furnacePanel;
