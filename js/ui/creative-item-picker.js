'use strict';

// ===== 创造设备通用「物品/流体选择器」（创造箱/创造传送带/创造管道共用）=====
// 复用背包制作栏右侧合成列表、机械臂筛选弹窗的交互与样式：
//   · 5 大分类 Tab（官方 item-group 单源归类，见 GAME_DATA.itemGroup / CRAFT_TABS）；
//   · Tab 内按官方二级分组（item-subgroup）分组渲染，组序 subgroupOrder、组内 itemOrder；
//   · 支持按名称/ID 搜索，搜索时 Tab 角标同步命中数量、空 Tab 自动隐藏/回退；
//   · 仅显示图标，悬停显示与合成列表一致的物品 tooltip（data-tip → #rcp-tip）。
// 弹窗复用 #hud-modal（flt-wide 加宽模式），与机械臂「选择筛选物品」弹窗同一外壳。

let _cipCtx = null;          // { e: 设备实体, kind: 'item'|'fluid', ids: 可选物品 id 列表 }
let _cipTab = 'logistics';
let _cipQ = '';
let _cipComposing = false;

// 创造管道流体：按 5 大分类归类（官方无归类的兜底「生产」，如水/蒸汽/原油等基础流体）
function _cipFluidGroups() {
  const perTab = { logistics: [], production: [], 'intermediate-products': [], space: [], combat: [] };
  for (const id of FLUIDS) {
    if (!ITEMS[id]) continue;
    const tab = (GAME_DATA.itemGroup && GAME_DATA.itemGroup[id]) || 'production';
    if (!perTab[tab]) continue;
    perTab[tab].push(id);
  }
  return perTab;
}

// 弹窗 HTML：搜索框 + 5 大分类 Tab + 各 Tab 分组网格（仅图标、悬停 tooltip）
function creativeItemPickerHtml() {
  const { kind, ids } = _cipCtx;
  const e = _cipCtx.e;
  const perTab = { logistics: [], production: [], 'intermediate-products': [], space: [], combat: [] };
  for (const id of ids) {
    const tab = (GAME_DATA.itemGroup && GAME_DATA.itemGroup[id]) ||
      (kind === 'fluid' ? 'production' : 'logistics');
    if (!perTab[tab]) continue;
    perTab[tab].push(id);
  }
  // 当前分类没有任何可选物品时，回退到第一个非空分类（空分类 Tab 不显示）
  if (!(_cipTab && perTab[_cipTab] && perTab[_cipTab].length)) {
    _cipTab = CRAFT_TABS.find(t => perTab[t] && perTab[t].length) || 'logistics';
  }
  let h = '<div class="flt-modal cip-modal">';
  h += '<input id="cip-search" class="inv-search" type="text" placeholder="搜索' + (kind === 'fluid' ? '流体' : '物品') + '（输入名称）" autocomplete="off" value="' + _cipQ.replace(/"/g, '&quot;') + '">';
  // 5 大分类 Tab 栏（与背包制作栏/配方选择面板同款样式）
  h += '<div class="craft-tabs" id="cip-tabs">';
  for (const tab of CRAFT_TABS) {
    const n = (perTab[tab] || []).length;
    if (!n) continue; // 该分类没有任何可选物品的 Tab 不显示
    const on = tab === _cipTab ? ' active' : '';
    const label = CRAFT_TAB_LABEL[tab];
    h += '<button type="button" class="craft-tab' + on + '" data-act="cip-tab" data-tab="' + tab + '">' +
      '<span class="tab-icon">' + label.icon + '</span><span class="tab-label">' + label.text + '</span>' +
      '<span class="cnt">' + n + '</span></button>';
  }
  h += '</div>';
  // 各 Tab 分组网格：Tab 内按官方二级分组（item-subgroup）归类，组序按 subgroupOrder、组内按 itemOrder
  for (const tab of CRAFT_TABS) {
    const on = tab === _cipTab ? '' : ' style="display:none"';
    const items = perTab[tab] || [];
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
    h += '<div class="flt-grid" data-tab="' + tab + '"' + on + '>' + grid + '</div>';
  }
  h += '<div class="dim" id="cip-empty" style="display:none"></div>';
  h += '<div class="dim">点击' + (kind === 'fluid' ? '流体' : '物品') + '图标即选中并关闭，已选中项绿色高亮。</div>';
  h += '</div>';
  return h;
}

// 打开选择器：kind='item'（创造箱/创造传送带）或 'fluid'（创造管道）
function openCreativeItemPicker(e, kind) {
  if (!e) return;
  const ids = kind === 'fluid' ? FLUIDS.filter(f => ITEMS[f]) : creativeItemChoices();
  _cipCtx = { e, kind, ids };
  _cipTab = 'logistics';
  _cipQ = '';
  const title = document.getElementById('hud-modal-title');
  title.textContent = (ITEMS[e.type] ? ITEMS[e.type].name : e.type) + ' · 选择生成物';
  const body = document.getElementById('hud-modal-body');
  body.innerHTML = creativeItemPickerHtml();
  applyCipSearch('');
  const hm = document.getElementById('hud-modal');
  hm.classList.add('flt-wide');
  hm.classList.remove('hidden');
}

function closeCreativeItemPicker() {
  _cipCtx = null;
  const m = document.getElementById('hud-modal');
  m.classList.remove('flt-wide');
  m.classList.add('hidden');
  document.getElementById('hud-modal-body').innerHTML = '';
  uiDirty = true;
}

function creativeItemPickerSwitchTab(tab) {
  if (CRAFT_TABS.indexOf(tab) < 0) tab = 'logistics';
  _cipTab = tab;
  for (const b of document.querySelectorAll('#cip-tabs .craft-tab')) b.classList.toggle('active', b.dataset.tab === tab);
  for (const t of CRAFT_TABS) {
    const g = document.querySelector('#hud-modal-body .cip-modal .flt-grid[data-tab="' + t + '"]');
    if (g) g.style.display = (t === tab) ? '' : 'none';
  }
  applyCipSearch(_cipQ);
}

// 搜索过滤：就地隐藏不匹配项（不重建 DOM，保住输入焦点），分组与 Tab 角标同步
function applyCipSearch(q) {
  const ql = (q || '').trim().toLowerCase();
  _cipQ = q;
  const modalBody = document.getElementById('hud-modal-body');
  if (!modalBody) return;
  for (const grid of modalBody.querySelectorAll('.cip-modal .flt-grid')) {
    if (grid.dataset.tab !== _cipTab) { grid.style.display = 'none'; continue; }
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
  _cipTab = updateCraftTabCounts(modalBody, '#cip-tabs .craft-tab',
    tab => modalBody.querySelector('.cip-modal .flt-grid[data-tab="' + tab + '"]'), '.cip-item', ql, _cipTab);
  // 空态提示以（可能已切换的）当前激活 Tab 为准
  const activeGrid = modalBody.querySelector('.cip-modal .flt-grid[data-tab="' + _cipTab + '"]');
  const shown = activeGrid ? Array.from(activeGrid.querySelectorAll('.cip-item')).filter(el => el.style.display !== 'none').length : 0;
  const emp = document.getElementById('cip-empty');
  if (emp) {
    emp.textContent = ql ? '没有匹配「' + q.trim() + '」的结果' : '该分类暂无可选' + (_cipCtx && _cipCtx.kind === 'fluid' ? '流体' : '物品');
    emp.style.display = shown ? 'none' : '';
  }
}

// 点击物品：写入设备 selected 并关闭弹窗
function creativeItemPickerPick(id) {
  const e = _cipCtx ? _cipCtx.e : null;
  if (!e) { closeCreativeItemPicker(); return; }
  e.selected = id;
  closeCreativeItemPicker();
  renderPanel(false);   // 刷新设备面板，显示当前生成物
}

// 弹窗交互：位于 #hud-modal（不在 #panel-body 内），不经过面板分发，单独监听
document.addEventListener('click', ev => {
  if (!_cipCtx) return;
  if (ev.target && ev.target.id === 'hud-modal-close') { ev.stopPropagation(); closeCreativeItemPicker(); return; }
  const tab = ev.target.closest && ev.target.closest('#cip-tabs .craft-tab[data-tab]');
  if (tab) { ev.stopPropagation(); creativeItemPickerSwitchTab(tab.dataset.tab); return; }
  const item = ev.target.closest && ev.target.closest('#hud-modal-body .cip-item[data-id]');
  if (item) { ev.stopPropagation(); creativeItemPickerPick(item.dataset.id); }
});
document.addEventListener('compositionstart', ev => { if (ev.target && ev.target.id === 'cip-search') _cipComposing = true; });
document.addEventListener('compositionend', ev => {
  if (ev.target && ev.target.id === 'cip-search') { _cipComposing = false; applyCipSearch(ev.target.value); }
});
document.addEventListener('input', ev => {
  if (ev.target && ev.target.id === 'cip-search' && _cipCtx && !_cipComposing) applyCipSearch(ev.target.value);
});

// ESC 关闭：捕获阶段优先拦截（早于 main-input 的全局 ESC 链），
// 避免只关掉了底层设备面板而把选择器弹窗留在屏幕上
window.addEventListener('keydown', ev => {
  if (ev.key !== 'Escape' || ev.repeat) return;
  if (!_cipCtx) return;
  ev.preventDefault();
  ev.stopPropagation();
  closeCreativeItemPicker();
}, true);
