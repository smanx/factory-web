'use strict';

// ===== 传送带 =====
class Belt extends Entity {
  constructor(type, x, y) {
    super(type || 'transport-belt', x, y);
    this.items = [];
    // 电路控制（对齐《异星工厂》：传送带接入电路网络，可按信号启停）
    this.circuitCond = { enabled: false, channel: 'red', sig: 'iron-plate', op: '>', count: 1 };
  }
  // 电路启停：未启用条件时恒运转；启用后仅当附近电路信号满足条件才送带
  circuitEnabled() {
    if (!this.circuitCond || !this.circuitCond.enabled) return true;
    const sig = circuitSignalNear(this);
    return circuitCondOk(sig, this.circuitCond);
  }
  speedMult() { return this.type === 'fast-transport-belt' ? FAST_BELT_MULT : 1; }
  update(dt) {
    // 电路条件不满足时传送带停转，带上物品原地冻结
    if (!this.circuitEnabled()) return;
    // 惰性调度（P0 优化）：空带没有任何可移动物品，跳过真实更新
    // （排序/邻居扫描/转移判定），空传送带完全无需每帧运行。
    if (!this.items || this.items.length === 0) return;
    const sp = beltSpeed() * this.speedMult() * dt;
    // 优化：使用插入排序替代 Array.sort()，对近乎有序的数据更高效（O(n) vs O(n log n)）
    // 物品每帧仅移动微小距离，数组几乎已排序，插入排序是最佳选择
    const items = this.items;
    for (let i = 1; i < items.length; i++) {
      const key = items[i];
      let j = i - 1;
      while (j >= 0 && items[j].pos < key.pos) {
        items[j + 1] = items[j];
        j--;
      }
      items[j + 1] = key;
    }
    if (items.length && items[0].pos + sp >= 1) this.transferFront();
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      let lim = 1;
      if (i > 0) lim = Math.max(0, items[i - 1].pos - BELT_SPACING);
      it.pos = Math.min(it.pos + sp, lim);
      if (it.pos < 0) it.pos = 0;
    }
  }
  transferFront() {
    const f = this.items[0];
    const nx = this.x + DX[this.dir], ny = this.y + DY[this.dir];
    const nb = entAt(nx, ny);
    if (!nb) return false;
    if (nb instanceof Belt) {
      if (!(nb instanceof Splitter)) {
        if (nb.dir === ((this.dir + 2) % 4)) return false;
        let back = Infinity;
        for (const o of nb.items) back = Math.min(back, o.pos);
        if (back < BELT_SPACING) return false;
      }
      if (!nb.acceptItem(f.item, this.dir, this.x, this.y)) return false;
      this.items.shift();
      return true;
    }
    if ((nb instanceof Underground || nb instanceof Splitter) && nb.giveItem(f.item)) {
      this.items.shift();
      return true;
    }
    return false;
  }
  // 判断邻居带 (x,y) 是否“有货即将进入本带”：其前端物品已过半程、逼近出口。
  // 用于 T 型转角调度：直线优先时判定直通方向是否待进入；双侧轮流时判定对侧是否待进入。
  _beltIncoming(x, y) {
    const nb = entAt(x, y);
    if (!(nb instanceof Belt) || !nb.items || !nb.items.length) return false;
    for (const o of nb.items) if (o.pos >= 0.5) return true;
    return false;
  }
  // 是否背面存在同向直行带（即“直线输入”，与出口同一直线）。
  _hasStraightBack() {
    const bx = this.x - DX[this.dir], by = this.y - DY[this.dir];
    const nb = entAt(bx, by);
    return nb instanceof Belt && nb.dir === this.dir;
  }
  acceptItem(item, fromDir) {
    const rel = (fromDir === undefined || fromDir === null) ? -1 : ((fromDir - this.dir) % 4 + 4) % 4;
    const isSide = rel === 1 || rel === 3;
    const side = isSide ? beltSideIndex(this, fromDir) : -1;
    const inp = beltInputSide(this);
    const haveBack = this._hasStraightBack();

    // —— 调度规则（仅对 T 型多路进“双路进一出”生效）——
    if (isSide && (haveBack || inp.length >= 2)) {
      // 1) 直线优先：背面存在直通输入时，直线方向先于侧面进入；
      //    直通有货待进入则侧面暂缓（return false，让直通先过）。
      if (haveBack && this._beltIncoming(this.x - DX[this.dir], this.y - DY[this.dir])) return false;
      // 2) 两个相对侧面（无背面直通）：轮流进入。
      //    若上次进入的也是本侧且对侧有货待进入，则让对侧先进（本侧暂缓）。
      if (!haveBack && inp.length >= 2 && this._lastSideIn === side) {
        const other = inp[1 - side];
        if (other && this._beltIncoming(this.x + other[0], this.y + other[1])) return false;
      }
      this._lastSideIn = side;
    }

    const candidates = [];
    if (isSide) candidates.push(0.45);
    candidates.push(0);
    for (const p of candidates) {
      let ok = true;
      for (const o of this.items)
        if (Math.abs(o.pos - p) < BELT_SPACING) { ok = false; break; }
      if (ok) { this.items.push({ item, pos: p, side: isSide ? side : -1 }); return true; }
    }
    return false;
  }
  grabZone(item) {
    let best = null;
    for (const o of this.items)
      if (o.pos >= 0.2 && (!item || o.item === item) && (!best || o.pos > best.pos)) best = o;
    return best;
  }
  countOf(item) {
    let n = 0;
    for (const o of this.items) if (o.pos >= 0.2 && o.item === item) n++;
    return n;
  }
  peekItem() {
    const z = this.grabZone();
    return z ? z.item : null;
  }
  takeOutput() {
    const z = this.grabZone();
    if (!z) return null;
    this.items.splice(this.items.indexOf(z), 1);
    return z.item;
  }
  // 手动拿取（F 键）：取带上最前端的物品
  takeItem() {
    if (!this.items.length) return null;
    let best = this.items[0];
    for (const o of this.items) if (o.pos > best.pos) best = o;
    this.items.splice(this.items.indexOf(best), 1);
    return best.item;
  }
  contents() {
    const list = [[this.type, 1]];
    for (const o of this.items) list.push([o.item, 1]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.items = this.items.map(o => [o.item, +o.pos.toFixed(3), o.side === undefined ? -1 : o.side]);
    if (this.circuitCond) s.circuitCond = this.circuitCond;
    return s;
  }
  static restore(s) {
    const b = super.restore(s);
    b.items = (s.items || []).map(a => ({ item: a[0], pos: a[1], side: a.length > 2 ? a[2] : -1 }));
    b.circuitCond = s.circuitCond || { enabled: false, channel: 'red', sig: 'iron-plate', op: '>', count: 1 };
    return b;
  }
}

// ===== 渲染 =====
function dirIndexOf(dx, dy) {
  for (let i = 0; i < 4; i++) if (DX[i] === dx && DY[i] === dy) return i;
  return -1;
}

// beltInputSide 结果缓存在实体上：邻居增删时由 addEnt/removeEnt 统一失效，
// 避免每帧为每条传送带反复遍历邻居实体（P0 优化）。
// 返回一个数组：横向传送带的左右两侧都可各接一条传送带（对齐《异星工厂》），
// 因此这里返回 0~2 个侧面输入源，而不再只取第一个。
function beltInputSide(e) {
  if (e.__inpCached) return e.__inp;
  const fdx = DX[e.dir], fdy = DY[e.dir];
  const sides = [[fdy, -fdx], [-fdy, fdx]];
  const inps = [];
  for (const [sx, sy] of sides) {
    const nb = entAt(e.x + sx, e.y + sy);
    if (!nb) continue;
    const want = dirIndexOf(-sx, -sy);
    // 地下带只有“出口”（已配对、后方有mate）才会把货投向地面带，
    // 入口会把货钻入地下、不会向旁边传送带输出，因此入口不搭在侧面传送带上。
    // 未配对的地下带仅作静态显示，不搭在其他传送带上（对齐《异星工厂》）。
    if (nb instanceof Underground && nb.dir === want && nb.findBackMate()) { inps.push([sx, sy]); continue; }
    if (nb instanceof Belt && nb.dir === want) { inps.push([sx, sy]); continue; }
  }
  e.__inp = inps;
  e.__inpCached = true;
  return inps;
}

// 返回 fromDir 对应的侧面输入索引（0/1），若 not 侧面输入返回 -1。
// 用于 acceptItem 记录物品来自哪个侧面，从而在渲染时让物品从对应侧面“搭上去”。
function beltSideIndex(e, fromDir) {
  const fdx = DX[e.dir], fdy = DY[e.dir];
  const sides = [[fdy, -fdx], [-fdy, fdx]];
  const sx = -DX[fromDir], sy = -DY[fromDir];
  for (let i = 0; i < 2; i++) if (sides[i][0] === sx && sides[i][1] === sy) return i;
  return -1;
}

// ===== 90° 转角渲染 =====
// 判断是否为"纯 90° 转角"：有且仅有一个侧面输入，且背面（与行进方向相反）
// 没有同向直行传送带。这样的单转角用弯曲圆弧绘制，区别于 T 型转角（背面有直行）。
// 返回该侧面输入方向向量；非转角返回 null。
function beltCornerDir(e) {
  const inp = beltInputSide(e);
  if (inp.length !== 1) return null;
  const bx = e.x - DX[e.dir], by = e.y - DY[e.dir];
  const nb = entAt(bx, by);
  if (nb instanceof Belt && nb.dir === e.dir) return null; // 背面有直行 → T 型，非纯转角
  return inp[0];
}

// 绘制 90° 转角（弯曲圆弧带）。返回 true 表示已按转角绘制完成（含动效与物品）。
// colors: { belt: 轨道底色, chev: 动效箭头色 }
function drawBeltCorner(ctx, e, gx, gy, dir, alpha, colors) {
  const s = beltCornerDir(e);
  if (!s) return false;
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  const step = TILE / 2;
  // 转角圆弧的圆心 = 入口边与出口边相交的格角点
  // （竖直格边坐标来自水平方向 s/dir，水平格边坐标来自竖直方向 s/dir）
  const CCx = (s[0] !== 0 ? s[0] : DX[dir]) * step;
  const CCy = (s[1] !== 0 ? s[1] : DY[dir]) * step;
  const aE = Math.atan2(s[1] * step - CCy, s[0] * step - CCx); // 入口角
  const aX = Math.atan2(DY[dir] * step - CCy, DX[dir] * step - CCx); // 出口角
  let d = aX - aE;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  const ccw = d < 0;
  // 轨道带：带宽 18 与直行带一致，中心线半径 = step（衔接相邻格边中心）
  const rIn = step - 9, rOut = step + 9, rC = step;

  // 轨道底色（圆环带）
  ctx.globalAlpha = alpha;
  ctx.fillStyle = colors.belt;
  ctx.strokeStyle = '#22252a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx + CCx, cy + CCy, rOut, aE, aX, ccw);
  ctx.arc(cx + CCx, cy + CCy, rIn, aX, aE, !ccw);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 动效箭头沿弧（随带速前进）
  const off = ((G.time * beltSpeed() * (e.speedMult ? e.speedMult() : 1) * TILE) % step + step) % step;
  const arcLen = rC * Math.abs(d);
  ctx.fillStyle = colors.chev;
  for (let ap = off - step; ap <= arcLen + step; ap += step) {
    if (ap < 0 || ap > arcLen) continue;
    const ang = aE + d * (ap / arcLen);
    const ax = cx + CCx + Math.cos(ang) * rC, ay = cy + CCy + Math.sin(ang) * rC;
    // 切向即物品行进方向
    const tAng = ccw ? Math.atan2(-Math.cos(ang), Math.sin(ang)) : Math.atan2(Math.cos(ang), -Math.sin(ang));
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(tAng);
    tri(ctx, -3, -5, -3, 5, 3, 0);
    ctx.fill();
    ctx.restore();
  }

  // 物品沿圆弧行进
  const itemFn = (LOD && LOD.simple) ? drawItemDotLOD : drawItemDot;
  for (const o of e.items) {
    const ang = aE + d * o.pos;
    const ix = cx + CCx + Math.cos(ang) * rC, iy = cy + CCy + Math.sin(ang) * rC;
    itemFn(ctx, ix, iy, o.item);
  }
  ctx.globalAlpha = 1;
  return true;
}

// 传送带配色解析：普通/快速带为黄橙系，创造带为绿色系，虚空带为暗红系（测试设备）。
function beltColors(e) {
  if (e.type === 'fast-transport-belt') return { belt: '#4a3a34', chev: 'rgba(226,102,54,.9)' };
  if (e.type === 'creative-belt') return { belt: '#2e6b3a', chev: 'rgba(140,255,175,.9)' };
  if (e.type === 'void-belt') return { belt: '#3a2a28', chev: 'rgba(255,138,128,.9)' };
  return { belt: '#3a3f47', chev: 'rgba(224,178,60,.85)' };
}

function drawBelt(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  const inp = beltInputSide(e);
  const col = beltColors(e);
  // 纯 90° 转角：直接以弯曲圆弧绘制，区分于 T 型转角
  if (drawBeltCorner(ctx, e, gx, gy, dir, alpha, col)) {
    drawBeltMark(ctx, e, gx, gy, alpha);
    return;
  }
  ctx.globalAlpha = alpha;
  ctx.fillStyle = col.belt;
  ctx.strokeStyle = '#22252a';
  ctx.lineWidth = 2;

  function strip(angle, x0, len) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    rr(ctx, x0, -9, len, 18, 4);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  const step = TILE / 2;
  const off = ((G.time * beltSpeed() * (e.speedMult ? e.speedMult() : 1) * TILE) % step + step) % step;

  strip(dir * Math.PI / 2, -TILE / 2 + 2, TILE - 4);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(dir * Math.PI / 2);
  ctx.beginPath();
  ctx.rect(-TILE / 2 + 3, -TILE / 2 + 3, TILE - 6, TILE - 6);
  ctx.clip();
  ctx.fillStyle = col.chev;
  for (let k = -1; k <= 2; k++) {
    const xx = -step + k * step + off;
    tri(ctx, xx - 3, -5, xx - 3, 5, xx + 3, 0);
    ctx.fill();
  }
  ctx.restore();

  // 侧面接入带：在主带箭头之后绘制，用带面色覆盖溢出的主轴箭头，
  // 避免 T 型转角（双入单出）里侧面分支区域残留主方向箭头、造成流动“断开一小截”
  for (const s of inp) strip(Math.atan2(s[1], s[0]), 0, step);

  // 每个侧面输入各画一条接入带动效，两侧可同时“搭上去”
  for (const s of inp) {
    const sa = Math.atan2(s[1], s[0]);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(sa);
    ctx.beginPath();
    ctx.rect(0, -TILE / 2 + 3, step, TILE - 6);
    ctx.clip();
    ctx.fillStyle = col.chev;
    for (let k = 0; k <= 2; k++) {
      const xx = k * step - off;
      if (xx < -3 || xx > step + 3) continue;
      tri(ctx, xx + 3, -5, xx + 3, 5, xx - 3, 0);
      ctx.fill();
    }
    ctx.restore();
  }

  const exitX = DX[dir] * step, exitY = DY[dir] * step;
  // 低 LOD：物品用色块直填，省去 clip+glyph 的昂贵路径绘制
  const itemFn = (LOD && LOD.simple) ? drawItemDotLOD : drawItemDot;
  for (const o of e.items) {
    let ix, iy;
    // 前半段（pos<0.5）：从入口走到格心。仅“确实来自侧面”的物品走侧面接入线；
    // 直通物品（side<0，从背面同向进来）及无侧面输入的普通带仍沿主轴从背面进入，
    // 避免 T 型转角里直通方向的物品被错误画到侧面分支上。
    const fromSide = inp.length > 0 && o.side !== undefined && o.side >= 0 && o.side < inp.length;
    if (o.pos < 0.5) {
      if (fromSide) {
        const s = inp[o.side];
        const inX = cx + s[0] * step, inY = cy + s[1] * step;
        const t = o.pos / 0.5;
        ix = inX + (cx - inX) * t;
        iy = inY + (cy - inY) * t;
      } else {
        const inX = cx - DX[dir] * step, inY = cy - DY[dir] * step; // 背面入口
        const t = o.pos / 0.5;
        ix = inX + (cx - inX) * t;
        iy = inY + (cy - inY) * t;
      }
    } else {
      // 后半段：从格心走到出口（侧面与直通物品共用）
      const t = (o.pos - 0.5) / 0.5;
      ix = cx + exitX * t;
      iy = cy + exitY * t;
    }
    itemFn(ctx, ix, iy, o.item);
  }
  drawBeltMark(ctx, e, gx, gy, alpha);
  ctx.globalAlpha = 1;
}

// 创造/虚空传送带叠加角标：绿色 ∞（创造带）与红色 ×（虚空带），便于辨识测试设备。
function drawBeltMark(ctx, e, gx, gy, alpha) {
  if (e.type !== 'creative-belt' && e.type !== 'void-belt') return;
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  if (e.type === 'creative-belt') {
    // 角标底色小圆
    ctx.fillStyle = '#1d4d29';
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, 7); ctx.fill();
    // ∞ 标志
    ctx.strokeStyle = '#d8ffe0';
    ctx.lineWidth = 2;
    const R = 3.2;
    ctx.beginPath(); ctx.ellipse(cx - 3.4, cy, R, R * 0.6, 0, 0, 7); ctx.stroke();
    ctx.beginPath(); ctx.ellipse(cx + 3.4, cy, R, R * 0.6, 0, 0, 7); ctx.stroke();
    // 选中物品色点
    if (e.selected && ITEMS[e.selected]) {
      ctx.fillStyle = ITEMS[e.selected].color;
      ctx.beginPath(); ctx.arc(cx, cy + 6.5, 2.2, 0, 7); ctx.fill();
    }
  } else {
    // 虚空带：红色 ×
    ctx.fillStyle = '#2a1a18';
    ctx.beginPath(); ctx.arc(cx, cy, 6, 0, 7); ctx.fill();
    ctx.strokeStyle = '#ff8a80';
    ctx.lineWidth = 2.5;
    const R = 3.4;
    ctx.beginPath();
    ctx.moveTo(cx - R, cy - R); ctx.lineTo(cx + R, cy + R);
    ctx.moveTo(cx + R, cy - R); ctx.lineTo(cx - R, cy + R);
    ctx.stroke();
  }
  ctx.restore();
}

// ===== 注册 =====
function beltPanelHtml(e) {
  return '<div class="dim">传送带：物品沿箭头方向流动。R 旋转方向。靠近后按 F 拿取带上物品。</div>' +
    '<div class="dim">当前速度：<span data-live="speed">-</span>（格/秒）</div>' +
    (typeof circuitPanelHtml === 'function' ? circuitPanelHtml(e, 'belt') : '') +
    '<div class="status"></div>';
}
function beltPanelLive(e, api) {
  if (!e.circuitEnabled()) { api.status('已停止：电路条件不满足', 'warn'); return; }
  const mult = e.speedMult ? e.speedMult() : 1;
  const speed = beltSpeed() * mult;
  api.set('speed', speed.toFixed(speed >= 10 ? 1 : 2));
  const agg = {};
  for (const o of e.items) agg[o.item] = (agg[o.item] || 0) + 1;
  if (e.items.length) api.status('输送中：' + Object.keys(agg).map(k => ITEMS[k].name + '×' + agg[k]).join('、'), 'ok');
  else api.status('空闲（无物品）', 'ok');
}
function beltTip(e) {
  if (e.items.length) {
    const agg = {};
    for (const o of e.items) agg[o.item] = (agg[o.item] || 0) + 1;
    return '载物 ' + Object.keys(agg).map(k => ITEMS[k].name + '×' + agg[k]).join('、') + '，按F拿取';
  }
  return '空闲';
}
ENT_CLASSES['transport-belt'] = Belt;
ENT_CLASSES['fast-transport-belt'] = Belt;
DEVICE_RENDER['transport-belt'] = drawBelt;
DEVICE_RENDER['fast-transport-belt'] = drawBelt;
DEVICE_STATUS['transport-belt'] = e => e.items.length ? 'g' : 'r';
DEVICE_STATUS['fast-transport-belt'] = e => e.items.length ? 'g' : 'r';
const beltPanel = { html: beltPanelHtml, live: beltPanelLive, tip: beltTip, onAction: (a) => (typeof circuitPanelAction === 'function' ? circuitPanelAction('belt', a) : false) };
DEVICE_PANEL['transport-belt'] = beltPanel;
DEVICE_PANEL['fast-transport-belt'] = beltPanel;
// 已铺设的传送带可用 R 键直接旋转方向（对齐《异星工厂》）
DEVICE_DIR_ROTATE['transport-belt'] = true;
DEVICE_DIR_ROTATE['fast-transport-belt'] = true;
