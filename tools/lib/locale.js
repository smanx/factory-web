'use strict';
/*
 * 官方 locale 数据共享解析模块（data/ 各 mod 的 locale/en 与 locale/zh-CN cfg）
 *
 * 被 tools/generate-locale.js（生成 js/data/locale.generated.js）与
 * tools/generate-game-data.js（生成 GAME_DATA.names/recipeNames 及 mapGen 命名）共用，
 * 保证两条链路对 data/ 文本解析完全一致。
 *
 * 段优先级：item-name > entity-name > recipe-name > fluid-name（同名时前者优先）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DATA_DIR = path.join(ROOT, 'data');

// 参与命名单源的 locale 段
const LOCALE_SECTIONS = ['autoplace-control-names', 'item-name', 'entity-name', 'recipe-name', 'fluid-name', 'equipment-name', 'tile-name', 'map-gen-preset-name', 'map-gen-preset-description'];

// 解析单个 .cfg：返回 { section: { key: value } }（只保留上述段，跳过 [段头]/空行/无=行）
function parseLocaleFile(file) {
  const out = {};
  let sec = null;
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    if (line[0] === '[') {
      const m = /^\[([^\]]+)\]$/.exec(line);
      sec = m ? m[1] : null;
      continue;
    }
    if (!sec || !LOCALE_SECTIONS.includes(sec)) continue;
    const eq = line.indexOf('=');
    if (eq <= 0) continue;
    const key = line.slice(0, eq).trim();
    const val = line.slice(eq + 1).trim();
    if (!key || !val) continue;
    (out[sec] = out[sec] || {})[key] = val;
  }
  return out;
}

// localeBySection[段][官方名] = { zh, en }（多 mod / 多文件合并，后读覆盖前读）
function loadLocaleBySection() {
  const localeBySection = {};
  if (fs.existsSync(DATA_DIR)) {
    for (const mod of fs.readdirSync(DATA_DIR)) {
      const mpath = path.join(DATA_DIR, mod);
      const ldir = path.join(mpath, 'locale');
      if (!fs.statSync(mpath).isDirectory() || !fs.existsSync(ldir)) continue;
      for (const langDir of fs.readdirSync(ldir)) {
        const lang = langDir === 'zh-CN' ? 'zh' : (langDir === 'en' ? 'en' : null);
        if (!lang) continue;
        const lpath = path.join(ldir, langDir);
        if (!fs.statSync(lpath).isDirectory()) continue;
        for (const f of fs.readdirSync(lpath)) {
          if (!f.endsWith('.cfg')) continue;
          const parsed = parseLocaleFile(path.join(lpath, f));
          for (const sec of LOCALE_SECTIONS) {
            if (!parsed[sec]) continue;
            localeBySection[sec] = localeBySection[sec] || {};
            for (const [k, v] of Object.entries(parsed[sec])) {
              const e = localeBySection[sec][k] = localeBySection[sec][k] || {};
              e[lang] = v;
            }
          }
        }
      }
    }
  }
  return localeBySection;
}

module.exports = { LOCALE_SECTIONS, parseLocaleFile, loadLocaleBySection, DATA_DIR };
