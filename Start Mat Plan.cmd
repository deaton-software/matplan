@echo off
REM Double-click this file to start Mat Plan and open it in your browser.
REM Keep the black window open while you use the app. Close it to stop the server.
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -NoProfile -File "tools\serve.ps1" -Open
pause
