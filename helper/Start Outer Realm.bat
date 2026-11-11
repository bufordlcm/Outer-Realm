@echo off
rem Starts Forge (minimized) and the Ironquill picture helper.
rem This file lives in E:\Forge\webui_forge_cu121_torch231\webui next to iq-helper.py.
rem Safe to run twice: it won't start a second Forge or a second helper.
pushd "%~dp0.."
set FORGE_DIR=%CD%
popd

netstat -ano | findstr /R /C:":7860 .*LISTENING" >nul
if errorlevel 1 (
  start "Forge" /min /D "%FORGE_DIR%" "%FORGE_DIR%\run.bat"
) else (
  echo Forge is already running on port 7860 - not starting a second copy.
)

netstat -ano | findstr /R /C:":7861 .*LISTENING" >nul
if not errorlevel 1 (
  echo.
  echo Port 7861 is already in use. Either the picture helper is already running
  echo in another window, or a second copy of Forge took it.
  echo Check http://localhost:7861/iq/health - if it shows "helper": 2 you're fine.
  echo If it shows "Not Found", restart the PC.
  echo.
  pause
  exit /b
)

title Outer Realm picture helper - keep this window open
"%FORGE_DIR%\system\python\python.exe" "%~dp0iq-helper.py"
pause
