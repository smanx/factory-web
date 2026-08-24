'use strict';

// ===== 组装机：设置配方后自动生产 =====
class Assembler extends Entity {
  constructor(type, x, y) {
    super(type || 'assembling-machine', x, y);
    this.recipe = null;
    this.inp = {};
    this.outp = {};
    this.crafting = false;
    this.prog = 0;
    this.spin = 0;
    this.modules = {};      // { 'speed-module': n, 'productivity-module': n }
    this.prodBuf = 0;       // 产能模块累积进度
  }
  fluidRecipe() {
    const r = this.recipe ? RECIPES[this.recipe] : null;
    if (!r) return null;
    const fin = Object.keys(r.inp).filter(k => FLUIDS.indexOf(k) >= 0);
    const fout = Object.keys(r.out).filter(k => FLUIDS.indexOf(k) >= 0);
    return (fin.length || fout.length) ? { rec: r, fin, fout } : null;
  }
  acceptsFluid(k) {
    const r = this.recipe ? RECIPES[this.recipe] : null;
    return !!(r && r.inp[k]);
  }
  portFlow() {
    const fr = this.fluidRecipe();
    if (!fr) return;
    forEachNeighborEnt(this, n => {
      if (!(n instanceof Pipe)) return;
      for (const k of fr.fin)
        if ((this.inp[k] || 0) < 50 && (n.fluid[k] || 0) >= 1) {
          n.takeItemOf(k);
          this.inp[k] = (this.inp[k] || 0) + 1;
        }
      for (const k of fr.fout)
        if ((this.outp[k] || 0) > 0 && n.total() < PIPE_CAP && n.giveItem(k)) {
          this.outp[k]--;
          if (this.outp[k] <= 0) delete this.outp[k];
        }
    });
  }
  update(dt) {
    this.portFlow();
    if (!this.recipe) { this.crafting = false; return; }
    if (G.power.sat <= 0) { this.crafting = false; return; }
    const rec = RECIPES[this.recipe];
    if (this.crafting) {
      this.prog += dt * asmMult() * 0.5 * this.moduleSpeedMult() * powerFactor();
      this.spin += dt * 4;
      // 工业氛围：组装机运转时低频迸出细碎火花（画面优化）
      if (typeof spawnSpark === 'function' && Math.random() < dt * 1.2) {
        spawnSpark((this.x + 0.5 + (Math.random() - 0.5) * 0.7) * TILE, (this.y + 0.4) * TILE, { size: 1.2, life: 0.4, speed: 2 });
      }
      if (this.prog >= rec.time) {
        for (const k in rec.out) {
          this.outp[k] = (this.outp[k] || 0) + rec.out[k];
          if (typeof trackProd === 'function') trackProd(k, rec.out[k]);
        }
        this.applyProductivity(rec);
        if (this.recipe && this.recipe.indexOf('-barrel') >= 0 && typeof playSfx === 'function') playSfx('barrel');
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
  // 模块速度倍率（速度模块加速，产能/效率模块小降速）
  moduleSpeedMult() {
    const mc = moduleCounts(this.modules);
    // 信号塔广播的额外模块加成（本机模块槽外额外叠加）
    const bb = (typeof beaconBonus === 'function') ? beaconBonus(this.x, this.y) : null;
    if (bb) { mc.speed += bb.speed; mc.prod += bb.prod; mc.eff += bb.eff; }
    return 1 + 0.4 * mc.speed - 0.1 * mc.prod - 0.03 * mc.eff;
  }
  // 每次生产后结算产能模块：返回额外主产物数量
  applyProductivity(rec) {
    const mc = moduleCounts(this.modules);
    const bb = (typeof beaconBonus === 'function') ? beaconBonus(this.x, this.y) : null;
    let nProd = mc.prod;
    if (bb) nProd += bb.prod;
    if (nProd > 0) {
      const thr = moduleProdThreshold(this.modules);
      this.prodBuf = (this.prodBuf || 0) + nProd;
      if (this.prodBuf >= thr) {
        this.prodBuf -= thr;
        const mainOut = Object.keys(rec.out)[0];
        if (mainOut) { this.outp[mainOut] = (this.outp[mainOut] || 0) + 1; if (typeof trackProd === 'function') trackProd(mainOut, 1); return 1; }
      }
    }
    return 0;
  }
  powerDemand() {
    if (!this.recipe) return 0;
    const mc = moduleCounts(this.modules);
    const bb = (typeof beaconBonus === "function") ? beaconBonus(this.x, this.y) : null;
    if (bb) { mc.speed += bb.speed; mc.prod += bb.prod; mc.eff += bb.eff; }
    // 效率模块降低耗电（最多降到 20%）：每当量 -15%
    const effMult = Math.max(0.2, 1 - 0.15 * mc.eff);
    // 速度/产能模块增加耗电（按当量比例）
    const powMult = 1 + (mc.speed * 0.25 + mc.prod * 0.25);
    return POWER_USE['assembling-machine'] * powMult * effMult;
  }
  setRecipe(id) {
    if (this.recipe === id) return;
    this.recipe = id;
    this.inp = {}; this.outp = {};
    this.crafting = false; this.prog = 0;
  }
  giveItem(item) {
    if (isModule(item)) {
      if ((this.modules[item] || 0) >= 4) return false;
      this.modules[item] = (this.modules[item] || 0) + 1;
      if (typeof playSfx === 'function') playSfx('module');
      return true;
    }
    if (!this.recipe) return false;
    const rec = RECIPES[this.recipe];
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
    for (const k in this.outp) {
      if (this.outp[k] > 0) {
        this.outp[k]--;
        if (this.outp[k] <= 0) delete this.outp[k];
        return k;
      }
    }
    return null;
  }
  countOf(item) { return this.outp[item] || 0; }
  takeItemOf(item) {
    if ((this.outp[item] || 0) > 0) { this.outp[item]--; if (this.outp[item] <= 0) delete this.outp[item]; return item; }
    return null;
  }
  contents() {
    const list = [[this.type, 1]];
    for (const k in this.modules) if (this.modules[k] > 0) list.push([k, this.modules[k]]);
    for (const k in this.inp) list.push([k, this.inp[k]]);
    for (const k in this.outp) list.push([k, this.outp[k]]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.recipe = this.recipe; s.inp = this.inp; s.outp = this.outp;
    s.crafting = this.crafting; s.prog = this.prog;
    s.modules = this.modules; s.prodBuf = this.prodBuf;
    return s;
  }
  // 蓝图只保留配方配置，不复制内部原料/输出/进度
  blueprint() {
    const s = super.blueprint();
    s.recipe = this.recipe;
    return s;
  }
  static restore(s) {
    const a = super.restore(s);
    a.recipe = s.recipe || null; a.inp = s.inp || {}; a.outp = s.outp || {};
    a.crafting = !!s.crafting; a.prog = s.prog || 0;
    a.modules = s.modules || {}; a.prodBuf = s.prodBuf || 0;
    return a;
  }
}

// ===== 渲染（组装机 I/II 共用，按 type 换色）=====
function drawAssembler(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w;
  const sh = TILE * e.h;
  const mk2 = e.type === 'assembling-machine-mk2';
  const bodyC = mk2 ? '#6b4d8f' : '#4d5f8f';
  const lineC = mk2 ? '#3c2a52' : '#2e3a5c';
  const innerC = mk2 ? '#4c3a66' : '#3a486e';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = bodyC;
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 7); ctx.fill();
  ctx.strokeStyle = lineC;
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 7); ctx.stroke();
  ctx.fillStyle = innerC;
  rr(ctx, px + 10, py + 10, s - 20, sh - 20, 5); ctx.fill();
  ctx.save();
  ctx.translate(px + s / 2, py + s / 2);
  ctx.rotate(e.crafting ? e.spin : 0);
  ctx.fillStyle = e.crafting ? '#cdd6ea' : '#8b98bd';
  gearShape(ctx, 0, 0, 18, 12, 8);
  ctx.fill();
  ctx.restore();
  if (e.recipe) {
    const outId = Object.keys(RECIPES[e.recipe].out)[0];
    drawRecipeIconCell(ctx, px + s / 2, py + s / 2, outId);
    const pct = e.crafting ? Math.min(1, e.prog / RECIPES[e.recipe].time) : 0;
    if (pct > 0) {
      ctx.strokeStyle = '#8fe08f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px + s / 2, py + s / 2, 24, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
      ctx.stroke();
    }
  } else {
    if (!(LOD && LOD.simple)) {
      ctx.fillStyle = 'rgba(255,255,255,.6)';
      ctx.font = 'bold 11px system-ui';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('无配方', px + s / 2, py + s / 2 + 30);
    }
  }
  const fr = e.fluidRecipe ? e.fluidRecipe() : null;
  const pcx = px + s / 2, pcy = py + s / 2;
  // 流体入口：背部恒有一口通用流体口（可按 R 旋转朝向），用于接管道向配方输送流体原料
  if (fr && fr.fin.length) drawPort(ctx, pcx, pcy, (dir + 2) % 4, ITEMS[fr.fin[0]].color, false, 0, TILE);
  else drawPort(ctx, pcx, pcy, (dir + 2) % 4, PORT_FLUID, false, 0, TILE);
  if (fr && fr.fout.length) drawPort(ctx, pcx, pcy, dir, ITEMS[fr.fout[0]].color, true, 0, TILE);
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function assemblerPanelHtml(e) {
  let h = row('当前配方', e.recipe ? ITEMS[Object.keys(RECIPES[e.recipe].out)[0]].name : '<span class="dim">未设置</span>');
  // 组装机 II 速度为 I 的 1.5 倍，并受电学科技加成
  const asmM = e.type === 'assembling-machine-mk2' ? asmMult() * 1.5 * elecMachMult() : asmMult();
  // 消耗/产出速率显示在面板靠前位置（当前配方之后）
  h += machRateHtml(e.recipe ? RECIPES[e.recipe] : null, e.recipe ? asmM : 1);
  // 吃电机型（组装机 II）显示当前耗电状态与是否电量不足
  if (typeof e.powerDemand === 'function') h += row('电力', powerStatusLiveHtml(e), 'power');
  h += row('输入', Object.keys(e.inp).length ? countStr(e.inp) : '<span class="dim">空</span>', 'input');
  if (e.recipe)
    for (const k in RECIPES[e.recipe].inp) {
      const n = Math.min(invCount(k), 50 - (e.inp[k] || 0));
      if (n > 0 && FLUIDS.indexOf(k) < 0) h += '<button data-action="feed" data-id="' + k + '">放入' +
        ITEMS[k].name + ' ×' + n + '</button>';
    }
  if (Object.keys(e.inp).length) h += '<button data-action="takein">取回全部输入</button>';
  // 模块槽位
  {
    const mc = moduleCounts(e.modules);
    const hasMod = (Object.keys(e.modules).length > 0);
    h += row('模块', hasMod ?
      '速度+' + mc.speed.toFixed(1) + ' 产能+' + mc.prod.toFixed(1) + ' 效率-' + mc.eff.toFixed(1) : '<span class="dim">无</span>', 'mod');
    for (const mid of Object.keys(e.modules)) {
      if ((e.modules[mid] || 0) > 0) h += '<span class="dim">' + ITEMS[mid].name + ' ×' + e.modules[mid] + '</span> ';
    }
    const order = ['speed-module', 'speed-module-2', 'speed-module-3', 'productivity-module', 'productivity-module-2', 'productivity-module-3', 'efficiency-module', 'efficiency-module-2', 'efficiency-module-3'];
    for (const mid of order) {
      if (!itemUnlocked(mid)) continue;
      const n = Math.min(invCount(mid), 4 - (e.modules[mid] || 0));
      if (n > 0) h += '<button data-action="feed" data-id="' + mid + '">装入' + ITEMS[mid].name + ' ×' + n + '</button>';
    }
    if (hasMod) h += '<button data-action="takein" data-modules="1">取出全部模块</button>';
  }
  h += row('输出', Object.keys(e.outp).length ? countStr(e.outp) : '<span class="dim">空</span>', 'output');
  h += '<button data-action="takeout" id="btn-takeout" style="display:none"></button>';
  h += barHtml(0);
  h += '<div class="status"></div>';
  h += '<div class="sec">选择配方</div>';
  h += '<input id="asm-recipe-search" class="inv-search" type="text" placeholder="搜索配方（输入物品名称）" autocomplete="off" value="">';
  h += '<div class="recgrid">';
  for (const rid of Object.keys(RECIPES).filter(r => !isChemRecipe(r) && !isCentrifugeRecipe(r))) {
    const outId = Object.keys(RECIPES[rid].out)[0];
    const unlocked = recipeUnlocked(rid);
    const lockTech = recipeLockingTech(rid);
    const selCls = e.recipe === rid ? 'sel' : '';
    // 鼠标悬停显示所需原料（异星工厂惯例）
    const inpStr = Object.keys(RECIPES[rid].inp).map(k => ITEMS[k].name + '×' + RECIPES[rid].inp[k]).join('、');
    const searchKey = (ITEMS[outId].name + ' ' + outId + ' ' +
      Object.keys(RECIPES[rid].inp).map(k => ITEMS[k].name).join(' ')).toLowerCase();
    h += '<button class="rcbtn ' + selCls + (unlocked ? '' : ' locked') + '" data-action="recipe" data-id="' + rid + '" data-itemid="' + outId + '" data-rsearch="' + searchKey.replace(/"/g, '') + '" data-tip="' +
      ITEMS[outId].name + '|' + RECIPES[rid].out[outId] + '个/次，耗时' + RECIPES[rid].time + '秒。所需原料：' + inpStr + (unlocked ? '' : '。未解锁：需先研究「' + TECHS[lockTech].name + '」') + '" ' + (unlocked ? '' : 'disabled') + '>' +
      '<img src="' + iconDataURL(outId) + '">' + ITEMS[outId].name + (unlocked ? '' : '<br><small>🔒' + TECHS[lockTech].name + '</small>') + '</button>';
  }
  h += '</div>';
  h += '<div class="dim" id="asm-recipe-empty" style="display:none"></div>';
  if (e.recipe) h += '<button data-action="recipe-clear">清除配方</button>';
  h += '<div class="dim">选中后按 R 旋转朝向（流体入口在背部、固体产物经机械臂取走）；背部通用流体口可接管道，向含流体原料的配方自动供液。</div>';
  return h;
}
function assemblerPanelLive(e, api) {
  if (typeof e.powerDemand === 'function') api.set('power', powerStatusLiveHtml(e));
  api.set('input', Object.keys(e.inp).length ? countStr(e.inp) : dimSpan('空'));
  api.set('output', Object.keys(e.outp).length ? countStr(e.outp) : dimSpan('空'));
  {
    const mc = moduleCounts(e.modules);
    api.set('mod', (Object.keys(e.modules).length > 0) ?
      '速度+' + mc.speed.toFixed(1) + ' 产能+' + mc.prod.toFixed(1) + ' 效率-' + mc.eff.toFixed(1) : dimSpan('无'));
  }
  const n = Object.values(e.outp).reduce((a, b) => a + b, 0);
  api.toggle('#btn-takeout', n > 0, '取回全部输出 (' + n + ')');
  api.prog(e.recipe && e.crafting ? e.prog / RECIPES[e.recipe].time * 100 : 0);
  // 状态：工作中或暂停原因（异星工厂惯例：缺料/输出满/缺电）
  if (!e.recipe) { api.status('未设置配方，点击下方选择', 'warn'); return; }
  if (e.crafting) { api.status('生产中：' + ITEMS[Object.keys(RECIPES[e.recipe].out)[0]].name, 'ok'); return; }
  const rec = RECIPES[e.recipe];
  // 仅吃电的机型（组装机 II）在缺电时暂停；组装机 I 不吃电
  const needsPower = typeof e.powerDemand === 'function' && e.powerDemand() > 0;
  if (needsPower && G.power.sat <= 0) { api.status('已暂停：缺电', 'bad'); return; }
  for (const k in rec.out)
    if ((e.outp[k] || 0) + rec.out[k] > 50) { api.status('已暂停：输出已满（' + ITEMS[k].name + '）', 'warn'); return; }
  const missing = Object.keys(rec.inp).filter(k => (e.inp[k] || 0) < rec.inp[k]);
  if (missing.length) {
    api.status('已暂停：缺少原料 ' + missing.map(k => ITEMS[k].name).join('、'), 'warn');
    return;
  }
  api.status('已暂停：等待材料就绪', 'warn');
}
function assemblerTip(e) {
  const base = e.recipe ? ('生产 ' + ITEMS[Object.keys(RECIPES[e.recipe].out)[0]].name) : '未设置配方，点击打开面板';
  // 吃电机型（组装机 II）：电量不足（正在耗电且 sat<1）时在提示中注明
  if (typeof e.powerDemand === 'function') {
    const s = powerStatusOf(e);
    if (s.consuming && s.sat < 1) return base + '；' + (s.sat > 0 ? '电量不足' + Math.round(s.sat * 100) + '%' : '缺电停摆');
  }
  return base;
}

// ===== 注册 =====
ENT_CLASSES['assembling-machine'] = Assembler;
DEVICE_RENDER['assembling-machine'] = drawAssembler;
DEVICE_RENDER['assembling-machine-mk2'] = drawAssembler;
function assemblerStatusFn(e) {
  // 吃电机型（组装机 II）：正在耗电时按供电状态显灯（电量不足黄灯、缺电停摆红灯）
  if (typeof e.powerDemand === 'function') {
    const s = powerStatusOf(e);
    if (s.consuming) return s.color;
  }
  return e.recipe ? (e.crafting || e.prog > 0 ? 'g' : 'y') : 'r';
}
DEVICE_STATUS['assembling-machine'] = assemblerStatusFn;
DEVICE_STATUS['assembling-machine-mk2'] = assemblerStatusFn;
const assemblerPanel = { html: assemblerPanelHtml, live: assemblerPanelLive, tip: assemblerTip };
DEVICE_PANEL['assembling-machine'] = assemblerPanel;
DEVICE_PANEL['assembling-machine-mk2'] = assemblerPanel;
// 组装机 I/II 均可旋转朝向；旋转改变流体入口/出口所在侧（背部入口、前部出口）
DEVICE_DIR_ROTATE['assembling-machine'] = true;
DEVICE_DIR_ROTATE['assembling-machine-mk2'] = true;
