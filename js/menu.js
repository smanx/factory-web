'use strict';

// ===== 开始菜单：新游戏 / 读取存档 =====
// 与 main.js 配合：G.inMenu 为 true 时主循环暂停渲染与更新，
// 由用户点击开始菜单按钮后才调用 startNewGame() / startFromSave() 进入游戏。

(function () {
  // 存档键与 main.js 保持一致（主存档）
  const MENU_SAVE_KEY = 'factory-proto-save-v1';

  function initStartMenu() {
    const screen = document.getElementById('start-screen');
    if (!screen) return;

    const newBtn = document.getElementById('btn-new-game');
    const contBtn = document.getElementById('btn-continue');
    const infoEl = document.getElementById('start-save-info');

    // 启动时检测是否存在可用存档，并提示
    const hasSave = hasAnySave();
    if (infoEl) {
      if (hasSave) {
        infoEl.textContent = '检测到已有存档，可点击"读取存档"继续上次的工厂。';
        infoEl.className = 'start-save-info has-save';
      } else {
        infoEl.textContent = '暂无存档，点击"开始新游戏"创建新世界。';
        infoEl.className = 'start-save-info no-save';
      }
    }

    // 新游戏
    if (newBtn) {
      newBtn.addEventListener('click', function () {
        if (typeof startNewGame === 'function') {
          startNewGame();
        } else {
          // main.js 尚未就绪（正常情况不会发生）
          console.error('startNewGame 未定义');
        }
      });
    }

    // 读取存档
    if (contBtn) {
      contBtn.addEventListener('click', function () {
        if (typeof startFromSave === 'function') {
          startFromSave();
        } else {
          console.error('startFromSave 未定义');
        }
      });
    }

    // 开始菜单期间屏蔽空格/回车等默认滚动，保持体验
    screen.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Tab') e.preventDefault();
    });
  }

  // 检测主存档是否存在且非空
  function hasAnySave() {
    try {
      const raw = localStorage.getItem(MENU_SAVE_KEY);
      return !!(raw && raw.length > 0);
    } catch (e) {
      return false;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStartMenu);
  } else {
    initStartMenu();
  }
})();
