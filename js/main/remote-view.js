'use strict';

// ===== 远程视图（对齐《异星工厂》Map view / 遥控查看布局）=====
// 按 M 打开远程视图：玩家可在任意远处查看地图，用 WASD 平移镜头、滚轮大幅缩小放大，
// 可放置任意建筑但均为「虚拟建筑」（建造幽灵），不消耗资源、不真实落地，
// 施工机器人随后按条件自动施工（进入个人机器人港建造范围后）。
// 远程视图顶部标题条与右上角关闭按钮为 DOM 元素（#remote-bar / #remote-close）。
// M 在本文档语义中不再切换小地图开关（小地图保持默认打开）。

const REMOTE_MIN_ZOOM = 0.12;      // 远程视图最远可缩小到 0.12（约 500 格视野，可览大片基地/地图）
const REMOTE_MAX_ZOOM = 2.2;       // 与正常视角上限一致
const REMOTE_PAN_BASE = 560;       // 平移基础速度（世界像素/秒，随缩放自适应）

function inRemoteView() { return !!(G && G.remoteView); }

function toggleRemoteView() {
  if (inRemoteView()) exitRemoteView(); else enterRemoteView();
}

// 远程视图期间隐藏指定下方工具栏（仅装备栏），并记录原显示状态以便退出后恢复。
function _setUiVisible(id, visible) {
  const el = document.getElementById(id);
  if (!el) return;
  if (visible) {
    if (el.dataset.rvPrev) { el.style.display = el.dataset.rvPrev; delete el.dataset.rvPrev; }
  } else if (!el.dataset.rvPrev) {
    el.dataset.rvPrev = el.style.display || (el.style.display === 'none' ? '' : 'flex');
    el.style.display = 'none';
  }
}

// DOM 远程视图 UI 显隐
function _setRemoteUi(show) {
  const bar = document.getElementById('remote-bar');
  const close = document.getElementById('remote-close');
  const cls = show ? 'remove' : 'add';
  if (bar) bar.classList[cls]('hidden');
  if (close) close.classList[cls]('hidden');
}

function enterRemoteView() {
  if (!G) return;
  // 记录进入前的相机状态，退出远程视图时按需恢复（视角复位）
  if (G.cam) G._remotePrevCam = { x: G.cam.px, y: G.cam.py, z: G.cam.z };
  // 进入前清掉与远程视角冲突的交互状态（蓝图/拆除/面板等）
  if (typeof cancelBlueprint === 'function' && G.blueMode) cancelBlueprint();
  if (typeof toggleDeconstructMode === 'function' && G.deconstructMode) toggleDeconstructMode(false);
  if (G.panelMode && typeof closePanel === 'function') closePanel();
  if (typeof heldReturn === 'function') heldReturn();
  G.held = null; G.sel = -1; G.quickSel = null;
  if (typeof refreshHotbar === 'function') refreshHotbar();

  G.remoteView = true;
  // 镜头定位到玩家当前所在位置，之后由 remoteCamUpdate 接管
  G.cam.px = G.player.x;
  G.cam.py = G.player.y;
  // 远程视图：仅隐藏左下角装备栏（quickbar），下方的快捷栏/手搓队列保持可见
  ['quickbar'].forEach(id => _setUiVisible(id, false));
  // 显示顶部标题条与右上角关闭按钮
  _setRemoteUi(true);
  if (typeof playSfx === 'function') playSfx('click');
  if (typeof toast === 'function') toast('远程视图：WASD 移动镜头 · 滚轮缩放 · 左键放置虚拟建筑（建造幽灵）· M/右上角 ✕ 退出');
}

function exitRemoteView() {
  if (!G) return;
  G.remoteView = false;
  G.mouseDown = false;
  G.held = null; G.sel = -1; G.quickSel = null;
  // 隐藏顶部标题条与关闭按钮
  _setRemoteUi(false);
  // 恢复远程视图前隐藏的装备栏
  ['quickbar'].forEach(id => _setUiVisible(id, true));
  // 退出时把镜头视角恢复（复位到玩家附近/进出前的相机状态）
  if (G._remotePrevCam) {
    G.cam.px = G._remotePrevCam.x;
    G.cam.py = G._remotePrevCam.y;
    G.cam.z = G._remotePrevCam.z;
    G._remotePrevCam = null;
  }
  if (typeof refreshHotbar === 'function') refreshHotbar();
  if (typeof playSfx === 'function') playSfx('click');
  if (typeof toast === 'function') toast('已退出远程视图');
}

// 按 WASD（及方向键/箭头）平移远程镜头，dt 为逻辑步长。
// 返回是否实际发生了移动（供调用方判断是否应跳过人物移动逻辑）。
function remoteCamUpdate(dt) {
  const cam = G.cam;
  let mx = 0, my = 0;
  if (G.keys['w'] || G.keys['arrowup']) my -= 1;
  if (G.keys['s'] || G.keys['arrowdown']) my += 1;
  if (G.keys['a'] || G.keys['arrowleft']) mx -= 1;
  if (G.keys['d'] || G.keys['arrowright']) mx += 1;
  const len = Math.hypot(mx, my);
  if (len > 0 && cam) {
    mx /= len; my /= len;
    // 缩放越小视野越宽，平移速度按 1/z 提高，保证远近缩放时手部操作手感一致
    const sp = REMOTE_PAN_BASE / Math.max(REMOTE_MIN_ZOOM, cam.z);
    cam.px += mx * sp * dt;
    cam.py += my * sp * dt;
    return true;
  }
  return false;
}

// 滚轮缩放钳制：远程视图允许大幅缩小（下限更低以便全景览图），正常视角保持原样。
function remoteClampZoom(z) {
  if (inRemoteView()) return Math.max(REMOTE_MIN_ZOOM, Math.min(REMOTE_MAX_ZOOM, z));
  return Math.max(0.3, Math.min(2.2, z));
}

// 右上角 DOM 关闭按钮：点击退出远程视图（在 DOM 上绑定一次，避免重复绑定）。
let _remoteCloseBound = false;
function bindRemoteClose() {
  const close = document.getElementById('remote-close');
  if (!close || _remoteCloseBound) return;
  _remoteCloseBound = true;
  close.addEventListener('click', ev => {
    ev.stopPropagation();
    if (typeof exitRemoteView === 'function') exitRemoteView();
  });
}
