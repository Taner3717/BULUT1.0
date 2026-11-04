// Vücut ve beslenme hesaplamaları. Saf fonksiyonlar: test edilebilir, UI'dan bağımsız.

export type Cinsiyet = 'erkek' | 'kadin';

export const AKTIVITE_SEVIYELERI = [
  { deger: 1.2, ad: 'Hareketsiz', aciklama: 'Masa başı, egzersiz yok' },
  { deger: 1.375, ad: 'Az aktif', aciklama: 'Haftada 1-3 gün egzersiz' },
  { deger: 1.55, ad: 'Orta aktif', aciklama: 'Haftada 3-5 gün egzersiz' },
  { deger: 1.725, ad: 'Çok aktif', aciklama: 'Haftada 6-7 gün egzersiz' },
  { deger: 1.9, ad: 'Aşırı aktif', aciklama: 'Günde 2 antrenman / ağır iş' },
] as const;

export const HEDEFLER = [
  { deger: -500, ad: 'Kilo ver' },
  { deger: -250, ad: 'Yavaş kilo ver' },
  { deger: 0, ad: 'Koru' },
  { deger: 250, ad: 'Kilo al' },
] as const;

/** "72,5" veya "72.5" gibi girdileri sayıya çevirir. Geçersizse null. */
export function sayiOku(s: string | null | undefined): number | null {
  if (s == null) return null;
  const t = String(s).trim().replace(',', '.');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export function yuvarla(n: number, basamak = 1): number {
  const k = 10 ** basamak;
  return Math.round(n * k) / k;
}

/** Vücut kitle indeksi: kg / m² */
export function vki(kg: number, boyCm: number): number {
  const m = boyCm / 100;
  return kg / (m * m);
}

export function vkiKategori(v: number): string {
  if (v < 18.5) return 'Zayıf';
  if (v < 25) return 'Normal';
  if (v < 30) return 'Fazla kilolu';
  return 'Obez';
}

/** Bazal metabolizma hızı (Mifflin-St Jeor), kcal/gün */
export function bmr(kg: number, boyCm: number, yas: number, cinsiyet: Cinsiyet): number {
  return 10 * kg + 6.25 * boyCm - 5 * yas + (cinsiyet === 'erkek' ? 5 : -161);
}

/** Günlük toplam enerji harcaması, kcal/gün */
export function tdee(bmrDeger: number, aktivite: number): number {
  return bmrDeger * aktivite;
}

/**
 * US Navy yöntemiyle vücut yağ oranı (%). Ölçüler cm.
 * Kadınlarda kalça ölçüsü gerekir. Ölçüler tutarsızsa null döner.
 */
export function navyYagOrani(
  cinsiyet: Cinsiyet,
  boyCm: number,
  belCm: number,
  boyunCm: number,
  kalcaCm?: number | null,
): number | null {
  let sonuc: number;
  if (cinsiyet === 'erkek') {
    const fark = belCm - boyunCm;
    if (fark <= 0) return null;
    sonuc = 495 / (1.0324 - 0.19077 * Math.log10(fark) + 0.15456 * Math.log10(boyCm)) - 450;
  } else {
    if (!kalcaCm) return null;
    const fark = belCm + kalcaCm - boyunCm;
    if (fark <= 0) return null;
    sonuc = 495 / (1.29579 - 0.35004 * Math.log10(fark) + 0.221 * Math.log10(boyCm)) - 450;
  }
  if (!Number.isFinite(sonuc) || sonuc < 2 || sonuc > 70) return null;
  return sonuc;
}

export function yagsizKutle(kg: number, yagOrani: number): number {
  return kg * (1 - yagOrani / 100);
}

/** Bel / boy oranı. 0.5 üstü sağlık riski göstergesi kabul edilir. */
export function belBoyOrani(belCm: number, boyCm: number): number {
  return belCm / boyCm;
}

/** Günlük su hedefi (ml): kilo başına 35 ml, 50 ml'ye yuvarlanır. */
export function suHedefiMl(kg: number): number {
  return Math.round((kg * 35) / 50) * 50;
}

/** Hedef kaloriye göre makro dağılımı: protein 1.8 g/kg, yağ %25, kalan karbonhidrat. */
export function makroHedef(kalori: number, kg: number) {
  const protein = 1.8 * kg;
  const yag = (kalori * 0.25) / 9;
  const karb = Math.max(0, (kalori - protein * 4 - yag * 9) / 4);
  return { protein: Math.round(protein), karb: Math.round(karb), yag: Math.round(yag) };
}

/** "23:30" → dakika (1410). Geçersizse null. */
export function saatOku(s: string): number | null {
  const m = /^(\d{1,2})[:.](\d{2})$/.exec(s.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const dk = Number(m[2]);
  if (h > 23 || dk > 59) return null;
  return h * 60 + dk;
}

/** Yatış ve kalkış saatinden uyku süresi (dk). Gece yarısını geçmeyi hesaba katar. */
export function uykuSuresiDk(yatis: string, kalkis: string): number | null {
  const y = saatOku(yatis);
  const k = saatOku(kalkis);
  if (y == null || k == null) return null;
  const fark = k - y;
  return fark > 0 ? fark : fark + 24 * 60;
}

export function dkMetin(dk: number): string {
  const h = Math.floor(dk / 60);
  const m = Math.round(dk % 60);
  return m === 0 ? `${h} sa` : `${h} sa ${m} dk`;
}

export const EK_BESINLER = ['sodyum', 'potasyum', 'lif', 'seker', 'doymus', 'kolesterol'] as const;
export type EkBesin = (typeof EK_BESINLER)[number];

export type BesinKalemi = {
  ad: string;
  gram: number;
  kcal: number;
  protein: number;
  karb: number;
  yag: number;
} & Partial<Record<EkBesin, number | null>>;

function ekOlcekle(kaynak: Partial<Record<EkBesin, number | null>>, k: number) {
  const sonuc: Partial<Record<EkBesin, number | null>> = {};
  for (const a of EK_BESINLER) {
    const v = kaynak[a];
    sonuc[a] = v == null ? null : yuvarla(v * k);
  }
  return sonuc;
}

/** Tahmin edilen porsiyonun gramı değişince kalori ve tüm besin değerlerini orantılı ölçekler. */
export function porsiyonOlcekle(taban: BesinKalemi, yeniGram: number): BesinKalemi {
  if (!(taban.gram > 0) || !(yeniGram >= 0)) return { ...taban, gram: yeniGram };
  const k = yeniGram / taban.gram;
  return {
    ad: taban.ad,
    gram: yeniGram,
    kcal: Math.round(taban.kcal * k),
    protein: yuvarla(taban.protein * k),
    karb: yuvarla(taban.karb * k),
    yag: yuvarla(taban.yag * k),
    ...ekOlcekle(taban, k),
  };
}

type ReferansBesin = {
  referans: number;
  kcal: number;
  protein: number | null;
  karb: number | null;
  yag: number | null;
} & Partial<Record<EkBesin, number | null>>;

/** Listedeki yiyecek (referans miktar başına) için verilen miktarın değerleri. */
export function besinHesapla(b: ReferansBesin, miktar: number) {
  const k = b.referans > 0 ? miktar / b.referans : 0;
  return {
    kcal: Math.round(b.kcal * k),
    protein: yuvarla((b.protein ?? 0) * k),
    karb: yuvarla((b.karb ?? 0) * k),
    yag: yuvarla((b.yag ?? 0) * k),
    ...ekOlcekle(b, k),
  };
}

/** Günlük mikro besin hedefleri. Sodyum/kolesterol/doymuş yağ üst sınır, potasyum/lif alt hedeftir. */
export function mikroHedefler(kalori: number | null, sodyumOzel?: number | null, potasyumOzel?: number | null) {
  return {
    sodyum: { deger: sodyumOzel ?? 2000, tur: 'ust' as const }, // DSÖ: < 2000 mg (≈ 5 g tuz)
    potasyum: { deger: potasyumOzel ?? 3500, tur: 'alt' as const }, // DSÖ: ≥ 3500 mg
    lif: { deger: 25, tur: 'alt' as const }, // DSÖ: ≥ 25 g
    seker: { deger: kalori ? Math.round((kalori * 0.1) / 4) : 50, tur: 'ust' as const }, // serbest şeker < %10 enerji
    doymus: { deger: kalori ? Math.round((kalori * 0.1) / 9) : 22, tur: 'ust' as const }, // < %10 enerji
    kolesterol: { deger: 300, tur: 'ust' as const },
  };
}
