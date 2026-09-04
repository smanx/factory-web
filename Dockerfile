# ============ 构建阶段：生成 dist 静态产物 ============
FROM node:20-alpine AS builder
WORKDIR /app

# 先拷贝依赖清单以利用 Docker 缓存
COPY package.json package-lock.json ./
RUN npm ci

# 拷贝源码并执行压缩构建
COPY . .
RUN npm run build:minify

# ============ 运行阶段：nginx 托管静态产物 ============
FROM nginx:1.27-alpine AS runner

# 内联 nginx 站点配置（gzip、SPA 回退、静态资源缓存）
RUN printf '%s\n' \
    'server {' \
    '  listen 80;' \
    '  server_name _;' \
    '  root /usr/share/nginx/html;' \
    '  index index.html;' \
    '  gzip on;' \
    '  gzip_min_length 1k;' \
    '  gzip_comp_level 5;' \
    '  gzip_types text/plain text/css application/javascript application/json image/svg+xml;' \
    '  location = /index.html {' \
    '    add_header Cache-Control "no-cache";' \
    '    try_files $uri =404;' \
    '  }' \
    '  location ~* \.(js|css|png|jpg|jpeg|gif|webp|svg|ico|woff2?|map)$ {' \
    '    expires 7d;' \
    '    add_header Cache-Control "public, immutable";' \
    '    try_files $uri =404;' \
    '  }' \
    '  location / {' \
    '    try_files $uri $uri/ /index.html;' \
    '  }' \
    '}' \
    > /etc/nginx/conf.d/default.conf

# 复制构建产物到 nginx 网站根目录
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]