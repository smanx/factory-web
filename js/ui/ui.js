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

// 制作栏 5 个 Tab：顺序、标签与官方 item-group 一一对应（数据单源归类见 GAME_DATA.itemGroup）。
const CRAFT_TABS = ['logistics', 'production', 'intermediate-products', 'space', 'combat'];
const CRAFT_TAB_LABEL = {
  'logistics': '🧱 物流',
  'production': '🏭 生产',
  'intermediate-products': '🧪 中间产品',
  'space': '🚀 太空',
  'combat': '🔫 武器',
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
  let base = TIP_BASE_CACHE[id];
  if (!base) {
    const it = ITEMS[id];
    const stack = (typeof stackSize === 'function') ? stackSize(id) : 100;
    base = it.name + '|' + it.desc + (stack ? '（最大堆叠 ' + stack + '）' : '');
    // 可合成物品：在 tooltip 末尾追加合成配方（需求：建造物品悬停显示配方）
    const recipe = itemRecipeText(id);
    if (recipe) base += '||' + recipe;
    TIP_BASE_CACHE[id] = base;
  }
  return extra ? (base + (extra[0] === '|' ? '' : '|') + extra) : base;
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
    if (id) slot.dataset.tip = itemTip(id);
    else slot.dataset.tip = '空槽位|打开背包(E)，选中任意物品后点击空槽位或鼠标中键即可把该物品放入，放置幽灵继续选中';
    if (id) {
      const ic = iconCanvas(id, 16).cloneNode();
      ic.getContext('2d').drawImage(iconCanvas(id, 16), 0, 0);
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
    el.textContent = id ? (infinite ? '∞' : invCount(id)) : '';
    // 快捷栏无选中效果：点击只切换鼠标放置幽灵，不显示高亮/选中态
    const slot = document.getElementById('hotbar').children[i];
    slot.classList.remove('active');
    slot.classList.toggle('empty', !!id && !infinite && invCount(id) <= 0);
  });
}

// 快捷栏槽位点击：若鼠标持握放置幽灵且点击空槽位，直接把该物品放入空槽位，
// 且放置幽灵不消失、继续选中（可继续放入其他空槽位）；否则切换鼠标放置幽灵为该槽位物品。
// 快捷栏无选中效果：点击只让鼠标幽灵显示该物品，不高亮/不选中快捷栏槽位。
function onHotbarClick(i) {
  const held = G.quickSel;
  if (held && ITEMS[held] && !HOTBAR[i]) {
    // 空槽位：把鼠标持握的放置幽灵物品直接放入，且幽灵不消失、继续选中
    HOTBAR[i] = held;
    toast('已放入快捷栏槽位 ' + (i === 9 ? 0 : i + 1) + '：' + ITEMS[held].name + '（放置幽灵继续选中，可继续放入其他空槽位）');
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
  if (held && ITEMS[held]) {
    // 鼠标持握幽灵物品：设为该快捷栏槽位
    HOTBAR[i] = held;
    toast('已设置快捷栏槽位 ' + (i === 9 ? 0 : i + 1) + '：' + ITEMS[held].name);
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
  if (id && ITEMS[id]) {
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

function openPanel(mode, ent) {
  // 配方设备：无配方时先弹出配方选择面板；已有配方则直接进入交互面板
  if (mode === 'machine' && ent && isRecipeDevice(ent) && !ent.recipe) {
    mode = 'machinerecipe';
    G.recipeSel = null;
  }
  G.panelMode = mode;
  G.panelEnt = ent || null;
  // 打开设置面板时自动暂停游戏（关闭时恢复，见 closePanel）
  if (mode === 'set') G.paused = true;
  // 背包弹框居中加宽显示（三列布局），其余面板保持右上角小窗
  document.getElementById('panel').classList.toggle('inv-wide', mode === 'inv');
  // 研究面板加宽双栏布局（左=研究列表，右=研究树图）
  document.getElementById('panel').classList.toggle('tech-wide', mode === 'tech');
  // 配方设备的交互面板：居中加宽双栏布局（左=背包，右=设备交互）
  document.getElementById('panel').classList.toggle('machine-wide', mode === 'machine' && !!ent && (isRecipeDevice(ent) || isChestEntity(ent)));
  // 配方选择面板：网格区可滚动，底部「确认」按钮行固定在面板底部不随之滚动
  document.getElementById('panel').classList.toggle('recipe-wide', mode === 'machinerecipe');
  // 再次打开时恢复面板默认位置（不保留上次拖动的位置）
  if (typeof resetPanelPos === 'function') resetPanelPos();
  document.getElementById('panel').style.display = 'flex';
  renderPanel(true);
}

function closePanel(hide = true) {
  const wasSettings = G.panelMode === 'set';
  G.panelMode = null;
  G.panelEnt = null;
  G.invRecipeQ = '';
  G.recipeSel = null;
  if (hide) document.getElementById('panel').style.display = 'none';
  // 关闭设置面板后恢复游戏（对应 openPanel 中打开设置时的自动暂停）
  if (wasSettings) G.paused = false;
}

function panelScrollTop() {
  const p = document.getElementById('panel-body');
  return p ? p.scrollTop : 0;
}

function renderPanel(full) {
  const body = document.getElementById('panel-body');
  const title = document.getElementById('panel-title');
  if (!G.panelMode) { document.getElementById('panel').style.display = 'none'; return; }
  const st = full ? 0 : panelScrollTop();
  if (G.panelMode === 'inv') {
    // 顶部面板标题去掉（需求：不显示），仅保留右上角关闭按钮；由 CSS #panel.inv-wide #panel-title 隐藏。
    title.textContent = '';
    const keepFocusId = document.activeElement &&
      (document.activeElement.id === 'inv-recipe-search' || document.activeElement.id === 'inv-item-search') ?
      document.activeElement.id : null;
    // 背包面板：玩家 / 物流 / 制作 三个分区共用一个顶部标题栏（不可点击、整体连排、左对齐）。
    // 该标题栏同时也是面板的拖拽手柄：按住可拖动整个弹框，可拖到窗口外。
    if (!_invTabCache['craft']) _invTabCache['craft'] = htmlCraft();
    const craftHtml = _invTabCache['craft'];
    const matHtml = htmlInventory();
    const logiHtml = htmlLogistics();
    body.innerHTML =
      '<div class="inv-tabs" id="inv-tabs">' +
        '<span class="inv-tab">🎒 玩家</span>' +
        '<span class="inv-tab">📦 物流</span>' +
        '<span class="inv-tab">🛠 制作</span>' +
      '</div>' +
      '<div class="inv-layout">' +
        '<div class="inv-col inv-col-left" id="inv-col-left">' +
          '<div class="inv-col-body" id="inv-mat">' + matHtml + '</div>' +
        '</div>' +
        '<div class="inv-col inv-col-mid" id="inv-col-mid">' +
          '<div class="inv-col-body">' + logiHtml + '</div>' +
        '</div>' +
        '<div class="inv-col inv-col-right" id="inv-col-right">' +
          '<div class="inv-col-body" id="inv-craft">' + craftHtml + '</div>' +
        '</div>' +
      '</div>';
    applyInvRecipeFilter(G.invRecipeQ);
    applyInvItemSearch(G.invItemQ);
    // 用背包分区标题栏作为拖拽手柄（不可点击、连成整体），可拖动整个弹框到窗口外。
    const invTabsBar = document.getElementById('inv-tabs');
    if (invTabsBar) makeTitleDraggable(document.getElementById('panel'), invTabsBar);
    if (keepFocusId) {
      const inp = document.getElementById(keepFocusId);
      if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    }
  } else if (G.panelMode === 'tech') {
    title.textContent = '科技研究';
    body.innerHTML = htmlTech();
  } else if (G.panelMode === 'bluebook') {
    title.textContent = '蓝图库（Blueprint book）';
    body.innerHTML = htmlBlueBook();
  } else if (G.panelMode === 'stats') {
    title.textContent = '统计面板';
    body.innerHTML = htmlStats();
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
  } else if (G.panelMode === 'machine' && G.panelEnt) {
    title.textContent = ITEMS[G.panelEnt.type].name;
    if (isRecipeDevice(G.panelEnt)) {
      // 配方设备：重新设计的双栏交互面板（左=背包，右=设备交互信息）
      body.innerHTML = recipeMachineLayoutHtml(G.panelEnt);
    } else if (isChestEntity(G.panelEnt)) {
      // 储物箱：双栏布局（左=玩家背包，右=箱子内容）
      body.innerHTML = htmlMachine(G.panelEnt);
    } else {
      // 普通设备：设备专属内容
      body.innerHTML = htmlMachine(G.panelEnt);
    }
  }
  if (G.panelMode !== 'set') body.scrollTop = st;
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
  if (!body || G.panelMode !== 'inv') return;
  // 背包固定格（#inv-items）：每格一种物品，数量以右下角角标(.cnt)显示。
  // 物品集合变化时（新增/消失/清空）需重建格子以保证排列稳定；集合不变则仅在原地
  // 更新数量角标与搜索过滤，避免整块重建带来的掉帧。
  const wrap = body.querySelector('#inv-items-wrap');
  if (wrap) {
    // 计算当前已拥有物品的稳定签名（排序后的 ID 串）
    const ownedIds = [];
    G.inv.forEach((n, id) => { if (n > 0 && ITEMS[id]) ownedIds.push(id); });
    ownedIds.sort();
    const sig = ownedIds.join(',');
    if (wrap.dataset.ownedsig !== sig) {
      // 物品集合变化 → 整块重建格子（保持排列稳定）
      wrap.outerHTML = htmlInvSlots();
    } else {
      // 集合不变 → 仅在原地更新各格数量角标与搜索过滤
      const grid = body.querySelector('#inv-items');
      const q = (G.invItemQ || '').trim().toLowerCase();
      if (grid) grid.querySelectorAll('.inv-slot[data-itemid]').forEach(el => {
        const id = el.dataset.itemid;
        const n = invCount(id);
        const c = el.querySelector('.cnt[data-cnt]');
        if (c && c.textContent !== String(n)) c.textContent = n;
        const hit = !q || (el.dataset.itemsearch || '').includes(q);
        el.classList.toggle('hidden', !hit);
      });
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
    updateRecipeMachineLive(e, body, api);
  } else {
    const panel = DEVICE_PANEL[e.type];
    if (panel && panel.live) panel.live(e, api);
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
  const stEl = body.querySelector('.status');
  if (stEl && status) {
    if (stEl.textContent !== status) stEl.textContent = status;
    const wantCls = 'status ' + (state || 'warn');
    if (stEl.className !== wantCls) stEl.className = wantCls;
  }
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
      inp += '<div class="mch-io-slot' + (cur >= need ? ' full' : '') + '" data-action="feed-slot" data-id="' + k + '" data-tip="' + ITEMS[k].name + '|配方需 ' + need + '，当前 ' + cur + '。点击放入（或先选左侧物品再点击此槽放入该物品）">' +
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
      const extra = outMap[k] ? ('×' + outMap[k]) : (probMap[k] ? '（' + Math.round(probMap[k] * 10000) / 100 + '%）' : '');
      out += '<div class="mch-io-slot" data-action="take-slot" data-id="' + k + '" data-tip="' + ITEMS[k].name + '|' + (outMap[k] ? ('每周期 ' + outMap[k] + ' 件，点击取回 1 件') : '概率产出，点击取回') + '（当前 ' + cur + '）">' +
        '<img src="' + iconDataURL(k) + '"><span class="mch-io-n">' + cur + (extra ? ' ' + extra : '') + '</span></div>';
    }
    api.set('mch-out', out);
  }
  // 进度与状态
  const pct = (rec && e.crafting) ? (e.prog / rec.time * 100) : 0;
  api.prog(pct, rec ? rec.time : 0);
  if (!rec) { api.status('未设置配方，点击「切换配方」选择', 'warn'); return; }
  if (e.crafting) { api.status('生产中：' + info.name(e.recipe), 'ok'); return; }
  const needsPower = typeof e.powerDemand === 'function' && e.powerDemand() > 0;
  if (needsPower && G.power.sat <= 0) { api.status('已暂停：缺电', 'bad'); return; }
  // 检查原料是否满足
  let missing = null;
  for (const k in rec.inp) if ((e.inp[k] || 0) < rec.inp[k]) { missing = k; break; }
  if (missing) { api.status('已暂停：缺少原料 ' + ITEMS[missing].name, 'warn'); return; }
  api.status('已就绪，等待开始生产', 'ok');
}

function chip(id, n, iconOnly) {
  return '<span class="chip" data-itemid="' + id + '" data-tip="' + itemTip(id) + '" data-itemsearch="' +
    (ITEMS[id].name + ' ' + id).toLowerCase().replace(/"/g, '') + '"><img src="' + iconDataURL(id) + '">' +
    (iconOnly ? (n !== undefined ? ' ×' + n : '') : ITEMS[id].name + (n !== undefined ? ' ×' + n : '')) + '</span>';
}

// ===== 玩家背包固定格渲染（对齐《异星工厂》有限背包）=====
// 背包是有限的 INV_SLOT_COUNT 个固定格子。每格对应一种物品：格内显示物品图标，
// 物品数量以右下角角标(.cnt)显示。空格显示为空槽。格子数来自官方数据 inventory_size=80。
// 物品在格子中的排列按物品 ID 排序，保证稳定；超过格子数的物品无法放入（背包已满）。
// 手雷/集束手雷与生鱼在对应格子上提供快捷使用角标。
function htmlInvSlots() {
  const q = (G.invItemQ || '').trim().toLowerCase();
  // 稳定排序的已拥有物品列表（仅数量>0 的）
  const owned = [];
  G.inv.forEach((n, id) => { if (n > 0 && ITEMS[id]) owned.push(id); });
  owned.sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  const sig = owned.join(',');
  let h = '<div id="inv-items-wrap" data-ownedsig="' + sig + '">';
  h += '<div class="inv-slots" id="inv-items">';
  for (let i = 0; i < INV_SLOT_COUNT; i++) {
    const id = owned[i];
    if (id) {
      const n = invCount(id);
      const search = (ITEMS[id].name + ' ' + id).toLowerCase().replace(/"/g, '');
      const hit = !q || search.includes(q);
      let use = '';
      // 手雷/集束手雷：可在背包中直接投掷（对齐《异星工厂》投掷物）
      if (id === 'grenade' || id === 'cluster-grenade') {
        use = '<button class="slot-use" data-action="use-grenade" data-type="' + id + '" title="投掷' + ITEMS[id].name + '（向当前朝向投掷，造成范围爆炸）">💣</button>';
      }
      // 生鱼：可在背包中直接食用回血（对齐《异星工厂》：吃鱼治疗）
      if (id === 'raw-fish') {
        use = '<button class="slot-use" data-action="eat-fish" data-type="' + id + '" title="食用' + ITEMS[id].name + '（恢复 20 生命值）">🐟</button>';
      }
      h += '<div class="inv-slot' + (hit ? '' : ' hidden') + '" data-itemid="' + id + '" data-tip="' + itemTip(id) + '" data-itemsearch="' + search + '">' +
        '<img src="' + iconDataURL(id, 16) + '">' +
        '<span class="cnt" data-cnt="' + id + '">' + n + '</span>' +
        use + '</div>';
    } else {
      h += '<div class="inv-slot empty"></div>';
    }
  }
  h += '</div>';
  if (owned.length === 0) {
    h += '<div class="dim" style="margin-top:6px">空空如也，去地图上按住右键挖矿吧（铁矿/铜矿/煤/石头）</div>';
  }
  h += '</div>';
  return h;
}

function htmlInventory() {
  let h = '';
  const iq = (G.invItemQ || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  h += '<input id="inv-item-search" class="inv-search" type="text" placeholder="搜索物品（输入名称）" autocomplete="off" value="' + iq + '">';
  h += htmlInvSlots();
  return h;
}

// ===== 个人物流区（对齐《异星工厂》Personal logistic request + Trash slots）=====
// 中间物流区自上而下分为：
//   顶部：两个开关 —— 「背包物流」总开关 + 「回收未请求物品」开关
//   中部物流区：请求物品格子（每行 10 格，共 5 行 = 50 格）。格子中设置的物品会被物流机器人运到背包。
//   底部物流回收区：回收物品格子（每行 10 格，共 3 行 = 30 格）。格子中设置的物品会被物流机器人从背包运走回收。
// 数据源仍为 G.logiRequest（item->请求数量）与 G.trashSlots（item->true），
// 格子按物品键顺序填充到固定数量的槽位中，语义与原有物流引擎一致。

// 物流区（请求）格子数：每行 10 格，共 5 行
const LOGI_REQ_ROWS = 5, LOGI_REQ_PER_ROW = 10;
// 物流回收区格子数：每行 10 格，共 3 行
const LOGI_RECYCLE_ROWS = 3, LOGI_RECYCLE_PER_ROW = 10;

// 渲染物流区请求格子（10x5）。已请求的物品按键序填充到前面的槽位。
function logiReqGridHtml() {
  const lreq = G.logiRequest || {};
  const keys = Object.keys(lreq).filter(k => lreq[k] > 0).sort();
  const cap = LOGI_REQ_ROWS * LOGI_REQ_PER_ROW;
  let h = '<div class="logi-grid" id="logi-req-grid">';
  for (let i = 0; i < cap; i++) {
    const k = keys[i];
    if (k) {
      const have = invCount(k);
      const req = lreq[k] || 0;
      h += '<div class="logi-cell req-cell" data-logireq="' + k + '" data-tip="' + ITEMS[k].name + '|请求 ' + req + '，已持有 ' + have + '。点击设置/清除请求">' +
        '<img src="' + iconDataURL(k, 16) + '">' +
        '<span class="lreq-have cnt">' + req + '</span></div>';
    } else {
      h += '<div class="logi-cell req-cell empty" data-logireq=""></div>';
    }
  }
  h += '</div>';
  return h;
}

// 渲染物流回收区格子（10x3）。已标记回收的物品按键序填充到前面的槽位。
function logiRecycleGridHtml() {
  const trash = G.trashSlots || {};
  const keys = Object.keys(trash).filter(k => trash[k]).sort();
  const cap = LOGI_RECYCLE_ROWS * LOGI_RECYCLE_PER_ROW;
  let h = '<div class="logi-grid" id="logi-recycle-grid">';
  for (let i = 0; i < cap; i++) {
    const k = keys[i];
    if (k) {
      const have = invCount(k);
      h += '<div class="logi-cell recycle-cell" data-logirecycle="' + k + '" data-tip="' + ITEMS[k].name + '|标记回收，持有 ' + have + '。点击取消回收">' +
        '<img src="' + iconDataURL(k, 16) + '">' +
        '<span class="recycle-x cnt">🗑</span></div>';
    } else {
      h += '<div class="logi-cell recycle-cell empty" data-logirecycle=""></div>';
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
  // 受背包空位（堆叠上限）限制
  for (const k in rec.out) {
    if (FLUIDS.indexOf(k) >= 0) continue;
    const outN = rec.out[k] || 1;
    if (outN > 0) {
      const room = Math.max(0, stackSize(k) - invCount(k));
      max = Math.min(max, Math.floor(room / outN));
    }
  }
  return (isFinite(max) && max > 0) ? max : 0;
}
function htmlCraft() {
  let h = '';
  const q = (G.invRecipeQ || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  h += '<input id="inv-recipe-search" class="inv-search" type="text" placeholder="搜索配方（输入物品名称）" autocomplete="off" value="' + q + '">';
  // 制作栏 5 个 Tab（数据单源归类，见 GAME_DATA.itemGroup）
  const activeTab = G.invRecipeTab && CRAFT_TABS.indexOf(G.invRecipeTab) >= 0 ? G.invRecipeTab : 'logistics';
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
  // Tab 栏
  h += '<div class="craft-tabs" id="inv-recipe-tabs">';
  for (const tab of CRAFT_TABS) {
    const n = (perTab[tab] || []).length;
    const on = tab === activeTab ? ' active' : '';
    h += '<button type="button" class="craft-tab' + on + '" data-tab="' + tab + '">' + CRAFT_TAB_LABEL[tab] + ' <span class="cnt">' + n + '</span></button>';
  }
  h += '</div>';
  // 每个 Tab 一个配方网格
  for (const tab of CRAFT_TABS) {
    const items = perTab[tab] || [];
    const on = tab === activeTab ? '' : ' style="display:none"';
    h += '<div id="inv-recipes-' + tab + '" class="inv-slots craft-grid" data-tab="' + tab + '"' + on + '>';
    for (const { rid, outId } of items) {
      const unlocked = recipeUnlocked(rid);
      const lockTech = recipeLockingTech(rid);
      const rec = RECIPES[rid];
      const cnt = unlocked ? craftMaxCount(rid) : 0;
      const searchKey = (ITEMS[outId].name + ' ' + outId + ' ' +
        Object.keys(rec.inp).map(k => ITEMS[k].name).join(' ') + ' ' + recipeDeviceName(rid)).toLowerCase();
      h += '<div class="inv-slot craft-slot' + (unlocked ? '' : ' locked') + '" data-action="craft" data-id="' + rid + '" data-mult="1" data-craftable="' + cnt + '" data-rsearch="' + searchKey.replace(/"/g, '') + '" data-tip="' + itemTip(outId) + '">' +
        '<img src="' + iconDataURL(outId, 16) + '">' +
        '<span class="cnt" data-cnt>' + cnt + '</span>' +
        (unlocked ? '' : '<span class="craft-lock" title="需先研究：' + TECHS[lockTech].name + '">🔒</span>') +
        '</div>';
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
  // 只统计当前 Tab 内的可见槽
  let shown = 0;
  const activeGrid = body.querySelector('#inv-recipes-' + activeTab);
  if (activeGrid) {
    activeGrid.querySelectorAll('.craft-slot').forEach(el => {
      const hit = !ql || el.dataset.rsearch.includes(ql);
      el.style.display = hit ? '' : 'none';
      if (hit) shown++;
    });
  }
  // 隐藏其它 Tab 的槽（保持干净），避免跨 Tab 误判
  for (const t of CRAFT_TABS) {
    if (t === activeTab) continue;
    const grid = body.querySelector('#inv-recipes-' + t);
    if (grid) grid.querySelectorAll('.craft-slot').forEach(el => { el.style.display = ''; });
  }
  const emp = document.getElementById('inv-recipe-empty');
  if (emp) {
    emp.textContent = ql ? '没有匹配「' + q.trim() + '」的配方' : '没有匹配的配方';
    emp.style.display = shown ? 'none' : '';
  }
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

// 蓝图库面板：列出所有保存的蓝图，可加载粘贴或删除
function htmlBlueBook() {
  const list = Array.isArray(G.blueBook) ? G.blueBook : [];
  let h = '<div class="dim">按 <b>B</b> 框选复制蓝图会自动存入蓝图库；也可复制后点这里加载复用。点击“粘贴”后回到地图点击空白处放置（R旋转，右键取消）。</div>';
  h += '<div class="sec">导入蓝图 <span class="dim">（对齐《异星工厂》Blueprint string）</span></div>' +
    '<div class="bb-import-row"><input id="bb-import-input" type="text" placeholder="粘贴蓝图字符串后点导入…" autocomplete="off">' +
    '<button data-bbimport="1">📥 导入</button></div>';
  if (!list.length) {
    h += '<div class="dim">蓝图库为空。请先在地图上按 <b>B</b> 拖拽框选一片建筑进行复制，蓝图会自动保存到这里。</div>';
    return h;
  }
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    const types = {};
    for (const e of b.ents) {
      const t = e.type;
      types[t] = (types[t] || 0) + 1;
    }
    const typeNames = Object.keys(types).slice(0, 4).map(t => ITEMS[t] ? ITEMS[t].name : t).join('、') +
      (Object.keys(types).length > 4 ? ' 等' : '');
    h += '<div class="bluebook-item" data-bb="' + i + '">' +
      '<div class="bb-main"><div class="bb-name">' + b.name + '</div>' +
      '<div class="dim">' + b.ents.length + ' 个建筑 · ' + typeNames + '</div></div>' +
      '<button data-bbuse="' + i + '">📋 粘贴</button>' +
      '<button data-bbexport="' + i + '" title="导出为蓝图字符串（复制分享/导入）">📤 导出</button>' +
      '<button data-bbrename="' + i + '">✏️ 重命名</button>' +
      '<button data-bbdel="' + i + '" class="bb-del">🗑 删除</button>' +
      '</div>';
  }
  return h;
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
  // 分类筛选 tab
  const cats = ['all', 'base', 'quality', 'space-age'];
  const catName = { all: '全部', base: TECH_CAT.base.name, quality: TECH_CAT.quality.name, 'space-age': TECH_CAT['space-age'].name };
  const cur = G.techCatFilter || 'all';
  let h = '<div class="tech-tabs">';
  for (const c of cats) h += '<button data-techcat="' + c + '" class="tech-tab' + (cur===c?' active':'') + '">' + catName[c] + '</button>';
  h += '</div>';

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
    h += '<div class="tech-cat-head">' + cmeta.icon + ' ' + cmeta.name + '</div>';
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
      h += '<div class="recipe tech ' + (done ? 'done' : '') + (locked ? ' locked' : '') + (t.trigger ? ' trigger' : '') + '" data-techcat="' + catKey + '" data-techid="' + tid + '">';
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

// 机器面板：按设备类型查注册表分发，各设备的 html 定义在 js/devices/*.js
function htmlMachine(e) {
  const panel = DEVICE_PANEL[e.type];
  let h = (panel && panel.html) ? panel.html(e) : '<div class="dim">无信息</div>';
  // 电路节点设备：追加「接入通道」设置（对齐《异星工厂》红/绿线缆，实现红绿信号物理隔离）
  if (typeof isCircuitNodeEntity === 'function' && isCircuitNodeEntity(e)) {
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

// 是否为储物箱（木箱/铁箱/钢箱等标准储物箱 + 物流箱）：
// 面板采用「左=玩家背包，右=箱子」双栏布局，可双向移动物品
function isChestEntity(e) {
  if (!e) return false;
  return e.type === 'wooden-chest' || e.type === 'iron-chest' || e.type === 'steel-chest' ||
    e.type === 'passive-provider-chest' || e.type === 'active-provider-chest' ||
    e.type === 'storage-chest' || e.type === 'requester-chest' || e.type === 'buffer-chest';
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

// 配方选择面板：配方网格 + 右下角确认按钮
function recipeSelectPanelHtml(e) {
  const info = recipeDeviceInfo(e);
  let h = '<div class="rcp-scroll">';
  h += '<div class="sec">点击选择配方（勾选后点右下角「确认」设置）</div>';
  h += '<input id="rcp-search" class="inv-search" type="text" placeholder="搜索配方（输入物品名称）" autocomplete="off">';
  h += '<div class="recgrid" id="rcp-grid">' + recipeSelectGridHtml(e, info, '') + '</div>';
  h += '</div>';
  h += '<div class="rcp-confirm-row">';
  h += '<button data-action="recipe-clear">清除配方</button>';
  h += '<button data-action="recipe-confirm" class="rcp-confirm" data-id="' + (G.recipeSel || '') + '"' + (G.recipeSel ? '' : ' disabled') + '>确认设置 ✓</button>';
  h += '</div>';
  h += '<div class="dim">提示：未设置配方时无法生产。确认后进入设备交互面板，可放入原料、取走产物，也可随时「切换配方」。</div>';
  return h;
}

// 配方选择网格（供配方选择面板与搜索过滤共用）
function recipeSelectGridHtml(e, info, q) {
  q = (q || '').toLowerCase();
  let h = '';
  for (const rid of info.list) {
    const r = info.getRec(rid);
    if (!r) continue;
    const outId = recipeMainIcon(r, info, rid);
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
    const searchKey = (name + ' ' + rid + ' ' + (inpStr || '') + ' ' + (outStr || '')).toLowerCase();
    if (q && searchKey.indexOf(q) < 0) continue;
    const tipMain = name + '|每周期耗时 ' + r.time + ' 秒' + (unlocked ? '' : '。未解锁：需先研究「' + (lockTech ? TECHS[lockTech].name : '对应科技') + '」');
    const tipRecipe = (inpStr ? '所需原料：' + inpStr : '') + (outStr ? '（产出：' + outStr + '）' : '');
    h += '<button class="rcbtn ' + selCls + (unlocked ? '' : ' locked') + '" data-action="pickrecipe" data-id="' + rid + '" data-itemid="' + (outId || '') + '"' +
      ' data-tip="' + tipMain + '||' + tipRecipe + '"' + (unlocked ? '' : ' disabled') + '>' +
      (outId ? '<img src="' + iconDataURL(outId) + '">' : '') + name + (unlocked ? '' : '<br><small>🔒' + (lockTech ? TECHS[lockTech].name : '') + '</small>') + '</button>';
  }
  return h;
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

// 右侧设备交互信息：配方名 + 原料/进度/产品单行图标 + 切换配方按钮 + 操作说明
function recipeMachineRightHtml(e, info, rec) {
  let h = '';
  // 当前配方标题 + 切换配方按钮
  h += '<div class="sec mch-recipe-head">当前配方：<b>' + (rec ? info.name(e.recipe) : '<span class="dim">未设置</span>') + '</b>' +
    '<button data-action="switch-recipe" class="btn sm" title="返回配方选择面板">⇄ 切换配方</button></div>';
  if (!rec) {
    h += '<div class="dim">请点击「切换配方」选择配方后即可生产。</div>';
    return h;
  }
  // 原料 + 进度条 + 产品 单行（横向排布）
  h += '<div class="mch-flow">';
  // 原料区
  h += '<div class="mch-side mch-inp"><div class="mch-side-title">原料</div><div class="mch-inp-row" data-live="mch-inp">';
  for (const k in rec.inp) {
    const cur = e.inp[k] || 0;
    h += '<div class="mch-io-slot" data-action="feed-slot" data-id="' + k + '" data-tip="' + ITEMS[k].name + '|配方需 ' + rec.inp[k] + '，当前 ' + cur + '。点击放入（或先选左侧物品再点击此槽放入该物品）">' +
      '<img src="' + iconDataURL(k) + '"><span class="mch-io-n">' + cur + '/' + rec.inp[k] + '</span></div>';
  }
  h += '</div></div>';
  // 进度条
  h += '<div class="mch-prog"><div class="bar"><i></i></div><div class="bar-time"></div><div class="status"></div></div>';
  // 产品区
  h += '<div class="mch-side mch-out"><div class="mch-side-title">产品</div><div class="mch-out-row" data-live="mch-out">';
  if (rec.out) {
    for (const k in rec.out) {
      const cur = e.outp[k] || 0;
      h += '<div class="mch-io-slot" data-action="take-slot" data-id="' + k + '" data-tip="' + ITEMS[k].name + '|点击取回 1 件（当前 ' + cur + '）">' +
        '<img src="' + iconDataURL(k) + '"><span class="mch-io-n">' + cur + '</span></div>';
    }
  } else if (rec.prob) {
    for (const k in rec.prob) {
      const cur = e.outp[k] || 0;
      h += '<div class="mch-io-slot" data-action="take-slot" data-id="' + k + '" data-tip="' + ITEMS[k].name + '|概率产出（' + Math.round(rec.prob[k] * 10000) / 100 + '%），点击取回（当前 ' + cur + '）">' +
        '<img src="' + iconDataURL(k) + '"><span class="mch-io-n">' + cur + '</span></div>';
    }
  }
  h += '</div></div>';
  h += '</div>';
  // 操作说明
  h += '<div class="dim mch-help">左栏为你的背包：点击物品选中并显示放置幽灵；先选中背包物品再点击右侧「原料」槽即可把该物品放入设备；点击「产品」图标可把产物取回背包。原料/产品均可通过传送带与机械臂自动进出。</div>';
  // 电力状态与速率
  if (typeof e.powerDemand === 'function') h += row('电力', powerStatusLiveHtml(e), 'power');
  h += machRateHtml(rec, e.crafting && typeof e.moduleSpeedMult === 'function' ? e.moduleSpeedMult() : 1);
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
