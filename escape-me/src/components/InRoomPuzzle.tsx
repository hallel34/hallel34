import { useRef, useState } from 'react';
import type { InRoomPuzzle as InRoomPuzzleT, StageApi } from '../types';
import '../world/world-ui.css';

/**
 * A stage solved AT the object in the house (v5 "גם וגם" delivery):
 * a code lock on the object, a riddle hidden behind it, or a thorough
 * search. Uses the shared StageApi, so scoring / hints / finish flow
 * behave exactly like the classic mini-games.
 */
export default function InRoomPuzzle({
  puzzle,
  hotspotLabel,
  roomLabel,
  api,
}: {
  puzzle: InRoomPuzzleT;
  hotspotLabel: string;
  roomLabel: string;
  api: StageApi;
}) {
  const [digits, setDigits] = useState('');
  const [shake, setShake] = useState(0);
  const [wrongPick, setWrongPick] = useState<number | null>(null);
  const [searchStage, setSearchStage] = useState<'idle' | 'searching' | 'done'>('idle');
  const [solved, setSolved] = useState(false);
  const solvedRef = useRef(false);

  const codeLen = (puzzle.code ?? '123').length;

  const solve = () => {
    if (solvedRef.current) return;
    solvedRef.current = true;
    api.addPoints(40);
    api.feedback('good');
    setSolved(true);
  };

  const fail = (points: number) => {
    api.addPoints(points);
    api.feedback('bad');
    setShake((s) => s + 1);
  };

  const pressDigit = (d: string) => {
    if (solved) return;
    setDigits((prev) => {
      const next = (prev + d).slice(0, codeLen);
      if (next.length === codeLen) {
        if (next === puzzle.code) window.setTimeout(solve, 180);
        else {
          fail(-15);
          window.setTimeout(() => setDigits(''), 350);
        }
      }
      return next;
    });
  };

  const pickOption = (i: number) => {
    if (solved) return;
    if (i === puzzle.correctIndex) solve();
    else { setWrongPick(i); fail(-10); }
  };

  const startSearch = () => {
    if (searchStage !== 'idle') return;
    setSearchStage('searching');
    window.setTimeout(() => { setSearchStage('done'); solve(); }, 1600);
  };

  return (
    <div className="card inroom-card" data-testid="inroom-puzzle">
      <div className="inroom-head">
        <span className="chip chip-teal">{roomLabel}</span>
        <strong>{hotspotLabel}</strong>
      </div>
      <p className="inroom-prompt">{puzzle.prompt}</p>

      {!solved && puzzle.kind === 'code' && (
        <div className={`inroom-lock${shake ? ' shake' : ''}`} key={shake}>
          <div className="inroom-display" data-testid="inroom-display" aria-label="הקוד שהוזן">
            {Array.from({ length: codeLen }).map((_, i) => (
              <span key={i} className={`inroom-digit${digits[i] ? ' filled' : ''}`}>{digits[i] ?? '•'}</span>
            ))}
          </div>
          <div className="inroom-keypad">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', '⌫'].map((k, i) => (
              k === '' ? <span key={i} /> : (
                <button
                  key={i}
                  type="button"
                  className="inroom-key"
                  data-key={k}
                  onClick={() => { if (k === '⌫') setDigits((d) => d.slice(0, -1)); else pressDigit(k); }}
                >
                  {k}
                </button>
              )
            ))}
          </div>
          <p className="muted" style={{ textAlign: 'center', margin: 0 }}>הקישו את הקוד — המנעול ייפתח מעצמו כשהקוד נכון.</p>
        </div>
      )}

      {!solved && puzzle.kind === 'riddle' && (
        <div className={`inroom-options${shake ? ' shake' : ''}`} key={shake}>
          {(puzzle.options ?? []).map((opt, i) => (
            <button
              key={i}
              type="button"
              className={`btn inroom-option${wrongPick === i ? ' wrong' : ''}`}
              data-option={i}
              disabled={wrongPick === i}
              onClick={() => pickOption(i)}
            >
              {opt}
            </button>
          ))}
        </div>
      )}

      {!solved && puzzle.kind === 'search' && (
        <div style={{ textAlign: 'center' }}>
          {searchStage === 'searching' ? (
            <div className="inroom-searching">🔍 מחפשים בכל הפינות…</div>
          ) : (
            <button type="button" className="btn btn-coral btn-big" onClick={startSearch}>🔍 חיפוש יסודי</button>
          )}
        </div>
      )}

      {solved && (
        <div className="inroom-success pop-in">
          <div style={{ fontSize: 34 }}>🎉</div>
          <p style={{ fontWeight: 700, margin: '6px 0' }}>{puzzle.successText}</p>
          <button type="button" className="btn btn-teal btn-big" data-testid="inroom-finish" onClick={() => api.finish()}>
            ✓ סיימתי — חזרה לבית
          </button>
        </div>
      )}
    </div>
  );
}
