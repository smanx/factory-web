'use strict';

// ===== 采矿机粒子（画面优化）：工作时扬尘 =====
function drillEmit(e, dt) {
  if (typeof spawnSmoke !== 'function') return;
  const key = 'd' + e.x + ',' + e.y;
  if (!G.entFxTimer) G.entFxTimer = {};
  G.entFxTimer[key] = (G.entFxTimer[key] || 0) + dt;
  if (G.entFxTimer[key] < 0.3) return;
  G.entFxTimer[key] = 0;
  const cx = (e.x + 0.5) * TILE;
  const cy = (e.y + 0.7) * TILE;
  spawnSmoke(cx + (Math.random() - 0.5) * e.w * TILE * 0.5, cy, { size: 3, color: '#8a7a6a' });
}

// ===== 热能采矿机（采矿业基类；电采矿机/抽油机继承自 ElectricDrill）=====
class Drill extends Entity {
  constructor(type, x, y) {
    super(type || 'burner-mining-drill', x, y);
    this.fuelCoal = 0;
    this.fuelSolid = 0;
    this.fuelRocket = 0;
    this.fuelWood = 0;
    this.burnLeft = 0;
    this.burnCap = 0;      // 当前燃烧燃料的满能量（燃料消耗指示用）
    this.burnType = '';    // 当前燃烧燃料类型（coal/wood/solid-fuel/rocket-fuel）
    this.bufItem = null;
    this.buf = 0;
    this.prog = 0;
    this.working = false;
    this.status = '';
    this.spin = 0;
  }
  // 可开采的矿石索引：普通矿 0-4 + 铀矿 6 + 小行星 7 + 祝融钨矿 8 + 雷神钬矿 9（原油 5 由抽油机专用）。
  minableOreType(ti) { return isOreType(ti); }
  oreTile() {
    for (let dy = 0; dy < this.h; dy++)
      for (let dx = 0; dx < this.w; dx++) {
        const tx = this.x + dx, ty = this.y + dy;
        const ti = getOreType(tx, ty);
        if (this.minableOreType(ti) && getOreAmt(tx, ty) > 0) return [tx, ty];
      }
    return null;
  }
  mineItem(o) {
    const ti = getOreType(o[0], o[1]);
    // 小行星碎块矿床：按矿点坐标确定性返回同一种星块（金属/碳质/氧化），保证采矿机缓冲单类型
    if (ti === ORE_ASTEROID) return asteroidChunkFor(o[0], o[1]);
    return oreItemId(ti);
  }
  // 当前矿石的采矿时间（对齐《异星工厂》每种资源独立 mining_time）：无矿时用默认 DRILL_TIME。
  oreTime() {
    const o = this.oreTile();
    if (!o) return DRILL_TIME;
    return oreMiningTime(this.mineItem(o));
  }
  frontTargets() {
    const res = [];
    if (this.dir === 0) for (let dy = 0; dy < this.h; dy++) res.push([this.x + this.w, this.y + dy]);
    else if (this.dir === 2) for (let dy = 0; dy < this.h; dy++) res.push([this.x - 1, this.y + dy]);
    else if (this.dir === 1) for (let dx = 0; dx < this.w; dx++) res.push([this.x + dx, this.y + this.h]);
    else for (let dx = 0; dx < this.w; dx++) res.push([this.x + dx, this.y - 1]);
    return res;
  }
  update(dt) {
    this.working = false;
    if (this.bufN === undefined) { this.bufN = 0; }
    if (this.buf > 0) this.tryOutput();
    const o = this.oreTile();
    if (!o) { this.status = '无矿'; this.spin = 0; return; }
    if (this.buf >= DRILL_BUFFER_CAP) { this.status = '缓存已满'; this.spin = 0; return; }
    if (this.burnLeft <= 0) {
      if (this.fuelRocket > 0) {
        this.fuelRocket--;
        if (typeof trackProd === 'function') trackProd('rocket-fuel', -1);
        this.burnLeft += ROCKET_FUEL_ENERGY;
        this.burnCap = ROCKET_FUEL_ENERGY; this.burnType = 'rocket-fuel';
      } else if (this.fuelSolid > 0) {
        this.fuelSolid--;
        if (typeof trackProd === 'function') trackProd('solid-fuel', -1);
        this.burnLeft += SOLID_FUEL_ENERGY;
        this.burnCap = SOLID_FUEL_ENERGY; this.burnType = 'solid-fuel';
      } else if (this.fuelCoal > 0) {
        this.fuelCoal--;
        if (typeof trackProd === 'function') trackProd('coal', -1);
        this.burnLeft += COAL_ENERGY;
        this.burnCap = COAL_ENERGY; this.burnType = 'coal';
      } else if (this.fuelWood > 0) {
        this.fuelWood--;
        if (typeof trackProd === 'function') trackProd('wood', -1);
        this.burnLeft += WOOD_FUEL_ENERGY;
        this.burnCap = WOOD_FUEL_ENERGY; this.burnType = 'wood';
      }
      else { this.status = '缺燃料'; this.spin = 0; return; }
    }
    this.status = '';
    this.working = true;
    drillEmit(this, dt);
    // 采矿机运转环境音（仅屏内可见时播放，限频避免音爆）
    if (typeof onScreen === 'function' && onScreen(this) && typeof playSfx === 'function' && G.settings.sound) {
      this._runSfxT = (this._runSfxT || 0) - dt;
      if (this._runSfxT <= 0) { this._runSfxT = 2.2; playSfx('machine-run'); }
    }
    // 燃烧速率 = 热能采矿机官方功率 150kW，使一块燃料燃烧时长 = 热值÷功率，对齐官方
    this.burnLeft -= dt * fuelConsumptionMult() * burnPowerMW('burner-mining-drill');
    this.spin += dt * 6;
    // 热能采矿机 mining-speed 0.25（对齐《异星工厂》官方 mining_speed）；每采 1 个矿需累计到该矿石的采矿时间
    this.prog += dt * drillMult() * (GAME_DATA.deviceStats?.[this.type]?.miningSpeed ?? 0.25) * (this.quality ? qualityMult(this.quality) : 1);
    const mt = this.oreTime(); // 当前矿石的采矿时间（铁/铜/煤/石 2s、铀矿 4s，对齐《异星工厂》mining_time）
    if (this.prog >= mt) {
      this.prog -= mt;
      if (!G.settings.infiniteOre) this.consumeOreDrain(o[0], o[1]);
      const mined = this.mineItem(o);
      // 采矿产物统一进入「产物缓冲」（煤炭也按普通产物处理），与「燃料槽」完全分离：
      // 燃料是玩家/机械臂单独放入的，二者互不混取——取燃料不会带走产物，取产物也不影响燃料。
      if (this.prodAccum === undefined) this.prodAccum = 0;
      this.prodAccum += (miningProdMult() - 1);
      const bonus = Math.floor(this.prodAccum);
      if (bonus > 0) this.prodAccum -= bonus;
      this.bufItem = mined;
      // 实采的 1 个矿必定入缓冲（到此处 buf < 上限，必有空位）；免费额外产出受缓冲容量限制
      let added = 1;
      if (bonus > 0) {
        const space = DRILL_BUFFER_CAP - this.buf - 1;
        const bonusAdd = Math.min(bonus, Math.max(0, space));
        this.prodAccum += (bonus - bonusAdd);
        this.buf += 1 + bonusAdd;
        added += bonusAdd;
      } else {
        this.buf += 1;
      }
      if (typeof trackProd === 'function') trackProd(mined, added);
      this.tryOutput();
    }
  }
  tryOutput() {
    let guard = 0;
    while (this.buf > 0 && this.bufItem && guard++ < 40) {
      let sent = false;
      for (const [fx, fy] of this.frontTargets()) {
        const t = entAt(fx, fy);
        if (!t) continue;
        if (t instanceof Belt && !(t instanceof Splitter)) {
          if (t.acceptItem(this.bufItem, this.dir)) { this.buf--; sent = true; break; }
        } else if (typeof PipeToGround !== 'undefined' && t instanceof PipeToGround) {
          // 地下管道：仅当矿机/油井位于其管口（dir 反向）侧才可把流体排入
          const mx = t.x - DX[t.dir], my = t.y - DY[t.dir];
          if ((mx === fx && my === fy) && t.giveItem(this.bufItem)) { this.buf--; sent = true; break; }
        } else if (!(t instanceof Underground) && !(t instanceof Inserter) && !(t instanceof Splitter) && !(t instanceof Drill) && t.giveItem(this.bufItem)) {
          this.buf--; sent = true; break;
        }
      }
      if (!sent) break;
    }
  }
  giveItem(item) {
    // 燃料槽容量 = 该燃料一整组的上限（对齐堆叠上限）：玩家可手动放进一整组；
    // 机械臂则受 inserter.js 中「补到 5 个即停」限制，故手动可加满、机械臂只补 5。
    if (item === 'rocket-fuel' && this.fuelRocket < stackSize('rocket-fuel')) { this.fuelRocket++; return true; }
    if (item === 'coal' && this.fuelCoal < stackSize('coal')) { this.fuelCoal++; return true; }
    if (item === 'wood' && this.fuelWood < stackSize('wood')) { this.fuelWood++; return true; }
    if (item === 'solid-fuel' && this.fuelSolid < stackSize('solid-fuel')) { this.fuelSolid++; return true; }
    return false;
  }
  peekItem() {
    return (this.buf > 0 && this.bufItem) ? this.bufItem : null;
  }
  takeItem() {
    if (this.buf > 0 && this.bufItem) {
      this.buf--;
      const it = this.bufItem;
      return it;
    }
    return null;
  }
  countOf(item) { return (this.bufItem === item && this.buf > 0) ? this.buf : 0; }
  takeItemOf(item) {
    if (this.bufItem === item && this.buf > 0) { this.buf--; return item; }
    return null;
  }
  contents() {
    const list = [[this.type, 1]];
    if (this.fuelRocket > 0) list.push(['rocket-fuel', this.fuelRocket]);
    if (this.fuelSolid > 0) list.push(['solid-fuel', this.fuelSolid]);
    if (this.fuelCoal > 0) list.push(['coal', this.fuelCoal]);
    if (this.fuelWood > 0) list.push(['wood', this.fuelWood]);
    if (this.bufN > 0 && this.bufItem) list.push([this.bufItem, this.bufN]);
    return list;
  }
  // 面板"取出全部"：清空矿物缓存
  takeAll() {
    if (this.buf > 0 && this.bufItem) {
      const rows = [[this.bufItem, this.buf]];
      this.buf = 0;
      return rows;
    }
    return [];
  }
  // R 旋转后立即尝试朝新方向输出
  onRotate() { this.tryOutput(); }
  // 数据单源化：高品质采矿机按官方 mining_drill_resource_drain_multiplier 减少矿脉损耗
  // （官方：uncommon 0.833 / rare 0.667 / epic 0.5 / legendary 0.167，即同样矿脉能采更多矿）。
  // 矿脉按整数消耗，这里用累积量（_drainAcc）把“少耗”累积成整数后统一减少，
  // 保证长期平均矿脉损耗与官方 multiplier 一致（如 legendary 平均每 1/0.167≈6 次采矿耗 1）。
  consumeOreDrain(tx, ty) {
    const mult = (typeof qualityMiningDrillDrainMult === 'function') ? qualityMiningDrillDrainMult(this.quality) : 1;
    this._drainAcc = (this._drainAcc || 0) + mult;
    if (this._drainAcc < 1) return;            // 尚未攒够，本次采矿不耗矿脉（官方少耗）
    const n = Math.floor(this._drainAcc);
    this._drainAcc -= n;
    for (let i = 0; i < n; i++) consumeOre(tx, ty);
  }
  serialize() {
    const s = super.serialize();
    s.fuelCoal = this.fuelCoal; s.fuelSolid = this.fuelSolid; s.fuelRocket = this.fuelRocket; s.fuelWood = this.fuelWood; s.burnLeft = this.burnLeft;
    s.bufItem = this.bufItem; s.buf = this.buf; s.prog = this.prog;
    s.burnCap = this.burnCap; s.burnType = this.burnType;
    s.drainAcc = this._drainAcc || 0;
    return s;
  }
  static restore(s) {
    const d = super.restore(s);
    d.fuelCoal = s.fuelCoal || 0; d.fuelSolid = s.fuelSolid || 0; d.fuelRocket = s.fuelRocket || 0; d.fuelWood = s.fuelWood || 0; d.burnLeft = s.burnLeft || 0;
    d.bufItem = s.bufItem || null; d.buf = s.buf || 0; d.prog = s.prog || 0;
    d.burnCap = s.burnCap || 0; d.burnType = s.burnType || '';
    d._drainAcc = s.drainAcc || 0;
    return d;
  }
}

// ===== 热能采矿机专属渲染（铜色旧工业风 + 顶部小烟囱 + 旋转钻头）=====
// 区别于共享 drawDrill（电采矿机/抽油机共用），给最基础的"烧煤钻"一个更立体的造型。
// 视觉分区（自下而上）：
//   ① 罐底阴影 + 厚钢基座  ② 铜色主体（顶亮底暗渐变）
//   ③ 焊接筋板  ④ 顶部小烟囱（运转时冒烟）
//   ⑤ 内部炉口（运转时透出橙红火光）  ⑥ 中央旋转钻头（向下钻入地面）
//   ⑦ 侧向输出箭头（按 dir 旋转）  ⑧ 燃料条  ⑨ 状态 LED
//   ⑩ 4 角螺栓  ⑪ 罐体外框
function drawBurnerDrill(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w, sh = TILE * e.h;
  const cx = px + s / 2;
  ctx.globalAlpha = alpha;
  const working = e.working;
  const fl = 0.55 + Math.sin((G.time || 0) * 10 + px) * 0.25;

  // ① 罐底阴影 + 厚钢基座
  ctx.fillStyle = 'rgba(0,0,0,0.32)';
  ctx.beginPath();
  ctx.ellipse(cx, py + sh - 2, s * 0.42, 4, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#1a0e08';
  rr(ctx, px + 3, py + sh - 9, s - 6, 6, 2); ctx.fill();
  ctx.strokeStyle = 'rgba(255,200,140,0.12)';
  ctx.lineWidth = 0.6;
  rr(ctx, px + 3, py + sh - 9, s - 6, 6, 2); ctx.stroke();
  // 基座安装螺栓
  const baseBolt = (bx, by) => {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.arc(bx, by, 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a261a';
    ctx.beginPath(); ctx.arc(bx, by, 0.9, 0, Math.PI * 2); ctx.fill();
  };
  baseBolt(px + 6,     py + sh - 6);
  baseBolt(px + s - 6, py + sh - 6);

  // ② 铜色主体（顶亮底暗渐变，模拟旧工业铜壳）
  const bodyGrad = ctx.createLinearGradient(0, py + 6, 0, py + sh - 12);
  bodyGrad.addColorStop(0,    '#b8703c');
  bodyGrad.addColorStop(0.5,  '#8a4a22');
  bodyGrad.addColorStop(1,    '#5a3018');
  ctx.fillStyle = bodyGrad;
  rr(ctx, px + 3, py + 7, s - 6, sh - 19, 6); ctx.fill();

  // ③ 焊接筋板（左右各 1 条）
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(px + s * 0.20, py + 14, 1.4, sh - 32);
  ctx.fillRect(px + s * 0.80 - 1.4, py + 14, 1.4, sh - 32);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(px + s * 0.20 + 1.4, py + 14, 0.5, sh - 32);
  ctx.fillRect(px + s * 0.80 - 0.5, py + 14, 0.5, sh - 32);

  // ④ 顶部小烟囱（运转时冒烟）
  const stackX = cx, stackY = py + 2;
  // 烟囱底座
  ctx.fillStyle = '#2a1808';
  rr(ctx, stackX - 4, py + 7, 8, 3, 0.8); ctx.fill();
  // 烟囱主体
  const stackGrad = ctx.createLinearGradient(stackX - 3, 0, stackX + 3, 0);
  stackGrad.addColorStop(0,   '#2a1808');
  stackGrad.addColorStop(0.5, '#7a4a30');
  stackGrad.addColorStop(1,   '#2a1808');
  ctx.fillStyle = stackGrad;
  rr(ctx, stackX - 3, stackY, 6, 6, 1); ctx.fill();
  // 烟囱顶冠
  ctx.fillStyle = '#7a4830';
  rr(ctx, stackX - 4, stackY - 1, 8, 2, 0.5); ctx.fill();
  // 烟囱口
  ctx.fillStyle = '#1a0e04';
  ctx.fillRect(stackX - 2, stackY, 4, 0.8);
  // 运转时烟雾（向上飘的小圆）
  if (working) {
    const phase = ((G.time || 0) * 0.6) % 1;
    ctx.fillStyle = 'rgba(200,180,160,' + (0.4 * (1 - phase)).toFixed(2) + ')';
    ctx.beginPath();
    ctx.arc(stackX + Math.sin(phase * 4) * 1.2, stackY - 3 - phase * 7, 1.5 + phase * 1.5, 0, Math.PI * 2);
    ctx.fill();
    if (phase > 0.3) {
      ctx.fillStyle = 'rgba(180,160,140,' + (0.3 * (1 - phase)).toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(stackX - 1 + Math.cos(phase * 3) * 1.5, stackY - 5 - (phase - 0.3) * 6, 1.2 + (phase - 0.3) * 1.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // ⑤ 内部炉口（运转时透出橙红火光）
  if (e.burnLeft > 0) {
    const fireX = cx - 6, fireY = py + sh - 18, fireW = 12, fireH = 4;
    // 炉口外框
    ctx.fillStyle = '#1a0e04';
    rr(ctx, fireX, fireY, fireW, fireH, 1.2); ctx.fill();
    // 火焰
    const fireGrad = ctx.createLinearGradient(0, fireY, 0, fireY + fireH);
    fireGrad.addColorStop(0,   'rgba(255,210,90,' + (fl * 0.95).toFixed(2) + ')');
    fireGrad.addColorStop(0.5, 'rgba(255,130,50,' + (fl * 0.75).toFixed(2) + ')');
    fireGrad.addColorStop(1,   'rgba(200,60,20,'  + (fl * 0.35).toFixed(2) + ')');
    ctx.fillStyle = fireGrad;
    rr(ctx, fireX + 0.5, fireY + 0.5, fireW - 1, fireH - 1, 0.8); ctx.fill();
    // 火焰表面波纹
    if (working) {
      const w1 = Math.sin((G.time || 0) * 6 + px) * 0.6;
      ctx.fillStyle = 'rgba(255,240,160,0.55)';
      ctx.fillRect(fireX + 1, fireY + w1, fireW - 2, 0.8);
    }
  }

  // ⑥ 中央旋转钻头（垂直向下，工作时绕中心轴旋转；待机时灰色静止）
  const drillCx = cx, drillCy = py + sh - 16;
  // 钻头固定卡座
  ctx.fillStyle = '#2a1808';
  rr(ctx, drillCx - 6, drillCy - 3, 12, 5, 1.5); ctx.fill();
  ctx.strokeStyle = 'rgba(255,200,140,0.2)';
  ctx.lineWidth = 0.6;
  rr(ctx, drillCx - 6, drillCy - 3, 12, 5, 1.5); ctx.stroke();
  // 钻头本体
  ctx.save();
  ctx.translate(drillCx, drillCy);
  if (working) ctx.rotate(e.spin || 0);
  // 钻头金属色（运转时亮灰、待机时暗灰）
  ctx.fillStyle = working ? '#c4ccd8' : '#6a7280';
  // 钻头刃（三刃螺旋形：菱形 + 两侧刃）
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-4, 0);
  ctx.lineTo(0, 8);
  ctx.lineTo(4, 0);
  ctx.closePath();
  ctx.fill();
  // 钻头高光（左侧刃）
  ctx.fillStyle = working ? 'rgba(255,255,255,0.45)' : 'rgba(255,255,255,0.18)';
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-1.5, 0);
  ctx.lineTo(0, 6);
  ctx.closePath();
  ctx.fill();
  // 钻头中线
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(0, 8);
  ctx.stroke();
  ctx.restore();

  // ⑦ 侧向输出箭头（按 dir 旋转；上下 2 支表示"此方向出料"）
  ctx.save();
  ctx.translate(cx, py + sh / 2 - 4);
  ctx.rotate(dir * Math.PI / 2);
  for (const m of [-7, 7]) {
    ctx.save();
    ctx.translate(s / 2 - 7, m);
    ctx.fillStyle = dirColorNotch(dir);
    tri(ctx, 0, -3, 0, 3, 6, 0);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();

  // ⑧ 燃料条（顶部，居中偏上显示 burnLeft / COAL_ENERGY 比例）
  const fuelY = py + 16;
  const fuelW = s - 16;
  ctx.fillStyle = '#20242b';
  rr(ctx, px + 8, fuelY, fuelW, 4, 1.5); ctx.fill();
  const fuelPct = Math.min(1, e.burnLeft / COAL_ENERGY);
  ctx.fillStyle = fuelPct > 0 ? '#e8762c' : '#c33';
  rr(ctx, px + 8, fuelY, fuelW * fuelPct, 4, 1.5); ctx.fill();
  // 燃料条高光
  if (fuelPct > 0) {
    ctx.fillStyle = 'rgba(255,255,255,0.30)';
    ctx.fillRect(px + 9, fuelY, fuelW * fuelPct - 2, 1);
  }

  // ⑨ 状态 LED（右上角小灯）
  const ledX = px + s - 8, ledY = py + 10;
  let ledC, ledOn = false;
  if (e.status) { ledC = '#ffb04a'; ledOn = true; }       // 缺料/缺燃料 → 橙色
  else if (working) { ledC = '#9ce06c'; ledOn = true; }   // 工作中 → 绿色
  else { ledC = '#5a3018'; ledOn = false; }               // 待机 → 暗
  ctx.fillStyle = ledC;
  ctx.beginPath(); ctx.arc(ledX, ledY, 1.8, 0, Math.PI * 2); ctx.fill();
  if (ledOn) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.arc(ledX - 0.4, ledY - 0.5, 0.6, 0, Math.PI * 2); ctx.fill();
  }

  // ⑩ 角部螺栓（4 角）
  const drawBolt = (bx, by) => {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.arc(bx, by, 1.7, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a0e08';
    ctx.beginPath(); ctx.arc(bx, by, 1.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,200,120,0.4)';
    ctx.beginPath(); ctx.arc(bx - 0.3, by - 0.3, 0.5, 0, Math.PI * 2); ctx.fill();
  };
  drawBolt(px + 6,     py + 9);
  drawBolt(px + s - 6, py + 9);
  drawBolt(px + 6,     py + sh - 12);
  drawBolt(px + s - 6, py + sh - 12);

  // ⑪ 罐体外框描边
  ctx.strokeStyle = '#1a0e08';
  ctx.lineWidth = 2;
  rr(ctx, px + 3, py + 7, s - 6, sh - 19, 6); ctx.stroke();
  // 顶部圆弧高光
  ctx.strokeStyle = 'rgba(255,200,140,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(cx, py + 8, s * 0.30, Math.PI * 1.05, Math.PI * 1.95);
  ctx.stroke();

  ctx.globalAlpha = 1;
}

// ===== 渲染（热能/电采矿机/抽油机共用同一绘制，按 type 换色）=====
function drawDrill(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w;
  const sh = TILE * e.h;
  const electric = e.type === 'electric-mining-drill' || e.type === 'pumpjack';
  const pump = e.type === 'pumpjack';
  const bodyC = pump ? '#2f5a56' : electric ? '#3b5a8c' : '#6e4630';
  const bodyC2 = pump ? '#3d726d' : electric ? '#4d6ea8' : '#8a5a3e';
  const lineC = pump ? '#1b3c39' : electric ? '#223a60' : '#43291b';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = bodyC;
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 8);
  ctx.fill();
  ctx.strokeStyle = lineC;
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 8);
  ctx.stroke();
  ctx.fillStyle = bodyC2;
  rr(ctx, px + 10, py + 10, s - 20, sh - 20, 5);
  ctx.fill();
  const cx = px + s / 2, cy = py + s / 2 - 4;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(e.spin || 0);
  ctx.fillStyle = e.working ? '#c9d2dc' : '#7d8894';
  gearShape(ctx, 0, 0, 13, 8.5, 7);
  ctx.fill();
  ctx.restore();
  const pct = Math.min(1, (e.prog || 0) / e.oreTime());
  if (pct > 0 && e.working && portDetailsVisible()) {
    ctx.strokeStyle = 'rgba(143,224,143,.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 19, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
    ctx.stroke();
  }
  // 抽油机不画正面的两个方向指示箭头（去掉某一边中间的两个箭头），其余采矿机保留
  if (!pump) {
    ctx.fillStyle = dirColorNotch(dir);
    for (const m of [-11, 11]) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(dir * Math.PI / 2);
      ctx.translate(s / 2 - 12, m);
      tri(ctx, 0, -4, 0, 4, 8, 0);
      ctx.fill();
      ctx.restore();
    }
  }
  if (!electric) {
    const fuelPct = Math.min(1, e.burnLeft / COAL_ENERGY);
    ctx.fillStyle = '#20242b';
    rr(ctx, px + 10, py + s - 12, s - 20, 5, 2); ctx.fill();
    ctx.fillStyle = fuelPct > 0 ? '#e8762c' : '#c33';
    rr(ctx, px + 10, py + s - 12, (s - 20) * fuelPct, 5, 2); ctx.fill();
  } else if (e.working) {
    ctx.fillStyle = 'rgba(143,224,255,.7)';
    rr(ctx, px + 10, py + s - 12, s - 20, 5, 2); ctx.fill();
  }
  if (e.status) {
    ctx.fillStyle = '#ffd23c';
    ctx.fillRect(px + s - 14, py + 8, 5, 5);
  }
  // 抽油机原油输出口：画在实际排出的那个角落出口（一格一接口），并用蓝色箭头标注流出方向
  if (pump) {
    drawPort(ctx, px + s / 2, py + s / 2, dir, PORT_OUTPUT, false, 1, s / 2, 'crude-oil', 'out');
  }
  // 电采矿机硫酸接入口：除矿物出口方向外，其余 3 个方向的正中间均可接入管道（输入绿）
  if (electric && !pump) {
    for (const sd of [(dir + 1) % 4, (dir + 2) % 4, (dir + 3) % 4]) {
      drawPort(ctx, px + s / 2, py + s / 2, sd, PORT_INPUT, false, 0, s / 2, 'sulfuric-acid', 'in');
    }
  }
  ctx.globalAlpha = 1;
}

// ===== 放置规则：脚印范围内必须压到普通矿（抽油机的原油规则在 pumpjack.js）=====
function drillNeedsOre(type, tx, ty, dir, ew, eh) {
  let hasOre = false;
  for (let dy = 0; dy < eh && !hasOre; dy++)
    for (let dx = 0; dx < ew && !hasOre; dx++) {
      const ti = getOreType(tx + dx, ty + dy);
      if (isOreType(ti)) hasOre = true;
    }
  return hasOre ? null : { ok: false };
}

// ===== 采矿机面板（对齐组装机/熔炉样式；外壳的「状态点 + 机器图标 + 采矿进度条」由通用外壳提供）=====
// 面板内容自上而下（装备类型不同，第三行各异）：
//   ① 燃料行（热能采矿机）：单格燃料槽（选择燃料）+ 当前燃烧燃料的燃烧进度条；
//      电力采矿机则显示模块插槽（含槽位数量）。
//   ② 矿业品缓存：已开采产物，可一键取回。
function _drillCurrentFuel(e) {
  if (e.fuelRocket > 0) return 'rocket-fuel';
  if (e.fuelSolid > 0) return 'solid-fuel';
  if (e.fuelCoal > 0) return 'coal';
  if (e.fuelWood > 0) return 'wood';
  return null;
}
// ===== 燃料行：单格燃料槽 + 独立燃料燃烧进度条（蓝色，区分于冶炼进度）=====
// 返回供 .fuel-row 使用的内部内容（左侧燃料格 + 右侧蓝色燃料进度条），燃料槽可点选/拖放燃料。
function _drillFuelRowHtml(e) {
  const FIELD = { coal: 'fuelCoal', wood: 'fuelWood', 'solid-fuel': 'fuelSolid', 'rocket-fuel': 'fuelRocket' };
  const fid = _drillCurrentFuel(e);
  let cell;
  if (fid) {
    const n = e[FIELD[fid]] || 0;
    const tip = ITEMS[fid].name + '（燃料，当前 ' + n + '）|点击可拿起放到背包/其他格；只能放入煤/木材/固体燃料/火箭燃料';
    cell = '<div class="mch-io-slot" data-action="feed-fuel" data-id="' + fid + '" data-tip="' + tip + '">' +
      '<img src="' + iconDataURL(fid) + '"><span class="mch-io-n">' + n + '</span></div>';
  } else {
    cell = '<div class="mch-io-slot" data-action="feed-fuel" data-tip="燃料槽（空）|只能放入燃料：把煤/木材/固体燃料/火箭燃料拖入此格燃烧，点击左栏燃料可加入"></div>';
  }
  // 燃料燃烧进度：按当前正在燃烧的那一份燃料热值计算剩余能量（蓝色进度条，走完即消耗掉该份燃料）
  const cap = e.burnCap > 0 ? e.burnCap : (fid ? fuelEnergy(fid) : COAL_ENERGY);
  const fuelPct = Math.max(0, Math.min(100, e.burnLeft / cap * 100));
  const bar = '<div class="fuel-bar drill-fuel-bar"><i style="width:' + fuelPct.toFixed(1) + '%;background:linear-gradient(90deg,#3a9ef5,#6cc0ff)"></i></div>';
  return '<div class="fuel-row">' + cell + bar + '</div>';
}
// ===== 产物格（流程行最右侧：空格也显示槽位；有产物时点击拿起，可放入背包）=====
function _drillProductCellHtml(e) {
  if (e.buf > 0 && e.bufItem) {
    return '<div class="mch-io-slot" data-action="drill-take" data-id="' + e.bufItem + '" data-tip="' + ITEMS[e.bufItem].name + '|已开采缓存 ' + e.buf + '，点击拿起（可放入背包）">' +
      '<img src="' + iconDataURL(e.bufItem) + '"><span class="mch-io-n">' + e.buf + '</span></div>';
  }
  return '<div class="mch-io-slot" data-tip="产物格（空）|开采出的产物将显示于此，有产物时点击拿起（可放入背包）"></div>';
}

// ===== 热能采矿机面板（精简版）=====
// 只保留进度条与格子：① 第一行 = 采矿进度条（左）+ 产物格（右）；
//          ② 第二行 = 燃料格（左）+ 蓝色燃料燃烧进度条（右）。其余文字/按钮全部移除。
function burnerDrillPanelHtml(e) {
  let h = '';
  // 第一行：左侧采矿进度条 + 右侧产物格（产物可点击取回）
  h += '<div class="asm3-flow">';
  h += '<div class="asm3-prog"><div class="bar"><i></i><span class="bar-txt" data-live="mch-pct">0%</span></div></div>';
  h += '<div class="asm3-side asm3-out"><div data-live="drill-buffer">' + _drillProductCellHtml(e) + '</div></div>';
  h += '</div>';
  // 第二行：左侧燃料格 + 右侧蓝色燃料燃烧进度条
  h += '<div class="fuel-row" data-live="drill-fuel">' + _drillFuelRowHtml(e) + '</div>';
  return h;
}
function burnerDrillPanelLive(e, api) {
  // 第一行采矿进度条
  api.prog(e.working ? e.prog / e.oreTime() * 100 : 0, e.oreTime());
  // 产物格（可点击取回）+ 燃料行
  api.set('drill-buffer', _drillProductCellHtml(e));
  api.set('drill-fuel', _drillFuelRowHtml(e));
  // 状态：工作中或暂停原因（保留顶部状态图标）
  if (e.status) api.status('已暂停：' + e.status, 'warn');
  else if (!e.working) api.status('待机', 'ok');
  else api.status('开采中', 'ok');
}

// ===== 电采矿机/抽油机面板（精简版）=====
// 只保留：顶部机器图标（外壳）+ 采矿进度条（左）+ 产物格（右）+ 模块插槽（格）。去掉所有多余文字与按钮。
function electricDrillPanelHtml(e) {
  let h = '';
  // 采矿进度条形（组装机式流程行：左侧采矿进度 + 右侧产物格，可点击取回）
  h += '<div class="asm3-flow">';
  h += '<div class="asm3-prog"><div class="bar"><i></i><span class="bar-txt" data-live="mch-pct">0%</span></div></div>';
  h += '<div class="asm3-side asm3-out"><div data-live="drill-buffer">' + _drillProductCellHtml(e) + '</div></div>';
  h += '</div>';
  // 模块插槽（仅格子，无标题/状态文字/装入按钮）
  h += _drillModuleSlotsHtml(e);
  return h;
}
function electricDrillPanelLive(e, api) {
  // 采矿进度条
  api.prog(e.working ? e.prog / e.oreTime() * 100 : 0, e.oreTime());
  // 产物格（可点击拿起）
  api.set('drill-buffer', _drillProductCellHtml(e));
  // 状态：工作中或暂停原因（保留顶部状态图标）
  if (e.status) api.status('已暂停：' + e.status, 'warn');
  else if (!e.working) api.status('待机', 'ok');
  else api.status('开采中', 'ok');
}
// ===== 模块插槽（精简版）：只渲染格子，不含标题/状态文字/装入按钮 =====
// 空格可「选中插件后点击放入」，已装格子点击取出到背包；面板整体重建时同步刷新。
function _drillModuleSlotsHtml(e) {
  const slotN = (typeof e.moduleSlotCount === 'function') ? e.moduleSlotCount() : 4;
  if (slotN <= 0) return '';
  const mods = e.modules || {};
  const items = [];
  for (const mid in mods) if ((mods[mid] || 0) > 0) for (let i = 0; i < mods[mid]; i++) items.push(mid);
  let h = '<div class="mod-slots">';
  for (let i = 0; i < slotN; i++) {
    const mid = items[i];
    if (mid) {
      h += '<div class="mod-slot filled" data-action="mod-take" data-id="' + mid + '" data-tip="' + ITEMS[mid].name + '|点击取出到背包">' +
        '<img src="' + iconDataURL(mid, 16) + '">' +
        '<span class="mod-slot-n">' + ITEMS[mid].name + '</span></div>';
    } else {
      h += '<div class="mod-slot empty" data-action="mod-put" data-index="' + i + '" data-tip="选中插件后点击放入">' +
        '<span class="mod-slot-plus">+</span></div>';
    }
  }
  h += '</div>';
  return h;
}


// 悬停提示：矿脉剩余储量 + 电钻/抽油机电量不足 + 铀矿需硫酸
function drillTip(e) {
  const base = e.status || ('开采中，产出朝' + ['东', '南', '西', '北'][e.dir]);
  // 矿脉剩余储量提示（对齐《异星工厂》：矿脉储量有限、会逐渐采空）
  let oreRemain = 0;
  let oreFound = false;
  for (let dy = 0; dy < e.h; dy++)
    for (let dx = 0; dx < e.w; dx++) {
      const tx = e.x + dx, ty = e.y + dy;
      if (!e.minableOreType(getOreType(tx, ty))) continue;
      const amt = getOreAmt(tx, ty);
      if (amt <= 0) continue;
      oreRemain += amt;
      oreFound = true;
    }
  let tip = base;
  if (oreFound) {
    tip += '；矿脉剩余 ' + Math.round(oreRemain) + (oreRemain <= 100 ? '（⚠ 即将采空）' : '');
  }
  // 电采矿机/抽油机：电量不足（正在耗电且 sat<1）时在提示中注明
  if (e instanceof ElectricDrill) {
    const s = powerStatusOf(e);
    if (s.consuming && s.sat < 1) tip += '；' + (s.sat > 0 ? '电量不足' + Math.round(s.sat * 100) + '%' : '缺电停摆');
    // 铀矿采集需接入硫酸：提示剩余量与管道接入方向
    let hasUranium = false;
    for (let dy = 0; dy < e.h; dy++)
      for (let dx = 0; dx < e.w; dx++) {
        if (getOreType(e.x + dx, e.y + dy) === ORE_URANIUM && getOreAmt(e.x + dx, e.y + dy) > 0) hasUranium = true;
      }
    if (hasUranium) {
      tip += '；铀矿需硫酸' + ((e.acid || 0) > 0 ? '（硫酸×' + e.acid + '）' : '（缺硫酸，无法开采）');
    }
  }
  return tip;
}

// ===== 注册（渲染/面板/提示对三类采矿机统一注册）=====
ENT_CLASSES['burner-mining-drill'] = Drill;
// 热能采矿机：专属铜色旧工业风渲染（顶部烟囱 + 旋转钻头）
DEVICE_RENDER['burner-mining-drill'] = drawBurnerDrill;
// 电采矿机/抽油机：沿用旧共享 drawDrill
DEVICE_RENDER['electric-mining-drill'] = drawDrill;
DEVICE_RENDER['pumpjack'] = drawDrill;
DEVICE_STATUS['burner-mining-drill'] = e => e.working ? 'g' : 'r';
// 电采矿机/抽油机：正在耗电且电量不足（sat<1）时亮黄灯提示；未耗电时按是否工作显红/绿
function electricDrillStatus(e) {
  const s = powerStatusOf(e);
  return s.consuming ? s.color : (e.working ? 'g' : 'r');
}
DEVICE_STATUS['electric-mining-drill'] = electricDrillStatus;
DEVICE_STATUS['pumpjack'] = electricDrillStatus;
const burnerDrillPanel = { html: burnerDrillPanelHtml, live: burnerDrillPanelLive, tip: drillTip };
const electricDrillPanel = { html: electricDrillPanelHtml, live: electricDrillPanelLive, tip: drillTip };
DEVICE_PANEL['burner-mining-drill'] = burnerDrillPanel;
DEVICE_PANEL['electric-mining-drill'] = electricDrillPanel;
DEVICE_PANEL['pumpjack'] = electricDrillPanel;
DEVICE_DIR_ROTATE['burner-mining-drill'] = true;
DEVICE_DIR_ROTATE['electric-mining-drill'] = true;
// 显示详情时，各接口图标所在世界格 + 对应流体名（用于鼠标悬停显示流体名称）
// 抽油机：原油输出口在 dir 方向、沿边偏移半格到角落；电采矿机：其余 3 个方向中位硫酸输入口
DEVICE_FLUID_ICONS['pumpjack'] = e => {
  const s = TILE * e.w;
  const c = portCenterCell(e, e.x * TILE + s / 2, e.y * TILE + s / 2, e.dir | 0, 1, s / 2);
  return [{ x: c[0], y: c[1], fluid: 'crude-oil' }];
};
DEVICE_FLUID_ICONS['electric-mining-drill'] = e => {
  const s = TILE * e.w;
  const dir = e.dir | 0;
  const icons = [];
  for (const sd of [(dir + 1) % 4, (dir + 2) % 4, (dir + 3) % 4]) {
    const c = portCenterCell(e, e.x * TILE + s / 2, e.y * TILE + s / 2, sd, 0, s / 2);
    icons.push({ x: c[0], y: c[1], fluid: 'sulfuric-acid' });
  }
  return icons;
};
DEVICE_DIR_ROTATE['pumpjack'] = true;
