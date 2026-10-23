// Aktuelle Saison dynamisch ermitteln (im Herbst/Winter die aktuelle Jahreszahl, z. B. 2026)
const now = new Date();
const CURRENT_SEASON = now.getMonth() >= 6 ? now.getFullYear() : now.getFullYear() - 1;

async function fetchBvbData() {
  const statsElement = document.getElementById('bvb-stats');
  
  try {
    statsElement.textContent = "Lade Daten...";

    // 1. Tabelle abrufen (OHNE erzwungene Jahreszahl, holt automatisch die aktuellste)
    const tableRes = await fetch(`https://api.openligadb.de/getbltable/bl1/${CURRENT_SEASON}`);
    if (!tableRes.ok) throw new Error("Tabelle konnte nicht geladen werden");
    
    const tableData = await tableRes.json();
    
    if (Array.isArray(tableData) && tableData.length > 0) {
      const bvbTeam = tableData.find(item => item.teamName && item.teamName.includes("Dortmund"));
      if (bvbTeam) {
        const pos = tableData.indexOf(bvbTeam) + 1;
        document.getElementById('bvb-rank').textContent = `${pos}. Platz`;
        statsElement.textContent = `Punkte: ${bvbTeam.points} | Tore: ${bvbTeam.goals}:${bvbTeam.opponentGoals}`;
      } else {
        statsElement.textContent = "BVB in der Tabelle nicht gefunden.";
      }
    } else {
      statsElement.textContent = "Keine Tabellendaten verfügbar.";
    }

    // 2. Spiele abrufen
    const matchesRes = await fetch(`https://api.openligadb.de/getmatchdata/bl1/${CURRENT_SEASON}`);
    if (matchesRes.ok) {
      const matchesData = await matchesRes.json();
      
      if (Array.isArray(matchesData)) {
        const bvbMatches = matchesData.filter(m => 
          (m.team1 && m.team1.teamName && m.team1.teamName.includes("Dortmund")) || 
          (m.team2 && m.team2.teamName && m.team2.teamName.includes("Dortmund"))
        );

        const live = bvbMatches.find(m => !m.matchIsFinished && new Date(m.matchDateTime) <= now);
        const finished = bvbMatches.filter(m => m.matchIsFinished);
        const upcoming = bvbMatches.filter(m => !m.matchIsFinished && new Date(m.matchDateTime) > now);

        renderLiveMatch(live);
        renderNextMatch(upcoming[0]);
        renderLastMatches(finished.slice(-3).reverse());
      }
    }

  } catch (err) {
    console.error("Fehler beim Laden:", err);
    statsElement.textContent = "Fehler beim Laden der Daten. Bitte später erneut versuchen.";
  }
}

function renderLiveMatch(match) {
  const card = document.getElementById('live-card');
  if (!match) {
    card.classList.add('hidden');
    return;
  }

  card.classList.remove('hidden');
  document.getElementById('live-teams').textContent = `${match.team1.shortName || match.team1.teamName} vs. ${match.team2.shortName || match.team2.teamName}`;
  
  const lastRes = match.matchResults && match.matchResults.length > 0 ? match.matchResults[match.matchResults.length - 1] : null;
  document.getElementById('live-score').textContent = lastRes ? `${lastRes.pointsTeam1} : ${lastRes.pointsTeam2}` : "0 : 0";

  const goalsDiv = document.getElementById('live-goals');
  goalsDiv.innerHTML = '';
  if (match.goals && match.goals.length > 0) {
    match.goals.forEach(g => {
      const p = document.createElement('p');
      p.textContent = `⚽ ${g.matchMinute}' ${g.goalGetterName} (${g.scoreTeam1}:${g.scoreTeam2})`;
      goalsDiv.appendChild(p);
    });
  } else {
    goalsDiv.textContent = 'Noch keine Tore gefallen.';
  }
}

function renderNextMatch(match) {
  if (!match) {
    document.getElementById('opponent-name').textContent = "Kein Spiel gefunden";
    return;
  }

  const isHome = match.team1.teamName.includes("Dortmund");
  const opponent = isHome ? match.team2 : match.team1;

  const logoImg = document.getElementById('opponent-logo');
  if (opponent && opponent.teamIconUrl) {
    logoImg.src = opponent.teamIconUrl;
    logoImg.classList.remove('hidden');
  } else {
    logoImg.classList.add('hidden');
  }

  document.getElementById('opponent-name').textContent = opponent ? opponent.teamName : "Unbekannt";
  document.getElementById('next-match-teams').textContent = `${match.team1.teamName} vs. ${match.team2.teamName}`;
  
  const dateStr = new Date(match.matchDateTime).toLocaleString('de-DE', { dateStyle: 'full', timeStyle: 'short' });
  document.getElementById('next-match-date').textContent = `📅 ${dateStr}`;
}

function renderLastMatches(matches) {
  const container = document.getElementById('last-matches');
  container.innerHTML = '';

  if (!matches || matches.length === 0) {
    container.textContent = 'Keine vergangenen Spiele gefunden.';
    return;
  }

  matches.forEach(m => {
    const res = m.matchResults ? (m.matchResults.find(r => r.resultName === "Endergebnis") || m.matchResults[0]) : null;
    const scoreText = res ? `${res.pointsTeam1}:${res.pointsTeam2}` : '-:-';

    let goalsHTML = '';
    if (m.goals && m.goals.length > 0) {
      goalsHTML = `<div class="history-goals">` + 
        m.goals.map(g => `⚽ ${g.matchMinute}' ${g.goalGetterName}`).join('<br>') +
        `</div>`;
    }

    const block = document.createElement('div');
    block.className = 'history-block';
    block.innerHTML = `
      <div class="history-row">
        <span class="history-teams">${m.team1.shortName || m.team1.teamName} vs ${m.team2.shortName || m.team2.teamName}</span>
        <span class="history-score">${scoreText}</span>
      </div>
      ${goalsHTML}
    `;
    container.appendChild(block);
  });
}

// Push-Notifications
const notifBtn = document.getElementById('notif-btn');
if (notifBtn) {
  notifBtn.addEventListener('click', () => {
    if ('Notification' in window) {
      Notification.requestPermission().then(permission => {
        if (permission === 'granted') {
          notifBtn.classList.add('hidden');
          new Notification('BVB App', { body: 'Benachrichtigungen aktiviert!' });
        }
      });
    }
  });
}

// Aufruf beim Laden
fetchBvbData();
setInterval(fetchBvbData, 30000);
