'use strict';

// ===== 电炉：免燃料、吃电力冶炼，速度更高，可出钢板 =====
class ElectricFurnace extends Furnace {
  constructor(type, x, y) { super('electric-furnace', x, y); }
  update(dt) {
    const r = this.pickRecipe();
    this.cur = r;
    if (!r) { this.prog = 0; this.lit = false; return; }
    if (G.power.sat <= 0) { this.lit = false; return; }
    this.lit = true;
    this.prog += dt / r.time * 1.5 * elecMachMult() * (G.power.sat < 1 ? G.power.sat : 1);
    if (this.prog >= 1) {
      this.prog -= 1;
      this.inp[r.inp] = (this.inp[r.inp] || 0) - (r.inCount || 1);
      if (this.inp[r.inp] <= 0) delete this.inp[r.inp];
      this.outp[r.id] = (this.outp[r.id] || 0) + 1;
    }
  }
  giveItem(item) {
    if (item === 'coal') return false;
    for (const r of SMELTS)
      if (r.inp === item && (this.inp[item] || 0) < 25) { this.inp[item] = (this.inp[item] || 0) + 1; return true; }
    return false;
  }
  powerDemand() { return this.cur ? POWER_USE['electric-furnace'] : 0; }
}

// ===== 注册 =====
ENT_CLASSES['electric-furnace'] = ElectricFurnace;
