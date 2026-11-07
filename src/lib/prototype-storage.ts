import { readPreviewSession } from './preview-session';
import { prototypePreviewEnabled } from './preview-environment';

const values = new Map<string, string>();
const memory: Storage = {
  get length() { return values.size; },
  clear: () => values.clear(),
  getItem: key => values.get(key) ?? null,
  key: index => [...values.keys()][index] ?? null,
  removeItem: key => { values.delete(key); },
  setItem: (key, value) => { values.set(key, value); },
};
export const PROTOTYPE_STORAGE_PREFIX = 'gyvora-isolated-prototype:';
const persistent: Storage = {
  get length() { return Object.keys(localStorage).filter(key => key.startsWith(PROTOTYPE_STORAGE_PREFIX)).length; },
  clear: () => { Object.keys(localStorage).filter(key => key.startsWith(PROTOTYPE_STORAGE_PREFIX)).forEach(key => localStorage.removeItem(key)); },
  getItem: key => localStorage.getItem(PROTOTYPE_STORAGE_PREFIX + key),
  key: index => Object.keys(localStorage).filter(key => key.startsWith(PROTOTYPE_STORAGE_PREFIX))[index]?.slice(PROTOTYPE_STORAGE_PREFIX.length) ?? null,
  removeItem: key => localStorage.removeItem(PROTOTYPE_STORAGE_PREFIX + key),
  setItem: (key, value) => localStorage.setItem(PROTOTYPE_STORAGE_PREFIX + key, value),
};
// Shared across fictional roles in this browser, never the legacy/account store.
export function prototypeStorage(): Storage {
  return readPreviewSession() || prototypePreviewEnabled() ? persistent : localStorage;
}
export function clearPrototypeStorage() { memory.clear(); }