'use strict';

function drawPlayer(ctx) {
  const p = G.player;
  // 载具驾驶中：不绘制玩家角色本体（载具已绘制），仅显示头顶驾驶员轮廓提示
  if (p.inVehicle && G.driving && G.driving.ent) {
    const bob = Math.sin(G.time * 4) * 1;
    ctx.fillStyle = '#2a2620';
    ctx.beginPath();
    ctx.arc(p.x, p.y + 6 + bob, 5, 0, 7); ctx.fill();
    ctx.fillStyle = '#ffe0b0';
    ctx.beginPath();
    ctx.arc(p.x, p.y + 4 + bob, 2.4, 0, 7); ctx.fill();
    return;
  }
  // 地面阴影
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 10, 9, 4, 0, 0, 7);
  ctx.fill();

  const bob = Math.sin(p.walkT) * 1.5;
  const step = Math.sin(p.walkT);                     // 行走步态相位
  const a = p.dir * Math.PI / 2;
  const cx = Math.cos(a), cy = Math.sin(a);           // 朝向单位向量
  const moving = Math.abs(step) > 0.05;
  const facingUp = p.dir === 3;                        // 朝上 = 背面视角（后脑勺+后背）
  ctx.lineCap = 'round';

  // ---- 双腿：行走时交替前后摆动 ----
  ctx.lineWidth = 3.2;
  for (const s of [-1, 1]) {
    const sw = moving ? step * s * 2.6 : 0;
    ctx.strokeStyle = '#4d3318';
    ctx.beginPath();
    ctx.moveTo(p.x + s * 2.3, p.y + 3);
    ctx.lineTo(p.x + s * 2.3 + cx * sw, p.y + 8 + Math.abs(sw) * 0.35);
    ctx.stroke();
  }

  // ---- 身体：橙色工装上衣（圆角躯干 + 腰带）----
  const bx = p.x, by = p.y + bob - 2;
  ctx.fillStyle = '#d97b2f';
  ctx.strokeStyle = '#7c431a';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.ellipse(bx, by, 6.8, 7.2, 0, 0, 7);
  ctx.fill(); ctx.stroke();
  // 腰带
  ctx.strokeStyle = '#5a3515';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.ellipse(bx, by + 4, 5.8, 2.2, 0, 0, 7);
  ctx.stroke();
  if (facingUp) {
    // 后背：背部中缝线（替代胸前扣子）
    ctx.strokeStyle = '#5a3515';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(bx, by - 4.5);
    ctx.lineTo(bx, by + 2.5);
    ctx.stroke();
  } else {
    // 胸前扣子
    ctx.fillStyle = '#5a3515';
    ctx.beginPath();
    ctx.arc(bx, by - 1, 0.9, 0, 7);
    ctx.fill();
  }

  // ---- 双臂：两侧自然垂放，行走/采矿时摆动 ----
  const mining = p.mining && p.mineProg > 0;
  const t = G.time * 12;
  ctx.lineWidth = 3;
  for (const s of [-1, 1]) {
    const armSwing = mining ? Math.sin(t + s * 0.7) * 2 : (moving ? step * s * 1.8 : 0);
    ctx.strokeStyle = '#d97b2f';
    ctx.beginPath();
    ctx.moveTo(bx + s * 3.8, by - 1);
    ctx.lineTo(bx + s * 4.2 + cx * armSwing * 0.6, by + 5 + armSwing * 0.8);
    ctx.stroke();
  }

  // ---- 自动刀具反击：近战虫贴身咬到主角时主角挥刀还击的动画 ----
  // counterT>0 时，向 counterDir 方向快速挥出一记刀光（从举起到劈落），附带金属刀身。
  if ((p.counterT || 0) > 0) {
    const prog = 1 - Math.min(1, p.counterT / 0.34);        // 0→1 挥刀进度
    const ca = p.counterDir;                                 // 攻击方向（弧度）
    const a0 = ca - 1.0, a1 = ca + 1.0;                      // 起手 → 收势角度
    const ang = a0 + (a1 - a0) * Math.min(1, prog * 1.4);    // 刀身当前角度
    const rBase = 5, rTip = 15;                              // 刀柄到刀尖的半径
    const hx2 = p.x + Math.cos(ca) * 2, hy2 = p.y + Math.sin(ca) * 2 - 3;  // 挥刀支点（身前）
    // 刀光残影（挥刀弧线）
    ctx.strokeStyle = 'rgba(230,240,255,0.35)';
    ctx.lineWidth = 3.2;
    ctx.lineCap = 'round';
    ctx.beginPath();
    for (let k = 0; k <= 8; k++) {
      const aa = a0 + (a1 - a0) * k / 8 * Math.min(1, prog * 1.4);
      const rr = rBase + (rTip - rBase) * k / 8;
      const px2 = hx2 + Math.cos(aa) * rr, py2 = hy2 + Math.sin(aa) * rr;
      if (k === 0) ctx.moveTo(px2, py2); else ctx.lineTo(px2, py2);
    }
    ctx.stroke();
    // 金属刀身：从支点向刀尖延伸的亮银色刀刃
    const tipX = hx2 + Math.cos(ang) * rTip, tipY = hy2 + Math.sin(ang) * rTip;
    ctx.strokeStyle = '#e8f0ff';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(hx2 + Math.cos(ang) * rBase, hy2 + Math.sin(ang) * rBase);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    // 刀刃高光
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hx2 + Math.cos(ang) * (rBase + 1), hy2 + Math.sin(ang) * (rBase + 1));
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
  }

  // ---- 头部：肤色圆，朝移动方向偏移 ----
  const hx = p.x, hy = p.y + bob - 9;
  ctx.fillStyle = '#ffe0b0';   // 更显年轻的亮肤色
  ctx.strokeStyle = '#7c431a';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(hx, hy, 5.6, 0, 7);
  ctx.fill(); ctx.stroke();

  if (facingUp) {
    // ---- 背面视角：显示完整后脑勺（头发覆盖整个头部，不画眼睛和嘴）----
    ctx.fillStyle = '#5a3a22';   // 深棕发色
    ctx.strokeStyle = '#3c2413';
    ctx.lineWidth = 0.8;
    // 后脑勺：整圆头发覆盖头部后面
    ctx.beginPath();
    ctx.arc(hx, hy, 5.7, 0, 7);
    ctx.fill(); ctx.stroke();
    // 后脑勺发旋/发丝质感
    ctx.strokeStyle = '#3c2413';
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(hx, hy - 2);
    ctx.lineTo(hx, hy + 2);
    ctx.stroke();
  } else {
    // 头发：深棕短发（年轻人发型，取代安全帽）
    ctx.fillStyle = '#5a3a22';   // 深棕发色
    ctx.strokeStyle = '#3c2413';
    ctx.lineWidth = 0.8;
    // 头顶短发（后脑勺弧线 + 头顶略蓬松）
    ctx.beginPath();
    ctx.arc(hx, hy - 1.8, 5.0, Math.PI, 0);   // 头顶发际线（上半圆）
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // ---- 眼睛：朝向移动方向，始终水平排列（正面分开、侧面靠拢）带高光显精神 ----
    ctx.fillStyle = '#2b2b2b';
    const eyeSpread = Math.abs(cy) < 0.5 ? 1.5 : 2.4;   // 侧面时靠拢、正面时分开
    for (const s of [-1, 1]) {
      const ex = hx + cx * 1.6 + s * eyeSpread;
      const ey = hy + cy * 1.8;
      ctx.beginPath();
      ctx.arc(ex, ey, 1.2, 0, 7);
      ctx.fill();
      // 眼睛高光
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(ex - 0.4, ey - 0.4, 0.4, 0, 7);
      ctx.fill();
      ctx.fillStyle = '#2b2b2b';
    }

    // ---- 嘴：年轻微笑 ----
    ctx.strokeStyle = '#c96a4a';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    const mx = hx + cx * 3.2, my = hy + cy * 3.2;
    ctx.arc(mx, my, 1.3, 0.3, Math.PI - 0.3);
    ctx.stroke();
  }

  // ---- 能量护盾：受击/激活时在玩家周身绘出淡蓝能量护罩（对齐《异星工厂》Energy shield 视觉）----
  if (typeof totalShieldCapacity === 'function' && totalShieldCapacity() > 0) {
    const cap = totalShieldCapacity();
    const rem = (typeof shieldRemaining === 'function') ? shieldRemaining() : cap;
    if (rem > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(G.time * 3);
      const r = 15 + pulse * 1.5;
      ctx.save();
      // 护盾护罩：半透明淡蓝椭圆，随剩余护盾量淡化
      ctx.globalAlpha = 0.10 + 0.10 * (rem / cap);
      ctx.fillStyle = '#3ad0e0';
      ctx.strokeStyle = '#8af0ff';
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r, r * 1.05, 0, 0, 7);
      ctx.fill(); ctx.stroke();
      ctx.restore();
    }
  }
}

