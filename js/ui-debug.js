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
    ['rocket-ammo', 50], ['explosive-rocket', 50], ['cannon-shell', 50], ['explosive-cannon-shell', 50],
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
    ['移除当前视野内所有树木', () => {
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
    }],
    ['新地图', () => { newGame(); closePanel(); toast('新地图已生成'); }],
    ['一键完成全部科技', () => {
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
