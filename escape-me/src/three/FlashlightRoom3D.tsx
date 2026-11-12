import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import type { FlashlightContent, StagePlayerProps } from '../types';
import { PHOTO, disposeObject, makeBadgeTexture, makeDustTexture, makeEmojiTexture, makePhotoTexture } from './canvasTextures';
import './flashlight-room.css';

/** Alpha gradient for the volumetric beam cone: bright at the source (top / v=1), fading to transparent at the far end. */
function makeBeamAlphaTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 2; c.height = 256;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, 256);
    g.addColorStop(0, '#ffffff');
    g.addColorStop(0.3, 'rgba(255,255,255,0.5)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 2, 256);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const TORCH_UNSUPPORTED_MSG = 'הפנס האמיתי לא נתמך כאן — ממשיכים עם הפנס שעל המסך';

/** Diorama positions on the back wall (x, y) — all 8 reachable in one view. */
const POSITIONS: ReadonlyArray<readonly [number, number]> = [
  [-3.4, 2.3],
  [-1.7, 1.25],
  [0, 2.6],
  [1.7, 1.2],
  [3.4, 2.3],
  [-2.55, 3.35],
  [0.95, 3.5],
  [2.6, 0.98],
];

interface RoomObjectItem { label: string; emoji: string; isCorrect: boolean }

interface TorchTrack {
  getCapabilities?: () => { torch?: boolean } | undefined;
  applyConstraints: (constraints: unknown) => Promise<void>;
  stop: () => void;
}

export default function FlashlightRoom3D({ content, celebrantName, api }: StagePlayerProps<FlashlightContent>) {
  const objects = useMemo<RoomObjectItem[]>(() => {
    const all: RoomObjectItem[] = [
      ...content.correct.map((c) => ({ ...c, isCorrect: true })),
      ...content.decoys.map((d) => ({ ...d, isCorrect: false })),
    ];
    const order = [3, 0, 5, 1, 7, 2, 6, 4, 9, 8];
    const arranged = order.filter((i) => i < all.length).map((i) => all[i]);
    all.forEach((o, i) => { if (!arranged.includes(o)) arranged.splice(i, 0, o); });
    return arranged.slice(0, POSITIONS.length);
  }, [content]);

  const correctTotal = useMemo(() => objects.filter((o) => o.isCorrect).length, [objects]);

  const mountRef = useRef<HTMLDivElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timersRef = useRef<number[]>([]);
  const finishedRef = useRef(false);
  const foundRef = useRef<Set<number>>(new Set());
  const shakeRef = useRef<Map<number, number>>(new Map());
  const tapRef = useRef<(idx: number) => void>(() => undefined);
  const apiRef = useRef(api);
  apiRef.current = api;

  const [foundSet, setFoundSet] = useState<Set<number>>(new Set());
  const [done, setDone] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [torchBusy, setTorchBusy] = useState(false);
  const [torchMsg, setTorchMsg] = useState<string | null>(null);

  const later = (fn: () => void, ms: number) => { timersRef.current.push(window.setTimeout(fn, ms)); };

  const finishOnce = () => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    apiRef.current.finish();
  };

  const handleTap = (idx: number) => {
    if (finishedRef.current || foundRef.current.has(idx)) return;
    const obj = objects[idx];
    if (!obj) return;
    if (obj.isCorrect) {
      apiRef.current.addPoints(30);
      apiRef.current.feedback('good');
      foundRef.current.add(idx);
      setFoundSet(new Set(foundRef.current));
      if (foundRef.current.size >= correctTotal) {
        setDone(true);
        later(finishOnce, 900);
      }
    } else {
      apiRef.current.addPoints(-20);
      apiRef.current.feedback('bad');
      shakeRef.current.set(idx, performance.now() + 300);
    }
  };
  tapRef.current = handleTap;

  // cleanup timers + torch on unmount
  useEffect(() => () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    streamRef.current = null;
  }, []);

  const stopTorch = () => {
    try { streamRef.current?.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    streamRef.current = null;
    setTorchOn(false);
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

  // ---------- Three.js scene ----------
  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 360;
    const height = mount.clientHeight || 430;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x070403);

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 40);
    camera.position.set(0, 1.95, 5.9);

    // faint fill so the room is barely readable outside the beam
    const fill = new THREE.PointLight(0xffe2bb, 1.7, 15, 1.6);
    fill.position.set(0, 2, 5.3);
    scene.add(fill);

    // the flashlight beam
    const beamPoint = new THREE.Vector3(0, 2, -3.1);
    const beamTarget = new THREE.Vector3(0, 2, -3.1);
    const spot = new THREE.SpotLight(0xffd9a3, 320, 32, 0.46, 0.55, 1.7);
    spot.position.set(0, 3.6, 4.4);
    spot.target.position.copy(beamTarget);
    scene.add(spot);
    scene.add(spot.target);

    // dark room shell — photoreal plaster + wood, tinted so they read as the same room in darkness
    const wall = new THREE.Mesh(
      new THREE.PlaneGeometry(15, 6.5),
      new THREE.MeshStandardMaterial({ map: makePhotoTexture(PHOTO.wall), color: 0x77644e, roughness: 1 }),
    );
    wall.position.set(0, 3.25, -3.2);
    scene.add(wall);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(15, 10),
      new THREE.MeshStandardMaterial({ map: makePhotoTexture(PHOTO.floor, { repeat: [3, 2] }), color: 0x6b5138, roughness: 1 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 0.6);
    scene.add(floor);

    // side walls closing the room
    const leftWall = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 6.5),
      new THREE.MeshStandardMaterial({ map: makePhotoTexture(PHOTO.wall), color: 0x77644e, roughness: 1 }),
    );
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-7.5, 3.25, 0.6);
    scene.add(leftWall);
    const rightWall = new THREE.Mesh(
      new THREE.PlaneGeometry(10, 6.5),
      new THREE.MeshStandardMaterial({ map: makePhotoTexture(PHOTO.wall), color: 0x77644e, roughness: 1 }),
    );
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(7.5, 3.25, 0.6);
    scene.add(rightWall);

    // thin wood skirting / baseboard along the back wall
    const skirting = new THREE.Mesh(
      new THREE.BoxGeometry(15, 0.22, 0.08),
      new THREE.MeshStandardMaterial({ map: makePhotoTexture(PHOTO.desk, { repeat: [3, 1] }), color: 0x8b6f52, roughness: 0.9 }),
    );
    skirting.position.set(0, 0.11, -3.16);
    scene.add(skirting);

    // volumetric beam cone — soft additive cone from the lamp to the beam point
    const beamAlphaTex = makeBeamAlphaTexture();
    const beamGeo = new THREE.CylinderGeometry(0.14, 1.0, 1, 32, 1, true);
    beamGeo.translate(0, -0.5, 0);
    beamGeo.rotateX(-Math.PI / 2); // now extends from origin along +Z, narrow end at origin
    const beamCone = new THREE.Mesh(
      beamGeo,
      new THREE.MeshBasicMaterial({
        color: 0xffd9a3,
        transparent: true,
        opacity: 0.1,
        alphaMap: beamAlphaTex,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      }),
    );
    beamCone.position.copy(spot.position);
    beamCone.frustumCulled = false;
    beamCone.renderOrder = 10;
    scene.add(beamCone);

    // dust motes drifting in the air
    const DUST_COUNT = 90;
    const dustPositions = new Float32Array(DUST_COUNT * 3);
    const dustBase = new Float32Array(DUST_COUNT * 3);
    const dustPhases = new Float32Array(DUST_COUNT);
    for (let i = 0; i < DUST_COUNT; i++) {
      const bx = -5 + Math.random() * 10;
      const by = 0.3 + Math.random() * 4.3;
      const bz = -3 + Math.random() * 6.5;
      dustBase[i * 3] = bx; dustBase[i * 3 + 1] = by; dustBase[i * 3 + 2] = bz;
      dustPositions[i * 3] = bx; dustPositions[i * 3 + 1] = by; dustPositions[i * 3 + 2] = bz;
      dustPhases[i] = Math.random() * Math.PI * 2;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dust = new THREE.Points(
      dustGeo,
      new THREE.PointsMaterial({
        map: makeDustTexture(),
        size: 0.045,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        color: 0xffe2b0,
      }),
    );
    dust.frustumCulled = false;
    scene.add(dust);

    // objects on pedestal columns
    interface ObjRig {
      sprite: THREE.Sprite;
      mat: THREE.SpriteMaterial;
      badge: THREE.Sprite;
      baseX: number;
      baseY: number;
      pos: THREE.Vector3;
      brightness: number;
      phase: number;
    }
    const rigs: ObjRig[] = [];
    const hitMeshes: THREE.Object3D[] = [];
    const badgeTex = makeBadgeTexture();
    const pedestalMat = new THREE.MeshStandardMaterial({ map: makePhotoTexture(PHOTO.desk, { repeat: [1, 1] }), color: 0x3a2718, roughness: 0.95 });
    const pedestalMat2 = new THREE.MeshStandardMaterial({ map: makePhotoTexture(PHOTO.desk, { repeat: [1, 1] }), color: 0x2e2019, roughness: 0.95 });

    objects.forEach((obj, i) => {
      const [px, py] = POSITIONS[i % POSITIONS.length];
      const pz = -2.9;
      const h = Math.max(0.3, py - 0.52);
      const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.38, h, 18), i % 2 ? pedestalMat : pedestalMat2);
      pedestal.position.set(px, h / 2, pz);
      scene.add(pedestal);

      const mat = new THREE.SpriteMaterial({ map: makeEmojiTexture(obj.emoji), transparent: true, depthWrite: false });
      mat.color.setScalar(0.06);
      const sprite = new THREE.Sprite(mat);
      sprite.scale.set(1.02, 1.02, 1);
      sprite.position.set(px, py, pz);
      scene.add(sprite);

      const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: badgeTex, transparent: true, depthWrite: false }));
      badge.scale.set(0.44, 0.44, 1);
      badge.position.set(px + 0.4, py + 0.4, pz + 0.05);
      badge.visible = false;
      scene.add(badge);

      const hit = new THREE.Mesh(
        new THREE.PlaneGeometry(1.3, 1.3),
        new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }),
      );
      hit.position.set(px, py, pz + 0.06);
      hit.userData.objectIndex = i;
      scene.add(hit);
      hitMeshes.push(hit);

      rigs.push({
        sprite, mat, badge, baseX: px, baseY: py,
        pos: new THREE.Vector3(px, py, pz), brightness: 0.06, phase: i * 1.13,
      });
    });

    // pointer: beam follows, slight drag-yaw, tap = raycast
    const wallPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 3.1);
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let yawCur = 0; let yawTarget = 0; let pitchCur = 0; let pitchTarget = 0;
    let isDown = false; let downX = 0; let downY = 0; let downDist = 0;

    const updatePointer = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -(((clientY - rect.top) / rect.height) * 2 - 1));
      raycaster.setFromCamera(ndc, camera);
      const hitPoint = new THREE.Vector3();
      if (raycaster.ray.intersectPlane(wallPlane, hitPoint)) {
        beamTarget.set(
          THREE.MathUtils.clamp(hitPoint.x, -4.8, 4.8),
          THREE.MathUtils.clamp(hitPoint.y, 0.25, 4.9),
          -3.1,
        );
      }
    };

    const onPointerDown = (e: PointerEvent) => {
      isDown = true; downDist = 0; downX = e.clientX; downY = e.clientY;
      updatePointer(e.clientX, e.clientY);
    };
    const onPointerMove = (e: PointerEvent) => {
      updatePointer(e.clientX, e.clientY);
      if (!isDown) return;
      const dx = e.clientX - downX;
      const dy = e.clientY - downY;
      downDist = Math.max(downDist, Math.hypot(dx, dy));
      yawTarget = THREE.MathUtils.clamp(dx * 0.0011, -0.25, 0.25);
      pitchTarget = THREE.MathUtils.clamp(-dy * 0.0005, -0.08, 0.08);
    };
    const onPointerUp = (e: PointerEvent) => {
      const wasTap = isDown && downDist < 6;
      isDown = false;
      yawTarget = 0; pitchTarget = 0;
      if (!wasTap) return;
      updatePointer(e.clientX, e.clientY);
      const hits = raycaster.intersectObjects(hitMeshes, false);
      if (hits.length > 0) {
        tapRef.current(hits[0].object.userData.objectIndex as number);
      }
    };

    const el = renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    const onResize = () => {
      const w = mount.clientWidth || width;
      const h = mount.clientHeight || height;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    let raf = 0;
    let running = true;
    const clock = new THREE.Clock();

    const loop = () => {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      const t = clock.getElapsedTime();
      const now = performance.now();

      beamPoint.lerp(beamTarget, 0.14);
      spot.target.position.copy(beamPoint);

      // volumetric cone follows the smoothed beam
      beamCone.position.copy(spot.position);
      beamCone.lookAt(beamPoint);
      {
        const beamDist = spot.position.distanceTo(beamPoint);
        const beamRadius = Math.tan(spot.angle) * beamDist;
        beamCone.scale.set(beamRadius, beamRadius, beamDist);
      }

      // dust drift — slow y sway per-point phase + tiny x/z drift
      {
        const attr = dustGeo.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < DUST_COUNT; i++) {
          const phase = dustPhases[i];
          dustPositions[i * 3] = dustBase[i * 3] + Math.sin(t * 0.12 + phase) * 0.18;
          dustPositions[i * 3 + 1] = dustBase[i * 3 + 1] + Math.sin(t * 0.25 + phase * 1.7) * 0.12;
          dustPositions[i * 3 + 2] = dustBase[i * 3 + 2] + Math.cos(t * 0.09 + phase) * 0.12;
        }
        attr.needsUpdate = true;
      }

      yawCur += (yawTarget - yawCur) * 0.08;
      pitchCur += (pitchTarget - pitchCur) * 0.08;
      camera.rotation.order = 'YXZ';
      camera.rotation.y = -yawCur;
      camera.rotation.x = pitchCur;

      rigs.forEach((rig, i) => {
        const isFound = foundRef.current.has(i);
        const d = beamPoint.distanceTo(rig.pos);
        let target = THREE.MathUtils.clamp(1.12 - d / 2.4, 0.06, 1);
        if (isFound) target = Math.max(target, 0.92);
        rig.brightness += (target - rig.brightness) * 0.18;
        const b = rig.brightness;
        if (isFound) rig.mat.color.setRGB(1.3 * b, 1.12 * b, 0.55 * b);
        else rig.mat.color.setScalar(b);
        rig.badge.visible = isFound;

        let y = rig.baseY + Math.sin(t * 1.35 + rig.phase) * 0.05;
        if (isFound) y += 0.3;
        rig.sprite.position.y += (y - rig.sprite.position.y) * 0.12;
        rig.badge.position.y = rig.sprite.position.y + 0.4;

        const shakeUntil = shakeRef.current.get(i);
        if (shakeUntil && now < shakeUntil) {
          rig.sprite.position.x = rig.baseX + Math.sin(now * 0.09) * 0.055;
        } else if (rig.sprite.position.x !== rig.baseX) {
          rig.sprite.position.x = rig.baseX;
        }
      });

      renderer.render(scene, camera);
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
    raf = requestAnimationFrame(loop);

    return () => {
      stopLoop();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('pointerdown', onPointerDown);
      disposeObject(scene);
      beamAlphaTex.dispose();
      badgeTex.dispose();
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch { /* ignore */ }
      if (el.parentElement === mount) mount.removeChild(el);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const foundObjects = objects.filter((_, i) => foundSet.has(i));

  return (
    <div className="card pop-in">
      <div className="note" style={{ marginBottom: 14 }}>{content.instructions}</div>

      <div ref={mountRef} className="fl3d-room" aria-label="חדר תלת ממדי חשוך — הזיזו את הפנס ומצאו את החפצים" />

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
        <span className="muted" style={{ alignSelf: 'center' }}>הזיזו אצבע או עכבר כדי לכוון את אלומת הפנס 🔦</span>
      </div>
      {torchMsg ? <div className="fl-msg pop-in">{torchMsg}</div> : null}

      {done ? <div className="fl-success pop-in">🎉 מצאתם את כל החפצים של {celebrantName}!</div> : null}
    </div>
  );
}
