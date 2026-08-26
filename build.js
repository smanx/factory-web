const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const shouldMinify = process.argv.includes('--minify');

// ── 1. 从 index.html 提取 <script> 标签的文件路径（保持顺序） ──
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const scriptRe = /<script\s+src="([^"]+)"[^>]*><\/script>/g;
const scripts = [];
let m;
while ((m = scriptRe.exec(html)) !== null) {
  const raw = m[1];
  const file = raw.split('?')[0]; // 去掉 ?v=N 缓存参数
  scripts.push(file);
}
console.log(`Found ${scripts.length} script entries`);

// ── 2. 生成临时入口文件 dist/_entry.js ──
fs.mkdirSync(DIST, { recursive: true });

const entryLines = scripts.map(f => `import '${path.join(ROOT, f).replace(/\\/g, '/')}';`);
const entryPath = path.join(DIST, '_entry.js');
fs.writeFileSync(entryPath, entryLines.join('\n') + '\n');

// ── 3. esbuild 打包 ──
esbuild.buildSync({
  entryPoints: [entryPath],
  absWorkingDir: ROOT,
  bundle: true,
  outfile: path.join(DIST, 'bundle.js'),
  format: 'iife',
  minify: shouldMinify,
  sourcemap: !shouldMinify,
  logLevel: 'info',
});

// 清理临时入口
fs.unlinkSync(entryPath);

// ── 4. 生成 dist/index.html（替换 script 标签） ──
const distHtml = html.replace(
  /<script\s+src="[^"]+"[^>]*><\/script>\n?/g,
  ''
).replace(
  '</body>',
  `  <script src="bundle.js"></script>\n</body>`
);
fs.writeFileSync(path.join(DIST, 'index.html'), distHtml);

// ── 5. 复制静态资源 ──
const staticFiles = [
  'css/style.css',
  'favicon.ico',
];
for (const f of staticFiles) {
  const src = path.join(ROOT, f);
  const dest = path.join(DIST, f);
  if (fs.existsSync(src)) {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
    console.log(`Copied ${f}`);
  }
}

// ── 6. 复制其他可能需要的文件（如 manifest.json 等） ──
const extraFiles = ['manifest.json', 'robots.txt'];
for (const f of extraFiles) {
  const src = path.join(ROOT, f);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(DIST, f));
    console.log(`Copied ${f}`);
  }
}

console.log(`\nBuild complete → dist/`);
console.log(`  bundle.js  (${(fs.statSync(path.join(DIST, 'bundle.js')).size / 1024).toFixed(1)} KB${shouldMinify ? ' minified' : ''})`);
