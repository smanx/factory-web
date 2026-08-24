'use strict';

// ===== 终局：火箭发射（对齐《异星工厂》Rocket silo + 卫星发射胜利）=====
// 火箭发射井（5×5，吃电力）收集火箭部件：火箭燃料×10、火箭控制单元×1、
// 低密度结构×10、卫星×1。集齐后点击「发射」进入倒计时，发射成功即赢得游戏。

const SILO_PARTS = {
  'rocket-fuel': 10,
  'rocket-control-unit': 1,
  'low-density-structure': 10,
  'satellite': 1
};
const SILO_CAP = 100;
class RocketSilo extends Entity {
  constructor(type, x, y) {
    super('rocket-silo', x, y);
    this.inp = {};
    this.launching = false;   // 发射倒计时中
    this.launchT = 0;
    this.launched = false;    // 已发射完成
  }
  giveItem(item) {
    if (!SILO_PARTS[item]) return false;
    if ((this.inp[item] || 0) >= SILO_CAP) return false;
    this.inp[item] = (this.inp[item] || 0) + 1;
    return true;
  }
  takeItem() {
    for (const k of Object.keys(SILO_PARTS))
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
  hasAllParts() {
    for (const k in SILO_PARTS) if ((this.inp[k] || 0) < SILO_PARTS[k]) return false;
    return true;
  }
  partsReady() {
    const out = {};
    for (const k in SILO_PARTS) {
      const have = this.inp[k] || 0;
      out[k] = have >= SILO_PARTS[k];
    }
    return out;
  }
  tryLaunch() {
    if (this.launched || this.launching) return false;
    if (G.power.sat <= 0) { if (typeof toast === 'function') toast('发射需要电力！'); return false; }
    if (!this.hasAllParts()) {
      if (typeof toast === 'function') toast('火箭部件未集齐：需要 ' + partsNeededStr(this));
      return false;
    }
    // 消耗部件开始发射
    for (const k in SILO_PARTS) this.inp[k] -= SILO_PARTS[k];
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
function partsNeededStr(e) {
  const need = [];
  for (const k in SILO_PARTS) {
    const have = e.inp[k] || 0;
    if (have < SILO_PARTS[k]) need.push(ITEMS[k].name + ' ×' + (SILO_PARTS[k] - have));
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
  } else {
    ctx.fillStyle = '#b0b8c0';
    rr(ctx, cx - 8, cy - 24, 16, 30, 4); ctx.fill();
    ctx.fillStyle = '#d04a4a';
    ctx.beginPath(); ctx.moveTo(cx - 8, cy - 24); ctx.lineTo(cx + 8, cy - 24); ctx.lineTo(cx, cy - 36); ctx.closePath(); ctx.fill();
  }
  // 各部件状态
  let bx = px + 10, by = py + s - 24;
  ctx.font = 'bold 9px system-ui';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  for (const k of Object.keys(SILO_PARTS)) {
    const have = e.inp[k] || 0;
    const need = SILO_PARTS[k];
    const ready = have >= need;
    ctx.fillStyle = ready ? '#57e389' : '#c0b090';
    ctx.fillText(ITEMS[k].name[0] + (have > need ? '✓' : (have > 0 ? String(Math.min(have, need)) : '')), bx, by);
    bx += 12;
  }
  if (e.launching) {
    ctx.fillStyle = '#ffd23c';
    ctx.textAlign = 'center';
    ctx.fillText('发射中 ' + Math.ceil(10 - e.launchT) + 's', cx, cy - 50);
  }
  ctx.globalAlpha = 1;
}
function siloPanelHtml(e) {
  let h = '<div class="sec">火箭部件</div>';
  const ready = e.partsReady();
  for (const k of Object.keys(SILO_PARTS)) {
    const have = e.inp[k] || 0;
    const need = SILO_PARTS[k];
    h += row(ITEMS[k].name, (ready[k] ? '✓ ' : '') + have + '/' + need, ready[k] ? 'ok' : '');
  }
  h += '<button data-action="feed" data-id="satellite" ' + (ready.satellite ? 'disabled' : '') + '>放入卫星</button>';
  h += '<button data-action="launch" id="btn-launch" ' + (e.launched ? 'disabled' : '') + '>' +
    (e.launching ? '发射中…' : e.launched ? '已发射' : '🚀 发射火箭') + '</button>';
  h += '<div class="status"></div>';
  h += '<div class="dim">火箭发射井：集齐火箭燃料×10、火箭控制单元×1、低密度结构×10、卫星×1 后点击发射。发射倒计时需持续供电，成功后赢得游戏！部件可用机械臂/手动放入（5×5，吃电力）。</div>';
  return h;
}
function siloPanelLive(e, api) {
  const ready = e.partsReady();
  for (const k of Object.keys(SILO_PARTS)) {
    const have = e.inp[k] || 0;
    api.set(k, (ready[k] ? '✓ ' : '') + have + '/' + SILO_PARTS[k]);
  }
  const launchBtn = document.getElementById('btn-launch');
  if (launchBtn) {
    launchBtn.disabled = e.launched || e.launching;
    launchBtn.textContent = e.launching ? '发射中…' : (e.launched ? '已发射' : '🚀 发射火箭');
  }
  if (e.launched) api.status('✅ 火箭已发射！', 'ok');
  else if (e.launching) api.status('🚀 发射倒计时 ' + Math.ceil(10 - e.launchT) + ' 秒（需供电）', 'ok');
  else if (G.power.sat <= 0) api.status('已暂停：缺电', 'warn');
  else if (!e.hasAllParts()) api.status('待发射：缺少 ' + partsNeededStr(e), 'warn');
  else api.status('全部就绪，点击「🚀 发射火箭」！', 'ok');
}
function siloTip(e) {
  if (e.launched) return '火箭已发射！';
  if (e.launching) return '发射中 ' + Math.ceil(10 - e.launchT) + 's';
  return e.hasAllParts() ? '部件齐备，可发射' : ('缺少 ' + partsNeededStr(e));
}

// ===== 火箭发射成功 =====
function onRocketLaunch() {
  G.gameWon = true;
  G.victoryT = 0;
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
DEVICE_STATUS['rocket-silo'] = e => (e.launched ? 'g' : (e.launching ? 'g' : (e.hasAllParts() ? 'y' : 'r')));
DEVICE_STATUS['radar'] = () => (G.power.sat <= 0 ? 'r' : 'g');
DEVICE_PANEL['rocket-silo'] = {
  html: siloPanelHtml, live: siloPanelLive, tip: siloTip,
  onAction: (act, btn) => {
    if (act === 'launch') {
      const mch = G.panelEnt;
      if (mch instanceof RocketSilo) { mch.tryLaunch(); renderPanel(false); return true; }
    }
    return false;
  }
};
DEVICE_PANEL['radar'] = { html: radarPanelHtml, live: radarPanelLive, tip: radarTip };
DEVICE_DIR_ROTATE['rocket-silo'] = true;
DEVICE_DIR_ROTATE['radar'] = true;
