import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aramaMetni } from './metin.ts';
import { offUrunCozumle } from './offCozumle.ts';

test('Türkçe arama sadeleştirme', () => {
  assert.equal(aramaMetni('Çiğ Köfte'), 'cig kofte');
  assert.equal(aramaMetni('İÇİM Yarım Yağlı'), 'icim yarim yagli');
  assert.equal(aramaMetni('Tavuk göğsü (ızgara/fırın, derisiz)'), 'tavuk gogsu izgara firin derisiz');
  assert.equal(aramaMetni('Dana kıyma (%20 yağlı)'), 'dana kiyma %20 yagli');
});

test('Open Food Facts ürün çözümleme', () => {
  const u = offUrunCozumle({
    code: '8690526069500',
    product_name: 'Lifalif',
    brands: ['Eti'],
    serving_quantity: '40',
    serving_size: '40 g',
    nutriments: { 'energy-kcal_100g': 360, proteins_100g: 14, carbohydrates_100g: 53, fat_100g: 7.5, salt_100g: 0.02, sodium_100g: 0.008 },
  });
  assert.ok(u);
  assert.equal(u.ad, 'Eti Lifalif');
  assert.equal(u.sodyum, 8);
  assert.equal(u.potasyum, null);
  assert.deepEqual(u.porsiyon, { ad: '1 porsiyon (40 g)', gram: 40 });
  assert.equal(u.supheli, false);
  // sodyum yoksa tuzdan: 1.25 g tuz -> 500 mg sodyum; kJ'den kcal
  const v = offUrunCozumle({ code: '1', product_name: 'X', nutriments: { 'energy-kj_100g': 418.4, salt_100g: 1.25, proteins_100g: 1, carbohydrates_100g: 1, fat_100g: 1 } });
  assert.equal(v?.kcal, 100);
  assert.equal(v?.sodyum, 500);
  assert.equal(v?.supheli, true); // 4+4+9=17 kcal ≠ 100
  assert.equal(offUrunCozumle({ code: '2', product_name: 'Y', nutriments: {} }), null);
});
