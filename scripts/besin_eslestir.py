#!/usr/bin/env python3
"""scripts/besin_listesi.tsv'deki Türkçe yiyecekleri USDA FoodData Central kayıtlarıyla eşleştirir.

Kullanım: python3 scripts/besin_eslestir.py <usda_dizin.json> <cikti.json> [--rapor]
usda_dizin.json, USDA'nın Foundation + SR Legacy + FNDDS JSON setlerinden üretilir (usda_dizin.py).
"""
import json, re, sys

def kelimeler(s):
    return set(re.findall(r'[a-z0-9]+', s.lower()))

def main():
    dizin = json.load(open(sys.argv[1]))
    rapor = '--rapor' in sys.argv
    by_id = {f['id']: f for f in dizin}
    by_ad = {}
    for f in dizin:
        by_ad.setdefault(f['ad'].lower(), []).append(f)
    tercih = {'sr': 0, 'foundation': 1, 'fndds': 2}
    sonuc, eksik = [], []
    for satir in open(sys.argv[3] if len(sys.argv) > 3 and not sys.argv[3].startswith('--') else 'scripts/besin_listesi.tsv', encoding='utf-8'):
        satir = satir.rstrip('\n')
        if not satir or satir.startswith('#'):
            continue
        ad, kat, sorgu, porsiyon = (satir.split('|') + [''])[:4]
        f = None
        if sorgu.startswith('@tarif:'):
            # Ağırlıkça oranlarla USDA kayıtlarından karışım; 100 g karışım başına değerler
            parcalar = []
            for p in sorgu[len('@tarif:'):].split(';'):
                tanim, oran = p.rsplit(':', 1)
                x = by_id.get(int(tanim[1:])) if tanim.startswith('#') else (sorted(by_ad.get(tanim[1:].lower(), []), key=lambda y: tercih[y['k']]) or [None])[0]
                if not x:
                    raise SystemExit(f'Tarif bileşeni bulunamadı: {ad}: {tanim}')
                parcalar.append((x, float(oran)))
            toplam = sum(o for _, o in parcalar)
            f = {'id': None, 'k': 'tarif', 'ad': ' + '.join(f"{o / toplam:.0%} {x['ad']}" for x, o in parcalar)}
            for alan in ['kcal', 'protein', 'karb', 'yag', 'doymus', 'lif', 'seker', 'sodyum', 'potasyum', 'kolesterol']:
                degerler = [x.get(alan) for x, _ in parcalar]
                f[alan] = None if any(v is None for v in degerler) else round(sum(v * o for (x, o), v in zip(parcalar, degerler)) / toplam, 2)
        elif sorgu.startswith('#'):
            f = by_id.get(int(sorgu[1:]))
        elif sorgu.startswith('='):
            adaylar = sorted(by_ad.get(sorgu[1:].lower(), []), key=lambda x: tercih[x['k']])
            f = adaylar[0] if adaylar else None
        if not f:
            hedef = kelimeler(sorgu.lstrip('=#'))
            puanli = sorted(dizin, key=lambda x: (-len(hedef & kelimeler(x['ad'])) / (len(kelimeler(x['ad'])) ** 0.5 + 1), tercih[x['k']]))[:5]
            eksik.append((ad, sorgu, [(x['id'], x['k'], x['ad']) for x in puanli]))
            continue
        tr_porsiyon = []
        for p in filter(None, porsiyon.split(';')):
            pad, g = p.rsplit('=', 1)
            tr_porsiyon.append({'ad': pad.strip(), 'gram': float(g)})
        sonuc.append({'ad': ad, 'kategori': kat, 'kaynak': 'USDA tarif hesabı' if f['k'] == 'tarif' else f"USDA {f['k']}", 'fdc': f['id'], 'usda_ad': f['ad'],
                      **{k: f.get(k) for k in ['kcal', 'protein', 'karb', 'yag', 'doymus', 'lif', 'seker', 'sodyum', 'potasyum', 'kolesterol']},
                      'porsiyonlar': tr_porsiyon})
        if rapor and sorgu.startswith('#'):
            print(f'ID   {ad:35} -> {f["ad"]}')
    for ad, sorgu, oneriler in eksik:
        print(f'YOK  {ad:35} {sorgu}')
        for o in oneriler:
            print('        ', o)
    json.dump(sonuc, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    print(f'{len(sonuc)} eşleşti, {len(eksik)} eksik')

if __name__ == '__main__':
    main()
