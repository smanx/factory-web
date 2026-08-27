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

// ===== 物品 dot 贴图缓存（P1 优化）=====
// 把每个物品的 dot 预渲染成一张小画布（含圆角底+描边+缩略物品图标），
// 后续直接 drawImage 整张 blit，替代每帧 clip+glyph 的昂贵路径绘制。
const ITEM_DOT_CACHE = {};
// 尺寸基准：r=5 的普通 dot
const ITEM_DOT_SIZE = 12;

function itemDotSprite(item) {
  let s = ITEM_DOT_CACHE[item];
  if (s) return s;
  const it = ITEMS[item];
  const c = document.createElement('canvas');
  c.width = c.height = ITEM_DOT_SIZE;
  const x = c.getContext('2d');
  const r = 5, cx = ITEM_DOT_SIZE / 2;
  x.fillStyle = '#20242b';
  rr(x, cx - r, cx - r, r * 2, r * 2, r * 0.55);
  x.fill();
  x.strokeStyle = it.color;
  x.lineWidth = Math.max(1, r * 0.16);
  x.stroke();
  x.save();
  rr(x, cx - r * 0.82, cx - r * 0.82, r * 1.64, r * 1.64, r * 0.42);
  x.clip();
  drawItemGlyph(x, item, cx, cx, r * 1.85);
  x.restore();
  ITEM_DOT_CACHE[item] = c;
  // 异步升级为 ImageBitmap（GPU 位图），成功后替换缓存，之后的帧直接 blit 位图
  if (typeof createImageBitmap === 'function') {
    try {
      createImageBitmap(c).then(bm => { ITEM_DOT_CACHE[item] = bm; });
    } catch (e) { /* 忽略，继续用画布 */ }
  }
  return c;
}

function drawItemDot(ctx, x, y, item, r = 5) {
  // 标准尺寸直接整张贴图（P1 优化：替代 clip+glyph）
  if (r === 5) {
    const sp = itemDotSprite(item);
    if (sp) {
      ctx.drawImage(sp, x - ITEM_DOT_SIZE / 2, y - ITEM_DOT_SIZE / 2);
      return;
    }
  }
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

// 配方图标：占据一整格面积的大图标（TILE×TILE），用于设备中央展示当前配方
function drawRecipeIconCell(ctx, x, y, item) {
  drawItemDot(ctx, x, y, item, Math.round(TILE * 0.46));
}

// 未选配方时的默认图标：一个中性的灰色齿轮占位（不再显示中文“无配方”）
function drawRecipePlaceholder(ctx, x, y, size) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = 'rgba(255,255,255,.38)';
  ctx.strokeStyle = 'rgba(255,255,255,.55)';
  ctx.lineWidth = 2;
  gearShape(ctx, 0, 0, (size || 26) * 0.42, (size || 26) * 0.3, 7);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

// 设备内部管道口统一显示（机械套管口）：法兰底座→法兰顶面→彩色端口内孔→内孔凹槽描边→顶部高光弧。
// 端口"内孔"填充传入的 color（水蓝/蒸汽白/输入绿/输出橙红/油气黄），一眼区分进出类型；ALT 详情时在内孔上叠加流体图标。
// side 0东1南2西3北；(cx,cy)=实体中心像素；dist=中心到该边距离；
// off=沿边偏移（±0.5 为半格）；fluid=端口允许的流体（ALT 时画图标）；flow=流向
function drawPort(ctx, cx, cy, side, color, arrow, off, dist, fluid, flow) {
  if (!dist) dist = TILE;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(side * Math.PI / 2);
  if (off) ctx.translate(0, off * TILE);
  const pcx = dist - 9;              // 套管口中心（设备内部边缘）
  // ① 法兰底座（凸缘盘，外缘描边）
  ctx.fillStyle = '#454b54';
  ctx.beginPath(); ctx.arc(pcx, 0, 7.2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.45)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(pcx, 0, 7.2, 0, Math.PI * 2); ctx.stroke();
  // ② 法兰顶面（颈部倒角，营造立体层次）
  ctx.fillStyle = '#636c78';
  ctx.beginPath(); ctx.arc(pcx, 0, 5.8, 0, Math.PI * 2); ctx.fill();
  // ③ 端口内孔（填充真实端口类型色）
  ctx.fillStyle = color || '#5b636e';
  ctx.beginPath(); ctx.arc(pcx, 0, 4.2, 0, Math.PI * 2); ctx.fill();
  // ④ 内孔凹槽描边（制造开口凹陷感）
  ctx.strokeStyle = 'rgba(0,0,0,.35)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(pcx, 0, 4.2, 0, Math.PI * 2); ctx.stroke();
  // ⑤ 顶部高光弧（金属反光质感）
  ctx.strokeStyle = 'rgba(255,255,255,.38)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(pcx, 0, 5.8 - 0.6, -Math.PI * 1.05, -Math.PI * 0.62); ctx.stroke();
  // ALT 详情：在内孔上叠加流体图标，并在旁边用小蓝色箭头标注流向
  if (portDetailsVisible()) {
    if (fluid && ITEMS[fluid]) drawItemGlyph(ctx, fluid, pcx, 0, 6.5);
    const blue = '#4aa4ff';
    const f = flow || (arrow ? 'out' : 'both');   // 兼容：未显式给流向时按 arrow 推断
    const aD = 7.5;                               // 箭头中心相对内孔中心的距离
    const aS = 0.9;                               // 箭头缩放
    if (f === 'both') {
      drawFlowArrow(ctx, pcx + aD, 0, false, blue, aS);   // 指向设备外
      drawFlowArrow(ctx, pcx - aD, 0, true, blue, aS);    // 指向设备内
    } else if (f === 'out') {
      drawFlowArrow(ctx, pcx + aD, 0, false, blue, aS);   // 指向设备外
    } else if (f === 'in') {
      drawFlowArrow(ctx, pcx - aD, 0, true, blue, aS);    // 指向设备内
    }
  }
  ctx.restore();
}

// 小蓝色流向箭头：inward=true 指向设备内，false 指向设备外；scale 可选缩放（默认 1）
function drawFlowArrow(ctx, x, y, inward, blue, scale) {
  ctx.fillStyle = blue;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(inward ? Math.PI : 0);
  if (scale) ctx.scale(scale, scale);
  ctx.beginPath();
  ctx.moveTo(3.4, 0);
  ctx.lineTo(-2.4, -2.6);
  ctx.lineTo(-2.4, 2.6);
  ctx.closePath();
  ctx.fill();
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
  // 低 LOD 时省略流体口凸缘与标注（缩放太小看不清）
  if (LOD && LOD.simple) return;
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
// ports: [{ side, color, arrow, off, fluid, flow }]，side 为 dir=0 时的基准方向（0东1南2西3北）；
// 实际绘制方向 = (side + dir) % 4。
function drawRotatablePorts(ctx, e, px, py, s, ports) {
  const cxp = px + s / 2, cyp = py + s / 2, half = s / 2;
  const dir = e.dir | 0;
  // 低 LOD 时省略端口凸缘（缩放太小看不清）
  if (LOD && LOD.simple) return;
  for (const p of ports) {
    const sd = (p.side + dir) % 4;
    const fluid = (typeof p.fluid === 'function') ? p.fluid(e) : p.fluid;
    drawPort(ctx, cxp, cyp, sd, p.color, p.arrow, p.off, half, fluid, p.flow);
  }
}

// 是否显示管道口详情（流体图标 + 流向箭头）：对齐《异星工厂》ALT 模式，按 ALT 切换
function portDetailsVisible() {
  return !!(G && G.settings.altMode !== false);
}

// 是否显示流体接口用途标签（跟随 ALT 详情模式）
function portLabelVisible() {
  return portDetailsVisible();
}

// 计算设备某流体接口图标所在的世界格坐标（用于鼠标悬停显示流体名称）。
// side 为 dir=0 时的基准方向（0东1南2西3北），cell 为沿边 0 基格号；方向随 dir 旋转。
// 图标画在设备内部靠近该边、落在该接口所在格内，故格坐标即沿边该格的内部格。
function fluidIconCell(e, side, cell) {
  const sd = (side + (e.dir | 0)) % 4;
  if (sd === 3) return [e.x + cell, e.y];
  if (sd === 1) return [e.x + cell, e.y + e.h - 1];
  if (sd === 0) return [e.x + e.w - 1, e.y + cell];
  return [e.x, e.y + cell];
}

// 计算 drawPort 端口（围绕实体内标定中心像素 (pcx,pcy)，side=最终世界方向 0东1南2西3北，
// off/dist 与 drawPort 同源：off 为沿边瓦片偏移、dist 为到边像素距离）所在的世界格坐标。
// 与 drawPort 内部的 rotate+translate 数学一致，供鼠标悬停显示该端口允许的流体名称。
function portCenterCell(e, pcx, pcy, side, off, dist) {
  const dx0 = (dist || TILE) - 9;        // drawPort 中 pcx = dist - 9
  const dy0 = (off || 0) * TILE;
  let ox, oy;
  switch (((side % 4) + 4) % 4) {
    case 0: ox = dx0; oy = dy0; break;   // 东
    case 1: ox = -dy0; oy = dx0; break;  // 南
    case 2: ox = -dx0; oy = -dy0; break; // 西
    default: ox = dy0; oy = -dx0; break; // 北
  }
  return [Math.floor((pcx + ox) / TILE), Math.floor((pcy + oy) / TILE)];
}

// 小型配方流体设备通用图标：输入口在背部 (dir+2)%4、输出口在前方 dir（与各自 drawXxx 一致）。
// 流体取自 e.fluidRecipe() 的 fin[0]/fout[0]；仅当对应流体非空时才登记该端口。
function fluidIconFinFout(e, pcx, pcy) {
  const fr = e.fluidRecipe ? e.fluidRecipe() : null;
  const dir = e.dir | 0;
  const fin = (fr && fr.fin.length) ? fr.fin[0] : null;
  const fout = (fr && fr.fout.length) ? fr.fout[0] : null;
  const icons = [];
  if (fin) {
    const c = portCenterCell(e, pcx, pcy, (dir + 2) % 4, 0, TILE);
    icons.push({ x: c[0], y: c[1], fluid: fin });
  }
  if (fout) {
    const c = portCenterCell(e, pcx, pcy, dir, 0, TILE);
    icons.push({ x: c[0], y: c[1], fluid: fout });
  }
  return icons;
}

// 返回设备某条边(side，dir=0 基准方向，随 dir 旋转)上第 cell 个格子外侧相邻的“世界格坐标”。
// 与 neighborOnSideCell 语义一致，但返回格子坐标（而非实体左上角），供储液罐等大实体判断是否命中设备流体口。
function sideNeighborCell(e, side, cell) {
  const sd = (side + (e.dir | 0)) % 4;
  let bx, by;
  if (sd === 3) { bx = e.x; by = e.y - 1; }        // 北
  else if (sd === 1) { bx = e.x; by = e.y + e.h; } // 南
  else if (sd === 0) { bx = e.x + e.w; by = e.y; } // 东
  else { bx = e.x - 1; by = e.y; }                 // 西
  return (sd === 1 || sd === 3) ? [bx + cell, by] : [bx, by + cell];
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
