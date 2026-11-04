import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  bmr,
  makroHedef,
  navyYagOrani,
  sayiOku,
  suHedefiMl,
  tdee,
  uykuSuresiDk,
  vki,
  vkiKategori,
} from './calc.ts';

test('sayiOku virgüllü ondalığı kabul eder', () => {
  assert.equal(sayiOku('72,5'), 72.5);
  assert.equal(sayiOku(' 80 '), 80);
  assert.equal(sayiOku(''), null);
  assert.equal(sayiOku('abc'), null);
});

test('VKİ', () => {
  assert.equal(Math.round(vki(80, 180) * 10) / 10, 24.7);
  assert.equal(vkiKategori(24.7), 'Normal');
  assert.equal(vkiKategori(31), 'Obez');
});

test('BMR (Mifflin-St Jeor) ve TDEE', () => {
  assert.equal(bmr(80, 180, 30, 'erkek'), 1780);
  assert.equal(bmr(60, 165, 30, 'kadin'), 1320.25);
  assert.equal(Math.round(tdee(1780, 1.55)), 2759);
});

test('US Navy yağ oranı', () => {
  const erkek = navyYagOrani('erkek', 180, 85, 38);
  assert.ok(erkek && erkek > 16 && erkek < 19, `erkek: ${erkek}`);
  const kadin = navyYagOrani('kadin', 165, 75, 33, 100);
  assert.ok(kadin && kadin > 28 && kadin < 33, `kadın: ${kadin}`);
  assert.equal(navyYagOrani('erkek', 180, 30, 38), null);
  assert.equal(navyYagOrani('kadin', 165, 75, 33), null);
});

test('su hedefi ve makrolar', () => {
  assert.equal(suHedefiMl(80), 2800);
  const m = makroHedef(2500, 80);
  assert.equal(m.protein, 144);
  assert.equal(m.yag, 69);
  assert.ok(Math.abs(m.protein * 4 + m.karb * 4 + m.yag * 9 - 2500) < 10);
});

test('uyku süresi gece yarısını geçer', () => {
  assert.equal(uykuSuresiDk('23:30', '07:00'), 450);
  assert.equal(uykuSuresiDk('01:00', '08:15'), 435);
  assert.equal(uykuSuresiDk('25:00', '07:00'), null);
});

test('porsiyon ölçekleme', async () => {
  const { porsiyonOlcekle } = await import('./calc.ts');
  const pilav = { ad: 'Pilav', gram: 200, kcal: 260, protein: 5, karb: 56, yag: 2 };
  assert.deepEqual(porsiyonOlcekle(pilav, 100), { ad: 'Pilav', gram: 100, kcal: 130, protein: 2.5, karb: 28, yag: 1 });
  assert.equal(porsiyonOlcekle({ ...pilav, gram: 0 }, 50).kcal, 260);
});
