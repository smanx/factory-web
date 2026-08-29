'use strict';

// ===== 热能采矿机：全新外观皮肤（纯渲染覆盖，不改任何数值/逻辑）=====
// 设计语言（现实「蒸汽钻机」的俯视演绎，与锅炉/蒸汽机皮肤同属蒸汽朋克家族：
// 后舱烧火、前塔钻探，R 旋转 = 整机调头朝向产出方向）：
//   ① 深钢底座 + 双枕木滑橇（可搬移的钻机车感）+ 四角螺栓；
//   ② 后舱（-x 背侧）：立式铜锅炉（箍环 + 铆钉 + 顶部高光）+ 东侧拱形炉门
//      （燃烧时透火）+ 北端小烟囱（工作时排烟，烟团上飘淡出）；
//   ③ 煤仓（后舱南端开口料斗）：煤堆高度随燃料总量实时变化——燃料一眼可见；
//   ④ 传动：锅炉→飞轮（辐条随主轴 e.spin 旋转）→皮带→钻塔顶滑轮；
//   ⑤ 前塔（+x 产出侧）：桁架井架（双 X 交叉撑）+ 中央竖直钻杆 + 三刃钻头
//      （工作时随 e.spin 旋转 + 轻微冲击进给），钻头正对产出方向；
//      外圈绿色采矿进度环（与电采矿机/抽油机皮肤语义一致）；
//   ⑥ 交互语义原样保留：燃料条（顶部橙条）、状态 LED（绿=工作/橙=告警/暗=待机）、
//      产出方向双色指示三角、扬尘粒子（逻辑层 drillEmit 自动保留）。
// 本文件只覆盖 DEVICE_RENDER['burner-mining-drill']：删除本文件并移除 index.html 中
// 对应一行 <script> 即可还原为原绘制，不影响存档/逻辑/面板。
function drawBurnerDrillSkin(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w;                 // 机身边长（热能采矿机 2×2 → 64px）
  const k = s / 64;                      // 以 64px 为基准的缩放系数（尺寸异常时仍成比例）
  const cx = px + s / 2, cy = py + s / 2;
  const working = !!e.working;
  const spin = e.spin || 0;
  const simple = (typeof LOD !== 'undefined' && LOD && LOD.simple);
  ctx.globalAlpha = alpha;

  // 燃料总量（煤仓煤堆高度用）：四种燃料折算件数总和
  const fuelTotal = (e.fuelCoal || 0) + (e.fuelWood || 0) + (e.fuelSolid || 0) + (e.fuelRocket || 0);

  // ---- 低 LOD（缩远）：底座 + 锅炉块 + 钻头剪影 ----
  if (simple) {
    ctx.fillStyle = '#2b2f37';
    rr(ctx, px + 2 * k, py + 2 * k, s - 4 * k, s - 4 * k, 8 * k); ctx.fill();
    ctx.fillStyle = '#8a5a34';
    rr(ctx, px + 6 * k, py + 10 * k, 18 * k, 30 * k, 8 * k); ctx.fill();
    ctx.fillStyle = working ? '#c4ccd8' : '#6a7280';
    ctx.beginPath(); ctx.arc(px + 45 * k, cy, 6 * k, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }

  // ===== 朝向坐标系（+x = 产出方向；锅炉/钻塔/煤仓随 dir 一起旋转）=====
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(dir * Math.PI / 2);
  ctx.scale(k, k);
  // 此后以中心为原点，坐标域 [-32, 32]

  // ===== ① 深钢底座 =====
  ctx.fillStyle = '#2b2f37';
  rr(ctx, -30, -30, 60, 60, 9); ctx.fill();
  ctx.strokeStyle = '#14171c';
  ctx.lineWidth = 2.5;
  rr(ctx, -30, -30, 60, 60, 9); ctx.stroke();

  // ===== ② 双枕木滑橇（沿机器朝向的两条木橇）=====
  ctx.fillStyle = '#3a2f26';
  for (const oy of [-20, 14]) {
    rr(ctx, -28, oy, 56, 6, 2); ctx.fill();
    ctx.strokeStyle = '#221a12';
    ctx.lineWidth = 1;
    rr(ctx, -28, oy, 56, 6, 2); ctx.stroke();
    // 枕木固定螺栓
    ctx.fillStyle = '#1a140e';
    for (const bx of [-22, -8, 8, 22]) {
      ctx.beginPath(); ctx.arc(bx, oy + 3, 1.1, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ===== ③ 后舱：立式铜锅炉（-x 侧）=====
  const boilerGrad = ctx.createLinearGradient(-24, 0, -8, 0);
  boilerGrad.addColorStop(0, '#6b4224');
  boilerGrad.addColorStop(0.5, '#9a6a3e');
  boilerGrad.addColorStop(1, '#7a5230');
  ctx.fillStyle = boilerGrad;
  rr(ctx, -24, -20, 16, 34, 7); ctx.fill();
  ctx.strokeStyle = '#4a2c14';
  ctx.lineWidth = 1.8;
  rr(ctx, -24, -20, 16, 34, 7); ctx.stroke();
  // 顶部高光
  ctx.fillStyle = 'rgba(255,255,255,.14)';
  rr(ctx, -22.5, -18, 5, 30, 2.5); ctx.fill();
  // 箍环 ×2
  ctx.fillStyle = '#5a3418';
  rr(ctx, -24.5, -11, 17, 2.6, 1.3); ctx.fill();
  rr(ctx, -24.5, 2, 17, 2.6, 1.3); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.12)';
  rr(ctx, -24.5, -11, 17, 0.8, 0.4); ctx.fill();
  rr(ctx, -24.5, 2, 17, 0.8, 0.4); ctx.fill();
  // 铆钉
  ctx.fillStyle = '#3a2210';
  for (const by of [-16, -9, -2, 5, 11]) {
    ctx.beginPath(); ctx.arc(-22.5, by, 0.9, 0, Math.PI * 2); ctx.fill();
  }
  // 小烟囱（锅炉北端顶部）
  ctx.fillStyle = '#3a3f46';
  ctx.beginPath(); ctx.arc(-16, -22, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1c2026';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(-16, -22, 3.4, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#101317';
  ctx.beginPath(); ctx.arc(-16, -22, 1.8, 0, Math.PI * 2); ctx.fill();
  // 工作时排烟（烟囱口向上飘的小烟团）
  if (working) {
    for (let i = 0; i < 2; i++) {
      const ph = ((G.time || 0) * 0.55 + i * 0.5) % 1;
      ctx.fillStyle = 'rgba(200,180,160,' + (0.42 * (1 - ph)).toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(-16 + Math.sin(ph * 5 + i * 2) * 1.4, -24 - ph * 8, 1.2 + ph * 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ===== ④ 拱形炉门（锅炉东侧，燃烧时透火）=====
  ctx.fillStyle = '#1d1713';
  ctx.beginPath();
  ctx.moveTo(-8, 6);
  ctx.lineTo(-8, -2);
  ctx.arc(-4, -2, 4, Math.PI, 0);
  ctx.lineTo(0, 6);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#0f0b08';
  ctx.lineWidth = 1;
  ctx.stroke();
  if ((e.burnLeft || 0) > 0) {
    const fl = 0.5 + 0.22 * Math.sin((G.time || 0) * 12 + px);
    ctx.fillStyle = 'rgba(255,150,50,' + (fl * 0.6).toFixed(2) + ')';
    ctx.beginPath();
    ctx.moveTo(-7, 5.5);
    ctx.lineTo(-7, -2);
    ctx.arc(-4, -2, 3, Math.PI, 0);
    ctx.lineTo(-1, 5.5);
    ctx.closePath(); ctx.fill();
  }

  // ===== ⑤ 煤仓（后舱南端开口料斗；煤堆高度随燃料总量）=====
  ctx.fillStyle = '#33302c';
  rr(ctx, -24, 16, 16, 12, 3); ctx.fill();
  ctx.strokeStyle = '#1a1815';
  ctx.lineWidth = 1.5;
  rr(ctx, -24, 16, 16, 12, 3); ctx.stroke();
  // 斗口沿
  ctx.fillStyle = '#454038';
  rr(ctx, -25, 15, 18, 2.5, 1.2); ctx.fill();
  // 煤堆（高度 0~8，随 fuelTotal；每 5 件堆满一格）
  const heapPct = Math.max(0, Math.min(1, fuelTotal / 10));
  if (heapPct > 0) {
    const hh = 8 * heapPct;
    ctx.fillStyle = '#14120f';
    ctx.beginPath();
    ctx.moveTo(-22.5, 27);
    ctx.lineTo(-22.5, 27 - hh * 0.5);
    ctx.lineTo(-16, 27 - hh);
    ctx.lineTo(-9.5, 27 - hh * 0.5);
    ctx.lineTo(-9.5, 27);
    ctx.closePath(); ctx.fill();
    // 煤块高光颗粒
    ctx.fillStyle = 'rgba(120,115,105,.5)';
    for (const [gx2, gy2] of [[-20, 25], [-15, 23.5], [-11, 25.5]]) {
      ctx.beginPath(); ctx.arc(gx2, gy2, 0.7, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ===== ⑥ 传动：飞轮（辐条随主轴旋转）+ 皮带 =====
  // 皮带：锅炉侧动力轴 → 飞轮 → 钻塔顶滑轮
  ctx.strokeStyle = '#4a4038';
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(-8, -12);
  ctx.lineTo(2, -12);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(6, -12);
  ctx.lineTo(18, -12);
  ctx.stroke();
  // 飞轮
  ctx.fillStyle = '#54626e';
  ctx.beginPath(); ctx.arc(4, -12, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1c2128';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(4, -12, 4.5, 0, Math.PI * 2); ctx.stroke();
  ctx.save();
  ctx.translate(4, -12);
  ctx.rotate(spin);
  ctx.strokeStyle = '#39434d';
  ctx.lineWidth = 1.2;
  for (let i = 0; i < 2; i++) {
    ctx.save();
    ctx.rotate(i * Math.PI);
    ctx.beginPath(); ctx.moveTo(1.2, 0); ctx.lineTo(3.8, 0); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  ctx.fillStyle = '#333d44';
  ctx.beginPath(); ctx.arc(4, -12, 1.4, 0, Math.PI * 2); ctx.fill();
  // 塔顶滑轮
  ctx.fillStyle = '#54626e';
  ctx.beginPath(); ctx.arc(20, -12, 3.2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1c2128';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(20, -12, 3.2, 0, Math.PI * 2); ctx.stroke();

  // ===== ⑦ 钻塔井架（+x 产出侧：双 X 桁架）=====
  ctx.fillStyle = '#39434d';
  rr(ctx, 12, -18, 16, 36, 3); ctx.fill();
  ctx.strokeStyle = '#171b22';
  ctx.lineWidth = 1.5;
  rr(ctx, 12, -18, 16, 36, 3); ctx.stroke();
  // 双 X 交叉撑
  ctx.strokeStyle = '#232a33';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(14, -16); ctx.lineTo(26, -2); ctx.moveTo(26, -16); ctx.lineTo(14, -2);
  ctx.moveTo(14, 2); ctx.lineTo(26, 16); ctx.moveTo(26, 2); ctx.lineTo(14, 16);
  ctx.stroke();
  // 井架内高光
  ctx.strokeStyle = 'rgba(200,214,226,.12)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(13.5, -17); ctx.lineTo(13.5, 17); ctx.stroke();

  // ===== ⑧ 中央钻杆 + 三刃钻头（正对产出方向，随主轴旋转 + 工作时冲击进给）=====
  const bob = working ? Math.sin(spin * 2.2) * 1.2 : 0;   // 进给浮动
  ctx.save();
  ctx.translate(20 + bob, 0);
  // 钻杆（金属渐变）
  const stemGrad = ctx.createLinearGradient(-2.5, 0, 2.5, 0);
  stemGrad.addColorStop(0, '#c2cdd6');
  stemGrad.addColorStop(1, '#78828f');
  ctx.fillStyle = stemGrad;
  rr(ctx, -2.5, -18, 5, 24, 2); ctx.fill();
  ctx.strokeStyle = '#3c4850';
  ctx.lineWidth = 0.9;
  rr(ctx, -2.5, -18, 5, 24, 2); ctx.stroke();
  // 钻头卡座
  ctx.fillStyle = '#2a303a';
  rr(ctx, -4, 4, 8, 4, 1.5); ctx.fill();
  // 三刃钻头（随 spin 旋转）
  ctx.save();
  ctx.translate(0, 8);
  ctx.rotate(spin);
  ctx.fillStyle = working ? '#c4ccd8' : '#6a7280';
  for (let i = 0; i < 3; i++) {
    ctx.save();
    ctx.rotate(i * Math.PI * 2 / 3);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(-2.8, 0);
    ctx.lineTo(0, 7);
    ctx.lineTo(2.8, 0);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }
  // 钻头中轴
  ctx.fillStyle = working ? 'rgba(255,255,255,.5)' : 'rgba(255,255,255,.2)';
  ctx.beginPath(); ctx.arc(0, 0, 1.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  ctx.restore();

  // ===== ⑨ 产出滑槽（+x 边中央）+ 方向指示三角 ×2 =====
  ctx.fillStyle = '#1d2129';
  ctx.beginPath();
  ctx.moveTo(26, -4.5);
  ctx.lineTo(31, -2.5);
  ctx.lineTo(31, 2.5);
  ctx.lineTo(26, 4.5);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#0e1014';
  ctx.lineWidth = 0.9;
  ctx.stroke();

  ctx.restore();                      // 结束朝向坐标系

  // ===== ⑩ 采矿进度环（工作时绿色弧，与电采矿机/抽油机皮肤语义一致）=====
  const pct = working ? Math.min(1, (e.prog || 0) / e.oreTime()) : 0;
  if (pct > 0) {
    const rx = px + s / 2 + s * 0.09, ry = cy;    // 环心对准钻头（+x 侧偏移）
    ctx.strokeStyle = 'rgba(8,12,18,.35)';
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(rx, ry, 13 * k, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#8fe08f';
    ctx.lineWidth = 2.6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(rx, ry, 13 * k, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  // ===== ⑪ 燃料条（世界坐标顶部水平；与原版语义一致）=====
  const fuelPct = Math.min(1, (e.burnLeft || 0) / COAL_ENERGY);
  ctx.fillStyle = '#20242b';
  rr(ctx, px + 8, py + 16, s - 16, 4, 1.5); ctx.fill();
  ctx.fillStyle = fuelPct > 0 ? '#e8762c' : '#c33';
  rr(ctx, px + 8, py + 16, (s - 16) * fuelPct, 4, 1.5); ctx.fill();
  if (fuelPct > 0) {
    ctx.fillStyle = 'rgba(255,255,255,.3)';
    ctx.fillRect(px + 9, py + 16, (s - 16) * fuelPct - 2, 1);
  }

  // ===== ⑫ 状态 LED（右上角；绿=工作 / 橙=告警 / 暗=待机）=====
  const ledX = px + s - 8, ledY = py + 10;
  let ledC, ledOn = false;
  if (e.status) { ledC = '#ffb04a'; ledOn = true; }
  else if (working) { ledC = '#9ce06c'; ledOn = true; }
  else { ledC = '#5a3018'; ledOn = false; }
  if (ledOn) {
    const pulse = working ? (0.8 + 0.2 * Math.sin(spin * 1.6)) : 0.9;
    ctx.fillStyle = 'rgba(255,200,90,' + (0.18 * pulse).toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(ledX, ledY, 3.4, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = ledC;
  ctx.beginPath(); ctx.arc(ledX, ledY, 1.8, 0, Math.PI * 2); ctx.fill();
  if (ledOn) {
    ctx.fillStyle = 'rgba(255,255,255,.8)';
    ctx.beginPath(); ctx.arc(ledX - 0.4, ledY - 0.5, 0.6, 0, Math.PI * 2); ctx.fill();
  }

  // ===== ⑬ 方向指示三角 ×2（产出边上下；颜色沿用方向编码）=====
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(dir * Math.PI / 2);
  ctx.fillStyle = dirColorNotch(dir);
  for (const m of [-7, 7]) {
    ctx.save();
    ctx.translate(s / 2 - 6, m * k);
    tri(ctx, 0, -3 * k, 0, 3 * k, 6 * k, 0);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  ctx.globalAlpha = 1;
}

// ===== 注册：仅覆盖热能采矿机的渲染（电采矿机/抽油机不变）=====
DEVICE_RENDER['burner-mining-drill'] = drawBurnerDrillSkin;
