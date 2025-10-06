// Builds a static, responsive, slow-scrolling calendar HTML for GitHub Pages.
// Fetches Planning Center ICS from env.ICS_URL and writes index.html.

import https from 'https';
import fs from 'fs';

const ICS_URL = process.env.ICS_URL;
if (!ICS_URL) { console.error('Missing ICS_URL secret.'); process.exit(1); }

// ---------- Tweakables ----------
const BRAND      = 'This Week at VUMC';
const TIMEZONE   = 'America/New_York';
const DAYS_AHEAD = 45;
const MAX_ITEMS  = 120;
const SCROLL_MS  = 420000; // 7 min. For a quick test, set to 60000 (1 min) to SEE motion.
// Colors
const COLORS = {
  bannerBg: '#3b556e',
  bannerFg: '#ffffff',
  stripRed: '#c62828',
  panelBg:  '#ffffff',
  panelFg:  '#000000',
  rule:     '#e5e7eb'
};
// --------------------------------

fetchText(ICS_URL).then(ics => {
  const events = parseICS(ics);
  const now = new Date();
  const until = new Date(now.getTime() + DAYS_AHEAD * 86400000);

  const list = events
    .filter(e => e.start && new Date(e.start) >= now && new Date(e.start) <= until)
    .sort((a,b)=> new Date(a.start) - new Date(b.start))
    .slice(0, MAX_ITEMS);

  const html = renderHtml(list);
  fs.writeFileSync('index.html', html, 'utf8');
  console.log('index.html written');
}).catch(err => { console.error(err); process.exit(1); });

function fetchText(url){
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode !== 200) return reject(new Error('ICS fetch failed: ' + res.statusCode));
      let data=''; res.on('data', d => data += d); res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// ---- ICS parsing ----
function parseICS(ics){
  ics = ics.replace(/\r\n/g, '\n').replace(/\n[ \t]/g, '');
  const blocks = ics.split('BEGIN:VEVENT').slice(1).map(b => 'BEGIN:VEVENT' + b);
  return blocks.map(block => {
    const get = n => {
      const m = block.match(new RegExp('^' + n + '(?:;[^:\\n]+)?:([^\\n]+)', 'm'));
      return m ? m[1].trim() : '';
    };
    const unesc = s => String(s||'').replace(/\\n/g,'\n').replace(/\\,/g,',').replace(/\\\\/g,'\\').trim();
    const s = get('DTSTART'), e = get('DTEND');
    const all = /^DTSTART;VALUE=DATE:/.test(block) || /^\d{8}$/.test(s);
    return { title: unesc(get('SUMMARY')) || 'Untitled',
             location: unesc(get('LOCATION')),
             description: unesc(get('DESCRIPTION')),
             allDay: all,
             start: toISO(s),
             end: toISO(e) };
  });
}
function toISO(v){
  if (!v) return null;
  if (/^\d{8}$/.test(v)) { const y=+v.slice(0,4), m=+v.slice(4,6)-1, d=+v.slice(6,8); return new Date(Date.UTC(y,m,d,0,0,0)).toISOString(); }
  if (/^\d{8}T\d{6}Z$/.test(v)) return new Date(v).toISOString();
  if (/^\d{8}T\d{6}$/.test(v)) { const y=+v.slice(0,4), m=+v.slice(4,6)-1, d=+v.slice(6,8), h=+v.slice(9,11), M=+v.slice(11,13), s=+v.slice(13,15); return new Date(y,m,d,h,M,s).toISOString(); }
  return new Date(v).toISOString();
}

// ---- formatting ----
function fmtDate(d){ return new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric', timeZone: TIMEZONE}).format(new Date(d)); }
function fmtTime(d){ return new Intl.DateTimeFormat('en-US',{hour:'numeric',minute:'2-digit', timeZone: TIMEZONE}).format(new Date(d)).toLowerCase(); }
function sameDay(a,b){ const A=new Date(a), B=new Date(b||a); return A.getFullYear()==B.getFullYear() && A.getMonth()==B.getMonth() && A.getDate()==B.getDate(); }
function esc(s){ return String(s||'').replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

// ---- HTML ----
function renderHtml(events){
  const groups = {};
  events.forEach(e => { const k = fmtDate(e.start); (groups[k] = groups[k] || []).push(e); });
  const labels = Object.keys(groups).sort((a,b)=> new Date(a) - new Date(b));

  const blocks = labels.map(label => {
    const rows = groups[label].map(e => {
      let when;
      if (e.allDay) when = 'All day';
      else if (!e.end || sameDay(e.start,e.end)) when = `${fmtTime(e.start)}${e.end ? '–' + fmtTime(e.end) : ''}`;
      else when = `${fmtDate(e.start)} ${fmtTime(e.start)} → ${fmtDate(e.end)} ${fmtTime(e.end)}`;
      return `<div class="event"><div class="title">${esc(e.title)}</div><div class="meta">${esc(when)}${e.location?` • ${esc(e.location)}`:''}</div></div>`;
    }).join('');
    return `<div class="day"><div class="dayhead">${esc(label)}</div>${rows}</div>`;
  }).join('');

  return `<!doctype html><html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${BRAND}</title>
<style>
:root{
  --banner-bg:${COLORS.bannerBg}; --banner-fg:${COLORS.bannerFg};
  --accent-red:${COLORS.stripRed}; --panel-bg:${COLORS.panelBg};
  --panel-fg:${COLORS.panelFg};   --rule:${COLORS.rule};
  --scroll-ms:${SCROLL_MS}ms;
}
html,body{height:100%}
body{margin:0;background:transparent;color:var(--panel-fg);font-family:system-ui,Segoe UI,Roboto,Helvetica,Arial,sans-serif;}
.wrap{display:flex;flex-direction:column;width:100%;height:100%;box-sizing:border-box}
.bar{display:flex;align-items:center;justify-content:space-between;padding:.6rem 1rem;background:var(--banner-bg);color:var(--banner-fg)}
.brand{font-weight:800;font-size:clamp(1.1rem,2.2vw,2rem);letter-spacing:.02em}
.clock{font-weight:700;font-variant-numeric:tabular-nums;font-size:clamp(.95rem,1.8vw,1.4rem)}
.panel{display:flex;flex-direction:column;background:var(--panel-bg);color:var(--panel-fg);border-left:1px solid var(--rule);border-right:1px solid var(--rule);border-bottom:1px solid var(--rule);height:100%;box-sizing:border-box}
.panel-header{background:var(--accent-red);color:#fff;padding:.5rem .9rem;font-weight:800;font-size:clamp(1rem,2vw,1.4rem)}
.vwrap{position:relative;overflow:hidden;height:100%}
.vcontent{position:absolute;width:100%;animation:vscroll var(--scroll-ms) linear infinite; will-change: transform;}
@keyframes vscroll{0%{transform:translateY(0)}98%{transform:translateY(-50%)}100%{transform:translateY(0)}}
.day{padding:.7rem 1rem .8rem;border-bottom:1px solid var(--rule)}
.dayhead{font-weight:800;opacity:.9;margin:0 0 .35rem;font-size:clamp(.95rem,1.8vw,1.2rem)}
.event{padding:.35rem 0}
.title{font-size:clamp(.95rem,1.9vw,1.25rem);line-height:1.35}
.meta{opacity:.85;font-size:clamp(.85rem,1.6vw,1.05rem);margin-top:.15rem}
</style>
</head>
<body>
<div class="wrap">
  <div class="bar"><div class="brand">${BRAND}</div><div class="clock" id="clock"></div></div>
  <div class="panel">
    <div class="panel-header">Upcoming Events</div>
    <div class="vwrap">
      <div class="vcontent">
        ${blocks || '<div class="day"><div class="dayhead">No events</div></div>'}
        ${blocks} <!-- duplicated for seamless loop -->
      </div>
    </div>
  </div>
</div>
<script>
function tick(){ const d=new Date(); const f=d.toLocaleString('en-US',{weekday:'long',month:'long',day:'numeric',hour:'numeric',minute:'2-digit'}); document.getElementById('clock').textContent=f; }
setInterval(tick,1000); tick();
// nudge animation every 5 min (some embedded browsers pause long animations)
setInterval(()=>{ document.querySelectorAll('.vcontent').forEach(el=>{ el.style.animation='none'; void el.offsetWidth; el.style.animation=''; }); }, 300000);
</script>
</body></html>`;
}
