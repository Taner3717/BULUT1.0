import type { SQLiteDatabase } from 'expo-sqlite';
import type { Cinsiyet } from './calc';

export const DB_ADI = 'bulut.db';
const DB_SURUM = 1;

/** SQLiteProvider onInit: tabloları oluşturur, ileride sürüm bazlı göç (migration) ekler. */
export async function veritabaniHazirla(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const surum = row?.user_version ?? 0;
  if (surum >= DB_SURUM) return;

  if (surum === 0) {
    await db.execAsync(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS profil (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        boy REAL NOT NULL,
        yas INTEGER NOT NULL,
        cinsiyet TEXT NOT NULL,
        aktivite REAL NOT NULL DEFAULT 1.375,
        hedef_ayar INTEGER NOT NULL DEFAULT 0,
        hedef_kilo REAL
      );
      CREATE TABLE IF NOT EXISTS ogunler (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tarih TEXT NOT NULL,
        ogun TEXT NOT NULL,
        yemek TEXT NOT NULL,
        gram REAL,
        kcal REAL NOT NULL,
        protein REAL NOT NULL DEFAULT 0,
        karb REAL NOT NULL DEFAULT 0,
        yag REAL NOT NULL DEFAULT 0,
        kaynak TEXT NOT NULL DEFAULT 'elle',
        foto_uri TEXT,
        olusturma TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS ogunler_tarih ON ogunler(tarih);
      CREATE TABLE IF NOT EXISTS olcumler (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tarih TEXT NOT NULL,
        kilo REAL,
        bel REAL,
        boyun REAL,
        kalca REAL,
        gogus REAL,
        kol REAL,
        bacak REAL,
        olusturma TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS olcumler_tarih ON olcumler(tarih);
      CREATE TABLE IF NOT EXISTS uyku (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tarih TEXT NOT NULL,
        yatis TEXT NOT NULL,
        kalkis TEXT NOT NULL,
        sure_dk INTEGER NOT NULL,
        kalite INTEGER,
        notlar TEXT
      );
      CREATE INDEX IF NOT EXISTS uyku_tarih ON uyku(tarih);
      CREATE TABLE IF NOT EXISTS su (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        tarih TEXT NOT NULL,
        zaman TEXT NOT NULL,
        ml INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS su_tarih ON su(tarih);
      CREATE TABLE IF NOT EXISTS ayarlar (
        anahtar TEXT PRIMARY KEY NOT NULL,
        deger TEXT NOT NULL
      );
    `);
  }
  // Yeni sürümlerde: if (surum < 2) { ALTER TABLE ... }
  await db.execAsync(`PRAGMA user_version = ${DB_SURUM}`);
}

// ---------- Tipler ----------

export type Profil = {
  boy: number;
  yas: number;
  cinsiyet: Cinsiyet;
  aktivite: number;
  hedef_ayar: number;
  hedef_kilo: number | null;
};

export type Ogun = {
  id: number;
  tarih: string;
  ogun: string;
  yemek: string;
  gram: number | null;
  kcal: number;
  protein: number;
  karb: number;
  yag: number;
  kaynak: string;
};

export type Olcum = {
  id: number;
  tarih: string;
  kilo: number | null;
  bel: number | null;
  boyun: number | null;
  kalca: number | null;
  gogus: number | null;
  kol: number | null;
  bacak: number | null;
};

export type Uyku = {
  id: number;
  tarih: string;
  yatis: string;
  kalkis: string;
  sure_dk: number;
  kalite: number | null;
  notlar: string | null;
};

export type SuKaydi = { id: number; tarih: string; zaman: string; ml: number };

// ---------- Tarih yardımcıları (yerel saat) ----------

function pad(n: number) {
  return String(n).padStart(2, '0');
}

export function tarihStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function gunEkle(tarih: string, gun: number): string {
  const [y, m, d] = tarih.split('-').map(Number);
  return tarihStr(new Date(y, m - 1, d + gun));
}

export function tarihGoster(tarih: string): string {
  const bugun = tarihStr();
  if (tarih === bugun) return 'Bugün';
  if (tarih === gunEkle(bugun, -1)) return 'Dün';
  const [y, m, d] = tarih.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', weekday: 'short' });
}

export function saatStr(d: Date = new Date()): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// ---------- Profil ----------

export function profilGetir(db: SQLiteDatabase) {
  return db.getFirstAsync<Profil>('SELECT boy, yas, cinsiyet, aktivite, hedef_ayar, hedef_kilo FROM profil WHERE id = 1');
}

export function profilKaydet(db: SQLiteDatabase, p: Profil) {
  return db.runAsync(
    `INSERT INTO profil (id, boy, yas, cinsiyet, aktivite, hedef_ayar, hedef_kilo) VALUES (1, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET boy = excluded.boy, yas = excluded.yas, cinsiyet = excluded.cinsiyet,
       aktivite = excluded.aktivite, hedef_ayar = excluded.hedef_ayar, hedef_kilo = excluded.hedef_kilo`,
    p.boy, p.yas, p.cinsiyet, p.aktivite, p.hedef_ayar, p.hedef_kilo,
  );
}

// ---------- Öğünler ----------

export function ogunleriGetir(db: SQLiteDatabase, tarih: string) {
  return db.getAllAsync<Ogun>('SELECT * FROM ogunler WHERE tarih = ? ORDER BY id', tarih);
}

export function ogunEkle(db: SQLiteDatabase, o: Omit<Ogun, 'id'>) {
  return db.runAsync(
    'INSERT INTO ogunler (tarih, ogun, yemek, gram, kcal, protein, karb, yag, kaynak) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    o.tarih, o.ogun, o.yemek, o.gram, o.kcal, o.protein, o.karb, o.yag, o.kaynak,
  );
}

export function ogunSil(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM ogunler WHERE id = ?', id);
}

export async function gunlukToplam(db: SQLiteDatabase, tarih: string) {
  const r = await db.getFirstAsync<{ kcal: number; protein: number; karb: number; yag: number }>(
    `SELECT COALESCE(SUM(kcal),0) kcal, COALESCE(SUM(protein),0) protein,
            COALESCE(SUM(karb),0) karb, COALESCE(SUM(yag),0) yag FROM ogunler WHERE tarih = ?`,
    tarih,
  );
  return r ?? { kcal: 0, protein: 0, karb: 0, yag: 0 };
}

// ---------- Ölçümler ----------

export function olcumleriGetir(db: SQLiteDatabase, limit = 60) {
  return db.getAllAsync<Olcum>('SELECT * FROM olcumler ORDER BY tarih DESC, id DESC LIMIT ?', limit);
}

export function olcumEkle(db: SQLiteDatabase, o: Omit<Olcum, 'id'>) {
  return db.runAsync(
    'INSERT INTO olcumler (tarih, kilo, bel, boyun, kalca, gogus, kol, bacak) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    o.tarih, o.kilo, o.bel, o.boyun, o.kalca, o.gogus, o.kol, o.bacak,
  );
}

export function olcumSil(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM olcumler WHERE id = ?', id);
}

/** Her alan için en son girilen değer (kilo bugün, bel geçen hafta girilmiş olabilir). */
export async function sonDegerler(db: SQLiteDatabase) {
  const alanlar = ['kilo', 'bel', 'boyun', 'kalca', 'gogus', 'kol', 'bacak'] as const;
  const sonuc: Record<(typeof alanlar)[number], number | null> = {
    kilo: null, bel: null, boyun: null, kalca: null, gogus: null, kol: null, bacak: null,
  };
  for (const a of alanlar) {
    const r = await db.getFirstAsync<{ v: number }>(
      `SELECT ${a} v FROM olcumler WHERE ${a} IS NOT NULL ORDER BY tarih DESC, id DESC LIMIT 1`,
    );
    sonuc[a] = r?.v ?? null;
  }
  return sonuc;
}

// ---------- Uyku ----------

export function uykulariGetir(db: SQLiteDatabase, limit = 30) {
  return db.getAllAsync<Uyku>('SELECT * FROM uyku ORDER BY tarih DESC, id DESC LIMIT ?', limit);
}

export function uykuEkle(db: SQLiteDatabase, u: Omit<Uyku, 'id'>) {
  return db.runAsync(
    'INSERT INTO uyku (tarih, yatis, kalkis, sure_dk, kalite, notlar) VALUES (?, ?, ?, ?, ?, ?)',
    u.tarih, u.yatis, u.kalkis, u.sure_dk, u.kalite, u.notlar,
  );
}

export function uykuSil(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM uyku WHERE id = ?', id);
}

// ---------- Su ----------

export function suEkle(db: SQLiteDatabase, ml: number, zaman: Date = new Date()) {
  return db.runAsync('INSERT INTO su (tarih, zaman, ml) VALUES (?, ?, ?)', tarihStr(zaman), saatStr(zaman), ml);
}

export function suKayitlari(db: SQLiteDatabase, tarih: string) {
  return db.getAllAsync<SuKaydi>('SELECT * FROM su WHERE tarih = ? ORDER BY id DESC', tarih);
}

export async function suToplam(db: SQLiteDatabase, tarih: string) {
  const r = await db.getFirstAsync<{ t: number }>('SELECT COALESCE(SUM(ml),0) t FROM su WHERE tarih = ?', tarih);
  return r?.t ?? 0;
}

export function suSil(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM su WHERE id = ?', id);
}

// ---------- Ayarlar (anahtar/değer, JSON) ----------

export async function ayarGetir<T>(db: SQLiteDatabase, anahtar: string, varsayilan: T): Promise<T> {
  const r = await db.getFirstAsync<{ deger: string }>('SELECT deger FROM ayarlar WHERE anahtar = ?', anahtar);
  if (!r) return varsayilan;
  try {
    return { ...varsayilan, ...JSON.parse(r.deger) };
  } catch {
    return varsayilan;
  }
}

export function ayarKaydet(db: SQLiteDatabase, anahtar: string, deger: unknown) {
  return db.runAsync(
    'INSERT INTO ayarlar (anahtar, deger) VALUES (?, ?) ON CONFLICT(anahtar) DO UPDATE SET deger = excluded.deger',
    anahtar, JSON.stringify(deger),
  );
}
