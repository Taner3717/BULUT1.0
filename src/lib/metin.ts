/**
 * Arama için Türkçe metni sadeleştirir: küçük harf, Türkçe karakterler ASCII karşılığına
 * ("Çiğ Köfte" → "cig kofte"). SQLite LIKE yalnızca ASCII harflerde büyük/küçük harf duyarsızdır,
 * bu yüzden aramalar bu sadeleştirilmiş sütun üzerinden yapılır.
 */
export function aramaMetni(s: string): string {
  return s
    .replace(/İ/g, 'i')
    .replace(/I/g, 'ı')
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ç/g, 'c')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ö/g, 'o')
    .replace(/ü/g, 'u')
    .replace(/[âà]/g, 'a')
    .replace(/[îì]/g, 'i')
    .replace(/[ûù]/g, 'u')
    .replace(/[^a-z0-9%]+/g, ' ')
    .trim();
}
