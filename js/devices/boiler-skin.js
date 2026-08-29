'use strict';

// ===== 锅炉：全新外观皮肤（纯渲染覆盖，不改任何数值/逻辑）=====
// 设计语言（现实「机车式火管锅炉」的俯视演绎：暗铜筒体 + 深钢基座 + 炉膛火光）：
//   ① 深钢底座 + 炉膛南条：拱形炉门居中，点火时门缝透火、燃烧时门底火舌 + 火床泛橙红光；
//   ② 横置铜筒（圆柱俯视：胶囊轮廓 + 两端缝弧 + 加强箍环 + 双排铆钉 + 顶部高光）；
//   ③ 顶置烟囱（左端，燃烧时口内火光微闪）与汽包安全阀（中央，黄铜阀帽）；
//      蒸汽憋满时安全阀喷汽示警——与"憋满熄火省煤"逻辑视觉呼应；
//   ④ 右下示水计（玻璃管水位 + 气泡上浮），直读内部水量；
//   ⑤ 燃烧时筒体叠温度热色（随 temp 升温渐暖）；
//   ⑥ 水口（左右端蓝、双向）与汽口（底中白、只出）完全沿用 drawPort 原绘制；
//      燃料条/水条/温度文字保持世界坐标水平绘制（与原版一致，任何朝向可读）。
// 本文件只覆盖 DEVICE_RENDER['boiler']：删除本文件并移除 index.html 中
// 对应一行 <script> 即可还原为原绘制，不影响存档/逻辑/面板。
function drawBoilerSkin(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const w = TILE * e.w, h = TILE * e.h;          // 实际包围盒（rotSwap 后 96×64 / 64×96）
  const k = ((dir % 2 === 0) ? w : h) / 96;      // 基准宽 96（基准占地 3×2）
  const simple = (typeof LOD !== 'undefined' && LOD && LOD.simple);
  ctx.globalAlpha = alpha;
  const lit = !!e.lit, burning = !!e.burning;
  const tp = Math.max(0, Math.min(1, (e.temp || 0) / BOILER_TEMP_MAX));
  const wPct = Math.max(0, Math.min(1, (e.water || 0) / WATER_CAP));

  // ===== 朝向坐标系（基准 96×64：北=上，左西右东，底中=出汽口）=====
  ctx.save();
  if (dir === 1) { ctx.translate(px + w, py); ctx.rotate(Math.PI / 2); }
  else if (dir === 2) { ctx.translate(px + w, py + h); ctx.rotate(Math.PI); }
  else if (dir === 3) { ctx.translate(px, py + h); ctx.rotate(-Math.PI / 2); }
  else { ctx.translate(px, py); }
  ctx.scale(k, k);

  // ---- 低 LOD（缩远）：底座 + 筒体 + 炉膛剪影 ----
  if (simple) {
    ctx.fillStyle = '#2b2f37';
    rr(ctx, 2, 2, 92, 60, 10); ctx.fill();
    ctx.fillStyle = '#8a5a3c';
    rr(ctx, 8, 6, 80, 32, 16); ctx.fill();
    ctx.fillStyle = '#3a2f28';
    rr(ctx, 5, 40, 86, 17, 5); ctx.fill();
    if (lit) {
      ctx.fillStyle = 'rgba(255,150,50,.8)';
      ctx.beginPath(); ctx.arc(48, 49, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    return;
  }

  // ===== ① 深钢底座 =====
  ctx.fillStyle = '#2b2f37';
  rr(ctx, 2, 2, 92, 60, 10); ctx.fill();
  ctx.strokeStyle = '#14171c';
  ctx.lineWidth = 3;
  rr(ctx, 2, 2, 92, 60, 10); ctx.stroke();

  // ===== ② 炉膛南条（炉体基座）=====
  ctx.fillStyle = '#3a2f28';
  rr(ctx, 5, 38, 86, 19, 5); ctx.fill();
  ctx.strokeStyle = '#221a14';
  ctx.lineWidth = 1.5;
  rr(ctx, 5, 38, 86, 19, 5); ctx.stroke();
  // 左右水口凸台（贴边，衔接世界坐标蓝口）
  ctx.fillStyle = '#5a6a72';
  rr(ctx, 5.5, 44.5, 5, 7, 2); ctx.fill();
  rr(ctx, 85.5, 44.5, 5, 7, 2); ctx.fill();
  ctx.strokeStyle = '#1c2428';
  ctx.lineWidth = 1;
  rr(ctx, 5.5, 44.5, 5, 7, 2); ctx.stroke();
  rr(ctx, 85.5, 44.5, 5, 7, 2); ctx.stroke();
  // 出汽凸台（底中，衔接世界坐标白口）
  ctx.fillStyle = '#5a6a72';
  rr(ctx, 43, 57, 10, 4, 2); ctx.fill();
  ctx.strokeStyle = '#1c2428';
  ctx.lineWidth = 1;
  rr(ctx, 43, 57, 10, 4, 2); ctx.stroke();

  // ===== ③ 横置铜筒（圆柱俯视）=====
  const bodyGrad = ctx.createLinearGradient(0, 5, 0, 42);
  bodyGrad.addColorStop(0, '#b07a4a');
  bodyGrad.addColorStop(0.55, '#8a5a34');
  bodyGrad.addColorStop(1, '#5f3a1e');
  ctx.fillStyle = bodyGrad;
  rr(ctx, 8, 5, 80, 37, 18.5); ctx.fill();
  ctx.strokeStyle = '#4a2c14';
  ctx.lineWidth = 2;
  rr(ctx, 8, 5, 80, 37, 18.5); ctx.stroke();
  // 顶部高光
  ctx.fillStyle = 'rgba(255,255,255,.16)';
  rr(ctx, 14, 8, 68, 8, 4); ctx.fill();
  // 两端缝弧（圆柱端面投影）
  ctx.strokeStyle = 'rgba(74,44,20,.55)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(24, 24, 4.5, 16, 0, -Math.PI / 2, Math.PI / 2); ctx.stroke();
  ctx.beginPath(); ctx.ellipse(72, 24, 4.5, 16, 0, Math.PI / 2, -Math.PI / 2); ctx.stroke();
  // 加强箍环 ×2（右缘带高光线）
  for (const gx2 of [40, 68]) {
    ctx.fillStyle = '#5a3418';
    rr(ctx, gx2 - 1.8, 7, 3.6, 33, 1.8); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.12)';
    rr(ctx, gx2 + 0.4, 8, 0.8, 31, 0.4); ctx.fill();
  }
  // 双排铆钉
  ctx.fillStyle = '#3a2210';
  for (const bx of [16, 28, 46, 58, 80]) {
    ctx.beginPath(); ctx.arc(bx, 8.5, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(bx, 38.5, 1.2, 0, Math.PI * 2); ctx.fill();
  }

  // ===== ④ 烟囱（左端顶部；燃烧时口内火光微闪）=====
  ctx.fillStyle = '#3a3f46';
  ctx.beginPath(); ctx.arc(26, 17, 4.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1c2026';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(26, 17, 4.5, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#101317';
  ctx.beginPath(); ctx.arc(26, 17, 2.4, 0, Math.PI * 2); ctx.fill();
  if (burning) {
    const chFl = 0.45 + 0.25 * Math.sin(G.time * 9 + px);
    ctx.fillStyle = 'rgba(255,140,50,' + chFl.toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(26, 17, 1.6, 0, Math.PI * 2); ctx.fill();
  }

  // ===== ⑤ 汽包 + 安全阀（中央；憋满时喷汽示警）=====
  ctx.fillStyle = '#9a6a3e';
  ctx.beginPath(); ctx.arc(54, 21, 7, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#5a3418';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(54, 21, 7, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.3)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(54, 21, 5.2, -Math.PI * 1.05, -Math.PI * 0.55); ctx.stroke();
  // 阀杆 + 黄铜阀帽
  ctx.fillStyle = '#d9a441';
  rr(ctx, 53, 12.5, 2, 3, 1); ctx.fill();
  ctx.beginPath(); ctx.arc(54, 11, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#8a6a14';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(54, 11, 2.2, 0, Math.PI * 2); ctx.stroke();
  // 蒸汽憋满：安全阀喷汽（白色小汽团上飘淡出）
  if (e.steamBuf >= WATER_CAP - 0.01) {
    for (let i = 0; i < 3; i++) {
      const t = ((G.time * 1.6) + i / 3) % 1;
      ctx.fillStyle = 'rgba(240,248,255,' + (0.55 * (1 - t)).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(54, 8 - t * 9, 2 + t * 2.6, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ===== ⑥ 拱形炉门（点火透火、燃烧火舌 + 火床泛光）=====
  ctx.fillStyle = '#1d1713';
  ctx.beginPath();
  ctx.moveTo(40, 57);
  ctx.lineTo(40, 51);
  ctx.arc(48, 51, 8, Math.PI, 0);
  ctx.lineTo(56, 57);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#0f0b08';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  if (lit) {
    const fl = 0.5 + 0.22 * Math.sin(G.time * 12 + px);
    ctx.fillStyle = 'rgba(255,150,50,' + (fl * 0.55).toFixed(2) + ')';
    ctx.beginPath();
    ctx.moveTo(42.5, 56);
    ctx.lineTo(42.5, 51);
    ctx.arc(48, 51, 5.5, Math.PI, 0);
    ctx.lineTo(53.5, 56);
    ctx.closePath(); ctx.fill();
  }
  if (burning) {
    // 炉门底缝两簇火舌（随机相位闪烁）
    const ft = 0.5 + 0.5 * Math.sin(G.time * 14 + px);
    ctx.fillStyle = 'rgba(255,200,70,' + (0.5 + 0.4 * ft).toFixed(2) + ')';
    tri(ctx, 43, 56.5, 46, 56.5, 44.5 - ft, 54.2); ctx.fill();
    tri(ctx, 50, 56.5, 53, 56.5, 51.5 + ft, 54.6); ctx.fill();
    // 火床泛光（炉膛南条整体）
    ctx.fillStyle = 'rgba(232,118,44,' + (0.12 + 0.05 * Math.sin(G.time * 9 + px)).toFixed(2) + ')';
    rr(ctx, 5, 38, 86, 19, 5); ctx.fill();
  }

  // ===== ⑦ 示水计（右下玻璃管：水位 + 气泡上浮）=====
  ctx.fillStyle = '#20242b';
  rr(ctx, 72, 41, 6, 16, 3); ctx.fill();
  ctx.strokeStyle = '#454b54';
  ctx.lineWidth = 1.2;
  rr(ctx, 72, 41, 6, 16, 3); ctx.stroke();
  if (wPct > 0) {
    ctx.fillStyle = 'rgba(63,160,232,.9)';
    rr(ctx, 73, 41 + 14 * (1 - wPct), 4, 14 * wPct, 2); ctx.fill();
    // 气泡上浮（有水时）
    const bt = (G.time * 0.7) % 1;
    const by = 55 - bt * 14 * wPct;
    ctx.fillStyle = 'rgba(220,240,255,.75)';
    ctx.beginPath(); ctx.arc(75, by, 1, 0, Math.PI * 2); ctx.fill();
  }

  // ===== ⑧ 温度热色（燃烧时筒体渐暖）=====
  if (burning && tp > 0) {
    ctx.fillStyle = 'rgba(255,120,40,' + (tp * 0.18).toFixed(2) + ')';
    rr(ctx, 8, 5, 80, 37, 18.5); ctx.fill();
  }

  ctx.restore();

  // ===== ⑨ 燃料条 / 水条（世界坐标水平绘制，与原版语义一致）=====
  const fuelPct = Math.min(1, e.burnLeft / COAL_ENERGY);
  ctx.fillStyle = '#20242b';
  rr(ctx, px + 10, py + h - 12, w - 20, 5, 2); ctx.fill();
  ctx.fillStyle = fuelPct > 0 ? '#e8762c' : '#c33';
  rr(ctx, px + 10, py + h - 12, (w - 20) * fuelPct, 5, 2); ctx.fill();
  ctx.fillStyle = '#20242b';
  rr(ctx, px + 10, py + h - 19, w - 20, 5, 2); ctx.fill();
  ctx.fillStyle = wPct > 0 ? '#3fa0e8' : '#b33';
  rr(ctx, px + 10, py + h - 19, (w - 20) * wPct, 5, 2); ctx.fill();

  // ===== ⑩ 温度文字（世界坐标右上角，与原版一致）=====
  ctx.font = 'bold 10px system-ui';
  ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = tp >= 1 ? '#7fe08f' : tp > 0 ? '#ffd23c' : '#8a93a0';
  ctx.fillText(Math.round(e.temp || 0) + '°C', px + w - 8, py + 14);

  // ===== ⑪ 水口（左右端蓝、双向）与汽口（底中白、只出）；绘制与原版完全一致 =====
  const pL = rotCell(e, 0, 1), pR = rotCell(e, e.def.w - 1, 1), pS = rotCell(e, e.def.w >> 1, e.def.h - 1);
  const _d = e.dir | 0;
  const cD = TILE / 2 - 1; // 端口凸缘贴合设备内部边缘
  drawPort(ctx, pL.x * TILE + TILE / 2, pL.y * TILE + TILE / 2, rotSide(2, _d), PORT_WATER, false, 0, cD, 'water', 'both');
  drawPort(ctx, pR.x * TILE + TILE / 2, pR.y * TILE + TILE / 2, rotSide(0, _d), PORT_WATER, false, 0, cD, 'water', 'both');
  drawPort(ctx, pS.x * TILE + TILE / 2, pS.y * TILE + TILE / 2, rotSide(1, _d), PORT_STEAM, true, 0, cD, 'steam', 'out');
  ctx.globalAlpha = 1;
}

// ===== 注册：仅覆盖锅炉的渲染 =====
DEVICE_RENDER['boiler'] = drawBoilerSkin;
