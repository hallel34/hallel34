import { useEffect, useRef, useState } from 'react';
import type { StagePlayerProps, StageEditorProps, FamilyTreeContent } from '../types';
import { StringListField, TextField } from '../components/ui';
import './family-tree.css';

type Slot = FamilyTreeContent['slots'][number];

const GEN_LABELS: Record<number, string> = {
  0: '👴👵 דור הסבים והסבתות',
  1: '👨‍👩‍👧 דור ההורים',
  2: '🧒 דור הילדים',
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
  }
  return a;
}

export function Player({ content, celebrantName, api }: StagePlayerProps<FamilyTreeContent>) {
  const finishedRef = useRef(false);
  const finishTimerRef = useRef<number | null>(null);
  const shakeTimerRef = useRef<number | null>(null);

  const [chips] = useState<string[]>(() => shuffle([...content.slots.map((s) => s.name), ...content.decoys]));
  const [placed, setPlaced] = useState<Record<string, boolean>>({});
  const [selected, setSelected] = useState<string | null>(null);
  const [shakeId, setShakeId] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => () => {
    if (finishTimerRef.current !== null) window.clearTimeout(finishTimerRef.current);
    if (shakeTimerRef.current !== null) window.clearTimeout(shakeTimerRef.current);
  }, []);

  const placedNames = new Set(content.slots.filter((s) => placed[s.id]).map((s) => s.name));
  const remainingChips = chips.filter((c) => !placedNames.has(c));
  const gens = ([0, 1, 2] as const).filter((g) => content.slots.some((s) => s.gen === g));

  const finishOnce = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    api.finish();
  };

  const onSlotTap = (slot: Slot) => {
    if (done || placed[slot.id]) return;
    if (!selected) {
      setShakeId(slot.id);
      if (shakeTimerRef.current !== null) window.clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = window.setTimeout(() => setShakeId(null), 480);
      return;
    }
    if (selected === slot.name) {
      const next = { ...placed, [slot.id]: true };
      setPlaced(next);
      setSelected(null);
      api.addPoints(10);
      api.feedback('good');
      if (content.slots.every((s) => next[s.id])) {
        setDone(true);
        finishTimerRef.current = window.setTimeout(finishOnce, 900);
      }
    } else {
      api.addPoints(-15);
      api.feedback('bad');
      setShakeId(slot.id);
      if (shakeTimerRef.current !== null) window.clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = window.setTimeout(() => setShakeId(null), 480);
    }
  };

  return (
    <div className="card pop-in">
      <div className="note" style={{ marginBottom: 14 }}>{content.instructions}</div>

      <div className="ft-head">
        <div className="ft-head-emoji">🌳</div>
        <h2 className="ft-head-title">עץ המשפחה של {celebrantName}</h2>
      </div>

      <div className="ft-tree">
        {gens.map((g, gi) => (
          <div key={g}>
            {gi > 0 ? <div className="ft-connector" aria-hidden="true" /> : null}
            <div className="ft-gen-label">{GEN_LABELS[g]}</div>
            <div className="ft-row">
              {content.slots.filter((s) => s.gen === g).map((slot) => {
                const isPlaced = !!placed[slot.id];
                return (
                  <button
                    type="button"
                    key={slot.id}
                    className={`ft-slot${isPlaced ? ' locked pop-in' : ' empty'}${!isPlaced && selected ? ' armed' : ''}${shakeId === slot.id ? ' shake' : ''}`}
                    onClick={() => onSlotTap(slot)}
                  >
                    {isPlaced ? <span className="ft-check">✓</span> : null}
                    <span className="ft-role">{slot.role}</span>
                    {isPlaced ? <span className="ft-name">{slot.name}</span> : <span className="ft-who">מי כאן? 🤔</span>}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {done ? (
        <div className="ft-success pop-in">🎉 העץ הושלם! כל המשפחה במקום!</div>
      ) : (
        <>
          <p className="ft-prompt">
            {selected ? <>בידך: <span className="gold-text" style={{ fontSize: 18 }}>{selected}</span> — הקישו על המקום שלו בעץ 👆</> : 'בחרו שם מהרשימה ואז הקישו על מקומו בעץ:'}
          </p>
          <div className="ft-chips">
            {remainingChips.map((name) => (
              <button
                type="button"
                key={name}
                className={`ft-chip${selected === name ? ' sel' : ''}`}
                onClick={() => setSelected(selected === name ? null : name)}
              >
                {name}
              </button>
            ))}
          </div>
          <p className="muted" style={{ textAlign: 'center', marginTop: 10, marginBottom: 0 }}>
            הושלמו {Object.keys(placed).length} מתוך {content.slots.length} מקומות · ⚠️ יש גם שמות מסיחים שלא שייכים לעץ!
          </p>
        </>
      )}
    </div>
  );
}

export function Editor({ content, onChange }: StageEditorProps<FamilyTreeContent>) {
  const updateSlot = (id: string, patch: Partial<Slot>) => {
    onChange({ ...content, slots: content.slots.map((s) => (s.id === id ? { ...s, ...patch } : s)) });
  };
  const removeSlot = (id: string) => {
    onChange({ ...content, slots: content.slots.filter((s) => s.id !== id) });
  };
  const addSlot = () => {
    onChange({ ...content, slots: [...content.slots, { id: `slot${Date.now()}`, role: '', name: '', gen: 1 as const }] });
  };

  return (
    <div>
      <p className="section-title" style={{ fontSize: 16 }}>🌳 מקומות בעץ המשפחה</p>
      {content.slots.map((slot, i) => (
        <div className="ft-editor-slot" key={slot.id}>
          <div className="ft-editor-slot-head">
            <span>מקום {i + 1}</span>
            <button type="button" className="icon-btn" aria-label="הסרת מקום" onClick={() => removeSlot(slot.id)}>✕</button>
          </div>
          <div className="field-row">
            <TextField label="תפקיד (למשל: סבא מצד אבא)" value={slot.role} onChange={(v) => updateSlot(slot.id, { role: v })} />
            <TextField label="שם נכון" value={slot.name} onChange={(v) => updateSlot(slot.id, { name: v })} />
          </div>
          <div className="field">
            <label>דור</label>
            <select value={slot.gen} onChange={(e) => updateSlot(slot.id, { gen: Number(e.target.value) as 0 | 1 | 2 })}>
              <option value={0}>0 · סבים</option>
              <option value={1}>1 · הורים</option>
              <option value={2}>2 · ילדים</option>
            </select>
          </div>
        </div>
      ))}
      <button type="button" className="btn btn-green" onClick={addSlot}>+ הוסף מקום בעץ</button>
      <div style={{ height: 12 }} />
      <StringListField label="שמות מסיחים (לא שייכים למשפחה)" values={content.decoys} onChange={(v) => onChange({ ...content, decoys: v })} placeholder="שם מסיח…" />
    </div>
  );
}
