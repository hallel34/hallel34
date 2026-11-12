export type StageType = 'life-order'|'mirror-text'|'photo-puzzle'|'target-shooting'|'family-tree'|'events-calendar'|'hobbies-runner'|'flashlight-objects'|'inspiration-message'|'compass-facts'|'values-card';

export interface CommonContent { instructions: string; hints: string[]; answerText: string; }

export interface LifeOrderContent extends CommonContent { stations: {label:string; emoji:string}[] }
export interface MirrorTextContent extends CommonContent { sourceTitle: string; cardText: string; question: string; keywords: string[] }
export interface PhotoPuzzleContent extends CommonContent { imageUrl: string; caption: string; targetColor: string; targetColorName: string }
export interface TargetShootingContent extends CommonContent { question: string; correct: string[]; wrong: string[] }
export interface FamilyTreeContent extends CommonContent { slots: {id:string; role:string; name:string; gen:0|1|2}[]; decoys: string[] }
export interface EventsCalendarContent extends CommonContent { trueEvents: string[]; decoyEvents: string[] }
export interface HobbiesRunnerContent extends CommonContent { correct: {label:string; emoji:string}[]; wrong: {label:string; emoji:string}[] }
export interface FlashlightContent extends CommonContent { correct: {label:string; emoji:string}[]; decoys: {label:string; emoji:string}[] }
export interface InspirationContent extends CommonContent { storyText: string; question: string; options: string[]; correctIndex: number; speakerName: string; audioDataUrl?: string }
export interface CompassContent extends CommonContent { facts: {text:string; number:number; isTrue:boolean; bearing:number}[] }
export interface ValuesCardContent extends CommonContent { storyText: string; answerWord: string; cards: {statement:string; isCorrect:boolean}[] }

export type StageContent =
  | LifeOrderContent
  | MirrorTextContent
  | PhotoPuzzleContent
  | TargetShootingContent
  | FamilyTreeContent
  | EventsCalendarContent
  | HobbiesRunnerContent
  | FlashlightContent
  | InspirationContent
  | CompassContent
  | ValuesCardContent;

/* ------------------------------------------------------------------ */
/* v5 — the house world (Gordy structure): one wanderable home, one     */
/* overarching goal, stages placed on rooms/objects, an inventory,     */
/* and a final target that stays locked until its conditions are met.  */
/* ------------------------------------------------------------------ */

export type RoomId = 'entrance' | 'living' | 'kitchen' | 'hallway' | 'bedroom1' | 'bedroom2' | 'bathroom';

export interface InRoomPuzzle {
  kind: 'code' | 'riddle' | 'search';
  /** Text shown at the object when the player interacts with it. */
  prompt: string;
  /** kind='code': the correct digit string (3–5 digits). */
  code?: string;
  /** kind='riddle': answer options. */
  options?: string[];
  /** kind='riddle': index of the correct option. */
  correctIndex?: number;
  /** Feedback shown on success, right before the stage completes. */
  successText: string;
}

export interface StagePlacement {
  room: RoomId;
  /** Hotspot id from the room's catalog (see world/catalog.ts). */
  hotspot: string;
  /** 'overlay' opens the classic mini-game; 'inroom' is solved at the object itself. */
  mode: 'overlay' | 'inroom';
  inRoom?: InRoomPuzzle;
  /** Item granted to the inventory when this stage is completed. */
  givesItem?: string;
}

export interface WorldPickup {
  id: string;
  room: RoomId;
  hotspot: string;
  /** Item granted when the player searches this object. */
  itemId: string;
  /** Story text revealed when the item is found. */
  foundText: string;
}

export interface WorldFinalTarget {
  room: RoomId;
  hotspot: string;
  label: string;
  /** Item that must be in the inventory to open it (optional). */
  requiresItem?: string;
  /** When true, all 5 stages must also be complete. */
  requiresAllStages: boolean;
}

export interface WorldConfig {
  /** The one overarching goal of the game, written by the במאי. */
  goal: string;
  placements: Partial<Record<StageType, StagePlacement>>;
  pickups: WorldPickup[];
  items: Record<string, { label: string; emoji: string }>;
  finalTarget: WorldFinalTarget;
}

export interface GameConfig { celebrantName: string; showAnswers: boolean; stageOrder: StageType[]; contents: Record<StageType, StageContent>; world?: WorldConfig; }

export interface StageApi { addPoints(n:number): void; finish(): void; feedback(kind: 'good' | 'bad'): void; }

export interface StagePlayerProps<C> { content: C; celebrantName: string; api: StageApi; }

export interface StageEditorProps<C> { content: C; onChange(next: C): void; }

export interface StageResult { type: StageType; score: number; seconds: number; hintsUsed: number; }

export const PAR_SECONDS: Record<StageType, number> = {
  'life-order': 60,
  'mirror-text': 90,
  'photo-puzzle': 90,
  'target-shooting': 35,
  'family-tree': 90,
  'events-calendar': 60,
  'hobbies-runner': 35,
  'flashlight-objects': 90,
  'inspiration-message': 90,
  'compass-facts': 90,
  'values-card': 90,
};

export const STAGE_ORDER_ALL: StageType[] = [
  'life-order',
  'mirror-text',
  'photo-puzzle',
  'target-shooting',
  'family-tree',
  'events-calendar',
  'hobbies-runner',
  'flashlight-objects',
  'inspiration-message',
  'compass-facts',
  'values-card',
];
