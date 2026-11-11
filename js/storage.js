import { DEFAULT_PROFILE } from './coach.js';

const KEY = 'bulut.v1';

export function emptyState() {
  return {
    profile: structuredClone(DEFAULT_PROFILE), entries: [], measurements: [], photos: [],
    plan: { events: [], peak: { loadDays: 2, loadGkg: 7, checks: {}, looks: {} }, meals: { count: 4, trainAfter: 2, date: '' } },
    training: { programId: 'upperLower4', sessions: [], draft: null, customPrograms: {}, customExercises: {} },
  };
}

export function normalize(raw) {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;
  const profile = { ...base.profile, ...(raw.profile || {}) };
  profile.targets = { ...base.profile.targets, ...((raw.profile || {}).targets || {}) };
  profile.targetHistory = Array.isArray(profile.targetHistory) ? profile.targetHistory : [];
  const entries = Array.isArray(raw.entries) ? raw.entries.filter((e) => e && /^\d{4}-\d{2}-\d{2}$/.test(e.date)) : [];
  const t = raw.training || {};
  const training = {
    programId: t.programId || base.training.programId,
    sessions: Array.isArray(t.sessions) ? t.sessions.filter((x) => x && x.date && Array.isArray(x.sets)) : [],
    draft: t.draft && Array.isArray(t.draft.items) ? t.draft : null,
    customPrograms: t.customPrograms && typeof t.customPrograms === 'object' ? t.customPrograms : {},
    customExercises: t.customExercises && typeof t.customExercises === 'object' ? t.customExercises : {},
  };
  const measurements = Array.isArray(raw.measurements) ? raw.measurements.filter((m) => m && /^\d{4}-\d{2}-\d{2}$/.test(m.date)) : [];
  const pl = raw.plan || {};
  const plan = {
    events: Array.isArray(pl.events) ? pl.events.filter((e) => e && e.start && ['refeed', 'dietBreak'].includes(e.type)) : [],
    peak: { ...base.plan.peak, ...(pl.peak || {}) },
    meals: { ...base.plan.meals, ...(pl.meals || {}) },
  };
  plan.peak.checks = plan.peak.checks && typeof plan.peak.checks === 'object' ? plan.peak.checks : {};
  plan.peak.looks = plan.peak.looks && typeof plan.peak.looks === 'object' ? plan.peak.looks : {};
  const photos = Array.isArray(raw.photos) ? raw.photos.filter((x) => x && x.id && x.date) : [];
  return { profile, entries, measurements, photos, plan, training };
}

export function load() {
  try {
    const s = localStorage.getItem(KEY);
    return normalize(s ? JSON.parse(s) : null);
  } catch {
    return emptyState();
  }
}

export function save(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function upsertEntry(state, entry) {
  const i = state.entries.findIndex((e) => e.date === entry.date);
  if (i >= 0) state.entries[i] = entry;
  else state.entries.push(entry);
}

export function removeEntry(state, date) {
  state.entries = state.entries.filter((e) => e.date !== date);
}

export function upsertMeasurement(state, m) {
  const i = state.measurements.findIndex((x) => x.date === m.date);
  if (i >= 0) state.measurements[i] = m;
  else state.measurements.push(m);
}
