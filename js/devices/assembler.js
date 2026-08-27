'use strict';

// ===== 组装机：设置配方后自动生产 =====
class Assembler extends Entity {
  constructor(type, x, y) {
    super(type || 'assembling-machine-1', x, y);
    this.recipe = null;
    this.inp = {};
    this.outp = {};
    this.crafting = false;
    this.prog = 0;
    this.spin = 0;
    this.modules = {};      // { 'speed-module': n, 'productivity-module': n }
    this.prodBuf = 0;       // 产能模块累积进度
    // 电路控制（对齐《异星工厂》：生产建筑可接入电路网络，按信号条件启用/禁用配方）
    this.circuitCond = { enabled: false, channel: 'red', sig: 'iron-plate', op: '>', count: 1 };
  }
  // 电路启停：未启用条件时恒工作；启用后仅当附近电路信号满足条件才生产
  circuitEnabled() {
    if (!this.circuitCond || !this.circuitCond.enabled) return true;
    const sig = circuitSignalNear(this);
    return circuitCondOk(sig, this.circuitCond);
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
    // 电路条件不满足时暂停生产（对齐《异星工厂》：电路控制配方启停）
    if (!this.circuitEnabled()) { this.crafting = false; return; }
    const rec = RECIPES[this.recipe];
    if (this.crafting) {
      const qMult = (typeof qualityMult === 'function' && this.quality) ? qualityMult(this.quality) : 1;
      this.prog += dt * asmMult() * (GAME_DATA.deviceStats?.[this.type]?.craftingSpeed ?? 0.5) * this.moduleSpeedMult() * powerFactor() * qMult;
      this.spin += dt * 4;
      // 工业氛围：组装机运转时低频迸出细碎火花（画面优化）
      if (typeof spawnSpark === 'function' && Math.random() < dt * 1.2) {
        spawnSpark((this.x + 0.5 + (Math.random() - 0.5) * 0.7) * TILE, (this.y + 0.4) * TILE, { size: 1.2, life: 0.4, speed: 2 });
      }
      // 运转环境音：低频“嗡嗡”（仅屏内可见时播放，限频避免音爆）
      if (typeof onScreen === 'function' && onScreen(this) && typeof playSfx === 'function' && G.settings.sound) {
        this._runSfxT = (this._runSfxT || 0) - dt;
        if (this._runSfxT <= 0) { this._runSfxT = 1.4; playSfx('machine-run'); }
      }
      if (this.prog >= rec.time) {
        for (const k in rec.out) {
          emitQuality(this, this.outp, k, rec.out[k]);
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
  // 模块槽位数（对齐《异星工厂》官方 module_slots）：组装机 II=2、III=4；
  // I 型官方 0 槽但项目允许装模块 → 无官方值时回退 4（保持历史行为）。
  moduleSlotCount() { return GAME_DATA.deviceStats?.[this.type]?.moduleSlots ?? 4; }
  // 模块速度倍率（速度模块加速，产能/效率模块小降速）
  moduleSpeedMult() {
    const mc = moduleCounts(this.modules);
    // 信号塔广播的额外模块加成（本机模块槽外额外叠加）
    const bb = (typeof beaconBonus === 'function') ? beaconBonus(this.x, this.y) : null;
    if (bb) { mc.speed += bb.speed; mc.prod += bb.prod; mc.eff += bb.eff; }
    return 1 + 0.4 * mc.speed - 0.1 * mc.prod - 0.03 * mc.eff - mc.qualityPenalty;
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
    return POWER_USE['assembling-machine-1'] * powMult * effMult;
  }
  setRecipe(id) {
    if (this.recipe === id) return;
    // 切换配方前返还已投入/已产出物料（对齐《异星工厂》：切换配方返还残留）
    if (this.inp || this.outp) returnMachineContents(this);
    this.recipe = id;
    this.inp = {}; this.outp = {};
    this.crafting = false; this.prog = 0;
  }
  giveItem(item) {
    if (isModule(item)) {
      if ((this.modules[item] || 0) >= this.moduleSlotCount()) return false;
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
    if (this.circuitCond) s.circuitCond = this.circuitCond;
    return s;
  }
  // 蓝图只保留配方配置，不复制内部原料/输出/进度
  blueprint() {
    const s = super.blueprint();
    s.recipe = this.recipe;
    if (this.circuitCond) s.circuitCond = this.circuitCond;
    return s;
  }
  static restore(s) {
    const a = super.restore(s);
    a.recipe = s.recipe || null; a.inp = s.inp || {}; a.outp = s.outp || {};
    a.crafting = !!s.crafting; a.prog = s.prog || 0;
    a.modules = s.modules || {}; a.prodBuf = s.prodBuf || 0;
    a.circuitCond = s.circuitCond || { enabled: false, channel: 'red', sig: 'iron-plate', op: '>', count: 1 };
    return a;
  }
}

// ===== 渲染（组装机 I/II 共用，按 type 换色）=====
function drawAssembler(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w;
  const sh = TILE * e.h;
  const mk2 = e.type === 'assembling-machine-2';
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
  } else if (!(LOD && LOD.simple)) {
    // 未选配方：显示默认齿轮图标（不再显示中文）
    drawRecipePlaceholder(ctx, px + s / 2, py + s / 2, s * 0.5);
  }
  const fr = e.fluidRecipe ? e.fluidRecipe() : null;
  const pcx = px + s / 2, pcy = py + s / 2;
  // 流体入口：背部恒有一口通用流体口（可按 R 旋转朝向），用于接管道向配方输送流体原料
  const fin = (fr && fr.fin.length) ? fr.fin[0] : null;
  const fout = (fr && fr.fout.length) ? fr.fout[0] : null;
  drawPort(ctx, pcx, pcy, (dir + 2) % 4, fin ? ITEMS[fin].color : PORT_FLUID, false, 0, TILE, fin || null, 'in');
  drawPort(ctx, pcx, pcy, dir, fout ? ITEMS[fout].color : PORT_FLUID, true, 0, TILE, fout || null, 'out');
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function assemblerPanelHtml(e) {
  let h = row('当前配方', e.recipe ? ITEMS[Object.keys(RECIPES[e.recipe].out)[0]].name : '<span class="dim">未设置</span>');
  // 组装机 II 速度为 I 的 1.5 倍（官方 crafting_speed 0.75/0.5），并受电学科技加成
  const asmM = e.type === 'assembling-machine-2' ? asmMult() * ((GAME_DATA.deviceStats?.[e.type]?.craftingSpeed ?? 0.75) / 0.5) * elecMachMult() : asmMult();
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
      '速度+' + mc.speed.toFixed(1) + ' 产能+' + mc.prod.toFixed(1) + ' 效率-' + mc.eff.toFixed(1) + ' 品质+' + (mc.quality*100).toFixed(1) + '%' : '<span class="dim">无</span>', 'mod');
    for (const mid of Object.keys(e.modules)) {
      if ((e.modules[mid] || 0) > 0) h += '<span class="dim">' + ITEMS[mid].name + ' ×' + e.modules[mid] + '</span> ';
    }
    const order = ['speed-module', 'speed-module-2', 'speed-module-3', 'productivity-module', 'productivity-module-2', 'productivity-module-3', 'efficiency-module', 'efficiency-module-2', 'efficiency-module-3', 'quality-module', 'quality-module-2', 'quality-module-3'];
    for (const mid of order) {
      if (!itemUnlocked(mid)) continue;
      const n = Math.min(invCount(mid), e.moduleSlotCount() - (e.modules[mid] || 0));
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
  for (const rid of Object.keys(RECIPES).filter(r => !isChemRecipe(r) && !isCentrifugeRecipe(r) && !isAgricultureTowerRecipe(r) && !isCryogenicRecipe(r))) {
    const outId = Object.keys(RECIPES[rid].out)[0];
    const unlocked = recipeUnlocked(rid);
    const lockTech = recipeLockingTech(rid);
    const selCls = e.recipe === rid ? 'sel' : '';
    // 鼠标悬停显示所需原料（异星工厂惯例）：名称与介绍为主标题，所需原料放入独立的 tooltip 配方区块
    const inpStr = Object.keys(RECIPES[rid].inp).map(k => ITEMS[k].name + '×' + RECIPES[rid].inp[k]).join('、');
    const searchKey = (ITEMS[outId].name + ' ' + outId + ' ' +
      Object.keys(RECIPES[rid].inp).map(k => ITEMS[k].name).join(' ')).toLowerCase();
    const tipMain = ITEMS[outId].name + '|' + RECIPES[rid].out[outId] + '个/次，耗时' + RECIPES[rid].time + '秒' + (unlocked ? '' : '。未解锁：需先研究「' + TECHS[lockTech].name + '」');
    const tipRecipe = '所需原料：' + inpStr;
    h += '<button class="rcbtn ' + selCls + (unlocked ? '' : ' locked') + '" data-action="recipe" data-id="' + rid + '" data-itemid="' + outId + '" data-rsearch="' + searchKey.replace(/"/g, '') + '" data-tip="' + tipMain + '||' + tipRecipe + '" ' + (unlocked ? '' : 'disabled') + '>' +
      '<img src="' + iconDataURL(outId) + '">' + ITEMS[outId].name + (unlocked ? '' : '<br><small>🔒' + TECHS[lockTech].name + '</small>') + '</button>';
  }
  h += '</div>';
  h += '<div class="dim" id="asm-recipe-empty" style="display:none"></div>';
  if (e.recipe) h += '<button data-action="recipe-clear">清除配方</button>';
  h += '<div class="dim">选中后按 R 旋转朝向（流体入口在背部、固体产物经机械臂取走）；背部通用流体口可接管道，向含流体原料的配方自动供液。</div>';
  h += circuitPanelHtml(e, 'am');
  return h;
}
function assemblerPanelLive(e, api) {
  if (e.circuitCond && e.circuitCond.enabled && !e.circuitEnabled()) { api.status('已暂停：电路条件不满足', 'warn'); return; }
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
  api.prog(e.recipe && e.crafting ? e.prog / RECIPES[e.recipe].time * 100 : 0, e.recipe ? RECIPES[e.recipe].time : 0);
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
ENT_CLASSES['assembling-machine-1'] = Assembler;
DEVICE_RENDER['assembling-machine-1'] = drawAssembler;
DEVICE_RENDER['assembling-machine-2'] = drawAssembler;
function assemblerStatusFn(e) {
  // 吃电机型（组装机 II）：正在耗电时按供电状态显灯（电量不足黄灯、缺电停摆红灯）
  if (typeof e.powerDemand === 'function') {
    const s = powerStatusOf(e);
    if (s.consuming) return s.color;
  }
  return e.recipe ? (e.crafting || e.prog > 0 ? 'g' : 'y') : 'r';
}
DEVICE_STATUS['assembling-machine-1'] = assemblerStatusFn;
DEVICE_STATUS['assembling-machine-2'] = assemblerStatusFn;
const assemblerPanel = { html: assemblerPanelHtml, live: assemblerPanelLive, tip: assemblerTip, onAction: (a) => circuitPanelAction('am', a) };
DEVICE_PANEL['assembling-machine-1'] = assemblerPanel;
DEVICE_PANEL['assembling-machine-2'] = assemblerPanel;
// 组装机 I/II 均可旋转朝向；旋转改变流体入口/出口所在侧（背部入口、前部出口）
DEVICE_DIR_ROTATE['assembling-machine-1'] = true;
DEVICE_DIR_ROTATE['assembling-machine-2'] = true;

// ===== 品质产出（对齐《异星工厂》Quality DLC）=====
// 设备含品质模块时，每次产出每个单位有 chance 概率升级为更高品质（罕见/稀有/史诗/传说）。
// 品质物品以 `item~quality` 键存储于输出缓存，取走/机械臂搬运时按带品质键处理。
function emitQuality(e, outp, itemId, count) {
  // 仅对可受益于品质的物品（建筑/装备，已在 ITEMS 预生成品质变体）施加品质升级；
  // 普通材料（铁板/电路板等）不产生品质变体，保持常规产出，避免出现无法显示的品质物品。
  const eligible = (typeof QUALITY_ELIGIBLE_ITEMS !== 'undefined' && QUALITY_ELIGIBLE_ITEMS.has(itemId));
  const chance = eligible ? moduleQualityChance(e.modules) : 0;
  // 信号塔广播的品质加成（信号塔模块槽装品质模块同样广播）
  const bb = (typeof beaconBonus === 'function') ? beaconBonus(e.x, e.y) : null;
  const totalChance = chance + (bb ? bb.quality || 0 : 0);
  if (totalChance <= 0) {
    outp[itemId] = (outp[itemId] || 0) + count;
    return;
  }
  for (let i = 0; i < count; i++) {
    const q = rollQualityUpgrade('normal', totalChance);
    const tagged = tagQuality(itemId, q);
    outp[tagged] = (outp[tagged] || 0) + 1;
  }
}
