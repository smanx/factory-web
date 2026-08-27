'use strict';

// ===== 多存档管理系统（IndexedDB 存储） =====
// 存档分为两类：
//   - 自动存档（auto）：固定 3 个槽位，每次自动保存写入最新一个；超 3 个删除最旧。
//   - 用户存档（user）：最多 MAX_USER_SAVES 个，由用户在设置面板中自行新建 / 覆盖 / 读取 / 删除。
//
// 每个存档条目 = 元数据（id/name/type/time/seed）+ 完整游戏数据（serializeAll 的结果）。
// 所有条目统一存放在 IndexedDB 数据库的一个对象存储里（单条记录保存整个注册表），
// 替代原来占满 localStorage 命名空间的方案。

// ===== IndexedDB 基础设施 =====
const SAVES_DB_NAME = 'factory-proto-saves';
const SAVES_DB_VERSION = 1;
const SAVES_STORE = 'registry';
// 注册表在对象存储中的主键
const SAVES_RECORD_KEY = 'registry';
// 存档注册表键（兼容旧值：首次升级时从 localStorage 迁移）
const SAVES_KEY = 'factory-proto-saves-v1';

// 自动存档槽位数
const AUTO_SLOTS = 3;
// 用户存档最大数量
const MAX_USER_SAVES = 10;

// 兼容旧的单存档键：首次升级时把旧存档迁移为一个用户存档
const LEGACY_SAVE_KEY = 'factory-proto-save-v1';

let _db = null;

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

// 读取全部存档注册表（不存在时返回 {}）
function loadSaveRegistry() {
  return new Promise((resolve) => {
    openSaveDB().then(db => {
      return new Promise((res, rej) => {
        const tx = db.transaction(SAVES_STORE, 'readonly');
        const store = tx.objectStore(SAVES_STORE);
        const req = store.get(SAVES_RECORD_KEY);
        req.onsuccess = function () {
          const obj = req.result;
          res((obj && typeof obj === 'object') ? obj : {});
        };
        req.onerror = function () { rej(req.error); };
      });
    }).then(resolve).catch(() => resolve({}));
  });
}

// 写回存档注册表，返回是否成功
function storeSaveRegistry(reg) {
  return new Promise((resolve) => {
    openSaveDB().then(db => {
      return new Promise((res, rej) => {
        const tx = db.transaction(SAVES_STORE, 'readwrite');
        const store = tx.objectStore(SAVES_STORE);
        store.put(reg, SAVES_RECORD_KEY);
        tx.oncomplete = function () { res(true); };
        tx.onerror = function () { rej(tx.error); };
      });
    }).then(() => resolve(true)).catch((e) => {
      if (typeof toast === 'function') {
        toast('保存失败（存储空间不足）：' + (e && e.message ? e.message : e));
      }
      resolve(false);
    });
  });
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
    if (reg[id] && reg[id].data) list.push(id);
  }
  list.sort((a, b) => (reg[b].time || 0) - (reg[a].time || 0));
  return list;
}

// 计算存档数据的大小（字节数），基于 JSON 序列化后的 UTF-8 长度
function saveSizeBytes(data) {
  try {
    const json = JSON.stringify(data);
    // 计算 UTF-8 编码下的字节数，用于显示更准确的文件大小
    let bytes = 0;
    for (let i = 0; i < json.length; i++) {
      const code = json.charCodeAt(i);
      if (code < 0x80) bytes += 1;
      else if (code < 0x800) bytes += 2;
      else if (code >= 0xD800 && code <= 0xDBFF) { bytes += 4; i++; }
      else bytes += 3;
    }
    return bytes;
  } catch (e) {
    return 0;
  }
}

// 将字节数格式化为可读大小（B / KB / MB）
function formatSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  const kb = bytes / 1024;
  if (kb < 1024) return kb.toFixed(1) + ' KB';
  return (kb / 1024).toFixed(2) + ' MB';
}

// 取得当前所有存档（元数据列表），按时间倒序，含类型/名称/时间/槽位/大小
async function listAllSaves() {
  const reg = await loadSaveRegistry();
  const arr = [];
  for (const id of Object.keys(reg)) {
    const s = reg[id];
    if (!s || !s.data) continue;
    const size = saveSizeBytes(s.data);
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
  return !!(reg[id] && reg[id].data);
}

// 统计用户存档（type='user'）的数量
async function countUserSaves() {
  const reg = await loadSaveRegistry();
  let n = 0;
  for (const id of Object.keys(reg)) {
    if (reg[id] && reg[id].data && reg[id].type === 'user') n++;
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
  reg[saveId] = {
    id: saveId,
    type,
    name: (type === 'user' && name) ? String(name) : (type === 'auto' ? '自动存档' : ''),
    num: num,
    time: now,
    seed: data.seed || 0,
    data: data
  };
  const ok = await storeSaveRegistry(reg);
  if (!ok) return null;
  return { id: saveId, type, name: reg[saveId].name, num, time: now };
}

// 覆盖写入某个 id（必须已存在）
async function overwriteSave(id, data) {
  const reg = await loadSaveRegistry();
  if (!reg[id]) return null;
  reg[id].time = Date.now();
  reg[id].seed = data.seed || reg[id].seed;
  reg[id].data = data;
  // 覆盖时保持原编号（num），便于区分覆盖的是哪一个
  const ok = await storeSaveRegistry(reg);
  if (!ok) return null;
  return { id, type: reg[id].type, name: reg[id].name, num: reg[id].num, time: reg[id].time };
}

// 删除存档，返回是否成功
async function deleteSave(id) {
  const reg = await loadSaveRegistry();
  if (!reg[id]) return false;
  delete reg[id];
  await storeSaveRegistry(reg);
  return true;
}

// 读取存档数据（返回完整游戏数据对象，不存在返回 null）
async function readSave(id) {
  const reg = await loadSaveRegistry();
  const s = reg[id];
  if (!s || !s.data) return null;
  return s.data;
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
        if (Object.keys(reg).length === 0) {
          const ok = await storeSaveRegistry(oldObj);
          if (!ok) return;
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
    if (Object.keys(reg).length > 0) {
      // 已有新存档体系，则清掉旧键避免干扰
      try { localStorage.removeItem(LEGACY_SAVE_KEY); } catch (e) { /* 忽略 */ }
      return;
    }
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
