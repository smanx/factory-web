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

// 火箭货舱可运输的物品：玩家背包中可装入火箭发射的货物。
// 排除：火箭部件/卫星/部件原料、流体、模块、创造/虚空测试设备。
// 返回背包中可装货物的物品 id 列表（按背包顺序）。
function cargoLoadableItems() {
  const excl = new Set(['satellite', 'rocket-part', 'rocket-fuel', 'processing-unit', 'low-density-structure',
    'creative-chest', 'void-chest', 'creative-pipe', 'void-pipe', 'creative-belt', 'void-belt']);
  const out = [];
  if (!(G.inv instanceof Map)) return out;
  for (const [id, n] of G.inv) {
    if (n <= 0) continue;
    if (excl.has(id)) continue;
    if (FLUIDS.indexOf(id) >= 0) continue;
    if (typeof isModule === 'function' && isModule(id)) continue;
    out.push(id);
  }
  return out;
}
// 组装出完整火箭所需火箭部件数（对齐《异星工厂》：发射井逐件组装火箭部件，集齐后拼装成完整火箭本体）。
// 原版需 100 件；本作结合经济规模取 10 件，使产能模块装进发射井（4 槽）能真正累积免费部件、缩减终局材料投入，
// 复现《异星工厂》"火箭井装产能模块"的经典玩法。每件部件配方 = SILO_ASSEMBLE（火箭燃料×10 + 处理单元×10 + 低密度结构×10）。
const ROCKET_PARTS = 10;
// 火箭产能（对齐《异星工厂》Rocket productivity）：每级降低火箭燃料与低密度结构部件需求（最低保留 1）。
function siloPartNeed(k) { return (typeof rocketPartNeed === 'function') ? rocketPartNeed(k, SILO_ASSEMBLE[k]) : SILO_ASSEMBLE[k]; }
class RocketSilo extends CircuitNode {
  constructor(type, x, y) {
    super('rocket-silo', x, y);
    this.inp = {};           // 井内物品：组装部件
    this.parts = 0;          // 已组装的火箭部件数（对齐《异星工厂》：逐件组装，集齐 ROCKET_PARTS 件后拼成火箭）
    this.modules = {};       // 发射井模块（4 槽，对齐《异星工厂》：火箭井可装速度/产能/效率模块）
    this.prodBuf = 0;        // 产能模块累积进度
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
      if (typeof playSfx === 'function') playSfx('rocket-part');
      return true;
    }
    if ((this.inp[item] || 0) >= SILO_CAP) return false;
    this.inp[item] = (this.inp[item] || 0) + 1;
    // 火箭部件/卫星送入井内：厚重金属装配声
    if (typeof playSfx === 'function') playSfx('rocket-part');
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
  // 发射就绪：有完整火箭本体且已有卫星
  hasAllParts() { return this.hasRocket() && (this.inp['satellite'] || 0) >= 1; }
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
    if (this.hasRocket()) { if (typeof toast === 'function') toast('🛠️ 火箭部件集齐，完整火箭组装完成！放入卫星即可发射'); }
    else if (typeof toast === 'function') toast('🔩 火箭部件组装完成（' + this.parts + '/' + ROCKET_PARTS + '）');
    uiDirty = true;
    return true;
  }
  tryLaunch() {
    if (this.launching) return false;
    if (G.power.sat <= 0) { if (typeof toast === 'function') toast('发射需要电力！'); return false; }
    if (!this.hasAllParts()) {
      if (typeof toast === 'function') toast('尚未就绪：需要完整火箭本体与卫星');
      return false;
    }
    // 消耗卫星开始发射（火箭本体随发射离场）
    this.parts = 0;
    this.inp['satellite']--; if (this.inp['satellite'] <= 0) delete this.inp['satellite'];
    this.launching = true;
    this.launchT = 0;
    if (typeof toast === 'function') toast('🚀 火箭发射倒计时 10 秒…');
    uiDirty = true;
    return true;
  }
  update(dt) {
    if (!this.launching) return;
    if (G.power.sat <= 0) return;   // 发射需要持续供电
    this.launchT += dt;
    if (this.launchT >= 10) {
      this.launching = false;
      this.launchCount++;
      this.launched = true;
      onRocketLaunch(this);
    }
  }
  powerDemand() { return this.launching ? 2000 : 20; }
  serialize() {
    const s = super.serialize();
    s.inp = this.inp; s.parts = this.parts; s.modules = this.modules; s.prodBuf = this.prodBuf;
    s.launching = this.launching; s.launchT = this.launchT; s.launched = this.launched; s.launchCount = this.launchCount || 0;
    s.cargo = this.cargo; s.cargoTarget = this.cargoTarget || null;
    return s;
  }
  static restore(s) {
    const t = super.restore(s);
    t.inp = s.inp || {}; t.parts = s.parts || 0; t.modules = s.modules || {}; t.prodBuf = s.prodBuf || 0; t.cargo = s.cargo || {}; t.cargoTarget = s.cargoTarget || null;
    t.launching = !!s.launching; t.launchT = s.launchT || 0; t.launched = !!s.launched; t.launchCount = s.launchCount || (s.launched ? 1 : 0);
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
  ctx.globalAlpha = alpha;
  // 底座
  ctx.fillStyle = '#4a3f36';
  rr(ctx, px + 6, py + 6, s - 12, s - 12, 8); ctx.fill();
  ctx.strokeStyle = '#2e2822';
  ctx.lineWidth = 4;
  rr(ctx, px + 6, py + 6, s - 12, s - 12, 8); ctx.stroke();
  // 发射台中心
  const cx = px + s / 2, cy = py + s / 2;
  ctx.fillStyle = '#6a5a4a';
  ctx.beginPath(); ctx.arc(cx, cy, s * 0.22, 0, 7); ctx.fill();
  ctx.strokeStyle = '#3a322a';
  ctx.lineWidth = 2; ctx.stroke();
  // 火箭本体（发射中上升）
  if (e.launching) {
    const rise = Math.min(1, e.launchT / 10);
    const ry = cy - rise * s * 0.9;
    ctx.fillStyle = '#c0c8d0';
    rr(ctx, cx - 10, ry - 40, 20, 40, 4); ctx.fill();
    ctx.fillStyle = '#d04a4a';
    ctx.beginPath(); ctx.moveTo(cx - 10, ry - 40); ctx.lineTo(cx + 10, ry - 40); ctx.lineTo(cx, ry - 56); ctx.closePath(); ctx.fill();
    // 尾焰
    ctx.fillStyle = 'rgba(255,160,60,.8)';
    ctx.beginPath(); ctx.moveTo(cx - 8, ry); ctx.lineTo(cx + 8, ry); ctx.lineTo(cx, ry + 18 + Math.random() * 8); ctx.closePath(); ctx.fill();
  } else if (e.launched) {
    // 已发射过：发射台上短暂保留白色余晖（发射井可再次组装复用）
    ctx.fillStyle = 'rgba(255,255,255,.35)';
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.15, 0, 7); ctx.fill();
  } else if (e.hasRocket()) {
    // 已组装完成的火箭本体矗立在发射台上
    ctx.fillStyle = '#c0c8d0';
    rr(ctx, cx - 8, cy - 30, 16, 34, 4); ctx.fill();
    ctx.strokeStyle = '#8a929c';
    ctx.lineWidth = 2;
    rr(ctx, cx - 8, cy - 30, 16, 34, 4); ctx.stroke();
    ctx.fillStyle = '#d04a4a';
    ctx.beginPath(); ctx.moveTo(cx - 8, cy - 30); ctx.lineTo(cx + 8, cy - 30); ctx.lineTo(cx, cy - 42); ctx.closePath(); ctx.fill();
    // 卫星装在火箭头
    ctx.fillStyle = '#c8d0e8';
    ctx.beginPath(); ctx.arc(cx, cy - 46, 4, 0, 7); ctx.fill();
  } else {
    ctx.fillStyle = '#b0b8c0';
    rr(ctx, cx - 8, cy - 24, 16, 30, 4); ctx.fill();
    ctx.fillStyle = '#d04a4a';
    ctx.beginPath(); ctx.moveTo(cx - 8, cy - 24); ctx.lineTo(cx + 8, cy - 24); ctx.lineTo(cx, cy - 36); ctx.closePath(); ctx.fill();
  }
  // 组装部件状态（装配中）
  let bx = px + 10, by = py + s - 24;
  ctx.font = 'bold 9px system-ui';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  if (!e.hasRocket()) {
    // 显示部件进度 + 当前原料齐备状态
    ctx.fillStyle = '#ffd23c';
    ctx.fillText(e.parts + '/' + ROCKET_PARTS, bx, by);
    bx += 12;
    for (const k of Object.keys(SILO_ASSEMBLE)) {
      const have = e.inp[k] || 0;
      const need = siloPartNeed(k);
      const ready = have >= need;
      // 用物品颜色小点标识部件（不再显示中文）
      ctx.fillStyle = ITEMS[k] ? ITEMS[k].color : '#c0b090';
      ctx.beginPath(); ctx.arc(bx - 4, by, 3, 0, 7); ctx.fill();
      ctx.fillStyle = ready ? '#57e389' : '#c0b090';
      ctx.fillText(have > need ? '✓' : (have > 0 ? String(Math.min(have, need)) : ''), bx, by);
      bx += 12;
    }
  } else {
    ctx.fillStyle = (e.inp['satellite'] || 0) > 0 ? '#57e389' : '#c0b090';
    ctx.fillText('🛰' + ((e.inp['satellite'] || 0) > 0 ? '✓' : ''), bx, by);
  }
  if (e.launching) {
    ctx.fillStyle = '#ffd23c';
    ctx.textAlign = 'center';
    ctx.fillText('🚀 ' + Math.ceil(10 - e.launchT) + 's', cx, cy - 50);
  }
  ctx.globalAlpha = 1;
}
function siloPanelHtml(e) {
  let h = '';
  if (e.launchCount > 0) {
    h += '<div class="sec">🛰️ 已累计发射 ' + e.launchCount + ' 次（对齐《异星工厂》：发射井可反复发射，每次产出空间科学包）</div>';
  }
  if (!e.hasRocket()) {
    // 阶段①：逐件组装火箭部件
    h += '<div class="sec">组装火箭部件（阶段 1/2）' + e.parts + '/' + ROCKET_PARTS + '</div>';
    h += row('火箭部件', e.parts + '/' + ROCKET_PARTS, 'rocket-part');
    const ready = e.assembleReady();
    for (const k of Object.keys(SILO_ASSEMBLE)) {
      const have = e.inp[k] || 0;
      const need = siloPartNeed(k);
      h += row(ITEMS[k].name, (ready[k] ? '✓ ' : '') + have + '/' + need, k);
    }
    h += '<button data-action="assemble" id="btn-assemble" ' + (e.hasRocket() || !e.hasAssembleParts() ? 'disabled' : '') + '>🛠️ 组装 1 个火箭部件</button>';
  } else {
    // 阶段②：放入卫星发射
    h += '<div class="sec">火箭已组装完成（阶段 2/2）</div>';
    h += row(ITEMS['rocket-body'].name, '✓ 就绪', 'rocket-body');
    const haveSat = e.inp['satellite'] || 0;
    h += row(ITEMS['satellite'].name, (haveSat > 0 ? '✓ ' : '') + haveSat + '/1', 'satellite');
    h += '<button data-action="feed" data-id="satellite" ' + (haveSat > 0 ? 'disabled' : '') + '>放入卫星</button>';
    // 火箭货舱（太空货运）：把任意物品装入火箭，随发射降落到物流接驳站
    h += '<div class="sec">🚀 火箭货舱（太空货运）</div>';
    const cargoKeys = Object.keys(e.cargo || {});
    // 目标星球选择（行星间货物调度）：把货物送往目标星球轨道，抵达后交付；默认当前星球=本地降落
    const curPlanet = (typeof planetId === 'function') ? planetId() : 'nauvis';
    const tgt = e.cargoTarget || curPlanet;
    let targetSel = '<select data-action="cargo-target" style="margin:4px 0 6px;max-width:100%">';
    const planetOpts = (typeof PLANET_OPTIONS !== 'undefined') ? PLANET_OPTIONS : [{ v: 'nauvis', name: '新地星' }];
    for (const po of planetOpts) {
      const cur = (po.v === curPlanet);
      targetSel += '<option value="' + po.v + '"' + (po.v === tgt ? ' selected' : '') + '>' +
        (cur ? '🛰️ ' : '🌍 ') + po.name + (cur ? '（本地）' : '') + '</option>';
    }
    targetSel += '</select>';
    h += '<div class="dim" style="margin-top:2px">📮 目标星球：' + targetSel + '</div>';
    // 显示目标星球轨道中的在途货物（行星间调度）
    if ((G.orbitalCargo && G.orbitalCargo[tgt]) || null) {
      const ocKeys = Object.keys(G.orbitalCargo[tgt]).filter(k => (G.orbitalCargo[tgt][k] || 0) > 0);
      if (ocKeys.length) {
        const ocRows = ocKeys.map(k => {
          const ic = (ITEMS[k] && ITEMS[k].color) ? '<span class="chip" style="background:' + ITEMS[k].color + '">' + (ITEMS[k].mark || '') + '</span> ' : '';
          return '<span>' + ic + (ITEMS[k] ? ITEMS[k].name : k) + ' ×' + G.orbitalCargo[tgt][k] + '</span>';
        }).join('  ');
        const tgtName = (typeof planetOption === 'function' && planetOption(tgt)) ? planetOption(tgt).name : tgt;
        h += '<div class="dim" style="margin-top:3px;color:#7fd07f">🛬 在途轨道货物（抵达' + tgtName + '后交付）：' + ocRows + '</div>';
      }
    }
    if (cargoKeys.length) {
      const crows = cargoKeys.map(k => {
        const cnt = e.cargo[k] || 0;
        const ic = (ITEMS[k] && ITEMS[k].color) ? '<span class="chip" style="background:' + ITEMS[k].color + '">' + (ITEMS[k].mark || '') + '</span> ' : '';
        return '<div class="rcrow"><span>' + ic + (ITEMS[k] ? ITEMS[k].name : k) + ' ×' + cnt + '</span>' +
          '<button data-action="cargo-take" data-id="' + k + '" title="取出全部">取出</button></div>';
      }).join('');
      h += '<div class="rcbody">' + crows + '</div>';
    } else {
      h += '<div class="dim">货舱为空。装入货物后随火箭发射：目标星球与当前星球相同则降落到本星物流接驳站，不同则送往目标星球轨道、抵达后交付。</div>';
    }
    // 从背包装入货物：列出玩家背包中可运输的物品，点击即装入一批
    h += '<div class="dim" style="margin-top:4px">从背包装入货物（点击物品装入 1 堆，随火箭发射降落到物流接驳站）：</div>';
    h += '<div class="recgrid" id="rc-cargogrid">';
    const own = cargoLoadableItems();
    if (own.length) {
      for (const id of own) {
        const n = Math.min(invCount(id), CARGO_CAP - (e.cargo[id] || 0));
        if (n <= 0) continue;
        h += '<button class="rcbtn" data-action="cargo-feed" data-id="' + id + '" data-itemid="' + id + '" ' + (e.launching ? 'disabled' : '') + ' title="装入' + (ITEMS[id] ? ITEMS[id].name : id) + ' ×' + n + '">' +
          '<img src="' + iconDataURL(id) + '">' + (ITEMS[id] ? ITEMS[id].name : id) + ' ×' + n + '</button>';
      }
    } else {
      h += '<div class="dim">背包中没有可装入的货物。</div>';
    }
    h += '</div>';
  }
  h += '<button data-action="launch" id="btn-launch" ' + ((e.launching || !e.hasAllParts()) ? 'disabled' : '') + '>' +
    (e.launching ? '发射中…' : '🚀 发射火箭') + '</button>';
  h += '<div class="status"></div>';
  // 模块槽（4 槽，对齐《异星工厂》：火箭井可装速度/产能/效率模块，产能模块累积免费部件）
  h += modulePanelSection(e);
  h += '<div class="dim">火箭发射井分两阶段（对齐《异星工厂》）：① 集齐火箭燃料×10、火箭控制单元×1、低密度结构×10 组装出 1 个火箭部件，逐件组装共 ' + ROCKET_PARTS + ' 个部件后拼成完整火箭；② 放入卫星后点击「发射」。发射井有 4 个模块槽，装产能模块可免费累积额外部件、装速度模块加速组装；装火箭产能科技可降低部件需求。发射倒计时需持续供电，成功后赢得游戏，且发射井可反复发射继续冲刺无限科研（对齐《异星工厂》：Rocket silo 可复用，每次卫星发射获得空间科学包）！部件可用机械臂/手动放入（9×9，吃电力，占地来自 GAME_DATA.footprint 官方 selection_box ±4.5）。</div>';
  return h;
}
function siloPanelLive(e, api) {
  const assembleBtn = document.getElementById('btn-assemble');
  if (assembleBtn) {
    assembleBtn.disabled = e.hasRocket() || !e.hasAssembleParts();
    assembleBtn.textContent = '🛠️ 组装 1 个火箭部件';
  }
  if (!e.hasRocket()) {
    const ready = e.assembleReady();
    api.set('rocket-part', e.parts + '/' + ROCKET_PARTS);
    for (const k of Object.keys(SILO_ASSEMBLE)) {
      const have = e.inp[k] || 0;
      api.set(k, (ready[k] ? '✓ ' : '') + have + '/' + siloPartNeed(k));
    }
  } else {
    const haveSat = e.inp['satellite'] || 0;
    api.set('rocket-body', '✓ 就绪');
    api.set('satellite', (haveSat > 0 ? '✓ ' : '') + haveSat + '/1');
    const feedBtn = document.querySelector('[data-action="feed"][data-id="satellite"]');
    if (feedBtn) feedBtn.disabled = haveSat > 0;
    const cargoFeedBtn = document.querySelector('[data-action="cargo-feed"]');
    if (cargoFeedBtn) cargoFeedBtn.disabled = !!e.launching;
  }
  const launchBtn = document.getElementById('btn-launch');
  if (launchBtn) {
    launchBtn.disabled = e.launching || !e.hasAllParts();
    launchBtn.textContent = e.launching ? '发射中…' : '🚀 发射火箭';
  }
  if (e.launching) api.status('🚀 发射倒计时 ' + Math.ceil(10 - e.launchT) + ' 秒（需供电）', 'ok');
  else if (G.power.sat <= 0) api.status('已暂停：缺电', 'warn');
  else if (!e.hasRocket() && !e.hasAssembleParts()) api.status('待组装：缺少 ' + assemblePartsNeededStr(e), 'warn');
  else if (!e.hasRocket()) api.status('部件原料齐备，点击「🛠️ 组装 1 个火箭部件」！', 'ok');
  else if (!(e.inp['satellite'] || 0)) api.status('火箭已就绪，放入卫星后点击「🚀 发射火箭」！', 'ok');
  else api.status('全部就绪，点击「🚀 发射火箭」！', 'ok');
}
function siloTip(e) {
  if (e.launching) return '发射中 ' + Math.ceil(10 - e.launchT) + 's';
  if (!e.hasRocket()) return '火箭部件 ' + e.parts + '/' + ROCKET_PARTS + (e.hasAssembleParts() ? '（原料齐备，可组装）' : '：缺少 ' + assemblePartsNeededStr(e));
  return (e.inp['satellite'] || 0) > 0 ? '火箭+卫星齐备，可发射' : '火箭已就绪，等待放入卫星'; }

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
  const spaceGain = 100;
  // 火箭产物降落：若有物流接驳站（cargo-landing-pad），空间科学包降落到接驳站存储（对齐官方：火箭发射后产物降落于接驳站）
  const pad = findCargoLandingPad();
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

let victoryEl = null;
function showVictory() {
  if (victoryEl) { victoryEl.style.display = 'flex'; return; }
  victoryEl = document.createElement('div');
  victoryEl.id = 'victory-overlay';
  victoryEl.style.cssText = 'position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;flex-direction:column;background:rgba(10,12,16,.7);color:#fff;font-family:system-ui;pointer-events:none;';
  victoryEl.innerHTML = '<div style="font-size:64px">🚀</div>' +
    '<div style="font-size:32px;font-weight:bold;margin:10px 0;color:#ffd23c">火箭发射成功！</div>' +
    '<div style="font-size:18px;color:#cfe8ff">你已从这颗星球逃离，赢得了《工厂原型》</div>' +
    '<div style="margin-top:14px;font-size:14px;color:#8aa">按 K 存档，或继续经营你的工厂</div>';
  document.body.appendChild(victoryEl);
  setTimeout(() => { if (victoryEl) victoryEl.style.opacity = '0'; victoryEl.style.transition = 'opacity 2s'; setTimeout(() => { if (victoryEl) victoryEl.remove(); victoryEl = null; }, 2200); }, 5000);
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
    if (G.power.sat <= 0) return;
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
  h += '<div class="status"></div>';
  h += '<div class="dim">雷达：吃电力周期性扫描周围 ' + RADAR_RANGE + ' 格区域，点亮并标记新探索区块，帮助规划基地扩张（3×3）。</div>';
  return h;
}
function radarPanelLive(e, api) {
  api.set('power', powerStatusLiveHtml(e));
  api.status(G.power.sat <= 0 ? '已暂停：缺电' : '扫描中（每 ' + RADAR_SWEEP + ' 秒一轮）', G.power.sat <= 0 ? 'warn' : 'ok');
}
function radarTip(e) {
  return G.power.sat <= 0 ? '缺电停摆' : '扫描中（吃电力）';
}

// ===== 注册 =====
ENT_CLASSES['rocket-silo'] = RocketSilo;
ENT_CLASSES['radar'] = Radar;
DEVICE_RENDER['rocket-silo'] = drawRocketSilo;
DEVICE_RENDER['radar'] = drawRadar;
DEVICE_STATUS['rocket-silo'] = e => (e.launched ? 'g' : (e.launching ? 'g' : (e.hasRocket() && (e.inp['satellite'] || 0) > 0 ? 'y' : (e.hasAssembleParts() || e.hasRocket() ? 'y' : 'r'))));
DEVICE_STATUS['radar'] = () => (G.power.sat <= 0 ? 'r' : 'g');
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
  const pad = findCargoLandingPad();
  let delivered = 0;
  for (const k of keys) {
    let n = queued[k] || 0;
    if (n <= 0) continue;
    let landed = 0;
    if (pad) {
      while (landed < n && pad.giveItem(k)) landed++;
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
    toast('📦 行星间货物已送达' + name + '：' + delivered + ' 件' + (pad ? '降落至物流接驳站' : '已入背包'));
  }
  return delivered;
}
