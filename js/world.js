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

function genWorld(seed) {
  const rng = mulberry32(seed);
  const w = WORLD_W, h = WORLD_H;
  const terrain = new Uint8Array(w * h);
  const oreType = new Int8Array(w * h).fill(-1);
  const oreAmt = new Float32Array(w * h);

  const lakes = [];
  for (let i = 0; i < 9; i++) {
    lakes.push({
      x: 12 + rng() * (w - 24),
      y: 12 + rng() * (h - 24),
      r: 3.5 + rng() * 5.5,
      k: rng() * 1000
    });
  }
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      for (const L of lakes) {
        const j = 0.72 + hash2(x + L.k, y - L.k) * 0.56;
        const d = Math.hypot(x - L.x, y - L.y);
        if (d < L.r * j) { terrain[y * w + x] = T_WATER; break; }
      }
    }
  }

  const patches = [
    ['iron-ore', 5, 30], ['copper-ore', 4, 26],
    ['coal', 4, 26], ['stone', 3, 20]
  ];
  const centers = [];
  for (const [type, count, size] of patches) {
    const ti = ORES.indexOf(type);
    for (let n = 0; n < count; n++) {
      let cx = 0, cy = 0, ok = false, tries = 0;
      while (!ok && tries++ < 200) {
        cx = 10 + (rng() * (w - 20)) | 0;
        cy = 10 + (rng() * (h - 20)) | 0;
        ok = terrain[cy * w + cx] === T_GRASS;
        if (ok) for (const c of centers) {
          if (Math.hypot(c.x - cx, c.y - cy) < 22) { ok = false; break; }
        }
      }
      if (!ok) continue;
      centers.push({ x: cx, y: cy });
      const queue = [[cx, cy]];
      const seen = new Set([cx + ',' + cy]);
      let placed = 0, guard = 0;
      while (queue.length && placed < size && guard++ < size * 12) {
        const [qx, qy] = queue.splice((rng() * queue.length) | 0, 1)[0];
        const idx = qy * w + qx;
        if (qx < 1 || qy < 1 || qx >= w - 1 || qy >= h - 1) continue;
        if (terrain[idx] !== T_GRASS) continue;
        if (oreType[idx] !== -1) continue;
        oreType[idx] = ti;
        oreAmt[idx] = 500 + rng() * 900;
        placed++;
        const dirs = shuffle([[1,0],[-1,0],[0,1],[0,-1]], rng);
        for (const [ddx, ddy] of dirs) {
          if (rng() < 0.62) {
            const nx = qx + ddx, ny = qy + ddy;
            const k = nx + ',' + ny;
            if (!seen.has(k)) { seen.add(k); queue.push([nx, ny]); }
          }
        }
      }
    }
  }
  return { terrain, oreType, oreAmt, seed };
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = (rng() * (i + 1)) | 0;
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function tileIdx(tx, ty) { return ty * WORLD_W + tx; }
function inBounds(tx, ty) { return tx >= 0 && ty >= 0 && tx < WORLD_W && ty < WORLD_H; }
function isWater(tx, ty) { return !inBounds(tx, ty) || G.world.terrain[tileIdx(tx, ty)] === T_WATER; }
