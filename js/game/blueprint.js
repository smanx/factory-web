'use strict';

// ===== 框选模式的白色十字光标 =====
// 按下 Ctrl+C / Ctrl+X / Alt+B（以及 Alt+D 红图 / Alt+U 绿图）进入框选时，
// 把地图画布的十字光标换成白色（系统默认 crosshair 为黑色，深色地面/夜间不明显）；
// 退出框选或转入蓝图粘贴模式时还原默认光标。
// 用内联 SVG 画十字：横竖细线贯穿到中心相交（中间不留空且不额外加粗），
// 白色主线条 + 半透明深色描边衬底，亮色地面（混凝土等）上也可见。
const BP_CURSOR_WHITE = 'url("data:image/svg+xml;utf8,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2724%27 height=%2724%27%3E%3Cg fill=%27none%27 stroke=%27rgba(0,0,0,0.55)%27 stroke-width=%273.2%27 stroke-linecap=%27round%27%3E%3Cline x1=%2712%27 y1=%272%27 x2=%2712%27 y2=%2722%27/%3E%3Cline x1=%272%27 y1=%2712%27 x2=%2722%27 y2=%2712%27/%3E%3C/g%3E%3Cg fill=%27none%27 stroke=%27white%27 stroke-width=%271.8%27 stroke-linecap=%27round%27%3E%3Cline x1=%2712%27 y1=%272%27 x2=%2712%27 y2=%2722%27/%3E%3Cline x1=%272%27 y1=%2712%27 x2=%2722%27 y2=%2712%27/%3E%3C/g%3E%3C/svg%3E") 12 12, crosshair';

// 按当前框选状态同步地图画布光标：框选类模式用白色十字，其余还原 CSS 默认。
function syncBlueprintCursor() {
  const c = document.getElementById('game');
  if (!c) return;
  c.style.cursor = (G.blueMode && G.blueMode !== 'paste') ? BP_CURSOR_WHITE : '';
}

// ===== 蓝图 / 红图：框选一整块进行复制粘贴或删除 =====
function toggleBlueprint(mode) {
  // 进入蓝图/红图/绿图模式时退出拆除模式，避免左键行为冲突
  if (!G.blueMode && G.deconstructMode) toggleDeconstructMode(false);
  // 再次点击同按钮取消框选
  if (G.blueMode === mode) { cancelBlueprint(); return; }
  if (G.blueMode === 'paste' && (mode === 'blue' || mode === 'bluecreate')) {
    // 蓝图粘贴中再点蓝图：退出蓝图模式（保留已复制的蓝图数据可再次粘贴）
    cancelBlueprint();
    return;
  }
  G.blueMode = mode;
  G.blueStart = null; G.blueEnd = null;
  G.greenAction = null;
  G.sel = -1; G.quickSel = null; refreshHotbar();
  toast(mode === 'blue'
    ? '蓝图模式：拖拽框选要复制的区域，松开后点击空白处粘贴'
    : mode === 'bluecreate'
      ? '创建蓝图：拖拽框选一片建筑，松开后弹出蓝图编辑界面'
      : mode === 'cut'
        ? '剪切模式：拖拽框选要剪切的区域，松开后复制为蓝图并拆除原建筑'
        : mode === 'red'
          ? '红图模式：拖拽框选要删除的区域，松开即删除整块'
          : '绿图模式：拖拽框选要升级/降级的区域，松开后选择升级或降级');
  syncBlueprintCursor();
}

function cancelBlueprint() {
  G.blueMode = null;
  G.blueStart = null; G.blueEnd = null;
  G.blueRot = 0; G.blueFlipH = false; G.blueFlipV = false;
  G.greenRect = null; G.greenAction = null;
  hideGreenBar();
  syncBlueprintCursor();
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

// 红图：把框选区域内所有实体登记为“拆除标记”（红叉），由施工机器人自动拆除。
// 与是否装备机器人无关：未装备个人机器人港时标记作为规划标记保留在图上，
// 装备机器人港 + 背包有施工机器人后，机器人进入范围即自动处理（见 updateConstruction）。
// 不再提供“直接删除”确认弹窗（对齐《异星工厂》：红图只打拆除标记，不直接拆）。
function applyRedBlueprint() {
  const r = blueRect();
  if (!r) return;
  // 一律登记为拆除标记（红叉）
  const n = (typeof markAreaForDecon === 'function') ? markAreaForDecon(r) : 0;
  // 红图同时抹除区域内所有“建造虚影”（虚影是规划标记，无需机器人，直接清除）
  const ng = (typeof removeGhostsInRect === 'function') ? removeGhostsInRect(r) : 0;
  G.blueStart = null; G.blueEnd = null;
  const msg = [];
  if (n > 0) msg.push('已标记 ' + n + ' 个建筑待拆除' + (constrPending().decon > 0 ? '（剩 ' + constrPending().decon + ' 个待拆）' : ''));
  if (ng > 0) msg.push('已清除 ' + ng + ' 个建造虚影');
  toast(msg.length ? msg.join('；') : '区域内没有可拆除的建筑或虚影');
  uiDirty = true;
}

// 执行红图删除（确认后调用）：删除矩形区域内所有实体（含内部物资返还，跨区域不重复）
function doRedBlueprintDelete(r) {
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
  // 同时抹除区域内所有“建造虚影”（虚影是规划标记，无需机器人，直接清除）
  const ng = (typeof removeGhostsInRect === 'function') ? removeGhostsInRect(r) : 0;
  // 保持红图模式，仅重置框选范围，便于继续框选删除
  G.blueStart = null; G.blueEnd = null;
  toast('红图：已删除 ' + count + ' 个建筑' + (ng ? '、清除 ' + ng + ' 个建造虚影' : '') + '（物资已返还背包），可继续框选');
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

// 统计矩形区域内可升级（有更高阶）/可降级（有更低阶）的传送带与组装机数量。
// filter 可选：传入勾选集合 { type: true } 时仅统计勾选的物品类型（未传统计全部）。
function greenAreaStats(r, filter) {
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
      if (filter && !filter[e.type]) continue;
      total++;
      if (tierNext(e.type)) up++;
      if (tierPrev(e.type)) down++;
    }
  }
  return { up, down, total };
}

// 收集矩形区域内可升级/降级物品的类型及其数量（用于绿图筛选勾选）。
// 返回 { type: { count, up, down } }，up/down 表示该类型是否可升/可降。
function greenAreaTypes(r) {
  const seen = new Set();
  const map = {};
  for (let ty = r.y0; ty <= r.y1; ty++) {
    for (let tx = r.x0; tx <= r.x1; tx++) {
      const e = entAt(tx, ty);
      if (!e || seen.has(e)) continue;
      seen.add(e);
      const cx = e.x + Math.floor(e.w / 2), cy = e.y + Math.floor(e.h / 2);
      if (cx < r.x0 || cx > r.x1 || cy < r.y0 || cy > r.y1) continue;
      if (!tierFamily(e.type)) continue;
      if (!map[e.type]) map[e.type] = { count: 0, up: 0, down: 0 };
      map[e.type].count++;
      if (tierNext(e.type)) map[e.type].up++;
      if (tierPrev(e.type)) map[e.type].down++;
    }
  }
  return map;
}

// 升级链排列顺序（对齐数据定义顺序）：传送带 → 地下传送带 → 分流器 → 组装机，链内按阶级排序
const GREEN_CHAIN_ORDER = [BELT_TIERS, UNDERGROUND_TIERS, SPLITTER_TIERS, ASSEMBLER_TIERS];
function greenTypeOrder(a, b) {
  const fa = TIER_FAMILY[a], fb = TIER_FAMILY[b];
  const oa = fa ? GREEN_CHAIN_ORDER.indexOf(fa) : 99, ob = fb ? GREEN_CHAIN_ORDER.indexOf(fb) : 99;
  if (oa !== ob) return oa - ob;
  return fa.indexOf(a) - fb.indexOf(b);
}

// 显示绿图操作栏（升级/降级/取消）。
// 区域内可能出现多种物品类型，提供筛选勾选：仅处理勾选的类型，默认全选。
function showGreenBar(r, stats) {
  const bar = document.getElementById('greenbar');
  if (!bar) return;
  const w = (r.x1 - r.x0 + 1), h = (r.y1 - r.y0 + 1);
  const types = greenAreaTypes(r);
  // 筛选集合：记录每个勾选的物品类型（默认全选，仅处理勾选类型）
  G.greenFilter = {};
  for (const t in types) G.greenFilter[t] = true;
  let flt = '';
  const order = Object.keys(types).sort(greenTypeOrder);
  if (order.length) {
    flt = '<span class="gb-flt">仅处理：</span>';
    for (const t of order) {
      const it = ITEMS[t];
      flt += '<label class="gb-item"><input type="checkbox" data-gtype="' + t + '" checked><span>' +
             (it ? it.name : t) + ' ×' + types[t].count + '</span></label>';
    }
  }
  bar.innerHTML =
    '<span class="gb-t">绿图 ' + w + '×' + h + '：可升级 ' + stats.up + ' · 可降级 ' + stats.down + '</span>' +
    (flt ? '<span class="gb-sep"></span>' + flt : '') +
    '<button data-gact="upgrade">⬆ 一键升级</button>' +
    '<button data-gact="downgrade">⬇ 一键降级</button>' +
    '<button data-gact="cancel">取消</button>';
  bar.style.display = 'flex';
}

function hideGreenBar() {
  const bar = document.getElementById('greenbar');
  if (bar) bar.style.display = 'none';
}

// 执行绿图升级/降级：作用于上次框选的 greenRect 内勾选（greenFilter）的同族带子
function greenAreaAction(action) {
  const r = G.greenRect;
  if (!r) return;
  const infinite = !!(G.dbg && G.dbg.infinite);
  const filter = G.greenFilter;
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
      if (filter && !filter[e.type]) continue;   // 仅处理筛选勾选的物品类型
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
        // 分流器升级/降级时保留可编程分离器的过滤配置（对齐《异星工厂》Programmable splitter）
        if (st && st.filter && typeof Splitter !== 'undefined' && ne instanceof Splitter) {
          ne.filter = st.filter;
        }
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

// 收集矩形区域内的“建造虚影”为蓝图实体（复制/剪切/Alt+B 均含虚影，使虚影可随蓝图再粘贴）。
// 以虚影中心是否落在区域内判定（与实体复制同口径）；记录绝对瓦片坐标，供 blueprintBounds 统一归一。
function collectGhostEnts(r, ents) {
  if (!Array.isArray(G.constrGhosts)) return 0;
  let count = 0;
  for (const g of G.constrGhosts) {
    if (g._dead) continue;
    const fp = blueprintFootprint(g);
    const cx = g.x + fp.w / 2, cy = g.y + fp.h / 2;
    if (cx < r.x0 || cx > r.x1 || cy < r.y0 || cy > r.y1) continue;
    const s = { type: g.type, x: g.x, y: g.y, dir: g.dir | 0, mirror: g.mirror | 0 };
    if (g.quality) s.quality = g.quality;
    if (g.recipe) s.recipe = g.recipe;   // 保留组装机配方等配置，粘贴后的虚影/实体沿用
    ents.push(s);
    count++;
  }
  return count;
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
      // 仅复制建筑本身，不含内部原料/输出/燃料/流体及传送带物品
      ents.push(e.blueprint());
    }
  }
  collectGhostEnts(r, ents);   // 复制时一并纳入区域内的建造虚影
  if (!ents.length) { toast('框选区域没有可复制的建筑'); return; }
  // 蓝图含地面铺装（混凝土/石砖路/填海料等，对齐《异星工厂》：蓝图会记录地砖）
  const TILE_IDS = { '2': 'concrete', '3': 'stone-path', '5': 'refined-concrete', '6': 'hazard-concrete', '8': 'refined-hazard-concrete', '12': 'ice-platform', '13': 'foundation', '14': 'space-platform-foundation' };
  const tiles = [];
  for (let ty = r.y0; ty <= r.y1; ty++) {
    for (let tx = r.x0; tx <= r.x1; tx++) {
      const t = getTerrain(tx, ty);
      const tid = TILE_IDS[t];
      if (!tid) continue;
      tiles.push({ type: tid, x: tx, y: ty });
    }
  }
  G.blueprint = { minX: r.x0, minY: r.y0, ents, tiles: tiles.length ? tiles : [] };
  // 自动存入蓝图库（去重：与已有蓝图内容相同则不重复添加）
  if (typeof blueBookAdd === 'function') blueBookAdd(G.blueprint);
  if (typeof playSfx === 'function') playSfx('blueprint');
  G.blueMode = 'paste';
  syncBlueprintCursor();
  G.blueStart = null; G.blueEnd = null;
  G.blueRot = 0; G.blueFlipH = false; G.blueFlipV = false;
  toast('蓝图已复制 ' + ents.length + ' 个建筑，点击空白处粘贴（R旋转，V/H翻转，右键取消）');
}

// 当前是否「手持蓝图物品」：选中的是蓝图物品（blueprint / blueprint#n）且蓝图内容非空。
// 用于把 R/V/H 变换、放置幽灵等交互覆盖到「已选中蓝图但还没点击地图」这一阶段
// （此时尚未进入 paste 模式，G.blueMode 仍是 null）。
function isBlueprintHeld() {
  if (typeof selItem !== 'function') return false;
  const t = selItem();
  if (!t || !isBlueprintItem(t)) return false;
  const bp = bpDataOfItem(t);
  return !!(bp && bp.ents && bp.ents.length);
}

// ===== 手持蓝图物品的地图放置幽灵 =====
// 选中蓝图物品（blueprint / blueprint#n）且鼠标悬停在地图上时，实时预览蓝图内容：
// 与粘贴模式（drawBlueprintOverlay）同款渲染——变换后的每个建筑绘制半透明实体幽灵，
// 附带绿/红可放置性覆盖框。返回 true 表示本帧已处理幽灵绘制（调用方跳过默认图标幽灵）。
function drawBlueprintItemGhost(g) {
  if (!G || !G.cursorTile || typeof selItem !== 'function') return false;
  const type = selItem();
  if (!isBlueprintItem(type)) return false;
  // 已进入粘贴模式时，蓝图预览由 drawBlueprintOverlay 在主画布上绘制；
  // 这里再画一份会与它重复叠加（两份半透明幽灵叠加显得更实、且颜色加重）。
  if (G.blueMode === 'paste' && G.blueprint) return true;
  if (!mouseOverMap()) return true;   // 手持蓝图但鼠标在 UI 上：不绘制，避免与图标幽灵叠加
  const bp = bpDataOfItem(type);
  if (!bp || !bp.ents || !bp.ents.length) return true;   // 空蓝图：不显示预览
  // 以背包蓝图数据构造临时粘贴缓冲（不改动 G.blueprint，避免影响当前粘贴状态）
  const tmpBp = { name: bp.name, minX: bp.minX, minY: bp.minY, ents: bp.ents, tiles: bp.tiles };
  const savedBp = G.blueprint, savedMode = G.blueMode;
  G.blueprint = tmpBp;
  // 绘制目标为顶层幽灵画布（#ghost-layer）时它是屏幕坐标系，必须先叠加与主画布一致的
  // 相机变换再画世界坐标，否则蓝图会被画到画布左上角/视口外——表现就是「手持蓝图移到
  // 地图上什么幽灵都看不到」。主画布分支（render.js 里已 save+translate/scale）不要重复变换。
  const worlded = (typeof ghostWorldTransform === 'function') ? ghostWorldTransform(g) : false;
  try {
    drawBlueprintGhostAt(g, G.cursorTile.tx, G.cursorTile.ty);
  } finally {
    if (worlded) g.restore();
    G.blueprint = savedBp;
    G.blueMode = savedMode;
  }
  return true;
}

// ===== 蓝图变换（粘贴时 R 旋转 / V、H 翻转，对齐《异星工厂》）=====
// 计算实体在蓝图中占用的宽高（rotSwap 设备随朝向交换宽高）
function blueprintFootprint(s) {
  const def = BUILD_DEFS[s.type];
  if (!def) return { w: 1, h: 1 };
  if (def.rotSwap && (s.dir & 1)) return { w: def.h, h: def.w };
  return { w: def.w, h: def.h };
}

// 蓝图包围盒（含各实体占用范围）
function blueprintBounds(ents) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const s of ents) {
    const fp = blueprintFootprint(s);
    minX = Math.min(minX, s.x);
    minY = Math.min(minY, s.y);
    maxX = Math.max(maxX, s.x + fp.w - 1);
    maxY = Math.max(maxY, s.y + fp.h - 1);
  }
  return { minX, minY, maxX, maxY, W: maxX - minX + 1, H: maxY - minY + 1 };
}

// 顺时针旋转蓝图 90°：以包围盒几何中心为轴，左上角锚点旋转，实体朝向 +1
function rotateEnts90(ents) {
  const bb = blueprintBounds(ents);
  const cx = bb.minX + bb.W / 2, cy = bb.minY + bb.H / 2;
  const k1 = cx - cy, k2 = cx + cy;
  const newEnts = ents.map(s => {
    // 绕中心顺时针旋转 90°：x'=k1+y, y'=k2-x，四舍五入对齐网格
    const nx = Math.round(k1 + s.y);
    const ny = Math.round(k2 - s.x);
    return { ...s, x: nx, y: ny, dir: (s.dir + 1) % 4 };
  });
  const nb = blueprintBounds(newEnts);
  return { ents: newEnts, minX: nb.minX, minY: nb.minY };
}

// 旋转地砖数组（90°顺时针）：以包围盒几何中心为轴，与实体旋转同坐标系
function rotateTiles90(tiles, bb) {
  const cx = bb.minX + bb.W / 2, cy = bb.minY + bb.H / 2;
  const k1 = cx - cy, k2 = cx + cy;
  return tiles.map(t => ({ type: t.type, x: Math.round(k1 + t.y), y: Math.round(k2 - t.x) }));
}
// 翻转地砖数组：axis='h' 水平镜像 / 'v' 垂直镜像（与实体翻转同坐标系）
function flipTiles(tiles, axis, bb) {
  return tiles.map(t => axis === 'h'
    ? { type: t.type, x: bb.minX + bb.maxX - t.x, y: t.y }
    : { type: t.type, x: t.x, y: bb.minY + bb.maxY - t.y });
}

// 翻转蓝图：axis='h' 水平镜像（东西互兑），axis='v' 垂直镜像（南北互兑）
function flipEnts(ents, axis) {
  const bb = blueprintBounds(ents);
  const newEnts = ents.map(s => {
    const fp = blueprintFootprint(s);
    let nx = s.x, ny = s.y, ndir = s.dir, nmir = s.mirror | 0;
    if (axis === 'h') {
      nx = bb.minX + bb.maxX - (s.x + fp.w - 1);
      [ndir, nmir] = flipEntityDir(s.type, s.dir, s.mirror, 'h');
    } else {
      ny = bb.minY + bb.maxY - (s.y + fp.h - 1);
      [ndir, nmir] = flipEntityDir(s.type, s.dir, s.mirror, 'v');
    }
    return { ...s, x: nx, y: ny, dir: ndir, mirror: nmir };
  });
  const nb = blueprintBounds(newEnts);
  return { ents: newEnts, minX: nb.minX, minY: nb.minY };
}

// 应用当前旋转/翻转状态，返回变换后的蓝图实体与新的左上角基准
function applyBlueprintTransform() {
  let ents = G.blueprint.ents.map(s => ({ ...s }));
  let tiles = Array.isArray(G.blueprint.tiles) ? G.blueprint.tiles.map(t => ({ ...t })) : [];
  if (G.blueFlipH) {
    const bb = blueprintBounds(ents); if (tiles.length) tiles = flipTiles(tiles, 'h', bb);
    const r = flipEnts(ents, 'h'); ents = r.ents;
  }
  if (G.blueFlipV) {
    const bb = blueprintBounds(ents); if (tiles.length) tiles = flipTiles(tiles, 'v', bb);
    const r = flipEnts(ents, 'v'); ents = r.ents;
  }
  const rot = ((G.blueRot % 4) + 4) % 4;
  for (let i = 0; i < rot; i++) {
    const bb = blueprintBounds(ents); if (tiles.length) tiles = rotateTiles90(tiles, bb);
    const r = rotateEnts90(ents); ents = r.ents;
  }
  const bb = blueprintBounds(ents);
  return { ents, tiles, minX: bb.minX, minY: bb.minY };
}

// 在指定瓦片位置绘制蓝图放置幽灵（供粘贴预览与手持蓝图物品预览共用）。
// 以「变换后蓝图包围盒中心」对准 (tx,ty)（与 updateCursorTile 的蓝图锚点一致）：
// 绘制每个建筑的半透明实体幽灵 + 绿/红可放置性覆盖框。
function drawBlueprintGhostAt(g, tx, ty) {
  if (!g || tx === undefined || ty === undefined) return;
  const bp = applyBlueprintTransform();
  const ox = tx - bp.minX;
  const oy = ty - bp.minY;
  for (const s of bp.ents) {
    const cls = ENT_CLASSES[s.type];
    if (!cls) continue;
    const nx = s.x + ox, ny = s.y + oy;
    const tmp = cls.restore(Object.assign({}, s, { x: nx, y: ny }));
    tmp.dir = s.dir | 0; tmp.applyDir();
    const ok = canPlaceAt(s.type, nx, ny, tmp.dir, true).ok;   // 虚影预览不受建造范围限制（noReach）
    g.globalAlpha = 0.55;
    // 完整建筑幽灵预览：复用各设备的 DEVICE_RENDER 绘制（对齐《异星工厂》蓝图幽灵），
    // 让复制预览与实际建筑外观一致，而非只显示一个色块框。
    drawEntity(g, tmp, nx, ny, tmp.dir, 0.55);
    // 可放置性提示覆盖框（绿/红），与实体幽灵叠加显示
    g.fillStyle = ok ? 'rgba(120,220,120,.14)' : 'rgba(230,80,80,.26)';
    g.fillRect(nx * TILE, ny * TILE, tmp.w * TILE, tmp.h * TILE);
    g.strokeStyle = ok ? 'rgba(140,255,140,.65)' : 'rgba(255,110,110,.9)';
    g.lineWidth = 1.5 / G.cam.z;
    g.strokeRect(nx * TILE + 0.5, ny * TILE + 0.5, tmp.w * TILE - 1, tmp.h * TILE - 1);
    g.globalAlpha = 1;
  }
}

// 粘贴蓝图到鼠标所指位置
function pasteBlueprint() {
  if (!G.blueprint || !G.cursorTile) return;
  const bp = applyBlueprintTransform();
  const ox = G.cursorTile.tx - bp.minX;
  const oy = G.cursorTile.ty - bp.minY;
  // 放下去一律排布“建造虚影”（Ctrl+C/X、Alt+B、蓝图物品、蓝图库粘贴均如此）：
  // 只有装备个人机器人港 + 背包有施工机器人 + 有对应材料时（见 updateConstruction），
  // 施工机器人才会自动落地；否则虚影作为可持久化的规划标记保留在图上（随存档保存），而非直接落地真实建筑。
  const n = pasteBlueprintAsGhosts(bp);
  // 恢复蓝图地砖（混凝土/石砖路/填海料等，对齐《异星工厂》：蓝图粘贴含地砖）
  let tileCount = 0;
  if (Array.isArray(bp.tiles) && bp.tiles.length) {
    for (const t of bp.tiles) {
      const nx = t.x + ox, ny = t.y + oy;
      const to = PAVE_TILE[t.type];
      if (to === undefined) continue;
      // 仅在目标格为草地/同种可覆盖且无建筑时才铺设，避免覆盖已有地砖或建筑
      const cur = getTerrain(nx, ny);
      if (cur !== T_GRASS && cur !== to) continue;
      if (entAt(nx, ny)) continue;
      setTerrain(nx, ny, to);
      if (typeof invalidateTerrainChunk === 'function') invalidateTerrainChunk(nx, ny);
      tileCount++;
    }
  }
  if (typeof playSfx === 'function') playSfx('blueprint');
  toast(n > 0
    ? ('已排布 ' + n + ' 个建造虚影' + (tileCount ? '（含 ' + tileCount + ' 格地砖）' : '') + (typeof constrPending === 'function' && constrPending().build > 0 ? '，施工机器人正在建造' : '（装备个人机器人港+施工机器人后自动建造）'))
    : '无可建造的位置（区域内已有建筑或超出机器人范围）');
  uiDirty = true;
}

// ===== 蓝图库（对齐《异星工厂》Blueprint book）：保存多个蓝图供随时调用 =====
// 复制蓝图时自动加入蓝图库；也可在蓝图库面板中加载任一蓝图进行粘贴。
// 槽位管理与背包一致：G.blueBook 为稀疏数组，下标即格子位置；
// 蓝图被移走/删除后原槽位留空（null），其它蓝图不前移补位。
// at 指定放入的空槽下标（点哪个空格进哪个格）；未指定则放第一个空槽。
// 返回实际槽位下标；内容重复或数据无效返回 null。
function blueBookAdd(bp, at) {
  if (!bp || !bp.ents || !bp.ents.length) return null;
  if (!Array.isArray(G.blueBook)) G.blueBook = [];
  // 去重：内容（类型+相对位置）与已有蓝图相同则不重复添加
  const key = bp.ents.map(e => e.type + '@' + (e.x - bp.minX) + ',' + (e.y - bp.minY)).join('|');
  for (const b of G.blueBook) {
    if (!b) continue;   // 空槽跳过
    const bk = b.ents.map(e => e.type + '@' + (e.x - b.minX) + ',' + (e.y - b.minY)).join('|');
    if (bk === key) return null;   // 已存在相同蓝图
  }
  let idx = (typeof at === 'number' && at >= 0 && !G.blueBook[at]) ? at : -1;
  if (idx < 0) {
    idx = 0;
    while (idx < G.blueBook.length && G.blueBook[idx]) idx++;
  }
  G.blueBook[idx] = { name: '蓝图 ' + (G.blueBook.filter(Boolean).length + 1), minX: bp.minX, minY: bp.minY, ents: bp.ents.slice(), tiles: Array.isArray(bp.tiles) ? bp.tiles.slice() : [] };
  uiDirty = true;
  return idx;
}

// 从蓝图库加载指定蓝图，进入粘贴模式
function blueBookLoad(i) {
  const b = G.blueBook[i];
  if (!b) { toast('蓝图库中没有该项'); return; }
  G.blueprint = { minX: b.minX, minY: b.minY, ents: b.ents.slice(), tiles: Array.isArray(b.tiles) ? b.tiles.slice() : [] };
  G.blueMode = 'paste';
  G.blueStart = null; G.blueEnd = null;
  G.blueRot = 0; G.blueFlipH = false; G.blueFlipV = false;
  closePanel();
  toast('已加载蓝图「' + b.name + '」，点击空白处粘贴（R旋转，右键取消）');
}

// 删除蓝图库中指定项（槽位管理对齐背包：留空位不前移，其它蓝图不上补）
function blueBookRemove(i) {
  if (!Array.isArray(G.blueBook) || i < 0 || i >= G.blueBook.length || !G.blueBook[i]) return;
  const name = G.blueBook[i].name;
  G.blueBook[i] = null;
  toast('已从蓝图库删除「' + name + '」');
  uiDirty = true;
}

// 重命名蓝图库中指定项（对齐《异星工厂》：蓝图库中可自由为蓝图命名）
function blueBookRename(i, newName) {
  if (!Array.isArray(G.blueBook) || i < 0 || i >= G.blueBook.length || !G.blueBook[i]) return;
  const old = G.blueBook[i].name;
  const name = String(newName || '').trim();
  if (!name) { toast('蓝图名称不能为空'); return; }
  G.blueBook[i].name = name;
  toast('已重命名蓝图：' + old + ' → ' + name);
  uiDirty = true;
}

// ===== 蓝图字符串导出/导入（对齐《异星工厂》Blueprint string）=====
// Factorio 允许把蓝图导出为编码字符串（Blueprint string）供复制分享、或粘贴导入复用。
// 这里把蓝图序列化为紧凑 JSON 再用 UTF-8 安全 Base64 编码（兼容任意物品/名称字符）。
function utf8ToB64(s) {
  // 用 TextEncoder 生成 UTF-8 字节序列后逐字节 Base64 编码，避免 btoa 对中文抛错
  const bytes = new TextEncoder().encode(s);
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(bin);
}
function b64ToUtf8(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

// 把蓝图库中的一项编码为可分享的字符串。返回 null 表示空蓝图。
function blueprintEncode(b) {
  if (!b || !Array.isArray(b.ents) || !b.ents.length) return null;
  const ents = b.ents.map(e => {
    const arr = [e.type, e.x - b.minX, e.y - b.minY, e.dir | 0];
    if (e.mirror) arr.push(1);   // 镜像手性（仅储液罐等对角接口设备会用到）
    return arr;
  });
  const obj = { n: String(b.name || '蓝图'), w: 1, h: 1, e: ents };
  const fp = blueprintBounds(b.ents);
  obj.w = fp.W; obj.h = fp.H;
  // 蓝图字符串携带地砖（对齐《异星工厂》：蓝图含地面铺装）
  if (Array.isArray(b.tiles) && b.tiles.length) {
    obj.t = b.tiles.map(t => [t.type, t.x - b.minX, t.y - b.minY]);
  }
  return utf8ToB64(JSON.stringify(obj));
}

// 从字符串解码蓝图对象。成功返回 { name, minX, minY, ents }；失败返回 null。
function blueprintDecode(str) {
  try {
    const json = b64ToUtf8(String(str || '').trim());
    const obj = JSON.parse(json);
    if (!obj || !Array.isArray(obj.e)) return null;
    const ents = obj.e.map(arr => {
      if (!Array.isArray(arr) || arr.length < 3) return null;
      const e = { type: String(arr[0]), x: arr[1], y: arr[2], dir: (arr[3] || 0) | 0, mirror: (arr[4] || 0) | 0 };
      // 仅接受已知设备类型，避免导入未知类型导致异常
      if (!BUILD_DEFS[e.type] && !ENT_CLASSES[e.type]) return null;
      return e;
    }).filter(Boolean);
    if (!ents.length) return null;
    const bb = blueprintBounds(ents);
    // 解析地砖（相对坐标 → 绝对坐标，对齐《异星工厂》：蓝图含地面铺装）
    let tiles = [];
    if (Array.isArray(obj.t)) {
      for (const arr of obj.t) {
        if (!Array.isArray(arr) || arr.length < 3) continue;
        const type = String(arr[0]);
        if (PAVE_TILE[type] === undefined) continue;
        tiles.push({ type, x: arr[1] + bb.minX, y: arr[2] + bb.minY });
      }
    }
    return { name: String(obj.n || '导入蓝图'), minX: bb.minX, minY: bb.minY, ents, tiles };
  } catch (e) {
    return null;
  }
}

// 导出指定蓝图库项到剪贴板（显示字符串供复制分享）。
function blueBookExport(i) {
  const b = Array.isArray(G.blueBook) ? G.blueBook[i] : null;
  if (!b) { toast('蓝图库中没有该项'); return; }
  const s = blueprintEncode(b);
  if (!s) { toast('蓝图为空，无法导出'); return; }
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(s).then(() => toast('蓝图「' + b.name + '」已复制到剪贴板')).catch(() => toast('蓝图字符串：' + s));
  } else {
    prompt('蓝图字符串（复制保存以便分享/导入）', s);
  }
}


// ===== 蓝图物品化（对齐《异星工厂》：蓝图是可放入背包/快捷栏的物品）=====
// 蓝图作为虚拟物品 `blueprint` 存在于背包/快捷栏，本体数据（ents/tiles/name）
// 挂在 G.blueprintItems（id → 蓝图数据）上；背包/快捷栏里的 `blueprint#<n>` 引用它。
// 放置不消耗任何材料，与《异星工厂》蓝图一致可反复使用。

// 下一个可用蓝图 id（自增，读档时保证不冲突）
let _bpNextId = 1;

// 初始化蓝图物品容器（G 对象创建时为空，首次使用时懒初始化）
function bpItems() {
  if (!G.blueprintItems) G.blueprintItems = {};
  return G.blueprintItems;
}

// 解析物品 id：`blueprint#3` → { isBp: true, bpId: 3 }；普通 `blueprint` → { isBp: true, bpId: 0 }（手持空蓝图/直接粘贴模式）
function bpParseItemId(id) {
  if (typeof id !== 'string') return null;
  const m = id.match(/^blueprint(?:#(\d+))?$/);
  if (!m) return null;
  return { isBp: true, bpId: m[1] ? +m[1] : 0 };
}

// 物品 id 是否为蓝图（含 `blueprint#n` 引用）
function isBlueprintItem(id) { return !!bpParseItemId(id); }

// 由 id 取蓝图数据；bpId=0 返回当前复制缓冲（无则 null）
function bpDataById(bpId) {
  if (!bpId) return G.blueprint;
  return bpItems()[bpId] || null;
}

// 物品 id → 蓝图数据（供放置/预览使用）
function bpDataOfItem(id) {
  const p = bpParseItemId(id);
  if (!p) return null;
  return bpDataById(p.bpId);
}

// 把一份蓝图数据注册为背包物品（`blueprint#n`），返回物品 id。
// 若背包/快捷栏中已有内容完全相同的蓝图物品，则直接复用其 id（避免无限增殖）。
function bpItemCreate(bp) {
  if (!bp || !Array.isArray(bp.ents) || !bp.ents.length) return null;
  const key = bp.ents.map(e => e.type + '@' + e.x + ',' + e.y).join('|');
  const items = bpItems();
  for (const n in items) {
    const b = items[n];
    const bk = b.ents.map(e => e.type + '@' + e.x + ',' + e.y).join('|');
    if (bk === key) return 'blueprint#' + n;
  }
  const n = _bpNextId++;
  items[n] = { name: bp.name || ('蓝图 ' + n), minX: bp.minX, minY: bp.minY, ents: bp.ents.slice(), tiles: Array.isArray(bp.tiles) ? bp.tiles.slice() : [] };
  uiDirty = true;
  return 'blueprint#' + n;
}

// 重命名蓝图物品（面板用）
function bpItemRename(itemId, newName) {
  const p = bpParseItemId(itemId);
  if (!p || !p.bpId) return false;
  const b = bpItems()[p.bpId];
  if (!b) return false;
  const name = String(newName || '').trim();
  if (!name) { toast('蓝图名称不能为空'); return false; }
  b.name = name;
  uiDirty = true;
  return true;
}

// 删除蓝图物品数据（背包/快捷栏中不再存在该 id 时由 gc 调用）
function bpItemDelete(bpId) {
  if (!bpId) return;
  delete bpItems()[bpId];
  uiDirty = true;
}

// 读取存档：还原蓝图物品表（对齐 G.blueBook 的兼容处理）
function bpItemsDeserialize(arr) {
  G.blueprintItems = {};
  _bpNextId = 1;
  if (!Array.isArray(arr)) return;
  for (const it of arr) {
    if (!it || !Array.isArray(it.ents) || !it.ents.length) continue;
    const n = it.id | 0;
    if (n <= 0) continue;
    G.blueprintItems[n] = { name: String(it.name || ('蓝图 ' + n)), minX: it.minX | 0, minY: it.minY | 0, ents: it.ents, tiles: Array.isArray(it.tiles) ? it.tiles : [] };
    if (n >= _bpNextId) _bpNextId = n + 1;
  }
}

// 写入存档：把背包/快捷栏中实际引用到的蓝图物品序列化（未引用的自动丢弃）
function bpItemsSerialize() {
  const used = new Set();
  G.inv.forEach((n, id) => { if (bpParseItemId(id) && bpParseItemId(id).bpId) used.add(bpParseItemId(id).bpId); });
  if (Array.isArray(HOTBAR)) for (const id of HOTBAR) { const p = id && bpParseItemId(id); if (p && p.bpId) used.add(p.bpId); }
  const items = bpItems();
  const out = [];
  for (const n of used) {
    const b = items[n];
    if (!b) continue;
    out.push({ id: +n, name: b.name, minX: b.minX | 0, minY: b.minY | 0, ents: b.ents, tiles: Array.isArray(b.tiles) ? b.tiles : [] });
  }
  return out;
}

// 背包中放入一个蓝图物品（n=1）
function bpItemToInv(bp) {
  const id = bpItemCreate(bp);
  if (!id) return false;
  const cap = (typeof stackSize === 'function') ? stackSize(id) : 100;
  const cur = invCount(id);
  if (cur >= cap) { toast('背包里已经有相同蓝图，无需重复存放'); return false; }
  invAdd(id, 1);
  return true;
}

// ===== 手持蓝图物品放置（对齐设备放置：buildActive + tryPlaceAt 分发）=====
// 手持蓝图物品点击地图：进入粘贴模式放置蓝图内容（不消耗材料，可反复放置）
function tryPlaceBlueprintItem(tx, ty) {
  const raw = selItem();
  const p = bpParseItemId(raw);
  if (!p) return false;
  const bp = bpDataById(p.bpId);
  if (!bp || !bp.ents || !bp.ents.length) { toast('这是空蓝图，请先按 Alt+B 框选创建蓝图'); return true; }
  // 载入粘贴缓冲并直接在鼠标位置放置
  G.blueprint = { name: bp.name, minX: bp.minX, minY: bp.minY, ents: bp.ents.slice(), tiles: Array.isArray(bp.tiles) ? bp.tiles.slice() : [] };
  G.blueMode = 'paste';
  G.blueRot = 0; G.blueFlipH = false; G.blueFlipV = false;
  pasteBlueprint();
  return true;
}

// 把当前复制缓冲（G.blueprint）保存为蓝图物品放入背包
function captureBlueprintToInv() {
  if (!G.blueprint || !G.blueprint.ents || !G.blueprint.ents.length) { toast('没有已复制的蓝图'); return; }
  if (bpItemToInv(G.blueprint)) toast('蓝图「' + (G.blueprint.name || '未命名') + '」已放入背包（选中后点击地图放置）');
}

// 框选创建蓝图（Alt+B）：不自动进入粘贴模式，改为弹出蓝图编辑界面，
// 由用户选择「放到地图 / 放入背包 / 放入快捷栏」。
function captureBlueprintAsItem() {
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
      ents.push(e.blueprint());
    }
  }
  collectGhostEnts(r, ents);   // 复制时一并纳入区域内的建造虚影
  if (!ents.length) { toast('框选区域没有可复制的建筑'); return; }
  // 蓝图含地面铺装（与 captureBlueprint 同款记录逻辑）
  const TILE_IDS = { '2': 'concrete', '3': 'stone-path', '5': 'refined-concrete', '6': 'hazard-concrete', '8': 'refined-hazard-concrete', '12': 'ice-platform', '13': 'foundation', '14': 'space-platform-foundation' };
  const tiles = [];
  for (let ty = r.y0; ty <= r.y1; ty++) {
    for (let tx = r.x0; tx <= r.x1; tx++) {
      const t = getTerrain(tx, ty);
      const tid = TILE_IDS[t];
      if (!tid) continue;
      tiles.push({ type: tid, x: tx, y: ty });
    }
  }
  const bb = blueprintBounds(ents);
  G.blueprint = { name: '蓝图 ' + (_bpNextId), minX: bb.minX, minY: bb.minY, ents, tiles: tiles.length ? tiles : [] };
  // 自动存入蓝图库（保持原有去重逻辑）
  if (typeof blueBookAdd === 'function') blueBookAdd(G.blueprint);
  if (typeof playSfx === 'function') playSfx('blueprint');
  cancelBlueprint();
  // 弹出蓝图编辑界面
  openPanel('blueprint-edit');
}

// ===== 快速复制/剪切（Ctrl+C / Ctrl+X，对齐《异星工厂》常用操作习惯）=====
// Ctrl+C：框选区域 → 复制为蓝图并进入粘贴模式
function quickCopyBlueprint(cut) {
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
      ents.push(e.blueprint());
    }
  }
  collectGhostEnts(r, ents);   // 复制时一并纳入区域内的建造虚影
  if (!ents.length) { toast('框选区域没有可复制的建筑'); return; }
  const TILE_IDS = { '2': 'concrete', '3': 'stone-path', '5': 'refined-concrete', '6': 'hazard-concrete', '8': 'refined-hazard-concrete', '12': 'ice-platform', '13': 'foundation', '14': 'space-platform-foundation' };
  const tiles = [];
  for (let ty = r.y0; ty <= r.y1; ty++) {
    for (let tx = r.x0; tx <= r.x1; tx++) {
      const t = getTerrain(tx, ty);
      const tid = TILE_IDS[t];
      if (!tid) continue;
      tiles.push({ type: tid, x: tx, y: ty });
    }
  }
  G.blueprint = { name: '蓝图', minX: r.x0, minY: r.y0, ents, tiles: tiles.length ? tiles : [] };
  if (typeof blueBookAdd === 'function') blueBookAdd(G.blueprint);
  if (typeof playSfx === 'function') playSfx('blueprint');
  G.blueMode = 'paste';
  G.blueStart = null; G.blueEnd = null;
  G.blueRot = 0; G.blueFlipH = false; G.blueFlipV = false;
  syncBlueprintCursor();
  if (cut) {
    // 剪切：复制后删除框选区域内全部建筑（物资返还背包），再进入粘贴模式
    doRedBlueprintDelete(r);
    toast('已剪切 ' + ents.length + ' 个建筑为蓝图，点击空白处粘贴（R旋转，右键取消）');
  } else {
    toast('已复制 ' + ents.length + ' 个建筑为蓝图，点击空白处粘贴（R旋转，右键取消）');
  }
  uiDirty = true;
}
