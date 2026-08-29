'use strict';

// ===== 分流器 =====
// 性能优化：分流器物品排序比较器提为模块级常量，避免每帧重建闭包（与传送带一致）
const _splitterItemSortDesc = (a, b) => b.pos - a.pos;

class Splitter extends Belt {
  constructor(type, x, y) {
    super(type || 'splitter', x, y);
    this.items = [];
    this.inPref = -1; // 输入优先级：-1=两入口轮流输入，0/1=优先某输入口（对齐《异星工厂》分流器输入优先级）
    this.inToggle = 0; // 轮流输入时的切换开关（inPref=-1 时交替放行两输入口，恒为 0/1）
    this.outToggle = false; // 轮流输出：所有物品共享一个开关，全局轮流走两个出口
    this.filter = null; // 可编程分离器过滤：仅放行该物品，其余物品被挡在入口（对齐《异星工厂》Programmable splitter）
    this.outPref = -1; // -1=两出口轮流输出，0/1=优先某侧（面板可调）
    this._nextInLane = 0; // 无 laneHint 投放（机械臂/地面）的下一装载车道，供双线均衡
    this.applyDir();
  }
  applyDir() {
    if (this.dir % 2 === 1) { this.w = this.def.h; this.h = this.def.w; }
    else { this.w = this.def.w; this.h = this.def.h; }
  }
  laneVec() { return [-DY[this.dir], DX[this.dir]]; }
  laneCenter(l) {
    const cx = (this.x + this.w / 2) * TILE, cy = (this.y + this.h / 2) * TILE;
    const p = this.laneVec();
    const off = (l - 0.5) * TILE;
    return [cx + p[0] * off, cy + p[1] * off];
  }
  update(dt) {
    // 惰性调度（P0 优化）：空分流器无需每帧处理
    if (!this.items || this.items.length === 0) return;
    const sp = beltSpeed() * dt;
    this.items.sort(_splitterItemSortDesc);
    // 按 输入口+车道 独立追踪前端位置：不同输入口的同名车道互不干扰，4 路完全独立
    const front = {};
    for (let i = 0; i < this.items.length; i++) {
      const o = this.items[i];
      const key = (o.inPort === 1 ? 1 : 0) + '_' + (o.lane === 1 ? 1 : 0);
      const lim = front[key] === undefined ? 0.999 : Math.max(0, front[key] - BELT_SPACING);
      if (o.pos < lim) o.pos = Math.min(o.pos + sp, lim);
      front[key] = o.pos;
    }
    // 第一遍：为到达中段的物品分配输出端口（A/B 两线同时走同一出口）
    for (const o of this.items) {
      if (o.pos >= 0.5 && o.outPort === undefined) {
        o.outLane = o.lane; // lane 保持（A 进 A 出 / B 进 B 出）
        if (this.filter) {
          o.outPort = o.item === this.filter ? (this.outPref >= 0 ? this.outPref : 0) : (this.outPref >= 0 ? 1 - this.outPref : 1);
        } else if (this.outPref >= 0) {
          o.outPort = this.outPref;
        } else {
          o.outPort = this.outToggle ? 1 : 0;
          this._outBatchCount = (this._outBatchCount || 0) + 1;
        }
      }
    }
    // 轮流输出：每分配 2 个物品就切换到下一出口（A/B 各一个为一组）
    if (this.outPref < 0 && !this.filter) {
      if (this._outBatchCount >= 2) {
        this.outToggle = !this.outToggle;
        this._outBatchCount = 0;
      }
    }
    // 第二遍：尝试将到达出口的物品推给下游
    for (let i = 0; i < this.items.length; i++) {
      const o = this.items[i];
      if (o.pos >= 0.999 && o.outPort !== undefined) {
        // 车道严格保持：A线输入必须从A线输出，B线输入必须从B线输出，绝不串线
        let ok = this.pushOut(o.item, o.outPort, o.outLane);
        if (!ok) {
          const alt = 1 - o.outPort;
          if (this.pushOut(o.item, alt, o.outLane)) { o.outPort = alt; ok = true; }
        }
        if (ok) { this.items.splice(i, 1); i--; }
        else o.pos = 0.999;
      }
    }
  }
  // 从某个输出口（port=0/1）把物品推给下游：输出车道 lane 作为 laneHint 传给下游传送带，
  // 保证 A/B 车道在分流器 → 传送带 / 分流器串联时始终如一（对齐《异星工厂》lane 保持）。
  pushOut(item, port, lane) {
    const [ex, ey] = this.laneCenter(port);
    const tx = Math.floor((ex + DX[this.dir] * TILE) / TILE);
    const ty = Math.floor((ey + DY[this.dir] * TILE) / TILE);
    const t = entAt(tx, ty);
    if (!t) return false;
    if (t instanceof Belt && !(t instanceof Splitter)) {
      if (t.dir === ((this.dir + 2) % 4)) return false;
      return t.acceptItem(item, this.dir, undefined, undefined, lane);
    }
    // 下游也是分流器：继续传递 laneHint，保证 A/B 车道在分流器串联时也不丢失
    if (t instanceof Splitter) {
      return t.acceptItem(item, this.dir, undefined, undefined, lane);
    }
    if (!(t instanceof Underground)) return t.giveItem(item);
    return false;
  }
  // 判断某个输入口（0/1）的某条车道入口是否有物品阻塞（pos < BELT_SPACING）。
  // 按车道独立检查：同一入口的 A/B 两线互不阻塞，对齐《异星工厂》分流器双线独立。
  _entrancePendingPortLane(p, lane) {
    return this.items.some(o => o.inPort === p && o.lane === lane && o.pos < BELT_SPACING);
  }
  // 某个输入口是否有任意车道阻塞（供轮流/优先级调度使用）
  _entrancePending(l) {
    return this.items.some(o => o.inPort === l && o.pos < BELT_SPACING);
  }
  // 由来源几何确定物品进入的物理输入口（上格=0 / 下格=1）：
  // 直通输入按车道垂直位置，侧向输入按横向位置；无几何信息（机械臂/地面）返回 -1。
  _geoPort(fromDir, sx, sy) {
    const rel = ((fromDir - this.dir) % 4 + 4) % 4;
    if (sx === undefined || sx === null) return -1;
    if (rel === 0) {
      const pv = this.laneVec();
      const ccx = (this.x + this.w / 2) * TILE, ccy = (this.y + this.h / 2) * TILE;
      const scx = (sx + 0.5) * TILE, scy = (sy + 0.5) * TILE;
      return (scx - ccx) * pv[0] + (scy - ccy) * pv[1] > 0 ? 1 : 0;
    } else if (rel !== 2) {
      const fv = [DX[this.dir], DY[this.dir]];
      const ccx = (this.x + this.w / 2) * TILE, ccy = (this.y + this.h / 2) * TILE;
      const scx = (sx + 0.5) * TILE, scy = (sy + 0.5) * TILE;
      return (scx - ccx) * fv[0] + (scy - ccy) * fv[1] > 0 ? 1 : 0;
    }
    return -1;
  }
  acceptItem(item, fromDir, sx, sy, laneHint) {
    // 可编程分离器过滤：设置了过滤物且物品不匹配时，拒绝放行（物品停留在上游传送带）
    if (this.filter && item !== this.filter) return false;
    // 物品应进入的物理输入口 inPort：带输入始终跟随其来源入口几何；
    // 机械臂/地面等无几何信息的投放按输入优先级/轮流开关取起始口。
    const geoPort = this._geoPort(fromDir, sx, sy);
    const inPort = geoPort >= 0 ? geoPort : (this.inPref >= 0 ? this.inPref : (this.inToggle ? 1 : 0));
    // 进入车道 lane：直通带输入沿用 laneHint（A 进 A 出，官方 lane 保持）；
    // 无 laneHint 的投放（机械臂/地面/侧向）取该输入口的起始车道，供双线各自装填。
    const lane = (laneHint !== undefined && laneHint !== null) ? (laneHint === 1 ? 1 : 0) : (this._nextInLane || 0);

    // 4 路输入线完全独立同时工作：每路只检查自己的入口是否有空位，
    // 不管其他路是否有物品，有空位就放入。轮流/优先级仅作用于输出端。
    const blocked = this.items.some(o => o.inPort === inPort && o.lane === lane && o.pos < BELT_SPACING);
    if (!blocked) {
      this.items.push({ item, pos: 0, inPort, lane });
      // 无 laneHint 的投放：下一次用另一条车道装填，让双线均衡
      if (laneHint === undefined || laneHint === null) this._nextInLane = 1 - lane;
      return true;
    }
    return false;
  }
  takeItem() {
    if (!this.items.length) return null;
    let best = this.items[0];
    for (const o of this.items) if (o.pos > best.pos) best = o;
    this.items.splice(this.items.indexOf(best), 1);
    return best.item;
  }
  giveItem(item) { return this.acceptItem(item); }
  serialize() {
    return {
      type: this.type, x: this.x, y: this.y, dir: this.dir,
      outPref: this.outPref,
      inPref: this.inPref,
      filter: this.filter,
      items: this.items.map(o => [o.item, +o.pos.toFixed(3), o.lane, o.outPort === undefined ? -1 : o.outPort, o.inPort === undefined ? o.lane : o.inPort, o.outLane === undefined ? -1 : o.outLane])
    };
  }
  // 蓝图保留优先输出/输入配置，不复制传送带上的物品
  blueprint() {
    const s = super.blueprint();
    s.outPref = this.outPref;
    s.inPref = this.inPref;
    s.filter = this.filter;
    return s;
  }
  static restore(s) {
    const e = new this(s.type, s.x, s.y);
    e.dir = s.dir | 0;
    e.applyDir();
    e.outPref = typeof s.outPref === 'number' ? s.outPref : -1;
    e.inPref = typeof s.inPref === 'number' ? s.inPref : -1;
    e.filter = s.filter || null;
    e.items = (s.items || []).map(a => {
      // 兼容旧档：旧格式 [item,pos,lane,outLane?,inPos?]，新格式 [item,pos,lane,outPort,inPort,outLane]
      const old = a.length < 6;
      const inPort = old ? (a.length > 4 ? a[4] : (a[2] || 0)) : (a[4] || 0);
      const outPort = old ? (a[3] >= 0 ? a[3] : undefined) : (a[3] >= 0 ? a[3] : undefined);
      const outLane = old ? undefined : (a[5] >= 0 ? a[5] : undefined);
      return { item: a[0], pos: a[1], lane: a[2] || 0, inPort, outPort, outLane };
    });
    return e;
  }
}

// ===== 渲染 =====

// 分流器各档配色（供 drawSplitterBase 使用；档位差异：黄=基础 / 红=高速 / 蓝=极速 / 绿=超速）
// base/border=底盘，body[]=外壳渐变（顶亮底暗），groove/grooveEdge=X 凹槽与高光，
// hub/hubEdge/stripe=中央分流梭与警示纹，led=运转发光色，chev=流向箭头，running=状态边框呼吸色
const SPLITTER_COLORS = {
  normal: {
    base: '#4a4436', border: '#26221d',
    body: ['#8a7a4e', '#5d5031', '#33291a'],          // 黄褐工业钢渐变
    groove: 'rgba(0,0,0,.34)', grooveEdge: 'rgba(255,255,255,.12)',
    hub: '#1c1710', hubEdge: '#3a3020', stripe: 'rgba(255,235,150,.5)',
    led: 'rgba(224,178,60,', chev: 'rgba(224,178,60,.8)',
    accent: 'rgba(224,178,60,.16)', running: 'rgba(143,224,143,',
    boltHi: 'rgba(255,240,180,.5)',
  },
  fast: {
    base: '#5a2a28', border: '#2e1815',
    body: ['#9a4a3c', '#6a2e26', '#3a1712'],          // 赤红工业钢渐变
    groove: 'rgba(0,0,0,.34)', grooveEdge: 'rgba(255,255,255,.12)',
    hub: '#24120e', hubEdge: '#4a2418', stripe: 'rgba(255,190,150,.5)',
    led: 'rgba(224,90,78,', chev: 'rgba(224,90,78,.8)',
    accent: 'rgba(224,90,78,.2)', running: 'rgba(224,90,78,',
    boltHi: 'rgba(255,220,200,.5)',
  },
  express: {
    base: '#2e3a52', border: '#1a2434',
    body: ['#4a6a96', '#2e4468', '#18263e'],          // 科技蓝钢渐变
    groove: 'rgba(0,0,0,.34)', grooveEdge: 'rgba(255,255,255,.14)',
    hub: '#101a2a', hubEdge: '#2c4060', stripe: 'rgba(170,210,255,.5)',
    led: 'rgba(90,150,230,', chev: 'rgba(90,150,230,.8)',
    accent: 'rgba(90,150,230,.2)', running: 'rgba(110,160,235,',
    boltHi: 'rgba(190,220,255,.5)',
  },
  // 太空时代 4 档（Turbo splitter，对齐《异星工厂》Turbo splitter：深绿色系）
  turbo: {
    base: '#2f4a33', border: '#18261b',
    body: ['#4a7a58', '#2e5638', '#1a3420'],          // 深空翠绿钢渐变
    groove: 'rgba(0,0,0,.34)', grooveEdge: 'rgba(255,255,255,.14)',
    hub: '#0e2214', hubEdge: '#2c5238', stripe: 'rgba(170,255,200,.5)',
    led: 'rgba(90,180,120,', chev: 'rgba(90,180,120,.8)',
    accent: 'rgba(90,180,120,.22)', running: 'rgba(110,200,140,',
    boltHi: 'rgba(190,255,215,.5)',
  },
};

// 统一分流器渲染（替代 drawSplitter / drawExpressSplitter / drawFastSplitter 三个重复函数）
// colors: { base, border, body[], groove, grooveEdge, hub, hubEdge, stripe, led, chev, accent, running, boltHi } 档位配色
// opts: { glow } 可选额外效果（快速/超速分流器中央分流梭的强光晕）
function drawSplitterBase(ctx, e, gx, gy, dir, alpha, colors, opts) {
  ctx.globalAlpha = alpha;
  const cx = (gx + e.w / 2) * TILE, cy = (gy + e.h / 2) * TILE;
  const across = (dir % 2 === 1 ? e.w : e.h) * TILE;
  const running = e.items.length > 0;
  const stuck = e.items.some(o => o.pos >= 0.999);
  const filtered = !!e.filter;
  const t = colors;
  const pulse = 0.5 + 0.5 * Math.sin(G.time * 6);

  // 简化 LOD：缩远时单色底 + 中心状态点，省去全部细节
  if (LOD && LOD.simple) {
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    rr(ctx, cx - TILE / 2 - 2, cy - across / 2 - 2, TILE + 4, across + 4, 8);
    ctx.fill();
    ctx.fillStyle = t.body[1];
    rr(ctx, cx - TILE / 2 + 1, cy - across / 2 + 1, TILE - 2, across - 2, 6);
    ctx.fill();
    ctx.fillStyle = running ? t.led + '0.85)' : '#0c1014';
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fill();
    drawSplitterItems(ctx, e, gx, gy, cx, cy);
    ctx.globalAlpha = 1;
    return;
  }

  // ===== 主体（局部坐标：+y 为物流方向，输入在上、输出在下）=====
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(dir * Math.PI / 2);

  // --- ① 地面阴影（比机身略大一圈、向下偏移，形成悬浮投影）---
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  rr(ctx, -TILE / 2 - 2, -across / 2 - 2, TILE + 4, across + 4, 9);
  ctx.fill();

  // --- ② 底盘（深色金属基座，满占 1×2 足迹）---
  ctx.fillStyle = t.base;
  rr(ctx, -TILE / 2, -across / 2, TILE, across, 8);
  ctx.fill();
  const baseFade = ctx.createLinearGradient(0, across * 0.1, 0, across / 2);
  baseFade.addColorStop(0, 'rgba(0,0,0,0)');
  baseFade.addColorStop(1, 'rgba(0,0,0,0.42)');
  ctx.fillStyle = baseFade;
  rr(ctx, -TILE / 2, 0, TILE, across / 2, 8);
  ctx.fill();
  ctx.strokeStyle = t.border;
  ctx.lineWidth = 1.5;
  rr(ctx, -TILE / 2, -across / 2, TILE, across, 8);
  ctx.stroke();

  // --- ③ 主体外壳（档位色渐变：顶亮底暗，模拟受光）---
  const bodyGrad = ctx.createLinearGradient(0, -across / 2, 0, across / 2);
  bodyGrad.addColorStop(0, t.body[0]);
  bodyGrad.addColorStop(0.5, t.body[1]);
  bodyGrad.addColorStop(1, t.body[2]);
  ctx.fillStyle = bodyGrad;
  rr(ctx, -TILE / 2 + 3, -across / 2 + 3, TILE - 6, across - 6, 6);
  ctx.fill();
  ctx.strokeStyle = t.border;
  ctx.lineWidth = 1.2;
  rr(ctx, -TILE / 2 + 3, -across / 2 + 3, TILE - 6, across - 6, 6);
  ctx.stroke();
  // 顶部高光条（上沿受光）
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  rr(ctx, -TILE / 2 + 5, -across / 2 + 4, TILE - 10, 2, 1);
  ctx.fill();

  // --- ④ 输入/输出端「带口」压板（与相邻传送带的接缝：左进右出，上下双口）---
  for (const bx of [-TILE / 2 + 4, TILE / 2 - 4]) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    rr(ctx, bx - 2, -22, 4, 44, 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    rr(ctx, bx - 1.2, -19, 2.4, 6, 1);
    ctx.fill();
    rr(ctx, bx - 1.2, 13, 2.4, 6, 1);
    ctx.fill();
    ctx.fillStyle = t.grooveEdge;
    ctx.fillRect(bx + 1, -19, 0.8, 6);
    ctx.fillRect(bx + 1, 13, 0.8, 6);
  }

  // --- ⑤ X 交叉分流通道（四条从两侧带口汇向中央的凹槽：双入双出的交叉路径）---
  ctx.save();
  rr(ctx, -13, -17, 26, 34, 6);
  ctx.clip();
  ctx.strokeStyle = t.groove;
  ctx.lineWidth = 6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-13, -16); ctx.lineTo(0, 0); ctx.lineTo(13, 16);
  ctx.moveTo(13, -16); ctx.lineTo(0, 0); ctx.lineTo(-13, 16);
  ctx.stroke();
  ctx.strokeStyle = t.grooveEdge;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-13, -16); ctx.lineTo(0, 0); ctx.lineTo(13, 16);
  ctx.moveTo(13, -16); ctx.lineTo(0, 0); ctx.lineTo(-13, 16);
  ctx.stroke();
  ctx.restore();

  // --- ⑥ 物流方向箭头动画（与传送带同款：沿物流方向滚动的小箭头，恒常显示）---
  // 分流器有双入口/双出口：上下两条物流线（长边进 → 长边出）各自滚动，方向一目了然
  const spStep = TILE / 2;
  const spOff = ((G.time * beltSpeed() * (e.speedMult ? e.speedMult() : 1) * TILE / 2) % spStep + spStep) % spStep;
  ctx.save();
  rr(ctx, -TILE / 2 + 3, -across / 2 + 3, TILE - 6, across - 6, 6);
  ctx.clip();
  ctx.fillStyle = t.chev;
  ctx.strokeStyle = 'rgba(0,0,0,.4)';
  ctx.lineWidth = 1;
  for (const yy of [-16, 16]) {
    for (let k = -2; k <= 3; k++) {
      const xx = -across / 2 + k * spStep + spOff;
      ctx.beginPath();
      ctx.moveTo(xx - 3, yy - 4);
      ctx.lineTo(xx - 3, yy + 4);
      ctx.lineTo(xx + 3, yy);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
  }
  ctx.restore();

  // --- ⑦ 中央分流梭（X 枢纽：警示底盘 + 档位色内芯，运转时脉动）---
  ctx.fillStyle = t.hub;
  rr(ctx, -9, -9, 18, 18, 5);
  ctx.fill();
  ctx.strokeStyle = t.hubEdge;
  ctx.lineWidth = 1.5;
  rr(ctx, -9, -9, 18, 18, 5);
  ctx.stroke();
  // 四角警示斜纹
  ctx.strokeStyle = t.stripe;
  ctx.lineWidth = 1.1;
  for (const sx of [-1, 1]) for (const sy of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(6 * sx - 2, 5 * sy - 2);
    ctx.lineTo(6 * sx + 2, 5 * sy + 2);
    ctx.stroke();
  }
  // 内芯（档位色圆盘：运转时呼吸发光，空闲时暗）
  ctx.fillStyle = running ? t.led + (0.7 + 0.3 * pulse).toFixed(2) + ')' : '#0a0d10';
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, 0, 4, 0, Math.PI * 2);
  ctx.stroke();
  // 玻璃高光
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.beginPath();
  ctx.arc(-1.4, -1.4, 1.2, 0, Math.PI * 2);
  ctx.fill();
  // 强光晕（快速/超速分流器专属）
  if (running && opts && opts.glow) {
    ctx.fillStyle = t.led + (0.10 + 0.10 * pulse).toFixed(2) + ')';
    ctx.beginPath();
    ctx.arc(0, 0, 12 + pulse * 3, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- ⑧ 四角螺栓 ---
  for (const bx of [-11, 11]) for (const by of [-26, 26]) {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.arc(bx, by, 1.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = t.boltHi;
    ctx.beginPath();
    ctx.arc(bx - 0.4, by - 0.4, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // --- ⑨ 运行状态边框（拥堵=橙色闪烁 / 过滤=蓝色呼吸 / 正常=档位色呼吸）---
  if (running) {
    let col;
    if (stuck) col = 'rgba(240,150,80,' + (0.5 + 0.3 * Math.sin(G.time * 8)).toFixed(2) + ')';
    else if (filtered) col = 'rgba(100,160,240,' + (0.45 + 0.25 * Math.sin(G.time * 6)).toFixed(2) + ')';
    else col = t.running + (0.45 + 0.25 * Math.sin(G.time * 6)).toFixed(2) + ')';
    ctx.strokeStyle = col;
    ctx.lineWidth = 2;
    rr(ctx, -TILE / 2 + 3, -across / 2 + 3, TILE - 6, across - 6, 6);
    ctx.stroke();
  }

  ctx.restore();

  // --- 流动箭头动画 ---
  drawSplitterFlow(ctx, e, gx, gy, colors.chev, alpha);

  // --- 输入优先级指示（入口侧：向内的大箭头）---
  if (e.inPref !== undefined && e.inPref >= 0) {
    const [lx, ly] = e.laneCenter(e.inPref);
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(dir * Math.PI / 2);
    // 绿色向下箭头指向入口中心（表示"优先从这边进"）
    ctx.fillStyle = '#5fd45f';
    ctx.strokeStyle = 'rgba(0,0,0,.5)';
    ctx.lineWidth = 1.5;
    tri(ctx, -TILE * 0.3, -7, -TILE * 0.3, 7, -TILE * 0.05, 0);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // --- 输出优先级指示（出口侧：向外的大箭头）---
  if (e.outPref !== undefined && e.outPref >= 0) {
    const [lx, ly] = e.laneCenter(e.outPref);
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(dir * Math.PI / 2);
    // 橙色向右箭头指向出口方向（表示"优先往这边出"）
    ctx.fillStyle = '#e09040';
    ctx.strokeStyle = 'rgba(0,0,0,.5)';
    ctx.lineWidth = 1.5;
    tri(ctx, TILE * 0.05, -7, TILE * 0.05, 7, TILE * 0.3, 0);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // --- 过滤物品图标（可编程分离器）---
  if (e.filter && ITEMS[e.filter]) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.globalAlpha *= 0.92;
    // 深色底圆
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.beginPath();
    ctx.arc(0, 0, TILE * 0.3, 0, 7);
    ctx.fill();
    // 发光边框（脉动）
    const glowA = 0.6 + 0.4 * Math.sin(G.time * 5);
    ctx.strokeStyle = 'rgba(100,180,255,' + glowA.toFixed(2) + ')';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
    drawItemDot(ctx, cx, cy, e.filter);
  }

  // --- 物品绘制 ---
  drawSplitterItems(ctx, e, gx, gy, cx, cy);
  ctx.globalAlpha = 1;
}

// 判断某格实体是否可作为"入口连接"：普通传送带（朝向一致）、地下带出口（朝向一致），
// 或另一个分流器（视为连接的传送带）。
// 注：分流器之间无论朝向如何都应视为已连接——因为分流器的 pushOut 会把物品
// 无条件交给相邻的下游分流器（giveItem 不检查方向），物品确实能流过去，
// 因此即使下游分流器朝向不同，也照样显示"入口流入 / 出口流出"动画。
function isInletConnected(ent, dir) {
  if (!ent) return false;
  if (ent instanceof Belt && !(ent instanceof Splitter) && ent.dir === dir) return true;
  // 必须确为「出口」：链式拼接后入口的后方也有同族地下带，findBackMate() 已不足以判定
  if (ent instanceof Underground && ent.dir === dir && ent.isExit()) return true;
  // 上游分流器的出口朝向我们时，视为连接的传送带，一样处理。
  if (ent instanceof Splitter) return true;
  return false;
}
// 判断某格实体是否可作为“出口连接”：普通传送带（朝向一致）、地下带出口（朝向一致），
// 或另一个分流器（视为连接的传送带）。
function isOutletConnected(ent, dir) {
  if (!ent) return false;
  if (ent instanceof Belt && !(ent instanceof Splitter) && ent.dir === dir) return true;
  // 同上：按 isExit() 判定是否真的向地面输出
  if (ent instanceof Underground && ent.dir === dir && ent.isExit()) return true;
  // 下游分流器的入口朝向我们时，视为连接的传送带，一样处理。
  if (ent instanceof Splitter) return true;
  return false;
}
// 检测分流器每条 lane 的输入/输出是否接有传送带（或地下带出口 / 相连的分流器）。
// 返回 { inp:[bool,bool], out:[bool,bool] }，inp[l]/out[l] 表示 lane l 是否接了带。
// ox/oy 为实体左上角绘制坐标（正常= e.x/e.y；蓝图/鬼影=光标格），用于在预览时也能正确计算。
function splitterLinks(e, ox, oy) {
  const inp = [false, false], out = [false, false];
  for (let l = 0; l < 2; l++) {
    const [lx, ly] = laneCenterAt(e, ox, oy, l);
    // 入口传送带位于分流器后方一整个 tile：从 lane 中心沿流向反方向退一整格，
    // 否则只退半格会落在分流器自身格子上（导致入口连接永远判为 false）。
    const inTx = Math.floor((lx - DX[e.dir] * TILE) / TILE);
    const inTy = Math.floor((ly - DY[e.dir] * TILE) / TILE);
    inp[l] = isInletConnected(entAt(inTx, inTy), e.dir);
    const outTx = Math.floor((lx + DX[e.dir] * TILE) / TILE);
    const outTy = Math.floor((ly + DY[e.dir] * TILE) / TILE);
    out[l] = isOutletConnected(entAt(outTx, outTy), e.dir);
  }
  return { inp, out };
}

// 沿分流器内部路径绘制流动箭头动画：
//  - 双入双出（两入口+两出口都接带）：两条 lane 各自流入、各自流出，交叉分流；
//  - 单入单出（仅一入口+一出口）：沿该 lane 直线直通，像普通传送带一样流动。
// 在恢复世界坐标系后调用（箭头路径用世界坐标），alpha 用于蓝图/鬼影半透明。
function laneCenterAt(e, ox, oy, l) {
  const cx = (ox + e.w / 2) * TILE, cy = (oy + e.h / 2) * TILE;
  const p = [-DY[e.dir], DX[e.dir]];
  const off = (l - 0.5) * TILE;
  return [cx + p[0] * off, cy + p[1] * off];
}

// 某个输入口（inL=0/1）内 A/B 车道（lane=0/1）的“进点”世界坐标：
// 在入口中心基础上沿车道方向再做小幅偏移，使“一个入口对应两根物流线”的
// 双线进料在动画里清晰可见（入口双线各自流入，不叠成一条）。
function splitterLaneEntryPoint(e, gx, gy, inL, lane) {
  const [lx, ly] = laneCenterAt(e, gx, gy, inL);
  const p = [-DY[e.dir], DX[e.dir]];
  const loff = (lane - 0.5) * TILE * 0.3;
  return [lx + p[0] * loff, ly + p[1] * loff];
}

// 某个输出口（outL=0/1）内 A/B 车道（lane=0/1）的“出点”世界坐标：
// 在出口中心基础上沿车道方向再做小幅偏移，与入口双线对称，
// 使“一个出口对应两根物流线”在动画里同样清晰可见（出口双线各自流出）。
function splitterLaneExitPoint(e, gx, gy, outL, lane) {
  const [lx, ly] = laneCenterAt(e, gx, gy, outL);
  const p = [-DY[e.dir], DX[e.dir]];
  const loff = (lane - 0.5) * TILE * 0.3;
  return [lx + p[0] * loff, ly + p[1] * loff];
}

// 检查分流器某条 lane 的入口传送带上是否有物品（有货要流进来），从而驱动流入动画。
// 入口传送带位于分流器后方沿 dir 反方向；只要带上有物品且方向朝向分流器，即视为“有货流入”。
function splitterInputHasItem(e, l, gx, gy) {
  const [lx, ly] = laneCenterAt(e, gx, gy, l);
  const inTx = Math.floor((lx - DX[e.dir] * TILE) / TILE);
  const inTy = Math.floor((ly - DY[e.dir] * TILE) / TILE);
  const inEnt = entAt(inTx, inTy);
  if (!inEnt || !inEnt.items || !inEnt.items.length) return false;
  // 传送带上确有物品（物品最终会流向分流器）
  return true;
}

// 重新设计的分流器流动动画：
//  - 流入动画（入口→中心）：某 lane 入口接了传送带，且（入口传送带上有货 或 分流器内部确有物品正在从该入口流入）；
//  - 流出动画（中心→出口）：某 lane 出口接了传送带，且分流器内部确有物品正在从该出口流出。
// 这样既能避免“出口没接带却凭空消失 / 入口没货却凭空产生”，又能在物品即将进入/正在离开时保持动画连贯。
function drawSplitterFlow(ctx, e, gx, gy, color, alpha) {
  const links = splitterLinks(e, gx, gy);
  const inFlow = [false, false], outFlow = [false, false];
  for (let l = 0; l < 2; l++) {
    // 流入：入口接带 &&（入口传送带上有货 或 分流器内部有物品正从该入口流向中心）
    inFlow[l] = links.inp[l] && (splitterInputHasItem(e, l, gx, gy) ||
      e.items.some(o => o.inPort === l && o.pos < 0.5));
    // 流出：出口接带 && 分流器内部确有物品正在从该出口流向出口
    outFlow[l] = links.out[l] && e.items.some(o => (o.outPort !== undefined ? o.outPort : o.inPort) === l && o.pos >= 0.5);
  }
  if (!inFlow[0] && !inFlow[1] && !outFlow[0] && !outFlow[1]) return;
  const cx = (gx + e.w / 2) * TILE, cy = (gy + e.h / 2) * TILE;
  const dx = DX[e.dir], dy = DY[e.dir];
  const ang = Math.atan2(dy, dx);
  const step = TILE / 2;
  const offset = (G.time * beltSpeed() * (e.speedMult ? e.speedMult() : 1) * TILE) % step;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(0,0,0,.4)';
  ctx.lineWidth = 1;
  const drawArrow = (ax, ay) => {
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(ang);
    tri(ctx, -3, -5, -3, 5, 3, 0);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  };
  // 输出侧：从中心流向各出口 lane（仅对出口接带且确有物品流出的 lane 绘制）
  // 每个出口两条线（A/B 车道）各自绘制流向箭头，与入口双线对称，体现“一个出口对应两根物流线”。
  for (let l = 0; l < 2; l++) {
    if (!outFlow[l]) continue;
    for (let ln = 0; ln < 2; ln++) {
      const [lx, ly] = splitterLaneExitPoint(e, gx, gy, l, ln);
      const ox = lx + dx * TILE / 2, oy = ly + dy * TILE / 2;
      for (let k = 0; k <= 2; k++) {
        const t = (k * step + offset) / step;
        if (t > 1) continue;
        drawArrow(cx + (ox - cx) * t, cy + (oy - cy) * t);
      }
    }
  }
  // 输入侧：从各入口 lane 流向中心（仅对入口接带且确有物品流入的 lane 绘制）
  // 每个入口两条线（A/B 车道）各自绘制流向箭头，体现“一个入口对应两根物流线”。
  for (let l = 0; l < 2; l++) {
    if (!inFlow[l]) continue;
    for (let ln = 0; ln < 2; ln++) {
      const [lx, ly] = splitterLaneEntryPoint(e, gx, gy, l, ln);
      const ix = lx - dx * TILE / 2, iy = ly - dy * TILE / 2;
      for (let k = 0; k <= 2; k++) {
        const t = (k * step + offset) / step;
        if (t > 1) continue;
        drawArrow(ix + (cx - ix) * t, iy + (cy - iy) * t);
      }
    }
  }
  ctx.restore();
}

function drawSplitter(ctx, e, gx, gy, dir, alpha) {
  drawSplitterBase(ctx, e, gx, gy, dir, alpha, SPLITTER_COLORS.normal, null);
}

// 分流器物品绘制（供普通/优先级/极速/快速分流器复用）：
// 沿物品在分流器内部的 A/B 车道线绘制移动动画——
//  - 入口双线进料（两入口 × 双线），物品沿各自车道线流入中心；
//  - 出口双线出料（两出口 × 双线），物品沿各自车道线流出。
// 入口/出口未接传送带时不绘制该口物品动画（物品不会凭空出现/消失）。
// 物品进入口由 inPort（上格0/下格1）决定，输出口由 outPort 决定，
// 车道由 lane（输入）与 outLane（输出）决定，A/B 车道保持不串（对齐《异星工厂》lane 保持）。
function drawSplitterItems(ctx, e, gx, gy, cx, cy) {
  const links = splitterLinks(e, gx, gy);
  for (const o of e.items) {
    const inPort = o.inPort !== undefined ? o.inPort : o.lane;
    const outPort = o.outPort !== undefined ? o.outPort : o.inPort;
    const outLane = o.outLane !== undefined ? o.outLane : o.lane;
    // 入口未接传送带：不绘制该入口的物品移动动画（物品不会凭空从无带入口出现）；
    // 出口未接传送带：不绘制该出口的物品移动动画（物品不会凭空流向无带出口）。
    if (o.pos <= 0.5 ? !links.inp[inPort] : !links.out[outPort]) continue;
    let ix, iy;
    if (o.pos <= 0.5) {
      // 入口双线进料：按 A/B 车道分别偏移，物品沿各自车道线流入（两入口 × 双线）
      const [lx, ly] = splitterLaneEntryPoint(e, gx, gy, inPort, o.lane === 1 ? 1 : 0);
      const inX = lx - DX[e.dir] * TILE / 2, inY = ly - DY[e.dir] * TILE / 2;
      const t = o.pos / 0.5;
      ix = inX + (cx - inX) * t;
      iy = inY + (cy - inY) * t;
    } else {
      // 出口双线出料：按 A/B 车道分别偏移，物品沿各自车道线流出（两出口 × 双线）
      const [lx, ly] = splitterLaneExitPoint(e, gx, gy, outPort, outLane === 1 ? 1 : 0);
      const ox2 = lx + DX[e.dir] * TILE / 2, oy2 = ly + DY[e.dir] * TILE / 2;
      const t = (o.pos - 0.5) / 0.5;
      ix = cx + (ox2 - cx) * t;
      iy = cy + (oy2 - cy) * t;
    }
    ((LOD && LOD.simple) ? drawItemDotLOD : drawItemDot)(ctx, ix, iy, o.item);
  }
}

// ===== 面板 =====
function splitterPanelHtml(e) {
  const prefNames = { '-1': '轮流两出口', '0': '优先一侧', '1': '优先另一侧' };
  const inPrefNames = { '-1': '轮流输入', '0': '优先上方输入', '1': '优先下方输入' };
  let h = '<div class="dim">分流器：两入两出（每入口/出口各对应两根物流线，共 4 线）。输入可设轮流或优先某口；输出轮流或优先一侧，A/B 车道各自保持；一边堵了自动走另一边。R 旋转方向。</div>';
  h += '<div class="dim">当前吞吐：<span data-live="speed">-</span>（件/秒，单侧车道）</div>';
  h += '<div class="mrow"><span class="mlabel">输入模式</span><span class="mval">';
  for (const v of [-1, 0, 1]) {
    h += '<button data-action="sinpref" data-v="' + v + '"' + (e.inPref === v ? ' style="border-color:#5fd45f;color:#5fd45f"' : '') + '>' + inPrefNames[v] + '</button> ';
  }
  h += '</span></div>';
  if (e.inPref === -1) h += '<div class="dim">轮流输入：两个输入口交替接纳，单口无货时另一口畅通不受影响。</div>';
  else if (e.inPref >= 0) h += '<div class="dim">带绿色箭头的一侧为优先输入口；该口有货时优先接纳，另一口仅作溢出通道。</div>';
  h += '<div class="mrow"><span class="mlabel">输出模式</span><span class="mval">';
  if (e.filter) {
    // 过滤模式下：输出优先级被过滤覆盖，显示为禁用状态
    h += '<span class="dim" style="opacity:.5">过滤模式下不可用</span>';
  } else {
    for (const v of [-1, 0, 1]) {
      h += '<button data-action="spref" data-v="' + v + '"' + (e.outPref === v ? ' style="border-color:#e09040;color:#e09040"' : '') + '>' + prefNames[v] + '</button> ';
    }
  }
  h += '</span></div>';
  if (!e.filter && e.outPref >= 0) h += '<div class="dim">带橙色箭头的一侧为优先输出道；堵住时自动溢出到另一侧。</div>';
  // 可编程分离器：物品过滤（对齐《异星工厂》Programmable splitter）
  h += '<div class="sec">过滤（可编程分离器）</div>';
  if (e.filter) h += '<div class="dim">过滤生效中：命中物品走优先侧，其余走另一侧。</div>';
  h += '<div class="mrow"><span class="mlabel">仅放行</span><span class="mval">' +
    (e.filter ? chip(e.filter) : '<span class="dim">全部放行</span>') + '</span></div>';
  if (e.filter) h += '<div class="mrow"><span class="mval"><button data-action="sflt-clear">清除过滤（放行所有物品）</button></span></div>';
  h += '<input id="sflt-search" class="inv-search" type="text" placeholder="搜索物品（输入名称）" autocomplete="off">';
  h += '<div id="sflt-empty" class="dim" style="display:none"></div>';
  h += '<div class="recgrid">';
  for (const id of (typeof filterChoices === 'function' ? filterChoices() : FILTER_CHOICES)) {
    const name = ITEMS[id]?.name || id;
    h += '<button class="rcbtn ' + (e.filter === id ? 'sel' : '') + '" data-action="sflt" data-id="' + id + '" data-itemid="' + id + '" data-search="' + (name + ' ' + id).toLowerCase() + '">' +
      '<img src="' + iconDataURL(id) + '">' + name + '</button>';
  }
  h += '</div>';
  return h;
}

// ===== 注册 =====
function splitterStatusFn(e) {
  if (!e.items.length) return 'r';
  return e.items.some(o => o.pos >= 0.499) ? 'y' : 'g';
}
function splitterOnAction(act, btn) {
  if (act === 'sinpref') {
    if (G.panelEnt instanceof Splitter) G.panelEnt.inPref = parseInt(btn.dataset.v, 10);
    return true;
  }
  if (act === 'spref') {
    if (G.panelEnt instanceof Splitter) G.panelEnt.outPref = parseInt(btn.dataset.v, 10);
    return true;
  }
  if (act === 'sflt') {
    if (G.panelEnt instanceof Splitter) G.panelEnt.filter = btn.dataset.id || null;
    return true;
  }
  if (act === 'sflt-clear') {
    if (G.panelEnt instanceof Splitter) G.panelEnt.filter = null;
    return true;
  }
  return false;
}
function splitterPanelLive(e, api) {
  const mult = e.speedMult ? e.speedMult() : 1;
  const speed = (1 / BELT_SPACING) * beltSpeed() * mult;
  api.set('speed', (Math.round(speed * 10) / 10) + '');
  if (e.filter) {
    const stuck = e.items.some(o => o.pos >= 0.999);
    api.status(stuck ? '过滤中：仅放行「' + ITEMS[e.filter].name + '」· 输出端拥堵' : '过滤中：仅放行「' + ITEMS[e.filter].name + '」· ' + e.items.length + ' 件在途', stuck ? 'warn' : 'ok');
    return;
  }
  const inMode = e.inPref >= 0 ? ('优先' + (e.inPref === 0 ? '上' : '下') + '口') : '轮流输入';
  const outMode = e.outPref >= 0 ? ('优先' + (e.outPref === 0 ? '左' : '右') + '出') : '轮流输出';
  if (!e.items.length) { api.status(inMode + ' · ' + outMode + ' · 空闲', 'ok'); return; }
  // 出口拥堵：任一物品到达输出端却无法送出（停住）
  const stuck = e.items.some(o => o.pos >= 0.999);
  api.status(stuck ? '已暂停：输出端拥堵' : inMode + ' · ' + outMode + ' · ' + e.items.length + ' 件在途', stuck ? 'warn' : 'ok');
}
const splitterPanel = { html: splitterPanelHtml, onAction: splitterOnAction, live: splitterPanelLive, tip: splitterTip };
function splitterTip(e) {
  const inInfo = e.inPref >= 0 ? '，优先某输入口' : (e.inPref === -1 ? '，轮流输入' : '');
  if (e.filter) return '分流器：仅放行「' + ITEMS[e.filter].name + '」' + (e.outPref >= 0 ? '，优先一侧' : '') + inInfo;
  return '分流器：两出口轮流输出，A/B 车道各自保持' + inInfo + '（R 旋转；点开面板可设输入/输出优先级与过滤）';
}
ENT_CLASSES['splitter'] = Splitter;
DEVICE_RENDER['splitter'] = drawSplitter;
DEVICE_STATUS['splitter'] = splitterStatusFn;
DEVICE_PANEL['splitter'] = splitterPanel;
