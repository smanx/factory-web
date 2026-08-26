'use strict';

// ===== 抽油机：吃电力开采原油矿床（对齐《异星工厂》：油井产量随抽取递减） =====
// 产量因子 yieldFactor 随每次抽取递减（从 1.0 降到最低 PUMPJACK_MIN_YIELD），
// 越抽越慢，模拟油井枯竭；生产速度 = 基础速度 10 × 产量因子。
const PUMPJACK_MIN_YIELD = 0.2;        // 最低产量因子（对齐《异星工厂》：降到原始值 20% 后不再下降）
const PUMPJACK_YIELD_DECAY = 0.005;    // 每次抽取递减量（每产 1 桶油递减 0.005，产 160 桶后降到 20%）
const PUMPJACK_BASE_RATE = 10;         // 抽油机基础速度（原油/秒）：油井产量 100% 时 = 10 原油/秒（默认原为 1）

class Pumpjack extends ElectricDrill {
  constructor(type, x, y) { super(type || 'pumpjack', x, y); this.yieldFactor = 1; }
  // 模块槽位数（对齐《异星工厂》官方 module_slots：抽油机 2 槽）
  moduleSlotCount() { return GAME_DATA.deviceStats?.[this.type]?.moduleSlots ?? 2; }
  // 原油输出只从正面右侧角落的那一个格子排出（一格一接口，对齐管道格子）
  // 从正中改为角落，便于把油管从设备角落接出
  frontTargets() {
    if (this.dir === 0) return [[this.x + this.w, this.y + this.h - 1]]; // 东：右下角
    if (this.dir === 2) return [[this.x - 1, this.y]];                    // 西：左上角
    if (this.dir === 1) return [[this.x, this.y + this.h]];               // 南：左下角
    return [[this.x + this.w - 1, this.y - 1]];                           // 北：右上角
  }
  // 产量因子随抽取递减：yieldFactor 越低，抽取越慢（对齐《异星工厂》油井产量递减）。
  // 生产速度 = 基础速度 10 × 原油井产量因子 × 油井出产率：
  // 出产率 100%（yieldFactor=1）时 = 10 原油/秒，产量减至 20% 时 = 2 原油/秒；
  // 若油井出产率 200% 则 = 20 原油/秒（随油井出产率线性缩放）。
  machMult() {
    if (this.yieldFactor === undefined) this.yieldFactor = 1;
    // 油井出产率：旧档/未存出产率的油井默认 100%
    const o = this.oreTile();
    const rate = o ? getOilRate(o[0], o[1]) : 1;
    return this.yieldFactor * PUMPJACK_BASE_RATE * rate;
  }
  oreTile() {
    for (let dy = 0; dy < this.h; dy++)
      for (let dx = 0; dx < this.w; dx++) {
        const tx = this.x + dx, ty = this.y + dy;
        if (getOreType(tx, ty) === ORE_OIL && getOreAmt(tx, ty) > 0) return [tx, ty];
      }
    return null;
  }
  mineItem() {
    // 每抽出一桶原油，产量因子递减（不低于最低值），模拟油井枯竭
    if (this.yieldFactor === undefined) this.yieldFactor = 1;
    if (this.yieldFactor > PUMPJACK_MIN_YIELD) {
      this.yieldFactor = Math.max(PUMPJACK_MIN_YIELD, this.yieldFactor - PUMPJACK_YIELD_DECAY);
    }
    return 'crude-oil';
  }
  powerDemand() { return (this.oreTile() && this.buf < DRILL_BUFFER_CAP) ? POWER_USE['pumpjack'] * this.modulePowerFactor() : 0; }
  serialize() {
    const s = super.serialize();
    if (this.yieldFactor !== undefined && this.yieldFactor < 1) s.yield = Math.round(this.yieldFactor * 100) / 100;
    return s;
  }
  static restore(s) {
    const e = super.restore(s);
    if (typeof s.yield === 'number' && s.yield > 0) e.yieldFactor = Math.max(PUMPJACK_MIN_YIELD, Math.min(1, s.yield));
    return e;
  }
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
