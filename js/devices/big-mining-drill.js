'use strict';

// ===== 大型采矿机：太空时代大范围采矿建筑（对齐《异星工厂》Space Age Big mining drill）=====
// 数据（占地/血量/功耗/采矿速度/模块槽）全部来自 GAME_DATA（由 factorio-data 生成）：
//   官方 mining-drill / big-mining-drill：mining_speed=2.5、module_slots=4、max_health=300、
//   energy_usage=300kW、selection_box ±2.35 → 占地 5×5。
// 功能：比电采矿机（3×3、0.5）采矿范围更大（5×5）、速度更快（2.5），可开采更坚硬矿石。
// 配方官方依赖熔融铁/钨碳化物（Vulcanus 行星资源），项目暂无行星系统，故适配为基础资源合成。

class BigDrill extends ElectricDrill {
  constructor(type, x, y) {
    super('big-mining-drill', x, y);
  }
  // 模块槽位：官方 module_slots=4（GAME_DATA.deviceStats）
  moduleSlotCount() { return GAME_DATA.deviceStats?.[this.type]?.moduleSlots ?? 4; }
  // 功耗：官方 energy_usage 300kW（POWER_USE 由 GAME_DATA.powerUse 桥接）
  powerDemand() {
    return (this.oreTile() && this.buf < DRILL_BUFFER_CAP) ? POWER_USE['big-mining-drill'] * this.modulePowerFactor() : 0;
  }
}

// ===== 渲染：复用采矿机绘制（drawDrill 按 e.w/e.h 自适应占地），电采矿机同款配色 =====
// 大型采矿机用更深的电矿机配色以区分档位
function drawBigDrill(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w, sh = TILE * e.h;
  const bodyC = '#2c4a78', bodyC2 = '#3d6aa8', lineC = '#1a2f50';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = bodyC;
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 8);
  ctx.fill();
  ctx.strokeStyle = lineC;
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, s - 6, sh - 6, 8);
  ctx.stroke();
  ctx.fillStyle = bodyC2;
  rr(ctx, px + 10, py + 10, s - 20, sh - 20, 5);
  ctx.fill();
  const cx = px + s / 2, cy = py + sh / 2 - 4;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(e.spin || 0);
  ctx.fillStyle = e.working ? '#c9d2dc' : '#7d8894';
  gearShape(ctx, 0, 0, 16, 10, 8);
  ctx.restore();
  // 钻头（沿朝向）
  ctx.fillStyle = e.working ? '#8fa3bc' : '#5a6b80';
  const drillW = Math.max(8, s * 0.18);
  const drillL = Math.max(10, sh * 0.22);
  if (dir === 0) ctx.fillRect(cx - drillW / 2, py + sh - 8, drillW, drillL);
  else if (dir === 2) ctx.fillRect(cx - drillW / 2, py - drillL + 8, drillW, drillL);
  else if (dir === 1) ctx.fillRect(px + s - 8, cy - drillW / 2, drillL, drillW);
  else ctx.fillRect(px - drillL + 8, cy - drillW / 2, drillL, drillW);
  // 电力/模块指示
  if (e.modules && Object.keys(e.modules).length) drawRecipeIconCell(ctx, px + s - 16, py + 16, Object.keys(e.modules)[0]);
  if (portDetailsVisible() && e.recipe === undefined && (e.working || e.oreTile())) {
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = alpha * 0.85;
    drawRecipeIconCell(ctx, px + s / 2, py + 8, 'big-mining-drill');
  }
  ctx.globalAlpha = 1;
}

// ===== 注册 =====
ENT_CLASSES['big-mining-drill'] = BigDrill;
DEVICE_RENDER['big-mining-drill'] = drawBigDrill;
DEVICE_STATUS['big-mining-drill'] = electricDrillStatus;
DEVICE_PANEL['big-mining-drill'] = electricDrillPanel;
DEVICE_PLACE['big-mining-drill'] = DEVICE_PLACE['burner-mining-drill'];
DEVICE_DIR_ROTATE['big-mining-drill'] = true;
