// ============================================================================
// FOOTBALL STATS ENGINE — MAIN ORCHESTRATOR
// ============================================================================
//
// Usage:
//   const engine = new FootballStatsEngine(config);
//   engine.setTeams(homeTeam, awayTeam);
//   for (const play of plays) engine.processPlay(play);
//   const summary = engine.getGameSummary();
//
// The engine processes plays one at a time, maintaining running state.
// Call getGameSummary() at any point for a snapshot (live stats).
// ============================================================================

import {
  Play, PlayType, TeamId, EngineConfig, GameSummary, Quarter,
} from "./types";

import { PassingCalculator }      from "./calculators/passing";
import { RushingCalculator }      from "./calculators/rushing";
import { ReceivingCalculator }    from "./calculators/receiving";
import { DefensiveCalculator }    from "./calculators/defense";
import { SpecialTeamsCalculator } from "./calculators/special-teams";
import { TeamCalculator }         from "./calculators/team";
import { PenaltyCalculator }      from "./calculators/penalty";
import {
  GameStateManager, GameStateSnapshot, GameEvent,
  CoinTossChoice, GamePhase, RuleLevel, RuleSet,
} from "./game-state";

function mapToRecord<T>(m: Map<string, T>): Record<string, T> {
  const out: Record<string, T> = {};
  for (const [k, v] of m) out[k] = v;
  return out;
}

export class FootballStatsEngine {
  private config: EngineConfig;
  private homeTeam!: TeamId;
  private awayTeam!: TeamId;
  private playerNames: Map<string, string> = new Map();

  private passingCalc!: PassingCalculator;
  private rushingCalc!: RushingCalculator;
  private receivingCalc!: ReceivingCalculator;
  private defenseCalc!: DefensiveCalculator;
  private specialTeamsCalc!: SpecialTeamsCalculator;
  private teamCalc!: TeamCalculator;
  private penaltyCalc!: PenaltyCalculator;

  /** Game state manager — tracks timeouts, clock, quarters, OT, challenges */
  private gameState: GameStateManager;
  private gameStateEnabled: boolean;

  private plays: Play[] = [];
  private gameId = "";
  private lastQuarter: Quarter = Quarter.First;
  private lastClock = "15:00";
  private initialized = false;
  private finalized = false;

  constructor(config?: Partial<EngineConfig> & {
    enableGameState?: boolean;
    rules?: RuleLevel;
    customRules?: Partial<RuleSet>;
  }) {
    const { enableGameState = true, rules = "nfl", customRules, ...rest } = config ?? {};
    this.config = {
      trackAdvancedMetrics: true,
      trackDirectionalStats: true,
      trackSituationalSplits: true,
      trackDrives: true,
      computePasserRating: true,
      ...rest,
    };
    this.gameStateEnabled = enableGameState;
    this.gameState = new GameStateManager(rules, customRules);
  }

  // ---------------------------------------------------------------------------
  // SETUP
  // ---------------------------------------------------------------------------

  /** Register the two teams. Must be called before processing plays. */
  setTeams(home: TeamId, away: TeamId): void {
    this.homeTeam = home;
    this.awayTeam = away;
    this.initializeCalculators();
    if (this.gameStateEnabled) {
      this.gameState.setTeams(home, away);
    }
  }

  /** Optionally register player names upfront (otherwise derived from play data) */
  registerPlayer(playerId: string, name: string): void {
    this.playerNames.set(playerId, name);
  }

  /** Bulk register players */
  registerPlayers(players: Array<{ id: string; name: string }>): void {
    for (const p of players) this.playerNames.set(p.id, p.name);
  }

  // ---------------------------------------------------------------------------
  // GAME STATE — Coin toss, timeouts, challenges, injuries
  // ---------------------------------------------------------------------------

  /** Record the opening coin toss */
  recordCoinToss(winner: string, choice: CoinTossChoice): void {
    if (this.gameStateEnabled) this.gameState.recordCoinToss(winner, choice);
  }

  /** Record the overtime coin toss */
  recordOvertimeCoinToss(winner: string, choice: CoinTossChoice): void {
    if (this.gameStateEnabled) this.gameState.recordOvertimeCoinToss(winner, choice);
  }

  /** Call a timeout for a team. Returns false if no timeouts remaining. */
  callTimeout(teamId: string): boolean {
    if (!this.gameStateEnabled) return false;
    return this.gameState.processTimeout(teamId);
  }

  /** Record a coach's challenge and its result */
  recordChallenge(
    teamId: string,
    result: "upheld" | "overturned" | "stands",
    playDescription?: string
  ): boolean {
    if (!this.gameStateEnabled) return false;
    return this.gameState.recordChallenge(teamId, result, playDescription);
  }

  /** Record a booth review (not charged to either team) */
  recordBoothReview(result: "upheld" | "overturned" | "stands", description?: string): void {
    if (this.gameStateEnabled) this.gameState.recordBoothReview(result, description);
  }

  /** Record an injury timeout */
  recordInjuryTimeout(teamId?: string): void {
    if (this.gameStateEnabled) this.gameState.recordInjuryTimeout(teamId);
  }

  /** Get timeouts remaining for a team */
  getTimeoutsRemaining(teamId: string): number {
    if (!this.gameStateEnabled) return -1;
    return this.gameState.getTimeoutsRemaining(teamId);
  }

  /** Get challenges remaining for a team */
  getChallengesRemaining(teamId: string): number {
    if (!this.gameStateEnabled) return -1;
    return this.gameState.getChallengesRemaining(teamId);
  }

  /** Is the game over? */
  isGameOver(): boolean {
    if (!this.gameStateEnabled) return false;
    return this.gameState.isGameOver();
  }

  /** Is it halftime? */
  isHalftime(): boolean {
    if (!this.gameStateEnabled) return false;
    return this.gameState.isHalftime();
  }

  /** Is it overtime? */
  isOvertime(): boolean {
    if (!this.gameStateEnabled) return false;
    return this.gameState.isOvertime();
  }

  /** Get the current game phase */
  getGamePhase(): GamePhase | null {
    if (!this.gameStateEnabled) return null;
    return this.gameState.getPhase();
  }

  /** Get full game state snapshot */
  getGameStateSnapshot(): GameStateSnapshot | null {
    if (!this.gameStateEnabled) return null;
    return this.gameState.getSnapshot();
  }

  /** Get all game events (timeouts, quarter changes, etc.) */
  getGameEvents(): GameEvent[] {
    if (!this.gameStateEnabled) return [];
    return this.gameState.getEvents();
  }

  // ---------------------------------------------------------------------------
  // INTERNAL
  // ---------------------------------------------------------------------------

  private initializeCalculators(): void {
    const resolve = this.resolvePlayerName.bind(this);

    this.passingCalc = new PassingCalculator(this.config, resolve);
    this.rushingCalc = new RushingCalculator(this.config, resolve);
    this.receivingCalc = new ReceivingCalculator(this.config, resolve);
    this.defenseCalc = new DefensiveCalculator(this.config, resolve);
    this.specialTeamsCalc = new SpecialTeamsCalculator(this.config, resolve);
    this.penaltyCalc = new PenaltyCalculator(this.config, resolve, this.gameState.rules.level);
    this.teamCalc = new TeamCalculator(
      this.config,
      this.homeTeam.id, this.awayTeam.id,
      this.homeTeam.name, this.awayTeam.name,
    );
    this.initialized = true;
    this.finalized = false;
  }

  private resolvePlayerName(playerId: string): string {
    if (this.config.resolvePlayerName) {
      return this.config.resolvePlayerName(playerId);
    }
    return this.playerNames.get(playerId) ?? playerId;
  }

  // ---------------------------------------------------------------------------
  // PLAY PROCESSING
  // ---------------------------------------------------------------------------

  /** Process a single play. Call this in sequence for each play. */
  processPlay(play: Play): { events: GameEvent[] } {
    if (!this.initialized) {
      throw new Error("Call setTeams() before processing plays.");
    }

    let events: GameEvent[] = [];

    // --- Run through game state manager first ---
    if (this.gameStateEnabled) {
      const stateResult = this.gameState.processPlay(play);
      events = stateResult.events;

      // Use enriched context (red zone, goal-to-go, 2-min flag set automatically)
      play = { ...play, context: stateResult.updatedContext };

      // If the game state says this is a no-play, skip stat processing
      if (!stateResult.shouldProcess) {
        this.plays.push(play);
        return { events };
      }
    }

    this.finalized = false;
    this.plays.push(play);
    this.gameId = play.context.gameId;
    this.lastQuarter = play.context.quarter;
    this.lastClock = play.context.gameClock;

    // Fan out to all calculators
    this.passingCalc.process(play);
    this.rushingCalc.process(play);
    this.receivingCalc.process(play);
    this.defenseCalc.process(play);
    this.specialTeamsCalc.process(play);
    this.penaltyCalc.process(play);
    this.teamCalc.process(play);

    return { events };
  }

  /** Process an array of plays at once. Returns all game events triggered. */
  processPlays(plays: Play[]): { allEvents: GameEvent[] } {
    const allEvents: GameEvent[] = [];
    for (const play of plays) {
      const { events } = this.processPlay(play);
      allEvents.push(...events);
    }
    return { allEvents };
  }

  // ---------------------------------------------------------------------------
  // OUTPUT
  // ---------------------------------------------------------------------------

  /** Get the complete game summary. Can be called at any point (live or final). */
  getGameSummary(): GameSummary {
    if (!this.initialized) {
      throw new Error("Call setTeams() before getting summary.");
    }

    // Finalize all calculators (recomputes derived fields)
    const passing = this.passingCalc.finalize();
    const rushing = this.rushingCalc.finalize();
    const receiving = this.receivingCalc.finalize();
    const defense = this.defenseCalc.finalize();
    const st = this.specialTeamsCalc.finalize();
    const pen = this.penaltyCalc.finalize();
    const { teamStats, drives, scoringPlays } = this.teamCalc.finalize();

    const homeStats = teamStats.get(this.homeTeam.id)!;
    const awayStats = teamStats.get(this.awayTeam.id)!;

    return {
      gameId: this.gameId,
      homeTeam: this.homeTeam,
      awayTeam: this.awayTeam,
      homeScore: homeStats?.pointsScored ?? 0,
      awayScore: awayStats?.pointsScored ?? 0,
      quarter: this.lastQuarter,
      gameClock: this.lastClock,
      isFinal: this.gameStateEnabled ? this.gameState.isGameOver() : false,
      totalPlays: this.plays.length,

      homeTeamStats: homeStats,
      awayTeamStats: awayStats,

      passing: mapToRecord(passing),
      rushing: mapToRecord(rushing),
      receiving: mapToRecord(receiving),
      defense: mapToRecord(defense),
      kicking: mapToRecord(st.kicking),
      punting: mapToRecord(st.punting),
      returns: mapToRecord(st.returns),

      playerPenalties: mapToRecord(pen.playerPenalties),
      teamPenalties: mapToRecord(pen.teamPenalties),

      drives,
      scoringPlays,
    };
  }

  // ---------------------------------------------------------------------------
  // CONVENIENCE GETTERS (for live dashboards)
  // ---------------------------------------------------------------------------

  /** Get passing stats for a specific player */
  getPassingStats(playerId: string) {
    return this.passingCalc.getStats().get(playerId) ?? null;
  }

  /** Get rushing stats for a specific player */
  getRushingStats(playerId: string) {
    return this.rushingCalc.getStats().get(playerId) ?? null;
  }

  /** Get receiving stats for a specific player */
  getReceivingStats(playerId: string) {
    return this.receivingCalc.getStats().get(playerId) ?? null;
  }

  /** Get defensive stats for a specific player */
  getDefensiveStats(playerId: string) {
    return this.defenseCalc.getStats().get(playerId) ?? null;
  }

  /** Get total plays processed */
  getPlayCount(): number {
    return this.plays.length;
  }

  /** Get all raw plays (useful for replay / analysis) */
  getRawPlays(): readonly Play[] {
    return this.plays;
  }

  /** Reset the engine for a new game */
  reset(): void {
    this.plays = [];
    this.gameId = "";
    this.lastQuarter = Quarter.First;
    this.lastClock = "15:00";
    this.finalized = false;
    if (this.gameStateEnabled) {
      this.gameState = new GameStateManager(this.gameState.rules.level);
      if (this.homeTeam && this.awayTeam) {
        this.gameState.setTeams(this.homeTeam, this.awayTeam);
      }
    }
    if (this.homeTeam && this.awayTeam) {
      this.initializeCalculators();
    }
  }
}
