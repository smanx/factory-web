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

// 材料页静态网格缓存：建造设备 / 物流请求 / 垃圾桶的物品按钮列表结构完全静态
// （物品集合不变，仅请求/丢弃标记与持有数量动态变化）。首次构建后缓存复用，
// 打开背包时只按标记与数量轻量拼接，避免每次重建数百个含 base64 图标的按钮节点。
let _matGridCache = { lreqItems: null, trashItems: null };
// 材料页可选物品集合（排除流体与测试设备）
function staticItemIdList() {
  return Object.keys(ITEMS).filter(id => {
    if (FLUIDS.indexOf(id) >= 0) return false;
    if (id.indexOf('creative-') === 0 || id.indexOf('void-') === 0) return false;
    return true;
  });
}

function iconDataURL(id) {
  let u = URL_CACHE[id];
  if (!u) {
    u = iconCanvas(id, 34).toDataURL();
    URL_CACHE[id] = u;
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
  const key = id + '_' + size;
  if (ICON_CACHE[key]) return ICON_CACHE[key];
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const it = ITEMS[id];
  x.fillStyle = '#20242b';
  rr(x, 1, 1, size - 2, size - 2, 6);
  x.fill();
  x.strokeStyle = it.color;
  x.lineWidth = 2;
  x.stroke();
  x.fillStyle = it.color;
  drawItemGlyph(x, id, size / 2, size / 2, size * 0.72);
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
      const ic = iconCanvas(id).cloneNode();
      ic.getContext('2d').drawImage(iconCanvas(id), 0, 0);
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
  // 选择快捷栏物品建造时退出触屏拆除模式，避免左键行为冲突
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
  document.getElementById('panel').classList.toggle('machine-wide', mode === 'machine' && !!ent && isRecipeDevice(ent));
  // 配方选择面板：网格区可滚动，底部「确认」按钮行固定在面板底部不随之滚动
  document.getElementById('panel').classList.toggle('recipe-wide', mode === 'machinerecipe');
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
    title.textContent = '背包与手工制造';
    const keepFocusId = document.activeElement &&
      (document.activeElement.id === 'inv-recipe-search' || document.activeElement.id === 'inv-item-search') ?
      document.activeElement.id : null;
    // 背包三列布局：左=玩家背包物品，中=物流区域，右=制作区域。
    // 弹框改为屏幕中间显示（见 #panel.inv-wide 样式），三列纵向分区。
    // 制作区（右列）含数百条配方，生成较重，首次生成后缓存复用；其动态数量由
    // updateInvLive 每帧轻量刷新，物品/科技变化时 _invalidateInvCache() 清缓存强制重建。
    if (!_invTabCache['craft']) _invTabCache['craft'] = htmlCraft();
    const craftHtml = _invTabCache['craft'];
    // 玩家物品区（左列）与物流区（中列）含交互变更区块，不随 updateInvLive 刷新，
    // 每次打开都重新生成以保证状态准确（体积远小于合成页，成本可控）。
    const matHtml = htmlInventory();
    const logiHtml = htmlLogistics();
    body.innerHTML =
      '<div class="inv-layout">' +
        '<div class="inv-col inv-col-left" id="inv-col-left">' +
          '<div class="inv-col-head">🎒 玩家背包</div>' +
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
    if (typeof fillLogiReqGrid === 'function') fillLogiReqGrid(G.lreqQ || '');
    if (typeof fillTrashGrid === 'function') fillTrashGrid(G.trashQ || '');
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
    } else {
      // 普通设备：设备专属内容 + 底部通用操作区（旋转/水平翻转/垂直翻转/拆除）
      const canRot = postPlaceRotatable(G.panelEnt.type);
      body.innerHTML = htmlMachine(G.panelEnt) +
        '<div class="sec">操作</div>' +
        '<div class="panel-op-row">' +
          (canRot ? '<button data-action="panel-rotate" class="panel-op-btn" title="顺时针旋转 90°（R）">⟳ 旋转</button>' : '') +
          (canRot ? '<button data-action="panel-flip-h" class="panel-op-btn" title="水平翻转（H）">⇋ 水平翻转</button>' : '') +
          (canRot ? '<button data-action="panel-flip-v" class="panel-op-btn" title="垂直翻转（V）">⇵ 垂直翻转</button>' : '') +
        '</div>' +
        '<button data-action="panel-deconstruct" class="deconstruct-btn-inline">✖ 拆除该建筑</button>';
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
  // 拥有的物品 chips：<span class="chip" data-itemid="ID"><img>名称 ×N</span>
  // 数量为0的物品隐藏；有搜索词时按名称/ID 匹配过滤
  body.querySelectorAll('#inv-items .chip[data-itemid]').forEach(el => {
    const id = el.dataset.itemid;
    if (!id || !ITEMS[id]) return;
    const n = invCount(id);
    const img = el.querySelector('img');
    if (!img) return;
    const q = (G.invItemQ || '').trim().toLowerCase();
    const hit = !q || (el.dataset.itemsearch || '').includes(q);
    el.style.display = (n > 0 && hit) ? '' : 'none';
    // 若数量为0，同时隐藏紧随其后的投掷/食用按钮（手雷/生鱼等）
    if (n <= 0) {
      const nxt = el.nextElementSibling;
      if (nxt && nxt.classList && nxt.classList.contains('usebtn')) nxt.style.display = 'none';
    }
    el.textContent = '';
    el.appendChild(img);
    el.appendChild(document.createTextNode(n > 0 ? ' ×' + n : '')); // 背包物品仅显示图标（名称悬浮显示）
  });
  // 手搓配方原料可用性：<span class="ing" data-itemid="K" data-need="N">...名称 have/N</span>
  body.querySelectorAll('#inv-recipes .ing[data-itemid][data-need]').forEach(el => {
    const id = el.dataset.itemid;
    const need = +el.dataset.need || 0;
    if (!id || !ITEMS[id]) return;
    const have = invCount(id);
    el.classList.toggle('lack', have < need);
    const img = el.querySelector('img');
    if (!img) return;
    el.textContent = '';
    el.appendChild(img);
    el.appendChild(document.createTextNode(ITEMS[id].name + ' ' + have + '/' + need));
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

function htmlInventory() {
  let h = '<div class="sec">护甲</div><div class="armor-row">';
  // 当前穿戴护甲展示与脱卸
  h += '<div class="armor-slot' + (G.armor ? ' equipped' : '') + '" data-tip="' + (G.armor ? (ITEMS[G.armor].name + '|当前穿戴的护甲，点击脱卸') : '未穿戴护甲|护甲可减少所受伤害') + '" data-armor="unequip">' +
    (G.armor ? '<img src="' + iconDataURL(G.armor) + '"><b>' + ITEMS[G.armor].name + '</b>' : '<span>🛡 未穿戴</span>') + '</div>';
  // 可装备的护甲列表（含模块化护甲）
  for (const aid of ['light-armor', 'heavy-armor', 'modular-armor', 'power-armor', 'power-armor-mk2']) {
    const n = invCount(aid);
    const equipped = G.armor === aid;
    const can = n > 0 && !equipped;
    const tip = ITEMS[aid].desc + (ARMORS[aid].grid ? '（装备网格 ' + ARMORS[aid].grid + '×' + ARMORS[aid].grid + '）' : '');
    h += '<button class="rcbtn armor-eq' + (can ? '' : ' disabled') + '" data-armor="' + aid + '"' +
      ' data-tip="' + ITEMS[aid].name + '|' + tip + '">' +
      '<img src="' + iconDataURL(aid) + '">' + ITEMS[aid].name + (equipped ? ' ✔' : (n > 0 ? ' ×' + n : '')) + '</button>';
  }
  h += '</div><div class="dim">护甲可减少所受伤害。点击下方护甲图标即可装备（需在背包中拥有），再次点击已穿戴护甲可脱卸。模块化护甲自带装备网格，可在网格中安装个人装备件。</div>';
  // 装备网格（当前穿戴的模块化护甲）
  if (G.armor && ARMORS[G.armor] && ARMORS[G.armor].grid) {
    h += '<div class="sec">装备网格（' + G.armor + ' ' + ARMORS[G.armor].grid + '×' + ARMORS[G.armor].grid + '）</div>';
    if (typeof equipGridHtml === 'function') h += equipGridHtml();
    else h += '<div class="dim">（装备网格组件未加载）</div>';
  }
  // 个人电网状态（模块化护甲时展示）
  if (G.armor && ARMORS[G.armor] && ARMORS[G.armor].grid && typeof equipPowerHtml === 'function') {
    h += equipPowerHtml();
  }
  // 个人机器人港装备（施工机器人）
  if (typeof hasPersonalRoboport === 'function') {
    const equippedPR = hasPersonalRoboport();
    const prType = G && G.personalRoboport === 'mk2' ? 'personal-roboport-mk2-equipment' : 'personal-roboport-equipment';
    const prCount = invCount('personal-roboport-equipment');
    const pr2Count = invCount('personal-roboport-mk2-equipment');
    const showType = equippedPR ? prType : (pr2Count > 0 ? 'personal-roboport-mk2-equipment' : 'personal-roboport-equipment');
    const shown = ITEMS[showType];
    const rInfo = typeof constrRoboportInfo === 'function' ? constrRoboportInfo() : null;
    h += '<div class="sec">装备（施工）</div><div class="armor-row">';
    h += '<div class="armor-slot' + (equippedPR ? ' equipped' : '') + '" data-tip="' + shown.name + '|' + shown.desc + '" data-roboport="toggle">' +
      (equippedPR ? '<img src="' + iconDataURL(prType) + '"><b>已装备</b>' : '<span>🔧 未装备</span>') + '</div>';
    // Mk1 装备按钮
    h += '<button class="rcbtn armor-eq' + (!equippedPR && prCount > 0 ? '' : ' disabled') + '" data-roboport="toggle"' +
      ' data-tip="' + ITEMS['personal-roboport-equipment'].name + '|' + ITEMS['personal-roboport-equipment'].desc + '">' +
      '<img src="' + iconDataURL('personal-roboport-equipment') + '">' + ITEMS['personal-roboport-equipment'].name + (G && G.personalRoboport === true ? ' ✔' : (prCount > 0 ? ' ×' + prCount : '')) + '</button>';
    // Mk2 装备按钮
    h += '<button class="rcbtn armor-eq' + (!equippedPR && pr2Count > 0 ? '' : ' disabled') + '" data-roboport="toggle2"' +
      ' data-tip="' + ITEMS['personal-roboport-mk2-equipment'].name + '|' + ITEMS['personal-roboport-mk2-equipment'].desc + '">' +
      '<img src="' + iconDataURL('personal-roboport-mk2-equipment') + '">' + ITEMS['personal-roboport-mk2-equipment'].name + (G && G.personalRoboport === 'mk2' ? ' ✔' : (pr2Count > 0 ? ' ×' + pr2Count : '')) + '</button>';
    h += '</div><div class="dim">装备个人机器人港 + 背包携带施工机器人后，蓝图粘贴自动生成建造幽灵、红图框选生成拆除标记，由施工机器人自动施工/拆除。' +
      (rInfo ? '当前工作范围 <b>' + rInfo.range + '</b> 格、最多 <b>' + rInfo.maxActive + '</b> 台机器人同时施工（II 型更大更强）。' : '') + '</div>';
  }
  h += '<div class="sec">拥有的物品（点击任意物品选中：设备点地图可直接建造；材料/工具鼠标显示物品幽灵。鼠标中键点底部快捷栏槽位可设置/清空；点击空槽位可直接放入选中物品且放置幽灵继续选中，Q/E 取消）</div>';
  const iq = (G.invItemQ || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  h += '<input id="inv-item-search" class="inv-search" type="text" placeholder="搜索物品（输入名称）" autocomplete="off" value="' + iq + '">';
  h += '<div class="chips" id="inv-items">';
  let any = false;
  for (const id in ITEMS) {
    const n = invCount(id);
    if (n > 0) {
      h += chip(id, n, true); // 背包物品仅显示图标，名称悬浮显示
      // 手雷/集束手雷可在背包中直接投掷（对齐《异星工厂》投掷物）
      if (id === 'grenade' || id === 'cluster-grenade') {
        h += '<button class="usebtn" data-action="use-grenade" data-type="' + id + '" title="投掷' + ITEMS[id].name + '（向当前朝向投掷，造成范围爆炸）">💣 投掷</button>';
      }
      // 生鱼可在背包中直接食用回血（对齐《异星工厂》：吃鱼治疗）
      if (id === 'raw-fish') {
        h += '<button class="usebtn" data-action="eat-fish" data-type="' + id + '" title="食用' + ITEMS[id].name + '（恢复 20 生命值）">🐟 食用</button>';
      }
      any = true;
    }
  }
  if (!any) h += '<span class="dim">空空如也，去地图上按住左键挖矿吧（铁矿/铜矿/煤/石头）</span>';
  h += '</div>';
  h += '<div class="hint">提示：开局先挖 5 个石头合成石炉，再挖煤；点击炉子打开面板，把煤和矿石放进去就能炼铁板/铜板。钢板用铁板×2 合成（石炉/电炉炼制更快）。塑料板等流体化学产物只能在化工厂生产（石油气经管道送入化工厂）。<br>选中：点击「拥有的物品」里任意物品即选中，选中后背包不自动关闭，按 E/Q 或右上角 X 关闭后选中保留。设备点地图直接建造；材料/工具鼠标显示物品放置幽灵。R 旋转、Q 取消。建造支持覆盖：目标格已有建筑时会先拆除旧建筑（返还物资）再放置新建筑，但同一格不会叠加。</div>';
  return h;
}

// 物流区域（对齐《异星工厂》Personal logistic request + Trash slots）：
// 中间区域，玩家设置物流请求量 / 标记丢弃物品，由物流机器人自动配送或带走。
function htmlLogistics() {
  let h = '<div class="sec">个人物流请求 <span class="dim">（需物流网络科技 + 机器人港）</span></div>';
  h += '<div class="logi-req" id="logi-req">';
  const lreq = G.logiRequest || {};
  const lreqKeys = Object.keys(lreq).filter(k => lreq[k] > 0);
  if (!lreqKeys.length) {
    h += '<div class="dim" id="logi-req-empty">点击下方物品设置请求量，物流机器人会自动把物品送到你身上。</div>';
  } else {
    h += '<div class="dim" id="logi-req-empty" style="display:none">点击下方物品设置请求量，物流机器人会自动把物品送到你身上。</div>';
    h += '<div class="chips">';
    for (const k of lreqKeys) {
      const have = invCount(k);
      h += '<span class="chip lreq-chip" data-itemid="' + k + '" data-tip="' + ITEMS[k].name + '|请求 ' + lreq[k] + '，已持有 ' + have + '。点击清除请求" data-lreqclear="' + k + '"><img src="' + iconDataURL(k) + '">' + ITEMS[k].name + ' ×' + lreq[k] + ' <span class="lreq-have">(' + have + ')</span> ×</span>';
    }
    h += '</div>';
  }
  h += '<div class="dim">设置请求：先点击下方物品图标选中，再输入数量并点“请求”。清除：点击上方已设置的请求项。</div>';
  h += '<input id="lreq-search" class="inv-search" type="text" placeholder="搜索物品（设置个人请求）" autocomplete="off">';
  h += '<div id="lreq-grid" class="recgrid"></div>';
  h += '</div>';
  // 个人垃圾桶（物流机器人带走标记物品存回网络）
  h += '<div class="sec">个人垃圾桶 <span class="dim">（物流机器人带走标记物品存回网络）</span></div>';
  h += '<div class="logi-req" id="logi-trash">';
  const trash = G.trashSlots || {};
  const trashKeys = Object.keys(trash).filter(k => trash[k]);
  if (!trashKeys.length) {
    h += '<div class="dim" id="logi-trash-empty">点击下方物品标记为“丢弃”，物流机器人会自动把该物品从你身上带走。用于清理不想保留的杂物（对齐《异星工厂》垃圾桶）。</div>';
  } else {
    h += '<div class="dim" id="logi-trash-empty" style="display:none">点击下方物品标记为“丢弃”，物流机器人会自动把该物品从你身上带走。</div>';
    h += '<div class="chips">';
    for (const k of trashKeys) {
      const have = invCount(k);
      h += '<span class="chip trash-chip" data-tip="' + ITEMS[k].name + '|标记为丢弃，持有 ' + have + '。点击取消" data-trashclear="' + k + '"><img src="' + iconDataURL(k) + '">' + ITEMS[k].name + ' <span class="lreq-have">(' + have + ')</span> ×</span>';
    }
    h += '</div>';
  }
  h += '<div class="dim">标记丢弃：点击下方物品图标。取消：点击上方已标记的物品。</div>';
  h += '<input id="trash-search" class="inv-search" type="text" placeholder="搜索物品（标记丢弃）" autocomplete="off">';
  h += '<div id="trash-grid" class="recgrid"></div>';
  h += '</div>';
  return h;
}

// 背包「合成页面」tab：独立渲染全部手搓/化工/炼油配方（对齐《异星工厂》手工制造）
function htmlCraft() {
  let h = '<div class="dim" style="margin-bottom:8px">在此手动制作物品（对齐《异星工厂》手工制造）。需要流体（石油气/水等）或离心机等高级工艺的配方，请使用对应机器生产。</div>';
  const q = (G.invRecipeQ || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  h += '<input id="inv-recipe-search" class="inv-search" type="text" placeholder="搜索配方（输入物品名称）" autocomplete="off" value="' + q + '">';
  h += '<div id="inv-recipes">';
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
    const unlocked = recipeUnlocked(rid);
    const lockTech = recipeLockingTech(rid);
    const rec = RECIPES[rid];
    const ok = unlocked && canCraft(rid);
    const outId = Object.keys(rec.out)[0];
    const searchKey = (ITEMS[outId].name + ' ' + outId + ' ' +
      Object.keys(rec.inp).map(k => ITEMS[k].name).join(' ') + ' ' + recipeDeviceName(rid)).toLowerCase();
    h += '<div class="recipe' + (unlocked ? '' : ' locked-recipe') + '" data-rsearch="' + searchKey.replace(/"/g, '') + '">';
    h += '<img class="ric" data-itemid="' + outId + '" data-tip="' + itemTip(outId) + '" src="' + iconDataURL(outId) + '">';
    h += '<div class="rmain"><div class="rname">' + ITEMS[Object.keys(rec.out)[0]].name +
      (rec.out[Object.keys(rec.out)[0]] > 1 ? ' ×' + rec.out[Object.keys(rec.out)[0]] : '') +
      '<span class="rdev">' + recipeDeviceName(rid) + '</span></div>';
    h += '<div class="ring">';
    for (const k in rec.inp) {
      const have = invCount(k);
      h += '<span class="ing ' + (have >= rec.inp[k] ? '' : 'lack') + '" data-itemid="' + k + '" data-need="' + rec.inp[k] + '" data-tip="' + itemTip(k) + '">' +
        '<img src="' + iconDataURL(k) + '">' + ITEMS[k].name + ' ' + have + '/' + rec.inp[k] + '</span>';
    }
    h += '</div></div>';
    if (!unlocked) {
      h += '<button disabled title="需先研究：' + TECHS[lockTech].name + '">🔒 需' + TECHS[lockTech].name + '</button>';
    } else {
      h += '<button data-action="craft" data-id="' + rid + '" ' + (ok ? '' : 'disabled') + '>合成</button>';
      if (ok) h += '<button data-action="craft" data-mult="5" data-id="' + rid + '">×5</button>';
    }
    h += '</div>';
  }
  // 化工厂配方
  for (const rid of CHEM_RECIPES) {
    const unlocked = recipeUnlocked(rid);
    const lockTech = recipeLockingTech(rid);
    const rec = RECIPES[rid];
    const outId = Object.keys(rec.out)[0];
    const searchKey = (ITEMS[outId].name + ' ' + outId + ' ' +
      Object.keys(rec.inp).map(k => ITEMS[k].name).join(' ') + ' 化工厂').toLowerCase();
    h += '<div class="recipe chem' + (unlocked ? '' : ' locked-recipe') + '" data-rsearch="' + searchKey.replace(/"/g, '') + '">';
    h += '<img class="ric" data-itemid="' + outId + '" data-tip="' + itemTip(outId) + '" src="' + iconDataURL(outId) + '">';
    h += '<div class="rmain"><div class="rname">' + ITEMS[outId].name +
      (rec.out[outId] > 1 ? ' ×' + rec.out[outId] : '') + '<span class="rdev">化工厂</span></div>';
    h += '<div class="ring">';
    for (const k in rec.inp) {
      h += '<span class="ing" data-itemid="' + k + '" data-tip="' + itemTip(k) + '">' +
        '<img src="' + iconDataURL(k) + '">' + ITEMS[k].name + ' ' + rec.inp[k] + '</span>';
    }
    h += '</div></div>';
    h += unlocked ? '<span class="rdev-note">需化工厂</span>' : '<span class="rdev-note lock-tag">🔒 需' + TECHS[lockTech].name + '</span>';
    h += '</div>';
  }
  // 炼油厂配方
  for (const rid of REFINERY_RECIPE_IDS) {
    const unlocked = recipeUnlocked(rid);
    const lockTech = recipeLockingTech(rid);
    const rec = REFINERY_RECIPES[rid];
    const outId = Object.keys(rec.out)[0];
    const searchKey = (rec.name + ' ' + Object.keys(rec.inp).map(k => ITEMS[k].name).join(' ') +
      ' ' + Object.keys(rec.out).map(k => ITEMS[k].name).join(' ') + ' 炼油厂').toLowerCase();
    h += '<div class="recipe chem' + (unlocked ? '' : ' locked-recipe') + '" data-rsearch="' + searchKey.replace(/"/g, '') + '">';
    h += '<img class="ric" data-itemid="' + outId + '" data-tip="' + itemTip(outId) + '" src="' + iconDataURL(outId) + '">';
    h += '<div class="rmain"><div class="rname">' + rec.name + '<span class="rdev">炼油厂</span></div>';
    h += '<div class="ring">';
    for (const k in rec.inp) {
      h += '<span class="ing" data-itemid="' + k + '" data-tip="' + itemTip(k) + '">' +
        '<img src="' + iconDataURL(k) + '">' + ITEMS[k].name + ' ' + rec.inp[k] + '</span>';
    }
    h += '<span class="ing arrow">→</span>';
    for (const k in rec.out) {
      h += '<span class="ing" data-itemid="' + k + '" data-tip="' + itemTip(k) + '">' +
        '<img src="' + iconDataURL(k) + '">' + ITEMS[k].name + ' ' + rec.out[k] + '</span>';
    }
    h += '</div></div>';
    h += unlocked ? '<span class="rdev-note">需炼油厂</span>' : '<span class="rdev-note lock-tag">🔒 需' + TECHS[lockTech].name + '</span>';
    h += '</div>';
  }
  h += '</div>';
  h += '<div class="dim" id="inv-recipe-empty" style="display:none"></div>';
  return h;
}

function applyInvRecipeFilter(q) {
  const body = document.getElementById('panel-body');
  if (!body) return;
  const ql = (q || '').trim().toLowerCase();
  let shown = 0;
  body.querySelectorAll('#inv-recipes .recipe').forEach(el => {
    const hit = !ql || el.dataset.rsearch.includes(ql);
    el.style.display = hit ? '' : 'none';
    if (hit) shown++;
  });
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
  body.querySelectorAll('#inv-items .chip[data-itemid]').forEach(el => {
    const hit = !ql || (el.dataset.itemsearch || '').includes(ql);
    el.style.display = hit ? '' : 'none';
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

// 个人物流请求：填充可选物品网格并过滤
// 性能优化：物品集合静态，按钮基础 HTML（图标/名称/tooltip）首次构建后缓存复用，
// 打开时仅按「请求量」动态拼接标记，避免每次打开都重建数百个含 base64 图标的按钮。
function fillLogiReqGrid(q) {
  const grid = document.getElementById('lreq-grid');
  if (!grid) return;
  const ql = (q || '').trim().toLowerCase();
  if (!_matGridCache.lreqItems) {
    _matGridCache.lreqItems = staticItemIdList().map(id => ({
      id,
      key: (ITEMS[id].name + ' ' + id).toLowerCase(),
      tip: itemTip(id),
      img: '<img src="' + iconDataURL(id) + '">'
    }));
  }
  let h = '';
  for (const b of _matGridCache.lreqItems) {
    if (ql && b.key.indexOf(ql) < 0) continue;
    const req = (G.logiRequest && G.logiRequest[b.id]) || 0;
    h += '<button class="rcbtn' + (req > 0 ? ' lreq-on' : '') + '" data-lreqitem="' + b.id + '" data-tip="' + b.tip + (req > 0 ? '（已请求 ' + req + '）' : '') + '">' +
      b.img + ITEMS[b.id].name + (req > 0 ? ' ✓' + req : '') + '</button>';
  }
  grid.innerHTML = h || '<div class="dim">没有匹配的物品</div>';
}

// 个人垃圾桶：填充可选物品网格并过滤（对齐《异星工厂》Trash slots）
// 性能优化：与物流请求网格相同，物品按钮基础 HTML 缓存复用，打开时仅按
// 「丢弃标记 / 持有数量」动态拼接，避免每次重建数百个按钮节点。
function fillTrashGrid(q) {
  const grid = document.getElementById('trash-grid');
  if (!grid) return;
  const ql = (q || '').trim().toLowerCase();
  if (!_matGridCache.trashItems) {
    _matGridCache.trashItems = staticItemIdList().map(id => ({
      id,
      key: (ITEMS[id].name + ' ' + id).toLowerCase(),
      tip: itemTip(id),
      img: '<img src="' + iconDataURL(id) + '">'
    }));
  }
  let h = '';
  for (const b of _matGridCache.trashItems) {
    if (ql && b.key.indexOf(ql) < 0) continue;
    const on = (G.trashSlots && G.trashSlots[b.id]) ? true : false;
    const have = invCount(b.id);
    h += '<button class="rcbtn' + (on ? ' lreq-on trash-on' : '') + '" data-trashitem="' + b.id + '" data-tip="' + b.tip + (on ? '（已标记丢弃）' : '') + (have > 0 ? '（持有 ' + have + '）' : '') + '">' +
      b.img + ITEMS[b.id].name + (on ? ' 🗑' : '') + (have > 0 ? ' <span class="lreq-have">(' + have + ')</span>' : '') + '</button>';
  }
  grid.innerHTML = h || '<div class="dim">没有匹配的物品</div>';
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
    '<div class="inv-col inv-col-left" id="inv-col-left"><div class="inv-col-head">🎒 玩家背包</div>' +
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

