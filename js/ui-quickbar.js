'use strict';

// ===== 左下角 8 格战斗快捷栏 =====
// 第1行：角色图标 / 武器槽×3
// 第2行：装甲槽 / 对应武器弹药槽×3
//
// 武器槽可放入各种武器（手枪、冲锋枪、火箭筒等）；
// 弹药槽可单独放入对应武器所需弹药（如手枪对应手枪弹匣）。
// 武器与弹药需分开补充：从背包选中武器→点击武器槽放入；再选中弹药→点击弹药槽放入。
// C 键在武器槽中从左到右循环切换当前武器。
//
// 背景色规则：
//   - 上下都空（灰）：默认底色
//   - 武器+弹药都装好（绿）：该列上下一起绿色
//   - 只装武器 或 只装弹药（红）：对应槽位红色

// 三个武器槽 / 三个弹药槽
let QB_WEAPONS = [null, null, null];
let QB_AMMO = [null, null, null];

// 收集所有可作为弹药的物品 id（来自所有武器定义的 ammo / ammoTiers）
function qbBuildAmmoSet() {
  const s = {};
  if (typeof WEAPONS === 'undefined') return s;
  for (const k in WEAPONS) {
    const w = WEAPONS[k];
    if (w && w.ammo) s[w.ammo] = 1;
    if (w && Array.isArray(w.ammoTiers)) w.ammoTiers.forEach(a => { if (a) s[a] = 1; });
  }
  return s;
}
const QB_AMMO_IDS = qbBuildAmmoSet();
// 是否为弹药（可放入弹药槽）
function isAmmo(id) { return !!QB_AMMO_IDS[id]; }

// 是否允许放入武器槽（需为武器）
function qbCanPlaceWeapon(id) {
  return !!(id && typeof isWeapon === 'function' && isWeapon(id));
}

function buildQuickbar() {
  const r1 = document.getElementById('qb-row1');
  const r2 = document.getElementById('qb-row2');
  if (!r1 || !r2) return;
  r1.innerHTML = '';
  r2.innerHTML = '';
  // 第1行：角色图标 + 3 个武器槽
  r1.appendChild(qbCharSlot());
  for (let i = 0; i < 3; i++) r1.appendChild(qbWeaponSlot(i));
  // 第2行：装甲槽 + 3 个弹药槽
  r2.appendChild(qbArmorSlot());
  for (let i = 0; i < 3; i++) r2.appendChild(qbAmmoSlot(i));
  renderQuickbarSlots();
}

function qbMakeSlot(dataTip) {
  const el = document.createElement('div');
  el.className = 'qb-slot';
  if (dataTip) el.dataset.tip = dataTip;
  return el;
}

// 角色图标槽（第1行第1格）：点击打开角色/装备界面
function qbCharSlot() {
  const el = qbMakeSlot('角色|点击打开角色与装备界面');
  el.innerHTML = '<span class="qb-empty">🧑‍🚀</span>';
  el.addEventListener('click', () => {
    if (typeof openPanel === 'function') {
      if (G.panelMode === 'inv') closePanel(); else openPanel('inv');
    }
  });
  return el;
}

// 获取当前鼠标选中的物品（背包选中 / 快捷栏选中）
function qbHeld() {
  return G.quickSel || (G.sel >= 0 ? (G.sel < HOTBAR.length ? HOTBAR[G.sel] : null) : null);
}

// 武器槽（第1行第2~4格）
function qbWeaponSlot(i) {
  const el = qbMakeSlot('武器槽|从背包选中武器后点击放入；点击已有武器可卸下');
  el.dataset.qb = 'weapon';
  el.dataset.qbIdx = i;
  el.addEventListener('click', ev => qbOnWeaponClick(i, ev));
  return el;
}

function qbOnWeaponClick(i) {
  const held = qbHeld();
  const cur = QB_WEAPONS[i];
  if (held && qbCanPlaceWeapon(held)) {
    // 放入/更换武器，并设为当前武器
    QB_WEAPONS[i] = held;
    if (typeof setWeapon === 'function') setWeapon(held);
    if (typeof playSfx === 'function') playSfx('select');
    toast('已将「' + ITEMS[held].name + '」放入武器槽' + (isAmmo(held) ? '（含自带弹药）' : ''));
  } else if (!held && cur) {
    // 无选中物品时点击已有武器：卸下（若为当前武器则取消装备）
    QB_WEAPONS[i] = null;
    if (G.weapon === cur && typeof setWeapon === 'function') setWeapon(null);
    if (typeof playSfx === 'function') playSfx('select');
    toast('已卸下武器槽：' + ITEMS[cur].name);
  } else if (held && !qbCanPlaceWeapon(held)) {
    toast('武器槽只能放置武器，请先在背包中选中一把武器');
  } else {
    toast('请先在背包/快捷栏选中一把武器，再点击武器槽放入');
  }
  buildQuickbar();
  uiDirty = true;
}

// 装甲槽（第2行第1格）：显示当前穿戴护甲
function qbArmorSlot() {
  const el = qbMakeSlot('装甲|显示当前穿戴的护甲，点击脱卸');
  el.dataset.qb = 'armor';
  el.addEventListener('click', () => {
    if (G.armor && typeof unequipArmor === 'function') {
      unequipArmor();
      if (typeof playSfx === 'function') playSfx('select');
    }
    buildQuickbar();
    uiDirty = true;
  });
  return el;
}

// 弹药槽（第2行第2~4格）：单独放入对应武器弹药
function qbAmmoSlot(i) {
  const el = qbMakeSlot('弹药槽|从背包选中弹药后点击放入；点击已有弹药可卸下');
  el.dataset.qb = 'ammo';
  el.dataset.qbIdx = i;
  el.addEventListener('click', ev => qbOnAmmoClick(i, ev));
  return el;
}

function qbOnAmmoClick(i) {
  const held = qbHeld();
  const cur = QB_AMMO[i];
  if (held && isAmmo(held)) {
    // 放入/更换弹药
    QB_AMMO[i] = held;
    if (typeof playSfx === 'function') playSfx('select');
    toast('已将「' + ITEMS[held].name + '」补充到弹药槽');
  } else if (!held && cur) {
    // 无选中物品时点击已有弹药：卸下
    QB_AMMO[i] = null;
    if (typeof playSfx === 'function') playSfx('select');
    toast('已卸下弹药槽：' + ITEMS[cur].name);
  } else if (held && !isAmmo(held)) {
    toast('弹药槽只能放置弹药，请先在背包中选中弹药');
  } else {
    toast('请先在背包中选中弹药，再点击弹药槽补充');
  }
  buildQuickbar();
  uiDirty = true;
}

// 当前槽位状态：ready(武器+弹药都装好) / partial(只装了一样) / empty(全空)
function qbColumnState(i) {
  const w = QB_WEAPONS[i];
  const a = QB_AMMO[i];
  if (!w && !a) return 'empty';
  if (w && a) return 'ready';
  return 'partial';
}

// 重建快捷栏槽位图标与背景状态
function renderQuickbarSlots() {
  const r1 = document.getElementById('qb-row1');
  if (r1) {
    const ws = r1.querySelectorAll('[data-qb="weapon"]');
    ws.forEach((el, i) => {
      const w = QB_WEAPONS[i];
      el.innerHTML = '';
      if (w) {
        const img = document.createElement('img');
        img.className = 'qb-ic';
        if (typeof iconCanvas === 'function') img.src = iconCanvas(w, 16).toDataURL();
        else img.alt = ITEMS[w].name || w;
        el.appendChild(img);
      } else {
        el.innerHTML = '<span class="qb-empty">🔫</span>';
      }
    });
  }
  const r2 = document.getElementById('qb-row2');
  if (r2) {
    const armorEl = r2.querySelector('[data-qb="armor"]');
    if (armorEl) {
      const a = G.armor;
      armorEl.innerHTML = '';
      if (a) {
        const img = document.createElement('img');
        img.className = 'qb-ic';
        if (typeof iconCanvas === 'function') img.src = iconCanvas(a, 16).toDataURL();
        const name = document.createElement('span');
        name.className = 'qb-name';
        name.textContent = ITEMS[a].name;
        armorEl.appendChild(img);
        armorEl.appendChild(name);
      } else {
        armorEl.innerHTML = '<span class="qb-empty">🛡</span>';
      }
    }
    const ammoEls = r2.querySelectorAll('[data-qb="ammo"]');
    ammoEls.forEach((el, i) => {
      const a = QB_AMMO[i];
      el.innerHTML = '';
      if (a) {
        const img = document.createElement('img');
        img.className = 'qb-ic';
        if (typeof iconCanvas === 'function') img.src = iconCanvas(a, 16).toDataURL();
        else img.alt = ITEMS[a].name || a;
        el.appendChild(img);
        const cnt = document.createElement('span');
        cnt.className = 'qb-cnt';
        el.appendChild(cnt);
      } else {
        el.innerHTML = '<span class="qb-empty">·</span>';
      }
    });
  }
  updateQuickbarStates();
  updateQuickbarCounts();
}

// 每帧轻量更新：只刷新背景状态 + 弹药数量角标，不重建图标
function refreshQuickbar() {
  updateQuickbarStates();
  updateQuickbarCounts();
}

// 根据武器+弹药装载情况设置绿色/红色/灰色背景
function updateQuickbarStates() {
  const r1 = document.getElementById('qb-row1');
  const r2 = document.getElementById('qb-row2');
  if (!r1 || !r2) return;
  const ws = r1.querySelectorAll('[data-qb="weapon"]');
  const ammoEls = r2.querySelectorAll('[data-qb="ammo"]');
  const setState = (el, state) => {
    el.classList.toggle('qb-green', state === 'ready');
    el.classList.toggle('qb-red', state === 'partial');
  };
  ws.forEach((el, i) => setState(el, qbColumnState(i)));
  ammoEls.forEach((el, i) => setState(el, qbColumnState(i)));
}

function updateQuickbarCounts() {
  const infinite = !!(G.dbg && G.dbg.infinite);
  const r2 = document.getElementById('qb-row2');
  if (!r2) return;
  const ammoEls = r2.querySelectorAll('[data-qb="ammo"]');
  ammoEls.forEach((el, i) => {
    const a = QB_AMMO[i];
    const cnt = el.querySelector('.qb-cnt');
    if (cnt) cnt.textContent = a ? ((typeof invCount === 'function') ? (infinite ? '∞' : invCount(a)) : '') : '';
  });
}

// C 键：在武器槽中从左到右循环切换当前武器
// 若武器槽没有武器则不做任何切换
function cycleQuickbarWeapon() {
  const filled = [];
  QB_WEAPONS.forEach((w, i) => { if (w) filled.push(i); });
  if (!filled.length) return;                       // 无武器，不切换
  let nextIdx;
  const curIdx = QB_WEAPONS.indexOf(G.weapon);
  if (curIdx >= 0) {
    const pos = filled.indexOf(curIdx);
    nextIdx = filled[(pos + 1) % filled.length];    // 下一把（循环）
  } else {
    nextIdx = filled[0];                            // 当前无选中武器，选第一把
  }
  const w = QB_WEAPONS[nextIdx];
  if (typeof setWeapon === 'function') setWeapon(w);
  if (typeof toast === 'function') toast('已切换武器：' + ITEMS[w].name);
  uiDirty = true;
}

// 序列化 / 读档
function qbSerialize() { return { weapons: QB_WEAPONS.slice(), ammo: QB_AMMO.slice() }; }
function qbApply(d) {
  if (d && Array.isArray(d.weapons)) {
    QB_WEAPONS = d.weapons.slice(0, 3).map(w => (w && isWeapon(w)) ? w : null);
    while (QB_WEAPONS.length < 3) QB_WEAPONS.push(null);
  }
  if (d && Array.isArray(d.ammo)) {
    QB_AMMO = d.ammo.slice(0, 3).map(a => (a && isAmmo(a)) ? a : null);
    while (QB_AMMO.length < 3) QB_AMMO.push(null);
  } else {
    QB_AMMO = [null, null, null];
  }
  if (typeof buildQuickbar === 'function') buildQuickbar();
}

function initQuickbar() {
  buildQuickbar();
}
