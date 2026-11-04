import { test } from 'node:test';
import assert from 'node:assert/strict';
import { VARSAYILAN_PROGRAM as P, degerlendir, gunHedefi, haftaGunleri, haftaNo, haftaOzeti, hedefKilo, type GunVerisi } from './koc.ts';

const bos: Omit<GunVerisi, 'tarih'> = {
  gun_tipi: 'normal', kilo: null, uyku: null, stres: null, enerji: null, aclik: null, sindirim: null, kardiyo: null, adim: null,
  kcal: null, protein: null, yag: null, karb: null, sodyum: null, potasyum: null, su_l: null,
};

test('koç dosyasındaki hedefler', () => {
  assert.equal(gunHedefi(P, 'normal').kalori, 1855);
  assert.equal(gunHedefi(P, 'yuksek').kalori, 2015);
  assert.equal(hedefKilo(P, 8), 67.2); // dosyadaki "8. hafta sonu hedef"
});

test('hafta hesapları', () => {
  assert.equal(haftaNo(P, '2026-11-02'), 1);
  assert.equal(haftaNo(P, '2026-11-08'), 1);
  assert.equal(haftaNo(P, '2026-11-09'), 2);
  assert.equal(haftaNo(P, '2026-12-27'), 8);
  assert.equal(haftaNo(P, '2026-11-01'), 0);
  assert.deepEqual(haftaGunleri(P, 2).slice(0, 2), ['2026-11-09', '2026-11-10']);
  assert.equal(haftaGunleri(P, 8)[0], '2026-12-21'); // dosyadaki "8. hafta 21 Ara"
});

test('dosyadaki 1. hafta ortalamaları', () => {
  // Kilo Takip Tablosu, 2-4 Kasım
  const gunler: GunVerisi[] = [
    { ...bos, tarih: '2026-11-02', kilo: 71.2, uyku: 8, stres: 2, enerji: 4, kardiyo: '30dk ant sonu', adim: 12008, protein: 153, yag: 47, karb: 244, kcal: 2010 },
    { ...bos, tarih: '2026-11-03', kilo: 70.8, uyku: 8, stres: 2, enerji: 4, aclik: 4, kardiyo: '45dk yürüyüş', adim: 12003, protein: 146, yag: 52, karb: 210, kcal: 1893 },
    { ...bos, tarih: '2026-11-04', gun_tipi: 'yuksek', protein: 160, yag: 52, karb: 377, kcal: 2619 },
    { ...bos, tarih: '2026-11-05', kardiyo: 'Yapılmadı' },
  ];
  const oz = haftaOzeti(gunler);
  assert.equal(oz.ort.kilo, 71);
  assert.equal(oz.ort.adim, 12005.5);
  assert.equal(Math.round(oz.ort.kcal!), 2174);
  assert.equal(oz.kardiyoGun, 2);
  assert.equal(oz.yuksekGun, 1);
  const b = degerlendir(P, oz, null, 4);
  assert.ok(b.some((x) => x.konu === 'Tartı'), 'az tartı uyarısı');
  assert.ok(b.some((x) => x.konu === 'Adım' && x.seviye === 'iyi'));
});

test('kilo gidişatı kuralları', () => {
  const hafta = (kilo: number): GunVerisi[] => Array.from({ length: 5 }, (_, i) => ({ ...bos, tarih: `2026-11-1${i}`, kilo }));
  const k = (kilo: number, onceki: number) => degerlendir(P, haftaOzeti(hafta(kilo)), onceki).find((x) => x.konu === 'Kilo')!;
  assert.equal(k(70.5, 71).seviye, 'iyi'); // -0.5
  assert.equal(k(70.9, 71).seviye, 'uyari'); // -0.1: geride
  assert.equal(k(71.5, 71).seviye, 'onemli'); // artış
  assert.equal(k(69.8, 71).seviye, 'uyari'); // çok hızlı
});
