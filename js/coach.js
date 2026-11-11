// BULUT 1.0 — Koç karar motoru (saf fonksiyonlar, tarayıcı ve Node'da çalışır)

export const KCAL_PER_KG = 7700;

export const DEFAULT_PROFILE = {
  name: '',
  sex: 'erkek',
  heightCm: 175,
  goal: 'cut', // cut | bulk | maintain
  startDate: '',
  showDate: '',
  startWeight: 0,
  targetWeight: 0,
  targetRatePct: 0.75, // haftalık vücut ağırlığı % değişim hedefi (cut: kayıp, bulk: artış)
  targets: { kcal: 2400, protein: 200, carbs: 250, fat: 65, steps: 10000, cardioMin: 0 },
  targetHistory: [],
};

// ---------- Tarih yardımcıları ----------
export function toDate(s) {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}
export function fmt(date) {
  return date.toISOString().slice(0, 10);
}
export function addDays(s, n) {
  const d = toDate(s);
  d.setUTCDate(d.getUTCDate() + n);
  return fmt(d);
}
export function daysBetween(a, b) {
  return Math.round((toDate(b) - toDate(a)) / 86400000);
}

// ---------- Genel yardımcılar ----------
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
export function mean(values) {
  const v = values.filter(isNum);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
}
export const round = (v, d = 1) => (isNum(v) ? Math.round(v * 10 ** d) / 10 ** d : null);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function sortEntries(entries) {
  return [...entries].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export function kcalFromMacros(p, c, f) {
  return Math.round(p * 4 + c * 4 + f * 9);
}

// 7 günlük hareketli ortalama (kilo)
export function movingAverage(entries, window = 7) {
  const sorted = sortEntries(entries).filter((e) => isNum(e.weight));
  return sorted.map((e) => {
    const from = addDays(e.date, -(window - 1));
    const slice = sorted.filter((x) => x.date >= from && x.date <= e.date);
    return { date: e.date, weight: e.weight, avg: round(mean(slice.map((x) => x.weight)), 2) };
  });
}

// ---------- Uyum ve toparlanma ----------
export function dayAdherence(entry, targets) {
  const checks = [];
  if (isNum(entry.kcal) && targets.kcal) checks.push(Math.abs(entry.kcal - targets.kcal) / targets.kcal <= 0.07);
  if (isNum(entry.protein) && targets.protein) checks.push(entry.protein >= targets.protein * 0.9);
  if (isNum(entry.steps) && targets.steps) checks.push(entry.steps >= targets.steps * 0.9);
  if (targets.cardioMin > 0 && isNum(entry.cardioMin)) checks.push(entry.cardioMin >= targets.cardioMin * 0.9);
  if (!checks.length) return null;
  return checks.filter(Boolean).length / checks.length;
}

// 0-100: uyku, stres, enerji, açlık
export function recoveryScore({ sleep, stress, energy, hunger }) {
  const parts = [];
  if (isNum(sleep)) parts.push(clamp((sleep - 5) / 3, 0, 1)); // 5s=0, 8s=1
  if (isNum(stress)) parts.push(clamp((10 - stress) / 9, 0, 1));
  if (isNum(energy)) parts.push(clamp((energy - 1) / 9, 0, 1));
  if (isNum(hunger)) parts.push(clamp((10 - hunger) / 9, 0, 1) * 0.5 + 0.5); // açlık daha az ağırlıklı
  if (!parts.length) return null;
  return Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100);
}

// ---------- Haftalık özetler ----------
export function weekStart(profile, entries) {
  if (profile.startDate) return profile.startDate;
  const sorted = sortEntries(entries);
  return sorted.length ? sorted[0].date : null;
}

export function summarizeWeek(weekEntries, targets, targetsFn = null) {
  const pick = (k) => mean(weekEntries.map((e) => e[k]));
  const adh = weekEntries.map((e) => dayAdherence(e, targetsFn ? targetsFn(e.date) : targets)).filter(isNum);
  const s = {
    days: weekEntries.length,
    weighIns: weekEntries.filter((e) => isNum(e.weight)).length,
    avgWeight: round(pick('weight'), 2),
    avgSleep: round(pick('sleep')),
    avgStress: round(pick('stress')),
    avgEnergy: round(pick('energy')),
    avgHunger: round(pick('hunger')),
    avgSteps: round(pick('steps'), 0),
    avgCardio: round(pick('cardioMin'), 0),
    avgKcal: round(pick('kcal'), 0),
    avgProtein: round(pick('protein'), 0),
    avgCarbs: round(pick('carbs'), 0),
    avgFat: round(pick('fat'), 0),
    trainingDays: weekEntries.filter((e) => e.trained).length,
    adherence: adh.length ? round(mean(adh) * 100, 0) : null,
  };
  s.recovery = recoveryScore({ sleep: s.avgSleep, stress: s.avgStress, energy: s.avgEnergy, hunger: s.avgHunger });
  return s;
}

// targetsFn(date) verilirse uyum o günün etkin hedeflerine göre (refeed, diyet molası, peak week) hesaplanır
export function weeklySummaries(entries, profile, targetsFn = null) {
  const start = weekStart(profile, entries);
  if (!start) return [];
  const sorted = sortEntries(entries).filter((e) => e.date >= start);
  if (!sorted.length) return [];
  const lastIdx = Math.floor(daysBetween(start, sorted[sorted.length - 1].date) / 7);
  const weeks = [];
  for (let i = 0; i <= lastIdx; i++) {
    const from = addDays(start, i * 7);
    const to = addDays(from, 6);
    const wk = sorted.filter((e) => e.date >= from && e.date <= to);
    const summary = summarizeWeek(wk, profile.targets, targetsFn);
    const prev = weeks[weeks.length - 1];
    if (prev && isNum(prev.avgWeight) && isNum(summary.avgWeight)) {
      summary.changeKg = round(summary.avgWeight - prev.avgWeight, 2);
      summary.changePct = round((summary.changeKg / prev.avgWeight) * 100, 2);
    } else {
      summary.changeKg = null;
      summary.changePct = null;
    }
    weeks.push({ index: i + 1, from, to, ...summary });
  }
  return weeks;
}

// ---------- Projeksiyon ----------
export function projection(profile, currentWeight, today) {
  if (!isNum(currentWeight) || !profile.showDate || !profile.targetWeight) return null;
  const daysLeft = daysBetween(today, profile.showDate);
  const weeksLeft = daysLeft / 7;
  const remainingKg = round(currentWeight - profile.targetWeight, 2);
  const requiredPct = weeksLeft > 0 ? round((remainingKg / weeksLeft / currentWeight) * 100, 2) : null;
  return { daysLeft, weeksLeft: round(weeksLeft, 1), remainingKg, requiredPct };
}

export function phaseOf(profile, today) {
  if (!profile.showDate) return profile.goal === 'bulk' ? 'Gelişim (bulk)' : profile.goal === 'maintain' ? 'Koruma' : 'Hazırlık';
  const d = daysBetween(today, profile.showDate);
  if (d < 0) return 'Yarış sonrası (reverse)';
  if (d <= 7) return 'Peak week';
  if (d <= 28) return 'Son 4 hafta';
  return 'Hazırlık';
}

// ---------- Karar motoru ----------
// Mevcut ve önceki hafta özetine göre öneri ve yeni hedefler üretir.
// extra.waistDelta: haftalık bel ölçüsü değişimi (cm, negatif = incelme)
export function evaluateWeek(week, profile, today = fmt(new Date()), extra = {}) {
  const t = profile.targets;
  const result = { status: 'ok', headline: '', decisions: [], flags: [], newTargets: { ...t } };
  const bw = week?.avgWeight;

  // Sağlık / toparlanma bayrakları
  if (week) {
    if (isNum(week.avgSleep) && week.avgSleep < 6.5) result.flags.push('Uyku ortalaması 6.5 saatin altında: yağ kaybı ve kas koruma için uykuyu öncelik yap.');
    if (isNum(week.avgStress) && week.avgStress >= 7) result.flags.push('Stres yüksek (≥7): kardiyo/kaloride sert değişiklik yapmadan önce stresi yönet.');
    if (isNum(week.avgEnergy) && week.avgEnergy <= 4) result.flags.push('Enerji düşük (≤4): antrenman performansını izle, refeed/diyet molası düşünülebilir.');
    if (isNum(week.avgHunger) && week.avgHunger >= 8) result.flags.push('Açlık çok yüksek (≥8): hacimli sebze, lif ve öğün zamanlamasını gözden geçir.');
    if (isNum(bw) && t.protein && t.protein / bw < 2.0) result.flags.push(`Protein hedefi ${round(t.protein / bw, 1)} g/kg; deficit döneminde en az 2.0–2.4 g/kg önerilir.`);
    if (isNum(bw) && t.fat && t.fat / bw < 0.6) result.flags.push(`Yağ hedefi ${round(t.fat / bw, 2)} g/kg; hormonal sağlık için ~0.6 g/kg altına inme.`);
    if (profile.goal === 'cut' && isNum(week.changePct) && -week.changePct > 1.5) result.flags.push('Haftalık kayıp %1.5\'in üzerinde: kas kaybı riski, kaloriyi artırmayı düşün.');
  }

  if (!week || week.weighIns < 4 || !isNum(week.changePct)) {
    result.status = 'data';
    result.headline = 'Veri yetersiz: karar için en az 4 tartı ve önceki haftanın ortalaması gerekli.';
    result.decisions.push({ type: 'hold', title: 'Değişiklik yok', detail: 'Her sabah tuvaletten sonra, aç karnına tartıl ve günlük kaydı doldur.' });
    return result;
  }

  if (profile.goal === 'cut') projectionCheck(result, profile, bw, today);

  // Bu hafta ya da önceki hafta diyet molası varsa kilo değişimi su/glikojenden etkilenir
  if (extra.breakDays >= 3) {
    result.status = 'break';
    result.headline = 'Diyet molası haftası: kilo değişimi su ve glikojenden etkilenir, karar verilmez.';
    result.decisions.push({ type: 'hold', title: 'Değişiklik yok', detail: 'Moladan sonraki ilk tam haftanın verisiyle yeniden değerlendirilir. 0.5–1 kg geçici artış normaldir.' });
    return result;
  }

  if (isNum(week.adherence) && week.adherence < 80) {
    result.status = 'adherence';
    result.headline = `Uyum %${week.adherence}: önce plana uyum, sonra ayar.`;
    result.decisions.push({ type: 'hold', title: 'Hedefleri değiştirme', detail: 'Uyum %80 altındayken kilo verisi plana değil sapmalara tepki verir. Bu hafta kalori ±%7, protein ≥%90, adım ≥%90 hedefle.' });
    return result;
  }

  const phase = phaseOf(profile, today);
  if (phase === 'Peak week') {
    result.status = 'peak';
    result.headline = 'Peak week: büyük değişiklik yok, plan sabit.';
    result.decisions.push({ type: 'hold', title: 'Kaloriyi sabit tut', detail: 'Yeni yiyecek deneme, suyu ve sodyumu sert kesme; karbonhidrat yüklemesini önceden test ettiğin şekilde uygula. Diüretik kullanma.' });
    return result;
  }
  if (phase === 'Yarış sonrası (reverse)') {
    result.status = 'reverse';
    result.headline = 'Yarış sonrası: kontrollü geri dönüş (reverse diet).';
    const add = 150;
    result.newTargets.carbs = t.carbs + Math.round(add * 0.7 / 4);
    result.newTargets.fat = t.fat + Math.round(add * 0.3 / 9);
    result.newTargets.kcal = t.kcal + (result.newTargets.carbs - t.carbs) * 4 + (result.newTargets.fat - t.fat) * 9;
    result.decisions.push({ type: 'increase', title: `+${add} kcal`, detail: 'Haftalık ~150 kcal artır; kilo haftada %0.5–1 artarsa bir hafta sabit tut.' });
    return result;
  }

  const rate = week.changePct; // + artış, - kayıp
  const target = profile.targetRatePct;

  if (profile.goal === 'cut') {
    const loss = -rate;
    // Toparlanma kötü ve kayıp makulse: diyet molası/refeed
    if (isNum(week.recovery) && week.recovery < 40 && loss >= target * 0.5) {
      result.status = 'recovery';
      result.headline = `Toparlanma skoru ${week.recovery}/100: kaloriyi kısma, toparlan.`;
      result.decisions.push({ type: 'refeed', title: 'Refeed / diyet molası', detail: 'Haftada 1–2 gün karbonhidratı ~%30–50 artır (yağı düşük tut) ya da 5–7 günlük idame kalorisi molası planla.' });
      return result;
    }
    if (loss < target * 0.5 && isNum(extra.waistDelta) && extra.waistDelta <= -0.5) {
      result.status = 'recomp';
      result.headline = `Kilo yavaş (%${round(loss, 2)}/hafta) ama bel ${Math.abs(extra.waistDelta)} cm inceldi: yağ kaybı sürüyor.`;
      result.decisions.push({ type: 'hold', title: 'Değişiklik yok', detail: 'Tartı su/glikojen nedeniyle gecikebilir. Bir hafta daha bekle; bel de durursa açık artırılır.' });
      return result;
    }
    if (loss < target * 0.5) {
      // Yavaş: açığı kapat
      const gapPct = target - loss;
      let dailyDelta = (gapPct / 100) * bw * KCAL_PER_KG / 7;
      dailyDelta = clamp(Math.round(dailyDelta / 25) * 25, 100, Math.round(t.kcal * 0.1));
      result.status = 'slow';
      result.headline = `Kayıp yavaş (%${round(loss, 2)}/hafta, hedef %${target}).`;
      const fatFloor = Math.round(bw * 0.6);
      const carbFloor = 80;
      let carbsCut = Math.round(dailyDelta * 0.75 / 4);
      let fatCut = Math.round(dailyDelta * 0.25 / 9);
      const fatAvail = Math.max(0, t.fat - fatFloor);
      if (fatCut > fatAvail) { carbsCut += Math.round((fatCut - fatAvail) * 9 / 4); fatCut = fatAvail; }
      const carbAvail = Math.max(0, t.carbs - carbFloor);
      const carbsApplied = Math.min(carbsCut, carbAvail);
      const shortfallKcal = (carbsCut - carbsApplied) * 4;
      result.newTargets.carbs = t.carbs - carbsApplied;
      result.newTargets.fat = t.fat - fatCut;
      result.newTargets.kcal = t.kcal - carbsApplied * 4 - fatCut * 9;
      const applied = t.kcal - result.newTargets.kcal;
      if (applied > 0) {
        result.decisions.push({ type: 'decrease', title: `−${applied} kcal`, detail: `Karbonhidrat −${carbsApplied} g, yağ −${fatCut} g. Protein sabit (${t.protein} g).` });
      }
      if (shortfallKcal > 0 || t.steps < 10000) {
        const extraSteps = shortfallKcal > 0 ? Math.round(shortfallKcal / 0.04 / 500) * 500 : 2000; // kaba tahmin: ~0.04 kcal/adım
        const steps = Math.min(t.steps + Math.max(1000, extraSteps), 15000);
        if (steps > t.steps) {
          result.newTargets.steps = steps;
          result.decisions.push({ type: 'activity', title: `Adım hedefi ${steps}`, detail: shortfallKcal > 0 ? 'Karbonhidrat tabanına ulaşıldı; açığın kalanı aktiviteyle.' : 'Alternatif: kaloriyi kısmak yerine önce adımı artırabilirsin.' });
        }
      }
      return result;
    }
    if (loss > target * 1.5) {
      const add = clamp(Math.round(((loss - target) / 100) * bw * KCAL_PER_KG / 7 / 25) * 25, 100, 250);
      result.status = 'fast';
      result.headline = `Kayıp hızlı (%${round(loss, 2)}/hafta): kas koruma için kalori ekle.`;
      result.newTargets.carbs = t.carbs + Math.round(add / 4);
      result.newTargets.kcal = t.kcal + Math.round(add / 4) * 4;
      result.decisions.push({ type: 'increase', title: `+${add} kcal`, detail: `Karbonhidrat +${Math.round(add / 4)} g, antrenman öncesi/sonrasına ekle.` });
      return result;
    }
    result.headline = `Hedefte: %${round(loss, 2)}/hafta kayıp (hedef %${target}).`;
    result.decisions.push({ type: 'hold', title: 'Plan aynen devam', detail: 'İlerleme hedef aralığında, değişiklik gerekmiyor.' });
    return result;
  }

  if (profile.goal === 'bulk') {
    if (rate < target * 0.5) {
      result.status = 'slow';
      result.newTargets.carbs = t.carbs + 38;
      result.newTargets.kcal = t.kcal + 152;
      result.headline = `Artış yavaş (%${round(rate, 2)}/hafta).`;
      result.decisions.push({ type: 'increase', title: '+150 kcal', detail: 'Karbonhidrat +38 g.' });
    } else if (rate > Math.max(target * 1.75, 0.5)) {
      result.status = 'fast';
      result.newTargets.carbs = Math.max(0, t.carbs - 38);
      result.newTargets.kcal = t.kcal - (t.carbs - result.newTargets.carbs) * 4;
      result.headline = `Artış hızlı (%${round(rate, 2)}/hafta): gereksiz yağlanma riski.`;
      result.decisions.push({ type: 'decrease', title: '−150 kcal', detail: 'Karbonhidrat −38 g.' });
    } else {
      result.headline = `Hedefte: %${round(rate, 2)}/hafta artış.`;
      result.decisions.push({ type: 'hold', title: 'Plan aynen devam', detail: 'Artış kontrollü.' });
    }
    return result;
  }

  // maintain
  if (Math.abs(rate) > 0.3) {
    const sign = rate > 0 ? -1 : 1;
    result.newTargets.carbs = Math.max(0, t.carbs + sign * 25);
    result.newTargets.kcal = t.kcal + (result.newTargets.carbs - t.carbs) * 4;
    result.status = rate > 0 ? 'fast' : 'slow';
    result.headline = `Kilo koruma aralığı dışında (%${round(rate, 2)}/hafta).`;
    result.decisions.push({ type: sign > 0 ? 'increase' : 'decrease', title: `${sign > 0 ? '+' : '−'}100 kcal`, detail: `Karbonhidrat ${sign > 0 ? '+' : '−'}25 g.` });
  } else {
    result.headline = 'Kilo stabil, koruma hedefte.';
    result.decisions.push({ type: 'hold', title: 'Plan aynen devam', detail: '' });
  }
  return result;
}

function projectionCheck(result, profile, bw, today) {
  const p = projection(profile, bw, today);
  if (p && p.weeksLeft > 1 && isNum(p.requiredPct)) {
    if (p.requiredPct > profile.targetRatePct * 1.25) {
      result.flags.push(`Yarışa ${p.weeksLeft} hafta var; hedefe ulaşmak için %${p.requiredPct}/hafta gerekiyor. Hedef hızını artırmayı ya da sahne kilosunu gözden geçirmeyi düşün.`);
    } else if (p.requiredPct < profile.targetRatePct * 0.5 && p.remainingKg > 0) {
      result.flags.push(`Programın önündesin: gerekli hız %${p.requiredPct}/hafta. Erken diyet molası koyabilirsin.`);
    }
  }
  return result;
}

// ---------- Günlük geri bildirim ----------
export function dailyFeedback(entry, targets) {
  const out = [];
  if (isNum(entry.kcal) && targets.kcal) {
    const pct = Math.round((entry.kcal / targets.kcal) * 100);
    out.push({ ok: Math.abs(pct - 100) <= 7, text: `Kalori: ${entry.kcal} / ${targets.kcal} (%${pct})` });
  }
  if (isNum(entry.protein) && targets.protein) out.push({ ok: entry.protein >= targets.protein * 0.9, text: `Protein: ${entry.protein} / ${targets.protein} g` });
  if (isNum(entry.steps) && targets.steps) out.push({ ok: entry.steps >= targets.steps * 0.9, text: `Adım: ${entry.steps} / ${targets.steps}` });
  if (targets.cardioMin > 0 && isNum(entry.cardioMin)) out.push({ ok: entry.cardioMin >= targets.cardioMin * 0.9, text: `Kardiyo: ${entry.cardioMin} / ${targets.cardioMin} dk` });
  if (isNum(entry.sleep)) out.push({ ok: entry.sleep >= 7, text: `Uyku: ${entry.sleep} saat` });
  return out;
}

// ---------- Haftalık check-in metni ----------
export function weeklyReport(week, evaluation, profile, today = fmt(new Date())) {
  const p = projection(profile, week.avgWeight, today);
  const lines = [
    `BULUT 1.0 — Hafta ${week.index} (${week.from} → ${week.to})`,
    `Faz: ${phaseOf(profile, today)}`,
    `Ort. kilo: ${week.avgWeight ?? '-'} kg` + (isNum(week.changeKg) ? ` (${week.changeKg > 0 ? '+' : ''}${week.changeKg} kg, %${week.changePct})` : ''),
    `Tartı: ${week.weighIns}/7 · Uyum: %${week.adherence ?? '-'} · Toparlanma: ${week.recovery ?? '-'}/100`,
    `Uyku ${week.avgSleep ?? '-'} s · Stres ${week.avgStress ?? '-'} · Enerji ${week.avgEnergy ?? '-'} · Açlık ${week.avgHunger ?? '-'}`,
    `Adım ${week.avgSteps ?? '-'} · Kardiyo ${week.avgCardio ?? '-'} dk · Antrenman ${week.trainingDays} gün`,
    `Kalori ${week.avgKcal ?? '-'} · P ${week.avgProtein ?? '-'} · K ${week.avgCarbs ?? '-'} · Y ${week.avgFat ?? '-'}`,
  ];
  if (p) lines.push(`Yarışa ${p.daysLeft} gün · Kalan ${p.remainingKg} kg · Gerekli %${p.requiredPct ?? '-'}/hafta`);
  lines.push('', `Koç: ${evaluation.headline}`);
  evaluation.decisions.forEach((d) => lines.push(`• ${d.title}${d.detail ? ' — ' + d.detail : ''}`));
  evaluation.flags.forEach((f) => lines.push(`⚠ ${f}`));
  const n = evaluation.newTargets;
  lines.push('', `Yeni hedef: ${n.kcal} kcal · P ${n.protein} · K ${n.carbs} · Y ${n.fat} · ${n.steps} adım · ${n.cardioMin} dk kardiyo`);
  return lines.join('\n');
}

// ---------- CSV ----------
export const CSV_FIELDS = ['date', 'weight', 'sleep', 'stress', 'energy', 'hunger', 'cardioMin', 'steps', 'kcal', 'protein', 'carbs', 'fat', 'trained', 'note'];
export const CSV_HEADERS = ['Tarih', 'Kilo', 'Uyku', 'Stres', 'Enerji', 'Açlık', 'Kardiyo (dk)', 'Adım', 'Kalori', 'Protein', 'Karb', 'Yağ', 'Antrenman', 'Not'];

export function toCSV(entries) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    const s = typeof v === 'boolean' ? (v ? 'evet' : 'hayır') : String(v);
    return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const rows = sortEntries(entries).map((e) => CSV_FIELDS.map((f) => esc(e[f])).join(','));
  return [CSV_HEADERS.join(','), ...rows].join('\n');
}

// Google Sheets / CSV içe aktarma. Ayraç: sekme, noktalı virgül veya virgül. Ondalık virgül desteklenir.
// Tarih: YYYY-MM-DD veya GG.AA.YYYY / GG/AA/YYYY.
const HEADER_ALIASES = {
  date: ['tarih', 'date', 'gün', 'gun'], weight: ['kilo', 'weight', 'ağırlık', 'agirlik'], sleep: ['uyku', 'sleep'],
  stress: ['stres', 'stress'], energy: ['enerji', 'energy'], hunger: ['açlık', 'aclik', 'hunger'],
  cardioMin: ['kardiyo', 'kardiyo (dk)', 'cardio'], steps: ['adım', 'adim', 'steps'], kcal: ['kalori', 'kcal'],
  protein: ['protein'], carbs: ['karb', 'karbonhidrat', 'carbs'], fat: ['yağ', 'yag', 'fat'],
  trained: ['antrenman', 'training'], note: ['not', 'note', 'notlar'],
};

function splitRow(line, sep) {
  const out = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c;
    } else if (c === '"') q = true;
    else if (c === sep) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export function parseDateTR(s) {
  s = (s || '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

export function parseCSV(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return { entries: [], skipped: 0, columns: [] };
  const head = lines[0];
  const sep = head.includes('\t') ? '\t' : head.split(';').length > head.split(',').length ? ';' : ',';
  const headers = splitRow(head, sep).map((h) => h.toLowerCase());
  const map = headers.map((h) => Object.keys(HEADER_ALIASES).find((k) => HEADER_ALIASES[k].some((a) => h === a || h.startsWith(a + ' '))) || null);
  if (!map.includes('date')) throw new Error('Tarih sütunu bulunamadı');
  const entries = [];
  let skipped = 0;
  for (const line of lines.slice(1)) {
    const cells = splitRow(line, sep);
    const e = {};
    map.forEach((k, i) => {
      if (!k) return;
      const raw = cells[i] ?? '';
      if (k === 'date') e.date = parseDateTR(raw);
      else if (k === 'note') e.note = raw;
      else if (k === 'trained') e.trained = /^(evet|e|x|1|true|var|✓)$/i.test(raw);
      else {
        const v = raw === '' ? null : Number(raw.replace(/\s/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.'));
        e[k] = Number.isFinite(v) ? v : null;
      }
    });
    if (e.date) entries.push(e); else skipped++;
  }
  return { entries, skipped, columns: map.filter(Boolean) };
}

// ---------- Vücut ölçüleri ----------
export const MEASURE_FIELDS = { waist: 'Bel', hip: 'Kalça', neck: 'Boyun', chest: 'Göğüs', arm: 'Kol', thigh: 'Bacak', bodyFat: 'Yağ %' };

// [from, to] aralığındaki son ölçü ile bu aralıktan önceki son ölçü arasındaki fark
export function measureDelta(measurements, field, from, to) {
  const sorted = sortEntries(measurements).filter((m) => isNum(m[field]));
  const inWeek = sorted.filter((m) => m.date >= from && m.date <= to).pop();
  const before = sorted.filter((m) => m.date < from).pop();
  if (!inWeek || !before) return null;
  return round(inWeek[field] - before[field], 1);
}

export function measureTrend(measurements) {
  const sorted = sortEntries(measurements);
  if (sorted.length < 2) return null;
  const first = sorted[0], last = sorted[sorted.length - 1];
  const out = {};
  for (const k of Object.keys(MEASURE_FIELDS)) {
    const a = sorted.find((m) => isNum(m[k])), b = [...sorted].reverse().find((m) => isNum(m[k]));
    if (a && b && a !== b) out[k] = round(b[k] - a[k], 1);
  }
  return { from: first.date, to: last.date, delta: out };
}

// ---------- Vücut kompozisyonu ----------
// US Navy yöntemi (cm). Erkek: bel, boyun, boy. Kadın: bel, kalça, boyun, boy.
export function navyBodyFat({ sex, heightCm, waist, neck, hip }) {
  if (!isNum(heightCm) || !isNum(waist) || !isNum(neck) || heightCm <= 0) return null;
  let bf;
  if (sex === 'kadın') {
    if (!isNum(hip) || waist + hip - neck <= 0) return null;
    bf = 495 / (1.29579 - 0.35004 * Math.log10(waist + hip - neck) + 0.221 * Math.log10(heightCm)) - 450;
  } else {
    if (waist - neck <= 0) return null;
    bf = 495 / (1.0324 - 0.19077 * Math.log10(waist - neck) + 0.15456 * Math.log10(heightCm)) - 450;
  }
  return bf > 2 && bf < 60 ? round(bf, 1) : null;
}

// Sahne yağ oranı varsayımı: erkek ~%5, kadın ~%12. Yağsız kütle kaybı %0 (iyimser) – %3 (gerçekçi).
export const STAGE_BF = { erkek: 5, kadın: 12 };

export function composition({ weight, bodyFat, heightCm, sex = 'erkek', targetWeight = 0 }) {
  if (!isNum(weight) || !isNum(bodyFat)) return null;
  const lbm = weight * (1 - bodyFat / 100);
  const h = heightCm / 100;
  const ffmi = isNum(heightCm) && heightCm > 0 ? lbm / (h * h) : null;
  const stageBf = STAGE_BF[sex] ?? 5;
  const stageHigh = lbm / (1 - stageBf / 100);
  const stageLow = (lbm * 0.97) / (1 - stageBf / 100);
  const out = {
    bodyFat, lbm: round(lbm, 1), fatKg: round(weight - lbm, 1),
    ffmi: round(ffmi, 1), ffmiNorm: ffmi != null ? round(ffmi + 6.1 * (1.8 - h), 1) : null,
    stageBf, stageLow: round(stageLow, 1), stageHigh: round(stageHigh, 1), notes: [],
  };
  if (targetWeight > 0) {
    if (targetWeight > stageHigh + 0.5) out.notes.push(`Hedef sahne kilon (${targetWeight} kg) bu kas kütlesiyle ~%${stageBf} yağa denk gelen ${out.stageLow}–${out.stageHigh} kg aralığının üstünde: sahnede yeterince sıkı olmayabilirsin.`);
    else if (targetWeight < stageLow - 1) out.notes.push(`Hedef sahne kilon (${targetWeight} kg) tahmini aralığın (${out.stageLow}–${out.stageHigh} kg) altında: gereğinden fazla kas kaybı riski.`);
    else out.notes.push(`Hedef sahne kilon tahmini aralıkla (${out.stageLow}–${out.stageHigh} kg) uyumlu.`);
  }
  if (out.ffmiNorm != null && out.ffmiNorm >= 25) out.notes.push('Normalize FFMI 25 ve üstü: ölçüm hatası olabilir, yağ oranını başka yöntemle doğrula.');
  return out;
}

// Başlangıç → yarış arası doğrusal hedef kilo
export function plannedWeight(profile, date) {
  const { startDate, showDate, startWeight, targetWeight } = profile;
  if (!startDate || !showDate || !startWeight || !targetWeight) return null;
  const total = daysBetween(startDate, showDate);
  if (total <= 0) return null;
  const f = clamp(daysBetween(startDate, date) / total, 0, 1);
  return round(startWeight + (targetWeight - startWeight) * f, 2);
}
