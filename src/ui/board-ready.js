import boardUrl from '../assets/board-premium.webp?url';

let ready;
/** Decode the physical board before mounting its transparent live overlays. */
export function prepareBoardImage() {
  return ready ??= new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => image.decode().then(resolve, (err) => { ready = null; reject(err); });
    image.onerror = () => { ready = null; reject(new Error('Board image failed to load')); };
    image.src = boardUrl;
  });
}
