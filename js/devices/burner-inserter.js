'use strict';

// ===== 燃料机械臂 Burner Inserter（对齐《异星工厂》Burner inserter）=====
// 烧煤驱动的机械臂：无需电力，开局即可用。与普通机械臂一样严格单向取放，
// 但工作时需要持续消耗煤作燃料（像热能采矿机）。无煤时停摆。
// 可放入组装机/石炉/采矿机等邻格设备取放物品，也可从燃料箱/机械臂供煤。
class BurnerInserter extends Inserter {
  constructor(type, x, y) {
    super(type || 'burner-inserter', x, y);
    this.fuelCoal = 0;
    this.burnLeft = 0;
    this._fuelT = 0;
  }
  // 有燃料才工作；缺煤时停摆
  hasFuel() { return this.burnLeft > 0 || this.fuelCoal > 0; }
  // 燃料消耗：与普通臂同步率，仅在真正搬运时扣煤，闲置不耗煤
  consumeFuel(dt) {
    if (this.burnLeft > 0) { this.burnLeft -= dt; return; }
    if (this.fuelCoal > 0) {
      this.fuelCoal--;
      if (typeof trackProd === 'function') trackProd('coal', -1);
      this.burnLeft = COAL_ENERGY;
    }
  }
  // 允许机械臂/玩家向它加煤
  giveItem(item) {
    if (item === 'coal' && this.fuelCoal < 5) { this.fuelCoal++; return true; }
    return false;
  }
  countOf(item) { return item === 'coal' ? this.fuelCoal : 0; }
  takeItemOf(item) {
    if (item === 'coal' && this.fuelCoal > 0) { this.fuelCoal--; return 'coal'; }
    return null;
  }
  contents() {
    const list = [[this.type, 1]];
    if (this.fuelCoal > 0) list.push(['coal', this.fuelCoal]);
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
    s.burnLeft = this.burnLeft;
    return s;
  }
  static restore(s) {
    const i = super.restore(s);
    i.fuelCoal = s.fuelCoal || 0;
    i.burnLeft = s.burnLeft || 0;
    return i;
  }
}

// ===== 渲染：燃料机械臂带小燃料仓与橙色臂体 =====
function drawBurnerInserter(ctx, e, gx, gy, dir, alpha) {
  // 复用普通机械臂臂体绘制，但用烧煤配色 + 燃料槽
  drawInserter(ctx, e, gx, gy, dir, alpha);
  const px = gx * TILE, py = gy * TILE;
  ctx.save();
  ctx.globalAlpha = alpha;
  // 底部燃料仓（橙色小槽）
  ctx.fillStyle = '#20242b';
  rr(ctx, px + 6, py + TILE - 10, TILE - 12, 6, 2); ctx.fill();
  const pct = e.hasFuel() ? Math.min(1, (e.burnLeft + e.fuelCoal * 4) / 5) : 0;
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
  return row('燃料', (e.fuelCoal > 0 ? chip('coal', e.fuelCoal) : '<span class="dim">无</span>'), 'fuel') +
    (invCount('coal') > 0 ? '<button data-action="fuel" data-id="coal">加 5 煤 (' + invCount('coal') + ')</button>' : '') +
    '<div class="status"></div>' +
    '<div class="dim">燃料机械臂：烧煤驱动，无需电力，开局即可用。从臂体指向的一侧取货、放到箭头一侧。搬运时消耗煤，缺煤会停摆（1×1）。</div>';
}
function burnerInserterPanelLive(e, api) {
  api.set('fuel', e.fuelCoal > 0 ? chip('coal', e.fuelCoal) : dimSpan('无'));
  if (!e.hasFuel()) { api.status('已暂停：缺煤，加入煤作燃料', 'warn'); return; }
  if (e.holding) {
    api.status(e.blocked ? '已暂停：放货格已满，卡住 ' + ITEMS[e.holding].name : '搬运中：' + ITEMS[e.holding].name, e.blocked ? 'warn' : 'ok');
    return;
  }
  if (e.rotating) { api.status('工作中：转向取货格', 'ok'); return; }
  const s = e.entAtPick();
  const it = e.peekSource(s);
  if (!it) { api.status('已暂停：取货格无物品可取', 'warn'); return; }
  if (!e.canDropAt(e.entAtDrop(), it)) api.status('已暂停：放货格已满', 'warn');
  else api.status('待机：等待取货格出现货物', 'ok');
}
function burnerInserterTip(e) {
  if (!e.hasFuel()) return '燃料机械臂：缺煤停摆';
  return e.holding ? ('搬运 ' + ITEMS[e.holding].name) : '燃料机械臂：烧煤待机';
}

// ===== 注册 =====
const burnerInserterPanel = { html: burnerInserterPanelHtml, live: burnerInserterPanelLive, tip: burnerInserterTip };
ENT_CLASSES['burner-inserter'] = BurnerInserter;
DEVICE_RENDER['burner-inserter'] = drawBurnerInserter;
DEVICE_STATUS['burner-inserter'] = e => e.holding || e.rotating ? (e.blocked ? 'y' : 'g') : (e.hasFuel() ? 'r' : 'r');
DEVICE_PANEL['burner-inserter'] = burnerInserterPanel;
DEVICE_DIR_ROTATE['burner-inserter'] = true;
