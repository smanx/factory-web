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
        else if (t.dir === this.dir || t instanceof Splitter) {
          // 直通/分流器：把隧道内物品的 lane 作为 laneHint 传给下游传送带，
          // 保证左线进从左线出、右线进从右线出（左进左出/右进右出，与地上直通一致）。
          sent = t.acceptItem(this.outItems[idx].item, this.dir, undefined, undefined, lane);
        } else {
          // 出口接到垂直传送带上 → T 型交叉口（对齐地上传送带的 T 型交叉/转角逻辑）：
          // 1) 可直接转弯（下游带是纯 90° 转角：仅此一个侧面输入、背面无同向直行带）→
          //    双车道物品都能直接转弯流过去：地下两条车道各映射到下游带对应车道（lane 保留）。
          // 2) 不能直接转弯（下游带背面有同向直行带，属一般侧面搭接）→
          //    只能流向最靠近地下带的近侧车道（不带 laneHint，交由下游按 sideOfLane 判定）。
          const isCorner = typeof beltCornerDir === 'function' && beltCornerDir(t) !== null;
          sent = t.acceptItem(this.outItems[idx].item, this.dir, undefined, undefined, isCorner ? lane : undefined);
        }
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
// 地下传送带各档配色（基础=黄，高速=红，极速=蓝，涡轮=绿；对齐传送带/分流器配色）
function undergroundColors(e) {
  const type = e.type;
  if (type === 'express-underground-belt') {
    return {
      in:  { body: '#2e3a52', acc: '#5a9ae0', badge: '#3f78c8' },
      out: { body: '#26344a', acc: '#6aa5e8', badge: '#3568b0' },
      idle:{ body: '#2c3544', acc: '#4a6a92', badge: '#4a5a78' },
    };
  }
  if (type === 'turbo-underground-belt') {
    return {
      in:  { body: '#2f4a33', acc: '#5ab878', badge: '#3a7a4a' },
      out: { body: '#263c2a', acc: '#6ac888', badge: '#2f6a3c' },
      idle:{ body: '#2c3a2e', acc: '#4a8a5a', badge: '#3f6a4a' },
    };
  }
  if (type === 'fast-underground-belt') {
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

// 把十六进制颜色按 amt（可正可负）调亮/调暗，返回可用的颜色串。用于井下层次、带面明暗。
function ugShade(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.min(255, ((n >> 16) & 255) + amt));
  const g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
  const b = Math.max(0, Math.min(255, (n & 255) + amt));
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

// 绘制地下传送带：不再是“一个带箭头的盒子”，而是描绘一条真的钻入/钻出地下的传送带——
// 金属护框包裹的开挖口 + 露出地面的带面 + 一端的井下井口(深坑)。
// 布局（旋转后局部坐标：+X 为行进方向）：
//   入口(in)：井口在前端(+X)，带面从后方延伸、货物随箭头钻入井口；
//   出口(out)：井口在后端(-X)，货物从井口冒出、沿带面向 +X 输送；
//   未配对(idle)：孤井，两头都看不到传送面，用虚线框提示未接通。
function drawUnderground(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  const st = e.isEntrance() ? 'in' : (e.isExit() ? 'out' : 'idle');
  const uc = undergroundColors(e);
  const body = uc[st].body, acc = uc[st].acc;
  const light = ugShade(body, 30), dark = ugShade(body, -28);
  const pitDark = 'rgba(8,10,12,.96)';   // 井下深处
  const busy = st !== 'idle';

  ctx.globalAlpha = alpha;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(dir * Math.PI / 2);

  // ---- 1) 开挖口地面暗影（略超出格边，暗示向下挖开的土坑）----
  ctx.fillStyle = 'rgba(15,17,21,.55)';
  rr(ctx, -16, -13, 32, 26, 5);
  ctx.fill();
  // ---- 2) 金属护框（底板）----
  ctx.fillStyle = body;
  rr(ctx, -15, -12, 30, 24, 5);
  ctx.fill();
  ctx.strokeStyle = light;
  ctx.lineWidth = 1.4;
  rr(ctx, -15, -12, 30, 24, 5);
  ctx.stroke();
  // ---- 3) 中间传送带凹槽 ----
  ctx.fillStyle = dark;
  rr(ctx, -14, -10, 28, 20, 3);
  ctx.fill();

  // 井口(深坑) x 范围。入口=前坑(+X)，出口=后坑(-X)，未配对=后坑但用虚线示孤井。
  let m0 = -15, m1 = -4;
  if (st === 'in') { m0 = 4; m1 = 15; }

  // ---- 4) 传送带表面（从无井口一侧延伸至井口边缘，未配对不画带面）----
  let bx0, bx1;
  if (st === 'in')      { bx0 = -12; bx1 = m0; }
  else if (st === 'out'){ bx0 = m1;  bx1 = 12; }
  else                  { bx0 = -12; bx1 = 12; }
  if (busy) {
    ctx.fillStyle = light;
    ctx.fillRect(bx0, -8, bx1 - bx0, 16);
    // 上下边缘轨道
    ctx.strokeStyle = acc;
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(bx0, -8); ctx.lineTo(bx1, -8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(bx0, 8);  ctx.lineTo(bx1, 8);  ctx.stroke();
    // 中央分割线（双列车道）
    ctx.strokeStyle = ugShade(body, -8);
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(bx0, 0); ctx.lineTo(bx1, 0); ctx.stroke();
    // 车道动效与物品见下方第 6 步（只为“确有物品的车道”绘制，保持与地上带一条/两条一致）
  }

  // ---- 5) 井口（深坑）：传送带入/出地下的洞口 ----
  // 井口护边
  ctx.fillStyle = light;
  rr(ctx, m0, -10, m1 - m0, 20, 2);
  ctx.fill();
  // 井下内部（暗洞）
  ctx.fillStyle = pitDark;
  rr(ctx, m0 + 1.5, -8.5, (m1 - m0) - 3, 17, 1.5);
  ctx.fill();
  // 深度层次：入口方向越深入越暗，出口方向越浅越亮（体现“下钻/上冒”）
  if (busy) {
    const grad = ctx.createLinearGradient(m0, 0, m1, 0);
    if (st === 'in') { grad.addColorStop(0, 'rgba(0,0,0,0)');   grad.addColorStop(1, 'rgba(0,0,0,.9)'); }
    else             { grad.addColorStop(0, 'rgba(0,0,0,.9)'); grad.addColorStop(1, 'rgba(0,0,0,0)'); }
    ctx.fillStyle = grad;
    rr(ctx, m0, -10, m1 - m0, 20, 2);
    ctx.fill();
  }
  // 井口格栅齿（2~3 根竖齿，强化台阶/下沉感；入口加深、出口提亮以示意方向）
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = ugShade(acc, st === 'in' ? -12 : 14);
  for (let t = 0; t < 3; t++) {
    const fx = m0 + 2.6 + t * ((m1 - m0) - 5.2) / 2;
    ctx.beginPath(); ctx.moveTo(fx, -9); ctx.lineTo(fx, 9); ctx.stroke();
  }

  // 未配对：整格虚线框提醒“孤井未接通”（不传送）
  if (st === 'idle') {
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = uc[st].acc;
    ctx.lineWidth = 1.6;
    rr(ctx, -15, -11, 30, 22, 5);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ---- 6) 双列物品流：与正常传送带一致，lane0/lane1（上下两排 / 竖向则左右两列）各自流动 ----
  // 只要地下带在工作(busy)，就始终显示上/下两条车道流（横向两行、竖向两列）。
  // 每条车道优先用真实缓存物品；若该车道恰好为空但整块带确有物品在输运，则借整批物品兜底，
  // 保证两条车道都能清楚看到物品在走（不会出现“只有一线有物品”）。
  if (busy) {
    const spd = beltSpeed() * (e.speedMult ? e.speedMult() : 1) * TILE;
    const itemFn = (LOD && LOD.simple) ? drawItemDotLOD : drawItemDot;
    const span = Math.max(8, bx1 - bx0);                 // 可见带段长度(px)
    const pool = e.items.concat(e.outItems);             // 本格缓冲的所有物品
    const total = pool.length;
    for (const li of [1, 0]) {
      const y = (li === 1 ? -5 : 5);                     // lane1 上(左)排 / lane0 下(右)排
      // 该车道推进箭头（始终画，指示该车道流向）
      ctx.fillStyle = acc;
      const step = 11;
      const off = ((G.time * spd) % step + step) % step;
      for (let k = -2; k <= 3; k++) {
        const ax = bx0 + k * step + off;
        if (ax < bx0 + 2 || ax > bx1 - 2) continue;
        tri(ctx, ax - 3, y - 2.6, ax - 3, y + 2.6, ax + 3, y);
        ctx.fill();
      }
      // 本车道物品：优先真实物品；车道暂无但整块带在输运时借整批兜底，保证双线有物品
      let laneItems = pool.filter(o => o.lane === li).map(o => o.item);
      if (!laneItems.length && total) laneItems = pool.map(o => o.item);
      if (!laneItems.length) continue;                   // 完全无物品：保持静默（带闲置）
      const n = Math.min(laneItems.length, 3);
      const spacing = span / n;
      const ph = ((G.time * spd) / spacing) % 1;
      for (let i = 0; i < n; i++) {
        const t = (i / n + ph) % 1;
        const x = bx0 + span * t;
        let a = alpha;
        const p = (x - bx0) / span;
        if (st === 'in')  a = alpha * (p < 0.85 ? 1 : Math.max(0.12, 1 - (p - 0.85) / 0.15)); // 落洞渐隐
        else              a = alpha * (p < 0.15 ? p / 0.15 : 1);                            // 出洞渐显
        ctx.globalAlpha = a;
        itemFn(ctx, x, y, laneItems[(i + li) % laneItems.length]);
      }
      ctx.globalAlpha = alpha;
    }
  }

  ctx.restore();

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
