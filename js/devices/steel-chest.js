'use strict';

// ===== 钢箱：比储物箱容量更大的钢铁储物箱（对齐《异星工厂》Steel chest，占地 1×1）=====
class SteelChest extends Chest {
  constructor(type, x, y) { super('steel-chest', x, y); }
  giveItem(item) {
    const cap = this.limits[item];
    if (cap !== undefined && this.countOf(item) >= cap) return false;
    for (const s of this.slots)
      if (s && s.item === item && s.count < stackSize(item)) { s.count++; return true; }
    if (this.slots.length >= 24) return false;
    this.slots.push({ item, count: 1 });
    return true;
  }
}

// ===== 渲染（钢箱：金属灰蓝配色）=====
function drawSteelChest(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#6f7884';
  rr(ctx, px + 4, py + 8, TILE - 8, TILE - 13, 3); ctx.fill();
  ctx.fillStyle = '#8792a0';
  rr(ctx, px + 4, py + 5, TILE - 8, 10, 3); ctx.fill();
  ctx.strokeStyle = '#434b57';
  ctx.lineWidth = 1.5;
  rr(ctx, px + 4, py + 8, TILE - 8, TILE - 13, 3); ctx.stroke();
  ctx.fillStyle = '#b8c4d2';
  ctx.fillRect(px + TILE / 2 - 2, py + 12, 4, 6);
  ctx.globalAlpha = 1;
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
