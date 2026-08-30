'use strict';

// ===== 地下管道：背靠背摆两座（朝向相对，最远 PIPE_GROUND_MAX 格）自动配对，从地下穿行流体 =====
// 只有「背靠背」（两座朝向相对，地下管段在中间相接）才算配对；口对口（朝向相背、管口相对）
// 只是像普通管道一样的简单连通（紧挨时），不属于配对、不显示配对框线。
// 一条线上有多个管道时只与最近的背向管道配对（同向的不配对）。
// 可跨过传送带/管道等障碍，容量与普通管道一致（PIPE_CAP）。
// 只有“管口”（this.dir 的反向，即视觉上伸出连接管段的那一侧）能接普通管道与流体；
// 背向（this.dir 正向）不接任何管道，只通过与配对的另一端地下管道（地下管段）互通流体。
// 不分入口/出口：流体可从管口进入、从配对端流出，反之亦然。
//
// 【中间可放设备】两座之间可以放任意设备（建筑/机器/传送带……），这正是地下管道的用途：
// 地下管段从这些设备的“下方”穿过，因此**不会被中间的设备阻挡、也不会与它们连通流体**。
// 只有「峭壁 / 水面」这类不可建造的地形会切断地下管段（对齐《异星工厂》：Cliff 会阻挡地下管道）。
// 最大跨距（格）来自官方 data.raw：pipe-to-ground 的 underground pipe_connection.max_underground_distance = 10
// （由 tools/generate-game-data.js → GAME_DATA.pipeGroundDist 单源下发，见 AGENT.md 数据铁律）
const PIPE_GROUND_MAX = GAME_DATA.pipeGroundDist ?? 10;

// 地下管段能否从 (tx,ty) 这一格下方穿过：
//   ① 空地 / 树木 → 可以（地下管道本就用于穿越树木等地面障碍）
//   ② 任何设备（建筑 / 机器 / 传送带 / 管道 / 机械臂……）→ 可以，且不与它们连通
//   ③ 峭壁 / 水面 → 不可以，地形切断地下管段（对齐《异星工厂》：Cliff 会阻挡地下管道）
// 地形判定复用 world.js 的 isCliff/isWater（地形语义唯一源，此处不重复维护地形常量）。
function ugPipePassable(tx, ty) {
  if (typeof isCliff === 'function' && isCliff(tx, ty)) return false;   // 峭壁切断地下管段
  if (typeof isWater === 'function' && isWater(tx, ty)) return false;   // 水面不可铺设地下管段
  return true;
}

// 双向均压：将流体 k 从 a/b 中较多的一侧匀到较少的一侧（至少 1 单位），并遵守容量与防混合。
function pipeToGroundSwap(a, b, k) {
  const aF = a.fluid[k] || 0;
  const bF = b.fluid[k] || 0;
  // 防混合：任一端含有其它流体则不交换
  if (a.total() - aF > 0 || b.total() - bF > 0) return 0;
  const diff = Math.abs(aF - bF);
  // 差 1 以内视作已均衡：否则两端会反复互推这 1 单位，液面永远在 2/3 之间抖动。
  if (diff < 2) return 0;
  let from, to, avail, cap;
  if (aF > bF) { from = a; to = b; avail = aF; cap = PIPE_CAP - b.total(); }
  else { from = b; to = a; avail = bF; cap = PIPE_CAP - a.total(); }
  let move = Math.floor(diff / 2);
  move = Math.min(move, avail, cap);
  if (move <= 0) return 0;
  from.fluid[k] -= move;
  if (from.fluid[k] <= 0) delete from.fluid[k];
  to.fluid[k] = (to.fluid[k] || 0) + move;
  return move;
}
class PipeToGround extends Entity {
  constructor(type, x, y) {
    super('pipe-to-ground', x, y);
    this.fluid = {};   // 当前格内缓冲流体（用于配对面判断与地面交互）
  }
  total() { let s = 0; for (const k in this.fluid) s += this.fluid[k]; return s; }
  maxDist() { return PIPE_GROUND_MAX; }
  // 沿自身朝向的 sign 方向（+1 前方 / -1 背侧）扫描最近的背向管道；同向的截断，地形阻挡返回 null。
  // 距离从 1 起：**背靠背紧挨**（距离 1、朝向相对）同样配对——两座朝向侧的地下管段在
  // 共享边相接，属于配对连通。口对口相邻（距离 1、朝向相背）不在此配对，由
  // _adjacentMouthOpposite 作为「普通管道式直接连通」处理（与本扫描无关）。
  //
  // 【中间可放设备】扫描途中遇到的**任何设备都不再阻挡配对**（这是本次修复的核心）：
  // 地下管段从设备下方穿过，中间放设备（建筑/机器/传送带/管道……）照样互通。
  // 只有峭壁/水面（ugPipePassable=false）会切断这条地下管段。
  // 旧行为：`if (t.solid) return null;` —— 中间放一台设备就直接断连，与《异星工厂》不符。
  //
  // extra（可选）：虚拟在场的管道（放置幽灵/蓝图预览的本座）。幽灵不在实体网格里，
  // 若不给扫描"看见"它，就无法预测"放置后"的配对结果；把幽灵当作一个虚拟管道
  // 参与扫描与互认判定，让预览与真实摆放一致。
  _findAlong(sign, extra) {
    for (let k = 1; k <= this.maxDist(); k++) {
      const nx = this.x + DX[this.dir] * sign * k, ny = this.y + DY[this.dir] * sign * k;
      // 地形（峭壁/水面）切断地下管段
      if (!ugPipePassable(nx, ny)) return null;
      if (extra && extra.x === nx && extra.y === ny) {
        // 虚拟管道：与实体同规则——背向可配对，同向截断
        if (PipeToGround._parallel(extra.dir, this.dir)) return extra;
        return null;
      }
      const t = entAt(nx, ny);
      if (!t) continue;
      if (t instanceof PipeToGround) {
        if (PipeToGround._parallel(t.dir, this.dir)) return t;
        // 同向的地下管道：不配对，且**到此为止**（对齐《异星工厂》：中间隔着同方向的
        // 地下管道就断开，不能越过它去配更远的一座；已配对的那一对也不再与下一座配对）。
        // 旧行为是 continue 继续往后找，会导致隔着已配对的 2 号去配 1 号。
        return null;
      }
      // 其它设备（建筑/机器/传送带/普通管道……）一律“可穿越、不连通”，继续向后找配对端
    }
    return null;
  }
  // 原始配对候选（不做占用校验）：只认「本座朝向的前方」（背靠背）的背向管道——
  // 背靠背时两座的地下管段（朝向侧）相对相接，构成地下配对。
  // 口对口（本座朝向反方向的那一座，即后方）不构成配对：管口相对只是像普通管道一样
  // 的简单连通（相邻时由 _adjacentMouthOpposite 就近互通），不产生地下管段、不配对。
  _rawMate(extra) {
    return this._findAlong(1, extra);
  }
  findMate() {
    // 只与「同样把本座当作最近配对端」的那一座成对：已经与别人配对的地下管道，
    // 不会再与下一座继续配对（避免三座串成一团、也避免旋转时牵动已配对的那一对）。
    // 幽灵（不在实体网格，如放置幽灵/蓝图预览）：把本座作为虚拟管道交给对方扫描，
    // 模拟「放置后」的配对结果——若本座插在已配对的两座之间、且比对方当前配对端更近，
    // 预览就能正确显示"放置后会改配本座"（放置后由真实逻辑自然断开旧对）。
    // 真实实体（在网格中）：extra=null，走互认校验。
    const inGrid = entAt(this.x, this.y) === this;
    const extra = inGrid ? null : this;
    const m = this._rawMate(extra);
    if (!m) return null;
    const other = m._rawMate(extra);
    return (other === this || !other) ? m : null;
  }
  // 是否已配对：背靠背（本座朝向的前方有朝向相反的地下管道）才有配对端。
  // 口对口（朝向相背、管口相对）只是简单连通，不属于配对。
  isPaired() { return !!this.findMate(); }
  // 相邻（距离 1）且在管口侧（this.dir 反向）口对口相对的地下管道：不算配对关系，但像普通管道一样可直接互通。
  // 背向（this.dir 正向）不接任何管道——地下管道只有管口一个方向能接管道/流体（配对走 findMate 的地下管段）。
  // 这与 findMate（背靠背配对）分开：配对是背靠背（含紧挨距离 1）的地下管段互通，口对口是就近简单连通。
  _adjacentMouthOpposite() {
    const mouth = entAt(this.x - DX[this.dir], this.y - DY[this.dir]);
    const inner = t => t instanceof PipeToGround && PipeToGround._parallel(t.dir, this.dir);
    return inner(mouth) ? mouth : null;
  }
  // 两条地下管道只有「背靠背」（朝向相对、同在一条直线上）才配对：
  // 背靠背时两座的地下管段（朝向侧）相对相接；口对口（朝向相背）只是管口简单连通，不配对。
  static _parallel(d1, d2) { return ((d1 - d2 + 4) % 4) === 2; }
  update(dt) {
    // 惰性调度（同普通管道）：流体扩散是抽象均衡，按帧节流避免每帧四向扫描
    this._balT = (this._balT || 0) - dt;
    if (this._balT > 0) return;
    this._balT = 0.05;
    // 只有“管口”（this.dir 的反向）能接普通管道与流体；背向（this.dir 正向）不接任何管道。
    // 邻居 = 管口侧的地面管道 + 相邻口对口的地下管道 + 配对的另一端地下管道（地下管段互通）。
    const mouth = entAt(this.x - DX[this.dir], this.y - DY[this.dir]);
    const mate = this.findMate();
    const conns = [];
    if (mouth instanceof Pipe) conns.push(mouth);
    if (mate) conns.push(mate);
    // 相邻口对口（不配对）的地下管道也能就近互通
    const mouthOpp = this._adjacentMouthOpposite();
    if (mouthOpp) conns.push(mouthOpp);
    // 收集所有可能出现的流体种类（本方 + 各邻居），避免只扫本方导致“只进不出”
    const fluids = new Set(Object.keys(this.fluid));
    for (const t of conns) for (const k of Object.keys(t.fluid)) fluids.add(k);
    // 官方基础管道流速 = 200 流体/秒/节（PIPE_FLOW）：每节流周期(0.05s) 单节地下管道
    // 最多传输 200×0.05 = 10 单位，用 budget 限制其互换量，与普通 Pipe 一致。
    let budget = PIPE_FLOW * 0.05;
    for (const k of fluids) {
      if (budget <= 0) break;
      for (const t of conns) {
        if (budget <= 0) break;
        if ((this.fluid[k] > 0) || ((t.fluid[k] || 0) > 0)) {
          const moved = pipeToGroundSwap(this, t, k);
          budget -= moved;
        }
      }
    }
    // 管口直接对接带管道口的设备时，把流体注入其流体输入口。
    // 与普通管道 Pipe.update 的直推逻辑一致；但地下管道仅「管口」侧能接流体，
    // 故设备必须位于管口格、且本座恰好落在设备的输入口格（一格一接口）才注入。
    // 覆盖所有带流体输入口的设备：
    //   · 炼油厂/化工厂/电采矿机 —— isFluidInlet 判定输入格；
    //   · 储液罐 —— isPortCell 判定对角接口格；双向互通：本座仅液位比例高于罐时注入，
    //     罐侧 StorageTank.update 亦按比例向管口回灌（罐 ↔ 地下管道 全链路互通）；
    //   · 锅炉/热交换器 —— isWaterPortCell 判定两端水口格（收水）；
    //   · 蒸汽机/汽轮机/推进器 —— 两端中部汽口格（蒸汽机/汽轮机收蒸汽；推进器北口收燃料、南口收氧化剂）；
    //   · 火焰炮塔 —— 底部(南)油口格收轻油（随 dir 旋转，与 fluidPort 同式）；
    //   · 聚变反应堆/聚变发电机 —— 四周全向收流体（各自 coolantFlow/portFlow 即全向吸取，无格级接口）；
    //   · 装配机族（含铸造厂/电磁组装机/生物室/粉碎机/低温工厂/农业塔等 Assembler 子类）—— acceptsFluid 按配方收流体。
    // 各设备类名用 typeof 守卫：工具/测试环境未加载设备文件时不影响地下管道自身行为。
    const dev = mouth;
    const devIsAsm = typeof Assembler !== 'undefined' && dev instanceof Assembler;
    const devIsSteamPort = (typeof SteamEngine !== 'undefined' && dev instanceof SteamEngine) ||
                           (typeof SteamTurbine !== 'undefined' && dev instanceof SteamTurbine);
    const devIsThruster = typeof Thruster !== 'undefined' && dev instanceof Thruster;
    const devIsFlamethrower = typeof FlamethrowerTurret !== 'undefined' && dev instanceof FlamethrowerTurret;
    const devIsFusionPort = (typeof FusionReactor !== 'undefined' && dev instanceof FusionReactor) ||
                            (typeof FusionGenerator !== 'undefined' && dev instanceof FusionGenerator);
    const devIsFluidDevice = dev && dev !== this && (
      (typeof Refinery !== 'undefined' && dev instanceof Refinery) ||
      (typeof ChemicalPlant !== 'undefined' && dev instanceof ChemicalPlant) ||
      (typeof ElectricDrill !== 'undefined' && dev instanceof ElectricDrill) ||
      (typeof StorageTank !== 'undefined' && dev instanceof StorageTank) ||
      (typeof Boiler !== 'undefined' && dev instanceof Boiler) ||
      (typeof HeatExchanger !== 'undefined' && dev instanceof HeatExchanger) ||
      (typeof SteamEngine !== 'undefined' && dev instanceof SteamEngine) ||
      (typeof SteamTurbine !== 'undefined' && dev instanceof SteamTurbine) ||
      devIsThruster || devIsFlamethrower || devIsFusionPort ||
      devIsAsm
    );
    if (devIsFluidDevice) {
      // 一格一接口：本座 (this.x,this.y) 须命中该设备的某个流体输入口格。
      // 蒸汽机/汽轮机/推进器无格级判定方法，按其两端中部口格判定（与各自 portFlow 一致）；
      // 火焰炮塔按底部(南)油口格判定；聚变反应堆/发电机四周全向 → atPort 保持 true。
      let atPort = true;
      if (dev.isFluidInlet) atPort = dev.isFluidInlet(this.x, this.y);
      else if (dev.isPortCell) atPort = dev.isPortCell(this.x, this.y);          // 储液罐：对角接口格
      else if (dev.isWaterPortCell) atPort = dev.isWaterPortCell(this.x, this.y); // 锅炉/热交换器：两端水口
      else if (devIsSteamPort || devIsThruster) {
        const pN = rotCell(dev, dev.def.w >> 1, -1);
        const pS = rotCell(dev, dev.def.w >> 1, dev.def.h);
        atPort = (pN.x === this.x && pN.y === this.y) || (pS.x === this.x && pS.y === this.y);
      } else if (devIsFlamethrower) {
        const port = neighborOnSideCell(dev, (1 + (dev.dir | 0)) % 4, 0);
        atPort = !!(port && port.x === this.x && port.y === this.y);
      }
      // 装配机族：已有 isFluidInlet（顶部唯一流体口，随 dir 旋转），上面已按格判定 atPort
      if (atPort) {
        for (const k of Object.keys(this.fluid)) {
          if (!(this.fluid[k] > 0)) continue;
          if (devIsAsm && !dev.acceptsFluid(k)) continue;   // 装配机族仅收当前配方的流体
          // 储液罐是缓冲库容而非消费者：仅当本座液位比例高于罐时才注入（与普通管道
          // Pipe.update 的回赠守卫一致），避免低压地下管道向高压罐倒灌、与罐的按比例平衡拉锯
          if (typeof StorageTank !== 'undefined' && dev instanceof StorageTank) {
            const myRatio = (this.fluid[k] || 0) / PIPE_CAP;
            const tankRatio = (dev.fluid[k] || 0) / STORAGE_TANK_CAP;
            if (myRatio <= tankRatio) continue;
          }
          if (devIsThruster) {
            // 推进器双口分流体：北口只收燃料、南口只收氧化剂（与 portFlow 一致）
            const pN = rotCell(dev, dev.def.w >> 1, -1);
            const atFuelPort = pN.x === this.x && pN.y === this.y;
            if (k === 'thruster-fuel' && !atFuelPort) continue;
            if (k === 'thruster-oxidizer' && atFuelPort) continue;
          }
          if (dev.giveItem(k)) this.fluid[k]--;
        }
      }
    }
    for (const k of Object.keys(this.fluid)) if (!(this.fluid[k] > 0)) delete this.fluid[k];
  }
  giveItem(item) {
    if (FLUIDS.indexOf(item) < 0) return false;
    if (this.total() >= PIPE_CAP) return false;
    for (const k in this.fluid) if (this.fluid[k] > 0 && k !== item) return false;
    this.fluid[item] = (this.fluid[item] || 0) + 1;
    return true;
  }
  peekItem() { for (const k in this.fluid) if (this.fluid[k] > 0) return k; return null; }
  takeItem() { for (const k in this.fluid) if (this.fluid[k] > 0) return this.takeItemOf(k); return null; }
  countOf(item) { return this.fluid[item] || 0; }
  takeItemOf(item) {
    if ((this.fluid[item] || 0) > 0) { this.fluid[item]--; if (this.fluid[item] <= 0) delete this.fluid[item]; return item; }
    return null;
  }
  contents() {
    const list = [[this.type, 1]];
    for (const k in this.fluid) if (this.fluid[k] > 0) list.push([k, this.fluid[k]]);
    return list;
  }
  takeAll() {
    const rows = [];
    for (const k of Object.keys(this.fluid)) { rows.push([k, this.fluid[k]]); delete this.fluid[k]; }
    return rows;
  }
  serialize() { const s = super.serialize(); s.fluid = this.fluid; return s; }
  static restore(s) { const p = super.restore(s); p.fluid = s.fluid || {}; return p; }
}

// ===== 渲染 =====
// 1×1 地下管道入口：泥土坑（朝向下） + 向上伸出的黄铜管 + 顶部 4 通接头 + 流体
// 视觉分区：
//   ① 阴影  ② 泥土坑（深色圆 + 沙土纹理）
//   ③ 地下管段（朝 dir 方向的虚线，表示管段从地下穿过）
//   ④ 地上黄铜管（垂直短管）  ⑤ 顶部 4 通接头（双层圆角矩形 + 4 角螺栓）
//   ⑥ 流体圆点（管内）
function drawPipeGround(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  const paired = !!e.isPaired();
  const dx = DX[dir], dy = DY[dir];
  ctx.globalAlpha = alpha;
  ctx.lineCap = 'round';

  // ① 罐底阴影
  ctx.fillStyle = 'rgba(0,0,0,0.30)';
  ctx.beginPath();
  ctx.ellipse(cx, py + TILE - 2, TILE * 0.38, 3, 0, 0, Math.PI * 2);
  ctx.fill();

  // ② 泥土坑（圆 + 沙土纹理）
  // 外圈（深色泥土边）
  ctx.fillStyle = paired ? '#5b543f' : '#4c4c46';
  ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = paired ? '#39342a' : '#2f2f2a';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, 11, 0, Math.PI * 2); ctx.stroke();
  // 沙土小颗粒（随机暗点）
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  const dots = [[-7, 3], [-3, 7], [4, 6], [7, 1], [-5, -2], [3, -3], [8, 6], [-8, -3]];
  for (const [ox, oy] of dots) {
    ctx.beginPath();
    ctx.arc(cx + ox, cy + 2 + oy, 0.6, 0, Math.PI * 2);
    ctx.fill();
  }
  // 沙土高光
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  ctx.beginPath();
  ctx.arc(cx - 4, cy - 2, 2, 0, Math.PI * 2);
  ctx.fill();

  // ③ 地下管段（朝 dir 方向 — 表示管段从地下穿过，仅配对时显示完整虚线）
  // 虚线方向：dx, dy（管段从此位置向 dir 正向延伸，与配对端地下连接）
  ctx.strokeStyle = '#5a5246';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([3, 2.5]);
  // 阴影/远端用更虚的线
  ctx.beginPath();
  ctx.moveTo(cx + dx * 3, cy + dy * 3);
  ctx.lineTo(cx + dx * (TILE / 2 - 1), cy + dy * (TILE / 2 - 1));
  ctx.stroke();
  ctx.setLineDash([]);

  // ④ 地上黄铜管（背侧 — 朝向 -dir 方向伸出的连接管）
  //    复用旧约定：管口在 -dir 侧（向"上/北"为基准，旋转后是相反方向）
  //    此处画"地上"短管从接头伸到瓦片边。
  //    用平头（butt）延伸到瓦片边：与相邻普通管道/口对口地下管道的管段在共享边
  //    严丝合缝，不再用圆头让管帽凸进邻格、在接缝处叠加。
  ctx.lineCap = 'butt';
  // 外层管壁
  ctx.strokeStyle = '#4a4234';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx - dx * (TILE / 2), cy - dy * (TILE / 2));
  ctx.stroke();
  // 内层黄铜
  ctx.strokeStyle = '#8d8272';
  ctx.lineWidth = 6.5;
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(cx - dx * (TILE / 2), cy - dy * (TILE / 2));
  ctx.stroke();
  // 管段高光
  ctx.lineCap = 'round';
  ctx.strokeStyle = 'rgba(255, 235, 200, 0.30)';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  const ox = dx === 0 ? 0 : (dx > 0 ? 0.6 : -0.6);
  const oy = dy === 0 ? 0 : (dy > 0 ? 0.6 : -0.6);
  ctx.moveTo(cx + ox, cy + oy);
  ctx.lineTo(cx - dx * (TILE / 2) + ox, cy - dy * (TILE / 2) + oy);
  ctx.stroke();

  // ⑤ 顶部 4 通接头（双层圆角矩形 + 4 角螺栓 + 顶面高光）
  // 外层
  ctx.fillStyle = '#4a4234';
  rr(ctx, cx - 9.5, cy - 9.5, 19, 19, 3); ctx.fill();
  // 内层
  ctx.fillStyle = '#8d8272';
  rr(ctx, cx - 7.5, cy - 7.5, 15, 15, 2.5); ctx.fill();
  // 描边
  ctx.strokeStyle = '#3a3228';
  ctx.lineWidth = 0.6;
  rr(ctx, cx - 7.5, cy - 7.5, 15, 15, 2.5); ctx.stroke();
  // 4 角小螺栓
  const drawBolt = (bx, by) => {
    ctx.fillStyle = '#3a3228';
    ctx.beginPath(); ctx.arc(bx, by, 1.1, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,235,200,0.35)';
    ctx.beginPath(); ctx.arc(bx - 0.2, by - 0.2, 0.5, 0, Math.PI * 2); ctx.fill();
  };
  drawBolt(cx - 5.5, cy - 5.5);
  drawBolt(cx + 5.5, cy - 5.5);
  drawBolt(cx - 5.5, cy + 5.5);
  drawBolt(cx + 5.5, cy + 5.5);
  // 顶面高光
  ctx.fillStyle = 'rgba(255, 235, 200, 0.30)';
  ctx.fillRect(cx - 6, cy - 6, 12, 0.8);

  // ⑥ 流体圆点（管口侧 -dir 处的接头顶部）
  const total = e.total ? e.total() : 0;
  if (total > 0) {
    const first = Object.keys(e.fluid).find(k => e.fluid[k] > 0);
    if (first && ITEMS[first]) {
      // 流体深色边
      ctx.fillStyle = _pgDarken(ITEMS[first].color, 0.35);
      ctx.beginPath();
      ctx.arc(cx, cy, 5.4, 0, Math.PI * 2);
      ctx.fill();
      // 流体本色
      ctx.fillStyle = ITEMS[first].color;
      ctx.beginPath();
      ctx.arc(cx, cy, 4.8, 0, Math.PI * 2);
      ctx.fill();
      // 流体高光
      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.beginPath();
      ctx.arc(cx - 1.5, cy - 1.5, 1.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 配对状态提示（未配对时管段虚线更虚 + 中心黄色警示环）
  if (!paired) {
    ctx.strokeStyle = 'rgba(255, 180, 60, 0.7)';
    ctx.lineWidth = 1;
    ctx.setLineDash([2, 2]);
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  ctx.globalAlpha = 1;
}
function _pgDarken(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.max(0, Math.floor(((n >> 16) & 255) * (1 - t)));
  const g = Math.max(0, Math.floor(((n >> 8) & 255) * (1 - t)));
  const b = Math.max(0, Math.floor((n & 255) * (1 - t)));
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

// ===== 面板 =====
function pipeGroundPanelHtml(e) {
  const agg = {};
  for (const k in e.fluid) if (e.fluid[k] > 0) agg[k] = e.fluid[k];
  let h = row('流体', Object.keys(agg).length ? '<div class="asm3-inp-row">' + itemSlotsHtml(agg, { action: 'display' }) + '</div>' : '<span class="dim">空</span>', 'contents');
  h += row('容量', e.total() + ' / ' + PIPE_CAP, 'cap');
  if (Object.keys(agg).length) h += '<button data-action="drain" id="btn-pgt-takeout">直接清空</button>';
  h += '<div class="dim">地下管道：<b>背靠背</b>摆两座（朝向相对，最远 ' + PIPE_GROUND_MAX + ' 格）自动配对，从地下穿行流体；口对口（朝向相背、管口相对）只是像普通管道一样的简单连通，不属于配对。只有<b>管口</b>（管道伸出的那一侧）能接普通管道与流体，背向不接管道，只与配对的另一端地下管道互通；不分入口/出口，流体可从管口进、从配对端出。<b>两座中间可以放任意设备</b>（建筑/机器/传送带/管道……），管段从设备下方穿过，不会被阻挡也不会与设备连通；只有峭壁/水面会切断地下管段。一条线上多个管道时只与最近的背向管道配对。R 旋转方向。</div>';
  return h;
}
function pipeGroundPanelLive(e, api) {
  const agg = {};
  for (const k in e.fluid) if (e.fluid[k] > 0) agg[k] = e.fluid[k];
  api.set('contents', Object.keys(agg).length ? '<div class="asm3-inp-row">' + itemSlotsHtml(agg, { action: 'display' }) + '</div>' : dimSpan('空'));
  api.set('cap', e.total() + ' / ' + PIPE_CAP);
  api.toggle('#btn-pgt-takeout', e.total() > 0, '直接清空');
  if (!e.isPaired()) api.status('已暂停：未配对（背靠背 ' + PIPE_GROUND_MAX + ' 格内无朝向相对的另一座地下管道）', 'warn');
  else if (e.total() > 0) api.status('输送中：管口与配对端双向均压流动', 'ok');
  else api.status('地下互通：等待流体进入', 'ok');
}
function pipeGroundTip(e) {
  const agg = {};
  for (const k in e.fluid) if (e.fluid[k] > 0) agg[k] = e.fluid[k];
  if (e.isPaired()) return '地下管道：互通双向输送' + (Object.keys(agg).length ? '（缓冲 ' + Object.keys(agg).map(k => ITEMS[k].name + '×' + agg[k]).join('、') + '）' : '') + '，R 旋转方向';
  return '未配对（背向 ' + PIPE_GROUND_MAX + ' 格内无朝向相反的另一座）';
}

// ===== 注册 =====
ENT_CLASSES['pipe-to-ground'] = PipeToGround;
DEVICE_RENDER['pipe-to-ground'] = drawPipeGround;
DEVICE_STATUS['pipe-to-ground'] = e => e.findMate() ? (e.total() > 0 ? 'g' : 'r') : 'y';
DEVICE_PANEL['pipe-to-ground'] = { html: pipeGroundPanelHtml, live: pipeGroundPanelLive, tip: pipeGroundTip };
DEVICE_DIR_ROTATE['pipe-to-ground'] = true;
