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

- [x] **超速物流（Space Age Turbo belt）**：超速传送带/地下带/分流器（4 档带，速度 7.5 格/s）

> 已落地说明（本 PR 增量）：
> - 物品：`turbo-transport-belt`（堆叠 100）/ `turbo-underground-belt`（堆叠 50，最大距离 11 格）/
>   `turbo-splitter`（堆叠 50），堆叠/带速/血量（170/170/190）/命名全部来自 GAME_DATA
>   （factorio-data 官方 Space Age：turbo-transport-belt 官方 speed 0.125 → 7.5 格/s，为普通带 4 倍）。
> - 配方：官方配方依赖钨板（tungsten-plate，Vulcanus 资源）与润滑油，项目尚未实现行星系统，
>   故适配为可用高级材料（钢板+塑料+高级电路+润滑油）合成，产出物/耗时参考官方；
>   配方键保留官方名，数据单源（堆叠/带速/血量来自 GAME_DATA，配方为手工适配）。
> - 玩法：超速带/超速地下带/超速分流器作为物流第 4 档（比极速带快 4/3≈1.33 倍），
>   完整接入传送带阶级链（R 旋转/覆盖升级降级/绿图批量升级），速度 7.5 格/s、双车道 60 件/s。
> - 科技：新增「超速物流」科技（需空间科技+极速物流），解锁超速物流三件套；

>   数据校验并入 verify-dlc（15 项）。
- [x] **大型采矿机（Space Age Big mining drill）**：5×5 大范围快速采矿建筑

> 已落地说明（本 PR 增量）：
> - 物品/设备：`big-mining-drill`（大型采矿机）已接入，堆叠/命名/占地/血量/功耗/采矿速度/模块槽全部来自
>   GAME_DATA（factorio-data 官方：堆叠 20、占地 5×5、血量 300、功耗 300kW、mining_speed 2.5、模块槽 4）。
> - 玩法：采矿范围比电采矿机（3×3）更大（5×5）、速度更快（2.5，为电矿机 0.5 的 5 倍），
>   完整接入电采矿机行为（模块/硫酸铀矿/产能/信号塔），R 旋转/蓝图/存档迁移。
> - 配方：官方配方依赖熔融铁+钨碳化物（Vulcanus 行星资源，项目暂无行星系统），适配为
>   基础资源（电采矿机1+高级电路10+电机10+钢板50+精炼混凝土20，耗时 30s 参考官方）。
> - 科技：新增「大型采矿机」科技（需空间科技+采矿业），解锁大型采矿机；
>   数据校验并入 verify-dlc（13 项）。
>   数据校验并入 verify-dlc（15 项）。

- [x] **铸造厂 + 钨材料链（Space Age Foundry + Tungsten，Vulcanus）**：高级熔炼建筑 + 钨/冶金材料链

> 已落地说明（本 PR 增量）：
> - 物品/设备：`foundry`（铸造厂）已接入，堆叠/命名/占地/血量/功耗/制造速度/模块槽全部来自
>   GAME_DATA（factorio-data 官方：堆叠 20、占地 5×5、血量 350、功耗 2500kW、crafting_speed 4、模块槽 4）。
> - 钨材料链：`tungsten-ore`（钨矿石，堆叠 50）/ `tungsten-plate`（钨板，堆叠 50）/ `tungsten-carbide`（碳化钨，堆叠 50）/
>   `metallurgic-science-pack`（冶金科研包，堆叠 200），堆叠/命名全部来自 GAME_DATA（factorio-data 官方）。
> - 配方：官方配方依赖熔融铁/火山熔岩等 Vulcanus 星球专属资源，项目暂无行星系统，故适配为基础资源
>   （钨矿石=石头+煤、钨板=钨矿石、碳化钨=钨板+碳、冶金科研包=钨板+碳化钨+电路板、铸造厂=钢板+处理器+钢筋混凝土+电炉），
>   配方键保留官方名，产出物/耗时参考官方，数据单源（堆叠/命名/占地/功耗/速度来自 GAME_DATA）。
> - 玩法：铸造厂作为熔炼第 4 档完整接入组装机行为（模块/电路/旋转），5×5 大占地、crafting_speed 4 更快，
>   专用于钨/冶金产品链，由「冶金学」科技解锁。
> - 科技：新增「冶金学」科技（需空间科技），解锁钨材料链与铸造厂；
>   数据校验并入 verify-dlc（新增 20 项）。

### 阶段三.5：基础电路网络补齐（Display panel + Selector combinator）
- [x] **显示屏（display-panel）**：官方 base 电路设备（1×1），堆叠 10 / 血量 50 / 配方 1 铁板+1 电路板，
      数据全部来自 GAME_DATA（data.generated.js 官方）。读取所连网络信号并以文字显示在面板上，
      支持配置固定文本行 / 信号值行；未配置时默认列出全部网络信号。由「电路网络」科技解锁。
- [x] **选择组合器（selector-combinator）**：官方 base 电路设备（1×1），堆叠 50 / 血量 150 /
      配方 2 高级电路+5 判断组合器，数据全部来自 GAME_DATA。支持「按索引 / 随机 / 数值最大 / 游戏时钟」
      四种模式从网络信号中选出目标信号并输出其值（官方 Selector combinator 的 index/random/stack/
      game-tick 行为）。由「电路网络」科技解锁。
- 数据校验并入 verify-dlc（12 项）。

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
