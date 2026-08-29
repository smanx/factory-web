'use strict';

// ===== 抽油机：全新外观皮肤（纯渲染覆盖，不改任何数值/逻辑）=====
// 设计语言（现实「梁式抽油机/磕头机」的俯视演绎：工业油绿基座 + 钢梁 + 黄铜轴 + 原油黑）：
//   ① 深青绿基座 + 台面 + 四角螺栓（延续抽油机身份色，与电采矿机工业黄、热采矿机棕拉开差异）；
//   ② 地面层：中央井口装置（套管环 + 井筒）+ 输油管（井口 → 产出角落法兰口，
//      工作时管芯有原油流动虚线，直观表达"正在出油"）；
//   ③ 机构层（自下而上）：枢轴塔座 → 偏置电机箱/曲柄盘（对置黄铜双销随 e.spin 旋转）
//      → 连杆 → 游梁；连杆两端分别接曲柄销与游梁尾端，投影随冲次伸缩摆动，机构感十足；
//   ④ 游梁绕枢轴随泵冲次往复摆动（正弦近似）：东端弧形驴头正悬在井口上方（绳槽弧面），
//      西端配重块；一个 e.spin 周期 = 一个完整冲次；
//   ⑤ 工作时井筒原油面随冲次脉动 + 油花涟漪交替扩散；
//   ⑥ 顶部电源指示灯（青=工作 / 红=缺电 / 黄=其他告警）；左下模块槽指示灯（槽位数读实体）；
//      底部青色电力条（工作时点亮）；外圈绿色抽取进度环（与原绘制语义一致）；
//   ⑦ 原油输出口完全沿用 drawPort 原绘制（产出方向角落一接口，off=1 对齐 frontTargets），
//      管道接法/悬停提示/ALT 图标不变。
// 本文件只覆盖 DEVICE_RENDER['pumpjack']：删除本文件并移除 index.html 中
// 对应一行 <script> 即可还原为原绘制，不影响存档/逻辑/面板。
function drawPumpjackSkin(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w;                 // 机身边长（抽油机 3×3 → 96px）
  const k = s / 96;                     // 以 96px 为基准的缩放系数（尺寸异常时仍成比例）
  const cx = px + s / 2, cy = py + s / 2;
  const working = !!e.working;
  const spin = e.spin || 0;
  const simple = (typeof LOD !== 'undefined' && LOD && LOD.simple);
  ctx.globalAlpha = alpha;

  // 游梁摆角：随泵冲次正弦往复（一个 spin 周期 = 一个冲次）
  const swing = 0.18 * Math.sin(spin);

  // ---- 低 LOD（缩远）：只留基座 + 井口 + 摆臂剪影，省掉细节 ----
  if (simple) {
    ctx.fillStyle = '#2f5a56';
    rr(ctx, px + 3 * k, py + 3 * k, s - 6 * k, s - 6 * k, 8 * k); ctx.fill();
    ctx.fillStyle = '#3d726d';
    rr(ctx, px + 7 * k, py + 7 * k, s - 14 * k, s - 14 * k, 6 * k); ctx.fill();
    ctx.fillStyle = '#14202a';
    ctx.beginPath(); ctx.arc(px + 22 * k, py + s / 2, 8 * k, 0, Math.PI * 2); ctx.fill();
    ctx.save();
    ctx.translate(px + s / 2, py + s / 2);
    ctx.rotate(dir * Math.PI / 2);
    ctx.rotate(swing);
    ctx.strokeStyle = '#9db4ae';
    ctx.lineWidth = 5 * k;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-40 * k, 0); ctx.lineTo(38 * k, 0); ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.restore();
    ctx.globalAlpha = 1;
    return;
  }

  // ===== 朝向坐标系（+x = 产出方向；井口、机构、输油管随 dir 一起旋转）=====
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(dir * Math.PI / 2);

  // ===== ① 基座 + 台面 =====
  ctx.fillStyle = '#2f5a56';
  rr(ctx, -45 * k, -45 * k, 90 * k, 90 * k, 16 * k); ctx.fill();
  ctx.strokeStyle = '#16302d';
  ctx.lineWidth = 3 * k;
  rr(ctx, -45 * k, -45 * k, 90 * k, 90 * k, 16 * k); ctx.stroke();
  // 台面（略浅一档，与基座形成层次）
  ctx.fillStyle = '#3d726d';
  rr(ctx, -39 * k, -39 * k, 78 * k, 78 * k, 11 * k); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.18)';
  ctx.lineWidth = 1.5 * k;
  rr(ctx, -39 * k, -39 * k, 78 * k, 78 * k, 11 * k); ctx.stroke();
  // 台面顶部光泽
  ctx.fillStyle = 'rgba(255,255,255,.06)';
  rr(ctx, -36 * k, -36 * k, 72 * k, 18 * k, 8 * k); ctx.fill();
  // 四角螺栓（深色帽 + 白点高光）
  ctx.fillStyle = '#1d3f3b';
  for (const [bx, by] of [[-38, -38], [38, -38], [-38, 38], [38, 38]]) {
    ctx.beginPath(); ctx.arc(bx * k, by * k, 2.3 * k, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(255,255,255,.4)';
  for (const [bx, by] of [[-38.7, -38.7], [38.7, -38.7], [-38.7, 38.7], [38.7, 38.7]]) {
    ctx.beginPath(); ctx.arc(bx * k, by * k, 0.7 * k, 0, Math.PI * 2); ctx.fill();
  }

  // ===== ② 输油管（地面层：井口南缘 → 南 → 东，接产出角落法兰口）=====
  const pipePath = () => {
    ctx.beginPath();
    ctx.moveTo(22 * k, 13 * k);
    ctx.lineTo(22 * k, 32 * k);
    ctx.lineTo(38 * k, 32 * k);
  };
  ctx.save();
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  pipePath();
  ctx.strokeStyle = '#223034';       // 管外皮（深描边）
  ctx.lineWidth = 6 * k;
  ctx.stroke();
  pipePath();
  ctx.strokeStyle = '#5b6a72';       // 管芯（亮面）
  ctx.lineWidth = 3.4 * k;
  ctx.stroke();
  if (working) {                       // 工作时：原油沿管芯向端口流动（虚线滚动）
    pipePath();
    ctx.strokeStyle = '#6a5a2a';
    ctx.lineWidth = 1.6 * k;
    ctx.setLineDash([4 * k, 5 * k]);
    ctx.lineDashOffset = -((G.time * 14) % 9) * k;
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.restore();
  // 法兰接头（井口根部 + 折点）
  ctx.fillStyle = '#2a333a';
  for (const [fx, fy] of [[22, 13], [22, 32]]) {
    ctx.beginPath(); ctx.arc(fx * k, fy * k, 3 * k, 0, Math.PI * 2); ctx.fill();
  }

  // ===== ③ 井口装置（地面层：套管环 + 螺栓 + 井筒）=====
  ctx.fillStyle = '#6a7a80';
  ctx.beginPath(); ctx.arc(22 * k, 0, 13 * k, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#2a3236';
  ctx.lineWidth = 2 * k;
  ctx.beginPath(); ctx.arc(22 * k, 0, 13 * k, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#3a444a';
  for (let i = 0; i < 4; i++) {       // 套管环上 4 颗螺栓
    const a = i * Math.PI / 2 + Math.PI / 4;
    ctx.beginPath();
    ctx.arc(22 * k + Math.cos(a) * 10.5 * k, Math.sin(a) * 10.5 * k, 1.5 * k, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#14202a';          // 井筒（黑井）
  ctx.beginPath(); ctx.arc(22 * k, 0, 8 * k, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#0c141a';
  ctx.lineWidth = 1.2 * k;
  ctx.beginPath(); ctx.arc(22 * k, 0, 8 * k, 0, Math.PI * 2); ctx.stroke();

  // ===== ④ 枢轴塔座（游梁支柱的俯视投影）=====
  ctx.fillStyle = '#234540';
  ctx.beginPath(); ctx.arc(-10 * k, 0, 10 * k, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#122824';
  ctx.lineWidth = 2 * k;
  ctx.beginPath(); ctx.arc(-10 * k, 0, 10 * k, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#1a3833';          // 塔座铆钉 ×4
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2 + Math.PI / 4;
    ctx.beginPath();
    ctx.arc(-10 * k + Math.cos(a) * 6.5 * k, Math.sin(a) * 6.5 * k, 1.3 * k, 0, Math.PI * 2);
    ctx.fill();
  }

  // ===== ⑤ 电机箱 + 曲柄盘（偏置于游梁南侧，全动画可见）=====
  // 电机/减速箱
  ctx.fillStyle = '#46525c';
  rr(ctx, -38 * k, 10 * k, 12 * k, 10 * k, 2.5 * k); ctx.fill();
  ctx.strokeStyle = '#1c2428';
  ctx.lineWidth = 1.3 * k;
  rr(ctx, -38 * k, 10 * k, 12 * k, 10 * k, 2.5 * k); ctx.stroke();
  ctx.fillStyle = '#2c363c';          // 通风纹 ×2
  for (const ly of [13, 16.4]) {
    rr(ctx, -36 * k, ly * k, 8 * k, 1.6 * k, 0.8 * k); ctx.fill();
  }
  if (working) {                       // 电机工作指示灯（呼吸闪烁）
    const blink = 0.5 + 0.5 * Math.sin(G.time * 6);
    ctx.fillStyle = 'rgba(255,210,60,' + (0.4 + 0.5 * blink).toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(-28 * k, 15 * k, 1.8 * k, 0, Math.PI * 2); ctx.fill();
  }
  // 曲柄盘（随 spin 旋转的辐条 + 对置黄铜双销）
  ctx.fillStyle = '#5a6a72';
  ctx.beginPath(); ctx.arc(-18 * k, 15 * k, 9 * k, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#232c32';
  ctx.lineWidth = 2 * k;
  ctx.beginPath(); ctx.arc(-18 * k, 15 * k, 9 * k, 0, Math.PI * 2); ctx.stroke();
  ctx.save();
  ctx.translate(-18 * k, 15 * k);
  ctx.rotate(spin);                    // 盘面辐条（对置两根，一眼看出在转）
  ctx.strokeStyle = '#3a464e';
  ctx.lineWidth = 2 * k;
  for (let i = 0; i < 2; i++) {
    ctx.save();
    ctx.rotate(i * Math.PI);
    ctx.beginPath(); ctx.moveTo(2.5 * k, 0); ctx.lineTo(8 * k, 0); ctx.stroke();
    ctx.restore();
  }
  ctx.restore();
  ctx.fillStyle = '#333d44';          // 盘心螺帽
  ctx.beginPath(); ctx.arc(-18 * k, 15 * k, 2.5 * k, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#ffd23c';          // 对置黄铜曲柄销（连杆接前销）
  for (const sg of [1, -1]) {
    ctx.beginPath();
    ctx.arc((-18 + sg * 6 * Math.cos(spin)) * k, (15 + sg * 6 * Math.sin(spin)) * k, 2.4 * k, 0, Math.PI * 2);
    ctx.fill();
  }

  // ===== ⑥ 连杆（曲柄销 → 游梁尾端；两端投影随冲次伸缩）=====
  const pinX = (-18 + 6 * Math.cos(spin)) * k;              // 前曲柄销
  const pinY = (15 + 6 * Math.sin(spin)) * k;
  const tailX = (-10 - 30 * Math.cos(swing)) * k;          // 游梁尾端锚点（梁坐标 -30,0）
  const tailY = (-30 * Math.sin(swing)) * k;
  ctx.strokeStyle = '#7a8a92';
  ctx.lineWidth = 3.5 * k;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(pinX, pinY);
  ctx.lineTo(tailX, tailY);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.fillStyle = '#333d44';          // 连杆两端销轴
  for (const [qx, qy] of [[pinX, pinY], [tailX, tailY]]) {
    ctx.beginPath(); ctx.arc(qx, qy, 2.1 * k, 0, Math.PI * 2); ctx.fill();
  }

  // ===== ⑦ 游梁组（绕枢轴摆动：主梁 → 配重 → 驴头 → 黄铜轴帽）=====
  ctx.save();
  ctx.translate(-10 * k, 0);           // 移到枢轴
  ctx.rotate(swing);                  // 随冲次摆动
  // 主梁（钢质纵向渐变）
  const beamGrad = ctx.createLinearGradient(0, -3.5 * k, 0, 3.5 * k);
  beamGrad.addColorStop(0, '#c2cdd6');
  beamGrad.addColorStop(1, '#8494a0');
  ctx.fillStyle = beamGrad;
  rr(ctx, -20 * k, -3.5 * k, 66 * k, 7 * k, 3 * k); ctx.fill();
  ctx.strokeStyle = '#3c4850';
  ctx.lineWidth = 1.2 * k;
  rr(ctx, -20 * k, -3.5 * k, 66 * k, 7 * k, 3 * k); ctx.stroke();
  // 尾端配重块（深钢 + 双纹）
  ctx.fillStyle = '#51666d';
  rr(ctx, -32 * k, -7 * k, 12 * k, 14 * k, 2 * k); ctx.fill();
  ctx.strokeStyle = '#26343a';
  ctx.lineWidth = 1.3 * k;
  rr(ctx, -32 * k, -7 * k, 12 * k, 14 * k, 2 * k); ctx.stroke();
  ctx.fillStyle = '#3a4a50';
  for (const gx2 of [-29.5, -24.5]) {
    rr(ctx, gx2 * k, -6.2 * k, 1.2 * k, 12.4 * k, 0.6 * k); ctx.fill();
  }
  // 驴头（弧形板，正对井口；外缘绳槽 ×2）
  ctx.beginPath();
  ctx.arc(32 * k, 0, 16 * k, -1.08, 1.08);
  ctx.arc(32 * k, 0, 7.5 * k, 1.08, -1.08, true);
  ctx.closePath();
  ctx.fillStyle = '#86a09a';
  ctx.fill();
  ctx.strokeStyle = '#2f4a46';
  ctx.lineWidth = 1.4 * k;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(31,58,54,.55)';   // 绳槽弧
  ctx.lineWidth = 1 * k;
  for (const r of [12.6, 10.4]) {
    ctx.beginPath();
    ctx.arc(32 * k, 0, r * k, -0.95, 0.95);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(255,255,255,.28)'; // 外缘上段高光
  ctx.lineWidth = 1.2 * k;
  ctx.beginPath();
  ctx.arc(32 * k, 0, 15 * k, -1.0, -0.45);
  ctx.stroke();
  // 黄铜枢轴轴帽（主轴穿梁处，最顶层）
  ctx.fillStyle = '#ffd23c';
  ctx.beginPath(); ctx.arc(0, 0, 4.5 * k, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#8a6a14';
  ctx.lineWidth = 1.5 * k;
  ctx.beginPath(); ctx.arc(0, 0, 4.5 * k, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#8a6a14';
  ctx.beginPath(); ctx.arc(0, 0, 1.5 * k, 0, Math.PI * 2); ctx.fill();
  ctx.restore();

  // ===== ⑧ 井口油光（顶层动画：原油面脉动 + 涟漪扩散）=====
  const oilR = (5.6 + (working ? 0.6 * Math.sin(spin) : 0)) * k;
  ctx.fillStyle = '#241c12';
  ctx.beginPath(); ctx.arc(22 * k, 0, oilR, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(201,168,74,.4)';  // 油面北缘高光
  ctx.lineWidth = 1.2 * k;
  ctx.beginPath(); ctx.arc(22 * k, 0, oilR - 1.3 * k, -2.4, -0.8);
  ctx.stroke();
  if (working) {                       // 两圈交替扩散的油花涟漪
    for (let i = 0; i < 2; i++) {
      const ph = ((spin / (Math.PI * 2)) + i * 0.5) % 1;
      ctx.strokeStyle = 'rgba(201,168,74,' + (0.5 * (1 - ph)).toFixed(3) + ')';
      ctx.lineWidth = 1.4 * k;
      ctx.beginPath(); ctx.arc(22 * k, 0, (2.5 + 5 * ph) * k, 0, Math.PI * 2); ctx.stroke();
    }
  }

  ctx.restore();                      // 结束朝向坐标系

  // ===== ⑨ 抽取进度环（工作时绿色弧，与原绘制语义一致）=====
  const pct = working ? Math.min(1, (e.prog || 0) / e.oreTime()) : 0;
  if (pct > 0) {
    ctx.strokeStyle = 'rgba(8,12,18,.35)';
    ctx.lineWidth = 2.5 * k;
    ctx.beginPath(); ctx.arc(cx, cy, 27 * k, 0, Math.PI * 2); ctx.stroke();
    ctx.strokeStyle = '#8fe08f';
    ctx.lineWidth = 3 * k;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, 27 * k, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  // ===== ⑩ 顶部中央电源指示灯（青=工作 / 红=缺电 / 黄=告警 / 灰=待机）=====
  let ledCore = '#3a414d', ledHalo = null;
  if (working) { ledCore = '#7ff0ff'; ledHalo = 'rgba(95,230,255,'; }
  else if (e.status === '缺电') { ledCore = '#ff5b4a'; ledHalo = 'rgba(255,91,74,'; }
  else if (e.status) { ledCore = '#ffb43a'; ledHalo = 'rgba(255,180,58,'; }
  const ledX = cx, ledY = py + 12.5 * k;
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

  // ===== ⑪ 左下模块槽指示灯（槽位数读实体，已装模块数点亮）=====
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

  // ===== ⑫ 底部电力条（工作时青色点亮，与原电耗条语义一致）=====
  ctx.fillStyle = 'rgba(10,14,18,.55)';
  rr(ctx, px + 10 * k, py + s - 12 * k, s - 20 * k, 5 * k, 2 * k); ctx.fill();
  if (working) {
    ctx.fillStyle = 'rgba(143,224,255,.85)';
    rr(ctx, px + 10 * k, py + s - 12 * k, s - 20 * k, 5 * k, 2 * k); ctx.fill();
  }

  // ===== ⑬ 原油输出口（产出方向角落一接口；绘制与原 drawDrill 完全一致）=====
  drawPort(ctx, px + s / 2, py + s / 2, dir, PORT_OUTPUT, false, 1, s / 2, 'crude-oil', 'out');

  ctx.globalAlpha = 1;
}

// ===== 注册：仅覆盖抽油机的渲染（热能/电采矿机不变）=====
DEVICE_RENDER['pumpjack'] = drawPumpjackSkin;
