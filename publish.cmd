@echo off
rem Publishes everything checked in the TEST client: new version for all players.
chcp 65001 >nul
set ELECTRON_RUN_AS_NODE=
cd /d "%~dp0"
node tools\publish.mjs
echo.
pause
