'use strict';

// ===== 终局：火箭发射（对齐《异星工厂》Rocket silo + 卫星发射胜利）=====
// 火箭发射井（5×5，吃电力）分两阶段：
// ① 集齐火箭部件（火箭燃料×10、火箭控制单元×1、低密度结构×10）后点击「组装火箭」，
//    在井内组装出完整的火箭本体（rocket）；
// ② 放入卫星，点击「发射」进入倒计时，发射成功即赢得游戏。
// 对齐《异星工厂》：发射井先组装出火箭，再放入卫星发射。

// 组装一枚火箭所需部件（对齐《异星工厂》火箭本体组装）
const SILO_ASSEMBLE = {
  'rocket-fuel': 10,
  'rocket-control-unit': 1,
  'low-density-structure': 10
};
const SILO_CAP = 100;
// 火箭产能（对齐《异星工厂》Rocket productivity）：每级降低火箭燃料与低密度结构部件需求（最低保留 1）。
function siloPartNeed(k) { return (typeof rocketPartNeed === 'function') ? rocketPartNeed(k, SILO_ASSEMBLE[k]) : SILO_ASSEMBLE[k]; }
class RocketSilo extends CircuitNode {
  constructor(type, x, y) {
    super('rocket-silo', x, y);
    this.inp = {};           // 井内物品：组装部件 + 火箭本体 + 卫星
    this.launching = false;  // 发射倒计时中
    this.launchT = 0;
    this.launched = false;   // 已发射完成
  }
  // 电路网络信号输出（对齐《异星工厂》：火箭发射井可接入电路网络读取井内状态）。
  // 输出信号：signal-rocket 火箭本体数量、signal-satellite 卫星数量、
  // signal-rocket-parts 已就位组装部件数、signal-rocket-launch 发射倒计时标志。
  outputCircuitSignals() {
    const out = [];
    const rocket = this.inp['rocket'] || 0;
    const sat = this.inp['satellite'] || 0;
    let parts = 0;
    for (const k in SILO_ASSEMBLE) if ((this.inp[k] || 0) >= siloPartNeed(k)) parts++;
    if (rocket > 0) out.push({ sig: 'signal-rocket', count: rocket });
    if (sat > 0) out.push({ sig: 'signal-satellite', count: sat });
    if (parts > 0) out.push({ sig: 'signal-rocket-parts', count: parts });
    if (this.launching) out.push({ sig: 'signal-rocket-launch', count: 1 });
    return out;
  }
  giveItem(item) {
    if (item !== 'rocket' && item !== 'satellite' && !SILO_ASSEMBLE[item]) return false;
    if ((this.inp[item] || 0) >= SILO_CAP) return false;
    this.inp[item] = (this.inp[item] || 0) + 1;
    // 火箭部件/卫星送入井内：厚重金属装配声
    if (typeof playSfx === 'function') playSfx('rocket-part');
    return true;
  }
  takeItem() {
    const keys = ['rocket', 'satellite'].concat(Object.keys(SILO_ASSEMBLE));
    for (const k of keys)
      if (this.inp[k] > 0) return this.takeItemOf(k);
    return null;
  }
  countOf(item) { return this.inp[item] || 0; }
  takeItemOf(item) {
    if ((this.inp[item] || 0) > 0) { this.inp[item]--; if (this.inp[item] <= 0) delete this.inp[item]; return item; }
    return null;
  }
  contents() {
    return [[this.type, 1]].concat(Object.keys(this.inp).map(k => [k, this.inp[k]]));
  }
  // 组装部件是否集齐（不含卫星/火箭本体）
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
  // 已组装出火箭本体（可发射条件之一）
  hasRocket() { return (this.inp['rocket'] || 0) >= 1; }
  // 发射就绪：有火箭本体且已有卫星
  hasAllParts() { return this.hasRocket() && (this.inp['satellite'] || 0) >= 1; }
  // 组装火箭：消耗组装部件生成火箭本体
  tryAssemble() {
    if (this.hasRocket()) { if (typeof toast === 'function') toast('火箭已组装完成！'); return false; }
    if (!this.hasAssembleParts()) {
      if (typeof toast === 'function') toast('火箭部件未集齐：需要 ' + assemblePartsNeededStr(this));
      return false;
    }
    for (const k in SILO_ASSEMBLE) this.inp[k] -= siloPartNeed(k);
    if ((this.inp['rocket'] || 0) <= 0) this.inp['rocket'] = 0;
    this.inp['rocket']++;
    if (typeof toast === 'function') toast('🛠️ 火箭组装完成！放入卫星即可发射');
    uiDirty = true;
    return true;
  }
  tryLaunch() {
    if (this.launched || this.launching) return false;
    if (G.power.sat <= 0) { if (typeof toast === 'function') toast('发射需要电力！'); return false; }
    if (!this.hasAllParts()) {
      if (typeof toast === 'function') toast('尚未就绪：需要完整火箭本体与卫星');
      return false;
    }
    // 消耗火箭本体 + 卫星开始发射
    this.inp['rocket']--; if (this.inp['rocket'] <= 0) delete this.inp['rocket'];
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
      this.launched = true;
      onRocketLaunch();
    }
  }
  powerDemand() { return this.launching ? 2000 : 20; }
  serialize() {
    const s = super.serialize();
    s.inp = this.inp; s.launching = this.launching; s.launchT = this.launchT; s.launched = this.launched;
    return s;
  }
  static restore(s) {
    const t = super.restore(s);
    t.inp = s.inp || {}; t.launching = !!s.launching; t.launchT = s.launchT || 0; t.launched = !!s.launched;
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
    ctx.fillStyle = 'rgba(255,255,255,.5)';
    ctx.beginPath(); ctx.arc(cx, cy, s * 0.18, 0, 7); ctx.fill();
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
    for (const k of Object.keys(SILO_ASSEMBLE)) {
      const have = e.inp[k] || 0;
      const need = siloPartNeed(k);
      const ready = have >= need;
      ctx.fillStyle = ready ? '#57e389' : '#c0b090';
      ctx.fillText(ITEMS[k].name[0] + (have > need ? '✓' : (have > 0 ? String(Math.min(have, need)) : '')), bx, by);
      bx += 12;
    }
  } else {
    ctx.fillStyle = (e.inp['satellite'] || 0) > 0 ? '#57e389' : '#c0b090';
    ctx.fillText('卫星' + ((e.inp['satellite'] || 0) > 0 ? '✓' : ''), bx, by);
  }
  if (e.launching) {
    ctx.fillStyle = '#ffd23c';
    ctx.textAlign = 'center';
    ctx.fillText('发射中 ' + Math.ceil(10 - e.launchT) + 's', cx, cy - 50);
  }
  ctx.globalAlpha = 1;
}
function siloPanelHtml(e) {
  let h = '';
  if (!e.hasRocket()) {
    // 阶段①：组装火箭
    h += '<div class="sec">组装火箭本体（阶段 1/2）</div>';
    const ready = e.assembleReady();
    for (const k of Object.keys(SILO_ASSEMBLE)) {
      const have = e.inp[k] || 0;
      const need = siloPartNeed(k);
      h += row(ITEMS[k].name, (ready[k] ? '✓ ' : '') + have + '/' + need, k);
    }
    h += '<button data-action="assemble" id="btn-assemble" ' + (e.hasRocket() || !e.hasAssembleParts() ? 'disabled' : '') + '>🛠️ 组装火箭</button>';
  } else {
    // 阶段②：放入卫星发射
    h += '<div class="sec">火箭已组装完成（阶段 2/2）</div>';
    h += row(ITEMS['rocket'].name, '✓ 就绪', 'rocket');
    const haveSat = e.inp['satellite'] || 0;
    h += row(ITEMS['satellite'].name, (haveSat > 0 ? '✓ ' : '') + haveSat + '/1', 'satellite');
    h += '<button data-action="feed" data-id="satellite" ' + (haveSat > 0 ? 'disabled' : '') + '>放入卫星</button>';
  }
  h += '<button data-action="launch" id="btn-launch" ' + ((e.launched || e.launching || !e.hasAllParts()) ? 'disabled' : '') + '>' +
    (e.launching ? '发射中…' : e.launched ? '已发射' : '🚀 发射火箭') + '</button>';
  h += '<div class="status"></div>';
  h += '<div class="dim">火箭发射井分两阶段（对齐《异星工厂》）：① 集齐火箭燃料×10、火箭控制单元×1、低密度结构×10，点击「组装火箭」在井内组装出火箭本体；② 放入卫星后点击「发射」。发射倒计时需持续供电，成功后赢得游戏！部件可用机械臂/手动放入（5×5，吃电力）。</div>';
  return h;
}
function siloPanelLive(e, api) {
  const assembleBtn = document.getElementById('btn-assemble');
  if (assembleBtn) {
    assembleBtn.disabled = e.hasRocket() || !e.hasAssembleParts();
    assembleBtn.textContent = '🛠️ 组装火箭';
  }
  if (!e.hasRocket()) {
    const ready = e.assembleReady();
    for (const k of Object.keys(SILO_ASSEMBLE)) {
      const have = e.inp[k] || 0;
      api.set(k, (ready[k] ? '✓ ' : '') + have + '/' + siloPartNeed(k));
    }
  } else {
    const haveSat = e.inp['satellite'] || 0;
    api.set('rocket', '✓ 就绪');
    api.set('satellite', (haveSat > 0 ? '✓ ' : '') + haveSat + '/1');
    const feedBtn = document.querySelector('[data-action="feed"][data-id="satellite"]');
    if (feedBtn) feedBtn.disabled = haveSat > 0;
  }
  const launchBtn = document.getElementById('btn-launch');
  if (launchBtn) {
    launchBtn.disabled = e.launched || e.launching || !e.hasAllParts();
    launchBtn.textContent = e.launching ? '发射中…' : (e.launched ? '已发射' : '🚀 发射火箭');
  }
  if (e.launched) api.status('✅ 火箭已发射！', 'ok');
  else if (e.launching) api.status('🚀 发射倒计时 ' + Math.ceil(10 - e.launchT) + ' 秒（需供电）', 'ok');
  else if (G.power.sat <= 0) api.status('已暂停：缺电', 'warn');
  else if (!e.hasRocket() && !e.hasAssembleParts()) api.status('待组装：缺少 ' + assemblePartsNeededStr(e), 'warn');
  else if (!e.hasRocket()) api.status('部件齐备，点击「🛠️ 组装火箭」！', 'ok');
  else if (!(e.inp['satellite'] || 0)) api.status('火箭已就绪，放入卫星后点击「🚀 发射火箭」！', 'ok');
  else api.status('全部就绪，点击「🚀 发射火箭」！', 'ok');
}
function siloTip(e) {
  if (e.launched) return '火箭已发射！';
  if (e.launching) return '发射中 ' + Math.ceil(10 - e.launchT) + 's';
  if (!e.hasRocket()) return e.hasAssembleParts() ? '部件齐备，可组装' : ('待组装：缺少 ' + assemblePartsNeededStr(e));
  return (e.inp['satellite'] || 0) > 0 ? '火箭+卫星齐备，可发射' : '火箭已就绪，等待放入卫星'; }

// ===== 火箭发射成功 =====
function onRocketLaunch() {
  G.gameWon = true;
  G.victoryT = 0;
  // 成就：发射火箭赢得游戏（对齐《异星工厂》：So long and thanks for all the fish）
  if (typeof checkAchievements === 'function') checkAchievements();
  if (typeof playSfx === 'function') playSfx('rocket');
  setTimeout(function () { if (typeof playSfx === 'function') playSfx('victory'); }, 1200);
  // 每次卫星发射获得空间科学包（对齐《异星工厂》：Space science pack 由火箭发射产出，用于终局无限科研）
  const spaceGain = 100;
  invAdd('space-science-pack', spaceGain);
  if (typeof trackProd === 'function') trackProd('space-science-pack', spaceGain);
  if (typeof toast === 'function') toast('🛰️ 卫星发射成功，获得 +' + spaceGain + ' 空间科学包！');
  // 全屏胜利横幅
  showVictory();
  if (typeof toast === 'function') toast('🎉 恭喜！火箭发射成功，你赢得了游戏！');
  // 战斗胜利后停止刷怪，让玩家安心看烟花
  G.enemies = [];
  uiDirty = true;
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
  powerDemand() { return 30; }
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
  ctx.fillStyle = '#cfe8e8';
  ctx.font = 'bold 11px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('雷达', cx, cy + s * 0.4);
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
    if (act === 'assemble' && mch instanceof RocketSilo) {
      mch.tryAssemble(); renderPanel(false); return true;
    }
    if (act === 'launch') {
      if (mch instanceof RocketSilo) { mch.tryLaunch(); renderPanel(false); return true; }
    }
    return false;
  }
};
DEVICE_PANEL['radar'] = { html: radarPanelHtml, live: radarPanelLive, tip: radarTip };
DEVICE_DIR_ROTATE['rocket-silo'] = true;
DEVICE_DIR_ROTATE['radar'] = true;
