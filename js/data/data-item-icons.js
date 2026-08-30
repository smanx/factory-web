'use strict';

// ===== 专属物品图标（手绘 canvas 绘制函数）=====
// 命中本表的物品在 drawItemGlyph（data-util.js）中优先使用专属绘制，跳过 emoji 兜底。
// 设计进度记录见 docs/item-icons-todo.md（每完成一项勾选对应条目）。
// 绘制约定：坐标系原点在图标中心，r = 图标半径（s/2），col = ITEMS[id].color，
// 可用工具：rrPath / lightenColor / darkenColor / dark（深色描边）。

// ===== 模块类图标共享绘制工具（速度/产能/效率/品质模块通用骨架） =====
// 电路板基板：圆角方板 + 四角螺丝 + 内框走线 + 底部引脚
function _moduleBase(x, r, s, col) {
  // 引脚（底部金属脚）
  x.fillStyle = '#8a8f96';
  for (let i = 0; i < 4; i++) {
    x.fillRect(-r * 0.6 + i * r * 0.4, r * 0.78, r * 0.16, r * 0.2);
  }
  // 基板
  const g = x.createLinearGradient(-r * 0.75, -r * 0.75, r * 0.75, r * 0.75);
  g.addColorStop(0, lightenColor(col, 0.3));
  g.addColorStop(0.55, col);
  g.addColorStop(1, darkenColor(col, 0.45));
  x.fillStyle = g;
  rrPath(x, -r * 0.75, -r * 0.78, r * 1.5, r * 1.56, r * 0.16);
  x.fill();
  x.strokeStyle = 'rgba(10,15,25,.6)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 内框走线
  x.strokeStyle = 'rgba(255,255,255,.25)';
  x.lineWidth = Math.max(0.8, s * 0.028);
  rrPath(x, -r * 0.58, -r * 0.62, r * 1.16, r * 1.24, r * 0.1);
  x.stroke();
  // 四角螺丝
  x.fillStyle = 'rgba(230,235,240,.8)';
  for (const [px, py] of [[-0.58, -0.62], [0.58, -0.62], [-0.58, 0.62], [0.58, 0.62]]) {
    x.beginPath(); x.arc(px * r, py * r, r * 0.06, 0, 7); x.fill();
  }
}

// 速度模块符号：三重上行箭头（>>，指向右上，示意加速）
function _moduleChevrons(x, r, s) {
  x.lineCap = 'round';
  x.lineJoin = 'round';
  for (let i = 0; i < 3; i++) {
    const ox = -r * 0.42 + i * r * 0.34;
    x.strokeStyle = i === 2 ? 'rgba(255,255,255,.95)' : 'rgba(255,255,255,.6)';
    x.lineWidth = r * 0.13;
    x.beginPath();
    x.moveTo(ox, r * 0.3);
    x.lineTo(ox + r * 0.24, -r * 0.04);
    x.lineTo(ox, -r * 0.38);
    x.stroke();
  }
}

// 产能模块符号：粗上行箭头 + 右下加号（示意产出累积）
function _moduleArrowPlus(x, r, s) {
  x.fillStyle = 'rgba(255,255,255,.9)';
  // 箭头
  x.beginPath();
  x.moveTo(-r * 0.34, r * 0.34);
  x.lineTo(-r * 0.34, -r * 0.1);
  x.lineTo(-r * 0.54, -r * 0.1);
  x.lineTo(-r * 0.22, -r * 0.5);
  x.lineTo(r * 0.1, -r * 0.1);
  x.lineTo(-r * 0.1, -r * 0.1);
  x.lineTo(-r * 0.1, r * 0.34);
  x.closePath();
  x.fill();
  // 加号
  x.fillStyle = '#f0e14a';
  x.fillRect(r * 0.18, -r * 0.04, r * 0.34, r * 0.11);
  x.fillRect(r * 0.295, -r * 0.155, r * 0.11, r * 0.34);
}

// 模块档位灯：底部右侧 1~3 颗小灯，示意 I / II / III
function _modulePips(x, r, s, n) {
  for (let i = 0; i < n; i++) {
    x.fillStyle = '#f8d84a';
    x.beginPath();
    x.arc(-r * 0.5 + i * r * 0.24, r * 0.5, r * 0.08, 0, 7);
    x.fill();
  }
  x.strokeStyle = 'rgba(255,255,255,.5)';
  x.lineWidth = Math.max(0.6, s * 0.025);
  for (let i = 0; i < n; i++) {
    x.beginPath();
    x.arc(-r * 0.5 + i * r * 0.24, r * 0.5, r * 0.08, 0, 7);
    x.stroke();
  }
}

// 效率模块符号：叶子（环保省电，示意低耗环保）
function _moduleLeaf(x, r, s) {
  // 叶身
  const g = x.createLinearGradient(-r * 0.4, r * 0.4, r * 0.4, -r * 0.4);
  g.addColorStop(0, '#9fe89a');
  g.addColorStop(1, '#3f9e4f');
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(-r * 0.42, r * 0.42);
  x.quadraticCurveTo(-r * 0.55, -r * 0.1, -r * 0.05, -r * 0.48);
  x.quadraticCurveTo(r * 0.5, -r * 0.4, r * 0.42, r * 0.1);
  x.quadraticCurveTo(r * 0.2, r * 0.55, -r * 0.42, r * 0.42);
  x.closePath();
  x.fill();
  x.strokeStyle = 'rgba(15,45,25,.5)';
  x.lineWidth = Math.max(0.8, s * 0.035);
  x.stroke();
  // 叶脉
  x.strokeStyle = 'rgba(255,255,255,.65)';
  x.lineWidth = Math.max(0.7, s * 0.03);
  x.beginPath();
  x.moveTo(-r * 0.38, r * 0.38);
  x.quadraticCurveTo(r * 0.05, r * 0.05, r * 0.38, -r * 0.4);
  x.stroke();
}

// 品质模块符号：宝石菱形 + 高光
function _moduleGem(x, r, s) {
  // 菱形宝石
  const g = x.createLinearGradient(-r * 0.4, -r * 0.45, r * 0.4, r * 0.5);
  g.addColorStop(0, '#eaf6ff');
  g.addColorStop(0.5, '#8fd4f8');
  g.addColorStop(1, '#3f8fd0');
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(0, -r * 0.5);
  x.lineTo(r * 0.42, -r * 0.05);
  x.lineTo(0, r * 0.52);
  x.lineTo(-r * 0.42, -r * 0.05);
  x.closePath();
  x.fill();
  x.strokeStyle = 'rgba(20,50,80,.55)';
  x.lineWidth = Math.max(0.8, s * 0.035);
  x.stroke();
  // 切面线
  x.strokeStyle = 'rgba(255,255,255,.7)';
  x.lineWidth = Math.max(0.6, s * 0.028);
  x.beginPath();
  x.moveTo(-r * 0.42, -r * 0.05); x.lineTo(r * 0.42, -r * 0.05);
  x.moveTo(0, -r * 0.5); x.lineTo(-r * 0.16, -r * 0.05); x.lineTo(0, r * 0.52);
  x.moveTo(0, -r * 0.5); x.lineTo(r * 0.16, -r * 0.05); x.lineTo(0, r * 0.52);
  x.stroke();
  // 星形高光
  x.fillStyle = 'rgba(255,255,255,.95)';
  x.beginPath();
  x.moveTo(r * 0.16, -r * 0.3);
  x.lineTo(r * 0.21, -r * 0.2);
  x.lineTo(r * 0.3, -r * 0.16);
  x.lineTo(r * 0.21, -r * 0.12);
  x.lineTo(r * 0.16, -r * 0.02);
  x.lineTo(r * 0.11, -r * 0.12);
  x.lineTo(r * 0.02, -r * 0.16);
  x.lineTo(r * 0.11, -r * 0.2);
  x.closePath();
  x.fill();
}

// ===== 第 30 批：中间产品收尾（Gleba 生物 / 核燃料 / 科学包 / 桶装流体上半） =====

// 共享工具：金属桶身（桶装流体家族共用骨架），fluidC 为色带颜色，传 null 表示空桶
function _barrelShell(x, r, s, fluidC) {
  const bodyC = '#a8b0b8', rimC = '#767e86';
  // 桶身（竖圆桶，顶部微收）
  const g = x.createLinearGradient(-r * 0.7, 0, r * 0.7, 0);
  g.addColorStop(0, lightenColor(bodyC, 0.18));
  g.addColorStop(0.45, bodyC);
  g.addColorStop(1, darkenColor(bodyC, 0.32));
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(-r * 0.66, -r * 0.68);
  x.lineTo(r * 0.66, -r * 0.68);
  x.lineTo(r * 0.72, r * 0.55);
  x.quadraticCurveTo(0, r * 0.72, -r * 0.72, r * 0.55);
  x.closePath();
  x.fill();
  x.strokeStyle = 'rgba(15,20,26,.55)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 上沿 + 下沿卷边
  x.fillStyle = rimC;
  rrPath(x, -r * 0.7, -r * 0.78, r * 1.4, r * 0.16, r * 0.08);
  x.fill();
  rrPath(x, -r * 0.74, r * 0.46, r * 1.48, r * 0.16, r * 0.08);
  x.fill();
  // 中部双箍纹
  x.strokeStyle = 'rgba(60,66,74,.7)';
  x.lineWidth = Math.max(1, s * 0.04);
  x.beginPath();
  x.moveTo(-r * 0.7, -r * 0.18); x.quadraticCurveTo(0, -r * 0.1, r * 0.7, -r * 0.18);
  x.moveTo(-r * 0.71, r * 0.1); x.quadraticCurveTo(0, r * 0.18, r * 0.71, r * 0.1);
  x.stroke();
  // 流体色带（盛装物标识）
  if (fluidC) {
    const fg = x.createLinearGradient(-r * 0.6, 0, r * 0.6, 0);
    fg.addColorStop(0, lightenColor(fluidC, 0.25));
    fg.addColorStop(0.5, fluidC);
    fg.addColorStop(1, darkenColor(fluidC, 0.3));
    x.fillStyle = fg;
    rrPath(x, -r * 0.62, -r * 0.52, r * 1.24, r * 0.24, r * 0.08);
    x.fill();
    x.fillStyle = 'rgba(255,255,255,.3)';
    rrPath(x, -r * 0.62, -r * 0.52, r * 1.24, r * 0.08, r * 0.04);
    x.fill();
    // 滴液（暗示内盛液体）
    x.fillStyle = fluidC;
    x.beginPath();
    x.moveTo(0, r * 0.62);
    x.quadraticCurveTo(r * 0.07, r * 0.5, 0, r * 0.42);
    x.quadraticCurveTo(-r * 0.07, r * 0.5, 0, r * 0.62);
    x.closePath();
    x.fill();
  } else {
    // 空桶：顶部开口椭圆
    x.fillStyle = '#5a626a';
    x.beginPath(); x.ellipse(0, -r * 0.7, r * 0.5, r * 0.16, 0, 0, 7); x.fill();
    x.fillStyle = '#3a4046';
    x.beginPath(); x.ellipse(0, -r * 0.7, r * 0.34, r * 0.1, 0, 0, 7); x.fill();
  }
  // 桶身高光
  x.fillStyle = 'rgba(255,255,255,.22)';
  rrPath(x, -r * 0.5, -r * 0.6, r * 0.18, r * 1.1, r * 0.09);
  x.fill();
}

// 共享工具：辐射微光背景（铀系物品）
function _radGlow(x, r, c1, c2) {
  const glow = x.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 0.95);
  glow.addColorStop(0, c1);
  glow.addColorStop(1, c2);
  x.fillStyle = glow;
  x.beginPath(); x.arc(0, 0, r * 0.95, 0, 7); x.fill();
}

// 共享工具：三叶辐射符号
function _radTrefoil(x, r, col) {
  x.fillStyle = col;
  for (let i = 0; i < 3; i++) {
    const a0 = -Math.PI / 2 + i * 2.094 - 0.52;
    const a1 = -Math.PI / 2 + i * 2.094 + 0.52;
    x.beginPath();
    x.moveTo(0, 0);
    x.arc(0, 0, r * 0.42, a0, a1);
    x.closePath();
    x.fill();
  }
  x.beginPath(); x.arc(0, 0, r * 0.12, 0, 7); x.fill();
  x.strokeStyle = col; x.lineWidth = r * 0.09;
  x.beginPath(); x.arc(0, 0, r * 0.19, 0, 7); x.stroke();
}

// 共享工具：科研瓶（三档太空科学包共用骨架），drawInner 在瓶身剪裁内绘制内容物
function _spaceFlask(x, r, s, col, drawInner) {
  // 瓶身（圆润圆底瓶）
  const g = x.createLinearGradient(-r * 0.4, -r * 0.7, r * 0.4, r * 0.7);
  g.addColorStop(0, lightenColor(col, 0.45));
  g.addColorStop(0.55, col);
  g.addColorStop(1, darkenColor(col, 0.42));
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(-r * 0.24, -r * 0.6);
  x.lineTo(-r * 0.24, -r * 0.2);
  x.quadraticCurveTo(-r * 0.8, r * 0.05, -r * 0.8, r * 0.42);
  x.arc(0, r * 0.42, r * 0.8, Math.PI, 0);
  x.quadraticCurveTo(r * 0.8, r * 0.05, r * 0.24, -r * 0.2);
  x.lineTo(r * 0.24, -r * 0.6);
  x.closePath();
  x.fill();
  x.strokeStyle = 'rgba(25,28,40,.65)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 内容物（剪裁进瓶身）
  x.save();
  x.beginPath();
  x.moveTo(-r * 0.24, -r * 0.6);
  x.lineTo(-r * 0.24, -r * 0.2);
  x.quadraticCurveTo(-r * 0.8, r * 0.05, -r * 0.8, r * 0.42);
  x.arc(0, r * 0.42, r * 0.8, Math.PI, 0);
  x.quadraticCurveTo(r * 0.8, r * 0.05, r * 0.24, -r * 0.2);
  x.lineTo(r * 0.24, -r * 0.6);
  x.closePath();
  x.clip();
  drawInner(x, r);
  // 瓶身左侧高光
  x.fillStyle = 'rgba(255,255,255,.3)';
  x.beginPath();
  x.ellipse(-r * 0.5, r * 0.15, r * 0.12, r * 0.4, -0.2, 0, 7);
  x.fill();
  x.restore();
  // 瓶口金属盖
  x.fillStyle = '#c9cfe0';
  rrPath(x, -r * 0.32, -r * 0.9, r * 0.64, r * 0.32, r * 0.08);
  x.fill();
  x.strokeStyle = 'rgba(25,28,40,.6)';
  x.lineWidth = Math.max(0.8, s * 0.035);
  x.stroke();
  x.fillStyle = 'rgba(255,255,255,.5)';
  x.fillRect(-r * 0.32, -r * 0.86, r * 0.64, r * 0.08);
}

// ===== 科技包共享「实验玻璃瓶」绘制（12 种科技包统一造型：对应颜色 = 瓶内液体色）=====
// 设计：完整实验用玻璃瓶——圆肩平底瓶身 + 细长瓶颈 + 口沿翻边 + 银灰瓶盖，
// 瓶内装对应颜色液体（液面/竖向高光/气泡/玻璃质感），整体完整落于图标圆内不被裁剪。
function _scienceBottle(x, r, s, col) {
  // 整体缩放包裹：保证完整瓶形在小尺寸圆角矩形裁剪（r*0.82）与大图标画布内均完整可见
  x.save();
  x.scale(0.88, 0.88);
  const lidTop = -r * 0.92;   // 瓶盖顶
  const neckTop = -r * 0.66;  // 颈根
  const neckW = r * 0.34;     // 颈半宽
  const shoulder = -r * 0.34; // 肩部转折点
  const bottom = r * 0.86;    // 瓶底

  // 瓶身完整轮廓（单一路径：盖下口沿 → 颈 → 圆肩 → 直腹 → 圆角瓶底）
  const bodyPath = () => {
    x.beginPath();
    x.moveTo(-neckW, neckTop);
    x.lineTo(-neckW, shoulder);
    x.quadraticCurveTo(-r * 0.78, -r * 0.22, -r * 0.78, r * 0.18);
    x.lineTo(-r * 0.78, bottom - r * 0.2);
    x.quadraticCurveTo(-r * 0.78, bottom, -r * 0.56, bottom);
    x.lineTo(r * 0.56, bottom);
    x.quadraticCurveTo(r * 0.78, bottom, r * 0.78, bottom - r * 0.2);
    x.lineTo(r * 0.78, r * 0.18);
    x.quadraticCurveTo(r * 0.78, -r * 0.22, neckW, shoulder);
    x.lineTo(neckW, neckTop);
    x.closePath();
  };

  // 玻璃底色（空瓶部分也呈淡玻璃感）
  bodyPath();
  const bg = x.createLinearGradient(-r * 0.7, 0, r * 0.7, 0);
  bg.addColorStop(0, 'rgba(210,228,240,.5)');
  bg.addColorStop(0.5, 'rgba(240,248,255,.3)');
  bg.addColorStop(1, 'rgba(170,192,210,.5)');
  x.fillStyle = bg;
  x.fill();

  // 液体（裁剪进瓶身，液面位于肩部下方，保留一段可见空气）
  x.save();
  bodyPath();
  x.clip();
  const liquidTop = -r * 0.06;
  const lg = x.createLinearGradient(-r * 0.4, liquidTop, r * 0.5, bottom);
  lg.addColorStop(0, lightenColor(col, 0.42));
  lg.addColorStop(0.45, col);
  lg.addColorStop(1, darkenColor(col, 0.45));
  x.fillStyle = lg;
  x.fillRect(-r, liquidTop, r * 2, bottom - liquidTop + r);
  // 液面：上亮下暗的双层液面线
  x.fillStyle = 'rgba(255,255,255,.55)';
  x.fillRect(-r, liquidTop, r * 2, r * 0.09);
  x.fillStyle = darkenColor(col, 0.55);
  x.fillRect(-r, liquidTop + r * 0.09, r * 2, r * 0.05);
  // 液面微弧高光（左侧亮斑）
  x.fillStyle = 'rgba(255,255,255,.3)';
  x.beginPath();
  x.ellipse(-r * 0.3, liquidTop + r * 0.1, r * 0.22, r * 0.05, 0, 0, 7);
  x.fill();
  // 瓶身左侧竖向高光（玻璃反光）
  x.strokeStyle = 'rgba(255,255,255,.55)';
  x.lineWidth = r * 0.11;
  x.lineCap = 'round';
  x.beginPath();
  x.moveTo(-r * 0.52, r * 0.12);
  x.quadraticCurveTo(-r * 0.6, r * 0.4, -r * 0.46, r * 0.64);
  x.stroke();
  // 右侧细高光
  x.strokeStyle = 'rgba(255,255,255,.3)';
  x.lineWidth = r * 0.05;
  x.beginPath();
  x.moveTo(r * 0.56, r * 0.16);
  x.quadraticCurveTo(r * 0.62, r * 0.4, r * 0.52, r * 0.62);
  x.stroke();
  // 液内小气泡
  x.fillStyle = 'rgba(255,255,255,.45)';
  x.beginPath(); x.arc(r * 0.26, r * 0.42, r * 0.06, 0, 7); x.fill();
  x.beginPath(); x.arc(r * 0.44, r * 0.2, r * 0.04, 0, 7); x.fill();
  x.beginPath(); x.arc(-r * 0.02, r * 0.6, r * 0.05, 0, 7); x.fill();
  x.beginPath(); x.arc(r * 0.1, r * 0.28, r * 0.028, 0, 7); x.fill();
  x.restore();

  // 玻璃瓶身描边（贯穿瓶底，完整闭合轮廓）
  const gl = x.createLinearGradient(-r * 0.6, neckTop, r * 0.6, bottom);
  gl.addColorStop(0, 'rgba(255,255,255,.6)');
  gl.addColorStop(0.5, 'rgba(255,255,255,.15)');
  gl.addColorStop(1, 'rgba(22,26,36,.55)');
  x.strokeStyle = gl;
  x.lineWidth = Math.max(1, s * 0.045);
  bodyPath();
  x.stroke();
  // 瓶底加粗暗线（体现厚度）
  x.strokeStyle = 'rgba(22,26,36,.4)';
  x.lineWidth = Math.max(1, s * 0.055);
  x.beginPath();
  x.moveTo(-r * 0.56, bottom - s * 0.02);
  x.lineTo(r * 0.56, bottom - s * 0.02);
  x.stroke();

  // 瓶口翻边（口沿外扩的一圈玻璃）
  x.fillStyle = 'rgba(225,238,248,.85)';
  rrPath(x, -neckW - r * 0.1, neckTop - r * 0.08, (neckW + r * 0.1) * 2, r * 0.14, r * 0.06);
  x.fill();
  x.strokeStyle = 'rgba(30,36,50,.55)';
  x.lineWidth = Math.max(0.8, s * 0.03);
  x.stroke();

  // 瓶颈高光（两侧竖线）
  x.strokeStyle = 'rgba(255,255,255,.5)';
  x.lineWidth = Math.max(0.8, s * 0.028);
  x.beginPath();
  x.moveTo(-neckW + r * 0.09, neckTop + r * 0.06); x.lineTo(-neckW + r * 0.09, shoulder);
  x.moveTo(neckW - r * 0.09, neckTop + r * 0.06); x.lineTo(neckW - r * 0.09, shoulder);
  x.stroke();

  // 瓶盖（银灰金属，盖住瓶口上方）
  x.fillStyle = '#9aa0a8';
  rrPath(x, -r * 0.3, lidTop, r * 0.6, neckTop - lidTop + r * 0.02, r * 0.09);
  x.fill();
  x.strokeStyle = 'rgba(28,32,42,.6)';
  x.lineWidth = Math.max(1, s * 0.04);
  x.stroke();
  // 瓶盖竖纹（旋盖防滑纹理）
  x.strokeStyle = 'rgba(60,66,78,.5)';
  x.lineWidth = Math.max(0.6, s * 0.02);
  for (let i = -2; i <= 2; i++) {
    const gx = i * r * 0.11;
    if (Math.abs(gx) < r * 0.22) {
      x.beginPath();
      x.moveTo(gx, lidTop + r * 0.06);
      x.lineTo(gx, neckTop - r * 0.02);
      x.stroke();
    }
  }
  // 瓶盖顶面高光
  x.fillStyle = 'rgba(255,255,255,.42)';
  rrPath(x, -r * 0.24, lidTop + r * 0.03, r * 0.48, r * 0.08, r * 0.04);
  x.fill();
  x.restore();
}
// 共享工具：小行星碎块（四种星块共用岩块骨架），variant 决定矿脉颜色与纹理
function _asteroidChunk(x, r, s, col, variant) {
  // 岩块主体（不规则多边形）
  const g = x.createLinearGradient(-r * 0.7, -r * 0.8, r * 0.7, r * 0.8);
  g.addColorStop(0, lightenColor(col, 0.38));
  g.addColorStop(0.55, col);
  g.addColorStop(1, darkenColor(col, 0.45));
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(-r * 0.74, -r * 0.18);
  x.lineTo(-r * 0.42, -r * 0.62);
  x.lineTo(r * 0.08, -r * 0.8);
  x.lineTo(r * 0.6, -r * 0.5);
  x.lineTo(r * 0.78, r * 0.02);
  x.lineTo(r * 0.46, r * 0.6);
  x.lineTo(-r * 0.12, r * 0.78);
  x.lineTo(-r * 0.62, r * 0.42);
  x.closePath();
  x.fill();
  x.strokeStyle = 'rgba(18,16,20,.65)';
  x.lineWidth = Math.max(1, s * 0.05);
  x.lineJoin = 'round';
  x.stroke();
  // 陨石坑（两个凹坑）
  x.fillStyle = 'rgba(0,0,0,.28)';
  x.beginPath(); x.ellipse(-r * 0.28, -r * 0.3, r * 0.16, r * 0.1, -0.4, 0, 7); x.fill();
  x.beginPath(); x.ellipse(r * 0.3, r * 0.22, r * 0.11, r * 0.08, 0.3, 0, 7); x.fill();
  // 矿脉（variant 决定颜色与形态）
  const vein = {
    metal:      { c1: '#e8f0f8', c2: '#9ab2c8', glow: null },
    carbon:     { c1: '#3a3632', c2: '#181614', glow: null },
    oxide:      { c1: '#bfe8ff', c2: '#5a9ac8', glow: null },
    promethium: { c1: '#c8b0ff', c2: '#6a4ac8', glow: 'rgba(150,110,255,.5)' }
  }[variant] || { c1: '#e8f0f8', c2: '#9ab2c8' };
  if (vein.glow) {
    // 钷素：紫色辉光
    const gl = x.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 0.9);
    gl.addColorStop(0, vein.glow);
    gl.addColorStop(1, 'rgba(150,110,255,0)');
    x.fillStyle = gl;
    x.beginPath(); x.arc(0, 0, r * 0.9, 0, 7); x.fill();
  }
  // 两条贯穿矿脉
  x.strokeStyle = vein.c1;
  x.lineWidth = Math.max(1.4, s * 0.05);
  x.lineCap = 'round';
  x.beginPath();
  x.moveTo(-r * 0.5, -r * 0.05);
  x.quadraticCurveTo(-r * 0.1, -r * 0.25, r * 0.45, -r * 0.1);
  x.stroke();
  x.beginPath();
  x.moveTo(-r * 0.3, r * 0.4);
  x.quadraticCurveTo(r * 0.05, r * 0.1, r * 0.4, r * 0.3);
  x.stroke();
  // 矿脉内芯（更亮细线）
  x.strokeStyle = vein.c2;
  x.lineWidth = Math.max(0.7, s * 0.025);
  x.beginPath();
  x.moveTo(-r * 0.5, -r * 0.05);
  x.quadraticCurveTo(-r * 0.1, -r * 0.25, r * 0.45, -r * 0.1);
  x.stroke();
  // 金属星块：额外露出银亮矿斑
  if (variant === 'metal') {
    const mg = x.createLinearGradient(r * 0.1, -r * 0.5, r * 0.5, -r * 0.15);
    mg.addColorStop(0, '#f4f8fc');
    mg.addColorStop(1, '#8fa4b8');
    x.fillStyle = mg;
    x.beginPath();
    x.moveTo(r * 0.14, -r * 0.52);
    x.lineTo(r * 0.46, -r * 0.4);
    x.lineTo(r * 0.36, -r * 0.14);
    x.lineTo(r * 0.06, -r * 0.26);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(30,36,44,.5)';
    x.lineWidth = Math.max(0.7, s * 0.03);
    x.stroke();
  }
  // 岩块顶缘高光
  x.strokeStyle = 'rgba(255,255,255,.4)';
  x.lineWidth = Math.max(0.8, s * 0.03);
  x.beginPath();
  x.moveTo(-r * 0.42, -r * 0.62);
  x.lineTo(r * 0.08, -r * 0.8);
  x.lineTo(r * 0.6, -r * 0.5);
  x.stroke();
}

// ===== 共享工具（武器系）：投掷胶囊壳（玻璃胶囊体 + 顶盖 + 引信环）=====
function _capBody(x, r, s, col) {
    const g = x.createLinearGradient(-r * 0.4, -r * 0.7, r * 0.4, r * 0.7);
    g.addColorStop(0, lightenColor(col, 0.45));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.35));
    x.fillStyle = g;
    x.beginPath();
    x.arc(0, -r * 0.42, r * 0.4, Math.PI, 0);
    x.lineTo(r * 0.4, r * 0.44);
    x.arc(0, r * 0.44, r * 0.4, 0, Math.PI);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(16,20,26,.6)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 顶部金属盖
    x.fillStyle = '#9aa4ac';
    rrPath(x, -r * 0.44, -r * 0.88, r * 0.88, r * 0.24, r * 0.08);
    x.fill();
    x.strokeStyle = 'rgba(16,20,26,.55)';
    x.lineWidth = Math.max(0.8, s * 0.035);
    x.stroke();
    // 顶部拉环
    x.strokeStyle = '#c8b03a';
    x.lineWidth = Math.max(1.2, s * 0.05);
    x.beginPath();
    x.arc(r * 0.3, -r * 0.86, r * 0.14, -0.6, 2.6);
    x.stroke();
    // 玻璃高光
    x.fillStyle = 'rgba(255,255,255,.35)';
    rrPath(x, -r * 0.26, -r * 0.5, r * 0.14, r * 0.7, r * 0.07);
    x.fill();
}

// ===== 共享工具（武器系）：竖置大弹壳（黄铜筒身 + 底缘）=====
function _shellBody(x, r, s, col) {
    const g = x.createLinearGradient(-r * 0.5, 0, r * 0.5, 0);
    g.addColorStop(0, darkenColor(col, 0.3));
    g.addColorStop(0.42, lightenColor(col, 0.38));
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(-r * 0.44, r * 0.62);
    x.lineTo(-r * 0.44, -r * 0.2);
    x.lineTo(-r * 0.16, -r * 0.62);
    x.lineTo(r * 0.16, -r * 0.62);
    x.lineTo(r * 0.44, -r * 0.2);
    x.lineTo(r * 0.44, r * 0.62);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(52,38,12,.6)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 底缘
    x.fillStyle = '#6a5426';
    rrPath(x, -r * 0.54, r * 0.58, r * 1.08, r * 0.18, r * 0.06);
    x.fill();
    x.strokeStyle = 'rgba(30,22,8,.6)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.stroke();
    // 弹体高光
    x.fillStyle = 'rgba(255,255,255,.28)';
    x.fillRect(-r * 0.3, -r * 0.5, r * 0.1, r * 1.02);
}

// ===== 共享工具（武器系）：炮塔基座（棱形底座 + 立柱）=====
function _turretBase(x, r, s, col) {
    const bg = x.createLinearGradient(-r * 0.8, -r * 0.3, r * 0.8, r * 0.8);
    bg.addColorStop(0, lightenColor(col, 0.35));
    bg.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = bg;
    x.beginPath();
    x.moveTo(-r * 0.84, r * 0.24);
    x.lineTo(-r * 0.48, -r * 0.24);
    x.lineTo(r * 0.48, -r * 0.24);
    x.lineTo(r * 0.84, r * 0.24);
    x.lineTo(r * 0.5, r * 0.8);
    x.lineTo(-r * 0.5, r * 0.8);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(12,14,18,.6)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.lineJoin = 'round';
    x.stroke();
}

// ===== 流体系共享骨架：油滴（原油/重油/轻油）=====
function _oilDrop(x, r, s, col, hl) {
    const g = x.createLinearGradient(-r * 0.4, -r * 0.6, r * 0.4, r * 0.6);
    g.addColorStop(0, lightenColor(col, 0.42));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(0, -r * 0.86);
    x.bezierCurveTo(r * 0.42, -r * 0.2, r * 0.62, r * 0.14, r * 0.62, r * 0.32);
    x.arc(0, r * 0.32, r * 0.62, 0, Math.PI);
    x.bezierCurveTo(-r * 0.62, r * 0.14, -r * 0.42, -r * 0.2, 0, -r * 0.86);
    x.fill();
    x.strokeStyle = hl;
    x.lineWidth = Math.max(1, s * 0.045);
    x.lineJoin = 'round';
    x.stroke();
    // 粘稠高光（油类反光偏亮长条）
    x.fillStyle = 'rgba(255,255,255,.42)';
    x.beginPath(); x.ellipse(-r * 0.22, r * 0.1, r * 0.12, r * 0.24, -0.5, 0, 7); x.fill();
    // 底部微光
    x.fillStyle = 'rgba(255,255,255,.14)';
    x.beginPath(); x.ellipse(r * 0.16, r * 0.44, r * 0.2, r * 0.1, 0.2, 0, 7); x.fill();
  };
// ===== 熔融金属共享骨架（熔融铁/熔融铜）=====
function _molten(x, r, s, col, lineC) {
    // 熔池（底部椭圆液面）
    const g = x.createLinearGradient(0, -r * 0.4, 0, r * 0.7);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    x.beginPath();
    x.ellipse(0, r * 0.3, r * 0.72, r * 0.42, 0, 0, 7);
    x.fill();
    x.strokeStyle = lineC;
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 上方浇注金属流
    const g2 = x.createLinearGradient(0, -r * 0.85, 0, 0);
    g2.addColorStop(0, lightenColor(col, 0.55));
    g2.addColorStop(1, col);
    x.fillStyle = g2;
    x.beginPath();
    x.moveTo(-r * 0.16, -r * 0.85);
    x.quadraticCurveTo(-r * 0.26, -r * 0.3, -r * 0.2, r * 0.1);
    x.lineTo(r * 0.2, r * 0.1);
    x.quadraticCurveTo(r * 0.26, -r * 0.3, r * 0.16, -r * 0.85);
    x.closePath();
    x.fill();
    x.strokeStyle = lineC;
    x.lineJoin = 'round';
    x.stroke();
    // 液面波纹
    x.strokeStyle = 'rgba(255,255,255,.55)';
    x.lineWidth = Math.max(1, s * 0.035);
    x.lineCap = 'round';
    x.beginPath();
    x.ellipse(0, r * 0.26, r * 0.44, r * 0.14, 0, Math.PI * 0.15, Math.PI * 0.85);
    x.stroke();
    // 流身高光
    x.strokeStyle = 'rgba(255,255,255,.6)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.beginPath();
    x.moveTo(-r * 0.06, -r * 0.7);
    x.quadraticCurveTo(-r * 0.12, -r * 0.3, -r * 0.08, 0);
    x.stroke();
  };
// ===== 流体阀门共享骨架（单向阀/溢出阀/补给阀）=====
function _valve(x, r, s, col) {
    // 左右管口
    x.fillStyle = '#8a9098';
    x.fillRect(-r * 0.9, -r * 0.14, r * 0.42, r * 0.28);
    x.fillRect(r * 0.48, -r * 0.14, r * 0.42, r * 0.28);
    x.fillStyle = '#6a7078';
    x.fillRect(-r * 0.9, -r * 0.06, r * 0.42, r * 0.05);
    x.fillRect(r * 0.48, -r * 0.06, r * 0.42, r * 0.05);
    // 阀体（圆角方块）
    const g = x.createLinearGradient(-r * 0.5, -r * 0.5, r * 0.5, r * 0.5);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.42));
    x.fillStyle = g;
    rrPath(x, -r * 0.52, -r * 0.42, r * 1.04, r * 0.84, r * 0.14);
    x.fill();
    x.strokeStyle = 'rgba(30,26,20,.6)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 中央手轮（圆环 + 三辐条）
    x.strokeStyle = '#d8dde2';
    x.lineWidth = Math.max(1.4, s * 0.07);
    x.beginPath();
    x.arc(0, 0, r * 0.3, 0, 7);
    x.stroke();
    x.lineWidth = Math.max(1, s * 0.05);
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3 + Math.PI / 6;
      x.beginPath();
      x.moveTo(0, 0);
      x.lineTo(Math.cos(a) * r * 0.3, Math.sin(a) * r * 0.3);
      x.stroke();
    }
  };
// ===== 遥控器共享骨架（重炮瞄准/放电防御）=====
function _remote(x, r, s, col) {
    // 天线
    x.strokeStyle = '#9aa0a8';
    x.lineWidth = Math.max(1.2, s * 0.05);
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(r * 0.3, -r * 0.35);
    x.lineTo(r * 0.52, -r * 0.85);
    x.stroke();
    x.fillStyle = '#e8b44a';
    x.beginPath(); x.arc(r * 0.54, -r * 0.88, r * 0.08, 0, 7); x.fill();
    // 壳体（圆角竖板，微倾斜）
    x.save();
    x.rotate(-0.12);
    const g = x.createLinearGradient(-r * 0.45, -r * 0.5, r * 0.45, r * 0.7);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.42));
    x.fillStyle = g;
    rrPath(x, -r * 0.45, -r * 0.55, r * 0.9, r * 1.3, r * 0.16);
    x.fill();
    x.strokeStyle = 'rgba(28,20,16,.6)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 功能屏
    x.fillStyle = 'rgba(16,22,30,.85)';
    rrPath(x, -r * 0.3, -r * 0.4, r * 0.6, r * 0.44, r * 0.06);
    x.fill();
    x.restore();
}

const ITEM_CUSTOM_ICONS = {

  // 石砖：错缝双排砖块，立体渐变 + 砖缝描边
  'stone-brick': (x, r, s, col) => {
    const brick = (px, py, w, h) => {
      const g = x.createLinearGradient(px, py, px, py + h);
      g.addColorStop(0, lightenColor(col, 0.35));
      g.addColorStop(1, darkenColor(col, 0.3));
      x.fillStyle = g;
      rrPath(x, px, py, w, h, h * 0.18);
      x.fill();
      x.strokeStyle = 'rgba(30,25,15,.45)';
      x.lineWidth = Math.max(0.6, s * 0.03);
      x.stroke();
    };
    const h = r * 0.4;
    // 上排两块整砖
    brick(-r * 0.95, -r * 0.52, r * 0.88, h);
    brick(r * 0.07, -r * 0.52, r * 0.88, h);
    // 下排错缝：半砖 + 整砖 + 半砖
    brick(-r * 0.95, r * 0.12, r * 0.46, h);
    brick(-r * 0.35, r * 0.12, r * 0.88, h);
    brick(r * 0.67, r * 0.12, r * 0.28, h);
  },

  // 基础传送带：黄色带体 + 深色侧梁 + 滚轴纹 + 白色物流箭头
  'transport-belt': (x, r, s, col) => {
    // 侧梁
    x.fillStyle = darkenColor(col, 0.5);
    x.fillRect(-r * 0.95, -r * 0.62, r * 1.9, r * 0.26);
    x.fillRect(-r * 0.95, r * 0.36, r * 1.9, r * 0.26);
    // 带面
    const g = x.createLinearGradient(0, -r * 0.36, 0, r * 0.36);
    g.addColorStop(0, lightenColor(col, 0.28));
    g.addColorStop(0.5, col);
    g.addColorStop(1, darkenColor(col, 0.28));
    x.fillStyle = g;
    x.fillRect(-r * 0.95, -r * 0.36, r * 1.9, r * 0.72);
    // 滚轴纹
    x.strokeStyle = 'rgba(0,0,0,.2)';
    x.lineWidth = Math.max(1, s * 0.035);
    for (let i = 0; i < 5; i++) {
      const px = -r * 0.76 + i * r * 0.38;
      x.beginPath(); x.moveTo(px, -r * 0.34); x.lineTo(px, r * 0.34); x.stroke();
    }
    // 物流箭头
    x.fillStyle = 'rgba(255,255,255,.9)';
    x.beginPath();
    x.moveTo(-r * 0.38, -r * 0.17);
    x.lineTo(r * 0.02, -r * 0.17);
    x.lineTo(r * 0.02, -r * 0.38);
    x.lineTo(r * 0.48, 0);
    x.lineTo(r * 0.02, r * 0.38);
    x.lineTo(r * 0.02, r * 0.17);
    x.lineTo(-r * 0.38, r * 0.17);
    x.closePath();
    x.fill();
  },

  // 电力机械臂：黄色机座 + 立柱 + 斜伸机械臂 + 橙色夹爪
  'inserter': (x, r, s, col) => {
    // 底座
    x.fillStyle = darkenColor(col, 0.35);
    rrPath(x, -r * 0.55, r * 0.28, r * 1.1, r * 0.62, r * 0.15);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.4)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 立柱
    x.fillStyle = col;
    rrPath(x, -r * 0.18, -r * 0.02, r * 0.36, r * 0.5, r * 0.1);
    x.fill();
    // 机械臂
    x.strokeStyle = lightenColor(col, 0.18);
    x.lineCap = 'round';
    x.lineWidth = r * 0.22;
    x.beginPath(); x.moveTo(r * 0.02, r * 0.12); x.lineTo(r * 0.42, -r * 0.42); x.stroke();
    // 臂身高光
    x.strokeStyle = 'rgba(255,255,255,.35)';
    x.lineWidth = r * 0.06;
    x.beginPath(); x.moveTo(r * 0.06, r * 0.06); x.lineTo(r * 0.38, -r * 0.38); x.stroke();
    // 橙色夹爪
    x.strokeStyle = '#e08a3a';
    x.lineWidth = r * 0.13;
    x.beginPath();
    x.moveTo(r * 0.3, -r * 0.46); x.lineTo(r * 0.46, -r * 0.66);
    x.moveTo(r * 0.52, -r * 0.34); x.lineTo(r * 0.72, -r * 0.5);
    x.stroke();
  },

  // 热能机械臂：灰钢机座 + 炉口火焰 + 机械臂
  'burner-inserter': (x, r, s, col) => {
    // 底座（炉体）
    x.fillStyle = col;
    rrPath(x, -r * 0.6, r * 0.22, r * 1.2, r * 0.68, r * 0.15);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.4)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 炉口外焰
    x.fillStyle = '#e8703a';
    x.beginPath();
    x.moveTo(0, r * 0.88);
    x.quadraticCurveTo(-r * 0.32, r * 0.55, 0, r * 0.3);
    x.quadraticCurveTo(r * 0.32, r * 0.55, 0, r * 0.88);
    x.fill();
    // 内焰
    x.fillStyle = '#f8c83a';
    x.beginPath();
    x.moveTo(0, r * 0.82);
    x.quadraticCurveTo(-r * 0.16, r * 0.6, 0, r * 0.42);
    x.quadraticCurveTo(r * 0.16, r * 0.6, 0, r * 0.82);
    x.fill();
    // 机械臂（深钢色）
    x.strokeStyle = lightenColor(col, 0.25);
    x.lineCap = 'round';
    x.lineWidth = r * 0.2;
    x.beginPath(); x.moveTo(-r * 0.05, r * 0.1); x.lineTo(r * 0.4, -r * 0.44); x.stroke();
    // 深色夹爪
    x.strokeStyle = darkenColor(col, 0.4);
    x.lineWidth = r * 0.12;
    x.beginPath();
    x.moveTo(r * 0.28, -r * 0.48); x.lineTo(r * 0.44, -r * 0.68);
    x.moveTo(r * 0.5, -r * 0.36); x.lineTo(r * 0.7, -r * 0.52);
    x.stroke();
  },

  // 加长机械臂：红色长臂跨界取放 + 臂上载物圆点
  'long-handed-inserter': (x, r, s, col) => {
    // 底座
    x.fillStyle = darkenColor(col, 0.35);
    rrPath(x, -r * 0.62, r * 0.4, r * 1.0, r * 0.5, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.4)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 长臂（伸得更远）
    x.strokeStyle = lightenColor(col, 0.15);
    x.lineCap = 'round';
    x.lineWidth = r * 0.16;
    x.beginPath(); x.moveTo(-r * 0.1, r * 0.42); x.lineTo(r * 0.72, -r * 0.66); x.stroke();
    // 高光
    x.strokeStyle = 'rgba(255,255,255,.35)';
    x.lineWidth = r * 0.05;
    x.beginPath(); x.moveTo(-r * 0.06, r * 0.36); x.lineTo(r * 0.66, -r * 0.62); x.stroke();
    // 夹爪
    x.strokeStyle = darkenColor(col, 0.35);
    x.lineWidth = r * 0.11;
    x.beginPath();
    x.moveTo(r * 0.6, -r * 0.72); x.lineTo(r * 0.8, -r * 0.86);
    x.moveTo(r * 0.82, -r * 0.58); x.lineTo(r * 0.98, -r * 0.7);
    x.stroke();
    // 臂上载物（被搬运的货物）
    const g = x.createRadialGradient(-r * 0.12, -r * 0.02, r * 0.02, -r * 0.18, r * 0.04, r * 0.18);
    g.addColorStop(0, lightenColor(col, 0.45));
    g.addColorStop(1, darkenColor(col, 0.3));
    x.fillStyle = g;
    x.beginPath(); x.arc(-r * 0.18, r * 0.04, r * 0.17, 0, 7); x.fill();
    x.strokeStyle = 'rgba(0,0,0,.35)';
    x.lineWidth = Math.max(1, s * 0.03);
    x.stroke();
  },

  // 电灯：发光玻璃泡 + 灯丝 + 金属底座
  'small-lamp': (x, r, s, col) => {
    // 底座
    x.fillStyle = '#5a5f66';
    rrPath(x, -r * 0.38, r * 0.4, r * 0.76, r * 0.45, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.4)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 玻璃泡
    const g = x.createRadialGradient(-r * 0.14, -r * 0.18, r * 0.08, 0, r * 0.02, r * 0.62);
    g.addColorStop(0, '#fffbe0');
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.28));
    x.fillStyle = g;
    x.beginPath(); x.arc(0, r * 0.02, r * 0.56, 0, 7); x.fill();
    x.strokeStyle = 'rgba(0,0,0,.35)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 灯丝
    x.strokeStyle = '#e8a02a';
    x.lineWidth = Math.max(1, s * 0.05);
    x.beginPath();
    x.moveTo(-r * 0.18, r * 0.22);
    x.lineTo(-r * 0.1, 0);
    x.lineTo(0, r * 0.22);
    x.lineTo(r * 0.1, 0);
    x.lineTo(r * 0.18, r * 0.22);
    x.stroke();
    // 高光
    x.save();
    x.translate(-r * 0.2, -r * 0.16);
    x.rotate(-0.6);
    x.scale(1, 0.62);
    x.fillStyle = 'rgba(255,255,255,.55)';
    x.beginPath(); x.arc(0, 0, r * 0.13, 0, 7); x.fill();
    x.restore();
  },

  // 变电站：大型双横臂铁塔 + 绝缘子 + 顶针
  'substation': (x, r, s, col) => {
    x.strokeStyle = darkenColor(col, 0.2);
    x.lineCap = 'round';
    // 主柱
    x.lineWidth = r * 0.17;
    x.beginPath(); x.moveTo(0, r * 0.88); x.lineTo(0, -r * 0.55); x.stroke();
    // 斜撑
    x.lineWidth = r * 0.1;
    x.beginPath();
    x.moveTo(0, r * 0.62); x.lineTo(-r * 0.55, r * 0.88);
    x.moveTo(0, r * 0.62); x.lineTo(r * 0.55, r * 0.88);
    x.stroke();
    // 上横臂
    x.lineWidth = r * 0.14;
    x.beginPath(); x.moveTo(-r * 0.8, -r * 0.18); x.lineTo(r * 0.8, -r * 0.18); x.stroke();
    // 下横臂
    x.beginPath(); x.moveTo(-r * 0.65, r * 0.22); x.lineTo(r * 0.65, r * 0.22); x.stroke();
    // 绝缘子
    x.fillStyle = '#e8ecf0';
    [-0.8, 0.8].forEach(k => { x.beginPath(); x.arc(k * r, -r * 0.18, r * 0.09, 0, 7); x.fill(); });
    [-0.65, 0.65].forEach(k => { x.beginPath(); x.arc(k * r, r * 0.22, r * 0.09, 0, 7); x.fill(); });
    // 顶针
    x.fillStyle = '#e8c83a';
    x.beginPath(); x.arc(0, -r * 0.64, r * 0.09, 0, 7); x.fill();
  },

  // 可编程音箱：紫色箱体 + 喇叭盆 + 金色声波 + 状态灯
  'programmable-speaker': (x, r, s, col) => {
    // 箱体
    const g = x.createLinearGradient(-r * 0.55, -r * 0.75, r * 0.55, r * 0.6);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(1, darkenColor(col, 0.3));
    x.fillStyle = g;
    rrPath(x, -r * 0.55, -r * 0.75, r * 1.1, r * 1.35, r * 0.16);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.4)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 喇叭盆
    x.fillStyle = darkenColor(col, 0.45);
    x.beginPath(); x.arc(-r * 0.08, r * 0.18, r * 0.3, 0, 7); x.fill();
    x.fillStyle = lightenColor(col, 0.22);
    x.beginPath(); x.arc(-r * 0.08, r * 0.18, r * 0.12, 0, 7); x.fill();
    // 声波
    x.strokeStyle = '#e8c83a';
    x.lineWidth = Math.max(1, s * 0.06);
    x.lineCap = 'round';
    x.beginPath(); x.arc(r * 0.5, r * 0.18, r * 0.2, -1.05, 1.05); x.stroke();
    x.beginPath(); x.arc(r * 0.5, r * 0.18, r * 0.4, -0.95, 0.95); x.stroke();
    // 状态指示灯
    x.fillStyle = '#5ce06a';
    x.beginPath(); x.arc(r * 0.2, -r * 0.5, r * 0.09, 0, 7); x.fill();
  },

  // 基础分流器：一入两出带体 + 三端白色箭头
  'splitter': (x, r, s, col) => {
    const band = (px, py, w, h) => {
      x.fillStyle = darkenColor(col, 0.4);
      rrPath(x, px, py, w, h, r * 0.08);
      x.fill();
    };
    // 左侧入带
    band(-r * 0.95, -r * 0.13, r * 1.15, r * 0.26);
    // 右上 / 右下分支
    x.save(); x.translate(r * 0.12, 0); x.rotate(-0.62);
    band(-r * 0.05, -r * 0.12, r * 0.9, r * 0.24);
    x.restore();
    x.save(); x.translate(r * 0.12, 0); x.rotate(0.62);
    band(-r * 0.05, -r * 0.12, r * 0.9, r * 0.24);
    x.restore();
    // 三端白色小箭头
    const tri = (tx, ty, ang) => {
      x.save(); x.translate(tx, ty); x.rotate(ang);
      x.fillStyle = 'rgba(255,255,255,.9)';
      x.beginPath();
      x.moveTo(-r * 0.14, -r * 0.12);
      x.lineTo(r * 0.06, -r * 0.12);
      x.lineTo(r * 0.06, -r * 0.24);
      x.lineTo(r * 0.3, 0);
      x.lineTo(r * 0.06, r * 0.24);
      x.lineTo(r * 0.06, r * 0.12);
      x.lineTo(-r * 0.14, r * 0.12);
      x.closePath();
      x.fill();
      x.restore();
    };
    tri(-r * 0.9, 0, 0);
    tri(r * 0.6, -r * 0.42, -0.62);
    tri(r * 0.6, r * 0.42, 0.62);
  },

  // 基础地下传送带：地下拱形罩 + 洞口 + 底部进带白箭头
  'underground-belt': (x, r, s, col) => {
    // 拱形罩
    x.fillStyle = darkenColor(col, 0.32);
    x.beginPath();
    x.arc(0, r * 0.18, r * 0.62, Math.PI, 0);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.4)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 洞口
    x.fillStyle = '#20242a';
    x.beginPath();
    x.arc(0, r * 0.18, r * 0.34, Math.PI, 0);
    x.closePath();
    x.fill();
    // 底部进带
    const g = x.createLinearGradient(0, r * 0.55, 0, r * 0.85);
    g.addColorStop(0, lightenColor(col, 0.1));
    g.addColorStop(1, darkenColor(col, 0.2));
    x.fillStyle = g;
    rrPath(x, -r * 0.95, r * 0.55, r * 1.9, r * 0.3, r * 0.08);
    x.fill();
    // 白色箭头（指向洞口）
    x.fillStyle = 'rgba(255,255,255,.9)';
    x.beginPath();
    x.moveTo(0, r * 0.32);
    x.lineTo(r * 0.2, r * 0.62);
    x.lineTo(r * 0.08, r * 0.62);
    x.lineTo(r * 0.08, r * 0.82);
    x.lineTo(-r * 0.08, r * 0.82);
    x.lineTo(-r * 0.08, r * 0.62);
    x.lineTo(-r * 0.2, r * 0.62);
    x.closePath();
    x.fill();
  },

  // 高速传送带：红色带体（同基础带造型，配色区分档位）
  'fast-transport-belt': (x, r, s, col) => {
    x.fillStyle = darkenColor(col, 0.5);
    x.fillRect(-r * 0.95, -r * 0.62, r * 1.9, r * 0.26);
    x.fillRect(-r * 0.95, r * 0.36, r * 1.9, r * 0.26);
    const g = x.createLinearGradient(0, -r * 0.36, 0, r * 0.36);
    g.addColorStop(0, lightenColor(col, 0.28));
    g.addColorStop(0.5, col);
    g.addColorStop(1, darkenColor(col, 0.28));
    x.fillStyle = g;
    x.fillRect(-r * 0.95, -r * 0.36, r * 1.9, r * 0.72);
    x.strokeStyle = 'rgba(0,0,0,.2)';
    x.lineWidth = Math.max(1, s * 0.035);
    for (let i = 0; i < 5; i++) {
      const px = -r * 0.76 + i * r * 0.38;
      x.beginPath(); x.moveTo(px, -r * 0.34); x.lineTo(px, r * 0.34); x.stroke();
    }
    x.fillStyle = 'rgba(255,255,255,.9)';
    [0].forEach(off => {
      x.beginPath();
      x.moveTo(off * r - r * 0.38, -r * 0.17);
      x.lineTo(off * r + r * 0.02, -r * 0.17);
      x.lineTo(off * r + r * 0.02, -r * 0.38);
      x.lineTo(off * r + r * 0.48, 0);
      x.lineTo(off * r + r * 0.02, r * 0.38);
      x.lineTo(off * r + r * 0.02, r * 0.17);
      x.lineTo(off * r - r * 0.38, r * 0.17);
      x.closePath();
      x.fill();
    });
  },

  // 高速地下传送带：红色拱形罩
  'fast-underground-belt': (x, r, s, col) => {
    x.fillStyle = darkenColor(col, 0.32);
    x.beginPath();
    x.arc(0, r * 0.18, r * 0.62, Math.PI, 0);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.4)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    x.fillStyle = '#20242a';
    x.beginPath();
    x.arc(0, r * 0.18, r * 0.34, Math.PI, 0);
    x.closePath();
    x.fill();
    const g = x.createLinearGradient(0, r * 0.55, 0, r * 0.85);
    g.addColorStop(0, lightenColor(col, 0.1));
    g.addColorStop(1, darkenColor(col, 0.2));
    x.fillStyle = g;
    rrPath(x, -r * 0.95, r * 0.55, r * 1.9, r * 0.3, r * 0.08);
    x.fill();
    x.fillStyle = 'rgba(255,255,255,.9)';
    x.beginPath();
    x.moveTo(0, r * 0.32);
    x.lineTo(r * 0.2, r * 0.62);
    x.lineTo(r * 0.08, r * 0.62);
    x.lineTo(r * 0.08, r * 0.82);
    x.lineTo(-r * 0.08, r * 0.82);
    x.lineTo(-r * 0.08, r * 0.62);
    x.lineTo(-r * 0.2, r * 0.62);
    x.closePath();
    x.fill();
  },

  // 极速传送带：蓝色带体
  'express-transport-belt': (x, r, s, col) => {
    x.fillStyle = darkenColor(col, 0.5);
    x.fillRect(-r * 0.95, -r * 0.62, r * 1.9, r * 0.26);
    x.fillRect(-r * 0.95, r * 0.36, r * 1.9, r * 0.26);
    const g = x.createLinearGradient(0, -r * 0.36, 0, r * 0.36);
    g.addColorStop(0, lightenColor(col, 0.28));
    g.addColorStop(0.5, col);
    g.addColorStop(1, darkenColor(col, 0.28));
    x.fillStyle = g;
    x.fillRect(-r * 0.95, -r * 0.36, r * 1.9, r * 0.72);
    x.strokeStyle = 'rgba(0,0,0,.2)';
    x.lineWidth = Math.max(1, s * 0.035);
    for (let i = 0; i < 5; i++) {
      const px = -r * 0.76 + i * r * 0.38;
      x.beginPath(); x.moveTo(px, -r * 0.34); x.lineTo(px, r * 0.34); x.stroke();
    }
    x.fillStyle = 'rgba(255,255,255,.9)';
    [0].forEach(off => {
      x.beginPath();
      x.moveTo(off * r - r * 0.38, -r * 0.17);
      x.lineTo(off * r + r * 0.02, -r * 0.17);
      x.lineTo(off * r + r * 0.02, -r * 0.38);
      x.lineTo(off * r + r * 0.48, 0);
      x.lineTo(off * r + r * 0.02, r * 0.38);
      x.lineTo(off * r + r * 0.02, r * 0.17);
      x.lineTo(off * r - r * 0.38, r * 0.17);
      x.closePath();
      x.fill();
    });
  },

  // 极速地下传送带：蓝色拱形罩
  'express-underground-belt': (x, r, s, col) => {
    x.fillStyle = darkenColor(col, 0.32);
    x.beginPath();
    x.arc(0, r * 0.18, r * 0.62, Math.PI, 0);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.4)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    x.fillStyle = '#20242a';
    x.beginPath();
    x.arc(0, r * 0.18, r * 0.34, Math.PI, 0);
    x.closePath();
    x.fill();
    const g = x.createLinearGradient(0, r * 0.55, 0, r * 0.85);
    g.addColorStop(0, lightenColor(col, 0.1));
    g.addColorStop(1, darkenColor(col, 0.2));
    x.fillStyle = g;
    rrPath(x, -r * 0.95, r * 0.55, r * 1.9, r * 0.3, r * 0.08);
    x.fill();
    x.fillStyle = 'rgba(255,255,255,.9)';
    x.beginPath();
    x.moveTo(0, r * 0.32);
    x.lineTo(r * 0.2, r * 0.62);
    x.lineTo(r * 0.08, r * 0.62);
    x.lineTo(r * 0.08, r * 0.82);
    x.lineTo(-r * 0.08, r * 0.82);
    x.lineTo(-r * 0.08, r * 0.62);
    x.lineTo(-r * 0.2, r * 0.62);
    x.closePath();
    x.fill();
  },

  // 极速分流器：蓝色一入两出带体
  'express-splitter': (x, r, s, col) => {
    const band = (px, py, w, h) => {
      x.fillStyle = darkenColor(col, 0.4);
      rrPath(x, px, py, w, h, r * 0.08);
      x.fill();
    };
    band(-r * 0.95, -r * 0.13, r * 1.15, r * 0.26);
    x.save(); x.translate(r * 0.12, 0); x.rotate(-0.62);
    band(-r * 0.05, -r * 0.12, r * 0.9, r * 0.24);
    x.restore();
    x.save(); x.translate(r * 0.12, 0); x.rotate(0.62);
    band(-r * 0.05, -r * 0.12, r * 0.9, r * 0.24);
    x.restore();
    const tri = (tx, ty, ang) => {
      x.save(); x.translate(tx, ty); x.rotate(ang);
      x.fillStyle = 'rgba(255,255,255,.9)';
      x.beginPath();
      x.moveTo(-r * 0.14, -r * 0.12);
      x.lineTo(r * 0.06, -r * 0.12);
      x.lineTo(r * 0.06, -r * 0.24);
      x.lineTo(r * 0.3, 0);
      x.lineTo(r * 0.06, r * 0.24);
      x.lineTo(r * 0.06, r * 0.12);
      x.lineTo(-r * 0.14, r * 0.12);
      x.closePath();
      x.fill();
      x.restore();
    };
    tri(-r * 0.9, 0, 0);
    tri(r * 0.6, -r * 0.42, -0.62);
    tri(r * 0.6, r * 0.42, 0.62);
  },

  // 超速传送带：军绿带体 + 双白箭头（太空时代终极档）
  'turbo-transport-belt': (x, r, s, col) => {
    x.fillStyle = darkenColor(col, 0.5);
    x.fillRect(-r * 0.95, -r * 0.62, r * 1.9, r * 0.26);
    x.fillRect(-r * 0.95, r * 0.36, r * 1.9, r * 0.26);
    const g = x.createLinearGradient(0, -r * 0.36, 0, r * 0.36);
    g.addColorStop(0, lightenColor(col, 0.28));
    g.addColorStop(0.5, col);
    g.addColorStop(1, darkenColor(col, 0.28));
    x.fillStyle = g;
    x.fillRect(-r * 0.95, -r * 0.36, r * 1.9, r * 0.72);
    x.strokeStyle = 'rgba(0,0,0,.2)';
    x.lineWidth = Math.max(1, s * 0.035);
    for (let i = 0; i < 5; i++) {
      const px = -r * 0.76 + i * r * 0.38;
      x.beginPath(); x.moveTo(px, -r * 0.34); x.lineTo(px, r * 0.34); x.stroke();
    }
    x.fillStyle = 'rgba(255,255,255,.9)';
    [-0.22, 0.26].forEach(off => {
      x.beginPath();
      x.moveTo(off * r - r * 0.38, -r * 0.17);
      x.lineTo(off * r + r * 0.02, -r * 0.17);
      x.lineTo(off * r + r * 0.02, -r * 0.38);
      x.lineTo(off * r + r * 0.48, 0);
      x.lineTo(off * r + r * 0.02, r * 0.38);
      x.lineTo(off * r + r * 0.02, r * 0.17);
      x.lineTo(off * r - r * 0.38, r * 0.17);
      x.closePath();
      x.fill();
    });
  },

  // 超速地下传送带：军绿拱形罩
  'turbo-underground-belt': (x, r, s, col) => {
    x.fillStyle = darkenColor(col, 0.32);
    x.beginPath();
    x.arc(0, r * 0.18, r * 0.62, Math.PI, 0);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.4)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    x.fillStyle = '#20242a';
    x.beginPath();
    x.arc(0, r * 0.18, r * 0.34, Math.PI, 0);
    x.closePath();
    x.fill();
    const g = x.createLinearGradient(0, r * 0.55, 0, r * 0.85);
    g.addColorStop(0, lightenColor(col, 0.1));
    g.addColorStop(1, darkenColor(col, 0.2));
    x.fillStyle = g;
    rrPath(x, -r * 0.95, r * 0.55, r * 1.9, r * 0.3, r * 0.08);
    x.fill();
    x.fillStyle = 'rgba(255,255,255,.9)';
    x.beginPath();
    x.moveTo(0, r * 0.32);
    x.lineTo(r * 0.2, r * 0.62);
    x.lineTo(r * 0.08, r * 0.62);
    x.lineTo(r * 0.08, r * 0.82);
    x.lineTo(-r * 0.08, r * 0.82);
    x.lineTo(-r * 0.08, r * 0.62);
    x.lineTo(-r * 0.2, r * 0.62);
    x.closePath();
    x.fill();
  },

  // 超速分流器：军绿一入两出带体
  'turbo-splitter': (x, r, s, col) => {
    const band = (px, py, w, h) => {
      x.fillStyle = darkenColor(col, 0.4);
      rrPath(x, px, py, w, h, r * 0.08);
      x.fill();
    };
    band(-r * 0.95, -r * 0.13, r * 1.15, r * 0.26);
    x.save(); x.translate(r * 0.12, 0); x.rotate(-0.62);
    band(-r * 0.05, -r * 0.12, r * 0.9, r * 0.24);
    x.restore();
    x.save(); x.translate(r * 0.12, 0); x.rotate(0.62);
    band(-r * 0.05, -r * 0.12, r * 0.9, r * 0.24);
    x.restore();
    const tri = (tx, ty, ang) => {
      x.save(); x.translate(tx, ty); x.rotate(ang);
      x.fillStyle = 'rgba(255,255,255,.9)';
      x.beginPath();
      x.moveTo(-r * 0.14, -r * 0.12);
      x.lineTo(r * 0.06, -r * 0.12);
      x.lineTo(r * 0.06, -r * 0.24);
      x.lineTo(r * 0.3, 0);
      x.lineTo(r * 0.06, r * 0.24);
      x.lineTo(r * 0.06, r * 0.12);
      x.lineTo(-r * 0.14, r * 0.12);
      x.closePath();
      x.fill();
      x.restore();
    };
    tri(-r * 0.9, 0, 0);
    tri(r * 0.6, -r * 0.42, -0.62);
    tri(r * 0.6, r * 0.42, 0.62);
  },

  // 基础装载机：机体 + 装载箭头 + 1 道速度线
  'loader': (x, r, s, col) => {
    const g = x.createLinearGradient(-r * 0.6, -r * 0.8, r * 0.6, r * 0.6);
    g.addColorStop(0, lightenColor(col, 0.32));
    g.addColorStop(1, darkenColor(col, 0.32));
    x.fillStyle = g;
    rrPath(x, -r * 0.75, -r * 0.8, r * 1.5, r * 1.6, r * 0.16);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.42)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    x.fillStyle = '#20242a';
    rrPath(x, -r * 0.45, -r * 0.55, r * 0.9, r * 1.1, r * 0.08);
    x.fill();
    x.strokeStyle = 'rgba(255,255,255,.22)';
    x.lineWidth = Math.max(1, s * 0.035);
    for (let i = 0; i < 3; i++) {
      const py = -r * 0.3 + i * r * 0.4;
      x.beginPath(); x.moveTo(-r * 0.42, py); x.lineTo(r * 0.42, py); x.stroke();
    }
    x.fillStyle = 'rgba(255,255,255,.85)';
    x.beginPath();
    x.moveTo(0.00 * r - r * 0.1, -r * 0.62);
    x.lineTo(0.00 * r + r * 0.1, -r * 0.62);
    x.lineTo(0.00 * r + r * 0.1, -r * 0.44);
    x.lineTo(0.00 * r - r * 0.1, -r * 0.44);
    x.closePath();
    x.fill();
    x.fillStyle = 'rgba(255,255,255,.92)';
    x.beginPath();
    x.moveTo(-r * 0.3, -r * 0.14);
    x.lineTo(r * 0.18, -r * 0.14);
    x.lineTo(r * 0.18, -r * 0.34);
    x.lineTo(r * 0.58, 0);
    x.lineTo(r * 0.18, r * 0.34);
    x.lineTo(r * 0.18, r * 0.14);
    x.lineTo(-r * 0.3, r * 0.14);
    x.closePath();
    x.fill();
  },

  // 高速装载机：红色机体 + 2 道速度线
  'fast-loader': (x, r, s, col) => {
    const g = x.createLinearGradient(-r * 0.6, -r * 0.8, r * 0.6, r * 0.6);
    g.addColorStop(0, lightenColor(col, 0.32));
    g.addColorStop(1, darkenColor(col, 0.32));
    x.fillStyle = g;
    rrPath(x, -r * 0.75, -r * 0.8, r * 1.5, r * 1.6, r * 0.16);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.42)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    x.fillStyle = '#20242a';
    rrPath(x, -r * 0.45, -r * 0.55, r * 0.9, r * 1.1, r * 0.08);
    x.fill();
    x.strokeStyle = 'rgba(255,255,255,.22)';
    x.lineWidth = Math.max(1, s * 0.035);
    for (let i = 0; i < 3; i++) {
      const py = -r * 0.3 + i * r * 0.4;
      x.beginPath(); x.moveTo(-r * 0.42, py); x.lineTo(r * 0.42, py); x.stroke();
    }
    x.fillStyle = 'rgba(255,255,255,.85)';
    x.beginPath();
    x.moveTo(-0.08 * r - r * 0.1, -r * 0.62);
    x.lineTo(-0.08 * r + r * 0.1, -r * 0.62);
    x.lineTo(-0.08 * r + r * 0.1, -r * 0.44);
    x.lineTo(-0.08 * r - r * 0.1, -r * 0.44);
    x.closePath();
    x.fill();
    x.fillStyle = 'rgba(255,255,255,.85)';
    x.beginPath();
    x.moveTo(0.08 * r - r * 0.1, -r * 0.62);
    x.lineTo(0.08 * r + r * 0.1, -r * 0.62);
    x.lineTo(0.08 * r + r * 0.1, -r * 0.44);
    x.lineTo(0.08 * r - r * 0.1, -r * 0.44);
    x.closePath();
    x.fill();
    x.fillStyle = 'rgba(255,255,255,.92)';
    x.beginPath();
    x.moveTo(-r * 0.3, -r * 0.14);
    x.lineTo(r * 0.18, -r * 0.14);
    x.lineTo(r * 0.18, -r * 0.34);
    x.lineTo(r * 0.58, 0);
    x.lineTo(r * 0.18, r * 0.34);
    x.lineTo(r * 0.18, r * 0.14);
    x.lineTo(-r * 0.3, r * 0.14);
    x.closePath();
    x.fill();
  },

  // 极速装载机：蓝色机体 + 3 道速度线（速度档以速度线数量区分）
  'express-loader': (x, r, s, col) => {
    const g = x.createLinearGradient(-r * 0.6, -r * 0.8, r * 0.6, r * 0.6);
    g.addColorStop(0, lightenColor(col, 0.32));
    g.addColorStop(1, darkenColor(col, 0.32));
    x.fillStyle = g;
    rrPath(x, -r * 0.75, -r * 0.8, r * 1.5, r * 1.6, r * 0.16);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.42)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 进料槽
    x.fillStyle = '#20242a';
    rrPath(x, -r * 0.45, -r * 0.55, r * 0.9, r * 1.1, r * 0.08);
    x.fill();
    // 槽内速度线（3 道）
    x.strokeStyle = 'rgba(255,255,255,.22)';
    x.lineWidth = Math.max(1, s * 0.035);
    for (let i = 0; i < 4; i++) {
      const py = -r * 0.38 + i * r * 0.28;
      x.beginPath(); x.moveTo(-r * 0.42, py); x.lineTo(r * 0.42, py); x.stroke();
    }
    // 顶部指示灯（3 档）
    x.fillStyle = 'rgba(255,255,255,.85)';
    [-0.12, 0, 0.12].forEach(off => {
      x.fillRect(off * r - r * 0.06, -r * 0.68, r * 0.12, r * 0.2);
    });
    // 出料箭头
    x.fillStyle = 'rgba(255,255,255,.92)';
    x.beginPath();
    x.moveTo(-r * 0.3, r * 0.06);
    x.lineTo(r * 0.18, r * 0.06);
    x.lineTo(r * 0.18, -r * 0.14);
    x.lineTo(r * 0.58, r * 0.2);
    x.lineTo(r * 0.18, r * 0.54);
    x.lineTo(r * 0.18, r * 0.34);
    x.lineTo(-r * 0.3, r * 0.34);
    x.closePath();
    x.fill();
  },

  // 超速装载机：紫色机体 + 4 道速度线 + 双出料箭头
  'turbo-loader': (x, r, s, col) => {
    const g = x.createLinearGradient(-r * 0.6, -r * 0.8, r * 0.6, r * 0.6);
    g.addColorStop(0, lightenColor(col, 0.32));
    g.addColorStop(1, darkenColor(col, 0.32));
    x.fillStyle = g;
    rrPath(x, -r * 0.75, -r * 0.8, r * 1.5, r * 1.6, r * 0.16);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.42)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 进料槽
    x.fillStyle = '#20242a';
    rrPath(x, -r * 0.45, -r * 0.55, r * 0.9, r * 1.1, r * 0.08);
    x.fill();
    // 槽内速度线（5 道，档位最高）
    x.strokeStyle = 'rgba(255,255,255,.25)';
    x.lineWidth = Math.max(1, s * 0.035);
    for (let i = 0; i < 5; i++) {
      const py = -r * 0.44 + i * r * 0.23;
      x.beginPath(); x.moveTo(-r * 0.42, py); x.lineTo(r * 0.42, py); x.stroke();
    }
    // 顶部指示灯（4 档）
    x.fillStyle = 'rgba(255,255,255,.85)';
    [-0.18, -0.06, 0.06, 0.18].forEach(off => {
      x.fillRect(off * r - r * 0.05, -r * 0.7, r * 0.1, r * 0.18);
    });
    // 双出料箭头（超速吞吐）
    x.fillStyle = 'rgba(255,255,255,.92)';
    [-0.28, 0.16].forEach(off => {
      x.beginPath();
      x.moveTo(off * r, r * 0.06);
      x.lineTo(off * r + r * 0.3, r * 0.06);
      x.lineTo(off * r + r * 0.3, -r * 0.12);
      x.lineTo(off * r + r * 0.58, r * 0.2);
      x.lineTo(off * r + r * 0.3, r * 0.52);
      x.lineTo(off * r + r * 0.3, r * 0.34);
      x.lineTo(off * r, r * 0.34);
      x.closePath();
      x.fill();
    });
  },

  // 高速分流器：红色一入两出带体（同分流器造型，配色区分档位）
  'fast-splitter': (x, r, s, col) => {
    const band = (px, py, w, h) => {
      x.fillStyle = darkenColor(col, 0.4);
      rrPath(x, px, py, w, h, r * 0.08);
      x.fill();
    };
    // 左侧入带
    band(-r * 0.95, -r * 0.13, r * 1.15, r * 0.26);
    // 右上 / 右下分支
    x.save(); x.translate(r * 0.12, 0); x.rotate(-0.62);
    band(-r * 0.05, -r * 0.12, r * 0.9, r * 0.24);
    x.restore();
    x.save(); x.translate(r * 0.12, 0); x.rotate(0.62);
    band(-r * 0.05, -r * 0.12, r * 0.9, r * 0.24);
    x.restore();
    // 三端白色小箭头
    const tri = (tx, ty, ang) => {
      x.save(); x.translate(tx, ty); x.rotate(ang);
      x.fillStyle = 'rgba(255,255,255,.9)';
      x.beginPath();
      x.moveTo(-r * 0.14, -r * 0.12);
      x.lineTo(r * 0.06, -r * 0.12);
      x.lineTo(r * 0.06, -r * 0.24);
      x.lineTo(r * 0.3, 0);
      x.lineTo(r * 0.06, r * 0.24);
      x.lineTo(r * 0.06, r * 0.12);
      x.lineTo(-r * 0.14, r * 0.12);
      x.closePath();
      x.fill();
      x.restore();
    };
    tri(-r * 0.9, 0, 0);
    tri(r * 0.6, -r * 0.42, -0.62);
    tri(r * 0.6, r * 0.42, 0.62);
  },

  // 集装箱机械臂：绿机体 + 粗壮双关节臂 + 宽口双爪夹持货物
  'bulk-inserter': (x, r, s, col) => {
    // 底座
    x.fillStyle = darkenColor(col, 0.38);
    rrPath(x, -r * 0.55, r * 0.3, r * 1.1, r * 0.6, r * 0.15);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.4)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 立柱
    x.fillStyle = col;
    rrPath(x, -r * 0.2, -r * 0.02, r * 0.4, r * 0.52, r * 0.1);
    x.fill();
    // 主臂（更粗）
    x.strokeStyle = lightenColor(col, 0.18);
    x.lineCap = 'round';
    x.lineWidth = r * 0.28;
    x.beginPath(); x.moveTo(r * 0.02, r * 0.14); x.lineTo(r * 0.44, -r * 0.4); x.stroke();
    // 臂身高光
    x.strokeStyle = 'rgba(255,255,255,.35)';
    x.lineWidth = r * 0.07;
    x.beginPath(); x.moveTo(r * 0.06, r * 0.08); x.lineTo(r * 0.4, -r * 0.36); x.stroke();
    // 关节点
    x.fillStyle = lightenColor(col, 0.4);
    x.beginPath(); x.arc(r * 0.44, -r * 0.4, r * 0.1, 0, 7); x.fill();
    x.strokeStyle = 'rgba(0,0,0,.35)';
    x.lineWidth = Math.max(1, s * 0.03);
    x.stroke();
    // 宽口双爪（夹持两件货物）
    x.strokeStyle = '#e08a3a';
    x.lineWidth = r * 0.13;
    x.beginPath();
    x.moveTo(r * 0.34, -r * 0.48); x.lineTo(r * 0.52, -r * 0.7);
    x.moveTo(r * 0.72, -r * 0.4); x.lineTo(r * 0.9, -r * 0.58);
    x.stroke();
    // 被夹持的两件货物
    const g = x.createRadialGradient(r * 0.5, -r * 0.5, r * 0.02, r * 0.5, -r * 0.5, r * 0.2);
    g.addColorStop(0, lightenColor(col, 0.5));
    g.addColorStop(1, darkenColor(col, 0.28));
    x.fillStyle = g;
    x.beginPath(); x.arc(r * 0.46, -r * 0.52, r * 0.12, 0, 7); x.fill();
    x.beginPath(); x.arc(r * 0.66, -r * 0.42, r * 0.12, 0, 7); x.fill();
    x.strokeStyle = 'rgba(0,0,0,.3)';
    x.lineWidth = Math.max(1, s * 0.025);
    x.stroke();
  },

  // 堆叠机械臂：亮绿机体 + 竖叠 3 件货物的机械爪
  'stack-inserter': (x, r, s, col) => {
    // 底座
    x.fillStyle = darkenColor(col, 0.38);
    rrPath(x, -r * 0.55, r * 0.3, r * 1.1, r * 0.6, r * 0.15);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.4)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 立柱
    x.fillStyle = col;
    rrPath(x, -r * 0.2, -r * 0.02, r * 0.4, r * 0.52, r * 0.1);
    x.fill();
    // 主臂
    x.strokeStyle = lightenColor(col, 0.15);
    x.lineCap = 'round';
    x.lineWidth = r * 0.26;
    x.beginPath(); x.moveTo(r * 0.02, r * 0.14); x.lineTo(r * 0.46, -r * 0.38); x.stroke();
    // 臂身高光
    x.strokeStyle = 'rgba(255,255,255,.35)';
    x.lineWidth = r * 0.06;
    x.beginPath(); x.moveTo(r * 0.06, r * 0.08); x.lineTo(r * 0.42, -r * 0.34); x.stroke();
    // 竖叠 3 件货物（分层堆叠特征）
    const g = x.createLinearGradient(r * 0.3, -r * 0.9, r * 0.3, -r * 0.3);
    g.addColorStop(0, lightenColor(col, 0.45));
    g.addColorStop(1, darkenColor(col, 0.25));
    x.fillStyle = g;
    [-0.72, -0.5, -0.28].forEach(off => {
      rrPath(x, r * 0.2, off * r, r * 0.42, r * 0.18, r * 0.05);
      x.fill();
    });
    x.strokeStyle = 'rgba(0,0,0,.35)';
    x.lineWidth = Math.max(1, s * 0.025);
    [-0.72, -0.5, -0.28].forEach(off => {
      rrPath(x, r * 0.2, off * r, r * 0.42, r * 0.18, r * 0.05);
      x.stroke();
    });
    // 夹爪从上方压住
    x.strokeStyle = '#e08a3a';
    x.lineWidth = r * 0.12;
    x.beginPath();
    x.moveTo(r * 0.14, -r * 0.8); x.lineTo(r * 0.14, -r * 0.2);
    x.moveTo(r * 0.72, -r * 0.8); x.lineTo(r * 0.72, -r * 0.2);
    x.stroke();
  },

  // 高速机械臂：蓝色机体（同电力机械臂造型，配色区分档位）
  'fast-inserter': (x, r, s, col) => {
    // 底座
    x.fillStyle = darkenColor(col, 0.35);
    rrPath(x, -r * 0.55, r * 0.28, r * 1.1, r * 0.62, r * 0.15);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.4)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 立柱
    x.fillStyle = col;
    rrPath(x, -r * 0.18, -r * 0.02, r * 0.36, r * 0.5, r * 0.1);
    x.fill();
    // 机械臂
    x.strokeStyle = lightenColor(col, 0.18);
    x.lineCap = 'round';
    x.lineWidth = r * 0.22;
    x.beginPath(); x.moveTo(r * 0.02, r * 0.12); x.lineTo(r * 0.42, -r * 0.42); x.stroke();
    // 臂身高光
    x.strokeStyle = 'rgba(255,255,255,.35)';
    x.lineWidth = r * 0.06;
    x.beginPath(); x.moveTo(r * 0.06, r * 0.06); x.lineTo(r * 0.38, -r * 0.38); x.stroke();
    // 橙色夹爪
    x.strokeStyle = '#e08a3a';
    x.lineWidth = r * 0.13;
    x.beginPath();
    x.moveTo(r * 0.3, -r * 0.46); x.lineTo(r * 0.46, -r * 0.66);
    x.moveTo(r * 0.52, -r * 0.34); x.lineTo(r * 0.72, -r * 0.5);
    x.stroke();
    // 速度弧线（体现高速）
    x.strokeStyle = 'rgba(255,255,255,.45)';
    x.lineWidth = Math.max(1, s * 0.035);
    x.beginPath(); x.arc(-r * 0.15, r * 0.05, r * 0.72, -1.15, -0.35); x.stroke();
  },

  // 钢箱：钢灰色铆接箱体 + 交叉加固梁 + 金属包角
  'steel-chest': (x, r, s, col) => {
    const g = x.createLinearGradient(-r * 0.8, -r * 0.75, r * 0.8, r * 0.75);
    g.addColorStop(0, lightenColor(col, 0.32));
    g.addColorStop(1, darkenColor(col, 0.32));
    x.fillStyle = g;
    rrPath(x, -r * 0.8, -r * 0.7, r * 1.6, r * 1.4, r * 0.1);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.42)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 交叉加固梁
    x.strokeStyle = darkenColor(col, 0.45);
    x.lineWidth = Math.max(1.5, s * 0.07);
    x.beginPath();
    x.moveTo(-r * 0.66, -r * 0.56); x.lineTo(r * 0.66, r * 0.56);
    x.moveTo(r * 0.66, -r * 0.56); x.lineTo(-r * 0.66, r * 0.56);
    x.stroke();
    // 梁高光
    x.strokeStyle = 'rgba(255,255,255,.25)';
    x.lineWidth = Math.max(1, s * 0.025);
    x.beginPath();
    x.moveTo(-r * 0.66, -r * 0.5); x.lineTo(r * 0.66, r * 0.62);
    x.stroke();
    // 四角铆钉
    x.fillStyle = lightenColor(col, 0.45);
    [[-0.62, -0.52], [0.62, -0.52], [-0.62, 0.52], [0.62, 0.52]].forEach(p => {
      x.beginPath(); x.arc(p[0] * r, p[1] * r, r * 0.07, 0, 7); x.fill();
    });
    // 顶部箱盖线
    x.strokeStyle = 'rgba(0,0,0,.3)';
    x.lineWidth = Math.max(1, s * 0.035);
    x.beginPath(); x.moveTo(-r * 0.8, -r * 0.38); x.lineTo(r * 0.8, -r * 0.38); x.stroke();
  },

  // 创造箱：绿色箱体 + 无限符号 + 微光粒
  'creative-chest': (x, r, s, col) => {
    const g = x.createLinearGradient(-r * 0.8, -r * 0.75, r * 0.8, r * 0.75);
    g.addColorStop(0, lightenColor(col, 0.38));
    g.addColorStop(1, darkenColor(col, 0.3));
    x.fillStyle = g;
    rrPath(x, -r * 0.8, -r * 0.7, r * 1.6, r * 1.4, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.42)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 箱盖线
    x.strokeStyle = 'rgba(0,0,0,.3)';
    x.lineWidth = Math.max(1, s * 0.035);
    x.beginPath(); x.moveTo(-r * 0.8, -r * 0.36); x.lineTo(r * 0.8, -r * 0.36); x.stroke();
    // 发光无限符号
    x.strokeStyle = '#8af0a0';
    x.lineWidth = Math.max(1.5, s * 0.09);
    x.lineCap = 'round';
    x.beginPath();
    x.ellipse(-r * 0.2, r * 0.12, r * 0.24, r * 0.16, 0, 0, 7);
    x.stroke();
    x.beginPath();
    x.ellipse(r * 0.2, r * 0.12, r * 0.24, r * 0.16, 0, 0, 7);
    x.stroke();
    // 中心亮点
    x.fillStyle = 'rgba(255,255,255,.9)';
    x.beginPath(); x.arc(0, r * 0.12, r * 0.06, 0, 7); x.fill();
    // 微光粒子
    x.fillStyle = 'rgba(200,255,210,.6)';
    [[-0.55, -0.5], [0.6, -0.42], [-0.35, 0.55]].forEach(p => {
      x.beginPath(); x.arc(p[0] * r, p[1] * r, r * 0.05, 0, 7); x.fill();
    });
  },

  // 虚空箱：深色箱体 + 红色叉号 + 内吸暗涡
  'void-chest': (x, r, s, col) => {
    const g = x.createLinearGradient(-r * 0.8, -r * 0.75, r * 0.8, r * 0.75);
    g.addColorStop(0, lightenColor(col, 0.28));
    g.addColorStop(1, darkenColor(col, 0.42));
    x.fillStyle = g;
    rrPath(x, -r * 0.8, -r * 0.7, r * 1.6, r * 1.4, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.5)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 箱盖线
    x.strokeStyle = 'rgba(0,0,0,.4)';
    x.lineWidth = Math.max(1, s * 0.035);
    x.beginPath(); x.moveTo(-r * 0.8, -r * 0.36); x.lineTo(r * 0.8, -r * 0.36); x.stroke();
    // 内吸暗涡
    const vg = x.createRadialGradient(0, r * 0.14, r * 0.04, 0, r * 0.14, r * 0.34);
    vg.addColorStop(0, '#0a0c10');
    vg.addColorStop(1, 'rgba(10,12,16,0)');
    x.fillStyle = vg;
    x.beginPath(); x.arc(0, r * 0.14, r * 0.34, 0, 7); x.fill();
    // 红色叉号
    x.strokeStyle = '#e05a5a';
    x.lineWidth = Math.max(2, s * 0.11);
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(-r * 0.3, -r * 0.16); x.lineTo(r * 0.3, r * 0.44);
    x.moveTo(r * 0.3, -r * 0.16); x.lineTo(-r * 0.3, r * 0.44);
    x.stroke();
    // 叉号外发光描边
    x.strokeStyle = 'rgba(224,90,90,.35)';
    x.lineWidth = Math.max(3.5, s * 0.19);
    x.beginPath();
    x.moveTo(-r * 0.3, -r * 0.16); x.lineTo(r * 0.3, r * 0.44);
    x.moveTo(r * 0.3, -r * 0.16); x.lineTo(-r * 0.3, r * 0.44);
    x.stroke();
  },

  // 管道：深灰金属管段 + 双法兰接口 + 管身高光
  'pipe': (x, r, s, col) => {
    // 管身（横向）
    const g = x.createLinearGradient(0, -r * 0.45, 0, r * 0.45);
    g.addColorStop(0, lightenColor(col, 0.38));
    g.addColorStop(0.45, lightenColor(col, 0.05));
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    x.fillRect(-r * 0.62, -r * 0.42, r * 1.24, r * 0.84);
    // 管身高光
    x.fillStyle = 'rgba(255,255,255,.3)';
    x.fillRect(-r * 0.62, -r * 0.3, r * 1.24, r * 0.14);
    // 两端法兰
    const flange = (px) => {
      const fg = x.createLinearGradient(px - r * 0.16, 0, px + r * 0.16, 0);
      fg.addColorStop(0, lightenColor(col, 0.32));
      fg.addColorStop(1, darkenColor(col, 0.32));
      x.fillStyle = fg;
      rrPath(x, px - r * 0.16, -r * 0.62, r * 0.32, r * 1.24, r * 0.06);
      x.fill();
      x.strokeStyle = 'rgba(0,0,0,.42)';
      x.lineWidth = Math.max(1, s * 0.04);
      x.stroke();
      // 法兰螺栓
      x.fillStyle = lightenColor(col, 0.45);
      [-0.4, 0.4].forEach(off => {
        x.beginPath(); x.arc(px, off * r, r * 0.055, 0, 7); x.fill();
      });
    };
    flange(-r * 0.55);
    flange(r * 0.55);
    // 中段管箍
    x.fillStyle = darkenColor(col, 0.28);
    rrPath(x, -r * 0.14, -r * 0.5, r * 0.28, r * 1.0, r * 0.05);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.35)';
    x.stroke();
  },

  // 地下管道：两段立管 + 地下暗管虚线剖面
  'pipe-to-ground': (x, r, s, col) => {
    const stub = (px) => {
      // 立管口（法兰）
      const g = x.createLinearGradient(px - r * 0.3, 0, px + r * 0.3, 0);
      g.addColorStop(0, lightenColor(col, 0.35));
      g.addColorStop(0.5, lightenColor(col, 0.05));
      g.addColorStop(1, darkenColor(col, 0.4));
      x.fillStyle = g;
      rrPath(x, px - r * 0.3, -r * 0.55, r * 0.6, r * 0.75, r * 0.1);
      x.fill();
      x.strokeStyle = 'rgba(0,0,0,.42)';
      x.lineWidth = Math.max(1, s * 0.04);
      x.stroke();
      // 管口
      x.fillStyle = darkenColor(col, 0.55);
      rrPath(x, px - r * 0.17, -r * 0.42, r * 0.34, r * 0.4, r * 0.08);
      x.fill();
    };
    stub(-r * 0.62);
    stub(r * 0.62);
    // 地面线
    x.strokeStyle = 'rgba(255,255,255,.35)';
    x.lineWidth = Math.max(1, s * 0.03);
    x.setLineDash([s * 0.08, s * 0.06]);
    x.beginPath(); x.moveTo(-r * 0.95, r * 0.2); x.lineTo(r * 0.95, r * 0.2); x.stroke();
    x.setLineDash([]);
    // 地下暗管
    const ug = x.createLinearGradient(0, r * 0.2, 0, r * 0.8);
    ug.addColorStop(0, darkenColor(col, 0.25));
    ug.addColorStop(1, darkenColor(col, 0.6));
    x.fillStyle = ug;
    rrPath(x, -r * 0.62, r * 0.3, r * 1.24, r * 0.42, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.4)';
    x.stroke();
    // 地下暗管走向箭头
    x.fillStyle = 'rgba(255,255,255,.75)';
    x.beginPath();
    x.moveTo(-r * 0.3, r * 0.38);
    x.lineTo(r * 0.06, r * 0.38);
    x.lineTo(r * 0.06, r * 0.28);
    x.lineTo(r * 0.38, r * 0.51);
    x.lineTo(r * 0.06, r * 0.74);
    x.lineTo(r * 0.06, r * 0.64);
    x.lineTo(-r * 0.3, r * 0.64);
    x.closePath();
    x.fill();
  },

  // 流体泵：青色泵体 + 入口喇叭口 + 出口箭头
  'pump': (x, r, s, col) => {
    // 底座
    x.fillStyle = darkenColor(col, 0.45);
    rrPath(x, -r * 0.85, r * 0.35, r * 1.7, r * 0.5, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.4)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 泵体（梯形壳）
    const g = x.createLinearGradient(0, -r * 0.65, 0, r * 0.45);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.35));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(-r * 0.7, r * 0.4);
    x.lineTo(-r * 0.5, -r * 0.45);
    x.quadraticCurveTo(0, -r * 0.75, r * 0.5, -r * 0.45);
    x.lineTo(r * 0.7, r * 0.4);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.42)';
    x.stroke();
    // 入口喇叭口（背侧）
    x.fillStyle = darkenColor(col, 0.55);
    x.beginPath();
    x.ellipse(-r * 0.52, -r * 0.05, r * 0.14, r * 0.4, 0, 0, 7);
    x.fill();
    x.fillStyle = '#0e2a30';
    x.beginPath();
    x.ellipse(-r * 0.52, -r * 0.05, r * 0.08, r * 0.28, 0, 0, 7);
    x.fill();
    // 出口箭头（前侧）
    x.fillStyle = 'rgba(255,255,255,.9)';
    x.beginPath();
    x.moveTo(r * 0.1, -r * 0.18);
    x.lineTo(r * 0.36, -r * 0.18);
    x.lineTo(r * 0.36, -r * 0.36);
    x.lineTo(r * 0.74, 0);
    x.lineTo(r * 0.36, r * 0.36);
    x.lineTo(r * 0.36, r * 0.18);
    x.lineTo(r * 0.1, r * 0.18);
    x.closePath();
    x.fill();
    // 壳身高光
    x.strokeStyle = 'rgba(255,255,255,.3)';
    x.lineWidth = Math.max(1, s * 0.035);
    x.beginPath(); x.moveTo(-r * 0.4, -r * 0.42); x.quadraticCurveTo(0, -r * 0.62, r * 0.4, -r * 0.42); x.stroke();
  },

  // 储液罐：俯视圆柱罐体 + 对角接口 + 液位高光
  'storage-tank': (x, r, s, col) => {
    // 罐体外圈（钢壁）
    const g = x.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.1, 0, 0, r * 0.95);
    g.addColorStop(0, lightenColor(col, 0.45));
    g.addColorStop(0.6, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    x.beginPath(); x.arc(0, 0, r * 0.92, 0, 7); x.fill();
    x.strokeStyle = 'rgba(0,0,0,.45)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 罐顶内圈
    x.fillStyle = 'rgba(0,0,0,.18)';
    x.beginPath(); x.arc(0, 0, r * 0.66, 0, 7); x.fill();
    // 顶部高光弧
    x.strokeStyle = 'rgba(255,255,255,.35)';
    x.lineWidth = Math.max(1, s * 0.05);
    x.beginPath(); x.arc(0, 0, r * 0.78, Math.PI * 1.05, Math.PI * 1.6); x.stroke();
    // 对角管道接口（北西/南东）
    const noz = (px, py, rot) => {
      x.save(); x.translate(px, py); x.rotate(rot);
      const ng = x.createLinearGradient(0, -r * 0.16, 0, r * 0.16);
      ng.addColorStop(0, lightenColor(col, 0.3));
      ng.addColorStop(1, darkenColor(col, 0.4));
      x.fillStyle = ng;
      rrPath(x, 0, -r * 0.17, r * 0.32, r * 0.34, r * 0.06);
      x.fill();
      x.strokeStyle = 'rgba(0,0,0,.4)';
      x.lineWidth = Math.max(1, s * 0.035);
      x.stroke();
      x.restore();
    };
    noz(-r * 0.62, -r * 0.62, Math.PI * 0.75);
    noz(r * 0.62, r * 0.62, Math.PI * 1.75);
    // 液位中心标记（液滴）
    x.fillStyle = 'rgba(120,200,240,.85)';
    x.beginPath();
    x.moveTo(0, -r * 0.28);
    x.quadraticCurveTo(r * 0.22, r * 0.06, 0, r * 0.26);
    x.quadraticCurveTo(-r * 0.22, r * 0.06, 0, -r * 0.28);
    x.fill();
    x.fillStyle = 'rgba(255,255,255,.55)';
    x.beginPath(); x.arc(-r * 0.06, r * 0.05, r * 0.05, 0, 7); x.fill();
  },

  // 创造管道：绿色管段 + 发光无限符号
  'creative-pipe': (x, r, s, col) => {
    // 管身（竖向）
    const g = x.createLinearGradient(-r * 0.42, 0, r * 0.42, 0);
    g.addColorStop(0, lightenColor(col, 0.38));
    g.addColorStop(0.45, lightenColor(col, 0.05));
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    rrPath(x, -r * 0.42, -r * 0.6, r * 0.84, r * 1.2, r * 0.14);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.42)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 上下法兰
    const flange = (py) => {
      const fg = x.createLinearGradient(0, py - r * 0.14, 0, py + r * 0.14);
      fg.addColorStop(0, lightenColor(col, 0.32));
      fg.addColorStop(1, darkenColor(col, 0.32));
      x.fillStyle = fg;
      rrPath(x, -r * 0.58, py - r * 0.14, r * 1.16, r * 0.28, r * 0.06);
      x.fill();
      x.strokeStyle = 'rgba(0,0,0,.4)';
      x.stroke();
    };
    flange(-r * 0.52);
    flange(r * 0.52);
    // 管身高光
    x.fillStyle = 'rgba(255,255,255,.28)';
    rrPath(x, -r * 0.3, -r * 0.55, r * 0.12, r * 1.1, r * 0.06);
    x.fill();
    // 发光无限符号
    x.strokeStyle = '#a8f5b8';
    x.lineWidth = Math.max(1.5, s * 0.08);
    x.lineCap = 'round';
    x.beginPath();
    x.ellipse(-r * 0.16, 0, r * 0.19, r * 0.13, 0, 0, 7);
    x.stroke();
    x.beginPath();
    x.ellipse(r * 0.16, 0, r * 0.19, r * 0.13, 0, 0, 7);
    x.stroke();
  },

  // 虚空管道：深色管段 + 红色叉号 + 内吸暗涡
  'void-pipe': (x, r, s, col) => {
    // 管身（竖向）
    const g = x.createLinearGradient(-r * 0.42, 0, r * 0.42, 0);
    g.addColorStop(0, lightenColor(col, 0.3));
    g.addColorStop(0.45, lightenColor(col, 0.02));
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    rrPath(x, -r * 0.42, -r * 0.6, r * 0.84, r * 1.2, r * 0.14);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.5)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 上下法兰
    const flange = (py) => {
      const fg = x.createLinearGradient(0, py - r * 0.14, 0, py + r * 0.14);
      fg.addColorStop(0, lightenColor(col, 0.28));
      fg.addColorStop(1, darkenColor(col, 0.36));
      x.fillStyle = fg;
      rrPath(x, -r * 0.58, py - r * 0.14, r * 1.16, r * 0.28, r * 0.06);
      x.fill();
      x.strokeStyle = 'rgba(0,0,0,.45)';
      x.stroke();
    };
    flange(-r * 0.52);
    flange(r * 0.52);
    // 内吸暗涡
    const vg = x.createRadialGradient(0, 0, r * 0.03, 0, 0, r * 0.32);
    vg.addColorStop(0, '#0a0c10');
    vg.addColorStop(1, 'rgba(10,12,16,0)');
    x.fillStyle = vg;
    x.beginPath(); x.arc(0, 0, r * 0.32, 0, 7); x.fill();
    // 红色叉号
    x.strokeStyle = '#e05a5a';
    x.lineWidth = Math.max(1.6, s * 0.1);
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(-r * 0.2, -r * 0.2); x.lineTo(r * 0.2, r * 0.2);
    x.moveTo(r * 0.2, -r * 0.2); x.lineTo(-r * 0.2, r * 0.2);
    x.stroke();
    x.strokeStyle = 'rgba(224,90,90,.35)';
    x.lineWidth = Math.max(3, s * 0.17);
    x.beginPath();
    x.moveTo(-r * 0.2, -r * 0.2); x.lineTo(r * 0.2, r * 0.2);
    x.moveTo(r * 0.2, -r * 0.2); x.lineTo(-r * 0.2, r * 0.2);
    x.stroke();
  },

  // 创造传送带：绿色带体 + 侧梁 + 无限符号
  'creative-belt': (x, r, s, col) => {
    // 侧梁
    x.fillStyle = darkenColor(col, 0.5);
    x.fillRect(-r * 0.95, -r * 0.62, r * 1.9, r * 0.26);
    x.fillRect(-r * 0.95, r * 0.36, r * 1.9, r * 0.26);
    // 带面
    const g = x.createLinearGradient(0, -r * 0.36, 0, r * 0.36);
    g.addColorStop(0, lightenColor(col, 0.32));
    g.addColorStop(0.5, col);
    g.addColorStop(1, darkenColor(col, 0.28));
    x.fillStyle = g;
    x.fillRect(-r * 0.95, -r * 0.36, r * 1.9, r * 0.72);
    // 滚轴纹
    x.strokeStyle = 'rgba(0,0,0,.2)';
    x.lineWidth = Math.max(1, s * 0.035);
    for (let i = 0; i < 5; i++) {
      const px = -r * 0.76 + i * r * 0.38;
      x.beginPath(); x.moveTo(px, -r * 0.34); x.lineTo(px, r * 0.34); x.stroke();
    }
    // 发光无限符号
    x.strokeStyle = '#c8ffd4';
    x.lineWidth = Math.max(1.5, s * 0.075);
    x.lineCap = 'round';
    x.beginPath();
    x.ellipse(-r * 0.2, 0, r * 0.22, r * 0.16, 0, 0, 7);
    x.stroke();
    x.beginPath();
    x.ellipse(r * 0.2, 0, r * 0.22, r * 0.16, 0, 0, 7);
    x.stroke();
    // 中心亮点
    x.fillStyle = 'rgba(255,255,255,.9)';
    x.beginPath(); x.arc(0, 0, r * 0.055, 0, 7); x.fill();
  },

  // 虚空传送带：深色带体 + 红色叉号
  'void-belt': (x, r, s, col) => {
    // 侧梁
    x.fillStyle = darkenColor(col, 0.55);
    x.fillRect(-r * 0.95, -r * 0.62, r * 1.9, r * 0.26);
    x.fillRect(-r * 0.95, r * 0.36, r * 1.9, r * 0.26);
    // 带面
    const g = x.createLinearGradient(0, -r * 0.36, 0, r * 0.36);
    g.addColorStop(0, lightenColor(col, 0.26));
    g.addColorStop(0.5, col);
    g.addColorStop(1, darkenColor(col, 0.32));
    x.fillStyle = g;
    x.fillRect(-r * 0.95, -r * 0.36, r * 1.9, r * 0.72);
    // 滚轴纹
    x.strokeStyle = 'rgba(0,0,0,.3)';
    x.lineWidth = Math.max(1, s * 0.035);
    for (let i = 0; i < 5; i++) {
      const px = -r * 0.76 + i * r * 0.38;
      x.beginPath(); x.moveTo(px, -r * 0.34); x.lineTo(px, r * 0.34); x.stroke();
    }
    // 内吸暗涡
    const vg = x.createRadialGradient(0, 0, r * 0.03, 0, 0, r * 0.3);
    vg.addColorStop(0, '#0a0c10');
    vg.addColorStop(1, 'rgba(10,12,16,0)');
    x.fillStyle = vg;
    x.beginPath(); x.arc(0, 0, r * 0.3, 0, 7); x.fill();
    // 红色叉号
    x.strokeStyle = '#e05a5a';
    x.lineWidth = Math.max(1.6, s * 0.095);
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(-r * 0.24, -r * 0.18); x.lineTo(r * 0.24, r * 0.18);
    x.moveTo(r * 0.24, -r * 0.18); x.lineTo(-r * 0.24, r * 0.18);
    x.stroke();
    x.strokeStyle = 'rgba(224,90,90,.32)';
    x.lineWidth = Math.max(3, s * 0.16);
    x.beginPath();
    x.moveTo(-r * 0.24, -r * 0.18); x.lineTo(r * 0.24, r * 0.18);
    x.moveTo(r * 0.24, -r * 0.18); x.lineTo(-r * 0.24, r * 0.18);
    x.stroke();
  },

  // 峭壁炸药：三联炸药捆 + 引线火花
  'cliff-explosives': (x, r, s, col) => {
    // 三根炸药（错位竖排）
    const stick = (px, py, rot) => {
      x.save(); x.translate(px, py); x.rotate(rot);
      const g = x.createLinearGradient(-r * 0.16, 0, r * 0.16, 0);
      g.addColorStop(0, lightenColor(col, 0.35));
      g.addColorStop(0.5, col);
      g.addColorStop(1, darkenColor(col, 0.35));
      x.fillStyle = g;
      rrPath(x, -r * 0.17, -r * 0.55, r * 0.34, r * 1.1, r * 0.1);
      x.fill();
      x.strokeStyle = 'rgba(0,0,0,.42)';
      x.lineWidth = Math.max(1, s * 0.04);
      x.stroke();
      // 纸筒箍带
      x.fillStyle = 'rgba(120,80,40,.55)';
      x.fillRect(-r * 0.17, -r * 0.18, r * 0.34, r * 0.1);
      x.fillRect(-r * 0.17, r * 0.12, r * 0.34, r * 0.1);
      x.restore();
    };
    stick(-r * 0.4, r * 0.18, -0.12);
    stick(r * 0.4, r * 0.18, 0.12);
    stick(0, r * 0.08, 0);
    // 引线
    x.strokeStyle = '#c8b088';
    x.lineWidth = Math.max(1.2, s * 0.04);
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(0, -r * 0.45);
    x.quadraticCurveTo(r * 0.1, -r * 0.72, r * 0.34, -r * 0.68);
    x.stroke();
    // 火花
    x.fillStyle = '#f8c83a';
    x.beginPath(); x.arc(r * 0.4, -r * 0.68, r * 0.1, 0, 7); x.fill();
    x.strokeStyle = 'rgba(248,160,58,.6)';
    x.lineWidth = Math.max(1, s * 0.03);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + 0.5;
      x.beginPath();
      x.moveTo(r * 0.4 + Math.cos(a) * r * 0.12, -r * 0.68 + Math.sin(a) * r * 0.12);
      x.lineTo(r * 0.4 + Math.cos(a) * r * 0.24, -r * 0.68 + Math.sin(a) * r * 0.24);
      x.stroke();
    }
  },

  // 装甲车：俯视车体 + 座舱盖 + 四轮
  'car': (x, r, s, col) => {
    // 四轮
    x.fillStyle = '#22252a';
    [[-0.55, -0.52], [0.55, -0.52], [-0.55, 0.52], [0.55, 0.52]].forEach(p => {
      rrPath(x, p[0] * r - r * 0.16, p[1] * r - r * 0.26, r * 0.32, r * 0.52, r * 0.1);
      x.fill();
    });
    // 车体（圆角梯形，前窄后宽）
    const g = x.createLinearGradient(0, -r * 0.75, 0, r * 0.85);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(-r * 0.42, -r * 0.78);
    x.quadraticCurveTo(0, -r * 0.92, r * 0.42, -r * 0.78);
    x.quadraticCurveTo(r * 0.66, -r * 0.2, r * 0.6, r * 0.72);
    x.quadraticCurveTo(0, r * 0.9, -r * 0.6, r * 0.72);
    x.quadraticCurveTo(-r * 0.66, -r * 0.2, -r * 0.42, -r * 0.78);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.45)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 座舱盖（挡风玻璃）
    x.fillStyle = 'rgba(30,50,70,.85)';
    x.beginPath();
    x.moveTo(-r * 0.32, -r * 0.18);
    x.quadraticCurveTo(0, -r * 0.34, r * 0.32, -r * 0.18);
    x.lineTo(r * 0.26, r * 0.32);
    x.quadraticCurveTo(0, r * 0.44, -r * 0.26, r * 0.32);
    x.closePath();
    x.fill();
    // 挡风玻璃高光
    x.strokeStyle = 'rgba(180,220,255,.5)';
    x.lineWidth = Math.max(1, s * 0.03);
    x.beginPath(); x.moveTo(-r * 0.24, -r * 0.12); x.quadraticCurveTo(0, -r * 0.26, r * 0.24, -r * 0.12); x.stroke();
    // 前车灯
    x.fillStyle = '#ffe9a0';
    [[-0.26, -0.7], [0.26, -0.7]].forEach(p => {
      x.beginPath(); x.arc(p[0] * r, p[1] * r, r * 0.08, 0, 7); x.fill();
    });
    // 引擎盖中线
    x.strokeStyle = 'rgba(0,0,0,.25)';
    x.lineWidth = Math.max(1, s * 0.03);
    x.beginPath(); x.moveTo(0, -r * 0.7); x.lineTo(0, -r * 0.34); x.stroke();
  },

  // 坦克：俯视履带 + 车体 + 旋转炮塔与炮管
  'tank': (x, r, s, col) => {
    // 两侧履带
    const tread = (px) => {
      const tg = x.createLinearGradient(0, -r * 0.8, 0, r * 0.8);
      tg.addColorStop(0, '#3a3f46');
      tg.addColorStop(0.5, '#22262b');
      tg.addColorStop(1, '#3a3f46');
      x.fillStyle = tg;
      rrPath(x, px - r * 0.2, -r * 0.82, r * 0.4, r * 1.64, r * 0.12);
      x.fill();
      x.strokeStyle = 'rgba(0,0,0,.5)';
      x.lineWidth = Math.max(1, s * 0.04);
      x.stroke();
      // 履带齿纹
      x.strokeStyle = 'rgba(255,255,255,.18)';
      x.lineWidth = Math.max(1, s * 0.025);
      for (let i = 0; i < 7; i++) {
        const py = -r * 0.68 + i * r * 0.24;
        x.beginPath(); x.moveTo(px - r * 0.16, py); x.lineTo(px + r * 0.16, py); x.stroke();
      }
    };
    tread(-r * 0.56);
    tread(r * 0.56);
    // 车体
    const g = x.createLinearGradient(0, -r * 0.6, 0, r * 0.7);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(0.6, col);
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    rrPath(x, -r * 0.46, -r * 0.62, r * 0.92, r * 1.28, r * 0.16);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.45)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 炮塔
    const tg2 = x.createRadialGradient(-r * 0.08, -r * 0.1, r * 0.05, 0, 0, r * 0.42);
    tg2.addColorStop(0, lightenColor(col, 0.45));
    tg2.addColorStop(1, darkenColor(col, 0.3));
    x.fillStyle = tg2;
    x.beginPath(); x.arc(0, 0, r * 0.4, 0, 7); x.fill();
    x.strokeStyle = 'rgba(0,0,0,.45)';
    x.stroke();
    // 炮管（朝上）
    const bg = x.createLinearGradient(-r * 0.09, 0, r * 0.09, 0);
    bg.addColorStop(0, lightenColor(col, 0.3));
    bg.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = bg;
    rrPath(x, -r * 0.09, -r * 0.98, r * 0.18, r * 0.62, r * 0.05);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.45)';
    x.lineWidth = Math.max(1, s * 0.035);
    x.stroke();
    // 炮口
    x.fillStyle = darkenColor(col, 0.5);
    rrPath(x, -r * 0.12, -r * 0.98, r * 0.24, r * 0.14, r * 0.04);
    x.fill();
    // 舱盖
    x.fillStyle = 'rgba(255,255,255,.22)';
    x.beginPath(); x.arc(-r * 0.1, -r * 0.1, r * 0.12, 0, 7); x.fill();
  },

  // 蜘蛛机器人：俯视六足机甲 + 中央驾驶舱 + 四联炮管
  'spidertron': (x, r, s, col) => {
    // 六条机械腿（三对，斜向伸出）
    const leg = (a1, a2) => {
      [a1, a2].forEach(a => {
        x.strokeStyle = '#3a3f4a';
        x.lineWidth = Math.max(1.5, s * 0.07);
        x.lineCap = 'round';
        x.beginPath();
        const sx = Math.cos(a) * r * 0.42, sy = Math.sin(a) * r * 0.42;
        const mx = Math.cos(a) * r * 0.78, my = Math.sin(a) * r * 0.78;
        const ex = Math.cos(a + 0.5) * r * 1.0, ey = Math.sin(a + 0.5) * r * 1.0;
        x.moveTo(sx, sy); x.lineTo(mx, my); x.lineTo(ex, ey);
        x.stroke();
      });
    };
    leg(-Math.PI * 0.62, -Math.PI * 0.38);  // 上方两腿
    leg(-Math.PI * 0.5, -Math.PI * 0.44);   // 两侧腿
    leg(Math.PI * 0.38, Math.PI * 0.62);    // 下方两腿
    // 腿端脚垫
    x.fillStyle = '#22252b';
    x.beginPath(); x.arc(Math.cos(-Math.PI * 0.12) * r * 1.0, Math.sin(-Math.PI * 0.12) * r * 1.0, r * 0.1, 0, 7); x.fill();
    x.beginPath(); x.arc(Math.cos(Math.PI * 1.12) * r * 1.0, Math.sin(Math.PI * 1.12) * r * 1.0, r * 0.1, 0, 7); x.fill();
    // 中央躯体（圆角六边形）
    const g = x.createLinearGradient(0, -r * 0.6, 0, r * 0.6);
    g.addColorStop(0, lightenColor(col, 0.42));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.42));
    x.fillStyle = g;
    x.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 - Math.PI / 2;
      const px = Math.cos(a) * r * 0.62, py = Math.sin(a) * r * 0.62;
      i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    }
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.48)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 驾驶舱玻璃罩
    x.fillStyle = 'rgba(40,60,90,.9)';
    x.beginPath(); x.ellipse(0, -r * 0.05, r * 0.3, r * 0.36, 0, 0, 7); x.fill();
    x.strokeStyle = 'rgba(160,200,255,.5)';
    x.lineWidth = Math.max(1, s * 0.03);
    x.stroke();
    x.fillStyle = 'rgba(200,230,255,.45)';
    x.beginPath(); x.ellipse(-r * 0.1, -r * 0.16, r * 0.1, r * 0.12, -0.5, 0, 7); x.fill();
    // 四联炮管（顶部两根 + 底部两根，前向）
    x.fillStyle = darkenColor(col, 0.55);
    rrPath(x, -r * 0.4, -r * 0.95, r * 0.14, r * 0.4, r * 0.04);
    x.fill();
    rrPath(x, r * 0.26, -r * 0.95, r * 0.14, r * 0.4, r * 0.04);
    x.fill();
    // 腹部指示灯
    x.fillStyle = '#ffd76a';
    x.beginPath(); x.arc(0, r * 0.38, r * 0.08, 0, 7); x.fill();
  },

  // 蜘蛛遥控器：手持终端 + 屏幕（十字准星）+ 顶部天线
  'spidertron-remote': (x, r, s, col) => {
    // 机身（竖向圆角矩形）
    const g = x.createLinearGradient(-r * 0.5, 0, r * 0.5, 0);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    rrPath(x, -r * 0.52, -r * 0.78, r * 1.04, r * 1.56, r * 0.2);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.45)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 顶部天线
    x.strokeStyle = '#3a3f4a';
    x.lineWidth = Math.max(1.2, s * 0.05);
    x.beginPath(); x.moveTo(0, -r * 0.78); x.lineTo(0, -r * 0.95); x.stroke();
    x.fillStyle = '#e05a5a';
    x.beginPath(); x.arc(0, -r * 0.95, r * 0.07, 0, 7); x.fill();
    // 屏幕
    x.fillStyle = '#101820';
    rrPath(x, -r * 0.36, -r * 0.6, r * 0.72, r * 0.72, r * 0.1);
    x.fill();
    // 屏内十字准星
    x.strokeStyle = '#7ee08a';
    x.lineWidth = Math.max(1.2, s * 0.04);
    x.beginPath();
    x.moveTo(0, -r * 0.44); x.lineTo(0, -r * 0.04);
    x.moveTo(-r * 0.24, -r * 0.24); x.lineTo(r * 0.24, -r * 0.24);
    x.stroke();
    // 准星中心点与外圈
    x.strokeStyle = 'rgba(126,224,138,.6)';
    x.beginPath(); x.arc(0, -r * 0.24, r * 0.2, 0, 7); x.stroke();
    x.fillStyle = '#7ee08a';
    x.beginPath(); x.arc(0, -r * 0.24, r * 0.05, 0, 7); x.fill();
    // 底部操作键
    x.fillStyle = 'rgba(255,255,255,.35)';
    x.beginPath(); x.arc(-r * 0.2, r * 0.42, r * 0.09, 0, 7); x.fill();
    x.beginPath(); x.arc(0, r * 0.42, r * 0.09, 0, 7); x.fill();
    x.beginPath(); x.arc(r * 0.2, r * 0.42, r * 0.09, 0, 7); x.fill();
  },

  // 铁轨：双钢轨 + 枕木（斜置一段弯轨视角简化为直段）
  'rail': (x, r, s, col) => {
    // 枕木
    x.fillStyle = '#7a5c3a';
    for (let i = 0; i < 4; i++) {
      const px = -r * 0.66 + i * r * 0.44;
      rrPath(x, px - r * 0.08, -r * 0.72, r * 0.16, r * 1.44, r * 0.05);
      x.fill();
    }
    // 枕木暗纹
    x.fillStyle = 'rgba(0,0,0,.18)';
    for (let i = 0; i < 4; i++) {
      const px = -r * 0.66 + i * r * 0.44;
      x.fillRect(px - r * 0.08, r * 0.5, r * 0.16, r * 0.22);
    }
    // 双钢轨（竖向，金属渐变）
    const railBar = (px) => {
      const g = x.createLinearGradient(px - r * 0.09, 0, px + r * 0.09, 0);
      g.addColorStop(0, lightenColor(col, 0.5));
      g.addColorStop(0.5, lightenColor(col, 0.15));
      g.addColorStop(1, darkenColor(col, 0.45));
      x.fillStyle = g;
      rrPath(x, px - r * 0.09, -r * 0.95, r * 0.18, r * 1.9, r * 0.05);
      x.fill();
      x.strokeStyle = 'rgba(0,0,0,.4)';
      x.lineWidth = Math.max(0.8, s * 0.03);
      x.stroke();
    };
    railBar(-r * 0.34);
    railBar(r * 0.34);
    // 轨顶高光
    x.strokeStyle = 'rgba(255,255,255,.45)';
    x.lineWidth = Math.max(1, s * 0.025);
    x.beginPath(); x.moveTo(-r * 0.34 - r * 0.03, -r * 0.9); x.lineTo(-r * 0.34 - r * 0.03, r * 0.9); x.stroke();
    x.beginPath(); x.moveTo(r * 0.34 - r * 0.03, -r * 0.9); x.lineTo(r * 0.34 - r * 0.03, r * 0.9); x.stroke();
  },

  // 火车头：俯视车头 + 驾驶室 + 前部排障器与车灯
  'locomotive': (x, r, s, col) => {
    // 车体（长圆角矩形，前尖后平）
    const g = x.createLinearGradient(0, -r * 0.95, 0, r * 0.95);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.42));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(-r * 0.5, -r * 0.62);
    x.quadraticCurveTo(0, -r * 0.98, r * 0.5, -r * 0.62);
    x.lineTo(r * 0.5, r * 0.85);
    x.quadraticCurveTo(0, r * 0.95, -r * 0.5, r * 0.85);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.45)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 驾驶室（后部深色块）
    x.fillStyle = 'rgba(0,0,0,.25)';
    rrPath(x, -r * 0.38, r * 0.28, r * 0.76, r * 0.52, r * 0.1);
    x.fill();
    // 驾驶室窗
    x.fillStyle = 'rgba(150,200,240,.6)';
    rrPath(x, -r * 0.22, r * 0.4, r * 0.44, r * 0.22, r * 0.06);
    x.fill();
    // 烟囱口
    x.fillStyle = '#22252b';
    x.beginPath(); x.arc(0, -r * 0.3, r * 0.16, 0, 7); x.fill();
    x.fillStyle = 'rgba(255,255,255,.15)';
    x.beginPath(); x.arc(-r * 0.05, -r * 0.35, r * 0.06, 0, 7); x.fill();
    // 前部车灯
    x.fillStyle = '#ffe9a0';
    x.beginPath(); x.arc(0, -r * 0.78, r * 0.1, 0, 7); x.fill();
    x.strokeStyle = 'rgba(255,233,160,.5)';
    x.lineWidth = Math.max(1, s * 0.03);
    x.beginPath(); x.arc(0, -r * 0.78, r * 0.18, 0, 7); x.stroke();
    // 排障器楔形
    x.fillStyle = '#4a4f56';
    x.beginPath();
    x.moveTo(-r * 0.5, -r * 0.55); x.lineTo(0, -r * 0.95); x.lineTo(r * 0.5, -r * 0.55);
    x.lineTo(r * 0.32, -r * 0.55); x.lineTo(0, -r * 0.82); x.lineTo(-r * 0.32, -r * 0.55);
    x.closePath();
    x.fill();
    // 车体中线
    x.strokeStyle = 'rgba(0,0,0,.22)';
    x.lineWidth = Math.max(1, s * 0.028);
    x.beginPath(); x.moveTo(0, -r * 0.2); x.lineTo(0, r * 0.8); x.stroke();
  },

  // 货运车厢：俯视木纹车厢 + 舱盖缝线 + 中央货箱
  'cargo-wagon': (x, r, s, col) => {
    // 车厢体
    const g = x.createLinearGradient(0, -r * 0.8, 0, r * 0.8);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    rrPath(x, -r * 0.62, -r * 0.72, r * 1.24, r * 1.44, r * 0.14);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.45)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 舱盖横向缝线
    x.strokeStyle = 'rgba(0,0,0,.22)';
    x.lineWidth = Math.max(1, s * 0.028);
    for (let i = 0; i < 3; i++) {
      const py = -r * 0.36 + i * r * 0.36;
      x.beginPath(); x.moveTo(-r * 0.56, py); x.lineTo(r * 0.56, py); x.stroke();
    }
    // 中央货箱（俯视小方箱）
    x.fillStyle = '#a8885c';
    rrPath(x, -r * 0.26, -r * 0.26, r * 0.52, r * 0.52, r * 0.06);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.4)';
    x.lineWidth = Math.max(1, s * 0.035);
    x.stroke();
    // 货箱盖十字木条
    x.strokeStyle = 'rgba(0,0,0,.3)';
    x.beginPath();
    x.moveTo(-r * 0.26, -r * 0.26); x.lineTo(r * 0.26, r * 0.26);
    x.moveTo(r * 0.26, -r * 0.26); x.lineTo(-r * 0.26, r * 0.26);
    x.stroke();
    // 车厢四角铆钉
    x.fillStyle = 'rgba(255,255,255,.3)';
    [[-0.5, -0.6], [0.5, -0.6], [-0.5, 0.6], [0.5, 0.6]].forEach(p => {
      x.beginPath(); x.arc(p[0] * r, p[1] * r, r * 0.05, 0, 7); x.fill();
    });
  },

  // 流体车厢：俯视罐车 + 大圆柱罐体 + 罐顶入料口
  'fluid-wagon': (x, r, s, col) => {
    // 底盘（前后短梁）
    x.fillStyle = '#3a3f46';
    rrPath(x, -r * 0.75, -r * 0.2, r * 0.22, r * 0.4, r * 0.06);
    x.fill();
    rrPath(x, r * 0.53, -r * 0.2, r * 0.22, r * 0.4, r * 0.06);
    x.fill();
    // 卧式圆柱罐体（竖向）
    const g = x.createLinearGradient(-r * 0.5, 0, r * 0.5, 0);
    g.addColorStop(0, lightenColor(col, 0.45));
    g.addColorStop(0.5, col);
    g.addColorStop(1, darkenColor(col, 0.42));
    x.fillStyle = g;
    rrPath(x, -r * 0.5, -r * 0.78, r * 1.0, r * 1.56, r * 0.42);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.45)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 罐体环箍
    x.strokeStyle = 'rgba(0,0,0,.25)';
    x.lineWidth = Math.max(1.2, s * 0.04);
    x.beginPath(); x.moveTo(-r * 0.44, -r * 0.3); x.quadraticCurveTo(0, -r * 0.36, r * 0.44, -r * 0.3); x.stroke();
    x.beginPath(); x.moveTo(-r * 0.44, r * 0.3); x.quadraticCurveTo(0, r * 0.24, r * 0.44, r * 0.3); x.stroke();
    // 罐顶入料口
    x.fillStyle = darkenColor(col, 0.4);
    x.beginPath(); x.ellipse(0, 0, r * 0.2, r * 0.26, 0, 0, 7); x.fill();
    x.fillStyle = '#101820';
    x.beginPath(); x.ellipse(0, 0, r * 0.13, r * 0.18, 0, 0, 7); x.fill();
    // 罐顶高光
    x.strokeStyle = 'rgba(255,255,255,.4)';
    x.lineWidth = Math.max(1, s * 0.03);
    x.beginPath(); x.arc(-r * 0.12, 0, r * 0.5, Math.PI * 0.7, Math.PI * 1.3); x.stroke();
  },

  // 炮兵车厢：俯视装甲车厢 + 伸出的巨型炮管
  'artillery-wagon': (x, r, s, col) => {
    // 车厢体（装甲绿灰）
    const g = x.createLinearGradient(0, -r * 0.8, 0, r * 0.8);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.42));
    x.fillStyle = g;
    rrPath(x, -r * 0.6, -r * 0.55, r * 1.2, r * 1.1, r * 0.14);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.45)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 装甲缝线
    x.strokeStyle = 'rgba(0,0,0,.22)';
    x.lineWidth = Math.max(1, s * 0.028);
    x.beginPath(); x.moveTo(-r * 0.54, -r * 0.18); x.lineTo(r * 0.54, -r * 0.18); x.stroke();
    x.beginPath(); x.moveTo(-r * 0.54, r * 0.18); x.lineTo(r * 0.54, r * 0.18); x.stroke();
    // 巨型炮管（朝前伸出）
    const bg = x.createLinearGradient(-r * 0.16, 0, r * 0.16, 0);
    bg.addColorStop(0, lightenColor(col, 0.3));
    bg.addColorStop(0.6, darkenColor(col, 0.2));
    bg.addColorStop(1, darkenColor(col, 0.5));
    x.fillStyle = bg;
    rrPath(x, -r * 0.16, -r * 0.98, r * 0.32, r * 0.6, r * 0.06);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.45)';
    x.lineWidth = Math.max(1, s * 0.035);
    x.stroke();
    // 炮口套环
    x.fillStyle = darkenColor(col, 0.55);
    rrPath(x, -r * 0.2, -r * 0.98, r * 0.4, r * 0.16, r * 0.05);
    x.fill();
    // 炮塔基座
    x.fillStyle = darkenColor(col, 0.3);
    x.beginPath(); x.arc(0, -r * 0.2, r * 0.3, 0, 7); x.fill();
    x.strokeStyle = 'rgba(0,0,0,.4)';
    x.stroke();
    // 后部弹药舱指示
    x.fillStyle = '#c8a040';
    rrPath(x, -r * 0.3, r * 0.35, r * 0.6, r * 0.16, r * 0.05);
    x.fill();
  },

  // 车站：站牌（立柱 + 停车标志牌 P 字）
  'train-stop': (x, r, s, col) => {
    // 立柱
    x.fillStyle = '#4a5058';
    rrPath(x, -r * 0.09, -r * 0.2, r * 0.18, r * 1.0, r * 0.05);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.4)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.stroke();
    // 底座
    x.fillStyle = '#3a3f46';
    rrPath(x, -r * 0.3, r * 0.68, r * 0.6, r * 0.22, r * 0.06);
    x.fill();
    // 标志牌（圆角方牌）
    const g = x.createLinearGradient(0, -r * 0.9, 0, r * 0.1);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(1, darkenColor(col, 0.3));
    x.fillStyle = g;
    rrPath(x, -r * 0.55, -r * 0.9, r * 1.1, r * 1.0, r * 0.16);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.45)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 牌面白色内框
    x.strokeStyle = 'rgba(255,255,255,.5)';
    x.lineWidth = Math.max(1, s * 0.03);
    rrPath(x, -r * 0.44, -r * 0.79, r * 0.88, r * 0.78, r * 0.1);
    x.stroke();
    // 停车字标「停」简写 T + 横杠（列车停驶标识）
    x.fillStyle = '#fff';
    x.font = 'bold ' + Math.round(r * 0.62) + 'px system-ui';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('P', 0, -r * 0.38);
  },

  // 铁路信号灯：立柱 + 红色灯头（占用）
  'rail-signal': (x, r, s, col) => {
    // 立柱
    x.fillStyle = '#4a5058';
    rrPath(x, -r * 0.1, -r * 0.15, r * 0.2, r * 1.05, r * 0.06);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.4)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.stroke();
    // 底座
    x.fillStyle = '#3a3f46';
    rrPath(x, -r * 0.32, r * 0.72, r * 0.64, r * 0.24, r * 0.07);
    x.fill();
    // 灯箱（圆角矩形壳）
    x.fillStyle = '#2a2e34';
    rrPath(x, -r * 0.32, -r * 0.95, r * 0.64, r * 0.95, r * 0.14);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.5)';
    x.stroke();
    // 红灯（发光）
    x.fillStyle = '#ff4d4d';
    x.beginPath(); x.arc(0, -r * 0.62, r * 0.2, 0, 7); x.fill();
    x.strokeStyle = 'rgba(255,120,120,.55)';
    x.lineWidth = Math.max(2, s * 0.08);
    x.beginPath(); x.arc(0, -r * 0.62, r * 0.28, 0, 7); x.stroke();
    // 备用灯位（暗绿）
    x.fillStyle = '#1e3a24';
    x.beginPath(); x.arc(0, -r * 0.22, r * 0.14, 0, 7); x.fill();
    // 灯箱高光
    x.fillStyle = 'rgba(255,255,255,.12)';
    rrPath(x, -r * 0.26, -r * 0.9, r * 0.2, r * 0.8, r * 0.08);
    x.fill();
  },

  // 铁路链式信号灯：立柱 + 琥珀灯头 + 链环标识
  'rail-chain-signal': (x, r, s, col) => {
    // 立柱
    x.fillStyle = '#4a5058';
    rrPath(x, -r * 0.1, -r * 0.15, r * 0.2, r * 1.05, r * 0.06);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.4)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.stroke();
    // 底座
    x.fillStyle = '#3a3f46';
    rrPath(x, -r * 0.32, r * 0.72, r * 0.64, r * 0.24, r * 0.07);
    x.fill();
    // 灯箱
    x.fillStyle = '#2a2e34';
    rrPath(x, -r * 0.32, -r * 0.95, r * 0.64, r * 0.95, r * 0.14);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.5)';
    x.stroke();
    // 琥珀灯（发光）
    x.fillStyle = '#ffb84d';
    x.beginPath(); x.arc(0, -r * 0.62, r * 0.2, 0, 7); x.fill();
    x.strokeStyle = 'rgba(255,200,120,.55)';
    x.lineWidth = Math.max(2, s * 0.08);
    x.beginPath(); x.arc(0, -r * 0.62, r * 0.28, 0, 7); x.stroke();
    // 备用灯位（暗绿）
    x.fillStyle = '#1e3a24';
    x.beginPath(); x.arc(0, -r * 0.22, r * 0.14, 0, 7); x.fill();
    // 链环标识（灯箱下部小链环）
    x.strokeStyle = '#c8ccd4';
    x.lineWidth = Math.max(1.2, s * 0.035);
    x.beginPath();
    x.ellipse(-r * 0.09, r * 0.42, r * 0.09, r * 0.06, 0, 0, 7);
    x.stroke();
    x.beginPath();
    x.ellipse(r * 0.09, r * 0.42, r * 0.09, r * 0.06, 0, 0, 7);
    x.stroke();
    // 灯箱高光
    x.fillStyle = 'rgba(255,255,255,.12)';
    rrPath(x, -r * 0.26, -r * 0.9, r * 0.2, r * 0.8, r * 0.08);
    x.fill();
  },

  // 高架桥墩：正视混凝土桥墩 + 交叉桁架撑 + 顶部轨排
  'rail-support': (x, r, s, col) => {
    // 顶部轨排（桥面）
    x.fillStyle = '#6a6a78';
    rrPath(x, -r * 0.9, -r * 0.95, r * 1.8, r * 0.26, r * 0.06);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.45)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 桥面上两条钢轨头
    x.fillStyle = '#c8ccd4';
    x.fillRect(-r * 0.5, -r * 0.99, r * 0.12, r * 0.1);
    x.fillRect(r * 0.38, -r * 0.99, r * 0.12, r * 0.1);
    // 墩柱
    const g = x.createLinearGradient(-r * 0.34, 0, r * 0.34, 0);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(0.5, lightenColor(col, 0.08));
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    rrPath(x, -r * 0.3, -r * 0.72, r * 0.6, r * 1.5, r * 0.08);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.45)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 交叉桁架撑
    x.strokeStyle = darkenColor(col, 0.5);
    x.lineWidth = Math.max(1.2, s * 0.055);
    x.beginPath();
    x.moveTo(-r * 0.24, -r * 0.5); x.lineTo(r * 0.24, r * 0.0);
    x.moveTo(r * 0.24, -r * 0.5); x.lineTo(-r * 0.24, r * 0.0);
    x.moveTo(-r * 0.24, r * 0.05); x.lineTo(r * 0.24, r * 0.55);
    x.moveTo(r * 0.24, r * 0.05); x.lineTo(-r * 0.24, r * 0.55);
    x.stroke();
    // 横撑
    x.strokeStyle = lightenColor(col, 0.2);
    x.lineWidth = Math.max(1, s * 0.04);
    x.beginPath();
    x.moveTo(-r * 0.26, -r * 0.24); x.lineTo(r * 0.26, -r * 0.24);
    x.moveTo(-r * 0.26, r * 0.3); x.lineTo(r * 0.26, r * 0.3);
    x.stroke();
    // 宽基座
    const bg = x.createLinearGradient(0, r * 0.62, 0, r * 0.95);
    bg.addColorStop(0, lightenColor(col, 0.25));
    bg.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = bg;
    rrPath(x, -r * 0.7, r * 0.62, r * 1.4, r * 0.34, r * 0.07);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.45)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 墩身高光
    x.fillStyle = 'rgba(255,255,255,.22)';
    x.fillRect(-r * 0.22, -r * 0.68, r * 0.1, r * 1.4);
  },

  // 高架铁轨：斜向上坡轨排 + 白色上行箭头
  'rail-ramp': (x, r, s, col) => {
    x.save();
    x.rotate(-Math.PI / 6);
    // 枕木
    x.fillStyle = '#7a5c3a';
    for (let i = 0; i < 4; i++) {
      const py = -r * 0.62 + i * r * 0.42;
      rrPath(x, -r * 0.72, py - r * 0.08, r * 1.44, r * 0.16, r * 0.05);
      x.fill();
    }
    // 双钢轨（横向，沿坡向）
    const railBar = (py) => {
      const g = x.createLinearGradient(0, py - r * 0.09, 0, py + r * 0.09);
      g.addColorStop(0, lightenColor(col, 0.5));
      g.addColorStop(0.5, lightenColor(col, 0.15));
      g.addColorStop(1, darkenColor(col, 0.45));
      x.fillStyle = g;
      rrPath(x, -r * 0.95, py - r * 0.09, r * 1.9, r * 0.18, r * 0.05);
      x.fill();
      x.strokeStyle = 'rgba(0,0,0,.4)';
      x.lineWidth = Math.max(0.8, s * 0.03);
      x.stroke();
    };
    railBar(-r * 0.34);
    railBar(r * 0.34);
    // 轨顶高光
    x.strokeStyle = 'rgba(255,255,255,.45)';
    x.lineWidth = Math.max(1, s * 0.025);
    x.beginPath(); x.moveTo(-r * 0.9, -r * 0.37); x.lineTo(r * 0.9, -r * 0.37); x.stroke();
    // 坡度角标
    x.strokeStyle = '#e8b23c';
    x.lineWidth = Math.max(1.2, s * 0.05);
    x.beginPath(); x.arc(0, 0, r * 0.16, Math.PI * 0.9, Math.PI * 1.4); x.stroke();
    x.restore();
    // 上行箭头
    x.fillStyle = 'rgba(255,255,255,.92)';
    x.beginPath();
    x.moveTo(0, -r * 0.28);
    x.lineTo(r * 0.22, r * 0.05);
    x.lineTo(r * 0.09, r * 0.05);
    x.lineTo(r * 0.09, r * 0.42);
    x.lineTo(-r * 0.09, r * 0.42);
    x.lineTo(-r * 0.09, r * 0.05);
    x.lineTo(-r * 0.22, r * 0.05);
    x.closePath();
    x.fill();
  },

  // 玉玛果人造土：褐色耕作土砖 + 垄沟 + 幼苗
  'artificial-yumako-soil': (x, r, s, col) => {
    const g = x.createLinearGradient(0, -r * 0.8, 0, r * 0.8);
    g.addColorStop(0, lightenColor(col, 0.3));
    g.addColorStop(1, darkenColor(col, 0.35));
    x.fillStyle = g;
    rrPath(x, -r * 0.8, -r * 0.8, r * 1.6, r * 1.6, r * 0.16);
    x.fill();
    x.strokeStyle = 'rgba(30,20,10,.5)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 垄沟
    x.strokeStyle = 'rgba(30,20,10,.4)';
    x.lineWidth = Math.max(1, s * 0.05);
    for (let i = 0; i < 3; i++) {
      const py = -r * 0.4 + i * r * 0.42;
      x.beginPath();
      x.moveTo(-r * 0.66, py);
      x.quadraticCurveTo(0, py + r * 0.1, r * 0.66, py);
      x.stroke();
    }
    // 幼苗（两片叶 + 茎）
    x.strokeStyle = '#5aa03f';
    x.lineWidth = Math.max(1.5, s * 0.06);
    x.lineCap = 'round';
    x.beginPath(); x.moveTo(0, r * 0.28); x.quadraticCurveTo(r * 0.04, 0, 0, -r * 0.3); x.stroke();
    x.fillStyle = '#6fbf4f';
    x.beginPath(); x.ellipse(-r * 0.18, -r * 0.22, r * 0.19, r * 0.11, -0.6, 0, 7); x.fill();
    x.beginPath(); x.ellipse(r * 0.18, -r * 0.3, r * 0.19, r * 0.11, 0.6, 0, 7); x.fill();
    // 种子点
    x.fillStyle = '#3a2a18';
    x.beginPath(); x.arc(-r * 0.42, r * 0.5, r * 0.05, 0, 7); x.fill();
    x.beginPath(); x.arc(r * 0.4, r * 0.52, r * 0.05, 0, 7); x.fill();
  },

  // 玉玛果沃土：深色沃土 + 茂盛双叶苗 + 养分光点
  'overgrowth-yumako-soil': (x, r, s, col) => {
    const g = x.createLinearGradient(0, -r * 0.8, 0, r * 0.8);
    g.addColorStop(0, lightenColor(col, 0.32));
    g.addColorStop(1, darkenColor(col, 0.38));
    x.fillStyle = g;
    rrPath(x, -r * 0.8, -r * 0.8, r * 1.6, r * 1.6, r * 0.16);
    x.fill();
    x.strokeStyle = 'rgba(20,14,8,.55)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 垄沟
    x.strokeStyle = 'rgba(20,14,8,.42)';
    x.lineWidth = Math.max(1, s * 0.05);
    for (let i = 0; i < 3; i++) {
      const py = -r * 0.4 + i * r * 0.42;
      x.beginPath();
      x.moveTo(-r * 0.66, py);
      x.quadraticCurveTo(0, py + r * 0.1, r * 0.66, py);
      x.stroke();
    }
    // 茂盛幼苗（四片叶）
    x.strokeStyle = '#4a8a35';
    x.lineWidth = Math.max(1.5, s * 0.06);
    x.lineCap = 'round';
    x.beginPath(); x.moveTo(0, r * 0.3); x.quadraticCurveTo(0.04 * r, 0, 0, -r * 0.34); x.stroke();
    x.fillStyle = '#7ecf56';
    [[-0.24, -0.24, -0.7], [0.24, -0.32, 0.7], [-0.3, 0.02, -0.5], [0.3, -0.06, 0.5]].forEach(l => {
      x.beginPath(); x.ellipse(l[0] * r, l[1] * r, r * 0.2, r * 0.11, l[2], 0, 7); x.fill();
    });
    // 养分光点
    x.fillStyle = 'rgba(180,240,150,.75)';
    [[-0.5, -0.52], [0.55, -0.45], [0.45, 0.55]].forEach(p => {
      x.beginPath(); x.arc(p[0] * r, p[1] * r, r * 0.06, 0, 7); x.fill();
    });
  },

  // 果冻果人造土：紫红耕作土砖 + 垄沟 + 果冻色嫩芽
  'artificial-jellynut-soil': (x, r, s, col) => {
    const g = x.createLinearGradient(0, -r * 0.8, 0, r * 0.8);
    g.addColorStop(0, lightenColor(col, 0.3));
    g.addColorStop(1, darkenColor(col, 0.35));
    x.fillStyle = g;
    rrPath(x, -r * 0.8, -r * 0.8, r * 1.6, r * 1.6, r * 0.16);
    x.fill();
    x.strokeStyle = 'rgba(40,14,24,.5)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 垄沟
    x.strokeStyle = 'rgba(40,14,24,.4)';
    x.lineWidth = Math.max(1, s * 0.05);
    for (let i = 0; i < 3; i++) {
      const py = -r * 0.4 + i * r * 0.42;
      x.beginPath();
      x.moveTo(-r * 0.66, py);
      x.quadraticCurveTo(0, py + r * 0.1, r * 0.66, py);
      x.stroke();
    }
    // 果冻色嫩芽
    x.strokeStyle = '#b05a8a';
    x.lineWidth = Math.max(1.5, s * 0.06);
    x.lineCap = 'round';
    x.beginPath(); x.moveTo(0, r * 0.28); x.quadraticCurveTo(r * 0.04, 0, 0, -r * 0.28); x.stroke();
    x.fillStyle = '#e07ab0';
    x.beginPath(); x.ellipse(-r * 0.17, -r * 0.2, r * 0.18, r * 0.11, -0.6, 0, 7); x.fill();
    x.beginPath(); x.ellipse(r * 0.17, -r * 0.28, r * 0.18, r * 0.11, 0.6, 0, 7); x.fill();
    // 种子点
    x.fillStyle = '#40182a';
    x.beginPath(); x.arc(-r * 0.42, r * 0.5, r * 0.05, 0, 7); x.fill();
    x.beginPath(); x.arc(r * 0.4, r * 0.52, r * 0.05, 0, 7); x.fill();
  },

  // 果冻果沃土：深紫沃土 + 茂盛果冻苗 + 养分光点
  'overgrowth-jellynut-soil': (x, r, s, col) => {
    const g = x.createLinearGradient(0, -r * 0.8, 0, r * 0.8);
    g.addColorStop(0, lightenColor(col, 0.34));
    g.addColorStop(1, darkenColor(col, 0.38));
    x.fillStyle = g;
    rrPath(x, -r * 0.8, -r * 0.8, r * 1.6, r * 1.6, r * 0.16);
    x.fill();
    x.strokeStyle = 'rgba(30,10,20,.55)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 垄沟
    x.strokeStyle = 'rgba(30,10,20,.42)';
    x.lineWidth = Math.max(1, s * 0.05);
    for (let i = 0; i < 3; i++) {
      const py = -r * 0.4 + i * r * 0.42;
      x.beginPath();
      x.moveTo(-r * 0.66, py);
      x.quadraticCurveTo(0, py + r * 0.1, r * 0.66, py);
      x.stroke();
    }
    // 茂盛果冻苗（四片叶）
    x.strokeStyle = '#9a4a70';
    x.lineWidth = Math.max(1.5, s * 0.06);
    x.lineCap = 'round';
    x.beginPath(); x.moveTo(0, r * 0.3); x.quadraticCurveTo(0.04 * r, 0, 0, -r * 0.34); x.stroke();
    x.fillStyle = '#f090c0';
    [[-0.24, -0.24, -0.7], [0.24, -0.32, 0.7], [-0.3, 0.02, -0.5], [0.3, -0.06, 0.5]].forEach(l => {
      x.beginPath(); x.ellipse(l[0] * r, l[1] * r, r * 0.2, r * 0.11, l[2], 0, 7); x.fill();
    });
    // 养分光点
    x.fillStyle = 'rgba(255,190,225,.75)';
    [[-0.5, -0.52], [0.55, -0.45], [0.45, 0.55]].forEach(p => {
      x.beginPath(); x.arc(p[0] * r, p[1] * r, r * 0.06, 0, 7); x.fill();
    });
  },

  // 机器人港：大型八角基座 + 双天线 + 充能圆盘 + 警示条纹
  'roboport': (x, r, s, col) => {
    // 八角主体
    const g = x.createLinearGradient(0, -r * 0.85, 0, r * 0.85);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.42));
    x.fillStyle = g;
    x.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 + Math.PI / 8;
      const px = Math.cos(a) * r * 0.82, py = Math.sin(a) * r * 0.82;
      i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    }
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.48)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 充能圆盘
    const dg = x.createRadialGradient(-r * 0.08, -r * 0.08, r * 0.05, 0, 0, r * 0.4);
    dg.addColorStop(0, lightenColor(col, 0.55));
    dg.addColorStop(1, darkenColor(col, 0.35));
    x.fillStyle = dg;
    x.beginPath(); x.arc(0, r * 0.02, r * 0.38, 0, 7); x.fill();
    x.strokeStyle = 'rgba(0,0,0,.4)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 圆盘内上下箭头（机器人进出港）
    x.strokeStyle = '#123a3a';
    x.lineWidth = Math.max(1.5, s * 0.06);
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(-r * 0.14, -r * 0.16); x.lineTo(-r * 0.14, r * 0.2);
    x.moveTo(-r * 0.14, r * 0.2); x.lineTo(-r * 0.2, r * 0.12);
    x.moveTo(-r * 0.14, r * 0.2); x.lineTo(-r * 0.08, r * 0.12);
    x.moveTo(r * 0.14, r * 0.2); x.lineTo(r * 0.14, -r * 0.16);
    x.moveTo(r * 0.14, -r * 0.16); x.lineTo(r * 0.08, -r * 0.08);
    x.moveTo(r * 0.14, -r * 0.16); x.lineTo(r * 0.2, -r * 0.08);
    x.stroke();
    // 双天线
    x.strokeStyle = '#2a4a4a';
    x.lineWidth = Math.max(1.2, s * 0.05);
    [[-0.4, -0.72], [0.4, -0.72]].forEach(p => {
      x.beginPath(); x.moveTo(p[0] * r, p[1] * r + r * 0.14); x.lineTo(p[0] * r, p[1] * r - r * 0.14); x.stroke();
      x.fillStyle = '#ffd43b';
      x.beginPath(); x.arc(p[0] * r, p[1] * r - r * 0.18, r * 0.08, 0, 7); x.fill();
    });
    // 底部警示条纹
    x.save();
    x.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4 + Math.PI / 8;
      const px = Math.cos(a) * r * 0.82, py = Math.sin(a) * r * 0.82;
      i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    }
    x.closePath();
    x.clip();
    x.fillStyle = '#e8b23c';
    x.fillRect(-r * 0.9, r * 0.55, r * 1.8, r * 0.2);
    x.fillStyle = '#2a2a30';
    for (let i = 0; i < 5; i++) {
      x.fillRect(-r * 0.9 + i * r * 0.42, r * 0.55, r * 0.2, r * 0.2);
    }
    x.restore();
  },

  // 物流机器人：俯视飞行机器人 + 双旋翼 + 蓝色机身 + 货斗
  'logistic-robot': (x, r, s, col) => {
    // 旋翼臂（横穿）
    x.strokeStyle = '#3a444e';
    x.lineWidth = Math.max(1.5, s * 0.07);
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(-r * 0.95, -r * 0.4); x.lineTo(r * 0.95, -r * 0.4);
    x.moveTo(-r * 0.95, r * 0.4); x.lineTo(r * 0.95, r * 0.4);
    x.stroke();
    // 旋翼残影（半透明圆盘）
    x.fillStyle = 'rgba(200,220,235,.28)';
    [[-0.72, -0.4], [0.72, -0.4], [-0.72, 0.4], [0.72, 0.4]].forEach(p => {
      x.beginPath(); x.arc(p[0] * r, p[1] * r, r * 0.26, 0, 7); x.fill();
    });
    // 旋翼中心毂
    x.fillStyle = '#5a646e';
    [[-0.72, -0.4], [0.72, -0.4], [-0.72, 0.4], [0.72, 0.4]].forEach(p => {
      x.beginPath(); x.arc(p[0] * r, p[1] * r, r * 0.09, 0, 7); x.fill();
    });
    // 机身（纵向胶囊）
    const g = x.createLinearGradient(0, -r * 0.6, 0, r * 0.6);
    g.addColorStop(0, lightenColor(col, 0.45));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    rrPath(x, -r * 0.34, -r * 0.62, r * 0.68, r * 1.24, r * 0.3);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.48)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 感应眼（前部）
    x.fillStyle = '#ffe24a';
    x.beginPath(); x.arc(0, -r * 0.34, r * 0.1, 0, 7); x.fill();
    // 货斗（后部开口）
    x.fillStyle = darkenColor(col, 0.5);
    rrPath(x, -r * 0.24, r * 0.3, r * 0.48, r * 0.3, r * 0.08);
    x.fill();
    x.strokeStyle = 'rgba(255,255,255,.3)';
    x.lineWidth = Math.max(1, s * 0.025);
    x.stroke();
    // 机身高光
    x.fillStyle = 'rgba(255,255,255,.3)';
    rrPath(x, -r * 0.22, -r * 0.56, r * 0.12, r * 0.7, r * 0.06);
    x.fill();
  },

  // 施工机器人：俯视飞行机器人 + X 形旋翼臂 + 橙色机身 + 扳手爪
  'construction-robot': (x, r, s, col) => {
    // X 形旋翼臂
    x.strokeStyle = '#4a4038';
    x.lineWidth = Math.max(1.5, s * 0.07);
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(-r * 0.88, -r * 0.5); x.lineTo(r * 0.88, r * 0.5);
    x.moveTo(r * 0.88, -r * 0.5); x.lineTo(-r * 0.88, r * 0.5);
    x.stroke();
    // 旋翼残影
    x.fillStyle = 'rgba(235,215,190,.3)';
    [[-0.66, -0.38], [0.66, 0.38], [0.66, -0.38], [-0.66, 0.38]].forEach(p => {
      x.beginPath(); x.arc(p[0] * r, p[1] * r, r * 0.24, 0, 7); x.fill();
    });
    x.fillStyle = '#6a6058';
    [[-0.66, -0.38], [0.66, 0.38], [0.66, -0.38], [-0.66, 0.38]].forEach(p => {
      x.beginPath(); x.arc(p[0] * r, p[1] * r, r * 0.08, 0, 7); x.fill();
    });
    // 机身
    const g = x.createLinearGradient(0, -r * 0.6, 0, r * 0.6);
    g.addColorStop(0, lightenColor(col, 0.45));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    rrPath(x, -r * 0.36, -r * 0.58, r * 0.72, r * 1.16, r * 0.28);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.48)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 感应眼
    x.fillStyle = '#ffe24a';
    x.beginPath(); x.arc(0, -r * 0.3, r * 0.1, 0, 7); x.fill();
    // 前部扳手（施工标识）
    x.strokeStyle = '#c8ccd4';
    x.lineWidth = Math.max(2, s * 0.09);
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(-r * 0.16, r * 0.12); x.lineTo(r * 0.16, r * 0.44);
    x.stroke();
    x.strokeStyle = '#c8ccd4';
    x.lineWidth = Math.max(1.2, s * 0.05);
    x.beginPath(); x.arc(r * 0.2, r * 0.48, r * 0.1, Math.PI * 0.7, Math.PI * 1.9); x.stroke();
    // 机身高光
    x.fillStyle = 'rgba(255,255,255,.3)';
    rrPath(x, -r * 0.23, -r * 0.52, r * 0.12, r * 0.62, r * 0.06);
    x.fill();
  },

  // 被动供应箱：红色物流箱 + 箱盖 + 白色下行供应箭头
  'passive-provider-chest': (x, r, s, col) => {
    const g = x.createLinearGradient(-r * 0.8, -r * 0.7, r * 0.8, r * 0.75);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(1, darkenColor(col, 0.35));
    x.fillStyle = g;
    rrPath(x, -r * 0.8, -r * 0.55, r * 1.6, r * 1.28, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.45)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 箱盖
    const lg = x.createLinearGradient(0, -r * 0.85, 0, -r * 0.5);
    lg.addColorStop(0, lightenColor(col, 0.5));
    lg.addColorStop(1, lightenColor(col, 0.1));
    x.fillStyle = lg;
    rrPath(x, -r * 0.85, -r * 0.85, r * 1.7, r * 0.36, r * 0.1);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.45)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 下行供应箭头（机器人取货送出）
    x.fillStyle = 'rgba(255,255,255,.92)';
    x.beginPath();
    x.moveTo(0, -r * 0.28);
    x.lineTo(r * 0.22, r * 0.02);
    x.lineTo(r * 0.09, r * 0.02);
    x.lineTo(r * 0.09, r * 0.36);
    x.lineTo(-r * 0.09, r * 0.36);
    x.lineTo(-r * 0.09, r * 0.02);
    x.lineTo(-r * 0.22, r * 0.02);
    x.closePath();
    x.fill();
    // 四角铆钉
    x.fillStyle = lightenColor(col, 0.5);
    [[-0.62, -0.36], [0.62, -0.36], [-0.62, 0.54], [0.62, 0.54]].forEach(p => {
      x.beginPath(); x.arc(p[0] * r, p[1] * r, r * 0.06, 0, 7); x.fill();
    });
  },

  // 主动供应箱：紫色物流箱 + 上行箭头（机器人优先取货送出）
  'active-provider-chest': (x, r, s, col) => {
    const g = x.createLinearGradient(-r * 0.8, -r * 0.7, r * 0.8, r * 0.75);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(1, darkenColor(col, 0.35));
    x.fillStyle = g;
    rrPath(x, -r * 0.8, -r * 0.55, r * 1.6, r * 1.28, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.45)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 箱盖
    const lg = x.createLinearGradient(0, -r * 0.85, 0, -r * 0.5);
    lg.addColorStop(0, lightenColor(col, 0.5));
    lg.addColorStop(1, lightenColor(col, 0.1));
    x.fillStyle = lg;
    rrPath(x, -r * 0.85, -r * 0.85, r * 1.7, r * 0.36, r * 0.1);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.45)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 上行供应箭头（货物主动送出网络）
    x.fillStyle = 'rgba(255,255,255,.92)';
    x.beginPath();
    x.moveTo(0, -r * 0.4);
    x.lineTo(r * 0.24, -r * 0.08);
    x.lineTo(r * 0.1, -r * 0.08);
    x.lineTo(r * 0.1, r * 0.3);
    x.lineTo(-r * 0.1, r * 0.3);
    x.lineTo(-r * 0.1, -r * 0.08);
    x.lineTo(-r * 0.24, -r * 0.08);
    x.closePath();
    x.fill();
    // 四角铆钉
    x.fillStyle = lightenColor(col, 0.5);
    [[-0.62, -0.36], [0.62, -0.36], [-0.62, 0.54], [0.62, 0.54]].forEach(p => {
      x.beginPath(); x.arc(p[0] * r, p[1] * r, r * 0.06, 0, 7); x.fill();
    });
  },

  // 仓储箱：黄色物流箱 + 空心方框（收纳/存储标识）
  'storage-chest': (x, r, s, col) => {
    const g = x.createLinearGradient(-r * 0.8, -r * 0.7, r * 0.8, r * 0.75);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(1, darkenColor(col, 0.35));
    x.fillStyle = g;
    rrPath(x, -r * 0.8, -r * 0.55, r * 1.6, r * 1.28, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.45)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 箱盖
    const lg = x.createLinearGradient(0, -r * 0.85, 0, -r * 0.5);
    lg.addColorStop(0, lightenColor(col, 0.5));
    lg.addColorStop(1, lightenColor(col, 0.1));
    x.fillStyle = lg;
    rrPath(x, -r * 0.85, -r * 0.85, r * 1.7, r * 0.36, r * 0.1);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.45)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 空心方框（收纳标识）
    x.strokeStyle = 'rgba(255,255,255,.92)';
    x.lineWidth = Math.max(1.4, s * 0.07);
    rrPath(x, -r * 0.3, -r * 0.32, r * 0.6, r * 0.6, r * 0.08);
    x.stroke();
    // 四角铆钉
    x.fillStyle = lightenColor(col, 0.5);
    [[-0.62, -0.36], [0.62, -0.36], [-0.62, 0.54], [0.62, 0.54]].forEach(p => {
      x.beginPath(); x.arc(p[0] * r, p[1] * r, r * 0.06, 0, 7); x.fill();
    });
  },

  // 缓冲箱：绿色物流箱 + 双向箭头（既收又供，中转缓冲）
  'buffer-chest': (x, r, s, col) => {
    const g = x.createLinearGradient(-r * 0.8, -r * 0.7, r * 0.8, r * 0.75);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(1, darkenColor(col, 0.35));
    x.fillStyle = g;
    rrPath(x, -r * 0.8, -r * 0.55, r * 1.6, r * 1.28, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.45)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 箱盖
    const lg = x.createLinearGradient(0, -r * 0.85, 0, -r * 0.5);
    lg.addColorStop(0, lightenColor(col, 0.5));
    lg.addColorStop(1, lightenColor(col, 0.1));
    x.fillStyle = lg;
    rrPath(x, -r * 0.85, -r * 0.85, r * 1.7, r * 0.36, r * 0.1);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.45)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 左右双向箭头
    x.fillStyle = 'rgba(255,255,255,.92)';
    x.beginPath();
    x.moveTo(-r * 0.46, 0);
    x.lineTo(-r * 0.2, -r * 0.2);
    x.lineTo(-r * 0.2, -r * 0.08);
    x.lineTo(r * 0.2, -r * 0.08);
    x.lineTo(r * 0.2, -r * 0.2);
    x.lineTo(r * 0.46, 0);
    x.lineTo(r * 0.2, r * 0.2);
    x.lineTo(r * 0.2, r * 0.08);
    x.lineTo(-r * 0.2, r * 0.08);
    x.lineTo(-r * 0.2, r * 0.2);
    x.closePath();
    x.fill();
    // 四角铆钉
    x.fillStyle = lightenColor(col, 0.5);
    [[-0.62, -0.36], [0.62, -0.36], [-0.62, 0.54], [0.62, 0.54]].forEach(p => {
      x.beginPath(); x.arc(p[0] * r, p[1] * r, r * 0.06, 0, 7); x.fill();
    });
  },

  // 需求箱：蓝色物流箱 + 对勾（按请求补足货物）
  'requester-chest': (x, r, s, col) => {
    const g = x.createLinearGradient(-r * 0.8, -r * 0.7, r * 0.8, r * 0.75);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(1, darkenColor(col, 0.35));
    x.fillStyle = g;
    rrPath(x, -r * 0.8, -r * 0.55, r * 1.6, r * 1.28, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.45)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 箱盖
    const lg = x.createLinearGradient(0, -r * 0.85, 0, -r * 0.5);
    lg.addColorStop(0, lightenColor(col, 0.5));
    lg.addColorStop(1, lightenColor(col, 0.1));
    x.fillStyle = lg;
    rrPath(x, -r * 0.85, -r * 0.85, r * 1.7, r * 0.36, r * 0.1);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.45)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 对勾（需求满足标识）
    x.strokeStyle = 'rgba(255,255,255,.92)';
    x.lineWidth = Math.max(1.6, s * 0.09);
    x.lineJoin = 'round';
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(-r * 0.34, 0);
    x.lineTo(-r * 0.08, r * 0.28);
    x.lineTo(r * 0.38, -r * 0.3);
    x.stroke();
    // 四角铆钉
    x.fillStyle = lightenColor(col, 0.5);
    [[-0.62, -0.36], [0.62, -0.36], [-0.62, 0.54], [0.62, 0.54]].forEach(p => {
      x.beginPath(); x.arc(p[0] * r, p[1] * r, r * 0.06, 0, 7); x.fill();
    });
  },

  // 小型电线杆：木质单杆 + 小横担 + 双绝缘子
  'small-electric-pole': (x, r, s, col) => {
    // 杆身
    const g = x.createLinearGradient(-r * 0.12, 0, r * 0.12, 0);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(1, darkenColor(col, 0.35));
    x.fillStyle = g;
    rrPath(x, -r * 0.11, -r * 0.72, r * 0.22, r * 1.5, r * 0.06);
    x.fill();
    // 横担
    x.fillStyle = darkenColor(col, 0.25);
    rrPath(x, -r * 0.62, -r * 0.5, r * 1.24, r * 0.16, r * 0.05);
    x.fill();
    // 斜撑
    x.strokeStyle = darkenColor(col, 0.3);
    x.lineWidth = Math.max(1, s * 0.05);
    x.beginPath();
    x.moveTo(-r * 0.5, -r * 0.36); x.lineTo(-r * 0.06, -r * 0.62);
    x.moveTo(r * 0.5, -r * 0.36); x.lineTo(r * 0.06, -r * 0.62);
    x.stroke();
    // 绝缘子（两端白点）
    x.fillStyle = '#e8e8e0';
    x.beginPath(); x.arc(-r * 0.54, -r * 0.52, r * 0.09, 0, 7); x.fill();
    x.beginPath(); x.arc(r * 0.54, -r * 0.52, r * 0.09, 0, 7); x.fill();
    // 顶帽
    x.fillStyle = darkenColor(col, 0.4);
    rrPath(x, -r * 0.15, -r * 0.8, r * 0.3, r * 0.12, r * 0.04);
    x.fill();
  },

  // 中型电线杆：金属杆 + 宽横担 + 三绝缘子
  'medium-electric-pole': (x, r, s, col) => {
    // 杆身（金属渐变）
    const g = x.createLinearGradient(-r * 0.13, 0, r * 0.13, 0);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    rrPath(x, -r * 0.13, -r * 0.78, r * 0.26, r * 1.6, r * 0.06);
    x.fill();
    // 宽横担
    x.fillStyle = darkenColor(col, 0.28);
    rrPath(x, -r * 0.78, -r * 0.56, r * 1.56, r * 0.15, r * 0.05);
    x.fill();
    // 斜撑
    x.strokeStyle = darkenColor(col, 0.32);
    x.lineWidth = Math.max(1, s * 0.05);
    x.beginPath();
    x.moveTo(-r * 0.62, -r * 0.42); x.lineTo(-r * 0.06, -r * 0.68);
    x.moveTo(r * 0.62, -r * 0.42); x.lineTo(r * 0.06, -r * 0.68);
    x.stroke();
    // 三绝缘子
    x.fillStyle = '#e8e8e0';
    [-0.7, 0, 0.7].forEach(k => {
      x.beginPath(); x.arc(k * r, -r * 0.58, r * 0.085, 0, 7); x.fill();
    });
  },

  // 大型电线杆：钢架塔（梯形桁架 + 交叉撑 + 顶部双臂）
  'big-electric-pole': (x, r, s, col) => {
    const steel = lightenColor(col, 0.3);
    const steelD = darkenColor(col, 0.42);
    x.strokeStyle = steel;
    x.lineCap = 'round';
    // 塔身两侧斜线
    x.lineWidth = Math.max(1.6, s * 0.075);
    x.beginPath();
    x.moveTo(-r * 0.62, r * 0.82); x.lineTo(-r * 0.16, -r * 0.62);
    x.moveTo(r * 0.62, r * 0.82); x.lineTo(r * 0.16, -r * 0.62);
    x.stroke();
    // 横撑 + 交叉撑
    x.lineWidth = Math.max(1, s * 0.045);
    x.beginPath();
    x.moveTo(-r * 0.5, r * 0.3); x.lineTo(r * 0.5, r * 0.3);
    x.moveTo(-r * 0.36, -r * 0.18); x.lineTo(r * 0.36, -r * 0.18);
    x.stroke();
    x.beginPath();
    x.moveTo(-r * 0.5, r * 0.3); x.lineTo(r * 0.36, -r * 0.18);
    x.moveTo(r * 0.5, r * 0.3); x.lineTo(-r * 0.36, -r * 0.18);
    x.stroke();
    // 顶部双臂
    x.lineWidth = Math.max(1.4, s * 0.06);
    x.strokeStyle = steelD;
    x.beginPath();
    x.moveTo(-r * 0.14, -r * 0.4); x.lineTo(-r * 0.66, -r * 0.66);
    x.moveTo(r * 0.14, -r * 0.4); x.lineTo(r * 0.66, -r * 0.66);
    x.stroke();
    // 塔顶尖
    x.beginPath();
    x.moveTo(-r * 0.14, -r * 0.62); x.lineTo(0, -r * 0.86); x.lineTo(r * 0.14, -r * 0.62);
    x.stroke();
    // 绝缘子
    x.fillStyle = '#e8e8e0';
    x.beginPath(); x.arc(-r * 0.66, -r * 0.72, r * 0.085, 0, 7); x.fill();
    x.beginPath(); x.arc(r * 0.66, -r * 0.72, r * 0.085, 0, 7); x.fill();
  },

  // 常量组合器：蓝灰机身 + 七段数码管显示「1」+ 常量输出标识
  'constant-combinator': (x, r, s, col) => {
    // 机身
    const g = x.createLinearGradient(-r * 0.8, -r * 0.8, r * 0.8, r * 0.8);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    rrPath(x, -r * 0.8, -r * 0.7, r * 1.6, r * 1.4, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.45)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 数码屏底
    x.fillStyle = '#101820';
    rrPath(x, -r * 0.52, -r * 0.42, r * 1.04, r * 0.84, r * 0.1);
    x.fill();
    // 七段数码管「1」（红色段）
    const seg = '#ff5a4e';
    const on = (px, py, w, h) => { x.fillStyle = seg; rrPath(x, px, py, w, h, h / 2); x.fill(); };
    const dx = r * 0.1, dw = r * 0.09, dh = r * 0.16;
    on(dx - dw / 2, -r * 0.32, dw, dh);            // 上竖段
    on(dx - dw / 2, r * 0.02, dw, dh);             // 下竖段
    // 暗段（显示七段管底版，突出「1」）
    x.fillStyle = 'rgba(255,90,78,.14)';
    // 顶/底横段
    rrPath(x, -r * 0.28, -r * 0.4, r * 0.44, r * 0.07, r * 0.03); x.fill();
    rrPath(x, -r * 0.28, -r * 0.03, r * 0.44, r * 0.07, r * 0.03); x.fill();
    rrPath(x, -r * 0.28, r * 0.33, r * 0.44, r * 0.07, r * 0.03); x.fill();
    // 左竖段（暗）
    rrPath(x, -r * 0.34, -r * 0.32, r * 0.08, r * 0.16, r * 0.03); x.fill();
    rrPath(x, -r * 0.34, r * 0.02, r * 0.08, r * 0.16, r * 0.03); x.fill();
    // 右竖段（暗）
    rrPath(x, r * 0.2, -r * 0.32, r * 0.08, r * 0.16, r * 0.03); x.fill();
    rrPath(x, r * 0.2, r * 0.02, r * 0.08, r * 0.16, r * 0.03); x.fill();
    // 顶部信号点（常量持续输出）
    x.fillStyle = '#6ee07f';
    x.beginPath(); x.arc(r * 0.58, -r * 0.56, r * 0.09, 0, 7); x.fill();
    // 底部线缆接口
    x.fillStyle = darkenColor(col, 0.5);
    rrPath(x, -r * 0.3, r * 0.5, r * 0.6, r * 0.14, r * 0.05);
    x.fill();
  },

  // 运算组合器：青蓝机身 + 四则运算符号 2×2 网格
  'arithmetic-combinator': (x, r, s, col) => {
    // 机身
    const g = x.createLinearGradient(-r * 0.8, -r * 0.8, r * 0.8, r * 0.8);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    rrPath(x, -r * 0.8, -r * 0.7, r * 1.6, r * 1.4, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.45)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 运算符号（+ − × ÷ 缩略为 + − × 三枚，右上 ÷ 省略以保清晰）
    x.strokeStyle = '#eef4f8';
    x.fillStyle = '#eef4f8';
    x.lineWidth = Math.max(1.4, s * 0.07);
    x.lineCap = 'round';
    // 「+」左上
    x.beginPath();
    x.moveTo(-r * 0.52, -r * 0.38); x.lineTo(-r * 0.2, -r * 0.38);
    x.moveTo(-r * 0.36, -r * 0.54); x.lineTo(-r * 0.36, -r * 0.22);
    x.stroke();
    // 「−」右上
    x.beginPath();
    x.moveTo(r * 0.2, -r * 0.38); x.lineTo(r * 0.52, -r * 0.38);
    x.stroke();
    // 「×」左下
    x.beginPath();
    x.moveTo(-r * 0.5, r * 0.16); x.lineTo(-r * 0.22, r * 0.46);
    x.moveTo(-r * 0.22, r * 0.16); x.lineTo(-r * 0.5, r * 0.46);
    x.stroke();
    // 「÷」右下（横线 + 上下点）
    x.beginPath();
    x.moveTo(r * 0.2, r * 0.31); x.lineTo(r * 0.52, r * 0.31);
    x.stroke();
    x.beginPath(); x.arc(r * 0.36, r * 0.14, r * 0.055, 0, 7); x.fill();
    x.beginPath(); x.arc(r * 0.36, r * 0.48, r * 0.055, 0, 7); x.fill();
    // 底部线缆接口
    x.fillStyle = darkenColor(col, 0.5);
    rrPath(x, -r * 0.3, r * 0.52, r * 0.6, r * 0.12, r * 0.05);
    x.fill();
  },

  // 判断组合器：青绿机身 + 菱形判断框 + 分支箭头（是/否）
  'decider-combinator': (x, r, s, col) => {
    // 机身
    const g = x.createLinearGradient(-r * 0.8, -r * 0.8, r * 0.8, r * 0.8);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    rrPath(x, -r * 0.8, -r * 0.7, r * 1.6, r * 1.4, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.45)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 菱形判断框
    x.fillStyle = '#101820';
    x.strokeStyle = '#7fe8c8';
    x.lineWidth = Math.max(1.4, s * 0.06);
    x.beginPath();
    x.moveTo(0, -r * 0.56); x.lineTo(r * 0.46, 0);
    x.lineTo(0, r * 0.56); x.lineTo(-r * 0.46, 0);
    x.closePath();
    x.fill();
    x.stroke();
    // 内部问号（判断标识）
    x.fillStyle = '#7fe8c8';
    x.font = 'bold ' + Math.round(r * 0.62) + 'px system-ui';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('?', 0, r * 0.02);
    // 右侧输出分支（满足 → 输出）
    x.strokeStyle = '#6ee07f';
    x.lineWidth = Math.max(1.4, s * 0.06);
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(r * 0.52, 0); x.lineTo(r * 0.7, 0);
    x.stroke();
    x.fillStyle = '#6ee07f';
    x.beginPath();
    x.moveTo(r * 0.76, 0); x.lineTo(r * 0.62, -r * 0.09); x.lineTo(r * 0.62, r * 0.09);
    x.closePath();
    x.fill();
    // 底部线缆接口
    x.fillStyle = darkenColor(col, 0.5);
    rrPath(x, -r * 0.3, r * 0.52, r * 0.6, r * 0.12, r * 0.05);
    x.fill();
  },

  // 选择组合器：蓝色机身 + 漏斗筛选标识 + 输出箭头
  'selector-combinator': (x, r, s, col) => {
    // 机身
    const g = x.createLinearGradient(-r * 0.8, -r * 0.8, r * 0.8, r * 0.8);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    rrPath(x, -r * 0.8, -r * 0.7, r * 1.6, r * 1.4, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.45)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 深色内屏
    x.fillStyle = '#101820';
    rrPath(x, -r * 0.55, -r * 0.5, r * 1.1, r * 1.0, r * 0.1);
    x.fill();
    // 漏斗筛选标识
    x.strokeStyle = '#7fb2f0';
    x.fillStyle = '#7fb2f0';
    x.lineWidth = Math.max(1.4, s * 0.06);
    x.lineCap = 'round';
    x.lineJoin = 'round';
    x.beginPath();
    x.moveTo(-r * 0.32, -r * 0.36); x.lineTo(r * 0.32, -r * 0.36);
    x.lineTo(r * 0.08, -r * 0.04); x.lineTo(r * 0.08, r * 0.22);
    x.lineTo(-r * 0.08, r * 0.22); x.lineTo(-r * 0.08, -r * 0.04);
    x.closePath();
    x.stroke();
    // 漏斗下方三条候选线（被筛选的信号）
    x.lineWidth = Math.max(1, s * 0.04);
    x.beginPath(); x.moveTo(-r * 0.34, r * 0.36); x.lineTo(-r * 0.06, r * 0.36); x.stroke();
    x.beginPath(); x.moveTo(r * 0.06, r * 0.36); x.lineTo(r * 0.34, r * 0.36); x.stroke();
    // 选中的中间信号高亮点
    x.beginPath(); x.arc(0, r * 0.36, r * 0.07, 0, 7); x.fill();
    // 底部线缆接口
    x.fillStyle = darkenColor(col, 0.5);
    rrPath(x, -r * 0.3, r * 0.52, r * 0.6, r * 0.12, r * 0.05);
    x.fill();
  },

  // 显示屏：浅色外框 + 深色屏面 + 绿色信号文字行 + 支架
  'display-panel': (x, r, s, col) => {
    // 支架底座
    x.fillStyle = darkenColor(col, 0.4);
    rrPath(x, -r * 0.34, r * 0.66, r * 0.68, r * 0.16, r * 0.05);
    x.fill();
    // 支柱
    x.fillRect(-r * 0.08, r * 0.36, r * 0.16, r * 0.34);
    // 屏体外壳
    const g = x.createLinearGradient(0, -r * 0.7, 0, r * 0.5);
    g.addColorStop(0, lightenColor(col, 0.25));
    g.addColorStop(1, darkenColor(col, 0.3));
    x.fillStyle = g;
    rrPath(x, -r * 0.85, -r * 0.75, r * 1.7, r * 1.3, r * 0.14);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.45)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 屏面
    x.fillStyle = '#101820';
    rrPath(x, -r * 0.68, -r * 0.58, r * 1.36, r * 0.96, r * 0.08);
    x.fill();
    // 信号文字行（绿色等宽感线条）
    x.strokeStyle = '#7fe87f';
    x.lineCap = 'round';
    x.lineWidth = Math.max(1.2, s * 0.05);
    x.beginPath(); x.moveTo(-r * 0.5, -r * 0.32); x.lineTo(r * 0.28, -r * 0.32); x.stroke();
    x.beginPath(); x.moveTo(-r * 0.5, -r * 0.04); x.lineTo(r * 0.48, -r * 0.04); x.stroke();
    x.beginPath(); x.moveTo(-r * 0.5, r * 0.24); x.lineTo(r * 0.04, r * 0.24); x.stroke();
    // 行首信号点
    x.fillStyle = '#e0c060';
    x.beginPath(); x.arc(-r * 0.58, -r * 0.04, r * 0.05, 0, 7); x.fill();
  },

  // 功率开关：红铜底座 + 斜置闸刀手柄 + 触点
  'power-switch': (x, r, s, col) => {
    // 底座
    const g = x.createLinearGradient(0, -r * 0.6, 0, r * 0.8);
    g.addColorStop(0, lightenColor(col, 0.3));
    g.addColorStop(1, darkenColor(col, 0.35));
    x.fillStyle = g;
    rrPath(x, -r * 0.8, -r * 0.35, r * 1.6, r * 1.1, r * 0.14);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.45)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 两个触点柱
    x.fillStyle = '#8a8a92';
    rrPath(x, -r * 0.58, -r * 0.16, r * 0.22, r * 0.5, r * 0.06);
    x.fill();
    rrPath(x, r * 0.36, -r * 0.16, r * 0.22, r * 0.5, r * 0.06);
    x.fill();
    // 触点铰链
    x.fillStyle = '#d8d8e0';
    x.beginPath(); x.arc(-r * 0.47, -r * 0.1, r * 0.09, 0, 7); x.fill();
    // 斜置闸刀手柄（断开位）
    x.strokeStyle = '#e8e8f0';
    x.lineCap = 'round';
    x.lineWidth = r * 0.16;
    x.beginPath(); x.moveTo(-r * 0.47, -r * 0.1); x.lineTo(r * 0.42, -r * 0.62); x.stroke();
    // 手柄高光
    x.strokeStyle = 'rgba(255,255,255,.55)';
    x.lineWidth = r * 0.05;
    x.beginPath(); x.moveTo(-r * 0.42, -r * 0.16); x.lineTo(r * 0.36, -r * 0.64); x.stroke();
    // 手柄末端圆球
    x.fillStyle = '#e05a4a';
    x.beginPath(); x.arc(r * 0.44, -r * 0.64, r * 0.13, 0, 7); x.fill();
    x.strokeStyle = 'rgba(0,0,0,.35)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.stroke();
    // 右触点火花缺口指示
    x.strokeStyle = '#f0c040';
    x.lineWidth = Math.max(1, s * 0.035);
    x.beginPath();
    x.moveTo(r * 0.62, r * 0.06); x.lineTo(r * 0.78, r * 0.06);
    x.moveTo(r * 0.7, -r * 0.02); x.lineTo(r * 0.7, r * 0.14);
    x.stroke();
  },

  // 红电路线缆：线缆卷环 + 两端插头 + 「R」标识
  'red-wire': (x, r, s, col) => {
    // 线缆卷（外环粗线 + 内环细线，螺旋感）
    x.strokeStyle = darkenColor(col, 0.25);
    x.lineWidth = r * 0.34;
    x.beginPath(); x.arc(0, r * 0.06, r * 0.44, 0.6, 5.9); x.stroke();
    x.strokeStyle = lightenColor(col, 0.3);
    x.lineWidth = r * 0.16;
    x.beginPath(); x.arc(0, r * 0.06, r * 0.44, 0.6, 5.9); x.stroke();
    // 环内高光弧
    x.strokeStyle = 'rgba(255,255,255,.4)';
    x.lineWidth = r * 0.05;
    x.beginPath(); x.arc(0, r * 0.06, r * 0.28, 2.4, 4.2); x.stroke();
    // 左端插头
    x.strokeStyle = darkenColor(col, 0.3);
    x.lineWidth = r * 0.12;
    x.lineCap = 'round';
    x.beginPath(); x.moveTo(-r * 0.42, r * 0.34); x.quadraticCurveTo(-r * 0.62, r * 0.44, -r * 0.68, r * 0.2); x.stroke();
    x.fillStyle = '#d8d8e0';
    rrPath(x, -r * 0.82, -r * 0.06, r * 0.24, r * 0.34, r * 0.06);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.4)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.stroke();
    // 右端插头
    x.beginPath(); x.moveTo(r * 0.42, r * 0.34); x.quadraticCurveTo(r * 0.62, r * 0.44, r * 0.68, r * 0.2); x.stroke();
    x.fillStyle = '#d8d8e0';
    rrPath(x, r * 0.58, -r * 0.06, r * 0.24, r * 0.34, r * 0.06);
    x.fill();
    x.stroke();
    // 「R」标识
    x.fillStyle = '#fff';
    x.font = 'bold ' + Math.round(r * 0.5) + 'px system-ui';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('R', 0, r * 0.08);
  },

  // 绿电路线缆：线缆卷环 + 两端插头 + 「G」标识
  'green-wire': (x, r, s, col) => {
    x.strokeStyle = darkenColor(col, 0.25);
    x.lineWidth = r * 0.34;
    x.beginPath(); x.arc(0, r * 0.06, r * 0.44, 0.6, 5.9); x.stroke();
    x.strokeStyle = lightenColor(col, 0.3);
    x.lineWidth = r * 0.16;
    x.beginPath(); x.arc(0, r * 0.06, r * 0.44, 0.6, 5.9); x.stroke();
    x.strokeStyle = 'rgba(255,255,255,.4)';
    x.lineWidth = r * 0.05;
    x.beginPath(); x.arc(0, r * 0.06, r * 0.28, 2.4, 4.2); x.stroke();
    x.strokeStyle = darkenColor(col, 0.3);
    x.lineWidth = r * 0.12;
    x.lineCap = 'round';
    x.beginPath(); x.moveTo(-r * 0.42, r * 0.34); x.quadraticCurveTo(-r * 0.62, r * 0.44, -r * 0.68, r * 0.2); x.stroke();
    x.fillStyle = '#d8d8e0';
    rrPath(x, -r * 0.82, -r * 0.06, r * 0.24, r * 0.34, r * 0.06);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.4)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.stroke();
    x.beginPath(); x.moveTo(r * 0.42, r * 0.34); x.quadraticCurveTo(r * 0.62, r * 0.44, r * 0.68, r * 0.2); x.stroke();
    x.fillStyle = '#d8d8e0';
    rrPath(x, r * 0.58, -r * 0.06, r * 0.24, r * 0.34, r * 0.06);
    x.fill();
    x.stroke();
    x.fillStyle = '#fff';
    x.font = 'bold ' + Math.round(r * 0.5) + 'px system-ui';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('G', 0, r * 0.08);
  },

  // 混凝土：灰色 2×2 地砖 + 砖缝 + 石点纹理
  'concrete': (x, r, s, col) => {
    const tile = (px, py, w, h) => {
      const g = x.createLinearGradient(px, py, px, py + h);
      g.addColorStop(0, lightenColor(col, 0.22));
      g.addColorStop(1, darkenColor(col, 0.25));
      x.fillStyle = g;
      rrPath(x, px, py, w, h, h * 0.14);
      x.fill();
      x.strokeStyle = 'rgba(40,40,45,.5)';
      x.lineWidth = Math.max(0.8, s * 0.035);
      x.stroke();
      // 石点纹理
      x.fillStyle = 'rgba(0,0,0,.14)';
      x.beginPath(); x.arc(px + w * 0.32, py + h * 0.4, w * 0.06, 0, 7); x.fill();
      x.beginPath(); x.arc(px + w * 0.66, py + h * 0.62, w * 0.05, 0, 7); x.fill();
      x.fillStyle = 'rgba(255,255,255,.18)';
      x.beginPath(); x.arc(px + w * 0.7, py + h * 0.3, w * 0.05, 0, 7); x.fill();
    };
    const h = r * 0.46, w = r * 0.46, gap = r * 0.03;
    tile(-r - gap / 2, -r - gap / 2, w, h);
    tile(gap / 2, -r - gap / 2, w, h);
    tile(-r - gap / 2, gap / 2, w, h);
    tile(gap / 2, gap / 2, w, h);
  },

  // 精炼混凝土：浅灰大板 + 十字深缝 + 角部装饰点
  'refined-concrete': (x, r, s, col) => {
    // 整板底
    const g = x.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, lightenColor(col, 0.28));
    g.addColorStop(1, darkenColor(col, 0.22));
    x.fillStyle = g;
    rrPath(x, -r, -r, r * 2, r * 2, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(40,40,45,.5)';
    x.lineWidth = Math.max(0.8, s * 0.035);
    x.stroke();
    // 十字深缝
    x.strokeStyle = 'rgba(50,50,55,.65)';
    x.lineWidth = Math.max(1.2, s * 0.05);
    x.beginPath(); x.moveTo(0, -r * 0.96); x.lineTo(0, r * 0.96); x.stroke();
    x.beginPath(); x.moveTo(-r * 0.96, 0); x.lineTo(r * 0.96, 0); x.stroke();
    // 每块角部小方点装饰
    x.fillStyle = 'rgba(60,60,66,.55)';
    const o = r * 0.18, d = r * 0.09;
    [[-o, -o], [o, -o], [-o, o], [o, o]].forEach(p => {
      rrPath(x, p[0] - d, p[1] - d, d * 2, d * 2, d * 0.5);
      x.fill();
    });
    // 高光扫面
    x.fillStyle = 'rgba(255,255,255,.1)';
    rrPath(x, -r * 0.92, -r * 0.92, r * 1.84, r * 0.5, r * 0.1);
    x.fill();
  },

  // 警示混凝土：黄底黑斜纹地砖
  'hazard-concrete': (x, r, s, col) => {
    // 底砖
    const g = x.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, lightenColor(col, 0.2));
    g.addColorStop(1, darkenColor(col, 0.3));
    x.fillStyle = g;
    rrPath(x, -r, -r, r * 2, r * 2, r * 0.12);
    x.fill();
    // 黑色斜纹（裁剪在砖内）
    x.save();
    rrPath(x, -r, -r, r * 2, r * 2, r * 0.12);
    x.clip();
    x.fillStyle = '#22222a';
    for (let i = -3; i <= 3; i++) {
      x.save();
      x.translate(i * r * 0.62, 0);
      x.rotate(Math.PI / 4);
      x.fillRect(-r * 0.14, -r * 2, r * 0.28, r * 4);
      x.restore();
    }
    x.restore();
    // 描边
    x.strokeStyle = 'rgba(40,40,45,.55)';
    x.lineWidth = Math.max(0.8, s * 0.035);
    rrPath(x, -r, -r, r * 2, r * 2, r * 0.12);
    x.stroke();
  },

  // 精炼警示混凝土：浅灰大板 + 黑黄斜纹带 + 精炼缝
  'refined-hazard-concrete': (x, r, s, col) => {
    // 精炼底板
    const g = x.createLinearGradient(-r, -r, r, r);
    g.addColorStop(0, lightenColor('#b0b0b6', 0.25));
    g.addColorStop(1, darkenColor('#b0b0b6', 0.2));
    x.fillStyle = g;
    rrPath(x, -r, -r, r * 2, r * 2, r * 0.12);
    x.fill();
    // 中部斜纹警示带（裁剪）
    x.save();
    x.beginPath();
    rrPath(x, -r * 0.95, -r * 0.34, r * 1.9, r * 0.68, r * 0.1);
    x.clip();
    x.fillStyle = lightenColor(col, 0.15);
    x.fillRect(-r, -r * 0.4, r * 2, r * 0.8);
    x.fillStyle = '#22222a';
    for (let i = -3; i <= 3; i++) {
      x.save();
      x.translate(i * r * 0.5, 0);
      x.rotate(Math.PI / 4);
      x.fillRect(-r * 0.12, -r * 2, r * 0.24, r * 4);
      x.restore();
    }
    x.restore();
    // 警示带边框
    x.strokeStyle = 'rgba(50,50,55,.6)';
    x.lineWidth = Math.max(1, s * 0.04);
    rrPath(x, -r * 0.95, -r * 0.34, r * 1.9, r * 0.68, r * 0.1);
    x.stroke();
    // 外框 + 十字缝
    x.strokeStyle = 'rgba(40,40,45,.5)';
    x.lineWidth = Math.max(0.8, s * 0.035);
    rrPath(x, -r, -r, r * 2, r * 2, r * 0.12);
    x.stroke();
    x.fillStyle = 'rgba(60,60,66,.5)';
    const d = r * 0.08, o = r * 0.18;
    [[-o, -o], [o, -o], [-o, o], [o, o]].forEach(p => {
      rrPath(x, p[0] - d, p[1] - d, d * 2, d * 2, d * 0.5);
      x.fill();
    });
  },

  // 石砖路：不规则圆石铺面（多块鹅卵石 + 缝隙阴影）
  'stone-path': (x, r, s, col) => {
    // 底土色
    x.fillStyle = darkenColor(col, 0.45);
    rrPath(x, -r, -r, r * 2, r * 2, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(40,35,30,.5)';
    x.lineWidth = Math.max(0.8, s * 0.035);
    x.stroke();
    // 圆石（错缝铺排）
    const pebble = (px, py, rad) => {
      const g = x.createRadialGradient(px - rad * 0.3, py - rad * 0.3, rad * 0.2, px, py, rad);
      g.addColorStop(0, lightenColor(col, 0.3));
      g.addColorStop(1, darkenColor(col, 0.2));
      x.fillStyle = g;
      x.beginPath();
      x.ellipse(px, py, rad, rad * 0.82, 0.3, 0, 7);
      x.fill();
      x.strokeStyle = 'rgba(40,35,30,.45)';
      x.lineWidth = Math.max(0.6, s * 0.028);
      x.stroke();
    };
    pebble(-r * 0.52, -r * 0.5, r * 0.34);
    pebble(r * 0.32, -r * 0.56, r * 0.3);
    pebble(r * 0.06, -r * 0.04, r * 0.36);
    pebble(-r * 0.6, r * 0.12, r * 0.28);
    pebble(r * 0.62, r * 0.1, r * 0.3);
    pebble(-r * 0.16, r * 0.62, r * 0.3);
    pebble(r * 0.5, r * 0.66, r * 0.24);
  },

// ===== 第 9 批：物流收尾（填海料/平台基座/冰面平台/木箱/铁箱）+ 生产开头 =====

// 填海料：水面上的填土方块，斜纹夯实 + 水波示意
'landfill': (x, r, s, col) => {
  // 背景水面
  const wg = x.createLinearGradient(0, -r * 0.9, 0, r * 0.9);
  wg.addColorStop(0, '#3f78a8');
  wg.addColorStop(1, '#27506f');
  x.fillStyle = wg;
  rrPath(x, -r * 0.9, -r * 0.9, r * 1.8, r * 1.8, r * 0.14);
  x.fill();
  x.strokeStyle = 'rgba(0,0,0,.4)';
  x.lineWidth = Math.max(1, s * 0.04);
  x.stroke();
  // 水波
  x.strokeStyle = 'rgba(220,240,255,.5)';
  x.lineWidth = Math.max(1, s * 0.04);
  x.lineCap = 'round';
  x.beginPath(); x.moveTo(-r * 0.72, -r * 0.62); x.quadraticCurveTo(-r * 0.5, -r * 0.72, -r * 0.28, -r * 0.62); x.stroke();
  x.beginPath(); x.moveTo(r * 0.3, -r * 0.62); x.quadraticCurveTo(r * 0.52, -r * 0.72, r * 0.74, -r * 0.62); x.stroke();
  // 填土块（略带透视的方块）
  const g = x.createLinearGradient(0, -r * 0.55, 0, r * 0.75);
  g.addColorStop(0, lightenColor(col, 0.32));
  g.addColorStop(1, darkenColor(col, 0.35));
  x.fillStyle = g;
  rrPath(x, -r * 0.68, -r * 0.34, r * 1.36, r * 1.0, r * 0.08);
  x.fill();
  x.strokeStyle = 'rgba(30,20,8,.55)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 夯实斜纹
  x.save();
  rrPath(x, -r * 0.68, -r * 0.34, r * 1.36, r * 1.0, r * 0.08);
  x.clip();
  x.strokeStyle = 'rgba(40,26,10,.35)';
  x.lineWidth = Math.max(1, s * 0.045);
  for (let i = -2; i <= 3; i++) {
    x.beginPath();
    x.moveTo(-r * 0.9 + i * r * 0.5, r * 0.75);
    x.lineTo(-r * 0.1 + i * r * 0.5, -r * 0.45);
    x.stroke();
  }
  x.restore();
},

// 平台基座：金属板块 + 铆接四角 + 中央通道纹
'foundation': (x, r, s, col) => {
  const g = x.createLinearGradient(-r * 0.85, -r * 0.85, r * 0.85, r * 0.85);
  g.addColorStop(0, lightenColor(col, 0.35));
  g.addColorStop(0.5, col);
  g.addColorStop(1, darkenColor(col, 0.4));
  x.fillStyle = g;
  rrPath(x, -r * 0.85, -r * 0.85, r * 1.7, r * 1.7, r * 0.12);
  x.fill();
  x.strokeStyle = 'rgba(0,0,0,.5)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 内嵌板缝（田字四分）
  x.strokeStyle = darkenColor(col, 0.5);
  x.lineWidth = Math.max(1, s * 0.04);
  x.beginPath();
  x.moveTo(0, -r * 0.85); x.lineTo(0, r * 0.85);
  x.moveTo(-r * 0.85, 0); x.lineTo(r * 0.85, 0);
  x.stroke();
  // 中央通道凸纹
  x.fillStyle = lightenColor(col, 0.2);
  rrPath(x, -r * 0.16, -r * 0.16, r * 0.32, r * 0.32, r * 0.05);
  x.fill();
  x.strokeStyle = 'rgba(0,0,0,.35)';
  x.lineWidth = Math.max(0.8, s * 0.03);
  x.stroke();
  // 四角铆钉
  x.fillStyle = lightenColor(col, 0.5);
  [[-0.62, -0.62], [0.62, -0.62], [-0.62, 0.62], [0.62, 0.62]].forEach(p => {
    x.beginPath(); x.arc(p[0] * r, p[1] * r, r * 0.07, 0, 7); x.fill();
  });
},

// 冰面平台：淡蓝冰砖 + 冰裂纹 + 高光
'ice-platform': (x, r, s, col) => {
  const g = x.createLinearGradient(0, -r * 0.85, 0, r * 0.85);
  g.addColorStop(0, lightenColor(col, 0.45));
  g.addColorStop(0.55, col);
  g.addColorStop(1, '#7fa8c8');
  x.fillStyle = g;
  rrPath(x, -r * 0.85, -r * 0.85, r * 1.7, r * 1.7, r * 0.14);
  x.fill();
  x.strokeStyle = 'rgba(30,70,110,.5)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 冰裂纹
  x.strokeStyle = 'rgba(255,255,255,.65)';
  x.lineWidth = Math.max(1, s * 0.035);
  x.lineCap = 'round';
  x.beginPath();
  x.moveTo(-r * 0.6, -r * 0.3);
  x.lineTo(-r * 0.2, -r * 0.1);
  x.lineTo(-r * 0.34, r * 0.28);
  x.moveTo(-r * 0.2, -r * 0.1);
  x.lineTo(r * 0.2, -r * 0.24);
  x.lineTo(r * 0.52, -r * 0.05);
  x.stroke();
  // 顶部高光斜面
  x.fillStyle = 'rgba(255,255,255,.4)';
  x.beginPath();
  x.moveTo(-r * 0.85, -r * 0.4);
  x.lineTo(-r * 0.3, -r * 0.85);
  x.lineTo(r * 0.1, -r * 0.85);
  x.lineTo(-r * 0.5, -r * 0.36);
  x.closePath();
  x.fill();
},

// 木箱：木板拼合箱体 + 横向木纹 + 角铁包边
'wooden-chest': (x, r, s, col) => {
  const g = x.createLinearGradient(-r * 0.8, -r * 0.75, r * 0.8, r * 0.8);
  g.addColorStop(0, lightenColor(col, 0.3));
  g.addColorStop(1, darkenColor(col, 0.35));
  x.fillStyle = g;
  rrPath(x, -r * 0.8, -r * 0.65, r * 1.6, r * 1.45, r * 0.08);
  x.fill();
  x.strokeStyle = 'rgba(60,38,16,.6)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 横向木板缝
  x.strokeStyle = 'rgba(70,45,20,.5)';
  x.lineWidth = Math.max(1, s * 0.035);
  for (let i = 1; i < 4; i++) {
    const py = -r * 0.65 + i * r * 0.36;
    x.beginPath(); x.moveTo(-r * 0.8, py); x.lineTo(r * 0.8, py); x.stroke();
  }
  // 木纹短线
  x.strokeStyle = 'rgba(70,45,20,.3)';
  x.lineWidth = Math.max(0.8, s * 0.025);
  [[-0.55, -0.35], [0.1, -0.32], [-0.3, 0.1], [0.45, 0.15], [-0.5, 0.5], [0.3, 0.55]].forEach(p => {
    x.beginPath();
    x.moveTo(p[0] * r, p[1] * r);
    x.lineTo((p[0] + 0.3) * r, p[1] * r + r * 0.02);
    x.stroke();
  });
  // 竖向角铁包边
  x.fillStyle = '#6f7a84';
  rrPath(x, -r * 0.86, -r * 0.72, r * 0.16, r * 1.56, r * 0.04);
  x.fill();
  rrPath(x, r * 0.7, -r * 0.72, r * 0.16, r * 1.56, r * 0.04);
  x.fill();
  // 金属锁扣
  x.fillStyle = '#8f9aa4';
  rrPath(x, -r * 0.12, -r * 0.2, r * 0.24, r * 0.4, r * 0.05);
  x.fill();
  x.strokeStyle = 'rgba(0,0,0,.45)';
  x.lineWidth = Math.max(0.8, s * 0.03);
  x.stroke();
},

// 铁箱：铁灰色箱体 + 铆接边框 + 箱盖
'iron-chest': (x, r, s, col) => {
  const g = x.createLinearGradient(-r * 0.8, -r * 0.75, r * 0.8, r * 0.8);
  g.addColorStop(0, lightenColor(col, 0.35));
  g.addColorStop(1, darkenColor(col, 0.4));
  x.fillStyle = g;
  rrPath(x, -r * 0.8, -r * 0.65, r * 1.6, r * 1.45, r * 0.1);
  x.fill();
  x.strokeStyle = 'rgba(0,0,0,.5)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 箱盖
  const lg = x.createLinearGradient(0, -r * 0.9, 0, -r * 0.5);
  lg.addColorStop(0, lightenColor(col, 0.55));
  lg.addColorStop(1, lightenColor(col, 0.1));
  x.fillStyle = lg;
  rrPath(x, -r * 0.85, -r * 0.88, r * 1.7, r * 0.36, r * 0.09);
  x.fill();
  x.strokeStyle = 'rgba(0,0,0,.5)';
  x.lineWidth = Math.max(1, s * 0.04);
  x.stroke();
  // 内凹边框
  x.strokeStyle = darkenColor(col, 0.45);
  x.lineWidth = Math.max(1, s * 0.035);
  rrPath(x, -r * 0.58, -r * 0.42, r * 1.16, r * 1.1, r * 0.07);
  x.stroke();
  // 金属锁扣
  x.fillStyle = lightenColor(col, 0.45);
  rrPath(x, -r * 0.1, -r * 0.24, r * 0.2, r * 0.46, r * 0.04);
  x.fill();
  x.strokeStyle = 'rgba(0,0,0,.4)';
  x.lineWidth = Math.max(0.8, s * 0.03);
  x.stroke();
  // 四角铆钉
  x.fillStyle = lightenColor(col, 0.5);
  [[-0.68, -0.5], [0.68, -0.5], [-0.68, 0.66], [0.68, 0.66]].forEach(p => {
    x.beginPath(); x.arc(p[0] * r, p[1] * r, r * 0.06, 0, 7); x.fill();
  });
},

// 热能采矿机：橙红钻塔机身 + 圆形钻头 + 燃料口
'burner-mining-drill': (x, r, s, col) => {
  // 机身
  const g = x.createLinearGradient(-r * 0.8, -r * 0.8, r * 0.8, r * 0.8);
  g.addColorStop(0, lightenColor(col, 0.3));
  g.addColorStop(1, darkenColor(col, 0.4));
  x.fillStyle = g;
  rrPath(x, -r * 0.8, -r * 0.7, r * 1.6, r * 1.5, r * 0.12);
  x.fill();
  x.strokeStyle = 'rgba(0,0,0,.5)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 中央圆形钻头
  const dg = x.createRadialGradient(-r * 0.08, -r * 0.12, r * 0.05, 0, 0, r * 0.42);
  dg.addColorStop(0, lightenColor(col, 0.5));
  dg.addColorStop(1, darkenColor(col, 0.45));
  x.fillStyle = dg;
  x.beginPath(); x.arc(0, 0, r * 0.42, 0, 7); x.fill();
  x.strokeStyle = 'rgba(0,0,0,.5)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 钻头螺旋纹
  x.strokeStyle = 'rgba(40,20,5,.55)';
  x.lineWidth = Math.max(1.2, s * 0.05);
  x.beginPath(); x.arc(0, 0, r * 0.26, 0.4, 3.2); x.stroke();
  x.beginPath(); x.arc(0, 0, r * 0.14, 3.6, 6.5); x.stroke();
  // 燃料口（黑色开口 + 煤）
  x.fillStyle = '#1c1a18';
  rrPath(x, -r * 0.5, r * 0.5, r * 0.42, r * 0.3, r * 0.05);
  x.fill();
  x.fillStyle = '#4a4a50';
  x.beginPath(); x.arc(-r * 0.33, r * 0.66, r * 0.09, 0, 7); x.fill();
  x.beginPath(); x.arc(-r * 0.16, r * 0.7, r * 0.08, 0, 7); x.fill();
  // 排出矿石槽（右侧）
  x.fillStyle = '#5a6470';
  rrPath(x, r * 0.12, r * 0.5, r * 0.62, r * 0.28, r * 0.05);
  x.fill();
  x.strokeStyle = 'rgba(0,0,0,.4)';
  x.lineWidth = Math.max(0.8, s * 0.03);
  x.stroke();
},

// 石炉：石砌炉体 + 炉口火光
'stone-furnace': (x, r, s, col) => {
  // 炉体（梯形石砌）
  const g = x.createLinearGradient(0, -r * 0.8, 0, r * 0.85);
  g.addColorStop(0, lightenColor(col, 0.35));
  g.addColorStop(1, darkenColor(col, 0.4));
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(-r * 0.72, -r * 0.8);
  x.lineTo(r * 0.72, -r * 0.8);
  x.lineTo(r * 0.88, r * 0.85);
  x.lineTo(-r * 0.88, r * 0.85);
  x.closePath();
  x.fill();
  x.strokeStyle = 'rgba(50,42,32,.6)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 石缝横线
  x.strokeStyle = 'rgba(50,42,32,.4)';
  x.lineWidth = Math.max(1, s * 0.035);
  x.beginPath(); x.moveTo(-r * 0.76, -r * 0.38); x.lineTo(r * 0.76, -r * 0.38); x.stroke();
  x.beginPath(); x.moveTo(-r * 0.82, r * 0.06); x.lineTo(r * 0.82, r * 0.06); x.stroke();
  // 炉口
  x.fillStyle = '#14100c';
  rrPath(x, -r * 0.34, r * 0.1, r * 0.68, r * 0.6, r * 0.06);
  x.fill();
  // 火光
  const fg = x.createLinearGradient(0, r * 0.15, 0, r * 0.72);
  fg.addColorStop(0, '#ffd23a');
  fg.addColorStop(0.55, '#ff8a1e');
  fg.addColorStop(1, '#e04a10');
  x.fillStyle = fg;
  x.beginPath();
  x.moveTo(0, r * 0.7);
  x.quadraticCurveTo(-r * 0.3, r * 0.5, -r * 0.16, r * 0.28);
  x.quadraticCurveTo(-r * 0.06, r * 0.42, 0, r * 0.2);
  x.quadraticCurveTo(r * 0.06, r * 0.42, r * 0.16, r * 0.28);
  x.quadraticCurveTo(r * 0.3, r * 0.5, 0, r * 0.7);
  x.closePath();
  x.fill();
  // 顶部烟囱口
  x.fillStyle = darkenColor(col, 0.5);
  rrPath(x, -r * 0.2, -r * 0.92, r * 0.4, r * 0.16, r * 0.04);
  x.fill();
},

// 组装机：蓝灰机身 + 旋转齿轮 + 传送出入口
'assembling-machine-1': (x, r, s, col) => {
  // 机身
  const g = x.createLinearGradient(-r * 0.85, -r * 0.85, r * 0.85, r * 0.85);
  g.addColorStop(0, lightenColor(col, 0.3));
  g.addColorStop(0.55, col);
  g.addColorStop(1, darkenColor(col, 0.4));
  x.fillStyle = g;
  rrPath(x, -r * 0.85, -r * 0.8, r * 1.7, r * 1.66, r * 0.14);
  x.fill();
  x.strokeStyle = 'rgba(0,0,0,.5)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 中央齿轮
  const teeth = 8;
  x.fillStyle = '#d8dde4';
  for (let i = 0; i < teeth; i++) {
    const a = i * Math.PI * 2 / teeth;
    x.save();
    x.translate(Math.cos(a) * r * 0.42, Math.sin(a) * r * 0.42);
    x.rotate(a);
    x.fillRect(-r * 0.09, -r * 0.11, r * 0.18, r * 0.22);
    x.restore();
  }
  const gg = x.createRadialGradient(-r * 0.06, -r * 0.1, r * 0.04, 0, 0, r * 0.42);
  gg.addColorStop(0, lightenColor('#d8dde4', 0.35));
  gg.addColorStop(1, darkenColor('#d8dde4', 0.25));
  x.fillStyle = gg;
  x.beginPath(); x.arc(0, 0, r * 0.38, 0, 7); x.fill();
  x.fillStyle = '#455062';
  x.beginPath(); x.arc(0, 0, r * 0.13, 0, 7); x.fill();
  // 底部出入口横槽
  x.fillStyle = '#22262e';
  rrPath(x, -r * 0.6, r * 0.58, r * 1.2, r * 0.2, r * 0.05);
  x.fill();
  // 顶部状态灯
  x.fillStyle = '#5ad06a';
  x.beginPath(); x.arc(r * 0.6, -r * 0.6, r * 0.09, 0, 7); x.fill();
},

// 研究中心：青绿塔身 + 烧瓶/科研包入口 + 天线
'lab': (x, r, s, col) => {
  // 主体（下宽上窄的台形塔）
  const g = x.createLinearGradient(0, -r * 0.9, 0, r * 0.85);
  g.addColorStop(0, lightenColor(col, 0.35));
  g.addColorStop(1, darkenColor(col, 0.4));
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(-r * 0.5, -r * 0.85);
  x.lineTo(r * 0.5, -r * 0.85);
  x.lineTo(r * 0.85, r * 0.85);
  x.lineTo(-r * 0.85, r * 0.85);
  x.closePath();
  x.fill();
  x.strokeStyle = 'rgba(10,40,40,.55)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 正面烧瓶窗口（圆形观察窗）
  const og = x.createRadialGradient(-r * 0.06, -r * 0.16, r * 0.04, 0, -r * 0.1, r * 0.36);
  og.addColorStop(0, '#bff2ea');
  og.addColorStop(1, '#2a8a80');
  x.fillStyle = og;
  x.beginPath(); x.arc(0, -r * 0.1, r * 0.34, 0, 7); x.fill();
  x.strokeStyle = 'rgba(10,40,40,.6)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 窗内烧瓶剪影
  x.fillStyle = '#0e3a36';
  x.beginPath();
  x.moveTo(-r * 0.07, -r * 0.3);
  x.lineTo(r * 0.07, -r * 0.3);
  x.lineTo(r * 0.07, -r * 0.14);
  x.lineTo(r * 0.18, r * 0.08);
  x.lineTo(-r * 0.18, r * 0.08);
  x.lineTo(-r * 0.07, -r * 0.14);
  x.closePath();
  x.fill();
  // 底部进料槽
  x.fillStyle = '#173a3a';
  rrPath(x, -r * 0.5, r * 0.56, r * 1.0, r * 0.2, r * 0.05);
  x.fill();
  // 顶盖
  x.fillStyle = lightenColor(col, 0.25);
  rrPath(x, -r * 0.56, -r * 0.98, r * 1.12, r * 0.18, r * 0.05);
  x.fill();
  // 天线
  x.strokeStyle = '#0e3a36';
  x.lineWidth = Math.max(1.2, s * 0.05);
  x.lineCap = 'round';
  x.beginPath(); x.moveTo(0, -r * 0.98); x.lineTo(0, -r * 1.25); x.stroke();
  x.fillStyle = '#ff5a4a';
  x.beginPath(); x.arc(0, -r * 1.28, r * 0.08, 0, 7); x.fill();
},

// 生物实验室：绿白塔身 + DNA 螺旋 + 培养舱
'biolab': (x, r, s, col) => {
  // 主体圆润舱体
  const g = x.createLinearGradient(-r * 0.85, -r * 0.9, r * 0.85, r * 0.85);
  g.addColorStop(0, '#dff0dc');
  g.addColorStop(0.5, lightenColor(col, 0.2));
  g.addColorStop(1, darkenColor(col, 0.35));
  x.fillStyle = g;
  rrPath(x, -r * 0.78, -r * 0.85, r * 1.56, r * 1.72, r * 0.3);
  x.fill();
  x.strokeStyle = 'rgba(20,50,20,.5)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 培养舱观察窗
  const og = x.createRadialGradient(-r * 0.08, -r * 0.18, r * 0.04, 0, -r * 0.12, r * 0.42);
  og.addColorStop(0, '#eafff0');
  og.addColorStop(1, '#3f9a5f');
  x.fillStyle = og;
  x.beginPath(); x.arc(0, -r * 0.12, r * 0.4, 0, 7); x.fill();
  x.strokeStyle = 'rgba(20,50,20,.55)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // DNA 双螺旋
  x.strokeStyle = '#1f6a3f';
  x.lineWidth = Math.max(1.2, s * 0.045);
  x.lineCap = 'round';
  const helix = (off) => {
    x.beginPath();
    for (let t = 0; t <= 10; t++) {
      const py = -r * 0.42 + t * r * 0.085;
      const px = Math.sin(t * 0.63 + off) * r * 0.16;
      t === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    }
    x.stroke();
  };
  helix(0);
  helix(Math.PI);
  // 螺旋横档
  x.lineWidth = Math.max(1, s * 0.035);
  for (let t = 1; t < 10; t += 2) {
    const py = -r * 0.42 + t * r * 0.085;
    const px = Math.sin(t * 0.63) * r * 0.16;
    x.beginPath(); x.moveTo(-px, py); x.lineTo(px, py); x.stroke();
  }
  // 底部进料口
  x.fillStyle = '#1f5a35';
  rrPath(x, -r * 0.42, r * 0.6, r * 0.84, r * 0.18, r * 0.05);
  x.fill();
  // 顶部嫩芽装饰
  x.strokeStyle = '#3f8a4f';
  x.lineWidth = Math.max(1.2, s * 0.045);
  x.beginPath(); x.moveTo(0, -r * 0.85); x.quadraticCurveTo(r * 0.06, -r * 1.02, 0, -r * 1.18); x.stroke();
  x.fillStyle = '#6fce6a';
  x.beginPath(); x.ellipse(-r * 0.12, -r * 1.02, r * 0.11, r * 0.055, -0.6, 0, 7); x.fill();
  x.beginPath(); x.ellipse(r * 0.12, -r * 0.96, r * 0.11, r * 0.055, 0.6, 0, 7); x.fill();
},

  // 锅炉：钢制炉体 + 左右蓝水口 + 底部橙色炉门火焰 + 顶部出汽
  'boiler': (x, r, s, col) => {
    // 炉体
    const g = x.createLinearGradient(0, -r * 0.85, 0, r * 0.85);
    g.addColorStop(0, lightenColor(col, 0.3));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    rrPath(x, -r * 0.68, -r * 0.82, r * 1.36, r * 1.6, r * 0.2);
    x.fill();
    x.strokeStyle = 'rgba(30,20,10,.5)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 铆钉横带
    x.strokeStyle = 'rgba(0,0,0,.18)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.beginPath(); x.moveTo(-r * 0.66, -r * 0.42); x.lineTo(r * 0.66, -r * 0.42); x.stroke();
    // 左右蓝色水口
    const port = (px) => {
      const pg = x.createLinearGradient(px - r * 0.14, 0, px + r * 0.14, 0);
      pg.addColorStop(0, '#7fd0f0');
      pg.addColorStop(1, '#2a6aa8');
      x.fillStyle = pg;
      rrPath(x, px - r * 0.16, -r * 0.28, r * 0.32, r * 0.56, r * 0.08);
      x.fill();
      x.strokeStyle = 'rgba(10,30,60,.55)';
      x.lineWidth = Math.max(0.8, s * 0.035);
      x.stroke();
    };
    port(-r * 0.92);
    port(r * 0.92);
    // 炉门
    x.fillStyle = '#3a2a1c';
    rrPath(x, -r * 0.36, r * 0.02, r * 0.72, r * 0.66, r * 0.12);
    x.fill();
    // 炉火
    const fg = x.createRadialGradient(0, r * 0.5, r * 0.03, 0, r * 0.45, r * 0.3);
    fg.addColorStop(0, '#ffe9a0');
    fg.addColorStop(0.55, '#ff9a3a');
    fg.addColorStop(1, 'rgba(220,80,20,0)');
    x.fillStyle = fg;
    x.beginPath(); x.arc(0, r * 0.42, r * 0.3, 0, 7); x.fill();
    // 底部出汽口
    x.fillStyle = '#eef3f8';
    rrPath(x, -r * 0.3, -r * 1.02, r * 0.6, r * 0.24, r * 0.06);
    x.fill();
    // 蒸汽泡泡
    x.fillStyle = 'rgba(255,255,255,.8)';
    x.beginPath(); x.arc(-r * 0.18, -r * 1.14, r * 0.07, 0, 7); x.fill();
    x.beginPath(); x.arc(r * 0.12, -r * 1.22, r * 0.05, 0, 7); x.fill();
  },

  // 蒸汽机：蓝灰机身 + 活塞连杆飞轮 + 底部进汽口
  'steam-engine': (x, r, s, col) => {
    // 机座
    x.fillStyle = darkenColor(col, 0.45);
    rrPath(x, -r * 0.9, r * 0.42, r * 1.8, r * 0.44, r * 0.1);
    x.fill();
    // 汽缸
    const g = x.createLinearGradient(-r * 0.5, 0, r * 0.1, 0);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(1, darkenColor(col, 0.3));
    x.fillStyle = g;
    rrPath(x, -r * 0.5, -r * 0.6, r * 0.62, r * 1.1, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(20,30,45,.5)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 缸顶汽口
    x.fillStyle = '#5a7a92';
    rrPath(x, -r * 0.36, -r * 0.86, r * 0.34, r * 0.3, r * 0.06);
    x.fill();
    // 活塞杆
    x.strokeStyle = '#d8dde4';
    x.lineWidth = r * 0.11;
    x.lineCap = 'round';
    x.beginPath(); x.moveTo(r * 0.12, -r * 0.05); x.lineTo(r * 0.52, r * 0.18); x.stroke();
    // 飞轮
    const fg = x.createRadialGradient(-r * 0.04, -r * 0.06, r * 0.03, 0, 0, r * 0.32);
    fg.addColorStop(0, lightenColor('#c8ccd2', 0.25));
    fg.addColorStop(1, darkenColor('#9aa0a8', 0.2));
    x.fillStyle = fg;
    x.beginPath(); x.arc(r * 0.55, r * 0.18, r * 0.32, 0, 7); x.fill();
    x.strokeStyle = 'rgba(25,35,50,.55)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 轮辐
    x.strokeStyle = 'rgba(40,50,65,.7)';
    x.lineWidth = Math.max(0.9, s * 0.03);
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + 0.4;
      x.beginPath();
      x.moveTo(r * 0.55, r * 0.18);
      x.lineTo(r * 0.55 + Math.cos(a) * r * 0.26, r * 0.18 + Math.sin(a) * r * 0.26);
      x.stroke();
    }
    // 轮毂
    x.fillStyle = '#3a4452';
    x.beginPath(); x.arc(r * 0.55, r * 0.18, r * 0.08, 0, 7); x.fill();
    // 蒸汽
    x.fillStyle = 'rgba(255,255,255,.75)';
    x.beginPath(); x.arc(-r * 0.22, -r * 1.0, r * 0.08, 0, 7); x.fill();
    x.beginPath(); x.arc(-r * 0.05, -r * 1.1, r * 0.06, 0, 7); x.fill();
  },

  // 抽水机：蓝绿水泵机身 + 管口 + 扇叶端面
  'offshore-pump': (x, r, s, col) => {
    // 机身
    const g = x.createLinearGradient(0, -r * 0.8, 0, r * 0.85);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    rrPath(x, -r * 0.72, -r * 0.78, r * 1.44, r * 1.6, r * 0.18);
    x.fill();
    x.strokeStyle = 'rgba(10,40,55,.55)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 出水口（朝上短管）
    x.fillStyle = darkenColor(col, 0.25);
    rrPath(x, -r * 0.2, -r * 1.05, r * 0.4, r * 0.34, r * 0.07);
    x.fill();
    // 端面圆窗：旋转扇叶
    const og = x.createRadialGradient(-r * 0.05, -r * 0.08, r * 0.03, 0, 0, r * 0.4);
    og.addColorStop(0, '#d8f2fa');
    og.addColorStop(1, '#1f6a86');
    x.fillStyle = og;
    x.beginPath(); x.arc(0, 0, r * 0.4, 0, 7); x.fill();
    x.strokeStyle = 'rgba(8,40,55,.6)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 扇叶
    x.fillStyle = 'rgba(255,255,255,.9)';
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI * 2 / 3 + 0.5;
      x.save();
      x.translate(Math.cos(a) * r * 0.17, Math.sin(a) * r * 0.17);
      x.rotate(a + Math.PI / 2);
      x.beginPath();
      x.ellipse(0, 0, r * 0.16, r * 0.07, 0, 0, 7);
      x.fill();
      x.restore();
    }
    // 轮毂
    x.fillStyle = '#0e3a4a';
    x.beginPath(); x.arc(0, 0, r * 0.08, 0, 7); x.fill();
    // 水波
    x.strokeStyle = 'rgba(255,255,255,.7)';
    x.lineWidth = Math.max(1, s * 0.03);
    x.beginPath(); x.arc(0, r * 0.62, r * 0.3, 0.3, Math.PI - 0.3); x.stroke();
    x.beginPath(); x.arc(-r * 0.42, r * 0.68, r * 0.2, 0.4, Math.PI - 0.4); x.stroke();
  },

  // 电采矿机：蓝钢机身 + 中央钻头 + 闪电能量纹
  'electric-mining-drill': (x, r, s, col) => {
    // 机身
    const g = x.createLinearGradient(-r * 0.85, -r * 0.85, r * 0.85, r * 0.85);
    g.addColorStop(0, lightenColor(col, 0.32));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.42));
    x.fillStyle = g;
    rrPath(x, -r * 0.85, -r * 0.85, r * 1.7, r * 1.7, r * 0.16);
    x.fill();
    x.strokeStyle = 'rgba(15,25,50,.55)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 四角螺栓
    x.fillStyle = 'rgba(255,255,255,.35)';
    [[-0.62, -0.62], [0.62, -0.62], [-0.62, 0.62], [0.62, 0.62]].forEach(p => {
      x.beginPath(); x.arc(p[0] * r, p[1] * r, r * 0.06, 0, 7); x.fill();
    });
    // 中央钻头
    const dg = x.createLinearGradient(0, -r * 0.4, 0, r * 0.5);
    dg.addColorStop(0, lightenColor('#c8ccd2', 0.3));
    dg.addColorStop(1, darkenColor('#8a9098', 0.3));
    x.fillStyle = dg;
    x.beginPath();
    x.moveTo(-r * 0.3, -r * 0.36);
    x.lineTo(r * 0.3, -r * 0.36);
    x.lineTo(r * 0.16, r * 0.3);
    x.lineTo(0, r * 0.52);
    x.lineTo(-r * 0.16, r * 0.3);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(20,30,40,.6)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 钻头螺纹
    x.strokeStyle = 'rgba(30,40,55,.5)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    for (let i = 0; i < 3; i++) {
      const py = -r * 0.2 + i * r * 0.22;
      x.beginPath(); x.moveTo(-r * 0.24 + i * r * 0.03, py); x.lineTo(r * 0.24 - i * r * 0.03, py + r * 0.06); x.stroke();
    }
    // 闪电标记
    x.fillStyle = '#ffe14a';
    x.beginPath();
    x.moveTo(r * 0.02, -r * 0.22);
    x.lineTo(-r * 0.16, r * 0.02);
    x.lineTo(-r * 0.02, r * 0.02);
    x.lineTo(-r * 0.1, r * 0.26);
    x.lineTo(r * 0.14, -r * 0.04);
    x.lineTo(0, -r * 0.04);
    x.lineTo(r * 0.14, -r * 0.22);
    x.closePath();
    x.fill();
  },

  // 大型采矿机：更大机身 + 双钻头 + 重型履带边框 + 闪电
  'big-mining-drill': (x, r, s, col) => {
    // 履带底座
    x.fillStyle = darkenColor(col, 0.5);
    rrPath(x, -r * 0.95, r * 0.5, r * 1.9, r * 0.42, r * 0.18);
    x.fill();
    x.fillStyle = 'rgba(0,0,0,.3)';
    for (let i = 0; i < 6; i++) {
      x.fillRect(-r * 0.85 + i * r * 0.3, r * 0.56, r * 0.08, r * 0.3);
    }
    // 机身
    const g = x.createLinearGradient(-r * 0.8, -r * 0.9, r * 0.8, r * 0.7);
    g.addColorStop(0, lightenColor(col, 0.32));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.42));
    x.fillStyle = g;
    rrPath(x, -r * 0.8, -r * 0.9, r * 1.6, r * 1.55, r * 0.16);
    x.fill();
    x.strokeStyle = 'rgba(15,25,50,.55)';
    x.lineWidth = Math.max(1, s * 0.05);
    x.stroke();
    // 双钻头
    const drill = (dxx) => {
      const dg = x.createLinearGradient(dxx, -r * 0.5, dxx, r * 0.55);
      dg.addColorStop(0, lightenColor('#c8ccd2', 0.3));
      dg.addColorStop(1, darkenColor('#8a9098', 0.35));
      x.fillStyle = dg;
      x.beginPath();
      x.moveTo(dxx - r * 0.2, -r * 0.4);
      x.lineTo(dxx + r * 0.2, -r * 0.4);
      x.lineTo(dxx + r * 0.1, r * 0.34);
      x.lineTo(dxx, r * 0.56);
      x.lineTo(dxx - r * 0.1, r * 0.34);
      x.closePath();
      x.fill();
      x.strokeStyle = 'rgba(20,30,40,.6)';
      x.lineWidth = Math.max(0.9, s * 0.035);
      x.stroke();
    };
    drill(-r * 0.32);
    drill(r * 0.32);
    // 闪电标记
    x.fillStyle = '#ffe14a';
    x.beginPath();
    x.moveTo(r * 0.02, -r * 0.78);
    x.lineTo(-r * 0.14, -r * 0.56);
    x.lineTo(-r * 0.02, -r * 0.56);
    x.lineTo(-r * 0.1, -r * 0.34);
    x.lineTo(r * 0.12, -r * 0.6);
    x.lineTo(0, -r * 0.6);
    x.lineTo(r * 0.12, -r * 0.78);
    x.closePath();
    x.fill();
    // 顶部警示灯
    x.fillStyle = '#ffb03a';
    x.beginPath(); x.arc(-r * 0.55, -r * 0.72, r * 0.08, 0, 7); x.fill();
  },

  // 电炉：青绿炉体 + 电热丝炉口 + 能量指示灯
  'electric-furnace': (x, r, s, col) => {
    // 炉体
    const g = x.createLinearGradient(0, -r * 0.85, 0, r * 0.85);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.42));
    x.fillStyle = g;
    rrPath(x, -r * 0.8, -r * 0.82, r * 1.6, r * 1.64, r * 0.15);
    x.fill();
    x.strokeStyle = 'rgba(10,45,35,.55)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 炉口
    x.fillStyle = '#1a2a26';
    rrPath(x, -r * 0.42, -r * 0.55, r * 0.84, r * 0.5, r * 0.08);
    x.fill();
    // 电热丝（发光电阻圈）
    x.strokeStyle = '#ff7a3a';
    x.lineWidth = Math.max(1.2, s * 0.04);
    x.beginPath();
    for (let i = 0; i < 4; i++) {
      const px = -r * 0.3 + i * r * 0.2;
      i === 0 ? x.moveTo(px, -r * 0.42) : x.lineTo(px, -r * 0.42);
      x.lineTo(px + r * 0.1, -r * 0.3);
    }
    x.stroke();
    x.strokeStyle = 'rgba(255,220,120,.85)';
    x.lineWidth = Math.max(0.6, s * 0.02);
    x.stroke();
    // 侧面散热格栅
    x.strokeStyle = 'rgba(0,0,0,.3)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    for (let i = 0; i < 3; i++) {
      x.beginPath();
      x.moveTo(-r * 0.5, r * 0.12 + i * r * 0.14);
      x.lineTo(r * 0.5, r * 0.12 + i * r * 0.14);
      x.stroke();
    }
    // 出料口
    x.fillStyle = '#14302a';
    rrPath(x, -r * 0.55, r * 0.62, r * 1.1, r * 0.18, r * 0.05);
    x.fill();
    // 电能指示灯
    x.fillStyle = '#7af0c8';
    x.beginPath(); x.arc(r * 0.58, -r * 0.62, r * 0.08, 0, 7); x.fill();
  },

  // 组装机 II：紫色机身 + 齿轮 + 高速指示条纹
  'assembling-machine-2': (x, r, s, col) => {
    // 机身
    const g = x.createLinearGradient(-r * 0.85, -r * 0.85, r * 0.85, r * 0.85);
    g.addColorStop(0, lightenColor(col, 0.32));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.42));
    x.fillStyle = g;
    rrPath(x, -r * 0.85, -r * 0.8, r * 1.7, r * 1.66, r * 0.14);
    x.fill();
    x.strokeStyle = 'rgba(30,10,45,.55)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 中央齿轮
    const teeth = 8;
    x.fillStyle = '#d8dde4';
    for (let i = 0; i < teeth; i++) {
      const a = i * Math.PI * 2 / teeth + 0.2;
      x.save();
      x.translate(Math.cos(a) * r * 0.4, Math.sin(a) * r * 0.4);
      x.rotate(a);
      x.fillRect(-r * 0.08, -r * 0.1, r * 0.16, r * 0.2);
      x.restore();
    }
    const gg = x.createRadialGradient(-r * 0.05, -r * 0.1, r * 0.03, 0, 0, r * 0.38);
    gg.addColorStop(0, lightenColor('#d8dde4', 0.35));
    gg.addColorStop(1, darkenColor('#d8dde4', 0.25));
    x.fillStyle = gg;
    x.beginPath(); x.arc(0, 0, r * 0.34, 0, 7); x.fill();
    x.fillStyle = '#453062';
    x.beginPath(); x.arc(0, 0, r * 0.12, 0, 7); x.fill();
    // 速度条纹（两侧斜纹）
    x.strokeStyle = 'rgba(255,255,255,.4)';
    x.lineWidth = Math.max(1, s * 0.035);
    for (let i = 0; i < 2; i++) {
      x.beginPath();
      x.moveTo(-r * 0.72, -r * 0.1 + i * r * 0.2);
      x.lineTo(-r * 0.5, -r * 0.22 + i * r * 0.2);
      x.stroke();
      x.beginPath();
      x.moveTo(r * 0.5, -r * 0.1 + i * r * 0.2);
      x.lineTo(r * 0.72, -r * 0.22 + i * r * 0.2);
      x.stroke();
    }
    // 底部出入口
    x.fillStyle = '#241a30';
    rrPath(x, -r * 0.6, r * 0.58, r * 1.2, r * 0.2, r * 0.05);
    x.fill();
    // 状态灯
    x.fillStyle = '#5ad06a';
    x.beginPath(); x.arc(r * 0.6, -r * 0.6, r * 0.09, 0, 7); x.fill();
  },

  // 抽油机：深绿井架 + 摇臂点头运动 + 黑金原油滴
  'pumpjack': (x, r, s, col) => {
    // 地面
    x.fillStyle = darkenColor(col, 0.45);
    rrPath(x, -r * 0.95, r * 0.6, r * 1.9, r * 0.28, r * 0.06);
    x.fill();
    // 井架（三角支撑）
    x.strokeStyle = darkenColor(col, 0.25);
    x.lineWidth = r * 0.13;
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(-r * 0.42, r * 0.62); x.lineTo(-r * 0.1, -r * 0.3);
    x.moveTo(r * 0.42, r * 0.62); x.lineTo(r * 0.1, -r * 0.3);
    x.stroke();
    // 平衡配重块
    x.fillStyle = darkenColor(col, 0.35);
    rrPath(x, -r * 0.85, r * 0.02, r * 0.4, r * 0.55, r * 0.08);
    x.fill();
    // 摇臂（驴头）
    x.strokeStyle = '#c8b060';
    x.lineWidth = r * 0.12;
    x.beginPath(); x.moveTo(-r * 0.62, -r * 0.18); x.lineTo(r * 0.55, -r * 0.38); x.stroke();
    // 驴头弧
    x.beginPath(); x.arc(r * 0.55, -r * 0.24, r * 0.16, Math.PI * 0.6, Math.PI * 1.4); x.stroke();
    // 钢丝绳 + 泵头
    x.strokeStyle = '#8a8f96';
    x.lineWidth = Math.max(0.9, s * 0.03);
    x.beginPath(); x.moveTo(r * 0.55, -r * 0.08); x.lineTo(r * 0.55, r * 0.3); x.stroke();
    x.fillStyle = '#3a3f46';
    rrPath(x, r * 0.44, r * 0.3, r * 0.22, r * 0.18, r * 0.04);
    x.fill();
    // 原油滴
    x.fillStyle = '#1a1410';
    x.beginPath();
    x.moveTo(r * 0.55, r * 0.56);
    x.quadraticCurveTo(r * 0.66, r * 0.72, r * 0.55, r * 0.84);
    x.quadraticCurveTo(r * 0.44, r * 0.72, r * 0.55, r * 0.56);
    x.fill();
    x.fillStyle = 'rgba(255,255,255,.25)';
    x.beginPath(); x.arc(r * 0.51, r * 0.74, r * 0.03, 0, 7); x.fill();
    // 电机盒
    x.fillStyle = lightenColor(col, 0.15);
    rrPath(x, -r * 0.05, r * 0.28, r * 0.5, r * 0.32, r * 0.06);
    x.fill();
  },

  // 太阳能板：深蓝面板 + 白色栅线 + 斜射阳光
  'solar-panel': (x, r, s, col) => {
    // 面板（略带透视的平行四边形）
    const g = x.createLinearGradient(-r * 0.8, -r * 0.7, r * 0.7, r * 0.7);
    g.addColorStop(0, lightenColor(col, 0.25));
    g.addColorStop(0.6, col);
    g.addColorStop(1, darkenColor(col, 0.35));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(-r * 0.85, -r * 0.6);
    x.lineTo(r * 0.7, -r * 0.85);
    x.lineTo(r * 0.85, r * 0.45);
    x.lineTo(-r * 0.7, r * 0.7);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(10,25,60,.6)';
    x.lineWidth = Math.max(1, s * 0.05);
    x.stroke();
    // 白色栅线
    x.strokeStyle = 'rgba(255,255,255,.55)';
    x.lineWidth = Math.max(0.8, s * 0.028);
    for (let i = 1; i < 4; i++) {
      const t = i / 4;
      x.beginPath();
      x.moveTo(-r * 0.85 + t * r * 0.15, -r * 0.6 + t * r * 0.1);
      x.lineTo(r * 0.7 - t * r * 0.15, -r * 0.85 + t * r * 0.1);
      x.stroke();
    }
    for (let i = 1; i < 3; i++) {
      x.beginPath();
      x.moveTo(-r * 0.85 + i * r * 0.52, -r * 0.6 + i * r * 0.1);
      x.lineTo(-r * 0.7 + i * r * 0.52, r * 0.7 + i * r * 0.1);
      x.stroke();
    }
    // 支架
    x.strokeStyle = '#5a6270';
    x.lineWidth = r * 0.1;
    x.beginPath(); x.moveTo(0, r * 0.55); x.lineTo(0, r * 0.9); x.stroke();
    // 太阳
    x.fillStyle = '#ffdf5a';
    x.beginPath(); x.arc(r * 0.55, -r * 0.75, r * 0.16, 0, 7); x.fill();
    // 光线
    x.strokeStyle = 'rgba(255,223,90,.9)';
    x.lineWidth = Math.max(0.8, s * 0.028);
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.4;
      x.beginPath();
      x.moveTo(r * 0.55 + Math.cos(a) * r * 0.22, -r * 0.75 + Math.sin(a) * r * 0.22);
      x.lineTo(r * 0.55 + Math.cos(a) * r * 0.3, -r * 0.75 + Math.sin(a) * r * 0.3);
      x.stroke();
    }
  },

  // 蓄电器：黄铜外壳 + 电量窗（半充绿色箭头）+ 电极
  'accumulator': (x, r, s, col) => {
    // 外壳
    const g = x.createLinearGradient(-r * 0.7, 0, r * 0.7, 0);
    g.addColorStop(0, lightenColor(col, 0.3));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.38));
    x.fillStyle = g;
    rrPath(x, -r * 0.68, -r * 0.62, r * 1.36, r * 1.5, r * 0.14);
    x.fill();
    x.strokeStyle = 'rgba(60,45,10,.55)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 顶部电极
    x.fillStyle = darkenColor(col, 0.45);
    rrPath(x, -r * 0.2, -r * 0.95, r * 0.4, r * 0.35, r * 0.06);
    x.fill();
    x.fillStyle = '#9aa0a8';
    x.fillRect(-r * 0.08, -r * 1.1, r * 0.16, r * 0.2);
    // 电量观察窗
    const wg = x.createLinearGradient(0, -r * 0.4, 0, r * 0.7);
    wg.addColorStop(0, '#e8f4d0');
    wg.addColorStop(1, '#5a7a3a');
    x.fillStyle = wg;
    rrPath(x, -r * 0.42, -r * 0.4, r * 0.84, r * 1.06, r * 0.1);
    x.fill();
    x.strokeStyle = 'rgba(50,40,10,.5)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 充电闪电
    x.fillStyle = '#f0e14a';
    x.beginPath();
    x.moveTo(r * 0.06, -r * 0.24);
    x.lineTo(-r * 0.18, r * 0.12);
    x.lineTo(-r * 0.02, r * 0.12);
    x.lineTo(-r * 0.12, r * 0.42);
    x.lineTo(r * 0.16, r * 0.02);
    x.lineTo(0, r * 0.02);
    x.lineTo(r * 0.16, -r * 0.24);
    x.closePath();
    x.fill();
    // 外壳高光
    x.strokeStyle = 'rgba(255,255,255,.4)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.beginPath(); x.moveTo(-r * 0.5, -r * 0.45); x.lineTo(-r * 0.5, r * 0.6); x.stroke();
  },
  // 钢铁炉：钢灰炉体 + 大烟囱冒烟 + 炉口橙焰 + 铆钉加固
  'steel-furnace': (x, r, s, col) => {
    // 炉体（钢灰渐变，下宽上窄的梯形感）
    const g = x.createLinearGradient(-r * 0.8, -r * 0.6, r * 0.8, r * 0.8);
    g.addColorStop(0, lightenColor(col, 0.3));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(-r * 0.82, -r * 0.35);
    x.lineTo(r * 0.82, -r * 0.35);
    x.lineTo(r * 0.9, r * 0.75);
    x.lineTo(-r * 0.9, r * 0.75);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(25,30,38,.6)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 大烟囱
    const cg = x.createLinearGradient(-r * 0.2, 0, r * 0.2, 0);
    cg.addColorStop(0, darkenColor(col, 0.2));
    cg.addColorStop(0.4, lightenColor(col, 0.2));
    cg.addColorStop(1, darkenColor(col, 0.35));
    x.fillStyle = cg;
    rrPath(x, -r * 0.22, -r * 1.05, r * 0.44, r * 0.85, r * 0.06);
    x.fill();
    x.strokeStyle = 'rgba(25,30,38,.55)';
    x.stroke();
    // 烟囱口加固环
    x.fillStyle = darkenColor(col, 0.3);
    rrPath(x, -r * 0.28, -r * 1.12, r * 0.56, r * 0.14, r * 0.05);
    x.fill();
    // 烟雾
    x.fillStyle = 'rgba(200,205,215,.55)';
    x.beginPath(); x.arc(-r * 0.1, -r * 1.18, r * 0.12, 0, 7); x.fill();
    x.fillStyle = 'rgba(200,205,215,.35)';
    x.beginPath(); x.arc(r * 0.14, -r * 1.32, r * 0.09, 0, 7); x.fill();
    // 炉口（内凹黑腔）
    x.fillStyle = '#241d16';
    rrPath(x, -r * 0.5, r * 0.05, r * 1.0, r * 0.5, r * 0.08);
    x.fill();
    // 外焰
    x.fillStyle = '#e8703a';
    x.beginPath();
    x.moveTo(-r * 0.34, r * 0.5);
    x.quadraticCurveTo(-r * 0.42, r * 0.24, 0, r * 0.12);
    x.quadraticCurveTo(r * 0.42, r * 0.24, r * 0.34, r * 0.5);
    x.closePath();
    x.fill();
    // 内焰
    x.fillStyle = '#f8c83a';
    x.beginPath();
    x.moveTo(-r * 0.18, r * 0.5);
    x.quadraticCurveTo(-r * 0.22, r * 0.3, 0, r * 0.24);
    x.quadraticCurveTo(r * 0.22, r * 0.3, r * 0.18, r * 0.5);
    x.closePath();
    x.fill();
    // 铆钉
    x.fillStyle = lightenColor(col, 0.4);
    for (const [px, py] of [[-0.66, -0.14], [0.66, -0.14], [-0.72, 0.62], [0.72, 0.62]]) {
      x.beginPath(); x.arc(px * r, py * r, r * 0.05, 0, 7); x.fill();
    }
    // 侧身高光
    x.strokeStyle = 'rgba(255,255,255,.3)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.beginPath(); x.moveTo(-r * 0.62, -r * 0.22); x.lineTo(-r * 0.68, r * 0.6); x.stroke();
  },

  // 组装机 III：紫色机身 + 双齿轮咬合 + 三重速度条纹
  'assembling-machine-3': (x, r, s, col) => {
    // 机身
    const g = x.createLinearGradient(-r * 0.85, -r * 0.85, r * 0.85, r * 0.85);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    rrPath(x, -r * 0.85, -r * 0.8, r * 1.7, r * 1.66, r * 0.14);
    x.fill();
    x.strokeStyle = 'rgba(30,10,45,.55)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 双齿轮（主 + 副，咬合）
    const gear = (cx, cy, rad) => {
      const teeth = 8;
      x.fillStyle = '#d8dde4';
      for (let i = 0; i < teeth; i++) {
        const a = i * Math.PI * 2 / teeth + 0.35;
        x.save();
        x.translate(cx + Math.cos(a) * rad * 0.82, cy + Math.sin(a) * rad * 0.82);
        x.rotate(a);
        x.fillRect(-rad * 0.16, -rad * 0.2, rad * 0.32, rad * 0.4);
        x.restore();
      }
      const gg = x.createRadialGradient(cx - rad * 0.15, cy - rad * 0.15, rad * 0.06, cx, cy, rad);
      gg.addColorStop(0, lightenColor('#d8dde4', 0.35));
      gg.addColorStop(1, darkenColor('#d8dde4', 0.25));
      x.fillStyle = gg;
      x.beginPath(); x.arc(cx, cy, rad * 0.68, 0, 7); x.fill();
      x.fillStyle = '#3a2a55';
      x.beginPath(); x.arc(cx, cy, rad * 0.24, 0, 7); x.fill();
    };
    gear(-r * 0.12, -r * 0.06, r * 0.36);
    gear(r * 0.42, r * 0.26, r * 0.18);
    // 三重速度条纹（比 II 多一组，更强）
    x.strokeStyle = 'rgba(255,255,255,.45)';
    x.lineWidth = Math.max(1, s * 0.035);
    for (let i = 0; i < 3; i++) {
      x.beginPath();
      x.moveTo(-r * 0.74, -r * 0.24 + i * r * 0.24);
      x.lineTo(-r * 0.48, -r * 0.4 + i * r * 0.24);
      x.stroke();
      x.beginPath();
      x.moveTo(r * 0.48, r * 0.04 + i * r * 0.2);
      x.lineTo(r * 0.74, -r * 0.12 + i * r * 0.2);
      x.stroke();
    }
    // 底部出入口
    x.fillStyle = '#241a30';
    rrPath(x, -r * 0.6, r * 0.58, r * 1.2, r * 0.2, r * 0.05);
    x.fill();
    // 状态灯
    x.fillStyle = '#5ad06a';
    x.beginPath(); x.arc(-r * 0.6, -r * 0.6, r * 0.09, 0, 7); x.fill();
  },

  // 炼油厂：锈橙厂房 + 蒸馏塔 + 管廊 + 原油储罐
  'oil-refinery': (x, r, s, col) => {
    // 蒸馏塔（高柱，分节）
    const tg = x.createLinearGradient(-r * 0.16, 0, r * 0.16, 0);
    tg.addColorStop(0, darkenColor(col, 0.25));
    tg.addColorStop(0.4, lightenColor(col, 0.18));
    tg.addColorStop(1, darkenColor(col, 0.3));
    x.fillStyle = tg;
    rrPath(x, -r * 0.16, -r * 0.95, r * 0.32, r * 1.55, r * 0.08);
    x.fill();
    x.strokeStyle = 'rgba(40,20,8,.55)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 塔节环
    x.fillStyle = darkenColor(col, 0.2);
    for (const py of [-0.62, -0.24, 0.14]) {
      rrPath(x, -r * 0.19, py * r, r * 0.38, r * 0.09, r * 0.04);
      x.fill();
    }
    // 塔顶小烟囱冒烟
    x.fillStyle = darkenColor(col, 0.35);
    rrPath(x, r * 0.06, -r * 1.06, r * 0.1, r * 0.16, r * 0.03);
    x.fill();
    x.fillStyle = 'rgba(220,220,225,.45)';
    x.beginPath(); x.arc(r * 0.14, -r * 1.16, r * 0.1, 0, 7); x.fill();
    // 主厂房
    const g = x.createLinearGradient(-r * 0.8, -r * 0.5, 0, r * 0.7);
    g.addColorStop(0, lightenColor(col, 0.25));
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    rrPath(x, -r * 0.95, -r * 0.3, r * 1.35, r * 1.05, r * 0.08);
    x.fill();
    x.strokeStyle = 'rgba(40,20,8,.55)';
    x.stroke();
    // 厂房窗户（暗口 + 橙光）
    x.fillStyle = '#2a1c10';
    for (const px of [-0.72, -0.4]) {
      rrPath(x, px * r, -r * 0.1, r * 0.22, r * 0.3, r * 0.04);
      x.fill();
    }
    x.fillStyle = 'rgba(240,150,60,.85)';
    rrPath(x, -r * 0.69, -r * 0.07, r * 0.16, r * 0.24, r * 0.03);
    x.fill();
    rrPath(x, -r * 0.37, -r * 0.07, r * 0.16, r * 0.24, r * 0.03);
    x.fill();
    // 管廊（塔→厂房）
    x.strokeStyle = '#9aa0a8';
    x.lineWidth = r * 0.09;
    x.beginPath(); x.moveTo(r * 0.16, -r * 0.4); x.lineTo(r * 0.5, -r * 0.4); x.lineTo(r * 0.5, r * 0.3); x.stroke();
    x.lineWidth = r * 0.06;
    x.beginPath(); x.moveTo(r * 0.16, -r * 0.2); x.lineTo(r * 0.62, -r * 0.2); x.stroke();
    // 原油储罐
    const og = x.createLinearGradient(r * 0.45, 0, r * 0.95, 0);
    og.addColorStop(0, '#3a332c');
    og.addColorStop(1, '#191410');
    x.fillStyle = og;
    rrPath(x, r * 0.42, r * 0.1, r * 0.55, r * 0.68, r * 0.1);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.5)';
    x.stroke();
    // 储罐高光
    x.strokeStyle = 'rgba(255,255,255,.2)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.beginPath(); x.moveTo(r * 0.5, r * 0.18); x.lineTo(r * 0.5, r * 0.7); x.stroke();
    // 底部地面
    x.fillStyle = 'rgba(50,35,20,.4)';
    rrPath(x, -r * 0.95, r * 0.72, r * 1.9, r * 0.16, r * 0.05);
    x.fill();
  },

  // 化工厂：灰绿厂房 + 玻璃反应釜 + 冒泡液体 + 输送管
  'chemical-plant': (x, r, s, col) => {
    // 厂房主体
    const g = x.createLinearGradient(-r * 0.8, -r * 0.7, r * 0.8, r * 0.8);
    g.addColorStop(0, lightenColor(col, 0.28));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.42));
    x.fillStyle = g;
    rrPath(x, -r * 0.85, -r * 0.55, r * 1.7, r * 1.4, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(25,35,20,.6)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 玻璃反应釜（圆窗，内部液体冒泡）
    x.fillStyle = 'rgba(15,25,15,.55)';
    x.beginPath(); x.arc(-r * 0.18, r * 0.05, r * 0.38, 0, 7); x.fill();
    // 釜内液体
    x.save();
    x.beginPath(); x.arc(-r * 0.18, r * 0.05, r * 0.32, 0, 7); x.clip();
    const lg = x.createLinearGradient(0, -r * 0.1, 0, r * 0.4);
    lg.addColorStop(0, '#7ad06a');
    lg.addColorStop(1, '#3a7a2a');
    x.fillStyle = lg;
    x.fillRect(-r * 0.55, -r * 0.05, r * 1.1, r * 0.6);
    // 气泡
    x.fillStyle = 'rgba(255,255,255,.6)';
    x.beginPath(); x.arc(-r * 0.3, r * 0.18, r * 0.05, 0, 7); x.fill();
    x.beginPath(); x.arc(-r * 0.06, r * 0.1, r * 0.04, 0, 7); x.fill();
    x.fillStyle = 'rgba(255,255,255,.35)';
    x.beginPath(); x.arc(-r * 0.18, r * 0.28, r * 0.035, 0, 7); x.fill();
    x.restore();
    // 釜口金属箍
    x.strokeStyle = '#9aa0a8';
    x.lineWidth = r * 0.09;
    x.beginPath(); x.arc(-r * 0.18, r * 0.05, r * 0.38, 0, 7); x.stroke();
    // 顶部进料管 + 阀门轮
    x.strokeStyle = '#9aa0a8';
    x.lineWidth = r * 0.1;
    x.beginPath(); x.moveTo(-r * 0.18, -r * 0.55); x.lineTo(-r * 0.18, -r * 0.8); x.lineTo(r * 0.3, -r * 0.8); x.stroke();
    x.strokeStyle = '#c85050';
    x.lineWidth = r * 0.06;
    x.beginPath(); x.arc(r * 0.3, -r * 0.8, r * 0.1, 0, 7); x.stroke();
    // 右侧出料管
    x.strokeStyle = '#9aa0a8';
    x.lineWidth = r * 0.09;
    x.beginPath(); x.moveTo(r * 0.2, r * 0.3); x.lineTo(r * 0.55, r * 0.3); x.lineTo(r * 0.55, r * 0.55); x.stroke();
    // 危险警示条纹（底部）
    x.save();
    rrPath(x, -r * 0.85, r * 0.52, r * 1.7, r * 0.32, r * 0.08);
    x.clip();
    x.fillStyle = '#e0b040';
    x.fillRect(-r * 0.85, r * 0.52, r * 1.7, r * 0.32);
    x.fillStyle = '#2a2a28';
    for (let i = 0; i < 5; i++) {
      x.beginPath();
      const px = -r * 0.9 + i * r * 0.4;
      x.moveTo(px, r * 0.84); x.lineTo(px + r * 0.16, r * 0.52);
      x.lineTo(px + r * 0.3, r * 0.52); x.lineTo(px + r * 0.14, r * 0.84);
      x.closePath(); x.fill();
    }
    x.restore();
    x.strokeStyle = 'rgba(25,35,20,.5)';
    x.lineWidth = Math.max(1, s * 0.035);
    rrPath(x, -r * 0.85, r * 0.52, r * 1.7, r * 0.32, r * 0.08);
    x.stroke();
  },

  // 速度模块 I：蓝色电路板 + 三重上行箭头 + 单档位灯
  'speed-module': (x, r, s, col) => {
    _moduleBase(x, r, s, col);
    _moduleChevrons(x, r, s);
    _modulePips(x, r, 1);
  },

  // 速度模块 II：深蓝电路板 + 三重上行箭头 + 双档位灯
  'speed-module-2': (x, r, s, col) => {
    _moduleBase(x, r, s, col);
    _moduleChevrons(x, r, s);
    _modulePips(x, r, 2);
  },

  // 速度模块 III：更深的蓝电路板 + 发光箭头 + 三档位灯
  'speed-module-3': (x, r, s, col) => {
    _moduleBase(x, r, s, col);
    _moduleChevrons(x, r, s);
    _modulePips(x, r, 3);
  },

  // 产能模块 I：绿色电路板 + 上行箭头带加号 + 单档位灯
  'productivity-module': (x, r, s, col) => {
    _moduleBase(x, r, s, col);
    _moduleArrowPlus(x, r, s);
    _modulePips(x, r, 1);
  },

  // 产能模块 II：深绿电路板 + 上行箭头带加号 + 双档位灯
  'productivity-module-2': (x, r, s, col) => {
    _moduleBase(x, r, s, col);
    _moduleArrowPlus(x, r, s);
    _modulePips(x, r, 2);
  },

  // 产能模块 III：更深的绿电路板 + 发光箭头加号 + 三档位灯
  'productivity-module-3': (x, r, s, col) => {
    _moduleBase(x, r, s, col);
    _moduleArrowPlus(x, r, s);
    _modulePips(x, r, 3);
  },

  // ===== 信号塔：中继塔体 + 两侧广播电波 =====
  'beacon': (x, r, s, col) => {
    // 塔基座
    const bg = x.createLinearGradient(0, r * 0.2, 0, r * 0.9);
    bg.addColorStop(0, lightenColor(col, 0.25));
    bg.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = bg;
    x.beginPath();
    x.moveTo(-r * 0.72, r * 0.88);
    x.lineTo(-r * 0.5, r * 0.18);
    x.lineTo(r * 0.5, r * 0.18);
    x.lineTo(r * 0.72, r * 0.88);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(15,20,30,.6)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 塔颈
    x.fillStyle = darkenColor(col, 0.2);
    x.fillRect(-r * 0.18, -r * 0.28, r * 0.36, r * 0.5);
    // 塔顶模块舱（发光核心）
    const tg = x.createLinearGradient(-r * 0.45, -r * 0.9, r * 0.45, -r * 0.1);
    tg.addColorStop(0, lightenColor(col, 0.45));
    tg.addColorStop(0.55, col);
    tg.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = tg;
    rrPath(x, -r * 0.48, -r * 0.95, r * 0.96, r * 0.78, r * 0.14);
    x.fill();
    x.strokeStyle = 'rgba(15,20,30,.55)';
    x.stroke();
    // 两个模块插槽
    x.fillStyle = 'rgba(20,26,36,.75)';
    x.fillRect(-r * 0.34, -r * 0.78, r * 0.26, r * 0.44);
    x.fillRect(r * 0.08, -r * 0.78, r * 0.26, r * 0.44);
    // 核心光晕
    x.fillStyle = 'rgba(255,244,180,.95)';
    x.beginPath(); x.arc(0, -r * 0.56, r * 0.1, 0, 7); x.fill();
    // 两侧广播电波（弧线）
    x.strokeStyle = 'rgba(255,244,180,.85)';
    x.lineCap = 'round';
    for (let i = 0; i < 2; i++) {
      const w = r * (0.22 + i * 0.18);
      x.lineWidth = Math.max(0.8, s * (0.045 - i * 0.012));
      x.beginPath(); x.arc(-r * 0.62, -r * 0.56, w, Math.PI * 0.62, Math.PI * 1.38); x.stroke();
      x.beginPath(); x.arc(r * 0.62, -r * 0.56, w, -Math.PI * 0.38, Math.PI * 0.38); x.stroke();
    }
    // 基座指示灯
    x.fillStyle = 'rgba(120,220,255,.9)';
    x.beginPath(); x.arc(0, r * 0.55, r * 0.09, 0, 7); x.fill();
  },

  // 效率模块：淡紫电路板 + 叶子 + 单档位灯
  'efficiency-module': (x, r, s, col) => {
    _moduleBase(x, r, s, col);
    _moduleLeaf(x, r, s);
    _modulePips(x, r, 1);
  },

  // 效率模块 II：紫色电路板 + 叶子 + 双档位灯
  'efficiency-module-2': (x, r, s, col) => {
    _moduleBase(x, r, s, col);
    _moduleLeaf(x, r, s);
    _modulePips(x, r, 2);
  },

  // 效率模块 III：深紫电路板 + 发光叶 + 三档位灯
  'efficiency-module-3': (x, r, s, col) => {
    _moduleBase(x, r, s, col);
    _moduleLeaf(x, r, s);
    _modulePips(x, r, 3);
  },

  // 品质模块：金色电路板 + 宝石 + 单档位灯
  'quality-module': (x, r, s, col) => {
    _moduleBase(x, r, s, col);
    _moduleGem(x, r, s);
    _modulePips(x, r, 1);
  },

  // 品质模块 II：深金电路板 + 宝石 + 双档位灯
  'quality-module-2': (x, r, s, col) => {
    _moduleBase(x, r, s, col);
    _moduleGem(x, r, s);
    _modulePips(x, r, 2);
  },

  // 品质模块 III：橙金电路板 + 宝石 + 三档位灯
  'quality-module-3': (x, r, s, col) => {
    _moduleBase(x, r, s, col);
    _moduleGem(x, r, s);
    _modulePips(x, r, 3);
  },

  // 电磁工厂：蓝钢厂房 + 电磁线圈 + 闪电符号
  'electromagnetic-plant': (x, r, s, col) => {
    // 厂房主体
    const g = x.createLinearGradient(-r * 0.8, -r * 0.7, r * 0.8, r * 0.85);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(-r * 0.85, r * 0.85);
    x.lineTo(-r * 0.85, -r * 0.1);
    x.lineTo(-r * 0.35, -r * 0.55);
    x.lineTo(r * 0.5, -r * 0.55);
    x.lineTo(r * 0.5, r * 0.85);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(15,25,50,.6)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 侧翼低层
    x.fillStyle = darkenColor(col, 0.3);
    x.beginPath();
    x.moveTo(r * 0.5, r * 0.85);
    x.lineTo(r * 0.5, -r * 0.1);
    x.lineTo(r * 0.85, -r * 0.1);
    x.lineTo(r * 0.85, r * 0.85);
    x.closePath();
    x.fill();
    x.stroke();
    // 屋顶电磁线圈（竖杆 + 顶部圆球）
    x.fillStyle = '#9aa2ae';
    x.fillRect(-r * 0.66, -r * 0.95, r * 0.12, r * 0.5);
    x.fillStyle = '#e8ecf2';
    x.beginPath(); x.arc(-r * 0.6, -r * 1.0, r * 0.12, 0, 7); x.fill();
    x.strokeStyle = 'rgba(120,180,255,.8)';
    x.lineWidth = Math.max(0.8, s * 0.035);
    x.beginPath(); x.arc(-r * 0.6, -r * 1.0, r * 0.2, 0, 7); x.stroke();
    // 面板闪电符号
    x.fillStyle = '#fff16a';
    x.beginPath();
    x.moveTo(r * 0.06, -r * 0.32);
    x.lineTo(-r * 0.22, r * 0.12);
    x.lineTo(-r * 0.02, r * 0.12);
    x.lineTo(-r * 0.12, r * 0.62);
    x.lineTo(r * 0.28, r * 0.02);
    x.lineTo(r * 0.06, r * 0.02);
    x.lineTo(r * 0.24, -r * 0.32);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(180,120,0,.5)';
    x.lineWidth = Math.max(0.6, s * 0.028);
    x.stroke();
    // 底部通风栅格
    x.strokeStyle = 'rgba(10,18,36,.5)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    for (let i = 0; i < 3; i++) {
      x.beginPath();
      x.moveTo(-r * 0.7, r * 0.42 + i * r * 0.14);
      x.lineTo(-r * 0.3, r * 0.42 + i * r * 0.14);
      x.stroke();
    }
  },

  // 回收机：金属机身 + 三角循环回收箭头
  'recycler': (x, r, s, col) => {
    // 机身（上宽下窄梯形料斗 + 方形机体）
    const g = x.createLinearGradient(-r * 0.8, -r * 0.8, r * 0.8, r * 0.85);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    rrPath(x, -r * 0.8, -r * 0.55, r * 1.6, r * 1.4, r * 0.16);
    x.fill();
    x.strokeStyle = 'rgba(20,25,32,.6)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 顶部进料口
    x.fillStyle = darkenColor(col, 0.35);
    rrPath(x, -r * 0.5, -r * 0.82, r * 1.0, r * 0.34, r * 0.1);
    x.fill();
    x.strokeStyle = 'rgba(20,25,32,.5)';
    x.stroke();
    // 回收三角循环箭头（三段弧箭头）
    const cx = 0, cy = r * 0.12, R = r * 0.42;
    x.strokeStyle = '#4fd07a';
    x.lineCap = 'round';
    x.lineWidth = r * 0.14;
    const heads = [];
    for (let i = 0; i < 3; i++) {
      const a0 = -Math.PI / 2 + i * (Math.PI * 2 / 3) + 0.35;
      const a1 = -Math.PI / 2 + (i + 1) * (Math.PI * 2 / 3) - 0.35;
      x.beginPath();
      x.arc(cx, cy, R, a0, a1);
      x.stroke();
      heads.push(a1);
    }
    // 箭头头部
    x.fillStyle = '#4fd07a';
    for (const a of heads) {
      const hx = cx + R * Math.cos(a), hy = cy + R * Math.sin(a);
      const dir = a + Math.PI / 2 + Math.PI / 3;
      x.beginPath();
      x.moveTo(hx + Math.cos(dir) * r * 0.2, hy + Math.sin(dir) * r * 0.2);
      x.lineTo(hx + Math.cos(dir + 2.5) * r * 0.16, hy + Math.sin(dir + 2.5) * r * 0.16);
      x.lineTo(hx + Math.cos(dir - 2.5) * r * 0.16, hy + Math.sin(dir - 2.5) * r * 0.16);
      x.closePath();
      x.fill();
    }
    // 侧面指示灯
    x.fillStyle = 'rgba(255,210,90,.9)';
    x.beginPath(); x.arc(-r * 0.58, r * 0.68, r * 0.08, 0, 7); x.fill();
    x.fillStyle = 'rgba(120,220,255,.9)';
    x.beginPath(); x.arc(-r * 0.36, r * 0.68, r * 0.08, 0, 7); x.fill();
  },

  // 铸造厂：砖红炉体 + 坩埚浇铸口 + 金色熔液与火花
  'foundry': (x, r, s, col) => {
    // 炉体（宽厚机体）
    const g = x.createLinearGradient(-r * 0.85, -r * 0.7, r * 0.85, r * 0.9);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    rrPath(x, -r * 0.85, -r * 0.5, r * 1.7, r * 1.4, r * 0.14);
    x.fill();
    x.strokeStyle = 'rgba(60,30,10,.6)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 顶部加料斗
    const hg = x.createLinearGradient(0, -r * 0.95, 0, -r * 0.45);
    hg.addColorStop(0, lightenColor(col, 0.25));
    hg.addColorStop(1, darkenColor(col, 0.3));
    x.fillStyle = hg;
    x.beginPath();
    x.moveTo(-r * 0.62, -r * 0.5);
    x.lineTo(-r * 0.4, -r * 0.95);
    x.lineTo(r * 0.4, -r * 0.95);
    x.lineTo(r * 0.62, -r * 0.5);
    x.closePath();
    x.fill();
    x.stroke();
    // 浇铸口（流出的熔液弧线）
    x.strokeStyle = '#ffd76a';
    x.lineCap = 'round';
    x.lineWidth = r * 0.13;
    x.beginPath();
    x.moveTo(-r * 0.85, -r * 0.1);
    x.quadraticCurveTo(-r * 1.1, r * 0.25, -r * 0.92, r * 0.72);
    x.stroke();
    // 出液口发光坩埚池
    const pg = x.createRadialGradient(-r * 0.92, r * 0.72, 0, -r * 0.92, r * 0.72, r * 0.28);
    pg.addColorStop(0, '#fff3b0');
    pg.addColorStop(0.6, '#ffb840');
    pg.addColorStop(1, 'rgba(255,140,30,0)');
    x.fillStyle = pg;
    x.beginPath(); x.arc(-r * 0.92, r * 0.72, r * 0.28, 0, 7); x.fill();
    // 炉面观察窗（橙光）
    x.fillStyle = '#ff9a2e';
    rrPath(x, r * 0.1, -r * 0.2, r * 0.5, r * 0.42, r * 0.08);
    x.fill();
    x.strokeStyle = 'rgba(60,30,10,.55)';
    x.lineWidth = Math.max(0.8, s * 0.035);
    x.stroke();
    // 窗内光晕
    const wg = x.createRadialGradient(r * 0.35, r * 0.01, 0, r * 0.35, r * 0.01, r * 0.2);
    wg.addColorStop(0, 'rgba(255,250,200,.95)');
    wg.addColorStop(1, 'rgba(255,180,60,0)');
    x.fillStyle = wg;
    x.beginPath(); x.arc(r * 0.35, r * 0.01, r * 0.2, 0, 7); x.fill();
    // 火花
    x.fillStyle = '#ffe08a';
    for (const [sx, sy, ss] of [[-r * 1.15, -r * 0.35, 0.06], [-r * 1.0, -r * 0.6, 0.05], [-r * 0.7, -r * 0.75, 0.045]]) {
      x.beginPath(); x.arc(sx, sy, r * ss, 0, 7); x.fill();
    }
    // 炉体铆钉
    x.fillStyle = 'rgba(255,235,200,.6)';
    for (const [px, py] of [[r * 0.6, r * 0.6], [r * 0.75, r * 0.3], [r * 0.45, r * 0.6]]) {
      x.beginPath(); x.arc(px, py, r * 0.05, 0, 7); x.fill();
    }
  },

  // ==================== 第 14 批：生物室 / 农业塔 / 虫巢孵化器 / 太空平台中枢 / 离心机 / 核反应堆 / 汽轮机 / 导热管 / 热交换器 / 供热塔 ====================

  // 生物室：绿色培养舱 + 培养皿中的生物样本 + 气泡
  'biochamber': (x, r, s, col) => {
    // 舱体
    const g = x.createLinearGradient(0, -r * 0.8, 0, r * 0.8);
    g.addColorStop(0, lightenColor(col, 0.3));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    rrPath(x, -r * 0.72, -r * 0.72, r * 1.44, r * 1.44, r * 0.22);
    x.fill();
    x.strokeStyle = 'rgba(10,30,18,.55)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 内框
    x.strokeStyle = 'rgba(255,255,255,.22)';
    x.lineWidth = Math.max(0.8, s * 0.028);
    rrPath(x, -r * 0.55, -r * 0.55, r * 1.1, r * 1.1, r * 0.14);
    x.stroke();
    // 培养皿（玻璃皿）
    x.fillStyle = 'rgba(220,245,225,.28)';
    x.beginPath(); x.ellipse(0, r * 0.22, r * 0.46, r * 0.18, 0, 0, 7); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.5)';
    x.lineWidth = Math.max(0.7, s * 0.026);
    x.stroke();
    // 培养液
    x.fillStyle = '#8fe0a0';
    x.beginPath(); x.ellipse(0, r * 0.2, r * 0.36, r * 0.13, 0, 0, 7); x.fill();
    // 生物样本（萌发的芽）
    x.strokeStyle = '#c8f0c0';
    x.lineCap = 'round';
    x.lineWidth = r * 0.09;
    x.beginPath();
    x.moveTo(0, r * 0.18); x.quadraticCurveTo(-r * 0.04, -r * 0.06, -r * 0.14, -r * 0.2);
    x.moveTo(0, r * 0.18); x.quadraticCurveTo(r * 0.06, -r * 0.02, r * 0.18, -r * 0.12);
    x.moveTo(0, r * 0.18); x.lineTo(r * 0.02, r * 0.04);
    x.stroke();
    // 气泡
    x.fillStyle = 'rgba(255,255,255,.65)';
    for (const [bx, by, br] of [[-r * 0.3, -r * 0.32, 0.07], [r * 0.22, -r * 0.44, 0.055], [r * 0.38, -r * 0.16, 0.04]]) {
      x.beginPath(); x.arc(bx, by, r * br, 0, 7); x.fill();
    }
    // 顶部舱盖铆钉
    x.fillStyle = 'rgba(230,250,235,.6)';
    for (const [px, py] of [[-r * 0.6, -r * 0.6], [r * 0.6, -r * 0.6]]) {
      x.beginPath(); x.arc(px, py, r * 0.06, 0, 7); x.fill();
    }
  },

  // 农业塔：棕褐塔身 + 顶部喷洒臂 + 下方嫩芽田垄
  'agricultural-tower': (x, r, s, col) => {
    // 田垄（底部绿色田地条纹）
    const fg = x.createLinearGradient(0, r * 0.3, 0, r * 0.85);
    fg.addColorStop(0, '#7cb85a');
    fg.addColorStop(1, '#4a7a36');
    x.fillStyle = fg;
    rrPath(x, -r * 0.85, r * 0.3, r * 1.7, r * 0.55, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(20,40,15,.5)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 垄沟
    x.strokeStyle = 'rgba(30,55,22,.55)';
    x.lineWidth = Math.max(0.8, s * 0.028);
    for (let i = 0; i < 3; i++) {
      const py = r * (0.42 + i * 0.13);
      x.beginPath(); x.moveTo(-r * 0.72, py); x.lineTo(r * 0.72, py); x.stroke();
    }
    // 塔身（支柱）
    x.fillStyle = col;
    x.fillRect(-r * 0.1, -r * 0.55, r * 0.2, r * 0.95);
    x.strokeStyle = 'rgba(35,25,8,.5)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.strokeRect(-r * 0.1, -r * 0.55, r * 0.2, r * 0.95);
    // 顶部横梁
    x.fillStyle = lightenColor(col, 0.2);
    rrPath(x, -r * 0.55, -r * 0.72, r * 1.1, r * 0.2, r * 0.08);
    x.fill();
    x.stroke();
    // 喷洒头（中央下垂）
    x.fillStyle = '#9aa4ad';
    x.beginPath(); x.moveTo(-r * 0.08, -r * 0.52); x.lineTo(r * 0.08, -r * 0.52); x.lineTo(r * 0.14, -r * 0.36); x.lineTo(-r * 0.14, -r * 0.36); x.closePath(); x.fill();
    // 水滴
    x.fillStyle = 'rgba(120,190,235,.9)';
    for (const [dx, dy] of [[-r * 0.26, -r * 0.12], [0, -r * 0.02], [r * 0.26, -r * 0.12]]) {
      x.beginPath();
      x.moveTo(dx, dy - r * 0.09);
      x.quadraticCurveTo(dx + r * 0.07, dy + r * 0.02, dx, dy + r * 0.09);
      x.quadraticCurveTo(dx - r * 0.07, dy + r * 0.02, dx, dy - r * 0.09);
      x.fill();
    }
    // 嫩芽
    x.strokeStyle = '#bfe890';
    x.lineCap = 'round';
    x.lineWidth = r * 0.07;
    for (const [sx, sh] of [[-r * 0.45, 0.16], [0, 0.2], [r * 0.45, 0.16]]) {
      x.beginPath();
      x.moveTo(sx, r * 0.34);
      x.quadraticCurveTo(sx - r * 0.08, r * (0.34 - sh * 0.6), sx, r * (0.34 - sh));
      x.stroke();
    }
  },

  // 虫巢孵化器：紫色虫巢半球 + 巢孔 + 圈养项圈指示
  'captive-biter-spawner': (x, r, s, col) => {
    // 巢体（半球穹顶）
    const g = x.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.1, 0, 0, r * 0.85);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(0.6, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(-r * 0.8, r * 0.5);
    x.quadraticCurveTo(-r * 0.85, -r * 0.55, 0, -r * 0.62);
    x.quadraticCurveTo(r * 0.85, -r * 0.55, r * 0.8, r * 0.5);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(30,10,40,.55)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 巢孔（三孔，发光）
    for (const [hx, hy, hr] of [[-r * 0.32, r * 0.02, 0.13], [r * 0.26, -r * 0.16, 0.11], [r * 0.05, r * 0.28, 0.1]]) {
      x.fillStyle = '#2a1030';
      x.beginPath(); x.ellipse(hx, hy, r * hr, r * hr * 0.75, 0, 0, 7); x.fill();
      x.fillStyle = 'rgba(220,120,255,.55)';
      x.beginPath(); x.ellipse(hx, hy + r * 0.02, r * hr * 0.55, r * hr * 0.4, 0, 0, 7); x.fill();
    }
    // 圈养项圈（底部金属环，示意被驯化圈养）
    x.strokeStyle = '#c8b040';
    x.lineWidth = r * 0.1;
    x.beginPath(); x.moveTo(-r * 0.62, r * 0.5); x.lineTo(r * 0.62, r * 0.5); x.stroke();
    x.strokeStyle = 'rgba(255,240,170,.7)';
    x.lineWidth = r * 0.035;
    x.beginPath(); x.moveTo(-r * 0.62, r * 0.46); x.lineTo(r * 0.62, r * 0.46); x.stroke();
    // 巢体斑点
    x.fillStyle = 'rgba(255,255,255,.16)';
    for (const [px, py, pr] of [[-r * 0.42, -r * 0.3, 0.08], [r * 0.36, -r * 0.34, 0.06], [r * 0.5, r * 0.08, 0.05]]) {
      x.beginPath(); x.arc(px, py, r * pr, 0, 7); x.fill();
    }
  },

  // 太空平台中枢：深蓝航天枢纽 + 中央舱体 + 对接环 + 星点
  'space-platform-hub': (x, r, s, col) => {
    // 底盘
    x.fillStyle = darkenColor(col, 0.35);
    rrPath(x, -r * 0.85, r * 0.3, r * 1.7, r * 0.4, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(5,10,25,.6)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 中央主舱
    const g = x.createLinearGradient(0, -r * 0.7, 0, r * 0.4);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    rrPath(x, -r * 0.5, -r * 0.7, r * 1.0, r * 1.05, r * 0.16);
    x.fill();
    x.stroke();
    // 舷窗（发光）
    x.fillStyle = '#8fd8ff';
    for (const wy of [-r * 0.42, -r * 0.14, r * 0.14]) {
      x.beginPath(); x.arc(0, wy, r * 0.1, 0, 7); x.fill();
    }
    // 对接环（顶部）
    x.strokeStyle = '#b8c4d8';
    x.lineWidth = r * 0.1;
    x.beginPath(); x.ellipse(0, -r * 0.66, r * 0.3, r * 0.11, 0, 0, 7); x.stroke();
    // 侧翼太阳能板
    x.fillStyle = '#2a4a80';
    x.fillRect(-r * 0.92, -r * 0.32, r * 0.36, r * 0.5);
    x.fillRect(r * 0.56, -r * 0.32, r * 0.36, r * 0.5);
    x.strokeStyle = 'rgba(140,200,255,.6)';
    x.lineWidth = Math.max(0.6, s * 0.024);
    for (const side of [-1, 1]) {
      for (let i = 0; i <= 2; i++) {
        const px = side === -1 ? -r * 0.92 + i * r * 0.12 : r * 0.56 + i * r * 0.12;
        x.beginPath(); x.moveTo(px, -r * 0.32); x.lineTo(px, r * 0.18); x.stroke();
      }
    }
    // 星点
    x.fillStyle = 'rgba(255,255,255,.9)';
    for (const [sx, sy, ss] of [[-r * 0.75, -r * 0.72, 0.05], [r * 0.7, -r * 0.6, 0.04], [r * 0.85, r * 0.05, 0.045]]) {
      x.beginPath(); x.arc(sx, sy, r * ss, 0, 7); x.fill();
    }
  },

  // 离心机：钢灰机身 + 旋转离心管束 + 绿色铀料辉光
  'centrifuge': (x, r, s, col) => {
    // 机身
    const g = x.createLinearGradient(0, -r * 0.8, 0, r * 0.8);
    g.addColorStop(0, lightenColor(col, 0.3));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    rrPath(x, -r * 0.68, -r * 0.72, r * 1.36, r * 1.44, r * 0.2);
    x.fill();
    x.strokeStyle = 'rgba(15,25,32,.55)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 顶部旋转指示（弧形箭头）
    x.strokeStyle = 'rgba(255,255,255,.85)';
    x.lineCap = 'round';
    x.lineWidth = r * 0.1;
    x.beginPath(); x.arc(0, -r * 0.02, r * 0.42, Math.PI * 0.6, Math.PI * 1.75); x.stroke();
    // 箭头头部
    x.fillStyle = 'rgba(255,255,255,.85)';
    x.beginPath();
    x.moveTo(r * 0.4, -r * 0.42);
    x.lineTo(r * 0.6, -r * 0.2);
    x.lineTo(r * 0.3, -r * 0.16);
    x.closePath();
    x.fill();
    // 离心管束（三根倾斜试管，绿色铀料）
    for (let i = 0; i < 3; i++) {
      const tx = -r * 0.3 + i * r * 0.3;
      x.save();
      x.translate(tx, r * 0.22);
      x.rotate((i - 1) * 0.22);
      // 管壁
      x.fillStyle = 'rgba(200,220,230,.35)';
      rrPath(x, -r * 0.07, -r * 0.3, r * 0.14, r * 0.5, r * 0.06);
      x.fill();
      x.strokeStyle = 'rgba(230,240,245,.7)';
      x.lineWidth = Math.max(0.6, s * 0.022);
      x.stroke();
      // 铀料（绿光）
      const ug = x.createLinearGradient(0, -r * 0.1, 0, r * 0.18);
      ug.addColorStop(0, '#c8ff70');
      ug.addColorStop(1, '#5aa028');
      x.fillStyle = ug;
      rrPath(x, -r * 0.05, -r * 0.1, r * 0.1, r * 0.26, r * 0.04);
      x.fill();
      x.restore();
    }
    // 底座铆钉
    x.fillStyle = 'rgba(220,230,235,.6)';
    for (const [px, py] of [[-r * 0.55, r * 0.62], [r * 0.55, r * 0.62]]) {
      x.beginPath(); x.arc(px, py, r * 0.06, 0, 7); x.fill();
    }
  },

  // 核反应堆：深绿反应堆体 + 放射警示三叶标 + 热量橙光
  'nuclear-reactor': (x, r, s, col) => {
    // 堆体
    const g = x.createLinearGradient(0, -r * 0.8, 0, r * 0.8);
    g.addColorStop(0, lightenColor(col, 0.3));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    rrPath(x, -r * 0.75, -r * 0.75, r * 1.5, r * 1.5, r * 0.18);
    x.fill();
    x.strokeStyle = 'rgba(8,30,15,.6)';
    x.lineWidth = Math.max(1, s * 0.05);
    x.stroke();
    // 内框
    x.strokeStyle = 'rgba(255,255,255,.2)';
    x.lineWidth = Math.max(0.8, s * 0.028);
    rrPath(x, -r * 0.58, -r * 0.58, r * 1.16, r * 1.16, r * 0.12);
    x.stroke();
    // 放射三叶标
    const cy = -r * 0.02;
    x.fillStyle = '#f5e13a';
    for (let i = 0; i < 3; i++) {
      const a0 = -Math.PI / 2 + i * (Math.PI * 2 / 3) - 0.42;
      const a1 = a0 + 0.84;
      x.beginPath();
      x.arc(0, cy, r * 0.4, a0, a1);
      x.arc(0, cy, r * 0.16, a1, a0, true);
      x.closePath();
      x.fill();
    }
    // 中心圆
    x.fillStyle = '#f5e13a';
    x.beginPath(); x.arc(0, cy, r * 0.1, 0, 7); x.fill();
    x.strokeStyle = 'rgba(40,35,5,.7)';
    x.lineWidth = Math.max(0.7, s * 0.026);
    x.beginPath(); x.arc(0, cy, r * 0.1, 0, 7); x.stroke();
    // 底部热量橙光条
    const hg = x.createLinearGradient(0, r * 0.4, 0, r * 0.68);
    hg.addColorStop(0, 'rgba(255,150,50,.15)');
    hg.addColorStop(1, 'rgba(255,140,40,.75)');
    x.fillStyle = hg;
    x.fillRect(-r * 0.58, r * 0.4, r * 1.16, r * 0.28);
  },

  // 汽轮机：蓝灰涡轮机身 + 叶轮 + 蒸汽流线
  'steam-turbine': (x, r, s, col) => {
    // 机身
    const g = x.createLinearGradient(0, -r * 0.7, 0, r * 0.7);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    rrPath(x, -r * 0.8, -r * 0.55, r * 1.6, r * 1.1, r * 0.2);
    x.fill();
    x.strokeStyle = 'rgba(15,30,40,.55)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 检修分缝
    x.strokeStyle = 'rgba(15,30,40,.4)';
    x.lineWidth = Math.max(0.7, s * 0.026);
    x.beginPath(); x.moveTo(-r * 0.1, -r * 0.55); x.lineTo(-r * 0.1, r * 0.55); x.stroke();
    // 叶轮（右侧圆形，辐条旋转）
    x.fillStyle = darkenColor(col, 0.3);
    x.beginPath(); x.arc(r * 0.38, 0, r * 0.34, 0, 7); x.fill();
    x.strokeStyle = 'rgba(220,235,245,.8)';
    x.lineWidth = r * 0.07;
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + 0.4;
      x.beginPath();
      x.moveTo(r * 0.38 - Math.cos(a) * r * 0.26, -Math.sin(a) * r * 0.26);
      x.lineTo(r * 0.38 + Math.cos(a) * r * 0.26, Math.sin(a) * r * 0.26);
      x.stroke();
    }
    x.beginPath(); x.arc(r * 0.38, 0, r * 0.34, 0, 7); x.stroke();
    // 蒸汽流线（左侧三道白色波纹）
    x.strokeStyle = 'rgba(255,255,255,.75)';
    x.lineWidth = r * 0.07;
    for (let i = 0; i < 3; i++) {
      const ly = -r * 0.24 + i * r * 0.24;
      x.beginPath();
      x.moveTo(-r * 0.72, ly);
      x.quadraticCurveTo(-r * 0.55, ly - r * 0.12, -r * 0.4, ly);
      x.quadraticCurveTo(-r * 0.28, ly + r * 0.08, -r * 0.16, ly - r * 0.02);
      x.stroke();
    }
    // 底座
    x.fillStyle = darkenColor(col, 0.45);
    x.fillRect(-r * 0.65, r * 0.55, r * 1.3, r * 0.2);
    x.strokeRect(-r * 0.65, r * 0.55, r * 1.3, r * 0.2);
  },

  // 导热管：橙色金属管段 + 高温红热段 + 热浪波纹
  'heat-pipe': (x, r, s, col) => {
    // 管体（斜置粗管）
    x.save();
    x.rotate(-0.6);
    const g = x.createLinearGradient(0, -r * 0.2, 0, r * 0.2);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(0.5, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    rrPath(x, -r * 0.95, -r * 0.2, r * 1.9, r * 0.4, r * 0.14);
    x.fill();
    x.strokeStyle = 'rgba(60,30,5,.55)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 法兰接口（两端）
    x.fillStyle = lightenColor(col, 0.15);
    x.fillRect(-r * 0.98, -r * 0.28, r * 0.14, r * 0.56);
    x.fillRect(r * 0.84, -r * 0.28, r * 0.14, r * 0.56);
    x.strokeRect(-r * 0.98, -r * 0.28, r * 0.14, r * 0.56);
    x.strokeRect(r * 0.84, -r * 0.28, r * 0.14, r * 0.56);
    // 红热段（中部高温发光）
    const hg = x.createLinearGradient(-r * 0.3, 0, r * 0.3, 0);
    hg.addColorStop(0, 'rgba(255,120,40,0)');
    hg.addColorStop(0.5, 'rgba(255,130,45,.85)');
    hg.addColorStop(1, 'rgba(255,120,40,0)');
    x.fillStyle = hg;
    x.fillRect(-r * 0.3, -r * 0.2, r * 0.6, r * 0.4);
    // 管身高光
    x.strokeStyle = 'rgba(255,230,190,.5)';
    x.lineWidth = r * 0.05;
    x.beginPath(); x.moveTo(-r * 0.8, -r * 0.1); x.lineTo(r * 0.8, -r * 0.1); x.stroke();
    x.restore();
    // 热浪波纹（右上）
    x.strokeStyle = 'rgba(255,170,80,.85)';
    x.lineCap = 'round';
    x.lineWidth = Math.max(0.8, s * 0.035);
    for (let i = 0; i < 3; i++) {
      const wy = -r * (0.95 - i * 0.18);
      x.beginPath();
      x.moveTo(-r * 0.15 + i * r * 0.18, wy + r * 0.12);
      x.quadraticCurveTo(-r * 0.05 + i * r * 0.18, wy, r * 0.05 + i * r * 0.18, wy + r * 0.12);
      x.stroke();
    }
  },

  // 热交换器：铜褐箱体 + 火焰热源 + 水/汽双接口
  'heat-exchanger': (x, r, s, col) => {
    // 箱体
    const g = x.createLinearGradient(0, -r * 0.75, 0, r * 0.75);
    g.addColorStop(0, lightenColor(col, 0.3));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    rrPath(x, -r * 0.7, -r * 0.7, r * 1.4, r * 1.35, r * 0.18);
    x.fill();
    x.strokeStyle = 'rgba(40,20,10,.6)';
    x.lineWidth = Math.max(1, s * 0.05);
    x.stroke();
    // 换热管束（横向三管）
    x.strokeStyle = 'rgba(255,205,150,.55)';
    x.lineWidth = r * 0.09;
    for (let i = 0; i < 3; i++) {
      const py = -r * 0.42 + i * r * 0.28;
      x.beginPath(); x.moveTo(-r * 0.5, py); x.lineTo(r * 0.5, py); x.stroke();
    }
    // 火焰热源（底部）
    x.fillStyle = '#e8703a';
    x.beginPath();
    x.moveTo(0, r * 0.88);
    x.quadraticCurveTo(-r * 0.3, r * 0.6, 0, r * 0.34);
    x.quadraticCurveTo(r * 0.3, r * 0.6, 0, r * 0.88);
    x.fill();
    x.fillStyle = '#f8c83a';
    x.beginPath();
    x.moveTo(0, r * 0.8);
    x.quadraticCurveTo(-r * 0.14, r * 0.62, 0, r * 0.48);
    x.quadraticCurveTo(r * 0.14, r * 0.62, 0, r * 0.8);
    x.fill();
    // 蒸汽出口（顶部白色汽泡）
    x.fillStyle = 'rgba(240,248,255,.85)';
    for (const [vx, vy, vr] of [[-r * 0.2, -r * 0.82, 0.08], [r * 0.05, -r * 0.92, 0.1], [r * 0.3, -r * 0.8, 0.07]]) {
      x.beginPath(); x.arc(vx, vy, r * vr, 0, 7); x.fill();
    }
    // 水滴接口（左上蓝色）
    x.fillStyle = 'rgba(110,180,235,.9)';
    x.beginPath();
    x.moveTo(-r * 0.52, -r * 0.62);
    x.quadraticCurveTo(-r * 0.62, -r * 0.48, -r * 0.52, -r * 0.4);
    x.quadraticCurveTo(-r * 0.42, -r * 0.48, -r * 0.52, -r * 0.62);
    x.fill();
  },

  // 供热塔：橙塔身 + 炉膛火光 + 顶部热量扩散波
  'heating-tower': (x, r, s, col) => {
    // 塔身
    const g = x.createLinearGradient(0, -r * 0.8, 0, r * 0.8);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(-r * 0.52, -r * 0.75);
    x.lineTo(r * 0.52, -r * 0.75);
    x.lineTo(r * 0.68, r * 0.75);
    x.lineTo(-r * 0.68, r * 0.75);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(55,25,5,.6)';
    x.lineWidth = Math.max(1, s * 0.05);
    x.stroke();
    // 塔顶平台
    x.fillStyle = lightenColor(col, 0.2);
    x.fillRect(-r * 0.62, -r * 0.85, r * 1.24, r * 0.16);
    x.strokeRect(-r * 0.62, -r * 0.85, r * 1.24, r * 0.16);
    // 炉膛口（发光）
    x.fillStyle = '#3a1c08';
    rrPath(x, -r * 0.3, r * 0.05, r * 0.6, r * 0.55, r * 0.12);
    x.fill();
    const fg = x.createRadialGradient(0, r * 0.35, r * 0.03, 0, r * 0.35, r * 0.26);
    fg.addColorStop(0, '#ffe89a');
    fg.addColorStop(0.5, '#ff9a3a');
    fg.addColorStop(1, 'rgba(230,90,30,0)');
    x.fillStyle = fg;
    x.beginPath(); x.arc(0, r * 0.35, r * 0.26, 0, 7); x.fill();
    // 通风栅缝
    x.strokeStyle = 'rgba(55,25,5,.55)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    for (let i = 0; i < 3; i++) {
      const py = -r * (0.5 - i * 0.16);
      x.beginPath(); x.moveTo(-r * 0.32, py); x.lineTo(r * 0.32, py); x.stroke();
    }
    // 顶部热量波（上升弧线）
    x.strokeStyle = 'rgba(255,170,70,.85)';
    x.lineCap = 'round';
    x.lineWidth = Math.max(0.8, s * 0.035);
    for (let i = 0; i < 3; i++) {
      const wx = -r * 0.3 + i * r * 0.3;
      x.beginPath();
      x.moveTo(wx, -r * 0.95);
      x.quadraticCurveTo(wx + r * 0.12, -r * 1.1, wx, -r * 1.22);
      x.stroke();
    }
  },

  // 聚变反应堆：青铜机身 + 等离子橙红核心 + 氟酮冷却蓝管
  'fusion-reactor': (x, r, s, col) => {
    // 机身
    const g = x.createLinearGradient(0, -r * 0.8, 0, r * 0.8);
    g.addColorStop(0, lightenColor(col, 0.3));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    rrPath(x, -r * 0.8, -r * 0.75, r * 1.6, r * 1.5, r * 0.2);
    x.fill();
    x.strokeStyle = 'rgba(35,20,5,.6)';
    x.lineWidth = Math.max(1, s * 0.05);
    x.stroke();
    // 铆钉
    x.fillStyle = 'rgba(240,230,210,.55)';
    for (const [px, py] of [[-0.66, -0.62], [0.66, -0.62], [-0.66, 0.62], [0.66, 0.62]]) {
      x.beginPath(); x.arc(px * r, py * r, r * 0.055, 0, 7); x.fill();
    }
    // 等离子核心（外辉光 + 内亮核）
    const glow = x.createRadialGradient(0, 0, r * 0.05, 0, 0, r * 0.5);
    glow.addColorStop(0, 'rgba(255,230,170,.95)');
    glow.addColorStop(0.45, 'rgba(255,140,60,.55)');
    glow.addColorStop(1, 'rgba(255,120,50,0)');
    x.fillStyle = glow;
    x.beginPath(); x.arc(0, 0, r * 0.5, 0, 7); x.fill();
    const core = x.createRadialGradient(-r * 0.06, -r * 0.06, r * 0.03, 0, 0, r * 0.3);
    core.addColorStop(0, '#fff6d8');
    core.addColorStop(0.6, '#ffb14a');
    core.addColorStop(1, '#e2622a');
    x.fillStyle = core;
    x.beginPath(); x.arc(0, 0, r * 0.3, 0, 7); x.fill();
    x.strokeStyle = 'rgba(120,45,10,.65)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.beginPath(); x.arc(0, 0, r * 0.3, 0, 7); x.stroke();
    // 两侧氟酮冷却管（蓝色 U 形）
    x.strokeStyle = '#5ab8e8';
    x.lineCap = 'round';
    x.lineWidth = Math.max(1.2, s * 0.07);
    for (const sd of [-1, 1]) {
      x.beginPath();
      x.moveTo(sd * r * 0.72, -r * 0.55);
      x.lineTo(sd * r * 0.72, -r * 0.15);
      x.stroke();
    }
    // 环形加速腔（半透明环）
    x.strokeStyle = 'rgba(255,255,255,.35)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.beginPath(); x.arc(0, 0, r * 0.44, 0.6, 2.6); x.stroke();
    x.beginPath(); x.arc(0, 0, r * 0.44, 3.74, 5.74); x.stroke();
  },

  // 聚变发电机：蓝色机身 + 涡轮叶轮 + 等离子导入弧光 + 电极火花
  'fusion-generator': (x, r, s, col) => {
    // 机身
    const g = x.createLinearGradient(0, -r * 0.8, 0, r * 0.8);
    g.addColorStop(0, lightenColor(col, 0.32));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    rrPath(x, -r * 0.78, -r * 0.7, r * 1.56, r * 1.4, r * 0.18);
    x.fill();
    x.strokeStyle = 'rgba(8,30,45,.6)';
    x.lineWidth = Math.max(1, s * 0.05);
    x.stroke();
    // 顶部热量导入口（橙光口）
    const hp = x.createLinearGradient(0, -r * 0.7, 0, -r * 0.3);
    hp.addColorStop(0, 'rgba(255,170,80,.9)');
    hp.addColorStop(1, 'rgba(255,120,40,.15)');
    x.fillStyle = hp;
    rrPath(x, -r * 0.5, -r * 0.68, r * 1.0, r * 0.36, r * 0.1);
    x.fill();
    // 涡轮叶轮（四叶螺旋）
    x.save();
    x.translate(0, r * 0.12);
    x.fillStyle = 'rgba(235,245,255,.9)';
    for (let i = 0; i < 4; i++) {
      x.rotate(Math.PI / 2);
      x.beginPath();
      x.moveTo(0, 0);
      x.quadraticCurveTo(r * 0.3, -r * 0.12, r * 0.42, -r * 0.02);
      x.quadraticCurveTo(r * 0.28, r * 0.1, 0, r * 0.06);
      x.closePath();
      x.fill();
    }
    x.fillStyle = '#c8d8e8';
    x.beginPath(); x.arc(0, 0, r * 0.1, 0, 7); x.fill();
    x.strokeStyle = 'rgba(15,40,60,.7)';
    x.lineWidth = Math.max(0.7, s * 0.026);
    x.beginPath(); x.arc(0, 0, r * 0.1, 0, 7); x.stroke();
    x.restore();
    // 闪电火花（左右放电）
    x.strokeStyle = '#ffe866';
    x.lineCap = 'round';
    x.lineWidth = Math.max(0.8, s * 0.035);
    for (const sd of [-1, 1]) {
      x.beginPath();
      x.moveTo(sd * r * 0.62, r * 0.1);
      x.lineTo(sd * r * 0.46, r * 0.28);
      x.lineTo(sd * r * 0.56, r * 0.42);
      x.stroke();
    }
  },

  // 避雷针：细长针杆 + 顶部圆珠 + 云层闪电
  'lightning-rod': (x, r, s, col) => {
    // 地座
    const bg = x.createLinearGradient(0, r * 0.5, 0, r * 0.85);
    bg.addColorStop(0, lightenColor('#8a8f96', 0.15));
    bg.addColorStop(1, darkenColor('#8a8f96', 0.35));
    x.fillStyle = bg;
    rrPath(x, -r * 0.42, r * 0.55, r * 0.84, r * 0.3, r * 0.07);
    x.fill();
    x.strokeStyle = 'rgba(25,30,35,.6)';
    x.lineWidth = Math.max(0.8, s * 0.035);
    x.stroke();
    // 针杆（下粗上细）
    const pg = x.createLinearGradient(-r * 0.12, 0, r * 0.12, 0);
    pg.addColorStop(0, lightenColor(col, 0.35));
    pg.addColorStop(0.5, '#d8d8d0');
    pg.addColorStop(1, darkenColor('#9a9a90', 0.2));
    x.fillStyle = pg;
    x.beginPath();
    x.moveTo(-r * 0.14, r * 0.58);
    x.lineTo(-r * 0.05, -r * 0.6);
    x.lineTo(r * 0.05, -r * 0.6);
    x.lineTo(r * 0.14, r * 0.58);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(60,60,40,.55)';
    x.lineWidth = Math.max(0.6, s * 0.028);
    x.stroke();
    // 顶部圆珠（接闪端）
    const bg2 = x.createRadialGradient(-r * 0.04, -r * 0.78, r * 0.02, 0, -r * 0.72, r * 0.18);
    bg2.addColorStop(0, '#fffbe0');
    bg2.addColorStop(0.6, lightenColor(col, 0.3));
    bg2.addColorStop(1, darkenColor(col, 0.3));
    x.fillStyle = bg2;
    x.beginPath(); x.arc(0, -r * 0.72, r * 0.16, 0, 7); x.fill();
    x.strokeStyle = 'rgba(80,70,10,.6)';
    x.lineWidth = Math.max(0.7, s * 0.03);
    x.stroke();
    // 左上闪电（Z 形折线）
    x.strokeStyle = '#fff8c8';
    x.lineCap = 'round';
    x.lineJoin = 'round';
    x.lineWidth = Math.max(1, s * 0.05);
    x.beginPath();
    x.moveTo(-r * 0.62, -r * 0.95);
    x.lineTo(-r * 0.38, -r * 0.62);
    x.lineTo(-r * 0.2, -r * 0.72);
    x.lineTo(-r * 0.04, -r * 0.5);
    x.stroke();
  },

  // 避雷收集器：方形基座 + 双侧集流板 + 环形电弧 + 能量格
  'lightning-collector': (x, r, s, col) => {
    // 基座
    const g = x.createLinearGradient(0, -r * 0.8, 0, r * 0.8);
    g.addColorStop(0, lightenColor(col, 0.28));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    rrPath(x, -r * 0.72, -r * 0.75, r * 1.44, r * 1.5, r * 0.14);
    x.fill();
    x.strokeStyle = 'rgba(60,55,10,.6)';
    x.lineWidth = Math.max(1, s * 0.05);
    x.stroke();
    // 顶针
    x.fillStyle = '#f0eec8';
    x.beginPath();
    x.moveTo(-r * 0.06, -r * 0.75);
    x.lineTo(0, -r * 1.0);
    x.lineTo(r * 0.06, -r * 0.75);
    x.closePath();
    x.fill();
    // 闪电落点
    x.strokeStyle = '#fff8c8';
    x.lineCap = 'round';
    x.lineJoin = 'round';
    x.lineWidth = Math.max(1, s * 0.055);
    x.beginPath();
    x.moveTo(-r * 0.4, -r * 1.0);
    x.lineTo(-r * 0.18, -r * 0.72);
    x.lineTo(-r * 0.06, -r * 0.82);
    x.lineTo(0, -r * 0.66);
    x.stroke();
    // 集流板（左右竖条）
    x.fillStyle = 'rgba(255,250,200,.4)';
    x.fillRect(-r * 0.5, -r * 0.4, r * 0.14, r * 0.9);
    x.fillRect(r * 0.36, -r * 0.4, r * 0.14, r * 0.9);
    x.strokeStyle = 'rgba(70,65,15,.5)';
    x.lineWidth = Math.max(0.6, s * 0.026);
    x.strokeRect(-r * 0.5, -r * 0.4, r * 0.14, r * 0.9);
    x.strokeRect(r * 0.36, -r * 0.4, r * 0.14, r * 0.9);
    // 中央能量格（蓄电格，自下而上点亮）
    const cells = [
      { y: 0.28, on: true }, { y: 0.02, on: true }, { y: -0.24, on: true }, { y: -0.5, on: true },
    ];
    for (const c of cells) {
      x.fillStyle = c.on ? '#f8f0a0' : 'rgba(255,255,255,.15)';
      rrPath(x, -r * 0.24, c.y * r - r * 0.09, r * 0.48, r * 0.18, r * 0.05);
      x.fill();
    }
  },

  // 修理包：扳手 + 齿轮交叉工具组合
  'repair-pack': (x, r, s, col) => {
    // 背景圆盘
    const bg = x.createRadialGradient(-r * 0.2, -r * 0.2, r * 0.1, 0, 0, r * 0.9);
    bg.addColorStop(0, lightenColor(col, 0.35));
    bg.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = bg;
    x.beginPath(); x.arc(0, 0, r * 0.85, 0, 7); x.fill();
    x.strokeStyle = 'rgba(10,30,50,.6)';
    x.lineWidth = Math.max(1, s * 0.05);
    x.stroke();
    // 背景小齿轮
    x.fillStyle = 'rgba(235,240,250,.55)';
    const tR = r * 0.3, tC = r * 0.38;
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      x.save();
      x.translate(tC * 0.9, -tC * 0.9);
      x.rotate(a);
      x.fillRect(-tR * 0.12, -tR * 1.28, tR * 0.24, tR * 0.4);
      x.restore();
    }
    x.beginPath(); x.arc(tC * 0.9, -tC * 0.9, tR * 0.95, 0, 7); x.fill();
    x.fillStyle = 'rgba(60,80,100,.9)';
    x.beginPath(); x.arc(tC * 0.9, -tC * 0.9, tR * 0.4, 0, 7); x.fill();
    // 主扳手（斜 45°）
    x.save();
    x.rotate(-Math.PI / 4);
    x.fillStyle = '#d8dde4';
    // 扳手杆
    rrPath(x, -r * 0.09, -r * 0.55, r * 0.18, r * 1.15, r * 0.06);
    x.fill();
    x.strokeStyle = 'rgba(40,45,55,.6)';
    x.lineWidth = Math.max(0.7, s * 0.028);
    x.stroke();
    // 开口头（C 形缺口）
    x.beginPath();
    x.arc(0, -r * 0.58, r * 0.22, 0.55, Math.PI * 2 - 0.55);
    x.arc(0, -r * 0.58, r * 0.1, Math.PI * 2 - 0.55, 0.55, true);
    x.closePath();
    x.fillStyle = '#d8dde4';
    x.fill();
    x.stroke();
    x.restore();
    // 高光
    x.fillStyle = 'rgba(255,255,255,.25)';
    x.beginPath(); x.arc(-r * 0.35, -r * 0.35, r * 0.22, 0, 7); x.fill();
  },

  // 拆除规划器：红色平板 + 白色 X 标记 + 边角标记点
  'deconstruction-planner': (x, r, s, col) => {
    // 平板（微透视的规划板）
    const g = x.createLinearGradient(-r * 0.7, -r * 0.7, r * 0.7, r * 0.7);
    g.addColorStop(0, lightenColor(col, 0.3));
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    rrPath(x, -r * 0.72, -r * 0.72, r * 1.44, r * 1.44, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(60,10,10,.65)';
    x.lineWidth = Math.max(1, s * 0.05);
    x.stroke();
    // 内框（虚线选择框）
    x.strokeStyle = 'rgba(255,255,255,.75)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.setLineDash([r * 0.14, r * 0.1]);
    x.strokeRect(-r * 0.5, -r * 0.5, r * 1.0, r * 1.0);
    x.setLineDash([]);
    // 四角实心点（框选锚点）
    x.fillStyle = '#fff';
    for (const [px, py] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
      x.beginPath(); x.arc(px * r, py * r, r * 0.07, 0, 7); x.fill();
    }
    // 白色 X（拆除标记）
    x.strokeStyle = '#fff';
    x.lineCap = 'round';
    x.lineWidth = Math.max(1.4, s * 0.09);
    x.beginPath();
    x.moveTo(-r * 0.3, -r * 0.3);
    x.lineTo(r * 0.3, r * 0.3);
    x.moveTo(r * 0.3, -r * 0.3);
    x.lineTo(-r * 0.3, r * 0.3);
    x.stroke();
    // X 描边阴影
    x.strokeStyle = 'rgba(90,10,10,.6)';
    x.lineWidth = Math.max(1.4, s * 0.09) + Math.max(0.8, s * 0.03);
    x.beginPath();
    x.moveTo(-r * 0.3, -r * 0.3);
    x.lineTo(r * 0.3, r * 0.3);
    x.moveTo(r * 0.3, -r * 0.3);
    x.lineTo(-r * 0.3, r * 0.3);
    x.stroke();
    x.strokeStyle = '#fff';
    x.lineWidth = Math.max(1.4, s * 0.09);
    x.beginPath();
    x.moveTo(-r * 0.3, -r * 0.3);
    x.lineTo(r * 0.3, r * 0.3);
    x.moveTo(r * 0.3, -r * 0.3);
    x.lineTo(-r * 0.3, r * 0.3);
    x.stroke();
  },

  // 升级规划器：绿色平板 + 白色上行箭头 + 虚线框 + 小齿轮
  'upgrade-planner': (x, r, s, col) => {
    // 平板
    const g = x.createLinearGradient(-r * 0.7, -r * 0.7, r * 0.7, r * 0.7);
    g.addColorStop(0, lightenColor(col, 0.32));
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    rrPath(x, -r * 0.72, -r * 0.72, r * 1.44, r * 1.44, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(10,50,15,.65)';
    x.lineWidth = Math.max(1, s * 0.05);
    x.stroke();
    // 内虚线框
    x.strokeStyle = 'rgba(255,255,255,.7)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.setLineDash([r * 0.14, r * 0.1]);
    x.strokeRect(-r * 0.5, -r * 0.5, r * 1.0, r * 1.0);
    x.setLineDash([]);
    // 四角锚点
    x.fillStyle = '#fff';
    for (const [px, py] of [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]]) {
      x.beginPath(); x.arc(px * r, py * r, r * 0.07, 0, 7); x.fill();
    }
    // 白色上行箭头（升级）
    x.fillStyle = '#fff';
    x.beginPath();
    x.moveTo(0, -r * 0.42);
    x.lineTo(r * 0.28, -r * 0.08);
    x.lineTo(r * 0.12, -r * 0.08);
    x.lineTo(r * 0.12, r * 0.34);
    x.lineTo(-r * 0.12, r * 0.34);
    x.lineTo(-r * 0.12, -r * 0.08);
    x.lineTo(-r * 0.28, -r * 0.08);
    x.closePath();
    x.fill();
    // 底部小齿轮（升级后的机械感）
    x.fillStyle = 'rgba(255,255,255,.55)';
    const gR = r * 0.16, gx = r * 0.4, gy = r * 0.4;
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3;
      x.save();
      x.translate(gx, gy);
      x.rotate(a);
      x.fillRect(-gR * 0.14, -gR * 1.3, gR * 0.28, gR * 0.42);
      x.restore();
    }
    x.beginPath(); x.arc(gx, gy, gR, 0, 7); x.fill();
  },

  // 低温工厂：冰蓝机身 + 雪花晶格 + 冷气霜纹
  'cryogenic-plant': (x, r, s, col) => {
    // 机身
    const g = x.createLinearGradient(0, -r * 0.8, 0, r * 0.8);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    rrPath(x, -r * 0.75, -r * 0.75, r * 1.5, r * 1.5, r * 0.18);
    x.fill();
    x.strokeStyle = 'rgba(10,40,60,.6)';
    x.lineWidth = Math.max(1, s * 0.05);
    x.stroke();
    // 顶部冷气管口
    x.fillStyle = lightenColor(col, 0.4);
    rrPath(x, -r * 0.2, -r * 0.95, r * 0.4, r * 0.25, r * 0.06);
    x.fill();
    x.strokeStyle = 'rgba(10,40,60,.5)';
    x.lineWidth = Math.max(0.7, s * 0.028);
    x.stroke();
    // 中央雪花（六向枝晶）
    x.save();
    x.translate(0, r * 0.02);
    x.strokeStyle = 'rgba(240,252,255,.95)';
    x.lineCap = 'round';
    x.lineWidth = Math.max(1, s * 0.05);
    for (let i = 0; i < 6; i++) {
      x.save();
      x.rotate(i * Math.PI / 3);
      x.beginPath();
      x.moveTo(0, 0);
      x.lineTo(0, -r * 0.48);
      // 侧枝
      x.moveTo(0, -r * 0.28);
      x.lineTo(-r * 0.14, -r * 0.4);
      x.moveTo(0, -r * 0.28);
      x.lineTo(r * 0.14, -r * 0.4);
      x.stroke();
      x.restore();
    }
    // 雪花中心
    x.fillStyle = '#eafaff';
    x.beginPath(); x.arc(0, 0, r * 0.09, 0, 7); x.fill();
    x.restore();
    // 四角霜纹（小冰晶点）
    x.fillStyle = 'rgba(220,245,255,.5)';
    for (const [px, py] of [[-0.58, -0.58], [0.58, -0.58], [-0.58, 0.58], [0.58, 0.58]]) {
      x.beginPath(); x.arc(px * r, py * r, r * 0.05, 0, 7); x.fill();
    }
    // 底部冷雾
    const fg = x.createLinearGradient(0, r * 0.45, 0, r * 0.75);
    fg.addColorStop(0, 'rgba(200,240,255,.55)');
    fg.addColorStop(1, 'rgba(200,240,255,0)');
    x.fillStyle = fg;
    x.fillRect(-r * 0.6, r * 0.45, r * 1.2, r * 0.3);
  },

  // 铁矿石：深灰蓝色矿石块，棱角晶体 + 高光切面
  'iron-ore': (x, r, s, col) => {
    // 主体矿石（不规则六边岩块）
    const g = x.createLinearGradient(-r * 0.5, -r * 0.6, r * 0.5, r * 0.7);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(0.5, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(-r * 0.55, -r * 0.2);
    x.lineTo(-r * 0.25, -r * 0.6);
    x.lineTo(r * 0.3, -r * 0.55);
    x.lineTo(r * 0.6, -r * 0.1);
    x.lineTo(r * 0.4, r * 0.5);
    x.lineTo(-r * 0.3, r * 0.58);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(15,20,30,.6)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 晶体切面（左上亮面）
    x.fillStyle = 'rgba(255,255,255,.3)';
    x.beginPath();
    x.moveTo(-r * 0.55, -r * 0.2);
    x.lineTo(-r * 0.25, -r * 0.6);
    x.lineTo(r * 0.05, -r * 0.32);
    x.lineTo(-r * 0.2, -r * 0.02);
    x.closePath();
    x.fill();
    // 金属光泽斑点
    x.fillStyle = 'rgba(210,225,245,.8)';
    x.beginPath(); x.arc(r * 0.22, r * 0.05, r * 0.1, 0, 7); x.fill();
    x.beginPath(); x.arc(-r * 0.05, r * 0.32, r * 0.07, 0, 7); x.fill();
    // 暗面棱线
    x.strokeStyle = 'rgba(20,25,35,.45)';
    x.lineWidth = Math.max(0.7, s * 0.028);
    x.beginPath();
    x.moveTo(r * 0.05, -r * 0.32);
    x.lineTo(r * 0.6, -r * 0.1);
    x.moveTo(r * 0.05, -r * 0.32);
    x.lineTo(-r * 0.05, r * 0.15);
    x.stroke();
  },

  // 铜矿石：橙铜色矿石块，氧化绿斑 + 高光
  'copper-ore': (x, r, s, col) => {
    // 主体矿石
    const g = x.createLinearGradient(-r * 0.5, -r * 0.6, r * 0.5, r * 0.7);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(0.5, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(-r * 0.5, -r * 0.25);
    x.lineTo(-r * 0.2, -r * 0.62);
    x.lineTo(r * 0.35, -r * 0.5);
    x.lineTo(r * 0.58, -r * 0.05);
    x.lineTo(r * 0.35, r * 0.52);
    x.lineTo(-r * 0.35, r * 0.55);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(50,20,5,.6)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 顶部亮切面
    x.fillStyle = 'rgba(255,235,210,.35)';
    x.beginPath();
    x.moveTo(-r * 0.5, -r * 0.25);
    x.lineTo(-r * 0.2, -r * 0.62);
    x.lineTo(r * 0.1, -r * 0.3);
    x.lineTo(-r * 0.18, -r * 0.02);
    x.closePath();
    x.fill();
    // 氧化绿斑（铜锈）
    x.fillStyle = 'rgba(90,190,150,.75)';
    x.beginPath(); x.arc(r * 0.25, r * 0.15, r * 0.12, 0, 7); x.fill();
    x.beginPath(); x.arc(r * 0.05, r * 0.38, r * 0.07, 0, 7); x.fill();
    x.beginPath(); x.arc(-r * 0.25, -r * 0.05, r * 0.08, 0, 7); x.fill();
    // 金属光点
    x.fillStyle = 'rgba(255,220,180,.85)';
    x.beginPath(); x.arc(-r * 0.08, r * 0.12, r * 0.06, 0, 7); x.fill();
    // 棱线
    x.strokeStyle = 'rgba(55,22,6,.4)';
    x.lineWidth = Math.max(0.7, s * 0.028);
    x.beginPath();
    x.moveTo(r * 0.1, -r * 0.3);
    x.lineTo(r * 0.58, -r * 0.05);
    x.moveTo(r * 0.1, -r * 0.3);
    x.lineTo(-r * 0.02, r * 0.2);
    x.stroke();
  },
  // ===== 中间产品（docs/item-icons-todo.md 批次 1，2024 设计） =====

  // 煤：多棱黑煤块，冷灰高光 + 微弱反光
  'coal': (x, r, s, col) => {
    const lump = (px, py, rr, rot) => {
      x.save(); x.translate(px, py); x.rotate(rot);
      const g = x.createLinearGradient(-rr, -rr, rr, rr);
      g.addColorStop(0, lightenColor(col, 0.55));
      g.addColorStop(0.35, lightenColor(col, 0.18));
      g.addColorStop(1, '#0c0c10');
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(-rr, -rr * 0.15);
      x.lineTo(-rr * 0.4, -rr * 0.85);
      x.lineTo(rr * 0.55, -rr * 0.7);
      x.lineTo(rr, rr * 0.05);
      x.lineTo(rr * 0.4, rr * 0.85);
      x.lineTo(-rr * 0.55, rr * 0.7);
      x.closePath();
      x.fill();
      x.strokeStyle = 'rgba(0,0,0,.55)';
      x.lineWidth = Math.max(1, s * 0.045);
      x.stroke();
      // 棱面高光
      x.fillStyle = 'rgba(190,200,220,.28)';
      x.beginPath();
      x.moveTo(-rr, -rr * 0.15);
      x.lineTo(-rr * 0.4, -rr * 0.85);
      x.lineTo(rr * 0.15, -rr * 0.4);
      x.closePath();
      x.fill();
      // 亮点反光
      x.fillStyle = 'rgba(220,230,245,.5)';
      x.beginPath(); x.arc(rr * 0.3, -rr * 0.25, rr * 0.09, 0, 7); x.fill();
      x.restore();
    };
    lump(-r * 0.32, r * 0.28, r * 0.52, 0.5);
    lump(r * 0.42, r * 0.12, r * 0.38, -0.6);
    lump(r * 0.05, -r * 0.4, r * 0.56, -0.15);
  },

  // 固体燃料：橙色压制燃料砖，表面 V 型压纹 + 燃烧光泽
  'solid-fuel': (x, r, s, col) => {
    x.save(); x.rotate(-0.18);
    // 砖体
    const g = x.createLinearGradient(0, -r * 0.55, 0, r * 0.55);
    g.addColorStop(0, lightenColor(col, 0.45));
    g.addColorStop(0.5, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    rrPath(x, -r * 0.85, -r * 0.5, r * 1.7, r * 1.0, r * 0.14);
    x.fill();
    x.strokeStyle = 'rgba(60,25,0,.6)';
    x.lineWidth = Math.max(1, s * 0.05);
    x.stroke();
    // 顶部受光面
    x.fillStyle = 'rgba(255,235,190,.3)';
    rrPath(x, -r * 0.75, -r * 0.42, r * 1.5, r * 0.3, r * 0.1);
    x.fill();
    // 三道 V 型压纹
    x.strokeStyle = 'rgba(70,30,5,.55)';
    x.lineWidth = Math.max(1.2, s * 0.06);
    x.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const px = -r * 0.5 + i * r * 0.48;
      x.beginPath();
      x.moveTo(px - r * 0.12, -r * 0.2);
      x.lineTo(px, r * 0.06);
      x.lineTo(px + r * 0.12, -r * 0.2);
      x.stroke();
    }
    // 火苗光泽点
    x.fillStyle = 'rgba(255,220,120,.8)';
    x.beginPath(); x.arc(r * 0.52, r * 0.28, r * 0.07, 0, 7); x.fill();
    x.restore();
  },

  // 石头：圆润灰岩，冷灰渐变 + 裂纹
  'stone': (x, r, s, col) => {
    // 底影
    x.fillStyle = 'rgba(0,0,0,.18)';
    x.beginPath(); x.ellipse(0, r * 0.55, r * 0.8, r * 0.18, 0, 0, 7); x.fill();
    // 主体
    const g = x.createLinearGradient(-r * 0.5, -r * 0.7, r * 0.5, r * 0.7);
    g.addColorStop(0, lightenColor(col, 0.45));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(-r * 0.78, r * 0.1);
    x.quadraticCurveTo(-r * 0.85, -r * 0.45, -r * 0.25, -r * 0.62);
    x.quadraticCurveTo(r * 0.3, -r * 0.8, r * 0.7, -r * 0.3);
    x.quadraticCurveTo(r * 0.9, r * 0.1, r * 0.55, r * 0.42);
    x.quadraticCurveTo(r * 0.1, r * 0.7, -r * 0.35, r * 0.55);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(60,50,35,.5)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 顶面高光
    x.fillStyle = 'rgba(255,255,250,.4)';
    x.beginPath();
    x.moveTo(-r * 0.45, -r * 0.3);
    x.quadraticCurveTo(-r * 0.1, -r * 0.62, r * 0.35, -r * 0.35);
    x.quadraticCurveTo(r * 0.1, -r * 0.28, -r * 0.45, -r * 0.3);
    x.closePath();
    x.fill();
    // 裂纹
    x.strokeStyle = 'rgba(70,58,40,.45)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.beginPath();
    x.moveTo(-r * 0.1, -r * 0.25);
    x.lineTo(r * 0.05, r * 0.05);
    x.lineTo(-r * 0.15, r * 0.35);
    x.stroke();
    x.beginPath();
    x.moveTo(r * 0.05, r * 0.05);
    x.lineTo(r * 0.42, r * 0.12);
    x.stroke();
  },

  // 方解石：乳白晶体簇，菱面体晶型
  'calcite': (x, r, s, col) => {
    const shard = (px, py, w, h, rot) => {
      x.save(); x.translate(px, py); x.rotate(rot);
      const g = x.createLinearGradient(-w, -h, w, h);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.5, lightenColor(col, 0.3));
      g.addColorStop(1, darkenColor(col, 0.22));
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(0, -h);
      x.lineTo(w, -h * 0.25);
      x.lineTo(w * 0.45, h);
      x.lineTo(-w * 0.45, h);
      x.lineTo(-w, -h * 0.25);
      x.closePath();
      x.fill();
      x.strokeStyle = 'rgba(140,135,120,.55)';
      x.lineWidth = Math.max(0.8, s * 0.035);
      x.stroke();
      // 晶面高光
      x.fillStyle = 'rgba(255,255,255,.75)';
      x.beginPath();
      x.moveTo(0, -h);
      x.lineTo(w, -h * 0.25);
      x.lineTo(w * 0.2, -h * 0.05);
      x.closePath();
      x.fill();
      x.restore();
    };
    // 底影
    x.fillStyle = 'rgba(0,0,0,.15)';
    x.beginPath(); x.ellipse(0, r * 0.62, r * 0.75, r * 0.16, 0, 0, 7); x.fill();
    shard(-r * 0.4, r * 0.05, r * 0.3, r * 0.55, -0.25);
    shard(r * 0.35, r * 0.12, r * 0.26, r * 0.45, 0.3);
    shard(r * 0.02, -r * 0.18, r * 0.34, r * 0.62, 0.05);
  },

  // 铁板：银灰金属板，斜放平行四边形 + 铆钉 + 拉丝反光
  'iron-plate': (x, r, s, col) => {
    const plate = (colMain, dx, dy) => {
      x.save(); x.translate(dx, dy); x.rotate(-0.22);
      const g = x.createLinearGradient(-r * 0.7, -r * 0.5, r * 0.7, r * 0.6);
      g.addColorStop(0, lightenColor(colMain, 0.5));
      g.addColorStop(0.45, colMain);
      g.addColorStop(1, darkenColor(colMain, 0.35));
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(-r * 0.75, -r * 0.28);
      x.lineTo(r * 0.05, -r * 0.55);
      x.lineTo(r * 0.75, -r * 0.02);
      x.lineTo(-r * 0.05, r * 0.55);
      x.closePath();
      x.fill();
      x.strokeStyle = 'rgba(40,45,55,.6)';
      x.lineWidth = Math.max(1, s * 0.045);
      x.stroke();
      // 顶棱受光
      x.fillStyle = 'rgba(255,255,255,.5)';
      x.beginPath();
      x.moveTo(-r * 0.75, -r * 0.28);
      x.lineTo(r * 0.05, -r * 0.55);
      x.lineTo(r * 0.75, -r * 0.02);
      x.lineTo(r * 0.7, r * 0.04);
      x.lineTo(r * 0.02, -r * 0.48);
      x.lineTo(-r * 0.72, -r * 0.22);
      x.closePath();
      x.fill();
      // 两颗铆钉
      x.fillStyle = darkenColor(colMain, 0.4);
      for (const [px, py] of [[-r * 0.42, r * 0.02], [r * 0.36, r * 0.16]]) {
        x.beginPath(); x.arc(px, py, r * 0.07, 0, 7); x.fill();
        x.fillStyle = 'rgba(255,255,255,.7)';
        x.beginPath(); x.arc(px - r * 0.02, py - r * 0.02, r * 0.03, 0, 7); x.fill();
        x.fillStyle = darkenColor(colMain, 0.4);
      }
      x.restore();
    };
    // 底层薄板（错位叠放制造板材感）+ 主板
    plate(darkenColor(col, 0.25), r * 0.08, r * 0.1);
    plate(col, -r * 0.06, -r * 0.06);
  },

  // 铜板：紫铜色金属板，同铁板造型 + 铜色渐变
  'copper-plate': (x, r, s, col) => {
    const copperShade = (c, dx, dy) => {
      x.save(); x.translate(dx, dy); x.rotate(-0.22);
      const g = x.createLinearGradient(-r * 0.7, -r * 0.5, r * 0.7, r * 0.6);
      g.addColorStop(0, lightenColor(c, 0.45));
      g.addColorStop(0.45, c);
      g.addColorStop(1, darkenColor(c, 0.4));
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(-r * 0.75, -r * 0.28);
      x.lineTo(r * 0.05, -r * 0.55);
      x.lineTo(r * 0.75, -r * 0.02);
      x.lineTo(-r * 0.05, r * 0.55);
      x.closePath();
      x.fill();
      x.strokeStyle = 'rgba(80,35,10,.6)';
      x.lineWidth = Math.max(1, s * 0.045);
      x.stroke();
      x.fillStyle = 'rgba(255,230,200,.5)';
      x.beginPath();
      x.moveTo(-r * 0.75, -r * 0.28);
      x.lineTo(r * 0.05, -r * 0.55);
      x.lineTo(r * 0.75, -r * 0.02);
      x.lineTo(r * 0.7, r * 0.04);
      x.lineTo(r * 0.02, -r * 0.48);
      x.lineTo(-r * 0.72, -r * 0.22);
      x.closePath();
      x.fill();
      for (const [px, py] of [[-r * 0.42, r * 0.02], [r * 0.36, r * 0.16]]) {
        x.fillStyle = darkenColor(c, 0.45);
        x.beginPath(); x.arc(px, py, r * 0.07, 0, 7); x.fill();
        x.fillStyle = 'rgba(255,240,220,.75)';
        x.beginPath(); x.arc(px - r * 0.02, py - r * 0.02, r * 0.03, 0, 7); x.fill();
      }
      x.restore();
    };
    copperShade(darkenColor(col, 0.25), r * 0.08, r * 0.1);
    copperShade(col, -r * 0.06, -r * 0.06);
  },

  // 齿轮：灰钢齿轮，8 齿 + 中孔 + 高光
  'iron-gear-wheel': (x, r, s, col) => {
    x.save(); x.rotate(0.2);
    const teeth = 8, rOut = r * 0.95, rIn = r * 0.68, tw = 0.36; // 齿宽角系数
    // 齿
    x.fillStyle = darkenColor(col, 0.15);
    for (let i = 0; i < teeth; i++) {
      const a = i / teeth * Math.PI * 2;
      x.save(); x.rotate(a);
      const g = x.createLinearGradient(-r * 0.2, -rOut, r * 0.2, -rIn);
      g.addColorStop(0, lightenColor(col, 0.45));
      g.addColorStop(1, darkenColor(col, 0.3));
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(-rIn * tw, -rIn);
      x.lineTo(-rOut * tw * 0.8, -rOut);
      x.lineTo(rOut * tw * 0.8, -rOut);
      x.lineTo(rIn * tw, -rIn);
      x.closePath();
      x.fill();
      x.strokeStyle = 'rgba(35,40,50,.55)';
      x.lineWidth = Math.max(0.8, s * 0.03);
      x.stroke();
      x.restore();
    }
    // 轮盘
    const g2 = x.createRadialGradient(-r * 0.25, -r * 0.25, r * 0.1, 0, 0, rIn * 1.05);
    g2.addColorStop(0, lightenColor(col, 0.5));
    g2.addColorStop(0.55, col);
    g2.addColorStop(1, darkenColor(col, 0.35));
    x.fillStyle = g2;
    x.beginPath(); x.arc(0, 0, rIn * 1.02, 0, 7); x.fill();
    x.strokeStyle = 'rgba(35,40,50,.6)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 减重孔
    x.fillStyle = 'rgba(25,30,40,.5)';
    for (let i = 0; i < 4; i++) {
      const a = i / 4 * Math.PI * 2 + 0.4;
      x.beginPath(); x.arc(Math.cos(a) * rIn * 0.58, Math.sin(a) * rIn * 0.58, r * 0.13, 0, 7); x.fill();
    }
    // 中孔
    x.fillStyle = '#1c2026';
    x.beginPath(); x.arc(0, 0, r * 0.3, 0, 7); x.fill();
    x.strokeStyle = 'rgba(255,255,255,.35)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.stroke();
    // 高光
    x.fillStyle = 'rgba(255,255,255,.55)';
    x.beginPath(); x.arc(-r * 0.3, -r * 0.32, r * 0.1, 0, 7); x.fill();
    x.restore();
  },

  // 铁杆：斜置银灰金属杆，两端圆头 + 杆身拉丝
  'iron-stick': (x, r, s, col) => {
    x.save(); x.rotate(-Math.PI / 4);
    // 杆身
    const g = x.createLinearGradient(-r * 0.16, 0, r * 0.16, 0);
    g.addColorStop(0, darkenColor(col, 0.4));
    g.addColorStop(0.35, lightenColor(col, 0.45));
    g.addColorStop(0.6, col);
    g.addColorStop(1, darkenColor(col, 0.35));
    x.fillStyle = g;
    rrPath(x, -r * 0.14, -r * 0.92, r * 0.28, r * 1.84, r * 0.1);
    x.fill();
    x.strokeStyle = 'rgba(40,45,55,.6)';
    x.lineWidth = Math.max(0.8, s * 0.035);
    x.stroke();
    // 两端圆头
    for (const py of [-r * 0.92, r * 0.92]) {
      const g2 = x.createRadialGradient(-r * 0.04, py - r * 0.04, r * 0.02, 0, py, r * 0.17);
      g2.addColorStop(0, lightenColor(col, 0.55));
      g2.addColorStop(1, darkenColor(col, 0.3));
      x.fillStyle = g2;
      x.beginPath(); x.arc(0, py, r * 0.16, 0, 7); x.fill();
      x.strokeStyle = 'rgba(40,45,55,.6)';
      x.stroke();
    }
    x.restore();
  },

  // 铜线：盘绕铜线卷，两圈半螺旋 + 线头
  'copper-cable': (x, r, s, col) => {
    x.save(); x.rotate(-0.35);
    // 线卷主体（多圈椭圆叠出层次）
    for (let i = 3; i >= 0; i--) {
      const oy = -r * 0.3 + i * r * 0.2;
      const g = x.createLinearGradient(-r * 0.7, oy, r * 0.7, oy + r * 0.1);
      g.addColorStop(0, lightenColor(col, 0.4));
      g.addColorStop(0.5, col);
      g.addColorStop(1, darkenColor(col, 0.45));
      x.fillStyle = g;
      x.beginPath();
      x.ellipse(0, oy, r * 0.72, r * 0.3, 0, Math.PI * 0.06, Math.PI * 0.99);
      x.lineTo(-r * 0.72, oy + r * 0.1);
      x.closePath();
      x.fill();
      x.strokeStyle = 'rgba(90,40,10,.6)';
      x.lineWidth = Math.max(0.8, s * 0.035);
      x.stroke();
    }
    // 上方露出的一圈（完整椭圆环）
    const gTop = x.createLinearGradient(-r * 0.7, -r * 0.55, r * 0.7, -r * 0.2);
    gTop.addColorStop(0, lightenColor(col, 0.5));
    gTop.addColorStop(0.55, lightenColor(col, 0.15));
    gTop.addColorStop(1, darkenColor(col, 0.3));
    x.strokeStyle = gTop;
    x.lineWidth = Math.max(2, s * 0.09);
    x.lineCap = 'round';
    x.beginPath();
    x.ellipse(0, -r * 0.38, r * 0.66, r * 0.3, 0, Math.PI * 0.9, Math.PI * 2.35);
    x.stroke();
    x.strokeStyle = 'rgba(255,230,200,.7)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.beginPath();
    x.ellipse(0, -r * 0.38, r * 0.66, r * 0.3, 0, Math.PI * 1.05, Math.PI * 1.6);
    x.stroke();
    // 线头（右上甩出）
    const gEnd = x.createLinearGradient(r * 0.4, -r * 0.6, r * 0.85, -r * 0.05);
    gEnd.addColorStop(0, lightenColor(col, 0.35));
    gEnd.addColorStop(1, darkenColor(col, 0.2));
    x.strokeStyle = gEnd;
    x.lineWidth = Math.max(2, s * 0.08);
    x.beginPath();
    x.moveTo(r * 0.58, -r * 0.52);
    x.quadraticCurveTo(r * 0.95, -r * 0.35, r * 0.75, r * 0.1);
    x.stroke();
    // 线头截面
    x.fillStyle = lightenColor(col, 0.55);
    x.beginPath(); x.arc(r * 0.75, r * 0.1, r * 0.09, 0, 7); x.fill();
    x.strokeStyle = 'rgba(90,40,10,.6)';
    x.lineWidth = Math.max(0.7, s * 0.03);
    x.stroke();
    x.restore();
  },

  // 电路板：绿基板 + 走线 + 黑色芯片 + 引脚
  'electronic-circuit': (x, r, s, col) => {
    // 基板
    const g = x.createLinearGradient(-r * 0.7, -r * 0.7, r * 0.7, r * 0.7);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    rrPath(x, -r * 0.72, -r * 0.72, r * 1.44, r * 1.44, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(10,30,15,.6)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 走线（铜色细线）
    x.strokeStyle = '#c98a4b';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.lineCap = 'round';
    const traces = [
      [[-0.55, -0.45], [-0.2, -0.45], [-0.05, -0.3]],
      [[-0.55, 0.1], [-0.3, 0.1], [-0.15, 0.25]],
      [[0.55, -0.35], [0.3, -0.35], [0.2, -0.2]],
      [[0.55, 0.35], [0.28, 0.35], [0.18, 0.45]],
      [[0, -0.55], [0, -0.32]],
      [[0.05, 0.55], [0.05, 0.38]],
    ];
    for (const t of traces) {
      x.beginPath();
      x.moveTo(t[0][0] * r, t[0][1] * r);
      for (let i = 1; i < t.length; i++) x.lineTo(t[i][0] * r, t[i][1] * r);
      x.stroke();
      // 焊点
      x.fillStyle = '#e0a866';
      x.beginPath(); x.arc(t[0][0] * r, t[0][1] * r, r * 0.05, 0, 7); x.fill();
      x.beginPath(); x.arc(t[t.length - 1][0] * r, t[t.length - 1][1] * r, r * 0.05, 0, 7); x.fill();
    }
    // 中央芯片
    const gChip = x.createLinearGradient(-r * 0.3, -r * 0.3, r * 0.3, r * 0.3);
    gChip.addColorStop(0, '#3a3f47');
    gChip.addColorStop(1, '#15181d');
    x.fillStyle = gChip;
    rrPath(x, -r * 0.32, -r * 0.32, r * 0.64, r * 0.64, r * 0.06);
    x.fill();
    x.strokeStyle = 'rgba(0,0,0,.7)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.stroke();
    // 芯片引脚（四边短脚）
    x.fillStyle = '#c8ccd4';
    for (let i = 0; i < 3; i++) {
      const o = -r * 0.16 + i * r * 0.16;
      x.fillRect(o - r * 0.03, -r * 0.44, r * 0.06, r * 0.14); // 上
      x.fillRect(o - r * 0.03, r * 0.3, r * 0.06, r * 0.14);  // 下
      x.fillRect(-r * 0.44, o - r * 0.03, r * 0.14, r * 0.06); // 左
      x.fillRect(r * 0.3, o - r * 0.03, r * 0.14, r * 0.06);   // 右
    }
    // 芯片丝印圆点
    x.fillStyle = 'rgba(255,255,255,.35)';
    x.beginPath(); x.arc(-r * 0.2, -r * 0.2, r * 0.045, 0, 7); x.fill();
    // 基板高光
    x.fillStyle = 'rgba(255,255,255,.22)';
    rrPath(x, -r * 0.62, -r * 0.62, r * 0.5, r * 0.5, r * 0.08);
    x.fill();
  },

  // ===== 中间产品（docs/item-icons-todo.md 批次 2） =====

  // 统一药瓶造型：对应颜色即瓶内液体色（共享 _scienceBottle）
  'automation-science-pack': (x, r, s, col) => {
    // 对应颜色瓶子：颜色由 ITEMS[id].color 驱动
    _scienceBottle(x, r, s, col);
  },

  // 钢板：灰蓝金属厚板，铆钉 + 拉丝质感 + 侧边厚度
  'steel-plate': (x, r, s, col) => {
    x.save(); x.rotate(-0.22);
    // 板厚度侧边
    x.fillStyle = darkenColor(col, 0.55);
    rrPath(x, -r * 0.82, -r * 0.5, r * 1.64, r * 1.08, r * 0.1);
    x.fill();
    // 顶面
    const g = x.createLinearGradient(-r * 0.8, -r * 0.62, r * 0.8, r * 0.5);
    g.addColorStop(0, lightenColor(col, 0.5));
    g.addColorStop(0.45, col);
    g.addColorStop(1, darkenColor(col, 0.3));
    x.fillStyle = g;
    rrPath(x, -r * 0.82, -r * 0.62, r * 1.64, r * 1.0, r * 0.1);
    x.fill();
    x.strokeStyle = 'rgba(25,35,50,.65)';
    x.lineWidth = Math.max(1, s * 0.05);
    x.stroke();
    // 拉丝纹
    x.strokeStyle = 'rgba(255,255,255,.12)';
    x.lineWidth = Math.max(0.8, s * 0.025);
    for (let i = 0; i < 4; i++) {
      const py = -r * 0.38 + i * r * 0.26;
      x.beginPath(); x.moveTo(-r * 0.6, py); x.lineTo(r * 0.6, py); x.stroke();
    }
    // 四角铆钉
    x.fillStyle = 'rgba(235,240,248,.85)';
    for (const [px, py] of [[-0.62, -0.42], [0.62, -0.42], [-0.62, 0.2], [0.62, 0.2]]) {
      x.beginPath(); x.arc(px * r, py * r, r * 0.07, 0, 7); x.fill();
    }
    x.restore();
  },

  // 统一药瓶造型：对应颜色即瓶内液体色（共享 _scienceBottle）
  'logistic-science-pack': (x, r, s, col) => {
    // 对应颜色瓶子：颜色由 ITEMS[id].color 驱动
    _scienceBottle(x, r, s, col);
  },

  // 统一药瓶造型：对应颜色即瓶内液体色（共享 _scienceBottle）
  'chemical-science-pack': (x, r, s, col) => {
    // 对应颜色瓶子：颜色由 ITEMS[id].color 驱动
    _scienceBottle(x, r, s, col);
  },

  // 塑料板：白色半透明板 + 轻微弯折 + 高光，树脂质感
  'plastic-bar': (x, r, s, col) => {
    x.save(); x.rotate(0.25);
    const g = x.createLinearGradient(-r * 0.7, -r * 0.5, r * 0.7, r * 0.5);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(0.5, lightenColor(col, 0.12));
    g.addColorStop(1, darkenColor(col, 0.2));
    x.fillStyle = g;
    rrPath(x, -r * 0.8, -r * 0.42, r * 1.6, r * 0.84, r * 0.16);
    x.fill();
    x.strokeStyle = 'rgba(60,70,85,.55)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 斜向高光带
    x.fillStyle = 'rgba(255,255,255,.45)';
    x.beginPath();
    x.moveTo(-r * 0.6, -r * 0.36);
    x.lineTo(-r * 0.25, -r * 0.36);
    x.lineTo(-r * 0.05, r * 0.36);
    x.lineTo(-r * 0.4, r * 0.36);
    x.closePath();
    x.fill();
    x.fillStyle = 'rgba(255,255,255,.28)';
    x.beginPath();
    x.moveTo(r * 0.1, -r * 0.36);
    x.lineTo(r * 0.28, -r * 0.36);
    x.lineTo(r * 0.48, r * 0.36);
    x.lineTo(r * 0.3, r * 0.36);
    x.closePath();
    x.fill();
    x.restore();
  },

  // 统一药瓶造型：对应颜色即瓶内液体色（共享 _scienceBottle）
  'military-science-pack': (x, r, s, col) => {
    // 对应颜色瓶子：颜色由 ITEMS[id].color 驱动
    _scienceBottle(x, r, s, col);
  },

  // 高级电路板：暗红基板 + 金色走线 + 中央芯片，比绿板更高级
  'advanced-circuit': (x, r, s, col) => {
    // 引脚
    x.fillStyle = '#b8a24e';
    for (let i = 0; i < 4; i++) {
      x.fillRect(-r * 0.6 + i * r * 0.4, r * 0.78, r * 0.16, r * 0.2);
    }
    const g = x.createLinearGradient(-r * 0.75, -r * 0.75, r * 0.75, r * 0.75);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    rrPath(x, -r * 0.78, -r * 0.78, r * 1.56, r * 1.56, r * 0.14);
    x.fill();
    x.strokeStyle = 'rgba(35,8,8,.65)';
    x.lineWidth = Math.max(1, s * 0.05);
    x.stroke();
    // 金色走线（横竖各两条）
    x.strokeStyle = 'rgba(230,196,90,.85)';
    x.lineWidth = Math.max(1, s * 0.032);
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(-r * 0.62, -r * 0.32); x.lineTo(r * 0.62, -r * 0.32);
    x.moveTo(-r * 0.62, r * 0.34); x.lineTo(r * 0.62, r * 0.34);
    x.moveTo(-r * 0.3, -r * 0.62); x.lineTo(-r * 0.3, r * 0.62);
    x.moveTo(r * 0.3, -r * 0.62); x.lineTo(r * 0.3, r * 0.62);
    x.stroke();
    // 走线端点焊盘
    x.fillStyle = 'rgba(240,210,110,.95)';
    for (const [px, py] of [[-0.62, -0.32], [0.62, -0.32], [-0.62, 0.34], [0.62, 0.34], [-0.3, -0.62], [0.3, -0.62], [-0.3, 0.62], [0.3, 0.62]]) {
      x.beginPath(); x.arc(px * r, py * r, r * 0.055, 0, 7); x.fill();
    }
    // 中央芯片
    x.fillStyle = '#2a2a32';
    rrPath(x, -r * 0.3, -r * 0.3, r * 0.6, r * 0.6, r * 0.06);
    x.fill();
    x.strokeStyle = 'rgba(230,196,90,.6)';
    x.lineWidth = Math.max(0.8, s * 0.025);
    x.stroke();
    // 芯片引脚
    x.fillStyle = 'rgba(230,196,90,.9)';
    for (let i = 0; i < 3; i++) {
      x.fillRect(-r * 0.24 + i * r * 0.22, -r * 0.42, r * 0.1, r * 0.12);
      x.fillRect(-r * 0.24 + i * r * 0.22, r * 0.3, r * 0.1, r * 0.12);
    }
  },

  // 引擎单元：灰钢气缸体 + 活塞杆 + 散热鳍片
  'engine-unit': (x, r, s, col) => {
    x.save(); x.rotate(-0.35);
    // 活塞杆
    x.fillStyle = '#c9ced6';
    x.fillRect(-r * 0.12, -r * 0.95, r * 0.24, r * 0.5);
    x.strokeStyle = 'rgba(40,48,60,.5)';
    x.lineWidth = Math.max(1, s * 0.03);
    x.strokeRect(-r * 0.12, -r * 0.95, r * 0.24, r * 0.5);
    // 气缸体
    const g = x.createLinearGradient(-r * 0.55, 0, r * 0.55, 0);
    g.addColorStop(0, lightenColor(col, 0.5));
    g.addColorStop(0.5, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    rrPath(x, -r * 0.55, -r * 0.48, r * 1.1, r * 1.25, r * 0.14);
    x.fill();
    x.strokeStyle = 'rgba(35,42,55,.65)';
    x.lineWidth = Math.max(1, s * 0.05);
    x.stroke();
    // 散热鳍片
    x.fillStyle = 'rgba(45,55,70,.45)';
    for (let i = 0; i < 3; i++) {
      x.fillRect(-r * 0.55, -r * 0.26 + i * r * 0.4, r * 1.1, r * 0.13);
    }
    // 缸体高光
    x.fillStyle = 'rgba(255,255,255,.25)';
    rrPath(x, -r * 0.42, -r * 0.4, r * 0.2, r * 1.05, r * 0.08);
    x.fill();
    // 底座
    x.fillStyle = '#6d747d';
    rrPath(x, -r * 0.7, r * 0.66, r * 1.4, r * 0.22, r * 0.06);
    x.fill();
    x.strokeStyle = 'rgba(35,42,55,.6)';
    x.stroke();
    x.restore();
  },

  // 电动引擎：蓝灰电机壳 + 转轴 + 电刷火花色端盖
  'electric-engine-unit': (x, r, s, col) => {
    x.save(); x.rotate(0.3);
    // 转轴
    x.fillStyle = '#c9ced6';
    x.fillRect(-r * 0.1, -r * 0.95, r * 0.2, r * 0.42);
    x.strokeStyle = 'rgba(40,48,60,.5)';
    x.lineWidth = Math.max(1, s * 0.03);
    x.strokeRect(-r * 0.1, -r * 0.95, r * 0.2, r * 0.42);
    // 电机壳
    const g = x.createLinearGradient(-r * 0.6, 0, r * 0.6, 0);
    g.addColorStop(0, lightenColor(col, 0.45));
    g.addColorStop(0.5, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    rrPath(x, -r * 0.6, -r * 0.55, r * 1.2, r * 1.3, r * 0.16);
    x.fill();
    x.strokeStyle = 'rgba(25,40,55,.65)';
    x.lineWidth = Math.max(1, s * 0.05);
    x.stroke();
    // 电机壳散热槽（竖向）
    x.fillStyle = 'rgba(25,40,55,.4)';
    for (let i = 0; i < 4; i++) {
      x.fillRect(-r * 0.45 + i * r * 0.26, -r * 0.42, r * 0.1, r * 0.98);
    }
    // 顶部端盖
    x.fillStyle = '#e8b93a';
    rrPath(x, -r * 0.42, -r * 0.62, r * 0.84, r * 0.2, r * 0.07);
    x.fill();
    x.strokeStyle = 'rgba(90,65,10,.55)';
    x.stroke();
    // 壳体高光
    x.fillStyle = 'rgba(255,255,255,.22)';
    rrPath(x, -r * 0.48, -r * 0.42, r * 0.18, r * 1.05, r * 0.08);
    x.fill();
    // 底座
    x.fillStyle = '#6d747d';
    rrPath(x, -r * 0.72, r * 0.66, r * 1.44, r * 0.2, r * 0.06);
    x.fill();
    x.restore();
  },

  // 处理器：墨绿基板 + 金色网格走线 + 双芯片，尖端电子感
  'processing-unit': (x, r, s, col) => {
    // 引脚
    x.fillStyle = '#b8a24e';
    for (let i = 0; i < 5; i++) {
      x.fillRect(-r * 0.64 + i * r * 0.32, r * 0.8, r * 0.13, r * 0.18);
    }
    const g = x.createLinearGradient(-r * 0.8, -r * 0.8, r * 0.8, r * 0.8);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    rrPath(x, -r * 0.82, -r * 0.82, r * 1.64, r * 1.64, r * 0.13);
    x.fill();
    x.strokeStyle = 'rgba(8,30,18,.7)';
    x.lineWidth = Math.max(1, s * 0.05);
    x.stroke();
    // 金色网格走线
    x.strokeStyle = 'rgba(232,200,100,.7)';
    x.lineWidth = Math.max(0.8, s * 0.026);
    for (let i = 0; i < 3; i++) {
      const p = -r * 0.5 + i * r * 0.5;
      x.beginPath();
      x.moveTo(-r * 0.7, p); x.lineTo(r * 0.7, p);
      x.moveTo(p, -r * 0.7); x.lineTo(p, r * 0.7);
      x.stroke();
    }
    // 主芯片（中央）
    x.fillStyle = '#1e222b';
    rrPath(x, -r * 0.34, -r * 0.34, r * 0.68, r * 0.68, r * 0.07);
    x.fill();
    x.strokeStyle = 'rgba(232,200,100,.75)';
    x.lineWidth = Math.max(1, s * 0.028);
    x.stroke();
    // 芯片内核微光
    x.fillStyle = 'rgba(120,200,255,.35)';
    rrPath(x, -r * 0.16, -r * 0.16, r * 0.32, r * 0.32, r * 0.04);
    x.fill();
    // 两颗副芯片
    x.fillStyle = '#2a2f3a';
    rrPath(x, -r * 0.66, -r * 0.66, r * 0.3, r * 0.3, r * 0.05);
    x.fill();
    x.strokeStyle = 'rgba(232,200,100,.5)';
    x.stroke();
    rrPath(x, r * 0.36, r * 0.36, r * 0.3, r * 0.3, r * 0.05);
    x.fillStyle = '#2a2f3a';
    x.fill();
    x.stroke();
  },

  // ===== 中间产品批次 1（low-density-structure ~ sulfuric-acid，共 10 项）=====

  // 低密度结构：轻质蜂窝夹层板，蜂窝六边形 + 银白航空质感
  'low-density-structure': (x, r, s, col) => {
    const g = x.createLinearGradient(-r * 0.8, -r * 0.8, r * 0.8, r * 0.8);
    g.addColorStop(0, '#e8edf2');
    g.addColorStop(0.5, col);
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    rrPath(x, -r * 0.82, -r * 0.72, r * 1.64, r * 1.44, r * 0.14);
    x.fill();
    x.strokeStyle = 'rgba(40,50,62,.65)';
    x.lineWidth = Math.max(1, s * 0.05);
    x.stroke();
    // 蜂窝六边形阵列
    const hex = (cx, cy, rr) => {
      x.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 6 + i * Math.PI / 3;
        const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
        i ? x.lineTo(px, py) : x.moveTo(px, py);
      }
      x.closePath();
    };
    x.fillStyle = 'rgba(70,85,100,.35)';
    for (let row = 0; row < 2; row++) {
      for (let i = 0; i < 3; i++) {
        hex(-r * 0.44 + i * r * 0.5 + (row ? r * 0.25 : 0), -r * 0.3 + row * r * 0.5, r * 0.2);
        x.fill();
        x.strokeStyle = 'rgba(255,255,255,.4)';
        x.lineWidth = Math.max(0.6, s * 0.022);
        x.stroke();
      }
    }
    // 顶部斜向高光
    x.fillStyle = 'rgba(255,255,255,.35)';
    x.beginPath();
    x.moveTo(-r * 0.7, -r * 0.6);
    x.lineTo(-r * 0.3, -r * 0.6);
    x.lineTo(r * 0.1, r * 0.6);
    x.lineTo(-r * 0.3, r * 0.6);
    x.closePath();
    x.fill();
  },

  // 火箭燃料：橙色推进剂桶 + 火焰尾迹，示意高能燃烧
  'rocket-fuel': (x, r, s, col) => {
    // 燃料桶
    const g = x.createLinearGradient(-r * 0.5, 0, r * 0.5, 0);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(0.5, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    rrPath(x, -r * 0.52, -r * 0.8, r * 1.04, r * 1.15, r * 0.16);
    x.fill();
    x.strokeStyle = 'rgba(80,40,8,.65)';
    x.lineWidth = Math.max(1, s * 0.05);
    x.stroke();
    // 桶箍两道
    x.strokeStyle = 'rgba(60,30,5,.5)';
    x.lineWidth = Math.max(0.8, s * 0.035);
    x.beginPath();
    x.moveTo(-r * 0.52, -r * 0.4); x.lineTo(r * 0.52, -r * 0.4);
    x.moveTo(-r * 0.52, r * 0.12); x.lineTo(r * 0.52, r * 0.12);
    x.stroke();
    // 危险火焰标记（三角形 + 火苗）
    x.fillStyle = '#1c1206';
    x.beginPath();
    x.moveTo(0, -r * 0.24);
    x.lineTo(-r * 0.26, r * 0.3);
    x.lineTo(r * 0.26, r * 0.3);
    x.closePath();
    x.fill();
    x.fillStyle = '#ffd23e';
    x.beginPath();
    x.moveTo(0, -r * 0.12);
    x.quadraticCurveTo(-r * 0.14, r * 0.06, 0, r * 0.24);
    x.quadraticCurveTo(r * 0.14, r * 0.06, 0, -r * 0.12);
    x.fill();
    // 底部喷口
    x.fillStyle = '#5c626a';
    rrPath(x, -r * 0.3, r * 0.35, r * 0.6, r * 0.14, r * 0.05);
    x.fill();
    // 火焰尾迹
    const fg = x.createLinearGradient(0, r * 0.45, 0, r * 0.95);
    fg.addColorStop(0, '#ffe066');
    fg.addColorStop(0.5, '#ff8c2e');
    fg.addColorStop(1, 'rgba(255,80,20,0)');
    x.fillStyle = fg;
    x.beginPath();
    x.moveTo(-r * 0.22, r * 0.46);
    x.quadraticCurveTo(0, r * 0.7, r * 0.22, r * 0.46);
    x.quadraticCurveTo(0, r * 1.05, -r * 0.22, r * 0.46);
    x.fill();
  },

  // 爆炸物：纸质炸药包 + 引线火花，橙红警戒色
  'explosives': (x, r, s, col) => {
    // 三根炸药棒捆
    const stick = (ox) => {
      const g = x.createLinearGradient(ox - r * 0.16, 0, ox + r * 0.16, 0);
      g.addColorStop(0, lightenColor(col, 0.35));
      g.addColorStop(0.55, col);
      g.addColorStop(1, darkenColor(col, 0.45));
      x.fillStyle = g;
      rrPath(x, ox - r * 0.17, -r * 0.35, r * 0.34, r * 1.3, r * 0.1);
      x.fill();
      x.strokeStyle = 'rgba(70,20,8,.6)';
      x.lineWidth = Math.max(0.8, s * 0.035);
      x.stroke();
    };
    stick(-r * 0.36); stick(0); stick(r * 0.36);
    // 捆扎带
    x.fillStyle = 'rgba(50,28,10,.75)';
    x.fillRect(-r * 0.56, -r * 0.12, r * 1.12, r * 0.16);
    // 引线
    x.strokeStyle = '#c9b48a';
    x.lineWidth = Math.max(1, s * 0.04);
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(0, -r * 0.35);
    x.quadraticCurveTo(r * 0.3, -r * 0.7, r * 0.5, -r * 0.62);
    x.stroke();
    // 火花
    x.fillStyle = '#ffd23e';
    x.beginPath(); x.arc(r * 0.54, -r * 0.64, r * 0.1, 0, 7); x.fill();
    x.strokeStyle = '#ff8c2e';
    x.lineWidth = Math.max(0.7, s * 0.03);
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i - 2) * 0.5;
      x.beginPath();
      x.moveTo(r * 0.54 + Math.cos(a) * r * 0.14, -r * 0.64 + Math.sin(a) * r * 0.14);
      x.lineTo(r * 0.54 + Math.cos(a) * r * 0.26, -r * 0.64 + Math.sin(a) * r * 0.26);
      x.stroke();
    }
  },

  // 电池：圆柱电池 + 顶盖正极 + 电量条纹
  'battery': (x, r, s, col) => {
    // 正极凸起
    x.fillStyle = '#8a8f96';
    rrPath(x, -r * 0.14, -r * 0.92, r * 0.28, r * 0.16, r * 0.04);
    x.fill();
    // 桶身
    const g = x.createLinearGradient(-r * 0.55, 0, r * 0.55, 0);
    g.addColorStop(0, lightenColor(col, 0.45));
    g.addColorStop(0.5, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    rrPath(x, -r * 0.55, -r * 0.8, r * 1.1, r * 1.6, r * 0.14);
    x.fill();
    x.strokeStyle = 'rgba(70,58,8,.6)';
    x.lineWidth = Math.max(1, s * 0.05);
    x.stroke();
    // 顶部负极环
    x.fillStyle = '#6d747d';
    rrPath(x, -r * 0.44, -r * 0.88, r * 0.88, r * 0.12, r * 0.05);
    x.fill();
    // 电量条纹（白色闪电）
    x.fillStyle = '#2a2410';
    rrPath(x, -r * 0.34, -r * 0.52, r * 0.68, r * 1.06, r * 0.08);
    x.fill();
    x.fillStyle = '#ffe95c';
    x.beginPath();
    x.moveTo(r * 0.06, -r * 0.42);
    x.lineTo(-r * 0.18, r * 0.08);
    x.lineTo(-r * 0.02, r * 0.08);
    x.lineTo(-r * 0.08, r * 0.44);
    x.lineTo(r * 0.18, -r * 0.08);
    x.lineTo(r * 0.0, -r * 0.08);
    x.closePath();
    x.fill();
  },

  // 飞行机器人框架：机架 + 四旋翼 + 中央核心，蓝灰科技感
  'flying-robot-frame': (x, r, s, col) => {
    // 四根旋翼臂（X 形）
    x.strokeStyle = '#55606e';
    x.lineWidth = Math.max(1.4, s * 0.07);
    x.lineCap = 'round';
    for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      x.beginPath();
      x.moveTo(0, 0);
      x.lineTo(sx * r * 0.66, sy * r * 0.55);
      x.stroke();
      // 旋翼环
      x.strokeStyle = 'rgba(180,200,225,.8)';
      x.lineWidth = Math.max(1, s * 0.045);
      x.beginPath();
      x.ellipse(sx * r * 0.66, sy * r * 0.55, r * 0.22, r * 0.09, sy > 0 ? 0.4 : -0.4, 0, 7);
      x.stroke();
      x.strokeStyle = '#55606e';
      x.lineWidth = Math.max(1.4, s * 0.07);
    }
    // 中央机架
    const g = x.createLinearGradient(-r * 0.4, -r * 0.4, r * 0.4, r * 0.4);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    rrPath(x, -r * 0.4, -r * 0.34, r * 0.8, r * 0.68, r * 0.14);
    x.fill();
    x.strokeStyle = 'rgba(20,32,48,.7)';
    x.lineWidth = Math.max(1, s * 0.05);
    x.stroke();
    // 核心发光
    x.fillStyle = 'rgba(120,200,255,.9)';
    x.beginPath(); x.arc(0, 0, r * 0.14, 0, 7); x.fill();
    x.fillStyle = 'rgba(120,200,255,.3)';
    x.beginPath(); x.arc(0, 0, r * 0.26, 0, 7); x.fill();
  },

  // 统一药瓶造型：对应颜色即瓶内液体色（共享 _scienceBottle）
  'production-science-pack': (x, r, s, col) => {
    // 对应颜色瓶子：颜色由 ITEMS[id].color 驱动
    _scienceBottle(x, r, s, col);
  },

  // 统一药瓶造型：对应颜色即瓶内液体色（共享 _scienceBottle）
  'utility-science-pack': (x, r, s, col) => {
    // 对应颜色瓶子：颜色由 ITEMS[id].color 驱动
    _scienceBottle(x, r, s, col);
  },

  // 润滑油：油壶 + 滴落油滴，金黄色
  'lubricant': (x, r, s, col) => {
    // 壶身
    const g = x.createLinearGradient(-r * 0.5, -r * 0.4, r * 0.5, r * 0.8);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    rrPath(x, -r * 0.55, -r * 0.35, r * 1.1, r * 1.15, r * 0.14);
    x.fill();
    x.strokeStyle = 'rgba(90,72,8,.6)';
    x.lineWidth = Math.max(1, s * 0.05);
    x.stroke();
    // 壶嘴（斜向上）
    x.fillStyle = col;
    x.beginPath();
    x.moveTo(-r * 0.5, -r * 0.3);
    x.lineTo(-r * 0.95, -r * 0.68);
    x.lineTo(-r * 0.72, -r * 0.78);
    x.lineTo(-r * 0.25, -r * 0.38);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(90,72,8,.6)';
    x.stroke();
    // 壶嘴口油滴
    x.fillStyle = '#f2dc4e';
    x.beginPath();
    x.moveTo(-r * 0.9, -r * 0.62);
    x.quadraticCurveTo(-r * 1.02, -r * 0.36, -r * 0.9, -r * 0.28);
    x.quadraticCurveTo(-r * 0.78, -r * 0.36, -r * 0.9, -r * 0.62);
    x.fill();
    // 握把
    x.strokeStyle = '#8a7410';
    x.lineWidth = Math.max(1.2, s * 0.06);
    x.beginPath();
    x.arc(r * 0.35, -r * 0.35, r * 0.26, -Math.PI / 2, Math.PI / 2);
    x.stroke();
    // 标签
    x.fillStyle = 'rgba(255,255,255,.75)';
    rrPath(x, -r * 0.34, r * 0.05, r * 0.68, r * 0.42, r * 0.06);
    x.fill();
    x.fillStyle = '#8a7410';
    x.font = 'bold ' + Math.round(r * 0.3) + 'px system-ui';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('LUB', 0, r * 0.27);
  },

  // 硫磺：黄色晶簇堆（三颗晶体）
  'sulfur': (x, r, s, col) => {
    const crystal = (cx, cy, w, h) => {
      const g = x.createLinearGradient(cx, cy - h / 2, cx + w / 2, cy + h / 2);
      g.addColorStop(0, '#f7ee7a');
      g.addColorStop(0.6, col);
      g.addColorStop(1, darkenColor(col, 0.35));
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(cx, cy - h / 2);
      x.lineTo(cx + w / 2, cy - h * 0.1);
      x.lineTo(cx + w * 0.3, cy + h / 2);
      x.lineTo(cx - w * 0.3, cy + h / 2);
      x.lineTo(cx - w / 2, cy - h * 0.1);
      x.closePath();
      x.fill();
      x.strokeStyle = 'rgba(110,95,10,.55)';
      x.lineWidth = Math.max(0.8, s * 0.035);
      x.stroke();
      // 晶面高光
      x.fillStyle = 'rgba(255,255,240,.5)';
      x.beginPath();
      x.moveTo(cx, cy - h / 2);
      x.lineTo(cx + w * 0.1, cy - h * 0.05);
      x.lineTo(cx - w * 0.15, cy + h * 0.15);
      x.closePath();
      x.fill();
    };
    crystal(-r * 0.42, r * 0.28, r * 0.62, r * 0.75);
    crystal(r * 0.4, r * 0.3, r * 0.58, r * 0.7);
    crystal(0, -r * 0.18, r * 0.78, r * 1.05);
  },

  // 硫酸：试剂瓶 + 骷髅危险标签，黄绿腐蚀液
  'sulfuric-acid': (x, r, s, col) => {
    // 瓶口与瓶盖
    x.fillStyle = '#9aa0a8';
    rrPath(x, -r * 0.18, -r * 0.95, r * 0.36, r * 0.3, r * 0.06);
    x.fill();
    const g = x.createLinearGradient(-r * 0.6, -r * 0.6, r * 0.6, r * 0.8);
    g.addColorStop(0, lightenColor(col, 0.45));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(-r * 0.16, -r * 0.66);
    x.lineTo(-r * 0.7, r * 0.6);
    x.quadraticCurveTo(-r * 0.78, r * 0.82, -r * 0.5, r * 0.82);
    x.lineTo(r * 0.5, r * 0.82);
    x.quadraticCurveTo(r * 0.78, r * 0.82, r * 0.7, r * 0.6);
    x.lineTo(r * 0.16, -r * 0.66);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(75,70,10,.65)';
    x.lineWidth = Math.max(1, s * 0.05);
    x.stroke();
    // 腐蚀性液体
    x.fillStyle = 'rgba(130,125,15,.55)';
    x.beginPath();
    x.moveTo(-r * 0.5, r * 0.18);
    x.lineTo(-r * 0.62, r * 0.6);
    x.quadraticCurveTo(-r * 0.7, r * 0.78, -r * 0.5, r * 0.78);
    x.lineTo(r * 0.5, r * 0.78);
    x.quadraticCurveTo(r * 0.7, r * 0.78, r * 0.62, r * 0.6);
    x.lineTo(r * 0.5, r * 0.18);
    x.closePath();
    x.fill();
    // 液面气泡
    x.fillStyle = 'rgba(255,255,220,.6)';
    x.beginPath(); x.arc(-r * 0.25, r * 0.35, r * 0.07, 0, 7); x.fill();
    x.beginPath(); x.arc(r * 0.12, r * 0.5, r * 0.05, 0, 7); x.fill();
    x.beginPath(); x.arc(r * 0.32, r * 0.3, r * 0.06, 0, 7); x.fill();
    // 危险菱形标签
    x.save();
    x.translate(0, r * 0.02);
    x.rotate(Math.PI / 4);
    x.fillStyle = '#1c1a08';
    rrPath(x, -r * 0.3, -r * 0.3, r * 0.6, r * 0.6, r * 0.07);
    x.fill();
    x.restore();
    x.fillStyle = '#f2e14e';
    x.font = 'bold ' + Math.round(r * 0.44) + 'px system-ui';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('H₂SO₄', 0, r * 0.04);
  },

  // 碳：黑色无定形碳块堆（三颗哑光碳粒）+ 微弱光泽
  'carbon': (x, r, s, col) => {
    const lump = (cx, cy, w, h, rot) => {
      x.save();
      x.translate(cx, cy);
      x.rotate(rot || 0);
      const g = x.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
      g.addColorStop(0, lightenColor(col, 0.28));
      g.addColorStop(0.55, col);
      g.addColorStop(1, darkenColor(col, 0.25));
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(-w * 0.45, -h * 0.2);
      x.lineTo(-w * 0.1, -h * 0.5);
      x.lineTo(w * 0.42, -h * 0.28);
      x.lineTo(w * 0.48, h * 0.22);
      x.lineTo(w * 0.08, h * 0.5);
      x.lineTo(-w * 0.4, h * 0.3);
      x.closePath();
      x.fill();
      x.strokeStyle = 'rgba(0,0,0,.55)';
      x.lineWidth = Math.max(0.7, s * 0.03);
      x.stroke();
      // 哑光高光
      x.fillStyle = 'rgba(255,255,255,.14)';
      x.beginPath();
      x.moveTo(-w * 0.3, -h * 0.2);
      x.lineTo(0, -h * 0.4);
      x.lineTo(w * 0.2, -h * 0.2);
      x.lineTo(-w * 0.05, h * 0.02);
      x.closePath();
      x.fill();
      x.restore();
    };
    lump(-r * 0.38, r * 0.3, r * 0.66, r * 0.5, 0.15);
    lump(r * 0.38, r * 0.32, r * 0.6, r * 0.46, -0.2);
    lump(0.02 * r, -r * 0.16, r * 0.84, r * 0.64, 0.05);
  },

  // 碳纤维：编织纹理板（一束斜向纤维丝 + 编织交叉高光）
  'carbon-fiber': (x, r, s, col) => {
    // 底板
    const g = x.createLinearGradient(-r * 0.8, -r * 0.8, r * 0.8, r * 0.8);
    g.addColorStop(0, lightenColor(col, 0.32));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.42));
    x.fillStyle = g;
    rrPath(x, -r * 0.82, -r * 0.82, r * 1.64, r * 1.64, r * 0.18);
    x.fill();
    x.strokeStyle = 'rgba(15,15,25,.6)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 编织纹理：横竖交替丝束（裁剪进底板）
    x.save();
    rrPath(x, -r * 0.82, -r * 0.82, r * 1.64, r * 1.64, r * 0.18);
    x.clip();
    const n = 4, step = (r * 1.64) / n;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if ((i + j) % 2 === 0) continue;
        x.fillStyle = i % 2 ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.22)';
        x.fillRect(-r * 0.82 + i * step, -r * 0.82 + j * step, step, step);
      }
    }
    // 斜向纤维丝高光
    x.strokeStyle = 'rgba(255,255,255,.2)';
    x.lineWidth = Math.max(0.7, s * 0.028);
    for (let k = -3; k <= 3; k++) {
      x.beginPath();
      x.moveTo(-r * 0.9, k * r * 0.28 - r * 0.1);
      x.lineTo(r * 0.9, k * r * 0.28 - r * 0.9);
      x.stroke();
    }
    x.restore();
    // 斜向纤维束（突出主体）
    x.strokeStyle = 'rgba(235,240,250,.85)';
    x.lineCap = 'round';
    x.lineWidth = r * 0.11;
    x.beginPath();
    x.moveTo(-r * 0.48, r * 0.48);
    x.quadraticCurveTo(0, r * 0.1, r * 0.48, -r * 0.48);
    x.stroke();
    x.lineWidth = r * 0.07;
    x.beginPath();
    x.moveTo(-r * 0.44, r * 0.14);
    x.quadraticCurveTo(-r * 0.1, -r * 0.2, r * 0.18, -r * 0.5);
    x.stroke();
  },

  // 锂：银白色软金属小块（圆润晶体 + 淡紫光泽）
  'lithium': (x, r, s, col) => {
    const chunk = (cx, cy, w, h, rot) => {
      x.save();
      x.translate(cx, cy);
      x.rotate(rot || 0);
      const g = x.createLinearGradient(-w / 2, -h / 2, w / 2, h / 2);
      g.addColorStop(0, lightenColor(col, 0.45));
      g.addColorStop(0.55, col);
      g.addColorStop(1, darkenColor(col, 0.2));
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(-w * 0.42, -h * 0.28);
      x.lineTo(w * 0.05, -h * 0.5);
      x.lineTo(w * 0.46, -h * 0.1);
      x.lineTo(w * 0.32, h * 0.42);
      x.lineTo(-w * 0.28, h * 0.46);
      x.lineTo(-w * 0.48, h * 0.08);
      x.closePath();
      x.fill();
      x.strokeStyle = 'rgba(80,80,120,.5)';
      x.lineWidth = Math.max(0.7, s * 0.032);
      x.stroke();
      // 晶面高光
      x.fillStyle = 'rgba(255,255,255,.4)';
      x.beginPath();
      x.moveTo(-w * 0.28, -h * 0.24);
      x.lineTo(w * 0.02, -h * 0.4);
      x.lineTo(w * 0.2, -h * 0.12);
      x.lineTo(-w * 0.08, h * 0.02);
      x.closePath();
      x.fill();
      // 淡紫反光
      x.fillStyle = 'rgba(190,170,240,.28)';
      x.beginPath();
      x.moveTo(-w * 0.3, h * 0.3);
      x.lineTo(w * 0.2, h * 0.34);
      x.lineTo(w * 0.05, h * 0.44);
      x.lineTo(-w * 0.24, h * 0.42);
      x.closePath();
      x.fill();
      x.restore();
    };
    chunk(-r * 0.36, r * 0.3, r * 0.6, r * 0.46, 0.12);
    chunk(r * 0.4, r * 0.28, r * 0.52, r * 0.4, -0.18);
    chunk(0, -r * 0.18, r * 0.78, r * 0.62, 0.04);
  },

  // 锂板：淡紫银白金属板 + 高光与蚀刻 "Li" 字样
  'lithium-plate': (x, r, s, col) => {
    const g = x.createLinearGradient(-r * 0.85, -r * 0.55, r * 0.85, r * 0.55);
    g.addColorStop(0, lightenColor(col, 0.45));
    g.addColorStop(0.5, col);
    g.addColorStop(1, darkenColor(col, 0.26));
    x.fillStyle = g;
    rrPath(x, -r * 0.85, -r * 0.55, r * 1.7, r * 1.1, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(70,70,105,.55)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 顶部折光
    x.fillStyle = 'rgba(255,255,255,.45)';
    rrPath(x, -r * 0.85, -r * 0.55, r * 1.7, r * 0.24, r * 0.1);
    x.fill();
    // 底部暗部
    x.fillStyle = 'rgba(0,0,0,.16)';
    rrPath(x, -r * 0.85, r * 0.28, r * 1.7, r * 0.27, r * 0.1);
    x.fill();
    // 蚀刻 Li
    x.fillStyle = 'rgba(85,85,130,.5)';
    x.font = 'bold ' + Math.round(r * 0.5) + 'px system-ui';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('Li', 0, r * 0.06);
  },

  // 超导体：蓝色线圈环 + 中心闪电，电光质感
  'superconductor': (x, r, s, col) => {
    // 底部辉光
    const glow = x.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 0.95);
    glow.addColorStop(0, 'rgba(120,180,255,.5)');
    glow.addColorStop(1, 'rgba(120,180,255,0)');
    x.fillStyle = glow;
    x.beginPath(); x.arc(0, 0, r * 0.95, 0, 7); x.fill();
    // 超导线圈环（三层椭圆叠加成环形线圈）
    x.lineWidth = r * 0.16;
    x.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const ry = r * 0.62 - i * r * 0.06;
      const g = x.createLinearGradient(-r * 0.7, 0, r * 0.7, 0);
      g.addColorStop(0, lightenColor(col, 0.45));
      g.addColorStop(0.5, col);
      g.addColorStop(1, darkenColor(col, 0.4));
      x.strokeStyle = g;
      x.beginPath();
      x.ellipse(0, r * 0.42, r * 0.55, ry * 0.32, 0, Math.PI * 0.05, Math.PI * 0.95, i % 2 === 0);
      x.stroke();
    }
    // 立柱
    x.strokeStyle = darkenColor(col, 0.35);
    x.lineWidth = r * 0.13;
    x.beginPath();
    x.moveTo(-r * 0.42, r * 0.5);
    x.lineTo(-r * 0.42, -r * 0.35);
    x.moveTo(r * 0.42, r * 0.5);
    x.lineTo(r * 0.42, -r * 0.35);
    x.stroke();
    // 顶部电极帽
    x.fillStyle = lightenColor(col, 0.5);
    rrPath(x, -r * 0.58, -r * 0.62, r * 1.16, r * 0.3, r * 0.1);
    x.fill();
    x.strokeStyle = 'rgba(15,25,60,.6)';
    x.lineWidth = Math.max(0.8, s * 0.035);
    x.stroke();
    // 中心闪电
    x.fillStyle = '#fff';
    x.beginPath();
    x.moveTo(r * 0.06, -r * 0.5);
    x.lineTo(-r * 0.28, r * 0.02);
    x.lineTo(-r * 0.04, r * 0.02);
    x.lineTo(-r * 0.12, r * 0.5);
    x.lineTo(r * 0.28, -r * 0.1);
    x.lineTo(0.02 * r, -r * 0.1);
    x.closePath();
    x.fill();
  },

  // 统一药瓶造型：对应颜色即瓶内液体色（共享 _scienceBottle）
  'electromagnetic-science-pack': (x, r, s, col) => {
    // 对应颜色瓶子：颜色由 ITEMS[id].color 驱动
    _scienceBottle(x, r, s, col);
  },

  // 钬矿石：紫红色矿石粒（三颗带高光的矿粒，颜色对齐钬系）
  'holmium-ore': (x, r, s, col) => {
    const ore = (cx, cy, rad) => {
      const g = x.createLinearGradient(cx - rad, cy - rad, cx + rad, cy + rad);
      g.addColorStop(0, lightenColor(col, 0.42));
      g.addColorStop(0.55, col);
      g.addColorStop(1, darkenColor(col, 0.38));
      x.fillStyle = g;
      x.beginPath();
      // 不规则矿粒多边形
      const pts = 7;
      for (let i = 0; i < pts; i++) {
        const a = (i / pts) * Math.PI * 2 - Math.PI / 2;
        const rr = rad * (0.78 + ((i * 37) % 10) / 28);
        const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
        i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
      }
      x.closePath();
      x.fill();
      x.strokeStyle = 'rgba(45,25,40,.55)';
      x.lineWidth = Math.max(0.7, s * 0.032);
      x.stroke();
      // 高光
      x.fillStyle = 'rgba(255,235,250,.38)';
      x.beginPath();
      x.arc(cx - rad * 0.3, cy - rad * 0.32, rad * 0.3, 0, 7);
      x.fill();
      // 金属光泽点
      x.fillStyle = 'rgba(255,200,230,.3)';
      x.beginPath();
      x.arc(cx + rad * 0.24, cy + rad * 0.18, rad * 0.14, 0, 7);
      x.fill();
    };
    ore(-r * 0.4, r * 0.32, r * 0.32);
    ore(r * 0.42, r * 0.3, r * 0.28);
    ore(0.02 * r, -r * 0.14, r * 0.44);
  },

  // 钬溶液：粉紫色试管液体 + 悬浮矿粒气泡
  'holmium-solution': (x, r, s, col) => {
    // 试管轮廓
    const g = x.createLinearGradient(-r * 0.4, -r * 0.8, r * 0.4, r * 0.8);
    g.addColorStop(0, lightenColor(col, 0.42));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(-r * 0.36, -r * 0.88);
    x.lineTo(-r * 0.36, r * 0.5);
    x.quadraticCurveTo(-r * 0.36, r * 0.86, 0, r * 0.86);
    x.quadraticCurveTo(r * 0.36, r * 0.86, r * 0.36, r * 0.5);
    x.lineTo(r * 0.36, -r * 0.88);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(60,25,50,.6)';
    x.lineWidth = Math.max(1, s * 0.05);
    x.stroke();
    // 管口沿
    x.fillStyle = lightenColor(col, 0.55);
    rrPath(x, -r * 0.48, -r * 0.98, r * 0.96, r * 0.2, r * 0.08);
    x.fill();
    x.strokeStyle = 'rgba(60,25,50,.55)';
    x.stroke();
    // 液面
    x.fillStyle = 'rgba(255,255,255,.3)';
    x.beginPath();
    x.ellipse(0, r * 0.1, r * 0.3, r * 0.07, 0, 0, 7);
    x.fill();
    // 悬浮矿粒
    x.fillStyle = 'rgba(255,225,245,.65)';
    x.beginPath(); x.arc(-r * 0.14, r * 0.36, r * 0.07, 0, 7); x.fill();
    x.beginPath(); x.arc(r * 0.12, r * 0.55, r * 0.05, 0, 7); x.fill();
    x.beginPath(); x.arc(r * 0.02, r * 0.2, r * 0.045, 0, 7); x.fill();
  },

  // 钬板：紫红色金属板 + 高光折面与蚀刻 "Ho" 字样
  'holmium-plate': (x, r, s, col) => {
    const g = x.createLinearGradient(-r * 0.85, -r * 0.55, r * 0.85, r * 0.55);
    g.addColorStop(0, lightenColor(col, 0.42));
    g.addColorStop(0.5, col);
    g.addColorStop(1, darkenColor(col, 0.32));
    x.fillStyle = g;
    rrPath(x, -r * 0.85, -r * 0.55, r * 1.7, r * 1.1, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(55,25,45,.6)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 顶部折光
    x.fillStyle = 'rgba(255,255,255,.4)';
    rrPath(x, -r * 0.85, -r * 0.55, r * 1.7, r * 0.24, r * 0.1);
    x.fill();
    // 对角折面
    x.fillStyle = 'rgba(255,255,255,.14)';
    x.beginPath();
    x.moveTo(-r * 0.85, r * 0.1);
    x.lineTo(r * 0.1, -r * 0.55);
    x.lineTo(r * 0.85, -r * 0.55);
    x.lineTo(r * 0.85, -r * 0.2);
    x.lineTo(-r * 0.4, r * 0.55);
    x.lineTo(-r * 0.85, r * 0.55);
    x.closePath();
    x.fill();
    // 蚀刻 Ho
    x.fillStyle = 'rgba(70,30,55,.55)';
    x.font = 'bold ' + Math.round(r * 0.46) + 'px system-ui';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('Ho', 0, r * 0.12);
  },

  // 电解液：浅青色电池电解槽 + 正负极板 + 气泡
  'electrolyte': (x, r, s, col) => {
    // 电解槽体
    const g = x.createLinearGradient(-r * 0.8, -r * 0.7, r * 0.8, r * 0.8);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.3));
    x.fillStyle = g;
    rrPath(x, -r * 0.82, -r * 0.62, r * 1.64, r * 1.44, r * 0.16);
    x.fill();
    x.strokeStyle = 'rgba(30,70,75,.55)';
    x.lineWidth = Math.max(1, s * 0.05);
    x.stroke();
    // 槽口
    x.fillStyle = darkenColor(col, 0.42);
    rrPath(x, -r * 0.92, -r * 0.84, r * 1.84, r * 0.28, r * 0.1);
    x.fill();
    // 正负极板
    x.fillStyle = '#c9a24a';
    rrPath(x, -r * 0.5, -r * 0.4, r * 0.26, r * 1.02, r * 0.05);
    x.fill();
    x.fillStyle = '#a8b2bd';
    rrPath(x, r * 0.24, -r * 0.4, r * 0.26, r * 1.02, r * 0.05);
    x.fill();
    // 极板符号
    x.fillStyle = 'rgba(60,40,10,.8)';
    x.font = 'bold ' + Math.round(r * 0.22) + 'px system-ui';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('+', -r * 0.37, r * 0.42);
    x.fillStyle = 'rgba(40,45,50,.8)';
    x.fillText('−', r * 0.37, r * 0.42);
    // 电解气泡
    x.fillStyle = 'rgba(255,255,255,.6)';
    x.beginPath(); x.arc(-r * 0.05, r * 0.05, r * 0.06, 0, 7); x.fill();
    x.beginPath(); x.arc(r * 0.05, r * 0.28, r * 0.045, 0, 7); x.fill();
    x.beginPath(); x.arc(-r * 0.02, -r * 0.2, r * 0.05, 0, 7); x.fill();
  },

  // ===== Gleba 生物质 & Vulcanus 冶金批次（10 个） =====

  // 钨矿石：深灰矿石簇（三颗不规则矿粒 + 金属光泽），棱角比铁/铜矿更硬
  'tungsten-ore': (x, r, s, col) => {
    const ore = (cx, cy, rad) => {
      const g = x.createLinearGradient(cx - rad, cy - rad, cx + rad, cy + rad);
      g.addColorStop(0, lightenColor(col, 0.4));
      g.addColorStop(0.55, col);
      g.addColorStop(1, darkenColor(col, 0.42));
      x.fillStyle = g;
      x.beginPath();
      // 棱角分明的多边形矿粒
      const pts = 6;
      for (let i = 0; i < pts; i++) {
        const a = (i / pts) * Math.PI * 2 - Math.PI / 2;
        const rr = rad * (0.72 + ((i * 53) % 10) / 24);
        const px = cx + Math.cos(a) * rr, py = cy + Math.sin(a) * rr;
        i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
      }
      x.closePath();
      x.fill();
      x.strokeStyle = 'rgba(20,20,28,.6)';
      x.lineWidth = Math.max(0.7, s * 0.032);
      x.stroke();
      // 切面高光（硬朗直线切面，体现钨的坚硬）
      x.fillStyle = 'rgba(255,255,255,.3)';
      x.beginPath();
      x.moveTo(cx - rad * 0.5, cy - rad * 0.15);
      x.lineTo(cx - rad * 0.1, cy - rad * 0.5);
      x.lineTo(cx + rad * 0.15, cy - rad * 0.15);
      x.lineTo(cx - rad * 0.2, cy + rad * 0.05);
      x.closePath();
      x.fill();
      // 金属光泽点
      x.fillStyle = 'rgba(255,255,255,.18)';
      x.beginPath();
      x.arc(cx + rad * 0.3, cy + rad * 0.2, rad * 0.13, 0, 7);
      x.fill();
    };
    ore(-r * 0.42, r * 0.3, r * 0.3);
    ore(r * 0.42, r * 0.28, r * 0.28);
    ore(0.02 * r, -r * 0.12, r * 0.44);
  },

  // 钨板：厚重深灰金属板 + 铆钉四角 + 蚀刻 W
  'tungsten-plate': (x, r, s, col) => {
    const g = x.createLinearGradient(-r * 0.85, -r * 0.55, r * 0.85, r * 0.55);
    g.addColorStop(0, lightenColor(col, 0.42));
    g.addColorStop(0.5, col);
    g.addColorStop(1, darkenColor(col, 0.32));
    x.fillStyle = g;
    rrPath(x, -r * 0.85, -r * 0.55, r * 1.7, r * 1.1, r * 0.1);
    x.fill();
    x.strokeStyle = 'rgba(35,35,45,.6)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 顶部折光
    x.fillStyle = 'rgba(255,255,255,.4)';
    rrPath(x, -r * 0.85, -r * 0.55, r * 1.7, r * 0.24, r * 0.08);
    x.fill();
    // 底部暗部
    x.fillStyle = 'rgba(0,0,0,.2)';
    rrPath(x, -r * 0.85, r * 0.28, r * 1.7, r * 0.27, r * 0.08);
    x.fill();
    // 四角铆钉（厚重装甲质感，区别于普通板材）
    x.fillStyle = 'rgba(220,224,232,.85)';
    for (const [px, py] of [[-0.68, -0.38], [0.68, -0.38], [-0.68, 0.38], [0.68, 0.38]]) {
      x.beginPath(); x.arc(px * r, py * r, r * 0.07, 0, 7); x.fill();
      x.strokeStyle = 'rgba(40,40,50,.6)';
      x.lineWidth = Math.max(0.6, s * 0.025);
      x.stroke();
    }
    // 蚀刻 W
    x.fillStyle = 'rgba(40,40,55,.55)';
    x.font = 'bold ' + Math.round(r * 0.52) + 'px system-ui';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('W', 0, r * 0.06);
  },

  // 碳化钨：六角螺栓头 + 金属灰渐变 + 硬质高光，体现超硬合金
  'tungsten-carbide': (x, r, s, col) => {
    const g = x.createLinearGradient(-r * 0.7, -r * 0.8, r * 0.7, r * 0.7);
    g.addColorStop(0, lightenColor(col, 0.45));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    // 六角螺帽外形
    x.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 - Math.PI / 2;
      const px = Math.cos(a) * r * 0.78, py = Math.sin(a) * r * 0.78;
      i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    }
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(30,30,42,.65)';
    x.lineWidth = Math.max(1, s * 0.05);
    x.stroke();
    // 内圈倒角
    x.strokeStyle = 'rgba(255,255,255,.22)';
    x.lineWidth = Math.max(0.8, s * 0.035);
    x.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 - Math.PI / 2;
      const px = Math.cos(a) * r * 0.6, py = Math.sin(a) * r * 0.6;
      i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    }
    x.closePath();
    x.stroke();
    // 中心圆孔（螺栓孔）
    const hole = x.createRadialGradient(0, -r * 0.05, r * 0.05, 0, 0, r * 0.3);
    hole.addColorStop(0, 'rgba(15,15,22,.9)');
    hole.addColorStop(1, 'rgba(15,15,22,.55)');
    x.fillStyle = hole;
    x.beginPath(); x.arc(0, 0, r * 0.28, 0, 7); x.fill();
    // 顶部高光
    x.fillStyle = 'rgba(255,255,255,.3)';
    x.beginPath();
    x.moveTo(-r * 0.55, -r * 0.32);
    x.lineTo(-r * 0.1, -r * 0.62);
    x.lineTo(r * 0.28, -r * 0.4);
    x.lineTo(-r * 0.2, -r * 0.12);
    x.closePath();
    x.fill();
  },

  // 统一药瓶造型：对应颜色即瓶内液体色（共享 _scienceBottle）
  'metallurgic-science-pack': (x, r, s, col) => {
    // 对应颜色瓶子：颜色由 ITEMS[id].color 驱动
    _scienceBottle(x, r, s, col);
  },

  // 玉玛果：菠萝状果体（鳞片网格 + 顶部叶冠）
  'yumako': (x, r, s, col) => {
    // 果体（竖椭圆）
    const g = x.createLinearGradient(-r * 0.5, -r * 0.2, r * 0.5, r * 0.85);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.38));
    x.fillStyle = g;
    x.beginPath();
    x.ellipse(0, r * 0.22, r * 0.55, r * 0.6, 0, 0, 7);
    x.fill();
    x.strokeStyle = 'rgba(90,55,10,.6)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 鳞片斜向网格
    x.strokeStyle = 'rgba(110,65,10,.4)';
    x.lineWidth = Math.max(0.7, s * 0.03);
    x.save();
    x.beginPath();
    x.ellipse(0, r * 0.22, r * 0.55, r * 0.6, 0, 0, 7);
    x.clip();
    for (let i = -3; i <= 3; i++) {
      x.beginPath();
      x.moveTo(i * r * 0.28 - r * 0.3, -r * 0.5);
      x.lineTo(i * r * 0.28 + r * 0.3, r * 0.95);
      x.moveTo(i * r * 0.28 + r * 0.3, -r * 0.5);
      x.lineTo(i * r * 0.28 - r * 0.3, r * 0.95);
      x.stroke();
    }
    x.restore();
    // 顶部叶冠（三片尖叶）
    x.fillStyle = '#4a9e3f';
    for (const [dx, rot, len] of [[-0.18, -0.5, 0.42], [0.18, 0.5, 0.42], [0, 0, 0.55]]) {
      x.save();
      x.translate(dx * r, -r * 0.34);
      x.rotate(rot);
      x.beginPath();
      x.moveTo(0, 0);
      x.quadraticCurveTo(r * 0.1, -len * r * 0.6, 0, -len * r);
      x.quadraticCurveTo(-r * 0.1, -len * r * 0.6, 0, 0);
      x.closePath();
      x.fill();
      x.restore();
    }
    // 高光
    x.fillStyle = 'rgba(255,240,190,.35)';
    x.beginPath();
    x.ellipse(-r * 0.22, -r * 0.05, r * 0.14, r * 0.22, -0.5, 0, 7);
    x.fill();
  },

  // 玉玛果种子：褐色种子（椭圆种体 + 芽点 + 种脐纹）
  'yumako-seed': (x, r, s, col) => {
    const g = x.createLinearGradient(-r * 0.4, -r * 0.6, r * 0.4, r * 0.6);
    g.addColorStop(0, lightenColor(col, 0.38));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.42));
    x.fillStyle = g;
    x.beginPath();
    x.ellipse(0, r * 0.08, r * 0.42, r * 0.56, 0.15, 0, 7);
    x.fill();
    x.strokeStyle = 'rgba(80,45,10,.65)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 种脐弧线
    x.strokeStyle = 'rgba(80,45,10,.45)';
    x.lineWidth = Math.max(0.7, s * 0.028);
    x.beginPath();
    x.ellipse(0, r * 0.08, r * 0.26, r * 0.4, 0.15, 0.6, Math.PI - 0.6);
    x.stroke();
    // 顶部芽点
    x.fillStyle = '#6fae4a';
    x.beginPath();
    x.moveTo(r * 0.02, -r * 0.5);
    x.quadraticCurveTo(r * 0.22, -r * 0.78, r * 0.34, -r * 0.62);
    x.quadraticCurveTo(r * 0.2, -r * 0.52, r * 0.1, -r * 0.44);
    x.closePath();
    x.fill();
    // 高光
    x.fillStyle = 'rgba(255,230,180,.4)';
    x.beginPath();
    x.ellipse(-r * 0.16, -r * 0.18, r * 0.1, r * 0.18, -0.4, 0, 7);
    x.fill();
  },

  // 玉玛果泥：木碗盛果泥（果泥堆顶 + 滴落质感）
  'yumako-mash': (x, r, s, col) => {
    // 木碗下半
    const bowl = x.createLinearGradient(0, r * 0.1, 0, r * 0.85);
    bowl.addColorStop(0, '#b08a55');
    bowl.addColorStop(1, '#7a5a32');
    x.fillStyle = bowl;
    x.beginPath();
    x.moveTo(-r * 0.72, r * 0.18);
    x.lineTo(r * 0.72, r * 0.18);
    x.quadraticCurveTo(r * 0.6, r * 0.85, 0, r * 0.85);
    x.quadraticCurveTo(-r * 0.6, r * 0.85, -r * 0.72, r * 0.18);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(60,38,15,.6)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 碗沿
    x.fillStyle = '#c8a068';
    rrPath(x, -r * 0.78, r * 0.08, r * 1.56, r * 0.2, r * 0.1);
    x.fill();
    x.strokeStyle = 'rgba(60,38,15,.5)';
    x.lineWidth = Math.max(0.7, s * 0.03);
    x.stroke();
    // 果泥堆（圆丘，从碗口鼓出）
    const mash = x.createLinearGradient(-r * 0.4, -r * 0.35, r * 0.3, r * 0.2);
    mash.addColorStop(0, lightenColor(col, 0.42));
    mash.addColorStop(1, darkenColor(col, 0.22));
    x.fillStyle = mash;
    x.beginPath();
    x.moveTo(-r * 0.68, r * 0.12);
    x.quadraticCurveTo(-r * 0.5, -r * 0.42, 0, -r * 0.42);
    x.quadraticCurveTo(r * 0.5, -r * 0.42, r * 0.68, r * 0.12);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(120,70,10,.5)';
    x.lineWidth = Math.max(0.8, s * 0.032);
    x.stroke();
    // 泥面果粒
    x.fillStyle = 'rgba(150,90,20,.55)';
    for (const [px, py, pr] of [[-0.3, -0.05, 0.07], [0.12, -0.18, 0.06], [0.34, 0.0, 0.05], [-0.06, -0.28, 0.05]]) {
      x.beginPath(); x.arc(px * r, py * r, pr * r, 0, 7); x.fill();
    }
    // 高光
    x.fillStyle = 'rgba(255,240,200,.4)';
    x.beginPath();
    x.ellipse(-r * 0.3, -r * 0.24, r * 0.14, r * 0.07, -0.4, 0, 7);
    x.fill();
  },

  // 生物结晶：绿色晶体簇（主晶菱柱 + 两颗小晶体 + 内部光晕）
  'bioflux': (x, r, s, col) => {
    // 底部光晕
    const glow = x.createRadialGradient(0, r * 0.15, r * 0.05, 0, r * 0.15, r * 0.9);
    glow.addColorStop(0, 'rgba(70,220,150,.35)');
    glow.addColorStop(1, 'rgba(70,220,150,0)');
    x.fillStyle = glow;
    x.beginPath(); x.arc(0, r * 0.15, r * 0.9, 0, 7); x.fill();
    // 主晶体（竖菱柱，斜切顶）
    const crystal = (cx, cy, w, h, rot) => {
      x.save();
      x.translate(cx, cy);
      x.rotate(rot);
      const g = x.createLinearGradient(-w, 0, w, 0);
      g.addColorStop(0, lightenColor(col, 0.45));
      g.addColorStop(0.5, col);
      g.addColorStop(1, darkenColor(col, 0.4));
      x.fillStyle = g;
      x.beginPath();
      x.moveTo(0, -h);
      x.lineTo(w, -h * 0.35);
      x.lineTo(w * 0.7, h);
      x.lineTo(-w * 0.7, h);
      x.lineTo(-w, -h * 0.35);
      x.closePath();
      x.fill();
      x.strokeStyle = 'rgba(15,70,45,.6)';
      x.lineWidth = Math.max(0.8, s * 0.035);
      x.stroke();
      // 中棱线
      x.strokeStyle = 'rgba(255,255,255,.3)';
      x.lineWidth = Math.max(0.6, s * 0.025);
      x.beginPath();
      x.moveTo(0, -h);
      x.lineTo(0, h);
      x.stroke();
      x.restore();
    };
    crystal(-r * 0.4, r * 0.18, r * 0.22, r * 0.4, -0.2);
    crystal(r * 0.42, r * 0.22, r * 0.18, r * 0.32, 0.25);
    crystal(0.02 * r, -r * 0.1, r * 0.3, r * 0.58, 0);
    // 晶面高光
    x.fillStyle = 'rgba(240,255,245,.4)';
    x.beginPath();
    x.moveTo(-r * 0.08, -r * 0.5);
    x.lineTo(r * 0.06, -r * 0.28);
    x.lineTo(-r * 0.04, r * 0.1);
    x.lineTo(-r * 0.16, -r * 0.2);
    x.closePath();
    x.fill();
  },

  // 营养素：胶囊营养块（黄绿颗粒堆 + 光泽）
  'nutrients': (x, r, s, col) => {
    // 三颗椭圆营养粒堆叠
    const pellet = (cx, cy, rad, rot) => {
      x.save();
      x.translate(cx, cy);
      x.rotate(rot);
      const g = x.createLinearGradient(-rad, -rad, rad, rad);
      g.addColorStop(0, lightenColor(col, 0.42));
      g.addColorStop(0.55, col);
      g.addColorStop(1, darkenColor(col, 0.4));
      x.fillStyle = g;
      x.beginPath();
      x.ellipse(0, 0, rad * 1.15, rad * 0.75, 0, 0, 7);
      x.fill();
      x.strokeStyle = 'rgba(40,60,25,.55)';
      x.lineWidth = Math.max(0.8, s * 0.035);
      x.stroke();
      // 高光
      x.fillStyle = 'rgba(255,255,230,.4)';
      x.beginPath();
      x.ellipse(-rad * 0.35, -rad * 0.22, rad * 0.32, rad * 0.14, -0.4, 0, 7);
      x.fill();
      x.restore();
    };
    pellet(-r * 0.3, r * 0.28, r * 0.3, -0.15);
    pellet(r * 0.3, r * 0.3, r * 0.28, 0.2);
    pellet(0, -r * 0.18, r * 0.36, 0.05);
  },

  // 变质物：腐坏团块（不规则褐团 + 腐斑 + 臭气泡）
  'spoilage': (x, r, s, col) => {
    // 不规则腐坏团块
    const g = x.createLinearGradient(-r * 0.6, -r * 0.6, r * 0.5, r * 0.6);
    g.addColorStop(0, lightenColor(col, 0.3));
    g.addColorStop(0.6, col);
    g.addColorStop(1, darkenColor(col, 0.42));
    x.fillStyle = g;
    x.beginPath();
    // 凹凸不规则轮廓
    const pts = 9;
    for (let i = 0; i < pts; i++) {
      const a = (i / pts) * Math.PI * 2 - Math.PI / 2;
      const rr = r * (0.55 + ((i * 71) % 10) / 26);
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr * 0.9;
      i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    }
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(55,45,20,.6)';
    x.lineWidth = Math.max(0.8, s * 0.035);
    x.stroke();
    // 腐斑
    x.fillStyle = 'rgba(90,80,35,.55)';
    for (const [px, py, pr] of [[-0.25, -0.1, 0.11], [0.22, -0.2, 0.08], [0.05, 0.2, 0.09], [-0.05, -0.32, 0.06]]) {
      x.beginPath(); x.arc(px * r, py * r, pr * r, 0, 7); x.fill();
    }
    // 表面褶皱
    x.strokeStyle = 'rgba(60,50,22,.4)';
    x.lineWidth = Math.max(0.6, s * 0.025);
    x.beginPath();
    x.moveTo(-r * 0.35, r * 0.08);
    x.quadraticCurveTo(0, -r * 0.05, r * 0.35, r * 0.05);
    x.moveTo(-r * 0.2, r * 0.3);
    x.quadraticCurveTo(r * 0.05, r * 0.2, r * 0.28, r * 0.3);
    x.stroke();
    // 臭气泡（变质暗示：上浮小气泡）
    x.strokeStyle = 'rgba(160,200,120,.7)';
    x.lineWidth = Math.max(0.7, s * 0.028);
    for (const [px, py, pr] of [[0.45, -0.5, 0.07], [0.6, -0.68, 0.045]]) {
      x.beginPath(); x.arc(px * r, py * r, pr * r, 0, 7); x.stroke();
    }
  },

// 超级电容：黄色储能圆柱电芯 + 顶端正负极 + 电解液能量窗口
'supercapacitor': (x, r, s, col) => {
  // 电芯筒身（竖圆柱）
  const g = x.createLinearGradient(-r * 0.55, 0, r * 0.55, 0);
  g.addColorStop(0, lightenColor(col, 0.42));
  g.addColorStop(0.45, col);
  g.addColorStop(1, darkenColor(col, 0.4));
  x.fillStyle = g;
  rrPath(x, -r * 0.55, -r * 0.72, r * 1.1, r * 1.44, r * 0.16);
  x.fill();
  x.strokeStyle = 'rgba(70,62,8,.65)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 顶部封装盖
  x.fillStyle = '#b8bcc4';
  rrPath(x, -r * 0.55, -r * 0.86, r * 1.1, r * 0.26, r * 0.1);
  x.fill();
  x.strokeStyle = 'rgba(50,54,60,.6)';
  x.stroke();
  // 正负极帽
  x.fillStyle = '#d84848';
  x.beginPath(); x.arc(-r * 0.24, -r * 0.73, r * 0.1, 0, 7); x.fill();
  x.fillStyle = '#4848d8';
  x.beginPath(); x.arc(r * 0.24, -r * 0.73, r * 0.1, 0, 7); x.fill();
  // 能量窗口（闪电）
  x.fillStyle = 'rgba(255,255,240,.9)';
  x.beginPath();
  x.moveTo(r * 0.08, -r * 0.3);
  x.lineTo(-r * 0.22, r * 0.1);
  x.lineTo(-r * 0.02, r * 0.1);
  x.lineTo(-r * 0.1, r * 0.44);
  x.lineTo(r * 0.22, -r * 0.02);
  x.lineTo(r * 0.02, -r * 0.02);
  x.closePath();
  x.fill();
  // 筒身环纹
  x.strokeStyle = 'rgba(70,62,8,.4)';
  x.lineWidth = Math.max(0.7, s * 0.03);
  x.beginPath();
  x.moveTo(-r * 0.55, r * 0.52); x.lineTo(r * 0.55, r * 0.52);
  x.stroke();
},

// 统一药瓶造型：对应颜色即瓶内液体色（共享 _scienceBottle）
'agricultural-science-pack': (x, r, s, col) => {
  // 对应颜色瓶子：颜色由 ITEMS[id].color 驱动
  _scienceBottle(x, r, s, col);
},

// 果冻果：紫红圆果 + 顶部果脐 + 汁液高光（Gleba 作物）
'jellynut': (x, r, s, col) => {
  // 果体（圆中略扁）
  const g = x.createRadialGradient(-r * 0.2, -r * 0.3, r * 0.1, 0, r * 0.1, r * 0.85);
  g.addColorStop(0, lightenColor(col, 0.45));
  g.addColorStop(0.55, col);
  g.addColorStop(1, darkenColor(col, 0.42));
  x.fillStyle = g;
  x.beginPath();
  x.ellipse(0, r * 0.1, r * 0.68, r * 0.62, 0, 0, 7);
  x.fill();
  x.strokeStyle = 'rgba(90,25,45,.65)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 果蒂
  x.fillStyle = '#5a7a3a';
  rrPath(x, -r * 0.06, -r * 0.66, r * 0.12, r * 0.2, r * 0.05);
  x.fill();
  // 果脐凹点
  x.fillStyle = 'rgba(90,25,45,.55)';
  x.beginPath(); x.arc(0, -r * 0.5, r * 0.1, 0, 7); x.fill();
  // 汁液高光
  x.fillStyle = 'rgba(255,220,235,.55)';
  x.beginPath();
  x.ellipse(-r * 0.24, -r * 0.14, r * 0.16, r * 0.24, -0.5, 0, 7);
  x.fill();
  x.beginPath();
  x.arc(r * 0.05, -r * 0.4, r * 0.07, 0, 7);
  x.fill();
},

// 果冻果种子：紫红种体 + 芽点 + 种脐纹（呼应玉玛果种子家族造型）
'jellynut-seed': (x, r, s, col) => {
  const g = x.createLinearGradient(-r * 0.4, -r * 0.6, r * 0.4, r * 0.6);
  g.addColorStop(0, lightenColor(col, 0.38));
  g.addColorStop(0.55, col);
  g.addColorStop(1, darkenColor(col, 0.42));
  x.fillStyle = g;
  x.beginPath();
  x.ellipse(0, r * 0.08, r * 0.42, r * 0.56, 0.15, 0, 7);
  x.fill();
  x.strokeStyle = 'rgba(80,15,45,.65)';
  x.lineWidth = Math.max(1, s * 0.04);
  x.stroke();
  // 种脐弧线
  x.strokeStyle = 'rgba(80,15,45,.45)';
  x.lineWidth = Math.max(0.7, s * 0.028);
  x.beginPath();
  x.ellipse(0, r * 0.08, r * 0.26, r * 0.4, 0.15, 0.6, Math.PI - 0.6);
  x.stroke();
  // 顶部芽点
  x.fillStyle = '#7ab050';
  x.beginPath();
  x.moveTo(r * 0.02, -r * 0.5);
  x.quadraticCurveTo(r * 0.22, -r * 0.78, r * 0.34, -r * 0.62);
  x.quadraticCurveTo(r * 0.2, -r * 0.52, r * 0.1, -r * 0.44);
  x.closePath();
  x.fill();
  // 高光
  x.fillStyle = 'rgba(255,210,230,.4)';
  x.beginPath();
  x.ellipse(-r * 0.16, -r * 0.18, r * 0.1, r * 0.18, -0.4, 0, 7);
  x.fill();
},

// 果冻：粉红半透明颤动果冻 + 顶面高光 + 底部碟影
'jelly': (x, r, s, col) => {
  // 底碟阴影
  x.fillStyle = 'rgba(120,30,80,.25)';
  x.beginPath();
  x.ellipse(0, r * 0.66, r * 0.7, r * 0.14, 0, 0, 7);
  x.fill();
  // 果冻主体（圆顶扁平塔，边缘内收）
  const g = x.createLinearGradient(-r * 0.5, -r * 0.5, r * 0.4, r * 0.6);
  g.addColorStop(0, lightenColor(col, 0.4));
  g.addColorStop(0.6, col);
  g.addColorStop(1, darkenColor(col, 0.28));
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(-r * 0.62, r * 0.6);
  x.quadraticCurveTo(-r * 0.72, r * 0.2, -r * 0.3, r * 0.05);
  x.quadraticCurveTo(-r * 0.3, -r * 0.62, 0, -r * 0.62);
  x.quadraticCurveTo(r * 0.3, -r * 0.62, r * 0.3, r * 0.05);
  x.quadraticCurveTo(r * 0.72, r * 0.2, r * 0.62, r * 0.6);
  x.quadraticCurveTo(0, r * 0.74, -r * 0.62, r * 0.6);
  x.closePath();
  x.fill();
  x.strokeStyle = 'rgba(140,25,85,.55)';
  x.lineWidth = Math.max(1, s * 0.04);
  x.stroke();
  // 果冻波浪底边
  x.strokeStyle = 'rgba(255,255,255,.4)';
  x.lineWidth = Math.max(0.8, s * 0.03);
  x.beginPath();
  x.moveTo(-r * 0.5, r * 0.5);
  x.quadraticCurveTo(-r * 0.25, r * 0.42, 0, r * 0.5);
  x.quadraticCurveTo(r * 0.25, r * 0.58, r * 0.5, r * 0.5);
  x.stroke();
  // 玻璃质感高光
  x.fillStyle = 'rgba(255,255,255,.55)';
  x.beginPath();
  x.ellipse(-r * 0.16, -r * 0.28, r * 0.1, r * 0.2, -0.3, 0, 7);
  x.fill();
  x.beginPath();
  x.arc(r * 0.1, -r * 0.42, r * 0.06, 0, 7);
  x.fill();
},

// 异虫卵：褐色卵体 + 深色斑点 + 顶部裂纹（孵化暗示）
'biter-egg': (x, r, s, col) => {
  const g = x.createRadialGradient(-r * 0.18, -r * 0.3, r * 0.08, 0, r * 0.1, r * 0.85);
  g.addColorStop(0, lightenColor(col, 0.42));
  g.addColorStop(0.55, col);
  g.addColorStop(1, darkenColor(col, 0.45));
  x.fillStyle = g;
  x.beginPath();
  x.ellipse(0, r * 0.14, r * 0.52, r * 0.68, 0, 0, 7);
  x.fill();
  x.strokeStyle = 'rgba(60,42,12,.7)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 斑点
  x.fillStyle = 'rgba(70,50,15,.5)';
  for (const [px, py, pr] of [[-0.2, 0.1, 0.09], [0.16, 0.3, 0.07], [0.1, -0.15, 0.06], [-0.12, 0.42, 0.05]]) {
    x.beginPath(); x.arc(px * r, py * r, pr * r, 0, 7); x.fill();
  }
  // 顶部裂纹（之字形）
  x.strokeStyle = 'rgba(40,28,6,.8)';
  x.lineWidth = Math.max(0.9, s * 0.035);
  x.lineJoin = 'round';
  x.beginPath();
  x.moveTo(-r * 0.12, -r * 0.66);
  x.lineTo(-r * 0.02, -r * 0.52);
  x.lineTo(-r * 0.14, -r * 0.42);
  x.lineTo(0, -r * 0.3);
  x.stroke();
  // 裂纹透光
  x.fillStyle = 'rgba(255,240,200,.5)';
  x.beginPath(); x.arc(-r * 0.02, -r * 0.52, r * 0.05, 0, 7); x.fill();
},

// 五足虫卵：红褐卵体 + 内部五条卷曲足影（半透明胚胎感）
'pentapod-egg': (x, r, s, col) => {
  const g = x.createRadialGradient(-r * 0.18, -r * 0.28, r * 0.08, 0, r * 0.1, r * 0.85);
  g.addColorStop(0, lightenColor(col, 0.4));
  g.addColorStop(0.55, col);
  g.addColorStop(1, darkenColor(col, 0.45));
  x.fillStyle = g;
  x.beginPath();
  x.ellipse(0, r * 0.12, r * 0.52, r * 0.66, 0, 0, 7);
  x.fill();
  x.strokeStyle = 'rgba(70,32,22,.7)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 内部胚胎足影（五条卷须，半透明）
  x.save();
  x.beginPath();
  x.ellipse(0, r * 0.12, r * 0.52, r * 0.66, 0, 0, 7);
  x.clip();
  x.strokeStyle = 'rgba(90,35,25,.55)';
  x.lineWidth = Math.max(1, s * 0.04);
  x.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + i * (Math.PI * 2 / 5);
    const px = Math.cos(a) * r * 0.22, py = r * 0.12 + Math.sin(a) * r * 0.22;
    x.beginPath();
    x.arc(px, py, r * 0.12, a + Math.PI * 0.3, a + Math.PI * 1.4);
    x.stroke();
  }
  // 中央胚胎核
  x.fillStyle = 'rgba(255,220,200,.4)';
  x.beginPath(); x.arc(0, r * 0.12, r * 0.12, 0, 7); x.fill();
  x.restore();
  // 表面高光
  x.fillStyle = 'rgba(255,235,220,.35)';
  x.beginPath();
  x.ellipse(-r * 0.2, -r * 0.2, r * 0.12, r * 0.2, -0.4, 0, 7);
  x.fill();
},

// 树种子：褐色坚果 + 顶部双叶新芽（绿化造林意象）
'tree-seed': (x, r, s, col) => {
  // 种体（圆润坚果）
  const g = x.createLinearGradient(-r * 0.35, -r * 0.4, r * 0.35, r * 0.6);
  g.addColorStop(0, lightenColor(col, 0.42));
  g.addColorStop(0.55, col);
  g.addColorStop(1, darkenColor(col, 0.4));
  x.fillStyle = g;
  x.beginPath();
  x.ellipse(0, r * 0.22, r * 0.44, r * 0.5, 0, 0, 7);
  x.fill();
  x.strokeStyle = 'rgba(40,58,32,.7)';
  x.lineWidth = Math.max(1, s * 0.04);
  x.stroke();
  // 壳纹
  x.strokeStyle = 'rgba(40,58,32,.4)';
  x.lineWidth = Math.max(0.7, s * 0.028);
  x.beginPath();
  x.moveTo(-r * 0.3, r * 0.05);
  x.quadraticCurveTo(0, r * 0.16, r * 0.3, r * 0.05);
  x.stroke();
  // 双叶新芽
  x.fillStyle = '#5a9e42';
  for (const sgn of [-1, 1]) {
    x.save();
    x.translate(sgn * r * 0.08, -r * 0.34);
    x.rotate(sgn * 0.6);
    x.beginPath();
    x.moveTo(0, 0);
    x.quadraticCurveTo(sgn * r * 0.22, -r * 0.1, sgn * r * 0.3, -r * 0.34);
    x.quadraticCurveTo(sgn * r * 0.06, -r * 0.3, 0, 0);
    x.closePath();
    x.fill();
    x.restore();
  }
  // 芽茎
  x.strokeStyle = '#4a7e36';
  x.lineWidth = Math.max(1, s * 0.04);
  x.beginPath();
  x.moveTo(0, r * 0.0 - r * 0.14);
  x.lineTo(0, -r * 0.3);
  x.stroke();
  // 高光
  x.fillStyle = 'rgba(255,240,200,.35)';
  x.beginPath();
  x.ellipse(-r * 0.16, r * 0.1, r * 0.1, r * 0.18, -0.4, 0, 7);
  x.fill();
},

// 铁细菌：银灰菌团 + 鞭毛 + 铁锈斑点（生物炼铁意象）
'iron-bacteria': (x, r, s, col) => {
  // 菌体（肾形团块）
  const g = x.createRadialGradient(-r * 0.15, -r * 0.2, r * 0.06, 0, r * 0.08, r * 0.8);
  g.addColorStop(0, lightenColor(col, 0.5));
  g.addColorStop(0.6, col);
  g.addColorStop(1, darkenColor(col, 0.4));
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(-r * 0.6, r * 0.15);
  x.quadraticCurveTo(-r * 0.7, -r * 0.45, -r * 0.1, -r * 0.45);
  x.quadraticCurveTo(r * 0.55, -r * 0.5, r * 0.62, r * 0.02);
  x.quadraticCurveTo(r * 0.66, r * 0.5, 0, r * 0.5);
  x.quadraticCurveTo(-r * 0.55, r * 0.52, -r * 0.6, r * 0.15);
  x.closePath();
  x.fill();
  x.strokeStyle = 'rgba(50,55,64,.7)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 细胞核
  x.fillStyle = 'rgba(90,98,110,.6)';
  x.beginPath(); x.arc(r * 0.12, r * 0.0, r * 0.16, 0, 7); x.fill();
  // 铁锈斑点
  x.fillStyle = 'rgba(150,96,60,.65)';
  for (const [px, py, pr] of [[-0.3, -0.1, 0.08], [0.32, 0.22, 0.06], [-0.1, 0.28, 0.05]]) {
    x.beginPath(); x.arc(px * r, py * r, pr * r, 0, 7); x.fill();
  }
  // 鞭毛（两侧摆动纤毛）
  x.strokeStyle = 'rgba(90,98,110,.75)';
  x.lineWidth = Math.max(0.8, s * 0.032);
  x.lineCap = 'round';
  for (const sgn of [-1, 1]) {
    x.beginPath();
    x.moveTo(sgn * r * 0.58, r * 0.1);
    x.quadraticCurveTo(sgn * r * 0.85, r * 0.2, sgn * r * 0.8, -r * 0.15);
    x.stroke();
  }
  // 表面高光
  x.fillStyle = 'rgba(255,255,255,.4)';
  x.beginPath();
  x.ellipse(-r * 0.22, -r * 0.25, r * 0.14, r * 0.08, -0.4, 0, 7);
  x.fill();
},

// 铜细菌：铜橙菌团 + 鞭毛 + 铜绿斑点（生物炼铜意象，与铁细菌同构换色）
'copper-bacteria': (x, r, s, col) => {
  const g = x.createRadialGradient(-r * 0.15, -r * 0.2, r * 0.06, 0, r * 0.08, r * 0.8);
  g.addColorStop(0, lightenColor(col, 0.42));
  g.addColorStop(0.6, col);
  g.addColorStop(1, darkenColor(col, 0.42));
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(-r * 0.6, r * 0.15);
  x.quadraticCurveTo(-r * 0.7, -r * 0.45, -r * 0.1, -r * 0.45);
  x.quadraticCurveTo(r * 0.55, -r * 0.5, r * 0.62, r * 0.02);
  x.quadraticCurveTo(r * 0.66, r * 0.5, 0, r * 0.5);
  x.quadraticCurveTo(-r * 0.55, r * 0.52, -r * 0.6, r * 0.15);
  x.closePath();
  x.fill();
  x.strokeStyle = 'rgba(78,42,22,.7)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 细胞核
  x.fillStyle = 'rgba(110,64,38,.55)';
  x.beginPath(); x.arc(r * 0.12, r * 0.0, r * 0.16, 0, 7); x.fill();
  // 铜绿斑点
  x.fillStyle = 'rgba(70,150,120,.6)';
  for (const [px, py, pr] of [[-0.3, -0.1, 0.08], [0.32, 0.22, 0.06], [-0.1, 0.28, 0.05]]) {
    x.beginPath(); x.arc(px * r, py * r, pr * r, 0, 7); x.fill();
  }
  // 鞭毛
  x.strokeStyle = 'rgba(110,64,38,.75)';
  x.lineWidth = Math.max(0.8, s * 0.032);
  x.lineCap = 'round';
  for (const sgn of [-1, 1]) {
    x.beginPath();
    x.moveTo(sgn * r * 0.58, r * 0.1);
    x.quadraticCurveTo(sgn * r * 0.85, r * 0.2, sgn * r * 0.8, -r * 0.15);
    x.stroke();
  }
  // 高光
  x.fillStyle = 'rgba(255,240,220,.4)';
  x.beginPath();
  x.ellipse(-r * 0.22, -r * 0.25, r * 0.14, r * 0.08, -0.4, 0, 7);
  x.fill();
},

// 冰：半透明冰晶体簇（多面棱柱 + 高光折射线）
'ice': (x, r, s, col) => {
  // 主晶体（竖立六棱柱正面）
  const g = x.createLinearGradient(-r * 0.4, -r * 0.7, r * 0.4, r * 0.7);
  g.addColorStop(0, lightenColor(col, 0.45));
  g.addColorStop(0.55, col);
  g.addColorStop(1, darkenColor(col, 0.28));
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(-r * 0.34, -r * 0.3);
  x.lineTo(0, -r * 0.62);
  x.lineTo(r * 0.34, -r * 0.3);
  x.lineTo(r * 0.34, r * 0.5);
  x.lineTo(0, r * 0.72);
  x.lineTo(-r * 0.34, r * 0.5);
  x.closePath();
  x.fill();
  x.strokeStyle = 'rgba(40,80,100,.6)';
  x.lineWidth = Math.max(1, s * 0.04);
  x.stroke();
  // 侧面小晶体
  x.fillStyle = 'rgba(200,235,248,.8)';
  x.beginPath();
  x.moveTo(r * 0.34, -r * 0.1);
  x.lineTo(r * 0.62, -r * 0.32);
  x.lineTo(r * 0.62, r * 0.34);
  x.lineTo(r * 0.34, r * 0.5);
  x.closePath();
  x.fill();
  x.stroke();
  // 晶面折射高光线
  x.strokeStyle = 'rgba(255,255,255,.65)';
  x.lineWidth = Math.max(0.8, s * 0.03);
  x.beginPath();
  x.moveTo(-r * 0.18, -r * 0.2);
  x.lineTo(-r * 0.18, r * 0.4);
  x.moveTo(r * 0.05, -r * 0.4);
  x.lineTo(r * 0.05, r * 0.2);
  x.stroke();
  // 顶部雪晶闪光
  x.fillStyle = 'rgba(255,255,255,.9)';
  for (const [px, py, pr] of [[0.55, -0.55, 0.07], [-0.55, -0.45, 0.05]]) {
    x.save();
    x.translate(px * r, py * r);
    x.beginPath();
    for (let i = 0; i < 4; i++) {
      x.rotate(Math.PI / 2);
      x.moveTo(0, 0); x.lineTo(0, -pr * r * 2.2);
    }
    x.strokeStyle = 'rgba(255,255,255,.85)';
    x.lineWidth = Math.max(0.6, s * 0.022);
    x.stroke();
    x.restore();
  }
},

// 生鱼：蓝灰鱼形（流线鱼身 + 尾鳍 + 眼睛）
'raw-fish': (x, r, s, col) => {
  // 鱼身（左头右尾的流线体）
  const g = x.createLinearGradient(0, -r * 0.4, 0, r * 0.5);
  g.addColorStop(0, lightenColor(col, 0.35));
  g.addColorStop(0.6, col);
  g.addColorStop(1, darkenColor(col, 0.35));
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(-r * 0.78, r * 0.02);
  x.quadraticCurveTo(-r * 0.4, -r * 0.5, r * 0.15, -r * 0.42);
  x.quadraticCurveTo(r * 0.55, -r * 0.32, r * 0.62, r * 0.02);
  x.quadraticCurveTo(r * 0.55, r * 0.36, r * 0.15, r * 0.44);
  x.quadraticCurveTo(-r * 0.4, r * 0.52, -r * 0.78, r * 0.02);
  x.closePath();
  x.fill();
  x.strokeStyle = 'rgba(35,55,66,.65)';
  x.lineWidth = Math.max(1, s * 0.04);
  x.stroke();
  // 尾鳍（分叉）
  x.fillStyle = darkenColor(col, 0.15);
  x.beginPath();
  x.moveTo(r * 0.55, r * 0.0);
  x.lineTo(r * 0.88, -r * 0.34);
  x.quadraticCurveTo(r * 0.74, r * 0.0, r * 0.88, r * 0.34);
  x.closePath();
  x.fill();
  x.stroke();
  // 背鳍
  x.fillStyle = darkenColor(col, 0.1);
  x.beginPath();
  x.moveTo(-r * 0.05, -r * 0.42);
  x.quadraticCurveTo(r * 0.12, -r * 0.66, r * 0.3, -r * 0.36);
  x.closePath();
  x.fill();
  x.stroke();
  // 鳞片纹理
  x.strokeStyle = 'rgba(35,55,66,.35)';
  x.lineWidth = Math.max(0.6, s * 0.025);
  for (const ox of [-0.3, -0.05, 0.2]) {
    x.beginPath();
    x.arc(ox * r, r * 0.05, r * 0.14, -0.7, 0.7);
    x.stroke();
  }
  // 眼睛
  x.fillStyle = '#f2f5f7';
  x.beginPath(); x.arc(-r * 0.55, -r * 0.06, r * 0.11, 0, 7); x.fill();
  x.fillStyle = '#1c2830';
  x.beginPath(); x.arc(-r * 0.57, -r * 0.06, r * 0.055, 0, 7); x.fill();
  // 鳃线
  x.strokeStyle = 'rgba(35,55,66,.5)';
  x.lineWidth = Math.max(0.8, s * 0.03);
  x.beginPath();
  x.moveTo(-r * 0.38, -r * 0.22);
  x.quadraticCurveTo(-r * 0.3, r * 0.0, -r * 0.38, r * 0.2);
  x.stroke();
},

// 铀矿石：放射绿矿粒簇 + 辐射微光（沿用矿石三粒家族造型）
'uranium-ore': (x, r, s, col) => {
  _radGlow(x, r, 'rgba(120,230,90,.28)', 'rgba(120,230,90,0)');
  // 三颗矿粒（呼应 iron-ore / copper-ore 立体矿石造型）
  for (let i = 0; i < 3; i++) {
    const a = i * 2.09 - Math.PI / 2;
    const cx = Math.cos(a) * r * 0.36, cy = Math.sin(a) * r * 0.36;
    const rr = s * 0.17;
    const g = x.createLinearGradient(cx - rr, cy - rr, cx + rr, cy + rr);
    g.addColorStop(0, lightenColor(col, 0.5));
    g.addColorStop(1, darkenColor(col, 0.3));
    x.fillStyle = g;
    x.beginPath();
    x.arc(cx, cy, rr, 0, 7);
    x.fill();
    // 高光
    x.fillStyle = 'rgba(255,255,255,.35)';
    x.beginPath();
    x.arc(cx - rr * 0.28, cy - rr * 0.32, rr * 0.32, 0, 7);
    x.fill();
  }
  // 辐射符号（中央小三叶）
  _radTrefoil(x, r * 0.5, 'rgba(20,60,10,.75)');
},

// 铀-235：亮绿发光同位素芯块（高亮 + 放射线 + 235 标记）
'uranium-235': (x, r, s, col) => {
  _radGlow(x, r, 'rgba(150,255,110,.45)', 'rgba(150,255,110,0)');
  // 圆柱芯块
  const g = x.createRadialGradient(-r * 0.15, -r * 0.2, r * 0.05, 0, 0, r * 0.62);
  g.addColorStop(0, lightenColor(col, 0.55));
  g.addColorStop(0.6, col);
  g.addColorStop(1, darkenColor(col, 0.32));
  x.fillStyle = g;
  x.beginPath(); x.arc(0, 0, r * 0.56, 0, 7); x.fill();
  x.strokeStyle = 'rgba(30,70,20,.7)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 放射短射线
  x.strokeStyle = 'rgba(170,255,130,.9)';
  x.lineWidth = Math.max(1, s * 0.04);
  x.lineCap = 'round';
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    x.beginPath();
    x.moveTo(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72);
    x.lineTo(Math.cos(a) * r * 0.9, Math.sin(a) * r * 0.9);
    x.stroke();
  }
  // "235" 标记
  x.fillStyle = 'rgba(15,45,10,.85)';
  x.font = 'bold ' + Math.round(r * 0.42) + 'px sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText('235', 0, r * 0.04);
},

// 铀-238：暗绿丰度同位素芯块（低亮度 + 238 标记，与 U-235 形成对比）
'uranium-238': (x, r, s, col) => {
  _radGlow(x, r, 'rgba(110,180,70,.2)', 'rgba(110,180,70,0)');
  const g = x.createRadialGradient(-r * 0.15, -r * 0.2, r * 0.05, 0, 0, r * 0.62);
  g.addColorStop(0, lightenColor(col, 0.38));
  g.addColorStop(0.6, col);
  g.addColorStop(1, darkenColor(col, 0.36));
  x.fillStyle = g;
  x.beginPath(); x.arc(0, 0, r * 0.56, 0, 7); x.fill();
  x.strokeStyle = 'rgba(24,52,14,.75)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 内圈约束环（稳定同位素意象：闭合环）
  x.strokeStyle = 'rgba(220,245,200,.55)';
  x.lineWidth = Math.max(0.9, s * 0.035);
  x.beginPath(); x.arc(0, 0, r * 0.4, 0, 7); x.stroke();
  // "238" 标记
  x.fillStyle = 'rgba(18,42,10,.85)';
  x.font = 'bold ' + Math.round(r * 0.42) + 'px sans-serif';
  x.textAlign = 'center';
  x.textBaseline = 'middle';
  x.fillText('238', 0, r * 0.04);
},

// 核燃料：高能燃料压块（亮绿菱形压块 + 放射光芒 + 三叶符号）
'nuclear-fuel': (x, r, s, col) => {
  _radGlow(x, r, 'rgba(150,240,100,.4)', 'rgba(150,240,100,0)');
  // 菱形压块（能量密度意象）
  x.save();
  x.rotate(Math.PI / 4);
  const g = x.createLinearGradient(-r * 0.45, -r * 0.45, r * 0.45, r * 0.45);
  g.addColorStop(0, lightenColor(col, 0.5));
  g.addColorStop(0.55, col);
  g.addColorStop(1, darkenColor(col, 0.35));
  x.fillStyle = g;
  rrPath(x, -r * 0.44, -r * 0.44, r * 0.88, r * 0.88, r * 0.1);
  x.fill();
  x.strokeStyle = 'rgba(24,64,14,.75)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  x.restore();
  // 三叶符号
  _radTrefoil(x, r * 0.34, 'rgba(18,52,10,.8)');
  // 角落光芒
  x.strokeStyle = 'rgba(190,255,150,.9)';
  x.lineWidth = Math.max(1, s * 0.035);
  x.lineCap = 'round';
  for (const [px, py] of [[-0.72, -0.72], [0.72, -0.72], [-0.72, 0.72], [0.72, 0.72]]) {
    x.beginPath();
    x.moveTo(px * r * 0.82, py * r * 0.82);
    x.lineTo(px * r * 0.98, py * r * 0.98);
    x.stroke();
  }
},

// 铀燃料棒：竖置燃料棒（金属包壳 + 绿色活性窗口 + 端盖）
'uranium-fuel-cell': (x, r, s, col) => {
  _radGlow(x, r, 'rgba(120,230,120,.25)', 'rgba(120,230,120,0)');
  // 棒体（竖圆管）
  const g = x.createLinearGradient(-r * 0.3, 0, r * 0.3, 0);
  g.addColorStop(0, lightenColor('#b8c0c8', 0.3));
  g.addColorStop(0.5, '#b8c0c8');
  g.addColorStop(1, darkenColor('#b8c0c8', 0.4));
  x.fillStyle = g;
  rrPath(x, -r * 0.3, -r * 0.85, r * 0.6, r * 1.7, r * 0.14);
  x.fill();
  x.strokeStyle = 'rgba(40,50,58,.7)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 端盖
  x.fillStyle = '#8a949e';
  rrPath(x, -r * 0.34, -r * 0.95, r * 0.68, r * 0.2, r * 0.08);
  x.fill();
  rrPath(x, -r * 0.34, r * 0.75, r * 0.68, r * 0.2, r * 0.08);
  x.fill();
  // 活性窗口（绿色燃料芯块）
  x.fillStyle = col;
  rrPath(x, -r * 0.18, -r * 0.6, r * 0.36, r * 1.2, r * 0.1);
  x.fill();
  // 芯块分节线
  x.strokeStyle = 'rgba(20,60,26,.5)';
  x.lineWidth = Math.max(0.7, s * 0.03);
  for (let i = 0; i < 4; i++) {
    const py = -r * 0.6 + (i + 1) * r * 0.24;
    x.beginPath(); x.moveTo(-r * 0.18, py); x.lineTo(r * 0.18, py); x.stroke();
  }
  // 窗口高光
  x.fillStyle = 'rgba(255,255,255,.4)';
  rrPath(x, -r * 0.13, -r * 0.56, r * 0.08, r * 1.1, r * 0.04);
  x.fill();
},

// 贫化铀燃料棒：暗哑残棒（灰绿包壳 + 褪色窗口 + 燃尽裂纹）
'depleted-uranium-fuel-cell': (x, r, s, col) => {
  // 棒体（竖圆管，做旧灰绿）
  const g = x.createLinearGradient(-r * 0.3, 0, r * 0.3, 0);
  g.addColorStop(0, lightenColor(col, 0.3));
  g.addColorStop(0.5, col);
  g.addColorStop(1, darkenColor(col, 0.4));
  x.fillStyle = g;
  rrPath(x, -r * 0.3, -r * 0.85, r * 0.6, r * 1.7, r * 0.14);
  x.fill();
  x.strokeStyle = 'rgba(30,36,24,.75)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 端盖
  x.fillStyle = '#6e7664';
  rrPath(x, -r * 0.34, -r * 0.95, r * 0.68, r * 0.2, r * 0.08);
  x.fill();
  rrPath(x, -r * 0.34, r * 0.75, r * 0.68, r * 0.2, r * 0.08);
  x.fill();
  // 褪色空窗口（燃尽后残留暗芯）
  x.fillStyle = darkenColor(col, 0.5);
  rrPath(x, -r * 0.18, -r * 0.6, r * 0.36, r * 1.2, r * 0.1);
  x.fill();
  // 燃尽裂纹
  x.strokeStyle = 'rgba(18,22,14,.8)';
  x.lineWidth = Math.max(0.8, s * 0.032);
  x.beginPath();
  x.moveTo(-r * 0.06, -r * 0.4);
  x.lineTo(r * 0.05, -r * 0.28);
  x.lineTo(-r * 0.04, -r * 0.14);
  x.moveTo(r * 0.02, r * 0.18);
  x.lineTo(-r * 0.06, r * 0.32);
  x.stroke();
  // 灰尘蒙层
  x.fillStyle = 'rgba(40,44,34,.3)';
  rrPath(x, -r * 0.18, -r * 0.6, r * 0.36, r * 0.4, r * 0.1);
  x.fill();
},

// 聚变燃料棒：青绿等离子胶囊（玻璃壳 + 内部旋涡能量）
'fusion-power-cell': (x, r, s, col) => {
  _radGlow(x, r, 'rgba(130,240,200,.4)', 'rgba(130,240,200,0)');
  // 竖置胶囊玻璃壳
  const g = x.createLinearGradient(-r * 0.42, -r * 0.8, r * 0.42, r * 0.8);
  g.addColorStop(0, 'rgba(220,255,245,.9)');
  g.addColorStop(0.5, lightenColor(col, 0.3));
  g.addColorStop(1, darkenColor(col, 0.25));
  x.fillStyle = g;
  x.beginPath();
  x.arc(0, -r * 0.45, r * 0.42, Math.PI, 0);
  x.lineTo(r * 0.42, r * 0.45);
  x.arc(0, r * 0.45, r * 0.42, 0, Math.PI);
  x.closePath();
  x.fill();
  x.strokeStyle = 'rgba(20,70,55,.65)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 内部等离子旋涡
  x.save();
  x.beginPath();
  x.arc(0, -r * 0.45, r * 0.42, Math.PI, 0);
  x.lineTo(r * 0.42, r * 0.45);
  x.arc(0, r * 0.45, r * 0.42, 0, Math.PI);
  x.closePath();
  x.clip();
  x.strokeStyle = 'rgba(255,255,255,.75)';
  x.lineWidth = Math.max(1, s * 0.04);
  x.lineCap = 'round';
  x.beginPath();
  x.arc(0, 0, r * 0.28, 0.4, 2.6);
  x.stroke();
  x.beginPath();
  x.arc(-r * 0.06, r * 0.06, r * 0.14, 2.8, 5.2);
  x.stroke();
  // 核心亮点
  const cg = x.createRadialGradient(0, -r * 0.05, r * 0.02, 0, -r * 0.05, r * 0.2);
  cg.addColorStop(0, 'rgba(255,255,255,.95)');
  cg.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = cg;
  x.beginPath(); x.arc(0, -r * 0.05, r * 0.2, 0, 7); x.fill();
  x.restore();
  // 上下金属箍
  x.fillStyle = '#9aa4ac';
  rrPath(x, -r * 0.46, -r * 0.88, r * 0.92, r * 0.18, r * 0.07);
  x.fill();
  rrPath(x, -r * 0.46, r * 0.7, r * 0.92, r * 0.18, r * 0.07);
  x.fill();
},

// 木材：两根圆木交叠（年轮端面 + 树皮纹理）
'wood': (x, r, s, col) => {
  const barkC = darkenColor(col, 0.25);
  const cutC = lightenColor(col, 0.45);
  // 后面圆木（横置，右上）
  x.save();
  x.translate(r * 0.12, -r * 0.28);
  x.rotate(-0.12);
  const g1 = x.createLinearGradient(0, -r * 0.3, 0, r * 0.3);
  g1.addColorStop(0, lightenColor(col, 0.32));
  g1.addColorStop(0.6, col);
  g1.addColorStop(1, barkC);
  x.fillStyle = g1;
  rrPath(x, -r * 0.8, -r * 0.28, r * 1.6, r * 0.56, r * 0.26);
  x.fill();
  x.strokeStyle = 'rgba(58,40,16,.7)';
  x.lineWidth = Math.max(1, s * 0.04);
  x.stroke();
  // 树皮纹理
  x.strokeStyle = 'rgba(58,40,16,.4)';
  x.lineWidth = Math.max(0.6, s * 0.025);
  x.beginPath(); x.moveTo(-r * 0.5, -r * 0.08); x.lineTo(r * 0.4, -r * 0.08);
  x.moveTo(-r * 0.4, r * 0.1); x.lineTo(r * 0.5, r * 0.1);
  x.stroke();
  // 端面年轮
  x.fillStyle = cutC;
  x.beginPath(); x.ellipse(-r * 0.8, 0, r * 0.14, r * 0.28, 0, 0, 7); x.fill();
  x.strokeStyle = 'rgba(120,85,40,.7)';
  x.lineWidth = Math.max(0.6, s * 0.025);
  x.beginPath(); x.ellipse(-r * 0.8, 0, r * 0.08, r * 0.17, 0, 0, 7); x.stroke();
  x.beginPath(); x.arc(-r * 0.8, 0, r * 0.03, 0, 7); x.stroke();
  x.restore();
  // 前面圆木（横置，左下）
  x.save();
  x.translate(-r * 0.1, r * 0.3);
  x.rotate(0.1);
  const g2 = x.createLinearGradient(0, -r * 0.3, 0, r * 0.3);
  g2.addColorStop(0, lightenColor(col, 0.36));
  g2.addColorStop(0.6, col);
  g2.addColorStop(1, barkC);
  x.fillStyle = g2;
  rrPath(x, -r * 0.8, -r * 0.28, r * 1.6, r * 0.56, r * 0.26);
  x.fill();
  x.strokeStyle = 'rgba(58,40,16,.7)';
  x.lineWidth = Math.max(1, s * 0.04);
  x.stroke();
  x.strokeStyle = 'rgba(58,40,16,.4)';
  x.lineWidth = Math.max(0.6, s * 0.025);
  x.beginPath(); x.moveTo(-r * 0.5, -r * 0.08); x.lineTo(r * 0.4, -r * 0.08);
  x.moveTo(-r * 0.4, r * 0.1); x.lineTo(r * 0.5, r * 0.1);
  x.stroke();
  x.fillStyle = cutC;
  x.beginPath(); x.ellipse(r * 0.8, 0, r * 0.14, r * 0.28, 0, 0, 7); x.fill();
  x.strokeStyle = 'rgba(120,85,40,.7)';
  x.lineWidth = Math.max(0.6, s * 0.025);
  x.beginPath(); x.ellipse(r * 0.8, 0, r * 0.08, r * 0.17, 0, 0, 7); x.stroke();
  x.beginPath(); x.arc(r * 0.8, 0, r * 0.03, 0, 7); x.stroke();
  x.restore();
},

// 统一药瓶造型：对应颜色即瓶内液体色（共享 _scienceBottle）
'space-science-pack': (x, r, s, col) => {
  // 对应颜色瓶子：颜色由 ITEMS[id].color 驱动
  _scienceBottle(x, r, s, col);
},

// 统一药瓶造型：对应颜色即瓶内液体色（共享 _scienceBottle）
'promethium-science-pack': (x, r, s, col) => {
  // 对应颜色瓶子：颜色由 ITEMS[id].color 驱动
  _scienceBottle(x, r, s, col);
},

// 统一药瓶造型：对应颜色即瓶内液体色（共享 _scienceBottle）
'cryogenic-science-pack': (x, r, s, col) => {
  // 对应颜色瓶子：颜色由 ITEMS[id].color 驱动
  _scienceBottle(x, r, s, col);
},

// 量子处理器：紫色量子芯片 + 叠加量子位环 + 金色引脚
'quantum-processor': (x, r, s, col) => {
  _moduleBase(x, r, s, col);
  // 量子位环（两个交叠椭圆环，叠加态意象）
  x.lineWidth = Math.max(1.4, s * 0.05);
  x.strokeStyle = 'rgba(255,255,255,.9)';
  x.beginPath(); x.ellipse(-r * 0.14, -r * 0.04, r * 0.3, r * 0.2, -0.4, 0, 7); x.stroke();
  x.strokeStyle = 'rgba(255,230,140,.95)';
  x.beginPath(); x.ellipse(r * 0.14, -r * 0.04, r * 0.3, r * 0.2, 0.4, 0, 7); x.stroke();
  // 中心量子核
  const cg = x.createRadialGradient(0, -r * 0.04, r * 0.02, 0, -r * 0.04, r * 0.14);
  cg.addColorStop(0, 'rgba(255,255,255,1)');
  cg.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = cg;
  x.beginPath(); x.arc(0, -r * 0.04, r * 0.14, 0, 7); x.fill();
  // 纠缠连线（环间小连线）
  x.strokeStyle = 'rgba(255,255,255,.5)';
  x.lineWidth = Math.max(0.6, s * 0.02);
  x.beginPath(); x.moveTo(-r * 0.28, r * 0.22); x.lineTo(r * 0.28, r * 0.22); x.stroke();
},

// 废料：灰褐金属碎块堆（齿轮残片 + 板材碎块 + 铆钉）
'scrap': (x, r, s, col) => {
  // 底层碎板
  const g = x.createLinearGradient(-r * 0.6, -r * 0.4, r * 0.6, r * 0.6);
  g.addColorStop(0, lightenColor(col, 0.3));
  g.addColorStop(0.6, col);
  g.addColorStop(1, darkenColor(col, 0.4));
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(-r * 0.72, r * 0.28);
  x.lineTo(-r * 0.5, -r * 0.18);
  x.lineTo(r * 0.05, -r * 0.34);
  x.lineTo(r * 0.62, -r * 0.1);
  x.lineTo(r * 0.7, r * 0.3);
  x.lineTo(r * 0.1, r * 0.6);
  x.lineTo(-r * 0.55, r * 0.55);
  x.closePath();
  x.fill();
  x.strokeStyle = 'rgba(30,30,24,.7)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.lineJoin = 'round';
  x.stroke();
  // 齿轮残片（半齿轮露出）
  x.save();
  x.translate(r * 0.28, -r * 0.1);
  x.rotate(0.4);
  x.fillStyle = lightenColor(col, 0.18);
  x.beginPath();
  x.arc(0, 0, r * 0.26, 0, Math.PI);
  for (let i = 0; i <= 3; i++) {
    const a = Math.PI + i * (Math.PI / 3);
    const rr = i % 2 ? r * 0.26 : r * 0.34;
    x.arc(0, 0, rr, a, Math.min(a + Math.PI / 6, Math.PI * 2));
  }
  x.closePath();
  x.fill();
  x.stroke();
  x.restore();
  // 板材碎片（斜插小板）
  x.save();
  x.translate(-r * 0.28, r * 0.08);
  x.rotate(-0.5);
  x.fillStyle = lightenColor(col, 0.12);
  rrPath(x, -r * 0.22, -r * 0.3, r * 0.44, r * 0.6, r * 0.05);
  x.fill();
  x.strokeStyle = 'rgba(30,30,24,.7)';
  x.lineWidth = Math.max(1, s * 0.04);
  x.stroke();
  // 铆钉
  x.fillStyle = 'rgba(220,225,230,.7)';
  x.beginPath(); x.arc(0, -r * 0.18, r * 0.05, 0, 7); x.fill();
  x.beginPath(); x.arc(0, r * 0.16, r * 0.05, 0, 7); x.fill();
  x.restore();
  // 碎块高光边
  x.strokeStyle = 'rgba(255,255,255,.3)';
  x.lineWidth = Math.max(0.8, s * 0.03);
  x.beginPath();
  x.moveTo(-r * 0.5, -r * 0.16);
  x.lineTo(r * 0.03, -r * 0.32);
  x.stroke();
},

// 空桶：空钢桶（顶部开口 + 箍纹，无色带）
'barrel': (x, r, s, col) => {
  _barrelShell(x, r, s, null);
},

// 桶装水：钢桶 + 蓝色水带
'water-barrel': (x, r, s, col) => {
  _barrelShell(x, r, s, col);
},

// 桶装原油：钢桶 + 黑褐色油带 + 油滴
'crude-oil-barrel': (x, r, s, col) => {
  _barrelShell(x, r, s, '#2e2818');
},

// 桶装重油：钢桶 + 深褐油带
'heavy-oil-barrel': (x, r, s, col) => {
  _barrelShell(x, r, s, '#6a4626');
},

// 桶装轻油：钢桶 + 琥珀色油带
'light-oil-barrel': (x, r, s, col) => {
  _barrelShell(x, r, s, '#a8752c');
},
// ===== 批次：桶装流体收尾（5）+ 太空（18）+ 武器（7） =====

// 桶装石油气：钢桶 + 金黄色气带 + 上浮气泡
'petroleum-gas-barrel': (x, r, s, col) => {
  _barrelShell(x, r, s, col);
  // 气泡（暗示气态）
  x.strokeStyle = 'rgba(255,255,255,.7)';
  x.lineWidth = Math.max(0.8, s * 0.03);
  for (const [px, py, pr] of [[-0.22, -0.32, 0.06], [0.2, -0.44, 0.045], [0.05, -0.24, 0.035]]) {
    x.beginPath(); x.arc(px * r, py * r, pr * r, 0, 7); x.stroke();
  }
},

// 桶装润滑油：钢桶 + 亮黄色油带 + 油滴
'lubricant-barrel': (x, r, s, col) => {
  _barrelShell(x, r, s, col);
},

// 桶装硫酸：钢桶 + 酸性黄绿液带 + 腐蚀气泡
'sulfuric-acid-barrel': (x, r, s, col) => {
  _barrelShell(x, r, s, col);
  // 腐蚀气泡（酸液特征）
  x.fillStyle = 'rgba(255,255,255,.55)';
  for (const [px, py, pr] of [[-0.2, -0.34, 0.05], [0.22, -0.42, 0.04], [0, -0.26, 0.03]]) {
    x.beginPath(); x.arc(px * r, py * r, pr * r, 0, 7); x.fill();
  }
  // 危险警示小滴
  x.fillStyle = '#3a3a10';
  x.beginPath();
  x.moveTo(r * 0.34, r * 0.62);
  x.quadraticCurveTo(r * 0.41, r * 0.5, r * 0.34, r * 0.42);
  x.quadraticCurveTo(r * 0.27, r * 0.5, r * 0.34, r * 0.62);
  x.fill();
},

// 桶装氟酮（冷）：钢桶 + 冰蓝液带 + 雪花标记
'fluoroketone-cold-barrel': (x, r, s, col) => {
  _barrelShell(x, r, s, col);
  // 迷你雪花（六轴）
  x.save();
  x.translate(r * 0.3, -r * 0.4);
  x.strokeStyle = 'rgba(255,255,255,.95)';
  x.lineWidth = Math.max(0.9, s * 0.035);
  x.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    x.rotate(Math.PI / 3);
    x.beginPath(); x.moveTo(0, -r * 0.12); x.lineTo(0, r * 0.12); x.stroke();
  }
  x.restore();
},

// 桶装氟酮（热）：钢桶 + 橙红液带 + 热浪波纹
'fluoroketone-hot-barrel': (x, r, s, col) => {
  _barrelShell(x, r, s, col);
  // 热浪波纹（三条竖向波浪）
  x.strokeStyle = 'rgba(255,120,40,.9)';
  x.lineWidth = Math.max(0.9, s * 0.035);
  x.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const px = r * 0.18 + i * r * 0.14;
    x.beginPath();
    x.moveTo(px, -r * 0.52);
    x.quadraticCurveTo(px - r * 0.07, -r * 0.44, px, -r * 0.36);
    x.stroke();
  }
},

// 火箭部件：灰白圆形部件环 + 中央舱段截面 + 铆钉
'rocket-part': (x, r, s, col) => {
  // 环形外壳（火箭筒段截面）
  const g = x.createLinearGradient(-r * 0.7, -r * 0.7, r * 0.7, r * 0.7);
  g.addColorStop(0, lightenColor(col, 0.5));
  g.addColorStop(0.55, col);
  g.addColorStop(1, darkenColor(col, 0.38));
  x.fillStyle = g;
  x.beginPath(); x.arc(0, 0, r * 0.78, 0, 7); x.fill();
  x.strokeStyle = 'rgba(30,34,44,.6)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 中孔
  x.fillStyle = 'rgba(40,46,58,.9)';
  x.beginPath(); x.arc(0, 0, r * 0.34, 0, 7); x.fill();
  // 内壁高光
  x.fillStyle = 'rgba(255,255,255,.4)';
  x.beginPath(); x.ellipse(-r * 0.3, -r * 0.3, r * 0.14, r * 0.3, -0.8, 0, 7); x.fill();
  // 四向铆钉
  x.fillStyle = '#e8ecf2';
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    x.beginPath(); x.arc(Math.cos(a) * r * 0.56, Math.sin(a) * r * 0.56, r * 0.07, 0, 7); x.fill();
  }
  // 拼装缺口（右上楔形，示意待拼装）
  x.fillStyle = '#6a7484';
  x.beginPath();
  x.moveTo(r * 0.78, 0);
  x.arc(0, 0, r * 0.78, -0.35, 0.15);
  x.closePath();
  x.fill();
},

// 火箭：完整火箭本体（锥头 + 舱身 + 尾翼 + 喷口）
'rocket-body': (x, r, s, col) => {
  x.save();
  x.rotate(-0.12); // 微倾斜更动感
  // 尾翼（左右）
  x.fillStyle = darkenColor(col, 0.42);
  x.beginPath();
  x.moveTo(-r * 0.34, r * 0.28); x.lineTo(-r * 0.68, r * 0.82); x.lineTo(-r * 0.3, r * 0.62);
  x.closePath(); x.fill();
  x.beginPath();
  x.moveTo(r * 0.34, r * 0.28); x.lineTo(r * 0.68, r * 0.82); x.lineTo(r * 0.3, r * 0.62);
  x.closePath(); x.fill();
  // 舱身
  const g = x.createLinearGradient(-r * 0.3, 0, r * 0.3, 0);
  g.addColorStop(0, darkenColor(col, 0.22));
  g.addColorStop(0.4, lightenColor(col, 0.42));
  g.addColorStop(1, darkenColor(col, 0.35));
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(-r * 0.3, r * 0.66);
  x.lineTo(-r * 0.3, -r * 0.34);
  x.quadraticCurveTo(0, -r * 0.92, r * 0.3, -r * 0.34);
  x.lineTo(r * 0.3, r * 0.66);
  x.closePath();
  x.fill();
  x.strokeStyle = 'rgba(30,34,44,.55)';
  x.lineWidth = Math.max(1, s * 0.04);
  x.stroke();
  // 舷窗
  x.fillStyle = '#3a7ab8';
  x.beginPath(); x.arc(0, -r * 0.05, r * 0.16, 0, 7); x.fill();
  x.strokeStyle = 'rgba(255,255,255,.7)';
  x.lineWidth = Math.max(1, s * 0.03);
  x.stroke();
  // 环箍
  x.strokeStyle = 'rgba(60,66,78,.5)';
  x.lineWidth = Math.max(1, s * 0.035);
  x.beginPath(); x.moveTo(-r * 0.28, r * 0.3); x.lineTo(r * 0.28, r * 0.3); x.stroke();
  // 喷口
  x.fillStyle = '#5a4632';
  x.beginPath();
  x.moveTo(-r * 0.2, r * 0.66); x.lineTo(-r * 0.14, r * 0.86); x.lineTo(r * 0.14, r * 0.86); x.lineTo(r * 0.2, r * 0.66);
  x.closePath(); x.fill();
  x.restore();
},

// 卫星：立方星体 + 两侧太阳能板翼 + 顶部天线
'satellite': (x, r, s, col) => {
  // 太阳能板翼（左右，深蓝电池板）
  const pg = x.createLinearGradient(0, -r * 0.3, 0, r * 0.3);
  pg.addColorStop(0, '#3a5aa0');
  pg.addColorStop(1, '#25407c');
  x.fillStyle = pg;
  rrPath(x, -r * 0.96, -r * 0.22, r * 0.62, r * 0.44, r * 0.05);
  x.fill();
  rrPath(x, r * 0.34, -r * 0.22, r * 0.62, r * 0.44, r * 0.05);
  x.fill();
  x.strokeStyle = 'rgba(180,210,255,.6)';
  x.lineWidth = Math.max(0.6, s * 0.022);
  // 板上电池网格
  for (const bx of [-r * 0.96, r * 0.34]) {
    for (let i = 1; i < 3; i++) {
      x.beginPath(); x.moveTo(bx + i * r * 0.206, -r * 0.22); x.lineTo(bx + i * r * 0.206, r * 0.22); x.stroke();
    }
    x.beginPath(); x.moveTo(bx, 0); x.lineTo(bx + r * 0.62, 0); x.stroke();
  }
  // 板支柱
  x.strokeStyle = '#8a92a0';
  x.lineWidth = Math.max(1.2, s * 0.04);
  x.beginPath(); x.moveTo(-r * 0.34, 0); x.lineTo(-r * 0.5, 0); x.stroke();
  x.beginPath(); x.moveTo(r * 0.34, 0); x.lineTo(r * 0.5, 0); x.stroke();
  // 星体（立方体感）
  const g = x.createLinearGradient(-r * 0.3, -r * 0.3, r * 0.3, r * 0.3);
  g.addColorStop(0, lightenColor(col, 0.42));
  g.addColorStop(0.6, col);
  g.addColorStop(1, darkenColor(col, 0.32));
  x.fillStyle = g;
  rrPath(x, -r * 0.3, -r * 0.34, r * 0.6, r * 0.68, r * 0.1);
  x.fill();
  x.strokeStyle = 'rgba(30,34,44,.6)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 天线（顶部锅形）
  x.fillStyle = '#e8ecf2';
  x.beginPath(); x.ellipse(0, -r * 0.46, r * 0.2, r * 0.12, 0, 0, 7); x.fill();
  x.strokeStyle = '#c8ced8';
  x.lineWidth = Math.max(0.8, s * 0.03);
  x.beginPath(); x.moveTo(0, -r * 0.5); x.lineTo(0, -r * 0.72); x.stroke();
  x.fillStyle = '#e05a4a';
  x.beginPath(); x.arc(0, -r * 0.76, r * 0.05, 0, 7); x.fill();
  // 星体舷窗灯
  x.fillStyle = '#4ac8e0';
  x.beginPath(); x.arc(0, r * 0.02, r * 0.1, 0, 7); x.fill();
},

// 火箭发射井：混凝土井口环 + 内部竖直火箭 + 支撑塔架
'rocket-silo': (x, r, s, col) => {
  // 井口外环（混凝土）
  const og = x.createLinearGradient(-r * 0.9, -r * 0.9, r * 0.9, r * 0.9);
  og.addColorStop(0, lightenColor(col, 0.4));
  og.addColorStop(1, darkenColor(col, 0.42));
  x.fillStyle = og;
  x.beginPath(); x.arc(0, 0, r * 0.9, 0, 7); x.fill();
  x.strokeStyle = 'rgba(25,22,18,.6)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 井内（深色竖井）
  x.fillStyle = '#181a20';
  x.beginPath(); x.arc(0, 0, r * 0.62, 0, 7); x.fill();
  // 竖直小火箭（井内）
  x.save();
  x.scale(0.72, 0.72);
  const bg = x.createLinearGradient(-r * 0.2, 0, r * 0.2, 0);
  bg.addColorStop(0, '#a8b0bc');
  bg.addColorStop(0.45, '#eef2f8');
  bg.addColorStop(1, '#8a92a0');
  x.fillStyle = bg;
  x.beginPath();
  x.moveTo(0, -r * 0.72);
  x.quadraticCurveTo(r * 0.18, -r * 0.3, r * 0.16, r * 0.36);
  x.lineTo(-r * 0.16, r * 0.36);
  x.quadraticCurveTo(-r * 0.18, -r * 0.3, 0, -r * 0.72);
  x.closePath();
  x.fill();
  // 尾焰（发射预兆）
  const fg = x.createLinearGradient(0, r * 0.36, 0, r * 0.78);
  fg.addColorStop(0, 'rgba(255,220,90,.95)');
  fg.addColorStop(1, 'rgba(255,110,30,0)');
  x.fillStyle = fg;
  x.beginPath();
  x.moveTo(-r * 0.1, r * 0.38); x.lineTo(0, r * 0.78); x.lineTo(r * 0.1, r * 0.38);
  x.closePath(); x.fill();
  x.restore();
  // 井口闸门轨道（两侧斜杠）
  x.strokeStyle = 'rgba(230,225,210,.5)';
  x.lineWidth = Math.max(1.4, s * 0.05);
  for (const sgn of [-1, 1]) {
    x.beginPath();
    x.moveTo(sgn * r * 0.78, -r * 0.5);
    x.lineTo(sgn * r * 0.62, -r * 0.66);
    x.stroke();
  }
},

// 物流接驳站：紫色大型停机坪 + 着陆圈标记 + 雷达天线
'cargo-landing-pad': (x, r, s, col) => {
  // 坪体（俯视平台）
  const g = x.createLinearGradient(-r * 0.9, -r * 0.9, r * 0.9, r * 0.9);
  g.addColorStop(0, lightenColor(col, 0.4));
  g.addColorStop(1, darkenColor(col, 0.45));
  x.fillStyle = g;
  rrPath(x, -r * 0.9, -r * 0.9, r * 1.8, r * 1.8, r * 0.18);
  x.fill();
  x.strokeStyle = 'rgba(22,16,34,.65)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 着陆圈（中心圆环 + 四角标）
  x.strokeStyle = 'rgba(255,235,120,.85)';
  x.lineWidth = Math.max(1.4, s * 0.05);
  x.beginPath(); x.arc(0, 0, r * 0.44, 0, 7); x.stroke();
  x.lineWidth = Math.max(1, s * 0.04);
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    const cx = Math.cos(a) * r * 0.62, cy = Math.sin(a) * r * 0.62;
    x.beginPath();
    x.moveTo(cx - r * 0.08, cy); x.lineTo(cx + r * 0.08, cy);
    x.moveTo(cx, cy - r * 0.08); x.lineTo(cx, cy + r * 0.08);
    x.stroke();
  }
  // 角落雷达天线
  x.fillStyle = '#c8ced8';
  x.beginPath(); x.arc(-r * 0.66, -r * 0.66, r * 0.1, 0, 7); x.fill();
  x.strokeStyle = '#c8ced8';
  x.lineWidth = Math.max(0.8, s * 0.03);
  x.beginPath(); x.moveTo(-r * 0.66, -r * 0.66); x.lineTo(-r * 0.5, -r * 0.82); x.stroke();
  x.fillStyle = '#e05a4a';
  x.beginPath(); x.arc(-r * 0.5, -r * 0.84, r * 0.045, 0, 7); x.fill();
},

// 物流扩展舱：紫色舱体 + 十字加强筋 + 货舱口
'cargo-bay': (x, r, s, col) => {
  const g = x.createLinearGradient(-r * 0.8, -r * 0.8, r * 0.8, r * 0.8);
  g.addColorStop(0, lightenColor(col, 0.42));
  g.addColorStop(0.55, col);
  g.addColorStop(1, darkenColor(col, 0.45));
  x.fillStyle = g;
  rrPath(x, -r * 0.82, -r * 0.82, r * 1.64, r * 1.64, r * 0.16);
  x.fill();
  x.strokeStyle = 'rgba(24,18,40,.65)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 十字加强筋
  x.strokeStyle = 'rgba(255,255,255,.28)';
  x.lineWidth = Math.max(1.2, s * 0.05);
  x.beginPath();
  x.moveTo(0, -r * 0.82); x.lineTo(0, r * 0.82);
  x.moveTo(-r * 0.82, 0); x.lineTo(r * 0.82, 0);
  x.stroke();
  // 中央货舱口（方形舱门 + 四角螺栓）
  x.fillStyle = '#3a3054';
  rrPath(x, -r * 0.34, -r * 0.34, r * 0.68, r * 0.68, r * 0.08);
  x.fill();
  x.strokeStyle = 'rgba(220,210,255,.55)';
  x.lineWidth = Math.max(0.8, s * 0.03);
  x.stroke();
  x.fillStyle = 'rgba(230,225,250,.8)';
  for (const [px, py] of [[-0.26, -0.26], [0.26, -0.26], [-0.26, 0.26], [0.26, 0.26]]) {
    x.beginPath(); x.arc(px * r, py * r, r * 0.045, 0, 7); x.fill();
  }
},

// 物流卸载舱：紫红舱体 + 向下卸货箭头 + 传送带口
'landing-pad-unloading-bay': (x, r, s, col) => {
  const g = x.createLinearGradient(-r * 0.8, -r * 0.8, r * 0.8, r * 0.8);
  g.addColorStop(0, lightenColor(col, 0.42));
  g.addColorStop(0.55, col);
  g.addColorStop(1, darkenColor(col, 0.45));
  x.fillStyle = g;
  rrPath(x, -r * 0.82, -r * 0.82, r * 1.64, r * 1.64, r * 0.16);
  x.fill();
  x.strokeStyle = 'rgba(40,16,30,.65)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 卸货口（底部横槽）
  x.fillStyle = '#2a1420';
  rrPath(x, -r * 0.56, r * 0.42, r * 1.12, r * 0.26, r * 0.06);
  x.fill();
  // 向下卸货箭头
  x.fillStyle = 'rgba(255,235,150,.95)';
  x.beginPath();
  x.moveTo(-r * 0.2, -r * 0.5);
  x.lineTo(r * 0.2, -r * 0.5);
  x.lineTo(r * 0.2, -r * 0.1);
  x.lineTo(r * 0.4, -r * 0.1);
  x.lineTo(0, r * 0.32);
  x.lineTo(-r * 0.4, -r * 0.1);
  x.lineTo(-r * 0.2, -r * 0.1);
  x.closePath();
  x.fill();
},

// 推进器燃料：红色流体罐 + 火焰图标 + 危险色带
'thruster-fuel': (x, r, s, col) => {
  // 流体滴形（大液滴）
  const g = x.createLinearGradient(-r * 0.5, -r * 0.7, r * 0.5, r * 0.7);
  g.addColorStop(0, lightenColor(col, 0.45));
  g.addColorStop(0.55, col);
  g.addColorStop(1, darkenColor(col, 0.4));
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(0, -r * 0.85);
  x.quadraticCurveTo(r * 0.62, -r * 0.1, r * 0.62, r * 0.3);
  x.arc(0, r * 0.3, r * 0.62, 0, Math.PI);
  x.quadraticCurveTo(-r * 0.62, -r * 0.1, 0, -r * 0.85);
  x.closePath();
  x.fill();
  x.strokeStyle = 'rgba(60,8,4,.6)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 内部火焰
  x.fillStyle = '#ffd84a';
  x.beginPath();
  x.moveTo(0, r * 0.62);
  x.quadraticCurveTo(-r * 0.3, r * 0.34, -r * 0.1, r * 0.12);
  x.quadraticCurveTo(0, r * 0.3, r * 0.1, r * 0.08);
  x.quadraticCurveTo(r * 0.3, r * 0.32, 0, r * 0.62);
  x.closePath();
  x.fill();
  // 高光
  x.fillStyle = 'rgba(255,255,255,.35)';
  x.beginPath(); x.ellipse(-r * 0.24, r * 0.05, r * 0.1, r * 0.3, -0.3, 0, 7); x.fill();
},

// 推进器氧化剂：蓝色流体罐 + 氧分子双球图标
'thruster-oxidizer': (x, r, s, col) => {
  const g = x.createLinearGradient(-r * 0.5, -r * 0.7, r * 0.5, r * 0.7);
  g.addColorStop(0, lightenColor(col, 0.45));
  g.addColorStop(0.55, col);
  g.addColorStop(1, darkenColor(col, 0.4));
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(0, -r * 0.85);
  x.quadraticCurveTo(r * 0.62, -r * 0.1, r * 0.62, r * 0.3);
  x.arc(0, r * 0.3, r * 0.62, 0, Math.PI);
  x.quadraticCurveTo(-r * 0.62, -r * 0.1, 0, -r * 0.85);
  x.closePath();
  x.fill();
  x.strokeStyle = 'rgba(4,30,70,.6)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 氧分子 O2（两交叠圆）
  x.fillStyle = 'rgba(255,255,255,.9)';
  x.beginPath(); x.arc(-r * 0.14, r * 0.16, r * 0.17, 0, 7); x.fill();
  x.fillStyle = 'rgba(190,225,255,.9)';
  x.beginPath(); x.arc(r * 0.14, r * 0.16, r * 0.17, 0, 7); x.fill();
  // 高光
  x.fillStyle = 'rgba(255,255,255,.35)';
  x.beginPath(); x.ellipse(-r * 0.24, r * 0.02, r * 0.1, r * 0.3, -0.3, 0, 7); x.fill();
},

// 破碎机：钢制破碎腔 + 入口大口 + 碎屑飞溅
'crusher': (x, r, s, col) => {
  // 机体（梯形漏斗）
  const g = x.createLinearGradient(-r * 0.8, -r * 0.6, r * 0.8, r * 0.8);
  g.addColorStop(0, lightenColor(col, 0.4));
  g.addColorStop(0.55, col);
  g.addColorStop(1, darkenColor(col, 0.45));
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(-r * 0.8, -r * 0.6);
  x.lineTo(r * 0.8, -r * 0.6);
  x.lineTo(r * 0.42, r * 0.72);
  x.lineTo(-r * 0.42, r * 0.72);
  x.closePath();
  x.fill();
  x.strokeStyle = 'rgba(30,26,20,.65)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.lineJoin = 'round';
  x.stroke();
  // 入料口（顶部开口）
  x.fillStyle = '#241f18';
  rrPath(x, -r * 0.6, -r * 0.56, r * 1.2, r * 0.2, r * 0.05);
  x.fill();
  // 齿辊纹（腔体两条斜齿）
  x.strokeStyle = 'rgba(255,255,255,.35)';
  x.lineWidth = Math.max(1, s * 0.04);
  x.beginPath();
  x.moveTo(-r * 0.3, -r * 0.2); x.lineTo(-r * 0.14, r * 0.5);
  x.moveTo(r * 0.3, -r * 0.2); x.lineTo(r * 0.14, r * 0.5);
  x.stroke();
  // 飞溅碎屑
  x.fillStyle = '#d8c8a8';
  for (const [px, py, pr] of [[-0.62, -0.78, 0.06], [0.58, -0.84, 0.05], [0, -0.9, 0.045]]) {
    x.beginPath(); x.arc(px * r, py * r, pr * r, 0, 7); x.fill();
  }
  // 出料口
  x.fillStyle = '#3a3028';
  rrPath(x, -r * 0.32, r * 0.66, r * 0.64, r * 0.16, r * 0.04);
  x.fill();
},

// 金属星块：不规则岩块 + 露出金属矿脉光泽
'metallic-asteroid-chunk': (x, r, s, col) => {
  _asteroidChunk(x, r, s, col, 'metal');
},

// 碳质星块：暗褐岩块 + 碳黑矿脉纹理
'carbonic-asteroid-chunk': (x, r, s, col) => {
  _asteroidChunk(x, r, s, col, 'carbon');
},

// 氧化星块：蓝灰岩块 + 冰晶氧化斑
'oxide-asteroid-chunk': (x, r, s, col) => {
  _asteroidChunk(x, r, s, col, 'oxide');
},

// 钷素星块：深紫岩块 + 神秘紫色辉光矿脉
'promethium-asteroid-chunk': (x, r, s, col) => {
  _asteroidChunk(x, r, s, col, 'promethium');
},

// 太空平台地基：金属六边形地砖 + 铆钉边框
'space-platform-foundation': (x, r, s, col) => {
  const g = x.createLinearGradient(-r * 0.8, -r * 0.8, r * 0.8, r * 0.8);
  g.addColorStop(0, lightenColor(col, 0.4));
  g.addColorStop(0.55, col);
  g.addColorStop(1, darkenColor(col, 0.42));
  x.fillStyle = g;
  // 六边形
  x.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 - Math.PI / 6;
    const px = Math.cos(a) * r * 0.86, py = Math.sin(a) * r * 0.86;
    i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
  }
  x.closePath();
  x.fill();
  x.strokeStyle = 'rgba(20,22,30,.65)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 内六边框走线
  x.strokeStyle = 'rgba(255,255,255,.3)';
  x.lineWidth = Math.max(0.8, s * 0.03);
  x.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 - Math.PI / 6;
    const px = Math.cos(a) * r * 0.62, py = Math.sin(a) * r * 0.62;
    i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
  }
  x.closePath();
  x.stroke();
  // 六角铆钉
  x.fillStyle = 'rgba(225,232,240,.85)';
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3 - Math.PI / 6;
    x.beginPath(); x.arc(Math.cos(a) * r * 0.72, Math.sin(a) * r * 0.72, r * 0.055, 0, 7); x.fill();
  }
  // 中心网格板
  x.strokeStyle = 'rgba(0,0,0,.25)';
  x.lineWidth = Math.max(0.7, s * 0.025);
  x.beginPath();
  x.moveTo(-r * 0.3, 0); x.lineTo(r * 0.3, 0);
  x.moveTo(0, -r * 0.3); x.lineTo(0, r * 0.3);
  x.stroke();
},

// 推进器：橙铜色喷管锥体 + 内部等离子喷焰
'thruster': (x, r, s, col) => {
  // 喷管（钟形喷嘴）
  const g = x.createLinearGradient(-r * 0.7, -r * 0.7, r * 0.7, r * 0.4);
  g.addColorStop(0, lightenColor(col, 0.42));
  g.addColorStop(0.55, col);
  g.addColorStop(1, darkenColor(col, 0.45));
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(-r * 0.34, -r * 0.82);
  x.lineTo(r * 0.34, -r * 0.82);
  x.quadraticCurveTo(r * 0.8, r * 0.1, r * 0.6, r * 0.52);
  x.lineTo(-r * 0.6, r * 0.52);
  x.quadraticCurveTo(-r * 0.8, r * 0.1, -r * 0.34, -r * 0.82);
  x.closePath();
  x.fill();
  x.strokeStyle = 'rgba(40,22,8,.65)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.lineJoin = 'round';
  x.stroke();
  // 顶部法兰
  x.fillStyle = darkenColor(col, 0.3);
  rrPath(x, -r * 0.44, -r * 0.94, r * 0.88, r * 0.18, r * 0.05);
  x.fill();
  // 管身环箍
  x.strokeStyle = 'rgba(255,255,255,.25)';
  x.lineWidth = Math.max(0.8, s * 0.03);
  x.beginPath();
  x.moveTo(-r * 0.55, -r * 0.1); x.quadraticCurveTo(0, r * 0.04, r * 0.55, -r * 0.1);
  x.stroke();
  // 喷口等离子焰
  const fg = x.createLinearGradient(0, r * 0.5, 0, r * 0.92);
  fg.addColorStop(0, 'rgba(160,220,255,.95)');
  fg.addColorStop(0.6, 'rgba(90,150,240,.7)');
  fg.addColorStop(1, 'rgba(90,150,240,0)');
  x.fillStyle = fg;
  x.beginPath();
  x.moveTo(-r * 0.4, r * 0.52);
  x.quadraticCurveTo(0, r * 0.7, r * 0.4, r * 0.52);
  x.quadraticCurveTo(0, r * 0.98, -r * 0.4, r * 0.52);
  x.closePath();
  x.fill();
  // 内口暗缘
  x.strokeStyle = 'rgba(20,10,4,.5)';
  x.lineWidth = Math.max(1, s * 0.04);
  x.beginPath();
  x.moveTo(-r * 0.6, r * 0.52); x.quadraticCurveTo(0, r * 0.66, r * 0.6, r * 0.52);
  x.stroke();
},

// 小行星收集器：碟形收集器 + 磁场弧线 + 捕获星块
'asteroid-collector': (x, r, s, col) => {
  // 磁场弧线（上方两条同心弧）
  x.strokeStyle = 'rgba(140,220,255,.75)';
  x.lineWidth = Math.max(1.2, s * 0.045);
  x.beginPath(); x.arc(0, r * 0.3, r * 0.7, Math.PI * 1.15, Math.PI * 1.85); x.stroke();
  x.strokeStyle = 'rgba(140,220,255,.4)';
  x.beginPath(); x.arc(0, r * 0.3, r * 0.5, Math.PI * 1.2, Math.PI * 1.8); x.stroke();
  // 被磁吸的小星块
  x.fillStyle = '#9a8a76';
  x.beginPath();
  x.moveTo(r * 0.12, -r * 0.52); x.lineTo(r * 0.3, -r * 0.4); x.lineTo(r * 0.22, -r * 0.22); x.lineTo(r * 0.04, -r * 0.32);
  x.closePath(); x.fill();
  x.strokeStyle = 'rgba(30,26,18,.5)';
  x.lineWidth = Math.max(0.7, s * 0.03);
  x.stroke();
  // 碟形机体
  const g = x.createLinearGradient(-r * 0.8, -r * 0.2, r * 0.8, r * 0.5);
  g.addColorStop(0, lightenColor(col, 0.42));
  g.addColorStop(0.55, col);
  g.addColorStop(1, darkenColor(col, 0.45));
  x.fillStyle = g;
  x.beginPath();
  x.ellipse(0, r * 0.28, r * 0.82, r * 0.34, 0, Math.PI, 0);
  x.closePath();
  x.fill();
  x.strokeStyle = 'rgba(18,24,38,.65)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 碟面收集口
  x.fillStyle = '#141a28';
  x.beginPath(); x.ellipse(0, r * 0.1, r * 0.3, r * 0.12, 0, 0, 7); x.fill();
  // 碟身边缘灯
  x.fillStyle = '#4ac8e0';
  x.beginPath(); x.arc(-r * 0.5, r * 0.34, r * 0.05, 0, 7); x.fill();
  x.beginPath(); x.arc(r * 0.5, r * 0.34, r * 0.05, 0, 7); x.fill();
  // 底座
  x.fillStyle = darkenColor(col, 0.4);
  rrPath(x, -r * 0.24, r * 0.56, r * 0.48, r * 0.24, r * 0.05);
  x.fill();
},

// 空间平台起始包：压缩舱段包 + 捆扎带 + 平台骨架示意
'space-platform-starter-pack': (x, r, s, col) => {
  // 包体（横置圆角矩形舱段）
  const g = x.createLinearGradient(0, -r * 0.6, 0, r * 0.6);
  g.addColorStop(0, lightenColor(col, 0.42));
  g.addColorStop(0.55, col);
  g.addColorStop(1, darkenColor(col, 0.42));
  x.fillStyle = g;
  rrPath(x, -r * 0.86, -r * 0.5, r * 1.72, r * 1.0, r * 0.2);
  x.fill();
  x.strokeStyle = 'rgba(24,26,36,.65)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.stroke();
  // 两条竖向捆扎带
  x.fillStyle = '#c8933a';
  x.fillRect(-r * 0.4, -r * 0.52, r * 0.14, r * 1.04);
  x.fillRect(r * 0.26, -r * 0.52, r * 0.14, r * 1.04);
  x.fillStyle = 'rgba(255,255,255,.3)';
  x.fillRect(-r * 0.4, -r * 0.52, r * 0.05, r * 1.04);
  x.fillRect(r * 0.26, -r * 0.52, r * 0.05, r * 1.04);
  // 面板骨架示意（横线纹）
  x.strokeStyle = 'rgba(0,0,0,.22)';
  x.lineWidth = Math.max(0.8, s * 0.028);
  for (let i = 1; i < 3; i++) {
    x.beginPath(); x.moveTo(-r * 0.8, -r * 0.5 + i * r * 0.33); x.lineTo(-r * 0.44, -r * 0.5 + i * r * 0.33); x.stroke();
    x.beginPath(); x.moveTo(-r * 0.22, -r * 0.5 + i * r * 0.33); x.lineTo(r * 0.22, -r * 0.5 + i * r * 0.33); x.stroke();
    x.beginPath(); x.moveTo(r * 0.44, -r * 0.5 + i * r * 0.33); x.lineTo(r * 0.8, -r * 0.5 + i * r * 0.33); x.stroke();
  }
  // 打包标签
  x.fillStyle = '#e8ecf2';
  rrPath(x, r * 0.4, -r * 0.3, r * 0.34, r * 0.44, r * 0.04);
  x.fill();
  x.fillStyle = '#3a6ac0';
  x.fillRect(r * 0.45, -r * 0.22, r * 0.24, r * 0.06);
  x.fillRect(r * 0.45, -r * 0.1, r * 0.24, r * 0.06);
},

  // 散弹枪：双管并列 + 木质枪托 + 折管式结构
  'shotgun': (x, r, s, col) => {
    x.save();
    x.rotate(-0.1);
    // 双枪管（并列两根朝右上）
    x.strokeStyle = '#3a4048';
    x.lineWidth = r * 0.22;
    x.lineCap = 'round';
    x.beginPath(); x.moveTo(-r * 0.1, -r * 0.32); x.lineTo(r * 0.92, -r * 0.52); x.stroke();
    x.beginPath(); x.moveTo(-r * 0.1, -r * 0.08); x.lineTo(r * 0.92, -r * 0.28); x.stroke();
    // 枪口高光
    x.fillStyle = '#e8ecf2';
    x.beginPath(); x.arc(r * 0.92, -r * 0.52, r * 0.07, 0, 7); x.fill();
    x.beginPath(); x.arc(r * 0.92, -r * 0.28, r * 0.07, 0, 7); x.fill();
    // 机匣
    const g = x.createLinearGradient(0, -r * 0.5, 0, r * 0.2);
    g.addColorStop(0, lightenColor('#8a929c', 0.3));
    g.addColorStop(1, darkenColor('#8a929c', 0.35));
    x.fillStyle = g;
    rrPath(x, -r * 0.42, -r * 0.44, r * 0.62, r * 0.56, r * 0.08);
    x.fill();
    x.strokeStyle = 'rgba(16,20,28,.6)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 木质护木
    const wg = x.createLinearGradient(0, -r * 0.2, 0, r * 0.4);
    wg.addColorStop(0, lightenColor(col, 0.35));
    wg.addColorStop(1, darkenColor(col, 0.3));
    x.fillStyle = wg;
    rrPath(x, r * 0.16, -r * 0.18, r * 0.56, r * 0.34, r * 0.1);
    x.fill();
    x.strokeStyle = 'rgba(52,34,14,.6)';
    x.stroke();
    // 木质枪托（斜向后下）
    x.fillStyle = darkenColor(col, 0.12);
    x.beginPath();
    x.moveTo(-r * 0.42, -r * 0.34);
    x.lineTo(-r * 0.1, -r * 0.34);
    x.lineTo(-r * 0.34, r * 0.72);
    x.lineTo(-r * 0.84, r * 0.62);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(52,34,14,.65)';
    x.stroke();
    // 扳机护圈
    x.strokeStyle = darkenColor(col, 0.4);
    x.lineWidth = Math.max(1.2, s * 0.05);
    x.beginPath();
    x.arc(-r * 0.22, r * 0.24, r * 0.15, 0.3, Math.PI - 0.3);
    x.stroke();
    x.restore();
  },

  // 战斗散弹枪：泵动式 + 绿色战术涂装 + 弹仓管
  'combat-shotgun': (x, r, s, col) => {
    x.save();
    x.rotate(-0.1);
    // 枪管
    x.strokeStyle = '#2e343c';
    x.lineWidth = r * 0.2;
    x.lineCap = 'round';
    x.beginPath(); x.moveTo(-r * 0.2, -r * 0.34); x.lineTo(r * 0.95, -r * 0.46); x.stroke();
    // 枪口
    x.fillStyle = '#e8ecf2';
    x.beginPath(); x.arc(r * 0.95, -r * 0.46, r * 0.07, 0, 7); x.fill();
    // 下方管状弹仓（泵动轨道）
    x.strokeStyle = darkenColor(col, 0.25);
    x.lineWidth = r * 0.14;
    x.beginPath(); x.moveTo(-r * 0.16, -r * 0.02); x.lineTo(r * 0.66, -r * 0.12); x.stroke();
    // 泵动手柄
    x.fillStyle = lightenColor(col, 0.3);
    rrPath(x, r * 0.22, -r * 0.18, r * 0.3, r * 0.3, r * 0.08);
    x.fill();
    x.strokeStyle = 'rgba(40,26,12,.65)';
    x.lineWidth = Math.max(0.8, s * 0.035);
    x.stroke();
    // 机匣（绿色战术涂装）
    const g = x.createLinearGradient(0, -r * 0.44, 0, r * 0.24);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(1, darkenColor(col, 0.3));
    x.fillStyle = g;
    rrPath(x, -r * 0.5, -r * 0.4, r * 0.6, r * 0.6, r * 0.08);
    x.fill();
    x.strokeStyle = 'rgba(40,26,12,.65)';
    x.stroke();
    // 准星
    x.fillStyle = '#e8ecf2';
    x.fillRect(r * 0.5, -r * 0.66, r * 0.06, r * 0.14);
    // 战术枪托
    x.fillStyle = darkenColor(col, 0.2);
    x.beginPath();
    x.moveTo(-r * 0.5, -r * 0.3);
    x.lineTo(-r * 0.16, -r * 0.3);
    x.lineTo(-r * 0.4, r * 0.7);
    x.lineTo(-r * 0.88, r * 0.56);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(40,26,12,.65)';
    x.stroke();
    // 扳机护圈
    x.strokeStyle = darkenColor(col, 0.45);
    x.lineWidth = Math.max(1.2, s * 0.05);
    x.beginPath();
    x.arc(-r * 0.24, r * 0.2, r * 0.14, 0.3, Math.PI - 0.3);
    x.stroke();
    x.restore();
  },

  // 散弹枪弹：红色粗弹壳 + 黄铜底缘 + 弹头盖
  'shotgun-shell': (x, r, s, col) => {
    // 壳体（红色塑料壳）
    const g = x.createLinearGradient(-r * 0.4, 0, r * 0.4, 0);
    g.addColorStop(0, darkenColor(col, 0.28));
    g.addColorStop(0.42, lightenColor(col, 0.35));
    g.addColorStop(1, darkenColor(col, 0.35));
    x.fillStyle = g;
    rrPath(x, -r * 0.42, -r * 0.7, r * 0.84, r * 1.28, r * 0.16);
    x.fill();
    x.strokeStyle = 'rgba(70,20,8,.6)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 黄铜底缘
    x.fillStyle = '#c89a3a';
    rrPath(x, -r * 0.48, r * 0.48, r * 0.96, r * 0.2, r * 0.06);
    x.fill();
    x.strokeStyle = 'rgba(60,40,8,.6)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.stroke();
    // 弹头盖（黄铜浅杯）
    x.fillStyle = '#d8b04a';
    x.beginPath();
    x.arc(0, -r * 0.7, r * 0.34, Math.PI, 0);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(60,40,8,.55)';
    x.stroke();
    // 高光
    x.fillStyle = 'rgba(255,255,255,.3)';
    rrPath(x, -r * 0.3, -r * 0.58, r * 0.1, r * 0.9, r * 0.05);
    x.fill();
  },

  // 穿甲散弹枪弹：深红弹壳 + 钢质弹头 + 散射弹丸示意
  'piercing-shotgun-shell': (x, r, s, col) => {
    const g = x.createLinearGradient(-r * 0.4, 0, r * 0.4, 0);
    g.addColorStop(0, darkenColor(col, 0.3));
    g.addColorStop(0.42, lightenColor(col, 0.32));
    g.addColorStop(1, darkenColor(col, 0.38));
    x.fillStyle = g;
    rrPath(x, -r * 0.42, -r * 0.7, r * 0.84, r * 1.28, r * 0.16);
    x.fill();
    x.strokeStyle = 'rgba(80,20,6,.6)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 黄铜底缘
    x.fillStyle = '#c89a3a';
    rrPath(x, -r * 0.48, r * 0.48, r * 0.96, r * 0.2, r * 0.06);
    x.fill();
    x.strokeStyle = 'rgba(60,40,8,.6)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.stroke();
    // 钢质尖弹头
    x.fillStyle = '#c8ced8';
    x.beginPath();
    x.moveTo(0, -r * 0.98);
    x.lineTo(r * 0.24, -r * 0.56);
    x.lineTo(-r * 0.24, -r * 0.56);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(40,46,56,.6)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.stroke();
    // 穿透高速线（左右斜线示意穿甲）
    x.strokeStyle = 'rgba(255,255,255,.55)';
    x.lineWidth = Math.max(1, s * 0.035);
    x.lineCap = 'round';
    x.beginPath(); x.moveTo(-r * 0.7, -r * 0.9); x.lineTo(-r * 0.42, -r * 0.68); x.stroke();
    x.beginPath(); x.moveTo(r * 0.7, -r * 0.9); x.lineTo(r * 0.42, -r * 0.68); x.stroke();
  },

  // 集束手雷：绿色母雷 + 周围子雷捆扎
  'cluster-grenade': (x, r, s, col) => {
    // 三个子雷（下方扇形分布）
    for (const [px, py] of [[-r * 0.52, r * 0.38], [0, r * 0.52], [r * 0.52, r * 0.38]]) {
      x.fillStyle = darkenColor(col, 0.1);
      x.beginPath();
      x.arc(px, py, r * 0.24, 0, 7);
      x.fill();
      x.strokeStyle = 'rgba(18,36,10,.65)';
      x.lineWidth = Math.max(0.8, s * 0.03);
      x.stroke();
      // 子雷引信头
      x.fillStyle = '#8a929c';
      x.fillRect(px - r * 0.06, py - r * 0.34, r * 0.12, r * 0.12);
    }
    // 母雷（椭圆弹体）
    const g = x.createRadialGradient(-r * 0.12, -r * 0.24, r * 0.06, 0, 0, r * 0.5);
    g.addColorStop(0, lightenColor(col, 0.45));
    g.addColorStop(0.6, col);
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    x.beginPath();
    x.ellipse(0, -r * 0.12, r * 0.44, r * 0.56, 0, 0, 7);
    x.fill();
    x.strokeStyle = 'rgba(18,36,10,.65)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 母雷引信 + 拉环
    x.fillStyle = '#9aa4ac';
    rrPath(x, -r * 0.12, -r * 0.78, r * 0.24, r * 0.16, r * 0.05);
    x.fill();
    x.strokeStyle = '#c8b03a';
    x.lineWidth = Math.max(1.2, s * 0.05);
    x.beginPath();
    x.arc(r * 0.32, -r * 0.78, r * 0.13, -0.8, 2.4);
    x.stroke();
    // 母雷高光
    x.fillStyle = 'rgba(255,255,255,.3)';
    x.beginPath();
    x.ellipse(-r * 0.14, -r * 0.32, r * 0.12, r * 0.2, -0.4, 0, 7);
    x.fill();
  },

  // 火箭筒：肩扛发射管 + 前后筒口 + 握把
  'rocket-launcher': (x, r, s, col) => {
    x.save();
    x.rotate(-0.14);
    // 发射管（粗圆筒）
    const g = x.createLinearGradient(0, -r * 0.34, 0, r * 0.34);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    rrPath(x, -r * 0.86, -r * 0.26, r * 1.72, r * 0.5, r * 0.22);
    x.fill();
    x.strokeStyle = 'rgba(30,40,20,.65)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 筒口前后箍
    x.fillStyle = darkenColor(col, 0.3);
    rrPath(x, r * 0.6, -r * 0.28, r * 0.14, r * 0.54, r * 0.05);
    x.fill();
    rrPath(x, -r * 0.76, -r * 0.28, r * 0.14, r * 0.54, r * 0.05);
    x.fill();
    // 前筒口开孔
    x.fillStyle = '#14161c';
    x.beginPath();
    x.ellipse(r * 0.84, 0, r * 0.07, r * 0.16, 0, 0, 7);
    x.fill();
    // 准星 / 提把
    x.strokeStyle = darkenColor(col, 0.3);
    x.lineWidth = r * 0.08;
    x.lineCap = 'round';
    x.beginPath(); x.moveTo(-r * 0.3, -r * 0.26); x.lineTo(-r * 0.3, -r * 0.5); x.stroke();
    x.beginPath(); x.moveTo(-r * 0.44, -r * 0.5); x.lineTo(-r * 0.16, -r * 0.5); x.stroke();
    // 握把
    x.fillStyle = darkenColor(col, 0.25);
    x.beginPath();
    x.moveTo(-r * 0.16, r * 0.22);
    x.lineTo(r * 0.1, r * 0.22);
    x.lineTo(0, r * 0.62);
    x.lineTo(-r * 0.24, r * 0.58);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(30,40,20,.6)';
    x.lineWidth = Math.max(0.8, s * 0.035);
    x.stroke();
    // 火箭头示意（探出筒口）
    x.fillStyle = '#c04a2a';
    x.beginPath();
    x.moveTo(r * 0.92, 0);
    x.lineTo(r * 0.74, -r * 0.1);
    x.lineTo(r * 0.74, r * 0.1);
    x.closePath();
    x.fill();
    x.restore();
  },

  // 手雷：经典卵形手雷 + 保险杆 + 拉环
  'grenade': (x, r, s, col) => {
    // 卵形弹体
    const g = x.createRadialGradient(-r * 0.14, -r * 0.26, r * 0.06, 0, 0, r * 0.66);
    g.addColorStop(0, lightenColor(col, 0.48));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.42));
    x.fillStyle = g;
    x.beginPath();
    x.ellipse(0, r * 0.1, r * 0.46, r * 0.58, 0, 0, 7);
    x.fill();
    x.strokeStyle = 'rgba(18,36,10,.65)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 弹体刻纹
    x.strokeStyle = 'rgba(18,36,10,.35)';
    x.lineWidth = Math.max(0.7, s * 0.025);
    x.beginPath();
    x.ellipse(0, r * 0.1, r * 0.46, r * 0.24, 0, 0, Math.PI);
    x.stroke();
    x.beginPath();
    x.moveTo(-r * 0.44, r * 0.1); x.lineTo(r * 0.44, r * 0.1);
    x.stroke();
    // 引信头
    x.fillStyle = '#9aa4ac';
    rrPath(x, -r * 0.14, -r * 0.6, r * 0.28, r * 0.18, r * 0.05);
    x.fill();
    // 保险杆（斜向右侧）
    x.strokeStyle = '#c0c8d0';
    x.lineWidth = Math.max(1.5, s * 0.06);
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(0, -r * 0.58);
    x.quadraticCurveTo(r * 0.5, -r * 0.56, r * 0.44, -r * 0.06);
    x.stroke();
    // 拉环
    x.strokeStyle = '#c8b03a';
    x.lineWidth = Math.max(1.2, s * 0.05);
    x.beginPath();
    x.arc(r * 0.42, -r * 0.68, r * 0.14, -0.6, 2.8);
    x.stroke();
    // 高光
    x.fillStyle = 'rgba(255,255,255,.32)';
    x.beginPath();
    x.ellipse(-r * 0.16, -r * 0.14, r * 0.12, r * 0.22, -0.4, 0, 7);
    x.fill();
  },

  // 火箭弹：锥形弹头 + 圆柱弹体 + 尾翼
  'rocket': (x, r, s, col) => {
    x.save();
    x.rotate(-0.5);
    // 弹体
    const g = x.createLinearGradient(-r * 0.3, 0, r * 0.3, 0);
    g.addColorStop(0, darkenColor(col, 0.28));
    g.addColorStop(0.42, lightenColor(col, 0.36));
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    rrPath(x, -r * 0.24, -r * 0.28, r * 0.48, r * 0.92, r * 0.1);
    x.fill();
    x.strokeStyle = 'rgba(52,38,18,.6)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 锥形弹头
    x.fillStyle = '#b04a2a';
    x.beginPath();
    x.moveTo(0, -r * 0.82);
    x.lineTo(r * 0.24, -r * 0.26);
    x.lineTo(-r * 0.24, -r * 0.26);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(70,24,10,.6)';
    x.stroke();
    // 尾翼（两片）
    x.fillStyle = darkenColor(col, 0.2);
    x.beginPath();
    x.moveTo(-r * 0.22, r * 0.4);
    x.lineTo(-r * 0.5, r * 0.78);
    x.lineTo(-r * 0.22, r * 0.66);
    x.closePath();
    x.fill();
    x.beginPath();
    x.moveTo(r * 0.22, r * 0.4);
    x.lineTo(r * 0.5, r * 0.78);
    x.lineTo(r * 0.22, r * 0.66);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(52,38,18,.55)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.stroke();
    // 尾焰喷口
    x.fillStyle = '#3a3a40';
    x.fillRect(-r * 0.14, r * 0.62, r * 0.28, r * 0.12);
    // 弹体高光
    x.fillStyle = 'rgba(255,255,255,.28)';
    x.fillRect(-r * 0.16, -r * 0.2, r * 0.08, r * 0.78);
    x.restore();
  },

  // 爆炸火箭弹：重型弹体 + 橙红爆炸弹头 + 警示纹
  'explosive-rocket': (x, r, s, col) => {
    x.save();
    x.rotate(-0.5);
    // 粗弹体
    const g = x.createLinearGradient(-r * 0.34, 0, r * 0.34, 0);
    g.addColorStop(0, darkenColor(col, 0.3));
    g.addColorStop(0.42, lightenColor(col, 0.36));
    g.addColorStop(1, darkenColor(col, 0.42));
    x.fillStyle = g;
    rrPath(x, -r * 0.3, -r * 0.2, r * 0.6, r * 0.84, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(72,26,6,.6)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 爆炸弹头（圆钝重弹头）
    x.fillStyle = lightenColor(col, 0.2);
    x.beginPath();
    x.arc(0, -r * 0.24, r * 0.3, Math.PI, 0);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(72,26,6,.6)';
    x.stroke();
    // 弹头警示黑纹
    x.strokeStyle = '#26262a';
    x.lineWidth = Math.max(1.2, s * 0.05);
    x.beginPath(); x.moveTo(-r * 0.16, -r * 0.42); x.lineTo(-r * 0.04, -r * 0.24); x.stroke();
    x.beginPath(); x.moveTo(r * 0.06, -r * 0.44); x.lineTo(r * 0.18, -r * 0.26); x.stroke();
    // 尾翼
    x.fillStyle = darkenColor(col, 0.22);
    x.beginPath();
    x.moveTo(-r * 0.28, r * 0.34);
    x.lineTo(-r * 0.56, r * 0.74);
    x.lineTo(-r * 0.28, r * 0.62);
    x.closePath();
    x.fill();
    x.beginPath();
    x.moveTo(r * 0.28, r * 0.34);
    x.lineTo(r * 0.56, r * 0.74);
    x.lineTo(r * 0.28, r * 0.62);
    x.closePath();
    x.fill();
    // 尾焰喷口
    x.fillStyle = '#3a3a40';
    x.fillRect(-r * 0.16, r * 0.6, r * 0.32, r * 0.12);
    // 高光
    x.fillStyle = 'rgba(255,255,255,.28)';
    x.fillRect(-r * 0.2, -r * 0.14, r * 0.09, r * 0.72);
    x.restore();
  },

  // 火焰喷射器：喷射枪身 + 燃料软管 + 枪口火舌
  'flamethrower': (x, r, s, col) => {
    x.save();
    x.rotate(-0.08);
    // 主枪身
    const g = x.createLinearGradient(0, -r * 0.3, 0, r * 0.3);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.38));
    x.fillStyle = g;
    rrPath(x, -r * 0.4, -r * 0.26, r * 1.0, r * 0.44, r * 0.1);
    x.fill();
    x.strokeStyle = 'rgba(70,32,8,.65)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 喷射管 + 喷嘴
    x.strokeStyle = '#3a3a40';
    x.lineWidth = r * 0.16;
    x.lineCap = 'round';
    x.beginPath(); x.moveTo(r * 0.6, -r * 0.06); x.lineTo(r * 0.94, -r * 0.14); x.stroke();
    // 火舌（橙黄焰苗）
    const fg = x.createLinearGradient(r * 0.9, -r * 0.4, r * 0.9, 0);
    fg.addColorStop(0, '#ffe27a');
    fg.addColorStop(0.5, '#ff9a2a');
    fg.addColorStop(1, 'rgba(255,80,20,0)');
    x.fillStyle = fg;
    x.beginPath();
    x.moveTo(r * 0.88, -r * 0.2);
    x.quadraticCurveTo(r * 1.16, -r * 0.42, r * 1.1, -r * 0.02);
    x.quadraticCurveTo(r * 1.06, r * 0.1, r * 0.88, -r * 0.04);
    x.closePath();
    x.fill();
    // 燃料罐（背负小罐）
    x.fillStyle = darkenColor(col, 0.15);
    rrPath(x, -r * 0.86, -r * 0.34, r * 0.44, r * 0.72, r * 0.16);
    x.fill();
    x.strokeStyle = 'rgba(70,32,8,.6)';
    x.stroke();
    // 罐体高光
    x.fillStyle = 'rgba(255,255,255,.25)';
    x.fillRect(-r * 0.76, -r * 0.24, r * 0.08, r * 0.5);
    // 软管（枪身连罐）
    x.strokeStyle = '#4a3a2a';
    x.lineWidth = Math.max(1.5, s * 0.055);
    x.beginPath();
    x.moveTo(-r * 0.46, r * 0.08);
    x.quadraticCurveTo(-r * 0.2, r * 0.42, -r * 0.02, r * 0.16);
    x.stroke();
    // 握把
    x.fillStyle = darkenColor(col, 0.3);
    x.beginPath();
    x.moveTo(-r * 0.14, r * 0.18);
    x.lineTo(r * 0.1, r * 0.18);
    x.lineTo(0, r * 0.6);
    x.lineTo(-r * 0.22, r * 0.56);
    x.closePath();
    x.fill();
    x.restore();
  },

  // 火焰弹药：加压燃料罐（金属罐 + 压力表 + 火焰标）
  'flamethrower-ammo': (x, r, s, col) => {
    // 罐体
    const g = x.createLinearGradient(-r * 0.44, 0, r * 0.44, 0);
    g.addColorStop(0, darkenColor(col, 0.3));
    g.addColorStop(0.42, lightenColor(col, 0.4));
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    rrPath(x, -r * 0.44, -r * 0.56, r * 0.88, r * 1.24, r * 0.2);
    x.fill();
    x.strokeStyle = 'rgba(80,36,8,.65)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 顶部阀口
    x.fillStyle = '#9aa4ac';
    rrPath(x, -r * 0.14, -r * 0.78, r * 0.28, r * 0.22, r * 0.05);
    x.fill();
    x.strokeStyle = 'rgba(30,34,40,.6)';
    x.lineWidth = Math.max(0.8, s * 0.035);
    x.stroke();
    // 中部警示箍带
    x.fillStyle = '#d8b03a';
    x.fillRect(-r * 0.44, -r * 0.04, r * 0.88, r * 0.14);
    x.fillStyle = 'rgba(0,0,0,.0)';
    // 火焰标（罐面小火苗）
    x.fillStyle = '#ff8a2a';
    x.beginPath();
    x.moveTo(0, -r * 0.42);
    x.quadraticCurveTo(r * 0.2, -r * 0.1, 0, r * 0.12);
    x.quadraticCurveTo(-r * 0.2, -r * 0.1, 0, -r * 0.42);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(90,40,6,.5)';
    x.lineWidth = Math.max(0.7, s * 0.025);
    x.stroke();
    // 高光
    x.fillStyle = 'rgba(255,255,255,.28)';
    x.fillRect(-r * 0.32, -r * 0.46, r * 0.1, r * 0.98);
  },

  // 铀弹：绿色弹匣 + 三发铀尖弹 + 辐射微光
  'uranium-rounds-magazine': (x, r, s, col) => {
    _radGlow(x, r, 'rgba(140,240,120,.3)', 'rgba(140,240,120,0)');
    // 弹匣体
    const g = x.createLinearGradient(-r * 0.5, 0, r * 0.5, 0);
    g.addColorStop(0, darkenColor(col, 0.3));
    g.addColorStop(0.45, lightenColor(col, 0.32));
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(-r * 0.5, -r * 0.1);
    x.lineTo(-r * 0.42, -r * 0.6);
    x.lineTo(r * 0.42, -r * 0.6);
    x.lineTo(r * 0.5, -r * 0.1);
    x.quadraticCurveTo(0, r * 0.06, -r * 0.5, -r * 0.1);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(24,60,14,.65)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 三发铀尖头弹（绿色荧光尖）
    for (let i = -1; i <= 1; i++) {
      const px = i * r * 0.28;
      x.fillStyle = '#c2f0a8';
      x.beginPath();
      x.moveTo(px, -r * 0.92);
      x.lineTo(px + r * 0.09, -r * 0.64);
      x.lineTo(px - r * 0.09, -r * 0.64);
      x.closePath();
      x.fill();
      x.fillStyle = '#8ab86a';
      x.fillRect(px - r * 0.09, -r * 0.64, r * 0.18, r * 0.08);
    }
    // 弹带纹
    x.strokeStyle = 'rgba(30,70,16,.5)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.beginPath(); x.moveTo(-r * 0.44, -r * 0.26); x.lineTo(r * 0.44, -r * 0.26); x.stroke();
    // 底缘托板
    x.fillStyle = '#2e4a22';
    rrPath(x, -r * 0.56, r * 0.04, r * 1.12, r * 0.16, r * 0.04);
    x.fill();
  },

  // 原子弹：核航弹（卵形弹体 + 尾翼 + 三叶辐射符）
  'atomic-bomb': (x, r, s, col) => {
    _radGlow(x, r, 'rgba(150,255,180,.3)', 'rgba(150,255,180,0)');
    x.save();
    x.rotate(0.5);
    // 弹体（大卵形）
    const g = x.createLinearGradient(-r * 0.4, -r * 0.5, r * 0.4, r * 0.6);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.35));
    x.fillStyle = g;
    x.beginPath();
    x.ellipse(0, -r * 0.1, r * 0.4, r * 0.56, 0, 0, 7);
    x.fill();
    x.strokeStyle = 'rgba(40,70,50,.65)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 尾部锥 + 尾翼
    x.fillStyle = darkenColor(col, 0.2);
    x.beginPath();
    x.moveTo(-r * 0.36, r * 0.3);
    x.lineTo(r * 0.36, r * 0.3);
    x.lineTo(0, r * 0.62);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(40,70,50,.6)';
    x.lineWidth = Math.max(0.8, s * 0.035);
    x.stroke();
    x.fillStyle = darkenColor(col, 0.28);
    x.beginPath();
    x.moveTo(-r * 0.05, r * 0.34); x.lineTo(-r * 0.32, r * 0.86); x.lineTo(-r * 0.05, r * 0.6);
    x.closePath();
    x.fill();
    x.beginPath();
    x.moveTo(r * 0.05, r * 0.34); x.lineTo(r * 0.32, r * 0.86); x.lineTo(r * 0.05, r * 0.6);
    x.closePath();
    x.fill();
    // 三叶辐射符
    _radTrefoil(x, r * 0.62, 'rgba(40,90,50,.85)');
    // 高光
    x.fillStyle = 'rgba(255,255,255,.3)';
    x.beginPath();
    x.ellipse(-r * 0.14, -r * 0.36, r * 0.1, r * 0.18, -0.4, 0, 7);
    x.fill();
    x.restore();
  },

  // 铀炮弹：大口径弹壳 + 绿色铀弹头 + 辐射微光
  'uranium-cannon-shell': (x, r, s, col) => {
    _radGlow(x, r, 'rgba(140,240,120,.28)', 'rgba(140,240,120,0)');
    // 黄铜壳体
    _shellBody(x, r, s, '#b08a3a');
    // 绿色铀弹头（尖锥）
    const hg = x.createLinearGradient(-r * 0.3, -r * 0.6, r * 0.3, -r * 0.9);
    hg.addColorStop(0, darkenColor(col, 0.15));
    hg.addColorStop(0.5, lightenColor(col, 0.35));
    hg.addColorStop(1, darkenColor(col, 0.2));
    x.fillStyle = hg;
    x.beginPath();
    x.moveTo(0, -r * 1.0);
    x.lineTo(r * 0.34, -r * 0.44);
    x.lineTo(-r * 0.34, -r * 0.44);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(30,70,20,.65)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 弹头高光
    x.fillStyle = 'rgba(255,255,255,.3)';
    x.beginPath();
    x.moveTo(-r * 0.02, -r * 0.94);
    x.lineTo(r * 0.1, -r * 0.6);
    x.lineTo(-r * 0.1, -r * 0.6);
    x.closePath();
    x.fill();
  },

  // 毒胶囊：绿色玻璃胶囊 + 骷髅标记 + 毒雾
  'poison-capsule': (x, r, s, col) => {
    // 外圈毒雾（半透明绿雾）
    const fog = x.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 0.95);
    fog.addColorStop(0, 'rgba(120,210,80,.35)');
    fog.addColorStop(1, 'rgba(120,210,80,0)');
    x.fillStyle = fog;
    x.beginPath(); x.arc(0, 0, r * 0.95, 0, 7); x.fill();
    // 胶囊壳
    _capBody(x, r, s, col);
    // 罐内液体
    x.fillStyle = 'rgba(90,180,50,.8)';
    x.beginPath();
    x.arc(0, r * 0.2, r * 0.3, 0, 7);
    x.fill();
    // 骷髅头（简笔）
    x.fillStyle = '#f2f4ec';
    x.beginPath();
    x.arc(0, r * 0.12, r * 0.19, 0, 7);
    x.fill();
    x.fillRect(-r * 0.09, r * 0.22, r * 0.18, r * 0.12);
    x.fillStyle = '#1e2a16';
    x.beginPath(); x.arc(-r * 0.07, r * 0.1, r * 0.04, 0, 7); x.fill();
    x.beginPath(); x.arc(r * 0.07, r * 0.1, r * 0.04, 0, 7); x.fill();
    x.fillRect(-r * 0.02, r * 0.15, r * 0.04, r * 0.05);
  },

  // 减速胶囊：蓝色玻璃胶囊 + 雪花标记 + 冰晶
  'slowdown-capsule': (x, r, s, col) => {
    // 外圈冰霜微光
    const fog = x.createRadialGradient(0, 0, r * 0.3, 0, 0, r * 0.95);
    fog.addColorStop(0, 'rgba(110,190,240,.35)');
    fog.addColorStop(1, 'rgba(110,190,240,0)');
    x.fillStyle = fog;
    x.beginPath(); x.arc(0, 0, r * 0.95, 0, 7); x.fill();
    // 胶囊壳
    _capBody(x, r, s, col);
    // 罐内液体
    x.fillStyle = 'rgba(70,150,210,.8)';
    x.beginPath();
    x.arc(0, r * 0.2, r * 0.3, 0, 7);
    x.fill();
    // 六向雪花
    x.strokeStyle = '#eaf6ff';
    x.lineWidth = Math.max(1.2, s * 0.045);
    x.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 - Math.PI / 2;
      x.beginPath();
      x.moveTo(0, r * 0.2);
      x.lineTo(0 + Math.cos(a) * r * 0.22, r * 0.2 + Math.sin(a) * r * 0.22);
      x.stroke();
      // 分叉
      const bx = 0 + Math.cos(a) * r * 0.14, by = r * 0.2 + Math.sin(a) * r * 0.14;
      x.beginPath();
      x.moveTo(bx, by);
      x.lineTo(bx + Math.cos(a + 0.7) * r * 0.08, by + Math.sin(a + 0.7) * r * 0.08);
      x.stroke();
    }
  },

  // 激光炮塔：红宝石棱镜塔头 + 聚焦透镜 + 充能槽
  'laser-turret': (x, r, s, col) => {
    _turretBase(x, r, s, '#5a6068');
    // 塔头（梯形充能头）
    const g = x.createLinearGradient(-r * 0.4, -r * 0.6, r * 0.4, 0);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(0.6, col);
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(-r * 0.34, -r * 0.06);
    x.lineTo(-r * 0.22, -r * 0.6);
    x.lineTo(r * 0.22, -r * 0.6);
    x.lineTo(r * 0.34, -r * 0.06);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(70,16,22,.65)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.lineJoin = 'round';
    x.stroke();
    // 聚焦透镜（红宝石圆）
    const lg = x.createRadialGradient(-r * 0.04, -r * 0.44, r * 0.02, 0, -r * 0.4, r * 0.2);
    lg.addColorStop(0, '#ffd0d4');
    lg.addColorStop(0.4, '#ff4a5e');
    lg.addColorStop(1, '#7a1020');
    x.fillStyle = lg;
    x.beginPath();
    x.arc(0, -r * 0.4, r * 0.16, 0, 7);
    x.fill();
    x.strokeStyle = 'rgba(70,16,22,.6)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.stroke();
    // 两侧散热鳍
    x.fillStyle = darkenColor(col, 0.25);
    x.fillRect(-r * 0.42, -r * 0.34, r * 0.1, r * 0.26);
    x.fillRect(r * 0.32, -r * 0.34, r * 0.1, r * 0.26);
    // 基座充能灯
    x.fillStyle = '#ff4a5e';
    x.beginPath(); x.arc(-r * 0.24, r * 0.36, r * 0.06, 0, 7); x.fill();
    x.fillStyle = '#f8d84a';
    x.beginPath(); x.arc(r * 0.0, r * 0.36, r * 0.06, 0, 7); x.fill();
    x.fillStyle = '#4ac86a';
    x.beginPath(); x.arc(r * 0.24, r * 0.36, r * 0.06, 0, 7); x.fill();
  },

  // 火焰炮塔：重装甲塔头 + 双喷嘴 + 燃气管
  'flamethrower-turret': (x, r, s, col) => {
    _turretBase(x, r, s, '#5a5248');
    // 塔头装甲块
    const g = x.createLinearGradient(-r * 0.4, -r * 0.6, r * 0.4, 0);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(0.6, col);
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    rrPath(x, -r * 0.36, -r * 0.6, r * 0.72, r * 0.6, r * 0.1);
    x.fill();
    x.strokeStyle = 'rgba(80,40,8,.65)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 铆钉
    x.fillStyle = 'rgba(240,230,210,.7)';
    for (const [px, py] of [[-0.24, -0.48], [0.24, -0.48], [-0.24, -0.14], [0.24, -0.14]]) {
      x.beginPath(); x.arc(px * r, py * r, r * 0.045, 0, 7); x.fill();
    }
    // 双喷嘴（左右斜下）
    x.strokeStyle = '#3a3430';
    x.lineWidth = r * 0.11;
    x.lineCap = 'round';
    x.beginPath(); x.moveTo(-r * 0.18, -r * 0.02); x.lineTo(-r * 0.44, r * 0.2); x.stroke();
    x.beginPath(); x.moveTo(r * 0.18, -r * 0.02); x.lineTo(r * 0.44, r * 0.2); x.stroke();
    // 喷嘴火苗
    x.fillStyle = '#ff9a2a';
    for (const px of [-r * 0.5, r * 0.5]) {
      x.beginPath();
      x.moveTo(px, r * 0.16);
      x.quadraticCurveTo(px + r * 0.08, r * 0.34, px, r * 0.42);
      x.quadraticCurveTo(px - r * 0.08, r * 0.34, px, r * 0.16);
      x.closePath();
      x.fill();
    }
    // 塔头观察窗
    x.fillStyle = '#ffb03a';
    x.beginPath(); x.arc(0, -r * 0.4, r * 0.1, 0, 7); x.fill();
  },

  // 雷达：旋转天线锅面 + 扇形扫描波 + 支架
  'radar': (x, r, s, col) => {
    // 背景扫描波（扇形）
    const sg = x.createRadialGradient(0, r * 0.3, r * 0.1, 0, r * 0.3, r * 0.95);
    sg.addColorStop(0, 'rgba(90,220,160,.3)');
    sg.addColorStop(1, 'rgba(90,220,160,0)');
    x.fillStyle = sg;
    x.beginPath();
    x.moveTo(0, r * 0.3);
    x.arc(0, r * 0.3, r * 0.95, -Math.PI * 0.82, -Math.PI * 0.18);
    x.closePath();
    x.fill();
    // 锅面天线（斜置椭圆）
    x.save();
    x.rotate(-0.5);
    const g = x.createLinearGradient(-r * 0.5, -r * 0.3, r * 0.5, r * 0.3);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    x.beginPath();
    x.ellipse(0, 0, r * 0.56, r * 0.34, 0, 0, 7);
    x.fill();
    x.strokeStyle = 'rgba(20,40,40,.65)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 锅面内圈
    x.strokeStyle = 'rgba(255,255,255,.3)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.beginPath();
    x.ellipse(0, 0, r * 0.34, r * 0.2, 0, 0, 7);
    x.stroke();
    // 馈源杆
    x.strokeStyle = '#d8dee2';
    x.lineWidth = Math.max(1.2, s * 0.05);
    x.beginPath();
    x.moveTo(0, 0);
    x.lineTo(r * 0.4, -r * 0.28);
    x.stroke();
    x.fillStyle = '#f8d84a';
    x.beginPath(); x.arc(r * 0.4, -r * 0.28, r * 0.06, 0, 7); x.fill();
    x.restore();
    // 支架底座
    x.fillStyle = '#3a4248';
    rrPath(x, -r * 0.3, r * 0.5, r * 0.6, r * 0.24, r * 0.06);
    x.fill();
    x.strokeStyle = 'rgba(10,14,18,.6)';
    x.lineWidth = Math.max(0.8, s * 0.035);
    x.stroke();
    // 扫描点
    x.fillStyle = '#5adca0';
    x.beginPath(); x.arc(-r * 0.5, -r * 0.52, r * 0.06, 0, 7); x.fill();
    x.fillStyle = 'rgba(90,220,160,.5)';
    x.beginPath(); x.arc(-r * 0.66, -r * 0.36, r * 0.045, 0, 7); x.fill();
  },

  // 防御机器人胶囊：蓝色玻璃胶囊 + 护盾机器人剪影
  'defender-capsule': (x, r, s, col) => {
    // 胶囊壳
    _capBody(x, r, s, col);
    // 机器人剪影（圆头 + 护盾）
    x.fillStyle = '#eaf2fa';
    x.beginPath();
    x.arc(0, -r * 0.02, r * 0.22, 0, 7);
    x.fill();
    // 眼灯
    x.fillStyle = '#3a9ae0';
    x.beginPath(); x.arc(0, -r * 0.04, r * 0.08, 0, 7); x.fill();
    // 下方护盾弧
    x.strokeStyle = '#c8d8e8';
    x.lineWidth = Math.max(1.5, s * 0.055);
    x.beginPath();
    x.arc(0, r * 0.02, r * 0.3, 0.35, Math.PI - 0.35);
    x.stroke();
    // 两侧翼
    x.fillStyle = '#c8d8e8';
    x.beginPath();
    x.moveTo(-r * 0.18, r * 0.06);
    x.lineTo(-r * 0.34, r * 0.22);
    x.lineTo(-r * 0.16, r * 0.18);
    x.closePath();
    x.fill();
    x.beginPath();
    x.moveTo(r * 0.18, r * 0.06);
    x.lineTo(r * 0.34, r * 0.22);
    x.lineTo(r * 0.16, r * 0.18);
    x.closePath();
    x.fill();
  },

  // 干扰机器人胶囊：金色玻璃胶囊 + 干扰波纹标记
  'distractor-capsule': (x, r, s, col) => {
    // 胶囊壳
    _capBody(x, r, s, col);
    // 中央信标点
    x.fillStyle = '#fff0c0';
    x.beginPath();
    x.arc(0, r * 0.1, r * 0.1, 0, 7);
    x.fill();
    // 同心干扰波纹（三圈）
    x.strokeStyle = 'rgba(255,230,150,.9)';
    for (let i = 1; i <= 3; i++) {
      x.lineWidth = Math.max(0.8, s * (0.045 - i * 0.008));
      x.beginPath();
      x.arc(0, r * 0.1, r * (0.14 + i * 0.09), -Math.PI * 0.9, -Math.PI * 0.1);
      x.stroke();
      x.beginPath();
      x.arc(0, r * 0.1, r * (0.14 + i * 0.09), Math.PI * 0.1, Math.PI * 0.9);
      x.stroke();
    }
  },

  // 破坏机器人胶囊：红色玻璃胶囊 + 攻击机器人剪影
  'destroyer-capsule': (x, r, s, col) => {
    // 胶囊壳
    _capBody(x, r, s, col);
    // 机器人剪影（尖角攻击形态）
    x.fillStyle = '#f5e0e0';
    x.beginPath();
    x.moveTo(0, -r * 0.3);
    x.lineTo(r * 0.22, r * 0.02);
    x.lineTo(r * 0.12, r * 0.3);
    x.lineTo(-r * 0.12, r * 0.3);
    x.lineTo(-r * 0.22, r * 0.02);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(90,20,20,.6)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.stroke();
    // 红色眼灯（怒目）
    x.fillStyle = '#e03040';
    x.beginPath(); x.arc(-r * 0.08, -r * 0.04, r * 0.05, 0, 7); x.fill();
    x.beginPath(); x.arc(r * 0.08, -r * 0.04, r * 0.05, 0, 7); x.fill();
    // 下方交叉炮管
    x.strokeStyle = '#c8b8b8';
    x.lineWidth = Math.max(1.2, s * 0.05);
    x.lineCap = 'round';
    x.beginPath(); x.moveTo(-r * 0.16, r * 0.12); x.lineTo(r * 0.16, r * 0.34); x.stroke();
    x.beginPath(); x.moveTo(r * 0.16, r * 0.12); x.lineTo(-r * 0.16, r * 0.34); x.stroke();
  },

  // 炮弹：大口径黄铜弹壳 + 钢质弹头
  'cannon-shell': (x, r, s, col) => {
    _shellBody(x, r, s, col);
    // 钢质尖弹头
    const hg = x.createLinearGradient(-r * 0.3, -r * 0.6, r * 0.3, -r * 0.9);
    hg.addColorStop(0, '#8a929c');
    hg.addColorStop(0.5, '#d8dee6');
    hg.addColorStop(1, '#6a727c');
    x.fillStyle = hg;
    x.beginPath();
    x.moveTo(0, -r * 1.0);
    x.lineTo(r * 0.34, -r * 0.44);
    x.lineTo(-r * 0.34, -r * 0.44);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(40,44,52,.6)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 弹头箍带
    x.strokeStyle = 'rgba(40,44,52,.5)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.beginPath(); x.moveTo(-r * 0.3, -r * 0.52); x.lineTo(r * 0.3, -r * 0.52); x.stroke();
  },

  // 爆炸炮弹：弹头红色警示涂装 + 爆炸符号
  'explosive-cannon-shell': (x, r, s, col) => {
    _shellBody(x, r, s, col);
    // 红色警示弹头
    const hg = x.createLinearGradient(-r * 0.3, -r * 0.6, r * 0.3, -r * 0.9);
    hg.addColorStop(0, darkenColor('#d04a2a', 0.2));
    hg.addColorStop(0.5, lightenColor('#d04a2a', 0.3));
    hg.addColorStop(1, darkenColor('#d04a2a', 0.3));
    x.fillStyle = hg;
    x.beginPath();
    x.moveTo(0, -r * 1.0);
    x.lineTo(r * 0.34, -r * 0.44);
    x.lineTo(-r * 0.34, -r * 0.44);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(80,20,8,.6)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 弹头爆炸星形符号
    x.fillStyle = '#ffe27a';
    x.save();
    x.translate(0, -r * 0.66);
    x.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI / 5 - Math.PI / 2;
      const rr = i % 2 === 0 ? r * 0.11 : r * 0.05;
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    }
    x.closePath();
    x.fill();
    x.restore();
  },

  // 铀爆炸炮弹：绿色铀弹头 + 爆炸星符 + 辐射微光
  'explosive-uranium-cannon-shell': (x, r, s, col) => {
    _radGlow(x, r, 'rgba(140,240,120,.3)', 'rgba(140,240,120,0)');
    _shellBody(x, r, s, '#b08a3a');
    // 绿色铀弹头
    const hg = x.createLinearGradient(-r * 0.3, -r * 0.6, r * 0.3, -r * 0.9);
    hg.addColorStop(0, darkenColor(col, 0.2));
    hg.addColorStop(0.5, lightenColor(col, 0.35));
    hg.addColorStop(1, darkenColor(col, 0.25));
    x.fillStyle = hg;
    x.beginPath();
    x.moveTo(0, -r * 1.0);
    x.lineTo(r * 0.34, -r * 0.44);
    x.lineTo(-r * 0.34, -r * 0.44);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(30,70,20,.65)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 黄色爆炸星符
    x.fillStyle = '#ffe27a';
    x.save();
    x.translate(0, -r * 0.66);
    x.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = i * Math.PI / 5 - Math.PI / 2;
      const rr = i % 2 === 0 ? r * 0.11 : r * 0.05;
      const px = Math.cos(a) * rr, py = Math.sin(a) * rr;
      i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    }
    x.closePath();
    x.fill();
    x.restore();
  },

  // 轻型护甲：浅卡其护甲背心（肩带 + 胸甲板）
  'light-armor': (x, r, s, col) => {
    // 背心主体（梯形）
    const g = x.createLinearGradient(-r * 0.6, -r * 0.6, r * 0.6, r * 0.7);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.35));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(-r * 0.56, -r * 0.5);
    x.lineTo(-r * 0.2, -r * 0.66);
    x.lineTo(r * 0.2, -r * 0.66);
    x.lineTo(r * 0.56, -r * 0.5);
    x.lineTo(r * 0.5, r * 0.66);
    x.lineTo(-r * 0.5, r * 0.66);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(60,60,44,.6)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.lineJoin = 'round';
    x.stroke();
    // 领口开口
    x.fillStyle = '#2a2a26';
    x.beginPath();
    x.moveTo(-r * 0.2, -r * 0.66);
    x.quadraticCurveTo(0, -r * 0.4, r * 0.2, -r * 0.66);
    x.closePath();
    x.fill();
    // 胸口甲板
    x.fillStyle = lightenColor(col, 0.2);
    rrPath(x, -r * 0.3, -r * 0.24, r * 0.6, r * 0.4, r * 0.08);
    x.fill();
    x.strokeStyle = 'rgba(60,60,44,.5)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.stroke();
    // 高光
    x.fillStyle = 'rgba(255,255,255,.22)';
    rrPath(x, -r * 0.44, -r * 0.5, r * 0.24, r * 0.9, r * 0.1);
    x.fill();
  },

  // 重型护甲：深灰重装背心 + 铆钉 + 加厚甲板
  'heavy-armor': (x, r, s, col) => {
    // 重装主体（更宽厚重）
    const g = x.createLinearGradient(-r * 0.66, -r * 0.6, r * 0.66, r * 0.7);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(-r * 0.62, -r * 0.5);
    x.lineTo(-r * 0.22, -r * 0.7);
    x.lineTo(r * 0.22, -r * 0.7);
    x.lineTo(r * 0.62, -r * 0.5);
    x.lineTo(r * 0.56, r * 0.7);
    x.lineTo(-r * 0.56, r * 0.7);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(26,26,22,.65)';
    x.lineWidth = Math.max(1, s * 0.05);
    x.lineJoin = 'round';
    x.stroke();
    // 领口
    x.fillStyle = '#1c1c1a';
    x.beginPath();
    x.moveTo(-r * 0.22, -r * 0.7);
    x.quadraticCurveTo(0, -r * 0.42, r * 0.22, -r * 0.7);
    x.closePath();
    x.fill();
    // 加厚胸甲板（双层）
    x.fillStyle = lightenColor(col, 0.18);
    rrPath(x, -r * 0.4, -r * 0.26, r * 0.8, r * 0.44, r * 0.08);
    x.fill();
    x.strokeStyle = 'rgba(26,26,22,.55)';
    x.lineWidth = Math.max(0.8, s * 0.035);
    x.stroke();
    // 铆钉
    x.fillStyle = '#b8bcc2';
    for (const [px, py] of [[-0.3, -0.16], [0.3, -0.16], [-0.3, 0.08], [0.3, 0.08]]) {
      x.beginPath(); x.arc(px * r, py * r, r * 0.05, 0, 7); x.fill();
    }
    // 肩甲块
    x.fillStyle = darkenColor(col, 0.2);
    rrPath(x, -r * 0.72, -r * 0.56, r * 0.2, r * 0.3, r * 0.06);
    x.fill();
    rrPath(x, r * 0.52, -r * 0.56, r * 0.2, r * 0.3, r * 0.06);
    x.fill();
    // 高光
    x.fillStyle = 'rgba(255,255,255,.2)';
    rrPath(x, -r * 0.48, -r * 0.5, r * 0.22, r * 1.0, r * 0.1);
    x.fill();
  },

  // 地雷：圆盘雷体 + 顶部引信 + 警示纹
  'land-mine': (x, r, s, col) => {
    // 雷体（扁圆盘）
    const g = x.createLinearGradient(-r * 0.7, -r * 0.3, r * 0.7, r * 0.5);
    g.addColorStop(0, lightenColor(col, 0.38));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    x.beginPath();
    x.ellipse(0, r * 0.14, r * 0.72, r * 0.5, 0, 0, 7);
    x.fill();
    x.strokeStyle = 'rgba(50,42,28,.65)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 顶部平面
    x.fillStyle = lightenColor(col, 0.22);
    x.beginPath();
    x.ellipse(0, -r * 0.08, r * 0.56, r * 0.34, 0, 0, 7);
    x.fill();
    x.strokeStyle = 'rgba(50,42,28,.45)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.stroke();
    // 中央引信帽
    x.fillStyle = '#8a2a2a';
    x.beginPath(); x.arc(0, -r * 0.14, r * 0.14, 0, 7); x.fill();
    x.strokeStyle = 'rgba(50,10,10,.6)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.stroke();
    // 引信按钮
    x.fillStyle = '#d04a3a';
    x.beginPath(); x.arc(0, -r * 0.16, r * 0.07, 0, 7); x.fill();
    // 边缘警示刻纹
    x.strokeStyle = 'rgba(50,42,28,.35)';
    x.lineWidth = Math.max(0.7, s * 0.025);
    x.beginPath();
    x.ellipse(0, r * 0.14, r * 0.5, r * 0.32, 0, 0, 7);
    x.stroke();
  },

  // 炮兵连：超远程巨炮（长炮管 + 重型基座）
  'artillery-turret': (x, r, s, col) => {
    // 重型履带基座
    const bg = x.createLinearGradient(-r * 0.8, 0, r * 0.8, r * 0.7);
    bg.addColorStop(0, lightenColor(col, 0.35));
    bg.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = bg;
    rrPath(x, -r * 0.8, r * 0.1, r * 1.6, r * 0.62, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(40,28,16,.65)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 履带轮
    x.fillStyle = '#2e2a26';
    for (let i = 0; i < 4; i++) {
      x.beginPath(); x.arc(-r * 0.56 + i * r * 0.38, r * 0.62, r * 0.09, 0, 7); x.fill();
    }
    // 炮塔体
    const tg = x.createLinearGradient(0, -r * 0.5, 0, r * 0.2);
    tg.addColorStop(0, lightenColor(col, 0.4));
    tg.addColorStop(1, darkenColor(col, 0.35));
    x.fillStyle = tg;
    rrPath(x, -r * 0.36, -r * 0.4, r * 0.72, r * 0.6, r * 0.1);
    x.fill();
    x.strokeStyle = 'rgba(40,28,16,.6)';
    x.stroke();
    // 超长炮管（朝右上扬起）
    x.strokeStyle = '#3a342c';
    x.lineWidth = r * 0.14;
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(r * 0.1, -r * 0.22);
    x.lineTo(r * 0.9, -r * 0.72);
    x.stroke();
    // 炮口制退器
    x.fillStyle = '#22201c';
    x.save();
    x.translate(r * 0.9, -r * 0.72);
    x.rotate(-0.5);
    x.fillRect(-r * 0.1, -r * 0.09, r * 0.24, r * 0.18);
    x.restore();
    // 炮口高光
    x.fillStyle = '#e8ecf2';
    x.beginPath(); x.arc(r * 0.94, -r * 0.76, r * 0.05, 0, 7); x.fill();
    // 塔体警示条纹
    x.fillStyle = '#d8b03a';
    x.fillRect(-r * 0.36, r * 0.06, r * 0.72, r * 0.08);
  },

  // 炮弹（炮兵）：巨型弹壳 + 重型钝弹头
  'artillery-shell': (x, r, s, col) => {
    // 加宽壳体
    const g = x.createLinearGradient(-r * 0.52, 0, r * 0.52, 0);
    g.addColorStop(0, darkenColor(col, 0.3));
    g.addColorStop(0.42, lightenColor(col, 0.36));
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(-r * 0.5, r * 0.66);
    x.lineTo(-r * 0.5, -r * 0.16);
    x.lineTo(-r * 0.2, -r * 0.56);
    x.lineTo(r * 0.2, -r * 0.56);
    x.lineTo(r * 0.5, -r * 0.16);
    x.lineTo(r * 0.5, r * 0.66);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(58,42,20,.6)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 底缘
    x.fillStyle = '#5a4620';
    rrPath(x, -r * 0.6, r * 0.62, r * 1.2, r * 0.18, r * 0.06);
    x.fill();
    x.strokeStyle = 'rgba(30,22,8,.6)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.stroke();
    // 钝重弹头
    const hg = x.createLinearGradient(-r * 0.36, -r * 0.5, r * 0.36, -r * 0.95);
    hg.addColorStop(0, '#6a727c');
    hg.addColorStop(0.5, '#d8dee6');
    hg.addColorStop(1, '#5a626c');
    x.fillStyle = hg;
    x.beginPath();
    x.moveTo(0, -r * 1.02);
    x.quadraticCurveTo(r * 0.44, -r * 0.72, r * 0.42, -r * 0.4);
    x.lineTo(-r * 0.42, -r * 0.4);
    x.quadraticCurveTo(-r * 0.44, -r * 0.72, 0, -r * 1.02);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(40,44,52,.6)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 弹体高光
    x.fillStyle = 'rgba(255,255,255,.28)';
    x.fillRect(-r * 0.36, -r * 0.44, r * 0.1, r * 1.0);
  },

// 机枪炮塔：深灰棱形塔体 + 四联枪管 + 弹药口
'gun-turret': (x, r, s, col) => {
  // 基座
  const bg = x.createLinearGradient(-r * 0.8, -r * 0.4, r * 0.8, r * 0.8);
  bg.addColorStop(0, lightenColor(col, 0.35));
  bg.addColorStop(1, darkenColor(col, 0.45));
  x.fillStyle = bg;
  x.beginPath();
  x.moveTo(-r * 0.82, r * 0.2);
  x.lineTo(-r * 0.5, -r * 0.28);
  x.lineTo(r * 0.5, -r * 0.28);
  x.lineTo(r * 0.82, r * 0.2);
  x.lineTo(r * 0.5, r * 0.78);
  x.lineTo(-r * 0.5, r * 0.78);
  x.closePath();
  x.fill();
  x.strokeStyle = 'rgba(12,12,16,.6)';
  x.lineWidth = Math.max(1, s * 0.045);
  x.lineJoin = 'round';
  x.stroke();
  // 塔体（梯形炮座）
  x.fillStyle = lightenColor(col, 0.22);
  rrPath(x, -r * 0.42, -r * 0.56, r * 0.84, r * 0.9, r * 0.1);
  x.fill();
  x.strokeStyle = 'rgba(12,12,16,.55)';
  x.stroke();
  // 四联枪管（朝右上）
  x.strokeStyle = '#1e222a';
  x.lineCap = 'round';
  x.lineWidth = r * 0.1;
  for (let i = 0; i < 4; i++) {
    const oy = -r * 0.34 + i * r * 0.13;
    x.beginPath();
    x.moveTo(r * 0.06, oy + r * 0.06);
    x.lineTo(r * 0.7, oy - r * 0.32);
    x.stroke();
  }
  // 枪口高光
  x.fillStyle = '#e8ecf2';
  x.beginPath(); x.arc(r * 0.7, -r * 0.36, r * 0.05, 0, 7); x.fill();
  // 塔体观察窗
  x.fillStyle = '#d04848';
  rrPath(x, -r * 0.24, -r * 0.36, r * 0.34, r * 0.14, r * 0.04);
  x.fill();
},

// 石墙：三块错缝石块墙体 + 顶部圆石
'stone-wall': (x, r, s, col) => {
  const stone = (px, py, w, h, rad) => {
    const g = x.createLinearGradient(px, py, px, py + h);
    g.addColorStop(0, lightenColor(col, 0.32));
    g.addColorStop(1, darkenColor(col, 0.35));
    x.fillStyle = g;
    rrPath(x, px, py, w, h, rad);
    x.fill();
    x.strokeStyle = 'rgba(40,36,28,.5)';
    x.lineWidth = Math.max(0.7, s * 0.03);
    x.stroke();
  };
  // 顶部圆石
  stone(-r * 0.5, -r * 0.84, r * 1.0, r * 0.36, r * 0.18);
  // 中层两块
  stone(-r * 0.88, -r * 0.38, r * 0.84, r * 0.42, r * 0.08);
  stone(r * 0.06, -r * 0.38, r * 0.84, r * 0.42, r * 0.08);
  // 底层错缝
  stone(-r * 0.88, r * 0.14, r * 0.5, r * 0.42, r * 0.08);
  stone(-r * 0.28, r * 0.14, r * 0.62, r * 0.42, r * 0.08);
  stone(r * 0.44, r * 0.14, r * 0.46, r * 0.42, r * 0.08);
},

// 门：墙体门框 + 半开双开滑门 + 警示条纹
'gate': (x, r, s, col) => {
  // 门框墙体（左右柱 + 顶梁）
  const wg = x.createLinearGradient(-r * 0.9, -r * 0.9, r * 0.9, r * 0.9);
  wg.addColorStop(0, lightenColor(col, 0.35));
  wg.addColorStop(1, darkenColor(col, 0.4));
  x.fillStyle = wg;
  rrPath(x, -r * 0.92, -r * 0.6, r * 0.26, r * 1.5, r * 0.05);
  x.fill();
  rrPath(x, r * 0.66, -r * 0.6, r * 0.26, r * 1.5, r * 0.05);
  x.fill();
  rrPath(x, -r * 0.92, -r * 0.88, r * 1.84, r * 0.26, r * 0.05);
  x.fill();
  x.strokeStyle = 'rgba(30,28,22,.55)';
  x.lineWidth = Math.max(0.8, s * 0.035);
  for (const [px, py, w, h] of [[-r * 0.92, -r * 0.6, r * 0.26, r * 1.5], [r * 0.66, -r * 0.6, r * 0.26, r * 1.5], [-r * 0.92, -r * 0.88, r * 1.84, r * 0.26]]) {
    rrPath(x, px, py, w, h, r * 0.05);
    x.stroke();
  }
  // 左滑门（半开，带警示斜纹）
  const dg = x.createLinearGradient(-r * 0.66, 0, -r * 0.1, 0);
  dg.addColorStop(0, lightenColor('#9aa4a8', 0.3));
  dg.addColorStop(1, darkenColor('#9aa4a8', 0.3));
  x.fillStyle = dg;
  rrPath(x, -r * 0.66, -r * 0.34, r * 0.56, r * 1.24, r * 0.05);
  x.fill();
  x.strokeStyle = 'rgba(30,28,22,.5)';
  x.lineWidth = Math.max(0.8, s * 0.035);
  x.stroke();
  // 警示斜纹
  x.strokeStyle = '#c8a02a';
  x.lineWidth = Math.max(1.2, s * 0.05);
  for (let i = 0; i < 3; i++) {
    const yy = -r * 0.24 + i * r * 0.4;
    x.beginPath();
    x.moveTo(-r * 0.62, yy + r * 0.18); x.lineTo(-r * 0.44, yy);
    x.stroke();
  }
  // 右门缝阴影（暗示另一扇滑走）
  x.fillStyle = 'rgba(0,0,0,.3)';
  x.fillRect(r * 0.12, -r * 0.34, r * 0.5, r * 1.24);
  x.fillStyle = 'rgba(0,0,0,.45)';
  x.fillRect(r * 0.12, -r * 0.34, r * 0.1, r * 1.24);
},

// 弹药匣：黄铜弹匣 + 三发子弹头 + 弹壳底缘
'firearm-magazine': (x, r, s, col) => {
  // 弹匣体（圆角矩形微收）
  const g = x.createLinearGradient(-r * 0.5, 0, r * 0.5, 0);
  g.addColorStop(0, darkenColor(col, 0.28));
  g.addColorStop(0.45, lightenColor(col, 0.35));
  g.addColorStop(1, darkenColor(col, 0.38));
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(-r * 0.5, -r * 0.1);
  x.lineTo(-r * 0.42, -r * 0.66);
  x.lineTo(r * 0.42, -r * 0.66);
  x.lineTo(r * 0.5, -r * 0.1);
  x.quadraticCurveTo(0, r * 0.06, -r * 0.5, -r * 0.1);
  x.closePath();
  x.fill();
  x.strokeStyle = 'rgba(50,34,10,.6)';
  x.lineWidth = Math.max(1, s * 0.04);
  x.stroke();
  // 三发露出弹头（铜色圆头）
  for (let i = -1; i <= 1; i++) {
    const px = i * r * 0.28;
    x.fillStyle = '#d8a83a';
    x.beginPath(); x.arc(px, -r * 0.74, r * 0.11, Math.PI, 0); x.fill();
    x.fillStyle = '#b8802a';
    x.fillRect(px - r * 0.11, -r * 0.74, r * 0.22, r * 0.12);
  }
  // 匣体弹带纹
  x.strokeStyle = 'rgba(90,60,14,.5)';
  x.lineWidth = Math.max(0.8, s * 0.03);
  x.beginPath(); x.moveTo(-r * 0.44, -r * 0.28); x.lineTo(r * 0.44, -r * 0.28); x.stroke();
  x.beginPath(); x.moveTo(-r * 0.46, -r * 0.02); x.lineTo(r * 0.46, -r * 0.02); x.stroke();
  // 底缘托板
  x.fillStyle = '#5a4a2a';
  rrPath(x, -r * 0.56, r * 0.04, r * 1.12, r * 0.16, r * 0.04);
  x.fill();
},

// 穿甲弹：红铜弹匣 + 尖头穿甲弹芯 + 高速线
'piercing-rounds-magazine': (x, r, s, col) => {
  const g = x.createLinearGradient(-r * 0.5, 0, r * 0.5, 0);
  g.addColorStop(0, darkenColor(col, 0.28));
  g.addColorStop(0.45, lightenColor(col, 0.3));
  g.addColorStop(1, darkenColor(col, 0.38));
  x.fillStyle = g;
  x.beginPath();
  x.moveTo(-r * 0.5, -r * 0.1);
  x.lineTo(-r * 0.42, -r * 0.66);
  x.lineTo(r * 0.42, -r * 0.66);
  x.lineTo(r * 0.5, -r * 0.1);
  x.quadraticCurveTo(0, r * 0.06, -r * 0.5, -r * 0.1);
  x.closePath();
  x.fill();
  x.strokeStyle = 'rgba(60,16,10,.6)';
  x.lineWidth = Math.max(1, s * 0.04);
  x.stroke();
  // 三发穿甲尖头弹（钢芯尖锥）
  for (let i = -1; i <= 1; i++) {
    const px = i * r * 0.28;
    x.fillStyle = '#c8ced8';
    x.beginPath();
    x.moveTo(px, -r * 0.94);
    x.lineTo(px + r * 0.09, -r * 0.7);
    x.lineTo(px - r * 0.09, -r * 0.7);
    x.closePath();
    x.fill();
    x.fillStyle = '#8a929c';
    x.fillRect(px - r * 0.09, -r * 0.7, r * 0.18, r * 0.08);
  }
  // 弹带纹
  x.strokeStyle = 'rgba(90,24,14,.5)';
  x.lineWidth = Math.max(0.8, s * 0.03);
  x.beginPath(); x.moveTo(-r * 0.44, -r * 0.28); x.lineTo(r * 0.44, -r * 0.28); x.stroke();
  // 底缘托板
  x.fillStyle = '#4a2a22';
  rrPath(x, -r * 0.56, r * 0.04, r * 1.12, r * 0.16, r * 0.04);
  x.fill();
},

// 手枪：紧凑手枪侧影（握把 + 套筒 + 短枪管）
'pistol': (x, r, s, col) => {
  x.save();
  x.rotate(-0.08);
  // 套筒（上滑部）
  const g = x.createLinearGradient(0, -r * 0.5, 0, -r * 0.1);
  g.addColorStop(0, lightenColor(col, 0.42));
  g.addColorStop(1, darkenColor(col, 0.35));
  x.fillStyle = g;
  rrPath(x, -r * 0.72, -r * 0.42, r * 1.58, r * 0.32, r * 0.06);
  x.fill();
  x.strokeStyle = 'rgba(20,22,28,.6)';
  x.lineWidth = Math.max(1, s * 0.04);
  x.stroke();
  // 枪管口
  x.fillStyle = '#14161c';
  x.fillRect(r * 0.78, -r * 0.36, r * 0.1, r * 0.16);
  // 握把（后倾）
  x.fillStyle = darkenColor(col, 0.15);
  x.beginPath();
  x.moveTo(-r * 0.68, -r * 0.12);
  x.lineTo(-r * 0.28, -r * 0.12);
  x.lineTo(-r * 0.18, r * 0.72);
  x.lineTo(-r * 0.6, r * 0.72);
  x.closePath();
  x.fill();
  x.strokeStyle = 'rgba(20,22,28,.6)';
  x.stroke();
  // 握把防滑纹
  x.strokeStyle = 'rgba(255,255,255,.25)';
  x.lineWidth = Math.max(0.7, s * 0.025);
  for (let i = 0; i < 4; i++) {
    x.beginPath();
    x.moveTo(-r * 0.62, -r * 0.02 + i * r * 0.18);
    x.lineTo(-r * 0.28, r * 0.04 + i * r * 0.18);
    x.stroke();
  }
  // 扳机护圈
  x.strokeStyle = darkenColor(col, 0.4);
  x.lineWidth = Math.max(1.2, s * 0.05);
  x.beginPath();
  x.arc(-r * 0.22, r * 0.06, r * 0.16, 0.2, Math.PI - 0.4);
  x.stroke();
  x.restore();
},

// 冲锋枪：长套筒 + 弹匣下插 + 折叠枪托
'submachine-gun': (x, r, s, col) => {
  x.save();
  x.rotate(-0.06);
  // 长套筒
  const g = x.createLinearGradient(0, -r * 0.5, 0, -r * 0.08);
  g.addColorStop(0, lightenColor(col, 0.4));
  g.addColorStop(1, darkenColor(col, 0.32));
  x.fillStyle = g;
  rrPath(x, -r * 0.5, -r * 0.44, r * 1.5, r * 0.34, r * 0.06);
  x.fill();
  x.strokeStyle = 'rgba(16,20,28,.6)';
  x.lineWidth = Math.max(1, s * 0.04);
  x.stroke();
  // 散热孔
  x.fillStyle = 'rgba(10,14,20,.55)';
  for (let i = 0; i < 3; i++) {
    x.beginPath(); x.arc(-r * 0.1 + i * r * 0.18, -r * 0.27, r * 0.05, 0, 7); x.fill();
  }
  // 枪管 + 准星
  x.fillStyle = '#14161c';
  x.fillRect(r * 0.98, -r * 0.34, r * 0.16, r * 0.14);
  x.fillRect(r * 0.6, -r * 0.56, r * 0.06, r * 0.14);
  // 下插弹匣
  x.fillStyle = darkenColor(col, 0.2);
  x.beginPath();
  x.moveTo(-r * 0.16, -r * 0.1);
  x.lineTo(r * 0.16, -r * 0.1);
  x.lineTo(r * 0.1, r * 0.78);
  x.lineTo(-r * 0.1, r * 0.78);
  x.closePath();
  x.fill();
  x.strokeStyle = 'rgba(16,20,28,.6)';
  x.stroke();
  // 握把（后部）
  x.fillStyle = darkenColor(col, 0.3);
  x.beginPath();
  x.moveTo(-r * 0.5, -r * 0.1);
  x.lineTo(-r * 0.18, -r * 0.1);
  x.lineTo(-r * 0.3, r * 0.5);
  x.lineTo(-r * 0.64, r * 0.42);
  x.closePath();
  x.fill();
  // 折叠枪托（后伸杆）
  x.strokeStyle = darkenColor(col, 0.25);
  x.lineWidth = r * 0.11;
  x.lineCap = 'round';
  x.beginPath(); x.moveTo(-r * 0.5, -r * 0.24); x.lineTo(-r * 0.9, -r * 0.3); x.stroke();
  x.beginPath(); x.moveTo(-r * 0.9, -r * 0.44); x.lineTo(-r * 0.9, -r * 0.12); x.stroke();
  x.restore();
},

  // ===== 特斯拉/磁轨系（太空时代武器） =====

  // 特斯拉电枪：枪身 + 线圈环 + 枪口电弧
  'teslagun': (x, r, s, col) => {
    x.save();
    x.rotate(-0.18);
    // 枪身
    const g = x.createLinearGradient(-r * 0.6, 0, r * 0.6, 0);
    g.addColorStop(0, darkenColor(col, 0.3));
    g.addColorStop(0.45, lightenColor(col, 0.35));
    g.addColorStop(1, darkenColor(col, 0.38));
    x.fillStyle = g;
    rrPath(x, -r * 0.72, -r * 0.2, r * 1.5, r * 0.4, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(20,26,48,.65)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 握把
    x.fillStyle = darkenColor(col, 0.25);
    x.beginPath();
    x.moveTo(-r * 0.42, r * 0.16);
    x.lineTo(-r * 0.1, r * 0.16);
    x.lineTo(-r * 0.18, r * 0.78);
    x.lineTo(-r * 0.52, r * 0.7);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(20,26,48,.6)';
    x.stroke();
    // 线圈环（枪口三道铜环）
    for (let i = 0; i < 3; i++) {
      const cx = r * 0.34 + i * r * 0.22;
      x.strokeStyle = i === 2 ? '#f0c05a' : '#d8a840';
      x.lineWidth = r * 0.1;
      x.beginPath(); x.arc(cx, 0, r * 0.26 + i * r * 0.03, 0, 7); x.stroke();
    }
    // 枪口电弧
    x.strokeStyle = '#9adcff';
    x.lineWidth = Math.max(1.2, s * 0.05);
    x.lineCap = 'round';
    for (let i = 0; i < 3; i++) {
      const a = -0.9 + i * 0.9;
      x.beginPath();
      x.moveTo(r * 0.88, 0);
      x.lineTo(r * 1.05 + Math.cos(a) * r * 0.06, Math.sin(a) * r * 0.14);
      x.lineTo(r * 1.12, Math.sin(a) * r * 0.26);
      x.stroke();
    }
    // 枪身电光纹
    x.strokeStyle = 'rgba(180,230,255,.8)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.beginPath();
    x.moveTo(-r * 0.5, 0); x.lineTo(-r * 0.3, -r * 0.08);
    x.lineTo(-r * 0.12, r * 0.06); x.lineTo(r * 0.05, -r * 0.04);
    x.stroke();
    x.restore();
  },

  // 特斯拉炮塔：炮塔基座 + 线圈塔身 + 顶端球形放电器 + 电弧
  'tesla-turret': (x, r, s, col) => {
    _turretBase(x, r, s, '#4a5462');
    // 线圈塔身（梯形收顶）
    const g = x.createLinearGradient(-r * 0.3, -r * 0.7, r * 0.3, 0);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(0.6, col);
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(-r * 0.3, r * 0.1);
    x.lineTo(-r * 0.18, -r * 0.56);
    x.lineTo(r * 0.18, -r * 0.56);
    x.lineTo(r * 0.3, r * 0.1);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(20,26,48,.65)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.lineJoin = 'round';
    x.stroke();
    // 塔身线圈环
    x.strokeStyle = '#d8a840';
    x.lineWidth = r * 0.07;
    for (let i = 0; i < 2; i++) {
      x.beginPath(); x.arc(0, -r * 0.16 + i * r * 0.2, r * 0.24 - i * r * 0.03, 0, 7); x.stroke();
    }
    // 顶端球形放电器
    const sg = x.createRadialGradient(-r * 0.06, -r * 0.74, r * 0.03, 0, -r * 0.68, r * 0.2);
    sg.addColorStop(0, '#eaf6ff');
    sg.addColorStop(0.5, lightenColor(col, 0.3));
    sg.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = sg;
    x.beginPath(); x.arc(0, -r * 0.68, r * 0.19, 0, 7); x.fill();
    x.strokeStyle = 'rgba(20,26,48,.6)';
    x.lineWidth = Math.max(0.8, s * 0.035);
    x.stroke();
    // 放电电弧
    x.strokeStyle = '#9adcff';
    x.lineWidth = Math.max(1, s * 0.04);
    x.lineCap = 'round';
    for (const [dx, dy] of [[-0.34, -0.82], [0.3, -0.9], [0.38, -0.66]]) {
      x.beginPath();
      x.moveTo(0, -r * 0.68);
      x.lineTo(dx * r * 0.7, dy * r * 0.7 - r * 0.1);
      x.lineTo(dx * r, dy * r);
      x.stroke();
    }
    // 基座指示灯
    x.fillStyle = '#9adcff';
    x.beginPath(); x.arc(-r * 0.22, r * 0.4, r * 0.06, 0, 7); x.fill();
    x.fillStyle = '#f8d84a';
    x.beginPath(); x.arc(r * 0.16, r * 0.4, r * 0.06, 0, 7); x.fill();
  },

  // 特斯拉弹药：电容弹匣 + 闪电符号 + 端子极片
  'tesla-ammo': (x, r, s, col) => {
    // 弹匣体
    const g = x.createLinearGradient(-r * 0.5, 0, r * 0.5, 0);
    g.addColorStop(0, darkenColor(col, 0.3));
    g.addColorStop(0.45, lightenColor(col, 0.32));
    g.addColorStop(1, darkenColor(col, 0.38));
    x.fillStyle = g;
    rrPath(x, -r * 0.48, -r * 0.62, r * 0.96, r * 1.3, r * 0.14);
    x.fill();
    x.strokeStyle = 'rgba(24,32,64,.65)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 顶部极片（+/- 端子）
    x.fillStyle = '#d8b048';
    x.fillRect(-r * 0.36, -r * 0.76, r * 0.28, r * 0.16);
    x.fillStyle = '#9aa4b2';
    x.fillRect(r * 0.08, -r * 0.76, r * 0.28, r * 0.16);
    // 闪电符号
    x.fillStyle = '#ffe98a';
    x.beginPath();
    x.moveTo(r * 0.08, -r * 0.44);
    x.lineTo(-r * 0.24, r * 0.06);
    x.lineTo(-r * 0.02, r * 0.06);
    x.lineTo(-r * 0.1, r * 0.44);
    x.lineTo(r * 0.26, -r * 0.1);
    x.lineTo(r * 0.02, -r * 0.1);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(120,80,10,.5)';
    x.lineWidth = Math.max(0.7, s * 0.028);
    x.stroke();
    // 储能指示窗
    x.fillStyle = 'rgba(255,255,255,.3)';
    x.fillRect(-r * 0.32, r * 0.34, r * 0.64, r * 0.1);
  },

  // 火箭炮塔：炮塔基座 + 斜置双联发射管 + 露出火箭头
  'rocket-turret': (x, r, s, col) => {
    _turretBase(x, r, s, '#5a4a3a');
    // 发射箱体
    const g = x.createLinearGradient(-r * 0.5, -r * 0.6, r * 0.4, -r * 0.1);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    x.save();
    x.rotate(-0.22);
    rrPath(x, -r * 0.56, -r * 0.5, r * 1.1, r * 0.46, r * 0.1);
    x.fill();
    x.strokeStyle = 'rgba(48,32,16,.65)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.lineJoin = 'round';
    x.stroke();
    // 双发射管口
    for (const dy of [-0.4, 0.06]) {
      x.fillStyle = '#2c2620';
      x.beginPath();
      x.ellipse(r * 0.52, dy * r, r * 0.12, r * 0.14, 0, 0, 7);
      x.fill();
      // 露出的火箭锥头
      x.fillStyle = '#c8502e';
      x.beginPath();
      x.moveTo(r * 0.52, dy * r - r * 0.14);
      x.lineTo(r * 0.78, dy * r - r * 0.02);
      x.lineTo(r * 0.52, dy * r + r * 0.14);
      x.closePath();
      x.fill();
      x.strokeStyle = 'rgba(80,30,12,.6)';
      x.lineWidth = Math.max(0.8, s * 0.03);
      x.stroke();
    }
    x.restore();
    // 支撑架
    x.strokeStyle = darkenColor(col, 0.3);
    x.lineWidth = r * 0.1;
    x.lineCap = 'round';
    x.beginPath(); x.moveTo(0, r * 0.05); x.lineTo(-r * 0.3, r * 0.42); x.stroke();
    x.beginPath(); x.moveTo(0, r * 0.05); x.lineTo(r * 0.34, r * 0.42); x.stroke();
    // 基座警示灯
    x.fillStyle = '#f8d84a';
    x.beginPath(); x.arc(-r * 0.26, r * 0.42, r * 0.06, 0, 7); x.fill();
  },

  // 磁轨炮塔：炮塔基座 + 双平行导轨 + 导轨间等离子光束
  'railgun-turret': (x, r, s, col) => {
    _turretBase(x, r, s, '#3a4a5e');
    // 炮身（长条导轨舱）
    const g = x.createLinearGradient(0, -r * 0.5, 0, 0);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    x.save();
    x.rotate(-0.12);
    rrPath(x, -r * 0.66, -r * 0.42, r * 1.6, r * 0.4, r * 0.08);
    x.fill();
    x.strokeStyle = 'rgba(16,28,48,.65)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 双导轨
    x.fillStyle = '#c8ced8';
    x.fillRect(-r * 0.62, -r * 0.5, r * 1.5, r * 0.08);
    x.fillRect(-r * 0.62, -r * 0.16, r * 1.5, r * 0.08);
    // 导轨间等离子光束
    const bg = x.createLinearGradient(-r * 0.6, 0, r * 0.9, 0);
    bg.addColorStop(0, 'rgba(120,200,255,.25)');
    bg.addColorStop(0.7, 'rgba(160,220,255,.85)');
    bg.addColorStop(1, '#eaf8ff');
    x.fillStyle = bg;
    x.fillRect(-r * 0.58, -r * 0.4, r * 1.46, r * 0.22);
    x.restore();
    // 后部供弹仓
    x.fillStyle = darkenColor(col, 0.28);
    rrPath(x, -r * 0.84, -r * 0.36, r * 0.3, r * 0.3, r * 0.06);
    x.fill();
    x.strokeStyle = 'rgba(16,28,48,.6)';
    x.lineWidth = Math.max(0.8, s * 0.035);
    x.stroke();
    // 基座能量灯
    x.fillStyle = '#9adcff';
    x.beginPath(); x.arc(-r * 0.24, r * 0.4, r * 0.06, 0, 7); x.fill();
    x.fillStyle = '#4ac86a';
    x.beginPath(); x.arc(r * 0.2, r * 0.4, r * 0.06, 0, 7); x.fill();
  },

  // 磁轨炮弹：脱壳穿甲弹体 + 尾翼 + 弹托环
  'railgun-ammo': (x, r, s, col) => {
    x.save();
    x.rotate(-0.5);
    // 弹体（细长杆）
    const g = x.createLinearGradient(-r * 0.16, 0, r * 0.16, 0);
    g.addColorStop(0, darkenColor(col, 0.3));
    g.addColorStop(0.45, lightenColor(col, 0.4));
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    rrPath(x, -r * 0.14, -r * 0.7, r * 0.28, r * 1.28, r * 0.1);
    x.fill();
    x.strokeStyle = 'rgba(20,36,70,.65)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 尖锥弹头
    x.fillStyle = '#d8dee8';
    x.beginPath();
    x.moveTo(0, -r * 0.92);
    x.lineTo(r * 0.14, -r * 0.6);
    x.lineTo(-r * 0.14, -r * 0.6);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(20,36,70,.6)';
    x.stroke();
    // 弹托环
    x.fillStyle = '#8a6a3a';
    rrPath(x, -r * 0.3, -r * 0.06, r * 0.6, r * 0.2, r * 0.06);
    x.fill();
    x.strokeStyle = 'rgba(60,42,16,.6)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.stroke();
    // 尾翼
    x.fillStyle = darkenColor(col, 0.2);
    for (const dx of [-1, 1]) {
      x.beginPath();
      x.moveTo(dx * r * 0.14, r * 0.34);
      x.lineTo(dx * r * 0.42, r * 0.66);
      x.lineTo(dx * r * 0.14, r * 0.58);
      x.closePath();
      x.fill();
      x.strokeStyle = 'rgba(20,36,70,.55)';
      x.lineWidth = Math.max(0.7, s * 0.028);
      x.stroke();
    }
    x.restore();
  },

  // 捕获者火箭弹：金色火箭 + 弹头捕网爪
  'capture-robot-rocket': (x, r, s, col) => {
    x.save();
    x.rotate(-0.5);
    // 弹体
    const g = x.createLinearGradient(-r * 0.28, 0, r * 0.28, 0);
    g.addColorStop(0, darkenColor(col, 0.28));
    g.addColorStop(0.42, lightenColor(col, 0.35));
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    rrPath(x, -r * 0.26, -r * 0.24, r * 0.52, r * 0.9, r * 0.1);
    x.fill();
    x.strokeStyle = 'rgba(90,66,20,.65)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 特制弹头（捕网爪：三叉）
    x.fillStyle = '#c8ced8';
    for (const dx of [-0.16, 0, 0.16]) {
      x.beginPath();
      x.moveTo(dx * r, -r * 0.9);
      x.lineTo(dx * r + r * 0.07, -r * 0.62);
      x.lineTo(dx * r - r * 0.07, -r * 0.62);
      x.closePath();
      x.fill();
    }
    x.fillRect(-r * 0.18, -r * 0.6, r * 0.36, r * 0.12);
    // 弹体捕获标志（机器人头剪影窗）
    x.fillStyle = '#3a4a6a';
    rrPath(x, -r * 0.14, -r * 0.06, r * 0.28, r * 0.24, r * 0.05);
    x.fill();
    x.fillStyle = '#9adcff';
    x.fillRect(-r * 0.1, r * 0.0, r * 0.08, r * 0.07);
    x.fillRect(r * 0.02, r * 0.0, r * 0.08, r * 0.07);
    // 尾翼
    x.fillStyle = darkenColor(col, 0.22);
    for (const dx of [-1, 1]) {
      x.beginPath();
      x.moveTo(dx * r * 0.24, r * 0.44);
      x.lineTo(dx * r * 0.5, r * 0.78);
      x.lineTo(dx * r * 0.24, r * 0.68);
      x.closePath();
      x.fill();
    }
    x.restore();
  },

  // ===== 个人装备件 =====

  // 个人机器人港：方形装备件 + 机器人港图标 + 呼叫波纹
  'personal-roboport-equipment': (x, r, s, col) => {
    const g = x.createLinearGradient(-r * 0.7, -r * 0.7, r * 0.7, r * 0.7);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    rrPath(x, -r * 0.78, -r * 0.78, r * 1.56, r * 1.56, r * 0.2);
    x.fill();
    x.strokeStyle = 'rgba(24,32,18,.65)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 中央机器人剪影
    x.fillStyle = 'rgba(255,255,255,.92)';
    rrPath(x, -r * 0.22, -r * 0.42, r * 0.44, r * 0.34, r * 0.1);
    x.fill();
    x.fillStyle = darkenColor(col, 0.4);
    x.fillRect(-r * 0.12, -r * 0.34, r * 0.09, r * 0.09);
    x.fillRect(r * 0.03, -r * 0.34, r * 0.09, r * 0.09);
    x.fillStyle = 'rgba(255,255,255,.92)';
    x.fillRect(-r * 0.07, -r * 0.06, r * 0.14, r * 0.34);
    // 呼叫波纹
    x.strokeStyle = 'rgba(255,255,255,.55)';
    x.lineWidth = Math.max(0.9, s * 0.032);
    for (const rr of [0.3, 0.46]) {
      x.beginPath(); x.arc(0, -r * 0.1, rr * r, -0.5, 0.5 + Math.PI * 0.5); x.stroke();
    }
    // 底部状态灯
    x.fillStyle = '#9adc6a';
    x.beginPath(); x.arc(0, r * 0.58, r * 0.08, 0, 7); x.fill();
  },

  // 个人机器人港 II：升级版，双色 + 双状态灯
  'personal-roboport-mk2-equipment': (x, r, s, col) => {
    const g = x.createLinearGradient(-r * 0.7, -r * 0.7, r * 0.7, r * 0.7);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    rrPath(x, -r * 0.78, -r * 0.78, r * 1.56, r * 1.56, r * 0.2);
    x.fill();
    x.strokeStyle = 'rgba(18,26,42,.65)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 中央机器人剪影（更大）
    x.fillStyle = 'rgba(255,255,255,.92)';
    rrPath(x, -r * 0.26, -r * 0.48, r * 0.52, r * 0.4, r * 0.12);
    x.fill();
    x.fillStyle = darkenColor(col, 0.4);
    x.fillRect(-r * 0.15, -r * 0.4, r * 0.1, r * 0.1);
    x.fillRect(r * 0.05, -r * 0.4, r * 0.1, r * 0.1);
    x.fillStyle = 'rgba(255,255,255,.92)';
    x.fillRect(-r * 0.08, -r * 0.04, r * 0.16, r * 0.4);
    // 双波纹（范围更大）
    x.strokeStyle = 'rgba(255,255,255,.55)';
    x.lineWidth = Math.max(0.9, s * 0.032);
    for (const rr of [0.34, 0.52]) {
      x.beginPath(); x.arc(0, -r * 0.12, rr * r, -0.5, 0.5 + Math.PI * 0.5); x.stroke();
    }
    // 双状态灯 + 档位标记
    x.fillStyle = '#9adc6a';
    x.beginPath(); x.arc(-r * 0.14, r * 0.56, r * 0.07, 0, 7); x.fill();
    x.fillStyle = '#f8d84a';
    x.beginPath(); x.arc(r * 0.14, r * 0.56, r * 0.07, 0, 7); x.fill();
  },

  // 模块化护甲：轻量背心 + 5×5 装备网格
  'modular-armor': (x, r, s, col) => {
    const g = x.createLinearGradient(-r * 0.6, -r * 0.6, r * 0.6, r * 0.7);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(-r * 0.56, -r * 0.56);
    x.lineTo(-r * 0.18, -r * 0.72);
    x.lineTo(r * 0.18, -r * 0.72);
    x.lineTo(r * 0.56, -r * 0.56);
    x.lineTo(r * 0.5, r * 0.72);
    x.lineTo(-r * 0.5, r * 0.72);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(24,30,36,.6)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.lineJoin = 'round';
    x.stroke();
    // 5×5 装备网格
    x.fillStyle = 'rgba(10,14,20,.45)';
    rrPath(x, -r * 0.36, -r * 0.36, r * 0.72, r * 0.86, r * 0.06);
    x.fill();
    x.strokeStyle = 'rgba(255,255,255,.3)';
    x.lineWidth = Math.max(0.6, s * 0.025);
    for (let i = 0; i <= 5; i++) {
      const t = -r * 0.36 + i * r * 0.144;
      x.beginPath(); x.moveTo(t, -r * 0.36); x.lineTo(t, r * 0.5); x.stroke();
    }
    for (let j = 0; j <= 5; j++) {
      const t = -r * 0.36 + j * r * 0.172;
      x.beginPath(); x.moveTo(-r * 0.36, t); x.lineTo(r * 0.36, t); x.stroke();
    }
    // 领口
    x.fillStyle = '#1c2024';
    x.beginPath();
    x.moveTo(-r * 0.18, -r * 0.72);
    x.quadraticCurveTo(0, -r * 0.46, r * 0.18, -r * 0.72);
    x.closePath();
    x.fill();
  },

  // 强力装甲：加厚背心 + 中央能源核心
  'power-armor': (x, r, s, col) => {
    const g = x.createLinearGradient(-r * 0.66, -r * 0.6, r * 0.66, r * 0.7);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.42));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(-r * 0.62, -r * 0.5);
    x.lineTo(-r * 0.22, -r * 0.7);
    x.lineTo(r * 0.22, -r * 0.7);
    x.lineTo(r * 0.62, -r * 0.5);
    x.lineTo(r * 0.56, r * 0.72);
    x.lineTo(-r * 0.56, r * 0.72);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(22,26,34,.65)';
    x.lineWidth = Math.max(1, s * 0.05);
    x.lineJoin = 'round';
    x.stroke();
    // 中央能源核心
    const cg = x.createRadialGradient(-r * 0.05, -r * 0.06, r * 0.03, 0, 0, r * 0.24);
    cg.addColorStop(0, '#eaf6ff');
    cg.addColorStop(0.5, '#7ab8f0');
    cg.addColorStop(1, '#2a5a90');
    x.fillStyle = cg;
    x.beginPath(); x.arc(0, 0, r * 0.22, 0, 7); x.fill();
    x.strokeStyle = 'rgba(22,26,34,.6)';
    x.lineWidth = Math.max(0.8, s * 0.035);
    x.stroke();
    // 核心外圈导线
    x.strokeStyle = 'rgba(220,235,250,.4)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.beginPath(); x.arc(0, 0, r * 0.32, 0.3, 2.2); x.stroke();
    x.beginPath(); x.arc(0, 0, r * 0.32, 3.4, 5.4); x.stroke();
    // 领口
    x.fillStyle = '#1c2024';
    x.beginPath();
    x.moveTo(-r * 0.22, -r * 0.7);
    x.quadraticCurveTo(0, -r * 0.44, r * 0.22, -r * 0.7);
    x.closePath();
    x.fill();
    // 肩甲块
    x.fillStyle = darkenColor(col, 0.2);
    rrPath(x, -r * 0.74, -r * 0.56, r * 0.2, r * 0.32, r * 0.06);
    x.fill();
    rrPath(x, r * 0.54, -r * 0.56, r * 0.2, r * 0.32, r * 0.06);
    x.fill();
  },

  // 强力装甲 II：最厚装甲 + 双核心发光
  'power-armor-mk2': (x, r, s, col) => {
    const g = x.createLinearGradient(-r * 0.7, -r * 0.6, r * 0.7, r * 0.7);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(-r * 0.68, -r * 0.48);
    x.lineTo(-r * 0.24, -r * 0.72);
    x.lineTo(r * 0.24, -r * 0.72);
    x.lineTo(r * 0.68, -r * 0.48);
    x.lineTo(r * 0.6, r * 0.72);
    x.lineTo(-r * 0.6, r * 0.72);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(18,20,30,.7)';
    x.lineWidth = Math.max(1, s * 0.05);
    x.lineJoin = 'round';
    x.stroke();
    // 胸甲双层板
    x.fillStyle = lightenColor(col, 0.15);
    rrPath(x, -r * 0.44, -r * 0.3, r * 0.88, r * 0.5, r * 0.08);
    x.fill();
    x.strokeStyle = 'rgba(18,20,30,.55)';
    x.lineWidth = Math.max(0.8, s * 0.035);
    x.stroke();
    // 双能源核心
    for (const dx of [-0.18, 0.18]) {
      const cg = x.createRadialGradient(dx * r - r * 0.03, 0, r * 0.02, dx * r, 0, r * 0.15);
      cg.addColorStop(0, '#f0faff');
      cg.addColorStop(0.5, '#8ac8ff');
      cg.addColorStop(1, '#2a4a88');
      x.fillStyle = cg;
      x.beginPath(); x.arc(dx * r, 0, r * 0.14, 0, 7); x.fill();
      x.strokeStyle = 'rgba(18,20,30,.6)';
      x.lineWidth = Math.max(0.7, s * 0.03);
      x.stroke();
    }
    // 领口 + 铆钉
    x.fillStyle = '#161820';
    x.beginPath();
    x.moveTo(-r * 0.24, -r * 0.72);
    x.quadraticCurveTo(0, -r * 0.46, r * 0.24, -r * 0.72);
    x.closePath();
    x.fill();
    x.fillStyle = '#b8bcc2';
    for (const [px, py] of [[-0.5, -0.32], [0.5, -0.32], [-0.46, 0.5], [0.46, 0.5]]) {
      x.beginPath(); x.arc(px * r, py * r, r * 0.05, 0, 7); x.fill();
    }
  },

  // 个人太阳能板：微型光电板 + 网格 + 太阳光斑
  'solar-panel-equipment': (x, r, s, col) => {
    // 外框
    x.fillStyle = '#3a4654';
    rrPath(x, -r * 0.8, -r * 0.6, r * 1.6, r * 1.2, r * 0.1);
    x.fill();
    x.strokeStyle = 'rgba(16,22,30,.65)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 光电板面
    const g = x.createLinearGradient(-r * 0.7, -r * 0.5, r * 0.7, r * 0.5);
    g.addColorStop(0, lightenColor(col, 0.3));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    rrPath(x, -r * 0.7, -r * 0.5, r * 1.4, r * 1.0, r * 0.06);
    x.fill();
    // 电池网格
    x.strokeStyle = 'rgba(255,255,255,.35)';
    x.lineWidth = Math.max(0.6, s * 0.026);
    for (let i = 1; i < 4; i++) {
      const px = -r * 0.7 + i * r * 0.35;
      x.beginPath(); x.moveTo(px, -r * 0.5); x.lineTo(px, r * 0.5); x.stroke();
    }
    for (let j = 1; j < 3; j++) {
      const py = -r * 0.5 + j * r * 0.333;
      x.beginPath(); x.moveTo(-r * 0.7, py); x.lineTo(r * 0.7, py); x.stroke();
    }
    // 左上角太阳光斑
    const sg = x.createRadialGradient(-r * 0.42, -r * 0.24, r * 0.02, -r * 0.42, -r * 0.24, r * 0.16);
    sg.addColorStop(0, 'rgba(255,250,220,.95)');
    sg.addColorStop(1, 'rgba(255,220,120,0)');
    x.fillStyle = sg;
    x.beginPath(); x.arc(-r * 0.42, -r * 0.24, r * 0.16, 0, 7); x.fill();
    // 输出引脚
    x.fillStyle = '#8a8f96';
    x.fillRect(-r * 0.2, r * 0.6, r * 0.14, r * 0.14);
    x.fillRect(r * 0.06, r * 0.6, r * 0.14, r * 0.14);
  },

  // 便携聚变反应堆：环形约束装置 + 绿色等离子核心
  'fusion-reactor-equipment': (x, r, s, col) => {
    // 外壳环
    x.strokeStyle = '#5a6a72';
    x.lineWidth = r * 0.22;
    x.beginPath(); x.arc(0, 0, r * 0.62, 0, 7); x.stroke();
    x.strokeStyle = 'rgba(20,30,26,.6)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.beginPath(); x.arc(0, 0, r * 0.73, 0, 7); x.stroke();
    x.beginPath(); x.arc(0, 0, r * 0.51, 0, 7); x.stroke();
    // 等离子核心
    const cg = x.createRadialGradient(-r * 0.05, -r * 0.05, r * 0.04, 0, 0, r * 0.42);
    cg.addColorStop(0, '#f0fff4');
    cg.addColorStop(0.4, lightenColor(col, 0.2));
    cg.addColorStop(1, darkenColor(col, 0.35));
    x.fillStyle = cg;
    x.beginPath(); x.arc(0, 0, r * 0.42, 0, 7); x.fill();
    // 环上四座磁体座
    x.fillStyle = '#7a8a92';
    for (let i = 0; i < 4; i++) {
      const a = i * Math.PI / 2 + Math.PI / 4;
      x.beginPath();
      x.arc(Math.cos(a) * r * 0.62, Math.sin(a) * r * 0.62, r * 0.12, 0, 7);
      x.fill();
      x.strokeStyle = 'rgba(20,30,26,.6)';
      x.lineWidth = Math.max(0.7, s * 0.028);
      x.stroke();
    }
    // 核心高光
    x.fillStyle = 'rgba(255,255,255,.5)';
    x.beginPath(); x.arc(-r * 0.12, -r * 0.12, r * 0.1, 0, 7); x.fill();
  },

  // 个人电池：电池体 + 闪电符号 + 电量条
  'battery-equipment': (x, r, s, col) => {
    // 电池体
    const g = x.createLinearGradient(-r * 0.5, 0, r * 0.5, 0);
    g.addColorStop(0, darkenColor(col, 0.25));
    g.addColorStop(0.45, lightenColor(col, 0.3));
    g.addColorStop(1, darkenColor(col, 0.35));
    x.fillStyle = g;
    rrPath(x, -r * 0.5, -r * 0.6, r * 1.0, r * 1.3, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(90,74,14,.65)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 顶部电极
    x.fillStyle = '#8a8f96';
    x.fillRect(-r * 0.2, -r * 0.76, r * 0.4, r * 0.18);
    x.strokeStyle = 'rgba(60,54,30,.5)';
    x.lineWidth = Math.max(0.7, s * 0.03);
    x.strokeRect(-r * 0.2, -r * 0.76, r * 0.4, r * 0.18);
    // 闪电符号
    x.fillStyle = 'rgba(255,255,255,.92)';
    x.beginPath();
    x.moveTo(r * 0.1, -r * 0.44);
    x.lineTo(-r * 0.24, r * 0.04);
    x.lineTo(-r * 0.02, r * 0.04);
    x.lineTo(-r * 0.12, r * 0.46);
    x.lineTo(r * 0.26, -r * 0.08);
    x.lineTo(r * 0.02, -r * 0.08);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(120,96,10,.5)';
    x.lineWidth = Math.max(0.7, s * 0.028);
    x.stroke();
    // 电量条
    x.fillStyle = 'rgba(255,255,255,.35)';
    x.fillRect(-r * 0.36, r * 0.52, r * 0.72, r * 0.09);
    x.fillStyle = '#4ac86a';
    x.fillRect(-r * 0.36, r * 0.52, r * 0.5, r * 0.09);
  },

  // 个人电池 II：深色电池体 + 双电量条
  'battery-mk2-equipment': (x, r, s, col) => {
    const g = x.createLinearGradient(-r * 0.5, 0, r * 0.5, 0);
    g.addColorStop(0, darkenColor(col, 0.25));
    g.addColorStop(0.45, lightenColor(col, 0.28));
    g.addColorStop(1, darkenColor(col, 0.35));
    x.fillStyle = g;
    rrPath(x, -r * 0.5, -r * 0.6, r * 1.0, r * 1.3, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(84,66,10,.7)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    x.fillStyle = '#8a8f96';
    x.fillRect(-r * 0.2, -r * 0.76, r * 0.4, r * 0.18);
    x.strokeStyle = 'rgba(60,50,26,.5)';
    x.lineWidth = Math.max(0.7, s * 0.03);
    x.strokeRect(-r * 0.2, -r * 0.76, r * 0.4, r * 0.18);
    // 闪电（带描边，更醒目）
    x.fillStyle = '#ffe98a';
    x.beginPath();
    x.moveTo(r * 0.1, -r * 0.44);
    x.lineTo(-r * 0.24, r * 0.04);
    x.lineTo(-r * 0.02, r * 0.04);
    x.lineTo(-r * 0.12, r * 0.46);
    x.lineTo(r * 0.26, -r * 0.08);
    x.lineTo(r * 0.02, -r * 0.08);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(120,90,10,.6)';
    x.lineWidth = Math.max(0.7, s * 0.028);
    x.stroke();
    // 双电量条（满格）
    x.fillStyle = 'rgba(255,255,255,.35)';
    x.fillRect(-r * 0.36, r * 0.4, r * 0.72, r * 0.08);
    x.fillRect(-r * 0.36, r * 0.53, r * 0.72, r * 0.08);
    x.fillStyle = '#f8d84a';
    x.fillRect(-r * 0.36, r * 0.4, r * 0.72, r * 0.08);
    x.fillRect(-r * 0.36, r * 0.53, r * 0.62, r * 0.08);
  },

  // 外骨骼：腿部液压支架 + 活塞杆
  'exoskeleton-equipment': (x, r, s, col) => {
    // 背板
    const g = x.createLinearGradient(-r * 0.6, -r * 0.7, r * 0.6, r * 0.7);
    g.addColorStop(0, lightenColor(col, 0.3));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    rrPath(x, -r * 0.6, -r * 0.72, r * 1.2, r * 0.6, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(48,40,26,.65)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 双腿外骨架
    for (const dx of [-0.32, 0.32]) {
      // 大腿液压杆
      x.strokeStyle = '#b8bcc2';
      x.lineWidth = r * 0.12;
      x.lineCap = 'round';
      x.beginPath();
      x.moveTo(dx * r, -r * 0.2);
      x.lineTo(dx * r * 1.25, r * 0.32);
      x.stroke();
      // 关节
      x.fillStyle = '#d8a840';
      x.beginPath(); x.arc(dx * r, -r * 0.2, r * 0.11, 0, 7); x.fill();
      x.beginPath(); x.arc(dx * r * 1.25, r * 0.32, r * 0.11, 0, 7); x.fill();
      x.strokeStyle = 'rgba(60,48,20,.6)';
      x.lineWidth = Math.max(0.7, s * 0.028);
      x.stroke();
      // 脚踏
      x.fillStyle = darkenColor(col, 0.3);
      rrPath(x, dx * r * 1.25 - r * 0.18, r * 0.44, r * 0.36, r * 0.16, r * 0.05);
      x.fill();
    }
    // 背板指示灯
    x.fillStyle = '#4ac86a';
    x.beginPath(); x.arc(0, -r * 0.44, r * 0.08, 0, 7); x.fill();
  },

  // 夜视仪：单目镜筒 + 绿色荧光镜片
  'night-vision-equipment': (x, r, s, col) => {
    // 镜筒外壳
    const g = x.createLinearGradient(-r * 0.7, -r * 0.7, r * 0.7, r * 0.7);
    g.addColorStop(0, lightenColor(col, 0.3));
    g.addColorStop(0.55, '#4a5a4e');
    g.addColorStop(1, darkenColor('#2c382e', 0.2));
    x.fillStyle = g;
    rrPath(x, -r * 0.75, -r * 0.6, r * 1.5, r * 1.2, r * 0.2);
    x.fill();
    x.strokeStyle = 'rgba(18,26,20,.7)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 镜筒
    x.fillStyle = '#2c342e';
    x.beginPath(); x.arc(0, 0, r * 0.46, 0, 7); x.fill();
    // 绿色荧光镜片
    const lg = x.createRadialGradient(-r * 0.1, -r * 0.1, r * 0.04, 0, 0, r * 0.38);
    lg.addColorStop(0, '#d8ffd8');
    lg.addColorStop(0.45, '#5ae06a');
    lg.addColorStop(1, '#1a6a2a');
    x.fillStyle = lg;
    x.beginPath(); x.arc(0, 0, r * 0.36, 0, 7); x.fill();
    x.strokeStyle = 'rgba(18,26,20,.7)';
    x.lineWidth = Math.max(0.8, s * 0.035);
    x.stroke();
    // 镜片内十字准线
    x.strokeStyle = 'rgba(220,255,220,.7)';
    x.lineWidth = Math.max(0.7, s * 0.026);
    x.beginPath(); x.moveTo(0, -r * 0.24); x.lineTo(0, r * 0.24); x.stroke();
    x.beginPath(); x.moveTo(-r * 0.24, 0); x.lineTo(r * 0.24, 0); x.stroke();
    // 顶部固定带扣
    x.fillStyle = '#8a8f96';
    x.fillRect(-r * 0.14, -r * 0.74, r * 0.28, r * 0.14);
  },

  // 个人激光防御：红色发射器透镜 + 待机激光束
  'personal-laser-defense-equipment': (x, r, s, col) => {
    // 装备壳体
    const g = x.createLinearGradient(-r * 0.7, -r * 0.7, r * 0.7, r * 0.7);
    g.addColorStop(0, '#e08a94');
    g.addColorStop(0.5, col);
    g.addColorStop(1, darkenColor(col, 0.42));
    x.fillStyle = g;
    rrPath(x, -r * 0.75, -r * 0.75, r * 1.5, r * 1.5, r * 0.2);
    x.fill();
    x.strokeStyle = 'rgba(64,14,20,.7)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 发射透镜
    const lg = x.createRadialGradient(-r * 0.08, -r * 0.08, r * 0.03, 0, 0, r * 0.34);
    lg.addColorStop(0, '#ffd8dc');
    lg.addColorStop(0.4, '#ff4a5e');
    lg.addColorStop(1, '#7a1020');
    x.fillStyle = lg;
    x.beginPath(); x.arc(0, 0, r * 0.32, 0, 7); x.fill();
    x.strokeStyle = 'rgba(64,14,20,.6)';
    x.lineWidth = Math.max(0.8, s * 0.035);
    x.stroke();
    // 出射激光束
    x.save();
    x.rotate(-0.6);
    const bg = x.createLinearGradient(r * 0.3, 0, r * 1.0, 0);
    bg.addColorStop(0, 'rgba(255,90,110,.9)');
    bg.addColorStop(1, 'rgba(255,90,110,0)');
    x.fillStyle = bg;
    x.beginPath();
    x.moveTo(r * 0.28, -r * 0.06);
    x.lineTo(r * 1.0, -r * 0.02);
    x.lineTo(r * 1.0, r * 0.02);
    x.lineTo(r * 0.28, r * 0.06);
    x.closePath();
    x.fill();
    x.restore();
    // 四角螺丝
    x.fillStyle = 'rgba(240,244,248,.8)';
    for (const [px, py] of [[-0.58, -0.58], [0.58, -0.58], [-0.58, 0.58], [0.58, 0.58]]) {
      x.beginPath(); x.arc(px * r, py * r, r * 0.05, 0, 7); x.fill();
    }
  },

  // 能量护盾：六边形护盾 + 充能波纹
  'energy-shield-equipment': (x, r, s, col) => {
    // 护盾六边形（外层半透明光罩）
    x.fillStyle = 'rgba(120,220,235,.28)';
    x.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 - Math.PI / 6;
      const px = Math.cos(a) * r * 0.8, py = Math.sin(a) * r * 0.8;
      i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    }
    x.closePath();
    x.fill();
    x.strokeStyle = lightenColor(col, 0.3);
    x.lineWidth = Math.max(1.2, s * 0.05);
    x.lineJoin = 'round';
    x.stroke();
    // 内层发生器（圆盘）
    const g = x.createRadialGradient(-r * 0.06, -r * 0.06, r * 0.04, 0, 0, r * 0.36);
    g.addColorStop(0, lightenColor(col, 0.45));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    x.beginPath(); x.arc(0, 0, r * 0.34, 0, 7); x.fill();
    x.strokeStyle = 'rgba(14,40,48,.65)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 中心充能符号
    x.fillStyle = 'rgba(255,255,255,.9)';
    x.beginPath();
    x.moveTo(r * 0.06, -r * 0.2);
    x.lineTo(-r * 0.14, r * 0.02);
    x.lineTo(r * 0.0, r * 0.02);
    x.lineTo(-r * 0.06, r * 0.2);
    x.lineTo(r * 0.16, -r * 0.04);
    x.lineTo(r * 0.02, -r * 0.04);
    x.closePath();
    x.fill();
  },

  // 能量护盾 II：更亮的六边形 + 双层光罩
  'energy-shield-mk2-equipment': (x, r, s, col) => {
    // 外层光罩
    x.fillStyle = 'rgba(110,200,255,.22)';
    x.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 - Math.PI / 6;
      const px = Math.cos(a) * r * 0.92, py = Math.sin(a) * r * 0.92;
      i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    }
    x.closePath();
    x.fill();
    x.strokeStyle = lightenColor(col, 0.35);
    x.lineWidth = Math.max(1.2, s * 0.05);
    x.lineJoin = 'round';
    x.stroke();
    // 内层六边形
    x.fillStyle = 'rgba(140,220,255,.3)';
    x.beginPath();
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 - Math.PI / 6;
      const px = Math.cos(a) * r * 0.66, py = Math.sin(a) * r * 0.66;
      i === 0 ? x.moveTo(px, py) : x.lineTo(px, py);
    }
    x.closePath();
    x.fill();
    x.strokeStyle = lightenColor(col, 0.25);
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 中心发生器
    const g = x.createRadialGradient(-r * 0.05, -r * 0.05, r * 0.03, 0, 0, r * 0.26);
    g.addColorStop(0, '#f0faff');
    g.addColorStop(0.5, lightenColor(col, 0.25));
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    x.beginPath(); x.arc(0, 0, r * 0.24, 0, 7); x.fill();
    x.strokeStyle = 'rgba(12,32,48,.65)';
    x.lineWidth = Math.max(0.9, s * 0.035);
    x.stroke();
    // 闪电符号
    x.fillStyle = 'rgba(255,255,255,.95)';
    x.beginPath();
    x.moveTo(r * 0.05, -r * 0.16);
    x.lineTo(-r * 0.12, r * 0.02);
    x.lineTo(r * 0.0, r * 0.02);
    x.lineTo(-r * 0.05, r * 0.16);
    x.lineTo(r * 0.13, -r * 0.03);
    x.lineTo(r * 0.02, -r * 0.03);
    x.closePath();
    x.fill();
  },

  // 传送带免疫：装备件 + 传送带纹与站立人形
  'belt-immunity-equipment': (x, r, s, col) => {
    const g = x.createLinearGradient(-r * 0.7, -r * 0.7, r * 0.7, r * 0.7);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    rrPath(x, -r * 0.75, -r * 0.75, r * 1.5, r * 1.5, r * 0.2);
    x.fill();
    x.strokeStyle = 'rgba(36,24,54,.65)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 底部传送带纹
    x.fillStyle = '#e8c84a';
    rrPath(x, -r * 0.56, r * 0.24, r * 1.12, r * 0.32, r * 0.06);
    x.fill();
    x.strokeStyle = 'rgba(80,58,10,.5)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.stroke();
    x.strokeStyle = 'rgba(80,58,10,.6)';
    x.lineWidth = Math.max(1, s * 0.04);
    for (let i = 0; i < 4; i++) {
      const px = -r * 0.44 + i * r * 0.3;
      x.beginPath(); x.moveTo(px, r * 0.28); x.lineTo(px, r * 0.52); x.stroke();
    }
    // 站立人形（不被带动）
    x.strokeStyle = 'rgba(255,255,255,.92)';
    x.lineWidth = r * 0.12;
    x.lineCap = 'round';
    // 头
    x.fillStyle = 'rgba(255,255,255,.92)';
    x.beginPath(); x.arc(0, -r * 0.42, r * 0.12, 0, 7); x.fill();
    // 身体
    x.beginPath(); x.moveTo(0, -r * 0.3); x.lineTo(0, r * 0.02); x.stroke();
    // 双腿
    x.beginPath(); x.moveTo(0, r * 0.02); x.lineTo(-r * 0.14, r * 0.22); x.stroke();
    x.beginPath(); x.moveTo(0, r * 0.02); x.lineTo(r * 0.14, r * 0.22); x.stroke();
    // 禁止位移斜线
    x.strokeStyle = '#e05a5a';
    x.lineWidth = Math.max(1.2, s * 0.05);
    x.beginPath(); x.moveTo(-r * 0.3, -r * 0.5); x.lineTo(r * 0.3, r * 0.0); x.stroke();
  },

  // 放电防御：方型放电装置 + 环射电弧
  'discharge-defense-equipment': (x, r, s, col) => {
    // 装置壳体
    const g = x.createLinearGradient(-r * 0.6, -r * 0.6, r * 0.6, r * 0.6);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.42));
    x.fillStyle = g;
    rrPath(x, -r * 0.5, -r * 0.5, r * 1.0, r * 1.0, r * 0.14);
    x.fill();
    x.strokeStyle = 'rgba(20,40,56,.7)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 中心放电极
    x.fillStyle = '#f0faff';
    x.beginPath(); x.arc(0, 0, r * 0.16, 0, 7); x.fill();
    x.strokeStyle = 'rgba(20,40,56,.6)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.stroke();
    // 八向放射电弧
    x.strokeStyle = '#8adcff';
    x.lineWidth = Math.max(1, s * 0.04);
    x.lineCap = 'round';
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4;
      const x1 = Math.cos(a) * r * 0.22, y1 = Math.sin(a) * r * 0.22;
      const mx = Math.cos(a + 0.3) * r * 0.5, my = Math.sin(a + 0.3) * r * 0.5;
      const x2 = Math.cos(a) * r * 0.82, y2 = Math.sin(a) * r * 0.82;
      x.beginPath();
      x.moveTo(x1, y1);
      x.lineTo(mx, my);
      x.lineTo(x2, y2);
      x.stroke();
    }
    // 壳体四角能量灯
    x.fillStyle = '#8adcff';
    for (const [px, py] of [[-0.36, -0.36], [0.36, -0.36], [-0.36, 0.36], [0.36, 0.36]]) {
      x.beginPath(); x.arc(px * r, py * r, r * 0.05, 0, 7); x.fill();
    }
  },

  // 个人电池 III：蓝色高性能电池 + 三格电量
  'battery-mk3-equipment': (x, r, s, col) => {
    const g = x.createLinearGradient(-r * 0.5, 0, r * 0.5, 0);
    g.addColorStop(0, darkenColor(col, 0.28));
    g.addColorStop(0.45, lightenColor(col, 0.3));
    g.addColorStop(1, darkenColor(col, 0.38));
    x.fillStyle = g;
    rrPath(x, -r * 0.5, -r * 0.6, r * 1.0, r * 1.3, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(14,42,74,.7)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    x.fillStyle = '#8a8f96';
    x.fillRect(-r * 0.2, -r * 0.76, r * 0.4, r * 0.18);
    x.strokeStyle = 'rgba(40,58,78,.5)';
    x.lineWidth = Math.max(0.7, s * 0.03);
    x.strokeRect(-r * 0.2, -r * 0.76, r * 0.4, r * 0.18);
    // 双闪电符号（更强储能）
    x.fillStyle = '#eaf6ff';
    for (const dx of [-0.12, 0.14]) {
      x.beginPath();
      x.moveTo(dx * r + r * 0.08, -r * 0.42);
      x.lineTo(dx * r - r * 0.18, r * 0.02);
      x.lineTo(dx * r + r * 0.02, r * 0.02);
      x.lineTo(dx * r - r * 0.06, r * 0.44);
      x.lineTo(dx * r + r * 0.22, -r * 0.1);
      x.lineTo(dx * r + r * 0.0, -r * 0.1);
      x.closePath();
      x.fill();
    }
    x.strokeStyle = 'rgba(20,50,90,.5)';
    x.lineWidth = Math.max(0.6, s * 0.026);
    x.stroke();
    // 三格电量条
    for (let i = 0; i < 3; i++) {
      x.fillStyle = '#9adcff';
      x.fillRect(-r * 0.36 + i * r * 0.26, r * 0.52, r * 0.2, r * 0.09);
    }
  },

  // 便携裂变反应堆：微型反应堆 + 辐射三叶标志
  'fission-reactor-equipment': (x, r, s, col) => {
    // 外壳
    const g = x.createLinearGradient(-r * 0.7, -r * 0.7, r * 0.7, r * 0.7);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    rrPath(x, -r * 0.75, -r * 0.75, r * 1.5, r * 1.5, r * 0.2);
    x.fill();
    x.strokeStyle = 'rgba(20,34,22,.7)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 辐射三叶标志
    x.fillStyle = '#f0e14a';
    x.beginPath(); x.arc(0, 0, r * 0.12, 0, 7); x.fill();
    for (let i = 0; i < 3; i++) {
      const a0 = i * 2 * Math.PI / 3 - Math.PI / 2;
      x.beginPath();
      x.arc(0, 0, r * 0.44, a0 + 0.24, a0 + 0.24 + Math.PI / 3.6);
      x.arc(0, 0, r * 0.2, a0 + 0.24 + Math.PI / 3.6, a0 + 0.24, true);
      x.closePath();
      x.fill();
    }
    // 标志外圈
    x.strokeStyle = 'rgba(20,34,22,.6)';
    x.lineWidth = Math.max(0.8, s * 0.032);
    x.beginPath(); x.arc(0, 0, r * 0.5, 0, 7); x.stroke();
    // 底部状态灯
    x.fillStyle = '#9adc6a';
    x.beginPath(); x.arc(0, r * 0.6, r * 0.06, 0, 7); x.fill();
  },

  // 工具腰带：腰带环 + 工具袋 + 扳手
  'toolbelt-equipment': (x, r, s, col) => {
    // 腰带
    const g = x.createLinearGradient(0, -r * 0.3, 0, r * 0.1);
    g.addColorStop(0, lightenColor(col, 0.3));
    g.addColorStop(1, darkenColor(col, 0.35));
    x.fillStyle = g;
    rrPath(x, -r * 0.9, -r * 0.24, r * 1.8, r * 0.3, r * 0.08);
    x.fill();
    x.strokeStyle = 'rgba(52,40,22,.65)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 带扣
    x.fillStyle = '#c8ced8';
    rrPath(x, -r * 0.16, -r * 0.3, r * 0.32, r * 0.42, r * 0.06);
    x.fill();
    x.strokeStyle = 'rgba(52,40,22,.6)';
    x.lineWidth = Math.max(0.8, s * 0.032);
    x.stroke();
    x.fillStyle = darkenColor(col, 0.4);
    x.fillRect(-r * 0.06, -r * 0.2, r * 0.12, r * 0.22);
    // 工具袋
    const pg = x.createLinearGradient(-r * 0.4, 0, r * 0.1, r * 0.7);
    pg.addColorStop(0, lightenColor(col, 0.2));
    pg.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = pg;
    rrPath(x, -r * 0.66, r * 0.04, r * 0.62, r * 0.66, r * 0.12);
    x.fill();
    x.strokeStyle = 'rgba(52,40,22,.65)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.stroke();
    // 袋盖
    x.fillStyle = darkenColor(col, 0.25);
    rrPath(x, -r * 0.66, r * 0.04, r * 0.62, r * 0.26, r * 0.1);
    x.fill();
    x.stroke();
    // 扳手（挂在右侧）
    x.save();
    x.translate(r * 0.42, r * 0.34);
    x.rotate(0.6);
    x.strokeStyle = '#c8ced8';
    x.lineWidth = r * 0.1;
    x.lineCap = 'round';
    x.beginPath(); x.moveTo(0, -r * 0.3); x.lineTo(0, r * 0.24); x.stroke();
    x.fillStyle = '#c8ced8';
    x.beginPath();
    x.arc(0, -r * 0.34, r * 0.14, 0.5, Math.PI - 0.5);
    x.lineTo(-r * 0.06, -r * 0.3);
    x.lineTo(r * 0.06, -r * 0.3);
    x.closePath();
    x.fill();
    x.restore();
  },

  // 机械装甲：装甲躯干 + 关节结构 + 能源核心
  'mech-armor': (x, r, s, col) => {
    // 躯干主体（宽肩收腰）
    const g = x.createLinearGradient(-r * 0.7, -r * 0.7, r * 0.7, r * 0.7);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.45));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(-r * 0.78, -r * 0.5);
    x.lineTo(-r * 0.24, -r * 0.74);
    x.lineTo(r * 0.24, -r * 0.74);
    x.lineTo(r * 0.78, -r * 0.5);
    x.lineTo(r * 0.6, r * 0.74);
    x.lineTo(-r * 0.6, r * 0.74);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(16,22,36,.7)';
    x.lineWidth = Math.max(1, s * 0.05);
    x.lineJoin = 'round';
    x.stroke();
    // 肩部关节
    x.fillStyle = '#c8ced8';
    x.beginPath(); x.arc(-r * 0.7, -r * 0.4, r * 0.13, 0, 7); x.fill();
    x.beginPath(); x.arc(r * 0.7, -r * 0.4, r * 0.13, 0, 7); x.fill();
    x.strokeStyle = 'rgba(16,22,36,.6)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.stroke();
    // 中央能源核心
    const cg = x.createRadialGradient(-r * 0.04, -r * 0.06, r * 0.03, 0, 0, r * 0.2);
    cg.addColorStop(0, '#f0faff');
    cg.addColorStop(0.5, '#8ac8ff');
    cg.addColorStop(1, '#28488a');
    x.fillStyle = cg;
    x.beginPath(); x.arc(0, -r * 0.04, r * 0.18, 0, 7); x.fill();
    x.strokeStyle = 'rgba(16,22,36,.6)';
    x.lineWidth = Math.max(0.8, s * 0.032);
    x.stroke();
    // 腰部液压纹
    x.strokeStyle = 'rgba(200,210,225,.5)';
    x.lineWidth = Math.max(0.8, s * 0.032);
    for (let i = 0; i < 3; i++) {
      const py = r * 0.3 + i * r * 0.14;
      x.beginPath(); x.moveTo(-r * 0.4, py); x.lineTo(r * 0.4, py); x.stroke();
    }
    // 领口
    x.fillStyle = '#12182a';
    x.beginPath();
    x.moveTo(-r * 0.24, -r * 0.74);
    x.quadraticCurveTo(0, -r * 0.48, r * 0.24, -r * 0.74);
    x.closePath();
    x.fill();
  },

  // 轨道炮：手持轨道炮 + 双导轨 + 等离子束
  'railgun': (x, r, s, col) => {
    x.save();
    x.rotate(-0.3);
    // 炮身
    const g = x.createLinearGradient(-r * 0.6, 0, r * 0.6, 0);
    g.addColorStop(0, darkenColor(col, 0.3));
    g.addColorStop(0.45, lightenColor(col, 0.3));
    g.addColorStop(1, darkenColor(col, 0.38));
    x.fillStyle = g;
    rrPath(x, -r * 0.7, -r * 0.22, r * 1.5, r * 0.42, r * 0.1);
    x.fill();
    x.strokeStyle = 'rgba(28,26,56,.65)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.stroke();
    // 握把
    x.fillStyle = darkenColor(col, 0.25);
    x.beginPath();
    x.moveTo(-r * 0.3, r * 0.18);
    x.lineTo(r * 0.02, r * 0.18);
    x.lineTo(-r * 0.06, r * 0.8);
    x.lineTo(-r * 0.4, r * 0.74);
    x.closePath();
    x.fill();
    x.strokeStyle = 'rgba(28,26,56,.6)';
    x.stroke();
    // 双导轨
    x.fillStyle = '#c8ced8';
    x.fillRect(-r * 0.66, -r * 0.34, r * 1.4, r * 0.08);
    x.fillRect(-r * 0.66, r * 0.02, r * 1.4, r * 0.08);
    // 导轨间等离子束
    const bg = x.createLinearGradient(-r * 0.6, 0, r * 0.8, 0);
    bg.addColorStop(0, 'rgba(170,160,255,.3)');
    bg.addColorStop(0.7, 'rgba(200,190,255,.9)');
    bg.addColorStop(1, '#f4f0ff');
    x.fillStyle = bg;
    x.fillRect(-r * 0.62, -r * 0.24, r * 1.36, r * 0.24);
    // 尾部电容块
    x.fillStyle = darkenColor(col, 0.3);
    rrPath(x, -r * 0.9, -r * 0.26, r * 0.28, r * 0.34, r * 0.06);
    x.fill();
    x.strokeStyle = 'rgba(28,26,56,.6)';
    x.lineWidth = Math.max(0.8, s * 0.035);
    x.stroke();
    x.restore();
  },

  // ===== 流体 =====

  // 水：水滴 + 波浪纹
  'water': (x, r, s, col) => {
    // 水滴主体
    const g = x.createLinearGradient(-r * 0.4, -r * 0.6, r * 0.4, r * 0.6);
    g.addColorStop(0, lightenColor(col, 0.35));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.35));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(0, -r * 0.86);
    x.bezierCurveTo(r * 0.42, -r * 0.2, r * 0.62, r * 0.14, r * 0.62, r * 0.32);
    x.arc(0, r * 0.32, r * 0.62, 0, Math.PI);
    x.bezierCurveTo(-r * 0.62, r * 0.14, -r * 0.42, -r * 0.2, 0, -r * 0.86);
    x.fill();
    x.strokeStyle = 'rgba(18,52,94,.6)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.lineJoin = 'round';
    x.stroke();
    // 高光
    x.fillStyle = 'rgba(255,255,255,.55)';
    x.beginPath(); x.ellipse(-r * 0.22, r * 0.12, r * 0.13, r * 0.22, -0.5, 0, 7); x.fill();
    // 底部波浪纹
    x.strokeStyle = 'rgba(255,255,255,.5)';
    x.lineWidth = Math.max(0.9, s * 0.032);
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(-r * 0.34, r * 0.4);
    x.quadraticCurveTo(-r * 0.17, r * 0.3, 0, r * 0.4);
    x.quadraticCurveTo(r * 0.17, r * 0.5, r * 0.34, r * 0.4);
    x.stroke();
  },

  // 蒸汽：蒸汽团 + 上升气流线
  'steam': (x, r, s, col) => {
    // 蒸汽团（三圆组合云）
    const g = x.createLinearGradient(0, -r * 0.5, 0, r * 0.5);
    g.addColorStop(0, lightenColor(col, 0.3));
    g.addColorStop(1, darkenColor(col, 0.22));
    x.fillStyle = g;
    x.beginPath();
    x.arc(-r * 0.34, r * 0.18, r * 0.34, 0, 7);
    x.arc(r * 0.06, r * 0.0, r * 0.42, 0, 7);
    x.arc(r * 0.44, r * 0.22, r * 0.3, 0, 7);
    x.fill();
    x.strokeStyle = 'rgba(90,104,116,.55)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.lineJoin = 'round';
    x.stroke();
    // 上升气流线（三条波浪竖线）
    x.strokeStyle = 'rgba(255,255,255,.85)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.lineCap = 'round';
    for (const dx of [-0.22, 0.04, 0.3]) {
      x.beginPath();
      x.moveTo(dx * r, -r * 0.22);
      x.quadraticCurveTo(dx * r + r * 0.14, -r * 0.46, dx * r, -r * 0.64);
      x.quadraticCurveTo(dx * r - r * 0.1, -r * 0.8, dx * r + r * 0.06, -r * 0.94);
      x.stroke();
    }
    // 云体高光
    x.fillStyle = 'rgba(255,255,255,.6)';
    x.beginPath(); x.ellipse(-r * 0.1, -r * 0.16, r * 0.16, r * 0.1, -0.3, 0, 7); x.fill();
  },

  // ===== 流体系（原油/重油/轻油：油滴 + 浮标色带区分）=====
  // 共享骨架：深色油滴 + 顶部高光 + 底部反光；hue 由各自 col 决定
// 原油：近黑油滴 + 彩虹油膜反光弧
  'crude-oil': (x, r, s, col) => {
    _oilDrop(x, r, s, col, 'rgba(6,5,2,.75)');
    // 油膜彩虹反光：紫→绿渐变弧线
    const rg = x.createLinearGradient(-r * 0.3, -r * 0.5, r * 0.35, 0);
    rg.addColorStop(0, 'rgba(160,90,220,.5)');
    rg.addColorStop(0.5, 'rgba(90,200,120,.45)');
    rg.addColorStop(1, 'rgba(220,180,80,.4)');
    x.strokeStyle = rg;
    x.lineWidth = Math.max(1, s * 0.05);
    x.lineCap = 'round';
    x.beginPath();
    x.arc(r * 0.05, r * 0.1, r * 0.4, Math.PI * 1.05, Math.PI * 1.65);
    x.stroke();
  },

  // 重油：深褐油滴 + 双横流纹
  'heavy-oil': (x, r, s, col) => {
    _oilDrop(x, r, s, col, 'rgba(40,22,8,.7)');
    x.strokeStyle = 'rgba(220,160,90,.4)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(-r * 0.28, -r * 0.1);
    x.quadraticCurveTo(0, -r * 0.26, r * 0.3, -r * 0.08);
    x.moveTo(-r * 0.22, r * 0.12);
    x.quadraticCurveTo(0, r * 0.0, r * 0.24, r * 0.14);
    x.stroke();
  },

  // 轻油：琥珀油滴 + 单波浪纹 + 顶部亮泡
  'light-oil': (x, r, s, col) => {
    _oilDrop(x, r, s, col, 'rgba(70,36,8,.65)');
    // 顶部小气泡
    x.fillStyle = 'rgba(255,230,170,.65)';
    x.beginPath(); x.arc(r * 0.16, -r * 0.3, r * 0.1, 0, 7); x.fill();
    // 波浪纹
    x.strokeStyle = 'rgba(255,220,150,.45)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(-r * 0.28, r * 0.16);
    x.quadraticCurveTo(-r * 0.1, r * 0.04, 0, r * 0.16);
    x.quadraticCurveTo(r * 0.12, r * 0.28, r * 0.28, r * 0.16);
    x.stroke();
  },

  // 石油气：气泡团 + 上升小泡（亮金色调，示意气态）
  'petroleum-gas': (x, r, s, col) => {
    const g = x.createRadialGradient(-r * 0.15, -r * 0.2, r * 0.1, 0, 0, r * 0.8);
    g.addColorStop(0, lightenColor(col, 0.5));
    g.addColorStop(0.6, col);
    g.addColorStop(1, darkenColor(col, 0.4));
    x.fillStyle = g;
    // 主气泡（三圆组合，上小下大）
    x.beginPath();
    x.arc(-r * 0.22, r * 0.2, r * 0.34, 0, 7);
    x.arc(r * 0.18, r * 0.1, r * 0.42, 0, 7);
    x.arc(-r * 0.05, -r * 0.35, r * 0.26, 0, 7);
    x.fill();
    x.strokeStyle = 'rgba(120,90,20,.55)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.lineJoin = 'round';
    x.stroke();
    // 气泡高光点
    x.fillStyle = 'rgba(255,255,255,.6)';
    x.beginPath(); x.arc(r * 0.04, -r * 0.44, r * 0.07, 0, 7); x.fill();
    x.beginPath(); x.arc(r * 0.32, -r * 0.06, r * 0.05, 0, 7); x.fill();
  },

  // ===== 低温流体（Aquilo 系）=====
  // 氨：淡蓝冰晶瓶滴 + NH₃ 冷雾纹
  'ammonia': (x, r, s, col) => {
    const g = x.createLinearGradient(0, -r * 0.7, 0, r * 0.7);
    g.addColorStop(0, lightenColor(col, 0.45));
    g.addColorStop(0.6, col);
    g.addColorStop(1, darkenColor(col, 0.3));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(0, -r * 0.8);
    x.bezierCurveTo(r * 0.4, -r * 0.16, r * 0.58, r * 0.16, r * 0.58, r * 0.34);
    x.arc(0, r * 0.34, r * 0.58, 0, Math.PI);
    x.bezierCurveTo(-r * 0.58, r * 0.16, -r * 0.4, -r * 0.16, 0, -r * 0.8);
    x.fill();
    x.strokeStyle = 'rgba(70,100,120,.55)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.lineJoin = 'round';
    x.stroke();
    // 冷雾：两条白色斜雾纹
    x.strokeStyle = 'rgba(255,255,255,.5)';
    x.lineWidth = Math.max(0.9, s * 0.032);
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(-r * 0.3, r * 0.12);
    x.quadraticCurveTo(-r * 0.12, -r * 0.04, -r * 0.02, r * 0.14);
    x.moveTo(r * 0.04, r * 0.4);
    x.quadraticCurveTo(r * 0.2, r * 0.24, r * 0.32, r * 0.42);
    x.stroke();
    // 顶部霜晶
    x.fillStyle = 'rgba(255,255,255,.65)';
    x.beginPath(); x.arc(-r * 0.1, -r * 0.34, r * 0.08, 0, 7); x.fill();
  },

  // 氟：淡绿气体团 + 上飘小气团（示意强腐蚀性活泼气体）
  'fluorine': (x, r, s, col) => {
    const g = x.createRadialGradient(-r * 0.1, -r * 0.2, r * 0.08, 0, 0, r * 0.78);
    g.addColorStop(0, lightenColor(col, 0.5));
    g.addColorStop(0.6, col);
    g.addColorStop(1, darkenColor(col, 0.35));
    x.fillStyle = g;
    x.beginPath();
    x.arc(-r * 0.2, r * 0.16, r * 0.36, 0, 7);
    x.arc(r * 0.22, r * 0.06, r * 0.4, 0, 7);
    x.arc(r * 0.02, -r * 0.34, r * 0.28, 0, 7);
    x.fill();
    x.strokeStyle = 'rgba(60,110,50,.5)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.lineJoin = 'round';
    x.stroke();
    // 上飘小气团
    x.fillStyle = 'rgba(255,255,255,.4)';
    x.beginPath(); x.arc(-r * 0.34, -r * 0.52, r * 0.1, 0, 7); x.fill();
    x.beginPath(); x.arc(-r * 0.1, -r * 0.66, r * 0.06, 0, 7); x.fill();
    // 高光
    x.fillStyle = 'rgba(255,255,255,.55)';
    x.beginPath(); x.arc(r * 0.08, -r * 0.4, r * 0.08, 0, 7); x.fill();
  },

  // 氟酮（冷）：冰蓝滴 + 六角雪花晶
  'fluoroketone-cold': (x, r, s, col) => {
    const g = x.createLinearGradient(0, -r * 0.7, 0, r * 0.7);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(0.6, col);
    g.addColorStop(1, darkenColor(col, 0.32));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(0, -r * 0.82);
    x.bezierCurveTo(r * 0.4, -r * 0.18, r * 0.58, r * 0.16, r * 0.58, r * 0.34);
    x.arc(0, r * 0.34, r * 0.58, 0, Math.PI);
    x.bezierCurveTo(-r * 0.58, r * 0.16, -r * 0.4, -r * 0.18, 0, -r * 0.82);
    x.fill();
    x.strokeStyle = 'rgba(40,90,120,.55)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.lineJoin = 'round';
    x.stroke();
    // 雪花六角晶（三线交叉）
    x.strokeStyle = 'rgba(255,255,255,.85)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.lineCap = 'round';
    const sr = r * 0.3;
    for (let i = 0; i < 3; i++) {
      const a = i * Math.PI / 3 + Math.PI / 6;
      x.beginPath();
      x.moveTo(-Math.cos(a) * sr, -Math.sin(a) * sr + r * 0.08);
      x.lineTo(Math.cos(a) * sr, Math.sin(a) * sr + r * 0.08);
      x.stroke();
    }
    // 晶心
    x.fillStyle = '#eafaff';
    x.beginPath(); x.arc(0, r * 0.08, r * 0.08, 0, 7); x.fill();
  },

  // 氟酮（热）：橙红滴 + 上升热浪线
  'fluoroketone-hot': (x, r, s, col) => {
    const g = x.createLinearGradient(0, -r * 0.7, 0, r * 0.7);
    g.addColorStop(0, lightenColor(col, 0.45));
    g.addColorStop(0.55, col);
    g.addColorStop(1, darkenColor(col, 0.38));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(0, -r * 0.82);
    x.bezierCurveTo(r * 0.4, -r * 0.18, r * 0.58, r * 0.16, r * 0.58, r * 0.34);
    x.arc(0, r * 0.34, r * 0.58, 0, Math.PI);
    x.bezierCurveTo(-r * 0.58, r * 0.16, -r * 0.4, -r * 0.18, 0, -r * 0.82);
    x.fill();
    x.strokeStyle = 'rgba(130,50,10,.55)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.lineJoin = 'round';
    x.stroke();
    // 热浪：三条扭曲上升线
    x.strokeStyle = 'rgba(255,240,180,.8)';
    x.lineWidth = Math.max(1, s * 0.036);
    x.lineCap = 'round';
    for (const dx of [-0.2, 0.02, 0.24]) {
      x.beginPath();
      x.moveTo(dx * r, r * 0.2);
      x.quadraticCurveTo(dx * r + r * 0.12, r * 0.0, dx * r, -r * 0.16);
      x.quadraticCurveTo(dx * r - r * 0.12, -r * 0.32, dx * r, -r * 0.46);
      x.stroke();
    }
  },

  // 氨溶液：青绿水滴 + 溶解颗粒点
  'ammoniacal-solution': (x, r, s, col) => {
    const g = x.createLinearGradient(0, -r * 0.7, 0, r * 0.7);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(0.6, col);
    g.addColorStop(1, darkenColor(col, 0.3));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(0, -r * 0.82);
    x.bezierCurveTo(r * 0.4, -r * 0.18, r * 0.58, r * 0.16, r * 0.58, r * 0.34);
    x.arc(0, r * 0.34, r * 0.58, 0, Math.PI);
    x.bezierCurveTo(-r * 0.58, r * 0.16, -r * 0.4, -r * 0.18, 0, -r * 0.82);
    x.fill();
    x.strokeStyle = 'rgba(60,100,80,.55)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.lineJoin = 'round';
    x.stroke();
    // 溶解颗粒（青绿色小点悬浮）
    x.fillStyle = 'rgba(90,160,130,.6)';
    for (const [px, py, pr] of [[-0.22, 0.05, 0.07], [0.12, -0.16, 0.06], [0.2, 0.3, 0.06], [-0.05, 0.4, 0.05]]) {
      x.beginPath(); x.arc(px * r, py * r, pr * r, 0, 7); x.fill();
    }
    // 高光
    x.fillStyle = 'rgba(255,255,255,.5)';
    x.beginPath(); x.ellipse(-r * 0.2, r * 0.08, r * 0.1, r * 0.2, -0.5, 0, 7); x.fill();
  },

  // 锂盐水：淡绿卤水滴 + 锂晶立方
  'lithium-brine': (x, r, s, col) => {
    const g = x.createLinearGradient(0, -r * 0.7, 0, r * 0.7);
    g.addColorStop(0, lightenColor(col, 0.4));
    g.addColorStop(0.6, col);
    g.addColorStop(1, darkenColor(col, 0.3));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(0, -r * 0.82);
    x.bezierCurveTo(r * 0.4, -r * 0.18, r * 0.58, r * 0.16, r * 0.58, r * 0.34);
    x.arc(0, r * 0.34, r * 0.58, 0, Math.PI);
    x.bezierCurveTo(-r * 0.58, r * 0.16, -r * 0.4, -r * 0.18, 0, -r * 0.82);
    x.fill();
    x.strokeStyle = 'rgba(70,110,80,.55)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.lineJoin = 'round';
    x.stroke();
    // 悬浮锂晶（小菱形晶体）
    x.fillStyle = 'rgba(240,255,240,.85)';
    for (const [px, py] of [[-0.2, 0.02], [0.14, -0.14], [0.18, 0.32]]) {
      x.beginPath();
      x.moveTo(px * r, (py - 0.09) * r);
      x.lineTo((px + 0.07) * r, py * r);
      x.lineTo(px * r, (py + 0.09) * r);
      x.lineTo((px - 0.07) * r, py * r);
      x.closePath();
      x.fill();
    }
    // 高光
    x.fillStyle = 'rgba(255,255,255,.5)';
    x.beginPath(); x.ellipse(-r * 0.22, r * 0.1, r * 0.1, r * 0.2, -0.5, 0, 7); x.fill();
  },

  // 岩浆：熔岩滴 + 暗色熔渣壳 + 亮黄热流纹
  'lava': (x, r, s, col) => {
    const g = x.createLinearGradient(0, -r * 0.7, 0, r * 0.7);
    g.addColorStop(0, lightenColor(col, 0.45));
    g.addColorStop(0.5, col);
    g.addColorStop(1, darkenColor(col, 0.42));
    x.fillStyle = g;
    x.beginPath();
    x.moveTo(0, -r * 0.82);
    x.bezierCurveTo(r * 0.42, -r * 0.18, r * 0.6, r * 0.16, r * 0.6, r * 0.34);
    x.arc(0, r * 0.34, r * 0.6, 0, Math.PI);
    x.bezierCurveTo(-r * 0.6, r * 0.16, -r * 0.42, -r * 0.18, 0, -r * 0.82);
    x.fill();
    x.strokeStyle = 'rgba(90,30,5,.6)';
    x.lineWidth = Math.max(1, s * 0.045);
    x.lineJoin = 'round';
    x.stroke();
    // 熔渣壳（暗色斑块）
    x.fillStyle = 'rgba(50,20,8,.45)';
    x.beginPath(); x.ellipse(-r * 0.24, -r * 0.1, r * 0.18, r * 0.12, -0.4, 0, 7); x.fill();
    x.beginPath(); x.ellipse(r * 0.28, r * 0.3, r * 0.14, r * 0.1, 0.4, 0, 7); x.fill();
    // 炽亮热流纹
    x.strokeStyle = 'rgba(255,235,120,.9)';
    x.lineWidth = Math.max(1.2, s * 0.045);
    x.lineCap = 'round';
    x.beginPath();
    x.moveTo(-r * 0.1, -r * 0.5);
    x.quadraticCurveTo(r * 0.12, -r * 0.2, -r * 0.02, r * 0.1);
    x.quadraticCurveTo(-r * 0.14, r * 0.4, r * 0.06, r * 0.56);
    x.stroke();
  },

  // 等离子体：紫辉能量球 + 电弧环（聚变堆工作介质）
  'fusion-plasma': (x, r, s, col) => {
    // 外辉光
    const glow = x.createRadialGradient(0, 0, r * 0.1, 0, 0, r * 0.9);
    glow.addColorStop(0, lightenColor(col, 0.6));
    glow.addColorStop(0.55, col);
    glow.addColorStop(1, 'rgba(120,30,180,0)');
    x.fillStyle = glow;
    x.beginPath(); x.arc(0, 0, r * 0.9, 0, 7); x.fill();
    // 核心亮球
    const core = x.createRadialGradient(-r * 0.1, -r * 0.1, r * 0.04, 0, 0, r * 0.5);
    core.addColorStop(0, '#ffffff');
    core.addColorStop(0.35, lightenColor(col, 0.45));
    core.addColorStop(1, darkenColor(col, 0.3));
    x.fillStyle = core;
    x.beginPath(); x.arc(0, 0, r * 0.5, 0, 7); x.fill();
    // 环绕电弧（两道弧线）
    x.strokeStyle = 'rgba(230,160,255,.85)';
    x.lineWidth = Math.max(1.2, s * 0.05);
    x.lineCap = 'round';
    x.beginPath();
    x.ellipse(0, 0, r * 0.72, r * 0.3, -0.5, 0, 7);
    x.stroke();
    x.strokeStyle = 'rgba(160,80,240,.7)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.beginPath();
    x.ellipse(0, 0, r * 0.72, r * 0.3, 0.9, 0, 7);
    x.stroke();
  },

  // ===== 熔融金属（Vulcanus 铸造厂）=====
  // 共享骨架：坩埚浇口金属流 + 熔融液面波纹
// 熔融铁：铁锈橙熔流
  'molten-iron': (x, r, s, col) => {
    _molten(x, r, s, col, 'rgba(110,50,30,.6)');
  },

  // 熔融铜：铜橙熔流
  'molten-copper': (x, r, s, col) => {
    _molten(x, r, s, col, 'rgba(140,70,20,.6)');
  },

  // ===== 流体阀门（1×1，对齐《异星工厂》2.0）=====
  // 共享骨架：金属阀体 + 左右管口 + 中央手轮
// 单向阀：阀体 + 白色单向箭头（→）
  'one-way-valve': (x, r, s, col) => {
    _valve(x, r, s, col);
    x.fillStyle = '#fff';
    x.beginPath();
    x.moveTo(-r * 0.34, -r * 0.08);
    x.lineTo(r * 0.06, -r * 0.08);
    x.lineTo(r * 0.06, -r * 0.2);
    x.lineTo(r * 0.34, 0);
    x.lineTo(r * 0.06, r * 0.2);
    x.lineTo(r * 0.06, r * 0.08);
    x.lineTo(-r * 0.34, r * 0.08);
    x.closePath();
    x.fill();
  },

  // 溢出阀：阀体 + 上溢箭头（↑ 出自液面）
  'overflow-valve': (x, r, s, col) => {
    _valve(x, r, s, col);
    // 液面线
    x.strokeStyle = 'rgba(255,255,255,.7)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.beginPath();
    x.moveTo(-r * 0.34, r * 0.16);
    x.quadraticCurveTo(-r * 0.15, r * 0.08, 0, r * 0.16);
    x.quadraticCurveTo(r * 0.15, r * 0.24, r * 0.34, r * 0.16);
    x.stroke();
    // 上溢箭头
    x.fillStyle = '#fff';
    x.beginPath();
    x.moveTo(-r * 0.08, r * 0.02);
    x.lineTo(-r * 0.08, -r * 0.14);
    x.lineTo(-r * 0.2, -r * 0.14);
    x.lineTo(0, -r * 0.38);
    x.lineTo(r * 0.2, -r * 0.14);
    x.lineTo(r * 0.08, -r * 0.14);
    x.lineTo(r * 0.08, r * 0.02);
    x.closePath();
    x.fill();
  },

  // 补给阀：阀体 + 下补箭头（↓ 落入液面）
  'top-up-valve': (x, r, s, col) => {
    _valve(x, r, s, col);
    // 液面线
    x.strokeStyle = 'rgba(255,255,255,.7)';
    x.lineWidth = Math.max(1, s * 0.04);
    x.beginPath();
    x.moveTo(-r * 0.34, r * 0.3);
    x.quadraticCurveTo(-r * 0.15, r * 0.22, 0, r * 0.3);
    x.quadraticCurveTo(r * 0.15, r * 0.38, r * 0.34, r * 0.3);
    x.stroke();
    // 下补箭头
    x.fillStyle = '#fff';
    x.beginPath();
    x.moveTo(-r * 0.08, -r * 0.36);
    x.lineTo(-r * 0.08, -r * 0.18);
    x.lineTo(-r * 0.2, -r * 0.18);
    x.lineTo(0, r * 0.08);
    x.lineTo(r * 0.2, -r * 0.18);
    x.lineTo(r * 0.08, -r * 0.18);
    x.lineTo(r * 0.08, -r * 0.36);
    x.closePath();
    x.fill();
  },

  // ===== 遥控器 =====
  // 共享骨架：手持遥控器壳体 + 天线 + 功能屏
// 重炮瞄准遥控器：屏显炮击准星（圆 + 十字）
  'artillery-targeting-remote': (x, r, s, col) => {
    _remote(x, r, s, col);
    x.save();
    x.rotate(-0.12);
    // 准星：圆环 + 十字线
    x.strokeStyle = '#e04a3a';
    x.lineWidth = Math.max(1, s * 0.04);
    x.beginPath(); x.arc(0, -r * 0.18, r * 0.16, 0, 7); x.stroke();
    x.beginPath();
    x.moveTo(-r * 0.26, -r * 0.18); x.lineTo(-r * 0.1, -r * 0.18);
    x.moveTo(r * 0.1, -r * 0.18); x.lineTo(r * 0.26, -r * 0.18);
    x.moveTo(0, -r * 0.44); x.lineTo(0, -r * 0.3);
    x.moveTo(0, -r * 0.06); x.lineTo(0, r * 0.08);
    x.stroke();
    // 屏下按钮
    x.fillStyle = '#d8b23a';
    x.beginPath(); x.arc(-r * 0.12, r * 0.34, r * 0.07, 0, 7); x.fill();
    x.fillStyle = '#4ac06a';
    x.beginPath(); x.arc(r * 0.12, r * 0.34, r * 0.07, 0, 7); x.fill();
    x.restore();
  },

  // 放电防御遥控器：屏显闪电符号
  'discharge-defense-remote': (x, r, s, col) => {
    _remote(x, r, s, col);
    x.save();
    x.rotate(-0.12);
    // 闪电符号
    x.fillStyle = '#f0d24a';
    x.beginPath();
    x.moveTo(r * 0.04, -r * 0.42);
    x.lineTo(-r * 0.12, -r * 0.16);
    x.lineTo(-r * 0.02, -r * 0.16);
    x.lineTo(-r * 0.1, r * 0.04);
    x.lineTo(r * 0.06, -r * 0.2);
    x.lineTo(-r * 0.04, -r * 0.2);
    x.lineTo(r * 0.12, -r * 0.42);
    x.closePath();
    x.fill();
    // 电弧小点
    x.strokeStyle = 'rgba(140,220,255,.9)';
    x.lineWidth = Math.max(0.8, s * 0.03);
    x.beginPath();
    x.moveTo(-r * 0.24, -r * 0.34);
    x.lineTo(-r * 0.18, -r * 0.24);
    x.lineTo(-r * 0.26, -r * 0.14);
    x.moveTo(r * 0.2, -r * 0.3);
    x.lineTo(r * 0.14, -r * 0.2);
    x.lineTo(r * 0.22, -r * 0.1);
    x.stroke();
    // 屏下按钮
    x.fillStyle = '#d8b23a';
    x.beginPath(); x.arc(-r * 0.12, r * 0.34, r * 0.07, 0, 7); x.fill();
    x.fillStyle = '#4ac06a';
    x.beginPath(); x.arc(r * 0.12, r * 0.34, r * 0.07, 0, 7); x.fill();
    x.restore();
  },

  
};
