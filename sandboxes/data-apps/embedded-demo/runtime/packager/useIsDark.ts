import { useSyncExternalStore } from 'react';

// Native embeds scope the theme to their own root, so the app cannot read the
// host page's root class. The mount contract drives this store instead.
export type ThemePref = 'auto' | 'light' | 'dark';
let pref: ThemePref = 'light';
const listeners = new Set<() => void>();
export function computeIsDark(): boolean {
  return pref === 'dark' || (pref === 'auto' && typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches);
}
export function setThemePref(value: ThemePref) { pref = value; listeners.forEach(listener => listener()); }
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener); }; };
export function useIsDark(): boolean { return useSyncExternalStore(subscribe, computeIsDark, () => false); }
export function useThemePref(): ThemePref { return useSyncExternalStore(subscribe, () => pref, () => pref); }
