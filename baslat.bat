@echo off
title Bulut 1.0
cd /d "%~dp0"

set "PY="
where py >nul 2>&1
if %errorlevel%==0 set "PY=py -3"
if defined PY goto :python_var
where python >nul 2>&1
if %errorlevel%==0 set "PY=python"
if defined PY goto :python_var
echo.
echo  Python bulunamadi.
echo  https://www.python.org/downloads/ adresinden Python 3 kurun
echo  ve kurulumda "Add python.exe to PATH" kutusunu isaretleyin.
echo.
pause
exit /b 1

:python_var
%PY% -c "import pystray, PIL" >nul 2>&1
if %errorlevel%==0 goto :baslat
echo Ilk kurulum: gerekli paketler yukleniyor (pystray, Pillow)...
%PY% -m pip install --user -r requirements.txt
if not %errorlevel%==0 (
    echo Paketler kurulamadi. Bulut konsol modunda acilacak.
    %PY% bulut.py --console %*
    pause
    exit /b 1
)

:baslat
REM Konsol penceresi olmadan, arka planda calistir (saatin yanindaki simge)
where pyw >nul 2>&1
if %errorlevel%==0 (
    start "" pyw -3 bulut.py %*
    exit /b 0
)
where pythonw >nul 2>&1
if %errorlevel%==0 (
    start "" pythonw bulut.py %*
    exit /b 0
)
%PY% bulut.py %*
