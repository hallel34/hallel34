import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import type { LifeOrderContent, StagePlayerProps } from '../types';
import { disposeObject, makeGlowTexture } from './canvasTextures';
import './life-order-race.css';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
// "Car Concept" — KhronosGroup/glTF-Sample-Assets (CC-BY 4.0; original model
// by Unity Fan, public domain). Prepared offline into src/assets/car.glb:
// Carmine Candy variant baked in, engine / hood-interior / wipers / pedals /
// license plate removed (Khronos trademarks are excluded from the license
// and were stripped), glass switched from transmission to cheap transparency,
// textures WebP <=1024, geometry meshopt-compressed (11.8MB -> 2.5MB).
import carModelUrl from '../assets/car.glb?url';

/**
 * LifeOrderRace — the "מה לפני מה" stage as a real 3D car race (v3 flagship; v4: professional GLTF car + full scene upgrade).
 *
 * The celebrant's life stations stand as checkpoint gates across a golden-hour
 * highway. The player drives (drag / arrow keys / A,D / passive tilt) and must
 * pass through the gate of the station that comes NEXT in the life story.
 * Correct gate: +30 and a chime. Wrong gate: crash, −20, and the same
 * checkpoint is re-dealt further down the road. Crossing the finish arch
 * after the last station completes the stage via api.finish().
 *
 * Scoring mirrors the other flagship stages (flashlight 3D: +30 / −20).
 * The 2D LifeOrder remains the fallback when WebGL is unavailable.
 */

const CAR_Z = 2.4;
const CRUISE = 25;
const FIRST_GATE = 58;
const GATE_SPACING = 64;
const RETRY_SHIFT = 42;
const FINISH_GAP = 46;
const LANE_SETS: Record<number, number[]> = {
  1: [0],
  2: [-1.9, 1.9],
  3: [-3.1, 0, 3.1],
};

/* ---------------- audio: tiny WebAudio synth ---------------- */

class RaceAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private muted = false;

  start(): void {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.9;
        this.master.connect(this.ctx.destination);
        // engine: two detuned oscillators through a lowpass, gain follows speed
        this.engineFilter = this.ctx.createBiquadFilter();
        this.engineFilter.type = 'lowpass';
        this.engineFilter.frequency.value = 320;
        this.engineGain = this.ctx.createGain();
        this.engineGain.gain.value = 0;
        this.engineOsc = this.ctx.createOscillator();
        this.engineOsc.type = 'sawtooth';
        this.engineOsc.frequency.value = 52;
        this.engineOsc2 = this.ctx.createOscillator();
        this.engineOsc2.type = 'square';
        this.engineOsc2.frequency.value = 26;
        this.engineOsc.connect(this.engineFilter);
        this.engineOsc2.connect(this.engineFilter);
        this.engineFilter.connect(this.engineGain);
        this.engineGain.connect(this.master);
        this.engineOsc.start();
        this.engineOsc2.start();
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    } catch { /* audio is best-effort */ }
  }

  setEngine(norm: number, running: boolean): void {
    if (!this.ctx || !this.engineGain || !this.engineOsc || !this.engineOsc2 || !this.engineFilter) return;
    try {
      const t = this.ctx.currentTime;
      const n = Math.max(0, Math.min(1.15, norm));
      this.engineOsc.frequency.setTargetAtTime(50 + n * 78, t, 0.08);
      this.engineOsc2.frequency.setTargetAtTime(25 + n * 39, t, 0.08);
      this.engineFilter.frequency.setTargetAtTime(280 + n * 420, t, 0.1);
      this.engineGain.gain.setTargetAtTime(running ? 0.028 + n * 0.02 : 0, t, 0.12);
    } catch { /* ignore */ }
  }

  private blip(freq: number, at: number, dur: number, gain: number, type: OscillatorType = 'sine'): void {
    if (!this.ctx || !this.master) return;
    try {
      const t0 = this.ctx.currentTime + at;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0, t0);
      g.gain.linearRampToValueAtTime(gain, t0 + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + dur + 0.05);
    } catch { /* ignore */ }
  }

  chime(): void {
    this.blip(880, 0, 0.28, 0.16);
    this.blip(1318.5, 0.07, 0.4, 0.16);
    this.blip(1760, 0.14, 0.34, 0.08, 'triangle');
  }

  crash(): void {
    if (!this.ctx || !this.master) return;
    try {
      const t0 = this.ctx.currentTime;
      const len = Math.floor(this.ctx.sampleRate * 0.28);
      const buffer = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = this.ctx.createBufferSource();
      src.buffer = buffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 420;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.5, t0);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.3);
      src.connect(filter);
      filter.connect(g);
      g.connect(this.master);
      src.start(t0);
      const osc = this.ctx.createOscillator();
      const og = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, t0);
      osc.frequency.exponentialRampToValueAtTime(38, t0 + 0.3);
      og.gain.setValueAtTime(0.4, t0);
      og.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.32);
      osc.connect(og);
      og.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + 0.35);
    } catch { /* ignore */ }
  }

  fanfare(): void {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => this.blip(f, i * 0.09, 0.5, 0.14, 'triangle'));
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx && this.master) {
      try { this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.03); } catch { /* ignore */ }
    }
  }

  dispose(): void {
    try { this.engineOsc?.stop(); } catch { /* ignore */ }
    try { this.engineOsc2?.stop(); } catch { /* ignore */ }
    if (this.ctx) { void this.ctx.close().catch(() => undefined); }
    this.ctx = null;
  }
}

/* ---------------- canvas textures ---------------- */

function makeSkyTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 512;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, 512);
    g.addColorStop(0, '#352257');
    g.addColorStop(0.34, '#743a63');
    g.addColorStop(0.52, '#c2543c');
    g.addColorStop(0.68, '#f07f3c');
    g.addColorStop(0.84, '#ffb85e');
    g.addColorStop(1, '#ffe6ae');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 1024, 512);
    const sun = ctx.createRadialGradient(512, 408, 8, 512, 408, 210);
    sun.addColorStop(0, 'rgba(255,236,180,0.95)');
    sun.addColorStop(0.25, 'rgba(255,196,110,0.55)');
    sun.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = sun;
    ctx.fillRect(0, 0, 1024, 512);
    // soft horizontal cloud bands catching the sunset light
    const band = (x: number, y: number, rx: number, ry: number, a: number) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, ry / rx);
      const cg = ctx.createRadialGradient(0, 0, 0, 0, 0, rx);
      cg.addColorStop(0, `rgba(255,196,150,${a})`);
      cg.addColorStop(1, 'rgba(255,196,150,0)');
      ctx.fillStyle = cg;
      ctx.fillRect(-rx, -rx, rx * 2, rx * 2);
      ctx.restore();
    };
    band(300, 66, 300, 13, 0.16);
    band(700, 108, 240, 10, 0.13);
    band(210, 152, 340, 16, 0.12);
    band(760, 190, 190, 9, 0.14);
    band(420, 238, 280, 12, 0.10);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function makeAsphaltTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#35312d';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      const v = 38 + Math.random() * 46;
      ctx.fillStyle = `rgba(${v + 18},${v + 8},${v},${0.16 + Math.random() * 0.2})`;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 1.6, 1.6);
    }
    for (let i = 0; i < 26; i++) {
      ctx.fillStyle = 'rgba(0,0,0,0.13)';
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 14 + Math.random() * 30, 3 + Math.random() * 5);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function makeAsphaltRoughnessTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#e6e6e6';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2200; i++) {
      const v = 192 + Math.floor(Math.random() * 58);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 2, 2);
    }
    // polished (smoother, slightly reflective) tire tracks under the wheels
    for (const x of [98, 144]) {
      const g = ctx.createLinearGradient(x, 0, x + 16, 0);
      g.addColorStop(0, 'rgba(148,148,148,0)');
      g.addColorStop(0.5, 'rgba(148,148,148,0.6)');
      g.addColorStop(1, 'rgba(148,148,148,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, 0, 16, 256);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const w of words) {
    const probe = line ? `${line} ${w}` : w;
    if (ctx.measureText(probe).width <= maxWidth || !line) line = probe;
    else { lines.push(line); line = w; }
  }
  if (line) lines.push(line);
  return lines.slice(0, 2);
}

function makeGateBannerTexture(emoji: string, label: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 768; c.height = 432;
  const ctx = c.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 0, 432);
    grad.addColorStop(0, '#faf0d4');
    grad.addColorStop(0.5, '#f4e2ae');
    grad.addColorStop(1, '#ecd49c');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(9, 9, 750, 414, 38);
    ctx.fill();
    ctx.strokeStyle = '#b8862e';
    ctx.lineWidth = 10;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(138,90,29,0.55)';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.roundRect(30, 30, 708, 372, 26);
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '132px "Segoe UI Emoji", "Noto Emoji", sans-serif';
    ctx.fillText(emoji, 384, 124);

    ctx.direction = 'rtl';
    ctx.fillStyle = '#4a2c14';
    ctx.shadowColor = 'rgba(122,74,20,0.35)';
    ctx.shadowBlur = 5;
    let size = 76;
    ctx.font = `800 ${size}px Heebo, Arial, sans-serif`;
    let lines = wrapText(ctx, label, 664);
    while (size > 38 && (lines.length > 2 || lines.some((l) => ctx.measureText(l).width > 664))) {
      size -= 5;
      ctx.font = `800 ${size}px Heebo, Arial, sans-serif`;
      lines = wrapText(ctx, label, 664);
    }
    const lineH = size * 1.22;
    const startY = lines.length > 1 ? 292 : 306;
    lines.forEach((l, i) => ctx.fillText(l, 384, startY + (i - (lines.length - 1) / 2) * lineH));
    ctx.shadowBlur = 0;
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function makeFinishBannerTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 256;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#241608';
    ctx.fillRect(0, 0, 1024, 256);
    const sq = 32;
    for (let y = 0; y < 2; y++) {
      for (let x = 0; x < 1024 / sq; x++) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#f5efe2' : '#17130f';
        ctx.fillRect(x * sq, y * sq, sq, sq);
      }
    }
    ctx.strokeStyle = '#e9c56a';
    ctx.lineWidth = 6;
    ctx.strokeRect(6, 6, 1012, 244);
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.font = '900 96px Heebo, Arial, sans-serif';
    ctx.fillStyle = '#ffebbe';
    ctx.shadowColor = 'rgba(255,176,66,0.9)';
    ctx.shadowBlur = 16;
    ctx.fillText('🏁 קו הסיום', 512, 158);
    ctx.shadowBlur = 0;
    ctx.font = '700 44px Heebo, Arial, sans-serif';
    ctx.fillStyle = '#ffd98a';
    ctx.fillText('הגענו ליעד — בת המצווה!', 512, 224);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ---------------- helpers ---------------- */

function shuffledIdx(n: number): number[] {
  const arr = Array.from({ length: n }, (_, i) => i);
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

interface GateDef { stationIdx: number; laneX: number; isCorrect: boolean }

function buildGateDefs(stationsCount: number, k: number): GateDef[] {
  const gateCount = Math.min(3, Math.max(1, stationsCount));
  const lanes = LANE_SETS[gateCount] ?? [0];
  const others = Array.from({ length: stationsCount }, (_, i) => i).filter((i) => i !== k);
  const future = shuffledIdx(others.filter((i) => i > k).length).map((j) => others.filter((i) => i > k)[j]);
  const pastSrc = others.filter((i) => i < k);
  const past = shuffledIdx(pastSrc.length).map((j) => pastSrc[j]);
  const decoys = [...future, ...past].slice(0, gateCount - 1);
  const stationAtLane = shuffledIdx(gateCount).map((slot) => slot); // permutation of slots
  const defs: GateDef[] = [];
  const picks = [k, ...decoys];
  stationAtLane.forEach((slot, laneIdx) => {
    const stationIdx = picks[slot];
    defs.push({ stationIdx, laneX: lanes[laneIdx], isCorrect: stationIdx === k });
  });
  return defs;
}

/* ---------------- component ---------------- */

export default function LifeOrderRace({ content, celebrantName, api }: StagePlayerProps<LifeOrderContent>) {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const apiRef = useRef(api);
  apiRef.current = api;
  const finishedRef = useRef(false);
  const audioRef = useRef<RaceAudio | null>(null);
  const startSignalRef = useRef<(() => void) | null>(null);
  const popupTimerRef = useRef(0);

  const [phaseUi, setPhaseUi] = useState<'ready' | 'racing' | 'finished'>('ready');
  const [hudDone, setHudDone] = useState(0);
  const [hudSpeed, setHudSpeed] = useState(0);
  const [popup, setPopup] = useState<{ id: number; kind: 'good' | 'bad'; text: string } | null>(null);
  const [muted, setMuted] = useState(false);

  const total = content.stations.length;

  const showPopup = (kind: 'good' | 'bad', text: string) => {
    setPopup({ id: Date.now() + Math.random(), kind, text });
    window.clearTimeout(popupTimerRef.current);
    popupTimerRef.current = window.setTimeout(() => setPopup(null), 1300);
  };
  const showPopupRef = useRef(showPopup);
  showPopupRef.current = showPopup;

  useEffect(() => () => {
    window.clearTimeout(popupTimerRef.current);
    audioRef.current?.dispose();
    audioRef.current = null;
  }, []);

  const startRace = () => {
    if (!audioRef.current) audioRef.current = new RaceAudio();
    audioRef.current.setMuted(muted);
    audioRef.current.start();
    setPhaseUi('racing');
    startSignalRef.current?.();
  };

  const toggleMute = () => {
    setMuted((m) => {
      audioRef.current?.setMuted(!m);
      return !m;
    });
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;
    const stations = content.stations;
    const n = stations.length;
    const reduceMotion = typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const width = mount.clientWidth || 360;
    const height = mount.clientHeight || 470;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.18;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const skyTex = makeSkyTexture();
    scene.background = skyTex;
    scene.fog = new THREE.Fog(0xf2a05c, 62, 300);

    const camera = new THREE.PerspectiveCamera(62, width / height, 0.1, 420);
    camera.position.set(0, 3.55, 8.8);

    /* selective bloom: a high threshold means only true highlights (lamp
       heads, gate light strips, brake lights, the sun) bloom — the scene
       itself stays crisp. Falls back to plain rendering if unsupported. */
    let composer: EffectComposer | null = null;
    let bloomPass: UnrealBloomPass | null = null;
    try {
      composer = new EffectComposer(renderer);
      composer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
      composer.setSize(width, height);
      composer.addPass(new RenderPass(scene, camera));
      bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height), 0.35, 0.55, 0.82);
      composer.addPass(bloomPass);
      composer.addPass(new OutputPass());
    } catch { composer = null; bloomPass = null; }

    const hemi = new THREE.HemisphereLight(0xffd9b0, 0x53381f, 0.95);
    scene.add(hemi);
    const sun = new THREE.DirectionalLight(0xffc98a, 2.3);
    sun.position.set(-14, 18, -30);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.camera.left = -10;
    sun.shadow.camera.right = 10;
    sun.shadow.camera.top = 10;
    sun.shadow.camera.bottom = -10;
    sun.shadow.camera.near = 2;
    sun.shadow.camera.far = 80;
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    sun.target.position.set(0, 0, -2);
    scene.add(sun);
    scene.add(sun.target);
    const fill = new THREE.DirectionalLight(0xffe6c4, 0.5);
    fill.position.set(6, 10, 14);
    scene.add(fill);

    /* Golden-hour environment reflections, PMREM-prefiltered from a tiny
       procedural sky scene (gradient dome + hot sun disc + horizon glow +
       warm ground bounce). This one texture is what makes the clearcoat
       paint, the steel gates and the asphalt share one believable light
       field instead of looking pasted together. */
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    {
      const dome = new THREE.Mesh(
        new THREE.SphereGeometry(60, 24, 16),
        new THREE.MeshBasicMaterial({ side: THREE.BackSide, map: makeSkyTexture() }),
      );
      envScene.add(dome);
      const sunDisc = new THREE.Mesh(
        new THREE.CircleGeometry(7, 24),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(7, 4.2, 2) }),
      );
      sunDisc.position.set(-18, 8, -48);
      sunDisc.lookAt(0, 1, 0);
      envScene.add(sunDisc);
      const glowStrip = new THREE.Mesh(
        new THREE.PlaneGeometry(110, 7),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(1.5, 0.75, 0.3) }),
      );
      glowStrip.position.set(0, 1.5, -52);
      envScene.add(glowStrip);
      const envGround = new THREE.Mesh(
        new THREE.CircleGeometry(55, 24),
        new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.17, 0.07) }),
      );
      envGround.rotation.x = -Math.PI / 2;
      envGround.position.y = -2;
      envScene.add(envGround);
    }
    const envTex = pmrem.fromScene(envScene, 0.04).texture;
    scene.environment = envTex;
    scene.environmentIntensity = 0.8;
    pmrem.dispose();

    /* ---- ground + road ---- */
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(240, 560),
      new THREE.MeshStandardMaterial({ color: 0x77522c, roughness: 1, envMapIntensity: 0.25 }),
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, -0.05, -220);
    ground.receiveShadow = true;
    scene.add(ground);

    const ROAD_LEN = 520;
    const roadTex = makeAsphaltTexture();
    roadTex.repeat.set(1, 92);
    const TILE = ROAD_LEN / 92;
    const roadRoughTex = makeAsphaltRoughnessTexture();
    roadRoughTex.repeat.set(1, 92);
    const road = new THREE.Mesh(
      new THREE.PlaneGeometry(11, ROAD_LEN),
      new THREE.MeshStandardMaterial({ map: roadTex, roughnessMap: roadRoughTex, roughness: 1, envMapIntensity: 0.55 }),
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0, -218);
    road.receiveShadow = true;
    scene.add(road);

    const edgeMat = new THREE.MeshStandardMaterial({ color: 0xe6d7b8, roughness: 0.5, envMapIntensity: 0.7, emissive: 0xff9c3a, emissiveIntensity: 0.1 });
    [-5.35, 5.35].forEach((x) => {
      const edge = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.025, ROAD_LEN), edgeMat);
      edge.position.set(x, 0.012, -218);
      scene.add(edge);
    });

    /* ---- layered mountain silhouettes: three jagged ranges at increasing
       distance, the fog hazes each layer paler than the one before it ---- */
    const ridgeLayer = (z: number, base: number, amp: number, color: number, seed: number) => {
      let s = seed;
      const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
      const shape = new THREE.Shape();
      shape.moveTo(-190, -2);
      let x = -190;
      while (x < 190) {
        const wdt = 14 + rnd() * 26;
        shape.lineTo(x + wdt / 2, base + rnd() * amp);
        shape.lineTo(x + wdt, base * 0.55 + rnd() * amp * 0.4);
        x += wdt;
      }
      shape.lineTo(190, -2);
      shape.closePath();
      const mesh = new THREE.Mesh(
        new THREE.ShapeGeometry(shape),
        new THREE.MeshBasicMaterial({ color }),
      );
      mesh.position.set(0, 0, z);
      scene.add(mesh);
    };
    ridgeLayer(-196, 7, 13, 0x7e4258, 1234567);
    ridgeLayer(-172, 4.5, 9, 0x93503c, 7654321);
    ridgeLayer(-150, 2.5, 6, 0x6e3524, 24681357);
    const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
      map: makeGlowTexture(), color: 0xffc98a, transparent: true, opacity: 0.85, depthWrite: false, fog: false,
    }));
    sunSprite.scale.set(48, 48, 1);
    sunSprite.position.set(-13, 9.5, -160);
    scene.add(sunSprite);

    /* ---- recycled scenery: dashes, lamps, trees ---- */
    interface SceneryItem { obj: THREE.Object3D; p: number }
    const WINDOW = 208;
    const dashes: SceneryItem[] = [];
    const dashMat = new THREE.MeshStandardMaterial({ color: 0xf5eeda, emissive: 0xffe9bb, emissiveIntensity: 0.15, roughness: 0.55, envMapIntensity: 0.6 });
    const dashGeo = new THREE.BoxGeometry(0.24, 0.03, 2.7);
    for (let p = 4; p < WINDOW; p += 8) {
      const dash = new THREE.Mesh(dashGeo, dashMat);
      scene.add(dash);
      dashes.push({ obj: dash, p });
    }

    const lamps: SceneryItem[] = [];
    const poleMat = new THREE.MeshStandardMaterial({ color: 0x2e2a26, roughness: 0.45, metalness: 0.7, envMapIntensity: 0.8 });
    for (let i = 0; i < 8; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 4.8, 8), poleMat);
      pole.position.y = 2.4;
      g.add(pole);
      const arm = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.12, 0.12), poleMat);
      arm.position.set(-side * 0.7, 4.75, 0);
      g.add(arm);
      const head = new THREE.Mesh(
        new THREE.SphereGeometry(0.21, 12, 10),
        new THREE.MeshStandardMaterial({ color: 0x664411, emissive: 0xffb45e, emissiveIntensity: 2.6 }),
      );
      head.position.set(-side * 1.35, 4.62, 0);
      g.add(head);
      const glow = new THREE.Sprite(new THREE.SpriteMaterial({
        map: makeGlowTexture(), color: 0xffbe78, transparent: true, opacity: 0.55, depthWrite: false,
      }));
      glow.scale.set(2.4, 2.4, 1);
      glow.position.copy(head.position);
      g.add(glow);
      g.position.x = side * 6.6;
      scene.add(g);
      lamps.push({ obj: g, p: 6 + i * 26 });
    }

    const trees: SceneryItem[] = [];
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x4a2f1a, roughness: 1 });
    const leafMats = [0x51632c, 0x67702c, 0x445c33].map((col) => new THREE.MeshStandardMaterial({ color: col, roughness: 1 }));
    for (let i = 0; i < 14; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const g = new THREE.Group();
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.2, 1.1, 7), trunkMat);
      trunk.position.y = 0.55;
      g.add(trunk);
      const s = 0.85 + ((i * 37) % 10) / 14;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(1.25 * s, 3.1 * s, 8), leafMats[i % leafMats.length]);
      cone.position.y = 1.1 + 1.5 * s;
      g.add(cone);
      g.position.x = side * (8.6 + ((i * 53) % 40) / 8);
      scene.add(g);
      trees.push({ obj: g, p: 2 + i * 15 + ((i * 29) % 7) });
    }

    /* ---- the car: a real GLTF concept car (attribution at the import) ---- */
    const car = new THREE.Group();
    const beam = new THREE.SpotLight(0xffd9a3, 130, 36, 0.5, 0.6, 1.4);
    beam.position.set(0, 0.7, -2.1);
    beam.target.position.set(0, 0, -16);
    car.add(beam);
    car.add(beam.target);

    const wheels: THREE.Object3D[] = [];
    let brakeMat: THREE.MeshStandardMaterial | null = null;
    let brakeGlow = 1.2;
    {
      const loader = new GLTFLoader();
      loader.setMeshoptDecoder(MeshoptDecoder);
      loader.load(
        carModelUrl,
        (gltf) => {
          if (!running) return; // unmounted before the model arrived
          const inner = new THREE.Group();
          inner.rotation.y = Math.PI; // the model faces +Z; the race drives toward -Z
          inner.position.z = 0.238; // recenter the model bbox on the car group
          inner.add(gltf.scene);
          car.add(inner);
          gltf.scene.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (!mesh.isMesh) return;
            mesh.castShadow = true;
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach((m) => {
              if (m && m.name === 'Brakelight') brakeMat = m as THREE.MeshStandardMaterial;
            });
          });
          ['WheelFrontL', 'WheelFrontR', 'WheelRearL', 'WheelRearR'].forEach((name) => {
            const w = gltf.scene.getObjectByName(name);
            if (w) wheels.push(w);
          });
        },
        undefined,
        () => { /* model failed to load — the race still runs (beam + blob) */ },
      );
    }
    car.position.set(0, 0, CAR_Z);
    scene.add(car);

    const blob = new THREE.Mesh(
      new THREE.CircleGeometry(1.85, 24),
      new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.2, depthWrite: false }),
    );
    blob.rotation.x = -Math.PI / 2;
    blob.scale.set(0.62, 1.18, 1);
    blob.position.set(0, 0.015, CAR_Z);
    scene.add(blob);

    /* ---- gates ---- */
    const postMat = new THREE.MeshStandardMaterial({ color: 0x2e2a26, roughness: 0.38, metalness: 0.85, envMapIntensity: 1.1 });
    const finialMat = new THREE.MeshStandardMaterial({ color: 0x8a6a34, emissive: 0xffb45e, emissiveIntensity: 0.7, roughness: 0.4, metalness: 0.5 });

    interface GateRig {
      group: THREE.Group;
      defs: GateDef[];
      mats: THREE.MeshBasicMaterial[];
      pos: number;
      resolved: boolean;
      flashUntil: number;
      popT0: number;
    }
    let rig: GateRig | null = null;

    const buildGateGroup = (defs: GateDef[]): GateRig => {
      const group = new THREE.Group();
      const mats: THREE.MeshBasicMaterial[] = [];
      defs.forEach((def) => {
        const st = stations[def.stationIdx];
        const gate = new THREE.Group();
        [-1.78, 1.78].forEach((dx) => {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 5.6, 0.3), postMat);
          post.position.set(def.laneX + dx, 2.8, 0);
          gate.add(post);
          const fin = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), finialMat);
          fin.position.set(def.laneX + dx, 5.78, 0);
          gate.add(fin);
        });
        const beamBar = new THREE.Mesh(new THREE.BoxGeometry(3.86, 0.3, 0.3), postMat);
        beamBar.position.set(def.laneX, 5.42, 0);
        gate.add(beamBar);
        const strip = new THREE.Mesh(
          new THREE.BoxGeometry(3.5, 0.07, 0.07),
          new THREE.MeshStandardMaterial({ color: 0x442200, emissive: 0xffa640, emissiveIntensity: 2.4 }),
        );
        strip.position.set(def.laneX, 5.22, 0);
        gate.add(strip);
        const backing = new THREE.Mesh(
          new THREE.PlaneGeometry(4.38, 2.54),
          new THREE.MeshStandardMaterial({ color: 0x201409, roughness: 0.6, metalness: 0.3 }),
        );
        backing.position.set(def.laneX, 4.06, -0.05);
        gate.add(backing);
        const bannerMat = new THREE.MeshBasicMaterial({ map: makeGateBannerTexture(st.emoji, st.label), side: THREE.DoubleSide });
        const banner = new THREE.Mesh(new THREE.PlaneGeometry(4.2, 2.36), bannerMat);
        banner.position.set(def.laneX, 4.06, 0);
        gate.add(banner);
        mats.push(bannerMat);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
          map: makeGlowTexture(), color: 0xffbe78, transparent: true, opacity: 0.3, depthWrite: false,
        }));
        glow.scale.set(5.6, 3.4, 1);
        glow.position.set(def.laneX, 4.06, -0.3);
        gate.add(glow);
        group.add(gate);
      });
      scene.add(group);
      return { group, defs, mats, pos: 0, resolved: false, flashUntil: 0, popT0: 0 };
    };

    /* ---- finish arch ---- */
    const finishGroup = new THREE.Group();
    [-5.6, 5.6].forEach((x) => {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.38, 6.6, 0.38), postMat);
      post.position.set(x, 3.3, 0);
      finishGroup.add(post);
      const fin = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), finialMat);
      fin.position.set(x, 6.85, 0);
      finishGroup.add(fin);
    });
    const finishBeam = new THREE.Mesh(new THREE.BoxGeometry(11.6, 0.34, 0.34), postMat);
    finishBeam.position.set(0, 6.35, 0);
    finishGroup.add(finishBeam);
    const finishStrip = new THREE.Mesh(
      new THREE.BoxGeometry(10.8, 0.08, 0.08),
      new THREE.MeshStandardMaterial({ color: 0x442200, emissive: 0xffa640, emissiveIntensity: 2.4 }),
    );
    finishStrip.position.set(0, 6.1, 0);
    finishGroup.add(finishStrip);
    const finishBanner = new THREE.Mesh(
      new THREE.PlaneGeometry(12.2, 3.05),
      new THREE.MeshBasicMaterial({ map: makeFinishBannerTexture(), side: THREE.DoubleSide }),
    );
    finishBanner.position.set(0, 4.9, 0);
    finishGroup.add(finishBanner);
    scene.add(finishGroup);

    /* ---- dust motes in the golden light ---- */
    const DUST = 70;
    const dustPos = new Float32Array(DUST * 3);
    const dustBase = new Float32Array(DUST * 3);
    for (let i = 0; i < DUST; i++) {
      dustBase[i * 3] = -9 + Math.random() * 18;
      dustBase[i * 3 + 1] = 0.4 + Math.random() * 4.4;
      dustBase[i * 3 + 2] = -70 + Math.random() * 85;
    }
    dustPos.set(dustBase);
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
      color: 0xffdf9e, size: 0.09, transparent: true, opacity: 0.4, depthWrite: false,
    }));
    dust.frustumCulled = false;
    scene.add(dust);

    /* ---- game state ---- */
    const positions: number[] = Array.from({ length: n }, (_, k) => FIRST_GATE + k * GATE_SPACING);
    let finishPos = (n > 0 ? positions[n - 1] : FIRST_GATE) + FINISH_GAP;
    const G = {
      running: false,
      finished: false,
      dist: 0,
      speed: 0,
      carX: 0,
      targetX: 0,
      done: 0,
      shakeUntil: 0,
      boostUntil: 0,
      crashSlowUntil: 0,
      finishAt: 0,
    };
    startSignalRef.current = () => { G.running = true; };

    const buildCurrentGate = () => {
      if (rig) { scene.remove(rig.group); disposeObject(rig.group); rig = null; }
      if (G.done >= n) return;
      rig = buildGateGroup(buildGateDefs(n, G.done));
      rig.pos = positions[G.done];
      rig.group.position.z = CAR_Z - (rig.pos - G.dist);
    };
    buildCurrentGate();

    /* ---- input ---- */
    let keyDir = 0;
    let lastPointerAt = -1e9;
    let tiltX = 0;
    const el = renderer.domElement;
    el.style.touchAction = 'none';

    const steerFromClientX = (clientX: number) => {
      const rect = el.getBoundingClientRect();
      if (rect.width <= 0) return;
      const frac = (clientX - rect.left) / rect.width;
      G.targetX = THREE.MathUtils.clamp((frac * 2 - 1) * 3.6, -3.6, 3.6);
      lastPointerAt = performance.now();
    };
    const onPointerDown = (e: PointerEvent) => { steerFromClientX(e.clientX); };
    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' || e.buttons > 0) steerFromClientX(e.clientX);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { keyDir = -1; lastPointerAt = performance.now(); e.preventDefault(); }
      else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { keyDir = 1; lastPointerAt = performance.now(); e.preventDefault(); }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (['ArrowLeft', 'ArrowRight', 'a', 'A', 'd', 'D'].includes(e.key)) keyDir = 0;
    };
    const onOrient = (e: DeviceOrientationEvent) => {
      if (typeof e.gamma === 'number') tiltX = THREE.MathUtils.clamp(e.gamma / 16, -1, 1);
    };
    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('deviceorientation', onOrient);

    const onResize = () => {
      const w = mount.clientWidth || width;
      const h = mount.clientHeight || height;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
      composer?.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    /* ---- resolution ---- */
    const resolveGate = (now: number) => {
      if (!rig || rig.resolved) return;
      rig.resolved = true;
      rig.popT0 = now;
      rig.flashUntil = now + 700;
      const nearest = rig.defs.reduce((best, d) => (Math.abs(d.laneX - G.carX) < Math.abs(best.laneX - G.carX) ? d : best), rig.defs[0]);
      if (nearest.isCorrect) {
        apiRef.current.addPoints(30);
        apiRef.current.feedback('good');
        audioRef.current?.chime();
        showPopupRef.current('good', `✓ ${stations[G.done].label} +30`);
        rig.defs.forEach((d, i) => {
          if (d.isCorrect) rig!.mats[i].color.setRGB(0.55, 1.9, 0.75);
          else rig!.mats[i].color.setRGB(0.5, 0.5, 0.5);
        });
        G.boostUntil = now + 800;
        G.done += 1;
        setHudDone(G.done);
      } else {
        apiRef.current.addPoints(-20);
        apiRef.current.feedback('bad');
        audioRef.current?.crash();
        showPopupRef.current('bad', '💥 זו לא התחנה הבאה! −20');
        rig.defs.forEach((d, i) => {
          if (d === nearest) rig!.mats[i].color.setRGB(2.1, 0.5, 0.42);
        });
        G.speed = 7;
        G.shakeUntil = now + 460;
        G.crashSlowUntil = now + 1500;
        for (let j = G.done; j < n; j++) positions[j] += RETRY_SHIFT;
        finishPos += RETRY_SHIFT;
      }
    };

    /* ---- main loop ---- */
    let raf = 0;
    let running = true;
    let last = performance.now();
    let lastSync = 0;

    const loop = () => {
      if (!running) return;
      raf = requestAnimationFrame(loop);
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const t = now / 1000;

      // speed profile
      let target = 0;
      if (G.running && !G.finished) {
        target = CRUISE;
        if (now < G.boostUntil) target = 31;
        if (now < G.crashSlowUntil) target = 11;
      }
      if (target > G.speed) G.speed = Math.min(target, G.speed + dt * 15);
      else G.speed = Math.max(target, G.speed - dt * (G.finished ? 16 : 30));
      G.dist += G.speed * dt;
      const speedNorm = G.speed / CRUISE;

      // steering
      if (keyDir !== 0) {
        G.carX = THREE.MathUtils.clamp(G.carX + keyDir * 10.5 * dt, -3.6, 3.6);
        G.targetX = G.carX;
      } else {
        if (now - lastPointerAt > 300 && Math.abs(tiltX) > 0.12 && G.running) G.targetX = tiltX * 3.3;
        const dx = G.targetX - G.carX;
        const step = THREE.MathUtils.clamp(dx * Math.min(1, dt * 9), -11 * dt, 11 * dt);
        G.carX += step;
      }

      // car visuals
      car.position.x = G.carX;
      car.position.y = G.running ? Math.sin(t * 21) * 0.012 * speedNorm : 0;
      const lean = THREE.MathUtils.clamp((G.targetX - G.carX) * 0.16, -0.3, 0.3);
      car.rotation.y = -lean * 0.55;
      car.rotation.z = lean * 0.4;
      wheels.forEach((w) => { w.rotation.x += (G.speed * dt) / 0.384; });
      if (brakeMat) {
        const braking = now < G.crashSlowUntil || G.finished || !G.running;
        const targetGlow = braking ? 3.6 : 1.2;
        brakeGlow += (targetGlow - brakeGlow) * Math.min(1, dt * 10);
        brakeMat.emissiveIntensity = brakeGlow;
      }
      blob.position.x = G.carX;

      // road scroll (asphalt grain) — dashes/lamps/trees carry the main motion cue
      roadTex.offset.y = (G.dist / TILE) % 1;
      roadRoughTex.offset.y = roadTex.offset.y;

      // scenery recycle + placement
      const place = (item: SceneryItem) => {
        let rel = item.p - G.dist;
        if (rel < -16) { item.p += WINDOW; rel = item.p - G.dist; }
        item.obj.position.z = CAR_Z - rel;
      };
      dashes.forEach(place);
      lamps.forEach(place);
      trees.forEach(place);

      // gate placement + resolution
      if (rig) {
        rig.group.position.z = CAR_Z - (rig.pos - G.dist);
        if (!rig.resolved && G.dist >= rig.pos) resolveGate(now);
        if (rig.flashUntil && now > rig.flashUntil) {
          rig.mats.forEach((mt) => mt.color.setRGB(1, 1, 1));
          rig.flashUntil = 0;
        }
        if (rig.popT0) {
          const pt = (now - rig.popT0) / 300;
          if (pt < 1) { const s = 1 + 0.045 * Math.sin(pt * Math.PI); rig.group.scale.set(s, s, s); }
          else { rig.group.scale.set(1, 1, 1); rig.popT0 = 0; }
        }
        if (rig.resolved && G.dist > rig.pos + 11) buildCurrentGate();
      } else if (G.done < n && positions[G.done] - G.dist < 150) {
        buildCurrentGate();
      }

      // finish arch
      finishGroup.position.z = CAR_Z - (finishPos - G.dist);
      finishGroup.visible = finishPos - G.dist < 165;
      if (!G.finished && G.done >= n && G.dist >= finishPos) {
        G.finished = true;
        G.finishAt = now;
        audioRef.current?.fanfare();
        setPhaseUi('finished');
      }
      if (G.finished && !finishedRef.current && now - G.finishAt > 1250) {
        finishedRef.current = true;
        apiRef.current.finish();
      }

      // dust drift
      {
        const attr = dustGeo.getAttribute('position') as THREE.BufferAttribute;
        for (let i = 0; i < DUST; i++) {
          dustPos[i * 3] = dustBase[i * 3] + Math.sin(t * 0.14 + i * 1.7) * 0.35;
          dustPos[i * 3 + 1] = dustBase[i * 3 + 1] + Math.sin(t * 0.22 + i * 2.3) * 0.22;
          // motes stream past the car as it drives (wraps over a 90-unit field)
          dustPos[i * 3 + 2] = CAR_Z + 6 - (((dustBase[i * 3 + 2] - G.dist) % 90) + 90) % 90;
        }
        attr.needsUpdate = true;
      }

      // camera: follow + fov kick + shake
      const shakeAmp = reduceMotion ? 0 : (now < G.shakeUntil ? 0.13 : 0.012 * speedNorm);
      const shX = shakeAmp ? (Math.random() - 0.5) * 2 * shakeAmp : 0;
      const shY = shakeAmp ? (Math.random() - 0.5) * 2 * shakeAmp * 0.7 : 0;
      camera.position.set(G.carX * 0.45 + shX, 3.55 + (reduceMotion ? 0 : Math.sin(t * 1.25) * 0.05) + shY, 8.8);
      camera.lookAt(G.carX * 0.62, 1.05, -9);
      const fovT = 62 + (reduceMotion ? 2 : 9) * Math.min(1, speedNorm);
      if (Math.abs(camera.fov - fovT) > 0.05) {
        camera.fov += (fovT - camera.fov) * Math.min(1, dt * 5);
        camera.updateProjectionMatrix();
      }

      // audio engine follows speed
      audioRef.current?.setEngine(speedNorm, G.running && !G.finished);

      // throttled HUD / test-hook sync
      if (now - lastSync > 120) {
        lastSync = now;
        setHudSpeed(Math.round(G.speed * 3.2));
        const correct = rig?.defs.find((d) => d.isCorrect);
        mount.dataset.phase = G.finished ? 'finished' : G.running ? 'racing' : 'ready';
        mount.dataset.checkpoint = String(G.done);
        mount.dataset.correctX = correct ? correct.laneX.toFixed(1) : '';
        mount.dataset.carX = G.carX.toFixed(1);
        mount.dataset.speed = String(Math.round(G.speed * 3.2));
      }

      if (composer) composer.render();
      else renderer.render(scene, camera);
    };

    const startLoop = () => {
      if (running) return;
      running = true;
      last = performance.now();
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
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('deviceorientation', onOrient);
      el.removeEventListener('pointerdown', onPointerDown);
      startSignalRef.current = null;
      disposeObject(scene);
      skyTex.dispose();
      envTex.dispose();
      composer?.dispose();
      bloomPass?.dispose();
      renderer.dispose();
      try { renderer.forceContextLoss(); } catch { /* ignore */ }
      if (el.parentElement === mount) mount.removeChild(el);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="life-wrap">
      <div className="note">{content.instructions}</div>

      <div className="card" style={{ padding: 14 }}>
        <div className="life-progress">
          <span className="chip chip-teal">🏁 המסלול של {celebrantName}</span>
          <span style={{ fontWeight: 800, fontSize: 14 }}>
            תחנה {Math.min(hudDone + 1, total)} מתוך {total}
          </span>
          <button type="button" className="race-mute" onClick={toggleMute} aria-label={muted ? 'בטל השתקה' : 'השתק'}>
            {muted ? '🔇' : '🔊'}
          </button>
        </div>
        <div style={{ height: 8 }} />
        <div className="life-progress" aria-hidden="true">
          <div className="life-progress-track">
            <div className="life-progress-fill" style={{ width: `${total ? (hudDone / total) * 100 : 0}%` }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 800 }}>{hudDone}/{total} ✓</span>
        </div>

        <div
          ref={mountRef}
          className="race3d"
          data-testid="life-race"
          data-phase="ready"
          role="application"
          aria-label="מירוץ תחנות החיים — גררו או השתמשו בחצים כדי לנהוג, ועברו בשער של התחנה הבאה בסיפור"
        >
          {phaseUi === 'ready' && (
            <div className="race-overlay">
              <div className="race-overlay-title">🏁 מירוץ החיים של {celebrantName}</div>
              <p className="race-overlay-text">
                נהגו במכונית ועברו בכל פעם בשער של התחנה שקרתה <strong>הבאה</strong> בחייה — מהמוקדמת למאוחרת.
                גרירה, חצים או הטיית הטלפון כדי לנהוג.
              </p>
              <button type="button" className="btn btn-coral btn-big" onClick={startRace}>התחל מירוץ 🚗</button>
            </div>
          )}
          {popup && (
            <div key={popup.id} className={`race-popup ${popup.kind === 'good' ? 'is-good' : 'is-bad'}`}>{popup.text}</div>
          )}
          {phaseUi === 'finished' && (
            <div className="race-finish-pop pop-in">
              <div style={{ fontSize: 46 }}>🏁🎉</div>
              <div className="race-finish-title">הגענו ליעד — בת המצווה!</div>
              <div className="race-finish-sub">עברתם בכל התחנות לפי הסדר 🚗💨</div>
            </div>
          )}
          <div className="race-speed" aria-hidden="true">🚗 {hudSpeed} קמ״ש</div>
        </div>

        <p className="muted" style={{ margin: '10px 0 0' }}>
          קראו את השלטים מעל השערים — ובחרו בכל פעם את התחנה הבאה בסיפור. טעות = התנגשות ומנסים שוב את אותה תחנה 💥
        </p>
      </div>
    </div>
  );
}
