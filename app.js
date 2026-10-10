
function renderUpcoming(matches) {
  const panel = document.querySelector(".grid .panel:nth-child(2)");
  if (!panel) return;

  const matchElement = panel.querySelector(".match");
  const metaElement = panel.querySelector(".match-meta");
  const noticeElement = panel.querySelector(".notice");

  const upcoming = matches
    .filter((match) => ![
      "FINISHED",
      "CANCELLED",
      "POSTPONED"
    ].includes(String(match.status || "").toUpperCase()))
    .filter((match) => matchDate(match))
    .sort((a, b) =>
      new Date(matchDate(a)) - new Date(matchDate(b))
    )[0];

  if (!upcoming) {
    if (matchElement) {
      matchElement.innerHTML = `
        <div class="team">
          <div class="team-mark bvb">BVB</div>
          <b>Borussia Dortmund</b>
        </div>
        <div class="vs">VS</div>
        <div class="team">
          <div class="team-mark opp">?</div>
          <b>Gegner offen</b>
        </div>`;
    }

    if (metaElement) {
      metaElement.innerHTML = `
        <span>📅 Datum folgt mit Datenquelle</span>
        <span>🕒 Anstoßzeit folgt</span>`;
    }

    if (noticeElement) noticeElement.remove();
    countdownTarget = null;
    return;
  }

  const home = matchTeam(upcoming, "homeTeam");
  const away = matchTeam(upcoming, "awayTeam");
  const date = new Date(matchDate(upcoming));

  const competition =
    typeof upcoming.competition === "object"
      ? upcoming.competition?.name
      : upcoming.competition;

  const isBvbHome = /borussia dortmund|dortmund/i.test(teamName(home));
  const bvbTeam = isBvbHome ? home : away;
  const opponent = isBvbHome ? away : home;

  const bvbLogo = teamLogo(bvbTeam, 64);
  const opponentLogo = teamLogo(opponent, 64);

  if (matchElement) {
    matchElement.innerHTML = `
      <div class="team">
        <div class="team-mark bvb">${bvbLogo || "BVB"}</div>
        <b>${esc(teamName(bvbTeam))}</b>
      </div>

      <div class="vs">VS</div>

      <div class="team">
        <div class="team-mark opp">${opponentLogo || "?"}</div>
        <b>${esc(teamName(opponent))}</b>
      </div>`;
  }

  if (metaElement) {
    metaElement.innerHTML = `
      <span>📅 ${esc(new Intl.DateTimeFormat("de-DE", {
        weekday: "long",
        day: "2-digit",
        month: "2-digit",
        year: "numeric"
      }).format(date))}</span>
      <span>🕒 Anstoß: ${esc(new Intl.DateTimeFormat("de-DE", {
        hour: "2-digit",
        minute: "2-digit"
      }).format(date))} Uhr</span>`;
  }

  // Die zusätzliche graue Spielkarte entfernen.
  if (noticeElement) noticeElement.remove();

  // Countdown direkt unter den vorhandenen Spieldaten ergänzen.
  let countdown = panel.querySelector("#countdown");

  if (!countdown) {
    countdown = document.createElement("div");
    countdown.id = "countdown";
    countdown.className = "countdown";
    panel.appendChild(countdown);
  }

  const competitionLabel = competition || "Nächstes Spiel";
  countdown.dataset.competition = competitionLabel;

  setCountdown(upcoming);
}
