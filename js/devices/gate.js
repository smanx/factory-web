'use strict';

// ===== 门 Gate（对齐《异星工厂》Gate）=====
// 1×1 可开合入口：玩家靠近（1 格内）自动打开（变可通行），离开自动关闭。
// 敌人无法通过。与石墙搭配构建防线。需「军事工程」科技解锁。

// 检测玩家是否在门附近（1 格曼哈顿距离内视为需要开门）
function gateOpen(e) {
  if (!G.player) return false;
  const pcx = Math.floor(G.player.x / TILE), pcy = Math.floor(G.player.y / TILE);
  // 门中心
  const gcx = e.x + 0.5, gcy = e.y + 0.5;
  // 玩家占据一格，考虑碰撞宽容：玩家身体或与门同一格/相邻格即开门
  return Math.abs(pcx - gcx) <= 1 && Math.abs(pcy - gcy) <= 1;
}

class Gate extends Entity {
  constructor(type, x, y) { super('gate', x, y); }
  // 门在玩家靠近时变为可通行（solid=false），否则为实心障碍
  get solid() { return !gateOpen(this); }
}

function drawGate(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const open = gateOpen(e);
  ctx.globalAlpha = alpha;
  if (open) {
    // 打开状态：左右两扇滑开的门板
    ctx.fillStyle = '#6a6458';
    ctx.fillRect(px + 2, py + 6, TILE / 2 - 4, TILE - 12);
    ctx.fillRect(px + TILE / 2 + 2, py + 6, TILE / 2 - 4, TILE - 12);
    ctx.strokeStyle = '#4c463a';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 2, py + 6, TILE / 2 - 4, TILE - 12);
    ctx.strokeRect(px + TILE / 2 + 2, py + 6, TILE / 2 - 4, TILE - 12);
    // 顶部/底部门框
    ctx.fillStyle = '#7a7468';
    ctx.fillRect(px + 1, py + 1, TILE - 2, 5);
    ctx.fillRect(px + 1, py + TILE - 6, TILE - 2, 5);
  } else {
    // 关闭状态：整体实心墙板，中间有门缝
    ctx.fillStyle = '#8d8578';
    rr(ctx, px + 3, py + 3, TILE - 6, TILE - 6, 4); ctx.fill();
    ctx.strokeStyle = '#5c5649';
    ctx.lineWidth = 2;
    rr(ctx, px + 3, py + 3, TILE - 6, TILE - 6, 4); ctx.stroke();
    ctx.fillStyle = '#6a6458';
    ctx.fillRect(px + TILE / 2 - 3, py + 4, 6, TILE - 8);   // 中缝门板
    ctx.strokeStyle = '#4c463a';
    ctx.strokeRect(px + TILE / 2 - 3, py + 4, 6, TILE - 8);
    // 门把手
    ctx.fillStyle = '#c9b84a';
    ctx.fillRect(px + TILE / 2 + 3, py + TILE / 2 - 2, 3, 4);
  }
  ctx.globalAlpha = 1;
}
function gatePanelHtml() {
  return '<div class="dim">门：可开合的入口，玩家靠近自动打开、离开自动关闭；敌人无法通过。与石墙搭配构成可进出的防线（1×1）。</div>';
}
function gatePanelLive(e, api) {
  api.status(gateOpen(e) ? '已打开（可通行）' : '已关闭（阻挡通行）', gateOpen(e) ? 'g' : 'r');
}
function gateTip(e) { return gateOpen(e) ? '门（已打开）' : '门（已关闭）'; }
const gatePanel = { html: gatePanelHtml, live: gatePanelLive, tip: gateTip };

// ===== 注册 =====
ENT_CLASSES['gate'] = Gate;
DEVICE_RENDER['gate'] = drawGate;
DEVICE_DIR_ROTATE['gate'] = true; // 支持旋转
DEVICE_STATUS['gate'] = e => gateOpen(e) ? 'g' : 'r';
DEVICE_PANEL['gate'] = gatePanel;
