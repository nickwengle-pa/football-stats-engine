// ============================================================================
// RECEIVING STATS CALCULATOR
// ============================================================================

import {
  Play, PassPlay, PassResult, PlayType, ReceivingStats, EngineConfig,
} from "../types";
import {
  initReceivingStats, isPassPlay, isRedZone, isThirdDown,
  isFirstDown, safeDivide, round,
} from "../utils";

export class ReceivingCalculator {
  private stats: Map<string, ReceivingStats> = new Map();
  private airYardsAccum: Map<string, { total: number; count: number }> = new Map();

  constructor(
    private config: EngineConfig,
    private resolveName: (id: string) => string
  ) {}

  process(play: Play): void {
    if (!isPassPlay(play)) return;
    const p = play as PassPlay & { context: Play["context"] };

    // Skip sacks, scrambles, throw-aways, spikes (no receiver involved)
    if ([PassResult.Sack, PassResult.Scramble, PassResult.ThrowAway, PassResult.SpikeBall].includes(p.result)) {
      return;
    }

    // Need at least a target
    const targetId = p.target ?? p.receiver;
    if (!targetId) return;

    const stat = this.getOrCreate(targetId);
    const isComplete = p.result === PassResult.Complete;

    // Target
    stat.targets++;

    // Air yards on all targets (for avg depth of target)
    if (this.config.trackAdvancedMetrics && p.airYards != null) {
      const acc = this.airYardsAccum.get(targetId) ?? { total: 0, count: 0 };
      acc.total += p.airYards;
      acc.count++;
      this.airYardsAccum.set(targetId, acc);
    }

    if (isComplete) {
      stat.receptions++;
      stat.yards += p.yardsGained;
      stat.longReception = Math.max(stat.longReception, p.yardsGained);

      if (p.isTouchdown) stat.touchdowns++;
      if (p.yardsGained >= 20) stat.twentyPlusYardReceptions++;
      if (p.yardsGained >= 40) stat.fortyPlusYardReceptions++;
      if (isFirstDown(play)) stat.firstDowns++;

      // Advanced
      if (this.config.trackAdvancedMetrics) {
        if (p.airYards != null) {
          stat.airYards += p.airYards;
          stat.yardsBeforeCatch += p.airYards;
        }
        if (p.yardsAfterCatch != null) stat.yardsAfterCatch += p.yardsAfterCatch;
      }

      // Fumbles on reception
      if (p.fumble) {
        stat.fumbles++;
        if (p.fumble.recoveryTeam && p.fumble.recoveryTeam !== play.context.possessionTeam) {
          stat.fumblesLost++;
        }
      }
    }

    // Situational
    if (this.config.trackSituationalSplits) {
      if (isRedZone(play)) {
        stat.redZoneTargets++;
        if (isComplete) stat.redZoneReceptions++;
        if (isComplete && p.isTouchdown) stat.redZoneTouchdowns++;
      }
      if (isThirdDown(play)) {
        stat.thirdDownTargets++;
        if (isComplete) stat.thirdDownReceptions++;
        if (isComplete && isFirstDown(play)) stat.thirdDownConversions++;
      }
    }
  }

  finalize(): Map<string, ReceivingStats> {
    for (const [id, stat] of this.stats) {
      stat.yardsPerReception = safeDivide(stat.yards, stat.receptions);
      stat.yardsPerTarget = safeDivide(stat.yards, stat.targets);
      stat.catchPercentage = safeDivide(stat.receptions * 100, stat.targets);

      // Avg depth of target
      const acc = this.airYardsAccum.get(id);
      if (acc && acc.count > 0) {
        stat.avgDepthOfTarget = round(acc.total / acc.count, 1);
      }
    }
    return this.stats;
  }

  private getOrCreate(playerId: string): ReceivingStats {
    let s = this.stats.get(playerId);
    if (!s) {
      s = initReceivingStats(playerId, this.resolveName(playerId));
      this.stats.set(playerId, s);
    }
    return s;
  }

  getStats(): Map<string, ReceivingStats> {
    return this.stats;
  }
}
