'use strict';

// ===== 信号塔 Beacon（对齐《异星工厂》Beacon）=====
// 3×3 信号塔：内装 2 个模块，向 9×9 范围内的生产建筑（组装机/电炉/化工厂等）
// 广播模块加成，让一个信号塔的模块效果同时作用于多台生产设备。
// 消耗电力；需「产能科技（production）」解锁。

// 常量（对齐《异星工厂》Beacon）
const BEACON_RANGE = 4;          // 影响半径（格），即 9×9 范围
const BEACON_MOD_SLOTS = 2;      // 信号塔模块槽位数
const BEACON_POWER = 480;        // 信号塔基础耗电（kW）
const BEACON_MODULE_EFF = 0.5;   // 信号塔模块生效系数（对齐异星工厂：信号塔内模块效果减半）

// 信号塔实体
class Beacon extends Entity {
  constructor(type, x, y) {
    super('beacon', x, y);
    this.modules = {};
  }
  powerDemand() {
    const n = Object.values(this.modules).reduce((a, b) => a + b, 0);
    return n > 0 ? BEACON_POWER : 0;   // 有模块才耗电
  }
  giveItem(item) {
    if (!isModule(item)) return false;
    if (Object.values(this.modules).reduce((a, b) => a + b, 0) >= BEACON_MOD_SLOTS) return false;
    this.modules[item] = (this.modules[item] || 0) + 1;
    return true;
  }
  peekItem() {
    for (const k in this.modules) if (this.modules[k] > 0) return k;
    return null;
  }
  takeItem() {
    for (const k in this.modules) if (this.modules[k] > 0) { this.modules[k]--; if (this.modules[k] <= 0) delete this.modules[k]; return k; }
    return null;
  }
  countOf(item) { return this.modules[item] || 0; }
  takeItemOf(item) {
    if ((this.modules[item] || 0) > 0) { this.modules[item]--; if (this.modules[item] <= 0) delete this.modules[item]; return item; }
    return null;
  }
  contents() {
    const list = [[this.type, 1]];
    for (const k in this.modules) if (this.modules[k] > 0) list.push([k, this.modules[k]]);
    return list;
  }
  takeAll() {
    const rows = [];
    for (const k of Object.keys(this.modules)) { rows.push([k, this.modules[k]]); delete this.modules[k]; }
    return rows;
  }
  serialize() {
    const s = super.serialize();
    s.modules = this.modules;
    return s;
  }
  blueprint() {
    const s = super.blueprint();
    s.modules = this.modules;
    return s;
  }
  static restore(s) {
    const e = super.restore(s);
    e.modules = s.modules || {};
    return e;
  }
}

// 查询某坐标附近的信号塔给出的模块加成（叠加全部覆盖到的信号塔模块，并乘以生效系数）。
// 返回 { speed, prod, eff }。
function beaconBonus(x, y) {
  let speed = 0, prod = 0, eff = 0;
  if (!G.techDone.production) return { speed, prod, eff };
  // 在 9×9 范围内查找信号塔（按桶索引加速）
  const keys = bucketKeysIn(x - BEACON_RANGE, y - BEACON_RANGE, x + BEACON_RANGE, y + BEACON_RANGE);
  forEachEntInBuckets(keys, e => {
    if (e._dead || e.type !== 'beacon') return;
    // 判断 (x,y) 是否在信号塔影响范围内（曼哈顿距离，对齐异星工厂菱形范围近似为方形）
    const cx = e.x + Math.floor(e.w / 2), cy = e.y + Math.floor(e.h / 2);
    if (Math.abs(cx - x) <= BEACON_RANGE && Math.abs(cy - y) <= BEACON_RANGE) {
      const bc = moduleCounts(e.modules);
      speed += bc.speed * BEACON_MODULE_EFF;
      prod += bc.prod * BEACON_MODULE_EFF;
      eff += bc.eff * BEACON_MODULE_EFF;
    }
  });
  return { speed, prod, eff };
}

// 渲染
function drawBeacon(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w, sh = TILE * e.h;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#5a7a9a';
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 6); ctx.fill();
  ctx.strokeStyle = '#3a5468';
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 6); ctx.stroke();
  // 塔顶灯泡
  const cx = px + s / 2, cy = py + sh / 2;
  const hasMod = Object.values(e.modules).reduce((a, b) => a + b, 0) > 0;
  ctx.fillStyle = hasMod ? '#8fe08f' : '#6a7a8a';
  ctx.beginPath();
  ctx.arc(cx, cy - 10, 8, 0, 7); ctx.fill();
  ctx.fillStyle = '#3a5468';
  ctx.fillRect(cx - 18, cy + 6, 36, 4);
  ctx.fillRect(cx - 4, cy + 6, 8, 22);
  // 发光范围（仅高亮时显示）
  if (hasMod && !LOD.simple) {
    ctx.strokeStyle = 'rgba(143,224,143,.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect((gx - BEACON_RANGE) * TILE, (gy - BEACON_RANGE) * TILE, (BEACON_RANGE * 2 + e.w) * TILE, (BEACON_RANGE * 2 + e.h) * TILE);
  }
  ctx.globalAlpha = 1;
}

// 面板
function beaconPanelHtml(e) {
  let h = row('信号塔', '向 ' + (BEACON_RANGE * 2 + e.w) + '×' + (BEACON_RANGE * 2 + e.h) + ' 范围内的生产建筑广播模块加成（效果 ' + (BEACON_MODULE_EFF * 100) + '%）');
  {
    const mc = moduleCounts(e.modules);
    const hasMod = Object.values(e.modules).reduce((a, b) => a + b, 0) > 0;
    h += row('模块', hasMod ?
      '速度+' + mc.speed.toFixed(1) + ' 产能+' + mc.prod.toFixed(1) + ' 效率-' + mc.eff.toFixed(1) : '<span class="dim">无</span>', 'mod');
    const order = ['speed-module', 'speed-module-2', 'speed-module-3', 'productivity-module', 'productivity-module-2', 'productivity-module-3', 'efficiency-module', 'efficiency-module-2', 'efficiency-module-3'];
    for (const mid of order) {
      if (!itemUnlocked(mid)) continue;
      const n = Math.min(invCount(mid), BEACON_MOD_SLOTS - Object.values(e.modules).reduce((a, b) => a + b, 0));
      if (n > 0) h += '<button data-action="feed" data-id="' + mid + '">放入' + ITEMS[mid].name + ' ×' + n + '</button>';
    }
  }
  if (Object.values(e.modules).reduce((a, b) => a + b, 0) > 0) h += '<button data-action="takein" data-modules="1">取出全部模块</button>';
  h += '<div class="status"></div>';
  h += '<div class="dim">信号塔可将模块效果共享给周围 9×9 内的组装机/电炉等生产建筑，一座信号塔可服务多台设备，适合大规模生产区。</div>';
  return h;
}
function beaconPanelLive(e, api) {
  const n = Object.values(e.modules).reduce((a, b) => a + b, 0);
  {
    const mc = moduleCounts(e.modules);
    api.set('mod', n ? '速度+' + mc.speed.toFixed(1) + ' 产能+' + mc.prod.toFixed(1) + ' 效率-' + mc.eff.toFixed(1) : dimSpan('无'));
  }
  api.status(n > 0 ? '广播中：向周围生产建筑提供模块加成' : '无模块，空闲待机', n > 0 ? 'ok' : 'warn');
}
function beaconTip(e) {
  const n = Object.values(e.modules).reduce((a, b) => a + b, 0);
  return n > 0 ? '信号塔：向周围生产建筑广播模块加成' : '信号塔：点击放入模块以广播加成';
}
const beaconPanel = { html: beaconPanelHtml, live: beaconPanelLive, tip: beaconTip };

// ===== 注册 =====
ENT_CLASSES['beacon'] = Beacon;
DEVICE_RENDER['beacon'] = drawBeacon;
DEVICE_STATUS['beacon'] = e => Object.values(e.modules).reduce((a, b) => a + b, 0) > 0 ? 'g' : 'r';
DEVICE_PANEL['beacon'] = beaconPanel;
