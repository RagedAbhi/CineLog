@echo off
title CineLog Servers
echo Starting CineLog App...
cd /d "%~dp0"
start cmd /k "npm run dev"
echo Waiting for servers to initialize...
timeout /t 5 /nobreak > nul
start http://localhost:3000
