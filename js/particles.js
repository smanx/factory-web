'use strict';
// =============================================================
// 轻量工业粒子系统（画面优化）
// 零依赖，全局单例 G.particles 存储粒子数组。
// 提供三类基础粒子：烟尘 smoke（缓慢上飘渐隐）、火花 spark（短促直线飞溅）、
// 蒸汽 steam（水汽缓慢上飘扩张）。供熔炉/采矿机/化工厂/核反应堆/火箭等
// 生产设备在工作时冒烟/迸火花，增强工业氛围与画面表现。
// 粒子量极低（每设备低频生成、生命周期短），对性能影响可忽略。
// =============================================================

// 粒子对象：{ x,y,vx,vy,life,life0,size,type,color,rot,vr }
function ensureParticles() {
  if (!G.particles) G.particles = [];
  return G.particles;
}

// 通用生成接口：type = 'smoke'|'spark'|'steam'
function spawnParticle(type, wx, wy, opts) {
  const arr = ensureParticles();
  const p = {
    type,
    x: wx, y: wy,
    life: 0,
    life0: (opts && opts.life) || 1.0,
    size: (opts && opts.size) || 3,
    vx: (opts && opts.vx) || 0,
    vy: (opts && opts.vy) || 0,
    color: (opts && opts.color) || null,
    rot: Math.random() * 6.28,
    vr: (opts && opts.vr) || 0,
    grav: (opts && opts.grav) || 0
  };
  if (arr.length > 400) arr.shift();   // 上限防爆量
  arr.push(p);
}

// 烟尘：缓慢上飘并渐隐（用于熔炉/燃烧设备工作排烟）
function spawnSmoke(wx, wy, opts) {
  spawnParticle('smoke', wx, wy, {
    life: (opts && opts.life) || 1.4,
    size: (opts && opts.size) || 5,
    vx: (Math.random() - 0.5) * 0.4,
    vy: -(0.4 + Math.random() * 0.4),
    color: (opts && opts.color) || '#9a9aa0',
    vr: (Math.random() - 0.5) * 2
  });
}

// 火花：短促斜向飞溅并受重力（用于熔炉/采矿机工作迸火星）
function spawnSpark(wx, wy, opts) {
  const a = Math.random() * Math.PI * 2;
  const sp = (opts && opts.speed) || (2 + Math.random() * 3);
  spawnParticle('spark', wx, wy, {
    life: (opts && opts.life) || 0.5,
    size: (opts && opts.size) || 1.5,
    vx: Math.cos(a) * sp,
    vy: Math.sin(a) * sp - 0.5,
    color: (opts && opts.color) || '#ffd27a',
    grav: 6
  });
}

// 蒸汽：水汽缓慢上飘并扩张变淡（用于化工厂/核能/锅炉）
function spawnSteam(wx, wy, opts) {
  spawnParticle('steam', wx, wy, {
    life: (opts && opts.life) || 1.8,
    size: (opts && opts.size) || 4,
    vx: (Math.random() - 0.5) * 0.3,
    vy: -(0.3 + Math.random() * 0.3),
    color: (opts && opts.color) || '#cfdde8',
    vr: (Math.random() - 0.5) * 1.5
  });
}

// 每帧更新粒子
function updateParticles(dt) {
  const arr = G.particles;
  if (!arr || !arr.length) return;
  // 原地压缩：避免对已消亡粒子反复 splice 造成元素移动（对齐分支 compactFilter 优化方向）
  let j = 0;
  for (let i = 0; i < arr.length; i++) {
    const p = arr[i];
    p.life += dt;
    if (p.life >= p.life0) continue;              // 淘汰
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.grav) p.vy += p.grav * dt;
    p.rot += (p.vr || 0) * dt;
    if (p.type === 'smoke') p.size += dt * 1.5;
    else if (p.type === 'steam') p.size += dt * 3;
    arr[j++] = p;
  }
  if (j < arr.length) arr.length = j;             // 截断，回收槽位
}

// 每帧渲染粒子（在世界坐标层调用，传入已变换的 ctx）
function drawParticles(ctx) {
  const arr = G.particles;
  if (!arr || !arr.length) return;
  for (const p of arr) {
    const t = p.life / p.life0;
    const a = 1 - t;
    if (a <= 0.02) continue;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.color || '#fff';
    if (p.type === 'spark') {
      // 火花：带运动方向的小短线
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(p.vy, p.vx));
      ctx.fillRect(-p.size, -p.size * 0.4, p.size * 2, p.size * 0.8);
      ctx.restore();
    } else {
      // 烟尘/蒸汽：半透明圆，随生命周期放大变淡
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}
