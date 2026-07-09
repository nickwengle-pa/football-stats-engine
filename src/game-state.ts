// ============================================================================
// GAME STATE MANAGER — NFL / COLLEGE / HIGH SCHOOL
// ============================================================================
//
// Models the full game state machine with rule-set-aware logic for:
//   - NFL (professional)
//   - NCAA (college)
//   - NFHS (high school — National Federation of State High School Associations)
//
// Handles: timeouts, quarter transitions, halftime, two-minute warning,
// overtime (timed or Kansas tiebreaker), clock management, challenges,
// coin toss, mercy rule, and all procedural events.
// ============================================================================

import {
  Play, PlayType, PassResult, Quarter, Down,
  TeamId, KickResult, SpecialTeamsResult,
} from "./types";
import { clockToSeconds, secondsToClock } from "./utils";

// ---------------------------------------------------------------------------
// RULE LEVEL
// ---------------------------------------------------------------------------

export type RuleLevel = "nfl" | "college" | "high_school";

// ---------------------------------------------------------------------------
// RULE SET — Every rule difference between levels, in one place
// ---------------------------------------------------------------------------

export interface RuleSet {
  level: RuleLevel;

  // ---- TIMING ----
  quarterLengthSeconds: number;
  playClockAfterPlay: number;
  playClockAfterStoppage: number;

  // ---- CLOCK BEHAVIOR ----
  clockStopsOnAllFirstDowns: boolean;
  clockStopsOnFirstDownLastSeconds: number;
  clockStopsOnOOBAlways: boolean;
  clockStopsOnOOBLastSeconds: number;
  clockRestartsOnSnapAfterOOB: boolean;
  clockRestartsOnSnapAfterFirstDown: boolean;

  // ---- TWO-MINUTE WARNING ----
  hasTwoMinuteWarning: boolean;

  // ---- TIMEOUTS ----
  timeoutsPerHalf: number;
  timeoutsInOvertime: number;
  timeoutsCarryOver: boolean;

  // ---- CHALLENGES / REPLAY ----
  hasChallenges: boolean;
  challengesPerHalf: number;
  extraChallengeOnTwoWins: boolean;
  hasBoothReview: boolean;

  // ---- OVERTIME ----
  overtime: OvertimeRules;

  // ---- MERCY RULE ----
  mercyRule: MercyRuleConfig | null;

  // ---- FIELD POSITIONS ----
  kickoffYardLine: number;
  extraPointYardLine: number;
  twoPointYardLine: number;
  safetyFreeKickYardLine: number;

  // ---- MISC ----
  allowDeferOnCoinToss: boolean;
}

export interface OvertimeRules {
  type: "timed" | "kansas";
  periodLengthSeconds: number;
  guaranteedPossession: boolean;
  canEndInTie: boolean;
  maxPeriodsBeforeTie: number;
  startingYardLine: number;
  forceTwoPointAfterPeriod: number;
  twoPointShootoutAfterPeriod: number;
  hasClock: boolean;
}

export interface MercyRuleConfig {
  pointDifferential: number;
  activatesAfterQuarter: number;
  effect: "running_clock";
  description: string;
}

// ---------------------------------------------------------------------------
// PRE-BUILT RULE SETS
// ---------------------------------------------------------------------------

export const NFL_RULES: RuleSet = {
  level: "nfl",
  quarterLengthSeconds: 900,
  playClockAfterPlay: 40,
  playClockAfterStoppage: 25,

  clockStopsOnAllFirstDowns: false,
  clockStopsOnFirstDownLastSeconds: 120,
  clockStopsOnOOBAlways: false,
  clockStopsOnOOBLastSeconds: 120,
  clockRestartsOnSnapAfterOOB: false,
  clockRestartsOnSnapAfterFirstDown: false,

  hasTwoMinuteWarning: true,
  timeoutsPerHalf: 3,
  timeoutsInOvertime: 2,
  timeoutsCarryOver: false,

  hasChallenges: true,
  challengesPerHalf: 2,
  extraChallengeOnTwoWins: true,
  hasBoothReview: true,

  overtime: {
    type: "timed",
    periodLengthSeconds: 600,
    guaranteedPossession: true,
    canEndInTie: true,
    maxPeriodsBeforeTie: 1,
    startingYardLine: 0,
    forceTwoPointAfterPeriod: 0,
    twoPointShootoutAfterPeriod: 0,
    hasClock: true,
  },

  mercyRule: null,

  kickoffYardLine: 35,
  extraPointYardLine: 15,
  twoPointYardLine: 2,
  safetyFreeKickYardLine: 20,

  allowDeferOnCoinToss: true,
};

export const COLLEGE_RULES: RuleSet = {
  level: "college",
  quarterLengthSeconds: 900,
  playClockAfterPlay: 40,
  playClockAfterStoppage: 25,

  clockStopsOnAllFirstDowns: true,
  clockStopsOnFirstDownLastSeconds: 0,
  clockStopsOnOOBAlways: false,
  clockStopsOnOOBLastSeconds: 120,
  clockRestartsOnSnapAfterOOB: true,
  clockRestartsOnSnapAfterFirstDown: true,

  hasTwoMinuteWarning: false,
  timeoutsPerHalf: 3,
  timeoutsInOvertime: 1,
  timeoutsCarryOver: false,

  hasChallenges: false,
  challengesPerHalf: 0,
  extraChallengeOnTwoWins: false,
  hasBoothReview: true,

  overtime: {
    type: "kansas",
    periodLengthSeconds: 0,
    guaranteedPossession: true,
    canEndInTie: false,
    maxPeriodsBeforeTie: 0,
    startingYardLine: 75,
    forceTwoPointAfterPeriod: 2,
    twoPointShootoutAfterPeriod: 3,
    hasClock: false,
  },

  mercyRule: null,

  kickoffYardLine: 35,
  extraPointYardLine: 3,
  twoPointYardLine: 3,
  safetyFreeKickYardLine: 20,

  allowDeferOnCoinToss: true,
};

export const HIGH_SCHOOL_RULES: RuleSet = {
  level: "high_school",
  quarterLengthSeconds: 720,          // 12 MINUTES
  playClockAfterPlay: 40,
  playClockAfterStoppage: 25,

  clockStopsOnAllFirstDowns: true,
  clockStopsOnFirstDownLastSeconds: 0,
  clockStopsOnOOBAlways: false,
  clockStopsOnOOBLastSeconds: 120,
  clockRestartsOnSnapAfterOOB: true,
  clockRestartsOnSnapAfterFirstDown: true,

  hasTwoMinuteWarning: false,
  timeoutsPerHalf: 3,
  timeoutsInOvertime: 1,
  timeoutsCarryOver: false,

  hasChallenges: false,
  challengesPerHalf: 0,
  extraChallengeOnTwoWins: false,
  hasBoothReview: false,

  overtime: {
    type: "kansas",
    periodLengthSeconds: 0,
    guaranteedPossession: true,
    canEndInTie: false,
    maxPeriodsBeforeTie: 0,
    startingYardLine: 90,             // opponent 10-yard line
    forceTwoPointAfterPeriod: 2,
    twoPointShootoutAfterPeriod: 4,
    hasClock: false,
  },

  mercyRule: {
    pointDifferential: 35,
    activatesAfterQuarter: 2,
    effect: "running_clock",
    description: "Running clock (mercy rule): clock stops only for timeouts, injuries, and scores",
  },

  kickoffYardLine: 40,               // HS kicks from the 40
  extraPointYardLine: 3,
  twoPointYardLine: 3,
  safetyFreeKickYardLine: 20,

  allowDeferOnCoinToss: true,
};

// ---------------------------------------------------------------------------
// ENUMS & TYPES
// ---------------------------------------------------------------------------

export enum GamePhase {
  PreGame = "pre_game",
  CoinToss = "coin_toss",
  Kickoff = "kickoff",
  InProgress = "in_progress",
  TwoMinuteWarning = "two_minute_warning",
  Halftime = "halftime",
  Overtime = "overtime",
  OvertimeCoinToss = "overtime_coin_toss",
  KansasOT = "kansas_ot",
  TwoPointShootout = "two_point_shootout",
  MercyRule = "mercy_rule",
  Final = "final",
  FinalOvertime = "final_overtime",
}

export enum ClockState {
  Running = "running",
  Stopped = "stopped",
  MercyRunning = "mercy_running",
}

export enum StoppageReason {
  IncompletePass = "incomplete_pass",
  OutOfBounds = "out_of_bounds",
  Penalty = "penalty",
  Timeout = "timeout",
  TwoMinuteWarning = "two_minute_warning",
  Touchdown = "touchdown",
  FieldGoal = "field_goal",
  Turnover = "turnover",
  SafetyScore = "safety",
  FirstDown = "first_down",
  ChangeOfPossession = "change_of_possession",
  EndOfQuarter = "end_of_quarter",
  Halftime = "halftime",
  InjuryTimeout = "injury_timeout",
  OfficialTimeout = "official_timeout",
  ReviewChallenge = "review_challenge",
  EndOfGame = "end_of_game",
}

export enum CoinTossChoice {
  Receive = "receive",
  Kick = "kick",
  Defer = "defer",
  DefendGoal = "defend_goal",
}

export enum PossessionReason {
  Kickoff = "kickoff",
  Punt = "punt",
  Turnover = "turnover",
  TurnoverOnDowns = "turnover_on_downs",
  Safety = "safety",
  Touchdown = "after_score",
  OvertimeRules = "overtime_rules",
  StartOfHalf = "start_of_half",
  MuffedKick = "muffed_kick",
  OnsideKick = "onside_kick",
}

export interface TimeoutState {
  remaining: number;
  usedThisHalf: number;
  totalUsed: number;
  timestamps: TimeoutRecord[];
}

export interface TimeoutRecord {
  quarter: Quarter;
  gameClock: string;
  teamId: string;
  isCharged: boolean;
  reason?: string;
}

export interface ChallengeState {
  remaining: number;
  used: number;
  won: number;
  lost: number;
  history: ChallengeRecord[];
}

export interface ChallengeRecord {
  quarter: Quarter;
  gameClock: string;
  teamId: string;
  result: "upheld" | "overturned" | "stands";
  playDescription?: string;
}

export interface OvertimeState {
  isOvertime: boolean;
  overtimePeriod: number;
  coinTossWinner?: string;
  coinTossChoice?: CoinTossChoice;
  possessions: OvertimePossession[];
  isFirstPossessionComplete: boolean;
  isSuddenDeath: boolean;
  teamsThatHavePossessed: Set<string>;
  periodScores: Array<{ period: number; home: number; away: number }>;
  isTwoPointShootout: boolean;
  mustGoForTwo: boolean;
}

export interface OvertimePossession {
  teamId: string;
  result: "touchdown" | "field_goal" | "punt" | "turnover" | "turnover_on_downs" | "safety" | "end_of_period" | "in_progress";
  points: number;
}

export interface GameStateSnapshot {
  phase: GamePhase;
  ruleLevel: RuleLevel;
  quarter: Quarter;
  gameClock: string;
  gameClockSeconds: number;
  playClock: number;
  clockState: ClockState;
  down: Down;
  distance: number;
  yardLine: number;
  possession: string;
  homeTeam: TeamId;
  awayTeam: TeamId;
  homeScore: number;
  awayScore: number;
  homeTimeouts: TimeoutState;
  awayTimeouts: TimeoutState;
  homeChallenges: ChallengeState;
  awayChallenges: ChallengeState;
  lastStoppage?: StoppageReason;
  twoMinuteWarningUsed: { q2: boolean; q4: boolean };
  overtime: OvertimeState;
  isMercyRule: boolean;
  isFinal: boolean;
  playCount: number;
  driveNumber: number;
}

export interface GameEvent {
  type: GameEventType;
  quarter: Quarter;
  gameClock: string;
  description: string;
  teamId?: string;
  metadata?: Record<string, unknown>;
}

export enum GameEventType {
  CoinToss = "coin_toss",
  Kickoff = "kickoff",
  Timeout = "timeout",
  TwoMinuteWarning = "two_minute_warning",
  EndOfQuarter = "end_of_quarter",
  Halftime = "halftime",
  StartOfHalf = "start_of_half",
  OvertimeStart = "overtime_start",
  OvertimeCoinToss = "overtime_coin_toss",
  KansasOTPossession = "kansas_ot_possession",
  TwoPointShootout = "two_point_shootout",
  Challenge = "challenge",
  InjuryTimeout = "injury_timeout",
  OfficialTimeout = "official_timeout",
  MercyRuleActivated = "mercy_rule_activated",
  MercyRuleDeactivated = "mercy_rule_deactivated",
  DelayOfGame = "delay_of_game",
  ChangeOfPossession = "change_of_possession",
  Safety = "safety",
  Touchback = "touchback",
  FairCatch = "fair_catch",
  GameOver = "game_over",
  ReviewUnderway = "review_underway",
  ReviewComplete = "review_complete",
}

// ---------------------------------------------------------------------------
// HELPER: Rule set lookup
// ---------------------------------------------------------------------------

export function getRuleSet(level: RuleLevel): RuleSet {
  switch (level) {
    case "nfl": return { ...NFL_RULES };
    case "college": return { ...COLLEGE_RULES };
    case "high_school": return { ...HIGH_SCHOOL_RULES };
  }
}

// ---------------------------------------------------------------------------
// GAME STATE MANAGER
// ---------------------------------------------------------------------------

export class GameStateManager {
  private phase: GamePhase = GamePhase.PreGame;
  private quarter: Quarter = Quarter.First;
  private gameClockSeconds: number;
  private playClock: number;
  private clockState: ClockState = ClockState.Stopped;
  private down: Down = Down.First;
  private distance: number = 10;
  private yardLine: number = 35;
  private possession: string = "";
  private homeTeam!: TeamId;
  private awayTeam!: TeamId;
  private homeScore: number = 0;
  private awayScore: number = 0;
  private playCount: number = 0;
  private driveNumber: number = 0;

  private homeTimeouts: TimeoutState;
  private awayTimeouts: TimeoutState;
  private homeChallenges: ChallengeState;
  private awayChallenges: ChallengeState;

  private twoMinuteWarning = { q2: false, q4: false };
  private overtime: OvertimeState;
  private mercyRuleActive = false;

  private events: GameEvent[] = [];
  readonly rules: RuleSet;

  private coinTossWinner: string = "";
  private coinTossChoice: CoinTossChoice = CoinTossChoice.Defer;
  private deferredTeam: string = "";
  private openingKickoffReceiver: string = "";
  private secondHalfKickoffReceiver: string = "";

  constructor(level: RuleLevel = "nfl", customRules?: Partial<RuleSet>) {
    this.rules = { ...getRuleSet(level), ...customRules };
    this.gameClockSeconds = this.rules.quarterLengthSeconds;
    this.playClock = this.rules.playClockAfterStoppage;

    this.homeTimeouts = this.createTimeoutState();
    this.awayTimeouts = this.createTimeoutState();
    this.homeChallenges = this.rules.hasChallenges
      ? this.createChallengeState()
      : this.createNoChallengeState();
    this.awayChallenges = this.rules.hasChallenges
      ? this.createChallengeState()
      : this.createNoChallengeState();
    this.overtime = this.createOvertimeState();
  }

  // ---------------------------------------------------------------------------
  // SETUP
  // ---------------------------------------------------------------------------

  setTeams(home: TeamId, away: TeamId): void {
    this.homeTeam = home;
    this.awayTeam = away;
  }

  /** Configure opening and second-half kickoff receivers directly. */
  configureKickoffReceivers(
    openingKickoffReceiver: string,
    secondHalfKickoffReceiver?: string,
    coinTossWinner?: string,
    coinTossChoice?: CoinTossChoice,
  ): void {
    this.openingKickoffReceiver = openingKickoffReceiver;
    this.secondHalfKickoffReceiver = secondHalfKickoffReceiver
      ?? (openingKickoffReceiver === this.homeTeam.id ? this.awayTeam.id : this.homeTeam.id);
    if (coinTossWinner) {
      this.coinTossWinner = coinTossWinner;
    }
    if (coinTossChoice) {
      this.coinTossChoice = coinTossChoice;
    }
    this.phase = GamePhase.Kickoff;
    this.possession = openingKickoffReceiver;
    this.addEvent(GameEventType.CoinToss, coinTossWinner,
      coinTossWinner && coinTossChoice
        ? `${coinTossWinner} wins coin toss and elects to ${coinTossChoice}`
        : `${openingKickoffReceiver} receives opening kickoff`);
  }

  recordCoinToss(winner: string, choice: CoinTossChoice): void {
    if (choice === CoinTossChoice.Defer && !this.rules.allowDeferOnCoinToss) {
      choice = CoinTossChoice.Receive;
    }

    this.coinTossWinner = winner;
    this.coinTossChoice = choice;
    this.phase = GamePhase.CoinToss;

    const loser = winner === this.homeTeam.id ? this.awayTeam.id : this.homeTeam.id;

    let openingKickoffReceiver = loser;
    if (choice === CoinTossChoice.Receive) {
      openingKickoffReceiver = winner;
    } else if (choice === CoinTossChoice.Kick) {
      openingKickoffReceiver = loser;
    } else if (choice === CoinTossChoice.Defer || choice === CoinTossChoice.DefendGoal) {
      this.deferredTeam = winner;
      openingKickoffReceiver = loser;
    }

    this.configureKickoffReceivers(
      openingKickoffReceiver,
      winner === openingKickoffReceiver ? loser : winner,
      winner,
      choice,
    );
  }

  // ---------------------------------------------------------------------------
  // MAIN PLAY PROCESSING
  // ---------------------------------------------------------------------------

  processPlay(play: Play): {
    events: GameEvent[];
    shouldProcess: boolean;
    updatedContext: Play["context"];
  } {
    const triggeredEvents: GameEvent[] = [];
    this.playCount++;

    this.quarter = play.context.quarter;
    this.gameClockSeconds = clockToSeconds(play.context.gameClock);
    this.possession = play.context.possessionTeam;
    this.down = play.context.down;
    this.distance = play.context.distance;
    this.yardLine = play.context.yardLine;
    this.homeScore = play.context.homeScore;
    this.awayScore = play.context.awayScore;

    if (play.context.driveNumber != null) {
      this.driveNumber = play.context.driveNumber;
    }

    // Overtime detection
    if (this.quarter >= Quarter.OT1 && !this.overtime.isOvertime) {
      this.enterOvertime();
      triggeredEvents.push(...this.getRecentEvents(1));
    }

    // End of quarter (timed modes)
    if (this.gameClockSeconds <= 0 &&
        (this.rules.overtime.type === "timed" || !this.overtime.isOvertime)) {
      triggeredEvents.push(...this.handleEndOfQuarter());
    }

    // Two-minute warning (NFL only)
    if (this.rules.hasTwoMinuteWarning) {
      const is2Q = this.quarter === Quarter.Second || this.quarter === Quarter.Fourth;
      if (is2Q && this.gameClockSeconds <= 120) {
        const key = this.quarter === Quarter.Second ? "q2" : "q4";
        if (!this.twoMinuteWarning[key]) {
          this.twoMinuteWarning[key] = true;
          this.clockState = ClockState.Stopped;
          this.addEvent(GameEventType.TwoMinuteWarning, undefined, "Two-minute warning");
          triggeredEvents.push(this.events[this.events.length - 1]);
        }
      }
    }

    // Mercy rule check
    if (this.rules.mercyRule) {
      this.checkMercyRule(triggeredEvents);
    }

    // Timeout play
    if (play.type === PlayType.Timeout) {
      const toPlay = play as any;
      this.processTimeout(toPlay.calledBy);
      triggeredEvents.push(this.events[this.events.length - 1]);
      return {
        events: triggeredEvents,
        shouldProcess: true,
        updatedContext: this.enrichContext(play.context),
      };
    }

    // Clock state
    this.updateClockState(play);

    // Possession change
    const changed = this.detectPossessionChange(play);
    if (changed) {
      this.driveNumber++;
      this.addEvent(GameEventType.ChangeOfPossession, this.possession,
        `Change of possession to ${this.possession}`);
      triggeredEvents.push(this.events[this.events.length - 1]);
      if (this.overtime.isOvertime) {
        this.overtime.teamsThatHavePossessed.add(this.possession);
      }
    }

    // Scoring
    this.detectScoring(play, triggeredEvents);

    // OT update
    if (this.overtime.isOvertime) {
      this.updateOvertimeState(play, triggeredEvents);
    }

    return {
      events: triggeredEvents,
      shouldProcess: play.type !== PlayType.NoPlay,
      updatedContext: this.enrichContext(play.context),
    };
  }

  // ---------------------------------------------------------------------------
  // TIMEOUTS
  // ---------------------------------------------------------------------------

  processTimeout(teamId: string, isCharged: boolean = true, reason?: string): boolean {
    const state = teamId === this.homeTeam.id ? this.homeTimeouts : this.awayTimeouts;
    if (isCharged && state.remaining <= 0) return false;

    if (isCharged) {
      state.remaining--;
      state.usedThisHalf++;
    }
    state.totalUsed++;

    state.timestamps.push({
      quarter: this.quarter,
      gameClock: secondsToClock(this.gameClockSeconds),
      teamId, isCharged, reason,
    });

    this.clockState = ClockState.Stopped;
    this.playClock = this.rules.playClockAfterStoppage;

    this.addEvent(
      isCharged ? GameEventType.Timeout : GameEventType.OfficialTimeout,
      teamId,
      isCharged
        ? `Timeout #${state.usedThisHalf} by ${teamId} (${state.remaining} remaining)`
        : `Official timeout (${reason ?? "unspecified"})`
    );
    return true;
  }

  private resetTimeoutsForHalf(): void {
    this.homeTimeouts.remaining = this.rules.timeoutsPerHalf;
    this.homeTimeouts.usedThisHalf = 0;
    this.awayTimeouts.remaining = this.rules.timeoutsPerHalf;
    this.awayTimeouts.usedThisHalf = 0;
  }

  private resetTimeoutsForOvertime(): void {
    this.homeTimeouts.remaining = this.rules.timeoutsInOvertime;
    this.homeTimeouts.usedThisHalf = 0;
    this.awayTimeouts.remaining = this.rules.timeoutsInOvertime;
    this.awayTimeouts.usedThisHalf = 0;
  }

  // ---------------------------------------------------------------------------
  // CHALLENGES (NFL only)
  // ---------------------------------------------------------------------------

  recordChallenge(
    teamId: string,
    result: "upheld" | "overturned" | "stands",
    playDescription?: string
  ): boolean {
    if (!this.rules.hasChallenges) return false;
    const state = teamId === this.homeTeam.id ? this.homeChallenges : this.awayChallenges;
    if (state.remaining <= 0) return false;

    state.used++;
    if (result === "overturned") {
      state.won++;
      if (this.rules.extraChallengeOnTwoWins && state.won === 2 && state.used === 2) {
        state.remaining = 1;
      } else {
        state.remaining--;
      }
    } else {
      state.lost++;
      state.remaining--;
      this.processTimeout(teamId, true, "lost challenge");
    }

    state.history.push({
      quarter: this.quarter,
      gameClock: secondsToClock(this.gameClockSeconds),
      teamId, result, playDescription,
    });

    this.addEvent(GameEventType.Challenge, teamId,
      `Challenge by ${teamId}: ${result}${playDescription ? ` (${playDescription})` : ""}`);
    return true;
  }

  recordBoothReview(result: "upheld" | "overturned" | "stands", description?: string): void {
    if (!this.rules.hasBoothReview) return;
    this.addEvent(GameEventType.ReviewComplete, undefined,
      `Booth review: ${result}${description ? ` — ${description}` : ""}`);
  }

  // ---------------------------------------------------------------------------
  // INJURY TIMEOUT
  // ---------------------------------------------------------------------------

  recordInjuryTimeout(teamId?: string): void {
    this.clockState = ClockState.Stopped;
    this.addEvent(GameEventType.InjuryTimeout, teamId,
      `Injury timeout${teamId ? ` (${teamId})` : ""}`);
  }

  // ---------------------------------------------------------------------------
  // MERCY RULE
  // ---------------------------------------------------------------------------

  private checkMercyRule(events: GameEvent[]): void {
    const mr = this.rules.mercyRule!;
    const diff = Math.abs(this.homeScore - this.awayScore);
    const qNum = typeof this.quarter === "number" ? this.quarter : 1;

    if (!this.mercyRuleActive && diff >= mr.pointDifferential && qNum >= mr.activatesAfterQuarter) {
      this.mercyRuleActive = true;
      this.clockState = ClockState.MercyRunning;
      this.phase = GamePhase.MercyRule;
      this.addEvent(GameEventType.MercyRuleActivated, undefined, mr.description);
      events.push(this.events[this.events.length - 1]);
    } else if (this.mercyRuleActive && diff < mr.pointDifferential) {
      this.mercyRuleActive = false;
      this.phase = GamePhase.InProgress;
      this.addEvent(GameEventType.MercyRuleDeactivated, undefined,
        "Mercy rule deactivated — point differential reduced");
      events.push(this.events[this.events.length - 1]);
    }
  }

  // ---------------------------------------------------------------------------
  // CLOCK MANAGEMENT — Rule-aware
  // ---------------------------------------------------------------------------

  private updateClockState(play: Play): void {
    const p = play as any;

    // Mercy rule: clock runs unless score/timeout/injury
    if (this.mercyRuleActive) {
      this.clockState = ClockState.MercyRunning;
      this.playClock = this.rules.playClockAfterPlay;
      if (p.isTouchdown ||
          (play.type === PlayType.FieldGoal && p.result === KickResult.Good) ||
          play.type === PlayType.Timeout) {
        this.clockState = ClockState.Stopped;
      }
      return;
    }

    const qNum = typeof this.quarter === "number" ? this.quarter : 1;
    const isSecondOrFourth = qNum === 2 || qNum === 4;

    // Default: clock runs
    this.clockState = ClockState.Running;
    this.playClock = this.rules.playClockAfterPlay;

    // Incomplete pass — stops at all levels
    if (play.type === PlayType.Pass && p.result === PassResult.Incomplete) {
      this.clockState = ClockState.Stopped;
      this.playClock = this.rules.playClockAfterStoppage;
    }

    // Interception
    if (play.type === PlayType.Pass && p.result === PassResult.Interception) {
      this.clockState = ClockState.Stopped;
    }

    // Out of bounds
    if (p.forcedOutOfBounds) {
      if (this.rules.clockStopsOnOOBAlways) {
        this.clockState = ClockState.Stopped;
      } else if (isSecondOrFourth &&
                 this.gameClockSeconds <= this.rules.clockStopsOnOOBLastSeconds) {
        this.clockState = ClockState.Stopped;
      }
    }

    // Touchdown / Field Goal
    if (p.isTouchdown || (play.type === PlayType.FieldGoal && p.result === KickResult.Good)) {
      this.clockState = ClockState.Stopped;
    }

    // First down
    if (play.type === PlayType.Pass || play.type === PlayType.Rush) {
      if (p.yardsGained >= play.context.distance && !p.isTouchdown) {
        if (this.rules.clockStopsOnAllFirstDowns) {
          // College & HS: ALWAYS stops on first down
          this.clockState = ClockState.Stopped;
        } else if (this.rules.clockStopsOnFirstDownLastSeconds > 0 &&
                   isSecondOrFourth &&
                   this.gameClockSeconds <= this.rules.clockStopsOnFirstDownLastSeconds) {
          // NFL: only under 2 min
          this.clockState = ClockState.Stopped;
        }
      }
    }

    // Penalties
    if (p.penalties && Array.isArray(p.penalties) && p.penalties.length > 0) {
      if (p.penalties.some((pen: any) => pen.enforcement === "accepted")) {
        this.clockState = ClockState.Stopped;
        this.playClock = this.rules.playClockAfterStoppage;
      }
    }

    // Special teams
    if (play.type === PlayType.Kickoff || play.type === PlayType.Punt ||
        play.type === PlayType.FreeKick) {
      this.clockState = ClockState.Stopped;
    }

    // Spike
    if (play.type === PlayType.Pass && p.result === PassResult.SpikeBall) {
      this.clockState = ClockState.Stopped;
    }

    // Kneel — clock runs
    if (play.type === PlayType.Rush && p.isKneel) {
      this.clockState = ClockState.Running;
    }
  }

  // ---------------------------------------------------------------------------
  // QUARTER / HALF TRANSITIONS
  // ---------------------------------------------------------------------------

  private handleEndOfQuarter(): GameEvent[] {
    const events: GameEvent[] = [];

    switch (this.quarter) {
      case Quarter.First:
        this.addEvent(GameEventType.EndOfQuarter, undefined, "End of 1st Quarter");
        events.push(this.events[this.events.length - 1]);
        this.gameClockSeconds = this.rules.quarterLengthSeconds;
        break;

      case Quarter.Second:
        this.phase = GamePhase.Halftime;
        this.addEvent(GameEventType.Halftime, undefined, "Halftime");
        events.push(this.events[this.events.length - 1]);
        this.resetTimeoutsForHalf();
        if (this.rules.hasChallenges) {
          this.homeChallenges = this.createChallengeState();
          this.awayChallenges = this.createChallengeState();
        }
        this.gameClockSeconds = this.rules.quarterLengthSeconds;
        if (this.secondHalfKickoffReceiver) {
          this.possession = this.secondHalfKickoffReceiver;
          this.addEvent(GameEventType.StartOfHalf, this.secondHalfKickoffReceiver,
            `${this.secondHalfKickoffReceiver} receives 2nd half kickoff`);
        } else if (this.deferredTeam) {
          this.possession = this.deferredTeam;
          this.addEvent(GameEventType.StartOfHalf, this.deferredTeam,
            `${this.deferredTeam} receives 2nd half kickoff`);
        }
        break;

      case Quarter.Third:
        this.addEvent(GameEventType.EndOfQuarter, undefined, "End of 3rd Quarter");
        events.push(this.events[this.events.length - 1]);
        this.gameClockSeconds = this.rules.quarterLengthSeconds;
        break;

      case Quarter.Fourth:
        if (this.homeScore === this.awayScore) {
          this.enterOvertime();
          events.push(this.events[this.events.length - 1]);
        } else {
          this.phase = GamePhase.Final;
          this.addEvent(GameEventType.GameOver, undefined,
            `Final: ${this.homeTeam.abbreviation} ${this.homeScore} — ${this.awayTeam.abbreviation} ${this.awayScore}`);
          events.push(this.events[this.events.length - 1]);
        }
        break;

      default:
        if (this.overtime.isOvertime) {
          this.handleEndOfOvertimePeriod(events);
        }
        break;
    }

    return events;
  }

  // ---------------------------------------------------------------------------
  // OVERTIME
  // ---------------------------------------------------------------------------

  private enterOvertime(): void {
    this.overtime.isOvertime = true;
    this.overtime.overtimePeriod = 1;

    if (this.rules.overtime.type === "timed") {
      this.phase = GamePhase.Overtime;
      this.gameClockSeconds = this.rules.overtime.periodLengthSeconds;
    } else {
      this.phase = GamePhase.KansasOT;
      this.gameClockSeconds = 0;
    }

    this.resetTimeoutsForOvertime();
    this.homeChallenges.remaining = 0;
    this.awayChallenges.remaining = 0;

    this.overtime.mustGoForTwo =
      this.rules.overtime.forceTwoPointAfterPeriod > 0 &&
      this.overtime.overtimePeriod >= this.rules.overtime.forceTwoPointAfterPeriod;
    this.overtime.isTwoPointShootout =
      this.rules.overtime.twoPointShootoutAfterPeriod > 0 &&
      this.overtime.overtimePeriod >= this.rules.overtime.twoPointShootoutAfterPeriod;

    if (this.overtime.isTwoPointShootout) this.phase = GamePhase.TwoPointShootout;

    const yardLine = 100 - this.rules.overtime.startingYardLine;
    this.addEvent(GameEventType.OvertimeStart, undefined,
      `OT Period ${this.overtime.overtimePeriod} begins` +
      (this.rules.overtime.type === "kansas" ? ` (from the ${yardLine})` : "") +
      (this.overtime.mustGoForTwo ? " — must go for 2" : "") +
      (this.overtime.isTwoPointShootout ? " — 2-pt shootout" : "")
    );
  }

  recordOvertimeCoinToss(winner: string, choice: CoinTossChoice): void {
    this.overtime.coinTossWinner = winner;
    this.overtime.coinTossChoice = choice;
    const loser = winner === this.homeTeam.id ? this.awayTeam.id : this.homeTeam.id;
    this.possession = (choice === CoinTossChoice.Receive) ? winner : loser;

    this.addEvent(GameEventType.OvertimeCoinToss, winner,
      `OT coin toss: ${winner} wins, elects to ${choice}`);
  }

  startKansasOTPossession(teamId: string): void {
    if (this.rules.overtime.type !== "kansas") return;
    this.possession = teamId;
    this.yardLine = this.rules.overtime.startingYardLine;
    this.down = Down.First;
    const yardsToEZ = 100 - this.rules.overtime.startingYardLine;
    this.distance = Math.min(10, yardsToEZ);
    this.overtime.teamsThatHavePossessed.add(teamId);

    this.addEvent(GameEventType.KansasOTPossession, teamId,
      `${teamId} starts OT possession at the ${yardsToEZ}-yard line`);
  }

  endKansasOTPossession(
    teamId: string,
    result: OvertimePossession["result"],
    points: number
  ): void {
    if (this.rules.overtime.type !== "kansas") return;
    this.overtime.possessions.push({ teamId, result, points });

    if (teamId === this.homeTeam.id) this.homeScore += points;
    else this.awayScore += points;

    const periodStart = (this.overtime.overtimePeriod - 1) * 2;
    const periodPoss = this.overtime.possessions.filter((_, i) => i >= periodStart);

    if (periodPoss.length >= 2) {
      if (this.homeScore !== this.awayScore) {
        this.phase = GamePhase.FinalOvertime;
        const winner = this.homeScore > this.awayScore ? this.homeTeam : this.awayTeam;
        this.addEvent(GameEventType.GameOver, winner.id,
          `Final (OT${this.overtime.overtimePeriod}): ${this.homeTeam.abbreviation} ${this.homeScore} — ${this.awayTeam.abbreviation} ${this.awayScore}`);
      } else {
        this.overtime.overtimePeriod++;
        this.resetTimeoutsForOvertime();
        this.overtime.mustGoForTwo =
          this.rules.overtime.forceTwoPointAfterPeriod > 0 &&
          this.overtime.overtimePeriod >= this.rules.overtime.forceTwoPointAfterPeriod;
        this.overtime.isTwoPointShootout =
          this.rules.overtime.twoPointShootoutAfterPeriod > 0 &&
          this.overtime.overtimePeriod >= this.rules.overtime.twoPointShootoutAfterPeriod;
        if (this.overtime.isTwoPointShootout) this.phase = GamePhase.TwoPointShootout;

        this.addEvent(GameEventType.OvertimeStart, undefined,
          `OT Period ${this.overtime.overtimePeriod} begins` +
          (this.overtime.mustGoForTwo ? " — must go for 2" : "") +
          (this.overtime.isTwoPointShootout ? " — 2-pt shootout" : ""));
      }
    }
  }

  private updateOvertimeState(play: Play, events: GameEvent[]): void {
    this.overtime.teamsThatHavePossessed.add(this.possession);

    if (this.rules.overtime.type === "timed") {
      const p = play as any;
      if (p.isTouchdown && this.overtime.isSuddenDeath) {
        this.phase = GamePhase.FinalOvertime;
        this.addEvent(GameEventType.GameOver, this.possession,
          `Final (OT): Sudden death TD by ${this.possession}`);
        events.push(this.events[this.events.length - 1]);
      } else if (p.isTouchdown) {
        const other = this.possession === this.homeTeam.id ? this.awayTeam.id : this.homeTeam.id;
        if (this.overtime.teamsThatHavePossessed.has(other)) {
          this.overtime.isSuddenDeath = true;
        }
      }
    }
  }

  private handleEndOfOvertimePeriod(events: GameEvent[]): void {
    if (this.homeScore !== this.awayScore) {
      this.phase = GamePhase.FinalOvertime;
      this.addEvent(GameEventType.GameOver, undefined,
        `Final (OT): ${this.homeTeam.abbreviation} ${this.homeScore} — ${this.awayTeam.abbreviation} ${this.awayScore}`);
      events.push(this.events[this.events.length - 1]);
    } else if (this.rules.overtime.canEndInTie &&
               this.overtime.overtimePeriod >= this.rules.overtime.maxPeriodsBeforeTie) {
      this.phase = GamePhase.Final;
      this.addEvent(GameEventType.GameOver, undefined,
        `Final (Tie): ${this.homeTeam.abbreviation} ${this.homeScore} — ${this.awayTeam.abbreviation} ${this.awayScore}`);
      events.push(this.events[this.events.length - 1]);
    } else {
      this.overtime.overtimePeriod++;
      this.gameClockSeconds = this.rules.overtime.periodLengthSeconds;
      this.resetTimeoutsForOvertime();
      this.addEvent(GameEventType.OvertimeStart, undefined,
        `Overtime Period ${this.overtime.overtimePeriod} begins`);
      events.push(this.events[this.events.length - 1]);
    }
  }

  // ---------------------------------------------------------------------------
  // POSSESSION CHANGE
  // ---------------------------------------------------------------------------

  private detectPossessionChange(play: Play): boolean {
    const p = play as any;
    if (play.type === PlayType.Pass && p.result === PassResult.Interception) {
      this.possession = this.possession === this.homeTeam.id ? this.awayTeam.id : this.homeTeam.id;
      return true;
    }
    if (p.fumble && p.fumble.recoveryTeam && p.fumble.recoveryTeam !== play.context.possessionTeam) {
      this.possession = p.fumble.recoveryTeam;
      return true;
    }
    if (play.type === PlayType.Punt && p.result !== SpecialTeamsResult.Block) {
      this.possession = this.possession === this.homeTeam.id ? this.awayTeam.id : this.homeTeam.id;
      return true;
    }
    return false;
  }

  // ---------------------------------------------------------------------------
  // SCORING
  // ---------------------------------------------------------------------------

  private detectScoring(play: Play, events: GameEvent[]): void {
    const p = play as any;
    if (p.isTouchdown) {
      if (this.possession === this.homeTeam.id) this.homeScore += 6;
      else this.awayScore += 6;
      if (this.overtime.isOvertime && this.overtime.isSuddenDeath) {
        this.phase = GamePhase.FinalOvertime;
        this.addEvent(GameEventType.GameOver, this.possession, `Final (OT): Sudden death TD`);
        events.push(this.events[this.events.length - 1]);
      }
    }
    if (play.type === PlayType.FieldGoal && p.result === KickResult.Good) {
      if (this.overtime.isOvertime && this.overtime.isSuddenDeath) {
        this.phase = GamePhase.FinalOvertime;
        this.addEvent(GameEventType.GameOver, this.possession, `Final (OT): FG by ${this.possession}`);
        events.push(this.events[this.events.length - 1]);
      }
    }
    if (play.type === PlayType.ExtraPoint && p.result === KickResult.Good) {
      if (this.possession === this.homeTeam.id) this.homeScore += 1;
      else this.awayScore += 1;
    }
  }

  // ---------------------------------------------------------------------------
  // CONTEXT ENRICHMENT
  // ---------------------------------------------------------------------------

  private enrichContext(ctx: Play["context"]): Play["context"] {
    return {
      ...ctx,
      isRedZone: ctx.yardLine >= 80,
      isGoalToGo: ctx.yardLine >= (100 - ctx.distance),
      isTwoMinuteWarning: this.rules.hasTwoMinuteWarning &&
        (this.quarter === Quarter.Second || this.quarter === Quarter.Fourth) &&
        this.gameClockSeconds <= 120,
    };
  }

  // ---------------------------------------------------------------------------
  // STATE ACCESSORS
  // ---------------------------------------------------------------------------

  getSnapshot(): GameStateSnapshot {
    return {
      phase: this.phase,
      ruleLevel: this.rules.level,
      quarter: this.quarter,
      gameClock: secondsToClock(this.gameClockSeconds),
      gameClockSeconds: this.gameClockSeconds,
      playClock: this.playClock,
      clockState: this.clockState,
      down: this.down, distance: this.distance, yardLine: this.yardLine,
      possession: this.possession,
      homeTeam: this.homeTeam, awayTeam: this.awayTeam,
      homeScore: this.homeScore, awayScore: this.awayScore,
      homeTimeouts: { ...this.homeTimeouts },
      awayTimeouts: { ...this.awayTimeouts },
      homeChallenges: { ...this.homeChallenges },
      awayChallenges: { ...this.awayChallenges },
      twoMinuteWarningUsed: { ...this.twoMinuteWarning },
      overtime: {
        ...this.overtime,
        teamsThatHavePossessed: new Set(this.overtime.teamsThatHavePossessed),
      },
      isMercyRule: this.mercyRuleActive,
      isFinal: this.phase === GamePhase.Final || this.phase === GamePhase.FinalOvertime,
      playCount: this.playCount,
      driveNumber: this.driveNumber,
    };
  }

  getEvents(): GameEvent[] { return [...this.events]; }
  getTimeoutsRemaining(teamId: string): number {
    return teamId === this.homeTeam.id ? this.homeTimeouts.remaining : this.awayTimeouts.remaining;
  }
  getChallengesRemaining(teamId: string): number {
    return teamId === this.homeTeam.id ? this.homeChallenges.remaining : this.awayChallenges.remaining;
  }
  isGameOver(): boolean { return this.phase === GamePhase.Final || this.phase === GamePhase.FinalOvertime; }
  isHalftime(): boolean { return this.phase === GamePhase.Halftime; }
  isOvertime(): boolean { return this.overtime.isOvertime; }
  isMercyRuleActive(): boolean { return this.mercyRuleActive; }
  getClockState(): ClockState { return this.clockState; }
  getPhase(): GamePhase { return this.phase; }
  getRuleLevel(): RuleLevel { return this.rules.level; }
  mustGoForTwoPointConversion(): boolean { return this.overtime.mustGoForTwo; }
  isTwoPointShootout(): boolean { return this.overtime.isTwoPointShootout; }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  private addEvent(type: GameEventType, teamId?: string, description?: string): void {
    this.events.push({
      type, quarter: this.quarter,
      gameClock: secondsToClock(this.gameClockSeconds),
      description: description ?? type, teamId,
    });
  }

  private getRecentEvents(n: number): GameEvent[] { return this.events.slice(-n); }

  private createTimeoutState(): TimeoutState {
    return { remaining: this.rules.timeoutsPerHalf, usedThisHalf: 0, totalUsed: 0, timestamps: [] };
  }
  private createChallengeState(): ChallengeState {
    return { remaining: this.rules.challengesPerHalf, used: 0, won: 0, lost: 0, history: [] };
  }
  private createNoChallengeState(): ChallengeState {
    return { remaining: 0, used: 0, won: 0, lost: 0, history: [] };
  }
  private createOvertimeState(): OvertimeState {
    return {
      isOvertime: false, overtimePeriod: 0, possessions: [],
      isFirstPossessionComplete: false, isSuddenDeath: false,
      teamsThatHavePossessed: new Set(), periodScores: [],
      isTwoPointShootout: false, mustGoForTwo: false,
    };
  }
}
