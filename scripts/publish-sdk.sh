#!/usr/bin/env bash
set -e

# 获取脚本所在目录及项目根目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

# 1. 执行打包构建
echo "===================================================="
echo "🔨 正在执行 SDK 打包 (vite build && tsc)..."
echo "===================================================="
npm run build

# 2. 调用发布同步逻辑
node "$SCRIPT_DIR/publish-sdk.mjs"

