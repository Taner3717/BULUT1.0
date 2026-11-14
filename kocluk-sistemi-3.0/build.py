"""Koçluk Sistemi 3.0 danışan dosyasını üretir.

Kullanım:  python build.py
Çıktı:     "Koçluk Sistemi 3.0 - Şablon.xlsx"  (boş, yeni danışan için kopyalanır)
           "Koçluk Sistemi 3.0 - Örnek.xlsx"   (kurgusal danışanla doldurulmuş)
"""
import datetime as dt
import math
import os

from openpyxl import Workbook
from openpyxl.chart import BarChart, LineChart, Reference
from openpyxl.formatting.rule import FormulaRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter as L
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.worksheet.properties import PageSetupProperties

HERE = os.path.dirname(os.path.abspath(__file__))
WEEKS = 12
DAYS = WEEKS * 7
G_FIRST, G_LAST = 6, 6 + DAYS - 1          # Günlük Takip veri satırları
O_FIRST, O_LAST = 5, 5 + WEEKS - 1         # Haftalık Özet veri satırları
FOOD_FIRST, FOOD_LAST = 4, 80              # Besinler arama aralığı
EX_FIRST, EX_LAST = 6, 45                  # Antrenman hareket satırları

GT = "'Günlük Takip'"
OZ = "'Haftalık Özet'"
YH = "'Yol Haritası'"

# ---------------------------------------------------------------- stil
NAVY, TEAL = "1F3A5F", "0F766E"
F_TITLE = Font(name="Arial", size=16, bold=True, color=NAVY)
F_BASE = Font(name="Arial", size=10)
F_BOLD = Font(name="Arial", size=10, bold=True)
F_HEAD = Font(name="Arial", size=10, bold=True, color="FFFFFF")
F_NOTE = Font(name="Arial", size=9, italic=True, color="555555")
FILL_HEAD = PatternFill("solid", start_color=NAVY)
FILL_SEC = PatternFill("solid", start_color="DCE6F1")
FILL_IN = PatternFill("solid", start_color="FFF8D6")     # doldurulacak
FILL_AUTO = PatternFill("solid", start_color="EFEFEF")   # otomatik
FILL_OK = PatternFill("solid", start_color="C6EFCE")
FILL_WARN = PatternFill("solid", start_color="FFEB9C")
FILL_BAD = PatternFill("solid", start_color="FFC7CE")
THIN = Side(style="thin", color="BFBFBF")
THICK = Side(style="medium", color=NAVY)
BORDER = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)
LEFT = Alignment(horizontal="left", vertical="center", wrap_text=True)
TOP = Alignment(horizontal="left", vertical="top", wrap_text=True)
NOWRAP = Alignment(horizontal="left", vertical="center", wrap_text=False)

LEGEND = "Sarı hücreleri doldur · Gri hücreler otomatik hesaplanır, dokunma."


def put(ws, ref, value=None, kind="base", fmt=None, align=None):
    c = ws[ref]
    if value is not None:
        c.value = value
    c.font = {"title": F_TITLE, "head": F_HEAD, "sec": F_BOLD, "label": F_BOLD,
              "note": F_NOTE}.get(kind, F_BASE)
    if kind == "head":
        c.fill, c.border, c.alignment = FILL_HEAD, BORDER, CENTER
    elif kind == "sec":
        c.fill, c.alignment = FILL_SEC, NOWRAP
    elif kind == "in":
        c.fill, c.border, c.alignment = FILL_IN, BORDER, CENTER
    elif kind == "auto":
        c.fill, c.border, c.alignment = FILL_AUTO, BORDER, CENTER
    elif kind == "label":
        c.border, c.alignment = BORDER, LEFT
    elif kind in ("note", "title"):
        c.alignment = NOWRAP
    else:
        c.alignment = LEFT
    if align:
        c.alignment = align
    if fmt:
        c.number_format = fmt
    return c


def section(ws, row, text, c1=1, c2=3):
    for col in range(c1, c2 + 1):
        put(ws, f"{L(col)}{row}", None, "sec")
    ws.cell(row=row, column=c1).value = text


def widths(ws, spec):
    for cols, w in spec.items():
        for col in cols.split(","):
            ws.column_dimensions[col].width = w


def list_dv(ws, formula, rng, allow_blank=True):
    dv = DataValidation(type="list", formula1=formula, allow_blank=allow_blank)
    dv.error, dv.errorTitle = "Listeden seç.", "Geçersiz değer"
    ws.add_data_validation(dv)
    dv.add(rng)


def num_dv(ws, rng, lo, hi, whole=True):
    dv = DataValidation(type="whole" if whole else "decimal", operator="between",
                        formula1=str(lo), formula2=str(hi), allow_blank=True)
    dv.error, dv.errorTitle = f"{lo} ile {hi} arasında bir değer gir.", "Geçersiz değer"
    ws.add_data_validation(dv)
    dv.add(rng)


def traffic(ws, rng, first, good=0.8, bad=0.6):
    """Sayısal uyum hücreleri için yeşil / sarı / kırmızı."""
    ws.conditional_formatting.add(rng, FormulaRule(
        formula=[f"AND(ISNUMBER({first}),{first}>={good})"], fill=FILL_OK))
    ws.conditional_formatting.add(rng, FormulaRule(
        formula=[f"AND(ISNUMBER({first}),{first}<{bad})"], fill=FILL_BAD))
    ws.conditional_formatting.add(rng, FormulaRule(
        formula=[f"AND(ISNUMBER({first}),{first}>={bad},{first}<{good})"], fill=FILL_WARN))


def text_flags(ws, rng, first):
    for words, fill in ((("Hedefte",), FILL_OK), (("Yavaş", "Artıyor", "Düşüyor"), FILL_WARN),
                        (("Hızlı",), FILL_BAD)):
        cond = ",".join(f'{first}="{w}"' for w in words)
        ws.conditional_formatting.add(rng, FormulaRule(formula=[f"OR({cond})"], fill=fill))


def chart_base(ch, title, w=17, h=7.5):
    ch.title = title
    ch.title.overlay = False
    ch.roundedCorners = False
    ch.width, ch.height = w, h
    ch.x_axis.delete = False
    ch.y_axis.delete = False
    if ch.legend is not None:
        ch.legend.overlay = False
        ch.legend.position = "b"


# ---------------------------------------------------------------- içerik
WEEKDAYS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"]

# (besin, baz miktar, birim, yağ, karb, protein) — koçun mevcut takip dosyalarındaki
# Beslenme sayfasında kullanılan değerlerin baz miktara çevrilmiş hali.
FOODS = [
    ("Haşlanmış yumurta (büyük)", 1, "adet", 5.3, 0.56, 6.29),
    ("Yulaf ezmesi", 100, "g", 7.2, 55, 15),
    ("Fıstık ezmesi", 100, "g", 50, 22, 25),
    ("Tavuk göğsü", 100, "g", 3.54, 0, 30.76),
    ("Tavuk but (derisiz)", 100, "g", 4.5, 0, 19.5),
    ("Hindi füme", 100, "g", 2, 2, 18),
    ("Dana kıyma (%5 yağlı)", 100, "g", 5, 0, 21),
    ("Dana bonfile (yağsız)", 100, "g", 5, 0, 22),
    ("Somon", 100, "g", 13, 0, 20),
    ("Levrek", 100, "g", 2, 0, 19),
    ("Ton balığı (suda, süzülmüş)", 100, "g", 1, 0, 25),
    ("Karides", 100, "g", 1, 0, 20),
    ("Makarna (kuru)", 100, "g", 2, 71.7, 11.5),
    ("Tam buğday makarna (kuru)", 100, "g", 2.5, 65, 13),
    ("Baldo pirinç (kuru)", 100, "g", 1.06, 77.24, 6.35),
    ("Esmer pirinç (kuru)", 100, "g", 2.75, 76, 7.5),
    ("Bulgur (kuru)", 100, "g", 1.33, 76, 12.33),
    ("Kinoa (kuru)", 100, "g", 6, 64, 14),
    ("Kırmızı mercimek (kuru)", 100, "g", 1.5, 60, 24),
    ("Nohut (kuru)", 100, "g", 6, 61, 19),
    ("Patates (çiğ)", 100, "g", 0.09, 17, 2),
    ("Çavdar ekmeği", 100, "g", 3.33, 48, 8.5),
    ("Tam buğday ekmeği", 100, "g", 3.5, 41, 9.75),
    ("Kepekli ekmek", 100, "g", 3.5, 43, 9),
    ("Tam buğday lavaş", 100, "g", 6, 48, 10),
    ("Light lor peyniri", 100, "g", 2, 3, 12),
    ("Light beyaz peynir", 100, "g", 10, 1, 18),
    ("Light kaşar peyniri", 100, "g", 15, 1, 28),
    ("Light süzme yoğurt", 100, "g", 1, 4, 9),
    ("Yoğurt (%3 yağlı)", 100, "g", 3, 4.7, 3.5),
    ("Ayran", 100, "ml", 1.5, 2.5, 2),
    ("Kefir", 100, "ml", 1.5, 4.5, 3.3),
    ("Zeytinyağı", 100, "g", 100, 0, 0),
    ("Ceviz", 100, "g", 65, 14, 15),
    ("Badem", 100, "g", 50, 22, 20.67),
    ("Avokado", 100, "g", 15, 9, 2),
    ("Siyah zeytin", 100, "g", 15, 6, 1),
    ("Muz", 100, "g", 0.3, 23, 1.1),
    ("Elma", 100, "g", 0.2, 14, 0.33),
    ("Hurma", 100, "g", 0.33, 75, 2.67),
    ("Bal", 100, "g", 0, 82, 0),
    ("Çoban salatası (1 kase)", 1, "adet", 7.19, 5.52, 1),
    ("Yeşil salata", 100, "g", 0.2, 4, 1),
    ("Brokoli", 100, "g", 0.4, 7, 2.8),
    ("Domates-salatalık", 100, "g", 0.2, 4, 1),
    ("Mantar", 100, "g", 0.33, 3, 3),
    ("Roka", 100, "g", 0.7, 3.7, 2.6),
]

EX_PROFILE = {
    4: "Örnek Danışan", 5: "Erkek", 6: dt.date(1995, 3, 13), 8: 178,
    9: "Masa başı, günde 9 saat", 10: "1–3 yıl", 11: "Sağ dizde ara sıra ağrı",
    12: "Ciğer yemez", 13: "",
    16: "Yağ kaybı", 17: dt.date(2026, 11, 2), 18: 84.0, 19: 78.0, 20: -0.007, 21: 0.003,
    22: None,
}
EX_PATTERN = [("Low", "Upper A"), ("High", "Lower A"), ("Low", "OFF"), ("Low", "Upper B"),
              ("High", "Lower B"), ("Low", "OFF"), ("High", "OFF")]
EX_TARGETS = {"Low": (170, 60, 170, 10000), "High": (170, 60, 270, 10000)}

# kilo, uyku, stres, enerji, açlık, sindirim, antrenman, kardiyo, adım, P, Y, K, not
EX_DAYS = [
    (84.0, 7.0, 2, 4, 2, 4, "Yapıldı", 0, 10400, 168, 58, 172, ""),
    (83.8, 6.5, 2, 4, 2, 4, "Yapıldı", 0, 11200, 172, 61, 265, ""),
    (83.5, 7.5, 1, 5, 3, 4, "OFF", 30, 12100, 165, 62, 168, ""),
    (83.6, 6.0, 3, 3, 3, 3, "Yapıldı", 0, 9800, 171, 59, 175, ""),
    (83.2, 7.0, 2, 4, 2, 4, "Yapıldı", 0, 10900, 174, 63, 272, ""),
    (83.1, 8.0, 1, 5, 4, 4, "OFF", 30, 13400, 150, 82, 215, "Akşam dışarıda yemek"),
    (83.0, 7.5, 1, 4, 2, 5, "OFF", 0, 7600, 169, 60, 268, ""),
    (83.1, 7.0, 2, 4, 3, 4, "Yapıldı", 0, 10100, 170, 60, 169, ""),
    (82.9, 6.5, 2, 4, 3, 4, "Yapıldı", 0, 10700, 173, 58, 271, ""),
    (82.7, 7.0, 2, 4, 3, 3, "OFF", 30, 11800, 167, 61, 171, ""),
    (82.9, 5.5, 4, 2, 4, 3, "Kaçtı", 0, 6200, 141, 70, 190, "İş yoğun, antrenman kaçtı"),
    (82.6, 7.0, 2, 4, 3, 4, "Yapıldı", 0, 10300, 171, 62, 266, ""),
    (82.5, 8.0, 1, 5, 3, 4, "Yapıldı", 30, 12600, 169, 59, 170, "Perşembe telafisi"),
    (82.6, 7.5, 1, 4, 2, 4, "OFF", 0, 9900, 172, 60, 274, ""),
    (82.5, 7.0, 2, 4, 3, 4, "Yapıldı", 0, 10500, 170, 61, 168, ""),
    (82.3, 7.0, 2, 4, 3, 4, "Yapıldı", 0, 10800, 171, 59, 270, ""),
    (82.4, 6.5, 2, 3, 3, 4, "OFF", 30, 11300, 168, 60, 172, ""),
]

# gün, hareket, set, tekrar min, tekrar maks, RIR, başlangıç kg
EX_PROGRAM = [
    ("Upper A (Pzt)", "Bench press", 4, 6, 8, "1-2", 70),
    ("Upper A (Pzt)", "Chest-supported row", 4, 6, 10, "1-2", 60),
    ("Upper A (Pzt)", "Overhead press", 3, 6, 10, "1-2", 40),
    ("Upper A (Pzt)", "Lat pulldown", 3, 8, 12, "1-2", 55),
    ("Upper A (Pzt)", "Lateral raise", 3, 12, 20, "0-1", 8),
    ("Upper A (Pzt)", "Incline curl", 3, 10, 15, "0-1", 10),
    ("Upper A (Pzt)", "Overhead triceps extension", 3, 10, 15, "0-1", 20),
    ("Lower A (Salı)", "Leg press", 4, 8, 12, "1-2", 140),
    ("Lower A (Salı)", "Leg extension", 3, 12, 15, "0-1", 45),
    ("Lower A (Salı)", "Seated leg curl", 3, 10, 15, "0-1", 40),
    ("Lower A (Salı)", "Calf raise", 4, 10, 15, "0-1", 60),
    ("Lower A (Salı)", "Cable crunch", 3, 10, 15, "0-1", 30),
    ("Upper B (Per)", "Incline dumbbell press", 3, 8, 12, "1-2", 24),
    ("Upper B (Per)", "Cable row", 3, 10, 12, "1-2", 55),
    ("Upper B (Per)", "Cable fly", 3, 12, 15, "0-1", 15),
    ("Upper B (Per)", "Lateral raise", 4, 12, 20, "0-1", 8),
    ("Upper B (Per)", "Rear delt fly", 3, 12, 20, "0-1", 30),
    ("Upper B (Per)", "Curl", 3, 10, 15, "0-1", 12),
    ("Upper B (Per)", "Triceps pushdown", 3, 10, 15, "0-1", 25),
    ("Lower B (Cuma)", "Romanian deadlift", 4, 6, 10, "1-2", 80),
    ("Lower B (Cuma)", "Lying leg curl", 3, 10, 15, "0-1", 35),
    ("Lower B (Cuma)", "Hip thrust", 3, 8, 12, "1-2", 90),
    ("Lower B (Cuma)", "Leg extension", 3, 12, 15, "0-1", 45),
    ("Lower B (Cuma)", "Calf raise", 4, 10, 15, "0-1", 60),
]

EX_MENU = {
    "Low": [("1. Öğün 11:00", [("Haşlanmış yumurta (büyük)", 2), ("Yulaf ezmesi", 50),
                               ("Fıstık ezmesi", 30)]),
            ("2. Öğün 16:00", [("Tavuk göğsü", 220), ("Makarna (kuru)", 90),
                               ("Çoban salatası (1 kase)", 1), ("Zeytinyağı", 5)]),
            ("3. Öğün 20:00", [("Tavuk göğsü", 180), ("Baldo pirinç (kuru)", 85)])],
    "High": [("1. Öğün 11:00", [("Haşlanmış yumurta (büyük)", 2), ("Yulaf ezmesi", 80),
                                ("Fıstık ezmesi", 30), ("Muz", 100)]),
             ("2. Öğün 16:00", [("Tavuk göğsü", 200), ("Makarna (kuru)", 130),
                                ("Çoban salatası (1 kase)", 1), ("Zeytinyağı", 5)]),
             ("3. Öğün 20:00", [("Tavuk göğsü", 170), ("Baldo pirinç (kuru)", 130)])],
}


# ---------------------------------------------------------------- sayfalar
def sheet_kilavuz(wb):
    ws = wb.create_sheet("Kılavuz")
    widths(ws, {"A": 26, "B": 100})
    put(ws, "A1", "KOÇLUK SİSTEMİ 3.0", "title")
    put(ws, "A2", "Danışan dosyası · her danışan için bu dosyanın bir kopyası kullanılır.", "note")
    r = 4
    blocks = [
        ("RENK KODU", [
            ("Sarı hücre", "Doldurulacak alan (danışan ya da koç yazar)."),
            ("Gri hücre", "Otomatik hesaplanır. Üzerine yazma; formül bozulur."),
            ("Yeşil / sarı / kırmızı", "Uyum ve hız göstergesi: yeşil hedefte, sarı sınırda, kırmızı hedef dışı."),
        ]),
        ("YENİ DANIŞAN KURULUMU (koç, 5 adım)", [
            ("1. Kopyala", "Şablon dosyasını kopyala, adını \"Ad Soyad · Koçluk 3.0\" yap."),
            ("2. Profil", "Başvuru formundaki bilgileri Profil sayfasına gir: başlangıç tarihi (pazartesi), "
                          "başlangıç ve hedef kilo, haftalık hedef hız, Low / High day makroları, haftalık düzen."),
            ("3. Antrenman", "Programı Antrenman sayfasına yaz: gün, hareket, set, tekrar aralığı, RIR."),
            ("4. Beslenme", "Örnek menüyü Besinler listesinden seçip gramajla kur; toplam hedefe otursun."),
            ("5. Paylaş", "Dosyayı danışanla paylaş. Danışan yalnızca Günlük Takip, Antrenman ve Ölçüler'e yazar."),
        ]),
        ("HAFTALIK RUTİN", [
            ("Danışan · her gün", "Günlük Takip'te o günün satırını doldurur: sabah aç karnına kilo, uyku, "
                                  "stres / enerji / açlık / sindirim (1-5), antrenman, kardiyo, adım ve makrolar."),
            ("Danışan · antrenmanda", "Antrenman sayfasında o haftanın sütununa her hareketin en iyi setini yazar (kg ve tekrar)."),
            ("Danışan · pazartesi", "Ölçüler sayfasına haftalık ölçüleri girer, fotoğraflarını gönderir."),
            ("Koç · pazartesi", "Panel'e bakar → Haftalık Özet'te otomatik öneriyi okur → Koç kararı ve notunu yazar "
                                "→ gerekiyorsa Profil'deki makroları günceller → Yol Haritası'nda protokolü işaretler."),
        ]),
        ("SAYFALAR", [
            ("Panel", "Tek bakışta durum: son tamamlanan hafta, kilo değişimi, uyum skoru, otomatik öneri ve grafikler."),
            ("Profil", "Danışan bilgileri ve bütün hedefler. Hedefler yalnızca burada değişir, her yere buradan yayılır."),
            ("Günlük Takip", "12 haftalık günlük kayıt. Kalori makrolardan hesaplanır; her gün Low / High hedefiyle kıyaslanır."),
            ("Haftalık Özet", "Haftalık ortalamalar, uyum yüzdeleri, hız durumu, otomatik öneri ve check-in notları."),
            ("Yol Haritası", "Hedef kilo çizgisi ile gerçekleşen haftalık ortalamanın karşılaştırması ve protokol."),
            ("Antrenman", "Program ve 12 haftalık yük takibi. Değişim, tahmini 1TM ve \"kilo artır / tekrar ekle\" önerisi otomatik."),
            ("Beslenme", "Low ve High day örnek menü. Besin seç, gramaj yaz; makrolar ve hedeften fark otomatik."),
            ("Ölçüler", "Haftalık çevre ölçüleri, bel / kalça, bel / boy, tahmini yağ oranı ve yağsız kütle."),
            ("Besinler", "Beslenme sayfasının kullandığı besin değerleri listesi. Yeni besin en alta eklenir."),
            ("Rehber", "Danışan için kurallar: esnek beslenme, değişimler, su ve tuz, içecekler, supplement, antrenman ve ölçüm."),
        ]),
        ("3.0'DA NE DEĞİŞTİ (2.0'a göre)", [
            ("Tek hedef kaynağı", "Makro ve adım hedefleri her haftanın yanına elle yazılmıyor; Profil'de bir kez girilir."),
            ("Gün tipi", "Her günün Low / High olduğu bilinir; kalori o günün hedefiyle kıyaslanır."),
            ("Uyum skoru", "Kalori, protein, adım ve antrenman uyumu yüzde olarak ölçülür."),
            ("Karar motoru", "Kilo değişim hızı hedef aralıkla karşılaştırılır; uyum yeterliyse kalori / adım önerisi üretilir."),
            ("Sayısal antrenman kaydı", "\"kg × tekrar × RIR\" tek hücre yerine ayrı kg ve tekrar; ilerleme hesaplanabilir."),
            ("Hesaplanan menü", "Menüler elle toplanmıyor; besin listesinden otomatik hesaplanır."),
            ("Panel ve check-in", "Koç tek sayfadan durumu görür; her haftanın kararı ve notu kayıt altında kalır."),
            ("12 hafta + yarış", "Takip 8 yerine 12 hafta; yarış / hedef tarihi girilirse kalan gün gösterilir."),
        ]),
    ]
    for title, rows in blocks:
        section(ws, r, title, 1, 2)
        r += 1
        for a, b in rows:
            put(ws, f"A{r}", a, "label")
            c = put(ws, f"B{r}", b, "base")
            c.border = BORDER
            ws.row_dimensions[r].height = 15 * max(1, math.ceil(len(b) / 105))
            r += 1
        r += 1
    put(ws, f"A{r}", "Bu sistem tıbbi teşhis, tedavi ya da diyetisyenlik hizmeti değildir. Sağlık sorunu ya da düzenli ilaç "
                     "kullanımı varsa başlamadan önce doktor onayı alınır.", "note", align=LEFT)
    ws.merge_cells(f"A{r}:B{r}")
    ws.row_dimensions[r].height = 28
    ws.sheet_properties.tabColor = NAVY
    ws.sheet_view.showGridLines = False


def sheet_profil(wb, ex):
    ws = wb.create_sheet("Profil")
    widths(ws, {"A": 34, "B": 22, "C": 16, "D": 14, "E": 14, "F": 14, "G": 60})
    put(ws, "A1", "PROFİL VE HEDEFLER", "title")
    put(ws, "A2", LEGEND + " Hedefler yalnızca bu sayfadan değişir.", "note")

    def row(r, label, kind="in", value=None, fmt=None, note=None):
        put(ws, f"A{r}", label, "label")
        put(ws, f"B{r}", value, kind, fmt)
        if note:
            put(ws, f"C{r}", note, "note", align=LEFT)
            ws.merge_cells(f"C{r}:G{r}")

    v = (lambda r: EX_PROFILE.get(r)) if ex else (lambda r: None)
    section(ws, 3, "DANIŞAN", 1, 7)
    row(4, "Ad soyad", value=v(4))
    row(5, "Cinsiyet", value=v(5), note="Yağ oranı formülü buna göre seçilir.")
    row(6, "Doğum tarihi", value=v(6), fmt="dd.mm.yyyy")
    row(7, "Yaş", "auto", '=IF(B6="","",INT((TODAY()-B6)/365.25))', "0")
    row(8, "Boy (cm)", value=v(8), fmt="0")
    row(9, "Meslek / günlük tempo", value=v(9))
    row(10, "Antrenman geçmişi", value=v(10))
    row(11, "Sakatlık / sağlık notu", value=v(11))
    row(12, "Alerji / yemediği besinler", value=v(12))
    row(13, "İletişim (WhatsApp)", value=v(13))
    list_dv(ws, '"Erkek,Kadın"', "B5")

    section(ws, 15, "HEDEF VE SÜREÇ", 1, 7)
    row(16, "Ana hedef", value=v(16))
    list_dv(ws, '"Yağ kaybı,Kas kazanımı,Koruma,Yarış hazırlığı"', "B16")
    row(17, "Başlangıç tarihi (pazartesi)", value=v(17), fmt="dd.mm.yyyy",
        note="1. haftanın pazartesisi. Bütün tarihler bundan üretilir.")
    row(18, "Başlangıç kilosu (kg)", value=v(18), fmt="0.0")
    row(19, "Hedef kilo (kg)", value=v(19), fmt="0.0", note="Boş bırakılabilir; o zaman yol haritası sınırsız ilerler.")
    row(20, "Haftalık hedef değişim (% vücut ağırlığı)", value=v(20), fmt="0.00%",
        note="Yağ kaybı için eksi (örn. -0,70%), kas kazanımı için artı (örn. 0,25%), koruma için 0. "
             "Kaynak: Helms vd. 2014, haftada %0,5-1 kayıp önerisi, doi:10.1186/1550-2783-11-20")
    ws.row_dimensions[20].height = 28
    row(21, "Hız toleransı (± puan)", value=v(21) if ex else 0.003, fmt="0.00%",
        note="Varsayım: hedefin ±0,30 puan çevresi \"Hedefte\" sayılır. Koç değiştirebilir.")
    row(22, "Yarış / hedef tarihi (isteğe bağlı)", value=v(22), fmt="dd.mm.yyyy")
    row(23, "Hedefe tahmini süre (hafta)", "auto",
        '=IF(OR(B18="",B19="",B20=0,B20=""),"",IFERROR(MAX(0,ROUNDUP(LN(B19/B18)/LN(1+B20),0)),""))', "0")

    section(ws, 25, "GÜNLÜK HEDEFLER", 1, 7)
    for i, h in enumerate(["Gün tipi", "Protein (g)", "Yağ (g)", "Karb (g)", "Kalori", "Adım"]):
        put(ws, f"{L(1 + i)}26", h, "head")
    for r, name in ((27, "Low"), (28, "High")):
        put(ws, f"A{r}", f"{name} day", "label")
        t = EX_TARGETS[name] if ex else (None, None, None, None)
        put(ws, f"B{r}", t[0], "in", "0")
        put(ws, f"C{r}", t[1], "in", "0")
        put(ws, f"D{r}", t[2], "in", "0")
        put(ws, f"E{r}", f'=IF(COUNT(B{r}:D{r})=3,4*B{r}+9*C{r}+4*D{r},"")', "auto", "#,##0")
        put(ws, f"F{r}", t[3], "in", "#,##0")
    put(ws, "G27", "Kalori = 4 × protein + 9 × yağ + 4 × karb.", "note")
    put(ws, "A29", "Haftalık ortalama kalori", "label")
    put(ws, "E29", '=IF(COUNT(E27:E28)=2,(E27*COUNTIF(B33:B39,"Low")+E28*COUNTIF(B33:B39,"High"))/7,"")',
        "auto", "#,##0")

    section(ws, 31, "HAFTALIK DÜZEN", 1, 7)
    for i, h in enumerate(["Gün", "Gün tipi", "Antrenman"]):
        put(ws, f"{L(1 + i)}32", h, "head")
    for i, d in enumerate(WEEKDAYS):
        r = 33 + i
        put(ws, f"A{r}", d, "label")
        put(ws, f"B{r}", EX_PATTERN[i][0] if ex else None, "in")
        put(ws, f"C{r}", EX_PATTERN[i][1] if ex else None, "in")
    list_dv(ws, '"Low,High"', "B33:B39")
    put(ws, "D33", "Gün tipi Günlük Takip'e otomatik gelir. Antrenman olmayan güne OFF yaz.", "note")
    ws.merge_cells("D33:G33")

    section(ws, 42, "DİĞER HEDEFLER", 1, 7)
    row(43, "Uyku hedefi (saat)", value=7, fmt="0.0", note="Varsayım: 7 saat. Koç değiştirebilir.")
    row(44, "Haftalık kardiyo hedefi (dk)", value=60 if ex else None, fmt="0")
    row(45, "Haftalık antrenman sayısı", "auto", '=COUNTA(C33:C39)-COUNTIF(C33:C39,"OFF")', "0")
    row(46, "Su hedefi (L / gün)", "auto", '=IF(B18="","",ROUND(B18*0.035,1))', "0.0",
        note="Kilo başına 35 ml (koçun 2.0 dosyalarındaki kural). Antrenman ve sıcak günlerde +0,5-1 L.")

    section(ws, 48, "KARAR MOTORU AYARLARI (koç varsayımları, değiştirilebilir)", 1, 7)
    row(49, "Kalori toleransı (± %)", value=0.05, fmt="0%", note="Günün kalorisi hedefin ±%5'i içindeyse \"uyumlu\" sayılır.")
    row(50, "Protein alt sınırı (hedefin %'si)", value=0.9, fmt="0%", note="Protein hedefin en az %90'ıysa uyumlu.")
    row(51, "Adım alt sınırı (hedefin %'si)", value=0.9, fmt="0%", note="Adım hedefin en az %90'ıysa uyumlu.")
    row(52, "Öneri için en düşük uyum skoru", value=0.8, fmt="0%",
        note="Uyum bunun altındaysa plan değişmez; önce uyum konuşulur.")
    row(53, "Öneri için en az kayıtlı gün", value=5, fmt="0", note="Haftada bundan az kilo kaydı varsa öneri üretilmez.")
    row(54, "Kalori ayar adımı (kcal)", value=100, fmt="0", note="Önerilen kalori değişikliğinin büyüklüğü.")
    row(55, "Adım ayar adımı", value=1000, fmt="#,##0", note="Önerilen adım artışının büyüklüğü.")
    ws.freeze_panes = "A3"
    ws.sheet_properties.tabColor = TEAL
    ws.sheet_view.showGridLines = False


def sheet_gunluk(wb, ex):
    ws = wb.create_sheet("Günlük Takip")
    put(ws, "A1", "GÜNLÜK TAKİP · 12 HAFTA", "title")
    put(ws, "A2", LEGEND + " Kilo: sabah, aç karnına. Kardiyo: dakika (yapılmadıysa 0). Puanlar 1-5.", "note")
    groups = [("A", "D", "Gün"), ("E", "E", "Vücut"), ("F", "H", "Uyku ve zihin"),
              ("I", "J", "Açlık ve sindirim"), ("K", "M", "Aktivite"), ("N", "Q", "Beslenme"),
              ("R", "V", "Hedefe uyum (otomatik)"), ("W", "W", "")]
    for a, b, t in groups:
        for col in range(ws[f"{a}4"].column, ws[f"{b}4"].column + 1):
            put(ws, f"{L(col)}4", None, "head")
        ws[f"{a}4"].value = t
        if a != b:
            ws.merge_cells(f"{a}4:{b}4")
    heads = ["Hafta", "Tarih", "Gün", "Gün tipi", "Kilo (kg)", "Uyku (saat)", "Stres (1-5)", "Enerji (1-5)",
             "Açlık (1-5)", "Sindirim (1-5)", "Antrenman", "Kardiyo (dk)", "Adım", "Protein (g)", "Yağ (g)",
             "Karb (g)", "Kalori", "Hedef kalori", "Kalori farkı", "Kalori", "Protein", "Adım", "Not"]
    for i, h in enumerate(heads):
        put(ws, f"{L(1 + i)}5", h, "head")
    ws.row_dimensions[5].height = 30
    flag = '[=1]"✓";[=0]"✗";General'
    for i in range(DAYS):
        r = G_FIRST + i
        put(ws, f"A{r}", i // 7 + 1, "auto", "0")
        put(ws, f"B{r}", f'=IF(Profil!$B$17="","",Profil!$B$17+{i})', "auto", "dd.mm.yyyy")
        put(ws, f"C{r}", f'=IF(B{r}="","",INDEX(Profil!$A$33:$A$39,WEEKDAY(B{r},2)))', "auto")
        put(ws, f"D{r}", f'=IF(B{r}="","",IF(INDEX(Profil!$B$33:$B$39,WEEKDAY(B{r},2))="","",'
                         f'INDEX(Profil!$B$33:$B$39,WEEKDAY(B{r},2))))', "auto")
        d = EX_DAYS[i] if ex and i < len(EX_DAYS) else [None] * 13
        for col, val, fmt in (("E", d[0], "0.0"), ("F", d[1], "0.0"), ("G", d[2], "0"), ("H", d[3], "0"),
                              ("I", d[4], "0"), ("J", d[5], "0"), ("K", d[6], None), ("L", d[7], "0"),
                              ("M", d[8], "#,##0"), ("N", d[9], "0"), ("O", d[10], "0"), ("P", d[11], "0")):
            put(ws, f"{col}{r}", val, "in", fmt)
        put(ws, f"Q{r}", f'=IF(COUNT(N{r}:P{r})=3,4*N{r}+9*O{r}+4*P{r},"")', "auto", "#,##0")
        put(ws, f"R{r}", f'=IF(D{r}="","",IF(D{r}="High",Profil!$E$28,Profil!$E$27))', "auto", "#,##0")
        put(ws, f"S{r}", f'=IF(OR(Q{r}="",R{r}=""),"",Q{r}-R{r})', "auto", "+#,##0;-#,##0;0")
        put(ws, f"T{r}", f'=IF(S{r}="","",IF(ABS(S{r})<=R{r}*Profil!$B$49,1,0))', "auto", flag)
        put(ws, f"U{r}", f'=IF(OR(N{r}="",D{r}=""),"",IF(N{r}>=IF(D{r}="High",Profil!$B$28,Profil!$B$27)'
                         f'*Profil!$B$50,1,0))', "auto", flag)
        put(ws, f"V{r}", f'=IF(OR(M{r}="",D{r}=""),"",IF(M{r}>=IF(D{r}="High",Profil!$F$28,Profil!$F$27)'
                         f'*Profil!$B$51,1,0))', "auto", flag)
        put(ws, f"W{r}", d[12] or None, "in", align=LEFT)
        if i % 7 == 0:
            for col in range(1, 24):
                c = ws.cell(row=r, column=col)
                c.border = Border(left=THIN, right=THIN, bottom=THIN, top=THICK)
    rng = f"T{G_FIRST}:V{G_LAST}"
    ws.conditional_formatting.add(rng, FormulaRule(formula=[f"T{G_FIRST}=1"], fill=FILL_OK))
    ws.conditional_formatting.add(rng, FormulaRule(formula=[f"T{G_FIRST}=0"], fill=FILL_BAD))
    num_dv(ws, f"G{G_FIRST}:J{G_LAST}", 1, 5)
    num_dv(ws, f"E{G_FIRST}:E{G_LAST}", 30, 250, whole=False)
    num_dv(ws, f"F{G_FIRST}:F{G_LAST}", 0, 24, whole=False)
    list_dv(ws, '"Yapıldı,Kaçtı,OFF"', f"K{G_FIRST}:K{G_LAST}")
    widths(ws, {"A": 7, "B": 11, "C": 11, "D": 9, "E,F,G,H,I,J": 9, "K": 11, "L,M,N,O,P,Q": 9,
                "R,S": 10, "T,U,V": 8, "W": 34})
    ws.freeze_panes = f"E{G_FIRST}"
    ws.sheet_properties.tabColor = "F59E0B"
    return ws


def sheet_ozet(wb, ex):
    ws = wb.create_sheet("Haftalık Özet")
    put(ws, "A1", "HAFTALIK ÖZET VE CHECK-IN", "title")
    put(ws, "A2", "Her şey Günlük Takip'ten gelir. Koç yalnızca sarı sütunları doldurur: karar ve notlar.", "note")
    heads = ["Hafta", "Hafta başı", "Kayıtlı gün", "Ort. kilo (kg)", "Değişim (kg)", "Değişim (%)", "Hız durumu",
             "Ort. uyku", "Ort. stres", "Ort. enerji", "Ort. açlık", "Ort. sindirim", "Antrenman (adet)",
             "Kardiyo (dk)", "Ort. adım", "Ort. protein", "Ort. yağ", "Ort. karb", "Ort. kalori",
             "Hedef kalori (ort.)", "Kalori uyumu", "Protein uyumu", "Adım uyumu", "Antrenman uyumu",
             "UYUM SKORU", "Otomatik öneri", "Toparlanma uyarısı", "Koç kararı", "Danışan check-in notu",
             "Koç notu"]
    for i, h in enumerate(heads):
        put(ws, f"{L(1 + i)}4", h, "head")
    ws.row_dimensions[4].height = 42

    def g(col):
        return f"{GT}!${col}${G_FIRST}:${col}${G_LAST}"

    def avg(col, r):
        return f'=IFERROR(AVERAGEIFS({g(col)},{g("A")},$A{r}),"")'

    P = "Profil!"
    for k in range(WEEKS):
        r = O_FIRST + k
        prev = f"{P}$B$18" if k == 0 else f"D{r - 1}"
        put(ws, f"A{r}", k + 1, "auto", "0")
        put(ws, f"B{r}", f'=IF({P}$B$17="","",{P}$B$17+{7 * k})', "auto", "dd.mm.yyyy")
        put(ws, f"C{r}", f'=COUNTIFS({g("A")},$A{r},{g("E")},">0")', "auto", "0")
        put(ws, f"D{r}", avg("E", r), "auto", "0.0")
        put(ws, f"E{r}", f'=IF(OR(D{r}="",{prev}=""),"",D{r}-{prev})', "auto", "+0.0;-0.0;0.0")
        put(ws, f"F{r}", f'=IF(E{r}="","",E{r}/{prev})', "auto", "+0.00%;-0.00%;0.00%")
        put(ws, f"G{r}",
            f'=IF(F{r}="","",IF({P}$B$20=0,IF(ABS(F{r})<={P}$B$21,"Hedefte",IF(F{r}>0,"Artıyor","Düşüyor")),'
            f'IF(F{r}*SIGN({P}$B$20)<ABS({P}$B$20)-{P}$B$21,"Yavaş",'
            f'IF(F{r}*SIGN({P}$B$20)>ABS({P}$B$20)+{P}$B$21,"Hızlı","Hedefte"))))', "auto")
        for col, src, fmt in (("H", "F", "0.0"), ("I", "G", "0.0"), ("J", "H", "0.0"), ("K", "I", "0.0"),
                              ("L", "J", "0.0"), ("O", "M", "#,##0"), ("P", "N", "0"), ("Q", "O", "0"),
                              ("R", "P", "0"), ("S", "Q", "#,##0")):
            put(ws, f"{col}{r}", avg(src, r), "auto", fmt)
        put(ws, f"M{r}", f'=IF($C{r}=0,"",COUNTIFS({g("A")},$A{r},{g("K")},"Yapıldı"))', "auto", "0")
        put(ws, f"N{r}", f'=IF($C{r}=0,"",SUMIFS({g("L")},{g("A")},$A{r}))', "auto", "0")
        put(ws, f"T{r}", f'=IFERROR(AVERAGEIFS({g("R")},{g("A")},$A{r},{g("Q")},">0"),"")', "auto", "#,##0")
        for col, src in (("U", "T"), ("V", "U"), ("W", "V")):
            put(ws, f"{col}{r}",
                f'=IFERROR(SUMIFS({g(src)},{g("A")},$A{r})/COUNTIFS({g("A")},$A{r},{g(src)},">=0"),"")',
                "auto", "0%")
        put(ws, f"X{r}", f'=IF(OR($C{r}=0,{P}$B$45=0),"",MIN(1,M{r}/{P}$B$45))', "auto", "0%")
        put(ws, f"Y{r}", f'=IF(COUNT(U{r}:X{r})=0,"",AVERAGE(U{r}:X{r}))', "auto", "0%")
        ws[f"Y{r}"].font = F_BOLD
        kc = f'{P}$B$54'
        put(ws, f"Z{r}",
            f'=IF($C{r}=0,"",IF($C{r}<{P}$B$53,"Veri eksik: en az "&{P}$B$53&" gün kilo kaydı gerekli",'
            f'IF(AND(Y{r}<>"",Y{r}<{P}$B$52),"Önce uyum: plan aynı kalsın, engeli konuş",'
            f'IF(G{r}="","Aynen devam (karşılaştırma için veri yok)",'
            f'IF(G{r}="Hedefte","Aynen devam",'
            f'IF(G{r}="Yavaş",IF(G{r - 1}="Yavaş",IF({P}$B$20<0,"Kaloriyi "&{kc}&" kcal düşür ya da adımı "&{P}$B$55&" artır",'
            f'"Kaloriyi "&{kc}&" kcal artır"),"Bir hafta daha izle (tek haftalık yavaşlama)"),'
            f'IF(G{r}="Hızlı",IF({P}$B$20<0,"Kaloriyi "&{kc}&" kcal artır (kas kaybı riski)",'
            f'"Kaloriyi "&{kc}&" kcal düşür (yağlanma riski)"),'
            f'IF(G{r}="Artıyor","Kaloriyi "&{kc}&" kcal düşür","Kaloriyi "&{kc}&" kcal artır"))))))))',
            "auto", align=LEFT)
        put(ws, f"AA{r}",
            f'=IF($C{r}=0,"",IF(OR(AND(J{r}<>"",J{r}<=2),AND(I{r}<>"",I{r}>=4),'
            f'AND(H{r}<>"",{P}$B$43<>"",H{r}<{P}$B$43-1)),"Toparlanmaya bak: uyku / stres / enerji",""))',
            "auto", align=LEFT)
        for col in ("AB", "AC", "AD"):
            put(ws, f"{col}{r}", None, "in", align=LEFT)
        ws.row_dimensions[r].height = 32
    if ex:
        ws["AB5"], ws["AC5"], ws["AD5"] = ("Aynen devam", "Açlık idare edilir, enerji iyi.",
                                            "İlk hafta su kaybı dahil; plan değişmedi.")
        ws["AB6"], ws["AC6"], ws["AD6"] = ("Aynen devam", "Perşembe iş yüzünden kaçtı, cumartesi telafi ettim.",
                                            "Yoğun günler için 30 dk'lık kısa seans alternatifi verildi.")
    text_flags(ws, f"G{O_FIRST}:G{O_LAST}", f"G{O_FIRST}")
    traffic(ws, f"U{O_FIRST}:Y{O_LAST}", f"U{O_FIRST}")
    ws.conditional_formatting.add(f"AA{O_FIRST}:AA{O_LAST}",
                                  FormulaRule(formula=[f'LEN(AA{O_FIRST})>0'], fill=FILL_WARN))
    put(ws, f"A{O_LAST + 2}",
        "Hız durumu: haftalık ortalama kilonun bir önceki haftaya göre % değişimi, Profil'deki hedef hız ± toleransla "
        "karşılaştırılır. Uyum skoru: kalori, protein, adım ve antrenman uyumunun ortalaması. Öneri yalnızca yeterli "
        "kayıt ve yeterli uyum varken üretilir; \"Yavaş\" durumu iki hafta üst üste görülmeden kalori değiştirilmez. "
        "Son karar her zaman koçundur.", "note", align=TOP)
    ws.merge_cells(f"A{O_LAST + 2}:Z{O_LAST + 2}")
    ws.row_dimensions[O_LAST + 2].height = 30
    widths(ws, {"A": 7, "B": 11, "C": 8, "D,E,F": 10, "G": 10, "H,I,J,K,L": 8, "M,N": 10, "O,P,Q,R,S": 9,
                "T": 10, "U,V,W,X": 10, "Y": 10, "Z": 38, "AA": 26, "AB": 24, "AC": 38, "AD": 38})
    ws.freeze_panes = f"C{O_FIRST}"
    ws.sheet_properties.tabColor = "F59E0B"
    return ws


def sheet_yol(wb, ex):
    ws = wb.create_sheet("Yol Haritası")
    put(ws, "A1", "YOL HARİTASI", "title")
    put(ws, "A2", "Hedef çizgisi Profil'deki başlangıç kilosu ve haftalık hızdan üretilir. Koç yalnızca protokol ve notu yazar.",
        "note")
    for i, h in enumerate(["Hafta", "Tarih", "Hedef kilo (kg)", "Gerçek ort. (kg)", "Fark (kg)",
                           "Gerçek toplam değişim (kg)", "Hedef toplam değişim (kg)", "Protokol", "Not"]):
        put(ws, f"{L(1 + i)}4", h, "head")
    ws.row_dimensions[4].height = 42
    P = "Profil!"
    for n in range(WEEKS + 1):
        r = 5 + n
        put(ws, f"A{r}", n, "auto", '0;;"Başl."')
        put(ws, f"B{r}", f'=IF({P}$B$17="","",{P}$B$17+{max(0, 7 * (n - 1))})', "auto", "dd.mm.yyyy")
        proj = f"{P}$B$18*(1+{P}$B$20)^{n}"
        put(ws, f"C{r}",
            f'=IF({P}$B$18="","",IF({P}$B$19="",{proj},IF({P}$B$20<0,MAX({P}$B$19,{proj}),'
            f'IF({P}$B$20>0,MIN({P}$B$19,{proj}),{P}$B$18))))', "auto", "0.0")
        if n == 0:
            put(ws, f"D{r}", f'=IF({P}$B$18="","",{P}$B$18)', "auto", "0.0")
        else:
            src = f"{OZ}!D{O_FIRST + n - 1}"
            put(ws, f"D{r}", f'=IF({src}="","",{src})', "auto", "0.0")
        put(ws, f"E{r}", f'=IF(OR(C{r}="",D{r}=""),"",D{r}-C{r})', "auto", "+0.0;-0.0;0.0")
        put(ws, f"F{r}", f'=IF(OR(D{r}="",{P}$B$18=""),"",D{r}-{P}$B$18)', "auto", "+0.0;-0.0;0.0")
        put(ws, f"G{r}", f'=IF(C{r}="","",C{r}-{P}$B$18)', "auto", "+0.0;-0.0;0.0")
        put(ws, f"H{r}", None, "in")
        put(ws, f"I{r}", None, "in", align=LEFT)
    if ex:
        ws["H6"], ws["H7"], ws["H8"] = "DÜŞÜŞ", "DÜŞÜŞ", "DÜŞÜŞ / KONTROL"
    list_dv(ws, '"DÜŞÜŞ,DÜŞÜŞ / KONTROL,KORUMA,DİYET MOLASI,YÜKSELİŞ,YARIŞ HAFTASI"', "H5:H17")
    put(ws, "A19", "\"Başl.\" satırı başlangıç kilosudur. Her haftanın gerçek değeri, o haftanın günlük kilolarının "
                   "ortalamasıdır (Haftalık Özet).", "note")
    ws.merge_cells("A19:I19")
    widths(ws, {"A": 8, "B": 12, "C,D,E": 12, "F,G": 14, "H": 20, "I": 44})
    ws.freeze_panes = "A5"
    ws.sheet_properties.tabColor = "F59E0B"
    return ws


def sheet_antrenman(wb, ex):
    ws = wb.create_sheet("Antrenman")
    put(ws, "A1", "ANTRENMAN PROGRAMI VE YÜK TAKİBİ", "title")
    put(ws, "A2", LEGEND + " Her hafta, o hareketteki en iyi setin kg ve tekrarını yaz.", "note")
    for i, h in enumerate(["Gün", "Hareket", "Set", "Tekrar min", "Tekrar maks", "RIR"]):
        put(ws, f"{L(1 + i)}4", None, "head")
        put(ws, f"{L(1 + i)}5", h, "head")
    ws["A4"].value = "Program (koç yazar)"
    ws.merge_cells("A4:F4")
    w0 = 7
    for w in range(WEEKS):
        c = w0 + 2 * w
        put(ws, f"{L(c)}4", f"Hafta {w + 1}", "head")
        put(ws, f"{L(c + 1)}4", None, "head")
        ws.merge_cells(f"{L(c)}4:{L(c + 1)}4")
        put(ws, f"{L(c)}5", "kg", "head")
        put(ws, f"{L(c + 1)}5", "Tekrar", "head")
        ws.column_dimensions[L(c)].width = 7
        ws.column_dimensions[L(c + 1)].width = 7
    last_c = w0 + 2 * WEEKS - 1                     # AD
    s = last_c + 1                                  # AE
    tail = ["Son hafta", "İlk hafta", "İlk kg", "Son kg", "Son tekrar", "Değişim (kg)",
            "Tahmini 1TM değişimi", "Öneri", "Not"]
    for i, h in enumerate(tail):
        put(ws, f"{L(s + i)}4", None, "head")
        put(ws, f"{L(s + i)}5", h, "head")
    ws[f"{L(s)}4"].value = "İlerleme (otomatik)"
    ws.merge_cells(f"{L(s)}4:{L(s + 7)}4")
    ws.row_dimensions[5].height = 30
    AE, AF, AG, AH, AI, AJ, AK, AL, AM = (L(s + i) for i in range(9))
    for r in range(EX_FIRST, EX_LAST + 1):
        i = r - EX_FIRST
        p = EX_PROGRAM[i] if ex and i < len(EX_PROGRAM) else None
        put(ws, f"A{r}", p[0] if p else None, "in", align=LEFT)
        put(ws, f"B{r}", p[1] if p else None, "in", align=LEFT)
        put(ws, f"C{r}", p[2] if p else None, "in", "0")
        put(ws, f"D{r}", p[3] if p else None, "in", "0")
        put(ws, f"E{r}", p[4] if p else None, "in", "0")
        put(ws, f"F{r}", p[5] if p else None, "in")
        for w in range(WEEKS):
            c = w0 + 2 * w
            kg = reps = None
            if p and (w < 2 or (w == 2 and i < 12)):
                # örnek: 1. hafta tekrar aralığının altı, sonra çift ilerleme
                kg, reps = p[6], p[3] + 1 + w * 1
                if reps > p[4]:
                    kg, reps = round(p[6] * 1.05 * 2) / 2, p[3]
            put(ws, f"{L(c)}{r}", kg, "in", "0.0")
            put(ws, f"{L(c + 1)}{r}", reps, "in", "0")
        rng = f"$G{r}:${L(last_c)}{r}"
        idx = f"((COLUMN({rng})-COLUMN($G{r}))/2+1)"
        mask = f"({rng}<>\"\")*(MOD(COLUMN({rng})-COLUMN($G{r}),2)=0)"
        put(ws, f"{AE}{r}", f"=SUMPRODUCT(MAX({mask}*{idx}))", "auto", "0;;")
        put(ws, f"{AF}{r}", f"=IF({AE}{r}=0,0,{WEEKS + 1}-SUMPRODUCT(MAX({mask}*({WEEKS + 1}-{idx}))))", "auto", "0;;")
        put(ws, f"{AG}{r}", f'=IF({AF}{r}=0,"",INDEX({rng},2*{AF}{r}-1))', "auto", "0.0")
        put(ws, f"{AH}{r}", f'=IF({AE}{r}=0,"",INDEX({rng},2*{AE}{r}-1))', "auto", "0.0")
        put(ws, f"{AI}{r}", f'=IF({AE}{r}=0,"",IF(INDEX({rng},2*{AE}{r})="","",INDEX({rng},2*{AE}{r})))', "auto", "0")
        put(ws, f"{AJ}{r}", f'=IF(OR({AE}{r}=0,{AE}{r}={AF}{r}),"",{AH}{r}-{AG}{r})', "auto", "+0.0;-0.0;0")
        put(ws, f"{AK}{r}",
            f'=IF(OR({AE}{r}=0,{AE}{r}={AF}{r}),"",IFERROR(({AH}{r}*(1+INDEX({rng},2*{AE}{r})/30))/'
            f'({AG}{r}*(1+INDEX({rng},2*{AF}{r})/30))-1,""))', "auto", "+0.0%;-0.0%;0.0%")
        put(ws, f"{AL}{r}",
            f'=IF(OR({AE}{r}=0,{AI}{r}="",E{r}=""),"",IF({AI}{r}>=E{r},"Kilo artır",'
            f'IF(AND(D{r}<>"",{AI}{r}<D{r}),"Kilo düşür","Tekrar ekle")))', "auto")
        put(ws, f"{AM}{r}", None, "in", align=LEFT)
    rng = f"{AL}{EX_FIRST}:{AL}{EX_LAST}"
    ws.conditional_formatting.add(rng, FormulaRule(formula=[f'{AL}{EX_FIRST}="Kilo artır"'], fill=FILL_OK))
    ws.conditional_formatting.add(rng, FormulaRule(formula=[f'{AL}{EX_FIRST}="Kilo düşür"'], fill=FILL_BAD))
    n = EX_LAST + 2
    put(ws, f"A{n}",
        "Çift ilerleme: son tekrar aralığın üst sınırına ulaştıysa kilo artır, aralığın altındaysa kilo düşür, arasındaysa "
        "aynı kiloda tekrar ekle. Tahmini 1TM: Epley formülü, kg × (1 + tekrar / 30); ilk ve son girilen hafta karşılaştırılır.",
        "note", align=TOP)
    ws.merge_cells(f"A{n}:{L(last_c)}{n}")
    ws.row_dimensions[n].height = 30
    widths(ws, {"A": 16, "B": 28, "C": 6, "D,E": 8, "F": 7, AE: 8, AF: 8, AG: 8, AH: 8, AI: 8, AJ: 10,
                AK: 12, AL: 14, AM: 30})
    ws.column_dimensions[AE].hidden = True
    ws.column_dimensions[AF].hidden = True
    ws.freeze_panes = f"C{EX_FIRST}"
    ws.sheet_properties.tabColor = "7C3AED"


def sheet_besinler(wb):
    ws = wb.create_sheet("Besinler")
    put(ws, "A1", "BESİN DEĞERLERİ", "title")
    put(ws, "A2", "Beslenme sayfası buradan okur. Yeni besini en alttaki sarı satırlara ekle. Değerler baz miktar içindir "
                  "(100 g / 100 ml ya da 1 adet). Kaynak: koçun 2.0 takip dosyalarındaki Beslenme sayfası değerleri.", "note")
    for i, h in enumerate(["Besin", "Baz miktar", "Birim", "Yağ (g)", "Karb (g)", "Protein (g)", "Kalori"]):
        put(ws, f"{L(1 + i)}3", h, "head")
    for i in range(FOOD_LAST - FOOD_FIRST + 1):
        r = FOOD_FIRST + i
        f = FOODS[i] if i < len(FOODS) else [None] * 6
        put(ws, f"A{r}", f[0], "in", align=LEFT)
        put(ws, f"B{r}", f[1], "in", "0")
        put(ws, f"C{r}", f[2], "in")
        for col, val in (("D", f[3]), ("E", f[4]), ("F", f[5])):
            put(ws, f"{col}{r}", val, "in", "0.0")
        put(ws, f"G{r}", f'=IF(COUNT(D{r}:F{r})=3,9*D{r}+4*E{r}+4*F{r},"")', "auto", "0")
    list_dv(ws, '"g,ml,adet"', f"C{FOOD_FIRST}:C{FOOD_LAST}")
    widths(ws, {"A": 32, "B": 11, "C": 8, "D,E,F,G": 11})
    ws.freeze_panes = "A4"
    ws.sheet_properties.tabColor = "16A34A"


def sheet_beslenme(wb, ex):
    ws = wb.create_sheet("Beslenme")
    put(ws, "A1", "ÖRNEK BESLENME PROGRAMI", "title")
    put(ws, "A2", LEGEND + " Besini listeden seç, miktarı yaz (g / ml ya da adet). Gramajlar pişmemiş ağırlıktır.", "note")
    food_rng = f"Besinler!$A${FOOD_FIRST}:$A${FOOD_LAST}"

    def look(col, b):
        return f"INDEX(Besinler!${col}${FOOD_FIRST}:${col}${FOOD_LAST},MATCH({b},{food_rng},0))"

    MEALS, ROWS = 4, 6
    for name, c0, trow in (("Low", 1, 27), ("High", 9, 28)):
        A, B, C, D, E, F, Gc = (L(c0 + i) for i in range(7))
        put(ws, f"{A}4", f'="{name.upper()} DAY · hedef "&IF(Profil!$E${trow}="","-",TEXT(Profil!$E${trow},"0"))&" kcal"',
            "sec")
        for col in (B, C, D, E, F, Gc):
            put(ws, f"{col}4", None, "sec")
        for i, h in enumerate(["Öğün", "Besin", "Miktar", "Yağ (g)", "Karb (g)", "Protein (g)", "Kalori"]):
            put(ws, f"{L(c0 + i)}5", h, "head")
        menu = EX_MENU[name] if ex else []
        totals = []
        for m in range(MEALS):
            top = 6 + m * (ROWS + 1)
            meal = menu[m] if m < len(menu) else (None, [])
            for j in range(ROWS):
                r = top + j
                item = meal[1][j] if j < len(meal[1]) else (None, None)
                put(ws, f"{A}{r}", meal[0] if j == 0 else None, "in", align=LEFT)
                put(ws, f"{B}{r}", item[0], "in", align=LEFT)
                put(ws, f"{C}{r}", item[1], "in")
                for col, src in ((D, "D"), (E, "E"), (F, "F")):
                    put(ws, f"{col}{r}",
                        f'=IF(OR({B}{r}="",{C}{r}=""),"",IFERROR({C}{r}/{look("B", f"{B}{r}")}*{look(src, f"{B}{r}")},""))',
                        "auto", "0.0")
                put(ws, f"{Gc}{r}", f'=IF(COUNT({D}{r}:{F}{r})=3,9*{D}{r}+4*{E}{r}+4*{F}{r},"")', "auto", "0")
            t = top + ROWS
            totals.append(t)
            put(ws, f"{A}{t}", "Öğün toplamı", "auto", align=LEFT)
            put(ws, f"{B}{t}", None, "auto")
            put(ws, f"{C}{t}", None, "auto")
            for col in (D, E, F, Gc):
                put(ws, f"{col}{t}", f"=SUM({col}{top}:{col}{t - 1})", "auto", "0")
                ws[f"{col}{t}"].font = F_BOLD
            ws[f"{A}{t}"].font = F_BOLD
        base = 6 + MEALS * (ROWS + 1) + 1          # 35
        for off, label in ((0, "Günlük toplam"), (1, "Hedef (Profil)"), (2, "Fark")):
            r = base + off
            put(ws, f"{A}{r}", label, "auto", align=LEFT)
            ws[f"{A}{r}"].font = F_BOLD
            put(ws, f"{B}{r}", None, "auto")
            put(ws, f"{C}{r}", None, "auto")
        for col, pcol in ((D, "C"), (E, "D"), (F, "B"), (Gc, "E")):
            put(ws, f"{col}{base}", "=" + "+".join(f"{col}{t}" for t in totals), "auto", "0")
            ws[f"{col}{base}"].font = F_BOLD
            put(ws, f"{col}{base + 1}", f'=IF(Profil!${pcol}${trow}="","",Profil!${pcol}${trow})', "auto", "0")
            put(ws, f"{col}{base + 2}", f'=IF({col}{base + 1}="","",{col}{base}-{col}{base + 1})', "auto",
                "+0;-0;0")
        g = f"{Gc}{base + 2}"
        ws.conditional_formatting.add(g, FormulaRule(
            formula=[f"AND(ISNUMBER({g}),ABS({g})<={Gc}{base + 1}*Profil!$B$49)"], fill=FILL_OK))
        ws.conditional_formatting.add(g, FormulaRule(
            formula=[f"AND(ISNUMBER({g}),ABS({g})>{Gc}{base + 1}*Profil!$B$49)"], fill=FILL_BAD))
        list_dv(ws, f"={food_rng}", f"{B}6:{B}{base - 2}")
        widths(ws, {A: 16, B: 30, C: 9, D: 9, E: 9, F: 10, Gc: 9})
    ws.column_dimensions["H"].width = 3
    put(ws, "A39", "Menü örnektir: yiyecekler değişebilir, günlük kalori ve protein hedefi sabit kalır. "
                   "Değişim kuralları Rehber sayfasında. Fark hücresi kalori toleransı içindeyse yeşil olur.", "note")
    ws.merge_cells("A39:O39")
    ws.freeze_panes = "A6"
    ws.sheet_properties.tabColor = "16A34A"


def sheet_olculer(wb, ex):
    ws = wb.create_sheet("Ölçüler")
    put(ws, "A1", "VÜCUT ÖLÇÜLERİ", "title")
    put(ws, "A2", LEGEND + " Haftada bir, pazartesi sabahı aç karnına. Mezurayı sıkmadan, her hafta aynı noktadan ölç.",
        "note")
    groups = [("A", "C", ""), ("D", "J", "Üst vücut (cm)"), ("K", "L", "Gövde (cm)"), ("M", "P", "Bacak (cm)"),
              ("Q", "U", "Otomatik hesaplanır"), ("V", "W", "")]
    for a, b, t in groups:
        for col in range(ws[f"{a}4"].column, ws[f"{b}4"].column + 1):
            put(ws, f"{L(col)}4", None, "head")
        ws[f"{a}4"].value = t
        if a != b:
            ws.merge_cells(f"{a}4:{b}4")
    heads = [("Hafta", ""), ("Tarih", ""), ("Kilo (hafta ort.)", "Haftalık Özet'ten gelir"),
             ("Boyun", "adem elmasının hemen altından"), ("Omuz", "iki omzun en geniş yerinden"),
             ("Göğüs", "meme ucu hizasından, nefes verince"),
             ("Kol (sağ)", "pazunun en kalın yerinden, kol gevşek"), ("Kol (sol)", "pazunun en kalın yerinden, kol gevşek"),
             ("Önkol (sağ)", "dirseğin altında en kalın yerinden"), ("Önkol (sol)", "dirseğin altında en kalın yerinden"),
             ("Bel", "göbek deliği hizasından"), ("Kalça", "en kalın yerinden"),
             ("Bacak (sağ)", "uyluğun en kalın yerinden"), ("Bacak (sol)", "uyluğun en kalın yerinden"),
             ("Calf (sağ)", "baldırın en kalın yerinden"), ("Calf (sol)", "baldırın en kalın yerinden"),
             ("Bel / kalça", ""), ("Bel / boy", "0,50 altı hedeflenir"), ("Bel farkı (cm)", "ilk ölçüme göre"),
             ("Tahmini yağ (%)", "±3 puan hata payı"), ("Yağsız kütle (kg)", ""), ("Fotoğraf", "çekildi mi?"),
             ("Not", "")]
    for i, (h, sub) in enumerate(heads):
        put(ws, f"{L(1 + i)}5", h, "head")
        c = put(ws, f"{L(1 + i)}6", sub or None, "note", align=CENTER)
        c.border = BORDER
    ws.row_dimensions[6].height = 40
    P = "Profil!"
    ex_rows = {0: (39.0, 118.0, 104.0, 37.0, 37.5, 29.0, 29.0, 94.0, 104.0, 60.0, 60.5, 38.5, 38.5, "Evet"),
               1: (39.0, 118.0, 103.5, 37.0, 37.5, 29.0, 29.0, 93.0, 103.5, 60.0, 60.0, 38.5, 38.5, "Evet"),
               2: (38.5, 118.0, 103.5, 37.0, 37.5, 29.0, 29.0, 92.0, 103.0, 59.5, 60.0, 38.5, 38.5, "Evet")}
    first = 7
    for n in range(WEEKS + 1):
        r = first + n
        put(ws, f"A{r}", n, "auto", '0;;"Başl."')
        put(ws, f"B{r}", f'=IF({P}$B$17="","",{P}$B$17+{7 * n})', "auto", "dd.mm.yyyy")
        if n == 0:
            put(ws, f"C{r}", f'=IF({P}$B$18="","",{P}$B$18)', "auto", "0.0")
        else:
            src = f"{OZ}!D{O_FIRST + n - 1}"
            put(ws, f"C{r}", f'=IF({src}="","",{src})', "auto", "0.0")
        vals = ex_rows.get(n) if ex else None
        for j, col in enumerate("DEFGHIJKLMNOP"):
            put(ws, f"{col}{r}", vals[j] if vals else None, "in", "0.0")
        put(ws, f"Q{r}", f'=IF(OR(K{r}="",L{r}=""),"",K{r}/L{r})', "auto", "0.00")
        put(ws, f"R{r}", f'=IF(OR(K{r}="",{P}$B$8=""),"",K{r}/{P}$B$8)', "auto", "0.00")
        put(ws, f"S{r}", f'=IF(OR(K{r}="",$K${first}=""),"",K{r}-$K${first})', "auto", "+0.0;-0.0;0.0")
        put(ws, f"T{r}",
            f'=IF(OR(K{r}="",C{r}=""),"",IF({P}$B$5="Kadın",-9.15-0.015*(C{r}*2.20462)+1.27*(K{r}/2.54),'
            f'-26.97-0.12*(C{r}*2.20462)+1.99*(K{r}/2.54)))', "auto", "0.0")
        put(ws, f"U{r}", f'=IF(T{r}="","",C{r}*(1-T{r}/100))', "auto", "0.0")
        put(ws, f"V{r}", vals[13] if vals else None, "in")
        put(ws, f"W{r}", None, "in", align=LEFT)
    list_dv(ws, '"Evet,Hayır"', f"V{first}:V{first + WEEKS}")
    n = first + WEEKS + 2
    put(ws, f"A{n}",
        "\"Başl.\" satırı başlangıç ölçüsüdür (1. haftanın pazartesisi); sonraki satırlar izleyen pazartesilerdir ve o gün "
        "biten haftanın ortalama kilosunu kullanır. Tahmini yağ: ABD Ordusu 2023 tek nokta formülü (Army Directive 2023-11): "
        "erkek %yağ = -26,97 - 0,12 × kilo(lb) + 1,99 × bel(inç); kadın %yağ = -9,15 - 0,015 × kilo(lb) + 1,27 × bel(inç). "
        "Mutlak değerden çok haftalık yönüne bak.", "note", align=TOP)
    ws.merge_cells(f"A{n}:W{n}")
    ws.row_dimensions[n].height = 42
    widths(ws, {"A": 7, "B": 11, "C": 12, "D,E,F,G,H,I,J,K,L,M,N,O,P": 11, "Q,R,S,T,U": 11, "V": 10, "W": 34})
    ws.freeze_panes = f"D{first}"
    ws.sheet_properties.tabColor = "7C3AED"


def sheet_rehber(wb):
    ws = wb.create_sheet("Rehber")
    widths(ws, {"A": 40, "B": 26, "C": 78})
    put(ws, "A1", "REHBER", "title")
    put(ws, "A2", "Danışanın bilmesi gereken kurallar. Sayılar kişiye özel değildir; hedefler için Profil'e bak.", "note")
    r = [4]

    def sec(t):
        section(ws, r[0], t, 1, 3)
        r[0] += 1

    def bullets(items):
        for t in items:
            c = put(ws, f"A{r[0]}", "• " + t, "base", align=TOP)
            ws.merge_cells(f"A{r[0]}:C{r[0]}")
            ws.row_dimensions[r[0]].height = 14 * max(1, math.ceil(len(t) / 135))
            r[0] += 1
        r[0] += 1

    def table(head, rows):
        for i, h in enumerate(head):
            put(ws, f"{L(1 + i)}{r[0]}", h, "head")
        r[0] += 1
        for row in rows:
            if len(row) == 1:
                for i in range(3):
                    put(ws, f"{L(1 + i)}{r[0]}", None, "auto")
                ws[f"A{r[0]}"].value = row[0]
                ws[f"A{r[0]}"].font = F_BOLD
                ws[f"A{r[0]}"].alignment = LEFT
            else:
                for i, v in enumerate(row):
                    c = put(ws, f"{L(1 + i)}{r[0]}", v, "base")
                    c.border = BORDER
                ws.row_dimensions[r[0]].height = 14 * max(1, math.ceil(len(row[2]) / 80))
            r[0] += 1
        r[0] += 1

    sec("ESNEK BESLENME MANTIĞI")
    bullets([
        "Yasak yiyecek yok. Önemli olan günün sonunda kalorinin ve proteinin hedefe uyması.",
        "Öncelik sırası: 1) Kalori  2) Protein  3) Yağ / karbonhidrat dengesi. Hangi yiyecekten geldiği bunlardan sonra gelir.",
        "80/20 kuralı: günlük kalorinin yaklaşık %80'i temel besinlerden (tavuk, et, balık, yumurta, pirinç, yulaf, sebze, "
        "meyve), %20'si canının istediğinden gelebilir.",
        "Tatlı, fast food gibi şeyler de yenebilir; yeter ki tartılıp uygulamaya girilsin ve günlük kaloriye sığdırılsın.",
        "Bir gün hedef kaçarsa telafi için aç kalma; ertesi gün normal plana dön. Sonucu belirleyen haftalık ortalama.",
    ])
    sec("DEĞİŞİM KURALLARI")
    bullets([
        "Menüdeki öğünler örnektir. Yiyecekler değişebilir ama günlük kalori (Low / High day) ve protein hedefi sabit kalır.",
        "Gramajlar pişmemiş (kuru / çiğ) ağırlıktır. Pirinç ve makarna pişince yaklaşık 3 katına çıkar (100 g kuru ≈ 300 g pişmiş).",
        "Karbonhidrat değişimi gramla değil karbonhidrat miktarıyla yapılır: 100 g kuru pirinç ≈ 100 g kuru makarna ≈ 140 g ekmek "
        "≈ 450 g haşlanmış patates.",
        "Protein kaynağı değişebilir (hindi, ton balığı, balık, yağsız kıyma). Kırmızı et ve somon daha yağlıdır; aynı gramda "
        "50-120 kcal fazla gelir, gramajı azalt ya da yağsız parça seç.",
        "Yağ ↔ karbonhidrat: 1 g yağ 9 kcal, 1 g karb 4 kcal. Yağı 10 g artırırsan karbı yaklaşık 22 g azalt. Protein bu değişimin "
        "dışında kalır.",
        "Yağlar az görünür ama kalorisi yüksektir; göz kararı değil, tartıp ekle. Zeytinyağı yerine tereyağı olur (5 g ≈ 36 kcal).",
        "Öğün sayısı 2-3-4 olabilir (tercihen 3). İştah yoksa 2 öğün de olur; önemli olan günlük toplam.",
        "Sebze ve yeşillik bol yenebilir; ama içine giren yağ, sos ve peynir hesaba katılmalı.",
    ])
    sec("ÖĞÜN SAATLERİ")
    bullets([
        "3 öğün (menüdeki gibi): 11:00 · 16:00 · 20:00.",
        "Antrenman akşamsa (örn. 18:00): 11:00 kahvaltı · 15:30 antrenman öncesi (karbonhidrat + protein) · 20:00 antrenman sonrası.",
        "Antrenman sabahsa (örn. 09:00): 08:00 hafif öğün (yulaf, yumurta) · 11:00 antrenman sonrası · 16:00 · 20:00 (4 öğün).",
        "Antrenmandan 1,5-3 saat önce bir öğün, sonrasında 1-2 saat içinde protein ağırlıklı bir öğün olsun.",
        "Son öğün yatmadan 2-3 saat önce bitsin; saatler esnek, önemli olan günlük toplam ve düzen.",
    ])
    sec("SU VE TUZ DENGESİ")
    bullets([
        "Su: günde kilo başına yaklaşık 35 ml (kişisel hedef Profil'de). Antrenman ve sıcak günlerde +0,5-1 L ekle.",
        "Suyu güne yay: sabah kalkınca 1 bardak, her öğünde 1-2 bardak, antrenmanda 500-750 ml. İdrar açık sarıysa yeterli.",
        "Tuz: günde yaklaşık 5-6 g (1 çay kaşığı). Tuzu tamamen kesme; terle kaybedilir ve antrenman performansı için gerekir.",
        "Tuzu her gün benzer tut. Çok tuzlu bir öğünden sonra tartı 0,5-1 kg artış gösterebilir; bu yağ değil su, 1-2 günde iner.",
        "Hazır gıda, turşu, şarküteri, soslar ve fast food gizli tuz kaynağıdır; bunların olduğu gün ekstra tuz ekleme.",
        "Sebze, meyve, patates ve yoğurt potasyum sağlar; tuz ve su dengesine yardımcı olur.",
    ])
    sec("İÇECEKLER")
    table(["İçecek", "Kalori (yaklaşık)", "Not"], [
        ("SIFIR / ÇOK DÜŞÜK KALORİ (serbest)",),
        ("Su", "0", "Temel içecek."),
        ("Maden suyu (sade), sade soda", "0", "Sodyum içerir; günde 1-2 şişe yeterli. Gazlı içecek isteğini karşılar."),
        ("Limonlu / naneli / salatalıklı su", "0-5", "Şeker ya da bal eklemeden."),
        ("Siyah çay, yeşil çay (şekersiz)", "~2 / bardak", "Kafein içerir; akşam geç saatte azalt."),
        ("Bitki çayları", "0-5 / bardak", "Ihlamur, adaçayı, papatya, rezene, kuşburnu; akşam için kafeinsiz."),
        ("Türk kahvesi, filtre kahve, espresso (sade)", "~2-10", "Günde en fazla 3-4 fincan; yatmadan 6 saat önce son kahve."),
        ("Sıfır şekerli gazlı içecek (zero)", "0-2 / kutu", "Tatlandırıcılı; günde en fazla 1-2 kutu."),
        ("DÜŞÜK KALORİ (hesaba kat, uygulamaya gir)",),
        ("Ayran (200 ml)", "~70-80", "Protein + tuz; antrenman sonrası iyi."),
        ("Kefir, sade (200 ml)", "~90-110", "Bağırsak dostu; kahvaltıya uygun."),
        ("Light süt (200 ml)", "~90", "Kahveye ya da çaya eklenirse hesapla."),
        ("Şekersiz badem sütü (200 ml)", "~30-40", "Proteini düşük; kalori tasarrufu."),
        ("Şalgam (200 ml)", "~15-25", "Çok tuzlu; tuzlu günlerde azalt."),
        ("Protein shake (su ile, 1 ölçek)", "~110-130", "Protein hedefini tamamlamak için; makrolara ekle."),
        ("UZAK DUR / DİKKAT",),
        ("Meyve suyu (taze sıkma dahil)", "~90-120 / bardak", "Şekeri yüksek, tok tutmaz; meyvenin kendisini ye."),
        ("Şekerli gazlı içecek, ice tea, enerji içeceği", "~100-150 / kutu", "Boş kalori; zero versiyonunu seç."),
        ("Hazır frappe, mocha, şuruplu kahve", "~200-400+", "Bir öğün kadar kalori."),
        ("Alkol (bira, şarap, rakı)", "bira ~150 / şarap ~120", "Yağ yakımını yavaşlatır, uykuyu bozar."),
    ])
    sec("SUPPLEMENT ÖNERİSİ VE KULLANIM ZAMANI")
    table(["Supplement", "Doz", "Ne zaman / Not"], [
        ("Kreatin monohidrat", "3-5 g / gün", "Her gün, saat fark etmez; yükleme gerekmez."),
        ("Whey protein", "1 ölçek (~25 g P)", "Protein eksik kalırsa; antrenman sonrası ya da ara öğün."),
        ("Kafein", "150-250 mg", "Antrenmandan 30-60 dk önce; 16:00'dan sonra alma."),
        ("D3 vitamini", "1000-2000 IU / gün", "Kahvaltı ya da öğlen, yağ içeren bir öğünle."),
        ("Omega-3 (balık yağı)", "1-2 g EPA+DHA", "Öğünle birlikte; balık yenen günler atlanabilir."),
        ("Magnezyum (glisinat)", "200-400 mg", "Akşam, yatmadan 30-60 dk önce; uyku ve kramp için."),
        ("Lif / psyllium (isteğe bağlı)", "5-10 g / gün", "Bol suyla; tokluk ve kabızlık için."),
        ("Elektrolit (isteğe bağlı)", "1 servis", "Çok terlenen antrenman ya da sıcak günlerde."),
        ("Multivitamin (isteğe bağlı)", "1 tablet", "Kahvaltıda; sebze-meyve az yenen dönemlerde."),
        ("YALNIZCA EKSİKLİKTE (kan tahliline göre)",),
        ("Demir", "doktorun dozu", "Tahlil düşükse; C vitaminiyle, çay-kahveden uzak."),
        ("B12 vitamini", "250-1000 mcg", "Vejetaryen / vegan ise ya da tahlil düşükse."),
        ("Çinko", "10-25 mg", "Tahlil düşükse; uzun süre yüksek doz zararlı."),
        ("GEREK YOK / PARA HARCAMA",),
        ("BCAA / EAA", "-", "Günlük protein hedefine ulaşılıyorsa ek faydası yok."),
        ("Yağ yakıcı, detoks çayı, L-karnitin, CLA", "-", "Kilo kaybına anlamlı bir katkısı yok."),
        ("Glutamin, HMB, testosteron artırıcılar", "-", "Ölçülebilir bir etkisi yok."),
        ("Pre-workout ürünleri", "-", "Çoğu kafein + dolgu; kahve aynı işi görür. Alırsan kafein dozuna bak."),
    ])
    bullets([
        "Supplementler destektir; önce kalori, protein, uyku ve adım.",
        "Sağlık sorunu varsa ya da düzenli ilaç kullanılıyorsa başlamadan önce doktora danış.",
        "Yarışmaya girilecekse yalnızca Informed Sport / NSF Certified for Sport sertifikalı ürün kullan.",
    ])
    sec("ANTRENMAN KURALLARI")
    table(["Değişken", "Programlarda kullanılan", "Güncel araştırma"], [
        ("Haftalık hacim", "Kas başına 10-20 zorlu set",
         "Hacim arttıkça kazanç artar ama azalarak; net tavan yok, dolaylı set yarım sayılır."),
        ("Sıklık", "Kas başına haftada 2 kez", "Hacim eşitken sıklığın hipertrofiye etkisi önemsiz, kuvvete etkisi var."),
        ("Seans başına set", "Kas başına en fazla ~10 set", "Doğrudan test eden veri az; makul pratik sınır."),
        ("Tükenişe yakınlık", "1-3 RIR, son izole sette 0-1 RIR", "0-5 RIR aralığında tükenişe yaklaştıkça hipertrofi artıyor."),
        ("Tekrar", "Bileşik 6-10, izole 10-20", "5-35 tekrar aralığı işe yarar."),
        ("Dinlenme", "Bileşik 2-3 dk, izole 1-2 dk", "60 sn üstü yeterli görünüyor; performans düşmeyecek kadar dinlen."),
    ])
    bullets([
        "RIR: setin sonunda yedekte kalan tekrar sayısı. Önce tekrar, sonra ağırlık artırarak kademeli yüklen; öncelikli kası "
        "seansın başına koy.",
        "Haftalık hacim eşitse split ile full body arasında kas büyümesi farkı yok; gün sayısını sürdürebileceğin takvime göre seç.",
        "Ağrı ya da rahatsızlık hissedersen antrenmanı bırak ve koçuna bildir.",
        "Kaynaklar: Ramos-Campo vd. 2024 (doi:10.1519/JSC.0000000000004774) · Pelland vd. 2025 (doi:10.1007/s40279-025-02344-w) · "
        "Evangelista vd. 2021 (doi:10.31744/einstein_journal/2021AO5781) · Schoenfeld vd. 2015 (doi:10.1519/JSC.0000000000000970) · "
        "Çiftci 2021, Vücut Geliştirmede Maksimal Hipertrofi.",
    ])
    ws.sheet_properties.tabColor = "64748B"
    ws.sheet_view.showGridLines = False


def sheet_panel(wb, gs, ozs, yhs):
    ws = wb.create_sheet("Panel")
    widths(ws, {"A": 30, "B": 40, "C": 3})
    put(ws, "A1", "KOÇLUK SİSTEMİ 3.0 · PANEL", "title")
    put(ws, "A2", "Bu sayfada hiçbir şey yazılmaz; her şey diğer sayfalardan gelir.", "note")
    P = "Profil!"

    def oz(col, text=False):
        rng = f"{OZ}!${col}${O_FIRST}:${col}${O_LAST}"
        return f'=IF($B$7=0,"",INDEX({rng},$B$7){"&\"\"" if text else ""})'

    rows = [
        (3, "DANIŞAN", None, None),
        (4, "Danışan", f'=IF({P}B4="","",{P}B4)', None),
        (5, "Ana hedef", f'=IF({P}B16="","",{P}B16)', None),
        (6, "Başlangıç tarihi", f'=IF({P}B17="","",{P}B17)', "dd.mm.yyyy"),
        (7, "Değerlendirilen hafta (son tamamlanan)",
         f"=IF(SUMPRODUCT(MAX(({OZ}!$C${O_FIRST}:$C${O_LAST}>={P}$B$53)*{OZ}!$A${O_FIRST}:$A${O_LAST}))>0,"
         f"SUMPRODUCT(MAX(({OZ}!$C${O_FIRST}:$C${O_LAST}>={P}$B$53)*{OZ}!$A${O_FIRST}:$A${O_LAST})),"
         f"SUMPRODUCT(MAX(({OZ}!$C${O_FIRST}:$C${O_LAST}>0)*{OZ}!$A${O_FIRST}:$A${O_LAST})))",
         '0;;"-"'),
        (8, "Yarış / hedef tarihine kalan gün", f'=IF({P}B22="","",{P}B22-TODAY())', "0"),
        (10, "KİLO", None, None),
        (11, "Başlangıç kilosu (kg)", f'=IF({P}B18="","",{P}B18)', "0.0"),
        (12, "Haftalık ortalama kilo (kg)", oz("D"), "0.0"),
        (13, "Toplam değişim (kg)", '=IF(OR(B11="",B12=""),"",B12-B11)', "+0.0;-0.0;0.0"),
        (14, "Toplam değişim (%)", '=IF(B13="","",B13/B11)', "+0.0%;-0.0%;0.0%"),
        (15, "Hedef kilo (kg)", f'=IF({P}B19="","",{P}B19)', "0.0"),
        (16, "Hedefe kalan (kg)", '=IF(OR(B12="",B15=""),"",B15-B12)', "+0.0;-0.0;0.0"),
        (17, "Haftalık değişim (%)", oz("F"), "+0.00%;-0.00%;0.00%"),
        (18, "Hız durumu", oz("G", True), None),
        (20, "DEĞERLENDİRİLEN HAFTA · UYUM VE TOPARLANMA", None, None),
        (21, "UYUM SKORU", oz("Y"), "0%"),
        (22, "Kalori uyumu", oz("U"), "0%"),
        (23, "Protein uyumu", oz("V"), "0%"),
        (24, "Adım uyumu", oz("W"), "0%"),
        (25, "Antrenman uyumu", oz("X"), "0%"),
        (26, "Ort. kalori", oz("S"), "#,##0"),
        (27, "Hedef kalori (ort.)", oz("T"), "#,##0"),
        (28, "Ort. uyku (saat)", oz("H"), "0.0"),
        (29, "Ort. stres (1-5)", oz("I"), "0.0"),
        (30, "Ort. enerji (1-5)", oz("J"), "0.0"),
        (32, "KARAR", None, None),
        (33, "Otomatik öneri", oz("Z", True), None),
        (34, "Toparlanma uyarısı", oz("AA", True), None),
        (35, "Koç kararı", oz("AB", True), None),
    ]
    for r, label, f, fmt in rows:
        if f is None:
            section(ws, r, label, 1, 2)
            continue
        put(ws, f"A{r}", label, "label")
        put(ws, f"B{r}", f, "auto", fmt)
    for r in (21, 33):
        ws[f"B{r}"].font = Font(name="Arial", size=12, bold=True)
    for r in (33, 34, 35):
        ws.row_dimensions[r].height = 32
    traffic(ws, "B21:B25", "B21")
    text_flags(ws, "B18", "B18")
    ws.conditional_formatting.add("B34", FormulaRule(formula=["LEN(B34)>0"], fill=FILL_WARN))

    lc = LineChart()
    lc.add_data(Reference(gs, min_col=5, min_row=5, max_row=G_LAST), titles_from_data=True)
    lc.set_categories(Reference(gs, min_col=2, min_row=G_FIRST, max_row=G_LAST))
    chart_base(lc, "Günlük kilo (kg)")
    lc.display_blanks = "gap"
    lc.legend = None
    lc.x_axis.number_format = "dd.mm"
    lc.x_axis.tickLblSkip = 7
    lc.y_axis.number_format = "0.0"
    ws.add_chart(lc, "D3")

    bc = BarChart()
    bc.add_data(Reference(yhs, min_col=6, min_row=4, max_row=5 + WEEKS), titles_from_data=True)
    bc.set_categories(Reference(yhs, min_col=1, min_row=5, max_row=5 + WEEKS))
    l2 = LineChart()
    l2.add_data(Reference(yhs, min_col=7, min_row=4, max_row=5 + WEEKS), titles_from_data=True)
    chart_base(bc, "Toplam değişim: gerçek ve hedef (kg)")
    bc.x_axis.title = "Hafta"
    bc.x_axis.title.overlay = False
    bc.x_axis.tickLblPos = "low"
    bc += l2
    ws.add_chart(bc, "D19")

    uc = BarChart()
    uc.add_data(Reference(ozs, min_col=25, min_row=4, max_row=O_LAST), titles_from_data=True)
    uc.set_categories(Reference(ozs, min_col=1, min_row=O_FIRST, max_row=O_LAST))
    chart_base(uc, "Haftalık uyum skoru")
    uc.legend = None
    uc.y_axis.scaling.min, uc.y_axis.scaling.max = 0, 1
    uc.y_axis.number_format = "0%"
    uc.x_axis.title = "Hafta"
    uc.x_axis.title.overlay = False
    ws.add_chart(uc, "D35")
    ws.sheet_properties.tabColor = NAVY
    ws.sheet_view.showGridLines = False


def build(ex, path):
    wb = Workbook()
    wb.remove(wb.active)
    sheet_kilavuz(wb)
    sheet_profil(wb, ex)
    gs = sheet_gunluk(wb, ex)
    ozs = sheet_ozet(wb, ex)
    yhs = sheet_yol(wb, ex)
    sheet_antrenman(wb, ex)
    sheet_beslenme(wb, ex)
    sheet_olculer(wb, ex)
    sheet_besinler(wb)
    sheet_rehber(wb)
    sheet_panel(wb, gs, ozs, yhs)
    wb.move_sheet("Panel", offset=-(len(wb.sheetnames) - 2))   # Kılavuz'dan sonra
    for ws in wb.worksheets:                                   # yazdırma: sayfa genişliğine sığdır
        ws.sheet_properties.pageSetUpPr = PageSetupProperties(fitToPage=True)
        ws.page_setup.fitToWidth, ws.page_setup.fitToHeight = 1, 0
        ws.page_setup.orientation = "landscape"
        ws.page_setup.paperSize = ws.PAPERSIZE_A4
    wb.active = 1 if ex else 0
    wb.save(path)
    return path


if __name__ == "__main__":
    print(build(False, os.path.join(HERE, "Koçluk Sistemi 3.0 - Şablon.xlsx")))
    print(build(True, os.path.join(HERE, "Koçluk Sistemi 3.0 - Örnek.xlsx")))
