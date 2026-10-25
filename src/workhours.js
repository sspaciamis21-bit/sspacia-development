'use strict';
/**
 * Working-hours calendar used by every FMS (planned times are promised in working hours:
 * Mon–Sat 10:00–19:00 by default, Sundays and listed holidays excluded — the same
 * convention as the team's Sales FMS sheet: 1 day = 9 h, 2 days = 18 h, 7 days = 63 h …).
 */

const DEFAULT = {
  startMin: 10 * 60,            // 10:00
  endMin: 19 * 60,              // 19:00
  workingDays: [1, 2, 3, 4, 5, 6], // Mon..Sat (JS getDay: 0 = Sunday)
  holidays: [],                 // ['2026-11-01', ...]
};

function cfgOf(cfg) {
  return Object.assign({}, DEFAULT, cfg || {});
}
function pad(n) { return String(n).padStart(2, '0'); }
function ymd(d) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function minsOfDay(d) { return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; }
function atMinutes(d, mins) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
  x.setMinutes(Math.floor(mins), Math.round((mins % 1) * 60));
  return x;
}
function nextDay(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0); }

function isWorkingDay(d, cfg) {
  const c = cfgOf(cfg);
  if (!c.workingDays.includes(d.getDay())) return false;
  if (c.holidays && c.holidays.includes(ymd(d))) return false;
  return true;
}

/** Move a timestamp forward to the next moment inside working hours (no-op if already inside). */
function alignForward(d, cfg) {
  const c = cfgOf(cfg);
  let x = new Date(d);
  for (let guard = 0; guard < 400; guard++) {
    if (isWorkingDay(x, c)) {
      const m = minsOfDay(x);
      if (m < c.startMin) return atMinutes(x, c.startMin);
      if (m < c.endMin) return x;
    }
    x = atMinutes(nextDay(x), c.startMin);
  }
  return x;
}

/** start + N working hours (fractional hours allowed). */
function addWorkingHours(start, hours, cfg) {
  const c = cfgOf(cfg);
  let remaining = hours * 60; // minutes
  let x = alignForward(start, c);
  for (let guard = 0; guard < 2000 && remaining > 1e-6; guard++) {
    const m = minsOfDay(x);
    const avail = c.endMin - m;
    if (remaining <= avail) {
      return atMinutes(x, m + remaining);
    }
    remaining -= avail;
    x = alignForward(atMinutes(nextDay(x), c.startMin), c);
  }
  return x;
}

/** Working hours elapsed from a to b (negative when b is before a). */
function workingHoursBetween(a, b, cfg) {
  if (b < a) return -workingHoursBetween(b, a, cfg);
  const c = cfgOf(cfg);
  let total = 0;
  let x = new Date(a);
  for (let guard = 0; guard < 5000; guard++) {
    if (x >= b) break;
    if (isWorkingDay(x, c)) {
      const dayStart = atMinutes(x, c.startMin);
      const dayEnd = atMinutes(x, c.endMin);
      const from = x > dayStart ? x : dayStart;
      const to = b < dayEnd ? b : dayEnd;
      if (to > from) total += (to - from) / 60000;
    }
    x = nextDay(x);
  }
  return total / 60;
}

/** start + N working days, keeping the time of day (used for day-based cadences like D1/D3/D7). */
function addWorkingDays(start, days, cfg) {
  const c = cfgOf(cfg);
  let x = new Date(start);
  let n = 0;
  for (let guard = 0; guard < 1000 && n < days; guard++) {
    x = new Date(x.getFullYear(), x.getMonth(), x.getDate() + 1, x.getHours(), x.getMinutes(), 0);
    if (isWorkingDay(x, c)) n++;
  }
  return alignForward(x, c);
}

function addCalendarDays(start, days) {
  const x = new Date(start);
  x.setDate(x.getDate() + days);
  return x;
}

module.exports = { DEFAULT, isWorkingDay, alignForward, addWorkingHours, workingHoursBetween, addWorkingDays, addCalendarDays };
