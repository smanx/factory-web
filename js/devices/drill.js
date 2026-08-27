'use strict';

// ===== 采矿机粒子（画面优化）：工作时扬尘 =====
function drillEmit(e, dt) {
  if (typeof spawnSmoke !== 'function') return;
  const key = 'd' + e.x + ',' + e.y;
  if (!G.entFxTimer) G.entFxTimer = {};
  G.entFxTimer[key] = (G.entFxTimer[key] || 0) + dt;
  if (G.entFxTimer[key] < 0.3) return;
  G.entFxTimer[key] = 0;
  const cx = (e.x + 0.5) * TILE;
  const cy = (e.y + 0.7) * TILE;
  spawnSmoke(cx + (Math.random() - 0.5) * e.w * TILE * 0.5, cy, { size: 3, color: '#8a7a6a' });
}

// ===== 热能采矿机（采矿业基类；电采矿机/抽油机继承自 ElectricDrill）=====
class Drill extends Entity {
  constructor(type, x, y) {
    super(type || 'burner-mining-drill', x, y);
    this.fuelCoal = 0;
    this.fuelSolid = 0;
    this.fuelRocket = 0;
    this.fuelWood = 0;
    this.burnLeft = 0;
    this.burnCap = 0;      // 当前燃烧燃料的满能量（燃料消耗指示用）
    this.burnType = '';    // 当前燃烧燃料类型（coal/wood/solid-fuel/rocket-fuel）
    this.bufItem = null;
    this.buf = 0;
    this.prog = 0;
    this.working = false;
    this.status = '';
    this.spin = 0;
  }
  // 可开采的矿石索引：普通矿 0-4 + 铀矿 6（原油 5 由抽油机专用）。
  minableOreType(ti) { return (ti >= 0 && ti < ORES.length) || ti === ORE_URANIUM || ti === ORE_ASTEROID; }
  oreTile() {
    for (let dy = 0; dy < this.h; dy++)
      for (let dx = 0; dx < this.w; dx++) {
        const tx = this.x + dx, ty = this.y + dy;
        const ti = getOreType(tx, ty);
        if (this.minableOreType(ti) && getOreAmt(tx, ty) > 0) return [tx, ty];
      }
    return null;
  }
  mineItem(o) {
    const ti = getOreType(o[0], o[1]);
    // 小行星碎块矿床：按矿点坐标确定性返回同一种星块（金属/碳质/氧化），保证采矿机缓冲单类型
    if (ti === ORE_ASTEROID) return asteroidChunkFor(o[0], o[1]);
    return oreItemId(ti);
  }
  // 当前矿石的采矿时间（对齐《异星工厂》每种资源独立 mining_time）：无矿时用默认 DRILL_TIME。
  oreTime() {
    const o = this.oreTile();
    if (!o) return DRILL_TIME;
    return oreMiningTime(this.mineItem(o));
  }
  frontTargets() {
    const res = [];
    if (this.dir === 0) for (let dy = 0; dy < this.h; dy++) res.push([this.x + this.w, this.y + dy]);
    else if (this.dir === 2) for (let dy = 0; dy < this.h; dy++) res.push([this.x - 1, this.y + dy]);
    else if (this.dir === 1) for (let dx = 0; dx < this.w; dx++) res.push([this.x + dx, this.y + this.h]);
    else for (let dx = 0; dx < this.w; dx++) res.push([this.x + dx, this.y - 1]);
    return res;
  }
  update(dt) {
    this.working = false;
    if (this.bufN === undefined) { this.bufN = 0; }
    if (this.bufItem === 'coal' && this.buf > 0 && this.fuelCoal < SELF_FUEL_MAX) {
      this.buf--;
      this.fuelCoal++;
      if (this.buf <= 0) this.bufItem = null;
    }
    if (this.buf > 0) this.tryOutput();
    const o = this.oreTile();
    if (!o) { this.status = '无矿'; this.spin = 0; return; }
    if (this.buf >= DRILL_BUFFER_CAP) { this.status = '缓存已满'; this.spin = 0; return; }
    if (this.burnLeft <= 0) {
      if (this.fuelRocket > 0) {
        this.fuelRocket--;
        if (typeof trackProd === 'function') trackProd('rocket-fuel', -1);
        this.burnLeft += ROCKET_FUEL_ENERGY;
        this.burnCap = ROCKET_FUEL_ENERGY; this.burnType = 'rocket-fuel';
      } else if (this.fuelSolid > 0) {
        this.fuelSolid--;
        if (typeof trackProd === 'function') trackProd('solid-fuel', -1);
        this.burnLeft += SOLID_FUEL_ENERGY;
        this.burnCap = SOLID_FUEL_ENERGY; this.burnType = 'solid-fuel';
      } else if (this.fuelCoal > 0) {
        this.fuelCoal--;
        if (typeof trackProd === 'function') trackProd('coal', -1);
        this.burnLeft += COAL_ENERGY;
        this.burnCap = COAL_ENERGY; this.burnType = 'coal';
      } else if (this.fuelWood > 0) {
        this.fuelWood--;
        if (typeof trackProd === 'function') trackProd('wood', -1);
        this.burnLeft += WOOD_FUEL_ENERGY;
        this.burnCap = WOOD_FUEL_ENERGY; this.burnType = 'wood';
      }
      else { this.status = '缺燃料'; this.spin = 0; return; }
    }
    this.status = '';
    this.working = true;
    drillEmit(this, dt);
    // 采矿机运转环境音（仅屏内可见时播放，限频避免音爆）
    if (typeof onScreen === 'function' && onScreen(this) && typeof playSfx === 'function' && G.settings.sound) {
      this._runSfxT = (this._runSfxT || 0) - dt;
      if (this._runSfxT <= 0) { this._runSfxT = 2.2; playSfx('machine-run'); }
    }
    this.burnLeft -= dt * fuelConsumptionMult();
    this.spin += dt * 6;
    // 热能采矿机 mining-speed 0.25（对齐《异星工厂》官方 mining_speed）；每采 1 个矿需累计到该矿石的采矿时间
    this.prog += dt * drillMult() * (GAME_DATA.deviceStats?.[this.type]?.miningSpeed ?? 0.25);
    const mt = this.oreTime(); // 当前矿石的采矿时间（铁/铜/煤/石 2s、铀矿 4s，对齐《异星工厂》mining_time）
    if (this.prog >= mt) {
      this.prog -= mt;
      if (!G.settings.infiniteOre) consumeOre(o[0], o[1]);
      const mined = this.mineItem(o);
      // 采矿产能科技：按比例累积免费额外产出（对齐《异星工厂》Mining productivity）
      if (this.prodAccum === undefined) this.prodAccum = 0;
      this.prodAccum += (miningProdMult() - 1);
      const bonus = Math.floor(this.prodAccum);
      if (bonus > 0) this.prodAccum -= bonus;
      if (mined === 'coal' && this.fuelCoal < SELF_FUEL_MAX) {
        this.fuelCoal++;   // 采到的煤直接进燃料仓自用
        if (bonus > 0) {
          // 免费额外产出受缓冲容量限制：放得下的入缓冲，放不下的回存 prodAccum 后续再产出
          const bonusAdd = Math.min(bonus, Math.max(0, DRILL_BUFFER_CAP - this.buf));
          this.prodAccum += (bonus - bonusAdd);
          if (bonusAdd > 0) { this.bufItem = mined; this.buf += bonusAdd; if (typeof trackProd === 'function') trackProd(mined, bonusAdd); }
        }
      } else {
        this.bufItem = mined;
        // 实采的 1 个矿必定入缓冲（到此处 buf < 上限，必有空位）；免费额外产出受缓冲容量限制
        let added = 1;
        if (bonus > 0) {
          const space = DRILL_BUFFER_CAP - this.buf - 1;
          const bonusAdd = Math.min(bonus, Math.max(0, space));
          this.prodAccum += (bonus - bonusAdd);
          this.buf += 1 + bonusAdd;
          added += bonusAdd;
        } else {
          this.buf += 1;
        }
        if (typeof trackProd === 'function') trackProd(mined, added);
      }
      this.tryOutput();
    }
  }
  tryOutput() {
    let guard = 0;
    while (this.buf > 0 && this.bufItem && guard++ < 40) {
      let sent = false;
      for (const [fx, fy] of this.frontTargets()) {
        const t = entAt(fx, fy);
        if (!t) continue;
        if (t instanceof Belt && !(t instanceof Splitter)) {
          if (t.acceptItem(this.bufItem, this.dir)) { this.buf--; sent = true; break; }
        } else if (!(t instanceof Underground) && !(t instanceof Inserter) && !(t instanceof Splitter) && !(t instanceof Drill) && t.giveItem(this.bufItem)) {
          this.buf--; sent = true; break;
        }
      }
      if (!sent) break;
    }
  }
  giveItem(item) {
    if (item === 'rocket-fuel' && this.fuelRocket < 10) { this.fuelRocket++; return true; }
    if (item === 'coal' && this.fuelCoal < SELF_FUEL_MAX) { this.fuelCoal++; return true; }
    if (item === 'wood' && this.fuelWood < 10) { this.fuelWood++; return true; }
    if (item === 'solid-fuel' && this.fuelSolid < 10) { this.fuelSolid++; return true; }
    return false;
  }
  peekItem() {
    return (this.buf > 0 && this.bufItem) ? this.bufItem : null;
  }
  takeItem() {
    if (this.buf > 0 && this.bufItem) {
      this.buf--;
      const it = this.bufItem;
      return it;
    }
    return null;
  }
  countOf(item) { return (this.bufItem === item && this.buf > 0) ? this.buf : 0; }
  takeItemOf(item) {
    if (this.bufItem === item && this.buf > 0) { this.buf--; return item; }
    return null;
  }
  contents() {
    const list = [[this.type, 1]];
    if (this.fuelRocket > 0) list.push(['rocket-fuel', this.fuelRocket]);
    if (this.fuelSolid > 0) list.push(['solid-fuel', this.fuelSolid]);
    if (this.fuelCoal > 0) list.push(['coal', this.fuelCoal]);
    if (this.fuelWood > 0) list.push(['wood', this.fuelWood]);
    if (this.bufN > 0 && this.bufItem) list.push([this.bufItem, this.bufN]);
    return list;
  }
  // 面板"取出全部"：清空矿物缓存
  takeAll() {
    if (this.buf > 0 && this.bufItem) {
      const rows = [[this.bufItem, this.buf]];
      this.buf = 0;
      return rows;
    }
    return [];
  }
  // R 旋转后立即尝试朝新方向输出
  onRotate() { this.tryOutput(); }
  serialize() {
    const s = super.serialize();
    s.fuelCoal = this.fuelCoal; s.fuelSolid = this.fuelSolid; s.fuelRocket = this.fuelRocket; s.fuelWood = this.fuelWood; s.burnLeft = this.burnLeft;
    s.bufItem = this.bufItem; s.buf = this.buf; s.prog = this.prog;
    s.burnCap = this.burnCap; s.burnType = this.burnType;
    return s;
  }
  static restore(s) {
    const d = super.restore(s);
    d.fuelCoal = s.fuelCoal || 0; d.fuelSolid = s.fuelSolid || 0; d.fuelRocket = s.fuelRocket || 0; d.fuelWood = s.fuelWood || 0; d.burnLeft = s.burnLeft || 0;
    d.bufItem = s.bufItem || null; d.buf = s.buf || 0; d.prog = s.prog || 0;
    d.burnCap = s.burnCap || 0; d.burnType = s.burnType || '';
    return d;
  }
}

// ===== 渲染（热能/电采矿机/抽油机共用同一绘制，按 type 换色）=====
function drawDrill(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w;
  const sh = TILE * e.h;
  const electric = e.type === 'electric-mining-drill' || e.type === 'pumpjack';
  const pump = e.type === 'pumpjack';
  const bodyC = pump ? '#2f5a56' : electric ? '#3b5a8c' : '#6e4630';
  const bodyC2 = pump ? '#3d726d' : electric ? '#4d6ea8' : '#8a5a3e';
  const lineC = pump ? '#1b3c39' : electric ? '#223a60' : '#43291b';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = bodyC;
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 8);
  ctx.fill();
  ctx.strokeStyle = lineC;
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 8);
  ctx.stroke();
  ctx.fillStyle = bodyC2;
  rr(ctx, px + 10, py + 10, s - 20, sh - 20, 5);
  ctx.fill();
  const cx = px + s / 2, cy = py + s / 2 - 4;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(e.spin || 0);
  ctx.fillStyle = e.working ? '#c9d2dc' : '#7d8894';
  gearShape(ctx, 0, 0, 13, 8.5, 7);
  ctx.fill();
  ctx.restore();
  const pct = Math.min(1, (e.prog || 0) / e.oreTime());
  if (pct > 0 && e.working) {
    ctx.strokeStyle = 'rgba(143,224,143,.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 19, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
    ctx.stroke();
  }
  // 抽油机不画正面的两个方向指示箭头（去掉某一边中间的两个箭头），其余采矿机保留
  if (!pump) {
    ctx.fillStyle = dirColorNotch(dir);
    for (const m of [-11, 11]) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(dir * Math.PI / 2);
      ctx.translate(s / 2 - 12, m);
      tri(ctx, 0, -4, 0, 4, 8, 0);
      ctx.fill();
      ctx.restore();
    }
  }
  if (!electric) {
    const fuelPct = Math.min(1, e.burnLeft / COAL_ENERGY);
    ctx.fillStyle = '#20242b';
    rr(ctx, px + 10, py + s - 12, s - 20, 5, 2); ctx.fill();
    ctx.fillStyle = fuelPct > 0 ? '#e8762c' : '#c33';
    rr(ctx, px + 10, py + s - 12, (s - 20) * fuelPct, 5, 2); ctx.fill();
  } else if (e.working) {
    ctx.fillStyle = 'rgba(143,224,255,.7)';
    rr(ctx, px + 10, py + s - 12, s - 20, 5, 2); ctx.fill();
  }
  if (e.status) {
    ctx.fillStyle = '#ffd23c';
    ctx.fillRect(px + s - 14, py + 8, 5, 5);
  }
  // 抽油机原油输出口：画在实际排出的那个角落出口（一格一接口），并用蓝色箭头标注流出方向
  if (pump) {
    drawPort(ctx, px + s / 2, py + s / 2, dir, PORT_OUTPUT, false, 1, s / 2, 'crude-oil', 'out');
  }
  // 电采矿机硫酸接入口：除矿物出口方向外，其余 3 个方向的正中间均可接入管道（输入绿）
  if (electric && !pump) {
    for (const sd of [(dir + 1) % 4, (dir + 2) % 4, (dir + 3) % 4]) {
      drawPort(ctx, px + s / 2, py + s / 2, sd, PORT_INPUT, false, 0, s / 2, 'sulfuric-acid', 'in');
    }
  }
  ctx.globalAlpha = 1;
}

// ===== 放置规则：脚印范围内必须压到普通矿（抽油机的原油规则在 pumpjack.js）=====
function drillNeedsOre(type, tx, ty, dir, ew, eh) {
  let hasOre = false;
  for (let dy = 0; dy < eh && !hasOre; dy++)
    for (let dx = 0; dx < ew && !hasOre; dx++) {
      const ti = getOreType(tx + dx, ty + dy);
      if ((ti >= 0 && ti < ORES.length) || ti === ORE_URANIUM || ti === ORE_ASTEROID) hasOre = true;
    }
  return hasOre ? null : { ok: false };
}

// ===== 热能采矿机专属面板（对齐设计：信息透明、操作直接）=====
// 面板分四块，直击“自给自足、简单实用”：
//   ① 燃料槽    —— 显示当前燃料数量（煤/木材/固体/火箭），手动放入即可启动；
//   ② 燃料消耗指示 —— 进度条展示当前正在燃烧的那一单位燃料剩余能量，一眼看清还能撑多久；
//   ③ 采矿进度条 —— 当前一个矿石的开采进度（由 api.prog 驱动渲染）；
//   ④ 产品槽    —— 已开采矿石缓存，支持一键取回。
function burnerDrillPanelHtml(e) {
  const fuelChips = (e.fuelRocket > 0 ? chip('rocket-fuel', e.fuelRocket) + ' ' : '')
    + (e.fuelSolid > 0 ? chip('solid-fuel', e.fuelSolid) + ' ' : '')
    + (e.fuelCoal > 0 ? chip('coal', e.fuelCoal) + ' ' : '')
    + (e.fuelWood > 0 ? chip('wood', e.fuelWood) : (e.fuelRocket <= 0 && e.fuelSolid <= 0 && e.fuelCoal <= 0 ? '<span class="dim">空 — 放入燃料启动</span>' : ''));
  let h = '';
  // ① 燃料槽
  h += row('燃料槽', fuelChips, 'fuel');
  // ② 燃料消耗指示：当前燃烧燃料的剩余能量条
  h += row('燃料消耗', '<span id="drill-burnbar"></span>', 'burn');
  // 加料按钮（操作直接：点一下即放入 5 个）
  if (invCount('coal') > 0)
    h += '<button data-action="fuel" data-id="coal">加 5 煤 (' + invCount('coal') + ')</button>';
  if (invCount('wood') > 0)
    h += '<button data-action="fuel" data-id="wood">加 5 木材 (' + invCount('wood') + ')</button>';
  if (invCount('solid-fuel') > 0)
    h += '<button data-action="fuel" data-id="solid-fuel">加 5 固体燃料 (' + invCount('solid-fuel') + ')</button>';
  if (invCount('rocket-fuel') > 0)
    h += '<button data-action="fuel" data-id="rocket-fuel">加 5 火箭燃料 (' + invCount('rocket-fuel') + ')</button>';
  // 采矿速率
  h += '<div id="mach-rate-block"></div>';
  // ④ 产品槽（矿物缓存）
  h += row('产品槽', '<span class="dim"></span>', 'buffer');
  h += '<button data-action="takeout" id="btn-drill-takeout" style="display:none"></button>';
  // ③ 采矿进度条
  h += barHtml(0);
  h += '<div class="status"></div>';
  h += '<div id="drill-ore-remain" class="dim"></div>';
  h += '<div class="dim">产出方向朝' + ['东', '南', '西', '北'][e.dir] + '，选中后按 R 旋转（需先关闭本面板或按 Q 取消选择）</div>';
  return h;
}
function burnerDrillPanelLive(e, api) {
  api.set('fuel', (e.fuelRocket > 0 ? chip('rocket-fuel', e.fuelRocket) + ' ' : '')
    + (e.fuelSolid > 0 ? chip('solid-fuel', e.fuelSolid) + ' ' : '')
    + (e.fuelCoal > 0 ? chip('coal', e.fuelCoal) + ' ' : '')
    + (e.fuelWood > 0 ? chip('wood', e.fuelWood) : (e.fuelRocket <= 0 && e.fuelSolid <= 0 && e.fuelCoal <= 0 ? dimSpan('空 — 放入燃料启动') : '')));
  // ② 燃料消耗指示
  const burnEl = document.getElementById('drill-burnbar');
  if (burnEl) {
    const cap = e.burnCap > 0 ? e.burnCap : COAL_ENERGY;
    const pct = Math.max(0, Math.min(100, e.burnLeft / cap * 100));
    let txt;
    if (e.burnLeft > 0) {
      const name = e.burnType && ITEMS[e.burnType] ? ITEMS[e.burnType].name : '燃料';
      txt = name + ' 燃烧中 · 剩余能量 ' + e.burnLeft.toFixed(1) + 'MJ（' + Math.round(pct) + '%）';
    } else if (e.fuelRocket > 0 || e.fuelSolid > 0 || e.fuelCoal > 0 || e.fuelWood > 0) {
      txt = '燃料已就绪，即将燃烧';
    } else {
      txt = '缺燃料 · 已停摆';
    }
    const html = '<div class="mini-bar' + (e.burnLeft > 0 ? '' : ' empty') + '"><i style="width:' + pct + '%"></i></div>'
      + '<div class="dim" style="margin-top:2px">' + txt + '</div>';
    if (burnEl.innerHTML !== html) burnEl.innerHTML = html;
  }
  // ④ 产品槽
  api.set('buffer', e.buf > 0 && e.bufItem ? chip(e.bufItem, e.buf) : dimSpan('空'));
  api.toggle('#btn-drill-takeout', e.buf > 0, '取回产品 (' + e.buf + ')');
  // ③ 采矿进度条
  api.prog(e.working ? e.prog / e.oreTime() * 100 : 0, e.oreTime());
  // 开采速率：每秒产矿量 = 1 / 该矿石采矿时间 × 采矿科技 × 机型倍率
  const rateEl = document.getElementById('mach-rate-block');
  if (rateEl) {
    const o = e.oreTile();
    const item = o ? e.mineItem(o) : (e.bufItem || null);
    const mult = drillMult() * (GAME_DATA.deviceStats?.[e.type]?.miningSpeed ?? 0.25);
    const rec = item ? { time: oreMiningTime(item), inp: {}, out: { [item]: 1 } } : null;
    const html = rec ? machRateHtml(rec, mult) : '';
    if (rateEl.innerHTML !== html) rateEl.innerHTML = html;
  }
  // 状态：工作中或暂停原因
  if (e.status) api.status('已暂停：' + e.status, 'warn');
  else if (!e.working) api.status('待机：产出朝' + ['东', '南', '西', '北'][e.dir], 'ok');
  else api.status('开采中：产出朝' + ['东', '南', '西', '北'][e.dir], 'ok');
  // 矿脉剩余储量显示
  const oreRemainEl = document.getElementById('drill-ore-remain');
  if (oreRemainEl) {
    let oreRemain = 0, oreFound = false;
    for (let dy = 0; dy < e.h; dy++)
      for (let dx = 0; dx < e.w; dx++) {
        const tx = e.x + dx, ty = e.y + dy;
        if (!e.minableOreType(getOreType(tx, ty))) continue;
        const amt = getOreAmt(tx, ty);
        if (amt <= 0) continue;
        oreRemain += amt; oreFound = true;
      }
    const txt = oreFound
      ? ('矿脉剩余：' + Math.round(oreRemain) + (oreRemain <= 100 ? '（⚠ 即将采空）' : ''))
      : '矿脉剩余：—';
    if (oreRemainEl.textContent !== txt) oreRemainEl.textContent = txt;
  }
}

// ===== 电采矿机/抽油机面板（保持原设计，按是否吃电分支）=====
function electricDrillPanelHtml(e) {
  let h = '';
  h += row('电力', powerStatusLiveHtml(e), 'power');
  h += '<div id="mach-rate-block"></div>';
  const mc = moduleCounts(e.modules);
  const hasMod = (Object.keys(e.modules).length > 0);
  h += row('模块', hasMod ?
    '速度+' + mc.speed.toFixed(1) + ' 产能+' + mc.prod.toFixed(1) + ' 效率-' + mc.eff.toFixed(1) + ' 品质+' + (mc.quality*100).toFixed(1) + '%' : '<span class="dim">无</span>', 'mod');
  for (const mid of Object.keys(e.modules)) {
    if ((e.modules[mid] || 0) > 0) h += '<span class="dim">' + ITEMS[mid].name + ' ×' + e.modules[mid] + '</span> ';
  }
  const order = ['speed-module', 'speed-module-2', 'speed-module-3', 'productivity-module', 'productivity-module-2', 'productivity-module-3', 'efficiency-module', 'efficiency-module-2', 'efficiency-module-3', 'quality-module', 'quality-module-2', 'quality-module-3'];
  for (const mid of order) {
    if (!itemUnlocked(mid)) continue;
    const n = Math.min(invCount(mid), e.moduleSlotCount() - (e.modules[mid] || 0));
    if (n > 0) h += '<button data-action="feed" data-id="' + mid + '">装入' + ITEMS[mid].name + ' ×' + n + '</button>';
  }
  if (hasMod) h += '<button data-action="takein" data-modules="1">取出全部模块</button>';
  h += row('硫酸', '<span class="dim"></span>', 'acid');
  h += row('矿物缓存', '<span class="dim"></span>', 'buffer');
  h += '<button data-action="takeout" id="btn-drill-takeout" style="display:none"></button>';
  h += barHtml(0);
  h += '<div class="status"></div>';
  h += '<div id="drill-ore-remain" class="dim"></div>';
  h += '<div class="dim">产出方向朝' + ['东', '南', '西', '北'][e.dir] + '，选中后按 R 旋转（需先关闭本面板或按 Q 取消选择）</div>';
  return h;
}
function electricDrillPanelLive(e, api) {
  api.set('power', powerStatusLiveHtml(e));
  api.set('acid', (e.acid || 0) > 0 ? chip('sulfuric-acid', e.acid) : dimSpan('无'));
  api.set('buffer', e.buf > 0 && e.bufItem ? chip(e.bufItem, e.buf) : dimSpan('空'));
  api.toggle('#btn-drill-takeout', e.buf > 0, '取回缓存 (' + e.buf + ')');
  api.prog(e.working ? e.prog / e.oreTime() * 100 : 0, e.oreTime());
  const rateEl = document.getElementById('mach-rate-block');
  if (rateEl) {
    const o = e.oreTile();
    const item = o ? e.mineItem(o) : (e.bufItem || null);
    const mult = drillMult() * e.machMult() * e.moduleSpeedMult();
    const rec = item ? { time: oreMiningTime(item), inp: {}, out: { [item]: 1 } } : null;
    const html = rec ? machRateHtml(rec, mult) : '';
    if (rateEl.innerHTML !== html) rateEl.innerHTML = html;
  }
  if (e.status) api.status('已暂停：' + e.status, 'warn');
  else if (!e.working) api.status('待机：产出朝' + ['东', '南', '西', '北'][e.dir], 'ok');
  else api.status('开采中：产出朝' + ['东', '南', '西', '北'][e.dir], 'ok');
  const oreRemainEl = document.getElementById('drill-ore-remain');
  if (oreRemainEl) {
    let oreRemain = 0, oreFound = false;
    for (let dy = 0; dy < e.h; dy++)
      for (let dx = 0; dx < e.w; dx++) {
        const tx = e.x + dx, ty = e.y + dy;
        if (!e.minableOreType(getOreType(tx, ty))) continue;
        const amt = getOreAmt(tx, ty);
        if (amt <= 0) continue;
        oreRemain += amt; oreFound = true;
      }
    const txt = oreFound
      ? ('矿脉剩余：' + Math.round(oreRemain) + (oreRemain <= 100 ? '（⚠ 即将采空）' : ''))
      : '矿脉剩余：—';
    if (oreRemainEl.textContent !== txt) oreRemainEl.textContent = txt;
  }
}


// 悬停提示：矿脉剩余储量 + 电钻/抽油机电量不足 + 铀矿需硫酸
function drillTip(e) {
  const base = e.status || ('开采中，产出朝' + ['东', '南', '西', '北'][e.dir]);
  // 矿脉剩余储量提示（对齐《异星工厂》：矿脉储量有限、会逐渐采空）
  let oreRemain = 0;
  let oreFound = false;
  for (let dy = 0; dy < e.h; dy++)
    for (let dx = 0; dx < e.w; dx++) {
      const tx = e.x + dx, ty = e.y + dy;
      if (!e.minableOreType(getOreType(tx, ty))) continue;
      const amt = getOreAmt(tx, ty);
      if (amt <= 0) continue;
      oreRemain += amt;
      oreFound = true;
    }
  let tip = base;
  if (oreFound) {
    tip += '；矿脉剩余 ' + Math.round(oreRemain) + (oreRemain <= 100 ? '（⚠ 即将采空）' : '');
  }
  // 电采矿机/抽油机：电量不足（正在耗电且 sat<1）时在提示中注明
  if (e instanceof ElectricDrill) {
    const s = powerStatusOf(e);
    if (s.consuming && s.sat < 1) tip += '；' + (s.sat > 0 ? '电量不足' + Math.round(s.sat * 100) + '%' : '缺电停摆');
    // 铀矿采集需接入硫酸：提示剩余量与管道接入方向
    let hasUranium = false;
    for (let dy = 0; dy < e.h; dy++)
      for (let dx = 0; dx < e.w; dx++) {
        if (getOreType(e.x + dx, e.y + dy) === ORE_URANIUM && getOreAmt(e.x + dx, e.y + dy) > 0) hasUranium = true;
      }
    if (hasUranium) {
      tip += '；铀矿需硫酸' + ((e.acid || 0) > 0 ? '（硫酸×' + e.acid + '）' : '（缺硫酸，无法开采）');
    }
  }
  return tip;
}

// ===== 注册（渲染/面板/提示对三类采矿机统一注册）=====
ENT_CLASSES['burner-mining-drill'] = Drill;
DEVICE_RENDER['burner-mining-drill'] = drawDrill;
DEVICE_RENDER['electric-mining-drill'] = drawDrill;
DEVICE_RENDER['pumpjack'] = drawDrill;
DEVICE_STATUS['burner-mining-drill'] = e => e.working ? 'g' : 'r';
// 电采矿机/抽油机：正在耗电且电量不足（sat<1）时亮黄灯提示；未耗电时按是否工作显红/绿
function electricDrillStatus(e) {
  const s = powerStatusOf(e);
  return s.consuming ? s.color : (e.working ? 'g' : 'r');
}
DEVICE_STATUS['electric-mining-drill'] = electricDrillStatus;
DEVICE_STATUS['pumpjack'] = electricDrillStatus;
const burnerDrillPanel = { html: burnerDrillPanelHtml, live: burnerDrillPanelLive, tip: drillTip };
const electricDrillPanel = { html: electricDrillPanelHtml, live: electricDrillPanelLive, tip: drillTip };
DEVICE_PANEL['burner-mining-drill'] = burnerDrillPanel;
DEVICE_PANEL['electric-mining-drill'] = electricDrillPanel;
DEVICE_PANEL['pumpjack'] = electricDrillPanel;
DEVICE_DIR_ROTATE['burner-mining-drill'] = true;
DEVICE_DIR_ROTATE['electric-mining-drill'] = true;
// 显示详情时，各接口图标所在世界格 + 对应流体名（用于鼠标悬停显示流体名称）
// 抽油机：原油输出口在 dir 方向、沿边偏移半格到角落；电采矿机：其余 3 个方向中位硫酸输入口
DEVICE_FLUID_ICONS['pumpjack'] = e => {
  const s = TILE * e.w;
  const c = portCenterCell(e, e.x * TILE + s / 2, e.y * TILE + s / 2, e.dir | 0, 1, s / 2);
  return [{ x: c[0], y: c[1], fluid: 'crude-oil' }];
};
DEVICE_FLUID_ICONS['electric-mining-drill'] = e => {
  const s = TILE * e.w;
  const dir = e.dir | 0;
  const icons = [];
  for (const sd of [(dir + 1) % 4, (dir + 2) % 4, (dir + 3) % 4]) {
    const c = portCenterCell(e, e.x * TILE + s / 2, e.y * TILE + s / 2, sd, 0, s / 2);
    icons.push({ x: c[0], y: c[1], fluid: 'sulfuric-acid' });
  }
  return icons;
};
DEVICE_DIR_ROTATE['pumpjack'] = true;
