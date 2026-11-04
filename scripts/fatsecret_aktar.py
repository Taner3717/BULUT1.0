#!/usr/bin/env python3
"""FatSecret "Food Diary Report - Detailed Report" PDF'ini Bulut'a aktarılabilir JSON'a çevirir.

Kullanım:
    pdftotext -layout FoodDiary.pdf diary.txt     # poppler-utils
    python3 scripts/fatsecret_aktar.py diary.txt src/data/kisisel/fatsecret.json

Çıktı:
    besinler: her yiyecek için 100 g/ml (ya da 1 porsiyon) başına değerler, kullanım sayısı
    kayitlar: günlükteki her satır (tarih, öğün, yiyecek, miktar, değerler)

PDF'te boş hücreler metne dönüşünce kaybolduğu için değerler sütun başlıklarının
konumuna göre eşleştirilir. Her günün kalori toplamı PDF'teki toplamla karşılaştırılır.
"""
import json
import re
import statistics
import sys
from collections import defaultdict

SUTUNLAR = ['kcal', 'yag', 'doymus', 'karb', 'lif', 'seker', 'protein', 'sodyum', 'kolesterol', 'potasyum']
BASLIKLAR = ['Kal', 'Yağ', 'Doy. Yağ', 'Karb', 'Fiber', 'Şeker', 'Prot', 'Sod', 'Kolest', 'Potas']
OGUNLER = {'Kahvaltı': 'Kahvaltı', 'Öğle Yemeği': 'Öğle', 'Akşam Yemeği': 'Akşam', 'Aperatifler/Diğer': 'Ara öğün'}
AYLAR = {'Ocak': 1, 'Şubat': 2, 'Mart': 3, 'Nisan': 4, 'Mayıs': 5, 'Haziran': 6, 'Temmuz': 7, 'Ağustos': 8,
         'Eylül': 9, 'Ekim': 10, 'Kasım': 11, 'Aralık': 12}
GUN = re.compile(r'^\s*(?:Pazartesi|Salı|Çarşamba|Perşembe|Cuma|Cumartesi|Pazar), (\S+) (\d+), (\d{4})')
SAYI = re.compile(r'-?\d+(?:[.,]\d+)?')
MIKTAR = re.compile(r'^([\d.,/]+)\s*(.*)$')


def sayi(t: str) -> float:
    return float(t.replace('.', '').replace(',', '.')) if ',' in t else float(t)


def miktar_oku(t: str) -> float:
    if '/' in t:
        a, b = t.split('/', 1)
        return sayi(a) / sayi(b)
    return sayi(t)


def gram_bul(miktar: float, birim: str):
    """('g' | 'ml' | None, miktar) — porsiyon açıklamasında '(40 g)' varsa grama çevirir."""
    if birim in ('g', 'ml'):
        return birim, miktar
    m = re.search(r'\((\d+(?:[.,]\d+)?)\s*(g|ml)\)', birim)
    if m:
        return m.group(2), miktar * sayi(m.group(1))
    return None, miktar


def ayristir(satirlar):
    kayitlar, gun_toplamlari = [], {}
    merkezler, tarih, ogun = None, None, None
    i = 0
    while i < len(satirlar):
        L = satirlar[i]
        s = L.strip()
        m = GUN.match(L)
        if m:
            yeni = f'{m.group(3)}-{AYLAR[m.group(1)]:02d}-{int(m.group(2)):02d}'
            if yeni != tarih:
                tarih, ogun = yeni, None
            i += 1
            continue
        if 'Kal' in L and 'Potas' in L and 'Prot' in L:
            merkezler = [L.index(h) + len(h) / 2 for h in BASLIKLAR]
            i += 1
            continue
        if s in OGUNLER:
            ogun = OGUNLER[s]
            i += 1
            continue
        if not merkezler or not s or s.startswith(('Sayfa', 'Food Diary', '(kcal)')):
            i += 1
            continue
        tokenlar = [t for t in SAYI.finditer(L) if t.start() >= merkezler[0] - 8]
        if s.startswith('Toplam'):
            if tokenlar and tarih:
                gun_toplamlari[tarih] = sayi(tokenlar[0].group())  # günün son Toplam'ı = gün toplamı
            i += 1
            continue
        sonraki = satirlar[i + 1].strip() if i + 1 < len(satirlar) else ''
        mm = MIKTAR.match(sonraki)
        if tokenlar and mm and tarih and ogun:
            ad = L[: tokenlar[0].start()].strip()
            degerler = {}
            for t in tokenlar:
                c = (t.start() + t.end()) / 2
                k = min(range(len(merkezler)), key=lambda j: abs(merkezler[j] - c))
                degerler[SUTUNLAR[k]] = sayi(t.group())
            birim_metin = mm.group(2).strip()
            miktar = miktar_oku(mm.group(1))
            birim, olcu = gram_bul(miktar, birim_metin)
            kayitlar.append({
                'tarih': tarih, 'ogun': ogun, 'ad': ad,
                'miktar': miktar, 'birim_metin': birim_metin, 'birim': birim, 'olcu': olcu,
                **degerler,
            })
            i += 2
            continue
        i += 1
    return kayitlar, gun_toplamlari


def besinler_cikar(kayitlar):
    gruplar = defaultdict(list)
    for k in kayitlar:
        anahtar = (k['ad'], k['birim'] or 'porsiyon:' + k['birim_metin'])
        gruplar[anahtar].append(k)
    besinler = []
    for (ad, tur), liste in gruplar.items():
        if tur in ('g', 'ml'):
            birim, referans = tur, 100.0
            olcek = lambda k: 100.0 / k['olcu'] if k['olcu'] else None
        else:
            birim, referans = 'porsiyon', 1.0
            olcek = lambda k: 1.0 / k['miktar'] if k['miktar'] else None
        degerler = {}
        for alan in SUTUNLAR:
            vals = [k[alan] * olcek(k) for k in liste if alan in k and olcek(k)]
            degerler[alan] = round(statistics.median(vals), 2) if vals else None
        if degerler['kcal'] is None:
            continue
        olculer = [k['olcu'] for k in liste]
        besinler.append({
            'ad': ad if birim != 'porsiyon' else f"{ad} ({tur.split(':', 1)[1]})",
            'birim': birim,
            'referans': referans,
            'varsayilan': round(statistics.median(olculer), 1),
            'kullanim': len(liste),
            'son': max(k['tarih'] for k in liste),
            **degerler,
        })
    besinler.sort(key=lambda b: (-b['kullanim'], b['ad']))
    return besinler


def main():
    giris, cikis = sys.argv[1], sys.argv[2]
    satirlar = open(giris, encoding='utf-8').read().split('\n')
    kayitlar, toplamlar = ayristir(satirlar)
    gunluk = defaultdict(float)
    for k in kayitlar:
        gunluk[k['tarih']] += k.get('kcal', 0)
    hatali = {g: (round(gunluk[g]), t) for g, t in toplamlar.items() if abs(gunluk[g] - t) > 2}
    if hatali:
        print('UYARI: kalori toplamı tutmayan günler:', hatali, file=sys.stderr)
    besinler = besinler_cikar(kayitlar)
    for k in kayitlar:
        k['kcal'] = k.get('kcal', 0)
    json.dump({'kaynak': 'FatSecret', 'besinler': besinler, 'kayitlar': kayitlar},
              open(cikis, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{len(toplamlar)} gün, {len(kayitlar)} kayıt, {len(besinler)} yiyecek; '
          f'{len(toplamlar) - len(hatali)} günün toplamı PDF ile birebir tutuyor')


if __name__ == '__main__':
    main()
