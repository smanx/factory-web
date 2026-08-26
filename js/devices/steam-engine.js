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
      if (n instanceof Pipe) {
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

// ===== 渲染 =====
function drawSteamEngine(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const w = TILE * e.w, h = TILE * e.h;
  const om = Math.max(0, Math.min(1, e.outMult || 0));
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#5d7790';
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 8); ctx.fill();
  ctx.strokeStyle = '#33435a';
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 8); ctx.stroke();
  ctx.fillStyle = '#466075';
  rr(ctx, px + 10, py + 10, w - 20, h - 20, 5); ctx.fill();
  const gcx = px + w / 2, gcy = py + h * 0.32;
  if (e.on) {
    ctx.save();
    ctx.translate(gcx, gcy);
    ctx.rotate(e.spin || 0);
    ctx.fillStyle = om >= 1 ? '#c4e4ff' : '#aac8e8';
    gearShape(ctx, 0, 0, 16, 10, 8);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(143,224,224,' + (0.35 + 0.55 * om).toFixed(2) + ')';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(gcx, gcy, 22, 0, Math.PI * 2);
    ctx.stroke();
    const fl = Math.sin(G.time * 20 + px);
    if (fl > 0.2) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + 0.35 * om).toFixed(2) + ')';
      ctx.beginPath();
      ctx.moveTo(gcx - 14, py + 26);
      ctx.lineTo(gcx - 4, py + 12);
      ctx.lineTo(gcx - 10, py + 26);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    ctx.fillStyle = '#7d8894';
    gearShape(ctx, gcx, gcy, 16, 10, 8);
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (e.on) ctx.fillText('+' + (e.powerOut || 0).toFixed(1), px + w / 2, py + h - 14);
  else ctx.fillText('蒸汽机', px + w / 2, py + h - 14);
  // 两端通用汽口：任意一端均可进出蒸汽（随 dir 旋转）
  const pN = rotCell(e, e.def.w >> 1, -1);
  const pS = rotCell(e, e.def.w >> 1, e.def.h);
  const _d = e.dir | 0;
  drawPort(ctx, pN.x * TILE + TILE / 2, pN.y * TILE + TILE / 2, rotSide(3, _d), PORT_STEAM, false, 0, TILE);
  drawPort(ctx, pS.x * TILE + TILE / 2, pS.y * TILE + TILE / 2, rotSide(1, _d), PORT_STEAM, false, 0, TILE);
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function steamEnginePanelHtml(e) {
  let h = row('输出功率', '<span class="dim"></span>', 'power');
  h += row('蒸汽存量', '<span class="dim"></span>', 'steam');
  h += barHtml(0);
  h += '<div class="status"></div>';
  h += '<div class="dim">上下两端各一只通用汽口，功能相同：蒸汽可从任意一端进入发电，多余蒸汽也可从另一端送出——可与相邻蒸汽机首尾串联或接入蒸汽管道。满功率耗汽 ' + ENGINE_STEAM_RATE +
    '/s（1 台锅炉约带 2 台），输出 +' + POWER_PER_ENGINE + ' 并入全图电网。</div>';
  return h;
}
function steamEnginePanelLive(e, api) {
  api.set('power', e.on ? '+' + e.powerOut.toFixed(1) : dimSpan('+0'));
  api.set('steam', e.steamBuf >= 1 ? chip('steam', Math.floor(e.steamBuf)) : dimSpan('空'));
  api.prog((e.outMult || 0) * 100);
  if (e.on) api.status('发电中：供汽越足功率越高', 'ok');
  else if (e.steamBuf > 0) api.status('已暂停：蒸汽不足，功率随供汽量下降', 'warn');
  else api.status('已暂停：未接蒸汽（从任一端汽口接入）', 'bad');
}
function steamEngineTip(e) {
  return e.on ? '发电中 +' + (e.powerOut || 0).toFixed(1) + '（存汽' + Math.floor(e.steamBuf || 0) + '）'
    : (e.steamBuf > 0 ? '供汽不足，功率受限'
    : '未接蒸汽：从任一端汽口接入（紧邻锅炉出汽口或经管道）');
}

// ===== 注册 =====
ENT_CLASSES['steam-engine'] = SteamEngine;
DEVICE_RENDER['steam-engine'] = drawSteamEngine;
DEVICE_STATUS['steam-engine'] = e => e.on ? 'g' : ((e.steamBuf || 0) > 0 ? 'y' : 'r');
DEVICE_PANEL['steam-engine'] = { html: steamEnginePanelHtml, live: steamEnginePanelLive, tip: steamEngineTip };
DEVICE_DIR_ROTATE['steam-engine'] = true;
