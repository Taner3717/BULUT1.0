import { DEFAULT_PROFILE } from './coach.js';

const KEY = 'bulut.v1';

export function emptyState() {
  return { profile: structuredClone(DEFAULT_PROFILE), entries: [] };
}

export function normalize(raw) {
  const base = emptyState();
  if (!raw || typeof raw !== 'object') return base;
  const profile = { ...base.profile, ...(raw.profile || {}) };
  profile.targets = { ...base.profile.targets, ...((raw.profile || {}).targets || {}) };
  profile.targetHistory = Array.isArray(profile.targetHistory) ? profile.targetHistory : [];
  const entries = Array.isArray(raw.entries) ? raw.entries.filter((e) => e && /^\d{4}-\d{2}-\d{2}$/.test(e.date)) : [];
  return { profile, entries };
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
