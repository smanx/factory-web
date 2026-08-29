#!/usr/bin/env node
'use strict';
/**
 * 地形渲染回归脚本（地图画面重设计）
 * ------------------------------------------------
 * 用纯 Node 软件光栅化的极简 Canvas（覆盖地形绘制用到的 2D API 子集）
 * 直接调用 render.js 的 drawChunkTerrainInto / drawWaterAnimation /
 * drawOreDots，对重设计后的地图画面做像素级断言：
 *   1. 水面按深度着色：近岸浅、湖心深（岸线附近像素明显偏浅/带沙色）
 *   2. 岸线：水侧有浅滩渐变带 + 白色水线；陆侧草地有沙质滩涂带
 *   3. 草地：低频噪声产生成片深浅斑块（颜色多样性，而非三色平涂）
 *   4. 树木：树冠像素为绿色（多层树冠叠加有效）
 *   5. 峭壁：崖脚向南侧地面投出接触阴影（下方像素明显变暗）
 *   6. 矿点：矿团底色为柔和圆斑 + 矿色颗粒
 *   7. 水面波光动画可绘制出高光像素
 *   8. 同一 chunk 两次渲染结果完全一致（确定性）
 *
 * 运行：node tools/verify-terrain-render.js （退出码 0 = 通过）
 * 零依赖：vm 加载 data/data.generated.js → data.js → data-items.js →
 *         world-config.js → world.js → render/render.js 端到端模拟。
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'js');
const load = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');

// ================= 极简软件 Canvas =================
function parseColor(s) {
  if (typeof s !== 'string') return [0, 0, 0, 1];
  s = s.trim();
  if (s.charAt(0) === '#') {
    let h = s.slice(1);
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    if (isNaN(n)) return [0, 0, 0, 1];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255, 1];
  }
  const m = s.match(/rgba?\(([^)]+)\)/i);
  if (m) {
    const p = m[1].split(',').map(v => parseFloat(v));
    return [p[0] || 0, p[1] || 0, p[2] || 0, p.length > 3 && !isNaN(p[3]) ? p[3] : 1];
  }
  return [0, 0, 0, 1];
}

class Grad {
  constructor(type, x0, y0, r0, x1, y1, r1) {
    this.type = type; this.x0 = x0; this.y0 = y0; this.r0 = r0;
    this.x1 = x1; this.y1 = y1; this.r1 = r1; this.stops = [];
  }
  addColorStop(off, col) { this.stops.push({ off, col: parseColor(col) }); this.stops.sort((a, b) => a.off - b.off); }
  colorAt(x, y) {
    const st = this.stops;
    if (!st.length) return [0, 0, 0, 1];
    let t;
    if (this.type === 'linear') {
      const dx = this.x1 - this.x0, dy = this.y1 - this.y0, l2 = dx * dx + dy * dy;
      t = l2 ? ((x - this.x0) * dx + (y - this.y0) * dy) / l2 : 0;
    } else {
      const d = Math.hypot(x - this.x0, y - this.y0);
      t = (d - this.r0) / Math.max(0.001, this.r1 - this.r0);
    }
    if (t <= 0) return st[0].col;
    if (t >= 1) return st[st.length - 1].col;
    for (let i = 1; i < st.length; i++) {
      if (t <= st[i].off) {
        const a = st[i - 1], b = st[i];
        const f = (t - a.off) / Math.max(1e-6, b.off - a.off);
        return [
          a.col[0] + (b.col[0] - a.col[0]) * f, a.col[1] + (b.col[1] - a.col[1]) * f,
          a.col[2] + (b.col[2] - a.col[2]) * f, a.col[3] + (b.col[3] - a.col[3]) * f,
        ];
      }
    }
    return st[st.length - 1].col;
  }
}

class Ctx {
  constructor(canvas, w, h) {
    this._cv = canvas; this._w = w; this._h = h;
    this._buf = new Float64Array(w * h * 4);   // 直 alpha（非预乘）
    this.fillStyle = '#000'; this.strokeStyle = '#000';
    this.lineWidth = 1; this.lineCap = 'butt'; this.globalAlpha = 1;
    this._tx = 0; this._ty = 0;
    this._stack = [];
    this._subpaths = []; this._cur = null;
  }
  _tp(x, y) { return [x + this._tx, y + this._ty]; }
  _col(x, y, style) { return (style instanceof Grad) ? style.colorAt(x, y) : parseColor(style); }
  save() { this._stack.push({ f: this.fillStyle, s: this.strokeStyle, lw: this.lineWidth, ga: this.globalAlpha, tx: this._tx, ty: this._ty }); }
  restore() { const s = this._stack.pop(); if (s) { this.fillStyle = s.f; this.strokeStyle = s.s; this.lineWidth = s.lw; this.globalAlpha = s.ga; this._tx = s.tx; this._ty = s.ty; } }
  translate(x, y) { this._tx += x; this._ty += y; }
  setTransform(a, b, c, d, e, f) { if (a === 1 && d === 1) { this._tx = e; this._ty = f; } }
  createLinearGradient(x0, y0, x1, y1) { const p0 = this._tp(x0, y0), p1 = this._tp(x1, y1); return new Grad('linear', p0[0], p0[1], 0, p1[0], p1[1], 0); }
  createRadialGradient(x0, y0, r0, x1, y1, r1) { const p0 = this._tp(x0, y0), p1 = this._tp(x1, y1); return new Grad('radial', p0[0], p0[1], r0, p1[0], p1[1], r1); }
  // ---- 路径（用户坐标，栅格时变换） ----
  beginPath() { this._subpaths = []; this._cur = null; }
  moveTo(x, y) { this._cur = { pts: [[x, y]], closed: false }; this._subpaths.push(this._cur); }
  lineTo(x, y) { if (!this._cur) return this.moveTo(x, y); this._cur.pts.push([x, y]); }
  closePath() { if (this._cur) this._cur.closed = true; }
  arc(x, y, r, a0, a1) {
    if (a1 - a0 >= Math.PI * 2) a1 = a0 + Math.PI * 2;
    const segs = Math.max(10, Math.ceil((a1 - a0) / 0.4));
    if (!this._cur) this.moveTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r);
    else this.lineTo(x + Math.cos(a0) * r, y + Math.sin(a0) * r);
    for (let i = 1; i <= segs; i++) {
      const a = a0 + (a1 - a0) * i / segs;
      this.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    }
  }
  ellipse(x, y, rx, ry, rot, a0, a1) {
    if (a1 - a0 >= Math.PI * 2) a1 = a0 + Math.PI * 2;
    const cosR = Math.cos(rot), sinR = Math.sin(rot);
    const px = (a) => x + rx * Math.cos(a) * cosR - ry * Math.sin(a) * sinR;
    const py = (a) => y + rx * Math.cos(a) * sinR + ry * Math.sin(a) * cosR;
    const segs = Math.max(10, Math.ceil((a1 - a0) / 0.4));
    if (!this._cur) this.moveTo(px(a0), py(a0));
    else this.lineTo(px(a0), py(a0));
    for (let i = 1; i <= segs; i++) {
      const a = a0 + (a1 - a0) * i / segs;
      this.lineTo(px(a), py(a));
    }
  }
  quadraticCurveTo(cpx, cpy, x, y) {
    if (!this._cur) return;
    const p0 = this._cur.pts[this._cur.pts.length - 1];
    for (let i = 1; i <= 12; i++) {
      const t = i / 12, u = 1 - t;
      this.lineTo(u * u * p0[0] + 2 * u * t * cpx + t * t * x, u * u * p0[1] + 2 * u * t * cpy + t * t * y);
    }
  }
  // ---- 栅格 ----
  _blendPx(xi, yi, col) {
    if (xi < 0 || yi < 0 || xi >= this._w || yi >= this._h) return;
    let a = col[3] * this.globalAlpha;
    if (a <= 0) return;
    const i = (yi * this._w + xi) * 4;
    const da = this._buf[i + 3];
    const outA = a + da * (1 - a);
    if (outA > 0) {
      this._buf[i] = (col[0] * a + this._buf[i] * da * (1 - a)) / outA;
      this._buf[i + 1] = (col[1] * a + this._buf[i + 1] * da * (1 - a)) / outA;
      this._buf[i + 2] = (col[2] * a + this._buf[i + 2] * da * (1 - a)) / outA;
      this._buf[i + 3] = outA;
    }
  }
  _rect(xi0, yi0, xi1, yi1, style) {
    for (let yi = Math.max(0, yi0); yi < Math.min(this._h, yi1); yi++)
      for (let xi = Math.max(0, xi0); xi < Math.min(this._w, xi1); xi++)
        this._blendPx(xi, yi, this._col(xi + 0.5, yi + 0.5, style));
  }
  fillRect(x, y, w, h) {
    const p0 = this._tp(x, y), p1 = this._tp(x + w, y + h);
    this._rect(Math.floor(p0[0]), Math.floor(p0[1]), Math.ceil(p1[0]), Math.ceil(p1[1]), this.fillStyle);
  }
  _inPolys(polys, x, y) {
    let inside = false;
    for (const poly of polys) {
      const n = poly.length;
      for (let i = 0, j = n - 1; i < n; j = i++) {
        const yi = poly[i][1], yj = poly[j][1];
        if ((yi > y) !== (yj > y) && x < (poly[j][0] - poly[i][0]) * (y - yi) / (yj - yi) + poly[i][0]) inside = !inside;
      }
    }
    return inside;
  }
  fill() {
    if (!this._subpaths.length) return;
    const polys = this._subpaths.map(sp => sp.pts.map(p => this._tp(p[0], p[1])));
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const poly of polys) for (const p of poly) {
      if (p[0] < x0) x0 = p[0]; if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1]; if (p[1] > y1) y1 = p[1];
    }
    for (let yi = Math.max(0, Math.floor(y0)); yi <= Math.min(this._h - 1, Math.ceil(y1)); yi++)
      for (let xi = Math.max(0, Math.floor(x0)); xi <= Math.min(this._w - 1, Math.ceil(x1)); xi++)
        if (this._inPolys(polys, xi + 0.5, yi + 0.5)) this._blendPx(xi, yi, this._col(xi + 0.5, yi + 0.5, this.fillStyle));
  }
  _segSquare(x, y, w, style) {
    const r = w / 2;
    for (let yi = Math.floor(y - r); yi <= Math.floor(y + r - 0.001); yi++)
      for (let xi = Math.floor(x - r); xi <= Math.floor(x + r - 0.001); xi++)
        this._blendPx(xi, yi, this._col(xi + 0.5, yi + 0.5, style));
  }
  _strokeSegs(segs, style) {
    const w = Math.max(1, this.lineWidth);
    for (const [a, b] of segs) {
      const dx = b[0] - a[0], dy = b[1] - a[1];
      const len = Math.hypot(dx, dy);
      const steps = Math.max(1, Math.ceil(len / 0.5));
      for (let s = 0; s <= steps; s++) this._segSquare(a[0] + dx * s / steps, a[1] + dy * s / steps, w, style);
    }
  }
  stroke() {
    const segs = [];
    for (const sp of this._subpaths) {
      const pts = sp.pts.map(p => this._tp(p[0], p[1]));
      if (pts.length < 2) continue;
      for (let i = 1; i < pts.length; i++) segs.push([pts[i - 1], pts[i]]);
      if (sp.closed && pts.length > 2) segs.push([pts[pts.length - 1], pts[0]]);
    }
    this._strokeSegs(segs, this.strokeStyle);
  }
  strokeRect(x, y, w, h) {
    const p0 = this._tp(x, y), p1 = this._tp(x + w, y + h);
    const a = p0, b = [p1[0], p0[1]], c = p1, d = [p0[0], p1[1]];
    this._strokeSegs([[a, b], [b, c], [c, d], [d, a]], this.strokeStyle);
  }
  // ---- 采样 ----
  px(x, y) {
    if (x < 0 || y < 0 || x >= this._w || y >= this._h) return null;
    const i = (y * this._w + x) * 4;
    return [this._buf[i], this._buf[i + 1], this._buf[i + 2], this._buf[i + 3]];
  }
  buf() { return this._buf; }
}

class TestCanvas {
  constructor(w, h) { this.width = w; this.height = h; this._ctx = null; }
  getContext() { if (!this._ctx) this._ctx = new Ctx(this, this.width, this.height); return this._ctx; }
}

// ================= 加载游戏脚本（vm，同一全局词法环境） =================
const vctx = {
  console, Math, Date,
  performance: { now: () => Date.now() },
  window: { devicePixelRatio: 1, innerWidth: 800, innerHeight: 600, addEventListener() {} },
  document: { createElement: (tag) => new TestCanvas(1, 1) },
};
vctx.G = { world: null, worldConfig: null, time: 0, cam: { z: 1, px: 0, py: 0 }, settings: {} };
vm.createContext(vctx);
const run = (p) => vm.runInContext(load(p), vctx, { filename: p });
run('data/data.generated.js');
run('data/data.js');
run('data/data-items.js');
run('game/world-config.js');
run('game/world.js');
run('render/render.js');

// 固定种子世界（nauvis 默认配置）
vm.runInContext('G.world = genWorld(20260830)', vctx);

// ================= 在世界中定位各类地形特征 =================
const feats = vm.runInContext(`
(function () {
  const out = {};
  const isW = (x, y) => getTerrain(x, y) === T_WATER;
  for (let R = 0; R <= 240 && !(out.shoreGrass && out.shoreWater && out.deepWater && out.tree && out.cliff && out.waterArea); R += 2) {
    for (let a = 0; a < Math.max(1, R * 8); a++) {
      const th = a / Math.max(1, R * 8) * Math.PI * 2;
      const x = Math.round(Math.cos(th) * R), y = Math.round(Math.sin(th) * R);
      const t = getTerrain(x, y);
      if (!out.shoreGrass && t === T_GRASS && (isW(x, y - 1) || isW(x + 1, y) || isW(x, y + 1) || isW(x - 1, y)))
        out.shoreGrass = { x, y, n: isW(x, y - 1) ? 0 : isW(x + 1, y) ? 1 : isW(x, y + 1) ? 2 : 3 };
      if (!out.shoreWater && t === T_WATER && getTerrain(x, y - 1) !== T_WATER && getTerrain(x, y - 1) === T_GRASS)
        out.shoreWater = { x, y };
      if (!out.deepWater && t === T_WATER) {
        let all = true;
        for (let dy = -1; dy <= 1 && all; dy++) for (let dx = -1; dx <= 1; dx++) if (!isW(x + dx, y + dy)) { all = false; break; }
        if (all) out.deepWater = { x, y };
      }
      if (!out.tree && t === T_TREE) out.tree = { x, y };
      if (!out.cliff && t === T_CLIFF && getTerrain(x, y + 1) === T_GRASS) out.cliff = { x, y };
      if (!out.waterArea && t === T_WATER) {
        let all = true;
        for (let dy = -2; dy <= 2 && all; dy++) for (let dx = -2; dx <= 2; dx++) if (!isW(x + dx, y + dy)) { all = false; break; }
        if (all) out.waterArea = { x, y };
      }
    }
  }
  return out;
})()
`, vctx);

let fails = 0;
const check = (name, ok, detail) => {
  if (ok) console.log('  ✓ ' + name + (detail ? '（' + detail + '）' : ''));
  else { fails++; console.log('  ✗ ' + name + (detail ? '（' + detail + '）' : '')); }
};

console.log('地形特征定位：', JSON.stringify(feats));
if (!feats.shoreGrass || !feats.shoreWater || !feats.deepWater || !feats.tree || !feats.cliff || !feats.waterArea) {
  console.error('✗ 世界中未能定位全部地形特征（水岸/深水/树/峭壁），无法继续断言');
  process.exit(1);
}

// 渲染包含岸线/树的 chunk
const TILE = 32, CHUNK = 32;
const chunkCanvasCache = new Map();
const renderChunk = (cx, cy) => {
  const key = cx + ',' + cy;
  if (chunkCanvasCache.has(key)) return chunkCanvasCache.get(key);
  const cv = new TestCanvas(CHUNK * TILE, CHUNK * TILE);
  const cctx = cv.getContext();
  vctx.VCTX = cctx; vctx.VCX = cx; vctx.VCY = cy;
  vm.runInContext('drawChunkTerrainInto(VCTX, VCX, VCY)', vctx);
  chunkCanvasCache.set(key, cctx);
  return cctx;
};
const chunkOf = (x, y) => [Math.floor(x / CHUNK), Math.floor(y / CHUNK)];
// 采样某个世界瓦片内的像素（自动渲染所在 chunk）
const tilePx = (tx, ty, ox, oy) => {
  const [cx, cy] = chunkOf(tx, ty);
  const cctx = renderChunk(cx, cy);
  const lx = ((tx % CHUNK) + CHUNK) % CHUNK * TILE, ly = ((ty % CHUNK) + CHUNK) % CHUNK * TILE;
  return cctx.px(lx + ox, ly + oy);
};

const [scx, scy] = chunkOf(feats.shoreGrass.x, feats.shoreGrass.y);
const cctx = renderChunk(scx, scy);
console.log('渲染岸线 chunk (' + scx + ',' + scy + ')');

// 1. 深水 vs 近岸浅水：近岸像素明显更浅且偏沙色
const dw = feats.deepWater, sw = feats.shoreWater;
const deepPx = tilePx(dw.x, dw.y, 16, 16), shorePx = tilePx(sw.x, sw.y, 16, 2);
check('湖心深水着色（偏深蓝）', deepPx && deepPx[0] < 70 && deepPx[2] > deepPx[0], 'R=' + (deepPx && deepPx[0].toFixed(1)));
check('近岸浅滩（近岸像素明显浅于湖心）', shorePx && deepPx && shorePx[0] - deepPx[0] > 15,
  '近岸 R=' + (shorePx && shorePx[0].toFixed(1)) + ' / 湖心 R=' + (deepPx && deepPx[0].toFixed(1)));

// 2. 陆侧沙带：草地邻水边缘应为沙色
const sg = feats.shoreGrass;
const sandPx = sg.n === 0 ? tilePx(sg.x, sg.y, 16, 3)
  : sg.n === 1 ? tilePx(sg.x, sg.y, TILE - 3, 16)
  : sg.n === 2 ? tilePx(sg.x, sg.y, 16, TILE - 3)
  : tilePx(sg.x, sg.y, 3, 16);
check('陆侧滩涂沙带', sandPx && sandPx[0] > 170 && sandPx[1] > 145 && sandPx[2] > 100,
  'RGB=' + (sandPx ? sandPx.slice(0, 3).map(v => v.toFixed(0)).join(',') : 'null'));

// 3. 草地覆盖度分带：草稀露土（黄褐）与草密成片（绿）交错，底色多样
// 采样 3×3 chunk（覆盖大尺度斑块噪声），统计草地瓦片底色的泥/草构成
let dirtCnt = 0, grassCnt = 0, grassTotal = 0;
const colors = new Set();
for (let i = 0; i < 1500; i++) {
  const tx = (scx - 1) * CHUNK + Math.floor(vm.runInContext('hash2(' + (i * 7.3 + 0.5) + ',' + (i * 2.1) + ')', vctx) * CHUNK * 3);
  const ty = (scy - 1) * CHUNK + Math.floor(vm.runInContext('hash2(' + (i * 3.7) + ',' + (i * 9.2 + 0.5) + ')', vctx) * CHUNK * 3);
  if (vm.runInContext('getTerrain(' + tx + ',' + ty + ')', vctx) !== 0) continue;   // T_GRASS
  const [cx, cy] = chunkOf(tx, ty);
  const cctxS = renderChunk(cx, cy);
  const p = cctxS.px(((tx % CHUNK) + CHUNK) % CHUNK * TILE + 16, ((ty % CHUNK) + CHUNK) % CHUNK * TILE + 16);
  if (!p) continue;
  grassTotal++;
  colors.add(Math.round(p[0] / 8) + ',' + Math.round(p[1] / 8) + ',' + Math.round(p[2] / 8));
  if (p[0] > p[1] + 6 && p[1] > p[2] + 6) dirtCnt++;          // 黄褐泥土（R>G>B）
  else if (p[1] > p[0] + 8 && p[1] > p[2] + 8) grassCnt++;    // 绿色草
}
const dirtRatio = grassTotal ? dirtCnt / grassTotal : 0;
const grassRatio = grassTotal ? grassCnt / grassTotal : 0;
check('草地露土（黄褐泥土像素 ≥ 8%）', dirtRatio >= 0.08, (dirtRatio * 100).toFixed(1) + '% 泥土');
check('草地密草（绿色像素 ≥ 8%）', grassRatio >= 0.08, (grassRatio * 100).toFixed(1) + '% 绿草');
check('草地噪声斑块（底色多样性 ≥ 8 档）', colors.size >= 8, 'distinct=' + colors.size);

// 4. 树冠像素为绿色
const tr = feats.tree;
let greenCnt = 0;
for (const [ox, oy] of [[16, 8], [12, 12], [20, 12], [16, 16], [10, 6]]) {
  const p = tilePx(tr.x, tr.y, ox, oy);
  if (p && p[1] > p[0] + 10 && p[1] > p[2] + 10) greenCnt++;
}
check('树冠多层绿色叠加', greenCnt >= 3, greenCnt + '/5 采样点为绿色');

// 5. 确定性：同 chunk 两次渲染逐像素一致（绕过缓存直接再渲一次）
const cctx2 = (() => {
  const cv = new TestCanvas(CHUNK * TILE, CHUNK * TILE);
  const c2 = cv.getContext();
  vctx.VCTX = c2; vctx.VCX = scx; vctx.VCY = scy;
  vm.runInContext('drawChunkTerrainInto(VCTX, VCX, VCY)', vctx);
  return c2;
})();
let same = true;
for (let i = 0; i < cctx.buf().length; i++) if (cctx.buf()[i] !== cctx2.buf()[i]) { same = false; break; }
check('渲染确定性（两次结果一致）', same);

// 6. 峭壁投影：崖脚下方像素比远处更暗
const cl = feats.cliff;
const [ccx, ccy] = chunkOf(cl.x, cl.y);
const cctxC = renderChunk(ccx, ccy);
const cxp = ((cl.x % CHUNK) + CHUNK) % CHUNK * TILE, cyp = ((cl.y % CHUNK) + CHUNK) % CHUNK * TILE;
if (cl.y + 1 < (ccy + 1) * CHUNK) {   // 下一格在同一 chunk 内才能采样
  const lum = (x, y) => { const p = cctxC.px(x, y); return p ? 0.3 * p[0] + 0.55 * p[1] + 0.15 * p[2] : null; };
  let bandLum = 0, farLum = 0, n = 0;
  for (const ox of [10, 16, 22]) {
    const a = lum(cxp + ox, cyp + TILE + 2), b = lum(cxp + ox, cyp + TILE + 9);
    if (a != null && b != null) { bandLum += a; farLum += b; n++; }
  }
  if (n) check('峭壁崖脚投影（下方 6px 明显变暗）', bandLum / n < farLum / n - 6,
    '投影带亮度=' + (bandLum / n).toFixed(1) + ' / 远处=' + (farLum / n).toFixed(1));
  else check('峭壁崖脚投影', false, '采样失败');
} else {
  check('峭壁崖脚投影', false, '峭壁位于 chunk 底行，需另寻样本');
}

// 7. 矿点：矿团柔和圆斑 + 矿色颗粒
const oreCv = new TestCanvas(64, 64);
const oreCtx = oreCv.getContext();
vctx.VCTX = oreCtx;
vm.runInContext('drawOreDots(VCTX, 16, 16, "iron-ore", 900, 5, 7)', vctx);
let orePx = 0, blobA = 0;
for (let y = 16; y < 48; y++) for (let x = 16; x < 48; x++) {
  const p = oreCtx.px(x, y);
  if (!p) continue;
  if (Math.abs(p[0] - 107) < 30 && Math.abs(p[1] - 143) < 30 && Math.abs(p[2] - 212) < 30) orePx++;
  if (p[3] > 0.05 && p[3] < 0.9) blobA++;
}
check('矿色颗粒（≥ 6 像素接近矿色）', orePx >= 6, 'px=' + orePx);
check('矿团柔和底斑（半透明覆盖存在）', blobA >= 8, 'px=' + blobA);

// 8. 水面波光动画
const wa = feats.waterArea;
const wCv = new TestCanvas(5 * TILE, 5 * TILE);
const wCtx = wCv.getContext();
vm.runInContext('G.time = 2', vctx);
wCtx.translate(-wa.x * TILE, -wa.y * TILE);
vctx.VCTX = wCtx;
vm.runInContext('drawWaterAnimation(VCTX, ' + wa.x + ',' + wa.y + ',' + (wa.x + 4) + ',' + (wa.y + 4) + ')', vctx);
let lit = 0;
for (let y = 0; y < 5 * TILE; y++) for (let x = 0; x < 5 * TILE; x++) {
  const p = wCtx.px(x, y);
  if (p && p[3] > 0.02) lit++;
}
check('水面波光动画（波光像素 ≥ 5）', lit >= 5, 'px=' + lit);

// 9. 地形缓存失效（跨界岸线刷新）：调用不抛错即可
vm.runInContext('invalidateTerrainChunk(0, 0); invalidateTerrainChunk(31, 31); invalidateTerrainChunk(32, 5)', vctx);
check('invalidateTerrainChunk 跨界失效调用无异常', true);

console.log('');
if (fails === 0) {
  console.log('✅ 地形渲染回归全部通过');
} else {
  console.log('❌ 地形渲染回归存在 ' + fails + ' 项失败');
  process.exit(1);
}
