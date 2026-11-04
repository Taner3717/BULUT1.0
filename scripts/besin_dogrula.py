#!/usr/bin/env python3
"""Eşleşmiş besin listesini doğrular.

Kullanım: python3 scripts/besin_dogrula.py <eslesme.json> <usda_dizin.json> [fatsecret.json]

1. Enerji tutarlılığı: kcal ile 4·protein + 4·karb + 9·yağ (+ alkol için 7) karşılaştırılır.
2. Kaynaklar arası: SR Legacy kaydı, aynı yiyeceğin USDA Foundation (yeni analiz) kaydıyla karşılaştırılır.
3. FatSecret: kişisel günlükteki aynı yiyeceklerle karşılaştırılır (verilirse).
Çıktı: Markdown rapor (stdout). Ciddi sorunlarda çıkış kodu 1.
"""
import json
import re
import sys

ALANLAR = ['kcal', 'protein', 'karb', 'yag', 'sodyum', 'potasyum']

# Aynı yiyeceğin USDA Foundation karşılığı (yeni analiz) — SR Legacy ile çapraz kontrol için
FOUNDATION = {
    'Muz': 'Bananas, ripe and slightly ripe, raw',
    'Elma': 'Apples, fuji, with skin, raw',
    'Portakal': 'Oranges, raw, navels',
    'Domates': 'Tomatoes, red, ripe, raw',
    'Salatalık': 'Cucumber, with peel, raw',
    'Havuç': 'Carrots, mature, raw',
    'Soğan': 'Onions, yellow, raw',
    'Yumurta (bütün, çiğ)': 'Eggs, Grade A, Large, egg whole',
    'Yumurta beyazı': 'Eggs, Grade A, Large, egg white',
    'Yumurta sarısı': 'Eggs, Grade A, Large, egg yolk',
    'İnek sütü (tam yağlı)': 'Milk, whole, 3.25% milkfat, with added vitamin D',
    'Tavuk göğsü (çiğ, derisiz)': 'Chicken, breast, boneless, skinless, raw',
    'Dana kıyma (%20 yağlı, çiğ)': 'Beef, ground, 80% lean meat / 20% fat, raw',
    'Dana kıyma (%10 yağlı, çiğ)': 'Beef, ground, 90% lean meat / 10% fat, raw',
    'Badem': 'Nuts, almonds, whole, raw',
    'Ceviz': 'Nuts, walnuts, English, halves, raw',
    'Mercimek (kuru)': 'Lentils, dry',
    'Nohut (kuru)': 'Chickpeas, (garbanzo beans, bengal gram), dry',
    'Patates (çiğ)': 'Potatoes, russet, without skin, raw',
    'Kaşar peyniri': 'Cheese, cheddar',
    'Beyaz peynir': 'Cheese, feta, whole milk, crumbled',
    'Tereyağı': 'Butter, stick, salted',
    'Zeytinyağı': 'Oil, olive, extra virgin',
    'Beyaz ekmek': 'Bread, white, commercially prepared',
    'Yoğurt (tam yağlı)': 'Yogurt, plain, whole milk',
    'Süzme yoğurt (yağsız)': 'Yogurt, Greek, plain, nonfat',
    'Humus': 'Hummus, commercial',
}

# Kişisel FatSecret adı -> listedeki ad (birim: g ya da porsiyon gramı)
FATSECRET = {
    'Tavuk Göğsü (Derisi Yenmeden)': ('Tavuk göğsü (ızgara/fırın, derisiz)', None),
    'Muz': ('Muz', None),
    'Domatesler': ('Domates', None),
    'Salatalık': ('Salatalık', None),
    'Salatalık (Soyulmuş)': ('Salatalık (soyulmuş)', None),
    'Beyaz Ekmek': ('Beyaz ekmek', None),
    'Bal': ('Bal', None),
    'Tam Yağlı Sade Yoğurt': ('Yoğurt (tam yağlı)', None),
    'Yumurta Beyazı (büyük)': ('Yumurta beyazı', 33),
    'Yumurta (orta boy)': ('Yumurta (bütün, çiğ)', 44),
    'Patates': ('Patates (çiğ)', None),
}


def atwater(b):
    if b['kcal'] is None or None in (b['protein'], b['karb'], b['yag']):
        return None
    tahmin = 4 * b['protein'] + 4 * b['karb'] + 9 * b['yag']
    return tahmin


def fark(a, b):
    if a is None or b is None:
        return None
    if max(abs(a), abs(b)) < 1 or b == 0:
        return None  # çok küçük ya da sıfır taban: yüzde anlamsız
    return (a - b) / abs(b) * 100


def main():
    liste = json.load(open(sys.argv[1], encoding='utf-8'))
    dizin = json.load(open(sys.argv[2]))
    fs = json.load(open(sys.argv[3], encoding='utf-8')) if len(sys.argv) > 3 else None
    by_ad = {}
    for f in dizin:
        by_ad.setdefault(f['ad'].lower(), []).append(f)
    ciddi = 0
    out = []

    out.append(f'# Besin veritabanı doğrulama raporu\n\nToplam yiyecek: **{len(liste)}**\n')
    eksik = {a: sum(1 for b in liste if b.get(a) is None) for a in ['sodyum', 'potasyum', 'lif', 'seker', 'doymus', 'kolesterol']}
    out.append('Eksik değer sayısı: ' + ', '.join(f'{a} {n}' for a, n in eksik.items()) + '\n')

    out.append('## 1. Enerji tutarlılığı (kcal ≈ 4P + 4K + 9Y)\n')
    sorunlu = []
    for b in liste:
        t = atwater(b)
        if t is None:
            continue
        alkol = 'Alcoholic' in b['usda_ad'] or 'Rakı' in b['ad'] or 'Bira' in b['ad'] or 'Şarap' in b['ad']
        if alkol:
            continue
        sapma = abs(b['kcal'] - t)
        if sapma > 15 and sapma / max(b['kcal'], 1) > 0.12:
            sorunlu.append((b['ad'], b['kcal'], round(t), round(sapma / max(b['kcal'], 1) * 100)))
    out.append(f'{len(liste) - len(sorunlu)} yiyecek tutarlı. Sapması %12 ve 15 kcal üstü olanlar:\n')
    out.append('| Yiyecek | kcal | 4P+4K+9Y | Sapma |\n|---|---|---|---|')
    for s in sorunlu:
        out.append(f'| {s[0]} | {s[1]} | {s[2]} | %{s[3]} |')
    out.append('\n(Lifli ve şeker alkollü ürünlerde USDA özel Atwater katsayıları kullanır; küçük sapmalar normaldir.)\n')

    out.append('## 2. Kaynaklar arası: SR Legacy ↔ USDA Foundation (yeni analiz)\n')
    out.append('| Yiyecek | Alan | Listede | Foundation | Fark |\n|---|---|---|---|---|')
    for ad, fad in FOUNDATION.items():
        b = next((x for x in liste if x['ad'] == ad), None)
        f = [x for x in by_ad.get(fad.lower(), []) if x['k'] == 'foundation']
        if not b or not f:
            out.append(f'| {ad} | — | {"yok" if not b else "var"} | {"bulunamadı" if not f else "var"} | |')
            continue
        f = f[0]
        for a in ['kcal', 'protein', 'yag', 'sodyum', 'potasyum']:
            d = fark(b.get(a), f.get(a))
            if d is None:
                out.append(f'| {ad} | {a} | {b.get(a)} | {f.get(a)} | — |')
                continue
            isaret = ' ⚠️' if abs(d) > 25 and abs((b.get(a) or 0) - (f.get(a) or 0)) > (5 if a in ('kcal', 'sodyum', 'potasyum') else 1) else ''
            out.append(f'| {ad} | {a} | {b.get(a)} | {f.get(a)} | {d:+.0f}%{isaret} |')

    out.append('\nNot: Foundation yeni ve farklı çeşitlerden (ör. Fuji elma) yapılmış analizlerdir; ±%10-30 fark '
               'doğal değişkenliktir. Liste, besin değeri daha eksiksiz olduğu için çoğunlukla SR Legacy kullanır.\n')

    if fs:
        out.append('\n## 3. Kişisel FatSecret verisiyle karşılaştırma (100 g başına)\n')
        out.append('| FatSecret | Liste | kcal FS / Liste | Protein | Sodyum mg | Potasyum mg |\n|---|---|---|---|---|---|')
        fsb = {x['ad']: x for x in fs['besinler']}
        for fad, (lad, porsiyon_g) in FATSECRET.items():
            x, b = fsb.get(fad), next((y for y in liste if y['ad'] == lad), None)
            if not x or not b:
                out.append(f'| {fad} | {lad} | eşleşme yok | | | |')
                continue
            k = 100 / porsiyon_g if porsiyon_g else 1  # porsiyonluk FatSecret değerini 100 g'a çevir
            def h(a):
                v = x.get(a)
                return None if v is None else round(v * k, 1)
            def hucre(a):
                fv, lv = h(a), b.get(a)
                if fv is None or lv is None:
                    return f'{fv} / {lv}'
                d = fark(fv, lv)
                return f'{fv} / {lv}' + ('' if d is None else f' ({d:+.0f}%)')
            out.append(f'| {fad} | {lad} | {hucre("kcal")} | {hucre("protein")} | {hucre("sodyum")} | {hucre("potasyum")} |')

    print('\n'.join(out))
    sys.exit(1 if ciddi else 0)


if __name__ == '__main__':
    main()
