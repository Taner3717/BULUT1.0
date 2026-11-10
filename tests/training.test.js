import { test } from 'node:test';
import assert from 'node:assert/strict';
import { e1rm, suggestNext, stallStatus, weeklyVolume, evaluateTraining, nextDayIndex, PROGRAMS } from '../js/training.js';

const item = { id: 'bench', sets: 3, repMin: 6, repMax: 10, rir: 2 };
const sess = (date, kg, reps, id = 'bench', dayName = 'Full body A') => ({ date, dayName, sets: reps.map((r) => ({ id, kg, reps: r, rir: 2 })) });

test('e1RM', () => {
  assert.equal(e1rm(100, 5), 116.7);
  assert.equal(e1rm(0, 5), null);
});

test('ilk seans önerisi', () => {
  assert.equal(suggestNext(item, []).action, 'start');
});

test('üst tekrara ulaşınca ağırlık artar', () => {
  const s = suggestNext(item, [sess('2026-01-01', 80, [10, 10, 10])]);
  assert.equal(s.action, 'increase');
  assert.equal(s.kg, 82.5);
  assert.equal(s.reps, 6);
});

test('izole harekette küçük artış', () => {
  const lat = { id: 'lateral', sets: 3, repMin: 12, repMax: 20, rir: 1 };
  assert.equal(suggestNext(lat, [sess('2026-01-01', 10, [20, 20, 20], 'lateral')]).kg, 11);
});

test('aralık içindeyse tekrar ekle', () => {
  const s = suggestNext(item, [sess('2026-01-01', 80, [9, 8, 7])]);
  assert.equal(s.action, 'reps');
  assert.equal(s.kg, 80);
  assert.equal(s.reps, 8);
});

test('alt tekrarın altında: önce sabit, iki seans üst üste ise azalt', () => {
  const a = [sess('2026-01-01', 80, [6, 5, 5])];
  assert.equal(suggestNext(item, a).action, 'hold');
  const b = [...a, sess('2026-01-04', 80, [5, 5, 4])];
  const s = suggestNext(item, b);
  assert.equal(s.action, 'decrease');
  assert.equal(s.kg, 75);
});

test('plato tespiti', () => {
  const up = ['01', '04', '07', '10'].map((d, i) => sess(`2026-01-${d}`, 80 + i * 2.5, [8, 8, 8]));
  assert.equal(stallStatus(up, 'bench').stalled, false);
  const flat = ['01', '04', '07', '10', '13'].map((d) => sess(`2026-01-${d}`, 80, [8, 8, 8]));
  assert.equal(stallStatus(flat, 'bench').stalled, true);
});

test('haftalık hacim (RIR > 4 setler sayılmaz)', () => {
  const s = [{ date: '2026-01-02', sets: [{ id: 'bench', kg: 80, reps: 8, rir: 2 }, { id: 'bench', kg: 60, reps: 10, rir: 6 }, { id: 'row', kg: 70, reps: 10 }] }];
  const v = weeklyVolume(s, '2026-01-01', '2026-01-07');
  assert.equal(v.gogus, 1);
  assert.equal(v.sirt, 1);
});

test('çok sayıda plato → deload', () => {
  const p = PROGRAMS.fullbody3;
  const sessions = [];
  ['01', '03', '05', '08', '10', '12'].forEach((d) => {
    sessions.push({ date: `2026-01-${d}`, dayName: 'x', sets: ['squat', 'bench', 'row'].flatMap((id) => [1, 2, 3].map(() => ({ id, kg: 80, reps: 8, rir: 2 }))) });
  });
  const r = evaluateTraining({ sessions, program: p, from: '2026-01-08', to: '2026-01-14', goal: 'cut' });
  assert.equal(r.deload, true);
  assert.equal(r.stalled.length, 3);
});

test('program günleri dönüşümlü', () => {
  const p = PROGRAMS.fullbody3;
  assert.equal(nextDayIndex(p, []), 0);
  assert.equal(nextDayIndex(p, [sess('2026-01-01', 80, [8], 'bench', 'Full body C')]), 0);
  assert.equal(nextDayIndex(p, [sess('2026-01-01', 80, [8], 'bench', 'Full body A')]), 1);
});
