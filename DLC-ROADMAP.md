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
  空间平台/聚变能源/低温科技/钷素科研/超速物流等 DLC 科技全部注册进 data-tech-tree，含前置关系与触发式科技标记）

- [x] DLC 中英命名接入 names / recipeNames（本增量完成装备+瓦片命名单源：
  LOCALE_SECTIONS 新增 `equipment-name` / `tile-name` 段，装备 13 件（太阳能/电池/聚变/外骨骼/夜视/激光/能量盾/放电/个人机器人接口）
  与瓦片 `stone-path` 的官方中英命名现从 GAME_DATA.names 单源获取，命名总数 229→240；
  新增 verify-dlc 装备命名单源校验 13 项。剩余 17 项为项目自定/2.0 移除物品或官方模板名（桶/铁斧等），无官方 locale 条目）

> 原则：所有新增 DLC 物品/配方/建筑的数据一律从 factorio-data 生成的
> data.generated.js 获取，不再为设备单独维护数值表，保持与官方一致。
