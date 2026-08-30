'use strict';

// ===== 钢箱：比储物箱容量更大的钢铁储物箱（对齐《异星工厂》Steel chest，占地 1×1）=====
// 官方 inventory_size=48 格（此前误写 24，已由 GAME_DATA.containerSizes 单源校正）。
class SteelChest extends Chest {
  constructor(type, x, y) { super('steel-chest', x, y); }
  slotCap() { return GAME_DATA.containerSizes?.['steel-chest'] ?? 48; }
}

// ===== 渲染（钢箱：厚重深钢灰 + 双加强筋，复用 chest.js 的统一箱子渲染）=====
function drawSteelChest(ctx, e, gx, gy, dir, alpha) {
  drawChestBox(ctx, e, gx, gy, dir, alpha, CHEST_TIERS.steel, null);
}

// ===== 面板：复用储物箱面板（含存量上限），仅文案标注钢箱=====
function steelChestPanelHtml(e) {
  return chestDualPaneHtml(e, '钢箱', '钢箱：大容量钢铁储物箱（48 格，官方 Steel chest），配合机械臂可做大容量缓冲仓库。');
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
