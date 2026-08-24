'use strict';

// ===== 电采矿机：免燃料、吃电力 =====
class ElectricDrill extends Drill {
  constructor(type, x, y) { super(type || 'electric-drill', x, y); }
  machMult() { return 0.5; } // 电采矿机 mining-speed 0.5（对齐《异星工厂》）
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
    this.spin += dt * 6;
    this.prog += dt * drillMult() * this.machMult() * powerFactor();
    if (this.prog >= DRILL_TIME) {
      this.prog -= DRILL_TIME;
      if (!G.settings.infiniteOre) consumeOre(o[0], o[1]);
      const mined = this.mineItem(o);
      this.bufItem = mined;
      this.buf++;
      this.tryOutput();
    }
  }
  giveItem(item) { return false; }
  powerDemand() { return (this.oreTile() && this.buf < 20) ? POWER_USE['electric-drill'] : 0; }
}

// ===== 注册 =====
ENT_CLASSES['electric-drill'] = ElectricDrill;
DEVICE_PLACE['electric-drill'] = DEVICE_PLACE['burner-drill'];
