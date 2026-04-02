// ===========================================
// LVC Media Hub — Data Volley Scout Parser
// ===========================================
import { readFile } from 'fs/promises';
import path from 'path';

const STORAGE_PATH = process.env.STORAGE_PATH || '/storage';

const SKILL_MAP = {
  S: 'Serve', R: 'Reception', E: 'Pass', A: 'Attack',
  B: 'Block', D: 'Dig', F: 'Gratisboll', O: 'Overpass'
};

// Remap DVW skill codes to our codes (E→P, F→G)
const SKILL_REMAP = { E: 'P', F: 'G' };

const GRADE_MAP = {
  '#': 'Perfekt', '+': 'Positiv', '!': 'OK',
  '-': 'Negativ', '/': 'Error', '=': 'Error'
};

// Volleybollplanens zoner (standard numrering)
// 4 | 3 | 2    (nät)
// 5 | 6 | 1    (baklinje)
const ZONE_POSITIONS = {
  1: { x: 83, y: 75 },
  2: { x: 83, y: 25 },
  3: { x: 50, y: 25 },
  4: { x: 17, y: 25 },
  5: { x: 17, y: 75 },
  6: { x: 50, y: 75 },
  7: { x: 10, y: 50 },  // Utanför vänster
  8: { x: 50, y: 10 },  // Bakom nät
  9: { x: 90, y: 50 }   // Utanför höger
};

// Parsa DataVolley koordinatindex (1-10000) till {x, y}
// Index 1 = nedre vänster, 10000 = övre höger, 100x100 grid
const parseCoordinate = (val) => {
  const num = parseInt(val, 10);
  if (isNaN(num) || num < 1 || num > 10000) return null;
  const x = ((num - 1) % 100);
  const y = Math.floor((num - 1) / 100);
  return { x, y };
};

const timeToSeconds = (timeStr) => {
  if (!timeStr) return null;
  const parts = timeStr.split('.');
  if (parts.length < 3) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const s = parseInt(parts[2], 10);
  if (isNaN(h) || isNaN(m) || isNaN(s)) return null;
  return h * 3600 + m * 60 + s;
};

const parsePlayers = (lines) => {
  // players[team][number] = { number, name }
  // team: 'H' för [3PLAYERS-H], 'V' för [3PLAYERS-V]
  const players = { H: {}, V: {} };
  let currentTeam = null;

  for (const line of lines) {
    if (line.startsWith('[3PLAYERS-H]')) { currentTeam = 'H'; continue; }
    if (line.startsWith('[3PLAYERS-V]')) { currentTeam = 'V'; continue; }
    if (line.startsWith('[3') && !line.startsWith('[3PLAYERS')) { currentTeam = null; continue; }
    if (!currentTeam || !line.trim()) continue;

    const parts = line.split(';');
    if (parts.length < 11) continue;

    const number = parseInt(parts[1], 10);
    const lastName = parts[9] || '';
    const firstName = parts[10] || '';
    const name = `${firstName} ${lastName}`.trim();

    players[currentTeam][number] = { number, name, team: currentTeam };
  }
  return players;
};

const parseTeams = (lines) => {
  const teams = { H: 'Hemmalag', V: 'Bortalag' };
  let inSection = false;
  let count = 0;

  for (const line of lines) {
    if (line.startsWith('[3TEAMS]')) { inSection = true; continue; }
    if (line.startsWith('[3') && !line.startsWith('[3TEAMS')) { inSection = false; continue; }
    if (!inSection || !line.trim()) continue;

    const parts = line.split(';');
    if (parts.length < 2) continue;
    if (count === 0) teams.H = parts[1];
    if (count === 1) teams.V = parts[1];
    count++;
  }
  return teams;
};

const parseMatchStart = (lines) => {
  let inSection = false;
  for (const line of lines) {
    if (line.startsWith('[3MATCH]')) { inSection = true; continue; }
    if (line.startsWith('[3') && !line.startsWith('[3MATCH')) { inSection = false; continue; }
    if (!inSection || !line.trim()) continue;

    const parts = line.split(';');
    if (parts.length >= 2) {
      return timeToSeconds(parts[1]);
    }
  }
  return null;
};

const parseScout = (lines, players, teams, matchStartSeconds, videoOffset) => {
  const actions = [];
  const scoreEvents = []; // { afterActionIndex, set, scoreH, scoreV }
  let inSection = false;
  let currentSet = 1;

  for (const line of lines) {
    if (line.startsWith('[3SCOUT]')) { inSection = true; continue; }
    if (line.startsWith('[3') && !line.startsWith('[3SCOUT')) { inSection = false; continue; }
    if (!inSection || !line.trim()) continue;

    // Setbyte
    if (line.match(/^\*\*\d+set/)) {
      const setMatch = line.match(/^\*\*(\d+)set/);
      if (setMatch) currentSet = parseInt(setMatch[1], 10) + 1;
      continue;
    }

    // Poängrader: *pHH:AA eller apHH:AA (DVW explicit score lines)
    const scoreMatch = line.match(/^[*a]p(\d{2}):(\d{2})/);
    if (scoreMatch) {
      scoreEvents.push({
        afterActionIndex: actions.length - 1,
        set: currentSet,
        scoreH: parseInt(scoreMatch[1], 10),
        scoreV: parseInt(scoreMatch[2], 10)
      });
      continue;
    }

    // Scout-rad börjar med a eller * följt av 2 siffror
    if (!line.match(/^[a*]\d{2}/)) continue;

    const parts = line.split(';');
    if (parts.length < 8) continue;

    const timeStr = parts[7];
    if (!timeStr || !timeStr.match(/^\d+\.\d+\.\d+/)) continue;

    const frameNum = parseInt(parts[12], 10);
    const videoTime = (frameNum > 0) ? frameNum : null;

    const code = parts[0];
    // a = hemmalag (H), * = bortalag (V)
    const team = code[0] === 'a' ? 'V' : 'H';
    const playerNum = parseInt(code.substring(1, 3), 10);
    const skill = code[3];
    const grade = code[5] || '';

    if (!skill || !SKILL_MAP[skill]) continue;

    const player = players[team][playerNum];
    const skillName = SKILL_MAP[skill] || skill;
    const gradeName = GRADE_MAP[grade] || '';

    // Zondata från kodsträngen (DVW-format: pos 9 = startzon, pos 10 = slutzon)
    const startZoneChar = code.length > 9 && code[9] !== '~' ? parseInt(code[9], 10) : NaN;
    const endZoneChar = code.length > 10 && code[10] !== '~' ? parseInt(code[10], 10) : NaN;
    const startZone = (!isNaN(startZoneChar) && startZoneChar >= 1 && startZoneChar <= 9) ? startZoneChar : null;
    const endZone = (!isNaN(endZoneChar) && endZoneChar >= 1 && endZoneChar <= 9) ? endZoneChar : null;

    // Koordinatdata från parts (index 4=start, 5=mid, 6=end)
    const startCoord = parts.length > 4 ? parseCoordinate(parts[4]) : null;
    const endCoord = parts.length > 6 ? parseCoordinate(parts[6]) : null;

    actions.push({
      id: actions.length,
      set: currentSet,
      time: timeStr,
      videoTime: videoTime !== null ? Math.max(0, videoTime) : null,
      team,
      teamName: teams[team] || team,
      playerNumber: playerNum,
      playerName: player ? player.name : `#${playerNum}`,
      skill: SKILL_REMAP[skill] || skill,
      skillName,
      grade,
      gradeName,
      rawCode: code,
      startZone,
      endZone,
      startCoord,
      endCoord
    });
  }

  return { actions, scoreEvents };
};

// Beräkna poängställning per action från DVW score events (*pHH:AA / apHH:AA)
const calculateScoreboard = (actions, scoreEvents) => {
  const scoreAtAction = new Map();
  for (const se of scoreEvents) {
    const idx = Math.max(0, se.afterActionIndex);
    scoreAtAction.set(idx, { H: se.scoreH, V: se.scoreV });
  }

  const scoreboard = [];
  let currentScore = { H: 0, V: 0 };
  let currentSet = 1;

  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    if (a.set !== currentSet) {
      currentScore = { H: 0, V: 0 };
      currentSet = a.set;
    }
    if (scoreAtAction.has(i)) {
      currentScore = { ...scoreAtAction.get(i) };
    }
    scoreboard.push({
      id: a.id,
      set: a.set,
      setScore: { ...currentScore },
    });
  }

  return { scoreboard };
};

export const dvwParserService = {
  async parseFile(dvwPath, videoOffset = 0) {
    // Strippa leading slash om det finns (lagras så i DB)
    const cleaned = dvwPath.startsWith('/') ? dvwPath.slice(1) : dvwPath;
    const normalized = path.normalize(cleaned);
    if (normalized.startsWith('..')) {
      throw new Error('Invalid DVW path');
    }
    const absPath = path.join(STORAGE_PATH, normalized);
    const resolved = path.resolve(absPath);
    if (!resolved.startsWith(path.resolve(STORAGE_PATH))) {
      throw new Error('Path traversal attempt detected');
    }
    const content = await readFile(absPath, 'latin1');
    const lines = content.split('\n').map(l => l.trim()).filter(Boolean);

    const players = parsePlayers(lines);
    const teams = parseTeams(lines);
    const matchStartSeconds = parseMatchStart(lines);
    const { actions, scoreEvents } = parseScout(lines, players, teams, matchStartSeconds, videoOffset);
    const { scoreboard } = calculateScoreboard(actions, scoreEvents);

    // Platta ut spelare för frontend
    const allPlayers = [
      ...Object.values(players.H),
      ...Object.values(players.V)
    ];

    return { teams, players: allPlayers, matchStart: matchStartSeconds, actions, zonePositions: ZONE_POSITIONS, scoreboard };
  }
};
