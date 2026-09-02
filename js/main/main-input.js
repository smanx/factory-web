'use strict';

// 电线杆拖建锚点：按住左键拖拽铺设电线杆时，记录上一根杆的放置格，
// 拖动超过其最远连线距离才落下一根（对齐《异星工厂》拖建电线杆按最远距离间隔铺设）。
let poleAnchor = null;

// 远程视图右键长按标记拆除：按住目标超过该时长（秒）才登记拆除标记，避免误触。
const REMOTE_DECON_HOLD = 0.4;

function bindInput() {
  window.addEventListener('keydown', ev => {
    const k = ev.key.toLowerCase();
    if (G.inMenu) return;                 // 开始菜单期间屏蔽游戏快捷键
    if (k === 'f5' || k === 'f12') return;
    const t = ev.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
      if (k === 'escape') { ev.target.blur(); ev.stopPropagation(); }
      return;
    }
    // 只有鼠标点击按钮才能触发按钮操作；按回车/空格不再触发当前聚焦按钮的点击
    if (t && t.tagName === 'BUTTON' && (k === 'enter' || k === ' ')) {
      ev.preventDefault();
      t.blur();
      return;
    }
    // 组合键与单键区分：当修饰键(Alt/Ctrl/Shift)同时按下时属组合键操作，不写入 G.keys。
    // G.keys 驱动“按住即生效”的单键行为（人物移动/连续开火等），组合键要么走事件标志直接
    // 处理（如 Alt+D 红图），要么根本无意触发的单键功能（如 Alt+D 不应让人物向右走）。
    if (!ev.altKey && !ev.ctrlKey && !ev.shiftKey) G.keys[k] = true;
    // Shift+左键放置“建造虚影”（对齐《异星工厂》Shift+点击放置建造幽灵）：全局记录 Shift 是否按住。
    if (k === 'shift') G.shiftHeld = true;
    // Ctrl 按住状态：供强建判定（Shift+Ctrl 放置蓝图 = 超级强制建造）。
    else if (k === 'control') G.ctrlHeld = true;
    // 组合键识别：按下其他按键时若 Alt 处于按住状态，标记本次 Alt 被用于组合键。
    // 松开 Alt 时据此跳过 ALT 模式切换，避免 Alt+D/B/U/H/N 等组合键误触发“单按 ALT”的功能。
    if (ev.altKey && k !== 'alt') G._altCombo = true;
    if (k >= '1' && k <= '9') selectSlot(+k - 1);
    else if (k === '0') selectSlot(9);
    // 攻击选中目标（对齐《异星工厂》快捷键）：Shift+空格 对鼠标选中的目标开火（强制攻击）
    else if (k === ' ' && ev.shiftKey && !ev.ctrlKey && !ev.altKey) {
      ev.preventDefault();
      if (typeof attackSelectedTarget === 'function') attackSelectedTarget();
    }
    else if (k === 'tab') { ev.preventDefault(); G.panelMode === 'inv' ? closePanel() : openPanel('inv'); }
    // 统计/蓝图/红图/绿图快捷键（对齐《异星工厂》：P 统计、B 蓝图、Alt+D 红图、Alt+U 绿图）
    // 性能模式（Shift+P）：一键开关简化渲染。原版 P=生产统计、Shift+P 未占用，故不冲突。
    else if (k === 'p' && ev.shiftKey && !ev.ctrlKey && !ev.altKey) {
      if (!ev.repeat) {
        G.settings.perfMode = !G.settings.perfMode;
        saveSettings();
        toast(G.settings.perfMode ? '性能模式：开（简化渲染提升帧率，Shift+P 切回）' : '性能模式：关（完整渲染）');
        // 设置面板开着时同步刷新复选框状态
        if (G.panelMode === 'set' && typeof renderSettingsAsync === 'function') {
          const _sb = document.getElementById('panel-body');
          if (_sb) renderSettingsAsync(_sb, 0);
        }
      }
    }
    else if (k === 'p' && !ev.shiftKey) G.panelMode === 'stats' ? closePanel() : openPanel('stats');
    else if (!ev.altKey && k === 'b') { G.panelMode === 'bluebook' ? closePanel() : openPanel('bluebook'); }
    else if (ev.altKey && k === 'b') { ev.preventDefault(); if (G.blueMode) cancelBlueprint(); closePanel(); toggleBlueprint('bluecreate'); }
    // Ctrl+C 快速复制：进入蓝图模式并提示框选（框选松开鼠标后自动复制为蓝图粘贴）
    else if (ev.ctrlKey && k === 'c') { ev.preventDefault(); closePanel(); toggleBlueprint('blue'); toast('快速复制：拖拽框选一片建筑，松开鼠标即复制为蓝图'); }
    // Ctrl+X 快速剪切：框选后复制为蓝图并删除原建筑（物资返还背包）
    else if (ev.ctrlKey && k === 'x') { ev.preventDefault(); closePanel(); toggleBlueprint('cut'); toast('快速剪切：拖拽框选一片建筑，松开鼠标后复制为蓝图并拆除原建筑'); }
    else if (ev.altKey && k === 'd') { ev.preventDefault(); closePanel(); toggleBlueprint('red'); }
    else if (ev.altKey && k === 'u') { ev.preventDefault(); closePanel(); toggleBlueprint('green'); }
    else if ((k === 'delete' || k === 'backspace') && G.panelMode === 'machine' &&
             G.panelEnt && typeof G.panelEnt.setRecipe === 'function' && G.panelEnt.recipe) {
      G.panelEnt.setRecipe(null);
      renderPanel(false);
      toast('配方已清除');
    }
    else if (k === 'r') rotateAction();
    else if (!ev.altKey && k === 'h') flipAction('h');
    else if (k === 'v') flipAction('v');
    else if (k === 'f') { if (!tryEnterNearbyCar()) pickupAction(); }
    // Z：丢弃物品（对齐《异星工厂》）——鼠标持握时丢 1 个手持物品到地面；
    // 否则丢弃当前选中的普通物品；两者皆无时回退为「拾取范围内全部地面物品」
    else if (k === 'z') {
      // Z：上下文放入优先（设备控制面板当前鼠标指向的槽位 / 地图设备原料·燃料），
      // 已由 zPlaceHeldAtContext 处理（放入成功或判定「不放入」）则不再落到地面/拾取。
      if (typeof zPlaceHeldAtContext === 'function' && zPlaceHeldAtContext()) return;
      if (G.held) { if (typeof dropHeldToGround === 'function') dropHeldToGround(); }
      else if (!(typeof dropHeldItemToGround === 'function' && dropHeldItemToGround())) {
        if (typeof pickupAllAction === 'function') pickupAllAction();
      }
    }
    else if (k === 'e') {
      if (G.driving) { if (typeof exitCar === 'function') exitCar(); }
      else if (G.panelMode === 'inv') closePanel();
      else openPanel('inv');
    }
    else if (k === 't') G.panelMode === 'tech' ? closePanel() : openPanel('tech');
    else if (k === 'o') G.panelMode === 'set' ? closePanel() : openPanel('set');
    // L：打开/关闭物流网络面板（查看各物流网络的设备与物资）
    else if (k === 'l') G.panelMode === 'logi' ? closePanel() : openPanel('logi');
    // M：打开/关闭远程视图（对齐《异星工厂》M 打开地图视图）。不再是切换小地图开关。
    else if (k === 'm') { if (typeof toggleRemoteView === 'function') toggleRemoteView(); }
    // 地图标记（对齐《异星工厂》：N 放置地图标记，Alt+N 管理）
    else if (ev.altKey && k === 'n') {
      ev.preventDefault();
      G.panelMode === 'maptags' ? closePanel() : openPanel('maptags');
    }
    else if (k === 'n') { if (typeof placeMapTag === 'function') placeMapTag(); }
    // 操作说明（Alt+H）：随时查看完整快捷键指南
    else if (ev.altKey && k === 'h') { ev.preventDefault(); if (typeof showTutorial === 'function') showTutorial(); }
    else if (ev.altKey && k === 'f') { ev.preventDefault(); if (typeof toggleRoboportActive === 'function') toggleRoboportActive(); }
    // C 键：在左下角快捷栏武器槽中从左到右循环切换当前武器（无武器则不切换）
    else if (k === 'c') { if (typeof cycleQuickbarWeapon === 'function') cycleQuickbarWeapon(); }
    else if (k === 'escape') {
      // ESC 键：弹框从最上层逐层往下关闭（确认 → 存档管理 → 面板 → 游戏菜单）；
      // 仅剩游戏界面（驾驶/蓝图/拆除等状态）则处理对应状态；若无任何弹框则直接打开游戏菜单。
      if (isConfirmOpen()) {
        closeConfirm();                          // 最上层：二级确认弹框
      } else if (isSaveManageOpen()) {
        closeSaveManage();                       // 存档管理面板
      } else if (G.panelMode) {
        closePanel();                            // 设置/背包/设备等面板
      } else if (isPauseMenuOpen()) {
        closePauseMenu();                        // 游戏菜单
      } else if (G.driving) {
        if (typeof exitCar === 'function') exitCar();
      } else if (G.blueMode || G.remoteUnmark) {
        cancelBlueprint();
      } else if (G.deconstructMode) {
        toggleDeconstructMode(false);
      } else if (G.remoteView) {
        // 远程视图：ESC 退出远程视图（对齐《异星工厂》关闭地图视图）
        if (typeof exitRemoteView === 'function') exitRemoteView();
      }
      // 游戏界面无任何弹框：直接展开游戏菜单并暂停
      else {
        openPauseMenu();
      }
    }
    else if (k === 'q') {
      // Q 键：优先「清理光标」——鼠标持握物品时把物品收回背包（对齐《异星工厂》）
      if (G.held && !G.driving) {
        if (typeof heldToBackpack === 'function') heldToBackpack();
        if (G.panelMode) renderPanel(false);
        uiDirty = true;
      }
      // Q：鼠标悬停在建造虚影上时，快速选中该虚影对应的建筑（对齐《异星工厂》在幽灵上按 Q 选取建筑）。
      // 优先于「取消当前选中」，保证手一悬在虚影上按 Q 即可取用该建筑。
      else if (G.cursorTile && typeof ghostAt === 'function' && ghostAt(G.cursorTile.tx, G.cursorTile.ty, 1, 1)) {
        const gg = ghostAt(G.cursorTile.tx, G.cursorTile.ty, 1, 1);
        G.sel = -1;
        G._clickMoveFrom = null;
        if (gg.type && BUILD_DEFS[gg.type]) {
          G.quickSel = gg.type;
          G.ghostDir = gg.dir;
          G.ghostMirror = gg.mirror | 0;
          toast('已直接选中 ' + ITEMS[gg.type].name + '（Q 取消）');
        }
        uiDirty = true;
        refreshHotbar();
      }
      // 否则保留原快速取/取消选择逻辑（对齐《异星工厂》Q 取消选择）
      else if (G.driving) { if (typeof exitCar === 'function') exitCar(); }
      else if (G.blueMode) {
        cancelBlueprint();
      } else if (G.deconstructMode) {
        toggleDeconstructMode(false);
      } else if (G.panelMode) {
        closePanel();
      } else if (buildActive() || !G.cursorTile) {
        // 按 Q 取消当前选中/放置幽灵（对齐《异星工厂》Q 取消选择）。
        // 无论建筑还是材料/工具，按 Q 都清除选中并取消放置幽灵：
        // 修复材料放置幽灵按 Q 无反应（此前材料会被“丢弃到地面”而非取消幽灵）。
        G.sel = -1;
        G.quickSel = null;
        G._clickMoveFrom = null;
        if (typeof heldReturn === 'function') heldReturn();
        refreshHotbar();
      } else {
        const e = entAt(G.cursorTile.tx, G.cursorTile.ty);
        // 选中建筑：统一用 quickSel（快捷栏无选中效果），鼠标直接显示放置幽灵
        G.sel = -1;
        if (e && BUILD_DEFS[e.type]) {
          G.quickSel = e.type;
          G.ghostDir = e.dir;
          G.ghostMirror = e.mirror | 0;
          toast('已直接选中 ' + ITEMS[e.type].name + '（Q 取消）');
        }
        uiDirty = true;
        refreshHotbar();
      }
    }
  });
  window.addEventListener('keyup', ev => {
    const k = ev.key.toLowerCase();
    // ALT 模式（对齐《异星工厂》ALT 模式）：松开 Alt 键时才切换建筑配方/内容叠加显示。
    // 改为松开时触发：按下即切换会在 Alt+Tab 切换页面等场景误触发 ALT 功能。
    // 若本次 Alt 被用于组合键（Alt+D 等），松开时不切换 ALT 模式，避免组合键误触单按 ALT。
    if (k === 'alt') {
      ev.preventDefault();
      if (G._altCombo) { G._altCombo = false; return; }
      G.settings.altMode = !(G.settings.altMode !== false);
      saveSettings();
      toast(G.settings.altMode ? 'ALT 模式：开（显示建筑配方/内容叠加）' : 'ALT 模式：关');
      return;
    }
    // Shift+左键放置“建造虚影”：松开 Shift 复位，避免拖建时误判仍处于虚影模式。
    if (k === 'shift') G.shiftHeld = false;
    else if (k === 'control') G.ctrlHeld = false;
    G.keys[k] = false;
  });

  G.canvas.addEventListener('mousemove', ev => {
    updateCursorTile(ev.clientX, ev.clientY);
    if (G.blueSelecting && G.cursorTile) {
      G.blueEnd = { tx: G.cursorTile.tx, ty: G.cursorTile.ty };
    }
  });
  // 放置幽灵需与鼠标同层级、显示在背包面板/底部工具栏等界面上方：
  // 在 window 上监听鼠标移动，保证鼠标悬停在面板/工具栏上时 cursorTile 持续更新，
  // 从而使放置幽灵始终跟随鼠标并绘制在最上层（幽灵画布 pointer-events:none，不挡交互）。
  window.addEventListener('mousemove', ev => {
    updateCursorTile(ev.clientX, ev.clientY);
  });
  G.canvas.addEventListener('mouseenter', () => { G.canvasActive = true; });
  G.canvas.addEventListener('mouseleave', () => {
    G.canvasActive = false;
    G.cursorTile = null;
    G.mouseDown = false;
    G.mouseRightDown = false;
    G.remoteDeconPress = null;
    poleAnchor = null;
  });
  G.canvas.addEventListener('mousedown', ev => {
    ev.preventDefault();
    updateCursorTile(ev.clientX, ev.clientY);
    // 记录本次点击刚放置的实体（标记上一轮点击的历史），用于 click 区分「放置」与「点击已有设备」
    G._lastPlacedEnt = null;
    // 蓝图/红图交互：左键开始框选或粘贴，右键取消
    if (G.blueMode) {
      if (ev.button === 2) { cancelBlueprint(); return; }
      if (ev.button === 0) {
        if (G.blueMode === 'paste') {
          // Shift=强制建造（无视树/峭壁，跳过建筑冲突）；Shift+Ctrl=超级强制建造（连同建筑一并标记拆除后重建）
          const force = (ev.shiftKey && ev.ctrlKey) ? 2 : (ev.shiftKey ? 1 : 0);
          pasteBlueprint(force);
          // 粘贴后保持粘贴模式，可继续在别处粘贴（右键或按 Q/Esc 取消）
        } else {
          G.blueStart = { tx: G.cursorTile.tx, ty: G.cursorTile.ty };
          G.blueEnd = { tx: G.cursorTile.tx, ty: G.cursorTile.ty };
          G.blueSelecting = true;
          // 红图模式下按住 Shift 框选 = 取消拆除标记（松开鼠标时由 mouseup 按此标志分发）
          G.blueUnmark = (G.blueMode === 'red' && ev.shiftKey && !ev.ctrlKey && !ev.altKey);
        }
        return;
      }
      return;
    }
    const hovered = G.cursorTile ? entAt(G.cursorTile.tx, G.cursorTile.ty) : null;
    // Ctrl+左/右键：与实体快速转移（对齐《异星工厂》：不打开面板直接存取物品）。
    // 左键整组、右键一半；空手取出、手持/选中物品放入（设备只收其需要的物品）。
    if (ev.ctrlKey && !ev.altKey && !ev.shiftKey && hovered && G.cursorTile &&
        (ev.button === 0 || ev.button === 2) && withinReach(G.cursorTile.tx, G.cursorTile.ty) &&
        typeof quickTransferEntity === 'function' && quickTransferEntity(hovered, ev.button === 2)) {
      if (G.panelMode === 'machine' && G.panelEnt === hovered) {
        if (typeof updateMachineLive === 'function') updateMachineLive(); else renderPanel(false);
      }
      return;
    }
    if (ev.button === 0) {
      // 远程视图：Shift+左键框选 = 取消范围内拆除标记（对齐红图 Shift 框选取消，无需进入红图模式）。
      // 按住 Shift 拖拽出红色虚线框，松开后取消框内设备/树木/峭壁的拆除标记。
      if (G.remoteView && ev.shiftKey && !ev.ctrlKey && !ev.altKey && G.cursorTile) {
        G.remoteUnmark = true;
        G.blueStart = { tx: G.cursorTile.tx, ty: G.cursorTile.ty };
        G.blueEnd = { tx: G.cursorTile.tx, ty: G.cursorTile.ty };
        G.blueSelecting = true;
        return;
      }
      // Shift+左键“粘贴设置”，与普通左键建造（默认支持覆盖）区分开
      if (ev.shiftKey && !ev.ctrlKey && hovered) { pasteSettings(hovered); return; }
      // 拆除模式：左键用于拆除建筑，而非建造/挖矿
      if (G.deconstructMode) {
        G.deconstructHeld = true;
        if (G.cursorTile) deconstructAt(G.cursorTile.tx, G.cursorTile.ty);
        return;
      }
      G.mouseDown = true;
      lastPlaceKey = '';
      handleLeftDown();
    } else if (ev.button === 2) {
      // 按住右键挖矿/砍树（对齐新控制方案：右键采集）
      G.mouseRightDown = true;
      // 远程视图：右键长按目标才标记拆除（对齐《异星工厂》地图视图）。
      // 按下仅开始计时，不立即标记；按住超过 REMOTE_DECON_HOLD 秒后在按下位置标记一次
      // （由 updateHeldMouse 计时分发）；长按期间鼠标移开则取消，快速点按不误触。
      if (G.remoteView) {
        G.remoteDeconPress = G.cursorTile ? { tx: G.cursorTile.tx, ty: G.cursorTile.ty, t: 0, hold: REMOTE_DECON_HOLD } : null;
        return;
      }
      if (ev.shiftKey && hovered) { copySettings(hovered); return; }
      // 右键取物优先：地下带/部分可逐个取物的设备（对齐《异星工厂》）。
      // 注意：传送带是流动的，若右键优先取物，移动中的传送带会不断补充导致永远取不完、
      // 且拆除永远不触发（return 提前返回）。因此传送带不参与“右键取物”，右键直接整体拆除：
      // 由 deconstructAt 一次性把带上全部物品移除并返还，再移除建筑本身（对齐《异星工厂》拆除）。
      // 地下传送带同理：它在运行时也是流动的，若先取物则同样永远取不完、拆除永不触发，
      // 因此也排除在“右键取物”之外，右键直接整体拆除（连同洞内/待发的全部物品一起返还）。
      // 同理，机械臂爪上抓取的物品也应随拆除一次性返还，而不是逐件取走阻塞拆除：
      // 由 deconstructAt 一次性把带上/爪上全部物品移除并返还，再移除建筑本身（对齐《异星工厂》拆除）。
      if (G.cursorTile && withinReach(G.cursorTile.tx, G.cursorTile.ty)) {
        const e = entAt(G.cursorTile.tx, G.cursorTile.ty);
        if (!(e instanceof Belt) && !(e instanceof Underground) && !(e instanceof Inserter) && rightClickPickupAt(G.cursorTile.tx, G.cursorTile.ty)) return;
      }
      if (G.cursorTile) deconstructAt(G.cursorTile.tx, G.cursorTile.ty);
    } else if (ev.button === 1) {
      if (G.cursorTile) {
        const e = entAt(G.cursorTile.tx, G.cursorTile.ty);
        if (e) openPanel('machine', e);
      }
    }
  });
  window.addEventListener('mouseup', ev => {
    if (ev.button === 2) { G.mouseRightDown = false; G.remoteDeconPress = null; return; }
    if (ev.button !== 0) return;
    G.mouseDown = false;
    poleAnchor = null;
    G.deconstructHeld = false;
    // 远程视图 Shift 框选：取消框选范围内全部拆除标记（设备/树木/峭壁）
    if (G.remoteUnmark) {
      G.remoteUnmark = false;
      G.blueSelecting = false;
      if (G.blueStart && G.blueEnd && typeof unmarkAreaForDecon === 'function') {
        const r = {
          x0: Math.min(G.blueStart.tx, G.blueEnd.tx), y0: Math.min(G.blueStart.ty, G.blueEnd.ty),
          x1: Math.max(G.blueStart.tx, G.blueEnd.tx), y1: Math.max(G.blueStart.ty, G.blueEnd.ty)
        };
        const n = unmarkAreaForDecon(r);
        if (typeof toast === 'function') toast(n > 0 ? ('已取消 ' + n + ' 个拆除标记') : '框选区域内没有拆除标记');
        uiDirty = true;
      }
      G.blueStart = null; G.blueEnd = null;
      return;
    }
    // 蓝图/红图：松开鼠标完成框选
    if (G.blueSelecting) {
      G.blueSelecting = false;
      const unmark = G.blueUnmark;
      G.blueUnmark = false;
      if (!G.blueStart || !G.blueEnd) { cancelBlueprint(); return; }
      if (G.blueMode === 'blue') captureBlueprint();
      else if (G.blueMode === 'bluecreate') captureBlueprintAsItem();
      else if (G.blueMode === 'cut') quickCopyBlueprint(true);
      else if (G.blueMode === 'red') (unmark ? applyUnmarkRedBlueprint() : applyRedBlueprint());
      else if (G.blueMode === 'green') applyGreenBlueprint();
    }
  });

  G.canvas.addEventListener('contextmenu', ev => ev.preventDefault());
  G.canvas.addEventListener('wheel', ev => {
    ev.preventDefault();
    // 鼠标滚轮直接放大/缩小画面视野（默认交互，不切换快捷栏选择图标）。
    // 远程视图下允许缩小到更远的距离（下限更低，可全景览图），正常视角保持原样。
    G.cam.z *= ev.deltaY < 0 ? 1.12 : 0.89;
    G.cam.z = (typeof remoteClampZoom === 'function') ? remoteClampZoom(G.cam.z) : Math.max(0.3, Math.min(2.2, G.cam.z));
  }, { passive: false });

  window.addEventListener('resize', resize);
  document.getElementById('game').addEventListener('click', ev => {
    if (ev.button !== 0 || ev.shiftKey || ev.ctrlKey) return;   // Ctrl+左键为快速转移（见 mousedown），不打开面板
    if (G.blueMode) return;   // 蓝图/红图模式下不触发面板
    if (G.remoteView) {
      // 远程视图：点击设备打开其面板（远程查看/操作）；点击其他区域不打开面板，仅用于视角/放虚影，
      // 遥控器（蜘蛛/炮兵/放电）等物品的远程指令仍由 mousedown 的 handleLeftDown 处理，此处不重复触发。
      updateCursorTile(ev.clientX, ev.clientY);
      if (G.cursorTile) {
        const re = entAt(G.cursorTile.tx, G.cursorTile.ty);
        if (re && !re._dead && re.type && typeof DEVICE_PANEL !== 'undefined' && DEVICE_PANEL[re.type]) {
          openPanel('machine', re);
          uiDirty = true;
        }
      }
      return;
    }
    updateCursorTile(ev.clientX, ev.clientY);
    if (!G.cursorTile) return;
    // 持握来自箱子/设备的物品时点击地图：点可交互设备 → 打开其面板以便放入；点空地 → 取消放回原处。
    // （背包拿起的物品 src=inv 走下方正常建造/交互流程）
    if (G.held && G.held.src && G.held.src.kind !== 'inv') {
      const he = entAt(G.cursorTile.tx, G.cursorTile.ty);
      if (he && typeof DEVICE_PANEL !== 'undefined' && DEVICE_PANEL[he.type]) { openPanel('machine', he); return; }
      if (typeof heldReturn === 'function') heldReturn();
      uiDirty = true;
      if (typeof toast === 'function') toast('已取消持握，物品放回原处');
      return;
    }
    // 手持修理包点击受损建筑 → 修复（优先于打开面板）
    if (hasRepairPackSelected() && withinReach(G.cursorTile.tx, G.cursorTile.ty)) {
      const e = entAt(G.cursorTile.tx, G.cursorTile.ty);
      if (e && isDamaged(e)) { repairActionAt(G.cursorTile.tx, G.cursorTile.ty); return; }
    }
    // 手持蜘蛛遥控器点击地面 → 命令蜘蛛机器人移动
    if (typeof selItem === 'function' && selItem() === 'spidertron-remote') { commandSpidertron(G.cursorTile.tx, G.cursorTile.ty); return; }
    // 手持重炮瞄准遥控器点击地图 → 手动炮兵瞄准（对齐《异星工厂》Artillery targeting remote）
    if (typeof selItem === 'function' && selItem() === 'artillery-targeting-remote') { fireArtilleryShellAt(G.cursorTile.tx, G.cursorTile.ty); return; }
    // 手持放电防御遥控器点击地图 → 远程触发放电防御（对齐《异星工厂》Discharge defense remote）
    if (typeof selItem === 'function' && selItem() === 'discharge-defense-remote') { if (typeof activateDischargeDefense === 'function') activateDischargeDefense(); return; }
    // 手持峭壁炸药点击峭壁 → 炸毁清除（对齐《异星工厂》Cliff explosives）
    if (hasCliffBlastSelected() && isCliff(G.cursorTile.tx, G.cursorTile.ty)) { cliffBlastAt(G.cursorTile.tx, G.cursorTile.ty); return; }
    // 手持红/绿电路线缆点击电路设备 → 切换其接入通道（对齐《异星工厂》Red/Green wire）
    if (typeof wireToolSelected === 'function' && wireToolSelected() && withinReach(G.cursorTile.tx, G.cursorTile.ty)) {
      const we = entAt(G.cursorTile.tx, G.cursorTile.ty);
      if (we && applyWireToNode(we, wireToolSelected())) { toast((we.wireChan === 'both' ? '已恢复双通道接入' : '仅接入' + (we.wireChan === 'red' ? '红线' : '绿线') + '网络') + '（' + ITEMS[we.type].name + '）'); return; }
    }
    // 鼠标选中了物品时点击地图上的设备：也应展开设备面板（对齐《异星工厂》，
    // 手持物品点击可交互设备仍打开其界面，而非被选中物品的建造/幽灵流程拦截）。
    if (buildActive()) {
      const bse = entAt(G.cursorTile.tx, G.cursorTile.ty);
      // 排除「放置物品」场景：刚通过 this 次点击放置下的实体（=本次 mousedown 新建、非点击已有设备）
      // 不会把它自己当作可交互设备打开面板；只有点击已放置的设备才展开面板。
      if (bse && bse !== G._lastPlacedEnt && typeof DEVICE_PANEL !== 'undefined' && DEVICE_PANEL[bse.type]) { openPanel('machine', bse); return; }
    }
    if (buildActive()) return;
    const e = entAt(G.cursorTile.tx, G.cursorTile.ty);
    if (e) openPanel('machine', e);
    // 点击敌人 → 显示该敌人的简单介绍（对齐《异星工厂》：可查看敌对单位图鉴信息）
    else {
      const en = (typeof enemyAtTile === 'function') ? enemyAtTile(G.cursorTile.tx, G.cursorTile.ty) : null;
      if (en) {
        const d = ENEMY_TYPES[en.type];
        const nm = d ? d.name : (en.kind === 'spawner' ? '虫巢' : '敌人');
        toast(nm + '：' + ((typeof enemyDesc === 'function') ? enemyDesc(en) : '敌对单位'));
      }
    }
  });
}

function handleLeftDown() {
  // 持握来自箱子/设备的物品时按住左键不触发建造/采集；背包拿起的物品(src inv)仍可建造
  if (G.held && G.held.src && G.held.src.kind !== 'inv') return;
  // 手持蜘蛛遥控器点击地面 → 命令蜘蛛机器人移动到目标点（对齐《异星工厂》Spidertron remote）
  if (typeof selItem === 'function' && selItem() === 'spidertron-remote' && G.cursorTile) {
    commandSpidertron(G.cursorTile.tx, G.cursorTile.ty);
    return;
  }
  // 手持重炮瞄准遥控器点击地图 → 手动炮兵瞄准
  if (typeof selItem === 'function' && selItem() === 'artillery-targeting-remote' && G.cursorTile) {
    fireArtilleryShellAt(G.cursorTile.tx, G.cursorTile.ty);
    return;
  }
  // 手持放电防御遥控器点击地图 → 远程触发放电防御
  if (typeof selItem === 'function' && selItem() === 'discharge-defense-remote' && G.cursorTile) {
    if (typeof activateDischargeDefense === 'function') activateDischargeDefense();
    return;
  }
  // 手持修理包点击受损建筑 → 修复（对齐《异星工厂》：左键维修）
  if (hasRepairPackSelected() && G.cursorTile && withinReach(G.cursorTile.tx, G.cursorTile.ty)) {
    const e = entAt(G.cursorTile.tx, G.cursorTile.ty);
    if (e && isDamaged(e)) { repairActionAt(G.cursorTile.tx, G.cursorTile.ty); return; }
  }
  // 手持峭壁炸药点击峭壁 → 炸毁清除（对齐《异星工厂》Cliff explosives）
  if (hasCliffBlastSelected() && G.cursorTile && isCliff(G.cursorTile.tx, G.cursorTile.ty)) {
    cliffBlastAt(G.cursorTile.tx, G.cursorTile.ty);
    return;
  }
  // 手持红/绿电路线缆点击电路设备 → 切换其接入通道（对齐《异星工厂》Red/Green wire）
  if (G.cursorTile && typeof wireToolSelected === 'function' && wireToolSelected() && withinReach(G.cursorTile.tx, G.cursorTile.ty)) {
    const we = entAt(G.cursorTile.tx, G.cursorTile.ty);
    if (we && applyWireToNode(we, wireToolSelected())) { toast((we.wireChan === 'both' ? '已恢复双通道接入' : '仅接入' + (we.wireChan === 'red' ? '红线' : '绿线') + '网络') + '（' + ITEMS[we.type].name + '）'); return; }
  }
  if (buildActive() && G.cursorTile) {
    tryPlaceAt(G.cursorTile.tx, G.cursorTile.ty);
    lastPlaceKey = G.cursorTile.tx + ',' + G.cursorTile.ty;
    // 电线杆：记录本次按下放置的杆位作为拖建锚点，拖动时按最远连线距离间隔铺设
    const _raw = (typeof selItem === 'function') ? selItem() : null;
    const _base = (typeof splitQuality === 'function' && _raw) ? splitQuality(_raw).base : _raw;
    poleAnchor = (GAME_DATA && GAME_DATA.pole && _base && GAME_DATA.pole[_base])
      ? { tx: G.cursorTile.tx, ty: G.cursorTile.ty }
      : null;
  } else if (G.cursorTile && typeof tryFishAt === 'function' && isWater(G.cursorTile.tx, G.cursorTile.ty)) {
    // 点击水域 → 钓鱼（对齐《异星工厂》钓鱼玩法）
    tryFishAt(G.cursorTile.tx, G.cursorTile.ty);
  }
}

// 触发全屏强光闪光（原子弹核爆等大爆炸用）：叠加白光，数值越大越亮
function addScreenFlash(v) {
  G.screenFlash = Math.max(G.screenFlash || 0, v);
}

// ===== 蜘蛛遥控器（对齐《异星工厂》Spidertron remote）=====
// 手持遥控器点击地图：命令最近的蜘蛛机器人（优先当前驾驶的）自主移动到目标点。
// 若当前在驾驶蜘蛛机器人，则退出驾驶，交由自主移动接管。
function commandSpidertron(tx, ty) {
  const px = G.player.x, py = G.player.y;
  let best = null, bestD = Infinity;
  for (const e of G.ents) {
    if (e._dead || e.type !== 'spidertron') continue;
    const d = Math.hypot((e.x + e.w / 2) * TILE - px, (e.y + e.h / 2) * TILE - py);
    if (d < bestD) { best = e; bestD = d; }
  }
  if (!best) {
    if (typeof toast === 'function') toast('未找到蜘蛛机器人，请先建造蜘蛛机器人');
    return;
  }
  // 若正驾驶的是该蜘蛛，则退出驾驶
  if (G.driving && G.driving.ent === best && typeof exitCar === 'function') exitCar();
  best.remoteTarget = { x: tx, y: ty };
  if (typeof toast === 'function') toast('蜘蛛机器人正在前往目标点…');
  if (typeof playSfx === 'function') playSfx('click');
  uiDirty = true;
}

function updateCursorTile(cx, cy) {
  // 放置幽灵的光标定位：以鼠标为「整个物品的中心区域」，而非物品左上角所在格。
  // 选中的是多格建筑（如锅炉 2×3）时，按其当前朝向的占地尺寸（旋转后宽高互换）
  // 将中心锚定到鼠标位置，再反推左上角格子；1×1 物品与原行为一致。
  let ox = 0, oy = 0;
  const st = (typeof selItem === 'function') ? selItem() : null;
  const bdef = (st && typeof BUILD_DEFS !== 'undefined') ? BUILD_DEFS[st] : null;
  if (bdef) {
    let ew = bdef.w, eh = bdef.h;
    if (bdef.rotSwap && (G.ghostDir % 2 === 1)) { ew = bdef.h; eh = bdef.w; }
    ox = (ew - 1) / 2;
    oy = (eh - 1) / 2;
  }
  // 蓝图粘贴：以「变换后蓝图包围盒的中心」为锚点（对齐《异星工厂》），
  // 使蓝图中间对准鼠标，而非蓝图左上角贴着鼠标格。
  if (G.blueMode === 'paste' && G.blueprint) {
    const tbb = (typeof blueprintBounds === 'function')
      ? blueprintBounds((typeof applyBlueprintTransform === 'function') ? applyBlueprintTransform().ents : G.blueprint.ents)
      : null;
    if (tbb) {
      ox = (tbb.W - 1) / 2;
      oy = (tbb.H - 1) / 2;
    }
  }
  const [wx, wy] = screenToWorld(cx, cy);
  const tx = Math.floor(wx / TILE - ox), ty = Math.floor(wy / TILE - oy);
  G.cursorTile = { tx, ty };
  // 记录最近一次鼠标屏幕坐标，供放置幽灵逻辑判断鼠标是否位于地图画布上
  G.mouseScreen = { x: cx, y: cy };
}

function updateHeldMouse(dt) {
  if (G.held && G.held.src && G.held.src.kind !== 'inv') return;   // 持握箱子/设备物品时不连续采集/建造
  // 远程视图右键长按标记拆除：按住目标超过阈值才登记一次拆除标记；
  // 长按期间鼠标离开按下格（移开/拖动）则取消，避免误触与误框选。
  if (G.remoteDeconPress) {
    const p = G.remoteDeconPress;
    if (G.cursorTile && (Math.abs(G.cursorTile.tx - p.tx) + Math.abs(G.cursorTile.ty - p.ty) > 2)) {
      G.remoteDeconPress = null;
    } else {
      p.t += dt;
      if (p.t >= REMOTE_DECON_HOLD) {
        G.remoteDeconPress = null;
        if (typeof markRemoteDeconAt === 'function') markRemoteDeconAt(p.tx, p.ty);
      }
    }
    return;
  }
  // 拆除模式：按住左键拖动可连续拆除目标格上的建筑
  if (G.deconstructHeld && G.cursorTile) {
    if (G.blueMode) { G.deconstructHeld = false; return; }
    deconstructAt(G.cursorTile.tx, G.cursorTile.ty);
    return;
  }
  if (!G.mouseDown || !G.cursorTile) return;
  if (buildActive()) {
    const _raw = (typeof selItem === 'function') ? selItem() : null;
    const _bsel = (typeof splitQuality === 'function' && _raw) ? splitQuality(_raw).base : _raw;
    // 电线杆拖建：不是逐格铺设，而是按最远连线距离为间隔落杆。
    // 从上一根杆向鼠标方向，先按间隔填充中间杆，最后一根落到鼠标所在格，
    // 相邻杆间隔取 floor(连线距离)（电网按切比雪夫距离判连，整数间隔必然接上线）。
    if (_bsel && GAME_DATA && GAME_DATA.pole && GAME_DATA.pole[_bsel] && poleAnchor) {
      const reach = GAME_DATA.pole[_bsel].wire;
      const S = Math.max(1, Math.floor(reach));
      const dx = G.cursorTile.tx - poleAnchor.tx;
      const dy = G.cursorTile.ty - poleAnchor.ty;
      const total = Math.hypot(dx, dy);
      if (total < S) return;   // 尚未拖出上一根杆的连线距离，不落新杆
      const placed = new Set();
      const putPole = (px, py) => {
        const k = px + ',' + py;
        if (placed.has(k)) return;   // 同一批内已尝试过的格不重复放置
        placed.add(k);
        tryPlaceAt(px, py);
      };
      const n = Math.floor(total / S);
      for (let i = 1; i <= n; i++) {
        const t = (i * S) / total;
        putPole(Math.round(poleAnchor.tx + dx * t), Math.round(poleAnchor.ty + dy * t));
      }
      putPole(G.cursorTile.tx, G.cursorTile.ty);
      poleAnchor = { tx: G.cursorTile.tx, ty: G.cursorTile.ty };
      return;
    }
    const key = G.cursorTile.tx + ',' + G.cursorTile.ty;
    if (key !== lastPlaceKey) {
      tryPlaceAt(G.cursorTile.tx, G.cursorTile.ty);
      lastPlaceKey = key;
    }
  } else {
    updateMining(dt);
  }
}

// ============ 固定步长（decoupled fixed-timestep）更新循环 ============
// UPS（世界更新次数/秒）与 FPS（渲染帧率/秒）解耦：
// 世界逻辑以固定步长 TICK 推进（默认 60 次/秒），与渲染帧率无关；
// 渲染仍由 requestAnimationFrame 驱动，帧率跟随显示器刷新率。
// UPS 显示值为实测：最近 1 秒内实际执行的世界更新步数，
// 跟随 timeScale 加速，且受 MAX_TICK_STEPS 与渲染帧率共同封顶。
// 采用经典 accumulator 累积器模式，避免螺旋式死亡并平滑渲染与更新之间的差异。
const TICK_RATE = 60;              // 目标 UPS：每秒世界更新次数
const TICK = 1 / TICK_RATE;        // 单个逻辑步长（秒）
const MAX_TICK_STEPS = 5;          // 单帧最多补跑的更新次数（防止卡顿后追帧导致螺旋式死亡）
// 实测 UPS 显示的窗口与平滑系数：窗口越短、系数越大 → 上升响应越快。
// 窗口过短会因高刷新率下部分空帧（0 步）抖动；此处 0.5s + 0.25 约 1 秒内稳定到位且足够抗噪。
const UPS_WINDOW = 0.5;            // UPS 统计窗口（秒）
const UPS_SMOOTH = 0.25;           // UPS 平滑系数（越大跟踪越快）

// 世界逻辑累积器与上一帧时间（挂在 loop 上便于保存状态）
loop.acc = 0;
loop.lastT = 0;
// 实测 UPS 统计：最近真实 1 秒窗口内实际执行过的世界更新步数（跟随 timeScale 且受 MAX_TICK_STEPS/FPS 封顶）
loop.upsSteps = 0;      // 当前窗口内累计的逻辑步数
loop.upsWinT = 0;       // 当前窗口已累计的真实流逝时间

// 单个固定逻辑步：以 dt=TICK 推进一次世界（玩家/设备/电力/物流/战斗/天气等）。
// 与渲染解耦：渲染帧率波动不会影响这里推进的步长。
function stepWorld(dt) {
  // 成就周期性判定（每 3s 覆盖污染等连续增长条件；事件触发点另有即时判定）
  G.achT = (G.achT || 0) + dt;
  if (G.achT >= 3) { G.achT = 0; if (typeof checkAchievements === 'function') checkAchievements(); }
  // 每逻辑步失效信号塔模块加成缓存（P0 优化：同一步内同坐标只查询一次）
  if (typeof clearBeaconBonusCache === 'function') clearBeaconBonusCache();
  updatePlayer(dt);
  // 背包中不应出现流体：周期性自动清理（正常路径已由 invAdd 拦截流体进入，此为兜底）
  G.purgeT = (G.purgeT || 0) + dt;
  if (G.purgeT >= 1) { G.purgeT = 0; if (typeof purgeFluidsFromInv === 'function') purgeFluidsFromInv(); }
  updateHeldMouse(dt);
  updateMining(dt);
  if (typeof updateGroundItems === 'function') updateGroundItems(dt);   // 地面物品（手动上料）拾取
  updateCraftQueue(dt);   // 手搓合成队列（按时间逐件制作）
  if (typeof updateFishing === 'function') updateFishing(dt);   // 钓鱼冷却
  if (typeof updatePersonalPower === 'function') updatePersonalPower(dt);   // 个人电网（装备件）
  if (typeof updateDischargeCooldown === 'function') updateDischargeCooldown(dt);   // 放电防御冷却
  // 逻辑帧耗时统计：度量每个逻辑步所有活跃实体 update 的总耗时，写入性能面板。
  // 仅在开启性能页时采样（常态关闭避免额外开销），并按设备类型累计，用于定位卡顿主因。
  // 采样采用“分段法”：只记录同类型连续区间的两个端点耗时，仅类型切换时才调用
  // performance.now()，避免逐实体取证带来的额外开销（同类型设备通常成片建造、便于分段）。
  let _updStart = 0;
  let _tri = null;
  if (G.statsTab === 'perf' && typeof PERF === 'object' && PERF) {
    if (!PERF._tri) PERF._tri = { t0: 0, frames: 0, updateMs: 0, type: {} };
    _tri = PERF._tri;
    if (!_tri.t0) _tri.t0 = performance.now();
    _tri.frames++;
    _updStart = performance.now();
  }
  // 分段区间状态：lastType=上一段类型，segStart=上一段开始时刻
  let _lastType = null, _segStart = 0;
  const _segFlush = (type, endT) => {
    if (type != null && !isNaN(_segStart)) {
      const dt = endT - _segStart;
      _tri.updateMs += dt;
      _tri.type[type] = (_tri.type[type] || 0) + dt;
    }
  };
  for (const e of G.ents) {
    // 性能优化：跳过继承基类空 update 的静态实体（储物箱/门/石墙/铁轨/火车车厢/信号灯/机器人港/物流箱/信号塔/电灯等），
    // 其逻辑由独立系统（箱子存取/门开合/铁路调度/物流扫描/模块广播等）处理，无需每步调用空函数。
    // 调用基类空 update 与跳过完全等价，故不影响任何功能。
    if (e._dead || typeof e.update !== 'function') continue;
    if (e.update === Entity.prototype.update) continue;
    if (_tri) {
      if (e.type !== _lastType) {
        if (_lastType !== null) _segFlush(_lastType, performance.now());
        _lastType = e.type;
        _segStart = performance.now();
      }
    }
    e.update(dt);
  }
  if (_tri && _lastType !== null) _segFlush(_lastType, performance.now());
  if (_updStart) {
    if (typeof PERF === 'object' && PERF) PERF.updateMs = performance.now() - _updStart;
  }
  // 敌人/子弹系统（可在设置中开关战斗）
  if (G.settings.combat) {
    if (typeof resetSpawnerCache === 'function') resetSpawnerCache();   // 每步失效 spawner 列表缓存（P0 优化）
    spawnEnemies(dt);
    // 性能优化：本步存活敌人列表只计算一次，供子弹命中/战斗机器人/区域力场等复用，
    // 避免每步多处在 combat2.js 里各自 filter 生成全新数组（降低 GC 压力）。
    // 复用数组而非每次 new：先清空再用 for 循环回填，避免每次分配新数组带来的 GC 压力。
    if (!G._aliveEnemies) G._aliveEnemies = [];
    const _ae = G._aliveEnemies;
    _ae.length = 0;
    const _src = G.enemies || EMPTY_ARR;
    for (let i = 0; i < _src.length; i++) if (!_src[i].dead) _ae.push(_src[i]);
    if (typeof updateWaves === 'function') updateWaves(dt);
    if (typeof updatePollution === 'function') updatePollution(dt);   // 污染系统（对齐《异星工厂》)
    updateEnemies(dt);
    updateBullets(dt);
    updatePlayerFire(dt);
    updatePlayerBulletHits(dt);
    updateCombatRobots(dt);
    updateAoeZones(dt);
    if (typeof updateGroundFires === 'function') updateGroundFires(dt);
    if (typeof updateAcidPools === 'function') updateAcidPools(dt);
    if (typeof updatePersonalLaserDefense === 'function') updatePersonalLaserDefense(dt);
    if (typeof updateCarFire === 'function') updateCarFire(dt);   // 车载机枪（对齐《异星工厂》Car）
    if (typeof updateTankFire === 'function') updateTankFire(dt);
    if (typeof updateLootDrops === 'function') updateLootDrops(dt);
  }
  G.powerT += dt;
  if (G.powerT >= 0.25) { G.powerT = 0; updatePower(); }
  // 电路网络重算（固定间隔，红/绿信号聚合）
  G.circuitT = (G.circuitT || 0) + dt;
  if (G.circuitT >= 0.25) { G.circuitT = 0; if (typeof recomputeCircuit === 'function') recomputeCircuit(); }
  updateLogistics(dt);
  if (typeof updateConstruction === 'function') updateConstruction(dt);
  updateTrains(dt);
  if (typeof updateParticles === 'function') updateParticles(dt);
  updateCamera(dt);
  // 全屏闪光衰减（原子弹核爆等触发的强光，随时间减弱）
  if (G.screenFlash > 0) G.screenFlash = Math.max(0, G.screenFlash - dt * 1.6);
  // 天气系统（动态云层 / 阴云，低开销）
  if (typeof updateWeather === 'function') updateWeather(dt);
  // 避雷系统（Fulgora 雷暴期落雷，需避雷科技）
  if (typeof updateLightning === 'function') updateLightning(dt);
  // 环境氛围音（Web Audio 昼夜背景音）
  if (typeof ambientUpdate === 'function') ambientUpdate(dt);
}

function loop(ts) {
  requestAnimationFrame(loop);
  if (G.inMenu) return;   // 开始菜单显示中：不渲染、不更新游戏世界
  const now = ts / 1000;
  const raw = Math.min(0.05, now - (loop.lastT || now));
  loop.lastT = now;
  // FPS：渲染帧率由实际帧间隔平滑得出（跟随显示器刷新率）。
  fpsSmooth += (1 / Math.max(raw, 0.0001) - fpsSmooth) * 0.05;
  if (G.settings.autoSave) {
    G.autoT += raw;
    if (G.autoT >= 60) { G.autoT = 0; autoSaveGame().then(() => toast('自动保存完成')); }
  }

  // 游戏暂停：由顶部“暂停/继续”按钮控制（G.paused）。
  // 打开设置面板不再暂停游戏（仅暂停时世界/设备/电力/玩家停摆）。
  const paused = !!G.paused;
  // 整帧时间分解：仅性能页开启时打点。stepWorld 可能一帧补跑多步，render() 含地形回贴/清屏，
  // 两者都计入毫秒并滚动累加，结算时与真实帧间隔(frameMs)对比，拆出“逻辑/渲染/其它”三段占比，
  // 用于定位那部分“既不在设备 update、也不在 drawEntity”里的大额整帧开销。
  const _perfOn = (G.statsTab === 'perf' && typeof PERF === 'object' && PERF);
  if (_perfOn && !PERF._ftri) PERF._ftri = { t0: performance.now(), swMs: 0, rndMs: 0, frames: 0 };
  let _swMs = 0;
  if (!paused) {
    // 累积器模式：把本帧真实流逝时间（乘时间缩放）累加，按固定步长 TICK 补跑世界更新。
    // 性能模式：单帧补跑上限 5→2，抑制“渲染慢→掉帧→补更多逻辑步→更慢”的追帧螺旋，帧率优先。
    const maxSteps = (G.settings && G.settings.perfMode) ? 2 : MAX_TICK_STEPS;
    loop.acc += raw * ((G.dbg && G.dbg.timeScale) || 1);
    let steps = 0;
    while (loop.acc >= TICK && steps < maxSteps) {
      G.time += TICK;      // 世界时间以固定步长推进
      const _tw0 = _perfOn ? performance.now() : 0;
      stepWorld(TICK);
      if (_perfOn) _swMs += performance.now() - _tw0;
      loop.acc -= TICK;
      steps++;
      loop.upsSteps++;     // 实测：累计一次逻辑步
    }
    // 若累计滞后过多（远超单帧可补跑上限），丢弃多余累积，避免螺旋式死亡。
    if (loop.acc > maxSteps * TICK) loop.acc = 0;
    // 实测 UPS：以真实流逝时间按 0.5 秒短窗口累计步数，平滑回写目标。
    // 窗口越短、系数越大 → 上升响应越快；短窗口可消除高刷新率下空帧（0 步）带来的抖动。
    // （总体跟随 timeScale，且如实反映 MAX_TICK_STEPS 与渲染 FPS 封顶。）
    loop.upsWinT += raw;
    if (loop.upsWinT >= UPS_WINDOW) {
      loop.upsWinT = 0;
      const measured = loop.upsSteps / UPS_WINDOW;   // 每秒等价步数
      upsSmooth += (measured - upsSmooth) * UPS_SMOOTH;
      loop.upsSteps = 0;
    }
  } else {
    loop.acc = 0;
    // 暂停：窗口归零，UPS 平滑回落，反映“未在更新”。
    loop.upsSteps = 0;
    loop.upsWinT = 0;
  }
  // 暂停期间不推进，故将暂停时的回写放到未暂停分支内；这里补充暂停时朝 0 平滑。
  if (paused) upsSmooth += (0 - upsSmooth) * 0.05;

  try {
    // 背景音乐（可独立开关）：暂停游戏时仍持续播放（界面层氛围）
    if (typeof bgmUpdate === 'function') bgmUpdate(TICK);

    const _rw0 = _perfOn ? performance.now() : 0;
    render();
    // 整帧时间分解：累加本帧 render() 与 stepWorld 总耗时（含地形回贴/清屏/多逻辑步），
    // 结算窗口内取平均，与真实帧间隔对比拆出“其它(合成/GC/等待)”段。
    if (_perfOn) { PERF._ftri.rndMs += performance.now() - _rw0; PERF._ftri.swMs += _swMs; PERF._ftri.frames++; }

    // 后台预热背包静态缓存（首次打开背包的卡顿优化）：每帧处理一小片，分摊到多帧执行，
    // 预热完成后自动停止，不影响正常游戏帧率。
    if (typeof stepPrewarm === 'function' && typeof _prewarmQueue !== 'undefined' && _prewarmQueue.length) {
      stepPrewarm();
    }

    if (uiDirty || G.time - lastPanelCheck > 0.25) {
      lastPanelCheck = G.time;
      // 背包 tab HTML 缓存失效：物品/科技等状态一旦变化（uiDirty），清掉缓存的
      // innerHTML，确保下次打开/渲染背包时重新生成，避免显示过期数量或解锁状态。
      if (uiDirty && typeof _invalidateInvCache === 'function') _invalidateInvCache();
      refreshHotbar();
      if (G.panelMode === 'machine') updateMachineLive();
      if (G.panelMode === 'stats') updateStatsLive();
      if (G.panelMode === 'logi') updateLogiNetLive();
      // 背包/科技面板：不做整面板 innerHTML 重建。整面板重建每帧生成上百个 DOM
      // 节点（base64 图标、tooltip 等），打开背包后明显掉帧；且重建会销毁正在聚焦
      // 的输入框，打断中文输入法并清空已输入内容。改用轻量计数刷新（不改 DOM 结构）。
      // 整面板的重建只发生在打开面板或用户在面板内交互时（renderPanel）。
      // 蓝图面板（bluebook）与设备面板（machine）左栏也是玩家背包，物品变化同样需即时刷新
      if ((G.panelMode === 'inv' || G.panelMode === 'bluebook' || G.panelMode === 'machine' || G.panelMode === 'armor') && !isPanelTyping()) updateInvLive();
      else if (G.panelMode === 'tech' && !isPanelTyping()) updateTechLive();
      uiDirty = false;
    }
    updateHUD(TICK, Math.round(fpsSmooth), Math.round(upsSmooth));
  } catch (err) {
    if (!loop.errShown) {
      loop.errShown = true;
      console.error(err);
      toast('发生内部错误：' + err.message + '（控制台可见详情）');
    }
  }
}

function boot() {
  if (G.booted) return;
  G.booted = true;
  const steps = [
    ['ghost', () => { G.ghostCv = document.getElementById('ghost-layer'); G.ghostCtx = G.ghostCv.getContext('2d'); }],
    ['canvas', () => { G.canvas = document.getElementById('game'); G.ctx = G.canvas.getContext('2d'); resize(); }],
    ['settings', () => loadSettings()],
    ['saves', () => migrateLegacySave()],
    ['topbtn', () => initTopButtons()],
    ['panel', () => initPanelEvents()],
    ['quickbar', () => initQuickbar()],
    ['tooltip', () => initTooltips()],
    ['hudinfo', () => initHudInfo()],
    ['tutorial', () => initTutorial()],
    ['debug', () => buildDebug()],
    ['deathmenu', () => initDeathMenu()],
    ['pausemenu', () => initPauseMenu()],
    ['input', () => bindInput()],
    ['remote', () => { if (typeof bindRemoteClose === 'function') bindRemoteClose(); }]
  ];
  for (const [name, fn] of steps) {
    try { fn(); } catch (err) {
      console.error('init[' + name + ']', err);
      toast('初始化[' + name + ']失败：' + err.message);
    }
  }
  // 首次进入游戏即启动背包静态缓存的后台预热，让第一次打开背包不卡
  if (typeof prewarmInvCache === 'function') prewarmInvCache();
  if (!G.rafStarted) { G.rafStarted = true; requestAnimationFrame(loop); }
}
window.addEventListener('load', boot);
if (document.readyState === 'complete') setTimeout(boot, 0);
