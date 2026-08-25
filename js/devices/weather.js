'use strict';

// ===== 天气系统（对齐《异星工厂》：动态云层 + 昼夜光照氛围）=====
// 本项目原本只有固定的昼夜明暗，本次新增一套低开销的动态云层系统：
//  - 云朵在世界中缓慢漂移，白天在天空投射淡淡的云影，使光照/太阳能有轻微起伏
//  - 偶发"阴云"天气：整体光照略微下降、天空更显阴沉（雨后/清晨氛围）
//  - 全部为屏幕覆盖层 + 增量更新，不写回离屏地形缓存，不影响分块缓存复用
//  - 设置面板可开关"天气"特效（默认开启），关闭后彻底不绘制、不参与光照计算

// 天气状态（挂在全局 G.weather）
//  - clouds: 云朵数组 [{x, y, s(尺度), a(相位), sp(速度)}]，坐标为"相机相对世界"的屏幕偏移系数
//  - overcast: 0~1，当前阴云程度（影响光照与天空色调）
//  - seed: 世界种子，用于确定性云布局
const WEATHER_SETTINGS_KEY = 'factory-weather';

function weatherEnabled() {
  return !(G.settings && G.settings.weather === false);
}

// 初始化天气（新游戏/读档时调用，保持云布局确定性）
function initWeather() {
  if (G.weather && G.weather.seed === G.world.seed && G.weather.clouds) return;
  const seed = G.world.seed || 0;
  const rng = mulberry32((seed ^ 0x9e3779b9) >>> 0);
  const clouds = [];
  const N = 6; // 云朵数量（低，保证低开销）
  for (let i = 0; i < N; i++) {
    clouds.push({
      x: rng(),                    // 0~1 归一化横坐标
      y: 0.12 + rng() * 0.5,       // 云层偏上（地平线上方）
      s: 0.6 + rng() * 0.8,        // 尺度（越大云越宽）
      a: rng() * Math.PI * 2,      // 相位
      sp: 0.0008 + rng() * 0.0012  // 漂移速度
    });
  }
  G.weather = { clouds, overcast: 0, seed, t: 0 };
}

// 天气更新：推进云漂移与阴云变化（dt 秒）
function updateWeather(dt) {
  if (!weatherEnabled()) return;
  if (!G.weather) initWeather();
  const w = G.weather;
  w.t += dt;
  // 云层缓慢漂移
  for (const c of w.clouds) {
    c.x += c.sp * dt;
    if (c.x > 1.25) c.x -= 1.5;   // 循环
  }
  // 阴云程度：缓慢随机游走（长时间晴好，偶尔转阴）
  if (!w._ocT) w._ocT = 0;
  w._ocT -= dt;
  if (w._ocT <= 0) {
    w._ocT = 12 + Math.random() * 20;   // 每 12~32 秒重新评估一次
    const target = Math.random() < 0.72 ? 0 : 0.35 + Math.random() * 0.5;  // 多晴少阴
    w._ocTarget = target;
  }
  // 平滑逼近目标
  const diff = (w._ocTarget || 0) - w.overcast;
  w.overcast += Math.sign(diff) * Math.min(Math.abs(diff), dt * 0.12);
  w.overcast = Math.max(0, Math.min(1, w.overcast));
}

// 云量因子：0~1，衡量当前天空被云遮蔽的程度（叠加阴云后）
function cloudFactor() {
  if (!weatherEnabled() || !G.weather) return 0;
  let f = G.weather.overcast;
  // 云朵自身也贡献遮蔽：取视口内云朵密度的近似（用归一化位置与阴云叠加，避免逐云判定）
  if (G.weather.clouds) f += G.weather.clouds.reduce((s, c) => s + (1 - Math.abs(c.x - 0.5)), 0) / G.weather.clouds.length * 0.08;
  return Math.min(1, f);
}

// 天气对光照的影响：返回 0~1 的减弱系数（1 = 无减弱）。白天被云遮挡时太阳能/光照略降。
function weatherLightMult() {
  if (!weatherEnabled() || !G.weather) return 1;
  const f = cloudFactor();
  // 阴云最多使光照降低约 22%，云影再叠加轻微起伏
  return 1 - f * 0.22;
}

// 天气对太阳能的减弱（作用于 solarFactor 的乘数，已含在 weatherLightMult 内，此处供太阳能调用）
function weatherSolarMult() { return weatherLightMult(); }

// ===== 绘制：在相机变换之后、覆盖到整个屏幕的云影层 =====
// 云层以屏幕空间绘制（相对相机恒定，只随时间漂移），绘制在黑暗遮罩之后、小地图之前，
// 让云影叠加在游戏画面上，形成"天空飘云、光影流动"的氛围。低开销：每帧仅 ~6 个椭圆。
function drawWeatherOverlay(ctx, W, H) {
  if (!weatherEnabled() || !G.weather || !G.weather.clouds) return;
  const w = G.weather;
  const z = (G.cam && G.cam.z) || 1;
  // 云层只在白天明显可见（夜间融入黑暗），用太阳高度决定云的不透明度
  const sun = solarFactor(); // 0~1
  const baseA = 0.05 + sun * 0.13;   // 云不透明度随日照增强
  if (baseA <= 0.01 && w.overcast <= 0.02) return;
  ctx.save();
  ctx.globalCompositeOperation = 'source-over';
  // 云朵：多个柔和椭圆拼合成"云团"
  for (const c of w.clouds) {
    const cx = ((c.x * 1.5 - 0.25) % 1 + 1) % 1 * W;   // 横跨屏幕
    const cy = c.y * H;
    const wpx = c.s * 220 * (z < 1 ? 1 : 1 / Math.max(1, z * 0.7));  // 缩放时云适当跟随
    const alpha = baseA * (0.6 + 0.4 * Math.sin(c.a + w.t * 0.05));
    if (alpha <= 0.01) continue;
    // 主团 + 两个子团
    ctx.fillStyle = 'rgba(255,255,255,' + (alpha * 0.5).toFixed(3) + ')';
    ctx.beginPath();
    ctx.ellipse(cx, cy, wpx * 1.1, wpx * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx - wpx * 0.7, cy + wpx * 0.08, wpx * 0.6, wpx * 0.3, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(cx + wpx * 0.7, cy - wpx * 0.04, wpx * 0.5, wpx * 0.26, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  // 阴云天气：整体加一层淡淡灰蓝，增强阴沉氛围
  if (w.overcast > 0.02) {
    ctx.fillStyle = 'rgba(150,155,165,' + (w.overcast * 0.12).toFixed(3) + ')';
    ctx.fillRect(0, 0, W, H);
  }
  ctx.restore();
}
