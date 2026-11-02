// Calendar of maintenance, events and shop offers read from the text of the Royal Quest news on Steam (Russian posts).
// The posts are free text, so this looks for the few ways the team writes dates:
//   «3 ноября с 08:00 МСК … время их завершения: 14:00 МСК», «22 октября, с 03:00 до 04:00 МСК»,
//   «« Набор … » с 30.10.2026 12:00 по 03.11.2026 08:00», «событие « … », которое продлится до 10 ноября 2026 года».
// Times are Moscow time (UTC+3) unless a post says UTC. Every entry keeps the id of its post, so the page links to it.
const MONTHS = ['январ', 'феврал', 'март', 'апрел', 'ма', 'июн', 'июл', 'август', 'сентябр', 'октябр', 'ноябр', 'декабр'];
const MON_RE = '(январ[ья]|феврал[ья]|марта?|апрел[ья]|ма[йя]|июн[ья]|июл[ья]|августа?|сентябр[ья]|октябр[ья]|ноябр[ья]|декабр[ья])';
const monthOf = (w) => { w = w.toLowerCase(); if (/^ма[йя]$/.test(w)) return 4; return MONTHS.findIndex((m, i) => i !== 4 && w.startsWith(m)); };

// one date (+ optional time): «20.10.2026 12:00», «20.10.26», «08.09 23:59», «3 ноября», «10 ноября 2026 года», «27 октября 08:00», «12 октября в 10:00»
const DT = `(?:(\\d{1,2})\\.(\\d{1,2})(?:\\.(\\d{2,4}))?|(\\d{1,2})\\s+${MON_RE}(?:\\s+(\\d{4})(?:\\s*г(?:ода|\\.)?)?)?)(?:\\s*,?\\s*(?:в|с)?\\s*(\\d{1,2}):(\\d{2}))?`;
const dtRe = () => new RegExp(DT, 'gi');

/** Post text → plain lines (paragraphs, list items and «—» bullets each on their own line). */
export function lines(bb) {
  return String(bb || '')
    .replace(/\[(?:p|\*|\/p|\/\*|br|list|\/list|olist|\/olist|h\d|\/h\d|tr|\/tr|hr)[^\]]*\]/gi, '\n')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\s+[—–]\s+(?=[А-ЯЁA-Z«"])/g, '\n— ')
    .split(/\n+/).map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

// a matched date → UTC seconds; the year comes from the post when it's missing (a month far before the post = next year)
function toTime(m, post, utc) {
  let d, mo, y;
  if (m[1]) { d = +m[1]; mo = +m[2] - 1; y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : null; }
  else { d = +m[4]; mo = monthOf(m[5]); y = m[6] ? +m[6] : null; }
  if (!(mo >= 0 && mo < 12 && d >= 1 && d <= 31)) return null;
  const p = new Date(post * 1000);
  if (y == null) { y = p.getUTCFullYear(); if (mo < p.getUTCMonth() - 6) y++; else if (mo > p.getUTCMonth() + 6) y--; }
  const hasTime = m[7] != null;
  const hh = hasTime ? +m[7] : 0, mm = hasTime ? +m[8] : 0;
  const off = utc ? 0 : 3;
  return { t: Math.floor(Date.UTC(y, mo, d, hh - off, mm) / 1000), hasTime };
}
const allDates = (s, post, utc) => [...s.matchAll(dtRe())].map((m) => ({ ...toTime(m, post, utc), i: m.index, len: m[0].length, raw: m[0] })).filter((x) => x.t);

const KIND = [
  ['obt', /(?:^|[^а-яё])ОБТ(?![а-яё])|тестов(ый|ого) сервер/i],
  ['sale', /скидк/i],
  ['shop', /шкатулк|набор|сундук|ларец|сургуч|премиум[- ]магазин|DLC/i],
  ['season', /сезонное приключение/i],
  ['event', /событи|ивент|благословени|вдохновени|праздник|(?:^|[^а-яё])бал(?![а-яё])|конкурс|ярмарк|мистери/i],
];
const kindOf = (s) => (KIND.find(([, re]) => re.test(s)) || ['event'])[0];
const nameIn = (s) => { const m = s.match(/«\s*([^»]{2,80}?)\s*»/); return m ? m[1].replace(/\s+/g, ' ') : null; };

/** One post → calendar entries { kind, name, start, end, approx, post } (seconds, UTC; start may be null = already running). */
export function postCalendar(item) {
  const post = item.at, title = item.ru?.t || '', L = lines(item.ru?.b);
  const out = [];
  const utcPost = /\(UTC\)|\bUTC\b/.test(item.ru?.b || '') && !/МСК/.test(item.ru?.b || '');
  // ---- maintenance: «3 ноября с 08:00 МСК … завершения: 14:00 МСК» / «22 октября, с 03:00 до 04:30 МСК»
  if (/профилактик|технически[ея] работ/i.test(title)) {
    const text = L.join(' \n ');
    const m = text.match(new RegExp(`(\\d{1,2})\\s*\\d?\\s+${MON_RE}[^\\n]{0,40}?с\\s+(\\d{1,2}):(\\d{2})(?:\\s+до\\s+(\\d{1,2}):(\\d{2}))?`, 'i'));
    if (m) {
      const day = toTime([null, null, null, null, m[1], m[2], null, m[3], m[4]], post, utcPost);
      let end = null;
      const endM = m[5] ? [m[5], m[6]] : (text.match(/заверш[а-я]*[^\d\n]{0,40}(\d{1,2}):(\d{2})/i) || []).slice(1);
      if (day && endM && endM[0] != null) {
        end = day.t + ((+endM[0] * 60 + +endM[1]) - (+m[3] * 60 + +m[4])) * 60;
        if (end <= day.t) end += 86400;
      }
      if (day) out.push({ kind: 'maint', name: /ночн/i.test(text) ? 'Ночные технические работы' : 'Профилактика', start: day.t, end, approx: /ориентир/i.test(text), post: item.id });
    }
  }
  // ---- events / offers: a line with «Name» and a period. A line with only the period («Событие продлится до …»)
  // takes the name from the line before it, or from the post title («Сроки проведения конкурса: с … по …»).
  const titleName = nameIn(title) || title.replace(/[^\p{L}\p{N}\s«»"'.,:!-]/gu, '').replace(/\s*:\s*гайд.*$/i, '').trim();
  let carry = null, carryStarts = false;
  for (const line of L) {
    let name = nameIn(line) || (/сезонное приключение/i.test(line) ? 'Сезонное приключение' : null);
    const hasDate = dtRe().test(line);
    let fromCarry = false;
    if (!name && hasDate && /продлится|сроки проведения|будет проходить|пройд[её]т с/i.test(line)) {
      if (carry) { name = carry; fromCarry = true; } else if (!/ПОРА ИГРАТЬ|профилактик|обновление/i.test(title)) name = titleName;
    }
    if (name && !hasDate) { carry = name; carryStarts = /старту|начал|начина|открыва/i.test(line) && !/продолжа/i.test(line); continue; }
    const startsHere = fromCarry && carryStarts;
    carry = null; carryStarts = false;
    if (!name) continue;
    if (kindOf(name + ' ' + line) === 'obt') name = 'ОБТ';
    if (/профилактик/i.test(name)) continue;
    const ds = allDates(line, post, utcPost);
    if (!ds.length) continue;
    // «с X по/до Y», «X - Y», «до Y»
    const after = line.slice(line.indexOf(name));
    const a = allDates(after, post, utcPost);
    const use = a.length ? a : ds;
    const txt = a.length ? after : line;
    let start = null, end = null;
    const untilIdx = txt.search(/(?:^|\s)(?:до|по)\s+\d|[-–]\s*\d/);
    for (const d of use) {
      const before = txt.slice(Math.max(0, d.i - 14), d.i);
      if (/(?:^|\s)(до|по)\s*$/i.test(before) || /[-–]\s*$/.test(before)) end = end ?? d;
      else if (/(?:^|\s)(?:с|со|стартует|начн[её]тся)\s*$/i.test(before) || (untilIdx > d.i && !start)) start = start ?? d;
      else if (!end) end = d;
    }
    if (!end && !start) continue;
    const e = end ? (end.hasTime ? end.t : end.t + 86399) : null; // a day without time: until its end
    const startsNow = startsHere || (/старту|стартова|стартан|начина|начал|будут действовать|запуск/i.test(line) && !/продолжа/i.test(line));
    const s = start ? start.t : (startsNow ? post : null);
    out.push({ kind: kindOf(name + ' ' + line), name, start: s, end: e, approx: /ориентир/i.test(line), post: item.id,
      sd: !!(start && !start.hasTime), ed: !!(end && !end.hasTime), // dates without a time are shown as days
      afterMaint: !!((start && !start.hasTime && /после (?:окончания )?профилактик|после технических работ/i.test(line)) || (!start && startsNow)) });
  }
  return out;
}

/** All posts → one calendar: the newest post wins for the same name (later posts move dates). */
export function calendar(items) {
  const map = new Map();
  for (const it of [...items].sort((a, b) => a.at - b.at)) {
    for (const e of postCalendar(it)) {
      const key = e.kind === 'maint' ? 'maint:' + (e.start || 0) : e.kind + ':' + e.name.toLowerCase().replace(/ё/g, 'е');
      const old = map.get(key);
      // a later post that only says "продолжается … до X" keeps the start of the earlier one
      // with its own start it's a new run (the next season, the same box again); without one it continues the old run
      map.set(key, old && e.start == null ? { ...e, start: old.start, sd: old.sd, afterMaint: old.afterMaint, end: e.end ?? old.end } : e);
    }
  }
  const all = [...map.values()];
  // «с 20 октября, после окончания профилактики»: starts when that day's maintenance ends
  for (const e of all) {
    if (!e.afterMaint) continue;
    const m = all.find((x) => x.kind === 'maint' && x.end && x.start <= e.start + 86400 && e.start - x.start < 86400 * 1.2);
    if (m) { e.start = m.end; e.sd = false; }
  }
  for (const e of all) delete e.afterMaint;
  return all.filter((e) => e.end || e.start).sort((a, b) => (a.start ?? a.end) - (b.start ?? b.end));
}
