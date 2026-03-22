// ============================================================================
// EXAMPLE: Full game simulation showing engine usage
// ============================================================================
//
// Run: npx tsx examples/demo.ts
// ============================================================================

import {
  FootballStatsEngine,
  PlayType, PassResult, RushResult, SpecialTeamsResult, KickResult,
  Down, Quarter, Direction, PassDepth, PassLocation, Formation,
  Play,
} from "../src/index";

// ---------------------------------------------------------------------------
// 1. CREATE ENGINE
// ---------------------------------------------------------------------------

const engine = new FootballStatsEngine({
  trackAdvancedMetrics: true,
  trackDirectionalStats: true,
  trackSituationalSplits: true,
  trackDrives: true,
});

// ---------------------------------------------------------------------------
// 2. SET TEAMS
// ---------------------------------------------------------------------------

engine.setTeams(
  { id: "KC", name: "Kansas City Chiefs", abbreviation: "KC" },
  { id: "PHI", name: "Philadelphia Eagles", abbreviation: "PHI" }
);

// ---------------------------------------------------------------------------
// 3. REGISTER PLAYERS (optional but recommended)
// ---------------------------------------------------------------------------

engine.registerPlayers([
  { id: "mahomes", name: "Patrick Mahomes" },
  { id: "kelce", name: "Travis Kelce" },
  { id: "worthy", name: "Xavier Worthy" },
  { id: "pacheco", name: "Isiah Pacheco" },
  { id: "butker", name: "Harrison Butker" },
  { id: "townsend", name: "Tommy Townsend" },
  { id: "hurts", name: "Jalen Hurts" },
  { id: "brown", name: "A.J. Brown" },
  { id: "smith", name: "DeVonta Smith" },
  { id: "barkley", name: "Saquon Barkley" },
  { id: "elliott", name: "Jake Elliott" },
  { id: "siposs", name: "Arryn Siposs" },
  { id: "karlaftis", name: "George Karlaftis" },
  { id: "jones", name: "Chris Jones" },
  { id: "sneed", name: "L'Jarius Sneed" },
]);

// ---------------------------------------------------------------------------
// 4. FEED PLAYS — Simulated opening drive
// ---------------------------------------------------------------------------

const plays: Play[] = [
  // KC receives kickoff
  {
    type: PlayType.Kickoff,
    kicker: "elliott",
    returner: "worthy",
    result: SpecialTeamsResult.Normal,
    kickDistance: 65,
    returnYards: 28,
    isTouchback: false,
    context: {
      gameId: "SB-LIX", quarter: Quarter.First, gameClock: "15:00",
      down: Down.First, distance: 10, yardLine: 0,
      possessionTeam: "PHI", homeTeam: "KC", awayTeam: "PHI",
      homeScore: 0, awayScore: 0, driveNumber: 0,
    },
  } as Play,

  // KC 1st & 10 — Pass complete to Kelce
  {
    type: PlayType.Pass,
    passer: "mahomes",
    target: "kelce",
    receiver: "kelce",
    result: PassResult.Complete,
    yardsGained: 12,
    airYards: 6,
    yardsAfterCatch: 6,
    isTouchdown: false,
    isPlayAction: true,
    timeToThrow: 2.8,
    passDepth: PassDepth.Short,
    passLocation: PassLocation.Middle,
    tackledBy: ["sneed"],
    context: {
      gameId: "SB-LIX", quarter: Quarter.First, gameClock: "14:45",
      down: Down.First, distance: 10, yardLine: 28,
      possessionTeam: "KC", homeTeam: "KC", awayTeam: "PHI",
      homeScore: 0, awayScore: 0, driveNumber: 1, playNumberInDrive: 1,
      formation: Formation.Shotgun, personnelOffense: "11",
    },
  } as Play,

  // KC 1st & 10 — Rush by Pacheco
  {
    type: PlayType.Rush,
    rusher: "pacheco",
    result: RushResult.Normal,
    yardsGained: 6,
    isTouchdown: false,
    direction: Direction.RightTackle,
    yardsAfterContact: 3,
    brokenTackles: 1,
    tackledBy: ["karlaftis"],
    context: {
      gameId: "SB-LIX", quarter: Quarter.First, gameClock: "14:10",
      down: Down.First, distance: 10, yardLine: 40,
      possessionTeam: "KC", homeTeam: "KC", awayTeam: "PHI",
      homeScore: 0, awayScore: 0, driveNumber: 1, playNumberInDrive: 2,
      formation: Formation.Singleback, personnelOffense: "12",
    },
  } as Play,

  // KC 2nd & 4 — Pass incomplete to Worthy
  {
    type: PlayType.Pass,
    passer: "mahomes",
    target: "worthy",
    result: PassResult.Incomplete,
    yardsGained: 0,
    airYards: 22,
    isTouchdown: false,
    isUnderPressure: true,
    timeToThrow: 3.5,
    passDepth: PassDepth.Deep,
    passLocation: PassLocation.Left,
    context: {
      gameId: "SB-LIX", quarter: Quarter.First, gameClock: "13:30",
      down: Down.Second, distance: 4, yardLine: 46,
      possessionTeam: "KC", homeTeam: "KC", awayTeam: "PHI",
      homeScore: 0, awayScore: 0, driveNumber: 1, playNumberInDrive: 3,
      formation: Formation.Shotgun, personnelOffense: "11",
    },
  } as Play,

  // KC 3rd & 4 — Pass complete to Worthy for first down
  {
    type: PlayType.Pass,
    passer: "mahomes",
    target: "worthy",
    receiver: "worthy",
    result: PassResult.Complete,
    yardsGained: 18,
    airYards: 12,
    yardsAfterCatch: 6,
    isTouchdown: false,
    timeToThrow: 2.1,
    passDepth: PassDepth.Medium,
    passLocation: PassLocation.Right,
    tackledBy: ["sneed"],
    context: {
      gameId: "SB-LIX", quarter: Quarter.First, gameClock: "12:55",
      down: Down.Third, distance: 4, yardLine: 46,
      possessionTeam: "KC", homeTeam: "KC", awayTeam: "PHI",
      homeScore: 0, awayScore: 0, driveNumber: 1, playNumberInDrive: 4,
      formation: Formation.Shotgun, personnelOffense: "11",
    },
  } as Play,

  // KC 1st & 10 — Rush by Pacheco for TD
  {
    type: PlayType.Rush,
    rusher: "pacheco",
    result: RushResult.Touchdown,
    yardsGained: 36,
    isTouchdown: true,
    direction: Direction.LeftTackle,
    yardsAfterContact: 12,
    brokenTackles: 2,
    context: {
      gameId: "SB-LIX", quarter: Quarter.First, gameClock: "12:20",
      down: Down.First, distance: 10, yardLine: 64,
      possessionTeam: "KC", homeTeam: "KC", awayTeam: "PHI",
      homeScore: 0, awayScore: 0, driveNumber: 1, playNumberInDrive: 5,
      isRedZone: false,
      formation: Formation.IFormation, personnelOffense: "21",
    },
    description: "I. Pacheco 36 yd rush TD",
  } as Play,

  // Extra point
  {
    type: PlayType.ExtraPoint,
    kicker: "butker",
    result: KickResult.Good,
    context: {
      gameId: "SB-LIX", quarter: Quarter.First, gameClock: "12:15",
      down: Down.First, distance: 0, yardLine: 98,
      possessionTeam: "KC", homeTeam: "KC", awayTeam: "PHI",
      homeScore: 6, awayScore: 0, driveNumber: 1, playNumberInDrive: 6,
    },
  } as Play,

  // -----------------------------------------------------------------------
  // PHI opening drive — passes
  // -----------------------------------------------------------------------

  // Kickoff to PHI
  {
    type: PlayType.Kickoff,
    kicker: "butker",
    result: SpecialTeamsResult.Touchback,
    kickDistance: 72,
    isTouchback: true,
    context: {
      gameId: "SB-LIX", quarter: Quarter.First, gameClock: "12:15",
      down: Down.First, distance: 10, yardLine: 0,
      possessionTeam: "KC", homeTeam: "KC", awayTeam: "PHI",
      homeScore: 7, awayScore: 0, driveNumber: 2,
    },
  } as Play,

  // PHI 1st & 10 — Pass to Brown
  {
    type: PlayType.Pass,
    passer: "hurts",
    target: "brown",
    receiver: "brown",
    result: PassResult.Complete,
    yardsGained: 22,
    airYards: 18,
    yardsAfterCatch: 4,
    isTouchdown: false,
    timeToThrow: 3.0,
    passDepth: PassDepth.Medium,
    passLocation: PassLocation.Left,
    tackledBy: ["sneed"],
    context: {
      gameId: "SB-LIX", quarter: Quarter.First, gameClock: "12:05",
      down: Down.First, distance: 10, yardLine: 25,
      possessionTeam: "PHI", homeTeam: "KC", awayTeam: "PHI",
      homeScore: 7, awayScore: 0, driveNumber: 2, playNumberInDrive: 1,
      formation: Formation.Shotgun, personnelOffense: "11",
    },
  } as Play,

  // PHI 1st & 10 — Sack by Jones
  {
    type: PlayType.Pass,
    passer: "hurts",
    result: PassResult.Sack,
    yardsGained: -8,
    isTouchdown: false,
    isUnderPressure: true,
    tackledBy: ["jones"],
    context: {
      gameId: "SB-LIX", quarter: Quarter.First, gameClock: "11:30",
      down: Down.First, distance: 10, yardLine: 47,
      possessionTeam: "PHI", homeTeam: "KC", awayTeam: "PHI",
      homeScore: 7, awayScore: 0, driveNumber: 2, playNumberInDrive: 2,
    },
  } as Play,

  // PHI 2nd & 18 — Rush by Barkley
  {
    type: PlayType.Rush,
    rusher: "barkley",
    result: RushResult.Normal,
    yardsGained: 11,
    isTouchdown: false,
    direction: Direction.LeftGuard,
    yardsAfterContact: 5,
    brokenTackles: 1,
    tackledBy: ["karlaftis"],
    context: {
      gameId: "SB-LIX", quarter: Quarter.First, gameClock: "10:55",
      down: Down.Second, distance: 18, yardLine: 39,
      possessionTeam: "PHI", homeTeam: "KC", awayTeam: "PHI",
      homeScore: 7, awayScore: 0, driveNumber: 2, playNumberInDrive: 3,
    },
  } as Play,

  // PHI 3rd & 7 — Pass to Smith, TD!
  {
    type: PlayType.Pass,
    passer: "hurts",
    target: "smith",
    receiver: "smith",
    result: PassResult.Complete,
    yardsGained: 50,
    airYards: 35,
    yardsAfterCatch: 15,
    isTouchdown: true,
    timeToThrow: 2.9,
    passDepth: PassDepth.Deep,
    passLocation: PassLocation.Right,
    context: {
      gameId: "SB-LIX", quarter: Quarter.First, gameClock: "10:20",
      down: Down.Third, distance: 7, yardLine: 50,
      possessionTeam: "PHI", homeTeam: "KC", awayTeam: "PHI",
      homeScore: 7, awayScore: 0, driveNumber: 2, playNumberInDrive: 4,
    },
    description: "J. Hurts pass to D. Smith 50 yd TD",
  } as Play,

  // Extra point PHI
  {
    type: PlayType.ExtraPoint,
    kicker: "elliott",
    result: KickResult.Good,
    context: {
      gameId: "SB-LIX", quarter: Quarter.First, gameClock: "10:15",
      down: Down.First, distance: 0, yardLine: 98,
      possessionTeam: "PHI", homeTeam: "KC", awayTeam: "PHI",
      homeScore: 7, awayScore: 6, driveNumber: 2, playNumberInDrive: 5,
    },
  } as Play,
];

// ---------------------------------------------------------------------------
// 5. PROCESS ALL PLAYS
// ---------------------------------------------------------------------------

engine.processPlays(plays);

// ---------------------------------------------------------------------------
// 6. GET RESULTS
// ---------------------------------------------------------------------------

const summary = engine.getGameSummary();

console.log("=".repeat(70));
console.log("GAME SUMMARY");
console.log("=".repeat(70));
console.log(`${summary.homeTeam.name} ${summary.homeScore} — ${summary.awayTeam.name} ${summary.awayScore}`);
console.log(`Quarter: ${summary.quarter} | Clock: ${summary.gameClock}`);
console.log(`Total plays processed: ${summary.totalPlays}`);

console.log("\n--- PASSING LEADERS ---");
for (const [id, stat] of Object.entries(summary.passing)) {
  console.log(
    `${stat.playerName}: ${stat.completions}/${stat.attempts}, ${stat.yards} yds, ` +
    `${stat.touchdowns} TD, ${stat.interceptions} INT | Rating: ${stat.passerRating}`
  );
  if (stat.playActionAttempts > 0) {
    console.log(`  Play Action: ${stat.playActionCompletions}/${stat.playActionAttempts}, ${stat.playActionYards} yds`);
  }
  if (stat.thirdDownAttempts > 0) {
    console.log(`  3rd Down: ${stat.thirdDownCompletions}/${stat.thirdDownAttempts}, ${stat.thirdDownConversions} conv`);
  }
}

console.log("\n--- RUSHING LEADERS ---");
for (const [id, stat] of Object.entries(summary.rushing)) {
  console.log(
    `${stat.playerName}: ${stat.carries} car, ${stat.yards} yds (${stat.yardsPerCarry} avg), ` +
    `${stat.touchdowns} TD | Long: ${stat.longRush}`
  );
  if (stat.yardsAfterContact > 0) {
    console.log(`  Yards After Contact: ${stat.yardsAfterContact} | Broken Tackles: ${stat.brokenTackles}`);
  }
}

console.log("\n--- RECEIVING LEADERS ---");
for (const [id, stat] of Object.entries(summary.receiving)) {
  console.log(
    `${stat.playerName}: ${stat.receptions}/${stat.targets} tgt, ${stat.yards} yds, ` +
    `${stat.touchdowns} TD | YAC: ${stat.yardsAfterCatch}`
  );
}

console.log("\n--- DEFENSIVE LEADERS ---");
for (const [id, stat] of Object.entries(summary.defense)) {
  const parts = [];
  if (stat.totalTackles > 0) parts.push(`${stat.totalTackles} tkl`);
  if (stat.sacks > 0) parts.push(`${stat.sacks} sack`);
  if (stat.interceptions > 0) parts.push(`${stat.interceptions} INT`);
  if (stat.forcedFumbles > 0) parts.push(`${stat.forcedFumbles} FF`);
  if (parts.length > 0) {
    console.log(`${stat.playerName}: ${parts.join(", ")}`);
  }
}

console.log("\n--- KICKING ---");
for (const [id, stat] of Object.entries(summary.kicking)) {
  const parts = [];
  if (stat.fieldGoalAttempts > 0) parts.push(`FG: ${stat.fieldGoalMade}/${stat.fieldGoalAttempts}`);
  if (stat.extraPointAttempts > 0) parts.push(`XP: ${stat.extraPointMade}/${stat.extraPointAttempts}`);
  if (stat.kickoffs > 0) parts.push(`KO: ${stat.kickoffs} (${stat.kickoffTouchbackPercentage}% TB)`);
  console.log(`${stat.playerName}: ${parts.join(" | ")}`);
}

console.log("\n--- TEAM STATS ---");
for (const teamStat of [summary.homeTeamStats, summary.awayTeamStats]) {
  console.log(`\n${teamStat.teamName}:`);
  console.log(`  Total Yards: ${teamStat.totalYards} (${teamStat.passingYards} pass, ${teamStat.rushingYards} rush)`);
  console.log(`  First Downs: ${teamStat.firstDowns} (${teamStat.firstDownsPassing}P, ${teamStat.firstDownsRushing}R, ${teamStat.firstDownsPenalty}Pen)`);
  console.log(`  3rd Down: ${teamStat.thirdDownConversions}/${teamStat.thirdDownAttempts} (${teamStat.thirdDownPercentage}%)`);
  console.log(`  Turnovers: ${teamStat.turnovers}`);
  console.log(`  Penalties: ${teamStat.penalties} for ${teamStat.penaltyYards} yds`);
  console.log(`  Plays: ${teamStat.totalPlays} | YPP: ${teamStat.yardsPerPlay}`);
}

console.log("\n--- SCORING PLAYS ---");
for (const sp of summary.scoringPlays) {
  console.log(`  Q${sp.quarter} ${sp.gameClock} — ${sp.description || sp.playType} (${sp.pointsScored} pts) → ${sp.homeScore}-${sp.awayScore}`);
}

console.log("\n--- DRIVES ---");
for (const d of summary.drives) {
  console.log(`  Drive #${d.driveNumber} (${d.team}): ${d.plays} plays, ${d.yards} yds, ${d.timeOfPossession} | Result: ${d.result}`);
}

console.log("\n" + "=".repeat(70));
console.log("Engine processed successfully. All stats computed.");
console.log("=".repeat(70));
