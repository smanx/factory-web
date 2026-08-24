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
  showDetails: false,
  mouseDown: false,
  canvasActive: false,
  time: 0,
  dbg: { timeScale: 1, moveSpeed: 1, mineMult: 1, beltMult: 1, drillMult: 1, asmMult: 1, infinite: false, farReach: false },
  spawn: { x: 0, y: 0 },
  hbArm: null,
  invRecipeQ: '',
  clipboard: null,
  blueprint: null,        // 蓝图数据：{ minX, minY, w, h, ents: [序列化实体...] }
  blueMode: null,         // 'blue' | 'red' | 'paste'（框选/删除/粘贴蓝图）
  blueStart: null,        // 框选起点瓦片
  blueEnd: null,          // 框选终点瓦片
  blueSelecting: false,   // 正在拖拽框选
  greenAction: null,      // 绿图框选后的动作：'upgrade' | 'downgrade' | null
  greenRect: null,        // 绿图最近一次框选区域
  statsTab: 'items',      // 统计面板当前页：items | power | perf
  statsItemTab: 'prod',   // 统计面板-物品速率页：prod(生产速率) | cons(消耗)
  machTab: 'prod',        // 设备面板-消耗/生产 tab：cons | prod（已弃用）
  settings: Object.assign({}, DEFAULT_SETTINGS),
  autoT: 0,
  power: { prod: 0, demand: 0, sat: 1 },
  powerT: 0,
  enemies: [],
  bullets: [],
  spawnT: 0
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
  // 新种子下地形变化，清空分块离屏缓存
  if (typeof clearTerrainCache === 'function') clearTerrainCache();
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
  G.enemies = []; G.bullets = []; G.spawnT = 0;
  const [sx, sy] = findSpawn(G.world);
  G.player = makePlayer(sx, sy);
  G.spawn = { x: sx, y: sy };
  G.cam.px = G.player.x;
  G.cam.py = G.player.y;
  invAdd('stone-furnace', 1);
  invAdd('coal', 8);
  // 测试用创造/虚空设备：各给 2 个，方便搭建测试物流与流体链路
  invAdd('creative-chest', 2);
  invAdd('void-chest', 2);
  invAdd('creative-pipe', 2);
  invAdd('void-pipe', 2);
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
    settings: Object.assign({}, G.settings),
    dbg: Object.assign({}, G.dbg)
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
  // 开发者调试数据随存档保存/读取，读档时自动恢复调试设置
  if (d.dbg && typeof d.dbg === 'object') Object.assign(G.dbg, d.dbg);
  G.cam.px = G.player.x; G.cam.py = G.player.y;
  uiDirty = true;
}

// 覆盖建造：跳过实体碰撞，先拆除占用格上的所有原设备（返还物资），再放置新设备。
// 同一格始终只保留一个实体，不会叠加；仅对实体冲突生效（压水/超距等非实体冲突返回 false 不覆盖）。
function forcedPlaceAt(type, tx, ty, infinite) {
  const chk = canPlaceAt(type, tx, ty, G.ghostDir, { skipEnt: true });
  if (!chk.ok || !chk.ents || chk.ents.length === 0) return false; // 非实体冲突（压水/无矿等）或无需拆除
  // 拆除占用格上的原设备（不消耗背包，返还其物资）
  for (const e of chk.ents) {
    for (const [id, n] of e.contents()) invAdd(id, n);
    removeEnt(e);
    if (G.panelEnt === e) closePanel();
  }
  // 放置新设备
  const cls = ENT_CLASSES[type];
  const e = new cls(type, tx, ty);
  e.dir = G.ghostDir;
  e.applyDir();
  addEnt(e);
  if (!infinite) invTake(type, 1);
  uiDirty = true;
  refreshHotbar();
  return true;
}

function tryPlaceAt(tx, ty) {
  const type = selItem();
  if (!type) return;
  const infinite = !!(G.dbg && G.dbg.infinite);
  // 无限资源模式：建造不消耗原料，且可直接放置测试用创造/虚空箱与管道（无需背包里拥有）
  if (!infinite && invCount(type) < 1) {
    toast('背包里没有' + ITEMS[type].name + '了');
    G.sel = -1;
    G.quickSel = null;
    refreshHotbar();
    return;
  }
  const chk = canPlaceAt(type, tx, ty, G.ghostDir);
  if (!chk.ok) {
    // 传送带特殊逻辑优先：同向衔接铺设、或自动改用地下带跨越障碍
    if (tryPlaceOntoSameDirBelt(type, tx, ty)) { uiDirty = true; return; }
    if (tryAutoUnderground(type, tx, ty)) { uiDirty = true; return; }
    // 覆盖建造（对齐《异星工厂》强制建造，但作为默认行为）：
    // 目标格已有建筑时，先拆除原设备并返还物资，再在其上放置新设备。
    // 只覆盖实体冲突，绝不叠加——同一格始终只有一个实体；压水/超距等
    // 非实体冲突不会覆盖（forcedPlaceAt 内部会再次校验）。
    if (forcedPlaceAt(type, tx, ty, infinite)) { uiDirty = true; return; }
    // 仍无法放置（如压水、超距）：提示并保持当前选中
    toast('无法在这里建造');
    return;
  }
  // 覆盖升级/降级：把带/地下带/分流器放到同族现有传送带上，直接覆盖当前连续的一段
  const target = entAt(tx, ty);
  if (target && canOverwriteWithBelt(type, target)) {
    if (target instanceof Belt) {
      upgradeBeltSegment(tx, ty, type, infinite);   // 传送带：一键升级/降级整条连续带线
    } else {
      overwriteBeltTile(tx, ty, type, infinite);     // 地下带/分流器：单格覆盖
    }
    return;
  }
  const cls = ENT_CLASSES[type];
  const e = new cls(type, tx, ty);
  e.dir = G.ghostDir;
  e.applyDir();
  addEnt(e);
  if (!infinite) invTake(type, 1);
  refreshHotbar();
}

// 点击传送带：用 type 覆盖目标，并一键升级/降级当前连续的所有同族传送带（对齐《异星工厂》覆盖升级整条带线）。
// 只升级当前那一节（同一方向、相互衔接、同阶）的带子；消耗新带、返还旧带，物品保留。
function upgradeBeltSegment(tx, ty, type, infinite) {
  const oldType = entAt(tx, ty) ? entAt(tx, ty).type : null;
  if (!oldType || oldType === type) return;   // 同阶覆盖：不消耗、视为未改变
  const family = tierFamily(type);
  const oldFamily = tierFamily(oldType);
  if (!family || family !== oldFamily) return; // 非同族：不应走到这里

  // 收集目标所在连续段：与目标同族、且当前同阶的相邻（含斜向衔接的转弯带）带子
  const seg = new Set();
  const q = [[tx, ty]];
  seg.add(tx + ',' + ty);
  while (q.length) {
    const [cx, cy] = q.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = cx + dx, ny = cy + dy;
      const k = nx + ',' + ny;
      if (seg.has(k)) continue;
      const n = entAt(nx, ny);
      if (n && tierFamily(n.type) === family && n.type === oldType) {
        seg.add(k);
        q.push([nx, ny]);
      }
    }
  }
  const count = seg.size;
  // 检查是否有足够的新带（升级时消耗；降级时不消耗反而返还旧带）
  if (!infinite && tierNext(oldType) === type && invCount(type) < count) {
    toast('背包里没有足够的' + ITEMS[type].name + '（需 ' + count + '）');
    return;
  }
  // 执行：把段内所有带子换成新带，保留朝向与物品
  for (const k of seg) {
    const [sx, sy] = k.split(',').map(Number);
    const e = entAt(sx, sy);
    const dir = e.dir;
    const items = e.items ? e.items.map(o => ({ item: o.item, pos: o.pos })) : [];
    removeEnt(e);
    const cls = ENT_CLASSES[type];
    const ne = new cls(type, sx, sy);
    ne.dir = dir;
    ne.applyDir();
    if (ne.items) ne.items = items;
    addEnt(ne);
  }
  if (!infinite) {
    if (tierNext(oldType) === type) invTake(type, count);          // 升级：扣新带
    else invAdd(oldType, count);                                     // 降级：返还旧带
  }
  if (G.panelEnt && seg.has(G.panelEnt.x + ',' + G.panelEnt.y)) closePanel();
  toast('已' + (tierNext(oldType) === type ? '升级' : '降级') + ' ' + count + ' 格' + ITEMS[oldType].name + ' → ' + ITEMS[type].name);
  uiDirty = true;
  refreshHotbar();
}

// 单格覆盖：地下带/分流器等非 1×1 带子在原位置直接替换为 type（对齐《异星工厂》覆盖升级）
function overwriteBeltTile(tx, ty, type, infinite) {
  const old = entAt(tx, ty);
  if (!old) return;
  const oldType = old.type;
  if (oldType === type) return;
  const dir = old.dir;
  const items = old.items ? old.items.map(o => ({ item: o.item, pos: o.pos })) : [];
  const outp = old.outp ? JSON.parse(JSON.stringify(old.outp)) : null;
  if (!infinite && tierNext(oldType) === type && invCount(type) < 1) {
    toast('背包里没有' + ITEMS[type].name);
    return;
  }
  removeEnt(old);
  const cls = ENT_CLASSES[type];
  const ne = new cls(type, tx, ty);
  ne.dir = dir;
  ne.applyDir();
  if (ne.items) ne.items = items;
  if (ne.outp && outp) ne.outp = outp;
  addEnt(ne);
  if (!infinite) {
    if (tierNext(oldType) === type) invTake(type, 1);
    else invAdd(oldType, 1);
  }
  if (G.panelEnt === old) closePanel();
  toast('已' + (tierNext(oldType) === type ? '升级' : '降级') + '为 ' + ITEMS[type].name);
  uiDirty = true;
  refreshHotbar();
}

// 传送带类型 → 对应的地下传送带类型
const BELT_TO_UG = {
  'transport-belt': 'underground',
  'fast-transport-belt': 'fast-underground-belt',
  'express-transport-belt': 'express-underground-belt'
};

function ugMaxDist(ugType) {
  return ugType === 'fast-underground-belt' ? FAST_UNDERGROUND_MAX
    : ugType === 'express-underground-belt' ? EXPRESS_UNDERGROUND_MAX
    : UNDERGROUND_MAX;
}

// 障碍本身是同向传送带时，直接铺设普通传送带衔接（替换原传送带），无需地下带跨越。
// 返回 true 表示已成功铺设；否则返回 false 交由地下带逻辑处理。
function tryPlaceOntoSameDirBelt(type, tx, ty) {
  const t = entAt(tx, ty);
  // 必须是普通传送带（含快速/极速带，非分流器/地下带），且方向与当前铺设方向一致
  if (!(t instanceof Belt) || t instanceof Splitter || t instanceof Underground) return false;
  if (t.dir !== G.ghostDir) return false;
  const infinite = !!(G.dbg && G.dbg.infinite);
  if (!infinite && invCount(type) < 1) return false;
  // 同向传送带衔接：用当前传送带替换掉已有传送带，无需消耗地下带
  removeEnt(t);
  const e = new (ENT_CLASSES[type])(type, tx, ty);
  e.dir = G.ghostDir;
  e.applyDir();
  addEnt(e);
  if (!infinite) invTake(type, 1);
  refreshHotbar();
  return true;
}

// 拖动铺传送带遇障碍时自动搭一对地下传送带跨越：入口放在障碍前一格，
// 出口放在障碍之后第一个能放置的格子（不超过同档地下带的最大跨距）。
function tryAutoUnderground(type, tx, ty) {
  const ugType = BELT_TO_UG[type];
  if (!ugType) return false;              // 非传送带不触发
  if (entAt(tx, ty) instanceof Underground) return false; // 当前格已有地下带，不再生成
  const infinite = !!(G.dbg && G.dbg.infinite);
  const dir = G.ghostDir;
  const maxDist = ugMaxDist(ugType);

  // 入口位置：障碍前（沿铺设方向）一格
  const ex = tx - DX[dir], ey = ty - DY[dir];
  let replaced = null;
  let entOk = canPlaceAt(ugType, ex, ey, dir).ok;
  if (!entOk) {
    const t = entAt(ex, ey);
    if (t instanceof Belt && !(t instanceof Underground)) { replaced = t; entOk = true; }
    else return false;
  }
  if (!entOk) return false;

  // 出口位置：沿方向扫描障碍之后第一个可放置格
  let ox = null, oy = null;
  for (let k = 1; k <= maxDist; k++) {
    const px2 = tx + DX[dir] * k, py2 = ty + DY[dir] * k;
    if (canPlaceAt(ugType, px2, py2, dir).ok) { ox = px2; oy = py2; break; }
  }
  if (ox === null) return false;

  // 物资：优先扣地下带，不足则用普通传送带兜底（方便拖动时无缝跨越）
  if (!infinite) {
    if (invCount(ugType) >= 2) invTake(ugType, 2);
    else if (invCount(type) >= 2) invTake(type, 2);
    else return false;
    if (replaced) invAdd(type, 1);        // 归还被替换成入口的那条传送带
  }

  if (replaced) removeEnt(replaced);
  const ugIn = new (ENT_CLASSES[ugType])(ugType, ex, ey);
  ugIn.dir = dir; ugIn.applyDir(); addEnt(ugIn);
  const ugOut = new (ENT_CLASSES[ugType])(ugType, ox, oy);
  ugOut.dir = dir; ugOut.applyDir(); addEnt(ugOut);
  refreshHotbar();
  return true;
}

function deconstructAt(tx, ty) {
  const e = entAt(tx, ty);
  if (!e || !withinReach(tx, ty)) return;
  for (const [id, n] of e.contents()) invAdd(id, n);
  removeEnt(e);
  if (G.panelEnt === e) closePanel();
  uiDirty = true;
}

// ===== 蓝图 / 红图：框选一整块进行复制粘贴或删除 =====
function toggleBlueprint(mode) {
  // 再次点击同按钮取消框选
  if (G.blueMode === mode) { cancelBlueprint(); return; }
  if (G.blueMode === 'paste' && mode === 'blue') {
    // 蓝图粘贴中再点蓝图：视为取消粘贴并重新框选
    G.blueMode = 'blue';
    G.blueStart = null; G.blueEnd = null;
    toast('蓝图模式：拖拽框选要复制的区域');
    return;
  }
  G.blueMode = mode;
  G.blueStart = null; G.blueEnd = null;
  G.greenAction = null;
  G.sel = -1; G.quickSel = null; refreshHotbar();
  toast(mode === 'blue'
    ? '蓝图模式：拖拽框选要复制的区域，松开后点击空白处粘贴'
    : mode === 'red'
      ? '红图模式：拖拽框选要删除的区域，松开即删除整块'
      : '绿图模式：拖拽框选要升级/降级的区域，松开后选择升级或降级');
}

function cancelBlueprint() {
  G.blueMode = null;
  G.blueStart = null; G.blueEnd = null;
  G.greenRect = null; G.greenAction = null;
  hideGreenBar();
  refreshHotbar();
}

// 框选矩形（瓦片坐标，规范化左上/右下）
function blueRect() {
  if (!G.blueStart || !G.blueEnd) return null;
  return {
    x0: Math.min(G.blueStart.tx, G.blueEnd.tx),
    y0: Math.min(G.blueStart.ty, G.blueEnd.ty),
    x1: Math.max(G.blueStart.tx, G.blueEnd.tx),
    y1: Math.max(G.blueStart.ty, G.blueEnd.ty)
  };
}

// 红图：删除矩形区域内所有实体（含内部物资返还，跨区域不重复）
function applyRedBlueprint() {
  const r = blueRect();
  if (!r) return;
  const seen = new Set();
  let count = 0;
  for (let ty = r.y0; ty <= r.y1; ty++) {
    for (let tx = r.x0; tx <= r.x1; tx++) {
      const e = entAt(tx, ty);
      if (!e || seen.has(e)) continue;
      seen.add(e);
      // 若实体中心在区域内才整体删除（避免误删部分在框内的巨型设备）
      const cx = e.x + Math.floor(e.w / 2), cy = e.y + Math.floor(e.h / 2);
      if (cx >= r.x0 && cx <= r.x1 && cy >= r.y0 && cy <= r.y1) {
        for (const [id, n] of e.contents()) invAdd(id, n);
        removeEnt(e);
        if (G.panelEnt === e) closePanel();
        count++;
      }
    }
  }
  // 保持红图模式，仅重置框选范围，便于继续框选删除
  G.blueStart = null; G.blueEnd = null;
  toast('红图：已删除 ' + count + ' 个建筑（物资已返还背包），可继续框选');
  uiDirty = true;
}

// 绿图：框选完成后，记录区域并弹出升级/降级操作栏，由用户选择后批量升级/降级
function applyGreenBlueprint() {
  const r = blueRect();
  if (!r) return;
  // 统计区域内可升级/降级的同族物流数量，供操作栏显示
  const stats = greenAreaStats(r);
  if (!stats.total) {
    G.blueStart = null; G.blueEnd = null;
    toast('框选区域内没有可升级/降级的传送带或组装机');
    return;
  }
  G.greenRect = r;
  G.greenAction = null;
  // 保持绿图模式，展示操作栏，便于继续框选
  showGreenBar(r, stats);
}

// 统计矩形区域内可升级（有更高阶）/可降级（有更低阶）的传送带与组装机数量
function greenAreaStats(r) {
  const seen = new Set();
  let up = 0, down = 0, total = 0;
  for (let ty = r.y0; ty <= r.y1; ty++) {
    for (let tx = r.x0; tx <= r.x1; tx++) {
      const e = entAt(tx, ty);
      if (!e || seen.has(e)) continue;
      seen.add(e);
      const cx = e.x + Math.floor(e.w / 2), cy = e.y + Math.floor(e.h / 2);
      if (cx < r.x0 || cx > r.x1 || cy < r.y0 || cy > r.y1) continue;
      if (!tierFamily(e.type)) continue;
      total++;
      if (tierNext(e.type)) up++;
      if (tierPrev(e.type)) down++;
    }
  }
  return { up, down, total };
}

// 显示绿图操作栏（升级/降级/取消）
function showGreenBar(r, stats) {
  const bar = document.getElementById('greenbar');
  if (!bar) return;
  const w = (r.x1 - r.x0 + 1), h = (r.y1 - r.y0 + 1);
  bar.innerHTML =
    '<span class="gb-t">绿图 ' + w + '×' + h + '：可升级 ' + stats.up + ' · 可降级 ' + stats.down + '</span>' +
    '<button data-gact="upgrade">⬆ 一键升级</button>' +
    '<button data-gact="downgrade">⬇ 一键降级</button>' +
    '<button data-gact="cancel">取消</button>';
  bar.style.display = 'flex';
}

function hideGreenBar() {
  const bar = document.getElementById('greenbar');
  if (bar) bar.style.display = 'none';
}

// 执行绿图升级/降级：作用于上次框选的 greenRect 内所有同族带子
function greenAreaAction(action) {
  const r = G.greenRect;
  if (!r) return;
  const infinite = !!(G.dbg && G.dbg.infinite);
  let changed = 0;
  const seen = new Set();
  for (let ty = r.y0; ty <= r.y1; ty++) {
    for (let tx = r.x0; tx <= r.x1; tx++) {
      const e = entAt(tx, ty);
      if (!e || seen.has(e)) continue;
      seen.add(e);
      const cx = e.x + Math.floor(e.w / 2), cy = e.y + Math.floor(e.h / 2);
      if (cx < r.x0 || cx > r.x1 || cy < r.y0 || cy > r.y1) continue;
      if (!tierFamily(e.type)) continue;
      const target = action === 'upgrade' ? tierNext(e.type) : tierPrev(e.type);
      if (!target) continue;
      if (!infinite && action === 'upgrade' && invCount(target) < 1) continue;   // 升级需有对应新带
      const dir = e.dir;
      const items = e.items ? e.items.map(o => ({ item: o.item, pos: o.pos })) : [];
      // 带内部状态（如组装机的配方/输入输出/进度）的实体：序列化后改 type 再还原，保留全部状态
      const st = e.serialize ? e.serialize() : null;
      removeEnt(e);
      const cls = ENT_CLASSES[target];
      let ne;
      if (st && st.recipe !== undefined && typeof cls.restore === 'function') {
        st.type = target;
        ne = cls.restore(st);
      } else {
        ne = new cls(target, e.x, e.y);
        ne.dir = dir;
        ne.applyDir();
        if (ne.items) ne.items = items;
      }
      addEnt(ne);
      if (!infinite) {
        if (action === 'upgrade') invTake(target, 1);
        else invAdd(e.type, 1);
      }
      changed++;
    }
  }
  if (G.panelEnt && !G.ents.includes(G.panelEnt)) closePanel();
  toast('绿图已' + (action === 'upgrade' ? '升级' : '降级') + ' ' + changed + ' 个传送带/组装机');
  uiDirty = true;
}

// 蓝图：复制矩形区域内实体（相对坐标 + 完整配置）
function captureBlueprint() {
  const r = blueRect();
  if (!r) return;
  const ents = [];
  const seen = new Set();
  for (let ty = r.y0; ty <= r.y1; ty++) {
    for (let tx = r.x0; tx <= r.x1; tx++) {
      const e = entAt(tx, ty);
      if (!e || seen.has(e)) continue;
      seen.add(e);
      const cx = e.x + Math.floor(e.w / 2), cy = e.y + Math.floor(e.h / 2);
      if (cx < r.x0 || cx > r.x1 || cy < r.y0 || cy > r.y1) continue;
      ents.push(e.serialize());
    }
  }
  if (!ents.length) { toast('框选区域没有可复制的建筑'); return; }
  G.blueprint = { minX: r.x0, minY: r.y0, ents };
  G.blueMode = 'paste';
  G.blueStart = null; G.blueEnd = null;
  toast('蓝图已复制 ' + ents.length + ' 个建筑，点击空白处粘贴（右键取消）');
}

// 粘贴蓝图到鼠标所指位置
function pasteBlueprint() {
  if (!G.blueprint || !G.cursorTile) return;
  const bp = G.blueprint;
  const ox = G.cursorTile.tx - bp.minX;
  const oy = G.cursorTile.ty - bp.minY;
  // 先校验所有目标位置是否可放置，再一次性放置
  const placements = [];
  for (const s of bp.ents) {
    const cls = ENT_CLASSES[s.type];
    if (!cls) continue;
    const nx = s.x + ox, ny = s.y + oy;
    const tmp = cls.restore(Object.assign({}, s, { x: nx, y: ny }));
    tmp.dir = s.dir | 0; tmp.applyDir();
    if (!canPlaceAt(s.type, nx, ny, tmp.dir)) {
      toast('粘贴失败：区域被占用或不可放置');
      return;
    }
    placements.push({ cls, s, nx, ny });
  }
  for (const p of placements) {
    const e = p.cls.restore(Object.assign({}, p.s, { x: p.nx, y: p.ny }));
    e.dir = p.s.dir | 0; e.applyDir();
    addEnt(e);
  }
  toast('蓝图已粘贴 ' + placements.length + ' 个建筑（可继续点击空白处粘贴，右键取消）');
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
  const got = e.takeItem();
  if (!got) {
    if (e instanceof Belt) toast('这条传送带上没有物品');
    return;
  }
  invAdd(got);
  uiDirty = true;
}

function copySettings(e) {
  if (!e) return;
  const s = { type: e.type, dir: e.dir };
  if (typeof e.setRecipe === 'function') s.recipe = e.recipe;
  G.clipboard = s;
  toast('已复制 ' + ITEMS[e.type].name + ' 配置（Shift+左键粘贴到同类）');
}

function pasteSettings(e) {
  if (!e || !G.clipboard) return;
  const c = G.clipboard;
  if (e.type !== c.type) { toast('类型不匹配：剪贴板是' + ITEMS[c.type].name); return; }
  if (c.dir === undefined) return;
  if (BUILD_DEFS[e.type] && BUILD_DEFS[e.type].rotSwap) {
    // 抽水机旋转后脚印变化，需重新校验仍压水面
    if (e.type === 'offshore-pump' && !pumpCanFace(e, c.dir)) { toast('无法粘贴：抽水机必须仍压在水面上'); return; }
    removeEnt(e); e.dir = c.dir; e.applyDir(); addEnt(e);
  }
  else { e.dir = c.dir; }
  if (c.recipe && typeof e.setRecipe === 'function') e.setRecipe(c.recipe);
  uiDirty = true;
  toast('配置已粘贴');
}

function rotateAction() {
  if (G.cursorTile && withinReach(G.cursorTile.tx, G.cursorTile.ty)) {
    const e = entAt(G.cursorTile.tx, G.cursorTile.ty);
    if (e && BUILD_DEFS[e.type]) {
      // 非方形设备（分流器类）：旋转后脚印变化，需重挂网格
      if (BUILD_DEFS[e.type].rotSwap) {
        const nd = (e.dir + 1) % 4;
        // 抽水机必须始终压在水面上，旋转后脚印变化需重新校验
        if (e.type === 'offshore-pump' && !pumpCanFace(e, nd)) { toast('抽水机无法朝该方向旋转：必须仍压在水面上'); return; }
        removeEnt(e);
        e.dir = nd;
        e.applyDir();
        addEnt(e);
        uiDirty = true;
        return;
      }
      // 有朝向的设备：直接旋转（采矿机转完立即尝试朝新方向输出）
      if (DEVICE_DIR_ROTATE[e.type]) {
        e.dir = (e.dir + 1) % 4;
        // 传送带方向变化会改变其输入侧判定，失效附近缓存
        invalidateBeltInputNear(e.x, e.y, e.w, e.h);
        if (typeof e.onRotate === 'function') e.onRotate();
        uiDirty = true;
        return;
      }
    }
  }
  G.ghostDir = (G.ghostDir + 1) % 4;
}

// 翻转方向：h=水平翻转（左右镜像，东西互兑），v=垂直翻转（上下镜像，南北互兑）
// 方向 0东 1南 2西 3北。水平翻转交换 0<->2；垂直翻转交换 1<->3，另一轴方向保持不变。
function flipDir(dir, axis) {
  if (axis === 'h') return dir === 0 ? 2 : dir === 2 ? 0 : dir;
  return dir === 1 ? 3 : dir === 3 ? 1 : dir;
}

function flipAction(axis) {
  if (G.cursorTile && withinReach(G.cursorTile.tx, G.cursorTile.ty)) {
    const e = entAt(G.cursorTile.tx, G.cursorTile.ty);
    if (e && BUILD_DEFS[e.type]) {
      // 非方形设备（分流器类）：翻转后脚印变化，需重挂网格
      if (BUILD_DEFS[e.type].rotSwap) {
        const nd = flipDir(e.dir, axis);
        // 抽水机必须始终压在水面上，翻转后脚印变化需重新校验
        if (e.type === 'offshore-pump' && !pumpCanFace(e, nd)) { toast('抽水机无法朝该方向翻转：必须仍压在水面上'); return; }
        removeEnt(e);
        e.dir = nd;
        e.applyDir();
        addEnt(e);
        uiDirty = true;
        return;
      }
      // 有朝向的设备：直接翻转
      if (DEVICE_DIR_ROTATE[e.type]) {
        e.dir = flipDir(e.dir, axis);
        if (typeof e.onRotate === 'function') e.onRotate();
        uiDirty = true;
        return;
      }
    }
  }
  // 没有可翻转的已放置设备时，翻转幽灵/预览方向
  G.ghostDir = flipDir(G.ghostDir, axis);
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
    // 按 Alt 时不立即切换详情，仅阻止浏览器菜单；松开（keyup）时才切换
    if (k === 'alt') {
      ev.preventDefault();
      return;
    }
    if (k >= '1' && k <= '9') selectSlot(+k - 1);
    else if (k === '0') selectSlot(9);
    else if (k === 'tab') { ev.preventDefault(); G.panelMode === 'inv' ? closePanel() : openPanel('inv'); }
    else if ((k === 'delete' || k === 'backspace') && G.panelMode === 'machine' &&
             G.panelEnt && typeof G.panelEnt.setRecipe === 'function' && G.panelEnt.recipe) {
      G.panelEnt.setRecipe(null);
      renderPanel(false);
      toast('配方已清除');
    }
    else if (k === 'r') rotateAction();
    else if (k === 'h') flipAction('h');
    else if (k === 'v') flipAction('v');
    else if (k === 'f') pickupAction();
    else if (k === 'e') G.panelMode === 'inv' ? closePanel() : openPanel('inv');
    else if (k === 't') G.panelMode === 'tech' ? closePanel() : openPanel('tech');
    else if (k === 'o') G.panelMode === 'set' ? closePanel() : openPanel('set');
    else if (k === 'k') saveGame();
    else if (k === 'l') loadGame();
    else if (k === 'escape' || k === 'q') {
      if (G.blueMode) {
        cancelBlueprint();
      } else if (G.panelMode) {
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
  window.addEventListener('keyup', ev => {
    const k = ev.key.toLowerCase();
    // 松开 Alt 才切换显示详情（对齐《异星工厂》），并避免浏览器菜单抢焦点
    if (k === 'alt') {
      ev.preventDefault();
      G.showDetails = !G.showDetails;
      uiDirty = true;
    }
    G.keys[k] = false;
  });

  G.canvas.addEventListener('mousemove', ev => {
    updateCursorTile(ev.clientX, ev.clientY);
    if (G.blueSelecting && G.cursorTile) {
      G.blueEnd = { tx: G.cursorTile.tx, ty: G.cursorTile.ty };
    }
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
    if (ev.button !== 0) return;
    G.mouseDown = false;
    // 蓝图/红图：松开鼠标完成框选
    if (G.blueSelecting) {
      G.blueSelecting = false;
      if (!G.blueStart || !G.blueEnd) { cancelBlueprint(); return; }
      if (G.blueMode === 'blue') captureBlueprint();
      else if (G.blueMode === 'red') applyRedBlueprint();
      else if (G.blueMode === 'green') applyGreenBlueprint();
    }
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
    if (G.blueMode) return;   // 蓝图/红图模式下不触发面板
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
  // 打开设置面板时暂停游戏：世界/设备/电力/玩家均停，仅保留渲染与界面
  const paused = G.panelMode === 'set';
  if (!paused) G.time += dt;
  fpsSmooth += (1 / Math.max(raw, 0.0001) - fpsSmooth) * 0.05;
  if (G.settings.autoSave) {
    G.autoT += raw;
    if (G.autoT >= 60) { G.autoT = 0; saveGame(); toast('自动保存完成'); }
  }

  try {
    if (!paused) {
      updatePlayer(dt);
      updateHeldMouse(dt);
      updateMining(dt);
      for (const e of G.ents) e.update(dt);
      // 敌人/子弹系统（可在设置中开关战斗）
      if (G.settings.combat) {
        spawnEnemies(dt);
        updateEnemies(dt);
        updateBullets(dt);
      }
      G.powerT += dt;
      if (G.powerT >= 0.25) { G.powerT = 0; updatePower(); }
      updateCamera(dt);
    }

    render();

    if (uiDirty || G.time - lastPanelCheck > 0.25) {
      lastPanelCheck = G.time;
      refreshHotbar();
      if (G.panelMode === 'machine') updateMachineLive();
      if (G.panelMode === 'stats') updateStatsLive();
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
  toast('WASD 移动 · 左键挖矿/放建筑(覆盖建造) · 右键拆除 · R 旋转 · F 拿取 · Q 取消/拾取朝向 · 中键/E 面板 · T 科技 · K/L 存读档');
}
window.addEventListener('load', boot);
if (document.readyState === 'complete') setTimeout(boot, 0);
