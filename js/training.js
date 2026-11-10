// BULUT 1.0 — Antrenman koçu (saf fonksiyonlar)

export const MUSCLES = {
  gogus: 'Göğüs', sirt: 'Sırt', omuz: 'Omuz', arkaOmuz: 'Arka omuz', biceps: 'Biceps', triceps: 'Triceps',
  quad: 'Ön bacak', hamstring: 'Arka bacak', kalca: 'Kalça', baldir: 'Baldır', karin: 'Karın',
};

// type: c = bileşik (compound), i = izole
export const EXERCISES = {
  bench: { name: 'Bench press', muscle: 'gogus', type: 'c' },
  inclineDb: { name: 'Eğimli dumbbell press', muscle: 'gogus', type: 'c' },
  chestFly: { name: 'Kablo / makine fly', muscle: 'gogus', type: 'i' },
  dips: { name: 'Dips', muscle: 'gogus', type: 'c' },
  row: { name: 'Barbell row', muscle: 'sirt', type: 'c' },
  cableRow: { name: 'Oturarak kablo row', muscle: 'sirt', type: 'c' },
  pulldown: { name: 'Lat pulldown', muscle: 'sirt', type: 'c' },
  pullup: { name: 'Barfiks', muscle: 'sirt', type: 'c' },
  ohp: { name: 'Overhead press', muscle: 'omuz', type: 'c' },
  lateral: { name: 'Lateral raise', muscle: 'omuz', type: 'i' },
  rearDelt: { name: 'Reverse fly / face pull', muscle: 'arkaOmuz', type: 'i' },
  curl: { name: 'Barbell / dumbbell curl', muscle: 'biceps', type: 'i' },
  hammer: { name: 'Hammer curl', muscle: 'biceps', type: 'i' },
  pushdown: { name: 'Triceps pushdown', muscle: 'triceps', type: 'i' },
  overheadExt: { name: 'Overhead triceps extension', muscle: 'triceps', type: 'i' },
  squat: { name: 'Squat', muscle: 'quad', type: 'c' },
  hackSquat: { name: 'Hack squat / leg press', muscle: 'quad', type: 'c' },
  legExt: { name: 'Leg extension', muscle: 'quad', type: 'i' },
  rdl: { name: 'Romanian deadlift', muscle: 'hamstring', type: 'c' },
  legCurl: { name: 'Leg curl', muscle: 'hamstring', type: 'i' },
  deadlift: { name: 'Deadlift', muscle: 'kalca', type: 'c' },
  hipThrust: { name: 'Hip thrust', muscle: 'kalca', type: 'c' },
  lunge: { name: 'Bulgarian split squat', muscle: 'kalca', type: 'c' },
  calf: { name: 'Calf raise', muscle: 'baldir', type: 'i' },
  abs: { name: 'Kablo crunch / leg raise', muscle: 'karin', type: 'i' },
};

const ex = (id, sets, repMin, repMax, rir = 2) => ({ id, sets, repMin, repMax, rir });

export const PROGRAMS = {
  fullbody3: {
    name: 'Full body · haftada 3',
    days: [
      { name: 'Full body A', items: [ex('squat', 3, 5, 8), ex('bench', 3, 6, 10), ex('row', 3, 8, 12), ex('lateral', 3, 12, 20, 1), ex('curl', 2, 10, 15, 1)] },
      { name: 'Full body B', items: [ex('rdl', 3, 6, 10), ex('ohp', 3, 6, 10), ex('pulldown', 3, 8, 12), ex('legCurl', 2, 10, 15, 1), ex('pushdown', 2, 10, 15, 1)] },
      { name: 'Full body C', items: [ex('hackSquat', 3, 8, 12), ex('inclineDb', 3, 8, 12), ex('cableRow', 3, 10, 15), ex('rearDelt', 3, 12, 20, 1), ex('calf', 3, 10, 15, 1)] },
    ],
  },
  upperLower4: {
    name: 'Üst / alt · haftada 4',
    days: [
      { name: 'Üst 1 (güç)', items: [ex('bench', 4, 5, 8), ex('row', 4, 6, 10), ex('ohp', 3, 6, 10), ex('pulldown', 3, 8, 12), ex('curl', 2, 8, 12, 1), ex('pushdown', 2, 10, 15, 1)] },
      { name: 'Alt 1 (güç)', items: [ex('squat', 4, 5, 8), ex('rdl', 3, 6, 10), ex('legCurl', 3, 10, 15, 1), ex('calf', 4, 8, 12, 1), ex('abs', 3, 10, 15, 1)] },
      { name: 'Üst 2 (hacim)', items: [ex('inclineDb', 3, 8, 12), ex('cableRow', 3, 10, 15), ex('lateral', 4, 12, 20, 1), ex('chestFly', 3, 12, 15, 1), ex('rearDelt', 3, 12, 20, 1), ex('hammer', 3, 10, 15, 1), ex('overheadExt', 3, 10, 15, 1)] },
      { name: 'Alt 2 (hacim)', items: [ex('hackSquat', 3, 8, 12), ex('hipThrust', 3, 8, 12), ex('lunge', 3, 8, 12), ex('legExt', 3, 12, 15, 1), ex('legCurl', 3, 10, 15, 1), ex('calf', 3, 12, 15, 1)] },
    ],
  },
  ppl6: {
    name: 'Push / pull / legs · haftada 6',
    days: [
      { name: 'Push', items: [ex('bench', 3, 5, 8), ex('ohp', 3, 6, 10), ex('inclineDb', 3, 8, 12), ex('lateral', 4, 12, 20, 1), ex('pushdown', 3, 10, 15, 1)] },
      { name: 'Pull', items: [ex('pullup', 3, 6, 10), ex('row', 3, 6, 10), ex('cableRow', 3, 10, 15), ex('rearDelt', 3, 12, 20, 1), ex('curl', 3, 8, 12, 1)] },
      { name: 'Legs', items: [ex('squat', 3, 5, 8), ex('rdl', 3, 6, 10), ex('legExt', 3, 12, 15, 1), ex('legCurl', 3, 10, 15, 1), ex('calf', 4, 10, 15, 1)] },
    ],
  },
};

// Kas grubu başına haftalık zor set önerisi (araştırma temelli genel aralık)
export const VOLUME_RANGE = { min: 10, max: 20, cutMin: 6 };

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const r1 = (v) => Math.round(v * 10) / 10;

// Epley 1RM tahmini (12 tekrara kadar anlamlı)
export function e1rm(kg, reps) {
  if (!isNum(kg) || !isNum(reps) || reps < 1 || kg <= 0) return null;
  return r1(kg * (1 + Math.min(reps, 12) / 30));
}

export function roundLoad(kg, type) {
  const step = type === 'c' ? 2.5 : 1;
  return Math.round(kg / step) * step;
}

export function sessionsFor(sessions, exerciseId) {
  return [...sessions]
    .filter((s) => s.sets.some((x) => x.id === exerciseId && isNum(x.reps)))
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

export function bestE1RM(session, exerciseId) {
  const vals = session.sets.filter((x) => x.id === exerciseId).map((x) => e1rm(x.kg, x.reps)).filter(isNum);
  return vals.length ? Math.max(...vals) : null;
}

// Çift ilerleme (double progression): tüm setler üst tekrara ulaştıysa ağırlık artar,
// alt tekrarın altında kalan set varsa ağırlık sabit, iki seans üst üste düşükse %5 azalt.
export function suggestNext(item, sessions) {
  const def = EXERCISES[item.id] || { type: 'c' };
  const hist = sessionsFor(sessions, item.id);
  const last = hist[hist.length - 1];
  if (!last) return { kg: null, reps: item.repMin, action: 'start', text: `İlk seans: ${item.repMin}–${item.repMax} tekrar, ${item.rir} RIR bırakacak ağırlık seç.` };
  const sets = last.sets.filter((x) => x.id === item.id && isNum(x.reps));
  const kg = Math.max(...sets.map((x) => x.kg || 0));
  const top = sets.filter((x) => (x.kg || 0) === kg);
  const allTop = top.length >= item.sets && top.every((x) => x.reps >= item.repMax);
  const anyLow = top.some((x) => x.reps < item.repMin);
  const minReps = Math.min(...top.map((x) => x.reps));
  if (allTop) {
    const inc = def.type === 'c' ? Math.max(2.5, roundLoad(kg * 0.025, 'c')) : Math.max(1, roundLoad(kg * 0.05, 'i'));
    return { kg: kg + inc, reps: item.repMin, action: 'increase', text: `Üst tekrara ulaştın: ${kg + inc} kg × ${item.repMin}+ ile devam.` };
  }
  if (anyLow) {
    const prev = hist[hist.length - 2];
    const prevLow = prev && prev.sets.filter((x) => x.id === item.id && (x.kg || 0) === kg).some((x) => x.reps < item.repMin);
    if (prevLow) {
      const down = roundLoad(kg * 0.95, def.type);
      return { kg: down, reps: item.repMin + 1, action: 'decrease', text: `İki seanstır ${item.repMin} tekrarın altındasın: ${down} kg'a düş, tekrarları geri kazan.` };
    }
    return { kg, reps: item.repMin, action: 'hold', text: `${kg} kg'da kal, her sette en az ${item.repMin} tekrar hedefle.` };
  }
  return { kg, reps: Math.min(item.repMax, minReps + 1), action: 'reps', text: `${kg} kg ile tekrar ekle (hedef ${Math.min(item.repMax, minReps + 1)}+).` };
}

// Son 3 seansta e1RM artmadıysa plato
export function stallStatus(sessions, exerciseId, window = 3) {
  const hist = sessionsFor(sessions, exerciseId).map((s) => ({ date: s.date, e1rm: bestE1RM(s, exerciseId) })).filter((x) => isNum(x.e1rm));
  if (hist.length < window + 1) return { stalled: false, history: hist };
  const before = Math.max(...hist.slice(0, -window).map((x) => x.e1rm));
  const recent = Math.max(...hist.slice(-window).map((x) => x.e1rm));
  return { stalled: recent <= before, dropPct: r1(((recent - before) / before) * 100), history: hist };
}

// Hafta içi kas grubu başına zor set sayısı (RIR ≤ 4 ya da girilmemiş)
export function weeklyVolume(sessions, from, to) {
  const vol = Object.fromEntries(Object.keys(MUSCLES).map((m) => [m, 0]));
  sessions.filter((s) => s.date >= from && s.date <= to).forEach((s) =>
    s.sets.forEach((x) => {
      const m = EXERCISES[x.id]?.muscle;
      if (m && isNum(x.reps) && x.reps > 0 && (!isNum(x.rir) || x.rir <= 4)) vol[m]++;
    }));
  return vol;
}

// Haftalık antrenman değerlendirmesi
export function evaluateTraining({ sessions, program, from, to, goal = 'cut', recovery = null, plannedDays }) {
  const out = { flags: [], decisions: [], deload: false };
  const weekSessions = sessions.filter((s) => s.date >= from && s.date <= to);
  const planned = plannedDays ?? program?.days.length ?? 0;
  if (planned && weekSessions.length < planned) out.flags.push(`Bu hafta ${weekSessions.length}/${planned} antrenman yapıldı.`);

  const ids = program ? [...new Set(program.days.flatMap((d) => d.items.map((i) => i.id)))] : [];
  const tracked = ids.filter((id) => sessionsFor(sessions, id).length >= 4);
  const stalled = tracked.filter((id) => stallStatus(sessions, id).stalled);
  stalled.forEach((id) => out.flags.push(`${EXERCISES[id].name}: son 3 seansta ilerleme yok.`));

  const vol = weeklyVolume(sessions, from, to);
  const lo = goal === 'cut' ? VOLUME_RANGE.cutMin : VOLUME_RANGE.min;
  const trainedMuscles = new Set(ids.map((id) => EXERCISES[id].muscle));
  const low = [...trainedMuscles].filter((m) => weekSessions.length && vol[m] < lo && m !== 'karin');
  const high = Object.keys(vol).filter((m) => vol[m] > VOLUME_RANGE.max);
  if (low.length) out.flags.push(`Düşük hacim (<${lo} set): ${low.map((m) => MUSCLES[m]).join(', ')}.`);
  if (high.length) out.flags.push(`Çok yüksek hacim (>${VOLUME_RANGE.max} set): ${high.map((m) => MUSCLES[m]).join(', ')}.`);

  const stallRatio = tracked.length ? stalled.length / tracked.length : 0;
  if ((tracked.length >= 3 && stallRatio >= 0.4) || (isNum(recovery) && recovery < 40 && stalled.length >= 2)) {
    out.deload = true;
    out.decisions.push({ type: 'deload', title: 'Deload haftası', detail: 'Set sayısını ~%50 azalt, ağırlıkları koru ya da %10 düşür, RIR 3–4 bırak. Bir hafta sonra programa geri dön.' });
  } else if (stalled.length) {
    out.decisions.push({ type: 'hold', title: 'Platodaki hareketler', detail: goal === 'cut'
      ? 'Deficit döneminde güç korunuyorsa sorun yok. Düşüş varsa o harekette 1 set azalt veya tekrar aralığını değiştir.'
      : 'Varyasyon değiştir (ör. bench → eğimli) ya da tekrar aralığını kaydır.' });
  } else if (weekSessions.length) {
    out.decisions.push({ type: 'ok', title: 'Antrenman yolunda', detail: 'Önerilen ağırlıklarla çift ilerlemeye devam.' });
  }
  if (goal === 'cut' && stalled.length) {
    const drops = stalled.map((id) => stallStatus(sessions, id).dropPct).filter((d) => d < -5);
    if (drops.length) out.flags.push('Bazı hareketlerde güç %5\'ten fazla düştü: kalori açığı veya uyku fazla zorlayıcı olabilir.');
  }
  return { ...out, volume: vol, sessions: weekSessions.length, stalled };
}

// Bir sonraki program günü (dönüşümlü)
export function nextDayIndex(program, sessions) {
  if (!program) return 0;
  const last = [...sessions].sort((a, b) => (a.date < b.date ? -1 : 1)).pop();
  if (!last) return 0;
  const i = program.days.findIndex((d) => d.name === last.dayName);
  return i < 0 ? 0 : (i + 1) % program.days.length;
}
