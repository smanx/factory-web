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
    this.fuelWood = 0;
    this.burnLeft = 0;
    this.inp = {};
    this.outp = {};
    this.cur = null;
    this.prog = 0;
    this.lit = false;
  }
  pickRecipe() {
    // 熔炉例外（不遵循「堆积即停工」）：持续工作直到产物堆满一整组 Stack 为止
    for (const r of SMELTS)
      if ((this.inp[r.inp] || 0) >= (r.inCount || 1) && (this.outp[r.id] || 0) < stackSize(r.id)) return r;
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
    this.prog += dt / r.time * (this.quality ? qualityMult(this.quality) : 1);
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
    if (this.fuelWood > 0) list.push(['wood', this.fuelWood]);
    for (const k in this.inp) list.push([k, this.inp[k]]);
    for (const k in this.outp) list.push([k, this.outp[k]]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.fuelCoal = this.fuelCoal; s.fuelSolid = this.fuelSolid; s.fuelRocket = this.fuelRocket; s.fuelWood = this.fuelWood; s.burnLeft = this.burnLeft;
    s.inp = this.inp; s.outp = this.outp; s.prog = this.prog;
    return s;
  }
  static restore(s) {
    const f = super.restore(s);
    f.fuelCoal = s.fuelCoal || 0; f.fuelSolid = s.fuelSolid || 0; f.fuelRocket = s.fuelRocket || 0; f.fuelWood = s.fuelWood || 0; f.burnLeft = s.burnLeft || 0;
    f.inp = s.inp || {}; f.outp = s.outp || {}; f.prog = s.prog || 0;
    return f;
  }
}

// 轻量色彩工具（仅在炉子渲染中用到）：把 #rrggbb 与 0~1 比例混合到 alpha
function _furnMix(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + t.toFixed(3) + ')';
}
// 通用炉子渲染配色（按 e.type 切换石炉/电炉，钢炉在 steel-furnace.js 单独实现）
function _furnTierOf(e) {
  if (e.type === 'electric-furnace') return {
    label: 'ELEC',
    body: ['#4fb078', '#2f8a5a', '#1a5a3a'],         // 科技绿渐变
    line: '#0e3826', inner: '#1d6845',
    fireCore: '#a8f4c4', fireMid: '#5fd890', fireOut: '#1a8a4a', glow: 'rgba(80,240,140,',
    cap: '#7edca0', coilHi: 'rgba(220,255,230,',     // 顶部感应圈高光
    bolt: '#0a2618', boltHi: 'rgba(180,240,200,0.45)',
    ledOn: '#9ce06c', ledOff: '#1a3a26',
    big: true, noFuel: true,                          // 3×3 大尺寸，无燃料条
  };
  // 石炉 2×2
  return {
    label: 'STONE',
    body: ['#a89274', '#7e6a4e', '#503e2a'],         // 陶土黄/砖石色渐变
    line: '#2e2418', inner: '#5a4830',
    fireCore: '#fff0a0', fireMid: '#ff9a3a', fireOut: '#c84a18', glow: 'rgba(255,160,60,',
    cap: '#5a4830', coilHi: 'rgba(255,200,120,',
    bolt: '#1a1208', boltHi: 'rgba(255,200,120,0.4)',
    ledOn: '#ffb04a', ledOff: '#3a2a18',
    big: false, noFuel: false,                        // 2×2 小尺寸
  };
}
// 通用炉子渲染：石炉/电炉共用绘制主体
// 视觉分区（自下而上）：
//   ① 罐底阴影 + 基座  ② 主外壳（顶亮底暗渐变）
//   ③ 砖石/金属筋板纹理  ④ 顶部烟囱/感应圈
//   ⑤ 中央炉膛（玻璃 + 内部火焰/等离子 + 进度文字）
//   ⑥ 状态 LED + 燃料条（仅石炉/钢炉）
//   ⑦ 4 角螺栓  ⑧ 罐体外框
function drawFurnace(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w, sh = TILE * e.h;
  const cx = px + s / 2;
  ctx.globalAlpha = alpha;
  const tier = _furnTierOf(e);
  const working = e.lit && e.cur;
  const fl = 0.55 + Math.sin((G.time || 0) * 10 + px) * 0.25;     // 火焰闪烁
  const heat = working ? (0.55 + fl * 0.35) : 0.10;                 // 炉膛亮度

  // ① 罐底阴影 + 基座
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath();
  ctx.ellipse(cx, py + sh - 2, s * 0.42, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = tier.line;
  rr(ctx, px + 5, py + sh - 11, s - 10, 8, 3); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(px + 9, py + sh - 6, s - 18, 0.8);

  // ② 主外壳（顶亮底暗渐变）
  const bodyGrad = ctx.createLinearGradient(0, py + 4, 0, py + sh - 4);
  bodyGrad.addColorStop(0,    tier.body[0]);
  bodyGrad.addColorStop(0.5,  tier.body[1]);
  bodyGrad.addColorStop(1,    tier.body[2]);
  ctx.fillStyle = bodyGrad;
  const bodyR = tier.big ? 10 : 7;
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, bodyR); ctx.fill();

  // ③ 砖石/金属筋板纹理
  if (e.type === 'electric-furnace') {
    // 金属筋板（左右各 3 条）
    const ribXs = [px + s * 0.16, px + s * 0.32, px + s * 0.50 - 1,
                   px + s * 0.50 + 1, px + s * 0.68, px + s * 0.84];
    for (let i = 0; i < ribXs.length; i++) {
      const darkSide = (i % 2 === 0);
      ctx.fillStyle = darkSide ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.10)';
      ctx.fillRect(ribXs[i], py + 26, 1.4, sh - 50);
    }
  } else {
    // 砖石纹理：3 行错位砖块
    const brickH = (sh - 26) / 3.5;
    for (let r = 0; r < 3; r++) {
      const by = py + 14 + r * brickH;
      const offset = (r % 2 === 0) ? 0 : brickH * 0.5;
      // 横向灰浆线
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      ctx.fillRect(px + 6, by, s - 12, 1);
      // 竖向灰浆线（错位）
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      let bx = px + 6 - offset;
      while (bx < px + s - 6) {
        ctx.fillRect(bx, by, 1, brickH);
        bx += brickH;
      }
    }
  }

  // ④ 顶部装饰
  if (e.type === 'electric-furnace') {
    // 双感应圈（线圈缠绕的圆筒）
    const drawCoil = (cx0) => {
      // 底座
      ctx.fillStyle = tier.line;
      rr(ctx, cx0 - 9, py + 10, 18, 6, 1.5); ctx.fill();
      // 圆筒
      ctx.fillStyle = tier.body[0];
      rr(ctx, cx0 - 7, py + 4, 14, 9, 1.5); ctx.fill();
      ctx.strokeStyle = tier.line;
      ctx.lineWidth = 0.8;
      rr(ctx, cx0 - 7, py + 4, 14, 9, 1.5); ctx.stroke();
      // 线圈（4 圈铜色金属丝）
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = (i % 2 === 0) ? '#d8a648' : '#a07828';
        ctx.fillRect(cx0 - 7 + i * 4, py + 4, 1.4, 9);
      }
      // 顶部高光
      ctx.fillStyle = tier.coilHi + '0.7)';
      ctx.fillRect(cx0 - 6, py + 5, 12, 0.8);
      // 通电时辉光
      if (working) {
        const gfl = 0.4 + Math.sin((G.time || 0) * 14 + cx0) * 0.3;
        ctx.fillStyle = tier.glow + (gfl * 0.55).toFixed(2) + ')';
        rr(ctx, cx0 - 9, py + 3, 18, 11, 2); ctx.fill();
      }
    };
    drawCoil(px + s * 0.30);
    drawCoil(px + s * 0.70);
  } else {
    // 单烟囱（石炉：短粗的陶土烟囱）
    const sxC = cx;
    // 烟囱底座
    ctx.fillStyle = tier.line;
    rr(ctx, sxC - 7, py + 13, 14, 5, 1.5); ctx.fill();
    // 烟囱主体
    const stackGrad = ctx.createLinearGradient(sxC - 6, 0, sxC + 6, 0);
    stackGrad.addColorStop(0,   '#3a2e1c');
    stackGrad.addColorStop(0.5, '#7a6244');
    stackGrad.addColorStop(1,   '#3a2e1c');
    ctx.fillStyle = stackGrad;
    rr(ctx, sxC - 6, py + 5, 12, 9, 1.5); ctx.fill();
    // 烟囱顶冠
    ctx.fillStyle = tier.cap;
    rr(ctx, sxC - 7, py + 4, 14, 3, 1); ctx.fill();
    ctx.strokeStyle = tier.line;
    ctx.lineWidth = 0.6;
    rr(ctx, sxC - 7, py + 4, 14, 3, 1); ctx.stroke();
    // 烟囱口（暗内孔）
    ctx.fillStyle = '#1a1208';
    ctx.fillRect(sxC - 4, py + 5, 8, 1);
    // 烟囱中段高光
    ctx.fillStyle = 'rgba(255,255,255,0.20)';
    ctx.fillRect(sxC - 5, py + 7, 0.8, 5);
  }

  // ⑤ 中央炉膛（深色凹陷 + 内部火焰/等离子 + 玻璃高光）
  const wcX = tier.big ? px + 12 : px + 9;
  const wcY = tier.big ? py + 26 : py + 24;
  const wcW = s - (tier.big ? 24 : 18);
  const wcH = sh - (tier.big ? 50 : 42);
  // 炉膛外框（深色金属边）
  ctx.fillStyle = tier.line;
  rr(ctx, wcX, wcY, wcW, wcH, 4); ctx.fill();
  // 炉膛内底
  ctx.save();
  rr(ctx, wcX + 1.5, wcY + 1.5, wcW - 3, wcH - 3, 3); ctx.clip();
  // 底色（深色焦痕/玻璃后）
  ctx.fillStyle = 'rgba(8, 6, 4, 0.85)';
  ctx.fillRect(wcX + 1.5, wcY + 1.5, wcW - 3, wcH - 3);
  // 火焰/等离子填充
  if (heat > 0.15) {
    const fireY = wcY + wcH * (1 - heat * 0.8);
    const fireH = wcH * heat * 0.8;
    const fireGrad = ctx.createLinearGradient(0, fireY, 0, wcY + wcH);
    if (e.type === 'electric-furnace') {
      // 绿能等离子：核心白绿→边缘墨绿
      fireGrad.addColorStop(0,   _furnMix(tier.fireCore, 0.90));
      fireGrad.addColorStop(0.4, _furnMix(tier.fireMid, 0.75));
      fireGrad.addColorStop(1,   _furnMix(tier.fireOut, 0.30));
    } else {
      // 橙红火焰：核心白黄→边缘焦红
      fireGrad.addColorStop(0,   _furnMix(tier.fireCore, 0.95));
      fireGrad.addColorStop(0.4, _furnMix(tier.fireMid, 0.80));
      fireGrad.addColorStop(1,   _furnMix(tier.fireOut, 0.30));
    }
    ctx.fillStyle = fireGrad;
    ctx.fillRect(wcX + 1.5, fireY, wcW - 3, fireH);
    // 表面波纹
    if (working) {
      const w1 = Math.sin((G.time || 0) * 6 + px) * 1.2;
      ctx.fillStyle = e.type === 'electric-furnace'
        ? 'rgba(220,255,230,0.55)'
        : 'rgba(255,220,120,0.55)';
      ctx.fillRect(wcX + 2, fireY + w1, wcW - 4, 1.2);
    }
  }
  ctx.restore();
  // 炉膛亮边
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 0.9;
  rr(ctx, wcX, wcY, wcW, wcH, 4); ctx.stroke();
  // 玻璃左上高光（新月形）
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(wcX + 4, wcY + 4, Math.min(wcW, wcH) * 0.35, Math.PI * 1.1, Math.PI * 1.55);
  ctx.stroke();

  // ALT 模式：炉膛中央显示当前冶炼产品图标（熔炉无固定配方，直接显示当前产物）
  if (portDetailsVisible() && e.cur) {
    drawRecipeIconCell(ctx, cx, wcY + wcH / 2, e.cur.id);
  }

  // ⑤b 进度文字（炉膛上方，冶炼中显示百分比）
  if (e.cur && e.prog > 0) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // 描边（让白字在亮背景上仍可读）
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 2.5;
    ctx.strokeText(Math.floor(e.prog * 100) + '%', cx, py + 14);
    ctx.fillText(Math.floor(e.prog * 100) + '%', cx, py + 14);
  }

  // ⑥ 状态 LED（仅大尺寸电炉显示在左下角）
  if (tier.big) {
    const ledY = py + sh - 17;
    const on = !!e.lit;
    ctx.fillStyle = on ? tier.ledOn : tier.ledOff;
    ctx.beginPath(); ctx.arc(px + 14, ledY, 1.8, 0, Math.PI * 2); ctx.fill();
    if (on) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(px + 13.5, ledY - 0.5, 0.6, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ⑥b 燃料条（石炉/钢炉专用；按 burnLeft / COAL_ENERGY 比例填充）
  if (!tier.noFuel) {
    const fuelY = py + sh - 12;
    const fuelW = s - 20;
    ctx.fillStyle = '#20242b';
    rr(ctx, px + 10, fuelY, fuelW, 5, 2); ctx.fill();
    const fuelPct = Math.min(1, e.burnLeft / COAL_ENERGY);
    ctx.fillStyle = fuelPct > 0 ? '#e8762c' : '#c33';
    rr(ctx, px + 10, fuelY, fuelW * fuelPct, 5, 2); ctx.fill();
    // 燃料条高光
    if (fuelPct > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.30)';
      ctx.fillRect(px + 11, fuelY, fuelW * fuelPct - 2, 1.2);
    }
  }

  // ⑦ 角部螺栓（电炉用 4 角，石炉因空间小只用 2 上角）
  const drawBolt = (bx, by) => {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.arc(bx, by, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = tier.bolt;
    ctx.beginPath(); ctx.arc(bx, by, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = tier.boltHi;
    ctx.beginPath(); ctx.arc(bx - 0.4, by - 0.4, 0.7, 0, Math.PI * 2); ctx.fill();
  };
  if (tier.big) {
    drawBolt(px + 9,        py + 9);
    drawBolt(px + s - 9,     py + 9);
    drawBolt(px + 9,        py + sh - 9);
    drawBolt(px + s - 9,     py + sh - 9);
  } else {
    drawBolt(px + 7, py + 9);
    drawBolt(px + s - 7, py + 9);
  }

  // ⑧ 罐体外框描边（最上层）
  ctx.strokeStyle = tier.line;
  ctx.lineWidth = 2.2;
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, bodyR); ctx.stroke();
  // 顶部圆弧高光（电炉不绘制：其弧形高光在顶部形似 loading 半环，按要求移除）
  if (e.type !== 'electric-furnace') {
    ctx.strokeStyle = 'rgba(255,255,255,0.22)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, py + 4, s * 0.32, Math.PI * 1.05, Math.PI * 1.95);
    ctx.stroke();
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
    h += row('燃料', (e.fuelRocket > 0 || e.fuelSolid > 0 || e.fuelCoal > 0 || e.fuelWood > 0) ? '<div class="asm3-inp-row">' + itemSlotsHtml({ 'rocket-fuel': e.fuelRocket, 'solid-fuel': e.fuelSolid, 'coal': e.fuelCoal, 'wood': e.fuelWood }, { action: 'display' }) + '</div>' : '<span class="dim">无</span>', 'fuel');
    if (invCount('coal') > 0)
      h += '<button data-action="fuel" data-id="coal">加 5 煤 (' + invCount('coal') + ')</button>';
    if (invCount('wood') > 0)
      h += '<button data-action="fuel" data-id="wood">加 5 木材 (' + invCount('wood') + ')</button>';
    if (invCount('solid-fuel') > 0)
      h += '<button data-action="fuel" data-id="solid-fuel">加 5 固体燃料 (' + invCount('solid-fuel') + ')</button>';
    if (invCount('rocket-fuel') > 0)
      h += '<button data-action="fuel" data-id="rocket-fuel">加 5 火箭燃料 (' + invCount('rocket-fuel') + ')</button>';
  }
  // 消耗/产出速率显示在面板靠前位置（电力/燃料行之后）
  h += '<div id="mach-rate-block"></div>';
  // 模块槽位（仅电炉，对齐《异星工厂》：电炉可装 2 模块）
  if (eFurn) h += modulePanelSection(e);
  h += row('输入', Object.keys(e.inp).length ? '<div class="asm3-inp-row">' + itemSlotsHtml(e.inp, { action: 'feed-slot' }) + '</div>' : '<span class="dim">空</span>', 'input');
  for (const r of SMELTS) {
    const n = Math.min(invCount(r.inp), 50 - (e.inp[r.inp] || 0));
    if (n > 0) h += '<button data-action="feed" data-id="' + r.inp + '">放入' +
      ITEMS[r.inp].name + ' ×' + n + '</button>';
  }
  if (Object.keys(e.inp).length) h += '<button data-action="takein">取回全部输入</button>';
  h += row('输出', Object.keys(e.outp).length ? '<div class="asm3-inp-row">' + itemSlotsHtml(e.outp, { action: 'take-slot' }) + '</div>' : '<span class="dim">空</span>', 'output');
  h += '<button data-action="takeout" id="btn-takeout" style="display:none"></button>';
  return h;
}
function furnacePanelLive(e, api) {
  const eFurn = e instanceof ElectricFurnace;
  if (eFurn) api.set('power', powerStatusLiveHtml(e));
  if (!eFurn) api.set('fuel', (e.fuelRocket > 0 || e.fuelSolid > 0 || e.fuelCoal > 0 || e.fuelWood > 0) ? '<div class="asm3-inp-row">' + itemSlotsHtml({ 'rocket-fuel': e.fuelRocket, 'solid-fuel': e.fuelSolid, 'coal': e.fuelCoal, 'wood': e.fuelWood }, { action: 'display' }) + '</div>' : dimSpan('无'));
  api.set('input', Object.keys(e.inp).length ? '<div class="asm3-inp-row">' + itemSlotsHtml(e.inp, { action: 'feed-slot' }) + '</div>' : dimSpan('空'));
  api.set('output', Object.keys(e.outp).length ? '<div class="asm3-inp-row">' + itemSlotsHtml(e.outp, { action: 'take-slot' }) + '</div>' : dimSpan('空'));
  const n = Object.values(e.outp).reduce((a, b) => a + b, 0);
  api.toggle('#btn-takeout', n > 0, '取回全部输出 (' + n + ')');
  api.prog(e.prog * 100, e.cur ? e.cur.time : 0);
  // 当前冶炼项的消耗/产出速率（石炉×1、电炉×官方 crafting_speed=2，对齐《异星工厂》crafting-speed）
  const rateEl = document.getElementById('mach-rate-block');
  if (rateEl) {
    const mult = eFurn ? (GAME_DATA.deviceStats?.[e.type]?.craftingSpeed ?? 2) * e.moduleSpeedMult() : 1;
    const rec = e.cur ? { time: e.cur.time, inp: { [e.cur.inp]: e.cur.inCount || 1 }, out: { [e.cur.id]: 1 } } : null;
    const html = rec ? machRateHtml(rec, mult) : '';
    if (rateEl.innerHTML !== html) rateEl.innerHTML = html;
  }
  // 熔炉例外：持续工作直到产物堆满一整组（Stack）为止，满组即待料
  const outFullStack = Object.keys(e.outp).some(k => (e.outp[k] || 0) >= stackSize(k));
  if (eFurn) {
    if (e.lit) api.status('冶炼中', 'ok');
    else if (e.cur && outFullStack) api.status('已暂停：产物已满一整组', 'warn');
    else if (e.cur && G.power.sat <= 0) api.status('已暂停：缺电', 'bad');
    else api.status('已暂停：待料（放入矿石）', 'warn');
  } else {
    if (e.lit) api.status('冶炼中', 'ok');
    else if (e.cur && outFullStack) api.status('已暂停：产物已满一整组', 'warn');
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
DEVICE_DIR_ROTATE['stone-furnace'] = true; // 支持旋转
DEVICE_RENDER['electric-furnace'] = drawFurnace;
DEVICE_DIR_ROTATE['electric-furnace'] = true; // 支持旋转
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
