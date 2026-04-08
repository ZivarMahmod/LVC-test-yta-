// ===========================================
// Kvittra — Parse DVW and store actions
// Downloads DVW from storage, parses it,
// stores each action in kvittra.actions table.
// Replaces the old parse-dvw function for Kvittra
// (the old one still works for the LVC single-tenant mode).
// ===========================================
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

const SKILL_MAP: Record<string, string> = {
  S: "S", R: "R", E: "P", A: "A",
  B: "B", D: "D", F: "G", O: "O",
};

const RESULT_MAP: Record<string, string> = {
  "#": "#", "+": "+", "!": "!", "-": "-", "/": "/", "=": "/",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { matchId, orgId, dvwPath, dvwContent } = await req.json();

    if (!matchId || !orgId) {
      return new Response(
        JSON.stringify({ error: "matchId och orgId krävs" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get DVW content
    let content: string;
    if (dvwContent) {
      content = dvwContent;
    } else if (dvwPath) {
      const { data, error } = await supabase.storage
        .from("dvw-files")
        .download(dvwPath);
      if (error || !data) {
        return new Response(
          JSON.stringify({ error: "Kunde inte ladda DVW-fil" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      content = await data.text();
    } else {
      return new Response(
        JSON.stringify({ error: "dvwPath eller dvwContent krävs" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const lines = content.split("\n").map((l) => l.trim()).filter(Boolean);

    // Parse players
    const players: Record<string, Record<number, string>> = { H: {}, V: {} };
    let currentTeam: string | null = null;
    for (const line of lines) {
      if (line.startsWith("[3PLAYERS-H]")) { currentTeam = "H"; continue; }
      if (line.startsWith("[3PLAYERS-V]")) { currentTeam = "V"; continue; }
      if (line.startsWith("[3") && !line.startsWith("[3PLAYERS")) { currentTeam = null; continue; }
      if (!currentTeam || !line.trim()) continue;
      const parts = line.split(";");
      if (parts.length < 11) continue;
      const num = parseInt(parts[1], 10);
      const name = `${parts[10] || ""} ${parts[9] || ""}`.trim();
      players[currentTeam][num] = name;
    }

    // Parse teams
    const teams: Record<string, string> = { H: "Hemmalag", V: "Bortalag" };
    let inTeams = false;
    let teamCount = 0;
    for (const line of lines) {
      if (line.startsWith("[3TEAMS]")) { inTeams = true; continue; }
      if (line.startsWith("[3") && !line.startsWith("[3TEAMS")) { inTeams = false; continue; }
      if (!inTeams || !line.trim()) continue;
      const parts = line.split(";");
      if (parts.length < 2) continue;
      if (teamCount === 0) teams.H = parts[1];
      if (teamCount === 1) teams.V = parts[1];
      teamCount++;
    }

    // Parse scout actions
    const actions: any[] = [];
    let inScout = false;
    let currentSet = 1;

    for (const line of lines) {
      if (line.startsWith("[3SCOUT]")) { inScout = true; continue; }
      if (line.startsWith("[3") && !line.startsWith("[3SCOUT")) { inScout = false; continue; }
      if (!inScout || !line.trim()) continue;

      if (line.match(/^\*\*\d+set/)) {
        const m = line.match(/^\*\*(\d+)set/);
        if (m) currentSet = parseInt(m[1], 10) + 1;
        continue;
      }

      if (!line.match(/^[a*]\d{2}/)) continue;
      const parts = line.split(";");
      if (parts.length < 8) continue;

      const timeStr = parts[7];
      if (!timeStr || !timeStr.match(/^\d+\.\d+\.\d+/)) continue;

      const code = parts[0];
      const team = code[0] === "a" ? "V" : "H";
      const playerNum = parseInt(code.substring(1, 3), 10);
      const skill = code[3];
      const grade = code[5] || "";

      if (!skill || !SKILL_MAP[skill]) continue;

      const frameNum = parseInt(parts[12], 10);
      const videoTime = frameNum > 0 ? frameNum : null;

      const startZone = code.length > 9 && code[9] !== "~" ? parseInt(code[9], 10) : null;
      const endZone = code.length > 10 && code[10] !== "~" ? parseInt(code[10], 10) : null;

      actions.push({
        match_id: matchId,
        org_id: orgId,
        player_name: players[team]?.[playerNum] || `#${playerNum}`,
        team_name: teams[team] || team,
        action_type: SKILL_MAP[skill],
        result: RESULT_MAP[grade] || null,
        zone_start: startZone && startZone >= 1 && startZone <= 9 ? startZone : null,
        zone_end: endZone && endZone >= 1 && endZone <= 9 ? endZone : null,
        set_number: currentSet,
        timestamp_sec: videoTime,
        raw_code: code,
      });
    }

    // Delete old actions for this match (re-parse scenario)
    await supabase
      .schema("kvittra" as any)
      .from("actions")
      .delete()
      .eq("match_id", matchId);

    // Insert in batches of 500
    let inserted = 0;
    for (let i = 0; i < actions.length; i += 500) {
      const batch = actions.slice(i, i + 500);
      const { error } = await supabase
        .schema("kvittra" as any)
        .from("actions")
        .insert(batch);
      if (error) {
        // Fallback without schema
        const { error: fbErr } = await supabase
          .from("actions")
          .insert(batch);
        if (fbErr) {
          console.error("Insert error:", fbErr);
          continue;
        }
      }
      inserted += batch.length;
    }

    return new Response(
      JSON.stringify({
        success: true,
        actionsCount: inserted,
        teams,
        playerCount: Object.keys(players.H).length + Object.keys(players.V).length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
