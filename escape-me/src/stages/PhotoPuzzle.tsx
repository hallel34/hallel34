import { useEffect, useRef, useState } from 'react';
import type { StagePlayerProps, StageEditorProps, PhotoPuzzleContent } from '../types';
import { TextField } from '../components/ui';
import './photo-puzzle.css';

/* ---------- color helpers ---------- */
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const n = parseInt(h || '000000', 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex(r: number, g: number, b: number): string {
  const p = (v: number) => Math.round(v).toString(16).padStart(2, '0');
  return `#${p(r)}${p(g)}${p(b)}`;
}
function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  const rn = r / 255, gn = g / 255, bn = b / 255;
  const max = Math.max(rn, gn, bn), min = Math.min(rn, gn, bn), d = max - min;
  let h = 0;
  if (d > 0) {
    if (max === rn) h = ((gn - bn) / d) % 6;
    else if (max === gn) h = (bn - rn) / d + 2;
    else h = (rn - gn) / d + 4;
    h *= 60; if (h < 0) h += 360;
  }
  return { h, s: max === 0 ? 0 : d / max, v: max };
}
function hueName(h: number): string {
  if (h < 15 || h >= 345) return 'אדום';
  if (h < 42) return 'כתום';
  if (h < 70) return 'צהוב';
  if (h < 160) return 'ירוק';
  if (h < 200) return 'תכלת';
  if (h < 260) return 'כחול';
  if (h < 320) return 'סגול';
  return 'ורוד';
}
function hueDist(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

interface Sampled { hue: number; hex: string; r: number; g: number; b: number; sat: number }

function analyzeImage(img: HTMLImageElement, targetHex: string): { ok: boolean; sampled: Sampled } {
  const size = 48;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('no ctx');
  ctx.drawImage(img, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;
  let sinSum = 0, cosSum = 0, count = 0, rSum = 0, gSum = 0, bSum = 0;
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const { h, s, v } = rgbToHsv(r, g, b);
    if (s > 0.25 && v >= 0.15 && v <= 0.95) {
      const rad = (h * Math.PI) / 180;
      sinSum += Math.sin(rad); cosSum += Math.cos(rad);
      rSum += r; gSum += g; bSum += b; count++;
    }
  }
  let sampled: Sampled;
  if (count >= 8) {
    let hue = (Math.atan2(sinSum, cosSum) * 180) / Math.PI;
    if (hue < 0) hue += 360;
    const ar = rSum / count, ag = gSum / count, ab = bSum / count;
    sampled = { hue, hex: rgbToHex(ar, ag, ab), r: ar, g: ag, b: ab, sat: rgbToHsv(ar, ag, ab).s };
  } else {
    // fallback: overall average
    let n = 0, ar = 0, ag = 0, ab = 0;
    for (let i = 0; i < data.length; i += 4) { ar += data[i]; ag += data[i + 1]; ab += data[i + 2]; n++; }
    ar /= n; ag /= n; ab /= n;
    const hsv = rgbToHsv(ar, ag, ab);
    sampled = { hue: hsv.h, hex: rgbToHex(ar, ag, ab), r: ar, g: ag, b: ab, sat: hsv.s };
  }
  const t = hexToRgb(targetHex);
  const tHsv = rgbToHsv(t.r, t.g, t.b);
  let ok: boolean;
  if (tHsv.s < 0.18) {
    const dist = Math.sqrt((sampled.r - t.r) ** 2 + (sampled.g - t.g) ** 2 + (sampled.b - t.b) ** 2);
    ok = dist < 60;
  } else {
    ok = hueDist(sampled.hue, tHsv.h) <= 28;
  }
  return { ok, sampled };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('load failed'));
    img.src = src;
  });
}

function shuffledPerm(): number[] {
  const base = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  for (let attempt = 0; attempt < 60; attempt++) {
    const arr = [...base];
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    const misplaced = arr.filter((v, i) => v !== i).length;
    if (misplaced >= 6) return arr;
  }
  return [1, 2, 0, 4, 5, 3, 7, 8, 6];
}

/* ---------- Player ---------- */
type ColorPhase = 'idle' | 'cam' | 'checking' | 'miss' | 'error';

export function Player({ content, api }: StagePlayerProps<PhotoPuzzleContent>) {
  const [step, setStep] = useState<'color' | 'puzzle'>('color');
  const [phase, setPhase] = useState<ColorPhase>('idle');
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [sampledHex, setSampledHex] = useState<string | null>(null);

  const [perm, setPerm] = useState<number[]>(() => shuffledPerm());
  const [selected, setSelected] = useState<number | null>(null);
  const [moves, setMoves] = useState(0);
  const [showOriginal, setShowOriginal] = useState(false);
  const [solvedPuzzle, setSolvedPuzzle] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const finishedRef = useRef(false);
  const timersRef = useRef<number[]>([]);

  const stopStream = () => {
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
  };
  useEffect(() => {
    const timers = timersRef.current;
    return () => { stopStream(); timers.forEach((t) => window.clearTimeout(t)); };
  }, []);
  const later = (fn: () => void, ms: number) => { const id = window.setTimeout(fn, ms); timersRef.current.push(id); };

  const goPuzzle = () => { stopStream(); setStep('puzzle'); };

  const handleSample = async (src: string) => {
    setPhase('checking');
    try {
      const img = await loadImage(src);
      const { ok, sampled } = analyzeImage(img, content.targetColor);
      setSampledHex(sampled.hex);
      if (ok) {
        api.addPoints(40);
        api.feedback('good');
        setFeedbackMsg('🎨 צבע נכון!');
        setPhase('idle');
        later(goPuzzle, 800);
      } else {
        setPhase('miss');
        setFeedbackMsg(`הצבע שצילמתם קרוב ל־${hueName(sampled.hue)}, חפשו ${content.targetColorName} 🎯`);
      }
    } catch {
      setPhase('error');
      setFeedbackMsg('לא הצלחנו לקרוא את התמונה — נסו שוב או דלגו לפאזל.');
    }
  };

  const openCamera = async () => {
    setFeedbackMsg('');
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('unavailable');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      streamRef.current = stream;
      setPhase('cam');
      requestAnimationFrame(() => {
        if (videoRef.current) { videoRef.current.srcObject = stream; void videoRef.current.play().catch(() => undefined); }
      });
    } catch {
      setPhase('error');
      setFeedbackMsg('המצלמה לא זמינה כרגע — אפשר להעלות תמונה מהגלריה או לדלג לפאזל.');
    }
  };

  useEffect(() => {
    if (phase === 'cam' && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      void videoRef.current.play().catch(() => undefined);
    }
  }, [phase]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth; canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    stopStream();
    void handleSample(dataUrl);
  };

  const onFile = (file: File | null) => {
    if (!file || phase === 'checking') return;
    const reader = new FileReader();
    reader.onload = () => { if (typeof reader.result === 'string') void handleSample(reader.result); };
    reader.readAsDataURL(file);
  };

  // The live getUserMedia hunt is an enhancement for secure contexts only.
  // The reliable contract everywhere (incl. file://): the camera button is a
  // file input with capture="environment" (opens the device camera app), and
  // the gallery input has NO capture attribute (opens the gallery).
  const liveCamAvailable = typeof window !== 'undefined'
    && window.isSecureContext
    && typeof navigator !== 'undefined'
    && !!navigator.mediaDevices?.getUserMedia;

  const tapTile = (pos: number) => {
    if (solvedPuzzle) return;
    if (selected === null) { setSelected(pos); return; }
    if (selected === pos) { setSelected(null); return; }
    const next = [...perm];
    [next[selected], next[pos]] = [next[pos], next[selected]];
    setPerm(next);
    setSelected(null);
    setMoves((m) => m + 1);
    if (next.every((v, i) => v === i)) {
      setSolvedPuzzle(true);
      api.feedback('good');
      later(() => { if (!finishedRef.current) { finishedRef.current = true; api.finish(); } }, 1000);
    }
  };

  return (
    <div className="photo-wrap">
      <div className="note">{content.instructions}</div>

      {step === 'color' && (
        <div className="card pop-in">
          <h3 className="section-title" style={{ textAlign: 'center' }}>📸 משימת צבע</h3>
          <p style={{ textAlign: 'center', fontWeight: 700, margin: '0 0 14px' }}>
            מצאו מסביבכם משהו בצבע <span style={{ color: content.targetColor }}>{content.targetColorName}</span> וצלמו אותו!
          </p>
          <div className="photo-swatch-big floaty" style={{ background: content.targetColor }} aria-label={content.targetColorName} />
          <p style={{ textAlign: 'center', margin: '10px 0 16px' }}><span className="chip chip-mustard">{content.targetColorName}</span></p>

          {phase === 'cam' ? (
            <div className="pop-in">
              <video ref={videoRef} className="photo-cam-video" autoPlay playsInline muted />
              <div style={{ height: 12 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button type="button" className="btn btn-coral" style={{ flex: 1 }} onClick={capture}>📸 צלם!</button>
                <button type="button" className="btn btn-ghost" style={{ color: 'var(--wood-dark)', boxShadow: 'inset 0 0 0 2px var(--wood)' }} onClick={() => { stopStream(); setPhase('idle'); }}>ביטול</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label
                className="btn btn-teal btn-big"
                style={{ cursor: phase === 'checking' ? 'wait' : 'pointer', opacity: phase === 'checking' ? 0.65 : 1 }}
                data-testid="photo-camera-btn"
              >
                {phase === 'checking' ? '⏳ בודקים צבע…' : '📷 צלם'}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  data-testid="photo-camera-input"
                  style={{ display: 'none' }}
                  onChange={(e) => { onFile(e.target.files?.[0] ?? null); e.target.value = ''; }}
                />
              </label>
              <label className="photo-file-btn" data-testid="photo-gallery-btn">
                🖼️ העלאה מהגלריה
                <input
                  type="file"
                  accept="image/*"
                  data-testid="photo-gallery-input"
                  style={{ display: 'none' }}
                  onChange={(e) => { onFile(e.target.files?.[0] ?? null); e.target.value = ''; }}
                />
              </label>
              {liveCamAvailable && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ color: 'var(--wood-dark)', boxShadow: 'inset 0 0 0 2px var(--wood)' }}
                  onClick={() => { void openCamera(); }}
                  disabled={phase === 'checking'}
                >
                  📹 או צלמו בשידור חי
                </button>
              )}
            </div>
          )}

          {feedbackMsg && (
            <div className={`hint-bubble pop-in`} style={{ marginTop: 14, textAlign: 'center' }}>
              <div style={{ fontWeight: 800 }}>{feedbackMsg}</div>
              {(phase === 'miss') && sampledHex && (
                <div className="photo-swatch-row" style={{ marginTop: 12 }}>
                  <div><div className="photo-swatch" style={{ background: sampledHex }} /><div className="photo-swatch-label">מה שצילמתם</div></div>
                  <span style={{ fontSize: 22 }}>➡️</span>
                  <div><div className="photo-swatch" style={{ background: content.targetColor }} /><div className="photo-swatch-label">מחפשים: {content.targetColorName}</div></div>
                </div>
              )}
              {phase === 'miss' && <p className="muted" style={{ margin: '8px 0 0' }}>אין קנס — פשוט נסו שוב! 📷</p>}
            </div>
          )}
          {phase === 'error' && !feedbackMsg && null}

          <div style={{ textAlign: 'center', marginTop: 10 }}>
            <button type="button" className="photo-skip" onClick={goPuzzle}>דלג על הצילום ← לפאזל</button>
          </div>
        </div>
      )}

      {step === 'puzzle' && (
        <div className="card pop-in">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <span className="chip chip-teal">🧩 מהלכים: {moves}</span>
            <button
              type="button"
              className={`btn ${showOriginal ? 'btn-green' : 'btn-mustard'}`}
              style={{ padding: '8px 14px', fontSize: 14.5 }}
              onPointerDown={() => setShowOriginal(true)}
              onPointerUp={() => setShowOriginal(false)}
              onPointerLeave={() => setShowOriginal(false)}
              onClick={() => setShowOriginal((v) => !v)}
            >👁 הצג מקור (לחיצה / החזקה)</button>
          </div>

          {showOriginal && (
            <div className="pop-in" style={{ marginBottom: 12 }}>
              <img className="photo-original" src={content.imageUrl} alt={content.caption} />
              <p className="muted" style={{ textAlign: 'center', margin: '6px 0 0' }}>ככה התמונה צריכה להיראות ✨</p>
            </div>
          )}

          {solvedPuzzle ? (
            <div style={{ textAlign: 'center', padding: '8px 0' }} className="pop-in">
              <img className="photo-original" src={content.imageUrl} alt={content.caption} />
              <div style={{ fontSize: 44, marginTop: 10 }}>🎉🧩🎉</div>
              <h3 className="section-title">הפאזל הושלם ב־{moves} מהלכים!</h3>
              <p style={{ fontWeight: 700 }}>{content.caption}</p>
            </div>
          ) : (
            <>
              <div className="photo-grid" role="group" aria-label="פאזל תמונה">
                {perm.map((tileIdx, pos) => (
                  <button
                    key={pos}
                    type="button"
                    aria-label={`חתיכה ${pos + 1}`}
                    className={`photo-tile ${selected === pos ? 'is-selected' : ''} ${tileIdx === pos ? 'is-correct-pos' : ''}`}
                    style={{
                      backgroundImage: `url("${content.imageUrl}")`,
                      backgroundSize: '300% 300%',
                      backgroundPosition: `${(tileIdx % 3) * 50}% ${Math.floor(tileIdx / 3) * 50}%`,
                    }}
                    onClick={() => tapTile(pos)}
                  />
                ))}
              </div>
              <p className="muted" style={{ textAlign: 'center', margin: '12px 0 0' }}>
                {selected === null ? 'הקישו על חתיכה, ואז על חתיכה אחרת כדי להחליף ביניהן 🔀' : 'עכשיו הקישו על החתיכה השנייה להחלפה ✨'}
              </p>
              <hr className="divider" />
              <p style={{ textAlign: 'center', fontWeight: 700, margin: 0 }}>🖼️ {content.caption}</p>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function Editor({ content, onChange }: StageEditorProps<PhotoPuzzleContent>) {
  const onUpload = (file: File | null) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const maxDim = 900;
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      URL.revokeObjectURL(url);
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      onChange({ ...content, imageUrl: dataUrl });
    };
    img.onerror = () => URL.revokeObjectURL(url);
    img.src = url;
  };

  return (
    <div>
      <TextField label="קישור לתמונה" value={content.imageUrl} onChange={(v) => onChange({ ...content, imageUrl: v })} />
      <div className="field">
        <label>העלאת תמונה מהמכשיר (תוקטן אוטומטית)</label>
        <label className="photo-file-btn" style={{ alignSelf: 'flex-start' }}>
          📤 בחרו תמונה להעלאה
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={(e) => { onUpload(e.target.files?.[0] ?? null); e.target.value = ''; }} />
        </label>
        {content.imageUrl ? <img src={content.imageUrl} alt="תצוגה מקדימה" style={{ width: '100%', borderRadius: 12, marginTop: 8, boxShadow: '0 6px 14px rgba(0,0,0,.2)' }} /> : null}
      </div>
      <TextField label="כיתוב לתמונה" value={content.caption} onChange={(v) => onChange({ ...content, caption: v })} />
      <div className="field">
        <label>צבע למשימת הצילום</label>
        <input type="color" className="photo-color-input" value={content.targetColor} onChange={(e) => onChange({ ...content, targetColor: e.target.value })} />
      </div>
      <TextField label="שם הצבע (למשל: כתום)" value={content.targetColorName} onChange={(v) => onChange({ ...content, targetColorName: v })} />
    </div>
  );
}
