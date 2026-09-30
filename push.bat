@echo off
chcp 65001 > nul
echo ==============================================
echo 🚀 Отправка ФРОНТЕНДА в GitHub (Push Frontend)
echo ==============================================

set /p msg="Введите описание изменений (Enter = 'Update frontend'): "
if "%msg%"=="" set msg=Update frontend

git add .
git commit -m "%msg%"
git push origin main

pause
