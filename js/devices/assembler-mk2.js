'use strict';

// ===== 组装机 II：吃电力、速度更高的高级组装机 =====
class AssemblerMK2 extends Assembler {
  constructor(type, x, y) { super('assembling-machine-mk2', x, y); }
  update(dt) {
    this.portFlow();
    if (!this.recipe) { this.crafting = false; return; }
    if (G.power.sat <= 0) { this.crafting = false; return; }
    const rec = RECIPES[this.recipe];
    if (this.crafting) {
      this.prog += dt * asmMult() * 0.75 * (G.power.sat < 1 ? G.power.sat : 1);
      this.spin += dt * 4;
      if (this.prog >= rec.time) {
        for (const k in rec.out) this.outp[k] = (this.outp[k] || 0) + rec.out[k];
        this.crafting = false;
        this.prog = 0;
      }
      return;
    }
    for (const k in rec.inp) if ((this.inp[k] || 0) < rec.inp[k]) return;
    for (const k in rec.out) if ((this.outp[k] || 0) + rec.out[k] > 50) return;
    for (const k in rec.inp) {
      this.inp[k] -= rec.inp[k];
      if (this.inp[k] <= 0) delete this.inp[k];
    }
    this.crafting = true;
    this.prog = 0;
  }
  powerDemand() { return this.recipe ? POWER_USE['assembling-machine-mk2'] : 0; }
}

// ===== 注册 =====
ENT_CLASSES['assembling-machine-mk2'] = AssemblerMK2;
