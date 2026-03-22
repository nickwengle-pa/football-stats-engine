// ============================================================================
// TEAM STATS & DRIVE CALCULATOR
// ============================================================================

import {
  Play, PassPlay, RushPlay, SpecialTeamsPlay, PenaltyPlay,
  PlayType, PassResult, KickResult, SpecialTeamsResult,
  TeamStats, DriveStats, DriveResult, Quarter, EngineConfig,
  ScoringPlay,
} from "../types";
import {
  initTeamStats, isPassPlay, isRushPlay, isSpecialTeamsPlay,
  isRedZone, isThirdDown, isFourthDown, isFirstDown, isGoalToGo,
  safeDivide, clockToSeconds, secondsToClock, round,
} from "../utils";

interface DriveAccumulator {
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
  firstDowns: number;
  penalties: number;
  penaltyYards: number;
  maxYardLine: number;  // for red zone detection
}

export class TeamCalculator {
  private stats: Map<string, TeamStats> = new Map();
  private scoringPlays: ScoringPlay[] = [];
  private drives: DriveStats[] = [];
  private currentDrive: DriveAccumulator | null = null;
  private currentDriveNumber = 0;
  private topAccum: Map<string, number> = new Map(); // seconds of possession
  private redZoneTracked: Set<number> = new Set();    // drive numbers that already counted a RZ trip
  private startingPositions: Map<string, number[]> = new Map();
  private lastHomeScore = 0;
  private lastAwayScore = 0;

  constructor(
    private config: EngineConfig,
    private homeTeamId: string,
    private awayTeamId: string,
    private homeTeamName: string,
    private awayTeamName: string,
  ) {
    this.getOrCreate(homeTeamId, homeTeamName);
    this.getOrCreate(awayTeamId, awayTeamName);
  }

  process(play: Play): void {
    const teamId = play.context.possessionTeam;
    const stat = this.getOrCreate(teamId, teamId === this.homeTeamId ? this.homeTeamName : this.awayTeamName);

    // --- DRIVE TRACKING ---
    if (this.config.trackDrives !== false) {
      this.trackDrive(play);
    }

    // --- SKIP NON-PLAY EVENTS ---
    if (play.type === PlayType.Timeout || play.type === PlayType.NoPlay) return;

    // --- PENALTY-ONLY PLAYS ---
    if (play.type === PlayType.Penalty) {
      const pp = play as PenaltyPlay;
      for (const pen of pp.penalties) {
        if (pen.enforcement === "accepted") {
          const penTeamStat = this.getOrCreate(pen.team, pen.team === this.homeTeamId ? this.homeTeamName : this.awayTeamName);
          penTeamStat.penalties++;
          penTeamStat.penaltyYards += pen.yards;
        }
      }
      return;
    }

    // --- PASS PLAYS ---
    if (isPassPlay(play)) {
      const p = play as PassPlay & { context: Play["context"] };

      // Sacks
      if (p.result === PassResult.Sack) {
        stat.totalPlays++;
        stat.sacks++;
        stat.sackYardsLost += Math.abs(p.yardsGained);
        stat.totalYards += p.yardsGained; // negative
        this.checkTurnover(p, stat, play);
        return;
      }

      // Scrambles => count as rush
      if (p.result === PassResult.Scramble) {
        stat.totalPlays++;
        stat.rushAttempts++;
        stat.rushingYards += p.yardsGained;
        stat.totalYards += p.yardsGained;
        if (isFirstDown(play)) {
          stat.firstDowns++;
          stat.firstDownsRushing++;
        }
        this.checkSituational(stat, play, p.yardsGained, p.isTouchdown);
        this.checkScoring(play, p.isTouchdown, p.yardsGained, "rushing_td");
        return;
      }

      // Spikes
      if (p.result === PassResult.SpikeBall) {
        stat.totalPlays++;
        stat.passAttempts++;
        return;
      }

      stat.totalPlays++;
      stat.passAttempts++;

      if (p.result === PassResult.Complete) {
        stat.passCompletions++;
        stat.passingYards += p.yardsGained;
        stat.totalYards += p.yardsGained;

        if (isFirstDown(play)) {
          stat.firstDowns++;
          stat.firstDownsPassing++;
        }

        this.checkScoring(play, p.isTouchdown, p.yardsGained, "passing_td");
      }

      if (p.result === PassResult.Interception) {
        stat.interceptionsThrown++;
        stat.turnovers++;
      }

      this.checkTurnover(p, stat, play);
      this.checkSituational(stat, play, p.yardsGained, p.isTouchdown);

      // Penalties on the play
      this.processPenaltiesOnPlay(play);
      return;
    }

    // --- RUSH PLAYS ---
    if (isRushPlay(play)) {
      const p = play as RushPlay & { context: Play["context"] };

      stat.totalPlays++;
      stat.rushAttempts++;
      stat.rushingYards += p.yardsGained;
      stat.totalYards += p.yardsGained;

      if (isFirstDown(play)) {
        stat.firstDowns++;
        stat.firstDownsRushing++;
      }

      // Fumble
      if (p.fumble && p.fumble.recoveryTeam && p.fumble.recoveryTeam !== teamId) {
        stat.fumblesLost++;
        stat.turnovers++;
      }

      this.checkSituational(stat, play, p.yardsGained, p.isTouchdown);
      this.checkScoring(play, p.isTouchdown, p.yardsGained, "rushing_td");
      this.processPenaltiesOnPlay(play);
      return;
    }

    // --- SPECIAL TEAMS ---
    if (isSpecialTeamsPlay(play)) {
      const p = play as SpecialTeamsPlay & { context: Play["context"] };

      if (play.type === PlayType.FieldGoal) {
        const result = p.result as KickResult;
        if (result === KickResult.Good) {
          stat.pointsScored += 3;
          if (isRedZone(play)) stat.redZoneFieldGoals++;
          this.addScoringPlay(play, "field_goal", 3);
        }
      }

      if (play.type === PlayType.ExtraPoint) {
        const result = p.result as KickResult;
        if (result === KickResult.Good) {
          stat.pointsScored += 1;
          this.addScoringPlay(play, "extra_point", 1);
        }
      }

      if (play.type === PlayType.Punt) {
        stat.puntCount++;
      }

      this.processPenaltiesOnPlay(play);
    }
  }

  // ---------------------------------------------------------------------------
  // DRIVE TRACKING
  // ---------------------------------------------------------------------------

  private trackDrive(play: Play): void {
    const teamId = play.context.possessionTeam;
    const driveNum = play.context.driveNumber ?? 0;

    // New drive detected
    if (!this.currentDrive || driveNum !== this.currentDriveNumber || this.currentDrive.team !== teamId) {
      // Close out previous drive
      if (this.currentDrive) {
        this.finalizeDrive(this.currentDrive, play);
      }

      this.currentDriveNumber = driveNum;
      this.currentDrive = {
        driveNumber: driveNum,
        team: teamId,
        startQuarter: play.context.quarter,
        startTime: play.context.gameClock,
        startYardLine: play.context.yardLine,
        endQuarter: play.context.quarter,
        endTime: play.context.gameClock,
        endYardLine: play.context.yardLine,
        plays: 0,
        yards: 0,
        firstDowns: 0,
        penalties: 0,
        penaltyYards: 0,
        maxYardLine: play.context.yardLine,
      };

      // Track starting field position
      const positions = this.startingPositions.get(teamId) ?? [];
      positions.push(play.context.yardLine);
      this.startingPositions.set(teamId, positions);

      // Team drive count
      const stat = this.stats.get(teamId);
      if (stat) stat.totalDrives++;
    }

    const d = this.currentDrive!;
    d.endQuarter = play.context.quarter;
    d.endTime = play.context.gameClock;
    d.maxYardLine = Math.max(d.maxYardLine, play.context.yardLine);

    if (play.type !== PlayType.Timeout && play.type !== PlayType.NoPlay) {
      d.plays++;
      const p = play as any;
      if (p.yardsGained != null) {
        d.yards += p.yardsGained;
        d.endYardLine = play.context.yardLine + p.yardsGained;
      }
      if (isFirstDown(play)) d.firstDowns++;
    }

    // Red zone tracking per drive
    if (d.maxYardLine >= 80 && !this.redZoneTracked.has(driveNum)) {
      this.redZoneTracked.add(driveNum);
      const stat = this.stats.get(teamId);
      if (stat) stat.redZoneTrips++;
    }
  }

  private finalizeDrive(d: DriveAccumulator, nextPlay?: Play): void {
    // Determine drive result
    let result = DriveResult.Punt; // default
    const lastYardLine = d.endYardLine;

    // Simple heuristics (more accurate with richer data)
    if (d.yards > 0 && lastYardLine >= 100) {
      result = DriveResult.Touchdown;
    }

    // Calculate drive time
    let driveSec = 0;
    if (d.startQuarter === d.endQuarter) {
      driveSec = clockToSeconds(d.startTime) - clockToSeconds(d.endTime);
    } else {
      // Multi-quarter drive (simplified)
      driveSec = clockToSeconds(d.startTime) + (900 - clockToSeconds(d.endTime));
    }
    driveSec = Math.max(0, driveSec);

    // Add to TOP
    const topSec = this.topAccum.get(d.team) ?? 0;
    this.topAccum.set(d.team, topSec + driveSec);

    this.drives.push({
      driveNumber: d.driveNumber,
      team: d.team,
      startQuarter: d.startQuarter,
      startTime: d.startTime,
      startYardLine: d.startYardLine,
      endQuarter: d.endQuarter,
      endTime: d.endTime,
      endYardLine: d.endYardLine,
      plays: d.plays,
      yards: d.yards,
      timeOfPossession: secondsToClock(driveSec),
      timeOfPossessionSeconds: driveSec,
      result,
      firstDowns: d.firstDowns,
      penalties: d.penalties,
      penaltyYards: d.penaltyYards,
      isRedZoneDrive: d.maxYardLine >= 80,
    });
  }

  // ---------------------------------------------------------------------------
  // HELPERS
  // ---------------------------------------------------------------------------

  private checkSituational(stat: TeamStats, play: Play, yardsGained: number, isTD: boolean): void {
    // Third down
    if (isThirdDown(play)) {
      stat.thirdDownAttempts++;
      if (isFirstDown(play) || isTD) stat.thirdDownConversions++;
    }

    // Fourth down
    if (isFourthDown(play)) {
      stat.fourthDownAttempts++;
      if (isFirstDown(play) || isTD) stat.fourthDownConversions++;
    }

    // Red zone
    if (isRedZone(play) && isTD) {
      stat.redZoneTouchdowns++;
    }

    // Goal to go
    if (isGoalToGo(play)) {
      stat.goalToGoAttempts++;
      if (isTD) stat.goalToGoTouchdowns++;
    }

    // TD points
    if (isTD) {
      stat.pointsScored += 6;
    }
  }

  private checkTurnover(p: PassPlay, stat: TeamStats, play: Play): void {
    if (p.fumble && p.fumble.recoveryTeam && p.fumble.recoveryTeam !== play.context.possessionTeam) {
      stat.fumblesLost++;
      stat.turnovers++;
    }
  }

  private checkScoring(play: Play, isTD: boolean, yards: number, tdType: ScoringPlay["playType"]): void {
    if (!isTD) return;
    this.addScoringPlay(play, tdType, 6);
  }

  private addScoringPlay(play: Play, playType: ScoringPlay["playType"], points: number): void {
    const teamId = play.context.possessionTeam;
    const isHome = teamId === this.homeTeamId;

    if (isHome) this.lastHomeScore += points;
    else this.lastAwayScore += points;

    this.scoringPlays.push({
      quarter: play.context.quarter,
      gameClock: play.context.gameClock,
      team: teamId,
      description: (play as any).description ?? "",
      pointsScored: points,
      homeScore: this.lastHomeScore,
      awayScore: this.lastAwayScore,
      playType,
    });
  }

  private processPenaltiesOnPlay(play: Play): void {
    const p = play as any;
    if (!p.penalties || !Array.isArray(p.penalties)) return;
    for (const pen of p.penalties) {
      if (pen.enforcement === "accepted") {
        const penStat = this.getOrCreate(pen.team, pen.team === this.homeTeamId ? this.homeTeamName : this.awayTeamName);
        penStat.penalties++;
        penStat.penaltyYards += pen.yards;

        // Penalty first downs
        if (pen.isAutoFirstDown) {
          const offTeam = play.context.possessionTeam;
          if (pen.team !== offTeam) {
            const offStat = this.getOrCreate(offTeam, offTeam === this.homeTeamId ? this.homeTeamName : this.awayTeamName);
            offStat.firstDowns++;
            offStat.firstDownsPenalty++;
          }
        }
      }
    }
  }

  // ---------------------------------------------------------------------------
  // FINALIZE
  // ---------------------------------------------------------------------------

  finalize(): {
    teamStats: Map<string, TeamStats>;
    drives: DriveStats[];
    scoringPlays: ScoringPlay[];
  } {
    // Close out last drive
    if (this.currentDrive) {
      this.finalizeDrive(this.currentDrive);
      this.currentDrive = null;
    }

    for (const [teamId, stat] of this.stats) {
      // Percentages
      stat.thirdDownPercentage = safeDivide(stat.thirdDownConversions * 100, stat.thirdDownAttempts);
      stat.fourthDownPercentage = safeDivide(stat.fourthDownConversions * 100, stat.fourthDownAttempts);
      stat.redZonePercentage = safeDivide(
        (stat.redZoneTouchdowns + stat.redZoneFieldGoals) * 100,
        stat.redZoneTrips
      );

      // Yards per play
      stat.yardsPerPlay = safeDivide(stat.totalYards, stat.totalPlays);

      // Time of possession
      const topSec = this.topAccum.get(teamId) ?? 0;
      stat.timeOfPossessionSeconds = topSec;
      stat.timeOfPossession = secondsToClock(topSec);

      // Average starting field position
      const positions = this.startingPositions.get(teamId) ?? [];
      if (positions.length > 0) {
        stat.averageStartingFieldPosition = round(
          positions.reduce((a, b) => a + b, 0) / positions.length,
          0
        );
      }

      // Drive averages
      const teamDrives = this.drives.filter(d => d.team === teamId);
      if (teamDrives.length > 0) {
        stat.averageDriveYards = round(
          teamDrives.reduce((s, d) => s + d.yards, 0) / teamDrives.length, 1
        );
        stat.averageDrivePlays = round(
          teamDrives.reduce((s, d) => s + d.plays, 0) / teamDrives.length, 1
        );
        const avgDriveSec = teamDrives.reduce((s, d) => s + d.timeOfPossessionSeconds, 0) / teamDrives.length;
        stat.averageDriveTime = secondsToClock(Math.round(avgDriveSec));
      }
    }

    return {
      teamStats: this.stats,
      drives: this.drives,
      scoringPlays: this.scoringPlays,
    };
  }

  private getOrCreate(teamId: string, teamName: string): TeamStats {
    let s = this.stats.get(teamId);
    if (!s) {
      s = initTeamStats(teamId, teamName);
      this.stats.set(teamId, s);
    }
    return s;
  }
}
