'use strict';

// ===== 抽水机：必须放在水面上，免电力无限取水 =====
class Pump extends Entity {
  constructor(type, x, y) {
    super('offshore-pump', x, y);
    this.buf = 0;
    this.working = false;
    this.pulse = 0;
  }
  update(dt) {
    this.working = false;
    const room = Math.max(0, WATER_CAP - this.buf);
    const take = Math.min(room, PUMP_RATE * dt);
    if (take > 0) { this.buf += take; this.working = true; }
    if (this.working) this.pulse = (this.pulse + dt * 1.6) % 1;
    this.tryOutput();
  }
  // 只朝箭头方向输出：送入管道，或指向锅炉两端水口格直接供水（从脚印对应边缘出发）
  tryOutput() {
    let guard = 0;
    while (this.buf >= 1 && guard++ < 20) {
      // 从脚印朝向侧边缘输出
      let cx, cy;
      if (this.dir === 0) { cx = this.x + this.w; cy = this.y; }
      else if (this.dir === 2) { cx = this.x - 1; cy = this.y; }
      else if (this.dir === 1) { cx = this.x; cy = this.y + this.h; }
      else { cx = this.x; cy = this.y - 1; }
      const t = entAt(cx, cy);
      if (t instanceof Pipe) {
        if (!t.giveItem('water')) break;
      } else if (t instanceof Boiler) {
        if (!t.acceptsPumpFeed(cx, cy, this.dir) || !t.giveItem('water')) break;
      } else break;
      this.buf--;
    }
  }
  giveItem(item) {
    if (item === 'water' && this.buf < WATER_CAP) { this.buf++; return true; }
    return false;
  }
  peekItem() { return this.buf >= 1 ? 'water' : null; }
  takeItem() { if (this.buf >= 1) { this.buf--; return 'water'; } return null; }
  countOf(item) { return item === 'water' ? Math.floor(this.buf) : 0; }
  takeItemOf(item) { if (item === 'water' && this.buf >= 1) { this.buf--; return 'water'; } return null; }
  contents() {
    const list = [[this.type, 1]];
    if (this.buf >= 1) list.push(['water', Math.floor(this.buf)]);
    return list;
  }
  serialize() { const s = super.serialize(); s.buf = this.buf; return s; }
  static restore(s) { const p = super.restore(s); p.buf = s.buf || 0; return p; }
}

// ===== 渲染 =====
function drawPump(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const pw = TILE * e.w, ph2 = TILE * e.h;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#1d3d55';
  rr(ctx, px + 2, py + 2, pw - 4, ph2 - 4, 7); ctx.fill();
  ctx.strokeStyle = '#12293b';
  ctx.lineWidth = 2;
  rr(ctx, px + 2, py + 2, pw - 4, ph2 - 4, 7); ctx.stroke();
  ctx.fillStyle = '#3f9fc0';
  rr(ctx, px + 8, py + 8, pw - 16, ph2 - 16, 5); ctx.fill();
  ctx.strokeStyle = '#26688a';
  ctx.lineWidth = 2;
  rr(ctx, px + 8, py + 8, pw - 16, ph2 - 16, 5); ctx.stroke();
  if (e.working) { // 抽水涟漪
    const ph = (e.pulse || 0) % 1;
    ctx.strokeStyle = 'rgba(170,225,255,' + (0.65 * (1 - ph)).toFixed(2) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px + pw / 2, py + ph2 / 2, 5 + ph * 11, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#9fd8f0';
    ctx.beginPath();
    ctx.arc(px + pw / 2, py + ph2 / 2, 5, 0, 7);
    ctx.fill();
  }
  ctx.fillStyle = dirColorNotch(dir);
  notch(ctx, px, py, dir);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 9px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('抽水机', px + pw / 2, py + ph2 / 2 + 12);
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function pumpPanelHtml(e) {
  let h = row('储水', '<span class="dim"></span>', 'buf');
  h += barHtml(0);
  h += '<div class="status"></div>';
  h += '<div class="dim">必须放在水面上，免电力无限抽水。产出朝箭头方向：指向锅炉左端/右端蓝口水口可直接供水，或接入管道远送。选中后按 R 旋转方向。</div>';
  return h;
}
function pumpPanelLive(e, api) {
  api.set('buf', e.buf >= 1 ? chip('water', Math.floor(e.buf)) : dimSpan('空'));
  api.prog(e.working ? e.pulse * 100 : ((e.buf || 0) / WATER_CAP * 100));
  api.status(e.working ? '抽水中，产出朝' + ['东', '南', '西', '北'][e.dir]
    : (e.buf >= 1 ? '缓存已满，等待输出' : '待机'));
}
function pumpTip(e) {
  return e.working ? '抽水中，产出朝' + ['东', '南', '西', '北'][e.dir]
    : ((e.buf || 0) >= 1 ? '缓存满，等待输出' : '待机');
}

// ===== 注册 =====
ENT_CLASSES['offshore-pump'] = Pump;
DEVICE_RENDER['offshore-pump'] = drawPump;
DEVICE_STATUS['offshore-pump'] = e => e.working ? 'g' : ((e.buf || 0) >= 1 ? 'y' : 'r');
DEVICE_PANEL['offshore-pump'] = { html: pumpPanelHtml, live: pumpPanelLive, tip: pumpTip };
// 放置规则：只能放在水面上的空格（完全替换默认校验）
DEVICE_PLACE['offshore-pump'] = (type, tx, ty, dir, ew, eh) => {
  if (!ew) ew = 2; if (!eh) eh = 1;
  for (let dy = 0; dy < eh; dy++)
    for (let dx = 0; dx < ew; dx++) {
      const cx = tx + dx, cy = ty + dy;
      if (!isWater(cx, cy) || entAt(cx, cy) || !withinReach(cx, cy)) return { ok: false };
    }
  return { ok: true };
};
DEVICE_DIR_ROTATE['offshore-pump'] = true;
