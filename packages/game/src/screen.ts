// One pixel grid (root contract 10): one game pixel is a whole number of device pixels, the
// largest that still shows at least MIN_VIEW. Extra space shows more of the world.

export const MIN_VIEW_WIDTH = 320;
export const MIN_VIEW_HEIGHT = 180;

export interface ScreenLayout {
  /** Visible area in game pixels. */
  width: number;
  height: number;
  /** Device pixels per game pixel. Always a whole number. */
  zoom: number;
  /** CSS pixels per game pixel (zoom / devicePixelRatio): how much the view that holds the canvas
   *  and the UI is enlarged. */
  px: number;
  /** How the view is enlarged: CSS `zoom`, or a scale transform where zoom can't be exact. */
  enlarge: 'zoom' | 'transform';
  /** The view's position in CSS pixels, on a device pixel boundary. */
  left: number;
  top: number;
  portrait: boolean;
}

let probe: HTMLDivElement | null = null;

// Reads env(safe-area-inset-*) so notches and home bars never cover the game.
function safeArea(): { top: number; right: number; bottom: number; left: number } {
  if (!probe) {
    probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;visibility:hidden;pointer-events:none;' +
      'padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
    document.body.appendChild(probe);
  }
  const style = getComputedStyle(probe);
  return {
    top: parseFloat(style.paddingTop) || 0,
    right: parseFloat(style.paddingRight) || 0,
    bottom: parseFloat(style.paddingBottom) || 0,
    left: parseFloat(style.paddingLeft) || 0,
  };
}

let zoomCheck = { key: '', exact: true };

/** Whether CSS `zoom: px` lays out exactly `zoom` device px per game px here. Chromium lays out in
 *  device pixels, so it does at any ratio. WebKit lays out in 1/64 CSS px, so with a ratio of 3 a
 *  zoom of 5 or 7 (5/3 or 7/3 CSS px per game px) drifts off the device pixels. */
function zoomIsExact(px: number, zoom: number, dpr: number): boolean {
  const key = `${px} ${zoom} ${dpr}`;
  if (zoomCheck.key !== key) {
    const zoomed = document.createElement('div');
    zoomed.style.cssText = `position:absolute;visibility:hidden;zoom:${px}`;
    const box = document.createElement('div');
    box.style.cssText = 'width:1px;height:1px';
    zoomed.append(box);
    document.body.appendChild(zoomed);
    const exact = Math.abs(box.getBoundingClientRect().width * dpr - zoom) < 0.001;
    zoomed.remove();
    zoomCheck = { key, exact };
  }
  return zoomCheck.exact;
}

export function measureScreen(): ScreenLayout {
  const dpr = window.devicePixelRatio || 1;
  const inset = safeArea();
  const cssWidth = window.innerWidth - inset.left - inset.right;
  const cssHeight = window.innerHeight - inset.top - inset.bottom;
  const deviceWidth = Math.floor(cssWidth * dpr);
  const deviceHeight = Math.floor(cssHeight * dpr);
  const zoom = Math.max(
    1,
    Math.floor(Math.min(deviceWidth / MIN_VIEW_WIDTH, deviceHeight / MIN_VIEW_HEIGHT)),
  );
  // With a whole-number ratio (Apple devices), the view's size and position are also whole CSS px:
  // WebKit draws a WebGL canvas on whole CSS px, so half a CSS px would stretch the canvas by one
  // device px or put it one device px off the UI. That can cost a game px or two of the view.
  const step = Number.isInteger(dpr) ? dpr : 1;
  const fit = (device: number, min: number) => {
    let n = Math.floor(device / zoom);
    while (n > min && (n * zoom) % step !== 0) n--;
    return n;
  };
  const width = fit(deviceWidth, MIN_VIEW_WIDTH);
  const height = fit(deviceHeight, MIN_VIEW_HEIGHT);
  // The leftover (under one game px, plus any trim) is split on both sides.
  const half = (spare: number) => Math.floor(spare / 2 / step) * step;
  const left = Math.round(inset.left * dpr) + half(deviceWidth - width * zoom);
  const top = Math.round(inset.top * dpr) + half(deviceHeight - height * zoom);
  const px = zoom / dpr;
  // Zoom wherever it is exact. Otherwise (WebKit at a ratio of 3 with zoom 5 or 7) a scale
  // transform, which WebKit draws exactly at a whole ratio. Never a transform at a fractional
  // ratio: Chromium lays out and snaps in device px before a transform runs, so a game px would
  // come out 2 or 3 device px and then be stretched.
  const enlarge = zoomIsExact(px, zoom, dpr) || !Number.isInteger(dpr) ? 'zoom' : 'transform';
  return {
    width,
    height,
    zoom,
    px,
    enlarge,
    left: left / dpr,
    top: top / dpr,
    portrait: cssHeight > cssWidth,
  };
}

let current: ScreenLayout | null = null;
let currentKey = '';

/** The current layout, the same object until something changes (for useSyncExternalStore). */
export function getScreen(): ScreenLayout {
  const next = measureScreen();
  const key = JSON.stringify(next);
  if (!current || key !== currentKey) {
    current = next;
    currentKey = key;
  }
  return current;
}

export function subscribeScreen(onChange: () => void): () => void {
  // A window dragged to a screen with another pixel ratio may fire no resize, so the ratio is
  // watched too. The query matches one ratio, so it is made again after each change.
  let ratio: MediaQueryList | null = null;
  function watchRatio(): void {
    ratio?.removeEventListener('change', onRatioChange);
    ratio = window.matchMedia(`(resolution: ${window.devicePixelRatio}dppx)`);
    ratio.addEventListener('change', onRatioChange);
  }
  function onRatioChange(): void {
    watchRatio();
    onChange();
  }
  watchRatio();
  window.addEventListener('resize', onChange);
  window.addEventListener('orientationchange', onChange);
  window.visualViewport?.addEventListener('resize', onChange);
  return () => {
    ratio?.removeEventListener('change', onRatioChange);
    window.removeEventListener('resize', onChange);
    window.removeEventListener('orientationchange', onChange);
    window.visualViewport?.removeEventListener('resize', onChange);
  };
}
