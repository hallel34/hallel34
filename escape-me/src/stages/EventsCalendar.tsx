import { useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import type { StagePlayerProps, StageEditorProps, EventsCalendarContent } from '../types';
import { StringListField } from '../components/ui';
import './events-calendar.css';

interface NoteItem { text: string; isTrue: boolean; rot: number; bg: string; }

const ROTS = [-2.1, 1.6, -1.2, 2.2, -1.7, 1.3, -2.4, 1.9, -1.4, 2.0];
const BGS = [
  'linear-gradient(180deg, #FFECB0, #FFE9A8)',
  'linear-gradient(180deg, #FFD9CE, #FFC4B2)',
  'linear-gradient(180deg, #CDEFFF, #AEE3FA)',
  'linear-gradient(180deg, #DFF5D2, #C6EDB6)',
  'linear-gradient(180deg, #F3E2FF, #E4C8FA)',
  'linear-gradient(180deg, #FFE3F1, #FFC9E0)',
];

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

export function Player({ content, celebrantName, api }: StagePlayerProps<EventsCalendarContent>) {
  const finishedRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  const [notes] = useState<NoteItem[]>(() =>
    shuffle([
      ...content.trueEvents.map((t) => ({ text: t, isTrue: true })),
      ...content.decoyEvents.map((t) => ({ text: t, isTrue: false })),
    ]).map((n, i) => ({ ...n, rot: ROTS[i % ROTS.length], bg: BGS[i % BGS.length] })),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [locked, setLocked] = useState<Set<string>>(new Set());
  const [shakeIds, setShakeIds] = useState<Set<string>>(new Set());
  const [wiggleId, setWiggleId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; kind: 'good' | 'bad' } | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => () => { timersRef.current.forEach((t) => window.clearTimeout(t)); }, []);
  const later = (fn: () => void, ms: number) => { timersRef.current.push(window.setTimeout(fn, ms)); };

  const totalTrue = content.trueEvents.length;
  const needed = totalTrue - locked.size;

  const finishOnce = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    api.finish();
  };

  const onNoteTap = (note: NoteItem) => {
    if (done || locked.has(note.text)) return;
    if (selected.has(note.text)) {
      const next = new Set(selected);
      next.delete(note.text);
      setSelected(next);
      return;
    }
    if (selected.size >= needed) {
      setWiggleId(note.text);
      later(() => setWiggleId(null), 450);
      return;
    }
    const next = new Set(selected);
    next.add(note.text);
    setSelected(next);
  };

  const onConfirm = () => {
    if (done || selected.size !== needed) return;
    const picks = notes.filter((n) => selected.has(n.text));
    const wrong = picks.filter((n) => !n.isTrue);
    const right = picks.filter((n) => n.isTrue);

    if (wrong.length > 0) {
      wrong.forEach(() => api.addPoints(-20));
      api.feedback('bad');
      setShakeIds(new Set(wrong.map((n) => n.text)));
      later(() => setShakeIds(new Set()), 500);
      setMessage({ text: `❌ ${wrong.length} בחירות אינן נכונות — הן ירדו מהלוח, נסו שוב!`, kind: 'bad' });
    } else if (right.length > 0) {
      api.feedback('good');
      setMessage({ text: '🎯 כל הבחירות נכונות!', kind: 'good' });
    }

    const nextLocked = new Set(locked);
    right.forEach((n) => nextLocked.add(n.text));
    setLocked(nextLocked);
    setSelected(new Set());

    if (nextLocked.size >= totalTrue) {
      setDone(true);
      setMessage({ text: '🎉 כל האירועים האמיתיים נמצאו!', kind: 'good' });
      later(finishOnce, 800);
    }
  };

  return (
    <div className="card pop-in">
      <div className="note" style={{ marginBottom: 14 }}>{content.instructions}</div>

      <div className="ec-board">
        <div className="ec-board-head">📅 לוח האירועים של {celebrantName}</div>
        <div className="ec-grid">
          {notes.map((note) => {
            const isLocked = locked.has(note.text);
            const isSelected = selected.has(note.text);
            const cls = `note ec-note${isSelected ? ' selected' : ''}${isLocked ? ' locked pop-in' : ''}${shakeIds.has(note.text) ? ' shake' : ''}${wiggleId === note.text ? ' wiggle' : ''}`;
            return (
              <button
                type="button"
                key={note.text}
                className={cls}
                style={{ '--rot': `${note.rot}deg`, background: note.bg } as CSSProperties}
                onClick={() => onNoteTap(note)}
              >
                {isSelected ? <span className="ec-pin">📌</span> : null}
                {note.text}
                {isLocked ? <span className="ec-check">✓</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      {done ? (
        <div className="ec-success pop-in">🎉 מדהים! הלוח מלא רק באירועים אמיתיים!</div>
      ) : (
        <>
          <p className="ec-counter">
            {needed > 0
              ? <>נבחרו <span className="gold-text" style={{ fontSize: 19 }}>{selected.size}</span> מתוך {needed} אירועים שצריך למצוא עכשיו · ננעלו {locked.size} מתוך {totalTrue} ✓</>
              : 'כל האירועים נמצאו!'}
          </p>
          <button type="button" className="btn btn-teal btn-big" disabled={selected.size !== needed} onClick={onConfirm}>
            אישור ✔
          </button>
          {message ? <div className={`ec-msg ${message.kind} pop-in`}>{message.text}</div> : null}
        </>
      )}
    </div>
  );
}

export function Editor({ content, onChange }: StageEditorProps<EventsCalendarContent>) {
  return (
    <div>
      <StringListField label="אירועים אמיתיים (4)" values={content.trueEvents} onChange={(v) => onChange({ ...content, trueEvents: v })} placeholder="אירוע אמיתי…" />
      <StringListField label="אירועים מסיחים (4)" values={content.decoyEvents} onChange={(v) => onChange({ ...content, decoyEvents: v })} placeholder="אירוע מסיח…" />
    </div>
  );
}
