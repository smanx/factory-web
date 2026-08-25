#!/usr/bin/env bash
# 一键全量回归：顺序执行全部数据/物理参数校验脚本。
# 任一失败即退出非零，作为提交前的执行闭环关口。
# 用法：bash tools/run-verify.sh
set -u
cd "$(dirname "$0")/.."

declare -a scripts=(
  "tools/verify-recipes.js"
  "tools/verify-stack-sizes.js"
  "tools/verify-belt-throughput.js"
  "tools/verify-data-integrity.js"
  "tools/verify-beacon-modules.js"
  "tools/verify-nuclear.js"
  "tools/verify-inserter-lane-priority.js"
)

fail=0
for s in "${scripts[@]}"; do
  echo ""
  echo "==================== $s ===================="
  node "$s"
  if [ $? -ne 0 ]; then
    echo ">>> 失败：$s"
    fail=1
  fi
done

echo ""
if [ $fail -eq 0 ]; then
  echo "✅ 全部校验通过（${#scripts[@]} 个脚本）"
else
  echo "❌ 存在校验失败"
  exit 1
fi
