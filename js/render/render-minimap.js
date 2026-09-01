'use strict';

// ===== 小地图（Minimap） =====
// 位于画布右下角的缩略地图：只绘制已探索区块的地形与矿脉，玩家位置用亮点标出。
// 数据来源于 G.world.explored（区块级），瓦片级颜色直接查询确定性地形生成，避免额外存储。
const MINIMAP_SIZE = 168;           // 小地图边长（px）
const MINIMAP_ZOOM = 2.2;           // 每瓦片像素（越大多看得越细，但覆盖范围变小）
const MINIMAP_VIEW = Math.ceil(MINIMAP_SIZE / MINIMAP_ZOOM / 2); // 半边长覆盖瓦片数

// 小地图背景缓存（渲染优化）：地形/矿点是静态的，不需要每帧重绘。
// 原实现每帧对 79×79=6241 个瓦片做逐格 getTerrain + 十二分支字符串配色 + fillRect + getOreType，
// 在缩放 0.5 全景时是 render() 的大头之一。
// 改为：把地形+矿点画进一块离屏画布，仅在“玩家换格 / 首次 / 距上次≥500ms”时重建一次，
// 其余帧直接用 drawImage 整图贴上（克还是动态的污染/标签/玩家点仍逐帧叠加）。
let _mmCache = null;                // 离屏背景画布（按 DPR 分辨率）
let _mmLastKey = '';                // 上次绘制时玩家所在瓦片（用于换格重绘）
let _mmNextPaint = 0;               // 下一次允许重建的时间戳（节流）
let _mmDirty = true;                // 主动强制重建标记

// 确保离屏背景画布存在且与当前 DPR 匹配（显示缩放变化时需重建）。
function _mmEnsure() {
  const dpr = window.devicePixelRatio || 1;
  if (!_mmCache) {
    _mmCache = document.createElement('canvas');
    _mmCache.width = Math.round(MINIMAP_SIZE * dpr);
    _mmCache.height = Math.round(MINIMAP_SIZE * dpr);
    _mmCache._dpr = dpr;
  } else if (_mmCache._dpr !== dpr) {
    _mmCache.width = Math.round(MINIMAP_SIZE * dpr);
    _mmCache.height = Math.round(MINIMAP_SIZE * dpr);
    _mmCache._dpr = dpr;
    _mmDirty = true;
  }
  return _mmCache;
}

// 把当前玩家视口内的地形+矿点一次性画进离屏背景画布（逻辑与旧 drawMinimap 的瓦片循环一致）。
function _paintMinimapBg(pcx, pcy) {
  const c = _mmEnsure();
  const cctx = c.getContext('2d');
  const dpr = c._dpr;
  cctx.save();
  cctx.scale(dpr, dpr);
  cctx.clearRect(0, 0, MINIMAP_SIZE, MINIMAP_SIZE);
  const size = MINIMAP_SIZE, z = MINIMAP_ZOOM;
  const cx = size / 2, cy = size / 2;
  for (let dy = -MINIMAP_VIEW; dy <= MINIMAP_VIEW; dy++) {
    for (let dx = -MINIMAP_VIEW; dx <= MINIMAP_VIEW; dx++) {
      const tx = Math.floor(pcx) + dx, ty = Math.floor(pcy) + dy;
      if (!tileExplored(tx, ty)) continue;
      const px = cx + (tx - pcx) * z, py = cy + (ty - pcy) * z;
      if (px < -z || py < -z || px > size + z || py > size + z) continue;
      const t = getTerrain(tx, ty);
      cctx.fillStyle = (t === T_WATER) ? 'rgba(40,90,140,0.9)'
        : (t === T_CONCRETE) ? 'rgba(120,120,126,0.85)'
        : (t === T_REF_CONCRETE) ? 'rgba(165,168,176,0.85)'
        : (t === T_HAZARD) ? 'rgba(190,180,40,0.85)'
        : (t === T_REF_HAZARD) ? 'rgba(200,190,50,0.85)'
        : (t === T_PATH) ? 'rgba(150,140,130,0.85)'
        : (t === T_CLIFF) ? 'rgba(100,96,88,0.9)'
        : (t === T_YUMAKO_SOIL) ? 'rgba(122,90,52,0.9)'
        : (t === T_OVERGROWTH_YUMAKO_SOIL) ? 'rgba(100,70,40,0.9)'
        : (t === T_JELLYNUT_SOIL) ? 'rgba(122,68,88,0.9)'
        : (t === T_OVERGROWTH_JELLYNUT_SOIL) ? 'rgba(100,52,78,0.9)'
        : (t === T_FOUNDATION) ? 'rgba(124,132,144,0.9)'
        : (t === T_ICE_PLATFORM) ? 'rgba(184,212,232,0.9)'
        : (t === T_SPACE_PLATFORM) ? 'rgba(110,112,120,0.9)'
        : 'rgba(104,108,60,0.9)';   // 草+土混合观感（与主地形露土风格一致）
      cctx.fillRect(px, py, z + 0.4, z + 0.4);
      // 矿脉标记
      const oi = getOreType(tx, ty);
      if (oi >= 0) {
        const oid = oreItemId(oi);
        const oc = ITEMS[oid] ? ITEMS[oid].color : '#aaa';
        cctx.fillStyle = oc;
        cctx.fillRect(px + z * 0.25, py + z * 0.25, z * 0.5, z * 0.5);
      }
    }
  }
  cctx.restore();
}

function drawMinimap(ctx) {
  const size = MINIMAP_SIZE;
  const pad = 0;
  const x0 = W - size - pad, y0 = pad; // 小地图移至上（右）角显示
  const pcx = G.player.x / TILE, pcy = G.player.y / TILE;
  const z = MINIMAP_ZOOM;
  const cx = x0 + size / 2, cy = y0 + size / 2;
  // 背景框
  ctx.fillStyle = 'rgba(8,12,10,0.78)';
  ctx.strokeStyle = 'rgba(140,200,160,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(x0, y0, size, size, 6) : ctx.rect(x0, y0, size, size);
  ctx.fill(); ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.rect(x0, y0, size, size);
  ctx.clip();
  // 背景缓存：仅玩家换格/首次/节流到点才重建 6241 格地形+矿点，其余帧直接贴整图
  const curKey = Math.floor(pcx) + ',' + Math.floor(pcy);
  const now = performance.now();
  if (_mmDirty || curKey !== _mmLastKey || now >= _mmNextPaint) {
    _paintMinimapBg(pcx, pcy);
    _mmLastKey = curKey;
    _mmDirty = false;
    _mmNextPaint = now + 500;   // 节流：最多 500ms 重建一次，兜住雷达扩图/矿量变化
  }
  ctx.drawImage(_mmEnsure(), x0, y0, size, size);
  // 地图标记：在小地图上绘制已探索范围内的标记
  if (typeof drawMapTagsMinimap === 'function') drawMapTagsMinimap(ctx, cx, cy, z, pcx, pcy, x0, y0, size);
  // 污染系统：在小地图叠加污染范围（红褐色），需在 clip() 内绘制，确保污染显示范围不超出小地图边界
  if (typeof drawPollutionMinimap === 'function') {
    drawPollutionMinimap(ctx, cx + (G.spawn ? G.spawn.x - pcx : 0) * z, cy + (G.spawn ? G.spawn.y - pcy : 0) * z, z);
  }
  ctx.restore();
  // 边框（覆盖 clip 外缘）
  ctx.strokeStyle = 'rgba(140,200,160,0.4)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0, y0, size, size);
  // 玩家位置亮点
  const ppx = x0 + size / 2, ppy = y0 + size / 2;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(ppx, ppy, 2.6, 0, 7);
  ctx.fill();
  ctx.strokeStyle = '#ffd23c';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  // 标题
  ctx.fillStyle = 'rgba(200,230,210,0.8)';
  ctx.font = '10px system-ui';
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  ctx.fillText('🗺 ' + Math.round(pcx) + ',' + Math.round(pcy), x0 + 6, y0 + 5);
}

// 按像素宽度把文本折行（支持中英文混排）：
// 优先在空格处断行（英文单词），单个超长词（或无空格的中文长句）按字符逐个断行。返回行数组。
function _wrapTooltipText(ctx, text, maxW) {
  const words = String(text).split(/(\s+)/);
  const lines = [];
  let cur = '';
  const flush = (t) => { if (t) lines.push(t); };
  for (const w of words) {
    if (ctx.measureText(cur + w).width <= maxW) { cur += w; continue; }
    flush(cur);
    cur = w;
    // 当前行已满，且剩下一整段仍超宽：按字符拆行
    // 注意：内层 while 找到的是“第一个超宽字符”，必须退回一格，保证每行都不超过 maxW，
    // 否则长文本换行后会比限制宽一个字符、顶到右边框（实测 CJK 差 ~11px）。
    while (ctx.measureText(cur).width > maxW) {
      let i = 1;
      while (i < cur.length && ctx.measureText(cur.slice(0, i)).width <= maxW) i++;
      if (ctx.measureText(cur.slice(0, i)).width > maxW) i--;   // 退回最后一个放得下的字符
      if (i < 1) i = 1;                                          // 单字符也放不下时强制推一个
      lines.push(cur.slice(0, i));
      cur = cur.slice(i);
    }
  }
  flush(cur);
  return lines.length ? lines : [String(text)];
}

// 燃烧器（烧燃料）设备：能量显示“(燃烧器)”而非“(电能)”，对齐官方 tooltip。
const _BURNER_DEVICES = new Set(['burner-mining-drill', 'stone-furnace', 'steel-furnace', 'boiler', 'burner-inserter']);

// ===== 悬停设备动态信息（运行时实时状态） =====
// 目标：鼠标悬停任意设备时，在小地图下方面板中除官方静态数据外，同步展示
// 「当前配方与每秒输入/输出速率、当前/最低/最高耗电与供电比例、发电功率、
//   热量产/耗与温度（当前/启动/最高）、流体输入输出速率、内部缓存」等运行时状态。
// 数值纪律（AGENT.md §0/§3）：所有数值一律读取项目既有常量/实体方法
// （GAME_DATA 单源桥接常量、POWER_USE、powerDemand()、powerOut、temperature() 等），
// 本文件不新增任何第二套数值。

// 物品/流体聚合的短文案："铁板×10、铜板×5"
function _hoverAggText(agg, maxN) {
  if (!agg) return '';
  const keys = Object.keys(agg).filter(k => agg[k] > 0);
  if (!keys.length) return '';
  const n = (maxN == null) ? 4 : maxN;
  return keys.slice(0, n).map(k =>
    (ITEMS[k] ? ITEMS[k].name : k) + '×' + (Math.round(agg[k] * 10) / 10)
  ).join('、') + (keys.length > n ? ' …' : '');
}

// 配方机器当前的生产倍率（对齐各设备 update() 的 prog 累加公式，仅用于速率展示）。
function _hoverCraftMult(e) {
  const q = (typeof qualityMult === 'function' && e.quality) ? qualityMult(e.quality) : 1;
  const pf = (typeof powerFactor === 'function') ? powerFactor(e) : 1;
  const ms = (typeof e.moduleSpeedMult === 'function') ? e.moduleSpeedMult() : 1;
  const ds = GAME_DATA.deviceStats && GAME_DATA.deviceStats[e.type];
  const cs = ds && ds.craftingSpeed;
  if (e instanceof ChemicalPlant) return chemMult() * oilMult() * ms * pf * q;
  if (e instanceof Refinery)     return oilMult() * ms * pf * q;
  if (e instanceof Centrifuge)   return ms * pf * q;
  if (e instanceof AgriculturalTower) return asmMult() * ms * pf * q;
  if (e instanceof Assembler)    return asmMult() * (cs || 0.5) * ms * pf * q;
  return ms * pf * q;
}

// 功率格式化（内部单位 kW → W / kW / MW / GW，对齐《异星工厂》显示习惯）
function fmtPower(kW) {
  const w = (kW || 0) * 1000;
  const a = Math.abs(w);
  if (a >= 1e9) return (Math.round(w / 1e8) / 10) + ' GW';
  if (a >= 1e6) return (Math.round(w / 1e5) / 10) + ' MW';
  if (a >= 1e3) return (Math.round(w / 1e2) / 10) + ' kW';
  return Math.round(w) + ' W';
}
// 能量格式化（内部单位 kJ → J / kJ / MJ / GJ）
function fmtEnergy(kJ) {
  const j = (kJ || 0) * 1000;
  const a = Math.abs(j);
  if (a >= 1e9) return (Math.round(j / 1e8) / 10) + ' GJ';
  if (a >= 1e6) return (Math.round(j / 1e5) / 10) + ' MJ';
  if (a >= 1e3) return (Math.round(j / 1e2) / 10) + ' kJ';
  return Math.round(j) + ' J';
}

// 收集某设备的动态信息段。返回段数组；每段 { title, rows:[{label, value, color}] }。
function _hoverRuntimeSections(e) {
  const secs = [];
  const fmt = n => (Math.round(n * 100) / 100).toString();

  // ---- 电线杆：所属电网的供电情况（保障 / 发电 / 蓄电）----
  (function poleGridSec() {
    if (!(GAME_DATA.pole && GAME_DATA.pole[e.type])) return;
    const g = (typeof powerGridOf === 'function') ? powerGridOf(e) : e._grid;
    if (!g) return;
    const rows = [
      { label: '保障', value: fmtPower(g.prod) + ' / ' + fmtPower(g.demand),
        color: (g.demand <= 0 || g.prod >= g.demand - 1e-6) ? '#8fe08f' : '#ff5b5b' },
      { label: '发电', value: fmtPower(g.prod) + ' / ' + fmtPower(g.capacity), color: '#8fe08f' },
      { label: '蓄电', value: fmtEnergy(g.stored) + ' / ' + fmtEnergy(g.storedCap) },
    ];
    secs.push({ title: '⚡️电力网络', rows });
  })();

  // ---- 当前配方 + 每秒消耗/产出速率 ----
  (function recipeSec() {
    let rec = null, inAgg = null, outAgg = null;

    if (e instanceof Lab) {
      // 研究中心：每 LAB_TIME 秒消耗 1 个当前所需科学包，速率 = 倍率 / LAB_TIME
      const tech = G.activeTech;
      if (!tech) return;
      const nm = TECHS[tech] ? TECHS[tech].name : tech;
      const list = (typeof techNeedList === 'function') ? techNeedList(tech) : null;
      const done = G.techProg[tech] || 0;
      const need = list ? list[done] : null;
      if (!need) return;
      const m = (typeof powerFactor === 'function' ? powerFactor(e) : 1) * labSpeedMult() *
        (typeof e.moduleSpeedMult === 'function' ? e.moduleSpeedMult() : 1) *
        (typeof e.researchSpeedMult === 'function' ? e.researchSpeedMult() : 1) *
        ((typeof qualityMult === 'function' && e.quality) ? qualityMult(e.quality) : 1);
      const rows = [];
      rows.push({ label: '当前课题', value: nm });
      rows.push({ label: '研究速度', value: '×' + fmt(Math.round(m * 100) / 100), color: '#8fe08f' });
      rows.push({ label: '消耗速率', value: '−' + fmt(m / LAB_TIME) + '/秒 ' + (ITEMS[need] ? ITEMS[need].name : need), color: '#ff8a7a' });
      secs.push({ title: '🔬 研究', rows });
      return;
    }

    if (e instanceof Recycler) {
      if (!e.recycleItem) return;
      const out = e.recycleResults(e.recycleItem);
      const m = (typeof e.moduleSpeedMult === 'function' ? e.moduleSpeedMult() : 1) * (typeof powerFactor === 'function' ? powerFactor(e) : 1);
      const bt = Math.max(0.01, e.batchTime() / m);
      const rows = [{ label: '当前回收', value: (ITEMS[e.recycleItem] ? ITEMS[e.recycleItem].name : e.recycleItem) + (e.crafting ? '' : '（待机）') }];
      rows.push({ label: '消耗速率', value: '−' + fmt(1 / bt) + '/秒 ' + (ITEMS[e.recycleItem] ? ITEMS[e.recycleItem].name : e.recycleItem), color: '#ff8a7a' });
      for (const k in out) rows.push({ label: '产出速率', value: '+' + fmt(out[k] / bt) + '/秒 ' + (ITEMS[k] ? ITEMS[k].name : k), color: '#8fe08f' });
      secs.push({ title: '♻ 回收', rows });
      return;
    }

    if (e instanceof CaptiveBiterSpawner) {
      const rows = [
        { label: '食物储备', value: fmt(e.food) + ' / ' + e.foodMax },
        { label: '消耗速率', value: '−0.5/秒 生物流（喂食维持）', color: '#ff8a7a' },
        { label: '产出速率', value: '+0.2/秒 ' + (ITEMS['biter-egg'] ? ITEMS['biter-egg'].name : '异虫卵'), color: '#8fe08f' },
      ];
      secs.push({ title: '🥚 繁育', rows });
      return;
    }

    if (e instanceof Furnace) {
      rec = e.cur;
      if (!rec) return;
      const ds = GAME_DATA.deviceStats && GAME_DATA.deviceStats[e.type];
      const cs = (ds && ds.craftingSpeed) || (e.type === 'stone-furnace' ? 1 : 2);
      const q = (typeof qualityMult === 'function' && e.quality) ? qualityMult(e.quality) : 1;
      const ms = (typeof e.moduleSpeedMult === 'function') ? e.moduleSpeedMult() : 1;
      const pf = (e instanceof ElectricFurnace && typeof powerFactor === 'function') ? powerFactor(e) : 1;
      inAgg = {}; inAgg[rec.inp] = (rec.inCount || 1);
      outAgg = {}; outAgg[rec.id] = 1;
      const M = cs * ms * pf * q;
      const rows = [];
      const outName = ITEMS[rec.id] ? ITEMS[rec.id].name : rec.id;
      rows.push({ label: '当前冶炼', value: outName + (e.lit ? '' : '（待机）') });
      rows.push({ label: '消耗速率', value: '−' + fmt(inAgg[rec.inp] / rec.time * M) + '/秒 ' + (ITEMS[rec.inp] ? ITEMS[rec.inp].name : rec.inp), color: '#ff8a7a' });
      rows.push({ label: '产出速率', value: '+' + fmt(1 / rec.time * M) + '/秒 ' + outName, color: '#8fe08f' });
      secs.push({ title: '🏭 生产', rows });
      return;
    }

    if (e instanceof Drill) {
      // 采矿机族（热能/电力/抽油机/大型钻机）：速率 = 速度倍率 ÷ 当前矿石采矿时间
      const o = e.oreTile();
      if (!o) return;
      const item = e.mineItem(o);
      const mt = e.oreTime();
      const q = (typeof qualityMult === 'function' && e.quality) ? qualityMult(e.quality) : 1;
      const ms = (typeof e.moduleSpeedMult === 'function') ? e.moduleSpeedMult() : 1;
      const pf = (e instanceof ElectricDrill && typeof powerFactor === 'function') ? powerFactor(e) : 1;
      const ds = GAME_DATA.deviceStats && GAME_DATA.deviceStats[e.type];
      const speed = drillMult() * (e.machMult ? e.machMult() : ((ds && ds.miningSpeed) || 0.5)) * ms * pf * q;
      const rate = speed / mt;
      const rows = [];
      rows.push({ label: '采矿对象', value: (ITEMS[item] ? ITEMS[item].name : item) });
      rows.push({ label: '产出速率', value: '+' + fmt(rate) + '/秒 ' + (ITEMS[item] ? ITEMS[item].name : item) + (e.working ? '' : '（暂停：' + (e.status || '待机') + '）'), color: '#8fe08f' });
      if (item === 'uranium-ore') rows.push({ label: '消耗速率', value: '−' + fmt(rate) + '/秒 硫酸', color: '#ff8a7a' });
      secs.push({ title: '⛏ 采矿', rows });
      return;
    }

    if (e instanceof Pump) {
      const rows = [{ label: '产出速率', value: '+' + fmt(e.working ? PUMP_RATE : 0) + '/秒 水' + (e.working ? '' : '（待机/缓冲已满）'), color: '#8fe08f' }];
      secs.push({ title: '💧 取水', rows });
      return;
    }

    // 其余配方机器：组装机族 / 化工厂 / 炼油厂 / 离心机 / 农业塔 / 平台中枢
    if (e instanceof Centrifuge) {
      rec = e.recipeObj();
      if (rec) { inAgg = rec.inp; outAgg = rec.out; }
    } else if (e instanceof Refinery) {
      rec = e.recipe ? REFINERY_RECIPES[e.recipe] : null;
      if (rec) { inAgg = rec.inp; outAgg = rec.out; }
    } else if (e instanceof ChemicalPlant || e instanceof Assembler) {
      rec = e.recipe ? RECIPES[e.recipe] : null;
      if (rec) { inAgg = rec.inp; outAgg = rec.out; }
    }
    if (!rec || !rec.time) return;
    const M = _hoverCraftMult(e);
    const rows = [];
    // 配方显示名：优先按主产物物品名；无主产物（如离心机概率产出配方）回退多语言配方名/原 ID
    const mainOut = outAgg && Object.keys(outAgg)[0];
    const recName = mainOut && ITEMS[mainOut] ? ITEMS[mainOut].name : (e.recipe ? localizedName(e.recipe, (RECIPES[e.recipe] && RECIPES[e.recipe].name) || (CENTRIFUGE_RECIPES[e.recipe] && CENTRIFUGE_RECIPES[e.recipe].name) || e.recipe) : '—');
    rows.push({ label: '当前配方', value: recName + (e.crafting ? '' : '（待机）') });
    if (inAgg) for (const k in inAgg)
      rows.push({ label: '消耗速率', value: '−' + fmt(inAgg[k] / rec.time * M) + '/秒 ' + (ITEMS[k] ? ITEMS[k].name : k), color: '#ff8a7a' });
    if (outAgg) for (const k in outAgg)
      rows.push({ label: '产出速率', value: '+' + fmt(outAgg[k] / rec.time * M) + '/秒 ' + (ITEMS[k] ? ITEMS[k].name : k), color: '#8fe08f' });
    if (rec.prob) for (const k in rec.prob)   // 概率产出配方（如铀浓缩）：按概率折算期望速率
      rows.push({ label: '期望产出', value: '+' + fmt(rec.prob[k] / rec.time * M) + '/秒 ' + (ITEMS[k] ? ITEMS[k].name : k) + '（' + (Math.round(rec.prob[k] * 1000) / 10) + '% 概率）', color: '#8fe08f' });
    secs.push({ title: '🏭 生产', rows });
  })();

  // ---- 电力：当前/最低/最高耗电 + 供电比例 ----
  (function powerSec() {
    if (typeof e.powerDemand !== 'function') return;
    if (e instanceof Roboport) return;   // 机器人港电力信息由 roboportSec 统一展示（对齐官方 tooltip）
    const maxW = e.powerDemand() || 0;
    if (maxW <= 0) return;
    const pf = (typeof powerFactor === 'function') ? powerFactor(e) : 1;
    const curW = maxW * pf;
    const sat = (typeof powerSatOf === 'function') ? powerSatOf(e) : (G.power ? G.power.sat : 1);
    const rows = [
      { label: '最高耗电', value: fmt(Math.round(maxW)) + ' kW' },
      { label: '最低耗电', value: fmt(Math.round(maxW * MIN_POWER_SAT)) + ' kW（低效运转下限）' },
      { label: '当前耗电', value: fmt(Math.round(curW)) + ' kW', color: '#ffd23c' },
      { label: '供电比例', value: Math.round(sat * 100) + ' %' + (sat >= 1 ? '（充足）' : (sat > 0 ? '（不足，低效运转）' : '（断电停摆）')), color: sat >= 1 ? '#8fe08f' : (sat > 0 ? '#ffd23c' : '#ff5b5b') },
    ];
    secs.push({ title: '⚡ 电力', rows });
  })();

  // ---- 发电设备：当前发电 / 满功率 / 耗汽（流体）速率 ----
  (function genSec() {
    const rows = [];
    if (e instanceof SteamEngine) {
      rows.push({ label: '当前发电', value: '+' + fmt(Math.round(e.powerOut || 0)) + ' kW', color: '#8fe08f' });
      rows.push({ label: '满功率', value: '+' + POWER_PER_ENGINE + ' kW（' + Math.round((e.powerOut || 0) / POWER_PER_ENGINE * 100) + '% 负载）' });
      rows.push({ label: '耗汽速率', value: '−' + fmt(ENGINE_STEAM_RATE * (e.outMult || 0)) + '/秒 蒸汽', color: '#ff8a7a' });
    } else if (e instanceof SteamTurbine) {
      rows.push({ label: '当前发电', value: '+' + fmt(Math.round(e.powerOut || 0)) + ' kW', color: '#8fe08f' });
      rows.push({ label: '满功率', value: '+' + POWER_PER_TURBINE + ' kW（' + Math.round((e.powerOut || 0) / POWER_PER_TURBINE * 100) + '% 负载）' });
      rows.push({ label: '耗汽速率', value: '−' + fmt(TURBINE_STEAM_RATE * (e.outMult || 0)) + '/秒 蒸汽', color: '#ff8a7a' });
    } else if (e instanceof SolarPanel) {
      const f = solarFactor();
      rows.push({ label: '当前发电', value: '+' + fmt(Math.round(e.powerOut || 0)) + ' kW', color: '#8fe08f' });
      rows.push({ label: '满功率', value: '+' + SOLAR_POWER + ' kW（日照 ' + Math.round(f * 100) + '%）' });
    } else if (e instanceof Accumulator) {
      rows.push({ label: '当前储电', value: fmt(Math.round(e.stored)) + ' / ' + ACCUM_CAP + ' kJ' });
      rows.push({ label: '充/放电功率', value: (e.powerOut > 0 ? '+' : '−') + fmt(Math.round(e.powerOut || 0)) + ' kW', color: e.powerOut > 0 ? '#8fe08f' : '#ffd23c' });
      rows.push({ label: '额定功率', value: ACCUM_CHARGE_RATE + ' kW' });
    } else if (e instanceof LightningRod) {
      rows.push({ label: '当前储能', value: fmt(Math.round(e.stored)) + ' kJ' });
      rows.push({ label: '放电功率', value: '+' + fmt(Math.round(e.powerOut || 0)) + ' kW', color: '#8fe08f' });
    } else if (e instanceof Thruster) {
      rows.push({ label: '当前发电', value: '+' + fmt(Math.round(e.powerOut || 0)) + ' kW', color: '#8fe08f' });
      rows.push({ label: '满功率', value: '+' + THRUSTER_POWER + ' kW' });
      rows.push({ label: '耗流体', value: '−' + fmt(THRUSTER_FUEL_RATE) + '/秒 推进燃料 + −' + fmt(THRUSTER_OXID_RATE) + '/秒 氧化剂', color: '#ff8a7a' });
    } else if (e instanceof FusionGenerator) {
      rows.push({ label: '当前发电', value: '+' + fmt(Math.round(e.powerOut || 0)) + ' kW', color: '#8fe08f' });
      rows.push({ label: '满功率', value: '+' + FUSION_GENERATOR_MAX_POWER + ' kW（' + Math.round((e.powerOut || 0) / FUSION_GENERATOR_MAX_POWER * 100) + '% 负载）' });
      rows.push({ label: '耗热速率', value: '−' + fmt((e.powerOut || 0) * FUSION_HEAT_PER_KW) + ' MJ/秒', color: '#ff8a7a' });
      rows.push({ label: '当前温度', value: Math.round(e.temperature()) + ' °C / 最高 ' + HEAT_MAX_TEMP + ' °C' });
    } else return;
    secs.push({ title: '🔋 发电', rows });
  })();

  // ---- 热量：产热/耗热、当前温度、启动温度、最高温度 ----
  (function heatSec() {
    const rows = [];
    if (e instanceof NuclearReactor) {
      const nb = e.neighborCount ? e.neighborCount() : 0;
      rows.push({ label: '产热速率', value: e.burning ? '+' + fmt(REACTOR_HEAT_RATE * (1 + nb)) + ' MW' : '+0 MW', color: '#ff9a3a' });
      if (e.burning && nb > 0) rows.push({ label: '相邻加成', value: '+' + (nb * 100) + '%（' + nb + ' 台相邻）' });
      rows.push({ label: '当前温度', value: Math.round(e.temperature()) + ' °C / 最高 ' + HEAT_MAX_TEMP + ' °C' });
      rows.push({ label: '燃料燃尽', value: '剩 ' + fmt(e.burnLeft || 0) + ' 秒' });
    } else if (e instanceof HeatingTower) {
      rows.push({ label: '产热速率', value: e.burning ? '+' + fmt(HEATING_TOWER_RATE * HEATING_TOWER_EFFECTIVITY) + ' MW' : '+0 MW', color: '#ff9a3a' });
      rows.push({ label: '燃料燃尽', value: '剩 ' + fmt(e.burnLeft || 0) + ' 秒' });
      rows.push({ label: '当前温度', value: Math.round(e.temperature()) + ' °C / 最高 ' + HEAT_MAX_TEMP + ' °C' });
    } else if (e instanceof HeatExchanger) {
      // 热交换器满负荷耗热 10MW（官方 energy_consumption，HEAT_EXCHANGER_POWER 单源），
      // 产汽速率 = 耗热 / 每单位蒸汽热值（此前引用已不存在的 HEAT_EXCHANGER_STEAM_RATE 导致 ReferenceError 崩渲染）
      rows.push({ label: '耗热速率', value: e.active ? '−' + fmt(HEAT_EXCHANGER_POWER) + ' MW' : '−0 MW', color: '#ff9a3a' });
      rows.push({ label: '产汽速率', value: e.active ? '+' + fmt(HEAT_EXCHANGER_POWER / HEAT_EXCHANGER_ENERGY_PER_STEAM) + '/秒 蒸汽' : '+0/秒', color: '#8fe08f' });
      rows.push({ label: '热量接入', value: e.hasHeatSourceNeighbor && e.hasHeatSourceNeighbor() ? '已接热源' : '未接热源（缓慢降温中）', color: e.hasHeatSourceNeighbor && e.hasHeatSourceNeighbor() ? '#8fe08f' : '#ff9a3a' });
      rows.push({ label: '当前温度', value: Math.round(e.temperature()) + ' °C' });
      rows.push({ label: '启动温度', value: HEAT_EXCHANGER_MIN_WORK_TEMP + ' °C' + (e.temperature() >= HEAT_EXCHANGER_MIN_WORK_TEMP ? '（已达标）' : '（未达标）'), color: e.temperature() >= HEAT_EXCHANGER_MIN_WORK_TEMP ? '#8fe08f' : '#ff5b5b' });
      rows.push({ label: '最高温度', value: HEAT_MAX_TEMP + ' °C' });
    } else if (e instanceof HeatPipe) {
      rows.push({ label: '当前温度', value: Math.round(e.temperature()) + ' °C / 最高 ' + HEAT_MAX_TEMP + ' °C' });
      rows.push({ label: '最大传热', value: HEAT_PIPE_MAX_TRANSFER + ' MW' });
    } else if (e instanceof FusionReactor) {
      rows.push({ label: '产热速率', value: e.burning ? '+' + fmt(FUSION_REACTOR_HEAT_RATE) + ' MW' : '+0 MW', color: '#ff9a3a' });
      rows.push({ label: '耗电速率', value: '−' + fmt(FUSION_REACTOR_POWER_INPUT) + ' MW', color: '#ffd23c' });
      rows.push({ label: '耗冷液', value: '−' + fmt(FUSION_REACTOR_FLUID_USAGE) + '/秒 氟酮冷液', color: '#ff8a7a' });
      rows.push({ label: '当前温度', value: Math.round(e.temperature()) + ' °C / 最高 ' + HEAT_MAX_TEMP + ' °C' });
    } else if (e instanceof Boiler) {
      rows.push({ label: '耗水速率', value: '−' + fmt(e.burning ? BOILER_WATER_RATE : 0) + '/秒 水', color: '#ff8a7a' });
      rows.push({ label: '产汽速率', value: '+' + fmt(e.burning ? BOILER_WATER_RATE : 0) + '/秒 蒸汽', color: '#8fe08f' });
      rows.push({ label: '当前温度', value: Math.round(e.temp || 0) + ' °C / 最高 ' + BOILER_TEMP_MAX + ' °C' });
    } else return;
    secs.push({ title: '🌡 热量', rows });
  })();

  // ---- 燃料库存（燃烧设备） ----
  (function fuelSec() {
    if (!(e instanceof Boiler) && !(e instanceof Furnace) && !(e instanceof Drill) && !(e instanceof HeatingTower)) return;
    const agg = {};
    if (e.fuelRocket > 0) agg['rocket-fuel'] = e.fuelRocket;
    if (e.fuelSolid > 0) agg['solid-fuel'] = e.fuelSolid;
    if (e.fuelCoal > 0) agg['coal'] = e.fuelCoal;
    if (e.fuelWood > 0) agg['wood'] = e.fuelWood;
    if (!Object.keys(agg).length) return;
    secs.push({ title: '🪵 燃料', rows: [{ label: '库存', value: _hoverAggText(agg) }] });
  })();

  // ---- 内部缓存（输入/输出/流体/载物） ----
  (function bufSec() {
    const rows = [];
    if (e instanceof Drill) {
      rows.push({ label: '矿物缓冲', value: fmt(e.buf || 0) + ' / ' + DRILL_BUFFER_CAP + (e.bufItem ? '（' + (ITEMS[e.bufItem] ? ITEMS[e.bufItem].name : e.bufItem) + '）' : '') });
      if ((e.acid || 0) > 0) rows.push({ label: '硫酸缓冲', value: fmt(e.acid) + ' / ' + ELECTRIC_DRILL_ACID_MAX });
    }
    if (e.inp && Object.keys(e.inp).filter(k => e.inp[k] > 0).length) rows.push({ label: '输入缓存', value: _hoverAggText(e.inp) });
    if (e.outp && Object.keys(e.outp).filter(k => e.outp[k] > 0).length) rows.push({ label: '输出缓存', value: _hoverAggText(e.outp) });
    if (e instanceof SteamEngine || e instanceof SteamTurbine) rows.push({ label: '储汽', value: fmt(e.steamBuf || 0) + ' / ' + (e instanceof SteamTurbine ? TURBINE_STEAM_CAP : ENGINE_STEAM_CAP) });
    if (e instanceof Boiler) { rows.push({ label: '储水', value: fmt(e.water || 0) + ' / ' + WATER_CAP }); rows.push({ label: '储汽', value: fmt(e.steamBuf || 0) + ' / ' + WATER_CAP }); }
    if (e instanceof HeatExchanger) { rows.push({ label: '储水', value: fmt(e.water || 0) + ' / ' + WATER_CAP }); rows.push({ label: '储汽', value: fmt(e.steamBuf || 0) + ' / ' + TURBINE_STEAM_CAP }); }
    if (e instanceof Belt && e.items && e.items.length) {
      const agg = {};
      for (const o of e.items) agg[o.item] = (agg[o.item] || 0) + 1;
      rows.push({ label: '载物', value: _hoverAggText(agg) });
      const mult = e.speedMult ? e.speedMult() : 1;
      rows.push({ label: '吞吐', value: fmt((1 / BELT_SPACING) * beltSpeed() * mult) + ' 件/秒（双车道合计）', color: '#8fe08f' });
    }
    if (e instanceof Inserter) {
      if (e.holding) rows.push({ label: '搬运中', value: (ITEMS[e.holding] ? ITEMS[e.holding].name : e.holding) + (e.holdingCount > 1 ? '×' + e.holdingCount : '') });
      rows.push({ label: '运载速度', value: '×' + (e.rotSpeed || 1) + ' 基础臂（堆叠 ' + (e.stackMax || 1) + '）' });
    }
    if (e instanceof Lab) {
      const agg = {};
      for (const k in e.packs) if (e.packs[k] > 0) agg[k] = e.packs[k];
      if (Object.keys(agg).length) rows.push({ label: '科学包', value: _hoverAggText(agg) });
    }
    if (e instanceof RocketSilo) {
      rows.push({ label: '火箭部件', value: (e.parts || 0) + ' / ' + ROCKET_PARTS });
      if (e.inp && Object.keys(e.inp).filter(k => e.inp[k] > 0).length) rows.push({ label: '原料缓存', value: _hoverAggText(e.inp) });
    }
    if (e instanceof Pipe && e.total() > 0) rows.push({ label: '管内流体', value: _hoverAggText(e.fluid) + ' / 容量 ' + PIPE_CAP });
    if (e instanceof StorageTank && e.total() > 0) rows.push({ label: '罐内流体', value: _hoverAggText(e.fluid) + ' / 容量 ' + STORAGE_TANK_CAP });
    if (!rows.length) return;
    secs.push({ title: '📦 缓存', rows });
  })();

  // ---- 炮塔：射程 / 冷却 / 耗电 / 伤害（官方 GAME_DATA.turret 单源） ----
  (function turretSec() {
    const t = GAME_DATA.turret && GAME_DATA.turret[e.type];
    if (!t) return;
    const rows = [];
    if (t.range) rows.push({ label: '射程', value: t.range + ' 格' });
    if (t.fireRate) rows.push({ label: '射击间隔', value: t.fireRate + ' 秒' });
    if (t.powerDraw) rows.push({ label: '射击耗电', value: t.powerDraw + ' kW' });
    if (t.drain) rows.push({ label: '待机耗电', value: t.drain + ' kW' });
    if (t.damage) rows.push({ label: '单发伤害', value: String(t.damage) });
    if (!rows.length) return;
    secs.push({ title: '🎯 武器', rows });
  })();

  // ---- 机器人港：对齐《异星工厂》2.0 官方 tooltip 完整字段 ----
  // 官方数据源（factorio-data/base/prototypes/entity/entities.lua + wiki Roboport）：
  //   max_health=500, energy_usage=50kW（最小能耗/drain）, charging_energy=500kW（每充电桩）,
  //   charging_offsets=4 桩, logistics_radius=25（50×50 供应区域）, construction_radius=55（110×110 建设区域）,
  //   robot_slots_count=7, radar_range=2（区块，wiki 默认值）,
  //   surface_conditions=pressure>=10hPa（space-age/base-data-updates.lua ten_pressure_condition）,
  //   最大能耗（内部缓冲充电速率）=4×500+50=2050kW≈2.1MW（wiki Internal buffer recharge rate）
  (function roboportSec() {
    if (!(e instanceof Roboport)) return;
    const range = GAME_DATA.roboportRange || {};
    const logiR = range.logistics ?? 25;            // 官方 logistics_radius=25
    const constrR = range.construction ?? 55;       // 官方 construction_radius=55
    const radarRange = range.radarRange ?? 2;        // 官方 radar_range 默认 2 区块（wiki）
    const chargePorts = range.chargingPorts ?? 4;    // 官方 charging_offsets 4 桩
    const chargeKW = range.chargingEnergy ?? 500;   // 官方 charging_energy 500kW/桩
    const drainKW = GAME_DATA.roboportPower ?? 50;   // 官方 energy_usage 50kW
    const maxKW = chargePorts * chargeKW + drainKW;  // 4×500+50=2050kW≈2.1MW
    const hp = (GAME_DATA.buildingHp && GAME_DATA.buildingHp[e.type]) || 500;
    const cur = (e.hp !== undefined && e.maxhp) ? Math.min(hp, Math.max(0, Math.round(e.hp))) : hp;

    // 可用机器人数量 = 整个物流网络（G.logiNet.ports 全部机器人港）中的机器人数量，而非仅当前设备：
    //   物流机器人 = 全网络闲置且满电的归港实体 / 全网络港内物流机器人总量
    //   建设机器人 = 全网络建设机器人总量（暂为纯存储、未派生飞行实体，全部视为可用待命）
    // 存储 = 当前设备内放置的机器人数量及修理包数量（可用数量的设备侧子集）。
    const netPorts = (G.logiNet && G.logiNet.ports) || null;
    const inNet = netPorts ? (p => netPorts.indexOf(p) >= 0) : (p => p === e);
    let logiAvail = 0, logiNetTotal = 0, constrNetTotal = 0;
    if (G.logiRobots) {
      for (const r of G.logiRobots) {
        if (r._dead || !inNet(r.home)) continue;
        if (r.state === 'idle' && r.charge >= ROBOT_MAX_CHARGE) logiAvail++;
      }
    }
    for (const p of (netPorts || [e])) {
      if (p._dead) continue;
      logiNetTotal += (typeof p.countOf === 'function') ? p.countOf('logistic-robot') : 0;
      constrNetTotal += (typeof p.countOf === 'function') ? p.countOf('construction-robot') : 0;
    }
    // 存储（当前设备）：港内两种机器人台数 + 修理包数量
    const logiStored = (typeof e.countOf === 'function') ? e.countOf('logistic-robot') : 0;
    const constrStored = (typeof e.countOf === 'function') ? e.countOf('construction-robot') : 0;
    const matStored = (typeof e.matCount === 'function') ? e.matCount('repair-pack') : 0;

    // 运行状态：有电即「正常运转」，断电则「断电停摆」（对齐官方 tooltip 顶部状态行）
    const sat = (typeof powerSatOf === 'function') ? powerSatOf(e) : (G.power ? G.power.sat : 1);
    const statusText = sat > 0 ? '正常运转' : '断电停摆';
    const statusColor = sat > 0 ? '#8fe08f' : '#ff5b5b';

    // 功率格式化（1 位小数，对齐官方 50.0 kW / 2.1 MW 显示）
    const fmtP1 = k => k >= 1000 ? (Math.round(k / 100) / 10).toFixed(1) + ' MW' : k.toFixed(1) + ' kW';

    // 段 1：可用机器人数量（网络整体；含运行状态行）
    secs.push({
      title: '可用机器人数量', rows: [
        { label: null, value: statusText, color: statusColor },
        { label: '·物流机器人', value: logiAvail + '/' + logiNetTotal },
        { label: '·建设机器人', value: constrNetTotal + '/' + constrNetTotal },
      ]
    });
    // 段 2：存储（当前设备内放置的机器人 + 修理包）——以物品图标显示，数量用右上角标展示
    secs.push({
      title: '存储', icons: [
        { id: 'logistic-robot', count: logiStored, badge: true },
        { id: 'construction-robot', count: constrStored, badge: true },
        { id: 'repair-pack', count: matStored, badge: true },
      ]
    });
    // 段 3：设备参数（范围/雷达/生命值）
    secs.push({
      title: '设备参数', rows: [
        { label: '供应区域', value: (logiR * 2) + '×' + (logiR * 2) },
        { label: '建设区域', value: (constrR * 2) + '×' + (constrR * 2) },
        { label: '雷达覆盖距离', value: String(radarRange) },
        { label: '生命值', value: cur + '/' + hp },
      ]
    });
    // 段 4：消耗电力
    secs.push({
      title: '⚡ 消耗电力', rows: [
        { label: '机器人充电速度', value: chargePorts + '×' + chargeKW + 'kW' },
        { label: '最大能耗', value: fmtP1(maxKW) },
        { label: '最小能耗', value: fmtP1(drainKW) },
        { label: '供电', value: Math.round(sat * 100) + ' %' + (sat >= 1 ? '（充足）' : (sat > 0 ? '（不足）' : '（断电）')), color: sat >= 1 ? '#8fe08f' : (sat > 0 ? '#ffd23c' : '#ff5b5b') },
      ]
    });
    // 段 5：建造表面条件
    secs.push({
      title: '建造表面条件', rows: [
        { label: '气压', value: '≥ 10 hPa' },
      ]
    });
  })();

  return secs;
}

// ===== 设备信息面板（小地图下方长条） =====
// 鼠标悬停到设备/矿脉/树木/敌人/地形上时，在小地图正下方绘制详情面板
// （地图上不显示鼠标附近的悬浮框，详情统一在此展示）。
// 宽度与小地图完全一致并紧贴其下方/屏幕边缘；内容与排版对齐《异星工厂》官方 tooltip：
// 金色名称标题 + 物品图标 + 描述 + 分隔线 + 官方字段行
// （采矿速度/制造速度/研究速度/运载速度/存储容量/消耗量/污染/插件槽位/生命值），
// 字段标签取自官方 core.cfg [description]，数值全部来自 GAME_DATA 单源。
// 文本超宽时自动换行（标题/描述/字段值均可折行），不做省略号截断。
function drawDeviceInfoBar(ctx) {
  // 仅在小地图开启时展示（面板锚定在小地图正下方）
  if (!(G.settings && G.settings.minimap !== false)) return;
  if (!G.cursorTile) return;
  const { tx, ty } = G.cursorTile;
  const hovered = entAt(tx, ty);
  if (!hovered || hovered._dead || !hovered.type || !ITEMS[hovered.type]) {
    // 非设备瓦片（矿脉/树木/峭壁/水域/敌人）：同样在小地图下方显示详情
    if (!hovered) _drawMapTileInfoBar(ctx, tx, ty);
    return;
  }
  const e = hovered;
  const it = ITEMS[e.type];

  const name = localizedName(e.type, it.name || e.type);
  const desc = it.desc || '';
  const ds = GAME_DATA.deviceStats && GAME_DATA.deviceStats[e.type];

  // ---- 动态运行时信息（配方速率/电力/热量/缓存等，随设备实时刷新）----
  const secs = _hoverRuntimeSections(e);

  // ---- 收集官方字段（GAME_DATA 单源；标签对齐官方 core.cfg [description]）----
  // 顺序对齐官方 tooltip：速度类 → 存储容量 → 能量 → 污染 → 插件槽位 → 生命值。
  const lines = [];
  const add = (label, value) => lines.push({ label, value });

  // 速度类（官方 制造速度/采矿速度/研究速度/运载速度）
  if (ds && ds.miningSpeed) add('采矿速度', String(ds.miningSpeed));
  if (ds && ds.craftingSpeed) add('制造速度', String(ds.craftingSpeed));
  if (ds && ds.researchingSpeed) add('研究速度', String(ds.researchingSpeed));
  if (ds && ds.beltSpeed) add('运载速度', Math.round(ds.beltSpeed * 8) + ' 个/秒'); // 官方 15 个/秒 = 1.875 格/秒 × 8

  // 存储容量（管道/地下管道/储液罐/流体车厢；官方 core.cfg fluid-capacity=存储容量）
  const fcap = GAME_DATA.fluidCapacity;
  if (fcap) {
    const cap = (e.type === 'storage-tank') ? fcap.storageTank
      : (e.type === 'pipe') ? fcap.pipeVolume
      : (e.type === 'pipe-to-ground') ? fcap.pipeToGroundVolume
      : (e.type === 'fluid-wagon') ? fcap.fluidWagon
      : null;
    if (cap) add('存储容量', String(cap));
  }

  // 消耗量（官方 core.cfg energy-consumption=消耗量；燃烧器设备显示“(燃烧器)”，其余“(电能)”）
  // 机器人港的能耗信息由 roboportSec 统一展示（对齐官方 tooltip 消耗电力段），此处跳过避免重复
  const pw = GAME_DATA.powerUse && GAME_DATA.powerUse[e.type];
  if (pw && !(e instanceof Roboport)) add('消耗量', pw + ' kW（' + (_BURNER_DEVICES.has(e.type) ? '燃烧器' : '电能') + '）');

  // 污染
  const poll = GAME_DATA.pollution && GAME_DATA.pollution[e.type];
  if (poll) add('污染', poll + ' / 分钟');

  // 插件槽位
  if (ds && ds.moduleSlots) add('插件槽位', String(ds.moduleSlots));

  // 生命值（官方 tooltip 中位于最末；受损时显示当前/最大）
  // 机器人港的生命值由 roboportSec 统一展示（对齐官方 tooltip 排版），此处跳过避免重复
  const hp = GAME_DATA.buildingHp && GAME_DATA.buildingHp[e.type];
  if (hp && !(e instanceof Roboport)) {
    const cur = (e.hp !== undefined && e.maxhp) ? Math.min(hp, Math.max(0, Math.round(e.hp))) : hp;
    add('生命值', cur >= hp ? String(hp) : cur + '/' + hp);
  }

  // 「显示详情」模式下悬停流体出入口图标：在面板中补显该口流体（替代原鼠标旁悬浮框）
  if (G.showDetails) {
    const fn = DEVICE_FLUID_ICONS[e.type];
    if (fn) {
      for (const ic of fn(e)) {
        if (ic.x === tx && ic.y === ty && ITEMS[ic.fluid]) {
          add('流体', ITEMS[ic.fluid].name + (ITEMS[ic.fluid].desc ? '（' + ITEMS[ic.fluid].desc + '）' : ''));
          break;
        }
      }
    }
  }

  // ---- 布局：宽度与小地图一致，紧贴其下方、紧贴屏幕右边缘 ----
  const bw = MINIMAP_SIZE;               // 宽度与小地图完全一致
  const bx = W - MINIMAP_SIZE;           // 右缘贴屏幕右边缘（与小地图右缘对齐）
  const top = MINIMAP_SIZE;              // 顶缘紧贴小地图底边（无间距）
  const pad = 9;                         // 左侧内边距
  const padR = 14;                       // 右侧内边距（文本不贴右边框）
  const iconW = it.emoji ? 19 : 0;       // 物品图标占宽
  const innerW = bw - pad - padR;        // 内容区宽

  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  // 标题：名称折行（短名称单行不变）
  ctx.font = 'bold 12.5px system-ui';
  const titleLines = _wrapTooltipText(ctx, name, innerW - iconW);

  // 描述：折行显示
  ctx.font = '10.5px system-ui';
  const descLines = desc ? _wrapTooltipText(ctx, desc, innerW - iconW) : [];

  // 字段行：标签灰 + 值白；值超宽则换行（续行缩进到数值列），列宽过窄时标签独占一行
  const rows = [];
  for (const f of lines) {
    const labelFull = f.label + '：';
    const labelW = ctx.measureText(labelFull).width;
    const vx = bx + pad + labelW + 6;
    const valueMaxW = (bx + bw - padR) - vx;
    if (valueMaxW < 24) {
      rows.push({ label: labelFull, value: null, vx });
      for (const vl of _wrapTooltipText(ctx, f.value, innerW)) rows.push({ label: null, value: vl, vx: bx + pad });
    } else {
      const vLines = _wrapTooltipText(ctx, f.value, valueMaxW);
      rows.push({ label: labelFull, value: vLines[0], vx });
      for (let i = 1; i < vLines.length; i++) rows.push({ label: null, value: vLines[i], vx });
    }
  }

  // ---- 高度：由折行后的行数累加 ----
  const titleLh = 16;                    // 标题行高
  const descLh = 13;                     // 描述行高
  const fieldLh = 14;                    // 字段行高
  const iconRowLh = 20;                  // 图标行高（存储段：一行图标 + 角标）
  const sepBefore = 3;                   // 描述→分隔线间距
  const sepAfter = 5;                    // 分隔线→字段间距
  const padTop = 8, padBottom = 8;
  // 预排版动态段（标签灰 + 值白，值超宽折行；带 icons 的段为图标行，直接透传），同时累计行数
  const secBlocks = [];
  const secTitleLh = 15;
  ctx.font = '10.5px system-ui';
  for (const s of secs) {
    if (s.icons) { secBlocks.push({ title: s.title, icons: s.icons }); continue; }
    const secRows = [];
    for (const f of s.rows) {
      const labelFull = f.label ? (f.label + '：') : '';
      const labelW = ctx.measureText(labelFull).width;
      const vx = bx + pad + labelW + 6;
      const valueMaxW = (bx + bw - padR) - vx;
      const vLines = _wrapTooltipText(ctx, f.value || '', Math.max(24, valueMaxW));
      secRows.push({ label: labelFull, value: vLines[0], vx, color: f.color });
      for (let i = 1; i < vLines.length; i++) secRows.push({ label: null, value: vLines[i], vx: bx + pad, color: f.color });
    }
    secBlocks.push({ title: s.title, rows: secRows });
  }
  const bh = padTop + titleLines.length * titleLh
    + descLines.length * descLh
    + sepBefore + 1 + sepAfter
    + rows.length * fieldLh
    + (secBlocks.length ? (3 + secBlocks.reduce((n, s) => n + secTitleLh + (s.icons ? iconRowLh : s.rows.length * fieldLh), 0)) : 0)
    + padBottom;

  // ---- 背景（官方 tooltip 深色半透明底 + 细边框）----
  ctx.fillStyle = 'rgba(15,16,14,0.92)';
  ctx.strokeStyle = 'rgba(150,150,140,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(bx, top, bw, bh, 4) : ctx.rect(bx, top, bw, bh);
  ctx.fill(); ctx.stroke();

  // ---- 标题（名称，金色粗体，前接物品图标，对齐官方 tooltip 图标+名称）----
  let y = top + padTop;
  let nx = bx + pad;
  if (it.emoji) { ctx.font = '13px system-ui'; ctx.fillText(it.emoji, nx, y); nx += iconW; ctx.font = 'bold 12.5px system-ui'; }
  ctx.fillStyle = '#ffd43b';
  for (const tl of titleLines) { ctx.fillText(tl, nx, y); y += titleLh; }

  // ---- 描述（浅色正文，超宽换行）----
  if (descLines.length) {
    ctx.font = '10.5px system-ui';
    ctx.fillStyle = 'rgba(226,228,222,0.9)';
    for (const dl of descLines) { ctx.fillText(dl, bx + pad + iconW, y); y += descLh; }
  }

  // ---- 分隔线 ----
  y += sepBefore;
  ctx.strokeStyle = 'rgba(200,200,190,0.18)';
  ctx.beginPath();
  ctx.moveTo(bx + pad, y);
  ctx.lineTo(bx + bw - padR, y);
  ctx.stroke();
  y += 1 + sepAfter;

  // ---- 官方字段行（标签灰 + 值白，值超宽换行）----
  ctx.font = '10.5px system-ui';
  for (const r of rows) {
    if (r.label) { ctx.fillStyle = 'rgba(160,164,155,0.85)'; ctx.fillText(r.label, bx + pad, y); }
    if (r.value) { ctx.fillStyle = 'rgba(240,242,236,0.95)'; ctx.fillText(r.value, r.vx, y); }
    y += fieldLh;
  }

  // ---- 动态运行时段（小节标题 + 字段行 / 图标行，随实时状态逐帧刷新）----
  for (const s of secBlocks) {
    y += 3;
    ctx.font = 'bold 11px system-ui';
    ctx.fillStyle = 'rgba(255,212,59,0.75)';
    ctx.fillText(s.title, bx + pad, y);
    y += secTitleLh;
    // 图标行（存储段）：物品以图标显示，数量以右上角标展示
    if (s.icons) {
      const ISZ = 16, ISP = 23;   // 图标边长 / 图标间距
      let ix = bx + pad;
      for (const ic of s.icons) {
        drawItemGlyph(ctx, ic.id, ix + ISZ / 2, y + ISZ / 2, ISZ);
        if (ic.badge) {
          const bx0 = ix + ISZ - 6, by0 = y + ISZ - 9, bw = 12, bh = 10;  // 角标：图标右下角
          ctx.fillStyle = 'rgba(18,20,16,0.9)';
          ctx.strokeStyle = 'rgba(255,255,255,0.55)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          if (ctx.roundRect) ctx.roundRect(bx0, by0, bw, bh, 3);
          else ctx.rect(bx0, by0, bw, bh);
          ctx.fill(); ctx.stroke();
          ctx.fillStyle = '#fff';
          ctx.font = 'bold 8px system-ui';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(String(ic.count), bx0 + bw / 2, by0 + bh / 2 + 0.5);
          ctx.textAlign = 'left';
          ctx.textBaseline = 'top';
        }
        ix += ISP;
      }
      ctx.font = '10.5px system-ui';
      y += iconRowLh;
      continue;
    }
    ctx.font = '10.5px system-ui';
    for (const r of s.rows) {
      if (r.label) { ctx.fillStyle = 'rgba(160,164,155,0.85)'; ctx.fillText(r.label, bx + pad, y); }
      if (r.value) { ctx.fillStyle = r.color || 'rgba(240,242,236,0.95)'; ctx.fillText(r.value, r.vx, y); }
      y += fieldLh;
    }
  }
}

// ===== 非设备瓦片详情面板（小地图下方长条） =====
// 矿脉/树木/峭壁/水域/敌人等无实体官方字段，复用 mapTipAt 的「名称|描述」文案，
// 以与设备面板相同样式（金色标题 + 描述折行）绘制在小地图正下方。
function _drawMapTileInfoBar(ctx, tx, ty) {
  if (typeof mapTipAt !== 'function') return;
  const tip = mapTipAt(tx, ty);
  if (!tip) return;
  const p = tip.split('|');
  const name = p[0] || '';
  const desc = p.slice(1).join('|');
  let emoji = '';
  const ti = getOreType(tx, ty);
  if (ti >= 0 && getOreAmt(tx, ty) > 0) {
    const oi = ITEMS[oreItemId(ti)];
    if (oi && oi.emoji) emoji = oi.emoji;
  }
  const bw = MINIMAP_SIZE;
  const bx = W - MINIMAP_SIZE;
  const top = MINIMAP_SIZE;
  const pad = 9, padR = 14;
  const iconW = emoji ? 19 : 0;
  const innerW = bw - pad - padR;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  ctx.font = 'bold 12.5px system-ui';
  const titleLines = _wrapTooltipText(ctx, name, innerW - iconW);
  ctx.font = '10.5px system-ui';
  const descLines = desc ? _wrapTooltipText(ctx, desc, innerW - iconW) : [];
  const titleLh = 16, descLh = 13, padTop = 8, padBottom = 8;
  const bh = padTop + titleLines.length * titleLh + descLines.length * descLh + padBottom;
  ctx.fillStyle = 'rgba(15,16,14,0.92)';
  ctx.strokeStyle = 'rgba(150,150,140,0.45)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.roundRect ? ctx.roundRect(bx, top, bw, bh, 4) : ctx.rect(bx, top, bw, bh);
  ctx.fill(); ctx.stroke();
  let y = top + padTop;
  let nx = bx + pad;
  if (emoji) { ctx.font = '13px system-ui'; ctx.fillText(emoji, nx, y); nx += iconW; ctx.font = 'bold 12.5px system-ui'; }
  ctx.fillStyle = '#ffd43b';
  for (const tl of titleLines) { ctx.fillText(tl, nx, y); y += titleLh; }
  if (descLines.length) {
    ctx.font = '10.5px system-ui';
    ctx.fillStyle = 'rgba(226,228,222,0.9)';
    for (const dl of descLines) { ctx.fillText(dl, bx + pad + iconW, y); y += descLh; }
  }
}
