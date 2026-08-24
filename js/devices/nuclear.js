'use strict';

// ===== 核能链（对齐《异星工厂》Nuclear power）=====
// 完整链路：铀矿 → 离心机分离铀同位素 → 合成核燃料棒 → 核反应堆燃烧产热
//   → 热管导热 → 换热器把 ≥500°C 的热量烧水成蒸汽 → 汽轮机高效发电。
//
// 热力学模型：反应堆/热管/换热器都是“热实体”，各自持有热量 heat（热单位），
//   温度 = heat / (w*h*HEAT_CAP_PER_TILE) * HEAT_TEMP_MAX。相邻热实体按温差导热；
//   反应堆燃烧燃料棒持续注入热量，换热器在 ≥500°C 时把热量转化为蒸汽。
//
// 配套数值：1 反应堆(240热/s) = 4 换热器(60热/s)；1 换热器产汽 2.4/s = 2 汽轮机(1.2/s)；
//   1 汽轮机 3600kW = 4 台蒸汽机 ⇒ 一台反应堆 ≈ 32 台蒸汽机的终局电力。

// ===== 热实体通用工具 =====
function heatCapOf(e) { return e.w * e.h * HEAT_CAP_PER_TILE; }
function heatTempOf(e) { return e.heat / heatCapOf(e) * HEAT_TEMP_MAX; }
function isHeatEnt(e) { return e && e.heat !== undefined && e.conductsHeat; }
// 温度→颜色（暗红→橙→白热的黑体辐射渐变），供热管/反应堆/换热器渲染共用
function heatGlowColor(t) {
  const p = Math.max(0, Math.min(1, t / HEAT_EXCH_TEMP_MIN)); // 以工作温度为满格基准
  if (p < 0.25) return '#3a2020';
  if (p < 0.5) return '#8a3018';
  if (p < 0.8) return '#d06428';
  if (p < 1.2) return '#f0a048';
  return '#fff0d0';
}
// 相邻热实体导热：正温差 a→b，流量与温差成正比，受双方余量钳制
function conductHeat(a, b, dt) {
  const d = heatTempOf(a) - heatTempOf(b);
  if (Math.abs(d) < 0.05) return;
  let q = d * HEAT_TRANSFER_K * dt;
  if (q > 0) q = Math.min(q, a.heat, heatCapOf(b) - b.heat);
  else q = Math.max(q, -b.heat, -(heatCapOf(a) - a.heat));
  if (!q) return;
  a.heat -= q; b.heat += q;
}
// 与所有相邻热实体换热（每 tick 由各设备 update 调用）。
// 关键：每对邻居只结算一次——由锚点 (x,y) 字典序较小的实体发起，
// 否则同一对会在两端各结算一次，热量在一帧内来回倒手造成"振荡锁死"。
function flowHeatWithNeighbors(e, dt) {
  forEachNeighborEnt(e, n => {
    if (!isHeatEnt(n)) return;
    if (e.x > n.x || (e.x === n.x && e.y > n.y)) return;
    conductHeat(e, n, dt);
  });
}

// ===== 离心机：铀加工 / Kovarex 铀浓缩 / 核废料再处理（3×3，吃电力）=====
class Centrifuge extends Entity {
  constructor(type, x, y) {
    super('centrifuge', x, y);
    this.recipe = null;
    this.inp = {};
    this.outp = {};
    this.crafting = false;
    this.prog = 0;
    this.spin = 0;
    this.working = false;
  }
  setRecipe(id) {
    if (this.recipe === id) return;
    this.recipe = id;
    this.inp = {}; this.outp = {};
    this.crafting = false; this.prog = 0;
  }
  update(dt) {
    this.working = false;
    const rec = this.recipe ? CENTRIFUGE_RECIPES[this.recipe] : null;
    if (!rec) { this.prog = 0; return; }
    if (this.crafting) {
      if (G.power.sat <= 0) return;
      this.working = true;
      this.spin += dt * 10;   // 高速旋转
      this.prog += dt * powerFactor();
      if (this.prog >= rec.time) {
        grantOutputWithBonus(this, rec, null);
        this.crafting = false;
        this.prog = 0;
      }
      return;
    }
    for (const k in rec.inp) if ((this.inp[k] || 0) < rec.inp[k]) return;
    for (const k in rec.out) if ((this.outp[k] || 0) + rec.out[k] > 50) return;
    for (const k in rec.inp) {
      this.inp[k] -= rec.inp[k];
      if (typeof trackProd === 'function') trackProd(k, -rec.inp[k]);
      if (this.inp[k] <= 0) delete this.inp[k];
    }
    this.crafting = true;
    this.prog = 0;
  }
  giveItem(item) {
    if (!this.recipe) return false;
    const rec = CENTRIFUGE_RECIPES[this.recipe];
    if (!rec.inp[item]) return false;
    if ((this.inp[item] || 0) >= 50) return false;
    this.inp[item] = (this.inp[item] || 0) + 1;
    return true;
  }
  peekItem() {
    for (const k in this.outp) if (this.outp[k] > 0) return k;
    return null;
  }
  takeItem() {
    for (const k in this.outp) if (this.outp[k] > 0) return this.takeItemOf(k);
    return null;
  }
  countOf(item) { return this.outp[item] || 0; }
  takeItemOf(item) {
    if ((this.outp[item] || 0) > 0) { this.outp[item]--; if (this.outp[item] <= 0) delete this.outp[item]; return item; }
    return null;
  }
  powerDemand() { return this.recipe ? POWER_USE['centrifuge'] : 0; }
  contents() {
    const list = [[this.type, 1]];
    for (const k in this.inp) list.push([k, this.inp[k]]);
    for (const k in this.outp) list.push([k, this.outp[k]]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.recipe = this.recipe; s.inp = this.inp; s.outp = this.outp;
    s.crafting = this.crafting; s.prog = this.prog;
    return s;
  }
  blueprint() { const s = super.blueprint(); s.recipe = this.recipe; return s; }
  static restore(s) {
    const c = super.restore(s);
    c.recipe = s.recipe || null; c.inp = s.inp || {}; c.outp = s.outp || {};
    c.crafting = !!s.crafting; c.prog = s.prog || 0;
    return c;
  }
}

// ===== 渲染 =====
function drawCentrifuge(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * 3;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#6d7c50';
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 10); ctx.fill();
  ctx.strokeStyle = '#45523a';
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 10); ctx.stroke();
  ctx.fillStyle = '#57653f';
  rr(ctx, px + 10, py + 10, s - 20, s - 20, 6); ctx.fill();
  // 转子：离心分离中高速旋转，外圈随速度出现模糊光环
  const cx = px + s / 2, cy = py + s / 2;
  if (e.working || e.crafting) {
    ctx.strokeStyle = 'rgba(190,235,140,.35)';
    ctx.lineWidth = 5;
    ctx.beginPath(); ctx.arc(cx, cy, 26, 0, 7); ctx.stroke();
  }
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((e.working || e.crafting) ? e.spin : 0);
  ctx.fillStyle = (e.working || e.crafting) ? '#d8e6b8' : '#88956e';
  gearShape(ctx, 0, 0, 20, 13, 9);
  ctx.fill();
  ctx.restore();
  // 中央配方图标 + 进度环
  if (e.recipe) {
    const rec = CENTRIFUGE_RECIPES[e.recipe];
    drawRecipeIconCell(ctx, cx, cy, Object.keys(rec.out)[0]);
    const pct = e.crafting ? Math.min(1, e.prog / rec.time) : 0;
    if (pct > 0) {
      ctx.strokeStyle = '#8fe08f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy, 30, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
      ctx.stroke();
    }
  } else if (!(LOD && LOD.simple)) {
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('无配方', cx, cy + 34);
  }
  ctx.font = 'bold 11px system-ui';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#eef4e4';
  ctx.fillText('离心机', px + 8, py + s - 12);
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function centrifugePanelHtml(e) {
  let h = row('当前配方', e.recipe ? CENTRIFUGE_RECIPES[e.recipe].name : '<span class="dim">未设置</span>');
  h += machRateHtml(e.recipe ? CENTRIFUGE_RECIPES[e.recipe] : null, e.recipe ? 1 : 1);
  h += row('电力', powerStatusLiveHtml(e), 'power');
  h += row('输入', Object.keys(e.inp).length ? countStr(e.inp) : '<span class="dim">空</span>', 'input');
  if (e.recipe)
    for (const k in CENTRIFUGE_RECIPES[e.recipe].inp) {
      const n = Math.min(invCount(k), 50 - (e.inp[k] || 0));
      if (n > 0) h += '<button data-action="feed" data-id="' + k + '">放入' +
        ITEMS[k].name + ' ×' + n + '</button>';
    }
  if (Object.keys(e.inp).length) h += '<button data-action="takein">取回全部输入</button>';
  h += row('产物', Object.keys(e.outp).length ? countStr(e.outp) : '<span class="dim">空</span>', 'output');
  h += '<button data-action="takeout" id="btn-takeout" style="display:none"></button>';
  h += barHtml(0);
  h += '<div class="status"></div>';
  h += '<div class="sec">选择配方</div><div class="recgrid">';
  let shown = 0;
  for (const rid of CENTRIFUGE_RECIPE_IDS) {
    if (!recipeUnlocked(rid)) continue;
    shown++;
    const rec = CENTRIFUGE_RECIPES[rid];
    const outIds = Object.keys(rec.out);
    const selCls = e.recipe === rid ? 'sel' : '';
    const tip = rec.name + '|' + outIds.map(k => ITEMS[k].name + '×' + rec.out[k]).join('、') +
      '，耗时' + rec.time + '秒。所需原料：' +
      Object.keys(rec.inp).map(k => ITEMS[k].name + '×' + rec.inp[k]).join('、');
    h += '<button class="rcbtn ' + selCls + '" data-action="recipe" data-id="' + rid + '" data-itemid="' +
      outIds[0] + '" data-tip="' + tip.replace(/"/g, '') + '">' +
      '<img src="' + iconDataURL(outIds[0]) + '">' + rec.name + '</button>';
  }
  h += '</div>';
  const lockedN = CENTRIFUGE_RECIPE_IDS.length - shown;
  if (lockedN > 0) h += '<div class="dim">另有 ' + lockedN + ' 项离心配方未解锁：前往研究面板（T）研究对应科技。</div>';
  if (e.recipe) h += '<button data-action="recipe-clear">清除配方</button>';
  h += '<div class="dim">离心机吃电力，专攻核燃料循环：铀加工把铀矿石分离成铀-238 与少量铀-235；Kovarex 铀浓缩把过剩的铀-238 增殖成稀有铀-235；再处理可从乏燃料棒回收铀-238。固体原料/产物均由机械臂投喂取走。</div>';
  return h;
}
function centrifugePanelLive(e, api) {
  api.set('power', powerStatusLiveHtml(e));
  api.set('input', Object.keys(e.inp).length ? countStr(e.inp) : dimSpan('空'));
  api.set('output', Object.keys(e.outp).length ? countStr(e.outp) : dimSpan('空'));
  const n = Object.values(e.outp).reduce((a, b) => a + b, 0);
  api.toggle('#btn-takeout', n > 0, '取回全部产物 (' + n + ')');
  api.prog(e.recipe && e.crafting ? e.prog / CENTRIFUGE_RECIPES[e.recipe].time * 100 : 0);
  if (!e.recipe) api.status('已暂停：未设置配方，点击下方选择', 'warn');
  else if (e.crafting) api.status('离心中：' + CENTRIFUGE_RECIPES[e.recipe].name, 'ok');
  else if (G.power.sat <= 0) api.status('已暂停：缺电', 'bad');
  else api.status('已暂停：等待原料', 'warn');
}
function centrifugeTip(e) {
  const base = e.crafting ? ('离心中 ' + CENTRIFUGE_RECIPES[e.recipe].name)
    : (e.recipe ? '待料' : '未设置配方，点击打开面板');
  const s = powerStatusOf(e);
  if (s.consuming && s.sat < 1) return base + '；' + (s.sat > 0 ? '电量不足' + Math.round(s.sat * 100) + '%' : '缺电停摆');
  return base;
}

// ===== 核反应堆（对齐《异星工厂》Nuclear reactor，5×5）=====
// 燃烧核燃料棒持续产热；每台相邻反应堆提供 +100% 邻居加成；
// 热量无处可去（自身+全邻居都接近满温）时保护性停堆，不浪费燃料。
class NuclearReactor extends Entity {
  constructor(type, x, y) {
    super('nuclear-reactor', x, y);
    this.fuelCells = 0;     // 待燃燃料棒
    this.usedCells = 0;     // 已烧完的乏燃料棒
    this.burnLeft = 0;      // 当前燃料棒剩余燃烧时间
    this.heat = 0;          // 热量（热单位）
    this.conductsHeat = true;
    this.burning = false;
    this.pulse = 0;
  }
  neighborReactors() {
    let n = 0;
    forEachNeighborEnt(this, e => { if (e instanceof NuclearReactor) n++; });
    return n;
  }
  burnMult() { return 1 + this.neighborReactors() * REACTOR_NEIGHBOR_BONUS; }
  temp() { return heatTempOf(this); }
  update(dt) {
    flowHeatWithNeighbors(this, dt);
    const want = REACTOR_HEAT_RATE * this.burnMult() * dt;
    const room = Math.max(0, heatCapOf(this) - this.heat);
    const add = Math.min(want, room);
    if (add <= 1e-9) {   // 完全饱和：保护性停堆，保留燃料
      this.burning = false;
      return;
    }
    // 需要点新燃料棒时才点火；乏燃料棒堆积满时先停止点火（等待机械臂取走）
    if (this.burnLeft <= 0 && this.fuelCells > 0 && this.usedCells < REACTOR_FUEL_CAP * 2) {
      this.fuelCells--;
      if (typeof trackProd === 'function') trackProd('nuclear-fuel-cell', -1);
      this.usedCells++;
      this.burnLeft = REACTOR_BURN_TIME;
    }
    if (this.burnLeft <= 0) { this.burning = false; return; }
    this.burning = true;
    this.heat += add;
    // 按实际产热比例扣减燃烧进度：部分饱和时自动降功率省燃料
    this.burnLeft -= dt * (want > 0 ? add / want : 0);
    if (this.burnLeft <= 0 && this.fuelCells > 0 && this.usedCells < REACTOR_FUEL_CAP * 2) {
      this.burnLeft += REACTOR_BURN_TIME;
      this.fuelCells--;
      if (typeof trackProd === 'function') trackProd('nuclear-fuel-cell', -1);
      this.usedCells++;
    }
    if (this.burnLeft < 0) this.burnLeft = 0;
    this.pulse += dt * 3;
  }
  giveItem(item) {
    if (item === 'nuclear-fuel-cell') {
      if (this.fuelCells >= REACTOR_FUEL_CAP) return false;
      this.fuelCells++;
      return true;
    }
    return false;
  }
  peekItem() {
    if (this.usedCells > 0) return 'used-up-fuel-cell';   // 优先让机械臂取走乏燃料
    if (this.fuelCells > 0) return 'nuclear-fuel-cell';
    return null;
  }
  takeItem() {
    if (this.usedCells > 0) return this.takeItemOf('used-up-fuel-cell');
    if (this.fuelCells > 0) return this.takeItemOf('nuclear-fuel-cell');
    return null;
  }
  countOf(item) {
    if (item === 'used-up-fuel-cell') return this.usedCells;
    if (item === 'nuclear-fuel-cell') return this.fuelCells;
    return 0;
  }
  takeItemOf(item) {
    if (item === 'used-up-fuel-cell' && this.usedCells > 0) { this.usedCells--; return item; }
    if (item === 'nuclear-fuel-cell' && this.fuelCells > 0) { this.fuelCells--; return item; }
    return null;
  }
  takeAll() {
    // 面板“取出全部”：清空乏燃料棒（新燃料保留在堆内）
    if (this.usedCells > 0) { const n = this.usedCells; this.usedCells = 0; return [['used-up-fuel-cell', n]]; }
    return [];
  }
  contents() {
    const list = [[this.type, 1]];
    if (this.fuelCells > 0) list.push(['nuclear-fuel-cell', this.fuelCells]);
    if (this.usedCells > 0) list.push(['used-up-fuel-cell', this.usedCells]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.fuelCells = this.fuelCells; s.usedCells = this.usedCells;
    s.burnLeft = this.burnLeft; s.heat = this.heat;
    return s;
  }
  static restore(s) {
    const r = super.restore(s);
    r.fuelCells = s.fuelCells || 0; r.usedCells = s.usedCells || 0;
    r.burnLeft = s.burnLeft || 0; r.heat = s.heat || 0;
    return r;
  }
}

// ===== 渲染 =====
function drawNuclearReactor(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const w = TILE * 5, h = TILE * 5;
  ctx.globalAlpha = alpha;
  // 混凝土外壳
  ctx.fillStyle = '#585d66';
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 10); ctx.fill();
  ctx.strokeStyle = '#33373e';
  ctx.lineWidth = 4;
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 10); ctx.stroke();
  ctx.fillStyle = '#676d78';
  rr(ctx, px + 14, py + 14, w - 28, h - 28, 8); ctx.fill();
  // 四角警示斜纹锚点
  ctx.fillStyle = '#d0a83c';
  for (const [ax, ay] of [[22, 22], [w - 40, 22], [22, h - 32], [w - 40, h - 32]]) {
    ctx.save();
    ctx.translate(px + ax, py + ay);
    for (let i = 0; i < 3; i++) { ctx.fillRect(i * 7, 0, 3.5, 10); }
    ctx.restore();
  }
  // 中央堆芯：温度越高越亮，燃烧时脉冲呼吸
  const cx = px + w / 2, cy = py + h / 2;
  const t = e.temp();
  const hot = Math.min(1, t / HEAT_EXCH_TEMP_MIN);
  const pulse = e.burning ? (0.75 + 0.25 * Math.sin(e.pulse * 2)) : 1;
  if (hot > 0.05) {
    ctx.fillStyle = 'rgba(255,' + Math.round(120 + 100 * hot) + ',60,' + (0.16 * hot * pulse).toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(cx, cy, 46 + 8 * hot, 0, 7); ctx.fill();
  }
  ctx.fillStyle = heatGlowColor(t);
  rr(ctx, cx - 30, cy - 30, 60, 60, 8); ctx.fill();
  ctx.strokeStyle = '#22262c';
  ctx.lineWidth = 3;
  rr(ctx, cx - 30, cy - 30, 60, 60, 8); ctx.stroke();
  // 堆芯栅格纹
  ctx.strokeStyle = 'rgba(20,24,30,.55)';
  ctx.lineWidth = 2;
  for (let i = 1; i < 4; i++) {
    ctx.beginPath();
    ctx.moveTo(cx - 30 + i * 15, cy - 30); ctx.lineTo(cx - 30 + i * 15, cy + 30);
    ctx.moveTo(cx - 30, cy - 30 + i * 15); ctx.lineTo(cx + 30, cy - 30 + i * 15);
    ctx.stroke();
  }
  // 温度读数
  ctx.font = 'bold 12px system-ui';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#eef2f6';
  ctx.fillText(Math.round(t) + '°C', px + 16, py + h - 18);
  ctx.textAlign = 'right';
  ctx.fillStyle = e.burning ? '#a4f04c' : '#8a93a0';
  ctx.fillText(e.burning ? '⚡燃烧中' : '待机', px + w - 16, py + h - 18);
  // 邻居加成标记
  const nb = e.neighborReactors();
  if (nb > 0 && !(LOD && LOD.simple)) {
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd23c';
    ctx.fillText('+' + Math.round(nb * REACTOR_NEIGHBOR_BONUS * 100) + '%', cx, cy - 42);
  }
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function reactorPanelHtml(e) {
  let h = row('堆芯温度', '<span class="dim"></span>', 'temp');
  h += row('燃烧进度', '', 'burn');
  h += barHtml(0);
  h += row('燃料棒', e.fuelCells > 0 ? chip('nuclear-fuel-cell', e.fuelCells) : '<span class="dim">无</span>', 'fuel');
  if (invCount('nuclear-fuel-cell') > 0 && e.fuelCells < REACTOR_FUEL_CAP)
    h += '<button data-action="feed" data-id="nuclear-fuel-cell">放入全部燃料棒 (' + invCount('nuclear-fuel-cell') + ')</button>';
  if (e.fuelCells > 0)
    h += '<button data-action="reactor-fuel-out">取出全部燃料棒</button>';
  h += row('乏燃料棒', e.usedCells > 0 ? chip('used-up-fuel-cell', e.usedCells) : '<span class="dim">无</span>', 'waste');
  if (e.usedCells > 0)
    h += '<button data-action="takeout" id="btn-waste">取出乏燃料棒 (' + e.usedCells + ')</button>';
  h += row('邻居加成', '+' + Math.round((e.burnMult() - 1) * 100) + '%（相邻反应堆 ×' + e.neighborReactors() + '）');
  h += '<div class="status"></div>';
  h += '<div class="dim">核反应堆：燃烧核燃料棒产出巨量热量（满负荷 ' + REACTOR_HEAT_RATE +
    ' 热/秒）。每台共享一条边的相邻反应堆使本堆产热 +' + Math.round(REACTOR_NEIGHBOR_BONUS * 100) +
    '%。热量经贴身的热管流向换热器；当堆内及周围都无法再吸收热量时会保护性停堆，不浪费燃料。烧完的乏燃料棒由机械臂取走送去离心机再处理。</div>';
  return h;
}
function reactorPanelLive(e, api) {
  api.set('temp', Math.round(e.temp()) + ' / ' + HEAT_TEMP_MAX + ' °C');
  api.set('burn', e.burnLeft > 0 ? Math.ceil(e.burnLeft) + ' 秒' : dimSpan('—'));
  api.set('fuel', e.fuelCells > 0 ? chip('nuclear-fuel-cell', e.fuelCells) : dimSpan('无'));
  api.set('waste', e.usedCells > 0 ? chip('used-up-fuel-cell', e.usedCells) : dimSpan('无'));
  api.toggle('#btn-waste', e.usedCells > 0, '取出乏燃料棒 (' + e.usedCells + ')');
  api.prog(Math.min(100, e.temp() / HEAT_TEMP_MAX * 100));
  if (e.burning) api.status('燃烧中：产热 ' + Math.round(REACTOR_HEAT_RATE * e.burnMult()) + ' 热/秒', 'ok');
  else if (e.fuelCells <= 0 && e.burnLeft <= 0) api.status('已停堆：无燃料（放入核燃料棒）', 'bad');
  else if (e.usedCells >= REACTOR_FUEL_CAP * 2) api.status('已停堆：乏燃料棒堆积满，先取走废料', 'warn');
  else api.status('保护性停堆：周围热量已饱和（等待换热器消耗）', 'warn');
}
function reactorTip(e) {
  return e.burning ? '燃烧中 ' + Math.round(e.temp()) + '°C（燃料×' + e.fuelCells + '）'
    : (e.temp() > 1 ? '停堆散热中 ' + Math.round(e.temp()) + '°C' : '待机：需放入核燃料棒');
}
function reactorOnAction(act) {
  if (act === 'reactor-fuel-out') {
    const e = G.panelEnt;
    if (e && e.fuelCells > 0) { invAdd('nuclear-fuel-cell', e.fuelCells); e.fuelCells = 0; toast('已取出全部燃料棒'); }
    return true;
  }
  return false;
}

// ===== 热管（1×1）：传导热量 =====
class HeatPipe extends Entity {
  constructor(type, x, y) {
    super('heat-pipe', x, y);
    this.heat = 0;
    this.conductsHeat = true;
  }
  temp() { return heatTempOf(this); }
  update(dt) { flowHeatWithNeighbors(this, dt); }
}

function drawHeatPipe(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const t = e.temp();
  const glow = Math.min(1, t / HEAT_EXCH_TEMP_MIN);
  ctx.globalAlpha = alpha;
  // 外壳：金属护管
  ctx.fillStyle = '#4a4440';
  rr(ctx, px + 7, py + 7, TILE - 14, TILE - 14, 5); ctx.fill();
  // 内芯：随温度发光
  ctx.fillStyle = heatGlowColor(t);
  rr(ctx, px + 11, py + 11, TILE - 22, TILE - 22, 4); ctx.fill();
  if (glow > 0.15 && !(LOD && LOD.simple)) {
    ctx.fillStyle = 'rgba(255,170,70,' + (0.10 * glow).toFixed(2) + ')';
    rr(ctx, px + 3, py + 3, TILE - 6, TILE - 6, 6); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function heatPipePanelHtml() {
  return '<div class="dim">热管：传导反应堆的热量到换热器（1×1）。相邻热管/反应堆/换热器之间按温差自动导热，温度越高颜色越亮（暗红→橙→白热）。长距离输热会有沿途温降，尽量让换热器贴近反应堆排布。</div><div class="status"></div>';
}
function heatPipePanelLive(e, api) {
  api.status('温度 ' + Math.round(e.temp()) + '°C' + (e.temp() >= HEAT_EXCH_TEMP_MIN ? '（≥' + HEAT_EXCH_TEMP_MIN + '°C 可供换热器工作）' : ''), e.temp() >= HEAT_EXCH_TEMP_MIN ? 'ok' : 'warn');
}
function heatPipeTip(e) { return '热管 ' + Math.round(e.temp()) + '°C'; }

// ===== 换热器（对齐《异星工厂》Heat exchanger，3×2）=====
// 把 ≥500°C 的热量转化为蒸汽：接口布局与锅炉一致——两端蓝口水口双向进出水，
// 底边中间白汽口向管道/汽轮机排汽。
class HeatExchanger extends Entity {
  constructor(type, x, y) {
    super('heat-exchanger', x, y);
    this.heat = 0;
    this.water = 0;
    this.steamBuf = 0;
    this.conductsHeat = true;
    this.working = false;
  }
  temp() { return heatTempOf(this); }
  isWaterPortCell(cx, cy) { return cy === this.y + this.h - 1 && (cx === this.x - 1 || cx === this.x + this.w); }
  acceptsPumpFeed(cx, cy, fromDir) {
    const r = this.y + this.h - 1;
    if (cy !== r) return false;
    if (cx === this.x) return fromDir === 0;
    if (cx === this.x + this.w - 1) return fromDir === 2;
    return false;
  }
  update(dt) {
    this.working = false;
    flowHeatWithNeighbors(this, dt);
    this.portFlow();
    const t = this.temp();
    if (t < HEAT_EXCH_TEMP_MIN || this.water <= 0) return;
    // 按产汽速率消耗热量与水，产出蒸汽
    const make = Math.min(EXCHANGER_STEAM_RATE * dt, this.water, WATER_CAP - this.steamBuf);
    if (make <= 0) return;
    this.water -= make;
    this.steamBuf += make;
    this.heat = Math.max(0, this.heat - make * HEAT_PER_STEAM);
    this.working = true;
  }
  portFlow() {
    const covers = (n, cx, cy) => cx >= n.x && cx < n.x + n.w && cy >= n.y && cy < n.y + n.h;
    const wRow = this.y + this.h - 1;
    forEachNeighborEnt(this, n => {
      const wPort = covers(n, this.x - 1, wRow) || covers(n, this.x + this.w, wRow);
      const sPort = covers(n, this.x + (this.w >> 1), this.y + this.h);
      if (n instanceof Pipe) {
        if (wPort) {
          const pw = n.fluid['water'] || 0;
          if (pw >= this.water + 1 && this.water < WATER_CAP - 0.01) {
            n.takeItemOf('water'); this.water++;
          } else if (this.water >= pw + 1 && pw < PIPE_CAP && this.water >= 1) {
            n.giveItem('water'); this.water--;
          }
        }
        if (sPort && this.steamBuf >= 1 && n.total() < PIPE_CAP && n.giveItem('steam')) this.steamBuf--;
      } else if (n instanceof SteamTurbine) {
        if (sPort && this.steamBuf >= 1 && n.steamBuf < TURBINE_STEAM_CAP - 0.01) {
          this.steamBuf--; n.steamBuf++;
        }
      }
    });
  }
  giveItem(item) {
    if (item === 'water' && this.water < WATER_CAP - 0.01) { this.water = Math.min(WATER_CAP, this.water + 1); return true; }
    return false;
  }
  contents() {
    const list = [[this.type, 1]];
    if (this.water >= 1) list.push(['water', Math.floor(this.water)]);
    if (this.steamBuf >= 1) list.push(['steam', Math.floor(this.steamBuf)]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.heat = this.heat; s.water = this.water; s.steamBuf = this.steamBuf;
    return s;
  }
  static restore(s) {
    const e = super.restore(s);
    e.heat = s.heat || 0; e.water = s.water || 0; e.steamBuf = s.steamBuf || 0;
    return e;
  }
}

// ===== 渲染 =====
function drawHeatExchanger(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const w = TILE * 3, h = TILE * 2;
  const t = e.temp();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#8a743e';
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 8); ctx.fill();
  ctx.strokeStyle = '#4c3f1e';
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 8); ctx.stroke();
  // 换热管束：温度高时发亮
  ctx.fillStyle = '#6e5c30';
  rr(ctx, px + 9, py + 9, w - 18, h - 26, 4); ctx.fill();
  const glow = Math.max(0, Math.min(1, (t - HEAT_EXCH_TEMP_MIN * 0.6) / HEAT_EXCH_TEMP_MIN));
  if (glow > 0.02) {
    ctx.fillStyle = 'rgba(255,' + Math.round(150 + 80 * glow) + ',70,' + (0.30 * glow).toFixed(2) + ')';
    rr(ctx, px + 9, py + 9, w - 18, h - 26, 4); ctx.fill();
  }
  // 工作气泡动画
  if (e.working && !(LOD && LOD.simple)) {
    for (let i = 0; i < 3; i++) {
      const tt = ((G.time * 0.8) + i / 3) % 1;
      ctx.fillStyle = 'rgba(240,250,255,' + (0.5 * (1 - tt)).toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(px + w * 0.3 + i * w * 0.2, py + h * 0.55 - tt * 12, 2.2, 0, 7);
      ctx.fill();
    }
  }
  ctx.font = 'bold 11px system-ui';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f4ecd8';
  ctx.fillText('换热器', px + 8, py + h - 12);
  ctx.textAlign = 'right';
  ctx.fillStyle = t >= HEAT_EXCH_TEMP_MIN ? '#ffd23c' : t > 100 ? '#f0a048' : '#8a93a0';
  ctx.fillText(Math.round(t) + '°C', px + w - 8, py + h - 12);
  // 水口（蓝，双向）：左右两端下格侧边；汽口（白，只出）：底边中间 —— 与锅炉一致
  const cx = px + w / 2, cy = py + h / 2;
  drawPort(ctx, cx, cy, 2, PORT_WATER, false, -0.5, TILE);
  drawPort(ctx, cx, cy, 0, PORT_WATER, false, 0.5, TILE);
  drawPort(ctx, cx, cy, 1, PORT_STEAM, true, 0, TILE);
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function exchangerPanelHtml(e) {
  let h = row('温度', '<span class="dim"></span>', 'temp');
  h += row('水', '<span class="dim"></span>', 'water');
  if (invCount('water') > 0)
    h += '<button data-action="feed" data-id="water">注入全部存水</button>';
  h += row('蒸汽缓存', '<span class="dim"></span>', 'steam');
  h += barHtml(0);
  h += '<div class="status"></div>';
  h += '<div class="dim">换热器：把 ≥' + HEAT_EXCH_TEMP_MIN + '°C 的核热转化为蒸汽。接法与锅炉一致——抽水机或管道接左右两端蓝口水口供水，底边中间白汽口把蒸汽送往下方汽轮机或经管道远送。满负荷产汽 ' +
    EXCHANGER_STEAM_RATE + '/秒，恰好带满 2 台汽轮机。</div>';
  return h;
}
function exchangerPanelLive(e, api) {
  api.set('temp', Math.round(e.temp()) + ' °C（需 ≥' + HEAT_EXCH_TEMP_MIN + '）');
  api.set('water', e.water >= 1 ? chip('water', Math.floor(e.water)) : dimSpan('空'));
  api.set('steam', e.steamBuf >= 1 ? chip('steam', Math.floor(e.steamBuf)) : dimSpan('空'));
  api.prog(Math.min(100, e.temp() / HEAT_TEMP_MAX * 100));
  if (e.working) api.status('换热中：产蒸汽 ' + EXCHANGER_STEAM_RATE + '/秒', 'ok');
  else if (e.temp() < HEAT_EXCH_TEMP_MIN) api.status('已暂停：温度不足 ' + HEAT_EXCH_TEMP_MIN + '°C（检查反应堆与热管）', 'warn');
  else if (e.water < 1) api.status('已暂停：缺水（检查两端蓝口水口/管道供水）', 'bad');
  else api.status('已暂停：蒸汽憋满，等待汽轮机消耗', 'warn');
}
function exchangerTip(e) {
  return e.working ? '换热中 ' + Math.round(e.temp()) + '°C（存汽' + Math.floor(e.steamBuf || 0) + '）'
    : e.temp() < HEAT_EXCH_TEMP_MIN ? '温度不足 ' + Math.round(e.temp()) + '°C'
    : e.water < 1 ? '缺水' : '待机';
}

// ===== 汽轮机（对齐《异星工厂》Steam turbine，3×5）=====
// 接法与蒸汽机完全一致（上下两端通用汽口）；功率 = 4 台蒸汽机，
// 单位蒸汽发电效率更高（高温蒸汽的能量优势）。
class SteamTurbine extends Entity {
  constructor(type, x, y) {
    super('steam-turbine', x, y);
    this.spin = 0;
    this.on = false;
    this.outMult = 0;
    this.powerOut = 0;
    this.steamBuf = 0;
  }
  update(dt) {
    this.portFlow();
    const want = TURBINE_STEAM_RATE * dt;
    const took = Math.min(want, this.steamBuf);
    this.steamBuf -= took;
    const inst = want > 1e-9 ? Math.min(1, took / want) : 0;
    this.outMult += (inst - this.outMult) * Math.min(1, dt * 6);
    if (this.outMult < 0.005) this.outMult = 0;
    this.powerOut = TURBINE_POWER * this.outMult;
    this.on = this.powerOut > 0.05;
    if (this.on) this.spin += dt * 11 * (0.35 + 0.65 * this.outMult);
    if (typeof regPowerEnt === 'function') regPowerEnt(this);
  }
  portFlow() {
    const covers = (n, cx, cy) => cx >= n.x && cx < n.x + n.w && cy >= n.y && cy < n.y + n.h;
    const midX = this.x + (this.w >> 1);
    forEachNeighborEnt(this, n => {
      const endPort = covers(n, midX, this.y - 1) || covers(n, midX, this.y + this.h);
      if (n instanceof Pipe) {
        if (!endPort) return;
        if (this.steamBuf < TURBINE_STEAM_CAP - 0.01 && (n.fluid['steam'] || 0) >= 1) {
          n.takeItemOf('steam'); this.steamBuf++;
        }
        if (this.steamBuf > TURBINE_STEAM_CAP * 0.5 && n.total() < PIPE_CAP && n.giveItem('steam')) this.steamBuf--;
      } else if (n instanceof SteamTurbine) {
        const mine = endPort;
        const theirs = covers(this, n.x + (n.w >> 1), n.y - 1) || covers(this, n.x + (n.w >> 1), n.y + n.h);
        if (!(mine && theirs)) return;
        if (this.steamBuf >= n.steamBuf + 1 && n.steamBuf < TURBINE_STEAM_CAP - 0.01) { this.steamBuf--; n.steamBuf++; }
        else if (n.steamBuf >= this.steamBuf + 1 && this.steamBuf < TURBINE_STEAM_CAP - 0.01) { n.steamBuf--; this.steamBuf++; }
      }
    });
  }
  giveItem(item) {
    if (item === 'steam' && this.steamBuf < TURBINE_STEAM_CAP - 0.01) { this.steamBuf = Math.min(TURBINE_STEAM_CAP, this.steamBuf + 1); return true; }
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
function drawSteamTurbine(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const w = TILE * 3, h = TILE * 5;
  const om = Math.max(0, Math.min(1, e.outMult || 0));
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#3f7a72';
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 8); ctx.fill();
  ctx.strokeStyle = '#20403c';
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 8); ctx.stroke();
  ctx.fillStyle = '#2f5e58';
  rr(ctx, px + 10, py + 10, w - 20, h - 20, 5); ctx.fill();
  // 多级叶轮：运转时高速旋转并带残影光圈
  const gcx = px + w / 2, gcy = py + h * 0.32;
  if (e.on) {
    ctx.strokeStyle = 'rgba(120,240,220,' + (0.3 + 0.5 * om).toFixed(2) + ')';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(gcx, gcy, 24 + om * 3, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.save();
  ctx.translate(gcx, gcy);
  ctx.rotate(e.on ? e.spin : 0);
  ctx.fillStyle = e.on ? '#c8f4ec' : '#7da39d';
  gearShape(ctx, 0, 0, 17, 11, 9);
  ctx.fill();
  ctx.restore();
  // 蒸汽余量条
  const sp = Math.max(0, Math.min(1, (e.steamBuf || 0) / TURBINE_STEAM_CAP));
  ctx.fillStyle = '#20242b';
  rr(ctx, px + 10, py + h * 0.62, w - 20, 6, 2); ctx.fill();
  ctx.fillStyle = sp > 0 ? '#c8e8f4' : '#b33';
  rr(ctx, px + 10, py + h * 0.62, (w - 20) * sp, 6, 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (e.on) ctx.fillText('+' + (e.powerOut || 0).toFixed(1), px + w / 2, py + h - 14);
  else ctx.fillText('汽轮机', px + w / 2, py + h - 14);
  // 两端通用汽口（与蒸汽机一致）
  drawPort(ctx, px + w / 2, py + h / 2, 3, PORT_STEAM, false, 0, h / 2);
  drawPort(ctx, px + w / 2, py + h / 2, 1, PORT_STEAM, false, 0, h / 2);
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function turbinePanelHtml(e) {
  let h = row('输出功率', '<span class="dim"></span>', 'power');
  h += row('蒸汽存量', '<span class="dim"></span>', 'steam');
  h += barHtml(0);
  h += '<div class="status"></div>';
  h += '<div class="dim">上下两端各一只通用汽口，接法与蒸汽机一致：可紧邻换热器出汽口或经蒸汽管道供汽，多余蒸汽可从另一端送出、支持首尾串联。满功率耗汽 ' + TURBINE_STEAM_RATE +
    '/秒，输出 +' + TURBINE_POWER + '（= ' + (TURBINE_POWER / POWER_PER_ENGINE) + ' 台蒸汽机）。</div>';
  return h;
}
function turbinePanelLive(e, api) {
  api.set('power', e.on ? '+' + e.powerOut.toFixed(1) : dimSpan('+0'));
  api.set('steam', e.steamBuf >= 1 ? chip('steam', Math.floor(e.steamBuf)) : dimSpan('空'));
  api.prog((e.outMult || 0) * 100);
  if (e.on) api.status('发电中：并入全图电网', 'ok');
  else if (e.steamBuf > 0) api.status('已暂停：蒸汽不足，功率受限', 'warn');
  else api.status('已暂停：未接蒸汽（从任一端汽口接入）', 'bad');
}
function turbineTip(e) {
  return e.on ? '发电中 +' + (e.powerOut || 0).toFixed(1) + '（存汽' + Math.floor(e.steamBuf || 0) + '）'
    : (e.steamBuf > 0 ? '供汽不足' : '未接蒸汽：从任一端汽口接入');
}

// ===== 注册 =====
ENT_CLASSES['centrifuge'] = Centrifuge;
DEVICE_RENDER['centrifuge'] = drawCentrifuge;
DEVICE_STATUS['centrifuge'] = e => {
  const s = powerStatusOf(e);
  if (s.consuming) return s.color;
  return e.recipe ? (e.crafting ? 'g' : 'y') : 'r';
};
DEVICE_PANEL['centrifuge'] = { html: centrifugePanelHtml, live: centrifugePanelLive, tip: centrifugeTip };

ENT_CLASSES['nuclear-reactor'] = NuclearReactor;
DEVICE_RENDER['nuclear-reactor'] = drawNuclearReactor;
DEVICE_STATUS['nuclear-reactor'] = e => e.burning ? 'g' : (e.temp() > 1 ? 'y' : 'r');
DEVICE_PANEL['nuclear-reactor'] = { html: reactorPanelHtml, live: reactorPanelLive, tip: reactorTip, onAction: reactorOnAction };

ENT_CLASSES['heat-pipe'] = HeatPipe;
DEVICE_RENDER['heat-pipe'] = drawHeatPipe;
DEVICE_STATUS['heat-pipe'] = () => null;
DEVICE_PANEL['heat-pipe'] = { html: heatPipePanelHtml, live: heatPipePanelLive, tip: heatPipeTip };

ENT_CLASSES['heat-exchanger'] = HeatExchanger;
DEVICE_RENDER['heat-exchanger'] = drawHeatExchanger;
DEVICE_STATUS['heat-exchanger'] = e => e.working ? 'g' : ((e.temp() || 0) >= HEAT_EXCH_TEMP_MIN ? 'y' : 'r');
DEVICE_PANEL['heat-exchanger'] = { html: exchangerPanelHtml, live: exchangerPanelLive, tip: exchangerTip };

ENT_CLASSES['steam-turbine'] = SteamTurbine;
DEVICE_RENDER['steam-turbine'] = drawSteamTurbine;
DEVICE_STATUS['steam-turbine'] = e => e.on ? 'g' : ((e.steamBuf || 0) > 0 ? 'y' : 'r');
DEVICE_PANEL['steam-turbine'] = { html: turbinePanelHtml, live: turbinePanelLive, tip: turbineTip };
DEVICE_DIR_ROTATE['steam-turbine'] = true;
