'use strict';

// ===== 热能机械臂 Burner Inserter（对齐《异星工厂》Burner inserter）=====
// 烧煤驱动的机械臂：无需电力，开局即可用。与普通机械臂一样严格单向取放，
// 但工作时需要持续消耗煤作燃料（像热能采矿机）。无煤时停摆。
// 可放入组装机/石炉/采矿机等邻格设备取放物品，也可从燃料箱/机械臂供煤。
class BurnerInserter extends Inserter {
  constructor(type, x, y) {
    super(type || 'burner-inserter', x, y);
    this.fuelCoal = 0;
    this.fuelSolid = 0;
    this.fuelRocket = 0;
    this.fuelWood = 0;
    this.burnLeft = 0;
    this._fuelT = 0;
  }
  // 有燃料才工作；缺煤时停摆
  hasFuel() { return this.burnLeft > 0 || this.fuelRocket > 0 || this.fuelSolid > 0 || this.fuelCoal > 0 || this.fuelWood > 0; }
  // 燃料消耗：与普通臂同步率，仅在真正搬运时扣煤，闲置不耗煤
  consumeFuel(dt) {
    if (this.burnLeft > 0) { this.burnLeft -= dt * fuelConsumptionMult(); return; }
    if (this.fuelRocket > 0) {
      this.fuelRocket--;
      if (typeof trackProd === 'function') trackProd('rocket-fuel', -1);
      this.burnLeft = ROCKET_FUEL_ENERGY;
    } else if (this.fuelSolid > 0) {
      this.fuelSolid--;
      if (typeof trackProd === 'function') trackProd('solid-fuel', -1);
      this.burnLeft = SOLID_FUEL_ENERGY;
    } else if (this.fuelCoal > 0) {
      this.fuelCoal--;
      if (typeof trackProd === 'function') trackProd('coal', -1);
      this.burnLeft = COAL_ENERGY;
    } else if (this.fuelWood > 0) {
      this.fuelWood--;
      if (typeof trackProd === 'function') trackProd('wood', -1);
      this.burnLeft = WOOD_FUEL_ENERGY;
    }
  }
  // 允许机械臂/玩家向它加煤
  giveItem(item) {
    if (item === 'rocket-fuel' && this.fuelRocket < 5) { this.fuelRocket++; return true; }
    if (item === 'solid-fuel' && this.fuelSolid < 5) { this.fuelSolid++; return true; }
    if (item === 'coal' && this.fuelCoal < 5) { this.fuelCoal++; return true; }
    if (item === 'wood' && this.fuelWood < 5) { this.fuelWood++; return true; }
    return false;
  }
  countOf(item) { return item === 'coal' ? this.fuelCoal : (item === 'solid-fuel' ? this.fuelSolid : (item === 'rocket-fuel' ? this.fuelRocket : (item === 'wood' ? this.fuelWood : 0))); }
  takeItemOf(item) {
    if (item === 'coal' && this.fuelCoal > 0) { this.fuelCoal--; return 'coal'; }
    if (item === 'solid-fuel' && this.fuelSolid > 0) { this.fuelSolid--; return 'solid-fuel'; }
    if (item === 'rocket-fuel' && this.fuelRocket > 0) { this.fuelRocket--; return 'rocket-fuel'; }
    if (item === 'wood' && this.fuelWood > 0) { this.fuelWood--; return 'wood'; }
    return null;
  }
  contents() {
    const list = [[this.type, 1]];
    if (this.fuelRocket > 0) list.push(['rocket-fuel', this.fuelRocket]);
    if (this.fuelSolid > 0) list.push(['solid-fuel', this.fuelSolid]);
    if (this.fuelCoal > 0) list.push(['coal', this.fuelCoal]);
    if (this.fuelWood > 0) list.push(['wood', this.fuelWood]);
    return list;
  }
  update(dt) {
    if (!this.hasFuel()) {
      // 缺煤：若正持物则保持不动等待燃料
      this._probeT = 0.15;
      return;
    }
    const wasWorking = this.holdingCount > 0 || this.rotating;
    super.update(dt);
    const isWorking = this.holdingCount > 0 || this.rotating;
    // 只有实际在搬运时才烧煤（持续干活按时间扣燃料）
    if (isWorking) this.consumeFuel(dt);
    else if (wasWorking) { /* 刚停下来，不做额外处理 */ }
    this._fuelT = 0;
  }
  serialize() {
    const s = super.serialize();
    s.fuelCoal = this.fuelCoal;
    s.fuelSolid = this.fuelSolid;
    s.fuelRocket = this.fuelRocket;
    s.fuelWood = this.fuelWood;
    s.burnLeft = this.burnLeft;
    return s;
  }
  static restore(s) {
    const i = super.restore(s);
    i.fuelCoal = s.fuelCoal || 0;
    i.fuelSolid = s.fuelSolid || 0;
    i.fuelRocket = s.fuelRocket || 0;
    i.fuelWood = s.fuelWood || 0;
    i.burnLeft = s.burnLeft || 0;
    return i;
  }
}

// ===== 渲染：热能机械臂带小燃料仓与黑灰臂体（主配色黑灰） =====
function drawBurnerInserter(ctx, e, gx, gy, dir, alpha) {
  // 复用普通机械臂臂体绘制，但用烧煤配色 + 燃料槽
  drawInserter(ctx, e, gx, gy, dir, alpha);
  const px = gx * TILE, py = gy * TILE;
  ctx.save();
  ctx.globalAlpha = alpha;
  // 底部燃料仓（橙色小槽）
  ctx.fillStyle = '#20242b';
  rr(ctx, px + 6, py + TILE - 10, TILE - 12, 6, 2); ctx.fill();
  const pct = e.hasFuel() ? Math.min(1, (e.burnLeft + e.fuelCoal * 4 + e.fuelSolid * 4 + e.fuelRocket * 4 + e.fuelWood) / 5) : 0;
  ctx.fillStyle = pct > 0 ? '#e8762c' : '#8a2c1c';
  rr(ctx, px + 7, py + TILE - 9, (TILE - 14) * pct, 4, 2); ctx.fill();
  if (!e.hasFuel()) {
    // 缺煤警示
    ctx.fillStyle = 'rgba(255,80,60,.8)';
    ctx.fillRect(px + TILE - 11, py + 6, 4, 4);
  }
  ctx.restore();
}

// ===== 面板 =====
function burnerInserterPanelHtml(e) {
  return row('燃料', (e.fuelRocket > 0 ? chip('rocket-fuel', e.fuelRocket) + ' ' : '') + (e.fuelSolid > 0 ? chip('solid-fuel', e.fuelSolid) + ' ' : '') + (e.fuelCoal > 0 ? chip('coal', e.fuelCoal) + ' ' : '') + (e.fuelWood > 0 ? chip('wood', e.fuelWood) : (e.fuelRocket <= 0 && e.fuelSolid <= 0 && e.fuelCoal <= 0 ? '<span class="dim">无</span>' : '')), 'fuel') +
    (invCount('coal') > 0 ? '<button data-action="fuel" data-id="coal">加 5 煤 (' + invCount('coal') + ')</button>' : '') +
    (invCount('wood') > 0 ? '<button data-action="fuel" data-id="wood">加 5 木材 (' + invCount('wood') + ')</button>' : '') +
    (invCount('solid-fuel') > 0 ? '<button data-action="fuel" data-id="solid-fuel">加 5 固体燃料 (' + invCount('solid-fuel') + ')</button>' : '') +
    (invCount('rocket-fuel') > 0 ? '<button data-action="fuel" data-id="rocket-fuel">加 5 火箭燃料 (' + invCount('rocket-fuel') + ')</button>' : '') +
    inserterMachineRowsHtml(e);
}
// 燃料以外的面板操作（筛选/堆叠/变质/电路）与普通机械臂一致
function burnerInserterOnAction(act, btn) {
  if (act === 'fuel') return false; // 交给全局分发
  return inserterFilterOnAction(act, btn);
}
function burnerInserterPanelLive(e, api, body) {
  api.set('fuel', (e.fuelRocket > 0 ? chip('rocket-fuel', e.fuelRocket) + ' ' : '') + (e.fuelSolid > 0 ? chip('solid-fuel', e.fuelSolid) + ' ' : '') + (e.fuelCoal > 0 ? chip('coal', e.fuelCoal) + ' ' : '') + (e.fuelWood > 0 ? chip('wood', e.fuelWood) : (e.fuelRocket <= 0 && e.fuelSolid <= 0 && e.fuelCoal <= 0 ? dimSpan('无') : '')));
  if (!e.hasFuel()) { api.status('已暂停：缺燃料，加入煤/固体燃料/火箭燃料', 'warn'); return; }
  inserterPanelLive(e, api, body);   // 复用普通机械臂的状态/图标/抓取刷新
}
function burnerInserterTip(e) {
  if (!e.hasFuel()) return '热能机械臂：缺燃料停摆';
  return e.holding ? ('搬运 ' + ITEMS[e.holding].name) : '热能机械臂：待机';
}

// ===== 注册 =====
const burnerInserterPanel = { html: burnerInserterPanelHtml, live: burnerInserterPanelLive, tip: burnerInserterTip, onAction: burnerInserterOnAction };
ENT_CLASSES['burner-inserter'] = BurnerInserter;
DEVICE_RENDER['burner-inserter'] = drawBurnerInserter;
DEVICE_STATUS['burner-inserter'] = e => e.holding || e.rotating ? (e.blocked ? 'y' : 'g') : (e.hasFuel() ? 'r' : 'r');
DEVICE_PANEL['burner-inserter'] = burnerInserterPanel;
DEVICE_DIR_ROTATE['burner-inserter'] = true;
