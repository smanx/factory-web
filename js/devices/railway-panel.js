'use strict';

// ===== 车头自动调度面板 =====
function locoScheduleHtml(e) {
  const stops = allTrainStopNames();
  let h = '<div class="sec">🚂 自动调度路线（对齐《异星工厂》Schedule）</div>';
  if (!stops.length) {
    h += '<div class="dim">尚未放置任何车站。请先放置车站（Train Stop）到铁轨上，再回来配置路线。</div>';
    return h;
  }
  // 当前路线
  h += '<div class="rows">';
  if (!e.schedule || !e.schedule.length) h += '<div class="dim">未配置路线：列车将一直直线行驶、遇站装卸。配置路线后按序循环往返各站。</div>';
  else for (let i = 0; i < e.schedule.length; i++) {
    const en = e.schedule[i];
    const stopName = routeEntryName(en);
    const cond = routeEntryCond(en);
    const tm = routeEntryTime(en);
    const cc = (en && en.circuit) || {};
    h += '<div class="row"><span>' + (i + 1) + '. ' + chip('train-stop') + ' ' + stopName + '</span>' +
      '<button data-act="sch-up" data-idx="' + i + '" title="上移">↑</button>' +
      '<button data-act="sch-down" data-idx="' + i + '" title="下移">↓</button>' +
      '<button data-act="sch-del" data-idx="' + i + '" title="删除该站">✕</button></div>' +
      '<div class="row" style="padding-left:16px"><span class="dim">等待</span>' +
      '<select data-act="sch-cond" data-idx="' + i + '">' +
        '<option value="leave"' + (cond === 'leave' ? ' selected' : '') + '>装卸后出发</option>' +
        '<option value="full"' + (cond === 'full' ? ' selected' : '') + '>满载后出发</option>' +
        '<option value="empty"' + (cond === 'empty' ? ' selected' : '') + '>卸空后出发</option>' +
        '<option value="time"' + (cond === 'time' ? ' selected' : '') + '>停留固定秒数</option>' +
        '<option value="circuit"' + (cond === 'circuit' ? ' selected' : '') + '>电路条件（对齐异星工厂）</option>' +
      '</select>' +
      (cond === 'time' ? '<input type="number" min="1" max="120" value="' + tm + '" style="width:50px" data-act="sch-time" data-idx="' + i + '">秒' : '') +
      (cond === 'circuit'
        ? '<div class="row" style="padding-left:16px"><span class="dim">电路信号</span>' +
          '<select data-act="sch-cch" data-idx="' + i + '">' + (typeof channelSelect === 'function' ? channelSelect(cc.channel || 'red') : '') + '</select>' +
          '<input type="text" data-act="sch-csig" data-idx="' + i + '" value="' + (typeof signalDisplayName === 'function' ? signalDisplayName(cc.sig || 'iron-plate') : (ITEMS[cc.sig] ? ITEMS[cc.sig].name : (cc.sig || ''))) + '" placeholder="信号" style="width:70px" autocomplete="off">' +
          '<select data-act="sch-cop" data-idx="' + i + '">' + ['>', '<', '=', '!=', '>=', '<='].map(o => '<option value="' + o + '"' + ((cc.op || '>') === o ? ' selected' : '') + '>' + o + '</option>').join('') + '</select>' +
          '<input type="number" data-act="sch-ccnt" data-idx="' + i + '" value="' + (cc.count === undefined ? 1 : cc.count) + '" min="-99999" max="99999" style="width:60px"></div>' +
          '<div class="row" style="padding-left:16px"><span class="dim">列车在该站等待至电路网络信号满足条件后发车；需在车站旁连接电线杆/组合器。</span></div>'
        : '') +
      '</div>';
  }
  h += '</div>';
  // 添加站点（下拉选择车站）
  h += '<div class="rows"><div class="row"><span>加入站点</span><select id="sch-add" data-act="sch-add">' +
    stops.map((n, i) => '<option value="' + n + '">' + n + '</option>').join('') +
    '</select><button data-act="sch-add-btn">＋ 追加</button></div></div>';
  h += '<div class="dim">路线按顺序循环：列车沿铁轨驶向路线中的每个车站，到站自动装卸该站的“装载/卸载”物品，随后前往下一站。用此实现两站（或多站）间往返自动化运输。</div>';
  return h;
}

DEVICE_PANEL['locomotive'] = {
  html(e) {
    return '<div class="dim">车头：烧燃料在铁轨上行驶。装入煤/固体燃料后自动前进，可挂接货运车厢。固体燃料更耐用。</div>' +
      '<div class="sec">燃料</div><div class="rows">' +
      '<div class="row"><span>煤</span><b>' + (e.fuelCoal || 0) + '</b><button data-act="putcoal">+1</button><button data-act="takecoal">取出</button></div>' +
      (invCount('solid-fuel') > 0 || (e.fuelSolid || 0) > 0
        ? '<div class="row"><span>固体燃料</span><b>' + (e.fuelSolid || 0) + '</b><button data-act="putsolid">+1</button><button data-act="takesolid">取出</button></div>'
        : '') +
      (invCount('rocket-fuel') > 0 || (e.fuelRocket || 0) > 0
        ? '<div class="row"><span>火箭燃料</span><b>' + (e.fuelRocket || 0) + '</b><button data-act="putrocket">+1</button><button data-act="takerocket">取出</button></div>'
        : '') +
      (invCount('nuclear-fuel') > 0 || (e.fuelNuclear || 0) > 0
        ? '<div class="row"><span>核燃料</span><b>' + (e.fuelNuclear || 0) + '</b><button data-act="putnuclear">+1</button><button data-act="takenuclear">取出</button></div>'
        : '') +
      (invCount('wood') > 0 || (e.fuelWood || 0) > 0
        ? '<div class="row"><span>木材</span><b>' + (e.fuelWood || 0) + '</b><button data-act="putwood">+1</button><button data-act="takewood">取出</button></div>'
        : '') +
      '</div>' + locoScheduleHtml(e);
  },
  live() { return ''; },
  tip() { return 'g'; },
  onAction(btn, e) {
    const mch = G.panelEnt;   // 实体通过 G.panelEnt 获取（对齐其它设备面板 onAction 惯例）
    const idx = +((e && e.dataset && e.dataset.idx) || -1);   // 按钮/控件 DOM 元素在第二参
    if (btn === 'putcoal' && invCount('coal') > 0) { mch.giveItem('coal'); invTake('coal', 1); toast('已加煤'); uiDirty = true; }
    else if (btn === 'takecoal') { const it = mch.takeItemOf('coal'); if (it) { invAdd(it); toast('已取出煤'); uiDirty = true; } }
    else if (btn === 'putsolid' && invCount('solid-fuel') > 0) { mch.giveItem('solid-fuel'); invTake('solid-fuel', 1); toast('已加固体燃料'); uiDirty = true; }
    else if (btn === 'takesolid') { const it = mch.takeItemOf('solid-fuel'); if (it) { invAdd(it); toast('已取出固体燃料'); uiDirty = true; } }
    else if (btn === 'putrocket' && invCount('rocket-fuel') > 0) { mch.giveItem('rocket-fuel'); invTake('rocket-fuel', 1); toast('已加火箭燃料'); uiDirty = true; }
    else if (btn === 'takerocket') { const it = mch.takeItemOf('rocket-fuel'); if (it) { invAdd(it); toast('已取出火箭燃料'); uiDirty = true; } }
    else if (btn === 'putnuclear' && invCount('nuclear-fuel') > 0) { mch.giveItem('nuclear-fuel'); invTake('nuclear-fuel', 1); toast('已加核燃料'); uiDirty = true; }
    else if (btn === 'takenuclear') { const it = mch.takeItemOf('nuclear-fuel'); if (it) { invAdd(it); toast('已取出核燃料'); uiDirty = true; } }
    else if (btn === 'putwood' && invCount('wood') > 0) { mch.giveItem('wood'); invTake('wood', 1); toast('已加木材'); uiDirty = true; }
    else if (btn === 'takewood') { const it = mch.takeItemOf('wood'); if (it) { invAdd(it); toast('已取出木材'); uiDirty = true; } }
    else if (btn === 'sch-add-btn') {
      const sel = document.getElementById('sch-add');
      if (sel && sel.value) {
        mch.schedule = mch.schedule || [];
        // 新加入站点默认“装卸后出发”，可再逐站设置等待条件（对齐《异星工厂》wait conditions）
        mch.schedule.push({ stop: sel.value, cond: 'leave', time: 10 });
        // 同步到所属列车的 route（若列车已在运行）
        syncLocoSchedule(mch);
        // 成就：设置列车自动调度路线（对齐《异星工厂》：Getting on track like a pro）
        if (typeof achEnsureStats === 'function') { achEnsureStats(); G.achStats.trainRoutes++; checkAchievements(); }
        toast('已把车站「' + sel.value + '」加入路线');
        uiDirty = true;
      }
    }
    else if (locoScheduleEntryAction(btn, e, idx, mch)) { /* handled by shared helper */ }
    else if (btn === 'sch-del' || btn === 'sch-up' || btn === 'sch-down') {
      if (!mch.schedule || idx < 0 || idx >= mch.schedule.length) return true;
      if (btn === 'sch-del') mch.schedule.splice(idx, 1);
      else if (btn === 'sch-up' && idx > 0) { const t = mch.schedule[idx]; mch.schedule[idx] = mch.schedule[idx - 1]; mch.schedule[idx - 1] = t; }
      else if (btn === 'sch-down' && idx < mch.schedule.length - 1) { const t = mch.schedule[idx]; mch.schedule[idx] = mch.schedule[idx + 1]; mch.schedule[idx + 1] = t; }
      syncLocoSchedule(mch);
      uiDirty = true;
    }
    return true;
  }
};

// 把车头的 schedule 同步到其所属列车的 route（编辑路线时实时生效）
function syncLocoSchedule(loco) {
  for (const tr of G.trains) {
    if (tr.cars[0] === loco) {
      tr.route = (loco.schedule || []).slice();
      if (tr.routeIdx >= tr.route.length) tr.routeIdx = 0;
      return;
    }
  }
}

// 调度路线条目统一动作处理（普通/内燃机车共用）：sch-cond / sch-time / sch-cch / sch-csig / sch-cop / sch-ccnt
function locoScheduleEntryAction(btn, e, idx, mch) {
  if (!mch.schedule || idx < 0 || idx >= mch.schedule.length) return false;
  const en = mch.schedule[idx];
  const enObj = (typeof en === 'object' && en) ? en : { stop: en, time: 10 };
  mch.schedule[idx] = enObj;
  if (btn === 'sch-cond') {
    enObj.cond = (e && e.value) || 'leave';
    // 切到电路条件时，若无电路配置则初始化默认（对齐异星工厂 wait condition 默认）
    if (enObj.cond === 'circuit' && !(enObj.circuit && enObj.circuit.enabled)) {
      enObj.circuit = { enabled: true, channel: 'red', sig: 'iron-plate', op: '>', count: 1 };
    }
  }
  else if (btn === 'sch-time') enObj.time = Math.max(1, Math.min(120, (+((e && e.value) || 10))));
  else if (btn === 'sch-cch') { if (!enObj.circuit) enObj.circuit = { enabled: true, channel: 'red', sig: 'iron-plate', op: '>', count: 1 }; enObj.circuit.channel = (e && e.value) || 'red'; }
  else if (btn === 'sch-cop') { if (!enObj.circuit) enObj.circuit = { enabled: true, channel: 'red', sig: 'iron-plate', op: '>', count: 1 }; enObj.circuit.op = (e && e.value) || '>'; }
  else if (btn === 'sch-ccnt') { if (!enObj.circuit) enObj.circuit = { enabled: true, channel: 'red', sig: 'iron-plate', op: '>', count: 1 }; enObj.circuit.count = Math.floor(Number((e && e.value))) || 0; }
  else if (btn === 'sch-csig') {
    if (!enObj.circuit) enObj.circuit = { enabled: true, channel: 'red', sig: 'iron-plate', op: '>', count: 1 };
    const txt = (e && e.value) || '';
    enObj.circuit.sig = (typeof resolveSignalName === 'function' ? resolveSignalName(txt) : txt) || enObj.circuit.sig;
  }
  else return false;
  syncLocoSchedule(mch);
  uiDirty = true;
  return true;
}

// 内燃机车面板：复用调度路线，但不吃煤（只吃固体/火箭燃料）
DEVICE_PANEL['diesel-locomotive'] = {
  html(e) {
    return '<div class="dim">内燃机车：进阶车头，速度约为烧煤车头的 1.5 倍。只吃固体燃料/火箭燃料/核燃料（不吃煤，对齐《异星工厂》内燃机车）。可挂接货运车厢。</div>' +
      '<div class="sec">燃料</div><div class="rows">' +
      (invCount('solid-fuel') > 0 || (e.fuelSolid || 0) > 0
        ? '<div class="row"><span>固体燃料</span><b>' + (e.fuelSolid || 0) + '</b><button data-act="putsolid">+1</button><button data-act="takesolid">取出</button></div>'
        : '') +
      (invCount('rocket-fuel') > 0 || (e.fuelRocket || 0) > 0
        ? '<div class="row"><span>火箭燃料</span><b>' + (e.fuelRocket || 0) + '</b><button data-act="putrocket">+1</button><button data-act="takerocket">取出</button></div>'
        : '') +
      (invCount('nuclear-fuel') > 0 || (e.fuelNuclear || 0) > 0
        ? '<div class="row"><span>核燃料</span><b>' + (e.fuelNuclear || 0) + '</b><button data-act="putnuclear">+1</button><button data-act="takenuclear">取出</button></div>'
        : '') +
      '</div>' + locoScheduleHtml(e);
  },
  live() { return ''; },
  tip() { return 'g'; },
  onAction(btn, e) {
    const mch = G.panelEnt;
    const idx = +((e && e.dataset && e.dataset.idx) || -1);
    if (btn === 'putsolid' && invCount('solid-fuel') > 0) { mch.giveItem('solid-fuel'); invTake('solid-fuel', 1); toast('已加固体燃料'); uiDirty = true; }
    else if (btn === 'takesolid') { const it = mch.takeItemOf('solid-fuel'); if (it) { invAdd(it); toast('已取出固体燃料'); uiDirty = true; } }
    else if (btn === 'putrocket' && invCount('rocket-fuel') > 0) { mch.giveItem('rocket-fuel'); invTake('rocket-fuel', 1); toast('已加火箭燃料'); uiDirty = true; }
    else if (btn === 'takerocket') { const it = mch.takeItemOf('rocket-fuel'); if (it) { invAdd(it); toast('已取出火箭燃料'); uiDirty = true; } }
    else if (btn === 'putnuclear' && invCount('nuclear-fuel') > 0) { mch.giveItem('nuclear-fuel'); invTake('nuclear-fuel', 1); toast('已加核燃料'); uiDirty = true; }
    else if (btn === 'takenuclear') { const it = mch.takeItemOf('nuclear-fuel'); if (it) { invAdd(it); toast('已取出核燃料'); uiDirty = true; } }
    else if (btn === 'sch-add-btn') {
      const sel = document.getElementById('sch-add');
      if (sel && sel.value) {
        mch.schedule = mch.schedule || [];
        mch.schedule.push({ stop: sel.value, cond: 'leave', time: 10 });
        syncLocoSchedule(mch);
        toast('已把车站「' + sel.value + '」加入路线');
        uiDirty = true;
      }
    }
    else if (locoScheduleEntryAction(btn, e, idx, mch)) { /* handled by shared helper */ }
    else if (btn === 'sch-del' || btn === 'sch-up' || btn === 'sch-down') {
      if (!mch.schedule || idx < 0 || idx >= mch.schedule.length) return true;
      if (btn === 'sch-del') mch.schedule.splice(idx, 1);
      else if (btn === 'sch-up' && idx > 0) { const t = mch.schedule[idx]; mch.schedule[idx] = mch.schedule[idx - 1]; mch.schedule[idx - 1] = t; }
      else if (btn === 'sch-down' && idx < mch.schedule.length - 1) { const t = mch.schedule[idx]; mch.schedule[idx] = mch.schedule[idx + 1]; mch.schedule[idx + 1] = t; }
      syncLocoSchedule(mch);
      uiDirty = true;
    }
    return true;
  }
};

DEVICE_PANEL['cargo-wagon'] = {
  html(e) {
    let h = '<div class="dim">货运车厢：挂在车头后随列车移动，最多 ' + wagonSlots() + ' 格各 ' + WAGON_STACK + ' 个。车站可用机械臂装卸。可为每个槽位设置<b>过滤物</b>（对齐《异星工厂》Cargo wagon 过滤槽），设置后该槽只能装入指定物品，便于分类运输。</div><div class="sec">货物</div><div class="rows">';
    if (!e.slots || !e.slots.length) h += '<div class="dim">车厢是空的</div>';
    else for (const s of e.slots) if (s) h += '<div class="row"><span>' + ITEMS[s.item].name + '</span><b>' + s.count + '</b><button data-act="take" data-id="' + s.item + '">取出1</button></div>';
    h += '</div>';
    // 过滤槽设置：为前 wagonSlots() 个槽位提供过滤下拉
    h += '<div class="sec">槽位过滤</div><div class="rows">';
    const choices = (typeof filterChoices === 'function' ? filterChoices() : FILTER_CHOICES);
    for (let i = 0; i < wagonSlots(); i++) {
      const flt = e.slotFilter ? e.slotFilter(i) : null;
      const cur = e.slots[i];
      const occ = cur ? cur.item : null;
      h += '<div class="row"><span>槽 ' + (i + 1) + (occ ? '（' + ITEMS[occ].name + ' ×' + cur.count + '）' : '（空）') + '</span>' +
        '<select data-idx="' + i + '" class="wf-sel"><option value="">无过滤</option>' +
        choices.map(c => '<option value="' + c + '"' + (flt === c ? ' selected' : '') + '>' + ITEMS[c].name + '</option>').join('') +
        '</select></div>';
    }
    h += '</div>';
    return h;
  },
  live() { return ''; },
  tip() { return 'g'; },
  onAction(btn, e) {
    const mch = G.panelEnt;
    // 按钮/控件 DOM 元素在第二参（对齐本文件其它设备面板惯例）
    const el = e || btn;   // 兼容直接传元素
    const id = el && el.dataset ? el.dataset.id : null;
    if (btn === 'take' && id && mch.countOf(id) > 0) {
      const it = mch.takeItemOf(id); if (it) { invAdd(it); uiDirty = true; }
      return true;
    }
    // 槽位过滤下拉变更（data-idx 在下拉元素上）
    if (btn === 'wf-set' && el && mch) {
      const idx = parseInt(el.dataset ? el.dataset.idx : -1, 10);
      const val = el.value;
      if (!isNaN(idx) && idx >= 0 && mch.setSlotFilter) { mch.setSlotFilter(idx, val || null); uiDirty = true; }
      return true;
    }
    return true;
  }
};

DEVICE_PANEL['fluid-wagon'] = {
  html(e) {
    const fc = (typeof e.fluidContents === 'function') ? e.fluidContents() : null;
    let h = '<div class="dim">流体车厢：挂在车头后随列车移动，可运输任意一种流体（容量 ' + FLUID_WAGON_CAP + '）。可用流体泵从侧边装卸，或面板手动加/取。可设置<b>流体过滤</b>（对齐《异星工厂》Fluid wagon），设置后仅接受该流体，避免混装。</div><div class="sec">装载</div>';
    if (!fc || fc.count <= 0) h += '<div class="dim">车厢是空的</div>';
    else h += '<div class="row"><span>' + (ITEMS[fc.item] ? ITEMS[fc.item].name : fc.item) + '</span><b>' + fc.count + ' / ' + FLUID_WAGON_CAP + '</b></div>';
    // 手动装卸流体下拉
    const opts = FLUIDS.map(f => '<option value="' + f + '">' + (ITEMS[f] ? ITEMS[f].name : f) + '</option>').join('');
    h += '<div class="rows"><div class="row"><span>装载流体</span><select id="fw-fluid">' + opts + '</select>' +
      '<button data-act="fw-add">加1000</button><button data-act="fw-take">取1000</button></div>';
    // 流体过滤设置
    const fltOpts = FLUIDS.map(f => '<option value="' + f + '"' + (e.fluidFilter === f ? ' selected' : '') + '>' + (ITEMS[f] ? ITEMS[f].name : f) + '</option>').join('');
    h += '<div class="row"><span>流体过滤</span><select class="wf-sel" data-idx="ff"><option value="">无过滤</option>' + fltOpts + '</select></div>';
    h += '</div>';
    return h;
  },
  live() { return ''; },
  tip() { return 'g'; },
  onAction(btn, e) {
    const mch = G.panelEnt;
    if (btn === 'fw-add' || btn === 'fw-take') {
      const sel = document.getElementById('fw-fluid');
      const fid = sel ? sel.value : 'water';
      if (btn === 'fw-add') {
        if (!invCount(fid)) { toast('背包里没有该流体'); return true; }
        const n = mch.addFluid(fid, 1000);
        if (n > 0) { invTake(fid, n); toast('已装入 ' + n + ' ' + (ITEMS[fid] ? ITEMS[fid].name : fid)); uiDirty = true; }
        else toast('车厢已满或流体不兼容');
      } else {
        const n = mch.takeFluid(fid, 1000);
        if (n > 0) { invAdd(fid, n); toast('已取出 ' + n); uiDirty = true; }
        else toast('没有可取的流体');
      }
      return true;
    }
    // 流体过滤下拉变更（复用 wf-sel 分发；DOM 元素在第二参）
    if (btn === 'wf-set' && mch) {
      const el = e || btn;
      mch.fluidFilter = (el && el.value) ? el.value : null;
      uiDirty = true;
      return true;
    }
    return true;
  }
};

// ===== 炮兵车厢面板 =====
DEVICE_PANEL['artillery-wagon'] = {
  html(e) {
    let h = '<div class="dim">炮兵车厢：挂在车头后随列车移动，行驶/停靠期间自动轰击射程内远处敌人（' + (typeof artilleryRange === 'function' ? artilleryRange() : ARTILLERY_RANGE) + ' 格，基础 ' + ARTILLERY_RANGE + '，受「炮兵射程」无限科技加成），命中造成 ' + ARTILLERY_DMG + ' 点大范围爆炸（对齐《异星工厂》Artillery wagon）。</div><div class="sec">炮弹</div>';
    h += '<div class="row"><span>炮兵炮弹</span><b>' + e.shells + ' / ' + ARTILLERY_WAGON_SHELLS + '</b></div>';
    const n = invCount('artillery-shell');
    if (n > 0) h += '<button data-action="feed" data-id="artillery-shell">装入炮弹 ×' + n + '</button>';
    if (e.shells > 0) h += '<button data-action="takeout" id="btn-aw-takeout">取出全部炮弹</button>';
    h += '<div class="status"></div>';
    return h;
  },
  live(e, api) {
    api.set('shells', e.shells + ' / ' + ARTILLERY_WAGON_SHELLS);
    api.toggle('#btn-aw-takeout', e.shells > 0, '取出全部炮弹 (' + e.shells + ')');
    if (e.shells <= 0) api.status('已暂停：无炮弹', 'warn');
    else api.status('待机：列车行驶/停靠时自动轰击敌人', 'ok');
  },
  tip(e) { return e.shells <= 0 ? '无炮弹，需装入炮弹' : '待机（炮弹 ×' + e.shells + '）'; }
};

// ===== 放置/拆除钩子（包装 addEnt/removeEnt，维护 railTiles 与列车编组）=====
const __railAddEnt = addEnt;
const __railRemoveEnt = removeEnt;
addEnt = function (e) {
  __railAddEnt(e);
  afterRailAdd(e);
};
removeEnt = function (e) {
  beforeRailRemove(e);
  __railRemoveEnt(e);
};

function afterRailAdd(e) {
  ensureRailGlobals();
  if (e instanceof Rail) registerRail(e.x, e.y);
  else if (e instanceof Locomotive || e instanceof CargoWagon) {
    // 车头/车厢放置：加入列车编组
    if (!e._inTrain) {
      addTrainCar(e, e.x, e.y);
      e._inTrain = true;
    }
  }
}

function beforeRailRemove(e) {
  if (e instanceof Rail) unregisterRail(e.x, e.y);
  else if (e instanceof Locomotive || e instanceof CargoWagon) {
    removeTrainCar(e);
    e._inTrain = false;
  }
}

// ===== 实体注册 =====
ENT_CLASSES['rail'] = Rail;
ENT_CLASSES['locomotive'] = Locomotive;
ENT_CLASSES['diesel-locomotive'] = DieselLocomotive;
ENT_CLASSES['cargo-wagon'] = CargoWagon;
ENT_CLASSES['fluid-wagon'] = FluidWagon;
ENT_CLASSES['artillery-wagon'] = ArtilleryWagon;
ENT_CLASSES['train-stop'] = TrainStop;
ENT_CLASSES['rail-signal'] = RailSignal;
ENT_CLASSES['rail-chain-signal'] = RailChainSignal;

// R 键可旋转车头（决定行进方向）
DEVICE_DIR_ROTATE['locomotive'] = true;
DEVICE_DIR_ROTATE['diesel-locomotive'] = true;
DEVICE_DIR_ROTATE['fluid-wagon'] = true;

// 放置规则
DEVICE_PLACE['rail'] = null;   // 铁轨放任何空地
DEVICE_PLACE['locomotive'] = (type, tx, ty) => railHas(tx, ty) ? { ok: true } : { ok: false };
DEVICE_PLACE['diesel-locomotive'] = (type, tx, ty) => railHas(tx, ty) ? { ok: true } : { ok: false };
DEVICE_PLACE['cargo-wagon'] = (type, tx, ty) => railHas(tx, ty) ? { ok: true } : { ok: false };
DEVICE_PLACE['fluid-wagon'] = (type, tx, ty) => railHas(tx, ty) ? { ok: true } : { ok: false };
DEVICE_PLACE['artillery-wagon'] = (type, tx, ty) => railHas(tx, ty) ? { ok: true } : { ok: false };
DEVICE_PLACE['train-stop'] = (type, tx, ty) => railHas(tx, ty) ? { ok: true } : { ok: false };
// 信号灯：放在铁轨旁任意一格（四周有铁轨即可）
DEVICE_PLACE['rail-signal'] = (type, tx, ty) => {
  const c = railConnAt(tx, ty);
  return (c.E || c.S || c.W || c.N) ? { ok: true } : { ok: false };
};
// 链式信号灯：同样放在铁轨旁（四周有铁轨即可）
DEVICE_PLACE['rail-chain-signal'] = (type, tx, ty) => {
  const c = railConnAt(tx, ty);
  return (c.E || c.S || c.W || c.N) ? { ok: true } : { ok: false };
};

// 读档后重建列车编组（由 main.js applySave 末尾调用）

// ===== 车站面板：配置自动装卸清单 =====
// 装卸循环：点击物品，状态在 [未选 → 装载(load) → 卸载(unload) → 未选] 间循环。
function trainStopPanelHtml(e) {
  let h = '<div class="dim">车站：列车停靠后自动装卸货。下方选择物品并设“装载/卸载”。</div>';
  // 车站名（用于列车自动调度路线引用）
  h += '<div class="sec">车站名（自动调度引用）</div>' +
    '<div class="rows"><div class="row"><input id="ts-name" type="text" maxlength="12" value="' + escHtml(e.displayName()) + '" placeholder="车站名">' +
    '<button data-act="ts-rename">重命名</button></div></div>' +
    '<div class="dim">给本站命名后，在车头面板的“自动调度路线”里把本站加入路线，列车即可按路线循环往返本站装卸。</div>';
  h += '<div class="sec">装载（箱子→车厢）</div><div class="rows">';
  if (!e.load || !e.load.length) h += '<div class="dim">未设置</div>';
  else for (const id of e.load) h += '<div class="row"><span>' + chip(id) + ' ' + ITEMS[id].name + '</span><button data-action="ts-unload" data-id="' + id + '">→卸</button><button data-action="ts-rm" data-id="' + id + '">✕</button></div>';
  h += '</div>';
  h += '<div class="sec">卸载（车厢→箱子）</div><div class="rows">';
  if (!e.unload || !e.unload.length) h += '<div class="dim">未设置</div>';
  else for (const id of e.unload) h += '<div class="row"><span>' + chip(id) + ' ' + ITEMS[id].name + '</span><button data-action="ts-load" data-id="' + id + '">→装</button><button data-action="ts-rm" data-id="' + id + '">✕</button></div>';
  h += '</div>';
  h += '<div class="sec">选择物品</div><div class="recgrid">';
  const choices = (typeof filterChoices === 'function' ? filterChoices() : []);
  for (const id of choices) {
    const state = (e.load && e.load.includes(id)) ? 'L' : (e.unload && e.unload.includes(id)) ? 'U' : '';
    h += '<button class="rcbtn ' + (state ? 'sel' : '') + '" data-action="ts-toggle" data-id="' + id + '" data-itemid="' + id + '">' +
      (state ? '<b>[' + state + ']</b>' : '') + '<img src="' + iconDataURL(id) + '">' + ITEMS[id].name + '</button>';
  }
  h += '</div>';
  h += '<div class="sec">电路选项</div>' +
    '<div class="row"><button data-action="ts-readtrain" class="rcbtn ' + (e.readTrain ? 'sel' : '') + '">' +
    (e.readTrain ? '✓ ' : '') + '读取列车内容（输出到电路网络）</button></div>' +
    '<div class="dim">开启后，把停靠列车所有车厢所载物品与流体以物品信号输出到所连电路网络，供组合器/功率开关/告警音箱按列车载货量自动化调度（对齐《异星工厂》车站 Read train contents）。</div>';
  h += '<div class="status"></div>';
  h += '<div class="dim">放置：把车站放在铁轨上，车站旁（3×3）放储物箱。列车停靠时，自动把“卸载”物品从车厢卸入箱子、把“装载”物品从箱子装入车厢。对齐《异星工厂》火车车站装卸。</div>';
  h += '<div class="dim">已接入电路网络：有列车停靠本站时输出 signal-train（车站列车信号）到所连网络，供组合器/功率开关/告警音箱读取，实现按列车到站自动化的调度（对齐《异星工厂》车站电路信号）。</div>';
  return h;
}
function trainStopPanelLive(e, api) {
  let n = (e.load ? e.load.length : 0) + (e.unload ? e.unload.length : 0);
  const sched = stationInSchedule(e);
  const parts = [];
  if (sched) parts.push('已纳入列车自动调度路线（蓝色光环标记）');
  if (n) parts.push('已配置 ' + n + ' 种装卸物品');
  else parts.push('未配置装卸（列车仅短暂停车）');
  if (e.readTrain) parts.push('已开启读取列车内容');
  api.status(parts.join(' · '), (sched ? 'ok' : n ? 'ok' : 'warn'));
}
function trainStopOnAction(act, btn) {
  const st = G.panelEnt;
  if (!st || !(st instanceof TrainStop)) return false;
  if (act === 'ts-readtrain') {
    st.readTrain = !st.readTrain;
    toast(st.readTrain ? '已开启：输出停靠列车内容信号到电路网络' : '已关闭读取列车内容');
    uiDirty = true;
    return true;
  }
  if (act === 'ts-rename') {
    const inp = document.getElementById('ts-name');
    if (inp && inp.value.trim()) {
      const name = inp.value.trim().slice(0, 12);
      st.name = name;
      // 车站改名后，所有调度路线中的旧名引用失效——同步各列车：若旧自动名被引用则跟随改名
      toast('车站已命名为「' + name + '」');
      uiDirty = true;
      return true;
    }
    return true;
  }
  const id = btn && btn.dataset ? btn.dataset.id : null;
  if (!id) return false;
  if (act === 'ts-rm') {
    st.load = (st.load || []).filter(x => x !== id);
    st.unload = (st.unload || []).filter(x => x !== id);
    return true;
  }
  if (act === 'ts-load') {
    st.load = (st.load || []).filter(x => x !== id);
    if (!st.load.includes(id)) st.load.push(id);
    st.unload = (st.unload || []).filter(x => x !== id);
    return true;
  }
  if (act === 'ts-unload') {
    st.unload = (st.unload || []).filter(x => x !== id);
    if (!st.unload.includes(id)) st.unload.push(id);
    st.load = (st.load || []).filter(x => x !== id);
    return true;
  }
  if (act === 'ts-toggle') {
    // 循环：未选 → 装载 → 卸载 → 未选
    if (st.load && st.load.includes(id)) {
      st.load = st.load.filter(x => x !== id);
      if (!st.unload.includes(id)) st.unload.push(id);
    } else if (st.unload && st.unload.includes(id)) {
      st.unload = st.unload.filter(x => x !== id);
    } else {
      if (!st.load.includes(id)) st.load.push(id);
    }
    return true;
  }
  return false;
}
DEVICE_PANEL['train-stop'] = { html: trainStopPanelHtml, live: trainStopPanelLive, tip: () => '车站（列车停靠装卸）', onAction: trainStopOnAction };
DEVICE_STATUS['train-stop'] = () => 'g';
function rebuildTrains() {
  G.trains = [];
  G.railTiles = new Set();
  for (const e of G.ents) {
    if (e._dead) continue;
    if (e instanceof Rail) registerRail(e.x, e.y);
  }
  for (const e of G.ents) {
    if (e._dead) continue;
    if (e instanceof Locomotive || e instanceof CargoWagon) {
      e._inTrain = false;
      addTrainCar(e, e.x, e.y);
      e._inTrain = true;
    }
  }
}
