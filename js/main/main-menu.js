'use strict';

// ===== 开始菜单：新游戏 / 读取存档 =====
// 游戏启动后先停留在开始菜单，由用户选择才开始/继续游戏。

// 显示新手引导面板（首次新游戏时自动弹出；也可用 Alt+H 手动查看完整说明）
function showTutorial() {
  const ov = document.getElementById('tutorial-overlay');
  if (ov) {
    ov.classList.remove('hidden');
    if (typeof playSfx === 'function') playSfx('click');
  }
}
function hideTutorial() {
  const ov = document.getElementById('tutorial-overlay');
  if (ov) ov.classList.add('hidden');
}
function tutorialShownMark() {
  G.settings.tutorialShown = true;
  hideTutorial();
  if (typeof saveSettings === 'function') saveSettings(); // 持久化已看标记
}

// 初始化新手引导：绑定“开始游戏”关闭按钮（供首次引导与 Alt+H 说明共用）
function initTutorial() {
  const btn = document.getElementById('btn-tutorial-close');
  if (btn) {
    btn.addEventListener('click', () => tutorialShownMark());
  }
  // 点击遮罩空白处也可关闭
  const ov = document.getElementById('tutorial-overlay');
  if (ov) ov.addEventListener('click', ev => { if (ev.target === ov) tutorialShownMark(); });
}

function startNewGame() {
  newGame();
  buildHotbar();
  enterGame();
  if (!G.settings.tutorialShown) showTutorial();   // 首次新游戏：弹出新手引导
}

async function startFromSave() {
  // 读取时间最新的存档（自动或用户均可）
  const data = await readNewestSave();
  if (!data) { toast('没有存档，请先开始新游戏'); return false; }
  return enterFromSave(data, '已读档');
}

// 从开始菜单读取指定 id 的存档并进入游戏
async function loadSaveFromMenu(id) {
  if (!id) { toast('没有存档'); return false; }
  const data = await readSave(id);
  if (!data) { toast('存档不存在或已损坏'); return false; }
  return enterFromSave(data, '已读档');
}

// 应用存档数据并进入游戏（供开始菜单读取存档复用）
function enterFromSave(data, okMsg) {
  try {
    applySave(data);
  } catch (err) {
    toast('存档损坏：' + err.message);
    return false;
  }
  buildHotbar();
  if (typeof sfxWarmup === 'function') sfxWarmup(500); // 读档静默缓冲，过滤首帧实体恢复爆音
  enterGame();
  if (okMsg) toast(okMsg);
  return true;
}

// 隐藏开始菜单并进入游戏主循环（loop 检测 G.inMenu=false 后开始渲染/更新）。
function enterGame() {
  const sc = document.getElementById('start-screen');
  if (sc) sc.classList.add('hidden');
  G.inMenu = false;
  G.paused = false;
  // 进入游戏后才显示帧数/坐标 HUD 与左下角战斗快捷栏（启动页/主菜单不显示）
  const hud = document.getElementById('hud-info');
  if (hud) hud.style.display = 'block';
  const qb = document.getElementById('quickbar');
  if (qb) qb.style.display = 'flex';
  const cq = document.getElementById('craft-queue');
  if (cq) cq.style.display = 'flex';
  toast('WASD 移动 · 左键放建筑(覆盖建造) · 按住右键挖矿/砍树 · 右键拆除 · R 旋转 · F 拿取 · Q 取消/拾取朝向 · 中键/E 面板 · T 科技 · P 统计 · B 蓝图库 · Alt+B 创建蓝图 · Ctrl+C/X 复制/剪切 · Alt+D 红图 · Alt+U 绿图 · K/L 存读档');
}

// 退出到开始菜单（主页面）：隐藏游戏界面、显示开始菜单，并暂停游戏循环。
function returnToMenu() {
  if (typeof closePanel === 'function') closePanel();
  G.inMenu = true;
  G.paused = false;
  // 回到启动页时隐藏帧数/坐标 HUD 与左下角战斗快捷栏（仅在游戏内显示）
  const hud = document.getElementById('hud-info');
  if (hud) hud.style.display = 'none';
  const qb = document.getElementById('quickbar');
  if (qb) qb.style.display = 'none';
  const cq = document.getElementById('craft-queue');
  if (cq) cq.style.display = 'none';
  G.sel = -1;
  G.blueMode = null;
  if (typeof syncBlueprintCursor === 'function') syncBlueprintCursor();
  G.deconstructMode = false;
  G.ghostDir = 0;
  const sc = document.getElementById('start-screen');
  if (sc) sc.classList.remove('hidden');
  if (typeof playSfx === 'function') playSfx('click');
  toast('已退出到主页面');
  // 回到主菜单时随机生成一张新地图作为背景（复用游戏地图生成功能）
  if (typeof refreshStartBackground === 'function') refreshStartBackground();
}

// ===== 死亡结算菜单（对齐《异星工厂》：阵亡后选择 出生点复活 / 读取存档 / 重新开始）=====
// 玩家阵亡时由 combat2.damagePlayer 调用；暂停游戏并弹出死亡菜单。
function showDeathMenu() {
  const ov = document.getElementById('death-overlay');
  if (ov) ov.classList.remove('hidden');
  G.paused = true;   // 阵亡后暂停游戏世界，等待玩家选择
  if (typeof playSfx === 'function') playSfx('player-death');
}
function hideDeathMenu() {
  const ov = document.getElementById('death-overlay');
  if (ov) ov.classList.add('hidden');
}

// 出生点复活：清空附近敌人，回到出生点并回满生命，继续游戏
function respawnAtSpawn() {
  hideDeathMenu();
  G.enemies = []; G.enemyProjectiles = [];
  G.player.x = G.spawn.x * TILE + TILE / 2;
  G.player.y = G.spawn.y * TILE + TILE / 2;
  // 复位相机：居中于玩家
  // （偏离出生点，导致玩家眼前的基地/设备被挤到屏幕外，看起来“全部不见了”）。
  if (G.cam.pan) { G.cam.pan.x = 0; G.cam.pan.y = 0; }
  G.cam.px = G.player.x; G.cam.py = G.player.y;
  G.playerHP = G.playerHPmax;
  G.paused = false;
  if (typeof toast === 'function') toast('已在出生点复活');
  uiDirty = true;
}

function initDeathMenu() {
  const r = document.getElementById('btn-death-respawn');
  const l = document.getElementById('btn-death-load');
  const s = document.getElementById('btn-death-restart');
  if (r) r.addEventListener('click', () => { if (typeof playSfx === 'function') playSfx('click'); respawnAtSpawn(); });
  if (l) l.addEventListener('click', async () => {
    if (typeof playSfx === 'function') playSfx('click');
    hideDeathMenu();
    // 读取最新存档继续（无存档则回退到出生点复活）
    const ok = await startFromSave();
    if (!ok) respawnAtSpawn();
  });
  if (s) s.addEventListener('click', () => {
    if (typeof playSfx === 'function') playSfx('click');
    hideDeathMenu();
    startNewGame();   // 重新开始游戏（生成新世界）
  });
}

// ===== 游戏菜单（按 Esc 展开/合上）：暂停世界并居中显示菜单 =====
// 与 main-input.js 的 ESC 分支配合：游戏内无任何弹框/面板时，第一次 Esc 展开游戏菜单并暂停，
// 再按一次 Esc 合上并继续游戏（对齐《异星工厂》暂停菜单）。
function isPauseMenuOpen() {
  const ov = document.getElementById('pause-overlay');
  return !!ov && !ov.classList.contains('hidden');
}
function isConfirmOpen() {
  const ov = document.getElementById('confirm-overlay');
  return !!ov && !ov.classList.contains('hidden');
}
function openPauseMenu() {
  const ov = document.getElementById('pause-overlay');
  if (ov) ov.classList.remove('hidden');
  G.paused = true;   // 展开菜单即暂停世界
  if (typeof playSfx === 'function') playSfx('click');
}
function closePauseMenu() {
  const ov = document.getElementById('pause-overlay');
  if (ov) ov.classList.add('hidden');
  G.paused = false;   // 合上菜单即继续游戏
}

// ===== 二级确认弹框 =====
// 用于“重开游戏/返回主菜单”前提醒用户先手动保存存档；确认后回调。
let _confirmCb = null;
function openConfirm(title, desc, okLabel, onConfirm) {
  _confirmCb = typeof onConfirm === 'function' ? onConfirm : null;
  const t = document.getElementById('confirm-title'); if (t) t.textContent = title || '⚠ 确认操作';
  const d = document.getElementById('confirm-desc'); if (d) d.textContent = desc || '';
  const ok = document.getElementById('btn-confirm-ok'); if (ok) ok.textContent = okLabel || '确认';
  const ov = document.getElementById('confirm-overlay'); if (ov) ov.classList.remove('hidden');
  if (typeof playSfx === 'function') playSfx('click');
}
function closeConfirm() {
  _confirmCb = null;
  const ov = document.getElementById('confirm-overlay'); if (ov) ov.classList.add('hidden');
}

function initPauseMenu() {
  const ov = document.getElementById('pause-overlay');
  const cvOv = document.getElementById('confirm-overlay');
  const resume = document.getElementById('btn-pause-resume');
  const restart = document.getElementById('btn-pause-restart');
  const load = document.getElementById('btn-pause-load');
  const settings = document.getElementById('btn-pause-settings');
  const quit = document.getElementById('btn-pause-quit');
  if (resume) resume.addEventListener('click', () => {
    if (typeof playSfx === 'function') playSfx('click');
    closePauseMenu();
  });
  // 重开游戏会丢失当前进度，需二级确认并提醒先保存存档
  if (restart) restart.addEventListener('click', () => {
    if (typeof playSfx === 'function') playSfx('click');
    openConfirm('↻ 重开游戏', '将生成一个全新世界，当前进度会全部丢失！\n请先到「💾 存档管理」手动保存存档。', '重开游戏', () => {
      closePauseMenu();
      if (typeof startNewGame === 'function') startNewGame();   // 重新开始游戏（生成新世界）
    });
  });
  if (load) load.addEventListener('click', () => {
    if (typeof playSfx === 'function') playSfx('click');
    if (typeof openSaveManage === 'function') openSaveManage();   // 打开存档管理页（含新建/保存/读取/导入存档）
  });
  if (settings) settings.addEventListener('click', () => {
    if (typeof playSfx === 'function') playSfx('click');
    // 保留游戏菜单（不收起），打开设置面板（暂停态由 openPanel('set') 维持）；
    // 关闭设置时若游戏菜单仍在，则继续保持暂停并停留在游戏菜单（见 ui.js closePanel）
    if (typeof openPanel === 'function') openPanel('set');
  });
  // 返回主菜单不会自动保存，需二级确认并提醒先保存存档
  if (quit) quit.addEventListener('click', () => {
    if (typeof playSfx === 'function') playSfx('click');
    openConfirm('🏠 返回主菜单', '返回主菜单不会自动保存，未保存的进度将丢失！\n请先到「💾 存档管理」手动保存存档。', '返回主菜单', () => {
      closePauseMenu();
      if (typeof returnToMenu === 'function') returnToMenu();
    });
  });
  // 二级确认弹框：确认/取消
  const cvOk = document.getElementById('btn-confirm-ok');
  const cvCancel = document.getElementById('btn-confirm-cancel');
  if (cvOk) cvOk.addEventListener('click', () => {
    if (typeof playSfx === 'function') playSfx('click');
    const cb = _confirmCb; closeConfirm(); if (cb) cb();
  });
  if (cvCancel) cvCancel.addEventListener('click', () => {
    if (typeof playSfx === 'function') playSfx('click');
    closeConfirm();
  });
  // 点击确认遮罩空白处视为取消
  if (cvOv) cvOv.addEventListener('click', ev => { if (ev.target === cvOv) closeConfirm(); });
  // 点击遮罩空白处合上菜单并继续游戏
  if (ov) ov.addEventListener('click', ev => { if (ev.target === ov) closePauseMenu(); });
}

