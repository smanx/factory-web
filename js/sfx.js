'use strict';
// =============================================================
// 音效引擎（零依赖，Web Audio API 程序化合成）
// 《异星工厂》风格的工业感音效：建造、拆除、维修、合成、科研、
// 采矿、射击、爆炸、火箭、告警、UI 点击等。
// 不依赖任何外部音频文件，全部由振荡器 + 噪声实时合成。
// 通过 playSfx(name) 全局调用；设置项 G.settings.sound 开关音量。
// =============================================================

// ---- 音频上下文（惰性创建，浏览器要求用户手势后才能播放）----
let AC = null;
let sfxMaster = null;
let sfxNoiseBuf = null;
let sfxReady = false;
let sfxBound = false;   // 是否已绑定首次用户手势解锁
let sfxActiveNodes = 0; // 当前同时在播的音效节点数（用于限流防过载）
let sfxMaxNodes = 18;   // 同时播放上限：防止读档/进场首帧节点堆积压垮音频上下文
let sfxSettleUntil = 0; // 读档进场后的“静默缓冲”截止时间戳（performance.now() 毫秒）
let sfxLastPlayT = {};  // 各音效名最近一次播放时间（毫秒），用于重复音效节流

// 读档/进场后进入静默缓冲：在缓冲窗口内不排程任何音效，只确保解锁音频，
// 让恢复的大量实体产生的首帧声音被静默过滤，杜绝“爆音”与上下文过载。
function sfxWarmup(ms) {
  ms = (typeof ms === 'number' && ms > 0) ? ms : 400;
  const t = typeof performance !== 'undefined' ? performance.now() : Date.now();
  sfxSettleUntil = Math.max(sfxSettleUntil, t + ms);
}

// 是否处于静默缓冲窗口（读档进场首帧）
function sfxInSettle() {
  const t = typeof performance !== 'undefined' ? performance.now() : Date.now();
  return t < sfxSettleUntil;
}

// 程序化音效定义表
const SFX = {
  // 建造：短促低频“嗒”
  build: { type: 'square', dur: 0.09, f0: 200, f1: 90, vol: 0.22, slide: true },
  // 拆除：带噪声的碎裂声
  demolish: { type: 'noise', dur: 0.18, vol: 0.3, f0: 1200, f1: 400, slide: true },
  // 维修：金属“叮”光效
  repair: { type: 'square', dur: 0.12, f0: 880, f1: 1320, vol: 0.18, slide: true },
  // 手搓合成完成：清脆上滑音
  craft: { type: 'sine', dur: 0.16, f0: 520, f1: 780, vol: 0.2, slide: true },
  // 科研完成：小号角上行琶音
  research: { type: 'sawtooth', dur: 0.55, f0: 392, f1: 784, vol: 0.22, slide: true, arpeggio: [392, 523, 659, 784] },
  // 采矿：细碎敲击
  mine: { type: 'noise', dur: 0.06, vol: 0.14, f0: 1800, f1: 1200, slide: true },
  // 射击（步枪/冲锋枪）：短促爆裂
  shoot: { type: 'square', dur: 0.06, f0: 220, f1: 60, vol: 0.24, slide: true },
  // 霰弹枪：更厚重的齐射
  shotgun: { type: 'noise', dur: 0.14, vol: 0.3, f0: 900, f1: 200, slide: true },
  // 爆炸：大范围低频轰鸣
  explosion: { type: 'noise', dur: 0.7, vol: 0.42, f0: 300, f1: 40, slide: true },
  // 火箭发射：长啸冲天
  rocket: { type: 'sawtooth', dur: 1.4, f0: 120, f1: 720, vol: 0.3, slide: true },
  // 告警/错误：低沉拒绝声
  deny: { type: 'square', dur: 0.16, f0: 180, f1: 140, vol: 0.18, slide: true },
  // UI 点击：极短滴答
  click: { type: 'sine', dur: 0.04, f0: 1200, f1: 900, vol: 0.1, slide: true },
  // 物品选中/拾取
  select: { type: 'sine', dur: 0.07, f0: 660, f1: 990, vol: 0.14, slide: true },
  // 机械臂动作
  inserter: { type: 'triangle', dur: 0.08, f0: 260, f1: 320, vol: 0.08, slide: true },
  // 分流器分流物品：轻柔机械“咔嗒”（快速分流器，节流播放避免噪杂）
  splitter: { type: 'triangle', dur: 0.05, f0: 380, f1: 300, vol: 0.07, slide: true },
  // 胜利号角（火箭成功发射后的庆祝音）
  victory: { type: 'sine', dur: 1.6, f0: 523, f1: 1046, vol: 0.25, arpeggio: [523, 659, 784, 1046, 784, 1046], slide: true },
  // 流体泵：短促“咕噜”液流声
  pump: { type: 'noise', dur: 0.12, vol: 0.12, f0: 700, f1: 300, slide: true },
  // 机器人飞行：轻快嗡鸣上滑
  robot: { type: 'sine', dur: 0.18, f0: 900, f1: 1400, vol: 0.1, slide: true },
  // 功率开关切换：清脆“咔哒”
  'power-switch': { type: 'square', dur: 0.07, f0: 420, f1: 300, vol: 0.18, slide: true },
  // 手雷/投掷物投掷：轻巧抛掷“嗖”
  throw: { type: 'triangle', dur: 0.2, f0: 600, f1: 200, vol: 0.14, slide: true },
  // 蒸汽/锅炉排气：柔和的低频气声
  steam: { type: 'noise', dur: 0.3, vol: 0.1, f0: 500, f1: 200, slide: true },
  // 虫群进攻波次警报：低沉压抑的号角（警示玩家布防）
  wave: { type: 'sawtooth', dur: 0.9, vol: 0.2, f0: 110, f1: 82, slide: true, arpeggio: [110, 98, 82] },
  // 火车鸣笛：拉长的“呜——”
  train: { type: 'sawtooth', dur: 1.2, vol: 0.22, f0: 392, f1: 494, slide: true, arpeggio: [392, 466, 392] },
  // 激光炮塔开火：短促尖啸“滋”
  laser: { type: 'square', dur: 0.09, vol: 0.16, f0: 1500, f1: 600, slide: true },
  // 放电防御：短促高频电击“噼啪”
  discharge: { type: 'noise', dur: 0.25, vol: 0.32, f0: 2600, f1: 500, slide: true },
  // 火焰喷射/火焰塔：低频“呼——轰”
  flamethrower: { type: 'noise', dur: 0.5, vol: 0.2, f0: 400, f1: 80, slide: true },
  // 机枪连发：短促连续爆裂（冲锋枪/机枪塔）
  'machine-gun': { type: 'square', dur: 0.05, vol: 0.18, f0: 260, f1: 120, slide: true },
  // 车辆引擎怠速/行驶：低频轰鸣（可循环）
  engine: { type: 'sawtooth', dur: 0.5, vol: 0.12, f0: 60, f1: 80, slide: true },
  // 投掷物/胶囊部署：短促“嗖—嗒”
  deploy: { type: 'triangle', dur: 0.18, f0: 700, f1: 300, slide: true },
  // 炮塔旋转/装弹：金属“咔”
  turret: { type: 'square', dur: 0.07, f0: 480, f1: 360, slide: true },
  // 流体桶装配/倒空：液体灌装/倾倒的“咕咚”
  barrel: { type: 'noise', dur: 0.22, vol: 0.16, f0: 420, f1: 160, slide: true },
  // 装备/穿戴（护甲、机器人港等）：金属“咔嗒”上滑
  equip: { type: 'square', dur: 0.12, f0: 320, f1: 560, vol: 0.2, slide: true },
  // 拆解/脱卸：短促下滑
  unequip: { type: 'square', dur: 0.1, f0: 520, f1: 300, vol: 0.16, slide: true },
  // 能量护盾吸收：短促高频“嗡”闪光（对齐《异星工厂》能量护盾受击音）
  shield: { type: 'triangle', dur: 0.14, f0: 1400, f1: 600, vol: 0.2, slide: true },
  // 吃鱼回血：清爽“咕嘟”水声（对齐《异星工厂》吃鱼治疗音）
  fish: { type: 'sine', dur: 0.3, f0: 500, f1: 300, vol: 0.16, slide: true, arpeggio: [500, 400, 300] },
  // 蓝图复制/粘贴：清脆的电子“嗡—嘀”（对齐《异星工厂》蓝图操作的科技感）
  blueprint: { type: 'triangle', dur: 0.24, f0: 880, f1: 1320, vol: 0.16, slide: true, arpeggio: [880, 1100, 1320] },
  // 敌人死亡/拾取战利品：短促“叮”一声（对齐《异星工厂》击杀反馈）
  loot: { type: 'square', dur: 0.09, f0: 1560, f1: 2080, vol: 0.14, slide: true },
  // 污染激怒虫群：低沉压抑的警报号角（比波次警报更沉闷、更具压迫感）
  pollution: { type: 'sawtooth', dur: 1.1, vol: 0.24, f0: 98, f1: 65, slide: true, arpeggio: [98, 82, 65, 82] },
  // 物品拾取（地面掉落物/F 拿取）：清脆“叮”上滑
  pickup: { type: 'sine', dur: 0.09, f0: 880, f1: 1320, vol: 0.16, slide: true },
  // 模块安装：金属“咔嗒”
  module: { type: 'square', dur: 0.08, f0: 420, f1: 640, vol: 0.18, slide: true },
  // 火箭部件装配：厚重“哐”+ 上行提示
  'rocket-part': { type: 'square', dur: 0.16, f0: 160, f1: 240, vol: 0.22, slide: true },
  // 施工机器人建成：轻盈“叮”
  'robot-build': { type: 'sine', dur: 0.14, f0: 660, f1: 990, vol: 0.16, slide: true },
  // 地雷部署：短促“嗒”
  landmine: { type: 'triangle', dur: 0.06, f0: 500, f1: 300, vol: 0.16, slide: true },
  // 炮兵/炮兵车厢开火：远程重炮“轰”
  artillery: { type: 'noise', dur: 0.6, vol: 0.3, f0: 200, f1: 40, slide: true },
  // 铁路链式信号灯切换：清脆“咔哒”
  'chain-signal': { type: 'square', dur: 0.06, f0: 560, f1: 420, vol: 0.14, slide: true },
  // 地面火焰燃烧：低频“噼啪”烈焰（火焰炮塔/喷射器/火球残留火场）
  burn: { type: 'noise', dur: 0.25, vol: 0.16, f0: 600, f1: 140, slide: true },
  // 虫巢扩张：低频阴森的“咕涌”声（对齐《异星工厂》Biter expansion 的可感知反馈）
  spawn: { type: 'sawtooth', dur: 0.6, vol: 0.2, f0: 130, f1: 70, slide: true, arpeggio: [130, 110, 90, 70] },
  // 玩家行走脚步：短促柔软踩踏声
  step: { type: 'noise', dur: 0.07, vol: 0.12, f0: 350, f1: 220, slide: true },
  // 组装机/采矿机持续运转：低频“嗡嗡”工业运转声
  'machine-run': { type: 'sawtooth', dur: 0.6, vol: 0.05, f0: 90, f1: 120, slide: true },
  // 坦克重炮开火：厚重“轰”重炮声（区别于普通火箭筒）
  'tank-cannon': { type: 'noise', dur: 0.5, vol: 0.32, f0: 120, f1: 35, slide: true },
  // 爆炸炮弹开火：比普通重炮更低沉浑厚、带低频轰鸣（对齐《异星工厂》爆炸炮弹的沉重发射感）
  'tank-cannon-explosive': { type: 'noise', dur: 0.7, vol: 0.4, f0: 90, f1: 30, slide: true }
};

function sfxInit() {
  if (sfxReady) return;
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) { sfxReady = false; return; }
    AC = new Ctx();
    // 主增益节点（总音量控制）
    sfxMaster = AC.createGain();
    sfxMaster.gain.value = 0.8;
    sfxMaster.connect(AC.destination);
    // 预生成白噪声 buffer（供噪声型音效采样）
    const len = AC.sampleRate * 1.0;
    sfxNoiseBuf = AC.createBuffer(1, len, AC.sampleRate);
    const d = sfxNoiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    sfxReady = true;
  } catch (e) {
    sfxReady = false;
  }
}

// 恢复被浏览器挂起的音频上下文（用户手势后调用）
function sfxResume() {
  if (AC && AC.state === 'suspended') { try { AC.resume(); } catch (e) {} }
}

// 首次用户手势时解锁音频（一次性）：读档等异步流程结束后 AudioContext
// 常处于 suspended 状态，靠用户再次交互才真正运行；此处确保一旦交互即恢复。
function sfxBindGesture() {
  if (sfxBound) return;
  sfxBound = true;
  const unlock = function () {
    sfxResume();
    window.removeEventListener('pointerdown', unlock);
    window.removeEventListener('keydown', unlock);
    window.removeEventListener('click', unlock);
  };
  window.addEventListener('pointerdown', unlock);
  window.addEventListener('keydown', unlock);
  window.addEventListener('click', unlock);
}

// 噪声源：对预生成白噪声做带通滤波，制造“咔哒/爆炸/碎裂”质感
function noiseSrc() {
  const src = AC.createBufferSource();
  src.buffer = sfxNoiseBuf;
  const filter = AC.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 1.2;
  src.connect(filter);
  return { src, filter };
}

// 奏一段滑音（freq f0→f1）
function tone(osc, type, t0, f0, f1, dur, vol, g) {
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(20, f0), t0);
  if (f1 !== f0) osc.frequency.linearRampToValueAtTime(Math.max(20, f1), t0 + dur);
  const gGain = AC.createGain();
  // 包络：快速起音 + 指数衰减（工业“哒/哔”质感）
  gGain.gain.setValueAtTime(0.0001, t0);
  gGain.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  gGain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(gGain);
  gGain.connect(g);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// 核心合成函数
function sfxPlay(name) {
  if (!sfxReady || !AC || !sfxMaster) return;
  if (!(G && G.settings && G.settings.sound)) return;   // 音效开关
  // 读档/进场静默缓冲窗口内不排程音效（只确保解锁），
  // 过滤掉恢复实体在首帧产生的大量重复/堆叠声音，从根本上杜绝“爆音”。
  if (sfxInSettle()) { sfxResume(); return; }
  // 音频上下文处于 suspended 时 AC.currentTime 冻结在旧值：此时若照常排程，
  // 读档/进场首帧的大量音效会全挤在同一时间戳，恢复后齐响造成“爆音”，
  // 且节点堆积会压垮上下文导致后续音效全部失效。因此挂起期间只尝试恢复、不排程。
  if (AC.state !== 'running') { sfxResume(); return; }
  // 同时播放节点数达上限时丢弃本次音效，防止上下文过载导致后续音效全部失效。
  if (sfxActiveNodes >= sfxMaxNodes) return;
  // 同一音效的节流：限制高频重复音效（机器运转/蒸汽等）的触发频率，避免刷音。
  const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
  if (sfxLastPlayT[name] && nowMs - sfxLastPlayT[name] < 40) return;
  sfxLastPlayT[name] = nowMs;

  const sp = SFX[name];
  if (!sp) return;
  const now = AC.currentTime;
  const vol = sp.vol * ((G.settings.soundVol != null ? G.settings.soundVol : 1));
  const out = AC.createGain();
  out.gain.value = 1;
  out.connect(sfxMaster);
  sfxActiveNodes++;
  const rel = function () { if (sfxActiveNodes > 0) sfxActiveNodes--; };

  // 噪声型音效
  if (sp.type === 'noise') {
    const n = noiseSrc();
    const dur = sp.dur, t0 = now;
    n.filter.frequency.setValueAtTime(sp.f0, t0);
    if (sp.slide) n.filter.frequency.linearRampToValueAtTime(sp.f1, t0 + dur);
    n.filter.Q.value = 1;
    const gGain = AC.createGain();
    gGain.gain.setValueAtTime(vol, t0);
    gGain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    n.src.connect(gGain);
    gGain.connect(out);
    n.src.start(t0);
    n.src.stop(t0 + dur + 0.02);
    n.src.onended = rel;
    return;
  }

  // 琶音型音效（科研/胜利等旋律）
  if (sp.arpeggio) {
    const dur = Math.max(0.5, sp.dur);
    const step = dur / Math.max(1, sp.arpeggio.length);
    let cnt = sp.arpeggio.length;
    const relArp = function () { cnt--; if (cnt <= 0) rel(); };
    sp.arpeggio.forEach((f, i) => {
      const osc = AC.createOscillator();
      const t0 = now + i * step;
      // 每个音单独小包络，最后叠加主滑音
      const gGain = AC.createGain();
      gGain.gain.setValueAtTime(0.0001, t0);
      gGain.gain.exponentialRampToValueAtTime(vol * 0.7, t0 + 0.02);
      gGain.gain.exponentialRampToValueAtTime(0.0001, t0 + step * 0.9);
      osc.type = sp.type;
      osc.frequency.setValueAtTime(f, t0);
      osc.connect(gGain);
      gGain.connect(out);
      osc.start(t0);
      osc.stop(t0 + step);
      osc.onended = relArp;
    });
    return;
  }

  // 常规滑音振荡器
  const osc = AC.createOscillator();
  tone(osc, sp.type, now, sp.f0, sp.slide ? sp.f1 : sp.f0, sp.dur, vol, out);
  osc.onended = rel;
}

// 对外统一入口：playSfx('build') → 立即播放对应音效
function playSfx(name) {
  // 音效开关关闭时不初始化/不播放（省资源，也避免无音频设备环境报错）
  if (!G || !G.settings || !G.settings.sound) return;
  if (!SFX[name]) return;
  sfxInit();          // 惰性初始化（首次播放时）
  sfxBindGesture();  // 确保挂起的上下文能在下一次用户手势时被解锁
  sfxPlay(name);
}

// 供主循环每帧调用，用于在玩家手势后确保音频已解锁
function sfxUpdate() {
  if (AC && AC.state === 'suspended') return;
  if (!sfxReady && AC) sfxReady = true;
}

// =============================================================
// 环境氛围音（Web Audio 昼夜背景音，画面氛围优化）
// 在游戏过程中叠加一层极低音量的环境底噪，随昼夜周期变化：
//   白昼：轻工业嗡鸣 + 偶尔鸟鸣，营造繁忙工厂的生机
//   夜晚：静谧的虫鸣与低缓风声，营造野外静谧感
// 全部程序化合成，零依赖；音量受主音效开关与音量滑块控制，极低开销。
// =============================================================
let ambNodes = null;          // 环境节点 { drone, filter, noise, g }（惰性创建）
let ambAccentT = 0;           // 环境点缀音计时器

function ambientPhase() {
  if (typeof solarFactor !== 'function') return { light: 0.5 };
  const f = solarFactor();
  // f：0=深夜，1=正午。转成 0(夜)~1(昼) 连续亮度
  return { light: f, phase: ((G.time / (DAY_CYCLE || 60)) % 1 + 1) % 1 };
}

// 惰性创建环境节点（首次需要时；用户手势后浏览器允许音频）
function ambientEnsure() {
  if (!G || !G.settings || !G.settings.sound || !sfxReady || !AC || !sfxMaster) return false;
  if (ambNodes) return true;
  try {
    const g = AC.createGain();
    g.gain.value = 0;
    g.connect(sfxMaster);
    // 白天工业嗡鸣：两个轻微失谐的方波振荡器，低通后叠加
    const drone = AC.createOscillator();
    drone.type = 'sine';
    drone.frequency.value = 55;
    const drone2 = AC.createOscillator();
    drone2.type = 'sine';
    drone2.frequency.value = 55.5;
    const droneG = AC.createGain();
    droneG.gain.value = 0.12;
    const droneF = AC.createBiquadFilter();
    droneF.type = 'lowpass';
    droneF.frequency.value = 400;
    drone.connect(droneG); drone2.connect(droneG);
    droneG.connect(droneF);
    droneF.connect(g);
    drone.start(); drone2.start();
    // 环境风声/底噪：白噪声 → 低通 → 慢速 LFO 呼吸
    const noise = AC.createBufferSource();
    noise.buffer = sfxNoiseBuf;
    noise.loop = true;
    const nF = AC.createBiquadFilter();
    nF.type = 'lowpass';
    nF.frequency.value = 600;
    const nG = AC.createGain();
    nG.gain.value = 0.05;
    const lfo = AC.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoG = AC.createGain();
    lfoG.gain.value = 0.03;
    lfo.connect(lfoG); lfoG.connect(nG.gain);
    noise.connect(nF); nF.connect(nG); nG.connect(g);
    noise.start(); lfo.start();
    ambNodes = { g, drone, drone2, noise, nF, nG, lfo };
    return true;
  } catch (e) {
    ambNodes = null;
    return false;
  }
}

// 播放一次环境点缀音（鸟鸣/虫鸣），由 ambientUpdate 按昼夜节奏触发
function ambientAccent(light) {
  if (!AC || !sfxMaster) return;
  if (AC.state !== 'running') return;   // 挂起时 AC.currentTime 冻结，避免同一时间戳堆积爆音
  if (sfxInSettle()) return;            // 读档进场静默缓冲期内不触发点缀音
  const now = AC.currentTime;
  const out = AC.createGain();
  out.gain.value = 1;
  out.connect(sfxMaster);
  const vol = ((G.settings.soundVol != null ? G.settings.soundVol : 1)) * (light > 0.4 ? 0.05 : 0.035);
  if (light > 0.4) {
    // 鸟鸣：两个短促上滑的清脆啁啾
    for (const shift of [0, 0.09]) {
      const osc = AC.createOscillator();
      osc.type = 'sine';
      const t0 = now + shift;
      const gGain = AC.createGain();
      gGain.gain.setValueAtTime(0.0001, t0);
      gGain.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
      gGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.12);
      const base = 2000 + Math.random() * 1500;
      osc.frequency.setValueAtTime(base, t0);
      osc.frequency.exponentialRampToValueAtTime(base * 1.6, t0 + 0.06);
      osc.connect(gGain); gGain.connect(out);
      osc.start(t0); osc.stop(t0 + 0.15);
    }
  } else {
    // 虫鸣：高亢断续的短促鸣叫
    for (let i = 0; i < 3; i++) {
      const t0 = now + i * 0.07;
      const osc = AC.createOscillator();
      osc.type = 'sine';
      const gGain = AC.createGain();
      gGain.gain.setValueAtTime(0.0001, t0);
      gGain.gain.exponentialRampToValueAtTime(vol * 0.8, t0 + 0.01);
      gGain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.1);
      osc.frequency.setValueAtTime(4400 + Math.random() * 400, t0);
      osc.connect(gGain); gGain.connect(out);
      osc.start(t0); osc.stop(t0 + 0.12);
    }
  }
}

// 每帧推进环境音：随昼夜调节音量/滤波，并间歇触发点缀音。
function ambientUpdate(dt) {
  if (!G || !G.settings || !G.settings.sound) { if (ambNodes) { try { ambNodes.g.gain.value = 0; } catch (e) {} } return; }
  // 仅在音频上下文已就绪并运行时推进：读档/进场首帧上下文常处于 suspended，
  // 此时 AC.currentTime 冻结，若强行创建环境节点会造成爆音，故等待解锁后再启用。
  if (!AC || !sfxReady || AC.state !== 'running' || sfxInSettle()) {
    sfxResume();
    sfxBindGesture();
    if (!AC || !sfxReady) sfxInit();
    return;
  }
  if (!ambientEnsure()) return;
  const { light } = ambientPhase();
  // 目标音量：白天略高、夜晚略低（整体很低，不喧宾夺主）
  const baseVol = (G.settings.soundVol != null ? G.settings.soundVol : 1);
  const target = (0.05 + 0.04 * light) * baseVol;
  const cur = ambNodes.g.gain.value;
  ambNodes.g.gain.value = cur + (target - cur) * Math.min(1, dt * 2);
  // 风声低通滤波随昼夜变化（夜晚更低沉）
  ambNodes.nF.frequency.value = 400 + light * 700;
  // 点缀音节奏
  ambAccentT -= dt;
  if (ambAccentT <= 0) {
    ambAccentT = (light > 0.4 ? 8 : 4) + Math.random() * 6;
    ambientAccent(light);
  }
}

// =============================================================
// 背景音乐（BGM）系统：程序化合成一段工业氛围的循环配乐。
// 零外部音频文件，全部由 Web Audio 实时合成。
// 由 G.settings.music 独立开关控制（与游戏音效 sound 分开）。
// 随 G.settings.soundVol 音量滑块调节整体音量，音乐音量更低、不喧宾夺主。
// =============================================================
let bgmNodes = null;   // { g, noteIdx, barT }

// 背景音乐是否启用（独立开关，默认开启）
function bgmEnabled() {
  return !!(G && G.settings && G.settings.music !== false);
}

// 配乐音阶（A 小调五声音阶，带工业氛围）：以 A4=440 为基准的降频音高
const BGM_SCALE = [220.00, 246.94, 261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25];
// 旋律片段（音阶下标，-1=休止），循环播放
const BGM_MELODY = [0, 2, 3, 2, 4, 3, 2, 1, 0, 2, 4, 5, 4, 3, 2, 1, 3, 5, 6, 5, 4, 3, 4, 2, 0, 1, 2, 1, 0, -1, 0, -1];
// 低音走位（每音符一个根音，作低音声部）
const BGM_BASS = [0, 0, 1, 1, 0, 0, 2, 1, 0, 0, 1, 1, 2, 2, 1, 1, 0, 0, 1, 1, 2, 2, 1, 1, 0, 0, 1, 1, 0, 0, -1, 0];
const BGM_NOTE_DUR = 0.30;   // 每音符时长（秒）

// 惰性创建 BGM 输出节点
function bgmEnsure() {
  if (!AC || !sfxReady || !sfxMaster) return false;
  if (bgmNodes) return true;
  try {
    const g = AC.createGain();
    g.gain.value = 0;
    g.connect(sfxMaster);
    bgmNodes = { g, noteIdx: 0, barT: 0 };
    return true;
  } catch (e) { bgmNodes = null; return false; }
}

// 播放单个 BGM 音符（旋律或低音）
function bgmNote(noteIdx, dur, vol, type, bass) {
  if (noteIdx < 0) return;   // 休止符
  if (!AC || !bgmNodes || !bgmNodes.g) return;
  const now = AC.currentTime;
  const gGain = AC.createGain();
  const v = vol * ((G.settings.soundVol != null ? G.settings.soundVol : 1));
  gGain.gain.setValueAtTime(0.0001, now);
  gGain.gain.exponentialRampToValueAtTime(v, now + 0.03);
  gGain.gain.exponentialRampToValueAtTime(0.0001, now + dur);
  const osc = AC.createOscillator();
  osc.type = type;
  const base = bass ? (BGM_SCALE[noteIdx % 4] / 2) : BGM_SCALE[noteIdx % BGM_SCALE.length];
  osc.frequency.setValueAtTime(base, now);
  osc.connect(gGain);
  gGain.connect(bgmNodes.g);
  osc.start(now);
  osc.stop(now + dur + 0.02);
}

// 推进背景音乐（主循环每帧调用）
function bgmUpdate(dt) {
  if (!bgmEnabled()) {
    if (bgmNodes) { try { bgmNodes.g.gain.value = 0; } catch (e) {} }
    return;
  }
  if (!AC || !sfxReady || AC.state !== 'running') {
    sfxResume(); sfxBindGesture();
    if (!AC || !sfxReady) sfxInit();
    return;
  }
  if (!bgmEnsure()) return;
  const target = ((G.settings.soundVol != null ? G.settings.soundVol : 1)) * 0.12;
  bgmNodes.g.gain.value += (target - bgmNodes.g.gain.value) * Math.min(1, dt * 2);
  bgmNodes.barT += dt;
  if (bgmNodes.barT >= BGM_NOTE_DUR) {
    bgmNodes.barT -= BGM_NOTE_DUR;
    const idx = bgmNodes.noteIdx % BGM_MELODY.length;
    bgmNote(BGM_MELODY[idx], BGM_NOTE_DUR * 1.25, 0.05, 'triangle', false);
    bgmNote(BGM_BASS[idx], BGM_NOTE_DUR * 1.15, 0.06, 'sawtooth', true);
    bgmNodes.noteIdx++;
  }
}
