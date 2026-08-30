'use strict';

// ===== 创造设备通用「物品/流体选择器」（创造箱/创造传送带/创造管道共用）=====
// 内嵌于设备面板右侧（面板布局：左=玩家背包，右=本列表），不再弹出 #hud-modal 弹窗。
// 复用背包制作栏/机械臂筛选弹窗的交互与样式：
//   · 5 大分类 Tab（官方 item-group 单源归类，见 GAME_DATA.itemGroup / CRAFT_TABS）；
//   · Tab 内按官方二级分组（item-subgroup）分组渲染，组序 subgroupOrder、组内 itemOrder；
//   · 支持按名称/ID 搜索，Tab 角标同步命中数、空 Tab 自动隐藏/回退；
//   · 仅显示图标，悬停显示与合成列表一致的物品 tooltip（data-tip → #tooltip）。
// 交互：Tab 切换/物品点选由 document 捕获阶段监听就地处理（阻止冒泡到 #panel-body
// 分发器，避免整面板重建打断交互）；搜索过滤走 #panel-body 的 input 分发（applyPanelSearch）。

let _cipCtx = null;   // { e, kind:'item'|'fluid', ids, tab, q }

// 可选集合：item=全部非流体物品（创造箱/创造传送带）；fluid=全部流体（创造管道）
function creativePickerIds(kind) {
  return kind === 'fluid' ? FLUIDS.filter(f => ITEMS[f]) : creativeItemChoices();
}

// 内嵌选择器 HTML：搜索框 + 5 大分类 Tab + 各 Tab 分组网格（仅图标、悬停 tooltip）。
// 由各创造设备面板 html 函数调用，每次面板渲染都会重建本块；
// 激活 Tab/搜索词在 _cipCtx 中延续（同一设备重复渲染时保持浏览状态）。
function creativePickerHtml(e, kind) {
  const sameCtx = _cipCtx && _cipCtx.e === e && _cipCtx.kind === kind;
  const perTab = { logistics: [], production: [], 'intermediate-products': [], space: [], combat: [] };
  for (const id of creativePickerIds(kind)) {
    const tab = (GAME_DATA.itemGroup && GAME_DATA.itemGroup[id]) ||
      (kind === 'fluid' ? 'production' : 'logistics');
    if (!perTab[tab]) continue;
    perTab[tab].push(id);
  }
  let tab = sameCtx ? _cipCtx.tab : 'logistics';
  // 当前分类没有任何可选物品时，回退到第一个非空分类（空分类 Tab 不显示）
  if (!(perTab[tab] && perTab[tab].length)) {
    tab = CRAFT_TABS.find(t => perTab[t] && perTab[t].length) || 'logistics';
  }
  const q = sameCtx ? _cipCtx.q : '';
  _cipCtx = { e, kind, tab, q };
  const label = kind === 'fluid' ? '流体' : '物品';
  let h = '<div class="sec">选择要生成的' + label + '</div>';
  h += '<div class="cip-modal cip-embed">';
  h += '<input id="cip-search" class="inv-search" type="text" placeholder="搜索' + label + '（输入名称）" autocomplete="off" value="' + q.replace(/"/g, '&quot;') + '">';
  // 5 大分类 Tab 栏（与背包制作栏/配方选择面板同款样式）
  h += '<div class="craft-tabs" id="cip-tabs">';
  for (const t of CRAFT_TABS) {
    const n = (perTab[t] || []).length;
    if (!n) continue; // 该分类没有任何可选物品的 Tab 不显示
    const on = t === tab ? ' active' : '';
    const lb = CRAFT_TAB_LABEL[t];
    h += '<button type="button" class="craft-tab' + on + '" data-act="cip-tab" data-tab="' + t + '">' +
      '<span class="tab-icon">' + lb.icon + '</span><span class="tab-label">' + lb.text + '</span>' +
      '<span class="cnt">' + n + '</span></button>';
  }
  h += '</div>';
  // 各 Tab 分组网格：Tab 内按官方二级分组（item-subgroup）归类，组序按 subgroupOrder、组内按 itemOrder
  for (const t of CRAFT_TABS) {
    const on = t === tab ? '' : ' style="display:none"';
    const items = perTab[t] || [];
    const groups = new Map();
    for (const id of items) {
      const sg = (GAME_DATA.itemSubgroup && GAME_DATA.itemSubgroup[id]) || '';
      if (!groups.has(sg)) groups.set(sg, []);
      groups.get(sg).push(id);
    }
    const sgList = Array.from(groups.keys()).sort(officialSubgroupCompare);
    let grid = '';
    for (const sg of sgList) {
      const list = groups.get(sg).slice().sort((x, y) => officialItemCompare(x, y));
      grid += '<div class="flt-subgroup">' +
        (sg ? '<div class="flt-sg-label">' + fltSubgroupLabel(sg) + '</div>' : '');
      for (const id of list) {
        const sel = e.selected === id;
        grid += '<button type="button" class="flt-item cip-item' + (sel ? ' sel' : '') + '" data-act="cip-choose" data-id="' + id + '"' +
          ' data-rsearch="' + (ITEMS[id].name + ' ' + id).toLowerCase().replace(/"/g, '') + '"' +
          ' data-tip="' + itemTip(id) + '">' +
          '<img src="' + iconDataURL(id) + '"></button>';
      }
      grid += '</div>';
    }
    h += '<div class="flt-grid" data-tab="' + t + '"' + on + '>' + grid + '</div>';
  }
  h += '<div class="dim" id="cip-empty" style="display:none"></div>';
  h += '</div>';
  return h;
}

// 搜索过滤：就地隐藏不匹配项（不重建 DOM，保住输入焦点），分组与 Tab 角标同步
function applyCipSearch(q) {
  if (!_cipCtx) return;
  const ql = (q || '').trim().toLowerCase();
  _cipCtx.q = q;
  const body = document.getElementById('panel-body');
  if (!body) return;
  for (const grid of body.querySelectorAll('.cip-modal .flt-grid')) {
    if (grid.dataset.tab !== _cipCtx.tab) { grid.style.display = 'none'; continue; }
    grid.style.display = '';
    for (const it of grid.querySelectorAll('.cip-item')) {
      const hit = !ql || (it.dataset.rsearch || '').includes(ql);
      it.style.display = hit ? '' : 'none';
    }
    // 搜索时隐藏没有任何可见物品的二级分组（保持分组紧凑）
    for (const grp of grid.querySelectorAll('.flt-subgroup')) {
      grp.style.display = Array.from(grp.querySelectorAll('.cip-item'))
        .some(el => el.style.display !== 'none') ? '' : 'none';
    }
  }
  // 搜索时同步更新 Tab 角标为「命中数量」，隐藏命中为 0 的 Tab；
  // 当前激活 Tab 命中 0 时自动切换到第一个仍有结果的 Tab
  _cipCtx.tab = updateCraftTabCounts(body, '#cip-tabs .craft-tab',
    tab => body.querySelector('.cip-modal .flt-grid[data-tab="' + tab + '"]'), '.cip-item', ql, _cipCtx.tab);
  // 空态提示以（可能已切换的）当前激活 Tab 为准
  const activeGrid = body.querySelector('.cip-modal .flt-grid[data-tab="' + _cipCtx.tab + '"]');
  const shown = activeGrid ? Array.from(activeGrid.querySelectorAll('.cip-item')).filter(el => el.style.display !== 'none').length : 0;
  const emp = document.getElementById('cip-empty');
  if (emp) {
    emp.textContent = ql ? '没有匹配「' + q.trim() + '」的结果' : '该分类暂无可选' + (_cipCtx.kind === 'fluid' ? '流体' : '物品');
    emp.style.display = shown ? 'none' : '';
  }
}

// Tab 切换：就地显隐网格（不重建面板，保住搜索框焦点与已输入内容）
function creativePickerSwitchTab(tab) {
  if (!_cipCtx) return;
  if (CRAFT_TABS.indexOf(tab) < 0) tab = 'logistics';
  _cipCtx.tab = tab;
  const body = document.getElementById('panel-body');
  if (!body) return;
  for (const b of body.querySelectorAll('#cip-tabs .craft-tab')) b.classList.toggle('active', b.dataset.tab === tab);
  for (const t of CRAFT_TABS) {
    const g = body.querySelector('.cip-modal .flt-grid[data-tab="' + t + '"]');
    if (g) g.style.display = (t === tab) ? '' : 'none';
  }
  applyCipSearch(_cipCtx.q || '');
}

// 点击物品：写入设备 selected 并重建面板（刷新当前生成物 chip、选中高亮与状态文字）
function creativePickerPick(id) {
  const e = _cipCtx ? _cipCtx.e : null;
  if (!e) return;
  e.selected = id;
  uiDirty = true;
  renderPanel(false);
}

// 内嵌选择器交互：捕获阶段优先拦截（早于 #panel-body 的 click 分发），
// 阻止冒泡触发整面板重建/设备 onAction 兜底链；仅当本选择器仍对应当前面板设备时生效。
document.addEventListener('click', ev => {
  if (!_cipCtx || _cipCtx.e !== G.panelEnt) return;
  const tab = ev.target.closest && ev.target.closest('#cip-tabs .craft-tab[data-tab]');
  if (tab) { ev.stopPropagation(); ev.preventDefault(); creativePickerSwitchTab(tab.dataset.tab); return; }
  const item = ev.target.closest && ev.target.closest('.cip-item[data-id]');
  if (item) { ev.stopPropagation(); ev.preventDefault(); creativePickerPick(item.dataset.id); }
}, true);
