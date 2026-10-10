
const API_BASE = "https://bvb-football-api.danielpodwysockiiit.workers.dev";
const CACHE_KEY = "bvb-app-data-v4";

const $ = (selector) => document.querySelector(selector);

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

const dateTime = (value) => {
  if (!value) return "Termin noch nicht bekannt";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Termin noch nicht bekannt";

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin"
  }).format(date) + " Uhr";
};

const teamName = (team) => team?.shortName || team?.name || "Unbekannt";

let countdownTarget = null;
let latestStandings = null;

function setConnection(ok, text) {
  const element = $("#connection");
  if (element) {
    element.innerHTML = `<i></i><span>${esc(text || (
      ok ? "Online – Daten aktualisiert" : "Offline – gespeicherte Daten"
    ))}</span>`;
  }
}

/* Vereinslogo aus der API */
function teamLogo(team) {
  const name = teamName(team);
  const crest = team?.crest;

  if (!crest) {
    return `<span class="club-fallback">${esc(name)}</span>`;
  }

  return `
    <img
      src="${esc(crest)}"
      alt="${esc(name)}"
      title="${esc(name)}"
      loading="lazy"
      referrerpolicy="no-referrer"
      style="width:30px;height:30px;object-fit:contain;flex-shrink:0"
      onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'club-fallback',textContent:this.alt}))"
    >
  `;
}

function teamCell(team) {
  return `
    <div style="display:flex;align-items:center;gap:9px;min-width:0">
      ${teamLogo(team)}
      <span>${esc(teamName(team))}</span>
    </div>
  `;
}

function ensureExtraTableUI() {
  const panel = document.querySelector(".panel");
  if (!panel || $("#tableSelector")) return;

  const container = document.createElement("div");
  container.id = "extraTables";
  container.innerHTML = `
    <div style="margin-top:18px">
      <label for="tableSelector" style="display:block;margin-bottom:8px;font-weight:bold">
        Tabellenansicht
      </label>
      <select id="tableSelector" style="width:100%;padding:10px;border-radius:8px;margin-bottom:12px">
        <option value="TOTAL">Gesamttabelle</option>
        <option value="HOME">Heimtabelle</option>
        <option value="AWAY">Auswärtstabelle</option>
        <option value="FIRST_HALF">Hinrunde</option>
        <option value="SECOND_HALF">Rückrunde</option>
      </select>
      <div id="extraTableNote" class="notice" style="margin-bottom:10px">
        Tabellen werden geladen …
      </div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th><th>Verein</th><th>Sp.</th>
              <th>G</th><th>U</th><th>V</th>
              <th>Tore</th><th>Diff.</th><th>Pkt.</th>
            </tr>
          </thead>
          <tbody id="extraTableBody"></tbody>
        </table>
      </div>
    </div>
  `;

  const footnote = panel.querySelector(".footnote");
  if (footnote) {
    footnote.insertAdjacentElement("afterend", container);
  } else {
    panel.appendChild(container);
  }

  $("#tableSelector").addEventListener("change", renderSelectedTable);
}

function getStandingsTable(data, type) {
  const tables = data?.standings || [];
  return tables.find((table) => table.type === type) || null;
}

function renderTable(data) {
  latestStandings = data;
  ensureExtraTableUI();

  const body = $("#tableBody");
  const status = $("#tableStatus");
  const table = getStandingsTable(data, "TOTAL") || data?.standings?.[0];
  const rows = table?.table || [];

  if (status) {
    status.textContent = rows.length
      ? "Bundesliga-Tabelle · aktuelle API-Daten"
      : "Tabelle derzeit nicht verfügbar";
  }

  if (body) {
    body.innerHTML = rows.length
      ? rows.map((row) => `
          <tr class="${row.team?.id === 4 ? "bvb-row" : ""}">
            <td>${esc(row.position)}</td>
            <td>${teamCell(row.team)}</td>
            <td>${esc(row.playedGames)}</td>
            <td><b>${esc(row.points)}</b></td>
          </tr>
        `).join("")
      : `<tr><td colspan="4">Keine Tabellendaten verfügbar</td></tr>`;
  }

  renderSelectedTable();
}

function renderSelectedTable() {
  const selector = $("#tableSelector");
  const body = $("#extraTableBody");
  const note = $("#extraTableNote");

  if (!selector || !body || !note) return;

  const type = selector.value;
  const table = getStandingsTable(latestStandings, type);
  const rows = table?.table || [];

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="9">Für diese Ansicht liefert die API keine Tabelle.</td></tr>`;
    note.textContent =
      type === "FIRST_HALF" || type === "SECOND_HALF"
        ? "Diese Teilrundentabelle wird von der aktuellen Datenquelle möglicherweise nicht angeboten."
        : "Diese Tabelle ist derzeit nicht verfügbar.";
    return;
  }

  note.textContent = {
    TOTAL: "Gesamttabelle",
    HOME: "Nur Heimspiele",
    AWAY: "Nur Auswärtsspiele",
    FIRST_HALF: "Hinrundentabelle",
    SECOND_HALF: "Rückrundentabelle"
  }[type] || "Tabellendaten";

  body.innerHTML = rows.map((row) => `
    <tr class="${row.team?.id === 4 ? "bvb-row" : ""}">
      <td>${esc(row.position)}</td>
      <td>${teamCell(row.team)}</td>
      <td>${esc(row.playedGames)}</td>
      <td>${esc(row.won)}</td>
      <td>${esc(row.draw)}</td>
      <td>${esc(row.lost)}</td>
      <td>${esc(row.goalsFor)}:${esc(row.goalsAgainst)}</td>
      <td>${esc(row.goalDifference)}</td>
      <td><b>${esc(row.points)}</b></td>
    </tr>
  `).join("");
}

function scorerText(match) {
  const goals = (match.goals || [])
    .filter((goal) => goal.scorer?.name)
    .map((goal) => {
      const minute = goal.minute ? `${goal.minute}′ ` : "";
      const team = goal.team?.id === match.homeTeam?.id
        ? " (Heim)"
        : goal.team?.id === match.awayTeam?.id
          ? " (Auswärts)"
          : "";

      return `${minute}${goal.scorer.name}${team}`;
    });

  return goals.length
    ? goals.join(" · ")
    : "Torschützen derzeit nicht verfügbar";
}

function ensureCountdown() {
  const panel = document.querySelector(".panel:nth-child(2)");
  if (!panel || $("#matchCountdown")) return;

  const countdown = document.createElement("div");
  countdown.id = "matchCountdown";
  countdown.style.cssText =
    "margin-top:18px;padding:16px;border-radius:12px;background:#202020;border:1px solid #f7d417;text-align:center";

  countdown.innerHTML = `
    <div style="font-weight:bold;color:#f7d417;margin-bottom:12px">
      COUNTDOWN BIS ZUM ANPFIFF
    </div>
    <div id="countdownValues" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px"></div>
    <div id="countdownMessage" style="margin-top:10px;font-size:13px">
      Warte auf den Spieltermin …
    </div>
  `;

  const meta = panel.querySelector(".match-meta");
  if (meta) meta.insertAdjacentElement("afterend", countdown);
  else panel.appendChild(countdown);
}

function setCountdown(match, isLive) {
  ensureCountdown();

  const values = $("#countdownValues");
  const message = $("#countdownMessage");
  if (!values || !message) return;

  if (isLive) {
    countdownTarget = null;
    values.innerHTML = "";
    message.textContent = "Das Spiel läuft gerade live! 🟡⚫";
    return;
  }

  if (match?.status === "FINISHED") {
    countdownTarget = null;
    values.innerHTML = "";
    message.textContent = "Dieses Spiel ist beendet.";
    return;
  }

  const target = match?.utcDate ? new Date(match.utcDate).getTime() : NaN;

  if (!Number.isFinite(target) || target <= Date.now()) {
    countdownTarget = null;
    values.innerHTML = "";
    message.textContent = "Der Anstoßtermin ist noch nicht bekannt.";
    return;
  }

  countdownTarget = target;
  updateCountdown();
}

function updateCountdown() {
  const values = $("#countdownValues");
  const message = $("#countdownMessage");
  if (!values || !message || !countdownTarget) return;

  let remaining = countdownTarget - Date.now();

  if (remaining <= 0) {
    values.innerHTML = "";
    message.textContent = "Anstoßzeit erreicht! Aktualisiere die Spieldaten …";
    return;
  }

  const days = Math.floor(remaining / 86400000);
  remaining %= 86400000;
  const hours = Math.floor(remaining / 3600000);
  remaining %= 3600000;
  const minutes = Math.floor(remaining / 60000);
  const seconds = Math.floor((remaining % 60000) / 1000);

  values.innerHTML = [
    [days, "Tage"],
    [hours, "Stunden"],
    [minutes, "Minuten"],
    [seconds, "Sekunden"]
  ].map(([value, label]) => `
    <div>
      <strong style="display:block;font-size:clamp(20px,4vw,30px);color:#f7d417">
        ${String(value).padStart(2, "0")}
      </strong>
      <small>${label}</small>
    </div>
  `).join("");

  message.textContent = "Noch bis zum geplanten Anstoß";
}

function renderResults(data) {
  const element = $("#results");
  const matches = (data?.matches || [])
    .slice()
    .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate));

  if (!element) return;

  element.innerHTML = matches.length
    ? matches.map((match) => `
        <div class="result-row">
          <span>${teamCell(match.homeTeam)} – ${teamCell(match.awayTeam)}</span>
          <b>${match.score?.fullTime?.home ?? "—"} : ${match.score?.fullTime?.away ?? "—"}</b>
          <span>${esc(scorerText(match))}</span>
        </div>
      `).join("")
    : `<div class="result-row"><span>Letzte Spiele</span><b>— : —</b><span>Keine Ergebnisdaten verfügbar</span></div>`;
}

function renderMain(liveData, upcomingData, finishedData) {
  const live = (liveData?.matches || []).find(
    (match) => match.homeTeam?.id === 4 || match.awayTeam?.id === 4
  );

  const upcoming = (upcomingData?.matches || [])
    .filter((match) => ["SCHEDULED", "TIMED"].includes(match.status))
    .sort((a, b) => new Date(a.utcDate) - new Date(b.utcDate))[0];

  const recent = (finishedData?.matches || [])
    .slice()
    .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate))[0];

  const matchData = live || upcoming || recent;
  const panel = document.querySelector(".panel:nth-child(2)");
  if (!panel) return;

  ensureCountdown();

  const matchElement = panel.querySelector(".match");
  const meta = panel.querySelector(".match-meta");
  const notice = panel.querySelector(".notice");

  if (!matchData) {
    if (notice) notice.textContent = "Spielplan derzeit nicht verfügbar. Bitte später erneut laden.";
    setCountdown(null, false);
    return;
  }

  const isLive = Boolean(live);
  const home = matchData.homeTeam || {};
  const away = matchData.awayTeam || {};

  if (matchElement) {
    matchElement.innerHTML = `
      <div class="team">
        <div class="team-mark ${home.id === 4 ? "bvb" : "opp"}">
          ${home.crest ? teamLogo(home) : esc(home.tla || (home.id === 4 ? "BVB" : "?"))}
        </div>
        <b>${esc(teamName(home))}</b>
      </div>
      <div class="vs">${isLive
        ? `${matchData.score?.fullTime?.home ?? 0} : ${matchData.score?.fullTime?.away ?? 0}`
        : "VS"}</div>
      <div class="team">
        <div class="team-mark ${away.id === 4 ? "bvb" : "opp"}">
          ${away.crest ? teamLogo(away) : esc(away.tla || (away.id === 4 ? "BVB" : "?"))}
        </div>
        <b>${esc(teamName(away))}</b>
      </div>
    `;
  }

  if (meta) {
    meta.innerHTML = `
      <span>📅 ${esc(dateTime(matchData.utcDate))}</span>
      <span>🕒 ${isLive
        ? "LIVE · " + esc(matchData.minute ? `${matchData.minute}′` : (
          matchData.status === "PAUSED" ? "Halbzeit" : "Spiel läuft"
        ))
        : esc(matchData.status === "FINISHED" ? "Abgepfiffen" : "Anstoß")}</span>
    `;
  }

  if (notice) {
    notice.innerHTML = isLive
      ? `<b style="color:#f7d417">● LIVE</b><br>${esc(scorerText(matchData))}`
      : matchData.status === "FINISHED"
        ? `Letztes Spiel · ${esc(scorerText(matchData))}`
        : "Nächstes geplantes BVB-Spiel";
  }

  setCountdown(matchData, isLive);
}

async function fetchJson(path) {
  const response = await fetch(API_BASE + path, { cache: "no-store" });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.details || data.error || `HTTP ${response.status}`);
  }

  return data;
}

async function loadData() {
  const status = $("#tableStatus");
  if (status) status.textContent = "Lade aktuelle Fußballdaten …";

  try {
    const [standings, live, upcoming, finished] = await Promise.all([
      fetchJson("/api/standings"),
      fetchJson("/api/live"),
      fetchJson("/api/upcoming"),
      fetchJson("/api/finished")
    ]);

    const data = {
      standings,
      live,
      upcoming,
      finished,
      savedAt: Date.now()
    };

    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    } catch (error) {
      console.warn("Cache konnte nicht gespeichert werden:", error);
    }

    renderTable(standings);
    renderMain(live, upcoming, finished);
    renderResults(finished);
    setConnection(true);
  } catch (error) {
    console.error("BVB API:", error);

    try {
      const cached = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");

      if (cached) {
        renderTable(cached.standings);
        renderMain(cached.live, cached.upcoming, cached.finished);
        renderResults(cached.finished);
        setConnection(false, "Offline – zuletzt gespeicherte Daten");

        if (status) {
          status.textContent = "Verbindungsfehler; gespeicherte Tabelle wird angezeigt.";
        }
        return;
      }
    } catch (cacheError) {
      console.warn("Cache konnte nicht gelesen werden:", cacheError);
    }

    setConnection(false, "Keine Verbindung zur Datenquelle");

    if (status) {
      status.textContent = "Daten konnten nicht geladen werden. Bitte später erneut versuchen.";
    }

    const notice = document.querySelector(".panel:nth-child(2) .notice");
    if (notice) {
      notice.textContent = "Spielplan gerade nicht erreichbar – bitte erneut laden.";
    }
  }
}

const refreshButton = $("#refreshBtn");
if (refreshButton) refreshButton.addEventListener("click", loadData);

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./service-worker.js").catch((error) => {
    console.warn("Service Worker konnte nicht registriert werden:", error);
  });
}

setInterval(updateCountdown, 1000);
loadData();
setInterval(loadData, 60000);
