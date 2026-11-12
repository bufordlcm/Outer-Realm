@echo off
rem One-time setup for natural character voices (Kokoro). About 420 MB in total.
rem Put this file next to iq-helper.py (E:\Forge\webui_forge_cu121_torch231\webui) and double-click it.
rem It installs into a "voice" folder beside it and never touches Forge's own files.
title Installing Outer Realm voices
pushd "%~dp0.."
set FORGE_DIR=%CD%
popd
"%FORGE_DIR%\system\python\python.exe" "%~dp0iq-helper.py" --install-voices
echo.
echo When it says "Voices are ready", close the picture helper window and start it again.
pause
