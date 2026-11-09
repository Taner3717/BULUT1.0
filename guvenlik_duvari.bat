@echo off
REM Bulut icin Windows Guvenlik Duvari izinlerini ekler (yalnizca Ozel aglar).
net session >nul 2>&1
if not %errorlevel%==0 (
    echo Bu dosyaya sag tiklayip "Yonetici olarak calistir" secin.
    pause
    exit /b 1
)
netsh advfirewall firewall delete rule name="Bulut HTTP" >nul 2>&1
netsh advfirewall firewall delete rule name="Bulut Kesif" >nul 2>&1
netsh advfirewall firewall add rule name="Bulut HTTP" dir=in action=allow protocol=TCP localport=8765 profile=private
netsh advfirewall firewall add rule name="Bulut Kesif" dir=in action=allow protocol=UDP localport=8766 profile=private
echo.
echo Tamam. Ag profilinizin "Ozel" oldugundan emin olun:
echo Ayarlar ^> Ag ve Internet ^> Wi-Fi ^> (aginiz) ^> Ag profili turu: Ozel
pause
