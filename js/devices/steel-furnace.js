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
      } else if (this.fuelWood > 0) {
        this.fuelWood--;
        if (typeof trackProd === 'function') trackProd('wood', -1);
        this.burnLeft += WOOD_FUEL_ENERGY;
      }
      else { this.lit = false; return; }
    }
    this.lit = true;
    this.burnLeft -= dt * fuelConsumptionMult();
    furnaceEmit(this, dt);
    this.prog += dt / r.time * (GAME_DATA.deviceStats?.[this.type]?.craftingSpeed ?? 2) * (this.quality ? qualityMult(this.quality) : 1);
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
    if (item === 'rocket-fuel' && this.fuelRocket < fuelLimitFor5s(ROCKET_FUEL_ENERGY)) { this.fuelRocket++; return true; }
    if (item === 'coal' && this.fuelCoal < fuelLimitFor5s(COAL_ENERGY)) { this.fuelCoal++; return true; }
    if (item === 'wood' && this.fuelWood < fuelLimitFor5s(WOOD_FUEL_ENERGY)) { this.fuelWood++; return true; }
    if (item === 'solid-fuel' && this.fuelSolid < fuelLimitFor5s(SOLID_FUEL_ENERGY)) { this.fuelSolid++; return true; }
    // 产物已满一整组（Stack）时不再接收矿石：继续送只会白白堆积在熔炉里
    for (const r of SMELTS)
      if (r.inp === item && (this.outp[r.id] || 0) >= stackSize(r.id)) return false;
    for (const r of SMELTS)
      if (r.inp === item && (this.inp[item] || 0) < (r.inCount || 1) * 2) { this.inp[item] = (this.inp[item] || 0) + 1; return true; }
    return false;
  }
}

// ===== 渲染（钢铁炉：钢蓝金属色，2×2 工业质感）=====
// 与石炉共用同一套绘制骨架（_steelFurnTierOf 配置 + drawSteelFurnace 复用主流程），
// 但配色换成钢蓝金属 + 双烟囱（高速炉的标志），与石炉一眼可分。
function _steelFurnTier() {
  return {
    body: ['#9aacc0', '#5e738a', '#2e3e54'],         // 钢蓝渐变
    line: '#1a2434', inner: '#3e526a',
    fireCore: '#fff4c0', fireMid: '#ffb05a', fireOut: '#e05828', glow: 'rgba(255,180,90,',
    cap: '#7a8aa0', coilHi: 'rgba(220,235,255,',
    bolt: '#0e1828', boltHi: 'rgba(180,210,240,0.45)',
    ledOn: '#a8d8ff', ledOff: '#1a2840',
  };
}
function drawSteelFurnace(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w, sh = TILE * e.h;
  const cx = px + s / 2;
  ctx.globalAlpha = alpha;
  const t = _steelFurnTier();
  const working = e.lit && e.cur;
  const fl = 0.55 + Math.sin((G.time || 0) * 10 + px) * 0.25;
  const heat = working ? (0.55 + fl * 0.35) : 0.10;

  // ① 罐底阴影 + 基座
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath();
  ctx.ellipse(cx, py + sh - 2, s * 0.42, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = t.line;
  rr(ctx, px + 5, py + sh - 11, s - 10, 8, 3); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(px + 9, py + sh - 6, s - 18, 0.8);

  // ② 主外壳（钢蓝渐变）
  const bodyGrad = ctx.createLinearGradient(0, py + 4, 0, py + sh - 4);
  bodyGrad.addColorStop(0,   t.body[0]);
  bodyGrad.addColorStop(0.5, t.body[1]);
  bodyGrad.addColorStop(1,   t.body[2]);
  ctx.fillStyle = bodyGrad;
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 7); ctx.fill();

  // ③ 金属筋板（左右各 2 条，明暗交替）
  const ribXs = [px + s * 0.22, px + s * 0.50 - 1, px + s * 0.50 + 1, px + s * 0.78];
  for (let i = 0; i < ribXs.length; i++) {
    const darkSide = (i === 0 || i === 3);
    ctx.fillStyle = darkSide ? 'rgba(0,0,0,0.25)' : (i === 1 ? 'rgba(0,0,0,0.20)' : 'rgba(255,255,255,0.10)');
    ctx.fillRect(ribXs[i], py + 24, 1.4, sh - 48);
    ctx.fillStyle = darkSide ? 'rgba(255,255,255,0.10)' : (i === 1 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.18)');
    ctx.fillRect(ribXs[i] + (darkSide ? 1.4 : -0.5), py + 24, 0.5, sh - 48);
  }

  // ④ 顶部双烟囱（钢制高速炉的标志：两个并排烟囱）
  const drawSteelStack = (sxC) => {
    // 烟囱底座
    ctx.fillStyle = t.line;
    rr(ctx, sxC - 5, py + 12, 10, 4, 1.2); ctx.fill();
    // 烟囱主体（钢制渐变）
    const stackGrad = ctx.createLinearGradient(sxC - 4, 0, sxC + 4, 0);
    stackGrad.addColorStop(0,   '#2a3a50');
    stackGrad.addColorStop(0.5, '#6a82a0');
    stackGrad.addColorStop(1,   '#2a3a50');
    ctx.fillStyle = stackGrad;
    rr(ctx, sxC - 4, py + 4, 8, 9, 1.2); ctx.fill();
    // 烟囱顶冠（外扩）
    ctx.fillStyle = t.cap;
    rr(ctx, sxC - 5, py + 3, 10, 3, 1); ctx.fill();
    ctx.strokeStyle = t.line;
    ctx.lineWidth = 0.5;
    rr(ctx, sxC - 5, py + 3, 10, 3, 1); ctx.stroke();
    // 烟囱口（暗内孔）
    ctx.fillStyle = '#0a1018';
    ctx.fillRect(sxC - 2.5, py + 4, 5, 1);
    // 中段高光
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(sxC - 3.5, py + 6, 0.6, 5);
  };
  drawSteelStack(px + s * 0.36);
  drawSteelStack(px + s * 0.64);

  // ⑤ 中央炉膛（与石炉一致的玻璃 + 火焰结构，但更亮更热）
  const wcX = px + 9, wcY = py + 24;
  const wcW = s - 18, wcH = sh - 42;
  ctx.fillStyle = t.line;
  rr(ctx, wcX, wcY, wcW, wcH, 4); ctx.fill();
  ctx.save();
  rr(ctx, wcX + 1.5, wcY + 1.5, wcW - 3, wcH - 3, 3); ctx.clip();
  ctx.fillStyle = 'rgba(8, 6, 4, 0.85)';
  ctx.fillRect(wcX + 1.5, wcY + 1.5, wcW - 3, wcH - 3);
  // 火焰（更亮、更宽：因为钢铁炉温度更高）
  if (heat > 0.15) {
    const fireY = wcY + wcH * (1 - heat * 0.85);
    const fireH = wcH * heat * 0.85;
    const fireGrad = ctx.createLinearGradient(0, fireY, 0, wcY + wcH);
    fireGrad.addColorStop(0,   _steelFurnMix(t.fireCore, 0.98));
    fireGrad.addColorStop(0.4, _steelFurnMix(t.fireMid, 0.85));
    fireGrad.addColorStop(1,   _steelFurnMix(t.fireOut, 0.30));
    ctx.fillStyle = fireGrad;
    ctx.fillRect(wcX + 1.5, fireY, wcW - 3, fireH);
    if (working) {
      const w1 = Math.sin((G.time || 0) * 6 + px) * 1.2;
      ctx.fillStyle = 'rgba(255,230,150,0.6)';
      ctx.fillRect(wcX + 2, fireY + w1, wcW - 4, 1.2);
    }
  }
  ctx.restore();
  // 炉膛亮边
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 0.9;
  rr(ctx, wcX, wcY, wcW, wcH, 4); ctx.stroke();
  // 玻璃左上高光
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(wcX + 4, wcY + 4, Math.min(wcW, wcH) * 0.35, Math.PI * 1.1, Math.PI * 1.55);
  ctx.stroke();

  // ⑤b 进度文字（与石炉一致：白字 + 黑色描边）
  if (e.cur && e.prog > 0) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 2.5;
    ctx.strokeText(Math.floor(e.prog * 100) + '%', cx, py + 14);
    ctx.fillText(Math.floor(e.prog * 100) + '%', cx, py + 14);
  }

  // ⑥ 燃料条（与石炉一致：按 burnLeft 比例填充）
  const fuelY = py + sh - 12;
  const fuelW = s - 20;
  ctx.fillStyle = '#20242b';
  rr(ctx, px + 10, fuelY, fuelW, 5, 2); ctx.fill();
  const fuelPct = Math.min(1, e.burnLeft / COAL_ENERGY);
  ctx.fillStyle = fuelPct > 0 ? '#e8762c' : '#c33';
  rr(ctx, px + 10, fuelY, fuelW * fuelPct, 5, 2); ctx.fill();
  if (fuelPct > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.fillRect(px + 11, fuelY, fuelW * fuelPct - 2, 1.2);
  }

  // ⑦ 角部螺栓（顶部 2 角）
  const drawBolt = (bx, by) => {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.arc(bx, by, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = t.bolt;
    ctx.beginPath(); ctx.arc(bx, by, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = t.boltHi;
    ctx.beginPath(); ctx.arc(bx - 0.4, by - 0.4, 0.7, 0, Math.PI * 2); ctx.fill();
  };
  drawBolt(px + 7, py + 9);
  drawBolt(px + s - 7, py + 9);

  // ⑧ 罐体外框描边
  ctx.strokeStyle = t.line;
  ctx.lineWidth = 2.2;
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 7); ctx.stroke();
  // 顶部圆弧高光
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, py + 4, s * 0.32, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();

  ctx.globalAlpha = 1;
}
function _steelFurnMix(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + t.toFixed(3) + ')';
}

// ===== 面板：复用石炉面板（燃料/输入/输出/进度），但状态文案标注钢铁炉=====
function steelFurnacePanelHtml(e) {
  let h = row('燃料', (e.fuelRocket > 0 || e.fuelSolid > 0 || e.fuelCoal > 0 || e.fuelWood > 0) ? '<div class="asm3-inp-row">' + itemSlotsHtml({ 'rocket-fuel': e.fuelRocket, 'solid-fuel': e.fuelSolid, 'coal': e.fuelCoal, 'wood': e.fuelWood }, { action: 'display' }) + '</div>' : '<span class="dim">无</span>', 'fuel');
  if (invCount('coal') > 0)
    h += '<button data-action="fuel" data-id="coal">加入 5 煤 (' + invCount('coal') + ')</button>';
  if (invCount('wood') > 0)
    h += '<button data-action="fuel" data-id="wood">加入 5 木材 (' + invCount('wood') + ')</button>';
  if (invCount('solid-fuel') > 0)
    h += '<button data-action="fuel" data-id="solid-fuel">加入 5 固体燃料 (' + invCount('solid-fuel') + ')</button>';
  if (invCount('rocket-fuel') > 0)
    h += '<button data-action="fuel" data-id="rocket-fuel">加入 5 火箭燃料 (' + invCount('rocket-fuel') + ')</button>';
  // 消耗/产出速率显示在面板靠前位置（燃料行之后）
  h += '<div id="mach-rate-block"></div>';
  h += row('输入', Object.keys(e.inp).length ? '<div class="asm3-inp-row">' + itemSlotsHtml(e.inp, { action: 'display' }) + '</div>' : '<span class="dim">空</span>', 'input');
  for (const r of SMELTS) {
    const n = Math.min(invCount(r.inp), 25 - (e.inp[r.inp] || 0));
    if (n > 0) h += '<button data-action="feed" data-id="' + r.inp + '">放入' +
      ITEMS[r.inp].name + ' ×' + n + '</button>';
  }
  if (Object.keys(e.inp).length) h += '<button data-action="takein">取回全部输入</button>';
  h += row('输出', Object.keys(e.outp).length ? '<div class="asm3-inp-row">' + itemSlotsHtml(e.outp, { action: 'take-slot' }) + '</div>' : '<span class="dim">空</span>', 'output');
  h += '<button data-action="takeout" id="btn-takeout" style="display:none"></button>';
  h += '<div class="dim">钢铁炉：烧煤冶炼，速度约为石炉的 2 倍，可高效产铁板/铜板/钢板（2×2）。</div>';
  return h;
}
function steelFurnacePanelLive(e, api) {
  api.set('fuel', (e.fuelRocket > 0 || e.fuelSolid > 0 || e.fuelCoal > 0 || e.fuelWood > 0) ? '<div class="asm3-inp-row">' + itemSlotsHtml({ 'rocket-fuel': e.fuelRocket, 'solid-fuel': e.fuelSolid, 'coal': e.fuelCoal, 'wood': e.fuelWood }, { action: 'display' }) + '</div>' : dimSpan('无'));
  api.set('input', Object.keys(e.inp).length ? '<div class="asm3-inp-row">' + itemSlotsHtml(e.inp, { action: 'display' }) + '</div>' : dimSpan('空'));
  api.set('output', Object.keys(e.outp).length ? '<div class="asm3-inp-row">' + itemSlotsHtml(e.outp, { action: 'take-slot' }) + '</div>' : dimSpan('空'));
  const n = Object.values(e.outp).reduce((a, b) => a + b, 0);
  api.toggle('#btn-takeout', n > 0, '取回全部输出 (' + n + ')');
  api.prog(e.prog * 100, e.cur ? e.cur.time : 0);
  // 当前冶炼项的消耗/产出速率（钢铁炉×官方 crafting_speed=2）
  const rateEl = document.getElementById('mach-rate-block');
  if (rateEl) {
    const rec = e.cur ? { time: e.cur.time, inp: { [e.cur.inp]: e.cur.inCount || 1 }, out: { [e.cur.id]: 1 } } : null;
    const html = rec ? machRateHtml(rec, GAME_DATA.deviceStats?.[e.type]?.craftingSpeed ?? 2) : '';
    if (rateEl.innerHTML !== html) rateEl.innerHTML = html;
  }
  if (e.lit) api.status('冶炼中（钢铁炉·高速）', 'ok');
  else if (e.cur) api.status('已暂停：等待燃料（加入煤/固体燃料/火箭燃料）', 'warn');
  else api.status('已暂停：待料（放入燃料和矿石）', 'warn');
}
function steelFurnaceTip(e) {
  return e.lit ? '冶炼中（钢铁炉·高速）' : ((Object.keys(e.inp).length || e.fuelCoal > 0) ? '待料' : '空置，需放入燃料和矿石');
}

// ===== 注册 =====
ENT_CLASSES['steel-furnace'] = SteelFurnace;
DEVICE_RENDER['steel-furnace'] = drawSteelFurnace;
DEVICE_DIR_ROTATE['steel-furnace'] = true; // 支持旋转
DEVICE_STATUS['steel-furnace'] = e => e.lit ? (e.cur ? 'g' : 'y') : 'r';
DEVICE_PANEL['steel-furnace'] = { html: steelFurnacePanelHtml, live: steelFurnacePanelLive, tip: steelFurnaceTip };
