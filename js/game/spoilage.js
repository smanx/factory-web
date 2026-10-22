'use strict';

// ===== Gleba 新鲜度（Spoilage freshness，对齐《异星工厂》Space Age）=====
// 官方机制：Gleba 生物制品带 spoil_ticks（腐坏时长），物品在任意容器中随游戏时间流逝，
// 到期后逐个转变为 spoil_result（多为变质物 spoilage；细菌转为对应矿石）。官方腐坏数据
// 单源自 GAME_DATA.spoilItems（generate-game-data.js 从 space-age/prototypes/item.lua 提取，
// 只收录项目已有物品；触发式孵敌 spoil_to_trigger_result 不在范围）。
//
// 实现设计（集中式扫描器，不改设备热路径）：
//   - 运行时容器为「物品条目 + 可选新鲜度」双轨制：条目仍以物品 id 字符串承载，
//     { fresh: 剩余秒数 } 挂在条目上（belt.items 元素 / chest.slots 元素 / 机器人 carry），
//     序列化按「容器槽位数组约定」扩展或以对象字段自然随存档落盘（见下方各处）。
//   - 新鲜度只记录剩余秒数；物品移动（带→臂→箱）时条目引用/字段随行，不重置计时
//     （对齐官方：物品腐坏进度随物品走，非容器计时）。
//   - 转变：整批同类按官方逐件口径——到期一件转一件（转化后 spoilage 为普通物品无新鲜度）。
//   - 星球开关：仅句芒星（gleba）启用（G.settings.spoilage 可强制关闭）。
//     官方 spoil_ticks 在所有星球生效，但该玩法压力仅在 Gleba 有意义；其他星球
//     （如平台/太空）官方同样腐坏——为避免误伤非 Gleba 工厂流程，默认仅 Gleba 启用。
//
// 覆盖范围（与官方一致的重点链路）：
//   ① 传送带/地下带上的物品（belt.items[].fresh）——腐坏最快的场景
//   ② 箱子/物流箱槽位（slots[].fresh）
//   ③ 机器原料缓存（assembler/furnace/chemical-plant/lab 的 inp/packs，Map 记录按设备+键）
//   ④ 物流/施工机器人 carry（携带途中计时）
//   ⑤ 玩家背包（G.inv 侧表 _invFresh，手工操作不重置）
// 机械臂 holding 为瞬时持有（秒级），不做腐坏计时（与官方机械臂爪上计时口径一致，
// 官方机械臂爪上物品同样会腐坏——但本项目机械臂持有为亚秒级动作，计时无实际意义）。

const SPOIL_SCAN_INTERVAL = 1.0;   // 扫描周期（秒）：粒度对齐官方「逐件腐坏」的观感即可

// 某物品是否可腐坏（GAME_DATA.spoilItems 单源）
function spoilInfoOf(id) {
  return (typeof GAME_DATA !== 'undefined' && GAME_DATA.spoilItems) ? GAME_DATA.spoilItems[id] : null;
}

// 新鲜度系统是否启用：仅句芒星（可被设置关闭）
function spoilageEnabled() {
  if (G.settings && G.settings.spoilage === false) return false;
  return (typeof planetId === 'function') ? planetId() === 'gleba' : false;
}

// 物品入场时打新鲜度戳（仅在启用时）：优先消费「在途新鲜度」（机械臂/机器人刚搬运的
// 物品，进度随物品走不重置）；无在途记录（新产出/新入场）才从满值起算。
function spoilStamp(entry, id, extraSeconds) {
  if (!spoilageEnabled()) return entry;
  const sp = spoilInfoOf(id);
  if (!sp || !sp.seconds) return entry;
  if (entry && typeof entry === 'object' && entry.fresh === undefined) {
    const carried = (typeof spoilTakeCarried === 'function') ? spoilTakeCarried(id) : undefined;
    entry.fresh = (carried !== undefined ? carried : sp.seconds) + (extraSeconds || 0);
  }
  return entry;
}

// ===== 在途新鲜度携带 =====
// 物品经「箱子/带条目 → id 字符串 → 新条目」交接时（机械臂取放/机器人搬运），
// 旧条目对象被丢弃、新条目按满值重计——违背「进度随物品走」。用携带队列
// （按物品 id 记录最近被取走的若干剩余秒数）衔接：取走时入队，重新入场时按序消费。
// （同 id 多件在途互不覆盖；队列与传送带/机械臂的先进先出搬运顺序一致。）
function spoilPutCarried(id, freshLeft) {
  if (!spoilageEnabled() || typeof freshLeft !== 'number' || freshLeft <= 0) return;
  if (!G._spoilCarry) G._spoilCarry = {};
  if (!G._spoilCarry[id]) G._spoilCarry[id] = [];
  G._spoilCarry[id].push(freshLeft);
  // 防泄漏上限：同 id 在途记录最多 64 条（异常路径堆积时丢弃最旧的）
  if (G._spoilCarry[id].length > 64) G._spoilCarry[id].shift();
}
function spoilTakeCarried(id) {
  const q = G._spoilCarry && G._spoilCarry[id];
  if (!q || !q.length) return undefined;
  const v = q.shift();
  if (!q.length) delete G._spoilCarry[id];
  return v;
}

// 单步推进一批「条目引用列表」的新鲜度：到期条目执行 onSpoil(entry)
function spoilTickEntries(list, dt, onSpoil) {
  for (const entry of list) {
    if (!entry || typeof entry !== 'object' || entry.fresh === undefined) continue;
    entry.fresh -= dt;
    if (entry.fresh <= 0) onSpoil(entry);
  }
}

// 推进一个可腐坏物品计数缓存（机器 inp / lab.packs / G.inv 侧表）：返回本步腐坏件数
// rec = { id, count, fresh }（fresh 初始为该物品腐坏秒数，可延迟初始化）
function spoilTickStock(rec, dt) {
  if (!rec || rec.count <= 0) return 0;
  if (rec.fresh === undefined) rec.fresh = spoilInfoOf(rec.id).seconds;
  rec.fresh -= dt;
  if (rec.fresh > 0) return 0;
  // 到期：转 1 件并重置本批计时（逐件腐坏对齐官方观感）
  rec.count -= 1;
  rec.fresh = spoilInfoOf(rec.id).seconds;
  return 1;
}

// 机器计数缓存入场登记（assembler.inp / lab.packs 侧表）：id 为基础物品 id
function spoilStockStamp(ent, tableKey, id) {
  if (!spoilageEnabled()) return;
  const sp = spoilInfoOf(id);
  if (!sp) return;
  if (!ent[tableKey]) ent[tableKey] = {};
  if (!ent[tableKey][id]) ent[tableKey][id] = { fresh: sp.seconds };
}

// ===== 每秒扫描入口（stepWorld 节流调用）=====
function updateSpoilage(dt) {
  if (!spoilageEnabled()) return;
  // ① 传送带（含地下带/快带的 items）
  for (const e of G.ents) {
    if (e._dead) continue;
    if (e.items && e.items.length && typeof e.laneOf === 'function') {
      // 带上：逐条目计时；到期转为变质物条目（保持位置/车道，替换 item id）
      for (const o of e.items) {
        if (!o || o.fresh === undefined) continue;
        o.fresh -= dt;
        if (o.fresh <= 0) {
          const sp = spoilInfoOf(o.item);
          if (sp) {
            o.item = sp.result;
            delete o.fresh;      // 变质产物本身不再腐坏
            if (typeof uiDirty !== 'undefined') uiDirty = true;
          } else delete o.fresh;
        }
      }
    }
    // ② 箱子/物流箱/需求箱槽位
    if (e.slots && e.slots.length) {
      for (const s of e.slots) {
        if (!s || s.fresh === undefined) continue;
        s.fresh -= dt;
        if (s.fresh <= 0) {
          const sp = spoilInfoOf(s.item);
          if (sp) {
            // 槽位整批同判：到期只转 1 件（对齐官方逐件腐坏），重置继续计时
            s.count -= 1;
            if (s.count <= 0) { e.slots[e.slots.indexOf(s)] = null; }
            else s.fresh = spoilInfoOf(s.item).seconds;
            // 变质物进同槽（合并已有变质物槽或占新格；失败时暂存本槽续计时）
            const got = e.giveItem ? e.giveItem(sp.result) : false;
            if (!got) {
              // 槽满无法放入：回退本次转化（下步重试），避免物品凭空消失
              if (s && e.slots.indexOf(s) >= 0) { s.count += 1; s.fresh = 0.5; }
            }
            if (typeof uiDirty !== 'undefined') uiDirty = true;
          } else delete s.fresh;
        }
      }
    }
    // ③ 机器原料缓存（assembler 系 inp / furnace inp / chemical-plant inp：id → count 对象）
    if (e.inp && typeof e.inp === 'object') {
      if (!e._spoilInp) e._spoilInp = {};
      for (const id in e.inp) {
        const sp = spoilInfoOf(id);
        if (!sp) { delete e._spoilInp[id]; continue; }
        const rec = e._spoilInp[id] || (e._spoilInp[id] = { fresh: sp.seconds });
        rec.fresh -= dt;
        if (rec.fresh <= 0) {
          rec.fresh = sp.seconds;
          if (e.inp[id] > 0) {
            e.inp[id] -= 1;
            if (e.inp[id] <= 0) delete e.inp[id];
            // 变质物直接进原料区同位（spoilage 常是配方副产物位；机器无法产出物品——
            // 变质物无处安放时并入 outp 由机械臂取走，与官方「机器内腐坏留原位」近似）
            if (typeof e.giveOutp === 'function') e.giveOutp(sp.result);
            else if (e.outp) e.outp[sp.result] = (e.outp[sp.result] || 0) + 1;
            if (typeof uiDirty !== 'undefined') uiDirty = true;
          }
        }
      }
    }
    // ④ 实验室科研包缓存
    if (e.packs && typeof e.packs === 'object') {
      if (!e._spoilPacks) e._spoilPacks = {};
      for (const id in e.packs) {
        const sp = spoilInfoOf(id);
        if (!sp) { delete e._spoilPacks[id]; continue; }
        const rec = e._spoilPacks[id] || (e._spoilPacks[id] = { fresh: sp.seconds });
        rec.fresh -= dt;
        if (rec.fresh <= 0) {
          rec.fresh = sp.seconds;
          if (e.packs[id] > 0) {
            e.packs[id] -= 1;
            if (e.packs[id] <= 0) delete e.packs[id];
            if (e.outp) e.outp[sp.result] = (e.outp[sp.result] || 0) + 1;
            if (typeof uiDirty !== 'undefined') uiDirty = true;
          }
        }
      }
    }
  }
  // ⑤ 机器人携带（物流 + 施工）：携带途中计时，到期转化
  for (const arr of [G.logiRobots, G.constrRobots]) {
    if (!arr) continue;
    for (const r of arr) {
      const c = r.carry;
      if (!c || !c.item || c.fresh === undefined) continue;
      c.fresh -= dt;
      if (c.fresh <= 0) {
        const sp = spoilInfoOf(c.item);
        if (sp) { c.item = sp.result; delete c.fresh; if (typeof uiDirty !== 'undefined') uiDirty = true; }
        else delete c.fresh;
      }
    }
  }
  // ⑥ 玩家背包（侧表 _invFresh：id → 剩余秒；背包按 id 聚合计数，逐件转化的「件」为 1）
  if (G.inv && G.inv.size && G._invFresh) {
    for (const [id, rec] of Object.entries(G._invFresh)) {
      const cur = G.inv.get(id) || 0;
      if (cur <= 0) { delete G._invFresh[id]; continue; }
      rec.fresh -= dt;
      if (rec.fresh <= 0) {
        rec.fresh = spoilInfoOf(id).seconds;
        const sp = spoilInfoOf(id);
        if (sp && typeof invTake === 'function') {
          invTake(id, 1);
          if (typeof invAdd === 'function') invAdd(sp.result, 1);
        }
        if (typeof uiDirty !== 'undefined') uiDirty = true;
      }
    }
  }
}

// 背包获得可腐坏物品时登记新鲜度（invAdd 的钩子；由 player.js 在 addable>0 时调用）
function spoilInvAdd(id) {
  if (!spoilageEnabled()) return;
  const sp = spoilInfoOf(id);
  if (!sp) return;
  if (!G._invFresh) G._invFresh = {};
  if (!G._invFresh[id]) G._invFresh[id] = { fresh: sp.seconds };
}

// ===== 变质感官（对齐《异星工厂》2.0：悬停可腐坏物品显示新鲜度百分比）=====
// freshLeft=剩余秒；sp.seconds=满值秒。返回如「新鲜度 73%」；不可腐坏/未计时返回 ''。
function spoilFreshPctText(id, freshLeft) {
  const sp = spoilInfoOf(id);
  if (!sp || !sp.seconds || typeof freshLeft !== 'number') return '';
  const pct = Math.max(0, Math.min(100, Math.round(freshLeft / sp.seconds * 100)));
  return '新鲜度 ' + pct + '%' + (pct <= 20 ? '（即将变质）' : '');
}

// 新鲜度视觉档位（0~1）：0=满/未计时，供格子着色分级（>0.5 青绿 / 0.2~0.5 橙 / ≤0.2 红）
function spoilFreshRatio(id, freshLeft) {
  const sp = spoilInfoOf(id);
  if (!sp || !sp.seconds || typeof freshLeft !== 'number') return 1;
  return Math.max(0, Math.min(1, freshLeft / sp.seconds));
}

// 格子 CSS 类名（按新鲜度档位）：spoil-mid（橙）/ spoil-low（红）；新鲜/不可腐坏返回 ''
function spoilFreshCls(id, freshLeft) {
  const r = spoilFreshRatio(id, freshLeft);
  if (r >= 1) return '';
  return (r <= 0.2) ? ' spoil-low' : ' spoil-mid';
}

// 存档序列化：带上/箱内/机器侧表/背包侧表的新鲜度随各自容器自然落盘（对象字段），
// 机器人 carry 与背包侧表需显式导出（见 exportSpoilageState / importSpoilageState）。
function exportSpoilageState() {
  const out = {};
  if (G._invFresh && Object.keys(G._invFresh).length) out.invFresh = G._invFresh;
  return out;
}
function importSpoilageState(d) {
  G._invFresh = (d && d.invFresh) ? d.invFresh : {};
}
