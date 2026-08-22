'use strict';

let W = 0, H = 0;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  W = window.innerWidth; H = window.innerHeight;
  G.canvas.width = W * dpr;
  G.canvas.height = H * dpr;
  G.canvas.style.width = W + 'px';
  G.canvas.style.height = H + 'px';
  G.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function updateCamera(dt) {
  const cam = G.cam;
  const txp = G.player.x - TILE / 2;
  const typ = G.player.y - TILE / 2;
  cam.px += (txp - cam.px) * Math.min(1, dt * 8);
  cam.py += (typ - cam.py) * Math.min(1, dt * 8);
}

function screenToWorld(sx, sy) {
  return [(sx - W / 2) / G.cam.z + G.cam.px, (sy - H / 2) / G.cam.z + G.cam.py];
}

function render() {
  const ctx = G.ctx;
  ctx.fillStyle = '#151a14';
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(G.cam.z, G.cam.z);
  ctx.translate(-G.cam.px, -G.cam.py);
  drawTerrain(ctx);
  drawGridIfBuilding(ctx);
  for (const e of G.ents) {
    if (!onScreen(e)) continue;
    drawEntity(ctx, e, e.x, e.y, e.dir, 1);
  }
  drawGhost(ctx);
  drawHoverAndMining(ctx);
  drawPlayer(ctx);
  ctx.restore();
}

function viewBounds() {
  const hw = (W / 2) / G.cam.z, hh = (H / 2) / G.cam.z;
  return {
    x0: G.cam.px + hw, y0: G.cam.py + hh,
    x1: G.cam.px - hw, y1: G.cam.py - hh
  };
}

function onScreen(e) {
  const b = viewBounds();
  return e.x * TILE < b.x0 + TILE && (e.x + e.w) * TILE > b.x1 &&
         e.y * TILE < b.y0 + TILE && (e.y + e.h) * TILE > b.y1;
}

function drawTerrain(ctx) {
  const b = viewBounds();
  const tx0 = Math.max(0, Math.floor(b.x1 / TILE));
  const ty0 = Math.max(0, Math.floor(b.y1 / TILE));
  const tx1 = Math.min(WORLD_W - 1, Math.ceil(b.x0 / TILE));
  const ty1 = Math.min(WORLD_H - 1, Math.ceil(b.y0 / TILE));
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const idx = tileIdx(tx, ty);
      const px = tx * TILE, py = ty * TILE;
      if (G.world.terrain[idx] === T_WATER) {
        ctx.fillStyle = hash2(tx, ty) > 0.5 ? '#265d8a' : '#28618f';
        ctx.fillRect(px, py, TILE, TILE);
        continue;
      }
      const v = hash2(tx, ty);
      ctx.fillStyle = v > 0.62 ? '#4f7c3b' : v > 0.3 ? '#4a7538' : '#456f35';
      ctx.fillRect(px, py, TILE, TILE);
      const ti = G.world.oreType[idx];
      if (ti >= 0) drawOreDots(ctx, px, py, ORES[ti], G.world.oreAmt[idx], tx, ty);
    }
  }
}

function drawOreDots(ctx, px, py, itemId, amt, tx, ty) {
  const n = Math.max(2, Math.min(7, Math.round(Math.sqrt(Math.max(amt, 0)) / 9)));
  ctx.fillStyle = ITEMS[itemId].color;
  ctx.strokeStyle = 'rgba(0,0,0,.25)';
  ctx.lineWidth = 1;
  for (let i = 0; i < n; i++) {
    const ox = hash2(tx * 13 + i, ty * 71 - i);
    const oy = hash2(tx * 29 - i, ty * 17 + i);
    const r = 2 + hash2(tx + i, ty + i) * 1.4;
    ctx.beginPath();
    ctx.arc(px + 5 + ox * (TILE - 10), py + 5 + oy * (TILE - 10), r, 0, 7);
    ctx.fill();
    ctx.stroke();
  }
}

function drawGridIfBuilding(ctx) {
  if (G.sel < 0 && !G.panelEnt) return;
  const b = viewBounds();
  const tx0 = Math.max(0, Math.floor(b.x1 / TILE));
  const ty0 = Math.max(0, Math.floor(b.y1 / TILE));
  const tx1 = Math.min(WORLD_W - 1, Math.ceil(b.x0 / TILE));
  const ty1 = Math.min(WORLD_H - 1, Math.ceil(b.y0 / TILE));
  ctx.strokeStyle = 'rgba(255,255,255,.07)';
  ctx.lineWidth = 1 / G.cam.z;
  ctx.beginPath();
  for (let tx = tx0; tx <= tx1 + 1; tx++) { ctx.moveTo(tx * TILE, ty0 * TILE); ctx.lineTo(tx * TILE, (ty1 + 1) * TILE); }
  for (let ty = ty0; ty <= ty1 + 1; ty++) { ctx.moveTo(tx0 * TILE, ty * TILE); ctx.lineTo((tx1 + 1) * TILE, ty * TILE); }
  ctx.stroke();
}

function tileCenterPx(tx, ty) { return [tx * TILE + TILE / 2, ty * TILE + TILE / 2]; }

function dirIndexOf(dx, dy) {
  for (let i = 0; i < 4; i++) if (DX[i] === dx && DY[i] === dy) return i;
  return -1;
}

function beltInputSide(e) {
  const fdx = DX[e.dir], fdy = DY[e.dir];
  const sides = [[fdy, -fdx], [-fdy, fdx]];
  for (const [sx, sy] of sides) {
    const nb = entAt(e.x + sx, e.y + sy);
    if (!nb) continue;
    const want = dirIndexOf(-sx, -sy);
    if (nb instanceof Underground && nb.dir === want) return [sx, sy];
    if (nb instanceof Belt && nb.dir === want) return [sx, sy];
  }
  return null;
}

function drawBelt(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  const inp = beltInputSide(e);
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#3a3f47';
  ctx.strokeStyle = '#22252a';
  ctx.lineWidth = 2;

  function strip(angle, x0, len) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(angle);
    rr(ctx, x0, -9, len, 18, 4);
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  const step = TILE / 2;
  const off = ((G.time * beltSpeed() * TILE) % step + step) % step;

  strip(dir * Math.PI / 2, -TILE / 2 + 2, TILE - 4);
  if (inp) strip(Math.atan2(inp[1], inp[0]), 0, step);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(dir * Math.PI / 2);
  ctx.beginPath();
  ctx.rect(-TILE / 2 + 3, -TILE / 2 + 3, TILE - 6, TILE - 6);
  ctx.clip();
  ctx.fillStyle = 'rgba(224,178,60,.85)';
  for (let k = -1; k <= 2; k++) {
    const xx = -step + k * step + off;
    tri(ctx, xx - 3, -5, xx - 3, 5, xx + 3, 0);
    ctx.fill();
  }
  ctx.restore();

  if (inp) {
    const sa = Math.atan2(inp[1], inp[0]);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(sa);
    ctx.beginPath();
    ctx.rect(0, -TILE / 2 + 3, step, TILE - 6);
    ctx.clip();
    ctx.fillStyle = 'rgba(224,178,60,.85)';
    for (let k = 0; k <= 2; k++) {
      const xx = k * step - off;
      if (xx < -3 || xx > step + 3) continue;
      tri(ctx, xx + 3, -5, xx + 3, 5, xx - 3, 0);
      ctx.fill();
    }
    ctx.restore();
  }

  const exitX = DX[dir] * step, exitY = DY[dir] * step;
  let inX = cx, inY = cy;
  if (inp) { inX = cx + inp[0] * step; inY = cy + inp[1] * step; }
  for (const o of e.items) {
    let ix, iy;
    if (inp && o.pos < 0.5) {
      const t = o.pos / 0.5;
      ix = inX + (cx - inX) * t;
      iy = inY + (cy - inY) * t;
    } else if (inp) {
      const t = (o.pos - 0.5) / 0.5;
      ix = cx + exitX * t;
      iy = cy + exitY * t;
    } else {
      ix = cx + DX[dir] * (o.pos - 0.5) * TILE;
      iy = cy + DY[dir] * (o.pos - 0.5) * TILE;
    }
    drawItemDot(ctx, ix, iy, o.item);
  }
  ctx.globalAlpha = 1;
}

function drawItemDot(ctx, x, y, item, r = 5) {
  const it = ITEMS[item];
  ctx.fillStyle = '#20242b';
  rr(ctx, x - r, y - r, r * 2, r * 2, r * 0.55);
  ctx.fill();
  ctx.strokeStyle = it.color;
  ctx.lineWidth = Math.max(1, r * 0.16);
  ctx.stroke();
  ctx.save();
  rr(ctx, x - r * 0.82, y - r * 0.82, r * 1.64, r * 1.64, r * 0.42);
  ctx.clip();
  drawItemGlyph(ctx, item, x, y, r * 1.85);
  ctx.restore();
}

function drawDrill(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * 2;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#6e4630';
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 8);
  ctx.fill();
  ctx.strokeStyle = '#43291b';
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 8);
  ctx.stroke();
  ctx.fillStyle = '#8a5a3e';
  rr(ctx, px + 10, py + 10, s - 20, s - 20, 5);
  ctx.fill();
  const cx = px + s / 2, cy = py + s / 2 - 4;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(e.spin || 0);
  ctx.fillStyle = e.working ? '#c9d2dc' : '#7d8894';
  gearShape(ctx, 0, 0, 13, 8.5, 7);
  ctx.fill();
  ctx.restore();
  const pct = Math.min(1, (e.prog || 0) / DRILL_TIME);
  if (pct > 0 && e.working) {
    ctx.strokeStyle = 'rgba(143,224,143,.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(cx, cy, 19, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = dirColorNotch(dir);
  for (const m of [-11, 11]) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(dir * Math.PI / 2);
    ctx.translate(s / 2 - 12, m);
    tri(ctx, 0, -4, 0, 4, 8, 0);
    ctx.fill();
    ctx.restore();
  }
  const fuelPct = Math.min(1, e.burnLeft / COAL_ENERGY);
  ctx.fillStyle = '#20242b';
  rr(ctx, px + 10, py + s - 12, s - 20, 5, 2); ctx.fill();
  ctx.fillStyle = fuelPct > 0 ? '#e8762c' : '#c33';
  rr(ctx, px + 10, py + s - 12, (s - 20) * fuelPct, 5, 2); ctx.fill();
  if (e.status) {
    ctx.fillStyle = '#ffd23c';
    ctx.fillRect(px + s - 14, py + 8, 5, 5);
  }
  ctx.globalAlpha = 1;
}

function drawFurnace(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * 2;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#8b8577';
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 8); ctx.fill();
  ctx.strokeStyle = '#57524a';
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 8); ctx.stroke();
  ctx.fillStyle = '#6d6759';
  rr(ctx, px + 9, py + 9, s - 18, 12, 3); ctx.fill();
  if (e.lit) {
    const fl = 0.55 + Math.sin(G.time * 12 + px) * 0.2;
    ctx.fillStyle = 'rgba(232,118,44,' + (fl * 0.35).toFixed(2) + ')';
    rr(ctx, px + 9, py + 9, s - 18, 12, 3); ctx.fill();
  }
  ctx.fillStyle = '#3a3630';
  rr(ctx, px + s * 0.24, py + s * 0.42, s * 0.52, s * 0.36, 6); ctx.fill();
  if (e.lit) {
    const fl = 0.65 + Math.sin(G.time * 12 + px) * 0.25;
    ctx.fillStyle = 'rgba(232,118,44,' + fl.toFixed(2) + ')';
    rr(ctx, px + s * 0.27, py + s * 0.45, s * 0.46, s * 0.30, 4); ctx.fill();
    ctx.fillStyle = 'rgba(255,210,60,' + (fl * 0.7).toFixed(2) + ')';
    rr(ctx, px + s * 0.32, py + s * 0.54, s * 0.36, s * 0.16, 3); ctx.fill();
  }
  if (e.cur && e.prog > 0) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(Math.floor(e.prog * 100) + '%', px + s / 2, py + 15);
  }
  const fuelPct = Math.min(1, e.burnLeft / COAL_ENERGY);
  ctx.fillStyle = '#20242b';
  rr(ctx, px + 10, py + s - 12, s - 20, 5, 2); ctx.fill();
  ctx.fillStyle = fuelPct > 0 ? '#e8762c' : '#c33';
  rr(ctx, px + 10, py + s - 12, (s - 20) * fuelPct, 5, 2); ctx.fill();
  ctx.globalAlpha = 1;
}

function drawAssembler(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * 2;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#4d5f8f';
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 7); ctx.fill();
  ctx.strokeStyle = '#2e3a5c';
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 7); ctx.stroke();
  ctx.fillStyle = '#3a486e';
  rr(ctx, px + 10, py + 10, s - 20, s - 20, 5); ctx.fill();
  ctx.save();
  ctx.translate(px + s / 2, py + s / 2);
  ctx.rotate(e.crafting ? e.spin : 0);
  ctx.fillStyle = e.crafting ? '#cdd6ea' : '#8b98bd';
  gearShape(ctx, 0, 0, 18, 12, 8);
  ctx.fill();
  ctx.restore();
  if (e.recipe) {
    const outId = Object.keys(RECIPES[e.recipe].out)[0];
    drawItemDotBig(ctx, px + s / 2, py + s / 2, outId);
    const pct = e.crafting ? Math.min(1, e.prog / RECIPES[e.recipe].time) : 0;
    if (pct > 0) {
      ctx.strokeStyle = '#8fe08f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px + s / 2, py + s / 2, 24, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('无配方', px + s / 2, py + s / 2 + 30);
  }
  ctx.globalAlpha = 1;
}

function drawItemDotBig(ctx, x, y, item) {
  drawItemDot(ctx, x, y, item, 7);
}

function drawChest(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#7c5c39';
  rr(ctx, px + 4, py + 8, TILE - 8, TILE - 13, 3); ctx.fill();
  ctx.fillStyle = '#95734a';
  rr(ctx, px + 4, py + 5, TILE - 8, 10, 3); ctx.fill();
  ctx.strokeStyle = '#4c371f';
  ctx.lineWidth = 1.5;
  rr(ctx, px + 4, py + 8, TILE - 8, TILE - 13, 3); ctx.stroke();
  ctx.fillStyle = '#e0c56e';
  ctx.fillRect(px + TILE / 2 - 2, py + 12, 4, 6);
  ctx.globalAlpha = 1;
}

function drawLab(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * 2;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#37807a';
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 7); ctx.fill();
  ctx.strokeStyle = '#1e4a46';
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 7); ctx.stroke();
  ctx.fillStyle = '#245c57';
  rr(ctx, px + 10, py + 10, s - 20, s - 20, 5); ctx.fill();
  ctx.fillStyle = e.active ? '#8ff0e0' : '#4a8f86';
  ctx.beginPath();
  ctx.arc(px + s / 2, py + s / 2, 12, 0, 7);
  ctx.fill();
  if (e.active) {
    const bb = Math.sin(G.time * 8 + px) * 3;
    ctx.fillStyle = 'rgba(255,255,255,.7)';
    ctx.beginPath();
    ctx.arc(px + s / 2 - 4, py + s / 2 - 4 + bb, 2.5, 0, 7);
    ctx.arc(px + s / 2 + 5, py + s / 2 - 2 - bb, 2, 0, 7);
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('研究院', px + s / 2, py + s - 14);
  ctx.globalAlpha = 1;
}

function drawInserter(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#3c4048';
  ctx.beginPath(); ctx.arc(cx, cy, 9, 0, 7); ctx.fill();
  ctx.strokeStyle = '#22252a';
  ctx.lineWidth = 2;
  ctx.stroke();
  const long = e.type === 'long-inserter';
  const len = e.holding ? (long ? TILE * 2.02 : TILE * 1.06) : (long ? TILE * 1.55 : TILE * 0.82);
  const ang = e.armAng !== undefined ? e.armAng : ((dir + 2) % 4) * Math.PI / 2;
  const tipx = cx + Math.cos(ang) * len;
  const tipy = cy + Math.sin(ang) * len;
  ctx.strokeStyle = e.holding ? '#ffe066' : long ? '#e08a4a' : '#b9bec8';
  ctx.lineWidth = long ? 5 : 4;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(cx, cy);
  ctx.lineTo(tipx, tipy);
  ctx.stroke();
  ctx.lineCap = 'butt';
  if (e.holding) drawItemDot(ctx, tipx, tipy, e.holding, 4);
  ctx.fillStyle = dirColorNotch(dir);
  notch(ctx, px, py, dir);
  ctx.globalAlpha = 1;
}

function lerpAngle(a, b, t) {
  let d = ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
  return a + d * t;
}

function dirColorNotch(dir) {
  return ['#d05548', '#d0a048', '#48a8d0', '#68c860'][dir];
}

function notch(ctx, px, py, dir) {
  const cx = px + TILE / 2, cy = py + TILE / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(dir * Math.PI / 2);
  ctx.beginPath();
  ctx.moveTo(TILE / 2 - 8, -5);
  ctx.lineTo(TILE / 2 - 2, 0);
  ctx.lineTo(TILE / 2 - 8, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawSplitter(ctx, e, gx, gy, dir, alpha) {
  ctx.globalAlpha = alpha;
  const cx = (gx + e.w / 2) * TILE, cy = (gy + e.h / 2) * TILE;
  const across = (dir % 2 === 1 ? e.w : e.h) * TILE;
  const running = e.items.length > 0;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(dir * Math.PI / 2);
  ctx.fillStyle = '#4a4436';
  rr(ctx, -TILE / 2 + 2, -across / 2 + 2, TILE - 4, across - 4, 6);
  ctx.fill();
  ctx.strokeStyle = '#26221d';
  ctx.lineWidth = 2;
  rr(ctx, -TILE / 2 + 2, -across / 2 + 2, TILE - 4, across - 4, 6);
  ctx.stroke();
  ctx.save();
  ctx.beginPath();
  ctx.rect(-TILE / 2 + 4, -across / 2 + 4, TILE - 8, across - 8);
  ctx.clip();
  ctx.strokeStyle = 'rgba(224,178,60,.16)';
  ctx.lineWidth = 3.5;
  for (const [x1, y1, x2, y2] of [[-14, -13, 0, 0], [-14, 13, 0, 0], [0, 0, 14, -13], [0, 0, 14, 13]]) {
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = 'rgba(0,0,0,.28)';
  rr(ctx, -TILE * 0.2, -across / 2 + 3, TILE * 0.4, across - 6, 4);
  ctx.fill();
  if (running) {
    ctx.strokeStyle = 'rgba(143,224,143,' + (0.45 + 0.25 * Math.sin(G.time * 6)).toFixed(2) + ')';
    ctx.lineWidth = 2;
    rr(ctx, -TILE / 2 + 2, -across / 2 + 2, TILE - 4, across - 4, 6);
    ctx.stroke();
  }
  ctx.restore();
  const p = e.laneVec();
  for (const o of e.items) {
    const outL = o.outLane !== undefined ? o.outLane : o.lane;
    let ix, iy;
    if (o.pos <= 0.5) {
      const [lx, ly] = e.laneCenter(o.lane);
      const inX = lx - DX[e.dir] * TILE / 2, inY = ly - DY[e.dir] * TILE / 2;
      const t = o.pos / 0.5;
      ix = inX + (cx - inX) * t;
      iy = inY + (cy - inY) * t;
    } else {
      const [lx, ly] = e.laneCenter(outL);
      const ox2 = lx + DX[e.dir] * TILE / 2, oy2 = ly + DY[e.dir] * TILE / 2;
      const t = (o.pos - 0.5) / 0.5;
      ix = cx + (ox2 - cx) * t;
      iy = cy + (oy2 - cy) * t;
    }
    drawItemDot(ctx, ix, iy, o.item);
  }
  ctx.globalAlpha = 1;
}

function drawUnderground(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  const mateA = !!e.findMate();
  const st = mateA ? 'in' : (!!e.findBackMate() ? 'out' : 'idle');
  const bodyCol = st === 'in' ? '#3f3552' : st === 'out' ? '#33405a' : '#3c4046';
  const accCol = st === 'in' ? '#b39ddb' : st === 'out' ? '#90caf9' : '#9aa0a8';

  ctx.globalAlpha = alpha;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(dir * Math.PI / 2);

  ctx.fillStyle = bodyCol;
  rr(ctx, -14, -11, 28, 22, 5);
  ctx.fill();
  if (st === 'idle') ctx.setLineDash([4, 3]);
  ctx.strokeStyle = accCol;
  ctx.lineWidth = 2;
  rr(ctx, -14, -11, 28, 22, 5);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.strokeStyle = accCol;
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(-9, 0);
  ctx.lineTo(2, 0);
  ctx.stroke();
  ctx.fillStyle = accCol;
  tri(ctx, 0, -5, 0, 5, 9, 0);
  ctx.fill();

  if (st !== 'idle') {
    ctx.fillStyle = accCol;
    for (let k = 0; k < 3; k++) {
      const t = ((G.time * 0.9) + k / 3) % 1;
      let dx2, a;
      if (st === 'in') { dx2 = -11 + t * 10; a = t < 0.7 ? 0.95 : Math.max(0, (1 - t) * 3.3); }
      else { dx2 = -1 + t * 10; a = t < 0.3 ? t * 3.3 : 0.95; }
      ctx.globalAlpha = alpha * a;
      ctx.beginPath();
      ctx.arc(dx2, 0, 2.4, 0, 7);
      ctx.fill();
    }
    ctx.globalAlpha = alpha;
  }

  const n = Math.min(e.items.length + e.outItems.length, 6);
  ctx.fillStyle = 'rgba(255,255,255,.7)';
  for (let i = 0; i < n; i++) ctx.fillRect(-9 + i * 3.4, 8, 2.4, 2.4);

  ctx.restore();

  const badge = st === 'in' ? '入' : st === 'out' ? '出' : '—';
  const bcol = st === 'in' ? '#7e4fb0' : st === 'out' ? '#3f78b8' : '#555b64';
  ctx.fillStyle = bcol;
  rr(ctx, px + 2, py + 2, 15, 13, 3);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 9px system-ui';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badge, px + 9.5, py + 9);
  ctx.globalAlpha = 1;
}

function statusColor(e) {
  switch (e.type) {
    case 'burner-drill': return e.working ? 'g' : 'r';
    case 'stone-furnace': return e.lit ? (e.cur ? 'g' : 'y') : 'r';
    case 'assembling-machine': return e.recipe ? (e.crafting || e.prog > 0 ? 'g' : 'y') : 'r';
    case 'lab': {
      if (!G.activeTech || G.techDone[G.activeTech]) return e.packs > 0 ? 'y' : 'r';
      return e.packs > 0 ? 'g' : 'y';
    }
    case 'splitter': {
      if (!e.items.length) return 'r';
      return e.items.some(o => o.pos >= 0.499) ? 'y' : 'g';
    }
    case 'underground': {
      const paired = !!e.findMate();
      if (paired) {
        if (e.outItems.length >= UG_CAP || e.items.length >= UG_CAP) return 'y';
        return (e.items.length + e.outItems.length) > 0 ? 'g' : 'r';
      }
      return e.items.length > 0 ? 'y' : 'r';
    }
    case 'inserter':
    case 'long-inserter': return e.holding ? (e.blocked ? 'y' : 'g') : (e.rotating ? 'g' : 'r');
    case 'transport-belt': return e.items.length ? 'g' : 'r';
  }
  return null;
}

function drawStatusDot(ctx, x, y, c) {
  const col = { g: '#57e389', y: '#ffd23c', r: '#ff5b5b' }[c] || '#888';
  ctx.fillStyle = '#14161a';
  ctx.beginPath();
  ctx.arc(x, y, 5.4, 0, 7);
  ctx.fill();
  ctx.fillStyle = col;
  ctx.beginPath();
  ctx.arc(x, y, 3.9, 0, 7);
  ctx.fill();
}

function drawEntity(ctx, e, gx, gy, dir, alpha) {
  switch (e.type) {
    case 'transport-belt': drawBelt(ctx, e, gx, gy, dir, alpha); break;
    case 'splitter': drawSplitter(ctx, e, gx, gy, dir, alpha); break;
    case 'underground': drawUnderground(ctx, e, gx, gy, dir, alpha); break;
    case 'burner-drill': drawDrill(ctx, e, gx, gy, dir, alpha); break;
    case 'stone-furnace': drawFurnace(ctx, e, gx, gy, dir, alpha); break;
    case 'assembling-machine': drawAssembler(ctx, e, gx, gy, dir, alpha); break;
    case 'storage-chest': drawChest(ctx, e, gx, gy, dir, alpha); break;
    case 'lab': drawLab(ctx, e, gx, gy, dir, alpha); break;
    case 'inserter':
    case 'long-inserter': drawInserter(ctx, e, gx, gy, dir, alpha); break;
  }
  if (alpha === 1) {
    const c = statusColor(e);
    if (c) drawStatusDot(ctx, (gx + e.w) * TILE - 8, gy + 8, c);
  }
}

const ghostCache = { type: null, ent: null };

function getGhostEnt(type) {
  if (ghostCache.type !== type) {
    ghostCache.type = type;
    ghostCache.ent = new (ENT_CLASSES[type])(type, 0, 0);
  }
  return ghostCache.ent;
}

function drawGhost(ctx) {
  if (G.sel < 0 || !G.cursorTile || !G.canvasActive) return;
  const type = selItem();
  if (!type) return;
  const def = BUILD_DEFS[type];
  let ew = def.w, eh = def.h;
  if (def.rotSwap && (G.ghostDir % 2 === 1)) { ew = def.h; eh = def.w; }
  const chk = canPlaceAt(type, G.cursorTile.tx, G.cursorTile.ty, G.ghostDir);
  const tmp = getGhostEnt(type);
  tmp.dir = G.ghostDir;
  tmp.w = ew; tmp.h = eh;
  drawEntity(ctx, tmp, G.cursorTile.tx, G.cursorTile.ty, G.ghostDir, 0.55);
  ctx.fillStyle = chk.ok ? 'rgba(120,220,120,.18)' : 'rgba(230,80,80,.22)';
  ctx.fillRect(G.cursorTile.tx * TILE, G.cursorTile.ty * TILE, ew * TILE, eh * TILE);
  ctx.strokeStyle = chk.ok ? 'rgba(140,255,140,.9)' : 'rgba(255,110,110,.9)';
  ctx.lineWidth = 2 / G.cam.z;
  ctx.strokeRect(G.cursorTile.tx * TILE, G.cursorTile.ty * TILE, ew * TILE, eh * TILE);
}

function canPlaceAt(type, tx, ty, dir) {
  const def = BUILD_DEFS[type];
  let ew = def.w, eh = def.h;
  if (def.rotSwap && (dir % 2 === 1)) { ew = def.h; eh = def.w; }
  if (tx < 0 || ty < 0 || tx + ew > WORLD_W || ty + eh > WORLD_H) return { ok: false };
  for (let dy = 0; dy < eh; dy++)
    for (let dx = 0; dx < ew; dx++) {
      if (isWater(tx + dx, ty + dy)) return { ok: false };
      if (entAt(tx + dx, ty + dy)) return { ok: false };
      if (!withinReach(tx + dx, ty + dy)) return { ok: false };
    }
  if (type === 'burner-drill') {
    let hasOre = false;
    for (let dy = 0; dy < eh && !hasOre; dy++)
      for (let dx = 0; dx < ew && !hasOre; dx++) {
        const idx = tileIdx(tx + dx, ty + dy);
        if (idx >= 0 && G.world.oreType[idx] >= 0) hasOre = true;
      }
    if (!hasOre) return { ok: false };
  }
  return { ok: true };
}

function drawHoverAndMining(ctx) {
  if (!G.cursorTile) return;
  const { tx, ty } = G.cursorTile;
  const e = entAt(tx, ty);
  if (e && withinReach(tx, ty)) {
    ctx.strokeStyle = 'rgba(255,255,255,.8)';
    ctx.lineWidth = 2 / G.cam.z;
    ctx.strokeRect(e.x * TILE + 1, e.y * TILE + 1, e.w * TILE - 2, e.h * TILE - 2);
  }
  const p = G.player;
  if (p.mining) {
    const [mx, my] = p.mining.split(',').map(Number);
    const idx = tileIdx(mx, my);
    const ti = G.world.oreType[idx];
    if (ti >= 0) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(mx * TILE + TILE / 2, my * TILE + TILE / 2, 12, -Math.PI / 2, -Math.PI / 2 + p.mineProg * Math.PI * 2);
      ctx.stroke();
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,.12)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(p.x, p.y, REACH_PX, 0, 7);
  ctx.stroke();
}

function drawPlayer(ctx) {
  const p = G.player;
  ctx.fillStyle = 'rgba(0,0,0,.3)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y + 9, 9, 4, 0, 0, 7);
  ctx.fill();
  const bob = Math.sin(p.walkT) * 1.5;
  ctx.fillStyle = '#d97b2f';
  ctx.strokeStyle = '#7c431a';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(p.x, p.y + bob, 10, 0, 7);
  ctx.fill(); ctx.stroke();
  const a = p.dir * Math.PI / 2;
  ctx.fillStyle = '#ffd9a0';
  ctx.beginPath();
  ctx.arc(p.x + Math.cos(a) * 4, p.y + bob + Math.sin(a) * 4, 4.5, 0, 7);
  ctx.fill();
  if (p.mining && p.mineProg > 0) {
    const t = G.time * 14;
    ctx.fillStyle = '#e8e0c8';
    for (const side of [-1, 1]) {
      const ha = a + side * 0.9 + Math.sin(t) * 0.25 * side;
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(ha) * 11, p.y + bob + Math.sin(ha) * 11, 3, 0, 7);
      ctx.fill();
    }
  }
}
