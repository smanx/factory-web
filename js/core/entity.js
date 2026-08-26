'use strict';

// ===== 原地过滤（P0 优化）=====
// 高频每帧清理（子弹/掉落/机器人等）避免每次 filter 分配新数组造成 GC 压力：
// 仅当存在应移除项时才原地压缩，语义与 Array.prototype.filter 一致（保留顺序、只留保留项）。
// 返回过滤后的数组；若全部存活则返回原数组引用（零分配）。
function compactFilter(arr, keep) {
  if (!arr || arr.length === 0) return arr;
  let j = 0;
  for (let i = 0; i < arr.length; i++) {
    if (keep(arr[i])) arr[j++] = arr[i];
  }
  if (j === arr.length) return arr;      // 全存活，零分配
  arr.length = j;                        // 原地截断，回收多余槽位
  return arr;
}

// ===== 整数化空间网格 key（P1 优化）=====
// 用单个 32 位整数编码 (x,y) 替代高频字符串拼接。范围 ±32767 内的瓦片坐标
// 足够覆盖本游戏玩法（更大区域也可扩展到 ±2^15）。相对坐标偏移后可安全做位运算。
const ENT_KEY_OFF = 32768;
function entKey(x, y) { return ((x + ENT_KEY_OFF) << 16) | (y + ENT_KEY_OFF); }
function entAt(x, y) { return G.grid.get(entKey(x, y)); }
function dirFromVec(dx, dy) {
  return dx === 1 ? 0 : dy === 1 ? 1 : dx === -1 ? 2 : 3;
}

// 实体增删会让邻居关系改变，进而影响附近传送带的输入侧判定。
// 这里在 (x,y) 的 w×h 区域向外扩 2 格范围内，把命中的传送带缓存失效。
// 该函数在 addEnt/removeEnt（拆/蓝图/建造高频）时被调用，为避免每次 new Set 造成 GC 压力，
// 复用模块级去重 Set（P1 优化）：调用前 clear，遍历后与旧逻辑语义一致（同实体只处理一次）。
let _beltSeenSet = new Set();
function invalidateBeltInputNear(x, y, w, h) {
  const seen = _beltSeenSet;
  seen.clear();
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
// 热路径复用：传入 out 数组时直接回填（先清空），避免每帧分配新数组（GC 压力）。
function bucketKeysIn(x0, y0, x1, y1, out) {
  const keys = out || [];
  keys.length = 0;
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
  invalidateBeltInputNear(e.x, e.y, e.w, e.h);
  // 电力增量注册表同步移除
  if (typeof unregPowerEnt === 'function') unregPowerEnt(e);
}

// ===== 流体端口方向表：管道/流体设备共用 =====
const PIPE_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// side(0东1南2西3北) 经 dir 旋转后的世界方向向量
const SIDE_VEC = { 0: [1, 0], 1: [0, 1], 2: [-1, 0], 3: [0, -1] };
function sideVec(side, dir) { return SIDE_VEC[(side + (dir | 0)) % 4]; }

// 端口格旋转辅助：非方形设备（如热交换器/汽轮机/锅炉/蒸汽机）在建造时可旋转/翻转，
// 其端口（进水口/出汽口等）必须随 dir 一起旋转才能保持正确朝向。
// 传入默认朝向(0)下、相对占地(w0×h0)的局部格 (lx, ly)（可为负/越界以表示贴边的外部口），
// 返回经实体当前 dir 旋转后的世界格 {x, y}。0东 1南 2西 3北，旋转 90° 顺时针。
function rotCell(e, lx, ly) {
  const d = (e.dir | 0) % 4;
  const x = e.x, y = e.y;
  const w0 = e.def.w, h0 = e.def.h;
  switch (d) {
    case 0: return { x: x + lx, y: y + ly };
    case 1: return { x: x + (h0 - 1 - ly), y: y + lx };
    case 2: return { x: x + (w0 - 1 - lx), y: y + (h0 - 1 - ly) };
    default: return { x: x + ly, y: y + (w0 - 1 - lx) };
  }
}
// 端口朝向(默认 side0)经 dir 旋转后的世界朝向
function rotSide(side0, dir) { return ((side0 + (dir | 0)) % 4 + 4) % 4; }

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
// 遍历给定桶集合内的实体（去重，跳过墓碑）。
// 热路径复用：可选传入外部 seen Set，避免每帧/每次调用分配新 Set（GC 压力）。
function forEachEntInBuckets(keys, fn, seen) {
  if (!seen) seen = new Set();
  else seen.clear();
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
    // 建筑耐久度（对齐《异星工厂》）：每个可建造建筑有 HP，受敌人攻击会损毁，可用修理包修复
    this.maxhp = (typeof buildingMaxHp === 'function') ? buildingMaxHp(type) : 100;
    this.hp = this.maxhp;
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
    const s = { type: this.type, x: this.x, y: this.y, dir: this.dir };
    if (this.hp !== undefined && this.hp < this.maxhp) s.hp = Math.max(1, Math.round(this.hp));
    return s;
  }
  // 蓝图专用：仅序列化建筑本身（类型/坐标/方向），
  // 不含建筑内部原料、输出、燃料、流体，以及传送带上的物品。
  blueprint() {
    return { type: this.type, x: this.x, y: this.y, dir: this.dir };
  }
  static restore(s) {
    const e = new this(s.type, s.x, s.y);
    e.dir = s.dir | 0;
    // 按方向校正占地宽高（对 rotSwap 类设备如热交换器/汽轮机/锅炉/蒸汽机/分流器/抽水机，
    // 旋转后宽高需随 dir 交换；否则读档后旋转状态会复原/错乱）。幂等，对普通设备无副作用。
    e.applyDir();
    if (typeof s.hp === 'number' && s.hp > 0 && s.hp < e.maxhp) e.hp = s.hp;
    return e;
  }
}

// ===== 建筑受击 / 损毁 / 修复（对齐《异星工厂》建筑耐久度机制）=====
// 敌人攻击基地建筑；建筑 HP 归零即被摧毁，其内部物资与自身掉落地面（不丢失）。
// 玩家手持修理包点击受损建筑可修复。

// 建筑受击：扣减 HP，归零则摧毁并掉落物资。
function damageBuilding(e, dmg) {
  if (!e || e._dead) return;
  if (e.maxhp <= 0) return;           // 不可损坏的实体（若有）
  // 蜘蛛机器人装备护盾：优先消耗装备电网电力吸收伤害（对齐《异星工厂》能量护盾）
  if (typeof e.spiderShieldAbsorb === 'function') dmg = e.spiderShieldAbsorb(dmg);
  // 装甲车/坦克装备护盾：载具装有能量护盾时，消耗载具装备电网电力吸收伤害（蜘蛛机走上面的专属逻辑）
  if (typeof e.spiderShieldAbsorb !== 'function' && typeof e.vehShieldAbsorb === 'function' && e.equipGrid && e.equipGrid.length) dmg = e.vehShieldAbsorb(dmg);
  e.hp = (e.hp === undefined ? e.maxhp : e.hp) - dmg;
  if (e.hp > 0) return e.hp;
  // HP 归零 → 摧毁
  e.hp = 0;
  destroyBuilding(e);
  return 0;
}

// 摧毁建筑：掉落内部物资与自身，然后从世界移除。
function destroyBuilding(e) {
  if (!e || e._dead) return;
  if (typeof buildingDropLoot === 'function') buildingDropLoot(e);
  // 火车车厢/载具等被摧毁时清理关联状态
  if (typeof unregisterVehicle === 'function') unregisterVehicle(e);
  removeEnt(e);
  if (typeof toast === 'function') toast((ITEMS[e.type] ? ITEMS[e.type].name : e.type) + ' 被摧毁');
}

// 建筑损毁掉落：把建筑自身（或其返还清单）与内部物资作为地面掉落物抛出。
function buildingDropLoot(e) {
  if (!G.lootDrops) G.lootDrops = [];
  const cx = (e.x + e.w / 2) * TILE, cy = (e.y + e.h / 2) * TILE;
  let items;
  try { items = (typeof e.contents === 'function') ? e.contents() : [[e.type, 1]]; }
  catch (err) { items = [[e.type, 1]]; }
  if (!items || !items.length) items = [[e.type, 1]];
  for (const [id, n] of items) {
    if (!n || n <= 0 || !ITEMS[id]) continue;
    // 单个掉落物最大堆叠 10，超出拆分为多个掉落物
    let left = n;
    while (left > 0) {
      const amt = Math.min(10, left);
      left -= amt;
      G.lootDrops.push({
        x: cx + (Math.random() - 0.5) * 30,
        y: cy + (Math.random() - 0.5) * 30,
        id: id, n: amt, vx: (Math.random() - 0.5) * 40, vy: -20 - Math.random() * 20,
        t: 0, life: 20
      });
    }
  }
}

// 修复建筑：恢复指定 HP，返回是否产生了修复（用于判定是否消耗修理包使用次数）。
function repairBuilding(e, amount) {
  if (!e || e._dead || e.maxhp <= 0) return 0;
  if (e.hp >= e.maxhp) return 0;
  const before = e.hp;
  e.hp = Math.min(e.maxhp, e.hp + amount);
  return e.hp - before;
}

// 建筑是否受损（HP 未满）。
function isDamaged(e) { return !!(e && e.maxhp > 0 && e.hp !== undefined && e.hp < e.maxhp); }
