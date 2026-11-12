import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { TouchEvent as ReactTouchEvent } from 'react';
import type { StagePlayerProps, StageEditorProps, HobbiesRunnerContent } from '../types';
import { PairsListField } from '../components/ui';
import './hobbies-runner.css';

const AREA_H = 380;
const DURATION_S = 30;
const FALL_MS = 2100;
const SPAWN_MS = 850;
const CATCH_Y = AREA_H - 96;
const TRAVEL = AREA_H + 90;

interface PoolItem { label: string; emoji: string; kind: 'correct' | 'wrong' }
interface Falling { id: number; label: string; emoji: string; kind: 'correct' | 'wrong'; lane: number; y: number; resolved: boolean }

interface GameState {
  items: Falling[];
  nextId: number;
  lastSpawn: number;
  lastFrame: number;
  endAt: number;
  basket: number;
  running: boolean;
}

export function Player({ content, celebrantName, api }: StagePlayerProps<HobbiesRunnerContent>) {
  const pool = useMemo<PoolItem[]>(() => [
    ...content.correct.map((c) => ({ ...c, kind: 'correct' as const })),
    ...content.wrong.map((w) => ({ ...w, kind: 'wrong' as const })),
  ], [content]);

  const gameRef = useRef<GameState>({ items: [], nextId: 1, lastSpawn: 0, lastFrame: 0, endAt: 0, basket: 1, running: false });
  const rafRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const finishedRef = useRef(false);
  const touchXRef = useRef<number | null>(null);
  const areaRef = useRef<HTMLDivElement | null>(null);
  const poolRef = useRef(pool);
  poolRef.current = pool;
  const apiRef = useRef(api);
  apiRef.current = api;

  const [phase, setPhase] = useState<'ready' | 'playing' | 'done'>('ready');
  const [items, setItems] = useState<Falling[]>([]);
  const [basketLane, setBasketLane] = useState(1);
  const [timeLeft, setTimeLeft] = useState(DURATION_S);
  const [flash, setFlash] = useState<{ id: number; text: string; good: boolean } | null>(null);
  const [caught, setCaught] = useState(0);
  const [shaking, setShaking] = useState(false);

  const later = useCallback((fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  }, []);

  const finishOnce = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    apiRef.current.finish();
  }, []);

  const move = useCallback((dir: number) => {
    const g = gameRef.current;
    const next = Math.max(0, Math.min(2, g.basket + dir));
    if (next !== g.basket) {
      g.basket = next;
      setBasketLane(next);
    }
  }, []);

  // keyboard arrows
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); move(1); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [move]);

  // unmount cleanup
  useEffect(() => () => {
    gameRef.current.running = false;
    cancelAnimationFrame(rafRef.current);
    timersRef.current.forEach((t) => window.clearTimeout(t));
  }, []);

  const loop = useCallback((now: number) => {
    const g = gameRef.current;
    if (!g.running) return;
    const dt = Math.min(60, Math.max(0, now - g.lastFrame));
    g.lastFrame = now;

    const remaining = g.endAt - now;
    if (remaining <= 0) {
      g.running = false;
      setTimeLeft(0);
      setItems([]);
      setPhase('done');
      later(finishOnce, 600);
      return;
    }
    setTimeLeft(Math.ceil(remaining / 1000));

    if (now - g.lastSpawn >= SPAWN_MS && poolRef.current.length > 0) {
      g.lastSpawn = now;
      const src = poolRef.current[Math.floor(Math.random() * poolRef.current.length)];
      g.items.push({ id: g.nextId++, label: src.label, emoji: src.emoji, kind: src.kind, lane: Math.floor(Math.random() * 3), y: -72, resolved: false });
    }

    const speed = TRAVEL / FALL_MS;
    const events: { item: Falling; caughtIt: boolean }[] = [];
    const nextItems: Falling[] = [];
    for (const item of g.items) {
      const moved = { ...item, y: item.y + speed * dt };
      if (!moved.resolved && moved.y >= CATCH_Y) {
        moved.resolved = true;
        if (moved.lane === g.basket) {
          events.push({ item: moved, caughtIt: true });
          continue; // caught — disappears into the basket
        }
      }
      if (moved.y <= AREA_H + 16) nextItems.push(moved);
    }
    g.items = nextItems;
    setItems(nextItems);

    for (const ev of events) {
      if (ev.item.kind === 'correct') {
        apiRef.current.addPoints(20);
        apiRef.current.feedback('good');
        setCaught((c) => c + 1);
        setFlash({ id: ev.item.id, text: `+20 ${ev.item.emoji} ${ev.item.label}!`, good: true });
      } else {
        apiRef.current.addPoints(-15);
        apiRef.current.feedback('bad');
        setShaking(true);
        later(() => setShaking(false), 480);
        setFlash({ id: ev.item.id, text: `−15 ${ev.item.emoji} ${ev.item.label} — זה לא תחביב שלה!`, good: false });
      }
      const fid = ev.item.id;
      later(() => setFlash((f) => (f && f.id === fid ? null : f)), 750);
    }

    rafRef.current = requestAnimationFrame(loop);
  }, [finishOnce, later]);

  const start = () => {
    const g = gameRef.current;
    cancelAnimationFrame(rafRef.current);
    g.items = [];
    g.basket = 1;
    g.running = true;
    g.lastSpawn = 0;
    g.lastFrame = performance.now();
    g.endAt = g.lastFrame + DURATION_S * 1000;
    setBasketLane(1);
    setItems([]);
    setCaught(0);
    setFlash(null);
    setTimeLeft(DURATION_S);
    setPhase('playing');
    rafRef.current = requestAnimationFrame(loop);
  };

  const onTouchStart = (e: ReactTouchEvent) => {
    touchXRef.current = e.touches[0]?.clientX ?? null;
  };
  const onTouchEnd = (e: ReactTouchEvent) => {
    const startX = touchXRef.current;
    touchXRef.current = null;
    if (startX === null) return;
    const endX = e.changedTouches[0]?.clientX;
    if (endX === undefined) return;
    const dx = endX - startX;
    if (dx > 24) move(1);
    else if (dx < -24) move(-1);
  };

  return (
    <div className="card pop-in">
      <div className="note" style={{ marginBottom: 14 }}>{content.instructions}</div>

      <div className="hr-topbar">
        <span className="chip chip-teal">🎯 תחביבים שנתפסו: {caught}</span>
        <div className="hr-timerbar"><div className="hr-timerfill" style={{ width: `${(timeLeft / DURATION_S) * 100}%` }} /></div>
        <span className={`hr-clock${timeLeft <= 5 && phase === 'playing' ? ' low' : ''}`}>⏱ {timeLeft}</span>
      </div>

      <div
        ref={areaRef}
        className={`hr-area${shaking ? ' shake' : ''}`}
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        <div className="hr-lane-line" style={{ left: '33.333%' }} aria-hidden="true" />
        <div className="hr-lane-line" style={{ left: '66.666%' }} aria-hidden="true" />
        <div className="hr-finish" aria-hidden="true" />

        {items.map((item) => (
          <div
            key={item.id}
            className="hr-item"
            style={{ left: `${item.lane * 33.333}%`, transform: `translateY(${item.y}px)` }}
          >
            <span className="hr-item-emoji">{item.emoji}</span>
            <span className="hr-item-label">{item.label}</span>
          </div>
        ))}

        <div className="hr-basket" style={{ left: `${basketLane * 33.333}%` }} aria-hidden="true">🧺</div>

        {flash ? (
          <div className="hr-flash-wrap" key={flash.id}>
            <span className={`hr-flash ${flash.good ? 'good' : 'bad'} pop-in`}>{flash.text}</span>
          </div>
        ) : null}

        {phase === 'ready' ? (
          <div className="hr-overlay">
            <div className="hr-overlay-emoji floaty">🏃‍♀️</div>
            <p className="hr-overlay-title">רצים עם {celebrantName}!</p>
            <p className="hr-overlay-text">הזיזו את הסל עם החצים ◀ ▶ או בהחלקה, ותפסו רק את התחביבים האמיתיים שלה. תחביב נכון = ‎+20‎, טעות = ‎−15‎.</p>
            <button type="button" className="btn btn-coral btn-big" style={{ maxWidth: 300 }} onClick={start}>🏃 התחל — 30 שניות!</button>
          </div>
        ) : null}

        {phase === 'done' ? (
          <div className="hr-overlay">
            <div className="hr-overlay-emoji">🏁</div>
            <p className="hr-overlay-title">נגמר הזמן!</p>
            <p className="hr-overlay-text">תפסתם {caught} תחביבים נכונים של {celebrantName} 🎉</p>
          </div>
        ) : null}
      </div>

      <div className="hr-controls">
        <button type="button" className="btn btn-teal hr-arrow" aria-label="שמאלה" onClick={() => move(-1)}>◀</button>
        <button type="button" className="btn btn-teal hr-arrow" aria-label="ימינה" onClick={() => move(1)}>▶</button>
      </div>

      <div className="hr-score-strip">
        {content.correct.map((c) => (
          <span key={c.label} className="chip chip-green">{c.emoji} {c.label}</span>
        ))}
        <span className="chip chip-coral">כל השאר — לא שלה! ✋</span>
      </div>
    </div>
  );
}

export function Editor({ content, onChange }: StageEditorProps<HobbiesRunnerContent>) {
  return (
    <div>
      <PairsListField label="תחביבים נכונים" values={content.correct} onChange={(v) => onChange({ ...content, correct: v })} />
      <PairsListField label="תחביבים שאינם שלה" values={content.wrong} onChange={(v) => onChange({ ...content, wrong: v })} />
    </div>
  );
}
