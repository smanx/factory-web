'use strict';

// ===== 终局：火箭发射（对齐《异星工厂》Rocket silo + 卫星发射胜利）=====
// 火箭发射井（9×9，吃电力）分两阶段：
// ① 集齐火箭部件（火箭燃料×10、火箭控制单元×1、低密度结构×10）后点击「组装火箭」，
//    在井内组装出完整的火箭本体（rocket）；
// ② 放入卫星，点击「发射」进入倒计时，发射成功即赢得游戏。
// 对齐《异星工厂》：发射井先组装出火箭，再放入卫星发射。

// 组装一枚火箭所需部件（对齐《异星工厂》火箭本体组装，官方 rocket-part 配方：
// 处理单元×10 + 低密度结构×10 + 火箭燃料×10。2.0 已移除 rocket-control-unit，统一走 rocket-part）
const SILO_ASSEMBLE = {
  'rocket-fuel': 10,
  'processing-unit': 10,
  'low-density-structure': 10
};
const SILO_CAP = 100;
// 火箭货舱容量（太空货运）：单种货物最多可装的件数（对齐《异星工厂》：火箭货舱按堆叠装载，这里以件计数）。
const CARGO_CAP = 200;

// 组装出完整火箭所需火箭部件数（对齐《异星工厂》：发射井逐件组装火箭部件，集齐后拼装成完整火箭本体）。
// 每件部件配方 = SILO_ASSEMBLE（火箭燃料×10 + 处理单元×10 + 低密度结构×10）。
// 取 50 件=1 枚火箭：发射井装产能模块（4 槽）可真正累积免费部件、缩减终局材料投入，复现《异星工厂》"火箭井装产能模块"经典玩法。
// 火箭井采用连续自动生产：部件数最多备满 2 枚火箭（2×ROCKET_PARTS，当前火箭 + 下一枚），
// 备满后停止制造不再堆积；发射时消耗 ROCKET_PARTS 件，剩余部件计入下一枚。
const ROCKET_PARTS = 50;
// 单个火箭部件的自动组装耗时（秒，基础值，受模块速度/电力倍率/全局制造速度倍率影响）。
const ROCKET_PART_TIME = 10;
// 火箭产能（对齐《异星工厂》Rocket productivity）：每级降低火箭燃料与低密度结构部件需求（最低保留 1）。
function siloPartNeed(k) { return (typeof rocketPartNeed === 'function') ? rocketPartNeed(k, SILO_ASSEMBLE[k]) : SILO_ASSEMBLE[k]; }
class RocketSilo extends CircuitNode {
  constructor(type, x, y) {
    super('rocket-silo', x, y);
    this.inp = {};           // 井内物品：组装部件
    this.parts = 0;          // 已组装的火箭部件数（对齐《异星工厂》：逐件组装，集齐 ROCKET_PARTS 件后拼成火箭）
    this.modules = {};       // 发射井模块（4 槽，对齐《异星工厂》：火箭井可装速度/产能/效率模块）
    this.prodBuf = 0;        // 产能模块累积进度
    this.prodTechBuf = 0;    // 科技产能无限科技分数缓冲
    this.asmT = 0;           // 当前火箭部件自动组装进度（秒，满 ROCKET_PART_TIME 产 1 件）
    this.launching = false;  // 发射倒计时中
    this.launchT = 0;
    this.launchCount = 0;    // 该发射井累计发射次数（对齐《异星工厂》：发射井可重复使用，多次发射产空间科学包）
    this.launched = false;   // 历史已发射过（用于渲染/状态；不阻止再次发射）
    this.cargo = {};         // 火箭货舱（太空货运）：随火箭发射的货物，物品→数量
  }
  // 电路网络信号输出（对齐《异星工厂》：火箭发射井可接入电路网络读取井内状态）。
  // 输出信号：signal-rocket 火箭本体数量、signal-satellite 卫星数量、
  // signal-rocket-parts 已就位组装部件数、signal-rocket-launch 发射倒计时标志。
  outputCircuitSignals() {
    const out = [];
    const sat = this.inp['satellite'] || 0;
    if (this.hasRocket()) out.push({ sig: 'signal-rocket', count: 1 });
    if (sat > 0) out.push({ sig: 'signal-satellite', count: sat });
    if (this.parts > 0) out.push({ sig: 'signal-rocket-parts', count: this.parts });
    if (this.launching) out.push({ sig: 'signal-rocket-launch', count: 1 });
    return out;
  }
  moduleSlotCount() { return 4; } // 对齐《异星工厂》：火箭发射井 4 个模块槽
  // 当前每秒推进的部件组装进度（受全局制造速度倍率 × 模块速度 × 电力倍率影响；与组装机 craftProgRate 同源）
  rocketPartRate() {
    const qMult = (typeof qualityMult === 'function' && this.quality) ? qualityMult(this.quality) : 1;
    return asmMult() * this.moduleSpeedMult() * powerFactor(this) * qMult;
  }
  // 模块速度倍率（速度模块加速，产能/效率模块小降速；与组装机一致）
  moduleSpeedMult() {
    const mc = moduleCounts(this.modules);
    const bb = (typeof beaconBonus === 'function') ? beaconBonus(this.x, this.y) : null;
    if (bb) { mc.speed += bb.speed; mc.prod += bb.prod; mc.eff += bb.eff; }
    return 1 + 0.4 * mc.speed - 0.1 * mc.prod - 0.03 * mc.eff - mc.qualityPenalty;
  }
  // 模块电力倍率（速度/产能增耗电、效率降耗电）
  modulePowerFactor() {
    const mc = moduleCounts(this.modules);
    const bb = (typeof beaconBonus === 'function') ? beaconBonus(this.x, this.y) : null;
    if (bb) { mc.speed += bb.speed; mc.prod += bb.prod; mc.eff += bb.eff; }
    const effMult = Math.max(0.2, 1 - 0.15 * mc.eff);
    const powMult = 1 + (mc.speed * 0.25 + mc.prod * 0.25);
    return powMult * effMult;
  }
  // 每次组装火箭部件后结算产能模块：累积免费额外部件（对齐《异星工厂》：火箭井装产能模块免费产出）
  applyProductivity() {
    const mc = moduleCounts(this.modules);
    const bb = (typeof beaconBonus === 'function') ? beaconBonus(this.x, this.y) : null;
    let nProd = mc.prod;
    if (bb) nProd += bb.prod;
    if (nProd > 0) {
      const thr = moduleProdThreshold(this.modules);
      this.prodBuf = (this.prodBuf || 0) + nProd;
      if (this.prodBuf >= thr) {
        this.prodBuf -= thr;
        this.parts++;
        if (typeof toast === 'function') toast('⚡ 产能模块免费产出 1 个火箭部件！');
        uiDirty = true;
        return 1;
      }
    }
    return 0;
  }
  giveItem(item) {
    if (isModule(item)) {
      if ((this.modules[item] || 0) >= 4) return false;
      this.modules[item] = (this.modules[item] || 0) + 1;
      if (typeof playSfx === 'function') playSfx('module');
      return true;
    }
    if (item !== 'satellite' && !SILO_ASSEMBLE[item]) {
      // 火箭已组装完成（阶段②）：允许把任意物品装入火箭货舱（太空货运）
      if (!this.hasRocket()) return false;
      if ((this.cargo[item] || 0) >= CARGO_CAP) return false;
      this.cargo[item] = (this.cargo[item] || 0) + 1;
      return true;
    }
    if ((this.inp[item] || 0) >= SILO_CAP) return false;
    this.inp[item] = (this.inp[item] || 0) + 1;
    return true;
  }
  takeItem() {
    // 货舱货物优先取出（太空货运）
    for (const k of Object.keys(this.cargo)) if (this.cargo[k] > 0) return this.takeItemOf(k);
    const keys = ['satellite'].concat(Object.keys(this.modules)).concat(Object.keys(SILO_ASSEMBLE));
    for (const k of keys)
      if (this.inp[k] > 0 || (this.modules[k] || 0) > 0) return this.takeItemOf(k);
    return null;
  }
  countOf(item) { return (this.inp[item] || 0) + (item === 'rocket-part' ? this.parts : 0); }
  takeItemOf(item) {
    if ((this.cargo[item] || 0) > 0) { this.cargo[item]--; if (this.cargo[item] <= 0) delete this.cargo[item]; return item; }
    if (item === 'rocket-part' && this.parts > 0) { this.parts--; return 'rocket-part'; }
    if ((this.inp[item] || 0) > 0) { this.inp[item]--; if (this.inp[item] <= 0) delete this.inp[item]; return item; }
    if ((this.modules[item] || 0) > 0) { this.modules[item]--; if (this.modules[item] <= 0) delete this.modules[item]; return item; }
    return null;
  }
  contents() {
    const list = [[this.type, 1]];
    if (this.parts > 0) list.push(['rocket-part', this.parts]);
    for (const k in this.modules) if (this.modules[k] > 0) list.push([k, this.modules[k]]);
    for (const k in this.inp) list.push([k, this.inp[k]]);
    for (const k in this.cargo) if (this.cargo[k] > 0) list.push([k, this.cargo[k]]);
    return list;
  }
  // 组装部件是否集齐（一次火箭部件的原料齐备）
  hasAssembleParts() {
    for (const k in SILO_ASSEMBLE) if ((this.inp[k] || 0) < siloPartNeed(k)) return false;
    return true;
  }
  assembleReady() {
    const out = {};
    for (const k in SILO_ASSEMBLE) {
      const have = this.inp[k] || 0;
      out[k] = have >= siloPartNeed(k);
    }
    return out;
  }
  // 已组装出完整火箭本体（火箭部件集齐，可发射条件之一）
  hasRocket() { return this.parts >= ROCKET_PARTS; }
  partsLeft() { return Math.max(0, ROCKET_PARTS - this.parts); }
  // 有载荷：卫星 / 货舱货物（含空间平台起始包）任一（载荷随火箭发射）
  hasPayload() { return (this.inp['satellite'] || 0) >= 1 || rocketCargoTotal(this) > 0; }
  // 发射就绪：完整火箭本体 + 有载荷
  hasAllParts() { return this.hasRocket() && this.hasPayload(); }
  // 组装火箭部件：消耗部件原料，产出 1 个火箭部件（带模块速度/产能）
  tryAssemble() {
    if (this.hasRocket()) { if (typeof toast === 'function') toast('火箭部件已集齐，放入卫星即可发射！'); return false; }
    if (!this.hasAssembleParts()) {
      if (typeof toast === 'function') toast('火箭部件原料未集齐：需要 ' + assemblePartsNeededStr(this));
      return false;
    }
    for (const k in SILO_ASSEMBLE) {
      this.inp[k] -= siloPartNeed(k);
      if ((this.inp[k] || 0) <= 0) delete this.inp[k];
    }
    this.parts++;
    if (typeof trackProd === 'function') trackProd('rocket-part', 1);
    this.applyProductivity();
    // 火箭部件产能无限科技：累积免费额外部件（对齐《异星工厂》Rocket part productivity）
    if (typeof applyTechProductivity === 'function') {
      const extra = applyTechProductivity(this, 'rocket-part', 1);
      if (extra > 0) {
        this.parts += extra;
        if (typeof trackProd === 'function') trackProd('rocket-part', extra);
        if (typeof toast === 'function') toast('⚡ 火箭部件产能科技免费产出 ' + extra + ' 个火箭部件！');
      }
    }
    if (this.hasRocket()) { if (typeof toast === 'function') toast('🛠️ 火箭部件集齐，完整火箭组装完成！放入卫星即可发射'); }
    else if (typeof toast === 'function') toast('🔩 火箭部件组装完成（' + this.parts + '/' + ROCKET_PARTS + '）');
    uiDirty = true;
    return true;
  }
  tryLaunch() {
    if (this.launching) return false;
    if (powerSatOf(this) <= 0) { if (typeof toast === 'function') toast('发射需要电力！'); return false; }
    if (!this.hasAllParts()) {
      if (typeof toast === 'function') toast('尚未就绪：需要完整火箭本体与载荷（卫星或货舱货物）');
      return false;
    }
    // 消耗载荷开始发射（火箭本体随发射离场）：卫星优先消耗，其次空间平台起始包；
    // 普通货舱货物不在此消耗，随火箭发射降落到物流接驳站/目标星球轨道（onRocketLaunch 处理）。
    // 连续生产：发射消耗 ROCKET_PARTS 件，超出部分计入下一枚火箭（无需重新从 0 累积）。
    this.parts = Math.max(0, this.parts - ROCKET_PARTS);
    this.asmT = 0;
    this.launchedSatellite = (this.inp['satellite'] || 0) > 0;
    this.launchedStarter = false;
    if (this.launchedSatellite) { this.inp['satellite']--; if (this.inp['satellite'] <= 0) delete this.inp['satellite']; }
    else if ((this.cargo['space-platform-starter-pack'] || 0) > 0) { this.cargo['space-platform-starter-pack'] = 0; delete this.cargo['space-platform-starter-pack']; this.launchedStarter = true; }
    this.launching = true;
    this.launchT = 0;
    if (typeof toast === 'function') toast('🚀 火箭发射倒计时 10 秒…');
    uiDirty = true;
    return true;
  }
  update(dt) {
    if (this.launching) {
      if (powerSatOf(this) <= 0) return;   // 发射需要持续供电
      this.launchT += dt;
      if (this.launchT >= 10) {
        this.launching = false;
        this.launchCount++;
        this.launched = true;
        onRocketLaunch(this);
      }
      return;
    }
    // 连续自动生产：供电正常、部件原料齐备且尚未备满两枚火箭时持续组装火箭部件（对齐《异星工厂》：发射井自动产部件）。
    // 部件上限 2×ROCKET_PARTS（当前火箭 + 下一枚）；备满后停止制造，火箭组件不堆积。
    if (powerSatOf(this) <= 0 || !this.hasAssembleParts() || this.parts >= 2 * ROCKET_PARTS) return;
    this.asmT = (this.asmT || 0) + dt * this.rocketPartRate();
    if (this.asmT >= ROCKET_PART_TIME) {
      this.asmT -= ROCKET_PART_TIME;
      for (const k in SILO_ASSEMBLE) {
        this.inp[k] -= siloPartNeed(k);
        if ((this.inp[k] || 0) <= 0) delete this.inp[k];
      }
      this.parts++;
      if (this.parts === ROCKET_PARTS && typeof toast === 'function') toast('🛠️ 火箭部件集齐，完整火箭组装完成！放入卫星即可发射');
      if (typeof trackProd === 'function') trackProd('rocket-part', 1);
      this.applyProductivity();
      // 火箭部件产能无限科技：累积免费额外部件（对齐《异星工厂》Rocket part productivity）
      if (typeof applyTechProductivity === 'function') {
        const extra = applyTechProductivity(this, 'rocket-part', 1);
        if (extra > 0) { this.parts += extra; if (typeof trackProd === 'function') trackProd('rocket-part', extra); }
      }
      // 备满两枚火箭后不再堆积（产能/科技免费部件超出时截断）
      if (this.parts > 2 * ROCKET_PARTS) this.parts = 2 * ROCKET_PARTS;
      uiDirty = true;
    }
  }
  powerDemand() { return this.launching ? 2000 : 20; }
  serialize() {
    const s = super.serialize();
    s.inp = this.inp; s.parts = this.parts; s.modules = this.modules; s.prodBuf = this.prodBuf; s.prodTechBuf = this.prodTechBuf || 0;
    s.asmT = this.asmT || 0;
    s.launching = this.launching; s.launchT = this.launchT; s.launched = this.launched; s.launchCount = this.launchCount || 0; s.launchedSatellite = !!this.launchedSatellite; s.launchedStarter = !!this.launchedStarter;
    s.cargo = this.cargo; s.cargoTarget = this.cargoTarget || null;
    return s;
  }
  static restore(s) {
    const t = super.restore(s);
    t.inp = s.inp || {}; t.parts = s.parts || 0; t.modules = s.modules || {}; t.prodBuf = s.prodBuf || 0; t.prodTechBuf = s.prodTechBuf || 0; t.cargo = s.cargo || {}; t.cargoTarget = s.cargoTarget || null;
    t.asmT = s.asmT || 0;
    t.launching = !!s.launching; t.launchT = s.launchT || 0; t.launched = !!s.launched; t.launchCount = s.launchCount || (s.launched ? 1 : 0); t.launchedSatellite = s.launchedSatellite !== undefined ? !!s.launchedSatellite : true; t.launchedStarter = !!s.launchedStarter;
    // 旧档迁移：旧版火箭井直接存 inp.rocket-body（已组装出火箭本体），换算为已集齐火箭部件
    if (t.parts <= 0 && (t.inp['rocket-body'] || 0) > 0) { t.parts = ROCKET_PARTS; delete t.inp['rocket-body']; }
    return t;
  }
}
function assemblePartsNeededStr(e) {
  const need = [];
  for (const k in SILO_ASSEMBLE) {
    const have = e.inp[k] || 0;
    const needN = siloPartNeed(k);
    if (have < needN) need.push(ITEMS[k].name + ' ×' + (needN - have));
  }
  return need.join('、');
}
function drawRocketSilo(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w;
  const k = s / 288;                       // 以 9×9=288px 为基准的缩放系数（尺寸异常时仍成比例）
  const cx = px + s / 2, cy = py + s / 2;
  const powered = powerSatOf(e) > 0;
  const t = G.time || 0;
  const simple = (typeof LOD !== 'undefined' && LOD && LOD.simple);
  const hasRocket = e.hasRocket();
  ctx.globalAlpha = alpha;

  // ===== 低 LOD（缩远/性能模式）：剪影级渲染 =====
  if (simple) {
    ctx.fillStyle = '#2a2622';
    rr(ctx, px + 2 * k, py + 2 * k, s - 4 * k, s - 4 * k, 9 * k); ctx.fill();
    ctx.fillStyle = '#191b20';
    ctx.beginPath(); ctx.arc(cx, cy, 42 * k, 0, Math.PI * 2); ctx.fill();
    if (e.launching) {
      const rise = Math.min(1, e.launchT / 10);
      const ry = cy - rise * 150 * k;
      ctx.fillStyle = '#cfd6de';
      rr(ctx, cx - 15 * k, ry - 58 * k, 30 * k, 58 * k, 4 * k); ctx.fill();
      ctx.fillStyle = '#e05545';
      tri(ctx, cx - 15 * k, ry - 58 * k, cx + 15 * k, ry - 58 * k, cx, ry - 76 * k); ctx.fill();
      ctx.fillStyle = 'rgba(255,150,50,.9)';
      tri(ctx, cx - 9 * k, ry, cx + 9 * k, ry, cx, ry + 26 * k); ctx.fill();
    } else if (hasRocket) {
      ctx.fillStyle = '#cfd6de';
      rr(ctx, cx - 15 * k, cy - 64 * k, 30 * k, 64 * k, 4 * k); ctx.fill();
      ctx.fillStyle = '#e05545';
      tri(ctx, cx - 15 * k, cy - 64 * k, cx + 15 * k, cy - 64 * k, cx, cy - 82 * k); ctx.fill();
    } else {
      ctx.fillStyle = '#9aa2ac';
      rr(ctx, cx - 13 * k, cy - 48 * k, 26 * k, 48 * k, 4 * k); ctx.fill();
      ctx.fillStyle = '#c04440';
      tri(ctx, cx - 13 * k, cy - 48 * k, cx + 13 * k, cy - 48 * k, cx, cy - 62 * k); ctx.fill();
    }
    if (!hasRocket && !e.launching) {
      ctx.font = 'bold 9px system-ui';
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillStyle = '#ffd23c';
      ctx.fillText(e.parts + '/' + ROCKET_PARTS, px + 10 * k, py + s - 24 * k);
    }
    ctx.globalAlpha = 1;
    return;
  }

  // ===== ① 平台底座（黄黑警示边 + 金属台面 + 地砖线）=====
  const dk = (s / 2 - 6) / 250;             // 设计稿 640 坐标系 → 9×9 占地
  const X = v => cx + (v - 320) * dk;
  const Y = v => cy + (v - 320) * dk;
  const P0 = X(70), PS = 500 * dk, PR = 50 * dk;
  const gradMetalV = ctx.createLinearGradient(0, Y(100), 0, Y(300));
  gradMetalV.addColorStop(0, '#8b929a');
  gradMetalV.addColorStop(0.5, '#5a6168');
  gradMetalV.addColorStop(1, '#34383d');
  const gradRoof = ctx.createLinearGradient(0, Y(78), 0, Y(570));
  gradRoof.addColorStop(0, '#737b84');
  gradRoof.addColorStop(1, '#464b51');
  // 全占地不透明混凝土底座：铺满整个 9×9 占地，四角/边缘不再透出地面
  ctx.fillStyle = '#3a4048';
  ctx.fillRect(px, py, s, s);
  // 落地投影
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  rr(ctx, px + 6 * dk, py + 8 * dk, s - 4 * dk, s - 5 * dk, 10 * dk); ctx.fill();
  // 外圈警示边（黄底 + 黑色斜条纹，仅边框环可见）
  ctx.fillStyle = '#e0a51c';
  rr(ctx, P0, P0, PS, PS, PR); ctx.fill();
  ctx.save();
  rr(ctx, P0, P0, PS, PS, PR); ctx.clip();
  ctx.fillStyle = '#1c1c1c';
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.PI / 4);
  ctx.translate(-cx, -cy);
  for (let i = -60; i <= 60; i++) ctx.fillRect(cx + i * 18 * dk, cy - 400 * dk, 9 * dk, 800 * dk);
  ctx.restore();
  ctx.restore();
  // 内圈金属台面（盖住中间，仅留警示边）+ 中央铺装
  ctx.fillStyle = gradRoof;
  rr(ctx, P0 + 8 * dk, P0 + 8 * dk, PS - 16 * dk, PS - 16 * dk, PR - 8 * dk); ctx.fill();
  ctx.fillStyle = '#54595f';
  rr(ctx, P0 + 22 * dk, P0 + 22 * dk, PS - 44 * dk, PS - 44 * dk, PR - 22 * dk); ctx.fill();
  // 混凝土地砖线
  ctx.strokeStyle = '#3f4449';
  ctx.lineWidth = 2 * dk;
  ctx.globalAlpha = alpha * 0.7;
  for (const v of [208, 320, 432]) {
    ctx.beginPath(); ctx.moveTo(X(92), Y(v)); ctx.lineTo(X(548), Y(v)); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(X(v), Y(92)); ctx.lineTo(X(v), Y(548)); ctx.stroke();
  }
  ctx.globalAlpha = alpha;

  // ===== ② 中央发射井（金属外环 + 深色井内 + 能量光晕）=====
  const pitR = 158 * dk, ir = 146 * dk;
  const gradMetalH = ctx.createLinearGradient(X(162), 0, X(478), 0);
  gradMetalH.addColorStop(0, '#3c4046');
  gradMetalH.addColorStop(0.5, '#666d74');
  gradMetalH.addColorStop(1, '#3c4046');
  ctx.strokeStyle = gradMetalH;
  ctx.lineWidth = 22 * dk;
  ctx.beginPath(); ctx.arc(cx, cy, pitR, 0, Math.PI * 2); ctx.stroke();
  ctx.strokeStyle = '#23262a';
  ctx.lineWidth = 2 * dk;
  ctx.beginPath(); ctx.arc(cx, cy, pitR, 0, Math.PI * 2); ctx.stroke();
  // 井内（深色竖井，底部受光）
  const pitGrad = ctx.createRadialGradient(cx, cy + ir, 0, cx, cy + ir, ir * 1.1);
  pitGrad.addColorStop(0, e.launching ? '#5a2a12' : '#06141b');
  pitGrad.addColorStop(0.55, '#02060a');
  pitGrad.addColorStop(1, '#000');
  ctx.fillStyle = pitGrad;
  ctx.beginPath(); ctx.arc(cx, cy, ir, 0, Math.PI * 2); ctx.fill();
  // 能量光晕（就绪时青色呼吸、发射时橙色强闪）
  if (powered) {
    const glowA = e.launching ? (0.55 + 0.4 * Math.sin(t * 6)) : (0.35 + 0.25 * Math.sin(t * 2.2));
    const glowCol = e.launching ? '255,150,60' : '31,240,192';
    const glowGrad = ctx.createRadialGradient(cx, cy, ir * 0.2, cx, cy, ir);
    glowGrad.addColorStop(0, 'rgba(' + glowCol + ',.55)');
    glowGrad.addColorStop(1, 'rgba(' + glowCol + ',0)');
    ctx.globalAlpha = alpha * Math.max(0, glowA);
    ctx.fillStyle = glowGrad;
    ctx.beginPath(); ctx.arc(cx, cy, ir, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = alpha;
  }

  // ===== ③ 打开的舱盖瓣（4 瓣，平铺在井口边缘）=====
  const drawPetal = () => {
    ctx.fillStyle = gradMetalV;
    ctx.strokeStyle = '#23262a';
    ctx.lineWidth = 2 * dk;
    ctx.beginPath();
    ctx.moveTo(X(300), Y(175));
    ctx.arc(cx, cy, 150 * dk, Math.atan2(-145, -20), Math.atan2(-145, 20), false);
    ctx.lineTo(X(348), Y(118));
    ctx.arc(cx, cy, 160 * dk, Math.atan2(-202, 28), Math.atan2(-202, -28), true);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  };
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(i * Math.PI / 2);
    ctx.translate(-cx, -cy);
    drawPetal();
    ctx.restore();
  }

  // ===== ④ 火箭本体（设计稿造型：橙鼻锥 + 白机身 + 红蓝带 + 舷窗）=====
  const drawRocketBody = (oy, withSat) => {
    ctx.save();
    ctx.translate(0, oy);
    // 尾翼（左右）
    ctx.fillStyle = '#3a4046';
    ctx.beginPath();
    ctx.moveTo(X(320) - 22 * dk, Y(236)); ctx.lineTo(X(320) - 9 * dk, Y(232)); ctx.lineTo(X(320) - 9 * dk, Y(256)); ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(X(320) + 22 * dk, Y(236)); ctx.lineTo(X(320) + 9 * dk, Y(232)); ctx.lineTo(X(320) + 9 * dk, Y(256)); ctx.closePath(); ctx.fill();
    // 喷管
    ctx.fillStyle = '#2b2f34';
    ctx.beginPath();
    ctx.moveTo(X(320) - 9 * dk, Y(232));
    ctx.quadraticCurveTo(X(320) - 9 * dk, Y(240), X(320) + 9 * dk, Y(240));
    ctx.lineTo(X(320) + 9 * dk, Y(232));
    ctx.lineTo(X(320) + 13 * dk, Y(246));
    ctx.quadraticCurveTo(X(320), Y(254), X(320) - 13 * dk, Y(246));
    ctx.closePath(); ctx.fill();
    // 机身主体（白→灰渐变）
    const bodyGrad = ctx.createLinearGradient(X(320) - 13 * dk, 0, X(320) + 13 * dk, 0);
    bodyGrad.addColorStop(0, '#bdbdbd');
    bodyGrad.addColorStop(0.4, '#f4f4f2');
    bodyGrad.addColorStop(1, '#9a9a9a');
    ctx.fillStyle = bodyGrad;
    rr(ctx, X(320) - 13 * dk, Y(134), 26 * dk, 100 * dk, 6 * dk); ctx.fill();
    // 底部加宽裙边
    ctx.fillStyle = bodyGrad;
    rr(ctx, X(320) - 16 * dk, Y(212), 32 * dk, 30 * dk, 4 * dk); ctx.fill();
    // 侧翼（上挑）
    ctx.fillStyle = '#c8c8c2';
    ctx.beginPath();
    ctx.moveTo(X(320) - 16 * dk, Y(212));
    ctx.quadraticCurveTo(X(320) - 26 * dk, Y(194), X(320) - 18 * dk, Y(184));
    ctx.lineTo(X(320) - 12 * dk, Y(212));
    ctx.closePath(); ctx.fill();
    ctx.beginPath();
    ctx.moveTo(X(320) + 16 * dk, Y(212));
    ctx.quadraticCurveTo(X(320) + 26 * dk, Y(194), X(320) + 18 * dk, Y(184));
    ctx.lineTo(X(320) + 12 * dk, Y(212));
    ctx.closePath(); ctx.fill();
    // 橙鼻锥
    ctx.fillStyle = '#e2661a';
    ctx.beginPath();
    ctx.moveTo(X(320) - 13 * dk, Y(134));
    ctx.quadraticCurveTo(X(320), Y(100), X(320) + 13 * dk, Y(134));
    ctx.closePath(); ctx.fill();
    // 红带 / 蓝带 / 银带（含通气孔）
    ctx.fillStyle = '#c0392b';
    rr(ctx, X(320) - 14 * dk, Y(168), 28 * dk, 8 * dk, 2 * dk); ctx.fill();
    ctx.fillStyle = '#2563a8';
    rr(ctx, X(320) - 14 * dk, Y(180), 28 * dk, 5 * dk, 1 * dk); ctx.fill();
    ctx.fillStyle = '#c8c8c2';
    rr(ctx, X(320) - 14 * dk, Y(204), 28 * dk, 6 * dk, 2 * dk); ctx.fill();
    ctx.strokeStyle = '#8a8a8a'; ctx.lineWidth = 1 * dk;
    rr(ctx, X(320) - 14 * dk, Y(204), 28 * dk, 6 * dk, 2 * dk); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(X(320) - 4 * dk, Y(204)); ctx.lineTo(X(320) - 4 * dk, Y(210));
    ctx.moveTo(X(320) + 4 * dk, Y(204)); ctx.lineTo(X(320) + 4 * dk, Y(210));
    ctx.stroke();
    // 舷窗
    ctx.fillStyle = '#0a2233';
    ctx.beginPath(); ctx.arc(X(320), Y(156), 6 * dk, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#9aa0a6'; ctx.lineWidth = 2 * dk;
    ctx.beginPath(); ctx.arc(X(320), Y(156), 6 * dk, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#4aa3e0';
    ctx.beginPath(); ctx.arc(X(320) - 2 * dk, Y(156) - 2 * dk, 2 * dk, 0, Math.PI * 2); ctx.fill();
    // 卫星载荷（已放入卫星时挂在鼻锥上方）
    if (withSat) {
      ctx.fillStyle = '#aeb6c4';
      rr(ctx, X(320) - 8 * dk, Y(88), 16 * dk, 7 * dk, 2 * dk); ctx.fill();
      ctx.fillStyle = '#c9d2e0';
      ctx.beginPath(); ctx.moveTo(X(320), Y(93)); ctx.lineTo(X(320) - 9 * dk, Y(101)); ctx.lineTo(X(320) - 9 * dk, Y(86)); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(X(320), Y(93)); ctx.lineTo(X(320) + 9 * dk, Y(101)); ctx.lineTo(X(320) + 9 * dk, Y(86)); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
  };
  // 待命小尾焰（轻度摇曳）
  const drawIdleFlame = (oy) => {
    const fy = Y(250) + oy;
    const fh = (1 + 0.15 * Math.sin(t * 18)) * 40 * dk;
    ctx.fillStyle = '#ffb23a';
    ctx.beginPath();
    ctx.moveTo(X(320) - 11 * dk, fy);
    ctx.quadraticCurveTo(X(320) - 3 * dk, fy + fh * 0.65, X(320), fy + fh);
    ctx.quadraticCurveTo(X(320) + 3 * dk, fy + fh * 0.65, X(320) + 11 * dk, fy);
    ctx.quadraticCurveTo(X(320) + 4 * dk, fy + 2 * dk, X(320) - 4 * dk, fy + 2 * dk);
    ctx.closePath(); ctx.fill();
  };

  // ===== ⑤ 四角起重机臂（复用旋转）=====
  const drawCrane = () => {
    // 角部设备箱
    ctx.fillStyle = gradMetalV;
    rr(ctx, X(482), Y(108), 54 * dk, 54 * dk, 8 * dk); ctx.fill();
    ctx.strokeStyle = '#23262a'; ctx.lineWidth = 2 * dk;
    rr(ctx, X(482), Y(108), 54 * dk, 54 * dk, 8 * dk); ctx.stroke();
    ctx.fillStyle = '#464b51';
    rr(ctx, X(492), Y(118), 34 * dk, 34 * dk, 5 * dk); ctx.fill();
    ctx.fillStyle = '#1a1d21';
    ctx.beginPath(); ctx.arc(X(509), Y(135), 7 * dk, 0, Math.PI * 2); ctx.fill();
    // 起重臂（指向中心的橙色桁架）
    const armGrad = ctx.createLinearGradient(X(50), Y(314), X(123), Y(331));
    armGrad.addColorStop(0, '#d98a3a');
    armGrad.addColorStop(1, '#9c5416');
    ctx.fillStyle = armGrad;
    ctx.beginPath();
    ctx.moveTo(X(114), Y(314));
    ctx.lineTo(X(50), Y(314));
    ctx.lineTo(X(50), Y(331));
    ctx.lineTo(X(114), Y(331));
    ctx.quadraticCurveTo(X(123), Y(322.5), X(114), Y(314));
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#63340c'; ctx.lineWidth = 1.5 * dk;
    ctx.beginPath(); ctx.moveTo(X(114), Y(314)); ctx.lineTo(X(50), Y(314)); ctx.lineTo(X(50), Y(331)); ctx.lineTo(X(114), Y(331)); ctx.closePath(); ctx.stroke();
    // 滑轮 + 吊缆
    ctx.fillStyle = '#4a4f55';
    ctx.beginPath(); ctx.arc(X(53), Y(322), 9 * dk, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#22262b';
    ctx.beginPath(); ctx.arc(X(53), Y(322), 4 * dk, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#d2e0ec';
    ctx.lineWidth = 3 * dk;
    ctx.beginPath(); ctx.moveTo(X(53), Y(322)); ctx.lineTo(X(80), Y(298)); ctx.stroke();
  };
  for (let i = 0; i < 4; i++) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(i * Math.PI / 2);
    ctx.translate(-cx, -cy);
    drawCrane();
    ctx.restore();
  }

  // ===== ⑥ 电网接入电缆 + 控制箱（LED）=====
  ctx.lineCap = 'round';
  ctx.strokeStyle = '#14161a';
  ctx.lineWidth = 7 * dk;
  ctx.beginPath();
  ctx.moveTo(X(224), Y(308));
  ctx.bezierCurveTo(X(160), Y(300), X(150), Y(240), X(150), Y(176));
  ctx.stroke();
  ctx.strokeStyle = '#3a6ea5';
  ctx.lineWidth = 3 * dk;
  ctx.setLineDash([1 * dk, 7 * dk]);
  ctx.beginPath();
  ctx.moveTo(X(224), Y(308));
  ctx.bezierCurveTo(X(160), Y(300), X(150), Y(240), X(150), Y(176));
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = '#14161a';
  ctx.lineWidth = 5 * dk;
  ctx.beginPath();
  ctx.moveTo(X(150), Y(176));
  ctx.lineTo(X(150), Y(112));
  ctx.quadraticCurveTo(X(150), Y(98), X(160), Y(92));
  ctx.lineTo(X(238), Y(92));
  ctx.stroke();
  ctx.lineCap = 'butt';
  // 控制箱
  const cbx = X(78), cby = Y(78);
  ctx.fillStyle = gradMetalV;
  rr(ctx, cbx - 20 * dk, cby - 28 * dk, 40 * dk, 56 * dk, 5 * dk); ctx.fill();
  ctx.strokeStyle = '#202327'; ctx.lineWidth = 2 * dk;
  rr(ctx, cbx - 20 * dk, cby - 28 * dk, 40 * dk, 56 * dk, 5 * dk); ctx.stroke();
  ctx.fillStyle = '#2e3338';
  rr(ctx, cbx - 16 * dk, cby - 24 * dk, 32 * dk, 48 * dk, 3 * dk); ctx.fill();
  const led = (lx, ly, col) => {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(lx, ly, 3 * dk, 0, Math.PI * 2); ctx.fill();
  };
  const blink = Math.floor(t * 1.6) % 2 === 0;
  led(cbx - 8 * dk, cby - 14 * dk, '#e23b3b');
  led(cbx + 8 * dk, cby - 14 * dk, powered ? '#7bbf4a' : '#46543a');
  led(cbx - 8 * dk, cby - 4 * dk, '#e23b3b');
  led(cbx + 8 * dk, cby - 4 * dk, (powered && blink) ? '#3df07a' : '#1c3a28');
  // 电源符号（闪电）
  ctx.strokeStyle = '#e0e3e6';
  ctx.lineWidth = 4 * dk;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(cbx - 7 * dk, cby + 2 * dk);
  ctx.lineTo(cbx - 7 * dk, cby + 9 * dk);
  ctx.lineTo(cbx + 2 * dk, cby + 12 * dk);
  ctx.lineTo(cbx - 7 * dk, cby + 15 * dk);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.lineJoin = 'miter';

  // ===== ⑦ 状态主体：发射升空 / 余晖 / 火箭就绪 / 装配中 =====
  if (e.launching) {
    // —— 火箭升空：加速上升 + 大尾焰 + 井口烟雾 + 光晕 ——
    const riseK = Math.pow(Math.min(1, e.launchT / 10), 1.3);
    const oy = -riseK * 175 * dk;
    const fy = Y(250) + oy;                 // 尾焰起点（喷管下方）
    // 尾焰光晕
    const halo = ctx.createRadialGradient(cx, fy, 2 * dk, cx, fy, 64 * dk);
    halo.addColorStop(0, 'rgba(255,190,90,.6)');
    halo.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = halo;
    ctx.beginPath(); ctx.arc(cx, fy, 64 * dk, 0, Math.PI * 2); ctx.fill();
    // 井口烟雾
    ctx.fillStyle = 'rgba(205,200,190,.5)';
    for (let i = 0; i < 6; i++) {
      const a = i * 1.05 + t * 0.9;
      const sr = (10 + (i % 3) * 4) * dk;
      ctx.beginPath(); ctx.arc(cx + Math.cos(a) * (34 + (i % 2) * 8) * dk, cy + Math.sin(a) * (14 + (i % 2) * 6) * dk + 6 * dk, sr, 0, Math.PI * 2); ctx.fill();
    }
    // 火箭本体（上升；升空时顶部不显示卫星载荷，保持画面干净）
    drawRocketBody(oy, false);
    // 大尾焰（主焰 + 亮芯，动态摆动）
    const plumeH = (46 + riseK * 44) * dk;
    const flick = Math.sin(t * 30) * 3 * dk;
    ctx.fillStyle = 'rgba(255,150,60,.85)';
    ctx.beginPath();
    ctx.moveTo(X(320) - 11 * dk, fy);
    ctx.quadraticCurveTo(X(320) - 4 * dk, fy + plumeH * 0.6, X(320) + flick, fy + plumeH);
    ctx.quadraticCurveTo(X(320) + 4 * dk, fy + plumeH * 0.6, X(320) + 11 * dk, fy);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(255,235,180,.95)';
    ctx.beginPath();
    ctx.moveTo(X(320) - 5 * dk, fy);
    ctx.quadraticCurveTo(X(320) - 2 * dk, fy + plumeH * 0.32, X(320) + flick * 0.5, fy + plumeH * 0.45);
    ctx.quadraticCurveTo(X(320) + 2 * dk, fy + plumeH * 0.32, X(320) + 5 * dk, fy);
    ctx.closePath(); ctx.fill();
  } else if (e.launched) {
    // —— 已发射：井口橙色余晖 + 残留烟尘 ——
    ctx.fillStyle = 'rgba(255,190,120,.22)';
    ctx.beginPath(); ctx.arc(cx, cy, ir * 0.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(215,210,200,.4)';
    for (let i = 0; i < 3; i++) {
      const sx = cx + Math.sin(i * 1.9 + t * 0.4) * 14 * dk + i * 8 * dk - 8 * dk;
      const sy = cy - ((t * 6 + i * 22) % 40) * dk - 10 * dk;
      ctx.beginPath(); ctx.arc(sx, sy, (5 + i * 2) * dk, 0, Math.PI * 2); ctx.fill();
    }
  } else if (hasRocket) {
    // —— 火箭就绪：待命悬停（轻微浮沉）+ 小尾焰 + 卫星载荷 ——
    const bob = Math.sin(t * 2) * 2 * dk;
    drawRocketBody(bob, (e.inp['satellite'] || 0) > 0);
    drawIdleFlame(bob);
  } else {
    // —— 装配中：箭体随部件进度逐步升高 ——
    const prog = Math.max(0, Math.min(1, e.parts / ROCKET_PARTS));
    const bh2 = Math.max(10 * dk, 100 * dk * prog);
    const topY2 = Y(234) - bh2;
    const bodyGrad = ctx.createLinearGradient(X(320) - 13 * dk, 0, X(320) + 13 * dk, 0);
    bodyGrad.addColorStop(0, '#bdbdbd');
    bodyGrad.addColorStop(0.4, '#f4f4f2');
    bodyGrad.addColorStop(1, '#9a9a9a');
    ctx.fillStyle = bodyGrad;
    rr(ctx, X(320) - 13 * dk, topY2, 26 * dk, bh2, 6 * dk); ctx.fill();
    if (prog >= 0.5) {
      ctx.fillStyle = bodyGrad;
      rr(ctx, X(320) - 16 * dk, Y(212), 32 * dk, 30 * dk, 4 * dk); ctx.fill();
    }
    if (prog >= 0.75) {
      const nh2 = (prog - 0.75) / 0.25 * 34 * dk;
      ctx.fillStyle = '#e2661a';
      ctx.beginPath();
      ctx.moveTo(X(320) - 13 * dk, topY2);
      ctx.quadraticCurveTo(X(320), topY2 - nh2, X(320) + 13 * dk, topY2);
      ctx.closePath(); ctx.fill();
    }
  }

  // ===== ⑧ 状态标签（装配进度 / 卫星就绪）与发射倒计时 =====
  let lx = px + 10 * k, ly = py + s - 24 * k;
  ctx.font = 'bold 9px system-ui';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  if (e.launching) {
    // 升空期间火箭顶部不显示倒计时/状态文字（保持画面干净）
  } else if (!hasRocket) {
    // 装配进度 + 原料齐备小点
    ctx.fillStyle = '#ffd23c';
    ctx.fillText(e.parts + '/' + ROCKET_PARTS, lx, ly);
    lx += 14 * k;
    for (const kk of Object.keys(SILO_ASSEMBLE)) {
      const have = e.inp[kk] || 0;
      const need = siloPartNeed(kk);
      const ready = have >= need;
      ctx.fillStyle = ITEMS[kk] ? ITEMS[kk].color : '#c0b090';
      ctx.beginPath(); ctx.arc(lx - 4 * k, ly, 3 * k, 0, 7); ctx.fill();
      ctx.fillStyle = ready ? '#57e389' : '#c0b090';
      ctx.fillText(have > need ? '✓' : (have > 0 ? String(Math.min(have, need)) : ''), lx, ly);
      lx += 12 * k;
    }
  } else {
    ctx.fillStyle = (e.inp['satellite'] || 0) > 0 ? '#57e389' : '#c0b090';
    ctx.fillText('🛰' + ((e.inp['satellite'] || 0) > 0 ? '✓' : ''), lx, ly);
  }

  // ===== ⑨ 边缘警示灯（闪烁）=====
  const warnOn = e.launching ? (Math.floor(t * 4) % 2 === 0) : (powered ? (Math.floor(t * 2) % 2 === 0) : false);
  ctx.fillStyle = warnOn ? '#ffcf3d' : '#6b5a14';
  ctx.beginPath(); ctx.arc(X(560), Y(350), 4 * dk, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#6b5a14'; ctx.lineWidth = 1.5 * dk;
  ctx.beginPath(); ctx.arc(X(560), Y(350), 4 * dk, 0, Math.PI * 2); ctx.stroke();
  ctx.globalAlpha = 1;
}
// ===== 火箭发射井面板（对齐《异星工厂》Rocket silo GUI：三栏布局）=====
// 左栏=玩家背包（与其他设备一致）；中栏=火箭装配；右栏=火箭运载舱/物流。
// 中栏：电力状态 + 火箭预览（与地图同款发射井绘制）+ 火箭组件（3 原料槽+进度条+部件槽，
//      第二行 4 模块槽+卫星槽）+ 火箭进度 + 组装/发射按钮。
// 右栏：火箭运载舱（货舱格子）+ 火箭载荷使用量 + 发射火箭/新建太空平台/前往太空平台 +
//      物流请求（目标星球在途轨道货物）+ 物流回收区（装填区）。
const ROCKET_PAYLOAD_CAP = 1000;           // 火箭载荷显示上限（1 吨 ≈ 1000 件）
const ROCKET_MOD_ORDER = ['speed-module', 'speed-module-2', 'speed-module-3', 'productivity-module', 'productivity-module-2', 'productivity-module-3', 'efficiency-module', 'efficiency-module-2', 'efficiency-module-3', 'quality-module', 'quality-module-2', 'quality-module-3'];

function siloPanelHtml(e) {
  const left = htmlInventory();
  return '<div class="inv-layout machine-layout rocket-layout">' +
    '<div class="inv-col inv-col-left" id="inv-col-left"><div class="inv-col-head">🎒 玩家</div>' +
    '<div class="inv-col-body" id="inv-mat">' + left + '</div></div>' +
    '<div class="inv-col rocket-mid"><div class="inv-col-head">🚀 火箭装配</div>' +
    '<div class="inv-col-body">' + rocketMidHtml(e) + '</div></div>' +
    '<div class="inv-col rocket-right"><div class="inv-col-head">📦 运载 / 物流</div>' +
    '<div class="inv-col-body">' + rocketRightHtml(e) + '</div></div>' +
  '</div>';
}

// —— 中栏：火箭装配 ——
function rocketMidHtml(e) {
  const powered = powerSatOf(e) > 0;
  const dotCls = e.launching ? 'launch' : (powered ? 'good' : '');
  const pTxt = e.launching ? '发射中 · 功率 2000kW' : (powered ? '供电正常' : '无电力 · 暂停');
  let h = '';
  // 电力状态
  h += '<div class="rocket-power"><span class="dot ' + dotCls + '"></span><span data-live="rc-power">' + pTxt + '</span></div>';
  // 火箭预览（与地图同款发射井绘制：装配/发射动画一致）
  h += '<div class="rocket-preview"><canvas class="rocket-cv" width="280" height="172"></canvas></div>';
  // 火箭组件流程（配方行 + 生产流程一行）
  h += '<div class="rocket-area-title top"><span>火箭组件</span></div>';
  h += '<div id="rc-flow">' + rocketFlowHtml(e) + '</div>';
  // 模块插槽（4 个，可放入插件：速度/产能/效率/品质模块）
  const modSlotN = (typeof e.moduleSlotCount === 'function') ? e.moduleSlotCount() : 4;
  const mods = e.modules || {};
  const modItems = [];
  for (const mid in mods) if ((mods[mid] || 0) > 0) for (let i = 0; i < mods[mid]; i++) modItems.push(mid);
  h += '<div class="rocket-area-title"><span>模块插槽</span><span class="dim">' + modSlotN + ' 个</span></div>';
  h += '<div class="mod-slots">';
  for (let i = 0; i < modSlotN; i++) {
    const mid = modItems[i];
    if (mid) {
      h += '<div class="mod-slot filled" data-action="mod-take" data-id="' + mid + '" data-tip="' + ITEMS[mid].name + '|点击取出到背包">' +
        '<img src="' + iconDataURL(mid, 16) + '"><span class="mod-slot-n">' + ITEMS[mid].name + '</span></div>';
    } else {
      h += '<div class="mod-slot empty" data-action="mod-put" data-index="' + i + '" data-tip="选中插件后点击放入">' +
        '<span class="mod-slot-plus">+</span></div>';
    }
  }
  h += '</div>';
  // 火箭制造进度（两枚：当前 + 下一枚；50 个火箭组件拼成 1 枚火箭，连续生产）
  const cur = Math.min(e.parts, ROCKET_PARTS);
  const next = Math.max(0, e.parts - ROCKET_PARTS);
  const curPct = Math.round(cur / ROCKET_PARTS * 100);
  const nextPct = Math.round(next / ROCKET_PARTS * 100);
  h += '<div class="rocket-progress">';
  h += '<div class="rc-pbar-row"><div class="rc-flowbar">' +
    '<i style="width:' + curPct + '%"></i><span data-live="rc-curpct">' + cur + '/' + ROCKET_PARTS + '</span></div></div>';
  h += '<div class="rc-pbar-row"><div class="rc-flowbar">' +
    '<i style="width:' + nextPct + '%"></i><span data-live="rc-nextpct">' + next + '/' + ROCKET_PARTS + '</span></div></div>';
  h += '</div>';
  return h;
}

// 中栏组件流程（对齐组装机面板生产过程）：配方行（图标+名称，悬停显示配料详情）+ 生产流程一行（3 原料占位槽 + 中间进度条 + 产品占位槽）
function rocketFlowHtml(e) {
  // 配方行：火箭部件配方（组装机样式：配方图标 + 配方名称，悬停弹出配料配方详情）
  const needList = Object.keys(SILO_ASSEMBLE).map(k => (ITEMS[k] ? ITEMS[k].name : k) + '×' + siloPartNeed(k)).join(' + ');
  const recipeTip = '火箭部件配方|每次组装消耗：' + needList + ' → 火箭部件 ×1||所需原料：' + needList;
  let h = '<div class="rocket-recipe" data-tip="' + recipeTip + '">' +
    '<img src="' + iconDataURL('rocket-part') + '"><span><b>火箭部件</b><em>配方</em></span></div>';
  // 生产流程一行：3 原料占位槽 + 中间进度条 + 产品占位槽
  h += '<div class="rocket-flow wide">';
  for (const k of Object.keys(SILO_ASSEMBLE)) {
    const have = e.inp[k] || 0;
    const need = siloPartNeed(k);
    const full = have >= need;
    const tip = ITEMS[k].name + '|火箭部件原料：本次需 ' + need + '，已放 ' + have + '。点击拿起（移到背包再点即取回）；先在左侧选中该物品再点此槽放入';
    h += '<div class="rocket-slot' + (full ? ' full' : '') + '" data-action="feed-slot" data-id="' + k + '" data-tip="' + tip + '">' +
      '<img src="' + iconDataURL(k) + '"><span class="cnt">' + have + '/' + need + '</span></div>';
  }
  // 进度条（火箭部件组装进度，位于原料与产品之间；每产 1 件重置重走）
  const asmPct = Math.min(100, Math.round(((e.asmT || 0) / ROCKET_PART_TIME) * 100));
  h += '<div class="rc-flowbar"><i style="width:' + asmPct + '%"></i><span data-live="rc-flowpct">' + asmPct + '%</span></div>';
  // 产品占位槽（火箭组件：生成后立即用于建造火箭被消耗，不在本格堆积；进度见下方两枚进度条）
  const partTip = '火箭部件|火箭组件生成后立即用于建造火箭被消耗，不在本格堆积；当前火箭 / 下一枚的制造进度见下方进度条';
  h += '<div class="rocket-slot part" data-tip="' + partTip + '">' +
    '<img src="' + iconDataURL('rocket-part') + '"><span class="cnt">0</span></div>';
  h += '</div>';
  return h;
}

// —— 右栏：火箭运载舱 / 物流 ——
function rocketCargoTotal(e) {
  let t = 0;
  for (const k in e.cargo) if ((e.cargo[k] || 0) > 0) t += e.cargo[k];
  return t;
}
function rocketRightHtml(e) {
  let h = '';
  // 火箭运载舱（20 格）
  h += '<div class="rocket-area-title top"><span>火箭运载舱</span></div>';
  h += '<div class="rc-cargogrid" id="rc-cargogrid">' + rocketCargoGridHtml(e) + '</div>';
  // 火箭载荷使用量
  const loadVal = rocketCargoTotal(e);
  const loadPct = Math.min(100, Math.round(loadVal / ROCKET_PAYLOAD_CAP * 100));
  h += '<div class="rc-loadrow"><span>火箭载荷使用量</span>' +
    '<div class="rc-flowbar"><i style="width:' + loadPct + '%"></i><span data-live="rc-loadpct">' + loadVal + ' / 1 t</span></div></div>';
  // 操作按钮：发射火箭（火箭本体完整且有载荷时点亮可发射）+ 新建太空平台
  const launchReady = e.hasRocket() && !e.launching && ((e.inp['satellite'] || 0) >= 1 || rocketCargoTotal(e) > 0);
  h += '<div class="rocket-btnrow">' +
    '<button class="rocket-btn launch" data-action="launch" ' + (launchReady ? '' : 'disabled') +
      ' title="火箭本体组装完成且已有载荷（卫星或货舱货物）时点亮；点击直接发射火箭">🚀 发射火箭</button>' +
    '<button class="rocket-btn" data-action="cargo-feed" data-id="space-platform-starter-pack" data-itemid="space-platform-starter-pack" ' +
      (((e.cargo['space-platform-starter-pack'] || 0) > 0 || !e.hasRocket()) ? 'disabled' : '') +
      ' title="装入「空间平台起始包」后发射，可在本星生成空间平台中枢（Space Age）">新建太空平台</button>' +
    '</div>';
  h += '<button class="rocket-btn" data-action="goto-hub" title="把镜头切到空间平台中枢所在位置">🚀 前往太空平台</button>';
  // 物流请求：目标星球轨道在途货物（Space Age 行星间调度）
  h += '<hr class="rocket-hr">';
  const curPlanet = (typeof planetId === 'function') ? planetId() : 'nauvis';
  const tgt = e.cargoTarget || curPlanet;
  const tgtName = (typeof planetOption === 'function' && planetOption(tgt)) ? planetOption(tgt).name : tgt;
  h += '<div class="rocket-area-title top"><span>物流请求</span><span class="dim">⚙</span></div>';
  h += '<div class="rocket-autobar"><span>📦</span><span class="lbl">太空平台自动请求 · 目的地：' + tgtName + '</span>' +
    '<span class="ico" data-tip="目标星球在途轨道货物：火箭把货舱货物送往目标星球轨道，抵达后自动交付">ⓘ</span></div>';
  h += '<div class="rc-orbital" id="rc-orbital">' + rocketOrbitalHtml(e, tgt) + '</div>';
  h += '<select data-action="cargo-target" style="margin:6px 0 2px;max-width:100%">';
  const planetOpts = (typeof PLANET_OPTIONS !== 'undefined') ? PLANET_OPTIONS : [{ v: curPlanet, name: '新地星' }];
  for (const po of planetOpts) {
    const cur = po.v === curPlanet;
    h += '<option value="' + po.v + '"' + (po.v === tgt ? ' selected' : '') + '>' +
      (cur ? '🛰️ ' : '🌍 ') + po.name + (cur ? '（本地降落）' : '') + '</option>';
  }
  h += '</select>';
  // 物流回收区：装填区（点击把左侧选中物品装入货舱）
  h += '<div class="rocket-area-title top"><span>物流回收区</span><span class="dim">装填</span></div>';
  h += '<div class="dim">点击回收箱把左侧选中的背包物品装入火箭货舱一堆（装入后显示在「火箭运载舱」，点运载舱格子可取出）。</div>';
  h += '<div class="rc-trash" id="rc-trash">';
  for (let i = 0; i < 40; i++) {
    h += '<div class="rocket-slot trash" data-action="cargo-slot" data-tip="装填区|点击把左侧选中的背包物品装入火箭货舱一堆">🗑️</div>';
  }
  h += '</div>';
  return h;
}

// 货舱格子：20 格（2×10），有货点击取出全部，空格点击装入左侧选中物品
function rocketCargoGridHtml(e) {
  const keys = Object.keys(e.cargo || {}).filter(k => (e.cargo[k] || 0) > 0);
  let h = '';
  for (let i = 0; i < 20; i++) {
    const k = keys[i];
    if (k) {
      const tip = ITEMS[k].name + ' ×' + e.cargo[k] + '|火箭货舱：点击整件取回背包（随火箭发射降落到物流接驳站/目标星球轨道）';
      h += '<div class="rocket-slot" data-action="cargo-slot" data-id="' + k + '" data-itemid="' + k + '" data-tip="' + tip + '">' +
        '<img src="' + iconDataURL(k) + '"><span class="cnt">' + e.cargo[k] + '</span></div>';
    } else {
      const tip = '货舱空位|点击装入左侧选中的背包物品一堆（装入后「发射火箭」按钮点亮，即可发射）';
      h += '<div class="rocket-slot empty" data-action="cargo-slot" data-tip="' + tip + '"></div>';
    }
  }
  return h;
}

// 目标星球在途轨道货物（20 格）
function rocketOrbitalHtml(e, tgt) {
  const q = (G.orbitalCargo && G.orbitalCargo[tgt]) || {};
  const keys = Object.keys(q).filter(k => (q[k] || 0) > 0);
  const tgtName = (typeof planetOption === 'function' && planetOption(tgt)) ? planetOption(tgt).name : tgt;
  let h = '';
  for (let i = 0; i < 20; i++) {
    const k = keys[i];
    if (k) {
      const tip = ITEMS[k].name + ' ×' + q[k] + '|在途轨道货物：已由火箭送往' + tgtName + '，抵达后自动交付';
      h += '<div class="rocket-slot" data-tip="' + tip + '"><img src="' + iconDataURL(k) + '"><span class="cnt">' + q[k] + '</span></div>';
    } else {
      h += '<div class="rocket-slot empty"></div>';
    }
  }
  return h;
}

// 面板实时刷新（每 0.25s 由 updateMachineLive → updateGenericDeviceLive 调用）
function siloPanelLive(e, api, body) {
  // 电力状态
  const powered = powerSatOf(e) > 0;
  const pEl = body.querySelector('[data-live="rc-power"]');
  if (pEl) {
    const txt = e.launching ? '发射中 · 功率 2000kW' : (powered ? '供电正常' : '无电力 · 暂停');
    if (pEl.textContent !== txt) pEl.textContent = txt;
    const dot = pEl.parentNode.querySelector('.dot');
    if (dot) dot.className = 'dot ' + (e.launching ? 'launch' : (powered ? 'good' : ''));
  }
  // 火箭预览（与地图同款绘制，含装配/发射动画）
  const cv = body.querySelector('.rocket-cv');
  if (cv && cv.dataset.tv !== String(G.time)) { cv.dataset.tv = String(G.time); drawSiloPreview(e, cv); }
  // 组件流程行（签名变化才重建，避免闪烁/打断点击）
  const flow = body.querySelector('#rc-flow');
  if (flow) {
    const sig = rocketFlowSig(e);
    if (flow.dataset.sig !== sig) { flow.dataset.sig = sig; flow.innerHTML = rocketFlowHtml(e); }
  }
  // 火箭部件组装进度条（实时刷新；每产 1 件归零重走）
  const fpEl = body.querySelector('[data-live="rc-flowpct"]');
  if (fpEl) {
    const fpct = Math.min(100, Math.round(((e.asmT || 0) / ROCKET_PART_TIME) * 100));
    if (fpEl.textContent !== fpct + '%') fpEl.textContent = fpct + '%';
    const fbar = fpEl.parentNode.querySelector('i');
    if (fbar && fbar.style.width !== fpct + '%') fbar.style.width = fpct + '%';
  }
  // 两枚火箭制造进度条（连续生产：当前=min(parts,50)，下一枚=超出部分）
  const cur = Math.min(e.parts, ROCKET_PARTS);
  const next = Math.max(0, e.parts - ROCKET_PARTS);
  const curPct = Math.round(cur / ROCKET_PARTS * 100);
  const nextPct = Math.round(next / ROCKET_PARTS * 100);
  const curEl = body.querySelector('[data-live="rc-curpct"]');
  if (curEl) {
    if (curEl.textContent !== (cur + '/' + ROCKET_PARTS)) curEl.textContent = cur + '/' + ROCKET_PARTS;
    const bar = curEl.parentNode.querySelector('i');
    if (bar && bar.style.width !== curPct + '%') bar.style.width = curPct + '%';
  }
  const nextEl = body.querySelector('[data-live="rc-nextpct"]');
  if (nextEl) {
    if (nextEl.textContent !== (next + '/' + ROCKET_PARTS)) nextEl.textContent = next + '/' + ROCKET_PARTS;
    const bar = nextEl.parentNode.querySelector('i');
    if (bar && bar.style.width !== nextPct + '%') bar.style.width = nextPct + '%';
  }
  // 货舱格子（签名变化才重建）
  const cg = document.getElementById('rc-cargogrid');
  if (cg) {
    const sig = rocketCargoSig(e);
    if (cg.dataset.sig !== sig) { cg.dataset.sig = sig; cg.innerHTML = rocketCargoGridHtml(e); }
  }
  // 载荷使用量
  const loadEl = body.querySelector('[data-live="rc-loadpct"]');
  if (loadEl) {
    const v = rocketCargoTotal(e);
    if (loadEl.textContent !== (v + ' / 1 t')) loadEl.textContent = v + ' / 1 t';
    const bar = loadEl.parentNode.querySelector('i');
    if (bar) bar.style.width = Math.min(100, v / ROCKET_PAYLOAD_CAP * 100) + '%';
  }
  // 发射火箭按钮：火箭本体组装完成且已有载荷（卫星或货舱货物）时点亮
  const lcBtn = body.querySelector('[data-action="launch"]');
  if (lcBtn) lcBtn.disabled = !(e.hasRocket() && !e.launching && ((e.inp['satellite'] || 0) >= 1 || rocketCargoTotal(e) > 0));
  // 新建太空平台按钮（火箭未组装完成或起始包已装时禁用）
  const spBtn = body.querySelector('[data-action="cargo-feed"][data-id="space-platform-starter-pack"]');
  if (spBtn) spBtn.disabled = ((e.cargo['space-platform-starter-pack'] || 0) > 0) || !e.hasRocket();
  // 在途轨道货物
  const curPlanet = (typeof planetId === 'function') ? planetId() : 'nauvis';
  const tgt = e.cargoTarget || curPlanet;
  const oc = document.getElementById('rc-orbital');
  if (oc) {
    const q = (G.orbitalCargo && G.orbitalCargo[tgt]) || {};
    const sig = Object.keys(q).filter(k => (q[k] || 0) > 0).sort().map(k => k + ':' + q[k]).join(';');
    if (oc.dataset.sig !== sig) { oc.dataset.sig = sig; oc.innerHTML = rocketOrbitalHtml(e, tgt); }
  }
}

// 各区块的签名（数据变化才重建对应 DOM）
function rocketFlowSig(e) {
  let s = '';
  for (const k of Object.keys(SILO_ASSEMBLE)) s += k + ':' + (e.inp[k] || 0) + ';';
  s += 'p:' + e.parts + ';sat:' + (e.inp['satellite'] || 0) + ';';
  for (const m of ROCKET_MOD_ORDER) if ((e.modules[m] || 0) > 0) s += m + ':' + e.modules[m] + ';';
  return s;
}
function rocketCargoSig(e) {
  let s = '';
  const keys = Object.keys(e.cargo || {}).filter(k => (e.cargo[k] || 0) > 0).sort();
  for (const k of keys) s += k + ':' + e.cargo[k] + ';';
  return s + '|' + ((G.held && G.held.src && G.held.src.kind === 'chest' && G.held.src.ent === e) ? 'held' : '');
}

// 火箭预览绘制：把发射井按占地缩放入面板画布（与地图渲染同款，含动画）
function drawSiloPreview(e, cv) {
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.save();
  const w = e.w || 9, h = e.h || 9;
  const scale = Math.min(cv.width / (w * TILE), cv.height / (h * TILE));
  const ox = (cv.width - w * TILE * scale) / 2;
  const oy = cv.height - h * TILE * scale; // 贴底
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  try { drawRocketSilo(ctx, e, 0, 0, e.dir || 0, 1); } catch (err) { /* 预览绘制异常不影响面板 */ }
  ctx.restore();
}
function siloTip(e) {
  if (e.launching) return '发射中 ' + Math.ceil(10 - e.launchT) + 's';
  if (!e.hasRocket()) return '火箭部件 ' + e.parts + '/' + ROCKET_PARTS + (e.hasAssembleParts() ? '（自动组装中）' : '：缺少 ' + assemblePartsNeededStr(e));
  const over = Math.max(0, e.parts - ROCKET_PARTS);
  const extra = over > 0 ? '（下一枚已备 ' + over + '/' + ROCKET_PARTS + '）' : '';
  return ((e.inp['satellite'] || 0) > 0 ? '火箭+卫星齐备，可发射' : '火箭已就绪，等待放入卫星') + extra; }

// ===== 火箭发射成功 =====
function onRocketLaunch(silo) {
  const first = !G.gameWon;
  if (first) {
    G.gameWon = true;
    G.victoryT = 0;
    // 成就：发射火箭赢得游戏（对齐《异星工厂》：So long and thanks for all the fish）
    if (typeof checkAchievements === 'function') checkAchievements();
    if (typeof playSfx === 'function') playSfx('rocket');
    setTimeout(function () { if (typeof playSfx === 'function') playSfx('victory'); }, 1200);
  } else {
    // 后续重复发射：轻量反馈，不重复全屏胜利（对齐《异星工厂》：发射井可反复发射）
    if (typeof playSfx === 'function') playSfx('rocket');
  }
  // 每次卫星发射获得空间科学包（对齐《异星工厂》：Space science pack 由火箭发射产出，用于终局无限科研）
  // 火箭产物降落：若有物流接驳站（cargo-landing-pad），空间科学包降落到接驳站存储（对齐官方：火箭发射后产物降落于接驳站）
  const pad = findCargoLandingPad();
  // ===== 空间平台起始包发射：建造空间平台（对齐《异星工厂》Space Age：火箭发射起始包→空间平台骨架）=====
  // 若火箭货舱装有 space-platform-starter-pack，则发射后在该星球生成一个空间平台中枢（space-platform-hub），
  // 配合平台地基在太空铺设空间平台（起始包→中枢→地基→空间科研包）。
  // 起始包发射判定：基于 tryLaunch 记录的 launchedStarter 标志（起始包已在发射时从货舱消耗）。
  const launchStarter = !!(silo && silo.launchedStarter);
  // 起始包发射（建太空平台）不产出空间科研包，仅卫星发射产出。
  const withSatellite = !!(silo && silo.launchedSatellite);
  const spaceGain = withSatellite ? 100 : 0;
  if (launchStarter) {
    const spawnHub = (function () {
      const cls = ENT_CLASSES['space-platform-hub'];
      if (typeof cls !== 'function') return null;
      // 落点：优先物流接驳站旁；否则火箭发射井旁。
      const ox = (pad ? pad.x + pad.w + 1 : (silo ? silo.x : 8));
      const oy = (pad ? pad.y : (silo ? silo.y : 8));
      // 找一个空闲的 8×8 落点（在接驳站/发射井周围扫描）
      const baseX = ox, baseY = oy;
      let found = null;
      for (let dy = 0; dy <= 20 && !found; dy += 8) {
        for (let dx = -8; dx <= 8 && !found; dx += 8) {
          const tx = baseX + dx, ty = baseY + dy;
          let free = true;
          for (let yy = 0; yy < 8 && free; yy++) {
            for (let xx = 0; xx < 8 && free; xx++) {
              if (typeof solidAt === 'function' && solidAt(tx + xx, ty + yy)) { free = false; }
              else if (entAt && entAt(tx + xx, ty + yy)) { free = false; }
            }
          }
          if (free) { found = { x: tx, y: ty }; break; }
        }
      }
      if (!found) found = { x: baseX, y: baseY };
      const hub = new cls('space-platform-hub', found.x, found.y);
      if (typeof addEnt === 'function') { addEnt(hub); return hub; }
      return null;
    })();
    if (spawnHub) {
      if (typeof toast === 'function') toast('🚀 空间平台起始包发射成功！已在星球生成空间平台中枢（可放置平台地基）');
    } else if (typeof toast === 'function') {
      toast('🚀 空间平台起始包已发射（未生成中枢：需要先放置空间平台中枢建筑）');
    }
  }

  if (spaceGain > 0) {
    if (pad) {
      for (let i = 0; i < spaceGain; i++) pad.giveItem('space-science-pack');
      pad.cargoIn = (pad.cargoIn || 0) + spaceGain;
      if (typeof trackProd === 'function') trackProd('space-science-pack', spaceGain);
      if (typeof toast === 'function') toast('🛰️ 卫星发射成功，+' + spaceGain + ' 空间科学包已降落至物流接驳站！');
    } else {
      invAdd('space-science-pack', spaceGain);
      if (typeof trackProd === 'function') trackProd('space-science-pack', spaceGain);
      if (typeof toast === 'function') toast('🛰️ 卫星发射成功，获得 +' + spaceGain + ' 空间科学包！');
    }
  }
  // ===== 火箭货舱货物降落（太空货运 / 行星间调度）=====
  // 玩家装入火箭货舱的物品随火箭一起发射。
  // 目标星球与当前星球相同 → 降落到本星物流接驳站（否则返回背包）；
  // 目标星球不同 → 送入该星球轨道队列 G.orbitalCargo[planet]，玩家星际旅行抵达后交付
  // （对齐《异星工厂》：火箭可把货物送到目标星球轨道，实现行星间物资调度）。
  const curPlanet2 = (typeof planetId === 'function') ? planetId() : 'nauvis';
  const cargoTarget = (silo && silo.cargoTarget) || curPlanet2;
  const interplanet = cargoTarget !== curPlanet2;
  const siloCargo = (silo && silo.cargo) || {};
  let cargoItems = 0;
  if (interplanet) {
    // 行星间调度：装入目标星球轨道队列
    if (!G.orbitalCargo) G.orbitalCargo = {};
    if (!G.orbitalCargo[cargoTarget]) G.orbitalCargo[cargoTarget] = {};
    for (const k of Object.keys(siloCargo)) {
      const n = siloCargo[k] || 0;
      if (n <= 0) continue;
      G.orbitalCargo[cargoTarget][k] = (G.orbitalCargo[cargoTarget][k] || 0) + n;
      cargoItems += n;
    }
  } else {
    // 本地降落：降落到物流接驳站（若有），否则返回背包
    for (const k of Object.keys(siloCargo)) {
      const n = siloCargo[k] || 0;
      if (n <= 0) continue;
      let landed = 0;
      if (pad) {
        while (landed < n && pad.giveItem(k)) landed++;
        if (landed > 0) pad.cargoIn = (pad.cargoIn || 0) + landed;
      }
      // 接驳站装不下的（或没有接驳站）返回背包
      const rest = n - landed;
      if (rest > 0) invAdd(k, rest);
      if (typeof trackProd === 'function') trackProd(k, landed);
      cargoItems += n;
    }
  }
  if (silo) { silo.cargo = {}; silo.cargoTarget = null; }
  if (cargoItems > 0) {
    if (interplanet) {
      const tname = (typeof planetOption === 'function' && planetOption(cargoTarget)) ? planetOption(cargoTarget).name : cargoTarget;
      if (typeof toast === 'function') toast('📦 火箭货舱 ' + cargoItems + ' 件货物已送往' + tname + ' 轨道，抵达后交付');
    } else if (pad && typeof toast === 'function') toast('📦 火箭货舱 ' + cargoItems + ' 件货物已降落至物流接驳站！');
    else if (typeof toast === 'function') toast('📦 火箭货舱 ' + cargoItems + ' 件货物已随火箭返回');
  }
  if (first) {
    // 全屏胜利横幅
    showVictory();
    if (typeof toast === 'function') toast('🎉 恭喜！火箭发射成功，你赢得了游戏！');
    // 战斗胜利后停止刷怪，让玩家安心看烟花
    G.enemies = [];
  } else if (typeof toast === 'function') {
    toast('🚀 再次发射成功！空间科学包 +' + spaceGain);
  }
  uiDirty = true;
}

// 查找场景中的物流接驳站（cargo-landing-pad），供火箭货物降落。
// 官方仅允许每个地表建造一个接驳站；此处返回第一个（若有多个取最早放置者）。
function findCargoLandingPad() {
  if (typeof G.ents !== 'object') return null;
  for (const k in G.ents) {
    const e = G.ents[k];
    if (e && e.type === 'cargo-landing-pad' && e.w && e.h) return e;
  }
  return null;
}

function findSpacePlatformHub() {
  if (typeof G.ents !== 'object') return null;
  for (const k in G.ents) {
    const e = G.ents[k];
    if (e && e.type === 'space-platform-hub' && e.w && e.h) return e;
  }
  return null;
}


let victoryEl = null;
function showVictory() {
  if (victoryEl) { victoryEl.style.display = 'flex'; return; }
  victoryEl = document.createElement('div');
  victoryEl.id = 'victory-overlay';
  victoryEl.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;flex-direction:column;background:rgba(10,12,16,.7);color:#fff;font-family:system-ui;';
  victoryEl.innerHTML = '<div style="font-size:64px">🚀</div>' +
    '<div style="font-size:32px;font-weight:bold;margin:10px 0;color:#ffd23c">火箭发射成功！</div>' +
    '<div style="font-size:18px;color:#cfe8ff">恭喜，通关！！！</div>' +
    '<div style="margin-top:6px;font-size:14px;color:#8aa">您可以继续经营您的工厂</div>' +
    '<div style="margin-top:14px;font-size:14px;color:#8aa">敬请期待后续更新</div>' +
    '<div style="margin-top:16px;font-size:14px;color:#8aa">如果喜欢，欢迎给作者点一个 ⭐ Star</div>' +
    '<a href="https://github.com/smanx/factory-web" target="_blank" rel="noopener" title="给作者点个 Star" style="margin-top:12px;text-decoration:none;display:inline-block;border-radius:50%;">' +
      '<img src="https://github.com/smanx.png" alt="作者 GitHub 头像" width="64" height="64" style="border-radius:50%;border:2px solid #ffd23c;display:block;">' +
    '</a>' +
    '<button id="victory-close" style="margin-top:22px;padding:8px 40px;font-size:16px;color:#111;background:#ffd23c;border:none;border-radius:6px;cursor:pointer;font-family:system-ui;">关闭</button>';
  document.body.appendChild(victoryEl);
  // 需用户点击「关闭」按钮才关闭（不再自动消失）
  const closeBtn = document.getElementById('victory-close');
  if (closeBtn) closeBtn.addEventListener('click', () => {
    if (victoryEl) { victoryEl.remove(); victoryEl = null; }
  });
}

// ===== 雷达 =====
// 周期性扫描周围区域：点亮未探索区块，并把标记写入 world 用于小地图/提示。
const RADAR_RANGE = 8;
const RADAR_SWEEP = 2.5;   // 每次扫描间隔（秒）
class Radar extends Entity {
  constructor(type, x, y) {
    super('radar', x, y);
    this.t = 0;
  }
  update(dt) {
    this.t += dt;
    if (powerSatOf(this) <= 0) return;
    if (this.t < RADAR_SWEEP) return;
    this.t = 0;
    // 雷达周期性扫描：扩展世界探索（预生成扫描范围内区块并标记已探索，便于规划基地扩张）
    const cx = this.x + this.w / 2, cy = this.y + this.h / 2;
    if (typeof ensureChunk === 'function') {
      for (let dy = -RADAR_RANGE; dy <= RADAR_RANGE; dy++)
        for (let dx = -RADAR_RANGE; dx <= RADAR_RANGE; dx++) {
          if (dx * dx + dy * dy > RADAR_RANGE * RADAR_RANGE) continue;
          ensureChunk(cx + dx, cy + dy);
        }
    }
    if (typeof markExplored === 'function') markExplored(cx, cy, RADAR_RANGE);
  }
  powerDemand() { return GAME_DATA.radar?.power ?? 30; } // 官方雷达 energy_usage 300kW
  serialize() { return super.serialize(); }
  static restore(s) { return super.restore(s); }
}
function drawRadar(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#4a5a5a';
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 10); ctx.fill();
  ctx.strokeStyle = '#334040';
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 10); ctx.stroke();
  const cx = px + s / 2, cy = py + s / 2;
  // 旋转天线
  const ang = G.time * 2;
  ctx.strokeStyle = '#9ab0b0';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(ang) * s * 0.32, cy + Math.sin(ang) * s * 0.32); ctx.stroke();
  ctx.fillStyle = '#9ab0b0';
  ctx.beginPath(); ctx.arc(cx, cy, 5, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;
}
function radarPanelHtml(e) {
  let h = row('电力', powerStatusLiveHtml(e), 'power');
  h += '<div class="dim">雷达：吃电力周期性扫描周围 ' + RADAR_RANGE + ' 格区域，点亮并标记新探索区块，帮助规划基地扩张（3×3）。</div>';
  return h;
}
function radarPanelLive(e, api) {
  api.set('power', powerStatusLiveHtml(e));
  api.status(powerSatOf(e) <= 0 ? '已暂停：缺电' : '扫描中（每 ' + RADAR_SWEEP + ' 秒一轮）', powerSatOf(e) <= 0 ? 'warn' : 'ok');
}
function radarTip(e) {
  return powerSatOf(e) <= 0 ? '缺电停摆' : '扫描中（吃电力）';
}

// ===== 注册 =====
ENT_CLASSES['rocket-silo'] = RocketSilo;
ENT_CLASSES['radar'] = Radar;
DEVICE_RENDER['rocket-silo'] = drawRocketSilo;
DEVICE_RENDER['radar'] = drawRadar;
DEVICE_STATUS['rocket-silo'] = e => (e.launched ? 'g' : (e.launching ? 'g' : (e.hasRocket() && (e.inp['satellite'] || 0) > 0 ? 'y' : (e.hasAssembleParts() || e.hasRocket() ? 'y' : 'r'))));
DEVICE_STATUS['radar'] = e => (powerSatOf(e) <= 0 ? 'r' : 'g');
DEVICE_PANEL['rocket-silo'] = {
  html: siloPanelHtml, live: siloPanelLive, tip: siloTip,
  onAction: (act, btn) => {
    const mch = G.panelEnt;
    if (mch instanceof RocketSilo) {
      if (act === 'cargo-target') { mch.cargoTarget = btn.value; renderPanel(false); return true; }
      if (act === 'assemble') { mch.tryAssemble(); renderPanel(false); return true; }
      if (act === 'launch') { mch.tryLaunch(); renderPanel(false); return true; }
      if (act === 'cargo-feed') {
        const id = btn.dataset.id;
        const avail = Math.min(invCount(id), CARGO_CAP - (mch.cargo[id] || 0));
        if (avail > 0) { invTake(id, avail); mch.cargo[id] = (mch.cargo[id] || 0) + avail; if (typeof toast === 'function') toast('📦 已装入火箭货舱 ' + (ITEMS[id] ? ITEMS[id].name : id) + ' ×' + avail); }
        else if (typeof toast === 'function') toast('没有可装入的' + (ITEMS[id] ? ITEMS[id].name : id));
        renderPanel(false); return true;
      }
      if (act === 'cargo-take') { const id = btn.dataset.id; const n = mch.cargo[id] || 0; if (n > 0) { invAdd(id, n); delete mch.cargo[id]; toast('已取出' + (ITEMS[id] ? ITEMS[id].name : id) + ' ×' + n); } renderPanel(false); return true; }
      if (act === 'goto-hub') {
        // 前往太空平台：把镜头切到空间平台中枢所在位置
        const hub = findSpacePlatformHub();
        if (hub && G.cam) {
          G.cam.px = (hub.x + hub.w / 2) * TILE;
          G.cam.py = (hub.y + hub.h / 2) * TILE;
          if (G.cam.pan) { G.cam.pan.x = 0; G.cam.pan.y = 0; }
          if (typeof closePanel === 'function') closePanel();
          if (typeof toast === 'function') toast('🚀 已定位空间平台中枢');
        } else if (typeof toast === 'function') {
          toast('尚未建造空间平台中枢：在火箭装入「空间平台起始包」并发射后，本星会生成一个中枢');
        }
        return true;
      }
      if (act === 'cargo-slot') {
        // 货舱/装填格：有货→取出全部；空位→装入左侧选中物品一堆
        const id = btn.dataset.itemid;
        if (id && (mch.cargo[id] || 0) > 0) {
          const n = mch.cargo[id];
          invAdd(id, n); delete mch.cargo[id];
          if (typeof toast === 'function') toast('已取出' + (ITEMS[id] ? ITEMS[id].name : id) + ' ×' + n);
          renderPanel(false); return true;
        }
        const sel = (typeof selItem === 'function') ? selItem() : null;
        if (!sel) { if (typeof toast === 'function') toast('请先在左侧背包选中要装入的物品'); return true; }
        if (FLUIDS.indexOf(sel) >= 0) { if (typeof toast === 'function') toast(ITEMS[sel].name + ' 是流体，不能装入火箭货舱'); return true; }
        if (typeof isModule === 'function' && isModule(sel)) { if (typeof toast === 'function') toast('模块请放入发射井模块槽'); return true; }
        const avail = Math.min(invCount(sel), CARGO_CAP - (mch.cargo[sel] || 0));
        if (avail <= 0) { if (typeof toast === 'function') toast('没有可装入的' + (ITEMS[sel] ? ITEMS[sel].name : sel)); return true; }
        invTake(sel, avail); mch.cargo[sel] = (mch.cargo[sel] || 0) + avail;
        if (typeof toast === 'function') toast('📦 已装入火箭货舱 ' + (ITEMS[sel] ? ITEMS[sel].name : sel) + ' ×' + avail);
        renderPanel(false); return true;
      }
      if (act === 'mod-take') {
        // 模块槽：点击取回 1 个到背包
        const id = btn.dataset.id;
        if (id && (mch.modules[id] || 0) > 0) {
          mch.modules[id]--; if (mch.modules[id] <= 0) delete mch.modules[id];
          if (mch.prodBuf && Object.keys(mch.modules).filter(k => (mch.modules[k] || 0) > 0).length === 0) mch.prodBuf = 0;
          invAdd(id, 1);
          if (typeof toast === 'function') toast('已取回 ' + (ITEMS[id] ? ITEMS[id].name : id) + ' ×1');
          renderPanel(false); return true;
        }
        return true;
      }
    }
    return false;
  }
};
DEVICE_PANEL['radar'] = { html: radarPanelHtml, live: radarPanelLive, tip: radarTip };
DEVICE_DIR_ROTATE['rocket-silo'] = true;
DEVICE_DIR_ROTATE['radar'] = true;

// ===== 行星间货物调度交付（Space Age 太空货运）=====
// 火箭发射时若货舱目标星球 ≠ 当前星球，货物进入该星球的轨道队列 G.orbitalCargo[planet]。
// 玩家星际旅行抵达该星球时，交付函数把队列中的货物降落到物流接驳站（若有），
// 否则直接送进玩家背包——实现行星间物资调度（对齐《异星工厂》：火箭把货物送到目标星球轨道）。
function deliverOrbitalCargo(planet) {
  const queued = (G.orbitalCargo && G.orbitalCargo[planet]) || {};
  const keys = Object.keys(queued).filter(k => (queued[k] || 0) > 0);
  if (!keys.length) return 0;
  // 火箭→空间平台直投：若该星球存在空间平台中枢，货物直接投递到平台货舱，
  // 实现行星→平台的无玩家往返自动货运（对齐《异星工厂》Space Age 平台轨道物流）。
  const hub = findSpacePlatformHub();
  const pad = findCargoLandingPad();
  let delivered = 0, toHub = 0;
  for (const k of keys) {
    let n = queued[k] || 0;
    if (n <= 0) continue;
    let landed = 0;
    // 优先直投平台货舱（若中枢存在）：物品进入平台输入缓存/货舱，供平台自动消耗或派发
    if (hub && typeof hub.giveItem === 'function') {
      while (landed < n && hub.giveItem(k)) { landed++; }
      if (landed > 0) toHub += landed;
    }
    // 平台货舱满后剩余降落物流接驳站
    if (landed < n && pad) {
      while (landed < n && pad.giveItem(k)) { landed++; }
      if (landed > 0) pad.cargoIn = (pad.cargoIn || 0) + landed;
    }
    const rest = n - landed;
    if (rest > 0) invAdd(k, rest);
    if (typeof trackProd === 'function') trackProd(k, landed);
    delivered += n;
  }
  delete G.orbitalCargo[planet];
  if (delivered > 0 && typeof toast === 'function') {
    const name = (typeof planetOption === 'function' && planetOption(planet)) ? planetOption(planet).name : planet;
    const dest = toHub > 0 ? '已直投至空间平台货舱' : (pad ? '已降落至物流接驳站' : '已入背包');
    toast('📦 行星间货物已送达' + name + '：' + delivered + ' 件（' + dest + '）');
  }
  return delivered;
}
