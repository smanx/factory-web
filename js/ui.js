'use strict';

let uiDirty = true;

const ICON_CACHE = {};
const URL_CACHE = {};

function iconDataURL(id) {
  let u = URL_CACHE[id];
  if (!u) {
    u = iconCanvas(id, 34).toDataURL();
    URL_CACHE[id] = u;
  }
  return u;
}

function iconCanvas(id, size = 34) {
  const key = id + '_' + size;
  if (ICON_CACHE[key]) return ICON_CACHE[key];
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const x = c.getContext('2d');
  const it = ITEMS[id];
  x.fillStyle = '#20242b';
  rr(x, 1, 1, size - 2, size - 2, 6);
  x.fill();
  x.strokeStyle = it.color;
  x.lineWidth = 2;
  x.stroke();
  x.fillStyle = it.color;
  drawItemGlyph(x, id, size / 2, size / 2, size * 0.72);
  ICON_CACHE[key] = c;
  return c;
}


function gearShape(x, cx, cy, rOuter, rInner, teeth) {
  x.beginPath();
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i / (teeth * 2)) * Math.PI * 2;
    const rad = i % 2 === 0 ? rOuter : rInner;
    const px = cx + Math.cos(a) * rad, py = cy + Math.sin(a) * rad;
    if (i === 0) x.moveTo(px, py); else x.lineTo(px, py);
  }
  x.closePath();
  x.moveTo(cx + rInner * 0.45, cy);
  x.arc(cx, cy, rInner * 0.45, 0, Math.PI * 2);
}

function tri(x, x1, y1, x2, y2, x3, y3) {
  x.beginPath();
  x.moveTo(x1, y1); x.lineTo(x2, y2); x.lineTo(x3, y3);
  x.closePath();
  return x;
}

function rr(x, px, py, w, h, r) {
  x.beginPath();
  x.moveTo(px + r, py);
  x.arcTo(px + w, py, px + w, py + h, r);
  x.arcTo(px + w, py + h, px, py + h, r);
  x.arcTo(px, py + h, px, py, r);
  x.arcTo(px, py, px + w, py, r);
  x.closePath();
  return x;
}

function buildHotbar() {
  const hb = document.getElementById('hotbar');
  hb.innerHTML = '';
  HOTBAR.forEach((id, i) => {
    const slot = document.createElement('div');
    slot.className = 'slot' + (id ? '' : ' nilslot');
    slot.dataset.idx = i;
    if (id) slot.dataset.tip = ITEMS[id].name + '|' + ITEMS[id].desc;
    else slot.dataset.tip = '空槽位|打开背包(E)，在快捷栏编辑器里点选槽位后点击任意物品即可放入';
    if (id) {
      const ic = iconCanvas(id).cloneNode();
      ic.getContext('2d').drawImage(iconCanvas(id), 0, 0);
      slot.appendChild(ic);
    } else {
      const emp = document.createElement('span');
      emp.className = 'nilmark';
      emp.textContent = '空';
      slot.appendChild(emp);
    }
    const cnt = document.createElement('span');
    cnt.className = 'cnt';
    cnt.id = 'hb-cnt-' + i;
    slot.appendChild(cnt);
    const key = document.createElement('span');
    key.className = 'key';
    key.textContent = i === 9 ? '0' : i + 1;
    slot.appendChild(key);
    slot.addEventListener('click', () => selectSlot(i));
    hb.appendChild(slot);
  });
  refreshHotbar();
}

function refreshHotbar() {
  HOTBAR.forEach((id, i) => {
    const el = document.getElementById('hb-cnt-' + i);
    if (!el) return;
    el.textContent = id ? invCount(id) : '';
    const slot = document.getElementById('hotbar').children[i];
    slot.classList.toggle('active', G.sel === i);
    slot.classList.toggle('empty', !!id && invCount(id) <= 0);
  });
}

function selectSlot(i) {
  G.sel = (G.sel === i ? -1 : i);
  refreshHotbar();
  closePanel(false);
}

function toast(msg) {
  const box = document.getElementById('toasts');
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  box.appendChild(t);
  setTimeout(() => { t.classList.add('fade'); }, 2200);
  setTimeout(() => t.remove(), 2800);
  while (box.children.length > 6) box.firstChild.remove();
}

function openPanel(mode, ent) {
  G.panelMode = mode;
  G.panelEnt = ent || null;
  document.getElementById('panel').style.display = 'flex';
  renderPanel(true);
}

function closePanel(hide = true) {
  G.panelMode = null;
  G.panelEnt = null;
  if (hide) document.getElementById('panel').style.display = 'none';
}

function panelScrollTop() {
  const p = document.getElementById('panel-body');
  return p ? p.scrollTop : 0;
}

function renderPanel(full) {
  const body = document.getElementById('panel-body');
  const title = document.getElementById('panel-title');
  if (!G.panelMode) { document.getElementById('panel').style.display = 'none'; return; }
  const st = full ? 0 : panelScrollTop();
  if (G.panelMode === 'inv') {
    title.textContent = '背包与手工制造';
    body.innerHTML = htmlInventory();
  } else if (G.panelMode === 'tech') {
    title.textContent = '科技研究';
    body.innerHTML = htmlTech();
  } else if (G.panelMode === 'set') {
    title.textContent = '设置';
    body.innerHTML = htmlSettings();
  } else if (G.panelMode === 'machine' && G.panelEnt) {
    title.textContent = ITEMS[G.panelEnt.type].name;
    body.innerHTML = htmlMachine(G.panelEnt);
  }
  body.scrollTop = st;
}

function updateMachineLive() {
  if (G.panelMode !== 'machine' || !G.panelEnt) return;
  const e = G.panelEnt;
  if (!G.ents.includes(e)) { closePanel(); return; }
  const body = document.getElementById('panel-body');
  const set = (k, v) => {
    const el = body.querySelector('[data-live="' + k + '"]');
    if (el && el.innerHTML !== v) el.innerHTML = v;
  };
  const toggle = (sel, show, txt) => {
    const el = body.querySelector(sel);
    if (!el) return;
    if (!show) { el.style.display = 'none'; return; }
    el.style.display = '';
    if (txt && el.textContent !== txt) el.textContent = txt;
  };
  const dim = s => '<span class="dim">' + s + '</span>';
  let prog = 0, status = '';
  if (e instanceof Furnace) {
    set('fuel', e.fuelCoal > 0 ? chip('coal', e.fuelCoal) : dim('无'));
    set('input', Object.keys(e.inp).length ? countStr(e.inp) : dim('空'));
    set('output', Object.keys(e.outp).length ? countStr(e.outp) : dim('空'));
    const n = Object.values(e.outp).reduce((a, b) => a + b, 0);
    toggle('#btn-takeout', n > 0, '取回全部输出 (' + n + ')');
    prog = e.prog * 100;
    status = e.lit ? '冶炼中' : e.cur ? '等待燃料' : '待料（放入燃料和矿石）';
  } else if (e instanceof Assembler) {
    set('input', Object.keys(e.inp).length ? countStr(e.inp) : dim('空'));
    set('output', Object.keys(e.outp).length ? countStr(e.outp) : dim('空'));
    const n = Object.values(e.outp).reduce((a, b) => a + b, 0);
    toggle('#btn-takeout', n > 0, '取回全部输出 (' + n + ')');
    prog = e.recipe && e.crafting ? e.prog / RECIPES[e.recipe].time * 100 : 0;
  } else if (e instanceof Drill) {
    set('fuel', e.fuelCoal > 0 ? chip('coal', e.fuelCoal) : dim('无'));
    set('buffer', e.buf > 0 && e.bufItem ? chip(e.bufItem, e.buf) : dim('空'));
    toggle('#btn-drill-takeout', e.buf > 0, '取回缓存 (' + e.buf + ')');
    prog = e.working ? e.prog / DRILL_TIME * 100 : 0;
    status = e.status || ('开采中，产出朝' + ['东', '南', '西', '北'][e.dir]);
  } else if (e instanceof Lab) {
    set('packs', e.packs > 0 ? chip('science-pack', e.packs) : dim('无'));
    toggle('#btn-lab-takeout', e.packs > 0, '取回科学包 (' + e.packs + ')');
    set('techline', G.activeTech ? TECHS[G.activeTech].name : dim('未选择（T 打开研究面板）'));
    prog = e.t / LAB_TIME * 100;
  } else if (e instanceof Chest) {
    const agg = {};
    for (const s of e.slots) if (s) agg[s.item] = (agg[s.item] || 0) + s.count;
    set('contents', Object.keys(agg).length ? countStr(agg) : dim('空'));
    return;
  }
  const bar = body.querySelector('.bar i');
  if (bar) bar.style.width = Math.max(0, Math.min(100, prog)) + '%';
  const stEl = body.querySelector('.status');
  if (stEl && status && stEl.textContent !== status) stEl.textContent = status;
}

function chip(id, n) {
  return '<span class="chip" data-itemid="' + id + '" data-tip="' + ITEMS[id].name + '|' + ITEMS[id].desc + '"><img src="' + iconDataURL(id) + '">' +
    ITEMS[id].name + (n !== undefined ? ' ×' + n : '') + '</span>';
}

function htmlInventory() {
  let h = '<div class="sec">快捷栏编辑</div><div class="hbedit" id="hbedit">';
  for (let i = 0; i < 10; i++) {
    const id = HOTBAR[i];
    h += '<div class="hbslot ' + (G.hbArm === i ? 'arm' : '') + '" data-hbedit="' + i + '" data-tip="' +
      (id ? '槽位' + (i === 9 ? 0 : i + 1) + '：' + ITEMS[id].name + '|点击两次清空；或先点这里再点下方物品替换' : '空槽位' + (i === 9 ? 0 : i + 1) + '|点击选中后，再点下方任意物品放入') + '">' +
      (id ? '<img src="' + iconDataURL(id) + '">' : '<span>空</span>') + '</div>';
  }
  h += '</div><div class="dim">点一个槽位选中（黄框），再点击下面任意物品图标即可放入该槽位；再点一次同槽位清空。数字键 1-9/0 切换。</div>';
  h += '<div class="sec">材料</div><div class="chips">';
  let any = false;
  for (const id in ITEMS) {
    const n = invCount(id);
    if (n > 0) { h += chip(id, n); any = true; }
  }
  if (!any) h += '<span class="dim">空空如也，去地图上按住左键挖矿吧（铁矿/铜矿/煤/石头）</span>';
  h += '</div><div class="sec">配方</div>';
  for (const rid in RECIPES) {
    const rec = RECIPES[rid];
    const ok = canCraft(rid);
    h += '<div class="recipe">';
    const outId = Object.keys(rec.out)[0];
    h += '<img class="ric" data-itemid="' + outId + '" data-tip="' + ITEMS[outId].name + '|' + ITEMS[outId].desc + '" src="' + iconDataURL(outId) + '">';
    h += '<div class="rmain"><div class="rname">' + ITEMS[Object.keys(rec.out)[0]].name +
      (rec.out[Object.keys(rec.out)[0]] > 1 ? ' ×' + rec.out[Object.keys(rec.out)[0]] : '') + '</div>';
    h += '<div class="ring">';
    for (const k in rec.inp) {
      const have = invCount(k);
      h += '<span class="ing ' + (have >= rec.inp[k] ? '' : 'lack') + '" data-itemid="' + k + '" data-tip="' + ITEMS[k].name + '|' + ITEMS[k].desc + '">' +
        '<img src="' + iconDataURL(k) + '">' + ITEMS[k].name + ' ' + have + '/' + rec.inp[k] + '</span>';
    }
    h += '</div></div>';
    h += '<button data-action="craft" data-id="' + rid + '" ' + (ok ? '' : 'disabled') + '>合成</button>';
    if (ok) h += '<button data-action="craft" data-mult="5" data-id="' + rid + '">×5</button>';
    h += '</div>';
  }
  h += '<div class="hint">提示：开局先挖 5 个石头合成石炉，再挖煤；点击炉子打开面板，把煤和矿石放进去就能炼铁板/铜板。机械臂需要电路板（要先用炉子炼出铜板）。</div>';
  return h;
}

function htmlTech() {
  let h = '';
  for (const tid in TECHS) {
    const t = TECHS[tid];
    const done = G.techDone[tid];
    const prog = G.techProg[tid] || 0;
    h += '<div class="recipe tech ' + (done ? 'done' : '') + '">';
    h += '<div class="rmain"><div class="rname">' + t.name + '</div><div class="dim">' + t.desc + '</div>';
    h += '<div class="bar"><i style="width:' + Math.min(100, prog / t.cost * 100) + '%"></i></div>';
    h += '<div class="dim">' + (done ? '已完成' : prog + ' / ' + t.cost + ' 科学包') + '</div></div>';
    if (!done) {
      h += (G.activeTech === tid)
        ? '<button data-action="tech-cancel">取消</button>'
        : '<button data-action="tech" data-id="' + tid + '">研究</button>';
    }
    h += '</div>';
  }
  h += '<div class="hint">建造研究院，放入科学包后选择课题；机械臂可自动喂科学包。</div>';
  return h;
}

function countStr(o) {
  const parts = [];
  for (const k in o) parts.push(chip(k, o[k]));
  return parts.join('');
}

function htmlMachine(e) {
  if (e instanceof Furnace) {
    let h = row('燃料', e.fuelCoal > 0 ? chip('coal', e.fuelCoal) : '<span class="dim">无</span>', 'fuel');
    if (invCount('coal') > 0)
      h += '<button data-action="fuel" data-id="coal">加入 5 煤 (' + invCount('coal') + ')</button>';
    h += row('输入', Object.keys(e.inp).length ? countStr(e.inp) : '<span class="dim">空</span>', 'input');
    for (const r of SMELTS) {
      const n = Math.min(invCount(r.inp), 25 - (e.inp[r.inp] || 0));
      if (n > 0) h += '<button data-action="feed" data-id="' + r.inp + '">放入' +
        ITEMS[r.inp].name + ' ×' + n + '</button>';
    }
    if (Object.keys(e.inp).length) h += '<button data-action="takein">取回全部输入</button>';
    h += row('输出', Object.keys(e.outp).length ? countStr(e.outp) : '<span class="dim">空</span>', 'output');
    h += '<button data-action="takeout" id="btn-takeout" style="display:none"></button>';
    h += barHtml(0);
    h += '<div class="status"></div>';
    return h;
  }
  if (e instanceof Assembler) {
    let h = row('当前配方', e.recipe ? ITEMS[Object.keys(RECIPES[e.recipe].out)[0]].name : '<span class="dim">未设置</span>');
    h += row('输入', Object.keys(e.inp).length ? countStr(e.inp) : '<span class="dim">空</span>', 'input');
    if (e.recipe)
      for (const k in RECIPES[e.recipe].inp) {
        const n = Math.min(invCount(k), 50 - (e.inp[k] || 0));
        if (n > 0) h += '<button data-action="feed" data-id="' + k + '">放入' +
          ITEMS[k].name + ' ×' + n + '</button>';
      }
    if (Object.keys(e.inp).length) h += '<button data-action="takein">取回全部输入</button>';
    h += row('输出', Object.keys(e.outp).length ? countStr(e.outp) : '<span class="dim">空</span>', 'output');
    h += '<button data-action="takeout" id="btn-takeout" style="display:none"></button>';
    h += barHtml(0);
    h += '<div class="sec">选择配方</div><div class="recgrid">';
    for (const rid in RECIPES) {
      const outId = Object.keys(RECIPES[rid].out)[0];
      const selCls = e.recipe === rid ? 'sel' : '';
      h += '<button class="rcbtn ' + selCls + '" data-action="recipe" data-id="' + rid + '" data-itemid="' + outId + '" data-tip="' +
        ITEMS[outId].name + '|' + RECIPES[rid].out[outId] + '个/次，耗时' + RECIPES[rid].time + '秒">' +
        '<img src="' + iconDataURL(outId) + '">' + ITEMS[outId].name + '</button>';
    }
    h += '</div>';
    if (e.recipe) h += '<button data-action="recipe-clear">清除配方</button>';
    return h;
  }
  if (e instanceof Drill) {
    let h = row('燃料', e.fuelCoal > 0 ? chip('coal', e.fuelCoal) : '<span class="dim">无</span>', 'fuel');
    if (invCount('coal') > 0)
      h += '<button data-action="fuel" data-id="coal">加入 5 煤 (' + invCount('coal') + ')</button>';
    h += row('矿物缓存', '<span class="dim"></span>', 'buffer');
    h += '<button data-action="takeout" id="btn-drill-takeout" style="display:none"></button>';
    h += barHtml(0);
    h += '<div class="status"></div>';
    h += '<div class="dim">产出方向朝' + ['东', '南', '西', '北'][e.dir] + '，选中后按 R 旋转（需先关闭本面板或按 Q 取消选择）</div>';
    return h;
  }
  if (e instanceof Lab) {
    let h = row('科学包', '', 'packs');
    if (invCount('science-pack') > 0)
      h += '<button data-action="labfill">从背包放入 10 科学包 (' + invCount('science-pack') + ')</button>';
    h += '<button data-action="takeout" id="btn-lab-takeout" style="display:none"></button>';
    h += barHtml(0);
    h += row('课题', '', 'techline');
    return h;
  }
  if (e instanceof Chest) {
    const agg = {};
    for (const s of e.slots) if (s) agg[s.item] = (agg[s.item] || 0) + s.count;
    let h = row('内容', Object.keys(agg).length ? countStr(agg) : '<span class="dim">空</span>', 'contents');
    let canDeposit = false;
    for (const id of [...ORES, 'coal']) if (invCount(id) > 0) { canDeposit = true; break; }
    if (canDeposit) h += '<button data-action="chest-deposit">存入全部矿物/燃料</button>';
    if (Object.keys(agg).length) h += '<button data-action="takeout">取出全部</button>';
    return h;
  }
  if (e instanceof Splitter)
    return '<div class="dim">分流器：货物轮流分向前方和右侧；一边堵了自动走另一边。R 旋转方向。</div>';
  if (e instanceof Underground) {
    let txt;
    if (e.findMate()) txt = '【入口】货物钻入地下送往同向6格内出口。缓存 ' + e.items.length + '/' + UG_CAP + '，待发 ' + e.outItems.length;
    else if (e.findBackMate()) txt = '【出口】接收上游隧道来货并向前输出。待发 ' + e.outItems.length;
    else txt = '【未配对】同向6格内没有另一座（中间不能隔固体建筑）。仍可收货排队，配对后自动发车。缓存 ' + e.items.length + '/' + UG_CAP;
    return '<div class="dim">地下带' + txt + '。R 旋转方向。</div>';
  }
  if (e instanceof Inserter)
    return '<div class="dim">机械臂：自动从周围8格（含斜角）取货——优先背面；放到优先正面开始的空位。某边堵了自动换边。R 调整朝向偏好。</div>';
  if (e instanceof Inserter)
    return '<div class="dim">机械臂：周围8格自动取放（优先背面取、正面放）。长臂版抓取/放置覆盖正前与正后方第二格。</div>';
  if (e instanceof Belt) return '<div class="dim">传送带：物品沿箭头方向流动。R 旋转方向。靠近后按 F 拿取带上物品。</div>';
  return '<div class="dim">无信息</div>';
}

function row(label, val, liveKey) {
  return '<div class="mrow"><span class="mlabel">' + label + '</span><span class="mval"' +
    (liveKey ? ' data-live="' + liveKey + '"' : '') + '>' + val + '</span></div>';
}

function barHtml(pct) {
  pct = Math.max(0, Math.min(100, pct || 0));
  return '<div class="bar"><i style="width:' + pct + '%"></i></div>';
}

function statusLine(txt) {
  return '<div class="status">' + txt + '</div>';
}

function initPanelEvents() {
  document.getElementById('panel-body').addEventListener('change', ev => {
    if (ev.target.id !== 'imp-file') return;
    const f = ev.target.files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => importSaveText(rd.result);
    rd.onerror = () => toast('读取文件失败');
    rd.readAsText(f);
  });
  document.getElementById('panel-close').addEventListener('click', () => closePanel());
  document.getElementById('panel-body').addEventListener('click', ev => {
    const hbSlot = ev.target.closest('[data-hbedit]');
    if (hbSlot) {
      const i = +hbSlot.dataset.hbedit;
      if (G.hbArm === i) { HOTBAR[i] = null; G.hbArm = null; }
      else G.hbArm = i;
      renderPanel(false);
      buildHotbar();
      return;
    }
    const itEl = ev.target.closest('[data-itemid]');
    if (itEl && G.hbArm !== null && G.hbArm !== undefined) {
      HOTBAR[G.hbArm] = itEl.dataset.itemid;
      toast('已放入快捷栏槽位 ' + (G.hbArm === 9 ? 0 : G.hbArm + 1));
      G.hbArm = null;
      renderPanel(false);
      buildHotbar();
      return;
    }
    const setCb = ev.target.closest('[data-set]');
    if (setCb) {
      G.settings[setCb.dataset.set] = setCb.checked;
      saveSettings();
      return;
    }
    const btn = ev.target.closest('[data-action]');
    if (!btn) return;
    const act = btn.dataset.action;
    const id = btn.dataset.id;
    if (act === 'exp-save') { downloadSave(); return; }
    if (act === 'imp-save') { document.getElementById('imp-file').click(); return; }
    if (act === 'craft') {
      const made = doCraft(id, +(btn.dataset.mult || 1));
      if (!made) toast('材料不足');
    } else if (act === 'recipe') {
      if (G.panelEnt instanceof Assembler) G.panelEnt.setRecipe(id);
    } else if (act === 'recipe-clear') {
      if (G.panelEnt instanceof Assembler) G.panelEnt.setRecipe(null);
    } else if (act === 'fuel') {
      const n = Math.min(5, invCount('coal'));
      if (n <= 0) { toast('没有煤了'); return; }
      if (invTake('coal', n)) {
        G.panelEnt.fuelCoal += n;
        if (G.panelEnt.burnLeft !== undefined && n > 0 && G.panelEnt.fuelCoal - n >= 0) {}
      }
    } else if (act === 'feed') {
      const mch = G.panelEnt;
      const id = btn.dataset.id;
      let moved = 0;
      const have = invCount(id);
      while (moved < have && mch.giveItem(id)) moved++;
      if (moved > 0) invTake(id, moved);
      else toast('放不进去了');
    } else if (act === 'takein') {
      const mch = G.panelEnt;
      for (const k of Object.keys(mch.inp || {})) {
        invAdd(k, mch.inp[k]);
        delete mch.inp[k];
      }
    } else if (act === 'takeout') {
      const mch = G.panelEnt;
      if (mch instanceof Drill) {
        if (mch.buf > 0 && mch.bufItem) { invAdd(mch.bufItem, mch.buf); mch.buf = 0; }
      } else if (mch instanceof Lab) {
        if (mch.packs > 0) { invAdd('science-pack', mch.packs); mch.packs = 0; }
      } else {
        for (const k of Object.keys(mch.outp)) {
          invAdd(k, mch.outp[k]);
          delete mch.outp[k];
        }
      }
    } else if (act === 'chest-deposit') {
      const c = G.panelEnt;
      for (const id of [...ORES, 'coal']) {
        const have = invCount(id);
        let moved = 0;
        while (moved < have && c.giveItem(id)) moved++;
        if (moved > 0) invTake(id, moved);
      }
    } else if (act === 'labfill') {
      const n = Math.min(10, invCount('science-pack'));
      if (n <= 0) { toast('没有科学包'); return; }
      invTake('science-pack', n);
      G.panelEnt.packs += n;
    } else if (act === 'tech') {
      G.activeTech = id;
    } else if (act === 'tech-cancel') {
      G.activeTech = null;
    }
    renderPanel(false);
    refreshHotbar();
  });
}

function htmlSettings() {
  let h = '<div class="sec">游戏设置</div>';
  h += '<label class="setrow"><input type="checkbox" data-set="infiniteOre"' + (G.settings.infiniteOre ? ' checked' : '') + '> 无限矿脉（矿藏永不枯竭）</label>';
  h += '<label class="setrow"><input type="checkbox" data-set="autoSave"' + (G.settings.autoSave ? ' checked' : '') + '> 自动保存（每60秒）</label>';
  h += '<div class="sec">存档管理</div>';
  h += '<button data-action="exp-save">导出存档到文件</button> ';
  h += '<button data-action="imp-save">从文件导入存档</button>';
  h += '<input type="file" id="imp-file" accept=".json,application/json" style="display:none">';
  h += '<div class="hint" id="imp-hint">导出为 JSON 文件，可分享或备份；导入会覆盖当前进度。K/L 为浏览器本地快速存读。</div>';
  return h;
}

function downloadSave() {
  try {
    const data = JSON.stringify(serializeAll());
    const blob = new Blob([data], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'factory-save-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    toast('存档已导出');
  } catch (err) {
    toast('导出失败：' + err.message);
  }
}

function importSaveText(text) {
  try {
    const d = JSON.parse(text);
    if (!d || d.v !== 1) throw new Error('格式不正确');
    applySave(d);
    closePanel();
    toast('导入成功');
  } catch (err) {
    toast('导入失败：' + err.message);
  }
}

function initTopButtons() {
  document.getElementById('btn-inv').addEventListener('click', () =>
    G.panelMode === 'inv' ? closePanel() : openPanel('inv'));
  document.getElementById('btn-tech').addEventListener('click', () =>
    G.panelMode === 'tech' ? closePanel() : openPanel('tech'));
  document.getElementById('btn-set').addEventListener('click', () =>
    G.panelMode === 'set' ? closePanel() : openPanel('set'));
  document.getElementById('btn-save').addEventListener('click', saveGame);
  document.getElementById('btn-load').addEventListener('click', loadGame);
}

function updateHUD(dt, fps) {
  const el = document.getElementById('hud-info');
  const p = G.player;
  const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
  const si = selItem();
  let tool = '采集镐（按住左键挖矿）';
  if (G.sel >= 0) tool = si ? '放置：' + ITEMS[si].name + '（R 旋转）' : '空槽位（背包 E 里可配置）';
  el.textContent = 'FPS ' + fps + '   坐标 ' + tx + ',' + ty + '   ' + tool;
}

function mapTipAt(tx, ty) {
  if (!inBounds(tx, ty)) return null;
  const e = entAt(tx, ty);
  if (e) {
    let extra = '';
    if (e instanceof Furnace)
      extra = e.lit ? '冶炼中' : ((Object.keys(e.inp).length || e.fuelCoal > 0) ? '待料' : '空置，需放入燃料和矿石');
    else if (e instanceof Drill)
      extra = e.status || ('开采中，产出朝' + ['东', '南', '西', '北'][e.dir]);
    else if (e instanceof Assembler)
      extra = e.recipe ? ('生产 ' + ITEMS[Object.keys(RECIPES[e.recipe].out)[0]].name) : '未设置配方，点击打开面板';
    else if (e instanceof Lab)
      extra = e.packs > 0 ? ('科学包 ×' + e.packs + (G.activeTech ? '，研究 ' + TECHS[G.activeTech].name : '')) : '无科学包';
    else if (e instanceof Chest) {
      let n = 0, k = 0;
      for (const s of e.slots) if (s) { n += s.count; k++; }
      extra = k ? ('存货 ' + n + ' 个（' + k + ' 种）') : '空箱';
    } else if (e instanceof Belt) {
      if (e.items.length) {
        const agg = {};
        for (const o of e.items) agg[o.item] = (agg[o.item] || 0) + 1;
        extra = '载物 ' + Object.keys(agg).map(k => ITEMS[k].name + '×' + agg[k]).join('、') + '，按F拿取';
      } else extra = '空闲';
    } else if (e instanceof Inserter)
      extra = e.holding ? ('搬运 ' + ITEMS[e.holding].name + '，8格取放') : '待机：周围8格取放（优先背面取、正面放）';
    return ITEMS[e.type].name + '|' + extra;
  }
  const idx = tileIdx(tx, ty);
  if (G.world.terrain[idx] === T_WATER) return '水域|无法通行、不可建造';
  const ti = G.world.oreType[idx];
  if (ti >= 0 && G.world.oreAmt[idx] > 0)
    return ITEMS[ORES[ti]].name + '|储量 ' + Math.floor(G.world.oreAmt[idx]) + '，按住左键开采';
  return null;
}

function initTooltips() {
  const tip = document.getElementById('tooltip');
  document.addEventListener('mousemove', ev => {
    let text = null;
    if (ev.target && ev.target.closest) {
      const el = ev.target.closest('[data-tip]');
      if (el) text = el.dataset.tip;
    }
    if (!text && ev.target === G.canvas && G.cursorTile)
      text = mapTipAt(G.cursorTile.tx, G.cursorTile.ty);
    if (text) {
      const p = text.split('|');
      tip.querySelector('b').textContent = p[0] || '';
      tip.querySelector('span').textContent = p[1] || '';
      tip.style.display = 'block';
      const r = tip.getBoundingClientRect();
      let x = ev.clientX + 14, y = ev.clientY + 16;
      if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - 10;
      if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - 10;
      tip.style.left = x + 'px';
      tip.style.top = y + 'px';
    } else {
      tip.style.display = 'none';
    }
  });
}

function dbgSlider(body, label, key, min, max, step) {
  const row = document.createElement('div');
  row.className = 'drow';
  const lab = document.createElement('label');
  lab.append(label);
  const val = document.createElement('span');
  val.className = 'dval';
  val.textContent = G.dbg[key] + 'x';
  lab.appendChild(val);
  const inp = document.createElement('input');
  inp.type = 'range'; inp.min = min; inp.max = max; inp.step = step; inp.value = G.dbg[key];
  inp.dataset.dbgkey = key;
  inp.addEventListener('input', () => {
    G.dbg[key] = +inp.value;
    val.textContent = (+inp.value) + 'x';
  });
  row.appendChild(lab); row.appendChild(inp);
  body.appendChild(row);
}

function buildDebug() {
  const btn = document.getElementById('dbg-btn');
  const panel = document.getElementById('dbg-panel');
  panel.innerHTML = '<div class="dhead"><span>开发者调试</span><button id="dbg-x">✕</button></div>';
  const body = document.createElement('div');
  body.className = 'dbody';
  panel.appendChild(body);

  dbgSlider(body, '游戏速度', 'timeScale', 0, 5, 0.1);
  dbgSlider(body, '移动速度', 'moveSpeed', 0.2, 4, 0.1);
  dbgSlider(body, '挖矿速度', 'mineMult', 0.25, 10, 0.25);
  dbgSlider(body, '传送带速度', 'beltMult', 0.25, 5, 0.25);
  dbgSlider(body, '采矿机速度', 'drillMult', 0.25, 5, 0.25);
  dbgSlider(body, '装配机速度', 'asmMult', 0.25, 5, 0.25);

  const sec1 = document.createElement('div');
  sec1.className = 'dsec';
  sec1.textContent = '发放资源';
  body.appendChild(sec1);
  const grid1 = document.createElement('div');
  grid1.className = 'dgrid';
  for (const [txt, id, n] of [
    ['+100铁板', 'iron-plate', 100], ['+100铜板', 'copper-plate', 100],
    ['+100煤', 'coal', 100], ['+100石头', 'stone', 100],
    ['+50齿轮', 'iron-gear', 50], ['+50电路', 'green-circuit', 50],
    ['+20科学包', 'science-pack', 20]
  ]) {
    const b = document.createElement('button');
    b.textContent = txt;
    b.dataset.giveid = id;
    b.dataset.given = n;
    b.addEventListener('click', () => { invAdd(id, n); toast('+ ' + n + ' ' + ITEMS[id].name); });
    grid1.appendChild(b);
  }
  body.appendChild(grid1);

  const sec2 = document.createElement('div');
  sec2.className = 'dsec';
  sec2.textContent = '操作';
  body.appendChild(sec2);
  const grid2 = document.createElement('div');
  grid2.className = 'dgrid';
  const acts = [
    ['重置速度', () => {
      Object.assign(G.dbg, { timeScale: 1, moveSpeed: 1, mineMult: 1, beltMult: 1, drillMult: 1, asmMult: 1 });
      buildDebug();
      panel.style.display = 'block';
      toast('所有速度已重置为 1x');
    }],
    ['完成研究', () => {
      const t = G.activeTech;
      if (!t) { toast('没有进行中的研究'); return; }
      G.techProg[t] = TECHS[t].cost;
      G.techDone[t] = true;
      toast('研究完成：' + TECHS[t].name);
      G.activeTech = null;
      renderPanel(false);
    }],
    ['回出生点', () => {
      G.player.x = G.spawn.x * TILE + TILE / 2;
      G.player.y = G.spawn.y * TILE + TILE / 2;
    }],
    ['清空建筑', () => {
      for (const e of G.ents.slice()) removeEnt(e);
      closePanel();
      toast('建筑已清空');
    }],
    ['新地图', () => { newGame(); closePanel(); toast('新地图已生成'); }]
  ];
  for (const [txt, fn] of acts) {
    const b = document.createElement('button');
    b.textContent = txt;
    b.dataset.dbgact = txt;
    b.addEventListener('click', fn);
    grid2.appendChild(b);
  }
  body.appendChild(grid2);

  document.getElementById('dbg-x').addEventListener('click', () => { panel.style.display = 'none'; });

  let drag = null;
  let suppressClick = false;
  btn.addEventListener('mousedown', ev => {
    drag = { sx: ev.clientX, sy: ev.clientY, bx: btn.offsetLeft, by: btn.offsetTop, moved: false };
    ev.preventDefault();
  });
  window.addEventListener('mousemove', ev => {
    if (!drag) return;
    if (Math.abs(ev.clientX - drag.sx) + Math.abs(ev.clientY - drag.sy) > 6) drag.moved = true;
    if (drag.moved) {
      btn.style.left = Math.max(4, Math.min(innerWidth - 50, drag.bx + ev.clientX - drag.sx)) + 'px';
      btn.style.top = Math.max(4, Math.min(innerHeight - 50, drag.by + ev.clientY - drag.sy)) + 'px';
      btn.style.right = 'auto';
      btn.style.bottom = 'auto';
    }
  });
  window.addEventListener('mouseup', () => {
    if (drag) suppressClick = drag.moved;
    drag = null;
  });
  btn.addEventListener('click', () => {
    if (suppressClick) { suppressClick = false; return; }
    if (panel.style.display === 'block') { panel.style.display = 'none'; return; }
    const r = btn.getBoundingClientRect();
    let x = r.right + 8, y = r.top;
    if (x + 260 > innerWidth) x = Math.max(8, r.left - 262);
    y = Math.max(8, Math.min(innerHeight - 330, y));
    panel.style.left = x + 'px';
    panel.style.top = y + 'px';
    panel.style.right = 'auto';
    panel.style.bottom = 'auto';
    panel.style.display = 'block';
  });
}
