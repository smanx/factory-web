'use strict';

// ===== 开始菜单：新游戏 / 读取存档 =====
// 与 main.js 配合：G.inMenu 为 true 时主循环暂停渲染与更新，
// 由用户点击开始菜单按钮后才调用 startNewGame() / startFromSave() 进入游戏。
// “读取存档”会弹出存档列表弹层，用户可选择指定存档或一键加载最新。

(function () {
  // 存档由 js/saves.js 的多存档系统管理，此处仅检测是否存在任意存档。

  function initStartMenu() {
    const screen = document.getElementById('start-screen');
    if (!screen) return;

    const newBtn = document.getElementById('btn-new-game');
    const contBtn = document.getElementById('btn-continue');
    const infoEl = document.getElementById('start-save-info');
    const overlay = document.getElementById('load-save-overlay');
    const listEl = document.getElementById('load-save-list');
    const closeBtn = document.getElementById('load-save-close');
    const newestBtn = document.getElementById('btn-load-newest');

    // 启动时检测是否存在可用存档，并提示
    if (infoEl) {
      hasAnySave().then(hasSave => {
        if (hasSave) {
          infoEl.textContent = '检测到已有存档，可点击"读取存档"选择存档继续，或一键加载最新。';
          infoEl.className = 'start-save-info has-save';
        } else {
          infoEl.textContent = '暂无存档，点击"开始新游戏"创建新世界。';
          infoEl.className = 'start-save-info no-save';
        }
      });
    }

    // 新游戏：先弹出地图设置面板（对齐《异星工厂》新游戏地图生成器），确认后开始
    if (newBtn) {
      newBtn.addEventListener('click', function () {
        if (typeof openWorldConfigPanel === 'function') {
          openWorldConfigPanel(function (cfg) {
            if (typeof startNewGame === 'function') startNewGame();
            else console.error('startNewGame 未定义');
          });
        } else if (typeof startNewGame === 'function') {
          startNewGame();
        } else {
          console.error('startNewGame 未定义');
        }
      });
    }

    // 地图设置面板：关闭按钮
    const wcClose = document.getElementById('world-config-close');
    if (wcClose) wcClose.addEventListener('click', function () {
      if (typeof closeWorldConfigPanel === 'function') closeWorldConfigPanel();
    });

    // 读取存档：弹出存档列表弹层
    if (contBtn) {
      contBtn.addEventListener('click', function () {
        openLoadSaveOverlay(overlay, listEl);
      });
    }

    // 关闭弹层
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        closeLoadSaveOverlay(overlay);
      });
    }
    // 点击遮罩空白处关闭
    if (overlay) {
      overlay.addEventListener('click', function (e) {
        if (e.target === overlay) closeLoadSaveOverlay(overlay);
      });
    }

    // 一键加载最新存档
    if (newestBtn) {
      newestBtn.addEventListener('click', function () {
        if (typeof startFromSave === 'function') {
          startFromSave();
        } else {
          console.error('startFromSave 未定义');
        }
      });
    }

    // 开始菜单“成就”按钮：打开成就面板（对齐《异星工厂》成就系统）
    const startAchBtn = document.getElementById('btn-start-ach');
    if (startAchBtn) {
      startAchBtn.addEventListener('click', function () {
        if (typeof openPanel === 'function') openPanel('ach');
        else if (typeof G !== 'undefined') { G.panelMode = 'ach'; if (typeof renderPanel === 'function') renderPanel(true); }
        if (typeof playSfx === 'function') playSfx('click');
      });
    }

    // 开始菜单期间屏蔽空格/回车等默认滚动，保持体验
    screen.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Tab') e.preventDefault();
    });
  }

  // 打开读取存档弹层并渲染存档列表
  async function openLoadSaveOverlay(overlay, listEl) {
    if (!overlay) return;
    overlay.classList.remove('hidden');
    if (listEl) await renderSaveList(listEl);
  }

  function closeLoadSaveOverlay(overlay) {
    if (overlay) overlay.classList.add('hidden');
  }

  // 渲染存档列表：每项为“自动/用户 + 名称 + 时间/大小”，点击该项即加载对应存档
  async function renderSaveList(listEl) {
    let saves = [];
    try {
      if (typeof migrateLegacySave === 'function') await migrateLegacySave();
      saves = typeof listAllSaves === 'function' ? await listAllSaves() : [];
    } catch (e) {
      saves = [];
    }

    if (!saves.length) {
      listEl.innerHTML = '<div class="load-save-empty">暂无存档。请先点击“开始新游戏”，之后在设置面板中保存进度。</div>';
      return;
    }

    listEl.innerHTML = '';
    for (const s of saves) {
      const d = new Date(s.time);
      const time = fmtDate(d);
      const tagClass = s.type === 'auto' ? 'auto' : 'user';
      const tagText = s.type === 'auto' ? '自动' : '用户';

      const item = document.createElement('div');
      item.className = 'load-save-item';
      item.setAttribute('role', 'button');
      item.setAttribute('data-id', s.id);

      const info = document.createElement('div');
      info.className = 'load-save-item-info';
      info.innerHTML =
        '<div class="load-save-item-name">' + escHtml(s.name || '存档') + '</div>' +
        '<div class="load-save-item-meta">' + time + ' · ' + escHtml(s.sizeText || '') + '</div>';

      const tag = document.createElement('span');
      tag.className = 'load-save-item-tag ' + tagClass;
      tag.textContent = tagText;

      item.appendChild(info);
      item.appendChild(tag);

      // 点击加载该存档
      item.addEventListener('click', function () {
        if (typeof loadSaveFromMenu === 'function') {
          loadSaveFromMenu(s.id);
        } else {
          console.error('loadSaveFromMenu 未定义');
        }
      });

      listEl.appendChild(item);
    }
  }

  function fmtDate(d) {
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) +
      ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function escHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

  // 检测是否存在任意存档（自动或用户）
  function hasAnySave() {
    return (async () => {
      try {
        // 首次打开时迁移旧版单键存档到新多存档系统
        if (typeof migrateLegacySave === 'function') await migrateLegacySave();
        return typeof listAllSaves === 'function' ? (await listAllSaves()).length > 0 : false;
      } catch (e) {
        return false;
      }
    })();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStartMenu);
  } else {
    initStartMenu();
  }
})();
