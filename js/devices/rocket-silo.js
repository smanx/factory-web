'use strict';

// ===== 火箭发射井（终局建筑，对齐《异星工厂》Rocket silo）=====
// 固定配方：4 低密度结构 + 4 火箭燃料 + 4 处理器 → 1 火箭部件（部件存于井内，不可取出）。
// 攒满 ROCKET_PARTS_TOTAL(100) 个后自动点火发射（可在面板关闭自动发射改为手动）。
// 发射动画结束后 G.launches++，首次发射弹出通关庆祝画面。

class RocketSilo extends Entity {
  constructor(type, x, y) {
    super('rocket-silo', x, y);
    this.inp = {};            // 原料缓存
    this.parts = 0;           // 已组装火箭部件数
    this.prog = 0;            // 当前部件组装进度
    this.crafting = false;
    this.launching = false;   // 点火发射中
    this.launchT = 0;         // 发射动画计时
    this.autoLaunch = true;
    this.working = false;
  }
  powerDemand() {
    return (this.crafting || this.launching) ? POWER_USE['rocket-silo'] : 0;
  }
  giveItem(item) {
    if (!(ROCKET_PART_RECIPE.inp[item] > 0)) return false;
    if ((this.inp[item] || 0) >= SILO_INPUT_CAP) return false;
    this.inp[item] = (this.inp[item] || 0) + 1;
    return true;
  }
  peekItem() { return null; }   // 部件存于井内，不可抓取
  takeItem() { return null; }
  countOf(item) { return this.inp[item] || 0; }
  takeItemOf(item) {
    // 仅允许取回未使用的原料（误放取回），部件不可取出
    if ((this.inp[item] || 0) > 0) { this.inp[item]--; if (this.inp[item] <= 0) delete this.inp[item]; return item; }
    return null;
  }
  contents() {
    const list = [[this.type, 1]];
    for (const k in this.inp) list.push([k, this.inp[k]]);
    return list;
  }
  missingInputs() {
    const miss = [];
    for (const k in ROCKET_PART_RECIPE.inp)
      if ((this.inp[k] || 0) < ROCKET_PART_RECIPE.inp[k]) miss.push(k);
    return miss;
  }
  update(dt) {
    this.working = false;
    if (this.launching) {
      this.launchT += dt;
      if (this.launchT >= ROCKET_LAUNCH_DUR) {
        // 发射完成：计数 + 庆祝
        this.launching = false;
        this.launchT = 0;
        this.parts = 0;
        G.launches = (G.launches || 0) + 1;
        toast('🚀 第 ' + G.launches + ' 枚火箭发射成功！');
        if (!G.rocketWon && typeof showLaunchOverlay === 'function') {
          G.rocketWon = true;
          showLaunchOverlay();
        }
      }
      return;
    }
    if (G.power.sat <= 0) { this.crafting = false; return; }
    if (this.crafting) {
      this.working = true;
      this.prog += dt * powerFactor();
      if (this.prog >= ROCKET_PART_TIME) {
        this.prog = 0;
        this.crafting = false;
        this.parts++;
        if (typeof trackProd === 'function') trackProd('rocket-part', 1);
        if (this.parts >= ROCKET_PARTS_TOTAL) {
          if (this.autoLaunch) this.ignite();
          else toast('火箭已就绪：打开发射井面板点击「立即发射」');
        }
      }
      return;
    }
    const miss = this.missingInputs();
    if (miss.length) return;
    for (const k in ROCKET_PART_RECIPE.inp) {
      this.inp[k] -= ROCKET_PART_RECIPE.inp[k];
      if (typeof trackProd === 'function') trackProd(k, -ROCKET_PART_RECIPE.inp[k]);
      if (this.inp[k] <= 0) delete this.inp[k];
    }
    this.crafting = true;
    this.prog = 0;
  }
  ignite() {
    if (this.launching || this.parts < ROCKET_PARTS_TOTAL) return;
    this.launching = true;
    this.launchT = 0;
    this.crafting = false;
    this.prog = 0;
    uiDirty = true;
    toast('🚀 火箭点火发射！');
  }
  serialize() {
    const s = super.serialize();
    s.inp = this.inp; s.parts = this.parts; s.prog = this.prog;
    s.crafting = this.crafting; s.launching = this.launching;
    s.launchT = this.launchT; s.autoLaunch = this.autoLaunch;
    return s;
  }
  blueprint() { const s = super.blueprint(); return s; }   // 蓝图仅复制建筑本身
  static restore(s) {
    const e = super.restore(s);
    e.inp = s.inp || {}; e.parts = s.parts || 0; e.prog = s.prog || 0;
    e.crafting = !!s.crafting; e.launching = !!s.launching;
    e.launchT = s.launchT || 0;
    e.autoLaunch = s.autoLaunch !== undefined ? !!s.autoLaunch : true;
    return e;
  }
}

// ===== 渲染 =====
// 布局：7×7 混凝土平台，中央 3×3 圆形发射塔；组装时进度弧，
// 点火后舱门开启、火箭升空并喷射尾焰与烟雾。
function drawRocketSilo(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * 7;
  ctx.globalAlpha = alpha;
  // 混凝土平台
  ctx.fillStyle = '#6a6f78';
  rr(ctx, px + 4, py + 4, s - 8, s - 8, 10); ctx.fill();
  ctx.strokeStyle = '#454a52';
  ctx.lineWidth = 4;
  rr(ctx, px + 4, py + 4, s - 8, s - 8, 10); ctx.stroke();
  // 平台格纹
  if (!LOD.simple) {
    ctx.strokeStyle = 'rgba(0,0,0,.14)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 7; i++) {
      ctx.beginPath();
      ctx.moveTo(px + 4 + i * TILE, py + 6); ctx.lineTo(px + 4 + i * TILE, py + s - 6);
      ctx.moveTo(px + 6, py + 4 + i * TILE); ctx.lineTo(px + s - 6, py + 4 + i * TILE);
      ctx.stroke();
    }
  }
  // 四角警示条纹
  if (!LOD.simple) {
    ctx.fillStyle = '#d0b23c';
    for (const [ox, oy] of [[14, 14], [s - 30, 14], [14, s - 22], [s - 30, s - 22]]) {
      ctx.fillRect(px + ox, py + oy, 16, 8);
      ctx.fillStyle = '#2a2c30';
      ctx.fillRect(px + ox + 4, py + oy, 4, 8);
      ctx.fillRect(px + ox + 11, py + oy, 2, 8);
      ctx.fillStyle = '#d0b23c';
    }
  }
  const cx = px + s / 2, cy = py + s / 2;

  // ===== 发射动画 =====
  let rocketLift = 0, doorOpen = 0;
  if (e.launching) {
    const t = e.launchT;
    doorOpen = Math.min(1, t / 1.5);                                  // 前1.5s 开门
    rocketLift = Math.max(0, Math.min(1, (t - 1.5) / (ROCKET_LAUNCH_DUR - 3))) * TILE * 9;
    // 尾焰与烟雾（升空阶段）
    if (rocketLift > 0 && !LOD.simple) {
      const flameLen = 26 + Math.sin(G.time * 40) * 8;
      const fy = cy - rocketLift - 34;
      const grad = ctx.createLinearGradient(cx, fy, cx, fy + flameLen);
      grad.addColorStop(0, 'rgba(255,240,180,.95)');
      grad.addColorStop(0.5, 'rgba(255,140,40,.75)');
      grad.addColorStop(1, 'rgba(255,80,20,0)');
      ctx.fillStyle = grad;
      tri(ctx, cx - 7, fy, cx + 7, fy, cx, fy + flameLen); ctx.fill();
      for (let i = 0; i < 7; i++) {
        const ph = (G.time * 1.7 + i * 1.31) % 1;
        const sx2 = cx + Math.sin(i * 37.7 + Math.floor(G.time * 6)) * 18 * ph;
        const sy2 = cy - rocketLift + ph * TILE * 3.2;
        ctx.fillStyle = 'rgba(' + (190 + (i % 3) * 20) + ',' + (185 + (i % 2) * 25) + ',180,' + (0.42 * (1 - ph)).toFixed(2) + ')';
        ctx.beginPath();
        ctx.arc(sx2, sy2, 5 + ph * 12, 0, 7);
        ctx.fill();
      }
    }
  }

  // 舱门（双开式）
  const doorW = TILE * 1.55 * doorOpen;
  ctx.fillStyle = '#3a3e46';
  ctx.fillRect(cx - TILE * 1.55, cy - TILE * 0.28, TILE * 1.55 - doorW * 0.92, TILE * 0.56);
  ctx.fillRect(cx + doorW * 0.92, cy - TILE * 0.28, TILE * 1.55 - doorW * 0.92, TILE * 0.56);

  // 中央发射塔（圆环体）
  ctx.fillStyle = '#8a92a2';
  ctx.beginPath(); ctx.arc(cx, cy, TILE * 1.55, 0, 7); ctx.fill();
  ctx.strokeStyle = '#565c68'; ctx.lineWidth = 4;
  ctx.stroke();
  ctx.fillStyle = '#59606e';
  ctx.beginPath(); ctx.arc(cx, cy, TILE * 1.12, 0, 7); ctx.fill();

  // 火箭本体（待发/升空）
  const ry = cy - TILE * 0.35 - rocketLift;
  ctx.save();
  ctx.translate(cx, ry);
  // 箭体
  ctx.fillStyle = '#e8ecf2';
  rr(ctx, -9, -46, 18, 58, 7); ctx.fill();
  ctx.strokeStyle = '#9aa4b2'; ctx.lineWidth = 2;
  rr(ctx, -9, -46, 18, 58, 7); ctx.stroke();
  // 整流罩尖头
  ctx.fillStyle = '#d05548';
  tri(ctx, -9, -44, 9, -44, 0, -64); ctx.fill();
  // 舷窗
  ctx.fillStyle = '#4aa8d8';
  ctx.beginPath(); ctx.arc(0, -32, 4, 0, 7); ctx.fill();
  // 尾翼
  ctx.fillStyle = '#d05548';
  tri(ctx, -9, 4, -15, 16, -9, 14); ctx.fill();
  tri(ctx, 9, 4, 15, 16, 9, 14); ctx.fill();
  ctx.restore();

  // 进度弧（组装中显示当前部件进度；就绪时满圈金色）
  const pct = e.crafting ? Math.min(1, e.prog / ROCKET_PART_TIME)
    : (e.parts >= ROCKET_PARTS_TOTAL ? 1 : (e.parts / ROCKET_PARTS_TOTAL) * 0.999);
  if (pct > 0 && !LOD.simple) {
    ctx.strokeStyle = e.parts >= ROCKET_PARTS_TOTAL ? '#ffd23c' : '#8fe08f';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(cx, cy, TILE * 1.85, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
    ctx.stroke();
  }
  // 部件计数
  if (!LOD.simple) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(e.parts + '/' + ROCKET_PARTS_TOTAL, cx, cy + TILE * 2.6);
    ctx.font = 'bold 11px system-ui';
    ctx.fillText(e.launching ? '发射中！' : '火箭发射井', cx, cy - TILE * 2.6);
  }
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function rocketSiloPanelHtml(e) {
  let h = row('状态', '', 'state');
  h += row('电力', powerStatusLiveHtml(e), 'power');
  h += '<div class="sec">火箭部件 ' + e.parts + ' / ' + ROCKET_PARTS_TOTAL + '</div>';
  h += barHtml(Math.min(100, e.parts / ROCKET_PARTS_TOTAL * 100));
  h += '<div class="sec">组装进度</div>' + barHtml(0);
  h += row('输入', Object.keys(e.inp).length ? countStr(e.inp) : '<span class="dim">空</span>', 'input');
  for (const k in ROCKET_PART_RECIPE.inp) {
    const n = Math.min(invCount(k), SILO_INPUT_CAP - (e.inp[k] || 0));
    if (n > 0) h += '<button data-action="feed" data-id="' + k + '">放入' + ITEMS[k].name + ' ×' + n + '</button>';
  }
  if (Object.keys(e.inp).length) h += '<button data-action="takein">取回全部输入</button>';
  h += '<div class="sec">发射控制</div>';
  h += '<label class="setrow"><input type="checkbox" data-silo-auto' + (e.autoLaunch ? ' checked' : '') + '> 满 ' + ROCKET_PARTS_TOTAL + ' 部件自动发射</label>';
  h += '<button data-action="silo-launch"' + (e.parts >= ROCKET_PARTS_TOTAL && !e.launching ? '' : ' disabled style="opacity:.45"') +
    '>🚀 立即发射（' + e.parts + '/' + ROCKET_PARTS_TOTAL + '）</button>';
  h += '<div class="status"></div>';
  h += '<div class="dim">发射井固定配方：低密度结构×4 + 火箭燃料×4 + 处理器×4 → 1 个火箭部件（' + ROCKET_PART_TIME + ' 秒/件）。用机械臂把三种原料送入井内即可自动组装；攒满 ' + ROCKET_PARTS_TOTAL + ' 个部件后火箭就绪并自动点火。发射火箭是本游戏的终极目标！</div>';
  return h;
}
function rocketSiloPanelLive(e, api) {
  api.set('power', powerStatusLiveHtml(e));
  api.set('input', Object.keys(e.inp).length ? countStr(e.inp) : dimSpan('空'));
  api.prog(e.crafting ? e.prog / ROCKET_PART_TIME * 100 : (e.launching ? 100 : 0));
  if (e.launching) { api.set('state', '<span style="color:#ffd23c">🚀 点火发射中…</span>'); api.status('发射中：火箭正在升空！', 'ok'); return; }
  if (G.power.sat <= 0 && (e.crafting || e.missingInputs().length === 0)) { api.status('已暂停：缺电', 'bad'); return; }
  const miss = e.missingInputs();
  if (miss.length) { api.set('state', '<span class="dim">等待原料</span>'); api.status('已暂停：缺少 ' + miss.map(k => ITEMS[k].name).join('、'), 'warn'); return; }
  if (e.parts >= ROCKET_PARTS_TOTAL) { api.set('state', '<span style="color:#ffd23c">火箭已就绪！</span>'); api.status('火箭已就绪：随时可以发射', 'ok'); return; }
  api.set('state', e.crafting ? '<span style="color:#8fe08f">组装火箭部件中</span>' : '<span class="dim">待机</span>');
  api.status(e.crafting ? '生产中：组装火箭部件' : '待机', e.crafting ? 'ok' : 'warn');
}
function rocketSiloTip(e) {
  if (e.launching) return '🚀 火箭发射中！';
  if (e.parts >= ROCKET_PARTS_TOTAL) return '火箭已就绪（' + e.parts + '/' + ROCKET_PARTS_TOTAL + '），即将发射';
  if (e.crafting) return '组装火箭部件 ' + e.parts + '/' + ROCKET_PARTS_TOTAL;
  const miss = e.missingInputs();
  return miss.length ? '等待原料：缺 ' + miss.map(k => ITEMS[k].name).join('、') : '火箭发射井';
}

// ===== 注册 =====
ENT_CLASSES['rocket-silo'] = RocketSilo;
DEVICE_RENDER['rocket-silo'] = drawRocketSilo;
DEVICE_STATUS['rocket-silo'] = e => {
  if (e.launching) return 'g';
  if (G.power.sat <= 0 && !e.crafting && !e.missingInputs().length) return 'r';
  return e.crafting ? 'g' : (e.missingInputs().length ? 'y' : 'y');
};
DEVICE_PANEL['rocket-silo'] = { html: rocketSiloPanelHtml, live: rocketSiloPanelLive, tip: rocketSiloTip };
