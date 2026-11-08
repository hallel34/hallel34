// Owner bug report 2026-11-02 (players screen, 3 players): seat 1 showed as a bot with the people below it. The device owner is
// seat 1: a person at the top with a name field and the age chips; extra seats (people or bots) render below it, fewer players
// drop seats from the bottom, seats keep their data, the last person cannot become a bot, and seat 1 plays first.
// Run: npm run build && node tests/e2e/players-seats-smoke.mjs   (SHOTS=<dir> also saves the 3-player screen)
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { existsSync, mkdirSync } from 'node:fs';

const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); } catch { ({ chromium } = require('/opt/node-tools/node_modules/playwright')); }
const PORT = Number(process.env.SMOKE_PORT || 4187);
const URL_BASE = process.env.SMOKE_URL || `http://localhost:${PORT}/`;
const SHOTS = process.env.SHOTS || '';
const exe = process.env.CHROMIUM_PATH || ['/opt/pw-browsers/chromium-1194/chrome-linux/chrome', '/opt/pw-browsers/chromium/chrome-linux/chrome'].find(existsSync);

let server;
async function startServer() {
  if (process.env.SMOKE_URL) return;
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { stdio: 'ignore' });
  for (let i = 0; i < 60; i++) { try { const r = await fetch(URL_BASE); if (r.ok) return; } catch { /* wait */ } await new Promise((r) => setTimeout(r, 250)); }
  throw new Error('preview server did not start');
}
const failures = [];
const check = (c, m) => { if (!c) { failures.push(m); console.error(`FAIL: ${m}`); } else console.log(`ok: ${m}`); };

/** What the players screen shows, seat by seat (top to bottom on the page). */
const seatsOf = (page) => page.evaluate(() => {
  const vis = (e) => !!e && !e.hidden && !e.closest('[hidden]') && e.getBoundingClientRect().height > 0;
  return [...document.querySelectorAll('[data-bot-seat]')].map((seat) => {
    const i = seat.dataset.botSeat;
    const row = document.querySelector(`[data-person-row="${i}"]`);
    const input = document.querySelector(`[data-player="${i}"]`);
    const age = document.querySelector(`[data-age-for="${i}"]`);
    const bot = seat.querySelector('[data-seat="bot"]').checked;
    const top = (vis(row) ? row : seat).getBoundingClientRect().top;
    return { i: Number(i), bot, human: seat.querySelector('[data-seat="human"]').checked, nameShown: vis(input), name: input?.value, ageShown: vis(age), ageChips: age ? age.querySelectorAll('[data-age]').length : 0, top };
  });
});
const scrollW = (page) => page.evaluate(() => document.documentElement.scrollWidth - innerWidth);

async function openPlayers(browser, mode = 'family') {
  const ctx = await browser.newContext({ viewport: { width: 360, height: 800 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, locale: 'he-IL', reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`${URL_BASE}?seed=3`);
  await page.evaluate(() => localStorage.setItem('passivo.tutorial', JSON.stringify({ storyDone: true })));
  await page.goto(`${URL_BASE}?seed=3`);
  await page.locator(`[data-mode="${mode}"]`).click();
  await page.locator('[data-action="start"]').click();
  await page.waitForSelector('[data-screen="players"]');
  return { ctx, page, errors };
}
const more = (page) => page.locator('[aria-label="שחקן נוסף"]').click();
const fewer = (page) => page.locator('[aria-label="פחות שחקנים"]').click();

async function run(browser) {
  // 1. the default at 2, 3 and 4 players: seat 1 a person at the top (name + age chips), the extra seats below it
  {
    const { ctx, page, errors } = await openPlayers(browser);
    for (const count of [2, 3, 4]) {
      await more(page);
      await page.waitForTimeout(100);
      const s = await seatsOf(page);
      check(s.length === count, `${count} players: ${count} seats shown`);
      check(s[0].i === 0 && s[0].human && !s[0].bot, `${count} players: seat 1 is a person (שחקן chip on)`);
      check(s[0].nameShown && s[0].name === 'שחקן 1', `${count} players: seat 1 has its name field ("${s[0].name}")`);
      check(s[0].ageShown && s[0].ageChips === 3, `${count} players: seat 1 has the age picker (${s[0].ageChips} chips)`);
      check(s.every((x, k) => k === 0 || x.top > s[k - 1].top), `${count} players: the extra seats render below seat 1 (${s.map((x) => Math.round(x.top)).join(' < ')})`);
      check(s.slice(1).every((x) => x.human && x.nameShown && x.ageShown), `${count} players: seats 2+ keep their old default (a person with a name and age)`);
      check(await scrollW(page) <= 0, `${count} players: no horizontal scroll`);
      if (count === 3 && SHOTS) { mkdirSync(SHOTS, { recursive: true }); await page.waitForTimeout(300); await page.screenshot({ path: `${SHOTS}/players-3-after-default.png` }); }
    }
    check(!errors.length, `no page errors (${errors.join(' | ')})`);
    await ctx.close();
  }

  // 2. seats keep their data when the count changes; fewer players drop seats from the bottom; the last person stays a person
  {
    const { ctx, page, errors } = await openPlayers(browser);
    await more(page); await more(page); // 3
    await page.locator('[data-player="0"]').fill('דנה');
    await page.locator('[data-age-for="0"] [data-age="14plus"]').check({ force: true });
    await page.locator('[data-player="1"]').fill('אורי');
    await page.locator('[data-bot-seat="2"] [data-seat="bot"]').check({ force: true });
    await page.locator('[data-bot-seat="2"] [data-policy="cautious"]').check({ force: true });
    await more(page); // 4
    await fewer(page); // 3
    let s = await seatsOf(page);
    check(s[0].name === 'דנה' && s[1].name === 'אורי' && s[2].bot, 'up and down again: names and the bot seat are kept');
    check(await page.locator('[data-age-for="0"] [data-age="14plus"]').isChecked(), 'up and down again: seat 1 keeps its age');
    check(await page.locator('[data-bot-seat="2"] [data-policy="cautious"]').isChecked(), 'up and down again: the bot keeps its policy');
    await fewer(page); // 2: seat 3 (the bot) goes, seat 1 stays
    s = await seatsOf(page);
    check(s.length === 2 && s[0].name === 'דנה' && s[1].name === 'אורי', 'fewer players: the bottom seat goes, seat 1 stays');
    // seat 2 bot, then seat 1 to bot: refused (no person left), the note says why
    await page.locator('[data-bot-seat="1"] [data-seat="bot"]').check({ force: true });
    await page.locator('[data-bot-seat="0"] [data-seat="bot"]').click({ force: true });
    await page.waitForTimeout(100);
    s = await seatsOf(page);
    check(s[0].human && !s[0].bot && s[1].bot, 'seat 1 cannot become a bot while every other seat is a bot');
    check((await page.locator('.age-note[role="status"]').innerText()).includes('לפחות אחד צריך להיות שחקן ולא בוט'), 'the note explains why');
    // with seat 2 a person again, seat 1 may become a bot (an explicit choice)
    await page.locator('[data-bot-seat="1"] [data-seat="human"]').check({ force: true });
    await page.locator('[data-bot-seat="0"] [data-seat="bot"]').check({ force: true });
    s = await seatsOf(page);
    check(s[0].bot && s[1].human, 'seat 1 may become a bot when another seat is a person');
    // back from the profession pick: the setup comes back with the person first, the bot moved to the end
    await page.locator('[data-action="players-next"]').click();
    await page.waitForSelector('[data-screen="pick"]');
    await page.locator('.pick-top .icon-btn, [data-screen="pick"] .icon-btn').first().click();
    await page.waitForSelector('[data-screen="players"]');
    await page.waitForTimeout(100);
    s = await seatsOf(page);
    check(s.length === 2 && s[0].human && s[0].name === 'אורי' && s[0].nameShown && s[0].ageShown && s[1].bot, `back on the players screen: seat 1 is the person, the bot is below it (${JSON.stringify(s.map((x) => [x.name, x.bot]))})`);
    check(!errors.length, `no page errors (${errors.join(' | ')})`);
    await ctx.close();
  }

  // 3. the turn order follows the seats: seat 1 (the person) plays first, the bot seat after it
  {
    const { ctx, page, errors } = await openPlayers(browser, 'full');
    await more(page);
    await page.locator('[data-player="0"]').fill('דנה');
    await page.locator('[data-bot-seat="1"] [data-seat="bot"]').check({ force: true });
    await page.locator('[data-action="players-next"]').click();
    await page.waitForSelector('[data-screen="pick"]');
    await page.locator('.prof-card').first().click();
    await page.waitForSelector('.pick-sheet');
    await page.locator('[data-action="go"]').click();
    await page.waitForSelector('[data-screen="board"]', { timeout: 10000 }); // a bot in the last seat: no pick screen for a seat past the end
    const save = await page.evaluate(() => JSON.parse(localStorage.getItem('passivo.save')));
    check(save.players[0].name === 'דנה' && !save.players[0].bot && save.players[1].bot === 'sensible', `the match has the person in seat 1 and the bot in seat 2 (${save.players.map((p) => `${p.name}:${p.bot}`).join(', ')})`);
    check(save.currentIndex === 0, 'seat 1 plays first');
    check(!errors.length, `no page errors (${errors.join(' | ')})`);
    await ctx.close();
  }
}

await startServer();
const browser = await chromium.launch(exe ? { executablePath: exe } : {});
try { await run(browser); } catch (e) { failures.push(`crashed: ${e.stack || e}`); console.error(e); }
await browser.close();
server?.kill();
console.log(failures.length ? `\n${failures.length} FAILED` : '\nall players-seats checks passed');
process.exit(failures.length ? 1 : 0);
