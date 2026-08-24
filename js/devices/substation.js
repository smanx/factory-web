'use strict';

// ===== 变电站 Substation（对齐《异星工厂》Substation，4×4）=====
// 超大型电线杆：既是电力节点也是电路网络节点，覆盖范围远大于普通电线杆。
// 用于跨区域组网、为大片基地统一供电与电路信号。
const SUBSTATION_RANGE = 18;   // 变电站连接距离（格，远大于大型电线杆 15）

class Substation extends CircuitNode {
  constructor(type, x, y) {
    super(type || 'substation', x, y);
  }
  get range() { return SUBSTATION_RANGE; }
  contents() { return [[this.type, 1]]; }
}

// ===== 渲染：变电站（比大型电线杆更大、更复杂的杆塔）=====
function drawSubstation(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w, sh = TILE * e.h;
  ctx.globalAlpha = alpha;
  // 水泥底座
  ctx.fillStyle = '#3a3a34';
  rr(ctx, px + 6, py + 6, s - 12, sh - 12, 10); ctx.fill();
  ctx.strokeStyle = '#2a2a24';
  ctx.lineWidth = 2;
  rr(ctx, px + 6, py + 6, s - 12, sh - 12, 10); ctx.stroke();
  // 高架杆塔（十字塔身）
  ctx.fillStyle = '#b0802a';
  rr(ctx, px + s / 2 - 5, py + sh - 34, 10, 28, 3); ctx.fill();
  ctx.fillStyle = '#8a6220';
  ctx.fillRect(px + s / 2 - 12, py + sh - 30, 24, 4);   // 横担
  ctx.fillRect(px + s / 2 - 9, py + sh - 44, 18, 4);
  ctx.fillRect(px + s / 2 - 5, py + sh - 52, 10, 12);
  // 顶部接线器 + 红绿指示灯
  ctx.fillStyle = '#8a6220';
  rr(ctx, px + s / 2 - 8, py + 6, 16, 6, 2); ctx.fill();
  ctx.fillStyle = '#e05a4a'; ctx.beginPath(); ctx.arc(px + s / 2 - 4, py + 9, 2.4, 0, 7); ctx.fill();
  ctx.fillStyle = '#5ae06a'; ctx.beginPath(); ctx.arc(px + s / 2 + 4, py + 9, 2.4, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;
  drawCircuitWires(ctx, e);
}

// ===== 面板 =====
function substationPanelHtml() {
  return '<div class="dim">变电站：超大型电线杆，同时连接电力与电路网络，覆盖范围达 ' + SUBSTATION_RANGE +
    ' 格，用于跨区域组网、为大片基地统一供电与信号（4×4，需电路网络科技）。</div><div class="status"></div>';
}
function substationPanelLive(e, api) {
  const conn = (e.red && e.red.size) || 0;
  api.status(conn > 0 ? ('已组网：连接 ' + conn + ' 个节点') : '未连接其它节点', conn > 0 ? 'ok' : 'warn');
}
function substationTip(e) {
  const conn = (e.red && e.red.size) || 0;
  return '变电站：连接范围 ' + SUBSTATION_RANGE + ' 格，' + (conn > 0 ? '已连接 ' + conn + ' 个节点' : '未连接节点');
}

// ===== 注册 =====
const substationPanel = { html: substationPanelHtml, live: substationPanelLive, tip: substationTip };
ENT_CLASSES['substation'] = Substation;
DEVICE_RENDER['substation'] = drawSubstation;
DEVICE_STATUS['substation'] = e => (e.red && e.red.size) ? 'g' : 'y';
DEVICE_PANEL['substation'] = substationPanel;
