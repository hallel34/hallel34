// Rendered-colour contrast of every amount on screen (round 12, item 15). axe cannot judge text on a gradient ('incomplete'), so this
// measures what is really painted: the text colour (opacity of every ancestor included) against the pixels behind it, taken from a
// screenshot with all text hidden, sampled over the whole box of each `.money` element. Fails below 4.5:1 (worst sampled pixel).
// usage: const bad = await moneyContrast(page); check(bad.length === 0, ...)
const SELECTOR = '.money, .story-num, [data-money]';
const MIN = 4.5;

/** Every visible amount with its colour, box and covering state. */
async function collect(page) {
  return page.evaluate((sel) => {
    const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r, g, b, a }; };
    const out = [];
    for (const el of document.querySelectorAll(sel)) {
      const txt = el.textContent.trim();
      if (!txt) continue;
      const cs = getComputedStyle(el);
      if (cs.visibility === 'hidden' || cs.display === 'none') continue;
      let op = 1; for (let n = el; n && n.nodeType === 1; n = n.parentElement) op *= Number(getComputedStyle(n).opacity);
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2 || r.bottom <= 0 || r.top >= innerHeight || r.right <= 0 || r.left >= innerWidth) continue;
      // covered by something else (a sheet over the board): the text the player sees is not this one
      const probe = (x, y) => { const e = document.elementFromPoint(Math.min(Math.max(x, 0), innerWidth - 1), Math.min(Math.max(y, 0), innerHeight - 1)); return !!e && (el === e || el.contains(e) || e.contains(el) && e !== document.body && e !== document.documentElement && !e.matches('.layer, .scrim, #modal-root, #app')); };
      if (!probe(r.left + r.width / 2, r.top + r.height / 2)) continue;
      const col = parse(cs.color) ?? { r: 0, g: 0, b: 0, a: 1 };
      const fill = parse(cs.webkitTextFillColor);
      const c = fill && fill.a > 0 ? fill : col;
      out.push({ text: txt.slice(0, 24), cls: String(el.className).slice(0, 40), parent: String(el.parentElement?.className ?? '').slice(0, 30), x: r.left, y: r.top, w: r.width, h: r.height, color: { ...c, a: c.a * op }, size: parseFloat(cs.fontSize), weight: Number(cs.fontWeight) });
    }
    return out;
  }, SELECTOR);
}

/** Pixels of the viewport with every glyph hidden: the background each amount really sits on (gradients, scrims, glass). */
async function backdrop(page, boxes) {
  const handle = await page.addStyleTag({ content: '*, *::before, *::after { color: transparent !important; -webkit-text-fill-color: transparent !important; text-shadow: none !important; caret-color: transparent !important; } svg { visibility: hidden !important; }' });
  const png = await page.screenshot({ type: 'png', animations: 'allow' });
  await handle.evaluate((n) => n.remove());
  return page.evaluate(async ({ b64, boxes }) => {
    const img = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
    const k = img.width / innerWidth;
    const cv = new OffscreenCanvas(img.width, img.height); const cx = cv.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0);
    const lin = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
    const lum = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
    return boxes.map((bx) => {
      // the sample box is inset by 2 CSS px: the edge pixels belong to a neighbour's glow / outline (a highlight ring hugs the element), not to the text's background
      const ins = bx.w > 12 && bx.h > 12 ? 2 : 0;
      const x0 = Math.max(0, Math.floor((bx.x + ins) * k)); const y0 = Math.max(0, Math.floor((bx.y + ins) * k));
      const w = Math.max(1, Math.min(img.width - x0, Math.floor((bx.w - 2 * ins) * k))); const hh = Math.max(1, Math.min(img.height - y0, Math.floor((bx.h - 2 * ins) * k)));
      const d = cx.getImageData(x0, y0, w, hh).data;
      const step = Math.max(1, Math.floor(Math.sqrt((w * hh) / 400)));
      let worst = 21; let at = null; const c = bx.color;
      for (let y = 0; y < hh; y += step) for (let x = 0; x < w; x += step) {
        const i = (y * w + x) * 4; const br = d[i]; const bg = d[i + 1]; const bb = d[i + 2];
        const a = c.a; const r = c.r * a + br * (1 - a); const g = c.g * a + bg * (1 - a); const bl = c.b * a + bb * (1 - a);
        const L1 = lum(r, g, bl); const L2 = lum(br, bg, bb);
        const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
        if (ratio < worst) { worst = ratio; at = { x: Math.round(bx.x + x / k), y: Math.round(bx.y + y / k), bg: [br, bg, bb] }; }
      }
      return { worst, at };
    });
  }, { b64: png.toString('base64'), boxes });
}

/**
 * Contrast of every visible amount. Returns the offenders ({ text, ratio, cls }). `min` defaults to 4.5.
 * Waits for the fades first (a half-transparent entrance would read as low contrast).
 */
export async function moneyContrast(page, { min = MIN } = {}) {
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running' || a.effect?.getComputedTiming().iterations === Infinity), null, { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(150);
  const boxes = await collect(page);
  if (!boxes.length) return { checked: 0, bad: [] };
  const ratios = await backdrop(page, boxes);
  return { checked: boxes.length, bad: boxes.map((b, i) => ({ text: b.text, cls: b.cls, parent: b.parent, ratio: Math.round(ratios[i].worst * 100) / 100, at: ratios[i].at, color: [b.color.r, b.color.g, b.color.b, Math.round(b.color.a * 100) / 100] })).filter((x) => x.ratio < min) };
}
