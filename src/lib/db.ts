import type { SQLiteDatabase } from 'expo-sqlite';
import type { Cinsiyet } from './calc';
import fatsecretVerisi from '../data/kisisel/fatsecret.json';
import usdaVerisi from '../data/besinler-usda.json';
import { aramaMetni } from './metin';
import type { GunTipi, GunVerisi, KocProgram } from './koc';

export const DB_ADI = 'bulut.db';
const DB_SURUM = 4;

/** SQLiteProvider onInit: tabloları oluşturur, ileride sürüm bazlı göç (migration) ekler. */
export async function veritabaniHazirla(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const surum = row?.user_version ?? 0;
  if (surum >= DB_SURUM) {
    await genelVeriyiAktar(db);
    await kisiselVeriyiAktar(db);
    return;
  }

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
  if (surum < 2) {
    // Ek besin değerleri (bilinmiyorsa NULL) ve kişisel yiyecek listesi
    await db.execAsync(`
      ALTER TABLE ogunler ADD COLUMN sodyum REAL;
      ALTER TABLE ogunler ADD COLUMN potasyum REAL;
      ALTER TABLE ogunler ADD COLUMN lif REAL;
      ALTER TABLE ogunler ADD COLUMN seker REAL;
      ALTER TABLE ogunler ADD COLUMN doymus REAL;
      ALTER TABLE ogunler ADD COLUMN kolesterol REAL;
      ALTER TABLE profil ADD COLUMN sodyum_hedef REAL;
      ALTER TABLE profil ADD COLUMN potasyum_hedef REAL;
      CREATE TABLE IF NOT EXISTS besinler (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        ad TEXT NOT NULL UNIQUE COLLATE NOCASE,
        birim TEXT NOT NULL,
        referans REAL NOT NULL,
        varsayilan REAL,
        kcal REAL NOT NULL,
        protein REAL, karb REAL, yag REAL,
        doymus REAL, lif REAL, seker REAL,
        sodyum REAL, potasyum REAL, kolesterol REAL,
        kullanim INTEGER NOT NULL DEFAULT 0,
        son TEXT,
        kaynak TEXT NOT NULL DEFAULT 'elle'
      );
    `);
  }
  if (surum < 3) {
    // Türkçe karakterden bağımsız arama, kategori, porsiyon listesi ve barkod
    await db.execAsync(`
      ALTER TABLE besinler ADD COLUMN arama TEXT;
      ALTER TABLE besinler ADD COLUMN kategori TEXT;
      ALTER TABLE besinler ADD COLUMN porsiyonlar TEXT;
      ALTER TABLE besinler ADD COLUMN kod TEXT;
      CREATE INDEX IF NOT EXISTS besinler_kullanim ON besinler(kullanim DESC);
    `);
    const mevcut = await db.getAllAsync<{ id: number; ad: string }>('SELECT id, ad FROM besinler');
    for (const b of mevcut) await db.runAsync('UPDATE besinler SET arama = ? WHERE id = ?', aramaMetni(b.ad), b.id);
  }
  if (surum < 4) {
    // 8 haftalık koçluk programı ve günlük check-in; koç dosyasındaki ek ölçüler
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS koc_program (
        id INTEGER PRIMARY KEY CHECK (id = 1),
        baslangic TEXT NOT NULL,
        hafta INTEGER NOT NULL DEFAULT 8,
        baslangic_kilo REAL NOT NULL,
        haftalik_hedef REAL NOT NULL,
        normal_p REAL NOT NULL, normal_y REAL NOT NULL, normal_k REAL NOT NULL,
        yuksek_p REAL NOT NULL, yuksek_y REAL NOT NULL, yuksek_k REAL NOT NULL,
        adim_hedef INTEGER NOT NULL,
        sodyum_min REAL NOT NULL, sodyum_max REAL NOT NULL,
        potasyum_min REAL NOT NULL, potasyum_max REAL NOT NULL,
        su_hedef_l REAL NOT NULL,
        yuksek_gun_hafta INTEGER NOT NULL DEFAULT 1,
        notlar TEXT
      );
      CREATE TABLE IF NOT EXISTS koc_gunluk (
        tarih TEXT PRIMARY KEY NOT NULL,
        gun_tipi TEXT NOT NULL DEFAULT 'normal',
        kilo REAL, uyku REAL,
        stres INTEGER, enerji INTEGER, aclik INTEGER, sindirim INTEGER,
        kardiyo TEXT, adim INTEGER, notlar TEXT
      );
      ALTER TABLE olcumler ADD COLUMN omuz REAL;
      ALTER TABLE olcumler ADD COLUMN kol_sol REAL;
      ALTER TABLE olcumler ADD COLUMN bacak_sol REAL;
      ALTER TABLE olcumler ADD COLUMN baldir REAL;
    `);
  }
  await db.execAsync(`PRAGMA user_version = ${DB_SURUM}`);
  await genelVeriyiAktar(db);
  await kisiselVeriyiAktar(db);
}

type UsdaBesin = {
  ad: string;
  kategori: string;
  kaynak: string;
  fdc: number | null;
  kcal: number;
  porsiyonlar: { ad: string; gram: number }[];
} & Partial<Record<EkAlan | 'protein' | 'karb' | 'yag', number | null>>;

/** Uygulamayla gelen doğrulanmış USDA listesini yükler; veri sürümü değişince günceller. Kişisel kayıtlara dokunmaz. */
async function genelVeriyiAktar(db: SQLiteDatabase) {
  const veri = usdaVerisi as unknown as { surum: string; besinler: UsdaBesin[] };
  const anahtar = `genel_veri_${veri.surum}`;
  if (await db.getFirstAsync('SELECT 1 FROM ayarlar WHERE anahtar = ?', anahtar)) return;
  await db.withTransactionAsync(async () => {
    for (const b of veri.besinler) {
      await db.runAsync(
        `INSERT INTO besinler (ad, arama, kategori, birim, referans, varsayilan, kcal, protein, karb, yag, doymus, lif, seker, sodyum, potasyum, kolesterol, porsiyonlar, kod, kullanim, kaynak)
         VALUES (?, ?, ?, 'g', 100, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'usda')
         ON CONFLICT(ad) DO UPDATE SET kcal = excluded.kcal, protein = excluded.protein, karb = excluded.karb, yag = excluded.yag,
           doymus = excluded.doymus, lif = excluded.lif, seker = excluded.seker, sodyum = excluded.sodyum,
           potasyum = excluded.potasyum, kolesterol = excluded.kolesterol, porsiyonlar = excluded.porsiyonlar,
           kategori = excluded.kategori, arama = excluded.arama
         WHERE besinler.kaynak = 'usda'`,
        b.ad, aramaMetni(b.ad), b.kategori, b.porsiyonlar[0]?.gram ?? 100, b.kcal, b.protein ?? null, b.karb ?? null, b.yag ?? null,
        b.doymus ?? null, b.lif ?? null, b.seker ?? null, b.sodyum ?? null, b.potasyum ?? null, b.kolesterol ?? null,
        JSON.stringify(b.porsiyonlar), b.fdc != null ? `fdc:${b.fdc}` : null,
      );
    }
    await db.runAsync('INSERT INTO ayarlar (anahtar, deger) VALUES (?, ?)', anahtar, JSON.stringify({ adet: veri.besinler.length }));
  });
}

type FatSecretVerisi = {
  besinler: (Omit<Besin, 'id' | 'kaynak'> & Record<string, unknown>)[];
  kayitlar: ({ tarih: string; ogun: string; ad: string; olcu: number; birim: string | null; birim_metin: string; kcal: number } & Partial<
    Record<EkAlan | 'protein' | 'karb' | 'yag', number>
  >)[];
};

/** src/data/kisisel/fatsecret.json içindeki yiyecek listesini ve geçmiş günlüğü bir kez içe aktarır. */
async function kisiselVeriyiAktar(db: SQLiteDatabase) {
  const veri = fatsecretVerisi as unknown as FatSecretVerisi;
  if (!veri.besinler.length && !veri.kayitlar.length) return;
  const tarihler = veri.kayitlar.map((k) => k.tarih).sort();
  const anahtar = `ice_aktarim_fatsecret_${tarihler[0] ?? ''}_${tarihler[tarihler.length - 1] ?? ''}_${veri.kayitlar.length}`;
  const yapildi = await db.getFirstAsync('SELECT 1 FROM ayarlar WHERE anahtar = ?', anahtar);
  if (yapildi) return;

  await db.withTransactionAsync(async () => {
    for (const b of veri.besinler) {
      await db.runAsync(
        `INSERT INTO besinler (ad, arama, birim, referans, varsayilan, kcal, protein, karb, yag, doymus, lif, seker, sodyum, potasyum, kolesterol, kullanim, son, kaynak)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'fatsecret')
         ON CONFLICT(ad) DO UPDATE SET kullanim = MAX(besinler.kullanim, excluded.kullanim)`,
        b.ad, aramaMetni(b.ad), b.birim, b.referans, b.varsayilan ?? null, b.kcal, b.protein ?? null, b.karb ?? null, b.yag ?? null,
        b.doymus ?? null, b.lif ?? null, b.seker ?? null, b.sodyum ?? null, b.potasyum ?? null, b.kolesterol ?? null,
        b.kullanim ?? 0, b.son ?? null,
      );
    }
    for (const k of veri.kayitlar) {
      const ad = k.birim ? k.ad : `${k.ad} (${k.birim_metin})`;
      await db.runAsync(
        `INSERT INTO ogunler (tarih, ogun, yemek, gram, kcal, protein, karb, yag, sodyum, potasyum, lif, seker, doymus, kolesterol, kaynak)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'fatsecret')`,
        k.tarih, k.ogun, ad, k.birim ? k.olcu : null, k.kcal, k.protein ?? 0, k.karb ?? 0, k.yag ?? 0,
        k.sodyum ?? null, k.potasyum ?? null, k.lif ?? null, k.seker ?? null, k.doymus ?? null, k.kolesterol ?? null,
      );
    }
    await db.runAsync('INSERT INTO ayarlar (anahtar, deger) VALUES (?, ?)', anahtar, JSON.stringify({ tarih: new Date().toISOString() }));
  });
}

// ---------- Tipler ----------

export type Profil = {
  boy: number;
  yas: number;
  cinsiyet: Cinsiyet;
  aktivite: number;
  hedef_ayar: number;
  hedef_kilo: number | null;
  sodyum_hedef: number | null;
  potasyum_hedef: number | null;
};

/** Kalori ve makrolar dışındaki besin değerleri; bilinmiyorsa null. */
export const EK_ALANLAR = ['sodyum', 'potasyum', 'lif', 'seker', 'doymus', 'kolesterol'] as const;
export type EkAlan = (typeof EK_ALANLAR)[number];
export type EkDegerler = Record<EkAlan, number | null>;

export type Besin = {
  id: number;
  ad: string;
  birim: 'g' | 'ml' | 'porsiyon';
  referans: number;
  varsayilan: number | null;
  kcal: number;
  protein: number | null;
  karb: number | null;
  yag: number | null;
  kullanim: number;
  son: string | null;
  kaynak: string;
  kategori: string | null;
  /** JSON: { ad, gram }[] */
  porsiyonlar: string | null;
  kod: string | null;
} & EkDegerler;

export function porsiyonlariOku(b: Pick<Besin, 'porsiyonlar'>): { ad: string; gram: number }[] {
  try {
    return b.porsiyonlar ? JSON.parse(b.porsiyonlar) : [];
  } catch {
    return [];
  }
}

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
} & EkDegerler;

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
  omuz: number | null;
  kol_sol: number | null;
  bacak_sol: number | null;
  baldir: number | null;
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
  return db.getFirstAsync<Profil>(
    'SELECT boy, yas, cinsiyet, aktivite, hedef_ayar, hedef_kilo, sodyum_hedef, potasyum_hedef FROM profil WHERE id = 1',
  );
}

export function profilKaydet(db: SQLiteDatabase, p: Profil) {
  return db.runAsync(
    `INSERT INTO profil (id, boy, yas, cinsiyet, aktivite, hedef_ayar, hedef_kilo, sodyum_hedef, potasyum_hedef)
     VALUES (1, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET boy = excluded.boy, yas = excluded.yas, cinsiyet = excluded.cinsiyet,
       aktivite = excluded.aktivite, hedef_ayar = excluded.hedef_ayar, hedef_kilo = excluded.hedef_kilo,
       sodyum_hedef = excluded.sodyum_hedef, potasyum_hedef = excluded.potasyum_hedef`,
    p.boy, p.yas, p.cinsiyet, p.aktivite, p.hedef_ayar, p.hedef_kilo, p.sodyum_hedef, p.potasyum_hedef,
  );
}

// ---------- Öğünler ----------

export function ogunleriGetir(db: SQLiteDatabase, tarih: string) {
  return db.getAllAsync<Ogun>('SELECT * FROM ogunler WHERE tarih = ? ORDER BY id', tarih);
}

export function ogunEkle(db: SQLiteDatabase, o: Omit<Ogun, 'id' | EkAlan> & Partial<EkDegerler>) {
  return db.runAsync(
    `INSERT INTO ogunler (tarih, ogun, yemek, gram, kcal, protein, karb, yag, sodyum, potasyum, lif, seker, doymus, kolesterol, kaynak)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    o.tarih, o.ogun, o.yemek, o.gram, o.kcal, o.protein, o.karb, o.yag,
    o.sodyum ?? null, o.potasyum ?? null, o.lif ?? null, o.seker ?? null, o.doymus ?? null, o.kolesterol ?? null,
    o.kaynak,
  );
}

export function ogunSil(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM ogunler WHERE id = ?', id);
}

export type GunlukToplam = { kcal: number; protein: number; karb: number; yag: number; kayit: number } & Record<EkAlan, number> &
  Record<`${EkAlan}_eksik`, number>;

/** Günlük toplamlar. *_eksik: o değeri bilinmeyen kayıt sayısı (toplam eksik olabilir). */
export async function gunlukToplam(db: SQLiteDatabase, tarih: string): Promise<GunlukToplam> {
  const ek = EK_ALANLAR.map((a) => `COALESCE(SUM(${a}),0) ${a}, SUM(CASE WHEN ${a} IS NULL THEN 1 ELSE 0 END) ${a}_eksik`).join(', ');
  const r = await db.getFirstAsync<GunlukToplam>(
    `SELECT COUNT(*) kayit, COALESCE(SUM(kcal),0) kcal, COALESCE(SUM(protein),0) protein,
            COALESCE(SUM(karb),0) karb, COALESCE(SUM(yag),0) yag, ${ek} FROM ogunler WHERE tarih = ?`,
    tarih,
  );
  return {
    ...r!,
    ...Object.fromEntries(EK_ALANLAR.flatMap((a) => [[a, r?.[a] ?? 0], [`${a}_eksik`, r?.[`${a}_eksik`] ?? 0]])),
  } as GunlukToplam;
}

// ---------- Yiyeceklerim ----------

/** Türkçe karakterden bağımsız arama. Boş sorguda en sık yenenler. Kendi kayıtların önce gelir. */
export function besinAra(db: SQLiteDatabase, sorgu: string, limit = 8) {
  const q = aramaMetni(sorgu);
  if (!q) {
    return db.getAllAsync<Besin>('SELECT * FROM besinler WHERE kullanim > 0 ORDER BY kullanim DESC, son DESC LIMIT ?', limit);
  }
  const kelimeler = q.split(' ').filter(Boolean).slice(0, 5);
  const kosul = kelimeler.map(() => 'arama LIKE ?').join(' AND ');
  return db.getAllAsync<Besin>(
    `SELECT * FROM besinler WHERE ${kosul}
     ORDER BY (arama LIKE ?) DESC, kullanim DESC, (kaynak = 'usda') DESC, length(ad) LIMIT ?`,
    ...kelimeler.map((k) => `%${k}%`), `${q}%`, limit,
  );
}

/** İnternetten (Open Food Facts) seçilen ürünü Yiyeceklerim'e ekler ve kaydını döner. */
export async function disBesinEkle(
  db: SQLiteDatabase,
  u: { kod: string; ad: string; kcal: number; protein: number | null; karb: number | null; yag: number | null; porsiyon: { ad: string; gram: number } | null } & EkDegerler,
) {
  await db.runAsync(
    `INSERT INTO besinler (ad, arama, kategori, birim, referans, varsayilan, kcal, protein, karb, yag, doymus, lif, seker, sodyum, potasyum, kolesterol, porsiyonlar, kod, kullanim, kaynak)
     VALUES (?, ?, 'Paketli ürün', 'g', 100, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'off')
     ON CONFLICT(ad) DO NOTHING`,
    u.ad, aramaMetni(u.ad), u.porsiyon?.gram ?? 100, u.kcal, u.protein, u.karb, u.yag, u.doymus, u.lif, u.seker,
    u.sodyum, u.potasyum, u.kolesterol, JSON.stringify(u.porsiyon ? [u.porsiyon] : []), `off:${u.kod}`,
  );
  return db.getFirstAsync<Besin>('SELECT * FROM besinler WHERE ad = ?', u.ad);
}

/** Seçilen yiyeceğin kullanım sayısını artırır. */
export function besinKullanildi(db: SQLiteDatabase, id: number, miktar: number | null) {
  return db.runAsync(
    `UPDATE besinler SET kullanim = kullanim + 1, son = ?, varsayilan = COALESCE(?, varsayilan) WHERE id = ?`,
    tarihStr(), miktar, id,
  );
}

/** Elle girilen yiyeceği 100 g (gram verildiyse) ya da 1 porsiyon başına listeye ekler/günceller. */
export function besinKaydet(
  db: SQLiteDatabase,
  b: { ad: string; gram: number | null; kcal: number; protein: number; karb: number; yag: number } & Partial<EkDegerler>,
) {
  const gramli = b.gram != null && b.gram > 0;
  const k = gramli ? 100 / (b.gram as number) : 1;
  const o = (v: number | null | undefined) => (v == null ? null : Math.round(v * k * 100) / 100);
  return db.runAsync(
    `INSERT INTO besinler (ad, arama, birim, referans, varsayilan, kcal, protein, karb, yag, doymus, lif, seker, sodyum, potasyum, kolesterol, kullanim, son, kaynak)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'elle')
     ON CONFLICT(ad) DO UPDATE SET kullanim = besinler.kullanim + 1, son = excluded.son,
       varsayilan = COALESCE(excluded.varsayilan, besinler.varsayilan)`,
    b.ad, aramaMetni(b.ad), gramli ? 'g' : 'porsiyon', gramli ? 100 : 1, b.gram, o(b.kcal), o(b.protein), o(b.karb), o(b.yag),
    o(b.doymus), o(b.lif), o(b.seker), o(b.sodyum), o(b.potasyum), o(b.kolesterol), tarihStr(),
  );
}

// ---------- Ölçümler ----------

export function olcumleriGetir(db: SQLiteDatabase, limit = 60) {
  return db.getAllAsync<Olcum>('SELECT * FROM olcumler ORDER BY tarih DESC, id DESC LIMIT ?', limit);
}

export function olcumEkle(db: SQLiteDatabase, o: Omit<Olcum, 'id'>) {
  return db.runAsync(
    `INSERT INTO olcumler (tarih, kilo, bel, boyun, kalca, gogus, kol, bacak, omuz, kol_sol, bacak_sol, baldir)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    o.tarih, o.kilo, o.bel, o.boyun, o.kalca, o.gogus, o.kol, o.bacak, o.omuz, o.kol_sol, o.bacak_sol, o.baldir,
  );
}

export function olcumSil(db: SQLiteDatabase, id: number) {
  return db.runAsync('DELETE FROM olcumler WHERE id = ?', id);
}

/** Her alan için en son girilen değer (kilo bugün, bel geçen hafta girilmiş olabilir). */
export async function sonDegerler(db: SQLiteDatabase) {
  const alanlar = ['kilo', 'bel', 'boyun', 'kalca', 'gogus', 'kol', 'bacak', 'omuz', 'kol_sol', 'bacak_sol', 'baldir'] as const;
  const sonuc = Object.fromEntries(alanlar.map((a) => [a, null])) as Record<(typeof alanlar)[number], number | null>;
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

// ---------- Koçluk ----------

export function kocProgramGetir(db: SQLiteDatabase) {
  return db.getFirstAsync<KocProgram>('SELECT * FROM koc_program WHERE id = 1');
}

export function kocProgramKaydet(db: SQLiteDatabase, p: KocProgram) {
  const alanlar = [
    'baslangic', 'hafta', 'baslangic_kilo', 'haftalik_hedef', 'normal_p', 'normal_y', 'normal_k', 'yuksek_p', 'yuksek_y', 'yuksek_k',
    'adim_hedef', 'sodyum_min', 'sodyum_max', 'potasyum_min', 'potasyum_max', 'su_hedef_l', 'yuksek_gun_hafta', 'notlar',
  ] as const;
  return db.runAsync(
    `INSERT INTO koc_program (id, ${alanlar.join(', ')}) VALUES (1, ${alanlar.map(() => '?').join(', ')})
     ON CONFLICT(id) DO UPDATE SET ${alanlar.map((a) => `${a} = excluded.${a}`).join(', ')}`,
    ...alanlar.map((a) => p[a]),
  );
}

export type KocGun = {
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
  notlar: string | null;
};

export function kocGunGetir(db: SQLiteDatabase, tarih: string) {
  return db.getFirstAsync<KocGun>('SELECT * FROM koc_gunluk WHERE tarih = ?', tarih);
}

/** Günlük check-in'i kaydeder; kilo girildiyse o günün ölçüm kaydına da yazar (kilo grafiği için). */
export async function kocGunKaydet(db: SQLiteDatabase, g: KocGun) {
  await db.runAsync(
    `INSERT INTO koc_gunluk (tarih, gun_tipi, kilo, uyku, stres, enerji, aclik, sindirim, kardiyo, adim, notlar)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(tarih) DO UPDATE SET gun_tipi = excluded.gun_tipi, kilo = excluded.kilo, uyku = excluded.uyku,
       stres = excluded.stres, enerji = excluded.enerji, aclik = excluded.aclik, sindirim = excluded.sindirim,
       kardiyo = excluded.kardiyo, adim = excluded.adim, notlar = excluded.notlar`,
    g.tarih, g.gun_tipi, g.kilo, g.uyku, g.stres, g.enerji, g.aclik, g.sindirim, g.kardiyo, g.adim, g.notlar,
  );
  if (g.kilo != null) {
    const var_ = await db.getFirstAsync<{ id: number }>(
      'SELECT id FROM olcumler WHERE tarih = ? AND kilo IS NOT NULL ORDER BY id DESC LIMIT 1', g.tarih,
    );
    if (var_) await db.runAsync('UPDATE olcumler SET kilo = ? WHERE id = ?', g.kilo, var_.id);
    else await db.runAsync('INSERT INTO olcumler (tarih, kilo) VALUES (?, ?)', g.tarih, g.kilo);
  }
}

export function kocGunTipi(db: SQLiteDatabase, tarih: string) {
  return db.getFirstAsync<{ gun_tipi: GunTipi }>('SELECT gun_tipi FROM koc_gunluk WHERE tarih = ?', tarih).then((r) => r?.gun_tipi ?? 'normal');
}

/** Verilen günler için check-in + uygulamadaki beslenme, su, uyku ve tartı kayıtlarını birleştirir. */
export async function kocGunVerileri(db: SQLiteDatabase, tarihler: string[]): Promise<GunVerisi[]> {
  if (!tarihler.length) return [];
  const yer = tarihler.map(() => '?').join(', ');
  const [checkin, beslenme, su, uyku, tarti] = await Promise.all([
    db.getAllAsync<KocGun>(`SELECT * FROM koc_gunluk WHERE tarih IN (${yer})`, ...tarihler),
    db.getAllAsync<{ tarih: string; kcal: number; protein: number; yag: number; karb: number; sodyum: number | null; potasyum: number | null }>(
      `SELECT tarih, SUM(kcal) kcal, SUM(protein) protein, SUM(yag) yag, SUM(karb) karb,
              SUM(sodyum) sodyum, SUM(potasyum) potasyum FROM ogunler WHERE tarih IN (${yer}) GROUP BY tarih`, ...tarihler),
    db.getAllAsync<{ tarih: string; ml: number }>(`SELECT tarih, SUM(ml) ml FROM su WHERE tarih IN (${yer}) GROUP BY tarih`, ...tarihler),
    db.getAllAsync<{ tarih: string; dk: number }>(`SELECT tarih, MAX(sure_dk) dk FROM uyku WHERE tarih IN (${yer}) GROUP BY tarih`, ...tarihler),
    db.getAllAsync<{ tarih: string; kilo: number }>(
      `SELECT tarih, kilo FROM olcumler WHERE kilo IS NOT NULL AND tarih IN (${yer}) ORDER BY id`, ...tarihler),
  ]);
  const harita = <T extends { tarih: string }>(l: T[]) => new Map(l.map((x) => [x.tarih, x]));
  const c = harita(checkin), bs = harita(beslenme), s = harita(su), u = harita(uyku), t = harita(tarti);
  return tarihler.map((tarih) => {
    const g = c.get(tarih), b = bs.get(tarih);
    return {
      tarih,
      gun_tipi: g?.gun_tipi ?? 'normal',
      kilo: g?.kilo ?? t.get(tarih)?.kilo ?? null,
      uyku: g?.uyku ?? (u.get(tarih) ? Math.round((u.get(tarih)!.dk / 60) * 10) / 10 : null),
      stres: g?.stres ?? null,
      enerji: g?.enerji ?? null,
      aclik: g?.aclik ?? null,
      sindirim: g?.sindirim ?? null,
      kardiyo: g?.kardiyo ?? null,
      adim: g?.adim ?? null,
      kcal: b?.kcal ?? null,
      protein: b?.protein ?? null,
      yag: b?.yag ?? null,
      karb: b?.karb ?? null,
      sodyum: b?.sodyum ?? null,
      potasyum: b?.potasyum ?? null,
      su_l: s.get(tarih) ? Math.round((s.get(tarih)!.ml / 1000) * 10) / 10 : null,
    };
  });
}
