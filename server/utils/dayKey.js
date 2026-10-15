// Sessions are per day, identified by a day key like "2026-10-12" in the server time zone

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pad = (n) => String(n).padStart(2, "0");

function dayKeyOf(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayKey() {
  return dayKeyOf(new Date());
}

// "2026-10-12" -> true; "2026-02-31" / "hello" -> false
function isValidDayKey(key) {
  if (typeof key !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

function dayBounds(key) {
  const [y, m, d] = key.split("-").map(Number);
  return {
    start: new Date(y, m - 1, d, 0, 0, 0, 0),
    end: new Date(y, m - 1, d, 23, 59, 59, 999),
  };
}

// Timestamp for a manually created record on a given day
function defaultMomentFor(key, department) {
  if (key === todayKey()) return new Date();
  const [y, m, d] = key.split("-").map(Number);
  const weekday = DAY_ABBR[new Date(y, m - 1, d).getDay()];
  const block = (department?.schedule || []).find((b) => b.day === weekday);
  const [hh, mm] = (block?.startTime || "09:00").split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
}

module.exports = { DAY_ABBR, dayKeyOf, todayKey, isValidDayKey, dayBounds, defaultMomentFor };
