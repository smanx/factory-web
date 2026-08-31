'use strict';

// ===== 组装机 II：吃电力、速度更高的高级组装机 =====
class AssemblerMK2 extends Assembler {
  constructor(type, x, y) { super('assembling-machine-2', x, y); }
  // 组装机 II 基础速度 0.75（覆盖基类 0.5 兜底）
  craftProgRate() {
    const qMult = (typeof qualityMult === 'function' && this.quality) ? qualityMult(this.quality) : 1;
    return asmMult() * (GAME_DATA.deviceStats?.[this.type]?.craftingSpeed ?? 0.75) * this.moduleSpeedMult() * powerFactor(this) * qMult;
  }
  update(dt) {
    this.portFlow();
    if (!this.recipe) { this.crafting = false; return; }
    if (powerSatOf(this) <= 0) { this.crafting = false; return; }
    const rec = RECIPES[this.recipe];
    if (this.crafting) {
      this.prog += dt * this.craftProgRate();
      this.spin += dt * 4;
      if (this.prog >= rec.time) {
        for (const k in rec.out) {
          emitQuality(this, this.outp, k, rec.out[k]);
          if (typeof trackProd === 'function') trackProd(k, rec.out[k]);
        }
        this.applyProductivity(rec);
        // 物品产能无限科技：对主产物累积额外产出（对齐《异星工厂》*-productivity）
        {
          const mainOut = Object.keys(rec.out)[0];
          if (mainOut && typeof applyTechProductivity === 'function') {
            const extra = applyTechProductivity(this, mainOut, rec.out[mainOut]);
            if (extra > 0) { this.outp[mainOut] = (this.outp[mainOut] || 0) + extra; if (typeof trackProd === 'function') trackProd(mainOut, extra); }
          }
        }
        this.crafting = false;
        this.prog = 0;
      }
      return;
    }
    for (const k in rec.inp) if ((this.inp[k] || 0) < rec.inp[k]) return;
    // 产物堆积即停工（动态「够用」：存量足够再产 2 次即停，防止原料积压在前端机器）
    if (outputBacklogged(this.outp, rec.out)) return;
    for (const k in rec.inp) {
      this.inp[k] -= rec.inp[k];
      if (typeof trackProd === 'function') trackProd(k, -rec.inp[k]);
      if (this.inp[k] <= 0) delete this.inp[k];
    }
    this.crafting = true;
    this.prog = 0;
  }
  powerDemand() { return this.recipe ? POWER_USE['assembling-machine-2'] : 0; }
}

// ===== 注册 =====
ENT_CLASSES['assembling-machine-2'] = AssemblerMK2;
