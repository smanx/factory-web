'use strict';

// ===== 组装机 III：吃电力、速度最高的组装机（对齐《异星工厂》Assembling machine 3，占地 3×3）=====
class Assembler3 extends Assembler {
  constructor(type, x, y) {
    super('assembling-machine-3', x, y);
  }
  update(dt) {
    this.portFlow();
    if (!this.recipe) { this.crafting = false; return; }
    if (G.power.sat <= 0) { this.crafting = false; return; }
    // 电路条件不满足时暂停生产（对齐《异星工厂》：电路控制配方启停）
    if (!this.circuitEnabled()) { this.crafting = false; return; }
    const rec = RECIPES[this.recipe];
    if (this.crafting) {
      // 速度：组装机 III 基础 1.25，远高于 I/II；叠加科技与电力饱和
      this.prog += dt * asmMult() * (GAME_DATA.deviceStats?.[this.type]?.craftingSpeed ?? 1.25) * this.moduleSpeedMult() * powerFactor() * (this.quality ? qualityMult(this.quality) : 1);
      this.spin += dt * 4;
      if (this.prog >= rec.time) {
        for (const k in rec.out) {
          emitQuality(this, this.outp, k, rec.out[k]);
          if (typeof trackProd === 'function') trackProd(k, rec.out[k]);
        }
        this.applyProductivity(rec);
        // 物品产能无限科技：对主产物累积额外产出（对齐《异星工厂》*-productivity）
        {
          const mainOut = Object.keys(rec.out)[0];
          if (mainOut && typeof applyTechProductivity === 'function') {
            const extra = applyTechProductivity(this, mainOut, rec.out[mainOut]);
            if (extra > 0) { this.outp[mainOut] = (this.outp[mainOut] || 0) + extra; if (typeof trackProd === 'function') trackProd(mainOut, extra); }
          }
        }
        if (this.recipe && this.recipe.indexOf('-barrel') >= 0 && typeof playSfx === 'function') playSfx('barrel');
        this.crafting = false;
        this.prog = 0;
      }
      return;
    }
    for (const k in rec.inp) if ((this.inp[k] || 0) < rec.inp[k]) return;
    // 产物堆积即停工（动态「够用」：存量足够再产 2 次即停，防止原料积压在前端机器）
    if (outputBacklogged(this.outp, rec.out)) return;
    for (const k in rec.inp) {
      this.inp[k] -= rec.inp[k];
      if (typeof trackProd === 'function') trackProd(k, -rec.inp[k]);
      if (this.inp[k] <= 0) delete this.inp[k];
    }
    this.crafting = true;
    this.prog = 0;
  }
  powerDemand() { return this.recipe ? POWER_USE['assembling-machine-3'] : 0; }
}

// ===== 渲染：复用组装机 I/II/III 通用绘制主体（按 e.type 自动取 MK3 配色）=====
// 见 [assembler.js] drawAssembler；这里只是为了在加载顺序上保证 drawAssembler 一定可用，
// 把相同的调用别名挂在 drawAssembler3 上，保持注册表入口稳定。
function drawAssembler3(ctx, e, gx, gy, dir, alpha) {
  return drawAssembler(ctx, e, gx, gy, dir, alpha);
}

// ===== 面板：复用组装机面板（配方选择/输入/输出/进度）=====
function assembler3PanelHtml(e) {
  let h = row('当前配方', e.recipe ? ITEMS[Object.keys(RECIPES[e.recipe].out)[0]].name : '<span class="dim">未设置</span>');
  // 消耗/产出速率显示在面板靠前位置（当前配方之后）：组装机 III 速度为 I 的 2.5 倍（官方 crafting_speed 1.25/0.5），并受电学科技加成
  h += machRateHtml(e.recipe ? RECIPES[e.recipe] : null, e.recipe ? asmMult() * ((GAME_DATA.deviceStats?.[e.type]?.craftingSpeed ?? 1.25) / 0.5) * elecMachMult() : 1);
  h += row('电力', powerStatusLiveHtml(e), 'power');
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
  for (const rid of Object.keys(RECIPES).filter(r => !isChemRecipe(r) && !isCryoRecipe(r))) {
    const outId = Object.keys(RECIPES[rid].out)[0];
    const selCls = e.recipe === rid ? 'sel' : '';
    // 鼠标悬停显示所需原料（异星工厂惯例）：名称与介绍为主标题，所需原料放入独立的 tooltip 配方区块
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
  h += '<div class="dim">组装机 III：吃电力、速度最高的组装机。选中后按 R 旋转朝向（流体入口在背部、固体产物经机械臂取走）。</div>';
  h += circuitPanelHtml(e, 'am3');
  return h;
}
function assembler3PanelLive(e, api) {
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
  if (outputBacklogged(e.outp, RECIPES[e.recipe].out)) { api.status('已暂停：产物堆积（够用 2 次生产）', 'warn'); return; }
  const missing = Object.keys(RECIPES[e.recipe].inp).filter(k => (e.inp[k] || 0) < RECIPES[e.recipe].inp[k]);
  if (missing.length) { api.status('已暂停：缺少原料 ' + missing.map(k => ITEMS[k].name).join('、'), 'warn'); return; }
  api.status('已暂停：等待材料就绪', 'warn');
}
function assembler3Tip(e) {
  const base = e.recipe ? ('生产 ' + ITEMS[Object.keys(RECIPES[e.recipe].out)[0]].name) : '未设置配方，点击打开面板';
  const s = powerStatusOf(e);
  if (s.consuming && s.sat < 1) return base + '；' + (s.sat > 0 ? '电量不足' + Math.round(s.sat * 100) + '%' : '缺电停摆');
  return base;
}

// ===== 注册 =====
ENT_CLASSES['assembling-machine-3'] = Assembler3;
DEVICE_RENDER['assembling-machine-3'] = drawAssembler3;
// 组装机 III：正在耗电时按供电状态显灯（电量不足黄灯、缺电停摆红灯）；未耗电时按原逻辑
DEVICE_STATUS['assembling-machine-3'] = e => {
  const s = powerStatusOf(e);
  if (s.consuming) return s.color;
  return e.recipe ? (e.crafting || e.prog > 0 ? 'g' : 'y') : 'r';
};
DEVICE_PANEL['assembling-machine-3'] = { html: assembler3PanelHtml, live: assembler3PanelLive, tip: assembler3Tip, onAction: (a) => circuitPanelAction('am3', a) };
DEVICE_DIR_ROTATE['assembling-machine-3'] = true;
// 显示详情时，各接口图标所在世界格 + 对应流体名（用于鼠标悬停显示流体名称）
DEVICE_FLUID_ICONS['assembling-machine-3'] = e => fluidIconFinFout(e, e.x * TILE + TILE * e.w / 2, e.y * TILE + TILE * e.h / 2);
