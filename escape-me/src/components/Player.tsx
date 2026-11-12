import { Suspense, lazy, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import type { GameConfig, StageApi, StageResult, StageType } from '../types';
import { PAR_SECONDS } from '../types';
import { STAGE_META } from '../stages/registry';
import { Clapper, ScreenTitle } from './ui';
import HouseList2D from './HouseList2D';
import InRoomPuzzle from './InRoomPuzzle';
import { defaultWorld } from '../store';
import { hotspotDef, roomLabel } from '../world/catalog';
import { buzz, exitFullscreen, feedbackBuzz, needsOrientationPermission, probeCamera, releaseWakeLock, requestOrientationPermission, requestWakeLock, tryFullscreen } from '../lib/device';
import { isWebGLAvailable } from '../lib/webgl';
import '../world/world-ui.css';

const House3D = lazy(() => import('../three/House3D'));

type Phase = 'intro' | 'permissions' | 'house' | 'playing' | 'inroom' | 'stage-done' | 'final';
type PermStatus = 'unknown' | 'ok' | 'warn';

function fmt(sec: number): string {
  const m = Math.floor(sec / 60); const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function Player({ config, onBack }: { config: GameConfig; onBack: () => void }) {
  const [phase, setPhase] = useState<Phase>('intro');
  const [stageIdx, setStageIdx] = useState(0);
  const [results, setResults] = useState<StageResult[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [hintsUsed, setHintsUsed] = useState(0);
  const [shownHint, setShownHint] = useState<string | null>(null);
  const [stagePoints, setStagePoints] = useState(0);
  const [runId, setRunId] = useState(0);
  const [lastResult, setLastResult] = useState<StageResult | null>(null);
  const [lastGranted, setLastGranted] = useState<string | null>(null);
  const [camStatus, setCamStatus] = useState<PermStatus>('unknown');
  const [compassStatus, setCompassStatus] = useState<PermStatus>('unknown');
  // v5 world state
  const [inventory, setInventory] = useState<string[]>([]);
  const [takenPickups, setTakenPickups] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const pointsRef = useRef(0);
  const elapsedRef = useRef(0);
  const hintsRef = useRef(0);
  const wakeLockRef = useRef<unknown>(null);
  const finishedRef = useRef(false);
  const stageIdxRef = useRef(0);
  const noticeTimer = useRef<number>(0);

  const webglOk = useMemo(() => isWebGLAvailable(), []);
  const world = useMemo(
    () => config.world ?? defaultWorld(config.celebrantName, config.stageOrder),
    [config],
  );

  const type = config.stageOrder[stageIdx];
  const meta = STAGE_META[type];
  const content = config.contents[type];
  const totalScore = useMemo(() => results.reduce((a, r) => a + r.score, 0), [results]);
  const totalTime = useMemo(() => results.reduce((a, r) => a + r.seconds, 0), [results]);
  const doneTypes = useMemo(() => new Set<StageType>(results.map((r) => r.type)), [results]);
  const allStagesDone = config.stageOrder.every((t) => doneTypes.has(t));

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    window.clearTimeout(noticeTimer.current);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 4200);
  }, []);

  const finalLockedReason = useMemo(() => {
    const ft = world.finalTarget;
    const missing: string[] = [];
    if (ft.requiresAllStages && !allStagesDone) {
      const left = config.stageOrder.length - doneTypes.size;
      missing.push(`עוד ${left} שלבים בבית`);
    }
    if (ft.requiresItem && !inventory.includes(ft.requiresItem)) {
      const item = world.items[ft.requiresItem];
      missing.push(`הפריט: ${item ? `${item.emoji} ${item.label}` : ft.requiresItem}`);
    }
    if (missing.length === 0) return null;
    return `🔒 ${ft.label} נעול — חסר: ${missing.join(' · ')}`;
  }, [world, allStagesDone, doneTypes, inventory, config.stageOrder.length]);

  useEffect(() => { elapsedRef.current = elapsed; }, [elapsed]);

  useEffect(() => {
    if (phase !== 'playing' && phase !== 'inroom') return;
    const id = window.setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => window.clearInterval(id);
  }, [phase, stageIdx, runId]);

  const releaseSession = useCallback(() => {
    releaseWakeLock(wakeLockRef.current); wakeLockRef.current = null;
    exitFullscreen();
  }, []);

  useEffect(() => () => { releaseSession(); }, [releaseSession]);

  useEffect(() => {
    if (phase !== 'final') return;
    releaseSession();
    const fire = (x: number, delay: number) => window.setTimeout(() => {
      try { void confetti({ particleCount: 90, spread: 75, origin: { x, y: 0.6 } }); } catch { /* ignore */ }
    }, delay);
    fire(0.3, 0); fire(0.7, 250); fire(0.5, 500);
  }, [phase, releaseSession]);

  const resetStage = useCallback(() => {
    pointsRef.current = 0; hintsRef.current = 0; finishedRef.current = false;
    setStagePoints(0); setHintsUsed(0); setElapsed(0); setShownHint(null);
    setLastGranted(null);
  }, []);

  const startGame = useCallback(async () => {
    tryFullscreen(document.documentElement);
    wakeLockRef.current = await requestWakeLock();
    setResults([]); setStageIdx(0); setRunId((r) => r + 1);
    setInventory([]); setTakenPickups([]);
    resetStage();
    setPhase('house');
  }, [resetStage]);

  const enterStage = useCallback((i: number) => {
    const t = config.stageOrder[i];
    if (doneTypes.has(t)) return;
    setStageIdx(i);
    setRunId((r) => r + 1);
    resetStage();
    const placement = world.placements[t];
    setPhase(placement?.mode === 'inroom' ? 'inroom' : 'playing');
  }, [resetStage, config.stageOrder, doneTypes, world]);

  const takePickup = useCallback((pickupId: string) => {
    const pk = world.pickups.find((p) => p.id === pickupId);
    if (!pk || takenPickups.includes(pickupId)) return;
    setTakenPickups((prev) => [...prev, pickupId]);
    setInventory((prev) => (prev.includes(pk.itemId) ? prev : [...prev, pk.itemId]));
    const item = world.items[pk.itemId];
    showNotice(`🎉 ${pk.foundText}${item ? ` · קיבלתם: ${item.emoji} ${item.label}` : ''}`);
    buzz(25);
  }, [world, takenPickups, showNotice]);

  const tryFinal = useCallback(() => {
    if (finalLockedReason) { showNotice(finalLockedReason); buzz(30); return; }
    setPhase('final');
  }, [finalLockedReason, showNotice]);

  const api: StageApi = useMemo(() => ({
    addPoints: (n: number) => { pointsRef.current += n; setStagePoints(pointsRef.current); },
    feedback: (kind: 'good' | 'bad') => { feedbackBuzz(kind); },
    finish: () => {
      if (finishedRef.current) return;
      finishedRef.current = true;
      const t = config.stageOrder[stageIdxRef.current];
      const par = PAR_SECONDS[t];
      const timeBonus = Math.max(0, Math.round(100 * (1 - elapsedRef.current / (2 * par))));
      const score = Math.max(0, 200 + timeBonus + pointsRef.current - 50 * hintsRef.current);
      const res: StageResult = { type: t, score, seconds: elapsedRef.current, hintsUsed: hintsRef.current };
      setLastResult(res);
      setResults((prev) => [...prev, res]);
      const grant = world.placements[t]?.givesItem;
      if (grant) {
        setInventory((prev) => (prev.includes(grant) ? prev : [...prev, grant]));
        setLastGranted(grant);
      }
      setPhase('stage-done');
    },
  }), [config.stageOrder, world]);

  useEffect(() => { stageIdxRef.current = stageIdx; }, [stageIdx]);

  const useHint = () => {
    const hints = (content as { hints: string[] }).hints ?? [];
    if (hintsRef.current >= hints.length) return;
    const next = hints[hintsRef.current];
    hintsRef.current += 1; setHintsUsed(hintsRef.current);
    setShownHint(next);
    buzz(15);
  };

  const restart = () => {
    setResults([]); setStageIdx(0); setRunId((r) => r + 1);
    setInventory([]); setTakenPickups([]); resetStage(); setPhase('intro');
  };

  const noticeEl = notice ? <div className="world-toast pop-in" role="status">{notice}</div> : null;

  const inventoryBar = (
    <div className="inventory-bar" data-testid="inventory-bar">
      <span className="inv-title">🎒 התיק שלי:</span>
      {inventory.length === 0
        ? <span className="inventory-empty">עדיין ריק — אספו פריטים בבית</span>
        : inventory.map((id) => {
          const item = world.items[id];
          return <span key={id} className="inventory-chip">{item ? `${item.emoji} ${item.label}` : id}</span>;
        })}
    </div>
  );

  if (phase === 'intro') {
    return (
      <div className="screen-enter" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Clapper />
        <ScreenTitle emoji="🎬" title={`המשחק של ${config.celebrantName}`} subtitle="תיבת בריחה דיגיטלית · הרפתקה בבית" />
        <div className="card" style={{ border: '2.5px solid var(--gold)' }}>
          <h2 className="section-title">🎯 המטרה</h2>
          <p style={{ fontWeight: 700, lineHeight: 1.55, margin: 0 }}>{world.goal}</p>
        </div>
        <div className="card">
          <h2 className="section-title">איך משחקים?</h2>
          <p>🏠 <strong>מסתובבים בבית</strong> — חדר חדר, כמו בהרפתקאות של פעם.</p>
          <p>✨ <strong>לוחצים על חפצים זוהרים</strong> — חלקם פותחים מיני־משחקים, ובחלקם החידה נמצאת ממש בתוך החדר.</p>
          <p>🎒 <strong>אוספים פריטים</strong> — מפתחות ורמזים שתצטרכו בהמשך.</p>
          <p>🔐 <strong>היעד הסופי נעול</strong> עד שתסיימו את כל השלבים ותאספו את מה שצריך.</p>
          <hr className="divider" />
          <h3 className="section-title">איך מנקדים?</h3>
          <p>⭐ <strong>200 נק׳ בסיס</strong> לכל שלב שמסיימים.</p>
          <p>⚡ <strong>בונוס מהירות</strong> — ככל שמסיימים מהר יותר, מקבלים יותר (עד +100).</p>
          <p>❌ <strong>טעות מורידה</strong> נקודות בתוך השלב.</p>
          <p>💡 <strong>רמז עולה 50 נק׳</strong> — השתמשו בחוכמה!</p>
          <div style={{ height: 8 }} />
          <button type="button" className="btn btn-coral btn-big" onClick={() => setPhase('permissions')}>קדימה, בואו נתחיל ▶</button>
          <div style={{ height: 8 }} />
          <button type="button" className="btn btn-ghost" style={{ color: 'var(--wood-dark)', boxShadow: 'inset 0 0 0 2px var(--wood)', width: '100%' }} onClick={onBack}>🏠 חזרה הביתה</button>
        </div>
      </div>
    );
  }

  if (phase === 'permissions') {
    const statusText = (s: PermStatus) => s === 'ok' ? 'מוכן ✓' : s === 'warn' ? 'לא נתמך / לא אושר' : 'לא נבדק';
    const statusClass = (s: PermStatus) => s === 'ok' ? 'perm-status ok' : s === 'warn' ? 'perm-status warn' : 'perm-status unknown';
    return (
      <div className="screen-enter" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Clapper />
        <ScreenTitle emoji="🎬" title="לפני שמתחילים" subtitle="המשחק משתמש בפנס, במצלמה ובמצפן של הטלפון" />
        <div className="card">
          <p className="muted" style={{ marginBottom: 12 }}>לא חייבים לאשר כלום כדי לשחק — הכפתורים כאן רק מכינים את המכשיר לחוויה המלאה.</p>
          <div className="perm-row">
            <span className="perm-icon">🔦</span>
            <div style={{ flex: 1 }}><strong>פנס</strong><div className="perm-status unknown">יידלק אוטומטית בשלב החפצים במכשירים תומכים</div></div>
            <span className="chip chip-mustard">אוטומטי</span>
          </div>
          <div className="perm-row">
            <span className="perm-icon">🧭</span>
            <div style={{ flex: 1 }}><strong>מצפן</strong><div className={statusClass(compassStatus)}>{statusText(compassStatus)}</div></div>
            <button type="button" className="btn btn-teal" onClick={async () => {
              if (needsOrientationPermission()) { const ok = await requestOrientationPermission(); setCompassStatus(ok ? 'ok' : 'warn'); }
              else setCompassStatus('ok');
            }}>הפעל</button>
          </div>
          <div className="perm-row">
            <span className="perm-icon">📷</span>
            <div style={{ flex: 1 }}><strong>מצלמה</strong><div className={statusClass(camStatus)}>{statusText(camStatus)}</div></div>
            <button type="button" className="btn btn-teal" onClick={async () => { const ok = await probeCamera(); setCamStatus(ok ? 'ok' : 'warn'); }}>הפעל</button>
          </div>
          <div style={{ height: 6 }} />
          <button type="button" className="btn btn-coral btn-big" onClick={() => { void startGame(); }}>התחל משחק ▶</button>
          <div style={{ height: 8 }} />
          <button type="button" className="btn btn-ghost" style={{ color: 'var(--wood-dark)', boxShadow: 'inset 0 0 0 2px var(--wood)', width: '100%' }} onClick={() => setPhase('intro')}>← חזרה</button>
        </div>
      </div>
    );
  }

  if (phase === 'house') {
    const spots = config.stageOrder.map((t, i) => {
      const p = world.placements[t];
      const m = STAGE_META[t];
      return {
        stageIndex: i, type: t, title: m.title, emoji: m.emoji,
        room: p?.room ?? 'living', hotspot: p?.hotspot ?? 'sofa',
        mode: (p?.mode ?? 'overlay') as 'overlay' | 'inroom',
        done: doneTypes.has(t),
      };
    });
    const pickupSpots = world.pickups.map((pk) => ({
      id: pk.id, room: pk.room, hotspot: pk.hotspot,
      itemLabel: world.items[pk.itemId]?.label ?? '',
      collected: takenPickups.includes(pk.id),
    }));
    return (
      <div className={webglOk ? undefined : 'screen-enter'} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {webglOk ? null : inventoryBar}
        {webglOk ? (
          <Suspense fallback={<div className="card" style={{ textAlign: 'center', fontWeight: 800 }}>טוען את הבית… 🏠</div>}>
            <House3D
              celebrantName={config.celebrantName}
              goal={world.goal}
              spots={spots}
              pickups={pickupSpots}
              finalTarget={world.finalTarget}
              finalLockedReason={finalLockedReason}
              onStage={enterStage}
              onPickup={takePickup}
              onFinal={tryFinal}
              inventory={inventory.map((id) => ({ id, label: world.items[id]?.label ?? id, emoji: world.items[id]?.emoji ?? '📦' }))}
              onExit={onBack}
            />
          </Suspense>
        ) : (
          <HouseList2D
            world={world}
            spots={spots}
            takenPickups={takenPickups}
            finalLockedReason={finalLockedReason}
            onStage={enterStage}
            onPickup={takePickup}
            onFinal={tryFinal}
          />
        )}
        {webglOk ? null : <button type="button" className="btn btn-ghost" onClick={onBack}>🏠 יציאה</button>}
        {noticeEl}
      </div>
    );
  }

  if (phase === 'inroom') {
    const placement = world.placements[type];
    const hints = (content as { hints: string[] }).hints ?? [];
    const hintsLeft = hints.length - hintsUsed;
    const hs = placement ? hotspotDef(placement.room, placement.hotspot) : null;
    return (
      <div className="screen-enter" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="hud">
          <span className="hud-item"><span className="hud-label">שלב</span><span className="hud-value">{results.length + 1} מתוך {config.stageOrder.length}</span></span>
          <span className="hud-item">{meta.emoji} {meta.title}</span>
          <span className="hud-item"><span className="hud-label">⏱</span><span className="hud-value">{fmt(elapsed)}</span></span>
          <span className="hud-item"><span className="hud-label">⭐</span><span className="hud-value">{totalScore + stagePoints}</span></span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" className="btn btn-mustard" disabled={hintsLeft <= 0} onClick={useHint}>💡 רמז (−50){hintsLeft > 0 ? ` · נותרו ${hintsLeft}` : ''}</button>
          <button type="button" className="btn btn-ghost" onClick={() => { resetStage(); setPhase('house'); }}>🏠 חזרה לבית</button>
        </div>
        {shownHint ? <div className="hint-bubble pop-in">💡 {shownHint}</div> : null}
        {placement?.inRoom ? (
          <InRoomPuzzle
            key={`${type}-${runId}`}
            puzzle={placement.inRoom}
            hotspotLabel={hs?.label ?? ''}
            roomLabel={placement ? roomLabel(placement.room) : ''}
            api={api}
          />
        ) : (
          <div className="card">החידה לא הוגדרה — חזרו לבית ובחרו חפץ אחר.</div>
        )}
        {noticeEl}
      </div>
    );
  }

  if (phase === 'playing') {
    const StagePlayer = meta.Player;
    const hints = (content as { hints: string[] }).hints ?? [];
    const hintsLeft = hints.length - hintsUsed;
    return (
      <div className="screen-enter" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="hud">
          <span className="hud-item"><span className="hud-label">שלב</span><span className="hud-value">{results.length + 1} מתוך {config.stageOrder.length}</span></span>
          <span className="hud-item">{meta.emoji} {meta.title}</span>
          <span className="hud-item"><span className="hud-label">⏱</span><span className="hud-value">{fmt(elapsed)}</span></span>
          <span className="hud-item"><span className="hud-label">⭐</span><span className="hud-value">{totalScore + stagePoints}</span></span>
          <span className="hud-item"><span className="hud-label">שלב:</span><span className="hud-value">{stagePoints >= 0 ? `+${stagePoints}` : stagePoints}</span></span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button type="button" className="btn btn-mustard" disabled={hintsLeft <= 0} onClick={useHint}>💡 רמז (−50){hintsLeft > 0 ? ` · נותרו ${hintsLeft}` : ''}</button>
          <button type="button" className="btn btn-ghost" onClick={onBack}>🏠 יציאה</button>
        </div>
        {shownHint ? <div className="hint-bubble pop-in">💡 {shownHint}</div> : null}
        <StagePlayer key={`${stageIdx}-${runId}`} content={content} celebrantName={config.celebrantName} api={api} />
      </div>
    );
  }

  if (phase === 'stage-done' && lastResult) {
    const grantedItem = lastGranted ? world.items[lastGranted] : null;
    return (
      <div className="screen-enter" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Clapper />
        <ScreenTitle emoji="🎉" title="סיימת את השלב!" subtitle={`${meta.emoji} ${meta.title}`} />
        <div className="card pop-in" style={{ textAlign: 'center' }}>
          <p className="muted" style={{ margin: 0 }}>נקודות בשלב הזה</p>
          <div className="big-score">{lastResult.score}</div>
          <p>⏱ זמן: {fmt(lastResult.seconds)} · 💡 רמזים: {lastResult.hintsUsed}</p>
          {grantedItem ? (
            <div className="note" style={{ textAlign: 'center' }}><strong>🎒 קיבלתם לתיק:</strong> {grantedItem.emoji} {grantedItem.label}</div>
          ) : null}
          {config.showAnswers ? (
            <div className="note" style={{ textAlign: 'right' }}><strong>התשובה הנכונה:</strong> {(content as { answerText: string }).answerText}</div>
          ) : null}
          <div style={{ height: 12 }} />
          {allStagesDone ? (
            <>
              <p style={{ fontWeight: 800 }}>🎉 כל השלבים הושלמו! עכשיו אל {world.finalTarget.label} ב{roomLabel(world.finalTarget.room)}…</p>
              <button type="button" className="btn btn-teal btn-big" onClick={() => setPhase('house')}>🏠 חזרה לבית — אל היעד הסופי</button>
            </>
          ) : (
            <button type="button" className="btn btn-teal btn-big" onClick={() => setPhase('house')}>🏠 חזרה לבית</button>
          )}
        </div>
        {noticeEl}
      </div>
    );
  }

  // final
  return (
    <div className="screen-enter" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Clapper />
      <ScreenTitle emoji="🏆" title="פתחתם את היעד הסופי!" subtitle={`סיימתם את תיבת הבריחה של ${config.celebrantName}`} />
      <div className="card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 44 }}>🎁</div>
        <p style={{ fontWeight: 800, fontSize: 19 }}>{world.finalTarget.label} נפתח — כל הכבוד!</p>
        <p className="muted" style={{ margin: 0 }}>ניקוד סופי</p>
        <div className="big-score">{totalScore}</div>
        <p>⏱ זמן כולל: {fmt(totalTime)}</p>
        <hr className="divider" />
        <div style={{ textAlign: 'right' }}>
          {results.map((r) => (
            <div className="breakdown-row" key={r.type}>
              <span>{STAGE_META[r.type].emoji}</span>
              <span style={{ flex: 1 }}>{STAGE_META[r.type].title}</span>
              <span>⭐ {r.score}</span><span className="muted">{fmt(r.seconds)}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="card">
        <h2 className="section-title">מה למדנו על {config.celebrantName}:</h2>
        <ul className="recap-list">
          {results.map((r) => (<li key={r.type}>{(config.contents[r.type] as { answerText: string }).answerText}</li>))}
        </ul>
      </div>
      <button type="button" className="btn btn-coral btn-big" onClick={restart}>🔁 שחק שוב</button>
      <button type="button" className="btn btn-ghost btn-big" onClick={onBack}>🏠 חזרה הביתה</button>
    </div>
  );
}
