import { bmr, makroHedef, suHedefiMl, tdee } from './calc';
import type { Profil } from './db';

/** Profil + güncel kilodan günlük kalori, makro ve su hedeflerini çıkarır. */
export function gunlukHedefler(profil: Profil | null, kilo: number | null, suHedefOzel?: number | null) {
  if (!profil || !kilo) {
    return { kalori: null, bmr: null, tdee: null, makro: null, su: suHedefOzel ?? (kilo ? suHedefiMl(kilo) : 2500) };
  }
  const b = bmr(kilo, profil.boy, profil.yas, profil.cinsiyet);
  const t = tdee(b, profil.aktivite);
  const kalori = Math.round(t + profil.hedef_ayar);
  return {
    kalori,
    bmr: Math.round(b),
    tdee: Math.round(t),
    makro: makroHedef(kalori, kilo),
    su: suHedefOzel ?? suHedefiMl(kilo),
  };
}
