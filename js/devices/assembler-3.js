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
    const rec = RECIPES[this.recipe];
    if (this.crafting) {
      // 速度：组装机 III 基础 1.25，远高于 I/II；叠加科技与电力饱和
      this.prog += dt * asmMult() * 1.25 * (G.power.sat < 1 ? G.power.sat : 1);
      this.spin += dt * 4;
      if (this.prog >= rec.time) {
        for (const k in rec.out) this.outp[k] = (this.outp[k] || 0) + rec.out[k];
        this.crafting = false;
        this.prog = 0;
      }
      return;
    }
    for (const k in rec.inp) if ((this.inp[k] || 0) < rec.inp[k]) return;
    for (const k in rec.out) if ((this.outp[k] || 0) + rec.out[k] > 50) return;
    for (const k in rec.inp) {
      this.inp[k] -= rec.inp[k];
      if (this.inp[k] <= 0) delete this.inp[k];
    }
    this.crafting = true;
    this.prog = 0;
  }
  powerDemand() { return this.recipe ? POWER_USE['assembling-machine-3'] : 0; }
}

// ===== 渲染：与组装机 I/II 共用绘制，仅换色（深紫金属）=====
function drawAssembler3(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w, sh = TILE * e.h;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#5f3f8a';
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 7); ctx.fill();
  ctx.strokeStyle = '#382252';
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 7); ctx.stroke();
  ctx.fillStyle = '#4c3070';
  rr(ctx, px + 10, py + 10, s - 20, sh - 20, 5); ctx.fill();
  ctx.save();
  ctx.translate(px + s / 2, py + s / 2);
  ctx.rotate(e.crafting ? e.spin : 0);
  ctx.fillStyle = e.crafting ? '#e0d0f2' : '#a98fd0';
  gearShape(ctx, 0, 0, 18, 12, 8);
  ctx.fill();
  ctx.restore();
  if (e.recipe) {
    const outId = Object.keys(RECIPES[e.recipe].out)[0];
    drawItemDotBig(ctx, px + s / 2, py + s / 2, outId);
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
  if (fr && fr.fin.length) drawPort(ctx, pcx, pcy, (dir + 2) % 4, ITEMS[fr.fin[0]].color, false, 0, TILE);
  else drawPort(ctx, pcx, pcy, (dir + 2) % 4, PORT_FLUID, false, 0, TILE);
  if (fr && fr.fout.length) drawPort(ctx, pcx, pcy, dir, ITEMS[fr.fout[0]].color, true, 0, TILE);
  ctx.globalAlpha = 1;
}

// ===== 面板：复用组装机面板（配方选择/输入/输出/进度）=====
function assembler3PanelHtml(e) {
  let h = row('当前配方', e.recipe ? ITEMS[Object.keys(RECIPES[e.recipe].out)[0]].name : '<span class="dim">未设置</span>');
  // 消耗/产出速率显示在面板靠前位置（当前配方之后）
  h += machRateHtml(e.recipe ? RECIPES[e.recipe] : null, e.recipe ? asmMult() * 1.25 * 1.5 * elecMachMult() : 1);
  h += row('电力', powerStatusLiveHtml(e), 'power');
  h += row('输入', Object.keys(e.inp).length ? countStr(e.inp) : '<span class="dim">空</span>', 'input');
  if (e.recipe)
    for (const k in RECIPES[e.recipe].inp) {
      const n = Math.min(invCount(k), 50 - (e.inp[k] || 0));
      if (n > 0 && FLUIDS.indexOf(k) < 0) h += '<button data-action="feed" data-id="' + k + '">放入' +
        ITEMS[k].name + ' ×' + n + '</button>';
    }
  if (Object.keys(e.inp).length) h += '<button data-action="takein">取回全部输入</button>';
  h += row('输出', Object.keys(e.outp).length ? countStr(e.outp) : '<span class="dim">空</span>', 'output');
  h += '<button data-action="takeout" id="btn-takeout" style="display:none"></button>';
  h += barHtml(0);
  h += '<div class="status"></div>';
  h += '<div class="sec">选择配方</div>';
  h += '<input id="asm-recipe-search" class="inv-search" type="text" placeholder="搜索配方（输入物品名称）" autocomplete="off" value="">';
  h += '<div class="recgrid">';
  for (const rid of Object.keys(RECIPES).filter(r => !isChemRecipe(r))) {
    const outId = Object.keys(RECIPES[rid].out)[0];
    const selCls = e.recipe === rid ? 'sel' : '';
    const searchKey = (ITEMS[outId].name + ' ' + outId + ' ' +
      Object.keys(RECIPES[rid].inp).map(k => ITEMS[k].name).join(' ')).toLowerCase();
    h += '<button class="rcbtn ' + selCls + '" data-action="recipe" data-id="' + rid + '" data-itemid="' + outId + '" data-rsearch="' + searchKey.replace(/"/g, '') + '" data-tip="' +
      ITEMS[outId].name + '|' + RECIPES[rid].out[outId] + '个/次，耗时' + RECIPES[rid].time + '秒">' +
      '<img src="' + iconDataURL(outId) + '">' + ITEMS[outId].name + '</button>';
  }
  h += '</div>';
  h += '<div class="dim" id="asm-recipe-empty" style="display:none"></div>';
  if (e.recipe) h += '<button data-action="recipe-clear">清除配方</button>';
  h += '<div class="dim">组装机 III：吃电力、速度最高的组装机。选中后按 R 旋转朝向（流体入口在背部、固体产物经机械臂取走）。</div>';
  return h;
}
function assembler3PanelLive(e, api) {
  api.set('power', powerStatusLiveHtml(e));
  api.set('input', Object.keys(e.inp).length ? countStr(e.inp) : dimSpan('空'));
  api.set('output', Object.keys(e.outp).length ? countStr(e.outp) : dimSpan('空'));
  const n = Object.values(e.outp).reduce((a, b) => a + b, 0);
  api.toggle('#btn-takeout', n > 0, '取回全部输出 (' + n + ')');
  api.prog(e.recipe && e.crafting ? e.prog / RECIPES[e.recipe].time * 100 : 0);
  if (!e.recipe) { api.status('未设置配方，点击下方选择', 'warn'); return; }
  if (e.crafting) { api.status('生产中：' + ITEMS[Object.keys(RECIPES[e.recipe].out)[0]].name, 'ok'); return; }
  if (G.power.sat <= 0) { api.status('已暂停：缺电', 'bad'); return; }
  for (const k in RECIPES[e.recipe].out)
    if ((e.outp[k] || 0) + RECIPES[e.recipe].out[k] > 50) { api.status('已暂停：输出已满（' + ITEMS[k].name + '）', 'warn'); return; }
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
DEVICE_PANEL['assembling-machine-3'] = { html: assembler3PanelHtml, live: assembler3PanelLive, tip: assembler3Tip };
DEVICE_DIR_ROTATE['assembling-machine-3'] = true;
