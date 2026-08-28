'use strict';

// ===== 回收机：太空时代回收建筑（对齐《异星工厂》Space Age Recycler）=====
// 数据（占地/血量/功耗/制造速度/模块槽）全部来自 GAME_DATA（由 factorio-data 生成）。
// 回收机制：把任意可回收物品还原成其配方原料的 25%（每项至少 1 个），
// 对齐《异星工厂》回收机默认 recycle_ratio=0.25 规则，用于处理生产过剩与劣质品。
class Recycler extends Entity {
  constructor(type, x, y) {
    super(type || 'recycler', x, y);
    this.recycleItem = null;   // 当前待回收的物品（null=空闲）
    this.outp = {};            // 回收产物缓存（可被机械臂/玩家取出）
    this.prog = 0;             // 回收进度
    this.crafting = false;
    this.modules = {};
    this.prodBuf = 0;
    this.prodTechBuf = 0;
  }
  // 官方回收耗时：回收一批耗时 = 2s / crafting_speed（官方 crafting_speed=0.5 → 4s/批）
  batchTime() { return 2 / (GAME_DATA.deviceStats?.[this.type]?.craftingSpeed ?? 0.5); }
  moduleSlotCount() { return GAME_DATA.deviceStats?.[this.type]?.moduleSlots ?? 4; }
  moduleSpeedMult() {
    const mc = moduleCounts(this.modules);
    const bb = (typeof beaconBonus === 'function') ? beaconBonus(this.x, this.y) : null;
    if (bb) { mc.speed += bb.speed; mc.prod += bb.prod; mc.eff += bb.eff; }
    return 1 + 0.4 * mc.speed - 0.1 * mc.prod - 0.03 * mc.eff - mc.qualityPenalty;
  }
  powerDemand() { return this.crafting ? POWER_USE['recycler'] : 0; }
  update(dt) {
    if (G.power.sat <= 0) { this.crafting = false; return; }
    if (this.crafting && this.recycleItem) {
      const out = this.recycleResults(this.recycleItem);
      if (!out) { this.crafting = false; this.prog = 0; return; }
      // 产出满则暂停（对齐《异星工厂》：回收机输出缓存满时停止回收）
      let outFull = false;
      for (const k in out) if ((this.outp[k] || 0) + out[k] > 50) { outFull = true; break; }
      if (outFull) return;
      this.prog += dt * this.moduleSpeedMult() * powerFactor();
      if (typeof spawnSpark === 'function' && Math.random() < dt * 2) {
        spawnSpark((this.x + 0.5 + (Math.random() - 0.5) * 0.8) * TILE, (this.y + 0.4) * TILE, { size: 1.5, life: 0.5, speed: 2.5, color: '#ff9a3a' });
      }
      if (this.prog >= this.batchTime()) {
        this._fracBuf = this._fracBuf || {};
        // 废料回收产能无限科技：回收废料时额外 +10%/级（对齐《异星工厂》Scrap recycling productivity）
        let scrapBonus = 0;
        if (this.recycleItem === 'scrap' && typeof techProductivity === 'function') {
          scrapBonus = techProductivity('scrap');
        }
        for (const k in out) {
          let v = out[k];
          // 废料回收产能：对废料回收的每项产物额外按比例加成
          if (scrapBonus > 0 && k !== 'scrap') v += v * scrapBonus;
          // 官方回收配方含小数期望（extra_count_fraction / probability）——跨批累积进位，对齐官方分数产出
          const acc = (this._fracBuf[k] || 0) + v;
          const whole = Math.floor(acc);
          this._fracBuf[k] = acc - whole;
          if (whole > 0) {
            this.outp[k] = (this.outp[k] || 0) + whole;
            if (typeof trackProd === 'function') trackProd(k, whole);
          }
        }
        this.recycleItem = null;
        this.crafting = false;
        this.prog = 0;
      }
      return;
    }
  }
  // 计算某物品回收返还的原料。返回 {outItem: 每批期望产出}（可为小数）。
  // 优先读取官方 *-recycling 回收配方（GAME_DATA.recycling，单源来自 data.generated.js），
  // 无官方回收配方的物品回退到通用 25% 估算法（对齐官方 recycle_ratio=0.25 兜底）。
  recycleResults(item) {
    const out = {};
    let found = false;
    // 官方 *-recycling 回收配方（精确单源，含 extra_count_fraction 分数 / independent_probability 概率）
    const rrec = GAME_DATA.recycling && GAME_DATA.recycling[item];
    if (rrec && rrec.out) {
      for (const k in rrec.out) {
        const v = rrec.out[k];
        if (v > 0) { out[k] = (out[k] || 0) + v; found = true; }
      }
      return found ? out : null;
    }
    // 通用配方表（组装机等）以 out 键为物品名
    for (const rid in RECIPES) {
      const rec = RECIPES[rid];
      if (!rec.inp) continue;
      if (Object.keys(rec.out || {})[0] !== item) continue;
      for (const ing in rec.inp) {
        const amt = Math.max(1, Math.floor(rec.inp[ing] * 0.25));
        if (amt > 0) { out[ing] = (out[ing] || 0) + amt; found = true; }
      }
      break;
    }
    // 熔炉冶炼（SMELTS：矿→板）
    if (!found && typeof SMELTS !== 'undefined') {
      for (const s of SMELTS) {
        if (s.id === item) {
          const amt = Math.max(1, Math.floor((s.inCount || 1) * 0.25));
          if (amt > 0) { out[s.inp] = amt; found = true; }
          break;
        }
      }
    }
    // 化学/炼油/离心专属配方（直接按 RECIPES 找不到的独立表）
    if (!found && typeof isChemRecipe === 'function' && typeof CHEM_RECIPES !== 'undefined') {
      for (const rid of CHEM_RECIPES) {
        const rec = RECIPES[rid];
        if (!rec || !rec.inp) continue;
        if (Object.keys(rec.out || {})[0] !== item) continue;
        for (const ing in rec.inp) {
          const amt = Math.max(1, Math.floor(rec.inp[ing] * 0.25));
          if (amt > 0) { out[ing] = (out[ing] || 0) + amt; found = true; }
        }
        break;
      }
    }
    return found ? out : null;
  }
  giveItem(item) {
    // 可回收物优先投入回收（含插件：若插件可回收直接回收，而非进插件槽）
    if (!this.crafting && !this.recycleItem) {
      const out = this.recycleResults(item);
      if (out) {
        this.recycleItem = item;
        this.crafting = true;
        this.prog = 0;
        if (typeof playSfx === 'function') playSfx('machine-run');
        return true;
      }
    }
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
  contents() {
    const list = [[this.type, 1]];
    if (this.recycleItem) list.push([this.recycleItem, 1]);
    for (const k in this.modules) if (this.modules[k] > 0) list.push([k, this.modules[k]]);
    for (const k in this.outp) list.push([k, this.outp[k]]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.recycleItem = this.recycleItem;
    s.outp = this.outp;
    s.prog = this.prog;
    s.crafting = this.crafting;
    s.modules = this.modules;
    s.prodBuf = this.prodBuf;
    s.prodTechBuf = this.prodTechBuf || 0;
    s.fracBuf = this._fracBuf || null;
    return s;
  }
  static restore(s) {
    const r = super.restore(s);
    r.recycleItem = s.recycleItem || null;
    r.outp = s.outp || {};
    r.prog = s.prog || 0;
    r.crafting = !!s.crafting;
    r.modules = s.modules || {};
    r.prodBuf = s.prodBuf || 0;
    r.prodTechBuf = s.prodTechBuf || 0;
    r._fracBuf = s.fracBuf || null;
    return r;
  }
}

// ===== 渲染：灰绿工业回收机 =====
function drawRecycler(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w, sh = TILE * e.h;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#5c636d';
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 8); ctx.fill();
  ctx.strokeStyle = '#3a3f46';
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 8); ctx.stroke();
  // 中央回收腔
  ctx.fillStyle = '#2b3038';
  rr(ctx, px + 8, py + 12, s - 16, sh - 30, 6); ctx.fill();
  // 顶部进料口（绿）
  ctx.fillStyle = '#3f9f6a';
  rr(ctx, px + s * 0.3, py + 4, s * 0.4, 8, 3); ctx.fill();
  if (e.recycleItem && e.crafting) {
    const fl = 0.5 + Math.sin(G.time * 14 + px) * 0.3;
    ctx.fillStyle = 'rgba(120,255,160,' + (0.35 + fl * 0.3).toFixed(2) + ')';
    rr(ctx, px + 8, py + 12, s - 16, sh - 30, 6); ctx.fill();
    // 进度条
    ctx.fillStyle = '#161a20';
    rr(ctx, px + 12, py + sh - 18, s - 24, 8, 3); ctx.fill();
    ctx.fillStyle = '#4ae08a';
    rr(ctx, px + 12, py + sh - 18, (s - 24) * Math.min(1, e.prog / e.batchTime()), 8, 3); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function recyclerPanelHtml(e) {
  let h = '';
  h += row('电力', powerStatusLiveHtml(e), 'power');
  h += row('回收', (e.recycleItem ? (ITEMS[e.recycleItem] ? ITEMS[e.recycleItem].name : e.recycleItem) : '<span class="dim">空闲</span>') + (e.crafting ? ' ' + Math.floor(e.prog / e.batchTime() * 100) + '%' : ''), 'recycle');
  h += '<div id="mach-rate-block"></div>';
  h += modulePanelSection(e);
  h += '<div class="mach-outputs"><b>产出：</b>';
  const outKeys = Object.keys(e.outp || {});
  if (outKeys.length === 0) h += '<span class="dim">无</span>';
  for (const k of outKeys) {
    h += chip(k, e.outp[k]);
  }
  h += '</div>';
  h += '<div class="dim" style="margin-top:4px">回收机把放入的物品还原成其配方原料的 25%（每项至少 1 个）。可用机械臂/传送带或面板「装入」投入物品。</div>';
  return h;
}
function recyclerPanelLive(e, api) {
  api.set('power', powerStatusLiveHtml(e));
  api.set('recycle', (e.recycleItem ? (ITEMS[e.recycleItem] ? ITEMS[e.recycleItem].name : e.recycleItem) : '<span class="dim">空闲</span>') + (e.crafting ? ' ' + Math.floor(e.prog / e.batchTime() * 100) + '%' : ''));
}
const recyclerPanel = { html: recyclerPanelHtml, live: recyclerPanelLive, tip: e => '回收机：把物品还原成其配方原料的 25%', onAction: (a) => false };

// ===== 注册（在面板定义之后，避免 const 提升问题）=====
ENT_CLASSES['recycler'] = Recycler;
DEVICE_RENDER['recycler'] = drawRecycler;
DEVICE_STATUS['recycler'] = e => e.crafting ? 'g' : (e.recycleItem ? 'y' : 'r');
DEVICE_PANEL['recycler'] = recyclerPanel;
DEVICE_DIR_ROTATE['recycler'] = true;
