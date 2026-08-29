'use strict';

// ===== 虫巢孵化器（Captive biter spawner）：太空时代生物建筑（对齐《异星工厂》Space Age）=====
// 数据（占地 5×5 / 血量 350 / 功耗 100kW）全部来自 GAME_DATA（由 factorio-data 生成，官方 assembling-machine 原型）。
// 官方行为：捕获的虫巢经驯化后可持续繁育异虫卵（biter-egg），需定期喂养生物流（bioflux）维持圈养；
// 若食物耗尽，虫巢会逐渐饿死并发生转变。此处实现为官方对齐的生产建筑：以生物流为食物，持续产出异虫卵。
class CaptiveBiterSpawner extends Assembler {
  constructor(type, x, y) {
    super('captive-biter-spawner', x, y);
    // 默认配方：持续繁育异虫卵（官方 spawner 繁育行为，适配为生物流→异虫卵）
    // 官方无固定配方（spawner 随时间产蛋 + 消耗食物），此处建模为持续生产链
    this.recipe = 'biter-egg-spawner';
    this.food = 0;        // 生物流食物储备（维护圈养，耗尽则饿死停转）
    this.foodMax = 100;
    this.hungry = false;  // 饥饿状态
  }
  update(dt) {
    this.portFlow();
    // 饥饿机制（对齐官方：需持续喂养生物流维持圈养）
    if (this.food <= 0) {
      this.hungry = true;
      this.crafting = false;
      // 从输入缓存吸取生物流作为食物
      if ((this.inp['bioflux'] || 0) > 0) {
        const take = Math.min(this.inp['bioflux'], 5);
        this.inp['bioflux'] -= take;
        this.food = Math.min(this.foodMax, this.food + take * 2);
        if (this.inp['bioflux'] <= 0) delete this.inp['bioflux'];
      } else {
        return; // 无食物，饿死停转
      }
    } else {
      this.hungry = false;
      // 缓慢消耗食物（约 0.5 食物/秒，1 生物流=2 食物 → 每生物流维持 4 秒）
      this.food = Math.max(0, this.food - 0.5 * dt);
    }
    if (G.power.sat <= 0) { this.crafting = false; return; }
    if (!this.circuitEnabled()) { this.crafting = false; return; }
    // 持续繁育异虫卵：每 5 秒产 1 个异虫卵（官方 spawner 低频繁育节奏）
    this._spawnT = (this._spawnT || 0) + dt;
    this.spin += dt * 4;
    if (this._spawnT >= 5) {
      this._spawnT = 0;
      // 产出异虫卵（若输出已满则等待）
      if ((this.outp['biter-egg'] || 0) < 50) {
        this.outp['biter-egg'] = (this.outp['biter-egg'] || 0) + 1;
        if (typeof trackProd === 'function') trackProd('biter-egg', 1);
        this.crafting = true;
      } else {
        this.crafting = false;
      }
    }
  }
  // 生物流食物：接收生物流
  acceptsFluid(k) { return false; }
  giveItem(item) {
    if (item === 'bioflux') { this.inp['bioflux'] = (this.inp['bioflux'] || 0) + 1; return true; }
    if (item === 'biter-egg' && (this.outp['biter-egg'] || 0) < 50) { this.outp['biter-egg'] = (this.outp['biter-egg'] || 0) + 1; return true; }
    return false;
  }
  peekItem() { return (this.outp['biter-egg'] || 0) > 0 ? 'biter-egg' : null; }
  takeItem() { if ((this.outp['biter-egg'] || 0) > 0) { this.outp['biter-egg']--; if (this.outp['biter-egg'] <= 0) delete this.outp['biter-egg']; return 'biter-egg'; } return null; }
  takeItemOf(item) { if (item === 'biter-egg' && (this.outp['biter-egg'] || 0) > 0) { this.outp['biter-egg']--; if (this.outp['biter-egg'] <= 0) delete this.outp['biter-egg']; return 'biter-egg'; } return null; }
  countOf(item) { return item === 'biter-egg' ? (this.outp['biter-egg'] || 0) : (item === 'bioflux' ? (this.inp['bioflux'] || 0) : 0); }
  // 模块槽位数（官方 module_slots=0，生物建筑无模块）
  moduleSlotCount() { return 0; }
  contents() {
    const list = [[this.type, 1]];
    if ((this.outp['biter-egg'] || 0) > 0) list.push(['biter-egg', this.outp['biter-egg']]);
    if ((this.inp['bioflux'] || 0) > 0) list.push(['bioflux', this.inp['bioflux']]);
    return list;
  }
  serialize() { const s = super.serialize(); s.food = this.food; return s; }
  static restore(s) {
    const e = new CaptiveBiterSpawner(s.type, s.x, s.y);
    e.dir = s.dir | 0;
    e.food = s.food || 0;
    e.inp = s.inp || {};
    e.outp = s.outp || {};
    return e;
  }
}

// ===== 渲染 =====
function drawCaptiveBiterSpawner(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const W = e.w * TILE, H = e.h * TILE;
  const cx = px + W / 2, cy = py + H / 2;
  ctx.globalAlpha = alpha;
  // 生物质地基
  ctx.fillStyle = '#2a2a38';
  ctx.fillRect(px, py, W, H);
  ctx.fillStyle = e.hungry ? '#4a3030' : '#3a2a4a';
  rr(ctx, px + 8, py + 8, W - 16, H - 16, 8); ctx.fill();
  ctx.strokeStyle = '#5a4a7a';
  ctx.lineWidth = 2;
  rr(ctx, px + 8, py + 8, W - 16, H - 16, 8); ctx.stroke();
  // 中央巢体（脉动）
  const pulse = 0.5 + 0.5 * Math.sin((performance.now() / 400) + e.x + e.y);
  const r = 24 + 6 * pulse;
  ctx.fillStyle = e.hungry ? '#5a2a2a' : '#7a4a8a';
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 7);
  ctx.fill();
  ctx.strokeStyle = '#9a6ac0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy, r + 3, 0, 7);
  ctx.stroke();
  // 繁育中的虫卵指示
  if (e._spawnT && e._spawnT > 3) {
    ctx.fillStyle = '#c0a058';
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(cx + (i - 1) * 10, cy - r - 10, 4, 0, 7);
      ctx.fill();
    }
  }
  // 食物指示条
  const fw = (W - 40) * Math.min(1, e.food / e.foodMax);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(px + 20, py + 10, W - 40, 6);
  ctx.fillStyle = e.hungry ? '#c04a3a' : '#7ac04a';
  ctx.fillRect(px + 20, py + 10, fw, 6);
  ctx.restore();
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function cbsPanelHtml(e) {
  let h = row('异虫卵', '<span class="dim"></span>', 'egg');
  h += '<div class="dim">捕获的虫巢经驯化后持续繁育异虫卵，需喂养生物流维持圈养（食物耗尽会饿死停转）。</div>';
  return h;
}
function cbsPanelLive(e, api) {
  api.set('egg', (e.outp['biter-egg'] || 0) > 0 ? '<div class="asm3-inp-row">' + itemSlotsHtml({ 'biter-egg': e.outp['biter-egg'] }, { action: 'take-slot' }) + '</div>' : dimSpan('空'));
  api.prog((e.food / e.foodMax) * 100);
  if (e.hungry) api.status('饥饿：食物耗尽，需喂养生物流', 'r');
  else if (e.food < 20) api.status('低食物：请补充生物流', 'y');
  else api.status('圈养中：持续繁育异虫卵', 'ok');
}
function cbsTip(e) {
  return e.hungry ? '饥饿，需喂养生物流' : ('圈养中（食物 ' + Math.floor(e.food) + '/' + e.foodMax + '），持续繁育异虫卵');
}

// ===== 注册 =====
ENT_CLASSES['captive-biter-spawner'] = CaptiveBiterSpawner;
DEVICE_RENDER['captive-biter-spawner'] = drawCaptiveBiterSpawner;
DEVICE_STATUS['captive-biter-spawner'] = e => e.hungry ? 'r' : ((e.food < 20) ? 'y' : 'g');
DEVICE_PANEL['captive-biter-spawner'] = { html: cbsPanelHtml, live: cbsPanelLive, tip: cbsTip };
