'use strict';

// ===== 插件模块系统（对齐《异星工厂》Modules）=====
// 模块定义在 js/data.js 的 MODULES 表中。本文件提供：
//  1) moduleBonusesOf(e)：汇总设备自身插槽 + 覆盖范围内信标的模块效果（带 1s 缓存）
//  2) grantOutputWithBonus(e, rec, bon)：按产能加成结算产出（小数进位累积，对齐异星工厂"免费产品"）
//  3) modSectionHtml / modOnAction：各机器面板共享的模块插槽 UI
//  4) 信标 Beacon：向 BEACON_RANGE 内机器转发插槽中模块效果（折算 BEACON_EFF）

// 信标/物流网络设备的增量注册表（由 core/entity.js 的 addEnt/removeEnt 钩子同步维护）
function ensureExtraReg() {
  if (!G.extraReg) G.extraReg = { beacons: new Set(), ports: new Set(), chests: new Set() };
  return G.extraReg;
}
function regExtraEnt(e) {
  if (!e) return;
  const r = ensureExtraReg();
  if (typeof Beacon !== 'undefined' && e instanceof Beacon) r.beacons.add(e);
  else if (typeof RoboPort !== 'undefined' && e instanceof RoboPort) r.ports.add(e);
  else if (e.isLogiChest) r.chests.add(e);
}
function unregExtraEnt(e) {
  if (!e || !G.extraReg) return;
  G.extraReg.beacons.delete(e);
  G.extraReg.ports.delete(e);
  G.extraReg.chests.delete(e);
}
function resetExtraReg() {
  G.extraReg = { beacons: new Set(), ports: new Set(), chests: new Set() };
}

// 设备是否允许插入某模块：有插槽数、且研究中心不能插产能模块（对齐《异星工厂》）
function modAllowed(e, id) {
  const d = MODULES[id];
  if (!d) return false;
  if ((MODULE_SLOTS[e.type] || 0) <= 0 && !(typeof Beacon !== 'undefined' && e instanceof Beacon)) return false;
  if (d.kind === 'prod' && e.type === 'lab') return false;
  return true;
}

// 设备自身插槽内的模块效果汇总
function ownModBonuses(e) {
  let speed = 0, power = 0, prod = 0;
  for (const id of (e.mods || [])) {
    if (!id) continue;
    const d = MODULES[id];
    if (!d) continue;
    speed += d.speed || 0;
    power += d.power || 0;
    prod += d.prod || 0;
  }
  return { speed, power, prod };
}

// 汇总模块效果（自身插槽 + 范围内所有信标的折算效果）。按 G.time 做 1 秒缓存。
function moduleBonusesOf(e) {
  const now = G.time || 0;
  if (e._mbT !== undefined && e._mbV && now - e._mbT < 1) return e._mbV;
  const b = ownModBonuses(e);
  const reg = G.extraReg;
  if (reg && reg.beacons.size) {
    const ecx = e.x + e.w / 2, ecy = e.y + e.h / 2;
    for (const bc of reg.beacons) {
      if (bc._dead || !bc.hasMods()) continue;
      // 中心距 <= 半径 + 目标外接半径的一半（近似覆盖判定）
      const d = Math.hypot((bc.x + bc.w / 2) - ecx, (bc.y + bc.h / 2) - ecy);
      if (d > BEACON_RANGE + Math.max(e.w, e.h) * 0.5) continue;
      for (const id of bc.mods) {
        if (!id) continue;
        const md = MODULES[id];
        if (!md) continue;
        b.speed += (md.speed || 0) * BEACON_EFF;
        b.power += (md.power || 0) * BEACON_EFF;
        b.prod += (md.prod || 0) * BEACON_EFF;
      }
    }
  }
  b.speed = Math.max(MOD_SPEED_MIN - 1, b.speed);   // 总速度倍率不低于 20%
  b.power = Math.max(MOD_POWER_MIN - 1, b.power);   // 总耗电倍率不低于 20%
  b.prod = Math.min(3, Math.max(0, b.prod));
  e._mbT = now; e._mbV = b;
  return b;
}
// 设备实际速度/耗电倍率（供 update/powerDemand 使用）
function modSpeedMult(e) { const b = moduleBonusesOf(e); return Math.max(MOD_SPEED_MIN, 1 + b.speed); }
function modPowerMult(e) { const b = moduleBonusesOf(e); return Math.max(MOD_POWER_MIN, 1 + b.power); }

// 完成一次合成时按产能加成结算产出：整数部分直接入库，小数部分累积进位
// （对齐《异星工厂》productivity bonus 的"概率性免费产品"语义）
function grantOutputWithBonus(e, rec, bon) {
  const hasBonus = bon && bon.prod > 0;
  for (const k in rec.out) {
    let n = rec.out[k];
    if (hasBonus) {
      const raw = rec.out[k] * (1 + bon.prod);
      n = Math.floor(raw);
      e._frac = e._frac || {};
      e._frac[k] = (e._frac[k] || 0) + (raw - n);
      if (e._frac[k] >= 1) {
        const w = Math.floor(e._frac[k]);
        n += w; e._frac[k] -= w;
      }
    }
    e.outp[k] = (e.outp[k] || 0) + n;
    if (typeof trackProd === 'function') trackProd(k, n);
  }
}

// ===== 面板共享 UI：模块插槽区 =====
function modSectionHtml(e) {
  const cap = (typeof Beacon !== 'undefined' && e instanceof Beacon) ? (e.mods ? e.mods.length : 0) : (MODULE_SLOTS[e.type] || 0);
  if (cap <= 0) return '';
  if (!e.mods) e.mods = new Array(cap).fill(null);
  const filled = e.mods.filter(Boolean).length;
  let h = '<div class="sec">模块插槽（' + filled + '/' + cap + '）</div><div class="modrow">';
  for (let i = 0; i < cap; i++) {
    const id = e.mods[i];
    if (id) {
      h += '<button class="modslot filled" data-action="mod-rm" data-slot="' + i + '" data-itemid="' + id +
        '" data-tip="' + ITEMS[id].name + '|点击取回背包">' +
        '<img src="' + iconDataURL(id) + '"></button>';
    } else {
      h += '<button class="modslot empty" data-tip="空插槽|从下方列表选择背包中的模块插入">＋</button>';
    }
  }
  h += '</div>';
  // 当前总效果
  const b = moduleBonusesOf(e);
  h += '<div class="dim" style="color:#8fd0ff">当前效果：速度 ×' + Math.max(MOD_SPEED_MIN, 1 + b.speed).toFixed(2) +
    ' · 耗电 ×' + Math.max(MOD_POWER_MIN, 1 + b.power).toFixed(2) +
    (b.prod > 0 ? ' · 免费增产 +' + Math.round(b.prod * 100) + '%' : '') + '</div>';
  // 可插入的背包模块
  const avail = Object.keys(MODULES).filter(id => invCount(id) > 0 && modAllowed(e, id));
  if (avail.length) {
    h += '<div class="recgrid">';
    for (const id of avail) {
      const d = MODULES[id];
      const eff = [];
      if (d.speed) eff.push('速度 ' + (d.speed > 0 ? '+' : '') + Math.round(d.speed * 100) + '%');
      if (d.power) eff.push('耗电 ' + (d.power > 0 ? '+' : '') + Math.round(d.power * 100) + '%');
      if (d.prod) eff.push('增产 +' + Math.round(d.prod * 100) + '%');
      h += '<button class="rcbtn" data-action="mod-add" data-id="' + id + '" data-itemid="' + id +
        '" data-tip="' + ITEMS[id].name + '|' + eff.join('，') + '">' +
        '<img src="' + iconDataURL(id) + '">' + ITEMS[id].name + ' ×' + invCount(id) + '</button>';
    }
    h += '</div>';
  } else {
    h += '<div class="dim">背包中没有可用模块。合成模块后点击上方「＋」或在此处选择插入。</div>';
  }
  h += '<div class="dim">点击已插入的模块可取回。产能模块不能插入研究中心；信标会把其插槽内模块的效果以 ' +
    Math.round(BEACON_EFF * 100) + '% 折算转发给 ' + BEACON_RANGE + ' 格内的机器。</div>';
  return h;
}

// 面板 onAction 处理：mod-add / mod-rm。返回 true 表示已处理。
function modOnAction(act, btn) {
  const e = G.panelEnt;
  if (!e) return false;
  if (act === 'mod-add') {
    const id = btn.dataset.id;
    if (!MODULES[id]) return true;
    if (!modAllowed(e, id)) { toast(ITEMS[id].name + ' 不能插入这台设备'); return true; }
    if (invCount(id) < 1) return true;
    const i = e.mods.indexOf(null);
    if (i < 0) { toast('模块插槽已满'); return true; }
    invTake(id, 1);
    e.mods[i] = id;
    toast('已插入 ' + ITEMS[id].name);
    uiDirty = true;
    return true;
  }
  if (act === 'mod-rm') {
    const i = +(btn.dataset.slot || 0);
    const id = e.mods[i];
    if (!id) return true;
    e.mods[i] = null;
    invAdd(id, 1);
    toast('已取回 ' + ITEMS[id].name);
    uiDirty = true;
    return true;
  }
  return false;
}

// 序列化辅助：mods 数组（长度对齐插槽数）
function modsSerialize(e) { return (e.mods || []).slice(); }
function modsRestore(e, s, cap) {
  e.mods = new Array(cap).fill(null);
  if (Array.isArray(s)) for (let i = 0; i < Math.min(s.length, cap); i++) e.mods[i] = s[i] || null;
}

// ===== 信标（Beacon）：向范围内机器转发模块效果 =====
class Beacon extends Entity {
  constructor(type, x, y) {
    super(type || 'beacon', x, y);
    this.mods = [null, null];   // 两格插槽（对齐《异星工厂》信标 2 槽）
    this.spin = 0;
  }
  hasMods() { return !!(this.mods && this.mods.some(Boolean)); }
  powerDemand() { return this.hasMods() ? POWER_USE['beacon'] : 0; }
  update(dt) { if (this.hasMods()) this.spin += dt * 2.2; }
  giveItem() { return false; }   // 模块只能通过面板插入
  serialize() {
    const s = super.serialize();
    s.mods = modsSerialize(this);
    return s;
  }
  blueprint() { const s = super.blueprint(); s.mods = []; return s; }   // 蓝图不带模块
  static restore(s) {
    const b = super.restore(s);
    modsRestore(b, s.mods, 2);
    return b;
  }
}

// ===== 信标渲染 =====
function drawBeacon(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * 3;
  ctx.globalAlpha = alpha;
  // 底座
  ctx.fillStyle = '#3c4652';
  rr(ctx, px + 6, py + 6, s - 12, s - 12, 8); ctx.fill();
  ctx.strokeStyle = '#262e38';
  ctx.lineWidth = 3;
  rr(ctx, px + 6, py + 6, s - 12, s - 12, 8); ctx.stroke();
  // 支撑塔（三角桁架）
  const cx = px + s / 2, baseY = py + s - 16;
  ctx.strokeStyle = '#7a8899';
  ctx.lineWidth = 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx - 18, baseY); ctx.lineTo(cx - 6, py + 22);
  ctx.moveTo(cx + 18, baseY); ctx.lineTo(cx + 6, py + 22);
  ctx.moveTo(cx - 13, baseY - 12); ctx.lineTo(cx + 13, baseY - 12);
  ctx.moveTo(cx - 10, py + 40); ctx.lineTo(cx + 10, py + 40);
  ctx.stroke();
  ctx.lineCap = 'butt';
  // 顶部信号灯：有模块时脉冲发光
  const on = e.hasMods();
  const glow = on ? 0.55 + 0.45 * Math.sin(G.time * 5) : 0.25;
  if (on) {
    ctx.fillStyle = 'rgba(90,220,230,' + (glow * 0.28).toFixed(2) + ')';
    ctx.beginPath(); ctx.arc(cx, py + 18, 14 + glow * 5, 0, 7); ctx.fill();
  }
  ctx.fillStyle = on ? '#5ae0e6' : '#5a6672';
  ctx.beginPath(); ctx.arc(cx, py + 18, 5.5, 0, 7); ctx.fill();
  ctx.strokeStyle = '#22303a'; ctx.lineWidth = 2; ctx.stroke();
  // 已装模块图标（左右两个小点）
  if (!LOD.simple && e.mods) {
    for (let i = 0; i < e.mods.length; i++) {
      const id = e.mods[i];
      if (!id) continue;
      drawItemDot(ctx, cx + (i === 0 ? -11 : 11), baseY - 2, id, 4.2);
    }
  }
  // 作用范围虚线圈（选中/悬停时）
  if (alpha === 1 && (G.panelEnt === e || (G.cursorTile && entAt(G.cursorTile.tx, G.cursorTile.ty) === e))) {
    ctx.save();
    ctx.strokeStyle = 'rgba(90,224,230,.5)';
    ctx.lineWidth = 1.6 / G.cam.z;
    ctx.setLineDash([6 / G.cam.z, 5 / G.cam.z]);
    ctx.beginPath();
    ctx.arc(cx, py + s / 2, (BEACON_RANGE + 1.5) * TILE, 0, 7);
    ctx.stroke();
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

// ===== 信标面板 =====
function beaconPanelHtml(e) {
  let h = row('电力', powerStatusLiveHtml(e), 'power');
  h += modSectionHtml(e);
  h += '<div class="status"></div>';
  h += '<div class="dim">信标本身不生产任何物品：把速度/产能/效能模块插入信标后，它会向 ' + BEACON_RANGE +
    ' 格范围内的组装机、化工厂、炼油厂、研究中心转发这些模块的效果（每台信标效果 ×' + BEACON_EFF +
    '，多台信标可叠加）。用效能模块供电省电，用速度+产能模块堆出终极产线。</div>';
  return h;
}
function beaconPanelLive(e, api) {
  api.set('power', powerStatusLiveHtml(e));
  if (!e.hasMods()) api.status('待机：未安装模块（插入模块后开始广播）', 'warn');
  else api.status('广播中：正在向周围机器转发模块效果', 'ok');
}
function beaconTip(e) {
  return e.hasMods() ? '信标广播中（模块 ×' + e.mods.filter(Boolean).length + '）' : '信标：插入模块后向周围机器转发效果';
}

// ===== 注册 =====
ENT_CLASSES['beacon'] = Beacon;
DEVICE_RENDER['beacon'] = drawBeacon;
DEVICE_STATUS['beacon'] = e => e.hasMods() ? (G.power.sat > 0 ? 'g' : 'r') : null;
DEVICE_PANEL['beacon'] = { html: beaconPanelHtml, live: beaconPanelLive, tip: beaconTip, onAction: modOnAction };
