// Builds a static, responsive, auto-scrolling calendar HTML for GitHub Pages.
// Fetches Planning Center ICS from env.ICS_URL and writes index.html.

import https from 'https';
import fs from 'fs';

const ICS_URL = process.env.ICS_URL;
if (!ICS_URL) {
  console.error('Missing ICS_URL (set a repository secret named ICS_URL with your https://... .ics link).');
  process.exit(1);
}

// ── Config you can tweak ─────────────────────────────────────────────
const BRAND      = 'This Week at VUMC';
const TIMEZONE   = 'America/New_York';
const DAYS_AHEAD = 45;
const MAX_ITEMS  = 30;
const SCROLL_MS  = 90000; // 🔥 faster base speed (was 420000 = 7 min)

// Colors
const COLORS = {
  bannerBg:  '#3b556e',
  bannerFg:  '#ffffff',
  stripRed:  '#c62828',
  panelBg:   '#ffffff',
  panelFg:   '#000000',
  rule:      '#e5e7eb'
};
// ────────────────────────────────────────────────────────────────────

fetchText(ICS_URL)
  .then(ics => {
    const events = parseICS(ics);
    const now = new Date();
    const until = new Date(now.getTime() + DAYS_AHEAD * 86400000);

    const filtered = events
      .filter(e => e.start && new Date(e.start) >= now && new Date(e.start) <= until)
      .sort((a, b) => new Date(a.start) - new Date(b.start))
      .slice(0, MAX_ITEMS);

    const html = renderHtml(filtered);
    fs.writeFileSync('index.html', html, 'utf8');
    console.log('Wrote index.html');
  })
  .catch(err => {
    console.error('Build failed:', err);
    process.exit(1);
  });

function fetchText(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode !== 200) return reject(new Error('ICS fetch failed: ' + res.statusCode));
      let data = '';
      res.on('data', d => data += d);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// ── ICS parser with TZID support ────────────────────────────────────
function getLine(block, name) {
  const re = new RegExp('^' + name + '([^:\\n]*):([^\\n]+)', 'm');
  const m = block.match(re);
  if (!m) return null;
  const paramsStr = m[1] || '';
  const value = m[2].trim();
  const params = {};
  paramsStr.replace(/;([^=;:]+)=([^;:]+)/g, (_, k, v) => {
    params[k.toUpperCase()] = v;
    return '';
  });
  return { value, params };
}

function wallClockToUTCISO(y, m, d, H, M, S, tz) {
  const t = Date.UTC(y, m, d, H, M, S);
  const offsetMs = tzOffsetAt(new Date(t), tz);
  return new Date(t - offsetMs).toISOString();
}

function tzOffsetAt(utcDate, timeZone) {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  });
  const parts = Object.fromEntries(fmt.formatToParts(utcDate).map(p => [p.type, p.value]));
  const asIfUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return asIfUTC - utcDate.getTime();
}

function getSimple(block, name) {
  const m = block.match(new RegExp('^' + name + '(?:;[^:\\n]+)?:([^\\n]+)', 'm'));
  return m ? m[1].trim() : '';
}

function toISOWithZone(line, defaultTZ) {
  if (!line) return null;
  const v = line.value;
  const tz = (line.params && line.params.TZID) ? line.params.TZID : null;

  if (/^\d{8}$/.test(v)) {
    const y = +v.slice(0,4), m = +v.slice(4,6)-1, d = +v.slice(6,8);
    return wallClockToUTCISO(y, m, d, 0, 0, 0, tz || defaultTZ);
  }
  if (/^\d{8}T\d{6}Z$/.test(v)) return new Date(v).toISOString();
  if (/^\d{8}T\d{6}$/.test(v)) {
    const y = +v.slice(0,4), m = +v.slice(4,6)-1, d = +v.slice(6,8);
    const H = +v.slice(9,11), M = +v.slice(11,13), S = +v.slice(13,15);
    return wallClockToUTCISO(y, m, d, H, M, S, tz || defaultTZ);
  }
  return new Date(v).toISOString();
}

function parseICS(ics) {
  ics = ics.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
  const blocks = ics.split('BEGIN:VEVENT').slice(1).map(b => 'BEGIN:VEVENT' + b);
  const unesc = s => String(s || '').replace(/\\n/g, '\n').replace(/\\,/g, ',').replace(/\\\\/g, '\\').trim();

  return blocks.map(block => {
    const sLine = getLine(block, 'DTSTART');
    const eLine = getLine(block, 'DTEND');
    const title = unesc(getSimple(block, 'SUMMARY')) || 'Untitled';
    const location = unesc(getSimple(block, 'LOCATION'));
    const description = unesc(getSimple(block, 'DESCRIPTION'));
    const all =
      (sLine && sLine.params && sLine.params.VALUE === 'DATE') ||
      (sLine && /^\d{8}$/.test(sLine.value));
    const startISO = toISOWithZone(sLine, TIMEZONE);
    const endISO   = toISOWithZone(eLine, TIMEZONE);
    return { title, location, description, allDay: all, start: startISO, end: endISO };
  });
}

// ── Formatting ─────────────────────────────────────────────────────
function fmtDate(d){
  return new Intl.DateTimeFormat('en-US', {
    weekday:'short', month:'short', day:'numeric', timeZone: TIMEZONE
  }).format(new Date(d));
}
function fmtTime(d){
  return new Intl.DateTimeFormat('en-US', {
    hour:'numeric', minute:'2-digit', timeZone: TIMEZONE
  }).format(new Date(d)).toLowerCase();
}
function sameDay(a,b){
  const A=new Date(a), B=new Date(b||a);
  return A.getFullYear()==B.getFullYear() && A.getMonth()==B.getMonth() && A.getDate()==B.getDate();
}
function esc(s){ return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// ── HTML render ─────────────────────────────────────────────────────
function renderHtml(events){
  const groups = {};
  events.forEach(e => {
    const label = fmtDate(e.start);
    (groups[label] = groups[label] || []).push(e);
  });
  const labels = Object.keys(groups).sort((a, b) => {
    const aMin = groups[a].reduce((min, e) => Math.min(min, +new Date(e.start)), Infinity);
    const bMin = groups[b].reduce((min, e) => Math.min(min, +new Date(e.start)), Infinity);
    return aMin - bMin;
  });

  const blocks = labels.map(label => {
    const rows = groups[label].map(e => {
      let when;
      if (e.allDay) when = 'All day';
      else if (!e.end || sameDay(e.start,e.end)) when = `${fmtTime(e.start)}${e.end ? '–' + fmtTime(e.end) : ''}`;
      else when = `${fmtDate(e.start)} ${fmtTime(e.start)} → ${fmtDate(e.end)} ${fmtTime(e.end)}`;
      return `<div class="event">
                <div class="title">${esc(e.title)}</div>
                <div class="meta">${esc(when)}${e.location ? ` • ${esc(e.location)}` : ''}</div>
              </div>`;
    }).join('');
    return `<div class="day">
              <div class="dayhead">${esc(label)}</div>
              ${rows}
            </div>`;
  }).join('');

  return `<!doctype html><html><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${BRAND}</title>
<style>
:root{
  --banner-bg:${COLORS.bannerBg};
  --banner-fg:${COLORS.bannerFg};
  --accent-red:${COLORS.stripRed};
  --panel-bg:${COLORS.panelBg};
  --panel-fg:${COLORS.panelFg};
  --rule:${COLORS.rule};
  --scroll-ms:${SCROLL_MS}ms;
}
html,body{height:100%}
body{
  margin:0;background:transparent;color:var(--panel-fg);
  font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;
}
.wrap{display:flex;flex-direction:column;width:100%;height:100%;box-sizing:border-box}

/* Top banner (grayish blue with white) */
.bar{
  display:flex;align-items:center;justify-content:space-between;
  padding:.6rem 1rem;background:var(--banner-bg);color:var(--banner-fg)
}
.brand{font-weight:800;font-size:clamp(1.1rem,2.2vw,2rem);letter-spacing:.02em}
.clock{font-weight:700;font-variant-numeric:tabular-nums;font-size:clamp(.95rem,1.8vw,1.4rem)}

/* Panel (white) with red header */
.panel{
  display:flex;flex-direction:column;background:var(--panel-bg);color:var(--panel-fg);
  border-left:1px solid var(--rule);border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);
  height:100%;box-sizing:border-box
}
.panel-header{background:var(--accent-red);color:#fff;padding:.5rem .9rem;font-weight:800;font-size:clamp(1rem,2vw,1.4rem)}

/* Scroller */
.vwrap{position:relative;overflow:hidden;height:100%}
.vcontent{position:absolute;width:100%;animation:vscroll var(--scroll-ms) linear infinite}
@keyframes vscroll{0%{transform:translateY(0)}98%{transform:translateY(-50%)}100%{transform:translateY(0)}}

/* Events */
.day{padding:.7rem 1rem .8rem;border-bottom:1px solid var(--rule)}
.dayhead{font-weight:800;opacity:.9;margin:0 0 .35rem;font-size:clamp(.95rem,1.8vw,1.2rem)}
.event{padding:.35rem 0}
.title{font-size:clamp(.95rem,1.9vw,1.25rem);line-height:1.35}
.meta{opacity:.85;font-size:clamp(.85rem,1.6vw,1.05rem);margin-top:.15rem}
</style>
</head>
<body>
<div class="wrap">
  <div class="bar">
    <div class="brand">${BRAND}</div>
    <div class="clock" id="clock"></div>
  </div>
  <div class="panel">
    <div class="panel-header">Upcoming Events</div>
    <div class="vwrap">
      <div class="vcontent">
        ${blocks || '<div class="day"><div class="dayhead">No events</div></div>'}
        ${blocks}
      </div>
    </div>
  </div>
</div>
<script>
// Force ET for clock
function tick(){
  const d=new Date();
  const f=new Intl.DateTimeFormat('en-US',{
    timeZone:'${TIMEZONE}',
    weekday:'long',month:'long',day:'numeric',hour:'numeric',minute:'2-digit'
  }).format(d);
  document.getElementById('clock').textContent=f+' ET';
}
setInterval(tick,1000); tick();

// 🔽 Auto-tune scroll speed by content height
(function autoSpeed(){
  const root=document.documentElement;
  const content=document.querySelector('.vcontent');
  const viewport=document.querySelector('.vwrap');
  if(!content||!viewport)return;
  const oneListHeight=content.scrollHeight/2;
  const pxPerSec=45; // raise = faster
  const durationMs=Math.max(30000,Math.round((oneListHeight/pxPerSec)*1000));
  root.style.setProperty('--scroll-ms',durationMs+'ms');
})();
</script>
</body></html>`;
}
