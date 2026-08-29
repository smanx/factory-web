'use strict';

// ===== 渲染 =====
function drawCar(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE, cy = py + TILE;
  ctx.globalAlpha = alpha;
  // 车身
  ctx.fillStyle = '#5a4a2a';
  rr(ctx, px + 4, py + 6, TILE * 2 - 8, TILE * 2 - 14, 8); ctx.fill();
  ctx.fillStyle = '#7a6a3a';
  rr(ctx, px + 4, py + 6, TILE * 2 - 8, TILE * 2 - 26, 8); ctx.fill();
  // 驾驶舱玻璃
  ctx.fillStyle = '#bfe8ff';
  rr(ctx, cx - 8, cy - 6, 16, 14, 4); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,.5)';
  rr(ctx, cx - 8, cy - 6, 16, 5, 4); ctx.fill();
  // 车头朝向箭头（指示车头方向）
  const ang = (e.dir || 0) * Math.PI / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(ang);
  // 车载机枪（对齐《异星工厂》Car）：车头前伸的短机枪枪管
  ctx.fillStyle = '#2a2620';
  ctx.fillRect(12, -2.5, 9, 5);
  ctx.fillRect(8, -4, 5, 8);
  ctx.fillStyle = '#e8c85a';
  ctx.beginPath();
  ctx.moveTo(12, 0); ctx.lineTo(5, -5); ctx.lineTo(5, 5); ctx.closePath();
  ctx.fill();
  ctx.restore();
  // 车轮
  ctx.fillStyle = '#2a2620';
  ctx.fillRect(px + 6, py + 4, 8, 6);
  ctx.fillRect(px + TILE * 2 - 14, py + 4, 8, 6);
  ctx.fillRect(px + 6, py + TILE * 2 - 12, 8, 6);
  ctx.fillRect(px + TILE * 2 - 14, py + TILE * 2 - 12, 8, 6);
  // 燃料显示（火箭燃料>固体燃料>煤 优先计数）
  const fl = (e.fuelNuclear || 0) > 0 ? (e.fuelNuclear || 0) : ((e.fuelRocket || 0) > 0 ? (e.fuelRocket || 0) : ((e.fuelSolid || 0) > 0 ? (e.fuelSolid || 0) : (e.fuelCoal || 0)));
  if (fl > 0 || (G.driving && G.driving.ent === e)) {
    // 燃料余量：小圆点 + 数字（不再显示中文燃料类型）
    const fcol = e.fuelNuclear > 0 ? '#8ff0d0' : e.fuelRocket > 0 ? '#ff9a5a' : e.fuelSolid > 0 ? '#ffd23c' : '#8a8a8a';
    ctx.fillStyle = fcol;
    ctx.beginPath(); ctx.arc(cx - 6, py + TILE * 2 - 4, 3, 0, 7); ctx.fill();
    ctx.fillStyle = fl > 0 ? '#e8c85a' : '#ff5b5b';
    ctx.font = 'bold 10px system-ui';
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(String(fl), cx, py + TILE * 2 - 4);
  }
  ctx.globalAlpha = 1;
}
function carPanelHtml(e) {
  const cap = e.fuelCap || CAR_FUEL_CAP;
  let h = row('燃料', vehicleFuelDisplay(e, cap), 'fuel');
  const nc = Math.min(invCount('coal'), cap - e.fuelCoal - e.fuelSolid - e.fuelRocket - (e.fuelNuclear||0) - (e.fuelWood||0));
  const ns = Math.min(invCount('solid-fuel'), cap - e.fuelCoal - e.fuelSolid - e.fuelRocket - (e.fuelNuclear||0) - (e.fuelWood||0));
  const nrk = Math.min(invCount('rocket-fuel'), cap - e.fuelCoal - e.fuelSolid - e.fuelRocket - (e.fuelNuclear||0) - (e.fuelWood||0));
  const nnuc = Math.min(invCount('nuclear-fuel'), cap - e.fuelCoal - e.fuelSolid - e.fuelRocket - (e.fuelNuclear||0) - (e.fuelWood||0));
  const nw = Math.min(invCount('wood'), cap - e.fuelCoal - e.fuelSolid - e.fuelRocket - (e.fuelNuclear||0) - (e.fuelWood||0));
  if (nnuc > 0) h += '<button data-action="feed" data-id="nuclear-fuel">放入核燃料 ×' + nnuc + '</button>';
  if (nc > 0) h += '<button data-action="feed" data-id="coal">放入煤 ×' + nc + '</button>';
  if (ns > 0) h += '<button data-action="feed" data-id="solid-fuel">放入固体燃料 ×' + ns + '</button>';
  if (nrk > 0) h += '<button data-action="feed" data-id="rocket-fuel">放入火箭燃料 ×' + nrk + '</button>';
  if (nw > 0) h += '<button data-action="feed" data-id="wood">放入木材 ×' + nw + '</button>';
  h += '<button data-action="drive" id="btn-car-drive" class="primary">🚗 进入驾驶</button>';
  h += '<div class="dim">装甲车：靠近后按 E 进入驾驶（WASD 更快移动），移动消耗煤/固体燃料（固体燃料更耐用），驾驶时按空格发射车载机枪（消耗背包弹药），E 下车。可用机械臂/手动放入。</div>';
  h += trunkPanelHtml(e);
  h += vehEquipHtml(e);
  return h;
}
function carPanelLive(e, api) {
  const cap = e.fuelCap || CAR_FUEL_CAP;
  api.set('fuel', vehicleFuelDisplay(e, cap));
  const nc = Math.min(invCount('coal'), cap - e.fuelCoal - e.fuelSolid - e.fuelRocket - (e.fuelNuclear||0) - (e.fuelWood||0));
  const ns = Math.min(invCount('solid-fuel'), cap - e.fuelCoal - e.fuelSolid - e.fuelRocket - (e.fuelNuclear||0) - (e.fuelWood||0));
  const nrk = Math.min(invCount('rocket-fuel'), cap - e.fuelCoal - e.fuelSolid - e.fuelRocket - (e.fuelNuclear||0) - (e.fuelWood||0));
  const nnuc = Math.min(invCount('nuclear-fuel'), cap - e.fuelCoal - e.fuelSolid - e.fuelRocket - (e.fuelNuclear||0) - (e.fuelWood||0));
  const nw = Math.min(invCount('wood'), cap - e.fuelCoal - e.fuelSolid - e.fuelRocket - (e.fuelNuclear||0) - (e.fuelWood||0));
  api.toggle('button[data-action="feed"][data-id="nuclear-fuel"]', nnuc > 0, '放入核燃料 ×' + nnuc);
  api.toggle('button[data-action="feed"][data-id="coal"]', nc > 0, '放入煤 ×' + nc);
  api.toggle('button[data-action="feed"][data-id="solid-fuel"]', ns > 0, '放入固体燃料 ×' + ns);
  api.toggle('button[data-action="feed"][data-id="rocket-fuel"]', nrk > 0, '放入火箭燃料 ×' + nrk);
  api.toggle('button[data-action="feed"][data-id="wood"]', nw > 0, '放入木材 ×' + nw);
  if (G.driving && G.driving.ent === e) api.status('驾驶中（E 下车）', 'ok');
  else if (e.fuelCoal <= 0 && e.fuelSolid <= 0 && e.fuelRocket <= 0 && (e.fuelNuclear||0) <= 0 && (e.fuelWood||0) <= 0) api.status('缺燃料：放入煤/木材/固体燃料/火箭燃料/核燃料后可驾驶', 'warn');
  else api.status('可驾驶', 'ok');
}
function carTip(e) {
  if (G.driving && G.driving.ent === e) return '驾驶中（E 下车）';
  return '装甲车（煤 ' + (e.fuelCoal || 0) + (e.fuelWood > 0 ? '，木材 ' + e.fuelWood : '') + (e.fuelSolid > 0 ? '，固体燃料 ' + e.fuelSolid : '') + (e.fuelRocket > 0 ? '，火箭燃料 ' + e.fuelRocket : '') + (e.fuelNuclear > 0 ? '，核燃料 ' + e.fuelNuclear : '') + '），按 E 进入驾驶，空格发射车载机枪';
}
function carOnAction(act) {
  if (act === 'drive') {
    const c = G.panelEnt;
    if (c instanceof Car) { enterCar(c); return true; }
  }
  return false;
}

// ===== 注册 =====
ENT_CLASSES['car'] = Car;
DEVICE_RENDER['car'] = drawCar;
DEVICE_PANEL['car'] = { html: carPanelHtml, live: carPanelLive, tip: carTip, onAction: carOnAction };
DEVICE_DIR_ROTATE['car'] = true;

// ===== 坦克渲染与面板 =====
function drawTank(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const wpx = TILE * e.w, hpx = TILE * e.h;
  const cx = px + wpx / 2, cy = py + hpx / 2;
  ctx.save();
  ctx.globalAlpha = alpha;
  // 底盘履带
  ctx.fillStyle = '#2a3026';
  rr(ctx, px + 4, py + 6, wpx - 8, hpx - 12, 6); ctx.fill();
  ctx.strokeStyle = '#1a1e18'; ctx.lineWidth = 2; ctx.stroke();
  // 装甲车身
  ctx.fillStyle = '#4a5a3a';
  rr(ctx, px + 10, py + 10, wpx - 20, hpx - 20, 6); ctx.fill();
  ctx.strokeStyle = '#2a3424'; ctx.lineWidth = 2; ctx.stroke();
  // 炮塔
  ctx.save();
  ctx.translate(cx, cy);
  const ang = (e.dir || 0) * Math.PI / 2;
  ctx.rotate(ang);
  ctx.fillStyle = '#3a4a2e';
  ctx.beginPath(); ctx.arc(0, 0, TILE * 0.42, 0, 7); ctx.fill(); ctx.stroke();
  // 主炮管
  ctx.fillStyle = '#2a3424';
  ctx.fillRect(TILE * 0.1, -TILE * 0.07, TILE * 0.72, TILE * 0.14);
  ctx.restore();
  // 状态灯
  ctx.fillStyle = e.shells > 0 ? '#d0a84a' : '#555';
  ctx.fillRect(px + wpx - 20, py + 8, 8, 8);
  ctx.restore();
}
function tankPanelHtml(e) {
  let h = row('燃料', vehicleFuelDisplay(e, TANK_FUEL_CAP), 'fuel');
  const parts = [];
  if (e.euShells > 0) parts.push('铀爆弹 ' + e.euShells);
  if (e.eShells > 0) parts.push('爆炸弹 ' + e.eShells);
  if (e.uShells > 0) parts.push('铀弹 ' + e.uShells);
  if (e.shells > 0) parts.push('炮弹 ' + e.shells);
  const shellStr = parts.length ? parts.join(' + ') + ' / ' + TANK_SHELL_CAP : '<span class="dim">无</span>';
  h += row('炮弹', shellStr, 'shell');
  const cf = Math.min(invCount('coal'), TANK_FUEL_CAP - e.fuelCoal - e.fuelSolid - e.fuelRocket - (e.fuelNuclear||0) - (e.fuelWood||0));
  const csol = Math.min(invCount('solid-fuel'), TANK_FUEL_CAP - e.fuelCoal - e.fuelSolid - e.fuelRocket - (e.fuelNuclear||0) - (e.fuelWood||0));
  const crk = Math.min(invCount('rocket-fuel'), TANK_FUEL_CAP - e.fuelCoal - e.fuelSolid - e.fuelRocket - (e.fuelNuclear||0) - (e.fuelWood||0));
  const cnuc = Math.min(invCount('nuclear-fuel'), TANK_FUEL_CAP - e.fuelCoal - e.fuelSolid - e.fuelRocket - (e.fuelNuclear||0) - (e.fuelWood||0));
  const cw = Math.min(invCount('wood'), TANK_FUEL_CAP - e.fuelCoal - e.fuelSolid - e.fuelRocket - (e.fuelNuclear||0) - (e.fuelWood||0));
  const cs = Math.min(invCount('cannon-shell'), TANK_SHELL_CAP - e.shells);
  const cu = Math.min(invCount('uranium-cannon-shell'), TANK_SHELL_CAP - e.uShells);
  const ce = Math.min(invCount('explosive-cannon-shell'), TANK_SHELL_CAP - e.eShells);
  const ceu = Math.min(invCount('explosive-uranium-cannon-shell'), TANK_SHELL_CAP - e.euShells);
  if (cf > 0) h += '<button data-action="feed" data-id="coal">放入煤 ×' + cf + '</button>';
  if (cw > 0) h += '<button data-action="feed" data-id="wood">放入木材 ×' + cw + '</button>';
  if (csol > 0) h += '<button data-action="feed" data-id="solid-fuel">放入固体燃料 ×' + csol + '</button>';
  if (cnuc > 0) h += '<button data-action="feed" data-id="nuclear-fuel">放入核燃料 ×' + cnuc + '</button>';
  if (crk > 0) h += '<button data-action="feed" data-id="rocket-fuel">放入火箭燃料 ×' + crk + '</button>';
  if (cs > 0) h += '<button data-action="feed" data-id="cannon-shell">装填炮弹 ×' + cs + '</button>';
  if (cu > 0) h += '<button data-action="feed" data-id="uranium-cannon-shell">装填铀炮弹 ×' + cu + '</button>';
  if (ce > 0) h += '<button data-action="feed" data-id="explosive-cannon-shell">装填爆炸炮弹 ×' + ce + '</button>';
  if (ceu > 0) h += '<button data-action="feed" data-id="explosive-uranium-cannon-shell">装填铀爆炸炮弹 ×' + ceu + '</button>';
  h += '<button data-action="drive" class="primary">🚀 进入驾驶（空格开炮）</button>';
  h += '<div class="dim">坦克：重型战斗载具，装甲更厚（驾驶时受伤减少），按空格向光标方向发射炮弹（范围爆炸）。弹药分级对齐《异星工厂》：炮弹 → 爆炸炮弹（爆炸物科技，更大爆炸）→ 铀炮弹（核能科技）→ 铀爆炸炮弹（终极）。需高级战斗科技。</div>';
  h += trunkPanelHtml(e);
  h += vehEquipHtml(e);
  return h;
}
function tankPanelLive(e, api) {
  api.set('fuel', vehicleFuelDisplay(e, TANK_FUEL_CAP));
  const parts = [];
  if (e.euShells > 0) parts.push('铀爆弹 ' + e.euShells);
  if (e.eShells > 0) parts.push('爆炸弹 ' + e.eShells);
  if (e.uShells > 0) parts.push('铀弹 ' + e.uShells);
  if (e.shells > 0) parts.push('炮弹 ' + e.shells);
  api.set('shell', parts.length ? parts.join(' + ') + ' / ' + TANK_SHELL_CAP : dimSpan('无'));
  const cf = Math.min(invCount('coal'), TANK_FUEL_CAP - e.fuelCoal - e.fuelSolid - e.fuelRocket - (e.fuelNuclear||0) - (e.fuelWood||0));
  const csol = Math.min(invCount('solid-fuel'), TANK_FUEL_CAP - e.fuelCoal - e.fuelSolid - e.fuelRocket - (e.fuelNuclear||0) - (e.fuelWood||0));
  const crk = Math.min(invCount('rocket-fuel'), TANK_FUEL_CAP - e.fuelCoal - e.fuelSolid - e.fuelRocket - (e.fuelNuclear||0) - (e.fuelWood||0));
  const cnuc = Math.min(invCount('nuclear-fuel'), TANK_FUEL_CAP - e.fuelCoal - e.fuelSolid - e.fuelRocket - (e.fuelNuclear||0) - (e.fuelWood||0));
  const cw = Math.min(invCount('wood'), TANK_FUEL_CAP - e.fuelCoal - e.fuelSolid - e.fuelRocket - (e.fuelNuclear||0) - (e.fuelWood||0));
  const cs = Math.min(invCount('cannon-shell'), TANK_SHELL_CAP - e.shells);
  const cu = Math.min(invCount('uranium-cannon-shell'), TANK_SHELL_CAP - e.uShells);
  const ce = Math.min(invCount('explosive-cannon-shell'), TANK_SHELL_CAP - e.eShells);
  const ceu = Math.min(invCount('explosive-uranium-cannon-shell'), TANK_SHELL_CAP - e.euShells);
  api.toggle('button[data-action="feed"][data-id="coal"]', cf > 0, '放入煤 ×' + cf);
  api.toggle('button[data-action="feed"][data-id="wood"]', cw > 0, '放入木材 ×' + cw);
  api.toggle('button[data-action="feed"][data-id="solid-fuel"]', csol > 0, '放入固体燃料 ×' + csol);
  api.toggle('button[data-action="feed"][data-id="nuclear-fuel"]', cnuc > 0, '放入核燃料 ×' + cnuc);
  api.toggle('button[data-action="feed"][data-id="rocket-fuel"]', crk > 0, '放入火箭燃料 ×' + crk);
  api.toggle('button[data-action="feed"][data-id="cannon-shell"]', cs > 0, '装填炮弹 ×' + cs);
  api.toggle('button[data-action="feed"][data-id="uranium-cannon-shell"]', cu > 0, '装填铀炮弹 ×' + cu);
  api.toggle('button[data-action="feed"][data-id="explosive-cannon-shell"]', ce > 0, '装填爆炸炮弹 ×' + ce);
  api.toggle('button[data-action="feed"][data-id="explosive-uranium-cannon-shell"]', ceu > 0, '装填铀爆炸炮弹 ×' + ceu);
  if (G.driving && G.driving.ent === e) api.status('驾驶中（空格开炮，E 下车）', 'ok');
  else if (e.fuelCoal <= 0 && e.fuelSolid <= 0 && e.fuelRocket <= 0 && (e.fuelNuclear||0) <= 0 && (e.fuelWood||0) <= 0) api.status('缺燃料：放入煤/木材/固体燃料/火箭燃料/核燃料后可驾驶', 'warn');
  else api.status('可驾驶', 'ok');
}
function tankTip(e) {
  if (G.driving && G.driving.ent === e) return '坦克驾驶中（空格开炮，E 下车）';
  return '坦克（煤 ' + (e.fuelCoal || 0) + (e.fuelWood > 0 ? '，木材 ' + e.fuelWood : '') + (e.fuelSolid > 0 ? '，固体燃料 ' + e.fuelSolid : '') + (e.fuelRocket > 0 ? '，火箭燃料 ' + e.fuelRocket : '') + (e.fuelNuclear > 0 ? '，核燃料 ' + e.fuelNuclear : '') + ' · 炮弹 ' + (e.shells || 0) + (e.uShells > 0 ? ' + 铀弹 ' + e.uShells : '') + (e.eShells > 0 ? ' + 爆炸弹 ' + e.eShells : '') + (e.euShells > 0 ? ' + 铀爆弹 ' + e.euShells : '') + '），按 E 进入驾驶';
}
function tankOnAction(act) {
  if (act === 'drive') {
    const t = G.panelEnt;
    if (t instanceof Tank) { enterCar(t); return true; }
  }
  return false;
}

// ===== 注册 =====
ENT_CLASSES['tank'] = Tank;
DEVICE_RENDER['tank'] = drawTank;
DEVICE_PANEL['tank'] = { html: tankPanelHtml, live: tankPanelLive, tip: tankTip, onAction: tankOnAction };
ENT_CLASSES['spidertron'] = Spidertron;
DEVICE_RENDER['spidertron'] = drawSpidertron;
DEVICE_PANEL['spidertron'] = { html: spiderPanelHtml, live: spiderPanelLive, tip: spiderTip, onAction: tankOnAction };
DEVICE_DIR_ROTATE['tank'] = true;
