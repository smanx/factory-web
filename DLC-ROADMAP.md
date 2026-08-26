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
- [x] 在 GAME_DATA 暴露 DLC 可用物品/配方清单，并把 Space Age 材料链物品/配方/设备
  完整提取进 GAME_DATA 主表（stackSize/names/footprint/buildingHp/powerUse/deviceStats）

### 阶段二：Space Age 基础材料链（低风险，先落地）
- [x] 碳纤维 / 锂 / 锂板 / 超导体 / 电磁工厂（Electromagnetic plant）材料链
- [x] 电磁科研包（electromagnetic-science-pack）及配套「电磁学」科技
- [x] 太空材料加工链（破碎机 Crusher + 小行星碎块）：金属/碳质/氧化星块 → 铁矿石/碳/冰，破碎机+冰熔化
  （官方小行星来自太空，此处适配为遥远地面矿床，供破碎机粉碎；产出物参考官方粉碎配方）
- [x] 进阶星块加工（本 PR 增量）：高级星块粉碎（advanced-*-asteroid-crushing，官方 5s，
  高级金属=铁矿石10+铜矿石4 / 碳质=碳5+硫磺2 / 氧化=冰3+方解石2）与星块再处理
  （*-asteroid-reprocessing，官方 shared_probability：40% 同种 / 20% 各异种随机转换，破碎机按概率产出），
  全部数据/配方名来自 data.generated.js（factorio-data 官方 locale），统一由「太空材料加工」科技解锁
- [x] 生物质材料链与农业科研包（Gleba 基础链）：玉玛果 / 玉玛果泥 / 生物结晶 / 营养素 /
      变质物 / 生化炉（Biochamber）/ 农业科研包（agricultural-science-pack）及「农业科技」

> 已落地说明（本 PR 增量）：
> - 物品：`carbon-fiber` / `lithium` / `lithium-plate` / `superconductor` /
>   `electromagnetic-science-pack` / `electromagnetic-plant` 已接入，堆叠/命名均来自
>   GAME_DATA（factorio-data 官方）。
> - 电磁工厂设备：占地 4×4、血量 350、功耗 2000kW、制造速度 2.0、模块槽 5，
>   全部数值来自 GAME_DATA.deviceStats/footprint/buildingHp/powerUse，未单独维护数值表。
> - 配方适配：官方配方依赖星球专属资源（钬板/锂卤水/氨水/氟酮等），当前项目尚未实现
>   行星系统，故将材料链配方适配为可用基础资源合成（如锂=硫酸+轻油），
>   配方键仍在 RECIPES、产出物与耗时参考官方。
> - 科技：新增「电磁学」科技（需 space-science+utility）统一解锁本材料链，
>   电磁科研包由电磁工厂产出，可被研究所消耗。
>
> 生物质材料链（本 PR 增量）：
> - 物品：`yumako` / `yumako-mash` / `bioflux` / `nutrients` / `spoilage` /
>   `agricultural-science-pack` 已接入，堆叠/命名均来自 GAME_DATA（factorio-data 官方）。
> - 生化炉设备：占地 3×3、血量 300、功耗 500kW、制造速度 2.0、模块槽 4，
>   全部数值来自 GAME_DATA（官方 biochamber），未单独维护数值表。
> - 配方：玉玛果→玉玛果泥、玉玛果泥→生物结晶、玉玛果泥→营养素、变质物+生物结晶→硫磺、
>   生物结晶→农业科研包、生化炉本体；产出物/耗时参考官方，配方键保留官方名。
> - 科技：新增「农业科技」（需 space-science+utility）解锁本材料链，
>   农业科研包由生化炉产出，可被研究所消耗。

### 阶段三：核心 DLC 机制（中风险）
- [x] **品质系统**：品质等级 + 品质模块 + 品质合成（6 级）

> 已落地说明（本 PR 增量）：
> - 品质模块 1-3 级（quality-module/2/3）已接入：堆叠(=50)、配方、命名全部来自 GAME_DATA（factorio-data 官方，含 quality-module-3 官方配方引入 superconductor）。
> - 品质加成/速度惩罚经 GAME_DATA.qualityModules 单源桥接（官方 quality 效果：+1%/+2%/+2.5%、速度-5%）。
> - 品质合成机制：设备装品质模块后，产出可建造/装备物品时每个单位有 chance 概率升级为更高品质（罕见/稀有/史诗/传说，官方 6 级品质），品质物品以 `item~quality` 存储。
> - 品质数值加成：高品质建筑制造速度更快、装备更强（官方 quality 原型数据经 GAME_DATA.qualityTiers 单源）。
> - 信号塔可广播品质加成（品质模块装入信号塔）。
> - 科技：「品质学 / 品质学 II / 品质学 III」三档科技解锁三级品质模块。
- [x] **回收机**（Recycler）：把物品还原成其配方原料的 25%（每项至少 1 个，对齐官方 recycle_ratio=0.25）

> 已落地说明（本 PR 增量）：
> - 物品/配方/设备：`recycler` 已接入，堆叠/命名/占地/血量/功耗/速度/模块槽全部来自
>   GAME_DATA（factorio-data 官方：占地 2×4、血量 300、功耗 180kW、速度 0.5、模块槽 4）。
> - 回收机制：对齐官方 recycle_ratio=0.25，把任意可回收物品还原成其配方原料的 25%
>   （每项至少 1 个）；矿石/流体等无配方物品不可回收。配方来源=项目全部合成配方表。
> - 配方：官方 processing-unit 6 + steel 20 + gear 40 + concrete 20（能耗 3s，此处对齐）。
> - 科技：新增「回收科技」（需电磁科研包+utility），解锁回收机；数据校验并入 verify-dlc。

- [x] **高架铁轨**（Elevated Rails）：高架桥墩 + 高架轨道铺设

> 已落地说明（本 PR 增量）：
> - 物品：`rail-support`（堆叠 20）/ `rail-ramp`（堆叠 10）已接入，堆叠/命名/血量均来自
>   GAME_DATA（factorio-data 官方：桥墩 max_health 1000、高架轨道 max_health 2000）。
> - 配方：官方 rail-support = 精炼混凝土 20 + 钢板 10；rail-ramp = 精炼混凝土 100 + 铁轨 8 + 钢板 10，
>   数据由 GAME_DATA 桥接，未单独维护数值表。
> - 玩法：桥墩 rail-support 与高架轨道 rail-ramp 均可直接在陆地/水面铺设（跨越水域/障碍），
>   高架轨道复用 railTiles 网络，列车可在其上正常行驶；高架轨道以加高亮色渲染体现高架层。
> - 科技：新增「高架铁轨」科技（前置混凝土+产能科研包），解锁桥墩与高架轨道；
>   数据校验并入 verify-dlc（15 项）。

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
