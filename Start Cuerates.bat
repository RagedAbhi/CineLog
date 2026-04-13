@echo off
title CineLog App
echo Starting CineLog Frontend (Connecting to Production Backend)...
cd /d "%~dp0"
set NODE_OPTIONS=--max-old-space-size=8192
start cmd /k "npm start"
echo Waiting for frontend to initialize...
timeout /t 5 /nobreak > nul
start http://localhost:3000
