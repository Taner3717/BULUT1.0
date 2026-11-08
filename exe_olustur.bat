@echo off
REM Python kurulu olmayan bilgisayarlar icin tek dosyalik Bulut.exe olusturur.
cd /d "%~dp0"
py -3 -m pip install --upgrade pyinstaller || goto :hata
py -3 -m PyInstaller --onefile --name Bulut --add-data "static;static" bulut.py || goto :hata
echo.
echo Hazir: dist\Bulut.exe
pause
exit /b 0
:hata
echo Exe olusturulamadi.
pause
exit /b 1
