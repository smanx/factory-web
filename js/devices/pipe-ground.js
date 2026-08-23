'use strict';

// ===== 地下管道：同向摆两座（最远 PIPE_GROUND_MAX 格）自动配对，从地下穿行流体 =====
// 可跨过传送带/管道等障碍，容量与普通管道一致（PIPE_CAP）。入口端把流体送入地下，
// 出口端把地下流体送回地面管道网络。
const PIPE_GROUND_MAX = 10;
class PipeToGround extends Entity {
  constructor(type, x, y) {
    super('pipe-to-ground', x, y);
    this.fluid = {};   // 当前格内缓冲流体（用于配对面判断与地面交互）
  }
  total() { let s = 0; for (const k in this.fluid) s += this.fluid[k]; return s; }
  maxDist() { return PIPE_GROUND_MAX; }
  findMate() {
    for (let k = 1; k <= this.maxDist(); k++) {
      const nx = this.x + DX[this.dir] * k, ny = this.y + DY[this.dir] * k;
      const t = entAt(nx, ny);
      if (!t) continue;
      if (t instanceof PipeToGround) return (t.dir === this.dir) ? t : null;
      // 中间不可隔普通管道？不：地下管道本身就是用于穿越管道。但不可隔其它固体设备
      if (t instanceof Pipe) continue;
      if (t.solid) return null;
    }
    return null;
  }
  // 是否为“入口端”：沿 dir 前方有配对出口
  isInlet() { return !!this.findMate(); }
  // 是否为“出口端”：沿 dir 后方有配对入口
  isOutlet() { return !!this.findBackMate(); }
  findBackMate() {
    for (let k = 1; k <= this.maxDist(); k++) {
      const nx = this.x - DX[this.dir] * k, ny = this.y - DY[this.dir] * k;
      const t = entAt(nx, ny);
      if (!t) continue;
      if (t instanceof PipeToGround) return (t.dir === this.dir) ? t : null;
      if (t instanceof Pipe) continue;
      if (t.solid) return null;
    }
    return null;
  }
  update(dt) {
    // 无配对则无传输
    if (!this.findMate()) return;
    // 入口端：从背侧管道吸入流体，送入地下缓冲（总量受 PIPE_CAP 限制）
    // 出口端：把地下缓冲排向正前方管道
    if (this.isInlet()) {
      const back = entAt(this.x - DX[this.dir], this.y - DY[this.dir]);
      if (back instanceof Pipe && this.total() < PIPE_CAP) {
        for (const k of Object.keys(back.fluid)) {
          if (!(back.fluid[k] > 0)) continue;
          if (this.total() >= PIPE_CAP) break;
          if (!this.giveItem(k)) continue;
          back.takeItemOf(k);
        }
      }
      // 把缓冲转运给配对的出口端
      const mate = this.findMate();
      if (mate && this.total() > 0 && mate.total() < PIPE_CAP) {
        for (const k of Object.keys(this.fluid)) {
          if (!(this.fluid[k] > 0)) break;
          if (!(mate.fluid[k] > 0) && mate.total() > 0) continue; // 防混合
          mate.fluid[k] = (mate.fluid[k] || 0) + 1;
          this.fluid[k]--;
          if (this.fluid[k] <= 0) delete this.fluid[k];
          if (this.total() <= 0) break;
        }
      }
    } else if (this.isOutlet()) {
      // 出口端：把地下缓冲排向正前方管道
      const front = entAt(this.x + DX[this.dir], this.y + DY[this.dir]);
      if (front instanceof Pipe && this.total() > 0) {
        for (const k of Object.keys(this.fluid)) {
          if (!(this.fluid[k] > 0)) break;
          if (front.total() >= PIPE_CAP) break;
          if (front.giveItem(k)) {
            this.fluid[k]--;
            if (this.fluid[k] <= 0) delete this.fluid[k];
          }
        }
      }
    }
    for (const k of Object.keys(this.fluid)) if (!(this.fluid[k] > 0)) delete this.fluid[k];
  }
  giveItem(item) {
    if (FLUIDS.indexOf(item) < 0) return false;
    if (this.total() >= PIPE_CAP) return false;
    for (const k in this.fluid) if (this.fluid[k] > 0 && k !== item) return false;
    this.fluid[item] = (this.fluid[item] || 0) + 1;
    return true;
  }
  peekItem() { for (const k in this.fluid) if (this.fluid[k] > 0) return k; return null; }
  takeItem() { for (const k in this.fluid) if (this.fluid[k] > 0) return this.takeItemOf(k); return null; }
  countOf(item) { return this.fluid[item] || 0; }
  takeItemOf(item) {
    if ((this.fluid[item] || 0) > 0) { this.fluid[item]--; if (this.fluid[item] <= 0) delete this.fluid[item]; return item; }
    return null;
  }
  contents() {
    const list = [[this.type, 1]];
    for (const k in this.fluid) if (this.fluid[k] > 0) list.push([k, this.fluid[k]]);
    return list;
  }
  takeAll() {
    const rows = [];
    for (const k of Object.keys(this.fluid)) { rows.push([k, this.fluid[k]]); delete this.fluid[k]; }
    return rows;
  }
  serialize() { const s = super.serialize(); s.fluid = this.fluid; return s; }
  static restore(s) { const p = super.restore(s); p.fluid = s.fluid || {}; return p; }
}

// ===== 渲染 =====
function drawPipeGround(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  const inlet = e.isInlet(), outlet = e.isOutlet();
  const bodyCol = inlet ? '#4a3f36' : outlet ? '#5a4a3a' : '#443f3a';
  const accCol = inlet ? '#b08a6a' : outlet ? '#c9a87a' : '#8a7a6a';
  ctx.globalAlpha = alpha;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(dir * Math.PI / 2);
  ctx.fillStyle = bodyCol;
  rr(ctx, -13, -11, 26, 22, 5); ctx.fill();
  if (!inlet && !outlet) ctx.setLineDash([4, 3]);
  ctx.strokeStyle = accCol;
  ctx.lineWidth = 2;
  rr(ctx, -13, -11, 26, 22, 5); ctx.stroke();
  ctx.setLineDash([]);
  // 流体圆点
  ctx.strokeStyle = accCol;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-8, 0);
  ctx.lineTo(1, 0);
  ctx.stroke();
  ctx.fillStyle = accCol;
  tri(ctx, -1, -5, -1, 5, 7, 0);
  ctx.fill();
  const total = e.total ? e.total() : 0;
  if (total > 0) {
    const first = Object.keys(e.fluid).find(k => e.fluid[k] > 0);
    if (first && ITEMS[first]) {
      ctx.fillStyle = ITEMS[first].color;
      ctx.beginPath();
      ctx.arc(-3, 0, 3.5, 0, 7);
      ctx.fill();
    }
  }
  ctx.restore();
  const badge = inlet ? '入' : outlet ? '出' : '—';
  const bcol = inlet ? '#7a5a40' : outlet ? '#8a6a44' : '#5a504a';
  ctx.fillStyle = bcol;
  rr(ctx, px + 2, py + 2, 15, 13, 3);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 9px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(badge, px + 9.5, py + 9);
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function pipeGroundPanelHtml(e) {
  const agg = {};
  for (const k in e.fluid) if (e.fluid[k] > 0) agg[k] = e.fluid[k];
  let h = row('流体', Object.keys(agg).length ? countStr(agg) : '<span class="dim">空</span>', 'contents');
  h += row('容量', e.total() + ' / ' + PIPE_CAP, 'cap');
  if (Object.keys(agg).length) h += '<button data-action="takeout" id="btn-pgt-takeout">取出全部 (' + e.total() + ')</button>';
  h += '<div class="status"></div>';
  h += '<div class="dim">地下管道：同向摆两座（最远 ' + PIPE_GROUND_MAX + ' 格）自动配对，从地下穿行流体，可跨过传送带/管道。入口端从背侧管道吸入，出口端排向正前方管道。R 旋转方向。</div>';
  return h;
}
function pipeGroundPanelLive(e, api) {
  const agg = {};
  for (const k in e.fluid) if (e.fluid[k] > 0) agg[k] = e.fluid[k];
  api.set('contents', Object.keys(agg).length ? countStr(agg) : dimSpan('空'));
  api.set('cap', e.total() + ' / ' + PIPE_CAP);
  api.toggle('#btn-pgt-takeout', e.total() > 0, '取出全部 (' + e.total() + ')');
  if (!e.findMate() && !e.findBackMate()) api.status('已暂停：未配对（同向 ' + PIPE_GROUND_MAX + ' 格内无另一座地下管道）', 'warn');
  else if (e.isInlet()) api.status('地下入口：从背侧管道吸入流体', e.total() > 0 ? 'ok' : 'ok');
  else if (e.isOutlet()) api.status('地下出口：向前方管道排出流体', 'ok');
  else api.status('待机', 'ok');
}
function pipeGroundTip(e) {
  const agg = {};
  for (const k in e.fluid) if (e.fluid[k] > 0) agg[k] = e.fluid[k];
  if (e.isInlet()) return '地下入口' + (Object.keys(agg).length ? '（缓冲 ' + Object.keys(agg).map(k => ITEMS[k].name + '×' + agg[k]).join('、') + '）' : '');
  if (e.isOutlet()) return '地下出口';
  return '未配对（同向 ' + PIPE_GROUND_MAX + ' 格内无另一座）';
}

// ===== 注册 =====
ENT_CLASSES['pipe-to-ground'] = PipeToGround;
DEVICE_RENDER['pipe-to-ground'] = drawPipeGround;
DEVICE_STATUS['pipe-to-ground'] = e => (e.findMate() || e.findBackMate()) ? (e.total() > 0 ? 'g' : 'r') : 'y';
DEVICE_PANEL['pipe-to-ground'] = { html: pipeGroundPanelHtml, live: pipeGroundPanelLive, tip: pipeGroundTip };
DEVICE_DIR_ROTATE['pipe-to-ground'] = true;
