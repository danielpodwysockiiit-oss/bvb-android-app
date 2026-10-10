const API_BASE = "https://bvb-football-api.danielpodwysockiiit.workers.dev";
const CACHE_KEY = "bvb-app-data-v2";
const $ = (s) => document.querySelector(s);
const esc = (v) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateTime = (v) => { if (!v) return "Termin noch nicht bekannt"; const d = new Date(v); return Number.isNaN(d.getTime()) ? "Termin noch nicht bekannt" : new Intl.DateTimeFormat("de-DE", { dateStyle:"medium", timeStyle:"short", timeZone:"Europe/Berlin" }).format(d) + " Uhr"; };
const teamName = t => t?.shortName || t?.name || "Unbekannt";
function setConnection(ok, text) { const el=$("#connection"); if(el) el.innerHTML=`<i></i><span>${esc(text || (ok ? "Online – Daten aktualisiert" : "Offline – gespeicherte Daten"))}</span>`; }
function renderTable(data) {
 const body=$("#tableBody"), status=$("#tableStatus");
 const table=data?.standings?.find(x=>x.type==="TOTAL") || data?.standings?.[0];
 const rows=table?.table || [];
 if(status) status.textContent=rows.length ? "Bundesliga-Tabelle · aktuelle API-Daten" : "Tabelle derzeit nicht verfügbar";
 if(body) body.innerHTML=rows.length ? rows.map(r=>`<tr class="${r.team?.id===4?'bvb-row':''}"><td>${esc(r.position)}</td><td>${esc(r.team?.shortName || r.team?.name)}</td><td>${esc(r.playedGames)}</td><td><b>${esc(r.points)}</b></td></tr>`).join("") : `<tr><td colspan="4">Keine Tabellendaten verfügbar</td></tr>`;
}
function scorerText(match) {
 const goals=(match.goals || []).filter(g=>g.scorer?.name).map(g=>`${g.minute ? g.minute+"′ " : ""}${g.scorer.name}${g.team?.id===match.homeTeam?.id ? " (Heim)" : g.team?.id===match.awayTeam?.id ? " (Auswärts)" : ""}`);
 return goals.length ? goals.join(" · ") : "Torschützen derzeit nicht verfügbar";
}
function renderResults(data) {
 const el=$("#results"), matches=(data?.matches || []).slice().sort((a,b)=>new Date(b.utcDate)-new Date(a.utcDate));
 if(!el) return;
 el.innerHTML=matches.length ? matches.map(m=>`<div class="result-row"><span>${esc(teamName(m.homeTeam))} – ${esc(teamName(m.awayTeam))}</span><b>${m.score?.fullTime?.home ?? "—"} : ${m.score?.fullTime?.away ?? "—"}</b><span>${esc(scorerText(m))}</span></div>`).join("") : `<div class="result-row"><span>Letzte Spiele</span><b>— : —</b><span>Keine Ergebnisdaten verfügbar</span></div>`;
}
function renderMain(liveData, upcomingData, finishedData) {
 const live=(liveData?.matches || []).find(m=>m.homeTeam?.id===4 || m.awayTeam?.id===4);
 const upcoming=(upcomingData?.matches || []).filter(m=>m.status==="SCHEDULED" || m.status==="TIMED").sort((a,b)=>new Date(a.utcDate)-new Date(b.utcDate))[0];
 const recent=(finishedData?.matches || []).slice().sort((a,b)=>new Date(b.utcDate)-new Date(a.utcDate))[0];
 const m=live || upcoming || recent;
 const panel=document.querySelector(".panel:nth-child(2)");
 if(!panel) return;
 const match=panel.querySelector(".match"), meta=panel.querySelector(".match-meta"), notice=panel.querySelector(".notice");
 if(!m) { if(notice) notice.textContent="Spielplan derzeit nicht verfügbar. Bitte später erneut laden."; return; }
 const isLive=!!live;
 const home=m.homeTeam || {}, away=m.awayTeam || {};
 if(match) match.innerHTML=`<div class="team"><div class="team-mark ${home.id===4?'bvb':'opp'}">${esc(home.tla || (home.id===4?'BVB':''))}</div><b>${esc(teamName(home))}</b></div><div class="vs">${isLive ? `${m.score?.fullTime?.home ?? 0} : ${m.score?.fullTime?.away ?? 0}` : "VS"}</div><div class="team"><div class="team-mark ${away.id===4?'bvb':'opp'}">${esc(away.tla || (away.id===4?'BVB':''))}</div><b>${esc(teamName(away))}</b></div>`;
 if(meta) meta.innerHTML=`<span>📅 ${esc(dateTime(m.utcDate))}</span><span>🕒 ${isLive ? 'LIVE · '+esc(m.minute ? m.minute+"′" : (m.status==="PAUSED"?"Halbzeit":"Spiel läuft")) : esc(m.status==="FINISHED"?"Abgepfiffen":"Anstoß" )}</span>`;
 if(notice) notice.innerHTML=isLive ? `<b style="color:#b00020">● LIVE</b><br>${esc(scorerText(m))}` : (m.status==="FINISHED" ? `Letztes Spiel · ${esc(scorerText(m))}` : "Nächstes geplantes BVB-Spiel");
}
async function fetchJson(path) { const r=await fetch(API_BASE+path, {cache:"no-store"}); const d=await r.json(); if(!r.ok) throw new Error(d.details || d.error || `HTTP ${r.status}`); return d; }
async function loadData() {
 const status=$("#tableStatus"); if(status) status.textContent="Lade aktuelle Fußballdaten …";
 try {
  const [standings, live, upcoming, finished]=await Promise.all([fetchJson("/api/standings"),fetchJson("/api/live"),fetchJson("/api/upcoming"),fetchJson("/api/finished")]);
  const data={standings,live,upcoming,finished,savedAt:Date.now()};
  localStorage.setItem(CACHE_KEY,JSON.stringify(data));
  renderTable(standings); renderMain(live,upcoming,finished); renderResults(finished); setConnection(true);
 } catch(err) {
  console.error("BVB API:",err);
  try { const d=JSON.parse(localStorage.getItem(CACHE_KEY)||"null"); if(d) { renderTable(d.standings); renderMain(d.live,d.upcoming,d.finished); renderResults(d.finished); setConnection(false,"Offline – zuletzt gespeicherte Daten"); if(status) status.textContent="Verbindungsfehler; gespeicherte Tabelle wird angezeigt."; return; } } catch {}
  setConnection(false,"Keine Verbindung zur Datenquelle"); if(status) status.textContent="Daten konnten nicht geladen werden. Bitte später erneut versuchen.";
  const n=document.querySelector(".panel:nth-child(2) .notice"); if(n) n.textContent="Spielplan gerade nicht erreichbar – bitte erneut laden.";
 }
}
const btn=$("#refreshBtn"); if(btn) btn.addEventListener("click",loadData);
if("serviceWorker" in navigator && location.protocol.startsWith("http")) navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
loadData();
setInterval(loadData, 60000);
