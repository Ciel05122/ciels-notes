@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo ============================================
echo   我的记录 - 本地服务器
echo   手机和电脑要连同一个 WiFi
echo   手机浏览器打开下面 Network 那个网址
echo   (关掉这个黑窗口 = 关掉服务器)
echo ============================================
echo.
call npm run preview -- --host --port 4173
pause
