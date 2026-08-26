const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = __dirname;
const DIST = path.join(ROOT, 'dist');
const args = process.argv.slice(2);
const shouldMinify = args.includes('--minify');
const shouldWatch = args.includes('--watch');
const shouldDev = args.includes('--dev');
const portIdx = args.indexOf('--port');
const devPort = portIdx !== -1 ? parseInt(args[portIdx + 1], 10) : 8094;
const TAG_NAME = process.env.TAG_NAME || '';

// ── 1. 从 index.html 提取 <script> 标签的文件路径（保持顺序） ──
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const scriptRe = /<script\s+src="([^"]+)"[^>]*><\/script>/g;
const scripts = [];
let m;
while ((m = scriptRe.exec(html)) !== null) {
  scripts.push(m[1].split('?')[0]);
}
console.log(`Found ${scripts.length} script entries`);

// ── 拼接所有 JS 文件内容 ──
function concatScripts() {
  return scripts.map(f => {
    const filePath = path.join(ROOT, f);
    return `// ===== ${f} =====\n${fs.readFileSync(filePath, 'utf8')}`;
  }).join('\n\n');
}

// ── 计算内容哈希（取前 8 位） ──
function contentHash(content) {
  return crypto.createHash('md5').update(content).digest('hex').slice(0, 8);
}

// ── 生成 bundle 文件名（hash + tag 后缀） ──
function makeBundleName(hash) {
  return TAG_NAME ? `bundle.${hash}-${TAG_NAME}.js` : `bundle.${hash}.js`;
}

// ── 清空并创建目标目录 ──
function cleanDist() {
  if (fs.existsSync(DIST)) {
    fs.rmSync(DIST, { recursive: true, force: true });
    console.log('Cleaned dist/');
  }
  fs.mkdirSync(DIST, { recursive: true });
}

// ── 生成 dist/index.html ──
function generateDistHtml(bundleName) {
  const distHtml = html
    .replace(/<link\s+rel="preload"\s+as="script"\s+href="[^"]+"\s*>\n?/g, '')
    .replace(/<script\s+src="[^"]+"[^>]*><\/script>\n?/g, '')
    .replace(
      '</body>',
      `  <script src="${bundleName}"></script>\n</body>`
    );
  fs.writeFileSync(path.join(DIST, 'index.html'), distHtml);
}

// ── 复制静态资源 ──
function copyStatic() {
  const files = ['css/style.css', 'favicon.ico', 'manifest.json', 'robots.txt'];
  for (const f of files) {
    const src = path.join(ROOT, f);
    const dest = path.join(DIST, f);
    if (fs.existsSync(src)) {
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
  }
}

// ── 执行模式 ──
async function main() {
  if (shouldDev) {
    // dev 模式：拼接 + transform 构建，watch 重建，serve 提供
    cleanDist();
    // 初始构建
    let content = concatScripts();
    let result = await esbuild.transform(content, { sourcefile: 'bundle.js', logLevel: 'info' });
    let bundleHash = contentHash(result.code);
    let bundleName = makeBundleName(bundleHash);
    fs.writeFileSync(path.join(DIST, bundleName), result.code);
    if (result.map) fs.writeFileSync(path.join(DIST, `${bundleName}.map`), result.map);
    generateDistHtml(bundleName);
    copyStatic();

    // watch 重建：监听源文件变化，重建 bundle.js
    const watchFiles = scripts.map(f => path.join(ROOT, f));
    let rebuilding = false;
    const rebuild = async () => {
      if (rebuilding) return;
      rebuilding = true;
      try {
        // 删除旧的带哈希的 bundle 文件
        const oldBundles = fs.readdirSync(DIST).filter(f => /^bundle\.[a-f0-9]+(-[^\s]+)?\.js(.map)?$/.test(f));
        for (const f of oldBundles) fs.unlinkSync(path.join(DIST, f));

        content = concatScripts();
        result = await esbuild.transform(content, { sourcefile: 'bundle.js', logLevel: 'info' });
        bundleHash = contentHash(result.code);
        bundleName = makeBundleName(bundleHash);
        fs.writeFileSync(path.join(DIST, bundleName), result.code);
        if (result.map) fs.writeFileSync(path.join(DIST, `${bundleName}.map`), result.map);
        generateDistHtml(bundleName);
        console.log(`[${new Date().toLocaleTimeString()}] Rebuilt ${bundleName}`);
      } catch (e) {
        console.error('Rebuild error:', e.message);
      }
      rebuilding = false;
    };
    for (const f of watchFiles) {
      fs.watch(f, () => rebuild());
    }

    // 启动 HTTP 服务器
    const http = require('http');
    const mimeTypes = {
      '.html': 'text/html', '.js': 'application/javascript',
      '.css': 'text/css', '.ico': 'image/x-icon',
      '.json': 'application/json', '.png': 'image/png',
    };
    const server = http.createServer((req, res) => {
      const url = new URL(req.url, `http://${req.headers.host}`);
      let filePath = path.join(DIST, decodeURIComponent(url.pathname));
      if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        filePath = path.join(filePath, 'index.html');
      }
      if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        const ext = path.extname(filePath);
        res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
        fs.createReadStream(filePath).pipe(res);
      } else {
        res.writeHead(404); res.end('Not Found');
      }
    });
    server.listen(devPort, '0.0.0.0', () => {
      const addr = server.address();
      const host = ['0.0.0.0', '::'].includes(addr.address) ? '127.0.0.1' : addr.address;
      console.log(`\n Dev server running at http://${host}:${addr.port}/`);
      console.log(`  Watching ${scripts.length} files for changes... (Ctrl+C to stop)\n`);
    });
  } else if (shouldWatch) {
    cleanDist();
    const content = concatScripts();
    const ctx = await esbuild.context({
      stdin: { contents: content, resolveDir: ROOT, loader: 'js' },
      bundle: false,
      write: false,
      format: 'iife',
      logLevel: 'info',
    });
    await ctx.watch();
    generateDistHtml('bundle.js');
    copyStatic();
    console.log(`\n Watching for changes... (Ctrl+C to stop)`);
    console.log(`  Output: dist/bundle.js\n`);
  } else {
    // 一次性构建：拼接 + esbuild transform 压缩
    cleanDist();
    const content = concatScripts();
    const result = await esbuild.transform(content, {
      minify: shouldMinify,
      sourcemap: shouldMinify ? false : 'external',
      sourcefile: 'bundle.js',
      logLevel: 'info',
    });
    const bundleName = makeBundleName(contentHash(result.code));
    fs.writeFileSync(path.join(DIST, bundleName), result.code);
    if (result.map) {
      fs.writeFileSync(path.join(DIST, `${bundleName}.map`), result.map);
    }
    generateDistHtml(bundleName);
    copyStatic();
    const size = (fs.statSync(path.join(DIST, bundleName)).size / 1024).toFixed(1);
    console.log(`\n Build complete → dist/`);
    console.log(`  ${bundleName}  (${size} KB${shouldMinify ? ' minified' : ''})`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
