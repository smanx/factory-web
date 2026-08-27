'use strict';

// ===== 左下角 8 格战斗快捷栏 =====
// 第1行：角色图标 / 武器槽×3
// 第2行：装甲槽 / 对应武器弹药槽×3
//
// 武器槽可放入各种武器（手枪、冲锋枪、火箭筒等）；
// 弹药槽显示对应武器所需弹药及其数量（如手枪对应手枪弹匣）；
// 角色图标点击打开角色/装备界面（背包面板）；装甲槽显示当前穿戴护甲。

// 三个武器槽
let QB_WEAPONS = [null, null, null];
// 装甲槽（直接复用 G.armor 当前穿戴护甲）

// 获取武器对应弹药 id
function qbAmmoFor(w) {
  return (w && typeof WEAPONS !== 'undefined' && WEAPONS[w] && WEAPONS[w].ammo) || null;
}

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
  el.innerHTML = '<span class="qb-ic" style="font-size:26px;line-height:1">🧑‍🚀</span>';
  el.addEventListener('click', () => {
    if (typeof openPanel === 'function') {
      if (G.panelMode === 'inv') closePanel(); else openPanel('inv');
    }
  });
  return el;
}

// 武器槽（第1行第2~4格）
function qbWeaponSlot(i) {
  const el = qbMakeSlot('武器槽|点击放入/更换武器；点击已有武器可卸下');
  el.dataset.qb = 'weapon';
  el.dataset.qbIdx = i;
  el.addEventListener('click', ev => qbOnWeaponClick(i, ev));
  return el;
}

function qbOnWeaponClick(i, ev) {
  const held = G.quickSel || (G.sel >= 0 ? (G.sel < HOTBAR.length ? HOTBAR[G.sel] : null) : null);
  const cur = QB_WEAPONS[i];
  if (held && qbCanPlaceWeapon(held)) {
    // 放入/更换武器
    QB_WEAPONS[i] = held;
    if (typeof setWeapon === 'function') setWeapon(held);
    if (typeof playSfx === 'function') playSfx('select');
    toast('已将「' + ITEMS[held].name + '」放入武器槽');
  } else if (cur) {
    // 点击已有武器：卸下（若为当前武器则取消装备）
    QB_WEAPONS[i] = null;
    if (G.weapon === cur && typeof setWeapon === 'function') setWeapon(null);
    if (typeof playSfx === 'function') playSfx('select');
    toast('已卸下武器槽：' + ITEMS[cur].name);
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

// 弹药槽（第2行第2~4格）：对应武器槽弹药
function qbAmmoSlot(i) {
  const el = qbMakeSlot('弹药槽|对应上方武器所需弹药');
  el.dataset.qb = 'ammo';
  el.dataset.qbIdx = i;
  el.addEventListener('click', ev => qbOnAmmoClick(i, ev));
  return el;
}

function qbOnAmmoClick(i, ev) {
  const w = QB_WEAPONS[i];
  const ammo = qbAmmoFor(w);
  if (!ammo) {
    toast('请先在上方对应武器槽放入武器');
    return;
  }
  if (typeof invCount === 'function' && invCount(ammo) > 0) {
    // 若有弹药，显示提示
    toast('「' + ITEMS[ammo].name + '」剩余 ' + invCount(ammo) + '，随「' + ITEMS[w].name + '」使用');
  }
}

// 重建快捷栏槽位图标（在 buildQuickbar 或点击交互后调用）
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
        if (typeof iconCanvas === 'function') img.src = iconCanvas(w).toDataURL();
        else img.alt = ITEMS[w].name || w;
        el.appendChild(img);
        el.classList.toggle('active', G.weapon === w);
      } else {
        el.innerHTML = '<span class="qb-empty">🔫</span>';
        el.classList.remove('active');
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
        if (typeof iconCanvas === 'function') img.src = iconCanvas(a).toDataURL();
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
      const w = QB_WEAPONS[i];
      const ammo = qbAmmoFor(w);
      el.innerHTML = '';
      if (ammo) {
        const img = document.createElement('img');
        img.className = 'qb-ic';
        if (typeof iconCanvas === 'function') img.src = iconCanvas(ammo).toDataURL();
        else img.alt = ITEMS[ammo].name || ammo;
        el.appendChild(img);
        const cnt = document.createElement('span');
        cnt.className = 'qb-cnt';
        el.appendChild(cnt);
      } else {
        el.innerHTML = '<span class="qb-empty" style="font-size:14px">·</span>';
      }
    });
  }
  updateQuickbarCounts();
}

// 每帧轻量更新：只刷新弹药/数量角标，不重建图标（避免每帧 toDataURL 开销）
function refreshQuickbar() {
  updateQuickbarCounts();
}

function updateQuickbarCounts() {
  const infinite = !!(G.dbg && G.dbg.infinite);
  const r2 = document.getElementById('qb-row2');
  if (!r2) return;
  const ammoEls = r2.querySelectorAll('[data-qb="ammo"]');
  ammoEls.forEach((el, i) => {
    const w = QB_WEAPONS[i];
    const ammo = qbAmmoFor(w);
    const cnt = el.querySelector('.qb-cnt');
    if (cnt) cnt.textContent = ammo ? ((typeof invCount === 'function') ? (infinite ? '∞' : invCount(ammo)) : '') : '';
  });
}

// 序列化 / 读档
function qbSerialize() { return { weapons: QB_WEAPONS.slice() }; }
function qbApply(d) {
  if (d && Array.isArray(d.weapons)) {
    QB_WEAPONS = d.weapons.slice(0, 3).map(w => (w && isWeapon(w)) ? w : null);
    while (QB_WEAPONS.length < 3) QB_WEAPONS.push(null);
  }
  if (typeof buildQuickbar === 'function') buildQuickbar();
}

function initQuickbar() {
  buildQuickbar();
}
