import {
  fmt, addDays, daysBetween, round, sortEntries, movingAverage, weeklySummaries, evaluateWeek,
  projection, phaseOf, dailyFeedback, weeklyReport, toCSV, parseCSV, kcalFromMacros,
  MEASURE_FIELDS, measureDelta, measureTrend, navyBodyFat, composition, plannedWeight, STAGE_BF,
} from './coach.js';
import {
  PROGRAMS, EXERCISES, MUSCLES, VOLUME_RANGE, suggestNext, stallStatus, evaluateTraining, nextDayIndex,
  registerExercises, newExerciseId, allPrograms, cloneProgram, validateProgram, sessionsFor, bestE1RM,
} from './training.js';
import { EVENT_TYPES, estimateMaintenance, eventOn, eventDaysIn, eventTargets, suggestPlan, peakWeekPlan, peakAdjust, targetsForDate, mealPlan } from './plan.js';
import { POSES, putPhoto, getPhoto, deletePhoto, resizeImage, photoURL, forgetURL } from './photos.js';
import { load, save, normalize, emptyState, upsertEntry, removeEntry, upsertMeasurement } from './storage.js';

let state = load();
registerExercises(state.training.customExercises);
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const today = () => fmt(new Date(Date.now() - new Date().getTimezoneOffset() * 60000));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v) => (v === '' || v === null || v === undefined ? null : Number(v));
const show = (v, suffix = '') => (v === null || v === undefined ? '–' : `${v}${suffix}`);

function persist() {
  if (!save(state)) toast('Uyarı: tarayıcı depolaması kullanılamıyor, yedek indir.');
}

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('on');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('on'), 2600);
}

// ---------- Navigasyon ----------
function go(view) {
  $$('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${view}`));
  $$('.tabs button').forEach((b) => b.classList.toggle('active', b.dataset.go === view));
  try { localStorage.setItem('bulut.tab', view); } catch {}
  render();
  window.scrollTo(0, 0);
}
document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-go]');
  if (b) go(b.dataset.go);
});

// ---------- Hesaplamalar ----------
function evaluationWeek(weeks) {
  for (let i = weeks.length - 1; i >= 0; i--) if (weeks[i].weighIns >= 4 && weeks[i].changePct !== null) return weeks[i];
  return weeks[weeks.length - 1] || null;
}

// ---------- Pano ----------
function renderDash() {
  const { profile, entries } = state;
  $('#onboard').classList.toggle('hidden', entries.length > 0);
  renderTodayBanner();
  const weeks = allWeeks();
  const ma = movingAverage(entries);
  const last = ma[ma.length - 1];
  const cur = weeks[weeks.length - 1];
  const proj = projection(profile, last?.avg, today());
  const totalChange = last && profile.startWeight ? round(last.avg - profile.startWeight, 1) : null;

  const stats = [
    ['7 gün ort.', show(last?.avg, ' kg'), (() => {
      const pw = last ? plannedWeight(profile, last.date) : null;
      if (pw == null) return last ? `Son tartı ${last.weight} kg` : '';
      const d = round(last.avg - pw, 1);
      const behind = profile.goal === 'bulk' ? d < 0 : d > 0;
      return Math.abs(d) < 0.3 ? `Plana uygun (${pw} kg)` : `Planın ${Math.abs(d)} kg ${behind ? 'gerisinde' : 'önünde'}`;
    })()],
    ['Haftalık değişim', cur?.changePct != null ? `${cur.changeKg > 0 ? '+' : ''}${cur.changeKg} kg` : '–', cur?.changePct != null ? `%${cur.changePct}` : 'önceki hafta yok'],
    ['Toplam', totalChange != null ? `${totalChange > 0 ? '+' : ''}${totalChange} kg` : '–', (() => {
      const w = measureTrend(state.measurements)?.delta.waist;
      return w != null ? `Bel ${w > 0 ? '+' : ''}${w} cm` : profile.startWeight ? `Başlangıç ${profile.startWeight} kg` : '';
    })()],
    ['Yarışa', proj ? (proj.daysLeft >= 0 ? `${proj.daysLeft} gün` : 'bitti') : '–', proj && proj.daysLeft > 0 ? `Kalan ${proj.remainingKg} kg · %${proj.requiredPct}/hf` : ''],
    ['Uyum (hafta)', show(cur?.adherence, '%'), `${cur?.weighIns ?? 0}/7 tartı`],
    ['Toparlanma', show(cur?.recovery, '/100'), cur ? `Uyku ${show(cur.avgSleep, ' s')}` : ''],
  ];
  $('#stats').innerHTML = stats.map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${esc(v)}</div><div class="s">${esc(s)}</div></div>`).join('');

  $('#chart').innerHTML = chartSVG(ma, profile);
  $('#chart-legend').innerHTML = '<i class="dot raw"></i>tartı <i class="dot avg"></i>7g ort.' + (plannedWeight(profile, today()) != null ? ' <i class="dot plan"></i>plan' : profile.targetWeight ? ' <i class="dot tgt"></i>hedef' : '');

  renderCoach(weeks);
}

function renderCoach(weeks) {
  const card = $('#coach-card');
  const wk = evaluationWeek(weeks);
  if (!wk) {
    card.innerHTML = '<h2>Koç</h2><p class="muted">Henüz veri yok.</p>';
    return;
  }
  const waistDelta = waistDeltaFor(wk);
  const ev = evaluateWeek(wk, state.profile, today(), { waistDelta, breakDays: breakDaysFor(wk) });
  const t = state.profile.targets;
  const n = ev.newTargets;
  const changed = Object.keys(n).some((k) => n[k] !== t[k]);
  const diff = (k, label, unit = '') => n[k] !== t[k] ? `<li>${label}: ${t[k]}${unit} → <b>${n[k]}${unit}</b></li>` : '';
  card.innerHTML = `
    <div class="card-head"><h2>Koç kararı</h2><span class="muted">Hafta ${wk.index} · ${wk.from} → ${wk.to}</span></div>
    <p class="headline st-${ev.status}">${esc(ev.headline)}</p>
    <ul class="decisions">${ev.decisions.map((d) => `<li class="d-${d.type}"><b>${esc(d.title)}</b>${d.detail ? `<span>${esc(d.detail)}</span>` : ''}</li>`).join('')}</ul>
    ${ev.flags.length ? `<ul class="flags">${ev.flags.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}
    ${trainSummaryHTML()}
    ${changed ? `<ul class="plain diffs">${diff('kcal', 'Kalori')}${diff('protein', 'Protein', ' g')}${diff('carbs', 'Karb', ' g')}${diff('fat', 'Yağ', ' g')}${diff('steps', 'Adım')}${diff('cardioMin', 'Kardiyo', ' dk')}</ul>` : ''}
    <div class="row wrap">
      ${changed ? '<button id="apply-btn">Önerileri uygula</button>' : ''}
      <button class="ghost" id="report-btn">Check-in raporunu kopyala</button>
    </div>`;
  if (changed) {
    $('#apply-btn').onclick = () => {
      state.profile.targetHistory.push({ date: today(), week: wk.index, reason: ev.headline, from: { ...t }, to: { ...n } });
      state.profile.targets = { ...n };
      persist();
      toast('Yeni hedefler uygulandı');
      render();
    };
  }
  $('#report-btn').onclick = async () => {
    const tev = trainingWeekEval();
    const text = weeklyReport(wk, ev, state.profile, today()) + (waistDelta != null ? `\nBel değişimi: ${waistDelta > 0 ? '+' : ''}${waistDelta} cm` : '') + (state.training.sessions.length
      ? `\n\nAntrenman (son 7 gün): ${tev.sessions} seans\n` + [...tev.decisions.map((d) => `• ${d.title}`), ...tev.flags.map((f) => `⚠ ${f}`)].join('\n') : '');
    try {
      await navigator.clipboard.writeText(text);
      toast('Rapor panoya kopyalandı');
    } catch {
      prompt('Raporu kopyala:', text);
    }
  };
}

function trainSummaryHTML() {
  if (!state.training.sessions.length) return '';
  const t = trainingWeekEval();
  const items = [...t.decisions.map((d) => `<li class="d-${d.type}"><b>Antrenman: ${esc(d.title)}</b><span>${esc(d.detail)}</span></li>`)];
  return `<ul class="decisions">${items.join('')}</ul>${t.flags.length ? `<ul class="flags">${t.flags.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}`;
}

function chartSVG(ma, profile) {
  const data = ma.slice(-90);
  if (data.length < 2) return '<p class="muted center">Grafik için en az 2 tartı gerekli.</p>';
  const W = 640, H = 220, pl = 38, pr = 10, pt = 10, pb = 24;
  const planPts = data.map((d) => ({ date: d.date, v: plannedWeight(profile, d.date) })).filter((p) => p.v != null);
  const vals = data.flatMap((d) => [d.weight, d.avg]).concat(planPts.map((p) => p.v));
  if (profile.targetWeight && !planPts.length) vals.push(profile.targetWeight);
  let min = Math.min(...vals), max = Math.max(...vals);
  const pad = Math.max(0.3, (max - min) * 0.08);
  min -= pad; max += pad;
  const d0 = data[0].date, span = Math.max(1, daysBetween(d0, data[data.length - 1].date));
  const x = (d) => pl + (daysBetween(d0, d) / span) * (W - pl - pr);
  const y = (v) => pt + (1 - (v - min) / (max - min)) * (H - pt - pb);
  const path = (k) => data.map((d, i) => `${i ? 'L' : 'M'}${x(d.date).toFixed(1)},${y(d[k]).toFixed(1)}`).join('');
  const ticks = 4, grid = [];
  for (let i = 0; i <= ticks; i++) {
    const v = min + ((max - min) * i) / ticks;
    grid.push(`<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${pl - 6}" y="${y(v) + 4}" class="axis" text-anchor="end">${v.toFixed(1)}</text>`);
  }
  const labels = [data[0], data[Math.floor(data.length / 2)], data[data.length - 1]]
    .map((d, i) => `<text x="${x(d.date)}" y="${H - 6}" class="axis" text-anchor="${['start', 'middle', 'end'][i]}">${d.date.slice(5)}</text>`).join('');
  const planLine = planPts.length > 1 ? `<path d="${planPts.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.v).toFixed(1)}`).join('')}" class="planline"/>` : '';
  const tgt = !planPts.length && profile.targetWeight && profile.targetWeight > min && profile.targetWeight < max
    ? `<line x1="${pl}" x2="${W - pr}" y1="${y(profile.targetWeight)}" y2="${y(profile.targetWeight)}" class="tgt"/>` : '';
  const dots = data.map((d) => `<circle cx="${x(d.date).toFixed(1)}" cy="${y(d.weight).toFixed(1)}" r="2.5" class="raw"><title>${d.date}: ${d.weight} kg (ort. ${d.avg})</title></circle>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Kilo trendi">${grid.join('')}${tgt}${planLine}<path d="${path('weight')}" class="rawline"/>${dots}<path d="${path('avg')}" class="avgline"/>${labels}</svg>`;
}

// ---------- Kayıt ----------
const ENTRY_NUM = ['weight', 'sleep', 'stress', 'energy', 'hunger', 'steps', 'cardioMin', 'kcal', 'protein', 'carbs', 'fat'];

function fillLog(date) {
  const f = $('#log-form');
  const e = state.entries.find((x) => x.date === date);
  f.date.value = date;
  ENTRY_NUM.forEach((k) => {
    const el = f[k];
    el.value = e && e[k] != null ? e[k] : el.type === 'range' ? 5 : '';
  });
  f.trained.checked = !!e?.trained;
  f.note.value = e?.note || '';
  $$('input[type=range]', f).forEach(syncRange);
  $('#log-delete').classList.toggle('hidden', !e);
  $('#log-feedback').innerHTML = e ? feedbackHTML(e) : '';
}
function syncRange(r) { r.previousElementSibling.textContent = r.value; }
function feedbackHTML(e) {
  const info = targetsInfo(e.date);
  const fb = dailyFeedback(e, info.targets);
  if (info.label) fb.unshift({ ok: true, text: `${info.label}: hedef ${info.targets.kcal} kcal · K ${info.targets.carbs} g` });
  return fb.length ? `<ul class="plain">${fb.map((x) => `<li class="${x.ok ? 'ok' : 'warn'}">${x.ok ? '✓' : '!'} ${esc(x.text)}</li>`).join('')}</ul>` : '';
}

$('#log-form').addEventListener('input', (e) => { if (e.target.type === 'range') syncRange(e.target); });
$('#log-form').date.addEventListener('change', (e) => e.target.value && fillLog(e.target.value));
$('#log-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  const entry = { date: f.date.value };
  ENTRY_NUM.forEach((k) => { entry[k] = num(f[k].value); });
  entry.trained = f.trained.checked;
  entry.note = f.note.value.trim();
  // Makrolar girildi ama kalori boşsa hesapla
  if (entry.kcal == null && entry.protein != null && entry.carbs != null && entry.fat != null) entry.kcal = kcalFromMacros(entry.protein, entry.carbs, entry.fat);
  if (!state.profile.startDate) state.profile.startDate = entry.date;
  if (!state.profile.startWeight && entry.weight) state.profile.startWeight = entry.weight;
  upsertEntry(state, entry);
  persist();
  $('#log-delete').classList.remove('hidden');
  $('#log-feedback').innerHTML = feedbackHTML(entry);
  renderHistory();
  toast(`${entry.date} kaydedildi`);
});
$('#log-delete').onclick = () => {
  const d = $('#log-form').date.value;
  if (!confirm(`${d} kaydı silinsin mi?`)) return;
  removeEntry(state, d);
  persist();
  fillLog(d);
  renderHistory();
  toast('Silindi');
};

// ---------- Haftalar ----------
function renderWeeks() {
  const weeks = allWeeks().reverse();
  if (!weeks.length) { $('#weeks').innerHTML = '<div class="card"><p class="muted">Henüz hafta yok.</p></div>'; return; }
  $('#weeks').innerHTML = weeks.map((w) => {
    const ev = evaluateWeek(w, state.profile, w.to, { waistDelta: waistDeltaFor(w), breakDays: breakDaysFor(w) });
    return `<details class="card week" ${w === weeks[0] ? 'open' : ''}>
      <summary><b>Hafta ${w.index}</b> <span class="muted">${w.from.slice(5)} → ${w.to.slice(5)}</span>
        <span class="pill st-${ev.status}">${w.avgWeight ?? '–'} kg ${w.changePct != null ? `(${w.changePct > 0 ? '+' : ''}${w.changePct}%)` : ''}</span></summary>
      <div class="grid3">
        <div><span>Tartı</span>${w.weighIns}/7</div><div><span>Uyum</span>${show(w.adherence, '%')}</div><div><span>Toparlanma</span>${show(w.recovery)}</div>
        <div><span>Uyku</span>${show(w.avgSleep, ' s')}</div><div><span>Stres</span>${show(w.avgStress)}</div><div><span>Enerji</span>${show(w.avgEnergy)}</div>
        <div><span>Açlık</span>${show(w.avgHunger)}</div><div><span>Adım</span>${show(w.avgSteps)}</div><div><span>Kardiyo</span>${show(w.avgCardio, ' dk')}</div>
        <div><span>Kalori</span>${show(w.avgKcal)}</div><div><span>P/K/Y</span>${show(w.avgProtein)}/${show(w.avgCarbs)}/${show(w.avgFat)}</div><div><span>Antrenman</span>${w.trainingDays} gün</div>
      </div>
      <p class="headline st-${ev.status}">${esc(ev.headline)}</p>
    </details>`;
  }).join('');
}

// ---------- Geçmiş ----------
function renderHistory() {
  const rows = sortEntries(state.entries).reverse();
  $('#history-count').textContent = `${rows.length} gün`;
  $('#history').innerHTML = `<thead><tr><th>Tarih</th><th>Kilo</th><th>Uyku</th><th>S/E/A</th><th>Adım</th><th>Kardiyo</th><th>Kcal</th><th>P/K/Y</th><th></th></tr></thead><tbody>` +
    rows.map((e) => `<tr><td>${e.date.slice(5)}${e.trained ? ' 🏋️' : ''}</td><td>${show(e.weight)}</td><td>${show(e.sleep)}</td><td>${show(e.stress)}/${show(e.energy)}/${show(e.hunger)}</td><td>${show(e.steps)}</td><td>${show(e.cardioMin)}</td><td>${show(e.kcal)}</td><td>${show(e.protein)}/${show(e.carbs)}/${show(e.fat)}</td><td><button class="link" data-edit="${e.date}">düzenle</button></td></tr>` +
      (e.note ? `<tr class="note"><td colspan="9">${esc(e.note)}</td></tr>` : '')).join('') + '</tbody>';
}
$('#history').addEventListener('click', (e) => {
  const d = e.target.dataset.edit;
  if (d) { fillLog(d); $('#log-form').scrollIntoView({ behavior: 'smooth' }); }
});

// ---------- Ayarlar ----------
function fillProfile() {
  const f = $('#profile-form');
  const p = state.profile;
  ['name', 'sex', 'heightCm', 'goal', 'startDate', 'showDate', 'startWeight', 'targetWeight', 'targetRatePct'].forEach((k) => { f[k].value = p[k] ?? ''; });
  Object.keys(p.targets).forEach((k) => { f[`t.${k}`].value = p.targets[k]; });
  macroCheck();
  $('#target-history').innerHTML = p.targetHistory.length
    ? [...p.targetHistory].reverse().map((h) => `<li><b>${h.date}</b> (hafta ${h.week}): ${h.from.kcal} → ${h.to.kcal} kcal, K ${h.from.carbs} → ${h.to.carbs} g, adım ${h.from.steps} → ${h.to.steps}<br><span class="muted">${esc(h.reason)}</span></li>`).join('')
    : '<li class="muted">Henüz değişiklik yok.</li>';
}
function macroCheck() {
  const f = $('#profile-form');
  const k = kcalFromMacros(+f['t.protein'].value || 0, +f['t.carbs'].value || 0, +f['t.fat'].value || 0);
  const diff = k - (+f['t.kcal'].value || 0);
  $('#macro-check').textContent = `Makrolardan hesaplanan: ${k} kcal` + (Math.abs(diff) > 50 ? ` (hedeften ${diff > 0 ? '+' : ''}${diff} kcal farklı)` : ' ✓');
}
$('#profile-form').addEventListener('input', macroCheck);
$('#profile-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  const p = state.profile;
  p.name = f.name.value.trim();
  p.sex = f.sex.value;
  p.goal = f.goal.value;
  p.startDate = f.startDate.value;
  p.showDate = f.showDate.value;
  ['heightCm', 'startWeight', 'targetWeight', 'targetRatePct'].forEach((k) => { p[k] = num(f[k].value) ?? 0; });
  Object.keys(p.targets).forEach((k) => { p.targets[k] = num(f[`t.${k}`].value) ?? 0; });
  persist();
  toast('Profil kaydedildi');
  render();
});

function download(name, text, type) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
$('#export-json').onclick = () => download(`bulut-yedek-${today()}.json`, JSON.stringify(state, null, 2), 'application/json');
$('#export-csv').onclick = () => download(`bulut-${today()}.csv`, '﻿' + toCSV(state.entries), 'text/csv');
$('#import-json').onchange = async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const raw = JSON.parse(await file.text());
    const data = normalize(raw);
    const nPhotos = Object.keys(raw.photoData || {}).length;
    if (!confirm(`${data.entries.length} günlük kayıt${nPhotos ? ` ve ${nPhotos} fotoğraf` : ''} yüklenecek, mevcut veri değişecek. Devam?`)) return;
    state = data;
    registerExercises(state.training.customExercises);
    const restored = await restorePhotos(raw.photoData);
    persist();
    toast(`Yedek yüklendi${restored ? ` · ${restored} fotoğraf` : ''}`);
    render();
  } catch {
    toast('Dosya okunamadı');
  } finally {
    e.target.value = '';
  }
};
$('#reset').onclick = () => {
  if (!confirm('Tüm veriler (fotoğraflar dahil) silinecek. Emin misin?')) return;
  state.photos.forEach((p) => { deletePhoto(p.id).catch(() => {}); forgetURL(p.id); });
  state = emptyState();
  persist();
  render();
};

function importCSV(text) {
  try {
    const { entries, skipped, columns } = parseCSV(text);
    if (!entries.length) { $('#import-result').textContent = 'Geçerli satır bulunamadı.'; return; }
    let added = 0, updated = 0;
    for (const e of entries) {
      const cur = state.entries.find((x) => x.date === e.date);
      const clean = Object.fromEntries(Object.entries(e).filter(([, v]) => v !== null && v !== '' && v !== undefined));
      if (cur) { Object.assign(cur, clean); updated++; } else { state.entries.push({ trained: false, note: '', ...e }); added++; }
    }
    const sorted = sortEntries(state.entries);
    if (!state.profile.startDate) state.profile.startDate = sorted[0].date;
    if (!state.profile.startWeight) state.profile.startWeight = sorted.find((x) => x.weight)?.weight || 0;
    persist();
    $('#import-result').textContent = `${added} yeni, ${updated} güncellenen kayıt${skipped ? `, ${skipped} satır atlandı` : ''}. Sütunlar: ${columns.join(', ')}`;
    toast('İçe aktarıldı');
  } catch (err) {
    $('#import-result').textContent = `Hata: ${err.message}`;
  }
}
$('#import-csv-btn').onclick = () => importCSV($('#import-text').value);
$('#import-csv-file').onchange = async (e) => {
  const f = e.target.files[0];
  if (f) importCSV(await f.text());
  e.target.value = '';
};

// ---------- Antrenman ----------
function programs() { return allPrograms(state.training.customPrograms); }
function program() { return programs()[state.training.programId] || PROGRAMS.upperLower4; }

function renderTrain() {
  const tr = state.training;
  const prog = program();
  const next = nextDayIndex(prog, tr.sessions);
  $('#train-program').innerHTML = `
    <div class="card-head"><h2>Program</h2>
      <select id="prog-select">${Object.entries(programs()).map(([id, p]) => `<option value="${id}" ${id === tr.programId ? 'selected' : ''}>${esc(p.name)}${p.custom ? ' ★' : ''}</option>`).join('')}</select></div>
    <p class="muted">Sıradaki gün vurgulandı. Ağırlık önerileri son seansına göre çift ilerleme ile hesaplanır.</p>
    <div class="days">${prog.days.map((d, i) => `<button class="${i === next ? '' : 'ghost'}" data-start="${i}">${esc(d.name)}<small>${d.items.length} hareket · ${d.items.reduce((a, x) => a + x.sets, 0)} set</small></button>`).join('')}</div>
    <div class="row wrap"><button class="ghost" id="prog-edit">${prog.custom ? 'Programı düzenle' : 'Kopyala ve düzenle'}</button></div>`;
  $('#prog-edit').onclick = () => openEditor(programs()[tr.programId] ? tr.programId : 'upperLower4');
  $('#prog-select').onchange = (e) => {
    if (tr.draft && !confirm('Devam eden antrenman taslağı silinecek. Program değişsin mi?')) { e.target.value = tr.programId; return; }
    tr.programId = e.target.value; tr.draft = null; persist(); renderTrain();
  };
  $$('[data-start]').forEach((b) => (b.onclick = () => startWorkout(+b.dataset.start)));
  renderWorkout();
  renderTrainWeek();
  renderProgress();
  renderTrainHistory();
}

function startWorkout(dayIdx) {
  const tr = state.training;
  if (tr.draft && !confirm('Devam eden antrenman taslağının yerine yenisi başlatılsın mı?')) return;
  const day = program().days[dayIdx];
  tr.draft = {
    date: today(), dayName: day.name,
    items: day.items.map((it) => {
      const sug = suggestNext(it, tr.sessions);
      return { ...it, planSets: it.sets, sug, sets: Array.from({ length: it.sets }, () => ({ kg: sug.kg, reps: null, rir: null })) };
    }),
  };
  persist();
  renderWorkout();
  $('#train-workout').scrollIntoView({ behavior: 'smooth' });
}

function renderWorkout() {
  const d = state.training.draft;
  const box = $('#train-workout');
  if (!d) { box.innerHTML = ''; return; }
  box.innerHTML = `<form class="card" id="workout-form">
    <div class="card-head"><h2>${esc(d.dayName)}</h2><input type="date" name="date" value="${d.date}" required></div>
    ${d.items.map((it, i) => `<div class="ex">
      <h3>${esc(EXERCISES[it.id]?.name || it.id)}</h3>
      <div class="meta">${it.planSets ?? it.sets.length} × ${it.repMin}–${it.repMax} tekrar · ${it.rir} RIR · ${MUSCLES[EXERCISES[it.id]?.muscle] || ''}</div>
      <div class="tip ${it.sug.action}">${esc(it.sug.text)}</div>
      <div class="setrow head"><span>#</span><span>kg</span><span>tekrar</span><span>RIR</span><span></span></div>
      ${it.sets.map((s, j) => `<div class="setrow">
        <span class="n">${j + 1}</span>
        <input data-i="${i}" data-j="${j}" data-k="kg" type="number" step="any" inputmode="decimal" value="${s.kg ?? ''}" placeholder="kg">
        <input data-i="${i}" data-j="${j}" data-k="reps" type="number" step="1" inputmode="numeric" value="${s.reps ?? ''}" placeholder="${it.sug.reps ?? it.repMin}">
        <input data-i="${i}" data-j="${j}" data-k="rir" type="number" step="1" min="0" max="10" inputmode="numeric" value="${s.rir ?? ''}" placeholder="${it.rir}">
        <button type="button" class="icon" data-delset="${i}:${j}" title="Seti sil">×</button></div>`).join('')}
      <button type="button" class="link" data-addset="${i}">+ set ekle</button>
    </div>`).join('')}
    <label class="full">Not<textarea name="note" rows="2" placeholder="Pump, ağrı, form…">${esc(d.note || '')}</textarea></label>
    <div class="row"><button type="submit">Antrenmanı kaydet</button><button type="button" class="ghost danger" id="workout-cancel">Vazgeç</button></div>
  </form>`;
  const f = $('#workout-form');
  f.addEventListener('input', (e) => {
    const t = e.target;
    if (t.dataset.k) d.items[+t.dataset.i].sets[+t.dataset.j][t.dataset.k] = num(t.value);
    else if (t.name === 'date') d.date = t.value;
    else if (t.name === 'note') d.note = t.value;
    persist();
  });
  f.addEventListener('click', (e) => {
    const a = e.target.dataset.addset, del = e.target.dataset.delset;
    if (a !== undefined) {
      const sets = d.items[+a].sets;
      const last = sets[sets.length - 1];
      sets.push({ kg: last?.kg ?? d.items[+a].sug.kg, reps: null, rir: null });
    } else if (del) {
      const [i, j] = del.split(':').map(Number);
      d.items[i].sets.splice(j, 1);
    } else return;
    persist(); renderWorkout();
  });
  $('#workout-cancel').onclick = () => {
    if (!confirm('Antrenman taslağı silinsin mi?')) return;
    state.training.draft = null; persist(); renderTrain();
  };
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    const sets = d.items.flatMap((it) => it.sets.filter((s) => s.reps > 0).map((s) => ({ id: it.id, kg: s.kg ?? 0, reps: s.reps, rir: s.rir })));
    if (!sets.length) { toast('En az bir setin tekrar sayısını gir'); return; }
    state.training.sessions.push({ id: `${d.date}-${Date.now()}`, date: d.date, dayName: d.dayName, sets, note: (d.note || '').trim() });
    const entry = state.entries.find((x) => x.date === d.date);
    if (entry) entry.trained = true; else state.entries.push({ date: d.date, trained: true, note: '' });
    state.training.draft = null;
    persist();
    toast(`${d.dayName} kaydedildi · ${sets.length} set`);
    renderTrain();
  });
}

function trainingWeekEval() {
  const to = today(), from = addDays(to, -6);
  const weeks = allWeeks();
  return evaluateTraining({ sessions: state.training.sessions, program: program(), from, to, goal: state.profile.goal, recovery: weeks[weeks.length - 1]?.recovery ?? null });
}

function renderTrainWeek() {
  const ev = trainingWeekEval();
  const lo = state.profile.goal === 'cut' ? VOLUME_RANGE.cutMin : VOLUME_RANGE.min, hi = VOLUME_RANGE.max, scale = 24;
  const muscles = [...new Set(program().days.flatMap((d) => d.items.map((i) => EXERCISES[i.id].muscle)))];
  $('#train-week').innerHTML = `
    <div class="card-head"><h2>Son 7 gün</h2><span class="muted">${ev.sessions} antrenman</span></div>
    <div class="bars">${muscles.map((m) => {
      const v = ev.volume[m];
      const cls = v > hi ? 'high' : v < lo ? 'low' : '';
      return `<div class="bar"><span>${MUSCLES[m]}</span><div class="track"><div class="zone" style="left:${(lo / scale) * 100}%;width:${((hi - lo) / scale) * 100}%"></div><div class="fill ${cls}" style="width:${Math.min(100, (v / scale) * 100)}%"></div></div><b>${v}</b></div>`;
    }).join('')}</div>
    <p class="muted">Zor set sayısı (RIR ≤ 4). Kesikli alan hedef aralık: ${lo}–${hi} set/hafta.</p>
    ${ev.decisions.length ? `<ul class="decisions">${ev.decisions.map((d) => `<li class="d-${d.type}"><b>${esc(d.title)}</b><span>${esc(d.detail)}</span></li>`).join('')}</ul>` : ''}
    ${ev.flags.length ? `<ul class="flags">${ev.flags.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}`;
}

function renderProgress() {
  const ids = [...new Set(program().days.flatMap((d) => d.items.map((i) => i.id)))];
  const rows = ids.map((id) => {
    const st = stallStatus(state.training.sessions, id);
    const h = st.history;
    if (!h.length) return '';
    const first = h[0].e1rm, last = h[h.length - 1].e1rm, best = Math.max(...h.map((x) => x.e1rm));
    const ch = round(((last - first) / first) * 100, 1);
    return `<tr><td>${esc(EXERCISES[id].name)}${st.stalled ? ' ⏸' : ''}</td><td>${h.length}</td><td>${last}</td><td>${best}</td><td class="${ch > 0 ? 'up' : ch < 0 ? 'down' : ''}">${ch > 0 ? '+' : ''}${ch}%</td></tr>`;
  }).join('');
  $('#train-progress').innerHTML = `<h2>Güç gelişimi</h2>${strengthChartHTML(ids)}${rows
    ? `<div class="table-wrap"><table class="prog"><thead><tr><th>Hareket</th><th>Seans</th><th>Son e1RM</th><th>En iyi</th><th>Değişim</th></tr></thead><tbody>${rows}</tbody></table></div><p class="muted">e1RM: Epley formülüyle tahmini tek tekrar maksimum. ⏸ = son 3 seansta ilerleme yok.</p>`
    : '<p class="muted">Henüz antrenman kaydı yok.</p>'}`;
  const ss = $('#strength-select');
  if (ss) ss.onchange = (e) => { strengthEx = e.target.value; renderProgress(); };
}

function renderTrainHistory() {
  const list = [...state.training.sessions].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 15);
  $('#train-history').innerHTML = `<h2>Son antrenmanlar</h2>${list.length ? `<ul class="plain">${list.map((s) => {
    const tonnage = Math.round(s.sets.reduce((a, x) => a + (x.kg || 0) * x.reps, 0));
    return `<li><b>${s.date}</b> · ${esc(s.dayName)} · ${s.sets.length} set · ${tonnage} kg tonaj <button class="link danger" data-delsess="${esc(s.id)}">sil</button>${s.note ? `<br><span class="muted">${esc(s.note)}</span>` : ''}</li>`;
  }).join('')}</ul>` : '<p class="muted">Henüz kayıt yok.</p>'}`;
  $$('[data-delsess]').forEach((b) => (b.onclick = () => {
    if (!confirm('Bu antrenman silinsin mi?')) return;
    state.training.sessions = state.training.sessions.filter((s) => s.id !== b.dataset.delsess);
    persist(); renderTrain();
  }));
}

// ---------- Program düzenleyici ----------
let editing = null; // { id, program }

function openEditor(fromId) {
  const tr = state.training;
  const src = programs()[fromId];
  if (!src) return;
  if (src.custom) editing = { id: fromId, program: cloneProgram(src, src.name) };
  else editing = { id: null, program: cloneProgram(src) };
  renderEditor();
  $('#train-editor').scrollIntoView({ behavior: 'smooth' });
}

function exerciseOptions(selected) {
  const groups = {};
  Object.entries(EXERCISES).forEach(([id, e]) => (groups[e.muscle] ||= []).push([id, e]));
  return Object.entries(groups).map(([m, list]) => `<optgroup label="${MUSCLES[m]}">${list.map(([id, e]) =>
    `<option value="${id}" ${id === selected ? 'selected' : ''}>${esc(e.name)}${e.custom ? ' ★' : ''}</option>`).join('')}</optgroup>`).join('');
}

function renderEditor(errors = []) {
  const box = $('#train-editor');
  if (!editing) { box.innerHTML = ''; return; }
  const p = editing.program;
  box.innerHTML = `<div class="card" id="editor">
    <div class="card-head"><h2>${editing.id ? 'Programı düzenle' : 'Yeni program'}</h2></div>
    <label>Program adı<input data-f="name" value="${esc(p.name)}"></label>
    ${p.days.map((d, di) => `<div class="edday">
      <div class="row"><input data-f="day" data-d="${di}" value="${esc(d.name)}" aria-label="Gün adı">
        <button type="button" class="icon" data-act="dayUp" data-d="${di}" title="Yukarı">↑</button>
        <button type="button" class="icon" data-act="delDay" data-d="${di}" title="Günü sil">×</button></div>
      <div class="editem head"><span>Hareket</span><span>Set</span><span>Min</span><span>Maks</span><span>RIR</span><span></span></div>
      ${d.items.map((it, ii) => `<div class="editem">
        <select data-f="id" data-d="${di}" data-i="${ii}">${exerciseOptions(it.id)}</select>
        <input data-f="sets" data-d="${di}" data-i="${ii}" type="number" min="1" max="10" value="${it.sets}" aria-label="Set">
        <input data-f="repMin" data-d="${di}" data-i="${ii}" type="number" min="1" value="${it.repMin}" aria-label="Min tekrar">
        <input data-f="repMax" data-d="${di}" data-i="${ii}" type="number" min="1" value="${it.repMax}" aria-label="Maks tekrar">
        <input data-f="rir" data-d="${di}" data-i="${ii}" type="number" min="0" max="5" value="${it.rir}" aria-label="RIR">
        <button type="button" class="icon" data-act="delItem" data-d="${di}" data-i="${ii}" title="Hareketi sil">×</button></div>`).join('')}
      <button type="button" class="link" data-act="addItem" data-d="${di}">+ hareket ekle</button>
    </div>`).join('')}
    <button type="button" class="ghost" data-act="addDay">+ gün ekle</button>
    <h2 style="margin-top:16px">Kütüphanede olmayan hareket</h2>
    <div class="newex">
      <label>Ad<input id="nx-name" placeholder="ör. Smith incline press"></label>
      <label>Kas<select id="nx-muscle">${Object.entries(MUSCLES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label>
      <label>Tür<select id="nx-type"><option value="c">Bileşik</option><option value="i">İzole</option></select></label>
      <button type="button" class="ghost" data-act="newEx">Ekle</button>
    </div>
    ${errors.length ? `<ul class="errors">${errors.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
    <div class="row wrap">
      <button type="button" data-act="save">Kaydet ve kullan</button>
      <button type="button" class="ghost" data-act="cancel">Vazgeç</button>
      ${editing.id ? '<button type="button" class="ghost danger" data-act="delete">Programı sil</button>' : ''}
    </div></div>`;

  const ed = $('#editor');
  ed.addEventListener('input', (e) => {
    const t = e.target, f = t.dataset.f;
    if (!f) return;
    if (f === 'name') p.name = t.value;
    else if (f === 'day') p.days[+t.dataset.d].name = t.value;
    else {
      const it = p.days[+t.dataset.d].items[+t.dataset.i];
      it[f] = f === 'id' ? t.value : num(t.value);
    }
  });
  ed.addEventListener('click', (e) => {
    const a = e.target.dataset.act;
    if (!a) return;
    const di = +e.target.dataset.d, ii = +e.target.dataset.i;
    if (a === 'addItem') p.days[di].items.push({ id: 'bench', sets: 3, repMin: 8, repMax: 12, rir: 2 });
    else if (a === 'delItem') p.days[di].items.splice(ii, 1);
    else if (a === 'addDay') p.days.push({ name: `Gün ${p.days.length + 1}`, items: [] });
    else if (a === 'delDay') { if (!confirm(`"${p.days[di].name}" silinsin mi?`)) return; p.days.splice(di, 1); }
    else if (a === 'dayUp') { if (di === 0) return; [p.days[di - 1], p.days[di]] = [p.days[di], p.days[di - 1]]; }
    else if (a === 'newEx') {
      const name = $('#nx-name').value.trim();
      if (!name) { toast('Hareket adını yaz'); return; }
      const id = newExerciseId(name);
      const def = { name, muscle: $('#nx-muscle').value, type: $('#nx-type').value };
      state.training.customExercises[id] = def;
      registerExercises({ [id]: def });
      persist();
      toast(`${name} kütüphaneye eklendi`);
    } else if (a === 'cancel') { editing = null; renderEditor(); return; }
    else if (a === 'delete') {
      if (!confirm(`"${p.name}" programı silinsin mi? Antrenman geçmişi korunur.`)) return;
      delete state.training.customPrograms[editing.id];
      if (state.training.programId === editing.id) state.training.programId = 'upperLower4';
      editing = null; persist(); renderTrain(); return;
    } else if (a === 'save') {
      const errs = validateProgram(p);
      if (errs.length) { renderEditor(errs); return; }
      const id = editing.id || `u_${Date.now()}`;
      state.training.customPrograms[id] = { ...p, custom: true };
      if (state.training.programId !== id && state.training.draft) state.training.draft = null;
      state.training.programId = id;
      editing = null; persist(); toast('Program kaydedildi'); renderTrain(); return;
    }
    renderEditor();
  });
}

// ---------- Ölçüler ----------
const MEASURE_KEYS = Object.keys(MEASURE_FIELDS);

function fillMeasure(date) {
  const f = $('#measure-form');
  const m = state.measurements.find((x) => x.date === date);
  f.date.value = date;
  MEASURE_KEYS.forEach((k) => { f[k].value = m?.[k] ?? ''; });
  $('#measure-delete').classList.toggle('hidden', !m);
  renderMeasureHistory();
}

function renderMeasureHistory() {
  const list = sortEntries(state.measurements);
  if (!list.length) { $('#measure-history').innerHTML = ''; return; }
  const cell = (m, prev, k) => {
    if (m[k] == null) return '<td>–</td>';
    const d = prev && prev[k] != null ? round(m[k] - prev[k], 1) : null;
    return `<td>${m[k]}${d ? ` <small class="${d < 0 ? 'down' : 'up'}">${d > 0 ? '+' : ''}${d}</small>` : ''}</td>`;
  };
  const rows = list.map((m, i) => `<tr><td><button type="button" class="link" data-medit="${m.date}">${m.date.slice(5)}</button></td>${MEASURE_KEYS.map((k) => cell(m, list[i - 1], k)).join('')}</tr>`).reverse();
  const t = measureTrend(list);
  const total = t ? `<tr><th>Toplam</th>${MEASURE_KEYS.map((k) => `<th>${t.delta[k] != null ? (t.delta[k] > 0 ? '+' : '') + t.delta[k] : ''}</th>`).join('')}</tr>` : '';
  $('#measure-history').innerHTML = `<thead><tr><th>Tarih</th>${MEASURE_KEYS.map((k) => `<th>${MEASURE_FIELDS[k]}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody><tfoot>${total}</tfoot>`;
}

$('#measure-form').addEventListener('click', (e) => { const d = e.target.dataset.medit; if (d) fillMeasure(d); });
$('#measure-form').date.addEventListener('change', (e) => e.target.value && fillMeasure(e.target.value));
$('#measure-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const f = e.target;
  const m = { date: f.date.value };
  MEASURE_KEYS.forEach((k) => { m[k] = num(f[k].value); });
  if (MEASURE_KEYS.every((k) => m[k] == null)) { toast('En az bir ölçü gir'); return; }
  upsertMeasurement(state, m);
  persist();
  fillMeasure(m.date);
  toast('Ölçü kaydedildi');
});
$('#measure-delete').onclick = () => {
  const d = $('#measure-form').date.value;
  if (!confirm(`${d} ölçüsü silinsin mi?`)) return;
  state.measurements = state.measurements.filter((x) => x.date !== d);
  persist();
  fillMeasure(d);
};

function waistDeltaFor(wk) {
  return wk ? measureDelta(state.measurements, 'waist', wk.from, wk.to) : null;
}

// ---------- Etkin hedefler (refeed, diyet molası, peak week) ----------
function planCtx() {
  const base = weeklySummaries(state.entries, state.profile);
  const ma = movingAverage(state.entries);
  const bw = ma[ma.length - 1]?.avg ?? (state.profile.targetWeight || null);
  const m = estimateMaintenance(base, state.profile);
  return { bw, maintenance: m.kcal, maintenanceInfo: m, peak: state.plan.peak };
}
function targetsInfo(date, ctx = planCtx()) {
  return targetsForDate(date, state.profile, state.plan.events, ctx);
}
function targetsFor(date, ctx) { return targetsInfo(date, ctx).targets; }
function allWeeks() {
  const ctx = planCtx();
  return weeklySummaries(state.entries, state.profile, (d) => targetsFor(d, ctx));
}
function breakDaysFor(wk) {
  return wk ? eventDaysIn(state.plan.events, addDays(wk.from, -7), wk.to, 'dietBreak') : 0;
}

function renderTodayBanner() {
  const info = targetsInfo(today());
  const b = $('#today-banner');
  if (!info.label) { b.classList.add('hidden'); return; }
  const t = info.targets;
  b.classList.remove('hidden');
  b.innerHTML = `Bugün: ${esc(info.label)} · ${t.kcal} kcal · P ${t.protein} · K ${t.carbs} · Y ${t.fat} <button class="link" data-go="plan">plana git</button>`;
}

// ---------- Basit çizgi grafik ----------
function seriesSVG(points, { unit = '', label = '' } = {}) {
  if (points.length < 2) return '<p class="muted center">Grafik için en az 2 seans gerekli.</p>';
  const W = 640, H = 200, pl = 42, pr = 10, pt = 10, pb = 24;
  const vals = points.map((p) => p.v);
  let min = Math.min(...vals), max = Math.max(...vals);
  const pad = Math.max(1, (max - min) * 0.1); min -= pad; max += pad;
  const d0 = points[0].date, span = Math.max(1, daysBetween(d0, points[points.length - 1].date));
  const x = (d) => pl + (daysBetween(d0, d) / span) * (W - pl - pr);
  const y = (v) => pt + (1 - (v - min) / (max - min)) * (H - pt - pb);
  const grid = [0, 1, 2, 3].map((i) => { const v = min + ((max - min) * i) / 3; return `<line x1="${pl}" x2="${W - pr}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${pl - 6}" y="${y(v) + 4}" class="axis" text-anchor="end">${max - min < 10 ? v.toFixed(1) : Math.round(v)}</text>`; }).join('');
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.date).toFixed(1)},${y(p.v).toFixed(1)}`).join('');
  const dots = points.map((p) => `<circle cx="${x(p.date).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="3.5" class="pt"><title>${p.date}: ${p.v} ${unit}${p.note ? ' · ' + esc(p.note) : ''}</title></circle>`).join('');
  const labels = [points[0], points[points.length - 1]].map((p, i) => `<text x="${x(p.date)}" y="${H - 6}" class="axis" text-anchor="${i ? 'end' : 'start'}">${p.date.slice(5)}</text>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">${grid}<path d="${path}" class="avgline"/>${dots}${labels}</svg>`;
}

let strengthEx = null;
function strengthChartHTML(ids) {
  const withData = ids.filter((id) => stallStatus(state.training.sessions, id).history.length);
  if (!withData.length) return '';
  if (!withData.includes(strengthEx)) strengthEx = withData[0];
  const hist = sessionsFor(state.training.sessions, strengthEx).map((s) => {
    const sets = s.sets.filter((x) => x.id === strengthEx);
    const top = sets.reduce((a, b) => ((b.kg || 0) > (a.kg || 0) ? b : a), sets[0]);
    return { date: s.date, v: bestE1RM(s, strengthEx), note: `en ağır set ${top.kg} kg × ${top.reps}` };
  }).filter((p) => p.v != null);
  return `<label class="strength-ctl">Hareket<select id="strength-select">${withData.map((id) => `<option value="${id}" ${id === strengthEx ? 'selected' : ''}>${esc(EXERCISES[id].name)}</option>`).join('')}</select></label>
    <div class="chart">${seriesSVG(hist, { unit: 'kg e1RM', label: 'Kuvvet gelişimi' })}</div>`;
}

// ---------- Fotoğraflar ----------
let compareSel = { pose: 'front', a: null, b: null };

async function renderPhotos() {
  const sel = $('#photo-pose');
  if (!sel.options.length) sel.innerHTML = Object.entries(POSES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
  if (!$('#photo-date').value) $('#photo-date').value = today();
  const list = [...state.photos].sort((a, b) => (a.date < b.date ? 1 : -1));
  const dates = [...new Set(list.map((p) => p.date))];
  if (!list.length) { $('#photo-list').innerHTML = '<p class="muted">Henüz fotoğraf yok.</p>'; $('#photo-compare').innerHTML = ''; return; }

  // Karşılaştırma: varsayılan ilk ve son tarih
  if (!dates.includes(compareSel.a)) compareSel.a = dates[dates.length - 1];
  if (!dates.includes(compareSel.b)) compareSel.b = dates[0];
  const opt = (v) => dates.map((d) => `<option ${d === v ? 'selected' : ''}>${d}</option>`).join('');
  const pick = (date) => list.find((p) => p.date === date && p.pose === compareSel.pose);
  const pa = pick(compareSel.a), pb = pick(compareSel.b);
  const wOn = (d) => movingAverage(state.entries).filter((x) => x.date <= d).pop()?.avg;
  const cap = (d) => `${d}${wOn(d) ? ` · ${wOn(d)} kg` : ''}`;
  $('#photo-compare').innerHTML = dates.length > 1 ? `<h3 class="sub">Karşılaştır</h3>
    <div class="compare-ctl">
      <label>Poz<select id="cmp-pose">${Object.entries(POSES).map(([k, v]) => `<option value="${k}" ${k === compareSel.pose ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <label>Önce<select id="cmp-a">${opt(compareSel.a)}</select></label>
      <label>Sonra<select id="cmp-b">${opt(compareSel.b)}</select></label>
    </div>
    <div class="compare">
      <figure>${pa ? `<img data-photo="${pa.id}" alt="Önce">` : '<div class="muted center">Bu poz yok</div>'}<figcaption>${cap(compareSel.a)}</figcaption></figure>
      <figure>${pb ? `<img data-photo="${pb.id}" alt="Sonra">` : '<div class="muted center">Bu poz yok</div>'}<figcaption>${cap(compareSel.b)}</figcaption></figure>
    </div>` : '';
  $('#photo-list').innerHTML = dates.map((d) => `<h3 class="sub">${d}</h3><div class="photo-grid">${list.filter((p) => p.date === d).map((p) =>
    `<figure><img data-photo="${p.id}" alt="${POSES[p.pose]} ${d}" loading="lazy"><figcaption><span>${POSES[p.pose] || p.pose}</span></figcaption>
      <button class="icon" data-delphoto="${p.id}" title="Sil">×</button></figure>`).join('')}</div>`).join('');

  for (const img of $$('img[data-photo]', $('#photos-card'))) {
    try { const u = await photoURL(img.dataset.photo); if (u) img.src = u; else img.alt = 'Fotoğraf bu cihazda yok'; } catch { img.alt = 'Yüklenemedi'; }
  }
  ['cmp-pose', 'cmp-a', 'cmp-b'].forEach((id) => {
    const el = $(`#${id}`);
    if (el) el.onchange = () => { compareSel = { pose: $('#cmp-pose').value, a: $('#cmp-a').value, b: $('#cmp-b').value }; renderPhotos(); };
  });
}

$('#photo-input').onchange = async (e) => {
  const files = [...e.target.files];
  e.target.value = '';
  const date = $('#photo-date').value || today();
  const poseSel = $('#photo-pose');
  let pose = poseSel.value, n = 0;
  const poseKeys = Object.keys(POSES);
  for (const f of files) {
    try {
      const blob = await resizeImage(f);
      const id = `p_${date}_${Date.now()}_${n}`;
      await putPhoto(id, blob);
      state.photos.push({ id, date, pose });
      n++;
      // Çoklu seçimde sıradaki poza geç (ön → yan → arka → poz)
      if (files.length > 1) pose = poseKeys[(poseKeys.indexOf(pose) + 1) % poseKeys.length];
    } catch (err) {
      toast(`Fotoğraf eklenemedi: ${err.message}`);
    }
  }
  if (n) { persist(); toast(`${n} fotoğraf eklendi`); }
  renderPhotos();
};
$('#photos-card').addEventListener('click', async (e) => {
  const id = e.target.dataset.delphoto;
  if (!id || !confirm('Fotoğraf silinsin mi?')) return;
  try { await deletePhoto(id); } catch {}
  forgetURL(id);
  state.photos = state.photos.filter((p) => p.id !== id);
  persist();
  renderPhotos();
});

// ---------- Plan: takvim ----------
function renderPlan() {
  renderCalendar();
  renderPeak();
}

function renderCalendar() {
  const ctx = planCtx();
  const m = ctx.maintenanceInfo;
  const evs = [...state.plan.events].sort((a, b) => (a.start < b.start ? -1 : 1));
  const sugg = suggestPlan(state.profile, today(), state.plan.events);
  const t = today();
  $('#plan-calendar').innerHTML = `
    <div class="card-head"><h2>Diyet molası ve refeed takvimi</h2></div>
    <p class="muted">Tahmini idame kalorisi: <b>${m.kcal} kcal</b> ${m.estimated ? '(henüz yeterli veri yok, kaba tahmin)' : `(son ${m.weeks} haftanın kalori ve kilo değişiminden)`}. Refeed günü karbonhidrat idameye kadar yükselir, diyet molasında kalori idameye çıkar ve kardiyo yarıya iner. Bu günlerde uyum o günün hedeflerine göre ölçülür; diyet molası haftası ve sonraki hafta için koç kalori kararı vermez.</p>
    ${evs.length ? `<ul class="events">${evs.map((e) => {
      const end = addDays(e.start, (e.days || 1) - 1);
      const tg = eventTargets(e.type, state.profile.targets, ctx.maintenance, ctx.bw);
      return `<li class="${end < t ? 'past' : ''}"><span><span class="tag ${e.type}">${EVENT_TYPES[e.type]}</span> ${e.start}${e.days > 1 ? ` → ${end} (${e.days} gün)` : ''}<br><small class="muted">${tg.kcal} kcal · K ${tg.carbs} · Y ${tg.fat}</small></span>
        <button class="icon" data-delev="${e.start}|${e.type}" title="Sil">×</button></li>`;
    }).join('')}</ul>` : '<p class="muted">Planlanmış gün yok.</p>'}
    <div class="evform">
      <label>Tür<select id="ev-type"><option value="refeed">Refeed günü</option><option value="dietBreak">Diyet molası</option></select></label>
      <label>Başlangıç<input type="date" id="ev-start" value="${addDays(t, 1)}"></label>
      <label>Gün<input type="number" id="ev-days" min="1" max="14" value="1"></label>
      <button id="ev-add">Ekle</button>
    </div>
    ${sugg.length ? `<div class="row wrap"><button class="ghost" id="ev-suggest">Önerilen takvimi ekle (${sugg.filter((e) => e.type === 'dietBreak').length} mola, ${sugg.filter((e) => e.type === 'refeed').length} refeed)</button></div>` : ''}`;
  $('#ev-type').onchange = (e) => { $('#ev-days').value = e.target.value === 'dietBreak' ? 7 : 1; };
  $('#ev-add').onclick = () => {
    const ev = { type: $('#ev-type').value, start: $('#ev-start').value, days: Math.max(1, Math.min(14, +$('#ev-days').value || 1)) };
    if (!ev.start) return;
    for (let i = 0; i < ev.days; i++) if (eventOn(state.plan.events, addDays(ev.start, i))) { toast('Bu tarihlerde zaten planlı bir gün var'); return; }
    state.plan.events.push(ev); persist(); toast('Takvime eklendi'); renderCalendar();
  };
  if (sugg.length) $('#ev-suggest').onclick = () => { state.plan.events.push(...sugg); persist(); toast(`${sugg.length} gün eklendi`); renderCalendar(); };
  $$('[data-delev]').forEach((b) => (b.onclick = () => {
    const [start, type] = b.dataset.delev.split('|');
    state.plan.events = state.plan.events.filter((e) => !(e.start === start && e.type === type));
    persist(); renderCalendar();
  }));
}

// ---------- Plan: peak week ----------
const LOOKS = { flat: 'Düz', full: 'Dolu', spill: 'Taşmış / bulanık' };

function renderPeak() {
  const p = state.profile, pk = state.plan.peak;
  const card = $('#peak-card');
  if (!p.showDate) { card.innerHTML = '<h2>Peak week</h2><p class="muted">Ayarlar\'dan yarış tarihini gir; son 7 günün planı burada oluşur.</p>'; return; }
  const ctx = planCtx();
  const days = peakWeekPlan(p, ctx.bw, pk);
  const t = today();
  const until = daysBetween(t, days[0].date);
  card.innerHTML = `
    <div class="card-head"><h2>Peak week</h2><span class="muted">${until > 0 ? `${until} gün sonra başlar` : daysBetween(t, p.showDate) < 0 ? 'Yarış geçti' : 'Şu an peak week'}</span></div>
    <p class="muted">Muhafazakâr yaklaşım: su ve sodyum sabit, karbonhidrat yüklemesi yarıştan önceki ${pk.loadDays} günde. Hesap ${ctx.bw} kg üzerinden yapılır. Diüretik kullanma, suyu kesme. Yüklemeyi yarıştan önce bir prova haftasında denemek en güvenlisidir.</p>
    <div class="peak-opts">
      <label>Yükleme günü<select id="pk-days">${[1, 2, 3].map((n) => `<option ${n === pk.loadDays ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label>Karbonhidrat (g/kg)<select id="pk-g">${[5, 6, 7, 8, 9, 10].map((n) => `<option ${n === pk.loadGkg ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
    </div>
    ${days.map((d) => {
      const checks = pk.checks[d.date] || {};
      const look = pk.looks[d.date];
      const adj = peakAdjust(d, look);
      const showLooks = d.phase !== 'Normal diyet';
      return `<div class="pday ${d.date === t ? 'today' : ''}">
        <h3>${d.offset === 0 ? 'Yarış günü' : `${-d.offset} gün kala`} <span class="muted">${d.date}</span> <span class="tag ${d.phase === 'Karbonhidrat yükleme' ? 'load' : ''}">${d.phase}</span></h3>
        <div class="macros"><div><span>Kalori</span>${d.targets.kcal}</div><div><span>Protein</span>${d.targets.protein} g</div><div><span>Karb</span>${adj && adj.carbs !== d.targets.carbs ? `<s class="muted">${d.targets.carbs}</s> ${adj.carbs}` : d.targets.carbs} g</div><div><span>Yağ</span>${d.targets.fat} g</div></div>
        <div class="muted">Su ${d.waterL} L · Sodyum: ${esc(d.sodium)} · Lif: ${esc(d.fiber)}</div>
        <div class="muted">Antrenman: ${esc(d.training)}${d.targets.cardioMin ? ` · kardiyo ${d.targets.cardioMin} dk` : ''}</div>
        <ul class="check">${d.checklist.map((c, i) => `<li><label><input type="checkbox" data-pkc="${d.date}|${i}" ${checks[i] ? 'checked' : ''}> ${esc(c)}</label></li>`).join('')}</ul>
        ${showLooks ? `<div class="looks"><span class="muted">Sabah görünüm:</span>${Object.entries(LOOKS).map(([k, v]) => `<button class="${look === k ? '' : 'ghost'}" data-look="${d.date}|${k}">${v}</button>`).join('')}</div>${adj ? `<p class="headline st-${look === 'full' ? 'ok' : 'slow'}">${esc(adj.text)}</p>` : ''}` : ''}
      </div>`;
    }).join('')}`;
  $('#pk-days').onchange = (e) => { pk.loadDays = +e.target.value; persist(); renderPeak(); };
  $('#pk-g').onchange = (e) => { pk.loadGkg = +e.target.value; persist(); renderPeak(); };
  card.onchange = (e) => {
    const k = e.target.dataset.pkc;
    if (!k) return;
    const [date, i] = k.split('|');
    (pk.checks[date] ||= {})[i] = e.target.checked;
    persist();
  };
  card.onclick = (e) => {
    const k = e.target.dataset.look;
    if (!k) return;
    const [date, look] = k.split('|');
    pk.looks[date] = pk.looks[date] === look ? undefined : look;
    persist(); renderPeak();
  };
}

// ---------- Vücut kompozisyonu ----------
function bodyFatOf(m) {
  if (m.bodyFat != null) return { bf: m.bodyFat, src: 'girilen' };
  const bf = navyBodyFat({ sex: state.profile.sex, heightCm: state.profile.heightCm, waist: m.waist, neck: m.neck, hip: m.hip });
  return bf != null ? { bf, src: 'Navy' } : null;
}
function weightOn(date) {
  return movingAverage(state.entries).filter((x) => x.date <= date).pop()?.avg ?? null;
}

function renderComposition() {
  const card = $('#comp-card');
  const p = state.profile;
  const series = sortEntries(state.measurements).map((m) => ({ m, r: bodyFatOf(m), w: weightOn(m.date) })).filter((x) => x.r && x.w);
  if (!series.length) {
    card.innerHTML = `<h2>Vücut kompozisyonu</h2><p class="muted">Kayıt sekmesindeki ölçülere <b>bel</b> ve <b>boyun</b>${p.sex === 'kadın' ? ' ve <b>kalça</b>' : ''} gir (ya da yağ %'ni), Ayarlar'da boyunun doğru olduğundan emin ol. Yağ oranı, yağsız kütle ve sahne kilosu tahmini burada görünür.</p>`;
    return;
  }
  const last = series[series.length - 1];
  const c = composition({ weight: last.w, bodyFat: last.r.bf, heightCm: p.heightCm, sex: p.sex, targetWeight: p.targetWeight });
  const first = series[0];
  const lbmFirst = round(first.w * (1 - first.r.bf / 100), 1);
  const protPerLbm = p.targets.protein ? round(p.targets.protein / c.lbm, 1) : null;
  card.innerHTML = `
    <div class="card-head"><h2>Vücut kompozisyonu</h2><span class="muted">${last.m.date} · ${last.r.src === 'Navy' ? 'US Navy tahmini' : 'girilen değer'}</span></div>
    <div class="grid3">
      <div><span>Yağ oranı</span>%${c.bodyFat}</div><div><span>Yağsız kütle</span>${c.lbm} kg</div><div><span>Yağ kütlesi</span>${c.fatKg} kg</div>
      <div><span>FFMI (norm.)</span>${show(c.ffmiNorm)}</div><div><span>Sahne tahmini</span>${c.stageLow}–${c.stageHigh} kg</div><div><span>Protein / yağsız kg</span>${show(protPerLbm, ' g')}</div>
    </div>
    ${series.length > 1 ? `<p class="muted">İlk ölçümden bu yana: yağ ${round(last.r.bf - first.r.bf, 1) > 0 ? '+' : ''}${round(last.r.bf - first.r.bf, 1)} puan, yağsız kütle ${round(c.lbm - lbmFirst, 1) > 0 ? '+' : ''}${round(c.lbm - lbmFirst, 1)} kg.</p>
      <div class="chart">${seriesSVG(series.map((x) => ({ date: x.m.date, v: x.r.bf })), { unit: '%', label: 'Yağ oranı' })}</div>` : ''}
    <ul class="plain">${c.notes.map((n) => `<li>• ${esc(n)}</li>`).join('')}
      ${protPerLbm != null && p.goal === 'cut' && protPerLbm < 2.3 ? '<li>• Deficitte yağsız kütle başına 2.3–3.1 g protein önerilir; hedefini artırmayı düşün.</li>' : ''}</ul>
    <p class="muted">Navy yöntemi ±3–4 puan hata payı taşır; mutlak değerden çok eğilime bak. Sahne tahmini erkekte ~%${STAGE_BF.erkek}, kadında ~%${STAGE_BF.kadın} yağ ve %0–3 yağsız kütle kaybı varsayar.</p>`;
}

// ---------- Öğün planı ----------
function renderMeals() {
  const st = state.plan.meals;
  const date = st.date && st.date >= today() ? st.date : today();
  const info = targetsInfo(date);
  const plan = mealPlan(info.targets, st.count, st.trainAfter);
  const n = st.count;
  const trainOpts = [[-1, 'Antrenman yok'], [0, '1. öğünden önce (aç)'], ...Array.from({ length: n }, (_, i) => [i + 1, `${i + 1}. öğünden sonra`])];
  $('#meal-card').innerHTML = `
    <div class="card-head"><h2>Öğün planı</h2><input type="date" id="meal-date" value="${date}"></div>
    <p class="muted">${info.label ? `<b>${esc(info.label)}</b> · ` : ''}${info.targets.kcal} kcal · P ${info.targets.protein} · K ${info.targets.carbs} · Y ${info.targets.fat}</p>
    <div class="peak-opts">
      <label>Öğün sayısı<select id="meal-count">${[2, 3, 4, 5, 6].map((x) => `<option ${x === n ? 'selected' : ''}>${x}</option>`).join('')}</select></label>
      <label>Antrenman<select id="meal-train">${trainOpts.map(([v, l]) => `<option value="${v}" ${v === st.trainAfter ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
    </div>
    <div class="table-wrap"><table><thead><tr><th>Öğün</th><th>Protein</th><th>Karb</th><th>Yağ</th><th>kcal</th></tr></thead><tbody>
      ${plan.map((m) => `<tr><td>${m.index}${m.role ? ` <span class="tag ${m.role.includes('sonrası') ? 'dietBreak' : 'load'}">${m.role}</span>` : ''}</td><td>${m.protein} g</td><td>${m.carbs} g</td><td>${m.fat} g</td><td>${m.kcal}</td></tr>`).join('')}
    </tbody></table></div>
    <p class="muted">Protein öğünlere eşit dağılır (öğün başına ~0.4 g/kg idealdir). Karbonhidrat antrenman öncesi ve sonrası öğünlerde yoğunlaşır, yağ bu öğünlerde düşük tutulur (sindirim hızı için).</p>`;
  $('#meal-date').onchange = (e) => { st.date = e.target.value; persist(); renderMeals(); };
  $('#meal-count').onchange = (e) => { st.count = +e.target.value; if (st.trainAfter > st.count) st.trainAfter = st.count; persist(); renderMeals(); };
  $('#meal-train').onchange = (e) => { st.trainAfter = +e.target.value; persist(); renderMeals(); };
}

// ---------- Tam yedek (fotoğraflar dahil) ----------
const blobToDataURL = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });

$('#export-full').onclick = async () => {
  const photoData = {};
  let missing = 0;
  for (const p of state.photos) {
    try { const b = await getPhoto(p.id); if (b) photoData[p.id] = await blobToDataURL(b); else missing++; } catch { missing++; }
  }
  download(`bulut-tam-yedek-${today()}.json`, JSON.stringify({ ...state, photoData }), 'application/json');
  toast(`Tam yedek hazır · ${Object.keys(photoData).length} fotoğraf${missing ? `, ${missing} eksik` : ''}`);
};

async function restorePhotos(photoData) {
  let n = 0;
  for (const [id, url] of Object.entries(photoData || {})) {
    if (typeof url !== 'string' || !url.startsWith('data:image/')) continue;
    try { await putPhoto(id, await (await fetch(url)).blob()); forgetURL(id); n++; } catch {}
  }
  return n;
}

// ---------- Örnek veri ----------
$('#demo-btn').onclick = () => {
  const start = addDays(today(), -34);
  const s = emptyState();
  Object.assign(s.profile, { name: 'Örnek', heightCm: 178, startDate: start, showDate: addDays(today(), 70), startWeight: 82, targetWeight: 74, targetRatePct: 0.75 });
  s.profile.targets = { kcal: 2450, protein: 190, carbs: 260, fat: 70, steps: 10000, cardioMin: 20 };
  let w = 82;
  for (let i = 0; i <= 34; i++) {
    w -= i < 21 ? 0.085 : 0.02; // son iki hafta platoya girer
    const noise = Math.sin(i * 1.7) * 0.35 + (i % 7 === 1 ? 0.4 : 0);
    s.entries.push({
      date: addDays(start, i), weight: round(w + noise, 1), sleep: round(6.5 + Math.cos(i) * 0.8, 1),
      stress: 4 + (i % 3), energy: 7 - (i % 4 === 0 ? 2 : 0), hunger: 5 + Math.floor(i / 12), steps: 9000 + (i % 5) * 600,
      cardioMin: i % 2 ? 20 : 25, kcal: 2450 + ((i % 5) - 2) * 40, protein: 190, carbs: 260, fat: 70, trained: i % 7 !== 6, note: '',
    });
  }
  // Örnek antrenmanlar: üst/alt, haftada 4; son 2 haftada bench ve squat platoda
  const prog = PROGRAMS.upperLower4;
  let di = 0;
  for (let i = 0; i <= 34; i++) {
    if (![0, 1, 3, 4].includes(i % 7)) continue;
    const day = prog.days[di++ % prog.days.length];
    const wk = Math.min(Math.floor(i / 7), 3);
    const sets = day.items.flatMap((it) => {
      const base = { bench: 85, squat: 110, row: 75, ohp: 52.5, rdl: 100, hackSquat: 140, hipThrust: 120, inclineDb: 30, cableRow: 65, pulldown: 65 }[it.id] ?? 20;
      const kg = EXERCISES[it.id].type === 'c' ? base + wk * 2.5 : base + wk;
      return Array.from({ length: it.sets }, (_, j) => ({ id: it.id, kg, reps: Math.max(it.repMin, it.repMax - 2 - j), rir: it.rir }));
    });
    s.training.sessions.push({ id: `demo-${i}`, date: addDays(start, i), dayName: day.name, sets, note: '' });
  }
  [85, 84.3, 83.7, 83.1, 82.4].forEach((waist, i) => s.measurements.push({ date: addDays(start, i * 7 + 6), waist, hip: round(98 - i * 0.4, 1), chest: round(104 - i * 0.2, 1), arm: 38.5, neck: 39, thigh: round(60 - i * 0.3, 1), bodyFat: null }));
  s.plan.events = [{ type: 'refeed', start: addDays(start, 26), days: 1 }, ...suggestPlan(s.profile, today(), [])];
  state.photos.forEach((p) => { deletePhoto(p.id).catch(() => {}); forgetURL(p.id); });
  state = s;
  persist();
  toast('Örnek veri yüklendi');
  render();
};

// ---------- Render ----------
function render() {
  const { profile } = state;
  const d = profile.showDate ? daysBetween(today(), profile.showDate) : null;
  $('#phase').textContent = `${profile.name ? profile.name + ' · ' : ''}${phaseOf(profile, today())}${d != null && d >= 0 ? ` · ${d} gün` : ''}`;
  const active = $('.view.active').id.replace('view-', '');
  if (active === 'dash') renderDash();
  if (active === 'progress') { renderComposition(); renderWeeks(); renderPhotos(); }
  if (active === 'plan') { renderMeals(); renderPlan(); }
  if (active === 'train') renderTrain();
  if (active === 'log') renderHistory();
  if (active === 'settings') fillProfile();
  if (active === 'log' && !$('#log-form').date.value) fillLog(today());
  if (active === 'log' && !$('#measure-form').date.value) fillMeasure(today());
}

let startTab = 'dash';
try { startTab = localStorage.getItem('bulut.tab') || 'dash'; } catch {}
go($(`#view-${startTab}`) ? startTab : 'dash');

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
