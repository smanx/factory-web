'use strict';

// ===== 共享画笔助手（各设备渲染函数共用）=====
function rr(x, px, py, w, h, r) {
  x.beginPath();
  x.moveTo(px + r, py);
  x.arcTo(px + w, py, px + w, py + h, r);
  x.arcTo(px + w, py + h, px, py + h, r);
  x.arcTo(px, py + h, px, py, r);
  x.arcTo(px, py, px + w, py, r);
  x.closePath();
  return x;
}

function tri(x, x1, y1, x2, y2, x3, y3) {
  x.beginPath();
  x.moveTo(x1, y1); x.lineTo(x2, y2); x.lineTo(x3, y3);
  x.closePath();
  return x;
}

function gearShape(x, cx, cy, rOuter, rInner, teeth) {
  x.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const rad = i % 2 === 0 ? rOuter : rInner;
    const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
    if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
  }
  x.closePath();
  x.moveTo(cx + rInner * 0.45, cy);
  x.arc(cx, cy, rInner * 0.45, 0, Math.PI * 2);
}

function dirColorNotch(dir) {
  return ['#d05548', '#d0a048', '#48a8d0', '#68c860'][dir];
}

function notch(ctx, px, py, dir) {
  const cx = px + TILE / 2, cy = py + TILE / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(dir * Math.PI / 2);
  ctx.beginPath();
  ctx.moveTo(TILE / 2 - 8, -5);
  ctx.lineTo(TILE / 2 - 2, 0);
  ctx.lineTo(TILE / 2 - 8, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawItemDot(ctx, x, y, item, r = 5) {
  const it = ITEMS[item];
  ctx.fillStyle = '#20242b';
  rr(ctx, x - r, y - r, r * 2, r * 2, r * 0.55);
  ctx.fill();
  ctx.strokeStyle = it.color;
  ctx.lineWidth = Math.max(1, r * 0.16);
  ctx.stroke();
  ctx.save();
  rr(ctx, x - r * 0.82, y - r * 0.82, r * 1.64, r * 1.64, r * 0.42);
  ctx.clip();
  drawItemGlyph(ctx, item, x, y, r * 1.85);
  ctx.restore();
}

function drawItemDotBig(ctx, x, y, item) {
  drawItemDot(ctx, x, y, item, 7);
}

// 流体端口凸缘：side 0东1南2西3北；(cx,cy)=实体中心像素；dist=中心到该边距离；
// off=沿边偏移（±0.5 为半格）；arrow=出流方向箭头
function drawPort(ctx, cx, cy, side, color, arrow, off, dist) {
  if (!dist) dist = TILE;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(side * Math.PI / 2);
  if (off) ctx.translate(0, off * TILE);
  ctx.fillStyle = '#20242b';
  rr(ctx, dist - 9, -7, 10, 14, 3); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.4)';
  ctx.lineWidth = 1.5;
  rr(ctx, dist - 9, -7, 10, 14, 3); ctx.stroke();
  ctx.fillStyle = color;
  rr(ctx, dist - 7, -4.5, 6.5, 9, 2); ctx.fill();
  if (arrow) {
    ctx.fillStyle = color;
    tri(ctx, dist - 13, -5, dist - 13, 5, dist - 20, 0);
    ctx.fill();
  }
  ctx.restore();
}

const PORT_WATER = '#3fa0e8';
const PORT_STEAM = '#dfe8ee';
// 油气通用流体口颜色（炼油厂 / 化工厂）
const PORT_FLUID = '#c9a84a';
// 流体进出口专用颜色：入口用绿色，出口用橙红
const PORT_INPUT = '#5fd45f';
const PORT_OUTPUT = '#e07b4a';
// 在设备四周画流体接口凸缘并标注文字，指示可接管道的位置与进出方向
function drawFluidPorts(ctx, e, px, py, s, { inputs, outputs }) {
  const cxp = px + s / 2, cyp = py + s / 2, half = s / 2;
  // 四边各画一只通用流体口凸缘（可接管道，双向进/出）
  for (let sd = 0; sd < 4; sd++) drawPort(ctx, cxp, cyp, sd, PORT_FLUID, false, 0, half);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 12px system-ui';
  const label = (t, x, y, c) => {
    ctx.fillStyle = 'rgba(0,0,0,.55)';
    ctx.fillText(t, x + 1, y + 1);
    ctx.fillStyle = c || '#ffe9c4';
    ctx.fillText(t, x, y);
  };
  // 顶部：输入标注
  if (inputs) label('⬆ 进：' + inputs, cxp, py + 18, '#a8e0a8');
  // 底部：输出标注
  if (outputs) label('出：' + outputs + ' ⬇', cxp, py + s - 30, '#ffd9a0');
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

// 旋转流体设备：端口位置随 dir 一起旋转。
// ports: [{ side, color, arrow }]，side 为 dir=0 时的基准方向（0东1南2西3北）；
// 实际绘制方向 = (side + dir) % 4。
function drawRotatablePorts(ctx, e, px, py, s, ports) {
  const cxp = px + s / 2, cyp = py + s / 2, half = s / 2;
  const dir = e.dir | 0;
  for (const p of ports) {
    const sd = (p.side + dir) % 4;
    drawPort(ctx, cxp, cyp, sd, p.color, p.arrow, p.off, half);
  }
}

// 是否显示流体接口用途标签（对齐《异星工厂》：默认隐藏，按住 Alt 键显示）
function portLabelVisible() {
  return !!(G && G.keys && G.keys['alt']);
}

// 围绕中心画一个指向某方向的箭头标签（用于进出方向提示）
function drawPortLabel(ctx, px, py, s, side, text, color) {
  ctx.save();
  ctx.translate(px + s / 2, py + s / 2);
  ctx.rotate(side * Math.PI / 2);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = 'bold 12px system-ui';
  ctx.fillStyle = 'rgba(0,0,0,.55)';
  ctx.fillText(text, 1, -s * 0.5 + 16);
  ctx.fillStyle = color || '#ffe9c4';
  ctx.fillText(text, 0, -s * 0.5 + 15);
  ctx.restore();
}
