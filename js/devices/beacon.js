'use strict';

// ===== 信号塔 Beacon（对齐《异星工厂》Beacon）=====
// 3×3 信号塔：内装 2 个模块，向 9×9 范围内的生产建筑（组装机/电炉/化工厂等）
// 广播模块加成，让一个信号塔的模块效果同时作用于多台生产设备。
// 消耗电力；需「产能科技（production）」解锁。

// 常量（对齐《异星工厂》Beacon）
const BEACON_RANGE = GAME_DATA.beaconRange ?? 4; // 影响半径（格），官方 2.0 supply_area_distance=3
const BEACON_MOD_SLOTS = GAME_DATA.deviceStats?.['beacon']?.moduleSlots ?? 2; // 信号塔模块槽位数（官方 module_slots=2）
const BEACON_POWER = GAME_DATA.powerUse?.['beacon'] ?? 480;  // 信号塔基础耗电（kW，官方 energy_usage 480kW）
// 信号塔模块生效系数：项目沿用《异星工厂》1.x 的"效果减半"模型（=0.5）。
// 官方 2.0 改为 distribution_effectivity=1.5 + 按每台被服务机器递减（beacon_counter=same_type），
// 与项目"单塔向范围内多台广播"的简化模型语义不同，故保持手工 0.5，不直接套用 2.0 数值。
const BEACON_MODULE_EFF = 0.5;

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
    // 对齐《异星工厂》：信号塔只能装速度模块，产能/效率模块无法放入信号塔。
    if (!isModule(item) || moduleType(item) !== 'speed') return false;
    if (Object.values(this.modules).reduce((a, b) => a + b, 0) >= BEACON_MOD_SLOTS) return false;
    this.modules[item] = (this.modules[item] || 0) + 1;
    if (typeof playSfx === 'function') playSfx('module');
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
    // 信号塔只能装速度模块（对齐《异星工厂》：Beacon 仅接受速度模块）。
    // 旧档若含非法模块（产能/效率），读档/粘贴时自动剔除并掉落到地面归还，不丢失。
    e.modules = {};
    if (s.modules) {
      for (const k in s.modules) {
        const n = s.modules[k] | 0;
        if (n <= 0) continue;
        if (moduleType(k) === 'speed') e.modules[k] = (e.modules[k] || 0) + n;
        else if (typeof addGroundItem === 'function')
          addGroundItem(Math.floor(e.x / TILE), Math.floor(e.y / TILE), k, n);
      }
    }
    return e;
  }
}

// 查询某坐标附近的信号塔给出的模块加成（叠加全部覆盖到的信号塔模块，并乘以生效系数）。
// 返回 { speed, prod, eff }。
// 性能优化：信号塔查询被组装机/化工厂/电采矿机等每帧多次调用（每次做桶索引遍历）。
// 这里做按坐标的逐帧缓存——同一帧内同一坐标的结果只计算一次，避免同格被多个系统重复查询。
// 信号塔仅在放置/拆除/装模块时变化（均由玩家操作触发，发生在帧间），帧内缓存不会产生行为差异；
// 每帧由 clearBeaconBonusCache() 清空，保证跨帧始终返回最新结果（语义与旧逻辑完全一致）。
let _beaconCache = null;
let _beaconCacheKeys = 0;
function clearBeaconBonusCache() { _beaconCache = null; _beaconCacheKeys = 0; }
function beaconBonus(x, y) {
  if (!G.techDone.production) return { speed: 0, prod: 0, eff: 0 };
  // 缓存命中：同一帧内同一坐标直接返回已算结果
  const key = x + ',' + y;
  if (_beaconCache && _beaconCache[key]) return _beaconCache[key];
  let speed = 0, prod = 0, eff = 0;
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
  const res = { speed, prod, eff };
  // 写入缓存（懒初始化，避免每帧创建空 Map；用对象按坐标缓存，超阈值时整帧清空防内存膨胀）
  if (!_beaconCache) _beaconCache = {};
  _beaconCache[key] = res;
  if (++_beaconCacheKeys > 4096) { _beaconCache = {}; _beaconCacheKeys = 0; }
  return res;
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
  // 发光光晕（低 LOD 关闭；有模块时随心跳轻微脉动，强化“工作”氛围）
  if (hasMod && !LOD.simple) {
    const pulse = 0.55 + 0.3 * Math.sin(G.time * 3);
    ctx.save();
    ctx.shadowColor = 'rgba(120,240,150,' + pulse.toFixed(2) + ')';
    ctx.shadowBlur = 14;
  }
  ctx.fillStyle = hasMod ? '#8fe08f' : '#6a7a8a';
  ctx.beginPath();
  ctx.arc(cx, cy - 10, 8, 0, 7); ctx.fill();
  ctx.fillStyle = '#3a5468';
  ctx.fillRect(cx - 18, cy + 6, 36, 4);
  ctx.fillRect(cx - 4, cy + 6, 8, 22);
  if (hasMod && !LOD.simple) ctx.restore();
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
      '速度+' + mc.speed.toFixed(1) : '<span class="dim">无</span>', 'mod');
    // 信号塔只能装速度模块（对齐《异星工厂》：Beacon 仅接受速度模块）
    const order = ['speed-module', 'speed-module-2', 'speed-module-3'];
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
    api.set('mod', n ? '速度+' + mc.speed.toFixed(1) : dimSpan('无'));
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
DEVICE_DIR_ROTATE['beacon'] = true; // 支持旋转
DEVICE_STATUS['beacon'] = e => Object.values(e.modules).reduce((a, b) => a + b, 0) > 0 ? 'g' : 'r';
DEVICE_PANEL['beacon'] = beaconPanel;
