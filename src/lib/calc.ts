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
