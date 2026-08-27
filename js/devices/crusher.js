'use strict';

// ===== 破碎机：太空时代小行星碎块加工建筑（对齐《异星工厂》Space Age，占地 2×3）=====
// 数据（占地/血量/功耗/制造速度/模块槽）全部来自 GAME_DATA（由 factorio-data 生成）。
// 官方 crafting_speed=1、module_slots=2、max_health=350、energy_usage=540kW。
// 官方为太空平台专属（surface_conditions gravity=0），此处适配为地面设备；
// 专用于小行星碎块（金属/碳质/氧化星块）的粉碎加工。
// 配方主产出 id（确定性配方取 out 首项；概率配方取概率最高产物，供面板/提示/渲染展示）
function crusherMainOut(rec) {
  if (!rec) return null;
  if (rec.prob) return Object.keys(rec.prob).sort((a, b) => rec.prob[b] - rec.prob[a])[0];
  return Object.keys(rec.out)[0];
}

class Crusher extends Assembler {
  constructor(type, x, y) {
    super('crusher', x, y);
  }
  update(dt) {
    this.portFlow();
    if (!this.recipe) { this.crafting = false; return; }
    if (G.power.sat <= 0) { this.crafting = false; return; }
    if (!this.circuitEnabled()) { this.crafting = false; return; }
    const rec = RECIPES[this.recipe];
    if (this.crafting) {
      // 速度：破碎机基础 1.0（GAME_DATA.deviceStats.craftingSpeed）
      this.prog += dt * asmMult() * (GAME_DATA.deviceStats?.[this.type]?.craftingSpeed ?? 1.0) * this.moduleSpeedMult() * powerFactor() * (this.quality ? qualityMult(this.quality) : 1);
      this.spin += dt * 4;
      if (typeof onScreen === 'function' && onScreen(this) && typeof playSfx === 'function' && G.settings.sound) {
        this._runSfxT = (this._runSfxT || 0) - dt;
        if (this._runSfxT <= 0) { this._runSfxT = 1.4; playSfx('machine-run'); }
      }
      if (this.prog >= rec.time) {
        if (rec.prob) {
          // 概率产出（星块再处理）：按官方 shared_probability 随机转换为一种星块
          let r = Math.random();
          let chosen = null;
          for (const k in rec.prob) {
            r -= rec.prob[k];
            if (r < 0) { chosen = k; break; }
          }
          if (chosen) { emitQuality(this, this.outp, chosen, 1); if (typeof trackProd === 'function') trackProd(chosen, 1); }
        } else {
          for (const k in rec.out) {
            emitQuality(this, this.outp, k, rec.out[k]);
            if (typeof trackProd === 'function') trackProd(k, rec.out[k]);
          }
        }
        this.applyProductivity(rec);
        this.crafting = false;
        this.prog = 0;
      }
      return;
    }
    for (const k in rec.inp) if ((this.inp[k] || 0) < rec.inp[k]) return;
    if (rec.prob) {
      let total = 0;
      for (const k in this.outp) total += this.outp[k];
      if (total >= 50) return;
    } else {
      for (const k in rec.out) if ((this.outp[k] || 0) + rec.out[k] > 50) return;
    }
    for (const k in rec.inp) {
      this.inp[k] -= rec.inp[k];
      if (typeof trackProd === 'function') trackProd(k, -rec.inp[k]);
      if (this.inp[k] <= 0) delete this.inp[k];
    }
    this.crafting = true;
    this.prog = 0;
  }
  // 模块槽位：官方 module_slots=2（GAME_DATA.deviceStats）
  moduleSlotCount() { return GAME_DATA.deviceStats?.[this.type]?.moduleSlots ?? 2; }
  powerDemand() { return this.recipe ? POWER_USE['crusher'] : 0; }
}

// ===== 渲染：岩石/工业风，破碎机有转动的粉碎辊 =====
function drawCrusher(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w, sh = TILE * e.h;
  ctx.globalAlpha = alpha;
  // 机座
  ctx.fillStyle = '#5a4f45';
  rr(ctx, px + 2, py + 2, s - 4, sh - 4, 6); ctx.fill();
  ctx.strokeStyle = '#3d352d';
  ctx.lineWidth = 3;
  rr(ctx, px + 2, py + 2, s - 4, sh - 4, 6); ctx.stroke();
  // 顶部进料斗
  ctx.fillStyle = '#6a5d50';
  rr(ctx, px + 8, py + 8, s - 16, 16, 4); ctx.fill();
  ctx.fillStyle = '#4a4037';
  ctx.fillRect(px + 12, py + 18, s - 24, 4);
  // 中央粉碎辊（转动）
  ctx.save();
  ctx.translate(px + s / 2, py + sh / 2 + 6);
  ctx.rotate(e.crafting ? e.spin : 0);
  ctx.fillStyle = e.crafting ? '#b0a294' : '#7a6f63';
  ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#3d352d'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, 20, 0, Math.PI * 2); ctx.stroke();
  for (let i = 0; i < 4; i++) {
    const a = i * Math.PI / 2;
    ctx.fillStyle = '#8a7c6d';
    ctx.fillRect(Math.cos(a) * 12 - 4, Math.sin(a) * 12 - 4, 8, 8);
  }
  ctx.restore();
  // 下方出料口
  ctx.fillStyle = '#4a4037';
  ctx.fillRect(px + 14, py + sh - 14, s - 28, 8);
  if (portDetailsVisible() && e.recipe) {
    const outId = crusherMainOut(RECIPES[e.recipe]);
    drawRecipeIconCell(ctx, px + s / 2, py + sh / 2 - 4, outId);

  } else if (!(LOD && LOD.simple) && portDetailsVisible()) {
    drawRecipePlaceholder(ctx, px + s / 2, py + sh / 2 - 4, s * 0.4);
  }
  const fr = e.fluidRecipe ? e.fluidRecipe() : null;
  const pcx = px + s / 2, pcy = py + sh / 2 - 4;
  const fin = (fr && fr.fin.length) ? fr.fin[0] : null;
  const fout = (fr && fr.fout.length) ? fr.fout[0] : null;
  drawPort(ctx, pcx, pcy, (dir + 2) % 4, fin ? ITEMS[fin].color : PORT_FLUID, false, 0, TILE, fin || null, 'in');
  drawPort(ctx, pcx, pcy, dir, fout ? ITEMS[fout].color : PORT_FLUID, true, 0, TILE, fout || null, 'out');
  ctx.globalAlpha = 1;
}

// ===== 面板：复用组装机面板，仅列出破碎配方 =====
function crusherPanelHtml(e) {
  let h = row('当前配方', e.recipe ? ITEMS[crusherMainOut(RECIPES[e.recipe])].name : '<span class="dim">未设置</span>');
  h += machRateHtml(e.recipe ? RECIPES[e.recipe] : null, e.recipe ? asmMult() * ((GAME_DATA.deviceStats?.[e.type]?.craftingSpeed ?? 1.0) / 0.5) * elecMachMult() : 1);
  h += row('电力', powerStatusLiveHtml(e), 'power');
  h += row('输入', Object.keys(e.inp).length ? countStr(e.inp) : '<span class="dim">空</span>', 'input');
  if (e.recipe)
    for (const k in RECIPES[e.recipe].inp) {
      const n = Math.min(invCount(k), 50 - (e.inp[k] || 0));
      if (n > 0 && FLUIDS.indexOf(k) < 0) h += '<button data-action="feed" data-id="' + k + '">放入' + ITEMS[k].name + ' ×' + n + '</button>';
    }
  if (Object.keys(e.inp).length) h += '<button data-action="takein">取回全部输入</button>';
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
  h += '<div class="sec">选择配方（破碎加工）</div>';
  h += '<input id="asm-recipe-search" class="inv-search" type="text" placeholder="搜索配方（输入物品名称）" autocomplete="off" value="">';
  h += '<div class="recgrid">';
  for (const rid of Object.keys(RECIPES).filter(r => isCrusherRecipe(r))) {
    const outId = crusherMainOut(RECIPES[rid]);
    const selCls = e.recipe === rid ? 'sel' : '';
    const inpStr = Object.keys(RECIPES[rid].inp).map(k => ITEMS[k].name + '×' + RECIPES[rid].inp[k]).join('、');
    const searchKey = (ITEMS[outId].name + ' ' + outId + ' ' +
      Object.keys(RECIPES[rid].inp).map(k => ITEMS[k].name).join(' ')).toLowerCase();
    const outAmt = RECIPES[rid].prob ? ('概率 ' + (RECIPES[rid].prob[outId] * 100) + '%') : (RECIPES[rid].out[outId] + '个/次');
    const tipMain = ITEMS[outId].name + '|' + outAmt + '，耗时' + RECIPES[rid].time + '秒';
    const tipRecipe = '所需原料：' + inpStr;
    h += '<button class="rcbtn ' + selCls + '" data-action="recipe" data-id="' + rid + '" data-itemid="' + outId + '" data-rsearch="' + searchKey.replace(/"/g, '') + '" data-tip="' + tipMain + '||' + tipRecipe + '">' +
      '<img src="' + iconDataURL(outId) + '">' + ITEMS[outId].name + '</button>';
  }
  h += '</div>';
  h += '<div class="dim" id="asm-recipe-empty" style="display:none"></div>';
  if (e.recipe) h += '<button data-action="recipe-clear">清除配方</button>';
  h += '<div class="dim">破碎机：太空时代破碎建筑，专用于小行星碎块加工（官方 crafting_speed 1.0、模块槽 2）。选中后按 R 旋转朝向。原料/产物经机械臂或玩家装卸。</div>';
  h += circuitPanelHtml(e, 'crusher');
  return h;
}
function crusherPanelLive(e, api) {
  if (e.circuitCond && e.circuitCond.enabled && !e.circuitEnabled()) { api.status('已暂停：电路条件不满足', 'warn'); return; }
  api.set('power', powerStatusLiveHtml(e));
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
  if (!e.recipe) { api.status('未设置配方，点击下方选择', 'warn'); return; }
  if (e.crafting) { api.status('生产中：' + ITEMS[crusherMainOut(RECIPES[e.recipe])].name, 'ok'); return; }
  if (G.power.sat <= 0) { api.status('已暂停：缺电', 'bad'); return; }
  {
    const rcp = RECIPES[e.recipe];
    if (rcp.prob) {
      let total = 0; for (const k in e.outp) total += e.outp[k];
      if (total >= 50) { api.status('已暂停：输出已满（概率配方，货柜已满）', 'warn'); return; }
    } else {
      for (const k in rcp.out) if ((e.outp[k] || 0) + rcp.out[k] > 50) { api.status('已暂停：输出已满（' + ITEMS[k].name + '）', 'warn'); return; }
    }
  }
  const missing = Object.keys(RECIPES[e.recipe].inp).filter(k => (e.inp[k] || 0) < RECIPES[e.recipe].inp[k]);
  if (missing.length) { api.status('已暂停：缺少原料 ' + missing.map(k => ITEMS[k].name).join('、'), 'warn'); return; }
  api.status('已暂停：等待材料就绪', 'warn');
}
function crusherTip(e) {
  const base = e.recipe ? ('生产 ' + ITEMS[crusherMainOut(RECIPES[e.recipe])].name) : '未设置配方，点击打开面板';
  const s = powerStatusOf(e);
  if (s.consuming && s.sat < 1) return base + '；' + (s.sat > 0 ? '电量不足' + Math.round(s.sat * 100) + '%' : '缺电停摆');
  return base;
}

// ===== 注册 =====
ENT_CLASSES['crusher'] = Crusher;
DEVICE_RENDER['crusher'] = drawCrusher;
DEVICE_STATUS['crusher'] = e => {
  const s = powerStatusOf(e);
  if (s.consuming) return s.color;
  return e.recipe ? (e.crafting || e.prog > 0 ? 'g' : 'y') : 'r';
};
DEVICE_PANEL['crusher'] = { html: crusherPanelHtml, live: crusherPanelLive, tip: crusherTip, onAction: (a) => circuitPanelAction('crusher', a) };
DEVICE_DIR_ROTATE['crusher'] = true;
// 显示详情时，各接口图标所在世界格 + 对应流体名（用于鼠标悬停显示流体名称）
DEVICE_FLUID_ICONS['crusher'] = e => fluidIconFinFout(e, e.x * TILE + TILE * e.w / 2, e.y * TILE + TILE * e.h / 2 - 4);
