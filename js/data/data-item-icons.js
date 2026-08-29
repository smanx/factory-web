'use strict';

// ===== 专属物品图标（手绘 canvas 绘制函数）=====
// 命中本表的物品在 drawItemGlyph（data-util.js）中优先使用专属绘制，跳过 emoji 兜底。
// 设计进度记录见 docs/item-icons-todo.md（每完成一项勾选对应条目）。
// 绘制约定：坐标系原点在图标中心，r = 图标半径（s/2），col = ITEMS[id].color，
// 可用工具：rrPath / lightenColor / darkenColor / dark（深色描边）。
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
};
