'use strict';

// ===== 电路网络（对齐《异星工厂》Circuit Network）=====
// 电线杆 + 组合器（常量/运算/判断）。节点间自动连线，信号在连通组件内
// 沿红/绿两个独立通道聚合；组合器输出信号到指定通道，供其它设备（如流体泵）
// 读取实现逻辑控制。

const CIRCUIT_POLE_RANGE = {
  'small-electric-pole': 7,
  'medium-electric-pole': 9,
  'big-electric-pole': 15
};
const CIRCUIT_COMB_RANGE = 7;   // 组合器的连接范围（与电线杆/组合器互联）

// 全局节流：网络重算每 CIRCUIT_RECOMPUTE_INTERVAL 秒一次。
const CIRCUIT_RECOMPUTE_INTERVAL = 0.25;

// ===== 电路节点基类 =====
class CircuitNode extends Entity {
  constructor(type, x, y) {
    super(type, x, y);
    this.red = new Set();     // 红线相连的其它节点
    this.green = new Set();   // 绿线相连的其它节点
    this.netRed = {};         // 本节点所属网络的红线聚合信号
    this.netGreen = {};       // 本节点所属网络的绿线聚合信号
    this._tick = -1;
    // 电路接入通道（对齐《异星工厂》红/绿线缆）：'both' 同时接入红+绿（默认，向后兼容），
    // 'red' 仅接入红线网络（只读红线信号），'green' 仅接入绿线网络，实现红绿信号物理隔离。
    // 注：与组合器自身的输出通道 channel 属性无关，此处用 wireChan 避免命名冲突。
    this.wireChan = 'both';
  }
  serialize() { const s = super.serialize(); s.wireChan = this.wireChan; return s; }
  static restore(s) { const e = super.restore(s); e.wireChan = s.wireChan || 'both'; return e; }
  get range() {
    return CIRCUIT_POLE_RANGE[this.type] !== undefined ? CIRCUIT_POLE_RANGE[this.type] : CIRCUIT_COMB_RANGE;
  }
  cx() { return this.x + this.w / 2; }
  cy() { return this.y + this.h / 2; }
  // 距另一节点中心的切比雪夫距离（格）
  distTo(o) { return Math.max(Math.abs(this.cx() - o.cx()), Math.abs(this.cy() - o.cy())); }
  // 网络重算由主循环按固定间隔调用 recomputeCircuit()，节点 update 无需额外逻辑
  update(dt) {}
  contents() { return [[this.type, 1]]; }
}

// 收集当前所有电路节点
function collectCircuitNodes() {
  const nodes = [];
  for (const e of G.ents) if (!e._dead && e instanceof CircuitNode) nodes.push(e);
  return nodes;
}

// 电路节点缓存（性能优化）：recomputeCircuit 每 0.25s 收集一次节点列表并存入缓存，
// circuitSignalNear（被传送带/机械臂/电灯/流体泵/铁路信号灯每帧调用）复用该缓存，
// 避免每次调用都全量遍历 G.ents（高设备密度下显著降低帧开销）。
let _circuitNodesCache = null;
function cacheCircuitNodes(nodes) { _circuitNodesCache = nodes; }
function getCachedCircuitNodes() { return _circuitNodesCache || (_circuitNodesCache = collectCircuitNodes()); }

// 重建单个节点的连线（同色通道均连接到范围内其它节点）
// 性能优化：可传入预先收集的 nodes 数组，避免在 recompute 全量重建时对每个节点重复遍历
// G.ents（原为 O(n²) 的 collectCircuitNodes 调用），仅在未传参时才自行收集（保持向后兼容）。
function refreshNodeWires(node, nodes) {
  node.red.clear();
  node.green.clear();
  if (!nodes) nodes = collectCircuitNodes();
  for (const o of nodes) {
    if (o === node || o._dead) continue;
    const d = node.distTo(o);
    if (d <= node.range && d <= o.range) {
      // 双向互连：每个节点都把范围内的连通邻居加入自己的 red/green，
      // 保证 BFS 从任意节点出发都能遍历整个连通组件（避免单向连线遗漏）。
      node.red.add(o);
      node.green.add(o);
    }
  }
}

// 信号累加
function addSignal(target, sig, count) {
  if (!count) return;
  target[sig] = (target[sig] || 0) + count;
}
function mergeSignals(a, b) {
  const r = {};
  for (const k in a) r[k] = (r[k] || 0) + a[k];
  for (const k in b) r[k] = (r[k] || 0) + b[k];
  return r;
}

// 组合器输入信号：按接入通道（wireChan）过滤——'red' 仅红线、'green' 仅绿线、'both' 红绿合并。
// 对齐《异星工厂》：组合器只接红线/只接绿线时，其输入端只感知对应通道信号，实现红绿物理隔离。
function combinatorInput(n, aggRed, aggGreen) {
  if (n.wireChan === 'red') return aggRed;
  if (n.wireChan === 'green') return aggGreen;
  return mergeSignals(aggRed, aggGreen);
}

// 全网络重算：重建连线 → BFS 分组 → 聚合常量 → 级联运算/判断 → 写回各节点
function recomputeCircuit() {
  const nodes = collectCircuitNodes();
  cacheCircuitNodes(nodes);   // 缓存供 circuitSignalNear 复用（P 优化）
  if (!nodes.length) return;
  // 性能优化：把已收集的 nodes 缓存传入 refreshNodeWires，避免每个节点再次全量遍历 G.ents
  for (const n of nodes) refreshNodeWires(n, nodes);

  // BFS 沿（红=绿同拓扑，双向互连）划分连通组件。
  // refreshNodeWires 建立双向连线，从任意节点出发都能遍历整个连通组件，
  // 确保任意建造顺序下蓄电器/组合器/开关等都能正确分组并共享信号。
  const seen = new Set();
  const groups = [];
  for (const start of nodes) {
    if (seen.has(start)) continue;
    const group = [];
    const queue = [start];
    seen.add(start);
    while (queue.length) {
      const n = queue.shift();
      group.push(n);
      for (const o of n.red) if (!seen.has(o)) { seen.add(o); queue.push(o); }
    }
    groups.push(group);
  }

  for (const group of groups) {
    let aggRed = {};
    let aggGreen = {};
    // 1) 常量组合器：把常量直接累加进对应通道
    for (const n of group) {
      if (!(n instanceof ConstantCombinator)) continue;
      const out = n.output; // { red:[{sig,count}], green:[...] }
      if (out && out.red) for (const it of out.red) addSignal(aggRed, it.sig, it.count);
      if (out && out.green) for (const it of out.green) addSignal(aggGreen, it.sig, it.count);
    }
    // 1b) 蓄电器：把储电量百分比（0~100）以 signal-charge 信号输出到网络（对齐《异星工厂》蓄电器电路信号）。
    //     电量信号聚合到红线（也同步到绿线，便于任意通道读取）。
    for (const n of group) {
      if (!(n instanceof Accumulator)) continue;
      const pct = Math.round(Math.max(0, Math.min(1, (n.stored || 0) / ACCUM_CAP)) * 100);
      if (pct > 0) { addSignal(aggRed, 'signal-charge', pct); addSignal(aggGreen, 'signal-charge', pct); }
    }
    // 1c) 储物箱（Chest 家族：木箱/铁箱/钢箱）：把箱内每种物品的数量以该物品为信号名
    //     输出到网络（对齐《异星工厂》：箱子接入电路后可读取物品数量，实现按库存自动化）。
    //     信号同时写入红线与绿线，便于任意通道读取。
    for (const n of group) {
      if (!(n instanceof Chest)) continue;
      if (!n.slots || !n.slots.length) continue;
      for (const st of n.slots) {
        if (!st || !st.item || !st.count) continue;
        addSignal(aggRed, st.item, st.count);
        addSignal(aggGreen, st.item, st.count);
      }
    }
    // 2) 运算/判断组合器：读取输入信号，计算后输出到指定通道（可级联）。
    //    输入信号遵循组合器的接入通道（wireChan）：'red' 仅读红线、'green' 仅读绿线、
    //    'both' 读红+绿合并（默认，向后兼容）。实现红绿信号物理隔离对齐《异星工厂》。
    for (const n of group) {
      const input = combinatorInput(n, aggRed, aggGreen);
      if (n instanceof ArithmeticCombinator) {
        const out = n.compute(input);
        if (out && out.length) {
          for (const it of out) {
            if (it && it.sig !== null && it.count) {
              if (n.channel === 'green') addSignal(aggGreen, it.sig, it.count);
              else addSignal(aggRed, it.sig, it.count);
            }
          }
        }
      } else if (n instanceof DeciderCombinator) {
        const out = n.compute(input);
        if (out) {
          for (const it of out) {
            if (n.channel === 'green') addSignal(aggGreen, it.sig, it.count);
            else addSignal(aggRed, it.sig, it.count);
          }
        }
      }
    }
    // 3) 写回各节点（按接入通道隔离：'red' 只读红线、'green' 只读绿线、'both' 双通）
    //    对齐《异星工厂》：设备仅接红线/仅接绿线时，只感知对应通道网络信号，实现红绿物理隔离。
    for (const n of group) {
      if (n.wireChan === 'red')      { n.netRed = aggRed;   n.netGreen = {}; }
      else if (n.wireChan === 'green'){ n.netRed = {};      n.netGreen = aggGreen; }
      else                           { n.netRed = aggRed;   n.netGreen = aggGreen; }
    }
  }
}

// ===== 常量组合器 =====
class ConstantCombinator extends CircuitNode {
  constructor(type, x, y) {
    super('constant-combinator', x, y);
    this.output = { red: [], green: [] }; // { red:[{sig,count}], green:[{sig,count}] }
  }
  serialize() { const s = super.serialize(); s.output = this.output; return s; }
  static restore(s) { const e = super.restore(s); e.output = s.output || { red: [], green: [] }; return e; }
}

// ===== 虚拟信号（对齐《异星工厂》Virtual signals）=====
// 运算/判断组合器支持把信号A设为虚拟信号，实现批量信号处理：
//  - 'signal-each'     对每个输入信号逐个运算/判断（输出保持原信号名）
//  - 'signal-everything' 全部输入信号满足/参与（输出合并为单个信号）
//  - 'signal-anything'  任一输入信号满足（输出合并为单个信号）
const VIRTUAL_SIGNALS = {
  'signal-each': '每个信号',
  'signal-everything': '全部信号',
  'signal-anything': '任一信号',
  'signal-count': '数量'
};
// 判断某信号名是否为虚拟信号（各列表/输入框均识别）
function isVirtualSignal(sig) { return Object.prototype.hasOwnProperty.call(VIRTUAL_SIGNALS, sig); }

// ===== 运算组合器 =====
// 配置：aSig（输入信号，可为虚拟信号 each/everything）/ bConst 或 bSig（第二操作数）
// op: '+'|'-'|'*'|'/'  outSig（输出信号） channel: 'red'|'green'
class ArithmeticCombinator extends CircuitNode {
  constructor(type, x, y) {
    super('arithmetic-combinator', x, y);
    this.aSig = 'iron-plate';
    this.bConst = 0; this.useConst = true;
    this.op = '+';
    this.outSig = 'signal-count';
    this.channel = 'red';
  }
  // 返回输出信号数组 [{sig, count}, ...]；signal-each 时可能输出多条（对齐《异星工厂》运算组合器）
  compute(input) {
    const b = this.useConst ? this.bConst : (input[this.bSig] || 0);
    const applyOp = (a) => {
      let v = 0;
      switch (this.op) {
        case '+': v = a + b; break;
        case '-': v = a - b; break;
        case '*': v = a * b; break;
        case '/': v = b === 0 ? 0 : Math.floor(a / b); break;
      }
      return Math.floor(v);
    };
    const out = [];
    // signal-each：对每个输入信号逐个运算，结果以原信号名输出（忽略 outSig）
    if (this.aSig === 'signal-each') {
      for (const key in input) {
        if (isVirtualSignal(key)) continue;          // 跳过虚拟信号本身
        const v = applyOp(input[key]);
        if (v) out.push({ sig: key, count: v });
      }
      return out;
    }
    // signal-everything：把全部输入值求和作为 A，结果合并到 outSig 单个输出
    if (this.aSig === 'signal-everything') {
      let sum = 0;
      for (const key in input) if (!isVirtualSignal(key)) sum += input[key];
      const v = applyOp(sum);
      if (v) out.push({ sig: this.outSig, count: v });
      return out;
    }
    // 具体信号：单个运算，输出到 outSig
    const a = input[this.aSig] || 0;
    const v = applyOp(a);
    if (v) out.push({ sig: this.outSig, count: v });
    return out;
  }
  serialize() {
    const s = super.serialize();
    s.aSig = this.aSig; s.bConst = this.bConst; s.useConst = this.useConst; s.bSig = this.bSig;
    s.op = this.op; s.outSig = this.outSig; s.channel = this.channel;
    return s;
  }
  static restore(s) {
    const e = super.restore(s);
    e.aSig = s.aSig || 'iron-plate'; e.bConst = s.bConst || 0; e.useConst = s.useConst !== false;
    e.bSig = s.bSig; e.op = s.op || '+'; e.outSig = s.outSig || 'signal-count'; e.channel = s.channel || 'red';
    return e;
  }
}

// ===== 判断组合器 =====
// 配置：aSig（输入信号，可为虚拟信号 each/everything/anything）op bConst/bSig,
// outSig×outCount, copyFrom 复制输入信号
// op: '>'|'<'|'='|'!='  channel: 'red'|'green'
class DeciderCombinator extends CircuitNode {
  constructor(type, x, y) {
    super('decider-combinator', x, y);
    this.aSig = 'iron-plate';
    this.op = '>';
    this.useConst = true; this.bConst = 0; this.bSig = null;
    this.outSig = 'signal-count'; this.outCount = 1;
    this.copyFrom = false; // true=复制满足条件的输入信号而非固定输出
    this.channel = 'green';
  }
  // 判断单个值 a 是否满足条件
  condOk(a, b) {
    switch (this.op) {
      case '>': return a > b;
      case '<': return a < b;
      case '=': return a === b;
      case '!=': return a !== b;
      case '>=': return a >= b;
      case '<=': return a <= b;
    }
    return false;
  }
  // 返回输出信号数组；signal-each 时可能输出多条（对齐《异星工厂》判断组合器）
  compute(input) {
    const b = this.useConst ? this.bConst : (input[this.bSig] || 0);
    const isEach = this.aSig === 'signal-each';
    const isEvery = this.aSig === 'signal-everything';
    const isAny = this.aSig === 'signal-anything';
    // 提取真实输入信号（跳过虚拟信号与零值）
    const realInput = {};
    for (const key in input) if (!isVirtualSignal(key) && input[key]) realInput[key] = input[key];

    // signal-each：逐个判断，满足的以原信号名输出（对齐《异星工厂》：each 输出原信号）
    if (isEach) {
      const out = [];
      for (const key in realInput) {
        if (!this.condOk(realInput[key], b)) continue;
        out.push({ sig: key, count: this.copyFrom ? realInput[key] : Math.floor(this.outCount) });
      }
      return out;
    }
    // signal-everything：全部输入信号都满足才成立
    if (isEvery) {
      let allOk = true;
      for (const key in realInput) {
        if (!this.condOk(realInput[key], b)) { allOk = false; break; }
      }
      if (!allOk) return [];
      if (this.copyFrom) {
        const out = [];
        for (const key in realInput) out.push({ sig: key, count: realInput[key] });
        return out;
      }
      return [{ sig: this.outSig, count: Math.floor(this.outCount) }];
    }
    // signal-anything：任一输入信号满足即成立
    if (isAny) {
      let anyOk = false;
      for (const key in realInput) {
        if (this.condOk(realInput[key], b)) { anyOk = true; break; }
      }
      if (!anyOk) return [];
      if (this.copyFrom) {
        const out = [];
        for (const key in realInput) out.push({ sig: key, count: realInput[key] });
        return out;
      }
      return [{ sig: this.outSig, count: Math.floor(this.outCount) }];
    }
    // 具体信号：单个判断
    const a = input[this.aSig] || 0;
    if (!this.condOk(a, b)) return [];
    if (this.copyFrom) return [{ sig: this.aSig, count: a }];
    return [{ sig: this.outSig, count: Math.floor(this.outCount) }];
  }
  serialize() {
    const s = super.serialize();
    s.aSig = this.aSig; s.op = this.op; s.useConst = this.useConst; s.bConst = this.bConst;
    s.bSig = this.bSig; s.outSig = this.outSig; s.outCount = this.outCount;
    s.copyFrom = this.copyFrom; s.channel = this.channel;
    return s;
  }
  static restore(s) {
    const e = super.restore(s);
    e.aSig = s.aSig || 'iron-plate'; e.op = s.op || '>'; e.useConst = s.useConst !== false;
    e.bConst = s.bConst || 0; e.bSig = s.bSig; e.outSig = s.outSig || 'signal-count';
    e.outCount = s.outCount || 1; e.copyFrom = !!s.copyFrom; e.channel = s.channel || 'green';
    return e;
  }
}

// ===== 渲染：电线杆 =====
const POLE_COLORS = {
  'small-electric-pole': ['#8a5a2a', '#6b4420'],
  'medium-electric-pole': ['#a06a2a', '#7a4e20'],
  'big-electric-pole': ['#b0802a', '#8a6220']
};
function drawCircuitPole(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * e.w;
  const col = POLE_COLORS[e.type] || ['#8a5a2a', '#6b4420'];
  ctx.globalAlpha = alpha;
  // 底座
  ctx.fillStyle = '#4a403a';
  rr(ctx, px + 4, py + 4, s - 8, s - 8, 6); ctx.fill();
  // 杆身
  ctx.fillStyle = col[0];
  rr(ctx, px + s / 2 - 4, py + 4, 8, s - 8, 3); ctx.fill();
  ctx.strokeStyle = col[1];
  ctx.lineWidth = 2;
  rr(ctx, px + s / 2 - 4, py + 4, 8, s - 8, 3); ctx.stroke();
  // 顶部横担（接线处）
  ctx.fillStyle = col[1];
  rr(ctx, px + s / 2 - 10, py + 2, 20, 5, 2); ctx.fill();
  // 红/绿信号指示灯
  ctx.fillStyle = '#e05a4a'; ctx.beginPath(); ctx.arc(px + s / 2 - 5, py + 5, 2.2, 0, 7); ctx.fill();
  ctx.fillStyle = '#5ae06a'; ctx.beginPath(); ctx.arc(px + s / 2 + 5, py + 5, 2.2, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;
  drawCircuitWires(ctx, e);
}

// ===== 渲染：组合器 =====
const COMB_COLORS = {
  'constant-combinator': ['#4a7ac0', '#3a5c96'],
  'arithmetic-combinator': ['#4a9ac0', '#387291'],
  'decider-combinator': ['#4ac0a0', '#38937c']
};
function drawCombinator(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const col = COMB_COLORS[e.type] || ['#4a7ac0', '#3a5c96'];
  ctx.globalAlpha = alpha;
  ctx.fillStyle = col[0];
  rr(ctx, px + 3, py + 3, TILE - 6, TILE - 6, 6); ctx.fill();
  ctx.strokeStyle = col[1];
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, TILE - 6, TILE - 6, 6); ctx.stroke();
  ctx.fillStyle = '#14161a';
  ctx.font = 'bold 12px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const label = e instanceof ConstantCombinator ? '≡' : e instanceof ArithmeticCombinator ? '∑' : '≷';
  ctx.fillText(label, px + TILE / 2, py + TILE / 2);
  ctx.globalAlpha = 1;
  drawCircuitWires(ctx, e);
}

// 绘制节点与相邻节点之间的连线（只画向“坐标更大”的节点，避免重复）
function drawCircuitWires(ctx, e) {
  if (!e.red && !e.green) return;
  const selfKey = entKey(e.x, e.y);
  const cx = (e.x + e.w / 2) * TILE, cy = (e.y + e.h / 2) * TILE;
  const drawn = new Set();
  const drawWire = (o, color, off) => {
    if (entKey(o.x, o.y) <= selfKey) return;
    const id = o.x + ',' + o.y;
    if (drawn.has(id)) return; drawn.add(id);
    const ox = (o.x + o.w / 2) * TILE, oy = (o.y + o.h / 2) * TILE;
    // 红/绿线各偏移一点，避免完全重叠
    ctx.strokeStyle = color;
    ctx.lineWidth = 2 / Math.max(0.5, G.cam.z);
    ctx.globalAlpha = 0.7;
    ctx.beginPath();
    ctx.moveTo(cx + off, cy);
    ctx.quadraticCurveTo((cx + ox) / 2 + off, cy, ox + off, oy);
    ctx.stroke();
    ctx.globalAlpha = 1;
  };
  if (e.red) for (const o of e.red) drawWire(o, '#e05a4a', -2);
  if (e.green) for (const o of e.green) drawWire(o, '#5ae06a', 2);
}

// ===== 面板：常量组合器 =====
function constantPanelHtml(e) {
  let h = row('类型', '常量组合器 · 输出固定信号', 'kind');
  h += '<div class="sec">常量输出（红线）</div>';
  h += '<div class="circ-signal-list" id="c-red-list">' + constantSignalListHtml(e.output.red) + '</div>';
  h += signalAddRow('c-red', e);
  h += '<div class="sec">常量输出（绿线）</div>';
  h += '<div class="circ-signal-list" id="c-green-list">' + constantSignalListHtml(e.output.green) + '</div>';
  h += signalAddRow('c-green', e);
  h += '<div class="status"></div>';
  h += '<div class="dim">把指定物品信号以固定数值持续输出到红线/绿线网络。信号名=物品，数值可正可负。</div>';
  return h;
}
function constantSignalListHtml(list) {
  if (!list || !list.length) return '<span class="dim">（空）</span>';
  let h = '';
  list.forEach((it, i) => {
    h += '<div class="circ-sig"><span class="csig">' + ITEMS[it.sig]?.name + '</span> × <b>' + it.count + '</b>' +
      ' <button data-action="c-del" data-ch="' + (it._ch || 'red') + '" data-idx="' + i + '">✕</button></div>';
  });
  return h;
}
function signalAddRow(ch, e) {
  return '<div class="circ-add">' +
    '<input type="text" id="' + ch + '-sig" class="circ-siginv" placeholder="输入物品名" autocomplete="off">' +
    '<input type="number" id="' + ch + '-cnt" class="circ-cnt" value="1" min="-99999" max="99999">' +
    '<button data-action="c-add" data-ch="' + ch + '">添加</button></div>';
}
function constantPanelLive(e, api) {
  api.set('c-red-list', constantSignalListHtml(e.output.red));
  api.set('c-green-list', constantSignalListHtml(e.output.green));
  api.status('输出 ' + (e.output.red.length) + ' 个红信号 / ' + (e.output.green.length) + ' 个绿信号', 'ok');
}
function constantPanelAction(action, el) {
  const e = G.panelEnt;
  if (action === 'c-add') {
    const ch = el.dataset.ch;
    const sigEl = document.getElementById(ch + '-sig');
    const cntEl = document.getElementById(ch + '-cnt');
    const query = (sigEl ? sigEl.value : '').trim().toLowerCase();
    const sig = resolveSignalName(query);
    if (!sig) { toast('找不到该物品信号'); return true; }
    const count = Math.floor(Number(cntEl.value)) || 1;
    const list = ch === 'green' ? e.output.green : e.output.red;
    list.push({ sig, count });
    sigEl.value = '';
    uiDirty = true;
    return true;
  } else if (action === 'c-del') {
    const ch = el.dataset.ch;
    const idx = Number(el.dataset.idx);
    const list = ch === 'green' ? e.output.green : e.output.red;
    if (list[idx]) list.splice(idx, 1);
    uiDirty = true;
    return true;
  }
  return false;
}
const constantPanel = {
  html: constantPanelHtml,
  live: constantPanelLive,
  onAction: constantPanelAction,
  tip: e => '常量组合器：输出固定信号到电路网络'
};

// ===== 面板：运算组合器 =====
function arithPanelHtml(e) {
  let h = row('类型', '运算组合器 · 读信号做运算', 'kind');
  h += '<div class="sec">运算设置</div>';
  h += '<div class="circ-add">' +
    '<input type="text" id="a-a" class="circ-siginv" value="' + signalDisplayName(e.aSig) + '" placeholder="信号A" autocomplete="off" list="vsig-list">' +
    '<select id="a-op" class="circ-op">' + ['+', '-', '*', '/'].map(o => '<option value="' + o + '"' + (e.op === o ? ' selected' : '') + '>' + o + '</option>').join('') + '</select>' +
    '<select id="a-btype" class="circ-btype">' +
      '<option value="const"' + (e.useConst ? ' selected' : '') + '>常量</option>' +
      '<option value="sig"' + (!e.useConst ? ' selected' : '') + '>信号</option>' +
    '</select>' +
    (e.useConst
      ? '<input type="number" id="a-bconst" class="circ-cnt" value="' + e.bConst + '" min="-99999" max="99999">'
      : '<input type="text" id="a-bsig" class="circ-siginv" value="' + signalDisplayName(e.bSig) + '" placeholder="信号B" autocomplete="off" list="vsig-list">') +
    '</div>';
  h += '<div class="circ-add">' +
    '输出信号 <input type="text" id="a-out" class="circ-siginv" value="' + signalDisplayName(e.outSig) + '" placeholder="输出信号" autocomplete="off" list="vsig-list">' +
    '到 <select id="a-ch" class="circ-op">' + channelSelect(e.channel) + '</select>' +
    '<button data-action="a-apply">应用</button></div>';
  h += '<datalist id="vsig-list">' + vsigOptionsHtml() + '</datalist>';
  h += '<div class="status"></div>';
  h += '<div class="dim">信号A可为「每个信号」：对每个输入信号逐个运算并以原信号名输出；或「全部信号」：全部输入求和后单信号输出。÷ 为整除。</div>';
  return h;
}
function vsigOptionsHtml() {
  let h = '';
  for (const k in VIRTUAL_SIGNALS) h += '<option value="' + VIRTUAL_SIGNALS[k] + '"></option>';
  return h;
}
// 信号显示名：虚拟信号显示中文名，物品显示物品名，否则显示原 id
function signalDisplayName(sig) {
  if (!sig) return '';
  if (isVirtualSignal(sig)) return VIRTUAL_SIGNALS[sig] || sig;
  return (ITEMS[sig] && ITEMS[sig].name) || sig;
}
function channelSelect(cur) {
  return '<option value="red"' + (cur === 'red' ? ' selected' : '') + '>红线</option>' +
    '<option value="green"' + (cur === 'green' ? ' selected' : '') + '>绿线</option>';
}
function arithPanelLive(e, api) {
  api.status('输出 ' + signalDisplayName(e.outSig) + ' = 信号A ' + e.op + ' ' + (e.useConst ? e.bConst : signalDisplayName(e.bSig)) + ' → ' + (e.channel === 'green' ? '绿线' : '红线'), 'ok');
}
function arithPanelAction(action, el) {
  const e = G.panelEnt;
  if (action === 'a-apply') {
    const a = resolveSignalName(document.getElementById('a-a').value);
    const op = document.getElementById('a-op').value;
    const useConst = document.getElementById('a-btype').value === 'const';
    let bConst = 0, bSig = null;
    if (useConst) bConst = Math.floor(Number(document.getElementById('a-bconst').value)) || 0;
    else bSig = resolveSignalName(document.getElementById('a-bsig').value) || 'iron-plate';
    const outSig = resolveSignalName(document.getElementById('a-out').value) || 'signal-count';
    const channel = document.getElementById('a-ch').value;
    e.aSig = a; e.op = op; e.useConst = useConst; e.bConst = bConst; e.bSig = bSig;
    e.outSig = outSig; e.channel = channel;
    uiDirty = true;
    return true;
  }
  return false;
}
const arithPanel = {
  html: arithPanelHtml,
  live: arithPanelLive,
  onAction: arithPanelAction,
  tip: e => '运算组合器：信号做 + − × ÷ 运算'
};

// ===== 面板：判断组合器 =====
function deciderPanelHtml(e) {
  let h = row('类型', '判断组合器 · 条件判断输出', 'kind');
  h += '<div class="sec">条件设置</div>';
  h += '<div class="circ-add">' +
    '<input type="text" id="d-a" class="circ-siginv" value="' + signalDisplayName(e.aSig) + '" placeholder="信号A" autocomplete="off" list="vsig-list">' +
    '<select id="d-op" class="circ-op">' + ['>', '<', '=', '!=', '>=', '<='].map(o => '<option value="' + o + '"' + (e.op === o ? ' selected' : '') + '>' + o + '</option>').join('') + '</select>' +
    '<select id="d-btype" class="circ-btype">' +
      '<option value="const"' + (e.useConst ? ' selected' : '') + '>常量</option>' +
      '<option value="sig"' + (!e.useConst ? ' selected' : '') + '>信号</option>' +
    '</select>' +
    (e.useConst
      ? '<input type="number" id="d-bconst" class="circ-cnt" value="' + e.bConst + '" min="-99999" max="99999">'
      : '<input type="text" id="d-bsig" class="circ-siginv" value="' + signalDisplayName(e.bSig) + '" placeholder="信号B" autocomplete="off" list="vsig-list">') +
    '</div>';
  h += '<div class="circ-add">' +
    '满足时输出 <input type="text" id="d-out" class="circ-siginv" value="' + signalDisplayName(e.outSig) + '" placeholder="输出信号" autocomplete="off" list="vsig-list">' +
    ' × <input type="number" id="d-cnt" class="circ-cnt" value="' + e.outCount + '" min="0" max="99999">' +
    ' 到 <select id="d-ch" class="circ-op">' + channelSelect(e.channel) + '</select>' +
    '<button data-action="d-apply">应用</button></div>';
  h += '<div class="circ-add"><label><input type="checkbox" id="d-copy"' + (e.copyFrom ? ' checked' : '') + '> 复制信号A原值输出（而非固定值）</label></div>';
  h += '<div class="status"></div>';
  h += '<div class="dim">信号A可为「每个信号」：对所有输入逐个判断、满足的以原信号名输出；「全部信号」：全部满足才输出；「任一信号」：任一个满足即输出。可用作批量过滤/阈值开关。</div>';
  return h;
}
function deciderPanelLive(e, api) {
  api.status('条件 ' + signalDisplayName(e.aSig) + ' ' + e.op + ' ' + (e.useConst ? e.bConst : signalDisplayName(e.bSig)) + ' → 输出' + (e.copyFrom ? ' 复制' : (' ' + signalDisplayName(e.outSig) + '×' + e.outCount)) + ' → ' + (e.channel === 'green' ? '绿线' : '红线'), 'ok');
}
function deciderPanelAction(action, el) {
  const e = G.panelEnt;
  if (action === 'd-apply') {
    e.aSig = resolveSignalName(document.getElementById('d-a').value);
    e.op = document.getElementById('d-op').value;
    e.useConst = document.getElementById('d-btype').value === 'const';
    if (e.useConst) { e.bConst = Math.floor(Number(document.getElementById('d-bconst').value)) || 0; e.bSig = null; }
    else e.bSig = resolveSignalName(document.getElementById('d-bsig').value) || 'iron-plate';
    e.outSig = resolveSignalName(document.getElementById('d-out').value) || 'signal-count';
    e.outCount = Math.floor(Number(document.getElementById('d-cnt').value)) || 1;
    e.channel = document.getElementById('d-ch').value;
    e.copyFrom = document.getElementById('d-copy').checked;
    uiDirty = true;
    return true;
  }
  return false;
}
const deciderPanel = {
  html: deciderPanelHtml,
  live: deciderPanelLive,
  onAction: deciderPanelAction,
  tip: e => '判断组合器：条件判断输出'
};

// 把用户输入（物品名或 id / 虚拟信号）解析为信号名（物品 id 或虚拟信号 id）
function resolveSignalName(text) {
  const q = (text || '').trim().toLowerCase();
  if (!q) return null;
  // 虚拟信号（signal-each/everything/anything/count 等，对齐《异星工厂》Virtual signals）
  if (isVirtualSignal(q)) return q;
  for (const vs in VIRTUAL_SIGNALS) {
    if ((VIRTUAL_SIGNALS[vs] || '').toLowerCase() === q || (VIRTUAL_SIGNALS[vs] || '').toLowerCase().includes(q)) return vs;
  }
  // 精确 id 或名称匹配
  for (const id in ITEMS) {
    if (id.toLowerCase() === q || (ITEMS[id].name || '').toLowerCase() === q) return id;
  }
  // 模糊：名称包含
  for (const id in ITEMS) {
    if ((ITEMS[id].name || '').toLowerCase().includes(q)) return id;
  }
  return null;
}

// ===== 注册 =====
ENT_CLASSES['small-electric-pole'] = CircuitNode;
ENT_CLASSES['medium-electric-pole'] = CircuitNode;
ENT_CLASSES['big-electric-pole'] = CircuitNode;
DEVICE_RENDER['small-electric-pole'] = drawCircuitPole;
DEVICE_RENDER['medium-electric-pole'] = drawCircuitPole;
DEVICE_RENDER['big-electric-pole'] = drawCircuitPole;
DEVICE_STATUS['small-electric-pole'] = e => (e.red && e.red.size) ? 'g' : 'y';
DEVICE_STATUS['medium-electric-pole'] = e => (e.red && e.red.size) ? 'g' : 'y';
DEVICE_STATUS['big-electric-pole'] = e => (e.red && e.red.size) ? 'g' : 'y';

ENT_CLASSES['constant-combinator'] = ConstantCombinator;
ENT_CLASSES['arithmetic-combinator'] = ArithmeticCombinator;
ENT_CLASSES['decider-combinator'] = DeciderCombinator;
DEVICE_RENDER['constant-combinator'] = drawCombinator;
DEVICE_RENDER['arithmetic-combinator'] = drawCombinator;
DEVICE_RENDER['decider-combinator'] = drawCombinator;
DEVICE_STATUS['constant-combinator'] = e => Object.keys(e.netRed).length + Object.keys(e.netGreen).length ? 'g' : 'y';
DEVICE_STATUS['arithmetic-combinator'] = e => Object.keys(e.netRed).length ? 'g' : 'y';
DEVICE_STATUS['decider-combinator'] = e => Object.keys(e.netGreen).length ? 'g' : 'y';
DEVICE_PANEL['constant-combinator'] = constantPanel;
DEVICE_PANEL['arithmetic-combinator'] = arithPanel;
DEVICE_PANEL['decider-combinator'] = deciderPanel;

// ===== 红/绿电路线缆（对齐《异星工厂》Red/Green wire）=====
// 手持红/绿线缆点击电路设备，切换其接入通道（red/green/both），实现红绿信号物理隔离。
function isCircuitNodeEntity(e) { return !!(e && (e instanceof CircuitNode)); }
// 手持线缆点击节点：同色再点切回双通，异色则切换为该色通道
function applyWireToNode(e, wireColor) {
  if (!isCircuitNodeEntity(e)) return false;
  if (wireColor === 'red') e.wireChan = (e.wireChan === 'red') ? 'both' : 'red';
  else e.wireChan = (e.wireChan === 'green') ? 'both' : 'green';
  if (typeof recomputeCircuit === 'function') recomputeCircuit();
  if (typeof renderPanel === 'function' && G && G.panelEnt === e) renderPanel(false);
  return true;
}
function wireToolSelected() {
  const it = (typeof selItem === 'function') ? selItem() : null;
  return (it === 'red-wire' || it === 'green-wire') ? it : null;
}

// ===== 电路信号读取辅助 =====
// 供其它设备（如流体泵）读取某实体周围电路网络的红/绿信号。
// 返回 { red:{}, green:{} }；若无可读取的节点则返回 null。
function circuitSignalNear(e) {
  const nodes = getCachedCircuitNodes();
  let best = null, bestD = 1e9;
  for (const n of nodes) {
    if (n._dead) continue;
    const d = Math.max(Math.abs(n.cx() - (e.x + e.w / 2)), Math.abs(n.cy() - (e.y + e.h / 2)));
    if (d <= 2 && d < bestD) { bestD = d; best = n; }
  }
  if (!best) return null;
  return { red: best.netRed || {}, green: best.netGreen || {} };
}

// 通用电路启用条件判定：cond = { channel:'red'|'green', sig, op, count, enabled }
// 返回 true 表示允许运行。
function circuitCondOk(signal, cond) {
  if (!cond || !cond.enabled) return true;
  const net = signal ? signal[cond.channel === 'green' ? 'green' : 'red'] : null;
  const val = net ? (net[cond.sig] || 0) : 0;
  const b = cond.count || 0;
  switch (cond.op) {
    case '>': return val > b;
    case '<': return val < b;
    case '=': return val === b;
    case '!=': return val !== b;
    case '>=': return val >= b;
    case '<=': return val <= b;
  }
  return true;
}
