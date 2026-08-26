@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo.
echo === Publication GlamBook ===
echo.
if exist ".git\index.lock" del /f /q ".git\index.lock"
if exist ".git\HEAD.lock" del /f /q ".git\HEAD.lock"
set "MSG="
set /p MSG="Message de commit (Entree = message par defaut) : "
if "%MSG%"=="" set "MSG=Mise a jour GlamBook"
echo.
git add -A
git commit -m "%MSG%"
git push
echo.
echo === Termine. Vercel redeploie dans environ 1 minute. ===
echo.
pause
