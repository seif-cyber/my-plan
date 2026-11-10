/* gen-ics.js — يولّد ملفات الاشتراك في التقويم من schedule.js
   التشغيل:  node gen-ics.js
   لازم تشغّله وترفع khotty-lectures.ics و khotty-full.ics كل ما تغيّر الجدول،
   عشان اشتراك التقويم على الآيفون يتحدّث. */
const fs = require('fs'), vm = require('vm'), path = require('path');
const dir = __dirname;
const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(dir, 'schedule.js'), 'utf8'), ctx);
const PLAN = ctx.window.PLAN, CATS = ctx.window.CATS;

const REMIND = 10;                       // تنبيه قبل كل حدث بكام دقيقة
const UNTIL = '20270131T235959';         // آخر الترم
const pad = n => String(n).padStart(2, '0');
const mins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const fmt = t => { let [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'م' : 'ص'; h = h % 12 || 12; return `${pad(h)}:${pad(m)} ${ap}`; };
const esc = s => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
// RFC 5545: سطور ≤ 75 بايت، من غير ما نقطع حرف أو إيموجي في النص
function fold(line) {
  const out = []; let cur = '', bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch);
    if (bytes + b > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; }
    cur += ch; bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}
function nextDate(idx) {
  const t = new Date(); const d = new Date(t.getFullYear(), t.getMonth(), t.getDate());
  while (d.getDay() !== idx) d.setDate(d.getDate() + 1);
  return d;
}

function build(mode) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Khotty//AR//', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    `X-WR-CALNAME:${mode === 'all' ? 'خطتي' : 'خطتي — المحاضرات'}`, 'X-WR-TIMEZONE:Africa/Cairo', 'REFRESH-INTERVAL;VALUE=DURATION:PT6H', 'X-PUBLISHED-TTL:PT6H'];
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const BY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  const tm = t => t.replace(':', '') + '00';
  const ev = (uid, title, ds, s, e, idx, o = {}) => {
    L.push('BEGIN:VEVENT', `UID:${uid}@khotty`, `DTSTAMP:${stamp}`, `DTSTART:${ds}T${tm(s)}`, `DTEND:${ds}T${tm(e)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${BY[idx]};UNTIL=${UNTIL}`, `SUMMARY:${esc(title)}`);
    if (o.loc) L.push(`LOCATION:${esc(o.loc)}`);
    if (o.desc) L.push(`DESCRIPTION:${esc(o.desc)}`);
    for (const m of (o.alarms || [REMIND])) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${esc(title)}`, `TRIGGER:-PT${m}M`, 'END:VALARM');
    L.push('END:VEVENT');
  };
  PLAN.days.forEach((d, idx) => {
    const f = nextDate(idx), ds = `${f.getFullYear()}${pad(f.getMonth() + 1)}${pad(f.getDate())}`;
    d.lectures.forEach(l => ev(`${d.id}-lec-${l.s}`, `🏛️ ${l.t} (${l.k})`, ds, l.s, l.e, idx, { loc: l.room, desc: l.who }));
    if (mode === 'all') {
      d.routine.filter(it => it.c !== 'uni').forEach(it => ev(`${d.id}-${it.s}-${it.c}`, `${CATS[it.c].i} ${it.t}`, ds, it.s, it.e, idx, { alarms: [it.c === 'quran' ? 0 : REMIND] }));
      const b = mins(PLAN.sleep.bed) + 15, be = `${pad(Math.floor(b / 60) % 24)}:${pad(b % 60)}`;
      ev(`${d.id}-sleep`, `🌙 وقت النوم — صحيان ${fmt(PLAN.sleep.wake)}`, ds, PLAN.sleep.bed, be, idx, { alarms: [30, 0] });
    }
  });
  L.push('END:VCALENDAR');
  return L.map(fold).join('\r\n') + '\r\n';
}

fs.writeFileSync(path.join(dir, 'khotty-lectures.ics'), build('lectures'));
fs.writeFileSync(path.join(dir, 'khotty-full.ics'), build('all'));
console.log('OK — khotty-lectures.ics + khotty-full.ics');
