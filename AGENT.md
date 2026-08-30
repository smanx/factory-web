# AGENT.md — 面向 AI 开发者的项目指南

本文档面向在 `factory-web`（浏览器端类《异星工厂》工厂自动化游戏，原生 JS + HTML5 Canvas，零构建依赖）上工作的 **AI 开发助手**。它说明项目的**数据来源铁律、数据流水线、以及改动代码时的纪律**，避免在迭代中破坏「唯一数值源」这一架构根基。

> 玩法/特性/上手流程详见 [README.md](README.md)。本文只讲「如何给这个项目安全地写代码」，重点是数据。

---

## 0. 铁律（AI 每次动手前先读）

1. **数值只能有一份。** 游戏所有**数值型数据**（堆叠数、配方成本/耗时、建筑血量、功耗、速度、距离、燃料能量、污染、回收配方……）的唯一来源是 `js/data/data.generated.js` 里的 **`GAME_DATA`**。
2. **`GAME_DATA` 本身就是产物。** 它由 `npm run data` 从 `factorio-data/`（官方 Factorio 数据子模块）自动生成，**禁止手改** `data.generated.js`。
3. **不要在业务代码里硬编码第二套数值。** 需要读某项官方数值时，一律走 `GAME_DATA.xxx?.key ?? 兜底值`（兜底仅用于旧档/未生成场景，不是新数据源）。
4. **显示层可以手工，数值层不允许。** 中文名/emoji/颜色/描述/占地面积/科技树展示等「展示信息」由手工表维护；一旦某项被官方覆盖，以官方为准。
5. **数据获取优先级（任何数值，严格按此顺序）：**
   - **① 子模块优先**：凡 `factorio-data/`（官方原型数据子模块 `wube/factorio-data`）里有对应数据的，一律从子模块取（经 `npm run data` → `GAME_DATA`），不得绕过。
   - **② 查不到再查官方文档**：子模块没有、或需要核对数值时，查《异星工厂》官方百科，例如 [Uranium_fuel_cell/zh](https://wiki.factorio.com/Uranium_fuel_cell/zh)（wiki.factorio.com 即官方 Wiki，各物品/配方/建筑/科技名后接 `/zh` 即中文页）。
   - **③ 只信官方，不要信其它、更不要自造**：**绝不相信/采用**子模块与上述官方 Wiki 之外任何来源的数据（第三方资料站、博客、评论、个人测算），也**不得凭经验或想象自行编造数值**。若无官方来源，宁可保留手工并注明「项目自定/无官方」，也不要「凑一个合理值」。
6. 本游戏对比官方新增了6个物品（创造/虚空物品），属于特殊物品，不要移除了。

---

## 1. 数据来源与流水线（重点）

### 1.1 链条总览

```
factorio-data/                官方 Factorio 2.x 原型数据（git 子模块 wube/factorio-data）
   │  每个 mod 一个目录：core / base / elevated-rails / quality / recycler / space-age
   │  里面是 Lua：data.lua、prototypes/**、locale/zh-CN、locale/en …
   ▼
tools/convert-data.js        用 fengari（Lua 解释器）执行上述 Lua，收集成 data.raw 的 JS 对象
   │  内存中完成，不落盘；数值（堆叠/配方/血量/功耗/速度…）唯一取自这里
   ▼
tools/generate-game-data.js  从 data.raw 提取数值表，并结合 data/(locale) 的多语言文本，生成：
   │          └→  data/ 是原版游戏中英文文本数据（每 mod 一个目录，locale/en、locale/zh-CN/*.cfg，
   │              解析成 GAME_DATA.names / recipeNames，供中英文切换）
   ▼
js/data/data.generated.js    定义全局常量 GAME_DATA（数值唯一源 + 中英文名）
   ▼（加载期桥接，见 §2）
各手工数据表（data-items / data-recipes / data-buildings …）   ← 展示层在浏览器内合并进来
```

### 1.2 关键命令

| 命令 | 作用 |
|---|---|
| `node tools/generate-game-data.js`（或 `npm run data`） | 重新转换 factorio-data 并生成 `js/data/data.generated.js` |
| `node tools/generate-game-data.js --report` | 报告模式：对照手工表、列出待覆盖/缺失项，**不写文件** |
| `node tools/run-verify.js` / `bash tools/run-verify.sh` | 全量数值回归校验（见 §5） |

### 1.3 各环节职责

- **`factorio-data/`（git 子模块）**：官方原型数据的唯一真源。改数值不要改这里（除非是官方 upstream 更新），应改的是「提取逻辑」或「兜底值」。
- **`tools/convert-data.js`**：`fengari` 加载 Lua → 产出 `data.raw`。它定义了 `mods`（core/base/elevated-rails/quality/recycler/space-age）、`data.extend`、`defines` 常量与语言包注入；一般无需改动。
- **`tools/generate-game-data.js`**：**数值提取与映射的唯一入口**。
  - `ITEM_MAP` / `RECIPE_MAP`：项目 ID ↔ 官方原型名的改名映射（未列出的视为同名）。
  - `KEEP_MANUAL_RECIPES`：**允许保留手工的一组配方**（项目自定、故意用旧版、或官方配方依赖星球专属资源而项目做了基础资源适配，例如 `storage-chest`、`chemical-science-pack`、`space-science-pack`、`yumako-growing` 等）。这些配方自动覆盖会跳过。
  - `extractObjectKeys()`：从手工表 `ITEMS`/`RECIPES`/`BUILD_DEFS`/`REFINERY_RECIPES`/`CENTRIFUGE_RECIPES` 读取项目侧 ID，再按映射去官方 `data.raw` 取数。
  - 输出的 `GAME_DATA` 结构（键含义见 `data.generated.js` 顶部注释）：`stackSize`、`buildingHp`、`powerUse`、`deviceStats`、`recipe`、`recipeDevice`、`names`、`recipeNames`、`itemGroup`、`itemSubgroup`、`subgroupOrder`、`itemOrder`、`undergroundDist`、`renewable`、`fluidCapacity`、`beaconRange`、`turret`、`ammoDamage`、`radar`、`equipment`、`heat`、`roboportPower`、`cargoLandingPad`、`cargoBay`、`cargoUnloadingBay`、`footprint`、`pollution`、`recycling`、`fuelEnergy`、`qualityTiers`。
- **`js/data/data.generated.js`（只读产物）**：浏览器直接加载的全局 `GAME_DATA`。**AI 不得直接编辑**。

---

## 2. 运行时合并（GAME_DATA → 手工表）

`data.generated.js` 不是被手工表整体替换，而是把它变成运行时数值样本，**在手工表各自文件末尾以「官方覆盖手工同名键」的方式合入**。加载顺序（见 `index.html`）：

```
data.generated.js  →  data-items.js → data-item-icons.js → data-recipes.js → data-buildings.js
                   →  data-tech.js → data-tech-tree.js → data-util.js
        （GAME_DATA 最先就位；其余全部 defer）
```

桥接点（改代码前务必定位）：

- `js/data/data-items.js:478` — `STACK_SIZES[k] = GAME_DATA.stackSize[k]`（官方堆叠覆盖手工 `STACK_SIZES`）。
- `js/data/data-recipes.js:715` — `RECIPES[k] = GAME_DATA.recipe[k]`（自动覆盖组装机配方同名键）；`:724` 把 `time/inp/out/prob` 写回 `REFINERY_RECIPES` / `CENTRIFUGE_RECIPES`（炼油/离心机面板表）。`:638` 用 `GAME_DATA.recipeDevice` 判定配方所属设备。
- `js/data/data-buildings.js:208` — `BUILDING_HP[k] = GAME_DATA.buildingHp[k]`。
- `js/data/data-util.js` — 多语名 `localizedName()` 读 `GAME_DATA.names` / `recipeNames`；`fuelEnergy()` 读 `GAME_DATA.fuelEnergy`；品质变体读 `GAME_DATA.qualityTiers`；`data.js` 顶部的燃料能量/蒸汽功率/核能热量等常量读 `GAME_DATA.fuelEnergy/steamPower/powerUse/heat/undergroundDist`。
- 设备文件（`js/devices/*.js`）业务上需要官方数值时同样走 `GAME_DATA.xxx?.key ?? 兜底`（如 `recycler.js:75` 读 `GAME_DATA.recycling`）。

**因此：** 「让游戏中所有数据都来自 `data.generated.js`」的实际语义是——**所有数值型数据以 `GAME_DATA`（← factorio-data）为唯一真源**；手工表承担：官方无同名物的项目自定物品、展示信息（中文名/emoji/颜色/描述）、占地面积 `BUILD_DEFS`、科技树展示，以及在浏览器加载期把 `GAME_DATA` 桥接进各运行时表。

---

## 3. 给 AI 的修改准则

### 3.1 想改某个游戏数值时
1. **先查它是否已被官方覆盖**：`grep` 对应 `GAME_DATA.<section>`，或跑 `node tools/generate-game-data.js --report` 看覆盖清单。
2. **已被覆盖** → 不要改手工表里的那个值（会被生成器/桥接覆盖成无效）。要改官方数值，去 `factorio-data` 的官方数据或改生成脚本的映射/计算；否则确认增加到 `KEEP_MANUAL_RECIPES`/手工表并加注释说明原因。
3. **新增物品/配方/建筑**：在 `data-items.js` / `data-recipes.js` / `data-buildings.js` 定义**项目侧 ID**，再在 `tools/generate-game-data.js` 里登记映射（如需改名）让官方数值自动桥接；若官方无同名/依赖星球资源，则保留手工并在注释/`KEEP_MANUAL_RECIPES` 中说明。
4. **改动后**：重新跑 `npm run data` 重新生成 `data.generated.js`，再跑校验（§5）。

### 3.2 想读某个官方数值时
- 统一 `GAME_DATA.<section>?.<id> ?? <兜底常量>`，兜底常量与官方值一致（见 `data.js` 顶部既有模式）。**禁止**在业务文件里新起一套硬编码数值表。

### 3.3 不要做的事
- ❌ 手改 `js/data/data.generated.js`。
- ❌ 在 `js/devices/*.js`、`js/ui/*.js` 等业务代码里散落魔法数值（如某熔炉耗时、某塔射程直接写死）——除非官方确实没有、纯项目实现。
- ❌ 改动 `factorio-data/` 内部文件（子模块，改不动/不该改）。

---

## 4. 代码目录结构与关系

### 4.1 总览

```
factory-web/
├── index.html                入口：按依赖顺序加载全部脚本与样式（无打包器）
├── css/style.css             全部 UI/游戏界面样式
├── js/                       全部游戏代码（无模块化，共享全局作用域）
│   ├── data/                 数据层：数值唯一源 GAME_DATA + 手工展示表 + 桥接
│   ├── core/                 基础设施：设备注册表 / 实体基类 / 绘制 / 电网
│   ├── game/                 世界、存档、角色、统计、音效、蓝图
│   ├── main/                 启动、主循环、输入、开始菜单入口
│   ├── devices/              每种设备一个文件（插件式）
│   ├── render/               渲染
│   └── ui/                   界面（HUD、背包/设备面板、快捷栏、调试）
├── tools/                    构建/数据生成/校验脚本（Node，命令见 §1.2）
├── factorio-data/            官方 Factorio 数据（git 子模块，只读）
├── data/                     原版游戏中英文文本数据（每 mod 一个目录，含 locale/en 与 locale/zh-CN/*.cfg，驱动 GAME_DATA.names/recipeNames）
├── docs/                     设计文档
├── build.js                  构建/版本注入（window.__BUILD_VERSION__）
└── AGENT.md / README.md      本文件 / 项目说明
```

### 4.2 各目录职责

**`js/data/`（数据层，改动游戏数值最先动这里）**
- `data.generated.js`：`GAME_DATA`，生成产物，**只读**（见 §1、§2）。
- `data.js`：主常量与工具。加载最早（非 defer，紧跟 `data.generated.js`）。定义 `TILE/CHUNK`、`BELT_SPEED` 等常量、`POWER_USE`、`FLUIDS`、燃料能量、发电链、核能热量、矿石索引，以及核心工具函数与 `drawItemGlyph` 图标绘制。它是所有业务代码的公共底座。
- `data-items.js`：`ITEMS`（物品展示：中文名/emoji/颜色/描述/堆叠）+ `STACK_SIZES`。
- `data-item-icons.js`：`ITEM_CUSTOM_ICONS` 手绘专属物品图标（canvas 绘制函数，按物品 ID 索引），在 `drawItemGlyph`（`data-util.js`）中优先渲染；设计进度见 `docs/item-icons-todo.md`（全部 329 项已完成）。
- `data-recipes.js`：`RECIPES`、`REFINERY_RECIPES`、`CENTRIFUGE_RECIPES`、`DEVICE_NAMES`。
- `data-buildings.js`：`BUILD_DEFS`（占地/放置属性）、`BUILDING_HP`。
- `data-tech.js` / `data-tech-tree.js`：科技 `TECH` 与科技树 `TECH_TREE`（展示层）。
- `data-util.js`：`GAME_DATA` 桥接落地、多语言 `localizedName`、品质变体生成、公共函数（`beltSpeed/labSpeedMult/weaponDamageMult` 等）。

**`js/core/`（基础设施，面向表编程，无设备分支）**
- `registry.js`：设备注册表——`ENT_CLASSES`/`DEVICE_RENDER`/`DEVICE_STATUS`/`DEVICE_PANEL`/`DEVICE_PLACE`/`DEVICE_DIR_ROTATE`/`DEVICE_FLUID_ICONS`。每个 `devices/*.js` 末尾自注册；新增设备=新增一个设备文件。
- `entity.js`：`Entity` 基类 + 分桶空间索引（`G.buckets`）。
- `draw.js`：通用绘制工具。
- `power.js`：电网增量计算（只扫发电/耗电子集）。

**`js/game/`（世界与玩法状态）**
- `world.js`：无限分块世界，确定性地形/矿脉生成、区块编解码持久化。
- `world-config.js`：世界生成配置（种子/大小/资源/敌人）。
- `saves.js`：IndexedDB 多存档 + 旧档迁移。
- `player.js`：玩家移动/碰撞/背包/手挖。
- `menu.js` + `main/main-menu.js`：开始菜单（新游戏/读档，前者负责菜单背景与 `G.inMenu` 循环协调，后者负责入口按钮逻辑与新手引导）。
- `particles.js`/`stats.js`/`sfx.js`/`blueprint.js`：粒子、统计、程序化音效、蓝图。

**`js/main/`（生命周期入口，最后加载）**
- `main.js`：定义全局单例 `G`（`canvas/ctx/cam/world/player/ents`、`techDone/techProg`、`panelMode/panelEnt`、背包、蓝图、设置 `G.settings` 等全部运行状态）、主循环、建造/拆除、开局逻辑。依赖所有前述模块。
- `main-input.js` / `main-actions.js`：输入处理与动作分发。

**`js/devices/`（每设备一文件，插件式）**
- 如 `belt.js`、`inserter.js`、`assembler.js`、`reactor`(nuclear.js)、`railway.js`、`vehicle-*.js` 等。各自在末尾向 `registry.js` 自注册，业务上读数据统一走 `GAME_DATA.xxx?.key ?? 兜底`。

**`js/render/`**：`render.js`（相机/分块调度）、`render-entity.js`、`render-player.js`、`render-minimap.js`（小地图）。
**`js/ui/`**：`ui.js`（HUD/快捷栏/背包入口）、`ui-panel.js`（机器面板）、`ui-hud.js`、`ui-debug.js`、`ui-quickbar.js`。设备面板通过 `DEVICE_PANEL` 关联。

### 4.3 关键关系

- **全局共享作用域（无模块化/打包器）**：脚本按 `index.html` 文档顺序执行，所有 `const`全局/顶层 `var G` 互相可见。主依赖链已在 html 注释标为「非关键脚本 defer（保持文档顺序，依赖链不变）」。**因此加载顺序即依赖顺序**：
  `data.generated → data → saves/world-config/开始菜单 → 数据表(data-*) → core → devices(a→z) → player/ui/render → main(main.js)`
  新增/部署脚本时必须在 `index.html` 相应顺序位置引入，且 `?v=N` 递增。
- **数据流（单向）**：`data.generated(GAME_DATA)` → 各 `data-*.js` 末尾桥接进运行时表（`ITEMS/STACK_SIZES/RECIPES/BUILDING_HP…`）→ 业务代码（`devices/ui/main`）只读这些表与 `GAME_DATA`，不在业务里再写第二套数值。
- **插件式设备**：新增设备流程 = `js/devices/` 新建文件 → 向 `core/registry.js` 自注册（类/渲染/面板/放置/旋转/流体图标）→ 在 `index.html` 引入 → `data-*.js` + `tools/generate-game-data.js`（如官方有同名物）接入数值。
- **主循环调度**：`main.js` 每帧调各子系统 `update`；`render.js` 读 `G` 状态绘制；`ui*.js` 只改 `G` 与 DOM，不直接写世界。

---

## 5. 校验（改数据后必跑）

`tools/run-verify.js`（或 `bash tools/run-verify.sh`）串行执行全部校验脚本，任一失败退出非零。覆盖：配方、科学包、堆叠、传送带吞吐、数据完整性、信号塔模块、核能、机械臂车道、分流器优先级、地下带双道、机械臂侧翻/多输入、石油速率、实体旋转、存档布局/旋转迁移等。改动任何数值后请运行并保证 **exit code 0**。

---

## 6. 其他

- 归档/版本：`build.js` 通过构建注入 `window.__BUILD_VERSION__`（无 tag 时回退 `'dev'`），界面左下角/设置面板会显示。
- 地图生成、核能热量、铁路信号等复杂系统均以官方机制为蓝本，业务实现存在简化，但**凡官方有可提取数值处，均以 `GAME_DATA` 取值**——改动前先确认该值来源于官方还是项目自定，再决定改哪里。