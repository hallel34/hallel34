/**
 * houseDecor.ts — v6 MODELING-ONLY uplift.
 *
 * Purely visual enrichment for House3D: architecture trim, bookshelf wall,
 * kitchen/dining dressing, and lived-in density for every other room.
 * Nothing here touches gameplay: no anchors, no colliders (except none at
 * all — decor never blocks movement), no interaction state. All repeated
 * small items use InstancedMesh; materials/geometries are shared.
 */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import {
  makeDoormatTexture, makeFridgeCollageTexture, makePaperNoteTexture,
  makeRunnerTexture, makeTowelTexture, PHOTO, makePhotoTexture,
} from './canvasTextures';

/* Deterministic RNG so every build of the house looks identical. */
function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261112);
const rr = (lo: number, hi: number) => lo + rand() * (hi - lo);

/* ---------------- shared materials ---------------- */
const M = {
  trim: new THREE.MeshStandardMaterial({ color: 0xf5efe2, roughness: 0.85 }),
  trimWood: new THREE.MeshStandardMaterial({ color: 0x6b4a2c, roughness: 0.7 }),
  darkWood: new THREE.MeshStandardMaterial({ color: 0x4a3220, roughness: 0.75 }),
  shelfWood: new THREE.MeshStandardMaterial({ color: 0x7a5636, roughness: 0.8 }),
  brass: new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.85, roughness: 0.3 }),
  steel: new THREE.MeshStandardMaterial({ color: 0xb9bfc4, metalness: 0.85, roughness: 0.3 }),
  darkMetal: new THREE.MeshStandardMaterial({ color: 0x2e3236, metalness: 0.7, roughness: 0.45 }),
  ceramic: new THREE.MeshStandardMaterial({ color: 0xf7f4ec, roughness: 0.35 }),
  fabricCream: new THREE.MeshStandardMaterial({ color: 0xe9dfc9, roughness: 1, side: THREE.DoubleSide }),
  fabricSage: new THREE.MeshStandardMaterial({ color: 0xa9b79a, roughness: 1, side: THREE.DoubleSide }),
  leaf: new THREE.MeshStandardMaterial({ color: 0x4a7a3f, roughness: 0.9 }),
  pot: new THREE.MeshStandardMaterial({ color: 0xa85f3a, roughness: 0.85 }),
  paper: new THREE.MeshStandardMaterial({ color: 0xfffdf2, roughness: 0.9 }),
};

const boxGeo = new THREE.BoxGeometry(1, 1, 1);
function box(
  parent: THREE.Object3D, w: number, h: number, d: number,
  x: number, y: number, z: number, mat: THREE.Material,
  opts: { rotY?: number; rotX?: number; rotZ?: number; shadow?: boolean } = {},
): THREE.Mesh {
  const m = new THREE.Mesh(boxGeo, mat);
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  if (opts.rotY) m.rotation.y = opts.rotY;
  if (opts.rotX) m.rotation.x = opts.rotX;
  if (opts.rotZ) m.rotation.z = opts.rotZ;
  if (opts.shadow) { m.castShadow = true; m.receiveShadow = true; }
  parent.add(m);
  return m;
}
function cyl(
  parent: THREE.Object3D, rTop: number, rBot: number, h: number, seg: number,
  x: number, y: number, z: number, mat: THREE.Material,
  opts: { rotX?: number; rotZ?: number; shadow?: boolean } = {},
): THREE.Mesh {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, h, seg), mat);
  m.position.set(x, y, z);
  if (opts.rotX) m.rotation.x = opts.rotX;
  if (opts.rotZ) m.rotation.z = opts.rotZ;
  if (opts.shadow) m.castShadow = true;
  parent.add(m);
  return m;
}
/** Vertical cloth plane with sine-wave folds (curtains, towels, throws). */
function wavyPlane(
  w: number, h: number, folds: number, amp: number, mat: THREE.Material,
): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(w, h, 20, 6);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    pos.setZ(i, Math.sin((x / w + 0.5) * Math.PI * 2 * folds) * amp);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}
function smallPlant(parent: THREE.Object3D, x: number, y: number, z: number, s = 1) {
  const g = new THREE.Group();
  cyl(g, 0.055 * s, 0.04 * s, 0.09 * s, 12, 0, 0.045 * s, 0, M.pot);
  const leafGeo = new THREE.SphereGeometry(0.05 * s, 7, 6);
  for (let i = 0; i < 6; i++) {
    const leaf = new THREE.Mesh(leafGeo, M.leaf);
    const a = (i / 6) * Math.PI * 2;
    leaf.position.set(Math.cos(a) * 0.035 * s, (0.13 + (i % 3) * 0.03) * s, Math.sin(a) * 0.035 * s);
    leaf.scale.set(0.6, 1.5, 0.6);
    leaf.rotation.z = Math.cos(a) * 0.5;
    leaf.rotation.x = -Math.sin(a) * 0.5;
    g.add(leaf);
  }
  g.position.set(x, y, z);
  parent.add(g);
  return g;
}
function bookStack(parent: THREE.Object3D, x: number, y: number, z: number, n: number, s = 1) {
  const cols = [0xa34a2a, 0x2a6d8a, 0x5b8c5a, 0xc99700, 0x7a4a8c, 0x44586e];
  let cy = y;
  for (let i = 0; i < n; i++) {
    const h = rr(0.028, 0.04) * s;
    const mat = new THREE.MeshStandardMaterial({ color: cols[Math.floor(rand() * cols.length)], roughness: 0.85 });
    box(parent, rr(0.2, 0.26) * s, h, rr(0.14, 0.18) * s, x + rr(-0.012, 0.012), cy + h / 2, z + rr(-0.012, 0.012), mat, { rotY: rr(-0.22, 0.22), shadow: true });
    cy += h;
  }
  return cy;
}
function mug(parent: THREE.Object3D, x: number, y: number, z: number, color: number) {
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4 });
  cyl(parent, 0.035, 0.03, 0.08, 14, x, y + 0.04, z, mat);
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.024, 0.006, 8, 16), mat);
  handle.position.set(x + 0.04, y + 0.04, z);
  parent.add(handle);
}

/* ================================================================== */
/* A) ARCHITECTURE                                                     */
/* ================================================================== */
interface SegX { z: number; x0: number; x1: number; side: 1 | -1 }
interface SegZ { x: number; z0: number; z1: number; side: 1 | -1 }

export function buildArchitecture(scene: THREE.Scene): void {
  const g = new THREE.Group();
  scene.add(g);
  const BH = 0.09; // baseboard height
  const BT = 0.018;

  /* ---- baseboards: outer perimeter (inward faces) ---- */
  const segX: SegX[] = [
    { z: -4.92, x0: -6.42, x1: 6.42, side: 1 },   // north wall, faces south
    { z: 4.92, x0: -6.42, x1: 6.42, side: -1 },   // south wall, faces north
  ];
  const segZ: SegZ[] = [
    { x: -6.42, z0: -4.92, z1: 4.92, side: 1 },   // west wall, faces east
    { x: 6.42, z0: -4.92, z1: 4.92, side: -1 },   // east wall, faces west
  ];
  /* partitions — both faces, split around door/arch gaps */
  const partX = (z: number, gaps: [number, number][]) => {
    // wall at z spanning x -6.5..6.5 (clipped per-room below via gaps list only)
    let spans: [number, number][] = [[-6.42, 6.42]];
    gaps.forEach(([a, b]) => {
      const next: [number, number][] = [];
      spans.forEach(([s0, s1]) => {
        if (b <= s0 || a >= s1) { next.push([s0, s1]); return; }
        if (a > s0) next.push([s0, a]);
        if (b < s1) next.push([b, s1]);
      });
      spans = next;
    });
    spans.forEach(([a, b]) => {
      if (b - a < 0.05) return;
      segX.push({ z, x0: a, x1: b, side: 1 }, { z, x0: a, x1: b, side: -1 });
    });
  };
  const partZ = (x: number, z0: number, z1: number, gaps: [number, number][]) => {
    let spans: [number, number][] = [[z0, z1]];
    gaps.forEach(([a, b]) => {
      const next: [number, number][] = [];
      spans.forEach(([s0, s1]) => {
        if (b <= s0 || a >= s1) { next.push([s0, s1]); return; }
        if (a > s0) next.push([s0, a]);
        if (b < s1) next.push([b, s1]);
      });
      spans = next;
    });
    spans.forEach(([a, b]) => {
      if (b - a < 0.05) return;
      segZ.push({ x, z0: a, z1: b, side: 1 }, { x, z0: a, z1: b, side: -1 });
    });
  };
  // z=0.8 partition only spans x -6.5..3.4 — emulate with a gap over the rest
  partX(0.8, [[-4.28, -3.32], [0.52, 1.48], [3.4, 6.5]]);
  partX(-0.8, [[0.12, 1.08], [4.52, 5.48], [-6.5, -1.2]]);
  partX(2.0, [[4.52, 5.48], [-6.5, 3.4]]);
  partZ(-1.2, -4.92, 4.92, [[-2.65, -1.15], [-0.48, 0.48]]);
  partZ(3.4, -0.72, 4.92, [[-0.7, 0.7]]);
  // dedupe the clipped-away spans partX added beyond real wall extents:
  // (they sit inside solid rooms against no wall — filter by room adjacency)
  const keepX = (s: SegX): boolean => {
    if (s.z === 0.8) return s.x1 > -6.5 && s.x0 < 3.4;
    if (s.z === -0.8) return s.x1 > -1.2 && s.x0 < 6.5;
    if (s.z === 2.0) return s.x1 > 3.4 && s.x0 < 6.5;
    return true;
  };
  segX.filter(keepX).forEach((s) => {
    const len = s.x1 - s.x0;
    box(g, len, BH, BT, (s.x0 + s.x1) / 2, BH / 2, s.z + s.side * (0.075 + BT / 2), M.trim);
  });
  segZ.forEach((s) => {
    const len = s.z1 - s.z0;
    box(g, BT, BH, len, s.x + s.side * (0.075 + BT / 2), BH / 2, (s.z0 + s.z1) / 2, M.trim);
  });

  /* ---- door architraves + thresholds ----
     Doors (center, wall axis): axis 'x' = wall runs along X (door in a
     z=const wall), axis 'z' = wall runs along Z. Trim on BOTH faces. */
  const doors: { c: [number, number]; axis: 'x' | 'z'; w: number; h: number }[] = [
    { c: [-3.8, 0.8], axis: 'x', w: 0.95, h: 2.1 },
    { c: [1.0, 0.8], axis: 'x', w: 0.95, h: 2.1 },
    { c: [0.6, -0.8], axis: 'x', w: 0.95, h: 2.1 },
    { c: [5.0, -0.8], axis: 'x', w: 0.95, h: 2.1 },
    { c: [5.6, 2.0], axis: 'x', w: 0.95, h: 2.1 },
    { c: [-1.2, 0.0], axis: 'z', w: 0.95, h: 2.1 },
    { c: [-1.2, -1.9], axis: 'z', w: 1.5, h: 2.2 },  // arch living<->kitchen
    { c: [3.4, 0.0], axis: 'z', w: 1.4, h: 2.2 },   // arch hallway<->entrance
  ];
  doors.forEach(({ c: [cx, cz], axis, w, h }) => {
    [1, -1].forEach((side) => {
      const off = side * 0.095;
      if (axis === 'x') {
        box(g, 0.09, h, 0.03, cx - w / 2 - 0.045, h / 2, cz + off, M.trim);
        box(g, 0.09, h, 0.03, cx + w / 2 + 0.045, h / 2, cz + off, M.trim);
        box(g, w + 0.18, 0.09, 0.03, cx, h + 0.045, cz + off, M.trim);
      } else {
        box(g, 0.03, h, 0.09, cx + off, h / 2, cz - w / 2 - 0.045, M.trim);
        box(g, 0.03, h, 0.09, cx + off, h / 2, cz + w / 2 + 0.045, M.trim);
        box(g, 0.03, 0.09, w + 0.18, cx + off, h + 0.045, cz, M.trim);
      }
    });
    // threshold strip on the floor
    if (axis === 'x') box(g, w, 0.016, 0.2, cx, 0.008, cz, M.brass);
    else box(g, 0.2, 0.016, w, cx, 0.008, cz, M.brass);
  });
  /* front door (static, east wall): frame + panel insets + lever handle */
  {
    [0.6].forEach((fz) => {
      box(g, 0.03, 2.1, 0.09, 6.4, 1.05, fz - 0.55, M.trim);
      box(g, 0.03, 2.1, 0.09, 6.4, 1.05, fz + 0.55, M.trim);
      box(g, 0.03, 0.09, 1.19, 6.4, 2.15, fz, M.trim);
    });
    const doorFaceX = 6.36;
    // two recessed-look panels (proud thin frames) on the door leaf
    [[1.52, 0.62, 0.72], [0.62, 0.5, 0.86]].forEach(([py, ph, pw]) => {
      box(g, 0.015, ph, pw, doorFaceX, py, 0.6, M.trimWood);
      box(g, 0.02, ph - 0.12, pw - 0.12, doorFaceX - 0.002, py, 0.6,
        new THREE.MeshStandardMaterial({ color: 0x5d3f24, roughness: 0.65 }));
    });
    const lever = new THREE.Group();
    cyl(lever, 0.016, 0.016, 0.05, 10, 0, 0, 0, M.steel, { rotX: Math.PI / 2 });
    const arm = box(lever, 0.02, 0.025, 0.13, 0, 0, -0.08, M.steel);
    arm.position.x = -0.01;
    lever.position.set(6.33, 1.02, 0.22);
    g.add(lever);
  }

  /* ---- window sills + deeper outer frames (existing panes stay) ---- */
  const sill = (x: number, z: number, rotY: number, w: number) => {
    const grp = new THREE.Group();
    box(grp, w + 0.24, 0.045, 0.14, 0, 0, 0.05, M.trim, { shadow: true });
    grp.position.set(x, 0.93, z);
    grp.rotation.y = rotY;
    g.add(grp);
  };
  sill(-6.4, -4.55, Math.PI / 2, 1.1);
  sill(-6.4, -0.1, Math.PI / 2, 1.1);
  sill(-2.3, -4.9, 0, 1.1);
  sill(-6.4, 1.35, Math.PI / 2, 1.1);
  sill(0.2, 4.9, Math.PI, 1.1);

  /* ---- living-room curtains: rod + folded drapes ---- */
  const curtain = (x: number, z: number, rotY: number, w: number) => {
    const grp = new THREE.Group();
    const rodMat = M.darkMetal;
    const rod = cyl(grp, 0.014, 0.014, w + 0.5, 10, 0, 0, 0, rodMat, { rotZ: Math.PI / 2 });
    rod.rotation.z = Math.PI / 2;
    [-1, 1].forEach((s) => {
      const drape = wavyPlane(w * 0.34, 1.62, 5, 0.035, M.fabricCream);
      drape.position.set(s * (w / 2 - w * 0.15), -0.84, 0.1);
      grp.add(drape);
      const tie = box(grp, w * 0.3, 0.035, 0.1, s * (w / 2 - w * 0.15), -1.05, 0.1, M.trimWood);
      tie.rotation.y = 0;
    });
    grp.position.set(x, 2.32, z);
    grp.rotation.y = rotY;
    g.add(grp);
  };
  curtain(-6.34, -4.55, Math.PI / 2, 1.1);
  curtain(-6.34, -0.1, Math.PI / 2, 1.1);
  curtain(-2.3, -4.84, 0, 1.1);

  /* ---- ceiling: living-room beams + cove strips in hero rooms ---- */
  [-5.6, -3.85, -2.1].forEach((bx) => {
    box(g, 0.18, 0.15, 5.7, bx, 2.62, -2.1, M.darkWood, { shadow: true });
  });
  // cove strips (thin ledge at wall tops) — living + kitchen north/east runs
  box(g, 5.3, 0.05, 0.09, -3.85, 2.6, -4.9, M.trim);
  box(g, 5.3, 0.05, 0.09, -3.85, 2.6, 0.72, M.trim);
  box(g, 7.7, 0.05, 0.09, 2.65, 2.6, -4.9, M.trim);
  box(g, 0.09, 0.05, 4.2, 6.42, 2.6, -2.9, M.trim);
}

/* ================================================================== */
/* B) BOOKSHELF WALL — instanced books                                 */
/* ================================================================== */
const BOOK_COLORS = [
  0x8c3b2a, 0x2a5a74, 0xb8860b, 0x4a6741, 0x6b4a7a, 0x94502e, 0x374f63,
  0x7a2e35, 0x51683c, 0x9a7b2d, 0x5d6e8c, 0x84452f, 0x3f6157, 0xa06844,
  0x704214, 0x495867, 0x87764a, 0x63393e, 0x2f4858, 0x86615c,
];
interface BookSpot { x: number; y: number; z: number; alongZ: boolean; h: number; w: number; d: number; tilt: number; color: number }

export function buildBookshelfWall(scene: THREE.Scene): void {
  const g = new THREE.Group();
  scene.add(g);

  /* Backing panel + side uprights behind the Kenney units, so gaps read
     as one built-in library wall instead of three separate shelves.
     (Measured from the GLB: each unit is 0.8 m wide × 1.76 m tall at
     scale 2 — the three units span z −4.0…−1.4, x −6.42…−5.92.) */
  box(g, 0.05, 1.83, 2.75, -6.44, 0.915, -2.7, M.shelfWood);
  [-4.04, -1.36].forEach((uz) => box(g, 0.3, 1.83, 0.06, -6.28, 0.915, uz, M.shelfWood));
  box(g, 0.3, 0.07, 2.75, -6.28, 1.79, -2.7, M.shelfWood);
  box(g, 0.3, 0.06, 2.75, -6.28, 0.06, -2.7, M.shelfWood); // plinth

  const spots: BookSpot[] = [];
  /* Shelf floors measured from the GLB vertex data (world = local ×2):
     0.26 / 0.74 / 1.22, each opening 0.42 high. Interiors are 0.64 wide
     per unit (uprights between them hold no books). */
  const levels = [0.26, 0.74, 1.22];
  const runs: [number, number][] = [[-3.9, -3.3], [-3.0, -2.4], [-2.1, -1.5]];
  levels.forEach((base, li) => {
    runs.forEach(([z0, z1], ri) => {
      let z = z0;
      while (z < z1 - 0.03) {
        const roll = rand();
        if (roll < 0.07) { z += rr(0.06, 0.12); continue; } // breathing gap
        if (roll < 0.12 && z1 - z > 0.3) {
          // horizontal stack of 2-3 lying books
          const sw = rr(0.22, 0.28);
          let sy = base;
          const n = 2 + Math.floor(rand() * 2);
          for (let i = 0; i < n; i++) {
            const bh = rr(0.03, 0.042);
            spots.push({
              x: -6.2, y: sy + bh / 2, z: z + sw / 2, alongZ: true,
              h: sw, w: bh, d: rr(0.17, 0.2), tilt: 0,
              color: BOOK_COLORS[Math.floor(rand() * BOOK_COLORS.length)],
            });
            sy += bh;
          }
          z += sw + rr(0.02, 0.05);
          continue;
        }
        const bw = rr(0.028, 0.052);
        const bh = rr(0.24, 0.38);
        // keep the middle unit's centre clear for the wooden puzzle box
        if (li === 1 && ri === 1 && z + bw > -2.9 && z < -2.5) { z += bw + 0.01; continue; }
        spots.push({
          x: -6.21 + rr(-0.008, 0.008), y: base + bh / 2, z: z + bw / 2, alongZ: true,
          h: bh, w: bw, d: rr(0.18, 0.24),
          tilt: rand() < 0.06 ? rr(0.1, 0.18) * (rand() < 0.5 ? -1 : 1) : 0,
          color: BOOK_COLORS[Math.floor(rand() * BOOK_COLORS.length)],
        });
        z += bw + rr(0.001, 0.006);
      }
    });
  });
  /* kids' toy-shelf: one low row of upright books (faces north, front -Z) */
  {
    let x = -4.96;
    while (x < -4.28) {
      const bw = rr(0.026, 0.045);
      const bh = rr(0.2, 0.3);
      spots.push({
        x: x + bw / 2, y: 0.26 + bh / 2, z: 4.58, alongZ: false,
        h: bh, w: bw, d: rr(0.15, 0.19), tilt: 0,
        color: BOOK_COLORS[Math.floor(rand() * BOOK_COLORS.length)],
      });
      x += bw + rr(0.001, 0.005);
    }
  }

  const inst = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1),
    new THREE.MeshStandardMaterial({ roughness: 0.88 }),
    spots.length,
  );
  const mtx = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const eul = new THREE.Euler();
  const col = new THREE.Color();
  spots.forEach((s, i) => {
    eul.set(0, 0, s.tilt);
    if (!s.alongZ) eul.set(0, 0, 0);
    q.setFromEuler(eul);
    // alongZ: width runs along Z, depth along X. else: width along X.
    const scale = s.alongZ
      ? new THREE.Vector3(s.d, s.h, s.w)
      : new THREE.Vector3(s.w, s.h, s.d);
    mtx.compose(new THREE.Vector3(s.x, s.y, s.z), q, scale);
    inst.setMatrixAt(i, mtx);
    col.setHex(s.color).multiplyScalar(rr(0.82, 1.12));
    inst.setColorAt(i, col);
  });
  inst.castShadow = false;
  inst.receiveShadow = true;
  g.add(inst);

  /* dressing ON TOP of the library (y 1.83 = cap board): vase, plant, box */
  const vase = cyl(g, 0.035, 0.05, 0.17, 12, -6.2, 1.915, -2.0,
    new THREE.MeshStandardMaterial({ color: 0x2a6d8a, roughness: 0.3 }));
  vase.castShadow = true;
  smallPlant(g, -6.2, 1.83, -3.8, 0.9);
  box(g, 0.2, 0.14, 0.28, -6.2, 1.9, -3.25,
    new THREE.MeshStandardMaterial({ color: 0xc9b18a, roughness: 0.9 }), { shadow: true });

  /* The wooden puzzle box — the demo's code stage lives on this shelf.
     Kept prominent at the anchor's height, centre of the middle shelf. */
  const boxG = new THREE.Group();
  const woodMat = new THREE.MeshStandardMaterial({ color: 0x8a5a2e, roughness: 0.6 });
  const woodDark = new THREE.MeshStandardMaterial({ color: 0x6b421f, roughness: 0.65 });
  box(boxG, 0.26, 0.17, 0.36, 0, 0.085, 0, woodMat, { shadow: true });
  box(boxG, 0.28, 0.045, 0.38, 0, 0.19, 0, woodDark, { shadow: true });
  box(boxG, 0.07, 0.06, 0.02, 0.135, 0.1, 0, M.brass); // clasp, faces the room (+X)
  boxG.position.set(-6.18, 0.74, -2.7);
  g.add(boxG);
}

/* ================================================================== */
/* B) LIVING ROOM dressing                                             */
/* ================================================================== */
export function buildLivingDecor(scene: THREE.Scene): void {
  const g = new THREE.Group();
  scene.add(g);
  const cushionGeo = new RoundedBoxGeometry(1, 1, 1, 3, 0.05);
  const cushion = (
    w: number, h: number, d: number, x: number, y: number, z: number,
    color: number, opts: { rotX?: number; rotY?: number; rotZ?: number } = {},
  ) => {
    const m = new THREE.Mesh(cushionGeo, new THREE.MeshStandardMaterial({ color, roughness: 1 }));
    m.scale.set(w, h, d);
    m.position.set(x, y, z);
    if (opts.rotX) m.rotation.x = opts.rotX;
    if (opts.rotY) m.rotation.y = opts.rotY;
    if (opts.rotZ) m.rotation.z = opts.rotZ;
    m.castShadow = true;
    g.add(m);
    return m;
  };
  /* Sofa = Poly Haven tufted leather (real cushions are modeled) — dressing
     is throw pillows + a folded throw only. Sofa at (-4.2,-1.4) rotY PI,
     seat top ≈ 0.5, backrest on the +Z side. */
  cushion(0.32, 0.32, 0.11, -3.62, 0.68, -1.16, 0x51683c, { rotZ: -0.13, rotY: -0.15 });
  cushion(0.3, 0.3, 0.1, -4.2, 0.66, -1.22, 0xc99700, { rotZ: 0.06 });
  /* folded throw over the east arm (arm top ≈ 0.72) */
  const throwMat = new THREE.MeshStandardMaterial({ color: 0x93392d, roughness: 1, side: THREE.DoubleSide });
  const throwTop = wavyPlane(0.34, 0.3, 3, 0.015, throwMat);
  throwTop.rotation.x = -Math.PI / 2;
  throwTop.position.set(-3.33, 0.74, -1.55);
  g.add(throwTop);
  const throwHang = wavyPlane(0.34, 0.42, 3, 0.015, throwMat);
  throwHang.position.set(-3.15, 0.52, -1.55);
  throwHang.rotation.y = Math.PI / 2;
  g.add(throwHang);
  /* armchair pillow (Poly Haven armchair, seat ≈ 0.45) */
  cushion(0.3, 0.3, 0.1, -2.06, 0.58, -4.06, 0x2a6d8a, { rotY: -0.64, rotZ: 0.1 });

  /* Coffee table = Poly Haven round marble (Ø1.3, top y 0.49):
     items pulled inside the round top. */
  bookStack(g, -4.42, 0.5, -3.48, 2, 0.9);
  mug(g, -4.02, 0.5, -3.22, 0x2a6d8a);
  box(g, 0.05, 0.018, 0.16, -4.1, 0.515, -3.52, M.darkMetal, { rotY: 0.4 }); // remote
  box(g, 0.34, 0.015, 0.24, -4.28, 0.505, -3.3,
    new THREE.MeshStandardMaterial({ color: 0x9a7b4f, roughness: 0.7 }));   // tray
  smallPlant(g, -4.5, 0.5, -3.18, 0.8);

  /* Big plant in a real pot by the window corner (plant hotspot) */


  /* Extra framed art over the sofa (south partition, faces north) */
  const frameAt = (url: string, w: number, h: number, x: number, y: number, z: number, rotY: number) => {
    const grp = new THREE.Group();
    box(grp, w + 0.09, h + 0.09, 0.045, 0, 0, 0, M.darkWood);
    const tex = makePhotoTexture(url, { mirror: false });
    tex.wrapS = THREE.ClampToEdgeWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
    const art = new THREE.Mesh(new THREE.PlaneGeometry(w, h),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    art.position.z = 0.028;
    grp.add(art);
    grp.position.set(x, y, z);
    grp.rotation.y = rotY;
    g.add(grp);
  };
  void frameAt; // (v7: the over-sofa art is a Poly Haven framed painting placed by House3D)

  /* Floor-lamp drum shade glow disc (existing lamp model stays) */
  const shade = cyl(g, 0.14, 0.16, 0.2, 16, -2.92, 1.52, -0.72,
    new THREE.MeshStandardMaterial({
      color: 0xf3e3c2, roughness: 0.9, emissive: 0xffbe78, emissiveIntensity: 0.35,
      side: THREE.DoubleSide,
    }));
  shade.castShadow = false;
}

/* ================================================================== */
/* B) KITCHEN + DINING dressing                                        */
/* ================================================================== */
export function buildKitchenDecor(scene: THREE.Scene): void {
  const g = new THREE.Group();
  scene.add(g);
  const frontMat = new THREE.MeshStandardMaterial({ color: 0xd8cdb8, roughness: 0.6 });
  const panelMat = new THREE.MeshStandardMaterial({ color: 0xcabfa8, roughness: 0.65 });

  /* Cabinet door-front insets + bar handles.
     Base run fronts face south at z ≈ -4.0; uppers at z ≈ -4.47. */
  const doorFront = (cx: number, cy: number, cz: number, w: number, h: number) => {
    box(g, w, h, 0.016, cx, cy, cz, frontMat);
    box(g, w - 0.14, h - 0.14, 0.008, cx, cy, cz + 0.008, panelMat);
    const handle = cyl(g, 0.011, 0.011, Math.min(0.34, w * 0.55), 10, cx, cy + h / 2 - 0.09, cz + 0.035, M.steel, { rotZ: Math.PI / 2 });
    handle.rotation.z = Math.PI / 2;
  };
  [-0.67, 0.19, 2.71].forEach((cx) => doorFront(cx, 0.47, -3.985, 0.78, 0.78));
  [-0.67, 0.19, 2.71].forEach((cx) => {
    // upper doors: handle along the bottom edge instead
    box(g, 0.78, 0.68, 0.016, cx, 1.78, -4.465, frontMat);
    box(g, 0.64, 0.54, 0.008, cx, 1.78, -4.457, panelMat);
    const handle = cyl(g, 0.011, 0.011, 0.34, 10, cx, 1.47, -4.43, M.steel, { rotZ: Math.PI / 2 });
    handle.rotation.z = Math.PI / 2;
  });
  /* drawer lines on the drawer cabinet */
  [0.68, 0.42].forEach((dy) => box(g, 0.78, 0.014, 0.01, 2.71, dy + 0.14, -3.978, panelMat));

  /* Countertop dressing (counter top y ≈ 0.95).
     The kettle is now the Poly Haven GLB, placed by House3D. */
  const CT = 0.95;
  // cutting board leaning on the backsplash + knife block
  box(g, 0.3, 0.42, 0.02, -0.28, CT + 0.19, -4.82,
    new THREE.MeshStandardMaterial({ color: 0xc9a86a, roughness: 0.8 }), { rotX: -0.16 });
  {
    box(g, 0.11, 0.24, 0.16, 0.32, CT + 0.12, -4.62, M.darkWood, { rotY: 0.15, shadow: true });
    [-0.03, 0.0, 0.03].forEach((ox, i) => {
      const stick = cyl(g, 0.006, 0.006, 0.16, 6, 0.32 + ox, CT + 0.28, -4.62 + (i - 1) * 0.02, M.steel, { rotZ: ox * 3 });
      stick.rotation.z = ox * 3;
    });
  }
  // fruit bowl (lathe) with fruit — on the drawer-cabinet counter, west of microwave
  {
    const pts: THREE.Vector2[] = [];
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      pts.push(new THREE.Vector2(0.02 + Math.sin(t * 1.9) * 0.13, t * 0.075));
    }
    const bowl = new THREE.Mesh(new THREE.LatheGeometry(pts, 20),
      new THREE.MeshStandardMaterial({ color: 0x2a6d8a, roughness: 0.3, side: THREE.DoubleSide }));
    bowl.position.set(2.32, CT, -4.42);
    bowl.castShadow = true;
    g.add(bowl);
    const fruitCols = [0xe4572e, 0xf2a007, 0x7fb069, 0xd94f30, 0xe8b13a];
    fruitCols.forEach((fc, i) => {
      const f = new THREE.Mesh(new THREE.SphereGeometry(0.032, 12, 10),
        new THREE.MeshStandardMaterial({ color: fc, roughness: 0.45 }));
      const a = (i / fruitCols.length) * Math.PI * 2;
      f.position.set(2.32 + Math.cos(a) * 0.055, CT + 0.075 + (i === 4 ? 0.045 : 0), -4.42 + Math.sin(a) * 0.055);
      f.castShadow = true;
      g.add(f);
    });
  }
  // toaster (rounded box) + utensils crock
  {
    const toaster = new THREE.Mesh(new RoundedBoxGeometry(0.26, 0.16, 0.15, 3, 0.03), M.steel);
    toaster.position.set(0.62, CT + 0.08, -4.66);
    toaster.castShadow = true;
    g.add(toaster);
    box(g, 0.2, 0.015, 0.02, 0.62, CT + 0.165, -4.66, M.darkMetal);
    cyl(g, 0.05, 0.045, 0.13, 12, -0.02, CT + 0.065, -4.68, M.ceramic);
    [-0.02, 0.015, 0.04].forEach((ox, i) => {
      cyl(g, 0.005, 0.005, 0.17, 6, -0.02 + ox, CT + 0.17, -4.68 + (i - 1) * 0.015, M.darkWood, { rotZ: ox * 2 });
    });
  }
  /* Sink: inset basin rim + faucet arc over the existing sink unit */
  {
    box(g, 0.62, 0.02, 0.44, 1.02, 0.945, -4.46, M.steel);
    box(g, 0.54, 0.012, 0.36, 1.02, 0.952, -4.46,
      new THREE.MeshStandardMaterial({ color: 0x5a6066, metalness: 0.6, roughness: 0.4 }));
    cyl(g, 0.02, 0.024, 0.3, 10, 1.02, 1.1, -4.78, M.steel);
    const spout = cyl(g, 0.013, 0.013, 0.3, 10, 1.02, 1.25, -4.64, M.steel, { rotX: Math.PI / 2 });
    spout.rotation.x = Math.PI / 2;
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.013, 8, 16, Math.PI / 2), M.steel);
    arc.position.set(1.02, 1.25, -4.78);
    arc.rotation.y = Math.PI / 2;
    g.add(arc);
    cyl(g, 0.011, 0.011, 0.09, 8, 1.02, 1.08, -4.5, M.steel, { rotZ: Math.PI / 2 });
  }
  /* Stove: pot on one burner, pan on another (stove top y ≈ 0.92) */
  {
    cyl(g, 0.11, 0.1, 0.13, 18, 1.68, 0.985, -4.6, M.darkMetal, { shadow: true });
    cyl(g, 0.115, 0.115, 0.02, 18, 1.68, 1.06, -4.6, M.steel);
    [-1, 1].forEach((s) => {
      const h = cyl(g, 0.008, 0.008, 0.07, 8, 1.68 + s * 0.13, 1.02, -4.6, M.darkMetal, { rotZ: Math.PI / 2 });
      h.rotation.z = Math.PI / 2;
    });
    cyl(g, 0.1, 0.09, 0.035, 18, 2.02, 0.94, -4.32, M.darkMetal, { shadow: true });
    const panHandle = cyl(g, 0.009, 0.009, 0.16, 8, 2.02, 0.95, -4.14, M.darkMetal, { rotX: Math.PI / 2 });
    panHandle.rotation.x = Math.PI / 2;
  }
  /* Fridge collage + THE paper note (pickup stays at its anchor) */
  {
    const collage = new THREE.Mesh(new THREE.PlaneGeometry(0.74, 1.04),
      new THREE.MeshStandardMaterial({ map: makeFridgeCollageTexture(), roughness: 0.45 }));
    collage.position.set(5.95, 1.32, -4.1);
    g.add(collage);
    const note = new THREE.Mesh(new THREE.PlaneGeometry(0.17, 0.21),
      new THREE.MeshStandardMaterial({ map: makePaperNoteTexture(), roughness: 0.9 }));
    note.position.set(5.95, 1.28, -4.085);
    note.rotation.z = -0.05;
    g.add(note);
    const pin = new THREE.Mesh(new THREE.SphereGeometry(0.016, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0xe4572e, roughness: 0.3 }));
    pin.position.set(5.95, 1.37, -4.078);
    g.add(pin);
    // fridge side handles
    const fh = cyl(g, 0.012, 0.012, 0.5, 8, 5.6, 1.35, -4.12, M.steel);
    fh.rotation.x = 0;
  }

  /* Dining: 4 place settings (instanced plates/cups) + centerpiece + pendant */
  {
    const plateGeo = new THREE.CylinderGeometry(0.13, 0.09, 0.02, 20);
    const plates = new THREE.InstancedMesh(plateGeo, M.ceramic, 4);
    const cupGeo = new THREE.CylinderGeometry(0.035, 0.028, 0.07, 12);
    const cups = new THREE.InstancedMesh(cupGeo,
      new THREE.MeshStandardMaterial({ color: 0x2a6d8a, roughness: 0.4 }), 4);
    const mtx = new THREE.Matrix4();
    const spots: [number, number, number][] = [
      [3.8, 0.7, -2.68], [4.6, 0.7, -2.68], [3.6, 0.7, -2.32], [4.4, 0.7, -2.32],
    ];
    spots.forEach(([px, py, pz], i) => {
      mtx.makeTranslation(px, py, pz);
      plates.setMatrixAt(i, mtx);
      mtx.makeTranslation(px + (i % 2 === 0 ? 0.19 : -0.19), py + 0.026, pz);
      cups.setMatrixAt(i, mtx);
      // cutlery: two thin boxes flanking each plate
      box(g, 0.014, 0.008, 0.15, px - 0.17, py - 0.005, pz, M.steel);
      box(g, 0.014, 0.008, 0.15, px + 0.17, py - 0.005, pz, M.steel);
    });
    plates.castShadow = true;
    g.add(plates); g.add(cups);
    // flowers for the Poly Haven ceramic vase placed by House3D
    // (vase on the table: base 0.69, rim ≈ 1.09)
    [0xe86a92, 0xf2a007, 0xe4572e].forEach((fc, i) => {
      const stem = cyl(g, 0.004, 0.004, 0.3, 6, 4.15 + (i - 1) * 0.03, 1.0, -2.5 + (i % 2) * 0.03, M.leaf, { rotZ: (i - 1) * 0.25 });
      stem.rotation.z = (i - 1) * 0.25;
      const head = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8),
        new THREE.MeshStandardMaterial({ color: fc, roughness: 0.7 }));
      head.position.set(4.15 + (i - 1) * 0.055, 1.18, -2.5 + (i % 2) * 0.03);
      g.add(head);
    });
    // (the dining pendant is the Poly Haven ceiling lamp, placed by House3D)
  }

  /* Pantry wall shelves (east wall, clear of the fridge) with instanced jars */
  {
    [1.35, 1.75].forEach((sy) => box(g, 0.24, 0.03, 1.1, 6.34, sy, -3.45, M.shelfWood, { shadow: true }));
    const jarGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.15, 12);
    const jarMat = new THREE.MeshStandardMaterial({ roughness: 0.25, transparent: true, opacity: 0.85 });
    const jars = new THREE.InstancedMesh(jarGeo, jarMat, 12);
    const lidGeo = new THREE.CylinderGeometry(0.047, 0.047, 0.02, 12);
    const lids = new THREE.InstancedMesh(lidGeo, M.darkWood, 12);
    const mtx = new THREE.Matrix4();
    const col = new THREE.Color();
    const fillCols = [0xd9a441, 0xa34a2a, 0x7fb069, 0xe8dcc0, 0x94502e, 0x5b8c5a];
    let ji = 0;
    [1.35, 1.75].forEach((sy) => {
      for (let k = 0; k < 6; k++) {
        const jz = -3.9 + k * 0.18;
        const jh = 0.13 + (k % 3) * 0.03;
        mtx.makeScale(1, jh / 0.15, 1).setPosition(6.34, sy + 0.015 + jh / 2, jz);
        jars.setMatrixAt(ji, mtx);
        col.setHex(fillCols[(ji + k) % fillCols.length]);
        jars.setColorAt(ji, col);
        mtx.makeTranslation(6.34, sy + 0.015 + jh + 0.01, jz);
        lids.setMatrixAt(ji, mtx);
        ji++;
      }
    });
    g.add(jars); g.add(lids);
    // a couple of cereal boxes beside the jars
    box(g, 0.16, 0.3, 0.06, 6.36, 1.52, -2.82,
      new THREE.MeshStandardMaterial({ color: 0xe4572e, roughness: 0.8 }), { rotY: Math.PI / 2 });
    box(g, 0.16, 0.26, 0.06, 6.36, 1.5, -2.68,
      new THREE.MeshStandardMaterial({ color: 0x2a6d8a, roughness: 0.8 }), { rotY: Math.PI / 2 });
  }
}

/* ================================================================== */
/* C) DENSITY — entrance / hallway / bedrooms / bathroom               */
/* ================================================================== */
export function buildEntranceDecor(scene: THREE.Scene): void {
  const g = new THREE.Group();
  scene.add(g);
  /* Doormat in front of the front door */
  const mat = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 0.6),
    new THREE.MeshStandardMaterial({ map: makeDoormatTexture(), roughness: 1 }));
  mat.rotation.x = -Math.PI / 2;
  mat.rotation.z = Math.PI / 2;
  mat.position.set(6.0, 0.014, 0.6);
  mat.receiveShadow = true;
  g.add(mat);

  /* Shoe rack on the east wall, south of the front door */
  const rack = new THREE.Group();
  [0.14, 0.44].forEach((sy) => box(rack, 0.3, 0.03, 0.95, 0, sy, 0, M.shelfWood, { shadow: true }));
  [-0.42, 0.42].forEach((oz) => box(rack, 0.28, 0.62, 0.03, 0, 0.31, oz, M.darkWood));
  rack.position.set(6.28, 0, 1.62);
  g.add(rack);
  // instanced shoes: merged sole + upper geometry, varied colors
  const sole = new THREE.BoxGeometry(0.25, 0.03, 0.09);
  sole.translate(0, 0.015, 0);
  const upper = new THREE.SphereGeometry(0.075, 10, 8);
  upper.scale(1.5, 0.62, 0.58);
  upper.translate(-0.01, 0.045, 0);
  const shoeGeo = mergeGeometries([sole, upper]) ?? sole;
  const shoes = new THREE.InstancedMesh(shoeGeo,
    new THREE.MeshStandardMaterial({ roughness: 0.7 }), 10);
  const mtx = new THREE.Matrix4();
  const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0));
  const col = new THREE.Color();
  const shoeCols = [0x37424a, 0x8c3b2a, 0xe8e2d4, 0x2a4a7a, 0x5d4a38];
  let si = 0;
  [0.155, 0.455].forEach((sy, lvl) => {
    for (let p = 0; p < 2 + lvl; p++) {
      [-0.05, 0.05].forEach((off) => {
        if (si >= 10) return;
        mtx.compose(
          new THREE.Vector3(6.28, sy, 1.38 + p * 0.3 + off),
          q, new THREE.Vector3(1, 1, 1),
        );
        shoes.setMatrixAt(si, mtx);
        col.setHex(shoeCols[si % shoeCols.length]);
        shoes.setColorAt(si, col);
        si++;
      });
    }
  });
  shoes.count = si;
  shoes.castShadow = true;
  g.add(shoes);

  /* Coat hooks row + coats + hat beside the coat rack (north wall) */
  box(g, 0.7, 0.07, 0.03, 5.55, 1.62, -0.7, M.darkWood);
  const coatCols = [0x374f63, 0x7a2e35];
  coatCols.forEach((cc, i) => {
    const hx = 5.38 + i * 0.34;
    cyl(g, 0.012, 0.012, 0.09, 8, hx, 1.6, -0.65, M.brass, { rotX: Math.PI / 2.5 });
    const coat = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.72, 10),
      new THREE.MeshStandardMaterial({ color: cc, roughness: 1 }));
    coat.scale.set(1, 1, 0.45);
    coat.position.set(hx, 1.2, -0.62);
    coat.castShadow = true;
    g.add(coat);
  });
  // hat on the third hook
  cyl(g, 0.09, 0.09, 0.02, 14, 5.38 + 2 * 0.34 - 0.34 + 0.34, 1.58, -0.63,
    new THREE.MeshStandardMaterial({ color: 0xc9b18a, roughness: 0.9 }));
  cyl(g, 0.055, 0.06, 0.08, 12, 6.06 - 0.34 + 0.34, 1.62, -0.63,
    new THREE.MeshStandardMaterial({ color: 0xc9b18a, roughness: 0.9 }));

  /* Mirror with frame on the entrance north wall */
  const mir = new THREE.Group();
  box(mir, 0.62, 0.82, 0.04, 0, 0, 0, M.trimWood);
  const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.72),
    new THREE.MeshStandardMaterial({ color: 0xcfe0e2, metalness: 0.9, roughness: 0.08 }));
  glass.position.z = 0.025;
  mir.add(glass);
  mir.position.set(4.55, 1.5, -0.7);
  g.add(mir);
  /* umbrella stand by the door */
  cyl(g, 0.09, 0.07, 0.5, 12, 6.25, 0.25, 1.05, M.darkMetal);
  const umb = cyl(g, 0.008, 0.008, 0.75, 6, 6.22, 0.6, 1.03, M.trimWood, { rotZ: 0.12 });
  umb.rotation.z = 0.12;
}

export function buildHallwayDecor(scene: THREE.Scene): void {
  const g = new THREE.Group();
  scene.add(g);
  const runner = new THREE.Mesh(new THREE.PlaneGeometry(3.9, 1.15),
    new THREE.MeshStandardMaterial({ map: makeRunnerTexture(), roughness: 1 }));
  runner.rotation.x = -Math.PI / 2;
  runner.rotation.z = Math.PI / 2;
  runner.position.set(1.1, 0.013, 0);
  runner.receiveShadow = true;
  g.add(runner);
  // two small frames flanking the family picture (anchor picture stays central)
  const mini = (url: string, x: number) => {
    const grp = new THREE.Group();
    box(grp, 0.44, 0.34, 0.04, 0, 0, 0, M.darkWood);
    const tex = makePhotoTexture(url, { mirror: false });
    tex.wrapS = THREE.ClampToEdgeWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
    const art = new THREE.Mesh(new THREE.PlaneGeometry(0.36, 0.26),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    art.position.z = 0.024;
    grp.add(art);
    grp.position.set(x, 1.52, -0.7);
    g.add(grp);
  };
  void mini; // (v7: film-set stills removed from the hallway)
}

export function buildBedroomsDecor(scene: THREE.Scene): void {
  const g = new THREE.Group();
  scene.add(g);
  const pillowGeo = new RoundedBoxGeometry(1, 1, 1, 3, 0.05);
  const pillow = (x: number, y: number, z: number, w: number, rotY: number, color = 0xf7f2e4) => {
    const p = new THREE.Mesh(pillowGeo, new THREE.MeshStandardMaterial({ color, roughness: 1 }));
    p.scale.set(w, 0.13, 0.34);
    p.position.set(x, y, z);
    p.rotation.y = rotY;
    p.rotation.x = -0.18;
    p.castShadow = true;
    g.add(p);
    return p;
  };
  /* ---- kids bunk (bed at (-5.44,2.9) rotY PI/2, head toward -Z end) ---- */
  pillow(-5.44, 0.57, 2.05, 0.52, Math.PI / 2);
  // folded blanket with a wavy free edge on the lower bunk
  box(g, 0.95, 0.07, 0.85, -5.44, 0.55, 3.35,
    new THREE.MeshStandardMaterial({ color: 0x2a6d8a, roughness: 1 }), { shadow: true });
  const bunkEdge = wavyPlane(0.95, 0.22, 6, 0.02,
    new THREE.MeshStandardMaterial({ color: 0x2a6d8a, roughness: 1, side: THREE.DoubleSide }));
  bunkEdge.position.set(-4.95, 0.45, 3.35);
  bunkEdge.rotation.y = Math.PI / 2;
  g.add(bunkEdge);
  box(g, 0.95, 0.06, 0.7, -5.44, 1.24, 3.3,
    new THREE.MeshStandardMaterial({ color: 0xe86a92, roughness: 1 })); // upper bunk blanket
  /* kids desk: book stack + pencil cup + upright books with bookend */
  bookStack(g, -2.25, 0.72, 1.2, 3, 0.95);
  cyl(g, 0.035, 0.03, 0.09, 12, -2.95, 0.765, 1.32,
    new THREE.MeshStandardMaterial({ color: 0xe4572e, roughness: 0.5 }));
  [-0.012, 0.012, 0.036].forEach((ox, i) => {
    cyl(g, 0.0035, 0.0035, 0.13, 6, -2.95 + ox, 0.83, 1.32 + (i - 1) * 0.012,
      new THREE.MeshStandardMaterial({ color: [0xf2a007, 0x2a9d8f, 0xd94f30][i], roughness: 0.6 }), { rotZ: ox * 6 });
  });
  /* kids wall pictures (south wall) */
  const kidArt = (x: number, url: string) => {
    const grp = new THREE.Group();
    box(grp, 0.5, 0.38, 0.04, 0, 0, 0, M.trimWood);
    const tex = makePhotoTexture(url, { mirror: false });
    tex.wrapS = THREE.ClampToEdgeWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
    const art = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.3),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    art.position.z = 0.024;
    grp.add(art);
    grp.position.set(x, 1.62, 4.9);
    grp.rotation.y = Math.PI;
    g.add(grp);
  };
  kidArt(-3.4, PHOTO.sunset);
  kidArt(-2.55, PHOTO.cameraArt);
  /* a soft rug in the kids room */
  const krug = new THREE.Mesh(new THREE.CircleGeometry(0.85, 24),
    new THREE.MeshStandardMaterial({ color: 0x7fb069, roughness: 1 }));
  krug.rotation.x = -Math.PI / 2;
  krug.position.set(-3.6, 0.011, 3.2);
  krug.receiveShadow = true;
  g.add(krug);

  /* ---- parents bed (bedDouble at (-0.17,3.0) rotY PI/2) ---- */
  pillow(-0.35, 0.68, 1.95, 0.5, Math.PI / 2);
  pillow(-0.35, 0.68, 4.05, 0.5, Math.PI / 2);
  box(g, 1.05, 0.08, 0.75, -0.1, 0.68, 3.85,
    new THREE.MeshStandardMaterial({ color: 0xb8a888, roughness: 1 }), { rotY: Math.PI / 2, shadow: true }); // folded throw at foot
  /* dresser top (y 0.72): books, small plant, standing picture frame */
  bookStack(g, 1.45, 0.72, 4.68, 2, 0.85);
  /* (nightstands are now Poly Haven ClassicNightstand, top y 0.70) */
  smallPlant(g, 2.35, 0.72, 4.66, 0.9);
  {
    const fr = new THREE.Group();
    box(fr, 0.2, 0.26, 0.02, 0, 0.13, 0, M.darkWood);
    const tex = makePhotoTexture(PHOTO.sunset, { mirror: false });
    tex.wrapS = THREE.ClampToEdgeWrapping; tex.wrapT = THREE.ClampToEdgeWrapping;
    const art = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.22),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 }));
    art.position.set(0, 0.13, 0.012);
    fr.add(art);
    fr.position.set(2.02, 0.72, 4.6);
    fr.rotation.y = Math.PI + 0.3;
    fr.rotation.x = -0.1;
    g.add(fr);
  }
  /* nightstand: book + small clock (on the Poly Haven nightstand, top 0.70) */
  bookStack(g, -0.91, 0.7, 1.62, 1, 0.8);
  {
    const clock = new THREE.Group();
    cyl(clock, 0.05, 0.05, 0.02, 16, 0, 0.05, 0, M.darkWood, { rotX: Math.PI / 2 });
    const face = new THREE.Mesh(new THREE.CircleGeometry(0.042, 16),
      new THREE.MeshStandardMaterial({ color: 0xfff6e9, roughness: 0.5 }));
    face.position.set(0, 0.05, 0.012);
    clock.add(face);
    clock.position.set(-0.91, 0.7, 1.9);
    clock.rotation.y = Math.PI / 2;
    g.add(clock);
  }
  /* rug beside the parents bed */
  const prug = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 0.9),
    new THREE.MeshStandardMaterial({ color: 0x9a8a70, roughness: 1 }));
  prug.rotation.x = -Math.PI / 2;
  prug.position.set(0.85, 0.011, 3.0);
  prug.receiveShadow = true;
  g.add(prug);
}

export function buildBathroomDecor(scene: THREE.Scene): void {
  const g = new THREE.Group();
  scene.add(g);
  /* Toothbrush cup + 4 brushes on the sink (sink top ≈ 0.87, at (6.2,3.6)) */
  cyl(g, 0.04, 0.033, 0.1, 12, 6.28, 0.92, 3.28, M.ceramic, { shadow: true });
  const brushCols = [0xe4572e, 0x2a9d8f, 0x2a6d8a, 0xf2a007];
  brushCols.forEach((bc, i) => {
    const bx = 6.28 + (i - 1.5) * 0.018;
    const bz = 3.28 + ((i % 2) - 0.5) * 0.02;
    const stick = cyl(g, 0.005, 0.005, 0.15, 6, bx, 1.03, bz,
      new THREE.MeshStandardMaterial({ color: bc, roughness: 0.5 }), { rotZ: (i - 1.5) * 0.09 });
    stick.rotation.z = (i - 1.5) * 0.09;
    box(g, 0.016, 0.03, 0.01, bx + (i - 1.5) * 0.008, 1.11, bz,
      new THREE.MeshStandardMaterial({ color: 0xf7f4ec, roughness: 0.6 }));
  });
  /* small shelf over the sink with bottles */
  box(g, 0.18, 0.025, 0.7, 6.36, 1.02, 3.6, M.trim, { shadow: true });
  [3.38, 3.52, 3.68, 3.82].forEach((bz, i) => {
    cyl(g, 0.026, 0.026, 0.11 + (i % 2) * 0.04, 10, 6.36, 1.1 + (i % 2) * 0.02, bz,
      new THREE.MeshStandardMaterial({ color: [0x2a9d8f, 0xe8b13a, 0x7a4a8c, 0xe4572e][i], roughness: 0.35 }));
    cyl(g, 0.01, 0.01, 0.03, 8, 6.36, 1.18 + (i % 2) * 0.04, bz, M.darkMetal);
  });
  /* Towel rail + wavy towel on the west partition wall (faces east) */
  const rail = cyl(g, 0.011, 0.011, 0.6, 10, 3.52, 1.35, 3.3, M.steel, { rotX: Math.PI / 2 });
  rail.rotation.x = Math.PI / 2;
  const towel = wavyPlane(0.44, 0.62, 4, 0.018,
    new THREE.MeshStandardMaterial({ map: makeTowelTexture(), roughness: 1, side: THREE.DoubleSide }));
  towel.position.set(3.56, 1.02, 3.3);
  towel.rotation.y = Math.PI / 2;
  g.add(towel);
  const towel2 = wavyPlane(0.3, 0.45, 3, 0.015,
    new THREE.MeshStandardMaterial({ map: makeTowelTexture('#fdf3e3', '#e4572e'), roughness: 1, side: THREE.DoubleSide }));
  towel2.position.set(6.38, 1.0, 4.3);
  towel2.rotation.y = -Math.PI / 2;
  g.add(towel2);
  box(g, 0.03, 0.03, 0.34, 6.4, 1.32, 4.3, M.steel); // its rail
  /* Bottles on the tub rim + a bath mat */
  [3.95, 4.12].forEach((bx, i) => {
    cyl(g, 0.028, 0.028, 0.13, 10, bx, 0.675, 2.18,
      new THREE.MeshStandardMaterial({ color: [0x2a6d8a, 0xe86a92][i], roughness: 0.35 }));
  });
  const bathMat = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.5),
    new THREE.MeshStandardMaterial({ color: 0xa9c6c9, roughness: 1 }));
  bathMat.rotation.x = -Math.PI / 2;
  bathMat.position.set(4.3, 0.012, 3.35);
  bathMat.receiveShadow = true;
  g.add(bathMat);
  /* Toilet brush holder + spare roll on the tank */
  cyl(g, 0.05, 0.045, 0.26, 12, 4.42, 0.13, 4.62, M.ceramic);
  cyl(g, 0.006, 0.006, 0.2, 6, 4.42, 0.34, 4.62, M.steel);
  cyl(g, 0.055, 0.055, 0.11, 14, 3.82, 0.83, 4.5, M.paper, { rotX: 0.2 });
  /* Laundry basket near the washing machine */
  cyl(g, 0.24, 0.19, 0.42, 14, 5.15, 0.21, 4.55,
    new THREE.MeshStandardMaterial({ color: 0xd8cdb8, roughness: 0.9, side: THREE.DoubleSide }), { shadow: true });
  const cloth = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8),
    new THREE.MeshStandardMaterial({ color: 0xa9b79a, roughness: 1 }));
  cloth.scale.set(1, 0.45, 1);
  cloth.position.set(5.15, 0.44, 4.55);
  g.add(cloth);
}

/** One-call entry used by House3D after all furniture is placed. */
export function buildHouseDecor(scene: THREE.Scene): void {
  buildArchitecture(scene);
  buildBookshelfWall(scene);
  buildLivingDecor(scene);
  buildKitchenDecor(scene);
  buildEntranceDecor(scene);
  buildHallwayDecor(scene);
  buildBedroomsDecor(scene);
  buildBathroomDecor(scene);
}
