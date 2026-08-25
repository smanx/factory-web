// 生成游戏 favicon.ico（齿轮 + 工厂传送带主题图标）
// 纯 Node.js 实现：手动绘制像素 -> 编码 PNG -> 封装 ICO
const fs = require('fs');
const zlib = require('zlib');
const path = require('path');

const SIZE = 32; // 32x32 图标

// ---------- 简单像素画布 ----------
function createCanvas(size) {
  const px = new Uint8Array(size * size * 4); // RGBA
  return {
    size,
    px,
    set(x, y, r, g, b, a = 255) {
      if (x < 0 || y < 0 || x >= size || y >= size) return;
      const i = (y * size + x) * 4;
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = a;
    },
    get(x, y) {
      const i = (y * size + x) * 4;
      return [px[i], px[i + 1], px[i + 2], px[i + 3]];
    },
    // 混合叠加（带透明度）
    blend(x, y, r, g, b, a) {
      if (x < 0 || y < 0 || x >= size || y >= size) return;
      const i = (y * size + x) * 4;
      const srcA = a / 255;
      const dstA = px[i + 3] / 255;
      const outA = srcA + dstA * (1 - srcA);
      if (outA <= 0) return;
      for (let c = 0; c < 3; c++) {
        px[i + c] = Math.round((r * srcA + px[i + c] * dstA * (1 - srcA)) / outA);
      }
      px[i + 3] = Math.round(outA * 255);
    },
  };
}

// ---------- 填充圆盘/圆环（画齿轮） ----------
function disc(cv, cx, cy, rad, color, aa = 0.5) {
  for (let y = 0; y < cv.size; y++) {
    for (let x = 0; x < cv.size; x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (d <= rad) {
        const edge = rad - d;
        const a = edge < aa ? (edge / aa) * color[3] : color[3];
        cv.blend(x, y, color[0], color[1], color[2], a);
      }
    }
  }
}

// 圆环（内外半径）
function ring(cv, cx, cy, radOut, radIn, color, aa = 0.5) {
  for (let y = 0; y < cv.size; y++) {
    for (let x = 0; x < cv.size; x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (d <= radOut && d >= radIn) {
        const e1 = radOut - d;
        const e2 = d - radIn;
        const edge = Math.min(e1, e2);
        const a = edge < aa ? (edge / aa) * color[3] : color[3];
        cv.blend(x, y, color[0], color[1], color[2], a);
      }
    }
  }
}

// 齿轮齿（矩形，沿圆周分布）
function gearTeeth(cv, cx, cy, rad, teeth, color, toothW, toothH) {
  for (let t = 0; t < teeth; t++) {
    const ang = (t / teeth) * Math.PI * 2;
    const x0 = cx + Math.cos(ang) * rad;
    const y0 = cy + Math.sin(ang) * rad;
    // 矩形齿，绕中心旋转
    for (let dy = -toothH; dy <= toothH; dy++) {
      for (let dx = -toothW; dx <= toothW; dx++) {
        // 局部坐标旋转
        const lx = dx * Math.cos(ang) - dy * Math.sin(ang);
        const ly = dx * Math.sin(ang) + dy * Math.cos(ang);
        const px = x0 + lx;
        const py = y0 + ly;
        if (px >= 0 && py >= 0 && px < cv.size && py < cv.size) {
          cv.blend(Math.round(px), Math.round(py), color[0], color[1], color[2], color[3]);
        }
      }
    }
  }
}

// 中心孔
function hole(cv, cx, cy, rad, aa = 0.5) {
  for (let y = 0; y < cv.size; y++) {
    for (let x = 0; x < cv.size; x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (d <= rad) {
        const edge = rad - d;
        const a = edge < aa ? (edge / aa) * 255 : 255;
        cv.blend(x, y, 0, 0, 0, a); // 用透明度清空（混合为透明）
      }
    }
  }
}

// 真正的"清空为透明"（不用混合，直接置透明）
function clearCircle(cv, cx, cy, rad) {
  for (let y = 0; y < cv.size; y++) {
    for (let x = 0; x < cv.size; x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
      if (d <= rad) {
        const i = (y * cv.size + x) * 4;
        cv.px[i] = 0; cv.px[i + 1] = 0; cv.px[i + 2] = 0; cv.px[i + 3] = 0;
      }
    }
  }
}

// ---------- PNG 编码 ----------
function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function encodePNG(px, size) {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace
  // raw scanlines (filter byte 0 + RGBA per row)
  const raw = Buffer.alloc(size * (size * 4 + 1));
  const pxBuf = Buffer.from(px);
  for (let y = 0; y < size; y++) {
    const rowStart = y * (size * 4 + 1);
    raw[rowStart] = 0; // filter none
    pxBuf.copy(raw, rowStart + 1, y * size * 4, (y + 1) * size * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// 封装为 ICO（含 PNG）
function wrapICO(png, size) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type icon
  header.writeUInt16LE(1, 4); // count
  const entry = Buffer.alloc(16);
  entry[0] = size === 256 ? 0 : size;
  entry[1] = size === 256 ? 0 : size;
  entry[2] = 0; // colors
  entry[3] = 0; // reserved
  entry.writeUInt16LE(1, 4); // planes
  entry.writeUInt16LE(32, 6); // bitcount
  entry.writeUInt32LE(png.length, 8); // size
  entry.writeUInt32LE(22, 12); // offset
  return Buffer.concat([header, entry, png]);
}

// ---------- 绘制工厂/齿轮图标 ----------
const cv = createCanvas(SIZE);

// 齿轮主体颜色：工业黄 + 深灰描边
const gearYellow = [245, 197, 66, 255];   // 亮黄（对应游戏基础传送带黄）
const gearGray = [90, 95, 100, 255];      // 深灰
const gearDark = [55, 58, 62, 255];

const cx = SIZE / 2, cy = SIZE / 2;

// 深色圆底（圆角方形底）
for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    // 圆角矩形判断
    const r = 6;
    let inRect = true;
    if (x < r && y < r) inRect = (x - r) ** 2 + (y - r) ** 2 <= r * r;
    else if (x >= SIZE - r && y < r) inRect = (x - (SIZE - 1 - r)) ** 2 + (y - r) ** 2 <= r * r;
    else if (x < r && y >= SIZE - r) inRect = (x - r) ** 2 + (y - (SIZE - 1 - r)) ** 2 <= r * r;
    else if (x >= SIZE - r && y >= SIZE - r) inRect = (x - (SIZE - 1 - r)) ** 2 + (y - (SIZE - 1 - r)) ** 2 <= r * r;
    if (inRect) cv.set(x, y, 30, 33, 38, 255);
  }
}

// 齿轮牙齿（黄色，8 齿）
gearTeeth(cv, cx, cy, 10.5, 8, gearYellow, 2.4, 3.2);

// 齿轮外环（黄）
ring(cv, cx, cy, 12.5, 6.0, gearYellow, 0.6);

// 齿轮内环阴影（深灰）
ring(cv, cx, cy, 6.0, 4.5, gearDark, 0.6);

// 中心圆盘（深灰）
disc(cv, cx, cy, 4.5, gearDark);

// 中心孔（透明）——做出齿轮中心空洞
clearCircle(cv, cx, cy, 2.6);

// 边缘高光
ring(cv, cx, cy, 12.5, 11.6, [255, 230, 130, 110], 0.8);

// 生成 PNG + ICO
const png = encodePNG(cv.px, SIZE);
const ico = wrapICO(png, SIZE);

const outIco = path.join(__dirname, '..', 'favicon.ico');
fs.writeFileSync(outIco, ico);
console.log('已生成 favicon.ico:', ico.length, 'bytes');
