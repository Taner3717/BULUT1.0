"""Bulut icin masaustu entegrasyonu.

- Bildirim alani (tepsi) simgesi: Ac / Gelen dosyalar / Windows ile baslat / Cikis
- Windows bildirimi (toast): tiklaninca Bulut arayuzu acilir
- Windows acilisinda otomatik baslatma (HKCU\\...\\Run)

Tepsi simgesi icin `pystray` ve `Pillow` gerekir (requirements.txt).
Paketler yoksa Bulut konsol modunda calismaya devam eder.
"""

import base64
import os
import subprocess
import sys
import threading
import time
import webbrowser
from pathlib import Path
from xml.sax.saxutils import escape

IS_WINDOWS = os.name == "nt"
RUN_KEY = r"Software\Microsoft\Windows\CurrentVersion\Run"
RUN_VALUE = "Bulut"
CREATE_NO_WINDOW = 0x08000000


# --------------------------------------------------------------------------
# Otomatik baslatma
# --------------------------------------------------------------------------

def startup_command() -> str:
    if getattr(sys, "frozen", False):  # PyInstaller ile olusturulan Bulut.exe
        return f'"{sys.executable}" --background'
    exe = Path(sys.executable)
    pyw = exe.with_name("pythonw.exe")  # konsol penceresi acmayan Python
    if pyw.exists():
        exe = pyw
    script = Path(__file__).resolve().parent / "bulut.py"
    return f'"{exe}" "{script}" --background'


def autostart_enabled() -> bool:
    if not IS_WINDOWS:
        return False
    import winreg
    try:
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as key:
            winreg.QueryValueEx(key, RUN_VALUE)
        return True
    except OSError:
        return False


def set_autostart(enabled: bool):
    if not IS_WINDOWS:
        raise OSError("Otomatik baslatma yalnizca Windows'ta desteklenir")
    import winreg
    with winreg.CreateKey(winreg.HKEY_CURRENT_USER, RUN_KEY) as key:
        if enabled:
            winreg.SetValueEx(key, RUN_VALUE, 0, winreg.REG_SZ, startup_command())
        else:
            try:
                winreg.DeleteValue(key, RUN_VALUE)
            except FileNotFoundError:
                pass


# --------------------------------------------------------------------------
# Windows bildirimi (toast)
# --------------------------------------------------------------------------

_TOAST_PS = r"""
$ErrorActionPreference = 'Stop'
[Windows.UI.Notifications.ToastNotificationManager, Windows.UI.Notifications, ContentType = WindowsRuntime] | Out-Null
[Windows.Data.Xml.Dom.XmlDocument, Windows.Data.Xml.Dom.XmlDocument, ContentType = WindowsRuntime] | Out-Null
$xml = New-Object Windows.Data.Xml.Dom.XmlDocument
$xml.LoadXml($env:BULUT_TOAST_XML)
$toast = New-Object Windows.UI.Notifications.ToastNotification $xml
$appId = '{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\WindowsPowerShell\v1.0\powershell.exe'
[Windows.UI.Notifications.ToastNotificationManager]::CreateToastNotifier($appId).Show($toast)
"""


def windows_toast(title: str, body: str, url: str) -> bool:
    """Tiklaninca `url` adresini acan bir Windows 11 bildirimi gosterir."""
    if not IS_WINDOWS:
        return False
    u = escape(url, {'"': "&quot;"})
    xml = (
        f'<toast activationType="protocol" launch="{u}">'
        f'<visual><binding template="ToastGeneric">'
        f'<text>{escape(title)}</text><text>{escape(body)}</text>'
        f'</binding></visual>'
        f'<actions><action content="Bulut\'u aç" activationType="protocol" arguments="{u}"/></actions>'
        f'<audio src="ms-winsoundevent:Notification.IM"/>'
        f'</toast>'
    )
    encoded = base64.b64encode(_TOAST_PS.encode("utf-16-le")).decode("ascii")
    env = dict(os.environ, BULUT_TOAST_XML=xml)
    try:
        r = subprocess.run(
            ["powershell", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
             "-EncodedCommand", encoded],
            env=env, creationflags=CREATE_NO_WINDOW, timeout=15,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        return r.returncode == 0
    except Exception:
        return False


# --------------------------------------------------------------------------
# Tepsi simgesi
# --------------------------------------------------------------------------

def tray_available() -> bool:
    try:
        import pystray  # noqa: F401
        from PIL import Image  # noqa: F401
        return True
    except Exception:
        return False


def _icon_image(badge: bool):
    from PIL import Image, ImageDraw
    s = 64
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((2, 2, 62, 62), 14, fill=(47, 111, 237, 255))
    w = (255, 255, 255, 255)
    d.ellipse((12, 27, 30, 45), fill=w)
    d.ellipse((22, 15, 46, 39), fill=w)
    d.ellipse((35, 25, 53, 43), fill=w)
    d.rounded_rectangle((13, 33, 52, 47), 7, fill=w)
    if badge:
        d.ellipse((40, 0, 63, 23), fill=(217, 45, 32, 255), outline=(255, 255, 255, 255), width=3)
    return img


class Tray:
    """Bildirim alani simgesi. run() ana is parcaciginda calisir ve Cikis'a kadar bekler."""

    def __init__(self, url, open_folder, pending_count, on_quit, autostart_allowed=True):
        import pystray
        self.pystray = pystray
        self.url = url
        self.open_folder = open_folder
        self.pending_count = pending_count
        self.on_quit = on_quit
        self._badge = None
        self._stop = threading.Event()
        item = pystray.MenuItem
        self.icon = pystray.Icon(
            "Bulut", _icon_image(False), "Bulut",
            pystray.Menu(
                item("Bulut'u aç", self._open, default=True),
                item("Gelen dosyalar klasörü", lambda: self.open_folder()),
                pystray.Menu.SEPARATOR,
                item("Windows ile başlat", self._toggle_autostart,
                     checked=lambda _: autostart_enabled(),
                     visible=IS_WINDOWS and autostart_allowed),
                pystray.Menu.SEPARATOR,
                item("Çıkış", self._quit),
            ),
        )

    def _open(self):
        webbrowser.open(self.url)

    def _toggle_autostart(self):
        try:
            set_autostart(not autostart_enabled())
        except OSError:
            pass

    def _quit(self):
        self._stop.set()
        try:
            self.on_quit()
        finally:
            self.icon.stop()

    def _watch(self):
        while not self._stop.is_set():
            try:
                n = self.pending_count()
                if (n > 0) != self._badge:
                    self._badge = n > 0
                    self.icon.icon = _icon_image(self._badge)
                self.icon.title = f"Bulut - {n} bekleyen istek" if n else "Bulut"
            except Exception:
                pass
            time.sleep(1)

    def notify(self, title, body):
        try:
            self.icon.notify(body, title)
        except Exception:
            pass

    def run(self):
        def setup(icon):
            icon.visible = True
            threading.Thread(target=self._watch, daemon=True).start()
        self.icon.run(setup=setup)
