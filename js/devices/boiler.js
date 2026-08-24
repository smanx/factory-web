'use strict';

// ===== 锅炉粒子（画面优化）：烧水时冒蒸汽 =====
function boilerEmit(e, dt) {
  if (typeof spawnSteam !== 'function') return;
  const key = 'b' + e.x + ',' + e.y;
  if (!G.entFxTimer) G.entFxTimer = {};
  G.entFxTimer[key] = (G.entFxTimer[key] || 0) + dt;
  if (G.entFxTimer[key] < 0.4) return;
  G.entFxTimer[key] = 0;
  const cx = (e.x + 0.5) * TILE;
  const cy = (e.y + 0.3) * TILE;
  spawnSteam(cx + (Math.random() - 0.5) * e.w * TILE * 0.4, cy, { size: 4, color: '#dde8f0' });
}

// ===== 锅炉：烧煤+水产汽 =====
class Boiler extends Entity {
  constructor(type, x, y) {
    super('boiler', x, y);
    this.fuelCoal = 0;
    this.fuelSolid = 0;
    this.burnLeft = 0;
    this.water = 0;      // 内部水箱：经左右两端水口双向进出、水位平衡
    this.steamBuf = 0;   // 蒸汽缓冲：经底边中间出汽口排向蒸汽机/管道
    this.temp = 0;       // 水温 °C（产汽时升高）
    this.burning = false; // 正在耗煤+水产汽
    this.lit = false;     // 炉火可见（有燃料在烧）
  }
  // 两端水口外侧格：左端格左边 (x-1,y+1) & 右端格右边 (x+w,y+1)（随本体固定，朝向无关）
  isWaterPortCell(cx, cy) { return cy === this.y + this.h - 1 && (cx === this.x - 1 || cx === this.x + this.w); }
  // 抽水机直供：指向两端格子且从水口一侧射入（左端←西来水，右端←东来水）
  acceptsPumpFeed(cx, cy, fromDir) {
    const r = this.y + this.h - 1;
    if (cy !== r) return false;
    if (cx === this.x) return fromDir === 0;
    if (cx === this.x + this.w - 1) return fromDir === 2;
    return false;
  }
  update(dt) {
    this.burning = false;
    this.temp = Math.max(0, this.temp - BOILER_COOL_RATE * dt);
    this.portFlow();
    // 蒸汽憋满则熄火省煤，被耗走后自动再点火；温度仅作显示，不限制产汽
    if (this.steamBuf >= WATER_CAP - 0.01) { this.lit = false; return; }
    // 只有既有水又有煤才点火；缺水时绝不空烧
    if (this.burnLeft <= 0 && this.water > 0 && (this.fuelSolid > 0 || this.fuelCoal > 0)) {
      // 优先烧更致密的固体燃料，其次烧煤
      if (this.fuelSolid > 0) { this.fuelSolid--; if (typeof trackProd === 'function') trackProd('solid-fuel', -1); this.burnLeft += SOLID_FUEL_ENERGY; }
      else { this.fuelCoal--; if (typeof trackProd === 'function') trackProd('coal', -1); this.burnLeft += COAL_ENERGY; }
    }
    if (this.burnLeft <= 0) { this.lit = false; return; }
    this.lit = true;
    if (this.water <= 0) return; // 供水中断：暂停产汽，炉内煤不消耗
    this.burning = true;
    boilerEmit(this, dt);
    this.burnLeft -= dt;
    this.water = Math.max(0, this.water - BOILER_WATER_RATE * dt);
    this.steamBuf = Math.min(WATER_CAP, this.steamBuf + BOILER_WATER_RATE * dt);
    this.temp = Math.min(BOILER_TEMP_MAX, this.temp + BOILER_HEAT_RATE * dt);
  }
  // 端口物流：两端水口如一段互通管道——双向进出、水位平衡（同排锅炉对口串接、
  // 管道一侧进另一侧出）；底边中间汽口向正对格的蒸汽机及管道排汽
  portFlow() {
    const covers = (n, cx, cy) => cx >= n.x && cx < n.x + n.w && cy >= n.y && cy < n.y + n.h;
    const wRow = this.y + this.h - 1;
    forEachNeighborEnt(this, n => {
      const wPort = covers(n, this.x - 1, wRow) || covers(n, this.x + this.w, wRow);
      const sPort = covers(n, this.x + (this.w >> 1), this.y + this.h);
      if (n instanceof Boiler) {
        if (wPort && n.y === this.y) {
          if (this.water >= n.water + 1 && n.water < WATER_CAP - 0.01) {
            this.water--; n.water = Math.min(WATER_CAP, n.water + 1);
          } else if (n.water >= this.water + 1 && this.water < WATER_CAP - 0.01) {
            n.water--; this.water = Math.min(WATER_CAP, this.water + 1);
          }
        }
      } else if (n instanceof Pipe) {
        if (wPort) {
          const pw = n.fluid['water'] || 0;
          if (pw >= this.water + 1 && this.water < WATER_CAP - 0.01) {
            n.takeItemOf('water'); this.water++;   // 管道水位更高：流入锅炉
          } else if (this.water >= pw + 1 && pw < PIPE_CAP && this.water >= 1) {
            n.giveItem('water'); this.water--;     // 锅炉水位更高：流回管道（另一端可出）
          }
        }
        if (sPort && this.steamBuf >= 1 && n.total() < PIPE_CAP && n.giveItem('steam')) this.steamBuf--;
      } else if (n instanceof SteamEngine) {
        if (sPort && this.steamBuf >= 1 && n.steamBuf < ENGINE_STEAM_CAP - 0.01) {
          this.steamBuf--; n.steamBuf++;
        }
      }
    });
  }
  giveItem(item) {
    if (item === 'coal' && this.fuelCoal < 20) { this.fuelCoal++; return true; }
    if (item === 'solid-fuel' && this.fuelSolid < 20) { this.fuelSolid++; return true; }
    if (item === 'water' && this.water < WATER_CAP - 0.01) { this.water = Math.min(WATER_CAP, this.water + 1); return true; }
    return false;
  }
  contents() {
    const list = [[this.type, 1]];
    if (this.fuelSolid > 0) list.push(['solid-fuel', this.fuelSolid]);
    if (this.fuelCoal > 0) list.push(['coal', this.fuelCoal]);
    if (this.water >= 1) list.push(['water', Math.floor(this.water)]);
    if (this.steamBuf >= 1) list.push(['steam', Math.floor(this.steamBuf)]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.fuelCoal = this.fuelCoal; s.fuelSolid = this.fuelSolid; s.burnLeft = this.burnLeft;
    s.water = this.water; s.steamBuf = this.steamBuf; s.temp = this.temp;
    return s;
  }
  static restore(s) {
    const b = super.restore(s);
    b.fuelCoal = s.fuelCoal || 0; b.fuelSolid = s.fuelSolid || 0; b.burnLeft = s.burnLeft || 0;
    b.water = s.water || 0; b.steamBuf = s.steamBuf || 0; b.temp = s.temp || 0;
    return b;
  }
}

// ===== 渲染 =====
function drawBoiler(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const w = TILE * 3, h = TILE * 2;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#8a6a45';
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 8); ctx.fill();
  ctx.strokeStyle = '#4c3f28';
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 8); ctx.stroke();
  ctx.fillStyle = '#5c4630';
  rr(ctx, px + 9, py + 9, w - 18, 12, 3); ctx.fill();
  if (e.lit) {
    const fl = 0.55 + Math.sin(G.time * 12 + px) * 0.2;
    ctx.fillStyle = 'rgba(232,118,44,' + (fl * 0.35).toFixed(2) + ')';
    rr(ctx, px + 9, py + 9, w - 18, 12, 3); ctx.fill();
    const fl2 = 0.65 + Math.sin(G.time * 12 + px) * 0.25;
    ctx.fillStyle = 'rgba(255,210,60,' + (fl2 * 0.7).toFixed(2) + ')';
    rr(ctx, px + w * 0.36, py + h * 0.42, w * 0.28, h * 0.16, 3); ctx.fill();
  }
  ctx.fillStyle = '#3b3230';
  rr(ctx, px + w * 0.46, py + 6, w * 0.08, h * 0.32, 3); ctx.fill();
  const fuelPct = Math.min(1, e.burnLeft / COAL_ENERGY);
  ctx.fillStyle = '#20242b';
  rr(ctx, px + 10, py + h - 12, w - 20, 5, 2); ctx.fill();
  ctx.fillStyle = fuelPct > 0 ? '#e8762c' : '#c33';
  rr(ctx, px + 10, py + h - 12, (w - 20) * fuelPct, 5, 2); ctx.fill();
  const wPct = Math.max(0, Math.min(1, (e.water || 0) / WATER_CAP));
  ctx.fillStyle = '#20242b';
  rr(ctx, px + 10, py + h - 19, w - 20, 5, 2); ctx.fill();
  ctx.fillStyle = wPct > 0 ? '#3fa0e8' : '#b33';
  rr(ctx, px + 10, py + h - 19, (w - 20) * wPct, 5, 2); ctx.fill();
  const tp = Math.max(0, Math.min(1, (e.temp || 0) / BOILER_TEMP_MAX));
  if (tp > 0.8) { // 温度达标：冒蒸汽
    for (let i = 0; i < 3; i++) {
      const t = ((G.time * 0.5) + i / 3) % 1;
      ctx.fillStyle = 'rgba(240,248,255,' + (0.5 * (1 - t)).toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(px + w * 0.62 + Math.sin((t + i) * 6) * 5, py + 16 - t * 20, 2.5 + t * 3, 0, 7);
      ctx.fill();
    }
  }
  ctx.font = 'bold 11px system-ui';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f4e9d8';
  ctx.fillText('锅炉', px + 8, py + 14);
  ctx.textAlign = 'right';
  ctx.fillStyle = tp >= 1 ? '#7fe08f' : tp > 0 ? '#ffd23c' : '#8a93a0';
  ctx.fillText(Math.round(e.temp || 0) + '°C', px + w - 8, py + 14);
  // 水口（蓝，双向互通）：左右两端下格侧边；汽口（白，只出）：底边中间
  const cx = px + TILE * 1.5, cy = py + TILE;
  drawPort(ctx, cx, cy, 2, PORT_WATER, false, -0.5, TILE);
  drawPort(ctx, cx, cy, 0, PORT_WATER, false, 0.5, TILE);
  drawPort(ctx, cx, cy, 1, PORT_STEAM, true, 0, TILE);
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function boilerPanelHtml(e) {
  let h = row('燃料', (e.fuelSolid > 0 ? chip('solid-fuel', e.fuelSolid) + ' ' : '') + (e.fuelCoal > 0 ? chip('coal', e.fuelCoal) : '<span class="dim">无</span>'), 'fuel');
  if (invCount('coal') > 0)
    h += '<button data-action="fuel" data-id="coal">加 5 煤 (' + invCount('coal') + ')</button>';
  if (invCount('solid-fuel') > 0)
    h += '<button data-action="fuel" data-id="solid-fuel">加 5 固体燃料 (' + invCount('solid-fuel') + ')</button>';
  h += row('水', '<span class="dim"></span>', 'water');
  if (invCount('water') > 0)
    h += '<button data-action="feed" data-id="water">注入全部存水</button>';
  h += row('蒸汽缓存', '<span class="dim"></span>', 'steam');
  h += row('温度', '', 'temp');
  h += barHtml(0);
  h += '<div class="status"></div>';
  h += '<div class="dim">供电链：抽水机 → 管道 → 锅炉两端蓝口水口（左右互通、双向进出、水位自动平衡，可一端进另一端出、多台串联）；加煤烧出的蒸汽从底边中间白口送往下方蒸汽机，也可经蒸汽管道远送。</div>';
  return h;
}
function boilerPanelLive(e, api) {
  api.set('fuel', (e.fuelSolid > 0 ? chip('solid-fuel', e.fuelSolid) + ' ' : '') + (e.fuelCoal > 0 ? chip('coal', e.fuelCoal) : dimSpan('无')));
  api.set('water', e.water >= 1 ? chip('water', Math.floor(e.water)) : dimSpan('空'));
  api.set('steam', e.steamBuf >= 1 ? chip('steam', Math.floor(e.steamBuf)) : dimSpan('空'));
  api.set('temp', Math.round(e.temp) + ' / ' + BOILER_TEMP_MAX + ' °C');
  api.prog(e.temp / BOILER_TEMP_MAX * 100);
  if (e.steamBuf >= WATER_CAP - 0.01) api.status('已暂停：蒸汽憋满，等待蒸汽机/管道消耗', 'warn');
  else if (e.burning) api.status('产汽中（耗煤+水）', 'ok');
  else if (e.water < 1) api.status('已暂停：缺水（检查左右两端水口/管道供水）', 'bad');
  else if (e.fuelCoal <= 0 && e.fuelSolid <= 0 && e.burnLeft <= 0) api.status('已暂停：无燃料', 'bad');
  else api.status('已暂停：待机', 'warn');
}
function boilerTip(e) {
  return e.burning ? '产汽中 ' + Math.round(e.temp) + '°C（存汽' + Math.floor(e.steamBuf || 0) + '）'
    : e.steamBuf >= WATER_CAP - 0.01 ? '蒸汽憋满·等待消耗'
    : e.water < 1 ? '缺水（检查左右两端蓝口水口/管道）'
    : (e.fuelCoal <= 0 && e.burnLeft <= 0) ? '无煤' : '待机';
}

// ===== 注册 =====
ENT_CLASSES['boiler'] = Boiler;
DEVICE_RENDER['boiler'] = drawBoiler;
DEVICE_STATUS['boiler'] = e => e.burning ? 'g' : (e.steamBuf >= WATER_CAP - 0.01 ? 'y' : 'r');
DEVICE_PANEL['boiler'] = { html: boilerPanelHtml, live: boilerPanelLive, tip: boilerTip };
DEVICE_DIR_ROTATE['boiler'] = true;
