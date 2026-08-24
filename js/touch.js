'use strict';

// ============================================================================
// 全新触屏交互系统（js/touch.js）
// ----------------------------------------------------------------------------
// 设计目标：告别"模式切换"，用直觉手势完成一切操作。
//
//   · 点按(Tap)          —— 智能上下文动作（放置/打开面板/移动/采集）
//   · 长按(Long-press)   —— 弹出通用"操作盘"径向菜单（旋转/拆除/复制/拿起/打开）
//   · 拖动(Drag)         —— 空闲时平移相机；选中物品时沿途铺设（拖动建带）
//   · 双指捏合(Pinch)    —— 缩放视野（取代滚轮）
//   · 双击(Double-tap)   —— 旋转建筑 / 旋转放置朝向
//   · 双指双击           —— 相机回中到玩家
//   · 按住矿石           —— 连续采集
//   · 点击移动           —— 无选中物品点空地，玩家走过去
//
// 冲突仲裁优先级（在 idle 状态才启用相机平移/移动等手势）：
//   蓝图/红图/绿图模式 > 拆除模式 > 选中建造 > 空闲（平移/移动/缩放/操作盘）
// ============================================================================

const TOUCH = {
  pointers: new Map(),     // identifier -> { x, y }
  mode: 'idle',            // idle | pending | panning | pinching | mining
  start: null,             // { x, y, t, tx, ty }
  last: { x: 0, y: 0 },
  longTimer: null,
  longFired: false,
  pinch: { dist: 0, zoom: 1 },
  tap: { count: 0, lastTime: 0, x: 0, y: 0 },
  miningKey: null
};

// 手势判定阈值
const T_TAP_MOVE = 14;      // 点按允许的最大位移（px）
const T_LONG_MS = 480;      // 长按判定时间
const T_DBL_MS = 340;       // 双击时间窗

// 长按操作盘按钮配置：type -> 动作列表
// 每个动作 { key, icon, label, color, enabled(entity) }
function touchActionsForEnt(e) {
  if (!e || !BUILD_DEFS[e.type]) return null;
  const actions = [];
  // 打开面板：所有建筑都支持
  actions.push({ key: 'open', icon: '▤', label: '打开', color: '#4aa3df', always: true,
    run: () => openPanel('machine', e) });
  // 拿起物品：有 takeItem 的实体（带子/容器等）
  if (typeof e.takeItem === 'function') {
    actions.push({ key: 'take', icon: '✋', label: '拿起', color: '#e0b94a',
      run: () => pickupEnt(e) });
  }
  // 旋转 / 翻转：有朝向的设备
  if (DEVICE_DIR_ROTATE[e.type] || BUILD_DEFS[e.type].rotSwap) {
    actions.push({ key: 'rotate', icon: '⟳', label: '旋转', color: '#57e389',
      run: () => rotateEnt(e) });
  }
  // 复制配置
  actions.push({ key: 'copy', icon: '⧉', label: '复制', color: '#9b8fe0',
    run: () => copySettings(e) });
  // 拆除
  actions.push({ key: 'deconstruct', icon: '✖', label: '拆除', color: '#ff5b5b',
    run: () => { for (const [iid, n] of e.contents()) invAdd(iid, n); removeEnt(e); if (G.panelEnt === e) closePanel(); uiDirty = true; toast('已拆除 ' + ITEMS[e.type].name); } });
  return actions;
}

// 拿起建筑内的物品（复用 pickupAction 逻辑）
function pickupEnt(e) {
  const got = e.takeItem();
  if (!got) { toast('这里没有可拿起的物品'); return; }
  invAdd(got);
  uiDirty = true;
}

// 旋转指定建筑
function rotateEnt(e) {
  const def = BUILD_DEFS[e.type];
  if (!def) return;
  if (def.rotSwap) {
    const nd = (e.dir + 1) % 4;
    if (e.type === 'offshore-pump' && !pumpCanFace(e, nd)) { toast('抽水机无法朝该方向旋转：必须仍压在水面上'); return; }
    removeEnt(e);
    e.dir = nd;
    e.applyDir();
    addEnt(e);
  } else if (DEVICE_DIR_ROTATE[e.type]) {
    e.dir = (e.dir + 1) % 4;
    invalidateBeltInputNear(e.x, e.y, e.w, e.h);
    if (typeof e.onRotate === 'function') e.onRotate();
  } else {
    return;
  }
  if (G.panelEnt === e) renderPanel(false);
  uiDirty = true;
}

// ============================================================================
// 长按操作盘（径向菜单）
// ============================================================================
function showActionWheel(tx, ty, actions) {
  hideActionWheel();
  const wheel = document.createElement('div');
  wheel.id = 'action-wheel';
  wheel.dataset.wheel = '1';
  // 记录打开时的世界坐标，用于判断手指是否仍在原建筑上
  G.wheel = { tx, ty, actions };
  // 换算屏幕坐标定位圆心
  const [sx, sy] = worldToScreen(tx * TILE + TILE / 2, ty * TILE + TILE / 2);
  wheel.style.left = sx + 'px';
  wheel.style.top = sy + 'px';
  const n = actions.length;
  actions.forEach((a, i) => {
    const ang = -Math.PI / 2 + (i / Math.max(1, n)) * Math.PI * 2;
    const rx = Math.cos(ang) * 62;
    const ry = Math.sin(ang) * 62;
    const b = document.createElement('button');
    b.className = 'aw-btn';
    b.style.borderColor = a.color;
    b.innerHTML = '<span class="aw-ic" style="color:' + a.color + '">' + a.icon + '</span><span class="aw-lb">' + a.label + '</span>';
    b.style.transform = 'translate(' + rx + 'px,' + ry + 'px)';
    b.style.touchAction = 'none';
    // 触屏：touchend 直接触发；桌面：click 触发。用防抖标志避免 double-fire。
    let fired = false;
    const trigger = () => {
      if (fired) return; fired = true;
      try { a.run(); } catch (err) { toast('操作失败：' + err.message); }
      hideActionWheel();
    };
    b.addEventListener('touchend', ev => { ev.preventDefault(); ev.stopPropagation(); trigger(); });
    b.addEventListener('click', ev => { ev.stopPropagation(); trigger(); });
    wheel.appendChild(b);
  });
  // 中心显示当前建筑图标
  const center = document.createElement('div');
  center.className = 'aw-center';
  const ic = iconCanvas(typeIdOf(tx, ty));
  center.appendChild(ic);
  wheel.appendChild(center);
  document.body.appendChild(wheel);
}

// 获取某瓦片上的建筑类型 id（用于操作盘中心图标）
function typeIdOf(tx, ty) {
  const e = entAt(tx, ty);
  return e && BUILD_DEFS[e.type] ? e.type : null;
}

function hideActionWheel() {
  const w = document.getElementById('action-wheel');
  if (w) w.remove();
  G.wheel = null;
}

function worldToScreen(wx, wy) {
  return [(wx - G.cam.px) * G.cam.z + W / 2, (wy - G.cam.py) * G.cam.z + H / 2];
}

// ============================================================================
// 手势引擎
// ============================================================================
function touchInit() {
  const cv = G.canvas;
  cv.addEventListener('touchstart', onTouchStart, { passive: false });
  cv.addEventListener('touchmove', onTouchMove, { passive: false });
  cv.addEventListener('touchend', onTouchEnd, { passive: false });
  cv.addEventListener('touchcancel', onTouchCancel, { passive: false });
}

function pointerList(ev) {
  return Array.from(ev.touches).map(t => ({ id: t.identifier, x: t.clientX, y: t.clientY }));
}

function onTouchStart(ev) {
  ev.preventDefault();
  // 操作盘已打开时，点触其他地方关闭它
  if (G.wheel) { hideActionWheel(); }
  G.canvasActive = true;
  const pts = pointerList(ev);
  // 记录所有触点
  for (const p of pts) TOUCH.pointers.set(p.id, p);

  // 双指 → 捏合缩放
  if (pts.length === 2) {
    cancelPending();
    TOUCH.mode = 'pinching';
    const [a, b] = pts;
    TOUCH.pinch.dist = Math.hypot(a.x - b.x, a.y - b.y);
    TOUCH.pinch.zoom = G.cam.z;
    return;
  }

  // 单指
  if (pts.length === 1) {
    const p = pts[0];
    updateCursorTile(p.x, p.y);
    TOUCH.start = { x: p.x, y: p.y, t: performance.now(), tx: G.cursorTile.tx, ty: G.cursorTile.ty };
    TOUCH.last = { x: p.x, y: p.y };
    TOUCH.longFired = false;
    TOUCH.mode = 'pending';

    // 拆除模式：直接点触拆除（保持原逻辑）
    if (G.deconstructMode) {
      TOUCH.mode = 'deconstruct';
      if (G.cursorTile) deconstructAt(G.cursorTile.tx, G.cursorTile.ty);
      return;
    }

    // 蓝图模式：沿用拖拽框选 / 粘贴
    if (G.blueMode) {
      TOUCH.mode = 'blueprint';
      if (G.blueMode === 'paste') {
        pasteBlueprint();
        TOUCH.mode = 'idle';
        return;
      } else {
        G.blueStart = { tx: G.cursorTile.tx, ty: G.cursorTile.ty };
        G.blueEnd = { tx: G.cursorTile.tx, ty: G.cursorTile.ty };
        G.blueSelecting = true;
        return;
      }
    }

    // 记录长按/按住采集定时器
    clearTimeout(TOUCH.longTimer);
    const s = TOUCH.start;
    TOUCH.longTimer = setTimeout(() => {
      if (TOUCH.mode !== 'pending') return;
      const e = entAt(s.tx, s.ty);
      // 长按建筑 → 操作盘
      if (e && BUILD_DEFS[e.type] && withinReach(s.tx, s.ty)) {
        const acts = touchActionsForEnt(e);
        if (acts) {
          TOUCH.longFired = true;
          TOUCH.mode = 'longpress';
          showActionWheel(s.tx, s.ty, acts);
          return;
        }
      }
      // 长按矿石 → 连续采集
      const ti = getOreType(s.tx, s.ty);
      if (ti >= 0 && ti < ORES.length && getOreAmt(s.tx, s.ty) > 0 && withinReach(s.tx, s.ty)) {
        TOUCH.mode = 'mining';
        TOUCH.miningKey = s.tx + ',' + s.ty;
        G.mouseDown = true;
      }
    }, T_LONG_MS);
  }
}

function onTouchMove(ev) {
  ev.preventDefault();
  const pts = pointerList(ev);
  // 更新触点位置
  const nextPointers = new Map();
  for (const p of pts) nextPointers.set(p.id, p);
  TOUCH.pointers = nextPointers;

  // 捏合缩放
  if (TOUCH.mode === 'pinching' && pts.length === 2) {
    const [a, b] = pts;
    const d = Math.hypot(a.x - b.x, a.y - b.y);
    if (TOUCH.pinch.dist > 0) {
      G.cam.z = Math.max(0.5, Math.min(2.2, TOUCH.pinch.zoom * (d / TOUCH.pinch.dist)));
    }
    return;
  }

  // 拆除模式拖动连续拆除
  if (TOUCH.mode === 'deconstruct' && pts.length === 1) {
    const p = pts[0];
    updateCursorTile(p.x, p.y);
    if (G.cursorTile) deconstructAt(G.cursorTile.tx, G.cursorTile.ty);
    return;
  }

  // 蓝图框选拖动
  if (TOUCH.mode === 'blueprint' && pts.length === 1) {
    const p = pts[0];
    updateCursorTile(p.x, p.y);
    if (G.blueSelecting && G.cursorTile) {
      G.blueEnd = { tx: G.cursorTile.tx, ty: G.cursorTile.ty };
    }
    return;
  }

  // 采集模式：跟随手指切换到新矿石/持续采集
  if (TOUCH.mode === 'mining' && pts.length === 1) {
    const p = pts[0];
    updateCursorTile(p.x, p.y);
    const key = G.cursorTile.tx + ',' + G.cursorTile.ty;
    if (key !== TOUCH.miningKey) {
      const ti = getOreType(G.cursorTile.tx, G.cursorTile.ty);
      if (ti >= 0 && getOreAmt(G.cursorTile.tx, G.cursorTile.ty) > 0) {
        TOUCH.miningKey = key;
        G.player.mining = key; G.player.mineProg = 0;
      } else {
        TOUCH.miningKey = null;
      }
    }
    return;
  }

  // 单指：判断拖动意图
  if (TOUCH.mode === 'pending' && pts.length === 1) {
    const p = pts[0];
    const dx = p.x - TOUCH.start.x;
    const dy = p.y - TOUCH.start.y;
    const dist = Math.hypot(dx, dy);
    if (dist < T_TAP_MOVE) {
      TOUCH.last = { x: p.x, y: p.y };
      return;
    }
    // 超过阈值 → 判定为拖动
    clearTimeout(TOUCH.longTimer);
    TOUCH.longFired = false;
    // 选中建造 → 拖动沿途铺设
    if (buildActive()) {
      TOUCH.mode = 'build-drag';
      updateCursorTile(p.x, p.y);
      if (G.cursorTile) {
        tryPlaceAt(G.cursorTile.tx, G.cursorTile.ty);
        lastPlaceKey = G.cursorTile.tx + ',' + G.cursorTile.ty;
      }
      return;
    }
    // 否则 → 相机平移
    TOUCH.mode = 'panning';
    TOUCH.last = { x: p.x, y: p.y };
    return;
  }

  // 建造拖动：沿途铺设
  if (TOUCH.mode === 'build-drag' && pts.length === 1) {
    const p = pts[0];
    updateCursorTile(p.x, p.y);
    if (G.cursorTile) {
      const key = G.cursorTile.tx + ',' + G.cursorTile.ty;
      if (key !== lastPlaceKey) {
        tryPlaceAt(G.cursorTile.tx, G.cursorTile.ty);
        lastPlaceKey = key;
      }
    }
    return;
  }

  // 相机平移
  if (TOUCH.mode === 'panning' && pts.length === 1) {
    const p = pts[0];
    const dx = p.x - TOUCH.last.x;
    const dy = p.y - TOUCH.last.y;
    // 平移相机（世界坐标反向移动）
    panCamera(-dx / G.cam.z, -dy / G.cam.z);
    TOUCH.last = { x: p.x, y: p.y };
  }
}

function onTouchEnd(ev) {
  ev.preventDefault();
  const changed = Array.from(ev.changedTouches);
  const wasPinch = TOUCH.mode === 'pinching';

  // 从触点集合移除结束的手指
  for (const t of changed) TOUCH.pointers.delete(t.identifier);
  const remaining = Array.from(TOUCH.pointers.values());

  // 捏合结束：只剩单指时回到 pending，等待后续
  if (wasPinch) {
    if (remaining.length === 0) {
      TOUCH.mode = 'idle';
    } else if (remaining.length === 1) {
      const r = remaining[0];
      TOUCH.start = { x: r.x, y: r.y, t: performance.now(), tx: G.cursorTile ? G.cursorTile.tx : 0, ty: G.cursorTile ? G.cursorTile.ty : 0 };
      TOUCH.last = { x: r.x, y: r.y };
      TOUCH.mode = 'pending';
    }
    return;
  }

  // 拆除模式结束
  if (TOUCH.mode === 'deconstruct') {
    TOUCH.mode = 'idle';
    return;
  }

  // 蓝图框选结束
  if (TOUCH.mode === 'blueprint') {
    if (G.blueSelecting) {
      G.blueSelecting = false;
      if (!G.blueStart || !G.blueEnd) { cancelBlueprint(); }
      else if (G.blueMode === 'blue') captureBlueprint();
      else if (G.blueMode === 'red') applyRedBlueprint();
      else if (G.blueMode === 'green') applyGreenBlueprint();
    }
    TOUCH.mode = 'idle';
    return;
  }

  // 采集结束
  if (TOUCH.mode === 'mining') {
    G.mouseDown = false;
    G.player.mining = null; G.player.mineProg = 0;
    TOUCH.miningKey = null;
    TOUCH.mode = 'idle';
    return;
  }

  // 长按已触发操作盘 → 结束
  if (TOUCH.mode === 'longpress') {
    TOUCH.mode = 'idle';
    return;
  }

  // 建造拖动结束
  if (TOUCH.mode === 'build-drag') {
    G.mouseDown = false;
    TOUCH.mode = 'idle';
    return;
  }

  // 相机平移结束
  if (TOUCH.mode === 'panning') {
    TOUCH.mode = 'idle';
    return;
  }

  // 待定（可能是点按/双击/点击移动）
  if (TOUCH.mode === 'pending') {
    clearTimeout(TOUCH.longTimer);
    const t = changed[0];
    if (!t || TOUCH.longFired) { TOUCH.mode = 'idle'; return; }
    updateCursorTile(t.clientX, t.clientY);
    const dx = t.clientX - TOUCH.start.x;
    const dy = t.clientY - TOUCH.start.y;
    const isTap = Math.hypot(dx, dy) < T_TAP_MOVE;
    const isDouble = (performance.now() - TOUCH.tap.lastTime) < T_DBL_MS &&
      Math.hypot(t.clientX - TOUCH.tap.x, t.clientY - TOUCH.tap.y) < T_TAP_MOVE * 3;

    if (isTap) {
      TOUCH.tap.lastTime = performance.now();
      TOUCH.tap.x = t.clientX;
      TOUCH.tap.y = t.clientY;
      TOUCH.tap.count = isDouble ? 2 : 1;
      // 处理点按
      if (isDouble) handleDoubleTap();
      else handleTap();
      // handleTap 可能已把模式切换为采集（按住矿石），此处不要覆盖
      if (TOUCH.mode === 'pending') TOUCH.mode = 'idle';
    } else {
      TOUCH.tap.count = 0;
      TOUCH.mode = 'idle';
    }
  }
}

function onTouchCancel(ev) {
  clearTimeout(TOUCH.longTimer);
  TOUCH.pointers.clear();
  G.mouseDown = false;
  G.blueSelecting = false;
  TOUCH.mode = 'idle';
  G.player.mining = null; G.player.mineProg = 0;
}

function cancelPending() {
  clearTimeout(TOUCH.longTimer);
  TOUCH.longFired = false;
  G.mouseDown = false;
}

// ============================================================================
// 点按 / 双击 / 移动处理
// ============================================================================
function handleTap() {
  const t = G.cursorTile;
  if (!t) return;
  const tx = t.tx, ty = t.ty;
  const e = entAt(tx, ty);

  // 选中了物品 → 建造（就地放置）
  if (buildActive()) {
    // 手持修理包点击受损建筑 → 修复（对齐《异星工厂》触屏维修）
    if (hasRepairPackSelected() && e && isDamaged(e) && withinReach(tx, ty)) {
      repairActionAt(tx, ty);
      return;
    }
    // 手持峭壁炸药点击峭壁 → 炸毁清除（对齐《异星工厂》Cliff explosives）
    if (hasCliffBlastSelected() && isCliff(tx, ty)) {
      cliffBlastAt(tx, ty);
      return;
    }
    tryPlaceAt(tx, ty);
    return;
  }
  if (G.deconstructMode) return; // 已在拆除

  // 点击矿石 → 单次采集一格（快速收获）；长按/按住矿石则连续采集（见长按逻辑）
  const ti = getOreType(tx, ty);
  if (ti >= 0 && ti < ORES.length && getOreAmt(tx, ty) > 0 && withinReach(tx, ty)) {
    if (!G.settings.infiniteOre) consumeOre(tx, ty);
    invAdd(ORES[ti]);
    toast('+1 ' + ITEMS[ORES[ti]].name);
    return;
  }

  // 点击建筑 → 打开面板
  if (e && BUILD_DEFS[e.type]) {
    openPanel('machine', e);
    return;
  }

  // 点击水域 → 钓鱼（对齐《异星工厂》钓鱼玩法）
  if (isWater(tx, ty) && typeof tryFishAt === 'function') {
    if (tryFishAt(tx, ty)) return;
  }

  // 点击空地 → 玩家走过去（点击移动）
  if (withinReach(tx, ty) || true) {
    movePlayerTo(tx, ty);
  }
}

function handleDoubleTap() {
  const t = G.cursorTile;
  if (!t) return;
  const tx = t.tx, ty = t.ty;
  const e = entAt(tx, ty);
  // 双击矿石 → 连续采集两次（快速挖两格）
  const ti = getOreType(tx, ty);
  if (ti >= 0 && ti < ORES.length && getOreAmt(tx, ty) > 0 && withinReach(tx, ty)) {
    for (let i = 0; i < 2; i++) {
      if (getOreAmt(tx, ty) <= 0) break;
      if (!G.settings.infiniteOre) consumeOre(tx, ty);
      invAdd(ORES[ti]);
    }
    toast('+2 ' + ITEMS[ORES[ti]].name);
    return;
  }
  // 双击建筑 → 旋转
  if (e && BUILD_DEFS[e.type]) {
    if (G.panelMode === 'machine' && G.panelEnt === e) closePanel();
    rotateEnt(e);
    toast('已旋转 ' + ITEMS[e.type].name);
    return;
  }
  // 双击空地（选中物品）→ 旋转放置朝向
  if (buildActive()) {
    G.ghostDir = (G.ghostDir + 1) % 4;
    toast('放置朝向：' + dirName(G.ghostDir));
    uiDirty = true;
    return;
  }
  // 双击空地（无选中）→ 相机回中
  resetCamera();
}

function dirName(d) { return ['东', '南', '西', '北'][d] || '东'; }

// ============================================================================
// 相机平移 / 点击移动
// ============================================================================
// 相机以玩家为基准 + 一个世界偏移。拖动平移改变偏移；回中时清零。
function panCamera(dx, dy) {
  if (!G.cam.pan) G.cam.pan = { x: 0, y: 0 };
  G.cam.pan.x += dx;
  G.cam.pan.y += dy;
  G.cam.lastPan = performance.now();
}

function resetCamera() {
  G.cam.pan = { x: 0, y: 0 };
  toast('视角已回中');
}

// 点击移动：玩家朝目标瓦片移动
let _moveTarget = null;
function movePlayerTo(tx, ty) {
  const wx = tx * TILE + TILE / 2;
  const wy = ty * TILE + TILE / 2;
  _moveTarget = { x: wx, y: wy, tx, ty };
  toast('前往 (' + tx + ',' + ty + ')');
}

// 每帧驱动点击移动（由 main.js 调用）
function updateTouchMove(dt) {
  if (!_moveTarget) return;
  const p = G.player;
  const dx = _moveTarget.x - p.x;
  const dy = _moveTarget.y - p.y;
  const dist = Math.hypot(dx, dy);
  const sp = playerSpeed();
  if (dist < 4) {
    _moveTarget = null;
    return;
  }
  const step = Math.min(dist, sp * dt);
  const nx = p.x + dx / dist * step;
  const ny = p.y + dy / dist * step;
  if (!boxBlocked(nx, ny, 9)) {
    p.x = nx; p.y = ny;
    // 更新朝向
    if (Math.abs(dx) > Math.abs(dy)) p.dir = dx > 0 ? 0 : 2;
    else p.dir = dy > 0 ? 1 : 3;
    p.walkT += dt * 10;
  } else {
    _moveTarget = null;
  }
}

// 触屏设备检测
function isTouchDevice() {
  return ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
}

// 取消“点击移动”目标（玩家手动输入方向时调用）
function cancelTouchMove() {
  _moveTarget = null;
}

// 触屏新手引导提示：首次进入游戏时展示一次操作说明
const TOUCH_TIP_KEY = 'factory-touch-tip-seen';
function maybeShowTouchTip() {
  if (!isTouchDevice()) return;
  try {
    if (localStorage.getItem(TOUCH_TIP_KEY)) return;
    localStorage.setItem(TOUCH_TIP_KEY, '1');
  } catch (e) {}
  const d = document.createElement('div');
  d.id = 'touch-tip';
  d.innerHTML = '👆 点按建造/开面板/移动 · 长按建筑弹操作盘（旋转/拆除/复制） · ' +
    '拖动平移视角 · 双指捏合缩放 · 双击旋转/回中';
  document.body.appendChild(d);
  setTimeout(() => d.remove(), 6000);
}
