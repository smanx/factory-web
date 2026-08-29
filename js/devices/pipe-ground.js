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
  if (a.total() - aF > 0 || b.total() - bF > 0) return;
  const diff = Math.abs(aF - bF);
  // 差 1 以内视作已均衡：否则两端会反复互推这 1 单位，液面永远在 2/3 之间抖动。
  if (diff < 2) return;
  let from, to, avail, cap;
  if (aF > bF) { from = a; to = b; avail = aF; cap = PIPE_CAP - b.total(); }
  else { from = b; to = a; avail = bF; cap = PIPE_CAP - a.total(); }
  let move = Math.floor(diff / 2);
  move = Math.min(move, avail, cap);
  if (move <= 0) return;
  from.fluid[k] -= move;
  if (from.fluid[k] <= 0) delete from.fluid[k];
  to.fluid[k] = (to.fluid[k] || 0) + move;
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
    for (const k of fluids) {
      for (const t of conns) {
        if ((this.fluid[k] > 0) || ((t.fluid[k] || 0) > 0)) pipeToGroundSwap(this, t, k);
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
function drawPipeGround(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  const paired = !!e.isPaired();
  const dx = DX[dir], dy = DY[dir];
  ctx.globalAlpha = alpha;
  // 底层：圆形土坑（区别于普通管道的圆形节点，用泥土色 + 更大半径 + 内缘凹陷）
  ctx.fillStyle = paired ? '#5b543f' : '#4c4c46';
  ctx.beginPath(); ctx.arc(cx, cy, 10.5, 0, 7); ctx.fill();
  ctx.strokeStyle = paired ? '#39342a' : '#3a3a3a';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, 10.5, 0, 7); ctx.stroke();
  // 指向方向（背侧）的管道：粗细/颜色与普通管道一致，指到瓦片边缘，与相邻普通管道无缝衔接
  ctx.strokeStyle = '#7d7264';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  if (!paired) ctx.setLineDash([5, 4]);
  ctx.beginPath();
  ctx.moveTo(cx - dx * 3, cy - dy * 3);
  ctx.lineTo(cx - dx * (TILE / 2 - 1), cy - dy * (TILE / 2 - 1));
  ctx.stroke();
  ctx.setLineDash([]);
  // 管口亮环（呼应普通管道管口）：位于指向端（背侧）
  ctx.fillStyle = '#8d8272';
  ctx.beginPath(); ctx.arc(cx - dx * 5, cy - dy * 5, 4.5, 0, 7); ctx.fill();
  ctx.strokeStyle = '#55503f';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx - dx * 5, cy - dy * 5, 4.5, 0, 7); ctx.stroke();
  // 流体圆点：位于指向端管口（背侧）
  const total = e.total ? e.total() : 0;
  if (total > 0) {
    const first = Object.keys(e.fluid).find(k => e.fluid[k] > 0);
    if (first && ITEMS[first]) {
      ctx.fillStyle = ITEMS[first].color;
      ctx.beginPath();
      ctx.arc(cx - dx * 5, cy - dy * 5, 3, 0, 7);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

// ===== 面板 =====
function pipeGroundPanelHtml(e) {
  const agg = {};
  for (const k in e.fluid) if (e.fluid[k] > 0) agg[k] = e.fluid[k];
  let h = row('流体', Object.keys(agg).length ? countStr(agg) : '<span class="dim">空</span>', 'contents');
  h += row('容量', e.total() + ' / ' + PIPE_CAP, 'cap');
  if (Object.keys(agg).length) h += '<button data-action="drain" id="btn-pgt-takeout">直接清空</button>';
  h += '<div class="status"></div>';
  h += '<div class="dim">地下管道：<b>背靠背</b>摆两座（朝向相对，最远 ' + PIPE_GROUND_MAX + ' 格）自动配对，从地下穿行流体；口对口（朝向相背、管口相对）只是像普通管道一样的简单连通，不属于配对。只有<b>管口</b>（管道伸出的那一侧）能接普通管道与流体，背向不接管道，只与配对的另一端地下管道互通；不分入口/出口，流体可从管口进、从配对端出。<b>两座中间可以放任意设备</b>（建筑/机器/传送带/管道……），管段从设备下方穿过，不会被阻挡也不会与设备连通；只有峭壁/水面会切断地下管段。一条线上多个管道时只与最近的背向管道配对。R 旋转方向。</div>';
  return h;
}
function pipeGroundPanelLive(e, api) {
  const agg = {};
  for (const k in e.fluid) if (e.fluid[k] > 0) agg[k] = e.fluid[k];
  api.set('contents', Object.keys(agg).length ? countStr(agg) : dimSpan('空'));
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
