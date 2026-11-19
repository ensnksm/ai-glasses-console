@echo off
chcp 65001 >nul
title AI Glasses 智能眼镜管理平台
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo 未检测到 Node.js。请先从 https://nodejs.org 安装 22.12 或更高版本（LTS），然后重新双击本文件。
  pause
  exit /b 1
)

if not exist "node_modules\vite" (
  echo 第一次运行：正在安装依赖，请稍候...
  call npm ci
  if errorlevel 1 (
    echo 依赖安装失败，请检查网络后重试。
    pause
    exit /b 1
  )
)

echo 正在启动，浏览器会自动打开 http://127.0.0.1:5173/
echo 使用期间请不要关闭此窗口；按 Ctrl+C 可停止。
call npm run dev -- --open
pause
