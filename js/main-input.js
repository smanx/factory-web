'use strict';

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
    G.keys[k] = true;
    if (k >= '1' && k <= '9') selectSlot(+k - 1);
    else if (k === '0') selectSlot(9);
    else if (k === 'tab') { ev.preventDefault(); G.panelMode === 'inv' ? closePanel() : openPanel('inv'); }
    // 统计/蓝图/红图/绿图快捷键（对齐《异星工厂》：P 统计、B 蓝图、Alt+D 红图、Alt+U 绿图）
    else if (k === 'p') G.panelMode === 'stats' ? closePanel() : openPanel('stats');
    else if (k === 'b') { closePanel(); toggleBlueprint('blue'); }
    else if (ev.altKey && k === 'b') { ev.preventDefault(); if (G.blueMode) cancelBlueprint(); G.panelMode === 'bluebook' ? closePanel() : openPanel('bluebook'); }
    else if (ev.altKey && k === 'd') { ev.preventDefault(); closePanel(); toggleBlueprint('red'); }
    else if (ev.altKey && k === 'u') { ev.preventDefault(); closePanel(); toggleBlueprint('green'); }
    else if ((k === 'delete' || k === 'backspace') && G.panelMode === 'machine' &&
             G.panelEnt && typeof G.panelEnt.setRecipe === 'function' && G.panelEnt.recipe) {
      G.panelEnt.setRecipe(null);
      renderPanel(false);
      toast('配方已清除');
    }
    else if (k === 'r') rotateAction();
    else if (k === 'h') flipAction('h');
    else if (k === 'v') flipAction('v');
    else if (k === 'f') { if (!tryEnterNearbyCar()) pickupAction(); }
    // 全部拾取（对齐《异星工厂》：按住 Z 拾取范围内所有地面物品）
    else if (k === 'z') { if (typeof pickupAllAction === 'function') pickupAllAction(); }
    else if (k === 'e') {
      if (G.driving) { if (typeof exitCar === 'function') exitCar(); }
      else if (G.panelMode === 'inv') closePanel();
      else openPanel('inv');
    }
    else if (k === 't') G.panelMode === 'tech' ? closePanel() : openPanel('tech');
    else if (k === 'o') G.panelMode === 'set' ? closePanel() : openPanel('set');
    else if (k === 'm') { G.settings.minimap = !(G.settings.minimap !== false); toast(G.settings.minimap ? '小地图：开启' : '小地图：关闭'); }
    // 地图标记（对齐《异星工厂》：N 放置地图标记，Alt+N 管理）
    else if (ev.altKey && k === 'n') {
      ev.preventDefault();
      G.panelMode === 'maptags' ? closePanel() : openPanel('maptags');
    }
    else if (k === 'n') { if (typeof placeMapTag === 'function') placeMapTag(); }
    // 操作说明（Alt+H）：随时查看完整快捷键指南
    else if (ev.altKey && k === 'h') { ev.preventDefault(); if (typeof showTutorial === 'function') showTutorial(); }
    // 放电防御装备：C 键激活对周围敌人放电（对齐《异星工厂》Discharge defense）
    else if (k === 'c') { if (typeof activateDischargeDefense === 'function') activateDischargeDefense(); }
    // ALT 模式（对齐《异星工厂》ALT 模式）：按 Alt 键切换建筑配方/内容叠加显示
    else if (k === 'alt') {
      ev.preventDefault();
      G.settings.altMode = !(G.settings.altMode !== false);
      saveSettings();
      toast(G.settings.altMode ? 'ALT 模式：开（显示建筑配方/内容叠加）' : 'ALT 模式：关');
    }
    else if (k === 'escape') {
      // ESC 键：优先关闭当前打开的任何弹框/面板（驾驶界面/蓝图/拆除模式/面板）
      if (G.driving) { if (typeof exitCar === 'function') exitCar(); }
      else if (G.blueMode) {
        cancelBlueprint();
      } else if (G.deconstructMode) {
        toggleDeconstructMode(false);
      } else if (G.panelMode) {
        closePanel();
      }
      // 当前页面没有任何弹框和面板时：打开设置弹框
      else {
        openPanel('set');
      }
    }
    else if (k === 'q') {
      // Q 键：保留原快速取/取消选择逻辑（对齐《异星工厂》Q 取消选择）
      if (G.driving) { if (typeof exitCar === 'function') exitCar(); }
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
        refreshHotbar();
      } else {
        const e = entAt(G.cursorTile.tx, G.cursorTile.ty);
        // 选中建筑：统一用 quickSel（快捷栏无选中效果），鼠标直接显示放置幽灵
        G.sel = -1;
        if (e && BUILD_DEFS[e.type]) {
          G.quickSel = e.type;
          G.ghostDir = e.dir;
          toast('已直接选中 ' + ITEMS[e.type].name + '（Q 取消）');
        }
        uiDirty = true;
        refreshHotbar();
      }
    }
  });
  window.addEventListener('keyup', ev => {
    const k = ev.key.toLowerCase();
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
  // 触屏手势交互：由 js/touch.js 的 touchInit() 统一注册（点按/长按操作盘/拖动平移/攒合缩放等）
  touchInit();
  G.canvas.addEventListener('mouseenter', () => { G.canvasActive = true; });
  G.canvas.addEventListener('mouseleave', () => {
    G.canvasActive = false;
    G.cursorTile = null;
    G.mouseDown = false;
  });
  G.canvas.addEventListener('mousedown', ev => {
    ev.preventDefault();
    updateCursorTile(ev.clientX, ev.clientY);
    // 蓝图/红图交互：左键开始框选或粘贴，右键取消
    if (G.blueMode) {
      if (ev.button === 2) { cancelBlueprint(); return; }
      if (ev.button === 0) {
        if (G.blueMode === 'paste') {
          pasteBlueprint();
          // 粘贴后保持粘贴模式，可继续在别处粘贴（右键或按 Q/Esc 取消）
        } else {
          G.blueStart = { tx: G.cursorTile.tx, ty: G.cursorTile.ty };
          G.blueEnd = { tx: G.cursorTile.tx, ty: G.cursorTile.ty };
          G.blueSelecting = true;
        }
        return;
      }
      return;
    }
    const hovered = G.cursorTile ? entAt(G.cursorTile.tx, G.cursorTile.ty) : null;
    if (ev.button === 0) {
      // Shift+左键“粘贴设置”，与普通左键建造（默认支持覆盖）区分开
      if (ev.shiftKey && !ev.ctrlKey && hovered) { pasteSettings(hovered); return; }
      // 拆除模式：左键（含触屏模拟）用于拆除建筑，而非建造/挖矿
      if (G.deconstructMode) {
        G.deconstructHeld = true;
        if (G.cursorTile) deconstructAt(G.cursorTile.tx, G.cursorTile.ty);
        return;
      }
      G.mouseDown = true;
      lastPlaceKey = '';
      handleLeftDown();
    } else if (ev.button === 2) {
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
    if (ev.button !== 0) return;
    G.mouseDown = false;
    G.deconstructHeld = false;
    // 蓝图/红图：松开鼠标完成框选
    if (G.blueSelecting) {
      G.blueSelecting = false;
      if (!G.blueStart || !G.blueEnd) { cancelBlueprint(); return; }
      if (G.blueMode === 'blue') captureBlueprint();
      else if (G.blueMode === 'red') applyRedBlueprint();
      else if (G.blueMode === 'green') applyGreenBlueprint();
    }
  });

  // ===== 触屏手势已由 js/touch.js 的 touchInit() 统一接管（点按/长按/拖动/攒合/双击） =====

  G.canvas.addEventListener('contextmenu', ev => ev.preventDefault());
  G.canvas.addEventListener('wheel', ev => {
    ev.preventDefault();
    // 鼠标滚轮直接放大/缩小画面视野（默认交互，不切换快捷栏选择图标）。
    G.cam.z *= ev.deltaY < 0 ? 1.12 : 0.89;
    G.cam.z = Math.max(0.5, Math.min(2.2, G.cam.z));
  }, { passive: false });

  window.addEventListener('resize', resize);
  document.getElementById('game').addEventListener('click', ev => {
    if (ev.button !== 0 || ev.shiftKey) return;
    if (G.blueMode) return;   // 蓝图/红图模式下不触发面板
    updateCursorTile(ev.clientX, ev.clientY);
    if (!G.cursorTile) return;
    // 手持修理包点击受损建筑 → 修复（优先于打开面板）
    if (hasRepairPackSelected() && withinReach(G.cursorTile.tx, G.cursorTile.ty)) {
      const e = entAt(G.cursorTile.tx, G.cursorTile.ty);
      if (e && isDamaged(e)) { repairActionAt(G.cursorTile.tx, G.cursorTile.ty); return; }
    }
    // 手持蜘蛛遥控器点击地面 → 命令蜘蛛机器人移动
    if (typeof selItem === 'function' && selItem() === 'spidertron-remote') { commandSpidertron(G.cursorTile.tx, G.cursorTile.ty); return; }
    // 手持峭壁炸药点击峭壁 → 炸毁清除（对齐《异星工厂》Cliff explosives）
    if (hasCliffBlastSelected() && isCliff(G.cursorTile.tx, G.cursorTile.ty)) { cliffBlastAt(G.cursorTile.tx, G.cursorTile.ty); return; }
    // 手持红/绿电路线缆点击电路设备 → 切换其接入通道（对齐《异星工厂》Red/Green wire）
    if (typeof wireToolSelected === 'function' && wireToolSelected() && withinReach(G.cursorTile.tx, G.cursorTile.ty)) {
      const we = entAt(G.cursorTile.tx, G.cursorTile.ty);
      if (we && applyWireToNode(we, wireToolSelected())) { toast((we.wireChan === 'both' ? '已恢复双通道接入' : '仅接入' + (we.wireChan === 'red' ? '红线' : '绿线') + '网络') + '（' + ITEMS[we.type].name + '）'); return; }
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
  // 手持蜘蛛遥控器点击地面 → 命令蜘蛛机器人移动到目标点（对齐《异星工厂》Spidertron remote）
  if (typeof selItem === 'function' && selItem() === 'spidertron-remote' && G.cursorTile) {
    commandSpidertron(G.cursorTile.tx, G.cursorTile.ty);
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
  const [wx, wy] = screenToWorld(cx, cy);
  const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
  G.cursorTile = { tx, ty };
}

function updateHeldMouse(dt) {
  // 拆除模式：按住左键/触屏拖动可连续拆除目标格上的建筑
  if (G.deconstructHeld && G.cursorTile) {
    if (G.blueMode) { G.deconstructHeld = false; return; }
    deconstructAt(G.cursorTile.tx, G.cursorTile.ty);
    return;
  }
  if (!G.mouseDown || !G.cursorTile) return;
  if (buildActive()) {
    const key = G.cursorTile.tx + ',' + G.cursorTile.ty;
    if (key !== lastPlaceKey) {
      tryPlaceAt(G.cursorTile.tx, G.cursorTile.ty);
      lastPlaceKey = key;
    }
  } else {
    updateMining(dt);
  }
}

function loop(ts) {
  requestAnimationFrame(loop);
  if (G.inMenu) return;   // 开始菜单显示中：不渲染、不更新游戏世界
  const now = ts / 1000;
  const raw = Math.min(0.05, now - (loop.lastT || now));
  loop.lastT = now;
  const dt = Math.min(0.3, raw * ((G.dbg && G.dbg.timeScale) || 1));
  // 游戏暂停：由顶部“暂停/继续”按钮控制（G.paused）。
  // 打开设置面板不再暂停游戏（仅暂停时世界/设备/电力/玩家停摆）。
  const paused = !!G.paused;
  if (!paused) G.time += dt;
  // UPS：每秒世界更新次数（暂停时为 0），与 FPS 采用同款指数平滑。
  const upsNow = paused ? 0 : 1 / Math.max(raw, 0.0001);
  upsSmooth += (upsNow - upsSmooth) * 0.05;
  fpsSmooth += (1 / Math.max(raw, 0.0001) - fpsSmooth) * 0.05;
  if (G.settings.autoSave) {
    G.autoT += raw;
    if (G.autoT >= 60) { G.autoT = 0; autoSaveGame().then(() => toast('自动保存完成')); }
  }

  try {
    if (!paused) {
      // 成就周期性判定（每 3s 覆盖污染等连续增长条件；事件触发点另有即时判定）
      G.achT = (G.achT || 0) + dt;
      if (G.achT >= 3) { G.achT = 0; if (typeof checkAchievements === 'function') checkAchievements(); }
      // 每帧失效信号塔模块加成缓存（P0 优化：同一帧内同坐标只查询一次）
      if (typeof clearBeaconBonusCache === 'function') clearBeaconBonusCache();
      updatePlayer(dt);
      updateTouchMove(dt);
      updateHeldMouse(dt);
      updateMining(dt);
      if (typeof updateGroundItems === 'function') updateGroundItems(dt);   // 地面物品（手动上料）拾取
      updateCraftQueue(dt);   // 手搓合成队列（按时间逐件制作）
      if (typeof updateFishing === 'function') updateFishing(dt);   // 钓鱼冷却
      if (typeof updatePersonalPower === 'function') updatePersonalPower(dt);   // 个人电网（装备件）
      if (typeof updateDischargeCooldown === 'function') updateDischargeCooldown(dt);   // 放电防御冷却
      // 逻辑帧耗时统计：度量每帧所有活跃实体 update 的总耗时，写入性能面板（仅开启性能页时采样，避免常态开销）
      let _updStart = 0;
      if (G.statsTab === 'perf') _updStart = performance.now();
      for (const e of G.ents) {
        // 性能优化：跳过继承基类空 update 的静态实体（储物箱/门/石墙/铁轨/火车车厢/信号灯/机器人港/物流箱/信号塔/电灯等），
        // 其逻辑由独立系统（箱子存取/门开合/铁路调度/物流扫描/模块广播等）处理，无需每帧调用空函数。
        // 调用基类空 update 与跳过完全等价，故不影响任何功能。
        if (e._dead || typeof e.update !== 'function') continue;
        if (e.update === Entity.prototype.update) continue;
        e.update(dt);
      }
      if (_updStart) {
        if (typeof PERF === 'object' && PERF) PERF.updateMs = performance.now() - _updStart;
      }
      // 敌人/子弹系统（可在设置中开关战斗）
      if (G.settings.combat) {
        if (typeof resetSpawnerCache === 'function') resetSpawnerCache();   // 每帧失效 spawner 列表缓存（P0 优化）
        spawnEnemies(dt);
        // 性能优化：本帧存活敌人列表只计算一次，供子弹命中/战斗机器人/区域力场等复用，
        // 避免每帧多处在 combat2.js 里各自 filter 生成全新数组（降低 GC 压力）。
        // 复用数组而非每帧 new：先清空再用 for 循环回填，避免每帧分配新数组带来的 GC 压力。
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

    // 背景音乐（可独立开关）：暂停游戏时仍持续播放（界面层氛围）
    if (typeof bgmUpdate === 'function') bgmUpdate(dt);

    render();

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
      // 背包/科技面板：不做整面板 innerHTML 重建。整面板重建每帧生成上百个 DOM
      // 节点（base64 图标、tooltip 等），打开背包后明显掉帧；且重建会销毁正在聚焦
      // 的输入框，打断中文输入法并清空已输入内容。改用轻量计数刷新（不改 DOM 结构）。
      // 整面板的重建只发生在打开面板或用户在面板内交互时（renderPanel）。
      if (G.panelMode === 'inv' && !isPanelTyping()) updateInvLive();
      else if (G.panelMode === 'tech' && !isPanelTyping()) renderPanel(false);
      uiDirty = false;
    }
    updateHUD(dt, Math.round(fpsSmooth), Math.round(upsSmooth));
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
    ['joystick', () => initJoystick()],
    ['tooltip', () => initTooltips()],
    ['hudinfo', () => initHudInfo()],
    ['tutorial', () => initTutorial()],
    ['debug', () => buildDebug()],
    ['deathmenu', () => initDeathMenu()],
    ['input', () => bindInput()]
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
