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
    a.download = 'factory-save-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.json.gz';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1500);
    toast('存档已导出（gzip 压缩）');
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
    if (!d || d.v !== 1) {
      throw new Error('格式不正确');
    }
    applySave(d);
    closePanel();
    toast('导入成功');
  } catch (err) {
    toast('导入失败：' + err.message);
  }
}

function initTopButtons() {
  // 顶部菜单折叠/展开
  const topMenu = document.getElementById('topright');
  const menuToggle = document.getElementById('btn-menu-toggle');
  if (topMenu && menuToggle) {
    // 默认折叠顶部菜单（与 index.html 中 #topright 默认 collapsed 保持一致）
    const isCollapsed = topMenu.classList.contains('collapsed');
    menuToggle.textContent = isCollapsed ? '☰' : '✕';
    menuToggle.title = isCollapsed ? '展开顶部菜单' : '折叠顶部菜单';
    menuToggle.addEventListener('click', () => {
      const collapsed = topMenu.classList.toggle('collapsed');
      menuToggle.textContent = collapsed ? '☰' : '✕';
      menuToggle.title = collapsed ? '展开顶部菜单' : '折叠顶部菜单';
    });
  }
  document.getElementById('btn-inv').addEventListener('click', () =>
    G.panelMode === 'inv' ? closePanel() : openPanel('inv'));
  document.getElementById('btn-tech').addEventListener('click', () =>
    G.panelMode === 'tech' ? closePanel() : openPanel('tech'));
  document.getElementById('btn-stats').addEventListener('click', () =>
    G.panelMode === 'stats' ? closePanel() : openPanel('stats'));
  const achBtn = document.getElementById('btn-ach');
  if (achBtn) achBtn.addEventListener('click', () =>
    G.panelMode === 'ach' ? closePanel() : openPanel('ach'));
  document.getElementById('btn-blue').addEventListener('click', () => {
    closePanel();
    toggleBlueprint('blue');
  });
  document.getElementById('btn-red').addEventListener('click', () => {
    closePanel();
    toggleBlueprint('red');
  });
  document.getElementById('btn-green').addEventListener('click', () => {
    closePanel();
    toggleBlueprint('green');
  });
  // 绿图操作栏：升级/降级/取消
  const greenbar = document.getElementById('greenbar');
  if (greenbar) greenbar.addEventListener('click', ev => {
    const b = ev.target.closest('[data-gact]');
    if (!b) return;
    const act = b.dataset.gact;
    if (act === 'cancel') { hideGreenBar(); G.greenRect = null; return; }
    greenAreaAction(act);
  });
  document.getElementById('btn-set').addEventListener('click', () =>
    G.panelMode === 'set' ? closePanel() : openPanel('set'));
  // 顶部“暂停/继续”按钮：切换游戏暂停状态，并更新按钮文字
  const pauseBtn = document.getElementById('btn-pause');
  if (pauseBtn) {
    const syncPauseBtn = () => {
      if (G.paused) { pauseBtn.textContent = '▶ 继续'; pauseBtn.title = '继续游戏'; }
      else { pauseBtn.textContent = '⏸ 暂停'; pauseBtn.title = '暂停游戏'; }
    };
    pauseBtn.addEventListener('click', () => {
      G.paused = !G.paused;
      syncPauseBtn();
      if (typeof playSfx === 'function') playSfx('click');
      if (G.paused) toast('游戏已暂停');
      else toast('游戏继续');
    });
    syncPauseBtn();
  }
}

function updateHUD(dt, fps) {
  const el = document.getElementById('hud-info');
  const p = G.player;
  const tx = Math.floor(p.x / TILE), ty = Math.floor(p.y / TILE);
  // HUD 信息项改为可点击：点击弹出详情弹框（替代原先的悬停 title 提示）
  let hud = '<span class="hud-item" data-hud="fps">' + fps + '</span>   <span class="hud-item" data-hud="coord">(' + tx + ',' + ty + ')</span>';
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
  // 手搓合成队列进度
  const cur = craftCurrent();
  if (cur) {
    const pct = Math.min(100, (cur.done / cur.time) * 100);
    const nm = (ITEMS[cur.outId] && ITEMS[cur.outId].name) || cur.outId;
    const rest = (G.craftQueue ? G.craftQueue.length - 1 : 0);
    hud += '   <span style="color:#7fd4a0">⚒ ' + nm +
      (rest > 0 ? ' (+' + rest + ')' : '') + ' ' + pct.toFixed(0) + '%' +
      ' <a href="javascript:void(0)" id="craft-cancel" style="color:#ff8a8a;pointer-events:auto;text-decoration:none" title="取消制作">✕</a></span>';
  }
  el.innerHTML = hud;
  const cc = document.getElementById('craft-cancel');
  if (cc) {
    cc.onclick = () => { cancelCraftQueue(); toast('已取消制作（返还排队材料）'); };
  }
}

// ===== HUD 详情弹框：点击 HUD 信息项弹出详情及描述（替代原先悬停 title 提示）=====
function showHudInfo(key, el) {
  const titleEl = document.getElementById('hud-modal-title');
  const body = document.getElementById('hud-modal-body');
  if (!titleEl || !body) return;
  const tx = Math.floor(G.player.x / TILE), ty = Math.floor(G.player.y / TILE);
  const hp = Math.max(0, Math.round(G.playerHP));
  const evo = Math.round((G.evolution || 0) * 100);
  let title = 'HUD 详情', desc = '', detail = '';
  if (key === 'fps') {
    title = '帧率 (FPS)';
    desc = '每秒渲染的帧数，反映游戏运行流畅度。数值越高画面越流畅，过低则可能卡顿。';
    detail = '当前帧率：' + (el ? el.textContent : '--') + ' FPS。<br>建议保持 30 FPS 以上以获流畅体验；若持续偏低，可尝试降低画质或关闭其他占资源的窗口。';
  } else if (key === 'coord') {
    title = '坐标 (x, y)';
    desc = '玩家当前所处的地图格子坐标。X 为横向格子编号，Y 为纵向格子编号。';
    detail = '当前坐标：(' + tx + ', ' + ty + ')。<br>坐标用于定位与记录位置，可在不同区域间往返时作为参照。';
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
  if (getTerrain(tx, ty) === T_TREE) return '树木|可砍伐获得木材；手持斧头/开采工具按住左键砍伐，或直接在其上铺设建筑自动清理';
  const ti = getOreType(tx, ty);
  if (ti >= 0 && getOreAmt(tx, ty) > 0) {
    if (ti === ORE_OIL) {
      const rate = Math.round(getOilRate(tx, ty) * 100); // 出产率百分比（旧档默认 100%）
      return '原油矿床|出产率 ' + rate + '%，储量 ' + Math.floor(getOreAmt(tx, ty)) + '，建造抽油机开采（吃电力）';
    }
    const nm = oreItemId(ti);
    return (ITEMS[nm] ? ITEMS[nm].name : '未知矿') + '|储量 ' + Math.floor(getOreAmt(tx, ty)) + '，按住左键开采';
  }
  return null;
}

function initTooltips() {
  const tip = document.getElementById('tooltip');
  document.addEventListener('mousemove', ev => {
    let text = null;
    if (ev.target && ev.target.closest) {
      const el = ev.target.closest('[data-tip]');
      if (el) text = el.dataset.tip;
    }
    if (!text && ev.target === G.canvas && G.cursorTile)
      text = mapTipAt(G.cursorTile.tx, G.cursorTile.ty);
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

