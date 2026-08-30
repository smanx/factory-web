'use strict';

// ===== 蓝图 / 红图：框选一整块进行复制粘贴或删除 =====
function toggleBlueprint(mode) {
  // 进入蓝图/红图/绿图模式时退出拆除模式，避免左键行为冲突
  if (!G.blueMode && G.deconstructMode) toggleDeconstructMode(false);
  // 再次点击同按钮取消框选
  if (G.blueMode === mode) { cancelBlueprint(); return; }
  if (G.blueMode === 'paste' && mode === 'blue') {
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
    : mode === 'red'
      ? '红图模式：拖拽框选要删除的区域，松开即删除整块'
      : '绿图模式：拖拽框选要升级/降级的区域，松开后选择升级或降级');
}

function cancelBlueprint() {
  G.blueMode = null;
  G.blueStart = null; G.blueEnd = null;
  G.blueRot = 0; G.blueFlipH = false; G.blueFlipV = false;
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

// 红图：删除矩形区域内所有实体（含内部物资返还，跨区域不重复）。
// 删除前弹框确认，避免误删整片建筑；确认后才真正执行删除。
function applyRedBlueprint() {
  const r = blueRect();
  if (!r) return;
  // 装备个人机器人港且有施工机器人：生成拆除标记，由施工机器人拆除
  if (typeof canUseConstruction === 'function' && canUseConstruction() && typeof markAreaForDecon === 'function') {
    const n = markAreaForDecon(r);
    G.blueStart = null; G.blueEnd = null;
    toast(n > 0 ? ('已标记 ' + n + ' 个建筑待拆除，施工机器人正在拆除' + (constrPending().decon > 0 ? '（剩 ' + constrPending().decon + ' 个待拆）' : ''))
      : '区域内没有可拆除的建筑');
    uiDirty = true;
    return;
  }
  const n = redAreaCount(r);
  if (!n) {
    G.blueStart = null; G.blueEnd = null;
    toast('区域内没有可拆除的建筑');
    uiDirty = true;
    return;
  }
  // 保留框选范围，待确认后由 doRedBlueprintDelete 删除
  openConfirm('红图删除确认', '将删除框选区域内的 ' + n + ' 个建筑（内部物资会返还背包），确定继续？', '删除', () => doRedBlueprintDelete(r));
}

// 统计矩形区域内可被红图删除的建筑数量（实体中心在区域内，与删除判定一致）
function redAreaCount(r) {
  const seen = new Set();
  let count = 0;
  for (let ty = r.y0; ty <= r.y1; ty++) {
    for (let tx = r.x0; tx <= r.x1; tx++) {
      const e = entAt(tx, ty);
      if (!e || seen.has(e)) continue;
      seen.add(e);
      const cx = e.x + Math.floor(e.w / 2), cy = e.y + Math.floor(e.h / 2);
      if (cx >= r.x0 && cx <= r.x1 && cy >= r.y0 && cy <= r.y1) count++;
    }
  }
  return count;
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
  G.blueStart = null; G.blueEnd = null;
  G.blueRot = 0; G.blueFlipH = false; G.blueFlipV = false;
  toast('蓝图已复制 ' + ents.length + ' 个建筑，点击空白处粘贴（R旋转，V/H翻转，右键取消）');
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
    let nx = s.x, ny = s.y, ndir = s.dir;
    if (axis === 'h') {
      nx = bb.minX + bb.maxX - (s.x + fp.w - 1);
      ndir = flipDir(s.dir, 'h');
    } else {
      ny = bb.minY + bb.maxY - (s.y + fp.h - 1);
      ndir = flipDir(s.dir, 'v');
    }
    return { ...s, x: nx, y: ny, dir: ndir };
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

// 粘贴蓝图到鼠标所指位置
function pasteBlueprint() {
  if (!G.blueprint || !G.cursorTile) return;
  const bp = applyBlueprintTransform();
  // 装备个人机器人港且有施工机器人：生成建造幽灵，由施工机器人自动施工
  if (typeof canUseConstruction === 'function' && canUseConstruction()) {
    const n = pasteBlueprintAsGhosts(bp);
    toast(n > 0 ? ('已排布 ' + n + ' 个建造幽灵，施工机器人正在建造' + (constrPending().build > 0 ? '（剩 ' + constrPending().build + ' 个待建）' : ''))
      : '无可建造的位置（区域内已有建筑或超出机器人范围）');
    if (typeof playSfx === 'function') playSfx('blueprint');
    uiDirty = true;
    return;
  }
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
    if (!canPlaceAt(s.type, nx, ny, tmp.dir).ok) {
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
  toast('蓝图已粘贴 ' + placements.length + ' 个建筑' + (tileCount ? '（含 ' + tileCount + ' 格地砖）' : '') + '（可继续点击空白处粘贴，R旋转/V翻转，右键取消）');
  uiDirty = true;
}

// ===== 蓝图库（对齐《异星工厂》Blueprint book）：保存多个蓝图供随时调用 =====
// 复制蓝图时自动加入蓝图库；也可在蓝图库面板中加载任一蓝图进行粘贴。
function blueBookAdd(bp) {
  if (!bp || !bp.ents || !bp.ents.length) return;
  if (!Array.isArray(G.blueBook)) G.blueBook = [];
  // 去重：内容（类型+相对位置）与已有蓝图相同则不重复添加
  const key = bp.ents.map(e => e.type + '@' + (e.x - bp.minX) + ',' + (e.y - bp.minY)).join('|');
  for (const b of G.blueBook) {
    const bk = b.ents.map(e => e.type + '@' + (e.x - b.minX) + ',' + (e.y - b.minY)).join('|');
    if (bk === key) return;   // 已存在相同蓝图
  }
  G.blueBook.push({ name: '蓝图 ' + (G.blueBook.length + 1), minX: bp.minX, minY: bp.minY, ents: bp.ents.slice(), tiles: Array.isArray(bp.tiles) ? bp.tiles.slice() : [] });
  uiDirty = true;
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

// 删除蓝图库中指定项
function blueBookRemove(i) {
  if (!Array.isArray(G.blueBook) || i < 0 || i >= G.blueBook.length) return;
  const name = G.blueBook[i].name;
  G.blueBook.splice(i, 1);
  toast('已从蓝图库删除「' + name + '」');
  uiDirty = true;
}

// 重命名蓝图库中指定项（对齐《异星工厂》：蓝图库中可自由为蓝图命名）
function blueBookRename(i, newName) {
  if (!Array.isArray(G.blueBook) || i < 0 || i >= G.blueBook.length) return;
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
      const e = { type: String(arr[0]), x: arr[1], y: arr[2], dir: (arr[3] || 0) | 0 };
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

