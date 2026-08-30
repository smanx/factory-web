'use strict';

function pad2(n) { return (n < 10 ? '0' : '') + n; }
function escHtml(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ===== 存档文件 gzip 压缩 / 解压（使用浏览器原生 CompressionStream / DecompressionStream） =====

// 把 ReadableStream 完整读入 Uint8Array（兼容性更稳，规避个别浏览器 Response(stream).arrayBuffer() 的已知问题）
async function readStreamToBytes(stream) {
  const reader = stream.getReader();
  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const buf = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) { buf.set(c, off); off += c.length; }
  return buf;
}

// gzip 压缩：将字符串压缩为 Uint8Array
async function gzipCompress(text) {
  if (typeof CompressionStream === 'undefined') {
    throw new Error('当前浏览器不支持 gzip 压缩，请升级浏览器后重试');
  }
  if (typeof Blob.prototype.stream !== 'function') {
    throw new Error('当前浏览器不支持流式压缩，请升级浏览器后重试');
  }
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'));
  return await readStreamToBytes(stream);
}

// gzip 解压：将 Uint8Array 解压为字符串
async function gzipDecompress(bytes) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('当前浏览器不支持 gzip 解压，请升级浏览器后重试');
  }
  if (typeof Blob.prototype.stream !== 'function') {
    throw new Error('当前浏览器不支持流式解压，请升级浏览器后重试');
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
  const buf = await readStreamToBytes(stream);
  return new TextDecoder('utf-8').decode(buf);
}

// 判断字节数组是否为 gzip 文件（依据 gzip 魔数 1f 8b）
function isGzip(bytes) {
  return !!(bytes && bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b);
}

// 导出存档到文件：先 gzip 压缩再导出，减小文件体积
async function downloadSave() {
  try {
    const data = JSON.stringify(serializeAll());
    console.log('[存档导出] 序列化完成，文本长度 =', data.length);
    const bytes = await gzipCompress(data);
    console.log('[存档导出] gzip 压缩完成，压缩后大小 =', bytes.length, 'bytes');
    const blob = new Blob([bytes], { type: 'application/gzip' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    // 文件名追加打包版本号（bundle 顶部由 build.js 注入 __BUILD_VERSION__，未注入时兜底 dev）
    const ver = (typeof window !== 'undefined' && window.__BUILD_VERSION__) || 'dev';
    a.download = 'factory-save-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '-' + ver + '.json.gz';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    toast('存档已导出（gzip 压缩）');
  } catch (err) {
    toast('导出失败：' + err.message);
  }
}

// 单独导出某一条存档为 gzip 文件（供存档管理页每条存档的“导出”按钮使用）
async function exportSave(id) {
  try {
    const data = await readSave(id);
    if (!data) { toast('未找到该存档'); return; }
    const bytes = await gzipCompress(JSON.stringify(data));
    const blob = new Blob([bytes], { type: 'application/gzip' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const ver = (typeof window !== 'undefined' && window.__BUILD_VERSION__) || 'dev';
    const safeId = String(id).replace(/[^\w-]+/g, '');
    a.download = 'factory-save-' + safeId + '-' + ver + '.json.gz';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    toast('该存档已导出（gzip 压缩）');
  } catch (err) {
    toast('导出失败：' + err.message);
  }
}

// 从文件导入存档：支持 gzip 压缩文件，兼容旧的纯 JSON 文件（未压缩则直接导入）
async function importSaveFile(arrayBuffer) {
  try {
    const bytes = new Uint8Array(arrayBuffer);
    let text;
    if (isGzip(bytes)) {
      // 压缩文件：先解压再导入
      text = await gzipDecompress(bytes);
    } else {
      // 非压缩文件：兼容旧版本直接导入
      text = new TextDecoder('utf-8').decode(bytes);
    }
    importSaveText(text);
  } catch (err) {
    toast('导入失败：' + err.message);
  }
}

function importSaveText(text) {
  try {
    const d = JSON.parse(text);
    // 只做最基本的格式校验（必须是可解析的 JSON 对象），不再按存档版本号拦截。
    // 版本兼容性由用户依据导出文件名中标记的版本号自行判断。
    if (!d || typeof d !== 'object') {
      throw new Error('格式不正确');
    }
    // 导入成功后立即加载并进入游戏：先关闭所有弹框（设置面板/存档管理浮层/暂停菜单），
    // 再复用主菜单读档的进入流程（applySave + buildHotbar + enterGame + toast）。
    if (typeof closeSaveManage === 'function') closeSaveManage();
    if (typeof closePauseMenu === 'function') closePauseMenu();
    if (typeof closePanel === 'function') closePanel();
    if (typeof enterFromSave === 'function') {
      enterFromSave(d, '导入成功');
    } else {
      // 兜底：独立环境下仅有 applySave 可用时，直接应用存档并提示（不再自动进游戏）
      applySave(d);
      toast('导入成功');
    }
  } catch (err) {
    toast('导入失败：' + err.message);
  }
}

// 顶部菜单按钮已按用户要求移除（小地图左侧的按钮及展开列表），仅保留绿图操作栏初始化
function initTopButtons() {
  // 绿图操作栏：升级/降级/取消
  const greenbar = document.getElementById('greenbar');
  if (greenbar) greenbar.addEventListener('click', ev => {
    const b = ev.target.closest('[data-gact]');
    if (!b) return;
    const act = b.dataset.gact;
    if (act === 'cancel') { hideGreenBar(); G.greenRect = null; return; }
    greenAreaAction(act);
  });
  // 绿图筛选勾选：切换勾选时实时更新可升级/可降级统计，并在全部取消勾选时禁用升级/降级按钮
  if (greenbar) greenbar.addEventListener('change', ev => {
    const box = ev.target.closest('input[data-gtype]');
    if (!box || !G.greenFilter) return;
    G.greenFilter[box.dataset.gtype] = box.checked;
    const r = G.greenRect;
    if (!r) return;
    const stats = greenAreaStats(r, G.greenFilter);
    const t = greenbar.querySelector('.gb-t');
    if (t) t.textContent = '绿图 ' + (r.x1 - r.x0 + 1) + '×' + (r.y1 - r.y0 + 1) + '：可升级 ' + stats.up + ' · 可降级 ' + stats.down;
    const any = Object.keys(G.greenFilter).some(k => G.greenFilter[k]);
    greenbar.querySelectorAll('button[data-gact]').forEach(btn => {
      if (btn.dataset.gact !== 'cancel') btn.disabled = !any;
    });
  });
}

function updateHUD(dt, fps, ups) {
  const el = document.getElementById('hud-info');
  const p = G.player;
  // HUD 信息项改为可点击：点击弹出详情弹框（替代原先的悬停 title 提示）
  // 帧率/更新率：FPS 后紧跟斜杠显示 UPS（更新次数/秒）
  let hud = '<span class="hud-item" data-hud="fps">' + fps + ' / ' + ups + '</span>';
  if (G.settings.combat) {
    const hp = Math.max(0, Math.round(G.playerHP));
    const hpPct = G.playerHPmax > 0 ? hp / G.playerHPmax : 0;
    hud += '   <span class="hud-item" data-hud="hp" style="color:' + (hpPct > 0.5 ? '#57e389' : hpPct > 0.25 ? '#ffd23c' : '#ff5b5b') + '">♥ ' + hp + '/' + G.playerHPmax + '</span>';
    // 敌人进化度显示（对齐《异星工厂》Evolution factor）
    const evo = Math.round((G.evolution || 0) * 100);
    const evoColor = evo < 30 ? '#57e389' : evo < 60 ? '#ffd23c' : '#ff5b5b';
    hud += '   <span class="hud-item" data-hud="evo" style="color:' + evoColor + '">⬆ ' + evo + '%</span>';
  }
  if (G.weapon && isWeapon(G.weapon)) {
    hud += '   🔫 ' + WEAPONS[G.weapon].name;
  }
  if (G.armor && isArmor(G.armor)) {
    hud += '   🛡 ' + ARMORS[G.armor].name;
    // 模块化护甲：显示个人电网状态（含装备件数量）
    if (ARMORS[G.armor].grid && typeof equipCount === 'function' && typeof equipmentSerialize === 'function') {
      const eqN = (G.equipGrid || []).length;
      let pp = '';
      if (typeof G.personalPowerMax === 'number' && G.personalPowerMax > 0) {
        pp = ' · ⚡' + Math.round((G.personalPower || 0) / 1000) + '/' + Math.round(G.personalPowerMax / 1000) + 'MJ';
      }
      hud += ' <span style="opacity:.75">(' + eqN + ' 装备' + pp + ')</span>';
    }
  }
  if (G.driving && G.driving.ent) {
    const de = G.driving.ent;
    if (typeof Locomotive !== 'undefined' && (de instanceof Locomotive || de instanceof CargoWagon)) {
      hud += '   🚂 ' + (de instanceof Locomotive ? '火车驾驶' : '乘坐车厢') + '（E 下车' + (de instanceof Locomotive && G.driving.mode === 'drive' ? '，W 前进 / S 后退 / R 反转' : '') + '）';
    } else {
      hud += '   🚗 ' + (de instanceof Tank ? '坦克' : '装甲车') + '（E 下车）';
    }
  }
  el.innerHTML = hud;
  // 手搓合成队列：显示在左下角快捷栏右侧，仅显示图标
  renderCraftQueue();
  // 实时刷新左下角战斗快捷栏（弹药数量等）
  if (typeof refreshQuickbar === 'function') refreshQuickbar();
}

// 渲染左下角快捷栏右侧的手搓合成队列（仅图标，队首当前在制项带 loading 效果）
function renderCraftQueue() {
  const box = document.getElementById('craft-queue');
  if (!box) return;
  if (!G.craftQueue || G.craftQueue.length === 0) {
    if (box.style.display !== 'none') box.style.display = 'none';
    if (box.innerHTML !== '') box.innerHTML = '';
    return;
  }
  if (box.style.display !== 'flex') box.style.display = 'flex';
  const qs = G.craftQueue.map(q => q.outId);
  let html = '';
  qs.forEach((outId, idx) => {
    const nm = (ITEMS[outId] && ITEMS[outId].name) || outId;
    const cls = idx === 0 ? 'cq-slot cq-working' : 'cq-slot cq-queued';
    // 排队项计数：统计该物品在队列中出现的次数（角标）
    const cnt = qs.filter(x => x === outId).length;
    html += '<div class="' + cls + '" data-itemid="' + outId + '"' +
      ' data-tip="' + nm + (idx === 0 ? '（制作中）' : '（排队中）') + '·点击取消制作">' +
      '<img src="' + iconDataURL(outId, 32) + '">' +
      (cnt > 1 ? '<span class="cq-cnt">×' + cnt + '</span>' : '') +
      '</div>';
  });
  if (box.innerHTML !== html) box.innerHTML = html;
  // 队首在制项的 loading 圆环由倒计时进度（done/total）驱动旋转，不持续匀速转圈
  const cur = G.craftQueue[0];
  const work = box.querySelector('.cq-working');
  if (work && cur && cur.total > 0) {
    const prog = Math.min(1, Math.max(0, cur.done / cur.total));
    work.style.setProperty('--cq-progress', prog);
  }
  // 点击任一队列图标即取消整个制作队列（返还排队材料）
  Array.prototype.forEach.call(box.querySelectorAll('.cq-slot'), slot => {
    slot.onclick = () => { cancelCraftQueue(); toast('已取消制作（返还排队材料）'); };
  });
}

// ===== HUD 详情弹框：点击 HUD 信息项弹出详情及描述（替代原先悬停 title 提示）=====
function showHudInfo(key, el) {
  const titleEl = document.getElementById('hud-modal-title');
  const body = document.getElementById('hud-modal-body');
  if (!titleEl || !body) return;
  const hp = Math.max(0, Math.round(G.playerHP));
  const evo = Math.round((G.evolution || 0) * 100);
  let title = 'HUD 详情', desc = '', detail = '';
  if (key === 'fps') {
    title = '帧率 / 更新率 (FPS / UPS)';
    desc = 'FPS 为每秒渲染帧数，反映画面流畅度；UPS 为每秒实际执行的逻辑更新次数。推进游戏速度（调试面板的变量 timeScale）会使 UPS 上升。';
    const t = el ? el.textContent : '-- / --';
    detail = '当前 FPS / UPS：' + t + '。<br>建议保持 30 以上以获流畅体验；UPS 受每秒最多补跑次数（MAX_TICK_STEPS）与渲染帧率上限约束。';
  } else if (key === 'hp') {
    title = '生命值 (HP)';
    desc = '玩家的当前生命值与最大生命值。受到敌人攻击会减少，生命值归零则死亡。';
    detail = '当前生命值：' + hp + '/' + (G.playerHPmax || 0) + '。<br>生命过低时请尽快远离敌人，使用医疗包、急救箱或进入载具避险恢复。';
  } else if (key === 'evo') {
    title = '敌人进化度 (Evolution)';
    desc = '随时间与击杀不断增长的敌人强度指标。进化度越高，刷出的敌人越强、越容易出现高级变种。';
    detail = '当前进化度：' + evo + '%。<br>0~30%：敌人较弱；30~60%：中等；60%+：较强。<br>进化度达到 0.9 后解锁巨兽级（Behemoth）敌人（巨兽甲虫/吐痰虫/蠕虫，属性最强）。';
  }
  titleEl.textContent = title;
  body.innerHTML = '<div class="hud-desc">' + desc + '</div><div class="hud-detail">' + detail + '</div>';
  document.getElementById('hud-modal').classList.remove('hidden');
}

function closeHudInfo() {
  document.getElementById('hud-modal').classList.add('hidden');
}

function initHudInfo() {
  // HUD 详情弹框支持点中标题栏拖动
  makeTitleDraggable(document.getElementById('hud-modal'), document.getElementById('hud-modal-head'));
  document.addEventListener('click', ev => {
    const item = ev.target && ev.target.closest ? ev.target.closest('#hud-info .hud-item') : null;
    if (item) {
      showHudInfo(item.getAttribute('data-hud'), item);
      ev.stopPropagation();
    } else if (ev.target && ev.target.id === 'hud-modal-close') {
      closeHudInfo();
      ev.stopPropagation();
    }
  });
}

function enemyAtTile(tx, ty) {
  const list = G.enemies || [];
  for (let i = 0; i < list.length; i++) {
    const en = list[i];
    if (en.dead) continue;
    // 敌人中心所在格，且按其体型（size）扩大判定到所占范围，鼠标指向其任意身体部分均能识别
    const cx = Math.floor(en.x / TILE), cy = Math.floor(en.y / TILE);
    // 虫巢为 SPAWNER_FOOT×SPAWNER_FOOT 占地：以中心所在格为中心，向四周各覆盖 foot/2 格
    let half;
    if (en.kind === 'spawner') half = Math.max(0, (en.foot || 4) / 2);
    else half = Math.max(0, Math.ceil((en.size || 6) / TILE) - 1);
    if (Math.abs(tx - cx) <= half && Math.abs(ty - cy) <= half) return en;
  }
  return null;
}

// 敌人简要介绍：由类型属性生成（对齐《异星工厂》虫族图鉴感）
function enemyDesc(en) {
  const d = ENEMY_TYPES[en.type];
  if (!d) return '敌对单位';
  const kindTxt = en.kind === 'spawner' ? '虫巢' : (d.kind === 'ranged' ? '远程单位，会喷吐攻击' : '近战单位，会冲向并攻击建筑');
  return kindTxt + '；生命 ' + (en.maxhp || d.hp) + '，攻击 ' + (en.dmg || d.dmg) + '。可点击攻击或建造炮塔防御。';
}

// 地图悬停详情文案（名称|描述）：供小地图下方信息面板（drawDeviceInfoBar）在非设备瓦片时使用。
function mapTipAt(tx, ty) {
  // 显示详情时：鼠标移到某流体出入口图标上，优先显示该流体的具体名称
  if (G.showDetails) {
    // 性能优化：仅检查光标所在格被占位的实体（entAt），替代遍历全部 G.ents 寻找流体图标。
    // 流体接口图标都在实体自身占地格（含边缘端口格），故 entAt(tx,ty) 命中的实体即为原逻辑中唯一匹配者，行为一致。
    const _fe = entAt(tx, ty);
    if (_fe && !_fe._dead) {
      const fn = DEVICE_FLUID_ICONS[_fe.type];
      if (fn) {
        for (const ic of fn(_fe)) {
          if (ic.x === tx && ic.y === ty && ITEMS[ic.fluid]) {
            return ITEMS[ic.fluid].name + '|' + ITEMS[ic.fluid].desc;
          }
        }
      }
    }
  }
  const e = entAt(tx, ty);
  if (e) {
    // 设备状态文案由各设备文件提供（DEVICE_PANEL[type].tip）
    let extra = '';
    const panel = DEVICE_PANEL[e.type];
    if (panel && panel.tip) {
      const t = panel.tip(e);
      if (t) extra = t;
    }
    return ITEMS[e.type].name + '|' + extra;
  }
  // 敌人生成在格子中央，悬停到其上时优先显示敌人具体名称（对齐《异星工厂》）
  const enemy = enemyAtTile(tx, ty);
  if (enemy) {
    const d = ENEMY_TYPES[enemy.type];
    const nm = d ? d.name : (enemy.kind === 'spawner' ? '虫巢' : '敌人');
    return nm + '|点击查看详细说明';
  }
  if (getTerrain(tx, ty) === T_CLIFF) return '峭壁|不可通行、不可建造的地形障碍；可手持峭壁炸药点击清除';
  if (getTerrain(tx, ty) === T_WATER) return '水域|无法通行；可把抽水机放在这里取水';
  // 树木：悬停显示树木信息（对齐《异星工厂》：树木是资源型地形，可砍伐）
  if (getTerrain(tx, ty) === T_TREE) return '树木|可砍伐获得木材；手持斧头/开采工具按住右键砍伐，或直接在其上铺设建筑自动清理';
  const ti = getOreType(tx, ty);
  if (ti >= 0 && getOreAmt(tx, ty) > 0) {
    if (ti === ORE_OIL) {
      const rate = Math.round(getOilRate(tx, ty) * 100); // 出产率百分比（旧档默认 100%）
      return '原油矿床|出产率 ' + rate + '%，储量 ' + Math.floor(getOreAmt(tx, ty)) + '，建造抽油机开采（吃电力）';
    }
    const nm = oreItemId(ti);
    return (ITEMS[nm] ? ITEMS[nm].name : '未知矿') + '|储量 ' + Math.floor(getOreAmt(tx, ty)) + '，按住右键开采';
  }
  return null;
}

function initTooltips() {
  const tip = document.getElementById('tooltip');
  // 配方卡悬浮层：悬停配方槽时在鼠标旁展示完整的「配方卡」（与普通 tooltip 互斥）
  let rcp = document.getElementById('rcp-tip');
  if (!rcp) {
    rcp = document.createElement('div');
    rcp.id = 'rcp-tip';
    document.body.appendChild(rcp);
  }
  // 把浮动框摆到鼠标旁，越界时翻转到左侧/上方
  function placeNear(el, clientX, clientY) {
    el.style.display = 'block';
    const r = el.getBoundingClientRect();
    let x = clientX + 14, y = clientY + 14;
    if (x + r.width > innerWidth - 6) x = clientX - r.width - 14;
    if (y + r.height > innerHeight - 6) y = clientY - r.height - 14;
    if (x < 4) x = 4;
    if (y < 4) y = 4;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
  }
  document.addEventListener('mousemove', ev => {
    let text = null;
    const el = (ev.target && ev.target.closest) ? ev.target.closest('[data-tip]') : null;
    const slot = (ev.target && ev.target.closest) ? ev.target.closest('.rcp-slot[data-id], .craft-slot[data-id]') : null;
    // 设备面板「当前配方」值（图标+名称）：悬停弹出与配方选择一致的配方卡
    const recVal = (ev.target && ev.target.closest) ? ev.target.closest('[data-rec-id]') : null;
    if (recVal && recVal.dataset.recId) {
      const html = (typeof recipeCardHtml === 'function') ? recipeCardHtml(recVal.dataset.recId) : '';
      if (html) {
        tip.style.display = 'none';
        rcp.innerHTML = html;
        placeNear(rcp, ev.clientX, ev.clientY);
        return;
      }
    }
    if (slot && slot.dataset.id) {
      // 悬停配方槽：优先显示“配方卡”
      const html = (typeof recipeCardHtml === 'function') ? recipeCardHtml(slot.dataset.id) : '';
      if (html) {
        tip.style.display = 'none';
        rcp.innerHTML = html;
        placeNear(rcp, ev.clientX, ev.clientY);
        return;
      }
    }
    if (el) text = el.dataset.tip;
    // 地图画布上不再显示鼠标附近的详情悬浮框（需求：地图详情只在小地图下方显示，见 drawDeviceInfoBar）；
    // 非地图界面（背包/设备面板等 data-tip 元素）的鼠标旁悬浮框保持不变。
    // 不在配方槽上：隐藏配方卡，回退到普通 tooltip
    rcp.style.display = 'none';
    if (text) {
      const parts = text.split('||');
      const p = parts[0].split('|');
      tip.querySelector('b').textContent = p[0] || '';
      tip.querySelector('span').textContent = p.slice(1).join('|') || '';
      const recipeEl = tip.querySelector('#tooltip-recipe');
      if (recipeEl) {
        recipeEl.textContent = parts[1] || '';
        // 注意：不能用 style.display=''，那会清掉内联样式并回退到 CSS 的 display:none，导致配方永远隐藏。
        // 必须显式设为 block 才能覆盖样式表中的 display:none。
        recipeEl.style.display = parts[1] ? 'block' : 'none';
      }
      tip.style.display = 'block';
      const r = tip.getBoundingClientRect();
      let x = ev.clientX + 14, y = ev.clientY + 16;
      if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - 10;
      if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - 10;
      tip.style.left = x + 'px';
      tip.style.top = y + 'px';
    } else {
      tip.style.display = 'none';
    }
  });
}

// ===== 调试面板（buildDebug / refreshDebugPanel / dbgSlider） =====
// 调试面板相关功能已拆分到独立文件 js/ui-debug.js，此处不再重复。

