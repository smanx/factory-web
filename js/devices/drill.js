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
    super(type || 'burner-drill', x, y);
    this.fuelCoal = 0;
    this.fuelSolid = 0;
    this.fuelRocket = 0;
    this.burnLeft = 0;
    this.bufItem = null;
    this.buf = 0;
    this.prog = 0;
    this.working = false;
    this.status = '';
    this.spin = 0;
  }
  // 可开采的矿石索引：普通矿 0-4 + 铀矿 6（原油 5 由抽油机专用）。
  minableOreType(ti) { return (ti >= 0 && ti < ORES.length) || ti === ORE_URANIUM; }
  oreTile() {
    for (let dy = 0; dy < this.h; dy++)
      for (let dx = 0; dx < this.w; dx++) {
        const tx = this.x + dx, ty = this.y + dy;
        const ti = getOreType(tx, ty);
        if (this.minableOreType(ti) && getOreAmt(tx, ty) > 0) return [tx, ty];
      }
    return null;
  }
  mineItem(o) { return oreItemId(getOreType(o[0], o[1])); }
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
    if (this.buf >= 20) { this.status = '缓存已满'; this.spin = 0; return; }
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
      else { this.status = '缺燃料'; this.spin = 0; return; }
    }
    this.status = '';
    this.working = true;
    drillEmit(this, dt);
    // 采矿机运转环境音（限频避免音爆）
    if (typeof playSfx === 'function' && G.settings.sound) {
      this._runSfxT = (this._runSfxT || 0) - dt;
      if (this._runSfxT <= 0) { this._runSfxT = 2.2; playSfx('machine-run'); }
    }
    this.burnLeft -= dt * fuelConsumptionMult();
    this.spin += dt * 6;
    this.prog += dt * drillMult() * 0.25; // 热能采矿机 mining-speed 0.25（对齐《异星工厂》）
    if (this.prog >= DRILL_TIME) {
      this.prog -= DRILL_TIME;
      if (!G.settings.infiniteOre) consumeOre(o[0], o[1]);
      const mined = this.mineItem(o);
      // 采矿产能科技：按比例累积免费额外产出（对齐《异星工厂》Mining productivity）
      if (this.prodAccum === undefined) this.prodAccum = 0;
      this.prodAccum += (miningProdMult() - 1);
      const bonus = Math.floor(this.prodAccum);
      if (bonus > 0) this.prodAccum -= bonus;
      if (mined === 'coal' && this.fuelCoal < SELF_FUEL_MAX) {
        this.fuelCoal++;   // 采到的煤直接进燃料仓自用
        if (bonus > 0) { this.bufItem = mined; this.buf += bonus; if (typeof trackProd === 'function') trackProd(mined, bonus); }
      } else {
        this.bufItem = mined;
        this.buf += 1 + bonus;
        if (typeof trackProd === 'function') trackProd(mined, 1 + bonus);
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
    s.fuelCoal = this.fuelCoal; s.fuelSolid = this.fuelSolid; s.fuelRocket = this.fuelRocket; s.burnLeft = this.burnLeft;
    s.bufItem = this.bufItem; s.buf = this.buf; s.prog = this.prog;
    return s;
  }
  static restore(s) {
    const d = super.restore(s);
    d.fuelCoal = s.fuelCoal || 0; d.fuelSolid = s.fuelSolid || 0; d.fuelRocket = s.fuelRocket || 0; d.burnLeft = s.burnLeft || 0;
    d.bufItem = s.bufItem || null; d.buf = s.buf || 0; d.prog = s.prog || 0;
    return d;
  }
}

// ===== 渲染（热能/电采矿机/抽油机共用同一绘制，按 type 换色）=====
function drawDrill(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w;
  const sh = TILE * e.h;
  const electric = e.type === 'electric-drill' || e.type === 'pumpjack';
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
  const pct = Math.min(1, (e.prog || 0) / DRILL_TIME);
  if (pct > 0 && e.working) {
    ctx.strokeStyle = 'rgba(143,224,143,.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 19, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
    ctx.stroke();
  }
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
  // 抽油机原油输出口：对齐正面居中的那一个格子（一格一接口），颜色用输出橙红、带箭头
  if (pump) {
    drawPort(ctx, px + s / 2, py + s / 2, dir, PORT_OUTPUT, true, 0, s / 2);
  }
  ctx.globalAlpha = 1;
}

// ===== 放置规则：脚印范围内必须压到普通矿（抽油机的原油规则在 pumpjack.js）=====
function drillNeedsOre(type, tx, ty, dir, ew, eh) {
  let hasOre = false;
  for (let dy = 0; dy < eh && !hasOre; dy++)
    for (let dx = 0; dx < ew && !hasOre; dx++) {
      const ti = getOreType(tx + dx, ty + dy);
      if ((ti >= 0 && ti < ORES.length) || ti === ORE_URANIUM) hasOre = true;
    }
  return hasOre ? null : { ok: false };
}

// ===== 面板（热能/电采矿机/抽油机共用，按是否吃电分支）=====
function drillPanelHtml(e) {
  const eDrill = e instanceof ElectricDrill;
  let h = '';
  if (eDrill) {
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
  // 采矿速率显示在面板靠前位置（电力/燃料行之后）
  h += '<div id="mach-rate-block"></div>';
  // 模块槽位（仅电采矿机/抽油机，对齐《异星工厂》：采矿设备可装模块）
  if (eDrill) {
    const mc = moduleCounts(e.modules);
    const hasMod = (Object.keys(e.modules).length > 0);
    h += row('模块', hasMod ?
      '速度+' + mc.speed.toFixed(1) + ' 产能+' + mc.prod.toFixed(1) + ' 效率-' + mc.eff.toFixed(1) : '<span class="dim">无</span>', 'mod');
    for (const mid of Object.keys(e.modules)) {
      if ((e.modules[mid] || 0) > 0) h += '<span class="dim">' + ITEMS[mid].name + ' ×' + e.modules[mid] + '</span> ';
    }
    const order = ['speed-module', 'speed-module-2', 'speed-module-3', 'productivity-module', 'productivity-module-2', 'productivity-module-3', 'efficiency-module', 'efficiency-module-2', 'efficiency-module-3'];
    for (const mid of order) {
      if (!itemUnlocked(mid)) continue;
      const n = Math.min(invCount(mid), e.moduleSlotCount() - (e.modules[mid] || 0));
      if (n > 0) h += '<button data-action="feed" data-id="' + mid + '">装入' + ITEMS[mid].name + ' ×' + n + '</button>';
    }
    if (hasMod) h += '<button data-action="takein" data-modules="1">取出全部模块</button>';
  }
  h += row('矿物缓存', '<span class="dim"></span>', 'buffer');
  h += '<button data-action="takeout" id="btn-drill-takeout" style="display:none"></button>';
  h += barHtml(0);
  h += '<div class="status"></div>';
  h += '<div id="drill-ore-remain" class="dim"></div>';
  h += '<div class="dim">产出方向朝' + ['东', '南', '西', '北'][e.dir] + '，选中后按 R 旋转（需先关闭本面板或按 Q 取消选择）</div>';
  return h;
}
function drillPanelLive(e, api) {
  const eDrill = e instanceof ElectricDrill;
  if (eDrill) api.set('power', powerStatusLiveHtml(e));
  if (!eDrill) api.set('fuel', (e.fuelRocket > 0 ? chip('rocket-fuel', e.fuelRocket) + ' ' : '') + (e.fuelSolid > 0 ? chip('solid-fuel', e.fuelSolid) + ' ' : '') + (e.fuelCoal > 0 ? chip('coal', e.fuelCoal) : dimSpan('无')));
  api.set('buffer', e.buf > 0 && e.bufItem ? chip(e.bufItem, e.buf) : dimSpan('空'));
  api.toggle('#btn-drill-takeout', e.buf > 0, '取回缓存 (' + e.buf + ')');
  api.prog(e.working ? e.prog / DRILL_TIME * 100 : 0);
  // 开采速率：每秒产矿量 = 1 / DRILL_TIME × 采矿科技 × 机型倍率（电钻×电学、抽油×石油科技）
  const rateEl = body.querySelector('#mach-rate-block');
  if (rateEl) {
    const o = e.oreTile();
    const item = o ? e.mineItem(o) : (e.bufItem || null);
    const mult = e instanceof ElectricDrill ? drillMult() * e.machMult() * e.moduleSpeedMult() : drillMult() * 0.25;
    const rec = item ? { time: DRILL_TIME, inp: {}, out: { [item]: 1 } } : null;
    const html = rec ? machRateHtml(rec, mult) : '';
    if (rateEl.innerHTML !== html) rateEl.innerHTML = html;
  }
  // 状态：工作中或暂停原因（无矿/缓存满/缺电/缺燃料）
  if (e.status) api.status('已暂停：' + e.status, 'warn');
  else if (!e.working) api.status('待机：产出朝' + ['东', '南', '西', '北'][e.dir], 'ok');
  else api.status('开采中：产出朝' + ['东', '南', '西', '北'][e.dir], 'ok');
  // 矿脉剩余储量显示（对齐《异星工厂》：矿脉储量有限、会逐渐采空，便于规划迁移）
  const oreRemainEl = body.querySelector('#drill-ore-remain');
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
function drillTip(e) {
  const base = e.status || ('开采中，产出朝' + ['东', '南', '西', '北'][e.dir]);
  // 矿脉剩余储量提示（对齐《异星工厂》：矿脉储量有限、会逐渐采空）。
  // 计算本采矿机覆盖范围内剩余矿量总和，供玩家感知矿脉枯竭、及时迁移。
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
  }
  return tip;
}

// ===== 注册（渲染/面板/提示对三类采矿机统一注册）=====
ENT_CLASSES['burner-drill'] = Drill;
DEVICE_RENDER['burner-drill'] = drawDrill;
DEVICE_RENDER['electric-drill'] = drawDrill;
DEVICE_RENDER['pumpjack'] = drawDrill;
DEVICE_STATUS['burner-drill'] = e => e.working ? 'g' : 'r';
// 电采矿机/抽油机：正在耗电且电量不足（sat<1）时亮黄灯提示；未耗电时按是否工作显红/绿
function electricDrillStatus(e) {
  const s = powerStatusOf(e);
  return s.consuming ? s.color : (e.working ? 'g' : 'r');
}
DEVICE_STATUS['electric-drill'] = electricDrillStatus;
DEVICE_STATUS['pumpjack'] = electricDrillStatus;
const drillPanel = { html: drillPanelHtml, live: drillPanelLive, tip: drillTip };
DEVICE_PANEL['burner-drill'] = drillPanel;
DEVICE_PANEL['electric-drill'] = drillPanel;
DEVICE_PANEL['pumpjack'] = drillPanel;
DEVICE_PLACE['burner-drill'] = drillNeedsOre;
DEVICE_DIR_ROTATE['burner-drill'] = true;
DEVICE_DIR_ROTATE['electric-drill'] = true;
DEVICE_DIR_ROTATE['pumpjack'] = true;
