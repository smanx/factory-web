'use strict';

// ===== 护甲系统（对齐《异星工厂》Armor） =====
// 玩家可穿戴护甲减少所受伤害。护甲在背包中选中后点击装甲槽穿戴，脱卸后回到背包。
// 前 2 种（轻型/重型）只有数值减伤；后 4 种模块化护甲自带装备网格（grid.w×grid.h，
// 对齐官方 equipment-grid），可右键打开装甲面板安装个人装备件。每件护甲的网格独立保存。
const ARMORS = {
  'light-armor': { name: '轻型护甲', protect: 0.8, grid: 0 },   // 减伤 20%
  'heavy-armor': { name: '重型护甲', protect: 0.55, grid: 0 },   // 减伤 45%
  // 模块化护甲：装备网格对齐官方 equipment-grid（w=宽/列数, h=高/行数, cats=可放装备类别）
  //   modular-armor   → small-equipment-grid  5×5
  //   power-armor     → medium-equipment-grid 6×8
  //   power-armor-mk2 → large-equipment-grid  10×10
  //   mech-armor      → huge-equipment-grid   10×12（太空时代 Mech armor）
  'modular-armor':   { name: '模块化护甲', protect: 0.7,  grid: { w: 5,  h: 5,  cats: ['armor'] } },   // 减伤 30%
  'power-armor':     { name: '强力装甲',   protect: 0.55, grid: { w: 6,  h: 8,  cats: ['armor'] } },   // 减伤 45%
  'power-armor-mk2': { name: '强力装甲 II', protect: 0.45, grid: { w: 10, h: 10, cats: ['armor'] } },  // 减伤 55%
  'mech-armor':      { name: '机械装甲', protect: 0.35, grid: { w: 10, h: 12, cats: ['armor'] } }   // 减伤 65%
};
function isArmor(id) { return !!ARMORS[id]; }
// 装备护甲：消耗背包中的护甲；若已穿戴则替换（旧护甲回包）。
// 若该护甲正持握于鼠标（从背包拿起后点击装甲槽），从持握堆叠扣 1 件，否则从背包扣。
function equipArmor(id) {
  if (!isArmor(id)) return;
  const old = G.armor;
  if (old && old !== id) invAdd(old, 1);
  G.armor = id;
  // 每件护甲独立保存自己的装备网格（见 equipment.js 的 G.armorGrids），换装互不影响
  if (G.held && G.held.id === id && G.held.count > 0) {
    G.held.count--;
    if (G.held.count <= 0) G.held = null;
  } else {
    invTake(id, 1);
  }
  if (typeof playSfx === 'function') playSfx('equip');
  if (typeof toast === 'function') {
    const def = ARMORS[id];
    let msg = '已装备 ' + def.name + '（受伤 -' + Math.round((1 - def.protect) * 100) + '%';
    if (def.grid) msg += '，装备网格 ' + def.grid.w + '×' + def.grid.h;
    msg += '）';
    toast(msg);
  }
  uiDirty = true;
}
// 脱卸护甲：回到背包（该护甲的装备网格随护甲保留，下次穿戴仍可读取）
function unequipArmor() {
  if (G.armor) {
    invAdd(G.armor, 1);
    G.armor = null;
  }
  if (typeof playSfx === 'function') playSfx('unequip');
  if (typeof toast === 'function') toast('已脱下护甲');
  uiDirty = true;
}
// 是否为可穿戴护甲且当前可装备（科技门控）
function canEquipArmor(id) {
  if (!isArmor(id)) return false;
  if (TECH_REQ[id] && !G.techDone[TECH_REQ[id]]) return false;
  return true;
}

function updateBullets(dt) {
  if (!G.bullets) return;
  for (const b of G.bullets) {
    b.t += dt;
    // 炮兵炮弹：飞行结束时在落点引发超大范围爆炸
    if (b.art && b.t >= b.life && !b.hit) {
      b.hit = true;
      explodeDamage(b.tx, b.ty, b.splash, b.dmg);
      // 落点爆破特效（大圈）
      b.boomBig = true;
    }
    // 火箭/手雷等范围爆炸：命中后延长存在时间以播放“冲击波扩散 + 火焰消散”动画（画面优化）
    if (b.splash && !b.hit && b.t >= b.life) {
      b.hit = true;
      // 纯冲击波环子弹（核爆特效用）只作视觉，不再重复伤害/特效
      if (!b.waveOnly) {
        explodeDamage(b.tx, b.ty, b.splash, b.dmg);
        // 原子弹：核爆特效（蘑菇云 + 冲击波 + 强光 + 高温火球）
        if (b.nuclear && typeof spawnNuclearExplosion === 'function') spawnNuclearExplosion(b.tx, b.ty);
      }
      b.boomBig = true;
    }
    if ((b.splash || b.boomBig) && b.hit && b._boomT === undefined) {
      b._boomT = 0;
      b._boomBase = b.life;
      b.life = b._boomBase + (b.art ? 0.6 : 0.35);
    }
    if (b._boomT !== undefined) b._boomT += dt;
    // 地雷爆炸特效：仅视觉短促闪光，无需额外伤害（已由 removeEnt 前引爆）
  }
  G.bullets = compactFilter(G.bullets, b => b.t < b.life);
}

// ===== 玩家武器 =====
// 武器数据：伤害、射速、弹药、弹种
const WEAPONS = {
  'pistol':          { name: '手枪',   dmg: 10, rate: 0.3, ammo: 'firearm-magazine',        spread: 0.06, auto: false, range: 7, sfx: 'shoot' },
  'submachine-gun':  { name: '冲锋枪', dmg: 7,  rate: 0.1, ammo: 'firearm-magazine', ammoTiers: ['firearm-magazine', 'piercing-rounds-magazine', 'uranium-rounds-magazine'], ammoDmg: { 'firearm-magazine': 7, 'piercing-rounds-magazine': 10, 'uranium-rounds-magazine': 16 }, spread: 0.12, auto: true,  range: 7, sfx: 'machine-gun' },
  'shotgun':         { name: '散弹枪', dmg: 6,  rate: 0.5, ammo: 'shotgun-shell', spread: 0.4,  auto: false, range: 6, pellets: 6, sfx: 'shotgun' },
  'combat-shotgun':  { name: '战斗散弹枪', dmg: 8,  rate: 0.25, ammo: 'piercing-shotgun-shell', spread: 0.32, auto: false, range: 7, pellets: 8, dmgBonus: 0.2, sfx: 'shotgun' },
  'rocket-launcher': { name: '火箭筒', dmg: 35, rate: 1.1, ammo: 'rocket', ammoTiers: ['rocket', 'explosive-rocket'], ammoDmg: { 'rocket': 35, 'explosive-rocket': 60 }, splashAmmo: { 'rocket': 1.8, 'explosive-rocket': 3.2 }, spread: 0.03, auto: false, range: 9, splash: 1.8, sfx: 'rocket' },
  // 原子弹（对齐《异星工厂》Atomic bomb）：火箭筒发射的终极核武器，命中引发超大范围核爆
  'atomic-bomb': { name: '原子弹', dmg: 300, rate: 2.5, ammo: 'atomic-bomb', spread: 0.02, auto: false, range: 12, splash: 9, nuclear: true, sfx: 'rocket' },
  'grenade':         { name: '手雷',   dmg: 40, rate: 0.8, ammo: 'grenade',          spread: 0.05, auto: false, range: 6, splash: 2.5, sfx: 'throw' },
  'cluster-grenade': { name: '集束手雷', dmg: 80, rate: 1.0, ammo: 'cluster-grenade', spread: 0.05, auto: false, range: 6, splash: 4.5, sfx: 'throw' },
  'flamethrower':    { name: '火焰喷射器', dmg: 6, rate: 0.12, ammo: 'flamethrower-ammo', spread: 0.2, auto: true, range: 6, flame: true, sfx: 'flamethrower' },
  'poison-capsule':  { name: '毒胶囊', dmg: 0, rate: 0.8, ammo: 'poison-capsule', spread: 0.05, auto: false, range: 6, capsule: 'poison' },
  'slowdown-capsule':{ name: '减速胶囊', dmg: 0, rate: 0.8, ammo: 'slowdown-capsule', spread: 0.05, auto: false, range: 6, capsule: 'slowdown' },
  // 战斗机器人胶囊：投掷后释放战斗机器人（见 CAPSULES）
  'defender-capsule':   { name: '防御机器人',   dmg: 0, rate: 0.8, ammo: 'defender-capsule',   spread: 0, auto: false, range: 6, capsule: 'defender' },
  'distractor-capsule': { name: '干扰机器人',   dmg: 0, rate: 0.8, ammo: 'distractor-capsule', spread: 0, auto: false, range: 6, capsule: 'distractor' },
  'destroyer-capsule':  { name: '破坏机器人',   dmg: 0, rate: 0.8, ammo: 'destroyer-capsule',  spread: 0, auto: false, range: 6, capsule: 'destroyer' },
  // 轨道炮（官方 Space Age Railgun）：太空时代终极单兵武器，发射磁轨炮弹沿直线贯穿多个敌人造成巨额伤害
  'railgun': { name: '轨道炮', dmg: 500, rate: 2.0, ammo: 'railgun-ammo', spread: 0.01, auto: false, range: 40, railgun: true, sfx: 'machine-gun' },
  // 特斯拉电枪（官方 Space Age Tesla gun）：Fulgora 电能武器，发射电弧在目标间连锁跳跃并逐跳递减伤害
  'teslagun': { name: '特斯拉电枪', dmg: 30, rate: 1.0, ammo: 'tesla-ammo', spread: 0.01, auto: true, range: 24, tesla: true, sfx: 'laser' },
};
function isWeapon(id) { return !!WEAPONS[id]; }
function isCapsuleWeapon(id) { return !!(WEAPONS[id] && WEAPONS[id].capsule); }
// 角度归一化（把任意弧度规整到 [-π,π]），供轨道炮直线判定使用
function weaponNormAng(a) { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; }
// 设置当前手持武器（带科技/物品存在校验）
function setWeapon(id) {
  if (!id) { G.weapon = null; uiDirty = true; return; }
  if (!isWeapon(id)) { G.weapon = null; return; }
  if (WEAPON_TECH_REQ[id] && !G.techDone[WEAPON_TECH_REQ[id]]) {
    if (typeof toast === 'function') toast('需要先研究「' + TECHS[WEAPON_TECH_REQ[id]].name + '」才能使用 ' + ITEMS[id].name);
    return;
  }
  G.weapon = id;
  uiDirty = true;
}

// 是否已装备（手持）武器：为武器类且背包中仍有该武器本体。
// 对齐《异星工厂》：持枪才能开火；近战斧头同理需手持才可挥砍。
function hasEquippedWeapon() {
  return !!G.weapon && isWeapon(G.weapon) && invCount(G.weapon) >= 1;
}

// 循环切换工具栏中已装备的武器（新默认快捷键 C）。
// 仅在快捷栏（HOTBAR）里扫描仍拥有本体的武器，从当前武器之后开始找下一个，
// 找到则切换手持并同步快捷栏选中；若无任何武器则不切换。
function cycleWeapon() {
  // 收集快捷栏中当前实际可用的武器（拥有本体且科技已解锁）
  const pool = [];
  for (let i = 0; i < HOTBAR.length; i++) {
    const id = HOTBAR[i];
    if (id && isWeapon(id) && invCount(id) >= 1) {
      if (WEAPON_TECH_REQ[id] && !G.techDone[WEAPON_TECH_REQ[id]]) continue;
      pool.push({ id, i });
    }
  }
  if (pool.length === 0) {
    if (typeof toast === 'function') toast('快捷栏中没有可用武器');
    if (typeof playSfx === 'function') playSfx('error');
    return;
  }
  // 从当前武器向后取下一个；当前未在池中则取第一个
  const curId = G.weapon;
  let idx = pool.findIndex(p => p.id === curId);
  idx = (idx + 1) % pool.length;
  const next = pool[idx];
  // 直接切换武器并同步快捷栏选中（勿重复触发 setWeapon 的科技拦截，已在收集时过滤）
  G.weapon = next.id;
  G.sel = -1;
  G.quickSel = next.id;
  if (typeof refreshHotbar === 'function') refreshHotbar();
  if (typeof playSfx === 'function') playSfx('select');
  if (typeof toast === 'function') toast('已切换武器：' + (ITEMS[next.id] ? ITEMS[next.id].name : WEAPONS[next.id].name));
  uiDirty = true;
}

// 近战斧头攻击：挥砍目标点短距离内的单个敌人（无需弹药）。
function playerMeleeAttack(tx, ty) {
  const id = G.weapon;
  if (!id) return;
  const w = WEAPONS[id];
  if (!w || !w.melee) return;
  const px = G.player.x, py = G.player.y;
  const reach = w.range * TILE;
  const base = (typeof weaponDamageMult === 'function' ? weaponDamageMult() : 1) *
               (typeof weaponCategoryMult === 'function' ? weaponCategoryMult('projectile') : 1);
  const dmg = Math.round(w.dmg * base);
  // 命中光标范围内最近的敌人
  const alive = G._aliveEnemies || (G.enemies || []);
  let best = null, bestD = Infinity;
  for (const en of alive) {
    if (en.dead) continue;
    const d = Math.hypot(en.x - px, en.y - py);
    if (d <= reach && d < bestD) { best = en; bestD = d; }
  }
  if (best) {
    best.hp -= dmg;
    if (best.hp <= 0) best.dead = true;
  }
  if (typeof playSfx === 'function') playSfx(w.sfx || 'mine');
  // 挥砍命中特效：命中点火花（若有粒子系统）
  if (typeof spawnHitSpark === 'function' && best) spawnHitSpark(best.x, best.y);
  uiDirty = true;
}

// 攻击选中目标（默认 Shift+空格）：朝鼠标指针选中的目标（敌人/建筑/树木）开火。
// 若光标指向非敌人实体（建筑/树），弹丸飞向该位置（命中可破坏物由命中检测处理）。
function playerFireAtCursor() {
  if (!G.cursorTile) return;
  const tx = G.cursorTile.tx * TILE + TILE / 2;
  const ty = G.cursorTile.ty * TILE + TILE / 2;
  playerFire(tx, ty);
}
// 朝目标点开火
function playerFire(tx, ty) {
  const id = G.weapon;
  if (!id) return;
  if (WEAPON_TECH_REQ[id] && !G.techDone[WEAPON_TECH_REQ[id]]) return;
  const w = WEAPONS[id];
  // 战斗机器人胶囊：投掷后释放机器人
  if (isCapsuleWeapon(id)) {
    throwCapsule(id, tx, ty);
    return;
  }
  // 近战武器（斧头）：挥砍目标点短距离内的敌人，无需弹药
  if (w.melee) {
    playerMeleeAttack(tx, ty);
    return;
  }
  const px = G.player.x, py = G.player.y;
  // 弹药检查：火焰喷射器消耗石油气（流体），其余消耗物品。
  // 冲锋枪等支持弹药升级的武器，自动消耗玩家身上最优的弹药并套用对应伤害（对齐《异星工厂》）。
  let ammoUsed = w.ammo;
  if (w.ammoTiers && w.ammoTiers.length > 1) {
    for (let i = w.ammoTiers.length - 1; i >= 0; i--) {
      if (invCount(w.ammoTiers[i]) >= 1) { ammoUsed = w.ammoTiers[i]; break; }
    }
  }
  if (ammoUsed === 'petroleum-gas') {
    if (invCount('petroleum-gas') < 1) return;
    invTake('petroleum-gas', 1);
  } else {
    if (invCount(ammoUsed) < 1) return;
    invTake(ammoUsed, 1);
  }
  const baseAng = Math.atan2(ty - py, tx - px);
  const pellets = w.pellets || 1;
  // 武器伤害无限科技倍率（对齐《异星工厂》Weapon damage research）+ 分类军事无限科技
  const base = (typeof weaponDamageMult === 'function' ? weaponDamageMult() : 1) * (typeof weaponCategoryMult === 'function' ? weaponCategoryMult(weaponDamageKind(id)) : 1);
  // 弹药升级伤害：使用穿甲弹/铀弹时套用对应伤害，否则用武器基础伤害
  let baseDmg = w.dmg;
  if (w.ammoDmg && w.ammoDmg[ammoUsed]) baseDmg = w.ammoDmg[ammoUsed];
  // 武器固有伤害加成（如战斗散弹枪 +20% 伤害）
  if (w.dmgBonus) baseDmg = Math.round(baseDmg * (1 + w.dmgBonus));
  const dmg = Math.round(baseDmg * base);
  // 轨道炮（官方 Railgun）：沿射向直线贯穿多个敌人（对齐官方 railgun-ammo 直线穿透高伤）
  if (w.railgun) {
    const ang = baseAng;
    const enemies = G._aliveEnemies || (G.enemies || []);
    const railRange = w.range * TILE;
    for (const en of enemies) {
      if (!en || en.dead) continue;
      const dx = en.x - px, dy = en.y - py;
      const d = Math.hypot(dx, dy);
      if (d > railRange) continue;
      const da = Math.abs(weaponNormAng(Math.atan2(dy, dx) - ang));
      if (da < 0.08) { en.hp -= dmg; if (en.hp <= 0) en.dead = true; }
    }
    // 直线光束特效
    (G.bullets || (G.bullets = [])).push({
      x: px, y: py, tx: px + Math.cos(ang) * railRange, ty: py + Math.sin(ang) * railRange,
      t: 0, life: 0.12, dmg: 0, kind: 'railgun'
    });
    if (typeof playSfx === 'function') playSfx(w.sfx || 'machine-gun');
    uiDirty = true;
    return;
  }
  // 特斯拉电枪（官方 Tesla gun）：电弧在目标间连锁跳跃，逐跳递减伤害
  if (w.tesla) {
    const enemies = G._aliveEnemies || (G.enemies || []);
    const teslaRange = w.range * TILE;
    // 射程内最近的敌人作首目标
    let best = null, bestD = Infinity;
    for (const en of enemies) {
      if (!en || en.dead) continue;
      const d = Math.hypot(en.x - px, en.y - py);
      if (d <= teslaRange && d < bestD) { best = en; bestD = d; }
    }
    if (best) {
      const chain = [];
      let cur = best;
      const hit = new Set();
      let cd = dmg;
      for (let i = 0; i < 5 && cur; i++) {
        hit.add(cur);
        chain.push({ x: cur.x, y: cur.y });
        cur.hp -= Math.round(cd);
        if (cur.hp <= 0) cur.dead = true;
        cd *= 0.8;
        let nxt = null, nxtD = Infinity;
        for (const en of enemies) {
          if (!en || en.dead || hit.has(en)) continue;
          const d = Math.hypot(en.x - cur.x, en.y - cur.y);
          if (d <= TILE * 10 && d < nxtD) { nxt = en; nxtD = d; }
        }
        cur = nxt;
      }
      (G.bullets || (G.bullets = [])).push({
        x: px, y: py, tx: best.x, ty: best.y, t: 0, life: 0.1, dmg: 0, kind: 'tesla'
      });
    }
    if (typeof playSfx === 'function') playSfx(w.sfx || 'laser');
    uiDirty = true;
    return;
  }
  for (let i = 0; i < pellets; i++) {
    const a = baseAng + (Math.random() - 0.5) * 2 * w.spread;
    const dist = w.range * TILE;
    const tx2 = px + Math.cos(a) * dist;
    const ty2 = py + Math.sin(a) * dist;
    if (w.splash) {
      // 火箭弹：命中目标后范围爆炸
      (G.bullets || (G.bullets = [])).push({
        x: px, y: py, tx: tx2, ty: ty2, t: 0, life: 0.18,
        splash: (w.splashAmmo && w.splashAmmo[ammoUsed]) || w.splash, dmg: dmg, kind: 'rocket',
        nuclear: !!w.nuclear
      });
    } else if (w.flame) {
      (G.bullets || (G.bullets = [])).push({
        x: px, y: py, tx: tx2, ty: ty2, t: 0, life: 0.2, dmg: dmg, kind: 'flame'
      });
    } else {
      (G.bullets || (G.bullets = [])).push({
        x: px, y: py, tx: tx2, ty: ty2, t: 0, life: 0.12, dmg: dmg, kind: 'bullet'
      });
    }
  }
  if (typeof playSfx === 'function') playSfx(w.sfx || (w.pellets > 1 ? 'shotgun' : 'shoot'));
  uiDirty = true;
}
// 玩家开火更新：按住空格/左键对敌人持续射击（手动攻击）。
// 玩家角色本身不具备自动攻击能力——“自动攻击”仅由炮塔、蜘蛛机甲等设备/载具执行。
function updatePlayerFire(dt) {
  if (!G.weapon || !G.settings.combat) return;
  // 驾驶装甲车/坦克时：按住空格由车载机枪/主炮开火，不再用手持武器（对齐《异星工厂》：驾驶载具用载具武器）
  if (G.driving && G.driving.ent && (G.driving.ent instanceof Car)) return;
  G.playerFireT -= dt;
  const w = WEAPONS[G.weapon];
  if (!w) return;
  // 是否触发开火：按住 空格 或 鼠标左键（装备武器后直接按住即可连续射击）
  // 注意：G.weapon 仅在手握武器时非空（选中建筑时被 setWeapon 置空），故左键开火无需再判 buildActive
  const firing = !!G.keys[' '] || (!!G.mouseDown && !G.driving);
  if (!firing) return;
  if (w && !w.auto && G.playerFireT > 0) return;  // 非自动武器需间隔
  if (G.playerFireT > 0) return;
  // 目标点：鼠标光标所在世界坐标，或朝向方向
  let tx, ty;
  if (G.cursorTile) {
    tx = G.cursorTile.tx * TILE + TILE / 2;
    ty = G.cursorTile.ty * TILE + TILE / 2;
  } else {
    const a = G.player.dir * Math.PI / 2;
    tx = G.player.x + Math.cos(a) * TILE * 3;
    ty = G.player.y + Math.sin(a) * TILE * 3;
  }
  playerFire(tx, ty);
  // 射击速度无限科技：射击间隔缩短，射速提升（对齐《异星工厂》Shooting speed）
  G.playerFireT = (typeof shootingSpeedMult === 'function' ? w.rate / shootingSpeedMult() : w.rate);
}

// 攻击选中目标（Shift+空格）：对鼠标指针选中的特定目标（敌人/建筑/树木）开火。
// 视为“强制攻击”，无论目标是否为敌人都朝其位置射击。
function attackSelectedTarget() {
  if (!G.weapon || !G.settings.combat) return;
  if (G.driving && G.driving.ent && (G.driving.ent instanceof Car)) return;
  const w = WEAPONS[G.weapon];
  if (!w) return;
  G.playerFireT = 0;
  if (!G.cursorTile) return;
  playerFireAtCursor();
  G.playerFireT = (typeof shootingSpeedMult === 'function' ? w.rate / shootingSpeedMult() : w.rate);
}
// 玩家子弹命中敌人（沿子弹飞行路径检测）
function updatePlayerBulletHits(dt) {
  if (!G.bullets) return;
  // 性能优化：复用主循环每帧缓存的存活敌人列表（避免重复 filter 分配数组）
  const alive = G._aliveEnemies || (G.enemies || []).filter(e => !e.dead);
  if (alive.length === 0) return;
  for (const b of G.bullets) {
    if (b.hit || (b.kind !== 'bullet' && b.kind !== 'flame' && b.kind !== 'rocket')) continue;
    // 火箭/手雷：飞行结束时在终点爆炸
    if (b.splash) {
      if (b.t >= b.life && !b.hit) { b.hit = true; explodeDamage(b.tx, b.ty, b.splash, b.dmg); }
      continue;
    }
    // 普通弹/火焰：命中飞行路径上的第一个敌人
    const t = b.t / b.life;
    const cx = b.x + (b.tx - b.x) * t, cy = b.y + (b.ty - b.y) * t;
    for (const en of alive) {
      if (en.dead) continue;   // 本帧内可能已被其他子弹/爆炸击杀
      const d = Math.hypot(cx - en.x, cy - en.y);
      if (d <= en.size + 4) {
        en.hp -= b.dmg;
        // 火焰命中敌人：在该处地面留下燃烧火场
        if (b.kind === 'flame' && typeof spawnGroundFire === 'function') spawnGroundFire(en.x, en.y);
        if (en.hp <= 0) en.dead = true;
        b.hit = true;
        break;
      }
    }
  }
}
// 范围爆炸伤害（火箭弹/手雷）
function explodeDamage(cx, cy, radius, dmg) {
  if (!G.enemies) return;
  for (const en of G.enemies) {
    if (en.dead) continue;
    const d = Math.hypot(cx - en.x, cy - en.y);
    if (d <= radius * TILE) {
      en.hp -= dmg;
      if (en.hp <= 0) en.dead = true;
    }
  }
  // 爆炸也会伤害玩家自身（距离过近时）
  // 性能优化：平方距离比较（与 Math.hypot 数学等价）
  { const _bx = cx - G.player.x, _by = cy - G.player.y, _br = radius * TILE * 0.5; if (_bx*_bx + _by*_by <= _br*_br) damagePlayer(dmg * 0.4); }
  if (typeof playSfx === 'function') playSfx('explosion');
}

// ===== 核爆特效（原子弹，对齐《异星工厂》Atomic bomb 的蘑菇云） =====
// 生成蘑菇云烟柱、冲击波环与强光闪光，并在爆炸中心留下高温灼烧粒子。
function spawnNuclearExplosion(cx, cy) {
  // 蘑菇云烟柱：多条上飘的烟粒子，随高度扩散
  const cols = ['#ffd27a', '#ff9a3a', '#d05a2a', '#7a4a3a', '#4a3a3a', '#9a9aa0'];
  for (let i = 0; i < 60; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = 1 + Math.random() * 4;
    const hgt = (Math.random() * 4 + 1) * TILE;
    if (typeof spawnSmoke === 'function') {
      spawnSmoke(cx + Math.cos(a) * sp * 6, cy - hgt, {
        life: 2.5 + Math.random() * 2,
        size: 8 + Math.random() * 14,
        vx: Math.cos(a) * sp * 2,
        vy: -(3 + Math.random() * 5),
        color: cols[(Math.random() * cols.length) | 0]
      });
    }
  }
  // 蘑菇云顶部圆盘（球形扩散）
  for (let i = 0; i < 40; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = (Math.random() * 5 + 2) * TILE;
    if (typeof spawnSmoke === 'function') {
      spawnSmoke(cx + Math.cos(a) * r, cy - 4 * TILE - Math.random() * 2 * TILE, {
        life: 2 + Math.random() * 2,
        size: 10 + Math.random() * 16,
        vx: Math.cos(a) * 1.5,
        vy: -1 + Math.random(),
        color: '#c87a4a'
      });
    }
  }
  // 高温火花：爆炸中心向外飞溅
  for (let i = 0; i < 50; i++) {
    if (typeof spawnSpark === 'function') spawnSpark(cx, cy, { speed: 5 + Math.random() * 8, life: 0.8, size: 3, color: '#ffe0a0' });
  }
  // 冲击波环标记：通过 G.bullets 插入一枚无伤害的“波环”子弹，仅用于渲染扩散冲击波
  (G.bullets || (G.bullets = [])).push({
    x: cx, y: cy, tx: cx, ty: cy, t: 0, life: 0.8, dmg: 0,
    splash: 9, kind: 'nuclear-wave', _boomT: 0, _boomBase: 0, nuclear: true, waveOnly: true
  });
  // 强光闪屏
  if (typeof addScreenFlash === 'function') addScreenFlash(0.9);
  else if (G.screenFlash === undefined) G.screenFlash = 1;
  else G.screenFlash = Math.max(G.screenFlash || 0, 1);
  // 核爆轰鸣音效
  if (typeof playSfx === 'function') playSfx('explosion');
}


// ===== 战斗机器人胶囊（对齐《异星工厂》Combat robots） =====
// 玩家选择胶囊后按空格/点击投掷，落地释放战斗机器人：
//  - defender（防御）：跟随玩家，自动攻击附近敌人，有续航时间
//  - distractor（干扰）：原地悬浮吸引敌人火力
//  - destroyer（破坏）：主动冲向并摧毁敌人，伤害更高
const CAPSULES = {
  'defender-capsule':   { name: '防御机器人', hp: 120, dmg: 6,  speed: 60,  lifetime: 45, size: 5, follow: true,  seek: false, color: '#5aa0d0' },
  'distractor-capsule': { name: '干扰机器人', hp: 200, dmg: 0,  speed: 0,   lifetime: 30, size: 6, follow: false, seek: false, color: '#d0a04a' },
  'destroyer-capsule':  { name: '破坏机器人', hp: 100, dmg: 10, speed: 90,  lifetime: 30, size: 5, follow: true,  seek: true,  color: '#d05a5a' }
};
function isCapsule(id) { return !!CAPSULES[id]; }
function throwCapsule(id, tx, ty) {
  if (invCount(id) < 1) return false;
  if (TECH_REQ[id] && !G.techDone[TECH_REQ[id]]) {
    if (typeof toast === 'function') toast('需要先研究「' + TECHS[TECH_REQ[id]].name + '」才能使用 ' + ITEMS[id].name);
    return false;
  }
  // 追随机器人数量上限（对齐《异星工厂》Follower robot count）：默认 5，逐级 +2
  // 战斗机器人胶囊在消耗前校验上限，避免满员时白白扣掉胶囊（毒/减速胶囊不受此限制）
  if (CAPSULES[id] && !(id === 'poison-capsule' || id === 'slowdown-capsule')) {
    if (!G.combatRobots) G.combatRobots = [];
    const cap = 5 + 2 * ((G.techProg && G.techProg['follower-robot-count']) || 0);
    if (G.combatRobots.length >= cap) {
      if (typeof toast === 'function') toast('战斗机器人已达上限（' + cap + '，研究「追随机器人」可提升）');
      uiDirty = true;
      return false;
    }
  }
  invTake(id, 1);
  if (typeof playSfx === 'function') playSfx('deploy');
  if (id === 'poison-capsule' || id === 'slowdown-capsule') {
    const kind = id === 'poison-capsule' ? 'poison' : 'slowdown';
    if (!G.aoeZones) G.aoeZones = [];
    G.aoeZones.push({
      kind, x: tx, y: ty, radius: (id === 'poison-capsule' ? 3 : 3.5) * TILE,
      lifetime: (id === 'poison-capsule' ? 12 : 10), maxLife: (id === 'poison-capsule' ? 12 : 10),
      dmg: id === 'poison-capsule' ? 8 : 0, tickT: 0
    });
    if (typeof toast === 'function') toast('投掷 ' + ITEMS[id].name + '：释放' + (id === 'poison-capsule' ? '剧毒云雾' : '减速力场'));
    uiDirty = true;
    return true;
  }
  const c = CAPSULES[id];
  if (!G.combatRobots) G.combatRobots = [];
  const cap = 5 + 2 * ((G.techProg && G.techProg['follower-robot-count']) || 0);
  // 一次投掷释放 2 只（destroyer 1 只）
  const n = id === 'destroyer-capsule' ? 1 : 2;
  for (let i = 0; i < n; i++) {
    if (G.combatRobots.length >= cap) break;
    G.combatRobots.push({
      type: id, kind: id.replace('-capsule', ''),
      name: c.name, hp: c.hp, maxhp: c.hp, dmg: c.dmg, speed: c.speed,
      lifetime: c.lifetime, size: c.size, follow: c.follow, seek: c.seek,
      color: c.color, x: G.player.x + (Math.random() - 0.5) * 10,
      y: G.player.y + (Math.random() - 0.5) * 10, fireT: 0, dead: false, dir: 0
    });
  }
  if (typeof toast === 'function') toast('投掷 ' + ITEMS[id].name + '：释放 ' + c.name);
  uiDirty = true;
  return true;
}
// 更新战斗机器人：跟随/攻击/续航倒计时
function updateCombatRobots(dt) {
  if (!G.combatRobots || G.combatRobots.length === 0) return;
  const p = G.player;
  // 性能优化：复用主循环每帧缓存的存活敌人列表
  const enemies = G._aliveEnemies || (G.enemies || []).filter(e => !e.dead);
  for (const r of G.combatRobots) {
    if (r.dead) continue;
    r.lifetime -= dt;
    if (r.lifetime <= 0 || r.hp <= 0) { r.dead = true; continue; }
    r.fireT -= dt;
    if (r.kind === 'distractor') {
      // 干扰机器人：原地悬浮，不做攻击，但吸引近战敌人靠近
      continue;
    }
    // 寻找最近敌人
    let target = null, bestD = Infinity;
    for (const en of enemies) {
      if (en.kind === 'spawner') continue;
      const d = Math.hypot(en.x - r.x, en.y - r.y);
      if (d < bestD) { bestD = d; target = en; }
    }
    if (r.kind === 'destroyer' && target) {
      // 破坏机器人：主动冲向敌人
      const d = Math.max(1, Math.hypot(target.x - r.x, target.y - r.y));
      r.x += ((target.x - r.x) / d) * r.speed * dt;
      r.y += ((target.y - r.y) / d) * r.speed * dt;
      if (bestD < r.size + target.size + 6) {
        if (r.fireT <= 0) { r.fireT = 0.6; target.hp -= r.dmg; if (target.hp <= 0) target.dead = true; }
      }
    } else if (target) {
      // 防御机器人：跟随玩家，对射程内敌人开火
      const pd = Math.hypot(p.x - r.x, p.y - r.y);
      if (pd > TILE * 4) {
        const d = Math.max(1, pd);
        r.x += ((p.x - r.x) / d) * r.speed * dt;
        r.y += ((p.y - r.y) / d) * r.speed * dt;
      }
      if (bestD < TILE * 7 && r.fireT <= 0) {
        r.fireT = 0.5;
        target.hp -= r.dmg;
        if (target.hp <= 0) target.dead = true;
      }
    } else if (r.follow) {
      const pd = Math.hypot(p.x - r.x, p.y - r.y);
      if (pd > TILE * 3) {
        const d = Math.max(1, pd);
        r.x += ((p.x - r.x) / d) * r.speed * dt;
        r.y += ((p.y - r.y) / d) * r.speed * dt;
      }
    }
    // 机器人会被近战敌人攻击
    for (const en of enemies) {
      if (en.kind !== 'melee') continue;
      const d = Math.hypot(en.x - r.x, en.y - r.y);
      if (d < r.size + en.size + 4) { r.hp -= en.dmg * dt; }
    }
  }
  G.combatRobots = compactFilter(G.combatRobots, r => !r.dead);
}

// ===== 区域力场（毒胶囊 / 减速胶囊）=====
// 毒胶囊落地形成剧毒云雾，对范围内敌人持续伤害；减速胶囊形成减速力场，降低敌人移动速度。
function updateAoeZones(dt) {
  if (!G.aoeZones || G.aoeZones.length === 0) return;
  // 性能优化：复用主循环每帧缓存的存活敌人列表
  const alive = G._aliveEnemies || (G.enemies || []).filter(e => !e.dead);
  for (const z of G.aoeZones) {
    z.lifetime -= dt;
    if (z.lifetime <= 0) continue;
    if (z.kind === 'poison') {
      // 每秒造成一次范围伤害
      z.tickT -= dt;
      if (z.tickT <= 0) {
        z.tickT = 1;
        for (const en of alive) {
          if (en.dead) continue;
          const d = Math.hypot(en.x - z.x, en.y - z.y);
          if (d <= z.radius + en.size) en.hp -= z.dmg;
          if (en.hp <= 0) en.dead = true;
        }
      }
    } else if (z.kind === 'slowdown') {
      // 减速：标记力场是否覆盖玩家
      z.playerSlow = Math.hypot(G.player.x - z.x, G.player.y - z.y) <= z.radius;
    }
  }
  G.aoeZones = compactFilter(G.aoeZones, z => z.lifetime > 0);
}
// 供敌人移动逻辑调用：若敌人位于减速力场则返回减速系数（0.5 = 半速）
function aoeSlowFactor(x, y) {
  if (!G.aoeZones) return 1;
  for (const z of G.aoeZones) {
    if (z.kind === 'slowdown' && z.lifetime > 0 && Math.hypot(x - z.x, y - z.y) <= z.radius) return 0.45;
  }
  return 1;
}

// 手雷/集束手雷：从背包使用时投掷爆炸（由 ui.js 调用）。
// 投掷物复用 splash 爆炸路径（kind 用 'rocket'，由 updatePlayerBulletHits 的 splash 分支处理爆炸）。
function throwGrenade(tx, ty, type) {
  type = type || 'grenade';
  if (invCount(type) < 1) return;
  if (!G.settings.combat) {
    if (typeof toast === 'function') toast('需在设置中开启战斗才能投掷');
    return;
  }
  const w = WEAPONS[type] || WEAPONS['grenade'];
  invTake(type, 1);
  const px = G.player.x, py = G.player.y;
  // 投掷目标点：传入的是瓦片坐标，转换为世界坐标；若玩家在范围内则向目标投掷
  let gx = tx * TILE + TILE / 2, gy = ty * TILE + TILE / 2;
  (G.bullets || (G.bullets = [])).push({
    x: px, y: py, tx: gx, ty: gy,
    t: 0, life: 0.45, dmg: w.dmg, splash: w.splash, kind: 'rocket'
  });
  if (typeof toast === 'function') toast('💣 投掷 ' + ITEMS[type].name);
  uiDirty = true;
}

