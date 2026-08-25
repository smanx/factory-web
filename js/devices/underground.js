'use strict';

// ===== 地下传送带（含快速版）=====
class Underground extends Entity {
  constructor(type, x, y) {
    super(type || 'underground', x, y);
    this.items = [];
    this.outItems = [];
    this.cd = 0;
  }
  maxDist() { return this.type === 'fast-underground-belt' ? FAST_UNDERGROUND_MAX : UNDERGROUND_MAX; }
  findMate() {
    for (let k = 1; k <= this.maxDist(); k++) {
      const nx = this.x + DX[this.dir] * k, ny = this.y + DY[this.dir] * k;
      const t = entAt(nx, ny);
      if (!t) continue;
      if (t instanceof Underground) return (t.dir === this.dir && t.type === this.type) ? t : null;
      // 地下传送带可跨过固体障碍（建筑/水域），这正是它的用途：
      // 拖动铺设遇障碍时自动配一对地下带即可钻过障碍继续铺。
    }
    return null;
  }
  speedMult() { return this.type === 'fast-underground-belt' ? FAST_BELT_MULT : 1; }
  // 与同档传送带完全一致的吞吐：地上传送带为双列（两条独立车道并行），
  // 每列按 BELT_SPACING 间距各走一件，总吞吐 = 单列 × 2。地下带以单队列在隧道内
  // 输送，为达到与地上双列带相同的总吞吐，发送间隔须为单列的一半：
  //   间隔 = 间距 / (带速 × 2)
  // 基础带：0.125 / (1.875 × 2) ≈ 0.0333s/件 → 30 items/s，与地上基础带一致（对齐《异星工厂》）。
  ugInterval() { return BELT_SPACING / Math.max(0.05, beltSpeed() * this.speedMult() * 2); }
  update(dt) {
    // 惰性调度（P0 优化）：入口/出口都空时无需每帧扫描
    if ((!this.items || !this.items.length) && (!this.outItems || !this.outItems.length)) return;
    const iv = this.ugInterval();
    this.cd -= dt;
    // 未配对的地下带仅作静态显示，不传送任何物品：清空缓存并直接待机
    if (!this.isPaired()) {
      if (this.items.length || this.outItems.length) {
        this.items = []; this.outItems = [];
      }
      return;
    }
    const mate = this.findMate();
    // 只与离它最近的那一个配对：地下带只作为“入口”向前输送，当且仅当它
    // 后方没有另一座同向同档地下带（即它是链的起点）。一旦后方已有配对，
    // 它就是“出口”，把收到的货投向地面，而不再继续把货转给更前方的地下带，
    // 从而避免 A→B→C 整条链一路把货送到最远的出口（对齐《异星工厂》配对逻辑）。
    if (mate && !this.findBackMate()) {
      // 入口：把本格收进 items 的货以及后方入口转来的 outItems 一并送往最近的前方出口，
      // 绝不向地面带外溢，保证“进洞的货只能从出口出来”。
      if (this.cd <= 0 && mate.outItems.length < UG_CAP) {
        if (this.items.length > 0) {
          mate.outItems.push(this.items.shift());
          this.cd = iv;
        } else if (this.outItems.length > 0) {
          mate.outItems.push(this.outItems.shift());
          this.cd = iv;
        }
      }
    } else if (this.findBackMate()) {
      // 出口：后方已有配对，把收到的货投向地面（前方带/设备），不再转给更前方。
      this.ejectT = (this.ejectT || 0) - dt;
      if (this.outItems.length > 0 && this.ejectT <= 0) {
        const nx = this.x + DX[this.dir], ny = this.y + DY[this.dir];
        let sent = false;
        const t = entAt(nx, ny);
        if (t instanceof Belt) {
          if (!(t instanceof Splitter) && t.dir === ((this.dir + 2) % 4)) sent = false;
          // 把隧道内物品的 lane 作为 laneHint 传给下游传送带，保证左线进从右线（同一 lane）
          // 出来，右线进的也从同一 lane 出来，不会在两条车道间混合/轮流装载（与地上传送带一致）。
          else sent = t.acceptItem(this.outItems[0].item, this.dir, undefined, undefined, this.outItems[0].lane);
        } else if (t && !(t instanceof Underground)) {
          sent = t.giveItem(this.outItems[0].item);
        }
        if (sent) { this.outItems.shift(); this.ejectT = iv; }
        else this.ejectT = 0.15;
      }
    }
  }
  // 是否作为“出口”：后方已有同向同档地下带配对（无论前方是否还有更远的带）。
  // 出口把收到的货投向地面，不再向更前方的地下带转送（只与最近者配对）。
  isExit() { return !!this.findBackMate(); }
  // 是否作为“入口”：前方有同向同档地下带配对，且后方没有配对（是链的起点）。
  // 入口把货送向最近的前方出口。
  isEntrance() { return !this.findBackMate() && !!this.findMate(); }
  findBackMate() {
    for (let k = 1; k <= this.maxDist(); k++) {
      const nx = this.x - DX[this.dir] * k, ny = this.y - DY[this.dir] * k;
      const t = entAt(nx, ny);
      if (!t) continue;
      if (t instanceof Underground) return (t.dir === this.dir && t.type === this.type) ? t : null;
      // 同 findMate：可跨过固体障碍配对。
    }
    return null;
  }
  // 是否已配对（前方或后方有同向同档地下带）。
  // 未配对的地下带仅作静态显示，不参与任何物品传输（对齐《异星工厂》）。
  isPaired() { return !!(this.findMate() || this.findBackMate()); }
  // 与地上传送带一致的双线逻辑：接收带 laneHint 的物品，进入地下时保留其所在车道
  // （lane 0/1），隧道内两条线路各自独立、互不混合，出口按同一 lane 送出（左进左出/右进右出）。
  acceptItem(item, fromDir, sx, sy, laneHint) {
    if (this.items.length >= UG_CAP) return false;
    // 未配对的地下带不接收任何物品（不搭在其他传送带上、不传送，仅显示）
    if (!this.isPaired()) return false;
    const lane = (laneHint !== undefined && laneHint !== null) ? (laneHint === 1 ? 1 : 0) : 0;
    this.items.push({ item, lane });
    return true;
  }
  // 机械臂抓取：优先取出口待发（outItems），其次取入口缓存（items）。
  // 这样机械臂既能抓地下带出口即将喷射的货，也能抓入口尚未送入地下的缓存。
  peekItem() {
    if (this.outItems.length) return this.outItems[0].item;
    if (this.items.length) return this.items[0].item;
    return null;
  }
  countOf(item) {
    let n = 0;
    for (const it of this.outItems) if (it.item === item) n++;
    for (const it of this.items) if (it.item === item) n++;
    return n;
  }
  takeItemOf(item) {
    let i = this.outItems.findIndex(o => o.item === item);
    if (i >= 0) return this.outItems.splice(i, 1)[0].item;
    i = this.items.findIndex(o => o.item === item);
    if (i >= 0) return this.items.splice(i, 1)[0].item;
    return null;
  }
  takeOutput() {
    return this.outItems.length ? this.outItems.shift().item : null;
  }
  takeItem() {
    if (this.outItems.length) return this.outItems.shift().item;
    if (this.items.length) return this.items.shift().item;
    return null;
  }
  giveItem(item, fromDir, sx, sy, laneHint) { return this.acceptItem(item, fromDir, sx, sy, laneHint); }
  contents() {
    const list = [[this.type, 1]];
    for (const it of [...this.items, ...this.outItems]) list.push([it.item, 1]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.items = this.items.map(o => ({ item: o.item, lane: o.lane }));
    s.outItems = this.outItems.map(o => ({ item: o.item, lane: o.lane }));
    return s;
  }
  static restore(s) {
    const u = super.restore(s);
    // 兼容旧存档（纯物品 id 数组）：统一转为 { item, lane } 对象
    const norm = a => (a || []).map(o => (typeof o === 'string' ? { item: o, lane: 0 } : { item: o.item, lane: o.lane }));
    u.items = norm(s.items);
    u.outItems = norm(s.outItems);
    u.cd = 0;
    return u;
  }
}

class FastUnderground extends Underground {
  constructor(type, x, y) { super(type || 'fast-underground-belt', x, y); }
}

// ===== 渲染 =====
// 地下传送带各档配色（基础=黄，高速=红，极速=蓝；对齐传送带/分流器配色）
function undergroundColors(e) {
  const fast = e.type === 'fast-underground-belt';
  const express = e.type === 'express-underground-belt';
  if (express) {
    return {
      in:  { body: '#2e3a52', acc: '#5a9ae0', badge: '#3f78c8' },
      out: { body: '#26344a', acc: '#6aa5e8', badge: '#3568b0' },
      idle:{ body: '#2c3544', acc: '#4a6a92', badge: '#4a5a78' },
    };
  }
  if (fast) {
    return {
      in:  { body: '#5a2a28', acc: '#e05a4e', badge: '#c04a3a' },
      out: { body: '#4a302a', acc: '#e07060', badge: '#a84030' },
      idle:{ body: '#3c4046', acc: '#9a6a60', badge: '#6a4a44' },
    };
  }
  return {
    in:  { body: '#4a4436', acc: '#e0b23c', badge: '#c9972e' },
    out: { body: '#3f3c2c', acc: '#d4a230', badge: '#b0852a' },
    idle:{ body: '#3c4046', acc: '#9a9a70', badge: '#6a6a50' },
  };
}

function drawUnderground(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  const st = e.isEntrance() ? 'in' : (e.isExit() ? 'out' : 'idle');
  const uc = undergroundColors(e);
  const bodyCol = uc[st].body;
  const accCol = uc[st].acc;

  ctx.globalAlpha = alpha;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(dir * Math.PI / 2);

  ctx.fillStyle = bodyCol;
  rr(ctx, -14, -11, 28, 22, 5);
  ctx.fill();
  if (st === 'idle') ctx.setLineDash([4, 3]);
  ctx.strokeStyle = accCol;
  ctx.lineWidth = 2;
  rr(ctx, -14, -11, 28, 22, 5);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = accCol;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-9, 0);
  ctx.lineTo(2, 0);
  ctx.stroke();
  ctx.fillStyle = accCol;
  tri(ctx, 0, -5, 0, 5, 9, 0);
  ctx.fill();

  if (st !== 'idle') {
    ctx.fillStyle = accCol;
    for (let k = 0; k < 3; k++) {
      const t = ((G.time * 0.9) + k / 3) % 1;
      let dx2, a;
      if (st === 'in') { dx2 = -11 + t * 10; a = t < 0.7 ? 0.95 : Math.max(0, (1 - t) * 3.3); }
      else { dx2 = -1 + t * 10; a = t < 0.3 ? t * 3.3 : 0.95; }
      ctx.globalAlpha = alpha * a;
      ctx.beginPath();
      ctx.arc(dx2, 0, 2.4, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = alpha;
  }

  const n = Math.min(e.items.length + e.outItems.length, 6);
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  for (let i = 0; i < n; i++) ctx.fillRect(-9 + i * 3.4, 8, 2.4, 2.4);

  ctx.restore();

  const badge = st === 'in' ? '入' : st === 'out' ? '出' : '—';
  const bcol = uc[st].badge;
  ctx.fillStyle = bcol;
  rr(ctx, px + 2, py + 2, 15, 13, 3);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 9px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badge, px + 9.5, py + 9);
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function undergroundPanelHtml(e) {
  let txt;
  if (e.isEntrance()) txt = '【入口】货物钻入地下送往最近的前方出口。缓存 ' + e.items.length + '/' + UG_CAP + '，待发 ' + e.outItems.length;
  else if (e.isExit()) txt = '【出口】接收后方隧道来货并向前输出（只与最近者配对，不再向更前方转送）。待发 ' + e.outItems.length;
  else txt = '【未配对】同向' + e.maxDist() + '格内没有另一座。仅作显示，不接收/不传送物品。缓存 ' + e.items.length + '/' + UG_CAP;
  return '<div class="dim">地下带' + txt + '。R 旋转方向。</div><div class="status"></div>';
}
function undergroundPanelLive(e, api) {
  const paired = e.isPaired();
  const n = e.items.length + e.outItems.length;
  if (!paired) api.status('仅显示：未配对（同向 ' + e.maxDist() + ' 格内无另一座地下带），不接收/不传送物品', 'warn');
  else if (e.outItems.length >= UG_CAP || e.items.length >= UG_CAP) api.status('已暂停：缓存已满，等待输出', 'warn');
  else if (n > 0) api.status('输送中：' + n + ' 件在途', 'ok');
  else api.status('待机：已配对，等待货物', 'ok');
}

// ===== 注册 =====
function undergroundStatusFn(e) {
  const paired = e.isPaired();
  if (paired) {
    if (e.outItems.length >= UG_CAP || e.items.length >= UG_CAP) return 'y';
    return (e.items.length + e.outItems.length) > 0 ? 'g' : 'r';
  }
  return 'r';
}
ENT_CLASSES['underground'] = Underground;
ENT_CLASSES['fast-underground-belt'] = FastUnderground;
DEVICE_RENDER['underground'] = drawUnderground;
DEVICE_RENDER['fast-underground-belt'] = drawUnderground;
DEVICE_STATUS['underground'] = undergroundStatusFn;
DEVICE_STATUS['fast-underground-belt'] = undergroundStatusFn;
DEVICE_PANEL['underground'] = { html: undergroundPanelHtml, live: undergroundPanelLive };
DEVICE_PANEL['fast-underground-belt'] = { html: undergroundPanelHtml, live: undergroundPanelLive };
DEVICE_DIR_ROTATE['underground'] = true;
DEVICE_DIR_ROTATE['fast-underground-belt'] = true;
