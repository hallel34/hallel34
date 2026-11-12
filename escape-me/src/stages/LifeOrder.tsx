import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import type { StagePlayerProps, StageEditorProps, LifeOrderContent } from '../types';
import { PairsListField } from '../components/ui';
import { isWebGLAvailable } from '../lib/webgl';
import './life-order.css';

const LazyLifeOrderRace = lazy(() => import('../three/LifeOrderRace'));

function shuffledIndices(n: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  // avoid accidentally presenting already-solved order for n>1
  if (n > 1 && arr.every((v, i) => v === i)) {
    [arr[0], arr[1]] = [arr[1], arr[0]];
  }
  return arr;
}

function LifeOrder2D({ content, celebrantName, api }: StagePlayerProps<LifeOrderContent>) {
  const total = content.stations.length;
  const displayOrder = useMemo(() => shuffledIndices(total), [total]);
  const [doneCount, setDoneCount] = useState(0);
  const [doneSet, setDoneSet] = useState<Set<number>>(() => new Set());
  const [shakingOrig, setShakingOrig] = useState<number | null>(null);
  const [carDisplayIdx, setCarDisplayIdx] = useState<number | null>(null);
  const [completed, setCompleted] = useState(false);
  const finishedRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => { timers.forEach((t) => window.clearTimeout(t)); };
  }, []);

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  };

  const handleTap = (origIdx: number, displayIdx: number) => {
    if (completed || doneSet.has(origIdx)) return;
    if (origIdx === doneCount) {
      const nextDone = new Set(doneSet);
      nextDone.add(origIdx);
      setDoneSet(nextDone);
      setCarDisplayIdx(displayIdx);
      const nextCount = doneCount + 1;
      setDoneCount(nextCount);
      api.feedback('good');
      if (nextCount >= total) {
        setCompleted(true);
        later(() => {
          if (!finishedRef.current) { finishedRef.current = true; api.finish(); }
        }, 1100);
      }
    } else {
      api.addPoints(-20);
      api.feedback('bad');
      setShakingOrig(origIdx);
      later(() => setShakingOrig((cur) => (cur === origIdx ? null : cur)), 500);
    }
  };

  const carTop = carDisplayIdx === null || total === 0
    ? '18px'
    : `calc(${((carDisplayIdx + 0.5) / total) * 100}% )`;

  return (
    <div className="life-wrap">
      <div className="note">{content.instructions}</div>

      <div className="card" style={{ padding: 14 }}>
        <div className="life-progress">
          <span className="chip chip-teal">🗺️ המסלול של {celebrantName}</span>
          <span style={{ fontWeight: 800, fontSize: 14 }}>תחנה {Math.min(doneCount + (completed ? 0 : 1), total)} מתוך {total}</span>
        </div>
        <div style={{ height: 8 }} />
        <div className="life-progress" aria-hidden="true">
          <div className="life-progress-track"><div className="life-progress-fill" style={{ width: `${total ? (doneCount / total) * 100 : 0}%` }} /></div>
          <span style={{ fontSize: 13, fontWeight: 800 }}>{doneCount}/{total} ✓</span>
        </div>
        <p className="muted" style={{ margin: '10px 0 0' }}>הקישו על התחנות לפי הסדר שבו קרו בחיים — מהמוקדם למאוחר 🚗</p>
      </div>

      {completed ? (
        <div className="card life-success pop-in">
          <div className="life-success-emoji">🏁🎉</div>
          <h3 className="section-title" style={{ marginBottom: 4 }}>כל הכבוד! סידרתם את כל המסלול!</h3>
          <p className="muted">המכונית הגיעה ליעד — בת המצווה! 🚗💨</p>
        </div>
      ) : (
        <div className="life-path" role="group" aria-label="תחנות החיים">
          <div className="life-car" style={{ top: carTop }} aria-hidden="true">🚗</div>
          {displayOrder.map((origIdx, displayIdx) => {
            const st = content.stations[origIdx];
            const isDone = doneSet.has(origIdx);
            const isShaking = shakingOrig === origIdx;
            return (
              <div key={origIdx} className={`life-row ${displayIdx % 2 === 0 ? 'side-a' : 'side-b'}`}>
                <button
                  type="button"
                  className={`life-station ${isDone ? 'is-done' : ''} ${isShaking ? 'shake' : ''}`}
                  onClick={() => handleTap(origIdx, displayIdx)}
                >
                  <span className="life-station-emoji">{st.emoji}</span>
                  <span style={{ flex: 1 }}>
                    <span className="life-station-label">{st.label}</span>
                    <span className="life-station-num" style={{ display: 'block' }}>{isDone ? `תחנה מספר ${origIdx + 1} בסיפור ✓` : 'מה המקום שלה בסיפור?'}</span>
                  </span>
                  {isDone ? <span className="life-check">✓</span> : <span style={{ fontSize: 20, opacity: 0.5 }}>👆</span>}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * v3 flagship: with WebGL the stage is a real 3D car race (gates = life
 * stations). Without WebGL the original 2D path game above stays untouched.
 */
export function Player(props: StagePlayerProps<LifeOrderContent>) {
  if (isWebGLAvailable()) {
    return (
      <Suspense fallback={<div className="card pop-in" style={{ textAlign: 'center', fontWeight: 800 }}>טוען את המירוץ… 🏁</div>}>
        <LazyLifeOrderRace {...props} />
      </Suspense>
    );
  }
  return <LifeOrder2D {...props} />;
}

export function Editor({ content, onChange }: StageEditorProps<LifeOrderContent>) {
  return (
    <div>
      <PairsListField
        label="תחנות החיים"
        values={content.stations}
        onChange={(stations) => onChange({ ...content, stations })}
      />
      <p className="field-hint" style={{ fontSize: 13, color: 'var(--ink-soft)' }}>💡 הסדר ברשימה הוא הסדר הכרונולוגי הנכון בחייה — התחנה הראשונה ברשימה היא המוקדמת ביותר. במשחק התחנות יוצגו מעורבבות.</p>
    </div>
  );
}
