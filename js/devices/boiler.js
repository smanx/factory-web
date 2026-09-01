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
    this.fuelRocket = 0;
    this.fuelWood = 0;
    this.burnLeft = 0;
    this.water = 0;      // 内部水箱：经左右两端水口双向进出、水位平衡
    this.steamBuf = 0;   // 蒸汽缓冲：经底边中间出汽口排向蒸汽机/管道
    this.temp = 0;       // 水温 °C（产汽时升高）
    this.burning = false; // 正在耗煤+水产汽
    this.lit = false;     // 炉火可见（有燃料在烧）
  }
  applyDir() { if (this.dir % 2 === 1) { this.w = this.def.h; this.h = this.def.w; } }
  // 两端水口外侧格：左端格左边 & 右端格右边（随 dir 旋转）
  isWaterPortCell(cx, cy) {
    const pL = rotCell(this, -1, 1), pR = rotCell(this, this.def.w, 1);
    return (cy === pL.y && cx === pL.x) || (cy === pR.y && cx === pR.x);
  }
  // 抽水机直供：指向两端格子且从水口一侧射入（左端←西来水，右端←东来水）
  acceptsPumpFeed(cx, cy, fromDir) {
    const pL = rotCell(this, -1, 1), pR = rotCell(this, this.def.w, 1);
    if (cx === pL.x && cy === pL.y) return fromDir === rotSide(2, this.dir);
    if (cx === pR.x && cy === pR.y) return fromDir === rotSide(0, this.dir);
    return false;
  }
  update(dt) {
    this.burning = false;
    this.temp = Math.max(0, this.temp - BOILER_COOL_RATE * dt);
    this.portFlow();
    // 蒸汽憋满则熄火省煤，被耗走后自动再点火；温度仅作显示，不限制产汽
    if (this.steamBuf >= WATER_CAP - 0.01) { this.lit = false; return; }
    // 只有既有水又有煤才点火；缺水时绝不空烧
    if (this.burnLeft <= 0 && this.water > 0 && (this.fuelRocket > 0 || this.fuelSolid > 0 || this.fuelCoal > 0 || this.fuelWood > 0)) {
      // 优先烧最高能量的火箭燃料，其次固体燃料，再次煤，最后木材
      if (this.fuelRocket > 0) { this.fuelRocket--; if (typeof trackProd === 'function') trackProd('rocket-fuel', -1); this.burnLeft += ROCKET_FUEL_ENERGY; }
      else if (this.fuelSolid > 0) { this.fuelSolid--; if (typeof trackProd === 'function') trackProd('solid-fuel', -1); this.burnLeft += SOLID_FUEL_ENERGY; }
      else if (this.fuelCoal > 0) { this.fuelCoal--; if (typeof trackProd === 'function') trackProd('coal', -1); this.burnLeft += COAL_ENERGY; }
      else { this.fuelWood--; if (typeof trackProd === 'function') trackProd('wood', -1); this.burnLeft += WOOD_FUEL_ENERGY; }
    }
    if (this.burnLeft <= 0) { this.lit = false; return; }
    this.lit = true;
    if (this.water <= 0) return; // 供水中断：暂停产汽，炉内煤不消耗
    this.burning = true;
    // 仅屏内可见时才播放蒸汽声，避免屏外锅炉持续发声
    if (typeof onScreen === 'function' && onScreen(this)) {
      if (typeof playSfx === 'function') playSfx('steam');
      // 蒸汽音效节流（约每 0.9 秒一次柔和气声，避免连续刷音）
      this._steamSfxT = (this._steamSfxT || 0) - dt;
      if (this._steamSfxT <= 0) {
        this._steamSfxT = 0.9;
        if (typeof playSfx === 'function') playSfx('steam');
      }
    }
    boilerEmit(this, dt);
    // 燃烧速率 = 锅炉官方功率 1.8MW，使一块燃料燃烧时长 = 热值÷功率，对齐官方
    this.burnLeft -= dt * fuelConsumptionMult() * burnPowerMW('boiler');
    this.water = Math.max(0, this.water - BOILER_WATER_RATE * dt);
    this.steamBuf = Math.min(WATER_CAP, this.steamBuf + BOILER_WATER_RATE * dt);
    this.temp = Math.min(BOILER_TEMP_MAX, this.temp + BOILER_HEAT_RATE * dt);
  }
  // 端口物流：两端水口如一段互通管道——双向进出、水位平衡（同排锅炉对口串接、
  // 管道一侧进另一侧出）；底边中间汽口向正对格的蒸汽机及管道排汽（随 dir 旋转）
  portFlow() {
    const covers = (n, cx, cy) => cx >= n.x && cx < n.x + n.w && cy >= n.y && cy < n.y + n.h;
    const pL = rotCell(this, -1, 1), pR = rotCell(this, this.def.w, 1);
    const pS = rotCell(this, this.def.w >> 1, this.def.h);
    forEachNeighborEnt(this, n => {
      const wPort = covers(n, pL.x, pL.y) || covers(n, pR.x, pR.y);
      const sPort = covers(n, pS.x, pS.y);
      if (n instanceof Boiler) {
        if (wPort && n.y === this.y) {
          if (this.water >= n.water + 1 && n.water < WATER_CAP - 0.01) {
            this.water--; n.water = Math.min(WATER_CAP, n.water + 1);
          } else if (n.water >= this.water + 1 && this.water < WATER_CAP - 0.01) {
            n.water--; this.water = Math.min(WATER_CAP, this.water + 1);
          }
        }
      } else if (pipeConnAt(n.x, n.y, sideFromEntity(this, n))) {
        // 普通管道 / 地下管道（管口朝锅炉）：两端水口与出汽口均按管道协议互通
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
    if (item === 'rocket-fuel' && this.fuelRocket < 20) { this.fuelRocket++; return true; }
    if (item === 'coal' && this.fuelCoal < 20) { this.fuelCoal++; return true; }
    if (item === 'wood' && this.fuelWood < 20) { this.fuelWood++; return true; }
    if (item === 'solid-fuel' && this.fuelSolid < 20) { this.fuelSolid++; return true; }
    if (item === 'water' && this.water < WATER_CAP - 0.01) { this.water = Math.min(WATER_CAP, this.water + 1); return true; }
    return false;
  }
  contents() {
    const list = [[this.type, 1]];
    if (this.fuelRocket > 0) list.push(['rocket-fuel', this.fuelRocket]);
    if (this.fuelSolid > 0) list.push(['solid-fuel', this.fuelSolid]);
    if (this.fuelCoal > 0) list.push(['coal', this.fuelCoal]);
    if (this.fuelWood > 0) list.push(['wood', this.fuelWood]);
    if (this.water >= 1) list.push(['water', Math.floor(this.water)]);
    if (this.steamBuf >= 1) list.push(['steam', Math.floor(this.steamBuf)]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.fuelCoal = this.fuelCoal; s.fuelSolid = this.fuelSolid; s.fuelRocket = this.fuelRocket; s.fuelWood = this.fuelWood; s.burnLeft = this.burnLeft;
    s.water = this.water; s.steamBuf = this.steamBuf; s.temp = this.temp;
    return s;
  }
  static restore(s) {
    const b = super.restore(s);
    b.fuelCoal = s.fuelCoal || 0; b.fuelSolid = s.fuelSolid || 0; b.fuelRocket = s.fuelRocket || 0; b.fuelWood = s.fuelWood || 0; b.burnLeft = s.burnLeft || 0;
    b.water = s.water || 0; b.steamBuf = s.steamBuf || 0; b.temp = s.temp || 0;
    return b;
  }
}

// ===== 锅炉渲染：3×2 卧式火管锅炉（铜色工业风） =====
// 视觉分区：
//   ① 罐底阴影 + 基座  ② 铜色锅炉外壳（卧式圆筒）
//   ③ 焊接筋板 + 铆钉  ④ 顶部烟囱（运转时冒烟）
//   ⑤ 两端水室（玻璃管 + 蓝色水位）  ⑥ 中央炉膛（炉火 + 玻璃观察窗）
//   ⑦ 水位条 + 燃料条 + 温度指示  ⑧ 4 角螺栓  ⑨ 罐体外框
// 水口（蓝，双向）与汽口（白，只出）按 rotCell + drawPort 沿用旧约定
function drawBoiler(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const w = TILE * e.w, h = TILE * e.h;
  const cx = px + w / 2;
  ctx.globalAlpha = alpha;

  // ① 罐底阴影 + 基座
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(cx, py + h - 2, w * 0.42, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#2e2418';
  rr(ctx, px + 5, py + h - 11, w - 10, 8, 3); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(px + 9, py + h - 6, w - 18, 0.8);

  // ② 铜色锅炉外壳（卧式圆筒：顶亮底暗渐变）
  const bodyGrad = ctx.createLinearGradient(0, py + 4, 0, py + h - 4);
  bodyGrad.addColorStop(0,    '#c08858');
  bodyGrad.addColorStop(0.5,  '#8a5a30');
  bodyGrad.addColorStop(1,    '#4a2a14');
  ctx.fillStyle = bodyGrad;
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 8); ctx.fill();

  // ③ 焊接筋板 + 圆头铆钉
  // 3 条竖向筋板（将圆筒分为 3 段：左水室 + 中炉膛 + 右水室）
  const segXs = [px + w * 0.30, px + w * 0.50, px + w * 0.70];
  for (const sx of segXs) {
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.fillRect(sx - 0.7, py + 10, 1.4, h - 22);
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(sx + 0.7, py + 10, 0.5, h - 22);
  }
  // 圆头铆钉（每条筋板上下 2 颗）
  const drawRivet = (rx, ry) => {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.arc(rx, ry, 1.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#6a4226';
    ctx.beginPath(); ctx.arc(rx, ry, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,200,140,0.4)';
    ctx.beginPath(); ctx.arc(rx - 0.3, ry - 0.3, 0.5, 0, Math.PI * 2); ctx.fill();
  };
  for (const sx of segXs) {
    drawRivet(sx, py + 11);
    drawRivet(sx, py + h - 12);
  }

  // ④ 顶部烟囱（运转时冒烟）
  const stackX = cx, stackY = py + 2;
  // 烟囱底座
  ctx.fillStyle = '#3a261a';
  rr(ctx, stackX - 5, py + 7, 10, 4, 1); ctx.fill();
  // 烟囱主体
  const stackGrad = ctx.createLinearGradient(stackX - 3.5, 0, stackX + 3.5, 0);
  stackGrad.addColorStop(0,   '#2a1808');
  stackGrad.addColorStop(0.5, '#7a4a30');
  stackGrad.addColorStop(1,   '#2a1808');
  ctx.fillStyle = stackGrad;
  rr(ctx, stackX - 3.5, stackY, 7, 6, 1); ctx.fill();
  // 烟囱顶冠
  ctx.fillStyle = '#7a4830';
  rr(ctx, stackX - 4.5, stackY - 1, 9, 2, 0.5); ctx.fill();
  // 烟囱口
  ctx.fillStyle = '#1a0e04';
  ctx.fillRect(stackX - 2.5, stackY, 5, 0.8);
  // 运转时烟雾（向上飘的小圆 + 散开）
  if (e.lit || e.burning) {
    for (let i = 0; i < 2; i++) {
      const phase = (((G.time || 0) * 0.5) + i * 0.5) % 1;
      ctx.fillStyle = 'rgba(220,210,200,' + (0.35 * (1 - phase)).toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(stackX + Math.sin(phase * 4 + i) * 1.2, stackY - 3 - phase * 6, 1.5 + phase * 1.4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ⑤ 两端水室（深色凹陷 + 蓝色水位显示）
  const drawWaterChamber = (cxL) => {
    const wX = cxL - 10, wY = py + 18, wW = 20, wH = h - 32;
    // 水室外框（深色）
    ctx.fillStyle = '#1a1208';
    rr(ctx, wX, wY, wW, wH, 3); ctx.fill();
    // 玻璃内底
    ctx.save();
    rr(ctx, wX + 1, wY + 1, wW - 2, wH - 2, 2.5); ctx.clip();
    // 底色（深色）
    ctx.fillStyle = 'rgba(8, 12, 18, 0.9)';
    ctx.fillRect(wX + 1, wY + 1, wW - 2, wH - 2);
    // 水位（蓝色渐变，按 water / WATER_CAP 比例从底向上填）
    const wp = Math.max(0, Math.min(1, (e.water || 0) / WATER_CAP));
    if (wp > 0) {
      const wTop = wY + wH - (wH - 2) * wp;
      const wGrad = ctx.createLinearGradient(0, wTop, 0, wY + wH - 1);
      wGrad.addColorStop(0, _boilMix('#3fa0e8', 0.85));
      wGrad.addColorStop(1, _boilMix('#1a5a8a', 0.95));
      ctx.fillStyle = wGrad;
      ctx.fillRect(wX + 1, wTop, wW - 2, wY + wH - 1 - wTop);
      // 水面高光
      ctx.fillStyle = 'rgba(220,240,255,0.5)';
      ctx.fillRect(wX + 1, wTop, wW - 2, 1);
    }
    ctx.restore();
    // 玻璃亮边
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 0.8;
    rr(ctx, wX, wY, wW, wH, 3); ctx.stroke();
    // 玻璃左上高光
    ctx.strokeStyle = 'rgba(255,255,255,0.40)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(wX + 3, wY + 3, wH * 0.32, Math.PI * 1.1, Math.PI * 1.55);
    ctx.stroke();
  };
  drawWaterChamber(px + 16);
  drawWaterChamber(px + w - 16);

  // ⑥ 中央炉膛（深色凹陷 + 玻璃高光 + 炉火）
  const fX = px + w * 0.32, fY = py + 18, fW = w * 0.36, fH = h - 32;
  // 炉膛外框
  ctx.fillStyle = '#1a0e04';
  rr(ctx, fX, fY, fW, fH, 3); ctx.fill();
  // 炉膛内底
  ctx.save();
  rr(ctx, fX + 1, fY + 1, fW - 2, fH - 2, 2.5); ctx.clip();
  ctx.fillStyle = 'rgba(8, 4, 2, 0.9)';
  ctx.fillRect(fX + 1, fY + 1, fW - 2, fH - 2);
  // 炉火（按燃烧强度）
  const fl = 0.55 + Math.sin((G.time || 0) * 10 + px) * 0.25;
  const heat = (e.lit || e.burning) ? (0.55 + fl * 0.35) : 0.10;
  if (heat > 0.15) {
    const fireY = fY + fH - (fH - 2) * heat;
    const fireH = (fH - 2) * heat;
    const fireGrad = ctx.createLinearGradient(0, fireY, 0, fY + fH - 1);
    fireGrad.addColorStop(0,   _boilMix('#fff0a0', 0.95));
    fireGrad.addColorStop(0.4, _boilMix('#ff9a3a', 0.80));
    fireGrad.addColorStop(1,   _boilMix('#c84a18', 0.30));
    ctx.fillStyle = fireGrad;
    ctx.fillRect(fX + 1, fireY, fW - 2, fireH);
    // 表面波纹
    if (e.lit || e.burning) {
      const w1 = Math.sin((G.time || 0) * 6 + px) * 0.8;
      ctx.fillStyle = 'rgba(255,220,120,0.55)';
      ctx.fillRect(fX + 2, fireY + w1, fW - 4, 1);
    }
  }
  ctx.restore();
  // 炉膛亮边
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 0.8;
  rr(ctx, fX, fY, fW, fH, 3); ctx.stroke();
  // 玻璃左上高光
  ctx.strokeStyle = 'rgba(255,255,255,0.40)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(fX + 4, fY + 4, fH * 0.30, Math.PI * 1.1, Math.PI * 1.55);
  ctx.stroke();

  // ⑦ 温度指示（右上角，闪烁色随温度变化）
  const tp = Math.max(0, Math.min(1, (e.temp || 0) / BOILER_TEMP_MAX));
  ctx.fillStyle = tp >= 1 ? '#7fe08f' : (tp > 0.5 ? '#ffd23c' : '#8a93a0');
  ctx.font = 'bold 8px system-ui';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  // 描边
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 2;
  ctx.strokeText(Math.round(e.temp || 0) + '°C', px + w - 8, py + 14);
  ctx.fillText(Math.round(e.temp || 0) + '°C', px + w - 8, py + 14);
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // ⑧ 4 角螺栓
  const drawBolt = (bx, by) => {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.arc(bx, by, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#2a1808';
    ctx.beginPath(); ctx.arc(bx, by, 1.6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,200,140,0.4)';
    ctx.beginPath(); ctx.arc(bx - 0.4, by - 0.4, 0.7, 0, Math.PI * 2); ctx.fill();
  };
  drawBolt(px + 8,        py + 9);
  drawBolt(px + w - 8,     py + 9);
  drawBolt(px + 8,        py + h - 9);
  drawBolt(px + w - 8,     py + h - 9);

  // ⑨ 罐体外框描边
  ctx.strokeStyle = '#1a0e04';
  ctx.lineWidth = 2.2;
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 8); ctx.stroke();
  // 顶部圆弧高光
  ctx.strokeStyle = 'rgba(255,200,140,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, py + 4, w * 0.32, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();

  // 端口沿用旧 drawPort 约定：左水口（北/西） + 右水口（北/东） + 底汽口
  const pL = rotCell(e, 0, 1), pR = rotCell(e, e.def.w - 1, 1), pS = rotCell(e, e.def.w >> 1, e.def.h - 1);
  const _d = e.dir | 0;
  const cD = TILE / 2 - 1;
  const _wSide = rotSide(2, _d);
  const _eSide = rotSide(0, _d);
  drawPort(ctx, pL.x * TILE + TILE / 2, pL.y * TILE + TILE / 2, _wSide, PORT_WATER, false, 0, cD, 'water', 'both');
  drawPort(ctx, pR.x * TILE + TILE / 2, pR.y * TILE + TILE / 2, _eSide, PORT_WATER, false, 0, cD, 'water', 'both');
  drawPort(ctx, pS.x * TILE + TILE / 2, pS.y * TILE + TILE / 2, rotSide(1, _d), PORT_STEAM, true, 0, cD, 'steam', 'out');

  ctx.globalAlpha = 1;
}
function _boilMix(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + t.toFixed(3) + ')';
}

// ===== 面板 =====
function boilerPanelHtml(e) {
  // 燃料/水/蒸汽统一用组装机风格插槽展示
  const fuelObj = {};
  if (e.fuelRocket > 0) fuelObj['rocket-fuel'] = e.fuelRocket;
  if (e.fuelSolid > 0) fuelObj['solid-fuel'] = e.fuelSolid;
  if (e.fuelCoal > 0) fuelObj['coal'] = e.fuelCoal;
  if (e.fuelWood > 0) fuelObj['wood'] = e.fuelWood;
  let h = row('燃料', Object.keys(fuelObj).length ? '<div class="asm3-inp-row">' + itemSlotsHtml(fuelObj, { action: 'display' }) + '</div>' : '<span class="dim">无</span>', 'fuel');
  if (invCount('coal') > 0)
    h += '<button data-action="fuel" data-id="coal">加 5 煤 (' + invCount('coal') + ')</button>';
  if (invCount('wood') > 0)
    h += '<button data-action="fuel" data-id="wood">加 5 木材 (' + invCount('wood') + ')</button>';
  if (invCount('solid-fuel') > 0)
    h += '<button data-action="fuel" data-id="solid-fuel">加 5 固体燃料 (' + invCount('solid-fuel') + ')</button>';
  if (invCount('rocket-fuel') > 0)
    h += '<button data-action="fuel" data-id="rocket-fuel">加 5 火箭燃料 (' + invCount('rocket-fuel') + ')</button>';
  h += row('水', e.water >= 1 ? '<div class="asm3-inp-row">' + itemSlotsHtml({ water: Math.floor(e.water) }, { action: 'display' }) + '</div>' : '<span class="dim">空</span>', 'water');
  if (invCount('water') > 0)
    h += '<button data-action="feed" data-id="water">注入全部存水</button>';
  h += row('蒸汽缓存', e.steamBuf >= 1 ? '<div class="asm3-inp-row">' + itemSlotsHtml({ steam: Math.floor(e.steamBuf) }, { action: 'display' }) + '</div>' : '<span class="dim">空</span>', 'steam');
  h += row('温度', '', 'temp');
  h += '<div class="dim">供电链：抽水机 → 管道 → 锅炉两端蓝口水口（左右互通、双向进出、水位自动平衡，可一端进另一端出、多台串联）；加煤烧出的蒸汽从底边中间白口送往下方蒸汽机，也可经蒸汽管道远送。</div>';
  return h;
}
function boilerPanelLive(e, api) {
  const fuelObj = {};
  if (e.fuelRocket > 0) fuelObj['rocket-fuel'] = e.fuelRocket;
  if (e.fuelSolid > 0) fuelObj['solid-fuel'] = e.fuelSolid;
  if (e.fuelCoal > 0) fuelObj['coal'] = e.fuelCoal;
  if (e.fuelWood > 0) fuelObj['wood'] = e.fuelWood;
  api.set('fuel', Object.keys(fuelObj).length ? '<div class="asm3-inp-row">' + itemSlotsHtml(fuelObj, { action: 'display' }) + '</div>' : dimSpan('无'));
  api.set('water', e.water >= 1 ? '<div class="asm3-inp-row">' + itemSlotsHtml({ water: Math.floor(e.water) }, { action: 'display' }) + '</div>' : dimSpan('空'));
  api.set('steam', e.steamBuf >= 1 ? '<div class="asm3-inp-row">' + itemSlotsHtml({ steam: Math.floor(e.steamBuf) }, { action: 'display' }) + '</div>' : dimSpan('空'));
  api.set('temp', Math.round(e.temp) + ' / ' + BOILER_TEMP_MAX + ' °C');
  api.prog(e.temp / BOILER_TEMP_MAX * 100);
  if (e.steamBuf >= WATER_CAP - 0.01) api.status('已暂停：蒸汽憋满，等待蒸汽机/管道消耗', 'warn');
  else if (e.burning) api.status('产汽中（耗煤+水）', 'ok');
  else if (e.water < 1) api.status('已暂停：缺水（检查左右两端水口/管道供水）', 'bad');
  else if (e.fuelCoal <= 0 && e.fuelSolid <= 0 && e.fuelRocket <= 0 && e.burnLeft <= 0) api.status('已暂停：无燃料', 'bad');
  else api.status('已暂停：待机', 'warn');
}
function boilerTip(e) {
  return e.burning ? '产汽中 ' + Math.round(e.temp) + '°C（存汽' + Math.floor(e.steamBuf || 0) + '）'
    : e.steamBuf >= WATER_CAP - 0.01 ? '蒸汽憋满·等待消耗'
    : e.water < 1 ? '缺水（检查左右两端蓝口水口/管道）'
    : (e.fuelCoal <= 0 && e.fuelSolid <= 0 && e.fuelRocket <= 0 && e.burnLeft <= 0) ? '无燃料' : '待机';
}

// ===== 注册 =====
ENT_CLASSES['boiler'] = Boiler;
DEVICE_RENDER['boiler'] = drawBoiler;
DEVICE_STATUS['boiler'] = e => e.burning ? 'g' : (e.steamBuf >= WATER_CAP - 0.01 ? 'y' : 'r');
DEVICE_PANEL['boiler'] = { html: boilerPanelHtml, live: boilerPanelLive, tip: boilerTip };
DEVICE_DIR_ROTATE['boiler'] = true;
// 显示详情时，各接口图标所在世界格 + 对应流体名（用于鼠标悬停显示流体名称）
DEVICE_FLUID_ICONS['boiler'] = e => {
  const pL = rotCell(e, 0, 1), pR = rotCell(e, e.def.w - 1, 1), pS = rotCell(e, e.def.w >> 1, e.def.h - 1);
  return [
    { x: pL.x, y: pL.y, fluid: 'water' },
    { x: pR.x, y: pR.y, fluid: 'water' },
    { x: pS.x, y: pS.y, fluid: 'steam' }
  ];
};
