/**
 * Device helpers — best-effort, NEVER throwing.
 * Every function catches internally so game code can call them fire-and-forget.
 */

/** Haptic feedback. good → short 25ms, handled by caller passing patterns. */
export function buzz(pattern: number | number[]): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch { /* ignore */ }
}

/** StageApi.feedback implementation: good = 25ms, bad = [50,40,50]. */
export function feedbackBuzz(kind: 'good' | 'bad'): void {
  buzz(kind === 'good' ? 25 : [50, 40, 50]);
}

export function tryFullscreen(el: HTMLElement): void {
  try {
    const anyEl = el as HTMLElement & { webkitRequestFullscreen?: () => Promise<void> };
    if (document.fullscreenElement) return;
    if (typeof el.requestFullscreen === 'function') {
      void el.requestFullscreen().catch(() => undefined);
    } else if (typeof anyEl.webkitRequestFullscreen === 'function') {
      void anyEl.webkitRequestFullscreen().catch(() => undefined);
    }
  } catch { /* ignore */ }
}

export function exitFullscreen(): void {
  try {
    if (document.fullscreenElement && typeof document.exitFullscreen === 'function') {
      void document.exitFullscreen().catch(() => undefined);
    }
  } catch { /* ignore */ }
}

export async function requestWakeLock(): Promise<unknown | null> {
  try {
    const nav = navigator as Navigator & { wakeLock?: { request: (type: string) => Promise<unknown> } };
    if (nav.wakeLock && typeof nav.wakeLock.request === 'function') {
      return await nav.wakeLock.request('screen');
    }
    return null;
  } catch { return null; }
}

export function releaseWakeLock(lock: unknown): void {
  try {
    const l = lock as { release?: () => Promise<void> } | null;
    if (l && typeof l.release === 'function') void l.release().catch(() => undefined);
  } catch { /* ignore */ }
}

export function needsOrientationPermission(): boolean {
  try {
    const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: unknown } }).DeviceOrientationEvent;
    return !!DOE && typeof DOE.requestPermission === 'function';
  } catch { return false; }
}

/** Ask for DeviceOrientation permission (must be called from a user tap). Returns true if granted / not needed. */
export async function requestOrientationPermission(): Promise<boolean> {
  try {
    const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } }).DeviceOrientationEvent;
    if (DOE && typeof DOE.requestPermission === 'function') {
      const res = await DOE.requestPermission();
      return res === 'granted';
    }
    return true;
  } catch { return false; }
}

export async function probeCamera(): Promise<boolean> {
  try {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') return false;
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    try { stream.getTracks().forEach((t) => t.stop()); } catch { /* ignore */ }
    return true;
  } catch { return false; }
}
