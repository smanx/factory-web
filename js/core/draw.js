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

// 配方图标精灵缓存：每个物品一张 TILE×TILE 画布，缓存图标本体（铺满整格），供光晕绘制复用。
const RECIPE_SPRITES = {};
function recipeSprite(id) {
  let sp = RECIPE_SPRITES[id];
  if (sp) return sp;
  const c = document.createElement('canvas');
  c.width = c.height = TILE;
  const g = c.getContext('2d');
  g.save();
  g.beginPath();
  g.rect(0, 0, TILE, TILE);
  g.clip();
  drawItemGlyph(g, id, TILE / 2, TILE / 2, TILE * 1.12);
  g.restore();
  RECIPE_SPRITES[id] = c;
  return c;
}

// 配方图标：只绘制配方图标本体并铺满整个格子（TILE×TILE），不绘制背景等额外效果。
// 借助 canvas 阴影（shadowBlur）让黑色阴影从图标四周向外柔和散发，而不是描边边框。
function drawRecipeIconCell(ctx, x, y, item) {
  if (!ITEMS[item]) return;
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,1)';
  ctx.shadowBlur = 20;
  const spr = recipeSprite(item);
  // 双层叠加阴影，让黑色光晕更深更明显
  ctx.drawImage(spr, x - TILE / 2, y - TILE / 2, TILE, TILE);
  ctx.drawImage(spr, x - TILE / 2, y - TILE / 2, TILE, TILE);
  // 无阴影重绘一次，保持图标本体清晰
  ctx.shadowBlur = 0;
  ctx.drawImage(spr, x - TILE / 2, y - TILE / 2, TILE, TILE);
  ctx.restore();
}

// 设备内部管道口统一显示（机械套管口）：法兰底座→法兰顶面→彩色端口内孔→内孔凹槽描边→顶部高光弧。
// 端口"内孔"填充传入的 color（水蓝/蒸汽白/输入绿/输出橙红/油气黄），一眼区分进出类型；ALT 详情时在内孔上叠加流体图标。
// side 0东1南2西3北；(cx,cy)=实体中心像素；dist=中心到该边距离；
// off=沿边偏移（±0.5 为半格）；fluid=端口允许的流体（ALT 时画图标）；flow=流向；
// forceSymbol=true 时即使 fluid 为空也显示 ALT 符号（用于储液罐等 "端口恒可用、流体随内容变化" 的设备，避免空罐时误隐藏）
function drawPort(ctx, cx, cy, side, color, arrow, off, dist, fluid, flow, forceSymbol) {
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
  // ALT 详情：仅当接口被当前使用（fluid 有效，或 forceSymbol 强调恒可用）时，
  // 才在内孔上叠加流体图标，并在旁边用小蓝色箭头标注流向。
  // 未使用的接口（如选择配方但未用到该管道口）不画箭头。
  if (portDetailsVisible() && (forceSymbol || (fluid && ITEMS[fluid]))) {
    const blue = '#4aa4ff';
    const f = flow || (arrow ? 'out' : 'both');   // 兼容：未显式给流向时按 arrow 推断
    // 流体图标（若有）：放大到背包同尺寸（32px）并整体内移，外沿不越过设备边界
    let aPos;                                     // 箭头所在位置（管道口一侧）
    if (fluid && ITEMS[fluid]) {
      const iconR = 16;                           // 半径 = 32/2（对齐背包一格图标大小）
      const icx = Math.min(pcx, dist - iconR);    // 向内收缩，避免图标画出设备外
      drawItemGlyph(ctx, fluid, icx, 0, iconR * 2);
      aPos = icx + iconR + 3.5;                   // 挨着管道口（图标外缘外 3.5px）
    } else {
      aPos = pcx + 3.5;                           // 无图标（空储液罐 forceSymbol）：挨着端口外缘
    }
    // 流向箭头：只显示在管道口一侧，且不在此处直接绘制——延迟到渲染末段
    // flushPortArrowOverlay 统一绘制，确保盖在相邻管道之上、不被遮挡。
    // 单向画一支（指向流动方向）；双向上下紧贴画两支更小的（一进一出，合计约等于单个箭头大小）。
    const aS = 2;                                 // 单向箭头缩放（基形 8×4 放大一倍 → 16×8）
    const aS2 = 1;                                // 双向各支更小：两支合计约等于单个箭头大小
    const sOff = 4.4;                             // 双向两支垂直间距（上下紧贴）
    if (f === 'both') {
      queuePortArrow(cx, cy, side, off, aPos, -sOff, true, blue, aS2);   // 上：进设备
      queuePortArrow(cx, cy, side, off, aPos, sOff, false, blue, aS2);   // 下：出设备
    } else if (f === 'out') {
      queuePortArrow(cx, cy, side, off, aPos, 0, false, blue, aS);       // 出设备
    } else if (f === 'in') {
      queuePortArrow(cx, cy, side, off, aPos, 0, true, blue, aS);        // 进设备
    }
  }
  ctx.restore();
}

// ===== 管道口流向箭头：延迟到渲染末段统一绘制（盖在相邻管道之上，避免被管道遮挡）=====
// drawPort 只把箭头（世界坐标 + 朝向角）记入队列，渲染末段 flushPortArrowOverlay 再统一绘制；
// 这样箭头永远显示在管道等实体之上。
let _portArrowQueue = [];
// 记录一支流向箭头：anchor=(cx,cy)、side 为端口方向(0东1南2西3北)、off 为沿边偏移(格)、
// aPos 为沿外向轴的偏移、yOff 为沿边(垂直)偏移、inward=true 指向设备内、scale 为缩放。
function queuePortArrow(cx, cy, side, off, aPos, yOff, inward, color, scale) {
  const θ = side * Math.PI / 2;
  const c = Math.cos(θ), s = Math.sin(θ);
  const ey = yOff + (off ? off * TILE : 0);
  _portArrowQueue.push({
    x: cx + aPos * c - ey * s,
    y: cy + aPos * s + ey * c,
    angle: θ + (inward ? Math.PI : 0),
    color, scale
  });
}
// 每帧开始前清空队列（丢弃上一帧幽灵等后置绘制残留的箭头）
function clearPortArrowQueue() { _portArrowQueue.length = 0; }
// 渲染末段（实体/管道绘制之后）统一绘制箭头并清空队列：保证箭头盖在管道上层
function flushPortArrowOverlay(ctx) {
  for (let i = 0; i < _portArrowQueue.length; i++) {
    const a = _portArrowQueue[i];
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.rotate(a.angle);
    if (a.scale) ctx.scale(a.scale, a.scale);
    ctx.fillStyle = a.color;
    // 矮胖三角形：底部长度 = 管道口宽度(8px)，箭头方向高度 = 半管道宽(4px)
    ctx.beginPath();
    ctx.moveTo(2, 0);       // 尖端（高度 4 = 尖端 2 + 后边 2）
    ctx.lineTo(-2, -4);     // 左后角（底边全长 8）
    ctx.lineTo(-2, 4);      // 右后角
    ctx.closePath();
    ctx.fill();
    // 和谐边框：比三角形颜色稍深的细蓝色描边（宽度约为原 1/4，保底可见），轮廓清晰
    ctx.strokeStyle = '#2a6fc4';
    ctx.lineWidth = Math.max(0.4, 0.15 * (a.scale || 1));
    ctx.stroke();
    ctx.restore();
  }
  _portArrowQueue.length = 0;
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
// ports: [{ side, color, arrow, off, fluid, flow, forceSymbol }]，side 为 dir=0 时的基准方向（0东1南2西3北）；
// 实际绘制方向 = (side + dir) % 4。
function drawRotatablePorts(ctx, e, px, py, s, ports) {
  const cxp = px + s / 2, cyp = py + s / 2, half = s / 2;
  const dir = e.dir | 0;
  // 低 LOD 时省略端口凸缘（缩放太小看不清）
  if (LOD && LOD.simple) return;
  for (const p of ports) {
    let sd = (p.side + dir) % 4, off = p.off;
    // 镜像手性：在基准边局部坐标系反射（水平边沿格偏移 off 取反、竖直边东西互换）后再随 dir 旋转，
    // 与 sideNeighborCell / fluidIconCell / neighborOnSideCell 的反射规则一致，端口凸缘与逻辑落点吻合。
    if (e.mirror) {
      if (p.side === 1 || p.side === 3) off = -off;
      else sd = ((p.side === 0 ? 2 : 0) + dir) % 4;
    }
    const fluid = (typeof p.fluid === 'function') ? p.fluid(e) : p.fluid;
    drawPort(ctx, cxp, cyp, sd, p.color, p.arrow, off, half, fluid, p.flow, p.forceSymbol);
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
// side 为 dir=0 基准方向，cell 为沿边 0 基格号；图标落在设备内部靠该边的格内。
// 与 sideNeighborCell 同源：还原局部内格坐标后交给 rotCell（镜像反射 + dir 旋转），保证任意朝向一致。
function fluidIconCell(e, side, cell) {
  const w0 = e.def.w, h0 = e.def.h;
  let lx, ly;
  if (side === 3) { lx = cell; ly = 0; }
  else if (side === 1) { lx = cell; ly = h0 - 1; }
  else if (side === 0) { lx = w0 - 1; ly = cell; }
  else { lx = 0; ly = cell; }
  const c = rotCell(e, lx, ly);
  return [c.x, c.y];
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

// 返回设备某条边(side，dir=0 基准方向)上第 cell 个格子外侧相邻的“世界格坐标”。
// 统一用 rotCell 计算：先把 (side,cell) 还原为 dir=0 局部坐标，再由 rotCell 施加「镜像反射局部 x + 随 dir 旋转」，
// 与本体渲染 ctx.rotate(dir)·ctx.scale(mirror) 的 R(dir)·S 变换严格一致（旧版手算分解在 dir≠0 时会多一次左右翻）。
function sideNeighborCell(e, side, cell) {
  const w0 = e.def.w, h0 = e.def.h;
  let lx, ly;
  if (side === 3) { lx = cell; ly = -1; }
  else if (side === 1) { lx = cell; ly = h0; }
  else if (side === 0) { lx = w0; ly = cell; }
  else { lx = -1; ly = cell; }
  const c = rotCell(e, lx, ly);
  return [c.x, c.y];
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
