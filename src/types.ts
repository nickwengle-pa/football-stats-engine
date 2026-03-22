// ============================================================================
// FOOTBALL STATS ENGINE — TYPE DEFINITIONS
// ============================================================================

// ---------------------------------------------------------------------------
// ENUMS
// ---------------------------------------------------------------------------

export enum PlayType {
  Pass = "pass",
  Rush = "rush",
  Punt = "punt",
  Kickoff = "kickoff",
  FieldGoal = "field_goal",
  ExtraPoint = "extra_point",
  TwoPointConversion = "two_point_conversion",
  Kneel = "kneel",
  Spike = "spike",
  Penalty = "penalty",
  Timeout = "timeout",
  FreeKick = "free_kick",
  FairCatch = "fair_catch",
  NoPlay = "no_play",
}

export enum PassResult {
  Complete = "complete",
  Incomplete = "incomplete",
  Interception = "interception",
  Sack = "sack",
  Scramble = "scramble",
  ThrowAway = "throw_away",
  BattedDown = "batted_down",
  SpikeBall = "spike",
}

export enum RushResult {
  Normal = "normal",
  Fumble = "fumble",
  Touchdown = "touchdown",
  Kneel = "kneel",
}

export enum SpecialTeamsResult {
  Normal = "normal",
  Touchback = "touchback",
  FairCatch = "fair_catch",
  Muff = "muff",
  Block = "block",
  OutOfBounds = "out_of_bounds",
  ReturnTouchdown = "return_touchdown",
}

export enum KickResult {
  Good = "good",
  NoGood = "no_good",
  Blocked = "blocked",
}

export enum PenaltyEnforcement {
  Accepted = "accepted",
  Declined = "declined",
  Offset = "offset",
}

export enum Down {
  First = 1,
  Second = 2,
  Third = 3,
  Fourth = 4,
}

export enum Quarter {
  First = 1,
  Second = 2,
  Third = 3,
  Fourth = 4,
  OT1 = 5,
  OT2 = 6,
  OT3 = 7,
}

export enum Direction {
  Left = "left",
  LeftTackle = "left_tackle",
  LeftGuard = "left_guard",
  Middle = "middle",
  RightGuard = "right_guard",
  RightTackle = "right_tackle",
  Right = "right",
}

export enum PassDepth {
  BehindLOS = "behind_los",
  Short = "short",       // 0-9 yards
  Medium = "medium",     // 10-19 yards
  Deep = "deep",         // 20+ yards
}

export enum PassLocation {
  Left = "left",
  Middle = "middle",
  Right = "right",
}

export enum Formation {
  Shotgun = "shotgun",
  UnderCenter = "under_center",
  Pistol = "pistol",
  Singleback = "singleback",
  IFormation = "i_formation",
  EmptyBackfield = "empty",
  Wildcat = "wildcat",
  Goal = "goal_line",
  Jumbo = "jumbo",
}

export enum CoverageScheme {
  Cover0 = "cover_0",
  Cover1 = "cover_1",
  Cover2 = "cover_2",
  Cover2Man = "cover_2_man",
  Cover3 = "cover_3",
  Cover4 = "cover_4",
  Cover6 = "cover_6",
  ManToMan = "man",
  Zone = "zone",
  PreventDefense = "prevent",
}

// ---------------------------------------------------------------------------
// PLAYER & TEAM IDENTIFIERS
// ---------------------------------------------------------------------------

export interface PlayerId {
  id: string;
  name: string;
  number?: number;
  position?: string;
  teamId: string;
}

export interface TeamId {
  id: string;
  name: string;
  abbreviation: string;
}

// ---------------------------------------------------------------------------
// PLAY-BY-PLAY INPUT — THE CORE INPUT TO THE ENGINE
// ---------------------------------------------------------------------------

export interface PlayContext {
  gameId: string;
  quarter: Quarter;
  gameClock: string;           // "MM:SS"
  playClock?: number;          // seconds remaining on play clock
  down: Down;
  distance: number;            // yards to go
  yardLine: number;            // 1-50 (own territory) or 50-99 (opponent territory)
  possessionTeam: string;      // teamId
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  driveNumber?: number;
  playNumberInDrive?: number;
  playNumberInGame?: number;
  isRedZone?: boolean;         // derived if yardLine >= 80
  isGoalToGo?: boolean;
  isNoHuddle?: boolean;
  isTwoMinuteWarning?: boolean;
  formation?: Formation;
  personnelOffense?: string;   // e.g. "11" (1 RB, 1 TE), "12", "21", etc.
  personnelDefense?: string;   // e.g. "4-3", "3-4", "nickel", "dime"
  coverageScheme?: CoverageScheme;
}

export interface PassPlay {
  type: PlayType.Pass;
  passer: string;              // playerId
  result: PassResult;
  target?: string;             // playerId (receiver)
  receiver?: string;           // playerId (if complete)
  yardsGained: number;
  airYards?: number;           // yards from LOS to catch point
  yardsAfterCatch?: number;    // YAC
  isTouchdown: boolean;
  isTwoPointConversion?: boolean;
  passDepth?: PassDepth;
  passLocation?: PassLocation;
  isUnderPressure?: boolean;
  timeToThrow?: number;        // seconds
  isPlayAction?: boolean;
  isScreenPass?: boolean;
  isRPO?: boolean;             // run-pass option
  interceptedBy?: string;      // playerId
  interceptionReturnYards?: number;
  fumble?: FumbleEvent;
  penalties?: PenaltyEvent[];
  tackledBy?: string[];        // playerIds
  assistedTackle?: string[];
  forcedOutOfBounds?: boolean;
  description?: string;
}

export interface RushPlay {
  type: PlayType.Rush;
  rusher: string;              // playerId
  result: RushResult;
  yardsGained: number;
  isTouchdown: boolean;
  isTwoPointConversion?: boolean;
  direction?: Direction;
  yardsAfterContact?: number;
  brokenTackles?: number;
  isKneel?: boolean;
  isQBScramble?: boolean;
  fumble?: FumbleEvent;
  penalties?: PenaltyEvent[];
  tackledBy?: string[];
  assistedTackle?: string[];
  description?: string;
}

export interface SpecialTeamsPlay {
  type: PlayType.Punt | PlayType.Kickoff | PlayType.FieldGoal | PlayType.ExtraPoint | PlayType.FreeKick;
  kicker?: string;             // playerId
  punter?: string;             // playerId
  returner?: string;           // playerId
  result: SpecialTeamsResult | KickResult;
  kickDistance?: number;
  returnYards?: number;
  isTouchback?: boolean;
  isFairCatch?: boolean;
  isBlocked?: boolean;
  blockedBy?: string;          // playerId
  isOnsideKick?: boolean;
  hangTime?: number;           // seconds
  isTouchdown?: boolean;
  fieldGoalDistance?: number;
  fumble?: FumbleEvent;
  penalties?: PenaltyEvent[];
  tackledBy?: string[];
  description?: string;
}

export interface PenaltyPlay {
  type: PlayType.Penalty | PlayType.NoPlay;
  penalties: PenaltyEvent[];
  description?: string;
}

export interface TimeoutPlay {
  type: PlayType.Timeout;
  calledBy: string;            // teamId
  description?: string;
}

export interface FumbleEvent {
  fumbledBy: string;           // playerId
  forcedBy?: string;           // playerId
  recoveredBy?: string;        // playerId
  recoveryTeam?: string;       // teamId
  recoveryYards?: number;
  isTouchdown?: boolean;
}

export interface PenaltyEvent {
  penaltyType: string;         // e.g. "holding", "offsides", "pass_interference"
  team: string;                // teamId
  player?: string;             // playerId
  yards: number;
  enforcement: PenaltyEnforcement;
  isPreSnap?: boolean;
  isAutoFirstDown?: boolean;
  description?: string;
}

export type Play = (PassPlay | RushPlay | SpecialTeamsPlay | PenaltyPlay | TimeoutPlay) & {
  context: PlayContext;
};

// ---------------------------------------------------------------------------
// STAT OUTPUT INTERFACES
// ---------------------------------------------------------------------------

export interface PassingStats {
  playerId: string;
  playerName: string;
  completions: number;
  attempts: number;
  yards: number;
  touchdowns: number;
  interceptions: number;
  sacks: number;
  sackYardsLost: number;
  completionPercentage: number;
  yardsPerAttempt: number;
  yardsPerCompletion: number;
  adjustedYardsPerAttempt: number;  // (yards + 20*TD - 45*INT) / attempts
  passerRating: number;             // NFL passer rating
  longPass: number;
  airYards: number;
  yardsAfterCatch: number;
  timesUnderPressure: number;
  completionsUnderPressure: number;
  attemptsUnderPressure: number;
  avgTimeToThrow: number;
  playActionAttempts: number;
  playActionCompletions: number;
  playActionYards: number;
  screenPassAttempts: number;
  screenPassCompletions: number;
  screenPassYards: number;
  firstDowns: number;
  twentyPlusYardCompletions: number;
  fortyPlusYardCompletions: number;
  scrambles: number;
  scrambleYards: number;
  throwAways: number;
  battedBalls: number;
  redZoneAttempts: number;
  redZoneCompletions: number;
  redZoneTouchdowns: number;
  redZoneInterceptions: number;
  thirdDownAttempts: number;
  thirdDownCompletions: number;
  thirdDownConversions: number;
}

export interface RushingStats {
  playerId: string;
  playerName: string;
  carries: number;
  yards: number;
  touchdowns: number;
  yardsPerCarry: number;
  longRush: number;
  fumbles: number;
  fumblesLost: number;
  firstDowns: number;
  tenPlusYardRuns: number;
  twentyPlusYardRuns: number;
  yardsAfterContact: number;
  brokenTackles: number;
  stuffedRuns: number;             // runs gaining 0 or negative yards
  redZoneCarries: number;
  redZoneTouchdowns: number;
  thirdDownCarries: number;
  thirdDownConversions: number;
  rushLeftYards: number;
  rushMiddleYards: number;
  rushRightYards: number;
  rushLeftCarries: number;
  rushMiddleCarries: number;
  rushRightCarries: number;
  kneels: number;
  scrambles: number;
  scrambleYards: number;
}

export interface ReceivingStats {
  playerId: string;
  playerName: string;
  targets: number;
  receptions: number;
  yards: number;
  touchdowns: number;
  yardsPerReception: number;
  yardsPerTarget: number;
  catchPercentage: number;
  longReception: number;
  firstDowns: number;
  airYards: number;
  yardsAfterCatch: number;
  twentyPlusYardReceptions: number;
  fortyPlusYardReceptions: number;
  drops: number;                   // targets - receptions where pass was catchable
  fumbles: number;
  fumblesLost: number;
  redZoneTargets: number;
  redZoneReceptions: number;
  redZoneTouchdowns: number;
  thirdDownTargets: number;
  thirdDownReceptions: number;
  thirdDownConversions: number;
  yardsBeforeCatch: number;        // air yards on completions
  avgDepthOfTarget: number;        // average air yards on all targets
}

export interface DefensiveStats {
  playerId: string;
  playerName: string;
  totalTackles: number;
  soloTackles: number;
  assistedTackles: number;
  tacklesForLoss: number;
  sacks: number;
  halfSacks: number;
  sackYards: number;
  qbHits: number;
  pressures: number;
  interceptions: number;
  interceptionYards: number;
  interceptionTouchdowns: number;
  passesDefended: number;
  forcedFumbles: number;
  fumbleRecoveries: number;
  fumbleRecoveryYards: number;
  fumbleRecoveryTouchdowns: number;
  safeties: number;
  stuffs: number;                 // stops at or behind LOS
  missedTackles: number;
  targetedInCoverage: number;
  completionsAllowed: number;
  yardsAllowedInCoverage: number;
  touchdownsAllowedInCoverage: number;
}

export interface KickingStats {
  playerId: string;
  playerName: string;
  fieldGoalAttempts: number;
  fieldGoalMade: number;
  fieldGoalPercentage: number;
  fieldGoalLong: number;
  fieldGoalBlocked: number;
  extraPointAttempts: number;
  extraPointMade: number;
  extraPointPercentage: number;
  extraPointBlocked: number;
  totalPoints: number;
  fg0to19Att: number; fg0to19Made: number;
  fg20to29Att: number; fg20to29Made: number;
  fg30to39Att: number; fg30to39Made: number;
  fg40to49Att: number; fg40to49Made: number;
  fg50PlusAtt: number; fg50PlusMade: number;
  kickoffs: number;
  kickoffTouchbacks: number;
  kickoffTouchbackPercentage: number;
  onsideKickAttempts: number;
  onsideKickRecoveries: number;
  averageKickoffDistance: number;
}

export interface PuntingStats {
  playerId: string;
  playerName: string;
  punts: number;
  puntYards: number;
  puntAverage: number;
  puntLong: number;
  puntsInside20: number;
  touchbacks: number;
  puntsFairCaught: number;
  puntsBlocked: number;
  puntReturnYardsAgainst: number;
  netPuntAverage: number;
  hangTimeAvg: number;
}

export interface ReturnStats {
  playerId: string;
  playerName: string;
  kickReturns: number;
  kickReturnYards: number;
  kickReturnAverage: number;
  kickReturnLong: number;
  kickReturnTouchdowns: number;
  kickReturnFumbles: number;
  puntReturns: number;
  puntReturnYards: number;
  puntReturnAverage: number;
  puntReturnLong: number;
  puntReturnTouchdowns: number;
  puntReturnFumbles: number;
  puntReturnFairCatches: number;
}

export interface TeamStats {
  teamId: string;
  teamName: string;
  totalPlays: number;
  totalYards: number;
  passingYards: number;
  rushingYards: number;
  firstDowns: number;
  firstDownsPassing: number;
  firstDownsRushing: number;
  firstDownsPenalty: number;
  thirdDownAttempts: number;
  thirdDownConversions: number;
  thirdDownPercentage: number;
  fourthDownAttempts: number;
  fourthDownConversions: number;
  fourthDownPercentage: number;
  redZoneTrips: number;
  redZoneTouchdowns: number;
  redZoneFieldGoals: number;
  redZonePercentage: number;    // TD + FG / trips
  turnovers: number;
  interceptionsThrown: number;
  fumblesLost: number;
  penalties: number;
  penaltyYards: number;
  timeOfPossession: string;     // "MM:SS"
  timeOfPossessionSeconds: number;
  sacks: number;                // sacks taken
  sackYardsLost: number;
  pointsScored: number;
  totalDrives: number;
  puntCount: number;
  averageStartingFieldPosition: number;
  yardsPerPlay: number;
  passAttempts: number;
  passCompletions: number;
  rushAttempts: number;
  averageDriveYards: number;
  averageDrivePlays: number;
  averageDriveTime: string;
  twoPointConversionAttempts: number;
  twoPointConversionsMade: number;
  goalToGoAttempts: number;
  goalToGoTouchdowns: number;
}

export interface DriveStats {
  driveNumber: number;
  team: string;
  startQuarter: Quarter;
  startTime: string;
  startYardLine: number;
  endQuarter: Quarter;
  endTime: string;
  endYardLine: number;
  plays: number;
  yards: number;
  timeOfPossession: string;
  timeOfPossessionSeconds: number;
  result: DriveResult;
  firstDowns: number;
  penalties: number;
  penaltyYards: number;
  isRedZoneDrive: boolean;
}

export enum DriveResult {
  Touchdown = "touchdown",
  FieldGoal = "field_goal",
  Punt = "punt",
  Turnover = "turnover",
  TurnoverOnDowns = "turnover_on_downs",
  EndOfHalf = "end_of_half",
  EndOfGame = "end_of_game",
  Safety = "safety",
  MissedFieldGoal = "missed_field_goal",
}

// ---------------------------------------------------------------------------
// PENALTY STAT OUTPUT INTERFACES
// ---------------------------------------------------------------------------

export interface PlayerPenaltyStats {
  playerId: string;
  playerName: string;
  totalPenalties: number;
  totalYards: number;
  acceptedPenalties: number;
  declinedPenalties: number;
  offsetPenalties: number;
  preSnapPenalties: number;
  liveballPenalties: number;
  personalFouls: number;
  unsportsmanlikeConducts: number;
  /** Breakdown by penalty type code: { "holding_offense": 3, "false_start": 1 } */
  byType: Record<string, number>;
  thirdDownPenalties: number;
  redZonePenalties: number;
  q1Penalties: number;
  q2Penalties: number;
  q3Penalties: number;
  q4Penalties: number;
  otPenalties: number;
  personalFoulCount: number;
  unsportsmanlikeCount: number;
  wasEjected: boolean;
  ejectionQuarter?: Quarter;
  ejectionClock?: string;
}

export interface TeamPenaltyStats {
  teamId: string;
  teamName: string;
  totalPenalties: number;
  totalYards: number;
  acceptedPenalties: number;
  declinedPenalties: number;
  offsetPenalties: number;
  preSnapPenalties: number;
  liveballPenalties: number;
  offensivePenalties: number;
  defensivePenalties: number;
  specialTeamsPenalties: number;
  personalFouls: number;
  unsportsmanlikeConducts: number;
  thirdDownPenalties: number;
  redZonePenalties: number;
  autoFirstDownsGivenUp: number;
  autoFirstDownsReceived: number;
  q1Penalties: number;
  q2Penalties: number;
  q3Penalties: number;
  q4Penalties: number;
  otPenalties: number;
  byType: Record<string, number>;
  bigPlayNegated: number;
}

// ---------------------------------------------------------------------------
// GAME SUMMARY — THE FINAL AGGREGATE OUTPUT
// ---------------------------------------------------------------------------

export interface GameSummary {
  gameId: string;
  homeTeam: TeamId;
  awayTeam: TeamId;
  homeScore: number;
  awayScore: number;
  quarter: Quarter;
  gameClock: string;
  isFinal: boolean;
  totalPlays: number;

  // Team-level
  homeTeamStats: TeamStats;
  awayTeamStats: TeamStats;

  // Player-level (keyed by playerId)
  passing: Record<string, PassingStats>;
  rushing: Record<string, RushingStats>;
  receiving: Record<string, ReceivingStats>;
  defense: Record<string, DefensiveStats>;
  kicking: Record<string, KickingStats>;
  punting: Record<string, PuntingStats>;
  returns: Record<string, ReturnStats>;

  // Penalty stats
  playerPenalties: Record<string, PlayerPenaltyStats>;
  teamPenalties: Record<string, TeamPenaltyStats>;

  // Drive summaries
  drives: DriveStats[];

  // Scoring plays
  scoringPlays: ScoringPlay[];
}

export interface ScoringPlay {
  quarter: Quarter;
  gameClock: string;
  team: string;
  description: string;
  pointsScored: number;
  homeScore: number;
  awayScore: number;
  playType: "passing_td" | "rushing_td" | "field_goal" | "extra_point" | "two_point" | "safety" | "return_td" | "defensive_td" | "fumble_recovery_td";
}

// ---------------------------------------------------------------------------
// ENGINE CONFIG
// ---------------------------------------------------------------------------

export interface EngineConfig {
  /** Whether to track advanced metrics (air yards, YAC, pressure, etc.) */
  trackAdvancedMetrics?: boolean;
  /** Whether to track directional rushing splits */
  trackDirectionalStats?: boolean;
  /** Whether to track situational splits (red zone, third down) */
  trackSituationalSplits?: boolean;
  /** Whether to compute drive summaries */
  trackDrives?: boolean;
  /** Whether to compute passer rating */
  computePasserRating?: boolean;
  /** Custom player name resolver (if you only pass IDs) */
  resolvePlayerName?: (playerId: string) => string;
}
