'use strict';

// ===== 研究中心：消耗科学包推进所选科技 =====
class Lab extends Entity {
  constructor(type, x, y) {
    super('lab', x, y);
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
    return 1 + 0.4 * mc.speed - 0.1 * mc.prod - 0.03 * mc.eff;
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
  powerDemand() { return this.active ? POWER_USE['lab'] * (1 + (moduleCounts(this.modules).speed + moduleCounts(this.modules).prod) * 0.25) * Math.max(0.2, 1 - 0.15 * moduleCounts(this.modules).eff) : 0; }
  packCount(id) { return this.packs[id] || 0; }
  totalPacks() { let s = 0; for (const k in this.packs) s += this.packs[k]; return s; }
  // 返回任意一种有库存的科学包（供无限科技“消耗任何包”使用）
  peekAnyPack() {
    for (const k of SCIENCE_PACKS) if (this.packCount(k) > 0) return k;
    return null;
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
      this.t += dt * powerFactor() * labSpeedMult() * this.moduleSpeedMult();
      if (this.t >= LAB_TIME) {
        this.t -= LAB_TIME;
        // 产能模块：达到阈值时本次科研免费（不消耗科学包）
        if (!this.applyProductivity()) this.consumeAnyPack(1);
        G.techProg[tech] = (G.techProg[tech] || 0) + 1;   // 进度无限增长
        uiDirty = true;
      }
      return;
    }
    const list = techNeedList(tech);
    let done = G.techProg[tech] || 0;
    if (done >= list.length) {
      G.techDone[tech] = true;
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
    this.t += dt * powerFactor() * labSpeedMult() * this.moduleSpeedMult();
    if (this.t >= LAB_TIME) {
      this.t -= LAB_TIME;
      // 产能模块：达到阈值时本次科研免费（不消耗科学包）
      if (!this.applyProductivity()) {
        this.packs[need]--;
        if (typeof trackProd === 'function') trackProd(need, -1);
        if (this.packs[need] <= 0) delete this.packs[need];
      }
      done++;
      G.techProg[tech] = done;
      uiDirty = true;
      if (done >= list.length) {
        G.techDone[tech] = true;
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
    if (isModule(item)) {
      if ((this.modules[item] || 0) >= this.moduleSlotCount()) return false;
      this.modules[item] = (this.modules[item] || 0) + 1;
      if (typeof playSfx === 'function') playSfx('module');
      return true;
    }
    if (isScience(item) && this.packCount(item) < 40) { this.packs[item] = this.packCount(item) + 1; return true; }
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
    return s;
  }
  static restore(s) {
    const l = super.restore(s);
    l.packs = typeof s.packs === 'number' ? { 'science-pack': s.packs } : (s.packs || {});
    l.t = s.t || 0;
    l.modules = s.modules || {}; l.prodBuf = s.prodBuf || 0;
    return l;
  }
}

// ===== 渲染 =====
function drawLab(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * 3;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#37807a';
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 7); ctx.fill();
  ctx.strokeStyle = '#1e4a46';
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 7); ctx.stroke();
  ctx.fillStyle = '#245c57';
  rr(ctx, px + 10, py + 10, s - 20, s - 20, 5); ctx.fill();
  ctx.fillStyle = e.active ? '#8ff0e0' : '#4a8f86';
  ctx.beginPath();
  ctx.arc(px + s / 2, py + s / 2, 12, 0, 7);
  ctx.fill();
  if (e.active) {
    const bb = Math.sin(G.time * 8 + px) * 3;
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.beginPath();
    ctx.arc(px + s / 2 - 4, py + s / 2 - 4 + bb, 2.5, 0, 7);
    ctx.arc(px + s / 2 + 5, py + s / 2 - 2 - bb, 2, 0, 7);
    ctx.fill();
  }
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
  const order = ['speed-module', 'speed-module-2', 'speed-module-3', 'productivity-module', 'productivity-module-2', 'productivity-module-3', 'efficiency-module', 'efficiency-module-2', 'efficiency-module-3'];
  for (const mid of order) {
    if (!itemUnlocked(mid)) continue;
    const n = Math.min(invCount(mid), e.moduleSlotCount() - (e.modules[mid] || 0));
    if (n > 0) h += '<button data-action="labmod" data-id="' + mid + '">装入' + ITEMS[mid].name + ' ×' + n + '</button>';
  }
  if (Object.keys(e.modules).length > 0) h += '<button data-action="modtake">取出全部模块</button>';
  h += '</div>';
  h += barHtml(0);
  h += '<div class="status"></div>';
  h += row('课题', '', 'techline');
  // 消耗速率：每 LAB_TIME 秒消耗 1 瓶科学包（按所选科技配方逐瓶消耗）
  h += machRateHtml({ inp: { 'science-pack': 1 }, out: {}, time: LAB_TIME }, 1);
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
    const pk = btn.dataset.id || 'science-pack';
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
