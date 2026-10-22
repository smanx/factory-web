'use strict';
/**
 * 地形瓦片存档往返校验（encodeChunkData / decodeChunkData）
 * ------------------------------------------------
 * 回归背景（2026-10-22 E2E 发现的 P0 存档 bug）：
 *   encodeChunkData 旧实现 `t += c.terrain[i]` 为十进制拼接，瓦片值 ≥10
 *   （果仁土壤10/11、冰面平台12、地基13、平台地板14、熔岩15、碎石16、冰海17）
 *   会写成两个字符，而 decodeChunkData 逐字符解码（c-48）导致：
 *   ① 这些瓦片读档后损坏（14 → 变成 1,4 两格）；② 后续所有瓦片错位。
 * 修复：编码端改为单字符 chr(48+v)。解码端不变，天然兼容。
 *
 * 本守门人用 vm 沙盒直接跑 world.js 的编解码函数做往返断言。
 * 运行：node tools/verify-world-tiles-save.js （退出码 0 = 通过）
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = path.join(__dirname, '..', 'js');
const load = (p) => fs.readFileSync(path.join(SRC, p), 'utf8');

let pass = 0, fail = 0;
function ok(cond, name) {
  if (cond) { pass++; console.log('  ✅ ' + name); }
  else { fail++; console.log('  ❌ ' + name); }
}

const sandbox = {
  console, Math, JSON, Set, Map, Array, Object, String, Number, Boolean, Date, RegExp,
  parseInt, parseFloat, isFinite, isNaN, Uint8Array, Int8Array, Float32Array,
  G: { time: 0, ents: [], grid: new Map(), buckets: new Map(), settings: {}, techDone: {}, inv: new Map(), player: { x: 0, y: 0 } },
  planetId: () => 'nauvis',
  performance,
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
vm.createContext(sandbox);

const src =
  load('data/data.generated.js') + '\n' +
  load('data/data.js') + '\n' +
  load('data/data-items.js') + '\n' +
  load('data/data-buildings.js') + '\n' +
  load('data/data-tech.js') + '\n' +
  load('data/data-util.js') + '\n' +
  load('game/world.js') + '\n' +
  'globalThis.__encode=encodeChunkData;globalThis.__decode=decodeChunkData;' +
  'globalThis.__T={CLIFF:T_CLIFF,YUMAKO:T_YUMAKO_SOIL,OGY:T_OVERGROWTH_YUMAKO_SOIL,JELLY:T_JELLYNUT_SOIL,OGJ:T_OVERGROWTH_JELLYNUT_SOIL,ICEP:T_ICE_PLATFORM,FOUND:T_FOUNDATION,SPACE:T_SPACE_PLATFORM,LAVA:T_LAVA,SCRAP:T_SCRAP,ICES:T_ICE_SHEET,GRASS:T_GRASS,WATER:T_WATER,TREE:T_TREE};' +
  'globalThis.__CHUNK=CHUNK;globalThis.__gen=genWorld;';
vm.runInContext(src, sandbox, { filename: 'world-tiles.js' });

const { __encode: encodeChunkData, __decode: decodeChunkData, __T: T, __CHUNK: CHUNK, __gen: genWorld } = sandbox;
const N = CHUNK * CHUNK;

function roundTrip(values, label) {
  const c = { terrain: new Uint8Array(N), oreType: new Int8Array(N).fill(-1), oreAmt: new Float32Array(N), oilRate: new Float32Array(N) };
  // 每 16 格循环铺一种瓦片，覆盖全部边界对齐情况
  for (let i = 0; i < N; i++) c.terrain[i] = values[i % values.length];
  const enc = encodeChunkData(c);
  ok(enc.t.length === N, label + '：编码后每格单字符（t 长度 ' + enc.t.length + '=' + N + '）');
  const dec = decodeChunkData({ cx: 0, cy: 0, t: enc.t, o: enc.o, a: enc.a, or: enc.or });
  let same = true;
  for (let i = 0; i < N; i++) if (dec.terrain[i] !== c.terrain[i]) { same = false; break; }
  ok(same, label + '：encode→decode 往返一致');
  return enc.t;
}

console.log('【P0 回归：瓦片值 ≥10 的地形存档往返】');
{
  // 全部 ≥10 的瓦片逐一往返（此前全部损坏错位）
  const hi = [T.JELLY, T.OGJ, T.ICEP, T.FOUND, T.SPACE, T.LAVA, T.SCRAP, T.ICES];
  for (const v of hi) roundTrip([v], '瓦片 ' + v);
}
console.log('【混合瓦片（边界对齐）往返】');
{
  roundTrip([0, 1, 4, T.SPACE, T.LAVA, T.FOUND, T.ICES, T.ICEP], '混合 0..17');
  roundTrip([T.SPACE, T.SPACE, T.LAVA, 9, 8, 7], '双位数与个位数混排');
}
console.log('【矿种 oreType 编码（含 ORE_HOLMIUM=9 边界）】');
{
  const c = { terrain: new Uint8Array(N), oreType: new Int8Array(N).fill(-1), oreAmt: new Float32Array(N).fill(100), oilRate: new Float32Array(N) };
  for (let i = 0; i < N; i++) c.oreType[i] = i % 10;   // 0..9 全矿种
  const enc = encodeChunkData(c);
  const dec = decodeChunkData({ cx: 0, cy: 0, t: enc.t, o: enc.o, a: enc.a, or: enc.or });
  let same = true;
  for (let i = 0; i < N; i++) if (dec.oreType[i] !== c.oreType[i]) { same = false; break; }
  ok(same, 'oreType 0..9 往返一致（oreAmt 顺序保持）');
}
console.log('【旧档兼容：0..9 瓦片新旧编码字节一致】');
{
  const c = { terrain: new Uint8Array(N), oreType: new Int8Array(N).fill(-1), oreAmt: new Float32Array(N) };
  for (let i = 0; i < N; i++) c.terrain[i] = i % 10;
  const enc = encodeChunkData(c);
  // 旧编码：十进制拼接（0..9 单数字相同）
  let oldT = '';
  for (let i = 0; i < N; i++) oldT += c.terrain[i];
  ok(enc.t === oldT, '0..9 区块新编码与旧档字节一致（旧档安全）');
}
console.log('【生成世界 chunk 完整往返】');
{
  const w = genWorld(12345);
  // genWorld 只建元数据，chunk 按需生成（getChunk）。取一个已生成块或手动造块：
  let c = w.chunks.size ? w.chunks.get(w.chunks.keys().next().value) : null;
  if (!c) {
    // 手动构造一个与生成器同构的 chunk（terrain 全草地+少量矿）
    c = { cx: 0, cy: 0, terrain: new Uint8Array(N), oreType: new Int8Array(N).fill(-1), oreAmt: new Float32Array(N), oilRate: new Float32Array(N) };
    for (let i = 0; i < N; i++) { if (i % 97 === 0) c.oreType[i] = i % 10; }
  }
  const enc = encodeChunkData(c);
  const dec = decodeChunkData({ cx: 0, cy: 0, t: enc.t, o: enc.o, a: enc.a, or: enc.or });
  let same = true;
  for (let i = 0; i < N; i++) if (dec.terrain[i] !== c.terrain[i] || dec.oreType[i] !== c.oreType[i]) { same = false; break; }
  ok(same, 'chunk 地形+矿种全量往返一致（1024 格）');
}

console.log(`\n结果: ${pass} 通过, ${fail} 失败`);
process.exit(fail ? 1 : 0);
