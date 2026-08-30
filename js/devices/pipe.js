'use strict';

// ===== 统一管道判定：设备 ↔ 管道 / 地下管道 的流体接口 =====
// 历史原因：设备代码大量用 `instanceof Pipe` 判定相邻流体接口，导致只认普通管道、
// 不认地下管道（PipeToGround）。地下管道只有「管口」（this.dir 反向侧）能接设备与管道
// （背向是地下管段侧，不接任何管道）。因此设备侧判定一律走本函数：
//   · 普通管道 / 创造管道 / 虚空管道（Pipe 子类）→ 任意方向可接；
//   · 地下管道 → 仅当其「管口」（dir 反向格）正好落在此世界格 (gx,gy) 时视为可接。
// 这样设备可以把地下管道当作普通管道一样进/出流体，且不破坏地下管道自身的配对规则。
// 判断实体 n 相对设备 dev 位于哪一侧（世界方向 0东 1南 2西 3北），
// 用于给地下管道判定“管口朝向接入者”时反推接入者所在格。
function sideFromEntity(dev, n) {
  if (n.y < dev.y) return 3;                 // 北
  if (n.y >= dev.y + dev.h) return 1;        // 南
  if (n.x >= dev.x + dev.w) return 0;        // 东
  return 2;                                  // 西
}
// 判定 (gx,gy) 格上是否有可互通流体的管道/地下管道。
// side：该外部格相对接入者（设备/管道）所在侧的“世界方向”——接入者站在 side 的反方向，
// 因此接入者所在格 = (gx - DX[side], gy - DY[side])。
// 普通管道（含创造/虚空管道，Pipe 子类）任意方向可接；地下管道仅当其“管口”
// （this.dir 反向侧）正好对着接入者所在格时才视为可接（背向是地下管段侧，不接任何管道）。
function pipeConnAt(gx, gy, side) {
  const t = entAt(gx, gy);
  if (!t) return null;
  if (t instanceof Pipe) return t;
  if (typeof PipeToGround !== 'undefined' && t instanceof PipeToGround) {
    const ix = gx - DX[side], iy = gy - DY[side];
    return (t.x - DX[t.dir] === ix && t.y - DY[t.dir] === iy) ? t : null;
  }
  return null;
}
// ===== 管道：输送流体，相邻互连均压 =====
class Pipe extends Entity {
  constructor(type, x, y) {
    super(type, x, y);
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
    // 官方基础管道流速 = 200 流体/秒/节（PIPE_FLOW，Factorio Wiki 引擎常量）。
    // 每节流周期（0.05s）单节管道最多向下游传输 200×0.05 = 10 单位，
    // 用 budget 限制「管道→管道」的均压推送，模拟官方压力流动而非瞬时均平。
    let budget = PIPE_FLOW * 0.05;
    for (const k of Object.keys(this.fluid)) {
      if (!(this.fluid[k] > 0)) continue;
      if (budget <= 0) break;
      for (const [dx, dy] of PIPE_DIRS) {
        if (!(this.fluid[k] > 0)) break;
        if (budget <= 0) break;
        const t = entAt(this.x + dx, this.y + dy);
        if (!t || t === this) continue;
        // 普通管道 ↔ 普通管道 / 地下管道（管口朝本管）均压互通
        // side：邻居 (dx,dy) 相对本管的方向（本管在反方向）
        const sideNb = (dx === 1 ? 0 : dx === -1 ? 2 : (dy === 1 ? 1 : 3));
        if (pipeConnAt(this.x + dx, this.y + dy, sideNb)) {
          // 防止流体混合：仅当目标管为空或只含同种流体 k 时，才允许流动
          const tOther = t.total() - (t.fluid[k] || 0);
          const theirs = t.fluid[k] || 0;
          if (tOther === 0 && t.total() < PIPE_CAP && this.fluid[k] > theirs) {
            // 自动平衡：把两管差量匀一部分过去；单节每周期最多推 budget（=官方 200/s），
            // 不再每帧把差量对半全推（否则长距离管道远端瞬间见液，远超官方流速）。
            const diff = this.fluid[k] - theirs;
            let move = Math.max(1, Math.ceil(diff / 2));
            if (move > budget) move = budget;
            this.fluid[k] -= move;
            t.fluid[k] = theirs + move;
            budget -= move;
          }
        } else if (t instanceof StorageTank) {
          // 管道把流体灌入储液罐（罐空或同种流体且未满时才能灌入）
          // 仅允许在对角接口格接入（另一对对角为空不可接管）
          if (t.isPortCell && !t.isPortCell(this.x, this.y)) continue;
          // 仅当管道液位比例高于罐时才回赠：低压管道不应向高压罐倒灌
          // （对齐官方压力均分——流体从高压流向低压直到全网同比例）。
          // 若无条件回赠，管道会被持续压在低液位，罐里的流体难以向外流。
          const pipeRatio = this.fluid[k] / PIPE_CAP;
          const tankRatio = (t.fluid[k] || 0) / STORAGE_TANK_CAP;
          if (pipeRatio <= tankRatio) continue;
          if (t.giveItem(k)) this.fluid[k]--;
        } else if ((t instanceof Refinery) || (t instanceof ChemicalPlant) ||
                    (t instanceof Assembler && t.acceptsFluid(k)) ||
                    (t instanceof ElectricDrill)) {
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

// ===== 直接清空互通管网 =====
// "直接清空"：不回收物品，直接把与当前管道/地下管道互通（管道相互连通、地下配对互连、
// 以及邻接的储液罐/设备接口）的所有实体中的液体抹除。设备（化工/炼油/装配/采矿机）
// 只清理其流体缓冲，不向外扩散；管道/地下管道/储液罐作为连接集合继续扩散。
const FLUID_NET_MEMBERS = true;
function clearEntityFluid(e) {
  let n = 0;
  if (e.fluid && typeof e.fluid === 'object') {
    for (const k in e.fluid) { n += e.fluid[k]; delete e.fluid[k]; }
  }
  // 依赖流体配方/缓冲的设备：化工/炼油/装配的输入输出流体、采矿机的硫酸缓冲
  for (const map of [e.inp, e.outp]) {
    if (!map || typeof map !== 'object') continue;
    for (const k of Object.keys(map)) {
      if (FLUIDS.indexOf(k) >= 0) { n += map[k]; delete map[k]; }
    }
  }
  if (typeof e.acid === 'number') { n += e.acid; e.acid = 0; }
  return n;
}
function drainFluidNetwork(start) {
  const visited = new Set();
  const queue = [start];
  visited.add(start);
  let cleared = 0;
  while (queue.length) {
    const cur = queue.shift();
    cleared += clearEntityFluid(cur);
    // 地下配对端视为直接连通
    if (cur instanceof PipeToGround) {
      const mate = cur.findMate();
      if (mate && !visited.has(mate)) { visited.add(mate); queue.push(mate); }
    }
    // 只有管道/地下管道/储液罐扩展连通集合；设备仅清空其自身流体，不继续扩散
    const expand = (cur instanceof Pipe) || (cur instanceof PipeToGround) || (cur instanceof StorageTank);
    if (!expand) continue;
    for (let i = 0; i < 4; i++) {
      const t = entAt(cur.x + DX[i], cur.y + DY[i]);
      if (!t || visited.has(t)) continue;
      const connected = t instanceof Pipe || t instanceof PipeToGround || t instanceof StorageTank ||
                         t instanceof Refinery || t instanceof ChemicalPlant ||
                         (t instanceof Assembler && t.isFluidInlet && t.isFluidInlet(cur.x, cur.y)) ||
                         (t instanceof ElectricDrill && (!t.isFluidInlet || t.isFluidInlet(cur.x, cur.y)));
      if (connected) { visited.add(t); queue.push(t); }
    }
  }
  return cleared;
}

// ===== 渲染 =====
// 1×1 黄铜十字接头：中心金属接头 + 四向连接管段 + 流体显示
// 视觉分区：
//   ① 4 向连接管段（双层：深色外管壁 + 亮色内管）  ② 中央 4 通接头（双层圆角矩形）
//   ③ 接头高光  ④ 中央流体圆点（按容量比例）
function drawPipe(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';

  // ① 4 向连接管段（按连接方向画到瓦片边）
  //    复用旧 connect 判定逻辑：找出所有"应在管口侧显式延伸"的邻居
  //    然后分两层画：外层深色（管壁）+ 内层亮色（管内）。
  //    连接段用平头（butt）延伸到瓦片边：相邻管道/地下管道口的管段在共享边严丝合缝，
  //    不再用圆头（round）让两端管帽凸进邻格、在接缝处双重叠加。
  const conns = [];
  for (const [dx, dy] of PIPE_DIRS) {
    const nb = entAt(gx + dx, gy + dy);
    if (nb instanceof PipeToGround) {
      const ok = DX[nb.dir] === dx && DY[nb.dir] === dy;
      if (!ok) continue;
    }
    let connect = nb instanceof Pipe ||
        (nb instanceof Refinery && (!nb.isFluidPort || nb.isFluidPort(gx, gy))) ||
        (nb instanceof Pumpjack && (!nb.isFluidPort || nb.isFluidPort(gx, gy))) ||
        (nb instanceof ElectricDrill && !(nb instanceof Pumpjack) && (!nb.isFluidInlet || nb.isFluidInlet(gx, gy))) ||
        nb instanceof Boiler || nb instanceof Pump || nb instanceof SteamEngine ||
        (nb instanceof ChemicalPlant && (!nb.isFluidPort || nb.isFluidPort(gx, gy))) ||
        (nb instanceof Assembler && (!nb.isFluidInlet || nb.isFluidInlet(gx, gy))) || nb instanceof HeatExchanger ||
        (nb instanceof StorageTank && (!nb.isPortCell || nb.isPortCell(gx, gy))) ||
        nb instanceof PipeToGround || nb instanceof FluidPump ||
        (nb && (nb.type === 'one-way-valve' || nb.type === 'overflow-valve' || nb.type === 'top-up-valve'));
    // 抽水机只在短边（原点格朝 dir 一侧）出/接水：只有该侧相邻格的管道才画连接段，
    // 长边两侧的管道不显示连接（与 tryOutput 的唯一出水格一致，避免误读为"长边也有出口"）
    if (connect && nb instanceof Pump) {
      const ox = nb.dir === 0 ? nb.x + nb.w : (nb.dir === 2 ? nb.x - 1 : nb.x);
      const oy = nb.dir === 1 ? nb.y + nb.h : (nb.dir === 3 ? nb.y - 1 : nb.y);
      connect = (gx === ox && gy === oy);
    }
    if (connect) conns.push([dx, dy]);
  }
  // 连接段平头（butt）：两端齐平延伸到瓦片边，与相邻管段在共享边合拢
  ctx.lineCap = 'butt';
  // 外层管壁（深色）
  ctx.strokeStyle = '#4a4234';
  ctx.lineWidth = 9;
  for (const [dx, dy] of conns) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + dx * (TILE / 2), cy + dy * (TILE / 2));
    ctx.stroke();
  }
  // 内层管体（亮色黄铜）
  ctx.strokeStyle = '#8d8272';
  ctx.lineWidth = 6.5;
  for (const [dx, dy] of conns) {
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + dx * (TILE / 2), cy + dy * (TILE / 2));
    ctx.stroke();
  }
  // 管段高光（上沿）
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255, 235, 200, 0.30)';
  ctx.lineWidth = 1.2;
  for (const [dx, dy] of conns) {
    ctx.beginPath();
    const ox = dx === 0 ? 0 : (dx > 0 ? 0.6 : -0.6);
    const oy = dy === 0 ? 0 : (dy > 0 ? 0.6 : -0.6);
    ctx.moveTo(cx + ox, cy + oy);
    ctx.lineTo(cx + dx * (TILE / 2) + ox, cy + dy * (TILE / 2) + oy);
    ctx.stroke();
  }

  // ② 中央 4 通接头（双层圆角矩形 — 模拟十字管件）
  // 外层（深色金属边）
  ctx.fillStyle = '#4a4234';
  rr(ctx, cx - 9.5, cy - 9.5, 19, 19, 3); ctx.fill();
  // 内层（亮色黄铜面）
  ctx.fillStyle = '#8d8272';
  rr(ctx, cx - 7.5, cy - 7.5, 15, 15, 2.5); ctx.fill();
  // 接头描边
  ctx.strokeStyle = '#3a3228';
  ctx.lineWidth = 0.6;
  rr(ctx, cx - 7.5, cy - 7.5, 15, 15, 2.5); ctx.stroke();

  // ③ 接头 4 角小螺栓（强化"工业接头"质感）
  const drawBolt = (bx, by) => {
    ctx.fillStyle = '#3a3228';
    ctx.beginPath(); ctx.arc(bx, by, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,235,200,0.35)';
    ctx.beginPath(); ctx.arc(bx - 0.2, by - 0.2, 0.5, 0, Math.PI * 2); ctx.fill();
  };
  drawBolt(cx - 5.5, cy - 5.5);
  drawBolt(cx + 5.5, cy - 5.5);
  drawBolt(cx - 5.5, cy + 5.5);
  drawBolt(cx + 5.5, cy + 5.5);

  // ③b 接头顶面高光
  ctx.fillStyle = 'rgba(255, 235, 200, 0.30)';
  ctx.fillRect(cx - 6, cy - 6, 12, 0.8);

  // ④ 中央流体圆点（按容量比例）
  const total = e.total ? e.total() : 0;
  if (total > 0) {
    const first = Object.keys(e.fluid).find(k => e.fluid[k] > 0);
    if (first && ITEMS[first]) {
      const r = Math.max(2.5, 5.5 * Math.min(1, total / PIPE_CAP));
      // 流体深色边
      ctx.fillStyle = _pipeDarken(ITEMS[first].color, 0.35);
      ctx.beginPath();
      ctx.arc(cx, cy, r + 0.6, 0, Math.PI * 2);
      ctx.fill();
      // 流体本色
      ctx.fillStyle = ITEMS[first].color;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      // 流体高光
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.arc(cx - r * 0.3, cy - r * 0.3, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
function _pipeDarken(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.floor(((n >> 16) & 255) * (1 - t)));
  const g = Math.max(0, Math.floor(((n >> 8) & 255) * (1 - t)));
  const b = Math.max(0, Math.floor((n & 255) * (1 - t)));
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

// ===== 面板 =====
function pipePanelHtml(e) {
  const agg = {};
  for (const k in e.fluid) if (e.fluid[k] > 0) agg[k] = e.fluid[k];
  let h = row('流体', Object.keys(agg).length ? '<div class="asm3-inp-row">' + itemSlotsHtml(agg, { action: 'display' }) + '</div>' : '<span class="dim">空</span>', 'contents');
  h += row('容量', '', 'cap');
  if (Object.keys(agg).length) h += '<button data-action="drain" id="btn-pipe-takeout">直接清空</button>';
  h += '<div class="dim">管道与相邻管道自动互连均压，并把原油送入邻接炼油厂；机械臂可从管道抓取流体。</div>';
  return h;
}
function pipePanelLive(e, api) {
  const agg = {};
  for (const k in e.fluid) if (e.fluid[k] > 0) agg[k] = e.fluid[k];
  api.set('contents', Object.keys(agg).length ? '<div class="asm3-inp-row">' + itemSlotsHtml(agg, { action: 'display' }) + '</div>' : dimSpan('空'));
  api.set('cap', e.total() + ' / ' + PIPE_CAP);
  api.toggle('#btn-pipe-takeout', e.total() > 0, '直接清空');
  if (e.total() >= PIPE_CAP) api.status('已暂停：管道已满，等待下游消耗', 'warn');
  else if (e.total() > 0) api.status('输送中：' + Object.keys(agg).map(k => ITEMS[k].name + '×' + agg[k]).join('、'), 'ok');
  else api.status('空管：等待流体进入', 'ok');
}
function pipeTip(e) {
  const agg = {};
  for (const k in e.fluid) if (e.fluid[k] > 0) agg[k] = e.fluid[k];
  const allowed = FLUIDS.map(k => ITEMS[k].name).join('、');
  const cur = Object.keys(agg).length
    ? '当前含 ' + Object.keys(agg).map(k => ITEMS[k].name + '×' + agg[k]).join('、') + '，按F拿取'
    : '空管';
  return '可输送流体：' + allowed + '。' + cur;
}

// ===== 注册 =====
ENT_CLASSES['pipe'] = Pipe;
DEVICE_RENDER['pipe'] = drawPipe;
DEVICE_DIR_ROTATE['pipe'] = true; // 支持旋转
DEVICE_STATUS['pipe'] = e => e.total() > 0 ? 'g' : 'r';
DEVICE_PANEL['pipe'] = { html: pipePanelHtml, live: pipePanelLive, tip: pipeTip };
