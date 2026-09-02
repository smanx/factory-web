'use strict';

let uiDirty = true;

const ICON_CACHE = {};
const URL_CACHE = {};

// 背包面板 tab HTML 缓存：仅首次生成并缓存「材料 / 合成」两个 tab 的 innerHTML，
// 打开背包或切换 tab 时直接复用，避免每次都重建数百个 DOM 节点（尤其合成页的
// 大量配方）导致明显卡顿。动态数量由 updateInvLive 每帧轻量刷新保持准确；
// 当物品/科技等状态变更时通过 _invalidateInvCache() 清除缓存强制重建。
let _invTabCache = { materials: null, craft: null };
function _invalidateInvCache() {
  _invTabCache.materials = null;
  _invTabCache.craft = null;
}
// 玩家背包格子数：对齐《异星工厂》官方数据（factorio-data/base/prototypes/entity/entities.lua
// 中 character 的 inventory_size = 80）。背包是有限的固定格，每格一个物品图标，
// 数量以右下角角标显示。
const INV_SLOT_COUNT = 80;

// 背包实际可用格子数：基础 80 格 + 装备网格中「工具腰带」提供的扩容格
// （对齐《异星工厂》Toolbelt equipment：每件 +10 格，见 devices/equipment.js toolbeltInventoryBonus）。
function invSlotCount() {
  const bonus = (typeof toolbeltInventoryBonus === 'function') ? toolbeltInventoryBonus() : 0;
  return INV_SLOT_COUNT + bonus;
}

// 制作栏 5 个 Tab：顺序、标签与官方 item-group 一一对应（数据单源归类见 GAME_DATA.itemGroup）。
const CRAFT_TABS = ['logistics', 'production', 'intermediate-products', 'space', 'combat'];
const CRAFT_TAB_LABEL = {
  'logistics': { icon: '🧱', text: '物流' },
  'production': { icon: '🏭', text: '生产' },
  'intermediate-products': { icon: '🧪', text: '中间产品' },
  'space': { icon: '🚀', text: '太空' },
  'combat': { icon: '🔫', text: '武器' },
};

// 背景预热：首次打开背包会一次性计算数百个物品的 tooltip（含遍历数百条配方）与
// base64 图标，是「首次打开卡顿」的主要来源。这里把最耗时的静态缓存（物流请求/
// 垃圾桶物品列表、建造设备列表、合成页 HTML、tooltip 基础、图标 URL）拆成小块，
// 在游戏主循环的空闲帧里分批预热，使第一次真正打开背包时缓存已就绪、基本不卡。
// 每个小片只处理少量物品，分摊到多帧执行，避免预占单帧导致卡顿。
const _PREWARM_CHUNK = 12;
let _prewarmQueue = [];
let _prewarmDone = false;
function _schedulePrewarm(fn, label) {
  _prewarmQueue.push({ fn, label });
}
function prewarmInvCache() {
  if (_prewarmDone) return false;
  _prewarmDone = true; // 只调度一次
  // 建造设备 / 物流请求 / 垃圾桶：分批预热 base64 图标与 tooltip
  // 先确保 staticItemIdList 与 BUILD_DEFS 的图标 URL 预热，这样后续生成合成页
  // HTML 时图标已缓存、不会在单帧内一次性生成大量 canvas 造成卡顿。
  const allIds = [];
  try {
    for (const b of Object.keys(BUILD_DEFS)) allIds.push(b);
  } catch (e) {}
  try {
    for (const id of staticItemIdList()) allIds.push(id);
  } catch (e) {}
  for (let i = 0; i < allIds.length; i += _PREWARM_CHUNK) {
    const chunk = allIds.slice(i, i + _PREWARM_CHUNK);
    _schedulePrewarm(() => {
      for (const id of chunk) {
        if (ITEMS[id]) { iconDataURL(id); itemTip(id); }
      }
    }, 'icons-' + i);
  }
  // 合成页 HTML：数百条配方，最重，在所有图标预热完后再一次生成（复用已缓存图标）
  _schedulePrewarm(() => {
    if (!_invTabCache.craft) _invTabCache.craft = htmlCraft();
  }, 'craft');
  return true;
}
// 主循环内调用：每次执行队列中下一小片，直到全部完成
function stepPrewarm() {
  if (!_prewarmQueue.length) return false;
  const item = _prewarmQueue.shift();
  try { item.fn(); } catch (e) { console.error('prewarm[' + item.label + ']', e); }
  return _prewarmQueue.length > 0;
}

// 材料页可选物品集合（排除流体与测试设备）
function staticItemIdList() {
  return Object.keys(ITEMS).filter(id => {
    if (FLUIDS.indexOf(id) >= 0) return false;
    if (id.indexOf('creative-') === 0 || id.indexOf('void-') === 0) return false;
    return true;
  });
}

function iconDataURL(id, size) {
  const sz = size || 34;
  const key = id + '_' + sz;
  let u = URL_CACHE[key];
  if (!u) {
    u = iconCanvas(id, sz).toDataURL();
    URL_CACHE[key] = u;
  }
  return u;
}

// 物品悬浮提示：名称|描述（含物品堆叠上限，对齐《异星工厂》stack_size）
// 性能优化：tooltip 的「名称|描述|堆叠|配方」基础部分是 id 的纯函数（itemRecipeText
// 会遍历数百条配方），在材料页每次打开时被数百个物品反复调用、开销极大。这里按 id
// 缓存基础部分，仅动态拼接额外说明（如请求量/已持有），避免每次打开背包都重算配方。
const TIP_BASE_CACHE = {};
function itemTip(id, extra) {
  const it = ITEMS[id];
  // 个人机器人港：描述由数据层生成（roboportDesc），未命中缓存以实时体现“状态:启用/已停用”
  let base;
  if (it && typeof EQUIPMENT !== 'undefined' && EQUIPMENT[id] && EQUIPMENT[id].roboport) {
    base = roboportTip(id);
    // 可合成物品：tooltip 末尾追加配方（保持与普通物品一致）
    const recipe = itemRecipeText(id);
    if (recipe) base += '||' + recipe;
  } else {
    base = TIP_BASE_CACHE[id];
    if (!base) {
      const stack = (typeof stackSize === 'function') ? stackSize(id) : 100;
      base = it.name + '|' + it.desc + (stack ? '（最大堆叠 ' + stack + '）' : '');
      // 可合成物品：在 tooltip 末尾追加合成配方（需求：建造物品悬停显示配方）
      const recipe = itemRecipeText(id);
      if (recipe) base += '||' + recipe;
      TIP_BASE_CACHE[id] = base;
    }
  }
  return extra ? (base + (extra[0] === '|' ? '' : '|') + extra) : base;
}

// 背包条目的显示名：蓝图物品（blueprint#n）用其自身蓝图名，其余走 ITEMS 展示名。
function bpItemName(id) {
  const d = (typeof bpDataOfItem === 'function') ? bpDataOfItem(id) : null;
  return (d && d.name) ? d.name : ((ITEMS['blueprint'] && ITEMS['blueprint'].name) || '蓝图');
}

// 背包条目是否应作为一个格子显示出来。
// 蓝图物品（blueprint / blueprint#n）是项目自定的虚拟物品，不在 ITEMS 展示表里
// （图标/tooltip 都按基础 id 'blueprint' 渲染），因此凡是用 ITEMS[id] 过滤背包内容的
// 地方都要额外放行蓝图，否则「蓝图入包后背包里看不到、也不显示」。
function isInvOwnedItem(id) {
  if (!id) return false;
  if (ITEMS[id]) return invCount(id) > 0;
  return (typeof isBlueprintItem === 'function') ? !!isBlueprintItem(id) : false;
}

// 蓝图物品 tooltip：显示蓝图名/建筑数/尺寸（blueprint#n 的专属提示）
function bpItemTip(id) {
  const d = (typeof bpDataOfItem === 'function') ? bpDataOfItem(id) : null;
  if (!d) return '蓝图|空蓝图（数据缺失），可丢弃';
  const bb = blueprintBounds(d.ents);
  return (d.name || '蓝图') + '|蓝图物品：选中后点击地图放置（R 旋转，V/H 翻转，Q 取消）。不消耗材料，可反复使用。尺寸 ' +
    bb.W + '×' + bb.H + ' · ' + d.ents.length + ' 个建筑';
}

function iconCanvas(id, size = 34) {
  // 无边框版本：内容直接铺满整个图标。
  // 高清渲染：内部按「设备像素比 + 最小分辨率」绘制，再由 CSS 缩放显示，保证底部快捷栏/背包显示清晰不糊。
  const dpr = Math.max(1, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  const px = Math.max(48, Math.round(size * dpr));   // 内部像素分辨率（高分辨率绘制，缩放后依然锐利）
  const key = id + '_' + px;
  if (ICON_CACHE[key]) return ICON_CACHE[key];
  const c = document.createElement('canvas');
  c.width = c.height = px;
  const x = c.getContext('2d');
  const it = ITEMS[id];
  x.scale(px / size, px / size);   // 以逻辑 size 为单位绘制，放大显示仍清晰
  // 移除边框：不再绘制圆角底框与描边，让物品图形直接铺满整个图标
  x.fillStyle = it.color;
  // 让图形铺满整个格子：尺寸提升到 size*1.08，占满格子（最大图形范围约 r*0.85，
  // 此时图形直径≈0.95~1.0 倍格子宽）。个别范围更大的物品（科学包/机器人港）已在
  // drawItemGlyph 内微调缩放到 r*0.85 以内，避免溢出画布边缘。
  drawItemGlyph(x, id, size / 2, size / 2, size * 1.08);
  ICON_CACHE[key] = c;
  return c;
}


// 灰字片段（设备面板 live 刷新共用）
function dimSpan(s) { return '<span class="dim">' + s + '</span>'; }

function buildHotbar() {
  const hb = document.getElementById('hotbar');
  hb.innerHTML = '';
  HOTBAR.forEach((id, i) => {
    const slot = document.createElement('div');
    slot.className = 'slot' + (id ? '' : ' nilslot');
    slot.dataset.idx = i;
    // 蓝图物品（blueprint#n）：按基础 id 渲染图标，tooltip 换成蓝图专属说明
    const bpId = (typeof isBlueprintItem === 'function') ? isBlueprintItem(id) : null;
    const iconId = bpId ? 'blueprint' : id;
    if (id) slot.dataset.tip = bpId ? bpItemTip(id) : itemTip(id);
    else slot.dataset.tip = '空槽位|打开背包(E)，选中任意物品后点击空槽位或鼠标中键即可把该物品放入，放置幽灵继续选中';
    if (id) {
      const ic = iconCanvas(iconId, 16).cloneNode();
      ic.getContext('2d').drawImage(iconCanvas(iconId, 16), 0, 0);
      slot.appendChild(ic);
    } else {
      const emp = document.createElement('span');
      emp.className = 'nilmark';
      emp.textContent = '空';
      slot.appendChild(emp);
    }
    const cnt = document.createElement('span');
    cnt.className = 'cnt';
    cnt.id = 'hb-cnt-' + i;
    slot.appendChild(cnt);
    const key = document.createElement('span');
    key.className = 'key';
    key.textContent = i === 9 ? '0' : i + 1;
    slot.appendChild(key);
    slot.addEventListener('click', () => onHotbarClick(i));
    // 鼠标中键：鼠标持握幽灵物品时把它设为该槽位；否则清空该槽位
    slot.addEventListener('auxclick', ev => {
      if (ev.button !== 1) return;
      ev.preventDefault();
      onHotbarMidClick(i);
    });
    hb.appendChild(slot);
  });
  refreshHotbar();
}

function refreshHotbar() {
  const infinite = !!(G.dbg && G.dbg.infinite);
  HOTBAR.forEach((id, i) => {
    const el = document.getElementById('hb-cnt-' + i);
    if (!el) return;
    // 蓝图物品可反复使用（不消耗），数量角标恒显示 ∞
    const isBp = (typeof isBlueprintItem === 'function') ? isBlueprintItem(id) : false;
    el.textContent = id ? (infinite || isBp ? '∞' : invCount(id)) : '';
    // 快捷栏无选中效果：点击只切换鼠标放置幽灵，不显示高亮/选中态
    const slot = document.getElementById('hotbar').children[i];
    slot.classList.remove('active');
    slot.classList.toggle('empty', !!id && !isBp && !infinite && invCount(id) <= 0);
  });
}

// 快捷栏槽位点击：若鼠标持握放置幽灵且点击空槽位，直接把该物品放入空槽位，
// 且放置幽灵不消失、继续选中（可继续放入其他空槽位）；否则切换鼠标放置幽灵为该槽位物品。
// 快捷栏无选中效果：点击只让鼠标幽灵显示该物品，不高亮/不选中快捷栏槽位。
function onHotbarClick(i) {
  const held = G.quickSel;
  const heldOk = held && (ITEMS[held] || (typeof isBlueprintItem === 'function' && isBlueprintItem(held)));
  if (held && heldOk && !HOTBAR[i]) {
    // 空槽位：把鼠标持握的放置幽灵物品直接放入，且幽灵不消失、继续选中
    HOTBAR[i] = held;
    const heldName = (ITEMS[held] || ITEMS['blueprint'] || { name: '蓝图' }).name;
    toast('已放入快捷栏槽位 ' + (i === 9 ? 0 : i + 1) + '：' + heldName + '（放置幽灵继续选中，可继续放入其他空槽位）');
    if (typeof playSfx === 'function') playSfx('select');
    buildHotbar();
    uiDirty = true;
    return;
  }
  selectSlot(i);
}

// 快捷栏槽位中键：鼠标持握放置幽灵（快捷栏选中槽位或背包选中的物品）时，
// 直接把它设为该槽位；否则清空该快捷栏槽位。
function onHotbarMidClick(i) {
  const held = G.quickSel || (G.sel >= 0 ? (HOTBAR[G.sel] || null) : null);
  if (held && (ITEMS[held] || (typeof isBlueprintItem === 'function' && isBlueprintItem(held)))) {
    // 鼠标持握幽灵物品：设为该快捷栏槽位
    HOTBAR[i] = held;
    const heldName2 = (ITEMS[held] || ITEMS['blueprint'] || { name: '蓝图' }).name;
    toast('已设置快捷栏槽位 ' + (i === 9 ? 0 : i + 1) + '：' + heldName2);
    if (typeof playSfx === 'function') playSfx('select');
  } else {
    // 无幽灵：清空该快捷栏槽位
    const oldId = HOTBAR[i];
    HOTBAR[i] = null;
    // 若当前鼠标幽灵正是该槽位物品，则一并取消选中
    if (oldId && G.quickSel === oldId) {
      G.sel = -1;
      G.quickSel = null;
      if (typeof setWeapon === 'function') setWeapon(null);
    }
    toast('已清空快捷栏槽位 ' + (i === 9 ? 0 : i + 1));
    if (typeof playSfx === 'function') playSfx('select');
  }
  buildHotbar();
  uiDirty = true;
}

function selectSlot(i) {
  // 选择快捷栏物品建造时退出拆除模式，避免左键行为冲突
  if (G.deconstructMode) toggleDeconstructMode(false);
  const prev = G.quickSel || (G.sel >= 0 ? (HOTBAR[G.sel] || null) : null);
  const id = HOTBAR[i];
  // 蓝图物品（blueprint#n）不在 ITEMS 表里，按基础 id 判定可选中
  const idOk = id && (ITEMS[id] || (typeof isBlueprintItem === 'function' && isBlueprintItem(id)));
  if (id && idOk) {
    // 快捷栏有物品：直接让鼠标放置幽灵显示该物品（不选中/不高亮快捷栏槽位）
    G.sel = -1;
    G.quickSel = id;
    if (typeof setWeapon === 'function') setWeapon(id);
  } else {
    // 空槽位：取消当前选中
    G.sel = -1;
    G.quickSel = null;
    if (typeof setWeapon === 'function') setWeapon(null);
  }
  // 规划器（拆除/升级）选中：进入对应红图/绿图框选模式（对齐《异星工厂》Planner）
  if (typeof toggleBlueprint === 'function') {
    const cur = G.quickSel;
    if (cur === 'deconstruction-planner') { toggleBlueprint('red'); }
    else if (cur === 'upgrade-planner') { toggleBlueprint('green'); }
    else if (prev === 'deconstruction-planner' || prev === 'upgrade-planner') {
      if (G.blueMode) cancelBlueprint();
    }
  }
  if (typeof playSfx === 'function') playSfx('select');
  refreshHotbar();
  closePanel(false);
}

function toast(msg) {
  const box = document.getElementById('toasts');
  // 最多只保留 3 条，超出则移除最旧的一条
  while (box.children.length >= 3) box.firstChild.remove();
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  box.appendChild(t);
  refreshToastOpacity();
  setTimeout(() => {
    t.classList.add('fade');
    t.classList.remove('aged-1', 'aged-2');
  }, 2200);
  setTimeout(() => t.remove(), 2800);
}

// 在鼠标正上方就地浮出提示文字（模块插槽“只能安放插件”等地就反馈，不打断操作）。
function showFloatWarn(msg, clientX, clientY) {
  document.querySelectorAll('.float-warn').forEach(n => n.remove());
  const el = document.createElement('div');
  el.className = 'float-warn';
  el.textContent = msg;
  const x = (typeof clientX === 'number') ? clientX : Math.floor(innerWidth / 2);
  const y = (typeof clientY === 'number') ? clientY : Math.floor(innerHeight / 2);
  el.style.left = x + 'px';
  el.style.top = (y - 36) + 'px';
  document.body.appendChild(el);
  setTimeout(() => { if (el.isConnected) el.remove(); }, 1300);
}

// 按新旧程度刷新提示透明度：最新的不透明，越旧越透明
function refreshToastOpacity() {
  const box = document.getElementById('toasts');
  const items = Array.from(box.children);
  const n = items.length;
  items.forEach((el, i) => {
    el.classList.remove('aged-1', 'aged-2');
    const age = n - 1 - i; // 0 = 最新
    if (age === 1) el.classList.add('aged-1');
    else if (age === 2) el.classList.add('aged-2');
  });
}

function openArmorPanel(armorId) {
  if (!armorId || !isArmor(armorId)) return;
  // 前 2 种护甲（轻型/重型）没有装备网格，仅数值减伤，无需打开装甲面板
  if (!ARMORS[armorId].grid) {
    if (typeof toast === 'function') toast('该护甲没有装备网格');
    return;
  }
  // 记录装甲面板是否从背包发起（关闭时回到背包而非完全关闭）。
  // 从背包打开 → true；在装甲面板内切换护甲 → 保持原值；其他入口（快捷栏等）→ false。
  if (G.panelMode === 'inv') G.armorFromInv = true;
  else if (G.panelMode !== 'armor') G.armorFromInv = false;
  G.panelArmor = armorId;
  openPanel('armor');
}

function openPanel(mode, ent) {
  // 配方设备：无配方时先弹出配方选择面板；已有配方则直接进入交互面板
  if (mode === 'machine' && ent && isRecipeDevice(ent) && !ent.recipe) {
    mode = 'machinerecipe';
    G.recipeSel = null;
  }
  G.panelMode = mode;
  G.panelEnt = ent || null;
  // 注意：不清空 G.held —— 通用持握物品需跨面板存在（从一台设备拿到另一台设备/背包）
  // 打开设置面板时自动暂停游戏（关闭时恢复，见 closePanel）
  if (mode === 'set') G.paused = true;
  // 背包弹框居中加宽显示（三列布局），其余面板保持右上角小窗
  document.getElementById('panel').classList.toggle('inv-wide', mode === 'inv' || mode === 'armor');
  // 研究面板加宽双栏布局（左=研究列表，右=研究树图）
  document.getElementById('panel').classList.toggle('tech-wide', mode === 'tech');
  // 所有设备的交互面板：居中加宽双栏布局（左=背包，右=设备操作面板），与组装机一致
  document.getElementById('panel').classList.toggle('machine-wide', mode === 'machine' && !!ent);
  // 配方选择面板：网格区可滚动，底部「确认」按钮行固定在面板底部不随之滚动
  document.getElementById('panel').classList.toggle('recipe-wide', mode === 'machinerecipe');
  // 设置面板：宽度自适应内容（不再固定 400px）
  document.getElementById('panel').classList.toggle('set-wide', mode === 'set');
  // 蓝图面板/蓝图编辑界面/蓝图详情页：居中加宽双栏布局（左=背包，右=蓝图库/编辑区/详情）
  document.getElementById('panel').classList.toggle('blue-wide', mode === 'bluebook' || mode === 'blueprint-edit' || mode === 'bluebook-detail');
  // 物流网络面板：加宽两栏布局（左=网络列表，右=设备与物品）
  document.getElementById('panel').classList.toggle('logi-wide', mode === 'logi');
  // 再次打开时恢复面板默认位置（不保留上次拖动的位置）
  if (typeof resetPanelPos === 'function') resetPanelPos();
  document.getElementById('panel').style.display = 'flex';
  renderPanel(true);
}

function closePanel(hide = true) {
  // 从背包打开的装甲面板：关闭时回到背包面板（而非完全关闭），对齐「右键护甲 → 看模块 → 关闭后仍在背包」
  if (G.panelMode === 'armor' && G.armorFromInv) {
    G.panelArmor = null;
    openPanel('inv');
    return;
  }
  const wasSettings = G.panelMode === 'set';
  G.panelMode = null;
  G.panelEnt = null;
  // 关闭面板时若仍有机械臂爪上取下的物品在「抓取状态」，归还到对应机械臂爪上，避免物品凭空消失
  if (G.armGrab) {
    const g = G.armGrab;
    if (g.ent && !g.ent.holding) {
      g.ent.holding = g.id;
      g.ent.holdingCount = g.count;
      g.ent.blocked = false;
    }
    G.armGrab = null;
  }
  G.invRecipeQ = '';
  G.bbDetail = null;
  G.recipeSel = null;
  G._clickMoveFrom = null;
  G.panelArmor = null;
  // G.held 不在关闭面板时清空：持握物品跨面板保留（对齐《异星工厂》光标堆叠）
  G.rcpTab = null;
  G.rcpQ = '';
  if (hide) document.getElementById('panel').style.display = 'none';
  // 关闭设置面板后，仅当游戏菜单未打开时才自动恢复游戏；
  // 若设置面板是从游戏菜单打开的，则关闭后仍停留在暂停的游戏菜单，由用户按 Esc 继续。
  if (wasSettings && !(typeof isPauseMenuOpen === 'function' && isPauseMenuOpen())) G.paused = false;
}

function panelScrollTop() {
  // 配方选择面板：滚动发生在中间内容区 .rcp-scroll（确认行固定底部），读取其滚动位置
  if (G.panelMode === 'machinerecipe') {
    const rcp = document.querySelector('#panel.recipe-wide .rcp-scroll');
    return rcp ? rcp.scrollTop : 0;
  }
  const p = document.getElementById('panel-body');
  return p ? p.scrollTop : 0;
}

function renderPanel(full) {
  const body = document.getElementById('panel-body');
  const title = document.getElementById('panel-title');
  if (!G.panelMode) { document.getElementById('panel').style.display = 'none'; return; }
  const st = full ? 0 : panelScrollTop();
  if (G.panelMode === 'inv') {
    // 顶部面板标题去掉（需求：不显示），关闭按钮悬浮在面板右上角；由 CSS #panel.inv-wide #panel-title 隐藏。
    title.textContent = '';
    const keepFocusId = document.activeElement &&
      (document.activeElement.id === 'inv-recipe-search' || document.activeElement.id === 'inv-item-search') ?
      document.activeElement.id : null;
    // 背包面板：左中右三列，标题分别位于每列左上角（🎒 玩家 / 📦 物流 / 🛠 制作）。
    if (!_invTabCache['craft']) _invTabCache['craft'] = htmlCraft();
    const craftHtml = _invTabCache['craft'];
    const matHtml = htmlInventory();
    const logiHtml = htmlLogistics();
    body.innerHTML =
      '<div class="inv-layout">' +
        '<div class="inv-col inv-col-left" id="inv-col-left">' +
          '<div class="inv-col-head">🎒 玩家</div>' +
          '<div class="inv-col-body" id="inv-mat">' + matHtml + '</div>' +
        '</div>' +
        '<div class="inv-col inv-col-mid" id="inv-col-mid">' +
          '<div class="inv-col-head">📦 物流</div>' +
          '<div class="inv-col-body">' + logiHtml + '</div>' +
        '</div>' +
        '<div class="inv-col inv-col-right" id="inv-col-right">' +
          '<div class="inv-col-head">🛠 制作</div>' +
          '<div class="inv-col-body" id="inv-craft">' + craftHtml + '</div>' +
        '</div>' +
      '</div>';
    applyInvRecipeFilter(G.invRecipeQ);
    applyInvItemSearch(G.invItemQ);
    // 用面板顶部的 #panel-head 作为拖拽手柄（已由 initPanelEvents 全局绑定），可拖动整个弹框。
    if (keepFocusId) {
      const inp = document.getElementById(keepFocusId);
      if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    }
  } else if (G.panelMode === 'armor') {
    // 制作栏 Tab 保持静态缓存（护甲面板重开时快速显示）
    if (!_invTabCache['craft']) _invTabCache['craft'] = htmlCraft();
    const aid = G.panelArmor;
    const def = ARMORS[aid];
    title.textContent = (def ? def.name : '装甲') + ' · 装备网格';
    // 只渲染护甲面板专用布局：内部使用 #inv-armor-body 作为背包列容器
    body.innerHTML = htmlArmorPanel();
    // 恢复背包搜索过滤
    applyInvItemSearch(G.invItemQ);
  } else if (G.panelMode === 'tech') {
    title.textContent = '科技研究';
    // 科技面板每帧走轻量重建（主循环 renderPanel(false)），整块 innerHTML 重建会把
    // 左右两栏(#tech-col-list / #tech-col-tree)的滚动容器一并销毁，导致滚动位置被重置回顶部、
    // 用户下拉后立刻“自动回弹”。重建前记录两栏 scrollTop，重建后原样恢复，保住浏览位置。
    const oldList = body.querySelector('#tech-col-list');
    const oldTree = body.querySelector('#tech-col-tree');
    const listScrollTop = oldList ? oldList.scrollTop : 0;
    const treeScrollTop = oldTree ? oldTree.scrollTop : 0;
    body.innerHTML = htmlTech();
    // 重建后恢复搜索过滤（科技列表按当前关键词重新显隐）
    if (G.techQ) applyTechFilter(G.techQ);
    const newList = body.querySelector('#tech-col-list');
    const newTree = body.querySelector('#tech-col-tree');
    if (newList && listScrollTop) newList.scrollTop = listScrollTop;
    if (newTree && treeScrollTop) newTree.scrollTop = treeScrollTop;
  } else if (G.panelMode === 'bluebook') {
    title.textContent = '蓝图库（Blueprint book）';
    body.innerHTML = bluebookLayoutHtml();
    applyBbSearch(G.bbQ || '');
  } else if (G.panelMode === 'bluebook-detail') {
    title.textContent = '蓝图详情';
    body.innerHTML = bbDetailLayoutHtml();
    renderBlueprintDetailThumb();
  } else if (G.panelMode === 'blueprint-edit') {
    title.textContent = '蓝图编辑';
    body.innerHTML = blueprintEditLayoutHtml();
    renderBpEditHotbar();
    renderBlueprintDetailThumb();
  } else if (G.panelMode === 'stats') {
    title.textContent = '统计面板';
    body.innerHTML = htmlStats();
  } else if (G.panelMode === 'logi') {
    title.textContent = '物流网络';
    body.innerHTML = (typeof logiNetPanelHtml === 'function') ? logiNetPanelHtml() : '<div class="dim">物流模块未加载</div>';
  } else if (G.panelMode === 'ach') {
    title.textContent = '成就（Achievements）';
    body.innerHTML = (typeof htmlAchievements === 'function') ? htmlAchievements() : '<div class="dim">成就系统未加载</div>';
  } else if (G.panelMode === 'set') {
    title.textContent = '设置';
    renderSettingsAsync(body, st);
  } else if (G.panelMode === 'maptags') {
    title.textContent = '地图标记（Map Tags）';
    body.innerHTML = (typeof mapTagsPanelHtml === 'function') ? mapTagsPanelHtml() : '<div class="dim">标记功能未加载</div>';
  } else if (G.panelMode === 'machinerecipe' && G.panelEnt) {
    // 配方设备的配方选择面板：先选配方，点右下角「确认」后进入交互面板
    title.textContent = ITEMS[G.panelEnt.type].name + ' · 选择配方';
    body.innerHTML = recipeSelectPanelHtml(G.panelEnt);
    // 恢复搜索过滤（面板重建会还原 Tab 原始数量，需按已存搜索词重算）
    applyRcpFilter(G.rcpQ || '');
  } else if (G.panelMode === 'machine' && G.panelEnt) {
    title.textContent = ITEMS[G.panelEnt.type].name;
    // 所有设备的交互面板统一采用组装机设计稿风格（左=玩家背包，右=设备操作面板）
    body.innerHTML = unifiedMachineLayoutHtml(G.panelEnt);
  }
  if (G.panelMode === 'machinerecipe') {
    // 配方选择面板：滚动容器是中间内容区 .rcp-scroll，恢复其滚动位置
    const rcp = body.querySelector('.rcp-scroll');
    if (rcp) rcp.scrollTop = st;
  } else if (G.panelMode !== 'set') {
    body.scrollTop = st;
  }
}

// 判断用户是否正在面板内的输入框输入（聚焦的文本输入框，或中文输入法组合中）。
// 此时绝不能被整面板 innerHTML 重建打断（重建会销毁输入框、打断组合、清空已输入内容）。
function isPanelTyping() {
  const ae = document.activeElement;
  if (!ae || ae.tagName !== 'INPUT') return false;
  const body = document.getElementById('panel-body');
  return !!(body && body.contains(ae));
}

// 背包面板轻量实时刷新：仅更新数量/可用性文本，不重建整个面板 DOM。
// 原实现在游戏主循环里对 inv/tech 面板整块 renderPanel(false)，每帧重建上百个
// DOM 节点（base64 图标、tooltip 等）导致打开背包后明显掉帧；且重建会销毁正在聚焦
// 的输入框，打断中文输入法并清空已输入内容。改为只更新变化的计数文本，从而同时
// 解决“打开背包掉帧”与“搜索框无法正常输入中文/被清空”两个问题。
function updateInvLive() {
  const body = document.getElementById('panel-body');
  if (!body) return;
  // 蓝图面板（bluebook）左栏同样是玩家背包（htmlInventory('bb-inv')）：
  // 手持蓝图点左栏格子「入包」后需即时显示新蓝图，否则要关掉面板重开才看得见。
  // 制造面板（machine）左栏也是背包，物品进出同样需要跟随刷新。
  const invPanelModes = ['inv', 'bluebook', 'machine', 'armor'];
  if (invPanelModes.indexOf(G.panelMode) < 0) return;
  // 背包固定格（#inv-items）：每格一种物品，数量以右下角角标(.cnt)显示。
  // 物品集合变化时（新增/消失/清空）需重建格子以保证排列稳定；集合不变则仅在原地
  // 更新数量角标与搜索过滤，避免整块重建带来的掉帧。
  const wrap = body.querySelector('#inv-items-wrap');
  if (wrap) {
    // 计算当前背包格布局的稳定签名（手动槽位 + 自动物品集合）
    const sig = invSlotSig();
    if (wrap.dataset.ownedsig !== sig) {
      // 物品集合变化 → 整块重建格子（保持排列稳定）
      wrap.outerHTML = htmlInvSlots();
    } else {
      // 集合不变 → 仅在原地更新各格数量角标与搜索过滤（按视觉格堆叠量逐格刷新）
      const grid = body.querySelector('#inv-items');
      const q = (G.invItemQ || '').trim().toLowerCase();
      if (grid) {
        const slots = invStackSlots();
        const els = grid.querySelectorAll('.inv-slot');
        for (let i = 0; i < els.length; i++) {
          const el = els[i];
          const s = slots[i];
          if (!s || s.id == null) continue;
          const isBp = (typeof isBlueprintItem === 'function') ? isBlueprintItem(s.id) : false;
          const n = isBp ? '∞' : s.count;
          const c = el.querySelector('.cnt[data-cnt]');
          if (c && c.textContent !== String(n)) c.textContent = n;
          const hit = !q || (el.dataset.itemsearch || '').includes(q);
          el.classList.toggle('hidden', !hit);
        }
      }
    }
  }
  // 手搓配方格子：实时刷新右下角可制作次数角标(.cnt)与未解锁状态。
  // 与玩家背包格子一致采用「格子 + 图标」网格，左键点击制作 1 个、右键点击制作 5 个。
  // 手搓配方格子分布在 5 个 Tab 网格内（#inv-recipes-<tab>），全部刷新可制作次数与解锁态
  body.querySelectorAll('[id^="inv-recipes-"].craft-grid .craft-slot[data-id]').forEach(el => {
    const rid = el.dataset.id;
    if (!RECIPES[rid]) return;
    const unlocked = recipeUnlocked(rid);
    el.classList.toggle('locked', !unlocked);
    const cnt = unlocked ? craftMaxCount(rid) : 0;
    el.dataset.craftable = cnt;
    const c = el.querySelector('.cnt[data-cnt]');
    if (c && c.textContent !== String(cnt)) c.textContent = cnt;
  });
}

// 科技面板轻量实时刷新：主循环每 0.25s 调用，仅原地更新正在变化的研究进度条/文本、
// 完成/锁定状态，不重建 DOM。整块重建会重建 #tech-col-list 滚动容器，即使恢复 scrollTop
// 也会造成滚动时的闪烁抖动、且打断输入框；改为原地更新后滚动顺滑。
// 队列增减、科技开始/取消/完成等结构变化由各自的交互事件触发 renderPanel(false) 重建。
function updateTechLive() {
  const body = document.getElementById('panel-body');
  if (!body || G.panelMode !== 'tech') return;
  body.querySelectorAll('#tech-col-list .recipe.tech[data-techid]').forEach(el => {
    const tid = el.dataset.techid;
    const t = TECHS[tid];
    if (!t) return;
    const done = techResearched(tid);
    const locked = !done && techLocked(tid);
    // 完成 / 锁定状态
    el.classList.toggle('done', done);
    el.classList.toggle('locked', locked);
    const prog = G.techProg[tid] || 0;
    const total = techCostTotal(tid);
    // 进度条
    const barI = el.querySelector('.bar > i');
    if (barI) barI.style.width = Math.min(100, prog / total * 100) + '%';
    // 进度文本（bar 直接后跟的 .dim；触发式科技没有 bar，跳过）
    const pDim = el.querySelector('.bar + .dim');
    if (pDim) {
      if (isInfiniteTech(tid)) {
        pDim.textContent = done ? '已完成' : '无限研究 · 已消耗 ' + prog + ' 瓶 · 消耗任意科学包';
      } else {
        const cs = [];
        for (const pk in t.cost) cs.push(ITEMS[pk].name + '×' + t.cost[pk]);
        pDim.textContent = done ? '已完成' : prog + ' / ' + techCostTotal(tid) + '（' + cs.join(' + ') + '）';
      }
    }
  });
}

function updateMachineLive() {
  if (G.panelMode !== 'machine' || !G.panelEnt) return;
  const e = G.panelEnt;
  if (!G.ents.includes(e)) { closePanel(); return; }
  const body = document.getElementById('panel-body');
  let prog = 0, status = '', state = 'warn', runTotal = 0;
  const api = {
    set: (k, v) => {
      const el = body.querySelector('[data-live="' + k + '"]');
      if (el && el.innerHTML !== v) el.innerHTML = v;
    },
    toggle: (sel, show, txt) => {
      const el = body.querySelector(sel);
      if (!el) return;
      if (!show) { el.style.display = 'none'; return; }
      el.style.display = '';
      if (txt && el.textContent !== txt) el.textContent = txt;
    },
    // prog(pct, total)：pct 为进度百分比(0-100)，total 为当前这一轮加工的总时长(秒)。
    // 传入 total 后，面板 loading 会额外显示总时长与剩余时长。
    prog: (v, t) => { prog = v; runTotal = (t && t > 0) ? t : 0; },
    // status(text, kind)：kind 取 'ok'(工作)/'warn'(暂停·需留意)/'bad'(故障)，用于区分颜色
    status: (s, k) => { status = s; if (k) state = k; }
  };
  // 配方设备：使用重新设计的交互面板，按自身逻辑刷新原料/产品/进度
  if (isRecipeDevice(e)) {
    if (isAssemblerMachine(e)) {
      updateAssemblerLive(e, body, api);
    } else {
      updateRecipeMachineLive(e, body, api);
    }
  } else {
    updateGenericDeviceLive(e, body, api);
  }
  const bar = body.querySelector('.bar i');
  if (bar) bar.style.width = Math.max(0, Math.min(100, prog)) + '%';
  // 面板 loading 运行时显示总时长与剩余时长（仅当设备通过 api.prog 提供了总时长）
  const barEl = body.querySelector('.bar');
  let timeEl = body.querySelector('.bar-time');
  if (runTotal > 0 && prog > 0) {
    if (!timeEl) {
      timeEl = document.createElement('div');
      timeEl.className = 'bar-time';
      if (barEl) {
        if (barEl.nextSibling) barEl.parentNode.insertBefore(timeEl, barEl.nextSibling);
        else barEl.parentNode.appendChild(timeEl);
      }
    }
    const remain = Math.max(0, runTotal * (1 - Math.min(100, prog) / 100));
    const txt = '总时长 ' + runTotal.toFixed(1) + 's · 剩余 ' + remain.toFixed(1) + 's';
    if (timeEl.textContent !== txt) timeEl.textContent = txt;
  } else if (timeEl) {
    timeEl.textContent = '';
  }
  // 通用设备外壳：进度条内部同步显示百分比 + 剩余时间（组装机 asm3-prog 风格）
  if (!isRecipeDevice(e)) {
    const pctEl = body.querySelector('[data-live="mch-pct"]');
    if (pctEl) {
      let txt = Math.floor(prog) + '%';
      if (runTotal > 0 && prog > 0) txt += '  ' + Math.max(0, runTotal * (1 - Math.min(100, prog) / 100)).toFixed(1) + 's';
      if (pctEl.textContent !== txt) pctEl.textContent = txt;
    }
  }
  const stEl = body.querySelector('.status');
  if (stEl && status) {
    if (stEl.textContent !== status) stEl.textContent = status;
    const wantCls = 'status ' + (state || 'warn');
    if (stEl.className !== wantCls) stEl.className = wantCls;
  }
  // 顶部状态点配色（所有 asm3 风格面板通用）：state 'ok'→绿('on')，'warn'→黄，'bad'→红
  body.querySelectorAll('.asm3-status-dot').forEach(dotEl => {
    const dotCls = 'asm3-status-dot ' + (state === 'ok' ? 'on' : (state || 'warn'));
    if (dotEl.className !== dotCls) dotEl.className = dotCls;
  });
}

// 配方设备交互面板的实时刷新（原料/产品数量 + 进度 + 状态）
function updateRecipeMachineLive(e, body, api) {
  const info = recipeDeviceInfo(e);
  const rec = e.recipe ? info.getRec(e.recipe) : null;
  // 原料数量
  if (rec) {
    let inp = '';
    for (const k in rec.inp) {
      const cur = e.inp[k] || 0;
      const need = rec.inp[k];
      const isFluid = FLUIDS.indexOf(k) >= 0;
      // 流体原料槽不可点击（只读）：流体只能通过管道自动吸入，不能像普通物品一样拿起/放入
      const tip = isFluid
        ? ITEMS[k].name + '|流体：经相邻管道自动吸入，配方需 ' + need + '，当前 ' + cur
        : ITEMS[k].name + '|配方需 ' + need + '，当前 ' + cur + '。点击拿起（移到背包点击即取回），右键取回 1 件；先选中左侧背包物品再点击此槽放入';
      inp += '<div class="mch-io-slot' + (isFluid ? ' display' : '') + (cur >= need ? ' full' : '') + '"' +
        (isFluid ? '' : ' data-action="feed-slot" data-id="' + k + '"') + ' data-tip="' + tip + '">' +
        '<img src="' + iconDataURL(k) + '"><span class="mch-io-n">' + cur + '/' + need + '</span></div>';
    }
    api.set('mch-inp', inp);
    // 产品数量
    let out = '';
    const outMap = rec.out || {};
    const probMap = rec.prob || {};
    const outKeys = Object.keys(outMap).length ? Object.keys(outMap) : Object.keys(probMap);
    for (const k of outKeys) {
      const cur = e.outp[k] || 0;
      const isFluid = FLUIDS.indexOf(k) >= 0;
      // 流体产物槽不可点击（只读）：自动排入相邻管道，不能取出到背包
      const tip = isFluid
        ? ITEMS[k].name + '|流体产物，自动排入相邻管道（当前 ' + cur + '）'
        : ITEMS[k].name + '|' + (outMap[k] ? ('每周期 ' + outMap[k] + ' 件，点击取回 1 件') : '概率产出，点击取回') + '（当前 ' + cur + '）';
      out += '<div class="mch-io-slot' + (isFluid ? ' display' : '') + '"' +
        (isFluid ? '' : ' data-action="take-slot" data-id="' + k + '"') + ' data-tip="' + tip + '">' +
        '<img src="' + iconDataURL(k) + '"><span class="mch-io-n">' + cur + '</span></div>';
    }
    api.set('mch-out', out);
  }
  // 配方名称与图标（对齐组装机：实时刷新配方头部）
  const rnameEl = body.querySelector('[data-live="mch-rname"]');
  if (rnameEl) {
    const nm = rec ? info.name(e.recipe) : '未设置配方';
    if (rnameEl.textContent !== nm) rnameEl.textContent = nm;
  }
  // 同步配方头部的 data-rec-id（悬停配方卡委托用）：配方切换/清除后属性需跟着变
  const recHead = body.querySelector('.asm3-recipe-item');
  if (recHead) {
    if (rec) {
      const outId = recipeMainIcon(rec, info, e.recipe);
      if (recHead.dataset.recId !== e.recipe) recHead.dataset.recId = e.recipe;
      const wantItem = outId || '';
      if (recHead.dataset.itemid !== wantItem) recHead.dataset.itemid = wantItem;
    } else {
      if (recHead.dataset.recId) delete recHead.dataset.recId;
      if (recHead.dataset.itemid) delete recHead.dataset.itemid;
    }
  }
  const riconEl = body.querySelector('[data-live="mch-ricon"]');
  if (riconEl) {
    const outId = rec ? recipeMainIcon(rec, info, e.recipe) : null;
    const html = outId ? '<img src="' + iconDataURL(outId) + '">' : '';
    if (riconEl.innerHTML !== html) riconEl.innerHTML = html;
  }
  // 进度与状态
  const pct = (rec && e.crafting) ? (e.prog / rec.time * 100) : 0;
  api.prog(pct, rec ? rec.time : 0);
  // 进度条内部显示百分比 + 剩余时间（组装机风格）
  const pctEl = body.querySelector('[data-live="mch-pct"]');
  if (pctEl) {
    let txt = Math.floor(pct) + '%';
    if (rec && e.crafting) txt += '  ' + Math.max(0, rec.time - e.prog).toFixed(1) + 's';
    if (pctEl.textContent !== txt) pctEl.textContent = txt;
  }
  if (!rec) { api.status('未设置配方，点击「清除配方」选择', 'warn'); return; }
  if (e.crafting) { api.status('生产中：' + info.name(e.recipe), 'ok'); return; }
  const needsPower = typeof e.powerDemand === 'function' && e.powerDemand() > 0;
  if (needsPower && powerSatOf(e) <= 0) { api.status('已暂停：缺电', 'bad'); return; }
  // 产物堆积停机提示：设备有 outputBufferFull/实际因堆积暂停时，如实显示而非「已就绪」
  const backlogState = (typeof machineBacklogPaused === 'function') ? machineBacklogPaused(e, rec) : false;
  if (backlogState) { api.status('已暂停：产物堆积（取走产物后继续）', 'warn'); return; }
  // 检查原料是否满足
  let missing = null;
  for (const k in rec.inp) if ((e.inp[k] || 0) < rec.inp[k]) { missing = k; break; }
  if (missing) { api.status('已暂停：缺少原料 ' + ITEMS[missing].name, 'warn'); return; }
  api.status('已就绪，等待开始生产', 'ok');
}

function chip(id, n, iconOnly) {
  return '<span class="chip" data-itemid="' + id + '" data-tip="' + itemTip(id) + '" data-itemsearch="' +
    ITEMS[id].name.toLowerCase().replace(/"/g, '') + '"><img src="' + iconDataURL(id) + '">' +
    (iconOnly ? (n !== undefined ? ' ×' + n : '') : ITEMS[id].name + (n !== undefined ? ' ×' + n : '')) + '</span>';
}

// ===== 玩家背包固定格渲染（对齐《异星工厂》有限背包）=====
// 背包是有限的 INV_SLOT_COUNT 个固定格子。每格对应一种物品：格内显示物品图标，
// 物品数量以右下角角标(.cnt)显示。空格显示为空槽。格子数来自官方数据 inventory_size=80。
// 手雷/集束手雷与生鱼在对应格子上提供快捷使用角标。
// 排列规则（需求：背包物品不要自动排序，每格物品相互独立）：
//   - 用户手动摆放的物品：放在哪格就显示在哪格（G.invSlots 记录 槽位->{物品,数量}，允许空位间隔，
//     同一物品可占多格且各格独立，移动其中一格不会将其它同物品格子集中）。
//   - 自动放入的物品（挖矿/拾取/制作产出/取出设备等）：自动排到所有手动槽之后。
// 手动槽优先占满前面的格子，自动物品跟在后面；格子不足时自动物品被挤出（背包满）。

// 背包格子布局：返回 { manual: 手动槽视觉堆叠数组（含 null 空位）, auto: 自动物品视觉堆叠数组, total: 总格数 }
// 手动槽 G.invSlots：下标即格子下标，元素为 {id, count} 或 null（兼容旧档纯 id 字符串）。
// 同一物品允许占多个相互独立的手动槽（每槽一组），移动/摆放只影响被点的格子，其余格子不动。
// 自动放入的物品（挖矿/拾取/制作产出/取出设备等）= 总量减去手动槽已占数量后的余量，排在手动区之后。

// 把 (id,count) 展开为若干视觉堆叠（蓝图恒一格；其余每格 ≤ 一组堆叠上限）
function invExpandStacks(id, count) {
  const out = [];
  if (!(count > 0)) return out;
  if (typeof isBlueprintItem === 'function' && isBlueprintItem(id)) { out.push({ id, count }); return out; }
  const cap = (typeof stackSize === 'function') ? stackSize(id) : 100;
  let rem = count;
  while (rem > 0) { const c = Math.min(cap, rem); out.push({ id, count: c }); rem -= c; }
  return out;
}

// 手动槽中每种物品已占用的数量合计（id -> Σcount）。供容量计算使用：
// 同一物品拆成多格独立摆放时，自动余量 = 总量 - 手动合计，占用格数按实际布局计。
function invManualCnt() {
  const m = new Map();
  const raw = (G.invSlots && Array.isArray(G.invSlots)) ? G.invSlots : [];
  for (let e of raw) {
    if (typeof e === 'string') e = { id: e, count: invCount(e) };
    if (!e || e.id == null) continue;
    let cnt = (typeof e.count === 'number' && e.count > 0) ? e.count : invCount(e.id);
    if (!(typeof isBlueprintItem === 'function' && isBlueprintItem(e.id))) cnt = Math.min(cnt, invCount(e.id));
    if (cnt > 0) m.set(e.id, (m.get(e.id) || 0) + cnt);
  }
  return m;
}

function invSlotLayout() {
  const raw = (G.invSlots && Array.isArray(G.invSlots)) ? G.invSlots : [];
  const manual = [];
  const manualCnt = new Map();
  for (let e of raw) {
    if (typeof e === 'string') e = { id: e, count: invCount(e) };   // 旧档：整物品视为一槽（渲染时自动展开多格）
    if (!e || e.id == null || !isInvOwnedItem(e.id)) { manual.push(null); continue; }
    let cnt = (typeof e.count === 'number' && e.count > 0) ? e.count : invCount(e.id);
    if (!(typeof isBlueprintItem === 'function' && isBlueprintItem(e.id))) cnt = Math.min(cnt, invCount(e.id));
    const stacks = invExpandStacks(e.id, cnt);
    if (!stacks.length) { manual.push(null); continue; }
    for (const st of stacks) manual.push(st);
    manualCnt.set(e.id, (manualCnt.get(e.id) || 0) + cnt);
  }
  while (manual.length && manual[manual.length - 1] == null) manual.pop();
  const auto = [];
  G.inv.forEach((n, id) => {
    if (!isInvOwnedItem(id)) return;
    const rem = n - (manualCnt.get(id) || 0);
    if (rem > 0) for (const st of invExpandStacks(id, rem)) auto.push(st);
  });
  const total = invSlotCount();
  // 自动物品默认排在手动区之后的「尾部空格」；只有尾部格子不够时，
  // 溢出的堆叠才回头按从前往后的顺序填入手动区留下的「中间空格」。
  const tailCap = Math.max(0, total - manual.length);   // 尾部可容纳的自动堆叠数
  const tailAuto = auto.slice(0, tailCap);
  const overflow = auto.slice(tailCap);
  const filled = manual.slice();
  let oi = 0;
  for (let i = 0; i < filled.length && oi < overflow.length; i++) {
    if (filled[i] == null) filled[i] = overflow[oi++];
  }
  // 中间空格也不够（理论上 invAdd 已保证不会发生）：剩余自动堆叠从尾部挤出
  const restAuto = overflow.slice(oi);
  return { manual: filled, auto: tailAuto.concat(restAuto), total };
}

// 指定格子的物品 id（越界/空槽返回 null）。idx 为「视觉格」下标。
function invSlotIdAt(idx, L) {
  const s = invStackSlots(L)[idx];
  return (s && s.id != null) ? s.id : null;
}

// 视觉格展开：手动槽（每槽一组，超上限自动展开）+ 自动余量堆叠，返回长度恒为 total 的 {id,count} 数组。
function invStackSlots(L) {
  if (!L) L = invSlotLayout();
  const total = L.total;
  const out = L.manual.concat(L.auto).map(s => (s && s.id != null) ? s : { id: null, count: 0 });
  if (out.length > total) out.length = total;
  while (out.length < total) out.push({ id: null, count: 0 });
  return out;
}

// 背包格布局签名：以「视觉格 → 物品」序列为签名。堆叠跨组增减（多占/少占一格）
// 或物品集合/顺序变化都会改变签名，触发格子重建；同一组内的数量变化不重建。
function invSlotSig() {
  const L = invSlotLayout();
  const enc = s => {
    const id = s.id;
    if (id == null) return '';
    // 蓝图（blueprint#n）或未知物品不在 ITEMS 展示表，加前缀区分，避免与普通 id 歧义
    return (ITEMS[id] ? '' : '?') + id;
  };
  return invStackSlots(L).map(enc).join('|');
}

function htmlInvSlots(withActionId) {
  const slots = invStackSlots();
  const sig = invSlotSig();
  let h = '<div id="inv-items-wrap" data-ownedsig="' + sig + '">';
  h += '<div class="inv-slots" id="inv-items">';
  for (let i = 0; i < slots.length; i++) {
    h += invSlotHtml(slots[i].id, i, withActionId, slots[i].count);
  }
  h += '</div>';
  let ownedLen = 0;
  for (const s of slots) if (s.id != null) ownedLen++;
  if (ownedLen === 0) {
    h += '<div class="dim" style="margin-top:6px">空空如也，去地图上按住右键挖矿吧（铁矿/铜矿/煤/石头）</div>';
  }
  h += '</div>';
  return h;
}

// 渲染单个背包格子：id 为 null 时空槽；每个有物品的格子标记 data-slotidx 并支持拖拽摆放。
// slotCount 为该视觉格显示的堆叠数量（多组物品每格最多一组）。
function invSlotHtml(id, idx, withActionId, slotCount) {
  const q = (G.invItemQ || '').trim().toLowerCase();
  if (id == null) {
    return '<div class="inv-slot empty" data-slotidx="' + idx + '"></div>';
  }
  // 蓝图物品（blueprint#n）不在 ITEMS 表里：图标/tooltip/搜索名都按基础 id 'blueprint' 处理。
  // 其余未知物品（旧档残留/废弃物品等）也按原 id 渲染占位，避免 ITEMS[id] 为 undefined 崩溃。
  const isBp = (typeof isBlueprintItem === 'function') ? isBlueprintItem(id) : false;
  const n = (slotCount != null) ? slotCount : invCount(id);
  const dispName = isBp ? bpItemName(id) : (ITEMS[id] ? ITEMS[id].name : id);
  const search = dispName.toLowerCase().replace(/"/g, '');
  const hit = !q || search.includes(q);
  let use = '';
  // 手雷/集束手雷：可在背包中直接投掷（对齐《异星工厂》投掷物）
  if (id === 'grenade' || id === 'cluster-grenade') {
    use = '<button class="slot-use" data-action="use-grenade" data-type="' + id + '" title="投掷' + dispName + '（向当前朝向投掷，造成范围爆炸）">💣</button>';
  }
  // 生鱼：可在背包中直接食用回血（对齐《异星工厂》：吃鱼治疗）
  if (id === 'raw-fish') {
    use = '<button class="slot-use" data-action="eat-fish" data-type="' + id + '" title="食用' + dispName + '（恢复 20 生命值）">🐟</button>';
  }
  // 蓝图物品（blueprint#n）：按基础 id 渲染图标，tooltip 显示蓝图内容摘要
  const iconId = isBp ? 'blueprint' : id;
  const tipHtml = isBp ? bpItemTip(id) : itemTip(id);
  return '<div class="inv-slot' + (hit ? '' : ' hidden') + '" data-itemid="' + id + '" data-slotidx="' + idx + '"' +
    (withActionId ? ' id="' + withActionId + '-' + encodeURIComponent(id) + '"' : '') +
    ' data-tip="' + tipHtml + '" data-itemsearch="' + search + '" draggable="true">' +
    '<img src="' + iconDataURL(iconId, 16) + '">' +
    '<span class="cnt" data-cnt="' + id + '">' + (isBp ? '∞' : n) + '</span>' +
    use + '</div>';
}

function htmlInventory(withActionId) {
  let h = '';
  const iq = (G.invItemQ || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  h += '<input id="inv-item-search" class="inv-search" type="text" placeholder="搜索物品（输入名称）" autocomplete="off" value="' + iq + '">';
  h += htmlInvSlots(withActionId);
  return h;
}

// ===== 装甲面板（左=玩家背包，右=模块化护甲装备网格）=====
// 对齐《异星工厂》：右键模块化护甲打开。右栏显示该护甲的装备网格（尺寸/可放装备类别
// 取自官方 equipment-grid），网格中可安装个人装备件，点击装备件可卸下返还背包。
function htmlArmorPanel() {
  const aid = G.panelArmor;
  const def = (aid && ARMORS[aid]) ? ARMORS[aid] : null;
  const wh = def ? def.grid : 0;
  const gridHtml = wh ? equipGridHtml(aid) : '<div class="dim">该护甲没有装备网格</div>';
  // 网格下方仅两行：第一行网格尺寸，第二行当前护甲网格内的能量护盾承载量
  let summary = wh
    ? '<div class="dim armor-summary">装备网格：' + wh.w + '×' + wh.h + '</div>' +
      '<div class="dim armor-summary">🛡 能量护盾承载：' + shieldCapacityOf(aid) + ' 点伤害</div>'
    : '<div class="dim armor-summary">该护甲没有装备网格</div>';
  // 放电防御为功能性按钮，保留（作用于当前穿戴装备）
  if (wh && typeof hasDischargeDefense === 'function' && hasDischargeDefense()) {
    const cd = Math.max(0, G.dischargeCd || 0);
    summary += '<div class="dim armor-summary"><button class="rcbtn" data-discharge="1"' + (cd > 0 ? ' disabled' : '') + '>⚡ 放电防御（点击激活，冷却 ' + cd.toFixed(1) + 's）</button></div>';
  }
  return '<div class="inv-layout armor-layout">' +
    '<div class="inv-col inv-col-left">' +
      '<div class="inv-col-head">🎒 玩家背包</div>' +
      '<div class="inv-col-body" id="inv-armor-body">' + htmlInventory() + '</div>' +
    '</div>' +
    '<div class="inv-col inv-col-right">' +
      '<div class="inv-col-head">' + (def ? def.name : '装甲') + '</div>' +
      '<div class="inv-col-body">' + gridHtml + summary + '</div>' +
    '</div>' +
  '</div>';
}

// ===== 个人物流区（对齐《异星工厂》Personal logistic request + Trash slots）=====
// 中间物流区自上而下分为：
//   顶部：两个开关 —— 「背包物流」总开关 + 「回收未请求物品」开关
//   中部物流需求区（绿色虚线格）：请求物品格子（每行 10 格，共 5 行 = 50 格）。
//     左键点击空格 → 弹出物品选择框（与机械臂筛选选择物品弹框同款样式，可选物品
//     取子模块数据全集 filterChoices()），选中即设为该格请求物品；若该物品已在
//     其它格请求，选择后切换到当前格。左键点击已有物品格 → 修改请求数量；
//     右键点击已有物品格 → 清除该格请求。格子中设置的物品会被物流机器人运到背包。
//   底部物流回收区（红色虚线格）：相当于一个实体箱子（每行 10 格，共 3 行 = 30 格）。
//     与背包直接交互：把背包某格物品拖到回收格（或拿起该格物品后点击回收格）= 该格
//     多少数量就整体移入回收区多少；点击回收区内物品 = 拿起于鼠标，再点击背包格放回
//     背包（或拖回背包）。回收区内的物品会被物流机器人从这里取走运回网络。
// 物流引擎数据源：请求区为 G.logiRequest（item->请求数量）+ G.logiReqGrid（格位物品）；
// 回收区为 G.logiTrashGrid（每格 {item, count} 实体物品堆叠，格位稳定）。

// 物流区（请求）格子数：每行 10 格，共 5 行
const LOGI_REQ_ROWS = 5, LOGI_REQ_PER_ROW = 10;
// 物流回收区格子数：每行 10 格，共 3 行
const LOGI_RECYCLE_ROWS = 3, LOGI_RECYCLE_PER_ROW = 10;
// 通过选择弹框新设请求时的默认请求数量
const LOGI_REQ_DEFAULT = 10;

// 确保两个格子布局数组就位（旧档只有 item->数量 映射：按键序回填到前面的槽位）
function ensureLogiSlots() {
  const reqCap = LOGI_REQ_ROWS * LOGI_REQ_PER_ROW;
  if (!Array.isArray(G.logiReqGrid) || G.logiReqGrid.length !== reqCap) {
    G.logiReqGrid = new Array(reqCap).fill(null);
    const keys = Object.keys(G.logiRequest || {}).filter(k => G.logiRequest[k] > 0 && ITEMS[k]).sort();
    for (let i = 0; i < keys.length && i < reqCap; i++) G.logiReqGrid[i] = keys[i];
  }
  const trashCap = LOGI_RECYCLE_ROWS * LOGI_RECYCLE_PER_ROW;
  let gt = G.logiTrashGrid;
  const oldMarks = [];
  if (!Array.isArray(gt) || gt.length !== trashCap) {
    if (Array.isArray(gt)) for (const k of gt) if (typeof k === 'string' && ITEMS[k] && oldMarks.indexOf(k) < 0) oldMarks.push(k);
    gt = null;
  } else if (gt.some(s => typeof s === 'string')) {
    for (const k of gt) if (typeof k === 'string' && ITEMS[k] && oldMarks.indexOf(k) < 0) oldMarks.push(k);
    gt = null;
  } else {
    // 新格式：校验每格堆叠合法性（物品存在、数量为正），非法格位置空
    gt = gt.map(s => (s && s.item && ITEMS[s.item] && s.count > 0) ? { item: s.item, count: s.count | 0 } : null);
  }
  if (G.trashSlots) for (const k in G.trashSlots) if (G.trashSlots[k] && ITEMS[k] && oldMarks.indexOf(k) < 0) oldMarks.push(k);
  if (!gt) {
    gt = new Array(trashCap).fill(null);
    // 旧档「标记回收」迁移：把背包中该物品的全部数量搬入回收格（原本机器人也会全部运走）
    let ci = 0;
    for (const item of oldMarks) {
      let left = invCount(item);
      if (left <= 0) continue;
      invTake(item, left);
      const cap = stackSize(item);
      while (left > 0 && ci < trashCap) { const n = Math.min(cap, left); gt[ci++] = { item, count: n }; left -= n; }
      if (left > 0) invAdd(item, left);   // 回收格不够放时剩余退回背包
    }
  }
  G.logiTrashGrid = gt;
  G.trashSlots = null;
}

// 设置第 idx 个请求格的物品为 item：若该物品已在其它格 → 切换到本格；本格原物品被替换掉
function logiReqSetSlot(idx, item) {
  ensureLogiSlots();
  if (!G.logiRequest) G.logiRequest = {};
  const g = G.logiReqGrid;
  for (let i = 0; i < g.length; i++) if (g[i] === item && i !== idx) g[i] = null;
  const old = g[idx];
  g[idx] = item;
  if (old && old !== item && g.indexOf(old) < 0) delete G.logiRequest[old];
  if (!(G.logiRequest[item] > 0)) G.logiRequest[item] = LOGI_REQ_DEFAULT;
}
// 清除第 idx 个请求格（该物品不再占用任何格时同步删除请求量）
function logiReqClearSlot(idx) {
  ensureLogiSlots();
  const item = G.logiReqGrid[idx];
  if (!item) return false;
  G.logiReqGrid[idx] = null;
  if (G.logiReqGrid.indexOf(item) < 0 && G.logiRequest) delete G.logiRequest[item];
  return true;
}
// ===== 物流回收区（实体箱子模型）：G.logiTrashGrid 每格 {item, count} 或 null =====
// 回收区内某物品的总数量
function trashGridCount(item) {
  let n = 0;
  for (const s of G.logiTrashGrid || []) if (s && s.item === item) n += s.count;
  return n;
}
// 从回收区取出 n 件指定物品（逐格扣减），返回实际取出件数
function trashGridTake(item, n) {
  let left = n;
  const g = G.logiTrashGrid || [];
  for (let i = 0; i < g.length && left > 0; i++) {
    const s = g[i];
    if (s && s.item === item) {
      const c = Math.min(s.count, left);
      s.count -= c; left -= c;
      if (s.count <= 0) g[i] = null;
    }
  }
  return n - left;
}

// 渲染物流需求区格子（10x5）。每格显示 G.logiReqGrid 中登记的物品（格位固定）。
function logiReqGridHtml() {
  ensureLogiSlots();
  const lreq = G.logiRequest || {};
  const cap = LOGI_REQ_ROWS * LOGI_REQ_PER_ROW;
  let h = '<div class="logi-grid" id="logi-req-grid">';
  for (let i = 0; i < cap; i++) {
    const k = G.logiReqGrid[i];
    if (k && ITEMS[k]) {
      const have = invCount(k);
      const req = lreq[k] || 0;
      h += '<div class="logi-cell req-cell" data-logireq="' + k + '" data-logireq-idx="' + i + '" data-tip="' + ITEMS[k].name + '|请求 ' + req + '，已持有 ' + have + '。左键修改数量，右键清除请求">' +
        '<img src="' + iconDataURL(k, 16) + '">' +
        '<span class="lreq-have cnt">' + req + '</span></div>';
    } else {
      h += '<div class="logi-cell req-cell empty" data-logireq="" data-logireq-idx="' + i + '" data-tip="物流需求|左键点击选择要请求的物品，物流机器人将送达背包">' +
        '<span class="req-plus">+</span></div>';
    }
  }
  h += '</div>';
  return h;
}

// 渲染物流回收区格子（10x3）。回收区相当于一个箱子：每格存放 {item, count} 实体物品堆叠。
function logiRecycleGridHtml() {
  ensureLogiSlots();
  const cap = LOGI_RECYCLE_ROWS * LOGI_RECYCLE_PER_ROW;
  let h = '<div class="logi-grid" id="logi-recycle-grid">';
  for (let i = 0; i < cap; i++) {
    const s = G.logiTrashGrid[i];
    if (s && s.item && ITEMS[s.item] && s.count > 0) {
      h += '<div class="logi-cell recycle-cell" draggable="true" data-logirecycle="' + s.item + '" data-logirecycle-idx="' + i + '" data-tip="' + ITEMS[s.item].name + '|回收区物品 ×' + s.count + '。点击拿起后可放回背包；物流机器人会从这里取走运回网络">' +
        '<img src="' + iconDataURL(s.item, 16) + '">' +
        '<span class="cnt">' + s.count + '</span></div>';
    } else {
      h += '<div class="logi-cell recycle-cell empty" data-logirecycle="" data-logirecycle-idx="' + i + '" data-tip="物流回收区|把背包物品拖到这里（或拿起后点击）即存入该格，机器人会从这里运走">' +
        '<span class="req-plus">+</span></div>';
    }
  }
  h += '</div>';
  return h;
}

function htmlLogistics() {
  const logiOn = G.logiEnabled !== false;
  const recUnreq = !!G.recycleUnrequested;
  // 顶部两个开关
  let h = '<div class="logi-switches">' +
    '<button class="logi-switch" data-logiswitch="main"' + (logiOn ? ' data-on="1"' : '') + '>' +
      '<span class="sw-label">背包物流</span><span class="sw-dot"></span></button>' +
    '<button class="logi-switch recycle" data-logiswitch="recycle"' + (recUnreq ? ' data-on="1"' : '') + '>' +
      '<span class="sw-label">回收未请求物品</span><span class="sw-dot"></span></button>' +
  '</div>';
  // 中部物流区（请求格子）
  h += logiReqGridHtml();
  // 底部物流回收区（回收格子）
  h += logiRecycleGridHtml();
  return h;
}

// ===== 物流箱（绿箱/蓝箱）物流区：与背包面板中间物流区同款布局与操作逻辑 =====
// （物流请求区 10×5 + 物流回收区 10×3），区别在于数据挂在箱子实体上：
//   请求区 → e.reqGrid（格位物品）+ e.requests（item→目标数量），机器人送货入箱；
//   回收区 → e.trashGrid（每格 {item,count} 实体堆叠），机器人从箱子取走运回网络。

// 当前面板是否为需求箱（蓝箱）/缓冲箱（绿箱）：是则返回该实体，否则 null
function chestLogiEnt() {
  const e = G.panelEnt;
  return (G.panelMode === 'machine' && e && (e instanceof LogisticRequester || e instanceof LogisticBuffer)) ? e : null;
}

// 确保箱子物流格子布局就位：reqGrid 缺失/长度不符时按 requests 回填；trashGrid 校验每格堆叠
function ensureChestLogiSlots(e) {
  if (!e) return;
  const reqCap = LOGI_REQ_ROWS * LOGI_REQ_PER_ROW;
  if (!Array.isArray(e.reqGrid) || e.reqGrid.length !== reqCap) {
    e.reqGrid = new Array(reqCap).fill(null);
    const keys = Object.keys(e.requests || {}).filter(k => e.requests[k] > 0 && ITEMS[k]).sort();
    for (let i = 0; i < keys.length && i < reqCap; i++) e.reqGrid[i] = keys[i];
  }
  const trashCap = LOGI_RECYCLE_ROWS * LOGI_RECYCLE_PER_ROW;
  if (!Array.isArray(e.trashGrid) || e.trashGrid.length !== trashCap) {
    e.trashGrid = new Array(trashCap).fill(null);
  } else {
    e.trashGrid = e.trashGrid.map(s => (s && s.item && ITEMS[s.item] && s.count > 0) ? { item: s.item, count: s.count | 0 } : null);
  }
}

// 设置箱子第 idx 个请求格物品（同物品其它格让位），同步 e.requests（与玩家 logiReqSetSlot 一致）
function chestLogiReqSetSlot(e, idx, item) {
  ensureChestLogiSlots(e);
  if (!e.requests) e.requests = {};
  const g = e.reqGrid;
  for (let i = 0; i < g.length; i++) if (g[i] === item && i !== idx) g[i] = null;
  const old = g[idx];
  g[idx] = item;
  if (old && old !== item && g.indexOf(old) < 0) delete e.requests[old];
  if (!(e.requests[item] > 0)) e.requests[item] = LOGI_REQ_DEFAULT;
}
// 清除箱子第 idx 个请求格（该物品不再占用任何格时同步删除请求量）
function chestLogiReqClearSlot(e, idx) {
  ensureChestLogiSlots(e);
  const item = e.reqGrid[idx];
  if (!item) return false;
  e.reqGrid[idx] = null;
  if (e.reqGrid.indexOf(item) < 0 && e.requests) delete e.requests[item];
  return true;
}

// 渲染箱子物流请求区格子（10×5，与背包 logiReqGridHtml 同款）
function chestLogiReqGridHtml(e) {
  ensureChestLogiSlots(e);
  const lreq = e.requests || {};
  const cap = LOGI_REQ_ROWS * LOGI_REQ_PER_ROW;
  let h = '<div class="logi-grid" id="chest-logi-req-grid">';
  for (let i = 0; i < cap; i++) {
    const k = e.reqGrid[i];
    if (k && ITEMS[k]) {
      const have = e.countOf(k);
      const req = lreq[k] || 0;
      h += '<div class="logi-cell req-cell" data-logireq="' + k + '" data-logireq-idx="' + i + '" data-tip="' + ITEMS[k].name + '|请求 ' + req + '，箱内 ' + have + '。左键修改数量，右键清除请求">' +
        '<img src="' + iconDataURL(k, 16) + '">' +
        '<span class="lreq-have cnt">' + req + '</span></div>';
    } else {
      h += '<div class="logi-cell req-cell empty" data-logireq="" data-logireq-idx="' + i + '" data-tip="物流请求|左键点击选择要请求的物品，物流机器人将送达该箱子">' +
        '<span class="req-plus">+</span></div>';
    }
  }
  h += '</div>';
  return h;
}

// 渲染箱子物流回收区格子（10×3，与背包 logiRecycleGridHtml 同款）
function chestLogiRecycleGridHtml(e) {
  ensureChestLogiSlots(e);
  const cap = LOGI_RECYCLE_ROWS * LOGI_RECYCLE_PER_ROW;
  let h = '<div class="logi-grid" id="chest-logi-recycle-grid">';
  for (let i = 0; i < cap; i++) {
    const s = e.trashGrid[i];
    if (s && s.item && ITEMS[s.item] && s.count > 0) {
      h += '<div class="logi-cell recycle-cell" draggable="true" data-logirecycle="' + s.item + '" data-logirecycle-idx="' + i + '" data-tip="' + ITEMS[s.item].name + '|回收区物品 ×' + s.count + '。点击拿起后可放回背包；物流机器人会从这里取走运回网络">' +
        '<img src="' + iconDataURL(s.item, 16) + '">' +
        '<span class="cnt">' + s.count + '</span></div>';
    } else {
      h += '<div class="logi-cell recycle-cell empty" data-logirecycle="" data-logirecycle-idx="' + i + '" data-tip="物流回收区|把背包物品拖到这里（或拿起后点击）即存入该格，机器人会从这里运走">' +
        '<span class="req-plus">+</span></div>';
    }
  }
  h += '</div>';
  return h;
}

// 箱子面板「物流」列内容：物流请求区 + 物流回收区（布局与背包中间物流区一致）
function chestLogiColHtml(e) {
  ensureChestLogiSlots(e);
  return '<div class="logi-sec-label">物流请求区</div>' + chestLogiReqGridHtml(e) +
    '<div class="logi-sec-label">物流回收区</div>' +
    '<div id="chest-logi-recycle">' + chestLogiRecycleGridHtml(e) + '</div>';
}

// 背包「合成页面」tab：独立渲染全部手搓配方（对齐《异星工厂》手工制造）。
// 与玩家背包一致的「格子 + 图标」网格展示：左键点击图标制作 1 个，右键点击制作 5 个。
// 配方所需材料/可制作次数以右下角角标(.cnt)显示，未解锁配方显示 🔒 锁标。
function craftMaxCount(rid) {
  const rec = RECIPES[rid];
  if (!rec) return 0;
  let max = Infinity;
  // 受当前持有材料限制
  for (const k in rec.inp) {
    if (rec.inp[k] > 0) max = Math.min(max, Math.floor(invCount(k) / rec.inp[k]));
  }
  // 受背包空间限制（每格一组、满组溢出到新格，受总格数约束）
  for (const k in rec.out) {
    if (FLUIDS.indexOf(k) >= 0) continue;
    const outN = rec.out[k] || 1;
    if (outN > 0) {
      const room = (typeof invRoomFor === 'function')
        ? invRoomFor(k, 0, invUsedSlots(), invSlotCount())
        : Math.max(0, stackSize(k) - invCount(k));
      max = Math.min(max, Math.floor(room / outN));
    }
  }
  return (isFinite(max) && max > 0) ? max : 0;
}
// —— 官方顺序比较器（数据来自 GAME_DATA.itemSubgroup/subgroupOrder/itemOrder）——
// 二级分组按官方 subgroupOrder 排序、组内物品按官方 itemOrder 排序；
// 无官方数据的兜底：subgroup 排最后、物品保持 data-recipes 原始顺序（稳定排序）。
function officialSubgroupCompare(a, b) {
  const A = (GAME_DATA.subgroupOrder && GAME_DATA.subgroupOrder[a]) || '\uffff';
  const B = (GAME_DATA.subgroupOrder && GAME_DATA.subgroupOrder[b]) || '\uffff';
  if (A !== B) return A < B ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}
function officialItemCompare(a, b) {
  const A = (GAME_DATA.itemOrder && GAME_DATA.itemOrder[a]) || '';
  const B = (GAME_DATA.itemOrder && GAME_DATA.itemOrder[b]) || '';
  if (A && B) return A < B ? -1 : A > B ? 1 : 0;
  if (A) return -1;
  if (B) return 1;
  return 0; // 稳定排序：无官方顺序的兜底保持原顺序
}

function htmlCraft() {
  let h = '';
  const q = (G.invRecipeQ || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  h += '<input id="inv-recipe-search" class="inv-search" type="text" placeholder="搜索配方（输入物品名称）" autocomplete="off" value="' + q + '">';
  // 制作栏 5 个 Tab（数据单源归类，见 GAME_DATA.itemGroup）
  let activeTab = G.invRecipeTab && CRAFT_TABS.indexOf(G.invRecipeTab) >= 0 ? G.invRecipeTab : 'logistics';
  const perTab = { logistics: [], production: [], 'intermediate-products': [], space: [], combat: [] };
  // 组装机配方（含化工厂/炼油厂以外的普通配方）
  for (const rid in RECIPES) {
    if (isChemRecipe(rid)) continue;
    if (isCentrifugeRecipe(rid)) continue;
    if (typeof isElectroRecipe === 'function' && isElectroRecipe(rid)) continue;
    if (typeof isBiochamberRecipe === 'function' && isBiochamberRecipe(rid)) continue;
    if (typeof isCrusherRecipe === 'function' && isCrusherRecipe(rid)) continue;
    if (typeof isFoundryRecipe === 'function' && isFoundryRecipe(rid)) continue;
    if (typeof isAgricultureTowerRecipe === 'function' && isAgricultureTowerRecipe(rid)) continue;
    if (typeof isHubRecipe === 'function' && isHubRecipe(rid)) continue;
    const _r = RECIPES[rid];
    if (!_r.out) continue; // 概率产出配方（如星块再处理）不列入手搓清单
    // 含流体原料或产物的配方不列入手搓清单（流体只能走管道，需在组装机/化工厂生产）
    if (Object.keys(_r.inp).some(k => FLUIDS.indexOf(k) >= 0)) continue;
    if (Object.keys(_r.out).some(k => FLUIDS.indexOf(k) >= 0)) continue;
    const outId = Object.keys(_r.out)[0];
    // 按产物官方 item-group 单源归类到对应 Tab；无归类（理论为 0）时兜底放「物流」
    const tab = (GAME_DATA.itemGroup && GAME_DATA.itemGroup[outId]) || 'logistics';
    perTab[tab] = perTab[tab] || [];
    perTab[tab].push({ rid, outId });
  }
  // 激活分类没有任何配方时回退到第一个非空分类（空分类 Tab 不显示）
  if (!(perTab[activeTab] && perTab[activeTab].length)) {
    activeTab = CRAFT_TABS.find(t => perTab[t] && perTab[t].length) || 'logistics';
    G.invRecipeTab = activeTab;
  }
  // Tab 栏
  h += '<div class="craft-tabs" id="inv-recipe-tabs">';
  for (const tab of CRAFT_TABS) {
    const n = (perTab[tab] || []).length;
    if (!n) continue; // 该分类没有任何配方的 Tab 不显示
    const on = tab === activeTab ? ' active' : '';
    const label = CRAFT_TAB_LABEL[tab];
    h += '<button type="button" class="craft-tab' + on + '" data-tab="' + tab + '">' +
      '<span class="tab-icon">' + label.icon + '</span>' +
      '<span class="tab-label">' + label.text + '</span>' +
      '<span class="cnt">' + n + '</span></button>';
  }
  h += '</div>';
  // 每个 Tab 一个配方网格；Tab 内再按官方二级分组（item-subgroup）分组渲染。
  // 分组顺序按官方 subgroupOrder、组内物品按官方 itemOrder（与原始数据一致）；
  // 每个分组独立成行、每行固定 10 格，分组之间留空距（不显示分组名，同游戏原版制作栏样式）。
  for (const tab of CRAFT_TABS) {
    const items = perTab[tab] || [];
    const on = tab === activeTab ? '' : ' style="display:none"';
    const groups = new Map();
    for (const it of items) {
      const sg = (GAME_DATA.itemSubgroup && GAME_DATA.itemSubgroup[it.outId]) || '';
      if (!groups.has(sg)) groups.set(sg, []);
      groups.get(sg).push(it);
    }
    const sgList = Array.from(groups.keys()).sort(officialSubgroupCompare);
    h += '<div id="inv-recipes-' + tab + '" class="craft-grid" data-tab="' + tab + '"' + on + '>';
    for (const sg of sgList) {
      const list = groups.get(sg).slice().sort((x, y) => officialItemCompare(x.outId, y.outId));
      h += '<div class="craft-subgroup inv-slots">';
      for (const { rid, outId } of list) {
        const unlocked = recipeUnlocked(rid);
        const lockTech = recipeLockingTech(rid);
        const rec = RECIPES[rid];
        const cnt = unlocked ? craftMaxCount(rid) : 0;
        const searchKey = ITEMS[outId].name.toLowerCase();
        h += '<div class="inv-slot craft-slot' + (unlocked ? '' : ' locked') + '" data-action="craft" data-id="' + rid + '" data-mult="1" data-craftable="' + cnt + '" data-rsearch="' + searchKey.replace(/"/g, '') + '" data-tip="' + itemTip(outId) + '">' +
          '<img src="' + iconDataURL(outId, 16) + '">' +
          '<span class="cnt" data-cnt>' + cnt + '</span>' +
          (unlocked ? '' : '<span class="craft-lock" title="需先研究：' + TECHS[lockTech].name + '">🔒</span>') +
          '</div>';
      }
      h += '</div>';
    }
    h += '</div>';
  }
  h += '<div class="dim" id="inv-recipe-empty" style="display:none"></div>';
  return h;
}

// 切换制作栏 Tab：显示/隐藏对应配方网格，并刷新搜索过滤与空态提示
function switchCraftTab(tab) {
  const body = document.getElementById('panel-body');
  if (!body) return;
  if (CRAFT_TABS.indexOf(tab) < 0) tab = 'logistics';
  G.invRecipeTab = tab;
  const tabs = body.querySelectorAll('#inv-recipe-tabs .craft-tab');
  for (const t of tabs) t.classList.toggle('active', t.dataset.tab === tab);
  for (const t of CRAFT_TABS) {
    const grid = body.querySelector('#inv-recipes-' + t);
    if (grid) grid.style.display = (t === tab) ? '' : 'none';
  }
  applyInvRecipeFilter(G.invRecipeQ || '');
}

function applyInvRecipeFilter(q) {
  const body = document.getElementById('panel-body');
  if (!body) return;
  const ql = (q || '').trim().toLowerCase();
  const activeTab = G.invRecipeTab && CRAFT_TABS.indexOf(G.invRecipeTab) >= 0 ? G.invRecipeTab : 'logistics';
  // 过滤所有 Tab 的配方槽（搜索词命中 rsearch 关键字），并隐藏无可见槽的二级分组
  for (const t of CRAFT_TABS) {
    const grid = body.querySelector('#inv-recipes-' + t);
    if (!grid) continue;
    grid.querySelectorAll('.craft-slot').forEach(el => {
      const hit = !ql || el.dataset.rsearch.includes(ql);
      el.style.display = hit ? '' : 'none';
    });
    // 搜索时隐藏没有任何可见槽位的二级分组（空分组留白不显示）
    grid.querySelectorAll('.craft-subgroup').forEach(g => {
      g.style.display = g.querySelectorAll('.craft-slot').length &&
        (!ql || Array.from(g.querySelectorAll('.craft-slot')).some(el => el.style.display !== 'none')) ? '' : 'none';
    });
  }
  // 搜索时同步更新 Tab 角标为「当前搜索命中的数量」，并隐藏命中为 0 的 Tab；
  // 当前激活 Tab 命中 0 时自动切换到第一个仍有结果的 Tab
  const newActive = updateCraftTabCounts(body, '#inv-recipe-tabs .craft-tab',
    tab => body.querySelector('#inv-recipes-' + tab), '.craft-slot', ql, activeTab);
  if (newActive !== activeTab) G.invRecipeTab = newActive;
  // 空态统计以（可能已切换的）当前激活 Tab 为准
  const activeGrid = body.querySelector('#inv-recipes-' + newActive);
  const shown = activeGrid ? Array.from(activeGrid.querySelectorAll('.craft-slot')).filter(el => el.style.display !== 'none').length : 0;
  const emp = document.getElementById('inv-recipe-empty');
  if (emp) {
    emp.textContent = ql ? '没有匹配「' + q.trim() + '」的配方' : '没有匹配的配方';
    emp.style.display = shown ? 'none' : '';
  }
}

// 搜索后同步分组 Tab 角标：把每个 Tab 的 .cnt 从「该组全部数量」更新为「搜索命中的数量」，
// 命中为 0 的组整个 Tab 不显示（清空搜索时恢复全部显示与原始数量）。
// 若当前激活 Tab 命中 0，自动切换到第一个仍有结果的 Tab，并同步按钮高亮与网格显隐。
// 返回（可能更新后的）激活 Tab。
// container：Tab 所在容器；tabsSel：Tab 按钮选择器；gridFor(tab)：取该 Tab 的网格容器；
// slotSel：槽位选择器；ql：小写搜索词；activeTab：当前激活 Tab。
function updateCraftTabCounts(container, tabsSel, gridFor, slotSel, ql, activeTab) {
  const btns = Array.from(container.querySelectorAll(tabsSel));
  btns.forEach(btn => {
    const grid = gridFor(btn.dataset.tab);
    if (!grid) return;
    const c = btn.querySelector('.cnt');
    if (!ql) {
      // 无搜索词：角标还原为该组全部数量；数量为 0 的分类 Tab 保持不显示
      const total = grid.querySelectorAll(slotSel).length;
      btn.style.display = total ? '' : 'none';
      if (c) c.textContent = total;
      return;
    }
    // 有搜索词：按槽位的 rsearch 关键字统计命中数（各 Tab 统一口径）
    let hit = 0;
    grid.querySelectorAll(slotSel).forEach(el => {
      if ((el.dataset.rsearch || '').includes(ql)) hit++;
    });
    // 数量为 0 的组：整个 Tab 不显示
    btn.style.display = hit ? '' : 'none';
    if (c) c.textContent = hit;
  });
  // 当前激活 Tab 若命中 0 被隐藏，自动切到第一个仍有结果的 Tab
  let active = activeTab;
  const activeBtn = btns.find(b => b.dataset.tab === active);
  if (!activeBtn || activeBtn.style.display === 'none') {
    const next = btns.find(b => b.style.display !== 'none');
    if (next) active = next.dataset.tab;
  }
  // 同步按钮高亮与网格显隐
  btns.forEach(b => {
    b.classList.toggle('active', b.dataset.tab === active);
    const g = gridFor(b.dataset.tab);
    if (g) g.style.display = (b.dataset.tab === active) ? '' : 'none';
  });
  return active;
}

// 背包「建造设备」列表：按关键字过滤建造设备按钮
function applyInvItemSearch(q) {
  const body = document.getElementById('panel-body');
  if (!body) return;
  const ql = (q || '').trim().toLowerCase();
  body.querySelectorAll('#inv-items .inv-slot[data-itemid]').forEach(el => {
    const hit = !ql || (el.dataset.itemsearch || '').includes(ql);
    el.classList.toggle('hidden', !hit);
  });
}

// 分流器过滤搜索：按关键字过滤可编程分离器的物品选择列表
function applySplitterFilterSearch(q) {
  const body = document.getElementById('panel-body');
  if (!body) return;
  const ql = (q || '').trim().toLowerCase();
  let shown = 0;
  body.querySelectorAll('.recgrid .rcbtn[data-action="sflt"]').forEach(el => {
    const hit = !ql || (el.dataset.search || '').includes(ql);
    el.style.display = hit ? '' : 'none';
    if (hit) shown++;
  });
  const emp = document.getElementById('sflt-empty');
  if (emp) {
    emp.textContent = ql ? '没有匹配「' + q.trim() + '」的物品' : '';
    emp.style.display = (ql && !shown) ? '' : 'none';
  }
}

// 机械臂筛选搜索：按关键字过滤机械臂筛选的物品选择列表
function applyInserterFilterSearch(q) {
  const body = document.getElementById('panel-body');
  if (!body) return;
  const ql = (q || '').trim().toLowerCase();
  let shown = 0;
  body.querySelectorAll('.recgrid .rcbtn[data-action="flt"]').forEach(el => {
    const hit = !ql || (el.dataset.search || '').includes(ql);
    el.style.display = hit ? '' : 'none';
    if (hit) shown++;
  });
  const emp = document.getElementById('flt-empty');
  if (emp) {
    emp.textContent = ql ? '没有匹配「' + q.trim() + '」的物品' : '';
    emp.style.display = (ql && !shown) ? '' : 'none';
  }
}

// 蓝图库搜索：按关键字过滤蓝图格子（客户端过滤，不重建面板，输入框不丢焦点）
function applyBbSearch(q) {
  const wrap = document.getElementById('bb-grid-wrap');
  if (!wrap) return;
  const ql = (q || '').trim().toLowerCase();
  let shown = 0;
  wrap.querySelectorAll('.bb-cell[data-bbsearch]').forEach(el => {
    const hit = !ql || el.dataset.bbsearch.includes(ql);
    el.style.display = hit ? '' : 'none';
    if (hit) shown++;
  });
  const emp = document.getElementById('bb-empty');
  if (emp) {
    emp.textContent = ql ? '没有匹配「' + q.trim() + '」的蓝图' : '';
    emp.style.display = (ql && !shown) ? '' : 'none';
  }
}

// 蓝图详情页（右键格子打开）：展示蓝图全部信息与操作按钮
function bbDetailLayoutHtml() {
  const i = G.bbDetail;
  const list = Array.isArray(G.blueBook) ? G.blueBook : [];
  const b = list[i];
  if (!b) return '<div class="dim">蓝图不存在或已被删除。</div><div class="bp-edit-row"><button id="bb-detail-back">← 返回蓝图库</button></div>';
  const bb = (typeof blueprintBounds === 'function') ? blueprintBounds(b.ents) : { W: 0, H: 0 };
  const types = {};
  for (const e of b.ents) types[e.type] = (types[e.type] || 0) + 1;
  const keys = Object.keys(types).sort((a, b2) => types[b2] - types[a]);
  let icons = '';
  for (const t of keys.slice(0, 48)) {
    const nm = ITEMS[t] ? ITEMS[t].name : t;
    icons += '<div class="bp-edit-slot" data-tip="' + nm + '|蓝图内 ' + types[t] + ' 个">' +
      '<img src="' + iconDataURL(t, 16) + '"><span class="cnt">' + types[t] + '</span></div>';
  }
  if (keys.length > 48) icons += '<div class="bp-edit-more">+' + (keys.length - 48) + '</div>';
  // 地砖构成
  const tileTypes = {};
  if (Array.isArray(b.tiles)) for (const t of b.tiles) tileTypes[t.type] = (tileTypes[t.type] || 0) + 1;
  const tileKeys = Object.keys(tileTypes);
  let tileTxt = '';
  if (tileKeys.length) {
    tileTxt = tileKeys.map(t => (ITEMS[t] ? ITEMS[t].name : t) + ' ×' + tileTypes[t]).join('、');
  }
  // 朝向分布（0=上 1=右 2=下 3=左）
  const dirs = [0, 0, 0, 0];
  for (const e of b.ents) dirs[e.dir & 3] = (dirs[e.dir & 3] || 0) + 1;
  const dirNames = ['上', '右', '下', '左'];
  const dirTxt = dirNames.map((n, d) => dirs[d] ? n + '×' + dirs[d] : '').filter(Boolean).join('、');
  const nameVal = String(b.name || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return '<div class="bb-detail-layout">' +
    '<div class="bb-detail-info">' +
      '<div class="bb-detail-thumb-wrap" data-tip="' + nameVal + '|蓝图内容缩略图（加载铺建后，鼠标在地图上会显示完整放置幽灵）"><canvas id="bb-detail-thumb" width="220" height="220"></canvas></div>' +
      '<div class="sec">蓝图名称</div>' +
      '<input id="bb-detail-name" class="inv-search" type="text" maxlength="40" placeholder="输入蓝图名称…" autocomplete="off" value="' + nameVal + '">' +
      '<div class="sec">基本信息</div>' +
      '<div class="dim">尺寸 ' + bb.W + '×' + bb.H + ' 格 · 共 ' + b.ents.length + ' 个建筑' +
        (Array.isArray(b.tiles) && b.tiles.length ? ' · 含 ' + b.tiles.length + ' 格地砖' : '') + '</div>' +
      '<div class="sec">建筑构成</div>' +
      '<div class="bp-edit-slots">' + icons + '</div>' +
      '<div class="dim">构成：' + (keys.map(t => (ITEMS[t] ? ITEMS[t].name : t) + ' ×' + types[t]).join('、') || '无') + '</div>' +
      (tileTxt ? '<div class="dim">地砖：' + tileTxt + '</div>' : '') +
      (dirTxt ? '<div class="dim">朝向：' + dirTxt + '</div>' : '') +
      '<div class="dim" style="margin-top:8px">提示：放置蓝图不消耗材料，可反复使用；放置时可按 R 旋转、V/H 翻转、Q 取消。</div>' +
    '</div>' +
    '<div class="bp-edit-actions">' +
      '<button id="bb-detail-place" class="btn bp-edit-primary">📋 加载并铺建（放到地图）</button>' +
      '<div class="bp-edit-row">' +
        '<button id="bb-detail-inv" class="btn sm">🎒 放入背包</button>' +
        '<button id="bb-detail-export" class="btn sm">📤 导出字符串</button>' +
        '<button id="bb-detail-del" class="btn sm bb-del">🗑 删除</button>' +
      '</div>' +
      '<div class="bp-edit-row"><button id="bb-detail-back" class="btn sm">← 返回蓝图库</button></div>' +
    '</div>' +
  '</div>';
}

// ===== 蓝图面板（对齐设备面板布局：左=玩家背包，右=蓝图库）=====
// 按 B 打开：左侧显示玩家背包（与设备面板一致，可选中物品建造/放入快捷栏），
// 右侧显示蓝图库（蓝图列表 + 导入/导出 + 当前复制的蓝图操作）。
function bluebookLayoutHtml() {
  const list = Array.isArray(G.blueBook) ? G.blueBook : [];
  const qEsc = String(G.bbQ || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  let grid = '<div class="bb-grid-bar">' +
    '<input id="bb-search" class="inv-search" type="text" placeholder="搜索蓝图…" autocomplete="off" value="' + qEsc + '">' +
    '<button data-bbview="1">' + (G.bbGridView === false ? '🔲 格子视图' : '📋 列表视图') + '</button>' +
    '</div>' +
    '<div class="dim" style="margin-bottom:4px">悬停看名字 · <b>左键</b>选中：点击地图铺建 / 点左侧背包空格放入 · <b>右键</b>详情</div>';
  const BB_COLS = 10;   // 蓝图库列数：与背包 10 列一致，行数可精确计算（预留空格用）
  if (!list.some(Boolean)) {
    grid += '<div class="dim">蓝图库为空。请在地图上按 <b>Alt+B</b>（或 Ctrl+C）拖拽框选一片建筑创建蓝图。</div>';
  }
  if (G.bbGridView === false) {
    // 列表视图：保留旧版条目式布局
    grid += htmlBlueBookList();
  } else {
    grid += '<div id="bb-grid-wrap"><div class="bb-grid">';
    // 槽位管理（对齐背包）：下标即格子位置，蓝图移走后原槽位留空不前移；
    // 规则：底部始终预留一行空格（蓝图铺到第 N 行则渲染到第 N+1 行）
    let maxFilled = -1;
    for (let i = 0; i < list.length; i++) if (list[i]) maxFilled = i;
    const rowsUsed = maxFilled < 0 ? 0 : Math.floor(maxFilled / BB_COLS) + 1;
    const totalCells = (rowsUsed + 1) * BB_COLS;
    for (let i = 0; i < totalCells; i++) {
      const b = list[i];
      if (!b) {
        grid += '<div class="bb-cell empty" data-bbcell="' + i + '" data-tip="空格|背包里选中蓝图物品后点击此格 = 移入蓝图库"></div>';
        continue;
      }
      const bb = (typeof blueprintBounds === 'function') ? blueprintBounds(b.ents) : { W: 0, H: 0 };
      const types = {};
      for (const e of b.ents) types[e.type] = (types[e.type] || 0) + 1;
      const keys = Object.keys(types).sort((a, b2) => types[b2] - types[a]);
      const name = String(b.name || '蓝图').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
      const search = String(b.name || '') + ' ' + keys.map(t => (ITEMS[t] ? ITEMS[t].name : t)).join(' ');
      grid += '<div class="bb-cell' + (G.bbSel === i ? ' sel' : '') + '" data-bbcell="' + i + '"' +
        ' data-bbsearch="' + search.toLowerCase().replace(/"/g, '') + '"' +
        ' data-tip="' + name + '|' + b.ents.length + ' 个建筑 · 尺寸 ' + bb.W + '×' + bb.H + ' 格' +
        (Array.isArray(b.tiles) && b.tiles.length ? ' · 含地砖' : '') +
        '（左键选中，右键详情）">' +
        // 统一蓝图图标：与背包里的蓝图物品图标一致（iconDataURL('blueprint')），不再画内容缩略图
        '<img src="' + iconDataURL('blueprint', 16) + '">' +
      '</div>';
      b._typeNames = keys.map(t => (ITEMS[t] ? ITEMS[t].name : t)).join('、');
    }
    grid += '</div>';
    grid += '<div id="bb-empty" class="dim" style="display:none;margin-top:8px"></div>';
    grid += '<div class="dim" style="margin-top:8px">选中蓝图后：点击地图直接铺建；点击左侧背包空格 = 移入背包（蓝图库中留空位）。背包里选中蓝图后点击蓝图库空格 = 移入该格。按 E/Q 关闭面板。</div>';
    grid += '</div>';
  }
  // 玩家背包（格子可点击，放入快捷栏/选中物品），带 id 供「点格子入包」寻址
  const inv = htmlInventory('bb-inv');
  // 布局：左侧 = 玩家背包，右侧 = 蓝图库列表（bb2-left 背包 / bb2-right 蓝图库，样式见 style.css）
  return '<div class="bb2-layout">' +
    '<div class="bb2-col bb2-left"><div class="bb2-col-head">🎒 玩家</div>' +
    '<div class="bb2-col-body">' + inv + '</div></div>' +
    '<div class="bb2-col bb2-right"><div class="bb2-col-head">📑 蓝图库</div>' +
    '<div class="bb2-col-body">' + grid + '</div></div>' +
  '</div>';
}

// 蓝图库列表视图（旧版条目式，保留粘贴/入包/导出/重命名/删除按钮）
function htmlBlueBookList() {
  const list = Array.isArray(G.blueBook) ? G.blueBook : [];
  let h = '<div class="sec">导入蓝图 <span class="dim">（对齐《异星工厂》Blueprint string）</span></div>' +
    '<div class="bb-import-row"><input id="bb-import-input" type="text" placeholder="粘贴蓝图字符串后点导入…" autocomplete="off">' +
    '<button data-bbimport="1">📥 导入</button></div>';
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    if (!b) continue;   // 空槽（蓝图已移走）：列表视图不显示
    const types = {};
    for (const e of b.ents) types[e.type] = (types[e.type] || 0) + 1;
    const typeNames = Object.keys(types).slice(0, 4).map(t => ITEMS[t] ? ITEMS[t].name : t).join('、') +
      (Object.keys(types).length > 4 ? ' 等' : '');
    h += '<div class="bluebook-item" data-bb="' + i + '">' +
      '<div class="bb-main"><div class="bb-name">' + b.name + '</div>' +
      '<div class="dim">' + b.ents.length + ' 个建筑 · ' + typeNames + '</div></div>' +
      '<button data-bbuse="' + i + '">📋 粘贴</button>' +
      '<button data-bbinv="' + i + '" title="把该蓝图作为物品放入背包（选中后点击地图放置）">🎒 入包</button>' +
      '<button data-bbexport="' + i + '" title="导出为蓝图字符串（复制分享/导入）">📤 导出</button>' +
      '<button data-bbrename="' + i + '">✏️ 重命名</button>' +
      '<button data-bbdel="' + i + '" class="bb-del">🗑 删除</button>' +
      '</div>';
  }
  return h;
}


// 把一份蓝图数据渲染为静态小缩略图（画进指定 2D 上下文）：世界底色 + 各建筑小图标。
// 供蓝图库格子/详情页/蓝图编辑界面复用，展示蓝图内容而非单一图标。
function drawBlueprintThumb(ctx, bp, W, H) {
  if (!ctx) return;
  ctx.clearRect(0, 0, W, H);
  // 世界底色（对齐地图草地色，弱化与真实地图的差异感）
  ctx.fillStyle = '#2c3e2a';
  ctx.fillRect(0, 0, W, H);
  const ents = (bp && Array.isArray(bp.ents)) ? bp.ents : [];
  if (!ents.length) return;
  const bb = (typeof blueprintBounds === 'function') ? blueprintBounds(ents) : null;
  if (!bb) return;
  const cell = Math.max(4, Math.min(W, H) / Math.max(bb.W, bb.H) * 0.86);
  const ox = (W - cell * bb.W) / 2, oy = (H - cell * bb.H) / 2;
  // 地砖层（若有）
  if (Array.isArray(bp.tiles)) {
    for (const t of bp.tiles) {
      ctx.fillStyle = 'rgba(150,150,150,.5)';
      ctx.fillRect(ox + (t.x - bb.minX) * cell, oy + (t.y - bb.minY) * cell, cell, cell);
    }
  }
  // 建筑层：优先真实设备渲染（DEVICE_RENDER），回退到物品图标
  for (const s of ents) {
    const px = ox + (s.x - bb.minX) * cell, py = oy + (s.y - bb.minY) * cell;
    const def = (typeof BUILD_DEFS !== 'undefined') ? BUILD_DEFS[s.type] : null;
    const w = (def ? def.w : 1) * cell, h = (def ? def.h : 1) * cell;
    const cls = (typeof ENT_CLASSES !== 'undefined') ? ENT_CLASSES[s.type] : null;
    if (cls && typeof DEVICE_RENDER !== 'undefined' && DEVICE_RENDER[s.type]) {
      let e = null;
      try { e = cls.restore(Object.assign({}, s)); } catch (err) { e = null; }
      if (e) {
        e.dir = s.dir | 0;
        if (typeof e.applyDir === 'function') e.applyDir();
        e.w = w; e.h = h;
        try { DEVICE_RENDER[s.type](ctx, e, px, py, e.dir, 1); } catch (err) {}
        continue;
      }
    }
    if (typeof drawItemGlyph === 'function' && ITEMS[s.type]) {
      drawItemGlyph(ctx, s.type, px + w / 2, py + h / 2, Math.min(w, h) * 0.9);
    } else {
      ctx.fillStyle = '#888';
      ctx.fillRect(px, py, w, h);
    }
  }
}

// 详情页/编辑界面的单个大缩略图：bb-detail-thumb 读 G.bbDetail，bp-edit-thumb 读 G.blueprint
function renderBlueprintDetailThumb() {
  const cv = document.getElementById('bb-detail-thumb');
  if (cv) {
    const b = (G.blueBook || [])[G.bbDetail];
    if (b) drawBlueprintThumb(cv.getContext('2d'), b, cv.width, cv.height);
  }
  const cv2 = document.getElementById('bp-edit-thumb');
  if (cv2 && G.blueprint) drawBlueprintThumb(cv2.getContext('2d'), G.blueprint, cv2.width, cv2.height);
}

// ===== 蓝图编辑界面（Alt+B 框选后弹出）=====
// 展示框选得到的蓝图摘要（建筑构成/尺寸/地砖），底部操作：
// 「创建蓝图」= 放到地图（进入粘贴模式）/ 放入背包 / 放入快捷栏。
function blueprintEditLayoutHtml() {
  const bp = G.blueprint;
  if (!bp || !bp.ents || !bp.ents.length) {
    return '<div class="dim">没有待编辑的蓝图。请先按 Alt+B 框选一片建筑。</div>';
  }
  const bb = blueprintBounds(bp.ents);
  // 统计建筑构成
  const types = {};
  for (const e of bp.ents) types[e.type] = (types[e.type] || 0) + 1;
  const keys = Object.keys(types).sort((a, b) => types[b] - types[a]);
  // 图标网格展示建筑构成
  let icons = '';
  for (const t of keys.slice(0, 24)) {
    const name = ITEMS[t] ? ITEMS[t].name : t;
    icons += '<div class="bp-edit-slot" data-tip="' + name + '|蓝图内 ' + types[t] + ' 个">' +
      '<img src="' + iconDataURL(t, 16) + '"><span class="cnt">' + types[t] + '</span></div>';
  }
  if (keys.length > 24) icons += '<div class="bp-edit-more">+' + (keys.length - 24) + '</div>';
  const nameVal = String(bp.name || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  return '<div class="bp-edit-layout">' +
    '<div class="bp-edit-info">' +
      '<div class="bp-edit-thumb-wrap" data-tip="' + nameVal + '|蓝图内容缩略图（进入粘贴模式后，鼠标在地图上会显示完整放置幽灵）"><canvas id="bp-edit-thumb" width="220" height="220"></canvas></div>' +
      '<div class="sec">蓝图名称</div>' +
      '<input id="bp-edit-name" class="inv-search" type="text" maxlength="40" placeholder="输入蓝图名称…" autocomplete="off" value="' + nameVal + '">' +
      '<div class="sec">蓝图内容</div>' +
      '<div class="dim">尺寸 ' + bb.W + '×' + bb.H + ' 格 · 共 ' + bp.ents.length + ' 个建筑' +
        (Array.isArray(bp.tiles) && bp.tiles.length ? ' · 含 ' + bp.tiles.length + ' 格地砖' : '') + '</div>' +
      '<div class="bp-edit-slots">' + icons + '</div>' +
      '<div class="dim" style="margin-top:8px">提示：放置蓝图不消耗材料，可反复使用；放置时可按 R 旋转、V/H 翻转、Q 取消。</div>' +
    '</div>' +
    '<div class="bp-edit-actions">' +
      '<button id="bp-edit-place" class="btn bp-edit-primary">🏗 创建蓝图（放到地图）</button>' +
      '<div class="bp-edit-row">' +
        '<button id="bp-edit-inv" class="btn sm">🎒 放入背包</button>' +
        '<button id="bp-edit-hotbar" class="btn sm">快捷栏放置：先点下方格子</button>' +
      '</div>' +
      '<div class="dim" style="margin-top:6px">「放入快捷栏」：先点击下方快捷栏空格，蓝图会放入该格。</div>' +
      '<div class="bp-edit-hotbar" id="bp-edit-hotbar-grid"></div>' +
    '</div>' +
  '</div>';
}

// 蓝图编辑界面的迷你快捷栏（10 格）：点击空格把蓝图物品放入快捷栏
function renderBpEditHotbar() {
  const grid = document.getElementById('bp-edit-hotbar-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (let i = 0; i < HOTBAR.length; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot' + (HOTBAR[i] ? '' : ' nilslot');
    slot.dataset.idx = i;
    if (HOTBAR[i]) {
      const ic = iconCanvas(HOTBAR[i], 16).cloneNode();
      ic.getContext('2d').drawImage(iconCanvas(HOTBAR[i], 16), 0, 0);
      slot.appendChild(ic);
    } else {
      const emp = document.createElement('span');
      emp.className = 'nilmark';
      emp.textContent = '空';
      slot.appendChild(emp);
    }
    const key = document.createElement('span');
    key.className = 'key';
    key.textContent = i === 9 ? '0' : (i + 1);
    slot.appendChild(key);
    slot.addEventListener('click', () => {
      const bp = G.blueprint;
      if (!bp || !bp.ents || !bp.ents.length) { toast('没有待放置的蓝图'); return; }
      const id = bpItemCreate(bp);
      if (!id) { toast('蓝图数据无效'); return; }
      if (HOTBAR[i]) {
        // 占用槽位：尝试替换（蓝图物品可直接覆盖普通物品槽，对齐设备物品交互）
        HOTBAR[i] = id;
        toast('已把蓝图放入快捷栏槽位 ' + (i === 9 ? 0 : i + 1) + '（原物品已替换）');
      } else {
        HOTBAR[i] = id;
        toast('已把蓝图放入快捷栏槽位 ' + (i === 9 ? 0 : i + 1));
      }
      if (typeof playSfx === 'function') playSfx('select');
      buildHotbar();
      renderBpEditHotbar();
      uiDirty = true;
    });
    grid.appendChild(slot);
  }
}

// 组装机面板：按关键字过滤「选择配方」网格中的配方按钮
function applyAssemblerRecipeFilter(q) {
  const body = document.getElementById('panel-body');
  if (!body) return;
  const ql = (q || '').trim().toLowerCase();
  let shown = 0;
  body.querySelectorAll('.recgrid .rcbtn[data-rsearch]').forEach(el => {
    const hit = !ql || el.dataset.rsearch.includes(ql);
    el.style.display = hit ? '' : 'none';
    if (hit) shown++;
  });
  const emp = document.getElementById('asm-recipe-empty');
  if (emp) {
    emp.textContent = ql ? '没有匹配「' + q.trim() + '」的配方' : '';
    emp.style.display = (ql && !shown) ? '' : 'none';
  }
}

// 科技面板：按关键字过滤「研究列表」中的科技条目（名称/描述/ID，匹配即显示）；
// 只原地切换显隐，不重建 DOM，保证输入框焦点不丢、不打断中文输入法。
function applyTechFilter(q) {
  const body = document.getElementById('panel-body');
  if (!body) return;
  const ql = (q || '').trim().toLowerCase();
  let shown = 0;
  const visByCat = {};
  body.querySelectorAll('.recipe.tech[data-techid]').forEach(el => {
    const hit = !ql || (el.dataset.techsearch || '').includes(ql);
    el.style.display = hit ? '' : 'none';
    if (hit) { shown++; visByCat[el.dataset.techcat] = (visByCat[el.dataset.techcat] || 0) + 1; }
  });
  // 分组表头：该分组下无可见科技时一并隐藏
  body.querySelectorAll('.tech-cat-head[data-techcathead]').forEach(head => {
    head.style.display = visByCat[head.dataset.techcathead] ? '' : 'none';
  });
  const emp = document.getElementById('tech-search-empty');
  if (emp) {
    emp.textContent = ql && !shown ? '没有匹配「' + q.trim() + '」的科技' : '';
    emp.style.display = (ql && !shown) ? '' : 'none';
  }
}

// ===== 研究面板：左=研究列表，右=研究树图 =====
// 依据 tech-report.md（官方 277 科技清单）重新设计研究面板：
//   · 左边栏：按模块分组的研究列表（触发式 / 研究中心式科技一目了然），支持分类筛选
//   · 右边栏：研究树图——每个科技一个节点，采用竖向（自上而下）缩进树展示前置依赖：
//       前置科技在上、后继科技在其下方缩进，严格"竖形"排列，便于按链条阅读解锁顺序

// 计算每个科技的最长前置深度（root 深度 0），供竖向缩进树确定层级。
// 返回 { depth: {tid:level}, maxDepth }
function techTreeLayout() {
  const depth = {};
  const visit = (tid, stack) => {
    if (depth[tid] !== undefined) return depth[tid];
    const t = TECHS[tid];
    let d = 0;
    for (const r of (t && t.req) || []) {
      if (stack.includes(r)) continue; // 防环
      d = Math.max(d, visit(r, stack.concat(tid)) + 1);
    }
    depth[tid] = d;
    return d;
  };
  for (const tid in TECHS) visit(tid, []);
  let maxDepth = 0;
  for (const tid in depth) if (depth[tid] > maxDepth) maxDepth = depth[tid];
  return { depth, maxDepth };
}

// 生成竖向研究树：前置在上、后继在其下方缩进（自上而下、窄而高，符合"竖形显示"）
function htmlTechTree() {
  // 子依赖表：parent -> [children]
  const children = {};
  for (const tid in TECHS) {
    const t = TECHS[tid];
    for (const r of (t.req || [])) {
      if (!children[r]) children[r] = [];
      children[r].push(tid);
    }
  }
  const byName = (a, b) => TECHS[a].name.localeCompare(TECHS[b].name, 'zh');
  for (const k in children) children[k].sort(byName);

  // 根节点 = 无前置依赖的科技（深拷贝列表后按名称排序）
  const roots = [];
  for (const tid in TECHS) if (!(TECHS[tid].req || []).length) roots.push(tid);
  roots.sort(byName);

  let h = '<div class="tech-vert-tree">';
  const shown = new Set();
  const walk = (tid, indent) => {
    if (shown.has(tid)) return; // DAG 共享节点只展示一次
    shown.add(tid);
    const t = TECHS[tid];
    const done = techResearched(tid);
    const locked = !done && techLocked(tid);
    const active = G.activeTech === tid;
    const inQueue = !!(G.techQueue && G.techQueue.indexOf(tid) >= 0);
    let cls = 'tech-vnode';
    if (done) cls += ' done';
    else if (locked) cls += ' locked';
    if (active) cls += ' active';
    if (inQueue && !active) cls += ' queued';
    const badge = t.trigger ? '⚡' : (isInfiniteTech(tid) ? '∞' : '');
    h += '<div class="tech-vrow" style="padding-left:' + (indent * 18) + 'px">';
    h += '<span class="tech-vguide"></span>';
    h += '<span class="' + cls + '" data-tid="' + tid + '" title="' + t.desc + '">';
    if (badge) h += '<span class="tech-badge">' + badge + '</span>';
    h += '<span class="tech-vname">' + t.name + '</span>';
    if (locked) h += '<span class="lock-tag">🔒</span>';
    h += '</span></div>';
    for (const c of (children[tid] || [])) walk(c, indent + 1);
  };
  for (const r of roots) walk(r, 0);
  // 兜底：孤立节点（成环或异常数据）也展示，避免遗漏
  for (const tid in TECHS) if (!shown.has(tid)) walk(tid, 0);
  h += '</div>';
  return h;
}
// 生成左边栏研究列表
function htmlTechList() {
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  // 分类筛选 tab
  const cats = ['all', 'base', 'quality', 'space-age'];
  const catName = { all: '全部', base: TECH_CAT.base.name, quality: TECH_CAT.quality.name, 'space-age': TECH_CAT['space-age'].name };
  const cur = G.techCatFilter || 'all';
  let h = '<div class="tech-tabs">';
  for (const c of cats) h += '<button data-techcat="' + c + '" class="tech-tab' + (cur===c?' active':'') + '">' + catName[c] + '</button>';
  h += '</div>';
  // 科技搜索：按名称/描述/ID 关键词过滤（科技过多，便于快速定位）
  h += '<input class="inv-search" id="tech-search" placeholder="搜索科技（名称/描述/ID）…" value="' + esc(G.techQ || '') + '">';
  h += '<div id="tech-search-empty" class="dim" style="display:none"></div>';

  // 研究队列（对齐官方 Research queue）
  if (G.techQueue && G.techQueue.length) {
    h += '<div class="sec">研究队列（' + G.techQueue.length + ' 项）</div><div class="chips">';
    G.techQueue.forEach((qid, i) => {
      h += '<span class="chip' + (i === 0 ? ' chip-active' : '') + '" title="' + (i === 0 ? '正在研究' : '排队中') + '：' + (TECHS[qid] ? TECHS[qid].name : qid) + '">' +
        (i === 0 ? '▶ ' : (i + 1) + '. ') + (TECHS[qid] ? TECHS[qid].name : qid) +
        (i === 0 ? ' <button class="chip-x" data-action="tech-cancel" data-id="' + qid + '">✕</button>' : '') + '</span>';
    });
    h += '</div>';
  }

  // 按模块分组遍历
  for (const catKey of ['base', 'quality', 'space-age']) {
    if (cur !== 'all' && cur !== catKey) continue;
    const cmeta = TECH_CAT[catKey];
    h += '<div class="tech-cat-head" data-techcathead="' + catKey + '">' + cmeta.icon + ' ' + cmeta.name + '</div>';
    for (const tid in TECHS) {
      const t = TECHS[tid];
      if (t.cat !== catKey) continue;
      const done = techResearched(tid);
      const locked = !done && techLocked(tid);
      const missing = techMissingPrereqs(tid);
      const prog = G.techProg[tid] || 0;
      const total = techCostTotal(tid);
      const costChips = [];
      for (const pk in t.cost) costChips.push(ITEMS[pk].name + '×' + t.cost[pk]);
      h += '<div class="recipe tech ' + (done ? 'done' : '') + (locked ? ' locked' : '') + (t.trigger ? ' trigger' : '') + '" data-techcat="' + catKey + '" data-techid="' + tid + '" data-techsearch="' + esc((t.name + ' ' + (t.desc || '') + ' ' + tid).toLowerCase()) + '">';
      h += '<div class="rmain"><div class="rname">' + t.name +
        (t.trigger ? ' <span class="trig-badge" title="触发式：' + t.triggerDesc + '">⚡ 触发式</span>' : '') +
        (locked ? ' <span class="lock-tag">🔒</span>' : '') +
        (isInfiniteTech(tid) ? ' <span class="inf-badge">∞</span>' : '') + '</div><div class="dim">' + t.desc + '</div>';
      if (t.trigger) {
        // 触发式科技：官方为操作自动解锁，当前版本仍需研究；展示触发条件提示
        h += '<div class="dim trig-desc">⚡ ' + t.triggerDesc + '</div>';
      } else if (isInfiniteTech(tid)) {
        h += '<div class="bar"><i style="width:100%"></i></div>';
        h += '<div class="dim">' + (done ? '已完成' : '无限研究 · 已消耗 ' + prog + ' 瓶 · 消耗任意科学包') + '</div>';
      } else {
        h += '<div class="bar"><i style="width:' + Math.min(100, prog / total * 100) + '%"></i></div>';
        h += '<div class="dim">' + (done ? '已完成' : prog + ' / ' + total + '（' + costChips.join(' + ') + '）') + '</div>';
      }
      h += '</div>';
      // 操作按钮
      // —— 调试科技控制开关（G.dbg.techControl）：任意完成 / 关闭 / 调整无限科技等级，遵循前置与依赖顺序 ——
      if (G.dbg.techControl) {
        if (isInfiniteTech(tid)) {
          const lvl = G.techProg[tid] || 0;
          h += '<span class="tech-lvl">' +
            '<span class="tech-lvl-stepper">' +
            '<button data-action="tech-level" data-id="' + tid + '" data-lvl="' + (lvl - 1) + '" title="降低等级">−</button>' +
            '<b>Lv ' + lvl + '</b>' +
            '<button data-action="tech-level" data-id="' + tid + '" data-lvl="' + (lvl + 1) + '" title="提升等级">＋</button>' +
            '</span>' +
            '<input type="range" class="tech-lvl-slide" data-action="tech-lvl-slide" data-id="' + tid +
            '" min="0" max="' + Math.max(25, lvl) + '" step="1" value="' + lvl + '" title="拖动滑块快速设置等级">' +
            '</span>';
        } else if (done) {
          const tdeps = debugTechDependents(tid);
          h += tdeps.length
            ? '<button data-action="tech-disable" data-id="' + tid + '" disabled title="需先按顺序关闭依赖它的科技：' + tdeps.map(d => TECHS[d].name).join('、') + '">关闭</button>'
            : '<button data-action="tech-disable" data-id="' + tid + '">关闭</button>';
        } else {
          h += locked
            ? '<button data-action="tech-complete" data-id="' + tid + '" disabled title="需先完成前置：' + missing.map(m => TECHS[m].name).join('、') + '">完成</button>'
            : '<button data-action="tech-complete" data-id="' + tid + '">完成</button>';
        }
      }
      if (!done && !isInfiniteTech(tid)) {
        if (locked) {
          h += '<button disabled title="需先研究：' + missing.map(m => TECHS[m].name).join('、') + '">🔒</button>';
        } else {
          const inQueue = !!(G.techQueue && G.techQueue.indexOf(tid) >= 0);
          h += (G.activeTech === tid)
            ? '<button data-action="tech-cancel" data-id="' + tid + '">取消</button>'
            : (inQueue ? '<button disabled>排队</button>' : '<button data-action="tech" data-id="' + tid + '">研究</button>');
        }
      } else if (isInfiniteTech(tid)) {
        const inQueue = !!(G.techQueue && G.techQueue.indexOf(tid) >= 0);
        h += (G.activeTech === tid)
          ? '<button data-action="tech-cancel" data-id="' + tid + '">停止</button>'
          : (inQueue ? '<button disabled>排队</button>' : '<button data-action="tech" data-id="' + tid + '">研究</button>');
      }
      h += '</div>';
    }
  }
  h += '<div class="hint">建造研究中心，放入科学包后选择课题研究；触发式科技⚡由玩家执行对应操作后自动解锁，无需研究。红色研究列表中的课题由「研究中心」研究，前置依赖见右测研究树。无限科技∞消耗任意科学包、永不完成。</div>';
  return h;
}

function htmlTech() {
  return '<div class="tech-layout">' +
    '<div class="tech-col tech-col-list" id="tech-col-list">' + htmlTechList() + '</div>' +
    '<div class="tech-col tech-col-tree" id="tech-col-tree">' +
      '<div class="sec">研究树</div>' +
      '<div class="tech-tree-wrap">' + htmlTechTree() + '</div>' +
    '</div>' +
  '</div>';
}

function countStr(o) {
  const parts = [];
  for (const k in o) parts.push(chip(k, o[k]));
  return parts.join('');
}


// ===== 统一插槽渲染（对齐组装机插槽样式与交互）=====
// 所有设备面板中的「物品槽」统一渲染为组装机风格：32px 图标 + 右下角数量角标。
// 支持三种交互动作：
//   take-slot   —— 点击取回 1 件（设备实现 takeItemOf/takeItem 时可用）
//   feed-slot   —— 原料槽：未持握/未选中时点击拿起整叠悬浮于鼠标（移到背包点击即取回）；
//                  持握物品或已选中背包原料时点击则放入设备（设备实现 giveItem 时可用）
//   chest-take  —— 储物箱专用：点击取出 1 件回背包
// 传参：
//   o       —— { itemId: count } 物品与数量（已装填内容，非可放入清单）
//   opts    —— { action: 交互动作, tip: 自定义提示前缀 }
function itemSlotsHtml(o, opts) {
  opts = opts || {};
  const parts = [];
  for (const k in o) {
    const n = o[k];
    if (!n) continue;
    const act = opts.action || 'take-slot';
    let tip = ITEMS[k].name + '|当前 ' + n + (act === 'take-slot' ? '，点击取回 1 件' : (act === 'feed-slot' ? '，点击拿起（移到背包点击即取回）' : ''));
    if (opts.tip) tip = opts.tip(k, n) || tip;
    const icon = iconDataURL(k);
    let inner = '<img src="' + icon + '">';
    // 数量角标（组装机风格：右下角角标）
    inner += '<span class="mch-io-n">' + n + '</span>';
    // display 模式：纯展示（流体等不可取回），不带交互动作
    const actAttr = act === 'display' ? '' : ' data-action="' + act + '" data-id="' + k + '"';
    parts.push('<div class="mch-io-slot' + (act === 'display' ? ' display' : '') + '"' + actAttr + ' data-tip="' + tip.replace(/"/g, '') + '">' + inner + '</div>');
  }
  return parts.join('');
}


// 机器面板：按设备类型查注册表分发，各设备的 html 定义在 js/devices/*.js
function htmlMachine(e) {
  const panel = DEVICE_PANEL[e.type];
  let h = (panel && panel.html) ? panel.html(e) : '<div class="dim">无信息</div>';
  // 电路节点设备：追加「接入通道」设置（对齐《异星工厂》红/绿线缆，实现红绿信号物理隔离）
  // 机器人港除外：港面板自带完整操作区与网络说明，不展示通道切换
  if (typeof isCircuitNodeEntity === 'function' && isCircuitNodeEntity(e) && e.type !== 'roboport') {
    const ch = e.wireChan || 'both';
    h += '<div class="sec">电路接入通道</div>' +
      '<div class="mrow"><span class="mlabel">接入</span><span class="mval">' +
      (ch === 'both' ? '红 + 绿（双通）' : ch === 'red' ? '仅红线' : '仅绿线') +
      '</span></div>' +
      '<div class="circ-wire-row">' +
        '<button data-wire="red" class="btn sm">接红线</button>' +
        '<button data-wire="green" class="btn sm">接绿线</button>' +
        '<button data-wire="both" class="btn sm">双通</button>' +
      '</div>' +
      '<div class="dim">' + (ch === 'both'
        ? '当前同时接入红/绿网络，可感知两通道全部信号。'
        : '当前仅接入' + (ch === 'red' ? '红线' : '绿线') + '网络，只感知该通道信号，与另一通道物理隔离。') +
      '（也可手持对应线缆点击设备快速切换）</div>';
  }
  return h;
}

function row(label, val, liveKey) {
  return '<div class="mrow"><span class="mlabel">' + label + '</span><span class="mval"' +
    (liveKey ? ' data-live="' + liveKey + '"' : '') + '>' + val + '</span></div>';
}

function barHtml(pct) {
  pct = Math.max(0, Math.min(100, pct || 0));
  return '<div class="bar"><i style="width:' + pct + '%"></i></div>';
}

// 是否为“需选择配方”的设备：具备 setRecipe 的配方设备
function isRecipeDevice(e) {
  return !!(e && typeof e.setRecipe === 'function');
}

// 通用判定：设备当前是否处于「产物堆积/缓冲满」导致的暂停状态（非 crafting 且原料充足时）。
// 优先使用设备自己的 outputBufferFull（离心机自循环配方按固定缓冲容量等定制规则），
// 否则回落到共享的 outputBacklogged（存量够再产 2 次即视为堆积）。
function machineBacklogPaused(e, rec) {
  if (!e || !rec || e.crafting) return false;
  if (typeof e.outputBufferFull === 'function') return !!e.outputBufferFull(rec);
  if (typeof outputBacklogged === 'function' && rec.out) return outputBacklogged(e.outp, rec.out);
  return false;
}

// 非配方设备中会驱动 api.prog 进度条的类型（这些设备外壳才显示进度条，其余不显示避免空进度条）
const GENERIC_PROGRESS_TYPES = {
  'boiler': 1, 'steam-engine': 1, 'offshore-pump': 1,
  'lab': 1, 'biolab': 1,
  // 熔炉（石炉/钢炉/电炉）与热能采矿机不再用外壳进度条：面板自带「进度条 + 槽位」流程行
  'nuclear-reactor': 1, 'captive-biter-spawner': 1
};

// 机械臂族（含热能机械臂）：面板已自带组装机风格的 asm3-status + 机器图标（ins-cv），
// 无需再套通用外壳，否则会重复显示状态区与机器图标。
function isAssemblerStyleDevice(e) {
  if (!e) return false;
  return e.type === 'inserter' || e.type === 'long-handed-inserter' || e.type === 'bulk-inserter' ||
    e.type === 'fast-inserter' || e.type === 'stack-inserter' || e.type === 'burner-inserter';
}

// 是否为储物箱（木箱/铁箱/钢箱等标准储物箱 + 物流箱 + 虚空箱）：
// 面板采用「左=玩家背包，右=箱子」双栏布局，可双向移动物品（虚空箱放入即销毁，格子恒空）。
function isChestEntity(e) {
  if (!e) return false;
  return e.type === 'wooden-chest' || e.type === 'iron-chest' || e.type === 'steel-chest' ||
    e.type === 'passive-provider-chest' || e.type === 'active-provider-chest' ||
    e.type === 'storage-chest' || e.type === 'requester-chest' || e.type === 'buffer-chest' ||
    e.type === 'void-chest';
}


// 是否为组装机（组装机 I/II/III）：面板统一采用设计稿风格（左=玩家背包，右=组装机面板）
function isAssemblerMachine(e) {
  return !!e && (e.type === 'assembling-machine-1' || e.type === 'assembling-machine-2' || e.type === 'assembling-machine-3');
}



// 返回配方设备可选的配方清单与配方读取函数
// returns { list: [recipeId], getRec(id)->recipe|null, name(id)->displayName }
function recipeDeviceInfo(e) {
  const type = e.type;
  if (type === 'oil-refinery') {
    return {
      list: REFINERY_RECIPE_IDS,
      getRec: id => REFINERY_RECIPES[id] || null,
      name: id => (REFINERY_RECIPES[id] ? localizedName(id, REFINERY_RECIPES[id].name) : id)
    };
  }
  if (type === 'chemical-plant') {
    return {
      list: CHEM_RECIPES,
      getRec: id => RECIPES[id] || null,
      name: id => (RECIPES[id] ? ITEMS[Object.keys(RECIPES[id].out)[0]].name : id)
    };
  }
  if (type === 'centrifuge') {
    const ids = Object.keys(CENTRIFUGE_RECIPES);
    if (ids.indexOf('kovarex') < 0) ids.push('kovarex');
    return {
      list: ids,
      getRec: id => (id === 'kovarex' ? RECIPES['kovarex'] : CENTRIFUGE_RECIPES[id] || null),
      name: id => (id === 'kovarex' ? '铀增殖处理' : (CENTRIFUGE_RECIPES[id] ? localizedName(id, CENTRIFUGE_RECIPES[id].name) : id))
    };
  }
  // 组装机（及默认）：普通可制造配方，排除各专属设备配方（化工/离心/电磁工厂/生化炉/破碎机/铸造厂/农业塔/空间平台中枢）
  return {
    list: Object.keys(RECIPES).filter(r => !isChemRecipe(r) && !isCentrifugeRecipe(r) &&
      !(typeof isElectroRecipe === 'function' && isElectroRecipe(r)) &&
      !(typeof isBiochamberRecipe === 'function' && isBiochamberRecipe(r)) &&
      !(typeof isCrusherRecipe === 'function' && isCrusherRecipe(r)) &&
      !(typeof isFoundryRecipe === 'function' && isFoundryRecipe(r)) &&
      !isAgricultureTowerRecipe(r) &&
      !(typeof isHubRecipe === 'function' && isHubRecipe(r))),
    getRec: id => RECIPES[id] || null,
    name: id => {
      const r = RECIPES[id];
      if (!r) return id;
      const outId = (r.out && Object.keys(r.out)[0]) || (r.prob && Object.keys(r.prob)[0]);
      return (outId && ITEMS[outId]) ? ITEMS[outId].name : id;
    }
  };
}

// 单个配方的展示主图标 id（含概率配方取概率项、常规配方取 out 首项）
function recipeMainIcon(rec, info, rid) {
  if (rec && rec.prob) {
    const keys = Object.keys(rec.prob);
    return keys[0];
  }
  if (rec && rec.out) {
    const keys = Object.keys(rec.out);
    return keys[0];
  }
  const r = info.getRec(rid);
  if (r && r.out) return Object.keys(r.out)[0];
  if (r && r.prob) return Object.keys(r.prob)[0];
  return null;
}

// 配方选择面板：5 个 Tab 分类（参考背包「制作」面板）+ 右下角确认按钮
function recipeSelectPanelHtml(e) {
  const info = recipeDeviceInfo(e);
  let activeTab = G.rcpTab && CRAFT_TABS.indexOf(G.rcpTab) >= 0 ? G.rcpTab : 'logistics';
  const perTab = { logistics: [], production: [], 'intermediate-products': [], space: [], combat: [] };
  for (const rid of info.list) {
    const r = info.getRec(rid);
    if (!r) continue;
    const outId = recipeMainIcon(r, info, rid);
    if (!outId) continue;
    const tab = (GAME_DATA.itemGroup && GAME_DATA.itemGroup[outId]) || 'logistics';
    perTab[tab] = perTab[tab] || [];
    perTab[tab].push({ rid, r, outId });
  }
  // 激活分类没有任何配方时回退到第一个非空分类（空分类 Tab 不显示）
  if (!(perTab[activeTab] && perTab[activeTab].length)) {
    activeTab = CRAFT_TABS.find(t => perTab[t] && perTab[t].length) || 'logistics';
    G.rcpTab = activeTab;
  }
  let h = '<div class="rcp-scroll">';
  h += '<div class="sec">点击选择配方（勾选后点右下角「确认」设置）</div>';
  h += '<input id="rcp-search" class="inv-search" type="text" placeholder="搜索配方（输入物品名称）" autocomplete="off" value="' + (G.rcpQ || '') + '">';
  // 5 个 Tab 栏
  h += '<div class="craft-tabs" id="rcp-tabs">';
  for (const tab of CRAFT_TABS) {
    const n = (perTab[tab] || []).length;
    if (!n) continue; // 该分类没有任何配方的 Tab 不显示
    const on = tab === activeTab ? ' active' : '';
    const label = CRAFT_TAB_LABEL[tab];
    h += '<button type="button" class="craft-tab' + on + '" data-tab="' + tab + '">' +
      '<span class="tab-icon">' + label.icon + '</span>' +
      '<span class="tab-label">' + label.text + '</span>' +
      '<span class="cnt">' + n + '</span></button>';
  }
  h += '</div>';
  // 每个 Tab 一个配方网格；Tab 内按官方二级分组（item-subgroup）分组渲染，
  // 分组顺序按官方 subgroupOrder、组内物品按官方 itemOrder（与背包制作栏一致）。
  for (const tab of CRAFT_TABS) {
    const items = perTab[tab] || [];
    const on = tab === activeTab ? '' : ' style="display:none"';
    const groups = new Map();
    for (const it of items) {
      const sg = (GAME_DATA.itemSubgroup && GAME_DATA.itemSubgroup[it.outId]) || '';
      if (!groups.has(sg)) groups.set(sg, []);
      groups.get(sg).push(it);
    }
    const sgList = Array.from(groups.keys()).sort(officialSubgroupCompare);
    h += '<div id="rcp-grid-' + tab + '" data-tab="' + tab + '"' + on + '>';
    for (const sg of sgList) {
      const list = groups.get(sg).slice().sort((x, y) => officialItemCompare(x.outId, y.outId));
      h += '<div class="craft-subgroup inv-slots">' + recipeSelectGridHtmlForTab(e, info, list, '') + '</div>';
    }
    h += '</div>';
  }
  h += '<div class="dim" id="rcp-empty" style="display:none"></div>';
  h += '</div>';
  // 确认行
  h += '<div class="rcp-confirm-row">';
  h += '<button data-action="recipe-clear">清除配方</button>';
  h += '<button data-action="recipe-confirm" class="rcp-confirm" data-id="' + (G.recipeSel || '') + '"' + (G.recipeSel ? '' : ' disabled') + '>确认设置 ✓</button>';
  h += '</div>';
  h += '<div class="dim">提示：未设置配方时无法生产。确认后进入设备交互面板，可放入原料、取走产物，也可随时清除并重新选择配方。</div>';
  return h;
}

// 配方选择网格（单个 Tab 的配方槽），供配方选择面板与搜索过滤共用
function recipeSelectGridHtmlForTab(e, info, items, q) {
  q = (q || '').toLowerCase();
  let h = '';
  for (const { rid, r, outId } of items) {
    if (!r) continue;
    const name = info.name(rid);
    const unlocked = recipeUnlocked(rid);
    const lockTech = recipeLockingTech(rid);
    const selCls = (G.recipeSel === rid) ? 'sel' : '';
    // 原料/产出 tooltip
    let inpStr = '';
    if (r.inp) inpStr = Object.keys(r.inp).map(k => ITEMS[k].name + '×' + r.inp[k]).join('、');
    let outStr = '';
    if (r.out) outStr = Object.keys(r.out).map(k => ITEMS[k].name + '×' + r.out[k]).join('、');
    else if (r.prob) outStr = Object.keys(r.prob).map(k => ITEMS[k].name + '（' + Math.round(r.prob[k] * 10000) / 100 + '%）').join('、');
    const searchKey = Object.keys(r.out || r.prob || {}).map(k => (ITEMS[k] ? ITEMS[k].name : k)).join(' ').toLowerCase();
    if (q && searchKey.indexOf(q) < 0) continue;
    const tipMain = name + '|每周期耗时 ' + r.time + ' 秒' + (unlocked ? '' : '。未解锁：需先研究「' + (lockTech ? TECHS[lockTech].name : '对应科技') + '」');
    const tipRecipe = (inpStr ? '所需原料：' + inpStr : '') + (outStr ? '（产出：' + outStr + '）' : '');
    h += '<div class="inv-slot rcp-slot' + selCls + (unlocked ? '' : ' locked') + '" data-action="pickrecipe" data-id="' + rid + '" data-itemid="' + (outId || '') + '"' +
      ' data-tip="' + tipMain + '||' + tipRecipe + '"' + (unlocked ? '' : ' data-locked="1"') + ' data-rsearch="' + searchKey.replace(/"/g, '') + '">' +
      (outId ? '<img src="' + iconDataURL(outId, 16) + '">' : '') +
      (unlocked ? '' : '<span class="craft-lock" title="需先研究：' + (lockTech ? TECHS[lockTech].name : '对应科技') + '">🔒</span>') +
      '</div>';
  }
  return h;
}

// —— 配方卡悬浮信息（组装机选配方时，悬停配方槽在鼠标旁显示参考式配方卡）——
// 与普通「名称|描述」tooltip 不同，配方槽悬停单独展示一张信息更完整的配方卡
//（标题/分类/原料/制造时间/产品/制造于/物品属性），样式参考《异星工厂》配方卡。
function recipeCardHtml(rid) {
  // 兼容炼油厂/离心机等手工配方表（REFINERY_RECIPES / CENTRIFUGE_RECIPES，含 kovarex 在 RECIPES 内）
  const r = RECIPES[rid] || REFINERY_RECIPES[rid] || CENTRIFUGE_RECIPES[rid];
  if (!r) return '';
  const outId = (r.out ? Object.keys(r.out)[0] : null) || (r.prob ? Object.keys(r.prob)[0] : null);
  // 配方卡标题：官方配方名优先（炼油/离心等专用配方有官方 recipeNames，如「基础原油处理」），
  // 其次手工配方表自带 name，最后回退产物名（组装机等普通配方惯例）。
  const rName = (GAME_DATA.recipeNames && GAME_DATA.recipeNames[rid]) ? localizedName(rid, '') : (r.name ? localizedName(rid, r.name) : '');
  const name = rName || ((outId && ITEMS[outId]) ? ITEMS[outId].name : rid);
  const cat = outId ? (GAME_DATA.itemGroup && GAME_DATA.itemGroup[outId]) : null;
  const catLabel = (cat && CRAFT_TAB_LABEL[cat]) ? CRAFT_TAB_LABEL[cat].text : '基础';
  const icn = k => (ITEMS[k] ? '<img class="rcp-card-img" src="' + iconDataURL(k, 28) + '" alt="">' : '');
  // 原料行
  let inp = '';
  if (r.inp) for (const k in r.inp)
    inp += '<div class="rcp-card-row">' + icn(k) +
      '<span class="rcp-card-cnt">' + r.inp[k] + ' ×</span>' +
      '<span class="rcp-card-name">' + (ITEMS[k] ? ITEMS[k].name : k) + '</span></div>';
  // 产品行
  let out = '';
  if (r.out) for (const k in r.out)
    out += '<div class="rcp-card-row">' + icn(k) +
      '<span class="rcp-card-cnt">' + r.out[k] + ' ×</span>' +
      '<span class="rcp-card-name">' + (ITEMS[k] ? ITEMS[k].name : k) + '</span></div>';
  else if (r.prob) for (const k in r.prob)
    out += '<div class="rcp-card-row">' + icn(k) +
      '<span class="rcp-card-cnt">' + (Math.round(r.prob[k] * 1000) / 10) + '%</span>' +
      '<span class="rcp-card-name">' + (ITEMS[k] ? ITEMS[k].name : k) + '</span></div>';
  // 制造于（由配方生产设备推导；可手搓时追加「工程师」）
  let bld = '';
  for (const b of recipeBuildings(rid))
    bld += '<div class="rcp-card-row">' + recipeBuildingIcon(b) +
      '<span class="rcp-card-name">' + recipeBuildingName(b) + '</span></div>';
  // 物品属性（产物堆叠上限）
  const stack = outId ? (typeof stackSize === 'function' ? stackSize(outId) : null) : null;
  let stat = '';
  if (stack) stat += '<div class="rcp-card-stat"><span class="rcp-card-statL">堆叠:</span><span class="rcp-card-statV"> ' + stack + '</span></div>';
  let h = '<div class="rcp-card">';
  h += '<div class="rcp-card-title">' + name + ' (配方)</div>';
  h += '<div class="rcp-card-cat">官方基础包 › ' + catLabel + '</div>';
  if (inp) { h += '<div class="rcp-card-sub">原料：</div>' + inp; }
  h += '<div class="rcp-card-divider"></div>';
  h += '<div class="rcp-card-time">' + r.time + ' s 制造时间</div>';
  if (out) { h += '<div class="rcp-card-sub">产品：</div>' + out; }
  if (bld) { h += '<div class="rcp-card-sub">制造于：</div>' + bld; }
  h += '<div class="rcp-card-title">' + name + '</div>';
  h += '<div class="rcp-card-cat">官方基础包 › ' + catLabel + '</div>';
  h += stat;
  h += '</div>';
  return h;
}

// —— 设备面板「当前配方」行的展示值：图标 + 名称，悬停弹出配方卡悬浮框 ——
// 与配方选择面板悬停配方槽（.rcp-slot）的「配方卡」效果一致（见 ui-hud.js 的 mousemove
// 全局委托：只要元素带 data-rec-id 且能取到配方卡 HTML，就会在鼠标旁展示配方卡）。
// rid: 配方 id；nameFallback: 可选的手工名称（炼油厂/离心机等手工配方表用）。
function recipeValueHtml(rid, nameFallback) {
  if (!rid || !(RECIPES[rid] || REFINERY_RECIPES[rid] || CENTRIFUGE_RECIPES[rid])) return '<span class="dim">未设置</span>';
  const r = RECIPES[rid] || REFINERY_RECIPES[rid] || CENTRIFUGE_RECIPES[rid];
  const outId = (r.out ? Object.keys(r.out)[0] : null) || (r.prob ? Object.keys(r.prob)[0] : null);
  // 配方名：官方配方名 > 手工表 name > 产物名（与配方卡标题一致，修复炼油/离心悬停名称错误）
  const rName = (GAME_DATA.recipeNames && GAME_DATA.recipeNames[rid]) ? localizedName(rid, '') : (r.name ? localizedName(rid, r.name) : '');
  const name = nameFallback || rName || ((outId && ITEMS[outId]) ? ITEMS[outId].name : rid);
  const icon = outId ? '<img class="rec-val-icon" src="' + iconDataURL(outId, 16) + '" alt="">' : '';
  return '<span class="rec-val" data-rec-id="' + rid + '" data-itemid="' + (outId || '') + '">' +
    icon + '<span class="rec-val-name">' + name + '</span>' +
    '<span class="rec-val-hint">ℹ</span></span>';
}

// 配方可由哪些建筑制造（由配方生产设备推导；组装类配方默认组装机 I/II/III）
function recipeBuildings(rid) {
  const dev = GAME_DATA.recipeDevice && GAME_DATA.recipeDevice[rid];
  let ids = [];
  if (dev && dev.indexOf('assembling-machine') === 0) ids = ['assembling-machine-1', 'assembling-machine-2', 'assembling-machine-3'];
  else if (dev && ITEMS[dev]) ids = [dev];
  else ids = ['assembling-machine-1', 'assembling-machine-2', 'assembling-machine-3'];
  if (isHandcraftable(rid)) ids.push('engineer');
  return ids;
}

function recipeBuildingIcon(b) {
  if (b === 'engineer') {
    return '<svg class="rcp-card-bico" viewBox="0 0 56 72">' +
      '<ellipse cx="28" cy="16" rx="14" ry="12" fill="#ffaa00" stroke="#cc8800" stroke-width="2"/>' +
      '<rect x="18" y="18" width="20" height="8" fill="#333"/>' +
      '<rect x="16" y="28" width="24" height="24" fill="#ff8800" stroke="#cc6600" stroke-width="2"/>' +
      '<rect x="16" y="44" width="24" height="4" fill="#666"/>' +
      '<rect x="18" y="52" width="8" height="16" fill="#555"/>' +
      '<rect x="30" y="52" width="8" height="16" fill="#555"/></svg>';
  }
  return (ITEMS[b] ? '<img class="rcp-card-img" src="' + iconDataURL(b, 28) + '" alt="">' : '');
}

function recipeBuildingName(b) {
  if (b === 'engineer') return '工程师';
  // 与物品行一致，直接取本地化名称，避免 [object object]
  return (ITEMS[b] && ITEMS[b].name) ? ITEMS[b].name : b;
}

// 配方能否手搓（与背包「制作」页同一套过滤口径）
function isHandcraftable(rid) {
  const r = RECIPES[rid];
  if (!r || !r.out) return false;
  if (Object.keys(r.inp).some(k => FLUIDS.indexOf(k) >= 0)) return false;
  if (Object.keys(r.out).some(k => FLUIDS.indexOf(k) >= 0)) return false;
  if (typeof isBiochamberRecipe === 'function' && isBiochamberRecipe(rid)) return false;
  if (typeof isCrusherRecipe === 'function' && isCrusherRecipe(rid)) return false;
  if (typeof isFoundryRecipe === 'function' && isFoundryRecipe(rid)) return false;
  if (typeof isChemistryRecipe === 'function' && isChemistryRecipe(rid)) return false;
  if (typeof isRefineryRecipe === 'function' && isRefineryRecipe(rid)) return false;
  if (typeof isCentrifugeRecipe === 'function' && isCentrifugeRecipe(rid)) return false;
  if (typeof isAgricultureTowerRecipe === 'function' && isAgricultureTowerRecipe(rid)) return false;
  if (typeof isHubRecipe === 'function' && isHubRecipe(rid)) return false;
  return true;
}

// 配方选择 Tab 切换：显示/隐藏对应配方网格
function switchRcpTab(tab) {
  const body = document.getElementById('panel-body');
  if (!body) return;
  if (CRAFT_TABS.indexOf(tab) < 0) tab = 'logistics';
  G.rcpTab = tab;
  const tabs = body.querySelectorAll('#rcp-tabs .craft-tab');
  for (const t of tabs) t.classList.toggle('active', t.dataset.tab === tab);
  for (const t of CRAFT_TABS) {
    const grid = body.querySelector('#rcp-grid-' + t);
    if (grid) grid.style.display = (t === tab) ? '' : 'none';
  }
  applyRcpFilter(G.rcpQ || '');
}

// 配方选择面板搜索过滤：仅过滤当前 Tab 的配方槽
function applyRcpFilter(q) {
  const body = document.getElementById('panel-body');
  if (!body) return;
  const ql = (q || '').trim().toLowerCase();
  const activeTab = G.rcpTab && CRAFT_TABS.indexOf(G.rcpTab) >= 0 ? G.rcpTab : 'logistics';
  // 过滤所有 Tab 的配方槽（搜索词命中 rsearch 关键字），并隐藏无可见槽的二级分组
  for (const t of CRAFT_TABS) {
    const grid = body.querySelector('#rcp-grid-' + t);
    if (!grid) continue;
    grid.querySelectorAll('.rcp-slot').forEach(el => {
      const hit = !ql || (el.dataset.rsearch || '').includes(ql);
      el.style.display = hit ? '' : 'none';
    });
    // 搜索时隐藏没有任何可见槽位的二级分组（空分组留白不显示）
    grid.querySelectorAll('.craft-subgroup').forEach(g => {
      g.style.display = g.querySelectorAll('.rcp-slot').length &&
        (!ql || Array.from(g.querySelectorAll('.rcp-slot')).some(el => el.style.display !== 'none')) ? '' : 'none';
    });
  }
  // 搜索时同步更新 Tab 角标为「当前搜索命中的数量」，并隐藏命中为 0 的 Tab；
  // 当前激活 Tab 命中 0 时自动切换到第一个仍有结果的 Tab
  const newRcpTab = updateCraftTabCounts(body, '#rcp-tabs .craft-tab',
    tab => body.querySelector('#rcp-grid-' + tab), '.rcp-slot', ql, activeTab);
  if (newRcpTab !== activeTab) G.rcpTab = newRcpTab;
  // 空态统计以（可能已切换的）当前激活 Tab 为准
  const activeGrid = body.querySelector('#rcp-grid-' + newRcpTab);
  const shown = activeGrid ? Array.from(activeGrid.querySelectorAll('.rcp-slot')).filter(el => el.style.display !== 'none').length : 0;
  // 空状态提示：当前 Tab 无匹配配方时显示
  const emp = body.querySelector('#rcp-empty');
  if (emp) {
    emp.textContent = ql ? '没有匹配「' + q.trim() + '」的配方' : '没有匹配的配方';
    emp.style.display = shown ? 'none' : '';
  }
}

// 配方设备交互面板：左=背包，右=设备交互信息
function recipeMachineLayoutHtml(e) {
  const info = recipeDeviceInfo(e);
  const rec = e.recipe ? info.getRec(e.recipe) : null;
  const left = htmlInventory();
  const right = recipeMachineRightHtml(e, info, rec);
  return '<div class="inv-layout machine-layout">' +
    '<div class="inv-col inv-col-left" id="inv-col-left"><div class="inv-col-head">🎒 玩家</div>' +
    '<div class="inv-col-body" id="inv-mat">' + left + '</div></div>' +
    '<div class="inv-col inv-col-right" id="inv-col-right"><div class="inv-col-head">⚙ ' + ITEMS[e.type].name + ' 交互</div>' +
    '<div class="inv-col-body">' + right + '</div></div>' +
  '</div>';
}

// ===== 组装机 I/II/III：设计稿风格面板（左=玩家背包，右=组装机面板：状态/机器显示/配方/进度/模块）=====
function assemblerLayoutHtml(e) {
  const info = recipeDeviceInfo(e);
  const rec = e.recipe ? info.getRec(e.recipe) : null;
  const left = htmlInventory();
  let h = '<div class="asm3-layout">';
  // 左栏：玩家背包（格子化网格）
  h += '<div class="asm3-col asm3-left"><div class="asm3-col-head">玩家</div>' +
       '<div class="asm3-col-body">' + left + '</div></div>';
  // 右栏：组装机面板
  h += '<div class="asm3-panel">';
  // 状态提示：状态点 + 状态文字（.status 供通用 live 更新文本）
  h += '<div class="asm3-status"><div class="asm3-status-dot" data-live="asm3-dot"></div>' +
       '<div class="asm3-status-text status" data-live="asm3-status"></div></div>';
  // 机器显示区：与地图渲染一致，直接绘制同款组装机
  h += '<div class="asm3-machine"><div class="asm3-machine-icon">' +
       '<canvas class="asm3-machine-canvas" width="96" height="96"></canvas></div></div>';
  // 配方显示区
  h += '<div class="asm3-recipe">';
  let ric = '';
  if (rec) {
    const outId = recipeMainIcon(rec, info, e.recipe);
    if (outId) ric = '<img src="' + iconDataURL(outId) + '">';
  }
  // 悬停配方图标/名称弹出配方卡：容器带 data-rec-id，由 ui-hud.js 的 mousemove 全局委托命中
  h += '<div class="asm3-recipe-head"><div class="asm3-recipe-item"' +
       (rec ? ' data-rec-id="' + e.recipe + '" data-itemid="' + (recipeMainIcon(rec, info, e.recipe) || '') + '"' : '') + '>' +
       '<div class="asm3-recipe-icon" data-live="asm3-ricon">' + ric + '</div>' +
       '<span class="asm3-recipe-name" data-live="asm3-rname">' + (rec ? info.name(e.recipe) : '未设置配方') + '</span>' +
       '</div><button class="asm3-config-btn" data-action="recipe-clear" title="清除配方并重新选择">⚙</button></div>';
  // 进度条行（原料 → 进度条 → 产品）
  h += '<div class="asm3-flow">';
  h += '<div class="asm3-side asm3-inp"><div class="asm3-inp-row" data-live="mch-inp"></div></div>';
  h += '<div class="asm3-prog"><div class="bar"><i></i><span class="bar-txt" data-live="asm3-pct">0%</span></div></div>';
  h += '<div class="asm3-side asm3-out"><div class="asm3-out-row" data-live="mch-out"></div></div>';
  h += '</div>';
  // 模块槽位（组装机面板不显示“模块插槽（N 个）”标题文字，故传 noHeader）
  h += moduleSlotSectionHtml(e, true);
  h += '</div>'; // recipe
  h += '</div>'; // panel
  h += '</div>'; // layout
  return h;
}

// ===== 统一设备面板布局：所有设备与组装机一致（左=玩家背包，右=设备操作面板）=====
function unifiedMachineLayoutHtml(e) {
  // 组装机保持原有设计稿风格面板
  if (isAssemblerMachine(e)) return assemblerLayoutHtml(e);
  // 火箭发射井：三栏布局（左=背包，中=火箭装配，右=运载/物流），面板自带完整布局，不再套用外壳
  if (e.type === 'rocket-silo') {
    const panel = DEVICE_PANEL[e.type];
    return (panel && panel.html) ? panel.html(e) : '<div class="dim">无信息</div>';
  }
  const left = htmlInventory();
  let right = '';
  if (isRecipeDevice(e)) {
    const info = recipeDeviceInfo(e);
    const rec = e.recipe ? info.getRec(e.recipe) : null;
    right = recipeMachineRightHtml(e, info, rec);
  } else if (isChestEntity(e) || e.voidsItems) {
    // 储物箱（含物流箱/虚空箱）与虚空带等「放入即销毁」容器：
    // 直接使用设备自身的面板（自带左背包+右格子双栏布局）
    const panel = DEVICE_PANEL[e.type];
    right = (panel && panel.html) ? panel.html(e) : '<div class="dim">无信息</div>';
    return right;
  } else if (isAssemblerStyleDevice(e)) {
    // 机械臂族（已与组装机一致的 asm3 风格面板）：直接使用设备自身面板，不再套外壳
    const panel = DEVICE_PANEL[e.type];
    right = (panel && panel.html) ? panel.html(e) : '<div class="dim">无信息</div>';
  } else {
    // 非配方设备（锅炉/蒸汽机/泵/管道/炮塔/信号塔/储液罐等）：
    // 一律套用组装机风格外壳（状态点 + 机器图标 + 进度条 + 操作区），保证交互风格与组装机一致。
    const panel = DEVICE_PANEL[e.type];
    let inner = (panel && panel.html) ? panel.html(e) : '<div class="dim">无信息</div>';
    // 电路节点设备：追加「接入通道」设置（机器人港除外：港面板自带完整操作区，不展示通道切换）
    if (typeof isCircuitNodeEntity === 'function' && isCircuitNodeEntity(e) && e.type !== 'roboport') {
      const ch = e.wireChan || 'both';
      inner += '<div class="sec">电路接入通道</div>' +
        '<div class="mrow"><span class="mlabel">接入</span><span class="mval">' +
        (ch === 'both' ? '红 + 绿（双通）' : ch === 'red' ? '仅红线' : '仅绿线') +
        '</span></div>' +
        '<div class="circ-wire-row">' +
          '<button data-wire="red" class="btn sm">接红线</button>' +
          '<button data-wire="green" class="btn sm">接绿线</button>' +
          '<button data-wire="both" class="btn sm">双通</button>' +
        '</div>' +
        '<div class="dim">' + (ch === 'both'
          ? '当前同时接入红/绿网络，可感知两通道全部信号。'
          : '当前仅接入' + (ch === 'red' ? '红线' : '绿线') + '网络，只感知该通道信号，与另一通道物理隔离。') +
        '（也可手持对应线缆点击设备快速切换）</div>';
    }
    right = asmMachineShellHtml(e, inner, { progress: !!GENERIC_PROGRESS_TYPES[e.type] });
  }
  return '<div class="asm3-layout">' +
    '<div class="asm3-col asm3-left"><div class="asm3-col-head">玩家</div>' +
    '<div class="asm3-col-body">' + left + '</div></div>' +
    '<div class="asm3-panel">' + right + '</div>' +
  '</div>';
}

// 组装机 I/II/III 实时刷新：复用配方设备的原料/产品/进度逻辑，并额外刷新配方名/图标/百分比/状态点
function updateAssemblerLive(e, body, api) {
  const info = recipeDeviceInfo(e);
  const rec = e.recipe ? info.getRec(e.recipe) : null;
  // 机器显示区：复用世界里的组装机绘制，保持与地图渲染一致
  const mcv = body.querySelector('.asm3-machine-icon canvas');
  if (mcv) drawAssemblerIcon(e, mcv);
  // 配方名称与图标
  const nameEl = body.querySelector('[data-live="asm3-rname"]');
  const iconEl = body.querySelector('[data-live="asm3-ricon"]');
  if (rec) {
    const outId = recipeMainIcon(rec, info, e.recipe);
    if (nameEl && nameEl.textContent !== info.name(e.recipe)) nameEl.textContent = info.name(e.recipe);
    if (iconEl) iconEl.innerHTML = outId ? '<img src="' + iconDataURL(outId) + '">' : '';
  } else {
    if (nameEl && nameEl.textContent !== '未设置配方') nameEl.textContent = '未设置配方';
    if (iconEl) iconEl.innerHTML = '';
  }
  // 同步配方头部的 data-rec-id（悬停配方卡委托用）：配方切换/清除后属性需跟着变
  const asmHead = body.querySelector('.asm3-recipe-item');
  if (asmHead) {
    if (rec) {
      const outId = recipeMainIcon(rec, info, e.recipe);
      if (asmHead.dataset.recId !== e.recipe) asmHead.dataset.recId = e.recipe;
      const wantItem = outId || '';
      if (asmHead.dataset.itemid !== wantItem) asmHead.dataset.itemid = wantItem;
    } else {
      if (asmHead.dataset.recId) delete asmHead.dataset.recId;
      if (asmHead.dataset.itemid) delete asmHead.dataset.itemid;
    }
  }
  // 原料/产品/进度/状态：复用通用配方设备逻辑
  updateRecipeMachineLive(e, body, api);
  // 百分比与倒计时（显示在进度条内部；倒计时仅显示剩余秒数）
  const pctEl = body.querySelector('[data-live="asm3-pct"]');
  if (pctEl) {
    const pct = (rec && e.crafting) ? (e.prog / rec.time * 100) : 0;
    let txt = Math.floor(pct) + '%';
    if (rec && e.crafting) txt += '  ' + Math.max(0, rec.time - e.prog).toFixed(1) + 's';
    if (pctEl.textContent !== txt) pctEl.textContent = txt;
  }
  // 状态点配色：与 updateRecipeMachineLive 一致的状态判断，设置红/黄/绿
  const dotEl = body.querySelector('[data-live="asm3-dot"]');
  let dotCls = 'warn';
  if (rec && e.crafting) dotCls = 'on';
  else {
    const needsPower = typeof e.powerDemand === 'function' && e.powerDemand() > 0;
    if (rec && needsPower && powerSatOf(this) <= 0) dotCls = 'bad';
    else if (rec) {
      let miss = null;
      for (const k in rec.inp) if ((e.inp[k] || 0) < rec.inp[k]) { miss = k; break; }
      dotCls = miss ? 'bad' : 'on';
    }
  }
  if (dotEl && dotEl.className !== ('asm3-status-dot ' + dotCls)) dotEl.className = 'asm3-status-dot ' + dotCls;
}

// 把面板里的组装机画成与地图完全一致的样式：复用世界里的 drawAssembler
function drawAssemblerIcon(e, cv) {
  const ctx = cv.getContext('2d');
  const w = e.w || 3, h = e.h || 3;
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.save();
  const scale = Math.min(cv.width / (w * TILE), cv.height / (h * TILE));
  ctx.scale(scale, scale);
  drawAssembler(ctx, e, 0, 0, e.dir || 0, 1);
  ctx.restore();
}

// 通用设备图标：把任意设备按地图渲染样式画进面板的 96×96 canvas（按设备占地缩放，保持比例一致）
function drawDeviceIcon(e, cv) {
  if (!cv || !e) return;
  const ctx = cv.getContext('2d');
  const w = e.w || 1, h = e.h || 1;
  ctx.clearRect(0, 0, cv.width, cv.height);
  const fn = DEVICE_RENDER[e.type];
  if (typeof fn !== 'function') return;
  ctx.save();
  // 等比例缩放使设备完整显示在 canvas 内（保留小边距）
  const pad = 6;
  const scale = Math.min((cv.width - pad * 2) / (w * TILE), (cv.height - pad * 2) / (h * TILE));
  const ox = (cv.width - w * TILE * scale) / 2;
  const oy = (cv.height - h * TILE * scale) / 2;
  ctx.translate(ox, oy);
  ctx.scale(scale, scale);
  const queueStart = (typeof BELT_ITEM_QUEUE !== 'undefined') ? BELT_ITEM_QUEUE.length : 0;
  try { fn(ctx, e, 0, 0, e.dir || 0, 1); } catch (err) { /* 设备绘制异常不影响面板 */ }
  // 传送带/地下带等在绘制时会把自己的带上物品推入全局 BELT_ITEM_QUEUE（供地图二次绘制）。
  // 面板图标需直接在画布上补画这些物品（与地图渲染一致显示带上的当前物品），
  // 并把它们从全局队列移除，避免残留污染下一次地图渲染。
  if (typeof BELT_ITEM_QUEUE !== 'undefined' && BELT_ITEM_QUEUE.length > queueStart) {
    for (let i = queueStart; i < BELT_ITEM_QUEUE.length; i++) {
      const it = BELT_ITEM_QUEUE[i];
      ctx.save();
      if (it.corner) drawBeltCorner(ctx, it.e, it.gx, it.gy, it.dir, it.alpha, beltColors(it.e), true);
      else drawBeltItems(ctx, it.e, it.gx, it.gy, it.dir, it.alpha, it.sideArc || null);
      ctx.restore();
    }
    BELT_ITEM_QUEUE.length = queueStart;
  }
  ctx.restore();
}

// ===== 通用组装机风格外壳（非配方设备也用与组装机一致的布局：状态点+机器图标+进度条+操作区）=====
// 复用 asm3-status / asm3-machine / asm3-prog 等既有样式，使所有设备面板交互风格统一。
function asmMachineShellHtml(e, innerHtml, opts) {
  opts = opts || {};
  // 顶部状态区（状态点 + 状态文字，由 updateMachineLive 统一驱动）
  let h = '<div class="asm3-status">' +
    '<div class="asm3-status-dot" data-live="mch-dot"></div>' +
    '<div class="asm3-status-text status" data-live="mch-status"></div></div>';
  // 机器显示区：与地图渲染一致，直接绘制同款设备
  h += '<div class="asm3-machine"><div class="asm3-machine-icon">' +
       '<canvas class="asm3-machine-canvas" width="96" height="96"></canvas></div></div>';
  // 进度条（组装机风格：内部显示百分比 + 剩余时间），仅当 opts.progress !== false 时显示
  if (opts.progress !== false) {
    h += '<div class="asm3-prog"><div class="bar"><i></i><span class="bar-txt" data-live="mch-pct">0%</span></div></div>';
  }
  // 操作内容
  h += innerHtml;
  return h;
}

// 通用设备面板实时刷新：非配方设备也复用组装机风格的机器图标绘制 + 百分比/状态点
function updateGenericDeviceLive(e, body, api) {
  const cv = body.querySelector('.asm3-machine-icon canvas');
  if (cv) drawDeviceIcon(e, cv);
  const panel = DEVICE_PANEL[e.type];
  if (panel && panel.live) panel.live(e, api, body);
}

// 右侧设备交互信息：配方名 + 原料/进度/产品单行图标 + 清除配方按钮 + 模块插槽 + 操作说明
function recipeMachineRightHtml(e, info, rec) {
  let h = '';
  // 顶部状态区（组装机风格：状态点 + 状态文字，实时刷新）
  h += '<div class="asm3-status">' +
    '<div class="asm3-status-dot" data-live="mch-dot"></div>' +
    '<div class="asm3-status-text status" data-live="mch-status"></div></div>';
  // 配方显示区（完全对齐组装机：.asm3-recipe 容器包含配方名 + 进度条行 + 模块插槽）
  h += '<div class="asm3-recipe">';
  // 第一行：配方图标 + 配方名称 + 清除按钮（组装机 asm3-recipe-head 样式）
  let ric = '';
  if (rec) {
    const mchOutId = recipeMainIcon(rec, info, e.recipe);
    if (mchOutId) ric = '<img src="' + iconDataURL(mchOutId) + '">';
  }
  // 悬停配方图标/名称弹出配方卡：容器带 data-rec-id，由 ui-hud.js 的 mousemove 全局委托命中
  h += '<div class="asm3-recipe-head"><div class="asm3-recipe-item"' +
    (rec ? ' data-rec-id="' + e.recipe + '" data-itemid="' + (recipeMainIcon(rec, info, e.recipe) || '') + '"' : '') + '>' +
    '<div class="asm3-recipe-icon" data-live="mch-ricon">' + ric + '</div>' +
    '<span class="asm3-recipe-name" data-live="mch-rname">' + (rec ? info.name(e.recipe) : '未设置配方') + '</span>' +
    '</div><button class="asm3-config-btn" data-action="recipe-clear" title="清除配方并重新选择">⚙</button></div>';
  if (!rec) {
    // 未设置配方时也显示模块插槽，便于提前装好模块
    h += moduleSlotSectionHtml(e, true);
    h += '</div>'; // asm3-recipe
    return h;
  }
  // 第二行：原料 + 进度条 + 产品（组装机 asm3-flow 样式）
  h += '<div class="asm3-flow">';
  // 原料区
  h += '<div class="asm3-side asm3-inp"><div class="asm3-inp-row" data-live="mch-inp">';
  for (const k in rec.inp) {
    const cur = e.inp[k] || 0;
    const isFluid = FLUIDS.indexOf(k) >= 0;
    // 流体原料槽不可点击（只读）：流体只能通过管道自动吸入
    const tip = isFluid
      ? ITEMS[k].name + '|流体：经相邻管道自动吸入，配方需 ' + rec.inp[k] + '，当前 ' + cur
      : ITEMS[k].name + '|配方需 ' + rec.inp[k] + '，当前 ' + cur + '。点击拿起（移到背包点击即取回），右键取回 1 件；先选中左侧背包物品再点击此槽放入';
    h += '<div class="mch-io-slot' + (isFluid ? ' display' : '') + (cur >= rec.inp[k] ? ' full' : '') + '"' +
      (isFluid ? '' : ' data-action="feed-slot" data-id="' + k + '"') + ' data-tip="' + tip + '">' +
      '<img src="' + iconDataURL(k) + '"><span class="mch-io-n">' + cur + '/' + rec.inp[k] + '</span></div>';
  }
  h += '</div></div>';
  // 进度条（组装机风格：内部显示百分比 + 剩余时间）
  h += '<div class="asm3-prog"><div class="bar"><i></i><span class="bar-txt" data-live="mch-pct">0%</span></div></div>';
  // 产品区
  h += '<div class="asm3-side asm3-out"><div class="asm3-out-row" data-live="mch-out">';
  if (rec.out) {
    for (const k in rec.out) {
      const cur = e.outp[k] || 0;
      const isFluid = FLUIDS.indexOf(k) >= 0;
      // 流体产物槽不可点击（只读）：自动排入相邻管道，不能取出到背包
      const tip = isFluid
        ? ITEMS[k].name + '|流体产物，自动排入相邻管道（当前 ' + cur + '）'
        : ITEMS[k].name + '|点击取回 1 件（当前 ' + cur + '）';
      h += '<div class="mch-io-slot' + (isFluid ? ' display' : '') + '"' +
        (isFluid ? '' : ' data-action="take-slot" data-id="' + k + '"') + ' data-tip="' + tip + '">' +
        '<img src="' + iconDataURL(k) + '"><span class="mch-io-n">' + cur + '</span></div>';
    }
  } else if (rec.prob) {
    for (const k in rec.prob) {
      const cur = e.outp[k] || 0;
      const isFluid = FLUIDS.indexOf(k) >= 0;
      const tip = isFluid
        ? ITEMS[k].name + '|流体产物，自动排入相邻管道（当前 ' + cur + '）'
        : ITEMS[k].name + '|概率产出（' + Math.round(rec.prob[k] * 10000) / 100 + '%），点击取回（当前 ' + cur + '）';
      h += '<div class="mch-io-slot' + (isFluid ? ' display' : '') + '"' +
        (isFluid ? '' : ' data-action="take-slot" data-id="' + k + '"') + ' data-tip="' + tip + '">' +
        '<img src="' + iconDataURL(k) + '"><span class="mch-io-n">' + cur + '</span></div>';
    }
  }
  h += '</div></div>';
  h += '</div>'; // asm3-flow
  // 第三行：模块插槽（与组装机一致，不显示标题）
  h += moduleSlotSectionHtml(e, true);
  h += '</div>'; // asm3-recipe
  return h;
}

// 设备模块插槽区域：图形化展示 N 个插槽，已装模块显示图标，空槽显示 "+"；
// noHeader=true 时不显示“模块插槽（N 个）”标题（组装机面板隐藏该段文字）；
// 空槽放入模块需先在左栏背包选中插件模块后再点击（放入非插件会就地浮出提示）。
function moduleSlotSectionHtml(e, noHeader) {
  const slotN = (typeof e.moduleSlotCount === 'function') ? e.moduleSlotCount() : 4;
  if (slotN <= 0) return ''; // 无插槽设备（如组装机 I）不显示模块区
  const mods = e.modules || {};
  const slotItems = [];
  for (const mid in mods) {
    if ((mods[mid] || 0) > 0) for (let i = 0; i < mods[mid]; i++) slotItems.push(mid);
  }
  // 组装已装模块列表（默认显示标题；组装机面板由调用方传入 noHeader 隐藏）
  let h = noHeader ? '' : '<div class="sec">模块插槽（' + slotN + ' 个）</div>';
  h += '<div class="mod-slots">';
  for (let i = 0; i < slotN; i++) {
    const mid = slotItems[i];
    if (mid) {
      h += '<div class="mod-slot filled" data-action="mod-take" data-id="' + mid + '" data-tip="' + ITEMS[mid].name + '|点击取出到背包">' +
        '<img src="' + iconDataURL(mid, 16) + '">' +
        '<span class="mod-slot-n">' + ITEMS[mid].name + '</span></div>';
    } else {
      h += '<div class="mod-slot empty" data-action="mod-put" data-index="' + i + '" data-tip="选中插件后点击放入">' +
        '<span class="mod-slot-plus">+</span></div>';
    }
  }
  h += '</div>';
  // 装入模块按钮（可点选）
  const mc = moduleCounts(mods);
  const hasMod = Object.keys(mods).length > 0;
  if (hasMod) {
    h += '<div class="mod-status">速度+' + mc.speed.toFixed(1) + ' 产能+' + mc.prod.toFixed(1) +
      ' 效率-' + mc.eff.toFixed(1) + ' 品质+' + (mc.quality * 100).toFixed(1) + '%</div>';
    h += '<button data-action="takein" data-modules="1" class="btn sm">取出全部模块</button>';
  }
  // 背包中有可装入的模块时显示装入按钮
  const order = ['speed-module', 'speed-module-2', 'speed-module-3', 'productivity-module', 'productivity-module-2', 'productivity-module-3', 'efficiency-module', 'efficiency-module-2', 'efficiency-module-3', 'quality-module', 'quality-module-2', 'quality-module-3'];
  let hasAvailable = false;
  for (const mid of order) {
    if (!itemUnlocked(mid)) continue;
    const n = Math.min(invCount(mid), slotN - (mods[mid] || 0));
    if (n > 0) { hasAvailable = true; break; }
  }
  if (hasAvailable) {
    h += '<div class="mod-buttons">';
    for (const mid of order) {
      if (!itemUnlocked(mid)) continue;
      const n = Math.min(invCount(mid), slotN - (mods[mid] || 0));
      if (n > 0) h += '<button data-action="feed" data-id="' + mid + '" class="btn sm">装入' + ITEMS[mid].name + ' ×' + n + '</button>';
    }
    h += '</div>';
  }
  return h;
}

// 设备面板的“消耗速率 / 产出速率”：按配方 time 折算每秒消耗/产出速率（单位/秒），
// 并计入设备当前的生产倍率 mult（如科技加成、机型差异等），让玩家明确看到当前设备
// 每秒消耗多少原料、生产多少产品。
function machRateBlocks(rec, mult) {
  if (!rec) return '';
  mult = mult || 1;
  let h = '';
  if (Object.keys(rec.inp).length) {
    h += '<div class="sec">消耗速率</div>';
    for (const k in rec.inp) {
      const rate = (rec.inp[k] / rec.time) * mult;
      h += '<div class="mach-rate"><b style="color:#ff8a7a">−' + rate.toFixed(2) + '/秒</b>' + chip(k, rec.inp[k]) + '</div>';
    }
  }
  if (Object.keys(rec.out).length) {
    h += '<div class="sec">产出速率</div>';
    for (const k in rec.out) {
      const rate = (rec.out[k] / rec.time) * mult;
      h += '<div class="mach-rate"><b style="color:#8fe08f">+' + rate.toFixed(2) + '/秒</b>' + chip(k, rec.out[k]) + '</div>';
    }
  }
  return h;
}

function machRateHtml(rec, mult) {
  const blocks = machRateBlocks(rec, mult);
  if (!blocks) return '';
  const m = mult || 1;
  return blocks + '<div class="dim">速率为按配方耗时折算的每秒输入/输出量' +
    (m !== 1 ? '，已计入设备当前倍率 ×' + m.toFixed(2) : '') + '。</div>';
}

function statusLine(txt) {
  return '<div class="status">' + txt + '</div>';
}
// ===== 通用弹框标题拖拽 =====
// 让所有带标题栏的弹框面板支持“点中标题拖动”：可自由移动面板（允许拖到窗口外，
// 但保留一部分可见便于拖回）。panel：面板根元素；head：可拖拽的标题栏元素
// （头部内部按钮如关闭按钮除外）。支持面板内容重建后重新传入新的 head 重新绑定，
// 重复调用会先解绑旧 head，再绑定新 head；drag 状态挂在 panel 上，跨重建共享。
function makeTitleDraggable(panel, head) {
  if (!panel || !head) return;
  if (!panel._drag) panel._drag = null;

  // 若已绑定过旧 head，先解绑，再绑定新 head
  if (panel._dragHead && panel._dragHead !== head) {
    panel._dragHead.removeEventListener('mousedown', panel._dragDown);
  }

  function snapToRect() {
    const r = panel.getBoundingClientRect();
    panel.style.left = r.left + 'px';
    panel.style.top = r.top + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.transform = 'none';
    return r;
  }
  function moveDrag(cx, cy) {
    const d = panel._drag;
    if (!d) return;
    if (Math.abs(cx - d.sx) + Math.abs(cy - d.sy) > 5) d.moved = true;
    if (d.moved) {
      const w = panel.offsetWidth, h = panel.offsetHeight;
      let nl = d.ox + (cx - d.sx);
      let nt = d.oy + (cy - d.sy);
      // 允许拖出窗口，但保留 40px 可见，防止完全拖丢、无法拖回
      const margin = 40;
      nl = Math.max(margin - w, Math.min(innerWidth - margin, nl));
      nt = Math.max(margin - h, Math.min(innerHeight - margin, nt));
      panel.style.left = nl + 'px';
      panel.style.top = nt + 'px';
    }
  }
  function endDrag() { panel._drag = null; }
  function canDrag(ev) {
    if (ev && ev.target && ev.target.closest && ev.target.closest('button, input, select, textarea, a')) return false;
    return true;
  }
  function onHeadDown(ev) {
    if (!canDrag(ev)) return;
    const r = snapToRect();
    panel._drag = { ox: r.left, oy: r.top, sx: ev.clientX, sy: ev.clientY, moved: false };
    ev.preventDefault();
  }
  panel._dragDown = onHeadDown;
  panel._dragHead = head;
  head.addEventListener('mousedown', onHeadDown);

  // 全局 move/up 只绑定一次，复用同一份 drag 状态（挂在 panel._drag 上）
  if (!panel._dragGlobalBound) {
    panel._dragGlobalBound = true;
    window.addEventListener('mousemove', ev => { if (panel._drag) moveDrag(ev.clientX, ev.clientY); });
    window.addEventListener('mouseup', endDrag);
  }
}
