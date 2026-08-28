'use strict';

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function hash2(x, y) {
  let h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

const T_GRASS = 0;
const T_WATER = 1;
const T_CONCRETE = 2;   // 混凝土（玩家行走加速）
const T_PATH = 3;       // 石砖路（玩家行走加速）
const T_TREE = 4;       // 树木（可砍伐获得木材）
const T_REF_CONCRETE = 5; // 精炼混凝土（玩家行走加速更快，对齐《异星工厂》Refined concrete）
const T_HAZARD = 6;       // 警示混凝土（黑黄条纹装饰，行走加速同普通混凝土，对齐《异星工厂》Hazard concrete）
const T_REF_HAZARD = 8;   // 精炼警示混凝土（精炼混凝土底+警示条纹，行走加速更快，对齐官方 Refined hazard concrete）
const T_CLIFF = 7;          // 峭壁（对齐《异星工厂》Cliff）：不可通行、不可建造的地形障碍，可用峭壁炸药清除
const T_YUMAKO_SOIL = 8;      // 人工雅玛果土壤（太空时代 Gleba 农业）：人工填造的种植土壤，可走行
const T_OVERGROWTH_YUMAKO_SOIL = 9; // 茂盛雅玛果土壤（太空时代 Gleba 农业）：更肥沃的种植土壤，可走行
const T_JELLYNUT_SOIL = 10;      // 人工果仁土壤（太空时代 Gleba 农业）：人工填造的果仁种植土壤，可走行
const T_OVERGROWTH_JELLYNUT_SOIL = 11; // 茂盛果仁土壤（太空时代 Gleba 农业）：更肥沃的果仁种植土壤，可走行
const T_ICE_PLATFORM = 12;   // 冰面平台（太空时代 Aquilo）：玄冥星冰原地表，可走行
const T_FOUNDATION = 13;    // 平台基座（太空时代 Space platform）：空间平台走行地板，可走行
const T_SPACE_PLATFORM = 14; // 太空平台地基（太空时代 Space platform foundation 地面瓦片）：灰色栅格合金地板，铺设成太空平台地板，行走加速（对齐官方 Space platform foundation）
function isWalkableTerrain(t) { return t !== T_WATER && t !== T_CLIFF; }
// 地形是否“硬化”（混凝土/石砖路等铺装地）：玩家行走速度提升
function isPaved(t) { return t === T_CONCRETE || t === T_PATH || t === T_REF_CONCRETE || t === T_HAZARD || t === T_REF_HAZARD || t === T_FOUNDATION || t === T_ICE_PLATFORM || t === T_SPACE_PLATFORM; }

// ===== 无限分块世界 =====
// 世界由 32×32 块按需确定性生成。矿量稀疏存储：only remaining（被采过且
// 低于基础值的格子），未触碰的格子永远按基础值重建，保证无限矿脉与远行富集。
function genWorld(seed) {
  return { seed, chunks: new Map(), remaining: new Map(), explored: new Set() };
}

// ===== 探索追踪（小地图/雷达用） =====
// G.world.explored：已“点亮”区块的坐标集合（chunk 粒度）。
// 玩家移动会自动点亮脚下区块；雷达/侦察会调用 markExplored 点亮更大范围。
// 探索状态随存档持久化，用于小地图绘制与敌人生成范围控制。
function markExplored(px, py, radius) {
  if (!G.world.explored) G.world.explored = new Set();
  const r = (radius == null ? 1 : radius);
  const c0 = Math.floor((px - r) / CHUNK), c1 = Math.floor((px + r) / CHUNK);
  const d0 = Math.floor((py - r) / CHUNK), d1 = Math.floor((py + r) / CHUNK);
  for (let cx = c0; cx <= c1; cx++)
    for (let cy = d0; cy <= d1; cy++)
      G.world.explored.add(cx + ',' + cy);
}

// 区块是否已探索
function chunkExplored(cx, cy) {
  return !!(G.world && G.world.explored && G.world.explored.has(cx + ',' + cy));
}

// 当前是否已知晓某瓦片（小地图是否可绘制该格）
function tileExplored(tx, ty) {
  return chunkExplored(Math.floor(tx / CHUNK), Math.floor(ty / CHUNK));
}

// ===== 地图块持久化 =====
// 把已生成块编码为紧凑文本，随存档保存；读档时直接还原。
// 这样已探索区域与生成算法完全解耦——今后算法再怎么改，
// 也只会影响从未到访过的新区块，老地图永不变化。
function encodeChunkData(c) {
  let t = '', o = '';
  const a = [];
  const or = [];
  for (let i = 0; i < CHUNK * CHUNK; i++) {
    t += c.terrain[i];
    const ti = c.oreType[i];
    o += ti < 0 ? '.' : String(ti);
    if (ti >= 0) a.push(Math.round(c.oreAmt[i]));
    // 原油井出产率：仅 ORE_OIL 格子有值，其余不存（读档默认 1）
    if (ti === ORE_OIL && c.oilRate) {
      const r = c.oilRate[i];
      or.push(r > 0 ? Math.round(r * 100) / 100 : 1);
    }
  }
  return { cx: c.cx, cy: c.cy, t, o, a, or: or.length ? or : undefined };
}

// 字符→数字 查找表（避免每字符都做 charCodeAt-48），读档批量解码用（P2 优化）
const _chunkDigitLUT = (() => {
  const lut = new Int8Array(256);
  for (let i = 0; i < 256; i++) lut[i] = i - 48;
  return lut;
})();

// 批量解码地图块：用 LUT + 局部变量 + 4 格展开，替代逐字符反复 charCodeAt/属性访问（P2 优化）。
// 地形块多时（读档/大地图）显著降低逐格 for 循环开销。
function decodeChunkData(d) {
  const N = CHUNK * CHUNK;
  const terrain = new Uint8Array(N);
  const oreType = new Int8Array(N);
  const oreAmt = new Float32Array(N);
  const oilRate = new Float32Array(N);
  const t = d.t, o = d.o, a = d.a, or = d.or, lut = _chunkDigitLUT;
  let ai = 0, oi = 0, i = 0;
  // 每轮处理 4 格（若 N 为 4 的倍数则可完整展开；否则兜底补足）
  for (; i + 4 <= N; i += 4) {
    terrain[i] = lut[t.charCodeAt(i)];
    terrain[i + 1] = lut[t.charCodeAt(i + 1)];
    terrain[i + 2] = lut[t.charCodeAt(i + 2)];
    terrain[i + 3] = lut[t.charCodeAt(i + 3)];
    let ch = o.charCodeAt(i);
    oreType[i] = ch === 46 ? -1 : lut[ch];
    if (ch !== 46) { oreAmt[i] = a[ai++] || 0; if (oreType[i] === ORE_OIL && or) oilRate[i] = or[oi++] || 1; }
    ch = o.charCodeAt(i + 1);
    oreType[i + 1] = ch === 46 ? -1 : lut[ch];
    if (ch !== 46) { oreAmt[i + 1] = a[ai++] || 0; if (oreType[i + 1] === ORE_OIL && or) oilRate[i + 1] = or[oi++] || 1; }
    ch = o.charCodeAt(i + 2);
    oreType[i + 2] = ch === 46 ? -1 : lut[ch];
    if (ch !== 46) { oreAmt[i + 2] = a[ai++] || 0; if (oreType[i + 2] === ORE_OIL && or) oilRate[i + 2] = or[oi++] || 1; }
    ch = o.charCodeAt(i + 3);
    oreType[i + 3] = ch === 46 ? -1 : lut[ch];
    if (ch !== 46) { oreAmt[i + 3] = a[ai++] || 0; if (oreType[i + 3] === ORE_OIL && or) oilRate[i + 3] = or[oi++] || 1; }
  }
  for (; i < N; i++) {
    terrain[i] = lut[t.charCodeAt(i)];
    const ch = o.charCodeAt(i);
    oreType[i] = ch === 46 ? -1 : lut[ch];
    if (ch !== 46) { oreAmt[i] = a[ai++] || 0; if (oreType[i] === ORE_OIL && or) oilRate[i] = or[oi++] || 1; }
  }
  return { cx: d.cx | 0, cy: d.cy | 0, terrain, oreType, oreAmt, oilRate };
}

function chunkSeed(cx, cy) {
  let h = (Math.imul(cx, 0x27d4eb2d) ^ Math.imul(cy, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  // 行星参与种子哈希：同一 world seed 在不同星球生成不同地形/矿脉。
  const pid = (typeof planetId === 'function') ? planetId() : 'nauvis';
  let ph = 0x811c9dc5;
  for (let i = 0; i < pid.length; i++) ph = Math.imul(ph ^ pid.charCodeAt(i), 0x01000193) >>> 0;
  return ((h ^ (G.world.seed | 0)) ^ ph) >>> 0;
}

function chunkLocalIdx(tx, ty) {
  const lx = ((tx % CHUNK) + CHUNK) % CHUNK;
  const ly = ((ty % CHUNK) + CHUNK) % CHUNK;
  return ly * CHUNK + lx;
}

function getChunk(cx, cy) {
  const k = cx + ',' + cy;
  let c = G.world.chunks.get(k);
  if (!c) {
    c = genChunk(cx, cy);
    // 地图边界（超出可探索范围，地图大小配置）返回 null → 用全水域的“边界块”填充，
    // 表现地图边缘为不可通行的海洋（对齐《异星工厂》有限地图边界）。
    if (!c) {
      c = { cx, cy, terrain: new Uint8Array(CHUNK * CHUNK).fill(T_WATER), oreType: new Int8Array(CHUNK * CHUNK).fill(-1), oreAmt: new Float32Array(CHUNK * CHUNK), oilRate: new Float32Array(CHUNK * CHUNK) };
    }
    G.world.chunks.set(k, c);
  }
  return c;
}

function getTerrain(tx, ty) {
  const c = getChunk(Math.floor(tx / CHUNK), Math.floor(ty / CHUNK));
  return c.terrain[chunkLocalIdx(tx, ty)];
}
// 修改地形（混凝土/石砖路/填海等），随区块持久化；不会改变矿量。
function setTerrain(tx, ty, value) {
  const c = getChunk(Math.floor(tx / CHUNK), Math.floor(ty / CHUNK));
  c.terrain[chunkLocalIdx(tx, ty)] = value;
}

function getOreType(tx, ty) {
  const c = getChunk(Math.floor(tx / CHUNK), Math.floor(ty / CHUNK));
  return c.oreType[chunkLocalIdx(tx, ty)];
}

// 原油井出产率（原油/秒的缩放系数）：返回该格油井的出产率。
// 旧档/未生成出产率的油井返回默认 1（100%）。
function getOilRate(tx, ty) {
  const c = getChunk(Math.floor(tx / CHUNK), Math.floor(ty / CHUNK));
  const r = c.oilRate ? c.oilRate[chunkLocalIdx(tx, ty)] : 0;
  return (r > 0) ? r : 1; // 默认 100%
}

function baseOreAmt(tx, ty) {
  const c = getChunk(Math.floor(tx / CHUNK), Math.floor(ty / CHUNK));
  return c.oreAmt[chunkLocalIdx(tx, ty)];
}

function getOreAmt(tx, ty) {
  const rem = G.world.remaining.get(tx + ',' + ty);
  return rem !== undefined ? rem : baseOreAmt(tx, ty);
}

function consumeOre(tx, ty) {
  const key = tx + ',' + ty;
  const amt = getOreAmt(tx, ty);
  if (amt <= 0) return;
  G.world.remaining.set(key, amt - 1);
  // 性能优化：矿量变化后把该 chunk 的矿点离屏缓存标记为脏，下一帧重绘矿点（避免每帧全量重绘）
  if (typeof markOreChunkDirty === 'function') markOreChunkDirty(tx, ty);
}

function isWater(tx, ty) { return getTerrain(tx, ty) === T_WATER; }
function isCliff(tx, ty) { return getTerrain(tx, ty) === T_CLIFF; }
function isTree(tx, ty) { return getTerrain(tx, ty) === T_TREE; }

// 平滑插值
function lerp(a, b, t) { return a + (b - a) * t; }
function smoothstep(t) { return t * t * (3 - 2 * t); }
// 低频值噪声（0~1），用于生成蜿蜒的峭壁山脊线（确定性、随世界种子）
function valueNoise(gx, gy) {
  const ix = Math.floor(gx), iy = Math.floor(gy);
  const fx = gx - ix, fy = gy - iy;
  const v00 = hash2(ix, iy), v10 = hash2(ix + 1, iy), v01 = hash2(ix, iy + 1), v11 = hash2(ix + 1, iy + 1);
  const sx = smoothstep(fx), sy = smoothstep(fy);
  return lerp(lerp(v00, v10, sx), lerp(v01, v11, sx), sy);
}
// 判断世界坐标是否为峭壁（对齐《异星工厂》Cliff）：低频噪声零点附近的窄条带形成蜿蜒山脊。
// 出生点附近不生成（避免堵住开局），越远越密集。
function isCliffTile(gx, gy) {
  const d = Math.hypot(gx, gy);
  if (d < 24) return false;
  const f = 8;                       // 低频
  const n = valueNoise(gx / f, gy / f);
  // 距原点越远条带越宽 → 峭壁更密集；取噪声 0.5 两侧的窄条带
  // 密度改为原来的 1/3：条带整体宽度缩小到三分之一
  const band = (0.03 + 0.025 * Math.min(1, (d - 24) / 250)) / 3;
  const v = n - 0.5;
  if (Math.abs(v) > band * 0.5) return false;
  // 峭壁成片出现：用粗粒度低频噪声取代逐格随机断裂，让山脊成片/成线出现，
  // 而非散落成孤立单块；且沿用同样的 0.28 阈值，密度恰好为原来的 1/3。
  return valueNoise(gx / 13, gy / 13) > 0.28;
}

function isLake(tx, ty) {
  const cell = 13;
  const gx = Math.floor(tx / cell), gy = Math.floor(ty / cell);
  // 行星水系数：祝融星/雷神星几乎无水，句芒星/玄冥星更湿润，新地星正常
  const planetW = (typeof planetResources === 'function' && planetResources().water != null) ? planetResources().water : 1;
  const pWater = (planetW <= 0) ? 0 : (planetW - 1) * 0.05;   // >0 更多水，<0 更少水
  // 水频率配置（对齐《异星工厂》地图生成器）：调整湖泊密度阈值（+bias 更多水体 / -bias 更少水体）
  const bias = (typeof waterBias === 'function') ? waterBias() : 0;
  const waterBiasTotal = bias + pWater;
  for (let ogx = gx - 1; ogx <= gx + 1; ogx++) {
    for (let ogy = gy - 1; ogy <= gy + 1; ogy++) {
      // 湖泊密度：阈值从 0.04 再降到 0.02，使全图水体数量在上次基础上再减半
      const h = hash2(ogx * 12.9898, ogy * 78.233);
      if (h < 0.02 + waterBiasTotal) {
        const px = (ogx + (hash2(ogx * 3.1, ogy * 7.7) * 0.7 + 0.15)) * cell;
        const py = (ogy + (hash2(ogx * 5.3, ogy * 1.9) * 0.7 + 0.15)) * cell;
        // 单个水体面积适当增大：半径从 3~7.5 提升到 5~11
        const r = 5.0 + hash2(ogx * 8.8, ogy * 4.4) * 6.0;
        const d = Math.hypot(tx - px, ty - py);
        const wob = (hash2(tx * 7.3, ty * 5.1) - 0.5) * 1.6;
        if (d < r + wob) return true;
      }
    }
  }
  return false;
}

// 按行星资源画像加权随机选取一种普通矿石（iron/copper/coal/stone）。
// 权重来自 PLANET_RESOURCES[当前星球]（0=该星无此矿，不生成），
// 再叠加该资源「频率」Autoplace 控件倍率（none=0 → 完全不生成，high 更常见）。
// dist 越远越偏向更"深层"的矿（铁→铜→煤→石），与官方距离相关矿分布一致。
function pickOreType(rng, dist) {
  const prof = (typeof planetResources === 'function') ? planetResources() : null;
  const w = (k) => (prof && typeof prof[k] === 'number') ? prof[k] : 1;
  // 逐资源频率倍率：沿用 controlMult（0 = none / 已关闭）
  const fw = (id, dft) => (typeof controlMult === 'function') ? Math.max(0, controlMult(id, 'frequency')) : dft;
  // 基础权重（近处偏向铁/铜，远处偏向煤/石）
  let weights = [
    { id: 'iron-ore',   w: (dist > 70 ? 0.34 : 0.30) * w('iron')   * fw('iron-ore', 1) },
    { id: 'copper-ore', w: (dist > 70 ? 0.30 : 0.25) * w('copper') * fw('copper-ore', 1) },
    { id: 'coal',       w: (dist > 70 ? 0.20 : 0.25) * w('coal')   * fw('coal', 1) },
    { id: 'stone',      w: (dist > 70 ? 0.16 : 0.20) * w('stone')  * fw('stone', 1) }
  ];
  let total = 0;
  for (const it of weights) total += it.w;
  if (total <= 0) return ORES.indexOf('stone');   // 全无铁铜煤时兜底石矿
  let r2 = rng() * total;
  for (const it of weights) {
    if (r2 < it.w) return ORES.indexOf(it.id);
    r2 -= it.w;
  }
  return ORES.indexOf('stone');
}


// 出生点起步矿：取当前行星普通矿石中权重最高的矿（保证开局能采）。
function pickStartOre() {
  const prof = (typeof planetResources === 'function') ? planetResources() : null;
  let best = ORES.indexOf('iron-ore'), bestW = -1;
  for (const k of ['iron','copper','coal','stone']) {
    const w = (prof && typeof prof[k] === 'number') ? prof[k] : 1;
    if (w > bestW) { bestW = w; best = ORES.indexOf(k + '-ore'); }
  }
  return best;
}
function growPolyfill(terrain, oreType, oreAmt, rng, sx, sy, size, amt, ti) {
  // 若起点不在可放置的草地上（如落在树/水/已占用格），向四周搜索最近的可行格；
  // 找不到则放弃本矿床，避免生成 1 格残矿（占地面积过小，放不下采矿机）。
  if (terrain[sy * CHUNK + sx] !== T_GRASS || oreType[sy * CHUNK + sx] !== -1) {
    let found = false;
    for (let r = 1; r <= 6 && !found; r++) {
      for (let dy = -r; dy <= r && !found; dy++) {
        for (let dx = -r; dx <= r && !found; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const x = sx + dx, y = sy + dy;
          if (x < 1 || y < 1 || x >= CHUNK - 1 || y >= CHUNK - 1) continue;
          const idx = y * CHUNK + x;
          if (terrain[idx] === T_GRASS && oreType[idx] === -1) { sx = x; sy = y; found = true; }
        }
      }
    }
    if (!found) return 0;
  }
  const queue = [[sx, sy]];
  const seen = new Set([sx + ',' + sy]);
  let placed = 0, guard = 0;
  while (queue.length && placed < size && guard++ < size * 12) {
    const [qx, qy] = queue.splice((rng() * queue.length) | 0, 1)[0];
    if (qx < 1 || qy < 1 || qx >= CHUNK - 1 || qy >= CHUNK - 1) continue;
    const idx = qy * CHUNK + qx;
    if (terrain[idx] !== T_GRASS) continue;
    if (oreType[idx] !== -1) continue;
    oreType[idx] = ti;
    oreAmt[idx] = amt * (0.7 + rng() * 0.6);
    placed++;
    const dirs = shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]], rng);
    for (const [ddx, ddy] of dirs) {
      if (rng() < 0.62) {
        const nx = qx + ddx, ny = qy + ddy;
        const k = nx + ',' + ny;
        if (!seen.has(k)) { seen.add(k); queue.push([nx, ny]); }
      }
    }
  }
  return placed;
}

// 原油矿床：与普通矿石（连续聚团）不同，油点需要“隔几格一个”，
// 但整体围绕矿床中心聚集在一起（散布成一片油区，而非一整块实心矿团）。
// 每个油点带独立“出产率”oilRate（0.5~2.0），抽油机生产速度随油井出产率线性缩放。
function growOilField(terrain, oreType, oreAmt, oilRate, rng, sx, sy, count, amt, gap) {
  const placed = [[sx, sy]];
  let done = 0, guard = 0;
  const isOk = (x, y) => {
    if (x < 1 || y < 1 || x >= CHUNK - 1 || y >= CHUNK - 1) return false;
    const idx = y * CHUNK + x;
    if (terrain[idx] !== T_GRASS || oreType[idx] !== -1) return false;
    // 与已有油点至少间隔 gap 格（隔几格一个）
    for (let i = 0; i < placed.length; i++) {
      const dx = placed[i][0] - x, dy = placed[i][1] - y;
      if (dx * dx + dy * dy < gap * gap) return false;
    }
    return true;
  };
  // 首点放上
  oreType[sy * CHUNK + sx] = ORE_OIL;
  oreAmt[sy * CHUNK + sx] = amt * (0.7 + rng() * 0.6);
  if (oilRate) oilRate[sy * CHUNK + sx] = 0.5 + rng() * 1.5; // 出产率 50%~200%
  done++;
  while (done < count && guard++ < count * 20) {
    const base = placed[(rng() * placed.length) | 0];
    const ang = rng() * Math.PI * 2;
    // 以 base 为起点，朝随机方向走 gap~2*gap 格，使各油点彼此隔开
    const step = gap + Math.floor(rng() * gap);
    const nx = base[0] + Math.round(Math.cos(ang) * step);
    const ny = base[1] + Math.round(Math.sin(ang) * step);
    if (isOk(nx, ny)) {
      oreType[ny * CHUNK + nx] = ORE_OIL;
      oreAmt[ny * CHUNK + nx] = amt * (0.7 + rng() * 0.6);
      if (oilRate) oilRate[ny * CHUNK + nx] = 0.5 + rng() * 1.5; // 出产率 50%~200%
      placed.push([nx, ny]);
      done++;
    }
  }
}

// 树木：像矿床一样成簇生长（聚集成一片片森林，而非散落单棵树）。
// 以中心点为种子，用随机生长在草地上铺开一片连续树团，与矿床的聚团方式一致。
function growForest(terrain, oreType, rng, sx, sy, size) {
  // 若起点不可用（落在树/水/矿/边界格），向四周搜索最近的可行格；找不到则放弃本树团
  if (sx < 0 || sy < 0 || sx >= CHUNK || sy >= CHUNK ||
      terrain[sy * CHUNK + sx] !== T_GRASS || oreType[sy * CHUNK + sx] !== -1) {
    let found = false;
    for (let r = 1; r <= 8 && !found; r++) {
      for (let dy = -r; dy <= r && !found; dy++) {
        for (let dx = -r; dx <= r && !found; dx++) {
          if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
          const x = sx + dx, y = sy + dy;
          if (x < 0 || y < 0 || x >= CHUNK || y >= CHUNK) continue;
          const idx = y * CHUNK + x;
          if (terrain[idx] === T_GRASS && oreType[idx] === -1) { sx = x; sy = y; found = true; }
        }
      }
    }
    if (!found) return 0;
  }
  const queue = [[sx, sy]];
  const seen = new Set([sx + ',' + sy]);
  let placed = 0, guard = 0;
  while (queue.length && placed < size && guard++ < size * 12) {
    const [qx, qy] = queue.splice((rng() * queue.length) | 0, 1)[0];
    if (qx < 0 || qy < 0 || qx >= CHUNK || qy >= CHUNK) continue;
    const idx = qy * CHUNK + qx;
    if (terrain[idx] !== T_GRASS) continue;   // 只在草地上长树
    if (oreType[idx] !== -1) continue;        // 避开矿石/原油/铀矿
    terrain[idx] = T_TREE;
    placed++;
    const dirs = shuffle([[1, 0], [-1, 0], [0, 1], [0, -1]], rng);
    for (const [ddx, ddy] of dirs) {
      if (rng() < 0.62) {
        const nx = qx + ddx, ny = qy + ddy;
        const k = nx + ',' + ny;
        if (!seen.has(k)) { seen.add(k); queue.push([nx, ny]); }
      }
    }
  }
  return placed;
}

function genChunk(cx, cy) {
  const rng = mulberry32(chunkSeed(cx, cy));
  const terrain = new Uint8Array(CHUNK * CHUNK);
  const oreType = new Int8Array(CHUNK * CHUNK);
  oreType.fill(-1);
  const oreAmt = new Float32Array(CHUNK * CHUNK);
  // 原油井出产率（0.5~2.0）：仅 ORE_OIL 格子有效，未赋值格子读档/生成时默认 1（100%）。
  const oilRate = new Float32Array(CHUNK * CHUNK);

  const ox = cx * CHUNK, oy = cy * CHUNK;
  for (let ly = 0; ly < CHUNK; ly++)
    for (let lx = 0; lx < CHUNK; lx++)
      terrain[ly * CHUNK + lx] = isLake(ox + lx, oy + ly) ? T_WATER : T_GRASS;

  const cxn = cx * CHUNK + CHUNK / 2, cyn = cy * CHUNK + CHUNK / 2;
  const dist = Math.hypot(cxn, cyn);
  // 地图大小限制（对齐《异星工厂》地图大小）：超出可探索范围的地块视为边界（不可生成）
  if (typeof maxMapDist === 'function' && dist > maxMapDist()) return null;
  const scale = 1 + dist / 90;
  // 资源频率/大小/丰富度配置（对齐《异星工厂》地图生成器）
  // 旧全局倍率用于非逐资源环节兜底；逐资源见下 CONTROL_MAP
  const fq = (typeof frequencyMult === 'function') ? frequencyMult() : 1;
  const sz = (typeof sizeMult === 'function') ? sizeMult() : 1;
  const ri = (typeof richnessMult === 'function') ? richnessMult() : 1;
  // Autoplace 控件 → 矿石类型的映射（矿石 int index → 控件 id 从 ORES 名称推导）
  const ctlOf = (oreIdName) => (typeof cachedControlMult === 'function') ? ({
    f: (typeof controlMult === 'function') ? controlMult(oreIdName, 'frequency') : 1,
    s: (typeof controlMult === 'function') ? controlMult(oreIdName, 'size') : 1,
    r: (typeof controlMult === 'function') ? controlMult(oreIdName, 'richness') : 1,
  }) : { f: 1, s: 1, r: 1 };
  // 默认全"中"兜底
  const mult = (id, dft) => (typeof controlMult === 'function' && controlMult(id, 'frequency') != null) ? controlMult(id, 'frequency') : dft;
  // 矿床数量：资源频率在当前基础上再降至 1/5（更稀疏散布）。
  // 原为每区块约 1 个矿床，现改为平均约每 5 个区块才有 1 个矿床（保留越远越多趋势）。
  const freqProb = 0.2 * fq * (1 + Math.min(0.5, dist / 200));
  const count = rng() < freqProb ? 1 : 0;
  // 记录已放置的矿床中心与近似半径，用于保证矿床之间留有足够间隔
  const placed = [];

  for (let n = 0; n < count; n++) {
    const ti = pickOreType(rng, dist);
    // 逐资源 Autoplace 控件倍率（频率/大小/丰富度，来自 data.generated.js 的控件设置）
    const oreName = (typeof ORES !== 'undefined' && ORES[ti] != null) ? ORES[ti] : 'iron-ore';
    const ctl = ctlOf(oreName);
    // 单个矿床面积提高到原来的 5 倍（更大的矿团，占地足够放下多台采矿机）
    // 受该资源「大小」控件倍率影响
    const size = Math.max(12, Math.round((40 + rng() * 40) * Math.min(2.2, scale) * sz * ctl.s * 5));
    // 由面积估算矿床近似半径（圆形面积 ≈ πr²）
    const rad = Math.max(4, Math.sqrt(size / Math.PI) * 1.1);
    // 单格储量受该资源「丰富度」控件倍率影响（且受地图大小缩放）
    const amt = (500 + rng() * 900) * scale * ri * ctl.r;
    // 找一个离已有矿床足够远的位置，确保矿床之间间隔较远；
    // 若因地形（树/水）导致矿团过小，则换位置重试，保证每个矿床占地足够大。
    const minPlaced = Math.max(15, Math.floor(size * 0.4));
    const snapshot = new Int8Array(oreType); // 用于回滚过小的失败尝试
    let placedCnt = 0, sx = -1, sy = -1;
    for (let attempt = 0; attempt < 12; attempt++) {
      sx = -1; sy = -1;
      for (let it = 0; it < 40 && sx < 0; it++) {
        const tx = 1 + Math.floor(rng() * (CHUNK - 2));
        const ty = 1 + Math.floor(rng() * (CHUNK - 2));
        let ok = true;
        for (let p = 0; p < placed.length; p++) {
          if (Math.hypot(placed[p].x - tx, placed[p].y - ty) < placed[p].rad + rad + 2) {
            ok = false; break;
          }
        }
        if (ok) { sx = tx; sy = ty; }
      }
      if (sx < 0) { sx = 1 + Math.floor(rng() * (CHUNK - 2)); sy = 1 + Math.floor(rng() * (CHUNK - 2)); }
      placedCnt = growPolyfill(terrain, oreType, oreAmt, rng, sx, sy, size, amt, ti);
      if (placedCnt >= minPlaced) break;
      // 过小则回滚本次尝试，换位置重来，避免留下 1 格残矿
      oreType.set(snapshot);
      placedCnt = 0;
    }
    if (placedCnt > 0) placed.push({ x: sx, y: sy, rad });
  }

  // 行星资源画像：当前星球某类资源丰度（0=无此矿）。越远越常见、储量越高。
  const rp = (typeof planetResources === 'function') ? planetResources() : null;
  const rw = (k) => (rp && typeof rp[k] === 'number') ? rp[k] : 1;

  // 原油矿床：离角色稍远才生成（出生点周围只有石/铁/煤/铜矿），越远越常见、储量越高
  // 受「crude-oil」Autoplace 控件控制（频率/大小/丰富度）
  const oilCtl = ctlOf('crude-oil');
  const oilChance = (dist > 60 ? 0.55 : dist > 25 ? 0.15 : 0) * rw('oil') * oilCtl.f;
  if (rw('oil') > 0 && oilCtl.f > 0 && rng() < oilChance) {
    const sx = 2 + Math.floor(rng() * (CHUNK - 4));
    const sy = 2 + Math.floor(rng() * (CHUNK - 4));
    // 原油矿床：隔几格一个，整体聚集（gap≈3 即每个油点相隔 3 格左右）
    // 大小/丰富度受对应控件倍率缩放
    growOilField(terrain, oreType, oreAmt, oilRate, rng, sx, sy, 4 + Math.floor(rng() * 5), (1500 + rng() * 2500) * ri * oilCtl.r, 3);
  }

  // 铀矿：距离较远才生成（核能后期，且离角色比原油更远），越远越多，矿团适中
  // 受「uranium-ore」Autoplace 控件控制（频率/大小/丰富度）
  const uCtl = ctlOf('uranium-ore');
  const uChance = (dist > 120 ? 0.4 : dist > 80 ? 0.15 : 0) * rw('uranium') * uCtl.f;
  if (rw('uranium') > 0 && uCtl.f > 0 && rng() < uChance) {
    const sx = 2 + Math.floor(rng() * (CHUNK - 4));
    const sy = 2 + Math.floor(rng() * (CHUNK - 4));
    const usz = Math.max(8, Math.round((18 + rng() * 20) * Math.min(2.2, scale) * sz * uCtl.s));
    const uamt = (400 + rng() * 700) * scale * ri * uCtl.r;
    growPolyfill(terrain, oreType, oreAmt, rng, sx, sy, usz, uamt, ORE_URANIUM);
  }

  // 小行星碎块矿床：太空时代终局资源，距离比铀矿更远才生成，越远越多，矿团适中
  // （官方小行星碎块来自太空，此处适配为遥远地面矿床，供破碎机加工）
  // 受「asteroid-chunks」（如果存在）Autoplace 控件控制
  const aCtl = ctlOf('asteroid-chunks');
  const aChance = (dist > 200 ? 0.35 : dist > 150 ? 0.12 : 0) * rw('asteroid') * aCtl.f;
  if (rw('asteroid') > 0 && aCtl.f > 0 && rng() < aChance) {
    const sx = 2 + Math.floor(rng() * (CHUNK - 4));
    const sy = 2 + Math.floor(rng() * (CHUNK - 4));
    const asz = Math.max(6, Math.round((12 + rng() * 16) * Math.min(2.2, scale) * sz * aCtl.s));
    const aamt = (300 + rng() * 600) * scale * ri * aCtl.r;
    growPolyfill(terrain, oreType, oreAmt, rng, sx, sy, asz, aamt, ORE_ASTEROID);
  }


  // 行星专属矿藏（太空时代天然矿脉，官方）：
  //   祝融星 Vulcanus → 钨矿 tungsten-ore（官方 tungsten-ore 天然矿脉）
  //   雷神星 Fulgora  → 钬矿 holmium-ore（官方 holmium-ore 天然矿脉）
  // 仅在其母星（丰度>0）自然生成；其余星球经合成配方兜底（见 data-recipes.js）。
  // 生成距离与铀矿/小行星同级（后期资源），越远越常见、储量越高。
  // 受对应 Autoplace 控件控制（已提取到 data.generated.js）
  const tCtl = ctlOf('tungsten_ore');
  const tChance = (dist > 100 ? 0.35 : dist > 60 ? 0.12 : 0) * rw('tungsten') * tCtl.f;
  if (rw('tungsten') > 0 && tCtl.f > 0 && rng() < tChance) {
    const sx = 2 + Math.floor(rng() * (CHUNK - 4));
    const sy = 2 + Math.floor(rng() * (CHUNK - 4));
    const tsz = Math.max(8, Math.round((16 + rng() * 18) * Math.min(2.2, scale) * sz * tCtl.s));
    const tamt = (400 + rng() * 700) * scale * ri * tCtl.r;
    growPolyfill(terrain, oreType, oreAmt, rng, sx, sy, tsz, tamt, ORE_TUNGSTEN);
  }
  const hCtl = ctlOf('holmium_ore');
  const hChance = (dist > 100 ? 0.35 : dist > 60 ? 0.12 : 0) * rw('holmium') * hCtl.f;
  if (rw('holmium') > 0 && hCtl.f > 0 && rng() < hChance) {
    const sx = 2 + Math.floor(rng() * (CHUNK - 4));
    const sy = 2 + Math.floor(rng() * (CHUNK - 4));
    const hsz = Math.max(8, Math.round((16 + rng() * 18) * Math.min(2.2, scale) * sz * hCtl.s));
    const hamt = (400 + rng() * 700) * scale * ri * hCtl.r;
    growPolyfill(terrain, oreType, oreAmt, rng, sx, sy, hsz, hamt, ORE_HOLMIUM);
  }

  // 出生点保证：原点上一定有一片小型起步矿。若当前星球无铁矿（如句芒星/玄冥星），
  // 则用该星最丰富的普通矿石起步，保证开局可采集。
  if (cx === 0 && cy === 0) {
    const startOre = (typeof pickStartOre === 'function') ? pickStartOre() : ORES.indexOf('iron-ore');
    for (let attempt = 0; attempt < 8; attempt++) {
      const sx = 3 + Math.floor(rng() * 7), sy = 3 + Math.floor(rng() * 7);
      const si = sy * CHUNK + sx;
      if (terrain[si] === T_GRASS && oreType[si] < 0) {
        growPolyfill(terrain, oreType, oreAmt, rng, sx, sy, 10, 900, startOre);
        break;
      }
    }
  }

  // 峭壁（对齐《异星工厂》Cliff）：低频噪声生成蜿蜒山脊，阻挡通行与建造，可用峭壁炸药清除。
  // 受地图设置「峭壁」开关控制：关闭时整个世界不生成峭壁。
  // 放在矿床生成之后：跳过已生成矿石的格子，避免在矿床中间出现悬崖峭壁割裂矿脉。
  const cliffEnabled = (typeof cliffOn === 'function') ? cliffOn() : true;
  if (cliffEnabled) {
    for (let ly = 0; ly < CHUNK; ly++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const idx = ly * CHUNK + lx;
        if (terrain[idx] !== T_GRASS) continue;
        if (oreType[idx] >= 0) continue;   // 不覆盖矿石/原油/铀矿，保证矿床中间无峭壁
        if (isCliffTile(ox + lx, oy + ly)) terrain[idx] = T_CLIFF;
      }
    }
  }

  // 树木（对齐《异星工厂》：森林与草地上的树可砍伐获得木）。
  // 像矿床一样成簇聚集：以随机中心点为种子，用生长算法铺开一片片连续树团，
  // 而非散落单棵树；靠近出生点树团较少较小，越远越密越大。
  // 放在矿床与峭壁生成之后：growForest 会跳过 oreType 非空的格子，
  // 从而避免把树长在矿床/原油/铀矿的中间（与峭壁处理保持一致）。
  const forestRng = mulberry32((chunkSeed(cx, cy) ^ 0x51ed270b) >>> 0);
  const fcX = ox + CHUNK / 2, fcY = oy + CHUNK / 2;
  const fDist = Math.hypot(fcX, fcY);
  // 每个区块可能生成的森林团数量：出生点附近较少（约 1/2 区块有），越远越多（最多约 3 团）
  const forestProb = fDist < 15 ? 0.35 : fDist < 40 ? 0.6 : (fDist < 80 ? 0.85 : 1);
  const forestCount = forestRng() < forestProb
    ? 1 + Math.floor(forestRng() * (fDist < 40 ? 1.5 : 2.5))
    : 0;
  // 每团大小：出生点附近小簇，越远越大
  const forestSize = Math.max(8, Math.round((18 + forestRng() * 24) * (1 + Math.min(2, fDist / 80))));
  for (let f = 0; f < forestCount; f++) {
    const fsx = Math.floor(forestRng() * CHUNK);
    const fsy = Math.floor(forestRng() * CHUNK);
    growForest(terrain, oreType, forestRng, fsx, fsy, forestSize);
  }

  return { cx, cy, terrain, oreType, oreAmt, oilRate };
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}