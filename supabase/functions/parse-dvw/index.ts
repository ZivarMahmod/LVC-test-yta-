// ===========================================
// LVC Media Hub — DVW Parser Edge Function
// Supabase Edge Function (Deno runtime)
// Parses DataVolley (.dvw) scout files from Supabase Storage.
// ===========================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SKILL_MAP: Record<string, string> = {
  S: "Serve",
  R: "Reception",
  E: "Pass",
  A: "Attack",
  B: "Block",
  D: "Dig",
  F: "Gratisboll",
  O: "Overpass",
};

const SKILL_REMAP: Record<string, string> = { E: "P", F: "G" };

const GRADE_MAP: Record<string, string> = {
  "#": "Perfekt",
  "+": "Positiv",
  "!": "OK",
  "-": "Negativ",
  "/": "Error",
  "=": "Error",
};

const ZONE_POSITIONS: Record<number, { x: number; y: number }> = {
  1: { x: 83, y: 75 },
  2: { x: 83, y: 25 },
  3: { x: 50, y: 25 },
  4: { x: 17, y: 25 },
  5: { x: 17, y: 75 },
  6: { x: 50, y: 75 },
  7: { x: 10, y: 50 },
  8: { x: 50, y: 10 },
  9: { x: 90, y: 50 },
};

interface Player {
  number: number;
  name: string;
  team: string;
}

interface Action {
  id: number;
  set: number;
  time: string;
  videoTime: number | null;
  team: string;
  teamName: string;
  playerNumber: number;
  playerName: string;
  skill: string;
  skillName: string;
  grade: string;
  gradeName: string;
  rawCode: string;
  startZone: number | null;
  endZone: number | null;
  startCoord: { x: number; y: number } | null;
  endCoord: { x: number; y: number } | null;
}

interface ScoreEvent {
  afterActionIndex: number;
  set: number;
  scoreH: number;
  scoreV: number;
}

function parseCoordinate(val: string): { x: number; y: number } | null {
  const num = parseInt(val, 10);
  if (isNaN(num) || num < 1 || num > 10000) return null;
  const x = (num - 1) % 100;
  const y = Math.floor((num - 1) / 100);
  return { x, y };
}

function timeToSeconds(timeStr: string): number | null {
  if (!timeStr) return null;
  const parts = timeStr.split(".");
  if (parts.length < 3) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  const s = parseInt(parts[2], 10);
  if (isNaN(h) || isNaN(m) || isNaN(s)) return null;
  return h * 3600 + m * 60 + s;
}

function parsePlayers(
  lines: string[]
): Record<string, Record<number, Player>> {
  const players: Record<string, Record<number, Player>> = { H: {}, V: {} };
  let currentTeam: string | null = null;

  for (const line of lines) {
    if (line.startsWith("[3PLAYERS-H]")) {
      currentTeam = "H";
      continue;
    }
    if (line.startsWith("[3PLAYERS-V]")) {
      currentTeam = "V";
      continue;
    }
    if (line.startsWith("[3") && !line.startsWith("[3PLAYERS")) {
      currentTeam = null;
      continue;
    }
    if (!currentTeam || !line.trim()) continue;

    const parts = line.split(";");
    if (parts.length < 11) continue;

    const number = parseInt(parts[1], 10);
    const lastName = parts[9] || "";
    const firstName = parts[10] || "";
    const name = `${firstName} ${lastName}`.trim();

    players[currentTeam][number] = { number, name, team: currentTeam };
  }
  return players;
}

function parseTeams(lines: string[]): Record<string, string> {
  const teams: Record<string, string> = { H: "Hemmalag", V: "Bortalag" };
  let inSection = false;
  let count = 0;

  for (const line of lines) {
    if (line.startsWith("[3TEAMS]")) {
      inSection = true;
      continue;
    }
    if (line.startsWith("[3") && !line.startsWith("[3TEAMS")) {
      inSection = false;
      continue;
    }
    if (!inSection || !line.trim()) continue;

    const parts = line.split(";");
    if (parts.length < 2) continue;
    if (count === 0) teams.H = parts[1];
    if (count === 1) teams.V = parts[1];
    count++;
  }
  return teams;
}

function parseMatchStart(lines: string[]): number | null {
  let inSection = false;
  for (const line of lines) {
    if (line.startsWith("[3MATCH]")) {
      inSection = true;
      continue;
    }
    if (line.startsWith("[3") && !line.startsWith("[3MATCH")) {
      inSection = false;
      continue;
    }
    if (!inSection || !line.trim()) continue;

    const parts = line.split(";");
    if (parts.length >= 2) {
      return timeToSeconds(parts[1]);
    }
  }
  return null;
}

function parseScout(
  lines: string[],
  players: Record<string, Record<number, Player>>,
  teams: Record<string, string>
): { actions: Action[]; scoreEvents: ScoreEvent[] } {
  const actions: Action[] = [];
  const scoreEvents: ScoreEvent[] = [];
  let inSection = false;
  let currentSet = 1;

  for (const line of lines) {
    if (line.startsWith("[3SCOUT]")) {
      inSection = true;
      continue;
    }
    if (line.startsWith("[3") && !line.startsWith("[3SCOUT")) {
      inSection = false;
      continue;
    }
    if (!inSection || !line.trim()) continue;

    // Set change
    if (line.match(/^\*\*\d+set/)) {
      const setMatch = line.match(/^\*\*(\d+)set/);
      if (setMatch) currentSet = parseInt(setMatch[1], 10) + 1;
      continue;
    }

    // Score lines: *pHH:AA or apHH:AA
    const scoreMatch = line.match(/^[*a]p(\d{2}):(\d{2})/);
    if (scoreMatch) {
      scoreEvents.push({
        afterActionIndex: actions.length - 1,
        set: currentSet,
        scoreH: parseInt(scoreMatch[1], 10),
        scoreV: parseInt(scoreMatch[2], 10),
      });
      continue;
    }

    // Scout line starts with a or * followed by 2 digits
    if (!line.match(/^[a*]\d{2}/)) continue;

    const parts = line.split(";");
    if (parts.length < 8) continue;

    const timeStr = parts[7];
    if (!timeStr || !timeStr.match(/^\d+\.\d+\.\d+/)) continue;

    const frameNum = parseInt(parts[12], 10);
    const videoTime = frameNum > 0 ? frameNum : null;

    const code = parts[0];
    const team = code[0] === "a" ? "V" : "H";
    const playerNum = parseInt(code.substring(1, 3), 10);
    const skill = code[3];
    const grade = code[5] || "";

    if (!skill || !SKILL_MAP[skill]) continue;

    const player = players[team][playerNum];
    const skillName = SKILL_MAP[skill] || skill;
    const gradeName = GRADE_MAP[grade] || "";

    const startZoneChar =
      code.length > 9 && code[9] !== "~" ? parseInt(code[9], 10) : NaN;
    const endZoneChar =
      code.length > 10 && code[10] !== "~" ? parseInt(code[10], 10) : NaN;
    const startZone =
      !isNaN(startZoneChar) && startZoneChar >= 1 && startZoneChar <= 9
        ? startZoneChar
        : null;
    const endZone =
      !isNaN(endZoneChar) && endZoneChar >= 1 && endZoneChar <= 9
        ? endZoneChar
        : null;

    const startCoord =
      parts.length > 4 ? parseCoordinate(parts[4]) : null;
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
      endCoord,
    });
  }

  return { actions, scoreEvents };
}

function calculateScoreboard(
  actions: Action[],
  scoreEvents: ScoreEvent[]
): { set: number; setScore: { H: number; V: number } }[] {
  const scoreAtAction = new Map<
    number,
    { H: number; V: number }
  >();
  for (const se of scoreEvents) {
    const idx = Math.max(0, se.afterActionIndex);
    scoreAtAction.set(idx, { H: se.scoreH, V: se.scoreV });
  }

  const scoreboard: { id: number; set: number; setScore: { H: number; V: number } }[] = [];
  let currentScore = { H: 0, V: 0 };
  let currentSet = 1;

  for (let i = 0; i < actions.length; i++) {
    const a = actions[i];
    if (a.set !== currentSet) {
      currentScore = { H: 0, V: 0 };
      currentSet = a.set;
    }
    if (scoreAtAction.has(i)) {
      currentScore = { ...scoreAtAction.get(i)! };
    }
    scoreboard.push({
      id: a.id,
      set: a.set,
      setScore: { ...currentScore },
    });
  }

  return scoreboard;
}

function parseDvwContent(content: string) {
  const lines = content
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const players = parsePlayers(lines);
  const teams = parseTeams(lines);
  const matchStartSeconds = parseMatchStart(lines);
  const { actions, scoreEvents } = parseScout(lines, players, teams);
  const scoreboard = calculateScoreboard(actions, scoreEvents);

  const allPlayers = [
    ...Object.values(players.H),
    ...Object.values(players.V),
  ];

  return {
    teams,
    players: allPlayers,
    matchStart: matchStartSeconds,
    actions,
    zonePositions: ZONE_POSITIONS,
    scoreboard,
  };
}

// Edge Function handler
Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { dvwPath, dvwContent, videoOffset } = await req.json();

    let content: string;

    if (dvwContent) {
      // Direct content provided (for client-side parsed files)
      content = dvwContent;
    } else if (dvwPath) {
      // Fetch from Supabase Storage
      const authHeader = req.headers.get("Authorization");
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

      const supabase = createClient(supabaseUrl, supabaseKey, {
        global: {
          headers: authHeader ? { Authorization: authHeader } : {},
        },
      });

      const { data, error } = await supabase.storage
        .from("dvw-files")
        .download(dvwPath);

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: "Kunde inte ladda DVW-fil" }),
          {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }

      content = await data.text();
    } else {
      return new Response(
        JSON.stringify({ error: "dvwPath eller dvwContent krävs" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const result = parseDvwContent(content);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message || "Parsningsfel" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
