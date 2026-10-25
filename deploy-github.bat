@echo off
setlocal
cd /d "%~dp0"
echo ==========================================================
echo          TrackUp - One-Click GitHub Deployment            
echo ==========================================================
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0deploy-github.ps1"
if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Deployment encountered an issue. See above for details.
    pause
    exit /b %ERRORLEVEL%
)
pause
