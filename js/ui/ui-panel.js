'use strict';

// 屏幕右下角访客徽章下方显示打包版本号：由 build.js 在 bundle 顶部注入 __BUILD_VERSION__
(function () {
  const el = document.getElementById('ver-corner-text');
  if (el) el.textContent = window.__BUILD_VERSION__ || 'dev';
})();

function initPanelEvents() {
  // 弹框支持点中标题栏拖动
  makeTitleDraggable(document.getElementById('panel'), document.getElementById('panel-head'));
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
    // 机械臂「设置抓取堆叠」滑杆（change = 释放后确定数值）
    const stackCtrl = ev.target.closest && ev.target.closest('.ins-slider[data-action="flt-stack"]');
    if (stackCtrl && panel && panel.onAction) {
      panel.onAction('flt-stack', stackCtrl);
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
    } else if (id === 'inv-item-search') {
      G.invItemQ = v;
      applyInvItemSearch(G.invItemQ);
    } else if (id === 'asm-recipe-search') {
      applyAssemblerRecipeFilter(v);
    } else if (id === 'rcp-search') {
      // 配方选择面板：记录搜索词，按关键词过滤当前 Tab 的配方网格
      G.rcpQ = v;
      applyRcpFilter(v);
    } else if (id === 'sflt-search') {
      applySplitterFilterSearch(v);
    } else if (id === 'flt-search') {
      applyInserterFilterSearch(v);
    } else if (id === 'bb-search') {
      applyBbSearch(v);
    } else if (id === 'bb-detail-name') {
      const b = (G.blueBook || [])[G.bbDetail];
      if (b && typeof blueBookRename === 'function') {
        const nm = v.trim();
        if (nm) blueBookRename(G.bbDetail, nm);
      }
    } else if (id === 'cip-search') {
      // 创造设备内嵌物品/流体选择器：面板右栏内搜索过滤
      if (typeof applyCipSearch === 'function') applyCipSearch(v);
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
    // 机械臂「设置抓取堆叠」滑杆：拖动过程中实时更新数值显示
    const stackCtrl = ev.target.closest && ev.target.closest('.ins-slider[data-action="flt-stack"]');
    if (stackCtrl && G.panelEnt) {
      const panel = G.panelEnt && DEVICE_PANEL[G.panelEnt.type];
      if (panel && panel.onAction) { panel.onAction('flt-stack', stackCtrl); return; }
    }
    applyPanelSearch(ev.target.value, ev.target.id, ev.target);
  });
  document.getElementById('panel-body').addEventListener('keydown', ev => {
    if (ev.target.matches && ev.target.matches('[data-stat-hist-filter]') && ev.key === 'Enter') {
      ev.preventDefault();
      statsHistPickFiltered();
    }
  });
  // ===== 背包物品手动摆放（需求：背包不自动排序，用户手动摆放的物品放在哪格就显示在哪格）=====
  // 拖拽背包格子到另一格（有物品/空格均可）：把物品手动安置到目标格，腾出的原格变为空格。
  // 实现：用 dataTransfer 记录来源格 data-slotidx；drop 时按目标格 data-slotidx 落位。
  // 自动物品（排在手动槽之后、无 data-slotidx 归属到 manual 的物品）也可被拖拽：落位后
  // 即成为手动摆放物品；拖拽目标格仅限玩家背包网格（#inv-items 内）。
  let _dragFromSlot = null;
  document.getElementById('panel-body').addEventListener('dragstart', ev => {
    const slot = ev.target.closest && ev.target.closest('#inv-items .inv-slot[data-itemid][data-slotidx]');
    if (!slot) return;
    _dragFromSlot = +slot.dataset.slotidx;
    ev.dataTransfer.effectAllowed = 'move';
    try { ev.dataTransfer.setData('text/plain', 'inv-slot:' + _dragFromSlot); } catch (e) {}
  });
  document.getElementById('panel-body').addEventListener('dragover', ev => {
    const slot = ev.target.closest && ev.target.closest('#inv-items .inv-slot[data-slotidx]');
    if (!slot || _dragFromSlot == null) return;
    ev.preventDefault();
    ev.dataTransfer.dropEffect = 'move';
  });
  document.getElementById('panel-body').addEventListener('drop', ev => {
    if (_dragFromSlot == null) return;
    const tgt = ev.target.closest && ev.target.closest('#inv-items .inv-slot[data-slotidx]');
    if (tgt) {
      ev.preventDefault();
      const to = +tgt.dataset.slotidx;
      // 同一格内放下：不产生任何变化
      if (to !== _dragFromSlot && typeof moveInvItemToSlot === 'function') {
        moveInvItemToSlot(_dragFromSlot, to);
        uiDirty = true;
        if (typeof renderPanel === 'function') renderPanel(false);
      }
    }
    _dragFromSlot = null;
  });
  document.getElementById('panel-body').addEventListener('dragend', ev => {
    _dragFromSlot = null;
  });
  document.getElementById('panel-body').addEventListener('click', async ev => {
    // 供“从文件导入存档”使用：打开原生文件选择框后若立刻 renderPanel 重建
    // innerHTML，会销毁与选择框绑定的 #imp-file 元素，导致选完文件后 change 事件
    // 触发在已脱离 DOM 的旧元素上、不再冒泡到 panel-body，导入“毫无反应”。
    // 故打开文件选择框后跳过本次尾部的 renderPanel(false)。
    let skipPanelRender = false;
    // 制作栏 5 个 Tab 切换（物流/生产/中间产品/太空/武器）
    const craftTabBtn = ev.target.closest('#inv-recipe-tabs .craft-tab[data-tab]');
    if (craftTabBtn && G.panelMode === 'inv') {
      switchCraftTab(craftTabBtn.dataset.tab);
      return;
    }
    // 配方选择面板 5 个 Tab 切换
    const rcpTabBtn = ev.target.closest('#rcp-tabs .craft-tab[data-tab]');
    if (rcpTabBtn && G.panelMode === 'machinerecipe') {
      switchRcpTab(rcpTabBtn.dataset.tab);
      return;
    }
    const statTab = ev.target.closest('[data-stat-tab]');
    if (statTab) {
      G.statsTab = statTab.dataset.statTab;
      renderPanel(false);
      return;
    }
    // 性能页导出：下载 JSON / 复制到剪贴板
    const perfExport = ev.target.closest && ev.target.closest('[data-perf-export]');
    if (perfExport && typeof exportPerf === 'function') {
      exportPerf(perfExport.dataset.perfExport || 'json');
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
    // 物流区顶部开关：「背包物流」总开关 / 「回收未请求物品」开关
    const logiSwitch = ev.target.closest('[data-logiswitch]');
    if (logiSwitch && G.panelMode === 'inv') {
      const which = logiSwitch.dataset.logiswitch;
      if (which === 'main') {
        G.logiEnabled = (G.logiEnabled !== false) ? false : true;
        toast(G.logiEnabled ? '已开启「背包物流」，物流机器人将送达请求物品' : '已关闭「背包物流」，物流机器人不再送达请求物品');
      } else if (which === 'recycle') {
        G.recycleUnrequested = !G.recycleUnrequested;
        toast(G.recycleUnrequested ? '已开启「回收未请求物品」，背包中未请求的物品将被机器人回收' : '已关闭「回收未请求物品」');
      }
      renderPanel(false);
      return;
    }
    // 物流区请求格子（10x5）：点击已有物品设置/清除请求；点击空槽放入当前选中物品
    const reqCell = ev.target.closest('.logi-cell[data-logireq]');
    if (reqCell && G.panelMode === 'inv') {
      const item = reqCell.dataset.logireq;
      if (!G.logiRequest) G.logiRequest = {};
      if (item) {
        // 已有物品：输入请求数量（0 清除）
        const cur = G.logiRequest[item] || 0;
        const have = invCount(item);
        const inp = window.prompt('设置「' + ITEMS[item].name + '」的请求数量（当前请求 ' + cur + '，持有 ' + have + '，输入 0 清除）：', cur || '10');
        if (inp === null) return;
        const v = parseInt(inp, 10);
        if (isNaN(v) || v <= 0) {
          delete G.logiRequest[item];
          toast('已清除对 ' + ITEMS[item].name + ' 的请求');
        } else {
          G.logiRequest[item] = Math.min(v, 10000);
          toast('已请求 ' + ITEMS[item].name + ' ×' + G.logiRequest[item] + '，物流机器人将自动送达');
        }
      } else {
        // 空槽：放入当前选中物品
        const held = (typeof selItem === 'function') ? selItem() : null;
        if (!held || !ITEMS[held]) { toast('请先在左栏背包中选中要请求的物品'); return; }
        if (G.logiRequest[held] != null) { toast(ITEMS[held].name + ' 已在物流区中'); return; }
        const have = invCount(held);
        const inp = window.prompt('设置「' + ITEMS[held].name + '」的请求数量（持有 ' + have + '）：', '10');
        if (inp === null) return;
        const v = parseInt(inp, 10);
        if (isNaN(v) || v <= 0) { return; }
        G.logiRequest[held] = Math.min(v, 10000);
        toast('已请求 ' + ITEMS[held].name + ' ×' + G.logiRequest[held] + '，物流机器人将自动送达');
      }
      renderPanel(false);
      return;
    }
    // 物流回收区格子（10x3）：点击已有物品取消回收；点击空槽放入当前选中物品标记回收
    const recycleCell = ev.target.closest('.logi-cell[data-logirecycle]');
    if (recycleCell && G.panelMode === 'inv') {
      const item = recycleCell.dataset.logirecycle;
      if (!G.trashSlots) G.trashSlots = {};
      if (item) {
        delete G.trashSlots[item];
        toast('已取消对 ' + ITEMS[item].name + ' 的回收');
      } else {
        const held = (typeof selItem === 'function') ? selItem() : null;
        if (!held || !ITEMS[held]) { toast('请先在左栏背包中选中要回收的物品'); return; }
        if (G.trashSlots[held]) { toast(ITEMS[held].name + ' 已在回收区中'); return; }
        G.trashSlots[held] = true;
        toast('已设置 ' + ITEMS[held].name + ' 回收，物流机器人将把它从背包运走');
      }
      renderPanel(false);
      return;
    }
    // 蓝图编辑界面（Alt+B 框选后弹出）：创建蓝图放置/入背包/入快捷栏
    if (G.panelMode === 'blueprint-edit') {
      // 放到地图：关闭面板进入粘贴模式
      const bpPlace = ev.target.closest('#bp-edit-place');
      if (bpPlace) {
        const nameInput = document.getElementById('bp-edit-name');
        if (nameInput && G.blueprint) {
          const nm = nameInput.value.trim();
          if (nm) G.blueprint.name = nm;
        }
        // 同步重命名蓝图库中同内容蓝图（blueBookAdd 去重依据内容一致）
        if (G.blueprint && typeof blueBookAdd === 'function') blueBookAdd(G.blueprint);
        closePanel();
        if (G.blueprint && G.blueprint.ents && G.blueprint.ents.length) {
          G.blueMode = 'paste';
          G.blueRot = 0; G.blueFlipH = false; G.blueFlipV = false;
          if (typeof syncBlueprintCursor === 'function') syncBlueprintCursor();
          toast('蓝图已创建（' + G.blueprint.ents.length + ' 个建筑），点击空白处放置（R旋转，V/H翻转，右键取消）');
          if (typeof playSfx === 'function') playSfx('blueprint');
        } else {
          toast('蓝图数据为空，无法放置');
        }
        return;
      }
      // 放入背包
      const bpInv = ev.target.closest('#bp-edit-inv');
      if (bpInv) {
        if (G.blueprint && G.blueprint.ents && G.blueprint.ents.length) {
          const nameInput = document.getElementById('bp-edit-name');
          if (nameInput) { const nm = nameInput.value.trim(); if (nm) G.blueprint.name = nm; }
          if (bpItemToInv(G.blueprint)) toast('蓝图「' + (G.blueprint.name || '未命名') + '」已放入背包（选中后点击地图放置）');
        } else {
          toast('蓝图数据为空');
        }
        renderPanel(false);
        return;
      }
      return;
    }
    // 蓝图库：格子视图 / 列表视图切换
    const bbView = ev.target.closest('[data-bbview]');
    if (bbView && G.panelMode === 'bluebook') {
      G.bbGridView = (G.bbGridView === false);
      renderPanel(false);
      return;
    }
    // 蓝图库背包格子：已选中蓝图时点击背包任意格子 = 把蓝图物品放入背包（对齐「入包」交互）
    const bbInvSlot = ev.target.closest('.inv-slot[data-itemid]');
    if (bbInvSlot && G.panelMode === 'bluebook' && typeof G.bbSel === 'number' && (G.blueBook || [])[G.bbSel]) {
      const b = G.blueBook[G.bbSel];
      if (b && typeof bpItemToInv === 'function') {
        if (bpItemToInv(b)) toast('蓝图「' + b.name + '」已放入背包（选中后点击地图放置）');
        uiDirty = true;
        return;
      }
    }
    // 蓝图库格子：左键选中蓝图（可点击地图铺建，也可放入背包/快捷栏）
    const bbCell = ev.target.closest('[data-bbcell]');
    if (bbCell && G.panelMode === 'bluebook' && ev.button === 0) {
      const i = +bbCell.dataset.bbcell;
      const b = (G.blueBook || [])[i];
      if (G.bbSel === i) {
        // 再次点击已选中格子：取消选择（恢复背包自由选物）
        G.bbSel = null;
        G.quickSel = null;
        G.sel = -1;
        if (typeof setWeapon === 'function') setWeapon(null);
        if (typeof refreshHotbar === 'function') refreshHotbar();
        renderPanel(false);
        return;
      }
      if (b && typeof bpItemToInv === 'function') {
        const id = (typeof bpItemCreate === 'function') ? bpItemCreate(b) : null;
        if (id && typeof selectInventoryItem === 'function') {
          // 选中蓝图物品：鼠标出现放置幽灵，点击地图即可铺建；面板保持打开可继续选
          G.bbSel = i;
          selectInventoryItem(id);
        } else if (bpItemToInv(b)) {
          toast('蓝图「' + b.name + '」已放入背包（选中后点击地图放置）');
        }
      }
      renderPanel(false);
      return;
    }
    // 蓝图库详情页：加载铺建/入包/导出/删除/返回
    if (G.panelMode === 'bluebook-detail') {
      const i = G.bbDetail;
      const b = (G.blueBook || [])[i];
      // 名称输入失焦同步（value 实时读取，无需额外事件）
      const nameInput = document.getElementById('bb-detail-name');
      const syncName = () => {
        if (nameInput && b && typeof blueBookRename === 'function') {
          const nm = nameInput.value.trim();
          if (nm && nm !== b.name) blueBookRename(i, nm);
        }
      };
      const back = ev.target.closest('#bb-detail-back');
      if (back) { G.bbDetail = null; openPanel('bluebook'); return; }
      const dPlace = ev.target.closest('#bb-detail-place');
      if (dPlace && b) {
        syncName();
        if (typeof blueBookLoad === 'function') blueBookLoad(i);
        return;
      }
      const dInv = ev.target.closest('#bb-detail-inv');
      if (dInv && b) {
        syncName();
        if (typeof bpItemToInv === 'function' && bpItemToInv(b)) toast('蓝图「' + b.name + '」已放入背包（选中后点击地图放置）');
        renderPanel(false);
        return;
      }
      const dExp = ev.target.closest('#bb-detail-export');
      if (dExp && b) {
        syncName();
        if (typeof blueBookExport === 'function') blueBookExport(i);
        return;
      }
      const dDel = ev.target.closest('#bb-detail-del');
      if (dDel && b) {
        if (window.confirm('确定删除蓝图「' + b.name + '」？')) {
          if (typeof blueBookRemove === 'function') blueBookRemove(i);
          G.bbDetail = null;
          G.bbSel = null;
          openPanel('bluebook');
        }
        renderPanel(true);
        return;
      }
    }
    // 蓝图库：加载蓝图粘贴
    const bbUse = ev.target.closest('[data-bbuse]');
    if (bbUse && G.panelMode === 'bluebook') {
      if (typeof blueBookLoad === 'function') blueBookLoad(+bbUse.dataset.bbuse);
      return;
    }
    // 蓝图库：把蓝图作为物品放入背包
    const bbInv = ev.target.closest('[data-bbinv]');
    if (bbInv && G.panelMode === 'bluebook') {
      const b = (G.blueBook || [])[+bbInv.dataset.bbinv];
      if (b && typeof bpItemToInv === 'function') {
        if (bpItemToInv(b)) toast('蓝图「' + b.name + '」已放入背包（选中后点击地图放置）');
      }
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
    // 机械臂爪上取下的物品（G.armGrab 抓取状态）→ 点击背包空格放入背包
    if (G.armGrab && ev.target.closest && (ev.target.closest('.inv-slot.empty') || ev.target.closest('#inv-items .inv-slots'))) {
      const g = G.armGrab;
      const added = (typeof invAdd === 'function') ? invAdd(g.id, g.count) : 0;
      if (added > 0) {
        const left = g.count - added;
        if (left > 0) G.armGrab.count = left;
        else G.armGrab = null;
        if (typeof playSfx === 'function') playSfx('pick');
        if (typeof toast === 'function') toast('已放入背包：' + (ITEMS[g.id]?.name || g.id) + ' ×' + added);
      } else {
        if (typeof toast === 'function') toast('背包已满，放不进去了');
      }
      renderPanel(false);
      return;
    }
    // 手持蓝图物品（放置幽灵跟随鼠标）时点击左栏背包任意格子 = 蓝图入包：
    // 空格/已有物品格都算「背包」落点（蓝图不消耗材料，入包只加 1 个蓝图物品，不吞目标物品）
    const heldBp = (typeof isBlueprintItem === 'function') ? isBlueprintItem(G.quickSel) : false;
    if (heldBp && ev.target.closest && ev.target.closest('.inv-slots') && !ev.target.closest('[data-action]')) {
      const bpId = G.quickSel;
      const bpData = (typeof bpDataOfItem === 'function') ? bpDataOfItem(bpId) : null;
      if (bpData && typeof bpItemToInv === 'function') {
        if (bpItemToInv(bpData)) toast('蓝图「' + (bpData.name || '未命名') + '」已放入背包（可从背包重新选中放置）');
        uiDirty = true;
      }
      return;
    }
    // 蓝图面板（bluebook 双栏布局）左栏背包：与背包面板一致可选中物品
    const itEl = ev.target.closest('[data-itemid]');
    // 在背包面板、蓝图面板、或任意设备交互面板（组装机/机械臂/储物箱等）左栏背包中，
    // 点击物品可选中并显示放置幽灵：设备可点击地图直接建造，材料/工具跟随鼠标（储物箱中选中后可存入箱子）。
    // 右栏设备操作区的可交互控件都带 data-action，故用 !itEl.dataset.action 排除。
    if (itEl && (G.panelMode === 'inv' || G.panelMode === 'bluebook' || (G.panelMode === 'machine' && G.panelEnt)) && !itEl.dataset.action) {
      const iid = itEl.dataset.itemid;
      // 任意物品（设备/材料/工具）均可被鼠标选中，选中后不关闭背包：
      // 设备点击地图可直接建造；材料/工具点击地图无法建造。
      // 用户可通过快捷键（E/Q）或右上角“X”关闭背包，选中状态保留。
      selectInventoryItem(iid);
      return;
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
      return;
    }
    // 星际旅行：点击星球按钮切换当前星球（需「空间平台」科技解锁，由 travelToPlanet 把关）
    const planetBtn = ev.target.closest('[data-planet]');
    if (planetBtn) {
      const target = planetBtn.dataset.planet;
      if (typeof travelToPlanet === 'function' && travelToPlanet(target)) {
        if (typeof toast === 'function') toast('🚀 已抵达 ' + ((typeof planetOption === 'function' ? planetOption(target) : null)?.name || target));
        if (typeof playSfx === 'function') playSfx('rocket');
        const _sb = document.getElementById('panel-body');
        if (_sb && typeof renderSettingsAsync === 'function') renderSettingsAsync(_sb, 0);
      } else if (typeof toast === 'function') {
        toast('未研究「空间平台」科技，无法前往该星球');
      }
      return;
    }
    // 研究面板：分类筛选 tab（仅命中真正的 tab 按钮；科技行本身也带 data-techcat，
    // 若用 [data-techcat] 会误拦截行内「研究」按钮的点击）
    const techCatBtn = ev.target.closest('.tech-tab[data-techcat], .tech-tabs [data-techcat]');
    if (techCatBtn && G.panelMode === 'tech') {
      G.techCatFilter = techCatBtn.dataset.techcat;
      renderPanel(false);
      return;
    }
    // 研究面板：点击树图节点 → 滚动定位到左边栏对应科技并高亮
    const techNode = ev.target.closest('[data-tid]');
    if (techNode && G.panelMode === 'tech') {
      const tid = techNode.dataset.tid;
      const item = document.querySelector('#tech-col-list .recipe.tech[data-techid="' + tid + '"]');
      if (item) {
        item.scrollIntoView({ block: 'nearest' });
        item.classList.add('tech-flash');
        setTimeout(() => item.classList.remove('tech-flash'), 1200);
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
        if (mch && typeof mch.setRecipe === 'function') {
          mch.setRecipe(null);
          // 若当前在设备交互面板，清除配方后重新弹出选择配方页面
          if (G.panelMode === 'machine') {
            G.recipeSel = null;
            G.rcpTab = 'logistics';
            G.rcpQ = '';
            openPanel('machinerecipe', mch);
            return;
          }
        }
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
      } else if (act === 'pickrecipe') {
        // 配方选择面板：点击配方仅高亮（不立即设置），点右下角「确认」后才设置
        if (recipeUnlocked(id)) {
          G.recipeSel = (G.recipeSel === id) ? null : id;
          // 更新确认按钮可用性与所选配方
          const conf = document.querySelector('[data-action="recipe-confirm"]');
          if (conf) {
            conf.dataset.id = G.recipeSel || '';
            if (G.recipeSel) { conf.removeAttribute('disabled'); } else { conf.setAttribute('disabled', 'disabled'); }
          }
        } else {
          toast('需先研究「' + TECHS[recipeLockingTech(id)].name + '」才能生产该配方');
        }
        renderPanel(false);
      } else if (act === 'recipe-confirm') {
        // 配方选择面板右下角「确认设置」：设置配方并进入设备交互面板
        const mch = G.panelEnt;
        if (mch && typeof mch.setRecipe === 'function' && id) {
          mch.setRecipe(id);
          G.recipeSel = null;
          openPanel('machine', mch);
        }
      } else if (act === 'switch-recipe') {
        // 交互面板「切换配方」：返回配方选择面板，预选中当前配方
        const mch = G.panelEnt;
        if (mch) {
          G.recipeSel = mch.recipe || null;
          openPanel('machinerecipe', mch);
        }
      } else if (act === 'feed-slot') {
        // 点击右侧「原料/放入」槽：从背包放入该物品
        const mch = G.panelEnt;
        if (!mch || typeof mch.giveItem !== 'function') return;
        // 配方设备：仅允许当前配方原料（点击槽本身即配方原料）；非配方设备：直接放入点击的槽对应物品
        const info = recipeDeviceInfo(mch);
        const rec = mch.recipe ? info.getRec(mch.recipe) : null;
        const isRecipeDev = !!(rec && Object.keys(rec.inp).length);
        let target = id;
        // 配方设备：若左栏已选中某个背包物品且是当前配方原料，优先放入该选中物品（对齐组装机原交互）
        if (isRecipeDev) {
          const heldItem = (typeof selItem === 'function') ? selItem() : null;
          if (heldItem && rec.inp[heldItem]) target = heldItem;
        }
        // 放入（流体走管道，仅处理可手动放入的固体）
        if (FLUIDS.indexOf(target) >= 0) { toast(ITEMS[target].name + ' 为流体，请通过管道接入'); return; }
        if (isRecipeDev && !rec.inp[target]) { toast('该物品不是当前配方原料'); return; }
        const have = invCount(target);
        if (have <= 0) { toast('背包中没有' + ITEMS[target].name); return; }
        // 逐个放入直至背包取完或设备缓存满（giveItem 满时返回 false）
        let moved = 0;
        while (moved < have && mch.giveItem(target)) moved++;
        if (moved > 0) {
          invTake(target, moved);
          if (typeof playSfx === 'function') playSfx('click');
          if (typeof updateMachineLive === 'function') updateMachineLive();
          else renderPanel(false);
        } else toast('放不进去了');
      } else if (act === 'takein-slot') {
        // 点击「原料」槽左上角 − 按钮：从设备输入缓存取回 1 件该原料到背包
        takeInSlot(id);
      } else if (act === 'take-slot') {
        // 点击右侧「产品」图标：把该产物取回背包 1 件
        const mch = G.panelEnt;
        if (!mch) return;
        let got = null;
        if (typeof mch.takeItemOf === 'function') got = mch.takeItemOf(id);
        else if (typeof mch.takeItem === 'function') got = mch.takeItem();
        if (got) {
          invAdd(got, 1);
          if (typeof playSfx === 'function') playSfx('pick');
          if (typeof updateMachineLive === 'function') updateMachineLive();
          else renderPanel(false);
        } else {
          toast('暂无' + ITEMS[id].name + '可取出');
        }
      } else if (act === 'mod-take') {
        // 点击模块插槽：取出该模块到背包
        const mch = G.panelEnt;
        if (!mch || !mch.modules || (mch.modules[id] || 0) <= 0) { toast('该槽位没有模块'); return; }
        invAdd(id, 1);
        mch.modules[id]--;
        if (mch.modules[id] <= 0) delete mch.modules[id];
        mch.prodBuf = 0;
        if (typeof playSfx === 'function') playSfx('pick');
        renderPanel(false);
      } else if (act === 'mod-put') {
        // 模块插槽只能放入插件模块：先在左栏背包选中插件，再点击此槽放入；
        // 鼠标持握的是非插件（或未持握）时不放入，并在鼠标正上方浮出提示。
        const mch = G.panelEnt;
        if (!mch || typeof mch.giveItem !== 'function') return;
        const slotN = (typeof mch.moduleSlotCount === 'function') ? mch.moduleSlotCount() : 4;
        const used = Object.values(mch.modules || {}).reduce((a, b) => a + b, 0);
        if (used >= slotN) { toast('模块插槽已满'); return; }
        const held = (typeof selItem === 'function') ? selItem() : null;
        if (!held || typeof isModule !== 'function' || !isModule(held)) {
          // 持握非插件/未持握：不放入，鼠标正上方就地浮出“只能安放插件”提示
          if (typeof showFloatWarn === 'function') showFloatWarn('此处只能安放插件', ev.clientX, ev.clientY);
          return;
        }
        if (invCount(held) > 0 && mch.giveItem(held)) {
          invTake(held, 1);
          if (typeof playSfx === 'function') playSfx('module');
        }
        renderPanel(false);
      } else if (act === 'chest-put') {
        // 储物箱「存入选中物品」：把当前选中的背包物品全部放入箱子
        const chest = G.panelEnt;
        if (!chest || typeof chest.giveItem !== 'function') return;
        const held = (typeof selItem === 'function') ? selItem() : null;
        if (!held) { toast('请先在左栏背包中选中要存入的物品'); return; }
        const have = invCount(held);
        if (have <= 0) { toast('背包中没有' + ITEMS[held].name); return; }
        let moved = 0;
        while (moved < have && chest.giveItem(held)) moved++;
        if (moved > 0) {
          invTake(held, moved);
          if (typeof playSfx === 'function') playSfx('click');
          toast('已存入 ' + ITEMS[held].name + ' ×' + moved);
          // 箱子数量变化后轻量刷新右栏
          if (typeof updateMachineLive === 'function') updateMachineLive();
          else renderPanel(false);
        } else {
          toast('箱子已满，放不进去了');
        }
      } else if (act === 'chest-take') {
        // 储物箱：点击箱内物品取出 1 件回背包（受背包堆叠上限约束）
        const chest = G.panelEnt;
        if (!chest || typeof chest.takeItemOf !== 'function') return;
        if (chest.takeItemOf(id)) {
          if (invAdd(id, 1) > 0) {
            if (typeof playSfx === 'function') playSfx('pick');
            if (typeof updateMachineLive === 'function') updateMachineLive();
            else renderPanel(false);
          } else {
            // 背包已满，把物品放回箱子
            chest.giveItem(id);
            toast('背包已满，无法放入' + ITEMS[id].name);
          }
        } else {
          toast('箱子中没有' + ITEMS[id].name);
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
      } else if (act === 'hub-cargo-load') {
        // 平台枢纽货舱：把当前选中物品装入货舱（轨道货运）
        const hub = G.panelEnt;
        if (!hub || typeof hub.giveItem !== 'function' || typeof hub.cargo !== 'object') return;
        const held = (typeof selItem === 'function') ? selItem() : null;
        if (!held) { toast('请先在左栏背包中选中要装入的物品'); return; }
        if (invCount(held) <= 0) { toast('背包中没有' + (ITEMS[held] ? ITEMS[held].name : held)); return; }
        // 平台货舱不接受流体/模块（模块走模块槽、流体走管道）
        if ((typeof FLUIDS !== 'undefined' && FLUIDS.indexOf(held) >= 0) || (typeof isModule === 'function' && isModule(held))) { toast('货舱只存实体物品'); return; }
        if (hub.giveItem(held)) { invTake(held, 1); if (typeof playSfx === 'function') playSfx('pick'); }
        else toast('货舱已满');
        if (typeof updateMachineLive === 'function') updateMachineLive();
        else renderPanel(false);
      } else if (act === 'hub-cargo-take') {
        // 平台货舱：取出指定物品 1 件回背包
        const hub = G.panelEnt;
        if (!hub || typeof hub.takeCargoItemOf !== 'function') return;
        if (hub.takeCargoItemOf(id)) { invAdd(id, 1); if (typeof playSfx === 'function') playSfx('pick'); }
        else toast('货舱没有' + (ITEMS[id] ? ITEMS[id].name : id));
        if (typeof updateMachineLive === 'function') updateMachineLive();
        else renderPanel(false);
      } else if (act === 'hub-cargo-target') {
        // 平台货舱：记录目标星球选择（用于派发）
        const hub = G.panelEnt;
        if (hub) { hub.cargoTarget = btn.value || null; }
      } else if (act === 'hub-cargo-dispatch') {
        // 平台货舱：把货舱货物派发到目标星球轨道（复用行星间货运队列）
        const hub = G.panelEnt;
        if (!hub || typeof hubDispatchCargo !== 'function') return;
        const tgt = (hub.cargoTarget) || (btn.dataset && btn.dataset.target) || null;
        if (hubDispatchCargo(hub, tgt) > 0) {
          if (typeof updateMachineLive === 'function') updateMachineLive();
          else renderPanel(false);
        }
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
      } else if (act === 'drain') {
        // "直接清空"（管道/地下管道）：抹除与当前管道互通的所有连接管道及设备中的液体，不回收物品
        const mch = G.panelEnt;
        if (mch && typeof drainFluidNetwork === 'function') {
          const cleared = drainFluidNetwork(mch);
          if (cleared > 0 && typeof playSfx === 'function') playSfx('pick');
        }
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
      }
    }
    if (!skipPanelRender) {
      renderPanel(false);
    }
    refreshHotbar();
  });
  // 背包制作栏（#inv-craft）：右键点击物品图标制作 5 个（左键在 click 处理器中制作 1 个）。
  // 与玩家背包一致的「格子 + 图标」网格交互。
  document.getElementById('panel-body').addEventListener('contextmenu', ev => {
    // 蓝图库格子：右键打开蓝图详情页
    const bbCell = ev.target.closest && ev.target.closest('[data-bbcell]');
    if (bbCell && G.panelMode === 'bluebook') {
      ev.preventDefault();
      G.bbDetail = +bbCell.dataset.bbcell;
      G.bbSel = G.bbDetail;
      openPanel('bluebook-detail');
      return;
    }
    // 蓝图详情页：右键空白处返回蓝图库
    if (G.panelMode === 'bluebook-detail') {
      ev.preventDefault();
      G.bbDetail = null;
      openPanel('bluebook');
      return;
    }
    // 设备面板「原料」槽：右键取回 1 件原料到背包
    if (G.panelMode === 'machine' && G.panelEnt) {
      const islot = ev.target.closest && ev.target.closest('.mch-io-slot[data-action="feed-slot"]');
      if (islot) {
        ev.preventDefault();
        const id = islot.dataset.id;
        takeInSlot(id);
        return;
      }
    }
    if (G.panelMode !== 'inv') return;
    const slot = ev.target.closest && ev.target.closest('[id^="inv-recipes-"] .craft-slot[data-action="craft"]');
    if (!slot) return;
    ev.preventDefault();
    const rid = slot.dataset.id;
    const n = 5;
    const queued = queueCraft(rid, n);
    if (!queued) {
      if (typeof toast === 'function') toast(recipeUnlocked(rid) ? '材料不足或背包已满' : '需先研究「' + TECHS[recipeLockingTech(rid)].name + '」才能制作');
    } else {
      const cur = craftCurrent();
      if (cur && typeof toast === 'function') toast('已开始制作 ' + ITEMS[cur.outId].name + ' ×' + queued);
    }
    if (typeof refreshHotbar === 'function') refreshHotbar();
  });

  // ===== 存档管理面板（独立于 #panel-body 的事件分发）=====
  const saveOv = document.getElementById('save-manage-overlay');
  if (saveOv) {
    // 关闭按钮
    const saveClose = document.getElementById('save-manage-close');
    if (saveClose) saveClose.addEventListener('click', () => closeSaveManage());
    // 点击遮罩空白处关闭
    saveOv.addEventListener('click', ev => { if (ev.target === saveOv) closeSaveManage(); });
    // 存档操作按钮（复用与设置面板一致的快存/读档/覆盖/删除/导出/导入）
    saveOv.addEventListener('click', async ev => {
      const btn = ev.target.closest && ev.target.closest('[data-action]');
      if (!btn) return;
      const act = btn.dataset.action;
      const id = btn.dataset.id;
      if (act === 'quick-save') { await saveGame(); await renderSaveManage(); }
      else if (act === 'quick-load') {
        const newest = (await listAllSaves())[0];
        if (newest) { await loadGame(newest.id); closeSaveManage(); if (typeof closePauseMenu === 'function') closePauseMenu(); } else { toast('暂无存档'); }
      }
      else if (act === 'load-save') { await loadGame(id); closeSaveManage(); if (typeof closePauseMenu === 'function') closePauseMenu(); }
      else if (act === 'overwrite-save') { await saveGame(id); await renderSaveManage(); }
      else if (act === 'delete-save') { await deleteSave(id); toast('已删除存档'); await renderSaveManage(); }
      else if (act === 'export-save') { if (typeof exportSave === 'function') await exportSave(id); }
      else if (act === 'exp-save') { downloadSave(); if (ev.preventDefault) ev.preventDefault(); }
      else if (act === 'imp-save') {
        const impFile = document.getElementById('save-manage-imp-file');
        if (impFile) impFile.click();
      }
    });
    // 从文件导入存档（change 事件会冒泡到 saveOv）：读取选中文件后导入并刷新列表
    saveOv.addEventListener('change', ev => {
      if (ev.target.id !== 'save-manage-imp-file') return;
      const f = ev.target.files[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = async () => {
        ev.target.value = '';   // 重置，保证再次选择同一文件也能触发 change
        try {
          await importSaveFile(rd.result);
          await renderSaveManage();
        } catch (err) {
          toast('导入失败：' + err.message);
        }
      };
      rd.onerror = () => { toast('读取文件失败'); };
      rd.readAsArrayBuffer(f);
    });
  }
}

// 设备面板「原料」槽取出：从设备输入缓存取 1 件指定原料回背包（供右键/左上角 − 按钮调用）
function takeInSlot(id) {
  const mch = G.panelEnt;
  if (!mch || typeof mch.takeInputItemOf !== 'function') return;
  let got = mch.takeInputItemOf(id);
  if (got) {
    invAdd(got, 1);
    if (typeof playSfx === 'function') playSfx('pick');
    if (typeof toast === 'function') toast('已取回 ' + ITEMS[id].name + ' 到背包');
    if (typeof updateMachineLive === 'function') updateMachineLive();
    else renderPanel(false);
  } else {
    if (typeof toast === 'function') toast('设备中没有' + ITEMS[id].name + '可取出');
  }
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
  h += '<label class="setrow"><input type="checkbox" data-set="minimap"' + (G.settings.minimap !== false ? ' checked' : '') + '> 小地图（右下角显示已探索区域，M 键切换）</label>';
  h += '<label class="setrow"><input type="checkbox" data-set="weather"' + (G.settings.weather !== false ? ' checked' : '') + '> 天气（阴云氛围，阴天时整体略暗）</label>';
  h += '<label class="setrow"><input type="checkbox" data-set="daylight"' + (G.settings.daylight !== false ? ' checked' : '') + '> 日照光照（昼夜明暗随时间变化）</label>';
  h += '<label class="setrow"><input type="checkbox" data-set="altMode"' + (G.settings.altMode ? ' checked' : '') + '> ALT 模式（建筑上显示配方/内容，Alt 键切换）</label>';
  h += '<label class="setrow"><input type="checkbox" data-set="showReach"' + (G.settings.showReach ? ' checked' : '') + '> 显示建造范围（角色周围画出可建造/交互范围圆圈）</label>';
  h += '<div class="sec">音效</div>';
  h += '<label class="setrow"><input type="checkbox" data-set="music"' + (G.settings.music !== false ? ' checked' : '') + '> 背景音乐（可单独开关）</label>';
  h += '<label class="setrow"><input type="checkbox" data-set="sound"' + (G.settings.sound ? ' checked' : '') + '> 游戏音效（建造/拆除/射击/爆炸等）</label>';
  h += '<label class="setrow">音量 <input type="range" data-setvol="soundVol" min="0" max="1" step="0.05" value="' + (G.settings.soundVol != null ? G.settings.soundVol : 0.8) + '" style="width:120px;vertical-align:middle"></label>';
  h += '<div class="sec">性能优化</div>';
  h += '<label class="setrow"><input type="checkbox" data-set="capDPR"' + (G.settings.capDPR ? ' checked' : '') + '> 限制高清缩放（DPR ≤ 1.5，降载高分屏）</label>';
  h += '<label class="setrow"><input type="checkbox" data-set="lowRes"' + (G.settings.lowRes ? ' checked' : '') + '> 省电模式（降至半分辨率，显著降 GPU 负载）</label>';
  // 星际旅行（Space Age 行星切换）：研究「空间平台」科技后解锁星际旅行
  h += '<div class="sec">星际旅行（Space Age）</div>';
  if (typeof planetId !== 'function' || typeof PLANET_OPTIONS === 'undefined') {
    h += '<div class="dim">行星系统未加载。</div>';
  } else {
    const cur = (typeof planetId === 'function') ? planetId() : 'nauvis';
    const unlocked = !!(G.techDone && G.techDone['space-platform']);
    h += '<div class="wcfg-row"><div class="wcfg-label">当前星球</div><div class="wcfg-opts">';
    h += '<button type="button" class="wcfg-opt active" style="cursor:default">' + ((typeof planetOption === 'function' ? planetOption(cur) : null)?.name || '新地星') + '</button>';
    h += '</div></div>';
    if (!unlocked) {
      h += '<div class="dim">🔒 需研究「空间平台」科技方可进行星际旅行（前往其它星球）。</div>';
    }
    h += '<div class="wcfg-row"><div class="wcfg-label">前往</div><div class="wcfg-opts">';
    for (const o of PLANET_OPTIONS) {
      if (o.v === cur) continue;
      const disabled = !unlocked ? ' disabled' : '';
      h += '<button type="button" class="wcfg-opt' + disabled + '" data-planet="' + o.v + '" title="' + o.en + '">' + o.name + (unlocked ? '' : ' 🔒') + '</button>';
    }
    h += '</div></div>';
    h += '<div class="dim">切换星球会按该星球的资源画像重新生成地表与矿脉（不同星球有不同专属资源：祝融=金属/石矿、句芒=农业/石矿、雷神=铀矿、玄冥=冰原油矿）。切换保留背包/科技/装备，但建筑为星球专属不跨星保留。</div>';
    // 空间平台遥测：全局展示各星球在途轨道货物（火箭发射送往目标星球的物资，抵达后交付）
    h += '<div class="sec">🛰️ 空间平台遥测（在途货物）</div>';
    const _oc = (G.orbitalCargo && typeof G.orbitalCargo === 'object') ? G.orbitalCargo : {};
    let _anyCargo = false;
    for (const pl of PLANET_OPTIONS) {
      const q = _oc[pl.v] || {};
      const items = Object.keys(q).filter(k => (q[k] || 0) > 0);
      if (!items.length) continue;
      _anyCargo = true;
      const pname = pl.name || pl.v;
      h += '<div class="dim" style="margin-top:4px;color:#7fd07f">🌍 ' + pname + '：';
      h += items.map(k => {
        const ic = (ITEMS[k] && ITEMS[k].color) ? '<span class="chip" data-itemid="' + k + '" data-tip="' + itemTip(k) + '"><img src="' + iconDataURL(k) + '"></span> ' : '';
        return ic + (ITEMS[k] ? ITEMS[k].name : k) + ' ×' + q[k];
      }).join('　');
      h += '</div>';
    }
    if (!_anyCargo) h += '<div class="dim">当前无在途轨道货物。在火箭发射井装入货物并选择目标星球发射后，物资会送往目标星球轨道，抵达后自动交付。</div>';
  }
  h += '<div class="sec">退出</div>';
  h += '<button data-action="quit-to-menu" style="color:#ff8a8a">🚪 退出到主页面</button>';
  h += '<div class="hint">退出到开始菜单，游戏进度请先保存（新建存档后自动持久化）。</div>';
  h += '<div class="ver-line">版本 ' + escHtml(window.__BUILD_VERSION__ || 'dev') + '</div>';
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
    h += '      <button data-action="export-save" data-id="' + s.id + '" title="单独导出该存档为文件">📦 导出</button>';
    h += '      <button data-action="delete-save" data-id="' + s.id + '" title="删除该存档">🗑 删除</button>';
    h += '    </div>';
    h += '  </div>';
    h += '  <div class="save-time">' + time + ' · ' + escHtml(s.sizeText || '') + '</div>';
    h += '</div>';
  }
  h += '</div>';
  return h;
}

// ===== 存档管理面板 =====
// 供游戏菜单“保存游戏/载入存档”打开；功能与原设置面板的存档管理完全一致
// （新建/读取最新/导出/导入 + 每条存档的读取/覆盖/删除）。
function openSaveManage() {
  const ov = document.getElementById('save-manage-overlay');
  if (!ov) return;
  ov.classList.remove('hidden');   // 打开存档管理页（游戏菜单仍处于暂停态）
  renderSaveManage();
}
function closeSaveManage() {
  const ov = document.getElementById('save-manage-overlay');
  if (ov) ov.classList.add('hidden');
}
function isSaveManageOpen() {
  const ov = document.getElementById('save-manage-overlay');
  return !!ov && !ov.classList.contains('hidden');
}
async function renderSaveManage() {
  const body = document.getElementById('save-manage-body');
  if (!body) return;
  // 首页（开始菜单，G.inMenu=true）打开时当前并无进行中的游戏，
  // 无法“新建存档”或“导出当前游戏为文件”，置灰并禁用这两个按钮。
  const inHome = !!(typeof G !== 'undefined' && G.inMenu);
  const dis = inHome ? ' disabled' : '';
  let h = '<div class="save-actions">';
  h += '<button data-action="quick-save"' + dis + ' title="' + (inHome ? '主页无进行中的游戏，不可存档' : '新建存档') + '">➕ 新建存档</button>';
  h += '<button data-action="quick-load">读取最新存档</button>';
  h += '<button data-action="exp-save"' + dis + ' title="' + (inHome ? '主页无进行中的游戏，不可导出' : '导出当前游戏为文件') + '">导出存档到文件</button>';
  h += '<button data-action="imp-save">从文件导入存档</button>';
  h += '</div>';
  h += '<input type="file" id="save-manage-imp-file" accept=".json,.gz,.json.gz,application/json,application/gzip" style="display:none">';
  h += '<div class="hint">自动存档保留最近 3 个（旧的自动覆盖）；用户可自行新建/覆盖/读取/删除存档。</div>';
  h += await saveListHtml();
  if (document.getElementById('save-manage-overlay') && !document.getElementById('save-manage-overlay').classList.contains('hidden')) {
    body.innerHTML = h;
  }
}

// ===== 背包手动摆放：把 from 格物品移到 to 格（需求：背包不自动排序）=====
// 展示模型：手动摆放的物品记录在 G.invSlots（下标即格子下标，可含 null 空位），
// 自动物品按 G.inv 获取顺序排在所有手动槽之后。拖拽落位规则：
//   - 目标格有物品：目标格及其后物品整体后移一格，腾出目标格给拖拽物品（目标格原物品顺延）；
//   - 目标格为空：直接落位。
// 落位后该物品即成为「手动摆放」物品，固定在该格；被挤出的物品回到自动区（排到最后）。
function moveInvItemToSlot(from, to) {
  if (from === to) return;
  const L = (typeof invSlotLayout === 'function') ? invSlotLayout() : null;
  if (!L) return;
  const fromId = (typeof invSlotIdAt === 'function') ? invSlotIdAt(from, L) : null;
  if (!fromId) return;
  const total = L.total;
  // 一维展示序列（null=空格）
  const seq = [];
  for (let i = 0; i < total; i++) seq.push((typeof invSlotIdAt === 'function') ? invSlotIdAt(i, L) : null);
  // 从来源移除
  seq[from] = null;
  // 目标格及之后整体右移一格，腾出 to 格
  for (let i = total - 1; i > to; i--) seq[i] = seq[i - 1];
  seq[to] = fromId;
  // 重新切分：手动槽长度扩展覆盖 to（若 to 在自动区）；自动区为剩余非空物品
  const mlen = Math.max(L.manual.length, to + 1);
  const newManual = seq.slice(0, mlen);
  const newAuto = seq.slice(mlen).filter(id => id != null);
  // 手动槽去重（同物品不应占两格，保留靠前位置）
  const seen = new Set();
  for (let i = 0; i < newManual.length; i++) {
    if (newManual[i] != null) {
      if (seen.has(newManual[i])) newManual[i] = null;
      else seen.add(newManual[i]);
    }
  }
  // 尾部空位压缩：末尾连续空槽收掉，避免手动槽无限增长
  while (newManual.length && newManual[newManual.length - 1] == null) newManual.pop();
  G.invSlots = newManual;
  // 重建 G.inv 顺序：手动槽顺序优先，自动物品按 newAuto 顺序在后（含被挤出物品，排到最后）
  const seen2 = new Set();
  const ordered = [];
  for (const id of newManual) if (id != null && !seen2.has(id)) { seen2.add(id); ordered.push(id); }
  for (const id of newAuto) if (!seen2.has(id)) { seen2.add(id); ordered.push(id); }
  for (const [id, n] of G.inv) if (!seen2.has(id)) { seen2.add(id); ordered.push(id); }
  const newInv = new Map();
  for (const id of ordered) if (G.inv.has(id)) newInv.set(id, G.inv.get(id));
  G.inv = newInv;
}

// 背包物品点击：把任意物品（设备/材料/工具）放入鼠标选中状态。
// 设备点击地图可直接建造；材料/工具点击地图无法建造（由 tryPlaceAt 内部拦截）。
// 选中后不关闭背包，用户通过快捷键(E/Q)或右上角“X”关闭后选中状态保留。
function selectInventoryItem(iid) {
  // 蓝图物品（blueprint#n）：先解析基础 id 再查 ITEMS（blueprint#3 不在 ITEMS 表里）
  const isBp = (typeof isBlueprintItem === 'function') && isBlueprintItem(iid);
  if (!ITEMS[iid] && !isBp) return;
  if (isBp && !ITEMS['blueprint']) return;
  const dispId = isBp ? 'blueprint' : iid;
  // 选中任意物品（设备/材料/工具）都让鼠标显示放置幽灵：
  // 统一用 quickSel 临时持握，不占用/不高亮快捷栏槽位（快捷栏无选中效果）。
  G.sel = -1;
  G.quickSel = iid;
  G.ghostDir = 0;
  refreshHotbar();
  uiDirty = true;
  if (typeof setWeapon === 'function') setWeapon(iid);
  if (typeof playSfx === 'function') playSfx('select');
  const buildable = isBp || !!BUILD_DEFS[iid];
  toast('已选中 ' + (ITEMS[dispId] ? ITEMS[dispId].name : '蓝图') +
    (isBp ? '（蓝图物品）：点击地图放置蓝图内容，R 旋转，V/H 翻转，Q 取消' :
      (buildable ? '，点击地图直接建造（Q 取消）' : '，鼠标显示物品幽灵，可放入快捷栏或按 Q 取消')));
}

// 恢复面板默认位置：清除拖动期间写入的内联 left/top/transform，
// 让各面板 CSS 的默认定位（居中 / 底部锚定）重新生效。
function resetPanelPos() {
  const panel = document.getElementById('panel');
  panel.style.left = '';
  panel.style.top = '';
  panel.style.transform = '';
  panel.style.right = '';
  panel.style.bottom = '';
}

// ===== 机械臂筛选物品选择弹窗（复用 #hud-modal 弹框）=====
// 启动筛选后点击某个筛选格子（+ 或物品图标）弹出本弹窗，在 5 大分组里浏览物品；
// 点击某个物品即回填到对应的筛选格（对齐组装机选择配方弹框的分组样式）。
let _fltCtx = null;   // { e: 机械臂实体, idx: 第几格(0..4) }
let _fltTab = 'logistics';
let _fltQ = '';
let _fltComposing = false;

// 二级分组的中文名（官方 item-subgroup id → 中文）。未收录的兜底返回可读英文标题。
function fltSubgroupLabel(sg) {
  const M = {
    'raw-resource': '原料', 'raw-material': '板材·原料', 'solid-raw-material': '固体原料',
    'terrain': '地形', 'vulcanus-processes': '沃库纳工艺', 'gleba-processes': '格列巴工艺',
    'intermediate-product': '中间产品', 'intermediate': '中间产品', 'liquid': '液体', 'fluid': '液体',
    'science-pack': '科技包', 'belt': '传送带', 'inserter': '机械臂', 'logistics': '物流',
    'storage': '存储', 'energy-pipe-distribution': '管道·电网', 'energy': '发电',
    'extraction-machine': '采集设备', 'smelting-machine': '冶炼设备', 'production-machine': '生产设备',
    'circuit-network': '电路网络', 'signal': '信号', 'constant': '常量',
    'train-system': '列车', 'rail': '轨道', 'logistic-chest': '物流箱', 'drone': '无人机',
    'turret': '炮塔', 'defensive-structure': '防御建筑', 'combat': '武器', 'ammo': '弹药',
    'gun': '枪械', 'capsule': '胶囊', 'module': '插件', 'equipment': '装备',
    'energy-logistics': '能量·物流', 'armor': '装甲', 'space-pack': '太空包裹',
    'space-platform': '太空平台', 'astroid': '小行星', 'mining-product': '矿物产物',
    'products': '产物', 'fuel': '燃料', 'tool': '工具'
  };
  return M[sg] || sg.replace(/-/g, ' ');
}

// 把所有可选筛选物品按 5 大分组归类（物品组别取自 factorio-data 的 itemGroup）
function filterChooserGroups() {
  const perTab = { logistics: [], production: [], 'intermediate-products': [], space: [], combat: [] };
  const choices = (typeof filterChoices === 'function') ? filterChoices() : FILTER_CHOICES;
  for (const id of choices) {
    const tab = (GAME_DATA.itemGroup && GAME_DATA.itemGroup[id]) || 'logistics';
    if (!perTab[tab]) continue;
    perTab[tab].push(id);
  }
  return perTab;
}

function filterChooserPanelHtml() {
  const perTab = filterChooserGroups();
  // 当前分类没有任何可选物品时，回退到第一个非空分类（空分类 Tab 不显示）
  if (!(_fltTab && perTab[_fltTab] && perTab[_fltTab].length)) {
    _fltTab = CRAFT_TABS.find(t => perTab[t] && perTab[t].length) || 'logistics';
  }
  const e = _fltCtx ? _fltCtx.e : null;
  let h = '<div class="flt-modal">';
  h += '<input id="flt-search" class="inv-search" type="text" placeholder="搜索物品（输入名称）" autocomplete="off" value="' + _fltQ + '">';
  // 5 个分组 Tab
  h += '<div class="craft-tabs" id="flt-tabs">';
  for (const tab of CRAFT_TABS) {
    const n = (perTab[tab] || []).length;
    if (!n) continue; // 该分类没有可筛选物品的 Tab 不显示
    const on = tab === _fltTab ? ' active' : '';
    const label = CRAFT_TAB_LABEL[tab];
    h += '<button type="button" class="craft-tab' + on + '" data-act="flt-tab" data-tab="' + tab + '">' +
      '<span class="tab-icon">' + label.icon + '</span><span class="tab-label">' + label.text + '</span>' +
      '<span class="cnt">' + n + '</span></button>';
  }
  h += '</div>';
  for (const tab of CRAFT_TABS) {
    const on = tab === _fltTab ? '' : ' style="display:none"';
    const items = perTab[tab] || [];
    // Tab 内再按官方二级分组（item-subgroup）归类，组序按 subgroupOrder、组内按 itemOrder（与制作栏一致）
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
        const name = (ITEMS[id] && ITEMS[id].name) ? ITEMS[id].name : id;
        const already = (e && e.filters && e.filters.indexOf(id) >= 0);
        grid += '<button type="button" class="flt-item' + (already ? ' sel' : '') + '" data-act="flt-choose" data-id="' + id + '" data-idx="' + (_fltCtx ? _fltCtx.idx : 0) + '"' +
          ' data-rsearch="' + (name + ' ' + id).toLowerCase() + '"' +
          ' data-tip="' + itemTip(id) + '"' +
          (already ? ' title="已在筛选列表中"' : '') + '>' +
          '<img src="' + iconDataURL(id) + '"><span>' + name + '</span></button>';
      }
      grid += '</div>';
    }
    h += '<div class="flt-grid" data-tab="' + tab + '"' + on + '>' + grid + '</div>';
  }
  h += '<div class="dim" id="flt-empty" style="display:none"></div>';
  h += '<div class="dim">点击物品即设置到该筛选格。已选中的物品高亮显示。</div>';
  h += '</div>';
  return h;
}

function openFilterChooser(e, idx) {
  if (!e) return;
  _fltCtx = { e, idx };
  _fltTab = 'logistics';
  _fltQ = '';
  const title = document.getElementById('hud-modal-title');
  if (title) title.textContent = (e.type === 'burner-inserter' ? '热能机械臂' : '机械臂') + ' · 选择筛选物品';
  const body = document.getElementById('hud-modal-body');
  if (body) body.innerHTML = filterChooserPanelHtml();
  applyFltSearch('');
  const hm = document.getElementById('hud-modal');
  hm.classList.add('flt-wide');
  hm.classList.remove('hidden');
}

function closeFilterChooser() {
  _fltCtx = null;
  const m = document.getElementById('hud-modal');
  m.classList.remove('flt-wide');
  m.classList.add('hidden');
  const body = document.getElementById('hud-modal-body');
  if (body) body.innerHTML = '';
  uiDirty = true;
}

function filterChooserSwitchTab(tab) {
  if (CRAFT_TABS.indexOf(tab) < 0) tab = 'logistics';
  _fltTab = tab;
  for (const b of document.querySelectorAll('#flt-tabs .craft-tab')) b.classList.toggle('active', b.dataset.tab === tab);
  for (const t of CRAFT_TABS) {
    const g = document.querySelector('.flt-grid[data-tab="' + t + '"]');
    if (g) g.style.display = (t === tab) ? '' : 'none';
  }
  applyFltSearch(_fltQ);
}

// 分组网格搜索过滤：仅过滤当前分组，就地隐藏不匹配项（不重建 DOM，保住输入焦点）
function applyFltSearch(q) {
  const ql = (q || '').trim().toLowerCase();
  _fltQ = q;
  let shown = 0;
  for (const grid of document.querySelectorAll('#hud-modal-body .flt-grid')) {
    if (grid.dataset.tab !== _fltTab) { grid.style.display = 'none'; continue; }
    grid.style.display = '';
    let cnt = 0;
    for (const it of grid.querySelectorAll('.flt-item')) {
      const hit = !ql || (it.dataset.rsearch || '').includes(ql);
      it.style.display = hit ? '' : 'none';
      if (hit) cnt++;
    }
    // 搜索时隐藏没有任何可见物品的二级分组（保持分组紧凑）
    for (const grp of grid.querySelectorAll('.flt-subgroup')) {
      grp.style.display = Array.from(grp.querySelectorAll('.flt-item'))
        .some(el => el.style.display !== 'none') ? '' : 'none';
    }
    shown = cnt;
  }
  // 搜索时同步更新 Tab 角标为「当前搜索命中的数量」，并隐藏命中为 0 的 Tab
  // （若当前激活 Tab 命中 0，updateCraftTabCounts 会自动切换到第一个仍有结果的 Tab）
  const modalBody = document.getElementById('hud-modal-body');
  if (modalBody) {
    _fltTab = updateCraftTabCounts(modalBody, '#flt-tabs .craft-tab',
      tab => modalBody.querySelector('.flt-grid[data-tab="' + tab + '"]'), '.flt-item', ql, _fltTab);
    // 空态统计以（可能已切换的）当前激活 Tab 为准
    const activeGrid = modalBody.querySelector('.flt-grid[data-tab="' + _fltTab + '"]');
    shown = activeGrid ? Array.from(activeGrid.querySelectorAll('.flt-item')).filter(el => el.style.display !== 'none').length : 0;
  }
  const emp = document.getElementById('flt-empty');
  if (emp) {
    emp.textContent = ql ? '没有匹配「' + q.trim() + '」的物品' : '该分类暂无物品';
    emp.style.display = shown ? 'none' : '';
  }
}

function filterChooserPick(id, idx) {
  const e = _fltCtx ? _fltCtx.e : null;
  if (!e) { closeFilterChooser(); return; }
  if (!e.filters) e.filters = [];
  e.filters[idx] = id;
  closeFilterChooser();
  renderPanel(false);   // 回填后刷新机械臂面板，让格子显示所选物品
}

// 筛选弹窗交互：弹窗位于 #hud-modal（不在 #panel-body 内），不经过面板分发，单独监听
document.addEventListener('click', ev => {
  if (!_fltCtx) return;
  // 关闭按钮：关闭并清空上下文
  if (ev.target && ev.target.id === 'hud-modal-close') { ev.stopPropagation(); closeFilterChooser(); return; }
  const tab = ev.target.closest && ev.target.closest('#flt-tabs .craft-tab[data-tab]');
  if (tab) { ev.stopPropagation(); filterChooserSwitchTab(tab.dataset.tab); return; }
  const item = ev.target.closest && ev.target.closest('#hud-modal-body .flt-item[data-id]');
  if (item) { ev.stopPropagation(); filterChooserPick(item.dataset.id, +item.dataset.idx); }
});
document.addEventListener('compositionstart', ev => { if (ev.target && ev.target.id === 'flt-search') _fltComposing = true; });
document.addEventListener('compositionend', ev => { if (ev.target && ev.target.id === 'flt-search') { _fltComposing = false; applyFltSearch(ev.target.value); } });
document.addEventListener('input', ev => {
  if (ev.target && ev.target.id === 'flt-search' && _fltCtx && !_fltComposing) applyFltSearch(ev.target.value);
});
