/**
 * WebGL availability gate — best-effort, NEVER throws.
 * Result is probed once and cached. Every 3D surface must check this first;
 * on false the app uses the existing 2D flow unchanged.
 */

let cached: boolean | null = null;

export function isWebGLAvailable(): boolean {
  if (cached !== null) return cached;
  try {
    const canvas = document.createElement('canvas');
    const gl = (canvas.getContext('webgl2') || canvas.getContext('webgl')) as
      | WebGLRenderingContext
      | WebGL2RenderingContext
      | null;
    if (!gl) {
      cached = false;
      return cached;
    }
    try {
      const lose = gl.getExtension('WEBGL_lose_context') as { loseContext: () => void } | null;
      if (lose) lose.loseContext();
    } catch { /* ignore — context is discarded with the canvas anyway */ }
    cached = true;
    return cached;
  } catch {
    cached = false;
    return cached;
  }
}
