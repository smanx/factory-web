'use strict';

const G = {
  canvas: null,
  ctx: null,
  cam: { px: 0, py: 0, z: 1 },
  world: null,
  player: null,
  ents: [],
  grid: new Map(),
  inv: new Map(),
  sel: -1,
  quickSel: null,
  ghostDir: 0,
  techDone: {},
  techProg: {},
  activeTech: null,
  panelMode: null,
  panelEnt: null,
  cursorTile: null,
  keys: {},
  mouseDown: false,
  canvasActive: false,
  time: 0,
  dbg: { timeScale: 1, moveSpeed: 1, mineMult: 1, beltMult: 1, drillMult: 1, asmMult: 1 },
  spawn: { x: 0, y: 0 },
  hbArm: null,
  invRecipeQ: '',
  clipboard: null,
  settings: Object.assign({}, DEFAULT_SETTINGS),
  autoT: 0,
  power: { prod: 0, demand: 0, sat: 1 },
  powerT: 0
};

let lastPlaceKey = '';
let lastPanelCheck = 0;
let fpsSmooth = 60;

const SAVE_KEY = 'factory-proto-save-v1';

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(G.settings)); } catch (e) {}
}

function loadSettings() {
  try {
    const s = localStorage.getItem(SETTINGS_KEY);
    if (s) Object.assign(G.settings, JSON.parse(s));
  } catch (e) {}
}

function newGame() {
  const seed = (Math.random() * 1e9) | 0;
  G.world = genWorld(seed);
  G.grid = new Map();
  G.ents = [];
  G.inv = new Map();
  G.techDone = {};
  G.techProg = {};
  G.activeTech = null;
  G.sel = -1;
  G.quickSel = null;
  G.power = { prod: 0, demand: 0, sat: 1 };
  G.powerT = 0;
  const [sx, sy] = findSpawn(G.world);
  G.player = makePlayer(sx, sy);
  G.spawn = { x: sx, y: sy };
  G.cam.px = G.player.x;
  G.cam.py = G.player.y;
  invAdd('stone-furnace', 1);
  invAdd('coal', 8);
}

function serializeAll() {
  return {
    v: 1,
    seed: G.world.seed,
    world: {
      remaining: Array.from(G.world.remaining, ([k, v]) => {
        const i = k.indexOf(',');
        return [+k.slice(0, i), +k.slice(i + 1), v];
      }),
      chunks: Array.from(G.world.chunks.values()).map(encodeChunkData)
    },
    ents: G.ents.map(e => e.serialize()),
    inv: Array.from(G.inv),
    player: { x: G.player.x, y: G.player.y },
    techDone: G.techDone,
    techProg: G.techProg,
    activeTech: G.activeTech,
    hotbar: HOTBAR.slice(),
    settings: Object.assign({}, G.settings)
  };
}

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(serializeAll()));
    toast('已保存');
  } catch (err) {
    toast('保存失败：' + err.message);
  }
}

function loadGame() {
  let data;
  try {
    data = localStorage.getItem(SAVE_KEY);
  } catch (err) {
    toast('读取失败：' + err.message);
    return;
  }
  if (!data) { toast('没有存档'); return; }
  try {
    applySave(JSON.parse(data));
    closePanel();
    toast('已读档');
  } catch (err) {
    toast('存档损坏：' + err.message);
  }
}

function applySave(d) {
  G.world = genWorld(d.seed);
  G.world.remaining = new Map();
  if (d.world && Array.isArray(d.world.chunks)) {
    // 已探索地图块原样还原：与生成算法解耦，保证升级后地图不变
    for (const cd of d.world.chunks) {
      try {
        const c = decodeChunkData(cd);
        G.world.chunks.set(c.cx + ',' + c.cy, c);
      } catch (e) { /* 单块数据损坏则跳过，该块回退到按需生成 */ }
    }
  }
  if (d.world && Array.isArray(d.world.remaining)) {
    for (const [x, y, amt] of d.world.remaining) G.world.remaining.set(x + ',' + y, amt);
  } else if (Array.isArray(d.oreType)) {
    const OW = 180, OH = 180;
    for (let i = 0; i < OW * OH; i++) {
      if (d.oreType[i] >= 0 && d.oreAmt && d.oreAmt[i] >= 0) {
        G.world.remaining.set((i % OW) + ',' + ((i / OW) | 0), d.oreAmt[i]);
      }
    }
  }
  G.grid = new Map();
  G.ents = [];
  for (const s of d.ents) {
    const cls = ENT_CLASSES[s.type];
    if (!cls) continue;
    addEnt(cls.restore(s));
  }
  G.inv = new Map(d.inv);
  G.player = makePlayer(0, 0);
  G.player.x = d.player.x; G.player.y = d.player.y;
  const [sx, sy] = findSpawn();
  G.spawn = { x: sx, y: sy };
  G.techDone = d.techDone || {};
  G.techProg = d.techProg || {};
  G.activeTech = d.activeTech || null;
  G.sel = -1;
  G.quickSel = null;
  G.power = { prod: 0, demand: 0, sat: 1 };
  G.powerT = 0;
  if (Array.isArray(d.hotbar)) {
    HOTBAR = d.hotbar.slice(0, 10);
    while (HOTBAR.length < 10) HOTBAR.push(null);
    buildHotbar();
  }
  if (d.settings) Object.assign(G.settings, d.settings);
  G.cam.px = G.player.x; G.cam.py = G.player.y;
  uiDirty = true;
}

function tryPlaceAt(tx, ty) {
  const type = selItem();
  if (!type) return;
  if (invCount(type) < 1) {
    toast('背包里没有' + ITEMS[type].name + '了');
    G.sel = -1;
    G.quickSel = null;
    refreshHotbar();
    return;
  }
  const chk = canPlaceAt(type, tx, ty, G.ghostDir);
  if (!chk.ok) return;
  const cls = ENT_CLASSES[type];
  const e = new cls(type, tx, ty);
  e.dir = G.ghostDir;
  e.applyDir();
  addEnt(e);
  invTake(type, 1);
  refreshHotbar();
}

function deconstructAt(tx, ty) {
  const e = entAt(tx, ty);
  if (!e || !withinReach(tx, ty)) return;
  for (const [id, n] of entContents(e)) invAdd(id, n);
  removeEnt(e);
  if (G.panelEnt === e) closePanel();
  uiDirty = true;
}

function pickupAction() {
  let t = null;
  if (G.cursorTile && withinReach(G.cursorTile.tx, G.cursorTile.ty)) t = G.cursorTile;
  else {
    const tx = Math.floor(G.player.x / TILE) + DX[G.player.dir];
    const ty = Math.floor(G.player.y / TILE) + DY[G.player.dir];
    t = { tx, ty };
  }
  if (!t) return;
  const e = entAt(t.tx, t.ty);
  if (!e) return;
  let got = null;
  if (e instanceof Belt) {
    if (!e.items.length) { toast('这条传送带上没有物品'); return; }
    let best = e.items[0];
    for (const o of e.items) if (o.pos > best.pos) best = o;
    got = best.item;
    e.items.splice(e.items.indexOf(best), 1);
  } else {
    got = e.takeItem();
  }
  if (got) {
    invAdd(got);
    uiDirty = true;
  }
}

function copySettings(e) {
  if (!e) return;
  const s = { type: e.type, dir: e.dir };
  if (e instanceof Assembler) s.recipe = e.recipe;
  G.clipboard = s;
  toast('已复制 ' + ITEMS[e.type].name + ' 配置（Shift+左键粘贴到同类）');
}

function pasteSettings(e) {
  if (!e || !G.clipboard) return;
  const c = G.clipboard;
  if (e.type !== c.type) { toast('类型不匹配：剪贴板是' + ITEMS[c.type].name); return; }
  if (c.dir === undefined) return;
  if (e instanceof Splitter) { removeEnt(e); e.dir = c.dir; e.applyDir(); addEnt(e); }
  else { e.dir = c.dir; }
  if (c.recipe && e instanceof Assembler) e.setRecipe(c.recipe);
  uiDirty = true;
  toast('配置已粘贴');
}

function rotateAction() {
  if (G.cursorTile && withinReach(G.cursorTile.tx, G.cursorTile.ty)) {
    const e = entAt(G.cursorTile.tx, G.cursorTile.ty);
    if ((e instanceof Splitter)) {
      removeEnt(e);
      e.dir = (e.dir + 1) % 4;
      e.applyDir();
      addEnt(e);
      uiDirty = true;
      return;
    }
    if ((e instanceof Belt || e instanceof Inserter || e instanceof Drill || e instanceof Underground)) {
      e.dir = (e.dir + 1) % 4;
      if (e instanceof Drill) e.tryOutput();
      uiDirty = true;
      return;
    }
  }
  G.ghostDir = (G.ghostDir + 1) % 4;
}

function bindInput() {
  window.addEventListener('keydown', ev => {
    const k = ev.key.toLowerCase();
    if (k === 'f5' || k === 'f12') return;
    const t = ev.target;
    if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
      if (k === 'escape') { ev.target.blur(); ev.stopPropagation(); }
      return;
    }
    G.keys[k] = true;
    if (k >= '1' && k <= '9') selectSlot(+k - 1);
    else if (k === '0') selectSlot(9);
    else if (k === 'tab') { ev.preventDefault(); G.panelMode === 'inv' ? closePanel() : openPanel('inv'); }
    else if ((k === 'delete' || k === 'backspace') && G.panelMode === 'machine' && G.panelEnt instanceof Assembler && G.panelEnt.recipe) {
      G.panelEnt.setRecipe(null);
      renderPanel(false);
      toast('配方已清除');
    }
    else if (k === 'r') rotateAction();
    else if (k === 'f') pickupAction();
    else if (k === 'e') G.panelMode === 'inv' ? closePanel() : openPanel('inv');
    else if (k === 't') G.panelMode === 'tech' ? closePanel() : openPanel('tech');
    else if (k === 'o') G.panelMode === 'set' ? closePanel() : openPanel('set');
    else if (k === 'k') saveGame();
    else if (k === 'l') loadGame();
    else if (k === 'escape' || k === 'q') {
      if (G.panelMode) {
        closePanel();
      } else if (buildActive() || !G.cursorTile) {
        G.sel = -1;
        G.quickSel = null;
        refreshHotbar();
      } else {
        const e = entAt(G.cursorTile.tx, G.cursorTile.ty);
        const idx = e ? HOTBAR.indexOf(e.type) : -1;
        if (idx < 0) {
          G.sel = -1;
          if (e && BUILD_DEFS[e.type]) {
            G.quickSel = e.type;
            G.ghostDir = e.dir;
            toast('已直接选中 ' + ITEMS[e.type].name + '（Q 取消）');
          }
          uiDirty = true;
          refreshHotbar();
        } else {
          G.sel = idx;
          G.ghostDir = e.dir;
          uiDirty = true;
          refreshHotbar();
        }
      }
    }
  });
  window.addEventListener('keyup', ev => { G.keys[ev.key.toLowerCase()] = false; });

  G.canvas.addEventListener('mousemove', ev => {
    updateCursorTile(ev.clientX, ev.clientY);
  });
  G.canvas.addEventListener('mouseenter', () => { G.canvasActive = true; });
  G.canvas.addEventListener('mouseleave', () => {
    G.canvasActive = false;
    G.cursorTile = null;
    G.mouseDown = false;
  });
  G.canvas.addEventListener('mousedown', ev => {
    ev.preventDefault();
    updateCursorTile(ev.clientX, ev.clientY);
    const hovered = G.cursorTile ? entAt(G.cursorTile.tx, G.cursorTile.ty) : null;
    if (ev.button === 0) {
      if (ev.shiftKey && hovered) { pasteSettings(hovered); return; }
      G.mouseDown = true;
      lastPlaceKey = '';
      handleLeftDown();
    } else if (ev.button === 2) {
      if (ev.shiftKey && hovered) { copySettings(hovered); return; }
      if (G.cursorTile) deconstructAt(G.cursorTile.tx, G.cursorTile.ty);
    } else if (ev.button === 1) {
      if (G.cursorTile) {
        const e = entAt(G.cursorTile.tx, G.cursorTile.ty);
        if (e) openPanel('machine', e);
      }
    }
  });
  window.addEventListener('mouseup', ev => {
    if (ev.button === 0) G.mouseDown = false;
  });
  G.canvas.addEventListener('contextmenu', ev => ev.preventDefault());
  G.canvas.addEventListener('wheel', ev => {
    ev.preventDefault();
    G.cam.z *= ev.deltaY < 0 ? 1.12 : 0.89;
    G.cam.z = Math.max(0.5, Math.min(2.2, G.cam.z));
  }, { passive: false });

  window.addEventListener('resize', resize);
  document.getElementById('game').addEventListener('click', ev => {
    if (ev.button !== 0 || ev.shiftKey) return;
    updateCursorTile(ev.clientX, ev.clientY);
    if (buildActive() || !G.cursorTile) return;
    const e = entAt(G.cursorTile.tx, G.cursorTile.ty);
    if (e) openPanel('machine', e);
  });
}

function handleLeftDown() {
  if (buildActive() && G.cursorTile) {
    tryPlaceAt(G.cursorTile.tx, G.cursorTile.ty);
    lastPlaceKey = G.cursorTile.tx + ',' + G.cursorTile.ty;
  }
}

function updateCursorTile(cx, cy) {
  const [wx, wy] = screenToWorld(cx, cy);
  const tx = Math.floor(wx / TILE), ty = Math.floor(wy / TILE);
  G.cursorTile = { tx, ty };
}

function updateHeldMouse(dt) {
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
  const now = ts / 1000;
  const raw = Math.min(0.05, now - (loop.lastT || now));
  loop.lastT = now;
  const dt = Math.min(0.3, raw * ((G.dbg && G.dbg.timeScale) || 1));
  G.time += dt;
  fpsSmooth += (1 / Math.max(raw, 0.0001) - fpsSmooth) * 0.05;
  if (G.settings.autoSave) {
    G.autoT += raw;
    if (G.autoT >= 60) { G.autoT = 0; saveGame(); toast('自动保存完成'); }
  }

  try {
    updatePlayer(dt);
    updateHeldMouse(dt);
    updateMining(dt);
    for (const e of G.ents) e.update(dt);
    G.powerT += dt;
    if (G.powerT >= 0.25) { G.powerT = 0; updatePower(); }
    updateCamera(dt);

    render();

    if (uiDirty || G.time - lastPanelCheck > 0.25) {
      lastPanelCheck = G.time;
      refreshHotbar();
      if (G.panelMode === 'machine') updateMachineLive();
      if (uiDirty && (G.panelMode === 'inv' || G.panelMode === 'tech')) renderPanel(false);
      uiDirty = false;
    }
    updateHUD(dt, Math.round(fpsSmooth));
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
    ['canvas', () => { G.canvas = document.getElementById('game'); G.ctx = G.canvas.getContext('2d'); resize(); }],
    ['settings', () => loadSettings()],
    ['world', () => newGame()],
    ['hotbar', () => buildHotbar()],
    ['topbtn', () => initTopButtons()],
    ['panel', () => initPanelEvents()],
    ['tooltip', () => initTooltips()],
    ['debug', () => buildDebug()],
    ['input', () => bindInput()]
  ];
  for (const [name, fn] of steps) {
    try { fn(); } catch (err) {
      console.error('init[' + name + ']', err);
      toast('初始化[' + name + ']失败：' + err.message);
    }
  }
  if (!G.rafStarted) { G.rafStarted = true; requestAnimationFrame(loop); }
  toast('WASD 移动 · 左键挖矿/放建筑 · 右键拆除 · R 旋转 · F 拿取 · Q 取消/拾取朝向 · 中键/E 面板 · T 科技 · K/L 存读档');
}
window.addEventListener('load', boot);
if (document.readyState === 'complete') setTimeout(boot, 0);
