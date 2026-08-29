'use strict';

// ===== 离心机：全新外观皮肤（纯渲染覆盖，不改任何数值/逻辑）=====
// 设计语言（现实「实验室转子离心机」的俯视演绎：深钢安全腔 + 黄铜主轴 + 铀料杯阵列）：
//   ① 深钢底座 + 四角螺栓 + 安全腔（环形腔壁 + 径向渐变腔底 + 腔沿高光弧 + 腔沿螺栓 ×8）；
//   ② 转子（随主轴 e.spin 高速旋转，运转时整组轻微振动）：黄铜轮毂 → 6 根辐条臂
//      → 6 只铀料杯（杯座 + 铀芯），运转时铀芯绿辉脉动——铀浓缩过程一览无余；
//   ③ 腔底蚀刻处理进度环（绿色弧，在转子下方，像仪表刻度；与其它机器皮肤进度语义一致）；
//   ④ ALT 模式中央显示当前配方大图标（与原绘制语义完全一致）；
//   ⑤ 腔顶嵌入状态灯（青=运转 / 黄=待料或暂停 / 暗=未选配方）；
//   ⑥ 辐射警示三叶标（右上角，黄底黑叶）+ 左下 2 格模块槽指示灯。
// 本文件只覆盖 DEVICE_RENDER['centrifuge']：删除本文件并移除 index.html 中
// 对应一行 <script> 即可还原为原绘制，不影响存档/逻辑/面板。
function drawCentrifugeSkin(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w;                 // 机身边长（离心机 3×3 → 96px）
  const k = s / 96;                     // 以 96px 为基准的缩放系数（尺寸异常时仍成比例）
  const cx = px + s / 2, cy = py + s / 2;
  const crafting = !!e.crafting;
  const spin = e.spin || 0;
  const simple = (typeof LOD !== 'undefined' && LOD && LOD.simple);
  ctx.globalAlpha = alpha;

  // ---- 低 LOD（缩远）：底座 + 腔体 + 转子剪影 ----
  if (simple) {
    ctx.fillStyle = '#262d38';
    rr(ctx, px + 2 * k, py + 2 * k, s - 4 * k, s - 4 * k, 9 * k); ctx.fill();
    ctx.fillStyle = '#1c242e';
    ctx.beginPath(); ctx.arc(cx, cy, 36 * k, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(spin);
    ctx.strokeStyle = crafting ? '#9fe8b0' : '#5a6a78';
    ctx.lineWidth = 4 * k;
    for (let i = 0; i < 3; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI * 2 / 3);
      ctx.beginPath(); ctx.moveTo(6 * k, 0); ctx.lineTo(24 * k, 0); ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    return;
  }

  // ===== ① 深钢底座 =====
  ctx.fillStyle = '#262d38';
  rr(ctx, px + 2 * k, py + 2 * k, s - 4 * k, s - 4 * k, 9 * k); ctx.fill();
  ctx.strokeStyle = '#10151c';
  ctx.lineWidth = 2.5 * k;
  rr(ctx, px + 2 * k, py + 2 * k, s - 4 * k, s - 4 * k, 9 * k); ctx.stroke();
  // 四角螺栓
  ctx.fillStyle = '#1a2028';
  for (const [bx, by] of [[8, 8], [88, 8], [8, 88], [88, 88]]) {
    ctx.beginPath(); ctx.arc(px + bx * k, py + by * k, 2.2 * k, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,.32)';
  for (const [bx, by] of [[7.4, 7.4], [88.6, 7.4], [7.4, 88.6], [88.6, 88.6]]) {
    ctx.beginPath(); ctx.arc(px + bx * k, py + by * k, 0.7 * k, 0, Math.PI * 2); ctx.fill();
  }

  // ===== ② 安全腔（containment bowl）=====
  // 腔底（径向渐变，中心受光）
  const bowlGrad = ctx.createRadialGradient(cx - 10 * k, cy - 10 * k, 4 * k, cx, cy, 38 * k);
  bowlGrad.addColorStop(0, '#333f4e');
  bowlGrad.addColorStop(0.7, '#28323e');
  bowlGrad.addColorStop(1, '#1c242e');
  ctx.fillStyle = bowlGrad;
  ctx.beginPath(); ctx.arc(cx, cy, 38 * k, 0, Math.PI * 2); ctx.fill();
  // 腔壁环（36.5~40）
  ctx.fillStyle = '#39434f';
  ctx.beginPath();
  ctx.arc(cx, cy, 40 * k, 0, Math.PI * 2);
  ctx.arc(cx, cy, 36.5 * k, 0, Math.PI * 2, true);
  ctx.fill();
  ctx.strokeStyle = '#10151c';
  ctx.lineWidth = 1.8 * k;
  ctx.beginPath(); ctx.arc(cx, cy, 40 * k, 0, Math.PI * 2); ctx.stroke();
  // 腔沿高光弧
  ctx.strokeStyle = 'rgba(200,214,226,.25)';
  ctx.lineWidth = 1.5 * k;
  ctx.beginPath(); ctx.arc(cx, cy, 38.2 * k, -Math.PI * 1.05, -Math.PI * 0.55); ctx.stroke();
  // 腔沿螺栓 ×8（错开正四向，给顶灯让位）
  ctx.fillStyle = '#1a2028';
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4 + Math.PI / 8;
    ctx.beginPath();
    ctx.arc(cx + Math.cos(a) * 38.2 * k, cy + Math.sin(a) * 38.2 * k, 1.1 * k, 0, Math.PI * 2);
    ctx.fill();
  }

  // ===== ③ 腔底蚀刻处理进度环（绿色弧，转子之下；像刻度仪表）=====
  const rec = (typeof e.recipeObj === 'function') ? e.recipeObj() : null;
  const pct = (crafting && rec) ? Math.min(1, (e.prog || 0) / rec.time) : 0;
  if (pct > 0) {
    ctx.strokeStyle = 'rgba(8,12,18,.4)';
    ctx.lineWidth = 2.6 * k;
    ctx.beginPath(); ctx.arc(cx, cy, 34.5 * k, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = 'rgba(143,224,143,.95)';
    ctx.lineWidth = 2.6 * k;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, 34.5 * k, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  // ===== ④ 转子（随主轴高速旋转，运转时轻微振动）=====
  const vib = crafting ? 0.8 : 0;
  ctx.save();
  ctx.translate(cx + Math.sin(spin * 3.1) * vib * k, cy + Math.cos(spin * 2.7) * vib * k);
  ctx.rotate(spin);
  // 辐条臂 ×6
  ctx.fillStyle = '#4a5666';
  for (let i = 0; i < 6; i++) {
    ctx.save();
    ctx.rotate(i * Math.PI / 3);
    rr(ctx, 8 * k, -2.6 * k, 22 * k, 5.2 * k, 2.6 * k); ctx.fill();
    ctx.restore();
  }
  // 铀料杯 ×6（杯座 + 铀芯；运转时绿辉脉动）
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    const bx = Math.cos(a) * 31 * k, by = Math.sin(a) * 31 * k;
    ctx.fillStyle = '#333d49';
    ctx.beginPath(); ctx.arc(bx, by, 5.6 * k, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#141920';
    ctx.lineWidth = 1.2 * k;
    ctx.beginPath(); ctx.arc(bx, by, 5.6 * k, 0, Math.PI * 2); ctx.stroke();
    if (crafting) {
      const glow = 0.55 + 0.35 * Math.sin(spin * 2 + i * 1.3);
      ctx.fillStyle = 'rgba(122,232,140,' + (0.28 * glow + 0.15).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(bx, by, 4.4 * k, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = crafting ? '#7fe894' : '#5a6a78';
    ctx.beginPath(); ctx.arc(bx, by, 2.6 * k, 0, Math.PI * 2); ctx.fill();
  }
  // 黄铜轮毂 + 中心螺帽
  ctx.fillStyle = '#d9a441';
  ctx.beginPath(); ctx.arc(0, 0, 8.5 * k, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#8a6a14';
  ctx.lineWidth = 1.6 * k;
  ctx.beginPath(); ctx.arc(0, 0, 8.5 * k, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#8a6a14';
  ctx.beginPath(); ctx.arc(0, 0, 2.8 * k, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // ===== ⑤ ALT：中央配方图标（与原绘制语义完全一致）=====
  if (portDetailsVisible() && e.recipe && e.recipeObj) {
    const r2 = e.recipeObj();
    if (r2) {
      const outId = r2.prob ? Object.keys(r2.prob).sort((a, b) => r2.prob[b] - r2.prob[a])[0] : Object.keys(r2.out)[0];
      if (outId) drawRecipeIconCell(ctx, cx, cy, outId);
    }
  }

  // ===== ⑥ 腔顶状态灯（嵌入腔沿：青=运转 / 黄=待料或暂停 / 暗=未选配方）=====
  let lampC = '#3a414d', lampHalo = null;
  if (crafting) { lampC = '#7ff0ff'; lampHalo = 'rgba(95,230,255,'; }
  else if (e.recipe) { lampC = '#ffb43a'; lampHalo = 'rgba(255,180,58,'; }
  const lampX = cx, lampY = cy - 38 * k;
  if (lampHalo) {
    const pulse = crafting ? (0.85 + 0.15 * Math.sin(spin * 1.6)) : 0.9;
    ctx.fillStyle = lampHalo + (0.25 * pulse).toFixed(3) + ')';
    ctx.beginPath(); ctx.arc(lampX, lampY, 4.6 * k, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = lampC;
  ctx.beginPath(); ctx.arc(lampX, lampY, 2.4 * k, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(10,12,16,.7)';
  ctx.lineWidth = 1 * k;
  ctx.beginPath(); ctx.arc(lampX, lampY, 2.4 * k, 0, Math.PI * 2); ctx.stroke();

  // ===== ⑦ 辐射警示三叶标（右上角：黄底圆 + 黑色三叶 + 中心点）=====
  const tx0 = px + 78 * k, ty0 = py + 18 * k;
  ctx.fillStyle = '#ffd23c';
  ctx.beginPath(); ctx.arc(tx0, ty0, 5.5 * k, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#14171c';
  ctx.lineWidth = 0.8 * k;
  ctx.stroke();
  ctx.fillStyle = '#14171c';
  for (let i = 0; i < 3; i++) {
    const a0 = -Math.PI / 2 + i * Math.PI * 2 / 3 - 0.55;
    const a1 = a0 + 1.1;
    ctx.beginPath();
    ctx.arc(tx0, ty0, 4.3 * k, a0, a1);
    ctx.arc(tx0, ty0, 1.7 * k, a1, a0, true);
    ctx.closePath(); ctx.fill();
  }
  ctx.beginPath(); ctx.arc(tx0, ty0, 0.9 * k, 0, Math.PI * 2); ctx.fill();

  // ===== ⑧ 左下模块槽指示灯（2 槽，已装模块数点亮）=====
  let modN = 0;
  if (e.modules) { for (const mk in e.modules) modN += e.modules[mk] || 0; }
  const slots = (typeof e.moduleSlotCount === 'function') ? e.moduleSlotCount() : 2;
  for (let i = 0; i < slots; i++) {
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

  ctx.globalAlpha = 1;
}

// ===== 注册：仅覆盖离心机的渲染 =====
DEVICE_RENDER['centrifuge'] = drawCentrifugeSkin;
