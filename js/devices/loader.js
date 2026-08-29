'use strict';

// ===== 装载机 Loader（对齐《异星工厂》Loader）=====
// 官方 base 物流设备：放置在传送带末端，把传送带上的物品「装载」进相邻容器/机器，
// 或把容器/机器的物品「卸载」到传送带（由朝向与相邻设备自动判断装载/卸载模式）。
// 数据（占地/血量/堆叠/速度）全部来自 GAME_DATA（factorio-data 单源）。
//
// 朝向约定（dir 指向 loader 的「前方」）：
//   - 装载模式：前方是容器/机器（可 giveItem）、后方是传送带 → 从后方传送带取物放入前方容器；
//   - 卸载模式：前方是传送带、后方是容器（可 peekItem）      → 从后方容器取物放入前方传送带。
// 处理速率：每个搬运周期（由官方 speed 换算）搬运 1 个物品。

const LOADER_TYPES = ['loader', 'fast-loader', 'express-loader', 'turbo-loader'];

class Loader extends Entity {
  constructor(type, x, y) {
    super(type || 'loader', x, y);
    this.prog = 0;          // 搬运进度累加器（单位=物品数）
    this.mode = null;       // 缓存当前模式 'load' | 'unload' | null
    this.frontType = '';    // 缓存前方设备类型（用于面板显示）
    this.backType = '';     // 缓存后方设备类型
  }
  applyDir() {
    // rotSwap 类设备：横向(1/3)交换宽高（官方 loader 占地 1×2）
    if (this.dir % 2 === 1) { this.w = this.def.h; this.h = this.def.w; }
    else { this.w = this.def.w; this.h = this.def.h; }
  }
  // loader 的官方速度（格/s）——数据单源：来自 GAME_DATA.deviceStats.beltSpeed
  // （factorio-data 官方 speed(格/tick)×60 换算，由 generate-game-data.js 生成），
  // 设备侧不再单独维护第二套速度数值表。
  speed() {
    const ds = GAME_DATA.deviceStats && GAME_DATA.deviceStats[this.type];
    if (ds && typeof ds.beltSpeed === 'number') return ds.beltSpeed; // 格/s
    return 0;
  }
  // 每秒搬运件数：beltSpeed 为官方 speed(格/tick)×60=格/s（如基础装载机 1.875 格/s），
  // 每格可承载 1/BELT_SPACING 件 → 每秒搬运件数 = beltSpeed / BELT_SPACING。
  rate() {
    return Math.max(1, Math.round(this.speed() / BELT_SPACING));
  }
  // 前方/后方对接排：loader 朝向（dir）方向紧邻的一整排格（垂直于 dir 的跨度）
  // 装载机为 1×2/2×1 rotSwap 设备，朝向横向（dir 0/2）时对接 2 格、纵向（dir 1/3）时对接 1 格。
  _edgeCells(dir) {
    const cells = [];
    if (dir === 0) {           // 朝右：出口排 x=x+w，覆盖 y..y+h-1
      const ex = this.x + this.w;
      for (let dy = 0; dy < this.h; dy++) cells.push([ex, this.y + dy]);
    } else if (dir === 2) {    // 朝左：出口排 x=x-1
      const ex = this.x - 1;
      for (let dy = 0; dy < this.h; dy++) cells.push([ex, this.y + dy]);
    } else if (dir === 1) {    // 朝下：出口排 y=y+h，覆盖 x..x+w-1
      const ey = this.y + this.h;
      for (let dx = 0; dx < this.w; dx++) cells.push([this.x + dx, ey]);
    } else {                   // 朝上：出口排 y=y-1
      const ey = this.y - 1;
      for (let dx = 0; dx < this.w; dx++) cells.push([this.x + dx, ey]);
    }
    return cells;
  }
  _entities(dir) {
    const set = [];
    for (const [cx, cy] of this._edgeCells(dir)) {
      const e = entAt(cx, cy);
      if (e && set.indexOf(e) < 0) set.push(e);
    }
    return set;
  }
  _frontList() { return this._entities(this.dir); }
  _backList() { return this._entities((this.dir + 2) % 4); }
  // 前方第一个「接收方」容器/机器
  _frontReceiver() {
    for (const e of this._frontList()) if (this._isReceiver(e)) return e;
    return null;
  }
  // 前方第一个「传送带」
  _frontBelt() {
    for (const e of this._frontList()) if (this._isBelt(e)) return e;
    return null;
  }
  // 后方第一个「源」容器/机器
  _backSource() {
    for (const e of this._backList()) if (this._isSource(e)) return e;
    return null;
  }
  // 后方第一个「传送带」
  _backBelt() {
    for (const e of this._backList()) if (this._isBelt(e)) return e;
    return null;
  }
  // 判断一个实体是否为「可接收物品的容器/机器」
  _isReceiver(t) {
    return t && typeof t.giveItem === 'function' && !(t instanceof Belt);
  }
  // 判断一个实体是否为「可取出物品的容器/机器」
  _isSource(t) {
    return t && typeof t.takeItemOf === 'function' && !(t instanceof Belt);
  }
  // 判断是否为传送带（含分流器）
  _isBelt(t) { return t instanceof Belt && typeof t.acceptItem === 'function'; }
  // 实时判定模式：装载（前容器后带）/ 卸载（前带后容器）
  detectMode() {
    const frontRcv = this._frontReceiver(), backBelt = this._backBelt();
    const frontBelt = this._frontBelt(), backSrc = this._backSource();
    if (backBelt && frontRcv) return 'load';
    if (frontBelt && backSrc) return 'unload';
    return null;
  }
  // 从传送带装载 1 个物品到前方容器
  _doLoad() {
    const belt = this._backBelt(), dest = this._frontReceiver();
    if (!belt || !dest) return false;
    // 优先抓取靠近 loader 的车道，取最前端物品
    const z = belt.grabZone && belt.grabZone();
    if (!z) return false;
    const item = z.item;
    if (dest.giveItem && dest.giveItem(item)) {
      belt.items.splice(belt.items.indexOf(z), 1);
      return true;
    }
    return false;
  }
  // 从后方容器卸载 1 个物品到前方传送带
  _doUnload() {
    const src = this._backSource(), belt = this._frontBelt();
    if (!src || !belt) return false;
    const item = (typeof src.peekItem === 'function') ? src.peekItem() : null;
    if (!item) return false;
    if (!belt.acceptItem(item, (this.dir + 2) % 4, this.x, this.y)) return false;
    src.takeItemOf(item);
    return true;
  }
  update(dt) {
    // 面板缓存模式/设备名
    const f = this._frontReceiver() || this._frontBelt();
    const b = this._backSource() || this._backBelt();
    this.frontType = f ? f.type : '';
    this.backType = b ? b.type : '';
    this.mode = this.detectMode();
    if (!this.mode) { this.prog = 0; return; }
    // 搬运进度：rate 件/秒
    this.prog += dt * this.rate();
    let n = Math.floor(this.prog);
    if (n <= 0) return;
    let moved = 0;
    // 每次 update 至多搬运 prog 中整数部分件数，逐个尝试
    for (let i = 0; i < n; i++) {
      const ok = this.mode === 'load' ? this._doLoad() : this._doUnload();
      if (!ok) break;
      moved++;
    }
    this.prog -= moved;
    if (moved <= 0) this.prog = 0; // 搬运停滞时清零，避免无限累加
  }
  // 从传送带取物品（供机械臂/玩家取）——loader 本身不存物，取传送带货物
  peekItem() {
    const b = this._backSource() || this._backBelt();
    if (b && b.peekItem) return b.peekItem();
    return null;
  }
  takeItem() {
    const b = this._backSource() || this._backBelt();
    if (b && b.takeItem) return b.takeItem();
    return null;
  }
}

// ===== 渲染 =====
function drawLoader(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  // 按方向决定绘制矩形（rotSwap：横向时 w/h 已交换）
  const W = e.w * TILE, H = e.h * TILE;
  const cx = px + W / 2, cy = py + H / 2;
  ctx.globalAlpha = alpha;
  // 主体：传送带式底座（朝向方向）
  const col = { 'loader': '#8a8478', 'fast-loader': '#d07b28', 'express-loader': '#3a8bd8', 'turbo-loader': '#d84ad8' }[e.type] || '#8a8478';
  ctx.fillStyle = col;
  ctx.fillRect(px + 2, py + 2, W - 4, H - 4);
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(px + 2, py + 2, W - 4, H - 4);
  // 方向箭头（指向 loader 前方）
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  const fx = DX[dir], fy = DY[dir];
  const ax = cx + fx * (Math.min(W, H) * 0.18), ay = cy + fy * (Math.min(W, H) * 0.18);
  // 三角箭头
  ctx.beginPath();
  ctx.moveTo(ax + fx * 6, ay + fy * 6);
  ctx.lineTo(ax - fy * 5, ay + fx * 5);
  ctx.lineTo(ax + fy * 5, ay - fx * 5);
  ctx.closePath();
  ctx.fill();
  // 中央装载滚筒（旋转动画暗示运转）
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.beginPath();
  ctx.arc(cx, cy, Math.min(W, H) * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.globalAlpha = 1;
}
// 模式标记（装载/卸载状态灯）
function loaderStatus(e) {
  const m = e.mode;
  if (m === 'load') return 'g';   // 装载中
  if (m === 'unload') return 'g'; // 卸载中
  return 'r';                     // 未连接
}
function loaderTip(e) {
  const m = e.detectMode ? e.detectMode() : null;
  if (m === 'load') return '装载机：传送带 → ' + (e.frontType || '容器');
  if (m === 'unload') return '装载机：' + (e.backType || '容器') + ' → 传送带';
  return '装载机：需一端接传送带、另一端接容器/机器';
}

// ===== 面板 =====
function loaderPanelHtml() {
  return '<div class="dim">装载机（Loader）：传送带物流设备，放置在传送带末端。</div>' +
    '<div class="dim">· 装载模式：后方接传送带、前方接容器/机器 → 传送带物品自动装入容器；</div>' +
    '<div class="dim">· 卸载模式：后方接容器、前方接传送带 → 容器物品自动卸到传送带。</div>' +
    '<div class="dim">R 旋转朝向；处理速率由官方速度决定。数据全部来自 data.generated.js。</div>';
}

function loaderPanelLive(e, api) {
  const m = e.detectMode ? e.detectMode() : null;
  if (m === 'load') api.status('装载中：' + (e.backType || '传送带') + ' → ' + (e.frontType || '容器') + '（' + e.rate() + ' 件/秒）', 'g');
  else if (m === 'unload') api.status('卸载中：' + (e.backType || '容器') + ' → ' + (e.frontType || '传送带') + '（' + e.rate() + ' 件/秒）', 'g');
  else api.status('未连接：一端接传送带、另一端接容器/机器', 'r');
}
const loaderPanel = { html: loaderPanelHtml, live: loaderPanelLive, tip: loaderTip };

// ===== 注册 =====
for (const t of LOADER_TYPES) {
  ENT_CLASSES[t] = Loader;
  DEVICE_RENDER[t] = drawLoader;
  DEVICE_STATUS[t] = loaderStatus;
  DEVICE_PANEL[t] = loaderPanel;
  DEVICE_DIR_ROTATE[t] = true; // R 旋转朝向（rotSwap 设备）
}
