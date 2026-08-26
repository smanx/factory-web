# DLC 数据接入与开发路线图

本项目以《异星工厂》web 复刻为目标，factorio-data 子模块已更新到 **2.1.17**（含全部 DLC：
`Space Age` / `Quality` / `Elevated Rails` / `Recycler`）。`tools/convert-data.js` 现场加载
全部 DLC 的 Lua 数据（raw + locale），`tools/generate-game-data.js` 已从中抽取官方数值并生成
`js/data.generated.js`（唯一数值源）。

## 已接入（本 PR 完成）
- factorio-data 子模块 → 2.1.17
- 全部物品/配方/建筑 ID 对齐官方命名（39 组改名，含 2.0 改名项）
- 数据单源化：占地/功耗/速度/堆叠/配方/命名均来自 data.generated.js
- 旧存档 ID 递归迁移层
- 官方中英命名表（names / recipeNames，供设置内语言切换）

## DLC 数据现状
- **locale**：`data/{base,core,elevated-rails,quality,recycler,space-age}/locale/{en,zh-CN}` 已就位
- **raw 原型**：convert-data.js 已加载 `elevated-rails` / `quality` / `recycler` / `space-age`
  - Space Age 物品：电磁科研包、锂/锂板、电磁工厂、超导体、碳、小行星碎块、浆果种子等
  - Quality：6 级品质
  - Elevated Rails：高架铁轨实体
  - Recycler：回收机
- 项目当前仅接入部分 Space Age 基础材料（carbon 碳、calcite 方解石）

## 分阶段开发计划

### 阶段一：数据层（基础，已完成 ID 对齐）
- [x] 子模块更新 + 数据单源化
- [ ] 在 GAME_DATA 暴露 DLC 可用物品/配方清单（供后续功能引用）

### 阶段二：Space Age 基础材料链（低风险，先落地）
- [ ] 锂 / 锂板 / 超导体 / 电磁工厂（Electromagnetic plant）
- [ ] 电磁科研包（electromagnetic-science-pack）及配套科技
- [ ] 太空平台产物（小行星碎块 → 碳化铁 / 氧化铁 / 金属铁）
- [ ] 石炭 / 生物质 / 浆果（Gleba 基础链）

### 阶段三：核心 DLC 机制（中风险）
- [ ] **品质系统**：品质等级 + 品质模块 + 品质合成（6 级）
- [ ] **回收机**（Recycler）：回收配方 + 概率返还
- [ ] **高架铁轨**（Elevated Rails）：高架桥墩 + 高架轨道铺设

### 阶段四：太空时代行星（高风险，大改）
- [ ] 行星切换（Nauvis / Vulcanus / Gleba / Fulgora / Aquilo）
- [ ] 轨道平台 / 太空货运
- [ ] 各行星专属资源与科技

### 阶段五：数值/体验精修
- [ ] 各 DLC 建筑占地/功耗/速度逐一桥接 data.generated.js
- [ ] DLC 科技树接入 data-tech-tree
- [ ] DLC 中英命名接入 names / recipeNames

> 原则：所有新增 DLC 物品/配方/建筑的数据一律从 factorio-data 生成的
> data.generated.js 获取，不再为设备单独维护数值表，保持与官方一致。
