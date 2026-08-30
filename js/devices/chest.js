'use strict';

// ===== 储物箱：存物资，可设每种物品的存量上限 =====
// 继承 CircuitNode（CircuitNode 亦是 Entity 子类）：储物箱可接入电路网络，
// 把箱内每种物品的数量作为信号输出到所连网络，供组合器/机械臂/传送带等做逻辑控制
// （对齐《异星工厂》：储物箱可通过电路网络读取物品数量，实现按库存自动化）。
class Chest extends CircuitNode {
  constructor(type, x, y) {
    // 传入的 type 需透传给父类（Entity 用它设置 this.type）；不能写死 iron-chest，
    // 否则木箱/钢箱构造后 type 全变成铁箱，导致放置后渲染成铁箱。
    super(type, x, y);
    this.slots = [];
    this.limits = {};
  }
  // 槽位容量（木箱 16 / 铁箱 32 / 钢箱 24 等，各子类覆盖）
  slotCap() { return 12; }
  giveItem(item) {
    const cap = this.limits[item];
    if (cap !== undefined && this.countOf(item) >= cap) return false;
    for (const s of this.slots)
      if (s && s.item === item && s.count < stackSize(item)) { s.count++; return true; }
    if (this.slots.length >= this.slotCap()) return false;
    this.slots.push({ item, count: 1 });
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
        if (s.count <= 0) this.slots.splice(i, 1);
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
        if (st.count <= 0) this.slots.splice(i, 1);
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
    this.slots = [];
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
    c.slots = (s.slots || []).map(v => v ? { item: v[0], count: v[1] } : null);
    c.limits = {};
    for (const k in (s.limits || {})) if (s.limits[k] > 0) c.limits[k] = s.limits[k];
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
// 所有储物箱采用「双栏」布局：左栏=玩家背包，右栏=箱子物品，可双向移动物品。
// 左栏复用 htmlInventory()（与背包/配方设备一致：点击物品即选中，选中后可存入箱子）。
// 右栏为箱子内容：点击物品取出 1 件回背包；「存入选中物品」把当前选中的背包物品放入箱子。

// 右栏：箱子内容 + 操作
function chestRightHtml(e, typeName, capDesc) {
  const agg = {};
  for (const s of e.slots) if (s) agg[s.item] = (agg[s.item] || 0) + s.count;
  let h = '<div class="sec">箱子内容（点击物品取出 1 件回背包）</div>';
  h += '<div class="status"></div>';
  h += '<div class="chest-items" id="chest-items" data-live="chest-items">';
  const keys = Object.keys(agg);
  if (!keys.length) {
    h += '<div class="dim">空箱。先在左栏选中背包物品，再点下方「存入选中物品」，即可放入。</div>';
  } else {
    for (const id of keys) {
      h += itemSlotsHtml({ [id]: agg[id] }, { action: 'chest-take', tip: (k, n) => ITEMS[k].name + '|点击取出 1 件回背包（当前 ' + n + '）' });
    }
  }
  h += '</div>';
  // 存入选中物品
  h += '<div class="sec">存入</div>';
  h += '<button data-action="chest-put" class="btn sm" id="btn-chest-put" title="把当前选中的背包物品全部存入箱子（未选中时不可用）">⬆ 存入选中物品</button>';
  // 存量上限（每种物品）
  h += '<div class="sec">存量上限（每种物品）</div>';
  const ids = Object.keys(agg);
  for (const id in e.limits) if (!(id in agg)) ids.push(id);
  if (!ids.length) {
    h += '<div class="dim">空箱。放入物品后可为每种物品设置最大存量，达到上限后机械臂/手动均无法再存入。</div>';
  } else {
    for (const id of ids) {
      h += '<div class="limitrow">' + chip(id, agg[id]) +
        '<input class="limit-in" type="number" min="0" step="10" placeholder="不限" data-limit="' + id + '"' +
        ' value="' + (e.limits[id] || '') + '" data-tip="上限|该物品最大存量；留空或 0 表示不限制"></div>';
    }
    h += '<button data-action="limits-clear">清除所有上限</button>';
  }
  let total = 0;
  for (const k in agg) total += agg[k];
  if (total > 0) h += '<button data-action="takeout" id="btn-chest-takeout">取出全部 (' + total + ')</button>';
  h += '<div class="dim">' + capDesc + '</div>';
  return h;
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
  const agg = {};
  let total = 0;
  for (const s of e.slots) if (s) { agg[s.item] = (agg[s.item] || 0) + s.count; total += s.count; }
  const kinds = Object.keys(agg).length;
  // 更新右栏箱子内容网格
  const box = document.getElementById('chest-items');
  if (box) {
    if (!kinds) {
      box.innerHTML = '<div class="dim">空箱。先在左栏选中背包物品，再点下方「存入选中物品」，即可放入。</div>';
    } else {
      let h = '';
      for (const id of Object.keys(agg)) {
        h += itemSlotsHtml({ [id]: agg[id] }, { action: 'chest-take', tip: (k, n) => ITEMS[k].name + '|点击取出 1 件回背包（当前 ' + n + '）' });
      }
      box.innerHTML = h;
    }
  }
  api.toggle('#btn-chest-takeout', total > 0, '取出全部 (' + total + ')');
  const full = Object.keys(agg).filter(id => e.limits[id] !== undefined && agg[id] >= e.limits[id]);
  if (full.length) api.status('已满：' + full.map(id => ITEMS[id].name).join('、') + ' 达到上限，暂停收纳', 'warn');
  else if (total > 0) api.status('收纳中：' + kinds + ' 种，共 ' + total + ' 件', 'ok');
  else api.status('空箱：等待存入物品', 'ok');
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
  slotCap() { return 16; }
  giveItem(item) {
    const cap = this.limits[item];
    if (cap !== undefined && this.countOf(item) >= cap) return false;
    for (const s of this.slots)
      if (s && s.item === item && s.count < stackSize(item)) { s.count++; return true; }
    if (this.slots.length >= this.slotCap()) return false;
    this.slots.push({ item, count: 1 });
    return true;
  }
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
  slotCap() { return 32; }
  giveItem(item) {
    const cap = this.limits[item];
    if (cap !== undefined && this.countOf(item) >= cap) return false;
    for (const s of this.slots)
      if (s && s.item === item && s.count < stackSize(item)) { s.count++; return true; }
    if (this.slots.length >= this.slotCap()) return false;
    this.slots.push({ item, count: 1 });
    return true;
  }
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
