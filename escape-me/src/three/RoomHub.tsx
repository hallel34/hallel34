import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { StageType } from '../types';
import { disposeObject, makeBadgeTexture, makeClapperTexture, makeDustTexture, makeEmojiTexture, makeGlowTexture, makeLabelTexture, makePhotoTexture, PHOTO } from './canvasTextures';
import './room-hub.css';

export interface RoomHubStage {
  type: StageType;
  title: string;
  emoji: string;
}

interface RoomHubProps {
  celebrantName: string;
  stages: RoomHubStage[];
  completed: boolean[];
  nextIndex: number;
  onEnter: (index: number) => void;
}

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

interface PortalRig {
  group: THREE.Group;
  innerMat: THREE.MeshStandardMaterial;
  spillMat: THREE.MeshBasicMaterial | null;
  state: 'done' | 'next' | 'locked';
  accent: number;
  wiggleUntil: number;
  phase: number;
}

export default function RoomHub({ celebrantName, stages, completed, nextIndex, onEnter }: RoomHubProps) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const onEnterRef = useRef(onEnter);
  useEffect(() => { onEnterRef.current = onEnter; }, [onEnter]);

  // The hub remounts on every entry (parent phase switch), so the scene is
  // built once from the props snapshot of this mount.
  const snapshotRef = useRef({ stages, completed, nextIndex });
  snapshotRef.current = { stages, completed, nextIndex };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const { stages: snapStages, completed: snapCompleted, nextIndex: snapNext } = snapshotRef.current;

    const width = mount.clientWidth || 360;
    const height = mount.clientHeight || 480;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.03;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.domElement.className = 'room-hub-canvas-el';
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x2a1e17);

    const camera = new THREE.PerspectiveCamera(66, width / height, 0.1, 60);
    camera.position.set(0, 1.85, 8.3);

    // ---- lights ----
    scene.add(new THREE.HemisphereLight(0xfff2d9, 0x5c3d21, 0.95));
    scene.add(new THREE.AmbientLight(0xffe9c4, 0.35));
    const key = new THREE.PointLight(0xffd9a0, 55, 30, 1.8);
    key.position.set(0, 4.4, 3.2);
    scene.add(key);
    const spot = new THREE.SpotLight(0xffe2b0, 130, 34, 0.65, 0.9, 1.6);
    spot.position.set(0, 6, 5);
    spot.target.position.set(0, 1.2, -2);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0004;
    scene.add(spot);
    scene.add(spot.target);

    // ---- room shell ----
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(17, 12),
      new THREE.MeshStandardMaterial({ map: makePhotoTexture(PHOTO.floor, { repeat: [3, 2] }), roughness: 0.55, metalness: 0 }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, 1);
    floor.receiveShadow = true;
    scene.add(floor);

    const wallMat = new THREE.MeshStandardMaterial({ map: makePhotoTexture(PHOTO.wall, { repeat: [2, 1] }), color: 0xe6c99b, roughness: 0.95 });
    const backWall = new THREE.Mesh(new THREE.PlaneGeometry(17, 6.5), wallMat);
    backWall.position.set(0, 3.25, -3.4);
    scene.add(backWall);
    const sideMat = new THREE.MeshStandardMaterial({ map: makePhotoTexture(PHOTO.wall, { repeat: [1.6, 1] }), color: 0xe6c99b, roughness: 0.95 });
    const leftWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 6.5), sideMat);
    leftWall.rotation.y = Math.PI / 2;
    leftWall.position.set(-8.5, 3.25, 1);
    scene.add(leftWall);
    const rightWall = new THREE.Mesh(new THREE.PlaneGeometry(12, 6.5), sideMat);
    rightWall.rotation.y = -Math.PI / 2;
    rightWall.position.set(8.5, 3.25, 1);
    scene.add(rightWall);
    // v2 iteration: a dark wood ceiling closes the room — looking up no longer
    // reveals the void above the walls.
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(17, 12),
      new THREE.MeshStandardMaterial({ map: makePhotoTexture(PHOTO.desk, { repeat: [3, 2] }), color: 0x59422a, roughness: 1 }),
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, 6.5, 1);
    scene.add(ceiling);

    const rugUnder = new THREE.Mesh(
      new THREE.PlaneGeometry(5.7, 3.9),
      new THREE.MeshStandardMaterial({ color: 0x2a1a0e, roughness: 1 }),
    );
    rugUnder.rotation.x = -Math.PI / 2;
    rugUnder.position.set(0, 0.008, 1.5);
    scene.add(rugUnder);
    const rugTex = makePhotoTexture(PHOTO.rug, { mirror: false });
    rugTex.wrapS = THREE.ClampToEdgeWrapping;
    rugTex.wrapT = THREE.ClampToEdgeWrapping;
    const rug = new THREE.Mesh(
      new THREE.PlaneGeometry(5.4, 3.6),
      new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 }),
    );
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.015, 1.5);
    scene.add(rug);

    // ---- director's desk + clapperboard (side prop) ----
    const desk = new THREE.Group();
    const deskMat = new THREE.MeshStandardMaterial({ map: makePhotoTexture(PHOTO.desk), roughness: 0.6 });
    const deskTop = new THREE.Mesh(new THREE.BoxGeometry(1.9, 0.1, 0.85), deskMat);
    deskTop.position.y = 0.78;
    deskTop.castShadow = true;
    desk.add(deskTop);
    const legGeo = new THREE.BoxGeometry(0.09, 0.78, 0.09);
    [[-0.85, -0.33], [0.85, -0.33], [-0.85, 0.33], [0.85, 0.33]].forEach(([lx, lz]) => {
      const leg = new THREE.Mesh(legGeo, deskMat);
      leg.position.set(lx, 0.39, lz);
      leg.castShadow = true;
      desk.add(leg);
    });
    // Practical lamp on the desk (warm point light, flickers in the loop)
    const lampMat = new THREE.MeshStandardMaterial({ color: 0x8a6a34, metalness: 0.6, roughness: 0.4 });
    const lamp = new THREE.Group();
    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.11, 0.03, 16), lampMat);
    lampBase.position.y = 0.015;
    lampBase.castShadow = true;
    lamp.add(lampBase);
    const lampStem = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 0.38, 8), lampMat);
    lampStem.position.y = 0.22;
    lampStem.castShadow = true;
    lamp.add(lampStem);
    const lampShadeMat = new THREE.MeshStandardMaterial({
      color: 0x8a6a34, metalness: 0.6, roughness: 0.4,
      emissive: 0xffc37a, emissiveIntensity: 1.6, side: THREE.DoubleSide,
    });
    const lampShade = new THREE.Mesh(new THREE.ConeGeometry(0.17, 0.19, 24, 1, true), lampShadeMat);
    lampShade.position.y = 0.46;
    lampShade.castShadow = true;
    lamp.add(lampShade);
    const lampLight = new THREE.PointLight(0xffc37a, 14, 9, 1.8);
    lampLight.position.y = 0.42;
    lamp.add(lampLight);
    lamp.position.set(-0.62, 0.83, 0.1);
    desk.add(lamp);
    const consoleBox = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 0.16, 0.55),
      new THREE.MeshStandardMaterial({ color: 0x33231a, roughness: 0.6 }),
    );
    consoleBox.position.set(0, 0.91, 0);
    consoleBox.rotation.x = -0.18;
    desk.add(consoleBox);
    const clapper = new THREE.Group();
    const clapBoard = new THREE.Mesh(
      new THREE.BoxGeometry(0.72, 0.5, 0.05),
      new THREE.MeshStandardMaterial({ color: 0x1c1c1c, roughness: 0.7 }),
    );
    clapper.add(clapBoard);
    const clapTop = new THREE.Mesh(
      new THREE.BoxGeometry(0.74, 0.13, 0.055),
      new THREE.MeshStandardMaterial({ map: makeClapperTexture(), roughness: 0.7 }),
    );
    clapTop.position.set(0, 0.33, 0);
    clapTop.rotation.z = 0.16;
    clapper.add(clapTop);
    clapper.position.set(0.1, 1.32, 0);
    clapper.rotation.x = -0.12;
    desk.add(clapper);
    desk.position.set(-4.9, 0, -2.5);
    desk.rotation.y = 0.5;
    scene.add(desk);

    // ---- framed photos on the walls ----
    const photoFrameMat = new THREE.MeshStandardMaterial({ color: 0x3a2415, roughness: 0.7 });
    const addFramedPhoto = (url: string, w: number, h: number, pos: [number, number, number], rotY: number, tilt: number) => {
      const g = new THREE.Group();
      const frame = new THREE.Mesh(new THREE.BoxGeometry(w + 0.12, h + 0.12, 0.06), photoFrameMat);
      frame.castShadow = true;
      g.add(frame);
      const artTex = makePhotoTexture(url, { mirror: false });
      artTex.wrapS = THREE.ClampToEdgeWrapping;
      artTex.wrapT = THREE.ClampToEdgeWrapping;
      const art = new THREE.Mesh(
        new THREE.PlaneGeometry(w, h),
        new THREE.MeshStandardMaterial({ map: artTex, roughness: 0.9 }),
      );
      art.position.z = 0.035;
      g.add(art);
      g.position.set(pos[0], pos[1], pos[2]);
      g.rotation.y = rotY;
      g.rotation.z = tilt;
      scene.add(g);
    };
    addFramedPhoto(PHOTO.alley, 1.9, 1.27, [-5.6, 4.6, -3.32], 0, 0.018);
    addFramedPhoto(PHOTO.sunset, 1.9, 1.27, [5.6, 4.6, -3.32], 0, -0.015);
    addFramedPhoto(PHOTO.cameraArt, 2.1, 1.4, [-8.42, 3.4, 1.5], Math.PI / 2, 0.02);

    // ---- dust motes drifting in the light ----
    const DUST_COUNT = 130;
    const dustBase = new Float32Array(DUST_COUNT * 3);
    const dustPhase = new Float32Array(DUST_COUNT);
    const dustSpeed = new Float32Array(DUST_COUNT);
    const dustPositions = new Float32Array(DUST_COUNT * 3);
    for (let i = 0; i < DUST_COUNT; i++) {
      dustBase[i * 3] = -6.5 + Math.random() * 13;
      dustBase[i * 3 + 1] = 0.3 + Math.random() * 4.9;
      dustBase[i * 3 + 2] = -3.2 + Math.random() * 7.7;
      dustPhase[i] = Math.random() * Math.PI * 2;
      dustSpeed[i] = 0.04 + Math.random() * 0.07;
      dustPositions[i * 3] = dustBase[i * 3];
      dustPositions[i * 3 + 1] = dustBase[i * 3 + 1];
      dustPositions[i * 3 + 2] = dustBase[i * 3 + 2];
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
      map: makeDustTexture(), size: 0.06, transparent: true, opacity: 0.45,
      depthWrite: false, blending: THREE.AdditiveBlending, color: 0xffe6b8,
    }));
    scene.add(dust);

    // ---- string lights along the back wall ----
    const bulbGeo = new THREE.SphereGeometry(0.075, 10, 10);
    const bulbMat = new THREE.MeshStandardMaterial({
      color: 0xffca66, emissive: 0xffb52e, emissiveIntensity: 2.4, roughness: 0.4,
    });
    const bulbGlowTex = makeGlowTexture();
    for (let i = 0; i < 9; i++) {
      const bulb = new THREE.Mesh(bulbGeo, bulbMat);
      const bx = -5.6 + i * 1.4;
      const by = 4.35 - Math.sin((i / 8) * Math.PI) * 0.22 - (i % 2) * 0.07;
      bulb.position.set(bx, by, -3.25);
      scene.add(bulb);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: bulbGlowTex, transparent: true, opacity: 0.5,
        blending: THREE.AdditiveBlending, depthWrite: false,
      }));
      glow.scale.set(0.55, 0.55, 1);
      glow.position.set(bx, by, -3.25);
      scene.add(glow);
    }

    // ---- portals ----
    const portals: PortalRig[] = [];
    const hitMeshes: THREE.Object3D[] = [];
    const frameMat = new THREE.MeshStandardMaterial({ color: 0x5c3d21, roughness: 0.8 });
    const badgeTex = makeBadgeTexture();
    const doorTex = makePhotoTexture(PHOTO.door, { mirror: false });
    doorTex.wrapS = THREE.ClampToEdgeWrapping;
    doorTex.wrapT = THREE.ClampToEdgeWrapping;
    const spillTex = makeGlowTexture();

    snapStages.forEach((st, i) => {
      const accent = ACCENTS[st.type];
      const state: PortalRig['state'] = snapCompleted[i] ? 'done' : i === snapNext ? 'next' : 'locked';
      const group = new THREE.Group();
      // RTL: stage 1 sits at the right, later stages progress leftward
      const x = 3.2 - i * 1.6;
      const z = -1.55 + (2 - Math.abs(i - 2)) * 0.3;
      group.position.set(x, 0, z);
      group.rotation.y = -x * 0.07;

      const innerMat = new THREE.MeshStandardMaterial({
        map: doorTex,
        color: state === 'locked' ? 0x6f6a63 : state === 'done' ? 0xcfc4b2 : 0xffffff,
        emissive: state === 'locked' ? 0x000000 : state === 'done' ? accent : 0xff9a3c,
        emissiveMap: state === 'next' ? doorTex : null,
        emissiveIntensity: state === 'next' ? 0.36 : state === 'done' ? 0.12 : 0,
        roughness: 0.35,
      });
      const inner = new THREE.Mesh(new THREE.PlaneGeometry(1.24, 2.04), innerMat);
      inner.position.set(0, 1.28, 0.03);
      inner.userData.portalIndex = i;
      group.add(inner);
      hitMeshes.push(inner);

      let spillMat: THREE.MeshBasicMaterial | null = null;
      if (state === 'next') {
        spillMat = new THREE.MeshBasicMaterial({
          map: spillTex, transparent: true, opacity: 0.45,
          blending: THREE.AdditiveBlending, depthWrite: false,
        });
        const spill = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.7), spillMat);
        spill.rotation.x = -Math.PI / 2;
        spill.position.set(0, 0.02, 1.1);
        group.add(spill);
      }

      const sideGeoV = new THREE.BoxGeometry(0.15, 2.32, 0.14);
      const sideGeoH = new THREE.BoxGeometry(1.54, 0.15, 0.14);
      const mkBar = (geo: THREE.BoxGeometry, bx: number, by: number) => {
        const bar = new THREE.Mesh(geo, frameMat);
        bar.position.set(bx, by, 0);
        bar.castShadow = true;
        bar.userData.portalIndex = i;
        group.add(bar);
        hitMeshes.push(bar);
      };
      mkBar(sideGeoV, -0.7, 1.28);
      mkBar(sideGeoV, 0.7, 1.28);
      mkBar(sideGeoH, 0, 2.42);
      mkBar(sideGeoH, 0, 0.14);

      const emojiSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeEmojiTexture(st.emoji), transparent: true, depthWrite: false }));
      emojiSprite.scale.set(0.55, 0.55, 1);
      emojiSprite.position.set(0, 1.98, 0.09);
      group.add(emojiSprite);

      const labelSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: makeLabelTexture(st.title), transparent: true, depthWrite: false }));
      labelSprite.scale.set(1.95, 0.49, 1);
      labelSprite.position.set(0, 2.8, 0.1);
      group.add(labelSprite);

      if (state === 'done') {
        const badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: badgeTex, transparent: true, depthWrite: false }));
        badge.scale.set(0.52, 0.52, 1);
        badge.position.set(0.48, 2.3, 0.16);
        group.add(badge);
      }

      scene.add(group);
      portals.push({ group, innerMat, spillMat, state, accent, wiggleUntil: 0, phase: i * 1.37 });
    });

    // ---- interaction state ----
    let yawCur = 0; let pitchCur = 0;
    let yawDrag = 0; let pitchDrag = 0;
    let yawOrient = 0;
    let orientCalib: number | null = null;
    let lastInputAt = performance.now();
    let downX = 0; let downY = 0; let downYaw = 0; let downPitch = 0;
    let isDown = false; let downDist = 0;

    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();

    const setNdc = (clientX: number, clientY: number) => {
      const rect = renderer.domElement.getBoundingClientRect();
      ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -(((clientY - rect.top) / rect.height) * 2 - 1));
    };

    const onPointerDown = (e: PointerEvent) => {
      isDown = true; downDist = 0;
      downX = e.clientX; downY = e.clientY;
      downYaw = yawDrag; downPitch = pitchDrag;
      lastInputAt = performance.now();
    };
    const onPointerMove = (e: PointerEvent) => {
      if (!isDown) return;
      const dx = e.clientX - downX;
      const dy = e.clientY - downY;
      downDist = Math.max(downDist, Math.hypot(dx, dy));
      yawDrag = THREE.MathUtils.clamp(downYaw + dx * 0.0032, -0.55, 0.55);
      pitchDrag = THREE.MathUtils.clamp(downPitch - dy * 0.0018, -0.1, 0.26);
      lastInputAt = performance.now();
    };
    const onPointerUp = (e: PointerEvent) => {
      const wasTap = isDown && downDist < 6;
      isDown = false;
      lastInputAt = performance.now();
      if (!wasTap) return;
      setNdc(e.clientX, e.clientY);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObjects(hitMeshes, false);
      if (hits.length === 0) return;
      const idx = hits[0].object.userData.portalIndex as number;
      if (idx === snapNext) {
        onEnterRef.current(idx);
      } else if (portals[idx]) {
        portals[idx].wiggleUntil = performance.now() + 420;
      }
    };
    const onOrientation = (e: DeviceOrientationEvent) => {
      if (e.alpha === null) return;
      if (orientCalib === null) orientCalib = e.alpha;
      let delta = e.alpha - orientCalib;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      yawOrient = THREE.MathUtils.clamp(-THREE.MathUtils.degToRad(delta) * 0.55, -0.5, 0.5);
      lastInputAt = performance.now();
    };

    const el = renderer.domElement;
    el.style.touchAction = 'none';
    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('deviceorientation', onOrientation);

    const onResize = () => {
      const w = mount.clientWidth || width;
      const h = mount.clientHeight || height;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // ---- render loop (paused while hidden) ----
    let raf = 0;
    let running = true;
    const clock = new THREE.Clock();

    const loop = () => {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      const t = clock.getElapsedTime();
      const now = performance.now();

      const idle = now - lastInputAt > 3200;
      const sway = idle ? Math.sin(t * 0.35) * 0.05 : 0;
      const yawTarget = THREE.MathUtils.clamp(yawDrag + yawOrient + sway, -0.62, 0.62);
      const pitchTarget = pitchDrag + (idle ? Math.sin(t * 0.5) * 0.012 : 0);
      yawCur += (yawTarget - yawCur) * 0.07;
      pitchCur += (pitchTarget - pitchCur) * 0.07;
      camera.rotation.order = 'YXZ';
      camera.rotation.y = -yawCur;
      camera.rotation.x = pitchCur - 0.03;
      camera.position.y = 1.85 + Math.sin(t * 0.6) * 0.03;

      lampLight.intensity = 14 + Math.sin(t * 11.3) * 0.7 + Math.sin(t * 5.7 + 1.3) * 0.6;
      key.intensity = 55 * (1 + Math.sin(t * 9.1) * 0.018 + Math.sin(t * 4.3 + 0.7) * 0.012);

      const dustPos = dustGeo.getAttribute('position') as THREE.BufferAttribute;
      for (let i = 0; i < DUST_COUNT; i++) {
        const range = 4.9;
        const drift = (dustBase[i * 3 + 1] - 0.3 + t * dustSpeed[i]) % range;
        dustPos.setXYZ(
          i,
          dustBase[i * 3] + Math.sin(t * 0.3 + dustPhase[i]) * 0.15,
          0.3 + drift,
          dustBase[i * 3 + 2],
        );
      }
      dustPos.needsUpdate = true;

      portals.forEach((p) => {
        if (p.state === 'next') {
          p.innerMat.emissiveIntensity = 0.36 + Math.sin(t * 3.1) * 0.14;
          if (p.spillMat) p.spillMat.opacity = 0.45 + Math.sin(t * 3.1) * 0.1;
        }
        if (now < p.wiggleUntil) {
          const k = (p.wiggleUntil - now) / 420;
          const s = 1 + Math.sin(k * Math.PI * 5) * 0.07 * k;
          p.group.scale.set(s, s, 1);
        } else if (p.group.scale.x !== 1) {
          p.group.scale.set(1, 1, 1);
        }
        p.group.position.y = Math.sin(t * 1.1 + p.phase) * 0.02;
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
      window.removeEventListener('deviceorientation', onOrientation);
      el.removeEventListener('pointerdown', onPointerDown);
      disposeObject(scene);
      badgeTex.dispose();
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch { /* ignore */ }
      if (el.parentElement === mount) mount.removeChild(el);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const allDone = nextIndex >= stages.length;
  const nextStage = !allDone ? stages[nextIndex] : null;

  return (
    <div className="room-hub">
      <div ref={mountRef} className="room-hub-canvas" aria-hidden="true" />
      <div className="room-hub-top">
        <div className="room-hub-title">🎬 החדר של {celebrantName}</div>
        <div className="room-hub-chips">
          {stages.map((st, i) => {
            const cls = completed[i] ? 'room-hub-chip done' : i === nextIndex ? 'room-hub-chip next' : 'room-hub-chip';
            return (
              <span key={st.type} className={cls} title={st.title}>
                {completed[i] ? '✓' : i + 1} {st.emoji}
              </span>
            );
          })}
        </div>
      </div>
      <div className="room-hub-bottom">
        <div className="room-hub-hint">גררו כדי להסתכל סביב · הקישו על הפורטל הזוהר ✨</div>
        {nextStage ? (
          <button type="button" className="btn btn-coral btn-big" onClick={() => onEnter(nextIndex)}>
            ▶ לשלב הבא: {nextStage.title}
          </button>
        ) : (
          <div className="room-hub-alldone">🎉 סיימתם את כל השלבים!</div>
        )}
      </div>
    </div>
  );
}
