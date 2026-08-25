'use strict';

let uiDirty = true;

const ICON_CACHE = {};
const URL_CACHE = {};

function iconDataURL(id) {
  let u = URL_CACHE[id];
  if (!u) {
    u = iconCanvas(id, 34).toDataURL();
    URL_CACHE[id] = u;
  }
  return u;
}

// 物品悬浮提示：名称|描述（含物品堆叠上限，对齐《异星工厂》stack_size）
function itemTip(id, extra) {
  const it = ITEMS[id];
  const stack = (typeof stackSize === 'function') ? stackSize(id) : 100;
  let t = it.name + '|' + it.desc + (stack ? '（最大堆叠 ' + stack + '）' : '');
  if (extra) t += (extra[0] === '|' ? '' : '|') + extra;
  // 可合成物品：在 tooltip 末尾追加合成配方（需求：建造物品悬停显示配方）
  const recipe = itemRecipeText(id);
  if (recipe) t += '||' + recipe;
  return t;
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
    else slot.dataset.tip = '空槽位|打开背包(E)，在快捷栏编辑器里点选槽位后点击任意物品即可放入';
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
    slot.addEventListener('click', () => selectSlot(i));
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
    const slot = document.getElementById('hotbar').children[i];
    slot.classList.toggle('active', G.sel === i);
    slot.classList.toggle('empty', !!id && !infinite && invCount(id) <= 0);
  });
}

function selectSlot(i) {
  // 选择快捷栏物品建造时退出触屏拆除模式，避免左键行为冲突
  if (G.deconstructMode) toggleDeconstructMode(false);
  const prev = G.sel >= 0 ? (HOTBAR[G.sel] || null) : null;
  G.sel = (G.sel === i ? -1 : i);
  G.quickSel = null;
  // 选择武器：若该槽位是武器，则作为当前手持武器
  if (G.sel >= 0 && HOTBAR[G.sel]) setWeapon(HOTBAR[G.sel]);
  else if (G.sel < 0) setWeapon(null);
  // 规划器（拆除/升级）选中：进入对应红图/绿图框选模式（对齐《异星工厂》Planner）
  if (typeof toggleBlueprint === 'function') {
    const cur = G.sel >= 0 ? (HOTBAR[G.sel] || null) : null;
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
  G.panelMode = mode;
  G.panelEnt = ent || null;
  document.getElementById('panel').style.display = 'flex';
  renderPanel(true);
}

function closePanel(hide = true) {
  G.panelMode = null;
  G.panelEnt = null;
  G.invRecipeQ = '';
  if (hide) document.getElementById('panel').style.display = 'none';
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
      (document.activeElement.id === 'inv-recipe-search' || document.activeElement.id === 'build-dev-search') ?
      document.activeElement.id : null;
    // 背包两个 tab：默认「材料」、以及「合成」（手搓配方）
    const invTab = G.invTab === 'craft' ? 'craft' : 'materials';
    const tabBtn = t => '<button class="inv-tab' + (invTab === t ? ' active' : '') + '" data-inv-tab="' + t + '">' +
      (t === 'craft' ? '🛠 合成' : '🎒 材料') + '</button>';
    body.innerHTML = '<div class="inv-tabs">' + tabBtn('materials') + tabBtn('craft') + '</div>' +
      '<div id="inv-tab-materials"' + (invTab === 'materials' ? '' : ' style="display:none"') + '>' + htmlInventory() + '</div>' +
      '<div id="inv-tab-craft"' + (invTab === 'craft' ? '' : ' style="display:none"') + '>' + htmlCraft() + '</div>';
    applyInvRecipeFilter(G.invRecipeQ);
    applyBuildSearch(G.buildDevQ);
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
  } else if (G.panelMode === 'machine' && G.panelEnt) {
    title.textContent = ITEMS[G.panelEnt.type].name;
    // 机器面板：设备专属内容 + 底部通用操作区（旋转/水平翻转/垂直翻转/拆除，PC/手机端均可点击操作当前建筑）
    body.innerHTML = htmlMachine(G.panelEnt) +
      '<div class="sec">操作</div>' +
      '<div class="panel-op-row">' +
        '<button data-action="panel-rotate" class="panel-op-btn" title="顺时针旋转 90°（R）">⟳ 旋转</button>' +
        '<button data-action="panel-flip-h" class="panel-op-btn" title="水平翻转（H）">⇋ 水平翻转</button>' +
        '<button data-action="panel-flip-v" class="panel-op-btn" title="垂直翻转（V）">⇵ 垂直翻转</button>' +
      '</div>' +
      '<button data-action="panel-deconstruct" class="deconstruct-btn-inline">✖ 拆除该建筑</button>';
  }
  if (G.panelMode !== 'set') body.scrollTop = st;
}

function updateMachineLive() {
  if (G.panelMode !== 'machine' || !G.panelEnt) return;
  const e = G.panelEnt;
  if (!G.ents.includes(e)) { closePanel(); return; }
  const body = document.getElementById('panel-body');
  let prog = 0, status = '', state = 'warn';
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
    prog: v => { prog = v; },
    // status(text, kind)：kind 取 'ok'(工作)/'warn'(暂停·需留意)/'bad'(故障)，用于区分颜色
    status: (s, k) => { status = s; if (k) state = k; }
  };
  const panel = DEVICE_PANEL[e.type];
  if (panel && panel.live) panel.live(e, api);
  const bar = body.querySelector('.bar i');
  if (bar) bar.style.width = Math.max(0, Math.min(100, prog)) + '%';
  const stEl = body.querySelector('.status');
  if (stEl && status) {
    if (stEl.textContent !== status) stEl.textContent = status;
    const wantCls = 'status ' + (state || 'warn');
    if (stEl.className !== wantCls) stEl.className = wantCls;
  }
}

function chip(id, n) {
  return '<span class="chip" data-itemid="' + id + '" data-tip="' + itemTip(id) + '"><img src="' + iconDataURL(id) + '">' +
    ITEMS[id].name + (n !== undefined ? ' ×' + n : '') + '</span>';
}

function htmlInventory() {
  let h = '<div class="sec">快捷栏编辑</div><div class="hbedit" id="hbedit">';
  for (let i = 0; i < 10; i++) {
    const id = HOTBAR[i];
    h += '<div class="hbslot ' + (G.hbArm === i ? 'arm' : '') + '" data-hbedit="' + i + '" data-tip="' +
      (id ? '槽位' + (i === 9 ? 0 : i + 1) + '：' + ITEMS[id].name + '|点击两次清空；或先点这里再点下方物品替换' : '空槽位' + (i === 9 ? 0 : i + 1) + '|点击选中后，再点下方任意物品放入') + '">' +
      (id ? '<img src="' + iconDataURL(id) + '">' : '<span>空</span>') + '</div>';
  }
  h += '</div><div class="dim">点一个槽位选中（黄框），再点击下面任意物品图标即可放入该槽位；再点一次同槽位清空。数字键 1-9/0 切换。</div>';
  h += '<div class="sec">建造设备（点击直接选中放置）</div>';
  const bdq = (G.buildDevQ || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  h += '<input id="build-dev-search" class="inv-search" type="text" placeholder="搜索建造设备（输入名称）" autocomplete="off" value="' + bdq + '">';
  h += '<div class="recgrid" id="build-dev-grid">';
  const infinite = !!(G.dbg && G.dbg.infinite);
  // 测试/应急设备（被动供电、创造/虚空箱、创造/虚空管道）仅在开启"无限资源"
  // Debug 模式后才会出现在建造列表；正常游玩不可见、不可获取。
  const dbgOnlyDevices = new Set(['passive-power', 'creative-chest', 'void-chest', 'creative-pipe', 'void-pipe', 'creative-belt', 'void-belt']);
  for (const bid of Object.keys(BUILD_DEFS)) {
    if (dbgOnlyDevices.has(bid) && !infinite) continue;
    const n = invCount(bid);
    const canBuild = infinite || n > 0;
    const bsearch = (ITEMS[bid].name + ' ' + bid).toLowerCase();
    h += '<button class="rcbtn buildbtn"' + (canBuild ? '' : ' disabled style="opacity:.45"') +
      ' data-itemid="' + bid + '" data-buildsearch="' + bsearch.replace(/"/g, '') + '" data-tip="' + itemTip(bid) + '">' +
      '<img src="' + iconDataURL(bid) + '">' + ITEMS[bid].name + (n > 0 ? ' ×' + n : (infinite ? ' ∞' : '')) + '</button>';
  }
  h += '</div>';
  h += '<div class="dim" id="build-dev-empty" style="display:none"></div>';
  h += '<div class="sec">护甲</div><div class="armor-row">';
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
    const prType = G && G.personalRoboport === 'mk2' ? 'personal-roboport-mk2' : 'personal-roboport';
    const prCount = invCount('personal-roboport');
    const pr2Count = invCount('personal-roboport-mk2');
    const showType = equippedPR ? prType : (pr2Count > 0 ? 'personal-roboport-mk2' : 'personal-roboport');
    const shown = ITEMS[showType];
    const rInfo = typeof constrRoboportInfo === 'function' ? constrRoboportInfo() : null;
    h += '<div class="sec">装备（施工）</div><div class="armor-row">';
    h += '<div class="armor-slot' + (equippedPR ? ' equipped' : '') + '" data-tip="' + shown.name + '|' + shown.desc + '" data-roboport="toggle">' +
      (equippedPR ? '<img src="' + iconDataURL(prType) + '"><b>已装备</b>' : '<span>🔧 未装备</span>') + '</div>';
    // Mk1 装备按钮
    h += '<button class="rcbtn armor-eq' + (!equippedPR && prCount > 0 ? '' : ' disabled') + '" data-roboport="toggle"' +
      ' data-tip="' + ITEMS['personal-roboport'].name + '|' + ITEMS['personal-roboport'].desc + '">' +
      '<img src="' + iconDataURL('personal-roboport') + '">' + ITEMS['personal-roboport'].name + (G && G.personalRoboport === true ? ' ✔' : (prCount > 0 ? ' ×' + prCount : '')) + '</button>';
    // Mk2 装备按钮
    h += '<button class="rcbtn armor-eq' + (!equippedPR && pr2Count > 0 ? '' : ' disabled') + '" data-roboport="toggle2"' +
      ' data-tip="' + ITEMS['personal-roboport-mk2'].name + '|' + ITEMS['personal-roboport-mk2'].desc + '">' +
      '<img src="' + iconDataURL('personal-roboport-mk2') + '">' + ITEMS['personal-roboport-mk2'].name + (G && G.personalRoboport === 'mk2' ? ' ✔' : (pr2Count > 0 ? ' ×' + pr2Count : '')) + '</button>';
    h += '</div><div class="dim">装备个人机器人港 + 背包携带施工机器人后，蓝图粘贴自动生成建造幽灵、红图框选生成拆除标记，由施工机器人自动施工/拆除。' +
      (rInfo ? '当前工作范围 <b>' + rInfo.range + '</b> 格、最多 <b>' + rInfo.maxActive + '</b> 台机器人同时施工（II 型更大更强）。' : '') + '</div>';
  }
  h += '<div class="sec">材料</div><div class="chips">';
  let any = false;
  for (const id in ITEMS) {
    const n = invCount(id);
    if (n > 0) {
      h += chip(id, n);
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
  // ===== 个人物流请求（对齐《异星工厂》Personal logistic request）=====
  // 玩家设置请求量后，物流机器人会自动送达（需已研究物流网络且在物流网络范围内）；
  // 若玩家身上有超出请求量的物品，机器人也会将其带走存回网络。
  h += '<div class="sec">个人物流请求 <span class="dim">（需物流网络科技 + 机器人港）</span></div>';
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
  // ===== 个人垃圾桶（对齐《异星工厂》Trash slots）=====
  // 玩家标记要“丢弃”的物品后，物流机器人会把这些物品全部带走存回网络（不受请求量影响）。
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
  h += '<div class="hint">提示：开局先挖 5 个石头合成石炉，再挖煤；点击炉子打开面板，把煤和矿石放进去就能炼铁板/铜板。钢板用铁板×2 合成（石炉/电炉炼制更快）。塑料板等流体化学产物只能在化工厂生产（石油气经管道送入化工厂）。<br>建造：直接点击上方材料区里任何可建造的设备图标即可选中进入放置模式（优先占用空快捷栏槽位），不必依赖底部工具栏；R 旋转、Q 取消。建造支持覆盖：目标格已有建筑时会先拆除旧建筑（返还物资）再放置新建筑，但同一格不会叠加。</div>';
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
    const _r = RECIPES[rid];
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
      h += '<span class="ing ' + (have >= rec.inp[k] ? '' : 'lack') + '" data-itemid="' + k + '" data-tip="' + itemTip(k) + '">' +
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
function applyBuildSearch(q) {
  const body = document.getElementById('panel-body');
  if (!body) return;
  const ql = (q || '').trim().toLowerCase();
  let shown = 0;
  body.querySelectorAll('#build-dev-grid .buildbtn').forEach(el => {
    const hit = !ql || el.dataset.buildsearch.includes(ql);
    el.style.display = hit ? '' : 'none';
    if (hit) shown++;
  });
  const emp = document.getElementById('build-dev-empty');
  if (emp) {
    emp.textContent = ql ? '没有匹配「' + q.trim() + '」的建造设备' : '没有匹配的建造设备';
    emp.style.display = shown ? 'none' : '';
  }
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
function fillLogiReqGrid(q) {
  const grid = document.getElementById('lreq-grid');
  if (!grid) return;
  const ql = (q || '').trim().toLowerCase();
  const ids = Object.keys(ITEMS).filter(id => {
    // 排除流体与测试设备；仅列出可作为物品请求的内容
    if (FLUIDS.indexOf(id) >= 0) return false;
    if (id.indexOf('creative-') === 0 || id.indexOf('void-') === 0) return false;
    if (id === 'passive-power') return false;
    return true;
  });
  let h = '';
  for (const id of ids) {
    if (ql && !(ITEMS[id].name + ' ' + id).toLowerCase().includes(ql)) continue;
    const req = (G.logiRequest && G.logiRequest[id]) || 0;
    h += '<button class="rcbtn' + (req > 0 ? ' lreq-on' : '') + '" data-lreqitem="' + id + '" data-tip="' + itemTip(id) + (req > 0 ? '（已请求 ' + req + '）' : '') + '">' +
      '<img src="' + iconDataURL(id) + '">' + ITEMS[id].name + (req > 0 ? ' ✓' + req : '') + '</button>';
  }
  grid.innerHTML = h;
  if (!h) {
    grid.innerHTML = '<div class="dim">没有匹配的物品</div>';
  }
}

// 个人垃圾桶：填充可选物品网格并过滤（对齐《异星工厂》Trash slots）
function fillTrashGrid(q) {
  const grid = document.getElementById('trash-grid');
  if (!grid) return;
  const ql = (q || '').trim().toLowerCase();
  const ids = Object.keys(ITEMS).filter(id => {
    if (FLUIDS.indexOf(id) >= 0) return false;
    if (id.indexOf('creative-') === 0 || id.indexOf('void-') === 0) return false;
    if (id === 'passive-power') return false;
    return true;
  });
  let h = '';
  for (const id of ids) {
    if (ql && !(ITEMS[id].name + ' ' + id).toLowerCase().includes(ql)) continue;
    const on = (G.trashSlots && G.trashSlots[id]) ? true : false;
    const have = invCount(id);
    h += '<button class="rcbtn' + (on ? ' lreq-on trash-on' : '') + '" data-trashitem="' + id + '" data-tip="' + itemTip(id) + (on ? '（已标记丢弃）' : '') + (have > 0 ? '（持有 ' + have + '）' : '') + '">' +
      '<img src="' + iconDataURL(id) + '">' + ITEMS[id].name + (on ? ' 🗑' : '') + (have > 0 ? ' <span class="lreq-have">(' + have + ')</span>' : '') + '</button>';
  }
  grid.innerHTML = h;
  if (!h) {
    grid.innerHTML = '<div class="dim">没有匹配的物品</div>';
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

function htmlTech() {
  let h = '';
  // 研究队列展示（对齐《异星工厂》Research queue）
  if (G.techQueue && G.techQueue.length) {
    h += '<div class="sec">研究队列（' + G.techQueue.length + ' 项）</div><div class="chips">';
    G.techQueue.forEach((qid, i) => {
      h += '<span class="chip' + (i === 0 ? ' chip-active' : '') + '" title="' + (i === 0 ? '正在研究' : '排队中') + '：' + (TECHS[qid] ? TECHS[qid].name : qid) + '">' +
        (i === 0 ? '▶ ' : (i + 1) + '. ') + (TECHS[qid] ? TECHS[qid].name : qid) +
        (i === 0 ? ' <button class="chip-x" data-action="tech-cancel" data-id="' + qid + '">✕</button>' : '') + '</span>';
    });
    h += '</div>';
  }
  for (const tid in TECHS) {
    const t = TECHS[tid];
    const done = G.techDone[tid];
    const locked = !done && techLocked(tid);
    const missing = techMissingPrereqs(tid);
    const prog = G.techProg[tid] || 0;
    const total = techCostTotal(tid);
    const costChips = [];
    for (const pk in t.cost) costChips.push(ITEMS[pk].name + '×' + t.cost[pk]);
    h += '<div class="recipe tech ' + (done ? 'done' : '') + (locked ? ' locked' : '') + '">';
    h += '<div class="rmain"><div class="rname">' + t.name + (locked ? ' <span class="lock-tag">🔒</span>' : '') + '</div><div class="dim">' + t.desc + '</div>';
    if (isInfiniteTech(tid)) {
      // 无限科技：进度无限，永不完成，消耗任意科学包
      h += '<div class="bar"><i style="width:100%"></i></div>';
      h += '<div class="dim">' + (done ? '已完成' :
        '无限研究 · 已消耗 ' + prog + ' 瓶 · 消耗任意科学包') + '</div>';
    } else {
      h += '<div class="bar"><i style="width:' + Math.min(100, prog / total * 100) + '%"></i></div>';
      h += '<div class="dim">' + (done ? '已完成' :
        prog + ' / ' + total + '（' + costChips.join(' + ') + '）') + '</div>';
    }
    h += '</div>';
    // 按钮作为 .recipe 的直接子元素（在 .rmain 外部），配合 .recipe 的 space-between 布局将其置于最右侧
    if (!done && !isInfiniteTech(tid)) {
      if (locked) {
        h += '<button disabled title="需先研究：' + missing.map(m => TECHS[m].name).join('、') + '">需先研究 ' + missing.map(m => TECHS[m].name).join('+') + '</button>';
      } else {
        const inQueue = !!(G.techQueue && G.techQueue.indexOf(tid) >= 0);
        h += (G.activeTech === tid)
          ? '<button data-action="tech-cancel" data-id="' + tid + '">取消</button>'
          : (inQueue ? '<button disabled>排队中</button>' : '<button data-action="tech" data-id="' + tid + '">研究</button>');
      }
    } else if (isInfiniteTech(tid)) {
      // 无限科技始终可选（重复研究也继续，永不完成）
      const inQueue = !!(G.techQueue && G.techQueue.indexOf(tid) >= 0);
      h += (G.activeTech === tid)
        ? '<button data-action="tech-cancel" data-id="' + tid + '">停止</button>'
        : (inQueue ? '<button disabled>排队中</button>' : '<button data-action="tech" data-id="' + tid + '">研究</button>');
    }
    // 关闭 .recipe.tech 条目，保证各科技条目平级而非互相嵌套
    h += '</div>';
  }
  h += '<div class="hint">建造研究中心，放入科学包后选择课题；研究中心按配方顺序逐瓶消耗（红→绿→蓝→灰）。机械臂可自动喂包。自动化科学包（红）=齿轮+铜板；物流科学包（绿）=传送带+机械臂；化工科学包（蓝）=塑料+电路板+铜板（需打通石油链）；军事科学包（灰）=弹药匣+石墙+穿甲弹（解锁极速物流与军事工程）。「无限科技」为无限研究：只要中心里有任意科学包就会被持续消耗、永不完成。</div>';
  return h;
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

function initPanelEvents() {
  document.getElementById('panel-body').addEventListener('change', ev => {
    // 设备专属输入（如储物箱存量上限）优先交给设备自己的 onChange
    const panel = G.panelEnt && DEVICE_PANEL[G.panelEnt.type];
    if (panel && panel.onChange && panel.onChange(ev)) return;
    // 车头调度“等待条件”下拉 / 秒数输入：与 click 分发一致，直接交给设备 onAction
    const condCtrl = ev.target.closest && ev.target.closest('[data-act="sch-cond"], [data-act="sch-time"]');
    if (condCtrl && panel && panel.onAction) {
      const act = condCtrl.dataset.act;
      panel.onAction(act, condCtrl);
      return;
    }
    // 车厢槽位过滤下拉（货运车厢）：交给设备 onAction 写入过滤槽
    const wfSel = ev.target.closest && ev.target.closest('select.wf-sel');
    if (wfSel && panel && panel.onAction) {
      panel.onAction('wf-set', wfSel);
      return;
    }
    // 历史页物品选择（datalist 下拉选中）
    const histFilter = ev.target.closest('[data-stat-hist-filter]');
    if (histFilter) {
      statsHistPickFiltered();
      return;
    }
    if (ev.target.id !== 'imp-file') return;
    const f = ev.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => importSaveText(rd.result);
    rd.onerror = () => toast('读取文件失败');
    rd.readAsText(f);
  });
  document.getElementById('panel-close').addEventListener('click', () => closePanel());
  document.getElementById('panel-body').addEventListener('input', ev => {
    if (ev.target.id === 'inv-recipe-search') {
      G.invRecipeQ = ev.target.value;
      applyInvRecipeFilter(G.invRecipeQ);
    } else if (ev.target.id === 'build-dev-search') {
      G.buildDevQ = ev.target.value;
      applyBuildSearch(G.buildDevQ);
    } else if (ev.target.id === 'lreq-search') {
      G.lreqQ = ev.target.value;
      if (typeof fillLogiReqGrid === 'function') fillLogiReqGrid(G.lreqQ);
    } else if (ev.target.id === 'trash-search') {
      G.trashQ = ev.target.value;
      if (typeof fillTrashGrid === 'function') fillTrashGrid(G.trashQ);
    } else if (ev.target.id === 'asm-recipe-search') {
      applyAssemblerRecipeFilter(ev.target.value);
    } else if (ev.target.id === 'sflt-search') {
      applySplitterFilterSearch(ev.target.value);
    } else if (ev.target.id === 'flt-search') {
      applyInserterFilterSearch(ev.target.value);
    } else if (ev.target.matches && ev.target.matches('[data-stat-hist-filter]')) {
      applyStatsHistFilter(ev.target.value);
    }
  });
  document.getElementById('panel-body').addEventListener('keydown', ev => {
    if (ev.target.matches && ev.target.matches('[data-stat-hist-filter]') && ev.key === 'Enter') {
      ev.preventDefault();
      statsHistPickFiltered();
    }
  });
  document.getElementById('panel-body').addEventListener('click', async ev => {
    // 背包两个 tab 切换：材料 / 合成
    const invTabBtn = ev.target.closest('[data-inv-tab]');
    if (invTabBtn && G.panelMode === 'inv') {
      G.invTab = invTabBtn.dataset.invTab;
      renderPanel(true); // tab 内容不同，切到顶部展示新页面
      return;
    }
    const statTab = ev.target.closest('[data-stat-tab]');
    if (statTab) {
      G.statsTab = statTab.dataset.statTab;
      renderPanel(false);
      return;
    }
    const statItemTab = ev.target.closest('[data-stat-item-tab]');
    if (statItemTab) {
      G.statsItemTab = statItemTab.dataset.statItemTab;
      renderPanel(false);
      return;
    }
    const statLiveSub = ev.target.closest('[data-stat-live-sub]');
    if (statLiveSub) {
      G.statsLiveSub = statLiveSub.dataset.statLiveSub;
      renderPanel(false);
      return;
    }
    const statHistSub = ev.target.closest('[data-stat-hist-sub]');
    if (statHistSub) {
      G.statsHistSub = statHistSub.dataset.statHistSub;
      renderPanel(false);
      return;
    }
    const statInterval = ev.target.closest('[data-stat-interval]');
    if (statInterval) {
      G.statsInterval = +statInterval.dataset.statInterval || 0;
      renderPanel(false);
      return;
    }
    const statPowerTab = ev.target.closest('[data-stat-power-tab]');
    if (statPowerTab) {
      G.statsPowerTab = statPowerTab.dataset.statPowerTab;
      renderPanel(false);
      return;
    }
    const histZoom = ev.target.closest('[data-stat-hist-zoom]');
    if (histZoom) {
      G.statsHistZoom = +histZoom.dataset.statHistZoom || 0;
      renderPanel(false);
      return;
    }
    // 电路节点面板：接入通道切换（对齐《异星工厂》红/绿线缆）
    const wireBtn = ev.target.closest('[data-wire]');
    if (wireBtn && G.panelEnt && typeof isCircuitNodeEntity === 'function' && isCircuitNodeEntity(G.panelEnt)) {
      const w = wireBtn.dataset.wire;
      if (w === 'red' || w === 'green' || w === 'both') {
        G.panelEnt.wireChan = w;
        if (typeof recomputeCircuit === 'function') recomputeCircuit();
        renderPanel(false);
      }
      return;
    }
    const armorEl = ev.target.closest('[data-armor]');
    if (armorEl && G.panelMode === 'inv') {
      const aid = armorEl.dataset.armor;
      if (aid === 'unequip') {
        if (G.armor) unequipArmor();
      } else if (isArmor(aid)) {
        if (invCount(aid) < 1) { toast('背包里没有' + ITEMS[aid].name); }
        else if (G.armor === aid) { unequipArmor(); }
        else if (!canEquipArmor(aid)) { toast('需要先研究「' + TECHS[TECH_REQ[aid]].name + '」才能装备'); }
        else equipArmor(aid);
      }
      renderPanel(false);
      return;
    }
    const roboEl = ev.target.closest('[data-roboport]');
    if (roboEl && G.panelMode === 'inv' && typeof togglePersonalRoboport === 'function') {
      // 判断点击的是 Mk1 还是 Mk2 装备按钮
      const wantMk2 = roboEl.getAttribute('data-roboport') === 'toggle2';
      // 科技门控检查
      if (!itemUnlocked(wantMk2 ? 'personal-roboport-mk2' : 'personal-roboport')) {
        const tid = wantMk2 ? 'personal-roboport-mk2' : 'personal-roboport';
        toast('需要先研究「' + TECHS[TECH_REQ[tid]].name + '」才能装备');
        renderPanel(false);
        return;
      }
      togglePersonalRoboport(wantMk2);
      renderPanel(false);
      return;
    }
    // 个人物流请求：清除已设置的请求项
    const lreqClear = ev.target.closest('[data-lreqclear]');
    if (lreqClear && G.panelMode === 'inv') {
      const item = lreqClear.dataset.lreqclear;
      if (G.logiRequest && G.logiRequest[item] != null) {
        delete G.logiRequest[item];
        toast('已清除对 ' + ITEMS[item].name + ' 的个人请求');
      }
      renderPanel(false);
      return;
    }
    // 个人物流请求：点击物品设置请求量
    const lreqPick = ev.target.closest('#lreq-grid .rcbtn[data-lreqitem]');
    if (lreqPick && G.panelMode === 'inv') {
      const item = lreqPick.dataset.lreqitem;
      if (!G.logiRequest) G.logiRequest = {};
      const cur = G.logiRequest[item] || 0;
      const have = invCount(item);
      const inp = window.prompt('设置对「' + ITEMS[item].name + '」的个人请求数量（当前已请求 ' + cur + '，持有 ' + have + '，输入 0 清除）：', cur || '10');
      if (inp === null) return;
      const v = parseInt(inp, 10);
      if (isNaN(v) || v <= 0) {
        if (G.logiRequest[item] != null) { delete G.logiRequest[item]; toast('已清除对 ' + ITEMS[item].name + ' 的个人请求'); }
      } else {
        G.logiRequest[item] = Math.min(v, 10000);
        toast('已请求 ' + ITEMS[item].name + ' ×' + G.logiRequest[item] + '，物流机器人将自动送达');
      }
      renderPanel(false);
      return;
    }
    // 个人垃圾桶：清除已标记丢弃的物品
    const trashClear = ev.target.closest('[data-trashclear]');
    if (trashClear && G.panelMode === 'inv') {
      const item = trashClear.dataset.trashclear;
      if (G.trashSlots && G.trashSlots[item]) {
        delete G.trashSlots[item];
        toast('已取消对 ' + ITEMS[item].name + ' 的丢弃标记');
      }
      renderPanel(false);
      return;
    }
    // 个人垃圾桶：点击物品切换丢弃标记（对齐《异星工厂》Trash slots）
    const trashPick = ev.target.closest('#trash-grid .rcbtn[data-trashitem]');
    if (trashPick && G.panelMode === 'inv') {
      const item = trashPick.dataset.trashitem;
      if (!G.trashSlots) G.trashSlots = {};
      if (G.trashSlots[item]) {
        delete G.trashSlots[item];
        toast('已取消对 ' + ITEMS[item].name + ' 的丢弃标记');
      } else {
        G.trashSlots[item] = true;
        toast('已标记 ' + ITEMS[item].name + ' 为丢弃，物流机器人将自动带走');
      }
      renderPanel(false);
      return;
    }
    // 蓝图库：加载蓝图粘贴
    const bbUse = ev.target.closest('[data-bbuse]');
    if (bbUse && G.panelMode === 'bluebook') {
      if (typeof blueBookLoad === 'function') blueBookLoad(+bbUse.dataset.bbuse);
      return;
    }
    // 蓝图库：删除蓝图
    const bbDel = ev.target.closest('[data-bbdel]');
    if (bbDel && G.panelMode === 'bluebook') {
      if (typeof blueBookRemove === 'function') blueBookRemove(+bbDel.dataset.bbdel);
      renderPanel(false);
      return;
    }
    // 蓝图库：重命名蓝图（对齐《异星工厂》：自由命名蓝图）
    const bbRen = ev.target.closest('[data-bbrename]');
    if (bbRen && G.panelMode === 'bluebook') {
      const i = +bbRen.dataset.bbrename;
      const cur = (G.blueBook && G.blueBook[i]) ? G.blueBook[i].name : '';
      const nn = window.prompt('输入蓝图新名称：', cur);
      if (nn !== null && typeof blueBookRename === 'function') {
        blueBookRename(i, nn);
        renderPanel(false);
      }
      return;
    }
    // 蓝图库：导出蓝图字符串（对齐《异星工厂》Blueprint string）
    const bbExp = ev.target.closest('[data-bbexport]');
    if (bbExp && G.panelMode === 'bluebook') {
      if (typeof blueBookExport === 'function') blueBookExport(+bbExp.dataset.bbexport);
      return;
    }
    // 蓝图库：导入蓝图字符串
    const bbImp = ev.target.closest('[data-bbimport]');
    if (bbImp && G.panelMode === 'bluebook') {
      const input = document.getElementById('bb-import-input');
      const val = (input && input.value) ? input.value.trim() : '';
      if (!val) { toast('请先粘贴蓝图字符串'); return; }
      if (typeof blueprintDecode !== 'function') { toast('导入功能不可用'); return; }
      const bp = blueprintDecode(val);
      if (!bp) { toast('蓝图字符串无效或已损坏'); return; }
      if (typeof blueBookAdd === 'function') blueBookAdd(bp);
      toast('已导入蓝图「' + bp.name + '」（' + bp.ents.length + ' 个建筑）');
      renderPanel(false);
      return;
    }
    // 装备网格点击（安装/卸下个人装备件）
    if (typeof equipPanelClick === 'function' && equipPanelClick(ev.target)) {
      return;
    }
    // 蜘蛛机器人装备网格点击
    if (typeof spiderEquipPanelClick === 'function' && spiderEquipPanelClick(ev.target)) {
      return;
    }
    // 装甲车/坦克装备网格点击
    if (typeof vehEquipPanelClick === 'function' && vehEquipPanelClick(ev.target)) {
      return;
    }
    const hbSlot = ev.target.closest('[data-hbedit]');
    if (hbSlot) {
      const i = +hbSlot.dataset.hbedit;
      if (G.hbArm === i) { HOTBAR[i] = null; G.hbArm = null; }
      else G.hbArm = i;
      renderPanel(false);
      buildHotbar();
      return;
    }
    const itEl = ev.target.closest('[data-itemid]');
    if (itEl && G.hbArm !== null && G.hbArm !== undefined) {
      HOTBAR[G.hbArm] = itEl.dataset.itemid;
      toast('已放入快捷栏槽位 ' + (G.hbArm === 9 ? 0 : G.hbArm + 1));
      G.hbArm = null;
      renderPanel(false);
      buildHotbar();
      return;
    }
    if (itEl && G.panelMode === 'inv' && !itEl.dataset.action) {
      const iid = itEl.dataset.itemid;
      // 地面物品（混凝土/石砖路/填海等）虽非建筑实体，但同样可选中放入快捷栏以铺设
      const isGroundItem = iid === 'concrete' || iid === 'refined-concrete' || iid === 'hazard-concrete' || iid === 'stone-path' || iid === 'landfill';
      if (BUILD_DEFS[iid] || isGroundItem) {
        const idx = HOTBAR.indexOf(iid);
        if (idx >= 0) {
          G.sel = idx;
          G.quickSel = null;
          refreshHotbar();
        } else {
          const empty = HOTBAR.indexOf(null);
          if (empty >= 0) {
            HOTBAR[empty] = iid;
            G.sel = empty;
            G.quickSel = null;
            buildHotbar();
            toast('已放入快捷栏槽位 ' + (empty === 9 ? 0 : empty + 1) + ' 并选中');
          } else {
            G.sel = -1;
            G.quickSel = iid;
            toast('已直接选中 ' + ITEMS[iid].name + '（快捷栏已满，Q 取消）');
          }
        }
        G.ghostDir = 0;
        closePanel();
        uiDirty = true;
        return;
      }
    }
    const setVol = ev.target.closest('[data-setvol]');
    if (setVol) {
      G.settings[setVol.dataset.setvol] = parseFloat(setVol.value);
      saveSettings();
      if (typeof playSfx === 'function') playSfx('click');  // 音量调节试听
      return;
    }
    // 敌人强度切换：与开局地图设置一致，修改后立即生效（对齐《异星工厂》新游戏敌人设置）
    const enemyBtn = ev.target.closest('[data-enemy-val]');
    if (enemyBtn) {
      const v = enemyBtn.getAttribute('data-enemy-val');
      if (typeof normalizeWorldConfig === 'function' && typeof worldConfig === 'function' && typeof enemyConfig === 'function') {
        // 重建配置：替换为归一化后的新对象以触发 world-config 派生缓存重建
        const cfg = normalizeWorldConfig(G.worldConfig);
        cfg.enemy = v;
        G.worldConfig = cfg;
        // 同步进化度到新强度的初始进化度，实现立即生效
        if (typeof enemyConfig === 'function') {
          const ecfg = enemyConfig();
          if (ecfg && typeof ecfg.initEvolution === 'number') {
            G.evolution = ecfg.initEvolution;
            if (typeof G.evolution !== 'number' || !isFinite(G.evolution)) G.evolution = 0;
          }
          // 无敌人模式下清空在场敌人
          if (ecfg && ecfg.none) { G.enemies = []; G.enemyProjectiles = []; G.bullets = []; }
        }
        if (typeof toast === 'function') toast('敌人强度已调整为「' + enemyBtn.textContent + '」');
        const _sb = document.getElementById('panel-body');
        if (_sb && typeof renderSettingsAsync === 'function') renderSettingsAsync(_sb, 0);
        return;
      }
    }
    const setCb = ev.target.closest('[data-set]');
    if (setCb) {
      const key = setCb.dataset.set;
      G.settings[key] = setCb.checked;
      saveSettings();
      // 音效开关改动后立即试听
      if (key === 'sound') { if (typeof playSfx === 'function' && G.settings.sound) playSfx('build'); }
      // 分辨率相关设置改动后立即重建画布尺寸
      if (key === 'capDPR' || key === 'lowRes') {
        if (typeof resize === 'function') resize();
        toast('画面分辨率已更新');
      }
      // 虚拟摇杆开关改动后立即显示/隐藏
      if (key === 'virtualJoystick') {
        if (typeof updateJoystickVisibility === 'function') updateJoystickVisibility();
        toast('虚拟摇杆已' + (G.settings.virtualJoystick ? '开启' : '关闭'));
      }
      return;
    }
    const btn = ev.target.closest('[data-action], [data-act]');
    if (!btn) return;
    const act = btn.dataset.action || btn.dataset.act;
    const id = btn.dataset.id;
    // 设备专属动作（spref/flt/labfill 等）优先交给设备自己的 onAction
    const panel = G.panelEnt && DEVICE_PANEL[G.panelEnt.type];
    let handled = false;
    if (panel && panel.onAction) handled = !!panel.onAction(act, btn);
    if (!handled) {
      if (act === 'tag-tp' || act === 'tag-del' || act === 'tag-rename') {
        // 地图标记管理动作（传送/删除/重命名）
        if (typeof mapTagsAction === 'function') {
          mapTagsAction(act, id, { render: () => renderPanel(false) });
        }
      }
      else if (act === 'use-grenade') {
        // 从背包投掷手雷/集束手雷：向玩家当前朝向投掷（目标点为玩家前方数格）
        if (typeof throwGrenade === 'function') {
          const type = btn.getAttribute('data-type') || 'grenade';
          const a = G.player.dir * Math.PI / 2;
          const tx = Math.floor((G.player.x + Math.cos(a) * TILE * 3) / TILE);
          const ty = Math.floor((G.player.y + Math.sin(a) * TILE * 3) / TILE);
          throwGrenade(tx, ty, type);
          if (typeof playSfx === 'function') playSfx('throw');
          renderPanel(false);
        } else {
          toast('无法投掷（战斗系统未加载）');
        }
      }
      else if (act === 'eat-fish') {
        // 食用生鱼回血（对齐《异星工厂》：吃鱼恢复生命值）
        if (invCount('raw-fish') > 0) {
          const heal = FISH_HEAL || 20;
          invTake('raw-fish', 1);
          G.playerHP = Math.min(G.playerHPmax, G.playerHP + heal);
          if (typeof playSfx === 'function') playSfx('fish');
          toast('🐟 食用生鱼，恢复 ' + heal + ' 生命值（' + Math.round(G.playerHP) + '/' + G.playerHPmax + '）');
          renderPanel(false);
        } else {
          toast('没有生鱼可食用');
        }
      }
      else if (act === 'quick-save') { await saveGame(); renderPanel(false); }
      else if (act === 'quick-load') {
        const newest = (await listAllSaves())[0];
        if (newest) { await loadGame(newest.id); } else { toast('暂无存档'); }
      }
      else if (act === 'load-save') { await loadGame(id); }
      else if (act === 'overwrite-save') { await saveGame(id); renderPanel(false); }
      else if (act === 'delete-save') {
        await deleteSave(id);
        toast('已删除存档');
        renderPanel(false);
      }
      else if (act === 'exp-save') { downloadSave(); }
      else if (act === 'imp-save') { document.getElementById('imp-file').click(); }
      else if (act === 'quit-to-menu') { if (typeof returnToMenu === 'function') returnToMenu(); }
      else if (act === 'craft') {
        const n = +(btn.dataset.mult || 1);
        // 手搓合成队列：按时间逐件制作（对齐《异星工厂》）
        const queued = queueCraft(id, n);
        if (!queued) toast('材料不足');
        else {
          // 队首已开始制作：优先把界面切换到背包以看到队列反馈
          const cur = craftCurrent();
          if (cur) toast('已开始制作 ' + ITEMS[cur.outId].name + (queued > 1 ? ' ×' + queued : ''));
        }
      } else if (act === 'recipe') {
        const mch = G.panelEnt;
        if (mch && typeof mch.setRecipe === 'function') {
          // 科技门控：未解锁的配方不能在设备中选择
          if (!recipeUnlocked(id)) {
            toast('需先研究「' + TECHS[recipeLockingTech(id)].name + '」才能生产' + ITEMS[Object.keys((RECIPES[id] || REFINERY_RECIPES[id] || CENTRIFUGE_RECIPES[id]).out)[0]].name);
          } else {
            mch.setRecipe(id);
          }
        }
      } else if (act === 'recipe-clear') {
        const mch = G.panelEnt;
        if (mch && typeof mch.setRecipe === 'function') mch.setRecipe(null);
      } else if (act === 'rec') {
        // 离心机等使用 data-action="rec" 选择配方（含科技门控）
        const mch = G.panelEnt;
        if (mch && typeof mch.setRecipe === 'function') {
          if (!recipeUnlocked(id)) {
            toast('需先研究「' + TECHS[recipeLockingTech(id)].name + '」才能执行' + (CENTRIFUGE_RECIPES[id] ? CENTRIFUGE_RECIPES[id].name : id));
          } else {
            mch.setRecipe(id);
          }
        }
      } else if (act === 'fuel') {
        const fid = btn.dataset.id || 'coal';
        const n = Math.min(5, invCount(fid));
        if (n <= 0) { toast('没有' + ITEMS[fid].name + '了'); return; }
        if (invTake(fid, n)) {
          // 固体燃料 / 煤存入对应燃料槽；其它设备若只认煤则回退到 feed 通用逻辑
          if (fid === 'coal') G.panelEnt.fuelCoal += n;
          else if (fid === 'wood' && 'fuelWood' in G.panelEnt) G.panelEnt.fuelWood += n;
          else if (fid === 'solid-fuel' && 'fuelSolid' in G.panelEnt) G.panelEnt.fuelSolid += n;
          else if (fid === 'rocket-fuel' && 'fuelRocket' in G.panelEnt) G.panelEnt.fuelRocket += n;
          else if ('giveItem' in G.panelEnt) { G.panelEnt.giveItem(fid); G.panelEnt.giveItem(fid); G.panelEnt.giveItem(fid); G.panelEnt.giveItem(fid); G.panelEnt.giveItem(fid); }
        }
      } else if (act === 'feed') {
        const mch = G.panelEnt;
        const id = btn.dataset.id;
        let moved = 0;
        const have = invCount(id);
        while (moved < have && mch.giveItem(id)) moved++;
        if (moved > 0) invTake(id, moved);
        else toast('放不进去了');
        // 装入模块后整面板重渲染，刷新模块按钮数量与速率显示
        if (moved > 0 && isModule(id)) { renderPanel(true); return; }
      } else if (act === 'takein') {
        const mch = G.panelEnt;
        if (btn.dataset.modules === '1') {
          // 取出全部模块
          for (const k of Object.keys(mch.modules || {})) {
            invAdd(k, mch.modules[k]);
            delete mch.modules[k];
          }
          mch.prodBuf = 0;
          renderPanel(true); return;
        } else {
          for (const k of Object.keys(mch.inp || {})) {
            invAdd(k, mch.inp[k]);
            delete mch.inp[k];
          }
        }
      } else if (act === 'trunk-take') {
        // 载具储物箱：取出指定物品一件回背包（受背包堆叠上限约束）
        const mch = G.panelEnt;
        const id = btn.dataset.id;
        if (mch && typeof mch.trunkTakeItemOf === 'function') {
          const got = mch.trunkTakeItemOf(id);
          if (got) { invAdd(got, 1); if (typeof playSfx === 'function') playSfx('pick'); }
        }
      } else if (act === 'takeout') {
        // "取出全部"：各设备在自己的文件里实现 takeAll()（默认清空 outp）
        const mch = G.panelEnt;
        if (mch && mch.takeAll) for (const [k, n] of mch.takeAll()) invAdd(k, n);
      } else if (act === 'tech') {
        // 前置科技校验：未满足前置的科技不能开始研究
        if (G.techDone[id]) { toast('该科技已完成'); return; }
        if (techLocked(id)) {
          toast('需先研究：' + techMissingPrereqs(id).map(m => TECHS[m].name).join('、'));
          return;
        }
        // 加入研究队列（对齐《异星工厂》Research queue）
        if (!G.techQueue) G.techQueue = [];
        if (G.techQueue.indexOf(id) >= 0 || G.activeTech === id) { toast('该科技已在研究队列中'); return; }
        G.techQueue.push(id);
        if (!G.activeTech) G.activeTech = id;
        toast('已加入研究队列：' + TECHS[id].name);
      } else if (act === 'tech-cancel') {
        // 取消研究：移除当前项（若队列还有下一项则顺延）
        if (G.techQueue && G.techQueue.length) G.techQueue.shift();
        G.activeTech = (G.techQueue && G.techQueue.length) ? G.techQueue[0] : null;
      } else if (act === 'panel-rotate' || act === 'panel-flip-h' || act === 'panel-flip-v') {
        // 面板操作区：旋转 / 水平翻转 / 垂直翻转当前选中的建筑（复用蓝图变换的方向算法）
        const mch = G.panelEnt;
        if (mch && G.ents.includes(mch) && BUILD_DEFS[mch.type]) {
          const nd = act === 'panel-rotate' ? (mch.dir + 1) % 4 : flipDir(mch.dir, act === 'panel-flip-h' ? 'h' : 'v');
          if (nd === mch.dir && act !== 'panel-rotate') { toast('该建筑已处于该朝向'); }
          // 非方形设备（分流器类）：旋转/翻转后脚印变化，需重挂网格
          if (BUILD_DEFS[mch.type].rotSwap) {
            if (mch.type === 'offshore-pump' && !pumpCanFace(mch, nd)) { toast('抽水机无法朝该方向操作：必须仍压在水面上'); return; }
            removeEnt(mch);
            mch.dir = nd;
            mch.applyDir();
            addEnt(mch);
            uiDirty = true;
          } else if (DEVICE_DIR_ROTATE[mch.type]) {
            // 有朝向的设备：直接旋转/翻转（传送带方向变化会改变输入侧判定，失效附近缓存）
            mch.dir = nd;
            invalidateBeltInputNear(mch.x, mch.y, mch.w, mch.h);
            if (typeof mch.onRotate === 'function') mch.onRotate();
            uiDirty = true;
          } else {
            toast('该建筑不支持旋转/翻转');
          }
        }
      } else if (act === 'panel-deconstruct') {
        // 建筑面板内的“拆除”按钮：拆除当前选中的建筑（PC/手机端通用）
        const mch = G.panelEnt;
        if (mch && G.ents.includes(mch)) {
          // 直接拆除面板对应的建筑，并返还物资；不受距离限制（面板已打开）
          for (const [iid, n] of mch.contents()) invAdd(iid, n);
          removeEnt(mch);
          if (G.panelEnt === mch) closePanel();
          uiDirty = true;
        }
      }
    }
    renderPanel(false);
    refreshHotbar();
  });
}

// 异步渲染设置面板（含基于 IndexedDB 的存档列表）
async function renderSettingsAsync(body, st) {
  body.innerHTML = await htmlSettings();
  // 异步返回后需确认当前面板仍是设置面板，避免竞态覆盖其他面板
  if (G.panelMode !== 'set') return;
  body.scrollTop = st;
}

async function htmlSettings() {
  let h = '<div class="sec">游戏设置</div>';
  h += '<label class="setrow"><input type="checkbox" data-set="infiniteOre"' + (G.settings.infiniteOre ? ' checked' : '') + '> 无限矿脉（矿藏永不枯竭）</label>';
  h += '<label class="setrow"><input type="checkbox" data-set="autoSave"' + (G.settings.autoSave ? ' checked' : '') + '> 自动保存（每60秒）</label>';
  h += '<label class="setrow"><input type="checkbox" data-set="combat"' + (G.settings.combat ? ' checked' : '') + '> 战斗模式（敌人入侵，可用炮塔/石墙防御）</label>';
  // 敌人强度：与开局地图设置的敌人选项一致，修改后立即生效（对齐《异星工厂》新游戏敌人设置）
  const _wcEnemy = (typeof normalizeWorldConfig === 'function' && typeof WORLD_ENEMY_OPTIONS !== 'undefined')
    ? normalizeWorldConfig(G.worldConfig).enemy : 'normal';
  h += '<div class="wcfg-row" style="margin-top:10px"><div class="wcfg-label">敌人强度</div><div class="wcfg-opts">';
  for (const _o of WORLD_ENEMY_OPTIONS) {
    h += '<button type="button" class="wcfg-opt' + (_o.v === _wcEnemy ? ' active' : '') + '" data-enemy-val="' + _o.v + '">' + _o.name + '</button>';
  }
  h += '</div></div>';
  h += '<div class="dim wcfg-desc">无 = 完全没有敌人；和平 = 敌人存在但不主动攻击；低/中/高 = 影响初始进化度与刷怪频率。修改后立即生效。</div>';
  h += '<label class="setrow"><input type="checkbox" data-set="virtualJoystick"' + (G.settings.virtualJoystick ? ' checked' : '') + '> 虚拟摇杆（手机/触屏移动）</label>';
  h += '<label class="setrow"><input type="checkbox" data-set="minimap"' + (G.settings.minimap !== false ? ' checked' : '') + '> 小地图（右下角显示已探索区域，M 键切换）</label>';
  h += '<label class="setrow"><input type="checkbox" data-set="weather"' + (G.settings.weather !== false ? ' checked' : '') + '> 天气（阴云氛围，阴天时整体略暗）</label>';
  h += '<label class="setrow"><input type="checkbox" data-set="daylight"' + (G.settings.daylight !== false ? ' checked' : '') + '> 日照光照（昼夜明暗随时间变化）</label>';
  h += '<label class="setrow"><input type="checkbox" data-set="altMode"' + (G.settings.altMode ? ' checked' : '') + '> ALT 模式（建筑上显示配方/内容，Alt 键切换）</label>';
  h += '<div class="sec">音效</div>';
  h += '<label class="setrow"><input type="checkbox" data-set="music"' + (G.settings.music !== false ? ' checked' : '') + '> 背景音乐（可单独开关）</label>';
  h += '<label class="setrow"><input type="checkbox" data-set="sound"' + (G.settings.sound ? ' checked' : '') + '> 游戏音效（建造/拆除/射击/爆炸等）</label>';
  h += '<label class="setrow">音量 <input type="range" data-setvol="soundVol" min="0" max="1" step="0.05" value="' + (G.settings.soundVol != null ? G.settings.soundVol : 0.8) + '" style="width:120px;vertical-align:middle"></label>';
  h += '<div class="sec">性能优化</div>';
  h += '<label class="setrow"><input type="checkbox" data-set="capDPR"' + (G.settings.capDPR ? ' checked' : '') + '> 限制高清缩放（DPR ≤ 1.5，降载高分屏）</label>';
  h += '<label class="setrow"><input type="checkbox" data-set="lowRes"' + (G.settings.lowRes ? ' checked' : '') + '> 省电模式（降至半分辨率，显著降 GPU 负载）</label>';
  h += '<div class="sec">存档管理</div>';
  h += '<button data-action="quick-save">➕ 新建存档</button> ';
  h += '<button data-action="quick-load">读取最新存档</button>';
  h += '<button data-action="exp-save">导出存档到文件</button> ';
  h += '<button data-action="imp-save">从文件导入存档</button>';
  h += '<input type="file" id="imp-file" accept=".json,application/json" style="display:none">';
  h += '<div class="hint">自动存档保留最近 3 个（旧的自动覆盖）；用户可自行新建/覆盖/读取/删除存档。</div>';
  h += await saveListHtml();
  h += '<div class="sec">退出</div>';
  h += '<button data-action="quit-to-menu" style="color:#ff8a8a">🚪 退出到主页面</button>';
  h += '<div class="hint">退出到开始菜单，游戏进度请先保存（新建存档后自动持久化）。</div>';
  return h;
}

// 生成存档列表（自动 + 用户），每项提供“读取 / 覆盖 / 删除”操作
async function saveListHtml() {
  const saves = await listAllSaves();
  if (!saves.length) return '<div class="hint">暂无存档。点击“➕ 新建存档”保存当前进度。</div>';
  let h = '<div class="sec save-list-title">全部存档（' + saves.length + '）</div>';
  h += '<div class="save-list">';
  for (const s of saves) {
    const d = new Date(s.time);
    const time = d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
    const tag = s.type === 'auto' ? '<span class="save-tag auto">自动</span>' : '<span class="save-tag user">用户</span>';
    h += '<div class="save-item">';
    h += '  <div class="save-item-top">';
    h += '    <div class="save-item-info">' + tag + ' <span class="save-name">' + escHtml(s.name || '存档') + '</span></div>';
    h += '    <div class="save-item-ops">';
    h += '      <button data-action="load-save" data-id="' + s.id + '" title="读取该存档">📂 读取</button>';
    h += '      <button data-action="overwrite-save" data-id="' + s.id + '" title="用当前进度覆盖该存档">💾 覆盖</button>';
    h += '      <button data-action="delete-save" data-id="' + s.id + '" title="删除该存档">🗑 删除</button>';
    h += '    </div>';
    h += '  </div>';
    h += '  <div class="save-time">' + time + ' · ' + escHtml(s.sizeText || '') + '</div>';
    h += '</div>';
  }
  h += '</div>';
  return h;
}

function pad2(n) { return (n < 10 ? '0' : '') + n; }
function escHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

function downloadSave() {
  try {
    const data = JSON.stringify(serializeAll());
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'factory-save-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    toast('存档已导出');
  } catch (err) {
    toast('导出失败：' + err.message);
  }
}

function importSaveText(text) {
  try {
    const d = JSON.parse(text);
    if (!d || d.v !== 1) throw new Error('格式不正确');
    applySave(d);
    closePanel();
    toast('导入成功');
  } catch (err) {
    toast('导入失败：' + err.message);
  }
}

function initTopButtons() {
  // 顶部菜单折叠/展开
  const topMenu = document.getElementById('topright');
  const menuToggle = document.getElementById('btn-menu-toggle');
  if (topMenu && menuToggle) {
    // 默认折叠顶部菜单（与 index.html 中 #topright 默认 collapsed 保持一致）
    const isCollapsed = topMenu.classList.contains('collapsed');
    menuToggle.textContent = isCollapsed ? '☰' : '✕';
    menuToggle.title = isCollapsed ? '展开顶部菜单' : '折叠顶部菜单';
    menuToggle.addEventListener('click', () => {
      const collapsed = topMenu.classList.toggle('collapsed');
      menuToggle.textContent = collapsed ? '☰' : '✕';
      menuToggle.title = collapsed ? '展开顶部菜单' : '折叠顶部菜单';
    });
  }
  document.getElementById('btn-inv').addEventListener('click', () =>
    G.panelMode === 'inv' ? closePanel() : openPanel('inv'));
  document.getElementById('btn-tech').addEventListener('click', () =>
    G.panelMode === 'tech' ? closePanel() : openPanel('tech'));
  document.getElementById('btn-stats').addEventListener('click', () =>
    G.panelMode === 'stats' ? closePanel() : openPanel('stats'));
  const achBtn = document.getElementById('btn-ach');
  if (achBtn) achBtn.addEventListener('click', () =>
    G.panelMode === 'ach' ? closePanel() : openPanel('ach'));
  document.getElementById('btn-blue').addEventListener('click', () => {
    closePanel();
    toggleBlueprint('blue');
  });
  document.getElementById('btn-red').addEventListener('click', () => {
    closePanel();
    toggleBlueprint('red');
  });
  document.getElementById('btn-green').addEventListener('click', () => {
    closePanel();
    toggleBlueprint('green');
  });
  // 绿图操作栏：升级/降级/取消
  const greenbar = document.getElementById('greenbar');
  if (greenbar) greenbar.addEventListener('click', ev => {
    const b = ev.target.closest('[data-gact]');
    if (!b) return;
    const act = b.dataset.gact;
    if (act === 'cancel') { hideGreenBar(); G.greenRect = null; return; }
    greenAreaAction(act);
  });
  document.getElementById('btn-set').addEventListener('click', () =>
    G.panelMode === 'set' ? closePanel() : openPanel('set'));
  // 顶部“暂停/继续”按钮：切换游戏暂停状态，并更新按钮文字
  const pauseBtn = document.getElementById('btn-pause');
  if (pauseBtn) {
    const syncPauseBtn = () => {
      if (G.paused) { pauseBtn.textContent = '▶ 继续'; pauseBtn.title = '继续游戏'; }
      else { pauseBtn.textContent = '⏸ 暂停'; pauseBtn.title = '暂停游戏'; }
    };
    pauseBtn.addEventListener('click', () => {
      G.paused = !G.paused;
      syncPauseBtn();
      if (typeof playSfx === 'function') playSfx('click');
      if (G.paused) toast('游戏已暂停');
      else toast('游戏继续');
    });
    syncPauseBtn();
  }
}

function updateHUD(dt, fps) {
  const el = document.getElementById('hud-info');
  const p = G.player;
  const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
  // HUD 信息项改为可点击：点击弹出详情弹框（替代原先的悬停 title 提示）
  let hud = '<span class="hud-item" data-hud="fps">' + fps + '</span>   <span class="hud-item" data-hud="coord">(' + tx + ',' + ty + ')</span>';
  if (G.settings.combat) {
    const hp = Math.max(0, Math.round(G.playerHP));
    const hpPct = G.playerHPmax > 0 ? hp / G.playerHPmax : 0;
    hud += '   <span class="hud-item" data-hud="hp" style="color:' + (hpPct > 0.5 ? '#57e389' : hpPct > 0.25 ? '#ffd23c' : '#ff5b5b') + '">♥ ' + hp + '/' + G.playerHPmax + '</span>';
    // 敌人进化度显示（对齐《异星工厂》Evolution factor）
    const evo = Math.round((G.evolution || 0) * 100);
    const evoColor = evo < 30 ? '#57e389' : evo < 60 ? '#ffd23c' : '#ff5b5b';
    hud += '   <span class="hud-item" data-hud="evo" style="color:' + evoColor + '">⬆ ' + evo + '%</span>';
  }
  if (G.weapon && isWeapon(G.weapon)) {
    hud += '   🔫 ' + WEAPONS[G.weapon].name;
  }
  // 手持开采工具：显示耐久度（对齐《异星工厂》Axe）
  const _ax = (typeof currentAxe === 'function') ? currentAxe() : null;
  if (_ax) {
    const _max = (typeof AXE_DURABILITY === 'object' && AXE_DURABILITY[_ax]) ? AXE_DURABILITY[_ax] : 1;
    const _d = (G.axeDura || 0);
    const _pct = Math.max(0, Math.min(100, Math.round(_d / _max * 100)));
    const _c = _pct > 30 ? '#57e389' : _pct > 10 ? '#ffd23c' : '#ff5b5b';
    hud += '   <span class="hud-item" data-hud="axe" data-hud-axe="' + _ax + '" style="color:' + _c + '">⛏ ' + ITEMS[_ax].name + ' ' + _pct + '%</span>';
  }
  if (G.armor && isArmor(G.armor)) {
    hud += '   🛡 ' + ARMORS[G.armor].name;
    // 模块化护甲：显示个人电网状态（含装备件数量）
    if (ARMORS[G.armor].grid && typeof equipCount === 'function' && typeof equipmentSerialize === 'function') {
      const eqN = (G.equipGrid || []).length;
      let pp = '';
      if (typeof G.personalPowerMax === 'number' && G.personalPowerMax > 0) {
        pp = ' · ⚡' + Math.round((G.personalPower || 0) / 1000) + '/' + Math.round(G.personalPowerMax / 1000) + 'MJ';
      }
      hud += ' <span style="opacity:.75">(' + eqN + ' 装备' + pp + ')</span>';
    }
  }
  if (G.driving && G.driving.ent) {
    const de = G.driving.ent;
    if (typeof Locomotive !== 'undefined' && (de instanceof Locomotive || de instanceof CargoWagon)) {
      hud += '   🚂 ' + (de instanceof Locomotive ? '火车驾驶' : '乘坐车厢') + '（E 下车' + (de instanceof Locomotive && G.driving.mode === 'drive' ? '，W 前进 / S 后退 / R 反转' : '') + '）';
    } else {
      hud += '   🚗 ' + (de instanceof Tank ? '坦克' : '装甲车') + '（E 下车）';
    }
  }
  // 手搓合成队列进度
  const cur = craftCurrent();
  if (cur) {
    const pct = Math.min(100, (cur.done / cur.time) * 100);
    const nm = (ITEMS[cur.outId] && ITEMS[cur.outId].name) || cur.outId;
    const rest = (G.craftQueue ? G.craftQueue.length - 1 : 0);
    hud += '   <span style="color:#7fd4a0">⚒ ' + nm +
      (rest > 0 ? ' (+' + rest + ')' : '') + ' ' + pct.toFixed(0) + '%' +
      ' <a href="javascript:void(0)" id="craft-cancel" style="color:#ff8a8a;pointer-events:auto;text-decoration:none" title="取消制作">✕</a></span>';
  }
  el.innerHTML = hud;
  const cc = document.getElementById('craft-cancel');
  if (cc) {
    cc.onclick = () => { cancelCraftQueue(); toast('已取消制作（返还排队材料）'); };
  }
}

// ===== HUD 详情弹框：点击 HUD 信息项弹出详情及描述（替代原先悬停 title 提示）=====
function showHudInfo(key, el) {
  const titleEl = document.getElementById('hud-modal-title');
  const body = document.getElementById('hud-modal-body');
  if (!titleEl || !body) return;
  const tx = Math.floor(G.player.x / TILE), ty = Math.floor(G.player.y / TILE);
  const hp = Math.max(0, Math.round(G.playerHP));
  const evo = Math.round((G.evolution || 0) * 100);
  let title = 'HUD 详情', desc = '', detail = '';
  if (key === 'fps') {
    title = '帧率 (FPS)';
    desc = '每秒渲染的帧数，反映游戏运行流畅度。数值越高画面越流畅，过低则可能卡顿。';
    detail = '当前帧率：' + (el ? el.textContent : '--') + ' FPS。<br>建议保持 30 FPS 以上以获流畅体验；若持续偏低，可尝试降低画质或关闭其他占资源的窗口。';
  } else if (key === 'coord') {
    title = '坐标 (x, y)';
    desc = '玩家当前所处的地图格子坐标。X 为横向格子编号，Y 为纵向格子编号。';
    detail = '当前坐标：(' + tx + ', ' + ty + ')。<br>坐标用于定位与记录位置，可在不同区域间往返时作为参照。';
  } else if (key === 'hp') {
    title = '生命值 (HP)';
    desc = '玩家的当前生命值与最大生命值。受到敌人攻击会减少，生命值归零则死亡。';
    detail = '当前生命值：' + hp + '/' + (G.playerHPmax || 0) + '。<br>生命过低时请尽快远离敌人，使用医疗包、急救箱或进入载具避险恢复。';
  } else if (key === 'evo') {
    title = '敌人进化度 (Evolution)';
    desc = '随时间与击杀不断增长的敌人强度指标。进化度越高，刷出的敌人越强、越容易出现高级变种。';
    detail = '当前进化度：' + evo + '%。<br>0~30%：敌人较弱；30~60%：中等；60%+：较强。<br>进化度达到 0.9 后解锁巨兽级（Behemoth）敌人（巨兽甲虫/吐痰虫/蠕虫，属性最强）。';
  } else if (key === 'axe') {
    const ax = el ? el.getAttribute('data-hud-axe') : null;
    const nm = (ax && ITEMS[ax]) ? ITEMS[ax].name : (el ? el.textContent.replace(/⛏\s*/, '').split(' ')[0] : '开采工具');
    const max = (ax && AXE_DURABILITY && AXE_DURABILITY[ax]) ? AXE_DURABILITY[ax] : 1;
    const d = G.axeDura || 0;
    title = nm + ' · 耐久度';
    desc = '当前手持开采工具的耐久度。使用工具采集会消耗耐久，耐久归零则工具损坏失效。';
    detail = nm + ' 耐久：' + d + ' / ' + max + '。<br>耐久耗尽后需重新制作或更换更耐久的工具（如铁斧、钢斧）以提升采集效率与寿命。';
  }
  titleEl.textContent = title;
  body.innerHTML = '<div class="hud-desc">' + desc + '</div><div class="hud-detail">' + detail + '</div>';
  document.getElementById('hud-modal').classList.remove('hidden');
}

function closeHudInfo() {
  document.getElementById('hud-modal').classList.add('hidden');
}

function initHudInfo() {
  document.addEventListener('click', ev => {
    const item = ev.target && ev.target.closest ? ev.target.closest('#hud-info .hud-item') : null;
    if (item) {
      showHudInfo(item.getAttribute('data-hud'), item);
      ev.stopPropagation();
    } else if (ev.target && ev.target.id === 'hud-modal-close') {
      closeHudInfo();
      ev.stopPropagation();
    }
  });
}

function enemyAtTile(tx, ty) {
  const list = G.enemies || [];
  for (let i = 0; i < list.length; i++) {
    const en = list[i];
    if (en.dead) continue;
    // 敌人中心所在格，且按其体型（size）扩大判定到所占范围，鼠标指向其任意身体部分均能识别
    const cx = Math.floor(en.x / TILE), cy = Math.floor(en.y / TILE);
    // 虫巢为 SPAWNER_FOOT×SPAWNER_FOOT 占地：以中心所在格为中心，向四周各覆盖 foot/2 格
    let half;
    if (en.kind === 'spawner') half = Math.max(0, (en.foot || 4) / 2);
    else half = Math.max(0, Math.ceil((en.size || 6) / TILE) - 1);
    if (Math.abs(tx - cx) <= half && Math.abs(ty - cy) <= half) return en;
  }
  return null;
}

// 敌人简要介绍：由类型属性生成（对齐《异星工厂》虫族图鉴感）
function enemyDesc(en) {
  const d = ENEMY_TYPES[en.type];
  if (!d) return '敌对单位';
  const kindTxt = en.kind === 'spawner' ? '虫巢' : (d.kind === 'ranged' ? '远程单位，会喷吐攻击' : '近战单位，会冲向并攻击建筑');
  return kindTxt + '；生命 ' + (en.maxhp || d.hp) + '，攻击 ' + (en.dmg || d.dmg) + '。可点击攻击或建造炮塔防御。';
}

function mapTipAt(tx, ty) {
  // 显示详情时：鼠标移到某流体出入口图标上，优先显示该流体的具体名称
  if (G.showDetails) {
    // 性能优化：仅检查光标所在格被占位的实体（entAt），替代遍历全部 G.ents 寻找流体图标。
    // 流体接口图标都在实体自身占地格（含边缘端口格），故 entAt(tx,ty) 命中的实体即为原逻辑中唯一匹配者，行为一致。
    const _fe = entAt(tx, ty);
    if (_fe && !_fe._dead) {
      const fn = DEVICE_FLUID_ICONS[_fe.type];
      if (fn) {
        for (const ic of fn(_fe)) {
          if (ic.x === tx && ic.y === ty && ITEMS[ic.fluid]) {
            return ITEMS[ic.fluid].name + '|' + ITEMS[ic.fluid].desc;
          }
        }
      }
    }
  }
  const e = entAt(tx, ty);
  if (e) {
    // 设备状态文案由各设备文件提供（DEVICE_PANEL[type].tip）
    let extra = '';
    const panel = DEVICE_PANEL[e.type];
    if (panel && panel.tip) {
      const t = panel.tip(e);
      if (t) extra = t;
    }
    return ITEMS[e.type].name + '|' + extra;
  }
  // 敌人生成在格子中央，悬停到其上时优先显示敌人具体名称（对齐《异星工厂》）
  const enemy = enemyAtTile(tx, ty);
  if (enemy) {
    const d = ENEMY_TYPES[enemy.type];
    const nm = d ? d.name : (enemy.kind === 'spawner' ? '虫巢' : '敌人');
    return nm + '|点击查看详细说明';
  }
  if (getTerrain(tx, ty) === T_CLIFF) return '峭壁|不可通行、不可建造的地形障碍；可手持峭壁炸药点击清除';
  if (getTerrain(tx, ty) === T_WATER) return '水域|无法通行；可把抽水机放在这里取水';
  // 树木：悬停显示树木信息（对齐《异星工厂》：树木是资源型地形，可砍伐）
  if (getTerrain(tx, ty) === T_TREE) return '树木|可砍伐获得木材；手持斧头/开采工具按住左键砍伐，或直接在其上铺设建筑自动清理';
  const ti = getOreType(tx, ty);
  if (ti >= 0 && getOreAmt(tx, ty) > 0) {
    if (ti === ORE_OIL) return '原油矿床|储量 ' + Math.floor(getOreAmt(tx, ty)) + '，建造抽油机开采（吃电力）';
    const nm = oreItemId(ti);
    return (ITEMS[nm] ? ITEMS[nm].name : '未知矿') + '|储量 ' + Math.floor(getOreAmt(tx, ty)) + '，按住左键开采';
  }
  return null;
}

function initTooltips() {
  const tip = document.getElementById('tooltip');
  document.addEventListener('mousemove', ev => {
    let text = null;
    if (ev.target && ev.target.closest) {
      const el = ev.target.closest('[data-tip]');
      if (el) text = el.dataset.tip;
    }
    if (!text && ev.target === G.canvas && G.cursorTile)
      text = mapTipAt(G.cursorTile.tx, G.cursorTile.ty);
    if (text) {
      const parts = text.split('||');
      const p = parts[0].split('|');
      tip.querySelector('b').textContent = p[0] || '';
      tip.querySelector('span').textContent = p.slice(1).join('|') || '';
      const recipeEl = tip.querySelector('#tooltip-recipe');
      if (recipeEl) {
        recipeEl.textContent = parts[1] || '';
        // 注意：不能用 style.display=''，那会清掉内联样式并回退到 CSS 的 display:none，导致配方永远隐藏。
        // 必须显式设为 block 才能覆盖样式表中的 display:none。
        recipeEl.style.display = parts[1] ? 'block' : 'none';
      }
      tip.style.display = 'block';
      const r = tip.getBoundingClientRect();
      let x = ev.clientX + 14, y = ev.clientY + 16;
      if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - 10;
      if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - 10;
      tip.style.left = x + 'px';
      tip.style.top = y + 'px';
    } else {
      tip.style.display = 'none';
    }
  });
}

function dbgSlider(body, label, key, min, max, step) {
  const row = document.createElement('div');
  row.className = 'drow';
  const lab = document.createElement('label');
  lab.append(label);
  const val = document.createElement('span');
  val.className = 'dval';
  val.textContent = G.dbg[key] + 'x';
  lab.appendChild(val);
  const inp = document.createElement('input');
  inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = G.dbg[key];
  inp.dataset.dbgkey = key;
  inp.addEventListener('input', () => {
    G.dbg[key] = +inp.value;
    val.textContent = (+inp.value) + 'x';
  });
  row.appendChild(lab); row.appendChild(inp);
  body.appendChild(row);
}

// ===== 调试面板可发放的资源清单（按类别分组，覆盖全部可获取材料/流体/弹药/科技包/建筑实体等）=====
// 每组：[类别名, [[物品id, 发放数量], ...]]
const DBG_GIVE_GROUPS = [
  ['矿石', [
    ['iron-ore', 100], ['copper-ore', 100], ['coal', 100], ['stone', 100],
    ['uranium-ore', 100], ['calcite', 100], ['raw-fish', 20]
  ]],
  ['板材·材料', [
    ['iron-plate', 200], ['copper-plate', 200], ['steel-plate', 100], ['stone-brick', 100],
    ['iron-gear', 100], ['iron-stick', 100], ['steel-stick', 100], ['copper-cable', 100],
    ['plastic-bar', 100], ['wood', 100], ['concrete', 100], ['refined-concrete', 100],
    ['hazard-concrete', 100], ['stone-path', 100], ['landfill', 100]
  ]],
  ['电路·元件', [
    ['green-circuit', 100], ['red-wire', 100], ['green-wire', 100],
    ['advanced-circuit', 100], ['processing-unit', 100], ['engine-unit', 50], ['electric-engine', 50]
  ]],
  ['燃料', [
    ['solid-fuel', 100], ['battery', 100], ['nuclear-fuel', 20], ['used-up-uranium-fuel-cell', 20]
  ]],
  ['科学包', [
    ['science-pack', 50], ['green-science', 50], ['blue-science', 50],
    ['military-science', 50], ['production-science-pack', 50], ['utility-science-pack', 50],
    ['space-science-pack', 50]
  ]],
  ['流体', [
    ['water', 500], ['steam', 500], ['crude-oil', 500], ['heavy-oil', 500],
    ['light-oil', 500], ['petroleum-gas', 500], ['lubricant', 500], ['sulfuric-acid', 500],
    ['sulfur', 100]
  ]],
  ['弹药·武器', [
    ['magazine', 100], ['piercing-rounds', 100], ['uranium-rounds', 100],
    ['shotgun-shell', 100], ['piercing-shotgun-shell', 100], ['flamethrower-ammo', 100],
    ['rocket', 50], ['explosive-rocket', 50], ['cannon-shell', 50], ['explosive-cannon-shell', 50],
    ['explosive-uranium-cannon-shell', 50], ['artillery-shell', 20], ['uranium-cannon-shell', 50],
    ['grenade', 50], ['cluster-grenade', 50], ['poison-capsule', 50], ['slowdown-capsule', 50],
    ['land-mine', 50], ['explosive', 100], ['cliff-explosives', 50]
  ]],
  ['模块', [
    ['speed-module', 50], ['speed-module-2', 50], ['speed-module-3', 50],
    ['productivity-module', 50], ['productivity-module-2', 50], ['productivity-module-3', 50],
    ['efficiency-module', 50], ['efficiency-module-2', 50], ['efficiency-module-3', 50]
  ]],
  ['核能', [
    ['uranium-235', 20], ['uranium-238', 100], ['uranium-cannon-shell', 50],
    ['atomic-bomb', 5], ['nuclear-fuel', 20]
  ]],
  ['装备·机器人', [
    ['repair-pack', 50], ['iron-axe', 5], ['steel-axe', 5], ['light-armor', 5], ['heavy-armor', 5],
    ['logistic-robot', 20], ['construction-robot', 20], ['flying-robot-frame', 20],
    ['defender-capsule', 20], ['distractor-capsule', 20], ['destroyer-capsule', 20]
  ]],
  ['桶装流体', [
    ['water-barrel', 50], ['steam-barrel', 50], ['crude-oil-barrel', 50], ['heavy-oil-barrel', 50],
    ['light-oil-barrel', 50], ['petroleum-gas-barrel', 50], ['lubricant-barrel', 50], ['sulfuric-acid-barrel', 50]
  ]],
  ['载具·建筑', [
    ['car', 5], ['tank', 5], ['spidertron', 5], ['locomotive', 5], ['diesel-locomotive', 5], ['cargo-wagon', 5],
    ['fluid-wagon', 5], ['artillery-wagon', 5], ['train-stop', 5], ['rail', 100], ['rail-signal', 50], ['rail-chain-signal', 50]
  ]],
  ['物流·传送带', [
    ['transport-belt', 100], ['fast-transport-belt', 100], ['express-transport-belt', 100],
    ['splitter', 50], ['fast-splitter', 50], ['express-splitter', 50],
    ['underground', 50], ['fast-underground-belt', 50], ['express-underground-belt', 50]
  ]],
  ['机械臂', [
    ['burner-inserter', 50], ['inserter', 50], ['long-inserter', 50], ['fast-inserter', 50],
    ['stack-inserter', 50]
  ]],
  ['生产·建筑', [
    ['burner-drill', 20], ['electric-drill', 20], ['pumpjack', 20],
    ['stone-furnace', 20], ['steel-furnace', 20], ['electric-furnace', 20],
    ['assembling-machine', 20], ['assembling-machine-mk2', 20], ['assembling-machine-3', 20],
    ['chemical-plant', 20], ['refinery', 10], ['lab', 20], ['beacon', 10], ['radar', 10], ['rocket-silo', 5]
  ]],
  ['储物·物流', [
    ['wooden-chest', 20], ['iron-chest', 20], ['storage-chest', 20], ['steel-chest', 20],
    ['logistic-chest-passive', 20], ['logistic-chest-active', 20], ['logistic-chest-storage', 20],
    ['logistic-chest-requester', 20], ['logistic-chest-buffer', 20], ['roboport', 10]
  ]],
  ['电力·能源', [
    ['boiler', 20], ['steam-engine', 20], ['offshore-pump', 20],
    ['solar-panel', 20], ['accumulator', 20], ['passive-power', 20],
    ['small-electric-pole', 50], ['medium-electric-pole', 50], ['big-electric-pole', 50], ['substation', 20]
  ]],
  ['流体·管道', [
    ['pipe', 100], ['pipe-to-ground', 50], ['pump', 20], ['storage-tank', 20]
  ]],
  ['防御·军事', [
    ['stone-wall', 100], ['gate', 50], ['gun-turret', 20], ['laser-turret', 20],
    ['flamethrower-turret', 20], ['artillery-turret', 10], ['land-mine', 50]
  ]],
  ['电路·信号', [
    ['constant-combinator', 20], ['arithmetic-combinator', 20], ['decider-combinator', 20],
    ['power-switch', 20], ['programmable-speaker', 20], ['lamp', 50]
  ]],
  ['核能·建筑', [
    ['centrifuge', 10], ['nuclear-reactor', 5], ['steam-turbine', 20],
    ['heat-pipe', 50], ['heat-exchanger', 20]
  ]],
  ['测试设备', [
    ['creative-chest', 10], ['void-chest', 10], ['creative-belt', 10], ['void-belt', 10],
    ['creative-pipe', 10], ['void-pipe', 10]
  ]]
];

const DBG_BTN_POS_KEY = 'factory_dbg_btn_pos';

function buildDebug() {
  const btn = document.getElementById('dbg-btn');
  const panel = document.getElementById('dbg-panel');
  // 仅当 URL 参数含 debug=1 时才显示 debug 按钮
  btn.style.display = G.debugEnabled ? 'flex' : 'none';
  if (!G.debugEnabled) { panel.style.display = 'none'; return; }
  // 恢复上次拖拽保存的按钮位置（记录屏幕坐标，跨启动保留）
  try {
    const saved = localStorage.getItem(DBG_BTN_POS_KEY);
    if (saved) {
      const p = JSON.parse(saved);
      if (typeof p.left === 'number' && typeof p.top === 'number') {
        btn.style.left = Math.max(4, Math.min(innerWidth - 50, p.left)) + 'px';
        btn.style.top = Math.max(4, Math.min(innerHeight - 50, p.top)) + 'px';
        btn.style.right = 'auto';
        btn.style.bottom = 'auto';
      }
    }
  } catch (e) {}
  panel.innerHTML = '<div class="dhead"><span>开发者调试</span><button id="dbg-x">✕</button></div>';
  const body = document.createElement('div');
  body.className = 'dbody';
  panel.appendChild(body);

  dbgSlider(body, '游戏速度', 'timeScale', 0, 5, 0.1);
  dbgSlider(body, '移动速度', 'moveSpeed', 0.2, 4, 0.1);
  dbgSlider(body, '挖矿速度', 'mineMult', 0.25, 10, 0.25);
  dbgSlider(body, '传送带速度', 'beltMult', 0.25, 5, 0.25);
  dbgSlider(body, '采矿机速度', 'drillMult', 0.25, 5, 0.25);
  dbgSlider(body, '组装机速度', 'asmMult', 0.25, 5, 0.25);

  // ---- 操作区域（含“开关”与“动作”两个子区，置于“发放资源”之上） ----
  const opSec = document.createElement('div');
  opSec.className = 'dsec';
  opSec.textContent = '操作';
  body.appendChild(opSec);

  // 子区一：开关（全部以勾选方式展示）
  const swSec = document.createElement('div');
  swSec.className = 'dsec-sub';
  swSec.textContent = '开关';
  body.appendChild(swSec);
  const swList = document.createElement('div');
  swList.className = 'dswlist';
  const switches = [
    {
      key: 'infinite', label: '无限资源', dataKey: 'dbgSwitch',
      on() { toast('无限资源模式已开启：建造不消耗原料，可直接建造测试箱（创造/虚空）与测试管道（创造/虚空）'); refreshHotbar(); },
      off() { toast('无限资源模式已关闭'); refreshHotbar(); }
    },
    {
      key: 'farReach', label: '无限交互距离', dataKey: 'dbgSwitch',
      on() { toast('无限交互距离已开启：可对任意远的格子交互/建造'); },
      off() { toast('无限交互距离已关闭'); }
    },
    {
      key: 'noclip', label: '主角无视碰撞', dataKey: 'dbgSwitch',
      on() { toast('主角无视碰撞已开启：可穿过水/峭壁/树木等障碍'); },
      off() { toast('主角无视碰撞已关闭'); }
    },
    {
      key: 'combat', label: '切换战斗', dataKey: 'dbgSwitch', source: 'settings',
      on() { toast('战斗模式：开启'); },
      off() { G.enemies = []; G.bullets = []; G.enemyProjectiles = []; toast('战斗模式：关闭'); }
    }
  ];
  for (const sw of switches) {
    const row = document.createElement('label');
    row.className = 'dsw';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.dataset[sw.dataKey] = sw.key;
    const val = sw.source === 'settings' ? !!G.settings[sw.key] : !!G.dbg[sw.key];
    box.checked = val;
    box.addEventListener('change', () => {
      const on = box.checked;
      if (sw.source === 'settings') {
        G.settings[sw.key] = on;
      } else {
        G.dbg[sw.key] = on;
      }
      (on ? sw.on : sw.off)();
    });
    row.appendChild(box);
    const span = document.createElement('span');
    span.textContent = sw.label;
    row.appendChild(span);
    swList.appendChild(row);
  }
  body.appendChild(swList);

  // 子区二：动作（一次性操作按钮）
  const opSubSec = document.createElement('div');
  opSubSec.className = 'dsec-sub';
  opSubSec.textContent = '动作';
  body.appendChild(opSubSec);
  const grid2 = document.createElement('div');
  grid2.className = 'dgrid';
  const acts = [
    ['一键重置所有功能', () => {
      Object.assign(G.dbg, { timeScale: 1, moveSpeed: 1, mineMult: 1, beltMult: 1, drillMult: 1, asmMult: 1, infinite: false, farReach: false, noclip: false });
      G.settings.combat = false;
      if (!G.settings.combat) { G.enemies = []; G.bullets = []; G.enemyProjectiles = []; }
      buildDebug();
      panel.style.display = 'block';
      refreshHotbar();
      toast('所有调试功能已重置为默认值');
    }],
    ['重置速度', () => {
      Object.assign(G.dbg, { timeScale: 1, moveSpeed: 1, mineMult: 1, beltMult: 1, drillMult: 1, asmMult: 1 });
      buildDebug();
      panel.style.display = 'block';
      toast('所有速度已重置为 1x');
    }],
    ['完成研究', () => {
      const t = G.activeTech;
      if (!t) { toast('没有进行中的研究'); return; }
      G.techProg[t] = techCostTotal(t);
      G.techDone[t] = true;
      toast('研究完成：' + TECHS[t].name);
      G.activeTech = null;
      renderPanel(false);
    }],
    ['一键回退所有研究', () => {
      // 一键回退所有研究：遍历整个科技/研究树，将每项标记为未完成并清空研究进度
      let cnt = 0;
      for (const t in TECHS) {
        if (!TECHS[t]) continue;
        G.techDone[t] = false;
        delete G.techProg[t];
        cnt++;
      }
      G.activeTech = null; G.techQueue = [];
      toast('已一键回退全部 ' + cnt + ' 项研究');
      renderPanel(false);
    }],
    ['回出生点', () => {
      G.player.x = G.spawn.x * TILE + TILE / 2;
      G.player.y = G.spawn.y * TILE + TILE / 2;
    }],
    ['清空建筑', () => {
      for (const e of G.ents.slice()) removeEnt(e);
      closePanel();
      toast('建筑已清空');
    }],
    ['移除当前区域峭壁', () => {
      // 一键移除当前显示区域内的悬崖峭壁（对齐《异星工厂》峭壁清除，变回草地）
      const b = (typeof viewBounds === 'function') ? viewBounds() : null;
      if (!b) { toast('无法获取视口范围'); return; }
      const minTx = Math.floor(Math.min(b.x0, b.x1) / TILE);
      const maxTx = Math.floor(Math.max(b.x0, b.x1) / TILE);
      const minTy = Math.floor(Math.min(b.y0, b.y1) / TILE);
      const maxTy = Math.floor(Math.max(b.y0, b.y1) / TILE);
      let cnt = 0;
      for (let ty = minTy; ty <= maxTy; ty++) {
        for (let tx = minTx; tx <= maxTx; tx++) {
          if (getTerrain(tx, ty) === T_CLIFF) {
            setTerrain(tx, ty, T_GRASS);
            if (typeof invalidateTerrainChunk === 'function') invalidateTerrainChunk(tx, ty);
            cnt++;
          }
        }
      }
      if (typeof uiDirty !== 'undefined') uiDirty = true;
      toast(cnt ? ('已移除 ' + cnt + ' 格峭壁') : '当前显示区域没有峭壁');
    }],
    ['新地图', () => { newGame(); closePanel(); toast('新地图已生成'); }],
    ['一键完成全部科技', () => {
      for (const t in TECHS) {
        G.techDone[t] = true;
        if (G.techProg[t] === undefined) G.techProg[t] = techCostTotal(t);
      }
      G.activeTech = null; G.techQueue = [];
      toast('已解锁全部 ' + Object.keys(TECHS).length + ' 项科技');
      renderPanel(false);
    }],
    ['回满血', () => {
      G.playerHP = G.playerHPmax;
      toast('生命值已恢复满');
    }],
    ['清除污染', () => {
      if (typeof pollutionRestore === 'function') pollutionRestore({ pollution: 0 });
      else G.pollution = 0;
      toast('污染已清零');
    }],
    ['清空敌人', () => {
      G.enemies = []; G.bullets = []; G.enemyProjectiles = [];
      toast('已清空全部敌人与弹幕');
    }],
    ['在面前刷一批敌人', () => {
      if (!G.settings.combat) { toast('请先开启战斗模式'); return; }
      if (typeof pickEnemyType === 'function' && typeof scaledDef === 'function' && ENEMY_TYPES) {
        for (let i = 0; i < 8; i++) {
          const t = pickEnemyType();
          const def = scaledDef(ENEMY_TYPES[t]);
          const px = G.player.x / TILE, py = G.player.y / TILE;
          const ang = Math.random() * Math.PI * 2;
          const dist = 6 + Math.random() * 4;
          const tx = Math.round(px + Math.cos(ang) * dist);
          const ty = Math.round(py + Math.sin(ang) * dist);
          G.enemies.push({
            x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2,
            hp: def.hp, maxhp: def.hp, dead: false, dir: 0,
            type: t, kind: def.kind, speed: def.speed, size: def.size, dmg: def.dmg,
            color: def.color, attackT: 0, fireT: 0
          });
        }
        toast('已在周围生成 8 只敌人');
      } else { toast('战斗系统不可用'); }
    }],
    ['日夜切换', () => {
      const cycle = (typeof DAY_CYCLE === 'number') ? DAY_CYCLE : 60;
      const ph = ((G.time / cycle) % 1 + 1) % 1;
      G.time = Math.floor(G.time / cycle) * cycle + cycle * (ph > 0.5 ? 0.02 : 0.5);
      toast('时间已切换');
    }]
  ];
  for (const [txt, fn] of acts) {
    const b = document.createElement('button');
    b.textContent = txt;
    b.dataset.dbgact = txt;
    b.addEventListener('click', fn);
    grid2.appendChild(b);
  }
  body.appendChild(grid2);

  const sec1 = document.createElement('div');
  sec1.className = 'dsec';
  sec1.textContent = '发放资源';
  body.appendChild(sec1);

  // 搜索筛选框：输入关键词实时过滤资源按钮
  const searchRow = document.createElement('div');
  searchRow.className = 'dsearch';
  const searchInp = document.createElement('input');
  searchInp.type = 'text';
  searchInp.placeholder = '🔍 搜索资源（名称/类别）…';
  searchRow.appendChild(searchInp);
  body.appendChild(searchRow);

  const grid1 = document.createElement('div');
  grid1.className = 'dgrid';
  body.appendChild(grid1);

  // 渲染资源按钮到 grid1；kw 为空显示全部（含分组标题）
  function renderGiveGrid(kw) {
    grid1.innerHTML = '';
    const q = (kw || '').trim().toLowerCase();
    let any = false;
    for (const [cat, list] of DBG_GIVE_GROUPS) {
      const matched = q ? list.filter(([id]) => {
        const it = ITEMS[id];
        return (it && it.name && it.name.toLowerCase().indexOf(q) >= 0) || id.indexOf(q) >= 0;
      }) : list;
      if (!matched.length) continue;
      any = true;
      const head = document.createElement('div');
      head.className = 'dgroup';
      head.textContent = cat;
      grid1.appendChild(head);
      for (const [id, n] of matched) {
        const it = ITEMS[id];
        const b = document.createElement('button');
        b.textContent = (it ? it.name : id) + ' +' + n;
        b.title = (it && it.desc) ? it.desc : id;
        b.addEventListener('click', () => { invAdd(id, n); toast('+ ' + n + ' ' + (it ? it.name : id)); refreshHotbar(); });
        grid1.appendChild(b);
      }
    }
    if (!any) {
      const none = document.createElement('div');
      none.className = 'dnone';
      none.textContent = '无匹配资源';
      grid1.appendChild(none);
    }
  }
  searchInp.addEventListener('input', () => renderGiveGrid(searchInp.value));
  renderGiveGrid('');

  // 一键发放全部资源（便于快速搭建设置好测试环境）
  const giveAllBtn = document.createElement('button');
  giveAllBtn.textContent = '一键发放全部资源';
  giveAllBtn.className = 'dgiveall';
  giveAllBtn.addEventListener('click', () => {
    let cnt = 0;
    for (const [, list] of DBG_GIVE_GROUPS) for (const [id, n] of list) { invAdd(id, n); cnt++; }
    toast('已发放 ' + cnt + ' 种资源');
    refreshHotbar();
  });
  body.appendChild(giveAllBtn);

  document.getElementById('dbg-x').addEventListener('click', () => { panel.style.display = 'none'; });

  let drag = null;
  let suppressClick = false;
  // 展开/收起 Debug 面板（鼠标点击与触屏轻点共用）
  function togglePanel() {
    if (panel.style.display === 'block') { panel.style.display = 'none'; return; }
    const r = btn.getBoundingClientRect();
    let x = r.right + 8, y = r.top;
    if (x + 260 > innerWidth) x = Math.max(8, r.left - 262);
    y = Math.max(8, Math.min(innerHeight - 330, y));
    panel.style.left = x + 'px';
    panel.style.top = y + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.display = 'block';
  }
  // 拖拽 Debug 按钮：统一处理鼠标 / 触屏，使触屏模式下也能拖动按钮
  function moveDebugBtn(cx, cy) {
    if (!drag) return;
    if (Math.abs(cx - drag.sx) + Math.abs(cy - drag.sy) > 6) drag.moved = true;
    if (drag.moved) {
      btn.style.left = Math.max(4, Math.min(innerWidth - 50, drag.bx + cx - drag.sx)) + 'px';
      btn.style.top = Math.max(4, Math.min(innerHeight - 50, drag.by + cy - drag.sy)) + 'px';
      btn.style.right = 'auto';
      btn.style.bottom = 'auto';
    }
  }
  function endDebugDrag() {
    if (drag) {
      suppressClick = drag.moved;
      // 记录拖拽后的最终位置（仅当确实移动过），跨启动恢复到上次位置
      if (drag.moved) {
        try {
          localStorage.setItem(DBG_BTN_POS_KEY, JSON.stringify({ left: btn.offsetLeft, top: btn.offsetTop }));
        } catch (e) {}
      }
    }
    drag = null;
  }
  btn.addEventListener('mousedown', ev => {
    drag = { sx: ev.clientX, sy: ev.clientY, bx: btn.offsetLeft, by: btn.offsetTop, moved: false };
    ev.preventDefault();
  });
  window.addEventListener('mousemove', ev => moveDebugBtn(ev.clientX, ev.clientY));
  window.addEventListener('mouseup', endDebugDrag);
  // 触屏拖拽：使用与摇杆一致的 touch 事件处理方式。
  // 注意：touchstart 里 preventDefault 会抑制系统生成的 click 事件，
  // 因此触屏的“轻点展开”需在 touchend 里根据是否拖动过自行触发。
  btn.addEventListener('touchstart', ev => {
    const t = ev.changedTouches[0];
    if (!t) return;
    drag = { sx: t.clientX, sy: t.clientY, bx: btn.offsetLeft, by: btn.offsetTop, moved: false };
    ev.preventDefault();
  }, { passive: false });
  window.addEventListener('touchmove', ev => {
    if (!drag) return;
    for (const t of ev.changedTouches) {
      moveDebugBtn(t.clientX, t.clientY);
      break;
    }
    ev.preventDefault();
  }, { passive: false });
  window.addEventListener('touchend', ev => {
    // 仅当触摸起始于 Debug 按钮（touchstart 设置了 drag）时才可能展开/收起面板；
    // 否则在屏幕其他位置点触会误触发面板切换（此前 bug）。
    const wasOnBtn = !!drag;
    const wasMoved = drag && drag.moved;
    endDebugDrag();
    // 轻点（未拖动）时展开/收起面板，拖动后不触发
    if (wasOnBtn && !wasMoved && !suppressClick) togglePanel();
  });
  window.addEventListener('touchcancel', endDebugDrag);
  btn.addEventListener('click', () => {
    if (suppressClick) { suppressClick = false; return; }
    togglePanel();
  });
}

// 读档后刷新Debug面板，使已恢复的调试数据显示在面板上
function refreshDebugPanel() {
  const panel = document.getElementById('dbg-panel');
  if (!panel) return;
  // 更新速度滑块及其数值显示
  panel.querySelectorAll('input[data-dbgkey]').forEach(inp => {
    const key = inp.dataset.dbgkey;
    if (G.dbg[key] === undefined) return;
    inp.value = G.dbg[key];
    const row = inp.closest('.drow');
    if (row) {
      const val = row.querySelector('.dval');
      if (val) val.textContent = G.dbg[key] + 'x';
    }
  });
  // 更新开关勾选框（无限资源 / 无限交互距离 / 主角无视碰撞 / 切换战斗）
  panel.querySelectorAll('input[data-dbg-switch]').forEach(box => {
    const key = box.dataset.dbgSwitch;
    if (key === 'combat') box.checked = !!G.settings.combat;
    else if (G.dbg[key] !== undefined) box.checked = !!G.dbg[key];
  });
}

// ===== 虚拟摇杆（手机/触屏移动） =====
// 摇杆状态存于 G.joystick；仅在开启"虚拟摇杆"设置且设备为触屏时显示。
// 拖拽摇杆把位移量归一化为 [-1,1] 的 dx/dy，供 updatePlayer 叠加到移动方向。
function updateJoystickVisibility() {
  const el = document.getElementById('joystick');
  if (!el) return;
  const touchCapable = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const show = !!(G.settings.virtualJoystick && touchCapable);
  if (show) {
    el.classList.add('active');
    el.classList.remove('hidden');
  } else {
    el.classList.remove('active');
    el.classList.add('hidden');
  }
}

function initJoystick() {
  const el = document.getElementById('joystick');
  if (!el) return;
  const knob = document.getElementById('joystick-knob');
  const MAX = 40;   // 摇杆最大拖动半径（px）

  // 摇杆本体位置固定不动（由 CSS 定位），拖动时只移动内部旋钮
  function resetKnob() {
    if (knob) knob.style.transform = 'translate(0px,0px)';
  }
  function resetJoystick() {
    G.joystick.active = false;
    G.joystick.id = null;
    G.joystick.dx = 0;
    G.joystick.dy = 0;
    resetKnob();
  }

  el.addEventListener('touchstart', ev => {
    if (!G.settings.virtualJoystick) return;
    ev.preventDefault();
    const t = ev.changedTouches[0];
    if (!t) return;
    G.joystick.active = true;
    G.joystick.id = t.identifier;
    G.joystick.baseX = t.clientX;
    G.joystick.baseY = t.clientY;
    G.joystick.dx = 0;
    G.joystick.dy = 0;
    // 摇杆本体位置保持不变，仅记录手指起点作为旋钮位移基准
    resetKnob();
  }, { passive: false });

  el.addEventListener('touchmove', ev => {
    if (!G.settings.virtualJoystick || !G.joystick.active) return;
    ev.preventDefault();
    for (const t of ev.changedTouches) {
      if (t.identifier !== G.joystick.id) continue;
      let dx = t.clientX - G.joystick.baseX;
      let dy = t.clientY - G.joystick.baseY;
      const len = Math.hypot(dx, dy);
      if (len > MAX) {
        // 只把旋钮限制在最大半径内，摇杆本体位置保持不变
        dx = dx / len * MAX;
        dy = dy / len * MAX;
      }
      // 归一化到 [-1,1]，带死区避免轻微抖动
      G.joystick.dx = Math.abs(dx) < 4 ? 0 : dx / MAX;
      G.joystick.dy = Math.abs(dy) < 4 ? 0 : dy / MAX;
      if (knob) knob.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    }
  }, { passive: false });

  el.addEventListener('touchend', ev => {
    if (!G.settings.virtualJoystick) return;
    ev.preventDefault();
    for (const t of ev.changedTouches) {
      if (t.identifier === G.joystick.id) resetJoystick();
    }
  });
  el.addEventListener('touchcancel', ev => {
    if (!G.settings.virtualJoystick) return;
    ev.preventDefault();
    for (const t of ev.changedTouches) {
      if (t.identifier === G.joystick.id) resetJoystick();
    }
  });

  updateJoystickVisibility();
}
