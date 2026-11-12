export function Clapper() {
  return <div className="clapper" aria-hidden="true" />;
}

export function ScreenTitle({ title, subtitle }: { emoji?: string; title: string; subtitle?: string }) {
  // v2: cinematic serif title with a gold-rule ornament instead of a giant emoji.
  // (The emoji prop is still accepted from all existing callers, intentionally unused.)
  return (
    <div className="screen-title">
      <div className="screen-title-ornament" aria-hidden="true"><span /></div>
      <h1 className="screen-title-text">{title}</h1>
      {subtitle ? <p className="screen-title-sub">{subtitle}</p> : null}
    </div>
  );
}

export function TextField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function TextAreaField({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      <textarea value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function NumberField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      <input type="number" value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

export function StringListField({ label, values, onChange, placeholder }: { label: string; values: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  return (
    <div className="field">
      <label>{label}</label>
      {values.map((v, i) => (
        <div className="list-row" key={i}>
          <input value={v} placeholder={placeholder} onChange={(e) => { const n = [...values]; n[i] = e.target.value; onChange(n); }} />
          <button type="button" className="icon-btn" aria-label="הסרה" onClick={() => onChange(values.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button type="button" className="btn btn-ghost" style={{ color: 'var(--wood-dark)', boxShadow: 'inset 0 0 0 2px var(--wood)' }} onClick={() => onChange([...values, ''])}>+ הוספה</button>
    </div>
  );
}

export function PairsListField({ label, values, onChange }: { label: string; values: { label: string; emoji: string }[]; onChange: (v: { label: string; emoji: string }[]) => void }) {
  return (
    <div className="field">
      <label>{label}</label>
      {values.map((v, i) => (
        <div className="list-row" key={i}>
          <input style={{ maxWidth: 64, flex: 'none' }} value={v.emoji} placeholder="😀" onChange={(e) => { const n = [...values]; n[i] = { ...n[i], emoji: e.target.value }; onChange(n); }} />
          <input value={v.label} placeholder="תווית" onChange={(e) => { const n = [...values]; n[i] = { ...n[i], label: e.target.value }; onChange(n); }} />
          <button type="button" className="icon-btn" aria-label="הסרה" onClick={() => onChange(values.filter((_, j) => j !== i))}>✕</button>
        </div>
      ))}
      <button type="button" className="btn btn-ghost" style={{ color: 'var(--wood-dark)', boxShadow: 'inset 0 0 0 2px var(--wood)' }} onClick={() => onChange([...values, { label: '', emoji: '⭐' }])}>+ הוספה</button>
    </div>
  );
}
