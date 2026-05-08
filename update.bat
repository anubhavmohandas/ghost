@echo off
:: GHOST — pull latest changes from GitHub
:: Usage: double-click this file

title GHOST Updater
cd /d "%~dp0"

echo.
echo  ^<^> GHOST - Updater
echo  ======================================

:: Check git is available
where git >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo  X  git is not installed.
  echo     Download from https://git-scm.com and retry.
  pause
  exit /b 1
)

:: Check this is a git repo
if not exist ".git" (
  echo  X  This folder is not a git repo. Clone from GitHub first:
  echo     git clone https://github.com/anubhavmohandas/GHOST.git
  pause
  exit /b 1
)

echo  Fetching latest from origin/main ...
git fetch origin

:: Compare local and remote HEAD
for /f %%i in ('git rev-parse HEAD') do set LOCAL=%%i
for /f %%i in ('git rev-parse origin/main') do set REMOTE=%%i

if "%LOCAL%"=="%REMOTE%" (
  for /f %%i in ('git rev-parse --short HEAD') do set SHORT=%%i
  echo  OK Already up to date ^(%%SHORT%%^).
) else (
  git pull --ff-only origin main
  echo.
  echo  OK Updated successfully!
  echo.
  echo  Changes pulled:
  git log --oneline %LOCAL%..HEAD
)

echo.
echo  ======================================
echo  Reload the extension after updating:
echo    Chrome  -^> chrome://extensions  -^> click reload next to GHOST
echo    Edge    -^> edge://extensions    -^> click reload next to GHOST
echo  ======================================
echo.
pause
