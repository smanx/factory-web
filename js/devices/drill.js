'use strict';

// ===== 热能采矿机（采矿业基类；电采矿机/抽油机继承自 ElectricDrill）=====
class Drill extends Entity {
  constructor(type, x, y) {
    super(type || 'burner-drill', x, y);
    this.fuelCoal = 0;
    this.burnLeft = 0;
    this.bufItem = null;
    this.buf = 0;
    this.prog = 0;
    this.working = false;
    this.status = '';
    this.spin = 0;
  }
  oreTile() {
    for (let dy = 0; dy < this.h; dy++)
      for (let dx = 0; dx < this.w; dx++) {
        const tx = this.x + dx, ty = this.y + dy;
        const ti = getOreType(tx, ty);
        if (ti >= 0 && ti < ORES.length && getOreAmt(tx, ty) > 0) return [tx, ty];
      }
    return null;
  }
  mineItem(o) { return ORES[getOreType(o[0], o[1])]; }
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
      if (this.fuelCoal > 0) { this.fuelCoal--; this.burnLeft += COAL_ENERGY; }
      else { this.status = '缺燃料'; this.spin = 0; return; }
    }
    this.status = '';
    this.working = true;
    this.burnLeft -= dt;
    this.spin += dt * 6;
    this.prog += dt * drillMult();
    if (this.prog >= DRILL_TIME) {
      this.prog -= DRILL_TIME;
      if (!G.settings.infiniteOre) consumeOre(o[0], o[1]);
      const mined = this.mineItem(o);
      if (mined === 'coal' && this.fuelCoal < SELF_FUEL_MAX) {
        this.fuelCoal++;
      } else {
        this.bufItem = mined;
        this.buf++;
        this.tryOutput();
      }
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
    if (item === 'coal' && this.fuelCoal < 10) { this.fuelCoal++; return true; }
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
    s.fuelCoal = this.fuelCoal; s.burnLeft = this.burnLeft;
    s.bufItem = this.bufItem; s.buf = this.buf; s.prog = this.prog;
    return s;
  }
  static restore(s) {
    const d = super.restore(s);
    d.fuelCoal = s.fuelCoal || 0; d.burnLeft = s.burnLeft || 0;
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
  ctx.globalAlpha = 1;
}

// ===== 放置规则：脚印范围内必须压到普通矿（抽油机的原油规则在 pumpjack.js）=====
function drillNeedsOre(type, tx, ty, dir, ew, eh) {
  let hasOre = false;
  for (let dy = 0; dy < eh && !hasOre; dy++)
    for (let dx = 0; dx < ew && !hasOre; dx++) {
      const ti = getOreType(tx + dx, ty + dy);
      if (ti >= 0 && ti < ORES.length) hasOre = true;
    }
  return hasOre ? null : { ok: false };
}

// ===== 面板（热能/电采矿机/抽油机共用，按是否吃电分支）=====
function drillPanelHtml(e) {
  const eDrill = e instanceof ElectricDrill;
  let h = '';
  if (eDrill) {
    h += row('电力', G.power.sat > 0 ? '功率 ' + Math.round(G.power.sat * 100) + '%' : '<span class="dim">缺电</span>');
  } else {
    h += row('燃料', e.fuelCoal > 0 ? chip('coal', e.fuelCoal) : '<span class="dim">无</span>', 'fuel');
    if (invCount('coal') > 0)
      h += '<button data-action="fuel" data-id="coal">加入 5 煤 (' + invCount('coal') + ')</button>';
  }
  h += row('矿物缓存', '<span class="dim"></span>', 'buffer');
  h += '<button data-action="takeout" id="btn-drill-takeout" style="display:none"></button>';
  h += barHtml(0);
  h += '<div class="status"></div>';
  h += '<div class="dim">产出方向朝' + ['东', '南', '西', '北'][e.dir] + '，选中后按 R 旋转（需先关闭本面板或按 Q 取消选择）</div>';
  return h;
}
function drillPanelLive(e, api) {
  const eDrill = e instanceof ElectricDrill;
  if (!eDrill) api.set('fuel', e.fuelCoal > 0 ? chip('coal', e.fuelCoal) : dimSpan('无'));
  api.set('buffer', e.buf > 0 && e.bufItem ? chip(e.bufItem, e.buf) : dimSpan('空'));
  api.toggle('#btn-drill-takeout', e.buf > 0, '取回缓存 (' + e.buf + ')');
  api.prog(e.working ? e.prog / DRILL_TIME * 100 : 0);
  api.status(e.status || ('开采中，产出朝' + ['东', '南', '西', '北'][e.dir]));
}
function drillTip(e) {
  return e.status || ('开采中，产出朝' + ['东', '南', '西', '北'][e.dir]);
}

// ===== 注册（渲染/面板/提示对三类采矿机统一注册）=====
ENT_CLASSES['burner-drill'] = Drill;
DEVICE_RENDER['burner-drill'] = drawDrill;
DEVICE_RENDER['electric-drill'] = drawDrill;
DEVICE_RENDER['pumpjack'] = drawDrill;
DEVICE_STATUS['burner-drill'] = e => e.working ? 'g' : 'r';
DEVICE_STATUS['electric-drill'] = e => e.working ? 'g' : 'r';
DEVICE_STATUS['pumpjack'] = e => e.working ? 'g' : 'r';
const drillPanel = { html: drillPanelHtml, live: drillPanelLive, tip: drillTip };
DEVICE_PANEL['burner-drill'] = drillPanel;
DEVICE_PANEL['electric-drill'] = drillPanel;
DEVICE_PANEL['pumpjack'] = drillPanel;
DEVICE_PLACE['burner-drill'] = drillNeedsOre;
DEVICE_DIR_ROTATE['burner-drill'] = true;
DEVICE_DIR_ROTATE['electric-drill'] = true;
DEVICE_DIR_ROTATE['pumpjack'] = true;
