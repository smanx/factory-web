'use strict';

// ===== 开始菜单：新游戏 / 读取存档 =====
// 与 main.js 配合：G.inMenu 为 true 时主循环暂停渲染与更新，
// 由用户点击开始菜单按钮后才调用 startNewGame() / startFromSave() 进入游戏。
// “读取存档”会弹出存档列表弹层，用户可选择指定存档或一键加载最新。

(function () {
  // 存档由 js/saves.js 的多存档系统管理，此处仅检测是否存在任意存档。

  // ===== 用游戏地图生成功能随机生成一张地图作为开始菜单背景 =====
  // 复用游戏的地图生成逻辑（genWorld/genChunk/getTerrain），以一个随机种子
  // 生成临时世界并绘制到 .start-bg 的 canvas 上；绘制后恢复原世界，不影响真实游戏。
  function generateStartBackground() {
    const canvas = document.getElementById('start-bg-canvas');
    if (!canvas || typeof G === 'undefined' || !G || typeof genWorld !== 'function' || typeof drawChunkTerrainInto !== 'function') return false;
    const dpr = window.devicePixelRatio || 1;
    const W = canvas.clientWidth || window.innerWidth;
    const H = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.max(1, Math.round(W * dpr));
    canvas.height = Math.max(1, Math.round(H * dpr));
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    // 保存并临时替换世界：用随机种子生成一个仅供背景展示的临时地图
    const prevWorld = G.world;
    const prevWC = G.worldConfig;
    try {
      G.worldConfig = null;                 // 使用默认世界配置（随机种子）
      G.world = genWorld((Math.random() * 1e9) | 0);
      drawStartMapBackground(ctx, W, H);
    } finally {
      G.world = prevWorld;
      G.worldConfig = prevWC;
    }
    return true;
  }

  // 将临时世界渲染成与游戏内一致的完整地图，铺满全屏：以世界原点（主角出生点）
  // 为中心，复用游戏的地形分块绘制逻辑（含树木/峭壁/水面/混凝土等），瓦片缩放
  // 与游戏完全一致（TILE=32），直接展示出主角刚进入游戏时看到的同款地图，不再缩小。
  function drawStartMapBackground(ctx, W, H) {
    const TILE = 32;                          // 与游戏一致的瓦片像素
    // 覆盖屏幕所需的世界范围（格），向外多取 2 格避免边缘空白
    const halfX = Math.ceil(W / TILE / 2) + 2;
    const halfY = Math.ceil(H / TILE / 2) + 2;
    ctx.save();
    ctx.translate(W / 2, H / 2);              // 世界原点(出生点)平移到屏幕中心
    // 遍历覆盖可见范围的 chunk，复用游戏的地形分块绘制（含树木/峭壁/水面细节）
    const cX0 = Math.floor(-halfX / CHUNK);
    const cX1 = Math.floor(halfX / CHUNK);
    const cY0 = Math.floor(-halfY / CHUNK);
    const cY1 = Math.floor(halfY / CHUNK);
    // drawChunkTerrainInto 以 chunk 本地坐标(0..CHUNK*TILE)绘制（与游戏内离屏 chunk
    // 画布一致），因此直接画到共享画布时须先按 chunk 的世界像素位置平移，否则所有
    // chunk 都会重叠在屏幕右下 1/4，无法铺满全屏。
    const CHUNK_PX = CHUNK * TILE;            // 单个 chunk 的像素尺寸
    for (let cy = cY0; cy <= cY1; cy++) {
      for (let cx = cX0; cx <= cX1; cx++) {
        ctx.save();
        ctx.translate(cx * CHUNK_PX, cy * CHUNK_PX);
        drawChunkTerrainInto(ctx, cx, cy);
        ctx.restore();
      }
    }
    ctx.restore();
  }

  // 暴露给外部（main.js 返回菜单时）刷新背景，进入主菜单后每次随机生成新地图
  window.refreshStartBackground = generateStartBackground;

  function initStartMenu() {
    const screen = document.getElementById('start-screen');
    if (!screen) return;

    const newBtn = document.getElementById('btn-new-game');
    const contBtn = document.getElementById('btn-continue');
    const continueGameBtn = document.getElementById('btn-continue-game');
    const infoEl = document.getElementById('start-save-info');

    // 启动时检测是否存在可用存档：有则显示最上方的"继续游戏"按钮（一键加载最新存档），
    // 并做相应提示；无存档则隐藏该按钮（按钮默认 hidden，只在此处决定是否显示）。
    if (continueGameBtn) {
      // 点击"继续游戏"：直接加载时间最新的存档开始游戏
      continueGameBtn.addEventListener('click', function () {
        if (typeof playSfx === 'function') playSfx('click');
        if (typeof startFromSave === 'function') startFromSave();
      });
    }
    hasAnySave().then(hasSave => {
      if (continueGameBtn) {
        if (hasSave) continueGameBtn.classList.remove('hidden');
        else continueGameBtn.classList.add('hidden');
      }
      if (infoEl) {
        if (hasSave) {
          infoEl.textContent = '检测到已有存档，可点击"继续游戏"一键加载最新，或"读取存档"选择指定存档。';
          infoEl.className = 'start-save-info has-save';
        } else {
          infoEl.textContent = '暂无存档，点击"开始新游戏"创建新世界。';
          infoEl.className = 'start-save-info no-save';
        }
      }
    });

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

    // 读取存档：打开统一的“存档管理”弹框（含读取最新/选择存档/导入导出等）
    if (contBtn) {
      contBtn.addEventListener('click', function () {
        if (typeof playSfx === 'function') playSfx('click');
        if (typeof openSaveManage === 'function') openSaveManage();
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

    // 开始菜单“切换版本”按钮：读取 history/versions.json 获取历史版本列表，
    // 弹出弹层供选择；点击某版本后在新窗口打开“当前目录+/history/[版本号]”页面。
    const startVersBtn = document.getElementById('btn-start-vers');
    const versionOverlay = document.getElementById('version-overlay');
    const versionList = document.getElementById('version-list');
    const versionClose = document.getElementById('version-close');
    const closeVersionOverlay = function () {
      if (versionOverlay) versionOverlay.classList.add('hidden');
    };
    if (versionOverlay) versionOverlay.addEventListener('click', function (ev) {
      if (ev.target === versionOverlay) closeVersionOverlay();
    });
    if (versionClose) versionClose.addEventListener('click', closeVersionOverlay);
    if (startVersBtn) {
      startVersBtn.addEventListener('click', async function () {
        if (typeof playSfx === 'function') playSfx('click');
        if (!versionList) return;
        versionList.innerHTML = '<div class="load-save-empty">加载中…</div>';
        if (versionOverlay) versionOverlay.classList.remove('hidden');
        let versions = [];
        try {
          // 复用项目内 history/versions.json 作为版本列表来源
          const res = await fetch('history/versions.json', { cache: 'no-store' });
          if (res.ok) {
            const data = await res.json();
            if (data && Array.isArray(data.versions)) versions = data.versions;
          }
        } catch (e) { /* 忽略，走无版本提示 */ }
        if (!versions.length) {
          versionList.innerHTML = '<div class="load-save-empty">当前无历史版本</div>';
          return;
        }
        // 版本页面基准：取当前 URL 去掉最后一个文件名部分，拼接 /history/[版本号]
        const base = window.location.href.replace(/\/[^/]*$/, '');
        // 倒序显示：越新的版本越靠前（默认 versions.json 为升序 v0.0.1...v0.0.N）
        versionList.innerHTML = '';
        [].slice.call(versions).reverse().forEach(function (ver) {
          const item = document.createElement('div');
          item.className = 'load-save-item';
          const info = document.createElement('div');
          info.className = 'load-save-item-info';
          const name = document.createElement('div');
          name.className = 'load-save-item-name';
          name.textContent = ver;
          info.appendChild(name);
          item.appendChild(info);
          item.addEventListener('click', function () {
            closeVersionOverlay();
            window.open(base + '/history/' + encodeURIComponent(ver), '_blank');
          });
          versionList.appendChild(item);
        });
      });
    }

    // 开始菜单期间屏蔽空格/回车等默认滚动，保持体验
    screen.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Tab') e.preventDefault();
    });

    // 开始菜单内的 ESC：仅在菜单态生效（游戏内 ESC 由 main-input.js 处理，菜单态已被其跳过）。
    // 按 ESC 逐层关闭弹框：存档管理 → 成就面板；关闭后不进入游戏菜单。
    window.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || e.repeat) return;
      if (!G || G.inMenu !== true) return;
      if (typeof isSaveManageOpen === 'function' && isSaveManageOpen()) {
        if (typeof closeSaveManage === 'function') closeSaveManage();
        e.preventDefault();
      } else if (G.panelMode) {
        if (typeof closePanel === 'function') closePanel();
        e.preventDefault();
      }
    });
  }

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

  function initStart() {
    initStartMenu();
    // 生成随机地图背景（复用游戏地图生成功能）
    // 关键路径下背景依赖（world.js/render.js/main.js）可能尚未加载（G/genWorld/
    // drawChunkTerrainInto 未就绪），generateStartBackground 会跳过并返回 false；
    // 此时延迟到 window load（全部脚本就绪）后再补渲染一次，保证主菜单仍有动态地图背景。
    let bgReady = false;
    try { bgReady = generateStartBackground(); } catch (e) { bgReady = false; }
    if (!bgReady) {
      window.addEventListener('load', function () {
        try { generateStartBackground(); } catch (e) { /* 忽略 */ }
      });
    }
    // 窗口尺寸变化时重绘背景，保持铺满
    window.addEventListener('resize', function () { generateStartBackground(); });
  }

  // 关键路径启动：menu.js 作为同步脚本置于 body 末尾，此时开始菜单 DOM 已解析完毕。
  // 直接同步执行 initStart（不再等待 DOMContentLoaded，DOMContentLoaded 会被其余 defer 脚本
  // 阻塞，导致菜单可交互时间推迟到“全部脚本就绪”）。菜单按钮事件由此尽可能早地完成绑定。
  if (document.getElementById('start-screen')) {
    initStart();
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStart);
  } else {
    initStart();
  }
})();
