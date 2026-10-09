@echo off
setlocal
cd /d "%~dp0"
where npm >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 22 or newer, then reopen this file.
  pause
  exit /b 1
)
if not exist node_modules (
  call npm ci
  if errorlevel 1 (
    pause
    exit /b 1
  )
)
echo Open http://127.0.0.1:4177 after the server starts.
echo Keep this window open while using the app. Press Ctrl+C to stop.
call npm run live
pause
