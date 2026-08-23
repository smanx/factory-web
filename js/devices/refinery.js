'use strict';

// ===== 炼油厂：原油 → 重油/轻油/石油气 =====
class Refinery extends Entity {
  constructor(type, x, y) {
    super('refinery', x, y);
    this.inp = {};   // { 'crude-oil': n }
    this.outp = {};  // { 'heavy-oil': n, 'light-oil': n, 'petroleum-gas': n }
    this.prog = 0;
    this.working = false;
  }
  outTotal() {
    let s = 0;
    for (const k in this.outp) s += this.outp[k];
    return s;
  }
  portInput() {
    // 输入口位于背面（北 side 3，旋转后跟随）：只从背面的两个输入格子吸入原油
    const inSide = (3 + (this.dir | 0)) % 4;   // 输入基准方向：北
    for (const cell of REFINERY_INPUT_CELLS) {
      const n = neighborOnSideCell(this, inSide, cell);
      if (!(n instanceof Pipe)) continue;
      if (!(n.fluid['crude-oil'] > 0)) continue;
      if ((this.inp['crude-oil'] || 0) < 50 && n.takeItemOf('crude-oil')) this.inp['crude-oil'] = (this.inp['crude-oil'] || 0) + 1;
    }
  }
  update(dt) {
    this.working = false;
    this.portInput();
    if ((this.inp['crude-oil'] || 0) < 2) { this.prog = 0; return; }
    if (this.outTotal() >= 48) return;
    if (G.power.sat <= 0) return;
    this.working = true;
    this.prog += dt * oilMult() * (G.power.sat < 1 ? G.power.sat : 1) / 4;
    if (this.prog >= 1) {
      this.prog -= 1;
      this.inp['crude-oil'] -= 2;
      if (this.inp['crude-oil'] <= 0) delete this.inp['crude-oil'];
      for (const k of ['heavy-oil', 'light-oil', 'petroleum-gas']) this.outp[k] = (this.outp[k] || 0) + 1;
    }
    this.tryOutput();
  }
  tryOutput() {
    // 输出口固定位于正面（南侧 side 1，旋转后跟随）；只从正面的三个输出格子排入管道/容器
    const outSide = (1 + (this.dir | 0)) % 4;  // 输出基准方向：南
    for (const k of Object.keys(this.outp)) {
      if (!(this.outp[k] > 0)) continue;
      for (const cell of REFINERY_OUTPUT_CELLS) {
        const t = neighborOnSideCell(this, outSide, cell);
        if (!t || t === this) continue;
        if ((t instanceof Pipe || t instanceof Chest) && !(t instanceof Splitter) && t.giveItem(k)) {
          this.outp[k]--;
          if (this.outp[k] <= 0) delete this.outp[k];
          break;
        }
      }
    }
  }
  isFluidInlet(x, y) {
    // 仅背面的输入格子可被管道直接注入原油
    const inSide = (3 + (this.dir | 0)) % 4;
    for (const cell of REFINERY_INPUT_CELLS) {
      const p = neighborOnSideCell(this, inSide, cell);
      if (p && p.x === x && p.y === y) return true;
    }
    return false;
  }
  giveItem(item) {
    if (item === 'crude-oil' && (this.inp['crude-oil'] || 0) < 50) { this.inp['crude-oil'] = (this.inp['crude-oil'] || 0) + 1; return true; }
    return false;
  }
  peekItem() {
    for (const k in this.outp) if (this.outp[k] > 0) return k;
    return null;
  }
  takeItem() {
    for (const k in this.outp) if (this.outp[k] > 0) return this.takeItemOf(k);
    return null;
  }
  countOf(item) { return this.outp[item] || 0; }
  takeItemOf(item) {
    if ((this.outp[item] || 0) > 0) { this.outp[item]--; if (this.outp[item] <= 0) delete this.outp[item]; return item; }
    return null;
  }
  powerDemand() { return (this.inp['crude-oil'] || 0) >= 2 ? POWER_USE['refinery'] : 0; }
  contents() {
    const list = [[this.type, 1]];
    for (const k in this.inp) list.push([k, this.inp[k]]);
    for (const k in this.outp) list.push([k, this.outp[k]]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.inp = this.inp; s.outp = this.outp; s.prog = this.prog;
    return s;
  }
  static restore(s) {
    const r = super.restore(s);
    r.inp = s.inp || {}; r.outp = s.outp || {}; r.prog = s.prog || 0;
    return r;
  }
}

// ===== 渲染 =====
// 炼油厂流体接口：每个接口对齐一个格子（一格一接口）
// 背面(北，旋转跟随)2个输入口落在沿边第1、3格；正面(南)3个输出口落在沿边第1、2、3格
const REFINERY_INPUT_CELLS = [1, 3];     // 背面输入口所在格（沿边 0基）
const REFINERY_OUTPUT_CELLS = [1, 2, 3]; // 正面输出口所在格（沿边 0基）
const REFINERY_PORTS = [
  { side: 3, color: PORT_INPUT, arrow: true, off: -1, cells: [1] },   // 北·输入格1
  { side: 3, color: PORT_INPUT, arrow: true, off: 1, cells: [3] },    // 北·输入格3
  { side: 1, color: PORT_OUTPUT, off: 1, cells: [1] },                // 南·输出格1
  { side: 1, color: PORT_OUTPUT, off: 0, cells: [2] },                // 南·输出格2
  { side: 1, color: PORT_OUTPUT, off: -1, cells: [3] }                // 南·输出格3
];
function drawRefinery(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w;
  const sh = TILE * e.h;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#8f5a34';
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 10); ctx.fill();
  ctx.strokeStyle = '#5c3820';
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 10); ctx.stroke();
  ctx.fillStyle = '#3b3230';
  rr(ctx, px + s * 0.12, py + 10, 13, s * 0.22, 3); ctx.fill();
  rr(ctx, px + s * 0.28, py + 10, 13, s * 0.22, 3); ctx.fill();
  if (e.working) {
    const fl = 0.5 + Math.sin(G.time * 10 + px) * 0.25;
    ctx.fillStyle = 'rgba(255,160,60,' + (fl * 0.45).toFixed(2) + ')';
    rr(ctx, px + 12, py + s * 0.42, s - 24, s * 0.24, 6); ctx.fill();
  }
  let bx = px + 14;
  for (const [id] of [['heavy-oil'], ['light-oil'], ['petroleum-gas']]) {
    const n = e.outp[id] || 0;
    ctx.fillStyle = '#20242b';
    rr(ctx, bx, py + s - 18, 18, 7, 2); ctx.fill();
    if (n > 0) {
      ctx.fillStyle = ITEMS[id].color;
      rr(ctx, bx, py + s - 18, 18 * Math.min(1, n / 16), 7, 2); ctx.fill();
    }
    bx += 24;
  }
  if (!e.working && (e.inp['crude-oil'] || 0) < 2) {
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('缺原油', px + s / 2, py + s * 0.58);
  }
  // ===== 流体出入口标注（对齐《异星工厂》：入口绿、出口橙红，位置随旋转） =====
  // 布局：每个接口对齐到对应的格子（一格一接口）：背面(上方=北)2个输入口落在格1/格3，正面(下方=南)3个输出口落在格1/格2/格3
  drawRotatablePorts(ctx, e, px, py, s, REFINERY_PORTS);
  const d = e.dir | 0;
  // 接口用途标签默认隐藏，按住 Alt 键显示（对齐《异星工厂》核心交互）
  if (portLabelVisible()) {
    drawPortLabel(ctx, px, py, s, (3 + d) % 4, '原油输入', '#7fd87f');
    drawPortLabel(ctx, px, py, s, (1 + d) % 4, '石油气/轻油/重油输出', '#f0b072');
  }
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function refineryPanelHtml(e) {
  let h = row('原油', (e.inp['crude-oil'] || 0) > 0 ? chip('crude-oil', e.inp['crude-oil']) : '<span class="dim">空</span>', 'input');
  if (invCount('crude-oil') > 0)
    h += '<button data-action="feed" data-id="crude-oil">放入原油 ×' + Math.min(invCount('crude-oil'), 50 - (e.inp['crude-oil'] || 0)) + '</button>';
  h += row('产物', Object.keys(e.outp).length ? countStr(e.outp) : '<span class="dim">空</span>', 'output');
  h += '<button data-action="takeout" id="btn-takeout" style="display:none"></button>';
  h += barHtml(0);
  h += '<div class="status"></div>';
  h += '<div class="dim">配方：原油×2 → 重油+轻油+石油气 各1（吃电力）。接口对齐格子：背面（上方）2个输入口分别在左数第2、4格，正面（下方）3个输出口分别在左数第2、3、4格，一格对应一个接口；旋转只改朝向，接口相对位置固定。用管道把原油送进背面输入口，或机械臂直接喂入。</div>';
  return h;
}
function refineryPanelLive(e, api) {
  api.set('input', (e.inp['crude-oil'] || 0) > 0 ? chip('crude-oil', e.inp['crude-oil']) : dimSpan('空'));
  api.set('output', Object.keys(e.outp).length ? countStr(e.outp) : dimSpan('空'));
  const n = Object.values(e.outp).reduce((a, b) => a + b, 0);
  api.toggle('#btn-takeout', n > 0, '取回全部产物 (' + n + ')');
  api.prog(e.prog * 100);
  if (e.working) api.status('精炼中', 'ok');
  else if ((e.inp['crude-oil'] || 0) < 2) api.status('已暂停：等待原油（需要 2 原油）', 'warn');
  else if (G.power.sat <= 0) api.status('已暂停：缺电', 'bad');
  else api.status('已暂停：待机', 'warn');
}
function refineryTip(e) {
  return e.working ? '精炼中' : ((e.inp['crude-oil'] || 0) < 2 ? '等待原油' : (G.power.sat <= 0 ? '缺电' : '待机'));
}

// ===== 注册 =====
ENT_CLASSES['refinery'] = Refinery;
DEVICE_RENDER['refinery'] = drawRefinery;
DEVICE_STATUS['refinery'] = e => e.working ? 'g' : ((e.inp['crude-oil'] || 0) >= 2 ? 'y' : 'r');
DEVICE_PANEL['refinery'] = { html: refineryPanelHtml, live: refineryPanelLive, tip: refineryTip };
// 炼油厂四边均布流体口、本体对称，旋转仅记录朝向；选中/悬停后按 R 可直接旋转
DEVICE_DIR_ROTATE['refinery'] = true;
