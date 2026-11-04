import { bmr, makroHedef, mikroHedefler, suHedefiMl, tdee } from './calc';
import type { Profil } from './db';
import { gunHedefi, type GunTipi, type KocProgram } from './koc';

/**
 * Profil + güncel kilodan günlük kalori, makro ve su hedeflerini çıkarır.
 * Koçluk programı verilirse kalori/makro hedefleri gün tipine göre programdan, sodyum ve potasyum
 * aralık olarak programdan gelir.
 */
export function gunlukHedefler(
  profil: Profil | null,
  kilo: number | null,
  suHedefOzel?: number | null,
  koc?: { program: KocProgram; gunTipi: GunTipi } | null,
) {
  let kalori: number | null = null;
  let b: number | null = null;
  let t: number | null = null;
  let makro: { protein: number; karb: number; yag: number } | null = null;
  if (profil && kilo) {
    b = bmr(kilo, profil.boy, profil.yas, profil.cinsiyet);
    t = tdee(b, profil.aktivite);
    kalori = Math.round(t + profil.hedef_ayar);
    makro = makroHedef(kalori, kilo);
  }
  const mikro = mikroHedefler(kalori, profil?.sodyum_hedef, profil?.potasyum_hedef);
  let su = suHedefOzel ?? (kilo ? suHedefiMl(kilo) : 2500);

  if (koc) {
    const h = gunHedefi(koc.program, koc.gunTipi);
    kalori = h.kalori;
    makro = { protein: h.protein, karb: h.karb, yag: h.yag };
    mikro.sodyum = { deger: koc.program.sodyum_max, min: koc.program.sodyum_min, tur: 'aralik' };
    mikro.potasyum = { deger: koc.program.potasyum_max, min: koc.program.potasyum_min, tur: 'aralik' };
    mikro.seker = { deger: Math.round((kalori * 0.1) / 4), tur: 'ust' };
    mikro.doymus = { deger: Math.round((kalori * 0.1) / 9), tur: 'ust' };
    if (suHedefOzel == null) su = Math.round(koc.program.su_hedef_l * 1000);
  }

  return { kalori, bmr: b != null ? Math.round(b) : null, tdee: t != null ? Math.round(t) : null, makro, mikro, su };
}
