import { useEffect, useRef, useState } from 'react';
import type { StagePlayerProps, StageEditorProps, ValuesCardContent } from '../types';
import { TextField, TextAreaField } from '../components/ui';
import './values-card.css';

type CoverState = { index: number; revealed: boolean } | null;

const WRONG_OFFSETS = [2, 9, 16, 23];

function wrongLetters(storyText: string): string[] {
  const pool = storyText.replace(/[^א-תa-zA-Z]/g, '');
  if (pool.length === 0) return ['?', '?', '?', '?'];
  return WRONG_OFFSETS.map((off) => pool[off % pool.length]);
}

export function Player({ content, celebrantName, api }: StagePlayerProps<ValuesCardContent>) {
  const [tried, setTried] = useState<Set<number>>(new Set());
  const [cover, setCover] = useState<CoverState>(null);
  const [wonIndex, setWonIndex] = useState<number | null>(null);
  const [success, setSuccess] = useState(false);
  const finishedRef = useRef(false);
  const timersRef = useRef<number[]>([]);
  const busyRef = useRef(false);

  useEffect(() => {
    const timers = timersRef.current;
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, []);

  const later = (fn: () => void, ms: number) => {
    timersRef.current.push(window.setTimeout(fn, ms));
  };

  const tapCard = (idx: number) => {
    if (busyRef.current || tried.has(idx) || wonIndex !== null) return;
    busyRef.current = true;
    const card = content.cards[idx];
    setCover({ index: idx, revealed: false });

    later(() => {
      setCover({ index: idx, revealed: true });
      if (card.isCorrect) {
        api.feedback('good');
        setWonIndex(idx);
        later(() => {
          setSuccess(true);
          if (!finishedRef.current) {
            finishedRef.current = true;
            later(() => api.finish(), 1500);
          }
        }, 500);
      } else {
        api.addPoints(-30);
        api.feedback('bad');
        later(() => {
          setTried((prev) => new Set(prev).add(idx));
          setCover(null);
          busyRef.current = false;
        }, 1250);
      }
    }, 750);
  };

  const coverCard = cover !== null ? content.cards[cover.index] : null;
  const coverLetters = cover !== null && !coverCard?.isCorrect ? wrongLetters(content.storyText) : [];

  return (
    <div className="vc-wrap">
      <div className="note">💎 {content.instructions}</div>

      <div className="vc-stage-zone">
        <div className="vc-book pop-in">
          <div className="vc-book-title">📖 סיפור קצר על {celebrantName}</div>
          <div className="vc-book-text">{content.storyText}</div>
          <div className="vc-book-page">~ עמוד אחד מתוך ספר החיים ~</div>
        </div>

        <div className={`vc-cover${cover !== null ? ' on' : ''}`} aria-hidden={cover === null}>
          {cover !== null && coverCard && (
            <>
              <div className="vc-cover-label">
                {cover.revealed
                  ? coverCard.isCorrect ? '✨ המילה הסודית נחשפה! ✨' : 'החלונות מראים…'
                  : 'הכרטיסייה מכסה את הסיפור…'}
              </div>
              {coverCard.isCorrect ? (
                cover.revealed ? (
                  <>
                    <div className="vc-answer-word" dir="rtl">
                      {content.answerWord.split('').map((ch, i) => (
                        <span key={i} className="pop-in" style={{ animationDelay: `${i * 0.13}s` }}>{ch}</span>
                      ))}
                    </div>
                    <div className="vc-cover-sub">זו מילת הערך של {celebrantName}! 💎</div>
                  </>
                ) : (
                  <div className="vc-windows">
                    {[0, 1, 2, 3].map((i) => <div key={i} className="vc-window gold">·</div>)}
                  </div>
                )
              ) : (
                <div className="vc-windows">
                  {cover.revealed
                    ? coverLetters.map((ch, i) => (
                      <div key={i} className="vc-window pop-in" style={{ animationDelay: `${i * 0.12}s` }}>{ch}</div>
                    ))
                    : [0, 1, 2, 3].map((i) => <div key={i} className="vc-window">·</div>)}
                </div>
              )}
              {cover.revealed && !coverCard.isCorrect && (
                <div className="vc-cover-sub">אלה לא אותיות המילה הסודית… נסו כרטיסייה אחרת!</div>
              )}
            </>
          )}
        </div>
      </div>

      {success ? (
        <div className="vc-success pop-in">
          🎉 מצאתם את המילה הסודית: <span className="gold-text">{content.answerWord}</span>!
        </div>
      ) : (
        <>
          <h3 className="section-title" style={{ color: 'var(--paper)', textShadow: '0 2px 6px rgba(0,0,0,.5)' }}>
            🤔 איזו כרטיסייה תחשוף את המילה הסודית?
          </h3>
          <div className="vc-cards">
            {content.cards.map((card, i) => {
              const isTried = tried.has(i);
              const isWon = wonIndex === i;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={isTried || wonIndex !== null}
                  className={`vc-card-btn${isTried ? ' tried' : ''}${isWon ? ' won' : ''}`}
                  onClick={() => tapCard(i)}
                >
                  {isTried && <span className="vc-tried-badge">✗ נוסתה</span>}
                  {isWon && <span className="vc-tried-badge" style={{ background: 'var(--gold)', color: '#3A2708' }}>✓ זו היא!</span>}
                  <div className="vc-card-statement">{card.statement}</div>
                  <div className="vc-holes" aria-hidden="true">
                    {[0, 1, 2, 3].map((h) => <span key={h} className="vc-hole" />)}
                  </div>
                </button>
              );
            })}
          </div>
          {tried.size > 0 && wonIndex === null && (
            <p className="muted" style={{ color: 'rgba(255,246,233,.85)' }}>
              נותרו {content.cards.length - tried.size} כרטיסיות לנסות — חשבו איזו מהן מתחברת באמת לסיפור 💭
            </p>
          )}
        </>
      )}
    </div>
  );
}

export function Editor({ content, onChange }: StageEditorProps<ValuesCardContent>) {
  const correctCount = content.cards.filter((c) => c.isCorrect).length;
  const cards = content.cards.length >= 4 ? content.cards : [...content.cards, ...Array.from({ length: 4 - content.cards.length }, () => ({ statement: '', isCorrect: false }))];
  const updateCard = (i: number, patch: Partial<ValuesCardContent['cards'][number]>) => {
    onChange({ ...content, cards: cards.map((c, j) => (j === i ? { ...c, ...patch } : c)) });
  };
  return (
    <div>
      <TextAreaField
        label="הסיפור (חייב להכיל את אותיות מילת התשובה לפי הסדר)"
        value={content.storyText}
        onChange={(v) => onChange({ ...content, storyText: v })}
        placeholder="סיפור קצר שמסתיר בתוכו את מילת הערך…"
      />
      <TextField label="מילת התשובה" value={content.answerWord} onChange={(v) => onChange({ ...content, answerWord: v })} placeholder="למשל: שליחות" />

      <div className="field">
        <label>ארבע הכרטיסיות (סמנו את הנכונה)</label>
        {cards.map((card, i) => (
          <div className="vc-card-row" key={i}>
            <TextField
              label={`כרטיסייה ${i + 1} — אמירה`}
              value={card.statement}
              onChange={(v) => updateCard(i, { statement: v })}
            />
            <label className="vc-radio">
              <input
                type="radio"
                name="values-correct"
                checked={card.isCorrect}
                onChange={() => onChange({
                  ...content,
                  cards: cards.map((c, j) => ({ ...c, isCorrect: j === i })),
                })}
              />
              זו הכרטיסייה הנכונה ✓
            </label>
          </div>
        ))}
      </div>

      <div className={`vc-valid${correctCount !== 1 ? ' bad' : ''}`}>
        {correctCount === 1
          ? '✓ מסומנת בדיוק כרטיסייה נכונה אחת'
          : `⚠️ מסומנות ${correctCount} כרטיסיות נכונות — חייבת להיות בדיוק 1`}
      </div>
    </div>
  );
}
