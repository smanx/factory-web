'use strict';
/*
 * 官方文本（locale）打包生成器：把 data/ 各 mod 的 locale/en 与 locale/zh-CN cfg 全部文本
 * 打包成一个 JS 文件 js/data/locale.generated.js，定义全局常量 GAME_LOCALE。
 *
 * - 数据唯一来源 = data/（官方 Factorio locale 文本，与 factorio-data 子模块同步），
 *   本产物由脚本生成，禁止手改；重新生成：node tools/generate-locale.js（或 npm run locale）。
 * - data-util.js 的 localizedName 优先读 GAME_LOCALE，GAME_DATA.names/recipeNames
 *   降级为兜底（旧缓存场景），不再手工维护第二份名称列表。
 *
 * 用法:
 *   node tools/generate-locale.js            # 生成 js/data/locale.generated.js
 *   node tools/generate-locale.js --check    # 校验模式：产物过期则退出非零（供 CI）
 */
const fs = require('fs');
const path = require('path');
const { LOCALE_SECTIONS, loadLocaleBySection, DATA_DIR } = require('./lib/locale.js');

const ROOT = path.join(__dirname, '..');
const OUT_FILE = path.join(ROOT, 'js', 'data', 'locale.generated.js');
const CHECK = process.argv.includes('--check');

// cfg 文本不可安全内联的字符提前发现（JSON.stringify 兜底，正常不会出现）
function jsonReplacer(_k, v) { return v; }

const localeBySection = loadLocaleBySection();
const payload = { sections: LOCALE_SECTIONS, entries: localeBySection };

// ---- 数据指纹（用于过期检测）----
function dataFingerprint() {
  const files = [];
  (function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const name of fs.readdirSync(dir).sort()) {
      const p = path.join(dir, name);
      const st = fs.statSync(p);
      if (st.isDirectory()) walk(p);
      else if (name.endsWith('.cfg')) files.push(path.relative(ROOT, p).replace(/\\/g, '/'));
    }
  })(DATA_DIR);
  return files.map(f => f + ':' + fs.statSync(path.join(ROOT, f)).size).join('|');
}
const fingerprint = dataFingerprint();

function buildOutput() {
  const count = Object.values(localeBySection).reduce((n, sec) => n + Object.keys(sec).length, 0);
  return `'use strict';

// ===== 自动生成文件：由 data/ 各 mod 的 locale/en 与 locale/zh-CN cfg 经 tools/generate-locale.js 打包生成 =====
// 官方文本唯一打包源：游戏内所有物品/建筑/流体/配方/装备/地图控件等官方名称（中英文）
// 均从本文件的 GAME_LOCALE 获取（见 js/data-util.js 的 localizedName）。
// 请勿手改本文件；data/ 文本变更后重新生成：npm run locale（或 node tools/generate-locale.js）
// 结构：GAME_LOCALE.sections = 段优先级（item-name > entity-name > recipe-name > fluid-name...）；
//       GAME_LOCALE.entries[段][官方名] = { zh, en }（多 mod 合并，后读覆盖前读）
// 生成时间指纹（data/ 各 .cfg 文件字节数，供 --check 过期检测）：${fingerprint}
const GAME_LOCALE = ${JSON.stringify(payload, jsonReplacer, 1)};
`;
}

const output = buildOutput();

if (CHECK) {
  const cur = fs.existsSync(OUT_FILE) ? fs.readFileSync(OUT_FILE, 'utf8') : '';
  const stale = cur !== output;
  if (stale) {
    console.error('locale.generated.js 已过期：data/ 文本与产物不一致，请运行 npm run locale 重新生成');
    process.exit(1);
  }
  const entries = payload.entries;
  const count2 = Object.values(entries).reduce((n, sec) => n + Object.keys(sec).length, 0);
  console.log('OK: locale.generated.js 为最新（' + Object.keys(entries).length + ' 段 / ' + count2 + ' 条官方命名）');
  process.exit(0);
}

fs.writeFileSync(OUT_FILE, output);
const count = Object.values(localeBySection).reduce((n, sec) => n + Object.keys(sec).length, 0);
console.log('OK: 已生成 ' + path.relative(ROOT, OUT_FILE) + '（' + Object.keys(localeBySection).length + ' 段 / ' + count + ' 条官方命名，' + output.length + ' 字节）');
