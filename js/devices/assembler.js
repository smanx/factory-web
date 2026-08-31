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
    this.prodTechBuf = 0;   // 科技产能无限科技分数缓冲
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
  // 唯一通用流体口所在世界侧（基准北=3，随 dir 旋转；与 drawAssembler 顶部端口一致）
  portSide() { return (3 + (this.dir | 0)) % 4; }
  // 流体口外侧相邻格（管道只能接在这一格；随 dir 旋转）
  portCell() {
    const sd = this.portSide();
    if (sd === 3) return [this.x + (this.w >> 1), this.y - 1];        // 北：顶边中间格上方
    if (sd === 1) return [this.x + (this.w >> 1), this.y + this.h];   // 南
    if (sd === 0) return [this.x + this.w, this.y + (this.h >> 1)];   // 东
    return [this.x - 1, this.y + (this.h >> 1)];                       // 西
  }
  // 供管道/地下管道/泵/阀判定传入格是否为本机流体口外侧格（组装机仅此一格可接管道）
  isFluidInlet(x, y) {
    const c = this.portCell();
    return c[0] === x && c[1] === y;
  }
  portFlow() {
    const fr = this.fluidRecipe();
    if (!fr) return;
    const pc = this.portCell();
    forEachNeighborEnt(this, n => {
      // 只有流体口外侧那一格的管道/地下管道（管口朝本机）才能与本机互通
      if (!pipeConnAt(n.x, n.y, sideFromEntity(this, n))) return;
      if (n.x !== pc[0] || n.y !== pc[1]) return;
      // 只按原料缓冲上限吸入流体原料：产物不做计数（自循环配方产物即原料）
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
  // 当前每秒推进的 prog 增量（制作速度倍率）：与 update() 中 prog 累加公式同源，
  // 供面板把「工作量剩余」换算成真实剩余秒数（装速度插件后倒计时才与墙钟一致）。
  craftProgRate() {
    const qMult = (typeof qualityMult === 'function' && this.quality) ? qualityMult(this.quality) : 1;
    return asmMult() * (GAME_DATA.deviceStats?.[this.type]?.craftingSpeed ?? 0.5) * this.moduleSpeedMult() * powerFactor(this) * qMult;
  }
  update(dt) {
    this.portFlow();
    if (!this.recipe) { this.crafting = false; return; }
    if (powerSatOf(this) <= 0) { this.crafting = false; return; }
    // 电路条件不满足时暂停生产（对齐《异星工厂》：电路控制配方启停）
    if (!this.circuitEnabled()) { this.crafting = false; return; }
    const rec = RECIPES[this.recipe];
    if (this.crafting) {
      this.prog += dt * this.craftProgRate();
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
    // 配方原料优先：凡属于当前配方输入的物品一律放入原料区。插件若本身是配方
    // 原料（如用低级插件合成高级插件），也必须进入原料区而非插件槽。
    if (this.recipe) {
      const rec = RECIPES[this.recipe];
      if (rec.inp[item]) {
        // 只按原料判定是否超过 2 倍：产物不做计数（自循环配方产物即原料，
        // 把产物算进总量会让设备被自己上一轮产出「喂饱」而拒收下一轮原料）
        if ((this.inp[item] || 0) >= rec.inp[item] * 2) return false;
        this.inp[item] = (this.inp[item] || 0) + 1;
        return true;
      }
    }
    // 非配方原料的插件才放入插件槽（供玩家 mod-put 手动装填）
    if (isModule(item)) {
      if ((this.modules[item] || 0) >= this.moduleSlotCount()) return false;
      this.modules[item] = (this.modules[item] || 0) + 1;
      if (typeof playSfx === 'function') playSfx('module');
      return true;
    }
    return false;
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
  // 取回原料：从设备输入缓存中取 1 件指定原料回背包（供设备面板右键取出）
  takeInputItemOf(item) {
    if ((this.inp[item] || 0) > 0) { this.inp[item]--; if (this.inp[item] <= 0) delete this.inp[item]; return item; }
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
    s.modules = this.modules; s.prodBuf = this.prodBuf; s.prodTechBuf = this.prodTechBuf || 0;
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
    a.modules = s.modules || {}; a.prodBuf = s.prodBuf || 0; a.prodTechBuf = s.prodTechBuf || 0;
    a.circuitCond = s.circuitCond || { enabled: false, channel: 'red', sig: 'iron-plate', op: '>', count: 1 };
    return a;
  }
}

// ===== 渲染（组装机 I/II/III 共用绘制主体，按 type 切换 tier 配色）=====
// 视觉分区（自下而上）：
//   ① 罐底阴影 + 基座  ② 主外壳（顶亮底暗渐变）
//   ③ 焊接筋板  ④ 顶部机械臂横梁 + 左右 2 支机械臂（运转时上下摆动）
//   ⑤ 中央作业窗（玻璃 + 配方图标 + 底部传送带滚动）
//   ⑥ 状态 LED（左右 2 颗）+ 中央档位徽章
//   ⑦ 4 角螺栓  ⑧ 流体端口（北=入口，南=出口）  ⑨ 罐体外框
// 三档共用同一套结构，只换配色：MK1=钢灰 / MK2=科技蓝 / MK3=翠绿
function _asmTierOf(e) {
  if (e.type === 'assembling-machine-3') return {
    label: 'III',
    body: ['#7ad88c', '#3aa860', '#1a5838'], line: '#0a2e1c', inner: '#2a7048',
    armC: '#c8f4d0', beamC: '#4ab068', bolt: '#0a2018', boltHi: 'rgba(180,240,200,0.4)',
    trim: null, ledOn: '#a8f07a', ledOff: '#1a3828',
  };
  if (e.type === 'assembling-machine-2') return {
    label: 'II',
    body: ['#7aabd8', '#3e74b0', '#1e4470'], line: '#0e2040', inner: '#2a5478',
    armC: '#c8e0f8', beamC: '#4a78b0', bolt: '#0a1a30', boltHi: 'rgba(180,210,240,0.4)',
    trim: null, ledOn: '#9ce06c', ledOff: '#1a2840',
  };
  return {
    label: 'I',
    body: ['#9aa4b0', '#5a6470', '#2e3640'], line: '#1a2028', inner: '#3e4854',
    armC: '#d0d8e0', beamC: '#6a7480', bolt: '#0e1218', boltHi: 'rgba(220,230,240,0.4)',
    trim: null, ledOn: '#9ce06c', ledOff: '#2a3038',
  };
}
function drawAssembler(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w, sh = TILE * e.h;
  const cx = px + s / 2, cy = py + sh / 2;
  // 本体随 dir 旋转（R 旋转 / V·H 翻转均改 dir），流体口随本体一起转到背部（顶部）。
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((dir | 0) * Math.PI / 2);
  ctx.translate(-cx, -cy);
  ctx.globalAlpha = alpha;
  const tier = _asmTierOf(e);
  const working = e.crafting;

  // ① 罐底阴影 + 基座
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath();
  ctx.ellipse(cx, py + sh - 2, s * 0.42, 4.5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = tier.line;
  rr(ctx, px + 5, py + sh - 11, s - 10, 8, 3); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(px + 9, py + sh - 6, s - 18, 0.8);

  // ② 主外壳（顶亮底暗渐变）
  const bodyGrad = ctx.createLinearGradient(0, py + 4, 0, py + sh - 4);
  bodyGrad.addColorStop(0,    tier.body[0]);
  bodyGrad.addColorStop(0.5,  tier.body[1]);
  bodyGrad.addColorStop(1,    tier.body[2]);
  ctx.fillStyle = bodyGrad;
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 9); ctx.fill();

  // ③ 焊接筋板（左右各 2 条，明暗交替）
  const ribXs = [px + s * 0.18, px + s * 0.50 - 1, px + s * 0.50 + 1, px + s * 0.82];
  for (let i = 0; i < ribXs.length; i++) {
    const darkSide = (i === 0 || i === 3);
    ctx.fillStyle = darkSide ? 'rgba(0,0,0,0.22)' : (i === 1 ? 'rgba(0,0,0,0.18)' : 'rgba(255,255,255,0.10)');
    ctx.fillRect(ribXs[i], py + 28, 1.4, sh - 50);
    ctx.fillStyle = darkSide ? 'rgba(255,255,255,0.10)' : (i === 1 ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.18)');
    ctx.fillRect(ribXs[i] + (darkSide ? 1.4 : -0.5), py + 28, 0.5, sh - 50);
  }

  // ④ 顶部机械臂横梁
  ctx.fillStyle = tier.beamC;
  rr(ctx, px + 8, py + 12, s - 16, 8, 2.5); ctx.fill();
  ctx.strokeStyle = tier.line;
  ctx.lineWidth = 1;
  rr(ctx, px + 8, py + 12, s - 16, 8, 2.5); ctx.stroke();
  // 横梁高光
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(px + 12, py + 13, s - 24, 1);
  // 轨道齿（横梁下沿小竖线，模拟齿轮齿条）
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  for (let i = 0; i < 6; i++) ctx.fillRect(px + 11 + i * ((s - 22) / 5), py + 18, 1, 2);

  // ⑤ 左右 2 支机械臂（仅运转时上下摆动；MK3 摆动幅度更大以体现高速；未运转时静止收拢）
  const armSpd = (e.type === 'assembling-machine-3' ? 9 : 6);
  const armAmp = (e.type === 'assembling-machine-3' ? 3.5 : 2.5);
  const drawArm = (ax, phase) => {
    const yBase = py + 22, yReach = 14 + (working ? Math.sin((G.time || 0) * armSpd + phase) * armAmp : 0);
    // 滑块（挂在横梁上）
    ctx.fillStyle = tier.line;
    rr(ctx, ax - 3, py + 19, 6, 4, 1); ctx.fill();
    // 垂直臂杆
    ctx.fillStyle = tier.armC;
    ctx.fillRect(ax - 1.4, yBase, 2.8, yReach);
    // 关节（深色铰链点）
    ctx.fillStyle = tier.line;
    ctx.beginPath(); ctx.arc(ax, yBase + 2, 1.4, 0, Math.PI * 2); ctx.fill();
    // 机械爪末端
    ctx.fillStyle = '#2a2a3a';
    rr(ctx, ax - 4, yBase + yReach - 2, 8, 4, 1); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.fillRect(ax - 3, yBase + yReach - 2, 6, 0.7);
  };
  drawArm(px + s * 0.32, 0);
  drawArm(px + s * 0.68, 1.2);

  // ⑥ 中央作业窗（深色凹陷 + 玻璃高光 + 配方图标 + 底部传送带滚动）
  const wcX = px + 12, wcY = py + 38, wcW = s - 24, wcH = sh - 62;
  ctx.fillStyle = tier.inner;
  rr(ctx, wcX, wcY, wcW, wcH, 4); ctx.fill();
  // MK3 镀金镶边
  if (tier.trim) {
    ctx.strokeStyle = tier.trim;
    ctx.lineWidth = 0.8;
    rr(ctx, wcX + 0.5, wcY + 0.5, wcW - 1, wcH - 1, 4); ctx.stroke();
  }
  ctx.save();
  rr(ctx, wcX + 2, wcY + 2, wcW - 4, wcH - 4, 3); ctx.clip();
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(wcX + 2, wcY + 2, wcW - 4, wcH - 4);
  // 运转时辉光（脉冲）
  if (working) {
    const fl = 0.5 + Math.sin((G.time || 0) * 8 + px) * 0.25;
    ctx.fillStyle = 'rgba(160,200,255,' + (fl * 0.18).toFixed(2) + ')';
    ctx.fillRect(wcX + 2, wcY + 2, wcW - 4, wcH - 4);
  }
  // 中央配方图标
  if (portDetailsVisible() && e.recipe) {
    const outId = Object.keys(RECIPES[e.recipe].out)[0];
    drawRecipeIconCell(ctx, cx, wcY + wcH * 0.42, outId);
  }
  // 底部传送带（运转时滚动条纹）
  const beltY = wcY + wcH - 5;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(wcX + 2, beltY, wcW - 4, 3);
  if (working) {
    const beltOff = ((G.time || 0) * (e.type === 'assembling-machine-3' ? 18 : 12)) % 6;
    for (let i = -1; i < wcW / 4 + 1; i++) {
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      ctx.fillRect(wcX + 2 + i * 6 - beltOff, beltY, 3, 3);
    }
  }
  ctx.restore();
  // 窗框亮边
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1;
  rr(ctx, wcX, wcY, wcW, wcH, 4); ctx.stroke();
  // 窗横线
  ctx.strokeStyle = 'rgba(0,0,0,0.4)';
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  ctx.moveTo(wcX + 2, wcY + wcH * 0.55);
  ctx.lineTo(wcX + wcW - 2, wcY + wcH * 0.55);
  ctx.stroke();

  // ⑦ 状态 LED（左右各 1 颗，运转时亮绿；MK3 多 1 颗中心 LED）
  const ledY = py + sh - 17;
  const drawLed = (lx, ly, on) => {
    ctx.fillStyle = on ? tier.ledOn : tier.ledOff;
    ctx.beginPath(); ctx.arc(lx, ly, 1.7, 0, Math.PI * 2); ctx.fill();
    if (on) {
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(lx - 0.4, ly - 0.5, 0.6, 0, Math.PI * 2); ctx.fill();
    }
  };
  drawLed(px + 14,    ledY, working);
  drawLed(px + s - 14, ledY, working);
  if (e.type === 'assembling-machine-3') drawLed(cx, ledY, working);

  // ⑧ 中央档位徽章（顶部小标 I/II/III，MK3 带金边）
  ctx.fillStyle = tier.line;
  rr(ctx, cx - 11, py + 5, 22, 6, 1.5); ctx.fill();
  if (tier.trim) {
    ctx.strokeStyle = tier.trim;
    ctx.lineWidth = 0.8;
    rr(ctx, cx - 11, py + 5, 22, 6, 1.5); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,255,255,0.88)';
  ctx.font = 'bold 7px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tier.label, cx, py + 8.2);

  // ⑨ 角部螺栓（4 角）
  const drawBolt = (bx, by) => {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.beginPath(); ctx.arc(bx, by, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = tier.bolt;
    ctx.beginPath(); ctx.arc(bx, by, 1.8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = tier.boltHi;
    ctx.beginPath(); ctx.arc(bx - 0.4, by - 0.5, 0.8, 0, Math.PI * 2); ctx.fill();
  };
  drawBolt(px + 9,        py + 9);
  drawBolt(px + s - 9,     py + 9);
  drawBolt(px + 9,        py + sh - 9);
  drawBolt(px + s - 9,     py + sh - 9);

  // ⑩ 流体端口：组装机只有 1 个通用流体口，固定在顶部中间（设备本体不随 dir 旋转），
  //    同时承担流体入口/出口（取决于当前配方：含流体原料=入口，含流体产物=出口）。
  //    端口贴设备外缘（dist = s/2），对齐炼油厂等流体设备的背部接口放置方式。
  const fr = e.fluidRecipe ? e.fluidRecipe() : null;
  const pcx = px + s / 2, pcy = py + s / 2;
  const fin = (fr && fr.fin.length) ? fr.fin[0] : null;
  const fout = (fr && fr.fout.length) ? fr.fout[0] : null;
  const fPort = fin || fout;
  drawPort(ctx, pcx, pcy, 3, fPort ? ITEMS[fPort].color : PORT_FLUID, !fin, 0, s / 2, fPort, fin ? 'in' : (fout ? 'out' : 'both'));

  // ⑪ 罐体外框描边（最上层）
  ctx.strokeStyle = tier.line;
  ctx.lineWidth = 2.4;
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 9); ctx.stroke();

  ctx.restore();
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function assemblerPanelHtml(e) {
  let h = row('当前配方', recipeValueHtml(e.recipe));
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
  for (const rid of Object.keys(RECIPES).filter(r => !isChemRecipe(r) && !isCentrifugeRecipe(r) && !isAgricultureTowerRecipe(r) && !isCryoRecipe(r))) {
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
  if (needsPower && powerSatOf(e) <= 0) { api.status('已暂停：缺电', 'bad'); return; }
  if (outputBacklogged(e.outp, rec.out)) { api.status('已暂停：产物堆积（够用 2 次生产）', 'warn'); return; }
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
// 显示详情时，各接口图标所在世界格 + 对应流体名（用于鼠标悬停显示流体名称）
// 组装机只有 1 个通用流体口（固定在顶部中间），流体取 fin[0] 或 fout[0]（二者互斥）。
function assemblerFluidIcons(e) {
  const fr = e.fluidRecipe ? e.fluidRecipe() : null;
  const fin = (fr && fr.fin.length) ? fr.fin[0] : null;
  const fout = (fr && fr.fout.length) ? fr.fout[0] : null;
  const fluid = fin || fout;
  if (!fluid) return [];
  const c = portCenterCell(e, e.x * TILE + TILE * e.w / 2, e.y * TILE + TILE * e.h / 2, 3, 0, TILE * e.w / 2);
  return [{ x: c[0], y: c[1], fluid }];
}
DEVICE_FLUID_ICONS['assembling-machine-1'] = assemblerFluidIcons;
DEVICE_FLUID_ICONS['assembling-machine-2'] = assemblerFluidIcons;

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
