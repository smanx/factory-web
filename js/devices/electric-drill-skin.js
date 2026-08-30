'use strict';

// ===== 电力采矿机：全新外观皮肤（纯渲染覆盖，不改任何数值/逻辑）=====
// 设计语言（电力采矿机以工业蓝为主配色，呼应“电”的语义，与热能采矿机的棕色、大型采矿机的深蓝拉开档位差异）：
//   ① 深钢框架 + 工业蓝机身（纵向渐变/顶部光泽）+ 四角螺栓，厚重工业感；
//   ② 顶部旋转工作台：深钢圆盘 + 蓝白警示环 + 三幅旋翼，随主轴 e.spin 旋转；
//      工作时外圈叠加绿色采矿进度环（与原绘制语义一致）；
//   ③ 产出方向（dir 侧）：深色输出滑槽 + 螺旋钻杆——工作时钻杆上下浮动、
//      螺旋纹向前滚动，直观表达"正在钻进/产出"；滑槽两侧保留方向指示三角；
//   ④ 背侧散热格栅；顶部中央电源指示灯（青=工作中 / 红=缺电 / 黄=其他停摆告警）；
//      左下 3 格模块槽指示灯；底部青色电力条（工作时点亮）；
//   ⑤ 硫酸接入口（除产出方向外 3 面的绿色法兰）完全沿用 drawPort 原绘制，管道接法/悬停提示不变。
// 本文件只覆盖 DEVICE_RENDER['electric-mining-drill']：删除本文件并移除 index.html 中
// 对应一行 <script> 即可还原为原绘制，不影响存档/逻辑/面板。
function drawElectricDrillSkin(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w;                 // 机身边长（电采矿机 3×3 → 96px）
  const k = s / 96;                     // 以 96px 为基准的缩放系数（尺寸异常时仍成比例）
  const cx = px + s / 2, cy = py + s / 2;
  const working = !!e.working;
  const spin = e.spin || 0;
  const simple = (typeof LOD !== 'undefined' && LOD && LOD.simple);
  ctx.globalAlpha = alpha;

  // ---- 低 LOD（缩远）：只留机身剪影，省掉细节 ----
  if (simple) {
    ctx.fillStyle = '#2b2f37';
    rr(ctx, px + 3 * k, py + 3 * k, s - 6 * k, s - 6 * k, 8 * k); ctx.fill();
    ctx.fillStyle = '#5b8fd6';
    rr(ctx, px + 7 * k, py + 7 * k, s - 14 * k, s - 14 * k, 6 * k); ctx.fill();
    ctx.fillStyle = '#232830';
    ctx.beginPath(); ctx.arc(cx, cy, 14 * k, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }

  // ===== ① 深钢底座框架 =====
  ctx.fillStyle = '#2b2f37';
  rr(ctx, px + 2.5 * k, py + 2.5 * k, s - 5 * k, s - 5 * k, 10 * k); ctx.fill();
  ctx.strokeStyle = '#14171c';
  ctx.lineWidth = 3 * k;
  rr(ctx, px + 2.5 * k, py + 2.5 * k, s - 5 * k, s - 5 * k, 10 * k); ctx.stroke();

  // ===== ② 工业蓝机身（纵向渐变 + 顶部光泽）=====
  const bodyGrad = ctx.createLinearGradient(0, py, 0, py + s);
  bodyGrad.addColorStop(0, '#a9cdf5');
  bodyGrad.addColorStop(0.55, '#5b8fd6');
  bodyGrad.addColorStop(1, '#3a6bb0');
  ctx.fillStyle = bodyGrad;
  rr(ctx, px + 6 * k, py + 6 * k, s - 12 * k, s - 12 * k, 7 * k); ctx.fill();
  ctx.strokeStyle = 'rgba(20,46,86,.6)';
  ctx.lineWidth = 1.5 * k;
  rr(ctx, px + 6 * k, py + 6 * k, s - 12 * k, s - 12 * k, 7 * k); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.16)';
  rr(ctx, px + 9 * k, py + 8.5 * k, s - 18 * k, s * 0.30, 5 * k); ctx.fill();

  // ===== ③ 四角螺栓 =====
  ctx.fillStyle = '#3a3f48';
  for (const [bx, by] of [[12.5, 12.5], [s - 12.5, 12.5], [12.5, s - 12.5], [s - 12.5, s - 12.5]]) {
    ctx.beginPath(); ctx.arc(px + bx * k, py + by * k, 2.4 * k, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  for (const [bx, by] of [[11.9, 11.9], [s - 13.1, 11.9], [11.9, s - 13.1], [s - 13.1, s - 13.1]]) {
    ctx.beginPath(); ctx.arc(px + bx * k, py + by * k, 0.8 * k, 0, Math.PI * 2); ctx.fill();
  }

  // ===== ④ 朝向相关部件（随 dir 旋转；+x 指向产出方向）=====
  // 先画背侧格栅与前侧滑槽（在旋转工作台圆盘之下）
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(dir * Math.PI / 2);
  // 背侧散热格栅（4 条短槽，分列背侧管道法兰上下，避免与法兰重叠）
  ctx.fillStyle = '#20242c';
  for (const gy of [-19, -12.5, 12.5, 19]) {
    rr(ctx, (-s / 2 + 9) * k, (gy - 1.7) * k, 12 * k, 3.4 * k, 1.5 * k); ctx.fill();
  }
  // 前侧输出滑槽（深色梯形口，内段被工作台圆盘压住，外端伸出机身像出料嘴）
  ctx.fillStyle = '#1d2129';
  ctx.beginPath();
  ctx.moveTo(24 * k, -11 * k);
  ctx.lineTo(44 * k, -7.5 * k);
  ctx.lineTo(44 * k, 7.5 * k);
  ctx.lineTo(24 * k, 11 * k);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#0e1014';
  ctx.lineWidth = 1.2 * k;
  ctx.stroke();
  ctx.restore();

  // ===== ⑤ 顶部旋转工作台（深钢圆盘 + 黄黑警示环 + 三幅旋翼 + 轴心）=====
  const R = 26 * k;                                   // 工作台圆盘半径
  ctx.fillStyle = '#232830';
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#0f1217';
  ctx.lineWidth = 2.5 * k;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(spin);
  // 蓝白警示环：8 道蓝色楔形块随主轴旋转
  const rOut = 23.5 * k, rIn = 16.5 * k;
  ctx.fillStyle = '#2f5596';
  for (let i = 0; i < 8; i++) {
    const a0 = (i / 8) * Math.PI * 2;
    const a1 = a0 + Math.PI * 2 / 8 * 0.55;
    ctx.beginPath();
    ctx.arc(0, 0, rOut, a0, a1);
    ctx.arc(0, 0, rIn, a1, a0, true);
    ctx.closePath(); ctx.fill();
  }
  // 三幅旋翼
  ctx.fillStyle = '#4b5464';
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.rotate(i * Math.PI * 2 / 3);
    rr(ctx, 3.5 * k, -2.6 * k, 12 * k, 5.2 * k, 2.6 * k); ctx.fill();
    ctx.restore();
  }
  // 轴心轮毂
  ctx.fillStyle = '#6b7688';
  ctx.beginPath(); ctx.arc(0, 0, 7 * k, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#2a303b';
  ctx.lineWidth = 1.5 * k;
  ctx.beginPath(); ctx.arc(0, 0, 7 * k, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#232830';
  ctx.beginPath(); ctx.arc(0, 0, 2.4 * k, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // ===== ⑥ 采矿进度环（工作时绿色弧，与原绘制语义一致）=====
  const pct = working ? Math.min(1, (e.prog || 0) / e.oreTime()) : 0;
  if (pct > 0) {
    ctx.strokeStyle = 'rgba(8,12,18,.35)';
    ctx.lineWidth = 2.5 * k;
    ctx.beginPath(); ctx.arc(cx, cy, R + 3.2 * k, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#8fe08f';
    ctx.lineWidth = 3 * k;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, R + 3.2 * k, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  // ===== ⑦ 前侧螺旋钻杆 + 方向指示三角（盖在工作台边缘之上）=====
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(dir * Math.PI / 2);
  // 钻杆整体随主轴沿钻进方向往复伸缩（工作时）
  const bob = working ? Math.sin(spin * 2.2) * 1.4 * k : 0;
  ctx.translate(bob, 0);
  // 钻杆主体（金属方杆）
  const stemGrad = ctx.createLinearGradient(0, -5 * k, 0, 5 * k);
  stemGrad.addColorStop(0, '#aeb9c9');
  stemGrad.addColorStop(1, '#78828f');
  ctx.fillStyle = stemGrad;
  rr(ctx, 22 * k, -5 * k, 12 * k, 10 * k, 2.5 * k); ctx.fill();
  ctx.strokeStyle = '#4a5260';
  ctx.lineWidth = 1.3 * k;
  rr(ctx, 22 * k, -5 * k, 12 * k, 10 * k, 2.5 * k); ctx.stroke();
  // 螺旋纹（工作时向前滚动）：裁剪在钻杆内画斜纹
  ctx.save();
  rr(ctx, 22 * k, -5 * k, 12 * k, 10 * k, 2.5 * k); ctx.clip();
  ctx.strokeStyle = '#5a6373';
  ctx.lineWidth = 2 * k;
  const off = working ? ((spin * 7) % 7) : 0;
  for (let i = -1; i <= 2; i++) {
    const bx = (20 + i * 7 + off) * k;
    ctx.beginPath();
    ctx.moveTo(bx, -5.5 * k);
    ctx.lineTo(bx + 6 * k, 5.5 * k);
    ctx.stroke();
  }
  ctx.restore();
  // 钻头（尖三角，尖端探出机身出料嘴）
  ctx.fillStyle = '#c9d2de';
  tri(ctx, 34 * k, -7 * k, 34 * k, 7 * k, 47 * k, 0);
  ctx.fill();
  ctx.strokeStyle = '#4a5260';
  ctx.lineWidth = 1.3 * k;
  ctx.stroke();
  ctx.restore();

  // 方向指示三角（滑槽两侧，颜色沿用方向编码）
  ctx.fillStyle = dirColorNotch(dir);
  for (const m of [-15, 15]) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(dir * Math.PI / 2);
    ctx.translate(40 * k, m * k);
    tri(ctx, -4 * k, -4 * k, -4 * k, 4 * k, 3.5 * k, 0);
    ctx.fill();
    ctx.restore();
  }

  // ===== ⑧ 机身右上前角状态指示灯（青=工作 / 红=缺电 / 黄=告警 / 灰=待机）=====
  let ledCore = '#3a414d', ledHalo = null;
  if (working) { ledCore = '#7ff0ff'; ledHalo = 'rgba(95,230,255,'; }
  else if (e.status === '缺电') { ledCore = '#ff5b4a'; ledHalo = 'rgba(255,91,74,'; }
  else if (e.status) { ledCore = '#ffb43a'; ledHalo = 'rgba(255,180,58,'; }
  // 灯位在机身右上前角（避开顶边硫酸法兰与四角螺栓）
  const ledX = px + 72 * k, ledY = py + 13 * k;
  if (ledHalo) {
    const pulse = working ? (0.85 + 0.15 * Math.sin(spin * 1.6)) : 0.9;
    ctx.fillStyle = ledHalo + (0.22 * pulse).toFixed(3) + ')';
    ctx.beginPath(); ctx.arc(ledX, ledY, 5.2 * k, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ledHalo + (0.4 * pulse).toFixed(3) + ')';
    ctx.beginPath(); ctx.arc(ledX, ledY, 3.6 * k, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = ledCore;
  ctx.beginPath(); ctx.arc(ledX, ledY, 2.5 * k, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(10,12,16,.7)';
  ctx.lineWidth = 1 * k;
  ctx.beginPath(); ctx.arc(ledX, ledY, 2.5 * k, 0, Math.PI * 2); ctx.stroke();

  // ===== ⑨ 左下模块槽指示灯（3 槽，已装模块数点亮）=====
  let modN = 0;
  if (e.modules) { for (const mk in e.modules) modN += e.modules[mk] || 0; }
  for (let i = 0; i < 3; i++) {
    const dx = px + (11 + i * 8) * k, dy = py + (s - 18.5) * k;
    if (i < modN) {
      ctx.fillStyle = 'rgba(64,210,255,.25)';
      ctx.beginPath(); ctx.arc(dx, dy, 3.4 * k, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#37c6f0';
      ctx.beginPath(); ctx.arc(dx, dy, 2.1 * k, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = 'rgba(30,34,42,.28)';
      ctx.beginPath(); ctx.arc(dx, dy, 2.1 * k, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(30,34,42,.55)';
      ctx.lineWidth = 1 * k;
      ctx.beginPath(); ctx.arc(dx, dy, 2.1 * k, 0, Math.PI * 2); ctx.stroke();
    }
  }

  // ===== ⑩ 底部电力条（工作时青色点亮，与原电采矿机电量条语义一致）=====
  ctx.fillStyle = 'rgba(10,14,18,.55)';
  rr(ctx, px + 10 * k, py + s - 12 * k, s - 20 * k, 5 * k, 2 * k); ctx.fill();
  if (working) {
    ctx.fillStyle = 'rgba(143,224,255,.85)';
    rr(ctx, px + 10 * k, py + s - 12 * k, s - 20 * k, 5 * k, 2 * k); ctx.fill();
  }

  // ===== ⑪ 硫酸接入口（除产出方向外 3 面绿色法兰；绘制与原 drawDrill 完全一致）=====
  for (const sd of [(dir + 1) % 4, (dir + 2) % 4, (dir + 3) % 4]) {
    drawPort(ctx, cx, cy, sd, PORT_INPUT, false, 0, s / 2, 'sulfuric-acid', 'in');
  }

  ctx.globalAlpha = 1;
}

// ===== 注册：仅覆盖电力采矿机的渲染（热能采矿机/抽油机/大型采矿机不变）=====
DEVICE_RENDER['electric-mining-drill'] = drawElectricDrillSkin;
