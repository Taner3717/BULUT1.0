@echo off
REM Python kurulu olmayan bilgisayarlar icin tek dosyalik Bulut.exe olusturur.
cd /d "%~dp0"
py -3 -m pip install --upgrade pyinstaller -r requirements.txt || goto :hata
py -3 -m PyInstaller --onefile --noconsole --name Bulut --icon bulut.ico --add-data "static;static" --hidden-import pystray._win32 bulut.py || goto :hata
echo.
echo Hazir: dist\Bulut.exe
pause
exit /b 0
:hata
echo Exe olusturulamadi.
pause
exit /b 1
