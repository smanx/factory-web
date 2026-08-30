'use strict';

// ===== 储物箱：存物资，可设每种物品的存量上限 =====
// 继承 CircuitNode（CircuitNode 亦是 Entity 子类）：储物箱可接入电路网络，
// 把箱内每种物品的数量作为信号输出到所连网络，供组合器/机械臂/传送带等做逻辑控制
// （对齐《异星工厂》：储物箱可通过电路网络读取物品数量，实现按库存自动化）。
// 箱子与背包一致：固定 N 个格子（槽位数组固定长度，空位为 null），一格一种物品、
// 堆叠满后占住该格；格子占满后机械臂/手动均无法再放入。
// 槽位容量统一走 GAME_DATA.containerSizes（官方 inventory_size，单源），不再在业务里写死。
class Chest extends CircuitNode {
  constructor(type, x, y) {
    // 传入的 type 需透传给父类（Entity 用它设置 this.type）；不能写死 iron-chest，
    // 否则木箱/钢箱构造后 type 全变成铁箱，导致放置后渲染成铁箱。
    super(type, x, y);
    this.limits = {};
    this.slots = new Array(this.slotCap()).fill(null);
  }
  // 槽位容量（官方 inventory_size：木箱 16 / 铁箱 32 / 钢箱 48，各子类覆盖）
  slotCap() {
    return GAME_DATA.containerSizes?.[this.type] ?? 12;
  }
  // 空闲槽位下标（栈序：从后往前找，取出/放入的槽位语义与旧版“末尾优先”一致）
  freeSlotIndex() {
    for (let i = this.slots.length - 1; i >= 0; i--) if (!this.slots[i]) return i;
    return -1;
  }
  // 某物品是否还能堆叠进已有格子（只要有一个格子放得下即可）
  canStackInto(item) {
    for (const s of this.slots) if (s && s.item === item && s.count < stackSize(item)) return true;
    return false;
  }
  giveItem(item) {
    const cap = this.limits[item];
    if (cap !== undefined && this.countOf(item) >= cap) return false;
    // 先堆叠进已有同种物品格子（格内未堆满）
    for (const s of this.slots) {
      if (s && s.item === item && s.count < stackSize(item)) { s.count++; return true; }
    }
    // 再放进空闲格子
    const i = this.freeSlotIndex();
    if (i < 0) return false;
    this.slots[i] = { item, count: 1 };
    return true;
  }
  peekItem() {
    for (let i = this.slots.length - 1; i >= 0; i--) {
      const s = this.slots[i];
      if (s) return s.item;
    }
    return null;
  }
  takeItem() {
    for (let i = this.slots.length - 1; i >= 0; i--) {
      const s = this.slots[i];
      if (s) {
        const it = s.item;
        s.count--;
        if (s.count <= 0) this.slots[i] = null;
        return it;
      }
    }
    return null;
  }
  countOf(item) {
    let n = 0;
    for (const st of this.slots) if (st && st.item === item) n += st.count;
    return n;
  }
  takeItemOf(item) {
    for (let i = this.slots.length - 1; i >= 0; i--) {
      const st = this.slots[i];
      if (st && st.item === item) {
        st.count--;
        if (st.count <= 0) this.slots[i] = null;
        return item;
      }
    }
    return null;
  }
  contents() {
    const list = [[this.type, 1]];
    for (const s of this.slots) if (s) list.push([s.item, s.count]);
    return list;
  }
  // 面板"取出全部"：清空所有槽位
  takeAll() {
    const rows = [];
    for (const s of this.slots) if (s) rows.push([s.item, s.count]);
    this.slots = new Array(this.slotCap()).fill(null);
    return rows;
  }
  serialize() {
    const s = super.serialize();
    s.slots = this.slots.map(v => v ? [v.item, v.count] : null);
    s.limits = this.limits;
    return s;
  }
  // 蓝图保留格子数量上限配置，不复制箱内物品
  blueprint() {
    const s = super.blueprint();
    s.limits = this.limits;
    return s;
  }
  static restore(s) {
    const c = super.restore(s);
    c.limits = {};
    for (const k in (s.limits || {})) if (s.limits[k] > 0) c.limits[k] = s.limits[k];
    // 槽位固定长度：旧档为动态数组/压缩数组 → 展开成固定长度格子，越界内容丢弃
    const raw = s.slots || [];
    const cap = c.slotCap();
    c.slots = new Array(cap).fill(null);
    for (let i = 0; i < Math.min(cap, raw.length); i++) {
      const v = raw[i];
      if (v) c.slots[i] = { item: v[0] ?? v.item, count: v[1] ?? v.count };
    }
    return c;
  }
}

// ===== 渲染 =====
// 箱子统一工业渲染（木箱/铁箱/钢箱/物流箱共用同一套分层结构，按等级换材质与配件）。
// 新版「重型工业货箱」分层（自下而上）：
//   ① 地面椭圆阴影          ② 托盘底座（左右脚块，中间留叉车槽，可叉运搬运）
//   ③ 箱体主体（竖向下亮上暗渐变）
//   ④ 材质纹理：木箱=横向木板条+板缝板钉；金属箱=水平加强筋（铁 1 条/钢 2 条）
//   ⑤ 四角 L 形护角铁（运输防撞包角，物流箱可用 noCorner 跳过）
//   ⑥ 盖沿投影（上盖在箱体上的落影）
//   ⑦ 凸沿上盖（盖板比箱体宽形成帽檐：顶面反光 + 渐变盖沿 + 下缘收边）
//   ⑧ 中央锁扣（金属护片+锁孔）  ⑨ 角部铆钉  ⑩ 外描边
// tier 定义类型差异（渐变色 / 纹理样式 / 盖厚 lidH / 筋数 ribs / noCorner）；
// extra 为各类型附加配件回调（物流箱信号灯/徽标/信号条等）。
const CHEST_TIERS = {
  wood: {  // 木箱：暖木色 + 板条纹理 + 铁皮护角
    grad: ['#a07a45', '#83602f', '#5a3e1c'],
    lidG: ['#b08a52', '#8a6335'],
    lidTop: '#c9a468',
    line: '#4c381d',
    rib:  '#6d4d26',
    rivet: '#c9b27e',
    pallet: '#46351a',
    corner: '#6f6f6f',
    style: 'wood',
  },
  iron: {  // 铁箱：亮灰蓝钢 + 单条加强筋
    grad: ['#98aab8', '#7a8c9e', '#52627a'],
    lidG: ['#a8bac9', '#8598aa'],
    lidTop: '#b8c8d5',
    line: '#3d4a58',
    rib:  '#63768a',
    rivet: '#d3dde7',
    pallet: '#39434f',
    corner: '#5e6d7d',
    style: 'metal', ribs: 1,
  },
  steel: { // 钢箱：厚重深钢灰 + 双条加强筋 + 加厚凸沿盖
    grad: ['#7a8a9e', '#5c6b7e', '#3d4652'],
    lidG: ['#8c9cb0', '#68788e'],
    lidTop: '#9daebf',
    line: '#313b46',
    rib:  '#4c5a6c',
    rivet: '#b7c3d0',
    pallet: '#2c343e',
    corner: '#44505c',
    style: 'metal', ribs: 2, lidH: 7.5,
  },
};

function drawChestBox(ctx, e, gx, gy, dir, alpha, tier, extra) {
  const px = gx * TILE, py = gy * TILE;
  const simple = !!(typeof LOD !== 'undefined' && LOD && LOD.simple);
  const cx = px + TILE / 2;
  const lidH = tier.lidH || 6;                       // 盖厚（钢箱加厚显重型）
  const lidX = px + 3, lidY = py + 4, lidW = 26;     // 凸沿上盖（比箱体宽，形成帽檐）
  const bodyX = px + 4.5, bodyW = 23;               // 箱体主体
  const bodyY = py + 3.5 + lidH;                    // 顶缘插入盖下 0.5（盖压住接缝）
  const bodyH = 25.2 - 3.5 - lidH;                  // 箱底统一落在 py+25.2（托盘上）
  ctx.globalAlpha = alpha;

  // ① 地面阴影
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(cx, py + 29.2, 13, 2.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // ② 托盘底座：左右脚块，中间留叉车槽
  for (const fx of [px + 5, px + 20]) {
    ctx.fillStyle = tier.pallet;
    rr(ctx, fx, py + 25.2, 7, 3.7, 1.2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    rr(ctx, fx + 0.6, py + 25.5, 5.8, 0.9, 0.5); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    rr(ctx, fx + 0.6, py + 28.1, 5.8, 0.7, 0.4); ctx.fill();
  }

  // ③ 箱体主体（竖渐变：上亮下暗）
  const bodyGrad = ctx.createLinearGradient(0, bodyY, 0, bodyY + bodyH);
  bodyGrad.addColorStop(0, tier.grad[0]);
  bodyGrad.addColorStop(0.55, tier.grad[1]);
  bodyGrad.addColorStop(1, tier.grad[2]);
  ctx.fillStyle = bodyGrad;
  rr(ctx, bodyX, bodyY, bodyW, bodyH, 2.2); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.18)';                // 箱底贴地内阴影
  rr(ctx, bodyX + 1, bodyY + bodyH - 2.6, bodyW - 2, 2.4, 1.5); ctx.fill();

  // ④ 材质纹理
  if (!simple) {
    if (tier.style === 'wood') {
      // 木板条：两条板缝 + 缝端板钉
      ctx.strokeStyle = tier.line;
      ctx.lineWidth = 1;
      for (const sy of [bodyY + 5.2, bodyY + 10.4]) {
        ctx.beginPath(); ctx.moveTo(bodyX + 3, sy); ctx.lineTo(bodyX + bodyW - 3, sy); ctx.stroke();
        ctx.fillStyle = tier.rivet;
        ctx.beginPath(); ctx.arc(bodyX + 3.5, sy, 0.85, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(bodyX + bodyW - 3.5, sy, 0.85, 0, Math.PI * 2); ctx.fill();
      }
    } else {
      // 水平加强筋（凸起：中亮带 + 下暗槽；铁 1 条 / 钢·物流 2 条）
      const ribs = (tier.ribs === 2) ? [bodyY + 4.3, bodyY + 9.3] : [bodyY + 7];
      for (const ry of ribs) {
        ctx.fillStyle = tier.rib;
        rr(ctx, bodyX + 3, ry, bodyW - 6, 2, 1); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.16)';
        rr(ctx, bodyX + 3, ry + 0.35, bodyW - 6, 0.7, 0.4); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        rr(ctx, bodyX + 3, ry + 1.4, bodyW - 6, 0.65, 0.35); ctx.fill();
      }
    }
  }

  // ⑤ 四角 L 形护角铁（横臂+竖臂包住箱角，物流箱 noCorner 跳过）
  if (!simple && !tier.noCorner) {
    const a = 6.5, t = 2;
    const x0 = bodyX + 0.5, y0 = bodyY + 1;
    const x1 = bodyX + bodyW - 0.5, y1 = bodyY + bodyH - 0.5;
    ctx.fillStyle = tier.corner;
    rr(ctx, x0, y0, a, t, 1); ctx.fill();            // 左上横臂
    rr(ctx, x0, y0, t, a, 1); ctx.fill();            // 左上竖臂
    rr(ctx, x1 - a, y0, a, t, 1); ctx.fill();        // 右上横臂
    rr(ctx, x1 - t, y0, t, a, 1); ctx.fill();        // 右上竖臂
    rr(ctx, x0, y1 - t, a, t, 1); ctx.fill();        // 左下横臂
    rr(ctx, x0, y1 - a, t, a, 1); ctx.fill();        // 左下竖臂
    rr(ctx, x1 - a, y1 - t, a, t, 1); ctx.fill();    // 右下横臂
    rr(ctx, x1 - t, y1 - a, t, a, 1); ctx.fill();    // 右下竖臂
    ctx.fillStyle = 'rgba(255,255,255,0.14)';        // 上部护角横臂高光
    rr(ctx, x0 + 0.4, y0 + 0.3, a - 0.8, 0.6, 0.3); ctx.fill();
    rr(ctx, x1 - a + 0.4, y0 + 0.3, a - 0.8, 0.6, 0.3); ctx.fill();
  }

  // ⑥ 盖沿投影（上盖在箱体上的落影）
  ctx.fillStyle = 'rgba(0,0,0,0.26)';
  rr(ctx, bodyX + 0.8, bodyY, bodyW - 1.6, 1.4, 0.7); ctx.fill();

  // ⑦ 凸沿上盖（顶面反光 + 渐变盖沿 + 下缘收边）
  const lidGrad = ctx.createLinearGradient(0, lidY, 0, lidY + lidH);
  lidGrad.addColorStop(0, tier.lidG[0]);
  lidGrad.addColorStop(1, tier.lidG[1]);
  ctx.fillStyle = lidGrad;
  rr(ctx, lidX, lidY, lidW, lidH, 2.4); ctx.fill();
  ctx.fillStyle = tier.lidTop;                      // 盖顶面（伪 3D 受光面）
  rr(ctx, lidX + 1, lidY + 0.8, lidW - 2, 2.5, 1.2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.30)';         // 顶面高光
  rr(ctx, lidX + 1.8, lidY + 1.2, lidW - 3.6, 0.9, 0.5); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.32)';               // 盖下缘收边（盖厚度）
  rr(ctx, lidX + 0.8, lidY + lidH - 1.2, lidW - 1.6, 1, 0.5); ctx.fill();

  // ⑧ 中央锁扣（金属护片 + 锁孔，跨在盖与箱体交界）
  const latchY = lidY + lidH - 1.5;
  ctx.fillStyle = tier.line;
  rr(ctx, cx - 5, latchY, 10, 5, 1.5); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.16)';
  rr(ctx, cx - 5, latchY, 10, 1.2, 1); ctx.fill();
  ctx.fillStyle = '#141a22';
  rr(ctx, cx - 0.9, latchY + 1.1, 1.8, 3, 0.9); ctx.fill();

  // ⑨ 角部铆钉（盖左右 + 箱底护角上）
  if (!simple) {
    const nails = [
      [lidX + 2.8, lidY + lidH - 2.2], [lidX + lidW - 2.8, lidY + lidH - 2.2],
      [bodyX + 3.5, bodyY + bodyH - 1.5], [bodyX + bodyW - 3.5, bodyY + bodyH - 1.5],
    ];
    for (const [nx, ny] of nails) {
      ctx.fillStyle = 'rgba(0,0,0,0.42)';
      ctx.beginPath(); ctx.arc(nx, ny, 1.2, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = tier.rivet;
      ctx.beginPath(); ctx.arc(nx, ny, 0.75, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ⑩ 外描边（盖与箱体分别收边）
  ctx.strokeStyle = 'rgba(0,0,0,0.45)';
  ctx.lineWidth = 1;
  rr(ctx, lidX + 0.4, lidY + 0.4, lidW - 0.8, lidH - 0.8, 2); ctx.stroke();
  rr(ctx, bodyX + 0.4, bodyY + 0.4, bodyW - 0.8, bodyH - 0.8, 1.8); ctx.stroke();

  // 附加配件（物流箱信号灯 / 功能色徽标等）
  if (extra) extra(ctx, px, py, tier);
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
// 所有储物箱采用「双栏」布局：左栏=玩家背包，右栏=箱子格子，可双向移动物品。
// 左栏复用 htmlInventory()（与背包/配方设备一致：点击物品即拿起，拿起后可存入箱子）。
// 右栏为箱子固定格子网格（与背包一致：空槽可见、一格一种物品），交互与背包点击式移动一致：
//   - 点击物品格：拿起该格物品（高亮），再点另一箱格整叠移动/合并/交换，点同格放回，点左栏背包格整叠取出
//   - 拿起背包物品后点击箱格：把该物品整叠存入箱子（优先落入点击格）
//   - 未拿起任何物品点击空格：若已选中（幽灵持握）背包物品则放入 1 件
// 兼容物流箱/接驳站/扩展舱等所有带 slots 的存储容器（共用 chestRightHtml）。

// 右栏：箱子固定格子 + 操作
function chestSlotGridHtml(e) {
  // 持握来源格（物品已移出悬浮于鼠标）高亮，点击可放回
  const heldSlot = (G.held && G.held.src && G.held.src.kind === 'chest' && G.held.src.ent === e) ? G.held.src.slot : -1;
  let h = '';
  for (let i = 0; i < e.slots.length; i++) {
    const s = e.slots[i];
    if (!s) {
      const sel = (heldSlot === i) ? ' slot-sel' : '';
      h += '<div class="inv-slot empty' + sel + '" data-chestslot="' + i + '" data-tip="' +
        (heldSlot === i ? '放回原格|点击把手持物品放回此处' : '空槽|拿起物品后点击此格放入') + '"></div>';
    } else {
      const id = s.item, n = s.count;
      const icon = (ITEMS[id] && typeof iconDataURL === 'function') ? iconDataURL(id, 16) : '';
      h += '<div class="inv-slot" data-chestslot="' + i + '" data-itemid="' + id + '" data-tip="' +
        (ITEMS[id] ? ITEMS[id].name : id) + '|点击拿起该物品悬浮于鼠标：可放入背包/箱格/设备原料或产品格（当前 ' + n + '）">' +
        (icon ? '<img src="' + icon + '">' : '') +
        '<span class="cnt">' + n + '</span></div>';
    }
  }
  return h;
}

// 右栏：仅箱子格子网格（面板只展示箱子名称 + 格子，文本描述与操作按钮已移除）
function chestRightHtml(e, typeName, capDesc) {
  let h = '<div class="chest-items" id="chest-items" data-live="chest-items">';
  h += chestSlotGridHtml(e);
  h += '</div>';
  return h;
}

// 箱子网格内容签名：格内物品/数量或持握高亮格变化时才重建，避免每帧 innerHTML 重建导致虚线闪烁、点击丢失
function chestGridSig(e) {
  const heldSlot = (G.held && G.held.src && G.held.src.kind === 'chest' && G.held.src.ent === e) ? G.held.src.slot : -1;
  let s = heldSlot + '|';
  for (let i = 0; i < e.slots.length; i++) { const st = e.slots[i]; s += (st ? st.item + ':' + st.count : '') + ','; }
  return s;
}
// 实时刷新箱子网格：仅在签名变化时重建 innerHTML
function refreshChestGrid(e) {
  const box = document.getElementById('chest-items');
  if (!box) return;
  const sig = chestGridSig(e);
  if (box.dataset.sig === sig) return;
  box.dataset.sig = sig;
  box.innerHTML = chestSlotGridHtml(e);
}

// 双栏布局：左=玩家背包，右=箱子
function chestDualPaneHtml(e, typeName, capDesc) {
  const left = htmlInventory();
  const right = chestRightHtml(e, typeName, capDesc);
  return '<div class="inv-layout machine-layout chest-layout">' +
    '<div class="inv-col inv-col-left" id="inv-col-left"><div class="inv-col-head">🎒 玩家</div>' +
    '<div class="inv-col-body" id="inv-mat">' + left + '</div></div>' +
    '<div class="inv-col inv-col-right" id="inv-col-right"><div class="inv-col-head">📦 ' + typeName + '（箱子）</div>' +
    '<div class="inv-col-body">' + right + '</div></div>' +
  '</div>';
}

function chestPanelHtml(e) {
  return chestDualPaneHtml(e, ITEMS[e.type].name, '可接入电路网络输出箱内物品数量信号。');
}
function chestPanelLive(e, api) {
  chestDualPaneLive(e, api);
}
function chestTip(e) {
  let n = 0, k = 0;
  for (const s of e.slots) if (s) { n += s.count; k++; }
  return k ? ('存货 ' + n + ' 个（' + k + ' 种）') : '空箱';
}
function chestDualPaneLive(e, api) {
  // 面板仅展示格子：实时刷新箱子网格（签名变化才重建，避免闪烁）
  refreshChestGrid(e);
}
function chestOnAction(act) {
  if (act === 'limits-clear') {
    const c = G.panelEnt;
    if (c instanceof Chest) c.limits = {};
    return true;
  }
  return false;
}
function chestOnChange(ev) {
  const lim = ev.target.closest ? ev.target.closest('[data-limit]') : null;
  if (!lim) return false;
  const c = G.panelEnt;
  if (c instanceof Chest) {
    const id = lim.dataset.limit;
    let v = Math.floor(+lim.value);
    if (!isFinite(v) || v <= 0) { delete c.limits[id]; lim.value = ''; }
    else { c.limits[id] = v; lim.value = v; }
    uiDirty = true;
  }
  return true;
}

// ===== 木箱（对齐《异星工厂》Wooden chest，占地 1×1，容量较小 16 格）=====
class WoodenChest extends Chest {
  constructor(type, x, y) { super('wooden-chest', x, y); }
  slotCap() { return GAME_DATA.containerSizes?.['wooden-chest'] ?? 16; }
}
function drawWoodenChest(ctx, e, gx, gy, dir, alpha) {
  drawChestBox(ctx, e, gx, gy, dir, alpha, CHEST_TIERS.wood, null);
}
function woodenChestPanelHtml(e) {
  return chestDualPaneHtml(e, '木箱', '木箱：最基础的储物箱（16 格），开局即可用木材合成。');
}
function woodenChestPanelLive(e, api) {
  chestDualPaneLive(e, api);
}
function woodenChestTip(e) {
  let n = 0;
  for (const s of e.slots) if (s) n += s.count;
  return n ? ('木箱存货 ' + n + ' 个') : '空木箱';
}
ENT_CLASSES['wooden-chest'] = WoodenChest;
DEVICE_RENDER['wooden-chest'] = drawWoodenChest;
DEVICE_DIR_ROTATE['wooden-chest'] = true; // 支持旋转
DEVICE_PANEL['wooden-chest'] = { html: woodenChestPanelHtml, live: woodenChestPanelLive, tip: woodenChestTip, onAction: chestOnAction, onChange: chestOnChange };

// ===== 铁箱（对齐《异星工厂》Iron chest，占地 1×1，容量 32 格，比木箱大、比钢箱小）=====
class IronChest extends Chest {
  constructor(type, x, y) { super('iron-chest', x, y); }
  slotCap() { return GAME_DATA.containerSizes?.['iron-chest'] ?? 32; }
}
function drawIronChest(ctx, e, gx, gy, dir, alpha) {
  drawChestBox(ctx, e, gx, gy, dir, alpha, CHEST_TIERS.iron, null);
}
function ironChestPanelHtml(e) {
  return chestDualPaneHtml(e, '铁箱', '铁箱：容量比木箱更大（32 格），由木箱升级而来。');
}
function ironChestPanelLive(e, api) {
  chestDualPaneLive(e, api);
}
function ironChestTip(e) {
  let n = 0;
  for (const s of e.slots) if (s) n += s.count;
  return n ? ('铁箱存货 ' + n + ' 个') : '空铁箱';
}
ENT_CLASSES['iron-chest'] = IronChest;
DEVICE_RENDER['iron-chest'] = drawIronChest;
DEVICE_DIR_ROTATE['iron-chest'] = true; // 支持旋转
DEVICE_PANEL['iron-chest'] = { html: ironChestPanelHtml, live: ironChestPanelLive, tip: ironChestTip, onAction: chestOnAction, onChange: chestOnChange };
