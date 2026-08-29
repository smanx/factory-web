'use strict';

// ===== 蒸汽机：全新外观皮肤（纯渲染覆盖，不改任何数值/逻辑）=====
// 设计语言（现实「往复式蒸汽机」的俯视演绎：蓝钢机身 + 铜汽缸 + 飞轮连杆全联动）：
//   ① 深钢底座 + 导轨基座：北端铜汽缸（缸盖螺栓 + 顶部高光）→ 活塞杆 → 十字头导轨
//      → 连杆 → 大飞轮（辐条随主轴 e.spin 旋转）→ 南端输出轴；
//   ② 全机构联动：飞轮转角驱动曲柄销，连杆按真实曲柄连杆几何推动十字头沿导轨
//      往复滑动、活塞杆随冲程伸缩——一个 e.spin 周期 = 一个完整冲程；
//   ③ 汽缸东侧滑阀室 + 功率小表盘（指针随 outMult 摆动）、西侧汽压表（针随存汽量）、
//      西侧励磁机盒（发电输出，工作指示灯呼吸）；
//   ④ 北端进汽脉冲 / 南端排汽小雾（工作时）；
//   ⑤ 两端通用汽口完全沿用 drawPort 原绘制（任意一端进出蒸汽，随 dir 旋转）；
//      输出功率铭牌按朝向贴在北端汽缸正面（竖直）或长边顶部导轨（水平），
//      世界坐标水平绘制，任何朝向可读且不被两端汽口法兰遮挡。
// 本文件只覆盖 DEVICE_RENDER['steam-engine']：删除本文件并移除 index.html 中
// 对应一行 <script> 即可还原为原绘制，不影响存档/逻辑/面板。
function drawSteamEngineSkin(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const w = TILE * e.w, h = TILE * e.h;          // 实际包围盒（rotSwap 后 96×160 / 160×96）
  const k = ((dir % 2 === 0) ? w : h) / 96;       // 基准宽 96（基准占地 3×5）
  const simple = (typeof LOD !== 'undefined' && LOD && LOD.simple);
  const om = Math.max(0, Math.min(1, e.outMult || 0));
  const on = !!e.on;
  const spin = e.spin || 0;
  ctx.globalAlpha = alpha;

  // ===== 机构几何（基准 96×160：北=上进汽端，南=输出端）=====
  const FLY_X = 48, FLY_Y = 122, FLY_R = 22;     // 飞轮中心/半径
  const CR = 9, ROD = 30;                        // 曲柄半径 / 连杆长度
  const pinX = FLY_X + CR * Math.sin(spin);       // 曲柄销（黄铜）
  const pinY = FLY_Y + CR * Math.cos(spin);
  // 十字头中心：连杆两端分别接十字头(48, chY)与曲柄销，杆长恒定 ROD
  const chY = pinY - Math.sqrt(ROD * ROD - (CR * Math.sin(spin)) * (CR * Math.sin(spin)));

  // ===== 朝向坐标系 =====
  ctx.save();
  if (dir === 1) { ctx.translate(px + w, py); ctx.rotate(Math.PI / 2); }
  else if (dir === 2) { ctx.translate(px + w, py + h); ctx.rotate(Math.PI); }
  else if (dir === 3) { ctx.translate(px, py + h); ctx.rotate(-Math.PI / 2); }
  else { ctx.translate(px, py); }
  ctx.scale(k, k);

  // ---- 低 LOD（缩远）：底座 + 汽缸 + 飞轮 + 连接杆剪影 ----
  if (simple) {
    ctx.fillStyle = '#2b2f37';
    rr(ctx, 3, 3, 90, 154, 8); ctx.fill();
    ctx.fillStyle = '#8a5a3c';
    rr(ctx, 20, 12, 56, 46, 8); ctx.fill();
    ctx.strokeStyle = '#9db4ae';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(48, 58); ctx.lineTo(48, FLY_Y); ctx.stroke();
    ctx.fillStyle = '#54626e';
    ctx.beginPath(); ctx.arc(FLY_X, FLY_Y, 20, 0, Math.PI * 2); ctx.fill();
    if (on) {
      ctx.fillStyle = 'rgba(143,224,255,.8)';
      ctx.beginPath(); ctx.arc(FLY_X, FLY_Y, 4, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    return;
  }

  // ===== ① 深钢底座 =====
  ctx.fillStyle = '#2b2f37';
  rr(ctx, 2, 2, 92, 156, 10); ctx.fill();
  ctx.strokeStyle = '#14171c';
  ctx.lineWidth = 3;
  rr(ctx, 2, 2, 92, 156, 10); ctx.stroke();

  // ===== ② 导轨基座（机身龙骨）+ 汽缸垫台 =====
  ctx.fillStyle = '#2e343e';
  rr(ctx, 24, 8, 48, 146, 6); ctx.fill();
  ctx.strokeStyle = '#171b22';
  ctx.lineWidth = 1.5;
  rr(ctx, 24, 8, 48, 146, 6); ctx.stroke();
  ctx.fillStyle = '#333944';
  rr(ctx, 17, 8, 62, 54, 6); ctx.fill();

  // ===== ③ 铜汽缸（北端）=====
  const cylGrad = ctx.createLinearGradient(0, 12, 0, 58);
  cylGrad.addColorStop(0, '#a8734a');
  cylGrad.addColorStop(0.55, '#8a5a34');
  cylGrad.addColorStop(1, '#6b4224');
  ctx.fillStyle = cylGrad;
  rr(ctx, 20, 12, 56, 46, 8); ctx.fill();
  ctx.strokeStyle = '#4a2c14';
  ctx.lineWidth = 2;
  rr(ctx, 20, 12, 56, 46, 8); ctx.stroke();
  // 顶部高光
  ctx.fillStyle = 'rgba(255,255,255,.15)';
  rr(ctx, 25, 15, 46, 9, 4.5); ctx.fill();
  // 进汽颈（北端中央，衔接北汽口）
  ctx.fillStyle = '#7a5230';
  rr(ctx, 41, 13, 14, 6, 3); ctx.fill();
  ctx.strokeStyle = '#4a2c14';
  ctx.lineWidth = 1.2;
  rr(ctx, 41, 13, 14, 6, 3); ctx.stroke();
  // 缸盖缝 + 螺栓
  ctx.strokeStyle = 'rgba(74,44,20,.6)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(20, 54); ctx.lineTo(76, 54); ctx.stroke();
  ctx.fillStyle = '#3a2210';
  for (const bx of [24, 36, 48, 60, 72]) {
    ctx.beginPath(); ctx.arc(bx, 54, 1.3, 0, Math.PI * 2); ctx.fill();
  }

  // ===== ④ 滑阀室（汽缸东侧小铜柱）=====
  ctx.fillStyle = '#8a5a34';
  ctx.beginPath(); ctx.arc(80, 32, 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#4a2c14';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(80, 32, 6.5, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.25)';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(80, 32, 4.6, -Math.PI * 1.05, -Math.PI * 0.55); ctx.stroke();
  // 阀杆连到汽缸
  ctx.strokeStyle = '#4a2c14';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(74, 32); ctx.lineTo(76, 32); ctx.stroke();

  // ===== ⑤ 汽压表（西侧；针随存汽量）=====
  ctx.fillStyle = '#1a1e26';
  ctx.beginPath(); ctx.arc(13, 32, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#454b54';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(13, 32, 5.5, 0, Math.PI * 2); ctx.stroke();
  const pRatio = Math.max(0, Math.min(1, (e.steamBuf || 0) / ENGINE_STEAM_CAP));
  const pAng = -Math.PI / 2 + pRatio * Math.PI;
  ctx.strokeStyle = pRatio > 0.15 ? '#e8e4d8' : '#5a6470';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(13, 32);
  ctx.lineTo(13 + Math.cos(pAng) * 4, 32 + Math.sin(pAng) * 4);
  ctx.stroke();

  // ===== ⑥ 十字头导轨（双侧）=====
  ctx.fillStyle = '#2a303a';
  rr(ctx, 28, 76, 12, 40, 3); ctx.fill();
  rr(ctx, 56, 76, 12, 40, 3); ctx.fill();
  ctx.strokeStyle = '#14171c';
  ctx.lineWidth = 1.2;
  rr(ctx, 28, 76, 12, 40, 3); ctx.stroke();
  rr(ctx, 56, 76, 12, 40, 3); ctx.stroke();
  // 导轨滑槽亮线
  ctx.fillStyle = 'rgba(200,214,226,.18)';
  rr(ctx, 39, 78, 2, 36, 1); ctx.fill();
  rr(ctx, 55, 78, 2, 36, 1); ctx.fill();

  // ===== ⑦ 活塞杆（汽缸 → 十字头，随冲程伸缩）=====
  const rodBot = chY - 6;
  const rodGrad = ctx.createLinearGradient(44, 0, 52, 0);
  rodGrad.addColorStop(0, '#c2cdd6');
  rodGrad.addColorStop(0.5, '#8494a0');
  rodGrad.addColorStop(1, '#5f6e7a');
  ctx.fillStyle = rodGrad;
  rr(ctx, 44, 58, 8, rodBot - 58, 2); ctx.fill();
  ctx.strokeStyle = '#3c4850';
  ctx.lineWidth = 1;
  rr(ctx, 44, 58, 8, rodBot - 58, 2); ctx.stroke();

  // ===== ⑧ 十字头（沿导轨往复滑动）=====
  ctx.fillStyle = '#b9c4d0';
  rr(ctx, 38, chY - 6, 20, 12, 3); ctx.fill();
  ctx.strokeStyle = '#4a5260';
  ctx.lineWidth = 1.2;
  rr(ctx, 38, chY - 6, 20, 12, 3); ctx.stroke();
  ctx.fillStyle = '#333d44';
  ctx.beginPath(); ctx.arc(48, chY, 2, 0, Math.PI * 2); ctx.fill();

  // ===== ⑨ 连杆（十字头 → 曲柄销）=====
  ctx.strokeStyle = '#98a4b0';
  ctx.lineWidth = 4.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(48, chY + 5);
  ctx.lineTo(pinX, pinY);
  ctx.stroke();
  ctx.lineCap = 'butt';
  // 两端销轴
  ctx.fillStyle = '#333d44';
  ctx.beginPath(); ctx.arc(48, chY + 5, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(pinX, pinY, 2.2, 0, Math.PI * 2); ctx.fill();

  // ===== ⑩ 大飞轮（辐条随主轴旋转）=====
  // 外圈（圆环）
  ctx.fillStyle = '#54626e';
  ctx.beginPath();
  ctx.arc(FLY_X, FLY_Y, FLY_R, 0, Math.PI * 2);
  ctx.arc(FLY_X, FLY_Y, FLY_R - 3.5, 0, Math.PI * 2, true);
  ctx.fill();
  ctx.strokeStyle = '#1c2128';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(FLY_X, FLY_Y, FLY_R, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.15)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(FLY_X, FLY_Y, FLY_R - 1.2, -Math.PI * 1.1, -Math.PI * 0.5); ctx.stroke();
  // 辐条 ×5 + 轮毂（随 spin 旋转）
  ctx.save();
  ctx.translate(FLY_X, FLY_Y);
  ctx.rotate(spin);
  ctx.fillStyle = '#47525e';
  for (let i = 0; i < 5; i++) {
    ctx.save();
    ctx.rotate(i * Math.PI * 2 / 5);
    rr(ctx, -2, -(FLY_R - 4), 4, FLY_R - 9, 2); ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#333d44';
  ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#14171c';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#d9a441';
  ctx.beginPath(); ctx.arc(0, 0, 2.2, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  // 黄铜曲柄销（盖在辐条之上）
  ctx.fillStyle = '#d9a441';
  ctx.beginPath(); ctx.arc(pinX, pinY, 2.6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#8a6a14';
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(pinX, pinY, 2.6, 0, Math.PI * 2); ctx.stroke();

  // ===== ⑪ 输出轴（飞轮 → 南端）=====
  ctx.fillStyle = '#7a8a92';
  rr(ctx, 46, FLY_Y + FLY_R - 2, 4, 152 - FLY_Y - FLY_R + 6, 2); ctx.fill();

  // ===== ⑫ 励磁机盒（西侧；工作指示灯呼吸）=====
  ctx.fillStyle = '#46525c';
  rr(ctx, 5, 94, 13, 52, 3); ctx.fill();
  ctx.strokeStyle = '#1c2428';
  ctx.lineWidth = 1.3;
  rr(ctx, 5, 94, 13, 52, 3); ctx.stroke();
  ctx.fillStyle = '#2c363c';
  for (const ly of [102, 112, 122, 132]) {
    rr(ctx, 7.5, ly, 8, 2, 1); ctx.fill();
  }
  if (on) {
    const br = 0.5 + 0.5 * Math.sin(G.time * 5 + px);
    ctx.fillStyle = 'rgba(120,240,160,' + (0.35 + 0.5 * br).toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(11.5, 142, 2, 0, Math.PI * 2); ctx.fill();
  }

  // ===== ⑬ 功率小表盘（滑阀室下方；针随 outMult）=====
  ctx.fillStyle = '#1a1e26';
  ctx.beginPath(); ctx.arc(80, 60, 6, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#454b54';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(80, 60, 6, 0, Math.PI * 2); ctx.stroke();
  const oAng = -Math.PI / 2 + om * Math.PI;
  ctx.strokeStyle = om > 0.05 ? '#7ff0ff' : '#5a6470';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(80, 60);
  ctx.lineTo(80 + Math.cos(oAng) * 4.4, 60 + Math.sin(oAng) * 4.4);
  ctx.stroke();

  // ===== ⑭ 进汽脉冲（北端沿杆下漂）/ 排汽小雾（南端两侧）=====
  if (on) {
    const pt = (G.time * 1.8) % 1;
    ctx.fillStyle = 'rgba(240,248,255,' + (0.5 * (1 - pt)).toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(48, 22 + pt * 26, 1.6 + pt * 1.4, 0, Math.PI * 2); ctx.fill();
    const st = 0.5 + 0.5 * Math.sin(G.time * 8 + px);
    ctx.fillStyle = 'rgba(240,248,255,' + (0.25 * st * (0.3 + 0.7 * om)).toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(36, 150, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(60, 150, 2, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();

  // ===== ⑮ 功率铭牌（世界坐标水平绘制，任何朝向可读）=====
  // 两端汽口法兰是 r≈8 的圆，分别压在机身两端中线（竖直朝向即 y≈10 与 y≈150），
  // 因此按朝向选位：竖直贴北端铜汽缸正面（真机名牌惯例位，dir=2 时汽缸翻到南端），
  // 水平贴长边顶部导轨（法兰只在左右端中线，顶部整条让空），四个朝向互不遮挡。
  if (on) {
    const txt = '+' + Math.round(e.powerOut || 0) + ' kW';
    const pw = 48, ph = 11;
    const ax = (dir % 2 === 0) ? px + w / 2 : px + w / 2 + 10;
    const ay = (dir % 2 === 0)
      ? ((dir === 0) ? py + 30 : py + h - 30)   // 竖直：汽缸正面（面 y 12–58 的中上段）
      : py + 12;                                 // 水平：顶部导轨，偏东避开出汽小表盘
    ctx.fillStyle = 'rgba(10,14,20,.85)';
    rr(ctx, ax - pw / 2, ay - ph / 2, pw, ph, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(150,190,225,.45)';
    ctx.lineWidth = 1;
    rr(ctx, ax - pw / 2, ay - ph / 2, pw, ph, 3); ctx.stroke();
    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#eaf4ff';
    ctx.fillText(txt, ax, ay + 0.5);
  }

  // ===== ⑯ 两端通用汽口（世界坐标；绘制与原版完全一致）=====
  const pN = rotCell(e, e.def.w >> 1, 0);
  const pS = rotCell(e, e.def.w >> 1, e.def.h - 1);
  const _d = e.dir | 0;
  const cD = TILE / 2 - 1; // 端口凸缘贴合设备内部边缘
  drawPort(ctx, pN.x * TILE + TILE / 2, pN.y * TILE + TILE / 2, rotSide(3, _d), PORT_STEAM, false, 0, cD, 'steam', 'both');
  drawPort(ctx, pS.x * TILE + TILE / 2, pS.y * TILE + TILE / 2, rotSide(1, _d), PORT_STEAM, false, 0, cD, 'steam', 'both');
  ctx.globalAlpha = 1;
}

// ===== 注册：仅覆盖蒸汽机的渲染 =====
DEVICE_RENDER['steam-engine'] = drawSteamEngineSkin;
