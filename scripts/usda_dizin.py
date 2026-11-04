#!/usr/bin/env python3
"""USDA FoodData Central JSON setlerinden (Foundation, SR Legacy, FNDDS) küçük bir dizin üretir.

İndirme: https://fdc.nal.usda.gov/download-datasets (JSON zip dosyaları, kamu malı)
Kullanım: python3 scripts/usda_dizin.py <zipleri_açtığın_klasör>   ->  <klasör>/dizin.json
Her kayıt: 100 g başına kcal, protein, karb, yağ, doymuş yağ, lif, şeker, sodyum, potasyum, kolesterol ve porsiyon ağırlıkları.
"""
import json, sys, glob
D = sys.argv[1]
NUM = {'1063':'seker','1003':'protein','1004':'yag','1005':'karb','1079':'lif','2000':'seker','1093':'sodyum','1092':'potasyum','1253':'kolesterol','1258':'doymus'}
EN = ['1008','2047','2048']  # kcal: Energy, Atwater general, Atwater specific
cikti = []
for path, anahtar, kaynak in [
    (glob.glob(D+'/FoodData_Central_foundation*/*.json')[0], 'FoundationFoods', 'foundation'),
    (glob.glob(D+'/FoodData_Central_sr_legacy*/*.json')[0], 'SRLegacyFoods', 'sr'),
    (glob.glob(D+'/FoodData_Central_survey*/*.json')[0], 'SurveyFoods', 'fndds'),
]:
    veri = json.load(open(path))[anahtar]
    for f in veri:
        n = {}
        kcal = {}
        for fn in f.get('foodNutrients', []):
            nu = fn.get('nutrient', {}); num = str(nu.get('id', '')); amt = fn.get('amount')
            if amt is None: continue
            if num in NUM: n[NUM[num]] = amt
            if num in EN and (nu.get('unitName','').lower() == 'kcal'): kcal[num] = amt
        k = next((kcal[x] for x in ('1008', '2047', '2048') if kcal.get(x) is not None), None)
        if k is None: continue
        porsiyonlar = []
        for p in f.get('foodPortions', []):
            g = p.get('gramWeight')
            if not g: continue
            ad = p.get('portionDescription') or ' '.join(str(x) for x in [p.get('amount') or '', p.get('modifier') or '', (p.get('measureUnit') or {}).get('name') if (p.get('measureUnit') or {}).get('name') not in (None,'undetermined') else ''] if x).strip()
            porsiyonlar.append({'ad': ad, 'gram': round(g, 1)})
        cikti.append({'id': f['fdcId'], 'k': kaynak, 'ad': f['description'], 'kat': (f.get('foodCategory') or {}).get('description') or (f.get('wweiaFoodCategory') or {}).get('wweiaFoodCategoryDescription'), 'kcal': k, **n, 'p': porsiyonlar})
json.dump(cikti, open(D+'/dizin.json','w'))
import collections; print(len(cikti), collections.Counter(c['k'] for c in cikti))
print(cikti[0]); print([c for c in cikti if c['k']=='fndds'][0])
