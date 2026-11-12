import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, TouchEvent as ReactTouchEvent } from 'react';
import type { StagePlayerProps, StageEditorProps, FlashlightContent } from '../types';
import { PairsListField } from '../components/ui';
import { isWebGLAvailable } from '../lib/webgl';
import './flashlight-objects.css';

const LazyFlashlightRoom3D = lazy(() => import('../three/FlashlightRoom3D'));

const TORCH_UNSUPPORTED_MSG = 'הפנס האמיתי לא נתמך כאן — ממשיכים עם הפנס שעל המסך';

/** Deterministic spread positions (% of room), no overlaps. */
const POSITIONS = [
  { x: 13, y: 13 },
  { x: 44, y: 8 },
  { x: 76, y: 13 },
  { x: 90, y: 40 },
  { x: 60, y: 36 },
  { x: 26, y: 40 },
  { x: 12, y: 70 },
  { x: 42, y: 66 },
  { x: 72, y: 70 },
  { x: 90, y: 82 },
];

interface RoomObject { label: string; emoji: string; isCorrect: boolean; x: number; y: number }

interface TorchTrack {
  getCapabilities?: () => { torch?: boolean } | undefined;
  applyConstraints: (constraints: unknown) => Promise<void>;
  stop: () => void;
}

function Flashlight2D({ content, celebrantName, api }: StagePlayerProps<FlashlightContent>) {
  const objects = useMemo<RoomObject[]>(() => {
    const all = [
      ...content.correct.map((c) => ({ ...c, isCorrect: true })),
      ...content.decoys.map((d) => ({ ...d, isCorrect: false })),
    ];
    // deterministic interleave so the correct objects are not simply first
    const order = [3, 0, 5, 1, 7, 2, 6, 4, 9, 8];
    const arranged = order.filter((i) => i < all.length).map((i) => all[i]);
    all.forEach((o, i) => { if (!arranged.includes(o)) arranged.splice(i, 0, o); });
    return arranged.map((o, i) => ({ ...o, x: POSITIONS[i % POSITIONS.length].x, y: POSITIONS[i % POSITIONS.length].y }));
  }, [content]);

  const roomRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timersRef = useRef<number[]>([]);
  const finishedRef = useRef(false);

  const [beam, setBeam] = useState({ x: 200, y: 100 });
  const [found, setFound] = useState<Set<number>>(new Set());
  const [shakeIdx, setShakeIdx] = useState<number | null>(null);
  const [done, setDone] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchBusy, setTorchBusy] = useState(false);
  const [torchMsg, setTorchMsg] = useState<string | null>(null);

  const later = (fn: () => void, ms: number) => { timersRef.current.push(window.setTimeout(fn, ms)); };

  // beam rests at center-top before the first move
  useEffect(() => {
    const el = roomRef.current;
    if (el) setBeam({ x: el.clientWidth / 2, y: 96 });
  }, []);

  const stopTorch = () => {
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    streamRef.current = null;
    setTorchOn(false);
  };

  // cleanup: timers + torch stream on unmount
  useEffect(() => () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    streamRef.current = null;
  }, []);

  const updateBeam = (clientX: number, clientY: number) => {
    const el = roomRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setBeam({ x: clientX - rect.left, y: clientY - rect.top });
  };
  const onPointerMove = (e: ReactPointerEvent) => updateBeam(e.clientX, e.clientY);
  const onPointerDown = (e: ReactPointerEvent) => updateBeam(e.clientX, e.clientY);
  const onTouchMove = (e: ReactTouchEvent) => {
    const t = e.touches[0];
    if (t) updateBeam(t.clientX, t.clientY);
  };

  const finishOnce = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    api.finish();
  };

  const onObjectTap = (obj: RoomObject, idx: number) => {
    if (done || found.has(idx)) return;
    if (obj.isCorrect) {
      api.addPoints(30);
      api.feedback('good');
      const next = new Set(found);
      next.add(idx);
      setFound(next);
      const correctTotal = objects.filter((o) => o.isCorrect).length;
      const foundCorrect = objects.filter((o, i) => o.isCorrect && next.has(i)).length;
      if (foundCorrect >= correctTotal) {
        setDone(true);
        later(finishOnce, 900);
      }
    } else {
      api.addPoints(-20);
      api.feedback('bad');
      setShakeIdx(idx);
      later(() => setShakeIdx((s) => (s === idx ? null : s)), 520);
    }
  };

  const toggleTorch = async () => {
    if (torchOn) { stopTorch(); return; }
    if (torchBusy) return;
    setTorchBusy(true);
    try {
      if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
        setTorchMsg(TORCH_UNSUPPORTED_MSG);
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      const track = stream.getVideoTracks()[0] as unknown as TorchTrack | undefined;
      if (!track) {
        stream.getTracks().forEach((t) => t.stop());
        setTorchMsg(TORCH_UNSUPPORTED_MSG);
        return;
      }
      const caps = typeof track.getCapabilities === 'function' ? track.getCapabilities() : undefined;
      if (!caps || !caps.torch) {
        stream.getTracks().forEach((t) => t.stop());
        setTorchMsg(TORCH_UNSUPPORTED_MSG);
        return;
      }
      await track.applyConstraints({ advanced: [{ torch: true }] });
      streamRef.current = stream;
      setTorchOn(true);
      setTorchMsg(null);
    } catch {
      try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
      streamRef.current = null;
      setTorchMsg(TORCH_UNSUPPORTED_MSG);
    } finally {
      setTorchBusy(false);
    }
  };

  const foundObjects = objects.filter((_, i) => found.has(i));
  const correctTotal = objects.filter((o) => o.isCorrect).length;

  return (
    <div className="card pop-in">
      <div className="note" style={{ marginBottom: 14 }}>{content.instructions}</div>

      <div
        ref={roomRef}
        className="fl-room"
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onTouchMove={onTouchMove}
      >
        <div className="fl-floor" aria-hidden="true" />
        <span className="fl-silhouette" style={{ left: '6%', bottom: '12%', fontSize: 62 }} aria-hidden="true">🛋️</span>
        <span className="fl-silhouette" style={{ right: '5%', bottom: '14%', fontSize: 48 }} aria-hidden="true">🪴</span>
        <span className="fl-silhouette" style={{ left: '44%', top: '52%', fontSize: 40 }} aria-hidden="true">🪑</span>
        <span className="fl-silhouette" style={{ right: '26%', top: '6%', fontSize: 36 }} aria-hidden="true">🖼️</span>

        {objects.map((obj, i) => (
          <button
            type="button"
            key={`${obj.label}-${i}`}
            className={`fl-obj${shakeIdx === i ? ' shake bad-glow' : ''}`}
            style={{ left: `${obj.x}%`, top: `${obj.y}%` }}
            aria-label={obj.label}
            onClick={() => onObjectTap(obj, i)}
          >
            {obj.emoji}
          </button>
        ))}

        <div
          className="fl-dark"
          style={{ background: `radial-gradient(circle 130px at ${beam.x}px ${beam.y}px, transparent 0px, transparent 70px, rgba(4,2,1,0.97) 140px)` }}
          aria-hidden="true"
        />

        {objects.map((obj, i) => (found.has(i) ? (
          <div key={`found-${obj.label}-${i}`} className="fl-found pop-in" style={{ left: `${obj.x}%`, top: `${obj.y}%` }} aria-hidden="true">
            {obj.emoji}
            <span className="fl-found-check">✓</span>
          </div>
        ) : null))}
      </div>

      <div className="fl-basket">
        <span>🧺 בסל: {foundObjects.length} מתוך {correctTotal}</span>
        {foundObjects.map((o) => (
          <span key={o.label} className="chip chip-green pop-in">{o.emoji} {o.label}</span>
        ))}
        {foundObjects.length === 0 ? <span className="muted">החפצים של {celebrantName} עדיין מסתתרים בחושך…</span> : null}
      </div>

      <div className="fl-toolbar">
        <button type="button" className={`btn ${torchOn ? 'btn-coral' : 'btn-mustard'}`} disabled={torchBusy} onClick={() => { void toggleTorch(); }}>
          {torchOn ? 'כבה פנס אמיתי' : '🔦 פנס אמיתי'}
        </button>
        <span className="muted" style={{ alignSelf: 'center' }}>הזיזו אצבע או עכבר על החדר כדי להאיר 🔦</span>
      </div>
      {torchMsg ? <div className="fl-msg pop-in">{torchMsg}</div> : null}

      {done ? <div className="fl-success pop-in">🎉 מצאתם את כל החפצים של {celebrantName}!</div> : null}
    </div>
  );
}

export function Player(props: StagePlayerProps<FlashlightContent>) {
  if (isWebGLAvailable()) {
    return (
      <Suspense fallback={<div className="card pop-in" style={{ textAlign: 'center', fontWeight: 800 }}>טוען את החדר התלת־ממדי… 🔦</div>}>
        <LazyFlashlightRoom3D {...props} />
      </Suspense>
    );
  }
  return <Flashlight2D {...props} />;
}

export function Editor({ content, onChange }: StageEditorProps<FlashlightContent>) {
  return (
    <div>
      <PairsListField label="2 החפצים הנכונים" values={content.correct} onChange={(v) => onChange({ ...content, correct: v })} />
      <PairsListField label="חפצים מסיחים" values={content.decoys} onChange={(v) => onChange({ ...content, decoys: v })} />
    </div>
  );
}
