#!/bin/bash
# init.sh - LabFlow MCP Studio 启动脚本
# 用于依赖安装、验证和启动项目

# ============================================
# 配置区域 - 根据项目修改以下变量
# ============================================

# 依赖安装命令
INSTALL_CMD="npm install"

# 基础验证命令（TypeScript 类型检查 + Lint）
VERIFY_CMD="npm run typecheck && npm run lint"

# 开发服务器启动命令
START_CMD="npm run dev"

# 是否自动启动（设为 1 直接运行 START_CMD）
RUN_START_COMMAND=0

# ============================================
# 脚本逻辑 - 通常不需要修改
# ============================================

set -e  # 遇到错误立即退出

# 1. 打印当前目录
echo "=========================================="
echo "LabFlow MCP Studio - 初始化脚本"
echo "=========================================="
echo ""
echo "当前目录: $(pwd)"
echo "Node 版本: $(node --version)"
echo "npm 版本: $(npm --version)"
echo ""

# 2. 确认目录正确
if [ ! -f "package.json" ]; then
    echo "❌ 错误: 未找到 package.json，请确认在正确的项目目录中"
    exit 1
fi

# 3. 安装依赖
echo "📦 正在安装依赖..."
echo "-------------------------------------------"
$INSTALL_CMD
echo ""
echo "✅ 依赖安装完成"
echo ""

# 4. 运行验证
echo "🔍 正在运行验证..."
echo "-------------------------------------------"
if $VERIFY_CMD; then
    echo ""
    echo "✅ 验证通过"
else
    echo ""
    echo "❌ 验证失败，请先修复基础问题"
    exit 1
fi
echo ""

# 5. 启动或打印命令
echo "=========================================="
echo "初始化完成!"
echo "=========================================="
echo ""
echo "启动开发服务器:"
echo "  $START_CMD"
echo ""

if [ "$RUN_START_COMMAND" = "1" ]; then
    echo "🚀 自动启动中..."
    $START_CMD
fi
