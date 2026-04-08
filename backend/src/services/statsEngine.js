// ===========================================
// LVC Media Hub — Advanced Statistics Engine
// Beräknar avancerad spelarstatistik från DVW-data
// ===========================================

const GRADE_POSITIVE = ['#', '+'];
const GRADE_ERROR = ['/', '='];

/**
 * Beräkna avancerad spelarstatistik från en lista av actions
 * @param {Array} actions - Alla actions för en spelare (över en eller flera matcher)
 * @param {Array} allActions - Alla actions i matcherna (för kontextberäkningar)
 * @param {Array} scoreboards - Scoreboard-data per match [{videoId, scoreboard}]
 * @returns {Object} Omfattande statistikobjekt
 */
export function calculateAdvancedStats(actions, allActions = [], scoreboards = []) {
  const result = {
    overview: calculateOverview(actions),
    zoneAnalysis: calculateZoneAnalysis(actions),
    skillDetails: calculateSkillDetails(actions),
    trends: [], // Fylls i av caller per match
    pressureStats: calculatePressureStats(actions, scoreboards),
  };
  return result;
}

/**
 * Överblick — huvudsiffror
 */
function calculateOverview(actions) {
  let totalPts = 0;
  let totalActions = actions.length;
  let errors = 0;
  let positives = 0;
  let perfects = 0;

  for (const a of actions) {
    if (a.grade === '#') {
      perfects++;
      positives++;
      if (['S', 'A', 'B'].includes(a.skill)) totalPts++;
    } else if (a.grade === '+') {
      positives++;
    } else if (GRADE_ERROR.includes(a.grade)) {
      errors++;
    }
  }

  return {
    totalActions,
    totalPts,
    errors,
    positives,
    perfects,
    efficiency: totalActions > 0 ? Math.round(((positives - errors) / totalActions) * 100) : 0,
    positiveRate: totalActions > 0 ? Math.round((positives / totalActions) * 100) : 0,
    errorRate: totalActions > 0 ? Math.round((errors / totalActions) * 100) : 0,
  };
}

/**
 * Zonanalys — prestanda per zon per skill
 */
function calculateZoneAnalysis(actions) {
  // Angrepp per startzon (varifrån spelaren attackerar)
  const attackByZone = {};
  // Serve per slutzon (vart serven landar)
  const serveByEndZone = {};
  // Mottagning per startzon (var spelaren tar emot)
  const receptionByZone = {};
  // Försvar per startzon
  const digByZone = {};

  for (const a of actions) {
    if (a.skill === 'A' && a.startZone) {
      if (!attackByZone[a.startZone]) attackByZone[a.startZone] = { total: 0, kills: 0, errors: 0, blocked: 0 };
      const z = attackByZone[a.startZone];
      z.total++;
      if (a.grade === '#') z.kills++;
      if (GRADE_ERROR.includes(a.grade)) z.errors++;
      if (a.grade === '/') z.blocked++;
    }

    if (a.skill === 'S' && a.endZone) {
      if (!serveByEndZone[a.endZone]) serveByEndZone[a.endZone] = { total: 0, aces: 0, errors: 0 };
      const z = serveByEndZone[a.endZone];
      z.total++;
      if (a.grade === '#') z.aces++;
      if (GRADE_ERROR.includes(a.grade)) z.errors++;
    }

    if (a.skill === 'R' && a.startZone) {
      if (!receptionByZone[a.startZone]) receptionByZone[a.startZone] = { total: 0, positive: 0, perfect: 0, errors: 0 };
      const z = receptionByZone[a.startZone];
      z.total++;
      if (GRADE_POSITIVE.includes(a.grade)) z.positive++;
      if (a.grade === '#') z.perfect++;
      if (GRADE_ERROR.includes(a.grade)) z.errors++;
    }

    if (a.skill === 'D' && a.startZone) {
      if (!digByZone[a.startZone]) digByZone[a.startZone] = { total: 0, positive: 0, errors: 0 };
      const z = digByZone[a.startZone];
      z.total++;
      if (GRADE_POSITIVE.includes(a.grade)) z.positive++;
      if (GRADE_ERROR.includes(a.grade)) z.errors++;
    }
  }

  // Beräkna efficiency per zon
  const enrichZone = (zones, type) => {
    const result = {};
    for (const [zone, data] of Object.entries(zones)) {
      if (type === 'attack') {
        result[zone] = { ...data, killPct: data.total > 0 ? Math.round((data.kills / data.total) * 100) : 0, efficiency: data.total > 0 ? Math.round(((data.kills - data.errors - data.blocked) / data.total) * 100) : 0 };
      } else if (type === 'serve') {
        result[zone] = { ...data, acePct: data.total > 0 ? Math.round((data.aces / data.total) * 100) : 0 };
      } else {
        result[zone] = { ...data, positivePct: data.total > 0 ? Math.round((data.positive / data.total) * 100) : 0 };
      }
    }
    return result;
  };

  return {
    attack: enrichZone(attackByZone, 'attack'),
    serve: enrichZone(serveByEndZone, 'serve'),
    reception: enrichZone(receptionByZone, 'reception'),
    dig: enrichZone(digByZone, 'dig'),
  };
}

/**
 * Detaljerad skill-statistik
 */
function calculateSkillDetails(actions) {
  const skills = {};

  for (const a of actions) {
    if (!skills[a.skill]) {
      skills[a.skill] = {
        skill: a.skill,
        skillName: a.skillName,
        total: 0,
        perfect: 0,
        positive: 0,
        ok: 0,
        negative: 0,
        error: 0,
        points: 0,
        grades: {},
      };
    }
    const s = skills[a.skill];
    s.total++;

    // Grade breakdown
    if (!s.grades[a.grade]) s.grades[a.grade] = 0;
    s.grades[a.grade]++;

    if (a.grade === '#') { s.perfect++; s.positive++; }
    else if (a.grade === '+') { s.positive++; }
    else if (a.grade === '!') { s.ok++; }
    else if (a.grade === '-') { s.negative++; }
    else if (GRADE_ERROR.includes(a.grade)) { s.error++; }

    // Poäng: serve-ess, kill, block-kill
    if (a.grade === '#' && ['S', 'A', 'B'].includes(a.skill)) {
      s.points++;
    }
  }

  // Beräkna procent
  for (const s of Object.values(skills)) {
    s.positivePct = s.total > 0 ? Math.round((s.positive / s.total) * 100) : 0;
    s.errorPct = s.total > 0 ? Math.round((s.error / s.total) * 100) : 0;
    s.efficiency = s.total > 0 ? Math.round(((s.positive - s.error) / s.total) * 100) : 0;
  }

  return skills;
}

/**
 * Pressningsstatistik — prestanda i kritiska poängsituationer
 */
function calculatePressureStats(actions, scoreboards) {
  if (scoreboards.length === 0) return null;

  // Bygg en lookup: videoId:actionId → score
  const scoreMap = new Map();
  for (const sb of scoreboards) {
    for (const entry of sb.scoreboard) {
      scoreMap.set(`${sb.videoId}:${entry.id}`, entry.setScore);
    }
  }

  let clutchActions = 0;
  let clutchPositive = 0;
  let clutchErrors = 0;
  let trailingActions = 0;
  let trailingPositive = 0;
  let leadingActions = 0;
  let leadingPositive = 0;

  for (const a of actions) {
    const score = scoreMap.get(`${a.videoId}:${a.id}`);
    if (!score) continue;

    const myScore = a.team === 'H' ? score.H : score.V;
    const oppScore = a.team === 'H' ? score.V : score.H;

    // Clutch = båda lag 20+ eller setboll
    const isClutch = (myScore >= 20 && oppScore >= 20) || myScore >= 24 || oppScore >= 24;
    // Trailing = ligger under med 2+
    const isTrailing = oppScore - myScore >= 2;
    // Leading = leder med 2+
    const isLeading = myScore - oppScore >= 2;

    if (isClutch) {
      clutchActions++;
      if (GRADE_POSITIVE.includes(a.grade)) clutchPositive++;
      if (GRADE_ERROR.includes(a.grade)) clutchErrors++;
    }
    if (isTrailing) {
      trailingActions++;
      if (GRADE_POSITIVE.includes(a.grade)) trailingPositive++;
    }
    if (isLeading) {
      leadingActions++;
      if (GRADE_POSITIVE.includes(a.grade)) leadingPositive++;
    }
  }

  return {
    clutch: {
      actions: clutchActions,
      positivePct: clutchActions > 0 ? Math.round((clutchPositive / clutchActions) * 100) : 0,
      errorPct: clutchActions > 0 ? Math.round((clutchErrors / clutchActions) * 100) : 0,
    },
    trailing: {
      actions: trailingActions,
      positivePct: trailingActions > 0 ? Math.round((trailingPositive / trailingActions) * 100) : 0,
    },
    leading: {
      actions: leadingActions,
      positivePct: leadingActions > 0 ? Math.round((leadingPositive / leadingActions) * 100) : 0,
    },
  };
}

/**
 * Beräkna per-match-trend-data för en spelare
 */
export function calculateMatchTrend(matchStats) {
  if (matchStats.length < 2) return [];

  return matchStats.map(m => ({
    videoId: m.videoId,
    opponent: m.opponent,
    matchDate: m.matchDate,
    points: m.stats.totalPts,
    killPct: m.stats.attack.total > 0 ? Math.round((m.stats.attack.pts / m.stats.attack.total) * 100) : 0,
    attackEff: m.stats.attack.total > 0 ? Math.round(((m.stats.attack.pts - m.stats.attack.err - m.stats.attack.blocked) / m.stats.attack.total) * 100) : 0,
    recPosPct: m.stats.reception.total > 0 ? Math.round((m.stats.reception.pos / m.stats.reception.total) * 100) : 0,
    servePts: m.stats.serve.pts,
    actionCount: m.actionCount,
  }));
}

/**
 * Jämför spelarens statistik med laggenomsnitt
 */
export function calculateTeamComparison(playerStats, teamPlayerStats) {
  if (teamPlayerStats.length === 0) return null;

  const teamTotals = { killPct: [], recPosPct: [], ptsPerMatch: [], servePts: [] };

  for (const p of teamPlayerStats) {
    if (p.attack.total >= 5) {
      teamTotals.killPct.push(p.attack.total > 0 ? (p.attack.pts / p.attack.total) * 100 : 0);
    }
    if (p.reception.total >= 5) {
      teamTotals.recPosPct.push(p.reception.total > 0 ? (p.reception.pos / p.reception.total) * 100 : 0);
    }
    teamTotals.ptsPerMatch.push(p.totalPts / (p.matchCount || 1));
    teamTotals.servePts.push(p.serve.pts);
  }

  const avg = arr => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
  const percentile = (arr, val) => {
    if (arr.length === 0) return 50;
    const below = arr.filter(v => v < val).length;
    return Math.round((below / arr.length) * 100);
  };

  const pKillPct = playerStats.attack.total > 0 ? (playerStats.attack.pts / playerStats.attack.total) * 100 : 0;
  const pRecPct = playerStats.reception.total > 0 ? (playerStats.reception.pos / playerStats.reception.total) * 100 : 0;
  const pPtsPerMatch = playerStats.totalPts / (playerStats.matchCount || 1);

  return {
    killPct: { player: Math.round(pKillPct), teamAvg: Math.round(avg(teamTotals.killPct)), percentile: percentile(teamTotals.killPct, pKillPct) },
    recPosPct: { player: Math.round(pRecPct), teamAvg: Math.round(avg(teamTotals.recPosPct)), percentile: percentile(teamTotals.recPosPct, pRecPct) },
    ptsPerMatch: { player: Math.round(pPtsPerMatch * 10) / 10, teamAvg: Math.round(avg(teamTotals.ptsPerMatch) * 10) / 10, percentile: percentile(teamTotals.ptsPerMatch, pPtsPerMatch) },
  };
}
