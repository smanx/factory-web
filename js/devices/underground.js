'use strict';

// ===== 地下传送带（含快速版）=====
class Underground extends Entity {
  constructor(type, x, y) {
    super(type || 'underground-belt', x, y);
    this.items = [];
    this.outItems = [];
    // 隧道在途物品：{ item, lane, rem }，rem = 距出口剩余格数（格），随流速递减。
    // 用来把「过洞」改造成真实耗时：物品以地上带单列流速穿过 D 格隧道后才冒出地面，
    // 而不是上一版“入口瞬时塞进出口缓存”造成的瞬间传送 + 变速。
    this.tunnel = [];
    // 双列（对齐《异星工厂》）：隧道内两条独立车道各用一套累积计时器推进，互不混合。
    this.cd = [0, 0];   // 入口 → 隧道 进洞计时器（lane0 / lane1）
    this.ejectT = [0, 0]; // 出口 → 地面 喷射计时器（lane0 / lane1）
    this._blockL = [false, false]; // 出口各车道是否被下游卡住（lane0 / lane1），驱动动画冻结
  }
  // 与配对地下带之间的跨度（格）：入口→前方出口、出口→后方入口。未配对按 1 格计。
  ugDist() {
    const m = this.isEntrance() ? this.findMate() : this.findBackMate();
    if (!m) return 1;
    return Math.max(Math.abs(m.x - this.x), Math.abs(m.y - this.y));
  }
  // 隧道单列容量 = 跨度(格) × 每格每列件数(UG_CAP)。配对越长缓存越多，与地上带逐格同口径。
  tunnelCapLane() { return UG_CAP * this.ugDist(); }
  // 每列流速（格/秒）：与地上传送带单列一致（beltSpeed/2）。
  speedLane() { return beltSpeed() * this.speedMult() / 2; }
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
    // 惰性调度（P0 优化）：入口/出口/隧道在途都空时无需每帧扫描
    if (!this.items.length && !this.outItems.length && !(this.tunnel && this.tunnel.length)) return;
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
      if (this.tunnel && this.tunnel.length) this.tunnel = [];
      return;
    }
    // 只与离它最近的那一个配对：入口 → 最近前方出口；出口 → 后方入口。
    // 贪心交替配对：链上第1座是入口，第2座是出口，第3座是入口，第4座是出口……
    // 通过 isEntrance()/isExit() 递归判定，确保每座出口的后方入口尚未被占用。
    if (this.isEntrance()) {
      const mate = this.findMate();
      // 入口：把本格收进 items 的货按间隔 iv 逐件放入隧道（rem = 距出口格数），
      // 在途物品由出口侧的 _tickTunnel 按地上带同等流速推进，穿越整条隧道后才冒出地面。
      // 双列：两条车道（lane0/lane1）各自独立进洞，互不混合。
      if (mate) {
        this._transferLane(mate, 0, iv);
        this._transferLane(mate, 1, iv);
      }
    } else if (this.isExit()) {
      // 出口：推进隧道在途物品（按流速向地面靠拢），到达出口口的投入待喷射缓冲后喷到地面带。
      this._tickTunnel(dt);
      this._ejectLane(0, iv);
      this._ejectLane(1, iv);
    }
    // 平滑动画时钟：每条车道一个单调递增的时间戳（秒），驱动物品在带面上滑动。
    // 只有“未被卡住”的车道才走表：正常输运时走表 → 物品持续前移；
    // 一旦卡住，时钟停走 → 物品原地冻结，与地上传送带被堵停完全一致。
    //   入口车道卡住 = 隧道该列已塞满（无法再放入）；
    //   出口车道卡住 = 下游拒收 → _ejectLane 里置位 _blockL[l]。
    // 时钟单调不回退 → 物品只会平滑前移或原地冻结，绝不会抖动。
    this._flow = this._flow || [0, 0];
    this._blockL = this._blockL || [false, false];
    const isIn = this.isEntrance(), isOut = this.isExit();
    const mate = isIn ? this.findMate() : null;
    for (let l = 0; l < 2; l++) {
      let moving = false;
      if (isIn && mate) {
        let inT = 0;
        for (const t of (mate.tunnel || [])) if (t.lane === l) inT++;
        moving = inT < this.tunnelCapLane();
      } else if (isOut) {
        moving = !((this._blockL && this._blockL[l]) || false);
      }
      if (moving) this._flow[l] += dt;
    }
  }
  // 入口进洞单条车道：把本车道（lane）入口缓存 items 里的货按间隔 iv 逐件放入出口侧隧道
  // （每件记 rem = 距出口格数），隧道该列塞满（tunnelCapLane）则不再放入（上游反堵）。
  _transferLane(mate, lane, iv) {
    const capT = this.tunnelCapLane();
    if (!mate.tunnel) mate.tunnel = [];
    let inT = 0;
    for (const t of mate.tunnel) if (t.lane === lane) inT++;
    while (this.cd[lane] >= iv && inT < capT) {
      let idx = -1;
      for (let i = 0; i < this.items.length; i++) if (this.items[i].lane === lane) { idx = i; break; }
      if (idx < 0) break;
      const it = this.items.splice(idx, 1)[0];
      mate.tunnel.push({ item: it.item, lane: lane, rem: this.ugDist() });
      inT++; this.cd[lane] -= iv;
    }
  }
  // 出口推进隧道在途物品：每件按地上带单列流速（speedLane，格/秒）向出口靠近；
  // 走完全程（rem<=0）即“冒出地面”，投入本出口待喷射缓冲 outItems（每列至多 UG_CAP）。
  // 缓冲满则 clamp 在隧道末端等待，隧道自然反堵 → 容量、流速、缓存都按真实长度计算。
  _tickTunnel(dt) {
    if (!this.tunnel || !this.tunnel.length) return;
    const sp = this.speedLane();
    const keep = [];
    for (const t of this.tunnel) {
      t.rem -= sp * dt;
      if (t.rem <= 0) {
        let laneCnt = 0;
        for (const o of this.outItems) if (o.lane === t.lane) laneCnt++;
        if (laneCnt < UG_CAP) { this.outItems.push({ item: t.item, lane: t.lane }); continue; }
        t.rem = 0; // 出口缓冲满：等在隧道末端
      }
      keep.push(t);
    }
    this.tunnel = keep;
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
      } else if (t instanceof Underground) {
        // 出口可直接接入「下一组地下带的入口」（背靠背链式拼接，对齐《异星工厂》）：
        // 出口把货喷到地面后，若紧邻的下一格是同向同档、且当前作为入口的地下带
        // （它会把货送向自己的出口），则按车道直接入洞，保持左进左出/右进右出。
        // 前方是出口 / 未配对 / 异档则拒收，避免把货穿进别人的出口造成错乱。
        if (t.dir === this.dir && t.type === this.type && t.isEntrance()) {
          sent = t.acceptItem(this.outItems[idx].item, this.dir, undefined, undefined, lane);
        }
      } else if (t) {
        sent = t.giveItem(this.outItems[idx].item);
      }
      if (sent) { this.outItems.splice(idx, 1); this.ejectT[lane] -= iv; if (this._blockL) this._blockL[lane] = false; }
      else { this.ejectT[lane] = 0; if (this._blockL) this._blockL[lane] = true; break; }  // 下游无空位：置位阻塞冻结动画，等待下一帧重试
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

  // 井口(深坑) x 范围 —— 每端恰好覆盖格子的 1/2（格心到格边）：
  // 入口=前坑(+X) 占 [0, +半格]，出口=后坑(-X) 占 [-半格, 0]，未配对=后坑但用虚线示孤井。
  // 半格正好与物品/箭头的可见半格分界(x=0)对齐，格栅齿铺满半格，视觉上盖住 1/2 的位置。
  const HALF = TILE / 2;
  let m0 = -HALF, m1 = 0;
  if (st === 'in') { m0 = 0; m1 = HALF; }

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

  // ---- 6) 双列物品流：与正常传送带一致，lane0/lane1 各自流动 ----
  // 关键改动：物品用“屏幕空间的垂直偏移向量”（beltLaneOffset）绘制，而非依赖旋转坐标里的固定 y。
  // 这样无论横向还是竖向（四向），两条车道都严格沿行进方向的垂直方向错开：
  //   横向 → 上下两行；竖向 → 左右两列。与地上传送带的显示丝毫不差。
  // 先退出旋转坐标系，改在绝对屏幕坐标画物品/箭头。
  ctx.restore();
  if (busy) {
    const itemFn = (LOD && LOD.simple) ? drawItemDotLOD : drawItemDot;
    const span = Math.max(8, bx1 - bx0);                 // 可见带段长度（沿行进方向）
    const px = gx * TILE, py = gy * TILE;
    const cx = px + TILE / 2, cy = py + TILE / 2;        // 格心
    const fx = DX[dir], fy = DY[dir];                    // 行进方向（屏幕）
    const pool = e.items.concat(e.outItems);             // 本格缓冲的所有物品
    for (const li of [1, 0]) {
      const lo = beltLaneOffset(e, li);                  // 本车道的屏幕垂直偏移向量
      const ofsX = lo[0] * 7, ofsY = lo[1] * 7;          // 与地上传送带同样 7px 车道间距
      // 动画时钟：由本车道“单调递增的流动钟”（_flow[lane]）驱动，而非全局 G.time 或会回绕的转移计时器。
      // 流动钟只在本车道正常输运时走表（update() 维护），被堵即停 → 物品冻结；单调不回退 → 物品绝不抖动。
      // 换算为“横跨可见带段的相位 0..1”：按与地面带同速（单车道 beltSpeed/2 格/秒）折算像素后对 span 取模。
      const flow = (e._flow && e._flow[li]) || 0;
      const spdPx = beltSpeed() * e.speedMult() * (TILE / 2);
      // 遮罩边界（中间地下部分只做后台流动，不外显）：
      //   以格子的中分线（局部 x=0，即格心）为界，每格只露出一半 —— 盖住恰好 1/2：
      //     入口（in）只显示前半格 [bx0, 0]：物品走过 1/2 即被遮罩盖住，不再显示 →
      //       前半格内物品向右(井口)滑去时渐隐，模拟“钻入井下并被遮住”。
      //     出口（out）只显示后半格 [0, bx1]：从遮罩中冒出的物品前半格被盖住，
      //       到中分线 x=0 后方才开始显示，并继续滑向出口缘 → 模拟“从井下冒出地面”。
      let v0 = bx0, v1 = bx1;
      if (st === 'in')       v1 = 0;                     // 入口：格心往前的 1/2 被遮住
      else if (st === 'out') v0 = 0;                     // 出口：格心往后的 1/2 被遮住
      const vSeg = Math.max(4, v1 - v0);                 // 可见半格长度（沿行进方向）
      // 换算为“横跨可见半格的相位 0..1”：按与地面带同速（单车道 beltSpeed/2 格/秒）折算像素后对 vSeg 取模。
      // 物品在可见半格内以 spdPx px/s 推进（遮罩的另一半计时仍算入流动钟，保证速度一致）。
      let clk = ((flow * spdPx) / vSeg) % 1;
      if (clk < 0) clk += 1;
      // 该车道推进箭头（指示流向）：只在可见半格内绘制，遮罩半格保持干净，卡住即静止
      ctx.fillStyle = acc;
      const step = 11;
      const cOff = ((flow * spdPx) % step + step) % step;
      const pdx = -fy * 2.6, pdy = fx * 2.6;             // chevron 垂直于行进方向张开
      for (let k = -2; k <= 3; k++) {
        const ax = bx0 + k * step + cOff;
        if (ax < v0 + 2 || ax > v1 - 2) continue;
        const bxC = cx + fx * (ax - 3) + ofsX, byC = cy + fy * (ax - 3) + ofsY; // 尾中
        const hx = cx + fx * (ax + 3) + ofsX, hy = cy + fy * (ax + 3) + ofsY;    // 尖
        tri(ctx, bxC + pdx, byC + pdy, bxC - pdx, byC - pdy, hx, hy);
        ctx.fill();
      }
      // 本车道物品：按「可见半格上的连续流」绘制（对齐地上传送带：一条带上应同时可见多个物品连续流动）。
      //   来源/流向：
      //     入口（in）：本格缓存 items（即将送入地下）沿后半格 … 前半格流向井口(x=0)，入洞渐隐
      //                  —— 显示为“物品从后方源源滚来、钻入井口”。
      //     出口（out）：已冒出/正在冒出的货从井口(x=0)滑出，渐显并继续滑向格边进入下一格带
      //                  —— 显示为“物品从井口源源冒出、流向下一带”。
      //   关键修正（解决 3 个 bug）：
      //     1) 槽位数固定为 “可见半格容量”（≈每格每车道 8 件 折算），不再随缓存长度逐帧跳变 n=1/2
      //        → 消除 “路口物品一闪一闪”。
      //     2) 固定多个槽位 + 流动钟相位整体前移 → 同时可见多个物品、形成连续流（不再只有一个）。
      //     3) 出口以 待发 outItems（不足时取隧道末端货补足）为来源 → 能看见物品冒出，
      //        不再“直接突现到下一带”。
      //   阻塞一致：相位由单调流动钟 _flow[li] 驱动，堵住即冻结、流通即前移，与地上带停/流观感一致。
      // 该车道「真实的在途货源」（按物理顺序，最深处在索引前、最近地面在索引后）：
      //   入口（in）：本格缓存 items —— 正从后面源源滚来、即将送入地下的货；
      //   出口（out）：隧道在途（深处）→ 待发 outItems（靠近地面的货）拼接，
      //                使出口总能从隧道缓冲里“冒”出连绵的货，而不是只看到被瞬时喷走的 1~2 件。
      // 关键修正（解决 4 个 bug）：
      //   1) 不再用 min(src.length, dens) 限制显示数量 → 固定槽位永远显示满，
      //      即使缓存里只有 1 件真货也按固定密度铺满 → 同时可见多个物品、连续流动（不再“只显示一个”）。
      //   2) 槽位相位由单调流动钟 _flow[li] 驱动（只增不回退）→ 堵住即冻结、流通即前移，
      //      且相位不随缓存增减跳变 → 不再“一闪一闪”。
      //   3) 槽位数量固定、物品类型循环复用 → 一条路口带肉眼上与地上传送带一致的多物品连续流。
      //   4) 出口改用“隧道+待发”拼接为货源 → 能看到物品从井口源源冒出（不再“突然出现在下一带”）。
      let src;
      if (st === 'out') {
        src = (e.tunnel || []).filter(t => t.lane === li).map(t => t.item)
          .concat(e.outItems.filter(o => o.lane === li).map(o => o.item));
      } else {
        src = e.items.filter(o => o.lane === li).map(o => o.item);
      }
      // 可见半格能铺满的槽位数（稳定值，杜绝闪烁）：按地面带每格每车道 8 件 折算。
      // 因槽位相位按 vSeg 均分，槽距自动等于地面带物品间距（BELT_SPACING×TILE）。
      const dens = Math.max(2, Math.min(4, Math.round(8 * (vSeg / TILE))));
      // —— 入口闪灭的来源：入口缓存 e.items 被 _transferLane 按“攒够一批再成批吸进隧道”的方式清空，
      //    稳态下会在 1 → 0 之间逐帧跳变，货源偶尔空一帧 → 整个流就空一帧 → 一闪一闪。
      //    这里用一个「滚动类型缓冲」桥接这段极短暂的 0 货帧：
      //    · 有真货时，用最新货源刷新缓冲；
      //    · 真货短暂归零（< 0.4s）时，沿用上一次缓冲继续画，避免闪灭；
      //    · 真货长时间归零（供应真停了）才清空显示 —— 保证入口带真正空载时不出伪物。
      e._vis = e._vis || [[], []];
      e._visIdle = e._visIdle || [0, 0];
      const vis = e._vis[li];
      if (src.length) {
        vis.length = Math.min(dens, src.length);         // 至多铺满 dens 个，冷的旧类型被挤掉
        for (let j = 0; j < vis.length; j++) vis[j] = src[j];
        e._visIdle[li] = 0;
      } else if (e._visIdle[li] < 24) {                  // 短暂归零：沿用缓冲，桥接一帧
        if (!vis.length) continue;                       // 从未流过货：不画
        e._visIdle[li]++;
      } else {                                           // 长时间无货：真静止，清空
        vis.length = 0;
        continue;
      }
      const ph = clk;
      for (let j = 0; j < dens; j++) {
        const slot = (j / dens + ph) % 1;                // 槽位 j 基准 + 整体前移；模 1 环绕=连续流
        const xl = v0 + vSeg * slot;
        const ix = cx + fx * xl + ofsX, iy = cy + fy * xl + ofsY;
        const p = (xl - v0) / vSeg;                      // 0=进入端，1=遮罩端
        let a = alpha;
        if (st === 'in')       a = alpha * (1 - p * 0.75);          // 走向遮罩(井口)渐隐 = 钻入
        else if (st === 'out') a = alpha * (0.25 + p * 0.75);       // 从遮罩冒出渐显 = 冒出
        ctx.globalAlpha = a;
        itemFn(ctx, ix, iy, vis[j % vis.length]);
      }
      ctx.globalAlpha = alpha;
    }
  }

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
