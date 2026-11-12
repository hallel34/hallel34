import { useEffect, useRef, useState } from 'react';
import type { GameConfig, InRoomPuzzle, RoomId, StageContent, StagePlacement, StageType, WorldConfig, WorldPickup } from '../types';
import { STAGE_ORDER_ALL } from '../types';
import { DEMO_CONFIG } from '../demo';
import { defaultWorld, encodeConfig, exportJSON, parseImported, saveConfig, stripHeavy } from '../store';
import { STAGE_META } from '../stages/registry';
import { Clapper, StringListField, TextAreaField, TextField } from './ui';
import { ROOMS } from '../world/catalog';
import { feedbackBuzz } from '../lib/device';
import '../world/world-ui.css';

const STEPS = ['פרטים', 'בחירת שלבים', 'מיקום בבית', 'תוכן', 'סיום ושיתוף'];

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <select className="world-select" value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => (<option key={o.value} value={o.value}>{o.label}</option>))}
      </select>
    </div>
  );
}

function clone<T>(v: T): T { return JSON.parse(JSON.stringify(v)) as T; }

export default function Creator({ initial, onSave, onPlay, onBack }: { initial: GameConfig; onSave: (c: GameConfig) => void; onPlay: (c: GameConfig) => void; onBack: () => void }) {
  const [draft, setDraft] = useState<GameConfig>(() => {
    const c = clone(initial);
    if (!c.world) c.world = defaultWorld(c.celebrantName, c.stageOrder);
    return c;
  });
  const [step, setStep] = useState(0);
  const [savedAt, setSavedAt] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState('');
  const [preview, setPreview] = useState<StageType | null>(null);
  const firstRender = useRef(true);

  const showToast = (msg: string) => { setToast(msg); window.setTimeout(() => setToast(null), 2600); };

  // AUTO-SAVE: debounce 600ms on any draft change
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return; }
    const id = window.setTimeout(() => { saveConfig(draft); setSavedAt(true); }, 600);
    return () => window.clearTimeout(id);
  }, [draft]);

  const selected = draft.stageOrder;
  const canProceedStages = selected.length === 5;

  const toggleStage = (t: StageType) => {
    setSavedAt(false);
    if (selected.includes(t)) setDraft({ ...draft, stageOrder: selected.filter((s) => s !== t) });
    else if (selected.length < 5) setDraft({ ...draft, stageOrder: [...selected, t] });
  };

  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= selected.length) return;
    const next = [...selected]; const tmp = next[i]; next[i] = next[j]; next[j] = tmp;
    setDraft({ ...draft, stageOrder: next });
  };

  const patchContent = (t: StageType, nextContent: StageContent) => {
    setDraft({ ...draft, contents: { ...draft.contents, [t]: nextContent } });
  };

  const world = draft.world as WorldConfig;
  const patchWorld = (next: Partial<WorldConfig>) => setDraft({ ...draft, world: { ...world, ...next } });
  const placementOf = (t: StageType): StagePlacement =>
    world.placements[t] ?? { room: 'living', hotspot: 'sofa', mode: 'overlay' };
  const patchPlacement = (t: StageType, next: Partial<StagePlacement>) => {
    const cur = placementOf(t);
    const merged = { ...cur, ...next };
    if (next.room && next.room !== cur.room) {
      merged.hotspot = ROOMS.find((r) => r.id === next.room)?.hotspots[0]?.id ?? merged.hotspot;
    }
    patchWorld({ placements: { ...world.placements, [t]: merged } });
  };
  const patchInRoom = (t: StageType, next: Partial<InRoomPuzzle>) => {
    const cur = placementOf(t);
    const base: InRoomPuzzle = cur.inRoom ?? { kind: 'riddle', prompt: '', options: ['', '', '', ''], correctIndex: 0, successText: '' };
    patchPlacement(t, { inRoom: { ...base, ...next } });
  };
  const itemOptions = [{ value: '', label: '— ללא פריט —' }, ...Object.entries(world.items).map(([id, it]) => ({ value: id, label: `${it.emoji} ${it.label}` }))];
  const roomOptions = ROOMS.map((r) => ({ value: r.id, label: `${r.emoji} ${r.label}` }));
  const hotspotOptions = (room: RoomId) => (ROOMS.find((r) => r.id === room)?.hotspots ?? []).map((h) => ({ value: h.id, label: `${h.emoji} ${h.label}` }));

  const copyLink = async () => {
    const link = `${window.location.origin}${window.location.pathname}#g=${encodeConfig(stripHeavy(draft))}`;
    try { await navigator.clipboard.writeText(link); setCopied(true); showToast('הקישור הועתק! 🔗'); window.setTimeout(() => setCopied(false), 2000); }
    catch { window.prompt('העתיקו את הקישור לשיתוף:', link); }
  };

  const downloadJSON = () => {
    const blob = new Blob([exportJSON(draft)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'escapeme-game.json'; a.click();
    URL.revokeObjectURL(url);
  };

  const applyImport = (text: string) => {
    const parsed = parseImported(text);
    if (parsed) { setDraft(parsed); setImportText(''); showToast('המשחק יובא בהצלחה ✓'); }
    else showToast('ייבוא נכשל — בדקו את ה־JSON');
  };

  return (
    <div className="screen-enter" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Clapper />
      <div className="stepper">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <strong style={{ fontSize: 19 }}>🎬 במאי · יצירת משחק</strong>
          <span className="autosave-status">{savedAt ? 'נשמר אוטומטית ✓' : ''}</span>
        </div>
        <div style={{ height: 8 }} />
        <div className="stepper-steps">
          {STEPS.map((s, i) => (
            <div key={s} className={`stepper-step${i === step ? ' active' : ''}${i < step ? ' done' : ''}`}>{i + 1} · {s}</div>
          ))}
        </div>
        <div className="stepper-bar"><div className="stepper-fill" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>
      </div>

      {step === 0 && (
        <div className="card">
          <h2 className="section-title">1 · פרטים</h2>
          <TextField label="שם כלת בת המצווה" value={draft.celebrantName} onChange={(v) => setDraft({ ...draft, celebrantName: v })} placeholder="למשל: ערבה" />
          <label className="toggle-row">
            <span>הצגת התשובה הנכונה בסוף כל שלב</span>
            <span className="switch"><input type="checkbox" checked={draft.showAnswers} onChange={(e) => setDraft({ ...draft, showAnswers: e.target.checked })} /><span /></span>
          </label>
          <p className="muted">💡 טיפ: שם + בחירת 5 שלבים — ואתם במשחק תוך שתי דקות. את התוכן אפשר לערוך אחר כך, הוא כבר מלא בדוגמה.</p>
        </div>
      )}

      {step === 1 && (
        <>
          <div className="card">
            <h2 className="section-title">2 · בחירת שלבים</h2>
            <p style={{ fontWeight: 700 }}>נבחרו {selected.length} מתוך 5{canProceedStages ? ' · כל השלבים הנבחרים עם תוכן מוכן ✓' : ''}</p>
            <p className="muted">לחיצה מוסיפה שלב (לפי סדר הלחיצה), לחיצה על שלב נבחר מסירה אותו.</p>
            <div style={{ height: 8 }} />
            <div className="stage-picker-grid">
              {STAGE_ORDER_ALL.map((t) => {
                const m = STAGE_META[t]; const idx = selected.indexOf(t); const isSel = idx >= 0;
                const blocked = !isSel && selected.length >= 5;
                return (
                  <button type="button" key={t} className={`gallery-card${isSel ? ' selected' : ''}`} style={blocked ? { opacity: .45 } : undefined} onClick={() => toggleStage(t)}>
                    <div className={`gallery-art art-${t}`}><span className="gallery-art-letter">{m.title.charAt(0)}</span></div>
                    <div className="gallery-body">
                      <div className="stage-picker-title">{m.title}</div>
                      <div className="stage-picker-tagline">{m.tagline}</div>
                    </div>
                    {isSel ? <span className="stage-picker-badge">{idx + 1}</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
          {selected.length > 0 && (
            <div className="card">
              <h3 className="section-title">סדר השלבים במשחק</h3>
              <div className="selected-list">
                {selected.map((t, i) => (
                  <div className="selected-row" key={t}>
                    <span className="chip chip-teal">{i + 1}</span><span>{STAGE_META[t].emoji}</span>
                    <span style={{ flex: 1 }}>{STAGE_META[t].title}</span>
                    <button type="button" className="icon-btn" aria-label="למעלה" onClick={() => move(i, -1)}>↑</button>
                    <button type="button" className="icon-btn" aria-label="למטה" onClick={() => move(i, 1)}>↓</button>
                    <button type="button" className="icon-btn" aria-label="הסרה" onClick={() => toggleStage(t)}>✕</button>
                  </div>
                ))}
              </div>
              {!canProceedStages ? <p className="muted">יש לבחור בדיוק 5 שלבים כדי להמשיך (נבחרו {selected.length}).</p> : null}
            </div>
          )}
        </>
      )}

      {step === 2 && (
        <>
          <div className="card">
            <h2 className="section-title">3 · הבית והמטרה 🏠</h2>
            <TextAreaField label="🎯 מטרת המשחק (מה השחקנים צריכים להשיג?)" value={world.goal} onChange={(v) => patchWorld({ goal: v })} placeholder="למשל: המתנה נעולה בכספת — מצאו את המפתח ואת הקוד!" />
            <p className="muted">השחקנים מסתובבים בבית תלת־ממדי. כל שלב יושב על חפץ בחדר — בחרו איפה, ואיך פותרים אותו: מיני־משחק שנפתח מהחפץ, או חידה שפותרים בתוך החדר עצמו.</p>
          </div>

          <div className="card">
            <h3 className="section-title">מיקום השלבים בבית</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {selected.map((t) => {
                const m = STAGE_META[t];
                const p = placementOf(t);
                const ir = p.inRoom;
                return (
                  <div key={t} style={{ borderTop: '2px dashed var(--wood)', paddingTop: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <strong style={{ flex: 1 }}>{m.emoji} {m.title}</strong>
                      <button type="button" className={`btn ${p.mode === 'overlay' ? 'btn-teal' : 'btn-ghost'}`} onClick={() => patchPlacement(t, { mode: 'overlay' })}>🎮 מיני־משחק</button>
                      <button type="button" className={`btn ${p.mode === 'inroom' ? 'btn-teal' : 'btn-ghost'}`} onClick={() => patchPlacement(t, { mode: 'inroom' })}>🔍 חידה בחדר</button>
                    </div>
                    <div className="world-row">
                      <SelectField label="חדר" value={p.room} options={roomOptions} onChange={(v) => patchPlacement(t, { room: v as RoomId })} />
                      <SelectField label="חפץ" value={p.hotspot} options={hotspotOptions(p.room)} onChange={(v) => patchPlacement(t, { hotspot: v })} />
                      <SelectField label="פריט שמקבלים בסיום השלב" value={p.givesItem ?? ''} options={itemOptions} onChange={(v) => patchPlacement(t, { givesItem: v || undefined })} />
                    </div>
                    {p.mode === 'inroom' && (
                      <div style={{ marginTop: 6 }}>
                        <SelectField
                          label="סוג החידה בחדר"
                          value={ir?.kind ?? 'riddle'}
                          options={[
                            { value: 'riddle', label: '❓ חידת שאלה (בחירה מתוך 4)' },
                            { value: 'code', label: '🔢 מנעול קוד (הקוד נמצא על פתק בבית)' },
                            { value: 'search', label: '🔍 חיפוש (מוצאים מה שמסתתר)' },
                          ]}
                          onChange={(v) => patchInRoom(t, { kind: v as InRoomPuzzle['kind'] })}
                        />
                        <TextAreaField label="טקסט החידה שמופיע ליד החפץ" value={ir?.prompt ?? ''} onChange={(v) => patchInRoom(t, { prompt: v })} />
                        {ir?.kind === 'code' && (
                          <TextField label="הקוד (3–5 ספרות)" value={ir?.code ?? ''} onChange={(v) => patchInRoom(t, { code: v.replace(/\D/g, '').slice(0, 5) })} />
                        )}
                        {ir?.kind === 'riddle' && (
                          <>
                            {(ir?.options ?? ['', '', '', '']).map((opt, oi) => (
                              <TextField key={oi} label={`אפשרות ${oi + 1}${oi === (ir?.correctIndex ?? 0) ? ' ✓ (הנכונה)' : ''}`} value={opt} onChange={(v) => { const options = [...(ir?.options ?? ['', '', '', ''])]; options[oi] = v; patchInRoom(t, { options }); }} />
                            ))}
                            <SelectField label="התשובה הנכונה" value={String(ir?.correctIndex ?? 0)} options={[0, 1, 2, 3].map((i) => ({ value: String(i), label: `אפשרות ${i + 1}` }))} onChange={(v) => patchInRoom(t, { correctIndex: Number(v) })} />
                          </>
                        )}
                        <TextField label="טקסט הצלחה" value={ir?.successText ?? ''} onChange={(v) => patchInRoom(t, { successText: v })} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="card">
            <h3 className="section-title">🧺 פריטים נסתרים בבית (לא חובה)</h3>
            <p className="muted">חפץ שאפשר לחפש בו ולמצוא פריט — למשל פתק עם קוד על המקרר. עד 3 פריטים.</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {world.pickups.map((pk, i) => (
                <div key={pk.id} style={{ borderTop: '2px dashed var(--wood)', paddingTop: 10 }}>
                  <div className="world-row">
                    <SelectField label="חדר" value={pk.room} options={roomOptions} onChange={(v) => { const room = v as RoomId; const list = [...world.pickups]; list[i] = { ...pk, room, hotspot: ROOMS.find((r) => r.id === room)?.hotspots[0]?.id ?? pk.hotspot }; patchWorld({ pickups: list }); }} />
                    <SelectField label="חפץ" value={pk.hotspot} options={hotspotOptions(pk.room)} onChange={(v) => { const list = [...world.pickups]; list[i] = { ...pk, hotspot: v }; patchWorld({ pickups: list }); }} />
                    <SelectField label="הפריט שמוצאים" value={pk.itemId} options={itemOptions.filter((o) => o.value !== '')} onChange={(v) => { const list = [...world.pickups]; list[i] = { ...pk, itemId: v }; patchWorld({ pickups: list }); }} />
                  </div>
                  <TextField label="טקסט שמוצג כשמוצאים" value={pk.foundText} onChange={(v) => { const list = [...world.pickups]; list[i] = { ...pk, foundText: v }; patchWorld({ pickups: list }); }} />
                  <button type="button" className="btn btn-ghost" onClick={() => patchWorld({ pickups: world.pickups.filter((_, j) => j !== i) })}>✕ הסרת הפריט</button>
                </div>
              ))}
              {world.pickups.length < 3 && (
                <button type="button" className="btn btn-teal" onClick={() => {
                  const np: WorldPickup = { id: `pickup-${Date.now()}`, room: 'kitchen', hotspot: 'fridge', itemId: 'code-note', foundText: '' };
                  patchWorld({ pickups: [...world.pickups, np] });
                }}>+ הוספת פריט נסתר</button>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="section-title">🔐 היעד הסופי</h3>
            <div className="world-row">
              <SelectField label="חדר" value={world.finalTarget.room} options={roomOptions} onChange={(v) => { const room = v as RoomId; patchWorld({ finalTarget: { ...world.finalTarget, room, hotspot: ROOMS.find((r) => r.id === room)?.hotspots[0]?.id ?? world.finalTarget.hotspot } }); }} />
              <SelectField label="חפץ" value={world.finalTarget.hotspot} options={hotspotOptions(world.finalTarget.room)} onChange={(v) => patchWorld({ finalTarget: { ...world.finalTarget, hotspot: v } })} />
              <SelectField label="פריט נדרש לפתיחה" value={world.finalTarget.requiresItem ?? ''} options={itemOptions} onChange={(v) => patchWorld({ finalTarget: { ...world.finalTarget, requiresItem: v || undefined } })} />
            </div>
            <TextField label="שם היעד" value={world.finalTarget.label} onChange={(v) => patchWorld({ finalTarget: { ...world.finalTarget, label: v } })} />
            <label className="toggle-row">
              <span>נפתח רק אחרי שכל 5 השלבים הושלמו</span>
              <span className="switch"><input type="checkbox" checked={world.finalTarget.requiresAllStages} onChange={(e) => patchWorld({ finalTarget: { ...world.finalTarget, requiresAllStages: e.target.checked } })} /><span /></span>
            </label>
          </div>
        </>
      )}

      {step === 3 && (
        <>
          <div className="note">⚡ התוכן לדוגמה כבר מלא — אפשר לדלג ישר למשחק! שלב זה הוא רק למי שרוצה לערוך טקסטים.</div>
          {selected.map((t) => {
            const m = STAGE_META[t];
            const content = draft.contents[t] as StageContent & { instructions: string; hints: string[]; answerText: string };
            const Editor = m.Editor;
            return (
              <div className="card" key={t}>
                <h3 className="section-title">{m.emoji} {m.title}</h3>
                <Editor content={content} onChange={(next: StageContent) => patchContent(t, next)} />
                <hr className="divider" />
                <TextAreaField label="הוראות לשחקנים" value={content.instructions} onChange={(v) => patchContent(t, { ...content, instructions: v })} />
                <StringListField label="רמזים (עד 2)" values={content.hints} onChange={(v) => patchContent(t, { ...content, hints: v.slice(0, 2) })} placeholder="כתבו רמז…" />
                <TextField label="תשובה / עובדה לסוף השלב (answerText)" value={content.answerText} onChange={(v) => patchContent(t, { ...content, answerText: v })} />
                <button type="button" className="btn btn-plum" onClick={() => setPreview(t)}>👁 תצוגה מקדימה</button>
              </div>
            );
          })}
        </>
      )}

      {step === 4 && (
        <div className="console">
          <h2 className="section-title" style={{ color: 'inherit' }}>5 · סיום ושיתוף</h2>
          <p>המשחק של <strong>{draft.celebrantName}</strong> · {selected.length} שלבים · {draft.showAnswers ? 'עם הצגת תשובות' : 'בלי הצגת תשובות'}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button type="button" className="btn btn-coral btn-big" disabled={!canProceedStages} onClick={() => onPlay(draft)}>▶ שחק עכשיו</button>
            <button type="button" className="btn btn-teal" onClick={() => { onSave(draft); showToast('נשמר ✓'); }}>💾 שמירה</button>
            <button type="button" className="btn btn-mustard" onClick={() => { void copyLink(); }}>{copied ? 'הועתק! ✓' : '🔗 העתקת קישור לשיתוף'}</button>
            <button type="button" className="btn btn-green" onClick={downloadJSON}>⬇ ייצוא JSON</button>
            <button type="button" className="btn btn-ghost" onClick={() => setImportOpen(!importOpen)}>⬆ ייבוא JSON {importOpen ? '▲' : '▼'}</button>
            {importOpen && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label className="btn btn-ghost" style={{ cursor: 'pointer' }}>
                  בחירת קובץ JSON
                  <input type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={(e) => { const f = e.target.files?.[0]; if (f) void f.text().then(applyImport); }} />
                </label>
                <div className="field" style={{ marginBottom: 0 }}>
                  <textarea value={importText} placeholder="או הדביקו כאן JSON…" onChange={(e) => setImportText(e.target.value)} />
                </div>
                <button type="button" className="btn btn-teal" onClick={() => applyImport(importText)}>ייבוא מהטקסט</button>
              </div>
            )}
            <button type="button" className="btn btn-ghost" onClick={() => { setDraft(clone(DEMO_CONFIG)); showToast('אופס לדוגמה'); }}>↩ איפוס לדוגמה</button>
            {!canProceedStages ? <p style={{ margin: 0 }}>יש לבחור בדיוק 5 שלבים בשלב 2 כדי לשחק (נבחרו {selected.length}).</p> : null}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" className="btn btn-ghost" style={{ flex: 1 }} onClick={() => (step === 0 ? onBack() : setStep(step - 1))}>{step === 0 ? '🏠 חזרה הביתה' : '← הקודם'}</button>
        {step < 4 && (
          <button type="button" className="btn btn-teal" style={{ flex: 2 }} disabled={step === 1 && !canProceedStages} onClick={() => setStep(step + 1)}>
            {step === 3 ? 'דלגו / המשיכו לסיום →' : 'הבא →'}
          </button>
        )}
      </div>
      {step === 1 && !canProceedStages ? <p style={{ color: '#FFD97A', fontWeight: 700, textAlign: 'center', margin: 0 }}>בחרו עוד {5 - selected.length} שלבים כדי להמשיך</p> : null}

      {preview && (() => {
        const PreviewPlayer = STAGE_META[preview].Player;
        return (
          <div className="modal-overlay" role="dialog" aria-modal="true">
            <div className="modal-frame pop-in">
              <Clapper />
              <div className="modal-frame-body">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <strong>👁 תצוגה מקדימה · {STAGE_META[preview].title}</strong>
                  <button type="button" className="icon-btn" aria-label="סגירה" onClick={() => setPreview(null)}>✕</button>
                </div>
                <PreviewPlayer
                  content={draft.contents[preview]}
                  celebrantName={draft.celebrantName}
                  api={{ addPoints: () => undefined, finish: () => { setPreview(null); showToast('התצוגה הסתיימה'); }, feedback: (kind: 'good' | 'bad') => feedbackBuzz(kind) }}
                />
              </div>
            </div>
          </div>
        );
      })()}

      {toast ? <div className="toast pop-in">{toast}</div> : null}
    </div>
  );
}
