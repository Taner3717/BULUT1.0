// BULUT 1.0 — Diyet molası / refeed takvimi ve peak week planlayıcı (saf fonksiyonlar)
import { addDays, daysBetween, round, KCAL_PER_KG } from './coach.js';

const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

export const EVENT_TYPES = { refeed: 'Refeed günü', dietBreak: 'Diyet molası' };

// İdame kalorisi tahmini: ort. kalori − (haftalık değişim kg × 7700 / 7). Son 3 güvenilir hafta.
export function estimateMaintenance(weeks, profile) {
  const usable = weeks.filter((w) => w.weighIns >= 4 && isNum(w.changeKg) && isNum(w.avgKcal) && w.days >= 5).slice(-3);
  if (!usable.length) {
    const t = profile.targets.kcal;
    return { kcal: Math.round((profile.goal === 'cut' ? t + 400 : profile.goal === 'bulk' ? t - 250 : t) / 10) * 10, estimated: true, weeks: 0 };
  }
  const vals = usable.map((w) => w.avgKcal - (w.changeKg * KCAL_PER_KG) / 7);
  return { kcal: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length / 10) * 10, estimated: false, weeks: usable.length };
}

export function eventOn(events, date) {
  return (events || []).find((e) => date >= e.start && date <= addDays(e.start, (e.days || 1) - 1)) || null;
}

export function eventDaysIn(events, from, to, type) {
  let n = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    const e = eventOn(events, d);
    if (e && (!type || e.type === type)) n++;
  }
  return n;
}

// Refeed: idameye kadar karbonhidrat ekle (en az +%30), yağı biraz düşür.
// Diyet molası: idame kalorisi, artış %70 karb / %30 yağ.
export function eventTargets(type, base, maintenanceKcal, bw) {
  const t = { ...base };
  const gap = Math.max(0, maintenanceKcal - base.kcal);
  if (type === 'refeed') {
    const fatFloor = isNum(bw) ? Math.round(bw * 0.6) : 40;
    const fat = Math.max(fatFloor, Math.min(base.fat, base.fat - 15));
    const addCarbsKcal = Math.max(gap + (base.fat - fat) * 9, base.carbs * 0.3 * 4);
    t.fat = fat;
    t.carbs = Math.min(base.carbs * 2, base.carbs + Math.round(addCarbsKcal / 4));
    t.kcal = base.kcal + (t.carbs - base.carbs) * 4 - (base.fat - fat) * 9;
  } else if (type === 'dietBreak') {
    t.carbs = base.carbs + Math.round((gap * 0.7) / 4);
    t.fat = base.fat + Math.round((gap * 0.3) / 9);
    t.kcal = base.kcal + (t.carbs - base.carbs) * 4 + (t.fat - base.fat) * 9;
    t.cardioMin = Math.round((base.cardioMin || 0) / 2);
  }
  return t;
}

// Otomatik takvim önerisi (cut): 8 haftada bir 7 günlük diyet molası (yarışa 4 haftadan fazla varken),
// son 8 haftada (peak week hariç) haftada 1 refeed günü. Sadece gelecekteki tarihler.
export function suggestPlan(profile, today, existing = []) {
  if (profile.goal !== 'cut' || !profile.startDate || !profile.showDate) return [];
  const out = [];
  const show = profile.showDate;
  const free = (start, days) => {
    for (let i = 0; i < days; i++) if (eventOn(existing, addDays(start, i)) || eventOn(out, addDays(start, i))) return false;
    return true;
  };
  for (let w = 8; ; w += 8) {
    const start = addDays(profile.startDate, w * 7);
    if (daysBetween(start, show) <= 35) break;
    if (start > today && free(start, 7)) out.push({ type: 'dietBreak', start, days: 7 });
  }
  const refeedFrom = addDays(show, -56);
  for (let d = refeedFrom; d < addDays(show, -7); d = addDays(d, 7)) {
    const day = addDays(d, 5);
    if (day > today && day < addDays(show, -7) && free(day, 1)) out.push({ type: 'refeed', start: day, days: 1 });
  }
  return out.sort((a, b) => (a.start < b.start ? -1 : 1));
}

// ---------- Peak week ----------
export const DEFAULT_PEAK = { loadDays: 2, loadGkg: 7 };

const TRAINING = {
  '-6': 'Üst vücut, normal ağırlık, hacim ~%60',
  '-5': 'Alt vücut hafif — son bacak antrenmanı',
  '-4': 'Full body pump: hafif, 2–3 set, tükenişe gitme',
  '-3': 'Hafif üst vücut pump ya da dinlenme',
  '-2': 'Dinlenme · poz çalışması',
  '-1': 'Dinlenme · kısa poz provası',
  '0': 'Sahne öncesi pump: bantlarla 10–15 dk, hafif',
};

const CHECKLIST = {
  '-6': ['Yarış kuralları ve tartı/kayıt saatini kontrol et', 'Bronzlaştırıcı, sahne yağı, mayo hazır mı?'],
  '-5': ['Yükleme günleri için yiyecekleri al (alıştığın, lifi düşük karbonhidratlar)'],
  '-4': ['Vücut kıllarını temizle (tahrişe zaman kalsın)'],
  '-3': ['Yükleme öğünlerini hazırla ve tart'],
  '-2': ['Bronzlaştırma 1. kat (organizasyonun kurallarına göre)'],
  '-1': ['Çanta: mayo, bronz, yağ, bant, havlu, terlik, belge', 'Yarış günü öğünlerini paketle', 'Erken yat'],
  '0': ['Kahvaltı: alıştığın karbonhidrat + protein', 'Her 2–3 saatte küçük karbonhidratlı öğün', 'Su: susadıkça yudum yudum, kesme'],
};
const DAILY = ['Sabah aç karnına tartı ve 4 poz fotoğrafı', 'Görünüm notu (düz / dolu / taşmış)', 'Poz pratiği 20–30 dk'];

export function peakWeekPlan(profile, bw, opts = DEFAULT_PEAK) {
  if (!profile.showDate || !isNum(bw)) return [];
  const t = profile.targets;
  const L = Math.min(3, Math.max(1, opts.loadDays || 2));
  const G = Math.min(10, Math.max(4, opts.loadGkg || 7));
  const water = Math.max(3, round(bw * 0.05, 1));
  const days = [];
  for (let off = -6; off <= 0; off++) {
    const date = addDays(profile.showDate, off);
    const load = off < 0 && off >= -L;
    let protein = t.protein, carbs = t.carbs, fat = t.fat;
    if (load) {
      carbs = Math.round(G * bw);
      fat = Math.max(30, Math.round(bw * 0.4));
      protein = Math.round(bw * 2);
    } else if (off === 0) {
      carbs = Math.round(bw * 3);
      fat = Math.max(30, Math.round(bw * 0.5));
      protein = Math.round(bw * 1.8);
    }
    days.push({
      date, offset: off, phase: off === 0 ? 'Yarış günü' : load ? 'Karbonhidrat yükleme' : 'Normal diyet',
      targets: { ...t, protein, carbs, fat, kcal: protein * 4 + carbs * 4 + fat * 9, cardioMin: load || off === 0 ? 0 : Math.round((t.cardioMin || 0) / 2), steps: load || off === 0 ? Math.min(t.steps, 6000) : t.steps },
      waterL: water,
      sodium: 'Alıştığın seviyede sabit tut, kesme.',
      fiber: load ? 'Düşük–orta lif (<20 g), gaz yapmayan alıştığın yiyecekler' : 'Normal',
      training: TRAINING[String(off)],
      checklist: [...DAILY.slice(0, off === 0 ? 1 : 3), ...(CHECKLIST[String(off)] || [])],
    });
  }
  return days;
}

// Sabah görünümüne göre günün karbonhidrat ayarı
export function peakAdjust(day, look) {
  if (!day || !look) return null;
  const c = day.targets.carbs;
  if (look === 'flat') return { carbs: Math.round(c * 1.25), text: 'Düz görünüyorsun: bugün karbonhidratı ~%25 artır, suyu ve sodyumu aynı tut.' };
  if (look === 'spill') return { carbs: Math.round(c * 0.6), text: 'Taşma/bulanıklık var: karbonhidratı ~%40 azalt, lifi düşük tut, suyu kesme.' };
  if (look === 'full') return { carbs: c, text: 'Dolu ve sert: plana aynen devam, değişiklik yapma.' };
  return null;
}

// Bir tarihin etkin hedefleri: peak week > plan olayı > temel hedefler
export function targetsForDate(date, profile, events, ctx = {}) {
  if (profile.showDate) {
    const off = daysBetween(profile.showDate, date);
    if (off >= -6 && off <= 0 && isNum(ctx.bw)) {
      const day = peakWeekPlan(profile, ctx.bw, ctx.peak || DEFAULT_PEAK).find((d) => d.date === date);
      if (day) return { targets: day.targets, label: `Peak week · ${day.phase}` };
    }
  }
  const e = eventOn(events, date);
  if (e && isNum(ctx.maintenance)) return { targets: eventTargets(e.type, profile.targets, ctx.maintenance, ctx.bw), label: EVENT_TYPES[e.type], event: e };
  return { targets: profile.targets, label: null };
}

// ---------- Öğün planı ----------
// count öğün; trainAfter = antrenman kaçıncı öğünden sonra (0 = ilk öğünden önce, -1 = antrenman yok).
// Protein eşit; karbonhidrat antrenman öncesi ve sonrası öğünlerde yoğun; yağ antrenman çevresinde düşük.
export function mealPlan(targets, count = 4, trainAfter = 2) {
  const n = Math.min(6, Math.max(2, count));
  const pre = trainAfter >= 1 && trainAfter <= n ? trainAfter - 1 : -1;
  const post = trainAfter >= 0 && trainAfter < n ? trainAfter : -1;
  const weights = (preW, postW) => Array.from({ length: n }, (_, i) => (i === pre ? preW : i === post ? postW : 1));
  const split = (total, w) => {
    const sum = w.reduce((a, b) => a + b, 0);
    const raw = w.map((x) => (total * x) / sum);
    const out = raw.map(Math.floor);
    let rest = total - out.reduce((a, b) => a + b, 0);
    raw.map((v, i) => [v - Math.floor(v), i]).sort((a, b) => b[0] - a[0]).forEach(([, i]) => { if (rest-- > 0) out[i]++; });
    return out;
  };
  const p = split(Math.round(targets.protein), Array(n).fill(1));
  const c = split(Math.round(targets.carbs), weights(1.6, 2));
  const f = split(Math.round(targets.fat), weights(0.4, 0.4));
  return Array.from({ length: n }, (_, i) => ({
    index: i + 1,
    role: i === pre ? 'Antrenman öncesi' : i === post ? 'Antrenman sonrası' : '',
    protein: p[i], carbs: c[i], fat: f[i], kcal: p[i] * 4 + c[i] * 4 + f[i] * 9,
  }));
}
