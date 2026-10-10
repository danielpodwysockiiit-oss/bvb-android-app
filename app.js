
const API_BASE = "https://bvb-football-api.danielpodwysockiiit.workers.dev";
const CACHE_KEY = "bvb-app-data-v6";

const $ = (selector) => document.querySelector(selector);

const esc = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

const teamName = (team) => team?.shortName || team?.name || "Unbekannt";

function dateTime(value) {
  if (!value) return "Termin noch nicht bekannt";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Termin noch nicht bekannt";

  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Berlin"
  }).format(date) + " Uhr";
}

/* Tabellenlogos: kompakte, feste Größe von 18 × 18 Pixeln */
function teamLogo(team) {
  const name = teamName(team);
  const abbreviation = (team?.tla || name.slice(0, 3)).toUpperCase();
  const crest = team?.crest;

  if (!crest) {
    return `<span class="club-fallback" title="${esc(name)}">${esc(abbreviation)}</span>`;
  }

  return `<span style="display:inline-flex;width:18px;height:18px;min-width:18px;max-width:18px;flex:0 0 18px;align-items:center;justify-content:center;overflow:hidden">
    <img
      src="${esc(crest)}"
      alt="${esc(name)}"
      title="${esc(name)}"
      width="18"
      height="18"
      loading="lazy"
      style="display:block!important;width:18px!important;height:18px!important;min-width:18px!important;max-width:18px!important;min-height:18px!important;max-height:18px!important;object-fit:contain!important;padding:0!important;margin:0!important;flex:none!important"
      onerror="this.style.display='none';this.parentElement.nextElementSibling.style.display='inline-flex'"
    >
  </span><span class="club-fallback" style="display:none">${esc(abbreviation)}</span>`;
}

function teamCell(team) {
  return `<div class="club-cell" style="display:flex;align-items:center;gap:7px;min-width:145px">
    ${teamLogo(team)}
    <span>${esc(teamName(team))}</span>
  </div>`;
}

function setConnection(ok, message) {
  const element = $("#connection");

  if (element) {
    element.innerHTML = `<i></i><span>${esc(
      message || (ok ? "Online – Daten aktualisiert" : "Offline – gespeicherte Daten")
    )}</span>`;
  }
}

let standingsData = null;
let countdownTarget = null;

function getTable(type) {
  const tables = standingsData?.standings || [];
  return tables.find((table) => table.type === type) || null;
}

function renderTable(data) {
  standingsData = data;

  const selector = $("#tableSelector");
  const status = $("#tableStatus");

  if (selector) {
    selector.onchange = renderSelectedTable;
  }

  renderSelectedTable();

  const total = getTable("TOTAL") || data?.standings?.[0];

  if (status) {
    status.textContent = total?.table?.length
      ? "Bundesliga-Tabelle · aktuelle API-Daten"
      : "Tabelle derzeit nicht verfügbar";
  }
}

function renderSelectedTable() {
  const type = $("#tableSelector")?.value || "TOTAL";
  const body = $("#tableBody");
  const note = $("#tableNote");

  if (!body) return;

  const rows = getTable(type)?.table || [];

  if (!rows.length) {
    body.innerHTML = `<tr><td colspan="9">Für diese Tabellenansicht sind derzeit keine Daten verfügbar.</td></tr>`;

    if (note) {
      note.textContent = "Diese Ansicht wird möglicherweise nicht von der Datenquelle bereitgestellt.";
    }
    return;
  }

  if (note) {
    note.textContent = {
      TOTAL: "Gesamttabelle · Spiele, Tore und Punkte",
      HOME: "Heimtabelle · nur Heimspiele",
      AWAY: "Auswärtstabelle · nur Auswärtsspiele",
      FIRST_HALF: "Hinrundentabelle · sofern verfügbar",
      SECOND_HALF: "Rückrundentabelle · sofern verfügbar"
    }[type] || "Tabellendaten aus der API";
  }

  body.innerHTML = rows.map((row) => {
    const team = row.team || {};
    const goalsFor = row.goalsFor;
    const goalsAgainst = row.goalsAgainst;

    const difference = row.goalDifference ??
      (goalsFor != null && goalsAgainst != null
        ? Number(goalsFor) - Number(goalsAgainst)
        : "—");

    return `<tr class="${team.id === 4 ? "bvb-row" : ""}">
      <td>${esc(row.position ?? "—")}</td>
      <td>${teamCell(team)}</td>
      <td>${esc(row.playedGames ?? "—")}</td>
      <td>${esc(row.won ?? "—")}</td>
      <td>${esc(row.draw ?? "—")}</td>
      <td>${esc(row.lost ?? "—")}</td>
      <td>${goalsFor == null || goalsAgainst == null
        ? "—"
        : `${esc(goalsFor)}:${esc(goalsAgainst)}`}</td>
      <td>${esc(difference)}</td>
      <td><b>${esc(row.points ?? "—")}</b></td>
    </tr>`;
  }).join("");
}

function scorerText(match) {
  const goals = (match?.goals || [])
    .filter((goal) => goal.scorer?.name)
    .map((goal) => {
      const minute = goal.minute ? `${goal.minute}′ ` : "";
      const side = goal.team?.id === match.homeTeam?.id
        ? " (Heim)"
        : goal.team?.id === match.awayTeam?.id
          ? " (Auswärts)"
          : "";

      return `${minute}${goal.scorer.name}${side}`;
    });

  return goals.length
    ? goals.join(" · ")
    : "Torschützen derzeit nicht verfügbar";
}

function ensureCountdown() {
  const panel = document.querySelector(".panel:nth-child(2)");

  if (!panel || $("#matchCountdown")) return;

  const box = document.createElement("div");
  box.id = "matchCountdown";
  box.innerHTML = `
    <strong style="display:block;color:#f7d417;margin-bottom:12px">
      COUNTDOWN BIS ZUM ANPFIFF
    </strong>
    <div id="countdownValues"></div>
    <div id="countdownMessage" style="margin-top:10px;font-size:13px">
      Warte auf den Spieltermin …
    </div>
  `;

  const meta = panel.querySelector(".match-meta");

  if (meta) {
    meta.insertAdjacentElement("afterend", box);
  } else {
    panel.appendChild(box);
  }
}

function updateCountdown() {
  const values = $("#countdownValues");
  const message = $("#countdownMessage");

  if (!values || !message || !countdownTarget) return;

  let remaining = countdownTarget - Date.now();

  if (remaining <= 0) {
    values.innerHTML = "";
    message.textContent = "Anstoßzeit erreicht – Spielstand wird aktualisiert.";
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
  ].map(([number, label]) => `
    <div>
      <strong class="countdown-number">${String(number).padStart(2, "0")}</strong>
      <small>${label}</small>
    </div>
  `).join("");
}

function setCountdown(match, isLive) {
  ensureCountdown();

  const values = $("#countdownValues");
  const message = $("#countdownMessage");

  if (!values || !message) return;

  if (isLive) {
    countdownTarget = null;
    values.innerHTML = "";
    message.textContent = "Das Spiel läuft live! 🟡⚫";
    return;
  }

  const target = match?.utcDate
    ? new Date(match.utcDate).getTime()
    : NaN;

  if (match?.status === "FINISHED") {
    countdownTarget = null;
    values.innerHTML = "";
    message.textContent = "Dieses Spiel ist beendet.";
  } else if (!Number.isFinite(target) || target <= Date.now()) {
    countdownTarget = null;
    values.innerHTML = "";
    message.textContent = "Der Anstoßtermin ist noch nicht bekannt.";
  } else {
    countdownTarget = target;
    updateCountdown();
  }
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
    if (notice) notice.textContent = "Spielplan derzeit nicht verfügbar.";
    setCountdown(null, false);
    return;
  }

  const home = matchData.homeTeam || {};
  const away = matchData.awayTeam || {};
  const isLive = Boolean(live);

  if (matchElement) {
    const matchTeam = (team, side) => `
      <div class="team">
        <div class="team-mark ${team.id === 4 ? "bvb" : "opp"}">
          ${team.crest
            ? `<img src="${esc(team.crest)}" alt="${esc(teamName(team))}" style="width:26px;height:26px;max-width:26px;max-height:26px;object-fit:contain" onerror="this.style.display='none';this.parentElement.textContent='${esc(team.tla || side)}'">`
            : esc(team.tla || side)}
        </div>
        <b>${esc(teamName(team))}</b>
      </div>`;

    matchElement.innerHTML = `
      ${matchTeam(home, "HEIM")}
      <div class="vs">${isLive
        ? `${matchData.score?.fullTime?.home ?? 0} : ${matchData.score?.fullTime?.away ?? 0}`
        : "VS"}</div>
      ${matchTeam(away, "AUSW")}
    `;
  }

  if (meta) {
    meta.innerHTML = `
      <span>📅 ${esc(dateTime(matchData.utcDate))}</span>
      <span>🕒 ${isLive ? "LIVE" : esc(matchData.status === "FINISHED" ? "Abgepfiffen" : "Anstoß")}</span>
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

function renderResults(data) {
  const element = $("#results");
  if (!element) return;

  const matches = (data?.matches || [])
    .slice()
    .sort((a, b) => new Date(b.utcDate) - new Date(a.utcDate));

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
  }
}

const refreshButton = $("#refreshBtn");

if (refreshButton) {
  refreshButton.addEventListener("click", loadData);
}

if ("serviceWorker" in navigator && location.protocol.startsWith("http")) {
  navigator.serviceWorker.register("./service-worker.js").catch((error) => {
    console.warn("Service Worker konnte nicht registriert werden:", error);
  });
}

setInterval(updateCountdown, 1000);
loadData();
setInterval(loadData, 60000);
