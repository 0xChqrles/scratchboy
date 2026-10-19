// Dev shortcuts: URL parameters that open a scene in a given state. Production builds ignore them.
//   ?scene=battle&fixture=riff&seed=42&lang=en

export interface DevParams {
  scene: string | null;
  fixture: string | null;
  seed: number | null;
  lang: string | null;
}

export function readDevParams(): DevParams {
  const params = import.meta.env.DEV ? new URLSearchParams(window.location.search) : new URLSearchParams();
  const seed = params.get('seed');
  return {
    scene: params.get('scene'),
    fixture: params.get('fixture'),
    seed: seed !== null && /^\d+$/.test(seed) ? Number(seed) : null,
    lang: params.get('lang'),
  };
}
