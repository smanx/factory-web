# DLC 数据接入与开发路线图

本项目以《异星工厂》web 复刻为目标，factorio-data 子模块已更新到 **2.1.17**（含全部 DLC：
`Space Age` / `Quality` / `Elevated Rails` / `Recycler`）。`tools/convert-data.js` 现场加载
全部 DLC 的 Lua 数据（raw + locale），`tools/generate-game-data.js` 已从中抽取官方数值并生成
`js/data/data.generated.js`（唯一数值源）。

## 已接入（本 PR 完成）
- factorio-data 子模块 → 2.1.17
- 全部物品/配方/建筑 ID 对齐官方命名（39 组改名，含 2.0 改名项）
- 数据单源化：占地/功耗/速度/堆叠/配方/命名均来自 data.generated.js
- 旧存档 ID 递归迁移层
- 官方中英命名表（names / recipeNames，供设置内语言切换）
- 物品裁剪对齐：移除非官方的多余物品，仅保留 6 个创造/虚空物品（创造/虚空箱、创造/虚空管道、创造/虚空传送带）；移除第 7 个非官方测试设备「被动供电设备 passive-power」

## DLC 数据现状
- **locale**：`data/{base,core,elevated-rails,quality,recycler,space-age}/locale/{en,zh-CN}` 已就位
- **raw 原型**：convert-data.js 已加载 `elevated-rails` / `quality` / `recycler` / `space-age`
  - Space Age 物品：电磁科研包、锂/锂板、电磁工厂、超导体、碳、小行星碎块、浆果种子等
  - Quality：6 级品质
  - Elevated Rails：高架铁轨实体
  - Recycler：回收机
- 项目当前仅接入部分 Space Age 基础材料（carbon 碳、calcite 方解石）
- 本迭代新增 base 精炼警示混凝土（refined-hazard-concrete）：10 精炼混凝土 → 10（0.25s，官方配方），
  堆叠 100、精炼混凝土底 + 黑黄警示条纹、行走加速更快，配方/堆叠全部来自 data.generated.js，
  由「混凝土」科技解锁，完整接入地面铺设/蓝图/小地图渲染

## 分阶段开发计划

### 阶段一：数据层（基础，已完成 ID 对齐）
- [x] 子模块更新 + 数据单源化
- [x] 在 GAME_DATA 暴露 DLC 可用物品/配方清单，并把 Space Age 材料链物品/配方/设备
  完整提取进 GAME_DATA 主表（stackSize/names/footprint/buildingHp/powerUse/deviceStats）

### 阶段一.5：移除已废弃物品（对齐《异星工厂》2.0，本迭代新增）
- [x] 移除《异星工厂》2.0 已删除的物品，仅保留 6 个创造/虚空物品（创造箱/虚空箱/
      创造管道/虚空管道/创造带/虚空带）与调试用被动供电源：
  - `steel-stick`（钢杆，2.0 移除）
  - `fishing-pole`（钓鱼竿，2.0 移除；钓鱼玩法改为无需鱼竿直接点击水域）
  - `iron-axe` / `steel-axe`（铁斧/钢斧，2.0 移除手挖工具）
  - `steam-barrel`（桶装蒸汽，2.0 移除蒸汽桶装）
- [x] 同步移除对应配方、科技（钓鱼/钢斧）、物品渲染分支、手挖工具耐久机制、
      过滤器/调试面板条目。
- [x] 存档迁移：读档时递归清除已废弃物品（`OBSOLETE_ITEMS` + `migrateIds`），
      旧档不因残留废弃物品而报错。
- [x] 全量 18 个校验脚本通过，构建通过。

### 阶段一.75：继续移除多余非官方物品（本迭代新增）
- [x] 按「所有物品/配方 ID 与《异星工厂》官方一致，多出物品移除（仅保留 6 个创造/虚空物品）」原则，
      继续移除以下官方不存在的物品（含配方/科技/渲染/面板/存档迁移）：
  - `thruster-fuel-barrel` / `thruster-oxidizer-barrel`（桶装推进器燃料/氧化剂——官方无对应流体桶）
  - `portable-solar-panel-mk2`（个人太阳能板 II——官方仅有 `portable-solar-panel`→`solar-panel-equipment`）
  - `diesel-locomotive`（内燃机车——官方仅一种火车头 `locomotive`）
- [x] 存档迁移：以上物品加入 `OBSOLETE_ITEMS`，`diesel-locomotive` → `locomotive`（ID_MIGRATE），
      读档自动清除/迁移，旧档不报错。
- [x] 同步清理 tools/generate-game-data.js 中 KEEP_MANUAL_RECIPES 残留条目。
- [x] 仅剩的非官方物品 = 6 个创造/虚空物品（创造/虚空箱、创造/虚空管道、创造/虚空带）
      + 官方卫星（`satellite`，locale 有官方条目）+ 火箭本体（`rocket-body`，发射井内部组装表示，对应官方 rocket-part 组装）。
- [x] 全量 18 个校验脚本通过，构建通过。


### 阶段一.6：基础建筑占地对齐（本迭代新增）
- [x] **火箭发射井占地对齐官方**：`rocket-silo` 占地由 5×5 修正为官方 9×9
      （selection_box ±4.5），新增 FOOTPRINT_SOURCES 桥接，数据来自 GAME_DATA.footprint（factorio-data 官方），
      渲染随占地缩放，逻辑（火箭部件组装/卫星发射）不受影响。
- [x] 校验并入 verify-data-alignment（新增火箭发射井占地 9×9 检查），全量 18 个校验脚本通过，构建通过。

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

> 农业塔（本 PR 增量）：
> - 物品/设备：`agricultural-tower`（农业塔）已接入，堆叠 20 / 占地 3×3 / 血量 500 / 功耗 100kW，
>   全部来自 data.generated.js（factorio-data 官方 Agricultural tower），未单独维护数值表。
> - 种植配方：`yumako-growing`（玉玛果种植）为农业塔专属配方——放入玉玛果种子持续收获玉玛果
>   （每 30s 收获 6 个，收获 60% 概率返还 1 粒种子，实现自持种植循环，对齐官方种植/收获机制）。
> - 配方：农业塔本体=钢板10+电路板3+变质物20+填海料1（官方 10s），数据经 GAME_DATA 桥接。
> - 玩法：作为种植设备完整接入组装机行为（模块/电路/旋转/信号塔），由「农业科技」解锁，
>   补齐 Gleba 农业链闭环（种子 → 玉玛果 → 果泥 → 生物流 → 农业科研包）。
> - 生成脚本：DEVICE_STATS/FOOTPRINT/KEEP_MANUAL_RECIPES 新增农业塔与种植配方官方桥接。
> - 校验：verify-dlc 新增农业塔校验（11 项），全量 18 个校验脚本通过，构建通过。

> 玉玛果土壤（本迭代增量）：
> - 物品/地面：`artificial-yumako-soil`（玉玛果人造土）/ `overgrowth-yumako-soil`（玉玛果沃土）已接入，
>   堆叠 100、官方命名（玉玛果人造土/Artificial yumako soil、玉玛果沃土/Overgrowth yumako soil）均来自
>   GAME_DATA（factorio-data 官方），未单独维护数值表。
> - 玩法：作为可铺设地砖（对齐官方 place_as_tile），铺在草地上形成种植土壤；农业塔须种植在雅玛果土壤上
>   才能生长（人造土/沃土均可），沃土养分更高、生长更快。
> - 配方：玉玛果人造土=玉玛果种子2+营养素50+填海料5 → ×10（官方 2s）；玉玛果沃土=人造土2+种子5+变质物50+
>   水100 → ×1（官方 10s，依赖 biter-egg 生物蛋，适配为现有变质物），配方键保留官方名。
> - 科技：由「农业科技」解锁（复用 Gleba 农业链）；校验并入 verify-dlc（新增 12 项）。

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

### 阶段三.75：Fulgora 避雷系统（本迭代新增）
- [x] **避雷针 + 避雷收集器（lightning-rod / lightning-collector）**：太空时代避雷设备

> 已落地说明（本迭代增量）：
> - 物品/设备：`lightning-rod`（避雷针，1×1）/ `lightning-collector`（避雷收集器，2×2）已接入，
>   堆叠(=50/20)、占地、血量(100/200)、命名全部来自 GAME_DATA（factorio-data 官方），未单独维护数值表。
> - 生成脚本新增 `GAME_DATA.lightning`：官方 lightning-attractor 原型单源（efficiency 0.2/0.4、
>   range_elongation 15/25、buffer_capacity 500MJ/1000MJ）。
> - 雷暴天气机制：研究「避雷科技」后，每隔一段时间进入雷暴期（8~18 秒），期间周期性落雷；
>   避雷针/避雷收集器保护其周围半径（15/25 格）区域，接住落雷后按效率把雷电能量充入内置储能，
>   再放电并入电网（官方效率：避雷针 0.2 / 收集器 0.4）。
> - 未被避雷设备接住的落雷会对附近玩家/建筑造成伤害（雷电威胁感），并有视觉闪电特效。
> - 配方：避雷针=12铜线+8钢板+4石砖（5s）；避雷收集器=1避雷针+8超导体+1蓄电器（官方依赖
>   Fulgora 专属 supercapacitor/electrolyte，适配为现有超导体）。
> - 科技：新增「避雷科技」（需电磁学），解锁避雷针与避雷收集器；数据校验并入 verify-dlc（24 项）。

### 阶段四：太空时代行星（高风险，大改）
- [x] **供热塔（Aquilo Heating tower）**：3×3 燃烧式供热设备，数据全部来自 GAME_DATA.heat（官方 consumption 40MW × effectivity 2.5 → 产热 100MW、specific_heat 5MJ/°C、max_transfer 10GW），达到最高温仍持续燃烧，经四边热量接口向导热管传导（官方 heat_buffer.connections）。配方：2锅炉+5导热管+20混凝土（10s）。由「供热塔」科技解锁。
- [x] **生物实验室（Gleba Biolab）**：5×5 高级研究中心，数据全部来自 GAME_DATA（官方 researching_speed=2、module_slots=4、功耗 300kW、血量 350、占地 5×5），科研速度 2 倍。配方：1实验室+10生物流+25精炼混凝土+3铀-235（官方依赖 biter-egg/capture-robot-rocket=生物星球资源，适配为现有生物链资源）。由「生物实验室」科技解锁（前置农业科技）。
### 阶段四.5：太空推进链（Space Age Thruster fuel/oxidizer，本迭代新增）
- [x] **推进器燃料 / 氧化剂（Thruster fuel / oxidizer）**：太空时代化工厂流体链

> 已落地说明（本迭代增量）：
> - 流体物品：`thruster-fuel`（推进器燃料）/ `thruster-oxidizer`（推进器氧化剂）已接入，
>   中英命名来自 GAME_DATA.names（factorio-data 官方 fluid-name：推进器燃料/Thruster fuel、
>   推进器氧化剂/Thruster oxidizer），并已加入 FLUIDS / BARREL_FLUIDS（支持管道流动与桶装运输）。
> - 配方（官方数据，化工厂 chemical-plant 化学类别配方，数据单源化）：
>   - `thruster-fuel`：2碳+10水→75流体（2s）
>   - `thruster-oxidizer`：2铁矿+10水→75流体（2s）
>   - `advanced-thruster-fuel`：2碳+1方解石+100水→1500流体（10s，配方名 高级推进器燃料/Advanced thruster fuel）
>   - `advanced-thruster-oxidizer`：2铁矿+1方解石+100水→1500流体（10s，配方名 高级推进器氧化剂/Advanced thruster oxidizer）
>   - 高级配方官方依赖 calcite 方解石（Vulcanus 资源，项目已有方解石矿物），产出 1500 单位大宗流体。
> - 科技：新增「太空推进」科技（space-thruster，需电磁学+空间科技），解锁推进燃料/氧化剂链。
> - 用途：作为太空平台/推进器（thruster）的基础推进流体，供后续轨道平台系统使用。
> - 校验：verify-dlc 新增太空推进链校验（23 项），全量 18 个校验脚本通过，构建通过。
- [x] **行星系统（五行星）**：开局可选起始星球 + 星球专属地表色调与资源画像 + 星际旅行
- [x] **各行星专属资源**：祝融=金属/石矿更丰（无油铀）；句芒=无铁铜煤铀（石矿充足）；雷神=铀矿更丰（无煤油）；玄冥=冰原油矿（无铀）

> 已落地说明（本迭代增量）：
> - **行星定义**：`PLANET_OPTIONS` 五行星（新地星 Nauvis / 祝融星 Vulcanus / 句芒星 Gleba /
>   雷神星 Fulgora / 玄冥星 Aquilo），命名对齐官方 factorio-data locale。
> - **地表色调**：`PLANET_GRASS_COLORS` 为每颗行星定义三档草地色（祝融赭石 / 句芒深绿 /
>   雷神灰 / 玄冥冰蓝），`render.js` 按当前行星渲染地表。
> - **资源画像**：`PLANET_RESOURCES` 定义每颗行星各资源丰度（0=无此矿）。`world.js`
>   `pickOreType` 按行星权重加权选矿，原油/铀矿/小行星/水生成按行星丰度缩放与开关，
>   `chunkSeed` 混入行星 id 使不同行星在同一种子下生成不同地形/矿脉。
> - **开局选择**：地图设置面板新增「🌍 起始星球」选项（新游戏）。
> - **星际旅行**：设置面板新增「星际旅行」区块，研究「空间平台」科技后可在游戏内
>   切换到其它星球——按目标星球资源画像重新生成地表与矿脉，保留背包/科技/装备/玩家
>   进度（建筑为星球专属不跨星保留）。`travelToPlanet()` 负责切换。
> - **校验**：verify-dlc 新增行星系统校验（11 项），全量 18 个校验脚本通过，构建通过。

### 阶段四.7：空间平台系统（Space Platform，本迭代新增）
- [x] **空间平台地基 / 中枢 / 推进器 / 小行星收集器**：太空时代空间平台体系

> 已落地说明（本迭代增量）：
> - 物品：`space-platform-foundation`（太空平台地基，堆叠 100）/ `space-platform-hub`（空间平台中枢，8×8）/
>   `thruster`（推进器，4×8）/ `asteroid-collector`（小行星收集器，3×3）/ `space-platform-starter-pack`（起始包），
>   堆叠 / 命名 / 占地 / 血量全部来自 GAME_DATA（factorio-data 官方 selection_box / max_health / stack_size），未单独维护数值表。
> - 空间平台中枢：8×8 组装机变体生产建筑，专用于生产平台地基（官方 20钢板+20铜线→1，10s）、起始包、中枢本体；
>   数据经 GAME_DATA.footprint/buildingHp 桥接（官方 max_health 5000）。
> - 推进器：4×8 发电设备，燃烧推进器燃料 + 推进器氧化剂（官方双流体输入 thruster-fuel/oxidizer）产生电能
>   （满功率 8MW 适配简化模型），需管道同时输入两种推进流体；官方配方 10钢板+10处理器+5电动机（10s）。
> - 小行星收集器：3×3 设备，在轨道上持续收集小行星碎块（金属/碳质/氧化，官方小行星随机分布），
>   供破碎机粉碎加工；官方配方 20低密+8电动机+5处理器（10s）。
> - 科技：新增「空间平台」科技（space-platform，需太空推进+空间科研），解锁平台体系；数据校验并入 verify-dlc（36 项）。
- [x] **物流接驳站（cargo-landing-pad）**：火箭货物降落枢纽（太空货运的地面端）

> 已落地说明（本迭代增量）：
> - 物品/建筑：`cargo-landing-pad`（物流接驳站，8×8）已接入，堆叠 1 / 占地 8×8（官方 selection_box ±4）/
>   血量 1000 / 内置 80 槽存储（官方 inventory_size）/ 雷达视野 4 格（官方 radar_range），
>   全部数据来自 GAME_DATA（factorio-data 官方，新增 `GAME_DATA.cargoLandingPad` 单源：inventorySize / radarRange），未单独维护数值表。
> - 玩法：作为火箭货物接驳枢纽（官方 base 建筑），火箭发射后，被发射物品的产物（空间科学包）降落于此
>   的 80 槽大容量存储；内置雷达视野周期性扫描扩展探索；可接入电路网络输出箱内货物信号。
>   数据全部来自 GAME_DATA（占地/血量/堆叠/容量/雷达/命名），配方官方 200混凝土+25钢板+10处理器（30s）。
> - 科技：由「火箭技术」科技解锁（与火箭发射井同科技，对齐官方）；数据校验并入 verify-dlc（12 项）。
- [x] **物流扩展舱（cargo-bay，官方 Cargo bay）**：接驳站扩展存储舱（本迭代新增）

> 已落地说明（本迭代增量）：
> - 物品/建筑：`cargo-bay`（物流扩展舱，4×4）已接入，堆叠 10 / 占地 4×4（官方 selection_box ±2）/
>   血量 1000 / 扩展槽位 20（官方 inventory_size_bonus），
>   全部数据来自 GAME_DATA（factorio-data 官方，新增 `GAME_DATA.cargoBay` 单源：inventorySizeBonus），未单独维护数值表。
> - 玩法：官方 Cargo bay 是物流接驳站的扩展存储舱——紧邻接驳站铺设时，为接驳站增加
>   inventory_size_bonus（官方 20）额外存储槽位，扩展火箭货物降落容量；本身亦为 20 格独立存储容器，
>   可接入电路网络输出箱内货物信号。数据全部来自 GAME_DATA（占地/血量/堆叠/扩展槽位/命名）。
> - 配方：官方 20钢板+20低密度结构+5处理器（10s）；由「火箭技术」科技解锁（与接驳站同科技）。
> - 校验：verify-dlc 新增物流扩展舱校验（11 项），全量 18 个校验脚本通过，构建通过。
- [x] **物流卸载舱（landing-pad-unloading-bay，Space Age 官方 Cargo unloading bay）**：接驳站卸载舱（本迭代新增）

> 已落地说明（本迭代增量）：
> - 物品/建筑：`landing-pad-unloading-bay`（物流卸载舱，4×5）已接入，堆叠 10 / 占地 4×5
>   （官方 cargo-bay 原型 selection_box {{-2,-3},{2,2}}）/ 血量 1000 / 扩展槽位 20（官方 inventory_size_bonus）/
>   allow_unloading=true / 卸载距离 59（官方 max-cargo-bay-unloading-distance），
>   全部数据来自 GAME_DATA（factorio-data 官方，新增 `GAME_DATA.cargoUnloadingBay` 单源：
>   inventorySizeBonus / allowUnloading / unloadingDistance），未单独维护数值表。
> - 玩法：官方 Cargo unloading bay 允许从太空平台向接驳站卸载货物，自身亦为物流接驳站的扩展存储舱——
>   紧邻接驳站铺设时为接驳站增加 inventory_size_bonus（官方 20）额外存储槽位；本身亦为 20 格独立存储容器，
>   可接入电路网络输出箱内货物信号。数据全部来自 GAME_DATA（占地/血量/堆叠/扩展槽位/命名/卸载距离）。
> - 配方：官方 1扩展舱+4钢箱+15电引擎+8处理器（10s）；由「火箭技术」科技解锁（与接驳站/扩展舱同科技）。
> - 校验：verify-dlc 新增物流卸载舱校验（13 项），全量 18 个校验脚本通过，构建通过。

### 阶段四.8：Aquilo 聚变发电链（Fusion Power，本迭代新增）
- [x] **聚变反应堆 / 聚变发电机 / 聚变燃料棒**：太空时代终极发电系统

> 已落地说明（本迭代增量）：
> - 物品：`fusion-reactor`（聚变反应堆，堆叠 1）/ `fusion-generator`（聚变发电机，堆叠 5）/
>   `fusion-power-cell`（聚变燃料棒，堆叠 50），堆叠 / 命名 / 占地 / 血量全部来自 GAME_DATA
>   （factorio-data 官方：fusion-reactor 6×6（selection_box ±3）、max_health 1000；
>   fusion-generator 3×5（selection_box ±1.5×±2.5）、max_health 1000），未单独维护数值表。
> - 生成脚本：FOOTPRINT_SOURCES 新增聚变反应堆/发电机官方 selection_box 桥接。
> - 玩法：聚变反应堆（6×6）燃烧聚变燃料棒产生超高温等离子热量（热功率 200MW，终极发电），
>   经导热管传导；聚变发电机（3×5）把相邻导热管传来的热量直接转化为电能，单台满功率 50MW
>   （官方 output_flow_limit=50MW），为太空时代终极发电系统（比核反应堆/供热塔更强）。
> - 配方（官方依赖钨板/量子处理器/钬板/氨=Aquilo 行星专属资源，项目暂无行星系统，适配为基础资源）：
>   聚变燃料棒=5锂板+1超导体+1碳纤维（10s）；聚变反应堆=50超导体+50处理器+30锂板+50钢板（60s）；
>   聚变发电机=30超导体+30处理器+20锂板（30s），配方键保留官方名，数据单源。
> - 科技：新增「聚变能源」科技（fusion-power，需空间平台），解锁聚变发电链；数据校验并入 verify-dlc（新增 24 项）。
- [x] **火箭货物发射（太空货运核心，本迭代增量）**：火箭发射井支持装载货物，随火箭发射降落到物流接驳站

> 已落地说明（本迭代增量）：
> - **火箭货舱**：火箭发射井在阶段②（火箭组装完成）新增「🚀 火箭货舱」，玩家可从背包装入任意
>   货物（自动排除卫星 / 火箭部件原料 / 流体 / 模块 / 创造虚空测试物品），单种货物容量 200。
> - **货物发射**：发射时货舱内物品随火箭一起发射，降落到物流接驳站（cargo-landing-pad）存储
>   （与空间科学包同落地链路）；无接驳站时货物随火箭返回背包。实现「地面→轨道」的物资运输，
>   为行星间货物调度打基础（对齐《异星工厂》：火箭发射可把货物送到轨道/接驳站）。
> - **交互**：面板货舱区显示已装货物（可一键取出），下方背包货物选择网格点击即装入一批；
>   发射后货舱自动清空。货舱随存档持久化（serialize/restore），旧档自动兼容（无货舱字段视为空）。
> - **数据单源**：不新增任何数值表，货舱容量为玩法常量（CARGO_CAP），货物判断复用现有 ITEMS/FLUIDS/isModule。
> - 校验：verify-dlc 新增火箭货舱排除逻辑校验（7 项），全量 18 个校验脚本通过，构建通过。
- [x] **行星间货物调度（Interplanetary cargo dispatch，本迭代新增）**：火箭货舱新增「📮 目标星球」选择器——目标星球与当前星球相同则降落到本星物流接驳站（原逻辑），
   不同则把货物送入该星球轨道队列 `G.orbitalCargo[planet]`，玩家星际旅行抵达该星球后由 `deliverOrbitalCargo` 交付
   （接驳站优先接收，否则入背包），实现行星间物资调度（对齐《异星工厂》：火箭把货物送往目标星球轨道）；
   轨道队列随存档持久化（serialize/restore），火箭面板显示在途轨道货物清单；数据不新增数值表，行星名来自 PLANET_OPTIONS。
   - 数据单源：货物路由复用现有 CARGO_CAP/ITEMS，不新增维护表；校验并入 verify-dlc（新增 6 项）。
- [x] **空间平台遥测（Space platform telemetry，本迭代新增）**：设置面板「星际旅行」区块新增「🛰️ 空间平台遥测（在途货物）」——
  全局展示各星球在途轨道货物（火箭发射送往目标星球的物资清单），让玩家在不离开当前星球时也能查看全部行星空轨物资
  （对齐《异星工厂》空间平台遥测/轨道货物概览）；数据复用现有 `G.orbitalCargo` 轨道队列，未新增数值表。

### 阶段四.8：钷素科研包（Promethium science pack，Space Age 终局科学包，本迭代新增）
- [x] **钷素科研包 + 钷素星块（Promethium science pack / asteroid chunk）**：太空时代终极科学包

> 已落地说明（本迭代增量）：
> - 物品：`promethium-science-pack`（钷素科研包，堆叠 200）/ `promethium-asteroid-chunk`（钷素星块，堆叠 1），
>   堆叠 / 命名全部来自 GAME_DATA（factorio-data 官方 names：钷素科技包（黑瓶）/Promethium science pack、
>   钷素星块/Promethium asteroid chunk），未单独维护数值表。
> - 玩法：钷素星块由小行星收集器在远太空中以较低概率（5%）随机收集到（区别于金属/碳质/氧化星块的
>   常规分布，对齐官方玄金小行星稀有分布）；钷素科研包由电磁工厂（官方 cryogenics 低温工厂，适配）制得。
> - 配方：官方 promethium-science-pack 5s = 25钷素星块+1量子处理器+10五足虫蛋→10；项目暂无量子处理器/
>   五足虫蛋，适配为超导体（代量子处理器）+生物结晶（代五足虫蛋），产出物/耗时（25+1+10→10，5s）对齐官方。
> - 科技：新增「钷素科研」科技（promethium-science，需电磁学+太空材料加工，用钷素科研包推进），
>   解锁钷素科研包配方；作为太空时代终局科学包，与金属/电磁/农业科研包共同构成完整太空科学链。
> - 校验：verify-dlc 新增钷素科研包校验（12 项），全量 18 个校验脚本通过，构建通过。

### 阶段四.9：太空时代科学包可消耗化（本迭代新增）

> 已落地说明（本迭代增量）：
> - **修复**：`metallurgic-science-pack`（冶金科研包）与 `promethium-science-pack`（钷素科研包）
>   此前未加入 `SCIENCE_PACKS` 列表，导致实验室（Lab）无法接受/消耗这两种科学包——
>   `promethium-science`（钷素科研）科技因实验室无法消耗钷素科研包而不可研究。
> - 现把两种科研包加入 `SCIENCE_PACKS`，实验室可正常接受并消耗，补齐太空时代终局科学链
>   （金属/电磁/农业/钷素科研包全部可作为科研消耗）。
> - 顺带清理 `verify-data-integrity.js` 中已废弃的 `passive-power` 测试设备残留引用
>   （该项目自定第 7 个测试设备早已移除，仅保留 6 个创造/虚空物品）。
> - 校验：verify-science-packs 新增冶金/钷素科研包校验（+6 项），全量 18 个校验脚本通过，构建通过。

### 阶段四.10：Fulgora 钬/特斯拉链（Space Age Holmium + Tesla，本迭代新增）
- [x] **钬矿石 / 钬板 / 超级电容 / 特斯拉炮塔 / 特斯拉弹药**：富尔戈拉电磁防御链

> 已落地说明（本迭代增量）：
> - 物品：`holmium-ore`（钬矿石，堆叠 50）/ `holmium-plate`（钬板，堆叠 100）/
>   `supercapacitor`（超级电容，堆叠 100）/ `tesla-turret`（特斯拉炮塔，堆叠 10）/
>   `tesla-ammo`（特斯拉弹药，堆叠 100），堆叠 / 命名全部来自 GAME_DATA（factorio-data 官方：
>   Holmium ore / Holmium plate / Supercapacitor / Tesla turret / Tesla ammo），未单独维护数值表。
> - 生成脚本：GAME_DATA.turret 新增 `tesla-turret`（官方 electric-turret 原型：range 30、cooldown 120tick=2s），
>   FOOTPRINT_SOURCES 新增 tesla-turret（官方 selection_box ±2 → 4×4），buildingHp 单源（官方 max_health 2000）。
> - 配方（官方依赖钬溶液/电解液等 Fulgora 专属流体与 supercapacitor/electrolyte，项目暂无流体行星系统，适配电磁工厂/熔炉基础资源）：
>   `holmium-ore`=石头4+煤2→2（12s）；`holmium-plate`=钬矿石2+石头1+水10→1（10s）；
>   `supercapacitor`=钬板2+超导体2+电路板4+电池1→1（10s）；`tesla-ammo`=超级电容1+塑料1→1（30s）；
>   `tesla-turret`=超级电容10+处理器10+超导体50→1（30s，官方 teslagun+10超电容+10处理器+50超导，省去 teslagun 枪）。
>   配方键保留官方名，数据单源（堆叠/命名/占地/血量/射程/冷却来自 GAME_DATA，配方为手工适配）。
> - 玩法：特斯拉炮塔（4×4）吃电力发射可连锁跳转的电弧（最多 5 跳，伤害随跳递减 0.8），攻击射程内
>   （30 格）多个敌人，无需弹药，官方 electric-turret 行为；接入完整炮塔链路（模块/电路/旋转/信号塔）。
> - 科技：新增「富尔戈拉电磁」科技（fulgora，需电磁科研，用电磁科研包+实用科研包推进），解锁钬/特斯拉链。
> - 校验：verify-dlc 新增 Fulgora 钬/特斯拉链校验（26 项），全量 18 个校验脚本通过，构建通过。

### 阶段四.11：Aquilo 低温学链 + 终局 DLC 内容（本迭代新增）

> 本迭代在前序 DLC 接入基础上，继续补齐太空时代缺失的高价值内容，全部数据来自 data.generated.js（factorio-data 单源）。

#### 1. 低温学链（Aquilo Cryogenics）
- **物品/流体**：`cryogenic-science-pack`（低温科研包，堆叠 200）/ `ammonia`（氨）/ `fluorine`（氟）/
  `fluoroketone-cold`（氟酮冷）/ `fluoroketone-hot`（氟酮热），中英命名来自 GAME_DATA.names（factorio-data 官方 fluid-name），
  未单独维护数值表。
- **设备**：`cryogenic-plant`（低温工厂）：占地 5×5（官方 selection_box）、血量 350、功耗 1500kW、
  制造速度 2、模块槽 8，全部来自 GAME_DATA（deviceStats/footprint/buildingHp/powerUse），复用化工厂流体组装机行为。
- **流体桶（本增量）**：补齐太空时代氟酮桶——`fluoroketone-cold-barrel`（桶装氟酮（冷））/ `fluoroketone-hot-barrel`（桶装氟酮（热）），
  堆叠 10（官方 stack），纳入 `BARREL_FLUIDS` 桶装体系（空桶+50 氟酮→满桶、满桶→空桶+50 氟酮，组装机装配方），
  由「流体处理」科技解锁，补全 DLC 物品清单中最后 2 个官方桶装物品。
- **配方**：氨=水+硫酸（3s）；氟=氨+方解石（2s）；氟酮冷=氟+氨+碳（3s）；氟酮热=氟酮冷（2s）；
  低温科研包=氟酮热+超导体+锂板+钷素星块（6s，官方 cryogenic-science-pack）；低温工厂本体（10s）。
  配方键保留官方名，数据单源，由「低温学」科技解锁。
- **玩法**：补齐太空时代最后一档科研包（靛瓶），与金属/电磁/农业/钷素科研包构成完整终局科学链，
  低温科研包由低温工厂制得，可被实验室消耗推进 Aquilo 终局科技。
- **校验**：verify-dlc 新增低温学链校验（14 项）。

#### 2. 熔融金属（Vulcanus Molten metal）
- **流体**：`molten-iron`（熔融铁）/ `molten-copper`（熔融铜），命名来自 GAME_DATA.names。
- **配方**：熔融铁=铁矿20+方解石5→100（4s，铸造厂）；熔融铜=铜矿20+方解石5→100（4s，铸造厂），
  由铸造厂（foundry）制得（官方 Vulcanus 熔融金属链），由「熔融金属」科技解锁。

#### 3. 废料回收（Fulgora Scrap recycling）
- **物品**：`scrap`（废料，堆叠 50），命名来自 GAME_DATA.names。
- **配方**：`scrap`=铁板+铜板+石头（2s）；`recycle-scrap`=废料→铁/铜矿石/石/煤概率回收（1s，官方 Fulgora scrap 循环），
  由「废料回收」科技解锁。

#### 4. 终局防御（Railgun / Rocket turret）
- **物品**：`quantum-processor`（量子处理器，堆叠 100）/ `railgun`（轨道炮）/ `railgun-ammo`（轨道炮弹，堆叠 10）/
  `railgun-turret`（轨道炮塔，血量 4000）/ `rocket-turret`（火箭炮塔，血量 1500），命名/血量/占地来自 GAME_DATA。
- **配方**：量子处理器=超导体+碳纤维+处理器（20s）；轨道炮=钬板+超导体+量子处理器（30s）；
  轨道炮弹=钬板+超导体（10s）；轨道炮塔=轨道炮+超级电容+量子处理器（30s）；
  火箭炮塔=钢板+火箭弹+处理器（30s）。
- **玩法**：轨道炮塔发射贯穿线伤（5×5，吃电力），火箭炮塔发射火箭弹（3×3，吃电力），
  复用能量炮塔链路（模块/电路/旋转），由「轨道炮防御」科技解锁。

#### 5. 机械装甲 + 高级个人装备（Mech armor / Aquilo equipment）
- **物品/装备**：`mech-armor`（机械装甲）/ `battery-mk3-equipment`（个人电池 III，储电 250000kJ 官方 battery-mk3）/
  `fission-reactor-equipment`（便携裂变反应堆，官方 fission-reactor 4MW）/ `toolbelt-equipment`（工具腰带），
  数值来自 GAME_DATA.equipment（官方 battery-mk3-equipment / fission-reactor-equipment），未单独维护数值表。
- **玩法**：机械装甲为终极护甲（减伤 65%、10×10 最大装备网格），个人电池 III / 便携裂变反应堆为高级装备件，
  装备进网格后提供更强储电与发电（个人电网终极动力），由「机械装甲」科技解锁。

> **校验**：verify-dlc 新增低温/熔融/废料/终局防御/机械装甲校验（共 14+6+6+6+9=41 项），
> 全量 18 个校验脚本通过，`node build.js` 构建通过。 (feat: 接入 Aquilo 低温学链 + 熔融金属/废料回收/终局防御/机械装甲 DLC 内容)


### 阶段四.11：太空时代高级防御（Rocket turret + Railgun turret，本迭代新增）
- [x] **火箭炮塔 / 磁轨炮塔（Rocket turret / Railgun turret）**：太空时代终局高级防御炮塔

> 已落地说明（本迭代增量）：
> - 物品：`rocket-turret`（火箭炮塔，堆叠 10）/ `railgun-turret`（磁轨炮塔，堆叠 10）/
>   `railgun-ammo`（磁轨炮弹，堆叠 10），堆叠 / 命名 / 血量 / 占地 / 射程 / 冷却 / 弹药伤害全部来自
>   GAME_DATA（factorio-data 官方：Rocket turret / Railgun turret / Railgun ammo；
>   rocket-turret 3×3（selection_box ±1.5）、max_health 1500、射程 36、冷却 120tick=2s、最小射程 15；
>   railgun-turret 3×5（selection_box ±1.5×±2.5）、max_health 4000、射程 40、冷却 170tick≈2.833s、最小射程 3.5；
>   railgun-ammo 伤害 amount=10000），未单独维护数值表。
> - 生成脚本：turret 表新增 rocket-turret / railgun-turret（ammo-turret 官方原型 selection_box/attack_parameters 桥接），
>   ammoDamage 新增 railgun-ammo（官方 amount=10000），FOOTPRINT_SOURCES 新增两炮塔官方 selection_box。
> - 玩法：火箭炮塔（3×3）占用弹药，发射火箭弹对命中点造成范围爆炸伤害（火箭弹/爆炸火箭弹伤害与范围递增，
>   复用现有火箭弹体系）；磁轨炮塔（3×5，吃电力，官方 max_health 4000）发射磁轨炮弹沿射向直线穿透命中目标，
>   单发高伤害，为射程最远、火力最强的终局单体防御。两者均接入电路网络（可按信号启停）、可由机械臂自动供弹。
> - 配方（官方依赖量子处理器/氟酮冷却液=Promethium/Aquilo 行星专属资源，此处适配为基础资源）：
>   火箭炮塔=4火箭筒+4处理器+20碳纤维+20钢板+20齿轮（10s）；磁轨炮弹=5钢板+10铜线+2炸药（25s）；
>   磁轨炮塔=50超导体+30钨板+20碳纤维+50处理器（10s，官方数值，由电磁工厂制得），配方键保留官方名，数据单源。
> - 科技：新增「高级防御」科技（advanced-defense，前置电磁学+冶金学，官方 Space Age 高级炮塔科技），
>   解锁火箭炮塔/磁轨炮塔/磁轨炮弹；作为太空时代终局防御科技链。
> - 校验：verify-dlc 新增高级防御校验（25 项），全量 18 个校验脚本通过，构建通过。

### 阶段五：数值/体验精修

- [x] 各 DLC 建筑占地/功耗/速度逐一桥接 data.generated.js
  （已全量桥接：电磁工厂/回收机/生化炉/破碎机/铸造厂/农业塔/大型采矿机/生物实验室/供热塔/聚变反应堆/聚变发电机/
  避雷针/避雷收集器/空间平台中枢/推进器/小行星收集器/冷冻厂等 DLC 建筑的 footprint（selection_box）、
  buildingHp、powerUse、deviceStats（craftingSpeed/moduleSlots）均来自 GAME_DATA，经 DEVICE_STATS_SOURCES +
  FOOTPRINT_SOURCES 官方 selection_box 桥接，未单独维护数值表）
- [x] DLC 科技树接入 data-tech-tree
  （已接入：电磁学/冶金学/回收科技/农业科技/太空材料加工/大型采矿机/供热塔/生物实验室/避雷科技/太空推进/
  空间平台/聚变能源/低温科技/钷素科研/超速物流等 DLC 科技全部注册进 data-tech-tree，含前置关系与触发式科技标记；
  本迭代修正高架铁轨 elevated-rail 的 space-age 科技分类——此前误归 base，现纳入 DLC 太空时代分类，与其它 DLC 科技一致）

- [x] DLC 中英命名接入 names / recipeNames（本增量完成装备+瓦片命名单源：
  LOCALE_SECTIONS 新增 `equipment-name` / `tile-name` 段，装备 13 件（太阳能/电池/聚变/外骨骼/夜视/激光/能量盾/放电/个人机器人接口）
  与瓦片 `stone-path` 的官方中英命名现从 GAME_DATA.names 单源获取，命名总数 229→240；
  新增 verify-dlc 装备命名单源校验 13 项。剩余 17 项为项目自定/2.0 移除物品或官方模板名（桶/铁斧等），无官方 locale 条目）

> 原则：所有新增 DLC 物品/配方/建筑的数据一律从 factorio-data 生成的
> data.generated.js 获取，不再为设备单独维护数值表，保持与官方一致。

### 阶段四.12：Gleba 果仁（Jellynut）生物链 + 异虫卵（本迭代新增）

> 已落地说明（本迭代增量）：
> - 物品：`jellynut`（果冻果）/ `jellynut-seed`（果冻果种子）/ `jelly`（果冻）/ `biter-egg`（异虫卵）已接入，
>   堆叠/中英命名均来自 GAME_DATA（factorio-data 官方：果冻果堆叠 50、种子 10、果冻 100、异虫卵 100），
>   未单独维护数值表（生成脚本从官方 item/plant 原型自动提取）。
> - 配方（官方数值，生化炉/农业塔专属）：
>   - `jellynut-processing`：1 果冻果 → 4 果冻（1s，官方 jellynut-processing）
>   - `jellynut-growing`：1 果冻果种子 → 5 果冻果（农业塔种植，30s，与玉玛果并列 Gleba 双作物）
>   - `biter-egg`：果冻+营养素+果泥 → 5 异虫卵（10s，官方 biter-egg 无合成原料=生物机制繁殖，适配为生化炉用 Gleba 生物链培育）
>   - `nutrients-from-biter-egg`：1 异虫卵 → 20 营养素（2s，官方）
>   - 接入异虫卵后，钷素科研包改为官方配方（25 钷素星块 + 1 量子处理器 + 10 异虫卵，5s，由电磁工厂制得）。
> - 玩法：农业塔支持玉玛果/果冻果双作物选择（按配方动态返还对应种子，自持循环）；果冻果链补全 Gleba
>   农业双作物生态，异虫卵成为高级生物质/钷素科研的官方原料，游戏内容向《异星工厂》太空时代靠齐。
> - 科技：果仁链统一由「农业科技」解锁（与玉玛果链同科技）。
> - 校验：verify-dlc 新增果仁链校验（33 项），全量 18 个校验脚本通过，构建通过。

### 阶段四.13：果冻果土壤（Jellynut soil，Gleba 双作物种植土壤，本迭代新增）

> 已落地说明（本迭代增量）：
> - 物品/地面：`artificial-jellynut-soil`（果冻果人造土）/ `overgrowth-jellynut-soil`（果冻果沃土）已接入，
>   堆叠 100、中英命名（果冻果人造土/Artificial jellynut soil、果冻果沃土/Overgrowth jellynut soil）均来自
>   GAME_DATA（factorio-data 官方），未单独维护数值表（生成脚本从官方 item 原型自动提取）。
> - 玩法：作为可铺设地砖（对齐官方 place_as_tile），铺在草地上形成种植土壤；农业塔种植果冻果时
>   须在果冻果土壤上才能生长（人造土/沃土均可，与玉玛果土壤并列 Gleba 双作物种植体系）。
> - 配方（官方数值，组装机装配方）：
>   - `artificial-jellynut-soil`：1 果冻果种子×2+营养素×50+填海料×5 → 10（2s，官方 artificial-jellynut-soil）
>   - `overgrowth-jellynut-soil`：人工果冻果土壤×2+果冻果种子×5+异虫卵×10+变质物×50+水×100 → 1
>     （10s，官方 overgrowth-jellynut-soil 依赖 biter-egg 生物蛋，项目已有异虫卵，配方直接对齐官方）
> - 渲染：新增 T_JELLYNUT_SOIL/T_OVERGROWTH_JELLYNUT_SOIL 两种地面瓦片（粉褐壤土 + 更肥沃深粉褐壤土），
>   小地图同步配色；农业塔 onSoil() 按种植作物匹配对应土壤（玉玛果→玉玛果土壤、果冻果→果冻果土壤）。
> - 科技：由「农业科技」解锁（与玉玛果土壤/果仁链同科技）；校验并入 verify-dlc（新增 12 项），
>   全量 18 个校验脚本通过，构建通过。

### 阶段四.14：Gleba 金属细菌链（Iron/Copper bacteria，本迭代新增）

> 已落地说明（本迭代增量）：
> - 物品：`iron-bacteria`（铁细菌，堆叠 50）/ `copper-bacteria`（铜细菌，堆叠 50）已接入，
>   堆叠/中英命名（铁细菌/Iron bacteria、铜细菌/Copper bacteria）均来自 GAME_DATA（factorio-data 官方），
>   未单独维护数值表（生成脚本从官方 item 原型自动提取）。
> - 配方（官方 organic 配方，生化炉专属）：
>   - `iron-bacteria`：6 果冻 → 1 铁细菌 + 4 变质物（1s，官方 iron-bacteria）
>   - `copper-bacteria`：3 玉玛果泥 → 1 铜细菌 + 1 变质物（1s，官方 copper-bacteria）
>   - `iron-bacteria-cultivation`：1 铁细菌 + 1 生物流 → 4 铁细菌（4s，官方培养扩增）
>   - `copper-bacteria-cultivation`：1 铜细菌 + 1 生物流 → 4 铜细菌（4s，官方培养扩增）
>   - `iron-plate-from-iron-bacteria`：1 铁细菌 → 1 铁板（2s，项目适配：官方 Gleba 用细菌还原成熔融铁再铸板，此处生化炉一步还原铁板）
>   - `copper-plate-from-copper-bacteria`：1 铜细菌 → 1 铜板（2s，项目适配）
> - 玩法：铁/铜细菌构成 Gleba 无矿地形下的替代金属冶炼链——先用果冻/果泥培育细菌，
>   再用生物流培养扩增，最后在生化炉还原出铁板/铜板，形成可持续金属自持循环，
>   补全 Gleba 生化炉的金属生产用途（此前生化炉仅产生物质产品），游戏内容向《异星工厂》太空时代靠齐。
> - 科技：细菌链统一由「农业科技」解锁（与玉玛果/果仁生物链同科技，均为生化炉生物质产品）。
> - 数据单源：堆叠/命名来自 GAME_DATA（factorio-data 官方），官方有机配方（iron/copper-bacteria 及培养）
>   由 data.generated.js 单源自动生成（设备归属经 DLC_DEVICE_RECIPES 路由生化炉）；仅细菌→板还原配方
>   （iron/copper-plate-from-*-bacteria，官方无此合成）为项目手工适配，生化炉面板自动列出细菌配方。
> - 校验：verify-dlc 新增细菌链校验（34 项），verify-data-integrity 配方键映射补充 4 项动态键，
>   全量 18 个校验脚本通过，构建通过。

### 阶段四.15：Gleba 变质物回收链（Spoilage recycling，本迭代新增）

> 已落地说明（本迭代增量）：
> - 配方（官方 organic 配方，生化炉专属）：
>   - `nutrients-from-spoilage`（变质物制营养素）：10 腐败物 → 1 营养素（2s，官方 nutrients-from-spoilage，
>     官方产出带 50% 腐败度，项目无新鲜度系统故简化为纯营养素）
>   - `burnt-spoilage`（燃烧变质物）：6 腐败物 → 1 碳（12s，官方 burnt-spoilage）
> - 玩法：补全 Gleba 变质物（spoilage）的回收循环——此前变质物只能被生物硫磺/农业科研包/土壤配方消耗，
>   且来源单一（细菌链/作物副产），现新增两个官方出口：
>   - 变质物 → 营养素：让变质物可回收成核心生物质营养素，形成「作物 → 变质物 → 营养素」闭环，
>     缓解果泥/果冻供给波动时营养素断供。
>   - 变质物 → 碳：给变质物一个碳用途出口（官方 Gleba 用变质物焚烧得碳），补全无小行星碳源时
>     生化炉也能自产碳的路径。
> - 科技：统一由「农业科技」解锁（RECIPE_TECH 配方级门控，与其它生化炉生物质配方一致）。
> - 数据单源：配方数值/耗时/配方名均来自 data.generated.js（factorio-data 官方），
>   设备归属经 DLC_DEVICE_RECIPES 路由生化炉，未单独维护数值表。
> - 校验：verify-dlc 新增变质物回收链校验（8 项），verify-data-integrity 配方键映射补充 2 项动态键，
>   全量 18 个校验脚本通过，构建通过。

### 阶段四.16：太空时代堆叠机械臂（Space Age Stack inserter，本迭代新增）

> 已落地说明（本迭代增量）：
> - **物品/设备**：`stack-inserter`（堆叠机械臂，官方 Space Age Stack inserter）已接入，堆叠(=50) /
>   血量(=160) / 命名（堆叠机械臂/Stack inserter）全部来自 GAME_DATA（factorio-data 官方），
>   未单独维护数值表。
> - **机械臂参数单源化**：生成脚本 `inserterStats` 新增 `stack_size_bonus` 与 `bulk=true` 兜底——
>   stack-inserter 抓取堆叠 = 4（官方 `stack_size_bonus=4`）、旋转/伸缩速度 0.04/0.1（官方 rotation_speed/extension_speed）；
>   同时顺带修正集装箱机械臂 `bulk-inserter` 的抓取堆叠单源（官方 `bulk=true` → 3），二者相对倍率均来自官方。
> - **配方**：官方 Space Age 配方 = 1 集装箱机械臂 + 1 处理器 + 2 碳纤维 + 10 果冻 → 1（0.5s），
>   由 GAME_DATA 单源自动生成（组装机装配方），未手工维护数值表。
> - **玩法**：堆叠机械臂为太空时代物流终极机械臂——一次抓取 4 个同种物品并分层叠放传送带（官方
>   `stack_size_bonus=4`、`filter_count=5` 过滤槽），由集装箱机械臂升级而来，复用完整机械臂链路
>   （电路网络/过滤/旋转翻转/信号塔），物流吞吐比集装箱机械臂更高。
> - **科技**：新增「堆叠机械臂」科技（stack-inserter-tech，需物流 III+电磁学，官方前置 logistics3+碳纤维，
>   此处适配为物流 III+电磁学），解锁堆叠机械臂；数据校验并入 verify-dlc（新增 14 项），
>   全量 18 个校验脚本通过，`node build.js` 构建通过。

### 阶段四.17：Gleba 有机生物制品（Bioplastic / Biolubricant，本迭代新增）

> 已落地说明（本迭代增量）：
> - 配方（官方 organic 配方，生化炉专属）：
>   - `bioplastic`（生物塑料）：1 生物流 + 4 玉玛果泥 → 3 塑料（2s，官方 bioplastic，生化炉用生物质制可降解塑料）
>   - `biolubricant`（生物润滑油）：60 果冻 → 20 润滑油（3s，官方 biolubricant，生化炉用果冻榨油制流体润滑油）
> - 玩法：补全 Gleba 生物质产品链——此前生化炉仅产出生物质中间物与科研包，现新增两个官方出口：
>   - 生物塑料：让生物流+果泥可替代石油化工产塑料（官方 Gleba 用生物流制生物塑料），为无石油的 Gleba 行星
>     提供塑料来源（塑料 → 高级电路/低密度结构/超导体等关键下游）。
>   - 生物润滑油：让果冻可产出润滑油流体（官方 Gleba 用果冻制生物润滑油），为无原油的 Gleba 行星
>     提供润滑油来源（润滑油 → 电动引擎/极速带/超速带等关键下游）。
> - 科技：统一由「农业科技」解锁（RECIPE_TECH 配方级门控，与其它生化炉生物质配方一致）。
> - 数据单源：配方数值/耗时/配方名/命名均来自 data.generated.js（factorio-data 官方，
>   命名 生物塑料/Bioplastic、生物润滑油/Biolubricant），设备归属经 DLC_DEVICE_RECIPES 路由生化炉，
>   BIOCHAMBER_RECIPES 注册进生化炉面板，未单独维护数值表。
> - 校验：verify-dlc 新增有机生物制品校验（14 项），verify-data-integrity 配方键映射补充 2 项动态键，
>   全量 18 个校验脚本通过，`node build.js` 构建通过。


### 阶段四.18：虫巢孵化器（Captive biter spawner，本迭代新增）

> 已落地说明（本迭代增量）：
> - **物品**：`captive-biter-spawner`（虫巢孵化器，堆叠 1）/ `capture-robot-rocket`（捕获者火箭弹，堆叠 10）已接入，
>   堆叠 / 命名（虫巢孵化器/Captive biter spawner、捕获者火箭弹/Capture robot rocket）均来自 GAME_DATA（factorio-data 官方），
>   未单独维护数值表。
> - **设备**：`captive-biter-spawner`（虫巢孵化器，5×5）已接入——占地 5×5（官方 selection_box ±2.5）、血量 350、
>   功耗 100kW、制造速度 1（官方 assembling-machine 原型 crafting_speed=1），全部来自 GAME_DATA
>   （deviceStats/footprint/buildingHp/powerUse），未单独维护数值表。
> - **配方**（官方数值，组装机装配方，数据单源化）：
>   - `capture-robot-rocket`：1 飞行机器人骨架 + 2 钢板 + 20 生物流 + 2 处理器 → 1（官方 capture-robot-rocket 配方，用于捕获虫巢）
>   - `captive-biter-spawner`：10 异虫卵 + 1 捕获者火箭弹 + 15 铀-235 + 100 氟酮冷 → 1（官方 captive-biter-spawner 配方 10s）
> - **玩法**：虫巢孵化器为太空时代生物生产建筑——受驯化的虫巢持续繁育异虫卵（官方 spawner 繁育行为），
>   需定期喂养生物流（bioflux）维持圈养（官方「需持续喂养食物，否则逐渐饿死」机制），食物耗尽则饥饿停转；
>   补齐异虫卵→钷素科研的生物链终局循环（虫巢孵化器作为异虫卵的持续生产源，替代生化炉手工培育）。
> - **科技**：新增「虫巢孵化器」科技（captive-biter-spawner，需低温学+电磁科研+铀富集），
>   解锁捕获者火箭弹与虫巢孵化器配方；数据校验并入 verify-dlc（新增 17 项），
>   全量 18 个校验脚本通过，`node build.js` 构建通过。


### 阶段四.19：装载机 Loader（官方 base 物流设备，本迭代新增）

> 已落地说明（本迭代增量）：
> - **物品/设备**：`loader`（基础装载机）/ `fast-loader`（高速）/ `express-loader`（极速）/
>   `turbo-loader`（超速）已接入，堆叠(=50) / 血量(=170) / 占地(1×2，官方 selection_box ±0.5×±1) /
>   速度（loader 1.875 / fast 3.75 / express 5.625 / turbo 7.5 格/s）全部来自 GAME_DATA
>   （factorio-data 官方 loader 原型：speed、max_health、stack_size、selection_box），未单独维护数值表。
> - **生成脚本**：`DEVICE_STATS_SOURCES` / `FOOTPRINT_SOURCES` 新增 4 级 loader 官方桥接
>   （官方 `loader` 原型 speed → beltSpeed、selection_box → footprint）。
> - **配方**（官方 loader 配方，经 GAME_DATA 桥接）：
>   - `loader`：1s = 5机械臂 + 5电路板 + 5齿轮 + 5铁板 + 5传送带 → 1；
>   - `fast-loader`：3s = 5快带 + 1基础装载机 → 1；
>   - `express-loader`：10s = 5极速带 + 1高速装载机 → 1；
>   - `turbo-loader`：20s = 5超速带 + 1极速装载机 → 1。
> - **玩法**：装载机为官方 base 物流设备（官方默认隐藏，web 复刻开放），放置在传送带末端。
>   自动判定装载/卸载模式：
>   - **装载**：后方接传送带、前方接容器/机器 → 从传送带取物自动装入容器；
>   - **卸载**：后方接容器、前方接传送带 → 从容器取物自动卸到传送带。
>   处理速率 = 官方速度（基础 15 件/s，与对应档传送带吞吐一致：快 30 / 极速 45 / 超速 60 件/s）。
> - **科技**：基础/高速装载机需「物流 II」、极速装载机需「物流 III」、超速装载机需「超速物流」科技。
> - **新设备文件**：`js/devices/loader.js`（ENT_CLASSES / DEVICE_RENDER / DEVICE_STATUS / DEVICE_PANEL /
>   DEVICE_DIR_ROTATE 自注册），继承 Entity，复用传送带 grabZone/acceptItem 与容器 giveItem/takeItemOf 接口。
> - **校验**：verify-dlc 新增装载机校验（4 级 × 6 + 配方 4 + 科技 3 = 31 项），
>   全量 18 个校验脚本通过，`node build.js` 构建通过。
>   全量 18 个校验脚本通过，`node build.js` 构建通过。

### 阶段四.20：Factorio 2.0 流体阀门（One-way / Overflow / Top-up valve，本迭代新增）

> 已落地说明（本迭代增量）：
> - **物品/设备**：`one-way-valve`（单向阀）/ `overflow-valve`（溢出阀）/ `top-up-valve`（补给阀）已接入，
>   堆叠(=10) / 血量(=100) / 占地(1×1) / 中英命名（单向阀/One-way valve、溢流阀/Overflow valve、补充阀/Top-up valve）
>   全部来自 GAME_DATA（factorio-data 官方 valve 原型：selection_box ±0.5、max_health 100、fluid_box.volume 100），
>   未单独维护数值表。
> - **生成脚本**：FOOTPRINT_SOURCES 新增三阀官方 valve 原型 selection_box 桥接（→ 1×1）；
>   官方 stack/hp/命名由 data.generated.js 自动提取。
> - **玩法**（对齐《异星工厂》2.0 阀门的 flow_direction / mode / threshold 语义，官方 flow_rate 20）：
>   - 单向阀（one-way）：只允许流体沿箭头方向（背侧→前侧）单向流动，反向截止，防止管道回流。
>   - 溢出阀（overflow）：仅当入口侧流体压力超过阈值（官方 threshold=0.8，即缓冲 80%）时才允许流体
>     外溢到下游，实现「优先自用、满则外溢」的优先供给。
>   - 补给阀（top-up）：仅当出口侧流体压力低于阈值（官方 threshold=0.5）时才从入口侧补给，
>     用于维持储液罐/下游管道液位。
> - **配方**：官方 2.0 阀门由流体处理科技解锁（data 中阀门为隐藏原型无独立配方，此处适配为管道+铁/钢板配方，
>   耗时参考官方），配方键保留官方名；数据单源（占地/血量/堆叠/命名来自 GAME_DATA）。
> - **科技**：三阀统一由「流体处理」科技解锁（与泵/地下管道一致，官方 fluid-handling）。
> - **校验**：verify-dlc 新增流体阀门校验（27 项），全量 18 个校验脚本通过，`node build.js` 构建通过。

### 阶段四.21：基础配方全面对齐官方（本迭代新增）

> 已落地说明（本迭代增量）：
> 依据「所有配方数据与《异星工厂》官方一致」原则，把 data-recipes.js 中 **base 基础配方**
> 与可安全对齐的装备配方逐一修正为官方数值（此前存在旧版/简化配方差异，官方能产出且项目已具备对应材料）：
> - **机械臂族**：`long-handed-inserter` 补 1 铁板；`bulk-inserter` 由「1 处理器」改为官方
>   「1 高速机械臂+15 电路板+15 齿轮+1 高级电路」（保持 0.5s）。
> - **科学包**：`production-science-pack` 产出由 1 改为官方 3。
> - **裂化**：`crack-light`/`crack-gas` 补官方所需 30 水（化工厂支持流体输入，已单源）。
> - **武器/弹药**：`pistol`（5 铜板+5 铁板，5s）、`shotgun-shell`（产出 1）、
>   `atomic-bomb`（100 铀-235）、`destroyer-capsule`（4 骚扰机+4 钢板+1 处理器）、
>   `cliff-explosives`（补 1 空桶+10 方解石）。
> - **载具/炮塔**：`artillery-wagon`/`artillery-turret`/`artillery-shell` 对齐官方钨板链
>   （60/60 钨板+精炼混凝土+齿轮+处理器，炮弹 1 雷达+1 方解石+4 钨板+8 爆炸物）；
>   `spidertron` 对齐官方（4 外骨骼+2 便携聚变堆+1 火箭炮塔+2 雷达+1 鱼）。
> - **模块**：`speed-module-3`(+1 碳化钨)、`productivity-module-3`(+1 异虫卵)、
>   `efficiency-module-3`(+5 变质物)、`quality-module-3`(+1 超导体)。
> - **护甲/装备**：`power-armor-mk2`（100 节能模块+100 速度模块）、`personal-roboport-mk2-equipment`
>   （5 接口+50 处理器+50 超导体）、`battery-mk3-equipment`（5 电池 II+10 超级电容，10s）、
>   `toolbelt-equipment`（3 高级电路+10 碳纤维）。
> - **高架铁轨**：`rail-support`/`rail-ramp` 耗时对齐官方 0.5s。
> - **大型采矿机**：`big-mining-drill` 对齐官方熔融铁+碳化钨链（项目已有铸造厂熔融铁产出）。
> - **回收机**：耗时由 10s 对齐官方 3s。
>
> 以上改动均以 `data.generated.js`（factorio-data 官方）为数据源核对，配方差值由 64 → 38 条，
> 剩余 38 条均为 **Space Age 星球专属材料链**（熔融金属浇铸、钬溶液/电解液、氟酮、氨水、
> 异虫卵培育、小行星加工等），因项目尚未完整模拟行星处理链，按既定设计适配为基础资源，
> 已在 DLC-ROADMAP 各阶段说明。同步更新 `tools/verify-recipes.js` 机械臂族断言。
> 全量 18 个校验脚本通过，`node build.js` 构建通过。

### 阶段四.22：Gleba 五足虫卵（Pentapod egg）高级生物链（本迭代新增）

> 已落地说明（本迭代增量）：
> - **物品**：`pentapod-egg`（五足虫卵，堆叠 20）已接入，堆叠 / 中英命名（五足虫卵/Pentapod egg）均来自
>   GAME_DATA（factorio-data 官方 item 原型 stack_size=20），未单独维护数值表。
> - **配方**（官方 organic 配方，生化炉专属，数据单源化）：
>   - `pentapod-egg`（五足虫卵繁殖）：1 五足虫卵 + 30 营养素 + 60 水 → 2 五足虫卵（15s，官方 pentapod-egg 繁殖配方，
>     生化炉用营养素+水培育繁殖，实现五足虫卵自持循环）
>   - `agricultural-science-pack`（农业科研包）对齐官方配方：1 生物流 + 1 五足虫卵 → 1 农业科研包（4s，
>     此前适配为生物流+腐败物，现对齐官方 bioflux+pentapod-egg 配方）
> - **玩法**：补全 Gleba 高级生物链——五足虫卵为生化炉培育的高级生物资源（官方 Gleba 星球生物），
>   是农业科研包的官方原料（此前用腐败物适配，现还原官方配方）；生化炉可持续繁殖五足虫卵
>   （营养素+水→双倍），形成自持循环，农业科研包由生化炉用生物流+五足虫卵制得。
> - **科技**：统一由「农业科技」解锁（RECIPE_TECH 配方级门控，与其它生化炉生物质配方一致）。
> - **生成脚本**：DLC_DEVICE_RECIPES 新增 `pentapod-egg` → biochamber 官方桥接（官方 organic 繁殖配方），
>   GAME_DATA 单源提取 stackSize/names/recipe/recipeDevice。
> - **校验**：verify-dlc 新增五足虫卵链校验（13 项），verify-data-integrity 配方键映射补充 1 项动态键，
>   全量 18 个校验脚本通过，`node build.js` 构建通过。



### 阶段四.23：树木播种（Tree seeding / Tree seed，本迭代新增）

> 已落地说明（本迭代增量）：
> - **物品**：`tree-seed`（树种子，堆叠 10）已接入，堆叠 / 中英命名（树种子/Tree seed）全部来自
>   GAME_DATA（factorio-data 官方 item 原型 + locale），未单独维护数值表。
> - **配方**：官方 tree-seed 配方 = 2 木材 → 1 树种子（2s，crafting+organic 双类别），由 GAME_DATA
>   单源自动生成（组装机装配方，device=assembling-machine-1），配方数值/耗时与官方完全一致。
> - **玩法**：树种子作为可铺设物品（`SEED_TILE` 地面放置分支），铺在草地上即可种回一棵树（T_TREE），
>   实现绿化/补种——把砍伐获得的木材回收成树种子再种回树木，对齐《异星工厂》Space Age Tree seeding
>   的「收集树种子并在草地上播种」机制；树被砍伐后地面恢复草地，可再补种。渲染复用现有 T_TREE 树木绘制。
> - **科技**：由「农业科技」解锁（RECIPE_TECH 配方级门控，官方 tree-seeding 需农业科研包前置，
>   对齐项目农业科技）；树种子归入「中间产品」制作 Tab（官方 item-group）。
> - **校验**：verify-dlc 新增树木播种校验（9 项），全量 18 个校验脚本通过，`node build.js` 构建通过。

### 阶段四.23：太空时代地形配方设备归属修正（Foundation / Ice platform，本迭代新增）

> 已落地说明（本迭代增量）：
> - **数据对齐修正**：`foundation`（平台基座）/ `ice-platform`（冰面平台）为太空时代低温学流体配方
>   （foundation=4钨板+4锂板+4碳纤维+20石+20氟酮冷、ice-platform=400氨水+50冰，各 30s），
>   官方 crafting category 为 cryogenics，须由**低温工厂（cryogenic-plant）**生产。
>   此前 `DLC_DEVICE_RECIPES` 未收录这两条，生成脚本 fallback 误归为组装机（assembling-machine-1），
>   现于 generate-game-data.js 的低温工厂映射中补全两配方 → cryogenic-plant，并重新生成 data.generated.js。
> - **玩法**：修复后平台基座/冰面平台由低温工厂制得（对齐官方低温学链），与「低温学」科技解锁逻辑一致。
> - **数据单源**：配方数值/耗时/命名仍全部来自 data.generated.js（factorio-data 官方），未单独维护数值表。
> - **校验**：verify-dlc 的「foundation/ice-platform → 低温工厂」断言通过，全量 18 个校验脚本通过，`node build.js` 构建通过。
### 阶段四.24：超速带族配方全面对齐官方（本迭代新增）

> 已落地说明（本迭代增量）：
> 依据「所有物品/配方数据与《异星工厂》官方一致」原则，把此前因「项目尚未实现行星系统」而
> 适配为钢板+塑料的超速带族配方，对齐回官方 **钨板（tungsten-plate）** 配方——
> 项目现已在铸造厂接入了完整钨链（钨矿石→钨板→碳化钨），官方所需材料已可产出，故还原官方配方：
> - `turbo-transport-belt`：`1 极速带 + 5 钨板 + 20 润滑油 → 1`（0.5s，官方）
> - `turbo-underground-belt`：`2 极速地下带 + 40 钨板 + 40 润滑油 → 2`（2s，官方）
> - `turbo-splitter`：`1 极速分流器 + 15 钨板 + 2 处理器 + 80 润滑油 → 1`（2s，官方）
> - **科技前置**：`turbo-logistics`（超速物流）补充 `metallurgy`（冶金学）前置，
>   确保解锁超速物流前已可冶炼钨板（对齐官方超速带需 Vulcanus 钨资源的设定）。
> - 配方/耗时/产出均与 factorio-data 官方核对，数据经 GAME_DATA 单源桥接，未单独维护数值表。
> - 全量 18 个校验脚本通过，`node build.js` 构建通过。

### 阶段四.21：太空时代地面瓦片（Foundation / Ice platform，本迭代新增）

> 已落地说明（本迭代增量）：
> - **物品/地面瓦片**：`foundation`（工程基座/Foundation，堆叠 50）/ `ice-platform`（浮冰平台/Ice platform，堆叠 100）
>   已接入，堆叠 / 中英命名全部来自 GAME_DATA（factorio-data 官方 item 原型 + locale：工程基座/Foundation、
>   浮冰平台/Ice platform），未单独维护数值表。
> - **配方**（官方数值，数据单源化）：
>   - `foundation`：30s = 4 钨板 + 4 锂板 + 4 碳纤维 + 20 石 + 20 氟酮冷 → 1（官方 foundation 配方）
>   - `ice-platform`：30s = 400 氨 + 50 冰 → 1（官方 ice-platform 配方）
> - **玩法**：作为可铺设地砖接入地面铺设 / 蓝图 / 渲染 / 小地图——`foundation` 可铺在水面/熔岩上形成
>   可建造硬地（对齐官方 place_as_tile 允许覆盖水域/熔岩），`ice-platform` 铺在地面形成耐低温冰面平台，
>   二者均为硬化地面（行走加速 40%），为地面铺设体系补全太空时代硬地瓦片。
> - **渲染**：新增 `T_FOUNDATION`（灰白合金板 + 板缝 + 四角铆钉）/ `T_ICE_PLATFORM`（冰蓝亮面 + 冰裂纹 + 高光）
>   两种地面瓦片渲染分支，小地图同步配色；蓝图记录/粘贴含这两种地砖（TILE_IDS 桥接）。
> - **科技**：统一由「低温学」科技解锁（RECIPE_TECH 配方级门控，官方 foundation/ice-platform 属 Aquilo/
>   Vulcanus 星球地形，需低温学（氟酮冷/氨）前置）；归入「物流」制作 Tab（官方 terrain subgroup）。
> - **校验**：verify-dlc 新增地面瓦片校验（17 项），全量 18 个校验脚本通过，`node build.js` 构建通过。

### 阶段四.25：太空时代补充流体链（lithium-brine / ammoniacal-solution / lava / fusion-plasma，本迭代新增）

> 已落地说明（本迭代增量）：
> - **流体补齐**：补全《异星工厂》太空时代缺失的 4 种官方流体——`lithium-brine`（锂盐水/Lithium brine）、
>   `ammoniacal-solution`（氨溶液/Ammoniacal solution）、`lava`（岩浆/Lava）、`fusion-plasma`（等离子体/Plasma），
>   中英命名全部来自 GAME_DATA.names（factorio-data 官方 space-age locale），并已加入 `FLUIDS` / `ITEMS`，
>   支持管道流动与流体配方输入输出。
> - **锂配方对齐官方**：`lithium` 由「硫酸+轻油」适配配方改为官方锂配方——**锂盐水×50 + 氨×50 + 钬板×1 → 锂×5（20s）**
>   （官方 lithium，chemistry/cryogenics，Aquilo 化学链），产出/耗时与官方完全一致，数据单源化。
> - **锂盐水（lithium-brine）**：官方由 Aquilo 海洋抽取（无合成配方），此处适配为基础资源制取
>   （水50+方解石5 → 锂盐水50，5s，化工厂），作为锂冶炼的官方原料。
> - **氨溶液（ammoniacal-solution）**：官方由 Aquilo 海洋抽取，此处适配为氨水吸收
>   （氨50+水50 → 氨溶液100，5s，化工厂）；并接入官方 `ammoniacal-solution-separation` 分离配方
>   （50 氨溶液 → 5 冰 + 50 氨，1s，官方 chemistry/cryogenics），补全氨溶液→冰/氨回收链。
> - **岩浆（lava）**：官方由 Vulcanus 岩浆海抽取（无合成配方），此处适配为铸造厂高温熔岩
>   （石头10+方解石5 → 岩浆500，5s）；并接入官方 `molten-iron-from-lava` / `molten-copper-from-lava`
>   配方（500 岩浆 + 1 方解石 → 250 熔融铁/铜 + 石头，16s，官方 metallurgy），为铸造厂新增
>   「岩浆→熔融金属」官方冶炼路径（与矿石+方解石路径并列）。
> - **等离子体（fusion-plasma）**：官方聚变发电链工作流体（聚变反应堆产、发电机耗），
>   项目聚变系统采用热量传导模型（反应堆→导热管→发电机），故 plasma 仅注册为官方流体并收录官方命名，
>   暂不介入现有聚变热量模型（留待后续聚变流体化迭代）。
> - **数据单源**：4 种流体的命名来自 GAME_DATA.names；`ammoniacal-solution-separation`、`molten-iron-from-lava`、
>   `molten-copper-from-lava` 官方配方由 data.generated.js 单源生成（经 DLC_DEVICE_RECIPES 路由化工厂/铸造厂）；
>   锂盐水/氨溶液/岩浆为项目适配（官方无合成配方=星球抽取），与既有适配模式一致，未单独维护数值表。
> - **校验**：verify-dlc 新增补充流体链校验（22 项），verify-data-integrity 配方键映射补充 3 项动态键，
>   全量 18 个校验脚本通过，`node build.js` 构建通过。


### 阶段四.26：太空时代养鱼 + 鱼制营养素 + 煤合成（本迭代新增）

> 已落地说明（本迭代增量）：
> 依据「所有物品/配方数据与《异星工厂》官方一致」原则，补全官方 Space Age 中项目此前
> 尚未接入的三个可玩配方——三者官方材料项目均已具备，直接对齐官方配方（数据单源化）：
> - **养鱼（`fish-breeding`）**：2 生鱼 + 100 营养素 + 100 水 → 3 生鱼（6s，官方配方），
>   生化炉 organic/chemistry 配方——用少量初始生鱼 + 营养素 + 水可持续扩繁生鱼，
>   与「鱼制营养素」形成「鱼 → 营养素 → 更多鱼」的自持循环。
> - **鱼制营养素（`nutrients-from-fish`）**：1 生鱼 → 20 营养素（2s，官方配方），
>   生化炉 organic 配方——给营养素新增一个生鱼来源（此前仅果泥/变质物/虫蛋）。
> - **煤合成（`coal-synthesis`）**：5 碳 + 1 硫磺 + 10 水 → 1 煤（2s，官方配方），
>   化工厂 chemistry 配方——官方给无煤星球提供煤来源（Space Age），
>   项目已有碳/硫磺（由煤+硫酸制碳），材料可直接合成，补齐无煤环境下的燃料来源。
> - **设备归属**：养鱼/鱼制营养素 → 生化炉（官方 organic，DLC_DEVICE_RECIPES 路由 biochamber）；
>   煤合成 → 化工厂（官方 chemistry，DEVICE_BY_CATEGORY 自动识别）。
> - **科技**：三者统一由「农业科技」解锁（RECIPE_TECH 配方级门控，与其它 Gleba 生物质/化工链一致，
>   对齐官方 fish-breeding / bioflux-processing 科技链）。
> - **数据单源**：配方数值/耗时/配方名/命名均来自 data.generated.js（factorio-data 官方，
>   命名 养鱼/Fish breeding、鲜鱼制营养素/Nutrients from fish、煤合成/Coal synthesis），
>   设备归属经 GAME_DATA.recipeDevice 单源桥接，未单独维护数值表。
> - **校验**：verify-dlc 新增养鱼/鱼制营养素/煤合成校验（14 项），verify-data-integrity
>   配方键映射补充 3 项动态键（产物键≠配方键），全量 18 个校验脚本通过，`node build.js` 构建通过。 (feat: 接入太空时代养鱼/鱼制营养素/煤合成三个官方配方（数据单源化）)

### 阶段四.27：太空时代 Gleba 五足虫敌人（Pentapod，本迭代新增）

> 已落地说明（本迭代增量）：
> 接入《异星工厂》Space Age Gleba 星球专属的大型多足虫兽（官方 spider-unit / segmented-unit 原型），
> 补全终局敌方生态，使敌人构成向 Space Age 靠齐。作为极高进化度（0.75+）的终局威胁出现，
> 是基地防御的终极考验。
> - **敌人类型**（5 种，属性对齐官方原型，血量/射程/冷却均来自 factorio-data）：
>   - `small-stomper`（践踏者）：近战巨兽，血量 3500、占地 3×3（官方碰撞盒 ±1.35）
>   - `medium-strafer`（扫射者）：远程喷酸，射程 28（官方）、冷却 2s、占地 3×3（±1.2）
>   - `medium-stomper`（重践踏者）：血量 8000、占地 4×4（±1.8）
>   - `big-strafer`（巨扫射者）：射程 31（官方）、冷却 2s、占地 4×4（±1.6）
>   - `big-stomper`（巨践踏者）：血量 15000、占地 5×5（±2.4），近战终极巨兽
> - **玩法**：Stomper（践踏者）为近战冲撞巨兽（血量极高、践踏撕咬）；Strafer（扫射者）为远程
>   吐紫色酸性射流（命中留酸液洼地，对齐官方 Spitter acid），射程远超普通吐痰虫，须远距离火力应对。
> - **刷出机制**：接入敌人进化度权重体系，需极高进化度（0.75~0.97）才刷出，随进化度提升更频繁；
>   支持进攻波次（wave）与普通刷出两条途径，与既有 Behemoth 巨兽级构成终局高阶敌人梯度。
> - **渲染**：新增多足虫兽渲染分支（六足摆动 + 高耸甲壳躯干 + 朝玩家眼睛 + 攻击帧口器前扑），
>   Stomper 粗壮短腿 / Strafer 修长多腿昂首喷酸两种体态，数据/体型随 `penta` 与 `foot` 标记区分。
> - **校验**：verify-dlc 新增五足虫敌人校验（13 项：类型注册/官方血量/射程/渲染分支/进化度门控），
>   全量 18 个校验脚本通过，`node build.js` 构建通过。 (feat: 接入太空时代 Gleba 五足虫敌人（Pentapod Stomper/Strafer，数据单源化）)

### 阶段四.28：数据对齐全量核验 + 构建告警清理（本迭代新增）

> 已落地说明（本迭代增量）：
> 依据「所有物品/材料/设备配方 ID 与命名与《异星工厂》官方一致；多出物品移除，仅保留
> 6 个创造/虚空物品；所有数据/参数从 data.generated.js 单源获取」原则，对本项目进行全量
> 数据对齐核验，结论为 **全部达标**：
> - **子模块**：factorio-data 已更新到 2.1.17（最新稳定版，含全部 DLC：Space Age / Quality /
>   Elevated Rails / Recycler）。
> - **ID/命名对齐**：项目全部 321 个基础物品 ID 均为官方原型名（唯一例外 `rocket-body` =
>   发射井内部组装的完整火箭表示，对应官方 rocket-part 组装；`<流体>-barrel` 为官方流体桶命名
>   惯例）。非官方测试物品仅保留 6 个创造/虚空物品（创造/虚空箱、创造/虚空管道、创造/虚空传送带）。
> - **配方对齐**：官方 274 条配方全部接入；项目配方键与官方一致（含 2.0 改名：basic-oil-processing、
>   kovarex-enrichment-process 等）。
> - **建筑对齐**：官方全部 95 个占地建筑 / 35 个设备参数 / 125 个 BUILD_DEFS 全部实现。
> - **数据单源**：占地/功耗/速度/堆叠/血量/配方/命名/设备归属均来自 data.generated.js（factorio-data
>   现场生成），设备与数据表不单独维护第二套数值。
> - **全量回归**：18 个校验脚本全部通过，`node build.js` 构建通过。
> - **构建告警清理**：修复 data-tech.js 中 `foundation`/`ice-platform` 重复键（TECH_REQ 内同名键
>   重复定义，导致 esbuild 重复键告警），删除冗余重复块，构建零告警。
> - **核验脚本**：verify-recipes / verify-dlc / verify-data-integrity / verify-data-alignment 全绿。

### 阶段四.29：太空时代 Gleba 五足虫敌人体系重构（数据单源化，本迭代新增）

> 已落地说明（本迭代增量）：
> 在既有五足虫敌人基础上，把数据改为完全单源化（GAME_DATA.enemy，factorio-data 官方 unit/spider-unit 原型），
> 并补充五足虫卵物品与 Gleba 星球生态：
> - 数据从 GAME_DATA.enemy 单源生成（9 种：wriggler/strafer/stomper × 小中大），血量/速度/射程/冷却/抗性均来自官方。
> - 仅在 Gleba（句芒星）刷出（对齐官方 Gleba 生态），由 pickPentapodType 抽取。
> - 五足虫高抗激光（官方 50~80%），经 enemyResistMult 作用于激光炮塔/个人激光防御。
> - 新增 pentapod-egg（五足虫卵，官方堆叠 20）物品，击杀五足虫有概率掉落（越强掉卵概率越高）+ 变质物。
> - 校验：verify-dlc 新增五足虫数据校验（11 项），全量 18 个校验脚本通过。

### 阶段五：太空时代燃料替代链（Jelly rocket fuel / Ammonia solid fuel，本迭代新增）

> 已落地说明（本迭代增量）：
> - **配方**（官方数值，全部数据单源化，来自 data.generated.js）：
>   - `rocket-fuel-from-jelly`（果冻制火箭燃料）：30 水 + 30 果冻 + 2 生物流 → 1 火箭燃料（10s，官方
>     rocket-fuel-from-jelly 配方，生化炉 organic 配方，Gleba 无油行星的火箭燃料替代来源）
>   - `solid-fuel-from-ammonia`（氨制固体燃料）：15 氨 + 6 原油 → 1 固体燃料（0.5s，官方 solid-fuel-from-ammonia
>     配方，化工厂 chemistry 配方，Aquilo 低温燃料链）
> - **燃料支持**：`pentapod-egg`（五足虫卵）加入 `isBurnerFuel` / `fuelEnergy`（官方 fuel_value 5MJ，
>   弱效生物质燃料，与生鱼相近，可投入锅炉/熔炉/采矿机等燃烧器）。
> - **设备归属**：果冻制火箭燃料 → 生化炉（BIOCHAMBER_RECIPES 注册，官方 organic 配方）；
>   氨制固体燃料 → 化工厂（CHEM_RECIPES 注册，官方 chemistry 配方）。
> - **科技**：果冻制火箭燃料由「农业科技」解锁（RECIPE_TECH 配方级门控）；氨制固体燃料由「低温学」科技解锁。
> - **玩法**：补全太空时代燃料替代链——果冻制火箭燃料让无油星球（Gleba）可自产火箭燃料，
>   氨制固体燃料补全 Aquilo 低温燃料链，为各行星提供多样化的燃料来源。
> - **校验**：verify-dlc 新增果冻制火箭燃料/氨制固体燃料校验（10 项），verify-data-integrity 配方键
>   映射补充 2 项动态键，全量 18 个校验脚本通过，`node build.js` 构建通过。

### 阶段四.26：太空平台地基落地为可铺设瓦片（Space platform foundation，本迭代新增）

> 已落地说明（本迭代增量）：
> - **物品**：`space-platform-foundation`（太空平台地基，堆叠 100）此前仅为数据条目，无铺设行为；
>   本迭代落地为**可铺设地面瓦片**（新增地形类型 `T_SPACE_PLATFORM=14`），对齐官方
>   `space-platform-foundation` 的 place_as_tile 语义——铺成灰色栅格合金地板，形成太空平台地板，行走加速。
> - **配方/命名/堆叠**：全部来自 data.generated.js（factorio-data 官方：官方 space-platform-foundation
>   堆叠 100、命名 太空平台地基/Space platform foundation、配方 20钢板+20铜线→1 耗时 10s），未单独维护数值表。
> - **玩法**：可在地面/地基/混凝土等硬面直接铺设（`PAVE_TILE` 桥接 `placeGround` 分支），
>   完整接入地面铺设 / 蓝图记录与粘贴（TILE_IDS 桥接）/ 渲染（`T_SPACE_PLATFORM` 灰色栅格合金地板渲染分支）/
>   小地图配色（rgba(110,112,120)）/ 行走加速（`isPaved` 硬化面）。由「空间平台」科技解锁（官方 subgroup space-platform）。
> - **校验**：verify-dlc 新增太空平台地基校验（13 项：堆叠/命名/物品/配方数值/科技/瓦片落地/渲染/小地图/蓝图），
>   全量 18 个校验脚本通过，`node build.js` 构建通过。

> **审计结论**：本轮对本项目「数据对齐全量核验」——物品/配方/设备 ID 与命名全部对齐《异星工厂》官方
> （factorio-data 2.1.17），多余物品已移除（仅保留 6 个创造/虚空物品 + 官方卫星 satellite + 内部火箭组装
> 表示 rocket-body），各项数据（占地/功耗/速度/堆叠/配方/命名）均来自 data.generated.js 单源，未单独维护数值表。

### 阶段五.1：太空时代熔融金属铸造链（Foundry Casting，Vulcanus 冶金，本迭代新增）

> 已落地说明（本迭代增量）：
> - **熔炼配方**（官方数值，数据单源化，来自 data.generated.js）：
>   - `iron-ore-melting`（铁矿制熔融铁）：50 铁矿 + 1 方解石 → 500 熔融铁（32s，官方 iron-ore-melting，
>     铸造厂 metallurgy）；替代原简化 `molten-iron` 配方（4s/20矿）为官方精确值。
>   - `copper-ore-melting`（铜矿制熔融铜）：50 铜矿 + 1 方解石 → 500 熔融铜（32s，官方 copper-ore-melting）。
> - **浇铸配方**（官方 casting-* 全链，铸造厂）：
>   - `casting-iron`：20 熔融铁 → 2 铁板（3.2s）
>   - `casting-steel`：30 熔融铁 → 1 钢板（3.2s）
>   - `casting-copper`：20 熔融铜 → 2 铜板（3.2s）
>   - `casting-iron-gear-wheel`：10 熔融铁 → 1 齿轮（1s）
>   - `casting-iron-stick`：20 熔融铁 → 4 铁杆（1s）
>   - `casting-pipe`：10 熔融铁 → 1 管道（1s）
>   - `casting-pipe-to-ground`：50 熔融铁 + 10 管道 → 2 地下管道（1s）
>   - `casting-low-density-structure`：80 熔融铁 + 250 熔融铜 + 5 塑料 → 1 低密度结构（15s）
>   - `casting-copper-cable`：5 熔融铜 → 2 铜线（1s）
>   - `concrete-from-molten-iron`：20 熔融铁 + 100 水 + 5 石砖 → 10 混凝土（10s）
> - **辅助流体配方**（官方 chemistry/cryogenics 双类别）：
>   - `steam-condensation`：1000 蒸汽 → 90 水（1s，化工厂）
>   - `acid-neutralisation`：1 方解石 + 100 硫酸 → 1000 蒸汽（0.5s，化工厂）
> - **设备归属**：全部铸造/熔炼配方注册进 FOUNDRY_RECIPES（铸造厂配方面板可见，官方 metallurgy 类别），
>   steam-condensation/acid-neutralisation 注册进 CHEM_RECIPES（化工厂）。
> - **科技**：全部铸造/熔炼配方由「熔融金属」科技解锁（RECIPE_TECH 配方级门控，需冶金学）；
>   蒸汽冷凝/酸中和由「低温学」科技解锁。
> - **数据单源**：配方数值/配方名（浇铸铁/Iron ore melting 等）均来自 data.generated.js
>   （factorio-data 官方 locale），生成脚本 DLC_DEVICE_RECIPES 补齐铸造/化工厂设备归属。
> - **校验**：verify-dlc 新增铸造链校验（14 项熔炼/浇铸/蒸汽冷凝/酸中和数值 + 设备归属 + 科技门控），
>   verify-data-integrity 配方键动态映射补充 14 项，全量 18 个校验脚本通过，`node build.js` 构建通过。

### 阶段五.2：数据对齐全量核验审计（本迭代新增）

> 依据「所有物品/材料/设备配方 ID 与命名与《异星工厂》官方一致；多出物品移除，仅保留 6 个创造/虚空物品；
> 所有数据/参数从 data.generated.js 单源获取」原则，对本项目进行**第二次全量数据对齐审计**，
> 结论：**全部达标，无需新增改动**（本轮为核对性审计，未改动任何数值表）。
>
> - **子模块**：factorio-data 已更新到 **2.1.17**（含全部 DLC：Space Age / Quality / Elevated Rails / Recycler），
>   与官方最新稳定版一致。
> - **物品 ID / 命名对齐**：官方 `item` 原型 255 项中，除编辑器/调试/参数物品（infinity-chest、electric-energy-interface、
>   parameter-0~9、linked-chest、no-item 等，按官方语义本就不入游戏）外，**全部合法物品已接入**。
>   唯一官方合法物品 `pentapod-egg`（Gleba 五足虫卵，堆叠 20）已在阶段四.22/四.29 接入；
>   `coin`（堆叠 100000）、`copper-wire`（手接电路线，堆叠 1）、`burner-generator`（堆叠 10）等
>   为官方编辑器/特殊用途物品，按「只保留 6 个创造/虚空物品」原则不纳入游戏。
> - **非官方物品**：经全量比对，游戏内 321 个基础物品 ID 全部为官方原型名，**无多余非官方物品**；
>   仅保留 6 个创造/虚空物品（创造/虚空箱、创造/虚空管道、创造/虚空传送带），符合要求。
> - **配方对齐**：官方 647 条配方中，`*-recycling`（回收机运行时动态生成）、`empty-*-barrel`/`fill-*-barrel`
>   （桶装系统动态生成）、`parameter-*`、`recipe-unknown` 等系统配方无需显式收录；其余官方配方
>   全部接入或经映射接入（basic-oil-processing→basic-oil、heavy-oil-cracking→crack-light 等）。
>   适配配方（依赖行星专属资源熔融金属/钬溶液/氟酮/氨等的 Space Age 星球链）均已在 DLC-ROADMAP
>   各阶段说明为项目简化适配，数据单源（产出/耗时参考官方，材料适配基础资源）。
> - **建筑/占地对齐**：官方全部占地建筑经 `GAME_DATA.footprint`（selection_box）桥接，
>   未在 footprint 的实体均为调试/虫巢/隐藏原型（small-worm-turret、hidden-electric-energy-interface、
>   infinity-chest 等），或由 BUILD_DEFS 手工占地（储物箱、载具、小路灯等），无真实缺口。
> - **数据单源**：占地/功耗/速度/堆叠/血量/配方/命名/设备归属均来自 data.generated.js
>   （factorio-data 现场生成），设备与数据表未单独维护第二套数值。
> - **全量回归**：18 个校验脚本全部通过，`node build.js` 构建通过（111 个脚本入口，零告警）。

### 阶段四.22：太空时代手持武器（Railgun 轨道炮 / Tesla gun 特斯拉电枪，本迭代新增）

> 已落地说明（本迭代增量）：
> - **手持武器接入**：`railgun`（轨道炮）与 `teslagun`（特斯拉电枪）由「炮塔组件」升级为**可手持使用的玩家武器**
>   （对齐《异星工厂》Space Age 官方 Railgun / Tesla gun 玩家武器）。
>   - `railgun`：发射磁轨炮弹沿射向直线贯穿射程内（40 格）多个敌人，单发高伤（官方 railgun-ammo 直线穿透 10000 伤害量，
>     适配项目数值）；由「轨道炮防御」科技解锁。
>   - `teslagun`：发射电弧在目标间连锁跳跃（最多 5 目标）并逐跳递减伤害（官方 tesla-ammo 电弧链式递减），
>     由「富尔戈拉电磁」科技解锁。
> - **玩法**：复用既有手持武器系统（快速栏武器槽 / 弹药槽 / 空格·左键开火 / 射击速度无限科技），
>   消耗 `railgun-ammo` / `tesla-ammo` 弹药；快速栏自动识别为武器并支持循环切换。
> - **渲染**：新增 `railgun`（细长亮蓝贯穿光束）与 `tesla`（蓝紫连锁电弧）两种子弹渲染分支（render-entity.js）。
> - **数据单源**：堆叠（railgun 1 / teslagun 5 / 弹药 10 / 100）与官方中英命名（Railgun / Tesla gun）全部来自
>   GAME_DATA（factorio-data 官方），未单独维护数值表。
> - **校验**：verify-dlc 新增手持武器校验（17 项），全量 18 个校验脚本通过，`node build.js` 构建通过。

### 阶段五.3：氨制火箭燃料（Ammonia rocket fuel，Aquilo 低温燃料链，本迭代新增）

> 已落地说明（本迭代增量）：
> - **配方**（官方数值，数据单源化，来自 data.generated.js）：
>   - `ammonia-rocket-fuel`（氨制火箭燃料）：10 固体燃料 + 50 水 + 500 氨 → 1 火箭燃料（10s，官方
>     ammonia-rocket-fuel 配方，chemistry+cryogenics 双类别，化工厂 chemistry 配方，Aquilo 低温燃料链）。
> - **玩法**：补全 Aquilo 低温燃料链——用大量氨制取火箭燃料，为无石油/无果冻的星球（玄冥星等）提供
>   火箭燃料的替代来源，与既有果冻制火箭燃料（Gleba）、原油火箭燃料（Nauvis）构成完整的多行星燃料网络。
> - **设备归属**：氨制火箭燃料 → 化工厂（CHEM_RECIPES 注册，官方 chemistry 配方）。
> - **科技**：由「低温学」科技解锁（RECIPE_TECH 配方级门控，官方 cryogenics 前置，与氨/氟酮/低温科研包同科技）。
> - **校验**：verify-dlc 新增氨制火箭燃料校验（8 项），verify-data-integrity 配方键映射补充 1 项动态键，
>   全量 18 个校验脚本通过，`node build.js` 构建通过。


### 阶段五.4：Gleba 雅玛果加工对齐官方（含种子自持，本迭代新增）

> 已落地说明（本迭代增量）：
> 依据「所有物品/配方数据与《异星工厂》官方一致」原则，将项目 `yumako-mash`（玉玛果泥）配方
> 对齐官方 `yumako-processing`：
> - **配方数据对齐官方**：`1 雅玛果 → 2 玉玛果泥 + 1 玉玛果种子`（1s，官方 yumako-processing），
>   生成脚本 `RECIPE_MAP` 新增 `yumako-mash → yumako-processing` 映射，并从 `KEEP_MANUAL_RECIPES`
>   移除该项目自定条目，使 `GAME_DATA.recipe['yumako-mash']` 由官方单源桥接（配方名显示「玉玛果加工/Yumako processing」）。
> - **自持农业**：此前玉玛果加工不返种子、需依赖种子来源；对齐官方后加工自返种子，配合
>   `yumako-growing`（种子→6 玉玛果）构成「果→泥+种子→再种植」的 Gleba 自持农业循环，
>   与 `jellynut-processing`（官方已返果仁种子）一致。
> - **手工表一致性**：`data-recipes.js` 手工 `yumako-mash` 同步补上种子产出作为兜底，
>   运行时仍以 `GAME_DATA.recipe` 官方单源为准。
> - **守门人**：`verify-dlc` 新增玉玛果加工产出种子/果泥/耗时 1s 三项校验，
>   防止后续改动破坏官方一致性；全量 18 个校验脚本通过，`node build.js` 构建通过。

### 阶段六：后续开发计划（迭代方向）

> 基于本次审计，核心数据对齐与 DLC 内容接入已全部完成。后续迭代方向（按价值排序）：

1. **行星资源差异化落地**：将部分「适配为基础资源」的 Space Age 星球配方还原为官方行星专属
   生产链（如熔融金属浇铸已在铸造厂落地，可继续推进熔融铁→铸件在铸造厂的完整官方配方）。
2. **太空平台完整轨道系统**：空间平台体系（地基/中枢/推进器/小行星收集器）已接入，可继续
   完善轨道平台内部物流（平台内传送带/机械臂网络、平台燃料管理、远程遥测交互）。
3. **品质系统深化**：品质已接入 6 级与品质模块，可继续深化品质对建筑/装备数值加成的逐项
   核验与精修。
4. **数值体验精修**：逐项复核 DLC 设备的模块槽/信号塔加成/污染排放与官方一致性，补齐遗漏。
5. **存档兼容回归**：为新增 DLC 物品/配方补充存档迁移用例，确保旧档读档不报错、新物品可正常落地。

### 阶段六.1：数据对齐守门人（verify-data-integrity 强化，本迭代新增）

> 本迭代对「资源铁律」再加一道自动化守门人，把「所有物品 ID 与官方对齐、仅保留 6 个创造/虚空测试物品」
> 由人工审计升级为 **CI 强制校验**，防止未来新增物品时悄悄引入非官方命名：

- [x] `verify-data-integrity.js` 新增第 6 项校验「**非创造/虚空物品均使用官方原型名**」：
      加载 `factorio-data`（经 `tools/convert-data.js`）得到全部官方原型名集合，逐一核对 `ITEMS` 中
      除 6 个创造/虚空测试物品（创造/虚空箱、创造/虚空管道、创造/虚空带）与显式白名单内部件
      （`rocket-body` 发射井内部组装体、`satellite` 官方卫星 locale 条目）外的所有物品 ID，
      必须命中官方原型名；任何非官方 ID 都判定失败并列出清单。
- [x] 校验结果：当前 ITEMS 327 项中，非创造/虚空物品 **全部** 命中官方原型名（非官方 = 0）。
- [x] 全量 18 个校验脚本通过，构建通过。

### 阶段六.1.1：物品堆叠上限对齐守门人（verify-data-integrity 新增第 7 项校验，本迭代新增）

> 「所有物品的各项信息都要保持和官方一致」的又一道 CI 守门人：堆叠上限（stack_size）是物品最直观的数值，
> 把它也纳入自动校验，防止未来新增/调整物品堆叠时与官方 `factorio-data` 产生偏差：

- [x] `verify-data-integrity.js` 新增第 7 项校验「**物品堆叠上限与官方一致**」：
      从 `factorio-data`（经 `tools/convert-data.js`）提取全部官方 item 类原型（item/ammo/gun/capsule/
      armor/module/tool/rail-planner/载具车厢/遥控器/起始包等 21 类）的 `stack_size`，与项目
      `GAME_DATA.stackSize`（自动桥接，官方优先）+ `STACK_SIZES`（手工兜底）逐项核对，
      任何偏差（创造/虚空等官方无原型者除外）都判定失败并列出项目值 vs 官方值。
- [x] 校验结果：当前项目 296 个有官方原型的物品堆叠 **全部** 与官方一致（偏差 = 0）。
- [x] 全量 18 个校验脚本通过，构建通过。

### 阶段四.30：手动遥控器（Artillery targeting remote / Discharge defense remote，本迭代新增）

> 已落地说明（本迭代增量）：
> - **物品**：`artillery-targeting-remote`（重炮瞄准遥控器，堆叠 1）/ `discharge-defense-remote`（放电防御遥控器，堆叠 1），
>   堆叠 / 中英命名全部来自 GAME_DATA（factorio-data 官方：Artillery targeting remote / Discharge defense remote），
>   未单独维护数值表（生成脚本从官方 item 原型自动提取 stack_size 与 locale 命名）。
> - **授予机制**（对齐官方 spawnable shortcut 遥控器）：官方两款遥控器由科技解锁后经快捷栏「spawn-item」自动授予，
>   非组装配方产出。本项目对齐此机制——研究「军事科技 IV」（military4，官方 artillery 科技）后自动授予
>   重炮瞄准遥控器；研究「装甲电力」（armor-power，官方 discharge-defense-equipment 科技）后自动授予放电防御遥控器。
>   授权逻辑集中在 `grantTechUnlockItems(tech)`（lab.js 研究完成时调用），item→tech 映射单点维护。
> - **玩法**：
>   - **重炮瞄准遥控器**（对齐官方 artillery-remote capsule_action）：手持后点击地图任意位置，
>     自动锁定落点附近（5 格内）最近敌人，否则直接轰击落点；选择最近的炮兵连（artillery-turret）或
>     炮兵车厢（artillery-wagon，需有炮弹）向其发射炮弹，命中造成官方大范围爆炸（ARTILLERY_RADIUS 5 格）。
>     实现手动炮兵瞄准，为炮兵连/炮兵车厢补齐「指定坐标开火」的官方玩法。
>   - **放电防御遥控器**（对齐官方 equipment-remote capsule_action）：手持后点击地图任意位置，
>     远程触发放电防御装备（需先安装放电防御 equipment 且个人电网电力充足），对玩家周围敌人释放连锁电击。
> - **数据单源**：两款遥控器为手持工具（isToolItem 桥接），非可建造/可组装配方物品；
>   堆叠/命名来自 data.generated.js（factorio-data 官方），未单独维护数值表。
> - **校验**：verify-data-integrity 把两款遥控器加入「特殊产出（非合成）」白名单；
>   全量 18 个校验脚本通过，`node build.js` 构建通过。


### 阶段四.31：健康无限科技（Health，Space Age，本迭代新增）

> 已落地说明（本迭代增量）：
> - **科技**：新增「健康」无限科技（`health`，官方 Space Age Health 科技）。每次研究提升主角
>   最大生命值 +50（官方 `character-health-bonus` +50/级），让主角在终局更强耐打。
> - **数据单源**：科技定义在 data-tech-tree.js（与其它无限科技一致，固定成本、等级递增效果），
>   效果函数 `playerMaxHp()` 读取 `techLevel('health')`（对齐官方 health 科技语义）。
> - **玩法**：研究「健康」科技后，主角最大生命值由基础 250 提升为 250+50×等级，受伤回血上限随之
>   提高；每次研究即时刷新 `G.playerHPmax`（lab.js 研究完成时同步）。前置：空间科技 + 农业科技
>   （官方 agricultural-science-pack 前置）+ 实用科技 + 军事科技 IV；成本用空间/农业/实用/军事科学包。
> - **校验**：verify-dlc 新增健康科技校验（7 项），全量 18 个校验脚本通过，`node build.js` 构建通过。

### 阶段六.2：污染排放单源化（Pollution emission single-sourcing，本迭代新增）

> 依据「所有数据/参数从 data.generated.js 单源获取，不单独维护第二套数值」原则，
> 把污染系统各污染源设备的排放系数从设备侧硬编码升级为官方数据单源化：

- **数据单源**：`tools/generate-game-data.js` 新增 `GAME_DATA.pollution`——从 factorio-data 官方
  实体原型 `energy_source.emissions_per_minute.pollution` 现场提取各污染源设备的排放量，
  写入 data.generated.js。官方 `emissions_per_minute` 为每分钟排放量，项目以「/s 简化值」
  接入全局污染模型，直接采用官方数值（石炉 2 / 钢炉 4 / 炼油 6 / 锅炉 30 / 热能采矿机 12 等
  与官方完全一致），未单独维护数值表。
- **覆盖设备**：热能采矿机 12 / 电采矿机 10 / 大型采矿机 40 / 抽油机 10 / 石炉 2 / 钢炉 4 /
  电炉 1 / 锅炉 30 / 炼油厂 6 / 化工厂 4 / 离心机 4（全部官方 emissions_per_minute）。
- **官方无直接 emissions_per_minute 的设备**（核反应堆 / 热能机械臂 / 火车头，官方经其它机制
  建模污染，energy_source 无独立 emissions 字段）：由 `POLLUTION_MANUAL` 兜底（7 / 0.3 / 3），
  在 generate-game-data.js 中与官方项一并写入 GAME_DATA.pollution。
- **前端**：`js/devices/pollution.js` 的 `POLLUTION_SOURCES` 改为读取 `GAME_DATA.pollution`
  （官方优先，兜底数组仅在 GAME_DATA 缺失时生效），设备侧不再硬编码污染数值表。
- **校验**：verify-dlc 新增「污染排放单源化」校验（16 项：11 个官方数值 + 3 个兜底 + 前端单源读取），
  全量 18 个校验脚本通过，`node build.js` 构建通过。

### 阶段六.3：营养素配方键对齐官方 nutrients-from-yumako-mash（本迭代新增）

> 依据「所有配方 ID 与《异星工厂》官方一致」原则，修正生化炉「果泥→营养素」配方的键名与数值：
> - **配方键改名**：`nutrients-from-bioflux` → **`nutrients-from-yumako-mash`**（官方配方名）。
>   原键名 `nutrients-from-bioflux` 实为官方另一条配方（5 生物流 → 40 营养素），
>   被本项目误用于「4 果泥 → 6 营养素」配方，造成命名不一致。
> - **数值对齐**：耗时由 2s 修正为官方 **4s**（官方 energy_required=4）；材料/产出不变
>   （4 玉玛果泥 → 6 营养素，官方 nutrients-from-yumako-mash）。
> - **数据单源**：配方数值/官方中文名（玉玛果泥制营养素 / Nutrients from yumako mash）均来自
>   data.generated.js（factorio-data 官方），未单独维护数值表。
> - **设备归属**：生化炉（BIOCHAMBER_RECIPES 注册，官方 organic 类别）；由「农业科技」解锁。
> - **同步清理**：generate-game-data.js 生化炉设备映射、verify-data-integrity 动态键、
>   verify-dlc 校验全部改为官方键 `nutrients-from-yumako-mash`。
> - **校验**：verify-dlc 新增营养素链校验（配方注册/数值 4s/命名/设备/科技/移除非官方键），
>   全量 18 个校验脚本通过，`node build.js` 构建通过。

### 阶段六.4：炼油/离心机配方数据单源化（本迭代新增）

> 依据「所有配方数据从 data.generated.js（factorio-data 官方）获取，设备不单独维护第二套数值」原则，
> 把此前硬编码在 data-recipes.js 的炼油厂（REFINERY_RECIPES）与离心机（CENTRIFUGE_RECIPES）
> 配方表改为从 GAME_DATA.recipe 单源覆盖，并修正其中与官方不一致的数值。
>
> **改动**：
> - **generate-game-data.js**：配方抽取循环由 `projectRecipes`（组装机 RECIPES）扩展为
>   `RECIPES + REFINERY_RECIPES + CENTRIFUGE_RECIPES` 全集，把 6 条炼油/离心机配方
>   （basic-oil / advanced-oil / coal-liquefaction / simple-coal / uranium-processing /
>   nuclear-fuel-reprocessing）也写入 GAME_DATA.recipe，并按官方 crafting category 路由
>   到 oil-refinery / centrifuge（`recipeDevice`）。
> - **data-recipes.js**：文件末尾把 GAME_DATA.recipe 合并进 RECIPES 时**跳过炼油/离心机键**，
>   避免混入组装机表；并新增独立桥接块，把 GAME_DATA.recipe 数值 `Object.assign` 回
>   `REFINERY_RECIPES` / `CENTRIFUGE_RECIPES`（保留 name 显示名，覆盖 time/inp/out/prob）。
> - **修正数值**（原手工表与官方不一致）：
>   - `simple-coal-liquefaction`：`10煤+25方解石 → 50重油` 修正为官方
>     **`10煤 + 2方解石 + 25硫酸 → 50重油`**（5s）。方解石用量 25→2，并补上硫酸原料。
>   - 其余 5 条（basic/advanced-oil、coal-liquefaction、uranium-processing、
>     nuclear-fuel-reprocessing）原值与官方一致，经单源确认无变化。
> - **校验**：verify-dlc 新增「炼油/离心机配方单源化」校验（9 项：6 条官方数值 + 2 项不混入
>   组装机 RECIPES + 1 项 data-recipes.js 单源读取），全量 18 个校验脚本通过，`node build.js` 构建通过。
> - **数据单源**：炼油/离心机配方数值全部来自 data.generated.js（factorio-data 官方），
>   未单独维护第二套数值表。
