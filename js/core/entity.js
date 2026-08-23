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
