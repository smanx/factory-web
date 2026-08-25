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
const T_CLIFF = 7;          // 峭壁（对齐《异星工厂》Cliff）：不可通行、不可建造的地形障碍，可用峭壁炸药清除
function isWalkableTerrain(t) { return t !== T_WATER && t !== T_CLIFF; }
// 地形是否“硬化”（混凝土/石砖路等铺装地）：玩家行走速度提升
function isPaved(t) { return t === T_CONCRETE || t === T_PATH || t === T_REF_CONCRETE || t === T_HAZARD; }

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
  for (let i = 0; i < CHUNK * CHUNK; i++) {
    t += c.terrain[i];
    const ti = c.oreType[i];
    o += ti < 0 ? '.' : String(ti);
    if (ti >= 0) a.push(Math.round(c.oreAmt[i]));
  }
  return { cx: c.cx, cy: c.cy, t, o, a };
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
  const t = d.t, o = d.o, a = d.a, lut = _chunkDigitLUT;
  let ai = 0, i = 0;
  // 每轮处理 4 格（若 N 为 4 的倍数则可完整展开；否则兜底补足）
  for (; i + 4 <= N; i += 4) {
    terrain[i] = lut[t.charCodeAt(i)];
    terrain[i + 1] = lut[t.charCodeAt(i + 1)];
    terrain[i + 2] = lut[t.charCodeAt(i + 2)];
    terrain[i + 3] = lut[t.charCodeAt(i + 3)];
    let ch = o.charCodeAt(i);
    oreType[i] = ch === 46 ? -1 : lut[ch];
    if (ch !== 46) oreAmt[i] = a[ai++] || 0;
    ch = o.charCodeAt(i + 1);
    oreType[i + 1] = ch === 46 ? -1 : lut[ch];
    if (ch !== 46) oreAmt[i + 1] = a[ai++] || 0;
    ch = o.charCodeAt(i + 2);
    oreType[i + 2] = ch === 46 ? -1 : lut[ch];
    if (ch !== 46) oreAmt[i + 2] = a[ai++] || 0;
    ch = o.charCodeAt(i + 3);
    oreType[i + 3] = ch === 46 ? -1 : lut[ch];
    if (ch !== 46) oreAmt[i + 3] = a[ai++] || 0;
  }
  for (; i < N; i++) {
    terrain[i] = lut[t.charCodeAt(i)];
    const ch = o.charCodeAt(i);
    oreType[i] = ch === 46 ? -1 : lut[ch];
    if (ch !== 46) oreAmt[i] = a[ai++] || 0;
  }
  return { cx: d.cx | 0, cy: d.cy | 0, terrain, oreType, oreAmt };
}

function chunkSeed(cx, cy) {
  let h = (Math.imul(cx, 0x27d4eb2d) ^ Math.imul(cy, 0x165667b1)) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822519) >>> 0;
  return (h ^ (G.world.seed | 0)) >>> 0;
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
      c = { cx, cy, terrain: new Uint8Array(CHUNK * CHUNK).fill(T_WATER), oreType: new Int8Array(CHUNK * CHUNK).fill(-1), oreAmt: new Float32Array(CHUNK * CHUNK) };
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
  const band = 0.03 + 0.025 * Math.min(1, (d - 24) / 250);
  const v = n - 0.5;
  if (Math.abs(v) > band * 0.5) return false;
  // 让山脊呈断续的蜿蜒线（避免整片连成实心墙）
  return hash2(gx * 3.1, gy * 7.7) > 0.28;
}

function isLake(tx, ty) {
  const cell = 13;
  const gx = Math.floor(tx / cell), gy = Math.floor(ty / cell);
  // 水频率配置（对齐《异星工厂》地图生成器）：调整湖泊密度阈值（+bias 更多水体 / -bias 更少水体）
  const bias = (typeof waterBias === 'function') ? waterBias() : 0;
  for (let ogx = gx - 1; ogx <= gx + 1; ogx++) {
    for (let ogy = gy - 1; ogy <= gy + 1; ogy++) {
      // 湖泊密度：阈值从 0.04 再降到 0.02，使全图水体数量在上次基础上再减半
      const h = hash2(ogx * 12.9898, ogy * 78.233);
      if (h < 0.02 + bias) {
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

function pickOreType(rng, dist) {
  // 方解石为《太空时代》DLC 内容，不在地图生成中
  const r2 = rng();
  if (dist > 70) {
    if (r2 < 0.34) return ORES.indexOf('iron-ore');
    if (r2 < 0.64) return ORES.indexOf('copper-ore');
    if (r2 < 0.84) return ORES.indexOf('coal');
    return ORES.indexOf('stone');
  }
  if (r2 < 0.3) return ORES.indexOf('iron-ore');
  if (r2 < 0.55) return ORES.indexOf('copper-ore');
  if (r2 < 0.8) return ORES.indexOf('coal');
  return ORES.indexOf('stone');
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
function growOilField(terrain, oreType, oreAmt, rng, sx, sy, count, amt, gap) {
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
      placed.push([nx, ny]);
      done++;
    }
  }
}

function genChunk(cx, cy) {
  const rng = mulberry32(chunkSeed(cx, cy));
  const terrain = new Uint8Array(CHUNK * CHUNK);
  const oreType = new Int8Array(CHUNK * CHUNK);
  oreType.fill(-1);
  const oreAmt = new Float32Array(CHUNK * CHUNK);

  const ox = cx * CHUNK, oy = cy * CHUNK;
  for (let ly = 0; ly < CHUNK; ly++)
    for (let lx = 0; lx < CHUNK; lx++)
      terrain[ly * CHUNK + lx] = isLake(ox + lx, oy + ly) ? T_WATER : T_GRASS;

  // 树木（对齐《异星工厂》：森林与草地上的树可砍伐获得木）。
  // 用噪声在草地上确定性撒点，树林成团分布；靠近出生点较少，越远越密集。
  const seedR = mulberry32((chunkSeed(cx, cy) ^ 0x51ed270b) >>> 0);
  for (let ly = 0; ly < CHUNK; ly++) {
    for (let lx = 0; lx < CHUNK; lx++) {
      const idx = ly * CHUNK + lx;
      if (terrain[idx] !== T_GRASS) continue;
      const gx = ox + lx, gy = oy + ly;
      // 用 hash 造低频森林斑块，树在其中成群
      const forest = hash2(Math.floor(gx / 5) * 7.13, Math.floor(gy / 5) * 3.71);
      if (forest > 0.58) {
        const dist = Math.hypot(gx, gy);
        // 出生点附近稀疏，越远越密（对齐《异星工厂》出生点多为草地）
        const dens = dist < 15 ? 0.18 : (dist < 40 ? 0.4 : (dist < 80 ? 0.62 : 0.8));
        if (seedR() < dens) {
          // 避免树生成在矿石/原油/铀矿格上
          if (oreType[idx] < 0) terrain[idx] = T_TREE;
        }
      }
    }
  }

  const cxn = cx * CHUNK + CHUNK / 2, cyn = cy * CHUNK + CHUNK / 2;
  const dist = Math.hypot(cxn, cyn);
  // 地图大小限制（对齐《异星工厂》地图大小）：超出可探索范围的地块视为边界（不可生成）
  if (typeof maxMapDist === 'function' && dist > maxMapDist()) return null;
  const scale = 1 + dist / 90;
  // 资源频率/大小/丰富度配置（对齐《异星工厂》地图生成器）
  const fq = (typeof frequencyMult === 'function') ? frequencyMult() : 1;
  const sz = (typeof sizeMult === 'function') ? sizeMult() : 1;
  const ri = (typeof richnessMult === 'function') ? richnessMult() : 1;
  // 矿床数量：资源频率在当前基础上再降至 1/5（更稀疏散布）。
  // 原为每区块约 1 个矿床，现改为平均约每 5 个区块才有 1 个矿床（保留越远越多趋势）。
  const freqProb = 0.2 * fq * (1 + Math.min(0.5, dist / 200));
  const count = rng() < freqProb ? 1 : 0;
  // 记录已放置的矿床中心与近似半径，用于保证矿床之间留有足够间隔
  const placed = [];

  for (let n = 0; n < count; n++) {
    const ti = pickOreType(rng, dist);
    // 单个矿床面积提高到原来的 5 倍（更大的矿团，占地足够放下多台采矿机）
    const size = Math.max(12, Math.round((40 + rng() * 40) * Math.min(2.2, scale) * sz * 5));
    // 由面积估算矿床近似半径（圆形面积 ≈ πr²）
    const rad = Math.max(4, Math.sqrt(size / Math.PI) * 1.1);
    const amt = (500 + rng() * 900) * scale * ri;
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

  // 原油矿床：离角色稍远才生成（出生点周围只有石/铁/煤/铜矿），越远越常见、储量越高
  const oilChance = dist > 60 ? 0.55 : dist > 25 ? 0.15 : 0;
  if (rng() < oilChance) {
    const sx = 2 + Math.floor(rng() * (CHUNK - 4));
    const sy = 2 + Math.floor(rng() * (CHUNK - 4));
    // 原油矿床：隔几格一个，整体聚集（gap≈3 即每个油点相隔 3 格左右）
    growOilField(terrain, oreType, oreAmt, rng, sx, sy, 4 + Math.floor(rng() * 5), (1500 + rng() * 2500) * ri, 3);
  }

  // 铀矿：距离较远才生成（核能后期，且离角色比原油更远），越远越多，矿团适中
  const uChance = dist > 120 ? 0.4 : dist > 80 ? 0.15 : 0;
  if (rng() < uChance) {
    const sx = 2 + Math.floor(rng() * (CHUNK - 4));
    const sy = 2 + Math.floor(rng() * (CHUNK - 4));
    const usz = Math.max(8, Math.round((18 + rng() * 20) * Math.min(2.2, scale) * sz));
    const uamt = (400 + rng() * 700) * scale * ri;
    growPolyfill(terrain, oreType, oreAmt, rng, sx, sy, usz, uamt, ORE_URANIUM);
  }

  // 出生点保证：原点上一定有一片小型铁矿起步
  if (cx === 0 && cy === 0) {
    for (let attempt = 0; attempt < 8; attempt++) {
      const sx = 3 + Math.floor(rng() * 7), sy = 3 + Math.floor(rng() * 7);
      const si = sy * CHUNK + sx;
      if (terrain[si] === T_GRASS && oreType[si] < 0) {
        growPolyfill(terrain, oreType, oreAmt, rng, sx, sy, 10, 900, ORES.indexOf('iron-ore'));
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

  return { cx, cy, terrain, oreType, oreAmt };
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}