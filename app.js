/* ============================================================
   app.js — خطتي (PWA)
   كل البيانات بتتحفظ على جهازك (localStorage) — مفيش سيرفر.
   ============================================================ */
(() => {
'use strict';

const PLAN = window.PLAN, CATS = window.CATS, RULES = window.RULES || [];
const LS_KEY = 'saif-plan-v1';
const VERSION = '1.0.0';
const PASS = 0.7;                       // اليوم "ناجح" لو الإنجاز >= 70%

/* ---------- helpers ---------- */
const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const pad = n => String(n).padStart(2, '0');
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parseKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const todayKey = () => dkey(new Date());
const mins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
const fmt = t => { let [h, m] = t.split(':').map(Number); const ap = h >= 12 ? 'م' : 'ص'; h = h % 12 || 12; return `${pad(h)}:${pad(m)} ${ap}`; };
const dur = m => { m = Math.round(m); const h = Math.floor(m / 60), r = m % 60; return h && r ? `${h} س ${r} د` : h ? `${h} س` : `${r} د`; };
const hrs = m => (m / 60).toFixed(1).replace(/\.0$/, '');
const pct = x => Math.round(x * 100);
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const weekStart = d => addDays(d, -d.getDay());                 // الأسبوع بيبدأ الأحد
const itemKey = it => `${it.s}|${it.c}`;
const dayPlan = date => PLAN.days[date.getDay()];

function longDate(d) {
  try { return new Intl.DateTimeFormat('ar-EG-u-nu-latn', { weekday: 'long', day: 'numeric', month: 'long' }).format(d); }
  catch (e) { return dkey(d); }
}
function shortDM(d) {
  try { return new Intl.DateTimeFormat('ar-EG-u-nu-latn', { day: 'numeric', month: 'short' }).format(d); }
  catch (e) { return `${d.getDate()}/${d.getMonth() + 1}`; }
}

/* ---------- state ---------- */
function defaults() {
  return { v: 1, start: todayKey(), done: {}, sleep: {}, settings: { theme: 'auto', remind: 10 } };
}
let S = (() => {
  let s = defaults();
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) { const p = JSON.parse(raw); s = Object.assign(s, p); }
  } catch (e) { /* ignore */ }
  s.settings = Object.assign({ theme: 'auto', remind: 10 }, s.settings || {});
  s.done = s.done || {}; s.sleep = s.sleep || {};
  return s;
})();
function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify(S)); return true; }
  catch (e) { toast('⚠️ تعذّر الحفظ على الجهاز'); return false; }
}
save();

const ui = { tab: 'today', day: todayKey(), range: 7, sleepDate: todayKey(), q: 4, lastToday: todayKey() };

/* ---------- toast ---------- */
let toastT;
function toast(msg, btn) {
  const el = $('#toast'), b = $('#toastBtn');
  $('#toastMsg').textContent = msg;
  if (btn) { b.hidden = false; b.textContent = btn.label; b.onclick = () => { btn.fn(); el.classList.remove('show'); }; }
  else { b.hidden = true; b.onclick = null; }
  el.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => el.classList.remove('show'), btn ? 9000 : 2400);
}

/* ---------- core calculations ---------- */
function dayStats(date) {
  const dp = dayPlan(date), dn = S.done[dkey(date)] || {};
  let done = 0, planMin = 0, doneMin = 0;
  for (const it of dp.routine) {
    const m = mins(it.e) - mins(it.s);
    planMin += m;
    if (dn[itemKey(it)]) { done++; doneMin += m; }
  }
  const total = dp.routine.length;
  return { total, done, p: total ? done / total : 0, planMin, doneMin };
}
const isCounted = k => k >= S.start && k <= todayKey();

function streaks() {
  const t = new Date(); let cur = 0, best = 0, run = 0;
  // best: scan from start to today
  for (let d = parseKey(S.start); dkey(d) <= todayKey(); d = addDays(d, 1)) {
    if (dayStats(d).p >= PASS) { run++; best = Math.max(best, run); } else run = 0;
  }
  // current: backwards from today (today may still be in progress)
  for (let i = 0, d = t; ; i++, d = addDays(t, -i)) {
    const k = dkey(d); if (k < S.start) break;
    if (dayStats(d).p >= PASS) cur++;
    else if (i === 0) continue;
    else break;
  }
  return { cur, best };
}

function rangeDays(n) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(new Date(), -i));
  return out;
}

/* ---------- SVG helpers ---------- */
function ring(p) {
  const r = 34, c = 2 * Math.PI * r;
  return `<svg class="ring" viewBox="0 0 80 80" role="img" aria-label="${pct(p)}%">
    <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#4f46e5"/><stop offset="1" stop-color="#10b981"/></linearGradient></defs>
    <circle cx="40" cy="40" r="${r}" class="rt"/>
    <circle cx="40" cy="40" r="${r}" class="rf" stroke-dasharray="${c.toFixed(2)}" stroke-dashoffset="${(c * (1 - p)).toFixed(2)}" transform="rotate(-90 40 40)"/>
    <text x="40" y="45" text-anchor="middle" class="rtx">${pct(p)}%</text></svg>`;
}

/* vals: 0..1 | null  —  الأقدم على اليمين (RTL) */
function barChart(vals, o) {
  const n = vals.length, W = 320, H = o.h || 150, pt = o.vl ? 16 : 8, pb = o.labels ? 22 : 8, ph = H - pt - pb;
  const gap = n > 14 ? 2 : 8, bw = (W - gap * (n + 1)) / n;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="${esc(o.aria || 'رسم بياني')}">`;
  if (o.line != null) { const y = pt + ph * (1 - o.line); s += `<line x1="0" x2="${W}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" class="gl"/>`; }
  vals.forEach((v, i) => {
    const x = W - (i + 1) * bw - (i + 1) * gap;
    const full = ph, vv = v == null ? 0 : Math.min(1, Math.max(0, v));
    const bh = Math.max(v == null ? 0 : 3, full * vv);
    const col = v == null ? 'transparent' : (o.color ? o.color(vv) : '#4f46e5');
    s += `<rect x="${x.toFixed(1)}" y="${pt}" width="${bw.toFixed(1)}" height="${full}" rx="${Math.min(6, bw / 2).toFixed(1)}" class="bg" opacity=".45"/>`;
    if (v != null) s += `<rect x="${x.toFixed(1)}" y="${(pt + full - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="${Math.min(6, bw / 2).toFixed(1)}" fill="${col}"/>`;
    if (o.vl && o.vl[i] != null) s += `<text x="${(x + bw / 2).toFixed(1)}" y="${(pt + full - bh - 4).toFixed(1)}" class="v">${esc(o.vl[i])}</text>`;
    if (o.labels && o.labels[i]) s += `<text x="${(x + bw / 2).toFixed(1)}" y="${H - 6}">${esc(o.labels[i])}</text>`;
  });
  return s + '</svg>';
}

/* ============================================================
   TODAY
   ============================================================ */
function currentBlock(dp) {
  const m = nowMin();
  const cur = dp.routine.find(it => mins(it.s) <= m && m < mins(it.e));
  const next = dp.routine.find(it => mins(it.s) > m);
  return { cur, next, m };
}

function renderToday() {
  const k = ui.day, date = parseKey(k), dp = dayPlan(date), tk = todayKey();
  const isToday = k === tk, future = k > tk;
  const dn = S.done[k] || {}, st = dayStats(date), sk = streaks();
  const ws = weekStart(new Date());

  /* day strip */
  let strip = '';
  for (let i = 0; i < 7; i++) {
    const d = addDays(ws, i), dk = dkey(d), s = dayStats(d);
    const dot = dk > tk ? '' : s.p >= PASS ? 'g' : s.done ? 'p' : '';
    strip += `<button class="dchip ${dk === k ? 'on' : ''} ${dk === tk ? 'today' : ''}" data-act="day" data-day="${dk}" aria-label="${PLAN.days[i].name}">
      <b>${PLAN.days[i].name}</b><span>${d.getDate()}</span><i class="${dot}"></i></button>`;
  }

  /* now card */
  let nowHtml = '';
  if (isToday) {
    const { cur, next, m } = currentBlock(dp);
    const bed = mins(PLAN.sleep.bed), first = dp.routine[0];
    if (cur) {
      const c = CATS[cur.c], total = mins(cur.e) - mins(cur.s), left = mins(cur.e) - m;
      nowHtml = `<div class="card now"><div class="lbl">دلوقتي</div>
        <div class="big">${c.i} <bdi>${esc(cur.t)}</bdi></div>
        <div class="sub">${fmt(cur.s)} – ${fmt(cur.e)} · باقي ${dur(left)}${next ? ` · بعده: ${esc(next.t)}` : ''}</div>
        <div class="bar"><i style="width:${Math.min(100, pct((total - left) / total))}%"></i></div></div>`;
    } else if (m >= bed || m < mins(PLAN.sleep.wake)) {
      nowHtml = `<div class="card now sleepy"><div class="lbl">وقت النوم</div><div class="big">🌙 نام يا بطل</div>
        <div class="sub">الصحيان ${fmt(PLAN.sleep.wake)} — النوم هو اللي بيشغّل بكرة.</div></div>`;
    } else if (next) {
      nowHtml = `<div class="card now"><div class="lbl">الجاي</div><div class="big">${CATS[next.c].i} ${esc(next.t)}</div>
        <div class="sub">الساعة ${fmt(next.s)} · بعد ${dur(mins(next.s) - m)}</div></div>`;
    }
    if (m >= bed - 60 && m < bed && cur) nowHtml += `<div class="card" style="text-align:center">🌙 فاضل أقل من ساعة على النوم — قلّل الشاشة.</div>`;
  } else if (future) {
    nowHtml = `<div class="card" style="text-align:center">⏳ اليوم ده لسه مجاش — دي معاينة للجدول.</div>`;
  }

  /* lectures */
  let lect = '';
  if (dp.lectures.length) {
    const m = nowMin();
    lect = `<div class="card"><h2>🏛️ جدول الجامعة <small>${dp.lectures.length} محاضرات</small></h2>` +
      dp.lectures.map(l => {
        const live = isToday && mins(l.s) <= m && m < mins(l.e);
        const bcls = l.k === 'سكشن' ? 'sec2' : l.k === 'إعادة' ? 're' : '';
        return `<div class="lect ${live ? 'now' : ''}">
          <div class="tm">${fmt(l.s)}<small>${fmt(l.e)}</small></div>
          <div><h3>${esc(l.t)}<span class="badge ${bcls}">${esc(l.k)}</span></h3>
          <p>👤 ${esc(l.who)} · 📍 ${esc(l.room)}</p></div></div>`;
      }).join('') + '</div>';
  } else {
    lect = `<div class="card offcard"><div class="big">${dp.id === 'fri' ? '🕌' : dp.id === 'sat' ? '🔥' : '😎'}</div>
      <b>${esc(dp.tag)}</b><p>${esc(dp.offMsg || 'مفيش محاضرات النهارده.')}</p></div>`;
  }

  /* routine */
  const m = nowMin();
  const tasks = dp.routine.map(it => {
    const c = CATS[it.c], key = itemKey(it), done = !!dn[key];
    const live = isToday && mins(it.s) <= m && m < mins(it.e);
    return `<li class="task ${done ? 'done' : ''} ${live ? 'now' : ''}" data-act="toggle" data-key="${esc(key)}" role="checkbox" aria-checked="${done}">
      <span class="chk">✓</span><span class="ico" style="--h:${c.h}">${c.i}</span>
      <div class="tx"><b><bdi>${esc(it.t)}</bdi></b><small>${fmt(it.s)} – ${fmt(it.e)} · ${dur(mins(it.e) - mins(it.s))}</small></div>
      ${live ? '<span class="live">دلوقتي</span>' : ''}</li>`;
  }).join('');
  const sleepH = ((24 * 60 - mins(PLAN.sleep.bed) + mins(PLAN.sleep.wake)) / 60);

  $('#v-today').innerHTML = `
    <div class="strip" id="strip">${strip}</div>
    <div class="card"><div class="prog">${ring(st.p)}
      <div class="meta"><b>${esc(dp.name)} — ${esc(dp.tag)}</b>
        <small>${st.done} من ${st.total} مهام · ${hrs(st.doneMin)} من ${hrs(st.planMin)} ساعة</small>
        <div class="chips"><span class="chip">🔥 سلسلة ${sk.cur}</span><span class="chip">🏆 أفضل ${sk.best}</span>
        ${st.p >= PASS ? '<span class="chip" style="color:var(--ok)">✅ يوم ناجح</span>' : `<span class="chip">🎯 الهدف ${pct(PASS)}%</span>`}</div></div></div></div>
    ${nowHtml}${lect}
    <div class="card"><h2>✅ روتين اليوم <small>اضغط على المهمة لتحديدها</small></h2>
      <ul class="tasks">${tasks}</ul>
      <div class="sleeprow"><span class="ico">🌙</span><div><b>نوم ثابت — ${fmt(PLAN.sleep.bed)}</b>
        <small>صحيان ${fmt(PLAN.sleep.wake)} · ${sleepH} ساعة نوم</small></div></div></div>`;

  $('#hello').textContent = `${new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير'} يا ${PLAN.owner} 👋`;
  $('#subdate').textContent = `${longDate(date)} · ${PLAN.term}`;
  $('#streakPill').textContent = `🔥 ${sk.cur}`;
  const on = $('#strip .on'); if (on && !renderToday.scrolled) { on.scrollIntoView({ inline: 'center', block: 'nearest' }); renderToday.scrolled = true; }
}

function toggle(key) {
  const k = ui.day;
  if (k > todayKey()) return toast('⏳ اليوم ده لسه مجاش');
  S.done[k] = S.done[k] || {};
  if (S.done[k][key]) delete S.done[k][key]; else S.done[k][key] = 1;
  if (!Object.keys(S.done[k]).length) delete S.done[k];
  save();
  const was = navigator.vibrate ? navigator.vibrate(8) : 0;
  renderToday();
  if (dayStats(parseKey(k)).p === 1) toast('🎉 خلّصت كل مهام اليوم! ما شاء الله');
}

/* ============================================================
   STATS
   ============================================================ */
function renderStats() {
  const n = ui.range, days = rangeDays(n), tk = todayKey();
  const counted = days.filter(d => isCounted(dkey(d)));
  const stats = days.map(d => isCounted(dkey(d)) ? dayStats(d) : null);
  const avg = counted.length ? counted.reduce((a, d) => a + dayStats(d).p, 0) / counted.length : 0;
  const tasks = counted.reduce((a, d) => a + dayStats(d).done, 0);
  const doneMin = counted.reduce((a, d) => a + dayStats(d).doneMin, 0);
  const good = counted.filter(d => dayStats(d).p >= PASS).length;
  const sk = streaks();

  /* chart */
  const labels = n <= 7 ? days.map(d => PLAN.days[d.getDay()].name.replace('ال', '')) : days.map((d, i) => (i % 5 === 0 || i === n - 1) ? d.getDate() : '');
  const vl = n <= 7 ? stats.map(s => s ? pct(s.p) + '%' : null) : null;
  const chart = barChart(stats.map(s => s ? s.p : null), {
    line: PASS, labels, vl, aria: 'نسبة الإنجاز اليومي',
    color: v => v >= PASS ? '#10b981' : v >= 0.4 ? '#f59e0b' : '#ef4444'
  });

  /* heatmap: 12 أسبوع */
  const hs = addDays(weekStart(new Date()), -11 * 7);
  let heat = '';
  for (let i = 0; i < 84; i++) {
    const d = addDays(hs, i), k = dkey(d);
    if (k > tk) { heat += '<i class="x"></i>'; continue; }
    if (k < S.start) { heat += '<i class="pre"></i>'; continue; }
    const p = dayStats(d).p, l = p === 0 ? '' : p < .4 ? 'l1' : p < PASS ? 'l2' : p < 1 ? 'l3' : 'l4';
    heat += `<i class="${l}" title="${k} · ${pct(p)}%"></i>`;
  }

  /* categories */
  const agg = {};
  for (const d of counted) {
    const dp = dayPlan(d), dn = S.done[dkey(d)] || {};
    for (const it of dp.routine) {
      const m = mins(it.e) - mins(it.s), a = agg[it.c] = agg[it.c] || { plan: 0, done: 0 };
      a.plan += m; if (dn[itemKey(it)]) a.done += m;
    }
  }
  const cats = Object.entries(agg).sort((a, b) => b[1].plan - a[1].plan);
  const catHtml = cats.length ? cats.map(([c, a]) => {
    const r = a.plan ? a.done / a.plan : 0, ci = CATS[c];
    return `<div class="crow"><span class="ico" style="--h:${ci.h}">${ci.i}</span>
      <div class="mid"><div class="t">${esc(ci.n)}<span>${hrs(a.done)} / ${hrs(a.plan)} س · ${pct(r)}%</span></div>
      <div class="track" style="--h:${ci.h}"><i style="width:${pct(r)}%"></i></div></div></div>`;
  }).join('') : '<p class="muted">لسه مفيش بيانات — ابدأ علّم مهامك وهتظهر هنا.</p>';

  /* insights */
  const ins = [];
  const all = []; for (let d = parseKey(S.start); dkey(d) <= tk; d = addDays(d, 1)) all.push(d);
  if (all.length >= 3) {
    const wd = Array.from({ length: 7 }, () => ({ s: 0, c: 0 }));
    all.forEach(d => { const w = wd[d.getDay()]; w.s += dayStats(d).p; w.c++; });
    const ranked = wd.map((w, i) => ({ i, a: w.c ? w.s / w.c : null })).filter(x => x.a != null).sort((a, b) => b.a - a.a);
    if (ranked.length >= 2) {
      ins.push(['📈', `أفضل يوم عندك: <b>${PLAN.days[ranked[0].i].name}</b> (${pct(ranked[0].a)}%)`]);
      const w = ranked[ranked.length - 1];
      if (w.a < ranked[0].a) ins.push(['🧭', `أضعف يوم: <b>${PLAN.days[w.i].name}</b> (${pct(w.a)}%) — جرّب تخفف حمله.`]);
    }
  }
  const rated = cats.filter(([, a]) => a.plan >= 60).map(([c, a]) => [c, a.done / a.plan]).sort((a, b) => b[1] - a[1]);
  if (rated.length >= 2 && counted.length >= 2) {
    ins.push(['💪', `أكتر حاجة ملتزم بيها: <b>${esc(CATS[rated[0][0]].n)}</b> (${pct(rated[0][1])}%)`]);
    const w = rated[rated.length - 1];
    if (w[1] < .7) ins.push(['🎯', `محتاج انتباه: <b>${esc(CATS[w[0]].n)}</b> (${pct(w[1])}%)`]);
  }
  const sl = sleepStats();
  if (sl.n >= 3) ins.push(['😴', `متوسط نومك <b>${sl.avg.toFixed(1)} س</b> ${sl.avg >= PLAN.sleep.target - .25 ? '— ممتاز ✅' : `— أقل من هدفك (${PLAN.sleep.target} س)`}`]);
  if (!ins.length) ins.push(['🌱', 'كمّل علّم مهامك كام يوم وهتظهرلك ملاحظات مخصصة هنا.']);

  $('#v-stats').innerHTML = `
    <div class="card"><div class="seg">
      <button data-act="range" data-n="7" class="${n === 7 ? 'on' : ''}">آخر 7 أيام</button>
      <button data-act="range" data-n="30" class="${n === 30 ? 'on' : ''}">آخر 30 يوم</button>
    </div></div>
    <div class="kpis">
      <div class="kpi"><small>متوسط الإنجاز</small><b>${pct(avg)}%</b><em>${counted.length} يوم محسوب</em></div>
      <div class="kpi"><small>أيام ناجحة</small><b>${good}</b><em>من ${counted.length} · الهدف ${pct(PASS)}% فأكتر</em></div>
      <div class="kpi"><small>🔥 السلسلة الحالية</small><b>${sk.cur}</b><em>أفضل سلسلة: ${sk.best}</em></div>
      <div class="kpi"><small>ساعات منجزة</small><b>${hrs(doneMin)}</b><em>${tasks} مهمة</em></div>
    </div>
    <div class="card"><h2>📊 الإنجاز اليومي <small>الخط = ${pct(PASS)}%</small></h2>${chart}</div>
    <div class="card"><h2>🗓️ آخر 12 أسبوع</h2><div class="heat">${heat}</div>
      <div class="legend">أقل <i style="background:var(--line)"></i><i style="background:#c7d2fe"></i><i style="background:#818cf8"></i><i style="background:#4f46e5"></i><i style="background:#10b981"></i> أكتر</div></div>
    <div class="card"><h2>⏱️ الوقت حسب النشاط <small>منجز / مخطط</small></h2>${catHtml}</div>
    <div class="card"><h2>💡 ملاحظات</h2>${ins.map(([e, t]) => `<div class="ins"><span>${e}</span><span>${t}</span></div>`).join('')}</div>`;
}

/* ============================================================
   SLEEP
   ============================================================ */
function sleepHours(bed, wake) {
  let d = mins(wake) - mins(bed); if (d <= 0) d += 1440; return d / 60;
}
function sleepStats() {
  const keys = Object.keys(S.sleep).sort().slice(-7);
  const rows = keys.map(k => ({ k, ...S.sleep[k], h: sleepHours(S.sleep[k].bed, S.sleep[k].wake) }));
  const n = rows.length, tg = PLAN.sleep.target;
  const avg = n ? rows.reduce((a, r) => a + r.h, 0) / n : 0;
  const goodN = rows.filter(r => r.h >= tg - .25).length;
  const debt = rows.reduce((a, r) => a + Math.max(0, tg - r.h), 0);
  let sd = 0;
  if (n >= 2) {
    const b = rows.map(r => { let m = mins(r.bed); if (m < 720) m += 1440; return m; });
    const mean = b.reduce((a, x) => a + x, 0) / n;
    sd = Math.sqrt(b.reduce((a, x) => a + (x - mean) ** 2, 0) / n);
  }
  return { rows, n, avg, goodN, debt, sd };
}

function renderSleep() {
  const k = ui.sleepDate, ex = S.sleep[k];
  const bed = ex ? ex.bed : PLAN.sleep.bed, wake = ex ? ex.wake : PLAN.sleep.wake;
  if (ex && ex.q) ui.q = ex.q;
  const st = sleepStats(), tg = PLAN.sleep.target;
  const last14 = Object.keys(S.sleep).sort().slice(-14);
  const chart = last14.length ? barChart(last14.map(d => Math.min(1, sleepHours(S.sleep[d].bed, S.sleep[d].wake) / 10)), {
    line: tg / 10, h: 140, aria: 'ساعات النوم',
    labels: last14.map(d => parseKey(d).getDate()),
    vl: last14.length <= 8 ? last14.map(d => sleepHours(S.sleep[d].bed, S.sleep[d].wake).toFixed(1)) : null,
    color: v => v * 10 >= tg - .25 ? '#6366f1' : v * 10 >= 6 ? '#f59e0b' : '#ef4444'
  }) : '<p class="muted">سجّل أول ليلة عشان يظهر الرسم.</p>';
  const emojis = ['😫', '😕', '😐', '🙂', '😄'];
  const hist = Object.keys(S.sleep).sort().reverse().slice(0, 7).map(d => {
    const r = S.sleep[d], h = sleepHours(r.bed, r.wake);
    return `<div class="row2"><div><b>${shortDM(parseKey(d))}</b> <small>${fmt(r.bed)} → ${fmt(r.wake)}</small></div>
      <div>${r.q ? emojis[r.q - 1] : ''} <b>${h.toFixed(1)} س</b> <button class="x" data-act="delSleep" data-k="${d}" aria-label="حذف">✕</button></div></div>`;
  }).join('') || '<p class="muted">لسه مفيش تسجيلات.</p>';
  const tip = st.n < 2 ? 'سجّل كام ليلة عشان نحسب متوسطك وانتظامك.' :
    st.avg >= tg - .25 ? 'ممتاز! نومك قريب من هدفك — حافظ على المواعيد الثابتة.' :
    st.debt > 4 ? `عليك دين نوم ${st.debt.toFixed(1)} ساعة آخر ${st.n} ليالي — حاول تنام بدري الليلة.` :
    'قرّب من هدفك: ثبّت ميعاد النوم وقلّل الشاشة قبلها بساعة.';

  $('#v-sleep').innerHTML = `
    <div class="card"><h2>😴 تسجيل النوم</h2>
      <label class="muted" style="font-size:12px;font-weight:700">الليلة اللي صحيت بعدها (تاريخ الصحيان)</label>
      <input type="date" id="sd" value="${k}" max="${todayKey()}" data-act="sleepDate">
      <div class="field"><div><label>نمت الساعة</label><input type="time" id="sb" value="${bed}"></div>
        <div><label>صحيت الساعة</label><input type="time" id="sw" value="${wake}"></div></div>
      <div class="hrs" id="sh">${sleepHours(bed, wake).toFixed(1)} <small>ساعة نوم</small></div>
      <label class="muted" style="font-size:12px;font-weight:700">جودة النوم</label>
      <div class="q">${emojis.map((e, i) => `<button data-act="q" data-q="${i + 1}" class="${ui.q === i + 1 ? 'on' : ''}" aria-label="${i + 1}">${e}</button>`).join('')}</div>
      <button class="btn" data-act="saveSleep">${ex ? 'تحديث التسجيل' : 'حفظ'}</button></div>
    <div class="kpis">
      <div class="kpi"><small>متوسط آخر ${st.n || 7} ليالي</small><b>${st.n ? st.avg.toFixed(1) : '—'}</b><em>الهدف ${tg} س</em></div>
      <div class="kpi"><small>ليالي حققت الهدف</small><b>${st.goodN}<span style="font-size:15px">/${st.n}</span></b><em>على الأقل ${(tg - .25).toFixed(2).replace(/0$/, '')} س</em></div>
      <div class="kpi"><small>انتظام النوم</small><b>${st.n >= 2 ? '±' + Math.round(st.sd) : '—'}</b><em>دقيقة (أقل = أحسن)</em></div>
      <div class="kpi"><small>دين النوم</small><b>${st.n ? st.debt.toFixed(1) : '—'}</b><em>ساعة</em></div>
    </div>
    <div class="card"><h2>🌙 آخر ليالي <small>الخط = الهدف</small></h2>${chart}<p class="muted" style="margin:8px 0 0">${tip}</p></div>
    <div class="card"><h2>🗒️ السجل</h2>${hist}</div>
    <div class="card"><h2>🛌 خطة النوم</h2>
      <p style="margin:0">نوم <b>${fmt(PLAN.sleep.bed)}</b> ← صحيان <b>${fmt(PLAN.sleep.wake)}</b> = <b>${tg} ساعة</b>. حافظ على الميعاد حتى في الإجازة، وابعد عن الشاشة آخر 30 دقيقة.</p></div>`;
}
function updateSleepHours() {
  const b = $('#sb'), w = $('#sw'), h = $('#sh');
  if (b && w && h && b.value && w.value) h.innerHTML = `${sleepHours(b.value, w.value).toFixed(1)} <small>ساعة نوم</small>`;
}

/* ============================================================
   MORE
   ============================================================ */
let deferredInstall = null;
const isStandalone = () => window.navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

function renderMore() {
  const th = S.settings.theme, rm = S.settings.remind;
  const install = isStandalone() ? `<div class="card"><h2>📲 التطبيق</h2><p class="ok" style="margin:0">✅ شغّال كتطبيق على الشاشة الرئيسية</p></div>` :
    `<div class="card"><h2>📲 ثبّته على الآيفون</h2>
      <ol class="steps"><li>افتح الرابط في <b>Safari</b></li><li>اضغط زر المشاركة <b>⬆️</b></li><li>اختار <b>«إضافة إلى الشاشة الرئيسية»</b></li><li>اضغط <b>إضافة</b> — وهيشتغل زي أي تطبيق وحتى بدون إنترنت</li></ol>
      ${deferredInstall ? '<button class="btn" data-act="install" style="margin-top:10px">تثبيت التطبيق</button>' : ''}</div>`;
  $('#v-more').innerHTML = `
    ${install}
    <div class="card"><h2>🔔 تنبيهات الآيفون <small>عن طريق التقويم</small></h2>
      <p class="muted" style="margin:0 0 10px">آيفون مبيدعمش تنبيهات من PWA بدون سيرفر، فأحسن حل: ضيف الجدول لتقويم الآيفون بتنبيه قبل كل مهمة، ويتكرر أسبوعياً لحد 31 يناير 2027.</p>
      <label class="muted" style="font-size:12px;font-weight:700">نبّهني قبل بـ</label>
      <select id="remind" data-act="remind">${[0, 5, 10, 15, 30].map(v => `<option value="${v}" ${v === rm ? 'selected' : ''}>${v ? v + ' دقيقة' : 'في الميعاد'}</option>`).join('')}</select>
      <div class="btns" style="margin-top:10px"><button class="btn" data-act="ics" data-mode="lect">📅 المحاضرات فقط</button><button class="btn sec" data-act="ics" data-mode="all">🗓️ الجدول كله</button></div></div>
    <div class="card"><h2>🎨 المظهر</h2><div class="seg">
      ${[['auto', 'تلقائي'], ['light', 'فاتح'], ['dark', 'داكن']].map(([v, l]) => `<button data-act="theme" data-v="${v}" class="${th === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
    <div class="card"><h2>💾 نسخة احتياطية</h2>
      <p class="muted" style="margin:0 0 10px">بياناتك محفوظة على جهازك فقط. خد نسخة بشكل دوري (مثلاً كل أسبوع) أو قبل ما تغيّر الموبايل.</p>
      <div class="btns"><button class="btn" data-act="export">⬇️ تصدير</button><button class="btn sec" data-act="import">⬆️ استيراد</button></div>
      <button class="btn bad" data-act="reset" style="margin-top:8px">🗑️ مسح كل البيانات</button></div>
    <div class="sec">قواعد ذهبية</div>
    <div class="card">${RULES.map(([e, t, d]) => `<div class="rule"><span class="e">${e}</span><div><b>${esc(t)}</b><p>${esc(d)}</p></div></div>`).join('')}</div>
    <p class="muted" style="text-align:center;font-size:12px">خطتي v${VERSION} · بدأت التتبع ${shortDM(parseKey(S.start))}<br>${navigator.storage && navigator.storage.persisted ? '' : ''}<span id="persist"></span></p>`;
  if (navigator.storage && navigator.storage.persisted) navigator.storage.persisted().then(p => { const el = $('#persist'); if (el) el.textContent = p ? '🔒 التخزين محمي من الحذف التلقائي' : ''; });
}

/* ---------- ICS (تقويم) ---------- */
function icsEscape(s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); }
function fold(line) { let out = '', i = 0; while (line.length - i > 60) { out += line.slice(i, i + 60) + '\r\n '; i += 60; } return out + line.slice(i); }
function nextDate(idx) { const t = new Date(); let d = new Date(t.getFullYear(), t.getMonth(), t.getDate()); while (d.getDay() !== idx) d = addDays(d, 1); return d; }
function buildICS(mode) {
  const L = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Khotty//AR//', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'X-WR-CALNAME:خطتي'];
  const now = new Date(), stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;
  const BY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'], rm = S.settings.remind;
  const tm = t => t.replace(':', '') + '00';
  const ev = (uid, title, ds, s, e, idx, o = {}) => {
    L.push('BEGIN:VEVENT', `UID:${uid}@khotty`, `DTSTAMP:${stamp}`, `DTSTART:${ds}T${tm(s)}`, `DTEND:${ds}T${tm(e)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${BY[idx]};UNTIL=20270131T235959`, `SUMMARY:${icsEscape(title)}`);
    if (o.loc) L.push(`LOCATION:${icsEscape(o.loc)}`);
    if (o.desc) L.push(`DESCRIPTION:${icsEscape(o.desc)}`);
    for (const m of (o.alarms || [rm])) L.push('BEGIN:VALARM', 'ACTION:DISPLAY', `DESCRIPTION:${icsEscape(title)}`, `TRIGGER:-PT${m}M`, 'END:VALARM');
    L.push('END:VEVENT');
  };
  PLAN.days.forEach((d, idx) => {
    const f = nextDate(idx), ds = `${f.getFullYear()}${pad(f.getMonth() + 1)}${pad(f.getDate())}`;
    d.lectures.forEach(l => ev(`${d.id}-lec-${l.s}`, `🏛️ ${l.t} (${l.k})`, ds, l.s, l.e, idx, { loc: l.room, desc: l.who }));
    if (mode === 'all') {
      d.routine.filter(it => it.c !== 'uni').forEach(it => ev(`${d.id}-${it.s}-${it.c}`, `${CATS[it.c].i} ${it.t}`, ds, it.s, it.e, idx, { alarms: [it.c === 'quran' ? 0 : rm] }));
      const be = pad(Math.floor((mins(PLAN.sleep.bed) + 15) / 60)) + ':' + pad((mins(PLAN.sleep.bed) + 15) % 60);
      ev(`${d.id}-sleep`, `🌙 وقت النوم — صحيان ${fmt(PLAN.sleep.wake)}`, ds, PLAN.sleep.bed, be, idx, { alarms: [30, 0] });
    }
  });
  L.push('END:VCALENDAR');
  return L.map(fold).join('\r\n') + '\r\n';
}

async function shareOrDownload(name, mime, text) {
  const blob = new Blob([text], { type: mime + ';charset=utf-8' });
  try {
    const file = new File([blob], name, { type: mime });
    if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name }); return true; }
  } catch (e) { if (e && e.name === 'AbortError') return false; }
  const url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return true;
}

/* ---------- backup ---------- */
function importData(text) {
  try {
    const p = JSON.parse(text);
    if (!p || typeof p !== 'object' || !p.done || !p.sleep) throw 0;
    S = Object.assign(defaults(), p); S.settings = Object.assign({ theme: 'auto', remind: 10 }, p.settings || {});
    save(); applyTheme(); render(); toast('✅ تم استيراد البيانات');
  } catch (e) { toast('⚠️ الملف مش صالح'); }
}

/* ============================================================
   NAV / RENDER / EVENTS
   ============================================================ */
function applyTheme() {
  const t = S.settings.theme, r = document.documentElement;
  if (t === 'light' || t === 'dark') r.setAttribute('data-theme', t); else r.removeAttribute('data-theme');
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  const m = $('meta[name="theme-color"]'); if (m) m.setAttribute('content', dark ? '#1e1b4b' : '#4f46e5');
}

function render() {
  const f = { today: renderToday, stats: renderStats, sleep: renderSleep, more: renderMore }[ui.tab];
  f();
  ['today', 'stats', 'sleep', 'more'].forEach(t => { $('#v-' + t).hidden = t !== ui.tab; });
  $$('.tabbar button').forEach(b => b.classList.toggle('on', b.dataset.tab === ui.tab));
  if (ui.tab !== 'today') { $('#streakPill').textContent = `🔥 ${streaks().cur}`; $('#subdate').textContent = `${longDate(new Date())} · ${PLAN.term}`; $('#hello').textContent = `${new Date().getHours() < 12 ? 'صباح الخير' : 'مساء الخير'} يا ${PLAN.owner} 👋`; }
}
function go(tab) { ui.tab = tab; render(); window.scrollTo({ top: 0 }); }

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const a = el.dataset.act;
  switch (a) {
    case 'tab': go(el.dataset.tab); break;
    case 'day': ui.day = el.dataset.day; renderToday.scrolled = false; renderToday(); break;
    case 'toggle': toggle(el.dataset.key); break;
    case 'range': ui.range = +el.dataset.n; renderStats(); break;
    case 'q': ui.q = +el.dataset.q; $$('.q button').forEach(b => b.classList.toggle('on', +b.dataset.q === ui.q)); break;
    case 'saveSleep': {
      const bed = $('#sb').value, wake = $('#sw').value;
      if (!bed || !wake) return toast('⚠️ اختار الميعادين');
      S.sleep[ui.sleepDate] = { bed, wake, q: ui.q }; save(); renderSleep();
      toast(`✅ اتسجّل: ${sleepHours(bed, wake).toFixed(1)} ساعة نوم`); break;
    }
    case 'delSleep': delete S.sleep[el.dataset.k]; save(); renderSleep(); break;
    case 'theme': S.settings.theme = el.dataset.v; save(); applyTheme(); renderMore(); break;
    case 'ics': { const ok = await shareOrDownload(el.dataset.mode === 'all' ? 'khotty-full.ics' : 'khotty-lectures.ics', 'text/calendar', buildICS(el.dataset.mode)); if (ok) toast('📅 افتح الملف واختار «إضافة للتقويم»'); break; }
    case 'export': { await shareOrDownload(`khotty-backup-${todayKey()}.json`, 'application/json', JSON.stringify(S, null, 1)); break; }
    case 'import': $('#importFile').click(); break;
    case 'reset':
      if (confirm('متأكد؟ هيتمسح كل التتبع وسجل النوم نهائياً.')) { S = defaults(); save(); applyTheme(); ui.day = todayKey(); render(); toast('تم المسح'); } break;
    case 'install': if (deferredInstall) { deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall = null; renderMore(); } break;
  }
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.id === 'sd') { ui.sleepDate = el.value || todayKey(); const ex = S.sleep[ui.sleepDate]; ui.q = ex && ex.q ? ex.q : 4; renderSleep(); }
  else if (el.id === 'remind') { S.settings.remind = +el.value; save(); }
  else if (el.id === 'sb' || el.id === 'sw') updateSleepHours();
  else if (el.id === 'importFile' && el.files[0]) { const r = new FileReader(); r.onload = () => importData(r.result); r.readAsText(el.files[0]); el.value = ''; }
});
document.addEventListener('input', e => { if (e.target.id === 'sb' || e.target.id === 'sw') updateSleepHours(); });

/* keep "now" fresh + handle midnight / app resume */
function refreshClock() {
  if (todayKey() !== ui.lastToday) { const follow = ui.day === ui.lastToday; ui.lastToday = todayKey(); if (follow) ui.day = ui.lastToday; render(); return; }
  if (ui.tab === 'today' && !document.hidden) renderToday();
}
setInterval(refreshClock, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) refreshClock(); });
matchMedia('(prefers-color-scheme: dark)').addEventListener && matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);

window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferredInstall = e; if (ui.tab === 'more') renderMore(); });
window.addEventListener('appinstalled', () => { deferredInstall = null; toast('🎉 اتثبّت التطبيق'); });

/* ---------- service worker ---------- */
if ('serviceWorker' in navigator) {
  const had = !!navigator.serviceWorker.controller;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        nw && nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller)
            toast('🆕 فيه تحديث جديد', { label: 'حدّث', fn: () => nw.postMessage({ type: 'SKIP_WAITING' }) });
        });
      });
    }).catch(() => {});
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (!had || reloading) return; reloading = true; location.reload(); });
  });
}
if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});

applyTheme();
render();
window.__app = { get S() { return S; }, ui, dayStats, streaks, buildICS, sleepStats };   // للاختبار
})();
