/**
 * Working out where a church is in its reading plan.
 *
 * Shared by the church page and the printable sheets so the two can never
 * disagree about what Sunday's reading is.
 */
export const API = 'https://ltg-certificates.fly.dev';

/** The church id from ?church=… , or null. */
export function churchIdFromUrl() {
  const id = new URLSearchParams(location.search).get('church');
  return id && /^[a-z0-9-]{1,80}$/.test(id) ? id : null;
}

export async function fetchChurch(id) {
  const r = await fetch(`${API}/v1/churches/${encodeURIComponent(id)}`);
  if (!r.ok) return null;
  return r.json();
}

let plansPromise = null;
export function fetchPlans(base = '..') {
  plansPromise ??= fetch(`${base}/data/plans.json`).then((r) => r.json());
  return plansPromise;
}

/** Midnight local time, so day boundaries land where a person expects. */
function midnight(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

export function dayNumber(startISO, today = new Date()) {
  const start = midnight(new Date(`${startISO}T00:00:00`));
  const diff = midnight(today).getTime() - start.getTime();
  return Math.floor(diff / 86_400_000) + 1; // day one is the start date itself
}

export function dateForDay(startISO, day) {
  const d = midnight(new Date(`${startISO}T00:00:00`));
  d.setDate(d.getDate() + (day - 1));
  return d;
}

export const fmtDate = (d) =>
  d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });

export const fmtLong = (d) =>
  d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

/** "Genesis 1–3" rather than "Genesis 1, Genesis 2, Genesis 3". */
export function describeChapters(chapters) {
  if (!chapters?.length) return '';
  const parts = [];
  let run = [chapters[0]];
  const flush = () => {
    const first = run[0], last = run[run.length - 1];
    parts.push(run.length === 1
      ? `${first.book} ${first.chapter}`
      : `${first.book} ${first.chapter}–${last.chapter}`);
  };
  for (const c of chapters.slice(1)) {
    const prev = run[run.length - 1];
    if (c.book === prev.book && c.chapter === prev.chapter + 1) run.push(c);
    else { flush(); run = [c]; }
  }
  flush();
  return parts.join(', ');
}

/**
 * Everything a page needs about where the church is today.
 *
 * `missed` deliberately stops at fourteen days. A list of every day you have
 * ever missed is a reason to give up, not to start.
 */
export function planState(plan, startISO, today = new Date()) {
  const day = dayNumber(startISO, today);
  const total = plan.days.length;
  const at = (n) => plan.days.find((d) => d.day === n) ?? null;

  const missed = [];
  for (let n = Math.max(1, day - 14); n < day; n++) {
    const d = at(n);
    if (d) missed.push({ day: n, date: dateForDay(startISO, n), chapters: d.chapters });
  }

  const week = [];
  for (let n = day; n < day + 7 && n <= total; n++) {
    const d = at(n);
    if (d) week.push({ day: n, date: dateForDay(startISO, n), chapters: d.chapters });
  }

  return {
    day,
    total,
    notStarted: day < 1,
    finished: day > total,
    today: day >= 1 && day <= total ? at(day) : null,
    startsOn: dateForDay(startISO, 1),
    endsOn: dateForDay(startISO, total),
    missed,
    week,
  };
}
