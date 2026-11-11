import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_PROFILE, addDays, weeklySummaries, evaluateWeek } from '../js/coach.js';
import { estimateMaintenance, eventOn, eventDaysIn, eventTargets, suggestPlan, peakWeekPlan, peakAdjust, targetsForDate } from '../js/plan.js';

const targets = { kcal: 2400, protein: 200, carbs: 250, fat: 65, steps: 10000, cardioMin: 30 };
const profile = (o = {}) => ({ ...DEFAULT_PROFILE, startDate: '2026-01-05', targets: { ...targets }, ...o });

test('idame tahmini', () => {
  const weeks = [{ weighIns: 7, days: 7, changeKg: -0.5, avgKcal: 2400 }, { weighIns: 7, days: 7, changeKg: -0.7, avgKcal: 2400 }];
  const m = estimateMaintenance(weeks, profile());
  assert.equal(m.estimated, false);
  assert.equal(m.kcal, 3060); // 2400 + 0.6*7700/7 = 3060
  assert.equal(estimateMaintenance([], profile()).estimated, true);
});

test('olaylar ve hedefleri', () => {
  const ev = [{ type: 'dietBreak', start: '2026-02-01', days: 7 }, { type: 'refeed', start: '2026-02-14', days: 1 }];
  assert.equal(eventOn(ev, '2026-02-07').type, 'dietBreak');
  assert.equal(eventOn(ev, '2026-02-08'), null);
  assert.equal(eventDaysIn(ev, '2026-02-02', '2026-02-15'), 7);
  const db = eventTargets('dietBreak', targets, 3000, 80);
  assert.ok(Math.abs(db.kcal - 3000) <= 10);
  assert.equal(db.protein, 200);
  assert.equal(db.cardioMin, 15);
  const rf = eventTargets('refeed', targets, 3000, 80);
  assert.ok(rf.carbs > 250 && rf.carbs <= 500);
  assert.ok(rf.fat >= 48 && rf.fat <= 65);
});

test('otomatik takvim önerisi', () => {
  const p = profile({ goal: 'cut', startDate: '2026-01-05', showDate: '2026-07-05' });
  const s = suggestPlan(p, '2026-01-10');
  const breaks = s.filter((e) => e.type === 'dietBreak');
  const refeeds = s.filter((e) => e.type === 'refeed');
  assert.equal(breaks.length, 2); // 8. ve 16. hafta; 24. hafta yarışa çok yakın
  assert.equal(breaks[0].start, '2026-03-02');
  assert.ok(refeeds.length >= 6 && refeeds.every((r) => r.start < '2026-06-28'));
  assert.equal(suggestPlan(p, '2026-01-10', s).length, 0, 'mevcut olaylarla çakışmamalı');
});

test('peak week planı', () => {
  const p = profile({ showDate: '2026-06-07' });
  const days = peakWeekPlan(p, 75, { loadDays: 2, loadGkg: 7 });
  assert.equal(days.length, 7);
  assert.equal(days[0].date, '2026-06-01');
  assert.equal(days[6].phase, 'Yarış günü');
  const load = days.filter((d) => d.phase === 'Karbonhidrat yükleme');
  assert.deepEqual(load.map((d) => d.offset), [-2, -1]);
  assert.equal(load[0].targets.carbs, 525);
  assert.ok(days.every((d) => d.waterL === 3.8), 'su sabit');
  assert.equal(peakAdjust(load[1], 'flat').carbs, 656);
  assert.equal(peakAdjust(load[1], 'spill').carbs, 315);
});

test('etkin hedefler: peak > olay > temel', () => {
  const p = profile({ showDate: '2026-06-07' });
  const ev = [{ type: 'refeed', start: '2026-05-01', days: 1 }];
  assert.equal(targetsForDate('2026-06-06', p, ev, { bw: 75, maintenance: 3000 }).targets.carbs, 525);
  assert.equal(targetsForDate('2026-05-01', p, ev, { bw: 75, maintenance: 3000 }).label, 'Refeed günü');
  assert.equal(targetsForDate('2026-05-02', p, ev, { bw: 75, maintenance: 3000 }).targets, p.targets);
});

test('diyet molası haftasında karar verilmez; uyum etkin hedefe göre', () => {
  const p = profile();
  const entries = [];
  for (let i = 0; i < 14; i++) entries.push({ date: addDays('2026-01-05', i), weight: i < 7 ? 80 : 80.6, kcal: i < 7 ? 2400 : 3000, protein: 200, steps: 10000 });
  const ev = [{ type: 'dietBreak', start: '2026-01-12', days: 7 }];
  const tf = (d) => targetsForDate(d, p, ev, { bw: 80, maintenance: 3000 }).targets;
  const w = weeklySummaries(entries, p, tf)[1];
  assert.equal(w.adherence, 100);
  assert.ok(weeklySummaries(entries, p)[1].adherence < 100);
  const r = evaluateWeek(w, p, '2026-01-19', { breakDays: eventDaysIn(ev, '2026-01-05', w.to) });
  assert.equal(r.status, 'break');
});

import { mealPlan } from '../js/plan.js';
import { navyBodyFat, composition, plannedWeight } from '../js/coach.js';

test('öğün planı: toplamlar korunur, antrenman çevresi karb ağırlıklı', () => {
  const t = { protein: 200, carbs: 250, fat: 65 };
  const m = mealPlan(t, 4, 2);
  assert.equal(m.length, 4);
  assert.equal(m.reduce((a, x) => a + x.protein, 0), 200);
  assert.equal(m.reduce((a, x) => a + x.carbs, 0), 250);
  assert.equal(m.reduce((a, x) => a + x.fat, 0), 65);
  assert.equal(m[1].role, 'Antrenman öncesi');
  assert.equal(m[2].role, 'Antrenman sonrası');
  assert.ok(m[2].carbs > m[0].carbs && m[2].fat < m[0].fat);
  assert.ok(mealPlan(t, 3, -1).every((x) => !x.role));
  assert.equal(mealPlan(t, 3, 0)[0].role, 'Antrenman sonrası');
});

test('Navy yağ oranı ve kompozisyon', () => {
  const bf = navyBodyFat({ sex: 'erkek', heightCm: 178, waist: 84, neck: 39 });
  assert.ok(bf > 14 && bf < 17, String(bf));
  assert.ok(navyBodyFat({ sex: 'kadın', heightCm: 165, waist: 70, hip: 96, neck: 32 }) > 20);
  assert.equal(navyBodyFat({ sex: 'erkek', heightCm: 178, waist: 84 }), null);
  const c = composition({ weight: 80, bodyFat: 15, heightCm: 178, sex: 'erkek', targetWeight: 74 });
  assert.equal(c.lbm, 68);
  assert.equal(c.stageHigh, 71.6);
  assert.ok(c.notes[0].includes('üstünde'));
  assert.ok(composition({ weight: 80, bodyFat: 15, heightCm: 178, targetWeight: 71 }).notes[0].includes('uyumlu'));
});

test('plan çizgisi', () => {
  const p = { startDate: '2026-01-01', showDate: '2026-01-11', startWeight: 80, targetWeight: 70 };
  assert.equal(plannedWeight(p, '2026-01-06'), 75);
  assert.equal(plannedWeight(p, '2026-03-01'), 70);
  assert.equal(plannedWeight({ ...p, showDate: '' }, '2026-01-06'), null);
});
