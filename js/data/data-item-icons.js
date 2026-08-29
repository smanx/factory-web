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

};
