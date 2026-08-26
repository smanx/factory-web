'use strict';
/*
 * 一次性数据转换脚本：用 fengari 执行 factorio-data 的 Lua 数据脚本，
 * 收集 data.raw 并转成 JS 对象，在内存中传给 tools/generate-game-data.js。
 *
 * 设计目标：不维护第二份数据。唯一数据源是 factorio-data/ 目录，
 * 本脚本是"现场转换"，不落盘（不再生成 generated/data.raw.json 中间产物）。
 *
 * 用法: 由 tools/generate-game-data.js 自动 require（本模块导出 data.raw 的 JS 对象）
 */
const path = require('path');
const fs = require('fs');
const { lua, lauxlib, lualib, to_luastring, to_jsstring } = require('fengari');

const ROOT = path.join(__dirname, '..', 'factorio-data');
const MODS = ['core', 'base', 'elevated-rails', 'quality', 'recycler', 'space-age'];

const L = lauxlib.luaL_newstate();
lualib.luaL_openlibs(L);

function js(str) { return to_luastring(str, true); }

function luaRun(code, label) {
  const buf = js(code);
  const status = lauxlib.luaL_loadbuffer(L, buf, buf.length, to_luastring(label));
  if (status !== 0) throw new Error(`[${label}] load: ` + to_jsstring(lua.lua_tostring(L, -1)));
  lua.lua_getglobal(L, 'debug');
  lua.lua_getfield(L, -1, 'traceback');
  lua.lua_remove(L, -2);
  lua.lua_insert(L, -2);
  const ok = lua.lua_pcall(L, 0, 0, -2);
  if (ok !== 0) {
    const err = to_jsstring(lua.lua_tostring(L, -1)) || 'unknown error';
    lua.lua_pop(L, 2);
    throw new Error(`[${label}] run: ` + err);
  }
  lua.lua_pop(L, 1);
}

// ---- Lua 5.2 → fengari(5.3) 兼容补齐 ----
luaRun(`
math.atan2 = math.atan2 or function(y, x) return math.atan(y, x) end
math.pow   = math.pow   or function(x, y) return x ^ y end
math.log10 = math.log10 or function(x) return math.log(x, 10) end
`, 'lua52-math-polyfill');

// ---- bootstrap: data / data:extend / defines / mods / log ----
luaRun(`
data = { raw = {}, is_demo = false }
function data.extend(self, otherdata)
  if self ~= data and otherdata == nil then otherdata = self end
  if type(otherdata) ~= 'table' then error('data.extend: not a table') end
  for i, e in ipairs(otherdata) do
    if type(e) ~= 'table' then error('data.extend: element ' .. i .. ' not a table') end
    if type(e.type) ~= 'string' then
      error('data.extend: element ' .. i .. ' name=' .. tostring(e.name) .. ' type=' .. tostring(e.type) .. ' is not a string')
    end
    if type(e.name) ~= 'string' then
      error('data.extend: element ' .. i .. ' missing name')
    end
    local t = data.raw[e.type]
    if t == nil then t = {}; data.raw[e.type] = t end
    t[e.name] = e
  end
end
-- 未预先声明的 defines 自动生成嵌套表（用于布尔判断等场景；真正常量见下方显式定义）
local function autotable()
  local t = {}
  return setmetatable(t, { __index = function(self, k)
    local v = autotable()
    rawset(self, k, v)
    return v
  end })
end
defines = autotable()
-- 数据脚本实际用到的 defines 常量（其余走 autotable）
defines.constant.default_icon_size = 32
mods = {}
for _, m in ipairs({'core','base','elevated-rails','quality','recycler','space-age'}) do
  mods[m] = { name = m, version = '1.0.0', enabled = true }
end
local dir_names = { 'north','northnortheast','northeast','eastnortheast','east','eastsoutheast','southeast','southsoutheast','south','southsouthwest','southwest','westsouthwest','west','westnorthwest','northwest','northnorthwest' }
for i, n in ipairs(dir_names) do defines.direction[n] = i - 1 end
local item_types = { 'item','ammo','armor','tool','mining_tool','repair_tool','capsule','gun','module','rail_planner','selection_tool','blueprint','blueprint_book','deconstruction_item','upgrade_item','item_with_entity_data','spidertron_remote','copy_paste_tool','item_with_label','item_with_tags' }
defines.prototypes.item = {}
for _, v in ipairs(item_types) do defines.prototypes.item[v] = true end
local entity_types = { 'entity','assembling_machine','furnace','mining_drill','resource','container','logistic_container','belt','transport_belt','underground_belt','splitter','inserter','pipe','pipe_connection','pump','boiler','generator','steam_engine','solar_panel','accumulator','lamp','electric_pole','roboport','train_stop','rail_signal','rail_chain_signal','locomotive','cargo_wagon','fluid_wagon','artillery_wagon','car','tank','spidertron','turret','wall','gate','land_mine','artillery_turret','radar','rocket_silo','storage_tank','heat_interface','heat_pipe','heat_exchanger','nuclear_reactor','steam_turbine','beacon','lab','arithmetic_combinator','decider_combinator','constant_combinator','programmable_speaker','power_switch','linked_belt','infinity_pipe','offshore_pump' }
defines.prototypes.entity = {}
for _, v in ipairs(entity_types) do defines.prototypes.entity[v] = true end
-- recycler/recycling.lua 用 defines.prototypes[base_type]，base_type 含 "equipment"
defines.prototypes.equipment = {}
for _, v in ipairs({ 'equipment','energy_shield_equipment','battery_equipment','solar_panel_equipment','generator_equipment','electric_energy_interface_equipment','active_defense_equipment','movement_bonus_equipment','roboport_equipment','belt_immunity_equipment','night_vision_equipment' }) do
  defines.prototypes.equipment[v] = true
end
-- defines.inventory：数据脚本用作 inventory_index（GUI 槽位编号）。
-- 值按 Factorio 惯例给出；复刻游戏自定义 UI 时可自行调整。
defines.inventory = {}
defines.inventory.lab_input = 1
defines.inventory.lab_modules = 2
defines.inventory.crafter_modules = 1
defines.inventory.character_main = 1
function log(...) end
`, 'bootstrap');

// ---- 覆写 require（Factorio 语义：__mod__/ 前缀 + 当前 mod 相对路径） ----
let currentMod = null;
const stubs = { graphics: [], sound: [], other: [] };

function moduleOf(file) {
  const rel = path.relative(ROOT, file);
  return rel.split(path.sep)[0];
}

function resolveModule(name, mod) {
  // 归一化点号模块名：Lua 的 "a.b" 对应文件路径 a/b.lua（__mod__ 前缀同样适用点号）
  const rel = name.replace(/\./g, '/');
  const withLua = (f) => (f.endsWith('.lua') ? f : f + '.lua');
  if (rel.startsWith('__')) {
    const m = /^__([^_]+)__\/(.+)$/.exec(rel);
    if (!m) return null;
    const base = path.join(ROOT, m[1]);
    if (!fs.existsSync(base)) return null;
    const f = path.join(base, withLua(m[2]));
    return fs.existsSync(f) ? f : null;
  }
  const cands = [
    path.join(ROOT, mod, withLua(rel)),
    path.join(ROOT, mod, 'lualib', withLua(rel)),
    path.join(ROOT, 'core', 'lualib', withLua(rel)),
  ];
  for (const c of cands) if (fs.existsSync(c)) return c;
  return null;
}

lua.lua_pushjsfunction(L, function (LL) {
  const name = to_jsstring(lauxlib.luaL_checklstring(LL, 1, null));
  const file = resolveModule(name, currentMod);
  if (!file) {
    // 找不到真实文件：factorio-data 仓库不含 graphics/*.lua 与 sound 资源，
    // 返回合法占位结构，保证 util.sprite_load 等能正常走完数据加载流程。
    if (name.includes('graphics')) {
      stubs.graphics.push(name);
      lua.lua_newtable(LL);
      lua.lua_pushliteral(LL, 'width');  lua.lua_pushinteger(LL, 32); lua.lua_settable(LL, -3);
      lua.lua_pushliteral(LL, 'height'); lua.lua_pushinteger(LL, 32); lua.lua_settable(LL, -3);
      lua.lua_pushliteral(LL, 'line_length'); lua.lua_pushinteger(LL, 1); lua.lua_settable(LL, -3);
      lua.lua_pushliteral(LL, 'frames'); lua.lua_pushinteger(LL, 1); lua.lua_settable(LL, -3);
      lua.lua_pushliteral(LL, 'shift'); lua.lua_newtable(LL);
      lua.lua_pushinteger(LL, 0); lua.lua_rawseti(LL, -2, 1);
      lua.lua_pushinteger(LL, 0); lua.lua_rawseti(LL, -2, 2);
      lua.lua_settable(LL, -3);
    } else if (name.includes('sound')) {
      stubs.sound.push(name);
      lua.lua_newtable(LL);
      lua.lua_pushliteral(LL, 'type'); lua.lua_pushliteral(LL, 'ambient-sound'); lua.lua_settable(LL, -3);
      lua.lua_pushliteral(LL, 'name'); lua.lua_pushliteral(LL, 'stub-sound'); lua.lua_settable(LL, -3);
      lua.lua_pushliteral(LL, 'track_type'); lua.lua_pushliteral(LL, 'main-track'); lua.lua_settable(LL, -3);
      lua.lua_pushliteral(LL, 'sound'); lua.lua_newtable(LL); lua.lua_settable(LL, -3);
    } else {
      stubs.other.push(name);
      lua.lua_newtable(LL);
    }
    return 1;
  }
  const prev = currentMod;
  currentMod = moduleOf(file);
  const code = fs.readFileSync(file, 'utf8');
  const buf = js(code);
  const status = lauxlib.luaL_loadbuffer(LL, buf, buf.length, to_luastring(file));
  if (status !== 0) throw new Error(`load ${name}: ` + to_jsstring(lua.lua_tostring(LL, -1)));
  lua.lua_getglobal(LL, 'debug');
  lua.lua_getfield(LL, -1, 'traceback');
  lua.lua_remove(LL, -2);
  lua.lua_insert(LL, -2);
  const ok = lua.lua_pcall(LL, 0, 1, -2);
  if (ok !== 0) {
    const err = to_jsstring(lua.lua_tostring(LL, -1)) || 'unknown error';
    lua.lua_pop(LL, 2);
    currentMod = prev;
    throw new Error(`run ${name} (${file}): ` + err);
  }
  lua.lua_remove(LL, -2);
  currentMod = prev;
  return 1;
});
lua.lua_setglobal(L, 'require');

const t0 = Date.now();
function step(msg) { console.log(`  ${(Date.now() - t0).toString().padStart(5)}ms  ${msg}`); }

// ---- 加载所有 mod 的 data.lua 与 data-updates.lua ----
step('loading core/data.lua');
luaRun(`require("__core__/data")`, 'core/data');
for (const mod of MODS.slice(1)) {
  step(`loading ${mod}/data.lua`);
  luaRun(`require("__${mod}__/data")`, mod + '/data');
}

const updateFiles = [
  ['base', 'data-updates'],
  ['elevated-rails', 'base-data-updates'],
  ['quality', 'data-updates'],
  ['recycler', 'data-updates'],
  ['space-age', 'base-data-updates'],
  ['space-age', 'data-updates'],
];
for (const [mod, name] of updateFiles) {
  const f = path.join(ROOT, mod, name + '.lua');
  if (!fs.existsSync(f)) continue;
  step(`loading ${mod}/${name}.lua`);
  luaRun(`require("__${mod}__/${name}")`, mod + '/' + name);
}

// ---- 完整性：类型统计 ----
step('collecting data.raw summary');
const summary = luaRunReturn(`
local out = {}
for tname, tbl in pairs(data.raw) do
  local n = 0
  for _ in pairs(tbl) do n = n + 1 end
  out[tname] = n
end
return out
`, 'summary');
console.log(`\n==== data.raw 原型类型统计（共 ${Object.keys(summary).length} 种） ====`);
for (const [k, v] of Object.entries(summary)) console.log(`  ${k.padEnd(28)} ${v}`);

// ---- 完整性：require 未命中（stub）统计 ----
console.log('\n==== require 未命中（stub）统计 ====');
console.log(`  graphics: ${stubs.graphics.length}`);
console.log(`  sound:    ${stubs.sound.length}`);
console.log(`  other:    ${stubs.other.length}`);
if (stubs.other.length) console.log('  other 明细:', stubs.other.join(', '));

// ---- 转换 data.raw → JS 纯数据 → JSON ----
// 说明：lua_pcall 返回后，当前帧栈上限(L.ci.top)仍是 chunk 执行期遗留的小值，
// JS 侧用 lua_next 递归遍历会顶破该上限报 "stack overflow"，故加大栈并放宽帧上限。
lua.lua_checkstack(L, 100000);
L.ci.top = L.stack_last;

const status = lauxlib.luaL_loadstring(L, js(`
local function convert(v, seen)
  local t = type(v)
  if t == 'number' then return v
  elseif t == 'boolean' or t == 'string' then return v
  elseif t == 'nil' then return nil
  elseif t ~= 'table' then return tostring(v) end
  if seen[v] then return '<cycle>' end
  seen[v] = true
  local isArray, n = true, 0
  for k in pairs(v) do
    if type(k) ~= 'number' or k < 1 or k % 1 ~= 0 then isArray = false end
    n = n + 1
  end
  local out
  if isArray and n > 0 then
    out = {}
    for i = 1, n do out[i] = convert(v[i], seen) end
  else
    out = {}
    for k, val in pairs(v) do out[convert(k, seen)] = convert(val, seen) end
  end
  seen[v] = nil
  return out
end
return convert(data.raw, {})
`));
if (status !== 0) throw new Error('dumpJson load: ' + to_jsstring(lua.lua_tostring(L, -1)));
const ok = lua.lua_pcall(L, 0, 1, 0);
if (ok !== 0) throw new Error('dumpJson run: ' + to_jsstring(lua.lua_tostring(L, -1)));
L.ci.top = L.stack_last;

const read = (idx) => {
  const abs = idx > 0 ? idx : lua.lua_gettop(L) + idx + 1;
  const t = lua.lua_type(L, abs);
  if (t === lua.LUA_TNUMBER) return lua.lua_tonumber(L, abs);
  if (t === lua.LUA_TSTRING) return to_jsstring(lua.lua_tolstring(L, abs, null));
  if (t === lua.LUA_TBOOLEAN) return lua.lua_toboolean(L, abs);
  if (t === lua.LUA_TTABLE) {
    const res = {};
    lua.lua_pushnil(L);
    while (lua.lua_next(L, abs) !== 0) {
      const k = read(-2);
      const v = read(-1);
      res[k] = v;
      lua.lua_pop(L, 1);
    }
    return res;
  }
  return undefined;
};

console.log('\n==== 转换 data.raw → JS 对象（内存传递，不落盘） ====');
const rawObj = read(-1);
lua.lua_pop(L, 1);

// ---- 完整性校验（序列化仅为校验，不写文件） ----
const fullJson = JSON.stringify(rawObj);
const cycles = (fullJson.match(/<cycle>/g) || []).length;
const nans = (fullJson.match(/NaN/g) || []).length;
console.log(`  cycle 标记: ${cycles}   NaN: ${nans}`);
if (nans > 0) throw new Error('输出包含 NaN，转换失败');

// ---- 输出：内存对象，供 tools/generate-game-data.js 直接使用（不生成中间产物） ----
console.log(`\nOK: data.raw 已就绪（${Object.keys(summary).length} 种原型类型），未生成中间文件`);
module.exports = rawObj;

function luaRunReturn(code, label) {
  const status = lauxlib.luaL_loadstring(L, js(code));
  if (status !== 0) throw new Error(`[${label}] load: ` + to_jsstring(lua.lua_tostring(L, -1)));
  const ok = lua.lua_pcall(L, 0, 1, 0);
  if (ok !== 0) throw new Error(`[${label}] run: ` + to_jsstring(lua.lua_tostring(L, -1)));
  const res = {};
  lua.lua_pushnil(L);
  while (lua.lua_next(L, -2) !== 0) {
    const k = to_jsstring(lua.lua_tolstring(L, -2, null));
    res[k] = lua.lua_tointeger(L, -1);
    lua.lua_pop(L, 1);
  }
  lua.lua_pop(L, 1);
  return res;
}
