// Persists ONLY user-created items (not present in initial mocks) from a
// zustand store into localStorage. Used by Seguridad / Sanitario so that any
// perimeter, control, cierre, víctima... drawn on the map survives reloads
// without bloating the mocks.
//
// Tombstones: cuando el operador BORRA un item (incluido un mock inicial), su
// ID se guarda en un set persistido. En el siguiente arranque/rehidratación
// se filtran de la lista viva — así un mock eliminado no vuelve a aparecer
// "al rato" cuando el módulo se recarga (HMR, navegación, etc.).

type AnyRecord = Record<string, unknown>;
type WithId = { id: string };

interface MinimalStore {
  getState: () => unknown;
  setState: (patch: AnyRecord) => void;
  subscribe: (listener: (state: unknown) => void) => () => void;
}

const KEY_PREFIX = "em-map-v1:";
const TOMB_SUFFIX = ":tombstones";

const isObj = (v: unknown): v is AnyRecord =>
  typeof v === "object" && v !== null;

const safeReadJson = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

const safeWriteJson = (key: string, value: unknown) => {
  try {
    if (
      value == null ||
      (Array.isArray(value) && value.length === 0) ||
      (isObj(value) && Object.keys(value).length === 0)
    ) {
      localStorage.removeItem(key);
    } else {
      localStorage.setItem(key, JSON.stringify(value));
    }
  } catch {
    /* storage full / disabled */
  }
};

export const bindMapPersistence = (
  scope: string,
  store: MinimalStore,
  initialMocks: Record<string, WithId[]>,
): void => {
  const storageKey = KEY_PREFIX + scope;
  const tombKey = storageKey + TOMB_SUFFIX;
  const fields = Object.keys(initialMocks);

  const mockIdsByField = new Map<string, Set<string>>();
  for (const f of fields) {
    const arr = initialMocks[f] ?? [];
    mockIdsByField.set(f, new Set(arr.map((x) => x.id)));
  }

  // Tombstones: { fieldName: [id, id, ...] } — items que el operador ha
  // borrado y NUNCA deben volver a aparecer.
  const tombstones: Record<string, Set<string>> = {};
  for (const f of fields) tombstones[f] = new Set();
  const savedTombs = safeReadJson<Record<string, string[]>>(tombKey);
  if (savedTombs) {
    for (const f of fields) {
      const arr = savedTombs[f];
      if (Array.isArray(arr)) tombstones[f] = new Set(arr);
    }
  }
  const persistTombs = () => {
    const out: Record<string, string[]> = {};
    let any = false;
    for (const f of fields) {
      if (tombstones[f].size > 0) {
        out[f] = Array.from(tombstones[f]);
        any = true;
      }
    }
    safeWriteJson(tombKey, any ? out : null);
  };

  // Rehidratación: aplicamos un patch atómico que (a) saca cualquier mock
  // tombstoned y (b) añade los user items guardados.
  try {
    const saved = safeReadJson<Record<string, WithId[]>>(storageKey);
    const current = store.getState();
    if (isObj(current)) {
      const patch: AnyRecord = {};
      let dirty = false;
      for (const f of fields) {
        const live = current[f];
        if (!Array.isArray(live)) continue;
        let next = live as WithId[];
        // (a) quita tombstoned
        if (tombstones[f].size > 0) {
          const before = next.length;
          next = next.filter((x) => !tombstones[f].has(x.id));
          if (next.length !== before) dirty = true;
        }
        // (b) añade saved user items que no estén ya
        const savedItems = saved?.[f];
        if (Array.isArray(savedItems) && savedItems.length > 0) {
          const liveIds = new Set(next.map((x) => x.id));
          const fresh = savedItems.filter(
            (x) =>
              isObj(x) &&
              typeof x.id === "string" &&
              !liveIds.has(x.id) &&
              !tombstones[f].has(x.id),
          );
          if (fresh.length > 0) {
            next = [...(fresh as WithId[]), ...next];
            dirty = true;
          }
        }
        if (dirty) patch[f] = next;
      }
      if (dirty) store.setState(patch);
    }
  } catch {
    /* ignore bad JSON */
  }

  // Snapshot del último set de IDs por campo. Lo usamos para detectar
  // desapariciones (removes) y darlas de alta como tombstones inmediatamente.
  const lastIdsByField = new Map<string, Set<string>>();
  const cur = store.getState();
  if (isObj(cur)) {
    for (const f of fields) {
      const arr = cur[f];
      if (Array.isArray(arr)) {
        lastIdsByField.set(f, new Set((arr as WithId[]).map((x) => x.id)));
      }
    }
  }

  const write = (state: unknown) => {
    if (!isObj(state)) return;
    const out: Record<string, WithId[]> = {};
    let any = false;
    let tombsChanged = false;
    for (const f of fields) {
      const arr = state[f];
      if (!Array.isArray(arr)) continue;
      const currIds = new Set((arr as WithId[]).map((x) => x.id));
      // Detecta IDs que han desaparecido respecto al snapshot anterior →
      // tombstone (sea mock o user item, no debe volver).
      const prev = lastIdsByField.get(f);
      if (prev) {
        for (const id of prev) {
          if (!currIds.has(id)) {
            tombstones[f].add(id);
            tombsChanged = true;
          }
        }
      }
      lastIdsByField.set(f, currIds);

      // Persistimos los user items (no-mock) que sigan vivos.
      const mockIds = mockIdsByField.get(f);
      const userItems = (arr as WithId[]).filter(
        (x) =>
          isObj(x) &&
          typeof x.id === "string" &&
          !(mockIds?.has(x.id) ?? false),
      );
      if (userItems.length > 0) {
        out[f] = userItems;
        any = true;
      }
    }
    safeWriteJson(storageKey, any ? out : null);
    if (tombsChanged) persistTombs();
  };

  let pending: number | undefined;
  store.subscribe((state) => {
    if (pending !== undefined) window.clearTimeout(pending);
    pending = window.setTimeout(() => write(state), 200);
  });
};
