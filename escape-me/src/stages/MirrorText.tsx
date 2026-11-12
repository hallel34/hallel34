import { useEffect, useRef, useState } from 'react';
import type { StagePlayerProps, StageEditorProps, MirrorTextContent } from '../types';
import { TextField, TextAreaField, StringListField } from '../components/ui';
import './mirror-text.css';

function normalize(s: string): string {
  return s.trim().replace(/\s+/g, ' ');
}

export function Player({ content, api }: StagePlayerProps<MirrorTextContent>) {
  const [mirrorOn, setMirrorOn] = useState(false);
  const [camOn, setCamOn] = useState(false);
  const [camError, setCamError] = useState(false);
  const [answer, setAnswer] = useState('');
  const [message, setMessage] = useState('');
  const [shakeAnswer, setShakeAnswer] = useState(false);
  const [solved, setSolved] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const finishedRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  const stopStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
  };

  useEffect(() => {
    const timers = timersRef.current;
    return () => { stopStream(); timers.forEach((t) => window.clearTimeout(t)); };
  }, []);

  const later = (fn: () => void, ms: number) => {
    const id = window.setTimeout(fn, ms);
    timersRef.current.push(id);
  };

  const toggleCamera = async () => {
    if (camOn) {
      stopStream();
      setCamOn(false);
      return;
    }
    setCamError(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('unavailable');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      streamRef.current = stream;
      setCamOn(true);
      // attach after render
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
      });
    } catch {
      setCamError(true);
      setCamOn(false);
    }
  };

  // keep video attached if element remounts
  useEffect(() => {
    if (camOn && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => undefined);
    }
  }, [camOn]);

  const check = () => {
    if (solved) return;
    const input = normalize(answer);
    const pass = content.keywords.some((k) => {
      const kw = normalize(k);
      return kw.length > 0 && input.includes(kw);
    });
    if (pass) {
      api.feedback('good');
      setSolved(true);
      setMessage('נכון מאוד! 🎉');
      later(() => {
        if (!finishedRef.current) { finishedRef.current = true; api.finish(); }
      }, 900);
    } else {
      api.addPoints(-10);
      api.feedback('bad');
      setMessage('עדיין לא — נסו שוב 💪');
      setShakeAnswer(true);
      later(() => setShakeAnswer(false), 500);
    }
  };

  return (
    <div className="mirror-wrap">
      <div className="note">{content.instructions}</div>

      <div className="mirror-aged pop-in">
        <div className="mirror-aged-title">✉️ {content.sourceTitle}</div>
        <div className="mirror-mirrored" aria-label="טקסט במראה">{content.cardText}</div>
        <p style={{ textAlign: 'center', margin: '12px 0 0', fontSize: 13, fontWeight: 700, color: '#6B4423' }}>👀 הטקסט הפוך! השתמשו במראה כדי לקרוא אותו</p>
      </div>

      <div className="mirror-tools">
        <button type="button" className={`btn ${mirrorOn ? 'btn-green' : 'btn-plum'}`} onClick={() => setMirrorOn((v) => !v)} style={{ flex: 1 }}>
          🪞 מראת קסם {mirrorOn ? '✓ פתוחה' : ''}
        </button>
        <button type="button" className={`btn ${camOn ? 'btn-green' : 'btn-teal'}`} onClick={() => { void toggleCamera(); }} style={{ flex: 1 }}>
          📷 מצלמת מראה {camOn ? '✓' : ''}
        </button>
      </div>

      {mirrorOn && (
        <div className="mirror-panel pop-in">
          <div className="mirror-panel-label">🪞 מראת הקסם — ככה זה נקרא נכון:</div>
          <div className="mirror-panel-text">{content.cardText}</div>
        </div>
      )}

      {camOn && (
        <div className="card mirror-cam-wrap pop-in">
          <div className="mirror-handmirror">
            <video ref={videoRef} autoPlay playsInline muted />
          </div>
          <div className="mirror-handle" aria-hidden="true" />
          <p className="muted" style={{ textAlign: 'center', margin: 0 }}>החזיקו את הפתק מול המצלמה — בתצוגה תראו אותו נכון! 🪞</p>
          <button type="button" className="btn btn-ghost" style={{ color: 'var(--wood-dark)', boxShadow: 'inset 0 0 0 2px var(--wood)' }} onClick={() => { void toggleCamera(); }}>סגירת מצלמה</button>
        </div>
      )}

      {camError && (
        <div className="note note-alt">המצלמה לא זמינה — אפשר להשתמש במראת הקסם 🪞</div>
      )}

      <div className={`card ${shakeAnswer ? 'shake' : ''}`}>
        {solved ? (
          <div style={{ textAlign: 'center', padding: '10px 0' }} className="pop-in">
            <div style={{ fontSize: 52 }}>🌟</div>
            <h3 className="section-title">קראתם במראה כמו מקצוענים!</h3>
            <p style={{ fontWeight: 700, color: 'var(--green-dark)' }}>{message}</p>
          </div>
        ) : (
          <>
            <h3 className="section-title" style={{ fontSize: 17 }}>❓ {content.question}</h3>
            <input
              className="mirror-answer-input"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') check(); }}
              placeholder="כתבו כאן את התשובה…"
              aria-label="תשובה"
            />
            {message ? <p style={{ margin: '10px 0 0', fontWeight: 800, color: 'var(--coral-dark)' }}>{message}</p> : null}
            <div style={{ height: 12 }} />
            <button type="button" className="btn btn-coral btn-big" onClick={check}>בדיקה ✓</button>
          </>
        )}
      </div>
    </div>
  );
}

export function Editor({ content, onChange }: StageEditorProps<MirrorTextContent>) {
  return (
    <div>
      <TextField label="כותרת המקור (מי כתב?)" value={content.sourceTitle} onChange={(v) => onChange({ ...content, sourceTitle: v })} />
      <TextAreaField label="הטקסט שיוצג הפוך" value={content.cardText} onChange={(v) => onChange({ ...content, cardText: v })} />
      <TextField label="שאלה לשחקנים" value={content.question} onChange={(v) => onChange({ ...content, question: v })} />
      <StringListField label="מילות מפתח שמתקבלות בתשובה" values={content.keywords} onChange={(v) => onChange({ ...content, keywords: v })} />
    </div>
  );
}
