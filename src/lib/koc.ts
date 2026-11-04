// 8 haftalık koçluk programı: hafta hesapları, haftalık özet ve kurallara dayalı değerlendirme.
// Saf fonksiyonlar (UI ve veritabanından bağımsız, test edilebilir).

export type GunTipi = 'normal' | 'yuksek';

export type KocProgram = {
  baslangic: string; // YYYY-MM-DD (tercihen pazartesi)
  hafta: number;
  baslangic_kilo: number;
  haftalik_hedef: number; // kg/hafta; kilo vermek için negatif (ör. -0.5)
  normal_p: number;
  normal_y: number;
  normal_k: number;
  yuksek_p: number;
  yuksek_y: number;
  yuksek_k: number;
  adim_hedef: number;
  sodyum_min: number;
  sodyum_max: number;
  potasyum_min: number;
  potasyum_max: number;
  su_hedef_l: number;
  yuksek_gun_hafta: number;
  notlar: string | null;
};

/** Koç dosyasındaki ("Kilo Takip Tablosu") varsayılanlar */
export const VARSAYILAN_PROGRAM: KocProgram = {
  baslangic: '2026-11-02',
  hafta: 8,
  baslangic_kilo: 71.2,
  haftalik_hedef: -0.5,
  normal_p: 160,
  normal_y: 55,
  normal_k: 180,
  yuksek_p: 160,
  yuksek_y: 55,
  yuksek_k: 220,
  adim_hedef: 10000,
  sodyum_min: 4000,
  sodyum_max: 4500,
  potasyum_min: 4000,
  potasyum_max: 4500,
  su_hedef_l: 3,
  yuksek_gun_hafta: 1,
  notlar:
    'Adım hedefi: günlük 10.000 adım\nSodyum: günlük 4000-4500 mg\nPotasyum: günlük 4000-4500 mg\nHaftada 1 yüksek gün\nKardiyo yapılmadıysa "Yapılmadı" yaz',
};

export function makroKalori(p: number, y: number, k: number) {
  return Math.round(p * 4 + y * 9 + k * 4);
}

export function gunHedefi(pr: KocProgram, tip: GunTipi) {
  const p = tip === 'yuksek' ? pr.yuksek_p : pr.normal_p;
  const y = tip === 'yuksek' ? pr.yuksek_y : pr.normal_y;
  const k = tip === 'yuksek' ? pr.yuksek_k : pr.normal_k;
  return { protein: p, yag: y, karb: k, kalori: makroKalori(p, y, k) };
}

// ---------- Tarih ----------

function tarihten(t: string) {
  const [y, m, d] = t.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function tarihe(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function gunEkleT(t: string, n: number) {
  const d = tarihten(t);
  d.setDate(d.getDate() + n);
  return tarihe(d);
}

/** Verilen tarihin programın kaçıncı haftası olduğu (1'den başlar). Program öncesi 0, sonrası hafta+1'den büyük olabilir. */
export function haftaNo(pr: Pick<KocProgram, 'baslangic'>, tarih: string) {
  const fark = Math.round((tarihten(tarih).getTime() - tarihten(pr.baslangic).getTime()) / 86400000);
  return fark < 0 ? 0 : Math.floor(fark / 7) + 1;
}

/** n. haftanın 7 günü */
export function haftaGunleri(pr: Pick<KocProgram, 'baslangic'>, n: number) {
  const ilk = gunEkleT(pr.baslangic, (n - 1) * 7);
  return Array.from({ length: 7 }, (_, i) => gunEkleT(ilk, i));
}

/** n. hafta sonundaki hedef kilo */
export function hedefKilo(pr: Pick<KocProgram, 'baslangic_kilo' | 'haftalik_hedef'>, n: number) {
  return Math.round((pr.baslangic_kilo + pr.haftalik_hedef * n) * 10) / 10;
}

// ---------- Haftalık özet ----------

export type GunVerisi = {
  tarih: string;
  gun_tipi: GunTipi;
  kilo: number | null;
  uyku: number | null;
  stres: number | null;
  enerji: number | null;
  aclik: number | null;
  sindirim: number | null;
  kardiyo: string | null;
  adim: number | null;
  // uygulamadaki kayıtlardan
  kcal: number | null;
  protein: number | null;
  yag: number | null;
  karb: number | null;
  sodyum: number | null;
  potasyum: number | null;
  su_l: number | null;
};

const ORT_ALANLAR = ['kilo', 'uyku', 'stres', 'enerji', 'aclik', 'sindirim', 'adim', 'kcal', 'protein', 'yag', 'karb', 'sodyum', 'potasyum', 'su_l'] as const;
export type OrtAlan = (typeof ORT_ALANLAR)[number];

export type HaftaOzeti = {
  ort: Record<OrtAlan, number | null>;
  /** her alan için değeri girilmiş gün sayısı */
  sayi: Record<OrtAlan, number>;
  kardiyoGun: number;
  yuksekGun: number;
  checkinGun: number;
};

function ortalama(v: (number | null)[]) {
  const d = v.filter((x): x is number => x != null && Number.isFinite(x));
  return d.length ? d.reduce((a, b) => a + b, 0) / d.length : null;
}

function kardiyoYapildi(k: string | null) {
  if (!k) return false;
  const t = k.trim().toLocaleLowerCase('tr-TR');
  return t !== '' && !t.startsWith('yapılmadı') && !t.startsWith('yapilmadi') && t !== '-' && t !== 'yok';
}

export function haftaOzeti(gunler: GunVerisi[]): HaftaOzeti {
  const ort = {} as Record<OrtAlan, number | null>;
  const sayi = {} as Record<OrtAlan, number>;
  for (const a of ORT_ALANLAR) {
    // beslenmede kaydı olmayan (0 kcal) günleri ortalamaya katma
    const degerler = gunler.map((g) => (a === 'kcal' || a === 'protein' || a === 'yag' || a === 'karb') && !g.kcal ? null : g[a]);
    ort[a] = ortalama(degerler);
    sayi[a] = degerler.filter((x) => x != null).length;
  }
  return {
    ort,
    sayi,
    kardiyoGun: gunler.filter((g) => kardiyoYapildi(g.kardiyo)).length,
    yuksekGun: gunler.filter((g) => g.gun_tipi === 'yuksek').length,
    checkinGun: gunler.filter((g) => g.kilo != null || g.uyku != null || g.stres != null || g.adim != null).length,
  };
}

// ---------- Değerlendirme ----------

export type Bulgu = { seviye: 'iyi' | 'uyari' | 'onemli'; konu: string; metin: string };

function yuvarla1(n: number) {
  return Math.round(n * 10) / 10;
}

/**
 * Haftanın verisini program hedefleriyle karşılaştırıp koç notları üretir.
 * oncekiKiloOrt: bir önceki haftanın kilo ortalaması (1. haftada başlangıç kilosu).
 * Not: genel takip önerileridir; tıbbi tavsiye değildir.
 */
export function degerlendir(pr: KocProgram, oz: HaftaOzeti, oncekiKiloOrt: number | null, gecenGun = 7): Bulgu[] {
  const b: Bulgu[] = [];
  const o = oz.ort;

  // Veri yeterliliği
  if (oz.sayi.kilo < Math.min(3, gecenGun)) {
    b.push({ seviye: 'uyari', konu: 'Tartı', metin: `Bu hafta ${oz.sayi.kilo} gün tartıldın. Güvenilir ortalama için haftada en az 4-5 sabah aç karnına tartıl.` });
  }

  // Kilo gidişatı
  if (o.kilo != null && oncekiKiloOrt != null && oz.sayi.kilo >= 3) {
    const degisim = o.kilo - oncekiKiloOrt;
    const hedef = pr.haftalik_hedef;
    const d = yuvarla1(degisim);
    if (hedef < 0) {
      if (degisim > 0.2) {
        b.push({ seviye: 'onemli', konu: 'Kilo', metin: `Haftalık ortalama ${d > 0 ? '+' : ''}${d} kg arttı (hedef ${hedef} kg). Önce uyumu kontrol et: kalori ve adım hedefleri tutuyor mu? Tutuyorsa 1 hafta daha izle; yüksek gün/sodyum kaynaklı su tutulması olabilir.` });
      } else if (degisim > hedef / 2) {
        b.push({ seviye: 'uyari', konu: 'Kilo', metin: `Ortalama ${d} kg değişti; hedefin (${hedef} kg) gerisinde. Uyum iyiyse koçunla günlük kaloriyi ~100-150 kcal azaltmayı ya da adımı artırmayı konuşabilirsin.` });
      } else if (degisim < hedef * 2) {
        b.push({ seviye: 'uyari', konu: 'Kilo', metin: `Ortalama ${d} kg düştü; hedefin (${hedef} kg) iki katından hızlı. Kas kaybı ve performans düşüşüne dikkat; protein ve uykuyu koru.` });
      } else {
        b.push({ seviye: 'iyi', konu: 'Kilo', metin: `Ortalama ${d} kg değişti; hedefle (${hedef} kg/hafta) uyumlu. Böyle devam.` });
      }
    } else if (hedef > 0) {
      if (degisim < hedef / 2) b.push({ seviye: 'uyari', konu: 'Kilo', metin: `Ortalama ${d} kg değişti; kilo alma hedefinin (${hedef} kg) gerisinde.` });
      else b.push({ seviye: 'iyi', konu: 'Kilo', metin: `Ortalama ${d > 0 ? '+' : ''}${d} kg; hedefle uyumlu.` });
    }
  }

  // Protein
  if (o.protein != null && oz.sayi.protein >= 2) {
    const oran = o.protein / pr.normal_p;
    if (oran < 0.9) b.push({ seviye: 'uyari', konu: 'Protein', metin: `Protein ortalaması ${Math.round(o.protein)} g, hedef ${pr.normal_p} g. Her öğüne bir protein kaynağı ekle.` });
    else b.push({ seviye: 'iyi', konu: 'Protein', metin: `Protein ortalaması ${Math.round(o.protein)} g; hedefte.` });
  }

  // Kalori uyumu (gün tipine göre hedef ortalaması)
  if (o.kcal != null && oz.sayi.kcal >= 2) {
    const nh = gunHedefi(pr, 'normal').kalori;
    const yh = gunHedefi(pr, 'yuksek').kalori;
    const hedefOrt = (nh * (7 - Math.min(oz.yuksekGun, 7)) + yh * Math.min(oz.yuksekGun, 7)) / 7;
    const sapma = (o.kcal - hedefOrt) / hedefOrt;
    if (sapma > 0.1) b.push({ seviye: 'uyari', konu: 'Kalori', metin: `Kalori ortalaması ${Math.round(o.kcal)} kcal; hedef ortalamasının (~${Math.round(hedefOrt)}) %${Math.round(sapma * 100)} üstünde.` });
    else if (sapma < -0.15) b.push({ seviye: 'uyari', konu: 'Kalori', metin: `Kalori ortalaması ${Math.round(o.kcal)} kcal; hedefin belirgin altında. Çok düşük kalori sürdürülebilirliği bozar.` });
    else b.push({ seviye: 'iyi', konu: 'Kalori', metin: `Kalori ortalaması ${Math.round(o.kcal)} kcal; hedef aralığında.` });
  }

  // Yüksek gün
  if (oz.yuksekGun > pr.yuksek_gun_hafta) {
    b.push({ seviye: 'uyari', konu: 'Yüksek gün', metin: `Bu hafta ${oz.yuksekGun} yüksek gün yapıldı; plan haftada ${pr.yuksek_gun_hafta}.` });
  }

  // Adım
  if (o.adim != null) {
    if (o.adim < pr.adim_hedef * 0.9) b.push({ seviye: 'uyari', konu: 'Adım', metin: `Adım ortalaması ${Math.round(o.adim).toLocaleString('tr-TR')}; hedef ${pr.adim_hedef.toLocaleString('tr-TR')}. Öğün sonrası 10-15 dk yürüyüş ekle.` });
    else b.push({ seviye: 'iyi', konu: 'Adım', metin: `Adım ortalaması ${Math.round(o.adim).toLocaleString('tr-TR')}; hedefte.` });
  }

  // Uyku, stres, enerji
  if (o.uyku != null && o.uyku < 7) b.push({ seviye: 'uyari', konu: 'Uyku', metin: `Uyku ortalaması ${yuvarla1(o.uyku)} saat. 7 saatin altı açlığı ve toparlanmayı olumsuz etkiler.` });
  if (o.stres != null && o.stres >= 3.5) b.push({ seviye: 'uyari', konu: 'Stres', metin: `Stres ortalaması ${yuvarla1(o.stres)}/5. Kilo dalgalanması ve su tutulması artabilir; koçuna not düş.` });
  if (o.enerji != null && o.enerji <= 2.5) b.push({ seviye: 'onemli', konu: 'Enerji', metin: `Enerji ortalaması ${yuvarla1(o.enerji)}/5. Kalori çok düşük ya da uyku yetersiz olabilir; koçunla konuş.` });
  if (o.aclik != null && o.aclik >= 4) b.push({ seviye: 'uyari', konu: 'Açlık', metin: `Açlık ortalaması ${yuvarla1(o.aclik)}/5. Hacimli sebze, lif ve protein dağılımını gözden geçir.` });
  if (o.sindirim != null && o.sindirim <= 2) b.push({ seviye: 'uyari', konu: 'Sindirim', metin: `Sindirim ortalaması ${yuvarla1(o.sindirim)}/5. Lif ve su alımını kontrol et.` });

  // Sodyum / potasyum aralığı
  for (const [a, ad, min, max] of [
    ['sodyum', 'Sodyum', pr.sodyum_min, pr.sodyum_max],
    ['potasyum', 'Potasyum', pr.potasyum_min, pr.potasyum_max],
  ] as const) {
    const v = o[a];
    if (v == null || oz.sayi[a] < 2) continue;
    if (v < min) b.push({ seviye: 'uyari', konu: ad, metin: `${ad} ortalaması ${Math.round(v).toLocaleString('tr-TR')} mg; hedef aralığın (${min}-${max} mg) altında.` });
    else if (v > max) b.push({ seviye: 'uyari', konu: ad, metin: `${ad} ortalaması ${Math.round(v).toLocaleString('tr-TR')} mg; hedef aralığın (${min}-${max} mg) üstünde.` });
  }

  // Su
  if (o.su_l != null && o.su_l < pr.su_hedef_l * 0.8) {
    b.push({ seviye: 'uyari', konu: 'Su', metin: `Su ortalaması ${yuvarla1(o.su_l)} L; hedef ${pr.su_hedef_l} L.` });
  }

  const sira = { onemli: 0, uyari: 1, iyi: 2 };
  return b.sort((x, y) => sira[x.seviye] - sira[y.seviye]);
}
