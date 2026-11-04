/**
 * Open Food Facts: paketli ürünler için açık, kullanıcı katkılı veritabanı (ODbL lisansı).
 * Arama servisi dakikada sınırlı istek kabul eder; bu yüzden yalnızca kullanıcı "İnternette ara"ya
 * bastığında çağrılır (yazarken değil).
 */

export type OffUrun = {
  kod: string;
  ad: string;
  marka: string | null;
  kcal: number;
  protein: number | null;
  karb: number | null;
  yag: number | null;
  doymus: number | null;
  lif: number | null;
  seker: number | null;
  sodyum: number | null; // mg / 100 g
  potasyum: number | null; // mg / 100 g
  kolesterol: number | null; // mg / 100 g
  porsiyon: { ad: string; gram: number } | null;
  /** 4P+4K+9Y ile kcal arasında büyük fark varsa (veri hatası şüphesi) true */
  supheli: boolean;
};

export type Ham = {
  code?: string;
  product_name?: string;
  product_name_tr?: string;
  brands?: string[] | string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
};

function sayi(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : null;
}

function yuvarla(n: number | null, b = 1) {
  return n == null ? null : Math.round(n * 10 ** b) / 10 ** b;
}

/** Ham OFF ürününü 100 g başına değerlere çevirir. Kalori bilgisi yoksa null döner. */
export function offUrunCozumle(h: Ham): OffUrun | null {
  const n = h.nutriments ?? {};
  let kcal = sayi(n['energy-kcal_100g']);
  const kj = sayi(n['energy-kj_100g']) ?? sayi(n['energy_100g']);
  if (kcal == null && kj != null) kcal = kj / 4.184;
  const ad = (h.product_name_tr || h.product_name || '').trim();
  if (kcal == null || !ad || !h.code) return null;

  const protein = sayi(n['proteins_100g']);
  const karb = sayi(n['carbohydrates_100g']);
  const yag = sayi(n['fat_100g']);
  // OFF sodyum/potasyumu gram cinsinden verir; sodyum yoksa tuzdan (tuz / 2.5) hesaplanır
  const sodyumG = sayi(n['sodium_100g']) ?? (sayi(n['salt_100g']) != null ? (sayi(n['salt_100g']) as number) / 2.5 : null);
  const potasyumG = sayi(n['potassium_100g']);
  const kolesterolG = sayi(n['cholesterol_100g']);

  const tahmin = protein != null && karb != null && yag != null ? 4 * protein + 4 * karb + 9 * yag : null;
  const supheli = tahmin != null && Math.abs(tahmin - kcal) > 25 && Math.abs(tahmin - kcal) / Math.max(kcal, 1) > 0.2;

  const pg = sayi(h.serving_quantity);
  const marka = Array.isArray(h.brands) ? h.brands.join(', ') : (h.brands ?? null);
  return {
    kod: h.code,
    ad: marka && !ad.toLowerCase().includes(marka.toLowerCase().split(',')[0]) ? `${marka.split(',')[0]} ${ad}` : ad,
    marka: marka || null,
    kcal: Math.round(kcal),
    protein: yuvarla(protein),
    karb: yuvarla(karb),
    yag: yuvarla(yag),
    doymus: yuvarla(sayi(n['saturated-fat_100g'])),
    lif: yuvarla(sayi(n['fiber_100g'])),
    seker: yuvarla(sayi(n['sugars_100g'])),
    sodyum: sodyumG == null ? null : Math.round(sodyumG * 1000),
    potasyum: potasyumG == null ? null : Math.round(potasyumG * 1000),
    kolesterol: kolesterolG == null ? null : Math.round(kolesterolG * 1000),
    porsiyon: pg && pg > 0 ? { ad: `1 porsiyon${h.serving_size ? ` (${h.serving_size})` : ''}`, gram: pg } : null,
    supheli,
  };
}
