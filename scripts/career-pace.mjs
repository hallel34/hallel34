// 0.5.0 career pace (analysis only, nothing here ships): how fast XP turns into ranks with the real career logic.
//   node scripts/career-pace.mjs [--win=0.85] [--dailyxp=10] [--weeks=80]
// It imports src/career/career.js (awardGame, createProfile, xpNeeded, ...) and src/engine/config.js, so a change of RANK_XP_NEEDED, XP_*,
// PROMO_WEEK_XP_MULTIPLIER or the promotion-week key shows up here. Not imported: achievements.js (needs the engine + a JSON import); the
// two ladder achievements are re-judged by the 4-line evaluateRankBased below, the 14 others are fed as ids by a schedule.
// Part 1: the best possible first game and "an achievement pays once". Part 2: pace over time for 7 / 3 / 1 games a week.
import { readFileSync } from 'node:fs';
import { emptyCareer, createProfile, awardGame, awardAchievements, xpNeeded, standing } from '../src/career/career.js';
import { promoWeekProfession } from '../src/career/lite.js';
import { weekNumber, addDays, dayNumber } from '../src/daily/calendar.js';
import { keyedInt } from '../src/engine/rng.js';
import { XP_WIN, XP_LOSS, XP_ACHIEVEMENT, PROMO_WEEK_XP_MULTIPLIER, RANK_XP_NEEDED, MAX_RANK } from '../src/engine/config.js';

const arg = (k, d) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
const WIN = Number(arg('win', 0.85));          // share of finished games that end in freedom (docs/BALANCE.md: loss 5-15%)
const DAILY_XP = Number(arg('dailyxp', 10));   // proposal for owner decision (b): flat XP of a finished daily challenge
const WEEKS = Number(arg('weeks', 420));
const STARTS = 16; // start weeks tried (the promotion week of the first weeks differs): median and range are reported
const here = (p) => new URL(p, import.meta.url);
const PROFS = JSON.parse(readFileSync(here('../src/data/professions.he.json'), 'utf8')).map((p) => p.id);
const ACH = JSON.parse(readFileSync(here('../src/career/achievements.he.json'), 'utf8')).achievements;
const LADDER = ['first-rank-up', 'top-rank'];
const SUN = '2026-11-08'; // a Sunday
const out = [];
const log = (s = '') => out.push(s);

// ---------- the ladder achievements, as src/career/achievements.js evaluateRankBased (copied: that file needs the engine) ----------
const evaluateRankBased = (p) => {
  const peaks = Object.values(p.peak ?? {});
  return LADDER.filter((id) => !(id in p.achievements) && ((id === 'first-rank-up' && peaks.some((r) => r >= 1)) || (id === 'top-rank' && peaks.some((r) => r >= 3))));
};

/** What finish.js does after a game: awardGame, then the ladder achievements until nothing new (3 passes). */
function creditGame(profile, record, { today, earned, doubledProfs }) {
  const first = awardGame(profile, record, { today, earned, professionIds: doubledProfs });
  let p = first.profile; let xp = { ...first.xp }; const ups = [...first.rankUps]; const got = earned.filter((id) => !(id in profile.achievements));
  for (let i = 0; i < 3; i++) {
    const more = evaluateRankBased(p);
    if (!more.length) break;
    const r = awardAchievements(p, more, { today, professionId: record.professionId, doubled: xp.doubled });
    p = r.profile; ups.push(...r.rankUps); got.push(...more); xp = { ...xp, achievements: xp.achievements + r.xp };
  }
  return { profile: p, xp, ups, got };
}
const newProfile = (today) => createProfile(emptyCareer(), { name: 'x', age: '14plus' }, today).profile;
const cum = [0, ...RANK_XP_NEEDED.reduce((a, n) => [...a, a[a.length - 1] + n], [0]).slice(1)]; // 0, 90, 270, 570

// ======================= part 1: the best possible first game =======================
// Which of the 16 can one game earn? (conditions: src/career/achievements.he.json, src/career/achievements.js)
const impossible = {
  'challenge-streak-3': 'needs 3 finished friend-challenge games in a row',
  'all-professions': 'needs wins in all 8 professions',
  'top-rank': 'needs rank 3 (570 XP) - judged after the XP landed',
};
const exclusive = { 'repaid-bank-loan': 'cannot be earned together with win-no-bank-loan (that one needs loansTaken === 0)' };
const oneGame = ACH.map((a) => a.id).filter((id) => !(id in impossible) && !(id in exclusive));
const gameOnly = oneGame.filter((id) => id !== 'first-rank-up'); // judged by evaluateRankBased
log('## Part 1: the best possible first game (win, full mode, a log that replays)');
log('');
log(`Achievements in the data: ${ACH.length} (${ACH.length * XP_ACHIEVEMENT} XP at ${XP_ACHIEVEMENT} each). One game cannot earn: ${Object.entries(impossible).map(([k, v]) => `${k} (${v})`).join('; ')}; and ${Object.keys(exclusive)[0]} excludes win-no-bank-loan. Upper bound: ${oneGame.length} of ${ACH.length} in one game (${oneGame.length * XP_ACHIEVEMENT} XP).`);
log('');
log('| case | game XP | achievement XP | total | rank after | XP into next rank | rank-ups |');
log('|---|---|---|---|---|---|---|');
const promoWeek = (() => { for (let k = 0; k < 60; k++) { const d = addDays(SUN, 7 * k); const w = weekNumber(d); return { d, w, prof: promoWeekProfession(w, PROFS) }; } })();
function bestGame(label, { promo, achIds, prof }) {
  // the profile is created the Sunday of `d`; the game is played that same week
  const d = promo ? promoWeek.d : (() => { for (let k = 0; k < 60; k++) { const dd = addDays(SUN, 7 * k); if (promoWeekProfession(weekNumber(dd), PROFS) !== prof) return dd; } })();
  const p0 = newProfile(d);
  const ids = achIds.filter((id) => (promo || id !== 'promo-week-freedom'));
  const r = creditGame(p0, { professionId: prof, rank: 0, won: true }, { today: d, earned: ids, doubledProfs: PROFS });
  const s = standing(r.profile, prof);
  log(`| ${label} | ${r.xp.game} | ${r.xp.achievements} | ${r.xp.game + r.xp.achievements} | ${s.rank} | ${s.rank >= MAX_RANK ? 'top' : `${s.xp} / ${s.need}`} | ${r.ups.map((u) => `${u.from}->${u.to}`).join(', ') || '-'} |`);
  return r;
}
const target = promoWeek.prof;
bestGame('perfect game, ordinary week', { promo: false, achIds: gameOnly, prof: target });
bestGame('perfect game, in that profession\'s promotion week (x2)', { promo: true, achIds: gameOnly, prof: target });
bestGame('win, no achievements, ordinary week', { promo: false, achIds: [], prof: target });
bestGame('win, no achievements, promotion week', { promo: true, achIds: [], prof: target });
log('');
log(`Promotion week of the first simulated week (${promoWeek.d}): ${promoWeek.prof} (keyedInt(week, 'promoWeek')).`);

// once only: the same profile plays a second perfect game (the ids offered again include the ones it already holds)
{
  const d = promoWeek.d; const prof = target;
  const g1 = creditGame(newProfile(d), { professionId: prof, rank: 0, won: true }, { today: d, earned: gameOnly, doubledProfs: PROFS });
  const held = new Set(Object.keys(g1.profile.achievements));
  const rankAfter1 = standing(g1.profile, prof).rank;
  const g2 = creditGame(g1.profile, { professionId: prof, rank: rankAfter1, won: true }, { today: d, earned: gameOnly, doubledProfs: PROFS });
  const repeats = g2.got.filter((id) => held.has(id));
  const again = awardAchievements(g2.profile, Object.keys(g2.profile.achievements), { today: d, professionId: prof });
  log('');
  log(`Once only: game 1 stores ${held.size} achievements. The identical perfect game 2 (all ids offered again) pays game XP ${g2.xp.game}; the achievements it records are ${g2.got.length ? g2.got.join(', ') : 'none'} (${repeats.length} of them already held); awardAchievements called again with every stored id pays ${again.xp} XP; stored in the end: ${Object.keys(g2.profile.achievements).length}. ${repeats.length === 0 && again.xp === 0 ? 'OK: granted once (the only new one is the ladder achievement that the rank reached in game 2 unlocks).' : 'PROBLEM: paid twice.'}`);
}

// ======================= part 2: pace over time =======================
// Achievement schedule ("typical" player): cumulative non-ladder achievements after n finished games (of the 14 non-ladder ones).
// Game 1 is a good game (4), then about one a game, capped at 12 (challenge-streak-3 and all-professions are the slow ones).
const nonLadder = ACH.map((a) => a.id).filter((id) => !LADDER.includes(id));
const cumAch = (n) => Math.min(12, n <= 0 ? 0 : 4 + (n - 1));
const achievementPlan = (kind) => (kind === 'none' ? () => 0 : cumAch);

function simulate({ gpw, scope, policy, ach, start = 0 }) {
  const SUN0 = addDays(SUN, start * 7); // the profile starts `start` weeks later: the promotion weeks fall differently
  const rec = { rank1: null, rank2: null, rank3: null, all3: null, games: 0 };
  let p = newProfile(SUN0);
  const plan = achievementPlan(ach);
  let gamesPlayed = 0; let achGiven = 0;
  const pick = (week, today) => {
    if (scope === 'one') return PROFS[0];
    const promo = promoWeekProfession(week, PROFS);
    const weakest = [...PROFS].sort((a, b) => standing(p, a).rank - standing(p, b).rank || standing(p, a).xp - standing(p, b).xp)[0];
    if (policy === 'chase' && standing(p, promo).rank < MAX_RANK) return promo;
    return weakest;
  };
  for (let wk = 0; wk < WEEKS; wk++) {
    for (let j = 0; j < gpw; j++) {
      const today = addDays(SUN0, wk * 7 + Math.floor(((j + 0.5) * 7) / gpw));
      const week = weekNumber(today);
      const prof = pick(week, today);
      // deterministic win pattern at rate WIN
      const won = Math.floor((gamesPlayed + 1) * WIN) > Math.floor(gamesPlayed * WIN);
      gamesPlayed += 1;
      const want = Math.min(nonLadder.length, plan(gamesPlayed));
      const fresh = nonLadder.slice(achGiven, want);
      achGiven = Math.max(achGiven, want);
      const r = creditGame(p, { professionId: prof, rank: standing(p, prof).rank, won }, { today, earned: fresh, doubledProfs: PROFS });
      p = r.profile;
      rec.games = gamesPlayed;
      const ranks = PROFS.map((id) => standing(p, id).rank);
      const top = scope === 'one' ? standing(p, PROFS[0]).rank : Math.max(...ranks);
      const at = { weeks: wk + 1 + j / gpw, games: gamesPlayed };
      if (top >= 1 && !rec.rank1) rec.rank1 = at;
      if (top >= 2 && !rec.rank2) rec.rank2 = at;
      if (top >= 3 && !rec.rank3) rec.rank3 = at;
      if (scope === 'all' && ranks.every((x) => x >= 3) && !rec.all3) rec.all3 = at;
      if (scope === 'one' && top >= 3 && !rec.all3) rec.all3 = at;
    }
  }
  return rec;
}
const med = (a) => { const x = [...a].sort((m, n) => m - n); return x[Math.floor(x.length / 2)]; };
/** median (min-max) over STARTS start weeks of games / weeks until `key` is reached */
function agg(cfg, key) {
  const rs = Array.from({ length: STARTS }, (_, i) => simulate({ ...cfg, start: i })[key]);
  if (rs.some((r) => !r)) return `> ${Math.round(WEEKS / 52 * 10) / 10} y`;
  const g = rs.map((r) => r.games); const w = rs.map((r) => Math.ceil(r.weeks));
  return `${med(g)} g (${Math.min(...g)}-${Math.max(...g)}) / ${med(w)} w (${Math.min(...w)}-${Math.max(...w)})`;
}

log('');
log('## Part 2: pace over time');
log('');
log(`Assumptions: win rate ${WIN} (a loss pays ${XP_LOSS}, a win ${XP_WIN}); the player always starts at the top rank of the profession (no half-XP games) and finishes a game every week (no seniority loss); games are spread evenly over Sunday-Saturday weeks; "typical" achievements = 4 in the first game, then about one more per game up to 12 (+ the two ladder ones when the ranks are reached), their XP goes to the profession of the game that earned them; "none" = no achievements at all (the floor). Promotion week = real promoWeekProfession(week) over the 8 professions: ${PROFS.join(', ')}. Cells: median (min-max over 16 different start weeks) of games / weeks until reached; a week counts when its games are done. Over ${Math.round(WEEKS / 52 * 10) / 10} years is shown as '>'.`);
log('');
const scenarios = [
  ['rank 3 in ONE profession (always teacher, bonus only when it happens to be its week)', { scope: 'one', policy: 'fixed' }, 'all3'],
  ['rank 3 in ALL 8, weakest profession first (no bonus chasing)', { scope: 'all', policy: 'weakest' }, 'all3'],
  ['rank 3 in ALL 8, chasing each week\'s promotion profession (x2)', { scope: 'all', policy: 'chase' }, 'all3'],
];
for (const ach of ['typical', 'none']) {
  log(`### achievements: ${ach}`);
  log('');
  log('| goal | 7 games/week | 3 games/week | 1 game/week |');
  log('|---|---|---|---|');
  for (const [label, base, key] of scenarios) {
    const cells = [7, 3, 1].map((g) => agg({ ...base, gpw: g, ach }, key));
    log(`| ${label} | ${cells.join(' | ')} |`);
  }
  for (const [label, base] of [scenarios[0], scenarios[2]]) {
    for (const [k, name] of [['rank1', 'rank 1'], ['rank2', 'rank 2']]) {
      const cells = [7, 3, 1].map((g) => agg({ ...base, gpw: g, ach }, k));
      log(`| (${name}, first profession) ${label.split(' (')[0].replace('rank 3 in ', '')} | ${cells.join(' | ')} |`);
    }
  }
  log('');
}

// ---- the daily challenge as an XP source (owner decision b; a proposal, nothing ships) ----
function dailyOnly(xp, weeks) {
  // a player who only plays the daily (once a day, win), the profession of the day is a hash of the date (modelled by keyedInt)
  const xpBy = Object.fromEntries(PROFS.map((id) => [id, { rank: 0, xp: 0 }]));
  for (let d = 0; d < weeks * 7; d++) {
    const key = addDays(SUN, d);
    const id = PROFS[keyedInt(dayNumber(key), 'dailyProf', 0, 0, PROFS.length)];
    const s = xpBy[id];
    let gain = s.rank > 0 ? Math.floor(xp * 0.5) : xp; // the daily is a rank-0 game: half XP once the profession is above rank 0
    s.xp += gain;
    while (s.rank < MAX_RANK && s.xp >= xpNeeded(s.rank)) { s.xp -= xpNeeded(s.rank); s.rank += 1; }
  }
  return PROFS.map((id) => xpBy[id].rank);
}
log(`### the daily as an XP source (flat ${DAILY_XP} XP a finished daily, half once the day's profession is above rank 0, one a day)`);
log('');
log('| weeks of daily only | ranks of the 8 professions after (sum / 24) |');
log('|---|---|');
for (const w of [4, 12, 26, 52]) { const r = dailyOnly(DAILY_XP, w); log(`| ${w} | ${r.join(',')} (${r.reduce((a, b) => a + b, 0)} / 24) |`); }
log('');
log(`Daily XP next to 3 normal games a week: ${DAILY_XP * 7} XP/week from the daily vs about ${Math.round(3 * (WIN * XP_WIN + (1 - WIN) * XP_LOSS))} XP/week from 3 games. Thresholds used: ${RANK_XP_NEEDED.join('/')} (cumulative ${cum.slice(1).join('/')}), promotion multiplier x${PROMO_WEEK_XP_MULTIPLIER}.`);

console.log(out.join('\n'));
