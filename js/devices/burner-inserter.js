'use strict';

// ===== 热能机械臂 Burner Inserter（对齐《异星工厂》Burner inserter）=====
// 烧煤驱动的机械臂：无需电力，开局即可用。与普通机械臂一样严格单向取放，
// 但工作时需要持续消耗煤作燃料（像热能采矿机）。
// 可放入组装机/石炉/采矿机等邻格设备取放物品，也可从燃料箱/机械臂供煤。
// 自补给优先：储备燃料 ≤ BURNER_SELF_FEED_MAX 时先从取物格给自己抓燃料
// （一次 1 个直接入炉，不看筛选白/黑名单——活命优先），储备 > 阈值后才为
// 放物目标搬运；炉膛烧空时也允许转身自救，无煤可抓且炉膛已空才停摆。
// 自补给可抓的燃料类型（与 giveItem 接受的一致），列表顺序即取用优先级：煤 > 木材 > 固体燃料 > 火箭燃料
const BURNER_FUELS = ['coal', 'wood', 'solid-fuel', 'rocket-fuel'];
// 自补给阈值：储备燃料（燃料仓未烧的件数之和，不含正在烧的 burnLeft）≤ 2 时优先自补给
const BURNER_SELF_FEED_MAX = 2;
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
  // 储备燃料总件数（燃料仓里还没烧的；不含正在炉膛里烧的 burnLeft）
  fuelStored() {
    return this.fuelCoal + this.fuelWood + this.fuelSolid + this.fuelRocket;
  }
  // ===== 自补给优先（本类核心行为）=====
  // 空手且储备 ≤ BURNER_SELF_FEED_MAX：先转身到取物格给自己抓燃料（一次 1 个直接入炉），
  // 不为放物目标搬运；直到储备 > 阈值才恢复标准取放。
  // 炉膛彻底烧空也允许转身自补给（自救：避免守着燃料带却饿死的死锁）；
  // 取物格没有燃料可抓时：炉膛还有火则照常搬运，烧空且无燃料才停摆等待。
  update(dt) {
    this._selfFeed = false;
    if (this.holdingCount <= 0 && this.fuelStored() <= BURNER_SELF_FEED_MAX) {
      if (this.selfFeedUpdate(dt)) {
        // 本帧用于自补给（转身/等待/进食）：转身按时间烧燃料（烧空时 consumeFuel 无事可烧）
        this._selfFeed = true;
        if (this.rotating) this.consumeFuel(dt);
        this._fuelT = 0;
        return;
      }
      if (!this.hasFuel()) { this._probeT = 0.15; return; }   // 无燃料可自补且烧空：停摆等待
    }
    // 储备充足（> 阈值）/ 持物途中 / 低储备但无燃料可自补：走标准取放状态机
    super.update(dt);
    const isWorking = this.holdingCount > 0 || this.rotating;
    if (isWorking) this.consumeFuel(dt);
    this._fuelT = 0;
  }
  // 自补给子状态机：转身到取物格 → 到位后降频抓 1 个燃料入炉（约 5 次/秒，惰性调度）。
  // 返回 true = 本帧用于自补给（保持自补给模式）；false = 取物格没有可抓的燃料，交还控制权。
  selfFeedUpdate(dt) {
    if (!this.circuitEnabled()) { this.rotating = false; return true; }   // 电路条件不满足：停转等待
    if (this.armAng === undefined) this.armAng = this.pickAng();
    const step = Math.PI * 4.4 * (this.rotSpeed || 1) * dt;
    const target = this.pickAng();
    this.blocked = false;
    if (Math.abs(angNorm(target - this.armAng)) >= 0.05) {
      this.rotating = true;
      this.armAng = approachAng(this.armAng, target, step);
      if (Math.abs(angNorm(target - this.armAng)) < 0.05) this.armAng = target;
      return true;
    }
    this.rotating = false;
    this.armAng = target;
    this._sfProbeT = (this._sfProbeT || 0) - dt;
    if (this._sfProbeT > 0) return true;
    this._sfProbeT = 0.15;
    if (this.trySelfFeed()) {
      if (typeof onScreen === 'function' && onScreen(this) && typeof playSfx === 'function') playSfx('inserter');
      return true;
    }
    // 没抓到燃料：清零标准状态机的探测节流再交还控制权，让父级本帧立即探测正常取物
    //（否则父级 _probeT 只在偶尔落进来的帧里递减，低储备无燃料源时的搬运会被拖慢）
    this._probeT = 0;
    return false;
  }
  // 从取物格抓 1 个燃料（按 BURNER_FUELS 优先级）直接吃进自己的燃料仓。
  // 复用 takeNFrom 的取物语义（传送带近侧优先 / 箱子 takeItemOf），一次只吃 1 个；
  // 储备 ≤ 2 时各燃料槽都远未到上限（5），giveItem 必成功。不看筛选名单（活命优先）。
  trySelfFeed() {
    const s = this.entAtPick();
    if (!s) return false;
    for (const f of BURNER_FUELS) {
      if (this.takeNFrom(s, f, 1).length) {
        this.giveItem(f);
        return true;
      }
    }
    return false;
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

// ===== 渲染：热能机械臂（主配色黑灰 + 转台尾部炉膛火光，见 drawInserter）=====
function drawBurnerInserter(ctx, e, gx, gy, dir, alpha) {
  // 复用通用机械臂绘制（黑灰主题 + 炉膛火光 + 缺燃料红 LED），再叠加燃料槽
  drawInserter(ctx, e, gx, gy, dir, alpha);
  const px = gx * TILE, py = gy * TILE;
  ctx.save();
  ctx.globalAlpha = alpha;
  // 底部燃料槽（贴地，紧挨基座下方）：橙=余量，暗红=耗尽（缺料警示由基座右上红闪 LED 承担）
  ctx.fillStyle = '#15181c';
  rr(ctx, px + 6, py + 27, TILE - 12, 4, 2); ctx.fill();
  const pct = e.hasFuel() ? Math.min(1, (e.burnLeft + e.fuelCoal * 4 + e.fuelSolid * 4 + e.fuelRocket * 4 + e.fuelWood) / 5) : 0;
  ctx.fillStyle = pct > 0 ? '#e8762c' : '#8a2c1c';
  rr(ctx, px + 7, py + 27.7, (TILE - 14) * pct, 2.6, 1.3); ctx.fill();
  ctx.restore();
}

// ===== 面板 =====
function burnerInserterPanelHtml(e) {
  return row('燃料', (e.fuelRocket > 0 || e.fuelSolid > 0 || e.fuelCoal > 0 || e.fuelWood > 0) ? '<div class="asm3-inp-row">' + itemSlotsHtml({ 'rocket-fuel': e.fuelRocket, 'solid-fuel': e.fuelSolid, 'coal': e.fuelCoal, 'wood': e.fuelWood }, { action: 'display' }) + '</div>' : '<span class="dim">无</span>', 'fuel') +
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
  api.set('fuel', (e.fuelRocket > 0 || e.fuelSolid > 0 || e.fuelCoal > 0 || e.fuelWood > 0) ? '<div class="asm3-inp-row">' + itemSlotsHtml({ 'rocket-fuel': e.fuelRocket, 'solid-fuel': e.fuelSolid, 'coal': e.fuelCoal, 'wood': e.fuelWood }, { action: 'display' }) + '</div>' : dimSpan('无'));
  if (!e.hasFuel()) { api.status('已暂停：缺燃料，加入煤/固体燃料/火箭燃料', 'warn'); return; }
  inserterPanelLive(e, api, body);   // 复用普通机械臂的状态/图标/抓取刷新
}
function burnerInserterTip(e) {
  if (e.fuelStored() <= BURNER_SELF_FEED_MAX) {
    return e.hasFuel() ? '热能机械臂：燃料不足，优先自补给中' : '热能机械臂：燃料耗尽，等待自补给';
  }
  return e.holding ? ('搬运 ' + ITEMS[e.holding].name) : '热能机械臂：待机';
}

// ===== 注册 =====
const burnerInserterPanel = { html: burnerInserterPanelHtml, live: burnerInserterPanelLive, tip: burnerInserterTip, onAction: burnerInserterOnAction };
ENT_CLASSES['burner-inserter'] = BurnerInserter;
DEVICE_RENDER['burner-inserter'] = drawBurnerInserter;
DEVICE_STATUS['burner-inserter'] = e => (e.holding || e.rotating || e._selfFeed) ? (e.blocked ? 'y' : 'g') : 'r';
DEVICE_PANEL['burner-inserter'] = burnerInserterPanel;
DEVICE_DIR_ROTATE['burner-inserter'] = true;
