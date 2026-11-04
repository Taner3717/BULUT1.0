import { Platform } from 'react-native';
import { offUrunCozumle, type Ham, type OffUrun } from './offCozumle';

export type { OffUrun } from './offCozumle';

const ALANLAR = 'code,product_name,product_name_tr,brands,serving_size,serving_quantity,nutriments';

export const ALAN_URL = (sorgu: string) =>
  `https://search.openfoodfacts.org/search?q=${encodeURIComponent(sorgu)}&page_size=20&langs=tr&fields=${ALANLAR}`;

export async function offAra(sorgu: string): Promise<OffUrun[]> {
  if (Platform.OS === 'web') {
    // Arama servisi tarayıcıdan gelen (CORS) isteklere izin vermiyor; telefonda sorun yok.
    throw new Error('İnternet araması web önizlemesinde çalışmaz; telefonda dene.');
  }
  const url = ALAN_URL(sorgu);
  // OFF, uygulamaların kendini User-Agent ile tanıtmasını ister
  const yanit = await fetch(url, { headers: { 'User-Agent': 'Bulut/1.0 (kalori takip uygulamasi)' } });
  if (yanit.status === 429) throw new Error('Çok sık arama yapıldı, bir dakika sonra tekrar dene.');
  if (!yanit.ok) throw new Error('İnternet araması şu an yapılamıyor.');
  const veri = (await yanit.json()) as { hits?: Ham[] };
  const gorulen = new Set<string>();
  return (veri.hits ?? [])
    .map(offUrunCozumle)
    .filter((u): u is OffUrun => u != null && !gorulen.has(u.kod) && Boolean(gorulen.add(u.kod)));
}
