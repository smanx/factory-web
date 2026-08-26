'use strict';

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
    rd.onload = async () => {
      // 导入后重置 input 值，保证再次选择同一文件也能触发 change
      ev.target.value = '';
      try {
        await importSaveFile(rd.result);
      } catch (err) {
        // 兜底：避免未处理的 Promise rejection 导致导入后毫无反馈
        toast('导入失败：' + err.message);
      }
    };
    rd.onerror = () => { toast('读取文件失败'); };
    rd.readAsArrayBuffer(f);
  });
  document.getElementById('panel-close').addEventListener('click', () => closePanel());
  // 中文输入法组合状态：组合拼音期间（composition）会触发 input 事件，
  // 此刻 value 还是未组合成汉字的拼音，若直接按它过滤会让结果变成拼音匹配并干扰输入法，
  // 因此组合期间跳过 input 过滤，仅在 compositionend（组合完成）后应用一次搜索。
  let imeComposing = false;
  // 根据输入框类型应用搜索过滤（供 input / compositionend 共用）
  function applyPanelSearch(v, id, target) {
    if (id === 'inv-recipe-search') {
      G.invRecipeQ = v;
      applyInvRecipeFilter(G.invRecipeQ);
    } else if (id === 'build-dev-search') {
      G.buildDevQ = v;
      applyBuildSearch(G.buildDevQ);
    } else if (id === 'lreq-search') {
      G.lreqQ = v;
      if (typeof fillLogiReqGrid === 'function') fillLogiReqGrid(G.lreqQ);
    } else if (id === 'trash-search') {
      G.trashQ = v;
      if (typeof fillTrashGrid === 'function') fillTrashGrid(G.trashQ);
    } else if (id === 'asm-recipe-search') {
      applyAssemblerRecipeFilter(v);
    } else if (id === 'sflt-search') {
      applySplitterFilterSearch(v);
    } else if (id === 'flt-search') {
      applyInserterFilterSearch(v);
    } else if (id === 'ccsel-search') {
      applyCreativeChestSearch(v);
    } else if (id === 'cpsel-search') {
      applyCreativePipeSearch(v);
    } else if (id === 'cbsel-search') {
      applyCreativeBeltSearch(v);
    } else if (target && target.matches && target.matches('[data-stat-hist-filter]')) {
      applyStatsHistFilter(v);
    }
  }
  document.getElementById('panel-body').addEventListener('compositionstart', ev => {
    imeComposing = true;
  });
  document.getElementById('panel-body').addEventListener('compositionend', ev => {
    imeComposing = false;
    applyPanelSearch(ev.target.value, ev.target.id, ev.target);
  });
  document.getElementById('panel-body').addEventListener('input', ev => {
    if (imeComposing) return; // 中文组合中，跳过，避免按拼音过滤/打断输入法
    applyPanelSearch(ev.target.value, ev.target.id, ev.target);
  });
  document.getElementById('panel-body').addEventListener('keydown', ev => {
    if (ev.target.matches && ev.target.matches('[data-stat-hist-filter]') && ev.key === 'Enter') {
      ev.preventDefault();
      statsHistPickFiltered();
    }
  });
  document.getElementById('panel-body').addEventListener('click', async ev => {
    // 供“从文件导入存档”使用：打开原生文件选择框后若立刻 renderPanel 重建
    // innerHTML，会销毁与选择框绑定的 #imp-file 元素，导致选完文件后 change 事件
    // 触发在已脱离 DOM 的旧元素上、不再冒泡到 panel-body，导入“毫无反应”。
    // 故打开文件选择框后跳过本次尾部的 renderPanel(false)。
    let skipPanelRender = false;
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
      if (!itemUnlocked(wantMk2 ? 'personal-roboport-mk2-equipment' : 'personal-roboport-equipment')) {
        const tid = wantMk2 ? 'personal-roboport-mk2-equipment' : 'personal-roboport-equipment';
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
    // 数据语言切换（中文/English）：修改后立即生效，物品/建筑/配方等命名随设置切换
    const langBtn = ev.target.closest('[data-setlang]');
    if (langBtn) {
      G.settings.language = langBtn.dataset.setlang;
      saveSettings();
      uiDirty = true;
      const _sb = document.getElementById('panel-body');
      if (_sb && typeof renderSettingsAsync === 'function') renderSettingsAsync(_sb, 0);
      if (typeof toast === 'function') toast(G.settings.language === 'en' ? '语言已切换为 English' : '语言已切换为中文');
      return;
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
      else if (act === 'imp-save') {
        const impFile = document.getElementById('imp-file');
        if (!impFile) {
          toast('导入失败：未找到文件输入框');
        } else {
          impFile.click();
          // 打开原生文件选择框后，本次不再重建面板，避免销毁与选择框绑定的 #imp-file 元素
          // （重建后 change 事件会触发在已脱离 DOM 的旧元素上，无法冒泡到 panel-body）。
          skipPanelRender = true;
        }
      }
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
            const r = RECIPES[id] || REFINERY_RECIPES[id] || CENTRIFUGE_RECIPES[id];
            toast('需先研究「' + TECHS[recipeLockingTech(id)].name + '」才能生产' + ITEMS[Object.keys(r.out || r.prob || {})[0]].name);
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
            toast('需先研究「' + TECHS[recipeLockingTech(id)].name + '」才能执行' + (CENTRIFUGE_RECIPES[id] ? localizedName(id, CENTRIFUGE_RECIPES[id].name) : id));
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
        if (G.techDone[id] && !isInfiniteTech(id)) { toast('该科技已完成'); return; }
        // 兼容旧档/调试解锁：无限科技即使曾被标记 done 也可重新无限研究，清掉错误的完成标记
        if (isInfiniteTech(id)) delete G.techDone[id];
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
          // 固定管道口建筑（锅炉/蒸汽机/汽轮机/热交换器）放置后不可旋转/翻转
          if (!postPlaceRotatable(mch.type)) { toast('该建筑放置后不可旋转/翻转'); return; }
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
    if (!skipPanelRender) {
      renderPanel(false);
    }
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
  h += '<div class="sec">语言 / Language</div>';
  h += '<div class="wcfg-row"><div class="wcfg-label">数据语言</div><div class="wcfg-opts">';
  h += '<button type="button" class="wcfg-opt' + (G.settings.language !== 'en' ? ' active' : '') + '" data-setlang="zh">中文</button>';
  h += '<button type="button" class="wcfg-opt' + (G.settings.language === 'en' ? ' active' : '') + '" data-setlang="en">English</button>';
  h += '</div></div>';
  h += '<div class="dim wcfg-desc">切换物品/建筑/配方等数据名称的语言，修改后立即生效。</div>';
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
  h += '<input type="file" id="imp-file" accept=".json,.gz,.json.gz,application/json,application/gzip" style="display:none">';
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
    // 带稳定编号的名称（自动存档按槽位 #1/#2/#3，用户存档按递增 #N），覆盖后仍能辨认是哪个
    const label = (s.type === 'auto' ? '自动存档 #' + (s.num || '?') : '用户存档 #' + (s.num || '?'));
    const dispName = (s.type === 'user' && s.name) ? (label + '（' + s.name + '）') : label;
    h += '<div class="save-item">';
    h += '  <div class="save-item-top">';
    h += '    <div class="save-item-info">' + tag + ' <span class="save-name">' + escHtml(dispName) + '</span></div>';
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
