
"use strict";

const KEY = "bvb-app-cache-v1";
const API = "https://bvb-football-api.danielpodwysockiiit.workers.dev";

const connection = document.querySelector("#connection");
const tableBody = document.querySelector("#tableBody");
const results = document.querySelector("#results");
const tableStatus = document.querySelector("#tableStatus");
const refreshBtn = document.querySelector("#refreshBtn");

function status() {
  if (!connection) return;

  const online = navigator.onLine;
  const dot = connection.querySelector("i");
  const text = connection.querySelector("span");

  if (dot) {
    dot.style.background = online ? "#63c174" : "#e05a5a";
  }

  if (text) {
    text.textContent = online
      ? "Internetverbindung verfügbar"
      : "Offline – gespeicherte Daten werden angezeigt";
  }
}

function safeText(value) {
  const replacements = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  };

  return String(value ?? "").replace(/[&<>"']/g, function (character) {
    return replacements[character];
  });
}

function dateTime(value) {
  if (!value) return "Termin noch nicht bekannt";

  return new Date(value).toLocaleString("de-DE", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Berlin"
  }) + " Uhr";
}

function loadCache() {
  try {
    const cache = JSON.parse(localStorage.getItem(KEY) || "null");
    if (!cache) return false;

    if (tableBody && cache.tableBody) {
      tableBody.innerHTML = cache.tableBody;
    }

    if (results && cache.results) {
      results.innerHTML = cache.results;
    }

    if (cache.upcoming) {
      renderUpcoming(cache.upcoming);
    }

    if (tableStatus && cache.savedAt) {
      tableStatus.textContent =
        "Zuletzt gespeichert: " +
        new Date(cache.savedAt).toLocaleString("de-DE");
    }

    return true;
  } catch (error) {
    console.error("Gespeicherte Daten konnten nicht geladen werden:", error);
    return false;
  }
}

function renderUpcoming(matches) {
  const target = document.querySelector("#upcoming");
  if (!target) return;

  const next = (matches || [])
    .filter(function (match) {
      return match.status === "SCHEDULED" || match.status === "TIMED";
    })
    .sort(function (a, b) {
      return new Date(a.utcDate) - new Date(b.utcDate);
    })[0];

  if (!next) {
    target.innerHTML = "<p>Aktuell ist kein kommendes Spiel gelistet.</p>";
    return;
  }

  const isHome = next.homeTeam && next.homeTeam.id === 4;
  const opponent = isHome ? next.awayTeam : next.homeTeam;
  const venue = isHome ? "Heimspiel" : "Auswärtsspiel";

  target.innerHTML = `
    <h3>BVB – ${safeText(venue)}</h3>
    <p><strong>Borussia Dortmund gegen ${
      safeText(opponent?.name || "Gegner offen")
    }</strong></p>
    <p>${safeText(dateTime(next.utcDate))}</p>
    <p>${safeText(next.competition?.name || "Wettbewerb")}</p>
  `;
}

function renderTable(data) {
  if (!tableBody) return;

  const table =
    data.standings?.find(function (item) {
      return item.type === "TOTAL";
    })?.table || [];

  if (table.length === 0) {
    tableBody.innerHTML =
      '<tr><td colspan="8">Keine Tabellen-Daten verfügbar.</td></tr>';
    return;
  }

  tableBody.innerHTML = table.map(function (team) {
    return `
      <tr${team.team?.id === 4 ? ' class="bvb-row"' : ""}>
        <td>${team.position}</td>
        <td>${safeText(team.team?.shortName || team.team?.name || "–")}</td>
        <td>${team.playedGames ?? "–"}</td>
        <td>${team.won ?? "–"}</td>
        <td>${team.draw ?? "–"}</td>
        <td>${team.lost ?? "–"}</td>
        <td><strong>${team.points ?? "–"}</strong></td>
        <td>${team.goalsFor ?? 0}:${team.goalsAgainst ?? 0}</td>
      </tr>
    `;
  }).join("");
}

function renderResults(data) {
  if (!results) return;

  const matches = (data.matches || [])
    .filter(function (match) {
      return match.status === "FINISHED";
    })
    .sort(function (a, b) {
      return new Date(b.utcDate) - new Date(a.utcDate);
    })
    .slice(0, 5);

  if (matches.length === 0) {
    results.innerHTML = "<p>Keine abgeschlossenen Spiele gefunden.</p>";
    return;
  }

  results.innerHTML = matches.map(function (match) {
    const home = match.homeTeam?.name || "Heimteam";
    const away = match.awayTeam?.name || "Auswärtsteam";
    const score = match.score?.fullTime || {};
    const date = match.utcDate
      ? new Date(match.utcDate).toLocaleDateString("de-DE")
      : "";

    return `
      <article class="result-item">
        <small>${safeText(date)} · ${
          safeText(match.competition?.name || "Spiel")
        }</small>
        <p>
          ${safeText(home)}
          <strong>${score.home ?? "–"} : ${score.away ?? "–"}</strong>
          ${safeText(away)}
        </p>
      </article>
    `;
  }).join("");
}

async function fetchJSON(path) {
  const response = await fetch(API + path, {
    method: "GET",
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error("API-Fehler " + response.status + " bei " + path);
  }

  return response.json();
}

async function loadData() {
  status();

  if (!navigator.onLine) {
    loadCache();
    if (tableStatus) {
      tableStatus.textContent =
        "Offline – zuletzt gespeicherte Daten werden verwendet.";
    }
    return;
  }

  if (refreshBtn) refreshBtn.disabled = true;
  if (tableStatus) tableStatus.textContent = "Lade aktuelle Fußball-Daten …";

  try {
    const responses = await Promise.all([
      fetchJSON("/api/standings"),
      fetchJSON("/api/upcoming"),
      fetchJSON("/api/finished")
    ]);

    const standings = responses[0];
    const upcomingData = responses[1];
    const finishedData = responses[2];

    renderTable(standings);
    renderUpcoming(upcomingData.matches || []);
    renderResults(finishedData);

    localStorage.setItem(KEY, JSON.stringify({
      tableBody: tableBody?.innerHTML || "",
      results: results?.innerHTML || "",
      upcoming: upcomingData.matches || [],
      savedAt: Date.now()
    }));

    if (tableStatus) {
      tableStatus.textContent =
        "Aktualisiert: " +
        new Date().toLocaleString("de-DE", {
          timeZone: "Europe/Berlin"
        });
    }
  } catch (error) {
    console.error("BVB-Daten konnten nicht geladen werden:", error);
    loadCache();

    if (tableStatus) {
      tableStatus.textContent =
        "Abruf fehlgeschlagen – gespeicherte Daten werden genutzt. " +
        error.message;
    }
  } finally {
    if (refreshBtn) refreshBtn.disabled = false;
    status();
  }
}

window.addEventListener("online", loadData);
window.addEventListener("offline", status);

if (refreshBtn) {
  refreshBtn.addEventListener("click", loadData);
}

loadCache();
loadData();
