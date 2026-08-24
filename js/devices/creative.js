'use strict';

// ===== 测试用创造/虚空设备 =====
// 供开发与测试使用，不消耗电力、无需配方、直接产出/销毁，方便验证物流与流体链路。
// 四种设备：
//   1. creative-chest  创造箱：无限生成选定物品，机械臂可无限取走（点开面板选择要生成的物品）
//   2. void-chest      虚空箱：无限销毁任何存入的物品（机械臂可把物品放进销毁）
//   3. creative-pipe   创造管道：无限生成选定流体，源源不断灌入相邻管道/储液罐
//   4. void-pipe       虚空管道：无限销毁流经的流体（相邻管道会持续把流体排进来销毁）

// ===== 可选择的物品/流体 =====
// 创造箱可选：全部非流体物品（含原料、建材、科学包等）
function creativeItemChoices() {
  return Object.keys(ITEMS).filter(id => FLUIDS.indexOf(id) < 0);
}

// ===== 创造箱：无限生成选定物品 =====
class CreativeChest extends Entity {
  constructor(type, x, y) {
    super('creative-chest', x, y);
    this.selected = null;   // 当前生成的物品
  }
  // 取物：始终返回选定物品（无限）
  peekItem() { return this.selected; }
  takeItem() { return this.selected; }
  takeItemOf(item) { return this.selected === item ? item : null; }
  countOf(item) { return this.selected === item ? 0x3fffffff : 0; }
  giveItem() { return false; }   // 只产不收
  takeAll() { return this.selected ? [[this.selected, 1]] : []; }
  contents() {
    const list = [[this.type, 1]];
    if (this.selected) list.push([this.selected, '∞']);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.selected = this.selected;
    return s;
  }
  // 蓝图保留选定物品配置
  blueprint() {
    const s = super.blueprint();
    s.selected = this.selected;
    return s;
  }
  static restore(s) {
    const c = super.restore(s);
    c.selected = s.selected || null;
    return c;
  }
}

// ===== 虚空箱：无限销毁物品 =====
class VoidChest extends Entity {
  constructor(type, x, y) {
    super('void-chest', x, y);
  }
  giveItem() { return true; }    // 来者不拒，全部销毁
  peekItem() { return null; }    // 存进去的东西取不出来
  takeItem() { return null; }
  takeItemOf() { return null; }
  countOf() { return 0; }
  contents() { return [[this.type, 1]]; }
}

// ===== 创造管道：无限生成选定流体 =====
class CreativePipe extends Pipe {
  constructor(type, x, y) {
    super('creative-pipe', x, y);
    this.selected = null;   // 当前生成的流体
  }
  // 每帧把选定流体补满整管，再由父类 Pipe.update 的均压逻辑灌给相邻管道/储液罐
  update(dt) {
    if (this.selected) {
      this.fluid[this.selected] = PIPE_CAP;
      for (const k of Object.keys(this.fluid)) if (k !== this.selected) delete this.fluid[k];
    } else {
      // 未选择流体时清空
      this.fluid = {};
    }
    super.update(dt);
  }
  giveItem() { return false; }   // 只产不收
  takeAll() { const rows = []; for (const k of Object.keys(this.fluid)) { rows.push([k, this.fluid[k]]); delete this.fluid[k]; } return rows; }
  serialize() {
    const s = super.serialize();
    s.selected = this.selected;
    return s;
  }
  // 蓝图保留选定流体配置
  blueprint() {
    const s = super.blueprint();
    s.selected = this.selected;
    return s;
  }
  static restore(s) {
    const p = super.restore(s);
    p.selected = s.selected || null;
    return p;
  }
}

// ===== 虚空管道：无限销毁流体 =====
class VoidPipe extends Pipe {
  constructor(type, x, y) {
    super('void-pipe', x, y);
  }
  // 每帧清空自身，让相邻管道持续把流体排进来销毁。
  // 必须在 super.update 之前清空：否则父类 Pipe.update 会把刚吸到的流体又匀回相邻管道，导致源管始终残留 1 单位（来回振荡）。
  update(dt) {
    this.fluid = {};
    super.update(dt);
  }
  giveItem(item) {
    // 接受任意流体（用于从相邻管道吸收）后立即清空，达到无限销毁
    if (FLUIDS.indexOf(item) < 0) return false;
    this.fluid[item] = (this.fluid[item] || 0) + 1;
    if (this.total() >= PIPE_CAP) this.fluid = {};
    return true;
  }
  // 销毁型设备：流入的东西一律取不出来
  peekItem() { return null; }
  takeItem() { return null; }
  takeItemOf() { return null; }
}

// ===== 渲染：创造箱（绿色·∞标志）=====
function drawCreativeChest(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#3e7d46';
  rr(ctx, px + 4, py + 8, TILE - 8, TILE - 13, 3); ctx.fill();
  ctx.fillStyle = '#4f9a5a';
  rr(ctx, px + 4, py + 5, TILE - 8, 10, 3); ctx.fill();
  ctx.strokeStyle = '#24522c';
  ctx.lineWidth = 1.5;
  rr(ctx, px + 4, py + 8, TILE - 8, TILE - 13, 3); ctx.stroke();
  // ∞ 标志
  ctx.strokeStyle = '#d8ffe0';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  const cx = px + TILE / 2, cy = py + TILE / 2 + 1;
  const R = 4.5;
  ctx.ellipse(cx - R * 0.7, cy, R, R * 0.55, 0, 0, 7);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx + R * 0.7, cy, R, R * 0.55, 0, 0, 7);
  ctx.stroke();
  // 选中物品图标
  if (e.selected) drawItemDot(ctx, px + TILE / 2, py + TILE - 5, e.selected, 5);
  ctx.globalAlpha = 1;
}

// ===== 渲染：虚空箱（暗色·X标志）=====
function drawVoidChest(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#3a3430';
  rr(ctx, px + 4, py + 8, TILE - 8, TILE - 13, 3); ctx.fill();
  ctx.fillStyle = '#4a4340';
  rr(ctx, px + 4, py + 5, TILE - 8, 10, 3); ctx.fill();
  ctx.strokeStyle = '#1c1815';
  ctx.lineWidth = 1.5;
  rr(ctx, px + 4, py + 8, TILE - 8, TILE - 13, 3); ctx.stroke();
  // X 标志
  ctx.strokeStyle = '#ff8a80';
  ctx.lineWidth = 3;
  const cx = px + TILE / 2, cy = py + TILE / 2 + 1, R = 5;
  ctx.beginPath();
  ctx.moveTo(cx - R, cy - R); ctx.lineTo(cx + R, cy + R);
  ctx.moveTo(cx + R, cy - R); ctx.lineTo(cx - R, cy + R);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// ===== 渲染：创造管道（绿色）=====
function drawCreativePipe(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#3f8f4a';
  ctx.lineWidth = 8;
  for (const [dx, dy] of PIPE_DIRS) {
    const nb = entAt(gx + dx, gy + dy);
    if (nb instanceof Pipe || nb instanceof Refinery || nb instanceof Pumpjack ||
        nb instanceof Boiler || nb instanceof Pump || nb instanceof SteamEngine ||
        nb instanceof ChemicalPlant || nb instanceof Assembler || nb instanceof StorageTank ||
        nb instanceof PipeToGround || nb instanceof FluidPump || nb instanceof CreativePipe || nb instanceof VoidPipe) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + dx * TILE / 2, cy + dy * TILE / 2);
      ctx.stroke();
    }
  }
  ctx.fillStyle = '#4f9a5a';
  ctx.beginPath(); ctx.arc(cx, cy, 8.5, 0, 7); ctx.fill();
  ctx.strokeStyle = '#24522c';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, 8.5, 0, 7); ctx.stroke();
  // ∞ 标志
  ctx.strokeStyle = '#d8ffe0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  const R = 3.5;
  ctx.ellipse(cx - 4.5, cy, R, R * 0.55, 0, 0, 7);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx + 4.5, cy, R, R * 0.55, 0, 0, 7);
  ctx.stroke();
  // 选中流体颜色
  if (e.selected && ITEMS[e.selected]) {
    ctx.fillStyle = ITEMS[e.selected].color;
    ctx.beginPath(); ctx.arc(cx, cy, 3.5, 0, 7); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ===== 渲染：虚空管道（暗色）=====
function drawVoidPipe(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#6a3a3a';
  ctx.lineWidth = 8;
  for (const [dx, dy] of PIPE_DIRS) {
    const nb = entAt(gx + dx, gy + dy);
    if (nb instanceof Pipe || nb instanceof Refinery || nb instanceof Pumpjack ||
        nb instanceof Boiler || nb instanceof Pump || nb instanceof SteamEngine ||
        nb instanceof ChemicalPlant || nb instanceof Assembler || nb instanceof StorageTank ||
        nb instanceof PipeToGround || nb instanceof FluidPump || nb instanceof CreativePipe || nb instanceof VoidPipe) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + dx * TILE / 2, cy + dy * TILE / 2);
      ctx.stroke();
    }
  }
  ctx.fillStyle = '#4a3430';
  ctx.beginPath(); ctx.arc(cx, cy, 8.5, 0, 7); ctx.fill();
  ctx.strokeStyle = '#221412';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, 8.5, 0, 7); ctx.stroke();
  // X 标志
  ctx.strokeStyle = '#ff8a80';
  ctx.lineWidth = 3;
  const R = 4;
  ctx.beginPath();
  ctx.moveTo(cx - R, cy - R); ctx.lineTo(cx + R, cy + R);
  ctx.moveTo(cx + R, cy - R); ctx.lineTo(cx - R, cy + R);
  ctx.stroke();
  ctx.globalAlpha = 1;
}

// ===== 创造箱面板：选择要生成的物品 =====
function creativeChestPanelHtml(e) {
  let h = '<div class="dim">创造箱（测试）：无限生成选中的物品，机械臂/玩家可无限取走。当前：' +
    (e.selected ? chip(e.selected) : '<span class="dim">未选择</span>') + '</div>';
  h += '<div class="sec">选择要生成的物品</div><div class="recgrid">';
  for (const id of creativeItemChoices()) {
    h += '<button class="rcbtn ' + (e.selected === id ? 'sel' : '') + '" data-action="csel" data-id="' + id + '" data-itemid="' + id + '">' +
      '<img src="' + iconDataURL(id) + '">' + ITEMS[id].name + '</button>';
  }
  h += '</div>';
  if (e.selected) h += '<button data-action="csel-clear">停止生成</button>';
  h += '<div class="status"></div>';
  return h;
}
function creativeChestPanelLive(e, api) {
  if (e.selected) api.status('生成中：无限产出 ' + ITEMS[e.selected].name, 'ok');
  else api.status('未选择生成物，等待选择', 'warn');
}
function creativeChestOnAction(act, btn) {
  if (act === 'csel') { if (G.panelEnt instanceof CreativeChest) G.panelEnt.selected = btn.dataset.id; return true; }
  if (act === 'csel-clear') { if (G.panelEnt instanceof CreativeChest) G.panelEnt.selected = null; return true; }
  return false;
}
function creativeChestTip(e) {
  return e.selected ? ('无限产出 ' + ITEMS[e.selected].name) : '创造箱（未选择生成物）';
}

// ===== 虚空箱面板 =====
function voidChestPanelHtml(e) {
  return '<div class="dim">虚空箱（测试）：无限销毁任何存入的物品，机械臂/玩家放进去的东西都会被抹除，无法取出。</div><div class="status"></div>';
}
function voidChestPanelLive(e, api) {
  api.status('销毁中：放入的物品即刻消失', 'ok');
}
function voidChestTip() { return '虚空箱：无限销毁物品'; }

// ===== 创造管道面板：选择要生成的流体 =====
function creativePipePanelHtml(e) {
  let h = '<div class="dim">创造管道（测试）：无限生成选中的流体，源源不断灌入相邻管道/储液罐。当前：' +
    (e.selected ? chip(e.selected) : '<span class="dim">未选择</span>') + '</div>';
  h += '<div class="sec">选择要生成的流体</div><div class="recgrid">';
  for (const id of FLUIDS) {
    h += '<button class="rcbtn ' + (e.selected === id ? 'sel' : '') + '" data-action="psel" data-id="' + id + '" data-itemid="' + id + '">' +
      '<img src="' + iconDataURL(id) + '">' + ITEMS[id].name + '</button>';
  }
  h += '</div>';
  if (e.selected) h += '<button data-action="psel-clear">停止生成</button>';
  h += '<div class="status"></div>';
  return h;
}
function creativePipePanelLive(e, api) {
  if (e.selected) api.status('生成中：无限产出 ' + ITEMS[e.selected].name, 'ok');
  else api.status('未选择流体，等待选择', 'warn');
}
function creativePipeOnAction(act, btn) {
  if (act === 'psel') { if (G.panelEnt instanceof CreativePipe) G.panelEnt.selected = btn.dataset.id; return true; }
  if (act === 'psel-clear') { if (G.panelEnt instanceof CreativePipe) G.panelEnt.selected = null; return true; }
  return false;
}
function creativePipeTip(e) {
  return e.selected ? ('无限产出 ' + ITEMS[e.selected].name) : '创造管道（未选择流体）';
}

// ===== 虚空管道面板 =====
function voidPipePanelHtml() {
  return '<div class="dim">虚空管道（测试）：无限销毁流经的流体。相邻管道/储液罐会把流体持续排入这里销毁，作为流体汇点。</div><div class="status"></div>';
}
function voidPipePanelLive(e, api) {
  api.status('销毁中：流入的流体即刻消失', 'ok');
}
function voidPipeTip() { return '虚空管道：无限销毁流体'; }

// ===== 状态灯 =====
function creativeChestStatus(e) { return e.selected ? 'g' : 'r'; }
function creativePipeStatus(e) { return e.selected ? 'g' : 'r'; }

// ===== 注册 =====
ENT_CLASSES['creative-chest'] = CreativeChest;
ENT_CLASSES['void-chest'] = VoidChest;
ENT_CLASSES['creative-pipe'] = CreativePipe;
ENT_CLASSES['void-pipe'] = VoidPipe;
DEVICE_RENDER['creative-chest'] = drawCreativeChest;
DEVICE_RENDER['void-chest'] = drawVoidChest;
DEVICE_RENDER['creative-pipe'] = drawCreativePipe;
DEVICE_RENDER['void-pipe'] = drawVoidPipe;
DEVICE_STATUS['creative-chest'] = creativeChestStatus;
DEVICE_STATUS['void-chest'] = () => 'g';
DEVICE_STATUS['creative-pipe'] = creativePipeStatus;
DEVICE_STATUS['void-pipe'] = () => 'g';
DEVICE_PANEL['creative-chest'] = { html: creativeChestPanelHtml, live: creativeChestPanelLive, tip: creativeChestTip, onAction: creativeChestOnAction };
DEVICE_PANEL['void-chest'] = { html: voidChestPanelHtml, live: voidChestPanelLive, tip: voidChestTip };
DEVICE_PANEL['creative-pipe'] = { html: creativePipePanelHtml, live: creativePipePanelLive, tip: creativePipeTip, onAction: creativePipeOnAction };
DEVICE_PANEL['void-pipe'] = { html: voidPipePanelHtml, live: voidPipePanelLive, tip: voidPipeTip };
// 创造/虚空管道可旋转本体（默认 R 键旋转方向；虽无朝向语义，保留一致体验）
DEVICE_DIR_ROTATE['creative-pipe'] = true;
DEVICE_DIR_ROTATE['void-pipe'] = true;

// ===== 创造传送带：点击面板选择物品，带上无限生成该物品 =====
class CreativeBelt extends Belt {
  constructor(type, x, y) {
    super('creative-belt', x, y);
    this.selected = null;   // 当前生成的物品
  }
  // 每帧在带上尾部生成选定物品，保持带上始终有货可流动、可被机械臂取走。
  update(dt) {
    if (this.selected) {
      // 从尾部（pos=0）起补货：一次只补一个空位，后续帧持续补满整条带
      for (const p of [0, BELT_SPACING, BELT_SPACING * 2, BELT_SPACING * 3]) {
        if (this.items.some(o => Math.abs(o.pos - p) < BELT_SPACING - 0.001)) continue;
        this.items.push({ item: this.selected, pos: p, side: -1 });
        break;
      }
    }
    super.update(dt);
  }
  // 创造带只产不收：外部物品一律拒收（仅生成面板选定的物品）
  acceptItem() { return false; }
  // 选中物品的“无限库存”，供机械臂/玩家读取
  countOf(item) { return this.selected === item ? 0x3fffffff : 0; }
  peekItem() {
    if (!this.selected) return null;
    const z = this.grabZone();
    return z ? z.item : (this.selected);
  }
  contents() {
    const list = [[this.type, 1]];
    for (const o of this.items) list.push([o.item, 1]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.selected = this.selected;
    return s;
  }
  blueprint() {
    const s = super.blueprint();
    s.selected = this.selected;
    return s;
  }
  static restore(s) {
    const b = super.restore(s);
    b.selected = s.selected || null;
    return b;
  }
}

// ===== 虚空传送带：任何物品流转到带上即刻销毁 =====
class VoidBelt extends Belt {
  constructor(type, x, y) {
    super('void-belt', x, y);
  }
  // 每帧清空带上物品，实现“来即销毁”。
  update(dt) {
    this.items = [];
    super.update(dt);
  }
  // 来者不拒：接受任何物品后立即销毁（清空），作为物流汇点。
  acceptItem() { return true; }
  countOf() { return 0; }
  peekItem() { return null; }
  takeItem() { return null; }
  contents() { return [[this.type, 1]]; }
}

// ===== 创造传送带面板：选择要生成的物品 =====
function creativeBeltPanelHtml(e) {
  let h = '<div class="dim">创造传送带（测试）：无限生成选中的物品，随带向前流动，机械臂/玩家可无限取走。当前：' +
    (e.selected ? chip(e.selected) : '<span class="dim">未选择</span>') + '</div>';
  h += '<div class="sec">选择要生成的物品</div><div class="recgrid">';
  for (const id of creativeItemChoices()) {
    h += '<button class="rcbtn ' + (e.selected === id ? 'sel' : '') + '" data-action="cbsel" data-id="' + id + '" data-itemid="' + id + '">' +
      '<img src="' + iconDataURL(id) + '">' + ITEMS[id].name + '</button>';
  }
  h += '</div>';
  if (e.selected) h += '<button data-action="cbsel-clear">停止生成</button>';
  h += '<div class="status"></div>';
  return h;
}
function creativeBeltPanelLive(e, api) {
  if (e.selected) api.status('生成中：带上无限产出 ' + ITEMS[e.selected].name, 'ok');
  else api.status('未选择生成物，等待选择', 'warn');
}
function creativeBeltOnAction(act, btn) {
  if (act === 'cbsel') { if (G.panelEnt instanceof CreativeBelt) G.panelEnt.selected = btn.dataset.id; return true; }
  if (act === 'cbsel-clear') { if (G.panelEnt instanceof CreativeBelt) G.panelEnt.selected = null; return true; }
  return false;
}
function creativeBeltTip(e) {
  return e.selected ? ('无限产出 ' + ITEMS[e.selected].name) : '创造传送带（未选择生成物）';
}

// ===== 虚空传送带面板 =====
function voidBeltPanelHtml() {
  return '<div class="dim">虚空传送带（测试）：任何流转到这条带上的物品都会被即刻销毁，无法取出，作为物流销毁汇点。</div><div class="status"></div>';
}
function voidBeltPanelLive(e, api) {
  api.status('销毁中：流转到带上的物品即刻消失', 'ok');
}
function voidBeltTip() { return '虚空传送带：无限销毁流转物品'; }

// ===== 状态灯 =====
function creativeBeltStatus(e) { return e.selected ? 'g' : 'r'; }

// ===== 注册 =====
ENT_CLASSES['creative-belt'] = CreativeBelt;
ENT_CLASSES['void-belt'] = VoidBelt;
DEVICE_RENDER['creative-belt'] = drawBelt;
DEVICE_RENDER['void-belt'] = drawBelt;
DEVICE_STATUS['creative-belt'] = creativeBeltStatus;
DEVICE_STATUS['void-belt'] = () => 'g';
DEVICE_PANEL['creative-belt'] = { html: creativeBeltPanelHtml, live: creativeBeltPanelLive, tip: creativeBeltTip, onAction: creativeBeltOnAction };
DEVICE_PANEL['void-belt'] = { html: voidBeltPanelHtml, live: voidBeltPanelLive, tip: voidBeltTip };
// 创造/虚空传送带可旋转方向（对齐普通传送带）
DEVICE_DIR_ROTATE['creative-belt'] = true;
DEVICE_DIR_ROTATE['void-belt'] = true;
