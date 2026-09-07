/**
 * Small registry so palette commands (e.g. "Import shape library") can reach
 * a live Excalidraw imperative API for updateLibrary calls. At most one
 * drawing editor is mounted at a time in practice; the registry supports a
 * Set for correctness anyway.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Api = any;

const apis = new Set<Api>();

export function registerExcalidrawApi(api: Api): void {
  apis.add(api);
}

export function unregisterExcalidrawApi(api: Api): void {
  apis.delete(api);
}

export function currentExcalidrawApi(): Api | null {
  const first = apis.values().next().value;
  return first ?? null;
}
