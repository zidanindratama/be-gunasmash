const ID_DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function parseHM(str: string) {
  const [h = '0', m = '0'] = str.split('.');
  const hh = Math.max(0, Math.min(23, parseInt(h, 10) || 0));
  const mm = Math.max(0, Math.min(59, parseInt(m, 10) || 0));
  return { hh, mm };
}

export function normalizeLocalDate(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function parseTimeRangeToDates(day: string, range: string, base: Date = new Date()) {
  const parts = range
    .replace(/–/g, '-')
    .split('-')
    .map((s) => s.trim());
  const startStr = parts[0] ?? '';
  const endStr = parts[1] ?? '';

  const { hh: sh, mm: sm } = parseHM(startStr);
  const { hh: eh, mm: em } = parseHM(endStr);

  const todayDow = base.getDay();
  const wantedDow = ID_DAYS.indexOf(day);
  const diff = wantedDow < 0 ? 0 : (wantedDow - todayDow + 7) % 7;

  const target = new Date(base.getFullYear(), base.getMonth(), base.getDate() + diff);

  const start = new Date(target.getFullYear(), target.getMonth(), target.getDate(), sh, sm, 0, 0);
  const end = new Date(target.getFullYear(), target.getMonth(), target.getDate(), eh, em, 0, 0);

  return { start, end, targetDate: normalizeLocalDate(target) };
}

export function isNowWithinAnnouncementWindow(day: string, range: string, now: Date = new Date()) {
  const { start, end } = parseTimeRangeToDates(day, range, now);
  return now >= start && now <= end;
}
