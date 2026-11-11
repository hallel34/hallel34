// 0.5.0 career screens (docs/v050/design/career-spec.md): the return screen, the profile, the picker, the edit sheet, the achievement
// detail, the end-of-game block, the rank-up dialog. One lazy chunk with its strings and styles (home never loads it).
import '../../styles/career.css';
import { h } from '../dom.js';
import { icon } from '../icons.js';
import { button, iconButton, xpBar } from '../widgets.js';
import { openLayer, closeButton } from '../modal.js';
import { professionBust, professionFox, hasProfessionFox } from '../professions.js';
import { foxImg } from '../fox.js';
import { haptic, animate, countUp } from '../fx.js';
import { motionOK } from '../prefs.js';
import { ck, t, tp } from './copy.js';
import { AGE_BANDS, MAX_RANK, MAX_PROFILES, NAME_MAX, RANK_XP_NEEDED, XP_ACHIEVEMENT, CAREER_DEADLINE_WEEKDAY } from '../../engine/config.js';
import { weekNumber, weekDay, addDays, weekStartKey, shortDate } from '../../daily/calendar.js';
import { chipView, isProtectedAge } from '../../career/lite.js';
import { ACHIEVEMENTS, achievementById, suitsGame } from '../../career/achievements.js';
import { yearsPhrase } from '../../learn/slots.js';
import { PAYBACK_OK_YEARS, PAYBACK_SLOW_YEARS } from '../../engine/config.js';

const AGE_KEY = { upTo10: 'profile.ageUpTo10', '11to13': 'profile.age11to13', '14plus': 'profile.age14plus' };
const dayWord = () => t(`career.weekday.${CAREER_DEADLINE_WEEKDAY}`);

// ---------- small helpers ----------
export const professionTitle = (engine, id) => engine.data.professions.find((p) => p.id === id)?.title ?? id;
/** The title of a profession at a rank (rank 0 = the profession's own title). */
export const rankTitle = (engine, id, rank) => (rank > 0 ? engine.data.professions.find((p) => p.id === id)?.ranks?.[rank - 1]?.title ?? professionTitle(engine, id) : professionTitle(engine, id));
const need = (rank) => (rank >= MAX_RANK ? 0 : RANK_XP_NEEDED[rank]);
const pctOf = (r) => (!r || r.rank >= MAX_RANK ? (r?.rank >= MAX_RANK ? 100 : 0) : Math.round((100 * r.xp) / need(r.rank)));
const stand = (profile, id) => profile?.ranks?.[id] ?? { rank: 0, xp: 0 };

const rankGlyph = (rank, size = 20) => icon(`rank${rank}`, { size, width: 2 });
const avatar = (profile, size = 44) => { const b = professionBust(profile.fox && hasProfessionFox(profile.fox) ? profile.fox : 'teacher'); b.style.inlineSize = `${size}px`; b.style.blockSize = `${size}px`; return b; };
const topBar = (title, { onClose = null, onBack = null, action = null } = {}) => h('div', { class: 'cr-top' },
  onBack ? iconButton('arrow', t('profile.back'), onBack, 'ch-close') : null,
  h('h1', { class: 'cr-title', tabindex: '-1', 'data-autofocus': '' }, title),
  action ?? (onClose ? h('button', { type: 'button', class: 'icon-btn ch-close', 'aria-label': t('common.close'), 'data-action': 'cr-close', onClick: onClose }, icon('close', { size: 22 })) : h('span')));

// ---------- achievements ----------
const variantOf = (profile) => (profile?.age === 'upTo10' ? 'junior' : profile?.age === '11to13' ? 'family' : 'full');
export function achievementText(a, key, variant) {
  const raw = (variant === 'junior' ? a.junior?.[key] ?? a.family?.[key] : variant === 'family' ? a.family?.[key] : null) ?? a[key];
  const params = { ...a.params, okYears: yearsPhrase(PAYBACK_OK_YEARS), slowYears: yearsPhrase(PAYBACK_SLOW_YEARS) };
  return String(raw).replace(/\{(\w+)\}/g, (m, k) => (k in params ? String(params[k]) : m));
}
/** The achievements a profile may see in its mode (the full-mode only ones are shown to a junior as "במשחק המלא"). */
const medal = (a, earned, variant) => h('button', {
  type: 'button', class: `cr-medal${earned ? ' is-earned' : ' is-locked'}`, 'data-ach': a.id, 'data-earned': String(!!earned),
  'aria-label': earned ? achievementText(a, 'title', variant) : `${achievementText(a, 'title', variant)}, ${t('achievement.locked')}`,
}, h('span', { class: 'cr-medal-disc' }, icon(earned ? 'achievementEarned' : 'achievementLocked', { size: 26, width: 2 })), h('span', { class: 'cr-medal-title' }, achievementText(a, 'title', variant)));

export function openAchievementSheet({ a, earnedOn, variant }) {
  let layer;
  const content = h('div', { class: 'sheet cr-sheet', 'data-sheet': 'achievement' },
    h('div', { class: 'sheet-head' }, h('span'), closeButton(() => layer.close())),
    h('div', { class: 'cr-sheet-body' },
      h('span', { class: `cr-medal-disc lg${earnedOn ? ' is-earned' : ''}` }, icon(earnedOn ? 'achievementEarned' : 'achievementLocked', { size: 40, width: 2 })),
      h('h2', { class: 'cr-h2' }, achievementText(a, 'title', variant)),
      h('p', { class: 'cr-body' }, achievementText(a, 'description', variant)),
      !a.suits.full || (a.suits.full && !a.suits.family) ? (a.suits.family ? null : h('p', { class: 'cr-note' }, t('achievement.fullOnly'))) : null,
      h('div', { class: 'cr-chips' }, h('span', { class: 'ch-info-chip' }, earnedOn ? t('achievement.earnedOn', { date: shortDate(earnedOn) }) : t('achievement.locked')), h('span', { class: 'ch-info-chip' }, t('achievement.xp', { n: XP_ACHIEVEMENT }))),
      h('p', { class: 'cr-note' }, t('achievement.gameNote'))),
    h('div', { class: 'sheet-cta' }, button(t('achievement.close'), { variant: 'secondary', 'data-action': 'cr-ach-close', onClick: () => layer.close() })));
  layer = openLayer(content, { kind: 'sheet', label: achievementText(a, 'title', variant), cls: 'layer-cr' });
  return layer;
}

// ---------- the return screen (once, after an absence) ----------
/**
 * @param events the settling events of this return ({ type: 'reset' | 'drop' | 'waited' })
 * @param before the profile before the settling (for the rows: what changed)
 */
export function createReturnScreen({ engine, events, before, after, today, onPlay, onHome }) {
  const drop = events.find((e) => e.type === 'drop');
  const reset = events.find((e) => e.type === 'reset');
  const waited = !drop && !reset;
  const variant = waited ? 'waited' : drop ? 'drop' : 'reset';
  const rows = [];
  if (variant === 'drop') {
    for (const d of events.filter((e) => e.type === 'drop').flatMap((e) => e.drops)) {
      const old = rows.find((r) => r.id === d.professionId);
      if (old) old.to = d.to; else rows.push({ id: d.professionId, from: d.from, to: d.to });
    }
  } else if (variant === 'reset') {
    for (const [id, r] of Object.entries(before.ranks)) if (r.xp > 0) rows.push({ id, rank: r.rank, xpPct: pctOf(r) });
  } else {
    for (const [id, r] of Object.entries(after.ranks)) if (r.xp > 0 || r.rank > 0) rows.push({ id, rank: r.rank, xpPct: pctOf(r) });
  }
  const shown = rows.slice(0, variant === 'waited' ? 2 : 3);
  const bodyKey = variant === 'drop' ? 'career.back.drop.body' : variant === 'reset' ? 'career.back.reset.body' : 'career.back.waitedJunior.body';
  const titleKey = variant === 'waited' ? 'career.back.waitedJunior.title' : `career.back.${variant}.title`;
  const row = (r) => {
    const label = variant === 'drop'
      ? h('span', { class: 'cr-row-ranks' }, h('s', null, rankTitle(engine, r.id, r.from)), icon('arrow', { size: 16, width: 2.4, cls: 'icon-dir' }), h('b', null, rankTitle(engine, r.id, r.to)))
      : h('span', { class: 'cr-row-ranks' }, rankGlyph(r.rank, 16), h('b', null, rankTitle(engine, r.id, r.rank)));
    return h('li', { class: 'cr-row', 'data-prof': r.id },
      h('span', { class: 'cmp-avatar', 'aria-hidden': 'true' }, professionBust(r.id)),
      h('span', { class: 'cr-row-main' }, h('span', { class: 'cr-row-name' }, professionTitle(engine, r.id)), label,
        variant === 'reset' ? h('span', { class: 'cr-row-sub' }, xpBar(0, { before: r.xpPct, label: t('career.back.progressReset') }), t('career.back.progressReset')) : null,
        variant === 'waited' ? xpBar(r.xpPct, { label: `${r.xpPct}%` }) : null));
  };
  const el = h('section', { class: 'screen screen-ch screen-return', 'data-screen': 'career-return', 'data-variant': variant },
    h('div', { class: 'ch-top' }, h('span'), h('button', { type: 'button', class: 'icon-btn ch-close', 'aria-label': t('common.close'), 'data-action': 'cr-home', onClick: onHome }, icon('close', { size: 22 }))),
    h('div', { class: 'ch-scroll cr-return' },
      h('div', { class: 'cr-fox' }, foxImg('wave', { height: 132, cls: 'cr-wave' })),
      h('h1', { class: 'ch-title', tabindex: '-1', 'data-autofocus': '' }, t(titleKey)),
      h('p', { class: 'ch-lede cr-lede', role: 'status' }, t(bodyKey)),
      shown.length ? h('ul', { class: 'cmp-card cr-list' }, shown.map(row)) : null,
      rows.length > shown.length ? h('p', { class: 'ch-note' }, t('career.back.more', { n: rows.length - shown.length })) : null,
      variant === 'reset' ? h('p', { class: 'cr-kept' }, icon('check', { size: 18, width: 3 }), h('span', null, t('career.back.reset.kept'))) : null,
      variant === 'drop' ? h('p', { class: 'cr-kept' }, icon('check', { size: 18, width: 3 }), h('span', null, t('career.back.drop.kept'))) : null,
      variant === 'drop' ? h('p', { class: 'ch-note' }, t('career.back.drop.floor')) : null),
    h('div', { class: 'ch-foot' },
      variant === 'reset' ? h('p', { class: 'cr-rule' }, icon('seniority', { size: 16, width: 2 }), h('span', null, t('career.back.reset.next', { days: tp('career.plural.daysLeft', Math.max(1, CAREER_DEADLINE_WEEKDAY - weekDay(today) + 1), { day: dayWord() }), day: dayWord() }))) : null,
      variant === 'drop' ? h('p', { class: 'cr-rule' }, icon('seniority', { size: 16, width: 2 }), h('span', null, t('career.back.drop.next'))) : null,
      button(t(waited ? 'career.back.ctaJunior' : 'career.back.cta'), { variant: 'primary', size: 'lg', 'data-action': 'cr-play', onClick: () => { haptic('tap'); onPlay(); } })));
  return { el };
}

// ---------- the profile screen ----------
export function createProfileScreen({ engine, career, profile, today, onBack, onEdit, onSwitch, onAchievement, focusAchievement = null }) {
  const protectedAge = isProtectedAge(profile.age);
  const variant = variantOf(profile);
  const view = chipView(profile, today);
  // header
  const header = h('div', { class: 'cr-head' },
    h('span', { class: 'cr-avatar-lg', 'aria-hidden': 'true' }, avatar(profile, 64)),
    h('div', { class: 'cr-head-main' }, h('h2', { class: 'cr-h2' }, profile.name || t('profile.title')),
      h('div', { class: 'cr-chips' }, h('span', { class: 'ch-info-chip' }, t(AGE_KEY[profile.age])),
        h('span', { class: 'ch-info-chip' }, t('profile.gamesFinished', { n: profile.games })))));
  // seniority card
  const startKey = weekStartKey(weekNumber(today));
  const strip = h('div', { class: 'cr-strip', 'aria-hidden': 'true' }, t('profile.days').split(' ').map((d, i) => {
    const key = addDays(startKey, i);
    const played = profile.lastPlayDate === key;
    return h('span', { class: `cr-day${key === today ? ' is-today' : ''}${played ? ' is-played' : ''}` }, played ? icon('check', { size: 14, width: 3 }) : d);
  }));
  const sen = protectedAge
    ? h('section', { class: 'cmp-card cr-sen', 'data-sen': 'waiting' },
      h('div', { class: 'cr-sen-top' }, icon('seniorityWait', { size: 20, width: 2 }), h('b', null, t('career.seniority.label'))),
      h('p', { class: 'cr-body' }, t('career.seniority.textJunior')))
    : h('section', { class: 'cmp-card cr-sen', 'data-sen': view.state },
      h('div', { class: 'cr-sen-top' }, icon(view.state === 'warn' ? 'seniorityDue' : 'seniority', { size: 20, width: 2 }), h('b', null, t('career.seniority.label')),
        h('span', { class: `cr-status${view.state === 'warn' ? ' is-warn' : ''}` }, view.state === 'warn' ? t('career.seniority.chipWarn', { days: tp('career.plural.daysLeft', view.days, { day: dayWord() }) }) : view.state === 'kept' ? t('profile.keptWeek') : t('career.seniority.chipOpen'))),
      strip,
      h('p', { class: 'cr-body' }, [t('career.rules.keep'), t('career.rules.whatCounts'), t('career.rules.week1'), t('career.rules.week2'), t('career.rules.floor')].join(' ')),
      h('p', { class: 'cr-note' }, t('career.rules.gameRule')));
  // ranks
  const ids = engine.data.professions.map((p) => p.id);
  const rankRows = ids.map((id) => {
    const r = stand(profile, id);
    const peak = Math.max(profile.peak?.[id] ?? 0, r.rank);
    const pips = h('span', { class: 'cr-pips', 'aria-hidden': 'true' }, Array.from({ length: MAX_RANK + 1 }, (_, k) => h('span', { class: `cr-pip${k <= r.rank ? ' is-now' : k <= peak ? ' is-past' : ''}` }, rankGlyph(k, 14))));
    return h('li', { class: 'cr-rank', 'data-prof': id },
      h('span', { class: 'cmp-avatar', 'aria-hidden': 'true' }, professionBust(id)),
      h('span', { class: 'cr-rank-main' }, h('span', { class: 'cr-row-name' }, professionTitle(engine, id)),
        h('span', { class: 'cr-rank-title' }, rankTitle(engine, id, r.rank)),
        peak > r.rank ? h('span', { class: 'cr-row-sub' }, t('profile.past', { title: rankTitle(engine, id, peak) })) : null,
        r.rank < MAX_RANK ? xpBar(pctOf(r), { label: t('career.xp.progressAria', { have: r.xp, need: need(r.rank), nextTitle: rankTitle(engine, id, r.rank + 1) }) }) : null),
      pips);
  });
  // achievements
  const list = ACHIEVEMENTS.filter((a) => suitsGame(a, { mode: variant === 'full' ? 'full' : 'family', junior: variant === 'junior' }) || a.suits.full);
  const earnedCount = list.filter((a) => a.id in profile.achievements).length;
  const sorted = [...list.filter((a) => a.id in profile.achievements), ...list.filter((a) => !(a.id in profile.achievements))];
  const grid = h('div', { class: 'cr-grid', 'data-ach-grid': '' }, sorted.map((a) => {
    const m = medal(a, profile.achievements[a.id], variant);
    m.addEventListener('click', () => { haptic('tap'); onAchievement(a, profile.achievements[a.id] ?? null, variant); });
    return m;
  }));
  const el = h('section', { class: 'screen screen-ch screen-profile', 'data-screen': 'career-profile' },
    topBar(t('profile.title'), { onBack, action: button(t('profile.edit'), { variant: 'text', 'data-action': 'cr-edit', onClick: onEdit }) }),
    h('div', { class: 'ch-scroll cr-scroll' },
      header, sen,
      h('section', { class: 'cr-sec' }, h('h3', { class: 'cr-h3' }, t('profile.ranksTitle')), h('ul', { class: 'cmp-card cr-ranks' }, rankRows)),
      h('section', { class: 'cr-sec' }, h('h3', { class: 'cr-h3' }, t('achievement.title'), h('span', { class: 'cr-count' }, t('achievement.countOf', { a: earnedCount, b: list.length }))), grid),
      career.profiles.length > 1 ? button(t('profile.switch'), { variant: 'text', 'data-action': 'cr-switch', onClick: onSwitch }) : null,
      h('p', { class: 'ch-note' }, t('profile.onDevice'))));
  return { el, start() { if (focusAchievement) el.querySelector(`[data-ach="${focusAchievement}"]`)?.scrollIntoView?.({ block: 'center' }); } };
}

// ---------- the picker ("who plays?") ----------
export function createPicker({ engine, career, onSelect, onAdd, onClose }) {
  const tiles = career.profiles.map((p) => {
    const best = Object.entries(p.ranks ?? {}).sort((a, b) => b[1].rank - a[1].rank)[0];
    const b = h('button', { type: 'button', class: `cr-tile${p.id === career.active ? ' is-active' : ''}`, 'data-profile': p.id, 'aria-pressed': String(p.id === career.active), onClick: () => { haptic('tap'); onSelect(p.id); } },
      avatar(p, 72), h('span', { class: 'cr-tile-name' }, p.name || t('profile.title')),
      h('span', { class: 'cr-tile-meta' }, t(AGE_KEY[p.age]), best ? rankGlyph(best[1].rank, 14) : null),
      p.id === career.active ? h('span', { class: 'cr-tile-check', 'aria-hidden': 'true' }, icon('check', { size: 14, width: 3.4 })) : null);
    return b;
  });
  if (career.profiles.length < MAX_PROFILES) {
    tiles.push(h('button', { type: 'button', class: 'cr-tile is-add', 'data-action': 'cr-add', onClick: onAdd }, h('span', { class: 'cr-plus' }, icon('plus', { size: 28, width: 2.4 })), h('span', { class: 'cr-tile-name' }, t('profile.picker.add')), h('span', { class: 'cr-tile-meta' }, t('profile.picker.max'))));
  }
  const el = h('section', { class: 'screen screen-ch screen-picker', 'data-screen': 'career-picker' },
    topBar(t('profile.picker.title'), { onClose }),
    h('div', { class: 'ch-scroll' }, h('div', { class: 'cr-tiles' }, tiles), h('p', { class: 'ch-note' }, t('profile.picker.privacy'))));
  void engine;
  return { el };
}

// ---------- the edit / create sheet ----------
/** @param profile the profile to edit, or null to create one; onSave({ name, age, fox }); onDelete() (edit mode only) */
export function openEditSheet({ engine, profile = null, onSave, onDelete = null, lockAge = false }) {
  let layer;
  let age = profile?.age ?? null;
  let fox = profile?.fox ?? null;
  const input = h('input', { type: 'text', class: 'ch-name-input', id: 'cr-name', maxlength: String(NAME_MAX), autocomplete: 'nickname', enterkeyhint: 'done', 'data-cr-name': '' });
  input.value = profile?.name ?? '';
  const counter = h('span', { class: 'ch-name-count', 'aria-hidden': 'true' });
  const sync = () => { counter.textContent = `${Array.from(input.value).length}/${NAME_MAX}`; save.disabled = !age; };
  const ageChips = h('fieldset', { class: 'age-group', 'data-cr-age': '' }, h('legend', { class: 'age-legend' }, t('profile.ageLabel')),
    h('div', { class: 'age-chips' }, [...AGE_BANDS].reverse().map((b) => {
      const radio = h('input', { type: 'radio', name: 'cr-age', value: b, class: 'age-input', 'data-age': b, checked: age === b || null });
      radio.addEventListener('change', () => { if (radio.checked) { age = b; haptic('tap'); sync(); } });
      return h('label', { class: 'age-chip' }, radio, h('span', { class: 'age-chip-text' }, t(AGE_KEY[b])));
    })));
  const foxes = h('fieldset', { class: 'cr-foxes', 'data-cr-fox': '' }, h('legend', { class: 'age-legend' }, t('profile.foxLabel')),
    h('div', { class: 'cr-fox-grid' }, engine.data.professions.map((p) => {
      const radio = h('input', { type: 'radio', name: 'cr-fox', value: p.id, class: 'age-input', 'data-fox': p.id, checked: fox === p.id || null, 'aria-label': t('profile.foxAria', { profession: p.title }) });
      radio.addEventListener('change', () => { if (radio.checked) { fox = p.id; haptic('tap'); } });
      return h('label', { class: 'cr-fox-cell' }, radio, professionBust(p.id));
    })));
  const save = button(t('profile.save'), { variant: 'primary', size: 'lg', 'data-action': 'cr-save', onClick: () => { haptic('tap'); layer.close(true); onSave({ name: input.value, age, fox }); } });
  input.addEventListener('input', sync);
  const content = h('div', { class: 'sheet cr-sheet', 'data-sheet': 'profile-edit' },
    h('div', { class: 'sheet-head' }, h('h2', { class: 'dialog-title' }, profile ? t('profile.edit') : t('profile.add')), closeButton(() => layer.close(false))),
    h('div', { class: 'cr-sheet-body cr-form' },
      h('div', { class: 'ch-field' }, h('label', { class: 'ch-name-label', for: 'cr-name' }, t('profile.nameLabel')), h('div', { class: 'ch-name-wrap' }, input, counter), h('p', { class: 'ch-hint' }, ck('profile.nameHint', { max: NAME_MAX }))),
      ageChips, foxes, h('p', { class: 'ch-note' }, t('profile.ageWhy'))),
    h('div', { class: 'sheet-cta' }, save, profile && onDelete ? button(t('profile.deleteBtn'), { variant: 'text', 'data-action': 'cr-delete', onClick: () => confirmDelete(profile, () => { layer.close(false); onDelete(); }) }) : null));
  sync();
  layer = openLayer(content, { kind: 'sheet', label: profile ? t('profile.edit') : t('profile.add'), cls: 'layer-cr' });
  void lockAge;
  return layer;
}

function confirmDelete(profile, onYes) {
  const layer = openLayer(h('div', { class: 'dialog' },
    h('h2', { class: 'dialog-title' }, t('profile.delete.title', { name: profile.name || t('profile.title') })), h('p', { class: 'dialog-text' }, t('profile.delete.text')),
    h('div', { class: 'dialog-actions' },
      button(t('profile.delete.cancel'), { variant: 'secondary', 'data-action': 'cr-delete-cancel', onClick: () => layer.close(false) }),
      button(t('profile.delete.confirm'), { variant: 'danger', 'data-action': 'cr-delete-confirm', onClick: () => layer.close(true) }))), { label: t('profile.delete.title', { name: profile.name || '' }), cls: 'layer-dialog' });
  layer.closed.then((yes) => { if (yes) onYes(); });
}

// ---------- the end-of-game block ----------
/**
 * The career block of the win / game-over card (spec section 3.1). Returns { el, run() } — run() plays the count-up and fills the bar.
 * @param res finishGame()'s result; before = the profile before the game; kid = a protected / junior profile (no seniority line)
 */
export function createEndBlock({ engine, res, before, kid, onAchievement }) {
  const id = res.record.professionId;
  const b = stand(before, id);
  const a = stand(res.profile, id);
  const rankedUp = res.rankUps.length > 0;
  const beforePct = pctOf(b);
  const afterPct = pctOf(a);
  const total = res.xp.game + res.xp.achievements;
  const gain = h('b', { class: 'cr-gain', 'data-xp': String(total) }, t('career.endBlock.gain', { n: motionOK() ? 0 : total }));
  const parts = [t('career.endBlock.parts', { a: res.xp.game, b: res.xp.achievements })];
  const bar = xpBar(rankedUp ? 100 : afterPct, { before: rankedUp ? 0 : beforePct, lg: true, label: a.rank >= MAX_RANK ? t('career.xp.top') : t('career.xp.progressAria', { have: a.xp, need: need(a.rank), nextTitle: rankTitle(engine, id, a.rank + 1) }) });
  const achRows = res.newAchievements.slice(0, 2).map((aid) => { const ac = achievementById(aid); const v = variantOf(res.profile); return h('button', { type: 'button', class: 'cr-ach-row', 'data-ach': aid, onClick: () => onAchievement?.(ac, res.profile.achievements[aid], v) }, icon('achievementEarned', { size: 20, width: 2 }), h('span', null, achievementText(ac, 'title', v)), h('b', null, `+${XP_ACHIEVEMENT}`)); });
  const el = h('div', { class: 'cr-end', role: 'group', 'aria-label': t('career.endBlock.group'), 'data-career-end': '' },
    h('div', { class: 'cr-end-row' },
      h('span', { class: 'cr-avatar-ring' }, avatar(res.profile, 44), h('span', { class: 'cr-ring-glyph' }, rankGlyph(a.rank, 12))),
      h('span', { class: 'cr-end-main' }, h('span', { class: 'cr-end-title' }, rankTitle(engine, id, a.rank)), bar),
      gain),
    h('p', { class: 'cr-parts' }, parts[0], res.xp.doubled ? h('span', { class: 'cr-x2' }, icon('promoWeek', { size: 12, width: 2 }), h('bdi', { dir: 'ltr' }, t('career.promoWeek.cardTag'))) : null),
    achRows.length ? h('div', { class: 'cr-ach-rows' }, achRows, res.newAchievements.length > 2 ? h('p', { class: 'ch-note' }, t('career.endBlock.moreAch', { n: res.newAchievements.length - 2 })) : null) : null,
    !kid && res.firstOfWeek ? h('p', { class: 'cr-kept' }, icon('check', { size: 16, width: 3 }), h('span', null, t('career.endBlock.kept'))) : null);
  return {
    el,
    /** Animates the count-up and the bar; resolves when it is done (the rank-up dialog follows). */
    run() {
      if (!motionOK()) { gain.textContent = t('career.endBlock.gain', { n: total }); return Promise.resolve(); }
      const fill = bar.querySelector('i');
      const fromPct = rankedUp ? 0 : beforePct;
      animate(fill, [{ inlineSize: `${fromPct}%` }, { inlineSize: `${rankedUp ? 100 : afterPct}%` }], { duration: 700, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'backwards' });
      return countUp(0, total, (n) => { gain.textContent = t('career.endBlock.gain', { n }); });
    },
  };
}

/** The "save your progress" prompt of a device without a profile (spec 6.1): one quiet text button, 48px. */
export function createCreatePrompt({ onCreate }) {
  return h('div', { class: 'cr-end cr-prompt', 'data-career-prompt': '' }, h('p', { class: 'cr-parts' }, t('career.endBlock.createLine')),
    button(t('career.endBlock.createProfile'), { variant: 'text', 'data-action': 'cr-create', onClick: onCreate }));
}

// ---------- the rank-up dialog ----------
export function openRankUp({ engine, up, win, kid }) {
  return new Promise((resolve) => {
    const title = rankTitle(engine, up.professionId, up.to);
    const ladder = h('ol', { class: 'cr-ladder', 'aria-label': professionTitle(engine, up.professionId) }, Array.from({ length: MAX_RANK + 1 }, (_, r) => h('li', { class: `cr-rung${r < up.to ? ' is-done' : r === up.to ? ' is-now' : ''}`, 'aria-current': r === up.to ? 'step' : null }, rankGlyph(r, 20))));
    let layer;
    const ok = button(t('common.ok'), { variant: 'primary', size: 'lg', 'data-action': 'cr-rankup-ok', 'data-autofocus': '', onClick: () => layer.close(true) });
    const content = h('div', { class: 'dialog cr-rankup', 'data-rankup': '' },
      h('div', { class: 'cr-rankup-fox' }, foxImg('celebrate', { size: 148 })),
      h('p', { class: 'cr-kicker' }, kid ? ck('career.rankUp.title') : t('career.rankUp.title')),
      h('h2', { class: 'cr-rankup-title' }, title),
      ladder,
      h('p', { class: 'ch-lede' }, ck('career.rankUp.sub')),
      up.to >= MAX_RANK ? h('p', { class: 'ch-note' }, t('career.rankUp.top')) : null,
      h('p', { class: 'ch-note' }, ck('career.rankUp.simplification')),
      ok);
    layer = openLayer(content, { kind: 'modal', label: t('career.rankUp.title'), dismissable: false, cls: 'layer-dialog layer-cr' });
    haptic(win ? 'win' : 'tap');
    layer.closed.then(() => resolve());
  });
}
