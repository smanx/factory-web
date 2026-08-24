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
  // 与同档传送带完全一致的吞吐：每 BELT_SPACING 格一个物品 → 间隔 = 间距/带速
  ugInterval() { return BELT_SPACING / Math.max(0.05, beltSpeed() * this.speedMult()); }
  update(dt) {
    // 惰性调度（P0 优化）：入口/出口都空时无需每帧扫描
    if ((!this.items || !this.items.length) && (!this.outItems || !this.outItems.length)) return;
    const iv = this.ugInterval();
    this.cd -= dt;
    const mate = this.findMate();
    if (mate) {
      // 本格是入口（或链中段，同时向更前方的出口输送）：把本格收进 items 的货
      // 以及后方入口转来的 outItems 一并送往前方出口，绝不向地面带外溢，
      // 保证“进洞的货只能从出口出来”，避免在入口下一格被普通传送带截走。
      if (this.cd <= 0 && mate.outItems.length < UG_CAP) {
        if (this.items.length > 0) {
          mate.outItems.push(this.items.shift());
          this.cd = iv;
        } else if (this.outItems.length > 0) {
          mate.outItems.push(this.outItems.shift());
          this.cd = iv;
        }
      }
    } else {
      // 纯出口（前方无同向地下带）：把收到的货投向地面（前方带/设备）
      this.ejectT = (this.ejectT || 0) - dt;
      if (this.outItems.length > 0 && this.ejectT <= 0) {
        const nx = this.x + DX[this.dir], ny = this.y + DY[this.dir];
        let sent = false;
        const t = entAt(nx, ny);
        if (t instanceof Belt) {
          if (!(t instanceof Splitter) && t.dir === ((this.dir + 2) % 4)) sent = false;
          else sent = t.acceptItem(this.outItems[0], this.dir);
        } else if (t && !(t instanceof Underground)) {
          sent = t.giveItem(this.outItems[0]);
        }
        if (sent) { this.outItems.shift(); this.ejectT = iv; }
        else this.ejectT = 0.15;
      }
    }
  }
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
  acceptItem(item) {
    if (this.items.length >= UG_CAP) return false;
    this.items.push(item);
    return true;
  }
  // 机械臂抓取：优先取出口待发（outItems），其次取入口缓存（items）。
  // 这样机械臂既能抓地下带出口即将喷射的货，也能抓入口尚未送入地下的缓存。
  peekItem() {
    if (this.outItems.length) return this.outItems[0];
    if (this.items.length) return this.items[0];
    return null;
  }
  countOf(item) {
    let n = 0;
    for (const it of this.outItems) if (it === item) n++;
    for (const it of this.items) if (it === item) n++;
    return n;
  }
  takeItemOf(item) {
    let i = this.outItems.indexOf(item);
    if (i >= 0) return this.outItems.splice(i, 1)[0];
    i = this.items.indexOf(item);
    if (i >= 0) return this.items.splice(i, 1)[0];
    return null;
  }
  takeOutput() {
    return this.outItems.length ? this.outItems.shift() : null;
  }
  takeItem() {
    if (this.outItems.length) return this.outItems.shift();
    if (this.items.length) return this.items.shift();
    return null;
  }
  giveItem(item) { return this.acceptItem(item); }
  contents() {
    const list = [[this.type, 1]];
    for (const it of [...this.items, ...this.outItems]) list.push([it, 1]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.items = this.items.slice();
    s.outItems = this.outItems.slice();
    return s;
  }
  static restore(s) {
    const u = super.restore(s);
    u.items = (s.items || []).slice();
    u.outItems = (s.outItems || []).slice();
    u.cd = 0;
    return u;
  }
}

class FastUnderground extends Underground {
  constructor(type, x, y) { super(type || 'fast-underground-belt', x, y); }
}

// ===== 渲染 =====
function drawUnderground(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  const mateA = !!e.findMate();
  const st = mateA ? 'in' : (!!e.findBackMate() ? 'out' : 'idle');
  const bodyCol = st === 'in' ? '#3f3552' : st === 'out' ? '#33405a' : '#3c4046';
  const accCol = st === 'in' ? '#b39ddb' : st === 'out' ? '#90caf9' : '#9aa0a8';

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
  const bcol = st === 'in' ? '#7e4fb0' : st === 'out' ? '#3f78b8' : '#555b64';
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
  if (e.findMate()) txt = '【入口】货物钻入地下送往同向6格内出口。缓存 ' + e.items.length + '/' + UG_CAP + '，待发 ' + e.outItems.length;
  else if (e.findBackMate()) txt = '【出口】接收上游隧道来货并向前输出。待发 ' + e.outItems.length;
  else txt = '【未配对】同向' + e.maxDist() + '格内没有另一座。仍可收货排队，配对后自动发车。缓存 ' + e.items.length + '/' + UG_CAP;
  return '<div class="dim">地下带' + txt + '。R 旋转方向。</div><div class="status"></div>';
}
function undergroundPanelLive(e, api) {
  const paired = !!e.findMate();
  const n = e.items.length + e.outItems.length;
  if (!paired) api.status('已暂停：未配对（同向 6 格内无另一座地下带）', 'warn');
  else if (e.outItems.length >= UG_CAP || e.items.length >= UG_CAP) api.status('已暂停：缓存已满，等待输出', 'warn');
  else if (n > 0) api.status('输送中：' + n + ' 件在途', 'ok');
  else api.status('待机：已配对，等待货物', 'ok');
}

// ===== 注册 =====
function undergroundStatusFn(e) {
  const paired = !!e.findMate();
  if (paired) {
    if (e.outItems.length >= UG_CAP || e.items.length >= UG_CAP) return 'y';
    return (e.items.length + e.outItems.length) > 0 ? 'g' : 'r';
  }
  return e.items.length > 0 ? 'y' : 'r';
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
