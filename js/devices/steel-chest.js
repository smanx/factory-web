'use strict';

// ===== 钢箱：比储物箱容量更大的钢铁储物箱（对齐《异星工厂》Steel chest，占地 1×1）=====
class SteelChest extends Chest {
  constructor(type, x, y) { super('steel-chest', x, y); }
  slotCap() { return 24; }
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

// ===== 渲染（钢箱：厚重深钢灰 + 双加强筋，复用 chest.js 的统一箱子渲染）=====
function drawSteelChest(ctx, e, gx, gy, dir, alpha) {
  drawChestBox(ctx, e, gx, gy, dir, alpha, CHEST_TIERS.steel, null);
}

// ===== 面板：复用储物箱面板（含存量上限），仅文案标注钢箱=====
function steelChestPanelHtml(e) {
  return chestDualPaneHtml(e, '钢箱', '钢箱：容量为储物箱的两倍（24 格），配合机械臂可做大容量缓冲仓库。');
}
function steelChestPanelLive(e, api) {
  chestDualPaneLive(e, api);
}
function steelChestTip(e) {
  let n = 0, k = 0;
  for (const s of e.slots) if (s) { n += s.count; k++; }
  return k ? ('钢箱存货 ' + n + ' 个（' + k + ' 种）') : '空钢箱';
}

// ===== 注册 =====
ENT_CLASSES['steel-chest'] = SteelChest;
DEVICE_RENDER['steel-chest'] = drawSteelChest;
DEVICE_DIR_ROTATE['steel-chest'] = true; // 支持旋转
DEVICE_PANEL['steel-chest'] = { html: steelChestPanelHtml, live: steelChestPanelLive, tip: steelChestTip, onAction: chestOnAction, onChange: chestOnChange };
