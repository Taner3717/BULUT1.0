import {
  fmt, addDays, daysBetween, round, sortEntries, movingAverage, weeklySummaries, evaluateWeek,
  projection, phaseOf, dailyFeedback, weeklyReport, toCSV, parseCSV, kcalFromMacros,
} from './coach.js';
import { PROGRAMS, EXERCISES, MUSCLES, VOLUME_RANGE, suggestNext, stallStatus, evaluateTraining, nextDayIndex } from './training.js';
import { load, save, normalize, emptyState, upsertEntry, removeEntry } from './storage.js';

let state = load();
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
  const weeks = weeklySummaries(entries, profile);
  const ma = movingAverage(entries);
  const last = ma[ma.length - 1];
  const cur = weeks[weeks.length - 1];
  const proj = projection(profile, last?.avg, today());
  const totalChange = last && profile.startWeight ? round(last.avg - profile.startWeight, 1) : null;

  const stats = [
    ['7 gün ort.', show(last?.avg, ' kg'), last ? `Son tartı ${last.weight} kg` : ''],
    ['Haftalık değişim', cur?.changePct != null ? `${cur.changeKg > 0 ? '+' : ''}${cur.changeKg} kg` : '–', cur?.changePct != null ? `%${cur.changePct}` : 'önceki hafta yok'],
    ['Toplam', totalChange != null ? `${totalChange > 0 ? '+' : ''}${totalChange} kg` : '–', profile.startWeight ? `Başlangıç ${profile.startWeight} kg` : ''],
    ['Yarışa', proj ? (proj.daysLeft >= 0 ? `${proj.daysLeft} gün` : 'bitti') : '–', proj && proj.daysLeft > 0 ? `Kalan ${proj.remainingKg} kg · %${proj.requiredPct}/hf` : ''],
    ['Uyum (hafta)', show(cur?.adherence, '%'), `${cur?.weighIns ?? 0}/7 tartı`],
    ['Toparlanma', show(cur?.recovery, '/100'), cur ? `Uyku ${show(cur.avgSleep, ' s')}` : ''],
  ];
  $('#stats').innerHTML = stats.map(([k, v, s]) => `<div class="stat"><div class="k">${k}</div><div class="v">${esc(v)}</div><div class="s">${esc(s)}</div></div>`).join('');

  $('#chart').innerHTML = chartSVG(ma, profile);
  $('#chart-legend').innerHTML = '<i class="dot raw"></i>tartı <i class="dot avg"></i>7g ort.' + (profile.targetWeight ? ' <i class="dot tgt"></i>hedef' : '');

  renderCoach(weeks);
}

function renderCoach(weeks) {
  const card = $('#coach-card');
  const wk = evaluationWeek(weeks);
  if (!wk) {
    card.innerHTML = '<h2>Koç</h2><p class="muted">Henüz veri yok.</p>';
    return;
  }
  const ev = evaluateWeek(wk, state.profile, today());
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
    const text = weeklyReport(wk, ev, state.profile, today()) + (state.training.sessions.length
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
  const vals = data.flatMap((d) => [d.weight, d.avg]);
  if (profile.targetWeight) vals.push(profile.targetWeight);
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
  const tgt = profile.targetWeight && profile.targetWeight > min && profile.targetWeight < max
    ? `<line x1="${pl}" x2="${W - pr}" y1="${y(profile.targetWeight)}" y2="${y(profile.targetWeight)}" class="tgt"/>` : '';
  const dots = data.map((d) => `<circle cx="${x(d.date).toFixed(1)}" cy="${y(d.weight).toFixed(1)}" r="2.5" class="raw"><title>${d.date}: ${d.weight} kg (ort. ${d.avg})</title></circle>`).join('');
  return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Kilo trendi">${grid.join('')}${tgt}<path d="${path('weight')}" class="rawline"/>${dots}<path d="${path('avg')}" class="avgline"/>${labels}</svg>`;
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
  const fb = dailyFeedback(e, state.profile.targets);
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
  toast(`${entry.date} kaydedildi`);
});
$('#log-delete').onclick = () => {
  const d = $('#log-form').date.value;
  if (!confirm(`${d} kaydı silinsin mi?`)) return;
  removeEntry(state, d);
  persist();
  fillLog(d);
  toast('Silindi');
};

// ---------- Haftalar ----------
function renderWeeks() {
  const weeks = weeklySummaries(state.entries, state.profile).reverse();
  if (!weeks.length) { $('#weeks').innerHTML = '<div class="card"><p class="muted">Henüz hafta yok.</p></div>'; return; }
  $('#weeks').innerHTML = weeks.map((w) => {
    const ev = evaluateWeek(w, state.profile, w.to);
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
  if (d) { go('log'); fillLog(d); }
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
    const data = normalize(JSON.parse(await file.text()));
    if (!confirm(`${data.entries.length} günlük kayıt yüklenecek ve mevcut veri değişecek. Devam?`)) return;
    state = data;
    persist();
    toast('Yedek yüklendi');
    render();
  } catch {
    toast('Dosya okunamadı');
  } finally {
    e.target.value = '';
  }
};
$('#reset').onclick = () => {
  if (!confirm('Tüm veriler silinecek. Emin misin?')) return;
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
function program() { return PROGRAMS[state.training.programId] || PROGRAMS.upperLower4; }

function renderTrain() {
  const tr = state.training;
  const prog = program();
  const next = nextDayIndex(prog, tr.sessions);
  $('#train-program').innerHTML = `
    <div class="card-head"><h2>Program</h2>
      <select id="prog-select">${Object.entries(PROGRAMS).map(([id, p]) => `<option value="${id}" ${id === tr.programId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}</select></div>
    <p class="muted">Sıradaki gün vurgulandı. Ağırlık önerileri son seansına göre çift ilerleme ile hesaplanır.</p>
    <div class="days">${prog.days.map((d, i) => `<button class="${i === next ? '' : 'ghost'}" data-start="${i}">${esc(d.name)}<small>${d.items.length} hareket · ${d.items.reduce((a, x) => a + x.sets, 0)} set</small></button>`).join('')}</div>`;
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
  const weeks = weeklySummaries(state.entries, state.profile);
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
  $('#train-progress').innerHTML = `<h2>Güç gelişimi</h2>${rows
    ? `<div class="table-wrap"><table class="prog"><thead><tr><th>Hareket</th><th>Seans</th><th>Son e1RM</th><th>En iyi</th><th>Değişim</th></tr></thead><tbody>${rows}</tbody></table></div><p class="muted">e1RM: Epley formülüyle tahmini tek tekrar maksimum. ⏸ = son 3 seansta ilerleme yok.</p>`
    : '<p class="muted">Henüz antrenman kaydı yok.</p>'}`;
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

// ---------- Örnek veri ----------
$('#demo-btn').onclick = () => {
  const start = addDays(today(), -34);
  const s = emptyState();
  Object.assign(s.profile, { name: 'Örnek', startDate: start, showDate: addDays(today(), 70), startWeight: 82, targetWeight: 74, targetRatePct: 0.75 });
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
  if (active === 'weeks') renderWeeks();
  if (active === 'train') renderTrain();
  if (active === 'history') renderHistory();
  if (active === 'settings') fillProfile();
  if (active === 'log' && !$('#log-form').date.value) fillLog(today());
}

let startTab = 'dash';
try { startTab = localStorage.getItem('bulut.tab') || 'dash'; } catch {}
go($(`#view-${startTab}`) ? startTab : 'dash');
