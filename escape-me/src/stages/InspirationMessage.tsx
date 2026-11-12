import { useEffect, useMemo, useRef, useState } from 'react';
import type { StagePlayerProps, StageEditorProps, InspirationContent } from '../types';
import { TextField, TextAreaField } from '../components/ui';
import './inspiration-message.css';

const WAVE_HEIGHTS = [14, 24, 34, 20, 38, 26, 16, 32, 40, 22, 30, 18, 36, 24, 14, 28, 38, 20, 32, 16, 26, 36, 22, 30, 18, 34, 24, 14];
const BADGE_LETTERS = ['א', 'ב', 'ג', 'ד'];
const MAX_RECORD_SECONDS = 90;
const MAX_DATA_URL = 1_600_000;

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '🎙';
  return parts.slice(0, 2).map((p) => p[0]).join('');
}

function shuffledIndices(n: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function Player({ content, api }: StagePlayerProps<InspirationContent>) {
  const [listened, setListened] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [showText, setShowText] = useState(false);
  const [wrong, setWrong] = useState<Set<number>>(new Set());
  const [picked, setPicked] = useState<number | null>(null);
  const order = useMemo(() => shuffledIndices(content.options.length), [content.options.length]);
  const finishedRef = useRef(false);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      try { window.speechSynthesis?.cancel(); } catch { /* ignore */ }
      if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    };
  }, []);

  const finishOnce = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    timerRef.current = window.setTimeout(() => api.finish(), 1000);
  };

  const speak = () => {
    try {
      const synth = window.speechSynthesis;
      if (!synth) { setShowText(true); setListened(true); return; }
      synth.cancel();
      const utter = new SpeechSynthesisUtterance(content.storyText);
      utter.lang = 'he-IL';
      utter.rate = 0.95;
      try {
        const hebrew = synth.getVoices().find((v) => v.lang && v.lang.toLowerCase().startsWith('he'));
        if (hebrew) utter.voice = hebrew;
      } catch { /* ignore */ }
      utter.onend = () => { setSpeaking(false); setListened(true); };
      utter.onerror = () => { setSpeaking(false); setListened(true); };
      setSpeaking(true);
      synth.speak(utter);
    } catch {
      setSpeaking(false);
      setShowText(true);
      setListened(true);
    }
  };

  const choose = (origIndex: number) => {
    if (picked !== null || wrong.has(origIndex)) return;
    if (origIndex === content.correctIndex) {
      setPicked(origIndex);
      api.feedback('good');
      finishOnce();
    } else {
      api.addPoints(-20);
      api.feedback('bad');
      setWrong((prev) => new Set(prev).add(origIndex));
    }
  };

  const hasAudio = typeof content.audioDataUrl === 'string' && content.audioDataUrl.length > 0;

  return (
    <div className="im-wrap">
      <div className="note">💌 {content.instructions}</div>

      <div className="im-voice-card pop-in">
        <div className="im-voice-head">
          <div className="im-avatar">{initialsOf(content.speakerName)}</div>
          <div>
            <div className="im-speaker-name">{content.speakerName}</div>
            <div className="im-speaker-sub">הודעה קולית במיוחד בשבילך 🎧</div>
          </div>
          <span className="chip chip-mustard" style={{ marginInlineStart: 'auto' }}>{listened ? 'נשמע ✓' : 'חדש ✨'}</span>
        </div>

        <div className={`im-wave${speaking ? ' playing' : ''}`} aria-hidden="true">
          {WAVE_HEIGHTS.map((h, i) => (
            <div
              key={i}
              className="im-wave-bar"
              style={{ height: listened || speaking ? h : Math.max(8, h - 10), animationDelay: `${(i % 7) * 0.09}s`, opacity: listened ? 1 : 0.75 }}
            />
          ))}
        </div>

        {hasAudio ? (
          <>
            <div className="im-caption">🎙 הודעה מוקלטת</div>
            <audio
              className="im-audio"
              controls
              src={content.audioDataUrl}
              onPlay={() => setListened(true)}
            />
          </>
        ) : (
          <>
            {speaking ? (
              <>
                <div className="im-eq" aria-hidden="true">
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
                    <span key={i} style={{ animationDelay: `${i * 0.07}s`, animationDuration: `${0.4 + (i % 4) * 0.11}s` }} />
                  ))}
                </div>
                <div className="im-caption">🔊 מקריאים לך את הסיפור…</div>
              </>
            ) : (
              <button type="button" className="btn btn-mustard btn-big" onClick={speak}>
                ▶ השמע את הסיפור
              </button>
            )}
          </>
        )}

        {!showText && !listened && (
          <div style={{ marginTop: 8 }}>
            <div className="im-story-blur" aria-hidden="true">{content.storyText}</div>
          </div>
        )}
        {(showText || listened) && (
          <div className="im-story-shown pop-in" style={{ marginTop: 8 }}>{content.storyText}</div>
        )}
        {!listened && (
          <button
            type="button"
            className="im-read-link"
            onClick={() => { setShowText(true); setListened(true); }}
          >
            מעדיפים לקרוא? הצג את הטקסט
          </button>
        )}
      </div>

      {!listened ? (
        <div className="im-locked">🔒 השאלה והתשובות ייפתחו אחרי שתשמעו את הסיפור</div>
      ) : (
        <div className="card pop-in">
          <h3 className="section-title">❓ {content.question}</h3>
          <div className="im-options">
            {order.map((origIndex, pos) => {
              const isWrong = wrong.has(origIndex);
              const isCorrect = picked === origIndex;
              return (
                <button
                  key={origIndex}
                  type="button"
                  disabled={isWrong || picked !== null}
                  className={`im-option${isCorrect ? ' correct' : ''}${isWrong ? ' wrong shake' : ''}`}
                  onClick={() => choose(origIndex)}
                >
                  <span className="im-opt-badge">{isCorrect ? '✓' : isWrong ? '✗' : BADGE_LETTERS[pos] ?? pos + 1}</span>
                  <span>{content.options[origIndex]}</span>
                </button>
              );
            })}
          </div>
          {picked !== null && (
            <div style={{ marginTop: 12 }}>
              <div className="im-success pop-in">🎉 נכון מאוד! שמעתם מצוין!</div>
            </div>
          )}
          {picked === null && wrong.size > 0 && (
            <p className="muted" style={{ marginTop: 10 }}>לא בדיוק… נסו תשובה אחרת 💪</p>
          )}
        </div>
      )}
    </div>
  );
}

export function Editor({ content, onChange }: StageEditorProps<InspirationContent>) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [recError, setRecError] = useState('');
  const [recWarn, setRecWarn] = useState('');
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const intervalRef = useRef<number | null>(null);
  const startRef = useRef(0);
  const mountedRef = useRef(true);

  const stopTracks = () => {
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    streamRef.current = null;
  };
  const clearTimer = () => {
    if (intervalRef.current !== null) { window.clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      clearTimer();
      try {
        if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
      } catch { /* ignore */ }
      stopTracks();
    };
  }, []);

  const stopRecording = () => {
    try {
      if (recorderRef.current && recorderRef.current.state !== 'inactive') recorderRef.current.stop();
    } catch { /* ignore */ }
  };

  const startRecording = async () => {
    setRecError('');
    setRecWarn('');
    try {
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function' || typeof MediaRecorder === 'undefined') {
        setRecError('הדפדפן הזה לא תומך בהקלטה. אפשר להמשיך בלי — השחקנים ישמעו הקראה אוטומטית.');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.ondataavailable = (ev) => { if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data); };
      recorder.onstop = () => {
        clearTimer();
        stopTracks();
        if (!mountedRef.current) return;
        setRecording(false);
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        const reader = new FileReader();
        reader.onload = () => {
          if (!mountedRef.current) return;
          const dataUrl = typeof reader.result === 'string' ? reader.result : '';
          if (!dataUrl) { setRecError('ההקלטה לא נשמרה — נסו שוב.'); return; }
          if (dataUrl.length > MAX_DATA_URL) {
            setRecWarn('ההקלטה גדולה מדי — נסו הקלטה קצרה יותר');
            return;
          }
          onChange({ ...content, audioDataUrl: dataUrl });
        };
        reader.onerror = () => { if (mountedRef.current) setRecError('ההקלטה לא נשמרה — נסו שוב.'); };
        reader.readAsDataURL(blob);
      };
      recorder.start();
      startRef.current = Date.now();
      setElapsed(0);
      setRecording(true);
      intervalRef.current = window.setInterval(() => {
        const secs = Math.floor((Date.now() - startRef.current) / 1000);
        setElapsed(secs);
        if (secs >= MAX_RECORD_SECONDS) stopRecording();
      }, 250);
    } catch {
      stopTracks();
      if (mountedRef.current) setRecError('לא קיבלנו גישה למיקרופון 🎤 בדקו את הרשאות הדפדפן ונסו שוב — זה לא חובה, תמיד יש הקראה אוטומטית.');
    }
  };

  const deleteRecording = () => {
    const next = { ...content };
    delete next.audioDataUrl;
    onChange(next);
    setRecWarn('');
    setRecError('');
  };

  const audioSizeKb = content.audioDataUrl ? Math.round((content.audioDataUrl.length * 3) / 4 / 1024) : 0;
  const options = content.options.length >= 4 ? content.options : [...content.options, '', '', '', ''].slice(0, 4);

  return (
    <div>
      <TextField label="מי מספר? (שם הדובר/ת)" value={content.speakerName} onChange={(v) => onChange({ ...content, speakerName: v })} placeholder="למשל: סבתא רותי" />
      <TextAreaField label="הסיפור / ההודעה" value={content.storyText} onChange={(v) => onChange({ ...content, storyText: v })} placeholder="הסיפור שהשחקנים ישמעו…" />
      <TextField label="השאלה בסוף הסיפור" value={content.question} onChange={(v) => onChange({ ...content, question: v })} />

      <div className="field">
        <label>ארבע התשובות האפשריות (סמנו את הנכונה)</label>
        {options.map((opt, i) => (
          <div className="im-opt-row" key={i}>
            <TextField
              label={`תשובה ${BADGE_LETTERS[i]}`}
              value={opt}
              onChange={(v) => {
                const next = [...options];
                next[i] = v;
                onChange({ ...content, options: next });
              }}
            />
            <label className="im-radio">
              <input
                type="radio"
                name="inspiration-correct"
                checked={content.correctIndex === i}
                onChange={() => onChange({ ...content, options, correctIndex: i })}
              />
              נכונה ✓
            </label>
          </div>
        ))}
      </div>

      <div className="im-rec-box">
        <div className="im-rec-title">🎙 הקלטת הודעה קולית (לא חובה)</div>
        <p className="muted" style={{ marginBottom: 10 }}>
          הקליטו את הסיפור בקולכם — ככה זה נשמע אישי ומרגש הרבה יותר! עד {MAX_RECORD_SECONDS} שניות.
        </p>

        {recording ? (
          <div>
            <div className="im-rec-live">
              <span className="im-rec-dot" />
              מקליט… {elapsed} שניות (נותרו {Math.max(0, MAX_RECORD_SECONDS - elapsed)})
            </div>
            <div style={{ height: 10 }} />
            <button type="button" className="btn btn-coral btn-big" onClick={stopRecording}>■ עצור הקלטה</button>
          </div>
        ) : content.audioDataUrl ? (
          <div>
            <div className="im-caption" style={{ color: 'var(--ink)' }}>🎙 יש הקלטה שמורה ({audioSizeKb} KB)</div>
            <audio className="im-audio" controls src={content.audioDataUrl} />
            <button type="button" className="btn btn-ghost" style={{ color: 'var(--coral-dark)', boxShadow: 'inset 0 0 0 2px var(--coral)' }} onClick={deleteRecording}>
              🗑 מחק הקלטה
            </button>
          </div>
        ) : (
          <button type="button" className="btn btn-coral btn-big" onClick={startRecording}>● הקלט הודעה</button>
        )}

        {recError && <div className="im-rec-error">{recError}</div>}
        {recWarn && <div className="im-rec-warn">⚠️ {recWarn}</div>}
        <p className="field-hint muted" style={{ marginTop: 10, marginBottom: 0 }}>
          ההקלטה נשמרת במכשיר היוצר בלבד ואינה נכללת בקישור השיתוף (במקום זה השחקנים ישמעו הקראה אוטומטית).
        </p>
      </div>
    </div>
  );
}
