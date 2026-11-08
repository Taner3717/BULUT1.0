#!/usr/bin/env python3
"""Bulut 1.0 - Windows 11 icin yerel ag dosya paylasimi (AirDrop benzeri).

Ayni Wi-Fi / yerel agdaki Bulut calistiran bilgisayarlari otomatik bulur,
onayli dosya gonderip alir. Telefonlar tarayicidan (QR kod ile) baglanip
bilgisayara dosya gonderebilir ve paylasilan dosyalari indirebilir.

Yalnizca Python standart kutuphanesini kullanir (Python 3.9+).
"""

import argparse
import http.client
import json
import os
import platform
import secrets
import shutil
import socket
import subprocess
import sys
import threading
import time
import urllib.parse
import uuid
import webbrowser
from html import escape as html_escape
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

APP = "bulut"
VERSION = "1.0"
HTTP_PORT = 8765
DISCOVERY_PORT = 8766
ANNOUNCE_EVERY = 3        # saniye
PEER_TIMEOUT = 12         # saniye
OFFER_PENDING_TTL = 120   # onay bekleme suresi (saniye)
OFFER_ACCEPTED_TTL = 3600
CHUNK = 1024 * 256
MAX_FILES_PER_OFFER = 1000
MAX_RECEIVED = 500         # arayuzde tutulan "alinan dosyalar" kaydi

IS_WINDOWS = os.name == "nt"
# Kestirme ile gelen dosyalarda Content-Type -> uzanti
QUICK_EXT = {
    "image/jpeg": ".jpg", "image/jpg": ".jpg", "image/heic": ".heic", "image/heif": ".heif",
    "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp",
    "video/quicktime": ".mov", "video/mp4": ".mp4", "application/pdf": ".pdf",
}
RESERVED_NAMES = {"CON", "PRN", "AUX", "NUL",
                  *(f"COM{i}" for i in range(1, 10)),
                  *(f"LPT{i}" for i in range(1, 10))}


# --------------------------------------------------------------------------
# Yardimcilar
# --------------------------------------------------------------------------

LOG_FILE = None


def log(*args):
    try:
        print(*args, flush=True)  # pythonw ile calisirken konsol yoktur
    except Exception:
        pass
    if LOG_FILE:
        try:
            with open(LOG_FILE, "a", encoding="utf-8") as fh:
                fh.write(time.strftime("%Y-%m-%d %H:%M:%S ") + " ".join(map(str, args)) + "\n")
        except OSError:
            pass


def resource_dir() -> Path:
    # PyInstaller ile paketlendiginde dosyalar _MEIPASS altinda olur
    return Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))


def data_dir() -> Path:
    if os.environ.get("BULUT_DATA_DIR"):
        d = Path(os.environ["BULUT_DATA_DIR"])
    elif IS_WINDOWS:
        base = Path(os.environ.get("LOCALAPPDATA") or Path.home() / "AppData" / "Local")
        d = base / "Bulut"
    else:
        d = Path.home() / ".bulut"
    d.mkdir(parents=True, exist_ok=True)
    return d


def default_download_dir() -> Path:
    return Path.home() / "Downloads" / "Bulut"


def safe_name(name: str) -> str:
    name = str(name).replace("\\", "/").split("/")[-1]
    name = "".join(c for c in name if c not in '<>:"|?*' and ord(c) >= 32)
    name = name.strip().strip(".").strip()
    if not name:
        name = "dosya"
    if name.split(".")[0].upper() in RESERVED_NAMES:
        name = "_" + name
    if len(name) > 180:
        stem, ext = os.path.splitext(name)
        name = stem[: 180 - len(ext)] + ext
    return name


_create_lock = threading.Lock()


def create_unique(folder: Path, name: str):
    """Klasorde cakismayan bir dosya olusturur, (yol, dosya nesnesi) dondurur."""
    folder.mkdir(parents=True, exist_ok=True)
    stem, ext = os.path.splitext(name)
    i = 0
    with _create_lock:
        while True:
            candidate = folder / (name if i == 0 else f"{stem} ({i}){ext}")
            try:
                return candidate, open(candidate, "xb")
            except FileExistsError:
                i += 1


def local_ips():
    ips = []
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("10.255.255.255", 1))  # paket gonderilmez, sadece yonlendirme secilir
        ips.append(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            ip = info[4][0]
            if ip not in ips:
                ips.append(ip)
    except OSError:
        pass
    return [ip for ip in ips if not ip.startswith("127.") and not ip.startswith("169.254.")]


def mdns_url():
    """iPhone'un IP degisse de bulabilecegi adres: http://bilgisayaradi.local:port"""
    name = socket.gethostname().split(".")[0].strip().lower()
    if not name or not all(c.isalnum() or c == "-" for c in name):
        return None
    return f"http://{name}.local:{STATE.port}"


def broadcast_targets():
    targets = {"255.255.255.255"}
    for ip in local_ips():
        parts = ip.split(".")
        if len(parts) == 4:
            targets.add(".".join(parts[:3] + ["255"]))
    return targets


# --------------------------------------------------------------------------
# Uygulama durumu
# --------------------------------------------------------------------------

class State:
    def __init__(self, port: int, name: str = None, folder: str = None):
        self.lock = threading.RLock()
        self.port = port
        self.cfg_path = data_dir() / "config.json"
        self.cfg = self._load_cfg()
        if name:
            self.cfg["name"] = name
        if folder:
            self.cfg["folder"] = folder
        self.cfg.setdefault("id", uuid.uuid4().hex)
        self.cfg.setdefault("name", platform.node() or "Bilgisayar")
        self.cfg.setdefault("folder", str(default_download_dir()))
        self.cfg.setdefault("auto_accept", False)
        self.cfg.setdefault("quick_token", secrets.token_urlsafe(16))
        self.save_cfg()

        self.peers = {}      # id -> peer
        self.offers = {}     # id -> gelen teklif
        self.received = []   # alinan dosyalar
        self.shared = {}     # id -> paylasilan dosya (telefonlar icin)
        self.ui_seen = 0.0   # arayuzun son yoklama zamani
        self.notifier = None  # (baslik, metin) -> masaustu bildirimi
        self.autostart_ok = False
        self.shared_dir = data_dir() / "paylasilan"
        shutil.rmtree(self.shared_dir, ignore_errors=True)
        self.shared_dir.mkdir(parents=True, exist_ok=True)

    def _load_cfg(self):
        try:
            return json.loads(self.cfg_path.read_text(encoding="utf-8"))
        except Exception:
            return {}

    def save_cfg(self):
        try:
            self.cfg_path.write_text(json.dumps(self.cfg, ensure_ascii=False, indent=2), encoding="utf-8")
        except OSError as e:
            log("Ayarlar kaydedilemedi:", e)

    @property
    def id(self):
        return self.cfg["id"]

    @property
    def name(self):
        return self.cfg["name"]

    @property
    def folder(self) -> Path:
        return Path(self.cfg["folder"])

    # --- esler ---
    def upsert_peer(self, pid, name, ip, port, os_name="", manual=False):
        with self.lock:
            p = self.peers.get(pid)
            is_new = p is None
            if is_new:
                p = self.peers[pid] = {"id": pid}
            p.update(name=str(name)[:64], ip=ip, port=int(port), os=str(os_name)[:32],
                     last_seen=time.time())
            if manual:
                p["manual"] = True
            return is_new

    def peer_list(self):
        now = time.time()
        with self.lock:
            for pid in [k for k, v in self.peers.items()
                        if not v.get("manual") and now - v["last_seen"] > PEER_TIMEOUT]:
                del self.peers[pid]
            return sorted(({k: v for k, v in p.items()} for p in self.peers.values()),
                          key=lambda p: p["name"].lower())

    # --- teklifler ---
    def public_offer(self, o):
        return {
            "id": o["id"], "status": o["status"], "sender_name": o["sender_name"],
            "sender_ip": o["sender_ip"], "created": o["created"],
            "files": [{"name": f["name"], "size": f["size"], "done": f["done"]} for f in o["files"]],
            "total": sum(f["size"] for f in o["files"]),
        }

    def quick_received(self, name):
        """Kestirme ile gelenleri 3 sn icinde toplayip tek bildirim gosterir."""
        with self.lock:
            self._quick_batch = getattr(self, "_quick_batch", [])
            self._quick_batch.append(name)
            if len(self._quick_batch) > 1:
                return

        def flush():
            with self.lock:
                names, self._quick_batch = self._quick_batch, []
            body = names[0] if len(names) == 1 else f"{len(names)} dosya"
            self.notify("iPhone'dan alındı", body, force=True)
        t = threading.Timer(3, flush)
        t.daemon = True
        t.start()

    def pending_count(self):
        with self.lock:
            return sum(1 for o in self.offers.values() if o["status"] == "pending")

    def notify(self, title, body, force=False):
        """Arayuz acik degilse masaustu bildirimi gosterir."""
        if self.notifier and (force or time.time() - self.ui_seen > 5):
            threading.Thread(target=self.notifier, args=(title, body), daemon=True).start()

    def add_received(self, item):
        with self.lock:
            self.received.append(item)
            del self.received[:-MAX_RECEIVED]

    def cleanup(self):
        now = time.time()
        with self.lock:
            for oid, o in list(self.offers.items()):
                if o["status"] == "pending" and now - o["created"] > OFFER_PENDING_TTL:
                    o["status"] = "expired"
                if now - o["created"] > OFFER_ACCEPTED_TTL + OFFER_PENDING_TTL:
                    del self.offers[oid]


STATE: State = None  # main() icinde olusturulur


# --------------------------------------------------------------------------
# Kesif (UDP broadcast)
# --------------------------------------------------------------------------

def announce_packet():
    return json.dumps({
        "app": APP, "v": 1, "id": STATE.id, "name": STATE.name,
        "port": STATE.port, "os": platform.system(),
    }).encode("utf-8")


def discovery_listener(sock):
    while True:
        try:
            data, (ip, _) = sock.recvfrom(4096)
            msg = json.loads(data.decode("utf-8"))
            if msg.get("app") != APP or msg.get("id") == STATE.id:
                continue
            is_new = STATE.upsert_peer(msg["id"], msg.get("name", "?"), ip,
                                       msg.get("port", HTTP_PORT), msg.get("os", ""))
            if is_new:
                log(f"Cihaz bulundu: {msg.get('name')} ({ip})")
                try:  # yeni cihaza hemen kendimizi tanitalim
                    sock.sendto(announce_packet(), (ip, DISCOVERY_PORT))
                except OSError:
                    pass
        except Exception:
            time.sleep(0.2)


def discovery_announcer(sock):
    while True:
        pkt = announce_packet()
        for target in broadcast_targets():
            try:
                sock.sendto(pkt, (target, DISCOVERY_PORT))
            except OSError:
                pass
        time.sleep(ANNOUNCE_EVERY)


def maintenance_loop():
    """Suresi dolan teklifleri temizler; kesif calismasa da calisir."""
    while True:
        try:
            STATE.cleanup()
        except Exception as e:
            log("Bakim hatasi:", e)
        time.sleep(5)


def start_discovery():
    sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM, socket.IPPROTO_UDP)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_BROADCAST, 1)
    try:
        sock.bind(("", DISCOVERY_PORT))
    except OSError as e:
        log(f"Uyari: kesif portu {DISCOVERY_PORT} acilamadi ({e}). Cihazlari IP ile ekleyebilirsiniz.")
        return
    threading.Thread(target=discovery_listener, args=(sock,), daemon=True).start()
    threading.Thread(target=discovery_announcer, args=(sock,), daemon=True).start()


# --------------------------------------------------------------------------
# Diger cihaza istek (proxy)
# --------------------------------------------------------------------------

def peer_request(peer, method, path, body=None, headers=None, timeout=10):
    conn = http.client.HTTPConnection(peer["ip"], peer["port"], timeout=timeout)
    conn.request(method, path, body=body, headers=headers or {})
    resp = conn.getresponse()
    data = resp.read()
    conn.close()
    return resp.status, data


# --------------------------------------------------------------------------
# HTTP
# --------------------------------------------------------------------------

DRAIN_LIMIT = 256 * 1024 * 1024  # hata durumunda okunup atilacak en fazla govde


class CountingReader:
    """Istek govdesinden ne kadar okundugunu sayar (hata yanitinda kalani bosaltmak icin)."""

    def __init__(self, f):
        self.f = f
        self.n = 0

    def read(self, size=-1):
        data = self.f.read(size)
        self.n += len(data)
        return data

    def readline(self, size=-1):
        data = self.f.readline(size)
        self.n += len(data)
        return data


class ApiError(Exception):
    def __init__(self, status, message):
        super().__init__(message)
        self.status = status
        self.message = message


class Handler(BaseHTTPRequestHandler):
    server_version = f"Bulut/{VERSION}"

    def log_message(self, fmt, *args):
        pass

    # --- yardimcilar ---
    @property
    def client_ip(self):
        ip = self.client_address[0]
        return ip[7:] if ip.startswith("::ffff:") else ip

    def is_local(self):
        return self.client_ip.startswith("127.") or self.client_ip == "::1"

    def require_local(self):
        """Bu bilgisayarin kendi arayuzune ait islemler.

        DNS rebinding ve CSRF'e karsi: Host basligi localhost olmali ve
        POST isteklerinde ozel X-Bulut basligi bulunmali (baska sitelerin
        sayfalari bu basligi on-kontrol olmadan gonderemez).
        """
        host = (self.headers.get("Host") or "").rsplit(":", 1)[0].strip("[]").lower()
        if not self.is_local() or host not in ("localhost", "127.0.0.1", "::1"):
            raise ApiError(403, "Bu islem sadece bu bilgisayardan yapilabilir")
        if self.command == "POST" and self.headers.get("X-Bulut") != "1":
            raise ApiError(403, "Gecersiz istek")

    def send_json(self, obj, status=200):
        body = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self, limit=1024 * 1024):
        length = int(self.headers.get("Content-Length") or 0)
        if length > limit:
            raise ApiError(413, "Istek cok buyuk")
        try:
            return json.loads(self.rfile.read(length).decode("utf-8") or "{}")
        except ValueError:
            raise ApiError(400, "Gecersiz JSON")

    def content_length(self):
        try:
            n = int(self.headers.get("Content-Length"))
        except (TypeError, ValueError):
            raise ApiError(411, "Content-Length gerekli")
        if n < 0:
            raise ApiError(400, "Gecersiz uzunluk")
        return n

    def iter_body(self):
        """Istek govdesini parca parca verir (Content-Length veya chunked)."""
        if "chunked" in (self.headers.get("Transfer-Encoding") or "").lower():
            while True:
                line = self.rfile.readline(1024)
                try:
                    size = int(line.split(b";")[0].strip(), 16)
                except ValueError:
                    raise ApiError(400, "Gecersiz chunked govde")
                if size == 0:
                    while self.rfile.readline(1024) not in (b"\r\n", b"\n", b""):
                        pass
                    return
                remaining = size
                while remaining > 0:
                    chunk = self.rfile.read(min(CHUNK, remaining))
                    if not chunk:
                        raise ApiError(400, "Baglanti kesildi")
                    yield chunk
                    remaining -= len(chunk)
                self.rfile.readline(1024)
        else:
            remaining = self.content_length()
            while remaining > 0:
                chunk = self.rfile.read(min(CHUNK, remaining))
                if not chunk:
                    raise ApiError(400, "Baglanti kesildi")
                yield chunk
                remaining -= len(chunk)

    def stream_body_to(self, fh, length):
        remaining = length
        while remaining > 0:
            chunk = self.rfile.read(min(CHUNK, remaining))
            if not chunk:
                raise ApiError(400, "Baglanti kesildi")
            fh.write(chunk)
            remaining -= len(chunk)

    def route(self):
        u = urllib.parse.urlsplit(self.path)
        return u.path, dict(urllib.parse.parse_qsl(u.query))

    def handle_api(self, fn):
        self.rfile = CountingReader(self.rfile)
        try:
            fn()
        except ApiError as e:
            self.close_connection = True
            self.drain_body()
            try:
                self.send_json({"error": e.message}, e.status)
            except OSError:
                pass
        except (ConnectionError, socket.timeout, OSError) as e:
            self.close_connection = True
            try:
                self.drain_body()
                self.send_json({"error": f"Baglanti hatasi: {e}"}, 502)
            except Exception:
                pass

    def drain_body(self):
        """Hata yanitindan once okunmamis govdeyi okuyup atar.

        Boylece gonderen taraf 'baglanti koptu' yerine gercek hata mesajini gorur.
        Cok buyuk govdelerde baglanti kapatilir.
        """
        try:
            total = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            return
        left = total - self.rfile.n
        if left <= 0 or left > DRAIN_LIMIT:
            return
        try:
            while left > 0:
                chunk = self.rfile.read(min(CHUNK, left))
                if not chunk:
                    break
                left -= len(chunk)
        except OSError:
            pass

    # --- GET ---
    def do_GET(self):
        self.handle_api(self._get)

    def _get(self):
        path, q = self.route()
        if path in ("/", "/index.html"):
            return self.serve_static("index.html", "text/html; charset=utf-8")
        if path == "/qrcode.js":
            return self.serve_static("qrcode.js", "application/javascript; charset=utf-8")
        if path == "/api/info":
            return self.send_json({"app": APP, "version": VERSION, "id": STATE.id,
                                   "name": STATE.name, "port": STATE.port, "os": platform.system()})
        if path == "/api/whoami":
            return self.send_json({
                "local": self.is_local(), "name": STATE.name, "id": STATE.id,
                "version": VERSION,
                "urls": [f"http://{ip}:{STATE.port}" for ip in local_ips()],
                "auto_accept": STATE.cfg["auto_accept"] if self.is_local() else None,
                "folder": str(STATE.folder) if self.is_local() else None,
                "can_pick_folder": IS_WINDOWS if self.is_local() else None,
                "autostart": autostart_state() if self.is_local() else None,
                "quick_path": f"/kestirme?t={STATE.cfg['quick_token']}" if self.is_local() else None,
                "mdns_url": mdns_url() if self.is_local() else None,
            })
        if path.startswith("/api/offer/"):
            oid = path.rsplit("/", 1)[1]
            with STATE.lock:
                o = STATE.offers.get(oid)
                if not o:
                    raise ApiError(404, "Teklif bulunamadi")
                return self.send_json(STATE.public_offer(o))
        if path == "/api/shared":
            with STATE.lock:
                items = [{"id": k, "name": v["name"], "size": v["size"]} for k, v in STATE.shared.items()]
            return self.send_json({"items": items})
        if path == "/kestirme":
            return self.serve_shortcut_setup(q)
        if path.startswith("/dl/"):
            return self.serve_shared(path[4:])

        # --- yalnizca yerel ---
        if path == "/api/peers":
            self.require_local()
            return self.send_json({"peers": STATE.peer_list()})
        if path == "/api/offers":
            self.require_local()
            STATE.ui_seen = time.time()
            with STATE.lock:
                return self.send_json({"offers": [STATE.public_offer(o) for o in STATE.offers.values()
                                                  if o["status"] in ("pending", "accepted")]})
        if path == "/api/received":
            self.require_local()
            with STATE.lock:
                return self.send_json({"items": list(reversed(STATE.received[-200:]))})
        if path == "/api/send/status":
            self.require_local()
            peer = self.find_peer(q.get("peer"))
            status, data = peer_request(peer, "GET", f"/api/offer/{urllib.parse.quote(q.get('offer', ''))}")
            return self.relay(status, data)
        raise ApiError(404, "Bulunamadi")

    def serve_static(self, name, ctype):
        p = resource_dir() / "static" / name
        body = p.read_bytes()
        self.send_response(200)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def serve_shared(self, sid):
        with STATE.lock:
            item = STATE.shared.get(sid)
        if not item or not Path(item["path"]).exists():
            raise ApiError(404, "Dosya bulunamadi")
        size = os.path.getsize(item["path"])
        quoted = urllib.parse.quote(item["name"])
        ascii_name = item["name"].encode("ascii", "replace").decode().replace('"', "_")
        self.send_response(200)
        self.send_header("Content-Type", "application/octet-stream")
        self.send_header("Content-Length", str(size))
        self.send_header("Content-Disposition",
                         f"attachment; filename=\"{ascii_name}\"; filename*=UTF-8''{quoted}")
        self.end_headers()
        with open(item["path"], "rb") as fh:
            shutil.copyfileobj(fh, self.wfile, CHUNK)

    def relay(self, status, data):
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def find_peer(self, pid):
        with STATE.lock:
            peer = STATE.peers.get(pid or "")
            if not peer:
                raise ApiError(404, "Cihaz bulunamadi (kapanmis olabilir)")
            return dict(peer)

    # --- POST ---
    def do_POST(self):
        self.handle_api(self._post)

    def _post(self):
        path, q = self.route()

        # Herkese acik: teklif olustur ve dosya yukle
        if path == "/api/offer":
            return self.create_offer()
        if path == "/api/upload":
            return self.receive_upload(q)
        if path == "/api/quick":
            return self.quick_upload(q)

        # Yalnizca bu bilgisayardan
        self.require_local()
        if path.startswith("/api/offers/"):
            parts = path.split("/")
            if len(parts) == 5 and parts[4] in ("accept", "decline"):
                return self.decide_offer(parts[3], parts[4] == "accept")
        if path == "/api/config":
            data = self.read_json()
            with STATE.lock:
                if "name" in data:
                    name = str(data["name"]).strip()[:64]
                    if name:
                        STATE.cfg["name"] = name
                if "auto_accept" in data:
                    STATE.cfg["auto_accept"] = bool(data["auto_accept"])
                if "folder" in data and str(data["folder"]).strip():
                    STATE.cfg["folder"] = str(check_folder(data["folder"]))
                STATE.save_cfg()
            if "autostart" in data:
                if not STATE.autostart_ok:
                    raise ApiError(400, "Otomatik baslatma bu kurulumda desteklenmiyor")
                import bulut_windows
                try:
                    bulut_windows.set_autostart(bool(data["autostart"]))
                except OSError as e:
                    raise ApiError(500, f"Ayar degistirilemedi: {e}")
            return self.send_json({"ok": True, "folder": str(STATE.folder)})
        if path == "/api/pick-folder":
            if not IS_WINDOWS:
                raise ApiError(400, "Klasor secme penceresi yalnizca Windows'ta var; yolu elle yazin")
            import bulut_windows
            try:
                chosen = bulut_windows.pick_folder(str(STATE.folder))
            except Exception as e:
                raise ApiError(500, f"Klasor penceresi acilamadi: {e}")
            if not chosen:
                return self.send_json({"ok": False, "folder": str(STATE.folder)})
            folder = check_folder(chosen)
            with STATE.lock:
                STATE.cfg["folder"] = str(folder)
                STATE.save_cfg()
            log(f"Kayit klasoru degisti: {folder}")
            return self.send_json({"ok": True, "folder": str(folder)})
        if path == "/api/open-folder":
            data = self.read_json()
            open_in_explorer(STATE.folder, data.get("file"))
            return self.send_json({"ok": True})
        if path == "/api/quick/rotate":
            with STATE.lock:
                STATE.cfg["quick_token"] = secrets.token_urlsafe(16)
                STATE.save_cfg()
            return self.send_json({"ok": True, "quick_path": f"/kestirme?t={STATE.cfg['quick_token']}"})
        if path == "/api/peers/add":
            return self.add_peer_manual()
        if path == "/api/share":
            return self.add_shared(q)
        if path.startswith("/api/share/") and path.endswith("/delete"):
            sid = path.split("/")[3]
            with STATE.lock:
                item = STATE.shared.pop(sid, None)
            if item:
                try:
                    os.remove(item["path"])
                except OSError:
                    pass
            return self.send_json({"ok": True})
        if path == "/api/send/offer":
            data = self.read_json()
            peer = self.find_peer(data.get("peer_id"))
            body = json.dumps({"sender_name": STATE.name, "sender_id": STATE.id,
                               "files": data.get("files", [])}).encode("utf-8")
            status, resp = peer_request(peer, "POST", "/api/offer", body,
                                        {"Content-Type": "application/json"})
            return self.relay(status, resp)
        if path == "/api/send/upload":
            return self.proxy_upload(q)
        raise ApiError(404, "Bulunamadi")

    def create_offer(self):
        data = self.read_json()
        files = data.get("files")
        if not isinstance(files, list) or not files or len(files) > MAX_FILES_PER_OFFER:
            raise ApiError(400, "Dosya listesi gecersiz")
        clean = []
        for f in files:
            try:
                size = int(f.get("size", -1))
            except (TypeError, ValueError, AttributeError):
                raise ApiError(400, "Dosya bilgisi gecersiz")
            if size < 0:
                raise ApiError(400, "Dosya boyutu gecersiz")
            clean.append({"name": safe_name(f.get("name", "dosya")), "size": size,
                          "done": False, "busy": False})
        sender = str(data.get("sender_name") or "Bilinmeyen cihaz").strip()[:64] or "Bilinmeyen cihaz"
        oid = secrets.token_urlsafe(18)
        offer = {"id": oid, "status": "pending", "sender_name": sender,
                 "sender_ip": self.client_ip, "created": time.time(), "files": clean}
        with STATE.lock:
            if STATE.cfg.get("auto_accept"):
                offer["status"] = "accepted"
            STATE.offers[oid] = offer
        total = sum(f["size"] for f in clean)
        log(f"Gelen istek: {sender} ({self.client_ip}) -> {len(clean)} dosya, {human(total)}")
        what = clean[0]["name"] if len(clean) == 1 else f"{len(clean)} dosya"
        if offer["status"] == "pending":
            STATE.notify(f"{sender} dosya göndermek istiyor",
                         f"{what} ({human(total)}) - kabul etmek için tıklayın")
        self.send_json({"offer_id": oid, "status": offer["status"]})

    def decide_offer(self, oid, accept):
        with STATE.lock:
            o = STATE.offers.get(oid)
            if not o:
                raise ApiError(404, "Teklif bulunamadi")
            if o["status"] != "pending":
                raise ApiError(409, "Teklif artik gecerli degil")
            o["status"] = "accepted" if accept else "declined"
        self.send_json({"ok": True, "status": o["status"]})

    def receive_upload(self, q):
        oid = q.get("offer", "")
        try:
            idx = int(q.get("i", "-1"))
        except ValueError:
            raise ApiError(400, "Gecersiz dosya numarasi")
        length = self.content_length()
        with STATE.lock:
            o = STATE.offers.get(oid)
            if not o:
                raise ApiError(404, "Teklif bulunamadi")
            if o["status"] == "done":
                raise ApiError(409, "Dosyalar zaten gonderildi")
            if o["status"] != "accepted":
                raise ApiError(403, "Teklif onaylanmadi")
            if not 0 <= idx < len(o["files"]):
                raise ApiError(400, "Gecersiz dosya numarasi")
            f = o["files"][idx]
            if f["done"] or f["busy"]:
                raise ApiError(409, "Dosya zaten gonderildi")
            if length != f["size"]:
                raise ApiError(400, "Dosya boyutu teklifle uyusmuyor")
            f["busy"] = True
        try:
            path, fh = create_unique(STATE.folder, f["name"])
        except OSError as e:
            with STATE.lock:
                f["busy"] = False
            raise ApiError(500, f"Kayit klasorune yazilamiyor ({STATE.folder}): {e}")
        ok = False
        try:
            with fh:
                self.stream_body_to(fh, length)
            ok = True
        finally:
            with STATE.lock:
                f["busy"] = False
                if ok:
                    f["done"] = True
                    STATE.add_received({"name": path.name, "path": str(path), "size": length,
                                           "from": o["sender_name"], "time": time.time()})
                    if all(x["done"] for x in o["files"]):
                        o["status"] = "done"
                        n = len(o["files"])
                        STATE.notify("Dosya alındı",
                                     f"{o['sender_name']}: {path.name if n == 1 else f'{n} dosya'}")
            if not ok:
                try:
                    os.remove(path)
                except OSError:
                    pass
        log(f"Alindi: {path.name} ({human(length)}) <- {o['sender_name']}")
        self.send_json({"ok": True, "name": path.name})

    def proxy_upload(self, q):
        peer = self.find_peer(q.get("peer"))
        length = self.content_length()
        target = "/api/upload?" + urllib.parse.urlencode({"offer": q.get("offer", ""), "i": q.get("i", "")})
        conn = http.client.HTTPConnection(peer["ip"], peer["port"], timeout=60)
        try:
            conn.putrequest("POST", target)
            conn.putheader("Content-Type", "application/octet-stream")
            conn.putheader("Content-Length", str(length))
            conn.endheaders()
            remaining = length
            while remaining > 0:
                chunk = self.rfile.read(min(CHUNK, remaining))
                if not chunk:
                    raise ApiError(400, "Baglanti kesildi")
                try:
                    conn.send(chunk)
                except OSError:
                    # Karsi cihaz yuklemeyi erken reddetti: onun hata mesajini almaya calis
                    try:
                        resp = conn.getresponse()
                        msg = json.loads(resp.read() or b"{}").get("error") or f"HTTP {resp.status}"
                        raise ApiError(resp.status if resp.status >= 400 else 502, msg)
                    except ApiError:
                        raise
                    except Exception:
                        raise ApiError(502, "Karsi cihaz baglantiyi kesti")
                remaining -= len(chunk)
            resp = conn.getresponse()
            data = resp.read()
            return self.relay(resp.status, data)
        finally:
            conn.close()

    def check_quick_token(self, q):
        token = q.get("t", "")
        if not token or not secrets.compare_digest(token, STATE.cfg["quick_token"]):
            raise ApiError(403, "Gecersiz baglanti. Bulut'taki kestirme adresini yeniden kopyalayin.")

    def quick_upload(self, q):
        """iPhone Kestirmesi: tek istekte, onaysiz dosya alma (gizli anahtar ile)."""
        self.check_quick_token(q)
        ctype = (self.headers.get("Content-Type") or "").split(";")[0].strip().lower()
        if ctype.startswith("multipart/") or ctype == "application/x-www-form-urlencoded":
            raise ApiError(400, "Kestirmede Istek Govdesi 'Dosya' olarak secilmeli")
        ext = QUICK_EXT.get(ctype, "")
        if q.get("name"):
            name = safe_name(q["name"])
            if ext and not os.path.splitext(name)[1]:
                name += ext
        else:
            name = f"iPhone_{time.strftime('%Y%m%d_%H%M%S')}{ext or '.bin'}"
        try:
            path, fh = create_unique(STATE.folder, name)
        except OSError as e:
            raise ApiError(500, f"Kayit klasorune yazilamiyor ({STATE.folder}): {e}")
        size, ok = 0, False
        try:
            with fh:
                for chunk in self.iter_body():
                    fh.write(chunk)
                    size += len(chunk)
            if size == 0:
                raise ApiError(400, "Dosya bos geldi")
            ok = True
        finally:
            if not ok:
                try:
                    os.remove(path)
                except OSError:
                    pass
        sender = str(q.get("from") or "iPhone")[:64]
        with STATE.lock:
            STATE.add_received({"name": path.name, "path": str(path), "size": size,
                                   "from": sender, "time": time.time()})
        log(f"Kestirme ile alindi: {path.name} ({human(size)}) <- {sender} ({self.client_ip})")
        STATE.quick_received(path.name)
        self.send_json({"ok": True, "name": path.name, "mesaj": f"Bulut: {path.name} kaydedildi"})

    def serve_shortcut_setup(self, q):
        """Telefonda acilan kurulum sayfasi: kestirme adresi + adim adim anlatim."""
        self.check_quick_token(q)
        host = self.headers.get("Host") or f"{(local_ips() or ['127.0.0.1'])[0]}:{STATE.port}"
        url = f"http://{host}/api/quick?t={q['t']}"
        page = (resource_dir() / "static" / "kestirme.html").read_text(encoding="utf-8")
        page = page.replace("{{URL}}", html_escape(url)).replace("{{NAME}}", html_escape(STATE.name))
        body = page.encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "text/html; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def add_peer_manual(self):
        data = self.read_json()
        ip = str(data.get("ip", "")).strip()
        port = HTTP_PORT
        if ":" in ip:
            ip, p = ip.rsplit(":", 1)
            try:
                port = int(p)
            except ValueError:
                raise ApiError(400, "Gecersiz port")
        if not ip:
            raise ApiError(400, "IP adresi girin")
        try:
            status, body = peer_request({"ip": ip, "port": port}, "GET", "/api/info", timeout=4)
            info = json.loads(body)
        except Exception:
            raise ApiError(502, f"{ip}:{port} adresinde Bulut bulunamadi")
        if status != 200 or info.get("app") != APP:
            raise ApiError(502, "Bu adreste Bulut calismiyor")
        if info["id"] == STATE.id:
            raise ApiError(400, "Bu zaten bu bilgisayar")
        STATE.upsert_peer(info["id"], info.get("name", ip), ip, port, info.get("os", ""), manual=True)
        self.send_json({"ok": True, "name": info.get("name")})

    def add_shared(self, q):
        name = safe_name(q.get("name", "dosya"))
        length = self.content_length()
        sid = secrets.token_urlsafe(9)
        path = STATE.shared_dir / f"{sid}_{name}"
        ok = False
        try:
            with open(path, "wb") as fh:
                self.stream_body_to(fh, length)
            ok = True
        finally:
            if not ok:
                try:
                    os.remove(path)
                except OSError:
                    pass
        with STATE.lock:
            STATE.shared[sid] = {"name": name, "size": length, "path": str(path)}
        self.send_json({"ok": True, "id": sid})


def check_folder(raw) -> Path:
    """Kullanicinin verdigi klasoru dogrular: yoksa olusturur, yazilabilir olmali."""
    p = Path(os.path.expandvars(os.path.expanduser(str(raw).strip().strip('"'))))
    if not p.is_absolute():
        raise ApiError(400, "Tam klasor yolu yazin (ör. D:\\Fotograflar)")
    try:
        p.mkdir(parents=True, exist_ok=True)
        test = p / ".bulut_yazma_testi"
        test.write_bytes(b"")
        test.unlink()
    except OSError as e:
        raise ApiError(400, f"Bu klasore yazilamiyor: {e}")
    return p


def open_in_explorer(folder: Path, file_path=None):
    folder.mkdir(parents=True, exist_ok=True)
    target = None
    if file_path:
        fp = Path(file_path)
        # sadece indirme klasoru icindeki dosyalar
        try:
            fp.resolve().relative_to(folder.resolve())
            if fp.exists():
                target = fp
        except ValueError:
            pass
    try:
        if IS_WINDOWS:
            if target:
                subprocess.Popen(["explorer", "/select,", str(target)])
            else:
                os.startfile(str(folder))  # noqa
        elif sys.platform == "darwin":
            subprocess.Popen(["open", str(target.parent if target else folder)])
        else:
            subprocess.Popen(["xdg-open", str(target.parent if target else folder)])
    except Exception as e:
        log("Klasor acilamadi:", e)


def human(n):
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:.0f} {unit}" if unit == "B" else f"{n:.1f} {unit}"
        n /= 1024


def autostart_state():
    """Windows ile baslatma durumu; desteklenmiyorsa None."""
    if not STATE.autostart_ok:
        return None
    import bulut_windows
    return bulut_windows.autostart_enabled()


def setup_desktop(args, url, server):
    """Tepsi simgesi, bildirim ve otomatik baslatmayi hazirlar. Tray nesnesi veya None doner."""
    if args.console:
        return None
    try:
        import bulut_windows as bw
    except Exception as e:
        log("Masaustu entegrasyonu yuklenemedi:", e)
        return None
    if not bw.tray_available():
        log("Tepsi simgesi icin 'pip install -r requirements.txt' gerekli; konsol modunda calisiliyor.")
        return None

    tray = bw.Tray(
        url=url,
        open_folder=lambda: open_in_explorer(STATE.folder),
        pending_count=STATE.pending_count,
        on_quit=lambda: threading.Thread(target=server.shutdown, daemon=True).start(),
    )

    def notifier(title, body):
        if not bw.windows_toast(title, body, url):
            tray.notify(title, body)  # yedek: klasik tepsi balonu
    STATE.notifier = notifier

    if bw.IS_WINDOWS:
        STATE.autostart_ok = True
        try:
            if not STATE.cfg.get("autostart_initialized"):
                # Ilk calistirmada varsayilan olarak Windows ile baslat
                bw.set_autostart(True)
                STATE.cfg["autostart_initialized"] = True
                STATE.save_cfg()
            elif bw.autostart_enabled():
                bw.set_autostart(True)  # klasor tasindiysa yolu guncelle
        except OSError as e:
            log("Otomatik baslatma ayarlanamadi:", e)
    return tray


def main():
    global STATE, DISCOVERY_PORT, LOG_FILE
    if hasattr(sys.stdout, "reconfigure"):
        try:
            sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

    ap = argparse.ArgumentParser(description="Bulut 1.0 - yerel ag dosya paylasimi")
    ap.add_argument("--port", type=int, default=HTTP_PORT, help="HTTP portu (varsayilan 8765)")
    ap.add_argument("--discovery-port", type=int, default=DISCOVERY_PORT, help="kesif UDP portu")
    ap.add_argument("--name", help="cihaz adi")
    ap.add_argument("--folder", help="gelen dosyalarin kaydedilecegi klasor")
    ap.add_argument("--no-browser", action="store_true", help="tarayiciyi otomatik acma")
    ap.add_argument("--background", action="store_true",
                    help="arka planda baslat (Windows acilisinda kullanilir, tarayici acilmaz)")
    ap.add_argument("--console", action="store_true", help="tepsi simgesi olmadan konsolda calis")
    args = ap.parse_args()
    DISCOVERY_PORT = args.discovery_port
    url = f"http://localhost:{args.port}"
    open_ui = not (args.no_browser or args.background)

    try:
        server = ThreadingHTTPServer(("0.0.0.0", args.port), Handler)
    except OSError:
        # Bulut zaten calisiyor: ikinci kez acilinca sadece arayuzu goster
        log(f"Port {args.port} kullanimda - Bulut zaten calisiyor olabilir.")
        if open_ui:
            webbrowser.open(url)
        return
    server.daemon_threads = True

    LOG_FILE = data_dir() / "bulut.log"
    try:
        if LOG_FILE.exists() and LOG_FILE.stat().st_size > 1024 * 1024:
            LOG_FILE.unlink()
    except OSError:
        pass

    STATE = State(args.port, args.name, args.folder)
    threading.Thread(target=maintenance_loop, daemon=True).start()
    start_discovery()
    tray = setup_desktop(args, url, server)

    log("=" * 52)
    log(f"  Bulut {VERSION} calisiyor  -  cihaz adi: {STATE.name}")
    log(f"  Bu bilgisayar : {url}")
    for ip in local_ips():
        log(f"  Telefon/diger : http://{ip}:{args.port}")
    log(f"  Gelen dosyalar: {STATE.folder}")
    if tray:
        log("  Saatin yanindaki Bulut simgesinden acip kapatabilirsiniz")
    else:
        log("  Kapatmak icin bu pencereyi kapatin veya Ctrl+C")
    log("=" * 52)

    if open_ui:
        threading.Timer(0.8, lambda: webbrowser.open(url)).start()

    try:
        if tray:
            threading.Thread(target=server.serve_forever, daemon=True).start()
            try:
                tray.run()  # Cikis'a basilana kadar bekler
            except Exception as e:
                log("Tepsi simgesi baslatilamadi:", e)
                STATE.notifier = None
                while True:
                    time.sleep(3600)
        else:
            server.serve_forever()
    except KeyboardInterrupt:
        log("Kapatiliyor...")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
