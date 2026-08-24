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
    if (id) slot.dataset.tip = ITEMS[id].name + '|' + ITEMS[id].desc;
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
  G.sel = (G.sel === i ? -1 : i);
  G.quickSel = null;
  // 选择武器：若该槽位是武器，则作为当前手持武器
  if (G.sel >= 0 && HOTBAR[G.sel]) setWeapon(HOTBAR[G.sel]);
  else if (G.sel < 0) setWeapon(null);
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
  updateDeconstructBtn();
}

function closePanel(hide = true) {
  G.panelMode = null;
  G.panelEnt = null;
  G.invRecipeQ = '';
  if (hide) document.getElementById('panel').style.display = 'none';
  updateDeconstructBtn();
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
    const keepFocus = document.activeElement && document.activeElement.id === 'inv-recipe-search';
    body.innerHTML = htmlInventory();
    applyInvRecipeFilter(G.invRecipeQ);
    if (keepFocus) {
      const inp = document.getElementById('inv-recipe-search');
      if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
    }
  } else if (G.panelMode === 'tech') {
    title.textContent = '科技研究';
    body.innerHTML = htmlTech();
  } else if (G.panelMode === 'stats') {
    title.textContent = '统计面板';
    body.innerHTML = htmlStats();
  } else if (G.panelMode === 'set') {
    title.textContent = '设置';
    renderSettingsAsync(body, st);
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
  return '<span class="chip" data-itemid="' + id + '" data-tip="' + ITEMS[id].name + '|' + ITEMS[id].desc + '"><img src="' + iconDataURL(id) + '">' +
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
  h += '<div class="sec">建造设备（点击直接选中放置）</div><div class="recgrid">';
  const infinite = !!(G.dbg && G.dbg.infinite);
  // 测试/应急设备（被动供电、创造/虚空箱、创造/虚空管道）仅在开启"无限资源"
  // Debug 模式后才会出现在建造列表；正常游玩不可见、不可获取。
  const dbgOnlyDevices = new Set(['passive-power', 'creative-chest', 'void-chest', 'creative-pipe', 'void-pipe', 'creative-belt', 'void-belt']);
  for (const bid of Object.keys(BUILD_DEFS)) {
    if (dbgOnlyDevices.has(bid) && !infinite) continue;
    const n = invCount(bid);
    const canBuild = infinite || n > 0;
    h += '<button class="rcbtn"' + (canBuild ? '' : ' disabled style="opacity:.45"') +
      ' data-itemid="' + bid + '" data-tip="' + ITEMS[bid].name + '|' + ITEMS[bid].desc + '">' +
      '<img src="' + iconDataURL(bid) + '">' + ITEMS[bid].name + (n > 0 ? ' ×' + n : (infinite ? ' ∞' : '')) + '</button>';
  }
  h += '</div>';
  h += '<div class="sec">护甲</div><div class="armor-row">';
  // 当前穿戴护甲展示与脱卸
  h += '<div class="armor-slot' + (G.armor ? ' equipped' : '') + '" data-tip="' + (G.armor ? (ITEMS[G.armor].name + '|当前穿戴的护甲，点击脱卸') : '未穿戴护甲|护甲可减少所受伤害') + '" data-armor="unequip">' +
    (G.armor ? '<img src="' + iconDataURL(G.armor) + '"><b>' + ITEMS[G.armor].name + '</b>' : '<span>🛡 未穿戴</span>') + '</div>';
  // 可装备的护甲列表
  for (const aid of ['light-armor', 'heavy-armor']) {
    const n = invCount(aid);
    const equipped = G.armor === aid;
    const can = n > 0 && !equipped;
    h += '<button class="rcbtn armor-eq' + (can ? '' : ' disabled') + '" data-armor="' + aid + '"' +
      ' data-tip="' + ITEMS[aid].name + '|' + ITEMS[aid].desc + '">' +
      '<img src="' + iconDataURL(aid) + '">' + ITEMS[aid].name + (equipped ? ' ✔' : (n > 0 ? ' ×' + n : '')) + '</button>';
  }
  h += '</div><div class="dim">护甲可减少所受伤害。点击下方护甲图标即可装备（需在背包中拥有），再次点击已穿戴护甲可脱卸。</div>';
  h += '<div class="sec">材料</div><div class="chips">';
  let any = false;
  for (const id in ITEMS) {
    const n = invCount(id);
    if (n > 0) { h += chip(id, n); any = true; }
  }
  if (!any) h += '<span class="dim">空空如也，去地图上按住左键挖矿吧（铁矿/铜矿/煤/石头）</span>';
  h += '</div><div class="sec">配方</div>';
  const q = (G.invRecipeQ || '').replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  h += '<input id="inv-recipe-search" class="inv-search" type="text" placeholder="搜索配方（输入物品名称）" autocomplete="off" value="' + q + '">';
  h += '<div id="inv-recipes">';
  // 组装机配方（含化工厂/炼油厂以外的普通配方）
  for (const rid in RECIPES) {
    if (isChemRecipe(rid)) continue;
    if (isCentrifugeRecipe(rid)) continue;
    const _r = RECIPES[rid];
    // 含流体原料的配方不列入手搓清单（需在组装机/化工厂生产）
    if (Object.keys(_r.inp).some(k => FLUIDS.indexOf(k) >= 0)) continue;
    const unlocked = recipeUnlocked(rid);
    const lockTech = recipeLockingTech(rid);
    const rec = RECIPES[rid];
    const ok = unlocked && canCraft(rid);
    const outId = Object.keys(rec.out)[0];
    const searchKey = (ITEMS[outId].name + ' ' + outId + ' ' +
      Object.keys(rec.inp).map(k => ITEMS[k].name).join(' ') + ' ' + recipeDeviceName(rid)).toLowerCase();
    h += '<div class="recipe' + (unlocked ? '' : ' locked-recipe') + '" data-rsearch="' + searchKey.replace(/"/g, '') + '">';
    h += '<img class="ric" data-itemid="' + outId + '" data-tip="' + ITEMS[outId].name + '|' + ITEMS[outId].desc + '" src="' + iconDataURL(outId) + '">';
    h += '<div class="rmain"><div class="rname">' + ITEMS[Object.keys(rec.out)[0]].name +
      (rec.out[Object.keys(rec.out)[0]] > 1 ? ' ×' + rec.out[Object.keys(rec.out)[0]] : '') +
      '<span class="rdev">' + recipeDeviceName(rid) + '</span></div>';
    h += '<div class="ring">';
    for (const k in rec.inp) {
      const have = invCount(k);
      h += '<span class="ing ' + (have >= rec.inp[k] ? '' : 'lack') + '" data-itemid="' + k + '" data-tip="' + ITEMS[k].name + '|' + ITEMS[k].desc + '">' +
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
    h += '<img class="ric" data-itemid="' + outId + '" data-tip="' + ITEMS[outId].name + '|' + ITEMS[outId].desc + '" src="' + iconDataURL(outId) + '">';
    h += '<div class="rmain"><div class="rname">' + ITEMS[outId].name +
      (rec.out[outId] > 1 ? ' ×' + rec.out[outId] : '') + '<span class="rdev">化工厂</span></div>';
    h += '<div class="ring">';
    for (const k in rec.inp) {
      h += '<span class="ing" data-itemid="' + k + '" data-tip="' + ITEMS[k].name + '|' + ITEMS[k].desc + '">' +
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
    h += '<img class="ric" data-itemid="' + outId + '" data-tip="' + ITEMS[outId].name + '|' + ITEMS[outId].desc + '" src="' + iconDataURL(outId) + '">';
    h += '<div class="rmain"><div class="rname">' + rec.name + '<span class="rdev">炼油厂</span></div>';
    h += '<div class="ring">';
    for (const k in rec.inp) {
      h += '<span class="ing" data-itemid="' + k + '" data-tip="' + ITEMS[k].name + '|' + ITEMS[k].desc + '">' +
        '<img src="' + iconDataURL(k) + '">' + ITEMS[k].name + ' ' + rec.inp[k] + '</span>';
    }
    h += '<span class="ing arrow">→</span>';
    for (const k in rec.out) {
      h += '<span class="ing" data-itemid="' + k + '" data-tip="' + ITEMS[k].name + '|' + ITEMS[k].desc + '">' +
        '<img src="' + iconDataURL(k) + '">' + ITEMS[k].name + ' ' + rec.out[k] + '</span>';
    }
    h += '</div></div>';
    h += unlocked ? '<span class="rdev-note">需炼油厂</span>' : '<span class="rdev-note lock-tag">🔒 需' + TECHS[lockTech].name + '</span>';
    h += '</div>';
  }
  h += '</div>';
  h += '<div class="dim" id="inv-recipe-empty" style="display:none"></div>';
  h += '<div class="hint">提示：开局先挖 5 个石头合成石炉，再挖煤；点击炉子打开面板，把煤和矿石放进去就能炼铁板/铜板。钢板用铁板×2 合成（石炉/电炉炼制更快）。塑料板等流体化学产物只能在化工厂生产（石油气经管道送入化工厂）。<br>建造：直接点击上方材料区里任何可建造的设备图标即可选中进入放置模式（优先占用空快捷栏槽位），不必依赖底部工具栏；R 旋转、Q 取消。建造支持覆盖：目标格已有建筑时会先拆除旧建筑（返还物资）再放置新建筑，但同一格不会叠加。</div>';
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
        h += (G.activeTech === tid)
          ? '<button data-action="tech-cancel">取消</button>'
          : '<button data-action="tech" data-id="' + tid + '">研究</button>';
      }
    } else if (isInfiniteTech(tid)) {
      // 无限科技始终可选（重复研究也继续，永不完成）
      h += (G.activeTech === tid)
        ? '<button data-action="tech-cancel">停止</button>'
        : '<button data-action="tech" data-id="' + tid + '">研究</button>';
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
  return (panel && panel.html) ? panel.html(e) : '<div class="dim">无信息</div>';
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
    } else if (ev.target.id === 'asm-recipe-search') {
      applyAssemblerRecipeFilter(ev.target.value);
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
      // 地面物品（混凝土/石砖路/填海）虽非建筑实体，但同样可选中放入快捷栏以铺设
      const isGroundItem = iid === 'concrete' || iid === 'stone-path' || iid === 'landfill';
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
    const setCb = ev.target.closest('[data-set]');
    if (setCb) {
      const key = setCb.dataset.set;
      G.settings[key] = setCb.checked;
      saveSettings();
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
    const btn = ev.target.closest('[data-action]');
    if (!btn) return;
    const act = btn.dataset.action;
    const id = btn.dataset.id;
    // 设备专属动作（spref/flt/labfill 等）优先交给设备自己的 onAction
    const panel = G.panelEnt && DEVICE_PANEL[G.panelEnt.type];
    let handled = false;
    if (panel && panel.onAction) handled = !!panel.onAction(act, btn);
    if (!handled) {
      if (act === 'quick-save') { await saveGame(); renderPanel(false); }
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
          if (id !== 'kovarex' && !recipeUnlocked(id)) {
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
          if (id !== 'kovarex' && !recipeUnlocked(id)) {
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
          else if (fid === 'solid-fuel' && 'fuelSolid' in G.panelEnt) G.panelEnt.fuelSolid += n;
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
      } else if (act === 'takein') {
        const mch = G.panelEnt;
        if (btn.dataset.modules === '1') {
          // 取出全部模块
          for (const k of Object.keys(mch.modules || {})) {
            invAdd(k, mch.modules[k]);
            delete mch.modules[k];
          }
          mch.prodBuf = 0;
        } else {
          for (const k of Object.keys(mch.inp || {})) {
            invAdd(k, mch.inp[k]);
            delete mch.inp[k];
          }
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
        G.activeTech = id;
      } else if (act === 'tech-cancel') {
        G.activeTech = null;
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
  h += '<label class="setrow"><input type="checkbox" data-set="virtualJoystick"' + (G.settings.virtualJoystick ? ' checked' : '') + '> 虚拟摇杆（手机/触屏移动）</label>';
  h += '<label class="setrow"><input type="checkbox" data-set="minimap"' + (G.settings.minimap !== false ? ' checked' : '') + '> 小地图（右下角显示已探索区域，M 键切换）</label>';
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
}

function updateHUD(dt, fps) {
  const el = document.getElementById('hud-info');
  const p = G.player;
  const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
  let hud = fps + '   (' + tx + ',' + ty + ')';
  if (G.settings.combat) {
    const hp = Math.max(0, Math.round(G.playerHP));
    hud += '   <span style="color:' + (hp > 50 ? '#57e389' : hp > 25 ? '#ffd23c' : '#ff5b5b') + '">♥ ' + hp + '/' + G.playerHPmax + '</span>';
  }
  if (G.weapon && isWeapon(G.weapon)) {
    hud += '   🔫 ' + WEAPONS[G.weapon].name;
  }
  if (G.armor && isArmor(G.armor)) {
    hud += '   🛡 ' + ARMORS[G.armor].name;
  }
  if (G.driving && G.driving.ent) {
    hud += '   🚗 ' + (G.driving.ent instanceof Tank ? '坦克' : '装甲车') + '（E 下车）';
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

function mapTipAt(tx, ty) {
  // 显示详情时：鼠标移到某流体出入口图标上，优先显示该流体的具体名称
  if (G.showDetails) {
    for (const ent of G.ents) {
      if (ent._dead) continue;
      const fn = DEVICE_FLUID_ICONS[ent.type];
      if (!fn) continue;
      for (const ic of fn(ent)) {
        if (ic.x === tx && ic.y === ty && ITEMS[ic.fluid]) {
          return ITEMS[ic.fluid].name + '|' + ITEMS[ic.fluid].desc;
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
  if (getTerrain(tx, ty) === T_WATER) return '水域|无法通行；可把抽水机放在这里取水';
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
      const p = text.split('|');
      tip.querySelector('b').textContent = p[0] || '';
      tip.querySelector('span').textContent = p[1] || '';
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

function buildDebug() {
  const btn = document.getElementById('dbg-btn');
  const panel = document.getElementById('dbg-panel');
  // 仅当 URL 参数含 debug=1 时才显示 debug 按钮
  btn.style.display = G.debugEnabled ? 'flex' : 'none';
  if (!G.debugEnabled) { panel.style.display = 'none'; return; }
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

  const sec1 = document.createElement('div');
  sec1.className = 'dsec';
  sec1.textContent = '发放资源';
  body.appendChild(sec1);
  const grid1 = document.createElement('div');
  grid1.className = 'dgrid';
  for (const [txt, id, n] of [
    ['+100铁板', 'iron-plate', 100], ['+100铜板', 'copper-plate', 100],
    ['+100煤', 'coal', 100], ['+100石头', 'stone', 100],
    ['+50齿轮', 'iron-gear', 50], ['+50电路', 'green-circuit', 50],
    ['+20科学包', 'science-pack', 20], ['+20绿包', 'green-science', 20],
    ['+20蓝包', 'blue-science', 20], ['+20灰包', 'military-science', 20], ['+50塑料', 'plastic-bar', 50],
    ['+50弹药', 'magazine', 50], ['+50穿甲弹', 'piercing-rounds', 50], ['+5铁箱', 'steel-chest', 5],
    ['+50原油', 'crude-oil', 50], ['+50水', 'water', 50], ['+50蒸汽', 'steam', 50]
  ]) {
    const b = document.createElement('button');
    b.textContent = txt;
    b.dataset.giveid = id;
    b.dataset.given = n;
    b.addEventListener('click', () => { invAdd(id, n); toast('+ ' + n + ' ' + ITEMS[id].name); });
    grid1.appendChild(b);
  }
  body.appendChild(grid1);

  const sec2 = document.createElement('div');
  sec2.className = 'dsec';
  sec2.textContent = '操作';
  body.appendChild(sec2);
  const grid2 = document.createElement('div');
  grid2.className = 'dgrid';
  const acts = [
    ['一键重置所有功能', () => {
      Object.assign(G.dbg, { timeScale: 1, moveSpeed: 1, mineMult: 1, beltMult: 1, drillMult: 1, asmMult: 1, infinite: false, farReach: false });
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
    ['无限资源：' + (G.dbg.infinite ? '开' : '关'), () => {
      G.dbg.infinite = !G.dbg.infinite;
      if (G.dbg.infinite) {
        toast('无限资源模式已开启：建造不消耗原料，可直接建造测试箱（创造/虚空）与测试管道（创造/虚空）');
      } else {
        toast('无限资源模式已关闭');
      }
      buildDebug();
      panel.style.display = 'block';
      refreshHotbar();
    }],
    ['无限交互距离：' + (G.dbg.farReach ? '开' : '关'), () => {
      G.dbg.farReach = !G.dbg.farReach;
      if (G.dbg.farReach) {
        toast('无限交互距离已开启：可对任意远的格子交互/建造');
      } else {
        toast('无限交互距离已关闭');
      }
      buildDebug();
      panel.style.display = 'block';
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
    ['回出生点', () => {
      G.player.x = G.spawn.x * TILE + TILE / 2;
      G.player.y = G.spawn.y * TILE + TILE / 2;
    }],
    ['清空建筑', () => {
      for (const e of G.ents.slice()) removeEnt(e);
      closePanel();
      toast('建筑已清空');
    }],
    ['新地图', () => { newGame(); closePanel(); toast('新地图已生成'); }],
    ['切换战斗', () => {
      G.settings.combat = !G.settings.combat;
      if (!G.settings.combat) { G.enemies = []; G.bullets = []; G.enemyProjectiles = []; }
      toast('战斗模式：' + (G.settings.combat ? '开启' : '关闭'));
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
    if (drag) suppressClick = drag.moved;
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
  // 更新开关按钮（无限资源 / 无限交互距离）文本
  panel.querySelectorAll('button[data-dbgact]').forEach(b => {
    const act = b.dataset.dbgact;
    if (act.indexOf('无限资源：') === 0) {
      const txt = '无限资源：' + (G.dbg.infinite ? '开' : '关');
      b.textContent = txt;
      b.dataset.dbgact = txt;
    } else if (act.indexOf('无限交互距离：') === 0) {
      const txt = '无限交互距离：' + (G.dbg.farReach ? '开' : '关');
      b.textContent = txt;
      b.dataset.dbgact = txt;
    }
  });
}

// ===== 虚拟摇杆（手机/触屏移动） =====
// 摇杆状态存于 G.joystick；仅在开启"虚拟摇杆"设置且设备为触屏时显示。
// 拖拽摇杆把位移量归一化为 [-1,1] 的 dx/dy，供 updatePlayer 叠加到移动方向。
// ===== 拆除模式按钮（触屏专用，替代手机端无法使用的右键） =====
// 触屏设备才显示该按钮。为避免一直显示干扰操作，仅当用户“选择了某个建筑”
//（即打开该建筑的机器面板，G.panelEnt 指向该建筑）时才显示；
// 若已进入拆除模式则保持可见以便退出。点击进入/退出拆除模式，进入后点触建筑即可拆除。
function updateDeconstructBtn() {
  const el = document.getElementById('deconstruct-btn');
  if (!el) return;
  const touchCapable = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  if (!touchCapable) { el.classList.add('hidden'); return; }
  // 拆除模式中保持按钮可见以便退出；否则仅当用户选中了某个建筑时才显示
  const show = G.deconstructMode || !!G.panelEnt;
  if (!show) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  el.classList.toggle('active', !!G.deconstructMode);
}

function initDeconstructBtn() {
  const el = document.getElementById('deconstruct-btn');
  if (!el) return;
  el.addEventListener('click', () => toggleDeconstructMode());
  updateDeconstructBtn();
}

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
