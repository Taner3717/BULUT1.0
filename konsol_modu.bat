@echo off
REM Sorun giderme: Bulut'u tepsi simgesi olmadan, mesajlari gosteren pencerede calistirir.
title Bulut 1.0 (konsol)
cd /d "%~dp0"
where py >nul 2>&1
if %errorlevel%==0 (
    py -3 bulut.py --console %*
) else (
    python bulut.py --console %*
)
pause
