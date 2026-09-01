'use strict';

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

// ===== 调试面板可发放的资源（自动来自官方数据，不手写清单）=====
// 物品集合与创造箱同源（creativeItemChoices：官方同名固体物品全量，排除流体/品质变体/蓝图），
// 分类按官方 item-group 归为 5 大 Tab（与背包制作栏一致），同组内按官方 itemOrder 排序；
// 另把无官方分组数据的测试设备（创造/虚空箱/带/管）单独归入「测试设备」组。
// 这样官方数据新增物品（如装甲各型号）时，发放清单会自动同步，无需维护。
function dbgGiveCount(id) {
  const s = GAME_DATA.stackSize && GAME_DATA.stackSize[id];
  return s ? Math.min(s, 200) : 50;   // 默认发一组（小物件整组，大物件截断到 200）
}
function dbgGiveGroups() {
  const TEST_SET = new Set(['creative-chest', 'void-chest', 'creative-belt', 'void-belt', 'creative-pipe', 'void-pipe']);
  const buckets = new Map(CRAFT_TABS.map(t => [t, []]));   // 官方 5 大 Tab 桶
  const orphan = [], test = [];
  for (const id of creativeItemChoices()) {
    if (TEST_SET.has(id)) { test.push(id); continue; }
    const tab = GAME_DATA.itemGroup && GAME_DATA.itemGroup[id];
    const bucket = buckets.get(tab);
    if (bucket) bucket.push(id);
    else orphan.push(id);   // 无官方分组的兜底到「其它」
  }
  const out = [];
  for (const t of CRAFT_TABS) {
    const list = buckets.get(t);
    if (!list.length) continue;
    list.sort(officialItemCompare);
    out.push([CRAFT_TAB_LABEL[t].text, list.map(id => [id, dbgGiveCount(id)])]);
  }
  if (orphan.length) {
    orphan.sort(officialItemCompare);
    out.push(['其它', orphan.map(id => [id, dbgGiveCount(id)])]);
  }
  if (test.length) {
    test.sort();
    out.push(['测试设备', test.map(id => [id, dbgGiveCount(id)])]);
  }
  return out;
}

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
      on() { toast('无限资源模式已开启：建造不消耗原料，可直接建造测试箱（创造/虚空）与测试管道（创造/虚空）'); refreshHotbar(); if (typeof _invalidateInvCache === 'function') _invalidateInvCache(); if (typeof _matGridCache !== 'undefined' && _matGridCache) _matGridCache.buildDev = null; },
      off() { toast('无限资源模式已关闭'); refreshHotbar(); if (typeof _invalidateInvCache === 'function') _invalidateInvCache(); if (typeof _matGridCache !== 'undefined' && _matGridCache) _matGridCache.buildDev = null; }
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
  // 动作按钮按功能分组：[组名, [[按钮文本, 处理函数], ...]]
  // 相近功能放在一起：重置 / 研究 / 传送 / 地形清理 / 玩家状态 / 敌人战斗 / 世界
  const actGroups = [
    ['重置·恢复默认', [
    ['恢复全部默认设置', () => {
      Object.assign(G.dbg, { timeScale: 1, moveSpeed: 1, mineMult: 1, beltMult: 1, drillMult: 1, asmMult: 1, infinite: false, farReach: false, noclip: false });
      G.settings.combat = false;
      if (!G.settings.combat) { G.enemies = []; G.bullets = []; G.enemyProjectiles = []; }
      buildDebug();
      panel.style.display = 'block';
      refreshHotbar();
      toast('已恢复全部默认设置');
    }],
    ['恢复默认速度', () => {
      Object.assign(G.dbg, { timeScale: 1, moveSpeed: 1, mineMult: 1, beltMult: 1, drillMult: 1, asmMult: 1 });
      buildDebug();
      panel.style.display = 'block';
      toast('速度已恢复默认（1x）');
    }]
    ]],
    ['研究·进度', [
    ['立即完成当前研究', () => {
      const t = G.activeTech;
      if (!t) { toast('没有进行中的研究'); return; }
      if (isInfiniteTech(t)) {
        // 无限科技永不完成：完成一次视为 +1 级，可继续无限研究
        G.techProg[t] = (G.techProg[t] || 0) + 1;
        toast('无限科技 +1 级：' + TECHS[t].name + '（等级 ' + G.techProg[t] + '）');
        G.activeTech = null;
        renderPanel(false);
        return;
      }
      G.techProg[t] = techCostTotal(t);
      G.techDone[t] = true;
      toast('研究完成：' + TECHS[t].name);
      G.activeTech = null;
      renderPanel(false);
    }],
    ['清空全部研究进度', () => {
      // 一键回退所有研究：遍历整个科技/研究树，将每项标记为未完成并清空研究进度
      let cnt = 0;
      for (const t in TECHS) {
        if (!TECHS[t]) continue;
        G.techDone[t] = false;
        delete G.techProg[t];
        cnt++;
      }
      G.activeTech = null; G.techQueue = [];
      toast('已清空全部 ' + cnt + ' 项研究进度');
      renderPanel(false);
    }],
    ['解锁全部科技', () => {
      let doneCnt = 0;
      for (const t in TECHS) {
        if (isInfiniteTech(t)) {
          // 无限科技永不完成：不标记 techDone，仅确保其“已解锁（techProg>0）”，
          // 保留可继续无限研究（否则后续会被当已完成而无法再研究）。
          if ((G.techProg[t] || 0) === 0) G.techProg[t] = 1;
          delete G.techDone[t];
          continue;
        }
        G.techDone[t] = true;
        if (G.techProg[t] === undefined) G.techProg[t] = techCostTotal(t);
        doneCnt++;
      }
      G.activeTech = null; G.techQueue = [];
      toast('已解锁全部 ' + doneCnt + ' 项科技（无限科技可继续研究）');
      renderPanel(false);
    }]
    ]],
    ['传送', [
    ['传送回出生点', () => {
      G.player.x = G.spawn.x * TILE + TILE / 2;
      G.player.y = G.spawn.y * TILE + TILE / 2;
    }]
    ]],
    ['地形·清理', [
    ['清除地图上全部建筑', () => {
      for (const e of G.ents.slice()) removeEnt(e);
      closePanel();
      toast('已清除地图上全部建筑');
    }],
    ['清除视野内峭壁', () => {
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
    ['清除视野内树木', () => {
      // 一键移除当前显示区域内的所有树木（变回草地），对齐《异星工厂》树木清除
      const b = (typeof viewBounds === 'function') ? viewBounds() : null;
      if (!b) { toast('无法获取视口范围'); return; }
      const minTx = Math.floor(Math.min(b.x0, b.x1) / TILE);
      const maxTx = Math.floor(Math.max(b.x0, b.x1) / TILE);
      const minTy = Math.floor(Math.min(b.y0, b.y1) / TILE);
      const maxTy = Math.floor(Math.max(b.y0, b.y1) / TILE);
      let cnt = 0;
      for (let ty = minTy; ty <= maxTy; ty++) {
        for (let tx = minTx; tx <= maxTx; tx++) {
          if (getTerrain(tx, ty) === T_TREE) {
            setTerrain(tx, ty, T_GRASS);
            if (typeof invalidateTerrainChunk === 'function') invalidateTerrainChunk(tx, ty);
            cnt++;
          }
        }
      }
      if (typeof uiDirty !== 'undefined') uiDirty = true;
      toast(cnt ? ('已移除 ' + cnt + ' 棵树木') : '当前显示区域没有树木');
    }]
    ]],
    ['玩家·状态', [
    ['恢复满生命值', () => {
      G.playerHP = G.playerHPmax;
      toast('生命值已回满');
    }],
    ['清除全部污染', () => {
      if (typeof pollutionRestore === 'function') pollutionRestore({ pollution: 0 });
      else G.pollution = 0;
      toast('污染已全部清除');
    }]
    ]],
    ['敌人·战斗', [
    ['清除全部敌人', () => {
      G.enemies = []; G.bullets = []; G.enemyProjectiles = [];
      toast('已清除全部敌人与弹幕');
    }],
    ['在附近生成一批敌人', () => {
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
        toast('已在附近生成 8 只敌人');
      } else { toast('战斗系统不可用'); }
    }]
    ]],
    ['世界·其他', [
    ['生成新地图', () => { newGame(); closePanel(); toast('新地图已生成'); }],
    ['切换昼夜', () => {
      const cycle = (typeof DAY_CYCLE === 'number') ? DAY_CYCLE : 60;
      const ph = ((G.time / cycle) % 1 + 1) % 1;
      G.time = Math.floor(G.time / cycle) * cycle + cycle * (ph > 0.5 ? 0.02 : 0.5);
      toast('昼夜已切换');
    }]
    ]]
  ];
  for (const [gname, list] of actGroups) {
    const head = document.createElement('div');
    head.className = 'dgroup';
    head.textContent = gname;
    grid2.appendChild(head);
    for (const [txt, fn] of list) {
      const b = document.createElement('button');
      b.textContent = txt;
      b.dataset.dbgact = txt;
      b.addEventListener('click', fn);
      grid2.appendChild(b);
    }
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
    for (const [cat, list] of dbgGiveGroups()) {
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
        // 图标 + 文本：复用 iconCanvas（ui.js）绘制物品专属图标，与背包/快捷栏视觉一致
        if (it && typeof iconCanvas === 'function') {
          b.classList.add('ditem');
          const ic = iconCanvas(id, 16).cloneNode();
          ic.getContext('2d').drawImage(iconCanvas(id, 16), 0, 0);
          ic.className = 'ditem-ic';
          b.appendChild(ic);
          const txt = document.createElement('span');
          txt.textContent = it.name + ' +' + n;
          b.appendChild(txt);
        } else {
          b.textContent = (it ? it.name : id) + ' +' + n;
        }
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
    for (const [, list] of dbgGiveGroups()) for (const [id, n] of list) { invAdd(id, n); cnt++; }
    toast('已发放 ' + cnt + ' 种资源');
    refreshHotbar();
  });
  body.appendChild(giveAllBtn);

  document.getElementById('dbg-x').addEventListener('click', () => { panel.style.display = 'none'; });

  // 调试面板支持点中标题栏拖动（dhead 每次重建后重新绑定）
  makeTitleDraggable(panel, panel.querySelector('.dhead'));

  let drag = null;
  let suppressClick = false;
  // 展开/收起 Debug 面板（鼠标点击共用）
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
  // 拖拽 Debug 按钮：鼠标拖动
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

// 调试面板展开时按 ESC 退出并关闭面板。
// 在模块级（脚本加载时，早于 bindInput 注册的全局 ESC 处理）注册监听器，
// 用 stopImmediatePropagation 阻止全局 ESC 链继续触发打开游戏菜单等后续逻辑。
window.addEventListener('keydown', ev => {
  if (ev.key !== 'Escape' || ev.repeat) return;
  const panel = document.getElementById('dbg-panel');
  if (panel && panel.style.display === 'block') {
    panel.style.display = 'none';
    ev.stopImmediatePropagation();
  }
});
