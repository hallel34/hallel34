import type { GameConfig } from '../types';
import './home.css';

/**
 * v2 home — stepping up to the studio door.
 * A full-bleed photoreal scene (generated studio interior, warm lamplight, the
 * door ajar) with the title on a lit brass marquee and two tactile plaques.
 * No flat gradient, no emoji hero — the place itself is the invitation.
 */
export default function Home({ config, isDemo, onCreate, onPlay }: { config: GameConfig; isDemo: boolean; onCreate: () => void; onPlay: () => void }) {
  return (
    <div className="home-scene screen-enter">
      <div className="home-photo" aria-hidden="true" />
      <div className="home-shade" aria-hidden="true" />
      <div className="home-content">
        <header className="home-marquee">
          <div className="home-bulbs" aria-hidden="true" />
          <p className="home-kicker">תיבת בריחה דיגיטלית לבת מצווה</p>
          <h1 className="home-title">EscapeMe</h1>
          <p className="home-line">
            הדלת כבר חורקת ונפתחת…
            <br />
            החדר של {config.celebrantName} מחכה לכם בפנים.
          </p>
          <div className="home-bulbs" aria-hidden="true" />
        </header>

        <div className="home-actions">
          {isDemo ? <span className="home-chip">משחק דוגמה</span> : null}
          <button type="button" className="btn-plaque btn-plaque-brass" onClick={onCreate}>
            <span className="btn-plaque-label">במאי · יצירת משחק</span>
            <span className="btn-plaque-sub">בונים את חדר הבריחה שלכם — תוך דקות</span>
          </button>
          <button type="button" className="btn-plaque btn-plaque-wood" onClick={onPlay}>
            <span className="btn-plaque-label">▶ לשחק</span>
            <span className="btn-plaque-sub">המשחק של {config.celebrantName} · {config.stageOrder.length} שלבים</span>
          </button>
          <p className="home-foot">נוצר באהבה לחגיגת בת המצווה · EscapeMe</p>
        </div>
      </div>
    </div>
  );
}
