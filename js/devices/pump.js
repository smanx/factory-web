'use strict';

// ===== 抽水机：必须放在水面上，免电力无限取水 =====
class Pump extends Entity {
  constructor(type, x, y) {
    super('offshore-pump', x, y);
    this.buf = 0;
    this.working = false;
    this.pulse = 0;
    this.applyDir();
  }
  // 整个设备随方向旋转：横向(东/西)为 2×1，纵向(南/北)为 1×2
  applyDir() {
    if (this.dir % 2 === 1) { this.w = this.def.h; this.h = this.def.w; }
    else { this.w = this.def.w; this.h = this.def.h; }
  }
  update(dt) {
    this.working = false;
    const room = Math.max(0, WATER_CAP - this.buf);
    const take = Math.min(room, PUMP_RATE * dt);
    if (take > 0) { this.buf += take; this.working = true; }
    if (this.working) this.pulse = (this.pulse + dt * 1.6) % 1;
    // 泵音效节流（仅屏内可见时播放，约每 1.1 秒一次，避免连续刷音）
    this._pumpSfxT = (this._pumpSfxT || 0) - dt;
    if (this.working && this._pumpSfxT <= 0 && typeof onScreen === 'function' && onScreen(this)) {
      this._pumpSfxT = 1.1;
      if (typeof playSfx === 'function') playSfx('pump');
    }
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
  static restore(s) {
    const p = new Pump(s.type, s.x, s.y);
    p.dir = s.dir | 0;
    p.applyDir();
    p.buf = s.buf || 0;
    return p;
  }
}

// ===== 渲染 =====
// 整个抽水机机身随方向(dir)旋转：基准朝东(2×1 横放)，旋转后 1×2 纵放，
// 设备整体朝向即水流出口方向，而不再只是出口箭头单独旋转。
function drawPump(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE * e.w / 2, cy = py + TILE * e.h / 2;
  ctx.globalAlpha = alpha;
  ctx.save();
  ctx.translate(cx, cy);
  // 旋转整个机身，使其朝向 dir（基准方向为东）
  ctx.rotate(dir * Math.PI / 2);
  const W = TILE * 2, H = TILE;      // 基准 2×1 机身尺寸
  const lx = -W / 2, ly = -H / 2;    // 基准机身左上角（相对中心）
  ctx.fillStyle = '#1d3d55';
  rr(ctx, lx + 2, ly + 2, W - 4, H - 4, 7); ctx.fill();
  ctx.strokeStyle = '#12293b';
  ctx.lineWidth = 2;
  rr(ctx, lx + 2, ly + 2, W - 4, H - 4, 7); ctx.stroke();
  ctx.fillStyle = '#3f9fc0';
  rr(ctx, lx + 8, ly + 8, W - 16, H - 16, 5); ctx.fill();
  ctx.strokeStyle = '#26688a';
  ctx.lineWidth = 2;
  rr(ctx, lx + 8, ly + 8, W - 16, H - 16, 5); ctx.stroke();
  if (e.working) { // 抽水涟漪
    const ph = (e.pulse || 0) % 1;
    ctx.strokeStyle = 'rgba(170,225,255,' + (0.65 * (1 - ph)).toFixed(2) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 5 + ph * 11, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#9fd8f0';
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, 7);
    ctx.fill();
  }
  // 出口箭头：贴在设备出流端（朝向那一侧的短边），指向出流方向，标识水流输出位置
  ctx.fillStyle = dirColorNotch(dir);
  notch(ctx, 0, -H / 2, 0);
  ctx.restore();
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
  if (e.working) api.status('抽水中，产出朝' + ['东', '南', '西', '北'][e.dir], 'ok');
  else if (e.buf >= 1) api.status('已暂停：缓存已满，等待输出', 'warn');
  else api.status('待机：等待抽水', 'ok');
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

// 抽水机旋转/翻转后新脚印是否仍合法：必须仍全压水面、不与其它实体重叠、且在触及范围内
function pumpCanFace(e, newDir) {
  const def = BUILD_DEFS['offshore-pump'];
  let ew = def.w, eh = def.h;
  if (newDir % 2 === 1) { ew = def.h; eh = def.w; }
  for (let dy = 0; dy < eh; dy++)
    for (let dx = 0; dx < ew; dx++) {
      const cx = e.x + dx, cy = e.y + dy;
      if (!isWater(cx, cy)) return false;
      const t = entAt(cx, cy);
      if (t && t !== e) return false;
      if (!withinReach(cx, cy)) return false;
    }
  return true;
}
