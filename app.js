
const API_BASE = "https://bvb-football-api.danielpodwysockiiit.workers.dev";

const $ = (selector) => document.querySelector(selector);

const TABLE_TYPES = {
  TOTAL: "Gesamttabelle",
  HOME: "Heimtabelle",
  AWAY: "Auswärtstabelle",
  FIRST_HALF: "Hinrundentabelle",
  SECOND_HALF: "Rückrundentabelle"
};

let countdownTarget = null;
let countdownInterval = null;
let tableRequestId = 0;

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function teamName(team) {
  if (!team) return "Unbekanntes Team";
  if (typeof team === "string") return team;

  return team.name ||
    team.shortName ||
    team.short_name ||
    team.tla ||
    "Unbekanntes Team";
}

function teamLogo(team, size = 18) {
  const logo = typeof team === "object" && team
    ? team.crest || team.logo || team.image || ""
    : "";

  if (!logo) {
    return `<span class="team-logo-placeholder">⚽</span>`;
  }

  return `<img src="${esc(logo)}" alt=""
    width="${size}" height="${size}"
    style="width:${size}px;height:${size}px;object-fit:contain;flex-shrink:0"
    loading="lazy" onerror="this.style.display='none'">`;
}

function teamCell(team) {
  return `<span class="team-cell">
    ${teamLogo(team, 18)}
    <span>${esc(teamName(team))}</span>
  </span>`;
}

function dateTime(value) {
  if (!value) return "Termin offen";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);

  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function setStatus(message, isError = false) {
  const status = $("#tableStatus");
  if (!status) return;

  status.textContent = message;
  status.classList.toggle("error", isError);
}

async function fetchJson(endpoint) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: { Accept: "application/json" }
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} bei ${endpoint}`);
  }

  return response.json();
}

function extractTable(data) {
  if (Array.isArray(data)) return data;

  if (Array.isArray(data?.table)) return data.table;
  if (Array.isArray(data?.standings)) {
    const selected = data.standings.find(
      (item) => Array.isArray(item.table)
    );
    if (selected) return selected.table;
  }

  if (Array.isArray(data?.standings?.[0]?.table)) {
    return data.standings[0].table;
  }

  return [];
}

function renderTable(data) {
  const body = $("#tableBody");
  if (!body) return;

  const rows = extractTable(data);

  if (!rows.length) {
    body.innerHTML = `
      <tr><td colspan="9">
        Für diese Tabellenansicht sind keine Daten verfügbar.
      </td></tr>`;
    return;
  }

  body.innerHTML = rows.map((row, index) => {
    const team = row.team || row;
    const played = row.playedGames ?? row.played ?? 0;
    const won = row.won ?? 0;
    const drawn = row.draw ?? row.drawn ?? 0;
    const lost = row.lost ?? 0;
    const goalsFor = row.goalsFor ?? row.goals_for ?? 0;
    const goalsAgainst = row.goalsAgainst ?? row.goals_against ?? 0;
    const difference = row.goalDifference ??
      row.goal_difference ?? (goalsFor - goalsAgainst);
    const points = row.points ?? 0;
    const position = row.position ?? index + 1;
    const isBvb = /borussia dortmund|dortmund/i.test(teamName(team));

    return `<tr class="${isBvb ? "bvb-row" : ""}">
      <td>${esc(position)}</td>
      <td class="team-column">${teamCell(team)}</td>
      <td>${esc(played)}</td>
      <td>${esc(won)}</td>
      <td>${esc(drawn)}</td>
      <td>${esc(lost)}</td>
      <td>${esc(goalsFor)}:${esc(goalsAgainst)}</td>
      <td>${Number(difference) > 0 ? "+" : ""}${esc(difference)}</td>
      <td><strong>${esc(points)}</strong></td>
    </tr>`;
  }).join("");
}

async function loadSelectedTable() {
  const selector = $("#tableSelector");
  const type = selector?.value || "TOTAL";
  const requestId = ++tableRequestId;

  setStatus(`${TABLE_TYPES[type] || "Tabelle"} wird geladen …`);

  try {
    // Der ausgewählte Tabellentyp wird an die API übergeben.
    const data = await fetchJson(
      `/api/standings?type=${encodeURIComponent(type)}`
    );

    // Ein älterer Request darf keine neuere Auswahl überschreiben.
    if (requestId !== tableRequestId) return;

    renderTable(data);

    const note = $("#tableNote");
    if (note) {
      note.textContent =
        `Ansicht: ${TABLE_TYPES[type] || type}. Tabellenwerte stammen aus der Datenquelle.`;
    }

    setStatus(
      `Tabelle aktualisiert: ${new Date().toLocaleTimeString("de-DE")}`
    );
  } catch (error) {
    if (requestId !== tableRequestId) return;

    console.error("Tabelle konnte nicht geladen werden:", error);
    setStatus(
      "Diese Tabellenansicht konnte nicht geladen werden. Bitte später erneut versuchen.",
      true
    );

    const body = $("#tableBody");
    if (body) {
      body.innerHTML = `<tr><td colspan="9">
        Tabellendaten sind momentan nicht verfügbar.
      </td></tr>`;
    }
  }
}

function matchTeam(match, side) {
  return match?.[side] ||
    match?.[side === "homeTeam" ? "home_team" : "away_team"] ||
    {};
}

function matchScore(match) {
  const score = match?.score;

  if (typeof score === "string") return score;

  const fullTime = score?.fullTime || score?.full_time;
  if (fullTime?.home != null && fullTime?.away != null) {
    return `${fullTime.home} : ${fullTime.away}`;
  }

  const home = match?.homeScore ?? match?.home_score ?? score?.home;
  const away = match?.awayScore ?? match?.away_score ?? score?.away;

  return home != null && away != null ? `${home} : ${away}` : "vs.";
}

function matchDate(match) {
  return match?.utcDate || match?.date ||
    match?.kickoff || match?.utc_date;
}

function matchCard(match, isLive = false) {
  const home = matchTeam(match, "homeTeam");
  const away = matchTeam(match, "awayTeam");

  return `<div class="result-card ${isLive ? "live-match" : ""}">
    <div class="result-teams">
      <span>${teamLogo(home, 26)} ${esc(teamName(home))}</span>
      <strong>${esc(matchScore(match))}</strong>
      <span>${teamLogo(away, 26)} ${esc(teamName(away))}</span>
    </div>
    <div class="result-date">
      ${isLive ? "LIVE" : esc(dateTime(matchDate(match)))}
    </div>
  </div>`;
}

function setCountdown(match) {
  const value = matchDate(match);
  countdownTarget = value ? new Date(value) : null;
  updateCountdown();
}

function updateCountdown() {
  const element = $("#countdown");
  if (!element) return;

  if (!countdownTarget || Number.isNaN(countdownTarget.getTime())) {
    element.textContent = "Anstoßtermin nicht bekannt";
    return;
  }

  const difference = countdownTarget.getTime() - Date.now();

  if (difference <= 0) {
    element.textContent = "Das Spiel läuft oder hat begonnen!";
    return;
  }

  const seconds = Math.floor(difference / 1000);
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  element.textContent =
    `${days} Tage ${hours} Std. ${minutes} Min. ${remainingSeconds} Sek.`;
}

function renderUpcoming(matches) {
  const panel = document.querySelector(".grid .panel:nth-child(2)");
  if (!panel) return;

  const container = panel.querySelector(".notice");
  if (!container) return;

  const upcoming = matches
    .filter((match) => !["FINISHED", "CANCELLED", "POSTPONED"]
      .includes(String(match.status || "").toUpperCase()))
    .sort((a, b) =>
      new Date(matchDate(a) || 0) - new Date(matchDate(b) || 0)
    )[0];

  if (!upcoming) {
    container.textContent = "Aktuell ist kein kommendes Spiel verfügbar.";
    countdownTarget = null;
    return;
  }

  const home = matchTeam(upcoming, "homeTeam");
  const away = matchTeam(upcoming, "awayTeam");
  const competition = upcoming.competition?.name ||
    upcoming.competition || "Spiel";

  container.innerHTML = `
    <div class="match-card next-match-card">
      <p class="match-competition">${esc(
        typeof competition === "string" ? competition : competition.name
      )}</p>
      <div class="match-teams">
        <span>${teamLogo(home, 26)} ${esc(teamName(home))}</span>
        <strong>vs.</strong>
        <span>${teamLogo(away, 26)} ${esc(teamName(away))}</span>
      </div>
      <p class="match-date">${esc(dateTime(matchDate(upcoming)))}</p>
      <div id="countdown" class="countdown"></div>
    </div>`;

  setCountdown(upcoming);
}

function renderResults(matches) {
  const container = $("#results");
  if (!container) return;

  const sorted = matches.slice().sort((a, b) =>
    new Date(matchDate(b) || 0) - new Date(matchDate(a) || 0)
  ).slice(0, 5);

  if (!sorted.length) {
    container.innerHTML =
      `<p class="muted">Keine vergangenen Ergebnisse verfügbar.</p>`;
    return;
  }

  container.innerHTML = sorted.map((match) => matchCard(match)).join("");
}

async function loadMatches() {
  try {
    const [liveData, upcomingData, finishedData] = await Promise.all([
      fetchJson("/api/live"),
      fetchJson("/api/upcoming"),
      fetchJson("/api/finished")
    ]);

    const live = Array.isArray(liveData)
      ? liveData : liveData?.matches || [];
    const upcoming = Array.isArray(upcomingData)
      ? upcomingData : upcomingData?.matches || [];
    const finished = Array.isArray(finishedData)
      ? finishedData : finishedData?.matches || [];

    renderUpcoming(upcoming);
    renderResults(finished);

    // Live-Spiele werden in der Konsole nicht versteckt, sondern
    // nur angezeigt, wenn ein passender Bereich in der HTML existiert.
    const liveContainer = $("#liveMatches");
    if (liveContainer) {
      liveContainer.innerHTML = live.length
        ? live.map((match) => matchCard(match, true)).join("")
        : `<p class="muted">Aktuell läuft kein Spiel.</p>`;
    }
  } catch (error) {
    console.error("Spieldaten konnten nicht geladen werden:", error);
  }
}

function loadData() {
  loadSelectedTable();
  loadMatches();
}

const selector = $("#tableSelector");

if (selector) {
  selector.addEventListener("change", loadSelectedTable);
}

if (countdownInterval) clearInterval(countdownInterval);
countdownInterval = setInterval(updateCountdown, 1000);

loadData();
setInterval(loadMatches, 60000);
setInterval(loadSelectedTable, 60000);
