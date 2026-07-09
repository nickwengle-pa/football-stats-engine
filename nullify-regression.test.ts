import * as FSE from "./src/index";
console.log("PE at init:", FSE.PenaltyEnforcement, "| engine:", typeof FSE.FootballStatsEngine);

const ctx = () => ({
  gameId: "T", quarter: 1, gameClock: "10:00",
  down: 1, distance: 10, yardLine: 30,
  possessionTeam: "A", homeTeam: "A", awayTeam: "B",
  homeScore: 0, awayScore: 0, driveNumber: 1, playNumberInDrive: 1,
});

const basePass = (over: any = {}) => ({
  type: FSE.PlayType.Pass,
  passer: "qb1", target: "wr1", receiver: "wr1",
  result: FSE.PassResult.Complete, yardsGained: 15, isTouchdown: false,
  context: ctx(), ...over,
} as any);

function run(plays: any[]) {
  const e = new FSE.FootballStatsEngine({} as any);
  e.setTeams({ id: "A", name: "A", abbreviation: "A" }, { id: "B", name: "B", abbreviation: "B" });
  e.registerPlayers([{ id: "qb1", name: "QB One" }, { id: "wr1", name: "WR One" }]);
  e.processPlays(plays);
  const s = e.getGameSummary();
  return { teamPassYds: (s.homeTeamStats as any)?.passingYards ?? 0, qbYds: (s.passing as any)?.qb1?.yards ?? 0 };
}

const accepted = { penaltyType: "holding_offense", team: "A", yards: 10, enforcement: FSE.PenaltyEnforcement.Accepted };
const declinedPen = { penaltyType: "holding_offense", team: "A", yards: 0, enforcement: FSE.PenaltyEnforcement.Declined };

const clean = run([basePass()]);
const nullified = run([basePass({ penalties: [accepted] })]);
const declined = run([basePass({ penalties: [declinedPen] })]);

console.log("helper(accepted) =", FSE.isPlayNullifiedByPenalty(basePass({ penalties: [accepted] })), "(want true)");
console.log("helper(declined) =", FSE.isPlayNullifiedByPenalty(basePass({ penalties: [declinedPen] })), "(want false)");
console.log("clean:", clean, "(want 15/15)");
console.log("nullified:", nullified, "(want 0/0)");
console.log("declined:", declined, "(want 15/15)");
const ok = clean.qbYds === 15 && clean.teamPassYds === 15 && nullified.qbYds === 0 && nullified.teamPassYds === 0 && declined.qbYds === 15 && declined.teamPassYds === 15;
console.log(ok ? "ALL PASS" : "FAIL");
process.exit(ok ? 0 : 1);
