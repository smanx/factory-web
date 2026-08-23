'use strict';

function entKey(x, y) { return x + ',' + y; }
function entAt(x, y) { return G.grid.get(entKey(x, y)); }
function dirFromVec(dx, dy) {
  return dx === 1 ? 0 : dy === 1 ? 1 : dx === -1 ? 2 : 3;
}

function addEnt(e) {
  G.ents.push(e);
  for (let dy = 0; dy < e.h; dy++)
    for (let dx = 0; dx < e.w; dx++)
      G.grid.set(entKey(e.x + dx, e.y + dy), e);
}

function removeEnt(e) {
  const i = G.ents.indexOf(e);
  if (i >= 0) G.ents.splice(i, 1);
  for (let dy = 0; dy < e.h; dy++)
    for (let dx = 0; dx < e.w; dx++) {
      const k = entKey(e.x + dx, e.y + dy);
      if (G.grid.get(k) === e) G.grid.delete(k);
    }
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
  static restore(s) {
    const e = new this(s.type, s.x, s.y);
    e.dir = s.dir | 0;
    return e;
  }
}
