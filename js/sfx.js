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
  steam: { type: 'noise', dur: 0.3, vol: 0.1, f0: 500, f1: 200, slide: true }
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
  sfxResume();
  const sp = SFX[name];
  if (!sp) return;
  const now = AC.currentTime;
  const vol = sp.vol * ((G.settings.soundVol != null ? G.settings.soundVol : 1));
  const out = AC.createGain();
  out.gain.value = 1;
  out.connect(sfxMaster);

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
    return;
  }

  // 琶音型音效（科研/胜利等旋律）
  if (sp.arpeggio) {
    const dur = Math.max(0.5, sp.dur);
    const step = dur / Math.max(1, sp.arpeggio.length);
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
    });
    return;
  }

  // 常规滑音振荡器
  const osc = AC.createOscillator();
  tone(osc, sp.type, now, sp.f0, sp.slide ? sp.f1 : sp.f0, sp.dur, vol, out);
}

// 对外统一入口：playSfx('build') → 立即播放对应音效
function playSfx(name) {
  // 音效开关关闭时不初始化/不播放（省资源，也避免无音频设备环境报错）
  if (!G || !G.settings || !G.settings.sound) return;
  if (!SFX[name]) return;
  sfxInit();          // 惰性初始化（首次播放时）
  sfxPlay(name);
}

// 供主循环每帧调用，用于在玩家手势后确保音频已解锁
function sfxUpdate() {
  if (AC && AC.state === 'suspended') return;
  if (!sfxReady && AC) sfxReady = true;
}
