import type { RoomId, WorldConfig } from '../types';
import { ROOMS, roomLabel } from '../world/catalog';
import { STAGE_META } from '../stages/registry';
import type { StageType } from '../types';
import '../world/world-ui.css';

export interface HouseListSpot {
  stageIndex: number;
  type: StageType;
  done: boolean;
}

/**
 * The 2D fallback of the v5 house (used when WebGL is unavailable):
 * the same rooms, the same placed stages / pickups / final target —
 * presented as a room list. All game rules live in Player; this
 * component only renders and reports taps.
 */
export default function HouseList2D({
  world,
  spots,
  takenPickups,
  finalLockedReason,
  onStage,
  onPickup,
  onFinal,
}: {
  world: WorldConfig;
  spots: HouseListSpot[];
  takenPickups: string[];
  finalLockedReason: string | null;
  onStage: (stageIndex: number) => void;
  onPickup: (pickupId: string) => void;
  onFinal: () => void;
}) {
  const spotByKey = new Map<string, HouseListSpot>();
  for (const s of spots) {
    const p = world.placements[s.type];
    if (p) spotByKey.set(`${p.room}:${p.hotspot}`, s);
  }
  const pickupByKey = new Map<string, WorldConfig['pickups'][number]>();
  for (const pk of world.pickups) pickupByKey.set(`${pk.room}:${pk.hotspot}`, pk);
  const ft = world.finalTarget;
  const doneCount = spots.filter((s) => s.done).length;

  return (
    <div className="house2d" data-testid="house-2d">
      <div className="card house2d-goal">
        <strong>🎯 המטרה:</strong> {world.goal}
        <div className="muted" style={{ marginTop: 4 }}>שלבים שהושלמו: {doneCount} מתוך {spots.length} · הסתובבו בין החדרים ולחצו על החפצים המסומנים ✨</div>
      </div>
      {ROOMS.map((room) => {
        const entries: React.ReactNode[] = [];
        for (const hs of room.hotspots) {
          const key = `${room.id}:${hs.id}`;
          const spot = spotByKey.get(key);
          if (spot) {
            const meta = STAGE_META[spot.type];
            entries.push(
              <button
                key={key}
                type="button"
                className={`house2d-item${spot.done ? ' done' : ''}`}
                data-testid={`spot-${spot.type}`}
                disabled={spot.done}
                onClick={() => onStage(spot.stageIndex)}
              >
                <span className="house2d-item-emoji">{spot.done ? '✅' : meta.emoji}</span>
                <span style={{ flex: 1, textAlign: 'right' }}>
                  <strong>{hs.label}</strong>
                  <div className="muted">{spot.done ? 'השלב הושלם' : `שלב: ${meta.title}`}</div>
                </span>
                {!spot.done && <span>✨</span>}
              </button>,
            );
            continue;
          }
          const pk = pickupByKey.get(key);
          if (pk) {
            const taken = takenPickups.includes(pk.id);
            const item = world.items[pk.itemId];
            entries.push(
              <button
                key={key}
                type="button"
                className={`house2d-item${taken ? ' done' : ''}`}
                data-testid={`pickup-${pk.id}`}
                disabled={taken}
                onClick={() => onPickup(pk.id)}
              >
                <span className="house2d-item-emoji">{taken ? '✅' : '🔍'}</span>
                <span style={{ flex: 1, textAlign: 'right' }}>
                  <strong>{hs.label}</strong>
                  <div className="muted">{taken ? `נמצא: ${item?.label ?? ''}` : 'משהו מסתתר כאן… חפשו!'}</div>
                </span>
                {!taken && <span>✨</span>}
              </button>,
            );
            continue;
          }
          if (ft.room === room.id && ft.hotspot === hs.id) {
            entries.push(
              <button
                key={key}
                type="button"
                className={`house2d-item final${finalLockedReason ? '' : ' ready'}`}
                data-testid="final-target"
                onClick={onFinal}
              >
                <span className="house2d-item-emoji">{finalLockedReason ? '🔒' : '🎁'}</span>
                <span style={{ flex: 1, textAlign: 'right' }}>
                  <strong>{ft.label}</strong>
                  <div className="muted">{finalLockedReason ?? 'הכול מוכן — פתחו את היעד!'}</div>
                </span>
              </button>,
            );
          }
        }
        if (entries.length === 0) return null;
        return (
          <div className="card house2d-room" key={room.id}>
            <h3 className="section-title">{room.emoji} {roomLabel(room.id as RoomId)}</h3>
            <div className="house2d-items">{entries}</div>
          </div>
        );
      })}
    </div>
  );
}
