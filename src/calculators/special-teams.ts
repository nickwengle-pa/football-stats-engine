// ============================================================================
// SPECIAL TEAMS STATS CALCULATOR
// ============================================================================

import {
  Play, SpecialTeamsPlay, PlayType, KickResult, SpecialTeamsResult,
  KickingStats, PuntingStats, ReturnStats, EngineConfig,
} from "../types";
import {
  initKickingStats, initPuntingStats, initReturnStats,
  isSpecialTeamsPlay, safeDivide, round,
} from "../utils";

export class SpecialTeamsCalculator {
  private kicking: Map<string, KickingStats> = new Map();
  private punting: Map<string, PuntingStats> = new Map();
  private returns: Map<string, ReturnStats> = new Map();
  private kickoffDistanceAccum: Map<string, { total: number; count: number }> = new Map();
  private hangTimeAccum: Map<string, { total: number; count: number }> = new Map();

  constructor(
    private config: EngineConfig,
    private resolveName: (id: string) => string
  ) {}

  process(play: Play): void {
    if (!isSpecialTeamsPlay(play)) return;
    const p = play as SpecialTeamsPlay & { context: Play["context"] };

    switch (play.type) {
      case PlayType.FieldGoal:
        this.processFieldGoal(p);
        break;
      case PlayType.ExtraPoint:
        this.processExtraPoint(p);
        break;
      case PlayType.Punt:
        this.processPunt(p);
        break;
      case PlayType.Kickoff:
      case PlayType.FreeKick:
        this.processKickoff(p);
        break;
    }
  }

  // ---------------------------------------------------------------------------
  // FIELD GOALS
  // ---------------------------------------------------------------------------

  private processFieldGoal(p: SpecialTeamsPlay): void {
    if (!p.kicker) return;
    const stat = this.getKicking(p.kicker);
    const distance = p.fieldGoalDistance ?? p.kickDistance ?? 0;
    const result = p.result as KickResult;

    stat.fieldGoalAttempts++;

    if (result === KickResult.Good) {
      stat.fieldGoalMade++;
      stat.totalPoints += 3;
      stat.fieldGoalLong = Math.max(stat.fieldGoalLong, distance);
    } else if (result === KickResult.Blocked) {
      stat.fieldGoalBlocked++;
    }

    // Distance buckets
    if (distance < 20) { stat.fg0to19Att++; if (result === KickResult.Good) stat.fg0to19Made++; }
    else if (distance < 30) { stat.fg20to29Att++; if (result === KickResult.Good) stat.fg20to29Made++; }
    else if (distance < 40) { stat.fg30to39Att++; if (result === KickResult.Good) stat.fg30to39Made++; }
    else if (distance < 50) { stat.fg40to49Att++; if (result === KickResult.Good) stat.fg40to49Made++; }
    else { stat.fg50PlusAtt++; if (result === KickResult.Good) stat.fg50PlusMade++; }
  }

  // ---------------------------------------------------------------------------
  // EXTRA POINTS
  // ---------------------------------------------------------------------------

  private processExtraPoint(p: SpecialTeamsPlay): void {
    if (!p.kicker) return;
    const stat = this.getKicking(p.kicker);
    const result = p.result as KickResult;

    stat.extraPointAttempts++;

    if (result === KickResult.Good) {
      stat.extraPointMade++;
      stat.totalPoints += 1;
    } else if (result === KickResult.Blocked) {
      stat.extraPointBlocked++;
    }
  }

  // ---------------------------------------------------------------------------
  // PUNTS
  // ---------------------------------------------------------------------------

  private processPunt(p: SpecialTeamsPlay): void {
    if (p.punter) {
      const stat = this.getPunting(p.punter);
      const result = p.result as SpecialTeamsResult;

      stat.punts++;

      if (result === SpecialTeamsResult.Block) {
        stat.puntsBlocked++;
      } else {
        const distance = p.kickDistance ?? 0;
        stat.puntYards += distance;
        stat.puntLong = Math.max(stat.puntLong, distance);

        if (result === SpecialTeamsResult.Touchback) stat.touchbacks++;
        if (result === SpecialTeamsResult.FairCatch) stat.puntsFairCaught++;

        // Inside 20 — determined by kick landing spot
        // Rough heuristic: if the play's ending yard line is between 80-99 for the receiving team
        // More accurate logic would require knowing the result field position

        // Return yards against
        if (p.returnYards != null) {
          stat.puntReturnYardsAgainst += p.returnYards;
        }

        // Hang time
        if (p.hangTime != null) {
          const acc = this.hangTimeAccum.get(p.punter) ?? { total: 0, count: 0 };
          acc.total += p.hangTime;
          acc.count++;
          this.hangTimeAccum.set(p.punter, acc);
        }
      }
    }

    // Punt returner stats
    if (p.returner && p.result !== SpecialTeamsResult.Block) {
      const retStat = this.getReturn(p.returner);
      const result = p.result as SpecialTeamsResult;

      if (result === SpecialTeamsResult.FairCatch) {
        retStat.puntReturnFairCatches++;
      } else if (result !== SpecialTeamsResult.Touchback) {
        retStat.puntReturns++;
        retStat.puntReturnYards += (p.returnYards ?? 0);
        retStat.puntReturnLong = Math.max(retStat.puntReturnLong, p.returnYards ?? 0);

        if (result === SpecialTeamsResult.ReturnTouchdown || p.isTouchdown) {
          retStat.puntReturnTouchdowns++;
        }
        if (p.fumble) retStat.puntReturnFumbles++;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // KICKOFFS
  // ---------------------------------------------------------------------------

  private processKickoff(p: SpecialTeamsPlay): void {
    if (p.kicker) {
      const stat = this.getKicking(p.kicker);
      stat.kickoffs++;

      if (p.kickDistance != null) {
        const acc = this.kickoffDistanceAccum.get(p.kicker) ?? { total: 0, count: 0 };
        acc.total += p.kickDistance;
        acc.count++;
        this.kickoffDistanceAccum.set(p.kicker, acc);
      }

      if (p.isTouchback) stat.kickoffTouchbacks++;
      if (p.isOnsideKick) {
        stat.onsideKickAttempts++;
        // Recovery logic would need fumble/recovery data
      }
    }

    // Kick returner stats
    if (p.returner && !p.isTouchback) {
      const retStat = this.getReturn(p.returner);
      const result = p.result as SpecialTeamsResult;

      if (result !== SpecialTeamsResult.FairCatch) {
        retStat.kickReturns++;
        retStat.kickReturnYards += (p.returnYards ?? 0);
        retStat.kickReturnLong = Math.max(retStat.kickReturnLong, p.returnYards ?? 0);

        if (result === SpecialTeamsResult.ReturnTouchdown || p.isTouchdown) {
          retStat.kickReturnTouchdowns++;
        }
        if (p.fumble) retStat.kickReturnFumbles++;
      }
    }
  }

  // ---------------------------------------------------------------------------
  // FINALIZE
  // ---------------------------------------------------------------------------

  finalize(): {
    kicking: Map<string, KickingStats>;
    punting: Map<string, PuntingStats>;
    returns: Map<string, ReturnStats>;
  } {
    // Kicking percentages
    for (const [id, stat] of this.kicking) {
      stat.fieldGoalPercentage = safeDivide(stat.fieldGoalMade * 100, stat.fieldGoalAttempts);
      stat.extraPointPercentage = safeDivide(stat.extraPointMade * 100, stat.extraPointAttempts);

      const koAcc = this.kickoffDistanceAccum.get(id);
      if (koAcc && koAcc.count > 0) {
        stat.averageKickoffDistance = round(koAcc.total / koAcc.count, 1);
      }
      stat.kickoffTouchbackPercentage = safeDivide(stat.kickoffTouchbacks * 100, stat.kickoffs);
    }

    // Punting averages
    for (const [id, stat] of this.punting) {
      const validPunts = stat.punts - stat.puntsBlocked;
      stat.puntAverage = safeDivide(stat.puntYards, validPunts);
      stat.netPuntAverage = safeDivide(stat.puntYards - stat.puntReturnYardsAgainst, validPunts);

      const htAcc = this.hangTimeAccum.get(id);
      if (htAcc && htAcc.count > 0) {
        stat.hangTimeAvg = round(htAcc.total / htAcc.count, 2);
      }
    }

    // Return averages
    for (const stat of this.returns.values()) {
      stat.kickReturnAverage = safeDivide(stat.kickReturnYards, stat.kickReturns);
      stat.puntReturnAverage = safeDivide(stat.puntReturnYards, stat.puntReturns);
    }

    return {
      kicking: this.kicking,
      punting: this.punting,
      returns: this.returns,
    };
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  private getKicking(id: string): KickingStats {
    let s = this.kicking.get(id);
    if (!s) { s = initKickingStats(id, this.resolveName(id)); this.kicking.set(id, s); }
    return s;
  }

  private getPunting(id: string): PuntingStats {
    let s = this.punting.get(id);
    if (!s) { s = initPuntingStats(id, this.resolveName(id)); this.punting.set(id, s); }
    return s;
  }

  private getReturn(id: string): ReturnStats {
    let s = this.returns.get(id);
    if (!s) { s = initReturnStats(id, this.resolveName(id)); this.returns.set(id, s); }
    return s;
  }
}
