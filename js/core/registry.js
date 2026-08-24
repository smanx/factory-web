'use strict';

// ===== 设备注册表 =====
// 每个 js/devices/*.js 在文件末尾自注册；core/ui/render/main 只面向这些表编程，
// 不出现任何按设备类型的分支。新增设备 = 新增一个设备文件。
const ENT_CLASSES = {};       // type -> 实体类（放置与读档实例化用）
const DEVICE_RENDER = {};     // type -> fn(ctx, e, gx, gy, dir, alpha) 画布绘制
const DEVICE_STATUS = {};     // type -> fn(e) => 'g'|'y'|'r'|null 状态灯颜色
const DEVICE_PANEL = {};      // type -> { html,live,tip,onAction,onChange } 机器面板
const DEVICE_PLACE = {};      // type -> fn(type,tx,ty,dir,ew,eh) => {ok}|null 放置规则（null=继续默认校验）
const DEVICE_DIR_ROTATE = {}; // type -> true 表示 R 可直接旋转本体朝向（非 rotSwap 类设备）
const DEVICE_FLUID_ICONS = {}; // type -> fn(e) => [{x,y,fluid}] 在“显示详情”时接口流体图标所在世界格，用于鼠标悬停显示流体名称
