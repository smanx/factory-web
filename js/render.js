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
  const tx0 = Math.floor(b.x1 / TILE);
  const ty0 = Math.floor(b.y1 / TILE);
  const tx1 = Math.ceil(b.x0 / TILE);
  const ty1 = Math.ceil(b.y0 / TILE);
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      const px = tx * TILE, py = ty * TILE;
      if (getTerrain(tx, ty) === T_WATER) {
        ctx.fillStyle = hash2(tx, ty) > 0.5 ? '#265d8a' : '#28618f';
        ctx.fillRect(px, py, TILE, TILE);
        continue;
      }
      const v = hash2(tx, ty);
      ctx.fillStyle = v > 0.62 ? '#4f7c3b' : v > 0.3 ? '#4a7538' : '#456f35';
      ctx.fillRect(px, py, TILE, TILE);
      const ti = getOreType(tx, ty);
      if (ti >= 0 && getOreAmt(tx, ty) > 0) drawOreDots(ctx, px, py, oreItemId(ti), getOreAmt(tx, ty), tx, ty);
    }
  }
}

function drawOreDots(ctx, px, py, itemId, amt, tx, ty) {
  const n = itemId === 'crude-oil'
    ? Math.max(1, Math.min(3, Math.round(Math.sqrt(Math.max(amt, 0)) / 40)))
    : Math.max(2, Math.min(7, Math.round(Math.sqrt(Math.max(amt, 0)) / 9)));
  ctx.fillStyle = ITEMS[itemId].color;
  ctx.strokeStyle = 'rgba(0,0,0,.25)';
  ctx.lineWidth = 1;
  const rad = itemId === 'crude-oil' ? 5.5 : null;
  for (let i = 0; i < n; i++) {
    const ox = hash2(tx * 13 + i, ty * 71 - i);
    const oy = hash2(tx * 29 - i, ty * 17 + i);
    if (rad) { // 原油：油池样式
      ctx.beginPath();
      ctx.ellipse(px + 6 + ox * (TILE - 12), py + 6 + oy * (TILE - 12), rad * (0.8 + ox * 0.5), rad * (0.6 + oy * 0.4), ox * 3, 0, 7);
      ctx.fill();
      ctx.stroke();
      continue;
    }
    const r = 2 + hash2(tx + i, ty + i) * 1.4;
    ctx.beginPath();
    ctx.arc(px + 5 + ox * (TILE - 10), py + 5 + oy * (TILE - 10), r, 0, 7);
    ctx.fill();
    ctx.stroke();
  }
}

function drawGridIfBuilding(ctx) {
  if (!buildActive() && !G.panelEnt) return;
  const b = viewBounds();
  const tx0 = Math.floor(b.x1 / TILE);
  const ty0 = Math.floor(b.y1 / TILE);
  const tx1 = Math.ceil(b.x0 / TILE);
  const ty1 = Math.ceil(b.y0 / TILE);
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
  const fast = e.type === 'fast-transport-belt';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fast ? '#4a3a34' : '#3a3f47';
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
  const off = ((G.time * beltSpeed() * (e.speedMult ? e.speedMult() : 1) * TILE) % step + step) % step;

  strip(dir * Math.PI / 2, -TILE / 2 + 2, TILE - 4);
  if (inp) strip(Math.atan2(inp[1], inp[0]), 0, step);

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(dir * Math.PI / 2);
  ctx.beginPath();
  ctx.rect(-TILE / 2 + 3, -TILE / 2 + 3, TILE - 6, TILE - 6);
  ctx.clip();
  ctx.fillStyle = fast ? 'rgba(226,102,54,.9)' : 'rgba(224,178,60,.85)';
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
    ctx.fillStyle = fast ? 'rgba(226,102,54,.9)' : 'rgba(224,178,60,.85)';
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
  const electric = e.type === 'electric-drill' || e.type === 'pumpjack';
  const pump = e.type === 'pumpjack';
  const bodyC = pump ? '#2f5a56' : electric ? '#3b5a8c' : '#6e4630';
  const bodyC2 = pump ? '#3d726d' : electric ? '#4d6ea8' : '#8a5a3e';
  const lineC = pump ? '#1b3c39' : electric ? '#223a60' : '#43291b';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = bodyC;
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 8);
  ctx.fill();
  ctx.strokeStyle = lineC;
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 8);
  ctx.stroke();
  ctx.fillStyle = bodyC2;
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
  if (!electric) {
    const fuelPct = Math.min(1, e.burnLeft / COAL_ENERGY);
    ctx.fillStyle = '#20242b';
    rr(ctx, px + 10, py + s - 12, s - 20, 5, 2); ctx.fill();
    ctx.fillStyle = fuelPct > 0 ? '#e8762c' : '#c33';
    rr(ctx, px + 10, py + s - 12, (s - 20) * fuelPct, 5, 2); ctx.fill();
  } else if (e.working) {
    ctx.fillStyle = 'rgba(143,224,255,.7)';
    rr(ctx, px + 10, py + s - 12, s - 20, 5, 2); ctx.fill();
  }
  if (e.status) {
    ctx.fillStyle = '#ffd23c';
    ctx.fillRect(px + s - 14, py + 8, 5, 5);
  }
  ctx.globalAlpha = 1;
}

function drawFurnace(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * 2;
  const electric = e.type === 'electric-furnace';
  const bodyC = electric ? '#2e7d5c' : '#8b8577';
  const lineC = electric ? '#1a4f3a' : '#57524a';
  const innerC = electric ? '#25694c' : '#6d6759';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = bodyC;
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 8); ctx.fill();
  ctx.strokeStyle = lineC;
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 8); ctx.stroke();
  ctx.fillStyle = innerC;
  rr(ctx, px + 9, py + 9, s - 18, 12, 3); ctx.fill();
  if (e.lit) {
    const fl = 0.55 + Math.sin(G.time * 12 + px) * 0.2;
    ctx.fillStyle = electric ? 'rgba(64,216,160,' + (fl * 0.35).toFixed(2) + ')' : 'rgba(232,118,44,' + (fl * 0.35).toFixed(2) + ')';
    rr(ctx, px + 9, py + 9, s - 18, 12, 3); ctx.fill();
  }
  ctx.fillStyle = '#3a3630';
  rr(ctx, px + s * 0.24, py + s * 0.42, s * 0.52, s * 0.36, 6); ctx.fill();
  if (e.lit) {
    const fl = 0.65 + Math.sin(G.time * 12 + px) * 0.25;
    ctx.fillStyle = electric ? 'rgba(64,216,160,' + fl.toFixed(2) + ')' : 'rgba(232,118,44,' + fl.toFixed(2) + ')';
    rr(ctx, px + s * 0.27, py + s * 0.45, s * 0.46, s * 0.30, 4); ctx.fill();
    ctx.fillStyle = electric ? 'rgba(200,255,230,' + (fl * 0.7).toFixed(2) + ')' : 'rgba(255,210,60,' + (fl * 0.7).toFixed(2) + ')';
    rr(ctx, px + s * 0.32, py + s * 0.54, s * 0.36, s * 0.16, 3); ctx.fill();
  }
  if (e.cur && e.prog > 0) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(Math.floor(e.prog * 100) + '%', px + s / 2, py + 15);
  }
  if (!electric) {
    const fuelPct = Math.min(1, e.burnLeft / COAL_ENERGY);
    ctx.fillStyle = '#20242b';
    rr(ctx, px + 10, py + s - 12, s - 20, 5, 2); ctx.fill();
    ctx.fillStyle = fuelPct > 0 ? '#e8762c' : '#c33';
    rr(ctx, px + 10, py + s - 12, (s - 20) * fuelPct, 5, 2); ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawAssembler(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * 2;
  const mk2 = e.type === 'assembling-machine-mk2';
  const bodyC = mk2 ? '#6b4d8f' : '#4d5f8f';
  const lineC = mk2 ? '#3c2a52' : '#2e3a5c';
  const innerC = mk2 ? '#4c3a66' : '#3a486e';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = bodyC;
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 7); ctx.fill();
  ctx.strokeStyle = lineC;
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 7); ctx.stroke();
  ctx.fillStyle = innerC;
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
  const fr = e.fluidRecipe ? e.fluidRecipe() : null;
  if (fr) {
    const pcx = px + s / 2, pcy = py + s / 2;
    if (fr.fin.length) drawPort(ctx, pcx, pcy, (dir + 2) % 4, ITEMS[fr.fin[0]].color, false, 0, TILE);
    if (fr.fout.length) drawPort(ctx, pcx, pcy, dir, ITEMS[fr.fout[0]].color, true, 0, TILE);
  }
  ctx.globalAlpha = 1;
}

function drawChemicalPlant(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * 3;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#6f7f56';
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 10); ctx.fill();
  ctx.strokeStyle = '#46523a';
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 10); ctx.stroke();
  ctx.fillStyle = '#3b3230';
  rr(ctx, px + s * 0.12, py + 10, 13, s * 0.22, 3); ctx.fill();
  rr(ctx, px + s * 0.28, py + 10, 13, s * 0.22, 3); ctx.fill();
  if (e.working || e.crafting) {
    const fl = 0.5 + Math.sin(G.time * 9 + px) * 0.25;
    ctx.fillStyle = 'rgba(170,225,130,' + (fl * 0.45).toFixed(2) + ')';
    rr(ctx, px + 12, py + s * 0.42, s - 24, s * 0.22, 6); ctx.fill();
  }
  ctx.fillStyle = '#8a9a70';
  ctx.beginPath();
  ctx.arc(px + s * 0.62, py + s * 0.36, s * 0.15, 0, 7); ctx.fill();
  ctx.strokeStyle = '#46523a';
  ctx.lineWidth = 2;
  ctx.stroke();
  if (e.recipe) {
    const outId = Object.keys(RECIPES[e.recipe].out)[0];
    drawItemDotBig(ctx, px + s * 0.62, py + s * 0.36, outId);
    const pct = e.crafting ? Math.min(1, e.prog / RECIPES[e.recipe].time) : 0;
    if (pct > 0) {
      ctx.strokeStyle = '#8fe08f';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(px + s * 0.62, py + s * 0.36, 26, -Math.PI / 2, -Math.PI / 2 + pct * Math.PI * 2);
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = 'rgba(255,255,255,.6)';
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('无配方', px + s * 0.62, py + s * 0.36);
  }
  let bx = px + 14;
  for (const id of ['plastic-bar', 'light-oil', 'petroleum-gas']) {
    const n = (e.outp && e.outp[id]) || 0;
    if (!n) continue;
    ctx.fillStyle = '#20242b';
    rr(ctx, bx, py + s - 18, 18, 7, 2); ctx.fill();
    ctx.fillStyle = ITEMS[id].color;
    rr(ctx, bx, py + s - 18, 18 * Math.min(1, n / 16), 7, 2); ctx.fill();
    bx += 24;
  }
  ctx.font = 'bold 11px system-ui';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#eef4e4';
  ctx.fillText('化工厂', px + 8, py + s - 10);
  ctx.globalAlpha = 1;
}

function drawItemDotBig(ctx, x, y, item) {
  drawItemDot(ctx, x, y, item, 7);
}

// 流体端口凸缘：side 0东1南2西3北；(cx,cy)=实体中心像素；dist=中心到该边距离；
// off=沿边偏移（±0.5 为半格）；arrow=出流方向箭头
function drawPort(ctx, cx, cy, side, color, arrow, off, dist) {
  if (!dist) dist = TILE;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(side * Math.PI / 2);
  if (off) ctx.translate(0, off * TILE);
  ctx.fillStyle = '#20242b';
  rr(ctx, dist - 9, -7, 10, 14, 3); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,.4)';
  ctx.lineWidth = 1.5;
  rr(ctx, dist - 9, -7, 10, 14, 3); ctx.stroke();
  ctx.fillStyle = color;
  rr(ctx, dist - 7, -4.5, 6.5, 9, 2); ctx.fill();
  if (arrow) {
    ctx.fillStyle = color;
    tri(ctx, dist - 13, -5, dist - 13, 5, dist - 20, 0);
    ctx.fill();
  }
  ctx.restore();
}

const PORT_WATER = '#3fa0e8';
const PORT_STEAM = '#dfe8ee';

function drawBoiler(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const w = TILE * 3, h = TILE * 2;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#8a6a45';
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 8); ctx.fill();
  ctx.strokeStyle = '#4c3f28';
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 8); ctx.stroke();
  ctx.fillStyle = '#5c4630';
  rr(ctx, px + 9, py + 9, w - 18, 12, 3); ctx.fill();
  if (e.lit) {
    const fl = 0.55 + Math.sin(G.time * 12 + px) * 0.2;
    ctx.fillStyle = 'rgba(232,118,44,' + (fl * 0.35).toFixed(2) + ')';
    rr(ctx, px + 9, py + 9, w - 18, 12, 3); ctx.fill();
    const fl2 = 0.65 + Math.sin(G.time * 12 + px) * 0.25;
    ctx.fillStyle = 'rgba(255,210,60,' + (fl2 * 0.7).toFixed(2) + ')';
    rr(ctx, px + w * 0.36, py + h * 0.42, w * 0.28, h * 0.16, 3); ctx.fill();
  }
  ctx.fillStyle = '#3b3230';
  rr(ctx, px + w * 0.46, py + 6, w * 0.08, h * 0.32, 3); ctx.fill();
  const fuelPct = Math.min(1, e.burnLeft / COAL_ENERGY);
  ctx.fillStyle = '#20242b';
  rr(ctx, px + 10, py + h - 12, w - 20, 5, 2); ctx.fill();
  ctx.fillStyle = fuelPct > 0 ? '#e8762c' : '#c33';
  rr(ctx, px + 10, py + h - 12, (w - 20) * fuelPct, 5, 2); ctx.fill();
  const wPct = Math.max(0, Math.min(1, (e.water || 0) / WATER_CAP));
  ctx.fillStyle = '#20242b';
  rr(ctx, px + 10, py + h - 19, w - 20, 5, 2); ctx.fill();
  ctx.fillStyle = wPct > 0 ? '#3fa0e8' : '#b33';
  rr(ctx, px + 10, py + h - 19, (w - 20) * wPct, 5, 2); ctx.fill();
  const tp = Math.max(0, Math.min(1, (e.temp || 0) / BOILER_TEMP_MAX));
  if (tp > 0.8) { // 温度达标：冒蒸汽
    for (let i = 0; i < 3; i++) {
      const t = ((G.time * 0.5) + i / 3) % 1;
      ctx.fillStyle = 'rgba(240,248,255,' + (0.5 * (1 - t)).toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(px + w * 0.62 + Math.sin((t + i) * 6) * 5, py + 16 - t * 20, 2.5 + t * 3, 0, 7);
      ctx.fill();
    }
  }
  ctx.font = 'bold 11px system-ui';
  ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillStyle = '#f4e9d8';
  ctx.fillText('锅炉', px + 8, py + 14);
  ctx.textAlign = 'right';
  ctx.fillStyle = tp >= 1 ? '#7fe08f' : tp > 0 ? '#ffd23c' : '#8a93a0';
  ctx.fillText(Math.round(e.temp || 0) + '°C', px + w - 8, py + 14);
  // 水口（蓝，双向互通）：左右两端下格侧边；汽口（白，只出）：底边中间
  const cx = px + TILE * 1.5, cy = py + TILE;
  drawPort(ctx, cx, cy, 2, PORT_WATER, false, -0.5, TILE);
  drawPort(ctx, cx, cy, 0, PORT_WATER, false, 0.5, TILE);
  drawPort(ctx, cx, cy, 1, PORT_STEAM, true, 0, TILE);
  ctx.globalAlpha = 1;
}

function drawPipe(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE / 2, cy = py + TILE / 2;
  ctx.globalAlpha = alpha;
  ctx.strokeStyle = '#7d7264';
  ctx.lineWidth = 8;
  for (const [dx, dy] of PIPE_DIRS) {
    const nb = entAt(gx + dx, gy + dy);
    if (nb instanceof Pipe || nb instanceof Refinery || nb instanceof Pumpjack ||
        nb instanceof Boiler || nb instanceof Pump || nb instanceof SteamEngine ||
        nb instanceof ChemicalPlant || nb instanceof Assembler) {
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + dx * TILE / 2, cy + dy * TILE / 2);
      ctx.stroke();
    }
  }
  ctx.fillStyle = '#8d8272';
  ctx.beginPath(); ctx.arc(cx, cy, 8.5, 0, 7); ctx.fill();
  ctx.strokeStyle = '#55503f';
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, 8.5, 0, 7); ctx.stroke();
  const total = e.total ? e.total() : 0;
  if (total > 0) {
    const first = Object.keys(e.fluid).find(k => e.fluid[k] > 0);
    if (first && ITEMS[first]) {
      ctx.fillStyle = ITEMS[first].color;
      ctx.beginPath();
      ctx.arc(cx, cy, Math.max(3, 6.5 * Math.min(1, total / PIPE_CAP)), 0, 7);
      ctx.fill();
    }
  }
  ctx.globalAlpha = 1;
}

function drawRefinery(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const s = TILE * 3;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#8f5a34';
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 10); ctx.fill();
  ctx.strokeStyle = '#5c3820';
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, s - 6, s - 6, 10); ctx.stroke();
  ctx.fillStyle = '#3b3230';
  rr(ctx, px + s * 0.12, py + 10, 13, s * 0.22, 3); ctx.fill();
  rr(ctx, px + s * 0.28, py + 10, 13, s * 0.22, 3); ctx.fill();
  if (e.working) {
    const fl = 0.5 + Math.sin(G.time * 10 + px) * 0.25;
    ctx.fillStyle = 'rgba(255,160,60,' + (fl * 0.45).toFixed(2) + ')';
    rr(ctx, px + 12, py + s * 0.42, s - 24, s * 0.24, 6); ctx.fill();
  }
  let bx = px + 14;
  for (const [id] of [['heavy-oil'], ['light-oil'], ['petroleum-gas']]) {
    const n = e.outp[id] || 0;
    ctx.fillStyle = '#20242b';
    rr(ctx, bx, py + s - 18, 18, 7, 2); ctx.fill();
    if (n > 0) {
      ctx.fillStyle = ITEMS[id].color;
      rr(ctx, bx, py + s - 18, 18 * Math.min(1, n / 16), 7, 2); ctx.fill();
    }
    bx += 24;
  }
  if (!e.working && (e.inp['crude-oil'] || 0) < 2) {
    ctx.fillStyle = 'rgba(255,255,255,.55)';
    ctx.font = 'bold 11px system-ui';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('缺原油', px + s / 2, py + s * 0.58);
  }
  ctx.globalAlpha = 1;
}

function drawSteamEngine(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const w = TILE * 3, h = TILE * 5;
  const om = Math.max(0, Math.min(1, e.outMult || 0));
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#5d7790';
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 8); ctx.fill();
  ctx.strokeStyle = '#33435a';
  ctx.lineWidth = 3;
  rr(ctx, px + 3, py + 3, w - 6, h - 6, 8); ctx.stroke();
  ctx.fillStyle = '#466075';
  rr(ctx, px + 10, py + 10, w - 20, h - 20, 5); ctx.fill();
  const gcx = px + w / 2, gcy = py + h * 0.32;
  if (e.on) {
    ctx.save();
    ctx.translate(gcx, gcy);
    ctx.rotate(e.spin || 0);
    ctx.fillStyle = om >= 1 ? '#c4e4ff' : '#aac8e8';
    gearShape(ctx, 0, 0, 16, 10, 8);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = 'rgba(143,224,224,' + (0.35 + 0.55 * om).toFixed(2) + ')';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(gcx, gcy, 22, 0, Math.PI * 2);
    ctx.stroke();
    const fl = Math.sin(G.time * 20 + px);
    if (fl > 0.2) {
      ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + 0.35 * om).toFixed(2) + ')';
      ctx.beginPath();
      ctx.moveTo(gcx - 14, py + 26);
      ctx.lineTo(gcx - 4, py + 12);
      ctx.lineTo(gcx - 10, py + 26);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    ctx.fillStyle = '#7d8894';
    gearShape(ctx, gcx, gcy, 16, 10, 8);
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (e.on) ctx.fillText('+' + (e.powerOut || 0).toFixed(1), px + w / 2, py + h - 14);
  else ctx.fillText('蒸汽机', px + w / 2, py + h - 14);
  // 两端通用汽口：任意一端均可进出蒸汽
  drawPort(ctx, px + w / 2, py + h / 2, 3, PORT_STEAM, false, 0, h / 2);
  drawPort(ctx, px + w / 2, py + h / 2, 1, PORT_STEAM, false, 0, h / 2);
  ctx.globalAlpha = 1;
}

function drawPump(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = '#1d3d55';
  rr(ctx, px + 2, py + 2, TILE - 4, TILE - 4, 7); ctx.fill();
  ctx.strokeStyle = '#12293b';
  ctx.lineWidth = 2;
  rr(ctx, px + 2, py + 2, TILE - 4, TILE - 4, 7); ctx.stroke();
  ctx.fillStyle = '#3f9fc0';
  rr(ctx, px + 8, py + 8, TILE - 16, TILE - 16, 5); ctx.fill();
  ctx.strokeStyle = '#26688a';
  ctx.lineWidth = 2;
  rr(ctx, px + 8, py + 8, TILE - 16, TILE - 16, 5); ctx.stroke();
  if (e.working) { // 抽水涟漪
    const ph = (e.pulse || 0) % 1;
    ctx.strokeStyle = 'rgba(170,225,255,' + (0.65 * (1 - ph)).toFixed(2) + ')';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px + TILE / 2, py + TILE / 2, 5 + ph * 11, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    ctx.fillStyle = '#9fd8f0';
    ctx.beginPath();
    ctx.arc(px + TILE / 2, py + TILE / 2, 5, 0, 7);
    ctx.fill();
  }
  ctx.fillStyle = dirColorNotch(dir);
  notch(ctx, px, py, dir);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 9px system-ui';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('抽水机', px + TILE / 2, py + TILE / 2 + 12);
  ctx.globalAlpha = 1;
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
  if (e.type === 'filter-inserter' && e.filter) {
    ctx.strokeStyle = '#58b8e8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, 7);
    ctx.stroke();
  }
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
  if (e.holding && (e.holdingCount || 1) > 1) {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 9px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('×' + e.holdingCount, tipx, tipy - 9);
  }
  ctx.fillStyle = dirColorNotch(dir);
  notch(ctx, px, py, dir);
  drawFlowMarks(ctx, e, cx, cy, dir);
  ctx.globalAlpha = 1;
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
  // 出口：物流方向，双箭头向外
  const oc = dirColorNotch(dir);
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
  // 流向指示：亮色箭头指向输出方向（放置时即可辨认物流方向）
  ctx.fillStyle = dirColorNotch(dir);
  ctx.strokeStyle = 'rgba(0,0,0,.45)';
  ctx.lineWidth = 1;
  for (const ax of [-TILE * 0.26, TILE * 0.04]) {
    ctx.beginPath();
    ctx.moveTo(ax - 5, -7);
    ctx.lineTo(ax - 5, 7);
    ctx.lineTo(ax + 6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  if (running) {
    ctx.strokeStyle = 'rgba(143,224,143,' + (0.45 + 0.25 * Math.sin(G.time * 6)).toFixed(2) + ')';
    ctx.lineWidth = 2;
    rr(ctx, -TILE / 2 + 2, -across / 2 + 2, TILE - 4, across - 4, 6);
    ctx.stroke();
  }
  ctx.restore();
  if (e.outPref !== undefined && e.outPref >= 0) {
    const [lx, ly] = e.laneCenter(e.outPref);
    ctx.save();
    ctx.translate(lx, ly);
    ctx.rotate(dir * Math.PI / 2);
    ctx.fillStyle = '#ffd23c';
    tri(ctx, TILE * 0.14, -5, TILE * 0.14, 5, TILE * 0.3, 0);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.4)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
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
    case 'burner-drill':
    case 'electric-drill':
    case 'pumpjack': return e.working ? 'g' : 'r';
    case 'stone-furnace': return e.lit ? (e.cur ? 'g' : 'y') : 'r';
    case 'electric-furnace': return e.lit ? (e.cur ? 'g' : 'r') : 'r';
    case 'assembling-machine':
    case 'assembling-machine-mk2': return e.recipe ? (e.crafting || e.prog > 0 ? 'g' : 'y') : 'r';
    case 'lab': {
      if (!G.activeTech || G.techDone[G.activeTech]) return e.totalPacks() > 0 ? 'y' : 'r';
      return e.totalPacks() > 0 ? (e.packCount(e.nextNeed()) > 0 ? 'g' : 'y') : 'r';
    }
    case 'boiler': return e.burning ? 'g' : (e.steamBuf >= WATER_CAP - 0.01 ? 'y' : 'r');
    case 'steam-engine': return e.on ? 'g' : ((e.steamBuf || 0) > 0 ? 'y' : 'r');
    case 'offshore-pump': return e.working ? 'g' : ((e.buf || 0) >= 1 ? 'y' : 'r');
    case 'pipe': return e.total() > 0 ? 'g' : 'r';
    case 'refinery': return e.working ? 'g' : ((e.inp['crude-oil'] || 0) >= 2 ? 'y' : 'r');
    case 'chemical-plant': return e.recipe ? (e.crafting ? 'g' : (G.power.sat <= 0 && Object.keys(e.inp).length ? 'r' : 'y')) : 'r';
    case 'splitter':
    case 'priority-splitter': {
      if (!e.items.length) return 'r';
      return e.items.some(o => o.pos >= 0.499) ? 'y' : 'g';
    }
    case 'underground':
    case 'fast-underground-belt': {
      const paired = !!e.findMate();
      if (paired) {
        if (e.outItems.length >= UG_CAP || e.items.length >= UG_CAP) return 'y';
        return (e.items.length + e.outItems.length) > 0 ? 'g' : 'r';
      }
      return e.items.length > 0 ? 'y' : 'r';
    }
    case 'inserter':
    case 'long-inserter':
    case 'filter-inserter':
    case 'stack-inserter': return e.holding ? (e.blocked ? 'y' : 'g') : (e.rotating ? 'g' : 'r');
    case 'transport-belt':
    case 'fast-transport-belt': return e.items.length ? 'g' : 'r';
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
    case 'transport-belt':
    case 'fast-transport-belt': drawBelt(ctx, e, gx, gy, dir, alpha); break;
    case 'splitter':
    case 'priority-splitter': drawSplitter(ctx, e, gx, gy, dir, alpha); break;
    case 'underground':
    case 'fast-underground-belt': drawUnderground(ctx, e, gx, gy, dir, alpha); break;
    case 'burner-drill':
    case 'electric-drill':
    case 'pumpjack': drawDrill(ctx, e, gx, gy, dir, alpha); break;
    case 'stone-furnace':
    case 'electric-furnace': drawFurnace(ctx, e, gx, gy, dir, alpha); break;
    case 'assembling-machine':
    case 'assembling-machine-mk2': drawAssembler(ctx, e, gx, gy, dir, alpha); break;
    case 'storage-chest': drawChest(ctx, e, gx, gy, dir, alpha); break;
    case 'lab': drawLab(ctx, e, gx, gy, dir, alpha); break;
    case 'boiler': drawBoiler(ctx, e, gx, gy, dir, alpha); break;
    case 'steam-engine': drawSteamEngine(ctx, e, gx, gy, dir, alpha); break;
    case 'offshore-pump': drawPump(ctx, e, gx, gy, dir, alpha); break;
    case 'pipe': drawPipe(ctx, e, gx, gy, dir, alpha); break;
    case 'refinery': drawRefinery(ctx, e, gx, gy, dir, alpha); break;
    case 'chemical-plant': drawChemicalPlant(ctx, e, gx, gy, dir, alpha); break;
    case 'inserter':
    case 'long-inserter':
    case 'filter-inserter':
    case 'stack-inserter': drawInserter(ctx, e, gx, gy, dir, alpha); break;
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
  if (!buildActive() || !G.cursorTile || !G.canvasActive) return;
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
  if (type === 'offshore-pump') { // 抽水机只能放在水面上
    if (!isWater(tx, ty) || entAt(tx, ty) || !withinReach(tx, ty)) return { ok: false };
    return { ok: true };
  }
  for (let dy = 0; dy < eh; dy++)
    for (let dx = 0; dx < ew; dx++) {
      if (isWater(tx + dx, ty + dy)) return { ok: false };
      if (entAt(tx + dx, ty + dy)) return { ok: false };
      if (!withinReach(tx + dx, ty + dy)) return { ok: false };
    }
  if (type === 'burner-drill' || type === 'electric-drill') {
    let hasOre = false;
    for (let dy = 0; dy < eh && !hasOre; dy++)
      for (let dx = 0; dx < ew && !hasOre; dx++) {
        const ti = getOreType(tx + dx, ty + dy);
        if (ti >= 0 && ti < ORES.length) hasOre = true;
      }
    if (!hasOre) return { ok: false };
  }
  if (type === 'pumpjack') {
    let hasOil = false;
    for (let dy = 0; dy < eh && !hasOil; dy++)
      for (let dx = 0; dx < ew && !hasOil; dx++) {
        if (getOreType(tx + dx, ty + dy) === ORE_OIL && getOreAmt(tx + dx, ty + dy) > 0) hasOil = true;
      }
    if (!hasOil) return { ok: false };
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
    const ti = getOreType(mx, my);
    if (ti >= 0 && ti < ORES.length) {
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
