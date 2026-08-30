'use strict';

// ===== 蒸汽机：烧蒸汽发电 =====
class SteamEngine extends Entity {
  constructor(type, x, y) {
    super('steam-engine', x, y);
    this.spin = 0;
    this.on = false;
    this.outMult = 0;   // 输出系数 = 实际供汽 / 满功率耗汽
    this.powerOut = 0;  // 当前输出功率
    this.steamBuf = 0;  // 内部储汽：两端汽口均可进出蒸汽，支持首尾串联
  }
  applyDir() { if (this.dir % 2 === 1) { this.w = this.def.h; this.h = this.def.w; } }
  update(dt) {
    this.portFlow();
    const want = ENGINE_STEAM_RATE * dt;
    const took = Math.min(want, this.steamBuf);
    this.steamBuf -= took;
    const inst = want > 1e-9 ? Math.min(1, took / want) : 0;
    this.outMult += (inst - this.outMult) * Math.min(1, dt * 6);
    if (this.outMult < 0.005) this.outMult = 0;
    this.powerOut = POWER_PER_ENGINE * this.outMult;
    this.on = this.powerOut > 0.05;
    if (this.on) this.spin += dt * 8 * (0.35 + 0.65 * this.outMult);
    // 电力增量注册表同步：powerOut 变化后重新注册，确保被 updatePower 扫描到（发电设备正确计入 prod）
    if (typeof regPowerEnt === 'function') regPowerEnt(this);
  }
  // 端口物流：上下两端各一只功能相同的汽口——蒸汽可从任意一端进入，
  // 多余蒸汽也可从另一端送出；与端对端的相邻蒸汽机均衡串汽（随 dir 旋转）
  portFlow() {
    const covers = (n, cx, cy) => cx >= n.x && cx < n.x + n.w && cy >= n.y && cy < n.y + n.h;
    const pN = rotCell(this, this.def.w >> 1, -1);
    const pS = rotCell(this, this.def.w >> 1, this.def.h);
    forEachNeighborEnt(this, n => {
      const endPort = covers(n, pN.x, pN.y) || covers(n, pS.x, pS.y);
      if (pipeConnAt(n.x, n.y, sideFromEntity(this, n))) {
        if (!endPort) return;   // 只经两端汽口交换
        if (this.steamBuf < ENGINE_STEAM_CAP - 0.01 && (n.fluid['steam'] || 0) >= 1) {
          n.takeItemOf('steam'); this.steamBuf++;
        }
        if (this.steamBuf > ENGINE_STEAM_CAP * 0.5 && n.total() < PIPE_CAP && n.giveItem('steam')) this.steamBuf--;
      } else if (n instanceof SteamEngine) {
        // 需要端口相对：我占其任一端汽口格，且其占我的任一端汽口格
        const mine = endPort;
        const nN = rotCell(n, n.def.w >> 1, -1);
        const nS = rotCell(n, n.def.w >> 1, n.def.h);
        const theirs = covers(this, nN.x, nN.y) || covers(this, nS.x, nS.y);
        if (!(mine && theirs)) return;
        if (this.steamBuf >= n.steamBuf + 1 && n.steamBuf < ENGINE_STEAM_CAP - 0.01) { this.steamBuf--; n.steamBuf++; }
        else if (n.steamBuf >= this.steamBuf + 1 && this.steamBuf < ENGINE_STEAM_CAP - 0.01) { n.steamBuf--; this.steamBuf++; }
      }
    });
  }
  giveItem(item) {
    if (item === 'steam' && this.steamBuf < ENGINE_STEAM_CAP - 0.01) { this.steamBuf = Math.min(ENGINE_STEAM_CAP, this.steamBuf + 1); return true; }
    return false;
  }
  peekItem() { return this.steamBuf >= 1 ? 'steam' : null; }
  takeItem() { if (this.steamBuf >= 1) { this.steamBuf--; return 'steam'; } return null; }
  countOf(item) { return item === 'steam' ? Math.floor(this.steamBuf) : 0; }
  takeItemOf(item) { if (item === 'steam' && this.steamBuf >= 1) { this.steamBuf--; return 'steam'; } return null; }
  contents() {
    const list = [[this.type, 1]];
    if (this.steamBuf >= 1) list.push(['steam', Math.floor(this.steamBuf)]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.steamBuf = this.steamBuf;
    return s;
  }
  static restore(s) {
    const e = super.restore(s);
    e.steamBuf = s.steamBuf || 0;
    return e;
  }
}

// ===== 蒸汽机渲染：3×5 立式蒸汽涡轮发电机 =====
// 视觉分区（自下而上）：
//   ① 罐底阴影 + 基座  ② 主外壳（深蓝钢渐变）
//   ③ 焊接筋板  ④ 顶部 2 个蒸汽入口（双向，蓝色）
//   ⑤ 顶部蒸汽管路（连通两端入口）  ⑥ 中央飞轮（旋转）+ 连杆（活塞驱动）
//   ⑦ 底部发电机外壳（输出功率 + 状态 LED）  ⑧ 4 角螺栓  ⑨ 罐体外框
function drawSteamEngine(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const w = TILE * e.w, h = TILE * e.h;
  const cx = px + w / 2;
  const om = Math.max(0, Math.min(1, e.outMult || 0));
  ctx.globalAlpha = alpha;

  // ① 罐底阴影 + 基座
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(cx, py + h - 2, w * 0.42, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a2434';
  rr(ctx, px + 5, py + h - 11, w - 10, 8, 3); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(px + 9, py + h - 6, w - 18, 0.8);

  // ② 主外壳（深蓝钢渐变）
  const bodyGrad = ctx.createLinearGradient(0, py + 4, 0, py + h - 4);
  bodyGrad.addColorStop(0,    '#6a8aac');
  bodyGrad.addColorStop(0.5,  '#3e5a7a');
  bodyGrad.addColorStop(1,    '#1e324a');
  ctx.fillStyle = bodyGrad;
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 9); ctx.fill();

  // ③ 焊接筋板（左右各 3 条）
  const ribXs = [px + w * 0.16, px + w * 0.32, px + w * 0.50 - 1,
                 px + w * 0.50 + 1, px + w * 0.68, px + w * 0.84];
  for (let i = 0; i < ribXs.length; i++) {
    const darkSide = (i % 2 === 0);
    ctx.fillStyle = darkSide ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.10)';
    ctx.fillRect(ribXs[i], py + 28, 1.4, h - 60);
  }

  // ④ 顶部蒸汽管路（连通两端入口的横向总管）
  ctx.fillStyle = '#4a5e7a';
  rr(ctx, px + 10, py + 14, w - 20, 10, 3); ctx.fill();
  ctx.strokeStyle = '#1a2434';
  ctx.lineWidth = 1;
  rr(ctx, px + 10, py + 14, w - 20, 10, 3); ctx.stroke();
  // 管路高光
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(px + 14, py + 16, w - 28, 1.2);
  // 管路中段阀芯（亮起的蓝色小灯表示供汽）
  if (e.steamBuf > 0) {
    const sv = 0.5 + Math.sin((G.time || 0) * 4 + px) * 0.25;
    ctx.fillStyle = 'rgba(143,224,255,' + (0.5 + sv * 0.4).toFixed(2) + ')';
    ctx.beginPath();
    ctx.arc(cx, py + 19, 2.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(220,245,255,0.8)';
    ctx.beginPath();
    ctx.arc(cx - 0.5, py + 18.3, 0.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // ⑤ 顶部中央气缸（蒸汽推动活塞的圆筒）
  const cyX = px + w * 0.5, cyY = py + 30;
  const cyW = w * 0.46, cyH = 18;
  ctx.fillStyle = '#2a3a52';
  rr(ctx, cyX - cyW / 2, cyY, cyW, cyH, 3); ctx.fill();
  // 气缸高光
  const cylGrad = ctx.createLinearGradient(0, cyY, 0, cyY + cyH);
  cylGrad.addColorStop(0,   'rgba(180,210,240,0.35)');
  cylGrad.addColorStop(0.5, 'rgba(120,150,180,0.0)');
  cylGrad.addColorStop(1,   'rgba(0,0,0,0.30)');
  ctx.fillStyle = cylGrad;
  rr(ctx, cyX - cyW / 2, cyY, cyW, cyH, 3); ctx.fill();
  ctx.strokeStyle = '#1a2434';
  ctx.lineWidth = 1;
  rr(ctx, cyX - cyW / 2, cyY, cyW, cyH, 3); ctx.stroke();
  // 气缸内活塞（左右来回运动）
  if (e.on) {
    const pistonOffset = Math.sin((e.spin || 0) * 0.5) * (cyW * 0.32);
    ctx.fillStyle = '#5a6e88';
    ctx.fillRect(cyX - 3 + pistonOffset, cyY + 2, 6, cyH - 4);
    ctx.fillStyle = 'rgba(180,210,240,0.5)';
    ctx.fillRect(cyX - 3 + pistonOffset, cyY + 2, 1, cyH - 4);
  }
  // 气缸左右安装螺栓
  const drawSmallBolt = (bx, by) => {
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath(); ctx.arc(bx, by, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a2434';
    ctx.beginPath(); ctx.arc(bx, by, 1.0, 0, Math.PI * 2); ctx.fill();
  };
  drawSmallBolt(cyX - cyW / 2 + 2, cyY + 2);
  drawSmallBolt(cyX + cyW / 2 - 2, cyY + 2);
  drawSmallBolt(cyX - cyW / 2 + 2, cyY + cyH - 2);
  drawSmallBolt(cyX + cyW / 2 - 2, cyY + cyH - 2);

  // ⑥ 中央飞轮（大圆 + 6 辐条 + 旋转）
  const fwx = cx, fwy = py + h * 0.58;
  const fwr = 22;
  // 飞轮外圈（深色金属）
  const wheelGrad = ctx.createRadialGradient(fwx - 4, fwy - 4, 1, fwx, fwy, fwr);
  wheelGrad.addColorStop(0,   '#a0b0c4');
  wheelGrad.addColorStop(0.5, '#6a7e98');
  wheelGrad.addColorStop(1,   '#2a3a52');
  ctx.fillStyle = wheelGrad;
  ctx.beginPath(); ctx.arc(fwx, fwy, fwr, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1a2434';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(fwx, fwy, fwr, 0, Math.PI * 2); ctx.stroke();
  // 飞轮内圈
  ctx.fillStyle = e.on ? '#3a4a62' : '#2a3a52';
  ctx.beginPath(); ctx.arc(fwx, fwy, fwr - 5, 0, Math.PI * 2); ctx.fill();
  // 6 条辐条 + 中心轮毂
  if (e.on) {
    ctx.save();
    ctx.translate(fwx, fwy);
    ctx.rotate(e.spin || 0);
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = '#4a5e7a';
      ctx.save();
      ctx.rotate(i * Math.PI / 3);
      ctx.fillRect(-1.5, -(fwr - 6), 3, fwr - 12);
      ctx.restore();
    }
    // 中心轮毂
    ctx.fillStyle = '#8a9cb8';
    ctx.beginPath(); ctx.arc(0, 0, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a4a62';
    ctx.beginPath(); ctx.arc(0, 0, 2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else {
    // 待机：显示静态辐条
    for (let i = 0; i < 6; i++) {
      ctx.fillStyle = '#3a4a62';
      ctx.save();
      ctx.translate(fwx, fwy);
      ctx.rotate(i * Math.PI / 3);
      ctx.fillRect(-1.5, -(fwr - 6), 3, fwr - 12);
      ctx.restore();
    }
    ctx.fillStyle = '#5a6e88';
    ctx.beginPath(); ctx.arc(fwx, fwy, 4, 0, Math.PI * 2); ctx.fill();
  }
  // 飞轮外圈装饰齿
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI * 2 / 16;
    ctx.beginPath();
    ctx.moveTo(fwx + Math.cos(a) * fwr, fwy + Math.sin(a) * fwr);
    ctx.lineTo(fwx + Math.cos(a) * (fwr - 1.5), fwy + Math.sin(a) * (fwr - 1.5));
    ctx.stroke();
  }
  // 飞轮发光（运转时）
  if (e.on) {
    ctx.strokeStyle = 'rgba(143,224,255,' + (0.35 + 0.55 * om).toFixed(2) + ')';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(fwx, fwy, fwr + 3, 0, Math.PI * 2);
    ctx.stroke();
  }
  // 连杆（活塞 → 飞轮偏心轴）
  if (e.on) {
    const pistonX = cyX - 3 + Math.sin((e.spin || 0) * 0.5) * (cyW * 0.32);
    const pistonY = cyY + cyH;
    const crankA = (e.spin || 0) + Math.PI;
    const crankX = fwx + Math.cos(crankA) * 7;
    const crankY = fwy + Math.sin(crankA) * 7;
    ctx.strokeStyle = '#8a9cb8';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(pistonX, pistonY);
    ctx.lineTo(crankX, crankY);
    ctx.stroke();
    // 偏心轴小圆
    ctx.fillStyle = '#4a5e7a';
    ctx.beginPath(); ctx.arc(crankX, crankY, 1.8, 0, Math.PI * 2); ctx.fill();
  }

  // ⑦ 底部发电机外壳（功率显示区）
  const genX = px + 10, genY = py + h - 32, genW = w - 20, genH = 16;
  ctx.fillStyle = '#1a2434';
  rr(ctx, genX, genY, genW, genH, 3); ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 0.6;
  rr(ctx, genX, genY, genW, genH, 3); ctx.stroke();
  // 功率文字（白色加描边）
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 2.5;
  const powerStr = e.on ? ('+' + Math.round(e.powerOut || 0) + ' kW') : '+0 kW';
  ctx.strokeText(powerStr, cx, genY + genH / 2);
  ctx.fillText(powerStr, cx, genY + genH / 2);
  // 状态 LED（左下角，根据运行/待机/供汽不足变色）
  const ledC = e.on ? '#9ce06c' : (e.steamBuf > 0 ? '#ffd23c' : '#3a4a62');
  ctx.fillStyle = ledC;
  ctx.beginPath(); ctx.arc(px + 12, py + h - 24, 1.8, 0, Math.PI * 2); ctx.fill();
  if (e.on) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.arc(px + 11.5, py + h - 24.5, 0.6, 0, Math.PI * 2); ctx.fill();
  }

  // ⑧ 4 角螺栓
  const drawBolt = (bx, by) => {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.arc(bx, by, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a2434';
    ctx.beginPath(); ctx.arc(bx, by, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(180,210,240,0.4)';
    ctx.beginPath(); ctx.arc(bx - 0.4, by - 0.4, 0.7, 0, Math.PI * 2); ctx.fill();
  };
  drawBolt(px + 9,        py + 9);
  drawBolt(px + w - 9,     py + 9);
  drawBolt(px + 9,        py + h - 9);
  drawBolt(px + w - 9,     py + h - 9);

  // ⑨ 罐体外框描边
  ctx.strokeStyle = '#1a2434';
  ctx.lineWidth = 2.4;
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 9); ctx.stroke();
  // 顶部圆弧高光
  ctx.strokeStyle = 'rgba(180,210,240,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, py + 4, w * 0.32, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();

  // 端口沿用旧 drawPort 约定：上端 = 北向汽口，下端 = 南向汽口
  const pN = rotCell(e, e.def.w >> 1, 0);
  const pS = rotCell(e, e.def.w >> 1, e.def.h - 1);
  const _d = e.dir | 0;
  const cD = TILE / 2 - 1;
  drawPort(ctx, pN.x * TILE + TILE / 2, pN.y * TILE + TILE / 2, rotSide(3, _d), PORT_STEAM, false, 0, cD, 'steam', 'both');
  drawPort(ctx, pS.x * TILE + TILE / 2, pS.y * TILE + TILE / 2, rotSide(1, _d), PORT_STEAM, false, 0, cD, 'steam', 'both');

  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function steamEnginePanelHtml(e) {
  let h = row('输出功率', '<span class="dim"></span>', 'power');
  h += row('蒸汽存量', '<span class="dim"></span>', 'steam');
  h += '<div class="dim">上下两端各一只通用汽口，功能相同：蒸汽可从任意一端进入发电，多余蒸汽也可从另一端送出——可与相邻蒸汽机首尾串联或接入蒸汽管道。满功率耗汽 ' + ENGINE_STEAM_RATE +
    '/s（1 台锅炉约带 2 台），输出 +' + POWER_PER_ENGINE + ' kW 并入全图电网。</div>';
  return h;
}
function steamEnginePanelLive(e, api) {
  api.set('power', e.on ? '+' + e.powerOut.toFixed(1) : dimSpan('+0'));
  api.set('steam', e.steamBuf >= 1 ? '<div class="asm3-inp-row">' + itemSlotsHtml({ steam: Math.floor(e.steamBuf) }, { action: 'display' }) + '</div>' : dimSpan('空'));
  api.prog((e.outMult || 0) * 100);
  if (e.on) api.status('发电中：供汽越足功率越高', 'ok');
  else if (e.steamBuf > 0) api.status('已暂停：蒸汽不足，功率随供汽量下降', 'warn');
  else api.status('已暂停：未接蒸汽（从任一端汽口接入）', 'bad');
}
function steamEngineTip(e) {
  return e.on ? '发电中 +' + Math.round(e.powerOut || 0) + ' kW（存汽' + Math.floor(e.steamBuf || 0) + '）'
    : (e.steamBuf > 0 ? '供汽不足，功率受限'
    : '未接蒸汽：从任一端汽口接入（紧邻锅炉出汽口或经管道）');
}

// ===== 注册 =====
ENT_CLASSES['steam-engine'] = SteamEngine;
DEVICE_RENDER['steam-engine'] = drawSteamEngine;
DEVICE_STATUS['steam-engine'] = e => e.on ? 'g' : ((e.steamBuf || 0) > 0 ? 'y' : 'r');
DEVICE_PANEL['steam-engine'] = { html: steamEnginePanelHtml, live: steamEnginePanelLive, tip: steamEngineTip };
DEVICE_DIR_ROTATE['steam-engine'] = true;
// 显示详情时，各接口图标所在世界格 + 对应流体名（用于鼠标悬停显示流体名称）
DEVICE_FLUID_ICONS['steam-engine'] = e => {
  const pN = rotCell(e, e.def.w >> 1, 0);
  const pS = rotCell(e, e.def.w >> 1, e.def.h - 1);
  return [
    { x: pN.x, y: pN.y, fluid: 'steam' },
    { x: pS.x, y: pS.y, fluid: 'steam' }
  ];
};
