import React, { useEffect, useState } from 'react';
import { 
  StyleSheet, 
  Text, 
  View, 
  ActivityIndicator, 
  ScrollView, 
  RefreshControl, 
  Image, 
  TouchableOpacity 
} from 'react-native';

export default function App() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [bvbPos, setBvbPos] = useState(null);
  const [liveMatch, setLiveMatch] = useState(null);
  const [nextMatch, setNextMatch] = useState(null);
  const [lastMatches, setLastMatches] = useState([]);
  const [notificationsGranted, setNotificationsGranted] = useState(false);

  // Aktuelle Saison
  const currentSeason = 2025; 

  // Web Push Notifications Berechtigung anfragen
  const requestNotificationPermission = () => {
    if ('Notification' in window) {
      Notification.requestPermission().then((permission) => {
        if (permission === 'granted') {
          setNotificationsGranted(true);
          new Notification('BVB App', {
            body: 'Benachrichtigungen für BVB-Tore aktiviert!',
          });
        }
      });
    }
  };

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      setNotificationsGranted(true);
    }
  }, []);

  const fetchBvbData = async () => {
    try {
      setLoading(true);

      // 1. Tabelle abrufen
      const tableRes = await fetch(`https://api.openligadb.de/getbltable/bl1/${currentSeason}`);
      const tableData = await tableRes.json();
      
      const bvbTeam = tableData.find(item => item.teamName.includes("Dortmund"));
      if (bvbTeam) {
        const position = tableData.indexOf(bvbTeam) + 1;
        setBvbPos({ ...bvbTeam, position });
      }

      // 2. Alle Spiele der Saison abrufen
      const matchesRes = await fetch(`https://api.openligadb.de/getmatchdata/bl1/${currentSeason}`);
      const matchesData = await matchesRes.json();

      // BVB-Spiele filtern
      const bvbMatches = matchesData.filter(m => 
        m.team1.teamName.includes("Dortmund") || m.team2.teamName.includes("Dortmund")
      );

      // Status: Live, Beendet, Anstehend
      const live = bvbMatches.find(m => !m.matchIsFinished && new Date(m.matchDateTime) <= new Date());
      const finished = bvbMatches.filter(m => m.matchIsFinished);
      const upcoming = bvbMatches.filter(m => !m.matchIsFinished && new Date(m.matchDateTime) > new Date());

      setLiveMatch(live || null);
      setLastMatches(finished.slice(-3).reverse());
      setNextMatch(upcoming[0] || null);

    } catch (error) {
      console.error("Fehler beim Laden der Daten:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Live-Intervall: Alle 30 Sekunden im Hintergrund aktualisieren
  useEffect(() => {
    fetchBvbData();
    const interval = setInterval(() => {
      fetchBvbData();
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchBvbData();
  };

  const getOpponent = (match) => {
    if (!match) return null;
    const isHome = match.team1.teamName.includes("Dortmund");
    return isHome ? match.team2 : match.team1;
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#FDE100" />
        <Text style={{ marginTop: 10, color: '#FFF' }}>Lade BVB-Daten...</Text>
      </View>
    );
  }

  return (
    <ScrollView 
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FDE100" />}
    >
      <View style={styles.header}>
        <Text style={styles.headerTitle}>BVB LIVE APP</Text>
      </View>

      {/* Benachrichtigungs-Button für Web */}
      {!notificationsGranted && (
        <TouchableOpacity style={styles.notifBtn} onPress={requestNotificationPermission}>
          <Text style={styles.notifBtnText}>🔔 Push-Benachrichtigungen aktivieren</Text>
        </TouchableOpacity>
      )}

      {/* Live-Spiel Anzeige */}
      {liveMatch && (
        <View style={[styles.card, styles.liveCard]}>
          <Text style={styles.liveTag}>🔴 LIVE SPIEL</Text>
          <Text style={styles.matchTitle}>
            {liveMatch.team1.shortName || liveMatch.team1.teamName} vs. {liveMatch.team2.shortName || liveMatch.team2.teamName}
          </Text>
          <Text style={styles.bigScore}>
            {liveMatch.matchResults[liveMatch.matchResults.length - 1]?.pointsTeam1 ?? 0} : {liveMatch.matchResults[liveMatch.matchResults.length - 1]?.pointsTeam2 ?? 0}
          </Text>

          <Text style={styles.sectionSubTitle}>Tore / Torschützen:</Text>
          {liveMatch.goals && liveMatch.goals.length > 0 ? (
            liveMatch.goals.map((goal, idx) => (
              <Text key={idx} style={styles.goalText}>
                ⚽ {goal.matchMinute}' {goal.goalGetterName} ({goal.scoreTeam1}:{goal.scoreTeam2})
              </Text>
            ))
          ) : (
            <Text style={styles.subText}>Noch keine Tore gefallen</Text>
          )}
        </View>
      )}

      {/* Tabellenplatz */}
      {bvbPos && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Aktueller Tabellenplatz</Text>
          <Text style={styles.bigText}>{bvbPos.position}. Platz</Text>
          <Text style={styles.subText}>Punkte: {bvbPos.points} | Tore: {bvbPos.goals}:{bvbPos.opponentGoals}</Text>
        </View>
      )}

      {/* Nächster Gegner & Spiel */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Nächstes Spiel & Gegner</Text>
        {nextMatch ? (
          <View>
            <View style={styles.opponentContainer}>
              {getOpponent(nextMatch)?.teamIconUrl ? (
                <Image 
                  source={{ uri: getOpponent(nextMatch).teamIconUrl }} 
                  style={styles.teamLogo} 
                  resizeMode="contain"
                />
              ) : null}
              <View style={{ flex: 1 }}>
                <Text style={styles.opponentLabel}>Gegner:</Text>
                <Text style={styles.opponentName}>{getOpponent(nextMatch)?.teamName}</Text>
              </View>
            </View>

            <Text style={styles.matchText}>
              {nextMatch.team1.teamName} vs. {nextMatch.team2.teamName}
            </Text>
            <Text style={styles.subText}>
              📅 {new Date(nextMatch.matchDateTime).toLocaleString('de-DE', { dateStyle: 'full', timeStyle: 'short' })}
            </Text>
          </View>
        ) : (
          <Text style={styles.subText}>Kein anstehendes Spiel gefunden.</Text>
        )}
      </View>

      {/* Vorherige Spiele + Torschützen */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Letzte Spiele</Text>
        {lastMatches.map((m, index) => {
          const result = m.matchResults.find(r => r.resultName === "Endergebnis") || m.matchResults[0];
          return (
            <View key={index} style={styles.historyBlock}>
              <View style={styles.historyRow}>
                <Text style={styles.historyTeams}>
                  {m.team1.shortName || m.team1.teamName} vs {m.team2.shortName || m.team2.teamName}
                </Text>
                <Text style={styles.historyScore}>
                  {result ? `${result.pointsTeam1}:${result.pointsTeam2}` : '-:-'}
                </Text>
              </View>

              {m.goals && m.goals.length > 0 && (
                <View style={styles.goalsContainer}>
                  {m.goals.map((g, gIdx) => (
                    <Text key={gIdx} style={styles.historyGoalText}>
                      ⚽ {g.matchMinute}' {g.goalGetterName}
                    </Text>
                  ))}
                </View>
              )}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#121212' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' },
  header: { backgroundColor: '#FDE100', padding: 20, paddingTop: 40, alignItems: 'center' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: '#000' },
  notifBtn: { backgroundColor: '#333', padding: 12, margin: 15, borderRadius: 8, alignItems: 'center', borderWidth: 1, borderColor: '#FDE100' },
  notifBtnText: { color: '#FDE100', fontWeight: 'bold' },
  card: { backgroundColor: '#1E1E1E', margin: 15, padding: 15, borderRadius: 10, borderWidth: 1, borderColor: '#333' },
  liveCard: { borderColor: '#E53935', borderWidth: 2 },
  liveTag: { color: '#E53935', fontWeight: 'bold', fontSize: 14, marginBottom: 5 },
  cardTitle: { color: '#FDE100', fontSize: 16, fontWeight: 'bold', marginBottom: 10 },
  sectionSubTitle: { color: '#FDE100', fontSize: 14, fontWeight: '600', marginTop: 10, marginBottom: 5 },
  bigText: { color: '#FFF', fontSize: 32, fontWeight: 'bold' },
  bigScore: { color: '#FFF', fontSize: 36, fontWeight: 'bold', marginVertical: 5 },
  matchTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  subText: { color: '#AAA', fontSize: 14, marginTop: 5 },
  matchText: { color: '#FFF', fontSize: 16, fontWeight: '600', marginTop: 10 },
  goalText: { color: '#FFF', fontSize: 14, marginVertical: 2 },
  opponentContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  teamLogo: { width: 45, height: 45, marginRight: 15 },
  opponentLabel: { color: '#888', fontSize: 12 },
  opponentName: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  historyBlock: { paddingVertical: 10, borderBottomWidth: 0.5, borderBottomColor: '#333' },
  historyRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  historyTeams: { color: '#DDD', fontSize: 15, fontWeight: '500' },
  historyScore: { color: '#FDE100', fontWeight: 'bold', fontSize: 16 },
  goalsContainer: { marginTop: 5, paddingLeft: 5 },
  historyGoalText: { color: '#888', fontSize: 12 }
});
