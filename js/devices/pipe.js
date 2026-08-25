'use strict';

// ===== 管道：输送流体，相邻互连均压 =====
class Pipe extends Entity {
  constructor(type, x, y) {
    super('pipe', x, y);
    this.fluid = {};
  }
  total() {
    let s = 0;
    for (const k in this.fluid) s += this.fluid[k];
    return s;
  }
  update(dt) {
    // 惰性调度（P0 优化）：流体扩散是抽象均衡而非实时速率，
    // 按帧节流（约 20 次/秒）即可，避免数千管道每帧都做四向邻居扫描。
    // 空管（无流体）直接跳过。
    if (!this.fluid) return;
    this._balT = (this._balT || 0) - dt;
    if (this._balT > 0) return;
    this._balT = 0.05;
    for (const k of Object.keys(this.fluid)) {
      if (!(this.fluid[k] > 0)) continue;
      for (const [dx, dy] of PIPE_DIRS) {
        if (!(this.fluid[k] > 0)) break;
        const t = entAt(this.x + dx, this.y + dy);
        if (!t || t === this) continue;
        if (t instanceof Pipe) {
          // 防止流体混合：仅当目标管为空或只含同种流体 k 时，才允许流动
          const tOther = t.total() - (t.fluid[k] || 0);
          const theirs = t.fluid[k] || 0;
          if (tOther === 0 && t.total() < PIPE_CAP && this.fluid[k] > theirs) {
            // 自动平衡：把两管之间的差量匀一半过去，让整条管网的流体快速趋平，
            // 而不像原来每帧只推 1 单位（长距离管道远端要很久才见液）。
            const diff = this.fluid[k] - theirs;
            const move = Math.max(1, Math.ceil(diff / 2));
            this.fluid[k] -= move;
            t.fluid[k] = theirs + move;
          }
        } else if (t instanceof StorageTank) {
          // 管道把流体灌入储液罐（罐空或同种流体且未满时才能灌入）
          // 仅允许在对角接口格接入（另一对对角为空不可接管）
          if (t.isPortCell && !t.isPortCell(this.x, this.y)) continue;
          if (t.giveItem(k)) this.fluid[k]--;
        } else if ((t instanceof Refinery) || (t instanceof ChemicalPlant) ||
                    (t instanceof Assembler && t.acceptsFluid(k))) {
          // 仅允许在设备的输入接口格子上注入（一格一接口），机械臂等非管道来源不受限
          if (t.isFluidInlet && !t.isFluidInlet(this.x, this.y)) continue;
          if (t.giveItem(k)) this.fluid[k]--;
        }
        // 锅炉/蒸汽机不在此直推：水量由锅炉两端水口平衡，蒸汽由蒸汽机端汽口自取
      }
    }
    for (const k of Object.keys(this.fluid)) if (!(this.fluid[k] > 0)) delete this.fluid[k];
  }
  giveItem(item) {
    if (FLUIDS.indexOf(item) < 0) return false;
    if (this.total() >= PIPE_CAP) return false;
    // 防止流体混合：管道中已有别的流体时，拒绝加入新流体
    for (const k in this.fluid) if (this.fluid[k] > 0 && k !== item) return false;
    this.fluid[item] = (this.fluid[item] || 0) + 1;
    return true;
  }
  peekItem() {
    for (const k in this.fluid) if (this.fluid[k] > 0) return k;
    return null;
  }
  takeItem() {
    for (const k in this.fluid) if (this.fluid[k] > 0) return this.takeItemOf(k);
    return null;
  }
  takeOutput() { return this.takeItem(); }
  countOf(item) { return this.fluid[item] || 0; }
  takeItemOf(item) {
    if ((this.fluid[item] || 0) > 0) {
      this.fluid[item]--;
      if (this.fluid[item] <= 0) delete this.fluid[item];
      return item;
    }
    return null;
  }
  contents() {
    const list = [[this.type, 1]];
    for (const k in this.fluid) if (this.fluid[k] > 0) list.push([k, this.fluid[k]]);
    return list;
  }
  // 面板"取出全部"：排空管内流体
  takeAll() {
    const rows = [];
    for (const k of Object.keys(this.fluid)) { rows.push([k, this.fluid[k]]); delete this.fluid[k]; }
    return rows;
  }
  serialize() { const s = super.serialize(); s.fluid = this.fluid; return s; }
  static restore(s) { const p = super.restore(s); p.fluid = s.fluid || {}; return p; }
}

// ===== 渲染 =====
function drawPipe(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#7d7264';
  ctx.lineWidth = 8;
  for (const [dx, dy] of PIPE_DIRS) {
    const nb = entAt(gx + dx, gy + dy);
    if (nb instanceof Pipe || nb instanceof Refinery || nb instanceof Pumpjack ||
        nb instanceof Boiler || nb instanceof Pump || nb instanceof SteamEngine ||
        nb instanceof ChemicalPlant || nb instanceof Assembler ||
        (nb instanceof StorageTank && (!nb.isPortCell || nb.isPortCell(gx, gy))) ||
        nb instanceof PipeToGround || nb instanceof FluidPump) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + dx * TILE / 2, cy + dy * TILE / 2);
      ctx.stroke();
    }
  }
  ctx.fillStyle = '#8d8272';
  ctx.beginPath(); ctx.arc(cx, cy, 8.5, 0, 7); ctx.fill();
  ctx.strokeStyle = '#55503f';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, 8.5, 0, 7); ctx.stroke();
  const total = e.total ? e.total() : 0;
  if (total > 0) {
    const first = Object.keys(e.fluid).find(k => e.fluid[k] > 0);
    if (first && ITEMS[first]) {
      ctx.fillStyle = ITEMS[first].color;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(3, 6.5 * Math.min(1, total / PIPE_CAP)), 0, 7);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function pipePanelHtml(e) {
  const agg = {};
  for (const k in e.fluid) if (e.fluid[k] > 0) agg[k] = e.fluid[k];
  let h = row('流体', Object.keys(agg).length ? countStr(agg) : '<span class="dim">空</span>', 'contents');
  h += row('容量', '', 'cap');
  if (Object.keys(agg).length) h += '<button data-action="takeout" id="btn-pipe-takeout">取出全部 (' + e.total() + ')</button>';
  h += '<div class="status"></div>';
  h += '<div class="dim">管道与相邻管道自动互连均压，并把原油送入邻接炼油厂；机械臂可从管道抓取流体。</div>';
  return h;
}
function pipePanelLive(e, api) {
  const agg = {};
  for (const k in e.fluid) if (e.fluid[k] > 0) agg[k] = e.fluid[k];
  api.set('contents', Object.keys(agg).length ? countStr(agg) : dimSpan('空'));
  api.set('cap', e.total() + ' / ' + PIPE_CAP);
  api.toggle('#btn-pipe-takeout', e.total() > 0, '取出全部 (' + e.total() + ')');
  if (e.total() >= PIPE_CAP) api.status('已暂停：管道已满，等待下游消耗', 'warn');
  else if (e.total() > 0) api.status('输送中：' + Object.keys(agg).map(k => ITEMS[k].name + '×' + agg[k]).join('、'), 'ok');
  else api.status('空管：等待流体进入', 'ok');
}
function pipeTip(e) {
  const agg = {};
  for (const k in e.fluid) if (e.fluid[k] > 0) agg[k] = e.fluid[k];
  return Object.keys(agg).length
    ? ('流体 ' + Object.keys(agg).map(k => ITEMS[k].name + '×' + agg[k]).join('、') + '，按F拿取')
    : '空管';
}

// ===== 注册 =====
ENT_CLASSES['pipe'] = Pipe;
DEVICE_RENDER['pipe'] = drawPipe;
DEVICE_STATUS['pipe'] = e => e.total() > 0 ? 'g' : 'r';
DEVICE_PANEL['pipe'] = { html: pipePanelHtml, live: pipePanelLive, tip: pipeTip };
