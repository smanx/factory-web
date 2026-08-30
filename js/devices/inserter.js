'use strict';

// ===== 机械臂族：普通 / 长臂 / 过滤 / 堆叠 =====
function angNorm(a) {
  return ((a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
}
function approachAng(a, t, step) {
  const d = angNorm(t - a);
  if (Math.abs(d) < 1e-9) return t;
  const m = Math.min(Math.abs(d), step);
  return a + Math.sign(d) * m;
}

// ===== 官方机械臂参数桥接（GAME_DATA 由 factorio-data 现场生成）=====
// 官方 rotation_speed 相对倍率（rad/tick）用于旋转速度；inserter_stack_size_override 用于堆叠抓取上限。
// 游戏采用简化的角速度模型：基础机械臂 rotSpeed=1，其余类型按官方 rotation_speed 相对普通臂的比例放大，
// 使各机械臂的相对性能与《异星工厂》官方一致。
function inserterRotMult(type) {
  if (typeof GAME_DATA === 'undefined' || !GAME_DATA.inserterStats || !GAME_DATA.inserterStats.perType) return 1;
  const base = GAME_DATA.inserterStats.perType['inserter'] && GAME_DATA.inserterStats.perType['inserter'].rotationSpeed;
  const cur = GAME_DATA.inserterStats.perType[type];
  if (typeof base === 'number' && cur && typeof cur.rotationSpeed === 'number') {
    const m = Math.round(cur.rotationSpeed / base * 1000) / 1000;
    if (m > 0) return m;
  }
  return 1;
}
function inserterStackMax(type) {
  if (typeof GAME_DATA === 'undefined' || !GAME_DATA.inserterStats || !GAME_DATA.inserterStats.perType) return 1;
  const cur = GAME_DATA.inserterStats.perType[type];
  if (cur && typeof cur.stack === 'number') return cur.stack;
  return 1;
}

class Inserter extends Entity {
  constructor(type, x, y) {
    super(type || 'inserter', x, y);
    this.reach = 1;      // 触及距离（格），长臂子类改为 2
    this.holding = null;
    this.holdingCount = 0;
    const itype = type || 'inserter';
    this.stackMax = inserterStackMax(itype);  // 官方 inserter_stack_size_override（普通臂 1 / 堆叠臂 3）
    this.rotSpeed = inserterRotMult(itype);   // 官方 rotation_speed 相对倍率（快速/堆叠臂 ≈ 2.857×）
    // ===== 筛选功能（有机组：每个机械臂都自带）=====
    // 择优实现《异星工厂》过滤抓取：可设为白名单（只抓名单内）/黑名单（不抓名单内），各有 5 个格子。
    this.filterOn = false;   // 是否启动筛选
    this.filterMode = 'white'; // 'white' 白名单 | 'black' 黑名单
    this.filters = [];       // 筛选物品列表（最多 5 个）
    // 设置抓取堆叠：0=未启用；启用后取值 1 ~ 当前机械臂最大抓取数量（capacity，受机械臂容量科技影响）
    this.pickStack = 0;
    // 变质优先级：勾选后启用（默认「变质优先」，可切换到「新鲜优先」）
    this.spoilPrio = false;
    this.spoilMode = 'spoil'; // 'spoil' 变质优先 | 'fresh' 新鲜优先
    // 投放/取货侧翻转位：机械臂翻转（R 旋转 / V/H 镜像）后切换，使夹取传送带的边换一边。
    // 默认 false=取近侧/放远侧；翻转后 true=取远侧/放近侧。
    this.sideFlip = false;
    this.blocked = false;
    this.armAng = undefined;
    // 电路控制（对齐《异星工厂》：机械臂接入电路网络，可按信号启停，并可把爪上物品输出到电路网络）
    this.circuitCond = { enabled: false, channel: 'red', sig: 'iron-plate', op: '>', count: 1, readHand: false };
  }
  // 电路启停：未启用条件时恒工作；启用后仅当附近电路信号满足条件才运转
  // 翻转/旋转机械臂时切换取放侧，使夹取传送带的边（lane）换一边。
  onRotate() { this.sideFlip = !this.sideFlip; }
  circuitEnabled() {
    if (!this.circuitCond || !this.circuitCond.enabled) return true;
    const sig = circuitSignalNear(this);
    return circuitCondOk(sig, this.circuitCond);
  }
  // 单次抓取容量（对齐《异星工厂》：堆叠臂随「机械臂容量」无限科技提升抓取数量）
  capacity() {
    let cap = this.stackMax || 1;
    // 机械臂容量（无限科技）：每研究一次，堆叠臂单次抓取 +1（普通臂一次仍 1 个）
    if (this.stackMax > 1 && G.techProg['inserter-capacity']) cap += G.techProg['inserter-capacity'];
    return cap;
  }
  // ===== 筛选功能辅助 =====
  // 筛选是否生效：勾选启用即生效（无需填满格子）。
  // 白名单未填任何物品时视为「不抓取任何物品」（对齐《异星工厂》：过滤器开启但名单为空 → 机械臂停止搬运）。
  filterActive() { return !!this.filterOn; }
  // 某物品是否应被抓取（按白/黑名单判断；筛选关闭时一律抓取）。
  // 白名单：只在名单内；名单为空 → 一律不抓。黑名单：不在名单内；名单为空 → 一律抓。
  wantsItem(item) {
    if (!this.filterActive()) return true;
    const inList = (this.filters || []).indexOf(item) >= 0;
    return this.filterMode === 'white' ? inList : !inList;
  }
  // 一次抓取多少个：由「设置抓取堆叠」决定，范围 1 ~ 当前最大抓取数量（capacity）
  grabN() {
    const cap = this.capacity();
    const n = (this.pickStack && this.pickStack >= 1) ? Math.floor(this.pickStack) : 1;
    return Math.max(1, Math.min(cap, n));
  }
  // ===== 几何：严格单向，取格 = 箭头反方向，放格 = 箭头方向 =====
  pickOffset() {
    const d = (this.dir + 2) % 4;
    return { dx: DX[d] * this.reach, dy: DY[d] * this.reach };
  }
  dropOffset() {
    return { dx: DX[this.dir] * this.reach, dy: DY[this.dir] * this.reach };
  }
  pickAng() { const o = this.pickOffset(); return Math.atan2(o.dy, o.dx); }
  dropAng() { const o = this.dropOffset(); return Math.atan2(o.dy, o.dx); }
  entAtPick() {
    const o = this.pickOffset();
    const x = this.x + o.dx, y = this.y + o.dy;
    const e = entAt(x, y);
    return (e && !(e instanceof Inserter)) ? e : null;
  }
  entAtDrop() {
    const o = this.dropOffset();
    const x = this.x + o.dx, y = this.y + o.dy;
    const e = entAt(x, y);
    return (e && !(e instanceof Inserter)) ? e : null;
  }
  // 取物格传送带的“近侧车道”：机械臂优先从靠近自己一侧的车道取物（对齐《异星工厂》）。
  // 返回 0/1（行进方向左/右列），供 grabZone 优先抓取近侧 lane；
  // 若近侧 lane 无货则回退到任意 lane，保证远侧物品也能被取到。
  pickBeltLane(s) {
    if (!(s instanceof Belt)) return undefined;
    const bx = s.x, by = s.y;
    const dx = this.x - bx, dy = this.y - by;
    const fdx = DX[s.dir], fdy = DY[s.dir];
    const perp = [fdy, -fdx];
    const d = dx * perp[0] + dy * perp[1];
    const near = d > 0 ? 1 : 0;
    // 默认优先取近侧 lane；翻转（sideFlip）后换到远侧 lane（夹取边换一边）。
    return this.sideFlip ? (near === 1 ? 0 : 1) : near;
  }
  // 放物格传送带的“远侧车道”：机械臂把物品放到远离自己一侧的车道。
  // 传送带为双列（左右两线）时，机械臂侧放默认进入远离机械臂的那一线，
  // 避免物品都挤在机械臂所在的近侧线上。翻转（sideFlip）后换到近侧车道（投放边换一边）。
  dropBeltLane(t) {
    if (!(t instanceof Belt)) return 0;
    const bx = t.x, by = t.y;
    const dx = this.x - bx, dy = this.y - by;
    const fdx = DX[t.dir], fdy = DY[t.dir];
    const perp = [fdy, -fdx];
    const near = (dx * perp[0] + dy * perp[1]) > 0 ? 1 : 0;
    const far = near === 1 ? 0 : 1;   // 远侧车道 = 近侧车道的对侧
    return this.sideFlip ? near : far;
  }
  // ===== 取物 =====
  peekSource(s) {
    if (!s) return null;
    let it = null;
    if (s instanceof Belt) {
      // 优先抓取靠近机械臂一侧的 lane；近侧无货时回退到任意 lane（远侧仍可取到）。
      // 按筛选规则（白/黑名单）在带上挑选可抓的物品。
      let z = s.grabZone(o => this.wantsItem(o), this.pickBeltLane(s));
      if (!z) z = s.grabZone(o => this.wantsItem(o));
      it = z ? z.item : null;
    } else if (this.filterActive() && s.countOf) {
      // 白名单：直接探测名单内是否有货；黑名单：取源的首个物品再校验
      if (this.filterMode === 'white') {
        for (const f of this.filters) if (s.countOf(f) > 0) { it = f; break; }
      } else {
        it = s.peekItem ? s.peekItem() : null;
        if (it && !this.wantsItem(it)) it = null;
      }
    } else if (s.peekItem) {
      it = s.peekItem();
      if (it && !this.wantsItem(it)) it = null;
    }
    return it;
  }
  countSourceOf(s, item) {
    if (!s) return 0;
    if (s.countOf) return s.countOf(item);
    return 1;
  }
  takeNFrom(s, item, n) {
    const got = [];
    for (let i = 0; i < n; i++) {
      let it = null;
      if (s instanceof Belt) {
        // 优先抓取近侧 lane；近侧无货时回退到任意 lane，跨越左右两线凑足所需数量
        let z = s.grabZone(item, this.pickBeltLane(s));
        if (!z) z = s.grabZone(item);
        if (!z) break;
        s.items.splice(s.items.indexOf(z), 1);
        it = z.item;
      } else if (s.takeItemOf) {
        it = s.takeItemOf(item);
      } else break;
      if (it !== item) break;
      got.push(it);
    }
    return got;
  }
  takeSource(s) {
    if (s instanceof Belt) {
      // 优先抓取近侧 lane；近侧无货时回退到任意 lane
      let z = s.grabZone(undefined, this.pickBeltLane(s));
      if (!z) z = s.grabZone(undefined);
      if (!z) return null;
      s.items.splice(s.items.indexOf(z), 1);
      return z.item;
    }
    if (s.takeOutput) return s.takeOutput();
    if (s.takeItem) return s.takeItem();
    return null;
  }
  // 从源中选择一个「目标能接收」的物品来抓取（对齐《异星工厂》：机械臂不只会抓
  // 传送带上最靠前的那一个，而会结合放货格（组装机等）的接收能力选品——若最靠前的
  // 物品目标已满/不需要，则继续在传送带上探测其他可取物品，保证组装机需要的多种
  // 原料都能被补齐，而不是只盯着一种导致另一种长期缺失）。
  // 选品优先级：近侧 lane 优先、同 lane 内靠前（pos 大）优先；仍遵守过滤设置。
  pickSourceForDrop(s, t) {
    if (!s) return null;
    if (s instanceof Belt) {
      const near = this.pickBeltLane(s);
      const cand = s.items
        .filter(o => o.pos >= 0.2 && this.wantsItem(o.item))
        .sort((a, b) => {
          const na = a.lane === near ? 1 : 0;
          const nb = b.lane === near ? 1 : 0;
          if (na !== nb) return nb - na;      // 近侧 lane 优先
          return b.pos - a.pos;                // 同 lane 靠前优先
        });
      for (const o of cand) if (this.canDropAt(t, o.item)) return o.item;
      return null;
    }
    // 非传送带源：沿用原有探测，再校验目标是否接收
    const it = this.peekSource(s);
    return (it && this.canDropAt(t, it)) ? it : null;
  }
  // ===== 放物 =====
  canDropAt(t, item) {
    if (!t) return false;
    if (t instanceof Belt && !(t instanceof Splitter)) {
      // 机械臂放传送带统一“只在一边放置”：投放侧由机械臂朝向（翻转）决定，
      // 侧放/尾放一致，只检查该投放车道的尾端空位（不再两条车道轮流装载）。
      const lane = this.dropBeltLane(t);
      let back = Infinity;
      for (const o of t.items) if (t.laneOf(o) === lane) back = Math.min(back, o.pos);
      return back >= BELT_SPACING * 0.9;
    }
    switch (t.type) {
      case 'stone-furnace':
      case 'steel-furnace':
        if (item === 'coal') return t.fuelCoal < fuelLimitFor5s(COAL_ENERGY);
        if (item === 'wood') return (t.fuelWood || 0) < fuelLimitFor5s(WOOD_FUEL_ENERGY);
        if (item === 'solid-fuel') return (t.fuelSolid || 0) < fuelLimitFor5s(SOLID_FUEL_ENERGY);
        if (item === 'rocket-fuel') return (t.fuelRocket || 0) < fuelLimitFor5s(ROCKET_FUEL_ENERGY);
        // 熔炉例外：持续吃矿直到产物堆满一整组 Stack，满组后才停送
        return SMELTS.some(r => r.inp === item && (t.outp[r.id] || 0) < stackSize(r.id)) && (t.inp[item] || 0) < smeltNeed(item) * 2;
      case 'electric-furnace':
        if (item === 'coal') return false;
        return SMELTS.some(r => r.inp === item && (t.outp[r.id] || 0) < stackSize(r.id)) && (t.inp[item] || 0) < smeltNeed(item) * 2;
      case 'assembling-machine-1':
      case 'assembling-machine-2':
      case 'assembling-machine-3':
      case 'chemical-plant':
      case 'biochamber':
      case 'foundry':
      case 'crusher':
      case 'cryogenic-plant':
      case 'electromagnetic-plant': {
        if (!t.recipe) return false;
        const rec = RECIPES[t.recipe];
        // 只按原料判定是否超过 2 倍：产物不做计数（自循环配方产物即原料，
        // 若把产物算进总量会导致设备被自己上一轮的产出提前「喂饱」而停止送料）
        return !!rec.inp[item] && (t.inp[item] || 0) < rec.inp[item] * 2;
      }
      case 'centrifuge': {
        if (!t.recipe) return false;
        const rec = t.recipeObj();
        // 只按原料判定是否超过 2 倍：产物不做计数（Kovarex 等自循环配方产物即原料，
        // 把产物算进总量会让离心机被自己上一轮产出「喂饱」而停止送料）
        return !!rec.inp[item] && (t.inp[item] || 0) < rec.inp[item] * 2;
      }
      case 'burner-mining-drill':
        if (item === 'coal') return t.fuelCoal < 10;
        if (item === 'wood') return (t.fuelWood || 0) < 10;
        if (item === 'solid-fuel') return (t.fuelSolid || 0) < 10;
        if (item === 'rocket-fuel') return (t.fuelRocket || 0) < 10;
        return false;
      case 'burner-inserter':
        if (item === 'coal') return t.fuelCoal < 5;
        if (item === 'wood') return (t.fuelWood || 0) < 5;
        if (item === 'solid-fuel') return (t.fuelSolid || 0) < 5;
        if (item === 'rocket-fuel') return (t.fuelRocket || 0) < 5;
        return false;
      case 'electric-mining-drill':
      case 'big-mining-drill':
        return false;
      case 'offshore-pump':
        return false;
      case 'boiler':
        if (item === 'coal') return t.fuelCoal < 20;
        if (item === 'wood') return (t.fuelWood || 0) < 20;
        if (item === 'solid-fuel') return (t.fuelSolid || 0) < 20;
        if (item === 'rocket-fuel') return (t.fuelRocket || 0) < 20;
        return item === 'water' && t.water < WATER_CAP - 0.01;
      case 'nuclear-reactor':
        // 核反应堆：仅接受铀燃料棒（对齐《异星工厂》：反应堆消耗 Uranium fuel cell 而非 Nuclear fuel），燃料槽最多 5 根
        return item === 'uranium-fuel-cell' && t.fuel < 5;
      case 'lab':
        return isScience(item) && (t.packs[item] || 0) < 40;
      case 'underground-belt':
        return t.items.length < UG_CAP * 2;   // 双列：每列 UG_CAP 件，两列共 2×UG_CAP
      case 'pipe':
      case 'pipe-to-ground':
      case 'pump':
        return FLUIDS.indexOf(item) >= 0 && t.total() < (t.maxDist ? PIPE_CAP : PIPE_CAP);
      case 'void-pipe':
        return FLUIDS.indexOf(item) >= 0;   // 虚空管道：接受任意流体后销毁
      case 'creative-pipe':
        return false;  // 创造管道：只产不收
      case 'oil-refinery':
        return item === 'crude-oil' && (t.inp['crude-oil'] || 0) < 50;
      case 'storage-chest':
        return t.slots.length < 12 || t.slots.some(s => s && s.item === item && s.count < stackSize(item));
      case 'steel-chest':
        return t.slots.length < 24 || t.slots.some(s => s && s.item === item && s.count < stackSize(item));
      case 'void-chest':
        return true;   // 虚空箱：来者不拒，全部销毁
      case 'creative-chest':
        return false;  // 创造箱：只产不收
      case 'gun-turret':
        return (item === 'firearm-magazine' || item === 'piercing-rounds-magazine') && t.ammoCount(item) < 40;
      case 'rocket-turret':
        return (item === 'rocket' || item === 'explosive-rocket') && t.ammoCount(item) < 10;
      case 'railgun-turret':
        return item === 'railgun-ammo' && t.ammo < 20;
      default:
        return false;
    }
  }
  deliverAt(t) {
    if (!t || !this.holding) return false;
    if (t instanceof Belt && !(t instanceof Splitter)) {
      const o = this.dropOffset();
      const fromDir = dirFromVec(o.dx, o.dy);
      // 机械臂放传送带统一“只在一边放置”：投放侧由机械臂朝向（翻转）决定，
      // 侧放/尾放一致，固定进入该投放车道（laneHint 覆盖 acceptItem 默认），不再轮流。
      const lane = this.dropBeltLane(t);
      return t.acceptItem(this.holding, fromDir, undefined, undefined, lane);
    }
    return t.giveItem(this.holding);
  }
  // 干跑：现在是否有活干（供 UI/其他系统查询）
  hasWork() {
    return !!this.pickSourceForDrop(this.entAtPick(), this.entAtDrop());
  }
  update(dt) {
    // 电路条件不满足时机械臂停转（保持当前姿态，不取放）
    if (!this.circuitEnabled()) { this.rotating = false; return; }
    if (this.armAng === undefined) this.armAng = this.pickAng();
    const step = Math.PI * 4.4 * (this.rotSpeed || 1) * dt;
    // 统一状态机：
    //  空手 -> 转向取物格 -> 到达后原子地“预览+校验+取走（可堆叠抓 N 个）”
    //  持物 -> 转向放物格 -> 到达后循环放入直到放空或目标拒收
    const holdingNow = this.holdingCount > 0;
    const target = holdingNow ? this.dropAng() : this.pickAng();
    const arrived = Math.abs(angNorm(target - this.armAng)) < 0.05;
    if (!arrived) {
      this.rotating = true;
      this.armAng = approachAng(this.armAng, target, step);
      if (Math.abs(angNorm(target - this.armAng)) < 0.05) this.armAng = target;
      else return;
    }
    this.rotating = false;
    this.armAng = target;
    if (!holdingNow) {
      // 惰性调度（P0 优化）：空手待机在取物位时，降频探测取/放（约 5 次/秒）。
      // 避免大量闲置机械臂每帧都做 entAt+peekSource+canDropAt 的邻居探测；
      // 有货/持物/旋转时仍每帧更新，不影响搬运响应。
      this._probeT = (this._probeT || 0) - dt;
      if (this._probeT > 0) return;
      this._probeT = 0.15;
      // 到达取物位：一次性完成“看源、验目标、取走”，避免探测与执行之间的状态漂移
      const s = this.entAtPick();
      const t = this.entAtDrop();
      const it = this.pickSourceForDrop(s, t);
      this.blocked = false;
      if (!it) return;                       // 无可取且目标能收的物品：停在取物位等待
      const want = Math.max(1, Math.min(this.grabN(), this.countSourceOf(s, it)));
      const got = this.takeNFrom(s, it, want);
      if (!got.length) return;
      this.holding = it;
      this.holdingCount = got.length;
      if (typeof onScreen === 'function' && onScreen(this) && typeof playSfx === 'function') playSfx('inserter');
    } else {
      // 到达放物位：循环放入；失败保持持物、标记堵塞，下帧继续重试
      const t = this.entAtDrop();
      while (this.holdingCount > 0 && this.deliverAt(t)) this.holdingCount--;
      this.blocked = this.holdingCount > 0;
      if (this.holdingCount <= 0) this.holding = null;
    }
  }
  contents() {
    const list = [[this.type, 1]];
    // 返还爪上抓取的物品：一次性返还全部数量（堆叠臂可能抓到多个）
    if (this.holding && this.holdingCount > 0) list.push([this.holding, this.holdingCount || 1]);
    return list;
  }
  serialize() {
    const s = super.serialize();
    s.holding = this.holding;
    s.holdingCount = this.holdingCount || 1;
    if (this.filterOn) s.filterOn = this.filterOn;
    if (this.filterMode === 'black') s.filterMode = 'black';
    if (this.filters && this.filters.length) s.filters = this.filters.slice(0, 5);
    if (this.pickStack > 0) s.pickStack = this.pickStack;
    if (this.spoilPrio) s.spoilPrio = this.spoilPrio;
    if (this.spoilMode === 'fresh') s.spoilMode = 'fresh';
    if (this.circuitCond) s.circuitCond = this.circuitCond;
    if (this.sideFlip) s.sideFlip = true;
    return s;
  }
  // 蓝图保留筛选/堆叠/变质与电路配置，不复制爪上抓取的物品
  blueprint() {
    const s = super.blueprint();
    if (this.filterOn) s.filterOn = this.filterOn;
    if (this.filterMode === 'black') s.filterMode = 'black';
    if (this.filters && this.filters.length) s.filters = this.filters.slice(0, 5);
    if (this.pickStack > 0) s.pickStack = this.pickStack;
    if (this.spoilPrio) s.spoilPrio = this.spoilPrio;
    if (this.spoilMode === 'fresh') s.spoilMode = 'fresh';
    if (this.circuitCond) s.circuitCond = this.circuitCond;
    if (this.sideFlip) s.sideFlip = true;
    return s;
  }
  static restore(s) {
    const i = super.restore(s);
    i.holding = s.holding || null;
    i.holdingCount = s.holding ? (s.holdingCount || 1) : 0;
    // 筛选：优先读取新版多格筛选；兼容旧版单个 filter（迁移为白名单单格）
    i.filterOn = !!s.filterOn;
    i.filterMode = s.filterMode === 'black' ? 'black' : 'white';
    if (Array.isArray(s.filters)) i.filters = s.filters.slice(0, 5);
    else if (s.filter) { i.filters = [s.filter]; i.filterOn = true; }
    else i.filters = [];
    i.pickStack = (Number.isFinite(s.pickStack) && s.pickStack > 0) ? Math.max(1, Math.floor(s.pickStack)) : 0;
    i.spoilPrio = !!s.spoilPrio;
    i.spoilMode = s.spoilMode === 'fresh' ? 'fresh' : 'spoil';
    i.circuitCond = s.circuitCond || { enabled: false, channel: 'red', sig: 'iron-plate', op: '>', count: 1 };
    i.sideFlip = !!s.sideFlip;
    return i;
  }
}

class LongInserter extends Inserter {
  constructor(type, x, y) {
    super(type || 'long-handed-inserter', x, y);
    this.reach = 2;   // 几何、行为与普通臂完全一致，只是触及第二格
  }
}

// 高速/堆叠机械臂：旋转速度与抓取堆叠由官方数据桥接（见 inserterRotMult/inserterStackMax）
class FastInserter extends Inserter {
  constructor(type, x, y) { super(type || 'fast-inserter', x, y); }
}

class StackInserter extends Inserter {
  constructor(type, x, y) { super(type || 'bulk-inserter', x, y); }
}

// ===== 渲染 =====
// 臂体配色：不同机械臂类型各有固定主色，箭头等物流标记与臂体颜色保持一致
function inserterArmColor(e) {
  return e.type === 'burner-inserter' ? '#7a7f87'
    : e.type === 'fast-inserter' ? '#4f9fe8'
    : e.type === 'long-handed-inserter' ? '#e05a4e'
    : e.type === 'bulk-inserter' ? '#7ec850'
    : e.type === 'stack-inserter' ? '#8ae05a'
    : '#e0b23c';
}
// 轻量色彩工具（机械臂渲染）：把 #rrggbb 以 0~1 透明度混合成 rgba 叠加色
function _insMix(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + t.toFixed(3) + ')';
}
// 机械臂档位规格：按类型给出臂宽/爪规格/转台尺寸，塑造「同族不同级」的观感——
//   堆叠臂粗壮大爪（一次抓多个）、快速臂纤细（速度感）、其余为标准规格
function inserterSpec(e) {
  const t = e.type;
  if (t === 'bulk-inserter' || t === 'stack-inserter') return { a1: 6.2, a2: 4.6, claw: 5.4, hub: 5.6 };
  if (t === 'fast-inserter') return { a1: 4.2, a2: 3.0, claw: 4.0, hub: 4.8 };
  return { a1: 5.0, a2: 3.6, claw: 4.4, hub: 5.2 };
}
// 转台式工业机械臂。视觉分区（自下而上，与其他重绘设备统一的工业语言）：
//   ① 地面椭圆阴影   ② 固定基座（错位双层钢盘 + 顶面圆 + 螺栓，右上角留给状态 LED）
//   ③ 筛选指示环（原有蓝环）   ④ 旋转组件（统一在臂角坐标系，随 armAng 旋转）：
//     主题色转台臂座（双层胶囊 + 上缘高光 + 3 颗刻度点，刻度让旋转可见）
//     → 钢灰近节臂 → 肘关节 → 主题色远节臂 → 腕关节 → 双指夹爪
//     （持物张开夹住物品 / 空手闭合）→ 中心轴承盖；热能臂转台尾部带小炉膛火光
//   ⑤ 臂端物品 + 堆叠数（世界坐标，图标方向不随臂旋转）
//   ⑥ 状态 LED（基座右上）：绿=工作中 / 黄=放货堵塞 / 红=缺燃料闪 / 暗=待机
//   ⑦ 陷口 / 物流方向箭头 / 投放车道指示（原有物流标记，保持不变）
// 臂长仍按「持物伸长 / 空手收缩」伸缩，由两节臂分摊（肘随 len 同步移动）。
// 机械臂当前臂长（像素）：持物伸长 / 空手收缩。
// 抽成独立函数供 drawInserter 与渲染分层判定（render.js 的 inserterArmRaised）共用，避免两处数值漂移。
function inserterArmLen(e) {
  const long = e.type === 'long-handed-inserter';
  return e.holding ? (long ? TILE * 2.02 : TILE * 1.06) : (long ? TILE * 1.55 : TILE * 0.82);
}

function drawInserter(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  ctx.globalAlpha = alpha;
  const col = inserterArmColor(e);
  const long = e.type === 'long-handed-inserter';   // 低 LOD 线宽等仍按长臂区分
  const len = inserterArmLen(e);
  const ang = e.armAng !== undefined ? e.armAng : ((dir + 2) % 4) * Math.PI / 2;
  const tipx = cx + Math.cos(ang) * len;
  const tipy = cy + Math.sin(ang) * len;
  const stackN = e.holding ? (e.holdingCount || 1) : 0;

  // ===== 低 LOD（缩远）：基座简圆 + 单线臂 + 物品，省掉全部细节与车道标记 =====
  const simple = (typeof LOD !== 'undefined' && LOD && LOD.simple);
  if (simple) {
    ctx.fillStyle = '#31363e';
    ctx.beginPath(); ctx.arc(cx, cy, 9.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#0e1013';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.strokeStyle = col;
    ctx.lineWidth = long ? 5 : 4;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(tipx, tipy);
    ctx.stroke();
    ctx.lineCap = 'butt';
    if (e.holding) {
      if (typeof drawItemDotLOD === 'function') drawItemDotLOD(ctx, tipx, tipy, e.holding);
      else drawItemDot(ctx, tipx, tipy, e.holding, 4);
    }
    if (stackN > 1) {
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 9px system-ui';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('×' + stackN, tipx, tipy - 9);
    }
    ctx.fillStyle = col;
    notch(ctx, px, py, dir);
    ctx.globalAlpha = 1;
    return;
  }

  const spec = inserterSpec(e);
  const burner = e.type === 'burner-inserter';
  const noFuel = burner && typeof e.hasFuel === 'function' && !e.hasFuel();

  // ① 地面阴影（椭圆，托起整台机械臂）
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 8.6, 10.5, 3.6, 0, 0, Math.PI * 2);
  ctx.fill();

  // ② 固定基座：错位双层钢盘（下厚上亮，纯色叠加营造厚度）+ 顶面受光圆
  ctx.fillStyle = '#15181c';
  ctx.beginPath(); ctx.arc(cx, cy + 1.2, 10.6, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#31363e';
  ctx.beginPath(); ctx.arc(cx, cy, 10.2, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#0e1013';
  ctx.lineWidth = 1.2;
  ctx.stroke();
  ctx.fillStyle = '#40464f';
  ctx.beginPath(); ctx.arc(cx, cy - 0.6, 7.8, 0, Math.PI * 2); ctx.fill();
  // 基座 3 颗螺栓（左上/左下/右下 45° 方向；右上 45° 位置留给状态 LED）
  for (let i = 0; i < 3; i++) {
    const a = Math.PI * 3 / 4 + i * Math.PI / 2;
    const bx = cx + Math.cos(a) * 8.8, by = cy + Math.sin(a) * 8.8;
    ctx.fillStyle = '#0e1013';
    ctx.beginPath(); ctx.arc(bx, by, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5b626c';
    ctx.beginPath(); ctx.arc(bx - 0.2, by - 0.2, 0.9, 0, Math.PI * 2); ctx.fill();
  }

  // ③ 筛选指示环（启用筛选时蓝色圈，原有功能）
  if (e.filterActive && e.filterActive()) {
    ctx.strokeStyle = '#58b8e8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 12.5, 0, 7);
    ctx.stroke();
  }

  // ④ 旋转组件：转台臂座 + 两节臂 + 关节 + 夹爪（统一在臂角坐标系，随 armAng 旋转）
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  // 肘关节位置：两节随 len 同步展开（空手收缩 / 持物伸长的伸缩动画由两节分摊）
  const elbow = Math.max(spec.hub + 3, len * (long ? 0.44 : 0.46));

  // 转台臂座：主题色胶囊（下暗上亮两层 + 上缘高光；3 颗刻度点随臂旋转，让转动可见）
  rr(ctx, -spec.hub - 1.5, -spec.hub + 0.8, spec.hub * 2 + 7, spec.hub * 2, spec.hub * 0.9);
  ctx.fillStyle = _insMix(col, 0.45);
  ctx.fill();
  rr(ctx, -spec.hub - 1.5, -spec.hub - 0.8, spec.hub * 2 + 7, spec.hub * 2 - 0.6, spec.hub * 0.9);
  ctx.fillStyle = col;
  ctx.fill();
  ctx.strokeStyle = '#10131a';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-spec.hub - 0.5, -spec.hub + 0.8);
  ctx.lineTo(spec.hub + 3.5, -spec.hub + 0.8);
  ctx.stroke();
  ctx.fillStyle = _insMix(col, 0.4);
  for (let i = 0; i < 3; i++) {
    const ta = i * Math.PI * 2 / 3;
    ctx.beginPath();
    ctx.arc(Math.cos(ta) * (spec.hub - 1.3), Math.sin(ta) * (spec.hub - 1.3), 0.9, 0, Math.PI * 2);
    ctx.fill();
  }

  // 近节臂：钢灰粗臂（转台前端 → 肘），叠在转台之上，带上缘高光
  ctx.strokeStyle = '#4c525c';
  ctx.lineWidth = spec.a1;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(3.5, 0);
  ctx.lineTo(elbow, 0);
  ctx.stroke();
  ctx.lineCap = 'butt';
  ctx.strokeStyle = 'rgba(255,255,255,0.20)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(5, -spec.a1 * 0.28);
  ctx.lineTo(elbow - 2, -spec.a1 * 0.28);
  ctx.stroke();

  // 肘关节：暗底 + 亮面 + 轴心（三重圆，旋转关节感）
  ctx.fillStyle = '#181b20';
  ctx.beginPath(); ctx.arc(elbow, 0, spec.a1 * 0.62 + 0.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#6a717d';
  ctx.beginPath(); ctx.arc(elbow, -0.3, spec.a1 * 0.62, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#9aa2ae';
  ctx.beginPath(); ctx.arc(elbow, -0.5, spec.a1 * 0.3, 0, Math.PI * 2); ctx.fill();

  // 远节臂：主题色细臂（肘 → 腕），深色衬底 + 上缘高光
  ctx.strokeStyle = '#10131a';
  ctx.lineWidth = spec.a2 + 1.6;
  ctx.beginPath();
  ctx.moveTo(elbow, 0);
  ctx.lineTo(len - 2.5, 0);
  ctx.stroke();
  ctx.strokeStyle = col;
  ctx.lineWidth = spec.a2;
  ctx.beginPath();
  ctx.moveTo(elbow, 0);
  ctx.lineTo(len - 2.5, 0);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 0.9;
  ctx.beginPath();
  ctx.moveTo(elbow + 2, -spec.a2 * 0.28);
  ctx.lineTo(len - 4, -spec.a2 * 0.28);
  ctx.stroke();

  // 腕关节
  ctx.fillStyle = '#181b20';
  ctx.beginPath(); ctx.arc(len - 1.5, 0, spec.a2 * 0.75 + 0.7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#767e8a';
  ctx.beginPath(); ctx.arc(len - 1.5, 0, spec.a2 * 0.75, 0, Math.PI * 2); ctx.fill();

  // 双指夹爪：两片爪指垂直于臂方向（持物张开夹住物品 / 空手闭合），爪尖主题色端帽
  const gap = e.holding ? 6.4 : 3.2;
  const clawW = Math.max(2, spec.a2 * 0.62);
  for (const s of [-1, 1]) {
    rr(ctx, len - 1 - spec.claw, s * gap - clawW / 2, spec.claw, clawW, 1);
    ctx.fillStyle = '#454b54';
    ctx.fill();
    ctx.strokeStyle = '#10131a';
    ctx.lineWidth = 0.8;
    ctx.stroke();
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(len - 1.4, s * gap, clawW * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    ctx.beginPath(); ctx.arc(len - 2.8, s * gap, 0.5, 0, Math.PI * 2); ctx.fill();
  }

  // 热能机械臂：转台尾部小炉膛（有燃料时透橙红火光并闪烁，随臂旋转）
  if (burner) {
    const fl = 0.6 + Math.sin((G.time || 0) * 9 + px * 0.5) * 0.3;
    ctx.fillStyle = noFuel ? '#2a2018' : 'rgba(255,150,50,' + (0.55 + fl * 0.4).toFixed(2) + ')';
    ctx.beginPath();
    ctx.arc(-3.5, 0, 1.7, 0, Math.PI * 2);
    ctx.fill();
    if (!noFuel) {
      ctx.fillStyle = 'rgba(255,220,120,' + (fl * 0.85).toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(-3.5, 0, 0.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 中心轴承盖（臂根关节，盖在近节臂根部之上）
  ctx.fillStyle = '#181b20';
  ctx.beginPath(); ctx.arc(0, 0, 2.8, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#8a92a0';
  ctx.beginPath(); ctx.arc(0, 0, 2.1, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#c8ced8';
  ctx.beginPath(); ctx.arc(-0.3, -0.3, 0.9, 0, Math.PI * 2); ctx.fill();

  ctx.restore();

  // ⑤ 臂端物品与堆叠数（世界坐标，图标方向不随臂旋转）
  if (e.holding) drawItemDot(ctx, tipx, tipy, e.holding, 4);
  if (stackN > 1) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('×' + stackN, tipx, tipy - 9);
  }

  // ⑥ 状态 LED（基座右上 45°，最后绘制保证任何臂姿态下可见）
  const ledX = cx + 6.2, ledY = cy - 6.2;
  let ledC = '#3a3f46', ledOn = false;
  if (noFuel) { ledC = '#ff5040'; ledOn = ((G.time || 0) * 8) % 2 < 1; }
  else if (e.blocked && e.holding) { ledC = '#ffb04a'; ledOn = true; }
  else if (e.rotating || e.holding || e._selfFeed) { ledC = '#9ce06c'; ledOn = true; }   // _selfFeed：热能臂自补给中也亮绿灯
  ctx.fillStyle = ledC;
  ctx.beginPath(); ctx.arc(ledX, ledY, 1.7, 0, Math.PI * 2); ctx.fill();
  if (ledOn) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath(); ctx.arc(ledX - 0.4, ledY - 0.5, 0.6, 0, Math.PI * 2); ctx.fill();
  }

  // ⑦ 陷口 / 物流方向箭头 / 投放车道指示（原有物流标记，保持不变）
  ctx.fillStyle = col;
  notch(ctx, px, py, dir);
  drawFlowMarks(ctx, e, cx, cy, dir);
  drawDropLane(ctx, e);
  ctx.globalAlpha = 1;
}

// 放物车道指示：在目标传送带上高亮显示机械臂会把物品放入哪一侧车道（投放侧）。
// 横向/竖向传送带都按“投放侧”规则放置，侧放/尾放一致，翻转（旋转）机械臂即可把物品转到另一侧；
// 这里用与臂体同色的脉冲三角标出投放侧，让“放到哪一边”一目了然。
function drawDropLane(ctx, e) {
  if (!e.entAtDrop) return;
  const t = e.entAtDrop();
  if (!(t instanceof Belt) || t instanceof Splitter) return;
  // 机械臂放传送带统一只在一边放置：投放侧由机械臂朝向决定（不再交替/轮流）
  const lane = e.dropBeltLane(t);
  // lane 1 位于行进方向右侧(+perp)，lane 0 位于左侧(-perp)
  const perp = [DY[t.dir], -DX[t.dir]];
  const k = lane === 1 ? 1 : -1;
  const ox = perp[0] * k, oy = perp[1] * k;
  const cx = t.x * TILE + TILE / 2, cy = t.y * TILE + TILE / 2;
  const col = inserterArmColor(e);
  const pulse = 0.5 + 0.5 * Math.sin((G.time || 0) * 6);
  ctx.save();
  ctx.globalAlpha = Math.max(0.45, pulse);
  ctx.fillStyle = col;
  // 三角：顶点朝带中心，底边在投放车道上，标记“物品会投放到这一侧”
  const off = 7, h = 6, base = 9;
  const tx = cx + ox * off, ty = cy + oy * off;
  const tipX = cx + ox * (off + h), tipY = cy + oy * (off + h);
  ctx.beginPath();
  ctx.moveTo(tipX, tipY);
  ctx.lineTo(tx - oy * base, ty + ox * base);
  ctx.lineTo(tx + oy * base, ty - ox * base);
  ctx.closePath();
  ctx.fill();
  // 车道侧再补一条短线段，强化方位感
  ctx.strokeStyle = col;
  ctx.lineWidth = 2.5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(tx - oy * (base - 2), ty + ox * (base - 2));
  ctx.lineTo(tx + oy * (base - 2), ty - ox * (base - 2));
  ctx.stroke();
  ctx.restore();
}

// 物流方向标识：亮色脉冲大箭头 = 出料侧（与陷口同侧）；灰色小点 = 进料侧。
// 让“哪边进、哪边出”一眼可辨，不再依赖小陷口或臂体姿态去猜。
function drawFlowMarks(ctx, e, cx, cy, dir) {
  const reach = e.reach || 1;
  const dOut = (reach - 0.5) * TILE - 3;   // 标记到臂心的距离（触及格边缘内侧）
  const pulse = 0.55 + 0.45 * Math.sin((G.time || 0) * 6);
  function chevron(sideDir, color, alpha, size) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(sideDir * Math.PI / 2);
    ctx.globalAlpha = Math.max(0.15, Math.min(1, alpha));
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(dOut - size, -size);
    ctx.lineTo(dOut + size * 0.7, 0);
    ctx.lineTo(dOut - size, size);
    ctx.stroke();
    ctx.restore();
  }
  // 出口：物流方向，双箭头向外（颜色与臂体一致，不随旋转方向改变）
  const oc = inserterArmColor(e);
  chevron(dir, oc, pulse, 5);
  chevron(dir, oc, pulse * 0.45, 8.5);
  // 入口：取货方向，静态灰点
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(((dir + 2) % 4) * Math.PI / 2);
  ctx.globalAlpha = 0.85;
  ctx.fillStyle = '#9aa0aa';
  ctx.beginPath();
  ctx.arc(dOut, 0, 2.6, 0, 7);
  ctx.fill();
  ctx.restore();
  ctx.globalAlpha = 1;
}

// 面板里绘制机械臂（设备）图标：复用地图渲染的 drawInserter，保持与地图上一致的外观
function drawInserterIcon(e, cv) {
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, cv.width, cv.height);
  ctx.save();
  ctx.scale(cv.width / TILE, cv.height / TILE);
  drawInserter(ctx, e, 0, 0, e.dir || 0, 1);
  ctx.restore();
}

// ===== 面板 =====
// 筛选功能：每台机械臂均自带（对齐需求「每个机械臂都自带筛选功能」）。
// 支持：启用开关、白名单/黑名单、5 个筛选格子（点击格子弹窗选物品）、
//      设置抓取堆叠（1 ~ 当前最大抓取数量）、变质优先级（变质优先/新鲜优先）。
function insCheckBtn(on, act) {
  return '<div class="ins-check' + (on ? ' on' : '') + '" data-action="' + act + '"></div>';
}
// 白名单/黑名单切换开关（对齐设计稿：白名单 ⟷ 开关 ⟷ 黑名单）
function insToggle(cur, act) {
  const isWhite = cur !== 'black';
  return '<div class="ins-flt-toggle">' +
    '<span class="ins-toggle-label' + (isWhite ? ' on' : '') + '">白名单</span>' +
    '<div class="ins-toggle" data-action="' + act + '" title="点击切换白名单/黑名单"><div class="ins-toggle-knob" style="left:' + (isWhite ? '2px' : '24px') + '"></div></div>' +
    '<span class="ins-toggle-label' + (isWhite ? '' : ' on') + '">黑名单</span>' +
  '</div>';
}
// 单选按钮（品质优先/新鲜优先）
function insRadio(label, act, mode, cur) {
  return '<div class="ins-radio' + (mode === cur ? ' selected' : '') + '" data-action="' + act + '" data-mode="' + mode + '">' +
    '<span class="ins-radio-dot"></span><span class="ins-radio-label">' + label + '</span></div>';
}
function insFilterSlotsHtml(e) {
  let h = '<div class="ins-slots">';
  for (let i = 0; i < 5; i++) {
    const id = e.filters[i];
    if (id) {
      h += '<div class="ins-slot" data-action="flt-slot" data-idx="' + i + '" title="点击重新选择筛选物品">' +
        '<img src="' + iconDataURL(id) + '">' +
        '<span class="ins-slot-x" data-action="flt-slot-clear" data-idx="' + i + '" title="清除此筛选格">✕</span></div>';
    } else {
      h += '<div class="ins-slot empty" data-action="flt-slot" data-idx="' + i + '" title="点击选择筛选物品"><span class="ins-slot-plus">+</span></div>';
    }
  }
  h += '</div>';
  return h;
}
// 机械臂控制面板通用行（状态 / 机械臂图标 / 当前抓取 / 筛选 / 抓取堆叠 / 变质优先级）
function inserterMachineRowsHtml(e) {
  let h = '';
  // 第一行：状态（状态点 + 状态文字）
  h += '<div class="asm3-status">' +
    '<div class="asm3-status-dot" data-live="ins-dot"></div>' +
    '<div class="asm3-status-text status" data-live="ins-status"></div></div>';
  // 第二行：机械臂（设备）图标
  h += '<div class="ins-machine"><canvas class="ins-cv" width="96" height="96"></canvas></div>';
  // 第三行：当前抓取的物品（图标显示在标题旁边，可点击放入背包）
  h += '<div class="ins-held"><span class="ins-held-label">当前抓取</span><span class="ins-held-val" data-live="ins-held" data-action="ins-grab" title="点击将此物品放入背包">空手</span></div>';
  // 第四行：筛选功能（未启用时开关与格子仍显示，仅不可交互）
  h += '<div class="ins-sec">' +
    '<div class="ins-check-row">' + insCheckBtn(e.filterOn, 'flt-on') + '<span class="ins-label">启用筛选</span></div>' +
    '<div class="ins-flt-row' + (e.filterOn ? '' : ' off') + '">' +
      insToggle(e.filterMode, 'flt-mode') +
      insFilterSlotsHtml(e) + '</div>' +
  '</div>';
  // 第五行：设置抓取堆叠（标题在左、滑块/数值在右，同一行；未勾选时滑块仍显示但不可交互）
  const cap = e.capacity() || 1;
  const stackOn = e.pickStack > 0;
  const curStack = stackOn ? Math.max(1, Math.min(cap, Math.floor(e.pickStack))) : 1;
  h += '<div class="ins-sec ins-stack">' +
    '<div class="ins-check-row">' + insCheckBtn(stackOn, 'stack-on') + '<span class="ins-label">设置抓取堆叠</span></div>' +
    '<div class="ins-stack-row' + (stackOn ? '' : ' off') + '">' +
      '<input type="range" class="ins-slider" min="1" max="' + cap + '" value="' + curStack + '" data-action="flt-stack" step="1">' +
      '<span class="ins-stack-val" data-live="ins-stack">' + curStack + '</span>' +
      '<span class="dim"> / ' + cap + '</span>' +
    '</div>' +
  '</div>';
  // 第六行：变质优先级（标题在左，「变质优先/新鲜优先」在右，同一行；勾选后才可点选）
  h += '<div class="ins-sec ins-spoil">' +
    '<div class="ins-check-row">' + insCheckBtn(e.spoilPrio, 'spoil-on') + '<span class="ins-label">变质优先级</span></div>' +
    '<div class="ins-spoil-opts' + (e.spoilPrio ? '' : ' off') + '">' +
      insRadio('品质优先', 'spoil-mode', 'spoil', e.spoilPrio ? e.spoilMode : '') +
      insRadio('新鲜优先', 'spoil-mode', 'fresh', e.spoilPrio ? e.spoilMode : '') +
    '</div>' +
  '</div>';
  return '<div class="ins-panel">' + h + '</div>';
}
function inserterPanelHtml(e) {
  return inserterMachineRowsHtml(e);
}
function stackInserterPanelHtml(e) {
  return inserterMachineRowsHtml(e);
}
function inserterFilterOnAction(act, btn) {
  const e = G.panelEnt;
  if (!(e instanceof Inserter)) return circuitPanelAction('ins', act);
  const r = () => { uiDirty = true; renderPanel(false); return true; };
  if (act === 'flt-on') { e.filterOn = !e.filterOn; return r(); }
  if (act === 'flt-mode') { e.filterMode = (e.filterMode === 'black') ? 'white' : 'black'; return r(); }
  if (act === 'flt-slot') { if (typeof openFilterChooser === 'function') openFilterChooser(e, +btn.dataset.idx); return true; }
  if (act === 'flt-slot-clear') {
    const i = +btn.dataset.idx;
    if (e.filters[i] !== undefined) { e.filters.splice(i, 1); return r(); }
    return true;
  }
  if (act === 'flt-choose') {   // 弹窗内选择物品回填到筛选格子
    const i = +btn.dataset.idx;
    const id = btn.dataset.id;
    e.filters[i] = id;
    if (typeof closeFilterChooser === 'function') closeFilterChooser();
    return r();
  }
  if (act === 'stack-on') { e.pickStack = (e.pickStack > 0) ? 0 : (e.capacity() || 1); return r(); }
  // 点击爪上当前抓取的物品 → 进入「抓取状态」：不直接入背包。
  // 物品从爪上取走并暂存在 G.armGrab，之后点击背包空格即放入背包（对齐背包点击物品的抓取体验）。
  if (act === 'ins-grab') {
    if (!e.holding) return true;
    const heldName = (ITEMS[e.holding] && ITEMS[e.holding].name) ? ITEMS[e.holding].name : e.holding;
    const n = e.holdingCount > 0 ? e.holdingCount : 1;
    G.armGrab = { id: e.holding, count: n, ent: e };
    e.holding = null; e.holdingCount = 0; e.blocked = false;
    if (typeof toast === 'function') toast('已拿起 ' + heldName + '（共 ' + n + ' 个），点击背包空格放入');
    if (typeof playSfx === 'function') playSfx('select');
    return r();
  }
  if (act === 'flt-stack') {
    const v = Math.floor(Number(btn.value));
    e.pickStack = Math.max(1, Math.min(e.capacity(), v));
    const row = btn.closest && btn.closest('.ins-stack-row');
    if (row) {
      const vEl = row.querySelector('.ins-stack-val');
      if (vEl && vEl.textContent !== String(e.pickStack)) vEl.textContent = e.pickStack;
    }
    uiDirty = true;
    return true;   // 拖动中不整面板重建，只更新数值显示
  }
  if (act === 'spoil-on') { e.spoilPrio = !e.spoilPrio; return r(); }
  if (act === 'spoil-mode') { e.spoilMode = (btn.dataset.mode === 'fresh') ? 'fresh' : 'spoil'; return r(); }
  return circuitPanelAction('ins', act);
}
// 悬浮提示（普通/长臂/过滤/堆叠共用）
function inserterTip(e) {
  if (e.holding) return '搬运 ' + ITEMS[e.holding].name + (e.holdingCount > 1 ? ' ×' + e.holdingCount : '');
  let flt = '';
  if (e.filterActive()) flt = (e.filterMode === 'white' ? '白名单 ' : '黑名单 ') + e.filters.map(f => ITEMS[f]?.name || f).join('、');
  return '待机' + (flt ? '；' + flt : '') + '（取背面放正面）';
}
// 面板实时状态：工作中或暂停原因 + 机械臂图标/当前抓取物品刷新
function inserterPanelLive(e, api, body) {
  if (body) { const cv = body.querySelector('.ins-cv'); if (cv) drawInserterIcon(e, cv); }
  // 抓取状态：物品已从爪上拿起、暂存于 G.armGrab，待点击背包空格放入。
  const grab = (G.armGrab && G.armGrab.ent === e) ? G.armGrab : null;
  api.set('ins-held', grab
    ? (ITEMS[grab.id]
        ? '<img class="ins-held-icon grabbed" src="' + iconDataURL(grab.id) + '" alt="' + ITEMS[grab.id].name + '">' +
          (grab.count > 1 ? '<span class="ins-held-cnt">×' + grab.count + '</span>' : '') +
          '<span class="ins-held-tag">在手中</span>'
        : grab.id)
    : (e.holding
        ? (ITEMS[e.holding]
            ? '<img class="ins-held-icon" src="' + iconDataURL(e.holding) + '" alt="' + ITEMS[e.holding].name + '">' +
              (e.holdingCount > 1 ? '<span class="ins-held-cnt">×' + e.holdingCount + '</span>' : '')
            : e.holding)
        : '空手'));
  if (grab) { api.status('已拿起 ' + (ITEMS[grab.id]?.name || grab.id) + '，点击背包空格放入', 'ok'); return; }
  if (!e.circuitEnabled()) { api.status('已停止：电路条件不满足', 'warn'); return; }
  if (e.holding) {
    if (e.blocked) api.status('已暂停：放货格已满，卡住 ' + ITEMS[e.holding].name, 'warn');
    else api.status('搬运中：' + ITEMS[e.holding].name, 'ok');
    return;
  }
  if (e.rotating) { api.status('工作中：转向取货格', 'ok'); return; }
  const s = e.entAtPick();
  const t = e.entAtDrop();
  const it = e.pickSourceForDrop(s, t);
  if (!it) {
    // 无可取的、且目标能收的物品：区分“源无货”与“有货但放不下”两种提示
    const src = e.peekSource(s);
    if (!src) {
      if (e.filterActive()) api.status('已暂停：取货格没有符合筛选的物品', 'warn');
      else api.status('已暂停：取货格无物品可取', 'warn');
    } else {
      api.status('已暂停：取货格物品均放不进目标（放货格已满）', 'warn');
    }
    return;
  }
  api.status('待机：等待取货格出现货物', 'ok');
}

// ===== 电路控制面板（机械臂/传送带通用） =====
// 复用电路网络 UI：启用条件后，仅当附近电路信号满足条件时设备才运转。
// prefix 用于生成唯一控件 id，避免同屏多面板冲突（机械臂 ins / 传送带 belt）。
function circuitPanelHtml(e, prefix) {
  const c = e.circuitCond || {};
  prefix = prefix || 'cb';
  let h = '<div class="sec">电路控制</div>';
  h += '<div class="circ-add">' +
    '<select id="' + prefix + '-en" class="circ-btype">' +
      '<option value="off"' + (!c.enabled ? ' selected' : '') + '>关闭（常开）</option>' +
      '<option value="on"' + (c.enabled ? ' selected' : '') + '>启用条件</option>' +
    '</select>' +
    '<select id="' + prefix + '-ch" class="circ-op">' + (typeof channelSelect === 'function' ? channelSelect(c.channel) : '') + '</select>' +
    '<input type="text" id="' + prefix + '-sig" class="circ-siginv" value="' + (typeof signalDisplayName === 'function' ? signalDisplayName(c.sig) : (ITEMS[c.sig]?.name || c.sig || '')) + '" placeholder="信号" autocomplete="off">' +
    '<select id="' + prefix + '-op" class="circ-op">' + ['>', '<', '=', '!=', '>=', '<='].map(o => '<option value="' + o + '"' + (c.op === o ? ' selected' : '') + '>' + o + '</option>').join('') + '</select>' +
    '<input type="number" id="' + prefix + '-cnt" class="circ-cnt" value="' + (c.count || 0) + '" min="-99999" max="99999">' +
    '<button data-action="cb-cond">应用</button></div>' +
    '<label class="circ-readhand"><input type="checkbox" id="' + prefix + '-rh"' + (c.readHand ? ' checked' : '') + '> 读取手持物品（把机械臂爪上物品数量作为信号输出到电路网络）</label>' +
    (prefix === 'belt' ? '<label class="circ-readhand"><input type="checkbox" id="' + prefix + '-rc"' + (c.circuitRead ? ' checked' : '') + '> 读取内容（把传送带上携带的每种物品数量作为信号输出到电路网络，对齐《异星工厂》Belt Read contents）</label>' : '');
  h += '<div class="dim">启用后，仅当所选电路信号满足条件时设备才工作（如铁板信号 ≥ 100 才运转）。</div>';
  return h;
}
function circuitPanelAction(prefix, act) {
  if (act !== 'cb-cond') return false;
  const e = G.panelEnt;
  if (!e) return false;
  if (!e.circuitCond) e.circuitCond = { enabled: false, channel: 'red', sig: 'iron-plate', op: '>', count: 1 };
  const c = e.circuitCond;
  c.enabled = document.getElementById(prefix + '-en').value === 'on';
  c.channel = document.getElementById(prefix + '-ch').value;
  c.sig = (typeof resolveSignalName === 'function' ? resolveSignalName(document.getElementById(prefix + '-sig').value) : document.getElementById(prefix + '-sig').value) || c.sig;
  c.op = document.getElementById(prefix + '-op').value;
  c.count = Math.floor(Number(document.getElementById(prefix + '-cnt').value)) || 0;
  const rh = document.getElementById(prefix + '-rh');
  c.readHand = !!(rh && rh.checked);
  const rc = document.getElementById(prefix + '-rc');
  if (rc) c.circuitRead = !!(rc && rc.checked);
  uiDirty = true;
  return true;
}

// ===== 注册 =====
function inserterStatusFn(e) {
  if (e.circuitCond && e.circuitCond.enabled && !e.circuitEnabled()) return 'r';
  return e.holding ? (e.blocked ? 'y' : 'g') : (e.rotating ? 'g' : 'r');
}
const inserterPanel = { html: inserterPanelHtml, live: inserterPanelLive, tip: inserterTip, onAction: inserterFilterOnAction };
const stackInserterPanel = { html: stackInserterPanelHtml, live: inserterPanelLive, tip: inserterTip, onAction: inserterFilterOnAction };
ENT_CLASSES['inserter'] = Inserter;
ENT_CLASSES['long-handed-inserter'] = LongInserter;
ENT_CLASSES['bulk-inserter'] = StackInserter;
ENT_CLASSES['fast-inserter'] = FastInserter;
ENT_CLASSES['stack-inserter'] = StackInserter;
DEVICE_RENDER['inserter'] = drawInserter;
DEVICE_RENDER['long-handed-inserter'] = drawInserter;
DEVICE_RENDER['bulk-inserter'] = drawInserter;
DEVICE_RENDER['fast-inserter'] = drawInserter;
DEVICE_RENDER['stack-inserter'] = drawInserter;
DEVICE_STATUS['inserter'] = inserterStatusFn;
DEVICE_STATUS['long-handed-inserter'] = inserterStatusFn;
DEVICE_STATUS['bulk-inserter'] = inserterStatusFn;
DEVICE_STATUS['fast-inserter'] = inserterStatusFn;
DEVICE_STATUS['stack-inserter'] = inserterStatusFn;
DEVICE_PANEL['inserter'] = inserterPanel;
DEVICE_PANEL['long-handed-inserter'] = inserterPanel;
DEVICE_PANEL['bulk-inserter'] = stackInserterPanel;
DEVICE_PANEL['fast-inserter'] = inserterPanel;
DEVICE_PANEL['stack-inserter'] = stackInserterPanel;
DEVICE_DIR_ROTATE['inserter'] = true;
DEVICE_DIR_ROTATE['long-handed-inserter'] = true;
DEVICE_DIR_ROTATE['bulk-inserter'] = true;
DEVICE_DIR_ROTATE['fast-inserter'] = true;
DEVICE_DIR_ROTATE['stack-inserter'] = true;
