'use strict';

// ===== 整数化空间网格 key（P1 优化）=====
// 用单个 32 位整数编码 (x,y) 替代高频字符串拼接。范围 ±32767 内的瓦片坐标
// 足够覆盖本游戏玩法（更大区域也可扩展到 ±2^15）。相对坐标偏移后可安全做位运算。
const ENT_KEY_OFF = 32768;
function entKey(x, y) { return ((x + ENT_KEY_OFF) << 16) | (y + ENT_KEY_OFF); }
function entAt(x, y) { return G.grid.get(entKey(x, y)); }

// ===== 全局网格版本号（P1 优化）=====
// 任何实体增删都会使“依赖邻居布局的派生结果”失效（如地下带配对关系）。
// 用一个单调递增版本号做惰性失效：派生结果缓存版本号，访问时比对，
// 不一致才重算。建造/拆除是低频事件，而配对查询是每帧高频操作，
// 相比“每次增删主动广播失效”更简单且无遗漏。
let _gridVer = 1;
function gridVersion() { return _gridVer; }
function dirFromVec(dx, dy) {
  return dx === 1 ? 0 : dy === 1 ? 1 : dx === -1 ? 2 : 3;
}

// 实体增删会让邻居关系改变，进而影响附近传送带的输入侧判定。
// 这里在 (x,y) 的 w×h 区域向外扩 2 格范围内，把命中的传送带缓存失效。
function invalidateBeltInputNear(x, y, w, h) {
  const seen = new Set();
  for (let dy = -2; dy < h + 2; dy++)
    for (let dx = -2; dx < w + 2; dx++) {
      const t = entAt(x + dx, y + dy);
      if (!t || seen.has(t)) continue;
      seen.add(t);
      if (typeof t.__inpCached === 'boolean') { t.__inpCached = false; t.__inp = undefined; }
    }
}

// ===== 区块（桶）空间索引（P0 优化）=====
// 除瓦片级 G.grid 外，再加一层粗粒度桶索引（BUCK=16 瓦片见方）。
// 渲染与更新只遍历视野/活跃的桶，避免对数千实体的 G.ents 全量线性扫描。
// G.buckets: bucketKey -> Set<Entity>
const BUCK = 16;
// 桶坐标 = 瓦片坐标 >> 4（16×16 一桶）。用偏移量保证正负都能编码为唯一整数。
const BUCK_OFF = 4096;   // 2^12，覆盖桶坐标 ±4095（即 ±65536 瓦片范围）
function bucketKey(x, y) { return ((x >> 4) + BUCK_OFF) * 8192 + ((y >> 4) + BUCK_OFF); }
function bucketXOf(k) { return ((k / 8192) | 0) - BUCK_OFF; }
function bucketYOf(k) { return (k % 8192) - BUCK_OFF; }
function ensureBucket(k) {
  let s = G.buckets.get(k);
  if (!s) { s = new Set(); G.buckets.set(k, s); }
  return s;
}
// 返回覆盖 (x0,y0)-(x1,y1)（含）矩形区域的所有桶 key（去重）。
// 传入 out 时写入并复用该数组（渲染每帧调用，避免分配，P2 优化）。
function bucketKeysIn(x0, y0, x1, y1, out) {
  const keys = out || [];
  if (!out) keys.length = 0;
  const b0x = x0 >> 4, b0y = y0 >> 4, b1x = x1 >> 4, b1y = y1 >> 4;
  for (let by = b0y; by <= b1y; by++)
    for (let bx = b0x; bx <= b1x; bx++) keys.push(((bx + BUCK_OFF) * 8192) + (by + BUCK_OFF));
  return keys;
}

// 墓碑标记 + 惰性清理（P0 优化）：
// removeEnt 不再对数组做 indexOf+splice（拆/蓝图高频时 O(n)），
// 改为打上 _dead 标记并从 grid/桶移除；当墓碑积累到阈值时才一次性压缩数组。
let _tombCount = 0;
function _compactEnts() {
  G.ents = G.ents.filter(e => !e._dead);
  _tombCount = 0;
}

function addEnt(e) {
  if (e._dead) e._dead = false;
  G.ents.push(e);
  ensureBucket(bucketKey(e.x, e.y)).add(e);
  for (let dy = 0; dy < e.h; dy++)
    for (let dx = 0; dx < e.w; dx++)
      G.grid.set(entKey(e.x + dx, e.y + dy), e);
  _gridVer++;
  invalidateBeltInputNear(e.x, e.y, e.w, e.h);
  // 电力增量注册表同步维护（P1 优化）
  if (typeof regPowerEnt === 'function') regPowerEnt(e);
}

function removeEnt(e) {
  if (e._dead) return;
  e._dead = true;
  _tombCount++;
  if (_tombCount >= 128) _compactEnts();   // 墓碑积累到阈值再压缩，避免频繁 splice
  const b = bucketKey(e.x, e.y);
  const bs = G.buckets.get(b);
  if (bs) { bs.delete(e); if (!bs.size) G.buckets.delete(b); }
  for (let dy = 0; dy < e.h; dy++)
    for (let dx = 0; dx < e.w; dx++) {
      const k = entKey(e.x + dx, e.y + dy);
      if (G.grid.get(k) === e) G.grid.delete(k);
    }
  _gridVer++;
  invalidateBeltInputNear(e.x, e.y, e.w, e.h);
  // 电力增量注册表同步移除
  if (typeof unregPowerEnt === 'function') unregPowerEnt(e);
}

// ===== 流体端口方向表：管道/流体设备共用 =====
const PIPE_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// side(0东1南2西3北) 经 dir 旋转后的世界方向向量
const SIDE_VEC = { 0: [1, 0], 1: [0, 1], 2: [-1, 0], 3: [0, -1] };
function sideVec(side, dir) { return SIDE_VEC[(side + (dir | 0)) % 4]; }

// 获取实体某一世界方向(side)整条边上的相邻实体（去重、不含自身）
// half 可选 'L'/'R'：仅返回该边前半/后半（沿边方向），南/北边即世界左侧/右侧
function neighborsOnSide(e, side, half) {
  const res = new Set();
  if (side === 1) {          // 南：y = e.y + e.h
    for (let dx = 0; dx < e.w; dx++) {
      if (half === 'L' && dx >= e.w / 2) continue;
      if (half === 'R' && dx < e.w / 2) continue;
      const t = entAt(e.x + dx, e.y + e.h); if (t && t !== e) res.add(t);
    }
  } else if (side === 3) {   // 北：y = e.y - 1
    for (let dx = 0; dx < e.w; dx++) {
      if (half === 'L' && dx >= e.w / 2) continue;
      if (half === 'R' && dx < e.w / 2) continue;
      const t = entAt(e.x + dx, e.y - 1); if (t && t !== e) res.add(t);
    }
  } else if (side === 0) {   // 东：x = e.x + e.w
    for (let dy = 0; dy < e.h; dy++) {
      if (half === 'L' && dy >= e.h / 2) continue;
      if (half === 'R' && dy < e.h / 2) continue;
      const t = entAt(e.x + e.w, e.y + dy); if (t && t !== e) res.add(t);
    }
  } else {                   // 西：x = e.x - 1
    for (let dy = 0; dy < e.h; dy++) {
      if (half === 'L' && dy >= e.h / 2) continue;
      if (half === 'R' && dy < e.h / 2) continue;
      const t = entAt(e.x - 1, e.y + dy); if (t && t !== e) res.add(t);
    }
  }
  return res;
}

// 获取设备某条边(side，0东1南2西3北)上第 cell 个格子（沿边 0基偏移）相邻的实体
function neighborOnSideCell(e, side, cell) {
  if (side === 1) return entAt(e.x + cell, e.y + e.h);      // 南
  if (side === 3) return entAt(e.x + cell, e.y - 1);        // 北
  if (side === 0) return entAt(e.x + e.w, e.y + cell);      // 东
  return entAt(e.x - 1, e.y + cell);                        // 西
}

// 遍历给定桶集合内的实体（去重，跳过墓碑）。
// seen 集合复用模块级实例（调用方不嵌套、不重入），避免每帧 new Set 的 GC 压力（P2 优化）。
const _bucketSeen = new Set();
function forEachEntInBuckets(keys, fn) {
  const seen = _bucketSeen;
  seen.clear();
  for (const k of keys) {
    const s = G.buckets.get(k);
    if (!s) continue;
    for (const e of s) {
      if (e._dead || seen.has(e)) continue;
      seen.add(e);
      fn(e);
    }
  }
}

// 遍历实体正交相邻格上的实体（去重，不含斜角）
function forEachNeighborEnt(e, fn) {
  const seen = new Set();
  for (let dx = -1; dx <= e.w; dx++)
    for (let dy = -1; dy <= e.h; dy++) {
      const inX = dx >= 0 && dx < e.w, inY = dy >= 0 && dy < e.h;
      if (inX && inY) continue;      // 自身
      if (!inX && !inY) continue;    // 斜角不算相邻
      const t = entAt(e.x + dx, e.y + dy);
      if (!t || t === e || seen.has(t)) continue;
      seen.add(t);
      fn(t);
    }
}

class Entity {
  constructor(type, x, y) {
    this.type = type;
    this.def = BUILD_DEFS[type];
    this.w = this.def.w;
    this.h = this.def.h;
    this.x = x; this.y = y;
    this.dir = 0;
  }
  get solid() { return this.def.solid; }
  applyDir() { this.w = this.def.w; this.h = this.def.h; }
  update(dt) {}
  peekItem() { return null; }
  giveItem(item) { return false; }
  takeItem() { return null; }
  countOf(item) { return 0; }
  takeItemOf(item) { return null; }
  // 拆除返还清单：默认仅自身；各设备在自己的文件里覆盖补充内部物资
  contents() { return [[this.type, 1]]; }
  // 面板"取出全部"默认实现：清空输出缓存 outp（炉/装配/炼油/化工类直接继承）
  takeAll() {
    if (!this.outp) return [];
    const rows = [];
    for (const k of Object.keys(this.outp)) { rows.push([k, this.outp[k]]); delete this.outp[k]; }
    return rows;
  }
  serialize() {
    return { type: this.type, x: this.x, y: this.y, dir: this.dir };
  }
  // 蓝图专用：仅序列化建筑本身（类型/坐标/方向），
  // 不含建筑内部原料、输出、燃料、流体，以及传送带上的物品。
  blueprint() {
    return { type: this.type, x: this.x, y: this.y, dir: this.dir };
  }
  static restore(s) {
    const e = new this(s.type, s.x, s.y);
    e.dir = s.dir | 0;
    return e;
  }
}
