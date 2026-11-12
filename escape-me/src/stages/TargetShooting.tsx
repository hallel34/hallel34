import { useEffect, useRef, useState } from 'react';
import type { StagePlayerProps, StageEditorProps, TargetShootingContent } from '../types';
import { TextField, StringListField } from '../components/ui';
import './target-shooting.css';

interface TargetItem {
  id: number;
  label: string;
  isCorrect: boolean;
  topPct: number;
  duration: number;
  dir: 'ltr' | 'rtl';
  hit: boolean;
}

export function Player({ content, api }: StagePlayerProps<TargetShootingContent>) {
  const [started, setStarted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(30);
  const [targets, setTargets] = useState<TargetItem[]>([]);
  const [hits, setHits] = useState(0);
  const [flashBad, setFlashBad] = useState(false);
  const [ended, setEnded] = useState(false);

  const idRef = useRef(0);
  const finishedRef = useRef(false);
  const spawnRef = useRef<number | null>(null);
  const countRef = useRef<number | null>(null);
  const timersRef = useRef<number[]>([]);
  const endedRef = useRef(false);

  const later = (fn: () => void, ms: number) => { const id = window.setTimeout(fn, ms); timersRef.current.push(id); };

  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
      if (spawnRef.current) window.clearInterval(spawnRef.current);
      if (countRef.current) window.clearInterval(countRef.current);
    };
  }, []);

  const spawnOne = () => {
    setTargets((cur) => {
      const alive = cur.filter((t) => !t.hit);
      if (alive.length >= 5 || endedRef.current) return cur;
      const pool: { label: string; isCorrect: boolean }[] = [
        ...content.correct.filter((s) => s.trim()).map((label) => ({ label, isCorrect: true })),
        ...content.wrong.filter((s) => s.trim()).map((label) => ({ label, isCorrect: false })),
      ];
      if (pool.length === 0) return cur;
      // bias slightly toward correct so the game feels rewarding
      const correctPool = pool.filter((p) => p.isCorrect);
      const pick = Math.random() < 0.52 && correctPool.length > 0
        ? correctPool[Math.floor(Math.random() * correctPool.length)]
        : pool[Math.floor(Math.random() * pool.length)];
      idRef.current += 1;
      const item: TargetItem = {
        id: idRef.current,
        label: pick.label,
        isCorrect: pick.isCorrect,
        topPct: 8 + Math.random() * 62,
        duration: 3.5 + Math.random() * 4,
        dir: Math.random() < 0.5 ? 'ltr' : 'rtl',
        hit: false,
      };
      return [...cur, item];
    });
  };

  const endGame = () => {
    if (endedRef.current) return;
    endedRef.current = true;
    setEnded(true);
    if (spawnRef.current) { window.clearInterval(spawnRef.current); spawnRef.current = null; }
    if (countRef.current) { window.clearInterval(countRef.current); countRef.current = null; }
    setTargets([]);
    later(() => { if (!finishedRef.current) { finishedRef.current = true; api.finish(); } }, 700);
  };

  const start = () => {
    if (started) return;
    setStarted(true);
    spawnOne();
    later(spawnOne, 250);
    spawnRef.current = window.setInterval(spawnOne, 700);
    countRef.current = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          // end on next tick via effect-safe timeout
          later(endGame, 10);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const hitTarget = (item: TargetItem) => {
    if (!started || ended || item.hit) return;
    if (item.isCorrect) {
      api.addPoints(30);
      api.feedback('good');
      setHits((h) => h + 1);
      setTargets((cur) => cur.map((t) => (t.id === item.id ? { ...t, hit: true } : t)));
      later(() => setTargets((cur) => cur.filter((t) => t.id !== item.id)), 280);
    } else {
      api.addPoints(-20);
      api.feedback('bad');
      setFlashBad(true);
      later(() => setFlashBad(false), 360);
      setTargets((cur) => cur.map((t) => (t.id === item.id ? { ...t, hit: true } : t)));
      later(() => setTargets((cur) => cur.filter((t) => t.id !== item.id)), 200);
    }
  };

  return (
    <div className="target-wrap">
      <div className="note">{content.instructions}</div>

      <div className="card" style={{ padding: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span className="chip chip-coral">🎯 פגיעות: {hits}</span>
          <div style={{ textAlign: 'center' }}>
            <div className={`target-countdown ${timeLeft <= 5 && started && !ended ? 'urgent' : ''}`} style={{ color: started ? undefined : 'var(--wood-dark)', textShadow: 'none', fontSize: started ? 44 : 36 }}>
              {started ? `${timeLeft}` : '30'}
            </div>
            <div className="muted" style={{ fontSize: 12, fontWeight: 800 }}>שניות ⏱️</div>
          </div>
          <span className="chip chip-teal">{content.correct.length} שאיפות אמיתיות</span>
        </div>
      </div>

      <div className={`target-arena ${flashBad ? 'flash-bad' : ''}`}>
        <div className="target-floor" aria-hidden="true" />

        {!started && (
          <div className="target-start-overlay pop-in">
            <div style={{ fontSize: 56 }} className="floaty">🎯</div>
            <h3 style={{ color: '#FFF6E9', margin: 0, fontSize: 21, fontWeight: 900, lineHeight: 1.35 }}>{content.question}</h3>
            <p style={{ color: 'rgba(255,246,233,.88)', margin: 0, fontWeight: 600 }}>פגעו רק במטרות הנכונות — היזהרו ממסיחים! 💨</p>
            <button type="button" className="btn btn-coral btn-big" style={{ maxWidth: 320 }} onClick={start}>🎯 התחל — יש לכם 30 שניות!</button>
          </div>
        )}

        {ended && (
          <div className="target-start-overlay pop-in">
            <div style={{ fontSize: 56 }}>⏰</div>
            <h3 style={{ color: '#FFF6E9', margin: 0, fontSize: 26, fontWeight: 900 }}>נגמר הזמן!</h3>
            <p style={{ color: 'rgba(255,246,233,.9)', margin: 0, fontWeight: 700 }}>פגעתם ב־{hits} מטרות נכונות! 🎯</p>
          </div>
        )}

        {started && !ended && targets.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`target-item ${item.dir} ${item.hit ? 'is-hit' : ''}`}
            style={{ top: `${item.topPct}%`, left: 0, animationDuration: `${item.duration}s`, animationTimingFunction: 'linear' }}
            onPointerDown={(e) => { e.preventDefault(); hitTarget(item); }}
            onAnimationEnd={() => setTargets((cur) => cur.filter((t) => t.id !== item.id))}
            aria-label={item.label}
          >
            <span className="target-disc">🎯</span>
            <span className="target-label">{item.label}</span>
          </button>
        ))}
      </div>

      <p className="muted" style={{ textAlign: 'center', margin: 0 }}>💡 מטרה נכונה מזכה בנקודות, מטרה שגויה מורידה — חשבו מהר, פגעו מדויק!</p>
    </div>
  );
}

export function Editor({ content, onChange }: StageEditorProps<TargetShootingContent>) {
  return (
    <div>
      <TextField label="שאלה (מה שואלים על החלומות?)" value={content.question} onChange={(v) => onChange({ ...content, question: v })} />
      <StringListField label="תשובות נכונות — המטרות שצריך לפגוע בהן" values={content.correct} onChange={(v) => onChange({ ...content, correct: v })} />
      <StringListField label="תשובות שגויות — מסיחים" values={content.wrong} onChange={(v) => onChange({ ...content, wrong: v })} />
      <p className="field-hint" style={{ fontSize: 13, color: 'var(--ink-soft)' }}>💡 כל תשובה עד 4 מילים — ככה היא נכנסת יפה על המטרה.</p>
    </div>
  );
}
