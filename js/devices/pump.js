'use strict';

// ===== 抽水机：必须放在水面上，免电力无限取水 =====
// 朝向约定：dir 表示"出水口"所在世界方向（0=东,1=南,2=西,3=北）。
// 抽水机只有一个出水口，且必须落在"短边"（宽 1 的那条边）上——出水方向沿机身长轴：
//   dir=0/2（偶数，出水朝东/西）→ 2×1 横放，长轴沿东西，东/西边缘是短边（唯一出口）
//   dir=1/3（奇数，出水朝南/北）→ 1×2 纵放，长轴沿南北，南/北边缘是短边（唯一出口）
// 两侧（长边，长 2）禁止接管。
class Pump extends Entity {
  constructor(type, x, y) {
    super('offshore-pump', x, y);
    this.buf = 0;
    this.working = false;
    this.pulse = 0;
    this.applyDir();
  }
  // 整个设备随方向旋转（与 rotSwap 通用约定一致）：dir 偶数横向 2×1（东西短边出水），dir 奇数纵向 1×2（南北短边出水）
  applyDir() {
    if (this.dir % 2 === 0) { this.w = this.def.w; this.h = this.def.h; }  // 2×1 横向
    else { this.w = this.def.h; this.h = this.def.w; }                      // 1×2 纵向
  }
  update(dt) {
    this.working = false;
    const room = Math.max(0, WATER_CAP - this.buf);
    const take = Math.min(room, PUMP_RATE * dt);
    if (take > 0) { this.buf += take; this.working = true; }
    if (this.working) this.pulse = (this.pulse + dt * 1.6) % 1;
    // 泵音效节流（仅屏内可见时播放，约每 1.1 秒一次，避免连续刷音）
    this._pumpSfxT = (this._pumpSfxT || 0) - dt;
    if (this.working && this._pumpSfxT <= 0 && typeof onScreen === 'function' && onScreen(this)) {
      this._pumpSfxT = 1.1;
      if (typeof playSfx === 'function') playSfx('pump');
    }
    this.tryOutput();
  }
  // 只朝短边方向（出水侧）输出，出口永远在脚印短边外侧正中：
  //   dir=0 东 → (x+w, y)=(x+2, y)（东短边外）；dir=1 南 → (x, y+h)=(x, y+2)（南短边外）；
  //   dir=2 西 → (x-1, y)（西短边外，原点格侧）；dir=3 北 → (x, y-1)（北短边外，原点格侧）
  tryOutput() {
    let guard = 0;
    while (this.buf >= 1 && guard++ < 20) {
      let cx, cy;
      if (this.dir === 0) { cx = this.x + this.w; cy = this.y; }       // 东（右）
      else if (this.dir === 1) { cx = this.x; cy = this.y + this.h; }  // 南（下）
      else if (this.dir === 2) { cx = this.x - 1; cy = this.y; }       // 西（左）
      else { cx = this.x; cy = this.y - 1; }                            // 北（上）
      const t = entAt(cx, cy);
      // 抽水机出水可排入普通管道或地下管道（管口朝抽水机）
      if (pipeConnAt(cx, cy, this.dir)) {
        if (!t.giveItem('water')) break;
      } else if (t instanceof Boiler) {
        if (!t.acceptsPumpFeed(cx, cy, this.dir) || !t.giveItem('water')) break;
      } else break;
      this.buf--;
    }
  }
  giveItem(item) {
    if (item === 'water' && this.buf < WATER_CAP) { this.buf++; return true; }
    return false;
  }
  peekItem() { return this.buf >= 1 ? 'water' : null; }
  takeItem() { if (this.buf >= 1) { this.buf--; return 'water'; } return null; }
  countOf(item) { return item === 'water' ? Math.floor(this.buf) : 0; }
  takeItemOf(item) { if (item === 'water' && this.buf >= 1) { this.buf--; return 'water'; } return null; }
  contents() {
    const list = [[this.type, 1]];
    if (this.buf >= 1) list.push(['water', Math.floor(this.buf)]);
    return list;
  }
  serialize() { const s = super.serialize(); s.buf = this.buf; return s; }
  static restore(s) {
    const p = new Pump(s.type, s.x, s.y);
    p.dir = s.dir | 0;
    p.applyDir();
    p.buf = s.buf || 0;
    return p;
  }
}

// ===== 渲染 =====
// 立式抽水泵塔（基准 1×2 纵放，整座随 dir 旋转）。
// 【关键几何约定】：
//   · 占地：dir=0/2 → 2×1 横放（东西短边出水）、dir=1/3 → 1×2 纵放（南北短边出水）
//     （见 applyDir；def=2×1，rotSwap 通用约定为 dir 奇数交换宽高）；
//   · 局部布局（纵放基准）：x∈[-16,16] 为短轴、y∈[-32,32] 为长轴；
//     原点格 -y 半边、副格 +y 半边；-y 端 = 出水端（头），+y 端 = 进水基墩端（尾）；
//   · 出水口固定画在局部 -y 端部短边中线（(0,-32) 一带），经 rotate((dir+1)·90°)
//     后局部 -y 端恰好指向世界 dir 方向——出水口永远落在"朝 dir 的那条短边"外侧
//     中点，与 tryOutput 的目标格（短边外邻格，管道接口所在）严格对齐；
//   · 出水口位于长轴端部 + 短轴中线，纯旋转即可保证对齐，无需镜像修正
//     （旧版出口画在长边半区，原点格随 dir 漂移会与邻管错开 16px，才需要镜像）。
//     dir=0/1 时蜗壳/观察窗相对原点格换位、dir=2/3 稳定——仅为内部视觉分布，
//     不影响出水口与管道的衔接。
// 视觉分区（统一布局坐标：原点格 y∈[-32,0]、副格 y∈[0,32]，全部元素都在脚印内）：
//   ① 出水端封头（原点格外缘：出水管从中央穿出）
//   ② 塔身（钢蓝渐变 + 铆钉）
//   ③ 泵芯蜗壳（原点格中央：径向渐变 + 旋转叶轮"风扇" + 状态 LED）
//   ④ 出水管（蜗壳顶部 → -y 端部短边 + 法兰 + 蓝色出水孔，对齐邻管接口）——全机唯一管口
//   ⑤ 方向箭头（印在塔身，指向出水方向 -y）
//   ⑥ 水位观察窗（副格：玻璃 + 水位 + 上升气泡）
//   ⑦ 底座基墩（副格外缘：进水格栅——泵浮在水面，水从基座下方格栅吸入，
//      不在长边另画突出口，避免被误认成"长边上的第二个出口"）
function drawPump(ctx, e, gx, gy, dir, alpha) {
  const px = gx * TILE, py = gy * TILE;
  const cx = px + TILE * e.w / 2, cy = py + TILE * e.h / 2;
  ctx.globalAlpha = alpha;
  ctx.save();
  ctx.translate(cx, cy);
  // 旋转 (dir+1)·90°：使局部 -y 端（出水端）指向世界 dir 方向（见函数头注释）
  ctx.rotate((dir + 1) * Math.PI / 2);

  const wp = Math.max(0, Math.min(1, (e.buf || 0) / WATER_CAP));
  const working = !!e.working;

  // ⑦ 底座基墩（x∈[-14,14] y∈[21,31]，延伸到脚印底边）+ 正面进水格栅
  const baseGrad = ctx.createLinearGradient(0, 21, 0, 31);
  baseGrad.addColorStop(0, '#3e607a');
  baseGrad.addColorStop(1, '#102a3a');
  ctx.fillStyle = baseGrad;
  rr(ctx, -14, 21, 28, 10, 2.5); ctx.fill();
  ctx.strokeStyle = '#0a1a26';
  ctx.lineWidth = 1;
  rr(ctx, -14, 21, 28, 10, 2.5); ctx.stroke();
  ctx.fillStyle = '#0a1a26';
  ctx.fillRect(-8, 23, 16, 1.6);      // 格栅横条 1
  ctx.fillRect(-8, 25.6, 16, 1.6);    // 格栅横条 2
  ctx.fillRect(-8, 28.2, 16, 1.6);    // 格栅横条 3
  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.fillRect(-12, 22, 24, 0.6);     // 基墩顶面高光
  // 格栅缝隙里的进水微光（含水量越多越亮——表示水正从下方被吸入）
  ctx.fillStyle = 'rgba(63,160,232,' + (0.18 + wp * 0.35).toFixed(2) + ')';
  ctx.fillRect(-7.5, 24.6, 15, 1);
  ctx.fillRect(-7.5, 27.2, 15, 1);

  // ② 塔身（x∈[-12,12] y∈[-29,21]，钢蓝纵向渐变）
  const towerGrad = ctx.createLinearGradient(0, -29, 0, 21);
  towerGrad.addColorStop(0, '#4a8aa8');
  towerGrad.addColorStop(0.55, '#2a5a78');
  towerGrad.addColorStop(1, '#123246');
  ctx.fillStyle = towerGrad;
  rr(ctx, -12, -29, 24, 50, 5); ctx.fill();
  ctx.strokeStyle = '#0a1a26';
  ctx.lineWidth = 1.2;
  rr(ctx, -12, -29, 24, 50, 5); ctx.stroke();

  // ① 出水端封头（x∈[-13,13] y∈[-31,-26]，略宽出塔身一档：出水管从中央穿出）
  ctx.fillStyle = '#4a8aa8';
  rr(ctx, -13, -31, 26, 6, 2); ctx.fill();
  ctx.strokeStyle = '#0a1a26';
  ctx.lineWidth = 1;
  rr(ctx, -13, -31, 26, 6, 2); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(-11, -30, 22, 0.8);

  // ⑥ 水位观察窗（副格 x∈[-7,7] y∈[9,23]：深框 + 玻璃 + 水位 + 气泡）
  ctx.fillStyle = '#0a1a26';
  rr(ctx, -7, 9, 14, 14, 3); ctx.fill();
  ctx.save();
  rr(ctx, -6, 10, 12, 12, 2.5); ctx.clip();
  ctx.fillStyle = 'rgba(8,18,28,0.95)';
  ctx.fillRect(-6, 10, 12, 12);
  if (wp > 0) {
    // 水位按 buf/WATER_CAP 从窗底向上填，运转时水面微微起伏
    const wTop = 22 - 12 * wp + (working ? Math.sin((e.pulse || 0) * Math.PI * 2) * 0.5 : 0);
    const wGrad = ctx.createLinearGradient(0, wTop, 0, 22);
    wGrad.addColorStop(0, _pumpMix('#3fa0e8', 0.85));
    wGrad.addColorStop(1, _pumpMix('#1a5a8a', 0.95));
    ctx.fillStyle = wGrad;
    ctx.fillRect(-6, wTop, 12, 22 - wTop);
    ctx.fillStyle = 'rgba(220,240,255,0.55)';
    ctx.fillRect(-5, wTop, 10, 0.7);   // 水面高光
  }
  // 运转时气泡上升
  if (working) {
    ctx.fillStyle = 'rgba(200,235,255,0.6)';
    for (let i = 0; i < 3; i++) {
      const t = ((G.time || 0) * 0.7 + i / 3) % 1;
      ctx.beginPath();
      ctx.arc(-3 + i * 3 + Math.sin(t * 5 + i) * 1.2, 22 - t * 11, 0.7 + t * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
  // 玻璃亮边 + 左上高光
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 0.8;
  rr(ctx, -7, 9, 14, 14, 3); ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,0.4)';
  ctx.beginPath();
  ctx.arc(-3, 13, 3.5, Math.PI * 1.1, Math.PI * 1.5);
  ctx.stroke();

  // ④ 出水管（蜗壳顶部 → -y 端部短边中线 x∈[-3,3]：穿过封头，对齐邻管接口）——全机唯一管口
  ctx.fillStyle = '#12293b';
  rr(ctx, -3, -28.5, 6, 6.5, 1.5); ctx.fill();
  ctx.fillStyle = '#1d4258';
  rr(ctx, -2, -27.5, 4, 4.5, 1.2); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fillRect(-2.5, -27, 0.7, 4);     // 管段左沿高光
  // 出水法兰（x∈[-4.5,4.5] y∈[-31,-28]）+ 蓝色出水孔（含水量越多越实）
  ctx.fillStyle = '#0a1a26';
  rr(ctx, -4.5, -31, 9, 3, 1.2); ctx.fill();
  ctx.fillStyle = _pumpMix('#3fa0e8', Math.max(0.3, wp));
  ctx.beginPath(); ctx.arc(0, -29.5, 1.8, 0, Math.PI * 2); ctx.fill();

  // ③ 泵芯蜗壳（原点格中央 (0,-16) r=8：径向渐变金属盘）
  const motorGrad = ctx.createRadialGradient(-2, -18, 1, 0, -16, 8);
  motorGrad.addColorStop(0, '#9ce0e8');
  motorGrad.addColorStop(0.55, '#3f9fc0');
  motorGrad.addColorStop(1, '#1a5a78');
  ctx.fillStyle = motorGrad;
  ctx.beginPath(); ctx.arc(0, -16, 8, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#0a1a26';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.arc(0, -16, 8, 0, Math.PI * 2); ctx.stroke();
  // 蜗壳高光
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.beginPath(); ctx.arc(-2.5, -18.5, 1.8, 0, Math.PI * 2); ctx.fill();
  // 旋转叶轮（"风扇"：4 叶片绕中心旋转，运转时可见）
  if (working) {
    ctx.save();
    ctx.translate(0, -16);
    ctx.rotate((e.pulse || 0) * Math.PI * 5);
    ctx.fillStyle = '#d8f0f4';
    for (let i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -1.3);
      ctx.lineTo(6.2, -2.1);
      ctx.lineTo(6.2, 2.1);
      ctx.lineTo(0, 1.3);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#5a8a92';
    ctx.beginPath(); ctx.arc(0, 0, 1.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0a1a26';
    ctx.beginPath(); ctx.arc(0, 0, 0.8, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else {
    // 待机：静态轮毂
    ctx.fillStyle = 'rgba(150,180,200,0.5)';
    ctx.beginPath(); ctx.arc(0, -16, 2, 0, Math.PI * 2); ctx.fill();
  }
  // 状态 LED（蜗壳右下缘：运转绿 / 待机暗）
  ctx.fillStyle = working ? '#9ce06c' : '#3a4a62';
  ctx.beginPath(); ctx.arc(5.5, -11.5, 1.3, 0, Math.PI * 2); ctx.fill();
  if (working) {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.arc(5.1, -11.9, 0.45, 0, Math.PI * 2); ctx.fill();
  }

  // ⑤ 方向箭头（印在塔身蜗壳下方，指向出水方向 -y：x∈[-3,3] y∈[2,8]）
  ctx.fillStyle = dirColorNotch(dir);
  ctx.beginPath();
  ctx.moveTo(0, 2);
  ctx.lineTo(-3, 8);
  ctx.lineTo(3, 8);
  ctx.closePath();
  ctx.fill();

  // 铆钉（塔身）与螺栓（基墩）
  const bolt = (bx, by) => {
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath(); ctx.arc(bx, by, 1.3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#0a1a26';
    ctx.beginPath(); ctx.arc(bx, by, 0.9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(180,225,250,0.4)';
    ctx.beginPath(); ctx.arc(bx - 0.3, by - 0.3, 0.45, 0, Math.PI * 2); ctx.fill();
  };
  bolt(-10, -24);   // 塔身·蜗壳上方两侧
  bolt(10, -24);
  bolt(-10, 16);    // 塔身·观察窗两侧
  bolt(10, 16);
  bolt(-11, 27);    // 基墩两角
  bolt(11, 27);

  ctx.restore();
  ctx.globalAlpha = 1;
}
function _pumpMix(hex, t) {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 'rgba(' + r + ',' + g + ',' + b + ',' + t.toFixed(3) + ')';
}

// ===== 面板 =====
function pumpPanelHtml(e) {
  let h = row('储水', '<span class="dim"></span>', 'buf');
  h += '<div class="dim">必须放在水面上，免电力无限抽水。只有短边那一格能接管道出水，两侧（长边方向）禁止接管道。选中后按 R 旋转方向。</div>';
  return h;
}
function pumpPanelLive(e, api) {
  api.set('buf', e.buf >= 1 ? '<div class="asm3-inp-row">' + itemSlotsHtml({ water: Math.floor(e.buf) }, { action: 'display' }) + '</div>' : dimSpan('空'));
  api.prog(e.working ? e.pulse * 100 : ((e.buf || 0) / WATER_CAP * 100));
  if (e.working) api.status('抽水中，产出朝' + ['东', '南', '西', '北'][e.dir], 'ok');
  else if (e.buf >= 1) api.status('已暂停：缓存已满，等待输出', 'warn');
  else api.status('待机：等待抽水', 'ok');
}
function pumpTip(e) {
  return e.working ? '抽水中，产出朝' + ['东', '南', '西', '北'][e.dir]
    : ((e.buf || 0) >= 1 ? '缓存满，等待输出' : '待机');
}

// ===== 注册 =====
ENT_CLASSES['offshore-pump'] = Pump;
DEVICE_RENDER['offshore-pump'] = drawPump;
DEVICE_STATUS['offshore-pump'] = e => e.working ? 'g' : ((e.buf || 0) >= 1 ? 'y' : 'r');
DEVICE_PANEL['offshore-pump'] = { html: pumpPanelHtml, live: pumpPanelLive, tip: pumpTip };
// 放置规则：只能放在水面上的空格（完全替换默认校验）
DEVICE_PLACE['offshore-pump'] = (type, tx, ty, dir, ew, eh) => {
  // dir 偶数(0/2)→2×1 横放、dir 奇数(1/3)→1×2 纵放（与 rotSwap 通用约定一致）：以方向后的实际脚印校验
  if (!ew) ew = (dir % 2 === 0) ? 2 : 1;
  if (!eh) eh = (dir % 2 === 0) ? 1 : 2;
  for (let dy = 0; dy < eh; dy++)
    for (let dx = 0; dx < ew; dx++) {
      const cx = tx + dx, cy = ty + dy;
      if (!isWater(cx, cy) || entAt(cx, cy) || !withinReach(cx, cy)) return { ok: false };
    }
  return { ok: true };
};
DEVICE_DIR_ROTATE['offshore-pump'] = true;

// 抽水机旋转/翻转后新脚印是否仍合法：必须仍全压水面、不与其它实体重叠、且在触及范围内
function pumpCanFace(e, newDir) {
  const def = BUILD_DEFS['offshore-pump'];
  let ew = def.w, eh = def.h;
  if (newDir % 2 === 0) { ew = def.w; eh = def.h; }  // 2×1 横向（东西短边出水）
  else { ew = def.h; eh = def.w; }                   // 1×2 纵向（南北短边出水）
  for (let dy = 0; dy < eh; dy++)
    for (let dx = 0; dx < ew; dx++) {
      const cx = e.x + dx, cy = e.y + dy;
      if (!isWater(cx, cy)) return false;
      const t = entAt(cx, cy);
      if (t && t !== e) return false;
      if (!withinReach(cx, cy)) return false;
    }
  return true;
}
