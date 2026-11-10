import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PROFILE, addDays, weeklySummaries, evaluateWeek, movingAverage,
  recoveryScore, dayAdherence, projection, phaseOf, toCSV, weeklyReport, kcalFromMacros,
} from '../js/coach.js';

const targets = { kcal: 2400, protein: 200, carbs: 250, fat: 65, steps: 10000, cardioMin: 0 };
const profile = (over = {}) => ({ ...DEFAULT_PROFILE, startDate: '2026-01-05', targets: { ...targets }, ...over });

// İki haftalık veri: 1. hafta w1 kg, 2. hafta w2 kg ortalaması
function twoWeeks(w1, w2, extra = {}) {
  const out = [];
  for (let i = 0; i < 14; i++) {
    out.push({
      date: addDays('2026-01-05', i), weight: i < 7 ? w1 : w2,
      kcal: 2400, protein: 200, steps: 10000, sleep: 7.5, stress: 4, energy: 7, hunger: 5, trained: i % 2 === 0,
      ...extra,
    });
  }
  return out;
}

test('haftalık özet ve değişim yüzdesi', () => {
  const weeks = weeklySummaries(twoWeeks(80, 79.4), profile());
  assert.equal(weeks.length, 2);
  assert.equal(weeks[0].avgWeight, 80);
  assert.equal(weeks[1].changeKg, -0.6);
  assert.equal(weeks[1].changePct, -0.75);
  assert.equal(weeks[1].adherence, 100);
});

test('hedefte kayıp → plan devam', () => {
  const p = profile();
  const w = weeklySummaries(twoWeeks(80, 79.4), p)[1];
  const r = evaluateWeek(w, p, '2026-01-19');
  assert.equal(r.status, 'ok');
  assert.deepEqual(r.newTargets, p.targets);
});

test('yavaş kayıp → kalori düşer, protein sabit', () => {
  const p = profile();
  const w = weeklySummaries(twoWeeks(80, 79.9), p)[1];
  const r = evaluateWeek(w, p, '2026-01-19');
  assert.equal(r.status, 'slow');
  assert.ok(r.newTargets.kcal < 2400 && r.newTargets.kcal >= 2400 * 0.88);
  assert.equal(r.newTargets.protein, 200);
  assert.ok(r.newTargets.fat >= Math.round(80 * 0.6));
});

test('karb tabanında → adım artırılır', () => {
  const p = profile({ targets: { ...targets, carbs: 80, fat: 48, kcal: 1552 } });
  const w = weeklySummaries(twoWeeks(80, 80, { kcal: 1552 }), p)[1];
  const r = evaluateWeek(w, p, '2026-01-19');
  assert.equal(r.status, 'slow');
  assert.equal(r.newTargets.carbs, 80);
  assert.ok(r.newTargets.steps > 10000);
});

test('hızlı kayıp → kalori artar', () => {
  const p = profile();
  const w = weeklySummaries(twoWeeks(80, 78.8), p)[1];
  const r = evaluateWeek(w, p, '2026-01-19');
  assert.equal(r.status, 'fast');
  assert.ok(r.newTargets.kcal > 2400);
});

test('düşük uyum → değişiklik yok', () => {
  const p = profile();
  const w = weeklySummaries(twoWeeks(80, 79.95, { kcal: 3000, steps: 4000 }), p)[1];
  const r = evaluateWeek(w, p, '2026-01-19');
  assert.equal(r.status, 'adherence');
  assert.deepEqual(r.newTargets, p.targets);
});

test('kötü toparlanma → refeed', () => {
  const p = profile();
  const w = weeklySummaries(twoWeeks(80, 79.5, { sleep: 5, stress: 9, energy: 2, hunger: 9 }), p)[1];
  const r = evaluateWeek(w, p, '2026-01-19');
  assert.equal(r.status, 'recovery');
  assert.ok(r.flags.length >= 3);
});

test('yetersiz veri', () => {
  const p = profile();
  const w = weeklySummaries(twoWeeks(80, 79.4).slice(0, 7), p)[0];
  assert.equal(evaluateWeek(w, p).status, 'data');
});

test('peak week ve reverse fazları', () => {
  const p = profile({ showDate: '2026-01-22' });
  assert.equal(phaseOf(p, '2026-01-19'), 'Peak week');
  assert.equal(phaseOf(p, '2026-01-25'), 'Yarış sonrası (reverse)');
  const w = weeklySummaries(twoWeeks(80, 79.9), p)[1];
  assert.equal(evaluateWeek(w, p, '2026-01-19').status, 'peak');
});

test('bulk: yavaş artış → kalori artar', () => {
  const p = profile({ goal: 'bulk', targetRatePct: 0.25 });
  const w = weeklySummaries(twoWeeks(80, 80), p)[1];
  const r = evaluateWeek(w, p, '2026-01-19');
  assert.equal(r.status, 'slow');
  assert.ok(r.newTargets.kcal > 2400);
});

test('projeksiyon agresif hedef uyarısı', () => {
  const p = profile({ showDate: '2026-03-02', targetWeight: 70 });
  const pr = projection(p, 79.4, '2026-01-19');
  assert.equal(pr.daysLeft, 42);
  assert.ok(pr.requiredPct > 1.5);
  const w = weeklySummaries(twoWeeks(80, 79.4), p)[1];
  const r = evaluateWeek(w, p, '2026-01-19');
  assert.ok(r.flags.some((f) => f.includes('gerekiyor')));
});

test('yardımcılar', () => {
  assert.equal(kcalFromMacros(200, 250, 65), 2385);
  assert.equal(recoveryScore({ sleep: 8, stress: 1, energy: 10 }), 100);
  assert.equal(dayAdherence({ kcal: 2400, protein: 150, steps: 10000 }, targets), 2 / 3);
  const ma = movingAverage([{ date: '2026-01-01', weight: 80 }, { date: '2026-01-02', weight: 79 }]);
  assert.equal(ma[1].avg, 79.5);
  const csv = toCSV([{ date: '2026-01-01', weight: 80, note: 'a, b', trained: true }]);
  assert.ok(csv.includes('"a, b"') && csv.includes('evet'));
  const p = profile();
  const w = weeklySummaries(twoWeeks(80, 79.4), p)[1];
  assert.ok(weeklyReport(w, evaluateWeek(w, p, '2026-01-19'), p, '2026-01-19').includes('Hafta 2'));
});

import { parseCSV, parseDateTR } from '../js/coach.js';

test('CSV içe aktarma: Sheets yapıştırma (sekme, ondalık virgül, TR tarih)', () => {
  const text = 'Tarih\tKilo\tUyku\tAdım\tKalori\tAntrenman\tNot\n10.11.2026\t80,4\t7,5\t12.500\t2400\tevet\tiyi\n11.11.2026\t80,1\t\t9000\t2350\t\t\nbozuk\t1';
  const r = parseCSV(text);
  assert.equal(r.entries.length, 2);
  assert.equal(r.skipped, 1);
  assert.deepEqual(r.entries[0], { date: '2026-11-10', weight: 80.4, sleep: 7.5, steps: 12500, kcal: 2400, trained: true, note: 'iyi' });
  assert.equal(r.entries[1].sleep, null);
  assert.equal(r.entries[1].trained, false);
});

test('CSV içe aktarma: kendi dışa aktarımımızla gidiş-dönüş', () => {
  const src = [{ date: '2026-01-01', weight: 80.5, sleep: 7, stress: 4, energy: 7, hunger: 5, cardioMin: 20, steps: 10000, kcal: 2400, protein: 200, carbs: 250, fat: 65, trained: true, note: 'a, "b"' }];
  const r = parseCSV(toCSV(src));
  assert.deepEqual(r.entries[0], src[0]);
  assert.equal(parseDateTR('2026-1-5'), '2026-01-05');
  assert.throws(() => parseCSV('Kilo\n80'));
});
