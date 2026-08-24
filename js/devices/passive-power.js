'use strict';

// ===== 被动供电设备（应急备用电源）=====
// 一个"被动式"供电设备：平时不主动充电，而是内置一大块备用储能；
// 一旦电网电量不足（需求 > 产出），它就把剩余所有的电一次性供出，
// 补足电网缺口，直至储能耗尽。放完即待机，不会反复充放。
// 区别于蓄电器：蓄电器是"白天充、夜间放"的双向缓冲；被动供电设备
// 只作应急兜底——电网一缺电就倾泻全部储能，作为最后一道保障。
// 占用 2×2，仅在开启"无限资源"调试模式后出现在背包建造列表。
const PASSIVE_CAP = 20000;       // 内置备用储能上限（kJ，远大于蓄电器 5MJ 的兜底电源）
class PassivePower extends Entity {
  constructor(type, x, y) {
    super('passive-power', x, y);
    this.stored = PASSIVE_CAP;   // 当前备用储电量（放置即满）
    this.powerOut = 0;           // 电网注入功率（应急放电时 >0）
  }
  update(dt) {
    // 被动供电：电网电量不足时，持续供出剩余电力补足缺口，直至储能耗尽。
    // 平时电网供大于求时不动作（被动，不主动储能/放电）。
    if (G.power && G.power.demand > G.power.prod && this.stored > 0) {
      const need = G.power.demand - G.power.prod;          // 当前电网缺口
      const canOut = this.stored / Math.max(dt, 0.001);    // 按剩余储能可折算的功率（放完为止）
      this.powerOut = Math.min(need, canOut);              // 补缺口，最多供出剩余所有电
      this.stored = Math.max(0, this.stored - this.powerOut * dt);
    } else {
      this.powerOut = 0;
    }
    // 保持电力增量注册表同步：powerOut 变化后重新注册，确保被 updatePower 扫描到
    if (typeof regPowerEnt === 'function') regPowerEnt(this);
  }
  serialize() { const s = super.serialize(); s.stored = this.stored; return s; }
  static restore(s) { const a = super.restore(s); a.stored = (s.stored !== undefined) ? s.stored : PASSIVE_CAP; return a; }
}

// ===== 渲染（暗金·闪电兜底造型）=====
function drawPassivePower(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w, sh = TILE * e.h;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#4a4030';
  rr(ctx, px + 4, py + 4, s - 8, sh - 8, 8); ctx.fill();
  ctx.strokeStyle = '#2a2418';
  ctx.lineWidth = 2;
  rr(ctx, px + 4, py + 4, s - 8, sh - 8, 8); ctx.stroke();
  // 储能槽
  const pct = Math.max(0, Math.min(1, (e.stored || 0) / PASSIVE_CAP));
  ctx.fillStyle = '#241f16';
  rr(ctx, px + 10, py + 10, s - 20, sh - 20, 4); ctx.fill();
  ctx.fillStyle = pct > 0 ? '#e0b23c' : '#5a4f35';
  rr(ctx, px + 12, py + sh - 12 - (sh - 24) * pct, s - 24, (sh - 24) * pct, 3); ctx.fill();
  // 闪电标识（被动应急电源）
  ctx.fillStyle = pct > 0 ? '#ffe9a0' : '#7a6a45';
  const cx = px + s / 2, cy = py + sh / 2;
  ctx.beginPath();
  ctx.moveTo(cx + 4, cy - 12);
  ctx.lineTo(cx - 6, cy + 2);
  ctx.lineTo(cx, cy + 2);
  ctx.lineTo(cx - 4, cy + 12);
  ctx.lineTo(cx + 6, cy - 2);
  ctx.lineTo(cx, cy - 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 8px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(Math.round(pct * 100) + '%', px + s / 2, py + 9);
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function passivePowerPanelHtml() {
  return row('备用储电', '<span class="dim"></span>', 'stored') +
    '<div class="status"></div>' +
    '<div class="dim">被动供电设备：平时不主动储能，电网电量不足时一次性供出剩余所有电兜底（2×2）。开启"无限资源"模式后可在背包建造。</div>';
}
function passivePowerPanelLive(e, api) {
  api.set('stored', Math.round(e.stored || 0) + ' / ' + PASSIVE_CAP);
  if ((e.stored || 0) > 0 && G.power && G.power.prod < G.power.demand) api.status('应急放电：电网电量不足，正在供出剩余电力', 'ok');
  else if ((e.stored || 0) > 0) api.status('待机：电网供电正常，备用储能已就绪', 'ok');
  else api.status('已耗尽：备用电力已全部供出', 'warn');
}
function passivePowerTip(e) {
  if ((e.stored || 0) > 0) return '备用储能 ' + Math.round(e.stored || 0) + '/' + PASSIVE_CAP;
  return '备用储能已耗尽';
}

// ===== 注册 =====
ENT_CLASSES['passive-power'] = PassivePower;
DEVICE_RENDER['passive-power'] = drawPassivePower;
DEVICE_STATUS['passive-power'] = e => (e.stored || 0) > 0 ? 'g' : 'y';
DEVICE_PANEL['passive-power'] = { html: passivePowerPanelHtml, live: passivePowerPanelLive, tip: passivePowerTip };
