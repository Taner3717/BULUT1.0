// İlerleme fotoğrafları: görüntüler IndexedDB'de (cihazda), meta veriler uygulama durumunda tutulur.
const DB = 'bulut-photos', STORE = 'photos';
export const POSES = { front: 'Ön', side: 'Yan', back: 'Arka', pose: 'Poz' };

function open() {
  return new Promise((res, rej) => {
    if (!('indexedDB' in globalThis)) return rej(new Error('IndexedDB yok'));
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

async function tx(mode, fn) {
  const db = await open();
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode);
    const out = fn(t.objectStore(STORE));
    t.oncomplete = () => res(out?.result);
    t.onerror = () => rej(t.error);
  });
}

export const putPhoto = (id, blob) => tx('readwrite', (s) => s.put(blob, id));
export const getPhoto = (id) => tx('readonly', (s) => s.get(id));
export const deletePhoto = (id) => tx('readwrite', (s) => s.delete(id));

// Uzun kenarı max px olacak şekilde küçült, JPEG'e çevir
export async function resizeImage(file, max = 1080, quality = 0.82) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale), h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  canvas.getContext('2d').drawImage(bmp, 0, 0, w, h);
  bmp.close?.();
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error('Görüntü işlenemedi'))), 'image/jpeg', quality));
}

const urls = new Map();
export async function photoURL(id) {
  if (urls.has(id)) return urls.get(id);
  const blob = await getPhoto(id);
  if (!blob) return null;
  const u = URL.createObjectURL(blob);
  urls.set(id, u);
  return u;
}
export function forgetURL(id) {
  const u = urls.get(id);
  if (u) { URL.revokeObjectURL(u); urls.delete(id); }
}
