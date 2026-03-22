// ============================================================================
// RUSHING STATS CALCULATOR
// ============================================================================

import {
  Play, RushPlay, PassPlay, PassResult, PlayType, RushingStats, EngineConfig,
} from "../types";
import {
  initRushingStats, isRushPlay, isPassPlay, isRedZone, isThirdDown,
  isFirstDown, directionBucket, safeDivide,
} from "../utils";

export class RushingCalculator {
  private stats: Map<string, RushingStats> = new Map();

  constructor(
    private config: EngineConfig,
    private resolveName: (id: string) => string
  ) {}

  process(play: Play): void {
    // Standard rush plays
    if (isRushPlay(play)) {
      const p = play as RushPlay & { context: Play["context"] };
      this.processRush(p, play);
      return;
    }

    // QB scrambles count as rushing
    if (isPassPlay(play)) {
      const p = play as PassPlay & { context: Play["context"] };
      if (p.result === PassResult.Scramble) {
        this.processScramble(p, play);
      }
    }
  }

  private processRush(p: RushPlay, play: Play): void {
    const stat = this.getOrCreate(p.rusher);

    if (p.isKneel) {
      stat.kneels++;
      stat.carries++;
      stat.yards += p.yardsGained;
      return;
    }

    stat.carries++;
    stat.yards += p.yardsGained;
    stat.longRush = Math.max(stat.longRush, p.yardsGained);

    if (p.isTouchdown) stat.touchdowns++;
    if (p.yardsGained <= 0) stat.stuffedRuns++;
    if (p.yardsGained >= 10) stat.tenPlusYardRuns++;
    if (p.yardsGained >= 20) stat.twentyPlusYardRuns++;
    if (isFirstDown(play)) stat.firstDowns++;

    // Fumbles
    if (p.fumble) {
      stat.fumbles++;
      if (p.fumble.recoveryTeam && p.fumble.recoveryTeam !== play.context.possessionTeam) {
        stat.fumblesLost++;
      }
    }

    // Advanced
    if (this.config.trackAdvancedMetrics) {
      if (p.yardsAfterContact != null) stat.yardsAfterContact += p.yardsAfterContact;
      if (p.brokenTackles != null) stat.brokenTackles += p.brokenTackles;
    }

    // Directional
    if (this.config.trackDirectionalStats && p.direction) {
      const bucket = directionBucket(p.direction);
      if (bucket === "left") { stat.rushLeftCarries++; stat.rushLeftYards += p.yardsGained; }
      else if (bucket === "middle") { stat.rushMiddleCarries++; stat.rushMiddleYards += p.yardsGained; }
      else if (bucket === "right") { stat.rushRightCarries++; stat.rushRightYards += p.yardsGained; }
    }

    // Situational
    if (this.config.trackSituationalSplits) {
      if (isRedZone(play)) {
        stat.redZoneCarries++;
        if (p.isTouchdown) stat.redZoneTouchdowns++;
      }
      if (isThirdDown(play)) {
        stat.thirdDownCarries++;
        if (isFirstDown(play)) stat.thirdDownConversions++;
      }
    }
  }

  private processScramble(p: PassPlay, play: Play): void {
    const stat = this.getOrCreate(p.passer);
    stat.scrambles++;
    stat.scrambleYards += p.yardsGained;
    stat.carries++;
    stat.yards += p.yardsGained;
    stat.longRush = Math.max(stat.longRush, p.yardsGained);
    if (p.isTouchdown) stat.touchdowns++;
    if (p.yardsGained <= 0) stat.stuffedRuns++;
    if (p.yardsGained >= 10) stat.tenPlusYardRuns++;
    if (p.yardsGained >= 20) stat.twentyPlusYardRuns++;
    if (isFirstDown(play)) stat.firstDowns++;
  }

  finalize(): Map<string, RushingStats> {
    for (const stat of this.stats.values()) {
      stat.yardsPerCarry = safeDivide(stat.yards, stat.carries);
    }
    return this.stats;
  }

  private getOrCreate(playerId: string): RushingStats {
    let s = this.stats.get(playerId);
    if (!s) {
      s = initRushingStats(playerId, this.resolveName(playerId));
      this.stats.set(playerId, s);
    }
    return s;
  }

  getStats(): Map<string, RushingStats> {
    return this.stats;
  }
}
