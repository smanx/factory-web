# 制作栏 5 Tab 数据归类文档

> 依据 `factorio-data` 子模块（2.1.17，官方全部 DLC）的 `item-groups.lua` 与各物品 `subgroup`
> 字段，通过脚本单源分析（`tools/generate-game-data.js` 落地为 `GAME_DATA.itemGroup`），
> 将制作栏全部物品按官方 `item-group` 归入 5 个 Tab：**物流 / 生产 / 中间产品 / 太空 / 武器**。
>
> 归类完全由子模块数据驱动，非手写映射；仅对官方未归入 5 大 Tab 的物品（流体 / 工具 /
> 创造/虚空测试物品 / 部分信号）做少量人工兜底，见文末「特殊物品兜底」。

## 一、5 大 Tab 总览

| Tab | 官方 group | 手搓物品数 | 说明 |
|-----|-----------|-----------|------|
| 🧱 物流 | `logistics` | 78 | 传送带/机械臂/管道/物流箱/铁路/载具/电力/电路/地形/机器人 |
| 🏭 生产 | `production` | 54 | 采矿/冶炼/制造机器/能源/模块/工具 |
| 🧪 中间产品 | `intermediate-products` | 85 | 原料/板材/部件/科学包/流体桶 |
| 🚀 太空 | `space` | 18 | 太空平台/小行星/太空产物/火箭 |
| 🔫 武器 | `combat` | 64 | 枪械/弹药/手雷/装甲/装备/炮塔/防御 |

> 上述物品数为 `GAME_DATA.itemGroup` 实际归类数（含特殊物品兜底）；其中流体（`fluids`）
> 在制作栏会被过滤（流体只能走管道，需在组装机/化工厂生产），详见「三、归类细则」。

---

## 二、各 Tab 物品明细（子模块数据单源）

### 🧱 物流 `logistics`（68）

- 存储 storage：`iron-chest` `steel-chest` `wooden-chest` `storage-tank`
- 传送带 belt：`transport-belt` `fast-transport-belt` `express-transport-belt` `turbo-transport-belt`
  `underground-belt` `fast-underground-belt` `express-underground-belt` `turbo-underground-belt`
  `splitter` `fast-splitter` `express-splitter` `turbo-splitter`
- 机械臂 inserter：`burner-inserter` `inserter` `long-handed-inserter` `fast-inserter` `bulk-inserter`
- 管道 energy-pipe-distribution：`pipe` `pipe-to-ground` `pump` `small-electric-pole`
  `medium-electric-pole` `big-electric-pole` `substation`
- 铁路 train-transport：`rail` `rail-signal` `rail-chain-signal` `rail-ramp` `rail-support`
  `train-stop` `locomotive` `cargo-wagon` `fluid-wagon` `artillery-wagon`
- 载具 transport：`car` `tank` `spidertron`
- 物流网络 logistic-network：`logistic-robot` `construction-robot` `roboport`
  `passive-provider-chest` `active-provider-chest` `storage-chest` `buffer-chest` `requester-chest`
- 电路网络 circuit-network：`small-lamp` `constant-combinator` `arithmetic-combinator`
  `decider-combinator` `selector-combinator` `display-panel` `programmable-speaker` `power-switch`
- 地形 terrain：`stone-brick` `concrete` `refined-concrete` `hazard-concrete` `refined-hazard-concrete`
  `landfill` `cliff-explosives` `artificial-yumako-soil` `artificial-jellynut-soil`
  `overgrowth-yumako-soil` `overgrowth-jellynut-soil`
- 兜底（官方 other/spawnables → 此处归物流）：`red-wire` `green-wire` `spidertron-remote`

### 🏭 生产 `production`（52）

- 工具 tool：`repair-pack` `deconstruction-planner` `upgrade-planner`
- 能源 energy：`boiler` `steam-engine` `steam-turbine` `solar-panel` `accumulator`
  `heat-pipe` `heat-exchanger` `nuclear-reactor` `fusion-reactor` `fusion-generator` `heating-tower`
- 采矿 extraction-machine：`burner-mining-drill` `electric-mining-drill` `big-mining-drill`
  `pumpjack` `offshore-pump`
- 冶炼 smelting-machine：`stone-furnace` `steel-furnace` `electric-furnace` `foundry` `recycler`
- 生产机器 production-machine：`assembling-machine-1` `assembling-machine-2`
  `assembling-machine-3` `oil-refinery` `chemical-plant` `centrifuge`
  `electromagnetic-plant` `biochamber` `cryogenic-plant` `crusher` `lab` `biolab`
- 农业 agriculture：`agricultural-tower`
- 环保 environmental-protection：`lightning-rod` `lightning-collector`
- 模块 module：`speed-module` `speed-module-2` `speed-module-3` `efficiency-module`
  `efficiency-module-2` `efficiency-module-3` `productivity-module` `productivity-module-2`
  `productivity-module-3` `quality-module` `quality-module-2` `quality-module-3` `beacon`
- 太空相关 space-related：`space-platform-hub`
- 兜底（工具无官方 subgroup → 此处归生产）：`iron-axe` `steel-axe`

### 🧪 中间产品 `intermediate-products`（85）

- 流体配方 fluid-recipes：`lubricant` `sulfuric-acid`
- 原料 raw-resource：`iron-ore` `copper-ore` `coal` `stone` `uranium-ore` `raw-fish` `ice`
- 原料 raw-material：`iron-plate` `copper-plate` `steel-plate` `plastic-bar` `sulfur`
  `solid-fuel` `battery` `explosives` `carbon` `low-density-structure`
- 桶 barrel / 灌装 fill-barrel / 空桶 empty-barrel：`water-barrel` `crude-oil-barrel`
  `heavy-oil-barrel` `light-oil-barrel` `petroleum-gas-barrel` `lubricant-barrel`
  `sulfuric-acid-barrel` `fluoroketone-cold-barrel` `fluoroketone-hot-barrel`
- 中间产物 intermediate-product：`iron-gear-wheel` `iron-stick` `copper-cable`
  `electronic-circuit` `advanced-circuit` `processing-unit` `engine-unit`
  `electric-engine-unit` `flying-robot-frame` `rocket-fuel` `barrel`
- 铀处理 uranium-processing：`uranium-235` `uranium-238` `uranium-fuel-cell`
  `depleted-uranium-fuel-cell` `nuclear-fuel`
- 科学包 science-pack：`automation-science-pack` `logistic-science-pack`
  `military-science-pack` `chemical-science-pack` `production-science-pack`
  `utility-science-pack` `space-science-pack` `metallurgic-science-pack`
  `electromagnetic-science-pack` `agricultural-science-pack` `cryogenic-science-pack`
  `promethium-science-pack`
- 沃鲁卡努斯 vulcanus-processes：`calcite` `tungsten-ore` `tungsten-plate` `tungsten-carbide`
- 富尔戈拉 fulgora-processes：`holmium-ore` `holmium-plate` `holmium-solution`
  `scrap` `superconductor` `supercapacitor` `electrolyte`
- 农业加工 agriculture-processes：`yumako` `yumako-seed` `jellynut` `jellynut-seed`
  `iron-bacteria` `copper-bacteria` `spoilage` `nutrients`
- 农业产物 agriculture-products：`yumako-mash` `jelly` `bioflux` `carbon-fiber` `biter-egg`
- 阿基洛 aquilo-processes：`lithium` `lithium-plate` `fusion-power-cell` `quantum-processor`

### 🚀 太空 `space`（16）

- 太空交互 space-interactors：`rocket-silo` `cargo-landing-pad` `rocket-part`
- 太空平台 space-platform：`space-platform-foundation` `asteroid-collector` `thruster`
  `cargo-bay` `landing-pad-unloading-bay` `crusher`
- 太空火箭 space-rocket：`space-platform-starter-pack`
- 太空环境 space-environment：`carbonic-asteroid-chunk` `metallic-asteroid-chunk`
  `oxide-asteroid-chunk` `promethium-asteroid-chunk`
- 太空材料 space-material：`space-science-pack`（已在中间产物，此处不重复）
- 太空处理 space-processing：`thruster-fuel` `thruster-oxidizer`
- 兜底：`satellite` `rocket-body` → 归太空

### 🔫 武器 `combat`（64）

- 枪械 gun：`pistol` `submachine-gun` `shotgun` `combat-shotgun` `rocket-launcher`
  `flamethrower` `railgun` `teslagun`
- 弹药 ammo：`firearm-magazine` `piercing-rounds-magazine` `uranium-rounds-magazine`
  `shotgun-shell` `piercing-shotgun-shell` `cannon-shell` `explosive-cannon-shell`
  `uranium-cannon-shell` `explosive-uranium-cannon-shell` `rocket` `explosive-rocket`
  `atomic-bomb` `flamethrower-ammo` `railgun-ammo` `tesla-ammo` `artillery-shell`
- 手雷/胶囊 capsule：`grenade` `cluster-grenade` `slowdown-capsule` `poison-capsule`
  `defender-capsule` `distractor-capsule` `destroyer-capsule`
- 装甲 armor：`light-armor` `heavy-armor` `modular-armor` `power-armor` `power-armor-mk2` `mech-armor`
- 个人装备 equipment：`solar-panel-equipment` `fission-reactor-equipment`
  `fusion-reactor-equipment` `battery-equipment` `battery-mk2-equipment` `battery-mk3-equipment`
- 功能装备 utility-equipment：`belt-immunity-equipment` `exoskeleton-equipment`
  `night-vision-equipment` `personal-roboport-equipment` `personal-roboport-mk2-equipment` `toolbelt-equipment`
- 军用装备 military-equipment：`energy-shield-equipment` `energy-shield-mk2-equipment`
  `personal-laser-defense-equipment` `discharge-defense-equipment`
- 防御结构 defensive-structure：`stone-wall` `gate` `land-mine` `radar`
- 炮塔 turret：`gun-turret` `laser-turret` `flamethrower-turret` `rocket-turret`
  `tesla-turret` `railgun-turret` `artillery-turret`

---

## 三、被制作栏过滤的物品（不显示手搓）

以下物品按官方数据有明确 group，但**不可手搓**（流体只能走管道 / 需机器生产），
仍纳入归类体系但制作栏不展示：

- **流体 `fluids`（12）**：`water` `steam` `crude-oil` `heavy-oil` `light-oil`
  `petroleum-gas` `lubricant` `sulfuric-acid` `ammonia` `fluorine`
  `fluoroketone-cold` `fluoroketone-hot` `molten-iron` `molten-copper`
- **tiles（1）**：`stone-path` → 归物流（地形类）

> 流体的相关配方已在 `htmlCraft()` 中按「含流体原料/产物」规则跳过。

---

## 四、特殊物品兜底（人工，仅限官方未归入 5 大 Tab 者）

| 物品 | 子模块 subgroup/group | 兜底 Tab | 理由 |
|------|----------------------|---------|------|
| `satellite` | 无 | 太空 | 火箭发射进太空 |
| `rocket-body` | 无 | 太空 | 发射井完整火箭体 |
| `iron-axe` / `steel-axe` | 无 | 生产 | 采掘工具 |
| `red-wire` / `green-wire` | other/spawnables | 物流 | 电路网络连线 |
| `spidertron-remote` | other/spawnables | 物流 | 蜘蛛机遥控 |
| `creative-chest` / `void-chest` | 无 | 物流 | 创造/虚空储物 |
| `creative-pipe` / `void-pipe` | 无 | 物流 | 创造/虚空管道 |
| `creative-belt` / `void-belt` | 无 | 物流 | 创造/虚空传送带 |
| `stone-path` | tiles/artificial-tiles | 物流 | 地形铺装 |

> 兜底清单在 `generate-game-data.js` 的 `ITEM_GROUP_OVERRIDE` 中定义，随数据单源化一并落地。
