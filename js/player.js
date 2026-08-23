'use strict';

function playerSpeed() { return 140 * ((G.dbg && G.dbg.moveSpeed) || 1); }

function makePlayer(tx, ty) {
  return {
    x: tx * TILE + TILE / 2,
    y: ty * TILE + TILE / 2,
    dir: 2,
    mining: null,
    mineProg: 0,
    walkT: 0
  };
}

function solidAtPx(px, py) {
  const tx = Math.floor(px / TILE), ty = Math.floor(py / TILE);
  return isWater(tx, ty);
}

function boxBlocked(cx, cy, r) {
  return solidAtPx(cx - r, cy - r) || solidAtPx(cx + r, cy - r) ||
         solidAtPx(cx - r, cy + r) || solidAtPx(cx + r, cy + r);
}

function updatePlayer(dt) {
  const p = G.player;
  let mx = 0, my = 0;
  if (G.keys['w'] || G.keys['arrowup']) my -= 1;
  if (G.keys['s'] || G.keys['arrowdown']) my += 1;
  if (G.keys['a'] || G.keys['arrowleft']) mx -= 1;
  if (G.keys['d'] || G.keys['arrowright']) mx += 1;
  const len = Math.hypot(mx, my);
  if (len > 0) {
    mx /= len; my /= len;
    p.walkT += dt * 10;
    if (Math.abs(mx) > Math.abs(my)) p.dir = mx > 0 ? 0 : 2;
    else p.dir = my > 0 ? 1 : 3;
    const r = 9;
    const sp = playerSpeed();
    const nx = p.x + mx * sp * dt;
    if (!boxBlocked(nx, p.y, r)) p.x = nx;
    const ny = p.y + my * sp * dt;
    if (!boxBlocked(p.x, ny, r)) p.y = ny;
  }
}

function withinReach(tx, ty) {
  const p = G.player;
  return Math.hypot(tx * TILE + TILE / 2 - p.x, ty * TILE + TILE / 2 - p.y) <= REACH_PX;
}

function invAdd(id, n = 1) {
  G.inv.set(id, (G.inv.get(id) || 0) + n);
  uiDirty = true;
}

function invCount(id) { return G.inv.get(id) || 0; }

function selItem() { return G.sel >= 0 ? (HOTBAR[G.sel] || null) : (G.quickSel || null); }
function buildActive() { return G.sel >= 0 || !!G.quickSel; }

function invTake(id, n = 1) {
  const c = invCount(id);
  if (c < n) return false;
  if (c - n <= 0) G.inv.delete(id); else G.inv.set(id, c - n);
  uiDirty = true;
  return true;
}

function canCraft(rid) {
  const rec = RECIPES[rid];
  for (const k in rec.inp) if (invCount(k) < rec.inp[k]) return false;
  return true;
}

function doCraft(rid, times = 1) {
  if (isChemRecipe(rid)) return 0;
  let made = 0;
  for (let i = 0; i < times; i++) {
    if (!canCraft(rid)) break;
    for (const k in RECIPES[rid].inp) invTake(k, RECIPES[rid].inp[k]);
    for (const k in RECIPES[rid].out) invAdd(k, RECIPES[rid].out[k]);
    made++;
  }
  uiDirty = true;
  return made;
}

function updateMining(dt) {
  const p = G.player;
  if (!G.mouseDown || buildActive() || !G.canvasActive) { p.mining = null; p.mineProg = 0; return; }
  const t = G.cursorTile;
  if (!t) { p.mining = null; p.mineProg = 0; return; }
  const key = t.tx + ',' + t.ty;
  if (p.mining !== key) { p.mining = key; p.mineProg = 0; }
  if (!withinReach(t.tx, t.ty)) { p.mineProg = 0; return; }
  const ti = getOreType(t.tx, t.ty);
  if (ti >= 0 && ti < ORES.length && getOreAmt(t.tx, t.ty) > 0) {
    p.mineProg += dt * ((G.dbg && G.dbg.mineMult) || 1) / HAND_MINE_TIME;
    if (p.mineProg >= 1) {
      p.mineProg -= 1;
      if (!G.settings.infiniteOre) consumeOre(t.tx, t.ty);
      invAdd(ORES[ti]);
    }
  } else {
    p.mineProg = 0;
  }
}

function findSpawn() {
  let best = null, bestD = Infinity;
  const R = 22;
  for (let ty = -R; ty < R; ty++)
    for (let tx = -R; tx < R; tx++) {
      if (getTerrain(tx, ty) !== T_GRASS) continue;
      if (getOreType(tx, ty) !== ORES.indexOf('iron-ore')) continue;
      if (isWater(tx + 1, ty) || isWater(tx - 1, ty) || isWater(tx, ty + 1) || isWater(tx, ty - 1)) continue;
      const d = Math.hypot(tx, ty);
      if (d < bestD) { bestD = d; best = [tx, ty]; }
    }
  if (!best) best = [4, 4];
  return best;
}
