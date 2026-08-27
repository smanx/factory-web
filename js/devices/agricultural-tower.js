'use strict';

// ===== 农业塔：太空时代作物种植建筑（对齐《异星工厂》Space Age Agricultural tower，占地 3×3）=====
// 数据（占地/血量/功耗/堆叠）全部来自 GAME_DATA（由 factorio-data 生成）。
// 官方 max_health=500、energy_usage=100kW、selection_box ±1.5 → 3×3、堆叠 20。
// 在玉玛果人造土/玉玛果沃土上种植作物：放入玉玛果种子后持续收获玉玛果，
// 每个生长周期有概率返还玉玛果种子，实现自持种植循环（对齐官方种植/收获机制）。
// 专用于 Gleba 生物质链（玉玛果 → 果泥 → 生物流 → 农业科研包）。

class AgriculturalTower extends Assembler {
  constructor(type, x, y) {
    super('agricultural-tower', x, y);
  }
  // 是否位于对应作物土壤上（对齐《异星工厂》：农业塔须在对应作物土壤上种植）
  // 玉玛果种植须在玉玛果土壤上，果仁种植须在果仁土壤上（人工/茂盛均可）
  onSoil() {
    const tx = this.x, ty = this.y;
    const t = getTerrain(tx, ty);
    if (this.recipe === 'jellynut-growing') {
      return t === T_JELLYNUT_SOIL || t === T_OVERGROWTH_JELLYNUT_SOIL;
    }
    return t === T_YUMAKO_SOIL || t === T_OVERGROWTH_YUMAKO_SOIL;
  }
  update(dt) {
    this.portFlow();
    if (!this.recipe) { this.crafting = false; return; }
    // 须种植在雅玛果土壤上（人工/茂盛均可），否则停止生长
    if (!this.onSoil()) { this.crafting = false; return; }
    if (G.power.sat <= 0) { this.crafting = false; return; }
    // 电路条件不满足时暂停（对齐《异星工厂》：电路控制配方启停）
    if (!this.circuitEnabled()) { this.crafting = false; return; }
    const rec = RECIPES[this.recipe];
    if (this.crafting) {
      // 生长速度：农业塔无官方 crafting_speed（种植建筑），固定按配方 time 生长；
      // 仍受速度模块/信号塔/品质加成影响（对齐生产建筑加成体系）
      this.prog += dt * asmMult() * this.moduleSpeedMult() * powerFactor() * (this.quality ? qualityMult(this.quality) : 1);
      this.spin += dt * 4;
      if (typeof onScreen === 'function' && onScreen(this) && typeof playSfx === 'function' && G.settings.sound) {
        this._runSfxT = (this._runSfxT || 0) - dt;
        if (this._runSfxT <= 0) { this._runSfxT = 1.4; playSfx('machine-run'); }
      }
      if (this.prog >= rec.time) {
        for (const k in rec.out) {
          emitQuality(this, this.outp, k, rec.out[k]);
          if (typeof trackProd === 'function') trackProd(k, rec.out[k]);
        }
        // 收获时 60% 概率返还 1 粒作物种子（官方作物收获会返还种子，保证种植可自持循环）
        // 玉玛果种植返还玉玛果种子，果仁种植返还果仁种子（对齐官方双作物农业塔）
        const seedId = this.recipe === 'yumako-growing' ? 'yumako-seed' : (this.recipe === 'jellynut-growing' ? 'jellynut-seed' : null);
        if (seedId && Math.random() < 0.6) {
          this.outp[seedId] = (this.outp[seedId] || 0) + 1;
          if (typeof trackProd === 'function') trackProd(seedId, 1);
        }
        this.applyProductivity(rec);
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
  // 模块槽位：官方 agricultural-tower 无 module_slots（种植建筑），此处回退 2（支持种植效率加成）
  moduleSlotCount() { return GAME_DATA.deviceStats?.[this.type]?.moduleSlots ?? 2; }
  powerDemand() { return this.recipe ? POWER_USE['agricultural-tower'] || 100 : 0; }
}

// ===== 渲染：土褐色农业塔 + 绿色作物田 =====
function drawAgriculturalTower(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w, sh = TILE * e.h;
  ctx.globalAlpha = alpha;
  // 底座（土褐色土壤）
  ctx.fillStyle = '#6a4a2a';
  rr(ctx, px + 2, py + 2, s - 4, sh - 4, 6); ctx.fill();
  ctx.strokeStyle = '#4a3018';
  ctx.lineWidth = 3;
  rr(ctx, px + 2, py + 2, s - 4, sh - 4, 6); ctx.stroke();
  // 中央作物区（绿色）
  ctx.fillStyle = '#3a7a3a';
  rr(ctx, px + 10, py + 10, s - 20, sh - 20, 5); ctx.fill();
  // 作物生长进度动画
  ctx.save();
  ctx.translate(px + s / 2, py + s / 2);
  if (e.crafting) {
    const pct = Math.min(1, e.prog / (RECIPES[e.recipe] ? RECIPES[e.recipe].time : 1));
    ctx.fillStyle = '#5aa84a';
    for (let i = 0; i < 6; i++) {
      const a = i * Math.PI / 3 + e.spin * 0.3;
      const r = 8 + pct * 14;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6, 3 + pct * 3, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    ctx.fillStyle = '#4a8a3a';
    gearShape(ctx, 0, 0, 14, 9, 6);
    ctx.fill();
  }
  ctx.restore();
  if (e.recipe) {
    const outId = Object.keys(RECIPES[e.recipe].out)[0];
    drawRecipeIconCell(ctx, px + s / 2, py + s / 2, outId);
    const pct = e.crafting ? Math.min(1, e.prog / RECIPES[e.recipe].time) : 0;
    if (pct > 0) {
      ctx.strokeStyle = '#9ae08a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px + s / 2, py + s / 2, 26, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
      ctx.stroke();
    }
  } else if (!(LOD && LOD.simple)) {
    drawRecipePlaceholder(ctx, px + s / 2, py + s / 2, s * 0.5);
  }
  ctx.globalAlpha = 1;
}

// ===== 面板：复用组装机面板，仅列出种植配方 =====
function agriPanelHtml(e) {
  let h = row('当前作物', e.recipe ? ITEMS[Object.keys(RECIPES[e.recipe].out)[0]].name : '<span class="dim">未设置</span>');
  h += machRateHtml(e.recipe ? RECIPES[e.recipe] : null, e.recipe ? asmMult() : 1);
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
  h += '<div class="sec">选择作物</div>';
  h += '<input id="asm-recipe-search" class="inv-search" type="text" placeholder="搜索作物" autocomplete="off" value="">';
  h += '<div class="recgrid">';
  for (const rid of Object.keys(RECIPES).filter(r => isAgricultureTowerRecipe(r))) {
    const outId = Object.keys(RECIPES[rid].out)[0];
    const selCls = e.recipe === rid ? 'sel' : '';
    const inpStr = Object.keys(RECIPES[rid].inp).map(k => ITEMS[k].name + '×' + RECIPES[rid].inp[k]).join('、');
    const searchKey = (ITEMS[outId].name + ' ' + outId + ' ' +
      Object.keys(RECIPES[rid].inp).map(k => ITEMS[k].name).join(' ')).toLowerCase();
    const tipMain = ITEMS[outId].name + '|' + RECIPES[rid].out[outId] + '个/次，耗时' + RECIPES[rid].time + '秒';
    const tipRecipe = '所需种子：' + inpStr;
    h += '<button class="rcbtn ' + selCls + '" data-action="recipe" data-id="' + rid + '" data-itemid="' + outId + '" data-rsearch="' + searchKey.replace(/"/g, '') + '" data-tip="' + tipMain + '||' + tipRecipe + '">' +
      '<img src="' + iconDataURL(outId) + '">' + ITEMS[outId].name + '</button>';
  }
  h += '</div>';
  h += '<div class="dim" id="asm-recipe-empty" style="display:none"></div>';
  if (e.recipe) h += '<button data-action="recipe-clear">清除作物</button>';
  h += '<div class="dim">农业塔：太空时代作物种植建筑，可种植玉玛果或果冻果（Gleba 双作物）。放入对应作物种子后持续收获，收获有概率返还种子（自持循环）。须种植在对应作物的土壤上（玉玛果/果冻果人造土或沃土）。数据（占地/血量/功耗）来自 GAME_DATA。选中后按 R 旋转朝向。</div>';
  h += circuitPanelHtml(e, 'agri');
  return h;
}
function agriPanelLive(e, api) {
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
  if (!e.recipe) { api.status('未设置作物，点击下方选择', 'warn'); return; }
  if (!e.onSoil()) { api.status(e.recipe === 'jellynut-growing' ? '已暂停：须种植在果冻果人造土/沃土上' : '已暂停：须种植在玉玛果人造土/沃土上', 'warn'); return; }
  if (e.crafting) { api.status('生长中：' + ITEMS[Object.keys(RECIPES[e.recipe].out)[0]].name, 'ok'); return; }
  if (G.power.sat <= 0) { api.status('已暂停：缺电', 'bad'); return; }
  for (const k in RECIPES[e.recipe].out)
    if ((e.outp[k] || 0) + RECIPES[e.recipe].out[k] > 50) { api.status('已暂停：输出已满（' + ITEMS[k].name + '）', 'warn'); return; }
  const missing = Object.keys(RECIPES[e.recipe].inp).filter(k => (e.inp[k] || 0) < RECIPES[e.recipe].inp[k]);
  if (missing.length) { api.status('已暂停：缺少种子 ' + missing.map(k => ITEMS[k].name).join('、'), 'warn'); return; }
  api.status('已暂停：等待种子', 'warn');
}
function agriTip(e) {
  const base = e.recipe ? ('种植 ' + ITEMS[Object.keys(RECIPES[e.recipe].out)[0]].name) : '未设置作物，点击打开面板';
  const s = powerStatusOf(e);
  if (s.consuming && s.sat < 1) return base + '；' + (s.sat > 0 ? '电量不足' + Math.round(s.sat * 100) + '%' : '缺电停摆');
  return base;
}

// ===== 注册 =====
ENT_CLASSES['agricultural-tower'] = AgriculturalTower;
DEVICE_RENDER['agricultural-tower'] = drawAgriculturalTower;
DEVICE_STATUS['agricultural-tower'] = e => {
  const s = powerStatusOf(e);
  if (s.consuming) return s.color;
  return e.recipe ? (e.crafting || e.prog > 0 ? 'g' : 'y') : 'r';
};
DEVICE_PANEL['agricultural-tower'] = { html: agriPanelHtml, live: agriPanelLive, tip: agriTip, onAction: (a) => circuitPanelAction('agri', a) };
DEVICE_DIR_ROTATE['agricultural-tower'] = true;
