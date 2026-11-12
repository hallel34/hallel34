import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import type { RoomId, StageType } from '../types';
import { ROOM_MAP, hotspotDef } from '../world/catalog';
import {
  disposeObject, makeBadgeTexture, makeEmojiTexture, makeGlowTexture,
  makePhotoTexture, makeSparkleTexture, PHOTO,
} from './canvasTextures';
import { buildHouseDecor } from './houseDecor';
import './house3d.css';

import kitchenTileUrl from '../assets/tex-kitchen-tile.jpg';
import bathroomTileUrl from '../assets/tex-bathroom-tile.jpg';
/* v6 PBR texture sets (Poly Haven CC0, downscaled to 512) */
import phMarbleDiffUrl from '../assets/ph-marble-diff.jpg';
import phMarbleNorUrl from '../assets/ph-marble-nor.jpg';
import phMarbleRoughUrl from '../assets/ph-marble-rough.jpg';
import phTilesDiffUrl from '../assets/ph-tiles-diff.jpg';
import phTilesNorUrl from '../assets/ph-tiles-nor.jpg';
import phSubwayDiffUrl from '../assets/ph-subway-diff.jpg';
import phSubwayNorUrl from '../assets/ph-subway-nor.jpg';

import tvUrl from '../assets/models/tv.glb?url';
import tvStandUrl from '../assets/models/tv-stand.glb?url';
import bookshelfUrl from '../assets/models/bookshelf.glb?url';
import bookshelfLowUrl from '../assets/models/bookshelf-low.glb?url';
import plantUrl from '../assets/models/plant.glb?url';
import plantSmallUrl from '../assets/models/plant-small.glb?url';
import floorLampUrl from '../assets/models/floor-lamp.glb?url';
import ceilingLampUrl from '../assets/models/ceiling-lamp.glb?url';
import kitchenCabinetUrl from '../assets/models/kitchen-cabinet.glb?url';
import kitchenCabinetDrawerUrl from '../assets/models/kitchen-cabinet-drawer.glb?url';
import kitchenCabinetUpperUrl from '../assets/models/kitchen-cabinet-upper.glb?url';
import kitchenSinkUrl from '../assets/models/kitchen-sink.glb?url';
import stoveUrl from '../assets/models/stove.glb?url';
import rangeHoodUrl from '../assets/models/range-hood.glb?url';
import fridgeUrl from '../assets/models/fridge.glb?url';
import microwaveUrl from '../assets/models/microwave.glb?url';
import wardrobeUrl from '../assets/models/wardrobe.glb?url';
import diningTableUrl from '../assets/models/dining-table.glb?url';
import coatRackUrl from '../assets/models/coat-rack.glb?url';
import sideTableUrl from '../assets/models/side-table.glb?url';
import rugRoundUrl from '../assets/models/rug-round.glb?url';
import wallLampUrl from '../assets/models/wall-lamp.glb?url';
import deskUrl from '../assets/models/desk.glb?url';
import chairDeskUrl from '../assets/models/chair-desk.glb?url';
import computerScreenUrl from '../assets/models/computer-screen.glb?url';
import bedBunkUrl from '../assets/models/bed-bunk.glb?url';
import bedDoubleUrl from '../assets/models/bed-double.glb?url';
import tableLampUrl from '../assets/models/table-lamp.glb?url';
/* v6 hero models (Poly Haven CC0, textures resized to 512 via gltf-transform) */
import phSofaUrl from '../assets/models/ph-sofa.glb?url';
import phArmchairUrl from '../assets/models/ph-armchair.glb?url';
import phCoffeeTableUrl from '../assets/models/ph-coffee-table.glb?url';
import phCeilingLampUrl from '../assets/models/ph-ceiling-lamp.glb?url';
import phKettleUrl from '../assets/models/ph-kettle.glb?url';
import phDiningChairUrl from '../assets/models/ph-dining-chair.glb?url';
import phNightstandUrl from '../assets/models/ph-nightstand.glb?url';
import phVaseUrl from '../assets/models/ph-vase.glb?url';
/* v7 realism pass: more Poly Haven CC0 models (512px WebP textures) */
import phPlantTallUrl from '../assets/models/ph-plant-tall.glb?url';
import phPlantBigUrl from '../assets/models/ph-plant-big.glb?url';
import phPlantSmallUrl from '../assets/models/ph-plant-small.glb?url';
import phCabinetUrl from '../assets/models/ph-cabinet.glb?url';
import phFrameAUrl from '../assets/models/ph-frame-a.glb?url';
import phFrameBUrl from '../assets/models/ph-frame-b.glb?url';
import phFrameCUrl from '../assets/models/ph-frame-c.glb?url';
import phClockUrl from '../assets/models/ph-clock.glb?url';
import phPillowsUrl from '../assets/models/ph-pillows.glb?url';
import phDeskUrl from '../assets/models/ph-desk.glb?url';
import phDrawerUrl from '../assets/models/ph-drawer.glb?url';
import phSideTableUrl from '../assets/models/ph-side-table.glb?url';
import phShelvesUrl from '../assets/models/ph-shelves.glb?url';
import phStandFrameUrl from '../assets/models/ph-stand-frame.glb?url';
import phMirrorUrl from '../assets/models/ph-mirror.glb?url';
import phDeskLampUrl from '../assets/models/ph-desk-lamp.glb?url';
import dresserUrl from '../assets/models/dresser.glb?url';
import bathtubUrl from '../assets/models/bathtub.glb?url';
import bathroomSinkUrl from '../assets/models/bathroom-sink.glb?url';
import bathroomMirrorUrl from '../assets/models/bathroom-mirror.glb?url';
import bathroomCabinetUrl from '../assets/models/bathroom-cabinet.glb?url';
import toiletUrl from '../assets/models/toilet.glb?url';
import washingMachineUrl from '../assets/models/washing-machine.glb?url';
import doorUrl from '../assets/models/door.glb?url';

/* ------------------------------------------------------------------ */
/* Props contract (consumed by Player.tsx — do not change)             */
/* ------------------------------------------------------------------ */
interface House3DProps {
  celebrantName: string;
  goal: string;
  spots: { stageIndex: number; type: StageType; title: string; emoji: string; room: RoomId; hotspot: string; mode: 'overlay' | 'inroom'; done: boolean }[];
  pickups: { id: string; room: RoomId; hotspot: string; itemLabel: string; collected: boolean }[];
  finalTarget: { room: RoomId; hotspot: string; label: string };
  finalLockedReason: string | null;
  onStage: (stageIndex: number) => void;
  onPickup: (pickupId: string) => void;
  onFinal: () => void;
  /** optional: inventory chips rendered inside the HUD (full-screen mode) */
  inventory?: { id: string; label: string; emoji: string }[];
  /** optional: exit button inside the HUD */
  onExit?: () => void;
}

type SpotProp = House3DProps['spots'][number];
type PickupProp = House3DProps['pickups'][number];

const ACCENTS: Record<StageType, number> = {
  'life-order': 0xf2a007,
  'mirror-text': 0x9b6bc4,
  'photo-puzzle': 0x1f8a8c,
  'target-shooting': 0xe4572e,
  'family-tree': 0x5b8c5a,
  'events-calendar': 0xd9a441,
  'hobbies-runner': 0x7fb069,
  'flashlight-objects': 0x8a5fc0,
  'inspiration-message': 0xe86a92,
  'compass-facts': 0x2a9d8f,
  'values-card': 0xc77dbb,
};

/* ------------------------------------------------------------------ */
/* House geometry (meters; X east, Z south, Y up)                      */
/* ------------------------------------------------------------------ */
interface Rect { x0: number; x1: number; z0: number; z1: number }
const ROOM_RECTS: Record<RoomId, Rect> = {
  living: { x0: -6.5, x1: -1.2, z0: -5.0, z1: 0.8 },
  kitchen: { x0: -1.2, x1: 6.5, z0: -5.0, z1: -0.8 },
  entrance: { x0: 3.4, x1: 6.5, z0: -0.8, z1: 2.0 },
  hallway: { x0: -1.2, x1: 3.4, z0: -0.8, z1: 0.8 },
  bedroom1: { x0: -6.5, x1: -1.2, z0: 0.8, z1: 5.0 },
  bedroom2: { x0: -1.2, x1: 3.4, z0: 0.8, z1: 5.0 },
  bathroom: { x0: 3.4, x1: 6.5, z0: 2.0, z1: 5.0 },
};
const ROOM_CENTERS: Record<RoomId, [number, number]> = {
  living: [-3.85, -2.1], kitchen: [2.65, -2.9], entrance: [4.95, 0.6],
  hallway: [1.1, 0], bedroom1: [-3.85, 2.9], bedroom2: [1.1, 2.9], bathroom: [4.95, 3.5],
};
/** Where teleport() looks after arriving in a room. */
const ROOM_FOCAL: Record<RoomId, [number, number]> = {
  living: [-4.2, -4.7], kitchen: [1.85, -4.5], entrance: [6.4, 0.6],
  hallway: [1.2, -0.7], bedroom1: [-2.6, 1.3], bedroom2: [1.9, 4.6], bathroom: [4.3, 2.5],
};

function roomAt(x: number, z: number): RoomId {
  for (const id of Object.keys(ROOM_RECTS) as RoomId[]) {
    const r = ROOM_RECTS[id];
    if (x >= r.x0 - 0.05 && x <= r.x1 + 0.05 && z >= r.z0 - 0.05 && z <= r.z1 + 0.05) return id;
  }
  // nearest center fallback (player inside a wall seam)
  let best: RoomId = 'entrance'; let bd = Infinity;
  for (const id of Object.keys(ROOM_CENTERS) as RoomId[]) {
    const [cx, cz] = ROOM_CENTERS[id];
    const d = (cx - x) * (cx - x) + (cz - z) * (cz - z);
    if (d < bd) { bd = d; best = id; }
  }
  return best;
}

/* ------------------------------------------------------------------ */
/* Hotspot anchors: p = interaction point, s = unit stand direction    */
/* (from the object into the room — where the player stands)           */
/* ------------------------------------------------------------------ */
interface Anchor { p: [number, number, number]; s: [number, number] }
const ANCHORS: Record<string, Anchor> = {
  'entrance:front-door': { p: [6.15, 1.2, 0.6], s: [-1, 0] },
  'entrance:key-bowl': { p: [3.95, 0.95, -0.38], s: [0, 1] },
  'entrance:coat-rack': { p: [5.82, 1.2, -0.22], s: [-0.707, 0.707] },
  'entrance:shoe-cabinet': { p: [3.95, 0.85, 1.32], s: [0, -1] },
  'living:bookshelf': { p: [-5.82, 1.25, -2.7], s: [1, 0] },
  'living:sofa': { p: [-4.2, 1.0, -2.35], s: [0, -1] },
  'living:tv': { p: [-4.2, 1.15, -4.32], s: [0, 1] },
  'living:coffee-table': { p: [-4.2, 0.65, -3.35], s: [1, 0] },
  'living:armchair': { p: [-2.0, 0.95, -4.15], s: [-0.6, 0.8] },
  'living:plant': { p: [-5.78, 0.95, -4.28], s: [0.707, 0.707] },
  'living:window': { p: [-6.28, 1.35, -4.55], s: [1, 0] },
  'kitchen:fridge': { p: [5.95, 1.25, -4.12], s: [0, 1] },
  'kitchen:pantry': { p: [5.68, 1.25, -2.2], s: [-1, 0] },
  'kitchen:oven': { p: [1.85, 0.95, -3.92], s: [0, 1] },
  'kitchen:counter': { p: [0.19, 1.05, -3.92], s: [0, 1] },
  'kitchen:kitchen-cabinet': { p: [-0.67, 1.0, -3.92], s: [0, 1] },
  'kitchen:dining-table': { p: [4.15, 0.9, -1.9], s: [0.5, 0.86] },
  'hallway:picture': { p: [1.2, 1.35, -0.38], s: [0, 1] },
  'hallway:mirror': { p: [0.2, 1.3, 0.38], s: [0, -1] },
  'hallway:hall-closet': { p: [2.6, 1.25, 0.02], s: [0, 1] },
  'hallway:hall-lamp': { p: [2.9, 1.65, 0.32], s: [0, -1] },
  'bedroom1:bed': { p: [-4.32, 1.0, 2.9], s: [1, 0] },
  'bedroom1:desk': { p: [-2.6, 0.95, 1.9], s: [0, 1] },
  'bedroom1:wardrobe': { p: [-2.08, 1.25, 3.6], s: [-1, 0] },
  'bedroom1:piano': { p: [-2.12, 1.1, 1.6], s: [-1, 0] },
  'bedroom1:toy-shelf': { p: [-4.6, 0.85, 4.28], s: [0, -1] },
  'bedroom2:bed-double': { p: [0.98, 0.9, 3.0], s: [1, 0] },
  'bedroom2:safe': { p: [1.9, 1.18, 4.28], s: [0, -1] },
  'bedroom2:dresser': { p: [1.9, 0.85, 4.32], s: [0, -1] },
  'bedroom2:nightstand': { p: [-0.52, 0.7, 1.75], s: [1, 0] },
  'bedroom2:wardrobe-big': { p: [2.52, 1.25, 1.7], s: [-1, 0] },
  'bathroom:mirror-cabinet': { p: [5.92, 1.32, 4.35], s: [-1, 0] },
  'bathroom:tub': { p: [4.3, 0.8, 3.08], s: [0, 1] },
  'bathroom:sink': { p: [5.78, 0.95, 3.6], s: [-1, 0] },
  'bathroom:washing-machine': { p: [5.9, 0.9, 4.12], s: [0, -1] },
};
const anchorFor = (room: RoomId, hotspot: string): Anchor =>
  ANCHORS[`${room}:${hotspot}`] ?? { p: [ROOM_CENTERS[room][0], 1.1, ROOM_CENTERS[room][1]], s: [0, 1] };

/* ------------------------------------------------------------------ */
/* Rigs (live scene objects the prop-sync effect updates)              */
/* ------------------------------------------------------------------ */
interface AABB { x0: number; x1: number; z0: number; z1: number }
interface StageRig {
  group: THREE.Group; ringMat: THREE.MeshBasicMaterial; emojiMat: THREE.SpriteMaterial;
  badge: THREE.Sprite; emojiSprite: THREE.Sprite; accent: number; done: boolean; phase: number; baseY: number;
}
interface PickupRig { group: THREE.Group; ringMat: THREE.MeshBasicMaterial; phase: number }
interface FinalRig {
  group: THREE.Group; ringMat: THREE.MeshBasicMaterial; spriteMat: THREE.SpriteMaterial;
  lockTex: THREE.Texture; giftTex: THREE.Texture; locked: boolean;
}
interface DoorRig {
  node: THREE.Object3D; latch: boolean; open01: number; swing: number;
  cx: number; cz: number; aabb: AABB;
}
interface Rigs {
  stages: Map<number, StageRig>;
  pickups: Map<string, PickupRig>;
  final: FinalRig | null;
}

function applyStageDone(rig: StageRig, done: boolean): void {
  rig.done = done;
  rig.badge.visible = done;
  rig.emojiMat.opacity = done ? 0 : 1;
  rig.ringMat.color.set(done ? 0x71855f : rig.accent);
  rig.ringMat.opacity = done ? 0.1 : 0.4;
}
function applyFinalLocked(rig: FinalRig, locked: boolean): void {
  rig.locked = locked;
  rig.spriteMat.map = locked ? rig.lockTex : rig.giftTex;
  rig.spriteMat.needsUpdate = true;
  rig.ringMat.color.set(locked ? 0x8d7c5f : 0xffc93c);
}

/* ------------------------------------------------------------------ */
/* Small procedural textures                                           */
/* ------------------------------------------------------------------ */
function makeWindowTexture(): THREE.CanvasTexture {
  // Daylight through a sheer curtain: bright hazy sky, soft out-of-focus
  // greenery and a neighbouring roofline. (v6 painted a cartoon night sky.)
  const c = document.createElement('canvas');
  c.width = 256; c.height = 288;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, 288);
    g.addColorStop(0, '#cfe3f5');
    g.addColorStop(0.55, '#eef4f8');
    g.addColorStop(1, '#f7f3e6');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 256, 288);
    ctx.filter = 'blur(7px)';
    ctx.fillStyle = 'rgba(214,205,190,0.9)';
    ctx.fillRect(150, 170, 130, 130);
    ctx.fillStyle = 'rgba(176,96,74,0.55)';
    ctx.beginPath(); ctx.moveTo(140, 172); ctx.lineTo(205, 132); ctx.lineTo(270, 172); ctx.closePath(); ctx.fill();
    const blobs: [number, number, number, string][] = [
      [40, 190, 62, 'rgba(96,138,84,0.85)'], [92, 215, 48, 'rgba(120,160,96,0.8)'],
      [10, 240, 60, 'rgba(78,120,74,0.85)'], [128, 250, 44, 'rgba(110,150,90,0.8)'], [230, 262, 50, 'rgba(100,142,86,0.8)'],
    ];
    blobs.forEach(([bx, by, br, col]) => { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2); ctx.fill(); });
    ctx.filter = 'none';
    // sheer curtain haze + faint vertical folds
    ctx.fillStyle = 'rgba(255,255,255,0.34)';
    ctx.fillRect(0, 0, 256, 288);
    for (let x = 0; x < 256; x += 13) {
      ctx.fillStyle = x % 26 === 0 ? 'rgba(255,255,255,0.16)' : 'rgba(170,180,190,0.07)';
      ctx.fillRect(x, 0, 6, 288);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Subtle warm plaster for interior walls (visual fix pass) — replaces the
 * distressed PHOTO.wall brick/stone look with a normal home finish:
 * warm off-white #f2e7d3, very faint low-contrast speckle noise and a
 * barely-visible vertical soft variation. Tiled ~ every 2 m by wallMatFor.
 */
function makePlasterTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#f2e7d3';
    ctx.fillRect(0, 0, 256, 256);
    // barely-visible vertical soft variation (wide translucent bands)
    for (let x = 0; x < 256; x += 32) {
      const light = (x / 32) % 2 === 0;
      ctx.fillStyle = light ? 'rgba(255,252,244,0.05)' : 'rgba(214,192,158,0.05)';
      ctx.fillRect(x, 0, 32, 256);
    }
    const grad = ctx.createLinearGradient(0, 0, 256, 0);
    grad.addColorStop(0, 'rgba(255,255,255,0.04)');
    grad.addColorStop(0.5, 'rgba(190,168,132,0.03)');
    grad.addColorStop(1, 'rgba(255,255,255,0.04)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 256, 256);
    // very faint low-contrast noise speckles
    for (let i = 0; i < 5200; i++) {
      const sx = Math.random() * 256; const sy = Math.random() * 256;
      ctx.fillStyle = Math.random() > 0.5
        ? 'rgba(120,100,70,0.045)'
        : 'rgba(255,255,255,0.05)';
      ctx.fillRect(sx, sy, 1.2, 1.2);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function makePianoKeysTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 640; c.height = 80;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#f7f2e4';
    ctx.fillRect(0, 0, 640, 80);
    const whites = 32;
    const ww = 640 / whites;
    ctx.strokeStyle = 'rgba(60,50,40,0.5)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= whites; i++) { ctx.beginPath(); ctx.moveTo(i * ww, 0); ctx.lineTo(i * ww, 80); ctx.stroke(); }
    ctx.fillStyle = '#14100c';
    const pattern = [1, 1, 0, 1, 1, 1, 0]; // black key after white idx (groups of 2 and 3)
    for (let i = 0; i < whites - 1; i++) {
      if (pattern[i % 7] === 1) ctx.fillRect((i + 1) * ww - ww * 0.3, 0, ww * 0.6, 48);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ */
/* Component                                                           */
/* ------------------------------------------------------------------ */
export default function House3D(props: House3DProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const promptBarRef = useRef<HTMLDivElement | null>(null);
  const promptTextRef = useRef<HTMLDivElement | null>(null);
  const interactBtnRef = useRef<HTMLButtonElement | null>(null);
  const roomNameRef = useRef<HTMLSpanElement | null>(null);
  const toastRef = useRef<HTMLDivElement | null>(null);
  const joyBaseRef = useRef<HTMLDivElement | null>(null);
  const joyKnobRef = useRef<HTMLDivElement | null>(null);
  const [loading, setLoading] = useState(true);
  const [touchUi] = useState<boolean>(() =>
    typeof window !== 'undefined' && ('ontouchstart' in window || (navigator?.maxTouchPoints ?? 0) > 0));

  const propsRef = useRef(props);
  propsRef.current = props;
  const rigsRef = useRef<Rigs | null>(null);
  const interactRef = useRef<() => void>(() => undefined);
  const toastTimerRef = useRef(0);

  const showToast = (msg: string) => {
    const el = toastRef.current;
    if (!el) return;
    el.textContent = msg;
    el.classList.add('show');
    window.clearTimeout(toastTimerRef.current);
    toastTimerRef.current = window.setTimeout(() => el.classList.remove('show'), 3000);
  };
  const showToastRef = useRef(showToast);
  showToastRef.current = showToast;

  /* Prop-sync: the parent re-renders with done/collected/locked updates
     while this component stays mounted — update rig visuals in place. */
  useEffect(() => {
    const rigs = rigsRef.current;
    if (!rigs) return;
    props.spots.forEach((s) => {
      const rig = rigs.stages.get(s.stageIndex);
      if (rig && rig.done !== s.done) applyStageDone(rig, s.done);
    });
    props.pickups.forEach((pk) => {
      const rig = rigs.pickups.get(pk.id);
      if (rig) rig.group.visible = !pk.collected;
    });
    if (rigs.final) {
      const locked = props.finalLockedReason !== null;
      if (rigs.final.locked !== locked) applyFinalLocked(rigs.final, locked);
    }
  }, [props]);

  /* ---------------- main build (once) ---------------- */
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const snap = propsRef.current;
    let disposed = false;

    const width = mount.clientWidth || 360;
    const height = mount.clientHeight || 480;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, touchUi ? 1.5 : 1.75));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = 'house3d-canvas-el';
    mount.appendChild(renderer.domElement);
    const canvas = renderer.domElement;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x191008);
    scene.fog = new THREE.Fog(0x191008, 16, 42);

    const pmrem = new THREE.PMREMGenerator(renderer);
    try {
      scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
      scene.environmentIntensity = 0.45;
    } catch { /* environment is a nicety, not a requirement */ }
    pmrem.dispose();

    /* Portrait phones: a fixed 68deg vertical FOV gives only ~35deg horizontally —
       tunnel vision where every object fills the screen. Keep >= ~64deg
       horizontal by widening the vertical FOV on narrow aspects. */
    const fovFor = (aspect: number) => {
      if (aspect >= 1.25) return 62;
      const h = THREE.MathUtils.degToRad(aspect >= 1 ? 70 : 64);
      const v = 2 * Math.atan(Math.tan(h / 2) / aspect);
      return THREE.MathUtils.clamp(THREE.MathUtils.radToDeg(v), 62, 94);
    };
    const camera = new THREE.PerspectiveCamera(fovFor(width / height), width / height, 0.05, 80);
    camera.rotation.order = 'YXZ';

    /* ---- lights ---- */
    scene.add(new THREE.HemisphereLight(0xfdf6ea, 0x5a4634, 0.62));
    const roomLightPos: [number, number][] = [
      [-3.85, -2.1], [2.65, -2.9], [4.95, 0.6], [1.1, 0], [-3.85, 2.9], [1.1, 2.9], [4.95, 3.5],
    ];
    roomLightPos.forEach(([lx, lz]) => {
      const pl = new THREE.PointLight(0xffdcb4, 5.2, 9.5, 1.8);
      pl.position.set(lx, 2.32, lz);
      scene.add(pl);
    });
    const spot = new THREE.SpotLight(0xffe9c8, 70, 14, 1.12, 0.9, 1.4);
    spot.position.set(-3.85, 2.62, -2.1);
    spot.target.position.set(-3.9, 0, -2.2);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0006;
    spot.shadow.normalBias = 0.02;
    spot.shadow.radius = 5;
    scene.add(spot);
    scene.add(spot.target);

    /* ---- shared materials / textures ---- */
    const wallTexBase = makePlasterTexture();
    const wallMatFor = (len: number) => {
      const t = wallTexBase.clone();
      t.needsUpdate = true;
      // plaster tile repeats ~ every 2 m (wall height 2.7 m -> 1.35 vertically)
      t.repeat.set(Math.max(1, len / 2), 1.35);
      return new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 });
    };
    const ceilMat = new THREE.MeshStandardMaterial({ color: 0xead9bd, roughness: 1 });
    const colliders: AABB[] = [];
    const WALL_H = 2.7;
    const WALL_T = 0.15;

    const addBox = (
      w: number, h: number, d: number, x: number, y: number, z: number,
      mat: THREE.Material, opts: { collide?: boolean; shadow?: boolean } = {},
    ): THREE.Mesh => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z);
      if (opts.shadow) { m.castShadow = true; m.receiveShadow = true; }
      scene.add(m);
      if (opts.collide) colliders.push({ x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 });
      return m;
    };

    interface Gap { c: number; w: number; top: number }
    /** Wall along X at fixed z, with door/arch gaps (lintel above each gap). */
    const wallRunX = (z: number, from: number, to: number, gaps: Gap[]) => {
      const sorted = [...gaps].sort((a, b) => a.c - b.c);
      let cur = from;
      const seg = (a: number, b: number) => {
        if (b - a < 0.02) return;
        addBox(b - a, WALL_H, WALL_T, (a + b) / 2, WALL_H / 2, z, wallMatFor(b - a), { collide: true }).receiveShadow = true;
      };
      sorted.forEach((g) => {
        seg(cur, g.c - g.w / 2);
        const lh = WALL_H - g.top;
        if (lh > 0.02) addBox(g.w, lh, WALL_T, g.c, g.top + lh / 2, z, wallMatFor(g.w), { collide: false });
        cur = g.c + g.w / 2;
      });
      seg(cur, to);
    };
    /** Wall along Z at fixed x. */
    const wallRunZ = (x: number, from: number, to: number, gaps: Gap[]) => {
      const sorted = [...gaps].sort((a, b) => a.c - b.c);
      let cur = from;
      const seg = (a: number, b: number) => {
        if (b - a < 0.02) return;
        addBox(WALL_T, WALL_H, b - a, x, WALL_H / 2, (a + b) / 2, wallMatFor(b - a), { collide: true }).receiveShadow = true;
      };
      sorted.forEach((g) => {
        seg(cur, g.c - g.w / 2);
        const lh = WALL_H - g.top;
        if (lh > 0.02) addBox(WALL_T, lh, g.w, x, g.top + lh / 2, g.c, wallMatFor(g.w), { collide: false });
        cur = g.c + g.w / 2;
      });
      seg(cur, to);
    };

    /* ---- shell: exterior + partitions ---- */
    wallRunX(-5, -6.5, 6.5, []);
    wallRunX(5, -6.5, 6.5, []);
    wallRunZ(-6.5, -5, 5, []);
    wallRunZ(6.5, -5, 5, []);
    wallRunZ(-1.2, -5, 5, [
      { c: -1.9, w: 1.5, top: 2.2 }, // arch living<->kitchen
      { c: 0.0, w: 0.95, top: 2.1 }, // door hallway<->living
    ]);
    wallRunX(0.8, -6.5, 3.4, [
      { c: -3.8, w: 0.95, top: 2.1 },
      { c: 1.0, w: 0.95, top: 2.1 },
    ]);
    wallRunX(-0.8, -1.2, 6.5, [
      { c: 0.6, w: 0.95, top: 2.1 },
      { c: 5.0, w: 0.95, top: 2.1 },
    ]);
    wallRunZ(3.4, -0.8, 5, [{ c: 0.0, w: 1.4, top: 2.2 }]); // arch hallway<->entrance
    wallRunX(2.0, 3.4, 6.5, [{ c: 5.6, w: 0.95, top: 2.1 }]);

    /* ---- floors / ceiling / outside ---- */
    const floorFor = (rect: Rect, texUrl: string, tile: number, y: number) => {
      const w = rect.x1 - rect.x0; const d = rect.z1 - rect.z0;
      const f = new THREE.Mesh(
        new THREE.PlaneGeometry(w, d),
        new THREE.MeshStandardMaterial({ map: makePhotoTexture(texUrl, { repeat: [w / tile, d / tile] }), roughness: 0.7 }),
      );
      f.rotation.x = -Math.PI / 2;
      f.position.set((rect.x0 + rect.x1) / 2, y, (rect.z0 + rect.z1) / 2);
      f.receiveShadow = true;
      scene.add(f);
    };
    floorFor(ROOM_RECTS.living, PHOTO.floor, 2.2, 0);
    floorFor(ROOM_RECTS.kitchen, kitchenTileUrl, 1.6, 0.004);
    floorFor(ROOM_RECTS.entrance, PHOTO.floor, 2.2, 0.002);
    floorFor(ROOM_RECTS.hallway, PHOTO.floor, 2.2, 0.002);
    floorFor(ROOM_RECTS.bedroom1, PHOTO.floor, 2.2, 0);
    floorFor(ROOM_RECTS.bedroom2, PHOTO.floor, 2.2, 0);
    floorFor(ROOM_RECTS.bathroom, bathroomTileUrl, 1.4, 0.004);

    const ceiling = new THREE.Mesh(new THREE.PlaneGeometry(13, 10), ceilMat);
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, WALL_H, 0);
    scene.add(ceiling);

    const outside = new THREE.Mesh(
      new THREE.PlaneGeometry(80, 80),
      new THREE.MeshStandardMaterial({ color: 0x17120d, roughness: 1 }),
    );
    outside.rotation.x = -Math.PI / 2;
    outside.position.y = -0.05;
    scene.add(outside);

    /* bathroom tile wainscot (lower walls) — v6: Poly Haven subway-tile PBR */
    const pbrTex = (url: string, srgb: boolean, rx: number, ry: number) => {
      const t = new THREE.TextureLoader().load(url);
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = THREE.RepeatWrapping;
      t.wrapT = THREE.RepeatWrapping;
      t.repeat.set(rx, ry);
      t.anisotropy = 4;
      return t;
    };
    const bathTileMat = new THREE.MeshStandardMaterial({
      map: pbrTex(phSubwayDiffUrl, true, 3, 1),
      normalMap: pbrTex(phSubwayNorUrl, false, 3, 1),
      roughness: 0.35,
    });
    const wainscot = (w: number, x: number, z: number, rotY: number) => {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(w, 1.25), bathTileMat);
      p.position.set(x, 0.625, z);
      p.rotation.y = rotY;
      scene.add(p);
    };
    wainscot(3.1, 4.95, 2.08, 0);
    wainscot(3.1, 4.95, 4.92, Math.PI);
    wainscot(3.0, 3.48, 3.5, Math.PI / 2);
    wainscot(3.0, 6.42, 3.5, -Math.PI / 2);

    /* ---- windows (evening glow planes + frames) ---- */
    const windowTex = makeWindowTexture();
    const glowTex = makeGlowTexture();
    const frameMat = new THREE.MeshStandardMaterial({ color: 0xf1ede4, roughness: 0.6 });
    const addWindow = (x: number, z: number, rotY: number, w = 1.1, h = 1.2, cy = 1.6) => {
      const g = new THREE.Group();
      const pane = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshBasicMaterial({ map: windowTex, toneMapped: false }),
      );
      pane.position.z = 0.02;
      g.add(pane);
      const mkBar = (bw: number, bh: number, bx: number, by: number) => {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(bw, bh, 0.055), frameMat);
        bar.position.set(bx, by, 0.03);
        g.add(bar);
      };
      mkBar(w + 0.14, 0.08, 0, h / 2 + 0.02);
      mkBar(w + 0.14, 0.08, 0, -h / 2 - 0.02);
      mkBar(0.08, h + 0.14, -w / 2 - 0.02, 0);
      mkBar(0.08, h + 0.14, w / 2 + 0.02, 0);
      mkBar(0.045, h, 0, 0);
      mkBar(w, 0.045, 0, 0);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, transparent: true, opacity: 0.22, color: 0xdfeaff,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      glow.scale.set(w * 2.2, h * 2.2, 1);
      glow.position.z = 0.22;
      g.add(glow);
      g.position.set(x, cy, z);
      g.rotation.y = rotY;
      scene.add(g);
    };
    addWindow(-6.42, -4.55, Math.PI / 2);
    addWindow(-6.42, -0.1, Math.PI / 2);
    addWindow(-2.3, -4.92, 0);
    addWindow(1.02, -4.92, 0, 1.0, 0.9, 1.85); // kitchen, above the sink
    addWindow(-6.42, 1.35, Math.PI / 2);
    addWindow(0.2, 4.92, Math.PI);

    /* ---- framed photos ---- */
    const photoFrameMat = new THREE.MeshStandardMaterial({ color: 0xf4f0e6, roughness: 0.95 });
    const addFramedPhoto = (url: string, w: number, h: number, x: number, y: number, z: number, rotY: number) => {
      const g = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.02, h + 0.02, 0.01), photoFrameMat);
      g.add(frame);
      const tex = makePhotoTexture(url, { mirror: false });
      tex.wrapS = THREE.ClampToEdgeWrapping;
      tex.wrapT = THREE.ClampToEdgeWrapping;
      const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
      art.position.z = 0.008;
      g.add(art);
      g.position.set(x, y, z);
      g.rotation.y = rotY;
      scene.add(g);
    };
    // hallway "family picture": a real family-at-sunset photo behind a white mat.
    // (v6 hung a 1 m film-set still here — on a phone it swallowed the whole view.)
    {
      const mat = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.56, 0.012),
        new THREE.MeshStandardMaterial({ color: 0xf4f0e6, roughness: 0.95 }));
      mat.position.set(1.2, 1.55, -0.705);
      scene.add(mat);
      addFramedPhoto(PHOTO.sunset, 0.52, 0.35, 1.2, 1.55, -0.722, 0);
      const fm = new THREE.MeshStandardMaterial({ color: 0x2b2019, roughness: 0.6 });
      ([[0.8, 0.035, 0, 0.2975], [0.8, 0.035, 0, -0.2975], [0.035, 0.63, 0.3825, 0], [0.035, 0.63, -0.3825, 0]] as const).forEach(([w, h, dx, dy]) => {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.035), fm);
        bar.position.set(1.2 + dx, 1.55 + dy, -0.7);
        scene.add(bar);
      });
    }

    /* living rug (photo texture plane between sofa and TV) */
    const rugTex = makePhotoTexture(PHOTO.rug, { mirror: false });
    rugTex.wrapS = THREE.ClampToEdgeWrapping;
    rugTex.wrapT = THREE.ClampToEdgeWrapping;
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.4), new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 }));
    rug.rotation.x = -Math.PI / 2;
    rug.rotation.z = Math.PI / 2;
    rug.position.set(-4.2, 0.012, -3.35);
    rug.receiveShadow = true;
    scene.add(rug);

    /* ================================================================ */
    /* Models — load once, clone per placement. Kenney GLBs are NOT    */
    /* centered (origin at a corner, front = +Z local), so every       */
    /* template is normalized: bbox bottom-center becomes the origin.  */
    /* ================================================================ */
    const MODEL_URLS: Record<string, string> = {
      tv: tvUrl, tvStand: tvStandUrl,
      bookshelf: bookshelfUrl, bookshelfLow: bookshelfLowUrl,
      plant: plantUrl, plantSmall: plantSmallUrl, floorLamp: floorLampUrl, ceilingLamp: ceilingLampUrl,
      kitchenCabinet: kitchenCabinetUrl, kitchenCabinetDrawer: kitchenCabinetDrawerUrl,
      kitchenCabinetUpper: kitchenCabinetUpperUrl, kitchenSink: kitchenSinkUrl, stove: stoveUrl,
      rangeHood: rangeHoodUrl, fridge: fridgeUrl, microwave: microwaveUrl, wardrobe: wardrobeUrl,
      diningTable: diningTableUrl, coatRack: coatRackUrl,
      sideTable: sideTableUrl, rugRound: rugRoundUrl, wallLamp: wallLampUrl, desk: deskUrl,
      chairDesk: chairDeskUrl, computerScreen: computerScreenUrl, bedBunk: bedBunkUrl,
      bedDouble: bedDoubleUrl, tableLamp: tableLampUrl, dresser: dresserUrl,
      phSofa: phSofaUrl, phArmchair: phArmchairUrl, phCoffeeTable: phCoffeeTableUrl,
      phCeilingLamp: phCeilingLampUrl, phKettle: phKettleUrl, phDiningChair: phDiningChairUrl,
      phNightstand: phNightstandUrl, phVase: phVaseUrl,
      bathtub: bathtubUrl, bathroomSink: bathroomSinkUrl, bathroomMirror: bathroomMirrorUrl,
      bathroomCabinet: bathroomCabinetUrl, toilet: toiletUrl, washingMachine: washingMachineUrl,
      door: doorUrl,
      phPlantTall: phPlantTallUrl, phPlantBig: phPlantBigUrl, phPlantSmall: phPlantSmallUrl, phCabinet: phCabinetUrl, phFrameA: phFrameAUrl, phFrameB: phFrameBUrl, phFrameC: phFrameCUrl, phClock: phClockUrl, phPillows: phPillowsUrl, phDesk: phDeskUrl, phDrawer: phDrawerUrl, phSideTable: phSideTableUrl, phShelves: phShelvesUrl, phStandFrame: phStandFrameUrl, phMirror: phMirrorUrl, phDeskLamp: phDeskLampUrl,
    };
    interface Template { wrap: THREE.Group; size: THREE.Vector3 }
    const templates = new Map<string, Template | null>();

    const buildAll = async () => {
      const loader = new GLTFLoader();
      await Promise.all(Object.entries(MODEL_URLS).map(async ([key, url]) => {
        try {
          const gltf = await loader.loadAsync(url);
          const inner = gltf.scene;
          const box = new THREE.Box3().setFromObject(inner);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          inner.position.set(-center.x, -box.min.y, -center.z);
          const wrap = new THREE.Group();
          wrap.add(inner);
          inner.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (mesh.isMesh) { mesh.castShadow = true; mesh.receiveShadow = true; }
          });
          templates.set(key, { wrap, size });
        } catch (err) {
          console.warn(`[House3D] model failed: ${key}`, err);
          templates.set(key, null);
        }
      }));
      if (disposed) return;

      const place = (
        key: string,
        o: { x: number; z: number; y?: number; rotY?: number; s?: number; fitH?: number; fitW?: number; collide?: boolean; fb?: [number, number, number] },
      ): THREE.Group => {
        const t = templates.get(key);
        // fitH / fitW: scale a real-world model to a target height / width (m)
        const s = t && o.fitH ? o.fitH / t.size.y : t && o.fitW ? o.fitW / t.size.x : (o.s ?? 1);
        let g: THREE.Group;
        let size: THREE.Vector3;
        if (t) {
          g = t.wrap.clone(true) as THREE.Group;
          size = t.size.clone();
        } else {
          // placeholder box — the house must never crash on a missing model
          const fb = o.fb ?? [0.5, 0.5, 0.5];
          g = new THREE.Group();
          const m = new THREE.Mesh(
            new THREE.BoxGeometry(fb[0], fb[1], fb[2]),
            new THREE.MeshStandardMaterial({ color: 0x8a7a68, roughness: 0.9 }),
          );
          m.position.y = fb[1] / 2;
          m.castShadow = true;
          g.add(m);
          size = new THREE.Vector3(fb[0], fb[1], fb[2]);
        }
        g.position.set(o.x, o.y ?? 0, o.z);
        g.rotation.y = o.rotY ?? 0;
        g.scale.setScalar(s);
        scene.add(g);
        if (o.collide) {
          const w = size.x * s; const d = size.z * s;
          const rot = o.rotY ?? 0;
          const aw = Math.abs(w * Math.cos(rot)) + Math.abs(d * Math.sin(rot));
          const ad = Math.abs(w * Math.sin(rot)) + Math.abs(d * Math.cos(rot));
          colliders.push({ x0: o.x - aw / 2, x1: o.x + aw / 2, z0: o.z - ad / 2, z1: o.z + ad / 2 });
        }
        return g;
      };

      /* ---------------- LIVING ---------------- */
      const tvStandG = place('phCabinet', { x: -4.2, z: -4.6, fitW: 1.9, collide: true, fb: [1.9, 0.53, 0.5] });
      const tvTop = new THREE.Box3().setFromObject(tvStandG).max.y;
      {
        // flat-screen TV (procedural: thin dark slab, glossy panel, low foot)
        const tv = new THREE.Group();
        const body = new THREE.MeshStandardMaterial({ color: 0x0c0d0f, roughness: 0.45, metalness: 0.4 });
        const panel = new THREE.MeshStandardMaterial({ color: 0x06080b, roughness: 0.12, metalness: 0.6 });
        const slab = new THREE.Mesh(new THREE.BoxGeometry(1.24, 0.71, 0.035), body);
        slab.position.y = 0.435; slab.castShadow = true; tv.add(slab);
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.215, 0.685), panel);
        scr.position.set(0, 0.438, 0.0185); tv.add(scr);
        const neck = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.03), body);
        neck.position.set(0, 0.05, -0.01); tv.add(neck);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.012, 0.2), body);
        foot.position.y = 0.006; foot.castShadow = true; tv.add(foot);
        tv.position.set(-4.2, tvTop, -4.62);
        scene.add(tv);
      }
      const tvGroup = new THREE.Group();
      if (tvGroup.children.length) {
        // TV screen -> dark glossy "off TV" (was a blank near-white slab).
        // tv.glb (Kenney televisionModern) is one mesh with 2 primitives:
        // the body (210 indices, material metalDark) and the screen — a
        // single flat front quad (6 indices, material metal). Heuristic:
        // prefer a low-index-count flat quad mesh; fall back to the
        // largest flat (thin-depth) front-facing mesh in the TV group.
        const tvMeshes: THREE.Mesh[] = [];
        tvGroup.traverse((o) => {
          const m = o as THREE.Mesh;
          if (m.isMesh) tvMeshes.push(m);
        });
        let screenMesh: THREE.Mesh | null =
          tvMeshes.find((m) => {
            const idx = m.geometry?.index;
            return idx != null && idx.count > 0 && idx.count <= 12;
          }) ?? null;
        if (!screenMesh) {
          let bestArea = -1;
          const sz = new THREE.Vector3();
          tvMeshes.forEach((m) => {
            if (!m.geometry) return;
            m.geometry.computeBoundingBox();
            if (!m.geometry.boundingBox) return;
            m.geometry.boundingBox.getSize(sz);
            const area = sz.x * sz.y; // front plane = XY
            const thin = Math.min(sz.x, sz.y, sz.z) <= 0.25 * Math.max(sz.x, sz.y);
            if (thin && area > bestArea) { bestArea = area; screenMesh = m; }
          });
        }
        if (screenMesh) {
          (screenMesh as THREE.Mesh).material = new THREE.MeshStandardMaterial({
            color: 0x11151b, roughness: 0.22, metalness: 0.35, emissive: 0x05070a,
          });
        }
      }
      place('phSofa', { x: -4.2, z: -1.4, rotY: Math.PI, s: 1.1, collide: true, fb: [2.0, 0.78, 0.9] });
      place('phCoffeeTable', { x: -4.2, z: -3.35, s: 1.0, collide: true, fb: [1.3, 0.49, 1.3] });
      [-3.6, -2.7, -1.8].forEach((bz) => {
        place('bookshelf', { x: -6.17, z: bz, rotY: Math.PI / 2, s: 2.0, collide: bz === -2.7, fb: [0.8, 1.76, 0.5] });
      });
      colliders.push({ x0: -6.44, x1: -5.9, z0: -4.05, z1: -1.35 });
      // (v6: the shelves are filled by houseDecor's instanced-book wall —
      // hundreds of individual books + the wooden puzzle box.)
      place('phArmchair', { x: -2.0, z: -4.15, rotY: -0.64, s: 1.0, collide: true, fb: [0.82, 1.02, 0.99] });
      place('phPlantTall', { x: -5.95, z: -4.45, fitH: 1.45, collide: true, fb: [0.5, 1.4, 0.5] });
      place('phPillows', { x: -4.75, z: -1.3, y: 0.47, rotY: Math.PI, fitW: 0.62, fb: [0.6, 0.4, 0.4] });
      place('phFrameB', { x: -5.7, z: -4.905, y: 1.5, fitW: 0.95, fb: [0.95, 0.63, 0.03] });
      place('phFrameC', { x: -4.2, z: 0.705, y: 1.5, rotY: Math.PI, fitW: 0.9, fb: [0.9, 0.7, 0.03] });
      place('phFrameA', { x: -1.295, z: -3.6, y: 1.25, rotY: -Math.PI / 2, fitH: 0.8, fb: [0.56, 0.8, 0.03] });
      place('floorLamp', { x: -2.92, z: -0.72, s: 1.9, fb: [0.23, 1.63, 0.23] });
      const lampGlow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: glowTex, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      lampGlow.scale.set(0.9, 0.9, 1);
      lampGlow.position.set(-2.92, 1.5, -0.72);
      scene.add(lampGlow);

      /* ---------------- KITCHEN ---------------- */
      // north-wall run, west -> east (fronts face south, rotY 0)
      place('kitchenCabinet', { x: -0.67, z: -4.47, s: 2.0, collide: true, fb: [0.86, 0.9, 0.9] });
      place('kitchenCabinet', { x: 0.19, z: -4.47, s: 2.0, fb: [0.86, 0.9, 0.9] });
      place('kitchenSink', { x: 1.02, z: -4.5, s: 1.85, fb: [0.8, 0.9, 0.83] });
      place('stove', { x: 1.85, z: -4.47, s: 2.0, fb: [0.86, 0.9, 0.9] });
      place('kitchenCabinetDrawer', { x: 2.71, z: -4.47, s: 2.0, fb: [0.86, 0.9, 0.9] });
      colliders.push({ x0: -1.12, x1: 3.16, z0: -4.95, z1: -4.0 });
      place('rangeHood', { x: 1.85, z: -4.64, y: 1.5, s: 2.0, fb: [0.86, 0.8, 0.56] });
      [-0.67, 0.19, 2.71].forEach((ux) => {
        place('kitchenCabinetUpper', { x: ux, z: -4.7, y: 1.45, s: 2.0, fb: [0.86, 0.78, 0.44] });
      });
      // marble slabs on the base cabinets + tiled backsplash
      // (v6: Poly Haven PBR sets — marble_01 counters, interior_tiles backsplash;
      //  the pbrTex helper is hoisted from the bathroom section below)
      const marbleMat = new THREE.MeshStandardMaterial({
        map: pbrTex(phMarbleDiffUrl, true, 2, 1),
        normalMap: pbrTex(phMarbleNorUrl, false, 2, 1),
        roughnessMap: pbrTex(phMarbleRoughUrl, false, 2, 1),
        roughness: 1.0,
      });
      [-0.67, 0.19, 2.71].forEach((ux) => {
        const slab = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.05, 0.94), marbleMat);
        slab.position.set(ux, 0.925, -4.46);
        slab.receiveShadow = true;
        scene.add(slab);
      });
      const backsplash = new THREE.Mesh(
        new THREE.PlaneGeometry(4.26, 0.55),
        new THREE.MeshStandardMaterial({
          map: pbrTex(phTilesDiffUrl, true, 4, 1),
          normalMap: pbrTex(phTilesNorUrl, false, 4, 1),
          roughness: 0.35,
        }),
      );
      backsplash.position.set(1.02, 1.17, -4.915);
      scene.add(backsplash);
      place('microwave', { x: 2.71, z: -4.52, y: 0.95, s: 1.6, fb: [0.46, 0.29, 0.37] });
      place('phKettle', { x: -0.78, z: -4.48, y: 0.95, s: 1.0, rotY: -0.5, fb: [0.32, 0.3, 0.25] });
      place('fridge', { x: 5.95, z: -4.65, s: 1.9, collide: true, fb: [0.82, 1.75, 0.55] });
      place('wardrobe', { x: 6.1, z: -2.2, rotY: -Math.PI / 2, s: 2.55, collide: true, fb: [1.0, 2.17, 0.64] }); // pantry
      place('diningTable', { x: 4.15, z: -2.5, s: 2.1, collide: true, fb: [1.76, 0.7, 0.95] });
      // chairs tucked in, and the whole set kept clear of the fridge route and
      // the entrance door (v6 sealed the fridge behind the dining set)
      place('phDiningChair', { x: 3.8, z: -3.1, s: 1.0, collide: true, fb: [0.43, 0.97, 0.58] });
      place('phDiningChair', { x: 4.6, z: -3.1, s: 1.0, collide: true, fb: [0.43, 0.97, 0.58] });
      place('phDiningChair', { x: 3.6, z: -1.9, rotY: Math.PI, s: 1.0, collide: true, fb: [0.43, 0.97, 0.58] });
      place('phDiningChair', { x: 4.4, z: -1.9, rotY: Math.PI, s: 1.0, collide: true, fb: [0.43, 0.97, 0.58] });
      place('phVase', { x: 4.15, z: -2.5, y: 0.69, s: 1.0, fb: [0.2, 0.4, 0.2] }); // dining centerpiece

      /* ---------------- ENTRANCE ---------------- */
      place('coatRack', { x: 6.02, z: -0.42, s: 2.2, collide: true, fb: [0.59, 1.69, 0.59] });
      place('phSideTable', { x: 3.95, z: -0.4, fitH: 0.75, collide: true, fb: [0.75, 0.75, 0.6] });
      place('phVase', { x: 4.17, z: -0.42, y: 0.75, s: 0.85, fb: [0.17, 0.34, 0.17] }); // entrance vase
      // key bowl on the side table
      const bowl = new THREE.Mesh(
        new THREE.CylinderGeometry(0.11, 0.07, 0.055, 20),
        new THREE.MeshStandardMaterial({ color: 0xb8452e, roughness: 0.4 }),
      );
      bowl.position.set(3.88, 0.778, -0.4);
      bowl.castShadow = true;
      scene.add(bowl);
      const keyRing = new THREE.Mesh(
        new THREE.TorusGeometry(0.032, 0.008, 8, 20),
        new THREE.MeshStandardMaterial({ color: 0xd9a441, metalness: 0.85, roughness: 0.3 }),
      );
      keyRing.rotation.x = Math.PI / 2.4;
      keyRing.position.set(3.88, 0.812, -0.4);
      scene.add(keyRing);
      place('phDrawer', { x: 4.15, z: 1.6, rotY: Math.PI, fitH: 0.78, collide: true, fb: [1.2, 0.78, 0.6] }); // shoe cabinet
      place('phPlantSmall', { x: 4.45, z: 1.62, y: 0.78, s: 1.0, fb: [0.17, 0.27, 0.17] });
      place('rugRound', { x: 5.0, z: 0.85, y: 0.006, s: 2.4, fb: [2.2, 0.02, 2.2] });

      /* ---------------- HALLWAY ---------------- */
      place('wardrobe', { x: 2.6, z: -0.4, s: 2.55, collide: true, fb: [1.0, 2.17, 0.64] }); // hall closet
      place('phMirror', { x: 0.2, z: 0.705, y: 1.0, rotY: Math.PI, fitH: 0.95, fb: [0.6, 0.95, 0.04] }); // hall mirror
      place('phClock', { x: 2.8, z: -0.895, y: 1.75, rotY: Math.PI, fitH: 0.34, fb: [0.34, 0.34, 0.05] }); // kitchen wall clock
      place('phPlantBig', { x: -0.7, z: -1.35, fitH: 0.75, collide: true, fb: [0.6, 0.75, 0.6] });
      place('phPlantBig', { x: 2.95, z: 4.5, rotY: 1.9, fitH: 0.8, collide: true, fb: [0.6, 0.8, 0.6] });
      place('wallLamp', { x: 2.9, z: 0.66, y: 1.92, rotY: Math.PI, s: 1.8, fb: [0.41, 0.16, 0.27] });

      /* ---------------- BEDROOM1 (kids) ---------------- */
      place('bedBunk', { x: -5.44, z: 2.9, rotY: Math.PI / 2, s: 1.8, collide: true, fb: [1.96, 1.53, 1.03] });
      place('phDesk', { x: -2.6, z: 1.27, fitH: 0.74, collide: true, fb: [1.05, 0.74, 0.66] });
      place('phDeskLamp', { x: -3.0, z: 1.12, y: 0.74, rotY: 0.6, fitH: 0.5, fb: [0.2, 0.5, 0.3] });
      place('chairDesk', { x: -2.6, z: 1.98, rotY: Math.PI, s: 1.8, collide: true, fb: [0.59, 1.1, 0.56] });
      place('computerScreen', { x: -2.62, z: 1.1, y: 0.74, s: 1.6, fb: [0.62, 0.46, 0.16] });
      place('phPlantSmall', { x: -2.2, z: 1.15, y: 0.74, s: 1.0, fb: [0.17, 0.27, 0.17] });
      place('wardrobe', { x: -1.6, z: 3.6, rotY: -Math.PI / 2, s: 2.55, collide: true, fb: [1.0, 2.17, 0.64] });
      const toyShelf = place('phShelves', { x: -4.6, z: 4.72, rotY: Math.PI / 2, fitH: 1.1, collide: true, fb: [0.3, 1.1, 0.8] }); // toy shelf
      const toyTop = new THREE.Box3().setFromObject(toyShelf).max.y;
      place('phPlantSmall', { x: -4.86, z: 4.72, y: toyTop, s: 1.0, fb: [0.17, 0.27, 0.17] });
      const toyColors = [0xe4572e, 0x2a9d8f, 0xf2a007];
      toyColors.forEach((tc, i) => {
        const toy = new THREE.Mesh(
          new THREE.BoxGeometry(0.15, 0.15, 0.15),
          new THREE.MeshStandardMaterial({ color: tc, roughness: 0.7 }),
        );
        toy.position.set(-4.62 + i * 0.17, toyTop + 0.075, 4.72);
        toy.rotation.y = i * 0.5;
        toy.castShadow = true;
        scene.add(toy);
      });
      const ball = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 14, 12),
        new THREE.MeshStandardMaterial({ color: 0xd94f30, roughness: 0.5 }),
      );
      ball.position.set(-4.15, 0.09, 4.3);
      ball.castShadow = true;
      scene.add(ball);

      /* piano (procedural — no model exists) */
      {
        const piano = new THREE.Group();
        const gloss = new THREE.MeshStandardMaterial({ color: 0x17130f, roughness: 0.32, metalness: 0.15 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(1.35, 1.17, 0.52), gloss);
        body.position.y = 0.665;
        body.castShadow = true;
        piano.add(body);
        const lid = new THREE.Mesh(new THREE.BoxGeometry(1.39, 0.05, 0.56), gloss);
        lid.position.y = 1.27;
        piano.add(lid);
        const keybed = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.07, 0.2), gloss);
        keybed.position.set(0, 0.7, 0.33);
        piano.add(keybed);
        const keys = new THREE.Mesh(
          new THREE.PlaneGeometry(1.24, 0.15),
          new THREE.MeshStandardMaterial({ map: makePianoKeysTexture(), roughness: 0.5 }),
        );
        keys.rotation.x = -Math.PI / 2;
        keys.position.set(0, 0.74, 0.335);
        piano.add(keys);
        const fall = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.17, 0.04), gloss);
        fall.position.set(0, 0.87, 0.285);
        fall.rotation.x = -0.14;
        piano.add(fall);
        const stand = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.3, 0.03), gloss);
        stand.position.set(0, 1.06, 0.27);
        stand.rotation.x = -0.3;
        piano.add(stand);
        const pedalMat = new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.8, roughness: 0.35 });
        [-0.09, 0.09].forEach((px) => {
          const pedal = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.03, 0.09), pedalMat);
          pedal.position.set(px, 0.03, 0.29);
          piano.add(pedal);
        });
        piano.position.set(-1.56, 0, 1.6);
        piano.rotation.y = -Math.PI / 2;
        scene.add(piano);
        colliders.push({ x0: -1.86, x1: -1.24, z0: 0.9, z1: 2.3 });
      }

      /* ---------------- BEDROOM2 (parents) ---------------- */
      place('bedDouble', { x: -0.17, z: 3.0, rotY: Math.PI / 2, s: 1.7, collide: true, fb: [1.92, 0.65, 1.63] });
      place('phNightstand', { x: -0.91, z: 1.75, rotY: Math.PI / 2, s: 1.0, collide: true, fb: [0.57, 0.7, 0.42] });
      place('phNightstand', { x: -0.91, z: 4.25, rotY: Math.PI / 2, s: 1.0, fb: [0.57, 0.7, 0.42] });
      place('tableLamp', { x: -0.91, z: 1.75, y: 0.7, s: 1.5, fb: [0.23, 0.47, 0.27] });
      place('phDrawer', { x: 1.9, z: 4.6, rotY: Math.PI, fitH: 0.72, collide: true, fb: [1.14, 0.72, 0.6] });
      place('phStandFrame', { x: 1.32, z: 4.62, y: 0.72, rotY: Math.PI / 2 + 0.3, fitH: 0.24, fb: [0.1, 0.24, 0.2] });
      place('phPillows', { x: -0.75, z: 3.0, y: 0.62, rotY: Math.PI / 2, fitW: 0.6, fb: [0.6, 0.4, 0.4] });
      place('wardrobe', { x: 3.0, z: 1.7, rotY: -Math.PI / 2, s: 2.55, collide: true, fb: [1.0, 2.17, 0.64] }); // wardrobe-big

      /* the safe (procedural) — default final-target anchor, on the dresser */
      {
        const safe = new THREE.Group();
        const steel = new THREE.MeshStandardMaterial({ color: 0x3a3f44, metalness: 0.8, roughness: 0.35 });
        const steelLight = new THREE.MeshStandardMaterial({ color: 0x484f55, metalness: 0.8, roughness: 0.3 });
        const bodyS = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.55, 0.45), steel);
        bodyS.position.y = 0.275;
        bodyS.castShadow = true;
        safe.add(bodyS);
        const doorPlate = new THREE.Mesh(new THREE.BoxGeometry(0.47, 0.47, 0.04), steelLight);
        doorPlate.position.set(0, 0.275, 0.235);
        safe.add(doorPlate);
        const dial = new THREE.Mesh(
          new THREE.CylinderGeometry(0.055, 0.055, 0.03, 20),
          new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.6, roughness: 0.4, emissive: 0xffa726, emissiveIntensity: 0.55 }),
        );
        dial.rotation.x = Math.PI / 2;
        dial.position.set(-0.12, 0.34, 0.26);
        safe.add(dial);
        const handle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.016, 10, 24), steelLight);
        handle.position.set(0.12, 0.24, 0.26);
        safe.add(handle);
        safe.position.set(1.9, 0.72, 4.62);
        safe.rotation.y = Math.PI;
        scene.add(safe);
      }

      /* ---------------- BATHROOM ---------------- */
      place('bathtub', { x: 4.3, z: 2.5, s: 1.45, collide: true, fb: [1.73, 0.61, 0.81] });
      place('bathroomSink', { x: 6.2, z: 3.6, rotY: -Math.PI / 2, s: 1.55, collide: true, fb: [0.45, 0.87, 0.53] });
      place('bathroomMirror', { x: 6.31, z: 3.6, y: 1.06, rotY: -Math.PI / 2, s: 1.9, fb: [0.1, 0.82, 0.57] });
      place('bathroomCabinet', { x: 6.3, z: 4.35, y: 1.12, rotY: -Math.PI / 2, s: 1.9, collide: false, fb: [0.25, 0.74, 0.44] });
      place('toilet', { x: 4.0, z: 4.54, rotY: Math.PI, s: 1.6, collide: true, fb: [0.5, 0.72, 0.77] });
      place('washingMachine', { x: 5.9, z: 4.61, rotY: Math.PI, s: 1.6, collide: true, fb: [0.62, 0.75, 0.62] });

      /* ---------------- ceiling lamps ---------------- */
      Object.values(ROOM_CENTERS).forEach(([cx, cz]) => {
        // living room gets the Poly Haven pendant instead of the Kenney lamp
        if (cx === -3.85 && cz === -2.1) return;
        place('ceilingLamp', { x: cx, z: cz, y: 2.19, s: 2.2, fb: [0.26, 0.5, 0.26] });
        const cg = new THREE.Sprite(new THREE.SpriteMaterial({
          map: glowTex, transparent: true, opacity: 0.32, blending: THREE.AdditiveBlending, depthWrite: false,
        }));
        cg.scale.set(1.5, 1.5, 1);
        cg.position.set(cx, 2.12, cz);
        scene.add(cg);
      });

      /* Poly Haven pendants: living-room centre + over the dining table
         (lamp is 0.95 m tall, so y 1.75 puts its mount flush with the ceiling) */
      place('phCeilingLamp', { x: -3.85, z: -2.1, y: 1.75, s: 1.0, fb: [0.43, 0.95, 0.43] });
      place('phCeilingLamp', { x: 4.15, z: -2.5, y: 1.75, s: 1.0, fb: [0.43, 0.95, 0.43] });

      /* ---------------- doors ---------------- */
      const doorRigs: DoorRig[] = [];
      const doorTexForFallback = makePhotoTexture(PHOTO.door, { mirror: false });
      const addDoor = (cx: number, cz: number, rotY: number, swing: 1 | -1, aabb: AABB) => {
        const t = templates.get('door');
        let node: THREE.Object3D | null = null;
        if (t) {
          const g = t.wrap.clone(true) as THREE.Group;
          g.position.set(cx, 0, cz);
          g.rotation.y = rotY;
          g.scale.setScalar(2.05);
          scene.add(g);
          node = g.getObjectByName('door') ?? null;
        }
        if (!node) {
          // procedural fallback: frame boxes + pivoting panel (PHOTO.door)
          const g = new THREE.Group();
          g.position.set(cx, 0, cz);
          g.rotation.y = rotY;
          const frameM = new THREE.MeshStandardMaterial({ color: 0x5c3d21, roughness: 0.8 });
          [-0.52, 0.52].forEach((fx) => {
            const post = new THREE.Mesh(new THREE.BoxGeometry(0.09, 2.1, 0.12), frameM);
            post.position.set(fx, 1.05, 0);
            g.add(post);
          });
          const top = new THREE.Mesh(new THREE.BoxGeometry(1.13, 0.09, 0.12), frameM);
          top.position.set(0, 2.12, 0);
          g.add(top);
          const pivot = new THREE.Group();
          pivot.position.set(-0.475, 0, 0);
          const panel = new THREE.Mesh(
            new THREE.BoxGeometry(0.95, 2.04, 0.05),
            new THREE.MeshStandardMaterial({ map: doorTexForFallback, roughness: 0.5 }),
          );
          panel.position.set(0.475, 1.04, 0);
          panel.castShadow = true;
          pivot.add(panel);
          g.add(pivot);
          scene.add(g);
          node = pivot;
        }
        doorRigs.push({ node, latch: false, open01: 0, swing, cx, cz, aabb });
      };
      addDoor(-3.8, 0.8, 0, -1, { x0: -4.28, x1: -3.32, z0: 0.71, z1: 0.89 }); // living<->bedroom1
      addDoor(1.0, 0.8, 0, -1, { x0: 0.52, x1: 1.48, z0: 0.71, z1: 0.89 }); // hallway<->bedroom2
      addDoor(0.6, -0.8, 0, 1, { x0: 0.12, x1: 1.08, z0: -0.89, z1: -0.71 }); // kitchen<->hallway
      addDoor(5.0, -0.8, Math.PI, 1, { x0: 4.52, x1: 5.48, z0: -0.89, z1: -0.71 }); // kitchen<->entrance
      addDoor(-1.2, 0.0, -Math.PI / 2, -1, { x0: -1.29, x1: -1.11, z0: -0.48, z1: 0.48 }); // living<->hallway
      addDoor(5.6, 2.0, Math.PI, -1, { x0: 5.12, x1: 6.08, z0: 1.91, z1: 2.09 }); // entrance<->bathroom
      // front door: closed decor on the east wall
      {
        const t = templates.get('door');
        if (t) {
          const g = t.wrap.clone(true) as THREE.Group;
          g.position.set(6.4, 0, 0.6);
          g.rotation.y = -Math.PI / 2;
          g.scale.setScalar(2.05);
          scene.add(g);
        }
      }

      /* ---------------- v6 modeling uplift (visual only) ----------------
         Architecture trim, bookshelf wall, kitchen/dining dressing and
         lived-in density for every room. Purely decorative: no anchors,
         no colliders, no interaction state — a failure here must never
         break the game, so it is fully guarded. */
      try {
        buildHouseDecor(scene);
      } catch (err) {
        console.warn('[House3D] decor pass failed (visual only)', err);
      }

      /* ---------------- interactable rigs ---------------- */
      const rigs: Rigs = { stages: new Map(), pickups: new Map(), final: null };
      const badgeTex = makeBadgeTexture();
      const sparkTex = makeSparkleTexture();
      const mkRing = (rIn: number, rOut: number, color: number, opacity: number) => {
        const mat = new THREE.MeshBasicMaterial({
          color, transparent: true, opacity, side: THREE.DoubleSide, depthWrite: false,
        });
        const ring = new THREE.Mesh(new THREE.RingGeometry(rIn, rOut, 40), mat);
        ring.rotation.x = -Math.PI / 2;
        ring.position.y = 0.03;
        return { ring, mat };
      };
      const mkSprite = (tex: THREE.Texture, scale: number, x: number, y: number, z: number) => {
        const sm = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
        const sp = new THREE.Sprite(sm);
        sp.scale.set(scale, scale, 1);
        sp.position.set(x, y, z);
        return { sp, sm };
      };

      snap.spots.forEach((spot) => {
        const a = anchorFor(spot.room, spot.hotspot);
        const group = new THREE.Group();
        group.position.set(a.p[0], 0, a.p[2]);
        const accent = ACCENTS[spot.type] ?? 0xffc65c;
        const baseY = a.p[1] + 0.12;
        const { ring, mat } = mkRing(0.2, 0.235, accent, 0.4);
        ring.position.set(a.s[0] * 0.55, 0.02, a.s[1] * 0.55);
        group.add(ring);
        // a small warm sparkle sitting ON the object (reads as "something here")
        const emoji = mkSprite(sparkTex, 0.2, a.s[0] * 0.12, baseY, a.s[1] * 0.12);
        emoji.sm.blending = THREE.AdditiveBlending;
        group.add(emoji.sp);
        const badge = mkSprite(badgeTex, 0.15, a.s[0] * 0.12, baseY, a.s[1] * 0.12);
        badge.sp.visible = false;
        group.add(badge.sp);
        scene.add(group);
        const rig: StageRig = {
          group, ringMat: mat, emojiMat: emoji.sm, badge: badge.sp,
          emojiSprite: emoji.sp, accent, done: false, phase: Math.random() * Math.PI * 2, baseY,
        };
        if (spot.done) applyStageDone(rig, true);
        rigs.stages.set(spot.stageIndex, rig);
      });

      snap.pickups.forEach((pk) => {
        const a = anchorFor(pk.room, pk.hotspot);
        const group = new THREE.Group();
        group.position.set(a.p[0], 0, a.p[2]);
        const { ring, mat } = mkRing(0.16, 0.19, 0x9fe8dc, 0.4);
        ring.position.set(a.s[0] * 0.55, 0.02, a.s[1] * 0.55);
        group.add(ring);
        const s = mkSprite(sparkTex, 0.16, a.s[0] * 0.12, a.p[1] + 0.1, a.s[1] * 0.12);
        s.sm.blending = THREE.AdditiveBlending;
        group.add(s.sp);
        group.visible = !pk.collected;
        scene.add(group);
        rigs.pickups.set(pk.id, { group, ringMat: mat, phase: Math.random() * Math.PI * 2 });
      });

      {
        const ft = snap.finalTarget;
        const a = anchorFor(ft.room, ft.hotspot);
        const group = new THREE.Group();
        group.position.set(a.p[0], 0, a.p[2]);
        const locked = snap.finalLockedReason !== null;
        const { ring, mat } = mkRing(0.24, 0.28, locked ? 0x8d7c5f : 0xffc93c, 0.5);
        ring.position.set(a.s[0] * 0.55, 0.02, a.s[1] * 0.55);
        group.add(ring);
        const lockTex = makeEmojiTexture('🔒');
        const giftTex = makeEmojiTexture('🎁');
        const s = mkSprite(locked ? lockTex : giftTex, 0.17, 0, a.p[1] + 0.42, 0);
        group.add(s.sp);
        scene.add(group);
        rigs.final = { group, ringMat: mat, spriteMat: s.sm, lockTex, giftTex, locked };
      }

      rigsRef.current = rigs;
      // re-apply the freshest props (they may have changed during load)
      const cur = propsRef.current;
      cur.spots.forEach((s) => {
        const rig = rigs.stages.get(s.stageIndex);
        if (rig && rig.done !== s.done) applyStageDone(rig, s.done);
      });
      cur.pickups.forEach((pk) => {
        const rig = rigs.pickups.get(pk.id);
        if (rig) rig.group.visible = !pk.collected;
      });
      if (rigs.final) {
        const locked = cur.finalLockedReason !== null;
        if (rigs.final.locked !== locked) applyFinalLocked(rigs.final, locked);
      }
      setLoading(false);
      startInteraction({ rigs, doorRigs });
    };

    /* ================================================================ */
    /* Interaction: player, input, prompt targeting, render loop       */
    /* ================================================================ */
    let stopInteraction: (() => void) | null = null;

    const startInteraction = (ctx: { rigs: Rigs; doorRigs: DoorRig[] }) => {
      const { rigs, doorRigs } = ctx;
      // Spawn in the entrance, facing the hallway arch at (3.4, 0.0) —
      // predominantly west (-X: forward = (-sin yaw, -cos yaw) ~= (-0.95, -0.32))
      // so the first frame shows the home's depth through the arch, not the
      // blank wall segment south of it (due-west yaw pi/2 grazed the arch edge).
      const player = { x: 5.2, z: 0.6, yaw: Math.atan2(-(3.4 - 5.2), -(0.0 - 0.6)), pitch: 0 };
      const vel = { x: 0, z: 0 };
      const keys = new Set<string>();
      const joyVec = { x: 0, y: 0 };
      let lastPrompt: string | null = null;
      let lastRoom: RoomId | '' = '';
      let bobPhase = 0;
      let elapsed = 0;

      type Target =
        | { kind: 'door'; door: DoorRig }
        | { kind: 'stage'; spot: SpotProp }
        | { kind: 'pickup'; pk: PickupProp }
        | { kind: 'final' };
      const sel: { cur: Target | null } = { cur: null };

      const doInteract = () => {
        const t = sel.cur;
        if (!t) return;
        const p = propsRef.current;
        if (t.kind === 'door') {
          t.door.latch = !t.door.latch;
        } else if (t.kind === 'stage') {
          if (t.spot.done) showToastRef.current('כבר פתרתם את השלב הזה ✓');
          else p.onStage(t.spot.stageIndex);
        } else if (t.kind === 'pickup') {
          p.onPickup(t.pk.id);
        } else if (p.finalLockedReason) {
          showToastRef.current(p.finalLockedReason);
        } else {
          p.onFinal();
        }
      };
      interactRef.current = doInteract;

      /* ---- collision ---- */
      const PR = 0.32;
      const hitsAny = (x: number, z: number, list: AABB[]): boolean => {
        for (const b of list) {
          const cx = Math.max(b.x0, Math.min(x, b.x1));
          const cz = Math.max(b.z0, Math.min(z, b.z1));
          const dx = x - cx; const dz = z - cz;
          if (dx * dx + dz * dz < PR * PR) return true;
        }
        return false;
      };
      const blocked = (x: number, z: number): boolean => {
        if (hitsAny(x, z, colliders)) return true;
        for (const d of doorRigs) {
          if (d.open01 < 0.55 && hitsAny(x, z, [d.aabb])) return true;
        }
        return false;
      };

      const pushOut = () => {
        for (let iter = 0; iter < 4; iter++) {
          let moved = false;
          const all: AABB[] = colliders.slice();
          for (const d of doorRigs) if (d.open01 < 0.55) all.push(d.aabb);
          for (const b of all) {
            const cx = Math.max(b.x0, Math.min(player.x, b.x1));
            const cz = Math.max(b.z0, Math.min(player.z, b.z1));
            const dx = player.x - cx; const dz = player.z - cz;
            const d2 = dx * dx + dz * dz;
            if (d2 >= PR * PR) continue;
            if (d2 > 1e-8) {
              const d = Math.sqrt(d2); const k = (PR - d + 0.002) / d;
              player.x += dx * k; player.z += dz * k;
            } else {
              // centre is inside the box: leave through the nearest face
              const l = player.x - b.x0; const r = b.x1 - player.x;
              const t = player.z - b.z0; const bt = b.z1 - player.z;
              const m = Math.min(l, r, t, bt);
              if (m === l) player.x = b.x0 - PR - 0.002;
              else if (m === r) player.x = b.x1 + PR + 0.002;
              else if (m === t) player.z = b.z0 - PR - 0.002;
              else player.z = b.z1 + PR + 0.002;
            }
            moved = true;
          }
          if (!moved) break;
        }
      };

      /* ---- prompt DOM ---- */
      const setPrompt = (text: string | null, btnText: string) => {
        if (text === lastPrompt) return;
        lastPrompt = text;
        const bar = promptBarRef.current;
        if (promptTextRef.current) promptTextRef.current.textContent = text ?? '';
        if (interactBtnRef.current && text) interactBtnRef.current.textContent = btnText;
        if (bar) bar.classList.toggle('show', !!text);
      };

      /* ---- keyboard ---- */
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.code === 'KeyE') {
          if (!e.repeat) doInteract();
          return;
        }
        keys.add(e.code);
        if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
      };
      const onKeyUp = (e: KeyboardEvent) => { keys.delete(e.code); };
      window.addEventListener('keydown', onKeyDown);
      window.addEventListener('keyup', onKeyUp);

      /* ---- pointer look: pointer lock (mouse) + drag fallback ---- */
      let locked = false;
      let dragging = false;
      let lookId: number | null = null;
      let lastPX = 0; let lastPY = 0;
      const onPointerDown = (e: PointerEvent) => {
        if (lookId !== null && e.pointerType !== 'mouse') return;
        dragging = true;
        lookId = e.pointerId;
        lastPX = e.clientX; lastPY = e.clientY;
        if (e.pointerType === 'mouse' && !locked) {
          try {
            const r = canvas.requestPointerLock() as unknown;
            if (r && typeof (r as { catch?: unknown }).catch === 'function') {
              (r as Promise<void>).catch(() => undefined);
            }
          } catch { /* pointer lock unavailable — drag look still works */ }
        }
      };
      const onPointerMove = (e: PointerEvent) => {
        if (locked || !dragging || e.pointerId !== lookId) return;
        const dx = e.clientX - lastPX;
        const dy = e.clientY - lastPY;
        lastPX = e.clientX; lastPY = e.clientY;
        const sens = e.pointerType === 'mouse' ? 0.0042 : 0.0058;
        player.yaw -= dx * sens;
        player.pitch = THREE.MathUtils.clamp(player.pitch - dy * sens, -1.15, 1.15);
      };
      const onPointerUp = (e: PointerEvent) => {
        if (e.pointerId !== lookId) return;
        dragging = false; lookId = null;
      };
      const onMouseMoveLock = (e: MouseEvent) => {
        if (!locked) return;
        player.yaw -= e.movementX * 0.0022;
        player.pitch = THREE.MathUtils.clamp(player.pitch - e.movementY * 0.0022, -1.15, 1.15);
      };
      const onLockChange = () => { locked = document.pointerLockElement === canvas; };
      canvas.style.touchAction = 'none';
      canvas.addEventListener('pointerdown', onPointerDown);
      window.addEventListener('pointermove', onPointerMove);
      window.addEventListener('pointerup', onPointerUp);
      window.addEventListener('pointercancel', onPointerUp);
      document.addEventListener('mousemove', onMouseMoveLock);
      document.addEventListener('pointerlockchange', onLockChange);

      /* ---- virtual joystick (touch) ---- */
      const joyBase = joyBaseRef.current;
      const joyKnob = joyKnobRef.current;
      let joyId: number | null = null;
      const joyReset = () => {
        joyVec.x = 0; joyVec.y = 0;
        if (joyKnob) joyKnob.style.transform = 'translate(-50%, -50%)';
      };
      const onJoyDown = (e: PointerEvent) => {
        e.preventDefault(); e.stopPropagation();
        joyId = e.pointerId;
        joyBase?.setPointerCapture(e.pointerId);
        onJoyMove(e);
      };
      const onJoyMove = (e: PointerEvent) => {
        if (joyId !== e.pointerId || !joyBase) return;
        const rect = joyBase.getBoundingClientRect();
        let dx = e.clientX - (rect.left + rect.width / 2);
        let dy = e.clientY - (rect.top + rect.height / 2);
        const mag = Math.hypot(dx, dy);
        const max = 40;
        if (mag > max) { dx = (dx / mag) * max; dy = (dy / mag) * max; }
        if (joyKnob) joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
        const nx = dx / max; const ny = dy / max;
        if (Math.hypot(nx, ny) < 0.12) { joyVec.x = 0; joyVec.y = 0; } else { joyVec.x = nx; joyVec.y = ny; }
      };
      const onJoyUp = (e: PointerEvent) => {
        if (joyId === e.pointerId) { joyId = null; joyReset(); }
      };
      if (joyBase) {
        joyBase.style.touchAction = 'none';
        joyBase.addEventListener('pointerdown', onJoyDown);
        joyBase.addEventListener('pointermove', onJoyMove);
        joyBase.addEventListener('pointerup', onJoyUp);
        joyBase.addEventListener('pointercancel', onJoyUp);
      }

      /* ---- resize / visibility ---- */
      const onResize = () => {
        const w = mount.clientWidth || width;
        const h = mount.clientHeight || height;
        camera.aspect = w / h;
        camera.fov = fovFor(w / h);
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
      };
      window.addEventListener('resize', onResize);
      const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(onResize) : null;
      ro?.observe(mount);

      /* ---- debug hooks (automated verification) ---- */
      interface HouseDebug {
        teleport(room: RoomId): void;
        teleportToHotspot(room: RoomId, hotspot: string): void;
        interact(): void;
        unreachable(): string[];
        prompt(): string | null;
        pos(): { x: number; z: number; room: RoomId };
      }
      const dbg: HouseDebug = {
        teleport(room: RoomId) {
          const [cx, cz] = ROOM_CENTERS[room];
          const [fx, fz] = ROOM_FOCAL[room];
          player.x = cx; player.z = cz;
          player.yaw = Math.atan2(-(fx - cx), -(fz - cz));
          player.pitch = 0;
          vel.x = 0; vel.z = 0;
        },
        teleportToHotspot(room: RoomId, hotspot: string) {
          const a = anchorFor(room, hotspot);
          player.x = a.p[0] + a.s[0] * 1.2;
          player.z = a.p[2] + a.s[1] * 1.2;
          player.yaw = Math.atan2(-(a.p[0] - player.x), -(a.p[2] - player.z));
          player.pitch = 0;
          vel.x = 0; vel.z = 0;
          pushOut();
        },
        interact() { doInteract(); },
        /** Flood-fill the walkable floor from the spawn (doors open) and
            report every room centre / hotspot the player can NOT walk to. */
        unreachable() {
          const step = 0.1; const key = (i: number, j: number) => i * 1000 + j;
          const seen = new Set<number>();
          const free = (x: number, z: number) => !hitsAny(x, z, colliders) && Math.abs(x) <= 6.3 && Math.abs(z) <= 4.8;
          const q: [number, number][] = [[Math.round(5.2 / step), Math.round(0.6 / step)]];
          seen.add(key(q[0][0] + 500, q[0][1] + 500));
          while (q.length) {
            const [i, j] = q.pop() as [number, number];
            for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
              const ni = i + di; const nj = j + dj; const k = key(ni + 500, nj + 500);
              if (seen.has(k) || !free(ni * step, nj * step)) continue;
              seen.add(k); q.push([ni, nj]);
            }
          }
          const near = (x: number, z: number, r: number) => {
            const n = Math.ceil(r / step);
            for (let a = -n; a <= n; a++) for (let b = -n; b <= n; b++) {
              if (seen.has(key(Math.round(x / step) + a + 500, Math.round(z / step) + b + 500))) return true;
            }
            return false;
          };
          (window as unknown as { __reachMap?: string }).__reachMap = Array.from({ length: 97 }, (_, r) =>
            Array.from({ length: 127 }, (_, c) => {
              const x = (c - 63) * step; const z = (r - 48) * step;
              return seen.has(key(Math.round(x / step) + 500, Math.round(z / step) + 500)) ? '.' : (free(x, z) ? 'o' : '#');
            }).join('')).join('\n');
          (window as unknown as { __colliders?: AABB[] }).__colliders = colliders;
          const bad: string[] = [];
          (Object.keys(ROOM_CENTERS) as RoomId[]).forEach((r) => { if (!near(ROOM_CENTERS[r][0], ROOM_CENTERS[r][1], 0.6)) bad.push(`room:${r}`); });
          // a hotspot is usable when some walkable cell is within prompt range (2.3 m in 3D)
          Object.entries(ANCHORS).forEach(([id, a]) => {
            const r = Math.sqrt(Math.max(0, 2.1 * 2.1 - (1.6 - a.p[1]) * (1.6 - a.p[1])));
            const n = Math.ceil(r / step); let ok = false;
            for (let u = -n; u <= n && !ok; u++) for (let v = -n; v <= n && !ok; v++) {
              if (u * u + v * v > n * n) continue;
              ok = seen.has(key(Math.round(a.p[0] / step) + u + 500, Math.round(a.p[2] / step) + v + 500));
            }
            if (!ok) bad.push(id);
          });
          return bad;
        },
        prompt() { return lastPrompt; },
        pos() { return { x: player.x, z: player.z, room: roomAt(player.x, player.z) }; },
      };
      (window as unknown as { __escapeHouse?: HouseDebug }).__escapeHouse = dbg;

      /* ---- render loop ---- */
      const clock = new THREE.Clock();
      const tmpV = new THREE.Vector3();
      let raf = 0;
      let running = true;
      let perfT = 0; let perfN = 0; let curPR = renderer.getPixelRatio();

      const loop = () => {
        if (!running) return;
        raf = requestAnimationFrame(loop);
        const dt = Math.min(clock.getDelta(), 0.05);
        elapsed += dt;
        const p = propsRef.current;

        /* doors: auto-open near the player, latch via interact */
        for (const d of doorRigs) {
          const dist = Math.hypot(player.x - d.cx, player.z - d.cz);
          const target = dist < 1.15 || d.latch ? 1 : 0;
          d.open01 += (target - d.open01) * Math.min(1, dt * 5.5);
          if (Math.abs(d.open01 - target) < 0.003) d.open01 = target;
          d.node.rotation.y = d.swing * d.open01 * 1.85;
        }

        /* movement */
        let f = 0; let s = 0;
        if (keys.has('KeyW') || keys.has('ArrowUp')) f += 1;
        if (keys.has('KeyS') || keys.has('ArrowDown')) f -= 1;
        if (keys.has('KeyD') || keys.has('ArrowRight')) s += 1;
        if (keys.has('KeyA') || keys.has('ArrowLeft')) s -= 1;
        f += -joyVec.y;
        s += joyVec.x;
        const len = Math.hypot(f, s);
        if (len > 1) { f /= len; s /= len; }
        const speed = keys.has('ShiftLeft') || keys.has('ShiftRight') ? 4.2 : 2.6;
        const sin = Math.sin(player.yaw); const cos = Math.cos(player.yaw);
        const wantX = (-sin * f + cos * s) * speed;
        const wantZ = (-cos * f - sin * s) * speed;
        const blend = Math.min(1, dt * 10);
        vel.x += (wantX - vel.x) * blend;
        vel.z += (wantZ - vel.z) * blend;
        // Never let an overlap turn into "walk through everything": if the
        // player ever overlaps a collider (teleport, door closing), push
        // them back out along the shortest exit instead.
        pushOut();
        const nx = player.x + vel.x * dt;
        if (!blocked(nx, player.z)) player.x = nx; else vel.x = 0;
        const nz = player.z + vel.z * dt;
        if (!blocked(player.x, nz)) player.z = nz; else vel.z = 0;
        player.x = THREE.MathUtils.clamp(player.x, -6.3, 6.3);
        player.z = THREE.MathUtils.clamp(player.z, -4.8, 4.8);

        const moving = Math.hypot(vel.x, vel.z) > 0.4;
        if (moving) bobPhase += dt * speed * 2.1;
        camera.position.set(player.x, 1.6 + (moving ? Math.sin(bobPhase) * 0.022 : 0), player.z);
        camera.rotation.y = player.yaw;
        camera.rotation.x = player.pitch;

        /* current room label */
        const rid = roomAt(player.x, player.z);
        if (rid !== lastRoom) {
          lastRoom = rid;
          const [scx, scz] = ROOM_CENTERS[rid];
          spot.position.set(scx, 2.62, scz);
          spot.target.position.set(scx + 0.02, 0, scz + 0.02);
          if (roomNameRef.current) {
            roomNameRef.current.textContent = `${ROOM_MAP[rid].emoji} ${ROOM_MAP[rid].label}`;
          }
        }

        /* nearest interactable */
        let bestScore = Infinity;
        let bestTarget: Target | null = null;
        let bestText = '';
        let bestBtn = '';
        for (const d of doorRigs) {
          const dist = Math.hypot(player.x - d.cx, player.z - d.cz);
          if (dist <= 1.6) {
            // Doors are ambient: any stage / pickup / final target in range
            // (score <= 2.3) always wins the prompt — e.g. the hallway
            // picture's stand point lands right in the bedroom doorway.
            // The door stays reachable wherever nothing else competes.
            const score = dist + 2.5;
            if (score < bestScore) {
              bestScore = score;
              bestTarget = { kind: 'door', door: d };
              bestText = '✨ 🚪 הדלת';
              bestBtn = d.latch || d.open01 > 0.5 ? '🖐️ סגירה' : '🖐️ פתיחה';
            }
          }
        }
        for (const spotProp of p.spots) {
          const a = anchorFor(spotProp.room, spotProp.hotspot);
          const dist = camera.position.distanceTo(tmpV.set(a.p[0], a.p[1], a.p[2]));
          if (dist > 2.3) continue;
          const score = dist + (spotProp.done ? 0.6 : 0);
          if (score < bestScore) {
            bestScore = score;
            bestTarget = { kind: 'stage', spot: spotProp };
            bestText = spotProp.done ? `✓ ${spotProp.emoji} ${spotProp.title} — הושלם` : `✨ ${spotProp.emoji} ${spotProp.title}`;
            bestBtn = spotProp.done ? '🖐️ בדיקה' : '🖐️ למשימה';
          }
        }
        for (const pk of p.pickups) {
          if (pk.collected) continue;
          const a = anchorFor(pk.room, pk.hotspot);
          const dist = camera.position.distanceTo(tmpV.set(a.p[0], a.p[1], a.p[2]));
          if (dist > 2.3) continue;
          if (dist < bestScore) {
            bestScore = dist;
            bestTarget = { kind: 'pickup', pk };
            const hd = hotspotDef(pk.room, pk.hotspot);
            bestText = `✨ 🔍 ${hd.label}${pk.itemLabel ? ` · ${pk.itemLabel}` : ''}`;
            bestBtn = '🖐️ חיפוש';
          }
        }
        {
          const ft = p.finalTarget;
          const a = anchorFor(ft.room, ft.hotspot);
          const dist = camera.position.distanceTo(tmpV.set(a.p[0], a.p[1], a.p[2]));
          if (dist <= 2.3 && dist < bestScore) {
            bestScore = dist;
            bestTarget = { kind: 'final' };
            bestText = p.finalLockedReason ? `✨ 🔒 ${ft.label}` : `✨ 🎁 ${ft.label}`;
            bestBtn = '🖐️ פתיחה';
          }
        }
        sel.cur = bestTarget;
        setPrompt(bestTarget ? bestText : null, bestBtn);

        /* rig pulses */
        rigs.stages.forEach((rig) => {
          if (!rig.done) {
            rig.ringMat.opacity = 0.3 + Math.sin(elapsed * 3 + rig.phase) * 0.14;
            const k = 0.2 + Math.sin(elapsed * 2.4 + rig.phase) * 0.05;
            rig.emojiSprite.scale.set(k, k, 1);
            rig.emojiMat.rotation = elapsed * 0.5 + rig.phase;
          }
        });
        rigs.pickups.forEach((rig) => {
          rig.ringMat.opacity = 0.3 + Math.sin(elapsed * 3.2 + rig.phase) * 0.15;
        });
        if (rigs.final) {
          rigs.final.ringMat.opacity = rigs.final.locked
            ? 0.35 + Math.sin(elapsed * 2) * 0.1
            : 0.6 + Math.sin(elapsed * 4.2) * 0.28;
        }

        renderer.render(scene, camera);

        /* adaptive resolution: weak phones drop pixel ratio instead of frame rate */
        perfT += dt; perfN++;
        if (perfT >= 2) {
          const fps = perfN / perfT; perfT = 0; perfN = 0;
          if (fps < 26 && curPR > 0.75 && elapsed > 3 && !navigator.webdriver) {
            curPR = Math.max(0.75, curPR - 0.25);
            renderer.setPixelRatio(curPR);
            onResize();
          }
        }
      };

      const startLoop = () => {
        if (running) return;
        running = true;
        clock.start();
        raf = requestAnimationFrame(loop);
      };
      const stopLoop = () => {
        running = false;
        cancelAnimationFrame(raf);
      };
      const onVisibility = () => {
        if (document.hidden) stopLoop();
        else startLoop();
      };
      document.addEventListener('visibilitychange', onVisibility);
      running = true;
      raf = requestAnimationFrame(loop);

      stopInteraction = () => {
        stopLoop();
        document.removeEventListener('visibilitychange', onVisibility);
        window.removeEventListener('keydown', onKeyDown);
        window.removeEventListener('keyup', onKeyUp);
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerup', onPointerUp);
        window.removeEventListener('pointercancel', onPointerUp);
        window.removeEventListener('resize', onResize);
        ro?.disconnect();
        document.removeEventListener('mousemove', onMouseMoveLock);
        document.removeEventListener('pointerlockchange', onLockChange);
        canvas.removeEventListener('pointerdown', onPointerDown);
        if (joyBase) {
          joyBase.removeEventListener('pointerdown', onJoyDown);
          joyBase.removeEventListener('pointermove', onJoyMove);
          joyBase.removeEventListener('pointerup', onJoyUp);
          joyBase.removeEventListener('pointercancel', onJoyUp);
        }
        if (document.pointerLockElement === canvas) document.exitPointerLock();
        delete (window as unknown as { __escapeHouse?: HouseDebug }).__escapeHouse;
        if (interactRef.current === doInteract) interactRef.current = () => undefined;
      };
    };

    void buildAll();

    return () => {
      disposed = true;
      if (stopInteraction) stopInteraction();
      disposeObject(scene);
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch { /* ignore */ }
      if (canvas.parentElement === mount) mount.removeChild(canvas);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="house3d" data-testid="house-3d">
      <div ref={mountRef} className="house3d-canvas" aria-hidden="true" />
      <div className="house3d-top">
        <div className="house3d-toprow">
          {props.onExit ? (
            <button type="button" className="house3d-exit" onClick={props.onExit} aria-label="יציאה">✕</button>
          ) : null}
          <div className="house3d-goal" title={props.goal}>🎯 {props.goal}</div>
        </div>
        <div className="house3d-subrow">
          <span className="house3d-room" ref={roomNameRef}>
            {ROOM_MAP.entrance.emoji} {ROOM_MAP.entrance.label}
          </span>
          <div className="house3d-chips">
            {props.spots.map((s) => (
              <span key={s.stageIndex} className={s.done ? 'house3d-chip done' : 'house3d-chip'} title={s.title}>
                {s.done ? '✓' : s.stageIndex + 1} {s.emoji}
              </span>
            ))}
            <span className={props.finalLockedReason ? 'house3d-chip final-locked' : 'house3d-chip final-ready'}>
              {props.finalLockedReason ? '🔒' : '🎁'}
            </span>
          </div>
        </div>
        {props.inventory ? (
          <div className="house3d-inv" data-testid="inventory-bar">
            <span className="house3d-inv-title">🎒</span>
            {props.inventory.length === 0
              ? <span className="house3d-inv-empty">התיק ריק — חפשו פריטים בבית</span>
              : props.inventory.map((it) => (
                <span key={it.id} className="house3d-inv-chip">{it.emoji} {it.label}</span>
              ))}
          </div>
        ) : null}
      </div>
      <div className="house3d-promptbar" ref={promptBarRef}>
        <div className="house3d-prompt" data-testid="house-prompt" ref={promptTextRef} />
        <button
          type="button"
          className="house3d-interact"
          data-testid="house-interact"
          ref={interactBtnRef}
          onClick={() => interactRef.current()}
        >
          🖐️ פעולה
        </button>
      </div>
      {touchUi ? (
        <div className="house3d-joy" ref={joyBaseRef}>
          <div className="house3d-joy-knob" ref={joyKnobRef} />
        </div>
      ) : null}
      {touchUi ? <div className="house3d-lookhint">גררו על המסך כדי להסתכל מסביב 👆</div> : null}
      <div className="house3d-help">⌨️ WASD / חצים לתנועה · 🖱️ גרירה או לחיצה לנעילת מצביע · E לפעולה · Shift לריצה</div>
      <div className="house3d-toast" ref={toastRef} role="status" />
      {loading ? (
        <div className="house3d-loading">
          <div className="house3d-loading-card">🏠 טוען את הבית…</div>
        </div>
      ) : null}
    </div>
  );
}
