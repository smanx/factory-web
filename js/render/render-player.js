'use strict';

// =============================================================
// 主角渲染：重工业风「探险工程师」
// 视觉语言与新版设备（储液罐/熔炉/组装机等）统一：渐变装甲、战术分割线、
// 钢灰配件、状态 LED。主色为高可视安全橙 + 钢灰，在场景中醒目但不突兀。
//
// 分层结构（自下而上）：
//   ① 地面柔和阴影            ② 脚步扬尘（行走时随步态交替淡出）
//   ③ 工装裤双腿 + 工靴高光    ④ 躯干装甲（安全橙渐变 + 拉链 + 呼吸LED + 腰带）
//   ⑤ 背面：装备网格背包       ⑥ 钢灰肩甲 + 双臂 + 深灰手套
//   ⑦ 采矿钢镐（指向目标挥动，挥峰尖端迸光）
//   ⑧ 头部：安全帽（盔壳渐变 + 顶脊高光 + 朝向盔沿）+ 脸（眼/嘴）
//   ⑨ 自动刀具反击刀光（保留）
//   ⑩ 受击红色脉冲    ⑪ 夜视护目镜绿光    ⑫ 能量护盾（蜂窝纹理）
// 动效：待机呼吸起伏、行走颠簸 + 扬尘、采矿挥镐、护盾脉动。
// =============================================================
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

  // ---- 朝向与步态 ----
  const step = Math.sin(p.walkT);                     // 行走步态相位
  const a = p.dir * Math.PI / 2;
  const cx = Math.cos(a), cy = Math.sin(a);           // 朝向单位向量
  const moving = Math.abs(step) > 0.05;
  const facingUp = p.dir === 3;                       // 背面视角（背包 + 后壳）
  const facingSide = (p.dir % 2 === 0);               // 侧面视角（躯干收窄）
  const mining = p.mining && p.mineProg > 0;
  // 行走颠簸（抬脚上跳）/ 待机呼吸（缓慢起伏）
  const bob = moving ? -Math.abs(step) * 1.7 : Math.sin(G.time * 2.2) * 0.5;
  ctx.lineCap = 'round';

  // ---- ① 地面阴影（柔和椭圆）----
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 10, 9.5, 4.2, 0, 0, 7);
  ctx.fill();

  // ---- ② 脚步扬尘：蹬地脚后方留一圈淡尘（随步态交替淡出）----
  if (moving) {
    for (const s of [-1, 1]) {
      const kick = Math.max(0, step * s);             // 该腿后蹬瞬间扬尘
      if (kick < 0.15) continue;
      ctx.fillStyle = 'rgba(190,180,160,' + (0.22 * kick).toFixed(3) + ')';
      ctx.beginPath();
      ctx.ellipse(p.x + s * (facingSide ? 0.8 : 2.6) - cx * 2.5, p.y + 9.5,
                  2.2 + 2 * kick, 1.6, 0, 0, 7);
      ctx.fill();
    }
  }

  // ---- ③ 双腿：深色工装裤 + 工靴（靴头高光）----
  for (const s of [-1, 1]) {
    const sw = moving ? step * s * 2.8 : 0;           // 前后摆动量
    const lx = p.x + s * (facingSide ? 1.7 : 2.3);
    const footX = lx + cx * sw, footY = p.y + 8.5 + Math.abs(sw) * 0.3;
    ctx.strokeStyle = '#3a4048';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(lx, p.y + 3);
    ctx.lineTo(footX, footY);
    ctx.stroke();
    // 工靴
    ctx.fillStyle = '#252a31';
    ctx.beginPath();
    ctx.ellipse(footX + cx * 0.7, footY + 0.8, 2.2, 1.8, 0, 0, 7);
    ctx.fill();
    // 靴头高光
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.beginPath();
    ctx.ellipse(footX + cx * 1.3 - 0.5, footY + 0.1, 1, 0.7, 0, 0, 7);
    ctx.fill();
  }

  // ---- ④ 躯干：安全橙装甲工装（对角渐变 + 战术细节）----
  const bx = p.x, by = p.y + bob - 2;
  const bw = facingSide ? 5.8 : 7.0;                  // 侧面收窄
  const bh = 7.3;
  const bodyGrad = ctx.createLinearGradient(bx - bw, by - bh, bx + bw * 0.6, by + bh);
  bodyGrad.addColorStop(0, '#f5943e');
  bodyGrad.addColorStop(0.5, '#d97b2f');
  bodyGrad.addColorStop(1, '#a0511a');
  ctx.fillStyle = bodyGrad;
  ctx.strokeStyle = '#6e3c14';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  if (ctx.roundRect) ctx.roundRect(bx - bw, by - bh, bw * 2, bh * 2, 3);
  else ctx.rect(bx - bw, by - bh, bw * 2, bh * 2);
  ctx.fill(); ctx.stroke();
  // 左上受光高光弧（贴躯干边缘）
  ctx.strokeStyle = 'rgba(255,220,170,0.32)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.ellipse(bx, by, bw - 1, bh - 1, 0, Math.PI * 1.06, Math.PI * 1.52);
  ctx.stroke();
  // 腰带（下缘深色横带 + 金属扣）
  ctx.fillStyle = 'rgba(46,30,14,0.85)';
  ctx.fillRect(bx - bw + 0.8, by + bh - 3.4, bw * 2 - 1.6, 2.2);
  ctx.fillStyle = '#c9ced6';
  ctx.fillRect(bx - 1.6, by + bh - 3.3, 3.2, 2);

  if (facingUp) {
    // ---- ⑤ 背面：装备网格背包（呼应装备系统）----
    const pw = 9.4, ph = 8.6;
    const px0 = bx - pw / 2, py0 = by - 1;
    ctx.fillStyle = '#454c58';
    ctx.strokeStyle = '#2b3140';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(px0, py0, pw, ph, 2.5);
    else ctx.rect(px0, py0, pw, ph);
    ctx.fill(); ctx.stroke();
    // 顶部提手
    ctx.strokeStyle = '#5c6472';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.moveTo(bx - 2.2, py0);
    ctx.quadraticCurveTo(bx, py0 - 2, bx + 2.2, py0);
    ctx.stroke();
    // 装备网格（3×3 分格）
    ctx.strokeStyle = 'rgba(120,130,148,0.7)';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    for (let i = 1; i <= 2; i++) {
      const gx2 = px0 + pw * i / 3;
      ctx.moveTo(gx2, py0 + 1); ctx.lineTo(gx2, py0 + ph - 1);
    }
    for (let j = 1; j <= 2; j++) {
      const gy2 = py0 + ph * j / 3;
      ctx.moveTo(px0 + 1, gy2); ctx.lineTo(px0 + pw - 1, gy2);
    }
    ctx.stroke();
    // 两侧卡扣
    ctx.fillStyle = '#8a919e';
    ctx.fillRect(px0 - 1, py0 + 1.5, 1.5, 3);
    ctx.fillRect(px0 + pw - 0.5, py0 + 1.5, 1.5, 3);
  } else {
    // 正面/侧面：胸前拉链中线 + 呼吸 LED
    ctx.strokeStyle = 'rgba(110,60,20,0.55)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(bx + cx * 0.8, by - bh + 2.4);
    ctx.lineTo(bx + cx * 0.8, by + bh - 5);
    ctx.stroke();
    // 呼吸 LED（胸口绿点脉动 + 内芯亮点）
    const ledP = 0.5 + 0.5 * Math.sin(G.time * 2.6);
    const ledX = bx + bw - 2.2, ledY = by - bh + 2.8;
    ctx.fillStyle = 'rgba(80,240,120,' + (0.3 + 0.4 * ledP).toFixed(2) + ')';
    ctx.beginPath();
    ctx.arc(ledX, ledY, 1.15, 0, 7);
    ctx.fill();
    ctx.fillStyle = 'rgba(170,255,195,0.95)';
    ctx.beginPath();
    ctx.arc(ledX, ledY, 0.5, 0, 7);
    ctx.fill();
  }

  // ---- ⑥ 钢灰肩甲 ×2 ----
  for (const s of [-1, 1]) {
    const sx2 = bx + s * (bw - 0.6), sy2 = by - bh + 1.4;
    ctx.fillStyle = '#59616e';
    ctx.strokeStyle = '#333944';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(sx2, sy2, 2.4, 2, 0, 0, 7);
    ctx.fill(); ctx.stroke();
    // 肩甲高光
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath();
    ctx.ellipse(sx2 - 0.5, sy2 - 0.6, 1.1, 0.8, 0, 0, 7);
    ctx.fill();
  }

  // ---- 挖掘目标方向（工具与手臂指向）----
  let mAng = null;
  if (mining) {
    const mk = p.mining.split(',');
    mAng = Math.atan2((+mk[1] + 0.5) * TILE - p.y, (+mk[0] + 0.5) * TILE - p.x);
  }
  const t = G.time * 12;

  // ---- ⑥b 双臂：袖筒 + 深灰手套（行走摆动 / 挖掘时朝目标握持）----
  const handPos = {};
  for (const s of [-1, 1]) {
    const shx = bx + s * (bw - 0.1), shy = by - bh + 2.6;   // 肩部
    let hx2, hy2;
    if (mining && mAng !== null) {
      // 挖掘：双手朝目标方向错开握持，随挥动往复
      const dirX = Math.cos(mAng), dirY = Math.sin(mAng);
      const perpX = -dirY, perpY = dirX;
      const sw2 = Math.sin(t + s * 0.6);
      hx2 = p.x + dirX * (4.2 + s * 1.3) + perpX * s * 1.6;
      hy2 = p.y - 2.5 + dirY * 2.6 + sw2 * 2.2 + perpY * s * 0.8;
    } else {
      const armSwing = moving ? step * s * 2 : 0;
      hx2 = shx + s * 0.3 + cx * armSwing * 0.7;
      hy2 = shy + 7.5 + armSwing * 0.4;
    }
    ctx.strokeStyle = '#c96e27';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(shx, shy);
    ctx.lineTo(hx2, hy2);
    ctx.stroke();
    // 手套
    ctx.fillStyle = '#454b56';
    ctx.strokeStyle = '#2a2f38';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.arc(hx2, hy2, 1.9, 0, 7);
    ctx.fill(); ctx.stroke();
    handPos[s] = [hx2, hy2];
  }

  // ---- ⑦ 采矿钢镐：从双手延伸指向目标，挥峰尖端迸光 ----
  if (mining && mAng !== null) {
    const gripX = (handPos[-1][0] + handPos[1][0]) / 2;
    const gripY = (handPos[-1][1] + handPos[1][1]) / 2;
    const toolA = mAng + Math.sin(t) * 0.32;          // 挥动角度微摆
    const tipX = p.x + Math.cos(toolA) * 13.5, tipY = p.y - 2.5 + Math.sin(toolA) * 9.5;
    // 钢柄
    ctx.strokeStyle = '#b8bec8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(gripX, gripY);
    ctx.lineTo(tipX, tipY);
    ctx.stroke();
    // 镐头（垂直于柄的短线）
    const pa = toolA + Math.PI / 2;
    ctx.strokeStyle = '#8f96a2';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(tipX - Math.cos(pa) * 2.6, tipY - Math.sin(pa) * 2.6);
    ctx.lineTo(tipX + Math.cos(pa) * 2.6, tipY + Math.sin(pa) * 2.6);
    ctx.stroke();
    // 挥动峰值时尖端迸光（小闪光）
    const flash = Math.max(0, Math.sin(t + 0.4));
    if (flash > 0.7) {
      const k = (flash - 0.7) / 0.3;
      ctx.fillStyle = 'rgba(255,240,190,' + (0.85 * k).toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(tipX, tipY, 2.4 * k + 0.8, 0, 7);
      ctx.fill();
    }
  }

  // ---- ⑧ 头部：安全帽 + 脸 ----
  const hx = p.x + cx * 0.8, hy = p.y + bob - 9;
  // 脸（先画在盔壳下层；背面视角不画脸）
  if (!facingUp) {
    ctx.fillStyle = '#ffdcae';
    ctx.strokeStyle = '#8a5a28';
    ctx.lineWidth = 1.1;
    ctx.beginPath();
    ctx.arc(hx, hy, 5.2, 0, 7);
    ctx.fill(); ctx.stroke();
  }
  // 盔壳（正面/侧面为上半圆；背面为完整后壳）
  const helGrad = ctx.createLinearGradient(hx - 5, hy - 7, hx + 5, hy + 2);
  helGrad.addColorStop(0, '#ffc44d');
  helGrad.addColorStop(1, '#e08a1e');
  ctx.fillStyle = facingUp ? '#e69524' : helGrad;
  ctx.strokeStyle = '#8a5210';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  if (facingUp) {
    ctx.arc(hx, hy, 5.7, 0, Math.PI * 2);
  } else {
    ctx.arc(hx, hy, 5.7, Math.PI, Math.PI * 2);
    ctx.closePath();
  }
  ctx.fill(); ctx.stroke();
  // 顶脊高光（壳面纵向亮条）
  ctx.strokeStyle = 'rgba(255,244,200,0.5)';
  ctx.lineWidth = 1.1;
  ctx.beginPath();
  ctx.moveTo(hx, hy - 5.2);
  ctx.lineTo(hx, hy - 1.8);
  ctx.stroke();
  // 盔沿：正面额头横檐 / 侧面朝前突出 / 背面后带（均在眼睛上方，不遮挡五官）
  if (facingSide) {
    // 侧面：帽檐朝移动方向突出（额头高度的月牙）
    ctx.fillStyle = '#d97e1f';
    ctx.strokeStyle = '#8a5210';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(hx + cx * 4.4, hy - 0.2, 2.2, 1.1, a, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  } else if (!facingUp) {
    // 正面：额头横檐（下弧带）
    ctx.fillStyle = '#d97e1f';
    ctx.strokeStyle = '#8a5210';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.ellipse(hx, hy - 0.2, 5.4, 1.5, 0, Math.PI * 0.12, Math.PI * 0.88);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
  } else {
    // 背面：后壳调节带
    ctx.strokeStyle = 'rgba(110,60,20,0.6)';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(hx - 3, hy + 1.5);
    ctx.quadraticCurveTo(hx, hy + 2.6, hx + 3, hy + 1.5);
    ctx.stroke();
  }

  if (!facingUp) {
    // ---- 眼睛：带高光；夜视装备时发绿光 ----
    const nightV = typeof hasNightVision === 'function' && hasNightVision();
    for (const s of [-1, 1]) {
      // 侧面时双眼靠拢偏前、略低；正面时分开、位于盔沿下方
      const ex = facingSide ? hx + cx * 2.2 + s * 0.9 : hx + s * 2.2;
      const ey = facingSide ? hy + 1.5 : hy + 2.3;
      if (nightV) {
        const gl = 0.55 + 0.45 * Math.sin(G.time * 5 + s);
        ctx.fillStyle = 'rgba(90,255,140,' + gl.toFixed(2) + ')';
        ctx.beginPath();
        ctx.arc(ex, ey, 1.5, 0, 7);
        ctx.fill();
      } else {
        ctx.fillStyle = '#2b2b2b';
        ctx.beginPath();
        ctx.arc(ex, ey, 1.15, 0, 7);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(ex - 0.35, ey - 0.35, 0.38, 0, 7);
        ctx.fill();
      }
    }
    // 嘴：微笑（侧面偏前、正面居中）
    ctx.strokeStyle = '#c96a4a';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    const mx = facingSide ? hx + cx * 3.4 : hx;
    const my = facingSide ? hy + 3.2 : hy + 3.6;
    ctx.arc(mx, my, 1.2, 0.3, Math.PI - 0.3);
    ctx.stroke();
  }

  // ---- ⑨ 自动刀具反击：近战虫贴身咬到主角时主角挥刀还击的动画 ----
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

  // ---- ⑩ 受击红色脉冲（受伤后 0.45 秒内全身泛红渐退）----
  const hurtT = G.time - (p.lastHurtT || -99);
  if (hurtT >= 0 && hurtT < 0.45) {
    const k = 1 - hurtT / 0.45;
    ctx.fillStyle = 'rgba(255,58,42,' + (0.38 * k).toFixed(3) + ')';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + bob - 4, 9.5, 12.5, 0, 0, 7);
    ctx.fill();
  }

  // ---- ⑪⑫ 能量护盾：淡蓝蜂窝护罩（对齐《异星工厂》Energy shield 视觉）----
  if (typeof totalShieldCapacity === 'function' && totalShieldCapacity() > 0) {
    const cap = totalShieldCapacity();
    const rem = (typeof shieldRemaining === 'function') ? shieldRemaining() : cap;
    if (rem > 0) {
      const pulse = 0.5 + 0.5 * Math.sin(G.time * 3);
      const r = 15 + pulse * 1.5;
      ctx.save();
      // 护罩底色：半透明淡蓝椭圆，随剩余护盾量淡化
      ctx.globalAlpha = 0.07 + 0.08 * (rem / cap);
      ctx.fillStyle = '#3ad0e0';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r, r * 1.05, 0, 0, 7);
      ctx.fill();
      // 轮廓 + 蜂窝纹理（所有六边形合并为一条路径，一次描边）
      ctx.globalAlpha = (0.3 + 0.25 * (rem / cap)) * (0.7 + 0.3 * pulse);
      ctx.strokeStyle = '#8af0ff';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, r, r * 1.05, 0, 0, 7);
      ctx.stroke();
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      const hexR = 3.4;
      const dxH = hexR * 1.732, dyH = hexR * 1.5;
      for (let row = -2; row <= 2; row++) {
        for (let col = -2; col <= 2; col++) {
          const ox = col * dxH + (row % 2 ? dxH * 0.5 : 0);
          const oy = row * dyH;
          if (ox * ox + oy * oy * 1.1 > r * r) continue;   // 椭圆护罩外跳过
          for (let k = 0; k < 6; k++) {
            const aa = Math.PI / 6 + k * Math.PI / 3;
            const vx = p.x + ox + Math.cos(aa) * hexR;
            const vy = p.y + oy + Math.sin(aa) * hexR;
            if (k === 0) ctx.moveTo(vx, vy); else ctx.lineTo(vx, vy);
          }
          ctx.closePath();
        }
      }
      ctx.stroke();
      ctx.restore();
    }
  }
}
