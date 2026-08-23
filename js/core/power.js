'use strict';

// 全局共享电力模型：每 0.25s 复算。产出 = 运行中蒸汽机的 powerOut 之和，
// 需求 = 各用电设备 powerDemand()（在各自设备文件里定义，闲置时返回 0）之和，
// sat = min(1, prod/demand)，各机器按 sat 比例降速；sat=0 全图"缺电"停摆。
function updatePower() {
  let prod = 0, demand = 0;
  for (const e of G.ents) {
    prod += e.powerOut || 0;
    if (e.powerDemand) demand += e.powerDemand();
  }
  G.power.prod = prod;
  G.power.demand = demand;
  G.power.sat = demand <= 0 ? 1 : Math.min(1, prod / demand);
}
