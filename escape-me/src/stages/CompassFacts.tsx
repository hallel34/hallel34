import { useEffect, useRef, useState } from 'react';
import type { StagePlayerProps, StageEditorProps, CompassContent } from '../types';
import { TextField, NumberField } from '../components/ui';
import { needsOrientationPermission, requestOrientationPermission } from '../lib/device';
import './compass-facts.css';

type Phase = 'select' | 'aim' | 'sum';

const HOLD_MS = 600;
const WINDOW_DEG = 12;

function norm(h: number): number {
  return ((Math.round(h) % 360) + 360) % 360;
}
function circDiff(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}
function polar(radiusPct: number, deg: number): { left: string; top: string } {
  const rad = (deg * Math.PI) / 180;
  return {
    left: `${50 + radiusPct * Math.sin(rad)}%`,
    top: `${50 - radiusPct * Math.cos(rad)}%`,
  };
}

export function Player({ content, api }: StagePlayerProps<CompassContent>) {
  const [phase, setPhase] = useState<Phase>('select');
  const [selected, setSelected] = useState<number[]>([]);
  const [locked, setLocked] = useState<Set<number>>(new Set());
  const [activeFact, setActiveFact] = useState<number | null>(null);
  const [heading, setHeading] = useState(0);
  const [hold, setHold] = useState(0);
  const [dragMode, setDragMode] = useState(true);
  const [sensorNote, setSensorNote] = useState('מצב גרירה פעיל — גררו על המצפן, או הפעילו מצפן אמיתי מהטלפון 📱');
  const [sumInput, setSumInput] = useState('');
  const [message, setMessage] = useState<{ text: string; kind: 'bad' | 'good' | 'info' } | null>(null);
  const [success, setSuccess] = useState(false);
  const [shakeSum, setShakeSum] = useState(false);

  const selectedRef = useRef<number[]>([]);
  const lockedRef = useRef<Set<number>>(new Set());
  const finishedRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const dragRef = useRef<{ startX: number; startHeading: number } | null>(null);
  const dragModeRef = useRef(true);
  const sensorActiveRef = useRef(false);
  const sensorGotEventRef = useRef(false);
  const sensorTimerRef = useRef<number | null>(null);
  const headingRef = useRef(0);

  const setHeadingBoth = (h: number) => {
    const n = norm(h);
    headingRef.current = n;
    setHeading(n);
  };
  const setDragModeBoth = (v: boolean) => {
    dragModeRef.current = v;
    setDragMode(v);
  };
  const later = (fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  };

  /* ---------- sensor handling ---------- */
  const orientationHandlerRef = useRef<(e: DeviceOrientationEvent) => void>(() => undefined);
  orientationHandlerRef.current = (e: DeviceOrientationEvent) => {
    if (dragModeRef.current) return;
    const ev = e as DeviceOrientationEvent & { webkitCompassHeading?: number };
    let h: number | null = null;
    if (typeof ev.webkitCompassHeading === 'number' && !Number.isNaN(ev.webkitCompassHeading)) {
      h = ev.webkitCompassHeading;
    } else if (e.alpha !== null && e.alpha !== undefined) {
      h = 360 - e.alpha;
    }
    if (h === null || Number.isNaN(h)) return;
    sensorGotEventRef.current = true;
    setSensorNote('המצפן פעיל 🧭 סובבו את הטלפון עד שתגיעו ליעד!');
    setHeadingBoth(h);
  };

  const stableHandlerRef = useRef<((e: DeviceOrientationEvent) => void) | null>(null);
  if (stableHandlerRef.current === null) {
    stableHandlerRef.current = (e: DeviceOrientationEvent) => orientationHandlerRef.current(e);
  }

  useEffect(() => {
    const stored = stableHandlerRef.current;
    return () => {
      if (stored) {
        window.removeEventListener('deviceorientation', stored, true);
        window.removeEventListener('deviceorientationabsolute', stored, true);
      }
      if (sensorTimerRef.current !== null) window.clearTimeout(sensorTimerRef.current);
      timersRef.current.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  const enableCompass = async () => {
    setSensorNote('מפעיל מצפן…');
    if (needsOrientationPermission()) {
      const granted = await requestOrientationPermission();
      if (!granted) {
        setSensorNote('לא ניתנה הרשאת מצפן — ממשיכים במצב גרירה ✋');
        setDragModeBoth(true);
        return;
      }
    }
    const stored = stableHandlerRef.current ?? ((e: DeviceOrientationEvent) => orientationHandlerRef.current(e));
    sensorGotEventRef.current = false;
    sensorActiveRef.current = true;
    window.addEventListener('deviceorientation', stored, true);
    window.addEventListener('deviceorientationabsolute', stored, true);
    setDragModeBoth(false);
    setSensorNote('מחכה לאות מהמצפן… סובבו קצת את הטלפון 🔄');
    if (sensorTimerRef.current !== null) window.clearTimeout(sensorTimerRef.current);
    sensorTimerRef.current = window.setTimeout(() => {
      if (!sensorGotEventRef.current) {
        sensorActiveRef.current = false;
        window.removeEventListener('deviceorientation', stored, true);
        window.removeEventListener('deviceorientationabsolute', stored, true);
        setDragModeBoth(true);
        setSensorNote('המכשיר לא שלח נתוני מצפן — עברנו אוטומטית למצב גרירה ✋');
      }
    }, 3000);
  };

  /* ---------- locking a fact ---------- */
  const lockFact = (factIdx: number) => {
    if (lockedRef.current.has(factIdx)) return;
    const next = new Set(lockedRef.current);
    next.add(factIdx);
    lockedRef.current = next;
    setLocked(next);
    setHold(0);
    api.feedback('good');
    const remaining = selectedRef.current.filter((i) => !next.has(i));
    if (remaining.length === 0) {
      setMessage({ text: 'שתי העובדות נעולות! 🔒 עכשיו חשבו את הקוד', kind: 'good' });
      later(() => setPhase('sum'), 850);
    } else {
      setMessage({ text: 'ננעל! ✓ עברו לעובדה הבאה', kind: 'good' });
      later(() => setActiveFact(remaining[0]), 450);
    }
  };
  const lockFactRef = useRef(lockFact);
  lockFactRef.current = lockFact;

  const activeBearing = activeFact !== null ? content.facts[activeFact]?.bearing ?? 0 : 0;
  const activeDiff = activeFact !== null ? circDiff(heading, activeBearing) : 180;
  const inWindow = phase === 'aim' && activeFact !== null && !locked.has(activeFact) && activeDiff <= WINDOW_DEG;

  useEffect(() => {
    if (!inWindow || activeFact === null) { setHold(0); return; }
    const start = Date.now();
    const iv = window.setInterval(() => {
      const p = Math.min(1, (Date.now() - start) / HOLD_MS);
      setHold(p);
      if (p >= 1) {
        window.clearInterval(iv);
        lockFactRef.current(activeFact);
      }
    }, 50);
    return () => window.clearInterval(iv);
  }, [inWindow, activeFact]);

  /* ---------- selection ---------- */
  const toggleFact = (idx: number) => {
    setMessage(null);
    setSelected((prev) => {
      let next: number[];
      if (prev.includes(idx)) {
        next = prev.filter((i) => i !== idx);
      } else if (prev.length >= 2) {
        setMessage({ text: 'אפשר לבחור רק 2 עובדות — בטלו אחת כדי להחליף', kind: 'info' });
        return prev;
      } else {
        next = [...prev, idx];
      }
      selectedRef.current = next;
      return next;
    });
  };

  const startAim = () => {
    if (selected.length !== 2) return;
    selectedRef.current = selected;
    setActiveFact(selected[0]);
    setMessage(null);
    setPhase('aim');
  };

  /* ---------- sum ---------- */
  const submitSum = () => {
    if (success) return;
    const trueIdx = content.facts.map((f, i) => (f.isTrue ? i : -1)).filter((i) => i >= 0);
    const selSorted = [...selected].sort((a, b) => a - b);
    const setRight = selSorted.length === trueIdx.length && selSorted.every((v, i) => v === trueIdx[i]);
    const trueSum = trueIdx.reduce((acc, i) => acc + content.facts[i].number, 0);
    const entered = Number(sumInput);
    if (!setRight) {
      api.addPoints(-20);
      api.feedback('bad');
      setShakeSum(true);
      later(() => setShakeSum(false), 500);
      setMessage({ text: 'אחת העובדות שבחרתם אינה נכונה — בחרו מחדש', kind: 'bad' });
      selectedRef.current = [];
      lockedRef.current = new Set();
      setSelected([]);
      setLocked(new Set());
      setActiveFact(null);
      setSumInput('');
      setHold(0);
      setPhase('select');
      return;
    }
    if (sumInput.trim() === '' || Number.isNaN(entered) || entered !== trueSum) {
      api.addPoints(-20);
      api.feedback('bad');
      setShakeSum(true);
      later(() => setShakeSum(false), 500);
      setMessage({ text: 'העובדות נכונות! אבל הסכום לא — חשבו שוב', kind: 'bad' });
      return;
    }
    setSuccess(true);
    setMessage(null);
    api.feedback('good');
    if (!finishedRef.current) {
      finishedRef.current = true;
      later(() => api.finish(), 900);
    }
  };

  const pushDigit = (d: string) => {
    if (success) return;
    setSumInput((prev) => (prev.length >= 6 ? prev : prev + d));
  };

  /* ---------- drag ---------- */
  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragMode) return;
    dragRef.current = { startX: e.clientX, startHeading: headingRef.current };
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRef.current || !dragMode) return;
    const dx = e.clientX - dragRef.current.startX;
    setHeadingBoth(dragRef.current.startHeading + dx * 0.6);
  };
  const onPointerUp = () => { dragRef.current = null; };

  const closenessPct = Math.round((1 - activeDiff / 180) * 100);

  return (
    <div className="cf-wrap">
      <div className="note">🧭 {content.instructions}</div>

      {message && phase !== 'sum' && (
        <div className={`cf-msg ${message.kind} pop-in`}>{message.text}</div>
      )}

      {phase === 'select' && (
        <>
          <span className="chip chip-teal cf-phase-chip">שלב 1 מתוך 3 · בחירת עובדות</span>
          <h3 className="section-title">בחרו את 2 העובדות הנכונות לדעתכם ({selected.length}/2)</h3>
          <div className="cf-facts-grid">
            {content.facts.map((fact, i) => {
              const isSel = selected.includes(i);
              return (
                <button key={i} type="button" className={`cf-fact${isSel ? ' selected pop-in' : ''}`} onClick={() => toggleFact(i)}>
                  {isSel && <span className="cf-check">✓</span>}
                  <span className="cf-fact-num">{fact.number}</span>
                  <span className="cf-fact-text">{fact.text}</span>
                  <span className="cf-fact-tags">
                    <span className="chip chip-plum">🧭 {fact.bearing}°</span>
                  </span>
                </button>
              );
            })}
          </div>
          <button type="button" className="btn btn-teal btn-big" disabled={selected.length !== 2} onClick={startAim}>
            {selected.length === 2 ? 'קדימה, למצפן! 🧭' : `בחרו עוד ${2 - selected.length} עובדות`}
          </button>
        </>
      )}

      {phase === 'aim' && (
        <>
          <span className="chip chip-teal cf-phase-chip">שלב 2 מתוך 3 · כיוון במצפן</span>
          <div className="cf-tabs">
            {selected.map((factIdx) => {
              const fact = content.facts[factIdx];
              const isLocked = locked.has(factIdx);
              return (
                <button
                  key={factIdx}
                  type="button"
                  className={`cf-tab${activeFact === factIdx ? ' active' : ''}${isLocked ? ' locked' : ''}`}
                  onClick={() => { if (!isLocked) setActiveFact(factIdx); }}
                >
                  {isLocked ? '✓ ' : '🧭 '}{fact.number} · יעד {fact.bearing}°
                </button>
              );
            })}
          </div>

          <div className="card cf-dial-zone">
            {activeFact !== null && (
              <div className="cf-readout">
                🎯 המטרה: <b>{content.facts[activeFact].text}</b>
                <br />
                כיוון נוכחי: <span className="gold-text" style={{ fontSize: 21 }}>{heading}°</span> · יעד: <b>{activeBearing}°</b>
              </div>
            )}

            <div
              className={`cf-dial${inWindow ? ' in-window' : ''}`}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
              role="slider"
              aria-label="מצפן"
              aria-valuenow={heading}
            >
              <div className="cf-needle">▼</div>
              <div className="cf-rose" style={{ transform: `rotate(${-heading}deg)` }}>
                {Array.from({ length: 24 }, (_, i) => i * 15).map((a) => (
                  <div
                    key={a}
                    className={`cf-tick${a % 90 === 0 ? ' major' : ''}`}
                    style={{ ...polar(45, a), transform: `translate(-50%,-50%) rotate(${a}deg)` }}
                  />
                ))}
                <div className="cf-cardinal north" style={{ ...polar(34, 0), transform: 'translate(-50%,-50%)' }}>צפון</div>
                <div className="cf-cardinal" style={{ ...polar(34, 90), transform: 'translate(-50%,-50%)' }}>מזרח</div>
                <div className="cf-cardinal" style={{ ...polar(34, 180), transform: 'translate(-50%,-50%)' }}>דרום</div>
                <div className="cf-cardinal" style={{ ...polar(34, 270), transform: 'translate(-50%,-50%)' }}>מערב</div>
              </div>
              {activeFact !== null && (
                <div className="cf-target-dot" style={polar(40, activeBearing - heading)}>⭐</div>
              )}
              <div className="cf-center">
                <div className="cf-center-deg">{heading}°</div>
                <div className="cf-center-label">{locked.has(activeFact ?? -1) ? 'ננעל ✓' : `יעד ${activeBearing}°`}</div>
              </div>
            </div>

            <div style={{ width: '100%' }}>
              <div className="muted" style={{ marginBottom: 5, fontWeight: 700 }}>כמה אתם קרובים ליעד? {activeDiff}° ממנו</div>
              <div className="cf-close-track"><div className="cf-close-fill" style={{ width: `${closenessPct}%` }} /></div>
            </div>

            {inWindow ? (
              <div style={{ width: '100%' }}>
                <div style={{ textAlign: 'center', fontWeight: 900, fontSize: 17.5, color: 'var(--green-dark)', marginBottom: 6 }}>🎯 בול! הישארו ככה…</div>
                <div className="cf-hold-track"><div className="cf-hold-fill" style={{ width: `${hold * 100}%` }} /></div>
              </div>
            ) : (
              <div className="muted" style={{ fontWeight: 700, textAlign: 'center' }}>
                {activeDiff <= 30 ? 'חם־חם! עוד קצת… 🔥' : activeDiff <= 70 ? 'מתחמם… 🌡️' : 'קר… המשיכו לסובב ❄️'}
              </div>
            )}

            <div className="cf-step-row">
              <button type="button" className="btn btn-mustard" onClick={enableCompass}>הפעל מצפן 🧭</button>
              <label className="toggle-row" style={{ gap: 8, padding: 0 }}>
                <span>מצב גרירה</span>
                <span className="switch">
                  <input type="checkbox" checked={dragMode} onChange={(e) => setDragModeBoth(e.target.checked)} />
                  <span />
                </span>
              </label>
            </div>
            {dragMode && (
              <div className="cf-step-row">
                <button type="button" className="btn btn-ghost" style={{ color: 'var(--wood-dark)', boxShadow: 'inset 0 0 0 2px var(--wood)', padding: '8px 13px' }} onClick={() => setHeadingBoth(heading - 10)}>−10°</button>
                <button type="button" className="btn btn-ghost" style={{ color: 'var(--wood-dark)', boxShadow: 'inset 0 0 0 2px var(--wood)', padding: '8px 13px' }} onClick={() => setHeadingBoth(heading - 1)}>−1°</button>
                <button type="button" className="btn btn-ghost" style={{ color: 'var(--wood-dark)', boxShadow: 'inset 0 0 0 2px var(--wood)', padding: '8px 13px' }} onClick={() => setHeadingBoth(heading + 1)}>+1°</button>
                <button type="button" className="btn btn-ghost" style={{ color: 'var(--wood-dark)', boxShadow: 'inset 0 0 0 2px var(--wood)', padding: '8px 13px' }} onClick={() => setHeadingBoth(heading + 10)}>+10°</button>
              </div>
            )}
            <div className="cf-sensor-note">{sensorNote}</div>
          </div>
        </>
      )}

      {phase === 'sum' && (
        <>
          <span className="chip chip-teal cf-phase-chip">שלב 3 מתוך 3 · קוד הסכום</span>
          <div className="cf-facts-grid">
            {selected.map((factIdx) => {
              const fact = content.facts[factIdx];
              return (
                <div key={factIdx} className="cf-fact locked">
                  <span className="cf-check gold">✓</span>
                  <span className="cf-fact-num">{fact.number}</span>
                  <span className="cf-fact-text">{fact.text}</span>
                </div>
              );
            })}
          </div>
          <div className="card">
            <h3 className="section-title">🔓 מהו סכום שני המספרים?</h3>
            <p className="muted">חברו את המספרים של שתי העובדות שנעלתם — והקישו את הקוד:</p>
            <div className={`cf-sum-display${shakeSum ? ' shake' : ''}`}>{sumInput === '' ? '____' : sumInput}</div>
            <div style={{ height: 12 }} />
            <div className="cf-keypad">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'].map((k) => (
                <button
                  key={k}
                  type="button"
                  className="cf-key"
                  onClick={() => {
                    if (k === '⌫') setSumInput((p) => p.slice(0, -1));
                    else if (k === '✓') submitSum();
                    else pushDigit(k);
                  }}
                >
                  {k}
                </button>
              ))}
            </div>
            {message && <div className={`cf-msg ${message.kind}${shakeSum ? ' shake' : ''}`} style={{ marginTop: 12 }}>{message.text}</div>}
            {success ? (
              <div className="cf-success pop-in" style={{ marginTop: 12 }}>🎉 הקוד נכון! פתחתם את המנעול!</div>
            ) : (
              <button type="button" className="btn btn-green btn-big" style={{ marginTop: 12 }} disabled={sumInput === ''} onClick={submitSum}>
                בדוק את הקוד 🔓
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function Editor({ content, onChange }: StageEditorProps<CompassContent>) {
  const trueCount = content.facts.filter((f) => f.isTrue).length;
  const updateFact = (i: number, patch: Partial<CompassContent['facts'][number]>) => {
    const facts = content.facts.map((f, j) => (j === i ? { ...f, ...patch } : f));
    onChange({ ...content, facts });
  };
  return (
    <div>
      <p className="muted" style={{ marginBottom: 10 }}>
        לכל עובדה: טקסט, מספר שמופיע על התג, וכיוון מצפן (השחקנים יכוונו אליו). בדיוק 2 עובדות צריכות להיות נכונות.
      </p>
      {content.facts.map((fact, i) => (
        <div className="cf-fact-row" key={i}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <b>עובדה {i + 1}</b>
            <button
              type="button"
              className="icon-btn"
              aria-label="הסרת עובדה"
              onClick={() => onChange({ ...content, facts: content.facts.filter((_, j) => j !== i) })}
            >✕</button>
          </div>
          <TextField label="טקסט העובדה" value={fact.text} onChange={(v) => updateFact(i, { text: v })} placeholder="למשל: ספרים שקראה השנה" />
          <div className="field-row">
            <NumberField label="תג המספר" value={fact.number} onChange={(v) => updateFact(i, { number: v })} />
            <NumberField label="כיוון במעלות (0–359)" value={fact.bearing} onChange={(v) => updateFact(i, { bearing: norm(v) })} />
          </div>
          <label className="cf-true-toggle">
            <input type="checkbox" checked={fact.isTrue} onChange={(e) => updateFact(i, { isTrue: e.target.checked })} />
            עובדה נכונה ✓
          </label>
        </div>
      ))}
      <button
        type="button"
        className="btn btn-ghost"
        style={{ color: 'var(--wood-dark)', boxShadow: 'inset 0 0 0 2px var(--wood)', marginBottom: 12 }}
        onClick={() => onChange({ ...content, facts: [...content.facts, { text: '', number: 0, isTrue: false, bearing: 0 }] })}
      >
        + הוספת עובדה
      </button>
      <div className={`cf-valid${trueCount !== 2 ? ' bad' : ''}`}>
        מסומנות כנכונות: {trueCount} (חייבות להיות בדיוק 2){trueCount !== 2 ? ' ⚠️' : ' ✓'}
      </div>
    </div>
  );
}
