// The one palette (content's PALETTE) as CSS variables, and the one pixel font.
import fontUrl from '@scratchboy/content/assets/fonts/micro5.ttf?url';
import '@scratchboy/content/assets/fonts/micro5.license.txt?url';
import { PALETTE } from '@scratchboy/content';

export const FONT_FAMILY = 'Micro 5';

export function applyPalette(): void {
  const root = document.documentElement.style;
  for (const [name, hex] of Object.entries(PALETTE)) root.setProperty(`--c-${name}`, hex);
}

export async function loadFont(): Promise<void> {
  const face = new FontFace(FONT_FAMILY, `url(${fontUrl})`);
  document.fonts.add(await face.load());
}

/** Micro 5's two sizes: 11 px text in 10 px lines with its baseline on row 7, and the 22 px
 *  emphasis in 20 px lines with its baseline on row 15. */
const TEXT_SIZES = [
  { variable: '--text-nudge', size: 11, line: 10, row: 7 },
  { variable: '--text-nudge-big', size: 22, line: 20, row: 15 },
] as const;

/** Sets `--text-nudge` and `--text-nudge-big` on `el`, an element enlarged by CSS zoom (`scale` CSS
 *  px per px inside it): how far `.tx` moves the text so its baseline lands on a whole pixel.
 *  Measured, not fixed: the browser rounds the font's ascent and the half-leading to device
 *  pixels, so the baseline falls 7.33 to 7.5 px into a 10 px line depending on the zoom, and no one
 *  fixed nudge is right at every zoom (zoom 6 needs less than -0.42 px, zoom 9 more than -0.39). */
export function setTextNudges(el: HTMLElement, scale: number): void {
  for (const { variable, size, line, row } of TEXT_SIZES) {
    const probe = document.createElement('div');
    probe.style.cssText = `position:absolute;left:0;top:0;visibility:hidden;font:${size}px/${line}px '${FONT_FAMILY}'`;
    const baseline = document.createElement('span');
    baseline.style.cssText = 'display:inline-block;vertical-align:baseline';
    probe.append(baseline);
    el.append(probe);
    const at = (baseline.getBoundingClientRect().top - probe.getBoundingClientRect().top) / scale;
    probe.remove();
    el.style.setProperty(variable, `${row - at}px`);
  }
}
