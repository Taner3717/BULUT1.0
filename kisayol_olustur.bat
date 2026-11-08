@echo off
REM Masaustune ve Baslat menusune Bulut simgeli "Bulut" kisayolu olusturur.
REM Bulut klasorunu tasidiysaniz bu dosyayi yeni yerinden bir kez daha calistirin.
cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
  "$dir = (Get-Location).Path;" ^
  "$sh = New-Object -ComObject WScript.Shell;" ^
  "foreach ($yer in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('Programs'))) {" ^
  "  $k = $sh.CreateShortcut((Join-Path $yer 'Bulut.lnk'));" ^
  "  $k.TargetPath = (Join-Path $dir 'baslat.bat');" ^
  "  $k.WorkingDirectory = $dir;" ^
  "  $k.IconLocation = (Join-Path $dir 'bulut.ico') + ',0';" ^
  "  $k.WindowStyle = 7;" ^
  "  $k.Description = 'Bulut - dosya paylasimi';" ^
  "  $k.Save() }"
if %errorlevel%==0 (
    echo Masaustune ve Baslat menusune "Bulut" kisayolu eklendi.
) else (
    echo Kisayol olusturulamadi.
)
pause
