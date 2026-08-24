'use strict';

// ===== 电采矿机：免燃料、吃电力 =====
// 对齐《异星工厂》：电采矿机可装 3 个模块（速度/产能/效率），并受信号塔（Beacon）广播加成。
class ElectricDrill extends Drill {
  constructor(type, x, y) {
    super(type || 'electric-drill', x, y);
    this.modules = {};   // { 'speed-module': n, 'productivity-module': n }（对齐《异星工厂》模块槽）
    this.prodBuf = 0;    // 产能模块累积进度
  }
  machMult() { return 0.5; } // 电采矿机 mining-speed 0.5（对齐《异星工厂》）
  // 模块槽位数（对齐《异星工厂》：电采矿机 3 槽）
  moduleSlotCount() { return 3; }
  // 模块速度倍率：速度模块加速、产能/效率模块小降速；叠加信号塔广播的模块加成
  moduleSpeedMult() {
    const mc = moduleCounts(this.modules);
    const bb = (typeof beaconBonus === 'function') ? beaconBonus(this.x, this.y) : null;
    if (bb) { mc.speed += bb.speed; mc.prod += bb.prod; mc.eff += bb.eff; }
    return 1 + 0.4 * mc.speed - 0.1 * mc.prod - 0.03 * mc.eff;
  }
  // 产能模块结算：每次采出矿石累积进度，达到阈值免费多产 1 个（对齐《异星工厂》Mining productivity 模块化）
  applyProductivity() {
    const mc = moduleCounts(this.modules);
    const bb = (typeof beaconBonus === 'function') ? beaconBonus(this.x, this.y) : null;
    let nProd = mc.prod;
    if (bb) nProd += bb.prod;
    if (nProd <= 0) return 0;
    const thr = moduleProdThreshold(this.modules);
    this.prodBuf = (this.prodBuf || 0) + nProd;
    if (this.prodBuf >= thr) {
      this.prodBuf -= thr;
      if (typeof trackProd === 'function') trackProd(this.bufItem, 1);
      return 1;
    }
    return 0;
  }
  update(dt) {
    this.working = false;
    if (this.bufN === undefined) this.bufN = 0;
    if (this.buf > 0) this.tryOutput();
    const o = this.oreTile();
    if (!o) { this.status = '无矿'; this.spin = 0; return; }
    if (this.buf >= 20) { this.status = '缓存已满'; this.spin = 0; return; }
    if (G.power.sat <= 0) { this.status = '缺电'; this.spin = 0; return; }
    this.status = '';
    this.working = true;
    drillEmit(this, dt);
    this.spin += dt * 6;
    // 采矿速度 = 采矿科技 × 机型倍率 × 模块倍率（对齐《异星工厂》：电采矿机模块影响采矿速度）
    this.prog += dt * drillMult() * this.machMult() * this.moduleSpeedMult() * powerFactor();
    if (this.prog >= DRILL_TIME) {
      this.prog -= DRILL_TIME;
      if (!G.settings.infiniteOre) consumeOre(o[0], o[1]);
      const mined = this.mineItem(o);
      // 采矿产能科技：按比例累积免费额外产出（对齐《异星工厂》Mining productivity）
      if (this.prodAccum === undefined) this.prodAccum = 0;
      this.prodAccum += (miningProdMult() - 1);
      const bonus = Math.floor(this.prodAccum);
      if (bonus > 0) this.prodAccum -= bonus;
      this.bufItem = mined;
      this.buf += 1 + bonus + this.applyProductivity();
      if (typeof trackProd === 'function') trackProd(mined, 1 + bonus);
      this.tryOutput();
    }
  }
  giveItem(item) {
    if (isModule(item)) {
      // 模块槽位限制（对齐《异星工厂》：电采矿机 3 槽）
      if ((this.modules[item] || 0) >= this.moduleSlotCount()) return false;
      this.modules[item] = (this.modules[item] || 0) + 1;
      if (typeof playSfx === 'function') playSfx('module');
      return true;
    }
    return false;
  }
  // contents：矿物/燃料（基类）基础上追加模块（用于拆除/蓝图掉落返还）
  contents() {
    const list = super.contents();
    for (const k in this.modules) if (this.modules[k] > 0) list.push([k, this.modules[k]]);
    return list;
  }
  // 面板"取出全部"：矿物缓存（继承基类）；模块由面板"取出全部模块"（takein data-modules）单独处理
  serialize() {
    const s = super.serialize();
    s.modules = this.modules;
    s.prodBuf = this.prodBuf;
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
    e.prodBuf = s.prodBuf || 0;
    return e;
  }
  // 模块耗电：速度/产能模块增加耗电，效率模块降低耗电（对齐《异星工厂》模块耗电特性）
  modulePowerFactor() {
    const mc = moduleCounts(this.modules);
    const bb = (typeof beaconBonus === 'function') ? beaconBonus(this.x, this.y) : null;
    if (bb) { mc.speed += bb.speed; mc.prod += bb.prod; mc.eff += bb.eff; }
    const effMult = Math.max(0.2, 1 - 0.15 * mc.eff);
    const powMult = 1 + (mc.speed * 0.25 + mc.prod * 0.25);
    return powMult * effMult;
  }
  powerDemand() { return (this.oreTile() && this.buf < 20) ? POWER_USE['electric-drill'] * this.modulePowerFactor() : 0; }
}

// ===== 注册 =====
ENT_CLASSES['electric-drill'] = ElectricDrill;
DEVICE_PLACE['electric-drill'] = DEVICE_PLACE['burner-drill'];
