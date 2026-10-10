
const API_BASE = "https://bvb-football-api.danielpodwysockiiit.workers.dev";

const $ = (selector) => document.querySelector(selector);

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

  return (
    team.name ||
    team.shortName ||
    team.short_name ||
    team.tla ||
    "Unbekanntes Team"
  );
}

function dateTime(value) {
  if (!value) return "Termin offen";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function teamLogo(team) {
  const logo =
    typeof team === "object" && team
      ? team.crest || team.logo || team.image || ""
      : "";

  if (!logo) {
    return `<span class="team-logo-placeholder" aria-hidden="true">⚽</span>`;
  }

  return `
    <img
      src="${esc(logo)}"
      alt=""
      width="18"
      height="18"
      loading="lazy"
      style="width:18px;height:18px;object-fit:contain;flex-shrink:0"
      onerror="this.style.display='none'"
    >
  `;
}

function teamCell(team) {
  return `
    <span class="team-cell">
      ${teamLogo(team)}
      <span>${esc(teamName(team))}</span>
    </span>
  `;
}

function setStatus(message, isError = false) {
  const status = $("#tableStatus");

  if (!status) return;

  status.textContent = message;
  status.classList.toggle("error", isError);
}

function renderTable(data) {
  const body = $("#tableBody");

  if (!body) return;

  const table = Array.isArray(data)
    ? data
    : data?.standings?.[0]?.table ||
      data?.table ||
      data?.standings ||
      [];

  if (!Array.isArray(table) || table.length === 0) {
    body.innerHTML = `
      <tr>
        <td colspan="9">Keine Tabellenstände verfügbar.</td>
      </tr>
    `;
    return;
  }

  body.innerHTML = table.map((row, index) => {
    const position = row.position ?? index + 1;
    const team = row.team || row;
    const played = row.playedGames ?? row.played ?? 0;
    const won = row.won ?? 0;
    const drawn = row.draw ?? row.drawn ?? 0;
    const lost = row.lost ?? 0;
    const goalsFor = row.goalsFor ?? row.goals_for ?? 0;
    const goalsAgainst = row.goalsAgainst ?? row.goals_against ?? 0;
    const goalDifference =
      row.goalDifference ??
      row.goal_difference ??
      goalsFor - goalsAgainst;
    const points = row.points ?? 0;

    const isBvb =
      /borussia dortmund|dortmund/i.test(teamName(team));

    return `
      <tr class="${isBvb ? "bvb-row" : ""}">
        <td>${esc(position)}</td>
        <td class="team-column">${teamCell(team)}</td>
        <td>${esc(played)}</td>
        <td>${esc(won)}</td>
        <td>${esc(drawn)}</td>
        <td>${esc(lost)}</td>
        <td>${esc(goalsFor)}:${esc(goalsAgainst)}</td>
        <td>${goalDifference > 0 ? "+" : ""}${esc(goalDifference)}</td>
        <td><strong>${esc(points)}</strong></td>
      </tr>
    `;
  }).join("");
}

function renderSelectedTable(data) {
  renderTable(data);
}

function scorerText(match) {
  const scorers = match?.scorers || match?.goals || [];

  if (!Array.isArray(scorers) || scorers.length === 0) {
    return "";
  }

  return scorers.map((goal) => {
    const player =
      goal.scorer?.name ||
      goal.player?.name ||
      goal.name ||
      "";

    const minute =
      goal.minute != null
        ? `${goal.minute}'`
        : "";

    return [player, minute].filter(Boolean).join(" ");
  }).filter(Boolean).join(", ");
}

let countdownInterval = null;
let countdownTarget = null;

function ensureCountdown() {
  if (countdownInterval) {
    clearInterval(countdownInterval);
  }

  countdownInterval = setInterval(updateCountdown, 1000);
  updateCountdown();
}

function updateCountdown() {
  const element = $("#countdown");

  if (!element || !countdownTarget) return;

  const difference = countdownTarget.getTime() - Date.now();

  if (difference <= 0) {
    element.textContent = "Das Spiel läuft oder hat begonnen!";
    return;
  }

  const totalSeconds = Math.floor(difference / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  element.textContent =
    `${days} Tage ${hours} Std. ${minutes} Min. ${seconds} Sek.`;
}

function setCountdown(match) {
  const element = $("#countdown");

  if (!element) return;

  const dateValue =
    match?.utcDate ||
    match?.date ||
    match?.kickoff ||
    match?.utc_date;

  if (!dateValue) {
    countdownTarget = null;
    element.textContent = "Termin noch nicht bekannt";
    return;
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    countdownTarget = null;
    element.textContent = "Termin noch nicht bekannt";
    return;
  }

  countdownTarget = date;
  updateCountdown();
}

function matchTeam(match, side) {
  const team = match?.[side];

  if (team) return team;

  const alternative =
    side === "homeTeam"
      ? match?.home_team
      : match?.away_team;

  return alternative || {};
}

function matchScore(match) {
  const score = match?.score;

  if (typeof score === "string") {
    return score;
  }

  const fullTime = score?.fullTime || score?.full_time;

  if (fullTime) {
    const home = fullTime.home;
    const away = fullTime.away;

    if (home != null && away != null) {
      return `${home} : ${away}`;
    }
  }

  const homeScore =
    match?.homeScore ??
    match?.home_score ??
    score?.home;

  const awayScore =
    match?.awayScore ??
    match?.away_score ??
    score?.away;

  if (homeScore != null && awayScore != null) {
    return `${homeScore} : ${awayScore}`;
  }

  return "vs";
}

function matchLogo(team) {
  const logo =
    typeof team === "object" && team
      ? team.crest || team.logo || team.image || ""
      : "";

  if (!logo) return "";

  return `
    <img
      src="${esc(logo)}"
      alt=""
      width="26"
      height="26"
      loading="lazy"
      style="width:26px;height:26px;object-fit:contain"
      onerror="this.style.display='none'"
    >
  `;
}

function renderMain(liveData, upcomingData, finishedData) {
  const liveMatches = Array.isArray(liveData)
    ? liveData
    : liveData?.matches || [];

  const upcomingMatches = Array.isArray(upcomingData)
    ? upcomingData
    : upcomingData?.matches || [];

  const finishedMatches = Array.isArray(finishedData)
    ? finishedData
    : finishedData?.matches || [];

  const liveContainer = $("#liveMatches");
  const nextContainer = $("#nextMatch");
  const resultsContainer = $("#lastResults");

  if (liveContainer) {
    if (liveMatches.length > 0) {
      liveContainer.innerHTML = liveMatches.map((match) => {
        const home = matchTeam(match, "homeTeam");
        const away = matchTeam(match, "awayTeam");

        return `
          <div class="match-card live-match">
            <div class="match-teams">
              <span>${matchLogo(home)} ${esc(teamName(home))}</span>
              <strong>${esc(matchScore(match))}</strong>
              <span>${matchLogo(away)} ${esc(teamName(away))}</span>
            </div>
            <div class="match-meta">LIVE</div>
          </div>
        `;
      }).join("");
    } else {
      liveContainer.innerHTML = `
        <p class="muted">Aktuell läuft kein Bundesliga-Spiel.</p>
      `;
    }
  }

  const nextMatch = upcomingMatches
    .slice()
    .sort((a, b) => {
      const dateA = new Date(
        a.utcDate || a.date || a.kickoff || a.utc_date || 0
      ).getTime();

      const dateB = new Date(
        b.utcDate || b.date || b.kickoff || b.utc_date || 0
      ).getTime();

      return dateA - dateB;
    })
    .find((match) => {
      const status = String(match.status || "").toUpperCase();

      return (
        status !== "FINISHED" &&
        status !== "CANCELLED" &&
        status !== "POSTPONED"
      );
    });

  if (nextContainer) {
    if (nextMatch) {
      const home = matchTeam(nextMatch, "homeTeam");
      const away = matchTeam(nextMatch, "awayTeam");
      const competition =
        nextMatch.competition?.name ||
        nextMatch.competition ||
        "Bundesliga";

      nextContainer.innerHTML = `
        <div class="match-card next-match-card">
          <p class="match-competition">${esc(
            typeof competition === "string"
              ? competition
              : competition.name || "Bundesliga"
          )}</p>

          <div class="match-teams">
            <span>${matchLogo(home)} ${esc(teamName(home))}</span>
            <strong>vs.</strong>
            <span>${matchLogo(away)} ${esc(teamName(away))}</span>
          </div>

          <p class="match-date">${esc(
            dateTime(
              nextMatch.utcDate ||
              nextMatch.date ||
              nextMatch.kickoff ||
              nextMatch.utc_date
            )
          )}</p>

          <div id="countdown" class="countdown">
            Countdown wird geladen …
          </div>
        </div>
      `;

      setCountdown(nextMatch);
    } else {
      countdownTarget = null;
      nextContainer.innerHTML = `
        <p class="muted">Aktuell ist kein kommendes Spiel verfügbar.</p>
      `;
    }
  }

  if (resultsContainer) {
    renderResults(finishedMatches, resultsContainer);
  }
}

function renderResults(matches, container) {
  if (!container) return;

  const sortedMatches = matches
    .slice()
    .sort((a, b) => {
      const dateA = new Date(
        a.utcDate || a.date || a.kickoff || a.utc_date || 0
      ).getTime();

      const dateB = new Date(
        b.utcDate || b.date || b.kickoff || b.utc_date || 0
      ).getTime();

      return dateB - dateA;
    })
    .slice(0, 5);

  if (sortedMatches.length === 0) {
    container.innerHTML = `
      <p class="muted">Keine vergangenen Ergebnisse verfügbar.</p>
    `;
    return;
  }

  container.innerHTML = sortedMatches.map((match) => {
    const home = matchTeam(match, "homeTeam");
    const away = matchTeam(match, "awayTeam");

    const scorers = scorerText(match);

    return `
      <div class="result-card">
        <div class="result-teams">
          <span>${matchLogo(home)} ${esc(teamName(home))}</span>
          <strong>${esc(matchScore(match))}</strong>
          <span>${matchLogo(away)} ${esc(teamName(away))}</span>
        </div>

        <div class="result-date">
          ${esc(dateTime(
            match.utcDate ||
            match.date ||
            match.kickoff ||
            match.utc_date
          ))}
        </div>

        ${scorers
          ? `<div class="result-scorers">${esc(scorers)}</div>`
          : ""}
      </div>
    `;
  }).join("");
}

async function fetchJson(endpoint) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(
      `Fehler beim Laden von ${endpoint}: HTTP ${response.status}`
    );
  }

  return response.json();
}

async function loadData() {
  setStatus("Aktuelle Fußballdaten werden geladen …");

  try {
    const [standings, live, upcoming, finished] = await Promise.all([
      fetchJson("/api/standings"),
      fetchJson("/api/live"),
      fetchJson("/api/upcoming"),
      fetchJson("/api/finished")
    ]);

    renderSelectedTable(standings);
    renderMain(live, upcoming, finished);

    setStatus(
      `Daten zuletzt aktualisiert: ${new Date().toLocaleTimeString("de-DE")}`
    );
  } catch (error) {
    console.error("Fußballdaten konnten nicht geladen werden:", error);

    setStatus(
      "Daten konnten nicht geladen werden. Bitte später erneut versuchen.",
      true
    );
  }
}

ensureCountdown();
loadData();
setInterval(loadData, 60000);
