'use strict';

// ===== 地下传送带（含快速版）=====
class Underground extends Entity {
  constructor(type, x, y) {
    super(type || 'underground-belt', x, y);
    this.items = [];
    this.outItems = [];
    // 双列（对齐《异星工厂》）：隧道内两条独立车道各用一套累积计时器推进，互不混合。
    this.cd = [0, 0];   // 入口 → 出口 传输计时器（lane0 / lane1）
    this.ejectT = [0, 0]; // 出口 → 地面 喷射计时器（lane0 / lane1）
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
  // 与同档传送带完全一致的双车道合计吞吐：面板/数值以「双车道总速度」计（基础带=15 件/秒）。
  // 隧道内两条车道（lane0/lane1）各自独立推进，每车道吞吐 = 双车道合计的一半。
  // 每车道发送一件的间隔：
  //   间隔 = 2 × 间距 / 带速
  // 基础带：0.25 / 1.875 ≈ 0.1333s/件 → 每车道 7.5、双车道合计 15 items/s，与地上基础带一致。
  ugInterval() { return (2 * BELT_SPACING) / Math.max(0.05, beltSpeed() * this.speedMult()); }
  update(dt) {
    // 惰性调度（P0 优化）：入口/出口都空时无需每帧扫描
    if ((!this.items || !this.items.length) && (!this.outItems || !this.outItems.length)) return;
    const iv = this.ugInterval();
    // 累积计时器（而非倒计时）：按真实经过时间批量转移/喷射，
    // 避免高速档（iv < 帧时长 dt）时被帧率封顶（例如极速带 60fps 下只能 60 件/秒）。
    this.cd[0] += dt; this.cd[1] += dt;
    this.ejectT[0] += dt; this.ejectT[1] += dt;
    // 未配对的地下带仅作静态显示，不传送任何物品：清空缓存并直接待机
    if (!this.isPaired()) {
      if (this.items.length || this.outItems.length) {
        this.items = []; this.outItems = [];
      }
      return;
    }
    // 只与离它最近的那一个配对：入口 → 最近前方出口；出口 → 后方入口。
    // 贪心交替配对：链上第1座是入口，第2座是出口，第3座是入口，第4座是出口……
    // 通过 isEntrance()/isExit() 递归判定，确保每座出口的后方入口尚未被占用。
    if (this.isEntrance()) {
      const mate = this.findMate();
      // 入口：把本格收进 items 的货送往最近的前方出口，
      // 绝不向地面带外溢，保证"进洞的货只能从出口出来"。
      // 双列：两条车道（lane0/lane1）各自独立传输，每列按单列间隔 iv 推进，互不混合。
      if (mate) {
        this._transferLane(mate, 0, iv);
        this._transferLane(mate, 1, iv);
      }
    } else if (this.isExit()) {
      // 出口：后方已有入口配对，把收到的货投向地面（前方带/设备），不再转给更前方。
      // 双列：两条车道各自独立喷射到地面带对应车道（左进左出/右进右出）。
      this._ejectLane(0, iv);
      this._ejectLane(1, iv);
    }
  }
  // 入口传输单条车道：把本车道（lane）入口缓存 items 里的货送往最近出口的对应车道缓存。
  // 两列独立计时器，各自按单列间隔 iv 推进，互不占用对方队列。
  _transferLane(mate, lane, iv) {
    const cap = UG_CAP; // 每列容量
    let outLane = 0;
    for (const it of mate.outItems) if (it.lane === lane) outLane++;
    // 出口车道已满则不再转移；否则按本车道推进间隔 iv 逐件送往出口对应车道。
    while (this.cd[lane] >= iv && outLane < cap) {
      let moved = false;
      for (let i = 0; i < this.items.length; i++) {
        if (this.items[i].lane === lane) {
          mate.outItems.push(this.items.splice(i, 1)[0]);
          outLane++; moved = true; break;
        }
      }
      if (!moved) {
        for (let i = 0; i < this.outItems.length; i++) {
          if (this.outItems[i].lane === lane) {
            mate.outItems.push(this.outItems.splice(i, 1)[0]);
            outLane++; moved = true; break;
          }
        }
      }
      if (!moved) break;
      this.cd[lane] -= iv;
    }
  }
  // 出口喷射单条车道：把隧道出口缓存 outItems 里对应车道的货投向地面带同车道。
  // 两列独立计时器，各自按单列间隔 iv 喷射，互不占用对方队列。
  _ejectLane(lane, iv) {
    while (this.ejectT[lane] >= iv) {
      // 找出本车道待喷的一件（先进先出）
      let idx = -1;
      for (let i = 0; i < this.outItems.length; i++) if (this.outItems[i].lane === lane) { idx = i; break; }
      if (idx < 0) break;
      const nx = this.x + DX[this.dir], ny = this.y + DY[this.dir];
      let sent = false;
      const t = entAt(nx, ny);
      if (t instanceof Belt) {
        if (!(t instanceof Splitter) && t.dir === ((this.dir + 2) % 4)) sent = false;
        // 把隧道内物品的 lane 作为 laneHint 传给下游传送带，保证左线进从右线（同一 lane）
        // 出来，右线进的也从同一 lane 出来，不会在两条车道间混合/轮流装载（与地上传送带一致）。
        else sent = t.acceptItem(this.outItems[idx].item, this.dir, undefined, undefined, lane);
      } else if (t && !(t instanceof Underground)) {
        sent = t.giveItem(this.outItems[idx].item);
      }
      if (sent) { this.outItems.splice(idx, 1); this.ejectT[lane] -= iv; }
      else { this.ejectT[lane] = 0; break; }  // 下游无空位：清空计时等待下一帧重试
    }
  }
  // 是否作为“出口”：后方已有同向同档地下带配对（无论前方是否还有更远的带）。
  // 出口把收到的货投向地面，不再向更前方的地下带转送（只与最近者配对）。
  isExit() { const back = this.findBackMate(); return back ? back.isEntrance() : false; }
  // 是否作为“入口”：前方有同向同档地下带配对，且后方没有配对（是链的起点）。
  // 入口把货送向最近的前方出口。
  isEntrance() { if (!this.findMate()) return false; const back = this.findBackMate(); return !back || !back.isEntrance(); }
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
  // 容量按双列：每列至多 UG_CAP 件，两列共 2×UG_CAP 件。
  acceptItem(item, fromDir, sx, sy, laneHint) {
    const lane = (laneHint !== undefined && laneHint !== null) ? (laneHint === 1 ? 1 : 0) : 0;
    // 未配对的地下带不接收任何物品（不搭在其他传送带上、不传送，仅显示）
    if (!this.isPaired()) return false;
    // 本车道缓存已满（每列 UG_CAP 件）则拒绝
    let laneCnt = 0;
    for (const it of this.items) if (it.lane === lane) laneCnt++;
    if (laneCnt >= UG_CAP) return false;
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
    u.cd = [0, 0];
    u.ejectT = [0, 0];
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

  // 双列显示：lane0 / lane1 缓存物品分上下两排小方块（各排最多 4 件），直观体现两条独立车道。
  const cntL0 = Math.min(e.items.filter(o => o.lane === 0).length, 4);
  const cntL1 = Math.min(e.items.filter(o => o.lane === 1).length, 4);
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  for (let i = 0; i < cntL0; i++) ctx.fillRect(-8 + i * 3.4, 7, 2.4, 2.4);
  for (let i = 0; i < cntL1; i++) ctx.fillRect(-8 + i * 3.4, 11, 2.4, 2.4);

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
// 双列总容量：每列至多 UG_CAP 件，两列共 2×UG_CAP 件。
function ugCap() { return UG_CAP * 2; }
function undergroundPanelHtml(e) {
  const cap = ugCap();
  let txt;
  if (e.isEntrance()) txt = '【入口】货物钻入地下送往最近的前方出口（双列，每列 ' + UG_CAP + ' 件）。缓存 ' + e.items.length + '/' + cap + '，待发 ' + e.outItems.length;
  else if (e.isExit()) txt = '【出口】接收后方隧道来货并向前输出（只与最近者配对，不再向更前方转送）。待发 ' + e.outItems.length;
  else txt = '【未配对】同向' + e.maxDist() + '格内没有另一座。仅作显示，不接收/不传送物品。缓存 ' + e.items.length + '/' + cap;
  return '<div class="dim">地下带' + txt + '。R 旋转方向。</div>' +
    '<div class="dim">当前吞吐：<span data-live="speed">-</span>（件/秒，双车道合计）</div>' +
    '<div class="status"></div>';
}
function undergroundPanelLive(e, api) {
  const paired = e.isPaired();
  const cap = ugCap();
  const n = e.items.length + e.outItems.length;
  // 地下带面板显示「双车道合计吞吐」（件/秒），与地上传送带口径一致：基础带=15 件/秒。
  const speed = (e.ugInterval ? 2 / e.ugInterval() : 0);
  api.set('speed', (Math.round(speed * 10) / 10) + '');
  if (!paired) api.status('仅显示：未配对（同向 ' + e.maxDist() + ' 格内无另一座地下带），不接收/不传送物品', 'warn');
  else if (e.outItems.length >= cap || e.items.length >= cap) api.status('已暂停：缓存已满，等待输出', 'warn');
  else if (n > 0) api.status('输送中：' + n + ' 件在途（双列）', 'ok');
  else api.status('待机：已配对，等待货物', 'ok');
}

// ===== 注册 =====
function undergroundStatusFn(e) {
  const cap = ugCap();
  const paired = e.isPaired();
  if (paired) {
    if (e.outItems.length >= cap || e.items.length >= cap) return 'y';
    return (e.items.length + e.outItems.length) > 0 ? 'g' : 'r';
  }
  return 'r';
}
ENT_CLASSES['underground-belt'] = Underground;
ENT_CLASSES['fast-underground-belt'] = FastUnderground;
DEVICE_RENDER['underground-belt'] = drawUnderground;
DEVICE_RENDER['fast-underground-belt'] = drawUnderground;
DEVICE_STATUS['underground-belt'] = undergroundStatusFn;
DEVICE_STATUS['fast-underground-belt'] = undergroundStatusFn;
DEVICE_PANEL['underground-belt'] = { html: undergroundPanelHtml, live: undergroundPanelLive };
DEVICE_PANEL['fast-underground-belt'] = { html: undergroundPanelHtml, live: undergroundPanelLive };
DEVICE_DIR_ROTATE['underground-belt'] = true;
DEVICE_DIR_ROTATE['fast-underground-belt'] = true;
