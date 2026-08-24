'use strict';
// ===== 钓鱼与生鱼（对齐《异星工厂》：水域边缘钓鱼，钓到生鱼） =====
// 玩家站在水域旁，点击/轻触水面即可下钩。抛竿需短暂等待，然后随机钓得生鱼。
// 生鱼可作为低效燃料（见 data.js isBurnerFuel / fuelEnergy）。

let FISH_COOLDOWN = 0;   // 钓鱼冷却（秒），避免连点刷鱼
const FISH_WAIT = 0.8;   // 每次抛竿等待时长（秒）
const FISH_CD = 0.6;     // 两次钓鱼之间的最小间隔（秒）

// 每帧更新冷却
function updateFishing(dt) {
  if (FISH_COOLDOWN > 0) FISH_COOLDOWN -= dt;
}

// 玩家是否位于某水域格旁（该格为水，且玩家在相邻可达的陆地上）
function canFishAt(tx, ty) {
  if (!isWater(tx, ty)) return false;
  // 玩家要站在水域相邻的格子
  const px = Math.floor(G.player.x / TILE);
  const py = Math.floor(G.player.y / TILE);
  const dx = Math.abs(px - tx), dy = Math.abs(py - ty);
  return (dx + dy === 1) || (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
}

// 尝试钓鱼：在 (tx,ty) 水域下钩。返回是否成功。
function tryFishAt(tx, ty) {
  if (!isWater(tx, ty)) return false;
  if (FISH_COOLDOWN > 0) {
    if (typeof toast === 'function') toast('鱼还没上钩，稍等片刻…');
    return true;  // 已消费点击，避免误走
  }
  if (!withinReach(tx, ty)) return false;
  if (!canFishAt(tx, ty)) {
    if (typeof toast === 'function') toast('请站到水域旁钓鱼');
    return true;
  }
  // 抛竿
  FISH_COOLDOWN = FISH_CD;
  if (typeof toast === 'function') toast('🎣 抛竿中…');
  // 随机钓得生鱼（有时空竿）
  setTimeout(() => {
    if (Math.random() < 0.75) {
      invAdd('raw-fish', 1);
      if (typeof toast === 'function') toast('🐟 钓到生鱼 +1');
    } else {
      if (typeof toast === 'function') toast('~ 鱼跑了');
    }
  }, FISH_WAIT * 1000);
  return true;
}
