'use strict';

// ===== 成就系统（对齐《异星工厂》Achievements）=====
// 在游戏中达成里程碑（手搓 / 建造 / 研究 / 击杀 / 发射火箭等）自动解锁成就。
// 成就在游戏内面板（顶部菜单 🏆 按钮）与开始菜单均可查看。
//
// 追踪数据存于 G.achStats，随存档持久化；新游戏时清零。

// 成就定义：{ id, name, desc, icon, check }
//  check(ctx) 返回布尔值，true 即解锁。ctx 为触发事件时传入的上下文。
//  为避免每帧全量检查，成就在触发事件时按需判定，并把已解锁 id 记入 G.achUnlocked。
const ACHIEVEMENTS = [
  {
    id: 'first-craft', name: '全新开始', icon: '🔧',
    desc: '手动合成出第一个物品',
    check() { return G.achStats.crafts >= 1; }
  },
  {
    id: 'first-mine', name: '采矿新手', icon: '⛏️',
    desc: '手动开采出第一块矿石',
    check() { return G.achStats.mined >= 1; }
  },
  {
    id: 'first-build', name: '工程师', icon: '🏗️',
    desc: '建造出第一台机器',
    check() { return G.achStats.builds >= 1; }
  },
  {
    id: 'first-tech', name: '科研入门', icon: '🔬',
    desc: '完成第一项科技研究',
    check() { return G.achStats.researched >= 1; }
  },
  {
    id: 'automated', name: '自动化', icon: '⚙️',
    desc: '研究「自动化」科技',
    check() { return !!G.techDone.automation; }
  },
  {
    id: 'logistics', name: '物流起步', icon: '🚚',
    desc: '研究「物流学」科技',
    check() { return !!G.techDone.logistics; }
  },
  {
    id: 'electric', name: '电气时代', icon: '⚡',
    desc: '研究「电力工程」科技',
    check() { return !!G.techDone.electric; }
  },
  {
    id: 'steel', name: '炼钢', icon: '🏭',
    desc: '研究「炼钢科技」',
    check() { return !!G.techDone['steel-processing']; }
  },
  {
    id: 'oil', name: '黑色黄金', icon: '🛢️',
    desc: '研究「石油冶金」科技',
    check() { return !!G.techDone.oil; }
  },
  {
    id: 'iron-throne', name: '铁王座', icon: '🔩',
    desc: '累计生产 20000 块铁板',
    check() { return (G.achStats.produced['iron-plate'] || 0) >= 20000; }
  },
  {
    id: 'steel-throne', name: '钢之脊梁', icon: '⚒️',
    desc: '累计生产 5000 块钢板',
    check() { return (G.achStats.produced['steel-plate'] || 0) >= 5000; }
  },
  {
    id: 'pollution', name: '它也讨厌这味道', icon: '💨',
    desc: '污染值达到 500（激怒虫群）',
    check() { return (G.pollution || 0) >= 500; }
  },
  {
    id: 'kill-50', name: '老兵', icon: '🎯',
    desc: '击杀 50 个敌人',
    check() { return G.achStats.kills >= 50; }
  },
  {
    id: 'kill-500', name: '杀戮机器', icon: '☠️',
    desc: '击杀 500 个敌人',
    check() { return G.achStats.kills >= 500; }
  },
  {
    id: 'railway', name: '铺设轨道', icon: '🚆',
    desc: '研究「铁路技术」科技',
    check() { return !!G.techDone.railways; }
  },
  {
    id: 'logistics-network', name: '物流网络', icon: '📦',
    desc: '研究「物流网络」科技',
    check() { return !!G.techDone['logistics-network']; }
  },
  {
    id: 'robotics', name: '机器人革命', icon: '🤖',
    desc: '使用物流机器人完成一次搬运',
    check() { return G.achStats.robotDeliveries >= 1; }
  },
  {
    id: 'circuit', name: '电路大师', icon: '🔌',
    desc: '研究「电路网络」科技',
    check() { return !!G.techDone['circuit-network']; }
  },
  {
    id: 'nuclear', name: '核能时代', icon: '☢️',
    desc: '研究核能相关科技（铀富集或铀弹）',
    check() { return !!(G.techDone['kovarex-enrichment'] || G.techDone['uranium-ammo']); }
  },
  {
    id: 'atomic', name: '终极武器', icon: '💣',
    desc: '研究「原子弹科技」',
    check() { return !!G.techDone['atomic-bomb']; }
  },
  {
    id: 'advanced-combat', name: '军火库', icon: '🔫',
    desc: '研究「高级战斗」科技',
    check() { return !!G.techDone['advanced-combat']; }
  },
  {
    id: 'blueprint', name: '蓝图规划师', icon: '📐',
    desc: '保存第一份蓝图到蓝图库',
    check() { return !!(G.blueBook && G.blueBook.some(Boolean)); }
  },
  {
    id: 'train-schedule', name: '铁路调度', icon: '🚂',
    desc: '为列车设置自动调度路线',
    check() { return G.achStats.trainRoutes >= 1; }
  },
  {
    id: 'rocket', name: '冲向星辰', icon: '🚀',
    desc: '发射火箭，赢得游戏',
    check() { return !!G.gameWon; }
  },
  {
    id: 'perfectionist', name: '完美主义', icon: '🏆',
    desc: '研究全部非无限科技',
    check() { return achAllTechDone(); }
  },
  {
    id: 'power-armor-mk2', name: '终极动力', icon: '🛡️',
    desc: '研究「强力装甲 II」科技',
    check() { return !!G.techDone['armor-power-mk2']; }
  },
  {
    id: 'space', name: '空间科学', icon: '🛰️',
    desc: '发射卫星获得空间科学包',
    check() { return (G.achStats.produced['space-science-pack'] || 0) >= 1; }
  }
];

// 全部非无限科技是否已研究完毕
function achAllTechDone() {
  if (!G.techDone) return false;
  for (const tid in TECHS) {
    if (!TECHS[tid]) continue;
    if (TECHS[tid].infinite) continue;          // 跳过无限科技
    if (!G.techDone[tid]) return false;
  }
  return true;
}

// 初始化成就状态（新游戏时调用）
function achInitStats() {
  G.achUnlocked = new Set();   // 已解锁成就 id
  G.achStats = {
    crafts: 0,        // 手搓完成的件数
    mined: 0,         // 手动开采次数
    builds: 0,        // 建造机器数
    researched: 0,    // 完成科技数
    kills: 0,         // 击杀敌人数
    robotDeliveries: 0, // 物流机器人完成搬运次数
    trainRoutes: 0,   // 列车调度路线数
    produced: {}      // item -> 累计生产量
  };
}

// 兼容：确保状态已初始化（读档/旧档兜底）
function achEnsureStats() {
  if (!G.achUnlocked) G.achUnlocked = new Set();
  if (!G.achStats) {
    G.achStats = {
      crafts: 0, mined: 0, builds: 0, researched: 0, kills: 0,
      robotDeliveries: 0, trainRoutes: 0, produced: {}
    };
  }
  if (!G.achStats.produced) G.achStats.produced = {};
}

// 记录累计生产量（由 trackProd 增量累加正向产出；负向(消耗)不计入）
function achTrackProduced(item, delta) {
  achEnsureStats();
  if (delta > 0) G.achStats.produced[item] = (G.achStats.produced[item] || 0) + delta;
  checkAchievements();
}

// 核心：对所有成就做一次性判定，解锁新达成的并提示。
// 为避免高频调用全量遍历，本函数 O(n)，n=成就数量（~27，极小），
// 仅在事件触发点调用（手搓/建造/研究/击杀/发射等），非每帧。
function checkAchievements() {
  achEnsureStats();
  let unlocked = false;
  for (const a of ACHIEVEMENTS) {
    if (G.achUnlocked.has(a.id)) continue;
    let ok = false;
    try { ok = !!a.check(); }
    catch (e) { ok = false; }
    if (ok) {
      G.achUnlocked.add(a.id);
      unlocked = true;
      if (typeof toast === 'function') toast('🏆 成就解锁：' + a.name);
      if (typeof playSfx === 'function') playSfx('research');
      uiDirty = true;
    }
  }
  return unlocked;
}

// ===== 序列化 / 恢复（随存档持久化）=====
function achievementsSerialize() {
  achEnsureStats();
  return {
    unlocked: Array.from(G.achUnlocked),
    stats: {
      crafts: G.achStats.crafts, mined: G.achStats.mined, builds: G.achStats.builds,
      researched: G.achStats.researched, kills: G.achStats.kills,
      robotDeliveries: G.achStats.robotDeliveries, trainRoutes: G.achStats.trainRoutes,
      produced: Object.assign({}, G.achStats.produced)
    }
  };
}
function achievementsRestore(d) {
  achEnsureStats();
  G.achUnlocked = new Set(Array.isArray(d && d.unlocked) ? d.unlocked : []);
  const s = (d && d.stats) || {};
  G.achStats.crafts = s.crafts | 0;
  G.achStats.mined = s.mined | 0;
  G.achStats.builds = s.builds | 0;
  G.achStats.researched = s.researched | 0;
  G.achStats.kills = s.kills | 0;
  G.achStats.robotDeliveries = s.robotDeliveries | 0;
  G.achStats.trainRoutes = s.trainRoutes | 0;
  G.achStats.produced = {};
  if (s.produced && typeof s.produced === 'object') {
    for (const k in s.produced) if (ITEMS[k]) G.achStats.produced[k] = s.produced[k] | 0;
  }
}

// ===== 成就面板 HTML =====
function htmlAchievements() {
  achEnsureStats();
  const unlockedCount = G.achUnlocked.size;
  const total = ACHIEVEMENTS.length;
  let h = '<div class="sec">成就（' + unlockedCount + ' / ' + total + '）<span class="dim">达成里程碑自动解锁，随存档保存</span></div>';
  h += '<div class="ach-progress"><div class="ach-progress-bar" style="width:' + (total ? (unlockedCount / total * 100).toFixed(1) : 0) + '%"></div></div>';
  h += '<div class="ach-list">';
  for (const a of ACHIEVEMENTS) {
    const done = G.achUnlocked.has(a.id);
    h += '<div class="ach-item' + (done ? ' done' : ' locked') + '">';
    h += '<div class="ach-icon">' + (done ? a.icon : '🔒') + '</div>';
    h += '<div class="ach-info">';
    h += '<div class="ach-name">' + a.name + '</div>';
    h += '<div class="ach-desc">' + a.desc + '</div>';
    h += '</div>';
    h += '</div>';
  }
  h += '</div>';
  return h;
}
