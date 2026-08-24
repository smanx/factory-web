'use strict';

// ===== 多存档管理系统 =====
// 存档分为两类：
//   - 自动存档（auto）：固定 3 个槽位，每次自动保存写入最新一个；超 3 个删除最旧。
//   - 用户存档（user）：数量不限，由用户在设置面板中自行新建 / 覆盖 / 读取 / 删除。
//
// 每个存档条目 = 元数据（id/name/type/time/seed）+ 完整游戏数据（serializeAll 的结果）。
// 所有条目统一存放在一个 localStorage 键里，避免占满 localStorage 的命名空间。

// 存档注册表键
const SAVES_KEY = 'factory-proto-saves-v1';
// 自动存档槽位数
const AUTO_SLOTS = 3;

// 兼容旧的单存档键：首次升级时把旧存档迁移为一个用户存档
const LEGACY_SAVE_KEY = 'factory-proto-save-v1';

// 读取全部存档注册表（失败返回空对象）
function loadSaveRegistry() {
  try {
    const raw = localStorage.getItem(SAVES_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return (obj && typeof obj === 'object') ? obj : {};
  } catch (e) {
    return {};
  }
}

// 写回存档注册表
function storeSaveRegistry(reg) {
  try {
    localStorage.setItem(SAVES_KEY, JSON.stringify(reg));
  } catch (e) {
    toast('保存失败（存储空间不足）：' + e.message);
    return false;
  }
  return true;
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

// 取得当前所有存档（元数据列表），按时间倒序，含类型/名称/时间/槽位
function listAllSaves() {
  const reg = loadSaveRegistry();
  const arr = [];
  for (const id of Object.keys(reg)) {
    const s = reg[id];
    if (!s || !s.data) continue;
    arr.push({
      id,
      name: s.name || (s.type === 'auto' ? '自动存档' : '用户存档'),
      type: s.type || 'user',
      time: s.time || 0,
      seed: s.seed || 0
    });
  }
  arr.sort((a, b) => (b.time || 0) - (a.time || 0));
  return arr;
}

// 是否有任何存档
function hasAnySave() {
  return listAllSaves().length > 0;
}

// 是否有指定 id 的存档
function hasSave(id) {
  const reg = loadSaveRegistry();
  return !!(reg[id] && reg[id].data);
}

// ===== 写入存档 =====
// 写入一个存档。
//   type: 'auto' | 'user'
//   id:   指定槽位 id（覆盖时传入）；新建用户存档时可省略自动生成
//   name: 用户存档的自定义名称（自动存档忽略）
// 返回 { id, name, type } 或 null（失败）
function writeSave(data, type, id, name) {
  const reg = loadSaveRegistry();
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
  const now = Date.now();
  reg[saveId] = {
    id: saveId,
    type,
    name: (type === 'user' && name) ? String(name) : (type === 'auto' ? '自动存档' : ''),
    time: now,
    seed: data.seed || 0,
    data: data
  };
  if (!storeSaveRegistry(reg)) return null;
  return { id: saveId, type, name: reg[saveId].name, time: now };
}

// 覆盖写入某个 id（必须已存在）
function overwriteSave(id, data) {
  const reg = loadSaveRegistry();
  if (!reg[id]) return null;
  reg[id].time = Date.now();
  reg[id].seed = data.seed || reg[id].seed;
  reg[id].data = data;
  if (!storeSaveRegistry(reg)) return null;
  return { id, type: reg[id].type, name: reg[id].name, time: reg[id].time };
}

// 删除存档，返回是否成功
function deleteSave(id) {
  const reg = loadSaveRegistry();
  if (!reg[id]) return false;
  delete reg[id];
  storeSaveRegistry(reg);
  return true;
}

// 读取存档数据（返回完整游戏数据对象，不存在返回 null）
function readSave(id) {
  const reg = loadSaveRegistry();
  const s = reg[id];
  if (!s || !s.data) return null;
  return s.data;
}

// 取最新一个存档的数据（自动与用户混排，按时间取最新）；没有返回 null
function readNewestSave() {
  const list = listAllSaves();
  if (!list.length) return null;
  return readSave(list[0].id);
}

// 首次升级迁移：把旧的单键存档迁移为一个用户存档（只执行一次）
function migrateLegacySave() {
  try {
    const old = localStorage.getItem(LEGACY_SAVE_KEY);
    if (!old) return;
    const reg = loadSaveRegistry();
    if (Object.keys(reg).length > 0) {
      // 已有新存档体系，则清掉旧键避免干扰
      localStorage.removeItem(LEGACY_SAVE_KEY);
      return;
    }
    const data = JSON.parse(old);
    if (data && typeof data === 'object') {
      writeSave(data, 'user', null, '旧存档');
    }
    localStorage.removeItem(LEGACY_SAVE_KEY);
  } catch (e) { /* 迁移失败静默处理 */ }
}

// 自动保存：写入自动槽位（带轮换）
function autoSaveGame() {
  const data = serializeAll();
  const res = writeSave(data, 'auto');
  return res;
}
