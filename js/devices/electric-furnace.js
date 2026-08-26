'use strict';

// ===== 电炉：免燃料、吃电力冶炼，速度更高，可出钢板 =====
// 对齐《异星工厂》：电炉可装 2 个模块（速度/产能/效率），并受信号塔（Beacon）广播加成。
class ElectricFurnace extends Furnace {
  constructor(type, x, y) { super('electric-furnace', x, y); this.modules = {}; this.prodBuf = 0; }
  // 模块槽位数（对齐《异星工厂》官方 module_slots：电炉 2 槽）
  moduleSlotCount() { return GAME_DATA.deviceStats?.[this.type]?.moduleSlots ?? 2; }
  // 模块速度倍率：速度模块加速、产能/效率模块小降速；叠加信号塔广播加成
  moduleSpeedMult() {
    const mc = moduleCounts(this.modules);
    const bb = (typeof beaconBonus === 'function') ? beaconBonus(this.x, this.y) : null;
    if (bb) { mc.speed += bb.speed; mc.prod += bb.prod; mc.eff += bb.eff; }
    return 1 + 0.4 * mc.speed - 0.1 * mc.prod - 0.03 * mc.eff - mc.qualityPenalty;
  }
  // 产能模块结算：每次冶炼产出累积进度，达到阈值免费多产 1 个主产物
  applyProductivity(rec) {
    const mc = moduleCounts(this.modules);
    const bb = (typeof beaconBonus === 'function') ? beaconBonus(this.x, this.y) : null;
    let nProd = mc.prod;
    if (bb) nProd += bb.prod;
    if (nProd <= 0) return 0;
    const thr = moduleProdThreshold(this.modules);
    this.prodBuf = (this.prodBuf || 0) + nProd;
    if (this.prodBuf >= thr) {
      this.prodBuf -= thr;
      const mainOut = rec ? rec.id : null;
      if (mainOut) { this.outp[mainOut] = (this.outp[mainOut] || 0) + 1; if (typeof trackProd === 'function') trackProd(mainOut, 1); }
      return 1;
    }
    return 0;
  }
  // 模块耗电：速度/产能模块增加耗电，效率模块降低耗电
  modulePowerFactor() {
    const mc = moduleCounts(this.modules);
    const bb = (typeof beaconBonus === 'function') ? beaconBonus(this.x, this.y) : null;
    if (bb) { mc.speed += bb.speed; mc.prod += bb.prod; mc.eff += bb.eff; }
    const effMult = Math.max(0.2, 1 - 0.15 * mc.eff);
    const powMult = 1 + (mc.speed * 0.25 + mc.prod * 0.25);
    return powMult * effMult;
  }
  update(dt) {
    const r = this.pickRecipe();
    this.cur = r;
    if (!r) { this.prog = 0; this.lit = false; return; }
    if (G.power.sat <= 0) { this.lit = false; return; }
    this.lit = true;
    furnaceEmit(this, dt);
    this.prog += dt / r.time * (GAME_DATA.deviceStats?.[this.type]?.craftingSpeed ?? 2) * this.moduleSpeedMult() * powerFactor() * (this.quality ? qualityMult(this.quality) : 1);
    if (this.prog >= 1) {
      this.prog -= 1;
      this.inp[r.inp] = (this.inp[r.inp] || 0) - (r.inCount || 1);
      if (typeof trackProd === 'function') trackProd(r.inp, -(r.inCount || 1));
      if (this.inp[r.inp] <= 0) delete this.inp[r.inp];
      emitQuality(this, this.outp, r.id, 1);
      if (typeof trackProd === 'function') trackProd(r.id, 1);
      this.applyProductivity(r);
    }
  }
  giveItem(item) {
    if (isModule(item)) {
      // 模块槽位限制（对齐《异星工厂》：电炉 2 槽）
      if ((this.modules[item] || 0) >= this.moduleSlotCount()) return false;
      this.modules[item] = (this.modules[item] || 0) + 1;
      if (typeof playSfx === 'function') playSfx('module');
      return true;
    }
    if (item === 'coal') return false;
    for (const r of SMELTS)
      if (r.inp === item && (this.inp[item] || 0) < 50) { this.inp[item] = (this.inp[item] || 0) + 1; return true; }
    return false;
  }
  contents() {
    const list = super.contents();
    for (const k in this.modules) if (this.modules[k] > 0) list.push([k, this.modules[k]]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.modules = this.modules; s.prodBuf = this.prodBuf;
    return s;
  }
  blueprint() {
    const s = super.blueprint();
    s.modules = this.modules;
    return s;
  }
  static restore(s) {
    const e = super.restore(s);
    e.modules = s.modules || {}; e.prodBuf = s.prodBuf || 0;
    return e;
  }
  powerDemand() { return this.cur ? POWER_USE['electric-furnace'] * this.modulePowerFactor() : 0; }
}

// ===== 注册 =====
ENT_CLASSES['electric-furnace'] = ElectricFurnace;
