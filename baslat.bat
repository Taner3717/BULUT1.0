@echo off
title Bulut 1.0
cd /d "%~dp0"
where py >nul 2>&1
if %errorlevel%==0 (
    py -3 bulut.py %*
    goto :son
)
where python >nul 2>&1
if %errorlevel%==0 (
    python bulut.py %*
    goto :son
)
echo.
echo  Python bulunamadi.
echo  https://www.python.org/downloads/ adresinden Python 3 kurun
echo  ve kurulumda "Add python.exe to PATH" kutusunu isaretleyin.
echo.
:son
pause
