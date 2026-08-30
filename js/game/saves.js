'use strict';

// ===== 多存档管理系统（IndexedDB 存储） =====
// 存档分为两类：
//   - 自动存档（auto）：固定 3 个槽位，每次自动保存写入最新一个；超 3 个删除最旧。
//   - 用户存档（user）：最多 MAX_USER_SAVES 个，由用户在设置面板中自行新建 / 覆盖 / 读取 / 删除。
//
// ===== 存储结构（v2：拆分 + 压缩） =====
// 旧版把全部存档连同完整游戏数据放进"单条整包记录"（主键 registry），任意一次写入都要整体重写，
// 磁盘/配额不足时一次失败就可能牵连所有存档。现改为两条路径：
//   - 主键 'meta'：存档注册表（轻量元数据 id/name/type/num/time/seed/sizeBytes，不含游戏数据）
//   - 主键 'save:<id>'：单条存档的游戏数据（JSON → gzip 压缩字节，每条独立存取）
// 这样一次保存失败只影响正在写的那一条，其余存档不受影响；删除/写满也不会波及已有存档。
//
// 兼容旧档：首次打开时若发现旧版整包记录（主键 registry），自动原子拆分为新结构，
// 旧档游戏数据原样保留；迁移失败的窗口期仍然可以直接读旧记录，不会丢档。

// ===== IndexedDB 基础设施 =====
const SAVES_DB_NAME = 'factory-proto-saves';
const SAVES_DB_VERSION = 1;
const SAVES_STORE = 'registry';
// 元数据注册表记录主键
const SAVES_META_KEY = 'meta';
// 单条存档载荷记录主键前缀：save:<id>
const SAVES_DATA_PREFIX = 'save:';
// 旧版"整包注册表"记录主键（仅用于检测与迁移旧档）
const LEGACY_REGISTRY_KEY = 'registry';
// 存档注册表键（兼容旧值：首次升级时从 localStorage 迁移）
const SAVES_KEY = 'factory-proto-saves-v1';

// 自动存档槽位数
const AUTO_SLOTS = 3;
// 用户存档最大数量
const MAX_USER_SAVES = 10;

// 兼容旧的单存档键：首次升级时把旧存档迁移为一个用户存档
const LEGACY_SAVE_KEY = 'factory-proto-save-v1';

let _db = null;
// 进程内写穿透缓存：最近一次成功读/写的注册表。
// DB 读取临时失败时回退到该缓存，避免把"读失败"误判成"没有存档"后整包覆盖，造成丢档。
let _metaCache = null;
// 旧版整包键是否已清理过（每个会话只清理一次，避免反复删）
let _legacyCleaned = false;

// 打开（或创建）IndexedDB 数据库
function openSaveDB() {
  return new Promise((resolve, reject) => {
    if (_db) { resolve(_db); return; }
    let req;
    try {
      req = indexedDB.open(SAVES_DB_NAME, SAVES_DB_VERSION);
    } catch (e) {
      reject(e);
      return;
    }
    req.onupgradeneeded = function (ev) {
      const db = ev.target.result;
      if (!db.objectStoreNames.contains(SAVES_STORE)) {
        db.createObjectStore(SAVES_STORE);
      }
    };
    req.onsuccess = function () {
      _db = req.result;
      resolve(_db);
    };
    req.onerror = function () {
      reject(req.error || new Error('打开存档数据库失败'));
    };
    req.onblocked = function () {
      reject(new Error('存档数据库被占用，请关闭其他页面后重试'));
    };
  });
}

// 事务内读取单个主键（不存在返回 undefined；出错 reject）
function storeGet(db, key) {
  return new Promise((res, rej) => {
    const tx = db.transaction(SAVES_STORE, 'readonly');
    const store = tx.objectStore(SAVES_STORE);
    const req = store.get(key);
    req.onsuccess = function () { res(req.result); };
    req.onerror = function () { rej(req.error); };
  });
}

// ===== gzip 压缩 / 解压（浏览器原生 CompressionStream / DecompressionStream） =====
// 压缩失败或浏览器不支持时返回 null，由调用方回退为不压缩存储，保证存档写入不因缺少压缩而失败。

// 把 ReadableStream 完整读入 Uint8Array（私有实现，避免与 ui-hud.js 的同名全局碰撞）
async function _readStreamToBytes(stream) {
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.length; }
  return buf;
}

// gzip 压缩：把字符串压缩为 Uint8Array；不可用返回 null
async function gzipCompressBytes(text) {
  try {
    if (typeof CompressionStream === 'undefined' || typeof Blob === 'undefined'
      || typeof Blob.prototype.stream !== 'function') return null;
    const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
    return await _readStreamToBytes(stream);
  } catch (e) { return null; }
}

// gzip 解压：把 Uint8Array 解压为字符串；不可用返回 null
async function gzipDecompressBytes(bytes) {
  try {
    if (typeof DecompressionStream === 'undefined' || typeof Blob === 'undefined'
      || typeof Blob.prototype.stream !== 'function') return null;
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    const buf = await _readStreamToBytes(stream);
    return new TextDecoder('utf-8').decode(buf);
  } catch (e) { return null; }
}

// 生成一个用户存档 id
function makeUserSaveId() {
  return 'user-' + Date.now().toString(36) + '-' + ((Math.random() * 1e6) | 0).toString(36);
}

// 自动存档槽位 id：auto-0 / auto-1 / auto-2
function autoSlotId(idx) {
  return 'auto-' + idx;
}

// 获取自动存档按新旧排序的 id 列表（新的在前）
function autoSlotIdsNewestFirst(reg) {
  const list = [];
  for (let i = 0; i < AUTO_SLOTS; i++) {
    const id = autoSlotId(i);
    if (reg[id]) list.push(id);
  }
  list.sort((a, b) => (reg[b].time || 0) - (reg[a].time || 0));
  return list;
}

// ===== 存档载荷打包 / 解包（JSON → gzip 字节） =====
const SAVE_PAYLOAD_V = 1; // 载荷格式版本

// 把游戏数据打包为可存储载荷：优先 gzip 压缩，浏览器不支持时退化为原始 JSON 字符串。
// 返回 { sizeBytes（未压缩 JSON 的 UTF-8 字节数）, payload }
async function packSaveData(data) {
  const json = JSON.stringify(data);
  const size = jsonUtf8Size(json);
  const z = await gzipCompressBytes(json);
  if (z) return { sizeBytes: size, payload: { v: SAVE_PAYLOAD_V, size: size, z: z } };
  return { sizeBytes: size, payload: { v: SAVE_PAYLOAD_V, size: size, z: null, raw: json } };
}

// 把存储载荷还原为游戏数据对象；失败返回 null
async function unpackSavePayload(view) {
  if (!view || typeof view !== 'object' || view.v !== SAVE_PAYLOAD_V) return null;
  try {
    if (view.z) {
      const txt = await gzipDecompressBytes(view.z);
      if (txt === null) return null;
      return JSON.parse(txt);
    }
    if (typeof view.raw === 'string') return JSON.parse(view.raw);
  } catch (e) { /* 解压/解析失败走下方 */ }
  return null;
}

// 计算 JSON 字符串的 UTF-8 字节数
function jsonUtf8Size(json) {
  let bytes = 0;
  for (let i = 0; i < json.length; i++) {
    const code = json.charCodeAt(i);
    if (code < 0x80) bytes += 1;
    else if (code < 0x800) bytes += 2;
    else if (code >= 0xD800 && code <= 0xDBFF) { bytes += 4; i++; }
    else bytes += 3;
  }
  return bytes;
}

// 计算存档数据的大小（字节数），基于 JSON 序列化后的 UTF-8 长度
function saveSizeBytes(data) {
  try { return jsonUtf8Size(JSON.stringify(data)); }
  catch (e) { return 0; }
}

// 将字节数格式化为可读大小（B / KB / MB）
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  const kb = bytes / 1024;
  if (kb < 1024) return kb.toFixed(1) + ' KB';
  return (kb / 1024).toFixed(2) + ' MB';
}

// ===== 新旧结构迁移 =====

// 从旧版整包注册表对象拆分出新结构：返回 { meta, writes }（writes 为待写入的单条载荷列表）
async function splitLegacyRegistry(obj) {
  const meta = {};
  const writes = [];
  for (const id of Object.keys(obj)) {
    const s = obj[id];
    if (!s || s.data === undefined || s.data === null) continue;
    meta[id] = {
      id: id,
      type: s.type || 'user',
      name: (typeof s.name === 'string') ? s.name : (s.type === 'auto' ? '自动存档' : ''),
      num: (typeof s.num === 'number') ? s.num : 0,
      time: s.time || 0,
      seed: s.seed || 0,
      sizeBytes: saveSizeBytes(s.data)
    };
    const packed = await packSaveData(s.data);
    writes.push({ id: id, payload: packed.payload });
  }
  return { meta: meta, writes: writes };
}

// 在单个事务中写入新结构（meta + 各存档载荷 [+ 可选删除旧整包键]）。
// 任一步失败整体回滚，已有存档不受影响。
function commitImport(meta, writes, deleteLegacy) {
  return new Promise((resolve) => {
    openSaveDB().then(db => new Promise((res, rej) => {
      const tx = db.transaction(SAVES_STORE, 'readwrite');
      const store = tx.objectStore(SAVES_STORE);
      store.put(meta, SAVES_META_KEY);
      for (const w of writes) store.put(w.payload, SAVES_DATA_PREFIX + w.id);
      if (deleteLegacy) store.delete(LEGACY_REGISTRY_KEY);
      tx.oncomplete = function () { _metaCache = meta; res(true); };
      tx.onerror = function () { rej(tx.error); };
    })).then(() => resolve(true)).catch(() => resolve(false));
  });
}

// 迁移旧版"单条整包注册表"记录（主键 registry）为新结构。
// 迁移成功删除旧键；失败保留旧键，读取时仍可回退旧记录。
async function migrateLegacyRegistry(obj) {
  const { meta, writes } = await splitLegacyRegistry(obj);
  const ok = await commitImport(meta, writes, true);
  return { meta: meta, migrated: ok };
}

// 新结构已就绪后，静默清理残留的旧版整包键（尽力而为，失败不影响读取）
function cleanupLegacyKey(db) {
  if (_legacyCleaned) return;
  _legacyCleaned = true;
  try {
    const tx = db.transaction(SAVES_STORE, 'readwrite');
    tx.objectStore(SAVES_STORE).delete(LEGACY_REGISTRY_KEY);
  } catch (e) { /* 忽略 */ }
}

// 读取旧版整包记录原文（迁移前 / 迁移失败窗口期的回退读取用）
async function readLegacyRegistryRaw() {
  try {
    const db = await openSaveDB();
    const legacy = await storeGet(db, LEGACY_REGISTRY_KEY);
    return (legacy && typeof legacy === 'object') ? legacy : null;
  } catch (e) { return null; }
}

// 读取单条存档载荷并还原为游戏数据；无记录或解压失败返回 null
async function readSavePayload(id) {
  try {
    const db = await openSaveDB();
    const view = await storeGet(db, SAVES_DATA_PREFIX + id);
    return await unpackSavePayload(view);
  } catch (e) { return null; }
}

// 读取存档注册表（'meta' 主键）。
//   - 旧版整包记录存在且未迁移时，先触发一次原子拆分迁移，立即返回拆分出的元数据；
//   - 新旧都没有时返回 {}；
//   - DB 读取失败时回退到进程内缓存；无缓存则返回 null（调用方必须禁止写入，避免误覆盖旧档）。
async function loadSaveRegistry() {
  try {
    const db = await openSaveDB();
    let meta;
    try { meta = await storeGet(db, SAVES_META_KEY); } catch (e) { meta = undefined; }
    if (meta && typeof meta === 'object') {
      _metaCache = meta;
      cleanupLegacyKey(db);
      return meta;
    }
    let legacy;
    try { legacy = await storeGet(db, LEGACY_REGISTRY_KEY); } catch (e) { legacy = undefined; }
    if (legacy && typeof legacy === 'object' && Object.keys(legacy).length > 0) {
      // 旧版整包记录：触发迁移；即使迁移失败也能立即用拆分出的元数据（读取回退旧键）
      const { meta: m } = await migrateLegacyRegistry(legacy);
      _metaCache = m;
      return m;
    }
    _metaCache = {};
    return {};
  } catch (e) {
    return _metaCache || null;
  }
}

// 单事务写回注册表 + 单条存档载荷（payload 为 null 时表示删除该条）：
// 任一步失败整体回滚，已有存档不受影响。
function commitSave(reg, id, payload) {
  return new Promise((resolve) => {
    openSaveDB().then(db => new Promise((res, rej) => {
      const tx = db.transaction(SAVES_STORE, 'readwrite');
      const store = tx.objectStore(SAVES_STORE);
      if (payload) store.put(payload, SAVES_DATA_PREFIX + id);
      else store.delete(SAVES_DATA_PREFIX + id);
      store.put(reg, SAVES_META_KEY);
      tx.oncomplete = function () { _metaCache = reg; res(true); };
      tx.onerror = function () { rej(tx.error); };
    })).then(() => resolve(true)).catch((e) => {
      if (typeof toast === 'function') {
        toast('保存失败（存储空间不足）：' + (e && e.message ? e.message : e));
      }
      resolve(false);
    });
  });
}

// 取得当前所有存档（元数据列表），按时间倒序，含类型/名称/时间/槽位/大小
async function listAllSaves() {
  const reg = await loadSaveRegistry();
  if (!reg) return []; // 读取失败（无缓存）：仅返回空展示，绝不据此覆盖写
  const arr = [];
  for (const id of Object.keys(reg)) {
    const s = reg[id];
    if (!s) continue;
    const size = s.sizeBytes || 0;
    arr.push({
      id,
      name: s.name || (s.type === 'auto' ? '自动存档' : '用户存档'),
      type: s.type || 'user',
      num: s.num || 0,
      time: s.time || 0,
      seed: s.seed || 0,
      sizeBytes: size,
      sizeText: formatSize(size)
    });
  }
  // 为旧版用户存档（无 num）补充一个稳定展示编号：按创建时间（id 内时间戳）排序分配
  const userList = arr.filter(a => a.type === 'user');
  const existingNums = new Set(userList.filter(a => a.num > 0).map(a => a.num));
  let nextFree = 1;
  const assignNum = () => { while (existingNums.has(nextFree)) nextFree++; return nextFree++; };
  userList
    .filter(a => a.num <= 0)
    .sort((a, b) => idCreateTime(a.id) - idCreateTime(b.id))
    .forEach(a => { a.num = assignNum(); });
  arr.sort((a, b) => (b.time || 0) - (a.time || 0));
  return arr;
}

// 从用户存档 id（user-<timestamp>-<rand>）解析创建时间戳，用于旧档稳定编号排序
function idCreateTime(id) {
  const m = String(id).match(/^user-([0-9a-z]+)-/);
  if (!m) return 0;
  const t = parseInt(m[1], 36);
  return isNaN(t) ? 0 : t;
}

// 是否有任何存档
async function hasAnySave() {
  const list = await listAllSaves();
  return list.length > 0;
}

// 是否有指定 id 的存档
async function hasSave(id) {
  const reg = await loadSaveRegistry();
  return !!reg && !!reg[id];
}

// 统计用户存档（type='user'）的数量
async function countUserSaves() {
  const reg = await loadSaveRegistry();
  if (!reg) return 0;
  let n = 0;
  for (const id of Object.keys(reg)) {
    if (reg[id] && reg[id].type === 'user') n++;
  }
  return n;
}

// ===== 写入存档 =====
// 写入一个存档。
//   type: 'auto' | 'user'
//   id:   指定槽位 id（覆盖时传入）；新建用户存档时可省略自动生成
//   name: 用户存档的自定义名称（自动存档忽略）
// 返回 Promise<{ id, name, type } 或 null（失败）>
async function writeSave(data, type, id, name) {
  const reg = await loadSaveRegistry();
  if (!reg) {
    // 注册表读取失败（且无缓存）：阻止写入，避免把仅剩的存档覆盖掉
    if (typeof toast === 'function') toast('存档读取失败，已取消本次保存');
    return null;
  }
  let saveId = id;
  if (!saveId) {
    if (type === 'auto') {
      // 自动存档：找空闲槽，全满则覆盖最旧的一个
      let freeIdx = -1;
      for (let i = 0; i < AUTO_SLOTS; i++) {
        if (!reg[autoSlotId(i)]) { freeIdx = i; break; }
      }
      if (freeIdx >= 0) {
        saveId = autoSlotId(freeIdx);
      } else {
        // 3 个自动槽全满：删除最旧的，用其槽位
        const oldest = autoSlotIdsNewestFirst(reg).pop();
        delete reg[oldest];
        saveId = oldest;
      }
    } else {
      // 新建用户存档：分配全新 id
      saveId = makeUserSaveId();
    }
  }
  // 稳定编号：自动存档取槽位号（auto-0 → 1），用户存档新建时取递增序号，覆盖时保持原序号
  let num = reg[saveId] && typeof reg[saveId].num === 'number' ? reg[saveId].num : 0;
  if (type === 'auto') {
    const slotIdx = parseInt(String(saveId).split('-')[1], 10);
    num = (isNaN(slotIdx) ? 0 : slotIdx) + 1;
  } else if (!reg[saveId]) {
    // 新建用户存档：取当前所有用户存档的最大编号 +1
    let max = 0;
    for (const k of Object.keys(reg)) {
      const o = reg[k];
      if (o && o.type === 'user' && typeof o.num === 'number' && o.num > max) max = o.num;
    }
    num = max + 1;
  }
  const now = Date.now();
  const packed = await packSaveData(data);
  reg[saveId] = {
    id: saveId,
    type,
    name: (type === 'user' && name) ? String(name) : (type === 'auto' ? '自动存档' : ''),
    num: num,
    time: now,
    seed: data.seed || 0,
    sizeBytes: packed.sizeBytes
  };
  const ok = await commitSave(reg, saveId, packed.payload);
  if (!ok) return null;
  return { id: saveId, type, name: reg[saveId].name, num, time: now };
}

// 覆盖写入某个 id（必须已存在）
async function overwriteSave(id, data) {
  const reg = await loadSaveRegistry();
  if (!reg || !reg[id]) return null;
  const packed = await packSaveData(data);
  reg[id].time = Date.now();
  reg[id].seed = data.seed || reg[id].seed;
  reg[id].sizeBytes = packed.sizeBytes;
  const ok = await commitSave(reg, id, packed.payload);
  if (!ok) return null;
  return { id, type: reg[id].type, name: reg[id].name, num: reg[id].num, time: reg[id].time };
}

// 删除存档（注册表条目与其数据载荷在同一次事务内删除），返回是否成功
async function deleteSave(id) {
  const reg = await loadSaveRegistry();
  if (!reg) return false;
  delete reg[id];
  return commitSave(reg, id, null);
}

// 读取存档数据（返回完整游戏数据对象，不存在返回 null）。
// 新载荷缺失时会回退读取旧版整包记录，兼容尚未迁移 / 迁移失败的旧档。
async function readSave(id) {
  if (!id) return null;
  const reg = await loadSaveRegistry();
  if (!reg) return null;
  const data = await readSavePayload(id);
  if (data) return data;
  const legacy = await readLegacyRegistryRaw();
  const s = legacy && legacy[id];
  return (s && s.data !== undefined && s.data !== null) ? s.data : null;
}

// 取最新一个存档的数据（自动与用户混排，按时间取最新）；没有返回 null
async function readNewestSave() {
  const list = await listAllSaves();
  if (!list.length) return null;
  return readSave(list[0].id);
}

// 首次升级迁移：把旧的 localStorage 单键/注册表存档迁移为 IndexedDB（只执行一次）
async function migrateLegacySave() {
  try {
    // 1) 旧的多存档注册表键（localStorage）迁移到 IndexedDB
    let oldRaw = null;
    try { oldRaw = localStorage.getItem(SAVES_KEY); } catch (e) { /* 忽略 */ }
    if (oldRaw) {
      let oldObj = null;
      try { oldObj = JSON.parse(oldRaw); } catch (e) { /* 忽略 */ }
      if (oldObj && typeof oldObj === 'object') {
        const reg = await loadSaveRegistry();
        // 目标库为空才写入，避免覆盖新数据
        if (reg && Object.keys(reg).length === 0) {
          const { meta, writes } = await splitLegacyRegistry(oldObj);
          await commitImport(meta, writes, false);
        }
      }
      try { localStorage.removeItem(SAVES_KEY); } catch (e) { /* 忽略 */ }
      return;
    }

    // 2) 旧的单存档键（localStorage）迁移为一个用户存档
    let old = null;
    try { old = localStorage.getItem(LEGACY_SAVE_KEY); } catch (e) { /* 忽略 */ }
    if (!old) return;
    const reg = await loadSaveRegistry();
    if (reg && Object.keys(reg).length > 0) {
      // 已有新存档体系，则清掉旧键避免干扰
      try { localStorage.removeItem(LEGACY_SAVE_KEY); } catch (e) { /* 忽略 */ }
      return;
    }
    if (!reg) return; // 注册表读取失败：暂不迁移，避免覆盖
    let data = null;
    try { data = JSON.parse(old); } catch (e) { /* 忽略 */ }
    if (data && typeof data === 'object') {
      await writeSave(data, 'user', null, '旧存档');
    }
    try { localStorage.removeItem(LEGACY_SAVE_KEY); } catch (e) { /* 忽略 */ }
  } catch (e) { /* 迁移失败静默处理 */ }
}

// 自动保存：写入自动槽位（带轮换）
async function autoSaveGame() {
  const data = serializeAll();
  const res = await writeSave(data, 'auto');
  return res;
}