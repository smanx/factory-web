'use strict';

// ===== 冷冻厂：太空时代低温生产建筑（对齐《异星工厂》Space Age，占地 5×5）=====
// 数据（占地/血量/功耗/制造速度/模块槽）全部来自 GAME_DATA（由 factorio-data 生成）。
// 官方 crafting_speed=2、module_slots=8、max_health=350、energy_usage=1500kW（官方最多模块槽的工厂）。
// 官方为 Aquilo 低温星球专属（surface_conditions pressure），此处适配为地面设备；
// 专用于低温科研包（cryogenic-science-pack）等低温产物的生产。

class CryogenicPlant extends Assembler {
  constructor(type, x, y) {
    super('cryogenic-plant', x, y);
  }
  update(dt) {
    this.portFlow();
    if (!this.recipe) { this.crafting = false; return; }
    if (G.power.sat <= 0) { this.crafting = false; return; }
    if (!this.circuitEnabled()) { this.crafting = false; return; }
    const rec = RECIPES[this.recipe];
    if (this.crafting) {
      // 速度：冷冻厂基础 2.0（GAME_DATA.deviceStats.craftingSpeed），与电磁工厂同级、模块槽最多
      this.prog += dt * asmMult() * (GAME_DATA.deviceStats?.[this.type]?.craftingSpeed ?? 2.0) * this.moduleSpeedMult() * powerFactor() * (this.quality ? qualityMult(this.quality) : 1);
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
  // 模块槽位：官方 module_slots=8（GAME_DATA.deviceStats）
  moduleSlotCount() { return GAME_DATA.deviceStats?.[this.type]?.moduleSlots ?? 8; }
  powerDemand() { return this.recipe ? POWER_USE['cryogenic-plant'] : 0; }
}

// ===== 渲染：蓝青色低温风格（冰晶）=====
function drawCryogenicPlant(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w, sh = TILE * e.h;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#2a3a6a';
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 7); ctx.fill();
  ctx.strokeStyle = '#1a2c58';
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 7); ctx.stroke();
  ctx.fillStyle = '#4a5ddb';
  rr(ctx, px + 10, py + 10, s - 20, sh - 20, 5); ctx.fill();
  // 冰晶雪花中心
  ctx.save();
  ctx.translate(px + s / 2, py + s / 2);
  ctx.rotate(e.crafting ? e.spin : 0);
  ctx.fillStyle = e.crafting ? '#d0f0ff' : '#8ad9c3';
  // 六角雪花
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    ctx.save();
    ctx.rotate(a);
    ctx.fillRect(-3, -24, 6, 14);
    ctx.fillRect(-12, -12, 24, 6);
    ctx.restore();
  }
  ctx.restore();
  if (portDetailsVisible() && e.recipe) {
    const outId = Object.keys(RECIPES[e.recipe].out)[0];
    drawRecipeIconCell(ctx, px + s / 2, py + s / 2, outId);
  }
  ctx.globalAlpha = 1;
}

// ===== 面板：复用组装机面板，仅列出冷冻厂配方 =====
function cryoPanelHtml(e) {
  let h = row('当前配方', e.recipe ? ITEMS[Object.keys(RECIPES[e.recipe].out)[0]].name : '<span class="dim">未设置</span>');
  h += machRateHtml(e.recipe ? RECIPES[e.recipe] : null, e.recipe ? asmMult() * ((GAME_DATA.deviceStats?.[e.type]?.craftingSpeed ?? 2.0) / 0.5) * elecMachMult() : 1);
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
  h += '<div class="sec">选择配方（低温加工）</div>';
  h += '<input id="asm-recipe-search" class="inv-search" type="text" placeholder="搜索配方（输入物品名称）" autocomplete="off" value="">';
  h += '<div class="recgrid">';
  for (const rid of Object.keys(RECIPES).filter(r => isCryoRecipe(r))) {
    const outId = Object.keys(RECIPES[rid].out)[0];
    const selCls = e.recipe === rid ? 'sel' : '';
    const inpStr = Object.keys(RECIPES[rid].inp).map(k => ITEMS[k].name + '×' + RECIPES[rid].inp[k]).join('、');
    const searchKey = (ITEMS[outId].name + ' ' + outId + ' ' +
      Object.keys(RECIPES[rid].inp).map(k => ITEMS[k].name).join(' ')).toLowerCase();
    const tipMain = ITEMS[outId].name + '|' + RECIPES[rid].out[outId] + '个/次，耗时' + RECIPES[rid].time + '秒';
    const tipRecipe = '所需原料：' + inpStr;
    h += '<button class="rcbtn ' + selCls + '" data-action="recipe" data-id="' + rid + '" data-itemid="' + outId + '" data-rsearch="' + searchKey.replace(/"/g, '') + '" data-tip="' + tipMain + '||' + tipRecipe + '">' +
      '<img src="' + iconDataURL(outId) + '">' + ITEMS[outId].name + '</button>';
  }
  h += '</div>';
  h += '<div class="dim" id="asm-recipe-empty" style="display:none"></div>';
  if (e.recipe) h += '<button data-action="recipe-clear">清除配方</button>';
  h += '<div class="dim">冷冻厂：太空时代低温生产建筑，模块槽最多（官方 8）、速度与电磁工厂同级（crafting_speed 2.0）。选中后按 R 旋转朝向。原料/产物经机械臂或玩家装卸。</div>';
  h += circuitPanelHtml(e, 'cryo');
  return h;
}
function cryoPanelLive(e, api) {
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
  if (e.crafting) { api.status('生产中：' + ITEMS[Object.keys(RECIPES[e.recipe].out)[0]].name, 'ok'); return; }
  if (G.power.sat <= 0) { api.status('已暂停：缺电', 'bad'); return; }
  for (const k in RECIPES[e.recipe].out)
    if ((e.outp[k] || 0) + RECIPES[e.recipe].out[k] > 50) { api.status('已暂停：输出已满（' + ITEMS[k].name + '）', 'warn'); return; }
  const missing = Object.keys(RECIPES[e.recipe].inp).filter(k => (e.inp[k] || 0) < RECIPES[e.recipe].inp[k]);
  if (missing.length) { api.status('已暂停：缺少原料 ' + missing.map(k => ITEMS[k].name).join('、'), 'warn'); return; }
  api.status('已暂停：等待材料就绪', 'warn');
}
function cryoTip(e) {
  const base = e.recipe ? ('生产 ' + ITEMS[Object.keys(RECIPES[e.recipe].out)[0]].name) : '未设置配方，点击打开面板';
  const s = powerStatusOf(e);
  if (s.consuming && s.sat < 1) return base + '；' + (s.sat > 0 ? '电量不足' + Math.round(s.sat * 100) + '%' : '缺电停摆');
  return base;
}

// ===== 注册 =====
ENT_CLASSES['cryogenic-plant'] = CryogenicPlant;
DEVICE_RENDER['cryogenic-plant'] = drawCryogenicPlant;
DEVICE_STATUS['cryogenic-plant'] = e => {
  const s = powerStatusOf(e);
  if (s.consuming) return s.color;
  return e.recipe ? (e.crafting || e.prog > 0 ? 'g' : 'y') : 'r';
};
DEVICE_PANEL['cryogenic-plant'] = { html: cryoPanelHtml, live: cryoPanelLive, tip: cryoTip, onAction: (a) => circuitPanelAction('cryo', a) };
DEVICE_DIR_ROTATE['cryogenic-plant'] = true;
