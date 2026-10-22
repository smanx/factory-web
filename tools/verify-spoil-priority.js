'use strict';
// ===== 变质感官 + 机械臂变质优先排序守门人（P1-2 简化口径收尾）=====
// 覆盖（对齐《异星工厂》2.0 Space Age / Quality）：
//   ① 变质感官：箱子槽位/背包格 tooltip 新鲜度百分比 + 格子档位着色（spoil-mid/spoil-low）
//   ② 机械臂变质优先：spoilPrio/spoilMode UI + 抓取逻辑（grabZone/takeItemOf/选品排序）
//   ③ 存档序列化不受影响（spoilPrio/spoilMode 已有序列化路径）
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');
let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  ✗ ' + msg); } }
const read = p => fs.readFileSync(path.join(ROOT, p), 'utf8');

console.log('【① 变质感官：新鲜度展示助手（game/spoilage.js）】');
{
  const src = read('js/game/spoilage.js');
  ok(/function spoilFreshPctText/.test(src), 'spoilFreshPctText 存在（tooltip 百分比）');
  ok(/function spoilFreshRatio/.test(src), 'spoilFreshRatio 存在（档位比值）');
  ok(/function spoilFreshCls/.test(src), 'spoilFreshCls 存在（格子着色类名）');
  // 百分比口径：freshLeft / sp.seconds * 100，钳制 0~100
  ok(/Math\.max\(0, Math\.min\(100, Math\.round\(/.test(src), '百分比钳制 0~100');
  // 档位口径：≤0.2 红（即将变质）、0.2~0.5 橙、≥1 无类
  ok(/r <= 0\.2\) \? ' spoil-low' : ' spoil-mid'/.test(src), '档位：≤0.2 → spoil-low，否则 spoil-mid');
}

console.log('【① 变质感官：箱子槽位（devices/chest.js）】');
{
  const src = read('js/devices/chest.js');
  ok(/spoilFreshPctText\(id, s\.fresh\)/.test(src), '箱格 tooltip 追加新鲜度百分比');
  ok(/spoilFreshCls\(id, s\.fresh\)/.test(src), '箱格按档位着色（spoilFreshCls）');
  ok(/spoil-dot/.test(src), '箱格左上角变质小圆点');
  // 网格签名包含新鲜度档位：跨档/过期触发重建
  ok(/spoilFreshCls\(st\.item, st\.fresh\)/.test(src), 'chestGridSig 含新鲜度档位（跨档触发重建）');
}

console.log('【① 变质感官：背包格子（ui/ui.js）】');
{
  const src = read('js/ui/ui.js');
  ok(/spoilFreshPctText\(id, G\._invFresh\[id\]\.fresh\)/.test(src), '背包格 tooltip 追加新鲜度百分比（_invFresh 侧表）');
  ok(/spoilFreshCls\(s\.id, rec\.fresh\)/.test(src), '背包格实时刷新着色档位（集合不变也逐秒推进）');
  ok(/insertAdjacentHTML\('beforeend', '<i class="spoil-dot"><\/i>'\)/.test(src), '背包格动态补变质小圆点');
}

console.log('【① 变质感官：样式（css/style.css）】');
{
  const src = read('css/style.css');
  ok(/\.inv-slot\.spoil-mid/.test(src), 'spoil-mid 橙色边框样式');
  ok(/\.inv-slot\.spoil-low/.test(src), 'spoil-low 红色边框样式（即将变质）');
  ok(/\.inv-slot \.spoil-dot/.test(src), '变质小圆点样式');
  ok(/spoil-blink/.test(src), '即将变质圆点闪烁动画');
}

console.log('【② 机械臂变质优先：抓取逻辑（devices/inserter.js + devices/belt.js）】');
{
  const src = read('js/devices/inserter.js');
  ok(/spoilPref\(\) \{/.test(src), '机械臂 spoilPref() 偏好计算（spoilPrio→spoil/fresh）');
  ok(/this\.spoilMode === 'fresh' \? 'fresh' : 'spoil'/.test(src), 'spoilMode 映射：fresh→fresh，默认 spoil');
  // 三条抓取路径都传偏好：peekSource / takeNFrom / takeSource
  ok(/grabZone\(o => this\.wantsItem\(o\), this\.pickBeltLane\(s\), sp\)/.test(src), 'peekSource 传偏好');
  ok(/grabZone\(item, this\.pickBeltLane\(s\), sp\)/.test(src), 'takeNFrom 传偏好');
  ok(/grabZone\(undefined, this\.pickBeltLane\(s\), sp\)/.test(src), 'takeSource 传偏好');
  ok(/takeItemOf\(item, sp\)/.test(src), '箱源 takeItemOf 传偏好');
  // 选品排序（pickSourceForDrop）按新鲜度比较
  ok(/sp === 'spoil' \? \(a\.fresh - b\.fresh\) : \(b\.fresh - a\.fresh\)/.test(src), '选品排序按新鲜度（变质/新鲜优先）');
  // UI 开关与单选
  ok(/'spoil-on'/.test(src) && /'spoil-mode'/.test(src), '面板开关（spoil-on）+ 单选（spoil-mode）');
  ok(/insRadio\('变质优先'/.test(src) && /insRadio\('新鲜优先'/.test(src), '单选文案：变质优先/新鲜优先');
  // 悬浮提示含偏好
  ok(/新鲜优先' : '变质优先'/.test(src), 'inserterTip 显示当前偏好');
  // 序列化/恢复已有路径（此前已就绪，防止回退）
  ok(/s\.spoilPrio = this\.spoilPrio/.test(src) && /i\.spoilPrio = !!s\.spoilPrio/.test(src), 'spoilPrio 序列化+恢复闭环');
  ok(/s\.spoilMode === 'fresh'/.test(src) && /i\.spoilMode = s\.spoilMode === 'fresh' \? 'fresh' : 'spoil'/.test(src), 'spoilMode 序列化+恢复闭环');
}
{
  const src = read('js/devices/belt.js');
  // grabZone 第三参 spoilPref：'spoil'=最不新鲜优先，'fresh'=最新鲜优先，同新鲜度 pos 靠前
  ok(/grabZone\(matcher, lane, spoilPref\)/.test(src), 'grabZone 第三参 spoilPref');
  ok(/spoilPref === 'spoil' \? \(best\.fresh - o\.fresh\) : \(o\.fresh - best\.fresh\)/.test(src), 'grabZone 新鲜度比较（spoil=取更不新鲜者）');
  ok(/if \(o\.pos > best\.pos\) best = o;/.test(src), '同新鲜度回退 pos 靠前（下游方向）');
  ok(/if \(best && typeof spoilPutCarried === 'function'\) spoilPutCarried\(best\.item, best\.fresh\);/.test(src), '取走仍登记在途新鲜度（进度随物品走不回退）');
}

console.log('【② 机械臂变质优先：箱源挑槽（devices/chest.js takeItemOf）】');
{
  const src = read('js/devices/chest.js');
  ok(/takeItemOf\(item, spoilPref\)/.test(src), 'takeItemOf 支持 spoilPref 参数');
  ok(/spoilPref === 'spoil' \? st\.fresh < best\.fresh : st\.fresh > best\.fresh/.test(src), '同 id 多槽按新鲜度挑槽（spoil=最旧槽先出）');
  ok(/同 id 槽均无新鲜度字段/.test(src), '无 fresh 字段回退默认「后槽先出」语义');
}

console.log('【③ 语义复核（官方口径）】');
{
  // 官方 2.0 wiki：Inserter「Spoil priority」开启后可选拉取最不新鲜（先腐坏先消耗）
  // 或最新鲜（保输出品质）的物品；未开启保持默认抓取规则。
  const src = read('js/devices/inserter.js');
  ok(/this\.spoilPrio = false;/.test(src), '默认关闭（不开启保持默认抓取规则，行为不变）');
  const beltSrc = read('js/devices/belt.js');
  // 未传 spoilPref 时必须保持原「pos 最大」语义（非 Gleba 世界/老玩家零行为差异）
  ok(!/spoilPref[^;]*\?\?/.test(beltSrc), '未传偏好无隐式默认值');
  // 在途新鲜度登记不受偏好影响（任一选择都正确携带进度）
  ok(/spoilPutCarried\(best\.item, best\.fresh\)/.test(beltSrc), 'grabZone 出口登记在途新鲜度');
}

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
