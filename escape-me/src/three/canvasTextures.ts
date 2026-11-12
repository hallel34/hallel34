import * as THREE from 'three';

import floorUrl from '../assets/tex-wood-floor.jpg';
import wallUrl from '../assets/tex-wall.jpg';
import rugUrl from '../assets/tex-rug.jpg';
import doorUrl from '../assets/tex-door.jpg';
import deskUrl from '../assets/tex-desk.jpg';
import corkUrl from '../assets/tex-cork.jpg';
import sunsetUrl from '../assets/frame-sunset.jpg';
import cameraArtUrl from '../assets/frame-camera.jpg';
import alleyUrl from '../assets/frame-alley.jpg';

/** Photoreal generated assets (v2 design overhaul) — bundled, no runtime fetch. */
export const PHOTO = {
  floor: floorUrl,
  wall: wallUrl,
  rug: rugUrl,
  door: doorUrl,
  desk: deskUrl,
  cork: corkUrl,
  sunset: sunsetUrl,
  cameraArt: cameraArtUrl,
  alley: alleyUrl,
} as const;

/**
 * Load a bundled photo as a THREE texture.
 * mirror=true (default) uses MirroredRepeatWrapping so repeats never show a hard seam.
 */
export function makePhotoTexture(
  url: string,
  opts: { repeat?: [number, number]; mirror?: boolean; anisotropy?: number } = {},
): THREE.Texture {
  const tex = new THREE.TextureLoader().load(url);
  tex.colorSpace = THREE.SRGBColorSpace;
  const wrap = opts.mirror === false ? THREE.RepeatWrapping : THREE.MirroredRepeatWrapping;
  tex.wrapS = wrap;
  tex.wrapT = wrap;
  if (opts.repeat) tex.repeat.set(opts.repeat[0], opts.repeat[1]);
  tex.anisotropy = opts.anisotropy ?? 4;
  return tex;
}

/** Soft round particle sprite (for drifting dust motes). */
export function makeDustTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 64; c.height = 64;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,240,210,1)');
    g.addColorStop(0.4, 'rgba(255,230,180,0.45)');
    g.addColorStop(1, 'rgba(255,220,160,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Warm radial glow (light pools, bulb halos, door light-spill). */
export function makeGlowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  if (ctx) {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,214,140,0.9)');
    g.addColorStop(0.35, 'rgba(255,180,84,0.38)');
    g.addColorStop(1, 'rgba(255,160,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeEmojiTexture(emoji: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.font = '190px "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(emoji, 128, 140);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeLabelTexture(text: string): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 640; c.height = 160;
  const ctx = c.getContext('2d');
  if (ctx) {
    // v2 iteration: a lit brass plaque hanging over the door, not a UI pill —
    // warm bronze gradient, double gold rule, glowing cream letters.
    const grad = ctx.createLinearGradient(0, 26, 0, 134);
    grad.addColorStop(0, 'rgba(96,62,28,0.94)');
    grad.addColorStop(0.5, 'rgba(64,40,17,0.96)');
    grad.addColorStop(1, 'rgba(38,23,10,0.97)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(8, 26, 624, 108, 40);
    ctx.fill();
    ctx.strokeStyle = 'rgba(233,197,106,0.95)';
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(233,197,106,0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(20, 38, 600, 84, 30);
    ctx.stroke();
    ctx.font = '700 58px Heebo, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.direction = 'rtl';
    ctx.fillStyle = '#FFEBBE';
    ctx.shadowColor = 'rgba(255,176,66,0.85)';
    ctx.shadowBlur = 14;
    ctx.fillText(text, 320, 84);
    ctx.shadowBlur = 0;
    ctx.fillText(text, 320, 84);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeBadgeTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 128;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.beginPath();
    ctx.arc(64, 64, 56, 0, Math.PI * 2);
    ctx.fillStyle = '#5B8C5A';
    ctx.fill();
    ctx.lineWidth = 7;
    ctx.strokeStyle = '#FFF6E9';
    ctx.stroke();
    ctx.font = '900 68px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('✓', 64, 68);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function makeWoodTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#8B5E34';
    ctx.fillRect(0, 0, 512, 512);
    const plankH = 64;
    for (let y = 0; y < 512; y += plankH) {
      const shade = 0.92 + ((y / plankH) % 3) * 0.05;
      ctx.fillStyle = `rgb(${Math.round(139 * shade)},${Math.round(94 * shade)},${Math.round(52 * shade)})`;
      ctx.fillRect(0, y, 512, plankH - 3);
      ctx.fillStyle = 'rgba(60,35,15,0.55)';
      ctx.fillRect(0, y + plankH - 3, 512, 3);
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      for (let i = 0; i < 7; i++) {
        const gy = y + 8 + Math.random() * (plankH - 18);
        ctx.fillRect(0, gy, 512, 1.5);
      }
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  return tex;
}

export function makeClapperTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 48;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, 256, 48);
    ctx.fillStyle = '#FFFFFF';
    for (let x = -24; x < 256; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, 48);
      ctx.lineTo(x + 24, 0);
      ctx.lineTo(x + 48, 0);
      ctx.lineTo(x + 24, 48);
      ctx.closePath();
      ctx.fill();
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ------------------------------------------------------------------ */
/* v6 lived-in textures (all canvas-generated, zero bundle cost)       */
/* ------------------------------------------------------------------ */

/** Fridge-door collage: family photos, magnets, paper notes, a list. */
export function makeFridgeCollageTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 720;
  const ctx = c.getContext('2d');
  if (ctx) {
    // fridge door base — brushed light steel
    const bg = ctx.createLinearGradient(0, 0, 512, 0);
    bg.addColorStop(0, '#cfd4d8'); bg.addColorStop(0.5, '#e8ecee'); bg.addColorStop(1, '#c3c9cd');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 720);
    ctx.fillStyle = 'rgba(120,130,138,0.35)';
    ctx.fillRect(0, 236, 512, 5); // freezer split line
    const photo = (x: number, y: number, w: number, h: number, rot: number, sky: string, ground: string) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      ctx.shadowColor = 'rgba(0,0,0,0.35)'; ctx.shadowBlur = 8; ctx.shadowOffsetY = 3;
      ctx.fillStyle = '#fdfdf8'; ctx.fillRect(-w / 2, -h / 2, w, h + 14);
      ctx.shadowColor = 'transparent';
      const g = ctx.createLinearGradient(0, -h / 2, 0, h / 2);
      g.addColorStop(0, sky); g.addColorStop(0.62, ground); g.addColorStop(1, ground);
      ctx.fillStyle = g; ctx.fillRect(-w / 2 + 7, -h / 2 + 7, w - 14, h - 14);
      // simple sun + heads silhouettes
      ctx.fillStyle = 'rgba(255,236,170,0.95)';
      ctx.beginPath(); ctx.arc(w * 0.22, -h * 0.18, 11, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(40,34,30,0.75)';
      [-0.18, 0.05, 0.26].forEach((fx, i) => {
        ctx.beginPath(); ctx.arc(w * fx, h * 0.12, 8 - i, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(w * fx - 6 + i, h * 0.12 + 6, 12 - i * 2, 16);
      });
      ctx.restore();
    };
    photo(120, 130, 150, 110, -0.06, '#8ec9e8', '#7fae5a');
    photo(330, 118, 132, 100, 0.08, '#f6c177', '#c97b4a');
    photo(215, 300, 120, 92, 0.03, '#a8d8ea', '#e8dcc0');
    photo(392, 330, 104, 84, -0.09, '#b8e0c8', '#5a8a6a');
    // paper notes with scribble lines
    const note = (x: number, y: number, w: number, h: number, rot: number, tint: string) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
      ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
      ctx.fillStyle = tint; ctx.fillRect(-w / 2, -h / 2, w, h);
      ctx.shadowColor = 'transparent';
      ctx.strokeStyle = 'rgba(70,80,110,0.55)'; ctx.lineWidth = 3;
      for (let ly = -h / 2 + 22; ly < h / 2 - 8; ly += 17) {
        ctx.beginPath(); ctx.moveTo(-w / 2 + 10, ly);
        ctx.lineTo(w / 2 - 10 - Math.random() * 22, ly); ctx.stroke();
      }
      ctx.restore();
    };
    note(105, 330, 108, 128, 0.05, '#fffbe8');
    note(300, 470, 150, 110, -0.04, '#ffffff');
    note(120, 540, 128, 96, -0.07, '#ffeef4');
    note(360, 590, 118, 140, 0.06, '#eef6ff');
    // colored round magnets
    const magnetCols = ['#e4572e', '#2a9d8f', '#f2a007', '#7a4a8c', '#2a6d8a', '#d94f30', '#5b8c5a', '#e86a92'];
    const magnetAt: [number, number][] = [[120, 62], [330, 52], [215, 238], [392, 272], [105, 262], [300, 408], [120, 486], [360, 516], [52, 440], [452, 430], [250, 640], [452, 120]];
    magnetAt.forEach(([mx, my], i) => {
      ctx.fillStyle = magnetCols[i % magnetCols.length];
      ctx.beginPath(); ctx.arc(mx, my, 13, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.beginPath(); ctx.arc(mx - 4, my - 4, 4.5, 0, Math.PI * 2); ctx.fill();
    });
    // a child's drawing (house + sun, crayon style)
    ctx.save(); ctx.translate(255, 585); ctx.rotate(-0.02);
    ctx.fillStyle = '#fdfdf6'; ctx.fillRect(-70, -58, 140, 116);
    ctx.strokeStyle = '#d94f30'; ctx.lineWidth = 4;
    ctx.strokeRect(-34, -6, 68, 48);
    ctx.beginPath(); ctx.moveTo(-42, -6); ctx.lineTo(0, -38); ctx.lineTo(42, -6); ctx.closePath(); ctx.stroke();
    ctx.strokeStyle = '#2a6d8a'; ctx.strokeRect(-9, 14, 18, 28);
    ctx.strokeStyle = '#f2a007'; ctx.beginPath(); ctx.arc(48, -34, 11, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** A single pinned paper note (scribbles only — never gameplay data). */
export function makePaperNoteTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 320;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#fffdf2';
    ctx.fillRect(0, 0, 256, 320);
    ctx.strokeStyle = 'rgba(140,170,220,0.5)'; ctx.lineWidth = 2;
    for (let y = 64; y < 300; y += 34) { ctx.beginPath(); ctx.moveTo(14, y); ctx.lineTo(242, y); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(60,70,100,0.75)'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    const scribble = (y: number, w: number) => {
      ctx.beginPath(); ctx.moveTo(26, y);
      for (let x = 26; x < 26 + w; x += 14) ctx.lineTo(x + 7, y + (Math.random() * 8 - 4));
      ctx.stroke();
    };
    scribble(52, 180); scribble(86, 200); scribble(120, 150); scribble(154, 190);
    // a little star doodle
    ctx.strokeStyle = '#e4572e'; ctx.lineWidth = 5;
    ctx.beginPath();
    for (let i = 0; i <= 5; i++) {
      const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
      const px = 128 + Math.cos(a) * 34; const py = 248 + Math.sin(a) * 34;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.stroke();
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Woven doormat with a simple border pattern. */
export function makeDoormatTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 160;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#6b5138'; ctx.fillRect(0, 0, 256, 160);
    for (let i = 0; i < 2600; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,240,210,0.08)';
      ctx.fillRect(Math.random() * 256, Math.random() * 160, 3, 1.6);
    }
    ctx.strokeStyle = '#e8d9b0'; ctx.lineWidth = 7; ctx.strokeRect(14, 14, 228, 132);
    ctx.strokeStyle = 'rgba(232,217,176,0.5)'; ctx.lineWidth = 3; ctx.strokeRect(28, 28, 200, 104);
    ctx.fillStyle = '#e8d9b0';
    ctx.font = '900 44px Arial, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('ברוכים הבאים', 128, 82);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Hallway runner — deep red with a geometric border. */
export function makeRunnerTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 512;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#7e2f26'; ctx.fillRect(0, 0, 256, 512);
    ctx.fillStyle = '#93392d'; ctx.fillRect(22, 22, 212, 468);
    ctx.strokeStyle = '#e3c98f'; ctx.lineWidth = 5; ctx.strokeRect(22, 22, 212, 468);
    ctx.strokeStyle = 'rgba(227,201,143,0.6)'; ctx.lineWidth = 2.5; ctx.strokeRect(36, 36, 184, 440);
    ctx.fillStyle = 'rgba(227,201,143,0.75)';
    for (let y = 70; y < 480; y += 68) {
      ctx.save(); ctx.translate(128, y); ctx.rotate(Math.PI / 4);
      ctx.fillRect(-17, -17, 34, 34); ctx.restore();
      ctx.fillStyle = '#5d231c';
      ctx.save(); ctx.translate(128, y); ctx.rotate(Math.PI / 4);
      ctx.fillRect(-9, -9, 18, 18); ctx.restore();
      ctx.fillStyle = 'rgba(227,201,143,0.75)';
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping; tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

/** Striped bathroom towel. */
export function makeTowelTexture(base = '#eef2ee', stripe = '#2a9d8f'): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128; c.height = 192;
  const ctx = c.getContext('2d');
  if (ctx) {
    ctx.fillStyle = base; ctx.fillRect(0, 0, 128, 192);
    for (let i = 0; i < 1500; i++) {
      ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.045)' : 'rgba(255,255,255,0.5)';
      ctx.fillRect(Math.random() * 128, Math.random() * 192, 2, 2);
    }
    ctx.fillStyle = stripe;
    ctx.fillRect(0, 148, 128, 9); ctx.fillRect(0, 164, 128, 5);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Dispose every geometry / material / texture under an object tree. */
export function disposeObject(root: THREE.Object3D): void {
  root.traverse((o) => {
    const withGeo = o as THREE.Object3D & { geometry?: THREE.BufferGeometry };
    if (withGeo.geometry) withGeo.geometry.dispose();
    const withMat = o as THREE.Object3D & { material?: THREE.Material | THREE.Material[] };
    const mats = withMat.material;
    if (Array.isArray(mats)) {
      mats.forEach((m) => {
        const withMap = m as THREE.Material & { map?: THREE.Texture | null };
        if (withMap.map) withMap.map.dispose();
        m.dispose();
      });
    } else if (mats) {
      const withMap = mats as THREE.Material & { map?: THREE.Texture | null };
      if (withMap.map) withMap.map.dispose();
      mats.dispose();
    }
  });
}
