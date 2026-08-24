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

// ===== 无限分块世界 =====
// 世界由 32×32 块按需确定性生成。矿量稀疏存储：only remaining（被采过且
// 低于基础值的格子），未触碰的格子永远按基础值重建，保证无限矿脉与远行富集。
function genWorld(seed) {
  return { seed, chunks: new Map(), remaining: new Map() };
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
  if (!c) { c = genChunk(cx, cy); G.world.chunks.set(k, c); }
  return c;
}

function getTerrain(tx, ty) {
  const c = getChunk(Math.floor(tx / CHUNK), Math.floor(ty / CHUNK));
  return c.terrain[chunkLocalIdx(tx, ty)];
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
  // 矿点已烘焙进地形分块离屏缓存：矿量变化后局部重绘该格（P1 优化）
  if (typeof invalidateOreTile === 'function') invalidateOreTile(tx, ty);
}

function isWater(tx, ty) { return getTerrain(tx, ty) === T_WATER; }

function isLake(tx, ty) {
  const cell = 13;
  const gx = Math.floor(tx / cell), gy = Math.floor(ty / cell);
  for (let ogx = gx - 1; ogx <= gx + 1; ogx++) {
    for (let ogy = gy - 1; ogy <= gy + 1; ogy++) {
      // 湖泊密度：阈值从 0.04 再降到 0.02，使全图水体数量在上次基础上再减半
      const h = hash2(ogx * 12.9898, ogy * 78.233);
      if (h < 0.02) {
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
  const roll = rng();
  // 方解石较稀有，全图少量分布
  if (roll < 0.05) return ORES.indexOf('calcite');
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

  const cxn = cx * CHUNK + CHUNK / 2, cyn = cy * CHUNK + CHUNK / 2;
  const dist = Math.hypot(cxn, cyn);
  const scale = 1 + dist / 90;
  // 矿物数量在上次基础上放大一倍（更密集的矿脉分布）
  const count = (2 + Math.floor(rng() * 2)) * 2 + (dist > 60 && rng() < 0.6 ? 2 : 0);

  for (let n = 0; n < count; n++) {
    const ti = pickOreType(rng, dist);
    // 单个矿物体积面积放大一倍（更大的矿团）
    const size = Math.max(5, Math.round((20 + rng() * 20) * Math.min(2.6, scale)));
    const amt = (500 + rng() * 900) * scale;
    const sx = 1 + Math.floor(rng() * (CHUNK - 2));
    const sy = 1 + Math.floor(rng() * (CHUNK - 2));
    growPolyfill(terrain, oreType, oreAmt, rng, sx, sy, size, amt, ti);
  }

  // 原油矿床：越远越常见，储量更高
  const oilChance = dist > 40 ? 0.55 : dist > 15 ? 0.28 : 0.06;
  if (rng() < oilChance) {
    const sx = 2 + Math.floor(rng() * (CHUNK - 4));
    const sy = 2 + Math.floor(rng() * (CHUNK - 4));
    // 原油矿床：隔几格一个，整体聚集（gap≈3 即每个油点相隔 3 格左右）
    growOilField(terrain, oreType, oreAmt, rng, sx, sy, 4 + Math.floor(rng() * 5), 1500 + rng() * 2500, 3);
  }

  // 铀矿（对齐《异星工厂》：稀有、越远离出生点越常见）：小片亮绿色晶簇
  const uraniumChance = dist > 60 ? 0.32 : dist > 30 ? 0.18 : 0.05;
  if (rng() < uraniumChance) {
    const sx = 2 + Math.floor(rng() * (CHUNK - 4));
    const sy = 2 + Math.floor(rng() * (CHUNK - 4));
    growPolyfill(terrain, oreType, oreAmt, rng, sx, sy,
      5 + Math.floor(rng() * 9), (650 + rng() * 900) * scale, URANIUM_ORE_TI);
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
    // 出生点附近保证一小片原油，方便早期接触石油链
    for (let attempt = 0; attempt < 8; attempt++) {
      const sx = 3 + Math.floor(rng() * (CHUNK - 6)), sy = 3 + Math.floor(rng() * (CHUNK - 6));
      const si = sy * CHUNK + sx;
      if (terrain[si] === T_GRASS && oreType[si] < 0 && Math.hypot(sx - 6, sy - 6) > 4) {
        growOilField(terrain, oreType, oreAmt, rng, sx, sy, 4, 2000, 3);
        break;
      }
    }
    // 出生点区块保证一小片铀矿（核能链入口，与铁矿/原油错开位置）
    for (let attempt = 0; attempt < 10; attempt++) {
      const sx = 2 + Math.floor(rng() * (CHUNK - 4)), sy = 2 + Math.floor(rng() * (CHUNK - 4));
      const si = sy * CHUNK + sx;
      if (terrain[si] === T_GRASS && oreType[si] < 0 && Math.hypot(sx - 16, sy - 16) > 9) {
        growPolyfill(terrain, oreType, oreAmt, rng, sx, sy, 5, 700, URANIUM_ORE_TI);
        break;
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