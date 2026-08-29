'use strict';

// ===== 研究中心：消耗科学包推进所选科技 =====
// 研究完成时按官方机制自动授予物品（对齐《异星工厂》spawnable shortcut 物品：遥控器）
function grantTechUnlockItems(tech) {
  if (!tech) return;
  const grant = { 'military4': 'artillery-targeting-remote', 'armor-power': 'discharge-defense-remote' };
  const item = grant[tech];
  if (item && typeof invAdd === 'function' && typeof toast === 'function') {
    invAdd(item, 1);
    toast('🔧 已获得：' + (ITEMS[item] ? ITEMS[item].name : item) + '（研究 ' + (TECHS[tech] ? TECHS[tech].name : tech) + ' 后自动授予）');
  }
}

class Lab extends Entity {
  constructor(type, x, y) {
    super(type || 'lab', x, y);   // biolab（生物实验室，Gleba）：官方 researching_speed=2、module_slots=4，数据经 GAME_DATA 桥接
    this.packs = {};
    this.t = 0;
    this.active = false;
    this.modules = {};   // 研究中心可装模块（对齐《异星工厂》：产能/速度/效率模块）；产能模块让部分科研免费（减少科学包消耗）
    this.prodBuf = 0;    // 产能模块累积进度
  }
  // 模块槽位数（对齐《异星工厂》官方 module_slots：研究中心 2 槽）
  moduleSlotCount() { return GAME_DATA.deviceStats?.[this.type]?.moduleSlots ?? 2; }
  // 模块速度倍率（对齐组装机：速度 +0.4/当量、产能 -0.1/当量、效率 -0.03/当量）
  moduleSpeedMult() {
    const mc = moduleCounts(this.modules);
    return 1 + 0.4 * mc.speed - 0.1 * mc.prod - 0.03 * mc.eff - mc.qualityPenalty;
  }
  // 每完成一次科研结算产能模块：返回是否“免费科研”（本次不消耗科学包）
  applyProductivity() {
    const mc = moduleCounts(this.modules);
    if (mc.prod > 0) {
      const thr = moduleProdThreshold(this.modules);
      this.prodBuf = (this.prodBuf || 0) + mc.prod;
      if (this.prodBuf >= thr) { this.prodBuf -= thr; return true; }
    }
    return false;
  }
  powerDemand() { return this.active ? (POWER_USE[this.type] || POWER_USE['lab']) * (1 + (moduleCounts(this.modules).speed + moduleCounts(this.modules).prod) * 0.25) * Math.max(0.2, 1 - 0.15 * moduleCounts(this.modules).eff) : 0; }
  // 设备自身科研速度倍率（官方 researching_speed：研究中心=1、生物实验室 biolab=2）
  researchSpeedMult() { return GAME_DATA.deviceStats?.[this.type]?.researchingSpeed ?? 1; }
  packCount(id) { return this.packs[id] || 0; }
  totalPacks() { let s = 0; for (const k in this.packs) s += this.packs[k]; return s; }
  // 返回任意一种有库存的科学包（供无限科技“消耗任何包”使用）
  peekAnyPack() {
    for (const k of SCIENCE_PACKS) if (this.packCount(k) > 0) return k;
    return null;
  }
  // 数据单源化：高品质实验室按官方 science_pack_drain_multiplier 消耗更少科研包。
  // 官方 multiplier：uncommon 0.99 / rare 0.98 / epic 0.97 / legendary 0.95（normal 1）。
  // 科研包按整消耗，这里用累积消耗量（_drainAcc）把“少耗”累积成整数后统一扣除，
  // 保证长期平均消耗与官方 multiplier 一致（如 legendary 平均每 1/0.95≈1.053 周期耗 1）。
  drainMult() {
    return (typeof qualityScienceDrainMult === 'function') ? qualityScienceDrainMult(this.quality) : 1;
  }
  // 从指定科研包扣除一次科研消耗（受品质消耗倍率影响）
  consumePackDrain(need) {
    const mult = this.drainMult();
    if (mult >= 1) {   // normal / 未实现品质：按原 1 个消耗
      if (mult > 1) {
        this._drainAcc = ((this._drainAcc || 0) + (mult - 1));
        const extra = Math.floor(this._drainAcc);
        if (extra > 0) { this._drainAcc -= extra; }
      }
      this.packs[need] = (this.packs[need] || 0) - 1;
      if (typeof trackProd === 'function') trackProd(need, -1);
      if (this.packs[need] <= 0) delete this.packs[need];
      return;
    }
    // 高品质：按倍率累积消耗（每次科研累积 mult 的消耗量，攒够 1 才实际扣 1）
    this._drainAcc = (this._drainAcc || 0) + mult;
    if (this._drainAcc < 1) return;           // 尚未攒够，本次科研免扣（官方少耗）
    this._drainAcc -= 1;
    this.packs[need] = (this.packs[need] || 0) - 1;
    if (typeof trackProd === 'function') trackProd(need, -1);
    if (this.packs[need] <= 0) delete this.packs[need];
  }
  // 从任意一种有库存的科学包中消耗 n 个（不限种类）
  consumeAnyPack(n) {
    for (const k of SCIENCE_PACKS) {
      const c = this.packCount(k);
      if (c <= 0) continue;
      const take = Math.min(n, c);
      this.packs[k] -= take;
      if (typeof trackProd === 'function') trackProd(k, -take);
      if (this.packs[k] <= 0) delete this.packs[k];
      n -= take;
      if (n <= 0) break;
    }
  }
  nextNeed() {
    const tech = G.activeTech;
    if (!tech || (G.techDone[tech] && !isInfiniteTech(tech))) return null;
    if (isInfiniteTech(tech)) return this.peekAnyPack();
    const list = techNeedList(tech);
    const done = G.techProg[tech] || 0;
    return done < list.length ? list[done] : null;
  }
  update(dt) {
    this.active = false;
    const tech = G.activeTech;
    if (G.power.sat <= 0) { this.t = 0; return; }
    if (!tech || (G.techDone[tech] && !isInfiniteTech(tech))) { this.t = 0; return; }
    // 前置科技未满足时暂停研究（旧档可能残留不合法的 activeTech）
    if (techLocked(tech)) { this.t = 0; return; }
    // 无限科技：永不完成，持续消耗任意存在的科学包
    if (isInfiniteTech(tech)) {
      const any = this.peekAnyPack();
      if (!any) { this.t = 0; return; }   // 没有任何科学包则暂停
      this.active = true;
      this.t += dt * powerFactor() * labSpeedMult() * this.moduleSpeedMult() * this.researchSpeedMult() * (this.quality ? qualityMult(this.quality) : 1);
      if (this.t >= LAB_TIME) {
        this.t -= LAB_TIME;
        // 产能模块：达到阈值时本次科研免费（不消耗科学包）
        if (!this.applyProductivity()) this.consumePackDrain(this.peekAnyPack());
        G.techProg[tech] = (G.techProg[tech] || 0) + 1;   // 进度无限增长
        // 健康无限科技：每级提升主角最大生命值 +50（对齐官方 Health 科技），即时刷新最大生命值
        if (tech === 'health' && typeof playerMaxHp === 'function' && typeof G.playerHPmax === 'number') {
          G.playerHPmax = playerMaxHp();
          if (typeof G.playerHP === 'number' && G.playerHP > G.playerHPmax) G.playerHP = G.playerHPmax;
        }
        uiDirty = true;
      }
      return;
    }
    const list = techNeedList(tech);
    let done = G.techProg[tech] || 0;
    if (done >= list.length) {
      G.techDone[tech] = true;
      grantTechUnlockItems(tech);
      toast('研究完成：' + TECHS[tech].name);
      if (typeof playSfx === 'function') playSfx('research');
      // 成就：研究完成计数（对齐《异星工厂》科研成就）
      if (typeof achEnsureStats === 'function') { achEnsureStats(); G.achStats.researched++; checkAchievements(); }
      // 顺延到研究队列下一项（若队列还有则继续）
      if (typeof advanceTechQueue === 'function') advanceTechQueue();
      else G.activeTech = null;
      if (typeof renderPanel === 'function') renderPanel(false);
      return;
    }
    const need = list[done];
    if (!need || this.packCount(need) <= 0) { this.t = 0; return; }
    this.active = true;
    this.t += dt * powerFactor() * labSpeedMult() * this.moduleSpeedMult() * this.researchSpeedMult() * (this.quality ? qualityMult(this.quality) : 1);
    if (this.t >= LAB_TIME) {
      this.t -= LAB_TIME;
      // 产能模块：达到阈值时本次科研免费（不消耗科学包）
      if (!this.applyProductivity()) this.consumePackDrain(need);
      done++;
      G.techProg[tech] = done;
      uiDirty = true;
      if (done >= list.length) {
        G.techDone[tech] = true;
        grantTechUnlockItems(tech);
        toast('研究完成：' + TECHS[tech].name);
        if (typeof playSfx === 'function') playSfx('research');
        // 成就：研究完成计数（对齐《异星工厂》科研成就）
        if (typeof achEnsureStats === 'function') { achEnsureStats(); G.achStats.researched++; checkAchievements(); }
        // 顺延到研究队列下一项（若队列还有则继续）
        if (typeof advanceTechQueue === 'function') advanceTechQueue();
        else G.activeTech = null;
        if (typeof renderPanel === 'function') renderPanel(false);
      }
    }
  }
  giveItem(item) {
    // 科研包优先进入研究中心（科研包作为配方输入时走此路，而非插件/物品槽）
    if (isScience(item) && this.packCount(item) < 40) { this.packs[item] = this.packCount(item) + 1; return true; }
    if (isModule(item)) {
      if ((this.modules[item] || 0) >= this.moduleSlotCount()) return false;
      this.modules[item] = (this.modules[item] || 0) + 1;
      if (typeof playSfx === 'function') playSfx('module');
      return true;
    }
    return false;
  }
  peekItem() {
    for (const k of SCIENCE_PACKS) if (this.packCount(k) > 0) return k;
    return null;
  }
  takeItem() {
    for (const k of SCIENCE_PACKS) if (this.packCount(k) > 0) return this.takeItemOf(k);
    return null;
  }
  countOf(item) { return this.packCount(item); }
  takeItemOf(item) {
    if (this.packCount(item) > 0) {
      this.packs[item]--;
      if (this.packs[item] <= 0) delete this.packs[item];
      return item;
    }
    return null;
  }
  contents() {
    const list = [[this.type, 1]];
    for (const k in this.packs) if (this.packs[k] > 0) list.push([k, this.packs[k]]);
    for (const k in this.modules) if (this.modules[k] > 0) list.push([k, this.modules[k]]);
    return list;
  }
  // 面板"取出全部"：退回所有科学包与模块
  takeAll() {
    const rows = [];
    for (const k of Object.keys(this.packs)) { rows.push([k, this.packs[k]]); delete this.packs[k]; }
    for (const k of Object.keys(this.modules)) if (this.modules[k] > 0) { rows.push([k, this.modules[k]]); delete this.modules[k]; }
    this.prodBuf = 0;
    return rows;
  }
  serialize() {
    const s = super.serialize();
    s.packs = this.packs; s.t = this.t;
    s.modules = this.modules || {}; s.prodBuf = this.prodBuf || 0;
    s.drainAcc = this._drainAcc || 0;
    return s;
  }
  static restore(s) {
    const l = super.restore(s);
    l.packs = typeof s.packs === 'number' ? { 'automation-science-pack': s.packs } : (s.packs || {});
    l.t = s.t || 0;
    l.modules = s.modules || {}; l.prodBuf = s.prodBuf || 0;
    l._drainAcc = s.drainAcc || 0;
    return l;
  }
}

// ===== 渲染 =====
// 轻量色彩工具（研究中心渲染用）：#rrggbb → rgba(r,g,b,a)
function _labMix(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + t.toFixed(3) + ')';
}
// 研究中心渲染：洁净实验室风格（白色陶瓷外壳 + 中央原子研究舱 + 双侧科学包补给柱 + 顶部穹顶天线）
// 在一众深色工业设备中，研究中心以“白色洁净设备”身份凸显科技感；主题青色保留旧版识别度。
// 视觉分区（自下而上）：
//   ① 地面阴影 + 深色基座踢脚板（带运行状态灯：绿=研究中/琥珀=有包待机/红=无包）
//   ② 白色陶瓷主外壳（顶亮底暗渐变 + 左右内阴影 + 顶部板缝）
//   ③ 双侧科学包补给柱（各 3 舱位，按真实库存点亮包色；当前消耗的舱位脉冲高亮，顶部汇入管接研究舱）
//   ④ 中央研究舱（钢环螺栓 + 暗腔 + 3 条原子轨道[运转时电子公转] + 能量核心）
//   ⑤ 研究进度环（e.t/LAB_TIME 亮弧，颜色随当前消耗的科学包）
//   ⑥ 顶部玻璃穹顶（内透核心色辉光）+ 角部天线（随 dir 旋转，红色航标灯闪烁）
//   ⑦ 角部螺栓 + 外框描边
// 核心颜色语义 = 当前正在消耗的科学包颜色（无限科技取任意现存包；待机为青色）。
// ALT 详情模式下，核心改显当前消耗科学包的图标。支持 lab（3×3）与 biolab（5×5）等比缩放。
function drawLab(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w;                       // 支持 lab（3×3）与 biolab（5×5，生物实验室）
  const k = s / 96;                           // 以 96px（3×3）为基准的缩放系数
  const cx = px + s / 2, cy = py + s / 2;
  ctx.globalAlpha = alpha;

  const T = G.time || 0;
  const working = !!e.active;
  // 当前正在消耗的科学包（核心/穹顶/进度环用它上色；无限科技取任意现存包）
  let need = (typeof e.nextNeed === 'function') ? e.nextNeed() : null;
  if (need && (!(ITEMS[need] && ITEMS[need].color) || e.packCount(need) <= 0)) need = null;
  const coreColor = need ? ITEMS[need].color : '#37d6c2';
  const totalPacks = (typeof e.totalPacks === 'function') ? e.totalPacks() : 0;
  const ledColor = working ? '#7af05a' : (totalPacks > 0 ? '#f0c04a' : '#f05a4a');
  const prog = Math.max(0, Math.min(1, (e.t || 0) / LAB_TIME));
  const simple = (typeof LOD !== 'undefined' && LOD && LOD.simple);

  // ===== 低 LOD（缩远）：白色剪影 + 暗腔 + 彩色核心 =====
  if (simple) {
    ctx.fillStyle = '#c5d2d9';
    rr(ctx, px + 3 * k, py + 3 * k, s - 6 * k, s - 6 * k, 10 * k); ctx.fill();
    ctx.fillStyle = '#12242b';
    ctx.beginPath(); ctx.arc(cx, cy, 16 * k, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = _labMix(coreColor, working ? 0.95 : 0.55);
    ctx.beginPath(); ctx.arc(cx, cy, 5 * k, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;
    return;
  }

  // ===== ① 地面阴影 =====
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath();
  ctx.ellipse(cx, py + s - 2 * k, s * 0.42, 4.5 * k, 0, 0, Math.PI * 2);
  ctx.fill();

  // ===== ② 白色陶瓷主外壳（顶亮底暗渐变 + 左右内阴影 + 顶部板缝）=====
  const bodyGrad = ctx.createLinearGradient(0, py + 3 * k, 0, py + s - 3 * k);
  bodyGrad.addColorStop(0,    '#f2f6f8');
  bodyGrad.addColorStop(0.45, '#dde6ec');
  bodyGrad.addColorStop(1,    '#b7c6cf');
  ctx.fillStyle = bodyGrad;
  rr(ctx, px + 3 * k, py + 3 * k, s - 6 * k, s - 6 * k, 10 * k); ctx.fill();
  // 左右内阴影（圆润设备质感）
  const sideShade = ctx.createLinearGradient(px, 0, px + s, 0);
  sideShade.addColorStop(0,    'rgba(60,84,96,0.20)');
  sideShade.addColorStop(0.12, 'rgba(60,84,96,0)');
  sideShade.addColorStop(0.88, 'rgba(60,84,96,0)');
  sideShade.addColorStop(1,    'rgba(60,84,96,0.22)');
  ctx.fillStyle = sideShade;
  rr(ctx, px + 3 * k, py + 3 * k, s - 6 * k, s - 6 * k, 10 * k); ctx.fill();
  // 顶部板缝（穹顶下方的水平拼缝，暗线 + 亮线成对）
  ctx.strokeStyle = 'rgba(70,96,108,0.35)';
  ctx.lineWidth = 1 * k;
  ctx.beginPath();
  ctx.moveTo(px + 10 * k, py + 21 * k);
  ctx.lineTo(px + s - 10 * k, py + 21 * k);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.7)';
  ctx.lineWidth = 0.6 * k;
  ctx.beginPath();
  ctx.moveTo(px + 10 * k, py + 22.2 * k);
  ctx.lineTo(px + s - 10 * k, py + 22.2 * k);
  ctx.stroke();

  // ===== ①b 深色基座踢脚板（外壳底部的深色横带，运行状态灯装在其上）=====
  ctx.fillStyle = '#22333c';
  rr(ctx, px + 5 * k, py + s - 12 * k, s - 10 * k, 8 * k, 3 * k); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.fillRect(px + 9 * k, py + s - 11 * k, s - 18 * k, 0.8 * k);

  // ===== ⑤a 研究进度环轨道（外壳上的环形细槽，先画让补给管从上方跨过）=====
  const R = 20 * k;                            // 研究舱半径
  ctx.strokeStyle = 'rgba(50,76,88,0.30)';
  ctx.lineWidth = 2.6 * k;
  ctx.beginPath(); ctx.arc(cx, cy, R + 3.4 * k, 0, Math.PI * 2); ctx.stroke();

  // ===== ③ 双侧科学包补给柱（各 3 舱位，按库存量前 6 的包类型点亮）=====
  const packIds = Object.keys(e.packs || {})
    .filter(id => (e.packs[id] || 0) > 0 && ITEMS[id] && ITEMS[id].color)
    .sort((a, b) => e.packs[b] - e.packs[a])
    .slice(0, 6);
  const colX = [px + 10.5 * k, px + s - 19.5 * k];   // 左右柱左上角 x（柱宽 9k）
  const colY = py + 30 * k, cellH = 11 * k;
  for (let c = 0; c < 2; c++) {
    const x = colX[c];
    // 柱框架（暗色内嵌槽）
    ctx.fillStyle = '#16303a';
    rr(ctx, x, colY, 9 * k, 36 * k, 2.5 * k); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.45)';
    ctx.lineWidth = 0.8 * k;
    rr(ctx, x, colY, 9 * k, 36 * k, 2.5 * k); ctx.stroke();
    // 汇入管（柱中部 → 研究舱钢环外缘）
    const pipeFrom = c === 0 ? x + 9 * k : x;
    const pipeTo = c === 0 ? cx - R : cx + R;
    ctx.fillStyle = '#31454f';
    rr(ctx, Math.min(pipeFrom, pipeTo), cy - 1.3 * k, Math.abs(pipeTo - pipeFrom), 2.6 * k, 1.2 * k); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(Math.min(pipeFrom, pipeTo), cy - 1 * k, Math.abs(pipeTo - pipeFrom), 0.7 * k);
    // 3 个舱位（自上而下；当前消耗的包脉冲高亮）
    for (let i = 0; i < 3; i++) {
      const pid = packIds[c * 3 + i] || null;
      const cxl = x + 1 * k, cyl = colY + 1 * k + i * (cellH + 1 * k);
      if (pid) {
        const isCur = (pid === need);
        const pulse = isCur ? 0.75 + 0.25 * Math.sin(T * 6) : 1;
        ctx.fillStyle = _labMix(ITEMS[pid].color, 0.92 * pulse);
        rr(ctx, cxl, cyl, 7 * k, cellH, 1.5 * k); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(cxl + 1 * k, cyl + 1 * k, 5 * k, 1 * k);
        if (isCur) {   // 当前消耗舱位：外圈辉光
          ctx.strokeStyle = _labMix(ITEMS[pid].color, 0.6);
          ctx.lineWidth = 1.1 * k;
          rr(ctx, cxl - 0.6 * k, cyl - 0.6 * k, 8.2 * k, cellH + 1.2 * k, 2 * k); ctx.stroke();
        }
      } else {
        ctx.fillStyle = '#0d1e26';
        rr(ctx, cxl, cyl, 7 * k, cellH, 1.5 * k); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.06)';
        ctx.fillRect(cxl + 1 * k, cyl + 1 * k, 5 * k, 0.8 * k);
      }
    }
  }

  // ===== ④ 中央研究舱：钢环 + 暗腔 + 原子轨道 + 能量核心 =====
  // 钢环（外缘暗描边 + 钢面）
  ctx.fillStyle = '#5c707c';
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#2c4048';
  ctx.lineWidth = 1.6 * k;
  ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2); ctx.stroke();
  // 暗腔（凹陷内室，径向渐变）
  const chamberGrad = ctx.createRadialGradient(cx, cy - 4 * k, 2 * k, cx, cy, R - 3 * k);
  chamberGrad.addColorStop(0, '#17303a');
  chamberGrad.addColorStop(1, '#081218');
  ctx.fillStyle = chamberGrad;
  ctx.beginPath(); ctx.arc(cx, cy, R - 3.2 * k, 0, Math.PI * 2); ctx.fill();
  // 钢环小螺栓（4 颗，45° 方位）
  for (let i = 0; i < 4; i++) {
    const ba = Math.PI / 4 + i * Math.PI / 2;
    const bx = cx + Math.cos(ba) * (R - 1.6 * k), by = cy + Math.sin(ba) * (R - 1.6 * k);
    ctx.fillStyle = '#2c4048';
    ctx.beginPath(); ctx.arc(bx, by, 1.3 * k, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.beginPath(); ctx.arc(bx - 0.3 * k, by - 0.3 * k, 0.5 * k, 0, Math.PI * 2); ctx.fill();
  }
  // 内室内容（裁剪进暗腔）：背景辉光 → 原子轨道 → 电子 → 能量核心
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, R - 3.4 * k, 0, Math.PI * 2); ctx.clip();
  const glowA = working ? 0.32 + 0.14 * Math.sin(T * 5) : 0.10;
  const glow = ctx.createRadialGradient(cx, cy, 1 * k, cx, cy, R - 4 * k);
  glow.addColorStop(0, _labMix(coreColor, glowA));
  glow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(cx - R, cy - R, 2 * R, 2 * R);
  // 原子轨道（3 条椭圆整体缓慢旋转；运转时电子沿轨道公转）
  const orbR = R - 6.5 * k;
  const spin = T * 0.35;
  for (let i = 0; i < 3; i++) {
    const baseA = i * Math.PI / 3 + spin;
    ctx.strokeStyle = _labMix(coreColor, working ? 0.55 : 0.30);
    ctx.lineWidth = 1.1 * k;
    ctx.beginPath();
    ctx.ellipse(cx, cy, orbR, orbR * 0.38, baseA, 0, Math.PI * 2);
    ctx.stroke();
    const ea = T * 2.4 + i * 2.1;
    const ex = cx + Math.cos(ea) * Math.cos(baseA) * orbR - Math.sin(ea) * Math.sin(baseA) * orbR * 0.38;
    const ey = cy + Math.cos(ea) * Math.sin(baseA) * orbR + Math.sin(ea) * Math.cos(baseA) * orbR * 0.38;
    ctx.fillStyle = working ? '#ffffff' : _labMix(coreColor, 0.7);
    ctx.beginPath(); ctx.arc(ex, ey, 1.5 * k, 0, Math.PI * 2); ctx.fill();
  }
  // 能量核心（ALT 详情时改显当前消耗包的图标）
  if (portDetailsVisible() && need) {
    drawRecipeIconCell(ctx, cx, cy, need);
  } else {
    const coreR = 6.5 * k;
    const coreGrad = ctx.createRadialGradient(cx - 1.5 * k, cy - 1.5 * k, 0.5 * k, cx, cy, coreR);
    coreGrad.addColorStop(0,    '#ffffff');
    coreGrad.addColorStop(0.35, _labMix(coreColor, 0.95));
    coreGrad.addColorStop(1,    _labMix(coreColor, 0.25));
    ctx.fillStyle = coreGrad;
    ctx.beginPath(); ctx.arc(cx, cy, coreR, 0, Math.PI * 2); ctx.fill();
    if (working) {   // 核心呼吸微光
      ctx.fillStyle = _labMix(coreColor, 0.22 + 0.13 * Math.sin(T * 5));
      ctx.beginPath(); ctx.arc(cx, cy, coreR + 2.2 * k + Math.sin(T * 5) * 0.8 * k, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
  // 舱内玻璃反光（左上弧）
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 1.2 * k;
  ctx.beginPath();
  ctx.arc(cx, cy, R - 5 * k, Math.PI * 1.05, Math.PI * 1.45);
  ctx.stroke();

  // ===== ⑤ 研究进度环（亮弧随 e.t/LAB_TIME 增长；满一圈 = 消耗一瓶科学包）=====
  if (prog > 0.005) {
    ctx.strokeStyle = _labMix(coreColor, 0.95);
    ctx.lineWidth = 2.6 * k;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, R + 3.4 * k, -Math.PI / 2, -Math.PI / 2 + prog * Math.PI * 2);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  // ===== ⑥ 顶部玻璃穹顶（基座 + 玻璃 + 内透核心色辉光 + 高光）=====
  const domeY = py + 8 * k;
  ctx.fillStyle = '#5c707c';
  rr(ctx, cx - 13 * k, domeY + 2.5 * k, 26 * k, 3.2 * k, 1.5 * k); ctx.fill();
  ctx.strokeStyle = '#2c4048';
  ctx.lineWidth = 0.8 * k;
  rr(ctx, cx - 13 * k, domeY + 2.5 * k, 26 * k, 3.2 * k, 1.5 * k); ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(cx, domeY, 11 * k, 5.2 * k, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(190,225,235,0.30)';
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.ellipse(cx, domeY, 11 * k, 5.2 * k, 0, 0, Math.PI * 2);
  ctx.clip();
  const domeGlow = ctx.createRadialGradient(cx, domeY + 1 * k, 0.5 * k, cx, domeY, 11 * k);
  domeGlow.addColorStop(0, _labMix(coreColor, working ? 0.5 : 0.18));
  domeGlow.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = domeGlow;
  ctx.fillRect(cx - 12 * k, domeY - 6 * k, 24 * k, 12 * k);
  ctx.restore();
  ctx.strokeStyle = '#33505c';
  ctx.lineWidth = 1.1 * k;
  ctx.beginPath();
  ctx.ellipse(cx, domeY, 11 * k, 5.2 * k, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.55)';
  ctx.lineWidth = 1 * k;
  ctx.beginPath();
  ctx.ellipse(cx, domeY, 9 * k, 3.8 * k, 0, Math.PI * 1.05, Math.PI * 1.5);
  ctx.stroke();

  // ===== ⑥b 角部天线（随 dir 旋转到对应角；红色航标灯闪烁）=====
  const aAng = -Math.PI / 4 + ((dir | 0) % 4) * (Math.PI / 2);
  const ax = cx + Math.cos(aAng) * s * 0.355;
  const ay = cy + Math.sin(aAng) * s * 0.355;
  ctx.fillStyle = '#5c707c';
  rr(ctx, ax - 3 * k, ay + 1 * k, 6 * k, 3 * k, 1 * k); ctx.fill();
  ctx.strokeStyle = '#2c4048';
  ctx.lineWidth = 0.7 * k;
  rr(ctx, ax - 3 * k, ay + 1 * k, 6 * k, 3 * k, 1 * k); ctx.stroke();
  ctx.strokeStyle = '#3c4e58';
  ctx.lineWidth = 1.4 * k;
  ctx.beginPath();
  ctx.moveTo(ax, ay + 1 * k);
  ctx.lineTo(ax, ay - 7 * k);
  ctx.stroke();
  const blink = 0.35 + 0.65 * Math.max(0, Math.sin(T * 4 + px));
  if (blink > 0.5) {
    ctx.fillStyle = 'rgba(255,120,90,' + (blink * 0.3).toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(ax, ay - 8.2 * k, 3.4 * k, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = 'rgba(240,80,60,' + blink.toFixed(2) + ')';
  ctx.beginPath(); ctx.arc(ax, ay - 8.2 * k, 1.7 * k, 0, Math.PI * 2); ctx.fill();

  // ===== ⑦ 基座运行状态灯（绿=研究中 / 琥珀=有包待机 / 红=无科学包）=====
  const ledY = py + s - 7 * k;
  for (const lx of [cx - 12 * k, cx + 12 * k]) {
    ctx.fillStyle = ledColor;
    ctx.beginPath(); ctx.arc(lx, ledY, 1.6 * k, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.arc(lx - 0.4 * k, ledY - 0.5 * k, 0.55 * k, 0, Math.PI * 2); ctx.fill();
  }

  // ===== ⑦b 角部螺栓（4 角）=====
  const drawBolt = (bx, by) => {
    ctx.fillStyle = 'rgba(40,60,70,0.5)';
    ctx.beginPath(); ctx.arc(bx, by, 2.3 * k, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#43545e';
    ctx.beginPath(); ctx.arc(bx, by, 1.7 * k, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(bx - 0.4 * k, by - 0.5 * k, 0.7 * k, 0, Math.PI * 2); ctx.fill();
  };
  drawBolt(px + 9 * k,        py + 9 * k);
  drawBolt(px + s - 9 * k,    py + 9 * k);
  drawBolt(px + 9 * k,        py + s - 9 * k);
  drawBolt(px + s - 9 * k,    py + s - 9 * k);

  // ===== ⑧ 外框描边 =====
  ctx.strokeStyle = '#33505c';
  ctx.lineWidth = 2.2 * k;
  rr(ctx, px + 3 * k, py + 3 * k, s - 6 * k, s - 6 * k, 10 * k); ctx.stroke();

  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function labPanelHtml(e) {
  let h = row('科学包', '', 'packs');
  for (const pk of SCIENCE_PACKS) {
    const n = invCount(pk);
    if (n > 0) h += '<button data-action="labfill" data-id="' + pk + '">放入 10 ' + ITEMS[pk].name + ' (' + n + ')</button>';
  }
  h += '<button data-action="takeout" id="btn-lab-takeout" style="display:none"></button>';
  // 模块槽（对齐组装机面板）：可装产能/速度/效率模块，产能模块让部分科研免费
  h += '<div class="dim" style="margin-top:4px">模块（产能/速度/效率）：</div>';
  h += '<div class="modrow">';
  const order = ['speed-module', 'speed-module-2', 'speed-module-3', 'productivity-module', 'productivity-module-2', 'productivity-module-3', 'efficiency-module', 'efficiency-module-2', 'efficiency-module-3', 'quality-module', 'quality-module-2', 'quality-module-3'];
  for (const mid of order) {
    if (!itemUnlocked(mid)) continue;
    const n = Math.min(invCount(mid), e.moduleSlotCount() - (e.modules[mid] || 0));
    if (n > 0) h += '<button data-action="labmod" data-id="' + mid + '">装入' + ITEMS[mid].name + ' ×' + n + '</button>';
  }
  if (Object.keys(e.modules).length > 0) h += '<button data-action="modtake">取出全部模块</button>';
  h += '</div>';
  h += row('课题', '', 'techline');
  // 消耗速率：每 LAB_TIME 秒消耗 1 瓶科学包（按所选科技配方逐瓶消耗）
  h += machRateHtml({ inp: { 'automation-science-pack': 1 }, out: {}, time: LAB_TIME }, 1);
  h += '<div class="dim">研究中心按所选科技的配方顺序逐瓶消耗科学包；缺哪种包会暂停并提示。机械臂可自动喂包。产能模块可让部分科研免费（对齐《异星工厂》）。</div>';
  return h;
}
function labPanelLive(e, api) {
  const parts = [];
  let total = 0;
  for (const pk of SCIENCE_PACKS) if (e.packCount(pk) > 0) { parts.push(chip(pk, e.packCount(pk))); total += e.packCount(pk); }
  api.set('packs', parts.length ? parts.join('') : dimSpan('无'));
  api.toggle('#btn-lab-takeout', total > 0, '取回科学包 (' + total + ')');
  const tech = G.activeTech;
  if (tech && !G.techDone[tech]) {
    const need = e.nextNeed();
    const doneN = G.techProg[tech] || 0;
    if (isInfiniteTech(tech)) {
      // 无限科技：无上限进度，消耗任意存在的科学包
      api.set('techline', TECHS[tech].name + '（已消耗 ' + doneN + ' 瓶，无限）');
      api.prog(100);
      if (e.totalPacks() > 0) api.status('研究中：消耗任意科学包 ' + TECHS[tech].name, 'ok');
      else api.status('已暂停：缺少科学包（放入任意科学包即可）', 'warn');
    } else {
      api.set('techline', TECHS[tech].name + '（' + doneN + '/' + techCostTotal(tech) + '，下一瓶：' +
        (need ? ITEMS[need].name : '—') + '）');
      api.prog(doneN / techCostTotal(tech) * 100, techCostTotal(tech) * LAB_TIME);
      // 状态：研究中或暂停原因
      if (need && e.packCount(need) <= 0) api.status('已暂停：缺少科学包「' + ITEMS[need].name + '」', 'warn');
      else if (!need) api.status('已暂停：待按配方顺序放入科学包', 'warn');
      else api.status('研究中：' + TECHS[tech].name, 'ok');
    }
  } else {
    api.set('techline', dimSpan('未选择（T 打开研究面板）'));
    if (G.activeTech && G.techDone[G.activeTech]) api.status('已完成：' + TECHS[G.activeTech].name, 'ok');
    else api.status('已暂停：未选择研究课题（按 T 打开）', 'warn');
  }
}
function labTip(e) {
  let total = 0;
  for (const k in e.packs) total += e.packs[k];
  return total > 0 ? ('科学包 ×' + total + (G.activeTech ? '，研究 ' + TECHS[G.activeTech].name : '')) : '无科学包';
}
function labOnAction(act, btn) {
  if (act === 'labfill') {
    const pk = btn.dataset.id || 'automation-science-pack';
    const n = Math.min(10, invCount(pk));
    if (n <= 0) { toast('没有科学包'); return true; }
    invTake(pk, n);
    G.panelEnt.packs[pk] = (G.panelEnt.packs[pk] || 0) + n;
    return true;
  }
  if (act === 'labmod') {
    const mid = btn.dataset.id;
    if (!mid || !G.panelEnt || (G.panelEnt.modules[mid] || 0) >= G.panelEnt.moduleSlotCount()) return true;
    if (invCount(mid) < 1) { toast('没有' + ITEMS[mid].name); return true; }
    invTake(mid, 1);
    G.panelEnt.modules[mid] = (G.panelEnt.modules[mid] || 0) + 1;
    if (typeof playSfx === 'function') playSfx('module');
    return true;
  }
  if (act === 'modtake') {
    const e = G.panelEnt; if (!e) return true;
    for (const k of Object.keys(e.modules)) if (e.modules[k] > 0) { invAdd(k, e.modules[k]); delete e.modules[k]; }
    e.prodBuf = 0;
    if (typeof playSfx === 'function') playSfx('craft');
    return true;
  }
  return false;
}

// ===== 注册 =====
ENT_CLASSES['lab'] = Lab;
DEVICE_RENDER['lab'] = drawLab;
DEVICE_DIR_ROTATE['lab'] = true; // 支持旋转
DEVICE_STATUS['lab'] = e => {
  if (!G.activeTech || G.techDone[G.activeTech]) return e.totalPacks() > 0 ? 'y' : 'r';
  return e.totalPacks() > 0 ? (e.packCount(e.nextNeed()) > 0 ? 'g' : 'y') : 'r';
};
DEVICE_PANEL['lab'] = { html: labPanelHtml, live: labPanelLive, tip: labTip, onAction: labOnAction };

// ===== 生物实验室（biolab，Gleba）注册：复用 Lab 类，仅科研速度 2 倍、模块槽 4、占地 5×5 =====
ENT_CLASSES['biolab'] = Lab;
DEVICE_RENDER['biolab'] = drawLab;
DEVICE_DIR_ROTATE['biolab'] = true;
DEVICE_STATUS['biolab'] = DEVICE_STATUS['lab'];
DEVICE_PANEL['biolab'] = { html: labPanelHtml, live: labPanelLive, tip: labTip, onAction: labOnAction };
