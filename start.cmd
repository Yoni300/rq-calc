@echo off
rem Starts the TEST client: RQ Calc from this source code, with its own profile.
set ELECTRON_RUN_AS_NODE=
cd /d "%~dp0"
if not exist "node_modules\electron\dist\electron.exe" (
  echo Installing Electron, please wait...
  call npm install
)
start "" "node_modules\electron\dist\electron.exe" .
