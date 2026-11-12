import type React from 'react';
import type { StageType } from '../types';
import * as LifeOrder from './LifeOrder';
import * as MirrorText from './MirrorText';
import * as PhotoPuzzle from './PhotoPuzzle';
import * as TargetShooting from './TargetShooting';
import * as FamilyTree from './FamilyTree';
import * as EventsCalendar from './EventsCalendar';
import * as HobbiesRunner from './HobbiesRunner';
import * as FlashlightObjects from './FlashlightObjects';
import * as InspirationMessage from './InspirationMessage';
import * as CompassFacts from './CompassFacts';
import * as ValuesCard from './ValuesCard';

export interface StageMeta {
  title: string;
  emoji: string;
  tagline: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Player: React.FC<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Editor: React.FC<any>;
}

export const STAGE_META: Record<StageType, StageMeta> = {
  'life-order': { title: 'מה לפני מה', emoji: '🕰️', tagline: 'מסדרים את תחנות החיים לפי הסדר', Player: LifeOrder.Player, Editor: LifeOrder.Editor },
  'mirror-text': { title: 'תכונות במראה', emoji: '🪞', tagline: 'קוראים טקסט הפוך ומגלים תכונות', Player: MirrorText.Player, Editor: MirrorText.Editor },
  'photo-puzzle': { title: 'דמויות בחיים', emoji: '🧩', tagline: 'מרכיבים תמונה מחתיכות', Player: PhotoPuzzle.Player, Editor: PhotoPuzzle.Editor },
  'target-shooting': { title: 'שאיפות ומטרות', emoji: '🎯', tagline: 'פוגעים רק בשאיפות האמיתיות', Player: TargetShooting.Player, Editor: TargetShooting.Editor },
  'family-tree': { title: 'עץ משפחתי', emoji: '🌳', tagline: 'בונים את עץ המשפחה', Player: FamilyTree.Player, Editor: FamilyTree.Editor },
  'events-calendar': { title: 'אירועים משמעותיים', emoji: '📅', tagline: 'מזהים אירועים אמיתיים מהחיים', Player: EventsCalendar.Player, Editor: EventsCalendar.Editor },
  'hobbies-runner': { title: 'תחביבים בריצה', emoji: '🏃', tagline: 'אוספים תחביבים תוך כדי ריצה', Player: HobbiesRunner.Player, Editor: HobbiesRunner.Editor },
  'flashlight-objects': { title: 'חפצים בפנס', emoji: '🔦', tagline: 'מחפשים חפצים בחושך עם פנס', Player: FlashlightObjects.Player, Editor: FlashlightObjects.Editor },
  'inspiration-message': { title: 'משפט השראה', emoji: '💌', tagline: 'מקשיבים לסיפור ועונים על שאלה', Player: InspirationMessage.Player, Editor: InspirationMessage.Editor },
  'compass-facts': { title: 'מה לא יודעים עליי', emoji: '🧭', tagline: 'המצפן מגלה עובדות עם מספרים', Player: CompassFacts.Player, Editor: CompassFacts.Editor },
  'values-card': { title: 'ערכים שחשובים לי', emoji: '💎', tagline: 'מגלים את מילת הערך המסתתרת', Player: ValuesCard.Player, Editor: ValuesCard.Editor },
};
