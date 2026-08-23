'use strict';

// ===== 抽油机：吃电力开采原油矿床 =====
class Pumpjack extends ElectricDrill {
  constructor(type, x, y) { super(type || 'pumpjack', x, y); }
  // 原油输出只从正面居中的那一个格子排出（一格一接口，对齐管道格子）
  frontTargets() {
    const c = Math.floor(this.w / 2);   // 3x3 居中格 = 1
    if (this.dir === 0) return [[this.x + this.w, this.y + c]];
    if (this.dir === 2) return [[this.x - 1, this.y + c]];
    if (this.dir === 1) return [[this.x + c, this.y + this.h]];
    return [[this.x + c, this.y - 1]];
  }
  machMult() { return oilMult(); }
  oreTile() {
    for (let dy = 0; dy < this.h; dy++)
      for (let dx = 0; dx < this.w; dx++) {
        const tx = this.x + dx, ty = this.y + dy;
        if (getOreType(tx, ty) === ORE_OIL && getOreAmt(tx, ty) > 0) return [tx, ty];
      }
    return null;
  }
  mineItem() { return 'crude-oil'; }
  powerDemand() { return (this.oreTile() && this.buf < 20) ? POWER_USE['pumpjack'] : 0; }
}

// ===== 注册 =====
ENT_CLASSES['pumpjack'] = Pumpjack;
// 放置规则：脚印范围内必须压到原油矿床
DEVICE_PLACE['pumpjack'] = (type, tx, ty, dir, ew, eh) => {
  let hasOil = false;
  for (let dy = 0; dy < eh && !hasOil; dy++)
    for (let dx = 0; dx < ew && !hasOil; dx++) {
      if (getOreType(tx + dx, ty + dy) === ORE_OIL && getOreAmt(tx + dx, ty + dy) > 0) hasOil = true;
    }
  return hasOil ? null : { ok: false };
};
