import math, subprocess, sys, wave
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

SRC = "/root/.claude/uploads/09c8a426-dd98-5c23-b95a-b9815bf1ee23/76ec16af-image.jpg"
OUT_DIR = sys.argv[1]
W, H, FPS = 1080, 1920, 30
DUR = 21.0
XF = 0.6  # crossfade

SERIF = "/usr/share/fonts/truetype/dejavu/DejaVuSerif-Bold.ttf"
SANS = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
SANSB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"

src = Image.open(SRC).convert("RGB")
# warm, soft grade
src = ImageEnhance.Color(src).enhance(1.15)
r, g, b = src.split()
r = r.point(lambda v: min(255, int(v * 1.06 + 4)))
b = b.point(lambda v: int(v * 0.92))
src = Image.merge("RGB", (r, g, b))
src = ImageEnhance.Contrast(src).enhance(1.06)

def ease(x):
    x = max(0.0, min(1.0, x))
    return x * x * (3 - 2 * x)

S = src.size[0] / 1500
def kb(cx0, cy0, w0, cx1, cy1, w1, t):
    cx0, cy0, w0, cx1, cy1, w1 = [v * S for v in (cx0, cy0, w0, cx1, cy1, w1)]
    e = ease(t)
    cx = cx0 + (cx1 - cx0) * e
    cy = cy0 + (cy1 - cy0) * e
    w = w0 + (w1 - w0) * e
    h = w * 16 / 9
    box = (cx - w / 2, cy - h / 2, cx + w / 2, cy + h / 2)
    return src.resize((W, H), Image.LANCZOS, box=box)

# vignette + bottom gradient overlay (precomputed)
yy, xx = np.mgrid[0:H, 0:W]
d = np.sqrt(((xx - W / 2) / (W * 0.75)) ** 2 + ((yy - H / 2) / (H * 0.75)) ** 2)
vig = np.clip(1 - (d ** 2) * 0.55, 0.45, 1.0)
grad = np.clip((yy - H * 0.55) / (H * 0.45), 0, 1) ** 1.4 * 0.70
shade = (vig * (1 - grad))[..., None].astype(np.float32)

def finish(img, shade_on=True):
    a = np.asarray(img).astype(np.float32)
    if shade_on:
        a = a * shade
    return Image.fromarray(np.clip(a, 0, 255).astype(np.uint8))

def draw_text(img, lines, t, y=1430, sub=None, sub_y=None):
    """lines: list of (text, font) fades/slides in over first 0.7s"""
    ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dr = ImageDraw.Draw(ov)
    a = ease(t / 0.7)
    off = int((1 - a) * 40)
    cy = y + off
    for text, font, col in lines:
        bb = dr.textbbox((0, 0), text, font=font)
        tw, th = bb[2] - bb[0], bb[3] - bb[1]
        x = (W - tw) / 2
        dr.text((x + 3, cy + 4), text, font=font, fill=(0, 0, 0, int(140 * a)))
        dr.text((x, cy), text, font=font, fill=col[:3] + (int(255 * a),))
        cy += th + 28
    img = img.convert("RGBA")
    img.alpha_composite(ov)
    return img.convert("RGB")

F_BIG = ImageFont.truetype(SERIF, 92)
F_MED = ImageFont.truetype(SERIF, 74)
F_SUB = ImageFont.truetype(SANS, 44)
F_SUBB = ImageFont.truetype(SANSB, 48)
CREAM = (250, 240, 220)
GOLD = (240, 205, 140)

# ---- scenes: (start, end, render(tl, u)) where tl=local seconds, u=0..1
def s1(tl, u):
    img = finish(kb(795, 1000, 1125, 795, 1120, 760, u))
    return draw_text(img, [("Doğanın dokusu,", F_BIG, CREAM), ("evinizde.", F_BIG, GOLD)], tl - 0.4)

def s2(tl, u):
    img = finish(kb(660, 1110, 560, 940, 1110, 520, u))
    return draw_text(img, [("El örgüsü", F_MED, CREAM), ("zarif kenar", F_MED, GOLD)], tl - 0.3)

def s3(tl, u):
    img = finish(kb(800, 1080, 540, 800, 1050, 380, u))
    return draw_text(img, [("%100 doğal hasır,", F_MED, CREAM), ("ustaca örüldü", F_MED, GOLD)], tl - 0.3)

def s4(tl, u):
    img = finish(kb(700, 1170, 700, 860, 1150, 620, u))
    return draw_text(img, [("Meyve • Ekmek • Dekor", F_MED, CREAM), ("her köşeye yakışır", F_SUB, GOLD)], tl - 0.3)

# end card
bg_end = src.resize((W, H), Image.LANCZOS, box=tuple(v * S for v in (232, 0, 1357, 2000))).filter(ImageFilter.GaussianBlur(28))
bg_end = Image.blend(bg_end, Image.new("RGB", (W, H), (60, 42, 25)), 0.55)
crop = src.crop(tuple(int(v * S) for v in (400, 640, 1200, 1320)))
mask = Image.new("L", crop.size, 0)
ImageDraw.Draw(mask).ellipse((0, 0, crop.size[0], crop.size[1]), fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(30))

def s5(tl, u):
    img = bg_end.copy()
    sc = 0.92 + 0.08 * ease(u)
    cw, ch = int(1000 * sc), int(850 * sc)
    c = crop.resize((cw, ch), Image.LANCZOS)
    m = mask.resize((cw, ch), Image.LANCZOS)
    img.paste(c, ((W - cw) // 2, 330 + (850 - ch) // 2), m)
    img = draw_text(img, [("El Yapımı", F_MED, CREAM), ("Hasır Sepet", F_BIG, GOLD)], tl - 0.2, y=1230)
    # CTA pill
    a = ease((tl - 1.2) / 0.6)
    if a > 0:
        ov = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        dr = ImageDraw.Draw(ov)
        pulse = 1 + 0.03 * math.sin(tl * 5) * a
        pw, ph = int(700 * pulse), int(120 * pulse)
        x0, y0 = (W - pw) // 2, 1560 + (120 - ph) // 2
        dr.rounded_rectangle((x0, y0, x0 + pw, y0 + ph), radius=ph // 2, fill=GOLD + (int(255 * a),))
        txt = "Sipariş için mesaj at"
        bb = dr.textbbox((0, 0), txt, font=F_SUBB)
        dr.text(((W - (bb[2] - bb[0])) / 2, y0 + (ph - (bb[3] - bb[1])) / 2 - bb[1]), txt, font=F_SUBB, fill=(60, 38, 18, int(255 * a)))
        txt2 = "Sınırlı stok • Her biri tek ve özel"
        bb = dr.textbbox((0, 0), txt2, font=F_SUB)
        dr.text(((W - (bb[2] - bb[0])) / 2, 1730), txt2, font=F_SUB, fill=CREAM + (int(220 * a),))
        img = img.convert("RGBA"); img.alpha_composite(ov); img = img.convert("RGB")
    # fade out last 0.6s
    fo = ease((DUR - (16.0 + tl)) / 0.6)
    if fo < 1:
        img = Image.blend(Image.new("RGB", (W, H)), img, fo)
    return img

SCENES = [(0.0, 4.3, s1), (4.0, 8.3, s2), (8.0, 12.3, s3), (12.0, 16.3, s4), (16.0, DUR, s5)]

def frame(t):
    act = [(s, e, f) for s, e, f in SCENES if s <= t < e]
    imgs = []
    for s, e, f in act:
        imgs.append((s, e, f(t - s, (t - s) / (e - s))))
    if len(imgs) == 1:
        img = imgs[0][2]
    else:
        (s0, e0, a), (s1_, e1, b) = imgs[0], imgs[1]
        k = ease((t - s1_) / (e0 - s1_))
        img = Image.blend(a, b, k)
    if t < 0.5:
        img = Image.blend(Image.new("RGB", (W, H)), img, ease(t / 0.5))
    return img

# ---- music: soft plucked arpeggio + pad
def music(path):
    sr = 44100
    n = int(sr * DUR)
    out = np.zeros(n)
    tt = np.arange(n) / sr
    bpm = 84
    beat = 60 / bpm
    def hz(m): return 440 * 2 ** ((m - 69) / 12)
    chords = [[57, 60, 64, 69], [53, 57, 60, 65], [48, 52, 55, 60], [55, 59, 62, 67]]  # Am F C G
    bar = beat * 4
    for i in range(int(DUR / bar) + 1):
        ch = chords[i % 4]
        t0 = i * bar
        # pad
        s0, s1 = int(t0 * sr), min(n, int((t0 + bar + 0.5) * sr))
        if s0 >= n: break
        seg = tt[s0:s1] - t0
        env = np.minimum(1, seg / 0.8) * np.exp(-seg * 0.25)
        for m in ch[:3]:
            out[s0:s1] += 0.035 * env * (np.sin(2 * np.pi * hz(m) * seg) + 0.3 * np.sin(2 * np.pi * hz(m) * 2.003 * seg))
        # arpeggio 8ths
        pat = [0, 1, 2, 3, 2, 1, 2, 3]
        for j, p in enumerate(pat):
            ts = t0 + j * beat / 2
            a0 = int(ts * sr)
            if a0 >= n: break
            a1 = min(n, a0 + int(1.5 * sr))
            seg = tt[a0:a1] - ts
            f = hz(ch[p] + 12)
            env = np.exp(-seg * 4.5) * np.minimum(1, seg / 0.005)
            out[a0:a1] += 0.07 * env * (np.sin(2 * np.pi * f * seg) + 0.25 * np.sin(2 * np.pi * 2 * f * seg))
    # simple echo
    dl = int(0.36 * sr)
    out[dl:] += 0.3 * out[:-dl]
    fade = np.minimum(1, tt / 1.0) * np.minimum(1, (DUR - tt) / 1.5)
    out *= fade
    out /= np.max(np.abs(out)) * 1.25
    pcm = (out * 32767).astype(np.int16)
    st = np.stack([pcm, pcm], 1)
    with wave.open(path, "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr)
        w.writeframes(st.tobytes())

if __name__ == "__main__":
    music(f"{OUT_DIR}/music.wav")
    p = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
                          "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", f"{OUT_DIR}/music.wav",
                          "-c:v", "libx264", "-preset", "medium", "-crf", "19", "-pix_fmt", "yuv420p",
                          "-c:a", "aac", "-b:a", "192k", "-shortest", "-movflags", "+faststart",
                          f"{OUT_DIR}/hasir_sepet_reklam.mp4"], stdin=subprocess.PIPE)
    N = int(DUR * FPS)
    for i in range(N):
        p.stdin.write(frame(i / FPS).tobytes())
        if i % 60 == 0:
            frame(i / FPS).save(f"{OUT_DIR}/preview_{i//60:02d}.jpg", quality=70) if i % 120 == 0 else None
    p.stdin.close(); p.wait()
    print("done", p.returncode)
