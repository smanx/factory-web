'use strict';

// ===== 核能发电体系（对齐《异星工厂》核动力）=====
// 完整链路：铀矿（远处生成）→ 电采矿机开采 → 离心机处理成铀-235/238
//   → 铀-235 组装成核燃料 → 核反应堆（耗核燃料+水）产出高温蒸汽
//   → 汽轮机（远高于蒸汽机的功率）发电。
// 反应堆复用锅炉的“水 → 蒸汽”管道模型（底边出汽口接管道/汽轮机），
// 汽轮机复用蒸汽机的“蒸汽 → 电力”模型，但功率与耗汽量远高。

// ===================== 离心机（2×2，吃电力）=====================
// 处理铀矿：10 铀矿 → 1 铀-235 + 9 铀-238；或执行 Kovarex 富集循环。
class Centrifuge extends Entity {
  constructor(type, x, y) {
    super(type || 'centrifuge', x, y);
    this.recipe = null;      // 当前配方 id：'uranium-processing' 或 'kovarex'
    this.inp = {};           // 已投入的原料
    this.outp = {};          // 已产出待取
    this.crafting = false;
    this.prog = 0;
    this.spin = 0;
  }
  recipeObj() {
    if (!this.recipe) return null;
    if (this.recipe === 'kovarex') return RECIPES['kovarex'];
    return CENTRIFUGE_RECIPES[this.recipe];
  }
  update(dt) {
    if (!this.recipe) { this.crafting = false; return; }
    if (G.power.sat <= 0) { this.crafting = false; return; }
    const rec = this.recipeObj();
    if (!rec) { this.crafting = false; return; }
    if (this.crafting) {
      this.prog += dt * 1 * powerFactor();
      this.spin += dt * 10;
      if (this.prog >= rec.time) {
        for (const k in rec.out) {
          this.outp[k] = (this.outp[k] || 0) + rec.out[k];
          if (typeof trackProd === 'function') trackProd(k, rec.out[k]);
        }
        this.crafting = false;
        this.prog = 0;
      }
      return;
    }
    // 原料不足则等
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
  powerDemand() {
    return this.recipe ? POWER_USE['centrifuge'] : 0;
  }
  setRecipe(id) {
    if (this.recipe === id) return;
    this.recipe = id;
    this.inp = {}; this.outp = {};
    this.crafting = false; this.prog = 0;
  }
  giveItem(item) {
    if (!this.recipe) return false;
    const rec = this.recipeObj();
    if (!rec || !rec.inp[item]) return false;
    if ((this.inp[item] || 0) >= 50) return false;
    this.inp[item] = (this.inp[item] || 0) + 1;
    return true;
  }
  peekItem() { for (const k in this.outp) if (this.outp[k] > 0) return k; return null; }
  takeItem() { for (const k in this.outp) if (this.outp[k] > 0) { this.outp[k]--; if (this.outp[k] <= 0) delete this.outp[k]; return k; } return null; }
  countOf(item) { return this.outp[item] || 0; }
  takeItemOf(item) { if (this.outp[item] > 0) { this.outp[item]--; if (this.outp[item] <= 0) delete this.outp[item]; return item; } return null; }
  contents() {
    const list = [[this.type, 1]];
    for (const k in this.outp) if (this.outp[k] > 0) list.push([k, this.outp[k]]);
    return list;
  }
  takeAll() {
    const rows = [];
    for (const k in this.outp) if (this.outp[k] > 0) { rows.push([k, this.outp[k]]); delete this.outp[k]; }
    return rows;
  }
  serialize() {
    const s = super.serialize();
    s.recipe = this.recipe; s.inp = this.inp; s.outp = this.outp; s.prog = this.prog;
    return s;
  }
  static restore(s) {
    const c = super.restore(s);
    c.recipe = s.recipe || null; c.inp = s.inp || {}; c.outp = s.outp || {}; c.prog = s.prog || 0;
    return c;
  }
}
function drawCentrifuge(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w, sh = TILE * e.h;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#5c6a7a';
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 8); ctx.fill();
  ctx.strokeStyle = '#37414e';
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 8); ctx.stroke();
  ctx.fillStyle = '#3f4a58';
  rr(ctx, px + 12, py + 12, s - 24, sh - 24, 6); ctx.fill();
  const cx = px + s / 2, cy = py + sh / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((e.spin || 0) + (e.crafting ? G.time * 3 : 0));
  ctx.fillStyle = e.crafting ? '#bfe8ff' : '#7d8894';
  gearShape(ctx, 0, 0, s * 0.22, s * 0.14, 9);
  ctx.fill();
  ctx.restore();
  if (e.crafting) {
    const pct = e.recipeObj() ? Math.min(1, (e.prog || 0) / e.recipeObj().time) : 0;
    ctx.strokeStyle = 'rgba(143,224,255,.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.3, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#dff0ff';
  ctx.font = 'bold ' + Math.max(9, Math.round(s * 0.12)) + 'px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('离心', cx, py + 12);
  ctx.globalAlpha = 1;
}
function centrifugePanelHtml(e) {
  let h = '';
  const cur = e.recipe;
  for (const rid in CENTRIFUGE_RECIPES) {
    const r = CENTRIFUGE_RECIPES[rid];
    h += '<button data-action="rec" data-id="' + rid + '" class="' + (cur === rid ? 'on' : '') + '">' + r.name + '</button>';
  }
  h += '<button data-action="rec" data-id="kovarex" class="' + (cur === 'kovarex' ? 'on' : '') + '">铀富集(Kovarex)</button>';
  h += row('原料', '<span class="dim"></span>', 'inp');
  h += row('产出', '<span class="dim"></span>', 'out');
  h += row('电力', powerStatusLiveHtml(e), 'power');
  h += barHtml(0);
  h += '<div class="status"></div>';
  h += '<div class="dim">离心机：把铀矿分离成铀-235（小概率）/铀-238。铀-235 在组装机制成核燃料；也可用铀富集循环持续增产铀-235。原料由机械臂/传送带放入，产出由机械臂取出。</div>';
  return h;
}
function centrifugePanelLive(e, api) {
  api.set('power', powerStatusLiveHtml(e));
  let inp = '';
  for (const k in e.inp) if (e.inp[k] > 0) inp += chip(k, e.inp[k]);
  api.set('inp', inp || dimSpan('空'));
  let out = '';
  for (const k in e.outp) if (e.outp[k] > 0) out += chip(k, e.outp[k]);
  api.set('out', out || dimSpan('空'));
  const rec = e.recipeObj();
  if (!rec) api.status('未选择配方', 'warn');
  else if (e.crafting) api.status('处理中', 'ok');
  else {
    let missing = null;
    for (const k in rec.inp) if ((e.inp[k] || 0) < rec.inp[k]) { missing = ITEMS[k].name; break; }
    api.status(missing ? ('原料不足：' + missing) : '已就绪', missing ? 'warn' : 'ok');
  }
  if (rec && e.crafting) api.prog(e.prog / rec.time * 100);
  else api.prog(0);
}
function centrifugeTip(e) {
  if (!e.recipe) return '未选择配方';
  if (e.crafting) return '处理中 ' + Math.round((e.prog / e.recipeObj().time) * 100) + '%';
  return e.recipe === 'kovarex' ? '铀富集循环（等待原料）' : '铀矿处理（等待原料）';
}

// ===================== 核反应堆（5×5，吃核燃料+水）=====================
// 复用锅炉的“水→蒸汽”模型：核燃料燃烧把水加热成高温蒸汽，经底边出汽口排出。
// 产汽能力远超锅炉：同耗水量下产出更多蒸汽，供多台汽轮机满载。
class NuclearReactor extends Entity {
  constructor(type, x, y) {
    super('nuclear-reactor', x, y);
    this.fuel = 0;          // 核燃料组数（燃料槽）
    this.burnLeft = 0;      // 当前燃料剩余燃烧秒数
    this.water = 0;         // 内部水箱（左/右两侧进水口）
    this.steamBuf = 0;      // 高温蒸汽缓冲（底边出汽口）
    this.temp = 0;          // 堆芯温度（显示用）
    this.burning = false;
    this.lit = false;
  }
  // 两侧水口：左端格左边 (x-1, midRow) & 右端格右边 (x+w, midRow)
  isWaterPortCell(cx, cy) {
    const r = this.y + this.h - 1;
    return cy === r && (cx === this.x - 1 || cx === this.x + this.w);
  }
  acceptsPumpFeed(cx, cy, fromDir) {
    const r = this.y + this.h - 1;
    if (cy !== r) return false;
    if (cx === this.x) return fromDir === 0;
    if (cx === this.x + this.w - 1) return fromDir === 2;
    return false;
  }
  update(dt) {
    this.burning = false;
    this.temp = Math.max(0, this.temp - 1 * dt);
    this.portFlow();
    // 蒸汽憋满则暂停；被消耗后自动恢复
    if (this.steamBuf >= REACTOR_STEAM_CAP - 0.01) { this.lit = false; return; }
    if (this.burnLeft <= 0 && this.water > 0 && this.fuel > 0) {
      this.fuel--;
      if (typeof trackProd === 'function') trackProd('nuclear-fuel', -1);
      this.burnLeft += REACTOR_FUEL_ENERGY;
    }
    if (this.burnLeft <= 0) { this.lit = false; return; }
    this.lit = true;
    if (this.water <= 0) return; // 断水：不产汽，燃料暂不烧
    this.burning = true;
    this.burnLeft -= dt;
    const rate = REACTOR_WATER_RATE; // 每秒耗水量与产汽量（远超锅炉）
    this.water = Math.max(0, this.water - rate * dt);
    this.steamBuf = Math.min(REACTOR_STEAM_CAP, this.steamBuf + rate * dt);
    this.temp = Math.min(200, this.temp + 20 * dt);
  }
  // 端口物流：两侧水口双向进出、水位互通平衡（管道供水/排水）；底边中间汽口向下排汽
  portFlow() {
    const covers = (n, cx, cy) => cx >= n.x && cx < n.x + n.w && cy >= n.y && cy < n.y + n.h;
    const wRow = this.y + this.h - 1;
    forEachNeighborEnt(this, n => {
      const wPort = covers(n, this.x - 1, wRow) || covers(n, this.x + this.w, wRow);
      const sPort = covers(n, this.x + (this.w >> 1), this.y + this.h);
      if (n instanceof Pipe) {
        if (wPort) {
          const pw = n.fluid['water'] || 0;
          if (pw >= this.water + 1 && this.water < WATER_CAP - 0.01) { n.takeItemOf('water'); this.water++; }
          else if (this.water >= pw + 1 && pw < PIPE_CAP && this.water >= 1) { n.giveItem('water'); this.water--; }
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
    if (item === 'nuclear-fuel' && this.fuel < 5) { this.fuel++; return true; }
    if (item === 'water' && this.water < WATER_CAP - 0.01) { this.water = Math.min(WATER_CAP, this.water + 1); return true; }
    return false;
  }
  contents() {
    const list = [[this.type, 1]];
    if (this.fuel > 0) list.push(['nuclear-fuel', this.fuel]);
    if (this.water >= 1) list.push(['water', Math.floor(this.water)]);
    if (this.steamBuf >= 1) list.push(['steam', Math.floor(this.steamBuf)]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.fuel = this.fuel; s.burnLeft = this.burnLeft; s.water = this.water;
    s.steamBuf = this.steamBuf; s.temp = this.temp;
    return s;
  }
  static restore(s) {
    const r = super.restore(s);
    r.fuel = s.fuel || 0; r.burnLeft = s.burnLeft || 0; r.water = s.water || 0;
    r.steamBuf = s.steamBuf || 0; r.temp = s.temp || 0;
    return r;
  }
}
function drawNuclearReactor(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const w = TILE * e.w, h = TILE * e.h;
  ctx.globalAlpha = alpha;
  // 底座
  ctx.fillStyle = '#2e3a2e';
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 10); ctx.fill();
  ctx.strokeStyle = '#18211a';
  ctx.lineWidth = 4;
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 10); ctx.stroke();
  // 反应堆穹顶
  ctx.fillStyle = e.burning ? '#3f7a4a' : '#4a5a4a';
  ctx.beginPath();
  ctx.arc(px + w / 2, py + h * 0.5, w * 0.28, 0, 7);
  ctx.fill();
  ctx.strokeStyle = '#1c2a1c';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(px + w / 2, py + h * 0.5, w * 0.28, 0, 7);
  ctx.stroke();
  // 芯部辉光（运行中）
  if (e.burning) {
    const gl = 0.5 + Math.sin(G.time * 6) * 0.25;
    ctx.fillStyle = 'rgba(143,224,143,' + (0.3 + gl * 0.3).toFixed(2) + ')';
    ctx.beginPath();
    ctx.arc(px + w / 2, py + h * 0.5, w * 0.14, 0, 7);
    ctx.fill();
  }
  // 辐射标记
  ctx.strokeStyle = e.burning ? '#bff0bf' : '#8a9a8a';
  ctx.lineWidth = 3;
  const cxp = px + w / 2, cyp = py + h * 0.5;
  for (let i = 0; i < 3; i++) {
    const a = -Math.PI / 2 + i * Math.PI * 2 / 3;
    ctx.beginPath();
    ctx.moveTo(cxp, cyp);
    ctx.lineTo(cxp + Math.cos(a) * w * 0.18, cyp + Math.sin(a) * w * 0.18);
    ctx.stroke();
  }
  // 燃料槽
  const fp = Math.min(1, e.burnLeft / REACTOR_FUEL_ENERGY);
  ctx.fillStyle = '#20242b';
  rr(ctx, px + 12, py + h - 14, w - 24, 6, 3); ctx.fill();
  ctx.fillStyle = fp > 0 ? '#9ae06a' : '#5a6a5a';
  rr(ctx, px + 12, py + h - 14, (w - 24) * fp, 6, 3); ctx.fill();
  // 水位条
  const wPct = Math.max(0, Math.min(1, (e.water || 0) / WATER_CAP));
  ctx.fillStyle = '#20242b';
  rr(ctx, px + 12, py + h - 22, w - 24, 6, 3); ctx.fill();
  ctx.fillStyle = wPct > 0 ? '#3fa0e8' : '#b33';
  rr(ctx, px + 12, py + h - 22, (w - 24) * wPct, 6, 3); ctx.fill();
  // 端口：两侧水口（蓝）、底边中间汽口（白）
  const midx = px + (w >> 1), midRow = py + TILE * (e.h - 1);
  drawPort(ctx, px + TILE, midRow, 2, PORT_WATER, false, 0, TILE);
  drawPort(ctx, px + w - TILE, midRow, 0, PORT_WATER, false, 0, TILE);
  drawPort(ctx, midx, py + h, 1, PORT_STEAM, true, 0, TILE);
  ctx.fillStyle = '#eaf6ea';
  ctx.font = 'bold 13px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('核反应堆', px + w / 2, py + 14);
  ctx.globalAlpha = 1;
}
function reactorPanelHtml(e) {
  let h = row('核燃料', e.fuel > 0 ? chip('nuclear-fuel', e.fuel) : '<span class="dim">无</span>', 'fuel');
  if (invCount('nuclear-fuel') > 0)
    h += '<button data-action="fuel" data-id="nuclear-fuel">装入核燃料 (' + invCount('nuclear-fuel') + ')</button>';
  h += row('水', '<span class="dim"></span>', 'water');
  h += row('蒸汽缓存', '<span class="dim"></span>', 'steam');
  h += row('堆芯温度', '', 'temp');
  h += barHtml(0);
  h += '<div class="status"></div>';
  h += '<div class="dim">核反应堆：两侧蓝口水口接入供水管道（抽水机→管道），底边白口送出高温蒸汽到汽轮机/蒸汽管道。需核燃料，供汽能力远超锅炉。核能技术解锁。</div>';
  return h;
}
function reactorPanelLive(e, api) {
  api.set('fuel', e.fuel > 0 ? chip('nuclear-fuel', e.fuel) : dimSpan('无'));
  api.set('water', e.water >= 1 ? chip('water', Math.floor(e.water)) : dimSpan('空'));
  api.set('steam', e.steamBuf >= 1 ? chip('steam', Math.floor(e.steamBuf)) : dimSpan('空'));
  api.set('temp', Math.round(e.temp) + ' / 200 °C');
  api.prog(Math.min(100, e.temp / 200 * 100));
  if (e.steamBuf >= REACTOR_STEAM_CAP - 0.01) api.status('已暂停：蒸汽憋满，等待汽轮机/管道消耗', 'warn');
  else if (e.burning) api.status('运行中：产出高温蒸汽', 'ok');
  else if (e.water < 1) api.status('已暂停：缺水（检查两侧蓝口水口/管道供水）', 'bad');
  else if (e.fuel <= 0 && e.burnLeft <= 0) api.status('已暂停：无核燃料', 'bad');
  else api.status('已暂停：待机', 'warn');
}
function reactorTip(e) {
  return e.burning ? '运行中 ' + Math.round(e.temp) + '°C（存汽' + Math.floor(e.steamBuf || 0) + '）'
    : e.steamBuf >= REACTOR_STEAM_CAP - 0.01 ? '蒸汽憋满·等待消耗'
    : e.water < 1 ? '缺水（检查两侧蓝口水口/管道）'
    : (e.fuel <= 0 && e.burnLeft <= 0) ? '无核燃料' : '待机';
}

// ===================== 汽轮机（3×3，耗蒸汽→发电）=====================
// 复用蒸汽机的“蒸汽→电力”模型，但功率与耗汽量远高（对齐《异星工厂》5.8MW）。
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
    this.powerOut = POWER_PER_TURBINE * this.outMult;
    this.on = this.powerOut > 0.05;
    if (this.on) this.spin += dt * 10 * (0.35 + 0.65 * this.outMult);
    if (typeof regPowerEnt === 'function') regPowerEnt(this);
  }
  // 顶部/底部汽口：从上方反应堆出汽格、或相邻汽轮机/蒸汽管道取蒸汽
  portFlow() {
    const covers = (n, cx, cy) => cx >= n.x && cx < n.x + n.w && cy >= n.y && cy < n.y + n.h;
    const midX = this.x + (this.w >> 1);
    forEachNeighborEnt(this, n => {
      // 顶部格：接反应堆底边出汽口；底部格：接管道/汽轮机串接
      const topPort = covers(n, midX, this.y - 1);
      const botPort = covers(n, midX, this.y + this.h);
      if (n instanceof Pipe) {
        if (!(topPort || botPort)) return;
        if (this.steamBuf < TURBINE_STEAM_CAP - 0.01 && (n.fluid['steam'] || 0) >= 1) {
          n.takeItemOf('steam'); this.steamBuf++;
        }
      } else if (n instanceof SteamTurbine) {
        if (!(topPort || botPort)) return;
        if (this.steamBuf >= n.steamBuf + 1 && n.steamBuf < TURBINE_STEAM_CAP - 0.01) { this.steamBuf--; n.steamBuf++; }
        else if (n.steamBuf >= this.steamBuf + 1 && this.steamBuf < TURBINE_STEAM_CAP - 0.01) { n.steamBuf--; this.steamBuf++; }
      } else if (n instanceof NuclearReactor) {
        // 反应堆底边出汽口正对汽轮机顶部：直接受汽
        if (topPort && this.steamBuf < TURBINE_STEAM_CAP - 0.01 && n.steamBuf >= 1) { n.steamBuf--; this.steamBuf++; }
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
    const t = super.restore(s);
    t.steamBuf = s.steamBuf || 0;
    return t;
  }
}
function drawSteamTurbine(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const w = TILE * e.w, h = TILE * e.h;
  const om = Math.max(0, Math.min(1, e.outMult || 0));
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#6a7a8a';
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 8); ctx.fill();
  ctx.strokeStyle = '#3c4a58';
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 8); ctx.stroke();
  // 旋转叶片
  const cx = px + w / 2, cy = py + h * 0.42;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(e.spin || 0);
  ctx.fillStyle = om > 0 ? '#cfe0f0' : '#7d8894';
  gearShape(ctx, 0, 0, w * 0.22, w * 0.1, 12);
  ctx.fill();
  ctx.restore();
  // 叶片转速示意
  if (om > 0.02) {
    ctx.strokeStyle = 'rgba(200,225,255,.5)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const t = ((G.time * 4 * om) + i / 4) % 1;
      ctx.beginPath();
      ctx.arc(cx, cy, w * 0.32, t * Math.PI * 2 - 0.2, t * Math.PI * 2 + 0.2);
      ctx.stroke();
    }
  }
  // 功率输出
  ctx.fillStyle = om > 0.02 ? '#bff0bf' : '#8a93a0';
  ctx.font = 'bold 10px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText((e.powerOut || 0).toFixed(0) + ' kW', cx, py + h * 0.8);
  // 底部汽口
  drawPort(ctx, cx, py + h, 1, PORT_STEAM, true, 0, TILE);
  ctx.globalAlpha = 1;
}
function turbinePanelHtml(e) {
  return row('功率输出', '<span class="dim"></span>', 'power') +
    row('蒸汽缓存', '<span class="dim"></span>', 'steam') +
    '<div class="status"></div>' +
    '<div class="dim">汽轮机：底边汽口接入高温蒸汽（来自核反应堆/蒸汽管道），以远高于蒸汽机的功率发电。核能技术解锁。</div>';
}
function turbinePanelLive(e, api) {
  api.set('power', '+' + (e.powerOut || 0).toFixed(0) + ' kW');
  api.set('steam', e.steamBuf >= 1 ? chip('steam', Math.floor(e.steamBuf)) : dimSpan('空'));
  if (e.on) api.status('发电中：' + (e.powerOut || 0).toFixed(0) + ' kW', 'ok');
  else if (e.steamBuf < 0.5) api.status('已暂停：无高温蒸汽', 'warn');
  else api.status('待机', 'ok');
}
function turbineTip(e) {
  return e.on ? '发电中 ' + (e.powerOut || 0).toFixed(0) + ' kW'
    : e.steamBuf < 0.5 ? '无高温蒸汽（检查底部汽口/管道）' : '待机';
}

// ===== 注册 =====
ENT_CLASSES['centrifuge'] = Centrifuge;
DEVICE_RENDER['centrifuge'] = drawCentrifuge;
DEVICE_STATUS['centrifuge'] = e => e.crafting ? 'g' : 'r';
DEVICE_PANEL['centrifuge'] = { html: centrifugePanelHtml, live: centrifugePanelLive, tip: centrifugeTip };

ENT_CLASSES['nuclear-reactor'] = NuclearReactor;
DEVICE_RENDER['nuclear-reactor'] = drawNuclearReactor;
DEVICE_STATUS['nuclear-reactor'] = e => e.burning ? 'g' : (e.steamBuf >= REACTOR_STEAM_CAP - 0.01 ? 'y' : 'r');
DEVICE_PANEL['nuclear-reactor'] = { html: reactorPanelHtml, live: reactorPanelLive, tip: reactorTip };

ENT_CLASSES['steam-turbine'] = SteamTurbine;
DEVICE_RENDER['steam-turbine'] = drawSteamTurbine;
DEVICE_STATUS['steam-turbine'] = e => e.on ? 'g' : 'r';
DEVICE_PANEL['steam-turbine'] = { html: turbinePanelHtml, live: turbinePanelLive, tip: turbineTip };
