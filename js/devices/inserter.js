'use strict';

// ===== 机械臂族：普通 / 长臂 / 过滤 / 堆叠 =====
function angNorm(a) {
  return ((a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}
function approachAng(a, t, step) {
  const d = angNorm(t - a);
  if (Math.abs(d) < 1e-9) return t;
  const m = Math.min(Math.abs(d), step);
  return a + Math.sign(d) * m;
}
class Inserter extends Entity {
  constructor(type, x, y) {
    super(type || 'inserter', x, y);
    this.reach = 1;      // 触及距离（格），长臂子类改为 2
    this.holding = null;
    this.holdingCount = 0;
    this.stackMax = 1;   // 堆叠臂改为 3
    this.filter = null;  // 过滤臂：只抓该物品
    this.blocked = false;
    this.armAng = undefined;
  }
  // 单次抓取容量（对齐《异星工厂》：堆叠臂随「机械臂容量」无限科技提升抓取数量）
  capacity() {
    let cap = this.stackMax || 1;
    // 机械臂容量（无限科技）：每研究一次，堆叠臂单次抓取 +1（普通臂一次仍 1 个）
    if (this.stackMax > 1 && G.techProg['inserter-capacity']) cap += G.techProg['inserter-capacity'];
    return cap;
  }
  // ===== 几何：严格单向，取格 = 箭头反方向，放格 = 箭头方向 =====
  pickOffset() {
    const d = (this.dir + 2) % 4;
    return { dx: DX[d] * this.reach, dy: DY[d] * this.reach };
  }
  dropOffset() {
    return { dx: DX[this.dir] * this.reach, dy: DY[this.dir] * this.reach };
  }
  pickAng() { const o = this.pickOffset(); return Math.atan2(o.dy, o.dx); }
  dropAng() { const o = this.dropOffset(); return Math.atan2(o.dy, o.dx); }
  entAtPick() {
    const o = this.pickOffset();
    const x = this.x + o.dx, y = this.y + o.dy;
    const e = entAt(x, y);
    return (e && !(e instanceof Inserter)) ? e : null;
  }
  entAtDrop() {
    const o = this.dropOffset();
    const x = this.x + o.dx, y = this.y + o.dy;
    const e = entAt(x, y);
    return (e && !(e instanceof Inserter)) ? e : null;
  }
  // ===== 取物 =====
  peekSource(s) {
    if (!s) return null;
    let it = null;
    if (s instanceof Belt) {
      const z = s.grabZone(this.filter || undefined);
      it = z ? z.item : null;
    } else if (this.filter && s.countOf) {
      // 过滤臂：直接探测源内是否存在过滤物（而非源的首个产出）
      it = s.countOf(this.filter) > 0 ? this.filter : null;
    } else if (s.peekItem) {
      it = s.peekItem();
    }
    if (it && this.filter && it !== this.filter) return null;
    return it;
  }
  countSourceOf(s, item) {
    if (!s) return 0;
    if (s.countOf) return s.countOf(item);
    return 1;
  }
  takeNFrom(s, item, n) {
    const got = [];
    for (let i = 0; i < n; i++) {
      let it = null;
      if (s instanceof Belt) {
        const z = s.grabZone(item);
        if (!z) break;
        s.items.splice(s.items.indexOf(z), 1);
        it = z.item;
      } else if (s.takeItemOf) {
        it = s.takeItemOf(item);
      } else break;
      if (it !== item) break;
      got.push(it);
    }
    return got;
  }
  takeSource(s) {
    if (s instanceof Belt) {
      const z = s.grabZone();
      if (!z) return null;
      s.items.splice(s.items.indexOf(z), 1);
      return z.item;
    }
    if (s.takeOutput) return s.takeOutput();
    if (s.takeItem) return s.takeItem();
    return null;
  }
  // ===== 放物 =====
  canDropAt(t, item) {
    if (!t) return false;
    if (t instanceof Belt && !(t instanceof Splitter)) {
      let back = Infinity;
      for (const o of t.items) back = Math.min(back, o.pos);
      return back >= BELT_SPACING * 0.9;
    }
    switch (t.type) {
      case 'stone-furnace':
      case 'steel-furnace':
        if (item === 'coal') return t.fuelCoal < 20;
        return SMELTS.some(r => r.inp === item) && (t.inp[item] || 0) < 25;
      case 'electric-furnace':
        if (item === 'coal') return false;
        return SMELTS.some(r => r.inp === item) && (t.inp[item] || 0) < 25;
      case 'assembling-machine':
      case 'assembling-machine-mk2':
      case 'assembling-machine-3':
      case 'chemical-plant': {
        if (!t.recipe) return false;
        const rec = RECIPES[t.recipe];
        return !!rec.inp[item] && (t.inp[item] || 0) < 50;
      }
      case 'burner-drill':
        return item === 'coal' && t.fuelCoal < 10;
      case 'burner-inserter':
        return item === 'coal' && t.fuelCoal < 5;
      case 'electric-drill':
        return false;
      case 'offshore-pump':
        return false;
      case 'boiler':
        if (item === 'coal') return t.fuelCoal < 20;
        return item === 'water' && t.water < WATER_CAP - 0.01;
      case 'lab':
        return isScience(item) && (t.packs[item] || 0) < 40;
      case 'underground':
        return t.items.length < UG_CAP;
      case 'pipe':
      case 'pipe-to-ground':
      case 'pump':
        return FLUIDS.indexOf(item) >= 0 && t.total() < (t.maxDist ? PIPE_CAP : PIPE_CAP);
      case 'void-pipe':
        return FLUIDS.indexOf(item) >= 0;   // 虚空管道：接受任意流体后销毁
      case 'creative-pipe':
        return false;  // 创造管道：只产不收
      case 'refinery':
        return item === 'crude-oil' && (t.inp['crude-oil'] || 0) < 50;
      case 'storage-chest':
        return t.slots.length < 12 || t.slots.some(s => s && s.item === item && s.count < 50);
      case 'steel-chest':
        return t.slots.length < 24 || t.slots.some(s => s && s.item === item && s.count < 50);
      case 'void-chest':
        return true;   // 虚空箱：来者不拒，全部销毁
      case 'creative-chest':
        return false;  // 创造箱：只产不收
      case 'gun-turret':
        return (item === 'magazine' || item === 'piercing-rounds') && t.ammoCount(item) < 40;
      default:
        return false;
    }
  }
  deliverAt(t) {
    if (!t || !this.holding) return false;
    if (t instanceof Belt && !(t instanceof Splitter)) {
      const o = this.dropOffset();
      return t.acceptItem(this.holding, dirFromVec(o.dx, o.dy));
    }
    return t.giveItem(this.holding);
  }
  // 干跑：现在是否有活干（供 UI/其他系统查询）
  hasWork() {
    const s = this.entAtPick();
    const it = this.peekSource(s);
    return !!(it && this.canDropAt(this.entAtDrop(), it));
  }
  update(dt) {
    if (this.armAng === undefined) this.armAng = this.pickAng();
    const step = Math.PI * 4.4 * dt;
    // 统一状态机：
    //  空手 -> 转向取物格 -> 到达后原子地“预览+校验+取走（可堆叠抓 N 个）”
    //  持物 -> 转向放物格 -> 到达后循环放入直到放空或目标拒收
    const holdingNow = this.holdingCount > 0;
    const target = holdingNow ? this.dropAng() : this.pickAng();
    const arrived = Math.abs(angNorm(target - this.armAng)) < 0.05;
    if (!arrived) {
      this.rotating = true;
      this.armAng = approachAng(this.armAng, target, step);
      if (Math.abs(angNorm(target - this.armAng)) < 0.05) this.armAng = target;
      else return;
    }
    this.rotating = false;
    this.armAng = target;
    if (!holdingNow) {
      // 惰性调度（P0 优化）：空手待机在取物位时，降频探测取/放（约 5 次/秒）。
      // 避免大量闲置机械臂每帧都做 entAt+peekSource+canDropAt 的邻居探测；
      // 有货/持物/旋转时仍每帧更新，不影响搬运响应。
      this._probeT = (this._probeT || 0) - dt;
      if (this._probeT > 0) return;
      this._probeT = 0.15;
      // 到达取物位：一次性完成“看源、验目标、取走”，避免探测与执行之间的状态漂移
      const s = this.entAtPick();
      const it = this.peekSource(s);
      this.blocked = false;
      if (!it) return;                       // 源为空：停在取物位等待
      if (!this.canDropAt(this.entAtDrop(), it)) return; // 目标暂不收：等待
      const want = Math.max(1, Math.min(this.capacity(), this.countSourceOf(s, it)));
      const got = this.takeNFrom(s, it, want);
      if (!got.length) return;
      this.holding = it;
      this.holdingCount = got.length;
    } else {
      // 到达放物位：循环放入；失败保持持物、标记堵塞，下帧继续重试
      const t = this.entAtDrop();
      while (this.holdingCount > 0 && this.deliverAt(t)) this.holdingCount--;
      this.blocked = this.holdingCount > 0;
      if (this.holdingCount <= 0) this.holding = null;
    }
  }
  contents() {
    const list = [[this.type, 1]];
    if (this.holding) list.push([this.holding, 1]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.holding = this.holding;
    s.holdingCount = this.holdingCount || 1;
    if (this.filter) s.filter = this.filter;
    return s;
  }
  // 蓝图只保留过滤器配置，不复制爪上抓取的物品
  blueprint() {
    const s = super.blueprint();
    if (this.filter) s.filter = this.filter;
    return s;
  }
  static restore(s) {
    const i = super.restore(s);
    i.holding = s.holding || null;
    i.holdingCount = s.holding ? (s.holdingCount || 1) : 0;
    i.filter = s.filter || null;
    return i;
  }
}

class LongInserter extends Inserter {
  constructor(type, x, y) {
    super(type || 'long-inserter', x, y);
    this.reach = 2;   // 几何、行为与普通臂完全一致，只是触及第二格
  }
}

class FilterInserter extends Inserter {
  constructor(type, x, y) { super(type || 'filter-inserter', x, y); }
}

class StackInserter extends Inserter {
  constructor(type, x, y) {
    super(type || 'stack-inserter', x, y);
    this.stackMax = 3;   // 一次最多抓取 3 个同种物品
  }
}

// 堆叠过滤机械臂：过滤 + 堆叠二合一，一次最多抓取 3 个「指定物品」
class StackFilterInserter extends Inserter {
  constructor(type, x, y) {
    super(type || 'stack-filter-inserter', x, y);
    this.stackMax = 3;
  }
}

// ===== 渲染 =====
function drawInserter(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#3c4048';
  ctx.beginPath(); ctx.arc(cx, cy, 9, 0, 7); ctx.fill();
  ctx.strokeStyle = '#22252a';
  ctx.lineWidth = 2;
  ctx.stroke();
  const long = e.type === 'long-inserter';
  if ((e.type === 'filter-inserter' || e.type === 'stack-filter-inserter') && e.filter) {
    ctx.strokeStyle = '#58b8e8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, 7);
    ctx.stroke();
  }
  const len = e.holding ? (long ? TILE * 2.02 : TILE * 1.06) : (long ? TILE * 1.55 : TILE * 0.82);
  const ang = e.armAng !== undefined ? e.armAng : ((dir + 2) % 4) * Math.PI / 2;
  const tipx = cx + Math.cos(ang) * len;
  const tipy = cy + Math.sin(ang) * len;
  ctx.strokeStyle = e.holding ? '#ffe066' : long ? '#e08a4a' : '#b9bec8';
  ctx.lineWidth = long ? 5 : 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(tipx, tipy);
  ctx.stroke();
  ctx.lineCap = 'butt';
  if (e.holding) drawItemDot(ctx, tipx, tipy, e.holding, 4);
  if (e.holding && (e.holdingCount || 1) > 1) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('×' + e.holdingCount, tipx, tipy - 9);
  }
  ctx.fillStyle = dirColorNotch(dir);
  notch(ctx, px, py, dir);
  drawFlowMarks(ctx, e, cx, cy, dir);
  ctx.globalAlpha = 1;
}

// 物流方向标识：亮色脉冲大箭头 = 出料侧（与陷口同侧）；灰色小点 = 进料侧。
// 让“哪边进、哪边出”一眼可辨，不再依赖小陷口或臂体姿态去猜。
function drawFlowMarks(ctx, e, cx, cy, dir) {
  const reach = e.reach || 1;
  const dOut = (reach - 0.5) * TILE - 3;   // 标记到臂心的距离（触及格边缘内侧）
  const pulse = 0.55 + 0.45 * Math.sin((G.time || 0) * 6);
  function chevron(sideDir, color, alpha, size) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(sideDir * Math.PI / 2);
    ctx.globalAlpha = Math.max(0.15, Math.min(1, alpha));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(dOut - size, -size);
    ctx.lineTo(dOut + size * 0.7, 0);
    ctx.lineTo(dOut - size, size);
    ctx.stroke();
    ctx.restore();
  }
  // 出口：物流方向，双箭头向外
  const oc = dirColorNotch(dir);
  chevron(dir, oc, pulse, 5);
  chevron(dir, oc, pulse * 0.45, 8.5);
  // 入口：取货方向，静态灰点
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(((dir + 2) % 4) * Math.PI / 2);
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#9aa0aa';
  ctx.beginPath();
  ctx.arc(dOut, 0, 2.6, 0, 7);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function inserterPanelHtml(e) {
  return '<div class="dim">机械臂：严格单向搬运。从臂体指向的一侧（灰色圆点）取货，放到地面箭头/亮色箭头的一侧（物流方向）。普通臂作用相邻格，长臂作用第二格。R 旋转。</div><div class="status"></div>';
}
function stackInserterPanelHtml(e) {
  return '<div class="dim">堆叠机械臂：一次最多抓取 3 个同种物品再放下，装卸效率约为普通臂的 3 倍。R 旋转。</div><div class="status"></div>';
}
function filterInserterPanelHtml(e) {
  let h = '<div class="dim">过滤机械臂：只抓取选中的物品，其余一律不碰。当前：' +
    (e.filter ? chip(e.filter) : '<span class="dim">未设置</span>') + '</div>';
  h += '<div class="sec">选择过滤物</div><div class="recgrid">';
  for (const id of FILTER_CHOICES) {
    h += '<button class="rcbtn ' + (e.filter === id ? 'sel' : '') + '" data-action="flt" data-id="' + id + '" data-itemid="' + id + '">' +
      '<img src="' + iconDataURL(id) + '">' + ITEMS[id].name + '</button>';
  }
  h += '</div>';
  if (e.filter) h += '<button data-action="flt-clear">清除过滤（恢复普通抓取）</button>';
  h += '<div class="status"></div>';
  return h;
}
function filterInserterOnAction(act, btn) {
  if (act === 'flt') {
    if (G.panelEnt && (G.panelEnt instanceof FilterInserter || G.panelEnt instanceof StackFilterInserter)) G.panelEnt.filter = btn.dataset.id;
    return true;
  }
  if (act === 'flt-clear') {
    if (G.panelEnt && (G.panelEnt instanceof FilterInserter || G.panelEnt instanceof StackFilterInserter)) G.panelEnt.filter = null;
    return true;
  }
  return false;
}
// 悬浮提示（普通/长臂/过滤/堆叠共用）
function inserterTip(e) {
  return e.holding ? ('搬运 ' + ITEMS[e.holding].name + '，8格取放') : '待机：周围8格取放（优先背面取、正面放）';
}
// 面板实时状态：工作中或暂停原因
function inserterPanelLive(e, api) {
  if (e.holding) {
    if (e.blocked) api.status('已暂停：放货格已满，卡住 ' + ITEMS[e.holding].name, 'warn');
    else api.status('搬运中：' + ITEMS[e.holding].name, 'ok');
    return;
  }
  if (e.rotating) { api.status('工作中：转向取货格', 'ok'); return; }
  const s = e.entAtPick();
  const it = e.peekSource(s);
  if (!it) {
    if (e.filter) api.status('已暂停：取货格没有「' + ITEMS[e.filter].name + '」', 'warn');
    else api.status('已暂停：取货格无物品可取', 'warn');
    return;
  }
  if (!e.canDropAt(e.entAtDrop(), it)) api.status('已暂停：放货格已满', 'warn');
  else api.status('待机：等待取货格出现货物', 'ok');
}

// ===== 注册 =====
function inserterStatusFn(e) {
  return e.holding ? (e.blocked ? 'y' : 'g') : (e.rotating ? 'g' : 'r');
}
function stackFilterInserterPanelHtml(e) {
  let h = '<div class="dim">堆叠过滤机械臂：一次最多抓取 3 个「指定物品」再放下，装卸效率高且精确分类。当前：' +
    (e.filter ? chip(e.filter) : '<span class="dim">未设置</span>') + '</div>';
  h += '<div class="sec">选择过滤物</div><div class="recgrid">';
  for (const id of FILTER_CHOICES) {
    h += '<button class="rcbtn ' + (e.filter === id ? 'sel' : '') + '" data-action="flt" data-id="' + id + '" data-itemid="' + id + '">' +
      '<img src="' + iconDataURL(id) + '">' + ITEMS[id].name + '</button>';
  }
  h += '</div>';
  if (e.filter) h += '<button data-action="flt-clear">清除过滤（恢复抓取任意物品）</button>';
  h += '<div class="status"></div>';
  return h;
}

const inserterPanel = { html: inserterPanelHtml, live: inserterPanelLive, tip: inserterTip };
const stackInserterPanel = { html: stackInserterPanelHtml, live: inserterPanelLive, tip: inserterTip };
const filterInserterPanel = { html: filterInserterPanelHtml, onAction: filterInserterOnAction, live: inserterPanelLive, tip: inserterTip };
const stackFilterInserterPanel = { html: stackFilterInserterPanelHtml, onAction: filterInserterOnAction, live: inserterPanelLive, tip: inserterTip };
ENT_CLASSES['inserter'] = Inserter;
ENT_CLASSES['long-inserter'] = LongInserter;
ENT_CLASSES['filter-inserter'] = FilterInserter;
ENT_CLASSES['stack-inserter'] = StackInserter;
ENT_CLASSES['stack-filter-inserter'] = StackFilterInserter;
DEVICE_RENDER['inserter'] = drawInserter;
DEVICE_RENDER['long-inserter'] = drawInserter;
DEVICE_RENDER['filter-inserter'] = drawInserter;
DEVICE_RENDER['stack-inserter'] = drawInserter;
DEVICE_RENDER['stack-filter-inserter'] = drawInserter;
DEVICE_STATUS['inserter'] = inserterStatusFn;
DEVICE_STATUS['long-inserter'] = inserterStatusFn;
DEVICE_STATUS['filter-inserter'] = inserterStatusFn;
DEVICE_STATUS['stack-inserter'] = inserterStatusFn;
DEVICE_STATUS['stack-filter-inserter'] = inserterStatusFn;
DEVICE_PANEL['inserter'] = inserterPanel;
DEVICE_PANEL['long-inserter'] = inserterPanel;
DEVICE_PANEL['filter-inserter'] = filterInserterPanel;
DEVICE_PANEL['stack-inserter'] = stackInserterPanel;
DEVICE_PANEL['stack-filter-inserter'] = stackFilterInserterPanel;
DEVICE_DIR_ROTATE['inserter'] = true;
DEVICE_DIR_ROTATE['long-inserter'] = true;
DEVICE_DIR_ROTATE['filter-inserter'] = true;
DEVICE_DIR_ROTATE['stack-inserter'] = true;
DEVICE_DIR_ROTATE['stack-filter-inserter'] = true;
