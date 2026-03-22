# Football Stats Engine

A production-grade, zero-dependency TypeScript library for computing comprehensive American football statistics from play-by-play data.

Built to be the statistical backbone of any football application — from live game trackers and fantasy platforms to post-game analytics dashboards and coaching tools.

---

## Features

### Player Stats
| Category | Metrics |
|----------|---------|
| **Passing** | Comp/Att, Yards, TD, INT, Passer Rating, Adj. YPA, Air Yards, YAC, Time to Throw, Play Action splits, Screen splits, Pressure splits, Red Zone, 3rd Down |
| **Rushing** | Carries, Yards, YPC, TD, Long, Fumbles, YAC (after contact), Broken Tackles, Stuffed Runs, Directional splits (L/M/R), Red Zone, 3rd Down |
| **Receiving** | Targets, Receptions, Yards, TD, Catch%, YPR, YPT, Air Yards, YAC, Avg Depth of Target, Red Zone, 3rd Down |
| **Defense** | Tackles (solo/ast), Sacks (full/half), TFL, QB Hits, Pressures, INT, INT Yards, PD, FF, FR, Stuffs |
| **Kicking** | FG (with distance buckets), XP, Points, Kickoffs, Touchback%, Onside |
| **Punting** | Punts, Avg, Net Avg, Inside 20, Touchbacks, Hang Time |
| **Returns** | Kick Returns, Punt Returns, Yards, Avg, Long, TD, Fumbles |

### Team Stats
Total yards, passing/rushing yards, first downs (by type), 3rd/4th down conversion, red zone efficiency, turnovers, penalties, time of possession, yards per play, sacks taken, goal-to-go, two-point conversions.

### Game-Level
Drive summaries (plays, yards, time, result), scoring play log with running score, full game summary object.

---

## Quick Start

```typescript
import {
  FootballStatsEngine,
  PlayType, PassResult, Down, Quarter
} from "football-stats-engine";

const engine = new FootballStatsEngine();

engine.setTeams(
  { id: "KC", name: "Kansas City Chiefs", abbreviation: "KC" },
  { id: "SF", name: "San Francisco 49ers", abbreviation: "SF" }
);

engine.processPlay({
  type: PlayType.Pass,
  passer: "mahomes",
  target: "kelce",
  receiver: "kelce",
  result: PassResult.Complete,
  yardsGained: 15,
  airYards: 8,
  yardsAfterCatch: 7,
  isTouchdown: false,
  context: {
    gameId: "game-001",
    quarter: Quarter.First,
    gameClock: "12:30",
    down: Down.Second,
    distance: 10,
    yardLine: 35,
    possessionTeam: "KC",
    homeTeam: "KC",
    awayTeam: "SF",
    homeScore: 0,
    awayScore: 0,
  },
});

const summary = engine.getGameSummary();
console.log(summary.passing["mahomes"].passerRating);
console.log(summary.homeTeamStats.totalYards);
```

---

## Architecture

```
src/
├── types.ts                    # All type definitions, enums, interfaces
├── utils.ts                    # Passer rating, clock math, stat initializers
├── engine.ts                   # Main orchestrator (FootballStatsEngine)
├── index.ts                    # Public API barrel export
└── calculators/
    ├── passing.ts              # PassingCalculator
    ├── rushing.ts              # RushingCalculator
    ├── receiving.ts            # ReceivingCalculator
    ├── defense.ts              # DefensiveCalculator
    ├── special-teams.ts        # SpecialTeamsCalculator (kicking + punting + returns)
    └── team.ts                 # TeamCalculator (team stats + drives + scoring)
```

### Design Principles

- **Single-pass processing**: Each play is processed once through all calculators. O(n) time.
- **Stateful**: Maintains running totals. Call `getGameSummary()` at any point for live stats.
- **Modular calculators**: Each stat category has its own calculator class. Use the main engine or import calculators individually for custom pipelines.
- **Configurable depth**: Toggle advanced metrics, directional splits, and situational tracking.
- **Zero dependencies**: Pure TypeScript. Works in Node.js, browsers, React Native, Deno, Bun.

---

## Configuration

```typescript
const engine = new FootballStatsEngine({
  trackAdvancedMetrics: true,     // Air yards, YAC, pressure, time-to-throw
  trackDirectionalStats: true,    // Rush left/middle/right splits
  trackSituationalSplits: true,   // Red zone, 3rd down breakdowns
  trackDrives: true,              // Drive-by-drive summaries
  computePasserRating: true,      // NFL passer rating calculation
  resolvePlayerName: (id) => playerDb[id]?.name ?? id,
});
```

---

## Play Input Format

Every play is a typed object with a `context` block and play-specific fields:

```typescript
interface PlayContext {
  gameId: string;
  quarter: Quarter;          // 1-7 (includes OT)
  gameClock: string;         // "MM:SS"
  down: Down;                // 1-4
  distance: number;          // yards to go
  yardLine: number;          // 0-100 (own 0 to opponent endzone)
  possessionTeam: string;    // team ID
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  driveNumber?: number;      // enables drive tracking
  formation?: Formation;
  personnelOffense?: string; // "11", "12", "21", etc.
  // ... more optional fields
}
```

### Supported Play Types

| Play Type | Key Fields |
|-----------|-----------|
| `Pass` | passer, target, receiver, result (Complete/Incomplete/INT/Sack/Scramble), airYards, YAC, pressure, timeToThrow |
| `Rush` | rusher, direction, yardsAfterContact, brokenTackles, fumble |
| `Punt` | punter, returner, kickDistance, returnYards, hangTime |
| `Kickoff` | kicker, returner, kickDistance, returnYards, touchback, onside |
| `FieldGoal` | kicker, fieldGoalDistance, result (Good/NoGood/Blocked) |
| `ExtraPoint` | kicker, result |
| `Penalty` | penalties array with type, team, yards, enforcement |
| `Timeout` | calledBy (team) |

---

## Output: GameSummary

```typescript
const summary = engine.getGameSummary();

// Team-level
summary.homeTeamStats.totalYards
summary.awayTeamStats.thirdDownPercentage
summary.homeTeamStats.redZonePercentage

// Player-level (keyed by player ID)
summary.passing["mahomes"].passerRating
summary.rushing["barkley"].yardsPerCarry
summary.receiving["kelce"].catchPercentage
summary.defense["donald"].sacks
summary.kicking["butker"].fieldGoalPercentage
summary.punting["fox"].netPuntAverage
summary.returns["hardman"].kickReturnAverage

// Drives
summary.drives[0].yards
summary.drives[0].result // "touchdown" | "field_goal" | "punt" | ...

// Scoring timeline
summary.scoringPlays[0].description
summary.scoringPlays[0].homeScore
```

---

## Using Individual Calculators

For custom pipelines, import calculators directly:

```typescript
import { PassingCalculator } from "football-stats-engine";

const config = { trackAdvancedMetrics: true };
const calc = new PassingCalculator(config, (id) => id);

for (const play of myPlays) calc.process(play);
const passingStats = calc.finalize(); // Map<string, PassingStats>
```

---

## Utility Functions

```typescript
import {
  calculatePasserRating,  // NFL passer rating formula
  calculateAdjustedYPA,   // (yards + 20*TD - 45*INT) / attempts
  clockToSeconds,          // "12:30" → 750
  secondsToClock,          // 750 → "12:30"
  isRedZone,               // check if play is in red zone
  isThirdDown,             // check down
  isFirstDown,             // check if play gained a first down
} from "football-stats-engine";
```

---

## Integration Patterns

### Live Game Tracker
```typescript
// Process plays as they come in from your data feed
websocket.on("play", (playData) => {
  const play = transformToEngineFormat(playData);
  engine.processPlay(play);
  updateUI(engine.getGameSummary());
});
```

### Post-Game Analysis
```typescript
// Bulk load from a database
const plays = await db.query("SELECT * FROM plays WHERE game_id = ?", [gameId]);
engine.processPlays(plays.map(transformPlay));
const report = engine.getGameSummary();
```

### Fantasy Points Calculator
```typescript
const summary = engine.getGameSummary();
for (const [id, passing] of Object.entries(summary.passing)) {
  const rushing = summary.rushing[id];
  const points = passing.yards * 0.04 + passing.touchdowns * 4
    - passing.interceptions * 2 + (rushing?.yards ?? 0) * 0.1
    + (rushing?.touchdowns ?? 0) * 6;
  fantasyScores[id] = points;
}
```

---

## Data Source Adapters

The engine uses a generic play format. You'll need an adapter for your data source. Common sources:

- **NFL Game Center / Next Gen Stats**: Map their JSON to the engine's `Play` type
- **ESPN API**: Transform ESPN's play-by-play feed
- **SportRadar**: Map SportRadar's PBP events
- **Manual entry**: Build a UI that constructs plays

Example adapter skeleton:

```typescript
function fromESPN(espnPlay: ESPNPlay): Play {
  return {
    type: mapPlayType(espnPlay.type.id),
    context: {
      gameId: espnPlay.gameId,
      quarter: espnPlay.period.number,
      gameClock: espnPlay.clock.displayValue,
      down: espnPlay.start.down,
      distance: espnPlay.start.distance,
      yardLine: espnPlay.start.yardLine,
      possessionTeam: espnPlay.start.team.id,
      // ... etc
    },
    // ... map play-specific fields
  };
}
```

---

## License

MIT
